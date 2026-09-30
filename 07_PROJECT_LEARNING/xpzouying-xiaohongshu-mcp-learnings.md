# Forensic Learning Record (Deep Inspection): xpzouying/xiaohongshu-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/xpzouying-xiaohongshu-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:31:49.552Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xpzouying/xiaohongshu-mcp`
- **Description**: MCP for xiaohongshu.com
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 16065 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app_server.go`
```
package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/sirupsen/logrus"
)

// AppServer 应用服务器结构体，封装所有服务和处理器
type AppServer struct {
	xiaohongshuService *XiaohongshuService
	mcpServer          *mcp.Server
	router             *gin.Engine
	httpServer         *http.Server
	authToken          string
}

// NewAppServer 创建新的应用服务器实例
func NewAppServer(xiaohongshuService *XiaohongshuService, authToken string) *AppServer {
	appServer := &AppServer{
		xiaohongshuService: xiaohongshuService,
		authToken:          authToken,
	}

	// 初始化 MCP Server（需要在创建 appServer 之后，因为工具注册需要访问 appServer）
	appServer.mcpServer = InitMCPServer(appServer)

	return appServer
}

// Start 启动服务器
func (s *AppServer) Start(port string) error {
	s.router = setupRoutes(s)

	s.httpServer = &http.Server{
		Addr:    port,
		Handler: s.router,
	}

	// 启动服务器的 goroutine
	go func() {
		logrus.Infof("启动 HTTP 服务器: %s", port)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.Errorf("服务器启动失败: %v", err)
			os.Exit(1)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Infof("正在关闭服务器...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		logrus.Warnf("等待连接关闭超时，强制退出: %v", err)
	} else {
		logrus.Infof("服务器已优雅关闭")
	}

	return nil
}

```

### Core Architecture Module: `browser/browser.go`
```
package browser

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/sirupsen/logrus"
	"github.com/xpzouying/headless_browser"
	"github.com/xpzouying/xiaohongshu-mcp/cookies"
)

type browserConfig struct {
	// fingerprintSeed 固定指纹 seed；>0 时钉死，同账号每次同一套指纹。0 = 每次随机。
	fingerprintSeed int
	// proxy 代理地址；非空时启用。
	proxy string
}

type Option func(*browserConfig)

// WithProxy 设置代理（http/https/socks5）。空字符串视为不启用。
func WithProxy(proxy string) Option {
	return func(c *browserConfig) {
		c.proxy = proxy
	}
}

// WithFingerprintSeed 设置 seed，seed<=0 视为未设，回退每次随机。
func WithFingerprintSeed(seed int) Option {
	return func(c *browserConfig) {
		c.fingerprintSeed = seed
	}
}

// maskProxyCredentials masks username and password in proxy URL for safe logging.
func maskProxyCredentials(proxyURL string) string {
	u, err := url.Parse(proxyURL)
	if err != nil || u.User == nil {
		return proxyURL
	}
	cred := "***"
	if _, hasPassword := u.User.Password(); hasPassword {
		cred = "***:***"
	}
	// 直接在原串替换 userinfo，避免 url.String() 把 * 编码成 %2A（日志变乱码）。
	return strings.Replace(proxyURL, u.User.String()+"@", cred+"@", 1)
}

func NewBrowser(headless bool, options ...Option) *headless_browser.Browser {
	cfg := &browserConfig{}
	for _, opt := range options {
		opt(cfg)
	}

	// 只用内置浏览器，没有别的来源。二进制必须显式传给 go-rod，
	// 否则 rod 会自行下载一个默认 Chromium：它不是内置浏览器，也不认识下面
	// 这些 flag（未知 flag 被静默忽略，日志照样打印 "fingerprint enabled"），
	// 属于无声降级。宁可不启动，也不启动一个不对的浏览器。
	binPath, err := EnsureBrowser()
	if err != nil {
		panic(fmt.Sprintf("内置浏览器不可用，拒绝启动: %v", err))
	}

	opts := []headless_browser.Option{
		headless_browser.WithHeadless(headless),
		// 用内置浏览器的默认配置，不强制 UA。
		headless_browser.WithFingerprint(""), // 空 = 按运行 OS 自动：Linux→windows，mac→macos
		headless_browser.WithStealthJS(false),
		headless_browser.WithLanguage("zh-CN"), // 面向小红书
		// 品牌报 Chrome。
		// 注：hardware-concurrency 不设，交给 seed 派生。
		headless_browser.WithExtraFlags(map[string]string{"fingerprint-brand": "Chrome"}),
	}
	opts = append(opts, headless_browser.WithChromeBinPath(binPath))

	// 代理（由调用方经 Option 传入，env 读取放在入口层）。
	if cfg.proxy != "" {
		opts = append(opts, headless_browser.WithProxy(cfg.proxy))
		logrus.Infof("Using proxy: %s", maskProxyCredentials(cfg.proxy))
	}

	// 固定指纹 seed（由调用方经 Option 传入，env 读取放在入口层）。
	if cfg.fingerprintSeed > 0 {
		opts = append(opts, headless_browser.WithFingerprintSeed(cfg.fingerprintSeed))
		logrus.Infof("fingerprint seed pinned: %d", cfg.fingerprintSeed)
	}

	// 加载 cookies
	cookiePath := cookies.GetCookiesFilePath()
	cookieLoader := cookies.NewLoadCookie(cookiePath)

	if data, err := cookieLoader.LoadCookies(); err == nil {
		opts = append(opts, headless_browser.WithCookies(string(data)))
		logrus.Debugf("loaded cookies from filesuccessfully")
	} else {
		logrus.Warnf("failed to load cookies: %v", err)
	}

	return headless_browser.New(opts...)
}

```

### Core Architecture Module: `browser/browser_download.go`
```
package browser

import (
	"archive/tar"
	"archive/zip"
	"bufio"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/ulikunitz/xz"
)

// 内置浏览器的下载分发地址。
const browserCDNBase = "https://cdn.one-world.ai/browsers"

// browserVersion 是内置浏览器的唯一版本源。升级只改 browser_version.txt 一处，Go 与 Dockerfile 同读。
//
//go:embed browser_version.txt
var browserVersionRaw string

var browserVersion = strings.TrimSpace(browserVersionRaw)

func browserURL(name string) string {
	return browserCDNBase + "/" + browserVersion + "/" + name
}

// platformAsset 返回当前 OS/arch 对应的下载文件名与解压后二进制文件名。
// 第三个返回值为 false 表示当前平台无预编译二进制。
func platformAsset() (assetName, binName string, ok bool) {
	switch runtime.GOOS {
	case "darwin":
		if runtime.GOARCH != "arm64" {
			return "", "", false
		}
		return "macos-arm64.dmg", "Chromium", true
	case "linux":
		if runtime.GOARCH != "amd64" {
			return "", "", false
		}
		return "linux-x64.tar.xz", "chrome", true
	case "windows":
		if runtime.GOARCH != "amd64" {
			return "", "", false
		}
		return "windows-x64.zip", "chrome.exe", true
	}
	return "", "", false
}

func browserCacheDir() (string, error) {
	base, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "xiaohongshu-mcp", "browser", browserVersion), nil
}

// EnsureBrowser 确保本地存在内置浏览器二进制，返回其路径。
// 已缓存则直接返回；否则下载 → 校验 SHA256 → 解压。当前平台无预编译二进制时返回 error。
func EnsureBrowser() (string, error) {
	asset, binName, ok := platformAsset()
	if !ok {
		return "", fmt.Errorf("当前平台 %s/%s 无预编译浏览器，暂不支持", runtime.GOOS, runtime.GOARCH)
	}

	cacheDir, err := browserCacheDir()
	if err != nil {
		return "", err
	}

	// 已缓存：遍历查找二进制
	if bin := findBinary(cacheDir, binName); bin != "" {
		return bin, nil
	}

	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return "", err
	}

	// 下载（重试 3 次）
	logrus.Infof("首次运行：下载内置浏览器 %s（%s，约 140-190MB，仅一次）...", browserVersion, asset)
	archivePath := filepath.Join(cacheDir, asset)
	var dlErr error
	for attempt := 1; attempt <= 3; attempt++ {
		if dlErr = downloadFile(browserURL(asset), archivePath); dlErr == nil {
			break
		}
		logrus.Warnf("下载失败（第 %d/3 次）: %v", attempt, dlErr)
		_ = os.Remove(archivePath)
		time.Sleep(2 * time.Second)
	}
	if dlErr != nil {
		return "", fmt.Errorf("下载内置浏览器失败: %w\n"+
			"  本项目只用内置浏览器，缺它不继续。请检查网络后重试；\n"+
			"  离线环境可手动下载 %s，解压到 %s 后重启。", dlErr, browserURL(asset), cacheDir)
	}
	defer os.Remove(archivePath)

	// 校验 SHA256（本地已成分发点，必须校验完整性）
	if err := verifySHA256(archivePath, asset); err != nil {
		return "", fmt.Errorf("校验失败: %w", err)
	}

	logrus.Infof("解压内置浏览器 ...")
	if err := extractArchive(archivePath, cacheDir); err != nil {
		return "", fmt.Errorf("解压失败: %w", err)
	}

	bin := findBinary(cacheDir, binName)
	if bin == "" {
		return "", fmt.Errorf("解压后未找到二进制 %s", binName)
	}
	logrus.Infof("内置浏览器就绪: %s", bin)
	return bin, nil
}

// verifySHA256 下载同目录的 SHA256SUMS，校验 asset 的哈希。
func verifySHA256(archivePath, asset string) error {
	want, err := fetchExpectedSHA(asset)
	if err != nil {
		return err
	}
	f, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	got := hex.EncodeToString(h.Sum(nil))
	if !strings.EqualFold(got, want) {
		return fmt.Errorf("%s SHA256 不匹配：期望 %s，实际 %s", asset, want, got)
	}
	return nil
}

func fetchExpectedSHA(asset string) (string, error) {
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Get(browserURL("SHA256SUMS"))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("获取 SHA256SUMS: HTTP %d", resp.StatusCode)
	}
	sc := bufio.NewScanner(resp.Body)
	for sc.Scan() {
		// 格式：<hash>␠␠<filename>
		fields := strings.Fields(sc.Text())
		if len(fields) == 2 && fields[1] == asset {
			return fields[0], nil
		}
	}
	return "", fmt.Errorf("SHA256SUMS 中未找到 %s", asset)
}

func findBinary(dir, binName string) string {
	var found string
	_ = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if filepath.Base(path) == binName {
			found = path
			return io.EOF // 提前结束
		}
		return nil
	})
	if found != "" {
		if err := os.Chmod(found, 0o755); err != nil {
			logrus.Debugf("chmod %s: %v", found, err)
		}
	}
	return found
}

func downloadFile(url, dst string) error {
	resp, err := (&http.Client{Timeout: 10 * time.Minute}).Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, url)
	}
	f, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}

func extractArchive(archivePath, destDir string) error {
	switch {
	case strings.HasSuffix(archivePath, ".tar.xz"):
		return extractTarXz(archivePath, destDir)
	case strings.HasSuffix(archivePath, ".zip"):
		return extractZip(archivePath, destDir)
	case strings.HasSuffix(archivePath, ".dmg"):
		return extractDmg(archivePath, destDir)
	}
	return fmt.Errorf("不支持的压缩格式: %s", archivePath)
}

func extractTarXz(archivePath, destDir string) error {
	f, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()
	xzr, err := xz.NewReader(f)
	if err != nil {
		return err
	}
	tr := tar.NewReader(xzr)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		target := filepath.Join(destDir, hdr.Name)
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				out.Close()
				return err
			}
			out.Close()
		case tar.TypeSymlink:
			_ = os.MkdirAll(filepath.Dir(target), 0o755)
			_ = os.Symlink(hdr.Linkname, target)
		}
	}
	return nil
}

func extractZip(archivePath, destDir string) error {
	zr, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer zr.Close()
	for _, zf := range zr.File {
		target := filepath.Join(destDir, zf.Name)
		if zf.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := zf.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, zf.Mode())
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func extractDmg(archivePath, destDir string) error {
	mountPoint, err := os.MkdirTemp("", "bx-dmg-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(mountPoint)

	if out, err := exec.Command("hdiutil", "attach", archivePath, "-nobrowse", "-mountpoint", mountPoint).CombinedOutput(); err != nil {
		return fmt.Errorf("hdiutil attach: %v: %s", err, out)
	}
	defer exec.Command("hdiutil", "detach", mountPoint, "-quiet").Run()

	var appPath string
	entries, _ := os.ReadDir(mountPoint)
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".app") {
			appPath = filepath.Join(mountPoint, e.Name())
			break
		}
	}
	if appPath == "" {
		return fmt.Errorf("dmg 内未找到 .app")
	}
	dstApp := filepath.Join(destDir, filepath.Base(appPath))
	if out, err := exec.Command("cp", "-R", appPath, dstApp).CombinedOutput(); err != nil {
		return fmt.Errorf("拷贝 .app: %v: %s", err, out)
	}
	_ = exec.Command("xattr", "-dr", "com.apple.quarantine", dstApp).Run()
	return nil
}

```

### Core Architecture Module: `cmd/login/main.go`
```
package main

import (
	"context"
	"encoding/json"
	"flag"

	"github.com/go-rod/rod"
	"github.com/sirupsen/logrus"
	"github.com/xpzouying/xiaohongshu-mcp/browser"
	"github.com/xpzouying/xiaohongshu-mcp/configs"
	"github.com/xpzouying/xiaohongshu-mcp/cookies"
	"github.com/xpzouying/xiaohongshu-mcp/xiaohongshu"
)

func main() {
	flag.Parse()

	// 登录的时候，需要界面，所以不能无头模式。
	// 登录与后续运行共用同一个 seed：首次登录生成并写入会话文件，之后一直复用。
	store := cookies.NewLoadCookie(cookies.GetCookiesFilePath())

	b := browser.NewBrowser(false,
		browser.WithFingerprintSeed(configs.ResolveFingerprintSeed(store)),
		browser.WithProxy(configs.ProxyFromEnv()),
	)
	defer b.Close()

	page := b.NewPage()
	defer page.Close()

	action := xiaohongshu.NewLogin(page)

	status, err := action.CheckLoginStatus(context.Background())
	if err != nil {
		logrus.Fatalf("failed to check login status: %v", err)
	}

	logrus.Infof("当前登录状态: %v", status)

	if status {
		return
	}

	// 开始登录流程
	logrus.Info("开始登录流程...")
	if err = action.Login(context.Background()); err != nil {
		logrus.Fatalf("登录失败: %v", err)
	} else {
		if err := saveCookies(page); err != nil {
			logrus.Fatalf("failed to save cookies: %v", err)
		}
	}

	// 再次检查登录状态确认成功
	status, err = action.CheckLoginStatus(context.Background())
	if err != nil {
		logrus.Fatalf("failed to check login status after login: %v", err)
	}

	if status {
		logrus.Info("登录成功！")
	} else {
		logrus.Error("登录流程完成但仍未登录")
	}

}

func saveCookies(page *rod.Page) error {
	cks, err := page.Browser().GetCookies()
	if err != nil {
		return err
	}

	data, err := json.Marshal(cks)
	if err != nil {
		return err
	}

	cookieLoader := cookies.NewLoadCookie(cookies.GetCookiesFilePath())
	return cookieLoader.SaveCookies(data)
}

```

### Core Architecture Module: `configs/browser.go`
```
package configs

import (
	"os"
	"strconv"

	"github.com/sirupsen/logrus"
)

var (
	useHeadless = true

	fingerprintSeed = 0

	proxy = ""
)

func InitHeadless(h bool) {
	useHeadless = h
}

// IsHeadless 是否无头模式。
func IsHeadless() bool {
	return useHeadless
}

func SetFingerprintSeed(s int) {
	fingerprintSeed = s
}

func FingerprintSeed() int {
	return fingerprintSeed
}

// FingerprintSeedFromEnv 从 XHS_FP_SEED 环境变量解析固定 seed。
// 未设或非法返回 0（回退随机）。env 读取集中在配置层，浏览器工厂只收 Option。
func FingerprintSeedFromEnv() int {
	s := os.Getenv("XHS_FP_SEED")
	if s == "" {
		return 0
	}
	seed, err := strconv.Atoi(s)
	if err != nil || seed <= 0 {
		logrus.Warnf("invalid XHS_FP_SEED=%q, ignored (fallback to random seed)", s)
		return 0
	}
	return seed
}

func SetProxy(p string) {
	proxy = p
}

func Proxy() string {
	return proxy
}

// ProxyFromEnv 从 XHS_PROXY 环境变量读取代理地址。env 读取集中在配置层。
func ProxyFromEnv() string {
	return os.Getenv("XHS_PROXY")
}

```

### Core Architecture Module: `configs/image.go`
```
package configs

import (
	"os"
	"path/filepath"
)

const (
	ImagesDir = "xiaohongshu_images"
)

func GetImagesPath() string {
	return filepath.Join(os.TempDir(), ImagesDir)
}

```

### Core Architecture Module: `configs/seed.go`
```
package configs

import (
	"crypto/rand"
	"math/big"

	"github.com/sirupsen/logrus"
	"github.com/xpzouying/xiaohongshu-mcp/cookies"
)

// maxSeed seed 的取值上限，够大以避免碰撞，又不至于溢出。
const maxSeed = 1 << 31

// ResolveFingerprintSeed 决定本次使用的 seed，优先级：
// 环境变量 XHS_FP_SEED > 会话文件里已存的 > 新生成一个并写回。
//
// 环境变量必须排第一：已经用它钉死画像的部署，不能被文件里的值顶掉。
// 生成后一定要写回，否则每次启动都是新的一套，等于没固定。
func ResolveFingerprintSeed(store cookies.Cookier) int {
	if seed := FingerprintSeedFromEnv(); seed > 0 {
		return seed
	}

	if seed := store.LoadSeed(); seed > 0 {
		return seed
	}

	seed := newSeed()
	if err := store.SaveSeed(seed); err != nil {
		// 存不下也照常启动：退化成本次随机，和改动前的行为一致
		logrus.Warnf("保存会话 seed 失败，本次使用临时值: %v", err)
	}
	return seed
}

// newSeed 生成一个新的 seed。用 crypto/rand 而非 math/rand，
// 避免进程启动时机相近的多个实例撞上同一个值。
func newSeed() int {
	n, err := rand.Int(rand.Reader, big.NewInt(maxSeed))
	if err != nil {
		return 1 // 极罕见：熵源不可用时给个确定值，好过 panic
	}
	return int(n.Int64()) + 1 // +1 保证为正，0 表示"未设置"
}

```

### Core Architecture Module: `cookies/cookies.go`
```
package cookies

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/errors"
)

// sessionFile 是 v2 的文件结构。v1 是一个裸 cookie 数组，没有外层对象。
// cookies 用 RawMessage 原样透传，不解析不重组，避免往返时字段走样。
type sessionFile struct {
	Version int             `json:"version"`
	Seed    int             `json:"seed,omitempty"`
	SavedAt string          `json:"saved_at,omitempty"`
	Cookies json.RawMessage `json:"cookies"`
}

// localCookiesPath 当前目录下的默认文件名。
const localCookiesPath = "cookies.json"

type Cookier interface {
	LoadCookies() ([]byte, error)
	SaveCookies(data []byte) error
	DeleteCookies() error
	// LoadSeed 读取会话绑定的 seed；老格式、文件损坏或未设时返回 0。
	LoadSeed() int
	// SaveSeed 写入 seed，保留文件中已有的 cookies。
	SaveSeed(seed int) error
}

type localCookie struct {
	path string
}

func NewLoadCookie(path string) Cookier {
	if path == "" {
		panic("path is required")
	}

	return &localCookie{
		path: path,
	}
}

// LoadCookies 从文件中加载 cookies 数组的原始字节。
// v2 从外层对象里取出 cookies 字段；v1 文件本身就是数组，原样返回。
func (c *localCookie) LoadCookies() ([]byte, error) {

	data, err := os.ReadFile(c.path)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read cookies from tmp file")
	}

	var f sessionFile
	if err := json.Unmarshal(data, &f); err == nil && len(f.Cookies) > 0 {
		return f.Cookies, nil
	}

	return data, nil
}

// LoadSeed 读取会话绑定的 seed。老格式（裸数组）没有这个值，返回 0。
func (c *localCookie) LoadSeed() int {
	data, err := os.ReadFile(c.path)
	if err != nil {
		return 0
	}

	var f sessionFile
	if err := json.Unmarshal(data, &f); err != nil {
		return 0
	}
	return f.Seed
}

// SaveCookies 保存 cookies 到文件中，保留文件里已有的 seed。
func (c *localCookie) SaveCookies(data []byte) error {
	return c.write(data, c.LoadSeed())
}

// SaveSeed 写入 seed，保留文件里已有的 cookies。
func (c *localCookie) SaveSeed(seed int) error {
	cks, err := c.LoadCookies()
	if err != nil {
		cks = nil // 文件还不存在：先把 seed 落下来，cookies 之后再补
	}
	return c.write(cks, seed)
}

// write 以 v2 格式落盘。cookies 用 RawMessage 原样嵌入，不经过结构体往返。
func (c *localCookie) write(cks []byte, seed int) error {
	if len(cks) == 0 {
		cks = []byte("[]")
	}

	data, err := json.MarshalIndent(sessionFile{
		Version: 2,
		Seed:    seed,
		SavedAt: time.Now().Format(time.RFC3339),
		Cookies: json.RawMessage(cks),
	}, "", "  ")
	if err != nil {
		return errors.Wrap(err, "marshal session file failed")
	}

	if dir := filepath.Dir(c.path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return errors.Wrap(err, "create cookies dir failed")
		}
	}

	return os.WriteFile(c.path, data, 0644)
}

// DeleteCookies 删除 cookies 文件。
func (c *localCookie) DeleteCookies() error {
	if _, err := os.Stat(c.path); os.IsNotExist(err) {
		// 文件不存在，返回 nil（认为已经删除）
		return nil
	}
	return os.Remove(c.path)
}

// GetCookiesFilePath 获取 cookies 文件路径。
// 为了向后兼容，如果旧路径 /tmp/cookies.json 存在，则继续使用；
// 否则使用当前目录下的 cookies.json
func GetCookiesFilePath() string {
	// 显式指定优先，无条件——环境里的残留文件不能盖掉用户明说的配置
	if path := os.Getenv("COOKIES_PATH"); path != "" {
		return path
	}

	// 本地目录
	if _, err := os.Stat(localCookiesPath); err == nil {
		return localCookiesPath
	}

	// 旧路径 /tmp/cookies.json，仅为老用户兜底
	oldPath := filepath.Join(os.TempDir(), "cookies.json")
	if _, err := os.Stat(oldPath); err == nil {
		return oldPath
	}

	return localCookiesPath
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29** (2025-09-06): **陷入query loop**
  *Symptoms*: [rod] 2025/09/06 09:15:31 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:32 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:33 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:34 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:35 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:36 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:37 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:38 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:39 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:40 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:41 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:42 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:43 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:44 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:45 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:46 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:47 [query] rod.element("div.d-input input")  <page:344D35B7> [rod] 2025/09/06 09:15:48 [query] rod.element("div.d-input input")  <pag
  **Post-Mortem & Fix Analysis**:
  > 用的mcp claude-sonnet 最后一步就报错  收到MCP请求: tools/call                           INFO[3286] MCP: 发布内容                                     INFO[3286] MCP: 发布内容 - 标题: 🔥 RedStone：下一代Web3预言机革命来了！, 图片数量: 1  [rod] 2025/09/06 09:19:36 [query] rod.element("div.upload-content")  <page:C949DAB6> [rod] 2025/09/06 09:19:36 [query] rod.element("div.upload-content")  <page:C949DAB6> [rod] 2025/09/06 09:19:36 [query] rod.element("div.upload-content")  <page:C949DAB6> [rod] 2025/09/06 09:19:37 [query] rod.element("div.upload-content")  <page:C949DAB6> [rod] 2025/09/06 09:19:39 [query] rod.element("div.upload-content")  <page:C949DAB6> [rod] 2025/09/06 09:19:40 [wait] visible <div.upload-content> 2025/09/06 09:19:40 INFO wait for upload-content visible success 2025/09/06 09:19:41 INFO foundcreator-tab elements count=4 [rod] 2025/09/06 09:19:41 [wait] interactable <div.creator-tab> [rod] 2025/09/06 09:19:41 [input] scroll into view <div.creator-tab> [rod] 2025/09/06 09:19:41 [wait] visible <div.creator-tab> 
  > 我测试后回复。
  > 刚才测试了一下，感觉没有问题，可以重试一下？  https://github.com/user-attachments/assets/96202dc7-b513-47d6-a42a-c38f437f88b0

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `a5c8f779` (2026-09-22)
**Commit Message**: fix(search): 筛选点击限制指针路径，并在按下前复核落点 (#858)

从筛选按钮直接拉到面板内的选项时，路径会有一段既不在按钮上、也还没进面板。
改成先把指针移进面板，之后的移动都收在面板范围内，每轮重取面板矩形。

humanize 相应补两件：移动可以限制在给定矩形内；移动结束到按下之间重新取一次
形状，落点已不在元素上或元素已不可见就放弃点击，不再按移动前算好的坐标盲按。
后者对所有点击生效。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

**File**: `humanize/humanize_test.go` (modified, +38/-0)
```diff
@@ -125,3 +125,41 @@ func TestPointerSettle_HasSufficientFloor(t *testing.T) {
 	assert.GreaterOrEqual(t, dist.sample(-5), 200*time.Millisecond,
 		"极端偏小的采样也应被 clamp 到 200ms 以上")
 }
+
+func TestRectClamp(t *testing.T) {
+	r := Rect{Left: 10, Top: 20, Right: 110, Bottom: 220}
+
+	cases := []struct {
+		name string
+		in   proto.Point
+		want proto.Point
+	}{
+		{"内部不动", proto.Point{X: 50, Y: 100}, proto.Point{X: 50, Y: 100}},
+		{"左上越界", proto.Point{X: -5, Y: 0}, proto.Point{X: 10, Y: 20}},
+		{"右下越界", proto.Point{X: 999, Y: 999}, proto.Point{X: 110, Y: 220}},
+		{"只越一边", proto.Point{X: 50, Y: -3}, proto.Point{X: 50, Y: 20}},
+		{"边上不动", proto.Point{X: 10, Y: 220}, proto.Point{X: 10, Y: 220}},
+	}
+
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			assert.Equal(t, c.want, r.clamp(c.in))
+		})
+	}
+}
+
+func TestRectInset(t *testing.T) {
+	t.Run("正常收缩", func(t *testing.T) {
+		got := Rect{Left: 0, Top: 0, Right: 100, Bottom: 100}.Inset(10)
+		assert.Equal(t, Rect{Left: 10, Top: 10, Right: 90, Bottom: 90}, got)
+	})
+
+	t.Run("太窄则该方向不收", func(t *testing.T) {
+		in := Rect{Left: 0, Top: 0, Right: 15, Bottom: 100}
+		got := in.Inset(10)
+		assert.Equal(t, 0.0, got.Left)
+		assert.Equal(t, 15.0, got.Right)
+		assert.Equal(t, 10.0, got.Top)
+		assert.Equal(t, 90.0, got.Bottom)
+	})
+}
```

**File**: `humanize/input.go` (modified, +57/-1)
```diff
@@ -125,12 +125,65 @@ func Click(elem *rod.Element) error {
 	if err := elem.WaitEnabled(); err != nil {
 		return err
 	}
+	if err := stillOn(elem, target); err != nil {
+		return err
+	}
 
 	return pressAndRelease(mouse)
 }
 
+// quadRect 取 quad 的外接矩形。
+func quadRect(q proto.DOMQuad) Rect {
+	return Rect{Left: q[0], Top: q[1], Right: q[4], Bottom: q[5]}
+}
+
+// stillOn 按下之前复核落点仍在元素上且元素仍可见。
+// 移动要花几十毫秒，这期间页面可能已经变了，按下之前不能只信移动之前取的那份坐标。
+func stillOn(elem *rod.Element, pt proto.Point) error {
+	shape, err := elem.Shape()
+	if err != nil {
+		return err
+	}
+	if len(shape.Quads) == 0 {
+		return errors.New("元素无可点击区域")
+	}
+
+	const tolerance = 1.0
+	r := quadRect(shape.Quads[0])
+	if pt.X < r.Left-tolerance || pt.X > r.Right+tolerance ||
+		pt.Y < r.Top-tolerance || pt.Y > r.Bottom+tolerance {
+		return errors.New("落点已不在元素上")
+	}
+
+	if !Visible(elem) {
+		return errors.New("元素当前不可命中")
+	}
+	return nil
+}
+
+// MoveInto 把指针移进 bounds：取矩形内离当前位置最近的一点。
+func MoveInto(page *rod.Page, bounds Rect) error {
+	const margin = 12
+	inner := bounds.Inset(margin)
+	target := inner.clamp(page.Mouse.Position())
+	target = proto.Point{
+		X: target.X + jitterOffset(margin),
+		Y: target.Y + jitterOffset(margin),
+	}
+	return moveMouseCurved(page.Mouse, inner.clamp(target))
+}
+
 // ClickNoWait 跳过 WaitInteractable 的遮挡重试，用于它会误判而死等的场景。
 func ClickNoWait(elem *rod.Element) error {
+	return clickNoWait(elem, nil)
+}
+
+// ClickNoWaitInside 与 ClickNoWait 相同，但移动途中把指针限制在 bounds 内。
+func ClickNoWaitInside(elem *rod.Element, bounds Rect) error {
+	return clickNoWait(elem, &bounds)
+}
+
+func clickNoWait(elem *rod.Element, bounds *Rect) error {
 	shape, err := elem.Shape()
 	if err != nil {
 		return err
@@ -148,7 +201,10 @@ func ClickNoWait(elem *rod.Element) error {
 	}
 
 	mouse := elem.Page().Mouse
-	if err := moveMouseCurved(mouse, target); err != nil {
+	if err := moveMouseCurvedWithin(mouse, target, bounds); err != nil {
+		return err
+	}
+	if err := stillOn(elem, target); err != nil {
 		return err
 	}
 	return pressAndRelease(mouse)
```

**File**: `humanize/input_integration_test.go` (modified, +82/-0)
```diff
@@ -10,6 +10,7 @@ import (
 
 	"github.com/go-rod/rod"
 	"github.com/go-rod/rod/lib/launcher"
+	"github.com/go-rod/rod/lib/proto"
 	"github.com/xpzouying/xiaohongshu-mcp/browser"
 )
 
@@ -243,3 +244,84 @@ func TestClickGuards(t *testing.T) {
 		})
 	}
 }
+
+// 移动途中目标被挪走：应当放弃点击，而不是打在移动前算好的坐标上。
+const movingTargetHTML = `<body style="margin:0;width:800px;height:600px">
+<div id="target" style="position:absolute;left:600px;top:400px;width:96px;height:40px">x</div>
+<div id="behind" style="position:absolute;left:600px;top:400px;width:96px;height:40px"></div>
+<script>
+window.HIT = [];
+document.addEventListener('click', e => window.HIT.push(e.target.id), true);
+let n = 0;
+document.addEventListener('mousemove', () => {
+  if (++n === 3) { document.getElementById('target').style.left = '40px'; }
+}, true);
+</script></body>`
+
+func TestClickAbortsWhenTargetMoves(t *testing.T) {
+	bin, err := browser.EnsureBrowser()
+	if err != nil {
+		t.Skipf("SKIP: 浏览器不可用: %v", err)
+	}
+
+	u := launcher.New().Bin(bin).Headless(true).MustLaunch()
+	b := rod.New().ControlURL(u).MustConnect()
+	defer b.MustClose()
+
+	page := b.MustPage("about:blank")
+	page.MustWaitLoad()
+	page.MustSetDocumentContent(movingTargetHTML)
+
+	err = ClickNoWait(page.MustElement("#target"))
+	if err == nil {
+		t.Fatal("目标已挪走，点击不应当发出")
+	}
+
+	hit := page.MustEval(`() => JSON.stringify(window.HIT)`).Str()
+	if hit != "[]" {
+		t.Errorf("不该有任何点击落地，实际: %s", hit)
+	}
+}
+
+// 限制范围后，移动途中的落点不应超出该矩形。
+func TestMoveStaysInsideBounds(t *testing.T) {
+	bin, err := browser.EnsureBrowser()
+	if err != nil {
+		t.Skipf("SKIP: 浏览器不可用: %v", err)
+	}
+
+	u := launcher.New().Bin(bin).Headless(true).MustLaunch()
+	b := rod.New().ControlURL(u).MustConnect()
+	defer b.MustClose()
+
+	page := b.MustPage("about:blank")
+	page.MustWaitLoad()
+	page.MustSetDocumentContent(`<body style="margin:0;width:800px;height:600px">
+	<script>
+	window.PTS = [];
+	document.addEventListener('mousemove', e => window.PTS.push([e.clientX, e.clientY]), true);
+	</script></body>`)
+
+	bounds := Rect{Left: 100, Top: 100, Right: 700, Bottom: 300}
+	if err := page.Mouse.MoveTo(proto.Point{X: 650, Y: 280}); err != nil {
+		t.Fatal(err)
+	}
+	page.MustEval(`() => { window.PTS = [] }`)
+
+	if err := moveMouseCurvedWithin(page.Mouse, proto.Point{X: 150, Y: 120}, &bounds); err != nil {
+		t.Fatal(err)
+	}
+
+	var pts [][]float64
+	if err := json.Unmarshal([]byte(page.MustEval(`() => JSON.stringify(window.PTS)`).Str()), &pts); err != nil {
+		t.Fatal(err)
+	}
+	if len(pts) < 5 {
+		t.Fatalf("采样点太少: %d", len(pts))
+	}
+	for _, p := range pts {
+		if p[0] < bounds.Left || p[0] > bounds.Right || p[1] < bounds.Top || p[1] > bounds.Bottom {
+			t.Errorf("落点 (%.0f,%.0f) 超出限制范围", p[0], p[1])
+		}
+	}
+}
```

**File**: `humanize/mouse.go` (modified, +32/-0)
```diff
@@ -9,7 +9,36 @@ import (
 	"github.com/go-rod/rod/lib/proto"
 )
 
+// Rect 一个矩形区域，用来限制指针的移动范围。
+type Rect struct {
+	Left, Top, Right, Bottom float64
+}
+
+// clamp 把点收进矩形内。
+func (r Rect) clamp(p proto.Point) proto.Point {
+	return proto.Point{
+		X: math.Min(math.Max(p.X, r.Left), r.Right),
+		Y: math.Min(math.Max(p.Y, r.Top), r.Bottom),
+	}
+}
+
+// Inset 把四边各向内收 d；边长不够收就保持原样。
+func (r Rect) Inset(d float64) Rect {
+	if r.Right-r.Left > 2*d {
+		r.Left, r.Right = r.Left+d, r.Right-d
+	}
+	if r.Bottom-r.Top > 2*d {
+		r.Top, r.Bottom = r.Top+d, r.Bottom-d
+	}
+	return r
+}
+
 func moveMouseCurved(mouse *rod.Mouse, target proto.Point) error {
+	return moveMouseCurvedWithin(mouse, target, nil)
+}
+
+// moveMouseCurvedWithin 与 moveMouseCurved 相同；bounds 非空时，途经的点收进该矩形。
+func moveMouseCurvedWithin(mouse *rod.Mouse, target proto.Point, bounds *Rect) error {
 	start := mouse.Position()
 	dx, dy := target.X-start.X, target.Y-start.Y
 	dist := math.Hypot(dx, dy)
@@ -36,6 +65,9 @@ func moveMouseCurved(mouse *rod.Mouse, target proto.Point) error {
 			return target, true
 		}
 		p := cubicBezier(start, c1, c2, target, easeInOut(float64(i)/float64(steps)))
+		if bounds != nil {
+			p = bounds.clamp(p)
+		}
 		time.Sleep(perStep)
 		return p, false
 	})
```

**File**: `xiaohongshu/search.go` (modified, +33/-3)
```diff
@@ -134,15 +134,28 @@ func (s *SearchAction) Search(ctx context.Context, keyword string, filters ...Fi
 		// 记下筛选前的结果，用来判断筛选后的数据什么时候到位
 		before := readFeedIDs(page)
 
-		// 用 ClickNoWait：筛选面板是 hover 浮层，rod 的 WaitInteractable 会误判被遮挡而死等；
-		// ClickNoWait 移进面板内选项（维持 hover、面板不关）再点。
+		// 指针先进面板，之后的移动都限制在面板内。
+		// 从按钮直接拉到选项的话，路径会有一段既不在按钮上、也还没进面板。
+		bounds, err := panelBounds(page)
+		if err != nil {
+			return nil, err
+		}
+		if err := humanize.MoveInto(page, bounds); err != nil {
+			return nil, fmt.Errorf("移入筛选面板失败: %w", err)
+		}
+
+		// 用 ClickNoWait：筛选面板是 hover 浮层，rod 的 WaitInteractable 会误判被遮挡而死等。
 		for _, pf := range pending {
 			option, err := findFilterOption(page, pf)
 			if err != nil {
 				return nil, err
 			}
+			// 每轮重取：点完一项后面板可能重排。
+			if b, err := panelBounds(page); err == nil {
+				bounds = b
+			}
 			humanize.Delay(ctx, humanize.BeforeClick)
-			if err := humanize.ClickNoWait(option); err != nil {
+			if err := humanize.ClickNoWaitInside(option, bounds); err != nil {
 				return nil, fmt.Errorf("点击筛选选项「%s」失败: %w", pf.option, err)
 			}
 		}
@@ -209,6 +222,23 @@ func waitFeedsChanged(page *rod.Page, before string, timeout time.Duration) {
 	logrus.Warnf("筛选后等待结果刷新超时（%s），返回的可能是筛选前的数据", timeout)
 }
 
+// panelBounds 取筛选面板当前占据的矩形。
+func panelBounds(page *rod.Page) (humanize.Rect, error) {
+	panel, err := page.Element("div.filter-panel")
+	if err != nil {
+		return humanize.Rect{}, fmt.Errorf("读取筛选面板失败: %w", err)
+	}
+	shape, err := panel.Shape()
+	if err != nil {
+		return humanize.Rect{}, fmt.Errorf("读取筛选面板失败: %w", err)
+	}
+	if len(shape.Quads) == 0 {
+		return humanize.Rect{}, fmt.Errorf("筛选面板没有可用区域")
+	}
+	q := shape.Quads[0]
+	return humanize.Rect{Left: q[0], Top: q[1], Right: q[4], Bottom: q[5]}, nil
+}
+
 // findFilterOption 在筛选面板里定位一个选项：按标签找到组，再在组内按文本找选项。
 //
 // 全程不用序号。同一个选项在面板里可能渲染成多个 div.tags（数量随视口而变，
```

---

### Incident Patch 2: `594f1a3b` (2026-09-22)
**Commit Message**: fix(search): 跳过默认筛选并按可见性挑选选项节点 (#816)

为每个筛选组记录页面默认值，显式传入默认值时不再重复点击；同一组出现多次时以最后一个非空值为准。

筛选选项的挑选判据从「有无可点击区域」换成可见性：算元素自身连同各级祖先的不透明度乘积，低于下限的不作为点击目标。同一判据下放到 humanize 的点击守卫，对所有点击生效——opacity: 0 的元素原先放行，现在拦下。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

**File**: `humanize/input.go` (modified, +33/-5)
```diff
@@ -60,17 +60,45 @@ func ensurePointInViewport(page *rod.Page, pt proto.Point) error {
 	return nil
 }
 
+// minOpacity 不透明度低于此值的元素不作为点击目标。
+const minOpacity = 0.1
+
+// effectiveOpacityJS 算元素自身连同各级祖先的不透明度乘积；
+// 链上任意一级 display:none 或 visibility:hidden 都直接算 0。
+//
+// 只看元素自身的 opacity 不够：祖先透明时子元素仍报 1。
+const effectiveOpacityJS = `() => {
+	let v = 1;
+	for (let n = this; n && n.nodeType === 1; n = n.parentElement) {
+		const s = getComputedStyle(n);
+		if (s.display === 'none' || s.visibility === 'hidden') {
+			return 0;
+		}
+		const o = parseFloat(s.opacity);
+		if (!isNaN(o)) {
+			v *= o;
+		}
+	}
+	return v;
+}`
+
+// Visible 判断元素是否可见到足以作为点击目标。取不到样式时按可见处理，
+// 宁可放过也不要挡掉正常元素。
+func Visible(elem *rod.Element) bool {
+	res, err := elem.Eval(effectiveOpacityJS)
+	if err != nil {
+		return true
+	}
+	return res.Value.Num() >= minOpacity
+}
+
 // 不用 document.elementFromPoint：结果不稳定
 func ensureClickable(elem *rod.Element, pt proto.Point) error {
 	if err := ensurePointInViewport(elem.Page(), pt); err != nil {
 		return err
 	}
 
-	res, err := elem.Eval(`() => getComputedStyle(this).visibility`)
-	if err != nil {
-		return nil
-	}
-	if res.Value.Str() == "hidden" {
+	if !Visible(elem) {
 		return errors.New("元素当前不可命中")
 	}
 	return nil
```

**File**: `humanize/input_integration_test.go` (modified, +7/-1)
```diff
@@ -182,6 +182,9 @@ const guardHTML = `<body style="margin:0;width:800px;height:600px">
 <div data-n="display"     style="display:none">x</div>
 <div data-n="visibility"  style="position:absolute;left:100px;top:200px;width:96px;height:40px;visibility:hidden">x</div>
 <div data-n="opacity0"    style="position:absolute;left:100px;top:260px;width:96px;height:40px;opacity:0">x</div>
+<div data-n="opacitylow"  style="position:absolute;left:100px;top:320px;width:96px;height:40px;opacity:0.001">x</div>
+<div data-n="opacitydim"  style="position:absolute;left:100px;top:380px;width:96px;height:40px;opacity:0.6">x</div>
+<div data-n="ancestordim" style="position:absolute;left:100px;top:440px;opacity:0.001"><div data-n="inancestor" style="width:96px;height:40px;opacity:1">x</div></div>
 <div data-n="offleft"     style="position:absolute;left:-9999px;top:100px;width:96px;height:40px">x</div>
 <div data-n="belowfold"   style="position:absolute;left:100px;top:5000px;width:96px;height:40px">x</div>
 <div data-n="pointernone" style="position:absolute;left:300px;top:100px;width:96px;height:40px;pointer-events:none">x</div>
@@ -213,7 +216,10 @@ func TestClickGuards(t *testing.T) {
 		{"normal", false, "正常元素"},
 		{"display", true, "拿不到可点区域"},
 		{"visibility", true, "不可命中"},
-		{"opacity0", false, "仍可命中，须放行"},
+		{"opacity0", true, "不可见"},
+		{"opacitylow", true, "低于可见下限"},
+		{"opacitydim", false, "肉眼可见，须放行"},
+		{"inancestor", true, "祖先透明"},
 		{"offleft", true, "落点在视口之外"},
 		{"belowfold", true, "落点在视口之外"},
 		{"pointernone", false, "可穿透但仍应放行"},
```

**File**: `xiaohongshu/search.go` (modified, +33/-14)
```diff
@@ -35,21 +35,22 @@ type FilterOption struct {
 // 组和选项一律按文本定位，不用序号。面板里同一个选项可能渲染成多个 div.tags
 // （数量随视口而变），首项是否重复各组也不一致，下标对不齐。
 type filterGroup struct {
-	label   string                    // 面板上这一组的标签文本
-	pick    func(FilterOption) string // 从入参里取这一组的值
-	allowed []string                  // 合法取值；在打开页面之前就能挡掉写错的值
+	label        string                    // 面板上这一组的标签文本
+	defaultValue string                    // 页面初始选中的值，不需要重复点击
+	pick         func(FilterOption) string // 从入参里取这一组的值
+	allowed      []string                  // 合法取值；在打开页面之前就能挡掉写错的值
 }
 
 var filterGroups = []filterGroup{
-	{"排序依据", func(f FilterOption) string { return f.SortBy },
+	{"排序依据", "综合", func(f FilterOption) string { return f.SortBy },
 		[]string{"综合", "最新", "最多点赞", "最多评论", "最多收藏"}},
-	{"笔记类型", func(f FilterOption) string { return f.NoteType },
+	{"笔记类型", "不限", func(f FilterOption) string { return f.NoteType },
 		[]string{"不限", "视频", "图文"}},
-	{"发布时间", func(f FilterOption) string { return f.PublishTime },
+	{"发布时间", "不限", func(f FilterOption) string { return f.PublishTime },
 		[]string{"不限", "一天内", "一周内", "半年内"}},
-	{"搜索范围", func(f FilterOption) string { return f.SearchScope },
+	{"搜索范围", "不限", func(f FilterOption) string { return f.SearchScope },
 		[]string{"不限", "已看过", "未看过", "已关注"}},
-	{"位置距离", func(f FilterOption) string { return f.Location },
+	{"位置距离", "不限", func(f FilterOption) string { return f.Location },
 		[]string{"不限", "同城", "附近"}},
 }
 
@@ -59,12 +60,12 @@ type pendingFilter struct {
 	option string // 选项文本
 }
 
-// collectFilters 把入参展开成待应用的筛选项，顺便校验取值。
+// collectFilters 把入参整理成待应用的筛选项，同一组以最后一个非空值为准。
 //
 // 校验放在这里是为了在打开浏览器之前就挡掉写错的值——否则要等导航、悬停、
 // 在面板里找不到之后才能报错，等于为了说一句"你写错了"先向平台发一次请求。
 func collectFilters(filters []FilterOption) ([]pendingFilter, error) {
-	var pending []pendingFilter
+	selected := make(map[string]string, len(filterGroups))
 
 	for _, f := range filters {
 		for _, g := range filterGroups {
@@ -76,8 +77,17 @@ func collectFilters(filters []FilterOption) ([]pendingFilter, error) {
 				return nil, fmt.Errorf("%s 不支持 %q，可选：%s",
 					g.label, value, strings.Join(g.allowed, "、"))
 			}
-			pending = append(pending, pendingFilter{group: g.label, option: value})
+			selected[g.label] = value
+		}
+	}
+
+	var pending []pendingFilter
+	for _, g := range filterGroups {
+		value, ok := selected[g.label]
+		if !ok || value == g.defaultValue {
+			continue
 		}
+		pending = append(pending, pendingFilter{group: g.label, option: value})
 	}
 
 	return pending, nil
@@ -203,7 +213,7 @@ func waitFeedsChanged(page *rod.Page, before string, timeout time.Duration) {
 //
 // 全程不用序号。同一个选项在面板里可能渲染成多个 div.tags（数量随视口而变，
 // 且首项是否重复各组不一致），下标对不齐；早前用 div.tags:nth-child(N) 会选错项。
-// 多份重复的位置尺寸完全相同，取第一个点下去落在同一处。
+// 同一个文本可能对应多个节点，只取其中可见的那个。
 //
 // 作用域必须限定在 div.filter-panel 内且只认 div.tags：页面别处存在同文本的
 // 可见元素（顶部频道栏的「图文」「视频」、标签「综合」），放宽会点错地方。
@@ -230,16 +240,25 @@ func findFilterOption(page *rod.Page, pf pendingFilter) (*rod.Element, error) {
 		}
 
 		var available []string
+		matched := false
 		for _, opt := range options {
 			t, err := opt.Text()
 			if err != nil {
 				continue
 			}
 			t = strings.TrimSpace(t)
-			if t == pf.option {
+			available = append(available, t)
+			if t != pf.option {
+				continue
+			}
+
+			matched = true
+			if humanize.Visible(opt) {
 				return opt, nil
 			}
-			available = append(available, t)
+		}
+		if matched {
+			return nil, fmt.Errorf("「%s」里的选项「%s」当前不可见", pf.group, pf.option)
 		}
 		return nil, fmt.Errorf("「%s」里没有选项「%s」，页面上是：%s",
 			pf.group, pf.option, strings.Join(available, "、"))
```

**File**: `xiaohongshu/search_integration_test.go` (modified, +95/-3)
```diff
@@ -48,11 +48,14 @@ func TestSearchWithFilters(t *testing.T) {
 	action := NewSearchAction(page)
 
 	filter := FilterOption{
-		NoteType:    "图文",
-		PublishTime: "一天内",
+		SortBy:      "最新",
+		NoteType:    "不限",
+		PublishTime: "半年内",
+		SearchScope: "不限",
+		Location:    "不限",
 	}
 
-	feeds, err := action.Search(context.Background(), "dn432", filter)
+	feeds, err := action.Search(context.Background(), "无锡 夏天 遛娃 凉快 户外", filter)
 	require.NoError(t, err)
 	require.NotEmpty(t, feeds, "feeds should not be empty")
 
@@ -63,3 +66,92 @@ func TestSearchWithFilters(t *testing.T) {
 		fmt.Printf("Feed Title: %s\n", feed.NoteCard.DisplayTitle)
 	}
 }
+
+// 同文本多节点时，只应取可见的那个。
+func TestFindFilterOptionPicksVisibleOption(t *testing.T) {
+	b := browser.NewBrowser(true)
+	defer b.Close()
+
+	page := b.NewPage()
+	defer func() {
+		_ = page.Close()
+	}()
+
+	cases := []struct {
+		name  string
+		style string
+	}{
+		{"display", `display: none`},
+		{"visibility", `visibility: hidden`},
+		{"opacity", `opacity: 0.001`},
+	}
+
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			page.MustSetDocumentContent(fmt.Sprintf(`<div class="filter-panel">
+				<div class="filters">
+					<span>笔记类型</span>
+					<div id="skip" class="tags" style="width: 80px; height: 24px; %s">图文</div>
+					<div id="want" class="tags" style="width: 80px; height: 24px">图文</div>
+				</div>
+			</div>`, c.style))
+
+			option, err := findFilterOption(page, pendingFilter{group: "笔记类型", option: "图文"})
+			require.NoError(t, err)
+			id, err := option.Attribute("id")
+			require.NoError(t, err)
+			require.NotNil(t, id)
+			require.Equal(t, "want", *id)
+		})
+	}
+}
+
+// 祖先透明时，子节点自报的 opacity 不作数。
+func TestFindFilterOptionChecksAncestorOpacity(t *testing.T) {
+	b := browser.NewBrowser(true)
+	defer b.Close()
+
+	page := b.NewPage()
+	defer func() {
+		_ = page.Close()
+	}()
+
+	page.MustSetDocumentContent(`<div class="filter-panel">
+		<div class="filters">
+			<span>笔记类型</span>
+			<div style="opacity: 0.001">
+				<div id="skip" class="tags" style="width: 80px; height: 24px; opacity: 1">图文</div>
+			</div>
+			<div id="want" class="tags" style="width: 80px; height: 24px">图文</div>
+		</div>
+	</div>`)
+
+	option, err := findFilterOption(page, pendingFilter{group: "笔记类型", option: "图文"})
+	require.NoError(t, err)
+	id, err := option.Attribute("id")
+	require.NoError(t, err)
+	require.NotNil(t, id)
+	require.Equal(t, "want", *id)
+}
+
+// 同文本节点全都不可见时要报错，不能退而求其次点一个。
+func TestFindFilterOptionRejectsAllInvisible(t *testing.T) {
+	b := browser.NewBrowser(true)
+	defer b.Close()
+
+	page := b.NewPage()
+	defer func() {
+		_ = page.Close()
+	}()
+
+	page.MustSetDocumentContent(`<div class="filter-panel">
+		<div class="filters">
+			<span>笔记类型</span>
+			<div class="tags" style="opacity: 0.001">图文</div>
+			<div class="tags" style="display: none">图文</div>
+		</div>
+	</div>`)
+
+	_, err := findFilterOption(page, pendingFilter{group: "笔记类型", option: "图文"})
+	require.ErrorContains(t, err, "当前不可见")
+}
```

**File**: `xiaohongshu/search_test.go` (modified, +66/-9)
```diff
@@ -19,7 +19,7 @@ func TestCollectFilters(t *testing.T) {
 		}, pending)
 	})
 
-	t.Run("五个字段全给", func(t *testing.T) {
+	t.Run("五个非默认字段全给", func(t *testing.T) {
 		pending, err := collectFilters([]FilterOption{{
 			SortBy:      "最新",
 			NoteType:    "视频",
@@ -33,6 +33,57 @@ func TestCollectFilters(t *testing.T) {
 		require.Equal(t, pendingFilter{group: "位置距离", option: "同城"}, pending[4])
 	})
 
+	t.Run("默认值不需要重复点击", func(t *testing.T) {
+		pending, err := collectFilters([]FilterOption{
+			{
+				SortBy:      "综合",
+				NoteType:    "不限",
+				PublishTime: "不限",
+				SearchScope: "不限",
+				Location:    "不限",
+			},
+		})
+		require.NoError(t, err)
+		require.Empty(t, pending)
+	})
+
+	t.Run("只保留非默认筛选项", func(t *testing.T) {
+		pending, err := collectFilters([]FilterOption{
+			{
+				SortBy:      "最新",
+				NoteType:    "不限",
+				PublishTime: "半年内",
+				SearchScope: "不限",
+				Location:    "不限",
+			},
+		})
+		require.NoError(t, err)
+		require.Equal(t, []pendingFilter{
+			{group: "排序依据", option: "最新"},
+			{group: "发布时间", option: "半年内"},
+		}, pending)
+	})
+
+	t.Run("同组最后一个默认值会清除前面的筛选", func(t *testing.T) {
+		pending, err := collectFilters([]FilterOption{
+			{NoteType: "图文"},
+			{NoteType: "不限"},
+		})
+		require.NoError(t, err)
+		require.Empty(t, pending)
+	})
+
+	t.Run("同组最后一个非默认值生效", func(t *testing.T) {
+		pending, err := collectFilters([]FilterOption{
+			{NoteType: "图文"},
+			{NoteType: "视频"},
+		})
+		require.NoError(t, err)
+		require.Equal(t, []pendingFilter{
+			{group: "笔记类型", option: "视频"},
+		}, pending)
+	})
+
 	t.Run("全空则无待应用项", func(t *testing.T) {
 		pending, err := collectFilters([]FilterOption{{}})
 		require.NoError(t, err)
@@ -59,20 +110,26 @@ func TestCollectFilters(t *testing.T) {
 // 否则以后新增字段会被静默忽略。
 func TestFilterGroupsCoverFilterOption(t *testing.T) {
 	all := FilterOption{
-		SortBy:      "综合",
-		NoteType:    "不限",
-		PublishTime: "不限",
-		SearchScope: "不限",
-		Location:    "不限",
+		SortBy:      "sort_by",
+		NoteType:    "note_type",
+		PublishTime: "publish_time",
+		SearchScope: "search_scope",
+		Location:    "location",
 	}
 
-	pending, err := collectFilters([]FilterOption{all})
-	require.NoError(t, err)
-	require.Len(t, pending, 5, "组表漏了 FilterOption 的字段")
+	var picked []string
+	for _, g := range filterGroups {
+		picked = append(picked, g.pick(all))
+	}
+	require.ElementsMatch(t, []string{
+		"sort_by", "note_type", "publish_time", "search_scope", "location",
+	}, picked, "组表漏了 FilterOption 的字段")
 
 	for _, g := range filterGroups {
 		require.NotEmpty(t, g.label)
+		require.NotEmpty(t, g.defaultValue, "%s 没有默认值", g.label)
 		require.NotEmpty(t, g.allowed, "%s 没有合法取值清单", g.label)
+		require.Contains(t, g.allowed, g.defaultValue, "%s 的默认值不在合法取值中", g.label)
 		require.NotNil(t, g.pick, "%s 没有取值函数", g.label)
 	}
 }
```

---

### Incident Patch 3: `ae5d1a22` (2026-09-22)
**Commit Message**: fix(feed): 详情页改为等待关键容器，不再等整页 DOM 稳定 (#814)

详情、点赞/收藏、评论、回复打开详情页后，改为等 load 事件 + 关键容器出现，不再要求整页 DOM 静止。

Co-authored-by: xpzouying <xpzouying@gmail.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `.gitignore` (modified, +4/-0)
```diff
@@ -34,8 +34,12 @@ go.work.sum
 # .vscode/
 .claude/
 
+# macOS
+.DS_Store
+
 # Build artifacts
 xiaohongshu-mcp
+bin/
 
 # Test scripts
 test_*.sh
```

**File**: `xiaohongshu/comment_feed.go` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ func (f *CommentFeedAction) PostComment(ctx context.Context, feedID, xsecToken,
 
 	// 导航到详情页
 	page.MustNavigate(url)
-	page.MustWaitDOMStable()
+	waitFeedPageReady(page)
 	humanize.Delay(ctx, humanize.AfterNavigate)
 
 	// 检测页面是否可访问
@@ -120,7 +120,7 @@ func (f *CommentFeedAction) ReplyToComment(ctx context.Context, feedID, xsecToke
 
 	// 导航到详情页
 	page.MustNavigate(url)
-	page.MustWaitDOMStable()
+	waitFeedPageReady(page)
 	humanize.Delay(ctx, humanize.AfterNavigate)
 
 	// 检测页面是否可访问
```

**File**: `xiaohongshu/feed_detail.go` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ func (f *FeedDetailAction) GetFeedDetailWithConfig(ctx context.Context, feedID,
 	err := retry.Do(
 		func() error {
 			page.MustNavigate(url)
-			page.MustWaitDOMStable()
+			waitFeedPageReady(page)
 			return nil
 		},
 		retry.Attempts(3),
```

**File**: `xiaohongshu/like_favorite.go` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ func (a *interactAction) preparePage(ctx context.Context, actionType interactAct
 	logrus.Infof("Opening feed detail page for %s: %s", actionType, url)
 
 	page.MustNavigate(url)
-	page.MustWaitDOMStable()
+	waitFeedPageReady(page)
 	humanize.Delay(ctx, humanize.AfterNavigate)
 
 	return page
```

**File**: `xiaohongshu/page_ready.go` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+package xiaohongshu
+
+import (
+	"time"
+
+	"github.com/go-rod/rod"
+	"github.com/sirupsen/logrus"
+)
+
+// feedReadyTimeout 等待详情页关键容器的上限，超时不算失败。
+const feedReadyTimeout = 8 * time.Second
+
+// feedReadySelectors 详情页已出结果的判据：正常笔记容器，或 checkPageAccessible 认的错误容器。
+const feedReadySelectors = ".interact-container, .note-scroller, " +
+	".access-wrapper, .error-wrapper, .not-found-wrapper, .blocked-wrapper"
+
+// waitFeedPageReady 等待 feed 详情页可用：load 事件 + 关键容器出现，不要求整页 DOM 静止。
+func waitFeedPageReady(page *rod.Page) {
+	page.MustWaitLoad()
+
+	if _, err := page.Timeout(feedReadyTimeout).Element(feedReadySelectors); err != nil {
+		// 没等到也继续，后续 Element 各自带轮询
+		logrus.Warnf("详情页关键容器未在 %s 内出现，继续尝试: %v", feedReadyTimeout, err)
+	}
+}
```

---

### Incident Patch 4: `8eae4eb2` (2026-09-22)
**Commit Message**: fix(publish): 发布前先建立创作者中心会话 (#855)

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `xiaohongshu/creator_session.go` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+package xiaohongshu
+
+import (
+	"time"
+
+	"github.com/go-rod/rod"
+	"github.com/pkg/errors"
+	"github.com/xpzouying/xiaohongshu-mcp/humanize"
+)
+
+const (
+	urlOfCreatorHome = `https://creator.xiaohongshu.com/?source=official`
+
+	creatorSessionCookie  = "galaxy_creator_session_id"
+	creatorSessionTimeout = 15 * time.Second
+)
+
+// ensureCreatorSession 浏览器里没有创作者中心会话时，先打开创作者中心首页，等会话建立
+func ensureCreatorSession(page *rod.Page) error {
+	if hasCreatorSession(page) {
+		return nil
+	}
+
+	if err := page.Navigate(urlOfCreatorHome); err != nil {
+		return errors.Wrap(err, "打开创作者中心失败")
+	}
+
+	deadline := time.Now().Add(creatorSessionTimeout)
+	for time.Now().Before(deadline) {
+		time.Sleep(500 * time.Millisecond)
+		if hasCreatorSession(page) {
+			humanize.Delay(page.GetContext(), humanize.AfterNavigate)
+			return nil
+		}
+	}
+	return errors.New("创作者中心登录失效，请重新扫码登录")
+}
+
+func hasCreatorSession(page *rod.Page) bool {
+	cks, err := page.Browser().GetCookies()
+	if err != nil {
+		return false
+	}
+	for _, c := range cks {
+		if c.Name == creatorSessionCookie {
+			return true
+		}
+	}
+	return false
+}
```

**File**: `xiaohongshu/publish.go` (modified, +4/-0)
```diff
@@ -44,6 +44,10 @@ func NewPublishImageAction(page *rod.Page) (*PublishAction, error) {
 
 	pp := page.Timeout(300 * time.Second)
 
+	if err := ensureCreatorSession(pp); err != nil {
+		return nil, err
+	}
+
 	if err := pp.Navigate(urlOfPublic); err != nil {
 		return nil, errors.Wrap(err, "导航到发布页面失败")
 	}
```

**File**: `xiaohongshu/publish_video.go` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ type PublishVideoContent struct {
 func NewPublishVideoAction(page *rod.Page) (*PublishAction, error) {
 	pp := page.Timeout(300 * time.Second)
 
+	if err := ensureCreatorSession(pp); err != nil {
+		return nil, err
+	}
+
 	if err := pp.Navigate(urlOfPublic); err != nil {
 		return nil, errors.Wrap(err, "导航到发布页面失败")
 	}
```

---

### Incident Patch 5: `a2cde9cd` (2026-09-22)
**Commit Message**: fix(publish): 图文发布前关闭图片编辑引导卡 (#853)

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `xiaohongshu/publish.go` (modified, +20/-0)
```diff
@@ -365,6 +365,7 @@ func submitPublish(ctx context.Context, page *rod.Page, title, content string, t
 	if err := humanize.Type(ctx, contentElem, content); err != nil {
 		return errors.Wrap(err, "输入正文失败")
 	}
+	closeFeatureGuide(page)
 	if err := waitAndClickTitleInput(titleElem); err != nil {
 		return err
 	}
@@ -584,6 +585,25 @@ func clickPublishWidget(page *rod.Page, widget *rod.Element) error {
 	return nil
 }
 
+// closeFeatureGuide 页面有功能引导卡时点「我知道了」关闭
+func closeFeatureGuide(page *rod.Page) {
+	has, btn, err := page.Has(".feature-guide__btn")
+	if err != nil || !has {
+		return
+	}
+	if visible, err := btn.Visible(); err != nil || !visible {
+		return
+	}
+
+	btn = btn.Timeout(5 * time.Second)
+	defer btn.CancelTimeout()
+	if err := humanize.Click(btn); err != nil {
+		slog.Warn("关闭功能引导卡失败", "error", err)
+		return
+	}
+	slog.Info("已关闭功能引导卡")
+}
+
 // waitAndClickTitleInput 在填写正文后等待 1 秒并回点标题输入框，增强后续交互稳定性
 func waitAndClickTitleInput(titleElem *rod.Element) error {
 	slog.Info("正文填写完成，准备等待后回点标题输入框")
```

---

### Incident Patch 6: `31008aa6` (2026-08-13)
**Commit Message**: fix(ci): 关闭 provenance/sbom，修复阿里云 ACR 推送失败 (#807)

v2.5.0 发版时 Docker Hub 推送成功但阿里云 ACR 报
denied: unknown manifest class for application/vnd.oci.empty.v1+json

原因是 runner 上的 BuildKit 从 v0.31.2 升到 v0.32.2（workflow 用的是浮动的
setup-buildx-action@v3），新版默认附加 provenance/sbom 证明，其空配置描述符
的媒体类型阿里云个人版 ACR 不支持。项目未使用这些证明，直接关闭。

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `.github/workflows/docker-release.yml` (modified, +5/-0)
```diff
@@ -66,3 +66,8 @@ jobs:
           crpi-hocnvtkomt7w9v8t.cn-beijing.personal.cr.aliyuncs.com/xpzouying/xiaohongshu-mcp:latest
         cache-from: type=gha
         cache-to: type=gha,mode=max
+        # BuildKit v0.32 起默认附加 provenance / sbom 证明，其空配置描述符用
+        # application/vnd.oci.empty.v1+json，阿里云个人版 ACR 不认这个媒体类型，
+        # 会在推送时 denied。项目没用到这些证明，直接关掉。
+        provenance: false
+        sbom: false
```

---

### Incident Patch 7: `738d7c29` (2026-08-13)
**Commit Message**: fix(log): 4xx 记为 warning，并清理鉴权 PR 的遗留项 (#805)

* fix(log): 4xx 记为 warning，与 5xx 服务端故障区分

respondError 是全仓库共用的错误出口，此前 32 个调用点一律打 ERROR。
鉴权开启后被扫描器打，401 会刷满 ERROR；且 400（调用方传错）与
500（服务端故障）在日志里无法用 level 区分。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

* chore(auth): 移除冗余 ENV 并标注测试用例适用范围

- Dockerfile 的 ENV AUTH_TOKEN="" 与不设置行为一致，docker run -e 同样能覆盖
- 标注两个头部带空格的用例只在内存态成立：真实请求的 OWS 已被
  net/textproto 剥掉，客户端多打空格实际会放行

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `Dockerfile` (modified, +0/-1)
```diff
@@ -110,7 +110,6 @@ COPY --from=builder /out/app .
 
 ENV HOME=/app/data/home
 ENV XDG_CONFIG_HOME=/app/data/config
-ENV AUTH_TOKEN=""
 
 EXPOSE 18060
 
```

**File**: `handlers_api.go` (modified, +7/-1)
```diff
@@ -19,7 +19,13 @@ func respondError(c *gin.Context, statusCode int, code, message string, details
 		Details: details,
 	}
 
-	logrus.Errorf("%s %s %d", c.Request.Method, c.Request.URL.Path, statusCode)
+	// 4xx 是调用方传错，5xx 才是服务端故障，用日志级别区分开。
+	// 否则鉴权开启后被扫描器打，401 会把 ERROR 刷满。
+	if statusCode < http.StatusInternalServerError {
+		logrus.Warnf("%s %s %d", c.Request.Method, c.Request.URL.Path, statusCode)
+	} else {
+		logrus.Errorf("%s %s %d", c.Request.Method, c.Request.URL.Path, statusCode)
+	}
 
 	c.JSON(statusCode, response)
 }
```

**File**: `handlers_api_test.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+package main
+
+import (
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+	"github.com/sirupsen/logrus"
+	logrustest "github.com/sirupsen/logrus/hooks/test"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// respondError 是全仓库共用的错误出口。分级只是一行 if，改回去编译和其他单测
+// 都不会报错，但鉴权开启后被扫描器打的 401 会重新刷满 ERROR。
+func TestRespondErrorLogLevel(t *testing.T) {
+	tests := []struct {
+		name       string
+		statusCode int
+		wantLevel  logrus.Level
+	}{
+		{name: "401 记为 warning", statusCode: http.StatusUnauthorized, wantLevel: logrus.WarnLevel},
+		{name: "400 记为 warning", statusCode: http.StatusBadRequest, wantLevel: logrus.WarnLevel},
+		{name: "500 记为 error", statusCode: http.StatusInternalServerError, wantLevel: logrus.ErrorLevel},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			hook := logrustest.NewGlobal()
+			defer hook.Reset()
+
+			gin.SetMode(gin.TestMode)
+			c, _ := gin.CreateTestContext(httptest.NewRecorder())
+			c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/login/status", nil)
+
+			respondError(c, tt.statusCode, "CODE", "消息", nil)
+
+			require.Len(t, hook.Entries, 1)
+			assert.Equal(t, tt.wantLevel, hook.LastEntry().Level)
+		})
+	}
+}
```

**File**: `middleware_test.go` (modified, +2/-0)
```diff
@@ -60,6 +60,8 @@ func TestAuthMiddlewareRejectsInvalidCredentials(t *testing.T) {
 		{name: "wrong scheme", authorization: "Basic secret-token"},
 		{name: "missing token", authorization: "Bearer "},
 		{name: "wrong token", authorization: "Bearer wrong-token"},
+		// 下面两个头部两侧带空格的用例只在内存态成立：真实请求经 net/textproto
+		// 解析时两侧 OWS 已被剥掉，客户端多打空格实际会放行，不会被拒。
 		{name: "leading whitespace", authorization: " Bearer secret-token"},
 		{name: "trailing whitespace", authorization: "Bearer secret-token "},
 	}
```

---

### Incident Patch 8: `c2fc4dde` (2026-08-02)
**Commit Message**: fix(docker): tini 注册为 child subreaper，消除误导性告警 (#794)

* fix(docker): tini 注册为 child subreaper，消除误导性告警

容器另带 init 进程时（如 compose 的 init: true），tini 不是 PID 1，
会打印「zombie reaping won't work」告警。实际回收由外层 init 完成，
但该告警会误导使用者。加 -s 后两种情况下均正常且不再告警。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

* fix(docker): compose 去掉冗余的 init，改由镜像内的 tini 承担

镜像已自带 tini 作为 ENTRYPOINT，compose 再注入 docker-init 会形成
两层 init。去掉后 tini 回到 PID 1，只保留一层。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `Dockerfile` (modified, +3/-2)
```diff
@@ -113,7 +113,8 @@ ENV XDG_CONFIG_HOME=/app/data/config
 
 EXPOSE 18060
 
-# 用 tini 当 PID 1，回收浏览器退出后被过继过来的子进程，避免堆积僵尸进程
-ENTRYPOINT ["/usr/bin/tini", "--"]
+# 用 tini 回收浏览器退出后被过继过来的子进程，避免堆积僵尸进程。
+# -s 注册为 child subreaper，容器另外带了 init 进程（如 compose 的 init: true）时同样生效
+ENTRYPOINT ["/usr/bin/tini", "-s", "--"]
 
 CMD ["./app"]
```

**File**: `docker/docker-compose.yml` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ services:
     # image: crpi-hocnvtkomt7w9v8t.cn-beijing.personal.cr.aliyuncs.com/xpzouying/xiaohongshu-mcp
     container_name: xiaohongshu-mcp
     restart: unless-stopped
-    init: true
     tty: true
     volumes:
       - ./data:/app/data
```

---

### Incident Patch 9: `f5af1dba` (2026-08-02)
**Commit Message**: fix(docker): 镜像内置 tini 作为 PID 1，回收浏览器子进程 (#793)

此前只在 docker-compose.yml 里设了 init: true，直接用 docker run
或自写编排的用户不受保护，Chrome 退出后其子进程会堆积成僵尸进程。
改为镜像自带 tini，与启动方式无关。

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `Dockerfile` (modified, +4/-0)
```diff
@@ -76,6 +76,7 @@ RUN apt-get update && apt-get install -y --no-install-recommends \
     libxss1 \
     libxtst6 \
     lsb-release \
+    tini \
     wget \
     xdg-utils \
     xz-utils \
@@ -112,4 +113,7 @@ ENV XDG_CONFIG_HOME=/app/data/config
 
 EXPOSE 18060
 
+# 用 tini 当 PID 1，回收浏览器退出后被过继过来的子进程，避免堆积僵尸进程
+ENTRYPOINT ["/usr/bin/tini", "--"]
+
 CMD ["./app"]
```

---

### Incident Patch 10: `2a57ab41` (2026-08-02)
**Commit Message**: fix(publish): 正文输入框改为轮询定位，不再 panic (#792)

getContentElement 原先用 Race + MustDo：兜底分支返回的普通 error 会让
Race 立刻终止，等于只做一次快照，失败还以 panic 形式抛出。改为在窗口内
轮询多个候选选择器，全部落空返回可读错误。

- findTextboxByPlaceholder 去掉 MustElements，错误正常返回
- 图片上传改为按 accept 挑选输入框

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `xiaohongshu/publish.go` (modified, +94/-36)
```diff
@@ -35,6 +35,9 @@ type PublishAction struct {
 
 const (
 	urlOfPublic = `https://creator.xiaohongshu.com/publish/publish?source=official`
+
+	// contentElemTimeout 查找正文输入框的轮询窗口
+	contentElemTimeout = 10 * time.Second
 )
 
 func NewPublishImageAction(page *rod.Page) (*PublishAction, error) {
@@ -246,12 +249,7 @@ func uploadImages(page *rod.Page, imagesPaths []string) error {
 
 	// 逐张上传：每张上传后等待预览出现，再上传下一张
 	for i, path := range validPaths {
-		selector := `input[type="file"]`
-		if i == 0 {
-			selector = ".upload-input"
-		}
-
-		uploadInput, err := page.Element(selector)
+		uploadInput, err := findImageUploadInput(page, i == 0)
 		if err != nil {
 			return errors.Wrapf(err, "查找上传输入框失败(第%d张)", i+1)
 		}
@@ -271,6 +269,48 @@ func uploadImages(page *rod.Page, imagesPaths []string) error {
 	return nil
 }
 
+// findImageUploadInput 查找图片上传的输入框
+func findImageUploadInput(page *rod.Page, first bool) (*rod.Element, error) {
+	if first {
+		return page.Element(".upload-input")
+	}
+
+	inputs, err := page.Elements(`input[type="file"]`)
+	if err != nil {
+		return nil, err
+	}
+	if len(inputs) == 0 {
+		return nil, errors.New("页面没有文件上传输入框")
+	}
+
+	for _, input := range inputs {
+		accept, err := input.Attribute("accept")
+		if err != nil || accept == nil {
+			continue
+		}
+		if acceptsImage(*accept) {
+			return input, nil
+		}
+	}
+
+	return inputs[0], nil
+}
+
+// acceptsImage 判断 accept 属性是否接受图片
+func acceptsImage(accept string) bool {
+	accept = strings.ToLower(accept)
+	if strings.Contains(accept, "image/") {
+		return true
+	}
+
+	for _, ext := range []string{".jpg", ".jpeg", ".png", ".webp", ".heic"} {
+		if strings.Contains(accept, ext) {
+			return true
+		}
+	}
+	return false
+}
+
 // waitForUploadComplete 等待第 expectedCount 张图片上传完成，最多等 60 秒
 func waitForUploadComplete(page *rod.Page, expectedCount int) error {
 	maxWaitTime := 60 * time.Second
@@ -318,9 +358,9 @@ func submitPublish(ctx context.Context, page *rod.Page, title, content string, t
 
 	humanize.Delay(ctx, humanize.AfterType)
 
-	contentElem, ok := getContentElement(page)
-	if !ok {
-		return errors.New("没有找到内容输入框")
+	contentElem, err := getContentElement(page, contentElemTimeout)
+	if err != nil {
+		return err
 	}
 	if err := humanize.Type(ctx, contentElem, content); err != nil {
 		return errors.Wrap(err, "输入正文失败")
@@ -603,30 +643,45 @@ func makeMaxLengthError(elemText string) error {
 	return errors.Errorf("当前输入长度为%s，最大长度为%s", currLen, maxLen)
 }
 
-// 查找内容输入框 - 使用Race方法处理两种样式
-func getContentElement(page *rod.Page) (*rod.Element, bool) {
-	var foundElement *rod.Element
-	var found bool
-
-	page.Race().
-		Element("div.ql-editor").MustHandle(func(e *rod.Element) {
-		foundElement = e
-		found = true
-	}).
-		ElementFunc(func(page *rod.Page) (*rod.Element, error) {
-			return findTextboxByPlaceholder(page)
-		}).MustHandle(func(e *rod.Element) {
-		foundElement = e
-		found = true
-	}).
-		MustDo()
-
-	if found {
-		return foundElement, true
-	}
-
-	slog.Warn("no content element found by any method")
-	return nil, false
+// contentElemSelectors 正文输入框的候选选择器，按先后顺序尝试。
+var contentElemSelectors = []string{
+	`div[role="textbox"][contenteditable="true"]`,
+	`div.tiptap[contenteditable="true"]`,
+	`div.ql-editor`,
+}
+
+// getContentElement 在 timeout 内轮询查找正文输入框，全部落空返回错误。
+func getContentElement(page *rod.Page, timeout time.Duration) (*rod.Element, error) {
+	deadline := time.Now().Add(timeout)
+
+	for {
+		elem, err := findContentElement(page)
+		if err == nil {
+			return elem, nil
+		}
+
+		if time.Now().After(deadline) {
+			return nil, errors.Wrap(err, "查找正文输入框失败")
+		}
+		time.Sleep(300 * time.Millisecond)
+	}
+}
+
+func findContentElement(page *rod.Page) (*rod.Element, error) {
+	for _, selector := range contentElemSelectors {
+		elems, err := page.Elements(selector)
+		if err != nil {
+			return nil, errors.Wrapf(err, "查找正文输入框失败: %s", selector)
+		}
+
+		for _, elem := range elems {
+			if isElementVisible(elem) {
+				return elem, nil
+			}
+		}
+	}
+
+	retu
```

**File**: `xiaohongshu/publish_upload_test.go` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+package xiaohongshu
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func TestAcceptsImage(t *testing.T) {
+	cases := []struct {
+		name   string
+		accept string
+		want   bool
+	}{
+		{"图片扩展名", ".png,.webp", true},
+		{"大写扩展名", ".JPG", true},
+		{"MIME 通配", "image/*", true},
+		{"非图片扩展名", ".xyz,.abc", false},
+		{"非图片 MIME", "video/mp4", false},
+		{"空值", "", false},
+	}
+
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			assert.Equal(t, c.want, acceptsImage(c.accept))
+		})
+	}
+}
```

**File**: `xiaohongshu/publish_video.go` (modified, +3/-3)
```diff
@@ -113,9 +113,9 @@ func submitPublishVideo(ctx context.Context, page *rod.Page, title, content stri
 	humanize.Delay(ctx, humanize.AfterType)
 
 	// 正文 + 标签
-	contentElem, ok := getContentElement(page)
-	if !ok {
-		return errors.New("没有找到内容输入框")
+	contentElem, err := getContentElement(page, contentElemTimeout)
+	if err != nil {
+		return err
 	}
 	if err := humanize.Type(ctx, contentElem, content); err != nil {
 		return errors.Wrap(err, "输入正文失败")
```

#### Recent Merged Pull Requests:
- **PR #858** (2026-09-22): fix(search): 筛选点击限制指针路径，并在按下前复核落点 (@xpzouying)
- **PR #857** (2026-09-22): docs: add xPeiPeix as a contributor for code (@allcontributors[bot])
- **PR #856** (2026-09-22): docs: add galois1983 as a contributor for code (@allcontributors[bot])
- **PR #855** (2026-09-22): fix(publish): 发布前先建立创作者中心会话 (@xpzouying)
- **PR #853** (2026-09-22): fix(publish): 图文发布前关闭图片编辑引导卡 (@xpzouying)
- **PR #847** (closed): fix(publish): make title refocus non-fatal after body input (#837) (@TobeMagic)
- **PR #846** (closed): fix(publish): waitAndClickTitleInput 用 ClickNoWait 绕过遮挡误判死等 (@xiwaba)
- **PR #821** (closed): fix: redact xsec_token from get_feed_detail logs (@EvilMuMuKo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
