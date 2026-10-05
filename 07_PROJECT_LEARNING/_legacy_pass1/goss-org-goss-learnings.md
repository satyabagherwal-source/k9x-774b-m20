# Forensic Learning Record (Deep Inspection): goss-org/goss

> **Canonical Artifact**: `07_PROJECT_LEARNING/goss-org-goss-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goss-org/goss](https://github.com/goss-org/goss))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:30.350Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goss-org/goss`
- **Description**: Quick and Easy server testing/validation
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5982 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
							return goss.AddResources(ctx, c.String("gossfile"), r
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

### Incident Patch 1: `f7ebedc6` (2026-09-13)
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

Co-authored-by: VXNCXNX <VXNCXNX@users.noreply.github.com>

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

### Incident Patch 2: `6cefa53a` (2026-09-13)
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

### Incident Patch 3: `4898347e` (2026-09-13)
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

---

### Incident Patch 4: `f4523ad5` (2026-09-02)
**Commit Message**: fix(matchers): an empty map matcher panics instead of reporting a syntax error (#1118)

Co-authored-by: VXNCXNX <vxncxnx@users.noreply.github.com>

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

### Incident Patch 5: `ad2b9f53` (2026-09-02)
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

### Incident Patch 6: `b08b4181` (2026-09-02)
**Commit Message**: fix: omit empty lists from generator output (#1113)

Co-authored-by: VXNCXNX <VXNCXNX@users.noreply.github.com>

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

---

### Incident Patch 7: `a79c8fbe` (2026-08-15)
**Commit Message**: fix(serve): dedupe concurrent validation runs on a cold cache (#1110)

Every request that arrived before the first result was cached ran its own
full validation, so N probes executed every check N times against the
machine. gossMu already existed on the handler but was never locked.

**File**: `serve.go` (modified, +6/-2)
```diff
@@ -104,8 +104,10 @@ func (h healthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
 func (h healthHandler) processAndEnsureCached(negotiatedContentType string, outputer outputs.Outputer) res {
 	var tra [][]resource.TestResult
 	cacheKey := "res"
-	tmp, found := h.cache.Get(cacheKey)
-	if found {
+	// Held across the lookup so a miss does not let a second request start its
+	// own validate() before the first one has filled the cache.
+	h.gossMu.Lock()
+	if tmp, found := h.cache.Get(cacheKey); found {
 		log.Printf("[TRACE] Returning cached[%s].", cacheKey)
 		tra = tmp.([][]resource.TestResult)
 	} else {
@@ -114,6 +116,8 @@ func (h healthHandler) processAndEnsureCached(negotiatedContentType string, outp
 		tra = h.validate()
 		h.cache.SetDefault(cacheKey, tra)
 	}
+	h.gossMu.Unlock()
+
 	trc := testResultArrayToChan(tra)
 	return h.output(trc, outputer)
 }
```

**File**: `serve_concurrency_test.go` (modified, +36/-0)
```diff
@@ -1,9 +1,12 @@
 package goss
 
 import (
+	"log"
 	"net/http"
 	"net/http/httptest"
+	"os"
 	"path/filepath"
+	"strings"
 	"sync"
 	"testing"
 
@@ -45,3 +48,36 @@ func TestServeHandlesConcurrentRequests(t *testing.T) {
 	}
 	wg.Wait()
 }
+
+// TestServeDeduplicatesConcurrentCacheMisses covers the cold window: when many
+// probes arrive before any result is cached, they must share one validation
+// run rather than each executing every check against the machine.
+func TestServeDeduplicatesConcurrentCacheMisses(t *testing.T) {
+	var logOutput syncBuffer
+	log.SetOutput(&logOutput)
+	t.Cleanup(func() { log.SetOutput(os.Stderr) })
+
+	config, err := util.NewConfig(
+		util.WithSpecFile(filepath.Join("testdata", "matching_basic.yaml")),
+		util.WithOutputFormat("json"),
+	)
+	require.NoError(t, err)
+
+	handler, err := newHealthHandler(config)
+	require.NoError(t, err)
+
+	const n = 16
+	var wg sync.WaitGroup
+	wg.Add(n)
+	for range n {
+		go func() {
+			defer wg.Done()
+			rr := httptest.NewRecorder()
+			handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/healthz", nil))
+		}()
+	}
+	wg.Wait()
+
+	runs := strings.Count(logOutput.String(), "running tests")
+	require.Equal(t, 1, runs, "%d concurrent requests caused %d validation runs, want 1", n, runs)
+}
```

---

### Incident Patch 8: `c4316432` (2026-08-15)
**Commit Message**: fix(add): stop the http generator emitting an empty body list (#1112)

Co-authored-by: VXNCXNX <VXNCXNX@users.noreply.github.com>

**File**: `integration-tests/goss/alpine3/goss-expected-q.yaml` (modified, +0/-3)
```diff
@@ -109,17 +109,14 @@ http:
     allow-insecure: false
     no-follow-redirects: true
     timeout: 5000
-    body: []
   https://www.apple.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
     proxy: http://127.0.0.1:8888
   https://www.google.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
```

**File**: `integration-tests/goss/alpine3/goss-expected.yaml` (modified, +0/-3)
```diff
@@ -153,17 +153,14 @@ http:
     allow-insecure: false
     no-follow-redirects: true
     timeout: 5000
-    body: []
   https://www.apple.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
     proxy: http://127.0.0.1:8888
   https://www.google.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
```

**File**: `integration-tests/goss/bullseye/goss-expected-q.yaml` (modified, +0/-3)
```diff
@@ -109,17 +109,14 @@ http:
     allow-insecure: false
     no-follow-redirects: true
     timeout: 5000
-    body: []
   https://www.apple.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
     proxy: http://127.0.0.1:8888
   https://www.google.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
```

**File**: `integration-tests/goss/bullseye/goss-expected.yaml` (modified, +0/-3)
```diff
@@ -159,17 +159,14 @@ http:
     allow-insecure: false
     no-follow-redirects: true
     timeout: 5000
-    body: []
   https://www.apple.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
     proxy: http://127.0.0.1:8888
   https://www.google.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
```

**File**: `integration-tests/goss/jammy/goss-expected-q.yaml` (modified, +0/-3)
```diff
@@ -109,17 +109,14 @@ http:
     allow-insecure: false
     no-follow-redirects: true
     timeout: 5000
-    body: []
   https://www.apple.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
     proxy: http://127.0.0.1:8888
   https://www.google.com:
     status: 200
     allow-insecure: false
     no-follow-redirects: false
     timeout: 5000
-    body: []
```

---

### Incident Patch 9: `ba1e2889` (2026-08-15)
**Commit Message**: fix(add): stop the file generator emitting an empty contents list (#1111)

goss add file wrote contents: [], so validating a generated gossfile made
goss warn about its own output. The tag was the only matcher field on File
without omitempty.

Co-authored-by: VXNCXNX <VXNCXNX@users.noreply.github.com>

**File**: `integration-tests/goss/alpine3/goss-expected-q.yaml` (modified, +0/-2)
```diff
@@ -1,10 +1,8 @@
 file:
   /etc/passwd:
     exists: true
-    contents: []
   /tmp/goss/foobar:
     exists: false
-    contents: []
 package:
   apache2:
     installed: true
```

**File**: `integration-tests/goss/alpine3/goss-expected.yaml` (modified, +0/-2)
```diff
@@ -5,10 +5,8 @@ file:
     owner: root
     group: root
     filetype: file
-    contents: []
   /tmp/goss/foobar:
     exists: false
-    contents: []
 package:
   apache2:
     installed: true
```

**File**: `integration-tests/goss/bullseye/goss-expected-q.yaml` (modified, +0/-2)
```diff
@@ -1,10 +1,8 @@
 file:
   /etc/passwd:
     exists: true
-    contents: []
   /tmp/goss/foobar:
     exists: false
-    contents: []
 package:
   apache2:
     installed: true
```

**File**: `integration-tests/goss/bullseye/goss-expected.yaml` (modified, +0/-2)
```diff
@@ -5,10 +5,8 @@ file:
     owner: root
     group: root
     filetype: file
-    contents: []
   /tmp/goss/foobar:
     exists: false
-    contents: []
 package:
   apache2:
     installed: true
```

**File**: `integration-tests/goss/jammy/goss-expected-q.yaml` (modified, +0/-2)
```diff
@@ -1,10 +1,8 @@
 file:
   /etc/passwd:
     exists: true
-    contents: []
   /tmp/goss/foobar:
     exists: false
-    contents: []
 package:
   apache2:
     installed: true
```

---

### Incident Patch 10: `b3093595` (2026-08-14)
**Commit Message**: fix(prometheus): return a failure exit code, and seed the run outcome once (#1109)

The prometheus outputer always returned 0, so serve -f prometheus never
answered 503 on /healthz and validate -f prometheus never failed a
pipeline. Every other format already does both.

Fixing only that would have made the 503 fire at random: the seed check
was 'i == 0', with i the index within a result group, and goss delivers
results as several groups in a nondeterministic order. Any group whose
first entry passed reset a previously recorded failure, so the same spec
reported pass or fail run to run. Seed once across all groups instead.

Closes #992

Co-authored-by: VXNCXNX <VXNCXNX@users.noreply.github.com>

**File**: `outputs/prometheus.go` (modified, +9/-2)
```diff
@@ -46,9 +46,10 @@ func (r Prometheus) Output(w io.Writer, results <-chan []resource.TestResult,
 	}
 
 	overallOutcome := resource.OutcomeUnknown
+	first := true
 	var startTime time.Time
 	for resultGroup := range results {
-		for i, tr := range resultGroup {
+		for _, tr := range resultGroup {
 			if startTime.IsZero() || tr.StartTime.Before(startTime) {
 				startTime = tr.StartTime
 			}
@@ -62,8 +63,11 @@ func (r Prometheus) Output(w io.Writer, results <-chan []resource.TestResult,
 				testOutcomes.WithLabelValues(resType, outcome).Inc()
 				testDurations.WithLabelValues(resType, outcome).Add(float64(tr.Duration.Milliseconds()))
 			}
-			if i == 0 || canChangeOverallOutcome(overallOutcome, outcome) {
+			// seed once across all groups, not once per group: results arrive
+			// in several groups in a nondeterministic order
+			if first || canChangeOverallOutcome(overallOutcome, outcome) {
 				overallOutcome = outcome
+				first = false
 			}
 		}
 	}
@@ -84,6 +88,9 @@ func (r Prometheus) Output(w io.Writer, results <-chan []resource.TestResult,
 		}
 	}
 
+	if overallOutcome == resource.OutcomeFail {
+		return 1
+	}
 	return 0
 }
 
```

**File**: `outputs/prometheus_test.go` (modified, +15/-4)
```diff
@@ -14,9 +14,10 @@ import (
 
 func TestPrometheusOutput(t *testing.T) {
 	testCases := map[string]struct {
-		results         []resource.TestResult
-		formatOptions   []string
-		expectedMetrics []string
+		results          []resource.TestResult
+		formatOptions    []string
+		expectedMetrics  []string
+		expectedExitCode int
 	}{
 		"all-success-single-type": {
 			results: []resource.TestResult{
@@ -77,6 +78,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"all-unknown-single-type": {
 			results: []resource.TestResult{
@@ -155,6 +157,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"various-results-multiple-types": {
 			results: []resource.TestResult{
@@ -191,6 +194,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"unknown-skip": {
 			results: []resource.TestResult{
@@ -235,6 +239,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"unknown-success": {
 			results: []resource.TestResult{
@@ -301,6 +306,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"skip-success": {
 			results: []resource.TestResult{
@@ -345,6 +351,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"fail-skip": {
 			results: []resource.TestResult{
@@ -367,6 +374,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"fail-success": {
 			results: []resource.TestResult{
@@ -389,6 +397,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"success-unknown": {
 			results: []resource.TestResult{
@@ -455,6 +464,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 		"no-results": {
 			results: []resource.TestResult{},
@@ -495,6 +505,7 @@ func TestPrometheusOutput(t *testing.T) {
 				`goss_tests_run_duration_milliseconds{outcome="fail"}`,
 				`goss_tests_run_outcomes_total{outcome="fail"} 1`,
 			},
+			expectedExitCode: 1,
 		},
 	}
 
@@ -509,7 +520,7 @@ func TestPrometheusOutput(t *testing.T) {
 			defer resetMetrics()
 
 			exitCode := outputer.Output(buf, makeResults(testCase.results...), config)
-			assert.Equal(t, 0, exitCode)
+			assert.Equal(t, testCase.expectedExitCode, exitCode)
 
 			output := buf.String()
 			t.Log(output)
```

#### Recent Merged Pull Requests:
- **PR #1135** (2026-09-26): build(deps): bump github/codeql-action from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #1134** (2026-09-26): build(deps): bump alpine from 3.24.1 to 3.24.2 (@dependabot[bot])
- **PR #1133** (2026-09-26): build(deps): bump zensical from 0.0.62 to 0.0.64 in /docs (@dependabot[bot])
- **PR #1132** (closed): Fix missed places where the context wasn't passed (@kgaughan)
- **PR #1131** (2026-09-13): fix(structured): return a failure exit code so serve reports 503 (@VXNCXNX)
- **PR #1130** (2026-09-13): build(deps): bump github/codeql-action from 4.37.9 to 4.38.0 (@dependabot[bot])
- **PR #1129** (2026-09-13): build(deps): bump zensical from 0.0.58 to 0.0.60 in /docs (@dependabot[bot])
- **PR #1127** (2026-09-13): fix(matchers): report a syntax error for matcher groups with no sub-matchers (@VXNCXNX)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
