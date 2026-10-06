# Forensic Learning Record (Deep Inspection): go-nunu/nunu

> **Canonical Artifact**: `07_PROJECT_LEARNING/go-nunu-nunu-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/go-nunu/nunu](https://github.com/go-nunu/nunu))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:49.079Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `go-nunu/nunu`
- **Description**: A CLI tool for building Go applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2607 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/nunu/root.go`
```
package nunu

import (
	"fmt"

	"github.com/go-nunu/nunu/config"
	"github.com/go-nunu/nunu/internal/command/wire"

	"github.com/go-nunu/nunu/internal/command/create"
	"github.com/go-nunu/nunu/internal/command/new"
	"github.com/go-nunu/nunu/internal/command/run"
	"github.com/go-nunu/nunu/internal/command/upgrade"
	"github.com/spf13/cobra"
)

var CmdRoot = &cobra.Command{
	Use:           "nunu",
	Example:       "nunu new demo-api",
	Short:         "\n _   _                   \n| \\ | |_   _ _ __  _   _ \n|  \\| | | | | '_ \\| | | |\n| |\\  | |_| | | | | |_| |\n|_| \\_|\\__,_|_| |_|\\__,_| \n \n" + "\x1B[38;2;66;211;146mA\x1B[39m \x1B[38;2;67;209;149mC\x1B[39m\x1B[38;2;68;206;152mL\x1B[39m\x1B[38;2;69;204;155mI\x1B[39m \x1B[38;2;70;201;158mt\x1B[39m\x1B[38;2;71;199;162mo\x1B[39m\x1B[38;2;72;196;165mo\x1B[39m\x1B[38;2;73;194;168ml\x1B[39m \x1B[38;2;74;192;171mf\x1B[39m\x1B[38;2;75;189;174mo\x1B[39m\x1B[38;2;76;187;177mr\x1B[39m \x1B[38;2;77;184;180mb\x1B[39m\x1B[38;2;78;182;183mu\x1B[39m\x1B[38;2;79;179;186mi\x1B[39m\x1B[38;2;80;177;190ml\x1B[39m\x1B[38;2;81;175;193md\x1B[39m\x1B[38;2;82;172;196mi\x1B[39m\x1B[38;2;83;170;199mn\x1B[39m\x1B[38;2;83;167;202mg\x1B[39m \x1B[38;2;84;165;205mg\x1B[39m\x1B[38;2;85;162;208mo\x1B[39m \x1B[38;2;86;160;211ma\x1B[39m\x1B[38;2;87;158;215mp\x1B[39m\x1B[38;2;88;155;218ml\x1B[39m\x1B[38;2;89;153;221mi\x1B[39m\x1B[38;2;90;150;224mc\x1B[39m\x1B[38;2;91;148;227ma\x1B[39m\x1B[38;2;92;145;230mt\x1B[39m\x1B[38;2;93;143;233mi\x1B[39m\x1B[38;2;94;141;236mo\x1B[39m\x1B[38;2;95;138;239mn\x1B[39m\x1B[38;2;96;136;243m.\x1B[39m",
	Version:       fmt.Sprintf("\n _   _                   \n| \\ | |_   _ _ __  _   _ \n|  \\| | | | | '_ \\| | | |\n| |\\  | |_| | | | | |_| |\n|_| \\_|\\__,_|_| |_|\\__,_| \n \nNunu %s - Copyright (c) 2023-2026 Nunu\nReleased under the MIT License.\n\n", config.Version),
	SilenceErrors: true,
	SilenceUsage:  true,
}

func init() {
	CmdRoot.AddCommand(new.CmdNew)
	CmdRoot.AddCommand(create.CmdCreate)
	CmdRoot.AddCommand(run.CmdRun)

	CmdRoot.AddCommand(upgrade.CmdUpgrade)
	create.CmdCreate.AddCommand(create.CmdCreateHandler)
	create.CmdCreate.AddCommand(create.CmdCreateService)
	create.CmdCreate.AddCommand(create.CmdCreateRepository)
	create.CmdCreate.AddCommand(create.CmdCreateModel)
	create.CmdCreate.AddCommand(create.CmdCreateAll)

	CmdRoot.AddCommand(wire.CmdWire)
	wire.CmdWire.AddCommand(wire.CmdWireAll)
}

// Execute executes the root command.
func Execute() error {
	return CmdRoot.Execute()
}

```

### Core Architecture Module: `config/config.go`
```
package config

var (
	Version       = "1.1.6"
	WireCmd       = "github.com/google/wire/cmd/wire@latest"
	NunuCmd       = "github.com/go-nunu/nunu@latest"
	RepoBase      = "https://github.com/go-nunu/nunu-layout-base.git"
	RepoAdvanced  = "https://github.com/go-nunu/nunu-layout-advanced.git"
	RepoAdmin     = "https://github.com/go-nunu/nunu-layout-admin.git"
	RepoChat      = "https://github.com/go-nunu/nunu-layout-chat.git"
	RepoMCP       = "https://github.com/go-nunu/nunu-layout-mcp.git"
	RepoMonorepo  = "https://github.com/go-nunu/nunu-layout-monorepo.git"
	RunExcludeDir = ".git,.idea,tmp,vendor,node_modules"
	RunIncludeExt = "go,html,yaml,yml,toml,ini,json,xml,tpl,tmpl"
)

```

### Core Architecture Module: `internal/command/create/create.go`
```
package create

import (
	"bytes"
	"fmt"
	"go/token"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/duke-git/lancet/v2/strutil"
	"github.com/go-nunu/nunu/internal/pkg/helper"
	"github.com/go-nunu/nunu/tpl"
	"github.com/spf13/cobra"
)

type Create struct {
	ProjectRoot          string
	ProjectName          string
	CreateType           string
	FilePath             string
	FileName             string
	StructName           string
	StructNameLowerFirst string
	StructNameFirstChar  string
	StructNameSnakeCase  string
	IsFull               bool
}

func NewCreate() *Create {
	return &Create{}
}

var CmdCreate = &cobra.Command{
	Use:     "create",
	Short:   "Create a new handler/service/repository/model",
	Example: "nunu create handler user",
	Args:    cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		return cmd.Help()
	},
}
var (
	tplPath string
)

func init() {
	CmdCreateHandler.Flags().StringVarP(&tplPath, "tpl-path", "t", tplPath, "template path")
	CmdCreateService.Flags().StringVarP(&tplPath, "tpl-path", "t", tplPath, "template path")
	CmdCreateRepository.Flags().StringVarP(&tplPath, "tpl-path", "t", tplPath, "template path")
	CmdCreateModel.Flags().StringVarP(&tplPath, "tpl-path", "t", tplPath, "template path")
	CmdCreateAll.Flags().StringVarP(&tplPath, "tpl-path", "t", tplPath, "template path")

}

var CmdCreateHandler = &cobra.Command{
	Use:     "handler <name>",
	Short:   "Create a new handler",
	Example: "nunu create handler user",
	Args:    cobra.ExactArgs(1),
	RunE:    runCreate,
}
var CmdCreateService = &cobra.Command{
	Use:     "service <name>",
	Short:   "Create a new service",
	Example: "nunu create service user",
	Args:    cobra.ExactArgs(1),
	RunE:    runCreate,
}
var CmdCreateRepository = &cobra.Command{
	Use:     "repository <name>",
	Short:   "Create a new repository",
	Example: "nunu create repository user",
	Args:    cobra.ExactArgs(1),
	RunE:    runCreate,
}
var CmdCreateModel = &cobra.Command{
	Use:     "model <name>",
	Short:   "Create a new model",
	Example: "nunu create model user",
	Args:    cobra.ExactArgs(1),
	RunE:    runCreate,
}
var CmdCreateAll = &cobra.Command{
	Use:     "all <name>",
	Short:   "Create a new handler & service & repository & model",
	Example: "nunu create all user",
	Args:    cobra.ExactArgs(1),
	RunE:    runCreate,
}

func runCreate(cmd *cobra.Command, args []string) error {
	c := NewCreate()
	projectRoot, err := helper.FindProjectRoot(".")
	if err != nil {
		return fmt.Errorf("determine project root: %w", err)
	}
	projectName, err := helper.ReadModulePath(projectRoot)
	if err != nil {
		return fmt.Errorf("determine project module: %w", err)
	}
	c.ProjectRoot = projectRoot
	c.ProjectName = projectName
	c.CreateType = cmd.Name()
	c.FilePath, c.StructName = filepath.Split(args[0])
	c.FileName = strings.TrimSuffix(c.StructName, ".go")
	if c.FileName == "" {
		return fmt.Errorf("component name cannot be empty")
	}
	c.StructName = strutil.UpperFirst(strutil.CamelCase(c.FileName))
	if c.StructName == "" || !token.IsIdentifier(c.StructName) {
		return fmt.Errorf("component name %q does not contain a valid identifier", c.FileName)
	}
	c.StructNameLowerFirst = strutil.LowerFirst(c.StructName)
	c.StructNameFirstChar = string(c.StructNameLowerFirst[0])
	c.StructNameSnakeCase = strutil.SnakeCase(c.StructName)

	switch c.CreateType {
	case "handler", "service", "repository", "model":
		return c.genFile()
	case "all":
		c.CreateType = "handler"
		if err := c.genFile(); err != nil {
			return err
		}

		c.CreateType = "service"
		if err := c.genFile(); err != nil {
			return err
		}

		c.CreateType = "repository"
		if err := c.genFile(); err != nil {
			return err
		}

		c.CreateType = "model"
		return c.genFile()
	default:
		return fmt.Errorf("invalid handler type: %s", c.CreateType)
	}
}
func (c *Create) genFile() error {
	filePath := c.FilePath
	if filePath == "" {
		filePath = filepath.Join(c.ProjectRoot, "internal", c.CreateType)
	}
	filename := strings.ToLower(c.FileName) + ".go"
	targetPath := filepath.Join(filePath, filename)
	var t *template.Template
	var err error
	if tplPath == "" {
		t, err = template.ParseFS(tpl.CreateTemplateFS, fmt.Sprintf("create/%s.tpl", c.CreateType))
	} else {
		t, err = template.ParseFiles(path.Join(tplPath, fmt.Sprintf("%s.tpl", c.CreateType)))
	}
	if err != nil {
		return fmt.Errorf("create %s: %w", c.CreateType, err)
	}
	var rendered bytes.Buffer
	if err := t.Execute(&rendered, c); err != nil {
		return fmt.Errorf("create %s: %w", c.CreateType, err)
	}

	f, err := createFile(filePath, filename)
	if err != nil {
		return err
	}
	if f == nil {
		log.Printf("warn: file %s already exists.", targetPath)
		return nil
	}
	writeSucceeded := false
	defer func() {
		_ = f.Close()
		if !writeSucceeded {
			_ = os.Remove(targetPath)
		}
	}()
	if _, err := f.Write(rendered.Bytes()); err != nil {
		return fmt.Errorf("write %s: %w", targetPath, err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close %s: %w", targetPath, err)
	}
	writeSucceeded = true
	log.Printf("Created new %s: %s", c.CreateType, targetPath)
	return nil
}
func createFile(dirPath string, filename string) (*os.File, error) {
	filePath := filepath.Join(dirPath, filename)
	err := os.MkdirAll(dirPath, os.ModePerm)
	if err != nil {
		return nil, fmt.Errorf("create dir %s: %w", dirPath, err)
	}
	file, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if os.IsExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("create file %s: %w", filePath, err)
	}

	return file, nil
}

```

### Core Architecture Module: `internal/command/new/new.go`
```
package new

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/AlecAivazis/survey/v2"
	"github.com/go-nunu/nunu/config"
	"github.com/go-nunu/nunu/internal/pkg/helper"
	"github.com/spf13/cobra"
)

type Project struct {
	ProjectName string `survey:"name"`
}

var CmdNew = &cobra.Command{
	Use:     "new [project-name]",
	Example: "nunu new demo-api",
	Short:   "create a new project.",
	Long:    `create a new project with nunu layout.`,
	Args:    cobra.MaximumNArgs(1),
	RunE:    run,
}
var (
	repoURL string
	askOne  = survey.AskOne
)

type layoutOption struct {
	Name        string
	Repo        string
	Description string
}

var layoutOptions = []layoutOption{
	{
		Name:        "Advanced",
		Repo:        config.RepoAdvanced,
		Description: "Full-featured API service with examples for database, Redis, JWT, cron, migration, and tests.",
	},
	{
		Name:        "Basic",
		Repo:        config.RepoBase,
		Description: "Minimal layered API service for projects that only need the core Nunu structure.",
	},
	{
		Name:        "Admin",
		Repo:        config.RepoAdmin,
		Description: "Admin system template with Gin APIs, Vue 3 UI, JWT authentication, and Casbin RBAC.",
	},
	{
		Name:        "MCP Server",
		Repo:        config.RepoMCP,
		Description: "Model Context Protocol server template with STDIO, SSE, and Streamable HTTP transports.",
	},
	{
		Name:        "Monorepo",
		Repo:        config.RepoMonorepo,
		Description: "Multi-application workspace with shared packages, admin backend, embedded UI, and home app.",
	},
	{
		Name:        "Chat",
		Repo:        config.RepoChat,
		Description: "Real-time service template with WebSocket and TCP chat server examples.",
	},
}

func layoutNames() []string {
	names := make([]string, 0, len(layoutOptions))
	for _, option := range layoutOptions {
		names = append(names, option.Name)
	}
	return names
}

func findLayoutOption(name string) (layoutOption, bool) {
	for _, option := range layoutOptions {
		if option.Name == name {
			return option, true
		}
	}
	return layoutOption{}, false
}

func init() {
	CmdNew.Flags().StringVarP(&repoURL, "repo-url", "r", repoURL, "layout repo")

}
func NewProject() *Project {
	return &Project{}
}

func run(cmd *cobra.Command, args []string) error {
	p := NewProject()
	if len(args) == 0 {
		err := askOne(&survey.Input{
			Message: "What is your project name?",
			Help:    "project name.",
			Suggest: nil,
		}, &p.ProjectName, survey.WithValidator(survey.Required))
		if err != nil {
			return err
		}
	} else {
		p.ProjectName = args[0]
	}

	// clone repo
	cloned, err := p.cloneTemplate()
	if err != nil || !cloned {
		return err
	}

	err = p.replacePackageName()
	if err != nil {
		return err
	}
	err = p.modTidy()
	if err != nil {
		return err
	}
	if err := p.rmGit(); err != nil {
		return err
	}
	if err := p.installWire(); err != nil {
		return err
	}
	fmt.Printf("\n _   _                   \n| \\ | |_   _ _ __  _   _ \n|  \\| | | | | '_ \\| | | |\n| |\\  | |_| | | | | |_| |\n|_| \\_|\\__,_|_| |_|\\__,_| \n \n" + "\x1B[38;2;66;211;146mA\x1B[39m \x1B[38;2;67;209;149mC\x1B[39m\x1B[38;2;68;206;152mL\x1B[39m\x1B[38;2;69;204;155mI\x1B[39m \x1B[38;2;70;201;158mt\x1B[39m\x1B[38;2;71;199;162mo\x1B[39m\x1B[38;2;72;196;165mo\x1B[39m\x1B[38;2;73;194;168ml\x1B[39m \x1B[38;2;74;192;171mf\x1B[39m\x1B[38;2;75;189;174mo\x1B[39m\x1B[38;2;76;187;177mr\x1B[39m \x1B[38;2;77;184;180mb\x1B[39m\x1B[38;2;78;182;183mu\x1B[39m\x1B[38;2;79;179;186mi\x1B[39m\x1B[38;2;80;177;190ml\x1B[39m\x1B[38;2;81;175;193md\x1B[39m\x1B[38;2;82;172;196mi\x1B[39m\x1B[38;2;83;170;199mn\x1B[39m\x1B[38;2;83;167;202mg\x1B[39m \x1B[38;2;84;165;205mg\x1B[39m\x1B[38;2;85;162;208mo\x1B[39m \x1B[38;2;86;160;211ma\x1B[39m\x1B[38;2;87;158;215mp\x1B[39m\x1B[38;2;88;155;218ml\x1B[39m\x1B[38;2;89;153;221mi\x1B[39m\x1B[38;2;90;150;224mc\x1B[39m\x1B[38;2;91;148;227ma\x1B[39m\x1B[38;2;92;145;230mt\x1B[39m\x1B[38;2;93;143;233mi\x1B[39m\x1B[38;2;94;141;236mo\x1B[39m\x1B[38;2;95;138;239mn\x1B[39m\x1B[38;2;96;136;243m.\x1B[39m\n\n")
	fmt.Printf("🎉 Project \u001B[36m%s\u001B[0m created successfully!\n\n", p.ProjectName)
	fmt.Printf("Done. Now run:\n\n")
	fmt.Printf("› \033[36mcd %s \033[0m\n", p.ProjectName)
	fmt.Printf("› \033[36mnunu run \033[0m\n\n")
	return nil
}

func (p *Project) cloneTemplate() (bool, error) {
	overwrite := false
	_, err := os.Stat(p.ProjectName)
	if err == nil {
		prompt := &survey.Confirm{
			Message: fmt.Sprintf("Folder %s already exists, do you want to overwrite it?", p.ProjectName),
			Help:    "Remove old project and create new project.",
		}
		err := askOne(prompt, &overwrite)
		if err != nil {
			return false, err
		}
		if !overwrite {
			return false, nil
		}
	} else if !os.IsNotExist(err) {
		return false, fmt.Errorf("stat project directory: %w", err)
	}
	repo := config.RepoBase

	if repoURL == "" {
		layout := ""
		prompt := &survey.Select{
			Message: "Please select a layout:",
			Options: layoutNames(),
			Description: func(value string, index int) string {
				option, ok := findLayoutOption(value)
				if !ok {
					return ""
				}
				return option.Description
			},
		}
		err := askOne(prompt, &layout)
		if err != nil {
			return false, err
		}
		if option, ok := findLayoutOption(layout); ok {
			repo = option.Repo
		}
	} else {
		repo = repoURL
	}
	if overwrite {
		if err := os.RemoveAll(p.ProjectName); err != nil {
			return false, fmt.Errorf("remove old project: %w", err)
		}
	}

	fmt.Printf("git clone %s\n", repo)
	cmd := exec.Command("git", "clone", repo, p.ProjectName)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false, fmt.Errorf("git clone %s: %w\n%s", repo, err, out)
	}
	return true, nil
}

func (p *Project) replacePackageName() error {
	packageName, err := helper.ReadModulePath(p.ProjectName)
	if err != nil {
		return fmt.Errorf("read module name from %s/go.mod: %w", p.ProjectName, err)
	}

	err = p.replaceFiles(packageName)
	if err != nil {
		return err
	}

	cmd := exec.Command("go", "mod", "edit", "-module", p.ProjectName)
	cmd.Dir = p.ProjectName
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("go mod edit: %w\n%s", err, out)
	}
	return nil
}
func (p *Project) modTidy() error {
	fmt.Println("go mod tidy")
	cmd := exec.Command("go", "mod", "tidy")
	cmd.Dir = p.ProjectName
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("go mod tidy: %w\n%s", err, out)
	}
	return nil
}
func (p *Project) rmGit() error {
	gitDir := filepath.Join(p.ProjectName, ".git")
	if err := os.RemoveAll(gitDir); err != nil {
		return fmt.Errorf("remove template git metadata %s: %w", gitDir, err)
	}
	return nil
}
func (p *Project) installWire() error {
	fmt.Printf("go install %s\n", config.WireCmd)
	cmd := exec.Command("go", "install", config.WireCmd)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("go install %s: %w", config.WireCmd, err)
	}
	return nil
}

func (p *Project) replaceFiles(packageName string) error {
	err := filepath.Walk(p.ProjectName, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".go" {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		newData := bytes.ReplaceAll(data, []byte(packageName), []byte(p.ProjectName))
		if err := os.WriteFile(path, newData, 0644); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("walk file: %w", err)
	}
	return nil
}

```

### Core Architecture Module: `internal/command/run/path.go`
```
package run

import (
	"strings"
)

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}

func includeExtSet(value string) map[string]struct{} {
	exts := splitCSV(value)
	includeExtMap := make(map[string]struct{}, len(exts))
	for _, ext := range exts {
		includeExtMap[strings.TrimPrefix(strings.ToLower(ext), ".")] = struct{}{}
	}
	return includeExtMap
}

```

### Core Architecture Module: `internal/command/run/run.go`
```
package run

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/fsnotify/fsnotify"
	"github.com/go-nunu/nunu/config"
	"github.com/go-nunu/nunu/internal/pkg/helper"
	"github.com/go-nunu/nunu/internal/pkg/pathignore"
	"github.com/kballard/go-shellquote"
	"github.com/spf13/cobra"
)

const (
	reloadDebounce  = 300 * time.Millisecond
	shutdownTimeout = 5 * time.Second
)

var excludeDir string
var includeExt string
var buildFlags string

func init() {
	CmdRun.Flags().StringVar(&excludeDir, "excludeDir", config.RunExcludeDir, `comma-separated gitignore patterns; eg: "node_modules,**/.cache,tmp-*"`)
	CmdRun.Flags().StringVar(&includeExt, "includeExt", config.RunIncludeExt, `eg: nunu run --includeExt="go,tpl,tmpl,html,yaml,yml,toml,ini,json"`)
	CmdRun.Flags().StringVar(&buildFlags, "buildFlags", "", `eg: nunu run --buildFlags="-tags cse"`)
}

var CmdRun = &cobra.Command{
	Use:     "run [directory] [-- program arguments...]",
	Short:   "Run a Go application and reload it when project files change",
	Long:    "Run a Go application and reload it when project files change",
	Example: "nunu run cmd/server -- --config config/local.yml",
	Args: func(cmd *cobra.Command, args []string) error {
		cmdArgs, _ := helper.SplitArgs(cmd, args)
		if len(cmdArgs) > 1 {
			return fmt.Errorf("accepts at most one application directory, received %d", len(cmdArgs))
		}
		return nil
	},
	RunE: run,
}

func run(cmd *cobra.Command, args []string) error {
	cmdArgs, programArgs := helper.SplitArgs(cmd, args)
	var dir string
	if len(cmdArgs) == 1 {
		dir = cmdArgs[0]
	}
	if dir == "" {
		base, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("get current directory: %w", err)
		}
		if projectRoot, rootErr := helper.FindProjectRoot(base); rootErr == nil {
			base = projectRoot
		}
		cmdPaths, err := helper.FindMain(base, excludeDir)
		if err != nil {
			return fmt.Errorf("find main package: %w", err)
		}
		switch len(cmdPaths) {
		case 0:
			return errors.New("main package not found in the current project")
		case 1:
			for _, path := range cmdPaths {
				dir = path
			}
		default:
			labels := make([]string, 0, len(cmdPaths))
			for label := range cmdPaths {
				labels = append(labels, label)
			}
			sort.Strings(labels)
			var selected string
			prompt := &survey.Select{
				Message:  "Which directory do you want to run?",
				Options:  labels,
				PageSize: 10,
			}
			if err := survey.AskOne(prompt, &selected); err != nil {
				return fmt.Errorf("select main package: %w", err)
			}
			if selected == "" {
				return errors.New("no main package selected")
			}
			dir = cmdPaths[selected]
		}
	}

	buildFlagsArgs, err := splitBuildFlags(buildFlags)
	if err != nil {
		return err
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(quit)

	fmt.Printf("\033[35mNunu run %s.\033[0m\n", dir)
	fmt.Printf("\033[35mWatch excludeDir %s\033[0m\n", excludeDir)
	fmt.Printf("\033[35mWatch includeExt %s\033[0m\n", includeExt)
	fmt.Printf("\033[35mWatch buildFlags %s\033[0m\n", buildFlags)
	return watch(dir, buildFlagsArgs, programArgs, quit)
}

type managedProcess struct {
	cmd  *exec.Cmd
	done chan error
}

func watch(dir string, buildFlagsArgs, programArgs []string, quit <-chan os.Signal) error {
	runTarget, watchRoot, err := resolveRunTarget(dir)
	if err != nil {
		return err
	}
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("create file watcher: %w", err)
	}
	defer watcher.Close()

	excludeMatcher, err := pathignore.CompileCSV(excludeDir)
	if err != nil {
		return fmt.Errorf("parse excludeDir: %w", err)
	}
	includeExts := includeExtSet(includeExt)
	if err := addWatchDirs(watcher, watchRoot, watchRoot, excludeMatcher); err != nil {
		return err
	}

	process, err := startProcess(watchRoot, runTarget, buildFlagsArgs, programArgs)
	if err != nil {
		return err
	}
	processDone := (<-chan error)(process.done)

	var debounceTimer *time.Timer
	var debounceC <-chan time.Time
	defer func() {
		if debounceTimer != nil {
			debounceTimer.Stop()
		}
	}()

	scheduleReload := func() {
		if debounceTimer == nil {
			debounceTimer = time.NewTimer(reloadDebounce)
		} else {
			if !debounceTimer.Stop() {
				select {
				case <-debounceTimer.C:
				default:
				}
			}
			debounceTimer.Reset(reloadDebounce)
		}
		debounceC = debounceTimer.C
	}

	for {
		select {
		case <-quit:
			if err := stopProcess(process, shutdownTimeout); err != nil {
				return fmt.Errorf("stop application: %w", err)
			}
			fmt.Printf("\033[31mserver exiting...\033[0m\n")
			return nil

		case processErr := <-processDone:
			process = nil
			processDone = nil
			if processErr != nil {
				fmt.Fprintf(os.Stderr, "\033[31mapplication exited: %v\033[0m\n", processErr)
			} else {
				fmt.Println("application exited")
			}

		case event, ok := <-watcher.Events:
			if !ok {
				return errors.New("file watcher event channel closed")
			}
			relevant, err := handleWatchEvent(watcher, watchRoot, event, excludeMatcher, includeExts)
			if err != nil {
				return err
			}
			if relevant {
				fmt.Printf("\033[36mfile modified: %s\033[0m\n", displayPath(watchRoot, event.Name))
				scheduleReload()
			}

		case watcherErr, ok := <-watcher.Errors:
			if !ok {
				return errors.New("file watcher error channel closed")
			}
			return fmt.Errorf("file watcher: %w", watcherErr)

		case <-debounceC:
			debounceC = nil
			if err := stopProcess(process, shutdownTimeout); err != nil {
				return fmt.Errorf("restart application: %w", err)
			}
			process, err = startProcess(watchRoot, runTarget, buildFlagsArgs, programArgs)
			if err != nil {
				return err
			}
			processDone = process.done
		}
	}
}

func splitBuildFlags(value string) ([]string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	args, err := shellquote.Split(value)
	if err != nil {
		return nil, fmt.Errorf("parse buildFlags: %w", err)
	}
	return args, nil
}

func resolveRunTarget(target string) (string, string, error) {
	absTarget, err := filepath.Abs(target)
	if err != nil {
		return "", "", fmt.Errorf("resolve run target %q: %w", target, err)
	}
	resolvedTarget, err := filepath.EvalSymlinks(absTarget)
	if err != nil {
		return "", "", fmt.Errorf("resolve run target symlinks %s: %w", absTarget, err)
	}
	absTarget = resolvedTarget
	info, err := os.Stat(absTarget)
	if err != nil {
		return "", "", fmt.Errorf("stat resolved run target %s: %w", absTarget, err)
	}
	rootStart := absTarget
	if !info.IsDir() {
		rootStart = filepath.Dir(absTarget)
	}
	watchRoot, err := helper.FindProjectRoot(rootStart)
	if err != nil {
		return "", "", fmt.Errorf("determine project root for %s: %w", absTarget, err)
	}
	return absTarget, watchRoot, nil
}

func addWatchDirs(watcher *fsnotify.Watcher, root, start string, excludeMatcher *pathignore.Matcher) error {
	err := filepath.WalkDir(start, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.IsDir() {
			return nil
		}
		if isExcludedFromRoot(root, path, true, excludeMatcher) {
			return filepath.SkipDir
		}
		if err := watcher.Add(path); err != nil {
			return fmt.Errorf("watch directory %s: %w", path, err)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("discover watch directories: %w", err)
	}
	return nil
}

func handleWatchEvent(watcher *fsnotify.Watcher, root string, event fsnotify.Event, excludeMatcher *pathignore.Matcher, includeExts map[string]struct{}) (bool, error) {
	if event.Op&(fsnotify.Create|fsnotify.Write|fsnotify.Remove|fsnotify.Rename) == 0 {
		return false, nil
	}
	if isExcludedFromRoot(root, event.Name, false, excludeMatcher) {
		return false, nil
	}

	if event.Op&fsnotify.Create != 0 {
		info, err := os.Stat(event.Name)
		if err == nil && info.IsDir() {
			if isExcludedFromRoot(root, event.Name, true, excludeMatcher) {
				return false, nil
			}
			if err := addWatchDirs(watcher, root, event.Name, excludeMatcher); err != nil {
				return false, err
			}
			return true, nil
		}
		if err != nil && !os.IsNotExist(err) {
			return false, fmt.Errorf("stat created path %s: %w", event.Name, err)
		}
	}

	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(event.Name)), ".")
	if _, ok := includeExts[ext]; ok {
		return true, nil
	}
	// A removed or renamed extensionless path may be a source directory.
	return ext == "" && event.Op&(fsnotify.Remove|fsnotify.Rename) != 0, nil
}

func isExcludedFromRoot(root, path string, isDir bool, excludeMatcher *pathignore.Matcher) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return true
	}
	return excludeMatcher.Match(filepath.ToSlash(rel), isDir)
}

func displayPath(root, path string) string {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return path
	}
	return filepath.ToSlash(rel)
}

func startProcess(projectRoot, dir string, buildFlagsArgs, programArgs []string) (*managedProcess, error) {
	args := []string{"run"}
	args = append(args, buildFlagsArgs...)
	args = append(args, dir)
	args = append(args, programArgs...)
	cmd := exec.Command("go", args...)
	cmd.Dir = projectRoot
	configureProcess(cmd)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start go %s: %w", strings.Join(args, " "), err)
	}

	process := &managedProcess{cmd: cmd, done: make(chan error, 1)}
	go func() {
		process.done <- cmd.Wait()
		close(process.done)
	}()
	fmt.Printf("\033[32;1mrunning (pid %d)...\033[0m\n", cmd.Process.Pid)
	return process, nil
}

func stopProcess(process *managedProcess, timeout time.Duration) error {
	if process == nil || process.cmd == nil || process.cmd.Process == nil {
		return nil
	}
	select {
	case <-process.done:
		return nil
	default:
	}

	interruptErr := interruptProcess(process.cmd)
	i
```

### Core Architecture Module: `internal/command/run/run_unix.go`
```
//go:build !plan9 && !windows
// +build !plan9,!windows

package run

import (
	"errors"
	"os/exec"
	"syscall"
)

func configureProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func interruptProcess(cmd *exec.Cmd) error {
	return signalProcessGroup(cmd, syscall.SIGINT)
}

func forceKillProcess(cmd *exec.Cmd) error {
	return signalProcessGroup(cmd, syscall.SIGKILL)
}

func signalProcessGroup(cmd *exec.Cmd, signal syscall.Signal) error {
	err := syscall.Kill(-cmd.Process.Pid, signal)
	if errors.Is(err, syscall.ESRCH) {
		return nil
	}
	return err
}

```

### Core Architecture Module: `internal/command/run/run_windows.go`
```
//go:build windows
// +build windows

package run

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

func configureProcess(_ *exec.Cmd) {}

func interruptProcess(cmd *exec.Cmd) error {
	return taskkill(cmd, false)
}

func forceKillProcess(cmd *exec.Cmd) error {
	return taskkill(cmd, true)
}

func taskkill(cmd *exec.Cmd, force bool) error {
	args := []string{"/T", "/PID", strconv.Itoa(cmd.Process.Pid)}
	if force {
		args = append([]string{"/F"}, args...)
	}
	out, err := exec.Command("taskkill", args...).CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(out))
		if message == "" {
			return fmt.Errorf("taskkill: %w", err)
		}
		return fmt.Errorf("taskkill: %w: %s", err, message)
	}
	return nil
}

```

### Core Architecture Module: `internal/command/upgrade/upgrade.go`
```
package upgrade

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/go-nunu/nunu/config"
	"github.com/spf13/cobra"
)

var CmdUpgrade = &cobra.Command{
	Use:     "upgrade",
	Short:   "Upgrade the nunu command.",
	Long:    "Upgrade the nunu command.",
	Example: "nunu upgrade",
	Args:    cobra.NoArgs,
	RunE: func(_ *cobra.Command, _ []string) error {
		fmt.Printf("go install %s\n", config.NunuCmd)
		cmd := exec.Command("go", "install", config.NunuCmd)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("go install %s: %w", config.NunuCmd, err)
		}
		fmt.Printf("\n🎉 Nunu upgrade successfully!\n\n")
		return nil
	},
}

```

### Core Architecture Module: `internal/command/wire/wire.go`
```
package wire

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"

	"github.com/AlecAivazis/survey/v2"
	"github.com/go-nunu/nunu/internal/pkg/helper"
	"github.com/spf13/cobra"
)

var CmdWire = &cobra.Command{
	Use:     "wire [directory]",
	Short:   "nunu wire [wire.go path]",
	Long:    "nunu wire [wire.go path]",
	Example: "nunu wire cmd/server",
	Args:    cobra.MaximumNArgs(1),
	RunE:    runWire,
}
var CmdWireAll = &cobra.Command{
	Use:     "all",
	Short:   "nunu wire all",
	Long:    "nunu wire all",
	Example: "nunu wire all",
	Args:    cobra.NoArgs,
	RunE:    runWireAll,
}

func runWire(_ *cobra.Command, args []string) error {
	var dir string
	if len(args) == 1 {
		dir = args[0]
	}
	if dir == "" {
		base, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("get current directory: %w", err)
		}
		wirePaths, err := findWire(base)
		if err != nil {
			return err
		}
		switch len(wirePaths) {
		case 0:
			return fmt.Errorf("wire.go not found in the current project")
		case 1:
			for _, path := range wirePaths {
				dir = path
			}
		default:
			labels := sortedKeys(wirePaths)
			var selected string
			prompt := &survey.Select{
				Message:  "Which directory do you want to run?",
				Options:  labels,
				PageSize: 10,
			}
			if err := survey.AskOne(prompt, &selected); err != nil {
				return fmt.Errorf("select wire directory: %w", err)
			}
			if selected == "" {
				return fmt.Errorf("no wire directory selected")
			}
			dir = wirePaths[selected]
		}
	}
	return wire(dir)
}

func runWireAll(_ *cobra.Command, _ []string) error {
	base, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("get current directory: %w", err)
	}
	wirePaths, err := findWire(base)
	if err != nil {
		return err
	}
	if len(wirePaths) == 0 {
		return fmt.Errorf("wire.go not found in the current project")
	}
	var wireErrors []error
	for _, label := range sortedKeys(wirePaths) {
		if err := wire(wirePaths[label]); err != nil {
			wireErrors = append(wireErrors, fmt.Errorf("generate %s: %w", label, err))
		}
	}
	return errors.Join(wireErrors...)
}

func wire(wirePath string) error {
	fmt.Println("wire.go path: ", wirePath)
	cmd := exec.Command("wire")
	cmd.Dir = wirePath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("run wire in %s: %w\n%s", wirePath, err, out)
	}
	if len(out) > 0 {
		fmt.Print(string(out))
	}
	return nil
}

func findWire(base string) (map[string]string, error) {
	base, err := filepath.Abs(base)
	if err != nil {
		return nil, fmt.Errorf("resolve search path: %w", err)
	}
	searchRoot := base
	if projectRoot, rootErr := helper.FindProjectRoot(base); rootErr == nil {
		searchRoot = projectRoot
	}

	wirePaths := make(map[string]string)
	err = filepath.WalkDir(searchRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			switch entry.Name() {
			case ".git", "vendor":
				if path != searchRoot {
					return filepath.SkipDir
				}
			}
			return nil
		}
		if entry.Name() != "wire.go" {
			return nil
		}
		rel, err := filepath.Rel(searchRoot, path)
		if err != nil {
			return err
		}
		wirePaths[filepath.ToSlash(rel)] = filepath.Dir(path)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("search for wire.go: %w", err)
	}
	return wirePaths, nil
}

func sortedKeys(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

```

### Core Architecture Module: `internal/pkg/helper/helper.go`
```
package helper

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-nunu/nunu/internal/pkg/pathignore"
	"github.com/spf13/cobra"
	"golang.org/x/mod/modfile"
)

// FindProjectRoot returns the closest parent directory containing a go.mod.
func FindProjectRoot(start string) (string, error) {
	dir, err := filepath.Abs(start)
	if err != nil {
		return "", fmt.Errorf("resolve project path %q: %w", start, err)
	}

	for {
		modPath := filepath.Join(dir, "go.mod")
		info, statErr := os.Stat(modPath)
		if statErr == nil {
			if info.IsDir() {
				return "", fmt.Errorf("%s is a directory, not a file", modPath)
			}
			return dir, nil
		}
		if !os.IsNotExist(statErr) {
			return "", fmt.Errorf("stat %s: %w", modPath, statErr)
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod not found from %s to filesystem root", start)
		}
		dir = parent
	}
}

// GetProjectName reads the module path from the closest go.mod at or above dir.
func GetProjectName(dir string) (string, error) {
	root, err := FindProjectRoot(dir)
	if err != nil {
		return "", err
	}
	return ReadModulePath(root)
}

// ReadModulePath reads the module path from go.mod in dir without searching
// parent directories. It is useful when validating a newly cloned project.
func ReadModulePath(dir string) (string, error) {
	root, err := filepath.Abs(dir)
	if err != nil {
		return "", fmt.Errorf("resolve module directory %q: %w", dir, err)
	}
	modPath := filepath.Join(root, "go.mod")
	data, err := os.ReadFile(modPath)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", modPath, err)
	}
	parsed, err := modfile.Parse(modPath, data, nil)
	if err != nil {
		return "", fmt.Errorf("parse %s: %w", modPath, err)
	}
	if parsed.Module == nil || parsed.Module.Mod.Path == "" {
		return "", fmt.Errorf("module directive not found in %s", modPath)
	}
	return parsed.Module.Mod.Path, nil
}

func SplitArgs(cmd *cobra.Command, args []string) (cmdArgs, programArgs []string) {
	dashAt := cmd.ArgsLenAtDash()
	if dashAt >= 0 {
		return args[:dashAt], args[dashAt:]
	}
	return args, []string{}
}
func FindMain(base, excludeDir string) (map[string]string, error) {
	base, err := filepath.Abs(base)
	if err != nil {
		return nil, fmt.Errorf("resolve search path: %w", err)
	}
	excludeMatcher, err := pathignore.CompileCSV(excludeDir)
	if err != nil {
		return nil, fmt.Errorf("parse excluded directories: %w", err)
	}
	cmdPath := make(map[string]string)
	seenDirs := make(map[string]struct{})
	err = filepath.WalkDir(base, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relPath, err := filepath.Rel(base, path)
		if err != nil {
			return err
		}
		if excludeMatcher.Match(filepath.ToSlash(relPath), entry.IsDir()) {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.IsDir() || filepath.Ext(path) != ".go" || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		isMain, err := isMainFile(path)
		if err != nil {
			return err
		}
		if !isMain {
			return nil
		}

		dir := filepath.Dir(path)
		if _, exists := seenDirs[dir]; exists {
			return nil
		}
		seenDirs[dir] = struct{}{}
		cmdPath[filepath.ToSlash(relPath)] = dir
		return nil
	})
	if err != nil {
		return nil, err
	}
	return cmdPath, nil
}

func isMainFile(path string) (bool, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return false, fmt.Errorf("read %s: %w", path, err)
	}
	file, _ := parser.ParseFile(token.NewFileSet(), path, content, parser.SkipObjectResolution)
	if file == nil {
		return false, nil
	}
	if file.Name.Name != "main" {
		return false, nil
	}
	for _, declaration := range file.Decls {
		function, ok := declaration.(*ast.FuncDecl)
		if ok && function.Recv == nil && function.Name.Name == "main" {
			return true, nil
		}
	}
	return false, nil
}

```

### Core Architecture Module: `internal/pkg/pathignore/pathignore.go`
```
package pathignore

import (
	"fmt"
	"path"
	"runtime"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
)

// Matcher applies comma-separated ignore patterns using gitignore-style path
// semantics. Patterns without a slash match a name at any directory depth;
// patterns containing a slash are relative to the project root.
type Matcher struct {
	rules []rule
}

type rule struct {
	pattern       string
	negated       bool
	directoryOnly bool
	basenameOnly  bool
	contentsOnly  bool
	contentsBase  string
}

// CompileCSV compiles the value accepted by nunu's --excludeDir flag.
func CompileCSV(value string) (*Matcher, error) {
	parts := strings.Split(value, ",")
	rules := make([]rule, 0, len(parts))
	for index, part := range parts {
		pattern := strings.TrimSpace(part)
		if pattern == "" || strings.HasPrefix(pattern, "#") {
			continue
		}

		negated := strings.HasPrefix(pattern, "!")
		if negated {
			pattern = strings.TrimSpace(strings.TrimPrefix(pattern, "!"))
		}
		if pattern == "" {
			return nil, fmt.Errorf("exclude pattern %d has no value after the negation marker", index+1)
		}

		// Flags are commonly copied between Unix and Windows shells. Internally
		// all matching uses slash-separated paths so the same value is portable.
		pattern = strings.ReplaceAll(pattern, `\`, "/")
		directoryOnly := strings.HasSuffix(pattern, "/")
		pattern = strings.TrimSuffix(pattern, "/")
		pattern = strings.TrimPrefix(pattern, "/")
		pattern = strings.TrimPrefix(pattern, "./")
		pattern = path.Clean(pattern)
		if pattern == "." || pattern == "" {
			return nil, fmt.Errorf("exclude pattern %d does not identify a path", index+1)
		}
		if !doublestar.ValidatePattern(pattern) {
			return nil, fmt.Errorf("invalid exclude pattern %q", part)
		}

		contentsBase := strings.TrimSuffix(pattern, "/**")
		rules = append(rules, rule{
			pattern:       normalizeCase(pattern),
			negated:       negated,
			directoryOnly: directoryOnly,
			basenameOnly:  !strings.Contains(pattern, "/"),
			contentsOnly:  contentsBase != pattern,
			contentsBase:  normalizeCase(contentsBase),
		})
	}
	return &Matcher{rules: rules}, nil
}

// Match reports whether a project-relative path should be ignored. isDir is
// required for patterns ending in a slash.
func (m *Matcher) Match(name string, isDir bool) bool {
	if m == nil {
		return false
	}
	name = normalizePath(name)
	if name == "" {
		return false
	}

	ignored := false
	for _, rule := range m.rules {
		if rule.matches(name, isDir) {
			ignored = !rule.negated
		}
	}
	return ignored
}

func (r rule) matches(name string, isDir bool) bool {
	parts := strings.Split(name, "/")
	if r.basenameOnly {
		for index, part := range parts {
			candidateIsDir := index < len(parts)-1 || isDir
			if r.directoryOnly && !candidateIsDir {
				continue
			}
			if doublestar.MatchUnvalidated(r.pattern, part) {
				return true
			}
		}
		return false
	}

	for index := range parts {
		candidate := strings.Join(parts[:index+1], "/")
		candidateIsDir := index < len(parts)-1 || isDir
		if r.directoryOnly && !candidateIsDir {
			continue
		}
		// In gitignore, dir/** ignores the contents of dir, not dir itself.
		// This distinction permits !dir/keep.go to re-include a direct child.
		if r.contentsOnly && candidate == r.contentsBase {
			continue
		}
		if doublestar.MatchUnvalidated(r.pattern, candidate) {
			return true
		}
	}
	return false
}

func normalizePath(name string) string {
	name = strings.ReplaceAll(name, `\`, "/")
	name = strings.TrimPrefix(name, "./")
	name = strings.TrimPrefix(name, "/")
	name = path.Clean(name)
	if name == "." {
		return ""
	}
	return normalizeCase(name)
}

func normalizeCase(value string) string {
	if runtime.GOOS == "windows" {
		return strings.ToLower(value)
	}
	return value
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #101** (2026-08-12): **docs: add Nunu Skills guidance**
  *Symptoms*: ## What changed  - add Nunu Skills guidance to the English, Japanese, Portuguese, and Chinese READMEs - document the `build-with-nunu` installation command and supported agent workflow  ## Why  Users need a discoverable path to the official Nunu Agent Skill from every maintained README language.  ## Validation  - verified the linked `go-nunu/nunu-skills` repository is public - checked the staged Markdown diff for whitespace errors 

- **Issue #100** (2026-08-12): **fix: harden hot reload for production**
  *Symptoms*: ## What changed  - make `--excludeDir` use comma-separated gitignore-style patterns with `*`, `?`, `**`, nested directory matching, negation, and portable separators - share the same exclusion matcher between main-package discovery and hot reload - resolve explicit run targets to absolute paths, derive the watch root from the target project, and run Go from that project root - avoid deleting an existing project before layout selection completes - avoid leaving empty or partial generated files when template rendering fails - raise the Go baseline to 1.25.8 and set the CLI version to 1.1.6  ## Root cause  The previous exclusion implementation compared only project-root prefixes. A default pattern such as `node_modules` excluded `/node_modules` but not `/app/admin/web/node_modules`. On macOS, fsnotify's kqueue backend opens file descriptors for watched directory entries, so a real monorepo attempted to cover more than 94,000 dependency files and failed with `too many open files`.  The watcher also derived its root from the process working directory instead of the selected run target, and passed relative package paths to `go run` without normalization.  ## User impact  Monorepos can run with the existing default exclusions without traversing nested frontend dependencies. Existing `--excludeDir` values remain compatible, while wildcard patterns are now supported.  ## Validation  - `go test ./...` - `go test -race ./...` - `go vet ./...` - latest Staticcheck - govulncheck: no reach

- **Issue #99** (2026-08-12): **feat: stabilize CLI runtime and command handling**
  *Symptoms*: ## What changed  - rebuild hot reload around recursive directory watches, debounced events, and managed process shutdown on Unix and Windows - parse project modules and Go entry points with Go tooling instead of string matching - propagate command failures through Cobra with consistent non-zero exit codes and argument validation - raise the supported Go baseline to 1.25 and update direct and transitive dependencies - add unit and real-process integration coverage for create, run, wire, and project discovery  ## Why  The previous watcher missed newly created and atomically replaced files, could restart repeatedly for one save, and did not reliably reap child processes. Several commands also printed failures while returning a successful exit status, and project discovery relied on platform-sensitive string operations.  ## Compatibility  - Existing `run` flags and program argument forwarding remain supported. - The minimum supported Go version is now Go 1.25. - Release version: `v1.1.5`.  ## Validation  - Go 1.25.12: `go test -count=1 ./...` - Go 1.26.5: `go test -race -count=1 ./...` - `go vet ./...` - `staticcheck ./...` - `govulncheck ./...` — no vulnerabilities found - Linux amd64/arm64 and Windows amd64/arm64 cross-builds - real `nunu new` smoke builds for Basic, Advanced, Admin, MCP, Monorepo, and Chat layouts 

- **Issue #96** (2025-10-01): **升级到v1.1.3后发现增加了router文件夹，路由可以单独处理了，nunu create是否也应该更新一下？**
  *Symptoms*: 如题目
  **Post-Mortem & Fix Analysis**:
  > 暂时没有相关计划。高级layout新增了router文件夹，只是给用户提供一种指引。大部分项目只有几十个API，可以不需要单独拎出来一个router目录
  > 随便一个企业项目可能都几百个api。。。

- **Issue #95** (2025-08-27): **wire依赖注入框架后续不更新了，这个后期会考虑更换吗**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 如果社区有更好的方案，会考虑更换。但我预计很长一段时间内，wire都是最好方案。
  > > 如果社区有更好的方案，会考虑更换。但我预计很长一段时间内，wire都是最好方案。  更好的方案已经来了 github.com/shanjunmei/dig, 同样的生成式di，但是拥有更友好的api，且支持闭包和泛型，也修改了原来wire.build 的 反直觉的 `return nil,nil`  ，它的最新版本已经完成自举

- **Issue #94** (2025-08-25): **Update getting-started.md**
  *Symptoms*: Fix the document error. The default  port is 8000. The ports should be uniform

- **Issue #93** (2025-08-24): **fix the document error**
  *Symptoms*: fix the document error，Fix the document error. The default should be port 8000. The ports should be uniform
  **Post-Mortem & Fix Analysis**:
  > The document does not currently fit into the main branch. Please merge it into the feature/docs branch

- **Issue #91** (2025-08-11): **添加buildFlags**
  *Symptoms*: 加上编译标志,例如: ``` go run -tags cse ./cmd/server/main.go ```
  **Post-Mortem & Fix Analysis**:
  > 我测试了有点问题，PR会导致`nunu run`不可用，可以按以下步骤自查下：  ```shell git clone -b buildFlags https://github.com/cn-kali-team/nunu.git  cd nunu && go install  nunu new test1 -r https://gitee.com/go-nunu/nunu-layout-basic  cd test1 && nunu run  ```  会出现下面的报错 ```shell Nunu run /home/chris/Projects/test1/cmd/server/. Watch excludeDir .git,.idea,tmp,vendor Watch includeExt go,html,yaml,yml,toml,ini,json,xml,tpl,tmpl Watch buildFlags no Go files in /home/chris/Projects/test1 ```
  > 改了,空字符串分割返回了[""]
  > 检查命令是否可用 ``` nunu run --buildFlags="-tag cse"   Nunu run /home/chris/Projects/nunu/test1/cmd/server/. Watch excludeDir .git,.idea,tmp,vendor Watch includeExt go,html,yaml,yml,toml,ini,json,xml,tpl,tmpl Watch buildFlags -tag cse flag provided but not defined: -tag usage: go run [build flags] [-exec xprog] package [arguments...] Run 'go help run' for details. running...  ```

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

### Incident Patch 1: `f20c7759` (2026-08-14)
**Commit Message**: Merge pull request #102 from SimonFoobar648/fix/star-history-chart

fix: restore broken star history chart in README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -223,4 +223,4 @@ Nunu is released under the MIT License. For more information, see the [LICENSE](
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

**File**: `README_jp.md` (modified, +1/-1)
```diff
@@ -221,4 +221,4 @@ Nunuは、MITライセンスの下でリリースされています。詳細に
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

**File**: `README_pt.md` (modified, +1/-1)
```diff
@@ -224,4 +224,4 @@ O Nunu é lançado sob a Licença MIT. Para mais informações, consulte o arqui
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -257,4 +257,4 @@ Nunu是根据MIT许可证发布的。有关更多信息，请参见[LICENSE](LIC
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

---

### Incident Patch 2: `c19e2a1e` (2026-08-14)
**Commit Message**: fix: restore broken star history chart in README

The star history chart in the READMEs is currently broken because of GitHub stargazer API restrictions. Switch it to a working alternative domain in all README versions.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -223,4 +223,4 @@ Nunu is released under the MIT License. For more information, see the [LICENSE](
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

**File**: `README_jp.md` (modified, +1/-1)
```diff
@@ -221,4 +221,4 @@ Nunuは、MITライセンスの下でリリースされています。詳細に
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

**File**: `README_pt.md` (modified, +1/-1)
```diff
@@ -224,4 +224,4 @@ O Nunu é lançado sob a Licença MIT. Para mais informações, consulte o arqui
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -257,4 +257,4 @@ Nunu是根据MIT许可证发布的。有关更多信息，请参见[LICENSE](LIC
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=go-nunu/nunu&type=Date)](https://star-history.com/#go-nunu/nunu&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=go-nunu/nunu&type=Date)](https://star-history.dera.page/#go-nunu/nunu&Date)
```

---

### Incident Patch 3: `dc369988` (2026-08-12)
**Commit Message**: docs: add Nunu Skills guidance

**File**: `README.md` (modified, +11/-0)
```diff
@@ -21,6 +21,17 @@ Nunu is a scaffolding tool for building Go applications. Its name comes from a g
 * [MCP Server](https://github.com/go-nunu/nunu-layout-mcp/blob/main/README.md)
 * [Monorepo Layout](https://github.com/go-nunu/nunu-layout-monorepo)
 
+## AI-assisted Development
+
+[Nunu Skills](https://github.com/go-nunu/nunu-skills) provides `build-with-nunu`, an Agent Skill that helps coding agents such as Codex and Claude Code understand Nunu project layouts and implement complete, tested features across handlers, services, repositories, routers, Wire dependency injection, jobs, tasks, and MCP servers.
+
+Install it in your project with:
+
+```bash
+npx skills add go-nunu/nunu-skills --skill build-with-nunu
+```
+
+See the [Nunu Skills repository](https://github.com/go-nunu/nunu-skills) for supported layouts, agent-specific installation options, and example prompts.
 
 ## Features
 - **Gin**: https://github.com/gin-gonic/gin
```

**File**: `README_jp.md` (modified, +12/-0)
```diff
@@ -18,6 +18,18 @@ Nunuは、Goアプリケーションを構築するためのスキャフォー
 * [MCP Server](https://github.com/go-nunu/nunu-layout-mcp/blob/main/README.md)
 * [Monorepo Layout](https://github.com/go-nunu/nunu-layout-monorepo)
 
+## AI支援開発
+
+[Nunu Skills](https://github.com/go-nunu/nunu-skills) は、`build-with-nunu` というAgent Skillを提供します。CodexやClaude CodeなどのコーディングエージェントがNunuのプロジェクト構成を理解し、ハンドラー、サービス、リポジトリ、ルーター、Wireによる依存性注入、ジョブ、タスク、MCP Serverにわたる、テスト済みの完全な機能を実装できるよう支援します。
+
+プロジェクトで次のコマンドを実行してインストールできます：
+
+```bash
+npx skills add go-nunu/nunu-skills --skill build-with-nunu
+```
+
+対応するプロジェクト構成、エージェント別のインストール方法、プロンプト例については、[Nunu Skillsリポジトリ](https://github.com/go-nunu/nunu-skills)を参照してください。
+
 ## 特徴
 - **Gin**: https://github.com/gin-gonic/gin
 - **Gorm**: https://github.com/go-gorm/gorm
```

**File**: `README_pt.md` (modified, +12/-0)
```diff
@@ -17,6 +17,18 @@ Nunu é uma ferramenta de geração de estrutura (scaffolding) para construir ap
 * [MCP Server](https://github.com/go-nunu/nunu-layout-mcp/blob/main/README.md)
 * [Monorepo Layout](https://github.com/go-nunu/nunu-layout-monorepo)
 
+## Desenvolvimento assistido por IA
+
+O [Nunu Skills](https://github.com/go-nunu/nunu-skills) oferece o `build-with-nunu`, uma Agent Skill que ajuda agentes de programação como Codex e Claude Code a entender as estruturas de projetos Nunu e implementar funcionalidades completas e testadas envolvendo handlers, serviços, repositórios, roteadores, injeção de dependência com Wire, jobs, tarefas e servidores MCP.
+
+Instale-o em seu projeto com:
+
+```bash
+npx skills add go-nunu/nunu-skills --skill build-with-nunu
+```
+
+Consulte o [repositório Nunu Skills](https://github.com/go-nunu/nunu-skills) para conhecer as estruturas compatíveis, as opções de instalação específicas para cada agente e exemplos de prompts.
+
 
 
 ## Funcionalidades
```

**File**: `README_zh.md` (modified, +12/-0)
```diff
@@ -18,6 +18,18 @@ Nunu是一个基于Golang的应用脚手架，它的名字来自于英雄联盟
 * [MCP Server](https://github.com/go-nunu/nunu-layout-mcp/blob/main/README_zh.md)
 * [Monorepo Layout](https://github.com/go-nunu/nunu-layout-monorepo)
 
+## AI 辅助开发
+
+[Nunu Skills](https://github.com/go-nunu/nunu-skills) 提供了 `build-with-nunu` Agent Skill，可帮助 Codex、Claude Code 等编码代理理解 Nunu 项目布局，并跨处理器、服务、仓储、路由、Wire 依赖注入、作业、任务和 MCP Server 实现经过完整测试的功能。
+
+在项目中运行以下命令即可安装：
+
+```bash
+npx skills add go-nunu/nunu-skills --skill build-with-nunu
+```
+
+有关支持的项目布局、不同编码代理的安装方式和示例提示词，请访问 [Nunu Skills 仓库](https://github.com/go-nunu/nunu-skills)。
+
 ## 功能
 - **Gin**: https://github.com/gin-gonic/gin
 - **Gorm**: https://github.com/go-gorm/gorm
```

---

### Incident Patch 4: `0e501e89` (2026-08-12)
**Commit Message**: fix: harden hot reload for production

**File**: `README.md` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ In addition, there are some other files and directories, such as license files,
 ## Requirements
 To use Nunu, you need to have the following software installed on your system:
 
-* Go 1.25 or higher
+* Go 1.25.8 or higher
 * Git
 * Docker (optional)
 * MySQL 5.7 or higher (optional)
```

**File**: `README_jp.md` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ Nunuは、クラシックなレイヤードアーキテクチャを採用して
 ## 要件
 Nunuを使用するには、システムに次のソフトウェアがインストールされている必要があります：
 
-* Go 1.25以上
+* Go 1.25.8以上
 * Git
 * Docker（オプション）
 * MySQL 5.7以上（オプション）
```

**File**: `README_pt.md` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ Além disso, existem outros arquivos e diretórios, como arquivos de licença, a
 ## Requisitos
 Para usar o Nunu, você precisa ter o seguinte software instalado em seu sistema:
 
-* Go 1.25 ou superior
+* Go 1.25.8 ou superior
 * Git
 * Docker (opcional)
 * MySQL 5.7 ou superior (opcional)
```

**File**: `config/config.go` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 package config
 
 var (
-	Version       = "1.1.5"
+	Version       = "1.1.6"
 	WireCmd       = "github.com/google/wire/cmd/wire@latest"
 	NunuCmd       = "github.com/go-nunu/nunu@latest"
 	RepoBase      = "https://github.com/go-nunu/nunu-layout-base.git"
```

**File**: `docs/en/tutorial.md` (modified, +2/-0)
```diff
@@ -213,6 +213,8 @@ nunu run ./cmd/server  --excludeDir=".git,.idea,tmp,vendor,node_modules" --inclu
 
 After running the above command, Nunu will automatically start the project and monitor file updates, supporting hot-reloading.
 
+`--excludeDir` accepts comma-separated gitignore-style patterns. A directory name such as `node_modules` matches at any depth; path patterns are relative to the project root. Wildcards including `*`, `?`, and `**` are supported, as are later negation rules such as `generated/**,!generated/keep.go`.
+
 
 
 ## Automatic Generation of Swagger Documentation
```

**File**: `docs/pt/tutorial.md` (modified, +2/-0)
```diff
@@ -211,6 +211,8 @@ nunu run ./cmd/server  --excludeDir=".git,.idea,tmp,vendor,node_modules" --inclu
 
 Após executar o comando acima, o Nunu iniciará automaticamente o projeto e monitorará atualizações de arquivos, suportando recarregamento em tempo real.
 
+`--excludeDir` aceita padrões no estilo `.gitignore` separados por vírgulas. Um nome de diretório como `node_modules` corresponde em qualquer nível; padrões com caminhos são relativos à raiz do projeto. Os curingas `*`, `?` e `**` são suportados, assim como regras de negação posteriores, por exemplo `generated/**,!generated/keep.go`.
+
 
 
 ## Geração Automática de Documentação Swagger
```

**File**: `docs/zh/tutorial.md` (modified, +2/-0)
```diff
@@ -221,6 +221,8 @@ nunu run
 
 执行完上述命令后，Nunu会自动启动项目，并监听文件更新，支持热重启。
 
+`--excludeDir` 接受以逗号分隔、类似 `.gitignore` 的匹配规则。`node_modules` 这样的目录名会匹配任意层级；带路径的规则相对于项目根目录匹配。支持 `*`、`?`、`**` 通配符，也支持使用后续否定规则重新包含文件，例如 `generated/**,!generated/keep.go`。
+
 
 ## 自动化生成Swagger文档
 
```

**File**: `go.mod` (modified, +2/-1)
```diff
@@ -1,9 +1,10 @@
 module github.com/go-nunu/nunu
 
-go 1.25.0
+go 1.25.8
 
 require (
 	github.com/AlecAivazis/survey/v2 v2.3.7
+	github.com/bmatcuk/doublestar/v4 v4.10.0
 	github.com/duke-git/lancet/v2 v2.3.9
 	github.com/fsnotify/fsnotify v1.10.1
 	github.com/kballard/go-shellquote v0.0.0-20180428030007-95032a82bc51
```

---

### Incident Patch 5: `ba07a4e8` (2026-04-26)
**Commit Message**: fix: update copyright year to 2026 in LICENSE and root.go

**File**: `LICENSE` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 MIT License
 
-Copyright (c) 2023-2025 Nunu
+Copyright (c) 2023-2026 Nunu
 
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
```

**File**: `cmd/nunu/root.go` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@ package nunu
 
 import (
 	"fmt"
+
 	"github.com/go-nunu/nunu/config"
 	"github.com/go-nunu/nunu/internal/command/wire"
 
@@ -16,7 +17,7 @@ var CmdRoot = &cobra.Command{
 	Use:     "nunu",
 	Example: "nunu new demo-api",
 	Short:   "\n _   _                   \n| \\ | |_   _ _ __  _   _ \n|  \\| | | | | '_ \\| | | |\n| |\\  | |_| | | | | |_| |\n|_| \\_|\\__,_|_| |_|\\__,_| \n \n" + "\x1B[38;2;66;211;146mA\x1B[39m \x1B[38;2;67;209;149mC\x1B[39m\x1B[38;2;68;206;152mL\x1B[39m\x1B[38;2;69;204;155mI\x1B[39m \x1B[38;2;70;201;158mt\x1B[39m\x1B[38;2;71;199;162mo\x1B[39m\x1B[38;2;72;196;165mo\x1B[39m\x1B[38;2;73;194;168ml\x1B[39m \x1B[38;2;74;192;171mf\x1B[39m\x1B[38;2;75;189;174mo\x1B[39m\x1B[38;2;76;187;177mr\x1B[39m \x1B[38;2;77;184;180mb\x1B[39m\x1B[38;2;78;182;183mu\x1B[39m\x1B[38;2;79;179;186mi\x1B[39m\x1B[38;2;80;177;190ml\x1B[39m\x1B[38;2;81;175;193md\x1B[39m\x1B[38;2;82;172;196mi\x1B[39m\x1B[38;2;83;170;199mn\x1B[39m\x1B[38;2;83;167;202mg\x1B[39m \x1B[38;2;84;165;205mg\x1B[39m\x1B[38;2;85;162;208mo\x1B[39m \x1B[38;2;86;160;211ma\x1B[39m\x1B[38;2;87;158;215mp\x1B[39m\x1B[38;2;88;155;218ml\x1B[39m\x1B[38;2;89;153;221mi\x1B[39m\x1B[38;2;90;150;224mc\x1B[39m\x1B[38;2;91;148;227ma\x1B[39m\x1B[38;2;92;145;230mt\x1B[39m\x1B[38;2;93;143;233mi\x1B[39m\x1B[38;2;94;141;236mo\x1B[39m\x1B[38;2;95;138;239mn\x1B[39m\x1B[38;2;96;136;243m.\x1B[39m",
-	Version: fmt.Sprintf("\n _   _                   \n| \\ | |_   _ _ __  _   _ \n|  \\| | | | | '_ \\| | | |\n| |\\  | |_| | | | | |_| |\n|_| \\_|\\__,_|_| |_|\\__,_| \n \nNunu %s - Copyright (c) 2023-2025 Nunu\nReleased under the MIT License.\n\n", config.Version),
+	Version: fmt.Sprintf("\n _   _                   \n| \\ | |_   _ _ __  _   _ \n|  \\| | | | | '_ \\| | | |\n| |\\  | |_| | | | | |_| |\n|_| \\_|\\__,_|_| |_|\\__,_| \n \nNunu %s - Copyright (c) 2023-2026 Nunu\nReleased under the MIT License.\n\n", config.Version),
 }
 
 func init() {
```

---

### Incident Patch 6: `ff10e5f1` (2025-08-11)
**Commit Message**: feat: add --buildFlags

**File**: `config/config.go` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 package config
 
 var (
-	Version       = "1.1.2"
+	Version       = "1.1.3"
 	WireCmd       = "github.com/google/wire/cmd/wire@latest"
 	NunuCmd       = "github.com/go-nunu/nunu@latest"
 	RepoBase      = "https://github.com/go-nunu/nunu-layout-base.git"
```

---

### Incident Patch 7: `de04cdb3` (2025-08-11)
**Commit Message**: Merge pull request #91 from cn-kali-team/buildFlags

添加buildFlags

**File**: `internal/command/run/run_unix.go` (modified, +16/-5)
```diff
@@ -5,7 +5,6 @@ package run
 
 import (
 	"fmt"
-	"github.com/go-nunu/nunu/config"
 	"log"
 	"os"
 	"os/exec"
@@ -16,6 +15,8 @@ import (
 	"syscall"
 	"time"
 
+	"github.com/go-nunu/nunu/config"
+
 	"github.com/AlecAivazis/survey/v2"
 	"github.com/fsnotify/fsnotify"
 	"github.com/go-nunu/nunu/internal/pkg/helper"
@@ -29,10 +30,12 @@ type Run struct {
 
 var excludeDir string
 var includeExt string
+var buildFlags string
 
 func init() {
 	CmdRun.Flags().StringVarP(&excludeDir, "excludeDir", "", excludeDir, `eg: nunu run --excludeDir="tmp,vendor,.git,.idea"`)
 	CmdRun.Flags().StringVarP(&includeExt, "includeExt", "", includeExt, `eg: nunu run --includeExt="go,tpl,tmpl,html,yaml,yml,toml,ini,json"`)
+	CmdRun.Flags().StringVarP(&buildFlags, "buildFlags", "", buildFlags, `eg: nunu run --buildFlags="-tags cse"`)
 	if excludeDir == "" {
 		excludeDir = config.RunExcludeDir
 	}
@@ -95,6 +98,7 @@ var CmdRun = &cobra.Command{
 		fmt.Printf("\033[35mNunu run %s.\033[0m\n", dir)
 		fmt.Printf("\033[35mWatch excludeDir %s\033[0m\n", excludeDir)
 		fmt.Printf("\033[35mWatch includeExt %s\033[0m\n", includeExt)
+		fmt.Printf("\033[35mWatch buildFlags %s\033[0m\n", buildFlags)
 		watch(dir, programArgs)
 
 	},
@@ -115,6 +119,10 @@ func watch(dir string, programArgs []string) {
 
 	excludeDirArr := strings.Split(excludeDir, ",")
 	includeExtArr := strings.Split(includeExt, ",")
+	buildFlagsArr := make([]string, 0)
+	if buildFlags = strings.TrimSpace(buildFlags); buildFlags != "" {
+		buildFlagsArr = strings.Split(buildFlags, " ")
+	}
 	includeExtMap := make(map[string]struct{})
 	for _, s := range includeExtArr {
 		includeExtMap[s] = struct{}{}
@@ -148,7 +156,7 @@ func watch(dir string, programArgs []string) {
 		return
 	}
 
-	cmd := start(dir, programArgs)
+	cmd := start(dir, buildFlagsArr, programArgs)
 
 	// Loop listening file modification
 	for {
@@ -171,16 +179,19 @@ func watch(dir string, programArgs []string) {
 				fmt.Printf("\033[36mfile modified: %s\033[0m\n", event.Name)
 				syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
 
-				cmd = start(dir, programArgs)
+				cmd = start(dir, buildFlagsArr, programArgs)
 			}
 		case err := <-watcher.Errors:
 			fmt.Println("Error:", err)
 		}
 	}
 }
 
-func start(dir string, programArgs []string) *exec.Cmd {
-	cmd := exec.Command("go", append([]string{"run", dir}, programArgs...)...)
+func start(dir string, buildFlagsArgs []string, programArgs []string) *exec.Cmd {
+	run := []string{"run"}
+	run = append(run, buildFlagsArgs...)
+	run = append(run, dir)
+	cmd := exec.Command("go", append(run, programArgs...)...)
 	// Set a new process group to kill all child processes when the program exits
 	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
 
```

**File**: `internal/command/run/run_windows.go` (modified, +16/-5)
```diff
@@ -5,7 +5,6 @@ package run
 
 import (
 	"fmt"
-	"github.com/go-nunu/nunu/config"
 	"log"
 	"os"
 	"os/exec"
@@ -17,6 +16,8 @@ import (
 	"syscall"
 	"time"
 
+	"github.com/go-nunu/nunu/config"
+
 	"github.com/AlecAivazis/survey/v2"
 	"github.com/fsnotify/fsnotify"
 	"github.com/go-nunu/nunu/internal/pkg/helper"
@@ -30,10 +31,12 @@ type Run struct {
 
 var excludeDir string
 var includeExt string
+var buildFlags string
 
 func init() {
 	CmdRun.Flags().StringVarP(&excludeDir, "excludeDir", "", excludeDir, `eg: nunu run --excludeDir="tmp,vendor,.git,.idea"`)
 	CmdRun.Flags().StringVarP(&includeExt, "includeExt", "", includeExt, `eg: nunu run --includeExt="go,tpl,tmpl,html,yaml,yml,toml,ini,json"`)
+	CmdRun.Flags().StringVarP(&buildFlags, "buildFlags", "", buildFlags, `eg: nunu run --buildFlags="-tags cse"`)
 	if excludeDir == "" {
 		excludeDir = config.RunExcludeDir
 	}
@@ -95,6 +98,7 @@ var CmdRun = &cobra.Command{
 		fmt.Printf("\033[35mNunu run %s.\033[0m\n", dir)
 		fmt.Printf("\033[35mWatch excludeDir %s\033[0m\n", excludeDir)
 		fmt.Printf("\033[35mWatch includeExt %s\033[0m\n", includeExt)
+		fmt.Printf("\033[35mWatch buildFlags %s\033[0m\n", buildFlags)
 		watch(dir, programArgs)
 
 	},
@@ -115,6 +119,10 @@ func watch(dir string, programArgs []string) {
 
 	excludeDirArr := strings.Split(excludeDir, ",")
 	includeExtArr := strings.Split(includeExt, ",")
+	buildFlagsArr := make([]string, 0)
+	if buildFlags = strings.TrimSpace(buildFlags); buildFlags != "" {
+		buildFlagsArr = strings.Split(buildFlags, " ")
+	}
 	includeExtMap := make(map[string]struct{})
 	for _, s := range includeExtArr {
 		includeExtMap[s] = struct{}{}
@@ -149,7 +157,7 @@ func watch(dir string, programArgs []string) {
 		return
 	}
 
-	cmd := start(dir, programArgs)
+	cmd := start(dir, buildFlagsArr, programArgs)
 
 	// Loop listening file modification
 	for {
@@ -172,7 +180,7 @@ func watch(dir string, programArgs []string) {
 				fmt.Printf("\033[36mfile modified: %s\033[0m\n", event.Name)
 				killProcess(cmd)
 
-				cmd = start(dir, programArgs)
+				cmd = start(dir, buildFlagsArr, programArgs)
 			}
 		case err := <-watcher.Errors:
 			fmt.Println("Error:", err)
@@ -194,8 +202,11 @@ func killProcess(cmd *exec.Cmd) error {
 	}
 	return nil
 }
-func start(dir string, programArgs []string) *exec.Cmd {
-	cmd := exec.Command("go", append([]string{"run", dir}, programArgs...)...)
+func start(dir string, buildFlagsArgs []string, programArgs []string) *exec.Cmd {
+	run := []string{"run"}
+	run = append(run, buildFlagsArgs...)
+	run = append(run, dir)
+	cmd := exec.Command("go", append(run, programArgs...)...)
 	// Set a new process group to kill all child processes when the program exits
 
 	cmd.Stdout = os.Stdout
```

---

### Incident Patch 8: `2ead57e9` (2025-08-11)
**Commit Message**: 添加buildFlags

**File**: `internal/command/run/run_unix.go` (modified, +13/-5)
```diff
@@ -5,7 +5,6 @@ package run
 
 import (
 	"fmt"
-	"github.com/go-nunu/nunu/config"
 	"log"
 	"os"
 	"os/exec"
@@ -16,6 +15,8 @@ import (
 	"syscall"
 	"time"
 
+	"github.com/go-nunu/nunu/config"
+
 	"github.com/AlecAivazis/survey/v2"
 	"github.com/fsnotify/fsnotify"
 	"github.com/go-nunu/nunu/internal/pkg/helper"
@@ -29,10 +30,12 @@ type Run struct {
 
 var excludeDir string
 var includeExt string
+var buildFlags string
 
 func init() {
 	CmdRun.Flags().StringVarP(&excludeDir, "excludeDir", "", excludeDir, `eg: nunu run --excludeDir="tmp,vendor,.git,.idea"`)
 	CmdRun.Flags().StringVarP(&includeExt, "includeExt", "", includeExt, `eg: nunu run --includeExt="go,tpl,tmpl,html,yaml,yml,toml,ini,json"`)
+	CmdRun.Flags().StringVarP(&buildFlags, "buildFlags", "", buildFlags, `eg: nunu run --buildFlags="-tag cse"`)
 	if excludeDir == "" {
 		excludeDir = config.RunExcludeDir
 	}
@@ -95,6 +98,7 @@ var CmdRun = &cobra.Command{
 		fmt.Printf("\033[35mNunu run %s.\033[0m\n", dir)
 		fmt.Printf("\033[35mWatch excludeDir %s\033[0m\n", excludeDir)
 		fmt.Printf("\033[35mWatch includeExt %s\033[0m\n", includeExt)
+		fmt.Printf("\033[35mWatch buildFlags %s\033[0m\n", buildFlags)
 		watch(dir, programArgs)
 
 	},
@@ -115,6 +119,7 @@ func watch(dir string, programArgs []string) {
 
 	excludeDirArr := strings.Split(excludeDir, ",")
 	includeExtArr := strings.Split(includeExt, ",")
+	buildFlagsArr := strings.Split(buildFlags, " ")
 	includeExtMap := make(map[string]struct{})
 	for _, s := range includeExtArr {
 		includeExtMap[s] = struct{}{}
@@ -148,7 +153,7 @@ func watch(dir string, programArgs []string) {
 		return
 	}
 
-	cmd := start(dir, programArgs)
+	cmd := start(dir, buildFlagsArr, programArgs)
 
 	// Loop listening file modification
 	for {
@@ -171,16 +176,19 @@ func watch(dir string, programArgs []string) {
 				fmt.Printf("\033[36mfile modified: %s\033[0m\n", event.Name)
 				syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
 
-				cmd = start(dir, programArgs)
+				cmd = start(dir, buildFlagsArr, programArgs)
 			}
 		case err := <-watcher.Errors:
 			fmt.Println("Error:", err)
 		}
 	}
 }
 
-func start(dir string, programArgs []string) *exec.Cmd {
-	cmd := exec.Command("go", append([]string{"run", dir}, programArgs...)...)
+func start(dir string, buildFlagsArgs []string, programArgs []string) *exec.Cmd {
+	run := []string{"run"}
+	run = append(run, buildFlagsArgs...)
+	run = append(run, dir)
+	cmd := exec.Command("go", append(run, programArgs...)...)
 	// Set a new process group to kill all child processes when the program exits
 	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
 
```

**File**: `internal/command/run/run_windows.go` (modified, +13/-5)
```diff
@@ -5,7 +5,6 @@ package run
 
 import (
 	"fmt"
-	"github.com/go-nunu/nunu/config"
 	"log"
 	"os"
 	"os/exec"
@@ -17,6 +16,8 @@ import (
 	"syscall"
 	"time"
 
+	"github.com/go-nunu/nunu/config"
+
 	"github.com/AlecAivazis/survey/v2"
 	"github.com/fsnotify/fsnotify"
 	"github.com/go-nunu/nunu/internal/pkg/helper"
@@ -30,10 +31,12 @@ type Run struct {
 
 var excludeDir string
 var includeExt string
+var buildFlags string
 
 func init() {
 	CmdRun.Flags().StringVarP(&excludeDir, "excludeDir", "", excludeDir, `eg: nunu run --excludeDir="tmp,vendor,.git,.idea"`)
 	CmdRun.Flags().StringVarP(&includeExt, "includeExt", "", includeExt, `eg: nunu run --includeExt="go,tpl,tmpl,html,yaml,yml,toml,ini,json"`)
+	CmdRun.Flags().StringVarP(&buildFlags, "buildFlags", "", buildFlags, `eg: nunu run --buildFlags="-tag cse"`)
 	if excludeDir == "" {
 		excludeDir = config.RunExcludeDir
 	}
@@ -95,6 +98,7 @@ var CmdRun = &cobra.Command{
 		fmt.Printf("\033[35mNunu run %s.\033[0m\n", dir)
 		fmt.Printf("\033[35mWatch excludeDir %s\033[0m\n", excludeDir)
 		fmt.Printf("\033[35mWatch includeExt %s\033[0m\n", includeExt)
+		fmt.Printf("\033[35mWatch buildFlags %s\033[0m\n", buildFlags)
 		watch(dir, programArgs)
 
 	},
@@ -115,6 +119,7 @@ func watch(dir string, programArgs []string) {
 
 	excludeDirArr := strings.Split(excludeDir, ",")
 	includeExtArr := strings.Split(includeExt, ",")
+	buildFlagsArr := strings.Split(buildFlags, " ")
 	includeExtMap := make(map[string]struct{})
 	for _, s := range includeExtArr {
 		includeExtMap[s] = struct{}{}
@@ -149,7 +154,7 @@ func watch(dir string, programArgs []string) {
 		return
 	}
 
-	cmd := start(dir, programArgs)
+	cmd := start(dir, buildFlagsArr, programArgs)
 
 	// Loop listening file modification
 	for {
@@ -172,7 +177,7 @@ func watch(dir string, programArgs []string) {
 				fmt.Printf("\033[36mfile modified: %s\033[0m\n", event.Name)
 				killProcess(cmd)
 
-				cmd = start(dir, programArgs)
+				cmd = start(dir, buildFlagsArr, programArgs)
 			}
 		case err := <-watcher.Errors:
 			fmt.Println("Error:", err)
@@ -194,8 +199,11 @@ func killProcess(cmd *exec.Cmd) error {
 	}
 	return nil
 }
-func start(dir string, programArgs []string) *exec.Cmd {
-	cmd := exec.Command("go", append([]string{"run", dir}, programArgs...)...)
+func start(dir string, buildFlagsArgs []string, programArgs []string) *exec.Cmd {
+	run := []string{"run"}
+	run = append(run, buildFlagsArgs...)
+	run = append(run, dir)
+	cmd := exec.Command("go", append(run, programArgs...)...)
 	// Set a new process group to kill all child processes when the program exits
 
 	cmd.Stdout = os.Stdout
```

---

### Incident Patch 9: `08e17a4f` (2025-07-08)
**Commit Message**: fix: update chat description

**File**: `internal/command/new/new.go` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ func (p *Project) cloneTemplate() (bool, error) {
 					return "Quickly build a High-Performance Go MCP Server."
 				}
 				if index == 4 {
-					return "It has rich functions such as db, jwt, cron, migration, test, etc"
+					return "It includes a simple chat room server that supports both WS and TCP."
 				}
 
 				return "It has rich functions such as db, jwt, cron, migration, test, etc"
```

---

### Incident Patch 10: `9e880d45` (2024-04-12)
**Commit Message**: fix: excludeDir error

**File**: `config/config.go` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 package config
 
 var (
-	Version       = "1.0.15"
+	Version       = "1.0.16"
 	WireCmd       = "github.com/google/wire/cmd/wire@latest"
 	NunuCmd       = "github.com/go-nunu/nunu@latest"
 	RepoBase      = "https://github.com/go-nunu/nunu-layout-base.git"
```

**File**: `internal/pkg/helper/helper.go` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ func FindMain(base, excludeDir string) (map[string]string, error) {
 			return err
 		}
 		for _, s := range excludeDirArr {
-			if strings.HasPrefix(path, s) {
+			if strings.HasPrefix(strings.TrimPrefix(path, base), "/"+s) {
 				return nil
 			}
 		}
```

---

### Incident Patch 11: `1087f9b4` (2024-03-14)
**Commit Message**: fix: svc and repo add ctx

**File**: `config/config.go` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 package config
 
 var (
-	Version       = "1.0.13"
+	Version       = "1.0.14"
 	WireCmd       = "github.com/google/wire/cmd/wire@latest"
 	NunuCmd       = "github.com/go-nunu/nunu@latest"
 	RepoBase      = "https://github.com/go-nunu/nunu-layout-base.git"
```

**File**: `tpl/create/repository.tpl` (modified, +3/-2)
```diff
@@ -1,11 +1,12 @@
 package repository
 
 import (
+    "context"
 	"{{ .ProjectName }}/internal/model"
 )
 
 type {{ .StructName }}Repository interface {
-	FirstById(id int64) (*model.{{ .StructName }}, error)
+	FirstById(ctx context.Context, id int64) (*model.{{ .StructName }}, error)
 }
 
 func New{{ .StructName }}Repository(repository *Repository) {{ .StructName }}Repository {
@@ -18,7 +19,7 @@ type {{ .StructNameLowerFirst }}Repository struct {
 	*Repository
 }
 
-func (r *{{ .StructNameLowerFirst }}Repository) FirstById(id int64) (*model.{{ .StructName }}, error) {
+func (r *{{ .StructNameLowerFirst }}Repository) FirstById(ctx context.Context, id int64) (*model.{{ .StructName }}, error) {
 	var {{ .StructNameLowerFirst }} model.{{ .StructName }}
 	// TODO: query db
 	return &{{ .StructNameLowerFirst }}, nil
```

**File**: `tpl/create/service.tpl` (modified, +4/-3)
```diff
@@ -1,12 +1,13 @@
 package service
 
 import (
+    "context"
 	"{{ .ProjectName }}/internal/model"
 	"{{ .ProjectName }}/internal/repository"
 )
 
 type {{ .StructName }}Service interface {
-	Get{{ .StructName }}(id int64) (*model.{{ .StructName }}, error)
+	Get{{ .StructName }}(ctx context.Context, id int64) (*model.{{ .StructName }}, error)
 }
 
 func New{{ .StructName }}Service(service *Service, {{ .StructNameLowerFirst }}Repository repository.{{ .StructName }}Repository) {{ .StructName }}Service {
@@ -21,6 +22,6 @@ type {{ .StructNameLowerFirst }}Service struct {
 	{{ .StructNameLowerFirst }}Repository repository.{{ .StructName }}Repository
 }
 
-func (s *{{ .StructNameLowerFirst }}Service) Get{{ .StructName }}(id int64) (*model.{{ .StructName }}, error) {
-	return s.{{ .StructNameLowerFirst }}Repository.FirstById(id)
+func (s *{{ .StructNameLowerFirst }}Service) Get{{ .StructName }}(ctx context.Context, id int64) (*model.{{ .StructName }}, error) {
+	return s.{{ .StructNameLowerFirst }}Repository.FirstById(ctx, id)
 }
```

---

### Incident Patch 12: `fb2173f9` (2024-03-05)
**Commit Message**: fix: rm runCreate Println

**File**: `internal/command/create/create.go` (modified, +0/-1)
```diff
@@ -98,7 +98,6 @@ func runCreate(cmd *cobra.Command, args []string) {
 	c.StructNameLowerFirst = strutil.LowerFirst(c.StructName)
 	c.StructNameFirstChar = string(c.StructNameLowerFirst[0])
 	c.StructNameSnakeCase = strutil.SnakeCase(c.StructName)
-	fmt.Println(c)
 
 	switch c.CreateType {
 	case "handler", "service", "repository", "model":
```

---

### Incident Patch 13: `2f4aec4d` (2023-10-18)
**Commit Message**: fix error word

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Nunu — A CLI tool for building go aplication.
+# Nunu — A CLI tool for building go applications.
 
 
 Nunu是一个基于Golang的应用脚手架，它的名字来自于英雄联盟中的游戏角色，一个骑在雪怪肩膀上的小男孩。和努努一样，该项目也是站在巨人的肩膀上，它是由Golang生态中各种非常流行的库整合而成的，它们的组合可以帮助你快速构建一个高效、可靠的应用程序。
```

---

### Incident Patch 14: `2a66c229` (2023-08-27)
**Commit Message**: fix: change handler.tpl error code

**File**: `config/config.go` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 package config
 
 const (
-	Version      = "1.0.6"
+	Version      = "1.0.7"
 	WireCmd      = "github.com/google/wire/cmd/wire@latest"
 	NunuCmd      = "github.com/go-nunu/nunu@latest"
 	RepoBase     = "https://github.com/go-nunu/nunu-layout-base.git"
```

**File**: `tpl/create/handler.tpl` (modified, +5/-10)
```diff
@@ -2,20 +2,19 @@ package handler
 
 import (
 	"github.com/gin-gonic/gin"
+	"{{ .ProjectName }}/internal/pkg/response"
 	"{{ .ProjectName }}/internal/service"
-	"{{ .ProjectName }}/pkg/helper/resp"
 	"go.uber.org/zap"
 	"net/http"
 )
 
 type {{ .FileName }}Handler interface {
 	Get{{ .FileName }}ById(ctx *gin.Context)
-	Update{{ .FileName }}(ctx *gin.Context)
 }
 
 func New{{ .FileName }}Handler(handler *Handler, {{ .FileNameTitleLower }}Service service.{{ .FileName }}Service) {{ .FileName }}Handler {
 	return &{{ .FileNameTitleLower }}Handler{
-		Handler:     handler,
+		Handler:      handler,
 		{{ .FileNameTitleLower }}Service: {{ .FileNameTitleLower }}Service,
 	}
 }
@@ -30,19 +29,15 @@ func (h *{{ .FileNameTitleLower }}Handler) Get{{ .FileName }}ById(ctx *gin.Conte
 		Id int64 `form:"id" binding:"required"`
 	}
 	if err := ctx.ShouldBind(&params); err != nil {
-		resp.HandleError(ctx, http.StatusBadRequest, 1, err.Error(), nil)
+		response.HandleError(ctx, http.StatusInternalServerError, response.ErrInternalServerError, nil)
 		return
 	}
 
 	{{ .FileNameTitleLower }}, err := h.{{ .FileNameTitleLower }}Service.Get{{ .FileName }}ById(params.Id)
 	h.logger.Info("Get{{ .FileName }}ByID", zap.Any("{{ .FileNameTitleLower }}", {{ .FileNameTitleLower }}))
 	if err != nil {
-		resp.HandleError(ctx, http.StatusInternalServerError, 1, err.Error(), nil)
+		response.HandleError(ctx, http.StatusInternalServerError, response.ErrInternalServerError, nil)
 		return
 	}
-	resp.HandleSuccess(ctx, {{ .FileNameTitleLower }})
-}
-
-func (h *{{ .FileNameTitleLower }}Handler) Update{{ .FileName }}(ctx *gin.Context) {
-	resp.HandleSuccess(ctx, nil)
+	response.HandleSuccess(ctx, {{ .FileNameTitleLower }})
 }
```

---

### Incident Patch 15: `70365865` (2023-06-26)
**Commit Message**: docs: fix Unit Testing

**File**: `docs/en/unit_testing.md` (modified, +43/-41)
```diff
@@ -2,21 +2,20 @@
 * [User Guide](https://github.com/go-nunu/nunu/blob/main/docs/en/guide.md)
 * [Architecture](https://github.com/go-nunu/nunu/blob/main/docs/en/architecture.md)
 * [Getting Started Tutorial](https://github.com/go-nunu/nunu/blob/main/docs/en/tutorial.md)
-* [Unit Testing](https://github.com/go-nunu/nunu/blob/main/docs/en/unit_testing.md)
+* [Efficient Unit Testing](https://github.com/go-nunu/nunu/blob/main/docs/en/unit_testing.md)
 
-[Go to Chinese version](https://github.com/go-nunu/nunu/blob/main/docs/zh/tutorial.md)
 
 # Unit Testing
 
 ## Introduction
 
-Performing unit testing in a project is an important development practice. However, writing unit tests becomes complex and unstable when the code under test depends on other modules or components. To address this issue, we can use mocks to simulate the dependencies of the code under test. By using mock objects, we can control the behavior of external modules, ensuring that the code under test does not actually depend on or invoke these external modules during testing, thus achieving isolation of the code under test. In Go language, we can use the golang/mock library to generate mock code, and use sqlmock and redismock to simulate the behavior of databases and caches. By using mocks, we can improve the reliability and efficiency of unit testing. This article will introduce how to write concise and efficient unit tests using mocks.
+Unit testing is an important development practice in projects. However, writing unit tests becomes complex and unstable when the tested code depends on other modules or components. This article will introduce how to use mocks to write concise and efficient unit tests.
 
 ## Overview
 
-First, let's take a look at the dependency injection file `cmd/server/wire.go` in the project:
+First, let's take a look at the dependency injection file in the project `cmd/server/wire.go`:
 
-> tip: This file is automatically compiled and generated by the `google/wire` tool, and manual editing is prohibited.
+> tip: This file is automatically compiled and generated by the `google/wire` tool and should not be manually edited.
 
 ```
 // Injectors from wire.go:
@@ -38,12 +37,11 @@ func newApp(viperViper *viper.Viper, logger *log.Logger) (*gin.Engine, func(), e
 }
 ```
 
-From this code, we can see the dependency relationship between `repository`, `service`, and `handler`.
+From this code snippet, we can see the dependency relationships between `handler`, `service`, and `repository`.
 
 `userHandler` depends on `userService`, and `userService` depends on `userRepository`.
 
-For example, the `GetProfile` code in `handler/user.go` is as follows:
-
+For example, the code for `GetProfile` in `handler/user.go` is as follows:
 ```
 func (h *userHandler) GetProfile(ctx *gin.Context) {
 	userId := GetUserIdFromCtx(ctx)
@@ -61,40 +59,42 @@ func (h *userHandler) GetProfile(ctx *gin.Context) {
 	resp.HandleSuccess(ctx, user)
 }
 ```
-
 We can see that it calls `userService.GetProfile` internally.
 
-Therefore, when writing unit tests, we inevitably need to initialize the `userService` instance first. However, when we try to initialize `userService`, we find that it depends on `userRepository`.
+Therefore, when writing unit tests, we inevitably need to initialize the `userService` instance first. However, when we initialize `userService`, we find that it depends on `userRepository`.
+
+Although we only need to test the bottom-level `handler`, we need to initialize and execute `service`, `repository`, and other code. This obviously violates the principle of unit testing (Single Responsibility Principle), where each unit test should focus on a specific functionality or code unit.
+
+What is a good solution to this problem? Our ultimate answer is "mocking".
 
-Clearly, we only need to test the lowest level `handler`, but we need to initialize and execute code such as `service` and `repository` first. This obviously violates the principle of unit testing, where each unit test should focus on one functionality or code unit.
 
-What is the better solution to this problem? Our final answer is `mock`.
+### Mocking (A Good Helper for Dependency Isolation)
 
-### Mock (A Helper for Dependency Isolation)
+When conducting unit tests, we want to test the logic of the tested code unit without relying on the state or behavior of other external modules or components. This approach can better isolate the tested code and make the tests more reliable and repeatable.
 
-When performing unit testing, we want to test the logic of the code unit under test, without relying on the state or behavior of other external modules or components. This approach can better isolate the code under test, making the testing more reliable and repeatable.
+Mocking is a testing pattern used to simulate or replace external modules or components that the tested code depends on. By using mock objects, we can control the behavior of external modules, so that the tested code does not ne
```

**File**: `docs/zh/unit_testing.md` (modified, +3/-3)
```diff
@@ -9,7 +9,7 @@
 
 ## 介绍
 
-在项目中进行单元测试是一种重要的开发实践。然而，当被测代码依赖其他模块或组件时，编写单元测试变得复杂且不稳定。为了解决这个问题，我们可以使用mock来模拟被测代码的依赖。通过使用mock对象，我们可以控制外部模块的行为，使得被测代码在测试过程中不会真正依赖和调用外部模块，从而实现对被测代码的隔离。在Go语言中，使用golang/mock库来生成mock代码，并使用sqlmock和redismock来模拟数据库和缓存的行为。通过使用mock，我们可以提高单元测试的可靠性和效率。本文将介绍如何使用mock来编写简洁高效的单元测试。
+在项目中进行单元测试是一种重要的开发实践。然而，当被测代码依赖其他模块或组件时，编写单元测试变得复杂且不稳定。本文将介绍如何使用mock来编写简洁高效的单元测试。
 
 ## 导读
 
@@ -37,9 +37,9 @@ func newApp(viperViper *viper.Viper, logger *log.Logger) (*gin.Engine, func(), e
 }
 ```
 
-从这段代码我们可以得知`repository`、`service`、`repository`之间的依赖关系，
+从这段代码我们可以得知`handler`、`service`、`repository`之间的依赖关系，
 
-`userHandler`依赖于`userService`，而`userService`又依赖于`userRepository。
+`userHandler`依赖于`userService`，而`userService`又依赖于`userRepository`。
 
 比如`handler/user.go`下面的`GetProfile`代码如下：
 ```
```

#### Recent Merged Pull Requests:
- **PR #101** (2026-08-12): docs: add Nunu Skills guidance (@codingcn)
- **PR #100** (2026-08-12): fix: harden hot reload for production (@codingcn)
- **PR #99** (2026-08-12): feat: stabilize CLI runtime and command handling (@codingcn)
- **PR #94** (2025-08-25): Update getting-started.md (@openapphub)
- **PR #93** (closed): fix the document error (@openapphub)
- **PR #91** (2025-08-11): 添加buildFlags (@cn-kali-team)
- **PR #81** (closed): feat:Create a unified prefix for newly added files (@RogueCultivators)
- **PR #78** (2025-02-14): Feature: Update the docs (@Wenrh2004)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
