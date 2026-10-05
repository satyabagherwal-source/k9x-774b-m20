# Forensic Learning Record (Deep Inspection): go-nunu/nunu

> **Canonical Artifact**: `07_PROJECT_LEARNING/go-nunu-nunu-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/go-nunu/nunu](https://github.com/go-nunu/nunu))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:45:35.480Z  
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
				return false, ni
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

### Incident Patch 3: `0e501e89` (2026-08-12)
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

---

### Incident Patch 4: `ba07a4e8` (2026-04-26)
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

### Incident Patch 5: `08e17a4f` (2025-07-08)
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

### Incident Patch 6: `9e880d45` (2024-04-12)
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

### Incident Patch 7: `1087f9b4` (2024-03-14)
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

### Incident Patch 8: `fb2173f9` (2024-03-05)
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

### Incident Patch 9: `2f4aec4d` (2023-10-18)
**Commit Message**: fix error word

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Nunu — A CLI tool for building go aplication.
+# Nunu — A CLI tool for building go applications.
 
 
 Nunu是一个基于Golang的应用脚手架，它的名字来自于英雄联盟中的游戏角色，一个骑在雪怪肩膀上的小男孩。和努努一样，该项目也是站在巨人的肩膀上，它是由Golang生态中各种非常流行的库整合而成的，它们的组合可以帮助你快速构建一个高效、可靠的应用程序。
```

---

### Incident Patch 10: `2a66c229` (2023-08-27)
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
