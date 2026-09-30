# Forensic Learning Record (Deep Inspection): go-kratos/kratos

> **Canonical Artifact**: `07_PROJECT_LEARNING/go-kratos-kratos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/go-kratos/kratos](https://github.com/go-kratos/kratos))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:10.340Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `go-kratos/kratos`
- **Description**: Your ultimate Go microservices framework for the cloud-native era.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 25953 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app.go`
```
package kratos

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"

	"github.com/go-kratos/kratos/v3/log"
	"github.com/go-kratos/kratos/v3/registry"
	"github.com/go-kratos/kratos/v3/transport"
)

// AppInfo is application context value.
type AppInfo interface {
	ID() string
	Name() string
	Version() string
	Metadata() map[string]string
	Endpoint() []string
}

// App is an application components lifecycle manager.
type App struct {
	opts     options
	ctx      context.Context
	cancel   context.CancelFunc
	mu       sync.Mutex
	instance *registry.ServiceInstance
}

// New create an application lifecycle manager.
func New(opts ...Option) *App {
	o := options{
		ctx:              context.Background(),
		sigs:             []os.Signal{syscall.SIGTERM, syscall.SIGQUIT, syscall.SIGINT},
		registrarTimeout: 10 * time.Second,
	}
	if id, err := uuid.NewUUID(); err == nil {
		o.id = id.String()
	}
	for _, opt := range opts {
		opt(&o)
	}
	if o.logger != nil {
		log.SetDefault(o.logger)
	}
	ctx, cancel := context.WithCancel(o.ctx)
	return &App{
		ctx:    ctx,
		cancel: cancel,
		opts:   o,
	}
}

// ID returns app instance id.
func (a *App) ID() string { return a.opts.id }

// Name returns service name.
func (a *App) Name() string { return a.opts.name }

// Version returns app version.
func (a *App) Version() string { return a.opts.version }

// Metadata returns service metadata.
func (a *App) Metadata() map[string]string { return a.opts.metadata }

// Endpoint returns endpoints.
func (a *App) Endpoint() []string {
	if a.instance != nil {
		return a.instance.Endpoints
	}
	return nil
}

// Run executes all OnStart hooks registered with the application's Lifecycle.
func (a *App) Run() error {
	instance, err := a.buildInstance()
	if err != nil {
		return err
	}
	a.mu.Lock()
	a.instance = instance
	a.mu.Unlock()
	sctx := NewContext(a.ctx, a)
	eg, ctx := errgroup.WithContext(sctx)
	wg := sync.WaitGroup{}

	for _, fn := range a.opts.beforeStart {
		if err = fn(sctx); err != nil {
			return err
		}
	}
	octx := NewContext(a.opts.ctx, a)
	for _, srv := range a.opts.servers {
		server := srv
		eg.Go(func() error {
			<-ctx.Done() // wait for stop signal
			stopCtx := context.WithoutCancel(octx)
			if a.opts.stopTimeout > 0 {
				var cancel context.CancelFunc
				stopCtx, cancel = context.WithTimeout(stopCtx, a.opts.stopTimeout)
				defer cancel()
			}
			return server.Stop(stopCtx)
		})
		wg.Add(1)
		eg.Go(func() error {
			wg.Done() // here is to ensure server start has begun running before register, so defer is not needed
			return server.Start(octx)
		})
	}
	wg.Wait()
	if a.opts.registrar != nil {
		rctx, rcancel := context.WithTimeout(ctx, a.opts.registrarTimeout)
		defer rcancel()
		if err = a.opts.registrar.Register(rctx, instance); err != nil {
			return err
		}
	}
	for _, fn := range a.opts.afterStart {
		if err = fn(sctx); err != nil {
			return err
		}
	}

	c := make(chan os.Signal, 1)
	signal.Notify(c, a.opts.sigs...)
	eg.Go(func() error {
		select {
		case <-ctx.Done():
			return nil
		case <-c:
			return a.Stop()
		}
	})
	if err = eg.Wait(); err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	err = nil
	for _, fn := range a.opts.afterStop {
		err = fn(sctx)
	}
	return err
}

// Stop gracefully stops the application.
func (a *App) Stop() (err error) {
	sctx := NewContext(a.ctx, a)
	for _, fn := range a.opts.beforeStop {
		err = fn(sctx)
	}

	a.mu.Lock()
	instance := a.instance
	a.mu.Unlock()
	if a.opts.registrar != nil && instance != nil {
		ctx, cancel := context.WithTimeout(NewContext(a.ctx, a), a.opts.registrarTimeout)
		defer cancel()
		if err = a.opts.registrar.Deregister(ctx, instance); err != nil {
			return err
		}
	}
	if a.cancel != nil {
		a.cancel()
	}
	return err
}

func (a *App) buildInstance() (*registry.ServiceInstance, error) {
	endpoints := make([]string, 0, len(a.opts.endpoints))
	for _, e := range a.opts.endpoints {
		endpoints = append(endpoints, e.String())
	}
	if len(endpoints) == 0 {
		for _, srv := range a.opts.servers {
			if r, ok := srv.(transport.Endpointer); ok {
				e, err := r.Endpoint()
				if err != nil {
					return nil, err
				}
				endpoints = append(endpoints, e.String())
			}
		}
	}
	return &registry.ServiceInstance{
		ID:        a.opts.id,
		Name:      a.opts.name,
		Version:   a.opts.version,
		Metadata:  a.opts.metadata,
		Endpoints: endpoints,
	}, nil
}

type appKey struct{}

// NewContext returns a new Context that carries value.
func NewContext(ctx context.Context, s AppInfo) context.Context {
	return context.WithValue(ctx, appKey{}, s)
}

// FromContext returns the Transport value stored in ctx, if any.
func FromContext(ctx context.Context) (s AppInfo, ok bool) {
	s, ok = ctx.Value(appKey{}).(AppInfo)
	return
}

```

### Core Architecture Module: `cmd/kratos/internal/base/install.go`
```
package base

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// GoInstall go get path.
func GoInstall(path ...string) error {
	for _, p := range path {
		if !strings.Contains(p, "@") {
			p += "@latest"
		}
		fmt.Printf("go install %s\n", p)
		cmd := exec.Command("go", "install", p)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return err
		}
	}
	return nil
}

```

### Core Architecture Module: `cmd/kratos/internal/base/mod.go`
```
package base

import (
	"bufio"
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/mod/modfile"
)

// ModulePath returns go module path.
func ModulePath(filename string) (string, error) {
	modBytes, err := os.ReadFile(filename)
	if err != nil {
		return "", err
	}
	return modfile.ModulePath(modBytes), nil
}

// ModuleVersion returns module version.
func ModuleVersion(path string) (string, error) {
	stdout := &bytes.Buffer{}
	fd := exec.Command("go", "mod", "graph")
	fd.Stdout = stdout
	fd.Stderr = stdout
	if err := fd.Run(); err != nil {
		return "", err
	}
	rd := bufio.NewReader(stdout)
	for {
		line, _, err := rd.ReadLine()
		if err != nil {
			return "", err
		}
		str := string(line)
		i := strings.Index(str, "@")
		if strings.Contains(str, path+"@") && i != -1 {
			return path + str[i:], nil
		}
	}
}

// KratosMod returns kratos mod.
func KratosMod() string {
	// go 1.15+ read from env GOMODCACHE
	cacheOut, _ := exec.Command("go", "env", "GOMODCACHE").Output()
	cachePath := strings.Trim(string(cacheOut), "\n")
	pathOut, _ := exec.Command("go", "env", "GOPATH").Output()
	gopath := strings.Trim(string(pathOut), "\n")
	if cachePath == "" {
		cachePath = filepath.Join(gopath, "pkg", "mod")
	}
	if path, err := ModuleVersion("github.com/go-kratos/kratos/v3"); err == nil {
		// $GOPATH/pkg/mod/github.com/go-kratos/kratos/v3@v3.0.0
		return filepath.Join(cachePath, path)
	}
	// $GOPATH/src/github.com/go-kratos/kratos
	return filepath.Join(gopath, "src", "github.com", "go-kratos", "kratos")
}

```

### Core Architecture Module: `cmd/kratos/internal/base/path.go`
```
package base

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/fatih/color"
)

func kratosHome() string {
	dir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Failed to get user home directory: %v", err)
	}
	home := filepath.Join(dir, ".kratos")
	if _, err := os.Stat(home); os.IsNotExist(err) {
		if err := os.MkdirAll(home, 0o700); err != nil {
			log.Fatalf("Failed to create kratos home %q: %v", home, err)
		}
	}
	return home
}

func kratosHomeWithDir(dir string) string {
	home := filepath.Join(kratosHome(), dir)
	if _, err := os.Stat(home); os.IsNotExist(err) {
		if err := os.MkdirAll(home, 0o700); err != nil {
			log.Fatalf("Failed to create kratos home directory %q: %v", home, err)
		}
	}
	return home
}

func copyFile(src, dst string, replaces []string) error {
	srcinfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	buf, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	var old string
	for i, next := range replaces {
		if i%2 == 0 {
			old = next
			continue
		}
		buf = bytes.ReplaceAll(buf, []byte(old), []byte(next))
	}
	return os.WriteFile(dst, buf, srcinfo.Mode())
}

func copyDir(src, dst string, replaces, ignores []string) error {
	srcinfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	err = os.MkdirAll(dst, srcinfo.Mode())
	if err != nil {
		return err
	}

	fds, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, fd := range fds {
		if hasSets(fd.Name(), ignores) {
			continue
		}
		srcfp := filepath.Join(src, fd.Name())
		dstfp := filepath.Join(dst, fd.Name())
		var e error
		if fd.IsDir() {
			e = copyDir(srcfp, dstfp, replaces, ignores)
		} else {
			e = copyFile(srcfp, dstfp, replaces)
		}
		if e != nil {
			return e
		}
	}
	return nil
}

func hasSets(name string, sets []string) bool {
	for _, ig := range sets {
		if ig == name {
			return true
		}
	}
	return false
}

func Tree(path string, dir string) {
	_ = filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if err == nil && info != nil && !info.IsDir() {
			fmt.Printf("%s %s (%v bytes)\n", color.GreenString("CREATED"), strings.ReplaceAll(path, dir+"/", ""), info.Size())
		}
		return nil
	})
}

```

### Core Architecture Module: `cmd/kratos/internal/base/repo.go`
```
package base

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
)

var unExpandVarPath = []string{"~", ".", ".."}

// Repo is git repository manager.
type Repo struct {
	url    string
	home   string
	branch string
}

func repoDir(url string) string {
	vcsURL, err := ParseVCSUrl(url)
	if err != nil {
		return url
	}
	// check host contains port
	host, _, err := net.SplitHostPort(vcsURL.Host)
	if err != nil {
		host = vcsURL.Host
	}
	for _, p := range unExpandVarPath {
		host = strings.TrimLeft(host, p)
	}
	dir := path.Base(path.Dir(vcsURL.Path))
	url = fmt.Sprintf("%s/%s", host, dir)
	return url
}

// NewRepo new a repository manager.
func NewRepo(url string, branch string) *Repo {
	return &Repo{
		url:    url,
		home:   kratosHomeWithDir("repo/" + repoDir(url)),
		branch: branch,
	}
}

// Path returns the repository cache path.
func (r *Repo) Path() string {
	start := strings.LastIndex(r.url, "/")
	end := strings.LastIndex(r.url, ".git")
	if end == -1 {
		end = len(r.url)
	}
	var branch string
	if r.branch == "" {
		branch = "@main"
	} else {
		branch = "@" + r.branch
	}
	return path.Join(r.home, r.url[start+1:end]+branch)
}

// Pull fetch the repository from remote url.
func (r *Repo) Pull(ctx context.Context) error {
	cmd := exec.CommandContext(ctx, "git", "symbolic-ref", "HEAD")
	cmd.Dir = r.Path()
	_, err := cmd.CombinedOutput()
	if err != nil {
		return err
	}
	cmd = exec.CommandContext(ctx, "git", "pull")
	cmd.Dir = r.Path()
	out, err := cmd.CombinedOutput()
	fmt.Println(string(out))
	if err != nil {
		return err
	}
	return err
}

// Clone clones the repository to cache path.
func (r *Repo) Clone(ctx context.Context) error {
	if _, err := os.Stat(r.Path()); !os.IsNotExist(err) {
		return r.Pull(ctx)
	}
	var cmd *exec.Cmd
	if r.branch == "" {
		cmd = exec.CommandContext(ctx, "git", "clone", r.url, r.Path())
	} else {
		cmd = exec.CommandContext(ctx, "git", "clone", "-b", r.branch, r.url, r.Path())
	}
	out, err := cmd.CombinedOutput()
	fmt.Println(string(out))
	if err != nil {
		return err
	}
	return nil
}

// CopyTo copies the repository to project path.
func (r *Repo) CopyTo(ctx context.Context, to string, modPath string, ignores []string) error {
	if err := r.Clone(ctx); err != nil {
		return err
	}
	mod, err := ModulePath(filepath.Join(r.Path(), "go.mod"))
	if err != nil {
		return err
	}
	return copyDir(r.Path(), to, []string{mod, modPath}, ignores)
}

// CopyToV2 copies the repository to project path
func (r *Repo) CopyToV2(ctx context.Context, to string, modPath string, ignores, replaces []string) error {
	if err := r.Clone(ctx); err != nil {
		return err
	}
	mod, err := ModulePath(filepath.Join(r.Path(), "go.mod"))
	if err != nil {
		return err
	}
	replaces = append([]string{mod, modPath}, replaces...)
	return copyDir(r.Path(), to, replaces, ignores)
}

```

### Core Architecture Module: `cmd/kratos/internal/base/vcs_url.go`
```
package base

import (
	"errors"
	"net/url"
	"regexp"
	"strings"
)

var (
	scpSyntaxRe = regexp.MustCompile(`^(\w+)@([\w.-]+):(.*)$`)
	scheme      = []string{"git", "https", "http", "git+ssh", "ssh", "file", "ftp", "ftps"}
)

// ParseVCSUrl ref https://github.com/golang/go/blob/master/src/cmd/go/internal/vcs/vcs.go
// see https://go-review.googlesource.com/c/go/+/12226/
// git url define https://git-scm.com/docs/git-clone#_git_urls
func ParseVCSUrl(repo string) (*url.URL, error) {
	var (
		repoURL *url.URL
		err     error
	)

	if m := scpSyntaxRe.FindStringSubmatch(repo); m != nil {
		// Match SCP-like syntax and convert it to a URL.
		// Eg, "git@github.com:user/repo" becomes
		// "ssh://git@github.com/user/repo".
		repoURL = &url.URL{
			Scheme: "ssh",
			User:   url.User(m[1]),
			Host:   m[2],
			Path:   m[3],
		}
	} else {
		if !strings.Contains(repo, "//") {
			repo = "//" + repo
		}
		if strings.HasPrefix(repo, "//git@") {
			repo = "ssh:" + repo
		} else if strings.HasPrefix(repo, "//") {
			repo = "https:" + repo
		}
		repoURL, err = url.Parse(repo)
		if err != nil {
			return nil, err
		}
	}

	// Iterate over insecure schemes too, because this function simply
	// reports the state of the repo. If we can't see insecure schemes then
	// we can't report the actual repo URL.
	for _, s := range scheme {
		if repoURL.Scheme == s {
			return repoURL, nil
		}
	}
	return nil, errors.New("unable to parse repo url")
}

```

### Core Architecture Module: `cmd/kratos/internal/change/change.go`
```
package change

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// CmdChange is kratos change log tool
var CmdChange = &cobra.Command{
	Use:   "changelog",
	Short: "Get a kratos change log",
	Long:  "Get a kratos release or commits info. Example: kratos changelog dev or kratos changelog {version}",
	Run:   run,
}

var (
	token   string
	repoURL string
)

func init() {
	if repoURL = os.Getenv("KRATOS_REPO"); repoURL == "" {
		repoURL = "https://github.com/go-kratos/kratos.git"
	}
	CmdChange.Flags().StringVarP(&repoURL, "repo-url", "r", repoURL, "github repo")
	token = os.Getenv("GITHUB_TOKEN")
}

func run(_ *cobra.Command, args []string) {
	owner, repo := ParseGithubURL(repoURL)
	api := GithubAPI{Owner: owner, Repo: repo, Token: token}
	version := "latest"
	if len(args) > 0 {
		version = args[0]
	}
	if version == "dev" {
		info := api.GetCommitsInfo()
		fmt.Print(ParseCommitsInfo(info))
		return
	}
	info := api.GetReleaseInfo(version)
	fmt.Print(ParseReleaseInfo(info))
}

```

### Core Architecture Module: `cmd/kratos/internal/change/get.go`
```
package change

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

type ReleaseInfo struct {
	Author struct {
		Login string `json:"login"`
	} `json:"author"`
	PublishedAt string `json:"published_at"`
	Body        string `json:"body"`
	HTMLURL     string `json:"html_url"`
}

type CommitInfo struct {
	Commit struct {
		Message string `json:"message"`
	} `json:"commit"`
}

type ErrorInfo struct {
	Message string
}

type GithubAPI struct {
	Owner string
	Repo  string
	Token string
}

const (
	commitTypeFix   = "fix"
	commitTypeFeat  = "feat"
	commitTypeDeps  = "deps"
	commitTypeBuild = "build"
	commitTypeBreak = "break"
	commitTypeChore = "chore"
	commitTypeOther = "other"
)

// GetReleaseInfo for getting kratos release info.
func (g *GithubAPI) GetReleaseInfo(version string) ReleaseInfo {
	api := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", g.Owner, g.Repo)
	if version != "latest" {
		api = fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/tags/%s", g.Owner, g.Repo, version)
	}
	resp, code := requestGithubAPI(api, http.MethodGet, nil, g.Token)
	if code != http.StatusOK {
		printGithubErrorInfo(resp)
	}
	releaseInfo := ReleaseInfo{}
	err := json.Unmarshal(resp, &releaseInfo)
	if err != nil {
		fatal(err)
	}
	return releaseInfo
}

// GetCommitsInfo for getting kratos commits info.
func (g *GithubAPI) GetCommitsInfo() []CommitInfo {
	info := g.GetReleaseInfo("latest")
	page := 1
	prePage := 100
	var list []CommitInfo
	for {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/commits?pre_page=%d&page=%d&since=%s", g.Owner, g.Repo, prePage, page, info.PublishedAt)
		resp, code := requestGithubAPI(url, http.MethodGet, nil, g.Token)
		if code != http.StatusOK {
			printGithubErrorInfo(resp)
		}
		var res []CommitInfo
		err := json.Unmarshal(resp, &res)
		if err != nil {
			fatal(err)
		}
		list = append(list, res...)
		if len(res) < prePage {
			break
		}
		page++
	}
	return list
}

func printGithubErrorInfo(body []byte) {
	errorInfo := &ErrorInfo{}
	err := json.Unmarshal(body, errorInfo)
	if err != nil {
		fatal(err)
	}
	fatal(errors.New(errorInfo.Message))
}

func requestGithubAPI(url string, method string, body io.Reader, token string) ([]byte, int) {
	cli := &http.Client{Timeout: 60 * time.Second}
	request, err := http.NewRequest(method, url, body)
	if err != nil {
		fatal(err)
	}
	if token != "" {
		request.Header.Add("Authorization", token)
	}
	resp, err := cli.Do(request)
	if err != nil {
		fatal(err)
	}
	defer resp.Body.Close()
	resBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fatal(err)
	}
	return resBody, resp.StatusCode
}

func ParseCommitsInfo(info []CommitInfo) string {
	group := map[string][]string{
		commitTypeFix:   {},
		commitTypeFeat:  {},
		commitTypeDeps:  {},
		commitTypeBuild: {},
		commitTypeBreak: {},
		commitTypeChore: {},
		commitTypeOther: {},
	}

	for _, commitInfo := range info {
		msg := commitInfo.Commit.Message
		index := strings.Index(fmt.Sprintf("%q", msg), `\n`)
		if index != -1 {
			msg = msg[:index-1]
		}
		prefix := []string{commitTypeFix, commitTypeFeat, commitTypeBuild, commitTypeDeps, commitTypeBreak, commitTypeChore}
		var matched bool
		for _, v := range prefix {
			msg = strings.TrimPrefix(msg, " ")
			if strings.HasPrefix(msg, v) {
				group[v] = append(group[v], msg)
				matched = true
			}
		}
		if !matched {
			group[commitTypeOther] = append(group[commitTypeOther], msg)
		}
	}

	md := make(map[string]string)
	for key, value := range group {
		var text string
		switch key {
		case commitTypeBreak:
			text = "### Breaking Changes\n"
		case commitTypeDeps:
			text = "### Dependencies\n"
		case commitTypeFeat:
			text = "### New Features\n"
		case commitTypeFix:
			text = "### Bug Fixes\n"
		case commitTypeBuild:
			text = "### Builds\n"
		case commitTypeChore:
			text = "### Chores\n"
		case commitTypeOther:
			text = "### Others\n"
		}
		if len(value) == 0 {
			continue
		}
		md[key] += text
		for _, value := range value {
			md[key] += fmt.Sprintf("- %s\n", value)
		}
	}
	return fmt.Sprint(
		md[commitTypeBreak],
		md[commitTypeDeps],
		md[commitTypeFeat],
		md[commitTypeFix],
		md[commitTypeBuild],
		md[commitTypeChore],
		md[commitTypeOther],
	)
}

func ParseReleaseInfo(info ReleaseInfo) string {
	reg := regexp.MustCompile(`(?m)^\s*$[\r\n]*|[\r\n]+\s+\z|<[\S\s]+?>`)
	body := reg.ReplaceAll([]byte(info.Body), []byte(""))
	if string(body) == "" {
		body = []byte("no release info")
	}
	splitters := "--------------------------------------------"
	return fmt.Sprintf(
		"Author: %s\nDate: %s\nUrl: %s\n\n%s\n\n%s\n\n%s\n",
		info.Author.Login,
		info.PublishedAt,
		info.HTMLURL,
		splitters,
		body,
		splitters,
	)
}

func ParseGithubURL(url string) (owner string, repo string) {
	var start int
	start = strings.Index(url, "//")
	if start == -1 {
		start = strings.Index(url, ":") + 1
	} else {
		start += 2
	}
	end := strings.LastIndex(url, "/")
	gitIndex := strings.LastIndex(url, ".git")
	if gitIndex == -1 {
		repo = url[strings.LastIndex(url, "/")+1:]
	} else {
		repo = url[strings.LastIndex(url, "/")+1 : gitIndex]
	}
	tmp := url[start:end]
	owner = tmp[strings.Index(tmp, "/")+1:]
	return
}

func fatal(err error) {
	fmt.Fprintf(os.Stderr, "\033[31mERROR: %s\033[m\n", err)
	os.Exit(1)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3840** (2026-06-12): **JWKS parsing fails entirely when provider includes ES256K (secp256k1 in Telegram OIDC)**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! For questions please use one of our forums: https://go-kratos.dev/docs/getting-started/faq -->  #### What happened:  Kratos fails to verify Telegram OIDC tokens with the following error:  failed to verify signature: fetching keys oidc: failed to decode keys: got Content-Type = application/json, but could not unmarshal as JSON: go-jose/go-jose: unsupported elliptic curve 'secp256k1'  Telegram recently added an ES256K key (crv: secp256k1, kid: oidc-es256k-1) to their JWKS at https://oauth.telegram.org/.well-known/jwks.json. go-jose fails to unmarshal the entire JWK set when it encounters this unsupported curve, even though the token is signed with the RS256 key (kid: oidc-1) which is valid. All Telegram OIDC logins are broken as a result.  #### What you expected to happen:  Keys with unsupported algorithms or curves should be skipped silently. The remaining valid keys (RS256, ES256, EdDSA) should be parsed and used normally.  or   check if new go-jose handle this algorithm, and update if handled.  #### How to reproduce it (as minimally and precisely as possible):  1. Configure a generic OIDC provider with issuer_url: https://oauth.telegram.org 2. Attempt login via Telegram 3. Kratos logs the error above when verifying the id_token signature  #### Anything else we need to know?:  This is a regression. No Kratos or provider config was changed on our side. Telegram added the ES256K key to support TON blockcha
  **Post-Mortem & Fix Analysis**:
  > Wrong repo :) 

- **Issue #3837** (2026-06-05): **fix(transport/http): bind named body field for websocket client streaming**
  *Symptoms*: #### Description (what this PR does / why we need it):  A client-streaming RPC is served over WebSocket, whose handshake is **always** an HTTP `GET`. When such a method declares a named body field, e.g.  ```proto rpc Chat(stream ChatRequest) returns (stream ChatReply) {   option (google.api.http) = { get: "/v1/bitto/chat", body: "data" }; } ```  `protoc-gen-go-http` had two problems:  1. **Spurious warning.** `buildHTTPRule` printed `WARN: GET /v1/bitto/chat body should not be declared.` for any GET with a body — but for a WebSocket stream the GET is just the handshake verb, so a body field is legitimate. 2. **The named field never bound at runtime.** The generated client sent the whole request message while the server decoded each frame into the top-level message, leaving the `data` field empty.  This PR makes client and server agree on framing, deciding it **once at generation time** so the two sides cannot diverge:  - **`cmd/protoc-gen-go-http/http.go`** — skip the GET/DELETE "body should not be declared" / "does not declare a body" warnings for client-streaming methods (`m.Desc.IsStreamingClient()`); unary and SSE GET-with-body still warn, since that is a genuine HTTP anti-pattern. Record a new `BodyMessage` flag when the named body is a singular message-kind field. - **`cmd/protoc-gen-go-http/template.go`** — add `methodDesc.BodyMessage`. - **`cmd/protoc-gen-go-http/httpTemplate.tpl`** — gate both sides on `BodyMessage`: for a streamable message body the client streams t

- **Issue #3818** (2026-08-05): **eureka: When the service Metadata is not empty, multiple endpoint registration causes "Endpoints" PC caller to report Zero endpoint found**
  *Symptoms*:     ## 问题描述    当服务同时满足以下两个条件时，会触发此 Bug：    1. 设置了**非空的 `Metadata`**，例如 `kratos.Metadata(map[string]string{"weight": "10"})`   2. 注册了**多个 endpoint**，例如同时注册 `grpc://` 和 `http://`           `register.go` 中的 `Endpoints()` 函数在循环构建 Eureka 实例时，将 `service.Metadata` 的**引用**（而非副本）赋给了每个 Eureka `Endpoint` 结构体的 `MetaData` 字段。导致每次循环都在同一个 map 上写入 `metadata["Endpoints"]`，后一次覆盖前一次，最终所有注册到 Eureka 的实例的`"Endpoints"` 元数据均为**最后一个 endpoint 的值**    消费方（如 `system-perm`）通过服务发现解析时，gRPC resolver 找不到`grpc://` scheme 的地址，打印如下警告并拒绝更新地址列表：    ```   [resolver] Zero endpoint found,refused to write, instances:   [service-name-id service-name-id]   ```    后续 gRPC 调用因无可用地址而等待超时，最终报错：    ```   rpc error: code = DeadlineExceeded desc = context deadline exceeded      ```    ## 复现步骤    1. 启动服务端，同时注册 gRPC 和 HTTP 两个 endpoint，并设置非空           Metadata：    ```go   kratos.Metadata(map[string]string{"weight": "10"}),   kratos.Endpoint(       grpcURL,  // grpc://192.168.1.100:9000       httpURL,  // http://192.168.1.100:8000   )   ```    2. 启动消费方，通过 `discovery:///service-name`   方式调用上述服务（gRPC）。    3. 发起任意 gRPC 调用。    **实际结果：** `rpc error: code = DeadlineExceeded desc = context        deadline exceeded`     ## 根本原因    `register.go` 中 `Endpoints()` 函数：    ```go // https://github.com/go-kratos/kratos/blob/main/contrib/registry/eureka/register.go#L113-L116   for _, ep := range service.Endpoints {       metadata := make(map[string]string)       if len(service.Metadata) > 0 {           metadata = service.Metadata  // ← 仅复制引用，非 de
  **Post-Mortem & Fix Analysis**:
  > Hi, @mrlaojia. I'm [Dosu](https://dosu.dev), and I'm helping the Kratos team manage their backlog and am marking this issue as stale.  **Recap** - You reported that Eureka registration appears to reuse the same `Metadata` map across multiple endpoints. - As a result, each registration overwrites the `Endpoints` field, so only the last endpoint remains available. - This prevents gRPC discovery from finding a `grpc://` endpoint, which leads to `Zero endpoint found` logs and eventual `DeadlineExceeded` timeouts on client calls. - There haven’t been any additional comments or follow-up updates on the issue.  **Next Steps** - Please let us know if this is still relevant on the latest version of Kratos; if it is, you can keep the discussion open by commenting here. - Otherwise, this issue will be automatically closed in 7 days.  Thanks for your understanding and contribution.

- **Issue #3810** (2026-07-16): **Unintended Route Exposure via DefaultServeMux Fallback**
  *Symptoms*: # Unintended Route Exposure via DefaultServeMux Fallback in go-kratos/kratos  https://github.com/go-kratos/kratos  ## Summary  | Field | Value | |---|---| | **Product** | go-kratos/kratos | | **Version** | v2.9.2 (and all prior v2.x versions) | | **Component** | `transport/http/server.go` | | **Vulnerability Type** | CWE-441 (Unintentional Proxy or Intermediary) | | **Severity** | High | | **CVSS 3.1 Score** | 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N) | | **Attack Vector** | Network |   ## Affected Code  **File:** `transport/http/server.go` **Lines:** 192-193 **Function:** `NewServer()`  ```go func NewServer(opts ...ServerOption) *Server {     srv := &Server{         // ...     }     srv.router.NotFoundHandler = http.DefaultServeMux      // line 192     srv.router.MethodNotAllowedHandler = http.DefaultServeMux // line 193     // ... } ```  ## Description  The Kratos HTTP server (`transport/http/server.go`) sets `http.DefaultServeMux` as the fallback handler for both unmatched routes (`NotFoundHandler`) and disallowed methods (`MethodNotAllowedHandler`).  In Go, `http.DefaultServeMux` is a global, shared ServeMux instance. Numerous standard library and third-party packages automatically register handlers on it during `init()`. The most notable example is `net/http/pprof`, which registers debug profiling endpoints. Kratos itself ships a pprof wrapper package (`transport/http/pprof`) that imports `net/http/pprof`.  When any package in the application's dependency tree performs a
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this security issue. I think you are correct, this is a valid vulnerability. Can you submit a pull request to fix this issue?
  > Hi, @August829. I'm [Dosu](https://dosu.dev), and I'm helping the Kratos team manage their backlog and am marking this issue as stale.  **Issue Summary** - You reported that Kratos v2.x can fall back to `http.DefaultServeMux` for unmatched or disallowed routes. - This fallback can unintentionally expose globally registered handlers from imported packages, including `net/http/pprof`. - A maintainer acknowledged this as a valid security issue and asked for a pull request to address it. - The issue remains unresolved and there hasn’t been recent activity to indicate a fix has landed.  **Next Steps** - Please confirm whether this is still relevant against the latest version of Kratos; if so, you can keep the discussion open by commenting here. - Otherwise, this issue will be automatically closed in 7 days.  Thanks for your understanding and contribution.

- **Issue #3807** (2026-03-27): **http.NewClient should not modify global http.DefaultTransport**
  *Symptoms*: Problem code:  https://github.com/go-kratos/kratos/blob/main/transport/http/client.go#L169-L179 ```go 		transport:    http.DefaultTransport, 		subsetSize:   25, 	} 	for _, o := range opts { 		o(&options) 	} 	if options.tlsConf != nil { 		if tr, ok := options.transport.(*http.Transport); ok { 			tr.TLSClientConfig = options.tlsConf 		} 	} ```  If the caller does not call `WithTransport` to pass in a new Transport but does pass in a `TLSClientConfig`, the code here will change the global `http.DefaultTransport`.
  **Post-Mortem & Fix Analysis**:
  > <!-- Greeting --> Hi @shizhx! I'm [Dosu](https://go.dosu.dev/dosubot) and I’m helping the kratos team.  <!-- Answer --> Good catch! This is a valid bug. The code at [lines 169-178](https://github.com/go-kratos/kratos/blob/d6f5f00cf562b46322b0ed42d183b1b873c0a68f/transport/http/client.go#L169-L178) directly mutates `http.DefaultTransport` when a TLS config is provided without a custom transport, which can cause unexpected behavior across your entire application.  The fix should clone the transport before modifying it:  ```go if options.tlsConf != nil {     if tr, ok := options.transport.(*http.Transport); ok {         tr = tr.Clone()         tr.TLSClientConfig = options.tlsConf         options.transport = tr     } } ```  Interestingly, [PR #3772](https://github.com/go-kratos/kratos/pull/3772) recently fixed a similar HTTP transport anti-pattern in the Eureka client, so the team is aware of these best practices. Would you like to submit a PR for this fix?   <!-- Dosu Comment Footer --> *

- **Issue #3793** (2026-02-27): **[Bug] Double suffix _bucket in default Prometheus metrics when using OpenTelemetry Exporter**
  *Symptoms*: What happened: When using the Kratos metrics middleware combined with the OpenTelemetry Prometheus Exporter, the generated Prometheus metric names for histograms have a redundant suffix. Specifically, the metric name becomes server_requests_seconds_bucket_bucket.  This happens because:  Kratos defines DefaultServerSecondsHistogramName as server_requests_seconds_bucket.  The OTel Prometheus Exporter automatically appends _bucket to histogram instruments per the Prometheus naming convention.  What you expected to happen: The metric name should be server_requests_seconds_bucket (standard Prometheus format) instead of having a double _bucket suffix.  How to reproduce it (as minimally and precisely as possible): Use the Kratos metrics middleware.  Initialize a Prometheus exporter using go.opentelemetry.io/otel/exporters/prometheus.  Register a histogram using the default name:  Go  seconds, _ := metrics.DefaultSecondsHistogram(meter, metrics.DefaultServerSecondsHistogramName) Scrape the /metrics endpoint. You will observe server_requests_seconds_bucket_bucket.  Anything else we need to know?: This naming redundancy forces users to write awkward PromQL queries like rate(server_requests_seconds_bucket_bucket[5m]).  I would like to help fix this issue. I suggest changing the default constant DefaultServerSecondsHistogramName from server_requests_seconds_bucket to server_requests_seconds.  Environment: Kratos version (use kratos -v): v2.9.2  Go version (use go version):  go1.24.10  OS
  **Post-Mortem & Fix Analysis**:
  > <!-- Answer --> You’re right about the cause: Kratos sets DefaultServerSecondsHistogramName to server_requests_seconds_bucket, and the OpenTelemetry Prometheus exporter then appends another _bucket, resulting in server_requests_seconds_bucket_bucket. Kratos itself does not append the extra suffix; it just uses the name you provide when registering the histogram instrument. The exporter always adds _bucket for histogram buckets as per Prometheus conventions, so including _bucket in the base name leads to the redundancy.  There’s no technical or historical reason in the code or docs for including _bucket in the default name, and no existing issues or PRs discuss this. Changing DefaultServerSecondsHistogramName to server_requests_seconds would align with Prometheus conventions and fix the double suffix problem without side effects, as the metric registration logic simply uses the name you provide and does not depend on the _bucket suffix being present in the base name. If you need an imme

- **Issue #3784** (2026-03-09): **The service file structure name generated by kratos proto server contains multiple service suffixes**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! For questions please use one of our forums: https://go-kratos.dev/docs/getting-started/faq -->  #### What happened:  在 `proto` 里使用 `service UserService {}` 时，  使用 `kratos proto server` 生成的 `service` 文件的结构名称是 `UserServiceService`  （多个 service 后缀）  #### What you expected to happen:  去除多余后缀   #### Environment: - Kratos version (use `kratos -v`): v2.9.2 - Go version (use `go version`): 1.25.1 linux/amd64 - OS (e.g: `cat /etc/os-release`): WSL Ubuntu 24.04.3 LTS - Others: 
  **Post-Mortem & Fix Analysis**:
  > <!-- Greeting --> Hi @edwinhuish! I'm [Dosu](https://go.dosu.dev/dosubot) and I’m helping the kratos team.  <!-- Answer --> Kratos 的 `kratos proto server` 代码生成逻辑会直接将 proto 里的 service 名称（如 `UserService`）转换为大驼峰后再追加 `Service` 后缀，所以会出现 `UserServiceService` 这种重复后缀的结构名。这是目前的默认行为，生成器没有自动去重或去除多余后缀的机制，也没有相关配置项可以控制命名方式 [相关源码](https://github.com/go-kratos/kratos/blob/main/cmd/kratos/internal/proto/server/server.go)。  目前有一个功能请求和 PR（#3650）正在推进，未来可能支持自定义模板，届时可以通过自定义模板来调整生成代码的命名规则 [相关讨论](https://github.com/go-kratos/kratos/issues/3739)。在此之前，如果想避免重复后缀，只能在 proto 里避免 service 名称以 `Service` 结尾，比如改为 `User`。  如果你有特殊命名需求，建议关注自定义模板功能的进展。   <!-- Dosu Comment Footer --> *To reply, just mention [@dosu](https://go.dosu.dev/dosubot?utm_source=github&utm_medium=bot-comment&utm_campaign=github-comment-footer-20260415&utm_content=reply-with-mention&utm_term=go-kratos%2Fkratos).*  ---  Docs are dead. Just use [Dosu](https://dosu.dev?utm_source=github&utm_medium=bot-comment&utm_campaign=github-comment-footer-20260415&u

- **Issue #3734** (2025-10-09): **invalid array length -delta * delta (constant -256 of type int64)**
  *Symptoms*:  #### What happened:  1.  kratos new project 2.  cd project 3.  go generate ./... ``` # golang.org/x/tools/internal/tokeninternal D:\go\pkg\mod\golang.org\x\tools@v0.17.0\internal\tokeninternal\tokeninternal.go:78:9: invalid array length -delta * delta (constant -256 of type int64) cmd\minigame-data-analytics\wire_gen.go:3: running "go": exit status 1 ```  #### What you expected to happen: generate  success #### How to reproduce it (as minimally and precisely as possible):  #### Anything else we need to know?:  #### Environment: - Kratos version (use `kratos -v`): `kratos version v2.9.0` - Go version (use `go version`): `go version go1.25.2 windows/amd64` - OS (e.g: `cat /etc/os-release`): windows 10 - Others: https://github.com/golang/go/issues/74462 
  **Post-Mortem & Fix Analysis**:
  > me too
  > I success , try it : go get github.com/google/wire/cmd/wire
  > https://github.com/google/wire/pull/432

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

### Incident Patch 1: `dc13681f` (2026-06-05)
**Commit Message**: fix(transport/http): bind named body field for websocket client streaming (#3837)

Client-streaming RPCs are served over WebSocket, whose handshake is always
an HTTP GET. A rule declaring a named body field (e.g. body: "data") on such
a method produced two problems in protoc-gen-go-http:

1. buildHTTPRule emitted a spurious "GET ... body should not be declared"
   warning, even though the body is legitimate for a streamed GET.
2. The named field never bound: the client sent the whole message while the
   server decoded each frame into the top-level message, so the body field
   stayed empty.

Fix both by agreeing on framing at generation time. A new methodDesc.BodyMessage
flag (set when the body field is a singular message-kind field) gates both the
client Send and the server stream option, so the two sides cannot diverge:

- http.go: skip the GET/DELETE body warnings for client-streaming methods;
  unary/SSE GET-with-body still warns. Record BodyMessage on named bodies.
- httpTemplate.tpl: for a streamable message body, the client streams the body
  sub-field and the server receives http.WithStreamBodyField(...); otherwise the
  whole message is sent/decoded.
- transport/http/stre

**File**: `cmd/protoc-gen-go-http/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# Compiled plugin binary produced by `go build` in this directory.
+/protoc-gen-go-http
```

**File**: `cmd/protoc-gen-go-http/http.go` (modified, +15/-7)
```diff
@@ -139,13 +139,18 @@ func buildHTTPRule(g *protogen.GeneratedFile, service *protogen.Service, m *prot
 	body = rule.Body
 	responseBody = rule.ResponseBody
 	md := buildMethodDesc(g, m, method, path)
-	if method == http.MethodGet || method == http.MethodDelete {
-		if body != "" {
-			_, _ = fmt.Fprintf(os.Stderr, "\u001B[31mWARN\u001B[m: %s %s body should not be declared.\n", method, path)
-		}
-	} else {
-		if body == "" {
-			_, _ = fmt.Fprintf(os.Stderr, "\u001B[31mWARN\u001B[m: %s %s does not declare a body.\n", method, path)
+	// Client-streaming RPCs are served over WebSocket, whose handshake is always an
+	// HTTP GET regardless of the declared verb. Declaring a body for them is legitimate
+	// (it identifies the streamed message field), so skip the GET/DELETE body warnings.
+	if !m.Desc.IsStreamingClient() {
+		if method == http.MethodGet || method == http.MethodDelete {
+			if body != "" {
+				_, _ = fmt.Fprintf(os.Stderr, "\u001B[31mWARN\u001B[m: %s %s body should not be declared.\n", method, path)
+			}
+		} else {
+			if body == "" {
+				_, _ = fmt.Fprintf(os.Stderr, "\u001B[31mWARN\u001B[m: %s %s does not declare a body.\n", method, path)
+			}
 		}
 	}
 	if body == "*" {
@@ -169,6 +174,9 @@ func buildHTTPRule(g *protogen.GeneratedFile, service *protogen.Service, m *prot
 		md.BodyField = body
 		md.BodyQueryName = fd.JSONName()
 		md.BodyHTTPBody = isHTTPBodyField(fd)
+		// A singular message-kind body field can be streamed frame-by-frame for
+		// client-streaming RPCs (each frame carries just this field's payload).
+		md.BodyMessage = fd.Kind() == protoreflect.MessageKind && !fd.IsList() && !fd.IsMap()
 	} else {
 		md.HasBody = false
 	}
```

**File**: `cmd/protoc-gen-go-http/httpTemplate.tpl` (modified, +2/-2)
```diff
@@ -65,7 +65,7 @@ func (x *{{$svrType}}_{{.Name}}HTTPServer) SendAndClose(m *{{.Reply}}) error {
 func _{{$svrType}}_{{.Name}}{{.Num}}_HTTP_Handler(srv {{$svrType}}HTTPServer) func(ctx http.Context) error {
 	return func(ctx http.Context) error {
 		{{- if .ClientStreaming}}
-		stream, err := http.NewWebSocketServerStream(ctx)
+		stream, err := http.NewWebSocketServerStream(ctx{{if .BodyMessage}}, http.WithStreamBodyField("{{.BodyField}}"){{end}})
 		if err != nil {
 			return err
 		}
@@ -216,7 +216,7 @@ func (x *{{$svrType}}_{{.Name}}HTTPClient) Send(m *{{.Request}}) error {
 	if err := x.open(m); err != nil {
 		return err
 	}
-	return x.ClientStream.Send(m)
+	return x.ClientStream.Send(m{{if .BodyMessage}}{{.Body}}{{end}})
 }
 {{- end}}
 
```

**File**: `cmd/protoc-gen-go-http/http_test.go` (modified, +48/-0)
```diff
@@ -216,6 +216,40 @@ func TestHTTPTemplateStreamsAndHTTPBody(t *testing.T) {
 				BodyHTTPBody:  true,
 				ResponseBody:  ".Body",
 			},
+			{
+				Name:            "ChatData",
+				OriginalName:    "ChatData",
+				Request:         "ChatDataRequest",
+				Reply:           "ChatDataReply",
+				Path:            "/v1/bitto/chat",
+				PathTemplate:    "/v1/bitto/chat",
+				Method:          "GET",
+				HasBody:         true,
+				Body:            ".Data",
+				BodyField:       "data",
+				BodyQueryName:   "data",
+				BodyMessage:     true,
+				ClientStreaming: true,
+				ServerStreaming: true,
+			},
+			{
+				// Client-streaming RPC whose named body is a scalar field: it is not
+				// streamable frame-by-frame, so the whole message is sent/decoded.
+				Name:            "ChatText",
+				OriginalName:    "ChatText",
+				Request:         "ChatTextRequest",
+				Reply:           "ChatTextReply",
+				Path:            "/v1/bitto/text",
+				PathTemplate:    "/v1/bitto/text",
+				Method:          "GET",
+				HasBody:         true,
+				Body:            ".Text",
+				BodyField:       "text",
+				BodyQueryName:   "text",
+				BodyMessage:     false,
+				ClientStreaming: true,
+				ServerStreaming: true,
+			},
 		},
 	}
 	got := sd.execute()
@@ -233,9 +267,23 @@ func TestHTTPTemplateStreamsAndHTTPBody(t *testing.T) {
 		`http.ContentType(http.BodyContentType(in.Body))`,
 		`http.WithOmitFields("body")`,
 		`return ctx.Result(200, reply.Body)`,
+		// Client-streaming RPC with a streamable (message-kind) named body field.
+		`stream, err := http.NewWebSocketServerStream(ctx, http.WithStreamBodyField("data"))`,
+		`return x.ClientStream.Send(m.Data)`,
+		// Client-streaming RPC with a scalar named body: whole message is streamed.
+		`func (x *Greeter_ChatTextHTTPClient) Send(m *ChatTextRequest) error`,
 	} {
 		if !strings.Contains(got, want) {
 			t.Fatalf("generated template missing %q in:\n%s", want, got)
 		}
 	}
+	// The whole-message streaming client (ChatHello) and the scalar-body streaming
+	// client (ChatText) must both send the whole message, not a sub-field.
+	if !strings.Contains(got, "return x.ClientStream.Send(m)\n") {
+		t.Fatalf("generated template should send whole message for non-streamable body:\n%s", got)
+	}
+	// The scalar-body server handler must NOT receive a stream body-field option.
+	if strings.Contains(got, `http.WithStreamBodyField("text")`) {
+		t.Fatalf("scalar named body should not emit WithStreamBodyField:\n%s", got)
+	}
 }
```

**File**: `cmd/protoc-gen-go-http/template.go` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ type methodDesc struct {
 	BodyField            string
 	BodyQueryName        string
 	BodyHTTPBody         bool
+	BodyMessage          bool
 	ResponseBody         string
 	ResponseBodyHTTPBody bool
 	ReplyHTTPBody        bool
```

---

### Incident Patch 2: `4ed1bedb` (2026-03-27)
**Commit Message**: fix(transport/http): clone transport before applying TLSClientConfig to avoid mutating http.DefaultTransport (#3808)

* Initial plan

* fix: clone transport before setting TLSClientConfig to avoid modifying http.DefaultTransport

Co-authored-by: shenqidebaozi <35397691+shenqidebaozi@users.noreply.github.com>
Agent-Logs-Url: https://github.com/go-kratos/kratos/sessions/6ae6cae0-5dff-4c44-96e9-22e44ff40211

* fix: correct indentation in encoding/json/json.go to pass gofmt lint

Co-authored-by: shenqidebaozi <35397691+shenqidebaozi@users.noreply.github.com>
Agent-Logs-Url: https://github.com/go-kratos/kratos/sessions/4f3c9982-7083-4ed0-b241-fb0aece221d9

---------

Co-authored-by: copilot-swe-agent[bot] <198982749+Copilot@users.noreply.github.com>
Co-authored-by: shenqidebaozi <35397691+shenqidebaozi@users.noreply.github.com>

**File**: `encoding/json/json.go` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ func (codec) Marshal(v any) ([]byte, error) {
 }
 
 func (codec) Unmarshal(data []byte, v any) error {
-  if len(data) == 0 {
+	if len(data) == 0 {
 		return nil
 	}
 	switch m := v.(type) {
```

**File**: `transport/http/client.go` (modified, +3/-1)
```diff
@@ -174,7 +174,9 @@ func NewClient(ctx context.Context, opts ...ClientOption) (*Client, error) {
 	}
 	if options.tlsConf != nil {
 		if tr, ok := options.transport.(*http.Transport); ok {
-			tr.TLSClientConfig = options.tlsConf
+			cloned := tr.Clone()
+			cloned.TLSClientConfig = options.tlsConf
+			options.transport = cloned
 		}
 	}
 	insecure := options.tlsConf == nil
```

**File**: `transport/http/client_test.go` (modified, +17/-0)
```diff
@@ -367,3 +367,20 @@ func TestNewClient(t *testing.T) {
 		t.Error("err should be equal to encoder error")
 	}
 }
+
+func TestNewClientWithTLSDoesNotModifyDefaultTransport(t *testing.T) {
+	defaultTransport, ok := http.DefaultTransport.(*http.Transport)
+	if !ok {
+		t.Skip("http.DefaultTransport is not *http.Transport")
+	}
+	originalTLSConfig := defaultTransport.TLSClientConfig
+
+	_, err := NewClient(context.Background(), WithEndpoint("127.0.0.1:9999"), WithTLSConfig(&tls.Config{ServerName: "www.kratos.com"}))
+	if err != nil {
+		t.Error(err)
+	}
+
+	if defaultTransport.TLSClientConfig != originalTLSConfig {
+		t.Error("NewClient modified http.DefaultTransport.TLSClientConfig")
+	}
+}
```

---

### Incident Patch 3: `1393e857` (2026-03-25)
**Commit Message**: fix: JSON parsing error during hot reload caused by duplicate file write events

**File**: `config/file/watcher.go` (modified, +2/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"os"
 	"path/filepath"
+	"time"
 
 	"github.com/fsnotify/fsnotify"
 
@@ -52,6 +53,7 @@ func (w *watcher) Next() ([]*config.KeyValue, error) {
 		if fi.IsDir() {
 			path = filepath.Join(w.f.path, filepath.Base(event.Name))
 		}
+		time.Sleep(time.Millisecond)
 		kv, err := w.f.loadFile(path)
 		if err != nil {
 			return nil, err
```

**File**: `encoding/json/json.go` (modified, +3/-0)
```diff
@@ -43,6 +43,9 @@ func (codec) Marshal(v any) ([]byte, error) {
 }
 
 func (codec) Unmarshal(data []byte, v any) error {
+  if len(data) == 0 {
+		return nil
+	}
 	switch m := v.(type) {
 	case json.Unmarshaler:
 		return m.UnmarshalJSON(data)
```

---

### Incident Patch 4: `a0f54b77` (2026-03-23)
**Commit Message**: fix(config/apollo): prevent panic on nil NewValue in watcher onChange (#3806)

**File**: `contrib/config/apollo/watcher.go` (modified, +9/-7)
```diff
@@ -28,13 +28,15 @@ func (c *customChangeListener) onChange(namespace string, changes map[string]*st
 	if strings.Contains(namespace, ".") && !strings.HasSuffix(namespace, "."+properties) &&
 		(format(namespace) == yaml || format(namespace) == yml || format(namespace) == json) {
 		if value, ok := changes["content"]; ok {
-			kv = append(kv, &config.KeyValue{
-				Key:    namespace,
-				Value:  []byte(value.NewValue.(string)),
-				Format: format(namespace),
-			})
-
-			return kv
+			if s, ok := value.NewValue.(string); ok {
+				kv = append(kv, &config.KeyValue{
+					Key:    namespace,
+					Value:  []byte(s),
+					Format: format(namespace),
+				})
+
+				return kv
+			}
 		}
 	}
 
```

**File**: `contrib/config/apollo/watcher_test.go` (modified, +67/-0)
```diff
@@ -77,3 +77,70 @@ func Test_onChange(t *testing.T) {
 		})
 	}
 }
+
+func Test_onChange_deletedContent(t *testing.T) {
+	c := customChangeListener{}
+
+	t.Run("json content deleted should not panic", func(t *testing.T) {
+		changes := map[string]*storage.ConfigChange{
+			"content": {
+				OldValue:   `{"name":"old"}`,
+				NewValue:   nil,
+				ChangeType: storage.DELETED,
+			},
+		}
+		kvs := c.onChange("app.json", changes)
+		// NewValue is nil, so the original config path is skipped;
+		// falls through to resolve path which also skips nil NewValue.
+		if len(kvs) != 1 {
+			t.Fatalf("expected 1 kv, got %d", len(kvs))
+		}
+	})
+
+	t.Run("yaml content deleted should not panic", func(t *testing.T) {
+		changes := map[string]*storage.ConfigChange{
+			"content": {
+				OldValue:   "name: old",
+				NewValue:   nil,
+				ChangeType: storage.DELETED,
+			},
+		}
+		kvs := c.onChange("app.yaml", changes)
+		if len(kvs) != 1 {
+			t.Fatalf("expected 1 kv, got %d", len(kvs))
+		}
+	})
+
+	t.Run("properties key deleted should not panic", func(t *testing.T) {
+		changes := map[string]*storage.ConfigChange{
+			"name": {
+				OldValue:   "old",
+				NewValue:   nil,
+				ChangeType: storage.DELETED,
+			},
+		}
+		kvs := c.onChange("app", changes)
+		if len(kvs) != 1 {
+			t.Fatalf("expected 1 kv, got %d", len(kvs))
+		}
+	})
+}
+
+func Test_onChange_nonStringNewValue(t *testing.T) {
+	c := customChangeListener{}
+
+	t.Run("json content with non-string NewValue should not panic", func(t *testing.T) {
+		changes := map[string]*storage.ConfigChange{
+			"content": {
+				OldValue:   `{"name":"old"}`,
+				NewValue:   12345,
+				ChangeType: storage.MODIFIED,
+			},
+		}
+		// Should not panic; falls through to resolve path
+		kvs := c.onChange("app.json", changes)
+		if kvs == nil {
+			t.Fatal("expected non-nil kvs")
+		}
+	})
+}
```

---

### Incident Patch 5: `867b143d` (2026-03-12)
**Commit Message**: fix(metrics): remove redundant _bucket suffix from default histogram name (#3794)



---

### Incident Patch 6: `689d861d` (2026-03-09)
**Commit Message**: fix: trim service suffix of service name (#3785)

**File**: `cmd/kratos/internal/proto/server/server.go` (modified, +5/-1)
```diff
@@ -64,7 +64,7 @@ func run(_ *cobra.Command, args []string) {
 					continue
 				}
 				cs.Methods = append(cs.Methods, &Method{
-					Service: serviceName(s.Name), Name: serviceName(r.Name), Request: parametersName(r.RequestType),
+					Service: serviceName(s.Name), Name: rpcName(r.Name), Request: parametersName(r.RequestType),
 					Reply: parametersName(r.ReturnsType), Type: getMethodType(r.StreamsRequest, r.StreamsReturns),
 				})
 			}
@@ -110,6 +110,10 @@ func parametersName(name string) string {
 }
 
 func serviceName(name string) string {
+	return strings.TrimSuffix(toUpperCamelCase(strings.Split(name, ".")[0]), "Service")
+}
+
+func rpcName(name string) string {
 	return toUpperCamelCase(strings.Split(name, ".")[0])
 }
 
```

**File**: `cmd/kratos/internal/proto/server/server_test.go` (modified, +15/-0)
```diff
@@ -51,6 +51,21 @@ func Test_serviceName(t *testing.T) {
 			args: args{str: "hello_world"},
 			want: "HelloWorld",
 		},
+		{
+			name: "serviceName with service suffix",
+			args: args{str: "HelloWorldService"},
+			want: "HelloWorld",
+		},
+		{
+			name: "serviceName with spoace and service suffix",
+			args: args{str: "Hello world service"},
+			want: "HelloWorld",
+		},
+		{
+			name: "serviceName with snake case and service suffix",
+			args: args{str: "hello_world_service"},
+			want: "HelloWorld",
+		},
 	}
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
```

---

### Incident Patch 7: `98e88ab9` (2026-02-27)
**Commit Message**: fix(cmd): assign filepath.Join result to base in findCMD loop (#3798)

The result of filepath.Join(base, "..") was discarded by assigning to _,
causing the loop to scan the same directory repeatedly instead of
traversing up to parent directories when searching for the cmd/ folder.

Co-authored-by: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `cmd/kratos/internal/run/run.go` (modified, +1/-1)
```diff
@@ -132,7 +132,7 @@ func findCMD(base string) (map[string]string, error) {
 		if root {
 			break
 		}
-		_ = filepath.Join(base, "..")
+		base = filepath.Join(base, "..")
 	}
 	return map[string]string{"": base}, nil
 }
```

---

### Incident Patch 8: `178a2c93` (2026-02-27)
**Commit Message**: fix(middleware/metrics): remove redundant _bucket suffix from default histogram names (#3797)

The OTel Prometheus Exporter automatically appends _bucket to histogram
instruments per Prometheus naming convention. Having _bucket in the default
constant names caused double suffix (e.g. server_requests_seconds_bucket_bucket).

Co-authored-by: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `middleware/metrics/metrics.go` (modified, +4/-4)
```diff
@@ -23,9 +23,9 @@ const (
 )
 
 const (
-	DefaultServerSecondsHistogramName = "server_requests_seconds_bucket"
+	DefaultServerSecondsHistogramName = "server_requests_seconds"
 	DefaultServerRequestsCounterName  = "server_requests_code_total"
-	DefaultClientSecondsHistogramName = "client_requests_seconds_bucket"
+	DefaultClientSecondsHistogramName = "client_requests_seconds"
 	DefaultClientRequestsCounterName  = "client_requests_code_total"
 )
 
@@ -56,7 +56,7 @@ func DefaultRequestsCounter(meter metric.Meter, histogramName string) (metric.In
 
 // DefaultSecondsHistogram
 // return metric.Float64Histogram for WithSeconds
-// suggest histogramName = <client/server>_requests_seconds_bucket
+// suggest histogramName = <client/server>_requests_seconds
 func DefaultSecondsHistogram(meter metric.Meter, histogramName string) (metric.Float64Histogram, error) {
 	return meter.Float64Histogram(
 		histogramName,
@@ -94,7 +94,7 @@ func DefaultSecondsHistogramView(histogramName string) metricsdk.View {
 type options struct {
 	// counter: <client/server>_requests_code_total{kind, operation, code, reason}
 	requests metric.Int64Counter
-	// histogram: <client/server>_requests_seconds_bucket{kind, operation}
+	// histogram: <client/server>_requests_seconds{kind, operation}
 	seconds metric.Float64Histogram
 }
 
```

---

### Incident Patch 9: `8faeb28a` (2025-12-31)
**Commit Message**: fix(contrib/registry/discovery): replace context.TODO() with context.Background() (#3786)

Co-authored-by: 1911860538 <alxps1911@gmail.com>
Co-authored-by: Zeta <zhihui_chen@foxmail.com>

**File**: `contrib/registry/discovery/discovery.go` (modified, +1/-1)
```diff
@@ -281,7 +281,7 @@ func (d *Discovery) cancel(ins *discoveryInstance) (err error) {
 	// request
 	// send request to Discovery server.
 	if _, err = d.httpClient.R().
-		SetContext(context.TODO()).
+		SetContext(context.Background()).
 		SetQueryParamsFromValues(p).
 		SetResult(&res).
 		Post(uri); err != nil {
```

**File**: `contrib/registry/discovery/impl_discover.go` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ func (w *watcher) Next() ([]*registry.ServiceInstance, error) {
 		return nil, fmt.Errorf("watch context canceled: %v", w.cancelCtx.Err())
 	}
 
-	ctx, cancel := context.WithTimeout(context.TODO(), 15*time.Second)
+	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
 	defer cancel()
 
 	ins, ok := w.resolve.fetch(ctx)
```

---

### Incident Patch 10: `2fd0e4eb` (2025-12-16)
**Commit Message**: fix(contrib/registry/eureka): use shared http.Transport (#3772)

**File**: `contrib/registry/eureka/client.go` (modified, +14/-6)
```diff
@@ -7,6 +7,7 @@ import (
 	"fmt"
 	"io"
 	"math/rand/v2"
+	"net"
 	"net/http"
 	"strings"
 	"sync"
@@ -18,7 +19,6 @@ const (
 	statusDown         = "DOWN"
 	statusOutOfService = "OUT_OF_SERVICE"
 	heartbeatRetry     = 3
-	maxIdleConns       = 100
 	heartbeatTime      = 10 * time.Second
 	httpTimeout        = 3 * time.Second
 	refreshTime        = 30 * time.Second
@@ -129,18 +129,26 @@ type Client struct {
 	lock              sync.Mutex
 }
 
-func NewClient(urls []string, opts ...ClientOption) *Client {
-	tr := &http.Transport{
-		MaxIdleConns: maxIdleConns,
-	}
+var clientTransport = &http.Transport{
+	DialContext: (&net.Dialer{
+		Timeout:   5 * time.Second,
+		KeepAlive: 30 * time.Second,
+	}).DialContext,
+	IdleConnTimeout:       30 * time.Second,
+	MaxIdleConns:          100,
+	MaxIdleConnsPerHost:   10,
+	TLSHandshakeTimeout:   5 * time.Second,
+	ResponseHeaderTimeout: 10 * time.Second,
+}
 
+func NewClient(urls []string, opts ...ClientOption) *Client {
 	e := &Client{
 		ctx:               context.Background(),
 		urls:              urls,
 		eurekaPath:        "eureka/v2",
 		maxRetry:          len(urls),
 		heartbeatInterval: heartbeatTime,
-		client:            &http.Client{Transport: tr, Timeout: httpTimeout},
+		client:            &http.Client{Transport: clientTransport, Timeout: httpTimeout},
 		keepalive:         make(map[string]chan struct{}),
 	}
 
```

#### Recent Merged Pull Requests:
- **PR #3845** (2026-06-26): deps: upgrade kratos version to v3.0.0 (@shenqidebaozi)
- **PR #3844** (2026-06-21): feat(errors): add standard library errors wrappers (@tonybase)
- **PR #3843** (2026-06-17): feat(transport/http): add read/write deadline control to ServerStream (@tonybase)
- **PR #3839** (2026-06-11): feat(protoc-gen-go-http): support google.api.HttpBody response (@tonybase)
- **PR #3837** (2026-06-05): fix(transport/http): bind named body field for websocket client streaming (@tonybase)
- **PR #3830** (2026-05-16): feat(encoding): add json compatibility codec (@tonybase)
- **PR #3829** (2026-05-15): feat(transport): support http streaming (@tonybase)
- **PR #3828** (2026-05-14): refactor(config): remove mergo dependency (@tonybase)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
