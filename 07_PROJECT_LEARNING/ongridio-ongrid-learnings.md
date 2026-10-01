# Forensic Learning Record (Deep Inspection): ongridio/ongrid

> **Canonical Artifact**: `07_PROJECT_LEARNING/ongridio-ongrid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ongridio/ongrid](https://github.com/ongridio/ongrid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T00:03:11.469Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ongridio/ongrid`
- **Description**: An ops AI Agent that understands your infrastructure, finds the root cause, and fixes it — right from Slack, Telegram, Lark or DingTalk.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 1104 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/ongrid-edge-supervisor/env_windows.go`
```
// env_windows.go — read the service Environment registry field directly.
// Companion to mergedServiceEnv in worker.go: Windows SCM's promise of
// "service Environment field = process env" leaks under fork/exec of a
// different binary (supervisor.exe spawning worker.exe). Reading the
// field from the registry bypasses the SCM corner case and feeds the
// pairs into exec.Cmd.Env explicitly.

//go:build windows

package main

import (
	"golang.org/x/sys/windows/registry"
)

// serviceRegKeyPath is the HKLM path to the ongrid-edge service entry.
// Kept in sync with install_windows.go; duplicate literal avoids a
// shared const across the install / worker split.
const envRegKeyPath = `SYSTEM\CurrentControlSet\Services\` + serviceName

// readServiceEnvField reads the service Environment multi-string value
// from the registry. Returns the raw pairs (each "KEY=VALUE"), or an
// empty slice + error if the field is absent / unreadable. Callers
// should treat any error as "fall back to os.Environ" — this is a
// best-effort correctness path, not a hard requirement.
func readServiceEnvField() ([]string, error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, envRegKeyPath, registry.QUERY_VALUE|registry.READ)
	if err != nil {
		return nil, err
	}
	defer k.Close()
	values, _, err := k.GetStringsValue("Environment")
	if err != nil {
		return nil, err
	}
	return values, nil
}

```

### Core Architecture Module: `cmd/ongrid-edge-supervisor/install_windows.go`
```
// install_windows.go 实现 supervisor.exe --install / --uninstall 子命令
//。
// --install --token <X> --cloud-addr <X> --access-key <X> [--collector-mode off] [--plugin-bin-dir <P>] [--plugin-work-dir <P>]:
//   1. DPAPI CryptProtectData(token) → secrets.enc
//   2. 验证 CryptUnprotectData(secrets.enc) 能还原
//   3. 清零明文 token 内存
//   4. sc.exe create → 启动服务
//   5. 写注册表 Environment MultiString（cloud_addr / access_key / collector_mode / plugin_*_dir）
// --uninstall:
//   1. sc.exe stop + delete（注册表 Environment 字段随服务键一起清除）
//   2. 删除 secrets.enc
// 安全：明文 token 仅在 CLI flag 时刻存在于内存，加密后立即清零。
// 不写日志/临时文件。Go string 不可变（无法真正清零 argv），但 []byte 可以。
// 注：access_key 暂以明文存于 Environment（与 R4 现状一致； 仅要求 SECRET_KEY
// 走 DPAPI，ACCESS_KEY 在现有  服务中也是明文环境变量）。
//  深化：runInstall 从 66 行单体函数拆为 ≤30 行 orchestrator，
// 3 个正交关注点委托给 install 包接口（SecretStore / ServiceController / EnvWriter）。

//go:build windows

package main

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/ongridio/ongrid/internal/edgeagent/edgedirs"
	"github.com/ongridio/ongrid/internal/edgeagent/install"
)

// secretsFileName 是 DPAPI 加密的 token 文件名。
const secretsFileName = "secrets.enc"

// serviceRegKeyPath 是 Windows Service 注册表路径（HKLM 前缀由 registry.OpenKey 自动加）。
const serviceRegKeyPath = `SYSTEM\CurrentControlSet\Services\` + serviceName

// installOptions 是 --install 子命令接收的所有参数。
type installOptions struct {
	// Token 是 broker SECRET_KEY（DPAPI 加密后存 secrets.enc）。必需。
	Token string
	// CloudAddr 是 frontier broker 地址（host:port）。必需。
	CloudAddr string
	// AccessKey 是 broker ACCESS_KEY（明文存服务 Environment）。必需。
	AccessKey string
	// CollectorMode 是 node_* 采集模式（off / all），默认 off。
	CollectorMode string
	// PluginBinDir / PluginWorkDir 可选，缺省由 edgedirs 默认值决定。
	PluginBinDir  string
	PluginWorkDir string
	// TLSCAFile 是 frontier TLS CA 证书路径（PEM）。可选；空 = plaintext。
	// 当 frontier 启用 TLS时必需。
	TLSCAFile string
	// TLSServerName 是 TLS SNI / 证书 CN。可选；当 TLSCAFile 非空且
	// CloudAddr 是 IP 字面量时必需（Go TLS 需要显式 ServerName）。
	TLSServerName string
	// ScrapeConfigFile 是 worker metrics plugin 加载的 scrape.yaml 路径
	// （ONGRID_EDGE_SCRAPE_CONFIG_FILE env）。可选；空 = Validate 填
	// edgedirs.DataDir/scrape.yaml 默认值。
	// 必需场景：collector_mode=auto 且有自定义 metrics 需 scrape。
	// 缺失会导致 worker 用 embedded baseline 只 scrape windows_exporter，
	// 自定义 metrics 全断（NSSM→supervisor 切换功能回退，修复）。
	ScrapeConfigFile string
}

// Validate 校验必需字段并应用默认值。
func (o *installOptions) Validate() error {
	if o.Token == "" {
		return fmt.Errorf("--token <X> is required")
	}
	if o.CloudAddr == "" {
		return fmt.Errorf("--cloud-addr <host:port> is required")
	}
	if o.AccessKey == "" {
		return fmt.Errorf("--access-key <X> is required")
	}
	if o.CollectorMode == "" {
		o.CollectorMode = "off"
	}
	if o.PluginBinDir == "" {
		o.PluginBinDir = edgedirs.BinDir
	}
	if o.PluginWorkDir == "" {
		o.PluginWorkDir = edgedirs.PluginWorkDir
	}
	if o.ScrapeConfigFile == "" {
		o.ScrapeConfigFile = filepath.Join(edgedirs.DataDir, "scrape.yaml")
	}
	// TLSCAFile 非空时校验文件存在（ca.pem validation）。
	// 缺失会导致 install 成功但 worker tunnel dial 必失败（"force closed"），
	// 排查成本高 — install 时 fail-fast。
	if o.TLSCAFile != "" {
		if _, err := os.Stat(o.TLSCAFile); err != nil {
			return fmt.Errorf("--tls-ca-file %q: %w", o.TLSCAFile, err)
		}
	}
	return nil
}

// envPairs 返回写入服务 Environment 字段的 KEY=VALUE 多字符串数组。
// 顺序固定，便于人工排查与重装比对。
// TLS env vars 只在用户显式提供 --tls-ca-file / --tls-server-name 时
// 写入。缺失会导致 frontier TLS 连接失败（"force closed"）—
// 必须传 --tls-ca-file C:/ongrid-edge/ca.pem。
func (o *installOptions) envPairs() []string {
	pairs := []string{
		"ONGRID_EDGE_CLOUD_ADDR=" + o.CloudAddr,
		"ONGRID_EDGE_ACCESS_KEY=" + o.AccessKey,
		// SECRET_KEY 由 secrets.enc 提供（DPAPI），不写入 Environment
		"ONGRID_EDGE_COLLECTOR_MODE=" + o.CollectorMode,
		"ONGRID_EDGE_PLUGIN_BIN_DIR=" + o.PluginBinDir,
		"ONGRID_EDGE_PLUGIN_WORK_DIR=" + o.PluginWorkDir,
		// secrets.enc 路径（让 worker main.go 知道从哪加载 DPAPI token）
		"ONGRID_EDGE_SECRETS_FILE=" + filepath.Join(edgedirs.DataDir, secretsFileName),
		// scrape.yaml 路径（worker metrics plugin 加载自定义 scrape targets；
		// 缺失会让 worker 用 embedded baseline 只 scrape windows_exporter）
		"ONGRID_EDGE_SCRAPE_CONFIG_FILE=" + o.ScrapeConfigFile,
	}
	if o.TLSCAFile != "" {
		pairs = append(pairs, "ONGRID_EDGE_TLS_CA_FILE="+o.TLSCAFile)
		// TLS 锚点：记录"本机安装时启用过 TLS"。worker 侧据此在 CA 配置丢失时
		// fail-closed（拒绝明文降级拨号）而非静默回退明文 — 凭证通道不允许无感降级。
		pairs = append(pairs, "ONGRID_EDGE_TLS_REQUIRED=1")
	}
	if o.TLSServerName != "" {
		pairs = append(pairs, "ONGRID_EDGE_TLS_SERVER_NAME="+o.TLSServerName)
	}
	return pairs
}

// secureUpgradeDir 是 runInstall 的升级目录加固测试缝：生产路径指向
// install.EnsureSecureDir（真实 icacls ACL），测试注入 no-op / sentinel 错误
// 避免触碰真实 ProgramData 路径（与 install 包 ensureSecureDirFn 缝模式一致）。
var secureUpgradeDir = install.EnsureSecureDir

// runInstall 执行 --install 流程，编排接口的调用顺序。
// 编排顺序：
//  1. SecretStore.Install — DPAPI 加密 + round-trip 验证（内部自清理）
//  2. ServiceController.Create — sc.exe create（失败时回滚凭证）
//  3. ServiceController.ConfigureDefenderExclusion — Add-MpPreference
//  4. ServiceController.ConfigureRecovery — sc.exe failure（失败即中止：
//     recovery 承载 supervisor crash 自恢复契约，缺失则安装不可信）
//  5. EnvWriter.Write — registry Environment（失败不回滚服务）
//  6. ServiceController.Start — sc.exe start（失败即报错：自动化部署必须
//     收到真实退出码；不回滚已创建服务，保留现场供 SCM/nssm 排障）
func runInstall(
	log *slog.Logger, opts installOptions,
	ss install.SecretStore, sc install.ServiceController, ew install.EnvWriter,
) error {
	if err := opts.Validate(); err != nil {
		return err
	}

	// 将 token 转为 []byte 一次，全链路复用，defer 清零
	// Go string 不可变（argv 残留到进程退出），但 []byte 副本可以清零
	tokenBytes := []byte(opts.Token)
	defer zeroBytes(tokenBytes)

	// 确保 data 目录存在
	if err := os.MkdirAll(edgedirs.DataDir, 0755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}
	// StageDir / PluginWorkDir 是升级链路的信任根：升级 bundle 无签名，完整性
	// 依赖目录 ACL（ProgramData 默认 ACL 允许 Users 创建文件）。必须显式收紧 —
	// 目录已存在时（迁移安装 / 旧版残留）ApplyDirACL 的继承标记也会刷新既有
	// 子树的继承 ACE，防止旧宽松 ACL 存活。
	for _, dir := range []string{edgedirs.StageDir, opts.PluginWorkDir} {
		if err := secureUpgradeDir(dir); err != nil {
			return fmt.Errorf("secure dir %s: %w", dir, err)
		}
	}

	// 1. 凭证（DPAPI 加密 + 验证；失败时 Install 内部自清理）
	if err := ss.Install(tokenBytes); err != nil {
		return err
	}

	// 2. 服务注册（失败时回滚凭证；`_ =` 丢弃回滚删除的次要错误 —
	// 主错误已确定，secrets.enc 残留可由重装或 --uninstall 清理）
	exePath, err := os.Executable()
	if err != nil {
		_ = ss.Remove()
		return fmt.Errorf("resolve executable path: %w", err)
	}
	if err := sc.Create(exePath); err != nil {
		_ = ss.Remove()
		return fmt.Errorf("create service: %w", err)
	}

	// 3. Defender exclusion
	if err := sc.ConfigureDefenderExclusion(); err != nil {
		log.Warn("failed to configure Windows Defender exclusion (non-fatal; AV may interfere with supervisor self-swap)",
			slog.String("err", err.Error()))
	}

	// 4. SCM failure recovery（+ failureflag — 失败即中止安装；
	//    service.go samesession=false + supervisor self-swap exit(0) 依赖此配置触发 SCM restart，
	//    配置缺失时服务不具备自恢复能力，交付它等同于假成功）
	if err := sc.ConfigureRecovery(); err != nil {
		return fmt.Errorf("configure SCM failure recovery: %w", err)
	}

	// 5. 环境配置（失败不回滚服务 — 由调用方决定是否 --uninstall）
	if err := ew.Write(opts.envPairs()); err != nil {
		log.Warn("service created but failed to set Environment; manual cleanup needed",
			slog.String("err", err.Error()))
		return fmt.Errorf("write service Environment: %w", err)
	}

	// 6. 启动（失败即返回错误——"install completed" 只允许在服务真正运行后出现；
	//    不回滚已创建的服务，保留现场供排障，--install 幂等可重跑）
	if err := sc.Start(); err != nil {
		return fmt.Errorf("start service: %w", err)
	}

	log.Info("install completed",
		slog.String("binary", exePath),
		slog.String("cloud_addr", opts.CloudAddr))
	return nil
}

// runUninstall 执行 --uninstall 流程。
func runUninstall(log *slog.Logger, sc install.ServiceController, ss install.SecretStore) error {
	// 1. 停止服务（忽略 "服务未运行" 错误）
	_ = sc.Stop()

	// 2. 删除服务（注册表 Environment 字段随服务键一起删除）
	if err := sc.Delete(); err != nil {
		return err
	}

	// 3. 删除 secrets.enc
	if err := ss.Remov
```

### Core Architecture Module: `cmd/ongrid-edge-supervisor/main.go`
```
// Command ongrid-edge-supervisor 是 Windows 版 Edge Agent 的 supervisor 进程
//。
//  职责：
//   - Windows Service 入口（golang.org/x/sys/windows/svc）
//   - 启动 + 监控 worker.exe（cmd/ongrid-edge 编译产物）
//   - 健康感知（health.json 文件 IPC，30s 心跳窗口）
//
//   - ✅ --install / --uninstall 子命令 + DPAPI 加密 token
//   - ✅ token 90 天轮转检查（edge 端）
//   - ❌ bundle upgrade staging + swap + rollback
// 整个包 //go:build windows（Linux 不编译，对称 cmdpolicy 的 //go:build linux）。
// health 逻辑在 internal/edgeagent/supervisorhealth 包，跨平台可测。

//go:build windows

package main

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/svc"

	"github.com/ongridio/ongrid/internal/edgeagent/edgedirs"
	"github.com/ongridio/ongrid/internal/edgeagent/install"
)

const serviceName = "ongrid-edge"

// version 是编译期版本号（Makefile -ldflags "-X main.version=v$(VERSION)" 注入）。
// SupervisorSelfSwap.smokeTestVersion 跑 `supervisor.exe.new --version` 验证
// binary 可执行 + 版本非空。
var version = "dev"

func main() {
	// Windows Service 模式下 os.Stderr 写入 invalid handle 返回 error，
	// io.MultiWriter 遇到第一个 writer 失败就 short-circuit 不写后续 writer。
	// 因此 logFile 必须排在 os.Stderr 之前，确保文件一定拿到日志。
	_ = os.MkdirAll(edgedirs.DataDir, 0o755)
	logFile, logErr := os.OpenFile(filepath.Join(edgedirs.DataDir, "supervisor.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	var w io.Writer = os.Stderr
	if logErr == nil {
		w = io.MultiWriter(logFile, os.Stderr)
	}
	log := slog.New(slog.NewJSONHandler(w, nil))

	// --install / --uninstall 子命令
	if len(os.Args) >= 2 {
		switch os.Args[1] {
		case "--install":
			opts := parseInstallOptions(os.Args[2:])
			if err := opts.Validate(); err != nil {
				log.Error("--install 参数错误", "err", err)
				fmt.Fprintf(os.Stderr, "Usage: ongrid-edge-supervisor.exe --install --token <X> --cloud-addr <host:port> --access-key <X> [--collector-mode off] [--plugin-bin-dir <P>] [--plugin-work-dir <P>] [--scrape-config-file <P>] [--tls-ca-file <P>] [--tls-server-name <X>]\n")
				os.Exit(2)
			}
			if err := runInstall(log, opts,
				install.NewSecretStore(filepath.Join(edgedirs.DataDir, secretsFileName)),
				install.NewServiceController(serviceName),
				install.NewEnvWriter(serviceRegKeyPath),
			); err != nil {
				log.Error("install failed", "err", err)
				os.Exit(1)
			}
			return
		case "--uninstall":
			if err := runUninstall(log,
				install.NewServiceController(serviceName),
				install.NewSecretStore(filepath.Join(edgedirs.DataDir, secretsFileName)),
			); err != nil {
				log.Error("uninstall failed", "err", err)
				os.Exit(1)
			}
			return
		case "--version", "-v":
			fmt.Fprintf(os.Stdout, "ongrid-edge-supervisor %s\n", version)
			return
		case "--upgrade":
			//   trigger：写 sentinel + os.Exit(0) 让 SCM 重启
			// supervisor → BootCheck 检测 sentinel → SupervisorSelfSwap。
			// 见 upgrade_windows.go runUpgrade 文档。
			if err := runUpgrade(log, edgedirs.StageDir); err != nil {
				log.Error("--upgrade failed", "err", err)
				os.Exit(1)
			}
			os.Exit(0)
		case "--help", "-h":
			fmt.Fprintf(os.Stdout, "Usage:\n")
			fmt.Fprintf(os.Stdout, "  ongrid-edge-supervisor.exe --install --token <X> --cloud-addr <host:port> --access-key <X> [--collector-mode off] [--plugin-bin-dir <P>] [--plugin-work-dir <P>] [--scrape-config-file <P>] [--tls-ca-file <P>] [--tls-server-name <X>]\n")
			fmt.Fprintf(os.Stdout, "  ongrid-edge-supervisor.exe --uninstall\n")
			fmt.Fprintf(os.Stdout, "  ongrid-edge-supervisor.exe --upgrade  (write sentinel + exit; SCM restart triggers SelfSwap)\n")
			fmt.Fprintf(os.Stdout, "  ongrid-edge-supervisor.exe (run as Windows Service)\n")
			return
		}
	}

	isSvc, err := svc.IsWindowsService()
	if err != nil {
		log.Error("detect windows service context failed", "err", err)
		os.Exit(1)
	}

	if !isSvc {
		// 开发调试模式：直接跑 worker（不通过 SCM）。
		log.Info("running in interactive mode; starting worker directly (dev mode)")
		if err := runWorkerOnly(log); err != nil {
			log.Error("interactive worker exited with error", "err", err)
			os.Exit(1)
		}
		return
	}

	h := &serviceHandler{log: log}
	if err := svc.Run(serviceName, h); err != nil {
		log.Error("service Run failed", "err", err)
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/ongrid-edge-supervisor/service.go`
```
// service.go 实现 Windows Service 的 svc.Handler 接口。
// serviceHandler.Execute 是 SCM 调用的入口：
//   - 启动 worker supervisor goroutine（superviseWorker）
//   - 接受 Stop / Shutdown 请求，优雅取消 ctx，等 worker 退出
//   - worker supervisor 异常退出 → 服务停止 + 报告错误码（依赖 SCM recovery action 重启）

//go:build windows

package main

import (
	"context"
	"errors"
	"log/slog"

	"github.com/ongridio/ongrid/internal/edgeagent/edgedirs"
	"github.com/ongridio/ongrid/internal/edgeagent/install"
	"github.com/ongridio/ongrid/internal/edgeagent/upgrademachine"
	"golang.org/x/sys/windows/svc"
)

// serviceHandler 实现 svc.Handler。
type serviceHandler struct {
	log *slog.Logger
}

// Execute 是 SCM 调用的服务主循环。返回 (samesession, exitCode)：
//   - samesession=true 表示非致命错误，SCM 不重启（用于 graceful shutdown）
//   - samesession=false 表示需要 SCM 介入（按 recovery action 决定是否重启）
//
// worker 挂了 supervisor 自动重启（superviseWorker 内部循环），只有
// supervisor 自身循环异常退出才返回 samesession=false。
// Upgrade boot hooks：
//  1. maybeRollbackOnBoot — 先回滚未健康的升级（上次 swap 后 worker 没活过 180s）
//  2. maybeApplyOnBoot — 再 apply 残留的 pending bundle（断电恢复）
func (h *serviceHandler) Execute(_ []string, req <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	status <- svc.Status{State: svc.StartPending, Accepts: 0}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// upgrade boot hook：rollback 不健康升级 → apply 残留 pending bundle
	// → supervisor self-swap
	m := upgrademachine.NewMachine(
		edgedirs.StageDir, edgedirs.BinDir,
		h.log, &windowsProcessController{},
	)
	// stage 目录 ACL 运行期门控（fail-closed）：升级 bundle 无签名，完整性
	// 依赖 StageDir 的 ACL（install 时已收紧）。树级校验（VerifyTreeACL）：
	// 顶层目录 ACL 正确不代表子项正确——pending / incoming / 哨兵文件的
	// DACL 可被持 WRITE_DAC 的主体事后放宽，消费前逐项复验。校验失败只
	// 关闭升级消费，不影响 rollback。
	m.SetStageDirGuard(func() error {
		return install.VerifyTreeACL(edgedirs.StageDir)
	})
	if err := m.BootCheck(ctx); err != nil {
		if errors.Is(err, upgrademachine.ErrSupervisorRestartSoon) {
			// supervisor self-swap 完成 — 必须在 worker goroutine 启动前退出，
			// 让 SCM 按 recovery action 重启加载新 supervisor.exe。
			// exitCode=1（非 0）让 SCM 视为 failure → 触发 restart action；
			// exitCode=0 会被视为"正常停止"→ SCM 不 restart。
			// crash-equivalent exit：不手动发 StopPending/Stopped。
			// Go svc wrapper（vendor/.../svc/service.go:276）在 handler return 后
			// 用返回的 exitCode 发唯一一个 Stopped → SCM 收到 Win32ExitCode=1 →
			// 走 crash-equivalent 快速检测路径。手动发 Stopped 会先锁定
			// Win32ExitCode=0（wrapper 初始 ec.errno=0，vendor service.go:238），
			// 导致 SCM 走 non-crash 慢路径（~3m45s 才 restart， 实测）。
			h.log.Info("supervisor self-swap done; exiting for SCM restart")
			return false, 1 // samesession=false + 非0 exitCode → SCM restart
		}
		h.log.Error("upgrade: BootCheck failed", "err", err)
		// 不中止启动 — rollback/apply 失败不阻塞 supervisor 运行
	}

	workerExit := make(chan error, 1)
	go func() {
		workerExit <- superviseWorker(ctx, h.log, m)
	}()

	// 报告 Running，声明只接受 Stop / Shutdown（不处理 Pause/Continue）。
	status <- svc.Status{
		State:   svc.Running,
		Accepts: svc.AcceptStop | svc.AcceptShutdown,
	}

	for {
		select {
		case cr := <-req:
			switch cr.Cmd {
			case svc.Interrogate:
				// SCM 周期性 ping 检查服务存活，回显当前状态。
				status <- cr.CurrentStatus
			case svc.Stop, svc.Shutdown:
				h.log.Info("service stop requested", "cmd", cr.Cmd)
				status <- svc.Status{State: svc.StopPending, Accepts: 0}
				cancel()
				if err := <-workerExit; err != nil {
					h.log.Error("worker supervisor exit on stop", "err", err)
				}
				status <- svc.Status{State: svc.Stopped, Accepts: 0}
				return false, 0
			default:
				h.log.Warn("unsupported service command", "cmd", cr.Cmd)
			}
		case err := <-workerExit:
			// superviseWorker 返回 ErrSupervisorRestartSoon = supervisor self-swap 完成。
			// 返回 false, 1 让 SCM 视为 failure → 触发 recovery restart 加载新 supervisor.exe。
			// crash-equivalent exit：同 BootCheck 路径，不手动发 Stopped。
			// 手动发会锁定 Win32ExitCode=0 → SCM non-crash 慢路径。
			// 让 wrapper 用 return exitCode=1 发唯一 Stopped → Win32ExitCode=1 → 快速 restart。
			if errors.Is(err, upgrademachine.ErrSupervisorRestartSoon) {
				h.log.Info("supervisor self-swap done (worker path); exiting for SCM restart")
				return false, 1
			}
			// worker supervisor 异常退出（ctx 未取消）= 真异常。
			if ctx.Err() != nil {
				return false, 0
			}
			h.log.Error("worker supervisor unexpected exit", "err", err)
			status <- svc.Status{State: svc.Stopped, Accepts: 0}
			return false, 1
		}
	}
}

```

### Core Architecture Module: `cmd/ongrid-edge-supervisor/upgrade_windows.go`
```
// upgrade_windows.go 定义 Windows 专属的进程控制器 + 升级超时常量。
// 升级编排逻辑（applyAndSwap、maybeApply/maybeRollback、watchUpgradeHealth、
// rollbackAndMark、checkPendingUpgrade）已移至 upgrademachine.Machine。
// 本文件仅保留 Windows 平台的 taskkill 实现和超时常量。

//go:build windows

package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"github.com/ongridio/ongrid/internal/edgeagent/upgrademachine"
)

// upgradeWatchTimeout 是 swap 后等待新 worker register_edge 成功的窗口。
// 超过此时间 healthy_marker 仍未匹配 → rollback（对称 Linux 180s watchdog）。
const upgradeWatchTimeout = 180 * time.Second

// upgradePollInterval 是 Machine.HealthPoll 轮询 IsUpgradeHealthy 的间隔
// （HealthPoll redesign：HealthCheck → HealthPoll，仅 polling 不再持 timer）。
const upgradePollInterval = 5 * time.Second

// windowsProcessController 实现 upgrademachine.ProcessController 接口。
// 用 Windows taskkill 终止进程树和按镜像名杀进程。
type windowsProcessController struct{}

// taskkillExe 返回 taskkill.exe 的绝对路径（%SystemRoot%\System32）。
// supervisor 以 SYSTEM 运行并继承系统 PATH；第三方软件注入的用户可写目录
// 若在 PATH 中，相对名解析会以 LocalSystem 执行被劫持的副本。
func taskkillExe() (string, error) {
	root := os.Getenv("SystemRoot")
	if root == "" {
		root = os.Getenv("windir")
	}
	if root == "" {
		return "", fmt.Errorf("SystemRoot environment variable not set; cannot resolve taskkill.exe")
	}
	p := filepath.Join(root, "System32", "taskkill.exe")
	if _, err := os.Stat(p); err != nil {
		return "", fmt.Errorf("taskkill.exe not found at %s: %w", p, err)
	}
	return p, nil
}

// KillTree 用 taskkill /T /F /PID 终止 pid 及其所有子进程
// （windows_exporter / promtail 等），释放 .exe 文件锁。
// 进程已退出时 taskkill 返回非零退出码，调用方应忽略错误（幂等）。
func (windowsProcessController) KillTree(pid int) error {
	exe, err := taskkillExe()
	if err != nil {
		return err
	}
	return exec.Command(exe, "/T", "/F", "/PID", strconv.Itoa(pid)).Run()
}

// KillByImage 用 taskkill /F /IM <name> 按镜像名杀进程。
// 解决场景：worker 干净退出后子进程（windows_exporter.exe 等）被
// orphaned（reparented to PID 1），KillTree 无法触达。
// 幂等：进程不存在时 taskkill 返回非零，调用方忽略。
//
// 系统镜像黑名单兜底：kill 按镜像名全局匹配，
// 与调用方白名单（KillManifestExes）互为异源防线 — 此层挡所有调用点的
// 系统关键进程误杀/恶意杀，命中即显式拒绝（不静默跳过）。
func (windowsProcessController) KillByImage(name string) error {
	if upgrademachine.IsProtectedSystemImage(name) {
		return fmt.Errorf("refusing to kill protected system image %q", name)
	}
	exe, err := taskkillExe()
	if err != nil {
		return err
	}
	return exec.Command(exe, "/F", "/IM", name).Run()
}

// runUpgrade 写 supervisor_upgrade.pending sentinel 触发 SCM 重启升级流程。
// 端到端流程（由调用方 os.Exit(0) + SCM recovery action 串联）：
//  1. supervisor.exe --upgrade 调本函数写 sentinel + os.Exit(0)
//  2. SCM 视 supervisor 进程退出，按 recovery action 重启
//  3. 新 supervisor 启动 → serviceHandler.Execute → BootCheck 检测 sentinel
//  4. BootCheck 触发 SupervisorSelfSwap → 完成 rename-aside 后返回
//     ErrSupervisorRestartSoon → supervisor 再 exit(1) 让 SCM 再次 restart
//  5. 最终加载新 supervisor.exe，升级闭环
//
// sentinel version 参数传空 —— applyOne 已 stage supervisor.exe.new 时
// supervisor 的真实版本由 BootCheck 从 supervisor.exe.new 自身读取，
// sentinel 内容非必要。
// 幂等：WriteSupervisorUpgradePending 用 os.WriteFile 覆盖写，
// 多次调用不报错（用于 --upgrade 重复触发场景）。
func runUpgrade(log *slog.Logger, stageDir string) error {
	log.Info("supervisor upgrade pending, exiting for SCM restart",
		"stage_dir", stageDir)
	if err := upgrademachine.WriteSupervisorUpgradePending(stageDir, ""); err != nil {
		return fmt.Errorf("--upgrade write supervisor pending sentinel: %w", err)
	}
	return nil
}

```

### Core Architecture Module: `cmd/ongrid-edge-supervisor/worker.go`
```
// worker.go 实现 supervisor.exe 对 worker.exe 的启动 + 监控 + 心跳 watchdog
// （仅做"崩溃重启 + 心跳超时 kill 重启"，bundle upgrade 流程由
// upgrademachine 状态机驱动）。
//
// 健康感知走 health.json 文件 IPC：
//   - worker 每 30s 写一次心跳
//   - supervisor 每 30s 读 + 判断超时（90s 阈值，3× 心跳间隔）
//   - 超时 → kill worker → superviseWorker 外层循环重启

//go:build windows

package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"time"

	"github.com/ongridio/ongrid/internal/edgeagent/edgedirs"
	"github.com/ongridio/ongrid/internal/edgeagent/supervisorhealth"
	"github.com/ongridio/ongrid/internal/edgeagent/upgrademachine"
)

// 部署路径常量统一在 internal/edgeagent/edgedirs 包，与 cmd/ongrid-edge
// 共享。
//
// 重启间隔是 worker 异常退出后的固定等待时间。
//
//	不做指数退避（YAGNI）；后续如需要再加资源限制 / 指数退避。
const (
	restartDelay      = 5 * time.Second
	workerKillTimeout = 10 * time.Second
)

// workerExe 返回 worker.exe 的绝对路径（edgedirs.BinDir + 文件名）。
func workerExe() string {
	return edgedirs.BinDir + `\` + edgedirs.WorkerBinary
}

// runWorkerOnly 是交互模式（非 Service）入口，直接启动 worker。
// 用于开发调试（RDP 跑 supervisor.exe 看日志）。
func runWorkerOnly(log *slog.Logger) error {
	ctx, cancel := signalInterruptContext()
	defer cancel()
	m := upgrademachine.NewMachine(
		edgedirs.StageDir, edgedirs.BinDir,
		log, &windowsProcessController{},
	)
	return superviseWorker(ctx, log, m)
}

// signalInterruptContext 返回一个在 Ctrl+C 时 cancel 的 ctx。
// 仅用于交互模式（runWorkerOnly）；服务模式由 SCM Stop 回调 cancel。
func signalInterruptContext() (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt)
	go func() {
		<-ch
		cancel()
	}()
	return ctx, cancel
}

// superviseWorker 是 supervisor 主循环：启动 worker → 监控 → 异常退出则等待
// restartDelay 后重启。ctx 取消时优雅停止 worker 并返回 ctx.Err。
//
// upgrade 集成：
//
//   - errUpgradeApplied → 跳过 restartDelay 立即重启 + 下一轮进入 upgrade watch
//
//   - rollback.done sentinel 存在 → 跳过 upgrade watch（避免死循环）
//
//   - watchDeadline 到期 + worker 已退出（空窗）→ RollbackAndMark（在文件锁
//     释放后的空窗执行，rename 可成功）
//
//   - 超时回滚后若 supervisor 自升级待恢复（awaiting_health 哨兵），
//     保留哨兵 + return ErrSupervisorRestartSoon → SCM 重启 → BootCheck 恢复 .old
//
// 设计要点：rollback 决策放在本函数循环顶部，而非 HealthPoll goroutine 内
// 的 timer 触发。两个原因：
//   - HealthPoll 若持 workerCtx，worker 崩溃连锁取消 workerCtx 时
//     timer.C 分支永不触发 → RollbackAndMark 永不执行（crash loop 场景）。
//   - worker 仍运行时调 RollbackAndMark → os.Rename 撞
//     Windows image section 文件锁。
//
// 移到 superviseWorker 循环顶部（runWorkerOnce 返回 = worker.exe 已退出）后：
// watchDeadline 由 superviseWorker 持有（免疫 workerCtx 连锁取消），且 worker.exe
// 文件锁已释放（rename 可成功）。
//
// shouldRollbackAfterDeadline 是 superviseWorker 循环顶部 rollback 判定的纯函数
// 抽象，抽出主要为可测性 — superviseWorker 本身需要起 worker 子进程
// 无法在 unit test 跑，但 rollback 决策逻辑（4 条件 AND）可以独立验证。返回 true
// 当且仅当：watchUpgrade 已激活 + watchDeadline 已武装 + 当前时刻已过 deadline +
// 升级未确认健康（IsUpgradeHealthy=false）。superviseWorker 在 runWorkerOnce 返回
// （= worker.exe 已退出空窗）时调用此函数判定是否触发 RollbackAndMark。
func shouldRollbackAfterDeadline(stageDir string, watchUpgrade bool, watchDeadline, now time.Time) bool {
	if !watchUpgrade || watchDeadline.IsZero() {
		return false
	}
	if !now.After(watchDeadline) {
		return false
	}
	return !upgrademachine.IsUpgradeHealthy(stageDir)
}

// maxRollbackRetries 是回滚失败告警阈值。连续失败达到此
// 值时发恰好一次终态告警；重试本身不设上限（见 rollbackAlertDecision 注释）。
const maxRollbackRetries = 3

// rollbackAlertDecision 报告回滚失败后是否发终态告警，
// 对称 shouldRollbackAfterDeadline 的纯函数先例：恰好 failures ==
// maxRollbackRetries 时 true（恰好一次，防告警风暴），之前/之后均 false。
//
// 设计裁决：重试在 watch 保留期间**不设
// 上限**——每轮循环顶空窗重试一次 RollbackAndMark（rename 幂等且廉价，AV/EDR
// 持锁通常短暂，锁释放即自愈收敛）。曾评估的两个替代方案均劣：
//   - 达上限停止重试：锁释放后也不自愈（skip 阻止后续 rename 尝试），
//     纯 worker 升级场景（无 awaiting_health 哨兵）无任何机制重启 supervisor
//     → BootCheck 年龄兜底不可达 → 永久振荡静默态
//   - 达上限 exit(1) 换 SCM 重启上下文重试：锁永持时 4min 级 supervisor 重启
//     循环，且 SCM recovery 配置可能有失败上限（服务最终停止，伤害扩大）
//
// 告警上报通道偏差：supervisor 进程无 manager RPC 客户端
// （网络栈属 worker 进程），告警落地为调用点的 log.Error 结构化告警
// （supervisor.log + Windows 事件日志采集链路可达）；未来加通道时决策
// 语义不变，仅换上报动作。
func rollbackAlertDecision(failures int) bool {
	return failures == maxRollbackRetries
}

func superviseWorker(ctx context.Context, log *slog.Logger, m *upgrademachine.Machine) error {
	// BootCheck 检测到 supervisor_selfswap_awaiting_health
	// sentinel 时设 pendingHealthCheck=true → superviseWorker 启用 upgrade watch，
	// 启 worker 后跑 HealthPoll 180s grace 确认健康（健康判定发生在 worker
	// 实际启动后，避免在 worker 有机会写健康标记前误回滚）。
	watchUpgrade := m.PendingHealthCheck()
	// watchDeadline 是 upgrade watch 窗口的截止时刻。零值 = 未武装。
	// 首次进入 watch 模式时武装（now + upgradeWatchTimeout），runWorkerOnce 读取
	// 它在到期时 cancel worker，让本循环顶部在空窗判定 rollback。
	var watchDeadline time.Time
	if watchUpgrade {
		log.Info("upgrade: watch armed from pendingHealthCheck (supervisor self-swap awaiting health)")
	}
	// rollbackFailures 是 RollbackAndMark 连续失败计数。
	// 告警决策见 rollbackAlertDecision；回滚成功、watch 卸载、进入新升级周期
	// （ErrApplied）时复位 — 每个升级窗口的告警预算独立。
	var rollbackFailures int
	for attempt := 0; ; attempt++ {
		// rollback.done sentinel → 上次 rollback 过，本轮不 watch
		if upgrademachine.RollbackDoneExists(edgedirs.StageDir) {
			if watchUpgrade {
				log.Info("upgrade: rollback.done sentinel present; disarming watch")
				rollbackFailures = 0
			}
			watchUpgrade = false
			watchDeadline = time.Time{}
		}

		// 武装 watchDeadline（首次进 watch 模式 / ErrApplied 重启后）
		if watchUpgrade && watchDeadline.IsZero() {
			watchDeadline = time.Now().Add(upgradeWatchTimeout)
			log.Info("upgrade: watch deadline armed", "timeout", upgradeWatchTimeout, "deadline", watchDeadline)
		}

		err := runWorkerOnce(ctx, log, watchUpgrade, watchDeadline, m)

		if errors.Is(err, upgrademachine.ErrApplied) {
			// swap 完成 → 检查是否需要 supervisor 自升级
			//（bundle 含 supervisor.exe 时 applyOne 写 pending sentinel）
			if upgrademachine.IsSupervisorUpgradePending(edgedirs.StageDir) {
				log.Info("supervisor self-swap pending; triggering rename-aside")
				swapErr := m.SupervisorSelfSwap()
				if errors.Is(swapErr, upgrademachine.ErrSupervisorRestartSoon) {
					return swapErr // 让 service.go 触发 SCM restart 加载新 supervisor
				}
				if swapErr != nil {
					log.Error("supervisor self-swap failed (worker continues with current supervisor; HealthPoll will catch version mismatch)",
						"err", swapErr)
				}
			}
			// 立即重启新 worker + 进入 upgrade watch；watchDeadline 下轮重新武装。
			// 新升级周期 → 失败计数复位。
			log.Info("upgrade applied; restarting worker without delay")
			watchDeadline = time.Time{}
			watchUpgrade = true
			rollbackFailures = 0
			continue
		}

		// runWorkerOnce 返回 = worker.exe 已退出
		// 空窗。若 watch 窗口已到期 + 不健康 → 在此处 RollbackAndMark（worker.exe
		// 文件锁已释放，os.Rename 不再撞 image section）。
		//
		// TOCTOU 不变式：shouldRollbackAfterDeadline 内部
		// 读 IsUpgradeHealthy 与下面的 RollbackAndMark 写之间存在理论竞态窗口，
		// 但 worker 已退出（runWorkerOnce 返回的先验条件）= 唯一可能写 healthy_marker
		// 的进程已死 = 无并发 fs 写入 = TOCTOU 不可达。未来若加 manager RPC 远程写
		// healthy_marker 的能力，此不变式需重新评估。
		if shouldRollbackAfterDeadline(edgedirs.StageDir, watchUpgrade, watchDeadline, time.Now()) {
			// 编排顺序约束：终止进程 → 等 worker 退出 → 回滚。
			// 本块处于 runWorkerOnce 返回之后（worker.exe 已退出空窗，文件锁已释放），
			// RollbackAndMark 是纯文件操作（upgrademachine.Rollback 无进程探测）—
			// 「先杀后回滚」的顺序由本编排层保证；BootCheck 强制双恢复分支的
			// KillByImage → RollbackAndMark 顺序由 dualrestore 测试锚定。
			if rerr := m.RollbackAndMark(); rerr != nil {
				// 回滚失败保留 watch 武装与哨兵，循环顶持续重试
				// （不设上限，见 rollbackAlertDecision 注释的方案裁决）。达阈值告警
				// 恰好一次；此后失败日志降频 Debug（每轮空窗一次，Error 会刷屏）。
				rollbackFailures++
				if rollbackAlertDecision(rollbackFailures) {
					log.Error("ALERT: upgrade rollback keeps failing; manual intervention may be required",
						"failures", rollbackFailures, "threshold", maxRollbackRetries, "err", rerr)
				}
				if rollbackFailures <= maxRollbackRetries {
					log.Error("upgrade: rollback after deadline failed; will retry at loop top",
						"err", rerr, "attempt", rollbackFailures)
				} else {
					log.Debug("upgrade: rollback retry still failing (degraded log)",
					
```

### Core Architecture Module: `cmd/ongrid-edge/capabilities_linux.go`
```
//go:build linux

package main

import (
	"log/slog"

	edgebash "github.com/ongridio/ongrid/internal/edgeagent/bash"
	edgehostfiles "github.com/ongridio/ongrid/internal/edgeagent/host_files"
	edgerestartservice "github.com/ongridio/ongrid/internal/edgeagent/restart_service"
	"github.com/ongridio/ongrid/internal/pkg/tunnel"
)

// registerEdgeCapabilities registers the platform-specific edge capability
// handlers with the tunnel client. Linux side: host_files / restart_service
// / bash. The Windows counterpart (capabilities_windows.go) registers
// host_files only — bash and restart_service depend on cmdpolicy/systemd,
// which are Linux-only.
//
// All Register calls are soft-fail: the edge keeps booting and the
// operator sees a warning in the log when a capability is disabled. A
// single failing skill must not take down the whole agent.
func registerEdgeCapabilities(client tunnel.Client, log *slog.Logger) {
	if err := edgehostfiles.Register(client, log); err != nil {
		log.Warn("host_files register failed; capability disabled", slog.Any("err", err))
	}
	if err := edgerestartservice.Register(client, log); err != nil {
		log.Warn("restart_service register failed; capability disabled", slog.Any("err", err))
	}
	if err := edgebash.Register(client, log); err != nil {
		log.Warn("bash register failed; capability disabled", slog.Any("err", err))
	}
}

```

### Core Architecture Module: `cmd/ongrid-edge/capabilities_windows.go`
```
//go:build windows

package main

import (
	"log/slog"

	edgehostfiles "github.com/ongridio/ongrid/internal/edgeagent/host_files"
	"github.com/ongridio/ongrid/internal/pkg/tunnel"
)

// registerEdgeCapabilities registers the platform-specific edge capability
// handlers with the tunnel client. Windows: host_files only (the package
// itself is cross-platform after the build-tag split).
//
// bash / restart_service are Linux-only (cmdpolicy/systemctl) and are not
// ported to Windows. Windows-native equivalents are future work and need
// a PowerShell subprocess framework.
//
// All Register calls are soft-fail: the edge keeps booting and the
// operator sees a warning in the log when a capability is disabled.
func registerEdgeCapabilities(client tunnel.Client, log *slog.Logger) {
	if err := edgehostfiles.Register(client, log); err != nil {
		log.Warn("host_files register failed; capability disabled", slog.Any("err", err))
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #377** (2026-09-04): **fix(web): 修复浅色模式下抓包统计区和执行日志深色残留**
  *Symptoms*: ## 问题  在浅色模式下存在两处明显的主题残留：  1. 抓包会话详情页顶部统计区仍显示为深色背景，文字对比度异常。 2. 工具页抓包任务的执行日志仍固定使用深色 xterm 主题，与页面浅色主题不一致。  ## 原因初判  - 抓包统计项使用 `bg-zinc-900/90`，全局 light-mode 映射未覆盖 `/90` 透明度变体。 - `XTerminal` 使用固定深色 `ITheme`，未读取当前主题。  ## 期望  - 抓包会话统计区在 light/dark 模式下均符合现有 Card 视觉规范。 - 只读执行日志跟随当前主题，同时保持 ANSI 状态色的可读性。 - 不影响 WebSSH 等交互式终端的现有行为。  ## 验证  - 相关单元测试通过。 - 对抓包会话详情和工具执行日志分别进行 light/dark 截图验证。

- **Issue #331** (2026-08-20): **Agent context, approval, tool-budget, and packet-capture regressions**
  *Symptoms*: ## Environment  - Service: Ongrid manager and Web UI - Affected version: v0.13.3 - Deployment: production-shaped Docker Compose, graph Agent kernel  ## Reproduction  1. Continue a diagnostic chat that already identified a device and ask a follow-up question. 2. Trigger an operation that requires human approval outside the packet-capture path. 3. Ask the Agent to perform more than four evidence queries in one user turn, including an English-locale request. 4. Start a packet capture, stop and save it, then refresh the session concurrently. 5. Open a packet artifact on a short-height screen and try to reach the Hex pane.  ## Actual behavior  - Follow-up turns can lose semantic context and ask for `device_id` again. - Approval-required tools do not consistently surface the confirmation card. - The Agent stops after four tool calls and may paste raw tool JSON into the final answer. - Tool-call accounting can incorrectly behave like a conversation-wide or aggregate budget. - Concurrent capture refresh can race during artifact publication and delete the retained PCAP. - The packet viewer clips the Hex pane on short screens because no vertical scroll boundary is available.  ## Expected behavior  - Preserve conversation semantics while keeping the current Agent state machine. - Apply the same approval gate to every operation that requires confirmation. - Limit repeated use per tool to 10 calls per user turn, with no aggregate all-tools cap, and let the LLM synthesize safe localized ou

- **Issue #311** (2026-09-04): **bug(chatruntime): persist every tool response before the next model turn**
  *Symptoms*: **环境**：测试环境 Graph agent runtime  **复现步骤**： 1. 默认助理处理按主机名查询 Docker 镜像的请求。 2. 模型先发出 `query_devices` tool call 以解析设备 ID。  **期望行为**： `query_devices` 执行并持久化真实 tool response，下一轮模型基于 `device_id` 调用 `host_bash`。  **实际行为**： 下一轮 ChatModel 在前一工具的 `OnStart/OnEnd` 回调之前开始；`flushIncompleteBatch` 立即写入 autoheal 占位失败，模型误以为 `query_devices` 不可用。  **证据**： 会话 `9c8d0401-3298-4367-b75a-af378783d7e0`。日志显示 iteration 1 的 `tool_calls_emitted=1` 后直接进入 iteration 2，且 `batch_age_ms=0` 即被 autoheal；没有对应 query_devices 的 graph tool stage。  **严重程度**：P1  **修复方向**： 检查 ToolsNode callback 生命周期及 batch flush 时机；禁止在同一 ReAct 工具批次尚未完成时按“丢失”补写占位结果。
  **Post-Mortem & Fix Analysis**:
  > 已在 v0.13.0 修复。  根因是嵌套 ToolsNode 的回调并不保证回传到外层持久化链，导致下一轮模型开始时提前生成 autoheal 占位结果。现在工具结果在 graph adapter 边界同步持久化；worker 同时隔离父回调链，避免运行中的 AgentTool 被错误视为缺失。  回归覆盖：`runtime_worker_test`、`react_test`、`tool_adapter_test` 及 v0.13.0 发布前 CI。

- **Issue #310** (2026-09-04): **bug(aiops): tool loop hints must not carry a previous turn's call budget**
  *Symptoms*: **环境**：Graph agent runtime  **复现步骤**： 1. 在同一会话的一次问答中多次调用 `host_bash`。 2. 发起新的、独立的问题，例如“看看 docker images 有没有能够清理的？”。  **期望行为**： 每个用户消息拥有独立的同工具调用预算；新问题可以再次调用 `host_bash`。  **实际行为**： 运行时将上一问的重复工具调用提示注入下一问。模型把该提示误解为当前问答的调用上限，直接回答“host_bash 已达到调用上限”，没有发起工具调用。  **根因**： `calcDynamicHints` 在新用户消息已经持久化后，仍无条件依据上一问的工具调用生成重复/失败提示。Graph 的真实计数器是每次请求新建的，问题出在跨问答提示泄漏。  **修复方向**： 仅当当前用户明确要求继续或重试上一项工作时，才继承上一问的循环防护提示；独立的新问题不携带任何旧工具预算。  **严重程度**：P1

- **Issue #291** (2026-08-08): **fix(ui): handle optional sidebar settings load failure**
  *Symptoms*: **环境**：current main / Web sidebar  **复现步骤**： 1. 登录后打开任意页面。 2. 使 `GET /api/v1/system-settings?category=ui` 返回网络错误、401 或暂时不可用。 3. 挂载侧栏。  **期望行为**：侧栏忽略该可选升级种子读取失败，其他导航正常可用，前端不产生未处理 Promise rejection。  **实际行为**：`Sidebar` 的请求链没有 rejection handler；Vitest 报告未处理 `ApiError`，真实环境也会在控制台产生未处理拒绝。  **严重程度**：P2  **验收**： - 捕获该可选请求的失败。 - 增加失败路径测试。 - `npm test -- --run` 无 unhandled errors。
  **Post-Mortem & Fix Analysis**:
  > 已在 #292 修复：侧栏将忽略可选基础设施菜单升级设置的读取失败，保留默认导航，并覆盖接口失败路径。  验证： - `cd web && npm test -- --run src/components/Sidebar.test.tsx` - `cd web && npm test -- --run` - `cd web && npm run build` - PR CI 全绿。

- **Issue #286** (2026-08-07): **[Bug] Named-device log and trace queries can repeat without resolving device_id**
  *Symptoms*: **Environment**: test environment, default assistant  **Reproduction**: 1. Ask for recent error/panic/fatal logs on a named device, such as `VM-4-17-ubuntu`. 2. The coordinator receives only the raw observability query tool.  **Expected**: Resolve the device name once with `query_devices`, then query Loki or Tempo with the stable `device_id`.  **Actual**: The model can enumerate speculative hostname/instance/unit labels and issue repeated successful-but-empty queries. `query_traceql` also lacks a `device_id` parameter.  **Severity**: P2  **Fix**: Keep `MaxTurns=30`; expose `query_devices` for direct log/trace intent, add a named-device resolution reminder, and enforce backend device scope for TraceQL.
  **Post-Mortem & Fix Analysis**:
  > 补充：同一修复已覆盖另外两条 Trace 路径，避免共享 service.name 时跨设备混查。  - incident correlation 的 closure 与 BaseTool 均会在存在 device_id 时构造 `resource.device_id && resource.service.name`。 - Incident 详情跳转 Grafana Tempo 时，同时保留 device_id 与 service 过滤。 - 现有助理 query_traceql 已在 PR 中按 device_id 强制注入 TraceQL。  实现已补充到 #285，等待合并。
  > 修复已随 #285 合入 main（`89d4581`），本 issue 已关闭。  默认助理会先用 `query_devices` 解析命名设备，再以稳定 `device_id` 查询 LogQL / TraceQL；Trace 事故关联和 Grafana Tempo 跳转也保留该设备范围。

- **Issue #284** (2026-08-07): **[Bug] query_logql lacks a device_id selector and still documents edge_id**
  *Symptoms*: **环境**：main（AIOps assistant / query_logql）  **复现步骤**： 1. 在已启用日志采集的 Host Device 上产生一条日志。 2. 让助理查询该设备的日志。 3. 查看 `query_logql` 的 schema。  **期望行为**：工具提供可选的 `device_id` 参数，后端将它安全合并为 LogQL 的 `device_id` selector；工具说明和示例使用 Device ID。  **实际行为**：schema 只有原始 `query`，示例仍为 `{edge_id="1"}`。模型必须手写 selector，容易混淆 Edge ID 与稳定的 Device ID，也无法由后端保证查询范围。  **影响**：普通 Host Edge 的 Promtail 日志已带规范 `device_id` 标签，因此该过滤能力可用但没有结构化入口。Kubernetes gateway 日志仍按 cluster/pod 标签查询。  **严重程度**：P2  **关联**：#163（历史日志标签错误）
  **Post-Mortem & Fix Analysis**:
  > Fix PR: #285  Validated on the test environment: - Host Edge `edge_id=5` / Device `device_id=24` rendered Promtail with `external_labels.device_id: "24"`. - Emitted `querylog-device-e2e-20260807 device scope verification` through journald; Loki returned it with `device_id="24"`. - Default-assistant E2E returned the exact line. The persisted audit row for the controlled run recorded `{"query":"{} |= \"querylog-device-e2e-20260807\"","device_id":24,"limit":5}` and succeeded, proving server-side selector injection rather than a handwritten `device_id` selector.  Local verification: `go test ./...`, `go vet ./...`.
  > 已在 #285 修复并合入 main（`89d4581`）。  `query_logql` 现提供可选 `device_id`，后端将其强制合并到 LogQL stream selector，并拒绝冲突范围；工具描述也改为使用稳定 Device ID。

- **Issue #256** (2026-08-10): **AI 工作流发送飞书通知失败 (AI workflow cannot send Lark notification)**
  *Symptoms*: 问题： 通过AI创建工作流，想通过飞书IM发送告警，但是最后告警发送失败，报错如下： node notify (tool): tool send_im_message: send_im_message: no channels configured. Add one under 设置→渠道 first  环境信息： ongrid 已完全删除重装，飞书IM通道配置完成，设备重新接入，Loki日志正常推送，可模拟告警日志，触发告警  诉求： 请老师分析一下告警发送失败的原因，如何解决 
  **Post-Mortem & Fix Analysis**:
  > [ongrid_feishu_error.log](https://github.com/user-attachments/files/30580203/ongrid_feishu_error.log)  <img width="1920" height="879" alt="Image" src="https://github.com/user-attachments/assets/a0f0a739-4e1c-4ce6-8021-1c540edf4bb9" />
  > 原因已确认：工作流的通知节点实际是单向通知投递，应配置在“设置 → 通知”；“设置 → IM”只用于双向会话。此前 AI 生成流程会误选遗留 send_im_message 工具，而该工具实际也走单向通知通道，导致只配置 IM 时出现“no channels configured”。  已在 #275 修复：工作流节点明确命名为“发送通知”，AI 生成与面板不再使用该遗留工具，错误提示改为指向“设置 → 通知”，同时保留已有工作流的兼容执行。

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

### Incident Patch 1: `4e9f2961` (2026-09-30)
**Commit Message**: fix(web): unify header dividers and compact device and tool layouts (#449)

**File**: `web/src/components/ui/PageHeader.test.tsx` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { render, screen, within } from '@testing-library/react';
+import { describe, expect, it } from 'vitest';
+import { PageHeader } from './PageHeader';
+import { Tabs, TabsList, TabsTrigger } from './Tabs';
+
+describe('PageHeader', () => {
+  it('keeps page navigation inside the shared header boundary', () => {
+    render(<Tabs defaultValue="services"><PageHeader title="Services" navigation={
+      <TabsList><TabsTrigger value="services">Service list</TabsTrigger></TabsList>
+    } /></Tabs>);
+    const header = screen.getByRole('banner');
+    expect(within(header).getByRole('tab', { name: 'Service list' })).toBeInTheDocument();
+    expect(within(header).getByRole('tablist').parentElement).toHaveClass('[&>.og-tabs-list]:border-b-0');
+  });
+
+  it('preserves the header and filter layout without navigation', () => {
+    render(<PageHeader title="Tools" extra={<input aria-label="Target" />} />);
+    expect(within(screen.getByRole('banner')).getByRole('textbox', { name: 'Target' })).toBeInTheDocument();
+    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
+  });
+});
```

**File**: `web/src/components/ui/PageHeader.tsx` (modified, +4/-1)
```diff
@@ -13,12 +13,14 @@ type Props = {
   actions?: ReactNode;
   /** Optional content rendered below the title row inside the same header. */
   extra?: ReactNode;
+  /** Page-level tabs share the header's bottom divider. */
+  navigation?: ReactNode;
   /** Optional content rendered above the title (breadcrumb / back link). */
   leading?: ReactNode;
   className?: string;
 };
 
-export function PageHeader({ title, subtitle, actions, extra, leading, className }: Props) {
+export function PageHeader({ title, subtitle, actions, extra, navigation, leading, className }: Props) {
   return (
     <header
       className={cn(
@@ -35,6 +37,7 @@ export function PageHeader({ title, subtitle, actions, extra, leading, className
         {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
       </div>
       {extra && <div className="mt-3">{extra}</div>}
+      {navigation && <div className="mt-3 -mb-4 [&>.og-tabs-list]:border-b-0">{navigation}</div>}
     </header>
   );
 }
```

**File**: `web/src/pages/Alerts.header.test.tsx` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { render, screen, within } from '@testing-library/react';
+import { MemoryRouter } from 'react-router-dom';
+import { expect, it } from 'vitest';
+import { http, HttpResponse } from 'msw';
+import { server } from '@/test/msw-server';
+import Alerts from './Alerts';
+
+it('keeps alert filters and actions inside the shared page header', async () => {
+  localStorage.setItem('ongrid-locale', 'zh-CN');
+  server.use(
+    http.get('/api/v1/alerts/incidents', () => HttpResponse.json({ items: [], total: 0 })),
+    http.get('/api/v1/edges', () => HttpResponse.json({ items: [], total: 0 })),
+  );
+  render(<MemoryRouter><Alerts /></MemoryRouter>);
+  const header = screen.getByRole('banner');
+  expect(within(header).getByRole('heading', { name: '告警' })).toBeInTheDocument();
+  expect(within(header).getByText('状态')).toBeInTheDocument();
+  expect(within(header).getByText('级别')).toBeInTheDocument();
+  expect(within(header).getByRole('link', { name: '规则配置' })).toHaveAttribute('href', '/alerts/rules');
+  expect(within(header).getByRole('button', { name: '刷新' })).toBeInTheDocument();
+});
```

**File**: `web/src/pages/Alerts.tsx` (modified, +10/-17)
```diff
@@ -1,4 +1,4 @@
-import { Button, Label, Textarea } from '@/components/ui';
+import { Button, Label, Textarea, PageHeader } from '@/components/ui';
 import { Hint } from '@/components/ui/Tooltip';
 import { useCallback, useEffect, useMemo, useState } from 'react';
 import { Link, useNavigate } from 'react-router-dom';
@@ -146,10 +146,8 @@ export default function AlertsPage() {
   return (
     <>
       <main className="anim-fade flex flex-1 flex-col overflow-hidden">
-        <header className="app-header border-b border-zinc-800 px-6 py-4">
-          <div className="flex items-center justify-between gap-4">
-            <div>
-              <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
+        <PageHeader
+          title={<span className="flex items-center gap-2">
                 {tr('告警', 'Alerts')}
                 {globalOpen > 0 && (
                   <Hint content={tr('全局未确认告警数 — 跟侧边栏红点同源', 'Global unacknowledged count — same source as the sidebar badge')}><span
@@ -159,15 +157,12 @@ export default function AlertsPage() {
                     {globalOpen} {tr('未确认', 'open')}
                   </span></Hint>
                 )}
-              </h1>
-              <p className="mt-0.5 text-xs text-zinc-500">
-                {tr(
+              </span>}
+          subtitle={tr(
                   `全局 ${globalOpen} 未确认 · 当前筛选 ${total} 条 · 本页 Critical ${counts.critical}`,
                   `${globalOpen} open globally · ${total} in current filter · ${counts.critical} critical on this page`,
                 )}
-              </p>
-            </div>
-            <div className="flex gap-2">
+          actions={<div className="flex gap-2">
               <Link
                 to="/alerts/rules"
                 className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
@@ -183,11 +178,8 @@ export default function AlertsPage() {
                 <RefreshCw size={12} className={cn(refreshing && 'animate-spin')} />
                 {tr('刷新', 'Refresh')}
               </Button>
-            </div>
-          </div>
-        </header>
-
-        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-6 py-3 text-xs text-zinc-400">
+            </div>}
+          extra={<div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
           <FilterGroup
             label={tr('状态', 'Status')}
             options={STATUS_FILTERS.map((o) => ({ key: o.key, label: tr(o.labelZh, o.labelEn) }))}
@@ -206,7 +198,8 @@ export default function AlertsPage() {
               setSeverityFilter(next);
             }}
           />
-        </div>
+        </div>}
+        />
 
         <div className="flex-1 overflow-y-auto">
           {err && (
```

**File**: `web/src/pages/Apm.tsx` (modified, +5/-6)
```diff
@@ -617,15 +617,13 @@ export default function ApmPage() {
                 'Explore service requests, traces, logs and instances',
               )
         }
-        className="!py-3 shrink-0 [&_h1]:break-all"
-      />
-      {!detail && <TabsList activateOnFocus={false} aria-label={tr('服务视图', 'Service views')} className="shrink-0 border-b border-zinc-800 px-6">
+        className="shrink-0 [&_h1]:break-all"
+        navigation={!detail ? <TabsList activateOnFocus={false} aria-label={tr('服务视图', 'Service views')} className="shrink-0">
         {[['services', tr('服务列表', 'Service list')], ['map', tr('服务地图', 'Service map')], ['discovery', tr('服务发现', 'Service discovery')], ['onboarding', tr('接入指南', 'Setup guide')]].map(([value, label]) => <TabsTrigger key={value} value={value} onClick={() => set('tab', value)}>{label}</TabsTrigger>)}
-      </TabsList>}
-      {detail && (
+      </TabsList> : (
         <TabsList activateOnFocus={false}
           aria-label={tr('服务视图', 'Service views')}
-          className="flex shrink-0 flex-wrap items-center gap-x-5 border-b border-zinc-800 px-6"
+          className="flex shrink-0 flex-wrap items-center gap-x-5"
         >
           {tabs.map(([key, label]) => (
             <TabsTrigger key={key} value={key} nativeButton={false} render={<Link state={location.state} to={viewLink(key)} />} >
@@ -644,6 +642,7 @@ export default function ApmPage() {
           </div>
         </TabsList>
       )}
+      />
       <TabsContent value={operation && ['overview', 'operations'].includes(tab) ? 'operations' : tab} className="contents"><main ref={main} className="flex-1 space-y-3 overflow-auto px-6 py-4">
         {(scopeFilters || timeControls) && (
           <div role="group" aria-label={tr('当前视图筛选', 'Current view filters')} className="flex flex-wrap items-center justify-between gap-3">
```

---

### Incident Patch 2: `90d4d6c8` (2026-09-29)
**Commit Message**: fix(ui): align tool target selector and capture empty state (#447)

**File**: `web/src/pages/DailyTools.test.tsx` (modified, +20/-0)
```diff
@@ -80,6 +80,8 @@ describe('DailyToolsPage', () => {
     render(<MemoryRouter><DailyToolsPage /></MemoryRouter>);
 
     expect(await screen.findByRole('combobox', { name: '选择 Edge' })).toBeInTheDocument();
+    expect(screen.getByRole('combobox', { name: '选择 Edge' })).toHaveClass('w-full');
+    expect(screen.getByText('尚未执行工具')).toBeInTheDocument();
     expect(screen.getByLabelText('目标 Host / IP')).toHaveValue('');
     expect(screen.getByRole('button', { name: /^执行$/ })).toBeDisabled();
   });
@@ -132,6 +134,24 @@ describe('DailyToolsPage', () => {
     await act(async () => { await user.keyboard('{Escape}'); });
   });
 
+  it('只有抓包历史时不显示工具空状态，清空后恢复空状态', async () => {
+    localStorage.setItem('ongrid-daily-tools-runs-v1', JSON.stringify({
+      runs: [],
+      captureRuns: [{
+        id: 'capture-only', status: 'ready', title: '保存的抓包', target: 'tcp port 443',
+        edgeLabels: ['#1 edge-001'], startedAt: '2026-08-16T00:00:00Z',
+        captureIDs: [41], link: '/pages?tab=packets',
+        members: [{ id: 41, edgeLabel: '#1 edge-001', state: 'ready', capturedPackets: 8, capturedBytes: 512 }], logs: [],
+      }],
+    }));
+    render(<MemoryRouter><DailyToolsPage /></MemoryRouter>);
+    expect(await screen.findByText('保存的抓包')).toBeInTheDocument();
+    expect(screen.queryByText('尚未执行工具')).not.toBeInTheDocument();
+    await act(async () => { await userEvent.click(screen.getByRole('button', { name: '清空运行' })); });
+    expect(screen.getByText('尚未执行工具')).toBeInTheDocument();
+    expect(screen.queryByText('保存的抓包')).not.toBeInTheDocument();
+  });
+
   it('恢复未清空的运行历史', async () => {
     localStorage.setItem('ongrid-daily-tools-runs-v1', JSON.stringify({
       runs: [{
```

**File**: `web/src/pages/DailyTools.tsx` (modified, +3/-3)
```diff
@@ -839,15 +839,15 @@ export default function DailyToolsPage() {
           ) : <>
             {(runs.length > 0 || captureRuns.length > 0) ? <div className="flex justify-end"><Button onClick={() => { setRuns([]); setCaptureRuns([]); setSelectedResult(null); }}>{tr('清空运行', 'Clear runs')}</Button></div> : null}
             {captureRuns.length > 0 ? <CaptureQuickPanel runs={captureRuns} nowMs={nowMs} onStop={(run) => void stopCapture(run)} onDiscard={(run) => void discardCapture(run)} /> : null}
-          <section className="min-h-[420px]">
+          {runs.length > 0 || captureRuns.length === 0 ? <section className="min-h-[420px]">
             {runs.length === 0 ? (
               <div className="py-20"><EmptyState icon={Activity} title={tr('尚未执行工具', 'No tool runs yet')} hint={tr('选择 Edge 和工具后执行；多次执行会在这里分栏或分页。', 'Select Edges and a tool to run; repeated runs appear here for comparison.')} /></div>
             ) : (
               <div className={cn('grid grid-cols-1 gap-4', workspaceRuns.length > 1 && '2xl:grid-cols-2')}>
                 {workspaceRuns.map((run) => <RunPanel key={run.id} run={run} nowMs={nowMs} onInspect={setSelectedResult} onCancel={(item) => void cancelToolRun(item)} onClose={(id) => closeRun(id, setRuns, setSelectedResult)} />)}
               </div>
             )}
-          </section>
+          </section> : null}
           </>}
         </div>
       </div>
@@ -1025,7 +1025,7 @@ function EdgePicker({
         onInputValueChange={onQuery}
         autoHighlight
       >
-        <Combobox.Trigger className="og-select-trigger" aria-label={label}>
+        <Combobox.Trigger className="og-select-trigger w-full" aria-label={label}>
           <span className={cn('min-w-0 flex-1 truncate text-left', selectedEdges.length === 0 && 'text-text-faint')}>{label}</span>
           <ChevronDown size={14} className="shrink-0 text-text-faint" aria-hidden="true" />
         </Combobox.Trigger>
```

---

### Incident Patch 3: `5f0ffbad` (2026-09-29)
**Commit Message**: fix(mcp): complete inline approval and result continuation (#446)

**File**: `cmd/ongrid/main.go` (modified, +28/-4)
```diff
@@ -2453,7 +2453,11 @@ func main() {
 				for _, mt := range discovered {
 					raw := aiopstools.NewMCPTool(srv.Name, mt.Name, mt.Description, mt.InputSchema, srv.Trusted, mcpCaller, mcpProposer, log)
 					rawTools = append(rawTools, raw)
-					graphTools = append(graphTools, aiopstoolsdec.Wrap(raw, mcpDeps))
+					deps := mcpDeps
+					if !srv.Trusted {
+						deps.Timeout = approvalWaitTimeout + time.Minute
+					}
+					graphTools = append(graphTools, aiopstoolsdec.Wrap(raw, deps))
 				}
 			}
 			chatRT.ReplaceCatalogToolsByNamePrefix(prefix, rawTools)
@@ -4992,8 +4996,11 @@ func (s mcpCallerShim) CallMCPTool(ctx context.Context, server, tool string, arg
 // untrusted path) — same propose-confirm model as cloud_bash.
 type mcpProposerShim struct{ uc *managerbizapproval.Usecase }
 
-func (s mcpProposerShim) ProposeMCPCall(ctx context.Context, server, tool string, args map[string]any, sessionID string, userID uint64) (string, error) {
-	argsJSON, _ := json.Marshal(args)
+func (s mcpProposerShim) ProposeMCPCallAndAwait(ctx context.Context, server, tool string, args map[string]any, sessionID, toolCallID string, userID uint64) (string, error) {
+	argsJSON, err := json.Marshal(args)
+	if err != nil {
+		return "", fmt.Errorf("marshal MCP approval arguments: %w", err)
+	}
 	cmd := server + " / " + tool + " " + string(argsJSON)
 	if len(cmd) > 200 {
 		cmd = cmd[:200] + "…"
@@ -5009,7 +5016,24 @@ func (s mcpProposerShim) ProposeMCPCall(ctx context.Context, server, tool string
 	if err != nil {
 		return "", err
 	}
-	return a.ID, nil
+	if emit := aiopschatruntime.EmitFromContext(ctx); emit != nil {
+		emit(aiopschatruntime.Event{
+			Type: aiopschatruntime.EventApprovalPending,
+			Approval: &aiopschatruntime.ApprovalPending{
+				ApprovalID: a.ID, ToolCallID: toolCallID, Kind: "mcp_call",
+				ToolName: aiopstools.MCPToolName(server, tool), Command: cmd,
+			},
+		})
+	} else if emit := aiopsagent.EmitFromContext(ctx); emit != nil {
+		emit(aiopsagent.Event{
+			Type: aiopsagent.EventApprovalPending,
+			Approval: &aiopsagent.ApprovalPendingEvent{
+				ApprovalID: a.ID, ToolCallID: toolCallID, Kind: "mcp_call",
+				ToolName: aiopstools.MCPToolName(server, tool), Command: cmd,
+			},
+		})
+	}
+	return cloudBashProposerShim{uc: s.uc}.awaitDecision(ctx, a.ID)
 }
 
 type flowToolInvoker struct {
```

**File**: `cmd/ongrid/mcp_approval_runtime_test.go` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+package main
+
+import (
+	"context"
+	"path/filepath"
+	"sync"
+	"testing"
+	"time"
+
+	einomodel "github.com/cloudwego/eino/components/model"
+	"github.com/cloudwego/eino/schema"
+	"github.com/glebarez/sqlite"
+	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
+
+	runtime "github.com/ongridio/ongrid/internal/manager/biz/aiops/chatruntime"
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/graph"
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools"
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
+	approval "github.com/ongridio/ongrid/internal/manager/biz/approval"
+	chatstore "github.com/ongridio/ongrid/internal/manager/data/aiops/store"
+	approvalstore "github.com/ongridio/ongrid/internal/manager/data/approval/store"
+	chatmodel "github.com/ongridio/ongrid/internal/manager/model/aiops"
+)
+
+type mcpReviewModel struct {
+	mu        sync.Mutex
+	turns     int
+	sawResult bool
+}
+
+func (m *mcpReviewModel) Generate(_ context.Context, input []*schema.Message, _ ...einomodel.Option) (*schema.Message, error) {
+	m.mu.Lock()
+	defer m.mu.Unlock()
+	m.turns++
+	if m.turns == 1 {
+		return &schema.Message{Role: schema.Assistant, ToolCalls: []schema.ToolCall{{ID: "call-445", Type: "function", Function: schema.FunctionCall{Name: tools.MCPToolName("test", "cluster.list"), Arguments: `{}`}}}}, nil
+	}
+	for _, msg := range input {
+		if msg.Role == schema.Tool && msg.Content == `{"clusters":["test"]}` {
+			m.sawResult = true
+		}
+	}
+	return &schema.Message{Role: schema.Assistant, Content: "Cluster result received"}, nil
+}
+func (m *mcpReviewModel) Stream(ctx context.Context, input []*schema.Message, opts ...einomodel.Option) (*schema.StreamReader[*schema.Message], error) {
+	msg, err := m.Generate(ctx, input, opts...)
+	if err != nil {
+		return nil, err
+	}
+	return schema.StreamReaderFromArray([]*schema.Message{msg}), nil
+}
+func (m *mcpReviewModel) WithTools([]*schema.ToolInfo) (einomodel.ToolCallingChatModel, error) {
+	return m, nil
+}
+
+func TestMCPApprovalRuntimeResumesWithResult(t *testing.T) {
+	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "runtime.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
+	if err != nil {
+		t.Fatal(err)
+	}
+	sqlDB, err := db.DB()
+	if err != nil {
+		t.Fatal(err)
+	}
+	sqlDB.SetMaxOpenConns(1)
+	t.Cleanup(func() {
+		if err := sqlDB.Close(); err != nil {
+			t.Error(err)
+		}
+	})
+	if err := approvalstore.Migrate(db); err != nil {
+		t.Fatal(err)
+	}
+	if err := chatstore.Migrate(db); err != nil {
+		t.Fatal(err)
+	}
+	uc := approval.NewUsecase(approvalstore.NewRepo(db), nil)
+	uc.RegisterExecutor("mcp_call", func(context.Context, string) (string, error) { return `{"clusters":["test"]}`, nil })
+	repo := chatstore.NewSessionRepoWithAttachmentRoot(db, t.TempDir())
+	sess := &chatmodel.Session{ID: "session-445", UserID: 7}
+	if err := repo.CreateSession(context.Background(), sess); err != nil {
+		t.Fatal(err)
+	}
+	model := &mcpReviewModel{}
+	rt, err := runtime.NewRuntime(runtime.Config{Sessions: repo, ChatModel: model, GraphCfg: graph.Config{MaxIterations: 5}, ToolBag: []basetool.BaseTool{tools.NewMCPTool("test", "cluster.list", "List clusters", nil, false, nil, mcpProposerShim{uc: uc}, nil)}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+	defer cancel()
+	events := make(chan *runtime.ApprovalPending, 2)
+	done := make(chan error, 1)
+	go func() {
+		_, err := rt.Handle(ctx, &runtime.Request{SessionID: sess.ID, UserID: 7, UserText: "List clusters", Emit: func(ev runtime.Event) {
+			if ev.Type == runtime.EventApprovalPending {
+				events <- ev.Approval
+			}
+		}})
+		done <- err
+	}()
+	select {
+	case event := <-events:
+		if event.ToolCallID != "call-445" || event.Kind != "mcp_call" || event.ToolName != tools.MCPToolName("test", "cluster.list") {
+			t.Fatalf("invalid live card: %+v", event)
+		}
+		row, err := uc.Get(ctx, event.Approva
```

**File**: `cmd/ongrid/mcp_approval_test.go` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+package main
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"path/filepath"
+	"strings"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/glebarez/sqlite"
+	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
+
+	approval "github.com/ongridio/ongrid/internal/manager/biz/approval"
+	store "github.com/ongridio/ongrid/internal/manager/data/approval/store"
+)
+
+func TestMCPApprovalLifecycle(t *testing.T) {
+	for _, decision := range []string{"approve", "reject", "failure", "cancel"} {
+		t.Run(decision, func(t *testing.T) {
+			db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "approvals.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
+			if err != nil {
+				t.Fatal(err)
+			}
+			sqlDB, err := db.DB()
+			if err != nil {
+				t.Fatal(err)
+			}
+			sqlDB.SetMaxOpenConns(1)
+			t.Cleanup(func() {
+				if err := sqlDB.Close(); err != nil {
+					t.Error(err)
+				}
+			})
+			if err := store.Migrate(db); err != nil {
+				t.Fatal(err)
+			}
+			uc := approval.NewUsecase(store.NewRepo(db), nil)
+			var executions atomic.Int32
+			uc.RegisterExecutor("mcp_call", func(_ context.Context, payload string) (string, error) {
+				executions.Add(1)
+				var p mcpCallPayload
+				if err := json.Unmarshal([]byte(payload), &p); err != nil {
+					return "", err
+				}
+				if p.Server != "test" || p.Tool != "cluster.list" || p.Arguments["limit"] != float64(20) {
+					return "", errors.New("incorrect frozen payload")
+				}
+				if decision == "failure" {
+					return "", errors.New("remote failed")
+				}
+				return `{"clusters":["test"]}`, nil
+			})
+			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+			defer cancel()
+			type outcome struct {
+				result string
+				err    error
+			}
+			done := make(chan outcome, 1)
+			go func() {
+				result, err := (mcpProposerShim{uc: uc}).ProposeMCPCallAndAwait(ctx, "test", "cluster.list", map[string]any{"limit": 20}, "session-445", "call-445", 7)
+				done <- outcome{result, err}
+			}()
+			var id string
+			for id == "" && ctx.Err() == nil {
+				rows, err := uc.List(ctx, "pending", 10)
+				if err != nil {
+					t.Fatal(err)
+				}
+				if len(rows) > 0 {
+					if rows[0].SessionID != "session-445" || rows[0].ProposedBy != 7 {
+						t.Fatalf("proposal lost session/user: %+v", rows[0])
+					}
+					id = rows[0].ID
+				} else {
+					time.Sleep(10 * time.Millisecond)
+				}
+			}
+			if id == "" {
+				t.Fatal("proposal not created")
+			}
+			select {
+			case got := <-done:
+				t.Fatalf("returned before human decision: %+v", got)
+			default:
+			}
+			if executions.Load() != 0 {
+				t.Fatal("executed before confirmation")
+			}
+			want := `{"clusters":["test"]}`
+			switch decision {
+			case "reject":
+				if err := uc.Reject(ctx, 7, id, "no"); err != nil {
+					t.Fatal(err)
+				}
+				want = `"status":"rejected"`
+			case "cancel":
+				cancel()
+				want = `"status":"cancelled"`
+			default:
+				if _, err := uc.Approve(ctx, 7, id); err != nil {
+					t.Fatal(err)
+				}
+				if _, err := uc.Approve(ctx, 7, id); err == nil {
+					t.Fatal("duplicate approval accepted")
+				}
+				if decision == "failure" {
+					want = "remote failed"
+				}
+			}
+			select {
+			case got := <-done:
+				if got.err != nil || !strings.Contains(got.result, want) {
+					t.Fatalf("unexpected outcome: %+v; want %s", got, want)
+				}
+			case <-time.After(5 * time.Second):
+				t.Fatal("approval did not complete")
+			}
+			wantCalls := int32(1)
+			if decision == "reject" || decision == "cancel" {
+				wantCalls = 0
+			}
+			if executions.Load() != wantCalls {
+				t.Fatalf("executions = %d, want %d", executions.Load(), wantCalls)
+			}
+		})
+	}
+}
```

**File**: `internal/manager/biz/aiops/tools/mcp_basetool.go` (modified, +10/-14)
```diff
@@ -13,6 +13,8 @@ import (
 	"log/slog"
 	"strings"
 
+	"github.com/cloudwego/eino/compose"
+
 	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
 )
 
@@ -21,10 +23,9 @@ type MCPCaller interface {
 	CallMCPTool(ctx context.Context, server, tool string, args map[string]any) (string, error)
 }
 
-// MCPProposer queues an MCP call for human approval (default path), returning
-// the approval id.
+// MCPProposer waits for human approval and returns the executed tool result.
 type MCPProposer interface {
-	ProposeMCPCall(ctx context.Context, server, tool string, args map[string]any, sessionID string, userID uint64) (id string, err error)
+	ProposeMCPCallAndAwait(ctx context.Context, server, tool string, args map[string]any, sessionID, toolCallID string, userID uint64) (string, error)
 }
 
 // MCPTool is the BaseTool wrapping one (server, tool) pair.
@@ -140,18 +141,13 @@ func (t *MCPTool) InvokableRun(ctx context.Context, argsJSON string, opts ...bas
 		return "", fmt.Errorf("mcp %s: approval not wired", t.wireName)
 	}
 	cfg := basetool.ResolveOptions(opts)
-	id, err := t.proposer.ProposeMCPCall(ctx, t.server, t.bareName, args, "", cfg.UserID)
+	toolCallID := compose.GetToolCallID(ctx)
+	if toolCallID == "" {
+		toolCallID = basetool.ToolCallIDFromContext(ctx)
+	}
+	result, err := t.proposer.ProposeMCPCallAndAwait(ctx, t.server, t.bareName, args, basetool.SessionIDFromContext(ctx), toolCallID, cfg.UserID)
 	if err != nil {
 		return "", fmt.Errorf("mcp %s: propose: %w", t.wireName, err)
 	}
-	out := map[string]any{
-		"status":      "pending_approval",
-		"approval_id": id,
-		// LLM-facing instruction (same contract as cloud_bash): the inline
-		// confirmation card is already rendered; don't point at a page or
-		// restate the call.
-		"message": "An interactive confirmation card is now shown inline in this conversation. Do NOT tell the user to open any page or menu, do NOT restate the call, approval id, or a status table. Reply with a single short sentence saying this external MCP action needs the user's confirmation in this conversation before it runs.",
-	}
-	b, _ := json.Marshal(out)
-	return string(b), nil
+	return result, nil
 }
```

**File**: `internal/manager/biz/aiops/tools/mcp_basetool_test.go` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package tools
+
+import (
+	"context"
+	"errors"
+	"testing"
+
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
+)
+
+type mcpApprovalFunc func(context.Context, string, string, map[string]any, string, string, uint64) (string, error)
+
+func (f mcpApprovalFunc) ProposeMCPCallAndAwait(ctx context.Context, server, tool string, args map[string]any, session, call string, user uint64) (string, error) {
+	return f(ctx, server, tool, args, session, call, user)
+}
+
+type mcpCallerFunc func(context.Context, string, string, map[string]any) (string, error)
+
+func (f mcpCallerFunc) CallMCPTool(ctx context.Context, server, tool string, args map[string]any) (string, error) {
+	return f(ctx, server, tool, args)
+}
+
+func TestMCPToolApprovalReturnsResultAndIdentity(t *testing.T) {
+	ctx := basetool.WithToolCallID(basetool.WithSessionID(context.Background(), "session-445"), "call-445")
+	for _, result := range []string{`{"clusters":["test"]}`, `{"status":"rejected"}`, `{"error":"remote failed"}`} {
+		t.Run(result, func(t *testing.T) {
+			proposer := mcpApprovalFunc(func(_ context.Context, server, tool string, args map[string]any, session, call string, user uint64) (string, error) {
+				if server != "test" || tool != "cluster.list" || args["limit"] != float64(20) || session != "session-445" || call != "call-445" || user != 7 {
+					t.Fatalf("incorrect proposal identity: %s %s %v %s %s %d", server, tool, args, session, call, user)
+				}
+				return result, nil
+			})
+			tool := NewMCPTool("test", "cluster.list", "", nil, false, nil, proposer, nil)
+			got, err := tool.InvokableRun(ctx, `{"limit":20}`, basetool.WithUserID(7))
+			if err != nil || got != result {
+				t.Fatalf("got %q, %v; want executor result %q", got, err, result)
+			}
+		})
+	}
+}
+
+func TestMCPToolTrustedAndErrorPaths(t *testing.T) {
+	wantErr := errors.New("approval unavailable")
+	proposer := mcpApprovalFunc(func(context.Context, string, string, map[string]any, string, string, uint64) (string, error) {
+		return "", wantErr
+	})
+	tool := NewMCPTool("test", "cluster.list", "", nil, false, nil, proposer, nil)
+	if _, err := tool.InvokableRun(context.Background(), `{}`); !errors.Is(err, wantErr) {
+		t.Fatalf("proposal error not preserved: %v", err)
+	}
+	if _, err := tool.InvokableRun(context.Background(), `{`); err == nil {
+		t.Fatal("invalid arguments accepted")
+	}
+	caller := mcpCallerFunc(func(context.Context, string, string, map[string]any) (string, error) { return "trusted result", nil })
+	trusted := NewMCPTool("test", "cluster.list", "", nil, true, caller, proposer, nil)
+	if got, err := trusted.InvokableRun(context.Background(), `{}`); err != nil || got != "trusted result" {
+		t.Fatalf("trusted tool unexpectedly required approval: %q %v", got, err)
+	}
+}
```

---

### Incident Patch 4: `b385560b` (2026-09-29)
**Commit Message**: fix(edge): tune telemetry capacity budgets for v0.17.5 (#444)

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

**File**: `README_FR.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choisissez la commande adaptée à l’architecture de votre serveur :
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Chine continentale** — si GitHub est lent, utilisez l’URL du miroir CDN correspondant à votre architecture :
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Tour du produit
```

**File**: `README_JA.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 中国本土ユーザー** — GitHub が遅い場合は、アーキテクチャに合う CDN ミラー URL を使用してください：
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## 製品ツアー
```

---

### Incident Patch 5: `b9b9f57a` (2026-09-28)
**Commit Message**: fix(k8s): preserve capabilities across JVM credential changes

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -52,6 +52,9 @@ jobs:
       - name: go test
         run: go test -race ./...
 
+      - name: Kubernetes JVM attach capabilities
+        run: make test-k8s-capabilities
+
   web-test:
     name: web test + build
     runs-on: ubuntu-24.04
```

**File**: `Makefile` (modified, +11/-0)
```diff
@@ -119,6 +119,17 @@ test: ## 单元测试
 test-race: ## 单元测试 + race
 	go test -race ./...
 
+.PHONY: test-k8s-capabilities
+test-k8s-capabilities: ## 隔离 Linux 环境验证节点 JVM attach 权限（需要 root/sudo）
+	@test "$$(uname -s)" = Linux || { echo 'Linux is required'; exit 1; }
+	@set -eu; tmp_dir=$$(mktemp -d); trap 'rm -rf "$$tmp_dir"' EXIT; \
+	go test -race -c -o "$$tmp_dir/edge.test" ./cmd/ongrid-edge; \
+	if [ "$$(id -u)" = 0 ]; then \
+		env ONGRID_TEST_K8S_CAPABILITIES=1 "$$tmp_dir/edge.test" -test.v -test.timeout=45s -test.run='^TestK8sHostCapabilitiesSurviveJVMAttach$$'; \
+	else \
+		sudo env ONGRID_TEST_K8S_CAPABILITIES=1 "$$tmp_dir/edge.test" -test.v -test.timeout=45s -test.run='^TestK8sHostCapabilitiesSurviveJVMAttach$$'; \
+	fi
+
 .PHONY: test-edge-metrics-env
 test-edge-metrics-env: ## Edge 诊断端口安装配置保留检查
 	bash -n deploy/install/edge/install.sh deploy/install/edge/install-edge.sh
```

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

---

### Incident Patch 6: `6c3827fd` (2026-09-28)
**Commit Message**: fix(k8s): handle auto APM node name mismatches (#434)

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

**File**: `README_FR.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choisissez la commande adaptée à l’architecture de votre serveur :
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Chine continentale** — si GitHub est lent, utilisez l’URL du miroir CDN correspondant à votre architecture :
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Tour du produit
```

**File**: `README_JA.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 中国本土ユーザー** — GitHub が遅い場合は、アーキテクチャに合う CDN ミラー URL を使用してください：
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## 製品ツアー
```

---

### Incident Patch 7: `5e22ec49` (2026-09-24)
**Commit Message**: fix(k8s): remove the node auto APM capability switch (#432)

**File**: `cmd/ongrid-edge/k8s_host_runtime.go` (modified, +5/-8)
```diff
@@ -52,14 +52,17 @@ func runK8sHostCommand(ctx context.Context, args []string) (bool, error) {
 		if err != nil {
 			return true, fmt.Errorf("resolve edge executable: %w", err)
 		}
-		return true, installK8sHostRuntime(ctx, k8sHostInstallPaths{
+		if err := installK8sHostRuntime(ctx, k8sHostInstallPaths{
 			hostRoot:             args[1],
 			edgeSource:           executable,
 			pluginSourceDir:      containerPluginDir,
 			serviceAccountSource: containerServiceAccountDir,
 			uid:                  uid,
 			gid:                  gid,
-		})
+		}); err != nil {
+			return true, err
+		}
+		return true, prepareK8sOBIFilesystem(ctx, args[1], uid, gid)
 	case enterK8sHostCommand:
 		if len(args) != 4 {
 			return true, fmt.Errorf("usage: %s <host-root> <uid> <gid>", enterK8sHostCommand)
@@ -108,12 +111,6 @@ func installK8sHostRuntime(ctx context.Context, paths k8sHostInstallPaths) error
 	if !info.IsDir() {
 		return fmt.Errorf("host root %q is not a directory", paths.hostRoot)
 	}
-	if os.Getenv("ONGRID_AUTO_APM_ALLOW_BPF") == "true" {
-		if err := prepareK8sOBIFilesystem(ctx, paths.hostRoot, paths.uid, paths.gid); err != nil {
-			return err
-		}
-	}
-
 	runtimeDir := hostPath(paths.hostRoot, k8sHostRuntimeDir)
 	pluginDir := hostPath(paths.hostRoot, k8sHostPluginDir)
 	serviceAccountDir := hostPath(paths.hostRoot, k8sHostServiceAccountDir)
```

**File**: `cmd/ongrid-edge/k8s_host_runtime_linux.go` (modified, +25/-19)
```diff
@@ -6,6 +6,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"log/slog"
 	"os"
 	"path/filepath"
 	"runtime"
@@ -21,9 +22,22 @@ const (
 	procHostMountNamespace     = "/proc/1/ns/mnt"
 )
 
+// Keep the Chart's node capabilities across the non-root host identity transition.
+// OBI needs SYS_ADMIN for Go propagation, setns and restrictive perf policies;
+// JVM attach also needs SYS_CHROOT and SETUID/SETGID for target credentials.
 var k8sHostCapabilities = []int{
 	unix.CAP_DAC_READ_SEARCH,
 	unix.CAP_NET_ADMIN,
+	unix.CAP_BPF,
+	unix.CAP_PERFMON,
+	unix.CAP_SYS_PTRACE,
+	unix.CAP_CHECKPOINT_RESTORE,
+	unix.CAP_NET_RAW,
+	unix.CAP_SYS_ADMIN,
+	unix.CAP_SYS_RESOURCE,
+	unix.CAP_SYS_CHROOT,
+	unix.CAP_SETUID,
+	unix.CAP_SETGID,
 }
 
 // Give non-root OBI its own bpffs directory; never change ownership or mode of
@@ -34,11 +48,16 @@ func prepareK8sOBIFilesystem(ctx context.Context, root string, uid, gid int) err
 	}
 	base := hostPath(root, "/sys/fs/bpf")
 	var stat unix.Statfs_t
-	if err := unix.Statfs(base, &stat); err != nil {
-		return fmt.Errorf("OBI requires mounted host bpffs at /sys/fs/bpf: %w", err)
+	err := unix.Statfs(base, &stat)
+	if errors.Is(err, os.ErrNotExist) || (err == nil && stat.Type != unix.BPF_FS_MAGIC) {
+		// OBI can capture without pinned maps. Do not turn an optional APM
+		// facility into a startup requirement for metrics and logs, or create
+		// a pin directory on a filesystem that cannot hold BPF objects.
+		slog.WarnContext(ctx, "host bpffs is not mounted; skipping optional OBI map pinning directory")
+		return nil
 	}
-	if stat.Type != unix.BPF_FS_MAGIC {
-		return fmt.Errorf("OBI requires a bpf filesystem mounted at host /sys/fs/bpf")
+	if err != nil {
+		return fmt.Errorf("inspect host bpffs at /sys/fs/bpf: %w", err)
 	}
 	return ensureOwnedDirectory(filepath.Join(base, "ongrid"), uid, gid, 0750)
 }
@@ -112,7 +131,7 @@ func linuxLastCapability() int {
 }
 
 func dropToHostEdgeUser(uid, gid, lastCapability int) error {
-	capabilities := retainedK8sHostCapabilities()
+	capabilities := k8sHostCapabilities
 	for capability := 0; capability <= lastCapability; capability++ {
 		if isK8sHostCapability(capability) {
 			continue
@@ -155,23 +174,10 @@ func dropToHostEdgeUser(uid, gid, lastCapability int) error {
 }
 
 func isK8sHostCapability(capability int) bool {
-	for _, allowed := range retainedK8sHostCapabilities() {
+	for _, allowed := range k8sHostCapabilities {
 		if capability == allowed {
 			return true
 		}
 	}
 	return false
 }
-
-// Helm explicitly grants these capabilities only for opted-in nodes. SYS_ADMIN
-// is needed by official OBI for Go propagation, setns and restrictive perf policies.
-// JVM attach also needs SYS_CHROOT for mount namespaces and SETUID/SETGID
-// to match the target process credentials.
-// Preserve the granted capabilities across the non-root host identity transition.
-func retainedK8sHostCapabilities() []int {
-	out := append([]int(nil), k8sHostCapabilities...)
-	if os.Getenv("ONGRID_AUTO_APM_ALLOW_BPF") == "true" {
-		out = append(out, unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID)
-	}
-	return out
-}
```

**File**: `cmd/ongrid-edge/k8s_host_runtime_linux_test.go` (modified, +26/-31)
```diff
@@ -6,20 +6,28 @@ import (
 	"context"
 	"os"
 	"path/filepath"
-	"strings"
 	"testing"
 
 	"golang.org/x/sys/unix"
 )
 
-func TestOBIFilesystemRejectsUnMountedDirectory(t *testing.T) {
-	root := t.TempDir()
-	if err := os.MkdirAll(filepath.Join(root, "sys/fs/bpf"), 0755); err != nil {
-		t.Fatal(err)
-	}
-	err := prepareK8sOBIFilesystem(context.Background(), root, os.Getuid(), os.Getgid())
-	if err == nil || !strings.Contains(err.Error(), "bpf filesystem mounted") {
-		t.Fatalf("ordinary directory accepted as bpffs: %v", err)
+func TestOBIFilesystemWithoutBPFFSDoesNotBlockNodeStartup(t *testing.T) {
+	for _, name := range []string{"missing", "unmounted"} {
+		t.Run(name, func(t *testing.T) {
+			root := t.TempDir()
+			base := filepath.Join(root, "sys/fs/bpf")
+			if name == "unmounted" {
+				if err := os.MkdirAll(base, 0755); err != nil {
+					t.Fatal(err)
+				}
+			}
+			if err := prepareK8sOBIFilesystem(context.Background(), root, os.Getuid(), os.Getgid()); err != nil {
+				t.Fatalf("optional bpffs blocks node startup: %v", err)
+			}
+			if _, err := os.Stat(filepath.Join(base, "ongrid")); !os.IsNotExist(err) {
+				t.Fatalf("must not create a pin directory outside bpffs: %v", err)
+			}
+		})
 	}
 }
 
@@ -43,29 +51,16 @@ func TestRequiresHostMountNamespace(t *testing.T) {
 	}
 }
 
-func TestK8sHostCapabilities(t *testing.T) {
-	t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", "false")
-	for _, capability := range []int{unix.CAP_DAC_READ_SEARCH, unix.CAP_NET_ADMIN} {
-		if !isK8sHostCapability(capability) {
-			t.Fatalf("capability %d is not retained", capability)
-		}
-	}
-	if isK8sHostCapability(unix.CAP_SYS_ADMIN) {
-		t.Fatal("CAP_SYS_ADMIN must be dropped before starting the host edge")
-	}
-}
-
-func TestAutoAPMCapabilitiesRequireOptIn(t *testing.T) {
-	t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", "false")
-	for _, cap := range []int{unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID} {
-		if isK8sHostCapability(cap) {
-			t.Fatalf("default granted capture capability %d", cap)
+func TestK8sHostCapabilitiesDoNotDependOnLegacySwitch(t *testing.T) {
+	for _, value := range []string{"", "false", "true"} {
+		t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", value)
+		for _, capability := range []int{unix.CAP_DAC_READ_SEARCH, unix.CAP_NET_ADMIN, unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID} {
+			if !isK8sHostCapability(capability) {
+				t.Fatalf("legacy switch %q: capability %d is not retained", value, capability)
+			}
 		}
-	}
-	t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", "true")
-	for _, cap := range []int{unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID} {
-		if !isK8sHostCapability(cap) {
-			t.Fatalf("missing capability %d", cap)
+		if isK8sHostCapability(unix.CAP_SYS_BOOT) {
+			t.Fatal("unrelated CAP_SYS_BOOT must be dropped")
 		}
 	}
 }
```

**File**: `deploy/kubernetes/ongrid-edge/templates/daemonset.yaml` (modified, +8/-6)
```diff
@@ -23,7 +23,7 @@ spec:
       annotations:
         checksum/config: {{ $nodeConfigChecksum }}
         checksum/node-bootstrap: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
-        {{- if and .Values.node.autoAPM.allowBPF (not (semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version)) }}
+        {{- if not (semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version) }}
         container.apparmor.security.beta.kubernetes.io/edge-node: unconfined
         {{- end }}
       labels:
@@ -54,8 +54,9 @@ spec:
             - {{ .Values.podSecurity.runAsUser | quote }}
             - {{ .Values.podSecurity.runAsGroup | quote }}
           env:
+            # Compatibility for older Edge images; current images ignore this gate.
             - name: ONGRID_AUTO_APM_ALLOW_BPF
-              value: {{ .Values.node.autoAPM.allowBPF | quote }}
+              value: "true"
           resources:
             requests:
               cpu: 5m
@@ -146,8 +147,9 @@ spec:
                   fieldPath: metadata.namespace
             - name: ONGRID_EDGE_COLLECTOR_MODE
               value: {{ .Values.node.collectorMode | quote }}
+            # Compatibility for older Edge images; current images ignore this gate.
             - name: ONGRID_AUTO_APM_ALLOW_BPF
-              value: {{ .Values.node.autoAPM.allowBPF | quote }}
+              value: "true"
             - name: HOST_PROC
               value: /proc
             - name: HOST_SYS
@@ -162,15 +164,15 @@ spec:
             runAsGroup: 0
             allowPrivilegeEscalation: false
             readOnlyRootFilesystem: true
-            {{- if and .Values.node.autoAPM.allowBPF (semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version) }}
+            {{- if semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version }}
             # Host process inspection and bpffs writes cross the runtime's
-            # default AppArmor boundary. This applies only to the opted-in node.
+            # default AppArmor boundary. These permissions apply to the node Agent.
             appArmorProfile:
               type: Unconfined
             {{- end }}
             capabilities:
               drop: ["ALL"]
-              add: ["DAC_READ_SEARCH", "NET_ADMIN", "SETGID", "SETPCAP", "SETUID", "SYS_CHROOT"{{ if .Values.node.autoAPM.allowBPF }}, "BPF", "PERFMON", "SYS_PTRACE", "CHECKPOINT_RESTORE", "NET_RAW", "SYS_ADMIN", "SYS_RESOURCE"{{ end }}]
+              add: ["DAC_READ_SEARCH", "NET_ADMIN", "SETGID", "SETPCAP", "SETUID", "SYS_CHROOT", "BPF", "PERFMON", "SYS_PTRACE", "CHECKPOINT_RESTORE", "NET_RAW", "SYS_ADMIN", "SYS_RESOURCE"]
           volumeMounts:
             - name: host-root
               mountPath: /host/root
```

**File**: `deploy/kubernetes/ongrid-edge/templates/rbac.yaml` (modified, +1/-3)
```diff
@@ -172,10 +172,9 @@ subjects:
     name: {{ include "ongrid-edge.controllerServiceAccount" . }}
     namespace: {{ .Release.Namespace }}
 
-{{- if .Values.node.autoAPM.allowBPF }}
 ---
 # OBI resolves stable workload selectors from Kubernetes metadata. This role
-# exists only when the operator explicitly enables node auto-instrumentation.
+# is available to node Agents; OBI still requires configured capture targets.
 apiVersion: rbac.authorization.k8s.io/v1
 kind: ClusterRole
 metadata:
@@ -204,4 +203,3 @@ subjects:
   - kind: ServiceAccount
     name: {{ include "ongrid-edge.nodeServiceAccount" . }}
     namespace: {{ .Release.Namespace }}
-{{- end }}
```

---

### Incident Patch 8: `89646d3d` (2026-09-24)
**Commit Message**: fix(grafana): update datasources through the UID API (#430)

**File**: `internal/pkg/grafana/client.go` (modified, +3/-4)
```diff
@@ -132,8 +132,7 @@ func (c *Client) UpsertDatasource(ctx context.Context, ds Datasource) error {
 	body, err := c.do(ctx, http.MethodGet, "/api/datasources/uid/"+ds.UID, nil)
 	if err == nil && len(body) > 0 {
 		var existing struct {
-			ID       int64 `json:"id"`
-			ReadOnly bool  `json:"readOnly"`
+			ReadOnly bool `json:"readOnly"`
 		}
 		if jerr := json.Unmarshal(body, &existing); jerr != nil {
 			return fmt.Errorf("grafana: decode existing datasource: %w", jerr)
@@ -143,7 +142,7 @@ func (c *Client) UpsertDatasource(ctx context.Context, ds Datasource) error {
 			// dashboards reference by UID and that hasn't changed.
 			return nil
 		}
-		_, perr := c.do(ctx, http.MethodPut, fmt.Sprintf("/api/datasources/%d", existing.ID), ds)
+		_, perr := c.do(ctx, http.MethodPut, "/api/datasources/uid/"+ds.UID, ds)
 		// Forward-compat: even if a future Grafana drops readOnly from the
 		// GET response, a 403 with the read-only message is unambiguous.
 		if perr != nil && isReadOnlyError(perr) {
@@ -356,7 +355,7 @@ func (c *Client) do(ctx context.Context, method, path string, payload any) ([]by
 
 	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MiB cap
 	if resp.StatusCode == http.StatusNotFound {
-		return nil, notFoundErr
+		return nil, fmt.Errorf("%w: %s %s returned %d", notFoundErr, method, req.URL.EscapedPath(), resp.StatusCode)
 	}
 	if resp.StatusCode/100 != 2 {
 		return nil, fmt.Errorf("grafana: %s %s returned %d: %s",
```

**File**: `internal/pkg/grafana/client_test.go` (modified, +58/-23)
```diff
@@ -7,6 +7,7 @@ import (
 	"io"
 	"net/http"
 	"net/http/httptest"
+	"reflect"
 	"strings"
 	"testing"
 )
@@ -104,28 +105,58 @@ func TestUpsertDatasourceSkipsReadOnly(t *testing.T) {
 
 func TestUpsertDatasourceUpdatesWhenPresent(t *testing.T) {
 	t.Parallel()
-	updated := false
-	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
-		switch {
-		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/api/datasources/uid/"):
-			_, _ = io.WriteString(w, `{"id":42,"uid":"uid-1"}`)
-		case r.Method == http.MethodPut && r.URL.Path == "/api/datasources/42":
-			updated = true
-			_, _ = io.WriteString(w, `{}`)
-		default:
-			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
-		}
-	}))
-	defer srv.Close()
+	for _, tt := range []struct {
+		name     string
+		basePath string
+		existing string
+	}{
+		{"numeric ID present", "", `{"id":42,"uid":"uid-1"}`},
+		{"numeric ID absent and subpath", "/grafana", `{"uid":"uid-1"}`},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			updated := make(chan Datasource, 1)
+			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				if r.URL.Path != tt.basePath+"/api/datasources/uid/uid-1" {
+					// Grafana 13 disables the legacy numeric-ID routes by default.
+					http.NotFound(w, r)
+					return
+				}
+				switch r.Method {
+				case http.MethodGet:
+					_, _ = io.WriteString(w, tt.existing)
+				case http.MethodPut:
+					var got Datasource
+					if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
+						t.Errorf("decode datasource: %v", err)
+						http.Error(w, "invalid payload", http.StatusBadRequest)
+						return
+					}
+					updated <- got
+					_, _ = io.WriteString(w, `{}`)
+				default:
+					http.Error(w, "unexpected method", http.StatusMethodNotAllowed)
+				}
+			}))
+			defer srv.Close()
 
-	err := New(srv.URL, "t", srv.Client()).UpsertDatasource(context.Background(), Datasource{
-		UID: "uid-1", Name: "n", Type: "prometheus", URL: "http://prom",
-	})
-	if err != nil {
-		t.Fatalf("Upsert: %v", err)
-	}
-	if !updated {
-		t.Fatal("PUT /api/datasources/42 never called")
+			ds := Datasource{
+				UID: "uid-1", Name: "n", Type: "prometheus", URL: "http://prom",
+				JSONData:       map[string]any{"httpHeaderName1": "Authorization", "tlsSkipVerify": true},
+				SecureJSONData: map[string]string{"httpHeaderValue1": "Bearer prom-token"},
+			}
+			if err := New(srv.URL+tt.basePath+"/", "t", srv.Client()).UpsertDatasource(context.Background(), ds); err != nil {
+				t.Fatalf("Upsert: %v", err)
+			}
+			ds.Access = "proxy"
+			select {
+			case got := <-updated:
+				if !reflect.DeepEqual(got, ds) {
+					t.Fatalf("payload = %#v, want %#v", got, ds)
+				}
+			default:
+				t.Fatal("existing datasource was not updated")
+			}
+		})
 	}
 }
 
@@ -241,8 +272,12 @@ func TestNon2xxBubblesUp(t *testing.T) {
 		http.Error(w, "no", http.StatusNotFound)
 	}))
 	defer srv2.Close()
-	c := New(srv2.URL, "t", srv2.Client())
-	if _, err := c.do(context.Background(), http.MethodGet, "/x", nil); !errors.Is(err, notFoundErr) {
+	c := New(srv2.URL+"/grafana", "t", srv2.Client())
+	_, err = c.do(context.Background(), http.MethodGet, "/x", nil)
+	if !errors.Is(err, notFoundErr) {
 		t.Fatalf("expected notFoundErr, got %v", err)
 	}
+	if !strings.Contains(err.Error(), "GET /grafana/x returned 404") {
+		t.Fatalf("expected method, full path and status in error, got %v", err)
+	}
 }
```

**File**: `tests/e2e/grafana_loki_datasource_test.go` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ func TestGrafana_LokiDatasourceSync_O4(t *testing.T) {
 		case r.Method == http.MethodGet && r.URL.Path == "/api/datasources/uid/ongrid-loki":
 			w.Header().Set("Content-Type", "application/json")
 			_, _ = w.Write([]byte(`{"id":42,"uid":"ongrid-loki","readOnly":false,"url":"http://loki:3100"}`))
-		case r.Method == http.MethodPut && r.URL.Path == "/api/datasources/42":
+		case r.Method == http.MethodPut && r.URL.Path == "/api/datasources/uid/ongrid-loki":
 			var got datasourceReq
 			if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
 				http.Error(w, "invalid datasource payload", http.StatusBadRequest)
```

---

### Incident Patch 9: `6c67571e` (2026-09-24)
**Commit Message**: fix(deploy): ship complete Edge upgrade bundles for v0.17.1 (#429)

**File**: `Makefile` (modified, +2/-1)
```diff
@@ -655,7 +655,7 @@ fetch-mongodb-exporter: ## [release] 下载 mongodb_exporter 到 bin/<os>-<arch>
 build-edge-bundle: ## [release] 打 ADR-024 edge upgrade bundle 到 dist/out/edge-bundles/
 	@mkdir -p $(OUT)/edge-bundles
 	@for arch in $(EDGE_PLUGIN_ARCHES); do \
-		bash dist/build-edge-bundle.sh $(VERSION) $$arch $(OUT)/edge-bundles; \
+		bash dist/build-edge-bundle.sh $(VERSION) $$arch $(OUT)/edge-bundles || exit 1; \
 	done
 
 .PHONY: package-k8s-chart publish-k8s-chart test-k8s-chart test-publish-k8s-chart
@@ -790,6 +790,7 @@ publish-edge-attachments: publish-edge-deps-attachments publish-edge-version-att
 test-edge-attachments: ## [test] 校验附件构建、直链下载和 checksum 拒绝路径
 	bash scripts/test-edge-assets.sh
 	bash scripts/test-edge-assets-lib.sh
+	bash scripts/test-edge-bundle.sh
 	bash scripts/test-verify-cnb-release-attachments.sh
 	bash scripts/test-ensure-cnb-release.sh
 	bash scripts/test-publish-cnb-release-attachments.sh
```

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

**File**: `README_FR.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choisissez la commande adaptée à l’architecture de votre serveur :
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Chine continentale** — si GitHub est lent, utilisez l’URL du miroir CDN correspondant à votre architecture :
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Tour du produit
```

---

### Incident Patch 10: `3ab94dfc` (2026-09-24)
**Commit Message**: fix(edgeagent): exclude CNI veths from hardware fingerprint (#371)

Co-authored-by: liudi <liudi@gwm.cn>

**File**: `internal/edgeagent/collector/hwfingerprint.go` (modified, +37/-2)
```diff
@@ -26,6 +26,11 @@ import (
 // Returns "" when no physical NIC can be found (e.g. exotic netns setups);
 // the caller keeps HostID as the fallback fingerprint so such hosts still
 // register. All components are sorted so the value is stable across reboots.
+//
+// Note the NIC filter in isPhysicalNIC is load-bearing, not cosmetic: K8s
+// CNI host-side veths (Calico cali*, Cilium lxc*) all carry placeholder MACs
+// and sort before eth0 by name, so unfiltered they would occupy the
+// first-two slots and hash every node of a cluster to one fingerprint.
 func hardwareFingerprint() string {
 	macs := physicalMACs()
 	if len(macs) == 0 {
@@ -48,14 +53,28 @@ func physicalMACs() []string {
 	if err != nil {
 		return nil
 	}
+	return selectMACs(ifaces)
+}
+
+// selectMACs implements the physicalMACs policy over a given interface list
+// (split out for testability): keep physical NICs, drop duplicate MACs (a
+// bond/bridge and its slaves share one address — one card must not occupy
+// both slots), sort by interface name, cap at two.
+func selectMACs(ifaces []net.Interface) []string {
 	type ni struct{ name, mac string }
 	list := make([]ni, 0, len(ifaces))
+	seen := make(map[string]struct{}, len(ifaces))
 	for i := range ifaces {
 		iface := ifaces[i]
 		if !isPhysicalNIC(&iface) {
 			continue
 		}
-		list = append(list, ni{name: iface.Name, mac: iface.HardwareAddr.String()})
+		mac := iface.HardwareAddr.String()
+		if _, dup := seen[mac]; dup {
+			continue
+		}
+		seen[mac] = struct{}{}
+		list = append(list, ni{name: iface.Name, mac: mac})
 	}
 	if len(list) == 0 {
 		return nil
@@ -73,7 +92,9 @@ func physicalMACs() []string {
 
 // isPhysicalNIC reports whether iface looks like a real NIC worth keying the
 // fingerprint on — excludes loopback, point-to-point (VPN/tunnel), MAC-less,
-// and name-matched virtual interfaces (docker/veth/bridge/tun/tap/…).
+// name-matched virtual interfaces (docker/veth/bridge/tun/tap/…), CNI
+// host-side veths (Calico cali*, Cilium lxc*, Weave weave*), and placeholder
+// MACs that are identical across hosts.
 func isPhysicalNIC(iface *net.Interface) bool {
 	if iface.Flags&net.FlagLoopback != 0 {
 		return false
@@ -84,6 +105,19 @@ func isPhysicalNIC(iface *net.Interface) bool {
 	if len(iface.HardwareAddr) == 0 {
 		return false
 	}
+	// Placeholder addresses shared by many hosts must never key the
+	// fingerprint, or every such host hashes to the same value:
+	//   ee:ee:ee:ee:ee:ee — Calico hardcodes it on every host-side cali*
+	//     veth; since "cali" sorts before "eth0", unfiltered it occupies the
+	//     first-two slots and collapses all Calico nodes onto one
+	//     fingerprint. This MAC check also catches any future CNI whose
+	//     name prefix the list below misses.
+	//   00:00:00:00:00:00 — uninitialized NIC; its 6-byte length slips past
+	//     the empty check above.
+	switch iface.HardwareAddr.String() {
+	case "ee:ee:ee:ee:ee:ee", "00:00:00:00:00:00":
+		return false
+	}
 	name := strings.ToLower(iface.Name)
 	// Linux uses prefixes; other platforms ship the same virtual NICs under
 	// vendor names. One combined keyword list covers both well enough for a
@@ -92,6 +126,7 @@ func isPhysicalNIC(iface *net.Interface) bool {
 		"docker", "veth", "cni", "flannel", "virbr", "br-", "tun", "tap",
 		"vmnet", "vboxnet", "vmware", "hyper-v", "vbox", "wsl", "vpn",
 		"utun", "bridge", "awdl", "anpi", "isatap", "teredo", "kube",
+		"cali", "lxc", "weave",
 	}
 	for _, v := range virtual {
 		if strings.HasPrefix(name, v) || strings.Contains(name, v) {
```

**File**: `internal/edgeagent/collector/hwfingerprint_test.go` (modified, +70/-0)
```diff
@@ -21,6 +21,9 @@ func TestIsPhysicalNIC(t *testing.T) {
 		{"br- compose", net.Interface{Name: "br-abc123", HardwareAddr: mac}, false},
 		{"point-to-point vpn", net.Interface{Name: "tun0", Flags: net.FlagPointToPoint, HardwareAddr: mac}, false},
 		{"cni", net.Interface{Name: "cni0", HardwareAddr: mac}, false},
+		{"calico host veth", net.Interface{Name: "cali1cd2b48238d", HardwareAddr: mac}, false},
+		{"cilium host veth", net.Interface{Name: "lxc1a2b3c4d5", HardwareAddr: mac}, false},
+		{"weave", net.Interface{Name: "weave", HardwareAddr: mac}, false},
 	}
 	for _, c := range cases {
 		t.Run(c.name, func(t *testing.T) {
@@ -31,6 +34,73 @@ func TestIsPhysicalNIC(t *testing.T) {
 	}
 }
 
+// Placeholder MACs shared across hosts are rejected regardless of interface
+// name — the backstop for CNIs the name keyword list doesn't know yet.
+func TestIsPhysicalNICPlaceholderMAC(t *testing.T) {
+	for _, macStr := range []string{"ee:ee:ee:ee:ee:ee", "00:00:00:00:00:00"} {
+		mac, _ := net.ParseMAC(macStr)
+		iface := net.Interface{Name: "eth0", HardwareAddr: mac}
+		if isPhysicalNIC(&iface) {
+			t.Errorf("isPhysicalNIC(eth0, %s) = true, want false (non-unique placeholder MAC)", macStr)
+		}
+	}
+}
+
+func TestSelectMACs(t *testing.T) {
+	mustMAC := func(s string) net.HardwareAddr {
+		m, err := net.ParseMAC(s)
+		if err != nil {
+			t.Fatalf("bad test MAC %q: %v", s, err)
+		}
+		return m
+	}
+	real1, real2 := mustMAC("00:50:56:8d:fc:fc"), mustMAC("00:50:56:8d:32:37")
+	cali1 := net.Interface{Name: "cali1cd2b48238d", HardwareAddr: mustMAC("ee:ee:ee:ee:ee:ee")}
+	cali2 := net.Interface{Name: "calicc4fdafb95b", HardwareAddr: mustMAC("ee:ee:ee:ee:ee:ee")}
+
+	t.Run("calico veths excluded, real NIC kept", func(t *testing.T) {
+		// The reported collision: cali* sorts before eth0, so unfiltered the
+		// first-two slots were both ee:ee:ee:ee:ee:ee on every node.
+		got := selectMACs([]net.Interface{
+			cali1, cali2,
+			{Name: "eth0", HardwareAddr: real1},
+		})
+		if len(got) != 1 || got[0] != real1.String() {
+			t.Errorf("selectMACs = %v, want [%s]", got, real1)
+		}
+	})
+
+	t.Run("duplicate macs deduped", func(t *testing.T) {
+		// bond0 and its slave eth0 share one address; dedupe frees the
+		// second slot for a genuinely different NIC.
+		got := selectMACs([]net.Interface{
+			{Name: "bond0", HardwareAddr: real1},
+			{Name: "eth0", HardwareAddr: real1},
+			{Name: "eth1", HardwareAddr: real2},
+		})
+		if len(got) != 2 || got[0] != real1.String() || got[1] != real2.String() {
+			t.Errorf("selectMACs = %v, want [%s %s]", got, real1, real2)
+		}
+	})
+
+	t.Run("capped at two, sorted by name", func(t *testing.T) {
+		got := selectMACs([]net.Interface{
+			{Name: "eth2", HardwareAddr: mustMAC("00:00:00:00:00:03")},
+			{Name: "eth0", HardwareAddr: mustMAC("00:00:00:00:00:01")},
+			{Name: "eth1", HardwareAddr: mustMAC("00:00:00:00:00:02")},
+		})
+		if len(got) != 2 || got[0] != "00:00:00:00:00:01" || got[1] != "00:00:00:00:00:02" {
+			t.Errorf("selectMACs = %v, want [00:00:00:00:00:01 00:00:00:00:00:02]", got)
+		}
+	})
+
+	t.Run("all filtered returns nil", func(t *testing.T) {
+		if got := selectMACs([]net.Interface{cali1, cali2}); got != nil {
+			t.Errorf("selectMACs = %v, want nil", got)
+		}
+	})
+}
+
 func TestHardwareFingerprintDeterministic(t *testing.T) {
 	// On any host with at least one physical NIC the value is non-empty and
 	// stable across calls; on exotic hosts it's "" (the documented fallback
```

#### Recent Merged Pull Requests:
- **PR #451** (2026-09-30): perf(tunnel): reduce telemetry bandwidth for v0.17.6 (@youzi-1122)
- **PR #449** (2026-09-30): fix(web): unify header dividers and compact device and tool layouts (@singchia)
- **PR #447** (2026-09-29): fix(ui): align tool target selector and capture empty state (@singchia)
- **PR #446** (2026-09-29): fix(mcp): complete inline approval and result continuation (@singchia)
- **PR #444** (2026-09-29): fix(edge): tune telemetry capacity budgets for v0.17.5 (@youzi-1122)
- **PR #435** (2026-09-28): fix(k8s): preserve capabilities across JVM credential changes (@youzi-1122)
- **PR #434** (2026-09-28): fix(k8s): handle auto APM node name mismatches (@youzi-1122)
- **PR #433** (2026-09-24): chore(release): bump version to v0.17.2 (@youzi-1122)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
