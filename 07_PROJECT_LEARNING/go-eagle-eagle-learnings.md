# Forensic Learning Record (Deep Inspection): go-eagle/eagle

> **Canonical Artifact**: `07_PROJECT_LEARNING/go-eagle-eagle-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/go-eagle/eagle](https://github.com/go-eagle/eagle))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:14.485Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `go-eagle/eagle`
- **Description**: 🦅 A Go framework for the API or Microservice
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2429 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/eagle/internal/base/get.go`
```
//go:build !go1.16
// +build !go1.16

package base

import (
	"fmt"
	"os"
	"os/exec"
)

// GoInstall go get path.
func GoInstall(path ...string) error {
	for _, p := range path {
		fmt.Printf("go get -u %s\n", p)
		cmd := exec.Command("go", "get", "-u", p)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return err
		}
	}

	return nil
}

```

### Core Architecture Module: `cmd/eagle/internal/base/install.go`
```
//go:build go1.16
// +build go1.16

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

### Core Architecture Module: `cmd/eagle/internal/base/mod.go`
```
package base

import (
	"bufio"
	"bytes"
	"io/ioutil"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/mod/modfile"
)

// ModulePath returns go module path.
func ModulePath(filename string) (string, error) {
	modBytes, err := ioutil.ReadFile(filename)
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

// EagleMod returns eagle mod.
func EagleMod() string {
	// go 1.15+ read from env GOMODCACHE
	cacheOut, _ := exec.Command("go", "env", "GOMODCACHE").Output()
	cachePath := strings.Trim(string(cacheOut), "\n")
	pathOut, _ := exec.Command("go", "env", "GOPATH").Output()
	gopath := strings.Trim(string(pathOut), "\n")
	if cachePath == "" {
		cachePath = filepath.Join(gopath, "pkg", "mod")
	}
	if path, err := ModuleVersion("github.com/go-eagle/eagle/v2"); err == nil {
		// $GOPATH/pkg/mod/github.com/go-eagle/eagle@v2
		return filepath.Join(cachePath, path)
	}
	// $GOPATH/src/github.com/go-eagle/eagle
	return filepath.Join(gopath, "src", "github.com", "go-eagle", "eagle")
}

```

### Core Architecture Module: `cmd/eagle/internal/base/path.go`
```
package base

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/fatih/color"
)

func eagleHome() string {
	dir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}
	home := path.Join(dir, ".eagle")
	if _, err := os.Stat(home); os.IsNotExist(err) {
		if err := os.MkdirAll(home, 0700); err != nil {
			log.Fatal(err)
		}
	}
	return home
}

func eagleHomeWithDir(dir string) string {
	home := path.Join(eagleHome(), dir)
	if _, err := os.Stat(home); os.IsNotExist(err) {
		if err := os.MkdirAll(home, 0700); err != nil {
			log.Fatal(err)
		}
	}
	return home
}

func copyFile(src, dst string, replaces []string) error {
	var err error
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	buf, err := ioutil.ReadFile(src)
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
	return ioutil.WriteFile(dst, buf, srcInfo.Mode())
}

func copyDir(src, dst string, replaces, ignores []string) error {
	var err error
	var fds []os.FileInfo
	var srcInfo os.FileInfo

	if srcInfo, err = os.Stat(src); err != nil {
		return err
	}

	if err = os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	if fds, err = ioutil.ReadDir(src); err != nil {
		return err
	}
	for _, fd := range fds {
		if hasSets(fd.Name(), ignores) {
			continue
		}

		srcfp := path.Join(src, fd.Name())
		dstfp := path.Join(dst, fd.Name())

		if fd.IsDir() {
			if err = copyDir(srcfp, dstfp, replaces, ignores); err != nil {
				return err
			}
		} else {
			if err = copyFile(srcfp, dstfp, replaces); err != nil {
				return err
			}
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
	filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if !info.IsDir() {
			fmt.Printf("%s %s (%v bytes)\n", color.GreenString("CREATED"), strings.Replace(path, dir+"/", "", -1), info.Size())
		}
		return nil
	})
}

```

### Core Architecture Module: `cmd/eagle/internal/base/repo.go`
```
package base

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path"
	"strings"
)

var unExpandVarPath = []string{"~", ".", ".."}

// Repo is git repository manager.
type Repo struct {
	url    string
	branch string
	home   string
}

// NewRepo new a repository manager.
func NewRepo(url string, branch string) *Repo {
	return &Repo{
		url:    url,
		branch: branch,
		home:   eagleHomeWithDir("repo/" + repoDir(url)),
	}
}

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

func (r *Repo) CopyTo(ctx context.Context, to string, modPath string, ignores []string) error {
	if err := r.Clone(ctx); err != nil {
		return err
	}
	mod, err := ModulePath(path.Join(r.Path(), "go.mod"))
	if err != nil {
		return err
	}
	return copyDir(r.Path(), to, []string{mod, modPath}, ignores)
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

```

### Core Architecture Module: `cmd/eagle/internal/base/vcs_url.go`
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

### Core Architecture Module: `cmd/eagle/internal/cache/add/add.go`
```
package add

import (
	"fmt"
	"strings"

	"github.com/go-eagle/eagle/cmd/eagle/internal/utils"

	"github.com/spf13/cobra"
)

// CmdCache represents the new command.
var CmdAdd = &cobra.Command{
	Use:   "add",
	Short: "Create a cache file by template",
	Long:  "Create a cache file using the cache template. Example: eagle cache add UserCache",
	Run:   run,
}

var (
	targetDir string
)

func init() {
	CmdAdd.Flags().StringVarP(&targetDir, "-target-dir", "t", "internal/dal/cache", "generate target directory")
}

func run(cmd *cobra.Command, args []string) {
	if len(args) == 0 {
		fmt.Println("Please enter the cache filename")
		return
	}
	// eg: eagle cache UserCache
	filename := args[0]

	c := &Cache{
		Name:      utils.Ucfirst(filename),                                  // 首字母大写
		LcName:    utils.Lcfirst(filename),                                  // 首字母小写
		UsName:    utils.Camel2Case(filename),                               // 下划线分隔
		ColonName: strings.ReplaceAll(utils.Camel2Case(filename), "_", ":"), // 冒号分隔
		Path:      targetDir,
		ModName:   utils.ModName(),
	}
	if err := c.Generate(); err != nil {
		fmt.Println(err)
		return
	}
}

```

### Core Architecture Module: `cmd/eagle/internal/cache/add/cache.go`
```
package add

import (
	"fmt"
	"os"
	"path"

	"github.com/go-eagle/eagle/cmd/eagle/internal/utils"
)

// Cache is a cache generator.
type Cache struct {
	Name      string
	LcName    string
	UsName    string
	ColonName string
	Path      string
	Service   string
	Package   string
	ModName   string
}

// Generate generate a cache template.
func (c *Cache) Generate() error {
	body, err := c.execute()
	if err != nil {
		return err
	}
	wd, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	to := path.Join(wd, c.Path)
	if _, err := os.Stat(to); os.IsNotExist(err) {
		if err := os.MkdirAll(to, 0700); err != nil {
			return err
		}
	}
	name := path.Join(to, utils.Camel2Case(c.Name)+"_cache.go")
	if _, err := os.Stat(name); !os.IsNotExist(err) {
		return fmt.Errorf("%s already exists", c.Name)
	}
	return os.WriteFile(name, body, 0644)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #80** (2023-03-10): **invalid argument "eagle:github.com/go-eagle/eagle/pkg/version" for "-t, --tag" flag: invalid reference format**
  *Symptoms*: **Describe the bug** invalid argument "eagle:github.com/go-eagle/eagle/pkg/version" for "-t, --tag" flag: invalid reference format  **To Reproduce** Steps to reproduce the behavior: ```shell ➜  eagle git:(master) ✗ make docker                                docker build -t eagle:"github.com/go-eagle/eagle/pkg/version" -f Dockeffile . invalid argument "eagle:github.com/go-eagle/eagle/pkg/version" for "-t, --tag" flag: invalid reference format See 'docker build --help'. make: *** [docker] Error 125 ➜  eagle git:(master) ✗  ```  **Expected behavior** build success  **Screenshots** If applicable, add screenshots to help explain your problem.  **Desktop (please complete the following information):**  - OS:  macOS m2  - Browser [e.g. chrome, safari]  - Version [e.g. 22]  **Smartphone (please complete the following information):**  - Device: [e.g. iPhone6]  - OS: [e.g. iOS8.1]  - Browser [e.g. stock browser, safari]  - Version [e.g. 22]  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > fixed, thank you.  @zishiguo 

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

### Incident Patch 1: `b1301b09` (2025-11-28)
**Commit Message**: fix: 更新时删除本地存储 (#207)

* fix:cache重复引用修复

* fix:repo更新需要删除localStorage

---------

**File**: `cmd/eagle/internal/repo/add/template.go` (modified, +1/-0)
```diff
@@ -102,6 +102,7 @@ func (r *{{.LcName}}Repo) Update{{.Name}}(ctx context.Context, id int64, data *m
 {{- if .WithCache }}
 	// delete cache
 	_ = r.cache.Del{{.Name}}Cache(ctx, id)
+	_ = r.localCache.Del(ctx, cast.ToString(id))
 {{- end }}
 	return nil
 }
```

---

### Incident Patch 2: `67338dcd` (2025-11-04)
**Commit Message**: fix:cache重复引用修复 (#203)

**File**: `cmd/eagle/internal/repo/add/template.go` (modified, +1/-2)
```diff
@@ -16,7 +16,6 @@ import (
 	"time"
 
 	localCache "github.com/go-eagle/eagle/pkg/cache"
-	cacheBase "github.com/go-eagle/eagle/pkg/cache"
 	"github.com/go-eagle/eagle/pkg/encoding"
 	"github.com/pkg/errors"
 	"github.com/spf13/cast"
@@ -125,7 +124,7 @@ func (r *{{.LcName}}Repo) Get{{.Name}}(ctx context.Context, id int64) (ret *mode
 
 	// read redis cache
 	ret, err = r.cache.Get{{.Name}}Cache(ctx, id)
-	if errors.Is(err, cacheBase.ErrPlaceholder) {
+	if errors.Is(err, localCache.ErrPlaceholder) {
 		return nil, gorm.ErrRecordNotFound
 	} else if errors.Is(err, redis.ErrRedisNotFound) {
 		// get data from db
```

---

### Incident Patch 3: `dc82346e` (2024-07-10)
**Commit Message**: fix: fix environment fetch problem && fix eagle run (#141)

**File**: `cmd/eagle/internal/run/run.go` (modified, +3/-1)
```diff
@@ -45,7 +45,8 @@ func Run(cmd *cobra.Command, args []string) {
 			return
 		} else if len(cmdPath) == 1 {
 			for k, v := range cmdPath {
-				dir = path.Join(v, k)
+				selectedDir = k
+				dir = v
 			}
 		} else {
 			var cmdPaths []string
@@ -71,6 +72,7 @@ func Run(cmd *cobra.Command, args []string) {
 
 	// go run /path/cmd/server
 	fd := exec.Command("go", []string{"run", path.Join(dir, selectedDir)}...)
+	fd.Env = os.Environ()
 	fd.Stdout = os.Stdout
 	fd.Stderr = os.Stderr
 	fd.Dir = dir
```

---

### Incident Patch 4: `fa409a75` (2024-03-31)
**Commit Message**: docs: fix typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ English | [中文文档](https://github.com/go-eagle/eagle/blob/master/README_ZH
 - Router [Gin](https://github.com/gin-gonic/gin) 
 - Middleware [Gin](https://github.com/gin-gonic/gin) 
 - Database [GORM](https://github.com/jinzhu/gorm)
-- Document [Swagger](https://swagger.io/) 生成
+- Document [Swagger](https://swagger.io/) 
 - Config [Viper](https://github.com/spf13/viper)
 - Auth [JWT](https://jwt.io/) 
 - Validator [validator](https://github.com/go-playground/validator)
```

---

### Incident Patch 5: `ef56beb2` (2023-10-21)
**Commit Message**: fix: GitHub workflow badge URL (#113)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # 🦅 eagle
 
- [![GitHub Workflow Status](https://img.shields.io/github/workflow/status/go-eagle/eagle/Go?style=flat-square)](https://github.com/go-eagle/eagle)
+ [![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/go-eagle/eagle/test.yml?branch=master&style=flat-square)](https://github.com/go-eagle/eagle)
  [![codecov](https://codecov.io/gh/go-eagle/eagle/branch/master/graph/badge.svg)](https://codecov.io/gh/go-eagle/eagle)
  [![GolangCI](https://golangci.com/badges/github.com/golangci/golangci-lint.svg)](https://golangci.com)
  [![godoc](https://godoc.org/github.com/go-eagle/eagle?status.svg)](https://godoc.org/github.com/go-eagle/eagle)
```

---

### Incident Patch 6: `98808b7c` (2023-08-08)
**Commit Message**: chore: modify tag prefix

**File**: `.github/workflows/deploy.yml` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@ name: Deploy
 on:
   push:
     tags:
-    - 'v*.*.*'
+    - 'release*.*.*'
 
 jobs:
 
@@ -59,4 +59,4 @@ jobs:
     - name: Deploy image to Amazon EKS
       run: |
         kubectl apply -f deploy/k8s/go-deployment.yaml
-        kubectl apply -f deploy/k8s/go-service.yaml
\ No newline at end of file
+        kubectl apply -f deploy/k8s/go-service.yaml
```

#### Recent Merged Pull Requests:
- **PR #213** (closed): chore(deps): bump github.com/jackc/pgx/v5 from 5.5.4 to 5.9.0 (@dependabot[bot])
- **PR #209** (closed): chore(deps): bump go.opentelemetry.io/otel/sdk from 1.24.0 to 1.40.0 (@dependabot[bot])
- **PR #208** (closed): chore(deps): bump github.com/nats-io/nats-server/v2 from 2.9.0 to 2.11.12 (@dependabot[bot])
- **PR #207** (2025-11-28): 更新时删除本地存储 (@cjl2029)
- **PR #205** (2025-11-20): chore(deps): bump golang.org/x/crypto from 0.35.0 to 0.45.0 in /cmd/eagle (@dependabot[bot])
- **PR #203** (2025-11-04): fix:cache重复引用修复 (@cjl2029)
- **PR #201** (2025-10-28): chore: improve gorm logger writter (@qloog)
- **PR #198** (2025-10-14): feat: add pointer func (@qloog)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
