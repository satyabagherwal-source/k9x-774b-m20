# Forensic Learning Record (Deep Inspection): goss-org/goss

> **Canonical Artifact**: `07_PROJECT_LEARNING/goss-org-goss-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goss-org/goss](https://github.com/goss-org/goss))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:11:53.705Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goss-org/goss`
- **Description**: Quick and Easy server testing/validation
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5981 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `util/command.go`
```
package util

import (
	"bytes"
	"encoding/json"

	//"fmt"
	"errors"
	"os/exec"
	"syscall"
)

// ExecCommand represents a command that can be specified either shell style,
// as a single string that is run through the shell (`sh -c "<string>"`), or
// exec style, as an explicit list of arguments where the first element is the
// program and the rest are its arguments (no shell involved). This mirrors the
// shell/exec forms of Dockerfile's RUN/ENTRYPOINT/CMD instructions.
//
// Exactly one of CmdStr or CmdSlice is set. It is useful for environments
// without a shell, such as distroless/scratch containers, and for passing
// arguments containing spaces or special characters verbatim.
type ExecCommand struct {
	CmdStr   string
	CmdSlice []string
}

// errExecCommandType is returned when a command value is neither a string
// (shell style) nor a list of strings (exec style).
var errExecCommandType = errors.New("command must be a string or a list of strings")

// UnmarshalJSON accepts either a JSON string (shell style) or a JSON array of
// strings (exec style). Anything else is an error.
func (e *ExecCommand) UnmarshalJSON(data []byte) error {
	// Try shell style first.
	if err := json.Unmarshal(data, &e.CmdStr); err == nil {
		return nil
	}
	// Fall back to exec style.
	e.CmdStr = ""
	if err := json.Unmarshal(data, &e.CmdSlice); err != nil {
		return errExecCommandType
	}
	return nil
}

// UnmarshalYAML accepts either a YAML scalar (shell style) or a YAML sequence
// of strings (exec style). Anything else is an error.
func (e *ExecCommand) UnmarshalYAML(unmarshal func(any) error) error {
	// Try shell style first. A bool/int scalar decodes into the string, which
	// preserves the long-standing behavior of `exec: true` meaning `exec: "true"`.
	if err := unmarshal(&e.CmdStr); err == nil {
		return nil
	}
	// Fall back to exec style.
	e.CmdStr = ""
	if err := unmarshal(&e.CmdSlice); err != nil {
		return errExecCommandType
	}
	return nil
}

// MarshalJSON emits the command as a JSON string (shell style) or array of
// strings (exec style), matching what UnmarshalJSON accepts.
func (e ExecCommand) MarshalJSON() ([]byte, error) {
	if e.CmdStr != "" {
		return json.Marshal(e.CmdStr)
	}
	return json.Marshal(e.CmdSlice)
}

// MarshalYAML emits the command as a YAML scalar (shell style) or sequence of
// strings (exec style), matching what UnmarshalYAML accepts.
func (e ExecCommand) MarshalYAML() (any, error) {
	if e.CmdStr != "" {
		return e.CmdStr, nil
	}
	return e.CmdSlice, nil
}

type Command struct {
	name           string
	Cmd            *exec.Cmd
	Stdout, Stderr bytes.Buffer
	Err            error
	Status         int
}

func NewCommand(name string, arg ...string) *Command {
	//fmt.Println(arg)
	command := new(Command)
	command.name = name
	command.Cmd = exec.Command(name, arg...)

	return command
}

func (c *Command) Run() error {
	c.Cmd.Stdout = &c.Stdout
	c.Cmd.Stderr = &c.Stderr

	if _, err := exec.LookPath(c.name); err != nil {
		c.Err = err
		return c.Err
	}

	if err := c.Cmd.Start(); err != nil {
		c.Err = err
		return c.Err
	}

	if err := c.Cmd.Wait(); err != nil {
		c.Err = err
		if exiterr, ok := err.(*exec.ExitError); ok {
			if status, ok := exiterr.Sys().(syscall.WaitStatus); ok {
				c.Status = status.ExitStatus()
			}
		}
	} else {
		c.Status = 0
	}
	return c.Err
}

```

### Core Architecture Module: `util/command_windows.go`
```
//go:build windows
// +build windows

package util

import (
	"strings"

	"os/exec"
	"syscall"
)

func NewCommandForWindowsCmd(name string, arg ...string) *Command {
	//fmt.Println(arg)
	command := new(Command)
	command.name = name

	// cmd.exe has a unique unquoting algorithm
	// provide the full command line in SysProcAttr.CmdLine, leaving Args empty.
	// more information: https://golang.org/pkg/os/exec/#Command
	command.Cmd = exec.Command(name)
	command.Cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    false,
		CmdLine:       strings.Join(arg, " "),
		CreationFlags: 0,
	}

	return command
}

func NewCommandForWindowsPowershell(name string, arg ...string) *Command {
	command := new(Command)
	command.name = "powershell"

	// Build the powershell command line with -NoProfile -Command
	// The name and args are the PowerShell commands to execute
	cmdLine := "-NoProfile -Command " + name
	if len(arg) > 0 {
		cmdLine += " " + strings.Join(arg, " ")
	}

	command.Cmd = exec.Command("powershell")
	command.Cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    false,
		CmdLine:       cmdLine,
		CreationFlags: 0,
	}

	return command
}

```

### Core Architecture Module: `util/config.go`
```
package util

import (
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strings"
	"time"

	"github.com/oleiade/reflections"
)

// ConfigOption manipulates Config
type ConfigOption func(c *Config) error

// Config is the runtime configuration for the goss system, the cli.Command gets
// converted to this and it allows other packages to embed goss by creating this
// structure and using it when adding, validating etc.
//
// NewConfig can be used to create this which will default to what the CLI assumes
// and allow manipulation via ConfigOption functions
type Config struct {
	AllowInsecure         bool
	AnnounceToCLI         bool
	Cache                 time.Duration
	Debug                 bool
	Endpoint              string
	ExactMatch            bool
	FormatOptions         []string
	IgnoreList            []string
	ListenAddress         string
	LocalAddress          string
	LogLevel              string
	MaxConcurrent         int
	Method                string
	NoColor               *bool
	NoFollowRedirects     bool
	OutputFormat          string
	OutputWriter          io.Writer
	PackageManager        string
	Password              string
	RequestBody           string
	Proxy                 string
	RequestHeader         []string
	RetryTimeout          time.Duration
	RunLevel              string
	Server                string
	Sleep                 time.Duration
	Spec                  string
	Timeout               time.Duration
	Username              string
	CAFile                string
	CertFile              string
	KeyFile               string
	VarsFiles             []string
	VarsInline            string
	DisabledResourceTypes []string
}

// TimeOutMilliSeconds is the timeout as milliseconds
func (c *Config) TimeOutMilliSeconds() int {
	return int(c.Timeout / time.Millisecond)
}

// NewConfig creates a default configuration modeled on the defaults the CLI sets, modified using opts
func NewConfig(opts ...ConfigOption) (rc *Config, err error) {
	rc = &Config{
		AllowInsecure:         false,
		AnnounceToCLI:         false,
		Cache:                 5 * time.Second,
		Debug:                 false,
		Endpoint:              "/healthz",
		FormatOptions:         []string{},
		IgnoreList:            []string{},
		DisabledResourceTypes: []string{},
		ListenAddress:         ":8080",
		LocalAddress:          "",
		LogLevel:              "ERROR",
		MaxConcurrent:         50,
		NoColor:               nil,
		NoFollowRedirects:     false,
		OutputFormat:          "structured", // most appropriate for package usage
		PackageManager:        "",
		Password:              "",
		Proxy:                 "",
		RequestHeader:         nil,
		RetryTimeout:          0,
		Server:                "",
		Sleep:                 time.Second,
		Spec:                  "",
		Timeout:               0,
		Username:              "",
		VarsFiles:             []string{},
		VarsInline:            "",
	}

	// NewConfig() is likely to be used when embedding goss or using as a package
	// so assuming no color seems like a sane departure from CLI defaults
	WithNoColor()(rc)

	for _, opt := range opts {
		err = opt(rc)
		if err != nil {
			return nil, err
		}
	}

	return rc, nil
}

// WithSpecFile sets the path to the file holding spec contents
func WithSpecFile(f string) ConfigOption {
	return func(c *Config) error {
		c.Spec = f
		return nil
	}
}

// WithOutputFormat is the formatter to use for output
func WithOutputFormat(f string) ConfigOption {
	return func(c *Config) error {
		c.OutputFormat = f

		return nil
	}
}

// WithFormatOptions sets options used by the output format plugins, valid options are output.WithFormatOptions
func WithFormatOptions(opts ...string) ConfigOption {
	return func(c *Config) error {
		c.FormatOptions = append(c.FormatOptions, opts...)
		return nil
	}
}

// WithResultWriter sets the writer to write output format to when validating
func WithResultWriter(w io.Writer) ConfigOption {
	return func(c *Config) error {
		c.OutputWriter = w
		return nil
	}
}

// WithSleep sets the time to sleep between retries when WithRetryTimeout is set
func WithSleep(d time.Duration) ConfigOption {
	return func(c *Config) error {
		c.Sleep = d
		return nil
	}
}

// WithRetryTimeout sets the maximum amount of time checks can be retried, it's runtime + WithSleep
func WithRetryTimeout(d time.Duration) ConfigOption {
	return func(c *Config) error {
		c.RetryTimeout = d
		return nil
	}
}

// WithCache sets how long results may be cached for
func WithCache(d time.Duration) ConfigOption {
	return func(c *Config) error {
		c.Cache = d
		return nil
	}
}

// WithMaxConcurrency is the maximum concurrent test that can be run
func WithMaxConcurrency(mc int) ConfigOption {
	return func(c *Config) error {
		c.MaxConcurrent = mc
		return nil
	}
}

// WithNoColor disables colored output
func WithNoColor() ConfigOption {
	return func(c *Config) error {
		c.NoColor = func(b bool) *bool { return &b }(true)
		return nil
	}
}

// WithColor enables colored output
func WithColor() ConfigOption {
	return func(c *Config) error {
		c.NoColor = func(b bool) *bool { return &b }(false)
		return nil
	}
}

// WithPackageManager overrides the package manager to use
func WithPackageManager(p string) ConfigOption {
	return func(c *Config) error {
		c.PackageManager = p

		return nil
	}
}

// WithDebug enables debug output
func WithDebug() ConfigOption {
	return func(c *Config) error {
		c.Debug = true
		return nil
	}
}

// WithVarsFiles are json or yaml files containing variables to pass to the validator
func WithVarsFiles(files []string) ConfigOption {
	return func(c *Config) error {
		c.VarsFiles = files
		return nil
	}
}

// WithVarsData uses v as variables to pass to the Validator
func WithVarsData(v any) ConfigOption {
	return func(c *Config) error {
		jv, err := json.Marshal(v)
		if err != nil {
			return err
		}

		c.VarsInline = string(jv)

		return nil
	}
}

// WithVarsBytes is a yaml or json byte stream to use as variables passed to the Validator
func WithVarsBytes(v []byte) ConfigOption {
	return WithVarsString(string(v))
}

// WithVarsString is a yaml or json string to use as variables passed to the Validator
func WithVarsString(v string) ConfigOption {
	return func(c *Config) error {
		c.VarsInline = v
		return nil
	}
}

// WithDisabledResourceTypes ensures that any resource matching types listed will be skipped when validating
func WithDisabledResourceTypes(t ...string) ConfigOption {
	return func(c *Config) error {
		c.DisabledResourceTypes = append(c.DisabledResourceTypes, t...)
		return nil
	}
}

type OutputConfig struct {
	FormatOptions []string
}

type format string

const (
	JSON format = "json"
	YAML format = "yaml"
)

func ValidateSections(unmarshal func(any) error, i any, whitelist map[string]bool) error {
	// Get generic input
	var toValidate map[string]map[string]any
	if err := unmarshal(&toValidate); err != nil {
		return err
	}

	// Run input through whitelist
	typ := reflect.TypeOf(i)
	typs := strings.Split(typ.String(), ".")[1]
	for id, v := range toValidate {
		for k := range v {
			if !whitelist[k] {
				return fmt.Errorf("invalid Attribute for %s:%s: %s", typs, id, k)
			}
		}
	}

	return nil
}

func WhitelistAttrs(i any, format format) (map[string]bool, error) {
	validAttrs := make(map[string]bool)
	tags, err := reflections.Tags(i, string(format))
	if err != nil {
		return nil, err
	}
	for _, v := range tags {
		validAttrs[strings.Split(v, ",")[0]] = true
	}
	return validAttrs, nil
}

func IsValueInList(value string, list []string) bool {
	for _, v := range list {
		if strings.EqualFold(v, value) {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `add.go`
```
package goss

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/goss-org/goss/resource"
	"github.com/goss-org/goss/system"
	"github.com/goss-org/goss/util"
)

// AddResources is a simple wrapper to add multiple resources
func AddResources(ctx context.Context, fileName, resourceName string, keys []string, c *util.Config) error {
	if err := setLogLevel(c); err != nil {
		return err
	}
	format, err := getStoreFormatFromFileName(fileName)
	if err != nil {
		return err
	}
	setStoreFormat(format)

	var gossConfig GossConfig
	if _, err := os.Stat(fileName); err == nil {
		gossConfig, err = ReadJSON(fileName)
		if err != nil {
			return err
		}
	} else {
		gossConfig = *NewGossConfig()
	}

	sys := system.New(c.PackageManager)

	for _, key := range keys {
		if err := AddResource(ctx, fileName, gossConfig, resourceName, key, *c, sys); err != nil {
			return err
		}
	}

	return WriteJSON(fileName, gossConfig)
}

// AddResource adds a single resource to fileName
func AddResource(ctx context.Context, fileName string, gossConfig GossConfig, resourceName, key string, config util.Config, sys *system.System) error {
	var err error
	var res resource.ResourceRead

	// Need to figure out a good way to refactor this
	switch resourceName {
	case resource.AddResourceName:
		res, err = gossConfig.Addrs.AppendSysResource(ctx, key, sys, config)
	case resource.CommandResourceName:
		res, err = gossConfig.Commands.AppendSysResource(ctx, key, sys, config)
	case resource.DNSResourceName:
		res, err = gossConfig.DNS.AppendSysResource(ctx, key, sys, config)
	case resource.FileResourceName:
		res, err = gossConfig.Files.AppendSysResource(ctx, key, sys, config)
	case resource.GroupResourceName:
		res, err = gossConfig.Groups.AppendSysResource(ctx, key, sys, config)
	case resource.PackageResourceName:
		res, err = gossConfig.Packages.AppendSysResource(ctx, key, sys, config)
	case resource.PortResourceName:
		res, err = gossConfig.Ports.AppendSysResource(ctx, key, sys, config)
	case resource.ProcessResourceName:
		res, err = gossConfig.Processes.AppendSysResource(ctx, key, sys, config)
	case resource.ServiceResourceName:
		res, err = gossConfig.Services.AppendSysResource(ctx, key, sys, config)
	case resource.UserResourceName:
		res, err = gossConfig.Users.AppendSysResource(ctx, key, sys, config)
	case resource.GossFileResourceName:
		res, err = gossConfig.Gossfiles.AppendSysResource(ctx, key, sys, config)
	case resource.KernelParamResourceName:
		res, err = gossConfig.KernelParams.AppendSysResource(ctx, key, sys, config)
	case resource.MountResourceName:
		res, err = gossConfig.Mounts.AppendSysResource(ctx, key, sys, config)
	case resource.InterfaceResourceName:
		res, err = gossConfig.Interfaces.AppendSysResource(ctx, key, sys, config)
	case resource.HTTPResourceName:
		res, err = gossConfig.HTTPs.AppendSysResource(ctx, key, sys, config)
	case resource.RegistryResourceName:
		res, err = gossConfig.Registries.AppendSysResource(ctx, key, sys, config)
	default:
		err = fmt.Errorf("undefined resource name: %s", resourceName)
	}

	if err != nil {
		return err
	}

	resourcePrint(fileName, res, config.AnnounceToCLI)

	return nil
}

// AutoAddResources is a simple wrapper to add multiple resources
func AutoAddResources(ctx context.Context, fileName string, keys []string, c *util.Config) error {
	format, err := getStoreFormatFromFileName(fileName)
	if err != nil {
		return err
	}
	setStoreFormat(format)

	var gossConfig GossConfig
	if _, err = os.Stat(fileName); err == nil {
		gossConfig, err = ReadJSON(fileName)
		if err != nil {
			return err
		}
	} else {
		gossConfig = *NewGossConfig()
	}

	sys := system.New(c.PackageManager)

	for _, key := range keys {
		if err := AutoAddResource(ctx, fileName, gossConfig, key, c, sys); err != nil {
			return err
		}
	}

	return WriteJSON(fileName, gossConfig)
}

// AutoAddResource adds a single resource to fileName with automatic detection of the type of resource
func AutoAddResource(ctx context.Context, fileName string, gossConfig GossConfig, key string, c *util.Config, sys *system.System) error {
	// file
	if strings.Contains(key, "/") {
		res, _, ok, err := gossConfig.Files.AppendSysResourceIfExists(ctx, key, sys)
		if err != nil {
			return err
		}
		if ok {
			resourcePrint(fileName, res, c.AnnounceToCLI)
		}
	}

	// group
	if res, _, ok, err := gossConfig.Groups.AppendSysResourceIfExists(ctx, key, sys); err != nil {
		return err
	} else if ok {
		resourcePrint(fileName, res, c.AnnounceToCLI)
	}

	// package
	if res, _, ok, err := gossConfig.Packages.AppendSysResourceIfExists(ctx, key, sys); err != nil {
		return err
	} else if ok {
		resourcePrint(fileName, res, c.AnnounceToCLI)
	}

	// port
	if res, _, ok, err := gossConfig.Ports.AppendSysResourceIfExists(ctx, key, sys); err != nil {
		return err
	} else if ok {
		resourcePrint(fileName, res, c.AnnounceToCLI)
	}

	// process
	if res, sysres, ok, err := gossConfig.Processes.AppendSysResourceIfExists(ctx, key, sys); err != nil {
		return err
	} else if ok {
		resourcePrint(fileName, res, c.AnnounceToCLI)
		ports := system.GetPorts(true)
		pids, _ := sysres.Pids()
		for _, pid := range pids {
			pidS := strconv.Itoa(pid)
			for port, entries := range ports {
				for _, entry := range entries {
					if entry.Pid == pidS {
						// port
						if res, _, ok, err := gossConfig.Ports.AppendSysResourceIfExists(ctx, port, sys); err != nil {
							return err
						} else if ok {
							resourcePrint(fileName, res, c.AnnounceToCLI)
						}
					}
				}
			}
		}
	}

	// Service
	if res, _, ok, err := gossConfig.Services.AppendSysResourceIfExists(ctx, key, sys); err != nil {
		return err
	} else if ok {
		resourcePrint(fileName, res, c.AnnounceToCLI)
	}

	// user
	if res, _, ok, err := gossConfig.Users.AppendSysResourceIfExists(ctx, key, sys); err != nil {
		return err
	} else if ok {
		resourcePrint(fileName, res, c.AnnounceToCLI)
	}

	return nil
}

```

### Core Architecture Module: `cmd/goss/goss.go`
```
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/goss-org/goss"
	"github.com/goss-org/goss/outputs"
	"github.com/goss-org/goss/resource"
	"github.com/goss-org/goss/system"
	"github.com/goss-org/goss/util"

	"github.com/fatih/color"
	"github.com/urfave/cli/v3"
)

// converts a cli context into a goss Config
func newRuntimeConfigFromCLI(c *cli.Command) *util.Config {
	cfg := &util.Config{
		AllowInsecure:     c.Bool("insecure"),
		AnnounceToCLI:     true,
		Cache:             c.Duration("cache"),
		Debug:             c.Bool("debug"),
		LogLevel:          c.String("log-level"),
		Endpoint:          c.String("endpoint"),
		ExactMatch:        c.Bool("exact-match"),
		FormatOptions:     c.StringSlice("format-options"),
		IgnoreList:        c.StringSlice("exclude-attr"),
		ListenAddress:     c.String("listen-addr"),
		MaxConcurrent:     c.Int("max-concurrent"),
		NoFollowRedirects: c.Bool("no-follow-redirects"),
		OutputFormat:      c.String("format"),
		PackageManager:    c.String("package"),
		Password:          c.String("password"),
		Proxy:             c.String("proxy"),
		RetryTimeout:      c.Duration("retry-timeout"),
		Server:            c.String("server"),
		Sleep:             c.Duration("sleep"),
		Spec:              c.String("gossfile"),
		Timeout:           c.Duration("timeout"),
		Username:          c.String("username"),
		VarsInline:        c.String("vars-inline"),
		VarsFiles:         c.StringSlice("vars"),
	}

	if c.Bool("no-color") {
		util.WithNoColor()(cfg)
	}

	if c.Bool("color") {
		util.WithColor()(cfg)
	}

	return cfg
}

func timeoutFlag(value time.Duration) *cli.DurationFlag {
	return &cli.DurationFlag{
		Name:  "timeout",
		Value: value,
	}
}

func main() {
	app := &cli.Command{
		EnableShellCompletion: true,
		Version:               util.Version,
		Name:                  "goss",
		Usage:                 "Quick and Easy server validation",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "log-level",
				Aliases: []string{"loglevel", "L", "l"},
				Value:   "INFO",
				Usage:   "Goss log verbosity level",
				Sources: cli.EnvVars("GOSS_LOGLEVEL"),
			},
			&cli.StringFlag{
				Name:    "gossfile",
				Aliases: []string{"g"},
				Value:   "./goss.yaml",
				Usage:   "Goss file to read from / write to",
				Sources: cli.EnvVars("GOSS_FILE"),
			},
			&cli.StringSliceFlag{
				Name:    "vars",
				Usage:   "json/yaml file containing variables for template",
				Sources: cli.EnvVars("GOSS_VARS"),
			},
			&cli.StringFlag{
				Name:    "vars-inline",
				Usage:   "json/yaml string containing variables for template (overwrites vars)",
				Sources: cli.EnvVars("GOSS_VARS_INLINE"),
			},
			&cli.StringFlag{
				Name:  "package",
				Usage: fmt.Sprintf("Package type to use [%s]", strings.Join(system.SupportedPackageManagers(), ", ")),
			},
		},
		Commands: []*cli.Command{
			{
				Name:    "validate",
				Aliases: []string{"v"},
				Usage:   "Validate system",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "format",
						Aliases: []string{"f"},
						Value:   "rspecish",
						Usage:   fmt.Sprintf("Format to output in, valid options: %s", outputs.Outputers()),
						Sources: cli.EnvVars("GOSS_FMT"),
					},
					&cli.StringSliceFlag{
						Name:    "format-options",
						Aliases: []string{"o"},
						Usage:   fmt.Sprintf("Extra options passed to the formatter, valid options: %s", outputs.FormatOptions()),
						Sources: cli.EnvVars("GOSS_FMT_OPTIONS"),
					},
					&cli.BoolFlag{
						Name:    "color",
						Usage:   "Force color on",
						Sources: cli.EnvVars("GOSS_COLOR"),
					},
					&cli.BoolFlag{
						Name:    "no-color",
						Usage:   "Force color off",
						Sources: cli.EnvVars("GOSS_NOCOLOR"),
					},
					&cli.DurationFlag{
						Name:    "sleep",
						Aliases: []string{"s"},
						Usage:   "Time to sleep between retries, only active when -r is set",
						Value:   1 * time.Second,
						Sources: cli.EnvVars("GOSS_SLEEP"),
					},
					&cli.DurationFlag{
						Name:    "retry-timeout",
						Aliases: []string{"r"},
						Usage:   "Retry on failure so long as elapsed + sleep time is less than this",
						Value:   0,
						Sources: cli.EnvVars("GOSS_RETRY_TIMEOUT"),
					},
					&cli.IntFlag{
						Name:    "max-concurrent",
						Usage:   "Max number of tests to run concurrently",
						Value:   50,
						Sources: cli.EnvVars("GOSS_MAX_CONCURRENT"),
					},
				},
				Action: func(ctx context.Context, c *cli.Command) error {
					fatalAlphaIfNeeded(c)
					code, err := goss.Validate(ctx, newRuntimeConfigFromCLI(c))
					if err != nil {
						color.Red(fmt.Sprintf("Error: %v\n", err))
					}
					os.Exit(code)

					return nil
				},
			},
			{
				Name:    "serve",
				Aliases: []string{"s"},
				Usage:   "Serve a health endpoint",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "format",
						Aliases: []string{"f"},
						Value:   "rspecish",
						Usage:   fmt.Sprintf("Format to output in, valid options: %s", outputs.Outputers()),
						Sources: cli.EnvVars("GOSS_FMT"),
					},
					&cli.StringSliceFlag{
						Name:    "format-options",
						Aliases: []string{"o"},
						Usage:   fmt.Sprintf("Extra options passed to the formatter, valid options: %s", outputs.FormatOptions()),
						Sources: cli.EnvVars("GOSS_FMT_OPTIONS"),
					},
					&cli.DurationFlag{
						Name:    "cache",
						Aliases: []string{"c"},
						Usage:   "Time to cache the results",
						Value:   5 * time.Second,
						Sources: cli.EnvVars("GOSS_CACHE"),
					},
					&cli.StringFlag{
						Name:    "listen-addr",
						Aliases: []string{"l"},
						Value:   ":8080",
						Usage:   "Address to listen on [ip]:port",
						Sources: cli.EnvVars("GOSS_LISTEN"),
					},
					&cli.StringFlag{
						Name:    "endpoint",
						Aliases: []string{"e"},
						Value:   "/healthz",
						Usage:   "Endpoint to expose",
						Sources: cli.EnvVars("GOSS_ENDPOINT"),
					},
					&cli.IntFlag{
						Name:    "max-concurrent",
						Usage:   "Max number of tests to run concurrently",
						Value:   50,
						Sources: cli.EnvVars("GOSS_MAX_CONCURRENT"),
					},
				},
				Action: func(ctx context.Context, c *cli.Command) error {
					fatalAlphaIfNeeded(c)
					return goss.Serve(newRuntimeConfigFromCLI(c))
				},
			},
			{
				Name:    "render",
				Aliases: []string{"r"},
				Usage:   "render gossfile after imports",
				Flags: []cli.Flag{
					&cli.BoolFlag{
						Name:    "debug",
						Aliases: []string{"d"},
						Usage:   "Print debugging info when rendering",
					},
				},
				Action: func(ctx context.Context, c *cli.Command) error {
					fatalAlphaIfNeeded(c)
					j, err := goss.RenderJSON(newRuntimeConfigFromCLI(c))
					if err != nil {
						return err
					}

					fmt.Print(j)

					return nil
				},
			},
			{
				Name:    "autoadd",
				Aliases: []string{"aa"},
				Usage:   "automatically add all matching resource to the test suite",
				Action: func(ctx context.Context, c *cli.Command) error {
					fatalAlphaIfNeeded(c)
					return goss.AutoAddResources(ctx, c.String("gossfile"), c.Args().Slice(), newRuntimeConfigFromCLI(c))
				},
			},
			{
				Name:    "add",
				Aliases: []string{"a"},
				Usage:   "add a resource to the test suite",
				Flags: []cli.Flag{
					&cli.StringSliceFlag{
						Name:  "exclude-attr",
						Usage: "Exclude the following attributes when adding a new resource",
					},
				},
				Commands: []*cli.Command{
					{
						Name:  resource.PackageResourceKey,
						Usage: "add new package",
						Action: func(ctx context.Context, c *cli.Command) error {
							fatalAlphaIfNeeded(c)
							return goss.AddResources(ctx, c.String("gossfile"), resource.PackageResourceName, c.Args().Slice(), newRuntimeConfigFromCLI(c))
						},
					},
					{
						Name:  resource.FileResourceKey,
						Usage: "add new file",
						Action: func(ctx context.Context, c *cli.Command) error {
							fatalAlphaIfNeeded(c)
							return goss.AddResources(ctx, c.String("gossfile"), resource.FileResourceName, c.Args().Slice(), newRuntimeConfigFromCLI(c))
						},
					},
					{
						Name:  resource.AddrResourceKey,
						Usage: "add new remote address:port - ex: google.com:80",
						Flags: []cli.Flag{
							timeoutFlag(500 * time.Millisecond),
						},
						Action: func(ctx context.Context, c *cli.Command) error {
							fatalAlphaIfNeeded(c)
							return goss.AddResources(ctx, c.String("gossfile"), resource.AddResourceName, c.Args().Slice(), newRuntimeConfigFromCLI(c))
						},
					},
					{
						Name:  resource.PortResourceKey,
						Usage: "add new listening [protocol]:port - ex: 80 or udp:123",
						Action: func(ctx context.Context, c *cli.Command) error {
							fatalAlphaIfNeeded(c)
							return goss.AddResources(ctx, c.String("gossfile"), resource.PortResourceName, c.Args().Slice(), newRuntimeConfigFromCLI(c))
						},
					},
					{
						Name:  resource.ServiceResourceKey,
						Usage: "add new service",
						Action: func(ctx context.Context, c *cli.Command) error {
							fatalAlphaIfNeeded(c)
							return goss.AddResources(ctx, c.String("gossfile"), resource.ServiceResourceName, c.Args().Slice(), newRuntimeConfigFromCLI(c))
						},
					},
					{
						Name:  resource.UserResourceKey,
						Usage: "add new user",
						Action: func(ctx context.Context, c *cli.Command) error {
							fatalAlphaIfNeeded(c)
							return goss.AddResources(ctx, c.String("gossfile"), resource.UserResourceName, c.Args().Slice(), newRuntimeConfigFromCLI(c))
						},
					},
					{
						Name:  resource.GroupResourceKey,
						Usage: "add new group",
						Action: func(ctx context.Context, c *cli.Command) error {
							fatalAlphaIfNeeded(c)
							return goss.AddResources(ctx, c.String("gossfile"), resource.GroupResourceName, c.Args().Slice(), newRuntimeConfigFromCLI(c))
						},
					},
					{
						Name:  resource.CommandResourceKey,
						Usage: "add new command",
						Flags: []cli.Flag{
							timeoutFlag(10 * time.Second),
							&cli.BoolF
```

### Core Architecture Module: `goss_config.go`
```
package goss

import (
	"log"
	"reflect"

	"github.com/goss-org/goss/resource"
)

type GossConfig struct {
	Files        resource.FileMap        `json:"file,omitempty" yaml:"file,omitempty"`
	Packages     resource.PackageMap     `json:"package,omitempty" yaml:"package,omitempty"`
	Addrs        resource.AddrMap        `json:"addr,omitempty" yaml:"addr,omitempty"`
	Ports        resource.PortMap        `json:"port,omitempty" yaml:"port,omitempty"`
	Services     resource.ServiceMap     `json:"service,omitempty" yaml:"service,omitempty"`
	Users        resource.UserMap        `json:"user,omitempty" yaml:"user,omitempty"`
	Groups       resource.GroupMap       `json:"group,omitempty" yaml:"group,omitempty"`
	Commands     resource.CommandMap     `json:"command,omitempty" yaml:"command,omitempty"`
	DNS          resource.DNSMap         `json:"dns,omitempty" yaml:"dns,omitempty"`
	Processes    resource.ProcessMap     `json:"process,omitempty" yaml:"process,omitempty"`
	Gossfiles    resource.GossfileMap    `json:"gossfile,omitempty" yaml:"gossfile,omitempty"`
	KernelParams resource.KernelParamMap `json:"kernel-param,omitempty" yaml:"kernel-param,omitempty"`
	Mounts       resource.MountMap       `json:"mount,omitempty" yaml:"mount,omitempty"`
	Interfaces   resource.InterfaceMap   `json:"interface,omitempty" yaml:"interface,omitempty"`
	HTTPs        resource.HTTPMap        `json:"http,omitempty" yaml:"http,omitempty"`
	Matchings    resource.MatchingMap    `json:"matching,omitempty" yaml:"matching,omitempty"`
	Registries   resource.RegistryMap    `json:"registry,omitempty" yaml:"registry,omitempty"`
}

func NewGossConfig() *GossConfig {
	return &GossConfig{
		Files:        make(resource.FileMap),
		Packages:     make(resource.PackageMap),
		Addrs:        make(resource.AddrMap),
		Ports:        make(resource.PortMap),
		Services:     make(resource.ServiceMap),
		Users:        make(resource.UserMap),
		Groups:       make(resource.GroupMap),
		Commands:     make(resource.CommandMap),
		DNS:          make(resource.DNSMap),
		Processes:    make(resource.ProcessMap),
		Gossfiles:    make(resource.GossfileMap),
		KernelParams: make(resource.KernelParamMap),
		Mounts:       make(resource.MountMap),
		Interfaces:   make(resource.InterfaceMap),
		HTTPs:        make(resource.HTTPMap),
		Matchings:    make(resource.MatchingMap),
		Registries:   make(resource.RegistryMap),
	}
}

// Merge consumes all the resources in g2 into c, duplicate resources
// will be overwritten with the ones in g2
func (c *GossConfig) Merge(g2 GossConfig) {
	for k, v := range g2.Files {
		mergeType(c.Files, "file", k, v)
	}

	for k, v := range g2.Packages {
		mergeType(c.Packages, "package", k, v)
	}

	for k, v := range g2.Addrs {
		mergeType(c.Addrs, "addr", k, v)
	}

	for k, v := range g2.Ports {
		mergeType(c.Ports, "port", k, v)
	}

	for k, v := range g2.Services {
		mergeType(c.Services, "service", k, v)
	}

	for k, v := range g2.Users {
		mergeType(c.Users, "user", k, v)
	}

	for k, v := range g2.Groups {
		mergeType(c.Groups, "group", k, v)
	}

	for k, v := range g2.Commands {
		mergeType(c.Commands, "command", k, v)
	}

	for k, v := range g2.DNS {
		mergeType(c.DNS, "dns", k, v)
	}

	for k, v := range g2.Processes {
		mergeType(c.Processes, "process", k, v)
	}

	for k, v := range g2.KernelParams {
		mergeType(c.KernelParams, "kernel-param", k, v)
	}

	for k, v := range g2.Mounts {
		mergeType(c.Mounts, "mount", k, v)
	}

	for k, v := range g2.Interfaces {
		mergeType(c.Interfaces, "interface", k, v)
	}

	for k, v := range g2.HTTPs {
		mergeType(c.HTTPs, "http", k, v)
	}

	for k, v := range g2.Matchings {
		mergeType(c.Matchings, "matching", k, v)
	}
	for k, v := range g2.Registries {
		mergeType(c.Registries, "registry", k, v)
	}
}

func mergeType[V any](m map[string]V, t, k string, v V) {
	if _, ok := m[k]; ok {
		log.Printf("[WARN] Duplicate key detected: '%s: %s'. The value from a later-loaded goss file has overwritten the previous value.", t, k)
	}
	m[k] = v
}

func (c *GossConfig) Resources() []resource.Resource {
	var tests []resource.Resource

	gm := genericConcatMaps(c.Commands,
		c.HTTPs,
		c.Addrs,
		c.DNS,
		c.Packages,
		c.Services,
		c.Files,
		c.Processes,
		c.Users,
		c.Groups,
		c.Ports,
		c.KernelParams,
		c.Mounts,
		c.Interfaces,
		c.Matchings,
		c.Registries,
	)

	for _, m := range gm {
		for _, t := range m {
			// FIXME: Can this be moved to a safer compile-time check?
			tests = append(tests, t.(resource.Resource))
		}
	}

	return tests
}

func genericConcatMaps(maps ...any) (ret []map[string]any) {
	for _, slice := range maps {
		im := interfaceMap(slice)
		ret = append(ret, im)
	}
	return ret
}

func interfaceMap(slice any) map[string]any {
	m := reflect.ValueOf(slice)
	if m.Kind() != reflect.Map {
		panic("InterfaceSlice() given a non-slice type")
	}

	ret := make(map[string]any)

	for _, k := range m.MapKeys() {
		ret[k.Interface().(string)] = m.MapIndex(k).Interface()
	}

	return ret
}

func mergeGoss(g1, g2 GossConfig) GossConfig {
	g1.Gossfiles = nil

	g1.Merge(g2)

	return g1
}

```

### Core Architecture Module: `logs.go`
```
package goss

import (
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/goss-org/goss/util"
	"github.com/hashicorp/logutils"
)

func setLogLevel(c *util.Config) error {
	filter, err := newLogFilter(c.LogLevel, os.Stderr)
	if err != nil {
		return err
	}
	log.SetFlags(0) // Turn off standard timestamp flags
	log.SetOutput(&timestampedWriter{filter})
	log.Printf("[DEBUG] Setting log level to %v", strings.ToUpper(c.LogLevel))
	return nil
}

// newLogFilter builds the level filter used to gate goss's log output. Levels
// are expressed as a prefix on each message (for example "[DEBUG] ..."), so any
// message logged without one is emitted regardless of the configured level.
func newLogFilter(level string, w io.Writer) (*logutils.LevelFilter, error) {
	filter := &logutils.LevelFilter{
		Levels:   []logutils.LogLevel{"TRACE", "DEBUG", "INFO", "WARN", "ERROR"},
		MinLevel: logutils.LogLevel("INFO"),
		Writer:   w,
	}
	want := strings.ToUpper(level)
	for _, lvl := range filter.Levels {
		if string(lvl) == want {
			filter.MinLevel = lvl
			return filter, nil
		}
	}
	return nil, fmt.Errorf("Unsupported log level: %s", level)
}

type timestampedWriter struct {
	wrappedWriter io.Writer
}

func (t *timestampedWriter) Write(b []byte) (int, error) {
	timestamp := time.Now().UTC().Format(time.RFC3339)
	return fmt.Fprintf(t.wrappedWriter, "%s %s", timestamp, b)
}

```

### Core Architecture Module: `matchers/and.go`
```
package matchers

import (
	"encoding/json"
)

type AndMatcher struct {
	fakeOmegaMatcher
	Matchers []GossMatcher

	// state
	firstFailedMatcher GossMatcher
}

func And(ms ...GossMatcher) GossMatcher {
	return &AndMatcher{Matchers: ms}
}

func (m *AndMatcher) Match(actual interface{}) (success bool, err error) {
	m.firstFailedMatcher = nil
	for _, matcher := range m.Matchers {
		success, err := matcher.Match(actual)
		if !success || err != nil {
			m.firstFailedMatcher = matcher
			return false, err
		}
	}
	return true, nil
}

// FailureResult reports the first matcher that failed. firstFailedMatcher is
// only set once Match has actually run a child matcher, and that does not
// always happen: WithSafeTransformMatcher.Match returns early when its
// transform errors — a gjson path that does not exist, for example — so the
// wrapped And never evaluates anything and its state stays nil. Dereferencing
// it there panicked (#982). Report the And itself in that case, which keeps the
// surrounding transform chain and raw value in the output so the user can see
// which path they actually matched against.
func (m *AndMatcher) FailureResult(actual any) MatcherResult {
	if m.firstFailedMatcher == nil {
		return MatcherResult{
			Actual:   actual,
			Message:  "to satisfy all of these matchers",
			Expected: m.Matchers,
		}
	}
	return m.firstFailedMatcher.FailureResult(actual)
}

func (m *AndMatcher) NegatedFailureResult(actual interface{}) MatcherResult {
	return MatcherResult{
		Actual:   actual,
		Message:  "not to satisfy all of these matchers",
		Expected: m.Matchers,
	}
}

func (m *AndMatcher) MarshalJSON() ([]byte, error) {
	if len(m.Matchers) == 1 {
		return json.Marshal(m.Matchers[0])
	}
	j := make(map[string]interface{})
	j["and"] = m.Matchers
	return json.Marshal(j)
}

```

### Core Architecture Module: `matchers/be_numerically_matcher.go`
```
package matchers

import (
	"encoding/json"
	"fmt"

	"github.com/onsi/gomega/matchers"
)

type BeNumericallyMatcher struct {
	fakeOmegaMatcher
	Comparator string
	CompareTo  []interface{}
}

func BeNumerically(comparator string, compareTo ...interface{}) GossMatcher {
	return &BeNumericallyMatcher{
		Comparator: comparator,
		CompareTo:  compareTo,
	}
}
func (m *BeNumericallyMatcher) Match(actual interface{}) (success bool, err error) {
	comparator, err := strToSymbol(m.Comparator)
	if err != nil {
		return false, err
	}
	matcher := &matchers.BeNumericallyMatcher{
		Comparator: comparator,
		CompareTo:  m.CompareTo,
	}
	return matcher.Match(actual)
}

func (m *BeNumericallyMatcher) FailureResult(actual interface{}) MatcherResult {
	return MatcherResult{
		Actual:   actual,
		Message:  fmt.Sprintf("to be numerically %s", m.Comparator),
		Expected: m.CompareTo[0],
	}
}

func (m *BeNumericallyMatcher) NegatedFailureResult(actual interface{}) MatcherResult {
	return MatcherResult{
		Actual:   actual,
		Message:  fmt.Sprintf("not to be numerically %s", m.Comparator),
		Expected: m.CompareTo[0],
	}
}

func (m *BeNumericallyMatcher) MarshalJSON() ([]byte, error) {
	j := make(map[string]interface{})
	j[m.Comparator] = m.CompareTo[0]
	return json.Marshal(j)
}

func strToSymbol(s string) (string, error) {
	comparator, ok := map[string]string{
		"gt": ">",
		"ge": ">=",
		"lt": "<",
		"le": "<=",
		"eq": "==",
	}[s]
	if !ok {
		return "", fmt.Errorf("Unknown comparator: %s", s)
	}
	return comparator, nil
}

```

### Core Architecture Module: `matchers/consist_of.go`
```
package matchers

import (
	"encoding/json"

	"github.com/onsi/gomega/matchers"
	"github.com/samber/lo"
)

type ConsistOfMatcher struct {
	matchers.ConsistOfMatcher
}

func ConsistOf(elements ...interface{}) GossMatcher {
	return &ConsistOfMatcher{
		matchers.ConsistOfMatcher{
			Elements: elements,
		},
	}
}

func (m *ConsistOfMatcher) FailureResult(actual interface{}) MatcherResult {
	missingElements := getUnexported(m, "missingElements")
	extraElements := getUnexported(m, "extraElements")
	missingEl, ok := missingElements.([]interface{})
	var foundElements any
	if ok {
		foundElements, _ = lo.Difference(m.Elements, missingEl)
	}
	return MatcherResult{
		Actual:          actual,
		Message:         "to consist of",
		Expected:        m.Elements,
		MissingElements: missingElements,
		ExtraElements:   extraElements,
		FoundElements:   foundElements,
	}
}

func (m *ConsistOfMatcher) NegatedFailureResult(actual interface{}) MatcherResult {
	return MatcherResult{
		Actual:   actual,
		Message:  "not to consist of",
		Expected: m.Elements,
	}
}

func (m *ConsistOfMatcher) MarshalJSON() ([]byte, error) {
	j := make(map[string]interface{})
	j["consist-of"] = m.Elements
	return json.Marshal(j)
}

```

### Core Architecture Module: `matchers/contain_element_matcher.go`
```
package matchers

import (
	"encoding/json"

	"github.com/onsi/gomega/matchers"
)

type ContainElementMatcher struct {
	matchers.ContainElementMatcher
}

func ContainElement(element interface{}) GossMatcher {
	return &ContainElementMatcher{
		matchers.ContainElementMatcher{
			Element: element,
		},
	}
}

func (m *ContainElementMatcher) FailureResult(actual interface{}) MatcherResult {
	return MatcherResult{
		Actual:   actual,
		Message:  "to contain element matching",
		Expected: m.Element,
	}
}

func (m *ContainElementMatcher) NegatedFailureResult(actual interface{}) MatcherResult {
	return MatcherResult{
		Actual:   actual,
		Message:  "not to contain element matching",
		Expected: m.Element,
	}
}

func (m *ContainElementMatcher) MarshalJSON() ([]byte, error) {
	j := make(map[string]interface{})
	j["contain-element"] = m.Element
	return json.Marshal(j)
}

```

### Core Architecture Module: `matchers/contain_elements_matcher.go`
```
package matchers

import (
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/onsi/gomega/format"
	"github.com/onsi/gomega/matchers"
	"github.com/samber/lo"
)

type ContainElementsMatcher struct {
	matchers.ContainElementsMatcher
}

func ContainElements(elements ...interface{}) GossMatcher {
	return &ContainElementsMatcher{
		matchers.ContainElementsMatcher{
			Elements: elements,
		},
	}
}

func (m *ContainElementsMatcher) Match(actual any) (success bool, err error) {
	if !isArrayOrSlice(actual) && !isMap(actual) {
		return false, fmt.Errorf("ContainElements matcher expects an array/slice/map.  Got:\n%s", format.Object(actual, 1))
	}
	return m.ContainElementsMatcher.Match(actual)
}

func (m *ContainElementsMatcher) FailureResult(actual interface{}) MatcherResult {
	missingElements := getUnexported(m, "missingElements")
	missingEl, ok := missingElements.([]interface{})
	var foundElements any
	if ok {
		foundElements, _ = lo.Difference(m.Elements, missingEl)
	}
	return MatcherResult{
		Actual:          actual,
		Message:         "to contain elements matching",
		Expected:        m.Elements,
		MissingElements: missingElements,
		FoundElements:   foundElements,
	}
}

func (m *ContainElementsMatcher) NegatedFailureResult(actual interface{}) MatcherResult {
	return MatcherResult{
		Actual:   actual,
		Message:  "not to contain elements matching",
		Expected: m.Elements,
	}
}

func (m *ContainElementsMatcher) MarshalJSON() ([]byte, error) {
	j := make(map[string]interface{})
	j["contain-elements"] = m.Elements
	return json.Marshal(j)
}

func isMap(a any) bool {
	if a == nil {
		return false
	}
	return reflect.TypeOf(a).Kind() == reflect.Map
}

func isArrayOrSlice(a any) bool {
	if a == nil {
		return false
	}
	switch reflect.TypeOf(a).Kind() {
	case reflect.Array, reflect.Slice:
		return true
	default:
		return false
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1123** (2026-08-25): **release v0.4.10 is missing sha256 checksums**
  *Symptoms*: **Describe the bug** Release v0.4.10 is missing sha256 checksums  **How To Reproduce** ``` curl "https://github.com/goss-org/goss/releases/download/v0.4.10/goss-linux-arm64.sha256" -vf ```  **Expected Behavior** There should be a checksum for v0.4.10 release just as for previous releases  **Actual Behavior** Cheksum files are missing  **Environment:**  - Version of goss v0.4.10  - OS/Distribution version (if applicable) 
  **Post-Mortem & Fix Analysis**:
  > I'm blind. There is a file for all checksums here: https://github.com/goss-org/goss/releases/download/v0.4.10/goss_0.4.10_SHA256SUMS

- **Issue #1094** (2026-08-15): **goss serve runs one full validation per concurrent request when the cache expires**
  *Symptoms*: **Describe the bug**  When the `goss serve` result cache is cold, every request that arrives runs its own complete validation. There is no deduplication, so N simultaneous requests do N times the work.  This hits the case `goss serve` exists for. Anything scraping `/healthz` on an interval, several Prometheus replicas, a load balancer health check, a Kubernetes probe, will converge on the cache expiry and arrive in the cold window together. The default `--cache` is 5s, so that window comes round often.  `healthHandler` has a `gossMu *sync.Mutex` field (`serve.go:57` and `serve.go:73`) that looks like it was meant for this, but it is never locked anywhere in the package. So there is not even serialisation, let alone deduplication. The runs happen genuinely concurrently, each building its own `system.New` and running every check in the gossfile.  **How To Reproduce**  Save as `stampede_test.go` in the root package and run `go test -run TestStampede -v ./`. It counts the cache-miss line, which is logged once per validation run.  ```go package goss  import ( 	"bytes" 	"log" 	"net/http" 	"net/http/httptest" 	"path/filepath" 	"strings" 	"sync" 	"testing"  	"github.com/goss-org/goss/util" 	"github.com/stretchr/testify/require" )  type syncBuf struct { 	mu  sync.Mutex 	buf bytes.Buffer }  func (s *syncBuf) Write(p []byte) (int, error) { 	s.mu.Lock() 	defer s.mu.Unlock() 	return s.buf.Write(p) }  func (s *syncBuf) String() string { 	s.mu.Lock() 	defer s.mu.Unlock() 	return s.buf.Strin
  **Post-Mortem & Fix Analysis**:
  > Independently reproduced on `master` at `4a91642`, darwin/arm64, Go 1.26.5. Your test as written, unmodified:  ``` 16 concurrent requests produced 16 validation runs ```  One run per request, exactly as reported.  **@dukelion — I'm not opening a PR for this.** You said you'd be happy to and you've had it running on a fork for months, so it's yours. I only went as far as checking whether the decision in front of you needs a dependency, because that looked like the thing actually holding it up.  **It doesn't.** The `gossMu` you spotted is enough on its own. Lock it around the cache-miss branch and re-check the cache inside the lock:  ```go } else {     h.gossMu.Lock()     if tmp, found := h.cache.Get(cacheKey); found {         log.Printf("[TRACE] Returning cached[%s].", cacheKey)         tra = tmp.([][]resource.TestResult)     } else {         log.Printf(cacheMissLogFormat, cacheKey)         h.sys = system.New(h.c.PackageManager)         tra = h.validate()         h.cache.SetDefault(cach
  > One more thing that's directly useful here, found while reading around this: **the repo already has the test file this regression belongs in, and it currently encodes the stampede as normal.**  `serve_concurrency_test.go` — `TestServeHandlesConcurrentRequests` — landed in `056389c` (#1092, 2026-08-04, @VasiliiAlferov), one day after this issue was filed. It drives a single `healthHandler` from **16 goroutines** against `testdata/matching_basic.yaml`, which is the same shape as the reproduction above. Its own comment says it picked a spec with no subprocesses:  > A spec with no subprocesses, so the test stays fast when **every goroutine misses the cache at once**.  So the cold-cache pile-up is already described in the codebase, and already exercised on every CI run — it just isn't treated as a defect, because that test is aimed at a different failure mode. Its stated value is "under `-race` ... a future change that reaches for process-wide mutable state from a request will be caught her

- **Issue #1088** (2026-08-03): **Manual installation broken in v0.4.10**
  *Symptoms*: The instructions in https://github.com/goss-org/goss#manual-installation suggest running `curl -L https://github.com/goss-org/goss/releases/latest/download/goss-linux-amd64 -o /usr/local/bin/goss`, and that used to work fine up until [v0.4.9](https://github.com/goss-org/goss/releases/tag/v0.4.9), but it's broken in [v0.4.10](https://github.com/goss-org/goss/releases/tag/v0.4.10)  because the asset  `goss-linux-amd64` doesn't exist on that release; it seems to have been replaced by asset `goss_0.4.10_linux_x86_64.tar.gz`.
  **Post-Mortem & Fix Analysis**:
  > I'll update the docs later, but it'll be a few hours. If it want to open a PR with the fix, I'm open to merging that.
  > In the meantime, use the installation script, specifying `GOSS_DST` for the installation location.
  > Just curious what was the reason for this change? We used it in CI and now I am chasing ghosts because of it in the middle of the night :) We love this project, but changes like this can quite hurt. Would be nicer to introduce such changes gradually so we have time to migrate.

- **Issue #1085** (2026-07-26): **Installation fails using `curl | sh`**
  *Symptoms*: **Describe the bug**  Goss fails to install using the auto installer: `curl -fsSL https://goss.rocks/install | sh`.  **How To Reproduce** 1. Get a clean Ubuntu 26.04 VM. 2. Run the install script as root: `curl -fsSL https://goss.rocks/install` 3. Observe the error: ``` Downloading https://github.com/goss-org/goss/releases/download/v0.4.9/goss_0.4.9_linux_x86_64.tar.gz   % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current                                  Dload  Upload  Total   Spent   Left   Speed 100      9 100      9   0      0     34      0                              0  gzip: stdin: not in gzip format tar: Child returned status 1 tar: Error is not recoverable: exiting now ```  It looks like the generated download link is wrong. It returns 404 when I try to download it manually.  **Expected Behavior** Successful install.  **Actual Behavior** Failed install. See the error message above.  **Environment:**  - Version of goss: latest (0.4.9)  - OS/Distribution version: Ubuntu 26.04 LTS  - Arch: amd64/x86_64 
  **Post-Mortem & Fix Analysis**:
  > This is a duplicate of #1077. The fix is to cut a new release, which hopefully should be happening soon.
  > This was fixed by the latest v0.4.10 release. See #1077 for further details.

- **Issue #1077** (2026-07-26): **New multi-platform image builds broken**
  *Symptoms*: **Describe the bug** In commit [2388dfd](https://github.com/goss-org/goss/commit/2388dfd16a636c56a530da2a109041a906f2410d) the `install.sh` script is adjusted to support multiple (new) platforms. However, there is no new release (yet), which causes the script to install the latest `v0.4.9` version but with the updated platform (`x86_64` in my case, https://github.com/goss-org/goss/releases/download/v0.4.9/goss_0.4.9_linux_x86_64.tar.gz). This asset does not exist, causing the goss installation to fail.  **How To Reproduce** Run `curl -fsSL https://goss.rocks/install | sh`, like mentioned in the readme. Even with the `GOSS_VER=` setup this still fails.  **Expected Behavior** I expect to be able to install older versions (or at least the latest version) without any issues.  **Actual Behavior** Like mentioned above, a 404 error occurs which fails the installation.  **Environment:** The output of `uname -m`: ``` $ uname -m x86_64 ```  I think either a new version needs to be released, or the install script needs to be updated somehow so that older versions still can be downloaded with the "old" architecture setup?
  **Post-Mortem & Fix Analysis**:
  > This will be fixed when there's a new release. I'm honestly puzzled as to why the install script would be the one at the HEAD of the master branch. There's obviously some automation in place I'm not aware of.
  > Yes this/ my issue will indeed be fixed when there is a new release.  However, per the documentation, you can also install goss with a specific version (using `GOSS_VER=`). If someone has that pointed to `0.4.9`, then that installation still fails, because the install script is pulled from master and that contains the new platform, which does not exist for older versions. (unless all existing versions also get updated assets, in which case my comment can be disregarded)
  > I'm hoping I can get the maintainers to cut a new release. While I've been trying to get the project back on track recently with fixes and modernisations, I'm not a maintainer, and fixing this issue will require a maintainer to cut a new release. I think I'm close though, with just a few more PRs that need to be merged.

- **Issue #1065** (2026-07-05): **s390x not working with install.sh (https://goss.rocks/install)**
  *Symptoms*: **Describe the bug** <!-- A clear and concise description of what the bug is. -->  We are using goss with the architecture s390x using Ubuntu.  To detect the architecture, the install.sh script has the following logic: ``` arch="" if [ "$(uname -m)" = "x86_64" ]; then     arch="amd64" elif [ "$(uname -m)" = "aarch32" ]; then     arch="arm" elif [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "arm64" ]; then     arch="arm64" else     arch="386" fi ```  "$(uname -m)" in s390x is "s390x", same as in the s390x release of goss. As the default installs the `386` goss, it does not work. Either the default should be "$(uname -m)" or a new elif branch should be added for s390x (with both strings the same value).  **How To Reproduce** <!-- Please provide a minimal reproducible example https://stackoverflow.com/help/minimal-reproducible-example -->  Just run `curl -fsSL https://goss.rocks/install | sh` in a s390x machine.  **Expected Behavior** <!-- A clear and concise description of what you expected to happen. -->  The install script should install the correct binary for the architecture.  **Actual Behavior** <!-- A clear and concise description of what actually happened. -->  The s390x binary should be installed.  **Environment:**  - Version of goss  - Ubuntu 24.04 with arch s390x.
  **Post-Mortem & Fix Analysis**:
  > I've created a PR to cover this. While issues around maintainership of goss are up in the air, future PRs are still welcome.

- **Issue #1021** (2026-07-26): **.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @balajitoverto could you close this issue if it is no longer relevant?

- **Issue #1014** (2026-07-11): **Links in documentation are broken**
  *Symptoms*: **Describe the bug** <!-- A clear and concise description of what the bug is. -->  Currently the docs contain several links to https://goss.rocks. Those are all broken.  I assume most should be replaced with the appropriate links to https://goss.readthedocs.io/en/stable/ I'm happy to provide a PR to fix those if linking them to readthedocs.io is the prefered solution 😄    Broken Links: https://github.com/goss-org/goss/blob/master/README.md?plain=1#L108-L109 https://github.com/goss-org/goss/blob/master/README.md?plain=1#L164 https://github.com/goss-org/goss/blob/master/README.md?plain=1#L196 https://github.com/goss-org/goss/blob/master/README.md?plain=1#L203 https://github.com/goss-org/goss/blob/master/README.md?plain=1#L209-L211 https://github.com/goss-org/goss/blob/master/README.md?plain=1#L346  https://github.com/goss-org/goss/blob/master/docs/gossfile.md?plain=1#L106 https://github.com/goss-org/goss/blob/master/docs/gossfile.md?plain=1#L115  https://github.com/goss-org/goss/blob/master/.github/ISSUE_TEMPLATE/feature_request.md?plain=1#L14  https://github.com/goss-org/goss/blob/master/.github/CONTRIBUTING.md?plain=1#L38  
  **Post-Mortem & Fix Analysis**:
  > Related to: - #925 

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

### Incident Patch 1: `f6db0310` (2026-10-04)
**Commit Message**: build(deps): bump github/codeql-action from 4.38.1 to 4.38.2 (#1138)

Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.38.1 to 4.38.2.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/v4.38.1...v4.38.2)

---
updated-dependencies:
- dependency-name: github/codeql-action
  dependency-version: 4.38.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/docker-goss.yaml` (modified, +1/-1)
```diff
@@ -88,6 +88,6 @@ jobs:
           output: "trivy-results.sarif"
 
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@v4.38.1
+        uses: github/codeql-action/upload-sarif@v4.38.2
         with:
           sarif_file: "trivy-results.sarif"
```

**File**: `.github/workflows/trivy-schedule.yaml` (modified, +1/-1)
```diff
@@ -22,6 +22,6 @@ jobs:
           output: "trivy-results.sarif"
 
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@v4.38.1
+        uses: github/codeql-action/upload-sarif@v4.38.2
         with:
           sarif_file: "trivy-results.sarif"
```

---

### Incident Patch 2: `b3f544b7` (2026-10-04)
**Commit Message**: build(deps): bump zensical from 0.0.64 to 0.0.67 in /docs (#1137)

Bumps [zensical](https://github.com/zensical/zensical) from 0.0.64 to 0.0.67.
- [Release notes](https://github.com/zensical/zensical/releases)
- [Commits](https://github.com/zensical/zensical/compare/v0.0.64...v0.0.67)

---
updated-dependencies:
- dependency-name: zensical
  dependency-version: 0.0.67
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `docs/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-zensical==0.0.64
+zensical==0.0.67
```

---

### Incident Patch 3: `08f88210` (2026-09-26)
**Commit Message**: build(deps): bump zensical from 0.0.62 to 0.0.64 in /docs (#1133)

* build(deps): bump zensical from 0.0.62 to 0.0.64 in /docs

Bumps [zensical](https://github.com/zensical/zensical) from 0.0.62 to 0.0.64.
- [Release notes](https://github.com/zensical/zensical/releases)
- [Commits](https://github.com/zensical/zensical/compare/v0.0.62...v0.0.64)

---
updated-dependencies:
- dependency-name: zensical
  dependency-version: 0.0.64
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* Pull in some additional dependency updates

* Fix missed places where the context wasn't passed to unbreak tests

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Keith Gaughan <[REDACTED_EMAIL]>

**File**: `docs/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-zensical==0.0.62
+zensical==0.0.64
```

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -17,15 +17,15 @@ require (
 	github.com/miekg/dns v1.1.73
 	github.com/moby/sys/mountinfo v0.7.2
 	github.com/oleiade/reflections v1.1.0
-	github.com/onsi/gomega v1.43.0
+	github.com/onsi/gomega v1.44.0
 	github.com/patrickmn/go-cache v2.1.0+incompatible
 	github.com/pmezard/go-difflib v1.0.0
 	github.com/prometheus/client_golang v1.24.1
 	github.com/prometheus/common v0.71.0
 	github.com/samber/lo v1.53.0
 	github.com/stretchr/testify v1.12.1
 	github.com/tidwall/gjson v1.19.0
-	github.com/urfave/cli/v3 v3.11.0
+	github.com/urfave/cli/v3 v3.13.0
 	go.yaml.in/yaml/v3 v3.0.5
 	golang.org/x/sys v0.48.0
 	gopkg.in/yaml.v3 v3.0.1
@@ -40,7 +40,7 @@ require (
 	github.com/golang/groupcache v0.0.0-20241129210726-2c02b8208cf8 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
 	github.com/google/uuid v1.6.0 // indirect
-	github.com/huandu/xstrings v1.5.0 // indirect
+	github.com/huandu/xstrings v1.6.1 // indirect
 	github.com/mattn/go-colorable v0.1.15 // indirect
 	github.com/mattn/go-isatty v0.0.24 // indirect
 	github.com/mitchellh/copystructure v1.2.0 // indirect
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -39,8 +39,8 @@ github.com/goss-org/go-ps v0.0.0-20230609005227-7b318e6a56e5 h1:NW0Jo4leMIrQxNOy
 github.com/goss-org/go-ps v0.0.0-20230609005227-7b318e6a56e5/go.mod h1:FYj70SLmogHdTTDGnIVaaK0iczROlsxmoMCwfAUuIE8=
 github.com/hashicorp/logutils v1.0.0 h1:dLEQVugN8vlakKOUE3ihGLTZJRB4j+M2cdTm/ORI65Y=
 github.com/hashicorp/logutils v1.0.0/go.mod h1:QIAnNjmIWmVIIkWDTG1z5v++HQmx9WQRO+LraFDTW64=
-github.com/huandu/xstrings v1.5.0 h1:2ag3IFq9ZDANvthTwTiqSSZLjDc+BedvHPAp5tJy2TI=
-github.com/huandu/xstrings v1.5.0/go.mod h1:y5/lhBue+AyNmUVz9RLU9xbLR0o4KIIExikq4ovT0aE=
+github.com/huandu/xstrings v1.6.1 h1:yYdKSd6Sjv3fNZt9BDjl1FDsPNfQEaYi19L5LzK2JKs=
+github.com/huandu/xstrings v1.6.1/go.mod h1:y5/lhBue+AyNmUVz9RLU9xbLR0o4KIIExikq4ovT0aE=
 github.com/klauspost/compress v1.19.1 h1:VsB4HPswih7mmZ8WleSFQ75c/Ui1M4trX5oAsJnhSlk=
 github.com/klauspost/compress v1.19.1/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/kr/pretty v0.3.1 h1:flRD4NNwYAUpkphVc1HcthR4KEIFJ65n8Mw5qdRn3LE=
@@ -65,8 +65,8 @@ github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 h1:C3w9PqII01/Oq
 github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822/go.mod h1:+n7T8mK8HuQTcFwEeznm/DIxMOiR9yIdICNftLE1DvQ=
 github.com/oleiade/reflections v1.1.0 h1:D+I/UsXQB4esMathlt0kkZRJZdUDmhv5zGi/HOwYTWo=
 github.com/oleiade/reflections v1.1.0/go.mod h1:mCxx0QseeVCHs5Um5HhJeCKVC7AwS8kO67tky4rdisA=
-github.com/onsi/gomega v1.43.0 h1:VlG/1FxqNxhSO+lq/OHBNaaqwiBK/mO8JbVkX9Y+FeU=
-github.com/onsi/gomega v1.43.0/go.mod h1:REff/hsDsodHoKlWsP2mAPhu1+5/6hVYNf9rIEBpeSg=
+github.com/onsi/gomega v1.44.0 h1:eAiGl3Pw5jz5GQdDff0BcxYpAX1JxW8xD7mFUuwNfZQ=
+github.com/onsi/gomega v1.44.0/go.mod h1:e/C2HwaZ1DhvjzXXuFhcR7hY7Sh9pl7MmoWKEjzwcdA=
 github.com/patrickmn/go-cache v2.1.0+incompatible h1:HRMgzkcYKYpi3C8ajMPV8OFXaaRUnok+kx1WdO15EQc=
 github.com/patrickmn/go-cache v2.1.0+incompatible/go.mod h1:3Qf8kWWT7OJRJbdiICTKqZju1ZixQ/KpMGzzAfe6+WQ=
 github.com/pmezard/go-difflib v1.0.0 h1:4DBwDE0NGyQoBHbLQYPwSUPoCMWR5BEzIk/f1lZbAQM=
@@ -95,8 +95,8 @@ github.com/tidwall/match v1.2.0 h1:0pt8FlkOwjN2fPt4bIl4BoNxb98gGHN2ObFEDkrfZnM=
 github.com/tidwall/match v1.2.0/go.mod h1:eRSPERbgtNPcGhD8UCthc6PmLEQXEWd3PRB5JTxsfmM=
 github.com/tidwall/pretty v1.2.1 h1:qjsOFOWWQl+N3RsoF5/ssm1pHmJJwhjlSbZ51I6wMl4=
 github.com/tidwall/pretty v1.2.1/go.mod h1:ITEVvHYasfjBbM0u2Pg8T2nJnzm8xPwvNhhsoaGGjNU=
-github.com/urfave/cli/v3 v3.11.0 h1:P/euJp99kb9p0tlVY+iYTLYYTAQlfl0hR2gUO1Img1Q=
-github.com/urfave/cli/v3 v3.11.0/go.mod h1:ysVLtOEmg2tOy6PknnYVhDoouyC/6N42TMeoMzskhso=
+github.com/urfave/cli/v3 v3.13.0 h1:Dr6jqMfIyyFsRVn7Nz5mqLsMY+ZMpfh3a0aMs+umPVY=
+github.com/urfave/cli/v3 v3.13.0/go.mod h1:vXn6HxPNccJSzQr2QvwVncOKrgYGIHU0HY5h8B2nQj4=
 github.com/yuin/goldmark v1.4.13/go.mod h1:6yULJ656Px+3vBD8DxQVa3kxgyrAnzto9xy5taEt/CY=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
 go.uber.org/goleak v1.3.0/go.mod h1:CoHD4mav9JJNrW/WLlf7HGZPjdw8EucARQHekz1X6bE=
```

**File**: `resource/dns_test.go` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ func TestDNSEmptyAddrsWarns(t *testing.T) {
 	}
 
 	d := &DNS{id: "localhost", Resolvable: false, Addrs: []any{}}
-	out := captureStderr(t, func() { d.Validate(sys) })
+	out := captureStderr(t, func() { d.Validate(t.Context(), sys) })
 
 	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "dns.addrs") {
 		t.Errorf("Validate with empty 'addrs' field, stderr = %q, want a WARNING naming dns.addrs", out)
```

**File**: `resource/interface_test.go` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ func TestInterfaceEmptyAddrsWarns(t *testing.T) {
 	}
 
 	i := &Interface{id: "eth0", Exists: true, Addrs: []any{}}
-	out := captureStderr(t, func() { i.Validate(sys) })
+	out := captureStderr(t, func() { i.Validate(t.Context(), sys) })
 
 	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "interface.addrs") {
 		t.Errorf("Validate with empty 'addrs' field, stderr = %q, want a WARNING naming interface.addrs", out)
```

**File**: `resource/mount_test.go` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ func TestMountEmptyOptsWarns(t *testing.T) {
 	}
 
 	m := &Mount{id: "/", Exists: true, Opts: []any{}}
-	out := captureStderr(t, func() { m.Validate(sys) })
+	out := captureStderr(t, func() { m.Validate(t.Context(), sys) })
 
 	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "mount.opts") {
 		t.Errorf("Validate with empty 'opts' field, stderr = %q, want a WARNING naming mount.opts", out)
@@ -47,7 +47,7 @@ func TestMountEmptyVfsOptsWarns(t *testing.T) {
 	}
 
 	m := &Mount{id: "/", Exists: true, VfsOpts: []any{}}
-	out := captureStderr(t, func() { m.Validate(sys) })
+	out := captureStderr(t, func() { m.Validate(t.Context(), sys) })
 
 	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "mount.vfs-opts") {
 		t.Errorf("Validate with empty 'vfs-opts' field, stderr = %q, want a WARNING naming mount.vfs-opts", out)
```

**File**: `resource/port_test.go` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ func TestPortEmptyIPWarns(t *testing.T) {
 	}
 
 	p := &Port{id: "tcp:9999", Listening: false, IP: []any{}}
-	out := captureStderr(t, func() { p.Validate(sys) })
+	out := captureStderr(t, func() { p.Validate(t.Context(), sys) })
 
 	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "port.ip") {
 		t.Errorf("Validate with empty ip stderr = %q, want a WARNING naming port.ip", out)
```

**File**: `resource/user_test.go` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ func TestUserEmptyGroupsWarns(t *testing.T) {
 	}
 
 	u := &User{id: "nobody", Exists: true, Groups: []any{}}
-	out := captureStderr(t, func() { u.Validate(sys) })
+	out := captureStderr(t, func() { u.Validate(t.Context(), sys) })
 
 	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "user.groups") {
 		t.Errorf("Validate with empty groups stderr = %q, want a WARNING naming user.groups", out)
```

---

### Incident Patch 4: `177f7438` (2026-09-26)
**Commit Message**: build(deps): bump github/codeql-action from 4.38.0 to 4.38.1 (#1135)

Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/v4.38.0...v4.38.1)

---
updated-dependencies:
- dependency-name: github/codeql-action
  dependency-version: 4.38.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/docker-goss.yaml` (modified, +1/-1)
```diff
@@ -88,6 +88,6 @@ jobs:
           output: "trivy-results.sarif"
 
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@v4.38.0
+        uses: github/codeql-action/upload-sarif@v4.38.1
         with:
           sarif_file: "trivy-results.sarif"
```

**File**: `.github/workflows/trivy-schedule.yaml` (modified, +1/-1)
```diff
@@ -22,6 +22,6 @@ jobs:
           output: "trivy-results.sarif"
 
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@v4.38.0
+        uses: github/codeql-action/upload-sarif@v4.38.1
         with:
           sarif_file: "trivy-results.sarif"
```

---

### Incident Patch 5: `814534cd` (2026-09-26)
**Commit Message**: build(deps): bump alpine from 3.24.1 to 3.24.2 (#1134)

Bumps alpine from 3.24.1 to 3.24.2.

---
updated-dependencies:
- dependency-name: alpine
  dependency-version: 3.24.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM alpine:3.24.1
+FROM alpine:3.24.2
 
 ARG TARGETPLATFORM
 COPY $TARGETPLATFORM/goss /usr/bin/
```

**File**: `Dockerfile_trivy` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ RUN --mount=target=. \
     -o "/release/goss" \
     ./cmd/goss
 
-FROM alpine:3.24.1
+FROM alpine:3.24.2
 
 COPY --from=base /release/* /usr/bin/
 
```

---

### Incident Patch 6: `f7ebedc6` (2026-09-13)
**Commit Message**: fix(structured): return a failure exit code so serve reports 503 (#1131)

The structured outputer ended Output() with an unconditional return 0,
so a failing suite exited 0 and serve.go, which maps a non-zero code to
503, answered 200. A healthcheck on goss serve -f structured could never
fail. Summary.Failed was already counted a few lines above.

This is issue #992 for a second format: the same gap was reported for
prometheus and fixed in #1109, and structured was left behind. Because
it has now happened twice, the test pins the exit code of all nine
outputers and fails if a tenth is registered without a choice.

The prometheus outputer accumulates into package-level counters, so each
case resets them the way prometheus_test.go already does.

Co-authored-by: VXNCXNX <[REDACTED_EMAIL]>

**File**: `outputs/outputs_test.go` (modified, +58/-0)
```diff
@@ -1,9 +1,14 @@
 package outputs
 
 import (
+	"io"
 	"testing"
+	"time"
 
 	"github.com/stretchr/testify/assert"
+
+	"github.com/goss-org/goss/resource"
+	"github.com/goss-org/goss/util"
 )
 
 func TestIsValidFormat(t *testing.T) {
@@ -56,3 +61,56 @@ func TestOptionsRegistration(t *testing.T) {
 	assert.Contains(t, registeredOutputs, "structured")
 	assert.Contains(t, registeredOutputs, "tap")
 }
+
+// TestOutputExitCodes pins what every outputer returns, because serve turns a
+// non-zero code into a 503 at /healthz. Prometheus was missing this once (#992)
+// and structured was missing it too, so all of them are pinned at once rather
+// than one per incident.
+func TestOutputExitCodes(t *testing.T) {
+	now := time.Now()
+	pass := resource.TestResult{
+		Result: resource.SUCCESS, ResourceType: "File", ResourceId: "/tmp",
+		Property: "exists", StartTime: now, EndTime: now,
+	}
+	// a skip is not a failure, so it must not move the exit code on its own
+	skip := resource.TestResult{
+		Result: resource.SKIP, ResourceType: "File", ResourceId: "/skip",
+		Property: "exists", Skipped: true, StartTime: now, EndTime: now,
+	}
+	fail := resource.TestResult{
+		Result: resource.FAIL, ResourceType: "File", ResourceId: "/nope",
+		Property: "exists", StartTime: now, EndTime: now,
+	}
+
+	cases := map[string]struct {
+		outputer Outputer
+		failing  int
+	}{
+		"documentation": {Documentation{}, 1},
+		"json":          {Json{}, 1},
+		"junit":         {JUnit{}, 1},
+		"nagios":        {Nagios{}, 2},
+		"prometheus":    {Prometheus{}, 1},
+		"rspecish":      {Rspecish{}, 1},
+		"silent":        {Silent{}, 1},
+		"structured":    {Structured{}, 1},
+		"tap":           {Tap{}, 1},
+	}
+
+	// a new outputer has to make a deliberate choice here rather than default to 0
+	assert.Len(t, cases, len(Outputers()))
+
+	for name, tc := range cases {
+		t.Run(name, func(t *testing.T) {
+			// the prometheus outputer accumulates into package-level counters
+			defer resetMetrics()
+
+			assert.Equal(t, 0,
+				tc.outputer.Output(io.Discard, makeResults(pass, skip), util.OutputConfig{}),
+				"a suite with no failures must exit 0")
+			assert.Equal(t, tc.failing,
+				tc.outputer.Output(io.Discard, makeResults(pass, skip, fail), util.OutputConfig{}),
+				"a suite containing a failure must not exit 0")
+		})
+	}
+}
```

**File**: `outputs/structured.go` (modified, +4/-0)
```diff
@@ -97,5 +97,9 @@ func (r Structured) Output(w io.Writer, results <-chan []resource.TestResult, ou
 
 	fmt.Fprintln(w, string(j))
 
+	if result.Summary.Failed > 0 {
+		return 1
+	}
+
 	return 0
 }
```

---

### Incident Patch 7: `6cefa53a` (2026-09-13)
**Commit Message**: fix(matchers): report a syntax error for matcher groups with no sub-matchers (#1127)

Gomega's And() with zero matchers is vacuously true, so a group that
reduces to nothing was reported as a pass without ever looking at the
value:

    user:
      orca:
        groups:
          and: []          ok 3 - User: orca: groups: matches expectation

The same holds for contain-elements with an empty list and gjson with an
empty map. consist-of and or are left alone: an empty consist-of asserts
that the value is empty, and an empty or can never be satisfied, so
neither reports a false pass.

This follows the errEmptyMatcher treatment an empty matcher map already
gets from #1118.

**File**: `docs/gossfile.md` (modified, +23/-0)
```diff
@@ -847,6 +847,29 @@ Count: 1, Failed: 1, Skipped: 0
 
 Goss supports advanced matchers by converting YAML input to [gomega](https://onsi.github.io/gomega/) matchers.
 
+!!! warning "An empty matcher group is a syntax error"
+
+    A matcher group is a set of conditions that must all be satisfied. A group
+    holding no conditions asserts nothing and would report a pass without the
+    value ever being looked at, so goss rejects it:
+
+    ```yaml
+    and: []               # syntax error
+    contain-elements: []  # syntax error
+    gjson: {}             # syntax error
+    ```
+
+    Two others look similar and are still accepted, because neither can pass
+    without checking the value:
+
+    ```yaml
+    consist-of: []        # asserts the value is empty
+    or: []                # can never be satisfied
+    ```
+
+    This is a change in behaviour. A gossfile containing one of the first three
+    used to be reported as passing.
+
 #### String Matchers
 
 These will convert the system attribute to a string prior to matching.
```

**File**: `resource/gomega.go` (modified, +17/-0)
```diff
@@ -11,8 +11,16 @@ import (
 var (
 	errMissingRequiredAttribute = errors.New("Syntax Error: Missing required attribute")
 	errEmptyMatcher             = errors.New("Syntax Error: Invalid matcher configuration. An empty map asserts nothing, exactly one matcher is required")
+	errEmptyMatcherGroup        = errors.New("asserts nothing, at least one matcher is required")
 )
 
+// emptyMatcherGroupError reports a matcher that reduces to no sub-matchers at
+// all. Gomega treats that as vacuously true, so the test would be reported as
+// passing without ever looking at the value.
+func emptyMatcherGroupError(name string) error {
+	return fmt.Errorf("Syntax Error: Invalid '%s' argument. An empty value %w", name, errEmptyMatcherGroup)
+}
+
 func matcherToGomegaMatcher(matcher any) (matchers.GossMatcher, error) {
 	// Default matchers
 	switch x := matcher.(type) {
@@ -119,6 +127,9 @@ func matcherToGomegaMatcher(matcher any) (matchers.GossMatcher, error) {
 		if err != nil {
 			return nil, err
 		}
+		if len(subMatchers) == 0 {
+			return nil, emptyMatcherGroupError(matchType)
+		}
 		var interfaceSlice []any
 		for _, d := range subMatchers {
 			interfaceSlice = append(interfaceSlice, d)
@@ -145,6 +156,9 @@ func matcherToGomegaMatcher(matcher any) (matchers.GossMatcher, error) {
 		if err != nil {
 			return nil, err
 		}
+		if len(subMatchers) == 0 {
+			return nil, emptyMatcherGroupError(matchType)
+		}
 		return matchers.And(subMatchers...), nil
 	case "or":
 		subMatchers, err := sliceToGomega(value, "or")
@@ -196,6 +210,9 @@ func matcherToGomegaMatcher(matcher any) (matchers.GossMatcher, error) {
 		if !ok {
 			return nil, invalidArgSyntaxError("gjson", "map", value)
 		}
+		if len(valueI) == 0 {
+			return nil, emptyMatcherGroupError(matchType)
+		}
 		for key, val := range valueI {
 			subMatcher, err := matcherToGomegaMatcher(val)
 			if err != nil {
```

**File**: `resource/gomega_test.go` (modified, +42/-0)
```diff
@@ -188,3 +188,45 @@ func TestMatcherToGomegaMatcherEmptyMap(t *testing.T) {
 		})
 	}
 }
+
+// A matcher group with no sub-matchers is vacuously true in Gomega, so these
+// used to be reported as passing without ever looking at the value.
+func TestMatcherToGomegaMatcherEmptyGroup(t *testing.T) {
+	cases := []struct {
+		name string
+		in   string
+	}{
+		{name: "and", in: `{"and": []}`},
+		{name: "contain-elements", in: `{"contain-elements": []}`},
+		{name: "gjson", in: `{"gjson": {}}`},
+		{name: "nested in not", in: `{"not": {"and": []}}`},
+	}
+
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			var dat any
+			if err := json.Unmarshal([]byte(c.in), &dat); err != nil {
+				t.Fatal(err)
+			}
+
+			got, err := matcherToGomegaMatcher(dat)
+			assert.Nil(t, got)
+			assert.ErrorIs(t, err, errEmptyMatcherGroup)
+		})
+	}
+}
+
+// consist-of and or are meaningful when empty: the first asserts that the value
+// is empty, the second can never be satisfied. Neither reports a false pass.
+func TestMatcherToGomegaMatcherEmptyGroupExceptions(t *testing.T) {
+	for _, in := range []string{`{"consist-of": []}`, `{"or": []}`} {
+		var dat any
+		if err := json.Unmarshal([]byte(in), &dat); err != nil {
+			t.Fatal(err)
+		}
+
+		got, err := matcherToGomegaMatcher(dat)
+		assert.NoError(t, err, in)
+		assert.NotNil(t, got, in)
+	}
+}
```

---

### Incident Patch 8: `4898347e` (2026-09-13)
**Commit Message**: fix(validate): warn on the remaining empty list matchers (#1114)

Empty list matchers previously passed silently without assertion. Now emit
a warning to alert users to the potential test issue.

**File**: `docs/gossfile.md` (modified, +31/-0)
```diff
@@ -306,6 +306,12 @@ dns:
     timeout: 500 # in milliseconds
 ```
 
+!!! warning "An empty list asserts nothing"
+
+    As with [`stdout` and `stderr`](#command), `addrs: []` is a list of zero
+    conditions and always passes. `goss validate` warns on stderr about each
+    one.
+
 ### file
 
 Validates the state of a file, directory, socket, or symbolic link
@@ -442,6 +448,12 @@ interface:
     mtu: 1500
 ```
 
+!!! warning "An empty list asserts nothing"
+
+    As with [`stdout` and `stderr`](#command), `addrs: []` is a list of zero
+    conditions and always passes. `goss validate` warns on stderr about each
+    one.
+
 ### kernel-param
 
 Validates kernel param (sysctl) value.
@@ -485,6 +497,12 @@ mount:
       lt: 95
 ```
 
+!!! warning "An empty list asserts nothing"
+
+    As with [`stdout` and `stderr`](#command), `opts: []` and `vfs-opts: []`
+    are lists of zero conditions and always pass. `goss validate` warns on
+    stderr about each one.
+
 ### matching
 
 Validates specified content against a matcher. Best used with [Templates](#templates).
@@ -589,6 +607,13 @@ port:
     skip: false
 ```
 
+!!! warning "An empty list asserts nothing"
+
+    As with [`stdout` and `stderr`](#command), `ip: []` is a list of zero
+    conditions and always passes. `goss validate` warns on stderr about each
+    one. `goss add port` only writes `ip` when the port has addresses, so it
+    never generates an empty list.
+
 ### process
 
 Validates if a process is running.
@@ -652,6 +677,12 @@ user:
     skip: false
 ```
 
+!!! warning "An empty list asserts nothing"
+
+    As with [`stdout` and `stderr`](#command), `groups: []` is a list of zero
+    conditions and always passes. `goss validate` warns on stderr about each
+    one.
+
 !!! note
     This check is inspecting the contents of local passwd file `/etc/passwd`,
     this does not validate remote users (e.g. LDAP).
```

**File**: `resource/dns.go` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ func (d *DNS) Validate(sys *system.System) []TestResult {
 	if shouldSkip(results) {
 		skip = true
 	}
-	if d.Addrs != nil {
+	if isSetWarnEmpty(d.Addrs, fmt.Sprintf("%s: dns.addrs", d.ID())) {
 		if d.RetryCount > 0 {
 			results = append(results, ValidateValueWithRetry(d, "addrs", d.Addrs, func() (any, error) {
 				sysDNS := sys.NewDNS(ctx, d.GetResolve(), sys, util.Config{Timeout: time.Duration(d.Timeout) * time.Millisecond, Server: d.Server})
```

**File**: `resource/dns_test.go` (modified, +21/-2)
```diff
@@ -1,9 +1,11 @@
 package resource
 
 import (
+	"context"
 	"strings"
 	"testing"
 
+	"github.com/goss-org/goss/system"
 	"github.com/goss-org/goss/util"
 	"gopkg.in/yaml.v3"
 )
@@ -39,7 +41,7 @@ func TestNewDNSLeavesAddrsUnsetWhenEmpty(t *testing.T) {
 		t.Fatalf("yaml.Marshal returned error: %v", err)
 	}
 	if strings.Contains(string(out), "addrs:") {
-		t.Errorf("marshalled yaml contains an addrs key, want it omitted:\n%s", out)
+		t.Errorf("marshalled YAML contains an 'addrs' field, want it omitted:\n%s", out)
 	}
 }
 
@@ -55,6 +57,23 @@ func TestNewDNSKeepsAddrsWhenPresent(t *testing.T) {
 		t.Fatalf("yaml.Marshal returned error: %v", err)
 	}
 	if !strings.Contains(string(out), "127.0.0.1") {
-		t.Errorf("marshalled yaml is missing the addrs value:\n%s", out)
+		t.Errorf("marshalled YAML is missing the 'addrs' field:\n%s", out)
+	}
+}
+
+// dns.addrs used a plain != nil check, so `addrs: []` asserted nothing and
+// passed silently. It must now warn like file.contents does.
+func TestDNSEmptyAddrsWarns(t *testing.T) {
+	sys := &system.System{
+		NewDNS: func(context.Context, string, *system.System, util.Config) system.DNS {
+			return &fakeSysDNS{addrs: []string{"127.0.0.1"}}
+		},
+	}
+
+	d := &DNS{id: "localhost", Resolvable: false, Addrs: []any{}}
+	out := captureStderr(t, func() { d.Validate(sys) })
+
+	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "dns.addrs") {
+		t.Errorf("Validate with empty 'addrs' field, stderr = %q, want a WARNING naming dns.addrs", out)
 	}
 }
```

**File**: `resource/interface.go` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ func (i *Interface) Validate(sys *system.System) []TestResult {
 	if shouldSkip(results) {
 		skip = true
 	}
-	if i.Addrs != nil {
+	if isSetWarnEmpty(i.Addrs, fmt.Sprintf("%s: interface.addrs", i.ID())) {
 		results = append(results, ValidateValue(i, "addrs", i.Addrs, sysInterface.Addrs, skip))
 	}
 	if i.MTU != nil {
```

**File**: `resource/interface_test.go` (modified, +21/-2)
```diff
@@ -1,9 +1,11 @@
 package resource
 
 import (
+	"context"
 	"strings"
 	"testing"
 
+	"github.com/goss-org/goss/system"
 	"github.com/goss-org/goss/util"
 	"gopkg.in/yaml.v3"
 )
@@ -36,7 +38,7 @@ func TestNewInterfaceLeavesAddrsUnsetWhenEmpty(t *testing.T) {
 		t.Fatalf("yaml.Marshal returned error: %v", err)
 	}
 	if strings.Contains(string(out), "addrs:") {
-		t.Errorf("marshalled yaml contains an addrs key, want it omitted:\n%s", out)
+		t.Errorf("marshalled YAML contains an 'addrs' field, want it omitted:\n%s", out)
 	}
 }
 
@@ -52,6 +54,23 @@ func TestNewInterfaceKeepsAddrsWhenPresent(t *testing.T) {
 		t.Fatalf("yaml.Marshal returned error: %v", err)
 	}
 	if !strings.Contains(string(out), "10.0.0.1/24") {
-		t.Errorf("marshalled yaml is missing the addrs value:\n%s", out)
+		t.Errorf("marshalled YAML is missing the 'addrs' field:\n%s", out)
+	}
+}
+
+// interface.addrs used a plain != nil check, so `addrs: []` asserted nothing
+// and passed silently. It must now warn like file.contents does.
+func TestInterfaceEmptyAddrsWarns(t *testing.T) {
+	sys := &system.System{
+		NewInterface: func(context.Context, string, *system.System, util.Config) system.Interface {
+			return &fakeSysInterface{addrs: []string{"10.0.0.1/24"}}
+		},
+	}
+
+	i := &Interface{id: "eth0", Exists: true, Addrs: []any{}}
+	out := captureStderr(t, func() { i.Validate(sys) })
+
+	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "interface.addrs") {
+		t.Errorf("Validate with empty 'addrs' field, stderr = %q, want a WARNING naming interface.addrs", out)
 	}
 }
```

**File**: `resource/mount.go` (modified, +2/-2)
```diff
@@ -68,10 +68,10 @@ func (m *Mount) Validate(sys *system.System) []TestResult {
 	if shouldSkip(results) {
 		skip = true
 	}
-	if m.Opts != nil {
+	if isSetWarnEmpty(m.Opts, fmt.Sprintf("%s: mount.opts", m.ID())) {
 		results = append(results, ValidateValue(m, "opts", m.Opts, sysMount.Opts, skip))
 	}
-	if m.VfsOpts != nil {
+	if isSetWarnEmpty(m.VfsOpts, fmt.Sprintf("%s: mount.vfs-opts", m.ID())) {
 		results = append(results, ValidateValue(m, "vfs-opts", m.VfsOpts, sysMount.VfsOpts, skip))
 	}
 	if m.Source != nil {
```

**File**: `resource/mount_test.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package resource
+
+import (
+	"context"
+	"strings"
+	"testing"
+
+	"github.com/goss-org/goss/system"
+	"github.com/goss-org/goss/util"
+)
+
+// fakeSysMount is a minimal system.Mount so Validate can run without touching
+// the real mount table.
+type fakeSysMount struct{}
+
+func (f *fakeSysMount) MountPoint() string          { return "/" }
+func (f *fakeSysMount) Exists() (bool, error)       { return true, nil }
+func (f *fakeSysMount) Opts() ([]string, error)     { return []string{"rw"}, nil }
+func (f *fakeSysMount) VfsOpts() ([]string, error)  { return []string{"rw"}, nil }
+func (f *fakeSysMount) Source() (string, error)     { return "/dev/sda1", nil }
+func (f *fakeSysMount) Filesystem() (string, error) { return "ext4", nil }
+func (f *fakeSysMount) Usage() (int, error)         { return 10, nil }
+
+// mount.opts used a plain != nil check, so `opts: []` asserted nothing and
+// passed silently. It must now warn like file.contents does.
+func TestMountEmptyOptsWarns(t *testing.T) {
+	sys := &system.System{
+		NewMount: func(context.Context, string, *system.System, util.Config) system.Mount {
+			return &fakeSysMount{}
+		},
+	}
+
+	m := &Mount{id: "/", Exists: true, Opts: []any{}}
+	out := captureStderr(t, func() { m.Validate(sys) })
+
+	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "mount.opts") {
+		t.Errorf("Validate with empty 'opts' field, stderr = %q, want a WARNING naming mount.opts", out)
+	}
+}
+
+// mount.vfs-opts had the same plain != nil check as mount.opts.
+func TestMountEmptyVfsOptsWarns(t *testing.T) {
+	sys := &system.System{
+		NewMount: func(context.Context, string, *system.System, util.Config) system.Mount {
+			return &fakeSysMount{}
+		},
+	}
+
+	m := &Mount{id: "/", Exists: true, VfsOpts: []any{}}
+	out := captureStderr(t, func() { m.Validate(sys) })
+
+	if !strings.Contains(out, "WARNING:") || !strings.Contains(out, "mount.vfs-opts") {
+		t.Errorf("Validate with empty 'vfs-opts' field, stderr = %q, want a WARNING naming mount.vfs-opts", out)
+	}
+}
```

**File**: `resource/port.go` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ func (p *Port) Validate(sys *system.System) []TestResult {
 	if shouldSkip(results) {
 		skip = true
 	}
-	if p.IP != nil {
+	if isSetWarnEmpty(p.IP, fmt.Sprintf("%s: port.ip", p.ID())) {
 		results = append(results, ValidateValue(p, "ip", p.IP, sysPort.IP, skip))
 	}
 	return results
```

---

### Incident Patch 9: `5cff96a1` (2026-09-13)
**Commit Message**: build(deps): bump zensical from 0.0.58 to 0.0.60 in /docs (#1129)

Bumps [zensical](https://github.com/zensical/zensical) from 0.0.58 to 0.0.60.
- [Release notes](https://github.com/zensical/zensical/releases)
- [Commits](https://github.com/zensical/zensical/compare/v0.0.58...v0.0.60)

---
updated-dependencies:
- dependency-name: zensical
  dependency-version: 0.0.60
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `docs/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-zensical==0.0.58
+zensical==0.0.60
```

---

### Incident Patch 10: `a0abfee1` (2026-09-13)
**Commit Message**: build(deps): bump github/codeql-action from 4.37.9 to 4.38.0 (#1130)

Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.37.9 to 4.38.0.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/v4.37.9...v4.38.0)

---
updated-dependencies:
- dependency-name: github/codeql-action
  dependency-version: 4.38.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/docker-goss.yaml` (modified, +1/-1)
```diff
@@ -88,6 +88,6 @@ jobs:
           output: "trivy-results.sarif"
 
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@v4.37.9
+        uses: github/codeql-action/upload-sarif@v4.38.0
         with:
           sarif_file: "trivy-results.sarif"
```

**File**: `.github/workflows/trivy-schedule.yaml` (modified, +1/-1)
```diff
@@ -22,6 +22,6 @@ jobs:
           output: "trivy-results.sarif"
 
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@v4.37.9
+        uses: github/codeql-action/upload-sarif@v4.38.0
         with:
           sarif_file: "trivy-results.sarif"
```

---

### Incident Patch 11: `678fad7b` (2026-09-06)
**Commit Message**: build(deps): bump zensical from 0.0.57 to 0.0.58 in /docs (#1126)

Bumps [zensical](https://github.com/zensical/zensical) from 0.0.57 to 0.0.58.
- [Release notes](https://github.com/zensical/zensical/releases)
- [Commits](https://github.com/zensical/zensical/compare/v0.0.57...v0.0.58)

---
updated-dependencies:
- dependency-name: zensical
  dependency-version: 0.0.58
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `docs/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-zensical==0.0.57
+zensical==0.0.58
```

---

### Incident Patch 12: `f4523ad5` (2026-09-02)
**Commit Message**: fix(matchers): an empty map matcher panics instead of reporting a syntax error (#1118)

Co-authored-by: VXNCXNX <[REDACTED_EMAIL]>

**File**: `resource/gomega.go` (modified, +7/-1)
```diff
@@ -8,7 +8,10 @@ import (
 	"github.com/samber/lo"
 )
 
-var errMissingRequiredAttribute = errors.New("Syntax Error: Missing required attribute")
+var (
+	errMissingRequiredAttribute = errors.New("Syntax Error: Missing required attribute")
+	errEmptyMatcher             = errors.New("Syntax Error: Invalid matcher configuration. An empty map asserts nothing, exactly one matcher is required")
+)
 
 func matcherToGomegaMatcher(matcher any) (matchers.GossMatcher, error) {
 	// Default matchers
@@ -39,6 +42,9 @@ func matcherToGomegaMatcher(matcher any) (matchers.GossMatcher, error) {
 		//panic(fmt.Sprintf("Syntax Error: Unexpected matcher type: %T\n\n", matcher))
 	}
 	keys := lo.Keys(matcherMap)
+	if len(keys) == 0 {
+		return nil, errEmptyMatcher
+	}
 	if len(keys) > 1 {
 		return nil, fmt.Errorf("Syntax Error: Invalid matcher configuration. At a given nesting level, only one matcher is allowed. Found multiple matchers: %q", keys)
 	}
```

**File**: `resource/gomega_test.go` (modified, +26/-0)
```diff
@@ -162,3 +162,29 @@ func TestMatcherToGomegaMatcher(t *testing.T) {
 func gomegaTestEqual(t *testing.T, got, want any, useNegateTester bool, in string) {
 	assert.Equal(t, got, want)
 }
+
+// An empty matcher map used to panic with an index out of range instead of
+// being reported as a syntax error.
+func TestMatcherToGomegaMatcherEmptyMap(t *testing.T) {
+	cases := []struct {
+		name string
+		in   string
+	}{
+		{name: "top level", in: `{}`},
+		{name: "nested in and", in: `{"and": [{}]}`},
+		{name: "nested in not", in: `{"not": {}}`},
+	}
+
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			var dat any
+			if err := json.Unmarshal([]byte(c.in), &dat); err != nil {
+				t.Fatal(err)
+			}
+
+			got, err := matcherToGomegaMatcher(dat)
+			assert.Nil(t, got)
+			assert.ErrorIs(t, err, errEmptyMatcher)
+		})
+	}
+}
```

---

### Incident Patch 13: `ad2b9f53` (2026-09-02)
**Commit Message**: fix(http): stop a request-header without a space after the colon panicking (#1115)

**File**: `resource/file_test.go` (modified, +3/-4)
```diff
@@ -1,7 +1,6 @@
 package resource
 
 import (
-	"context"
 	"strings"
 	"testing"
 
@@ -11,10 +10,10 @@ import (
 	"gopkg.in/yaml.v3"
 )
 
-// NewFile used to set Contents to an empty list, so every generated gossfile
-// warned about asserting nothing. It must stay unset and marshal away.
+// Contents must stay unset and marshal away: an empty list asserts nothing, so
+// every generated gossfile would warn about it.
 func TestNewFileLeavesContentsUnset(t *testing.T) {
-	sysFile := system.NewDefFile(context.Background(), "/etc/hostname", nil, util.Config{})
+	sysFile := system.NewDefFile(t.Context(), "/etc/hostname", nil, util.Config{})
 	f, err := NewFile(sysFile, util.Config{})
 	if err != nil {
 		t.Fatal(err)
```

**File**: `system/http.go` (modified, +7/-2)
```diff
@@ -6,6 +6,7 @@ import (
 	"crypto/x509"
 	"fmt"
 	"io"
+	"log"
 	"net/http"
 	"net/url"
 	"os"
@@ -57,8 +58,12 @@ func NewDefHTTP(_ context.Context, httpStr string, system *System, config util.C
 	}
 
 	for _, r := range config.RequestHeader {
-		str := strings.SplitN(r, ": ", 2)
-		headers.Add(str[0], str[1])
+		name, value, found := strings.Cut(r, ":")
+		if !found {
+			log.Printf("[WARNING] ignoring malformed request header %q, expected \"Name: value\"", r)
+			continue
+		}
+		headers.Add(strings.TrimSpace(name), strings.TrimSpace(value))
 	}
 	return &DefHTTP{
 		http:              httpStr,
```

**File**: `system/http_test.go` (modified, +32/-0)
```diff
@@ -5,6 +5,8 @@ import (
 	"net/http"
 	"strings"
 	"testing"
+
+	"github.com/goss-org/goss/util"
 )
 
 type trackingReadCloser struct {
@@ -40,3 +42,33 @@ func TestDefHTTPCloseClosesBodyAfterBodyRead(t *testing.T) {
 		t.Fatal("Close() did not close the response body")
 	}
 }
+
+// TestNewDefHTTPRequestHeaderParsing pins that request-headers entries are
+// parsed on the first colon, so the HTTP wire form "Name:value" works, and
+// that an entry with no colon is skipped instead of panicking.
+func TestNewDefHTTPRequestHeaderParsing(t *testing.T) {
+	tests := []struct {
+		name   string
+		header string
+		want   string
+	}{
+		{"colon and space", "X-Foo: bar", "bar"},
+		{"colon no space", "X-Foo:bar", "bar"},
+		{"no colon", "X-Foo", ""},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			h := NewDefHTTP(t.Context(), "http://example.com", nil, util.Config{
+				RequestHeader: []string{tc.header},
+			})
+			def, ok := h.(*DefHTTP)
+			if !ok {
+				t.Fatalf("NewDefHTTP returned %T, want *DefHTTP", h)
+			}
+			if got := def.RequestHeader.Get("X-Foo"); got != tc.want {
+				t.Errorf("RequestHeader.Get(%q) = %q, want %q", "X-Foo", got, tc.want)
+			}
+		})
+	}
+}
```

---

### Incident Patch 14: `b08b4181` (2026-09-02)
**Commit Message**: fix: omit empty lists from generator output (#1113)

Co-authored-by: VXNCXNX <[REDACTED_EMAIL]>

**File**: `integration-tests/goss/alpine3/goss-expected.yaml` (modified, +0/-2)
```diff
@@ -33,10 +33,8 @@ port:
     - 0.0.0.0
   tcp:9999:
     listening: false
-    ip: []
   tcp6:80:
     listening: false
-    ip: []
 service:
   apache2:
     enabled: true
```

**File**: `integration-tests/goss/bullseye/goss-expected.yaml` (modified, +0/-2)
```diff
@@ -33,10 +33,8 @@ port:
     - 0.0.0.0
   tcp:9999:
     listening: false
-    ip: []
   tcp6:80:
     listening: false
-    ip: []
 service:
   apache2:
     enabled: true
```

**File**: `integration-tests/goss/jammy/goss-expected.yaml` (modified, +0/-2)
```diff
@@ -33,10 +33,8 @@ port:
     - 0.0.0.0
   tcp:9999:
     listening: false
-    ip: []
   tcp6:80:
     listening: false
-    ip: []
 service:
   apache2:
     enabled: true
```

**File**: `integration-tests/goss/rockylinux9/goss-expected.yaml` (modified, +0/-2)
```diff
@@ -33,10 +33,8 @@ port:
     - 0.0.0.0
   tcp:9999:
     listening: false
-    ip: []
   tcp6:80:
     listening: false
-    ip: []
 service:
   foobar:
     enabled: false
```

**File**: `resource/dns.go` (modified, +5/-2)
```diff
@@ -112,8 +112,11 @@ func NewDNS(sysDNS system.DNS, config util.Config) (*DNS, error) {
 		Server:     server,
 	}
 	if !contains(config.IgnoreList, "addrs") {
-		addrs, _ := sysDNS.Addrs()
-		d.Addrs = addrs
+		// An empty list asserts nothing, so leave Addrs unset and let omitempty
+		// drop it rather than generating `addrs: []`.
+		if addrs, _ := sysDNS.Addrs(); len(addrs) > 0 {
+			d.Addrs = addrs
+		}
 	}
 	return d, err
 }
```

**File**: `resource/dns_test.go` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+package resource
+
+import (
+	"strings"
+	"testing"
+
+	"github.com/goss-org/goss/util"
+	"gopkg.in/yaml.v3"
+)
+
+// fakeSysDNS is a minimal system.DNS implementation used to drive NewDNS
+// without doing a real lookup.
+type fakeSysDNS struct {
+	addrs []string
+}
+
+func (f *fakeSysDNS) Host() string              { return "no-such-host-xyz.invalid" }
+func (f *fakeSysDNS) Addrs() ([]string, error)  { return f.addrs, nil }
+func (f *fakeSysDNS) Resolvable() (bool, error) { return false, nil }
+func (f *fakeSysDNS) Exists() (bool, error)     { return false, nil }
+func (f *fakeSysDNS) Server() string            { return "" }
+func (f *fakeSysDNS) Qtype() string             { return "" }
+
+// TestNewDNSLeavesAddrsUnsetWhenEmpty pins the fix for `goss add dns` writing
+// `addrs: []` into generated gossfiles for an unresolvable host. An empty list
+// asserts nothing, so NewDNS must leave Addrs nil (matching the field's
+// yaml:"addrs,omitempty" tag) rather than assigning the empty slice.
+func TestNewDNSLeavesAddrsUnsetWhenEmpty(t *testing.T) {
+	d, err := NewDNS(&fakeSysDNS{addrs: nil}, util.Config{})
+	if err != nil {
+		t.Fatalf("NewDNS returned error: %v", err)
+	}
+	if d.Addrs != nil {
+		t.Errorf("NewDNS().Addrs = %#v, want nil", d.Addrs)
+	}
+
+	out, err := yaml.Marshal(d)
+	if err != nil {
+		t.Fatalf("yaml.Marshal returned error: %v", err)
+	}
+	if strings.Contains(string(out), "addrs:") {
+		t.Errorf("marshalled yaml contains an addrs key, want it omitted:\n%s", out)
+	}
+}
+
+// TestNewDNSKeepsAddrsWhenPresent makes sure the empty-list guard does not drop
+// real values.
+func TestNewDNSKeepsAddrsWhenPresent(t *testing.T) {
+	d, err := NewDNS(&fakeSysDNS{addrs: []string{"127.0.0.1"}}, util.Config{})
+	if err != nil {
+		t.Fatalf("NewDNS returned error: %v", err)
+	}
+	out, err := yaml.Marshal(d)
+	if err != nil {
+		t.Fatalf("yaml.Marshal returned error: %v", err)
+	}
+	if !strings.Contains(string(out), "127.0.0.1") {
+		t.Errorf("marshalled yaml is missing the addrs value:\n%s", out)
+	}
+}
```

**File**: `resource/interface.go` (modified, +3/-1)
```diff
@@ -76,7 +76,9 @@ func NewInterface(sysInterface system.Interface, config util.Config) (*Interface
 		Exists: exists,
 	}
 	if !contains(config.IgnoreList, "addrs") {
-		if addrs, err := sysInterface.Addrs(); err == nil {
+		// An empty list asserts nothing, so leave Addrs unset and let omitempty
+		// drop it rather than generating `addrs: []`.
+		if addrs, err := sysInterface.Addrs(); err == nil && len(addrs) > 0 {
 			i.Addrs = addrs
 		}
 	}
```

**File**: `resource/interface_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package resource
+
+import (
+	"strings"
+	"testing"
+
+	"github.com/goss-org/goss/util"
+	"gopkg.in/yaml.v3"
+)
+
+// fakeSysInterface is a minimal system.Interface implementation used to drive
+// NewInterface without touching real network interfaces.
+type fakeSysInterface struct {
+	addrs []string
+}
+
+func (f *fakeSysInterface) Name() string             { return "eth0" }
+func (f *fakeSysInterface) Exists() (bool, error)    { return true, nil }
+func (f *fakeSysInterface) Addrs() ([]string, error) { return f.addrs, nil }
+func (f *fakeSysInterface) MTU() (int, error)        { return 1500, nil }
+
+// TestNewInterfaceLeavesAddrsUnsetWhenEmpty pins the same empty-list problem as
+// the file and http generators: an interface with no assigned addresses must
+// not produce `addrs: []`, which asserts nothing.
+func TestNewInterfaceLeavesAddrsUnsetWhenEmpty(t *testing.T) {
+	i, err := NewInterface(&fakeSysInterface{addrs: nil}, util.Config{})
+	if err != nil {
+		t.Fatalf("NewInterface returned error: %v", err)
+	}
+	if i.Addrs != nil {
+		t.Errorf("NewInterface().Addrs = %#v, want nil", i.Addrs)
+	}
+
+	out, err := yaml.Marshal(i)
+	if err != nil {
+		t.Fatalf("yaml.Marshal returned error: %v", err)
+	}
+	if strings.Contains(string(out), "addrs:") {
+		t.Errorf("marshalled yaml contains an addrs key, want it omitted:\n%s", out)
+	}
+}
+
+// TestNewInterfaceKeepsAddrsWhenPresent makes sure the empty-list guard does
+// not drop real values.
+func TestNewInterfaceKeepsAddrsWhenPresent(t *testing.T) {
+	i, err := NewInterface(&fakeSysInterface{addrs: []string{"10.0.0.1/24"}}, util.Config{})
+	if err != nil {
+		t.Fatalf("NewInterface returned error: %v", err)
+	}
+	out, err := yaml.Marshal(i)
+	if err != nil {
+		t.Fatalf("yaml.Marshal returned error: %v", err)
+	}
+	if !strings.Contains(string(out), "10.0.0.1/24") {
+		t.Errorf("marshalled yaml is missing the addrs value:\n%s", out)
+	}
+}
```

---

### Incident Patch 15: `f9c5af2e` (2026-08-29)
**Commit Message**: build(deps): bump zensical from 0.0.56 to 0.0.57 in /docs (#1124)

Bumps [zensical](https://github.com/zensical/zensical) from 0.0.56 to 0.0.57.
- [Release notes](https://github.com/zensical/zensical/releases)
- [Commits](https://github.com/zensical/zensical/compare/v0.0.56...v0.0.57)

---
updated-dependencies:
- dependency-name: zensical
  dependency-version: 0.0.57
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `docs/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-zensical==0.0.56
+zensical==0.0.57
```

#### Recent Merged Pull Requests:
- **PR #1138** (2026-10-04): build(deps): bump github/codeql-action from 4.38.1 to 4.38.2 (@dependabot[bot])
- **PR #1137** (2026-10-04): build(deps): bump zensical from 0.0.64 to 0.0.67 in /docs (@dependabot[bot])
- **PR #1135** (2026-09-26): build(deps): bump github/codeql-action from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #1134** (2026-09-26): build(deps): bump alpine from 3.24.1 to 3.24.2 (@dependabot[bot])
- **PR #1133** (2026-09-26): build(deps): bump zensical from 0.0.62 to 0.0.64 in /docs (@dependabot[bot])
- **PR #1132** (closed): Fix missed places where the context wasn't passed (@kgaughan)
- **PR #1131** (2026-09-13): fix(structured): return a failure exit code so serve reports 503 (@VXNCXNX)
- **PR #1130** (2026-09-13): build(deps): bump github/codeql-action from 4.37.9 to 4.38.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
