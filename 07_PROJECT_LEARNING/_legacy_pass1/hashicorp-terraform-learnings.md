# Forensic Learning Record (Deep Inspection): hashicorp/terraform

> **Canonical Artifact**: `07_PROJECT_LEARNING/hashicorp-terraform-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hashicorp/terraform](https://github.com/hashicorp/terraform))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:21:26.028Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hashicorp/terraform`
- **Description**: Terraform enables you to safely and predictably create, change, and improve infrastructure. It is a source-available tool that codifies APIs into declarative configuration files that can be shared amongst team members, treated as code, edited, reviewed, and versioned.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 49796 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `checkpoint.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"
	"fmt"
	"log"
	"path/filepath"

	"github.com/hashicorp/go-checkpoint"
	"github.com/hashicorp/terraform/internal/command"
	"github.com/hashicorp/terraform/internal/command/cliconfig"
	"go.opentelemetry.io/otel/codes"
)

func init() {
	checkpointResult = make(chan *checkpoint.CheckResponse, 1)
}

var checkpointResult chan *checkpoint.CheckResponse

// runCheckpoint runs a HashiCorp Checkpoint request. You can read about
// Checkpoint here: https://github.com/hashicorp/go-checkpoint.
func runCheckpoint(ctx context.Context, c *cliconfig.Config) {
	// If the user doesn't want checkpoint at all, then return.
	if c.DisableCheckpoint {
		log.Printf("[INFO] Checkpoint disabled. Not running.")
		checkpointResult <- nil
		return
	}

	ctx, span := tracer.Start(ctx, "HashiCorp Checkpoint")
	_ = ctx // prevent staticcheck from complaining to avoid a maintenence hazard of having the wrong ctx in scope here
	defer span.End()

	configDir, err := cliconfig.ConfigDir()
	if err != nil {
		log.Printf("[ERR] Checkpoint setup error: %s", err)
		checkpointResult <- nil
		return
	}

	version := Version
	if VersionPrerelease != "" {
		version += fmt.Sprintf("-%s", VersionPrerelease)
	}

	signaturePath := filepath.Join(configDir, "checkpoint_signature")
	if c.DisableCheckpointSignature {
		log.Printf("[INFO] Checkpoint signature disabled")
		signaturePath = ""
	}

	resp, err := checkpoint.Check(&checkpoint.CheckParams{
		Product:       "terraform",
		Version:       version,
		SignatureFile: signaturePath,
		CacheFile:     filepath.Join(configDir, "checkpoint_cache"),
	})
	if err != nil {
		log.Printf("[ERR] Checkpoint error: %s", err)
		span.SetStatus(codes.Error, err.Error())
		resp = nil
	} else {
		span.SetStatus(codes.Ok, "checkpoint request succeeded")
	}

	checkpointResult <- resp
}

// commandVersionCheck implements command.VersionCheckFunc and is used
// as the version checker.
func commandVersionCheck() (command.VersionCheckInfo, error) {
	// Wait for the result to come through
	info := <-checkpointResult
	if info == nil {
		var zero command.VersionCheckInfo
		return zero, nil
	}

	// Build the alerts that we may have received about our version
	alerts := make([]string, len(info.Alerts))
	for i, a := range info.Alerts {
		alerts[i] = a.Message
	}

	return command.VersionCheckInfo{
		Outdated: info.Outdated,
		Latest:   info.CurrentVersion,
		Alerts:   alerts,
	}, nil
}

```

### Core Architecture Module: `commands.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"context"
	"os"
	"os/signal"

	"github.com/hashicorp/cli"
	"github.com/hashicorp/go-plugin"
	svchost "github.com/hashicorp/terraform-svchost"
	"github.com/hashicorp/terraform-svchost/auth"
	"github.com/hashicorp/terraform-svchost/disco"

	"github.com/hashicorp/terraform/internal/addrs"
	"github.com/hashicorp/terraform/internal/command"
	"github.com/hashicorp/terraform/internal/command/cliconfig"
	"github.com/hashicorp/terraform/internal/command/views"
	"github.com/hashicorp/terraform/internal/command/webbrowser"
	"github.com/hashicorp/terraform/internal/getproviders"
	pluginDiscovery "github.com/hashicorp/terraform/internal/plugin/discovery"
	"github.com/hashicorp/terraform/internal/rpcapi"
	"github.com/hashicorp/terraform/internal/terminal"
)

// runningInAutomationEnvName gives the name of an environment variable that
// can be set to any non-empty value in order to suppress certain messages
// that assume that Terraform is being run from a command prompt.
const runningInAutomationEnvName = "TF_IN_AUTOMATION"

// Commands is the mapping of all the available Terraform commands.
var Commands map[string]cli.CommandFactory

// PrimaryCommands is an ordered sequence of the top-level commands (not
// subcommands) that we emphasize at the top of our help output. This is
// ordered so that we can show them in the typical workflow order, rather
// than in alphabetical order. Anything not in this sequence or in the
// HiddenCommands set appears under "all other commands".
var PrimaryCommands []string

// HiddenCommands is a set of top-level commands (not subcommands) that are
// not advertised in the top-level help at all. This is typically because
// they are either just stubs that return an error message about something
// no longer being supported or backward-compatibility aliases for other
// commands.
//
// No commands in the PrimaryCommands sequence should also appear in the
// HiddenCommands set, because that would be rather silly.
var HiddenCommands map[string]struct{}

// Ui is the cli.Ui used for communicating to the outside world.
var Ui cli.Ui

func initCommands(
	ctx context.Context,
	originalWorkingDir string,
	streams *terminal.Streams,
	config *cliconfig.Config,
	services *disco.Disco,
	providerSrc getproviders.Source,
	providerDevOverrides map[addrs.Provider]getproviders.PackageLocalDir,
	unmanagedProviders map[addrs.Provider]*plugin.ReattachConfig,
) {
	var inAutomation bool
	if v := os.Getenv(runningInAutomationEnvName); v != "" {
		inAutomation = true
	}

	for userHost, hostConfig := range config.Hosts {
		host, err := svchost.ForComparison(userHost)
		if err != nil {
			// We expect the config was already validated by the time we get
			// here, so we'll just ignore invalid hostnames.
			continue
		}
		services.ForceHostServices(host, hostConfig.Services)
	}

	configDir, err := cliconfig.ConfigDir()
	if err != nil {
		configDir = "" // No config dir available (e.g. looking up a home directory failed)
	}

	wd := WorkingDir(originalWorkingDir, os.Getenv("TF_DATA_DIR"))

	meta := command.Meta{
		WorkingDir: wd,
		Streams:    streams,
		View:       views.NewView(streams).SetRunningInAutomation(inAutomation),

		Color:            true,
		GlobalPluginDirs: cliconfig.GlobalPluginDirs(),
		Ui:               Ui,

		Services:        services,
		BrowserLauncher: webbrowser.NewNativeLauncher(),

		RunningInAutomation: inAutomation,
		CLIConfigDir:        configDir,
		PluginCacheDir:      config.PluginCacheDir,

		PluginCacheMayBreakDependencyLockFile: config.PluginCacheMayBreakDependencyLockFile,

		ShutdownCh:    makeShutdownCh(),
		CallerContext: ctx,

		ProviderSource:       providerSrc,
		ProviderDevOverrides: providerDevOverrides,
		UnmanagedProviders:   unmanagedProviders,

		AllowExperimentalFeatures: ExperimentsAllowed(),
	}

	// The command list is included in the terraform -help
	// output, which is in turn included in the docs at
	// .../docs/cli/commands/index.mdx (in web-unified-docs); if you
	// add, remove or reclassify commands then consider updating
	// that to match.

	Commands = map[string]cli.CommandFactory{
		"apply": func() (cli.Command, error) {
			return &command.ApplyCommand{
				Meta: meta,
			}, nil
		},

		"console": func() (cli.Command, error) {
			return &command.ConsoleCommand{
				Meta: meta,
			}, nil
		},

		"destroy": func() (cli.Command, error) {
			return &command.ApplyCommand{
				Meta:    meta,
				Destroy: true,
			}, nil
		},

		"env": func() (cli.Command, error) {
			return &command.WorkspaceCommand{
				Meta:       meta,
				LegacyName: true,
			}, nil
		},

		"env list": func() (cli.Command, error) {
			return &command.WorkspaceListCommand{
				Meta:       meta,
				LegacyName: true,
			}, nil
		},

		"env select": func() (cli.Command, error) {
			return &command.WorkspaceSelectCommand{
				Meta:       meta,
				LegacyName: true,
			}, nil
		},

		"env new": func() (cli.Command, error) {
			return &command.WorkspaceNewCommand{
				Meta:       meta,
				LegacyName: true,
			}, nil
		},

		"env delete": func() (cli.Command, error) {
			return &command.WorkspaceDeleteCommand{
				Meta:       meta,
				LegacyName: true,
			}, nil
		},

		"fmt": func() (cli.Command, error) {
			return &command.FmtCommand{
				Meta: meta,
			}, nil
		},

		"get": func() (cli.Command, error) {
			return &command.GetCommand{
				Meta: meta,
			}, nil
		},

		"graph": func() (cli.Command, error) {
			return &command.GraphCommand{
				Meta: meta,
			}, nil
		},

		"import": func() (cli.Command, error) {
			return &command.ImportCommand{
				Meta: meta,
			}, nil
		},

		"init": func() (cli.Command, error) {
			return &command.InitCommand{
				Meta: meta,
			}, nil
		},

		"login": func() (cli.Command, error) {
			return &command.LoginCommand{
				Meta: meta,
			}, nil
		},

		"logout": func() (cli.Command, error) {
			return &command.LogoutCommand{
				Meta: meta,
			}, nil
		},

		"metadata": func() (cli.Command, error) {
			return &command.MetadataCommand{
				Meta: meta,
			}, nil
		},

		"metadata functions": func() (cli.Command, error) {
			return &command.MetadataFunctionsCommand{
				Meta: meta,
			}, nil
		},

		"modules": func() (cli.Command, error) {
			return &command.ModulesCommand{
				Meta: meta,
			}, nil
		},

		"output": func() (cli.Command, error) {
			return &command.OutputCommand{
				Meta: meta,
			}, nil
		},

		"plan": func() (cli.Command, error) {
			return &command.PlanCommand{
				Meta: meta,
			}, nil
		},

		"providers": func() (cli.Command, error) {
			return &command.ProvidersCommand{
				Meta: meta,
			}, nil
		},

		"providers lock": func() (cli.Command, error) {
			return &command.ProvidersLockCommand{
				Meta: meta,
			}, nil
		},

		"providers mirror": func() (cli.Command, error) {
			return &command.ProvidersMirrorCommand{
				Meta: meta,
			}, nil
		},

		"providers schema": func() (cli.Command, error) {
			return &command.ProvidersSchemaCommand{
				Meta: meta,
			}, nil
		},

		"push": func() (cli.Command, error) {
			return &command.PushCommand{
				Meta: meta,
			}, nil
		},

		"query": func() (cli.Command, error) {
			return &command.QueryCommand{
				Meta: meta,
			}, nil
		},

		"refresh": func() (cli.Command, error) {
			return &command.RefreshCommand{
				Meta: meta,
			}, nil
		},

		// "rpcapi" is handled a bit differently because the whole point of
		// this interface is to bypass the CLI layer so wrapping automation can
		// get as-direct-as-possible access to Terraform Core functionality,
		// without interference from behaviors that are intended for CLI
		// end-user convenience. We bypass the "command" package entirely
		// for this command in particular.
		"rpcapi": rpcapi.CLICommandFactory(rpcapi.CommandFactoryOpts{
			ExperimentsAllowed: meta.AllowExperimentalFeatures,
			ShutdownCh:         meta.ShutdownCh,
		}),

		"show": func() (cli.Command, error) {
			return &command.ShowCom
```

### Core Architecture Module: `experiments.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package main

// experimentsAllowed can be set to any non-empty string using Go linker
// arguments in order to enable the use of experimental features for a
// particular Terraform build:
//
//	go install -ldflags="-X 'main.experimentsAllowed=yes'"
//
// By default this variable is initialized as empty, in which case
// experimental features are not available.
//
// The Terraform release process should arrange for this variable to be
// set for alpha releases and development snapshots, but _not_ for
// betas, release candidates, or final releases.
//
// (NOTE: Some experimental features predate the rule that experiments
// are available only for alpha/dev builds, and so intentionally do not
// make use of this setting to avoid retracting a previously-documented
// open experiment.)
var experimentsAllowed string

func ExperimentsAllowed() bool {
	return experimentsAllowed != ""
}

```

### Core Architecture Module: `help.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package main

import (
	"bytes"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/hashicorp/cli"
)

// helpFunc is a cli.HelpFunc that can be used to output the help CLI instructions for Terraform.
func helpFunc(commands map[string]cli.CommandFactory) string {
	// Determine the maximum key length, and classify based on type
	var otherCommands []string
	maxKeyLen := 0

	for key := range commands {
		if _, ok := HiddenCommands[key]; ok {
			// We don't consider hidden commands when deciding the
			// maximum command length.
			continue
		}

		if len(key) > maxKeyLen {
			maxKeyLen = len(key)
		}

		isOther := true
		for _, candidate := range PrimaryCommands {
			if candidate == key {
				isOther = false
				break
			}
		}
		if isOther {
			otherCommands = append(otherCommands, key)
		}
	}
	sort.Strings(otherCommands)

	// The output produced by this is included in the docs at
	// .../docs/cli/commands/index.mdx (in web-unified-docs); if you
	// change this then consider updating that to match.
	helpText := fmt.Sprintf(`
Usage: terraform [global options] <subcommand> [args]

The available commands for execution are listed below.
The primary workflow commands are given first, followed by
less common or more advanced commands.

Main commands:
%s
All other commands:
%s
Global options (use these before the subcommand, if any):
  -chdir=DIR    Switch to a different working directory before executing the
                given subcommand.
  -help         Show this help output or the help for a specified subcommand.
  -version      An alias for the "version" subcommand.
`, listCommands(commands, PrimaryCommands, maxKeyLen), listCommands(commands, otherCommands, maxKeyLen))

	return strings.TrimSpace(helpText)
}

// listCommands just lists the commands in the map with the
// given maximum key length.
func listCommands(allCommands map[string]cli.CommandFactory, order []string, maxKeyLen int) string {
	var buf bytes.Buffer

	for _, key := range order {
		commandFunc, ok := allCommands[key]
		if !ok {
			// This suggests an inconsistency in the command table definitions
			// in commands.go .
			panic("command not found: " + key)
		}

		command, err := commandFunc()
		if err != nil {
			// This would be really weird since there's no good reason for
			// any of our command factories to fail.
			log.Printf("[ERR] cli: Command '%s' failed to load: %s",
				key, err)
			continue
		}

		key = fmt.Sprintf("%s%s", key, strings.Repeat(" ", maxKeyLen-len(key)))
		buf.WriteString(fmt.Sprintf("  %s  %s\n", key, command.Synopsis()))
	}

	return buf.String()
}

```

### Core Architecture Module: `internal/addrs/action.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package addrs

import (
	"fmt"
	"strings"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsyntax"

	"github.com/hashicorp/terraform/internal/tfdiags"
)

// Action is an address for an action block within configuration, which
// contains potentially-multiple action instances if that configuration
// block uses "count" or "for_each".
type Action struct {
	referenceable
	Type string
	Name string
}

func (a Action) String() string {
	return fmt.Sprintf("action.%s.%s", a.Type, a.Name)
}

func (a Action) Equal(o Action) bool {
	return a.Name == o.Name && a.Type == o.Type
}

func (a Action) Less(o Action) bool {
	switch {
	case a.Type != o.Type:
		return a.Type < o.Type

	case a.Name != o.Name:
		return a.Name < o.Name

	default:
		return false
	}
}

func (a Action) UniqueKey() UniqueKey {
	return a // An Action is its own UniqueKey
}

func (a Action) uniqueKeySigil() {}

// Instance produces the address for a specific instance of the receiver
// that is identified by the given key.
func (a Action) Instance(key InstanceKey) ActionInstance {
	return ActionInstance{
		Action: a,
		Key:    key,
	}
}

// Absolute returns an AbsAction from the receiver and the given module
// instance address.
func (a Action) Absolute(module ModuleInstance) AbsAction {
	return AbsAction{
		Module: module,
		Action: a,
	}
}

// InModule returns a ConfigAction from the receiver and the given module
// address.
func (a Action) InModule(module Module) ConfigAction {
	return ConfigAction{
		Module: module,
		Action: a,
	}
}

// ImpliedProvider returns the implied provider type name, for e.g. the "aws" in
// "aws_instance"
func (a Action) ImpliedProvider() string {
	typeName := a.Type
	if under := strings.Index(typeName, "_"); under != -1 {
		typeName = typeName[:under]
	}

	return typeName
}

// ActionInstance is an address for a specific instance of an action.
// When an action is defined in configuration with "count" or "for_each" it
// produces zero or more instances, which can be addressed using this type.
type ActionInstance struct {
	referenceable
	Action Action
	Key    InstanceKey
}

func (a ActionInstance) ContainingAction() Action {
	return a.Action
}

func (a ActionInstance) String() string {
	if a.Key == NoKey {
		return a.Action.String()
	}
	return a.Action.String() + a.Key.String()
}

func (a ActionInstance) Equal(o ActionInstance) bool {
	return a.Key == o.Key && a.Action.Equal(o.Action)
}

func (a ActionInstance) Less(o ActionInstance) bool {
	if !a.Action.Equal(o.Action) {
		return a.Action.Less(o.Action)
	}

	if a.Key != o.Key {
		return InstanceKeyLess(a.Key, o.Key)
	}

	return false
}

func (a ActionInstance) UniqueKey() UniqueKey {
	return a // An ActionInstance is its own UniqueKey
}

func (a ActionInstance) uniqueKeySigil() {}

// Absolute returns an AbsActionInstance from the receiver and the given module
// instance address.
func (a ActionInstance) Absolute(module ModuleInstance) AbsActionInstance {
	return AbsActionInstance{
		Module: module,
		Action: a,
	}
}

// AbsAction is an absolute address for an action under a given module path.
type AbsAction struct {
	targetable
	Module ModuleInstance
	Action Action
}

// Action returns the address of a particular action within the receiver.
func (m ModuleInstance) Action(typeName string, name string) AbsAction {
	return AbsAction{
		Module: m,
		Action: Action{
			Type: typeName,
			Name: name,
		},
	}
}

// Instance produces the address for a specific instance of the receiver that is
// identified by the given key.
func (a AbsAction) Instance(key InstanceKey) AbsActionInstance {
	return AbsActionInstance{
		Module: a.Module,
		Action: a.Action.Instance(key),
	}
}

// ConfigAction returns the unexpanded ConfigAction for this AbsAction.
func (a AbsAction) ConfigAction() ConfigAction {
	return ConfigAction{
		Module: a.Module.Module(),
		Action: a.Action,
	}
}

// TargetContains implements Targetable
func (a AbsAction) TargetContains(other Targetable) bool {
	switch to := other.(type) {
	case AbsAction:
		return a.Equal(to)
	case AbsActionInstance:
		return a.Equal(to.ContainingAction())
	case ConfigAction:
		return a.ConfigAction().Equal(to)
	default:
		return false
	}
}

// AddrType implements Targetable
func (a AbsAction) AddrType() TargetableAddrType {
	return ActionAddrType
}

func (a AbsAction) String() string {
	if len(a.Module) == 0 {
		return a.Action.String()
	}
	return fmt.Sprintf("%s.%s", a.Module.String(), a.Action.String())
}

func (a AbsAction) Equal(o AbsAction) bool {
	return a.Module.Equal(o.Module) && a.Action.Equal(o.Action)
}

func (a AbsAction) Less(o AbsAction) bool {
	if !a.Module.Equal(o.Module) {
		return a.Module.Less(o.Module)
	}

	if !a.Action.Equal(o.Action) {
		return a.Action.Less(o.Action)
	}

	return false
}

type absActionKey string

func (a absActionKey) uniqueKeySigil() {}

func (a AbsAction) UniqueKey() UniqueKey {
	return absActionKey(a.String())
}

// AbsActionInstance is an absolute address for an action instance under a
// given module path.
type AbsActionInstance struct {
	targetable
	Module ModuleInstance
	Action ActionInstance
}

// ActionInstance returns the address of a particular action instance within the receiver.
func (m ModuleInstance) ActionInstance(typeName string, name string, key InstanceKey) AbsActionInstance {
	return AbsActionInstance{
		Module: m,
		Action: ActionInstance{
			Action: Action{
				Type: typeName,
				Name: name,
			},
			Key: key,
		},
	}
}

// ContainingAction returns the address of the action that contains the
// receiving action instance. In other words, it discards the key portion of the
// address to produce an AbsAction value.
func (a AbsActionInstance) ContainingAction() AbsAction {
	return AbsAction{
		Module: a.Module,
		Action: a.Action.ContainingAction(),
	}
}

// ConfigAction returns the address of the configuration block that declared
// this instance.
func (a AbsActionInstance) ConfigAction() ConfigAction {
	return ConfigAction{
		Module: a.Module.Module(),
		Action: a.Action.Action,
	}
}

func (a AbsActionInstance) String() string {
	if len(a.Module) == 0 {
		return a.Action.String()
	}
	return fmt.Sprintf("%s.%s", a.Module.String(), a.Action.String())
}

// TargetContains implements Targetable
func (a AbsActionInstance) TargetContains(other Targetable) bool {
	switch to := other.(type) {
	case AbsAction:
		return to.Equal(a.ContainingAction()) && a.Action.Key == NoKey
	case AbsActionInstance:
		return to.Equal(a)
	case ConfigAction:
		return a.ConfigAction().Equal(to)
	default:
		return false
	}
}

// AddrType implements Targetable
func (a AbsActionInstance) AddrType() TargetableAddrType {
	return ActionInstanceAddrType
}

func (a AbsActionInstance) Equal(o AbsActionInstance) bool {
	return a.Module.Equal(o.Module) && a.Action.Equal(o.Action)
}

// Less returns true if the receiver should sort before the given other value
// in a sorted list of addresses.
func (a AbsActionInstance) Less(o AbsActionInstance) bool {
	if !a.Module.Equal(o.Module) {
		return a.Module.Less(o.Module)
	}

	if !a.Action.Equal(o.Action) {
		return a.Action.Less(o.Action)
	}

	return false
}

type absActionInstanceKey string

func (a AbsActionInstance) UniqueKey() UniqueKey {
	return absActionInstanceKey(a.String())
}

func (a absActionInstanceKey) uniqueKeySigil() {}

// ConfigAction is the address for an action within the configuration.
type ConfigAction struct {
	targetable
	Module Module
	Action Action
}

// Action returns the address of a particular action within the module.
func (m Module) Action(typeName string, name string) ConfigAction {
	return ConfigAction{
		Module: m,
		Action: Action{
			Type: typeName,
			Name: name,
		},
	}
}

// Absolute produces the address for the receiver within a specific module instance.
func (a ConfigAction) Absolute(module ModuleInstance) AbsAction {
	return AbsAction{
		Module: module,
		Action: a.Action,
	}
}

// AddrType 
```

### Core Architecture Module: `internal/addrs/check.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package addrs

import "fmt"

// Check is the address of a check block within a module.
//
// For now, checks do not support meta arguments such as "count" or "for_each"
// so this address uniquely describes a single check within a module.
type Check struct {
	referenceable
	Name string
}

func (c Check) String() string {
	return fmt.Sprintf("check.%s", c.Name)
}

// InModule returns a ConfigCheck from the receiver and the given module
// address.
func (c Check) InModule(modAddr Module) ConfigCheck {
	return ConfigCheck{
		Module: modAddr,
		Check:  c,
	}
}

// Absolute returns an AbsCheck from the receiver and the given module instance
// address.
func (c Check) Absolute(modAddr ModuleInstance) AbsCheck {
	return AbsCheck{
		Module: modAddr,
		Check:  c,
	}
}

func (c Check) Equal(o Check) bool {
	return c.Name == o.Name
}

func (c Check) UniqueKey() UniqueKey {
	return c // A Check is its own UniqueKey
}

func (c Check) uniqueKeySigil() {}

// ConfigCheck is an address for a check block within a configuration.
//
// This contains a Check address and a Module address, meaning this describes
// a check block within the entire configuration.
type ConfigCheck struct {
	Module Module
	Check  Check
}

var _ ConfigCheckable = ConfigCheck{}

func (c ConfigCheck) UniqueKey() UniqueKey {
	return configCheckUniqueKey(c.String())
}

func (c ConfigCheck) configCheckableSigil() {}

func (c ConfigCheck) CheckableKind() CheckableKind {
	return CheckableCheck
}

func (c ConfigCheck) String() string {
	if len(c.Module) == 0 {
		return c.Check.String()
	}
	return fmt.Sprintf("%s.%s", c.Module, c.Check)
}

// AbsCheck is an absolute address for a check block under a given module path.
//
// This contains an actual ModuleInstance address (compared to the Module within
// a ConfigCheck), meaning this uniquely describes a check block within the
// entire configuration after any "count" or "foreach" meta arguments have been
// evaluated on the containing module.
type AbsCheck struct {
	Module ModuleInstance
	Check  Check
}

var _ Checkable = AbsCheck{}

func (c AbsCheck) UniqueKey() UniqueKey {
	return absCheckUniqueKey(c.String())
}

func (c AbsCheck) checkableSigil() {}

// CheckRule returns an address for a given rule type within the check block.
//
// There will be at most one CheckDataResource rule within a check block (with
// an index of 0). There will be at least one, but potentially many,
// CheckAssertion rules within a check block.
func (c AbsCheck) CheckRule(typ CheckRuleType, i int) CheckRule {
	return CheckRule{
		Container: c,
		Type:      typ,
		Index:     i,
	}
}

// ModuleInstance returns the module instance portion of the address.
func (c AbsCheck) ModuleInstance() ModuleInstance {
	return c.Module
}

// ConfigCheckable returns the ConfigCheck address for this absolute reference.
func (c AbsCheck) ConfigCheckable() ConfigCheckable {
	return ConfigCheck{
		Module: c.Module.Module(),
		Check:  c.Check,
	}
}

func (c AbsCheck) CheckableKind() CheckableKind {
	return CheckableCheck
}

func (c AbsCheck) String() string {
	if len(c.Module) == 0 {
		return c.Check.String()
	}
	return fmt.Sprintf("%s.%s", c.Module, c.Check)
}

type configCheckUniqueKey string

func (k configCheckUniqueKey) uniqueKeySigil() {}

type absCheckUniqueKey string

func (k absCheckUniqueKey) uniqueKeySigil() {}

```

### Core Architecture Module: `internal/addrs/check_rule.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package addrs

import (
	"fmt"
)

// CheckRule is the address of a check rule within a checkable object.
//
// This represents the check rule globally within a configuration, and is used
// during graph evaluation to identify a condition result object to update with
// the result of check rule evaluation.
//
// The check address is not distinct from resource traversals, and check rule
// values are not intended to be available to the language, so the address is
// not Referenceable.
//
// Note also that the check address is only relevant within the scope of a run,
// as reordering check blocks between runs will result in their addresses
// changing. CheckRule is therefore for internal use only and should not be
// exposed in durable artifacts such as state snapshots.
type CheckRule struct {
	Container Checkable
	Type      CheckRuleType
	Index     int
}

func NewCheckRule(container Checkable, typ CheckRuleType, index int) CheckRule {
	return CheckRule{
		Container: container,
		Type:      typ,
		Index:     index,
	}
}

func (c CheckRule) String() string {
	container := c.Container.String()
	switch c.Type {
	case ResourcePrecondition:
		return fmt.Sprintf("%s.precondition[%d]", container, c.Index)
	case ResourcePostcondition:
		return fmt.Sprintf("%s.postcondition[%d]", container, c.Index)
	case OutputPrecondition:
		return fmt.Sprintf("%s.precondition[%d]", container, c.Index)
	case CheckDataResource:
		return fmt.Sprintf("%s.data[%d]", container, c.Index)
	case CheckAssertion:
		return fmt.Sprintf("%s.assert[%d]", container, c.Index)
	case InputValidation:
		return fmt.Sprintf("%s.validation[%d]", container, c.Index)
	default:
		// This should not happen
		return fmt.Sprintf("%s.condition[%d]", container, c.Index)
	}
}

func (c CheckRule) UniqueKey() UniqueKey {
	return checkRuleKey{
		ContainerKey: c.Container.UniqueKey(),
		Type:         c.Type,
		Index:        c.Index,
	}
}

type checkRuleKey struct {
	ContainerKey UniqueKey
	Type         CheckRuleType
	Index        int
}

func (k checkRuleKey) uniqueKeySigil() {}

// CheckRuleType describes a category of check. We use this only to establish
// uniqueness for Check values, and do not expose this concept of "check types"
// (which is subject to change in future) in any durable artifacts such as
// state snapshots.
//
// (See [CheckableKind] for an enumeration that we _do_ use externally, to
// describe the type of object being checked rather than the type of the check
// itself.)
type CheckRuleType int

//go:generate go tool golang.org/x/tools/cmd/stringer -type=CheckRuleType check_rule.go

const (
	InvalidCondition      CheckRuleType = 0
	ResourcePrecondition  CheckRuleType = 1
	ResourcePostcondition CheckRuleType = 2
	OutputPrecondition    CheckRuleType = 3
	CheckDataResource     CheckRuleType = 4
	CheckAssertion        CheckRuleType = 5
	InputValidation       CheckRuleType = 6
)

// Description returns a human-readable description of the check type. This is
// presented in the user interface through a diagnostic summary.
func (c CheckRuleType) Description() string {
	switch c {
	case ResourcePrecondition:
		return "Resource precondition"
	case ResourcePostcondition:
		return "Resource postcondition"
	case OutputPrecondition:
		return "Module output value precondition"
	case CheckDataResource:
		return "Check block data resource"
	case CheckAssertion:
		return "Check block assertion"
	case InputValidation:
		return "Input variable validation"
	default:
		// This should not happen
		return "Condition"
	}
}

// ModuleInstance returns the module instance address containing this check rule.
func (c CheckRule) ModuleInstance() ModuleInstance {
	return c.Container.ModuleInstance()
}

```

### Core Architecture Module: `internal/addrs/check_rule_diagnostic.go`
```
// Copyright IBM Corp. 2014, 2026
// SPDX-License-Identifier: BUSL-1.1

package addrs

import "github.com/hashicorp/terraform/internal/tfdiags"

// DiagnosticExtraCheckRule provides an interface for diagnostic ExtraInfo to
// retrieve an embedded CheckRule from within a tfdiags.Diagnostic.
type DiagnosticExtraCheckRule interface {
	// DiagnosticOriginatesFromCheckRule returns the CheckRule that the
	// surrounding diagnostic originated from.
	DiagnosticOriginatesFromCheckRule() CheckRule
}

// DiagnosticOriginatesFromCheckRule checks if the provided diagnostic contains
// a CheckRule as ExtraInfo and returns that CheckRule and true if it does. This
// function returns an empty CheckRule and false if the diagnostic does not
// contain a CheckRule.
func DiagnosticOriginatesFromCheckRule(diag tfdiags.Diagnostic) (CheckRule, bool) {
	maybe := tfdiags.ExtraInfo[DiagnosticExtraCheckRule](diag)
	if maybe == nil {
		return CheckRule{}, false
	}
	return maybe.DiagnosticOriginatesFromCheckRule(), true
}

// CheckRuleDiagnosticExtra is an object that can be attached to diagnostics
// that originate from check rules.
//
// It implements the DiagnosticExtraCheckRule interface for retrieving the
// concrete CheckRule that spawned the diagnostic.
//
// It also implements the tfdiags.DiagnosticExtraDoNotConsolidate interface, to
// stop diagnostics created by check blocks being consolidated.
//
// It also implements the tfdiags.DiagnosticExtraUnwrapper interface, as nested
// data blocks will attach this struct but do want to lose any extra info
// embedded in the original diagnostic.
type CheckRuleDiagnosticExtra struct {
	CheckRule CheckRule

	wrapped interface{}
}

var (
	_ DiagnosticExtraCheckRule                = (*CheckRuleDiagnosticExtra)(nil)
	_ tfdiags.DiagnosticExtraDoNotConsolidate = (*CheckRuleDiagnosticExtra)(nil)
	_ tfdiags.DiagnosticExtraUnwrapper        = (*CheckRuleDiagnosticExtra)(nil)
	_ tfdiags.DiagnosticExtraWrapper          = (*CheckRuleDiagnosticExtra)(nil)
)

func (c *CheckRuleDiagnosticExtra) UnwrapDiagnosticExtra() interface{} {
	return c.wrapped
}

func (c *CheckRuleDiagnosticExtra) WrapDiagnosticExtra(inner interface{}) {
	if c.wrapped != nil {
		// This is a logical inconsistency, the caller should know whether they
		// have already wrapped an extra or not.
		panic("Attempted to wrap a diagnostic extra into a CheckRuleDiagnosticExtra that is already wrapping a different extra. This is a bug in Terraform, please report it.")
	}
	c.wrapped = inner
}

func (c *CheckRuleDiagnosticExtra) DoNotConsolidateDiagnostic() bool {
	// Do not consolidate warnings from check blocks.
	return c.CheckRule.Container.CheckableKind() == CheckableCheck
}

func (c *CheckRuleDiagnosticExtra) DiagnosticOriginatesFromCheckRule() CheckRule {
	return c.CheckRule
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39302** (2026-09-28): **Terraform crashing when insufficient resources in the pool of vcenter to poweron vm**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.16.4 on windows_amd64 + provider registry.terraform.io/vmware/vsphere v2.17.1 ```  ### Terraform Configuration Files  ```terraform ...terraform config... ```   ### Debug Output  !!!!!!!!!!!!!!!!!!!!!!!!!!! TERRAFORM CRASH !!!!!!!!!!!!!!!!!!!!!!!!!!!!  Terraform crashed! This is always indicative of a bug within Terraform. Please report the crash with Terraform[1] so that we can fix this.  When reporting bugs, please include your terraform version, the stack trace shown below, and any additional information which may help replicate the issue.  [1]: https://github.com/hashicorp/terraform/issues  !!!!!!!!!!!!!!!!!!!!!!!!!!! TERRAFORM CRASH !!!!!!!!!!!!!!!!!!!!!!!!!!!!  panic: 3 problems:  - Failed to serialize resource instance in state: Instance vsphere_virtual_machine.vm["anonvm-46.anon.an.anonym.com"] has status ObjectStatus(0), which cannot be saved in state. - Failed to serialize resource instance in state: Instance vsphere_virtual_machine.vm["anonvm-23.anon.an.anonym.com"] has status ObjectStatus(0), which cannot be saved in state. - Failed to serialize resource instance in state: Instance vsphere_virtual_machine.vm["anonvm-42.anon.an.anonym.com"] has status ObjectStatus(0), which cannot be saved in state. goroutine 563 [running]: runtime/debug.Stack()         runtime/debug/stack.go:26 +0x5e github.com/hashicorp/terraform/internal/logging.PanicHandler()         github.com/hashicorp/terraform/internal/logging/panic.go:84 +0x18a p
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! This will be fixed in the upcoming v1.16.5 release this week

- **Issue #39285** (2026-09-25): **Identity is nil in DELETE during requires-replace**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.16.4 on windows_amd64 ```  ### Terraform Configuration Files  create: ```terraform resource "example_thing" "test" {   group = "a" } ``` update: ```terraform resource "example_thing" "test" {   group = "b" } ```  ### Debug Output  I think an example makes more sense here, as it can easily be reproduced https://gist.github.com/Kirdock/1a2467904a95aa4e0db59381cdbcd7aa   ### Expected Behavior  The identity exists and can be used in DELETE during requires-replace  ### Actual Behavior  The identity is nil in DELETE during requires-replace  ### Steps to Reproduce  1. Create a resource that has a field for requires replace (terraform init, apply) 2. Update a field that triggers the requires-replace (terraform apply) and try to access the identity within DELETE  ### Additional Context  _No response_  ### References  _No response_  ### Generative AI / LLM assisted development?  Used Claude code with Opus 4.8 to write a test file and mock client for the bug we found. First investigation: it pointed out that the bug is here https://github.com/hashicorp/terraform/blob/main/internal/terraform/node_resource_abstract_instance.go#L2735  ``` Why it's inconsistent Plain destroy → AfterIdentity = resp.PlannedIdentity → non-null → works. Replace destroy → Simplify hard-nulls AfterIdentity → provider sees nil.  Simplify nulling AfterIdentity is semantically correct (a Delete has no "after"). The defect is on the consuming side: the apply request should
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this @Kirdock and extra special Friday thanks for the doubletake caused by your user name 😂 

- **Issue #39283** (2026-09-25): **proxmox apply crash**
  *Symptoms*: ### Terraform Version  ```shell !!!!!!!!!!!!!!!!!!!!!!!!!!! TERRAFORM CRASH !!!!!!!!!!!!!!!!!!!!!!!!!!!!  panic: Failed to serialize resource instance in state: Instance proxmox_virtual_environment_vm.test[2] has status ObjectStatus(0), which cannot be saved in state. goroutine 154 [running]: runtime/debug.Stack()         runtime/debug/stack.go:26 +0x83 github.com/hashicorp/terraform/internal/logging.PanicHandler()         github.com/hashicorp/terraform/internal/logging/panic.go:84 +0x148 panic({0xbe5d160, 0x1240ee20})         runtime/panic.go:860 +0x10b github.com/hashicorp/terraform/internal/terraform.(*Graph).walk.func1.1()         github.com/hashicorp/terraform/internal/terraform/graph.go:59 +0x46d panic({0xbe5d160, 0x1240ee20})         runtime/panic.go:860 +0x10b github.com/hashicorp/terraform/internal/states/statefile.StatesMarshalEqual(0x123b45e0, 0x12033820)         github.com/hashicorp/terraform/internal/states/statefile/marshal_equal.go:34 +0x172 github.com/hashicorp/terraform/internal/states/statemgr.(*Filesystem).writeState(0x11ff1800, 0x123b45e0, 0x0)         github.com/hashicorp/terraform/internal/states/statemgr/filesystem.go:154 +0xcc github.com/hashicorp/terraform/internal/states/statemgr.(*Filesystem).WriteState(0x11ff1800, 0x123b45e0)         github.com/hashicorp/terraform/internal/states/statemgr/filesystem.go:140 +0x97 github.com/hashicorp/terraform/internal/backend/local.(*StateHook).PostStateUpdate(0x11ff17c0, 0x123b45e0)         github.com/hashicorp/te
  **Post-Mortem & Fix Analysis**:
  > Hi @witkacy26 , thanks for reporting this, and sorry about the panic! That's an interesting one, too - Can you add any additional information to help us reproduce this panic? What version of terraform were you running at the time? Is it something that can be reproduced with an example configuration? Can you share the relevant configuration and trace logs from terraform apply (removing any sensitive info)? 
  > Hi @witkacy26,  Knowing the recent changes in that area, I think I see what might be going on, but some confirmation might help. Do you have any logs or errors associated with the `proxmox_virtual_environment_vm.test`?
  > On 2026-09-24 21:11, James Bardin wrote: > jbardin left a comment (hashicorp/terraform#39283) [1] >  > Hi @witkacy26 [2], >  > Knowing the recent changes in that area, I think I see what might be > going on, but some confirmation might help. Do you have any logs or > errors associated with the proxmox_virtual_environment_vm.test? >    Hi guys, thank you for quick response.  I'll try to provide you with more information, that might be useful for  you.  I'm new to Proxmox, doing some experiments and seeing what I can do with  it. I've got this error once.  This is my details:  ``` ***@***.***:~/aws/create_instance/terraform/proxmox/00-test$ uname -a uname -m dpkg --print-architecture cat /etc/os-release Linux severianus 6.1.0-52-686-pae #1 SMP PREEMPT_DYNAMIC Debian  6.1.180-1 (2026-08-03) i686 GNU/Linux i686 i386 PRETTY_NAME="Debian GNU/Linux 12 (bookworm)" NAME="Debian GNU/Linux" VERSION_ID="12" VERSION="12 (bookworm)" VERSION_CODENAME=bookworm ID=debian HOME_URL="https://www.debian.or

- **Issue #39265** (2026-09-22): **Module published successfully but not visible on registry; unable to delete or re-publish**
  *Symptoms*: ### Terraform Version  ```shell v1.15.4 ```  ### Terraform Configuration Files  I'm writing to report what appears to be a bug in the Terraform Registry module publishing flow.  **What happened:**  - I published a new module (auth0/modules/auth0) from the GitHub repository auth0/terraform-auth0-modules via the Registry UI. - The publish flow completed without errors and showed a success state. - However, the module does not appear in search results and the canonical module URL returns an error (or empty state): https://registry.terraform.io/modules/auth0/modules/auth0   **Current state:**  - The module cannot be found via registry search. - The module page at the URL above does not load correctly. - The Registry UI does not offer an option to delete and re-publish the module, leaving it stuck in an invisible but apparently registered state.  **Impact**: The module is effectively unusable and unrecoverable without backend intervention on HashiCorp's side.  I've attached screenshots showing the broken module page, and the search returning no results.  Please let me know if you need additional information or access details. Thanks   ### Expected behavior  Module page should load, allow for delete and republish  ### Registry URL  https://registry.terraform.io/modules/auth0/modules/auth0    ### Debug Output  Attach screenshots above.  ### Expected Behavior  Module should publish successfully and load the UI.  ### Actual Behavior  ### Screenshots  Says module already exist, but whe
  **Post-Mortem & Fix Analysis**:
  > Issue similar to https://github.com/hashicorp/terraform/issues/22925  https://github.com/hashicorp/terraform/issues/30691 CC: @findkim 
  > Hi @duedares-rvj , I'm sorry you've run into this issue! Unfortunately the registry team does not watch this repository for issues. Please report issues with the Terraform Registry to [terraform-registry@hashicorp.com](mailto:terraform-registry@hashicorp.com). Thanks, and sorry we couldn't help! 
  > @mildwonkey We did email them but have had no response yet.  Would there be another channel via which I could request support?

- **Issue #39248** (2026-09-18): **🤖🤖🤖 backend/azure: follow NextMarker to paginate workspaces**
  *Symptoms*: ## Description  Fixes #35703  When listing workspaces in the `azurerm` backend, Azure Blob Storage returns an XML response containing `<Blobs>` and optionally `<NextMarker>`. If the blob listing spans across multiple pages (e.g., large workspace count or partition boundaries on the Azure storage side), Azure Blob Storage provides a `NextMarker` element indicating that follow-up requests are required to fetch subsequent pages.  Previously, `(*Backend).Workspaces()` in `internal/backend/remote-state/azure/backend_state.go` only executed a single `client.ListBlobs(...)` call, completely ignoring `resp.NextMarker`. As a result, only workspaces present on the first page were listed, omitting all workspaces on subsequent pages.  This PR updates `(*Backend).Workspaces()` to follow `NextMarker` in a loop, updating `params.Marker = resp.NextMarker` until all pages are retrieved.  ## Testing  Added a deterministic unit test `TestBackendWorkspaces_pagination` in `internal/backend/remote-state/azure/backend_test.go`: - Uses `net/http/httptest` to mock Azure Blob Storage XML responses without requiring live Azure credentials. - Serves two pages of results (first page containing `workspace-one` and `<NextMarker>token-page-2</NextMarker>`, second page containing `workspace-two`). - Verifies that `Workspaces()` follows the continuation marker and returns all workspaces (`["default", "workspace-one", "workspace-two"]`). - Fails without this fix (only returning `["default", "workspace-one"]`) 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for the submission. As this bypassed the normally required process as outlined in [CONTRIBUTING.md](https://github.com/hashicorp/terraform/blob/main/.github/CONTRIBUTING.md), particularly [Proposing a change](https://github.com/hashicorp/terraform/blob/main/.github/CONTRIBUTING.md#proposing-a-change), I am going to close this pull request. I'd suggest first, in the issue, establishing if the maintainers are open to reviewing a change in this area and then following the guidelines in Contributing.md. Thanks again!
  > Understood, thanks for the guidance @crw. I apologize for jumping ahead and bypassing the proposal process. I will follow up directly in #35703 to establish if the maintainers are open to reviewing a change in this area before proceeding. Thanks!

- **Issue #39235** (2026-09-16): **1.16.3 release artifacts served with Content-Type: binary/octet-stream, breaking Atlantis and other content-type-validating downloaders**
  *Symptoms*: ### Terraform Version  ``` Terraform v1.16.3 on darwin_arm64 ```  The defect is in how the 1.16.3 release artifacts are served, not in the Terraform binary. 1.16.2 and 1.16.1 are unaffected.  ### Terraform Configuration Files  Not configuration-dependent. This reproduces with `curl` alone, before any Terraform configuration is involved.  ### Debug Output  Every artifact in the 1.16.3 release on `releases.hashicorp.com` is served with `Content-Type: binary/octet-stream`:  ``` $ curl -sSI https://releases.hashicorp.com/terraform/1.16.3/terraform_1.16.3_linux_amd64.zip | grep -i content-type content-type: binary/octet-stream  $ curl -sSI https://releases.hashicorp.com/terraform/1.16.3/terraform_1.16.3_darwin_arm64.zip | grep -i content-type content-type: binary/octet-stream  $ curl -sSI https://releases.hashicorp.com/terraform/1.16.3/terraform_1.16.3_SHA256SUMS | grep -i content-type content-type: binary/octet-stream ```  The previous release is correct:  ``` $ curl -sSI https://releases.hashicorp.com/terraform/1.16.2/terraform_1.16.2_linux_amd64.zip | grep -i content-type content-type: application/zip ```  Downstream, Atlantis fails every plan with:  ``` error downloading terraform version 1.16.3: unexpected content-type: binary/octet-stream (expected any of ["application/x-zip-compressed" "application/zip"]) ```  ### Expected Behavior  `.zip` artifacts served as `application/zip` and `SHA256SUMS` as `text/plain`, consistent with 1.16.2 and every earlier release.  ### Actual Be
  **Post-Mortem & Fix Analysis**:
  > Thanks for this report, I have notified the internal release engineering team
  > This is breaking all our pipelines used to deploy infrastructure in more than 400 aws/azure accounts/suscriptions 
  > Thanks for the quick acknowledgment — I know it's only been a short while since this was reported and there hasn't been time for a full patch-release cycle yet, so this isn't a complaint about response speed. I'd like to make a case for a process change while you're still working the fix, rather than just about this one incident.  Terraform's own default resolution behavior is to always pull the newest matching version — nothing in the standard toolchain (bare `terraform init`, most CI images, tools like Atlantis/tenv/tfswitch without an explicit pin) defaults to a locked version. That means the moment a broken artifact is published, it becomes the silent default for every unpinned consumer, with zero opt-in required to be affected. Given how heavily Terraform is embedded in CI/CD pipelines industry-wide, that propagation is close to instantaneous and completely invisible until something breaks.  The standard response pattern — leave the broken release live and ship a fix forward — is 

- **Issue #39230** (2026-09-28): **A dangling symlink makes fileset() fail and discard every other match**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.18.0-dev on darwin_arm64 ```  (Built from `main` at `f8e7458f5`. The code path is unchanged in released versions.)  ### Terraform Configuration Files  ```terraform output "files" {   value = fileset(path.module, "*.txt") } ```  with, in the same directory:  ``` real.txt                 # an ordinary file dangling.txt -> gone.txt # a symlink whose target does not exist ```  ### Debug Output  ```console $ ls -la lrwxr-xr-x  1 user  staff  ...  dangling.txt -> /tmp/tffileset/gone.txt -rw-r--r--  1 user  staff    3  real.txt  $ echo 'fileset(path.cwd, "*.txt")' | terraform console ╷ │ Error: Error in function call │ │   on <console-input> line 1: │   (source code not available) │ │ Call to function "fileset" failed: failed to stat │ "/tmp/tffileset/dangling.txt": stat /tmp/tffileset/dangling.txt: no such │ file or directory. ╵ ```  ### Expected Behavior  ``` toset([   "real.txt", ]) ```  A symlink whose target is missing is not a regular file, so it cannot be a member of the result either way. Every other path that matched the pattern should still be returned.  ### Actual Behavior  The call fails, and **no** file is returned — `real.txt` is lost along with the broken link. One unresolvable name in a matched directory takes the whole `fileset` result with it.  ### Steps to Reproduce  ```console mkdir /tmp/tffileset && cd /tmp/tffileset echo hi > real.txt ln -s /tmp/tffileset/gone.txt dangling.txt echo 'fileset(path.cwd, "*.txt")' | terr
  **Post-Mortem & Fix Analysis**:
  > Thanks for this report! I was able to reproduce using the steps provided. 
  > Thanks for reproducing it.  @crw pointed out on #39231 that I jumped the queue by opening a PR before asking here, so asking properly: **would you be open to a community fix in this area**, or is `MakeFileSetFunc` something you would rather change yourselves?  The shape I have working, so the answer is cheap to give:  ```go fi, err := os.Stat(path) if err != nil {     if errors.Is(err, fs.ErrNotExist) {         continue     }     return cty.UnknownVal(cty.Set(cty.String)), fmt.Errorf("failed to stat %q: %w", path, err) } ```  Deliberately narrowed to `fs.ErrNotExist` rather than a blanket `if err != nil { continue }`: a name that does not resolve cannot be a regular file, so the very next `if !fi.Mode().IsRegular() { continue }` would have dropped it anyway, and dropping it early costs nothing. A stat that fails for another reason — a permission problem on a parent directory, say — still surfaces, because there the file may well exist and be a readable regular file, and swallowing that

- **Issue #39228** (2026-09-21): **textdecodebase64 rejects any string containing U+FFFD, so it cannot decode what textencodebase64 produced**
  *Symptoms*: ### Terraform Version  ```shell Terraform v1.18.0-dev on darwin_arm64 ```  (Built from `main` at `f8e7458f5`. The code path is unchanged since the function was introduced, so released versions behave the same.)  ### Terraform Configuration Files  ```terraform output "encoded" {   # A string that contains U+FFFD REPLACEMENT CHARACTER.   value = textencodebase64("caf�", "UTF-8") }  output "round_trip" {   value = textdecodebase64(textencodebase64("caf�", "UTF-8"), "UTF-8") } ```  ### Debug Output  Reproduced in `terraform console`, one expression per invocation:  ```console $ echo 'textencodebase64("caf�", "UTF-8")' | terraform console "Y2Fm77+9"  $ echo 'textdecodebase64("Y2Fm77+9", "UTF-8")' | terraform console ╷ │ Error: Invalid function argument │ │   on <console-input> line 1: │   (source code not available) │ │ Invalid value for "source" parameter: the given string contains symbols │ that are not defined for UTF-8. ╵  $ echo 'base64decode("Y2Fm77+9")' | terraform console "caf�" ```  ### Expected Behavior  `textdecodebase64("Y2Fm77+9", "UTF-8")` returns `"caf�"`.  `Y2Fm77+9` is the base64 of `63 61 66 EF BF BD` — four well-formed UTF-8 characters, the last being U+FFFD REPLACEMENT CHARACTER. Nothing about it is undefined for UTF-8, and `textencodebase64` produced that exact string one line earlier. `base64decode`, which takes the same bytes and also requires valid UTF-8, returns the string without complaint.  ### Actual Behavior  The call fails with *"the given string cont
  **Post-Mortem & Fix Analysis**:
  > Thanks for this report! Note that I am able to easily reproduce this issue with the instructions provided. 
  > Thanks for reproducing it.  On #39229 @crw pointed out that I opened a PR before asking here, so I am asking properly now: **would you be open to a community fix for `textdecodebase64`**, or would you rather change `TextDecodeBase64Func` yourselves?  Here is the shape I have working, so the question is quick to answer:  ```go decoded, err := decoder.Bytes(sDec) if err != nil || (bytes.ContainsRune(decoded, utf8.RuneError) && !decodedFaithfully(encoding, sDec, decoded)) { ```  `decodedFaithfully` encodes `decoded` again with the same encoding and compares the result with `sDec` byte for byte. A U+FFFD the decoder substituted cannot reproduce the byte it replaced; one the source really contained does. The change can only accept more inputs, and only when the round trip is exact. The existing `gQ==` / `windows-1250` case still fails. The extra encode runs only when the decoded output contains U+FFFD.  Tests: two cases in `TestBase64TextDecode` (a UTF-8 source containing U+FFFD, and U+FFFD

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

### Incident Patch 1: `aebe6826` (2026-09-29)
**Commit Message**: test: Add E2E test reproducing the bug reported in issue #39299

**File**: `internal/command/e2etest/fmt_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+// Copyright IBM Corp. 2014, 2026
+// SPDX-License-Identifier: BUSL-1.1
+
+package e2etest
+
+import (
+	"bytes"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"runtime"
+	"strings"
+	"testing"
+
+	"github.com/hashicorp/terraform/internal/e2e"
+)
+
+// Reproduction of the scenario reported in https://github.com/hashicorp/terraform/issues/39299
+func TestFmt_errorWritingToFile(t *testing.T) {
+	switch runtime.GOOS {
+	case "darwin", "linux":
+	default:
+		t.Skipf("test requires a Unix shell; `sh` unsupported on %s", runtime.GOOS)
+	}
+
+	fixturePath := filepath.Join("testdata", "fmt")
+	tf := e2e.NewBinary(t, terraformBin, fixturePath)
+
+	// Assert that main.tf has content before running fmt
+	mainPath := filepath.Join(tf.WorkDir(), "main.tf")
+	content, err := os.ReadFile(mainPath)
+	if err != nil {
+		t.Fatalf("unexpected error reading test file: %s", err)
+	}
+	if len(content) == 0 {
+		t.Fatal("expected main.tf to contain config, but it is empty")
+	}
+
+	// Assert that there's a formatting issue present
+	// With `-check`, this is confirmed by error code 3.
+	preFmtCmd := tf.Cmd("fmt", "-check", "-no-color")
+	err = preFmtCmd.Run()
+	if err.Error() != "exit status 3" {
+		t.Fatalf("expected exit status 3 error, got: %s", err)
+	}
+
+	// The fmt command we're testing ulimit with, which will attempt to write to main.tf
+	fmtCmd := tf.Cmd("fmt", "-no-color")
+	fmtCmd.Stdin = nil
+	fmtCmd.Stdout = &bytes.Buffer{}
+	fmtCmd.Stderr = &bytes.Buffer{}
+
+	// But, we need to wrap the command above in a shell command to enforce `ulimit -f 0`.
+	// This:
+	//   * Causes an error in fmt when writing formatted content to the file,
+	//     resulting in the file being left empty.
+	//   * Only impacts this command and not the entire test process.
+	cmd := exec.Command(
+		"/bin/sh", "-c",
+		`ulimit -f 0; exec "$@"`,
+		"sh", fmtCmd.Path,
+	)
+	cmd.Args = append(cmd.Args, fmtCmd.Args[1:]...)
+	cmd.Dir = fmtCmd.Dir
+	cmd.Env = fmtCmd.Env
+	cmd.Stdin, cmd.Stdout, cmd.Stderr = fmtCmd.Stdin, fmtCmd.Stdout, fmtCmd.Stderr
+
+	err = cmd.Run()
+	if err == nil {
+		t.Fatal("expected error when writing to file with ulimit -f 0, but got none")
+	}
+
+	stderr := cmd.Stderr.(*bytes.Buffer).String()
+	expectErr := "Error: Failed to write main.tf"
+	if !strings.Contains(stderr, expectErr) {
+		t.Fatalf("expected stderr to contain '%s', but got: %s", expectErr, stderr)
+	}
+
+	// Finally, confirm that the error made main.tf empty
+	content, err = os.ReadFile(mainPath)
+	if err != nil {
+		t.Fatalf("unexpected error reading test file: %s", err)
+	}
+	if len(content) != 0 {
+		t.Fatalf("expected main.tf to be empty after error, but got: %s", string(content))
+	}
+}
```

**File**: `internal/command/e2etest/testdata/fmt/main.tf` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# File should contain formatting errors; do not edit!
+
+variable "a" {
+default="x"
+  type =    string
+}
+
+locals {
+    b = var.a
+c =   "y"
+}
\ No newline at end of file
```

---

### Incident Patch 2: `2b7c4ca1` (2026-09-25)
**Commit Message**: Merge pull request #39287 from hashicorp/jbardin/tainted-crash

Ensure states without ObjectStatus are never serialized

**File**: `.changes/v1.16/BUG FIXES-20260925-091845.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+kind: BUG FIXES
+body: FIx crash when tainted instance state is seen without a valid status
+time: 2026-09-25T09:18:45.683653-04:00
+custom:
+    Issue: "39287"
```

**File**: `internal/terraform/context_apply2_test.go` (modified, +147/-0)
```diff
@@ -30,7 +30,9 @@ import (
 	"github.com/hashicorp/terraform/internal/plans"
 	"github.com/hashicorp/terraform/internal/providers"
 	testing_provider "github.com/hashicorp/terraform/internal/providers/testing"
+	"github.com/hashicorp/terraform/internal/provisioners"
 	"github.com/hashicorp/terraform/internal/states"
+	"github.com/hashicorp/terraform/internal/states/statefile"
 	"github.com/hashicorp/terraform/internal/tfdiags"
 )
 
@@ -5666,3 +5668,148 @@ resource "test_object" "forget" {
 		t.Fatal("should be no deposed instances")
 	}
 }
+
+// A create that fails with a partial state must never be visible in the
+// working state with an invalid status, because concurrent nodes may be
+// persisting state snapshots at any time.
+func TestContext2Apply_failedCreateStatusVisibleToConcurrentStateUpdate(t *testing.T) {
+	m := testModuleInline(t, map[string]string{
+		"main.tf": `
+resource "test_object" "a" {
+  test_string = "a"
+  provisioner "shell" {}
+}
+
+resource "test_object" "b" {
+  test_string = "b"
+}
+`,
+	})
+
+	// b is held until a is either provisioning or complete
+	releaseB := make(chan struct{})
+	var releaseOnce sync.Once
+	release := func() { releaseOnce.Do(func() { close(releaseB) }) }
+	bPersisted := make(chan struct{})
+
+	p := simpleMockProvider()
+	p.ApplyResourceChangeFn = func(req providers.ApplyResourceChangeRequest) (resp providers.ApplyResourceChangeResponse) {
+		resp.NewState = req.PlannedState
+		if req.PlannedState.GetAttr("test_string").AsString() == "a" {
+			resp.Diagnostics = resp.Diagnostics.Append(errors.New("create failed"))
+		}
+		return resp
+	}
+
+	pr := testProvisioner()
+	pr.ProvisionResourceFn = func(req provisioners.ProvisionResourceRequest) (resp provisioners.ProvisionResourceResponse) {
+		release()
+		select {
+		case <-bPersisted:
+		case <-time.After(5 * time.Second):
+			panic("timeout")
+		}
+		return resp
+	}
+
+	hook := &stateSerializingTestHook{
+		onPreApply: func(addr addrs.AbsResourceInstance) {
+			if addr.Equal(mustResourceInstanceAddr("test_object.b")) {
+				select {
+				case <-releaseB:
+				case <-time.After(5 * time.Second):
+					panic("timeout")
+				}
+			}
+		},
+		onPostApply: func(addr addrs.AbsResourceInstance) {
+			if addr.Equal(mustResourceInstanceAddr("test_object.a")) {
+				release()
+			}
+		},
+		onUpdate: func(s *states.State) {
+			if s.ResourceInstance(mustResourceInstanceAddr("test_object.b")) != nil {
+				select {
+				case <-bPersisted:
+				default:
+					close(bPersisted)
+				}
+			}
+		},
+	}
+
+	ctx := testContext2(t, &ContextOpts{
+		Hooks: []Hook{hook},
+		Providers: map[addrs.Provider]providers.Factory{
+			addrs.NewDefaultProvider("test"): testProviderFuncFixed(p),
+		},
+		Provisioners: map[string]provisioners.Factory{
+			"shell": testProvisionerFuncFixed(pr),
+		},
+	})
+
+	plan, diags := ctx.Plan(m, states.NewState(), DefaultPlanOpts)
+	tfdiags.AssertNoErrors(t, diags)
+
+	state, diags := ctx.Apply(plan, m, nil)
+	if !diags.HasErrors() {
+		t.Fatal("expected apply error")
+	}
+
+	for _, err := range hook.errs() {
+		t.Errorf("state snapshot could not be serialized: %s", err)
+	}
+
+	if pr.ProvisionResourceCalled {
+		t.Error("provisioner should not run for a failed create")
+	}
+
+	a := state.ResourceInstance(mustResourceInstanceAddr("test_object.a"))
+	if a == nil || a.Current == nil || a.Current.Status != states.ObjectTainted {
+		t.Fatalf("expected test_object.a to be tainted, got %#v", a)
+	}
+}
+
+// stateSerializingTestHook serializes every state snapshot, as the local backend's
+// StateHook does via statemgr.Filesystem.
+type stateSerializingTestHook struct {
+	NilHook
+
+	mu          sync.Mutex
+	serErrs     []error
+	onPreApply  func(addrs.AbsResourceInstance)
+	onPostApply func(addrs.AbsResourceInstance)
+	onUpdate    func(*states.State)
+}
+
+func (h *stateSerializingTestHook) PostApply(id HookResourceIdentity, dk addrs.DeposedKey, newState cty.Value, err error) (HookAction, error) {
+	if h.onPostApply != nil {
+
```

**File**: `internal/terraform/node_resource_abstract_instance.go` (modified, +18/-18)
```diff
@@ -2603,34 +2603,34 @@ func (n *NodeAbstractResourceInstance) evalDestroyProvisionerConfig(ctx EvalCont
 // nil, since it is only used to evaluate the configuration.
 func (n *NodeAbstractResourceInstance) apply(
 	ctx EvalContext,
-	state *states.ResourceInstanceObject,
+	priorState *states.ResourceInstanceObject,
 	change *plans.ResourceInstanceChange,
 	applyConfig *configs.Resource,
 	keyData instances.RepetitionData,
 	createBeforeDestroy bool) (*states.ResourceInstanceObject, tfdiags.Diagnostics) {
 
 	var diags tfdiags.Diagnostics
-	if state == nil {
-		state = &states.ResourceInstanceObject{}
+	if priorState == nil {
+		priorState = &states.ResourceInstanceObject{}
 	}
 
 	if change.Action == plans.NoOp {
 		// If this is a no-op change then we don't want to actually change
 		// anything, so we'll just echo back the state we were given and
 		// let our internal checks and updates proceed.
 		log.Printf("[TRACE] NodeAbstractResourceInstance.apply: skipping %s because it has no planned action", n.Addr)
-		return state, diags
+		return priorState, diags
 	}
 
 	provider, providerSchema, err := getProvider(ctx, n.ResolvedProvider)
 	if err != nil {
-		return state, diags.Append(err)
+		return priorState, diags.Append(err)
 	}
 	schema := providerSchema.SchemaForResourceType(n.Addr.Resource.Resource.Mode, n.Addr.Resource.Resource.Type)
 	if schema.Body == nil {
 		// Should be caught during validation, so we don't bother with a pretty error here
 		diags = diags.Append(fmt.Errorf("provider does not support resource type %q", n.Addr.Resource.Resource.Type))
-		return state, diags
+		return priorState, diags
 	}
 
 	log.Printf("[INFO] Starting apply for %s", n.Addr)
@@ -2641,7 +2641,7 @@ func (n *NodeAbstractResourceInstance) apply(
 		configVal, _, configDiags = ctx.EvaluateBlock(applyConfig.Config, schema.Body, nil, keyData)
 		diags = diags.Append(configDiags)
 		if configDiags.HasErrors() {
-			return state, diags
+			return priorState, diags
 		}
 	}
 
@@ -2666,13 +2666,13 @@ func (n *NodeAbstractResourceInstance) apply(
 				strings.Join(unknownPaths, "\n"),
 			),
 		))
-		return state, diags
+		return priorState, diags
 	}
 
 	metaConfigVal, metaDiags := n.Provider().getProviderMeta(ctx, n.Addr.Resource, n.ProviderMetas)
 	diags = diags.Append(metaDiags)
 	if diags.HasErrors() {
-		return state, diags
+		return priorState, diags
 	}
 
 	log.Printf("[DEBUG] %s: applying the planned %s change", n.Addr, change.Action)
@@ -2694,10 +2694,10 @@ func (n *NodeAbstractResourceInstance) apply(
 	if change.Action == plans.Update && eq && !marks.MarksEqual(beforePaths, afterPaths) {
 		// Copy the previous state, changing only the value
 		newState := &states.ResourceInstanceObject{
-			CreateBeforeDestroy: state.CreateBeforeDestroy,
-			Dependencies:        state.Dependencies,
-			Private:             state.Private,
-			Status:              state.Status,
+			CreateBeforeDestroy: priorState.CreateBeforeDestroy,
+			Dependencies:        priorState.Dependencies,
+			Private:             priorState.Private,
+			Status:              states.ObjectReady,
 			Value:               change.After,
 			Identity:            change.AfterIdentity,
 		}
@@ -2795,7 +2795,7 @@ func (n *NodeAbstractResourceInstance) apply(
 		// Bail early in this particular case, because an object that doesn't
 		// conform to the schema can't be saved in the state anyway -- the
 		// serializer will reject it.
-		return state, diags
+		return priorState, diags
 	}
 
 	// Providers are supposed to return null values for all write-only attributes
@@ -2813,7 +2813,7 @@ func (n *NodeAbstractResourceInstance) apply(
 	diags = diags.Append(writeOnlyDiags)
 
 	if writeOnlyDiags.HasErrors() {
-		return state, diags
+		return priorState, diags
 	}
 
 	// After this point we have a type-conforming result object and so we
@@ -2948,12 +2948,12 @@ func (n *NodeAbstractResourceInstance) apply(
 		// prior state as the new value, making this effectively a no-op.  If
 		// th
```

**File**: `internal/terraform/node_resource_apply_instance.go` (modified, +10/-8)
```diff
@@ -290,7 +290,7 @@ func (n *NodeApplyableResourceInstance) managedResourceExecute(ctx EvalContext)
 	diags = diags.Append(applyDiags)
 	if diags.HasErrors() {
 		// apply errors might need to taint the state
-		if err := n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
+		if state, err = n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
 			return diags.Append(err)
 		}
 	} else {
@@ -323,7 +323,7 @@ func (n *NodeApplyableResourceInstance) managedResourceExecute(ctx EvalContext)
 		diags = diags.Append(applyProvisionersDiags)
 		// provisioners always tainted on error
 		if diags.HasErrors() {
-			if err := n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
+			if state, err = n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
 				// we always return immediately if we can't update state
 				return diags.Append(err)
 			}
@@ -334,7 +334,7 @@ func (n *NodeApplyableResourceInstance) managedResourceExecute(ctx EvalContext)
 		taintInstance, actionDiags := n.invokeActions(ctx, repData, configs.AfterEvents, state.Value)
 		diags = diags.Append(actionDiags)
 		if taintInstance {
-			if err := n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
+			if state, err = n.taintInstanceState(ctx, state, diffApply.Action); err != nil {
 				// we always return immediately if we can't update state
 				return diags.Append(err)
 			}
@@ -469,18 +469,20 @@ func (n *NodeApplyableResourceInstance) checkPlannedChange(ctx EvalContext, plan
 
 // taintInstanceState takes the state object error from an apply operation and
 // writes the instance object to the global stated marked as tainted, but only
-// if the instance was being created.
+// if the instance was being created. The returned object is what was written,
+// and must replace the caller's object so that later writes of it do not
+// revert the tainted status.
 //
 // TODO: Tainted was invented for failed create events, and provisioners which
 // could only be associated with those create events. If actions ever need to be
 // rerun for other event types, something more specific than `Tainted` needs to
 // be added to the resource state.
-func (n *NodeApplyableResourceInstance) taintInstanceState(ctx EvalContext, state *states.ResourceInstanceObject, action plans.Action) error {
+func (n *NodeApplyableResourceInstance) taintInstanceState(ctx EvalContext, state *states.ResourceInstanceObject, action plans.Action) (*states.ResourceInstanceObject, error) {
 	if action != plans.Create {
-		return nil
+		return state, nil
 	}
 
 	log.Printf("[TRACE] taintState: %s encountered an error during creation, so it is now marked as tainted", n.Addr)
-	return n.writeResourceInstanceState(ctx, state.AsTainted(), workingState)
-
+	tainted := state.AsTainted()
+	return tainted, n.writeResourceInstanceState(ctx, tainted, workingState)
 }
```

---

### Incident Patch 3: `81849acf` (2026-09-24)
**Commit Message**: test: Update test and test fixture to stop using the `template` provider

The `template` provider is archived and isn't built for newer platforms.

**File**: `internal/command/e2etest/automation_test.go` (modified, +20/-19)
```diff
@@ -43,8 +43,8 @@ func TestPlanApplyInAutomation(t *testing.T) {
 
 	// Make sure we actually downloaded the plugins, rather than picking up
 	// copies that might be already installed globally on the system.
-	if !strings.Contains(stdout, "Installing hashicorp/template v") {
-		t.Errorf("template provider download message is missing from init output:\n%s", stdout)
+	if !strings.Contains(stdout, "Installing hashicorp/local v") {
+		t.Errorf("local provider download message is missing from init output:\n%s", stdout)
 		t.Logf("(this can happen if you have a copy of the plugin in one of the global plugin search dirs)")
 	}
 	if !strings.Contains(stdout, "Installing hashicorp/null v") {
@@ -58,8 +58,8 @@ func TestPlanApplyInAutomation(t *testing.T) {
 		t.Fatalf("unexpected plan error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "1 to add, 0 to change, 0 to destroy") {
-		t.Errorf("incorrect plan tally; want 1 to add:\n%s", stdout)
+	if !strings.Contains(stdout, "2 to add, 0 to change, 0 to destroy") {
+		t.Errorf("incorrect plan tally; want 2 to add:\n%s", stdout)
 	}
 
 	// Because we're running with TF_IN_AUTOMATION set, we should not see
@@ -75,11 +75,12 @@ func TestPlanApplyInAutomation(t *testing.T) {
 
 	// stateResources := plan.Changes.Resources
 	diffResources := plan.Changes.Resources
-	if len(diffResources) != 1 {
+	if len(diffResources) != 2 {
 		t.Errorf("incorrect number of resources in plan")
 	}
 
 	expected := map[string]plans.Action{
+		"local_file.hello":   plans.Create,
 		"null_resource.test": plans.Create,
 	}
 
@@ -99,8 +100,8 @@ func TestPlanApplyInAutomation(t *testing.T) {
 		t.Fatalf("unexpected apply error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 added, 0 changed, 0 destroyed") {
-		t.Errorf("incorrect apply tally; want 1 added:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 added, 0 changed, 0 destroyed") {
+		t.Errorf("incorrect apply tally; want 2 added:\n%s", stdout)
 	}
 
 	state, err := tf.LocalState()
@@ -116,7 +117,7 @@ func TestPlanApplyInAutomation(t *testing.T) {
 	sort.Strings(gotResources)
 
 	wantResources := []string{
-		"data.template_file.test",
+		"local_file.hello",
 		"null_resource.test",
 	}
 
@@ -131,7 +132,7 @@ func TestAutoApplyInAutomation(t *testing.T) {
 	t.Parallel()
 
 	// This test reaches out to releases.hashicorp.com to download the
-	// template and null providers, so it can only run if network access is
+	// local and null providers, so it can only run if network access is
 	// allowed.
 	skipIfCannotAccessNetwork(t)
 
@@ -150,8 +151,8 @@ func TestAutoApplyInAutomation(t *testing.T) {
 
 	// Make sure we actually downloaded the plugins, rather than picking up
 	// copies that might be already installed globally on the system.
-	if !strings.Contains(stdout, "Installing hashicorp/template v") {
-		t.Errorf("template provider download message is missing from init output:\n%s", stdout)
+	if !strings.Contains(stdout, "Installing hashicorp/local v") {
+		t.Errorf("local provider download message is missing from init output:\n%s", stdout)
 		t.Logf("(this can happen if you have a copy of the plugin in one of the global plugin search dirs)")
 	}
 	if !strings.Contains(stdout, "Installing hashicorp/null v") {
@@ -165,8 +166,8 @@ func TestAutoApplyInAutomation(t *testing.T) {
 		t.Fatalf("unexpected apply error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 added, 0 changed, 0 destroyed") {
-		t.Errorf("incorrect apply tally; want 1 added:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 added, 0 changed, 0 destroyed") {
+		t.Errorf("incorrect apply tally; want 2 added:\n%s", stdout)
 	}
 
 	state, err := tf.LocalState()
@@ -182,7 +183,7 @@ func TestAutoApplyInAutomation(t *testing.T) {
 	sort.Strings(gotResources)
 
 	wantResources := []string{
-		"data.template_file.test",
+		"local_file.hello",
 		"null_resource.test",
 	}
 
@@ -197,7 +198,7 @@ func Te
```

**File**: `internal/command/e2etest/primary_test.go` (modified, +13/-12)
```diff
@@ -35,7 +35,7 @@ func TestPrimarySeparatePlan(t *testing.T) {
 	t.Parallel()
 
 	// This test reaches out to releases.hashicorp.com to download the
-	// template and null providers, so it can only run if network access is
+	// local and null providers, so it can only run if network access is
 	// allowed.
 	skipIfCannotAccessNetwork(t)
 
@@ -50,8 +50,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 
 	// Make sure we actually downloaded the plugins, rather than picking up
 	// copies that might be already installed globally on the system.
-	if !strings.Contains(stdout, "Installing hashicorp/template v") {
-		t.Errorf("template provider download message is missing from init output:\n%s", stdout)
+	if !strings.Contains(stdout, "Installing hashicorp/local v") {
+		t.Errorf("local provider download message is missing from init output:\n%s", stdout)
 		t.Logf("(this can happen if you have a copy of the plugin in one of the global plugin search dirs)")
 	}
 	if !strings.Contains(stdout, "Installing hashicorp/null v") {
@@ -65,8 +65,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 		t.Fatalf("unexpected plan error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "1 to add, 0 to change, 0 to destroy") {
-		t.Errorf("incorrect plan tally; want 1 to add:\n%s", stdout)
+	if !strings.Contains(stdout, "2 to add, 0 to change, 0 to destroy") {
+		t.Errorf("incorrect plan tally; want 2 to add:\n%s", stdout)
 	}
 
 	if !strings.Contains(stdout, "Saved the plan to: tfplan") {
@@ -82,11 +82,12 @@ func TestPrimarySeparatePlan(t *testing.T) {
 	}
 
 	diffResources := plan.Changes.Resources
-	if len(diffResources) != 1 {
-		t.Errorf("incorrect number of resources in plan")
+	if len(diffResources) != 2 {
+		t.Errorf("incorrect number of resources in plan, want %d, got %d", 2, len(diffResources))
 	}
 
 	expected := map[string]plans.Action{
+		"local_file.hello":   plans.Create,
 		"null_resource.test": plans.Create,
 	}
 
@@ -106,8 +107,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 		t.Fatalf("unexpected apply error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 added, 0 changed, 0 destroyed") {
-		t.Errorf("incorrect apply tally; want 1 added:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 added, 0 changed, 0 destroyed") {
+		t.Errorf("incorrect apply tally; want 2 added:\n%s", stdout)
 	}
 
 	state, err := tf.LocalState()
@@ -123,7 +124,7 @@ func TestPrimarySeparatePlan(t *testing.T) {
 	sort.Strings(gotResources)
 
 	wantResources := []string{
-		"data.template_file.test",
+		"local_file.hello",
 		"null_resource.test",
 	}
 
@@ -137,8 +138,8 @@ func TestPrimarySeparatePlan(t *testing.T) {
 		t.Fatalf("unexpected destroy error: %s\nstderr:\n%s", err, stderr)
 	}
 
-	if !strings.Contains(stdout, "Resources: 1 destroyed") {
-		t.Errorf("incorrect destroy tally; want 1 destroyed:\n%s", stdout)
+	if !strings.Contains(stdout, "Resources: 2 destroyed") {
+		t.Errorf("incorrect destroy tally; want 2 destroyed:\n%s", stdout)
 	}
 
 	state, err = tf.LocalState()
```

**File**: `internal/command/e2etest/testdata/full-workflow-null/main.tf` (modified, +6/-8)
```diff
@@ -3,20 +3,18 @@ variable "name" {
   default = "world"
 }
 
-data "template_file" "test" {
-  template = "Hello, $${name}"
-
-  vars = {
-    name = "${var.name}"
-  }
+resource "local_file" "hello" {
+  content  = "Hello, ${var.name}"
+  filename = "${path.module}/hello.txt"
 }
 
+
 resource "null_resource" "test" {
   triggers = {
-    greeting = "${data.template_file.test.rendered}"
+    greeting = "${local_file.hello.content}"
   }
 }
 
 output "greeting" {
-  value = "${null_resource.test.triggers["greeting"]}"
+  value = null_resource.test.triggers["greeting"]
 }
```

---

### Incident Patch 4: `55d258b2` (2026-09-24)
**Commit Message**: fix: Rename import

**File**: `internal/command/views/init_test.go` (modified, +3/-3)
```diff
@@ -18,7 +18,7 @@ import (
 	"github.com/hashicorp/terraform/internal/policy"
 	"github.com/hashicorp/terraform/internal/terminal"
 	"github.com/hashicorp/terraform/internal/tfdiags"
-	"github.com/hashicorp/terraform/version"
+	tfversion "github.com/hashicorp/terraform/version"
 )
 
 func TestNewInit_jsonViewDiagnostics(t *testing.T) {
@@ -948,10 +948,10 @@ func TestInitJSON_Version(t *testing.T) {
 	want := []map[string]interface{}{
 		{
 			"@level":    "info",
-			"@message":  fmt.Sprintf("Terraform %s", version.String()),
+			"@message":  fmt.Sprintf("Terraform %s", tfversion.String()),
 			"@module":   "terraform.ui",
 			"type":      "version",
-			"terraform": version.String(),
+			"terraform": tfversion.String(),
 			"ui":        JSON_UI_VERSION,
 		},
 	}
```

---

### Incident Patch 5: `7fa34835` (2026-09-23)
**Commit Message**: Merge pull request #39095 from tism/fix-tfpolicy-render

Fix the error checked when rendering the policy evaluation output

**File**: `.changes/v1.16/BUG FIXES-20260901-115602.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+kind: BUG FIXES
+body: Fixed an issue where Terraform fails when rendering policy evaluation outcomes for older versions of Terraform Enterprise
+time: 2026-09-01T11:56:02.703071+10:00
+custom:
+    Issue: "39095"
```

**File**: `internal/cloud/backend_tfPolicyEvaluation.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ func (b *Cloud) renderTFPolicyEvaluations(stopCtx context.Context, r *tfe.Run, s
 	})
 	if err != nil {
 		// Older TFE versions don't know this include; nothing to render.
-		if strings.HasSuffix(err.Error(), "Invalid include parameter") {
+		if err == tfe.ErrInvalidIncludeValue {
 			return nil
 		}
 		return b.generalError("Failed to retrieve Terraform policy evaluations", err)
```

**File**: `internal/cloud/backend_tfPolicyEvaluation_test.go` (modified, +46/-0)
```diff
@@ -5,6 +5,7 @@ package cloud
 
 import (
 	"context"
+	"errors"
 	"strings"
 	"testing"
 
@@ -268,3 +269,48 @@ func TestTFPolicyStageLabel(t *testing.T) {
 		}
 	}
 }
+
+type runsWithReadError struct {
+	*MockRuns
+	err error
+}
+
+func (r *runsWithReadError) ReadWithOptions(_ context.Context, _ string, _ *tfe.RunReadOptions) (*tfe.Run, error) {
+	return nil, r.err
+}
+
+func TestCloud_renderTFPolicyEvaluations_invalidInclude(t *testing.T) {
+	b, bCleanup := testBackendWithName(t)
+	t.Cleanup(bCleanup)
+
+	stream, _ := terminal.StreamsForTesting(t)
+	b.renderer = &jsonformat.Renderer{Streams: stream, Colorize: mockColorize()}
+
+	b.client.Runs = &runsWithReadError{
+		MockRuns: b.client.Runs.(*MockRuns),
+		err:      tfe.ErrInvalidIncludeValue,
+	}
+
+	run := &tfe.Run{ID: "run-invalid-include"}
+	if err := b.renderTFPolicyEvaluations(context.Background(), run); err != nil {
+		t.Errorf("expected nil error for invalid include value, got: %v", err)
+	}
+}
+
+func TestCloud_renderTFPolicyEvaluations_error(t *testing.T) {
+	b, bCleanup := testBackendWithName(t)
+	t.Cleanup(bCleanup)
+
+	stream, _ := terminal.StreamsForTesting(t)
+	b.renderer = &jsonformat.Renderer{Streams: stream, Colorize: mockColorize()}
+
+	b.client.Runs = &runsWithReadError{
+		MockRuns: b.client.Runs.(*MockRuns),
+		err:      errors.New("error"),
+	}
+
+	run := &tfe.Run{ID: "run-error"}
+	if err := b.renderTFPolicyEvaluations(context.Background(), run); err == nil {
+		t.Error("expected an error, got nil")
+	}
+}
```

---

### Incident Patch 6: `d6718ce9` (2026-09-21)
**Commit Message**: Fix provider requirements override behavior

Before this change, we lost the order within an override file. An
earlier expresssion could incorrectly replace a later legacy
declaration.

**File**: `internal/configs/module.go` (modified, +19/-17)
```diff
@@ -88,13 +88,12 @@ type File struct {
 
 	ActiveExperiments experiments.Set
 
-	Backends              []*Backend
-	StateStores           []*StateStore
-	CloudConfigs          []*CloudConfig
-	ProviderConfigs       []*Provider
-	ProviderMetas         []*ProviderMeta
-	RequiredProviders     []*RequiredProviders
-	RequiredProviderExprs []*ProviderRequirementExpr
+	Backends          []*Backend
+	StateStores       []*StateStore
+	CloudConfigs      []*CloudConfig
+	ProviderConfigs   []*Provider
+	ProviderMetas     []*ProviderMeta
+	RequiredProviders []*RequiredProvidersBlock
 
 	Variables []*Variable
 	Locals    []*Local
@@ -163,10 +162,13 @@ func NewModule(primaryFiles, overrideFiles []*File) (*Module, hcl.Diagnostics) {
 				})
 				continue
 			}
-			mod.ProviderRequirements = r
-		}
-		for _, expr := range file.RequiredProviderExprs {
-			mod.ProviderRequirementExprs[expr.Name] = expr
+			mod.ProviderRequirements = &RequiredProviders{
+				RequiredProviders: r.RequiredProviders,
+				DeclRange:         r.DeclRange,
+			}
+			for name, expr := range r.RequiredProviderExprs {
+				mod.ProviderRequirementExprs[name] = expr
+			}
 		}
 	}
 
@@ -179,18 +181,18 @@ func NewModule(primaryFiles, overrideFiles []*File) (*Module, hcl.Diagnostics) {
 	}
 
 	// Any required_providers blocks in override files replace the entire
-	// block for each provider. Process resolved and expression-based requirements
-	// in file order, removing superseded declarations from either representation.
+	// block for each provider. Process blocks in file and source order, removing
+	// superseded declarations from either representation before evaluation.
 	for _, file := range overrideFiles {
 		for _, override := range file.RequiredProviders {
 			for name, rp := range override.RequiredProviders {
 				delete(mod.ProviderRequirementExprs, name)
 				mod.ProviderRequirements.RequiredProviders[name] = rp
 			}
-		}
-		for _, expr := range file.RequiredProviderExprs {
-			delete(mod.ProviderRequirements.RequiredProviders, expr.Name)
-			mod.ProviderRequirementExprs[expr.Name] = expr
+			for name, expr := range override.RequiredProviderExprs {
+				delete(mod.ProviderRequirements.RequiredProviders, name)
+				mod.ProviderRequirementExprs[name] = expr
+			}
 		}
 	}
 
```

**File**: `internal/configs/module_merge_test.go` (modified, +198/-0)
```diff
@@ -5,6 +5,7 @@ package configs
 
 import (
 	"fmt"
+	"strings"
 	"testing"
 
 	"github.com/hashicorp/hcl/v2"
@@ -161,6 +162,203 @@ terraform {
 	}
 }
 
+func TestModuleOverrideRequiredProvidersSameFile(t *testing.T) {
+	const (
+		expression      = `required_providers { random = { source = var.provider_source, version = var.provider_version, configuration_aliases = [random.old] } }`
+		laterExpression = `required_providers { random = { source = "other/random", version = "~> 4.0" } }`
+		legacy          = `required_providers { random = "~> 2.0" }`
+		emptyObject     = `required_providers { random = {} }`
+		aliasesOnly     = `required_providers { random = { configuration_aliases = [random.next] } }`
+		emptyBlock      = `required_providers {}`
+	)
+
+	tests := []struct {
+		name      string
+		blocks    []string
+		wantBlock int
+	}{
+		{
+			name:      "expression-based to legacy",
+			blocks:    []string{expression, legacy},
+			wantBlock: 1,
+		},
+		{
+			name:      "expression-based to empty object",
+			blocks:    []string{expression, emptyObject},
+			wantBlock: 1,
+		},
+		{
+			name:      "expression-based to aliases-only",
+			blocks:    []string{expression, aliasesOnly},
+			wantBlock: 1,
+		},
+		{
+			name:      "legacy to expression-based",
+			blocks:    []string{legacy, laterExpression},
+			wantBlock: 1,
+		},
+		{
+			name:      "empty object to expression-based",
+			blocks:    []string{emptyObject, laterExpression},
+			wantBlock: 1,
+		},
+		{
+			name:      "aliases-only to expression-based clears aliases",
+			blocks:    []string{aliasesOnly, laterExpression},
+			wantBlock: 1,
+		},
+		{
+			name:      "alternating declarations ending resolved",
+			blocks:    []string{`required_providers { random = "~> 3.0" }`, expression, legacy},
+			wantBlock: 2,
+		},
+		{
+			name:      "alternating declarations ending expression-based",
+			blocks:    []string{expression, legacy, laterExpression},
+			wantBlock: 2,
+		},
+		{
+			name:      "aliases-only to legacy clears aliases",
+			blocks:    []string{aliasesOnly, legacy},
+			wantBlock: 1,
+		},
+		{
+			name:      "aliases-only to empty object clears aliases",
+			blocks:    []string{aliasesOnly, emptyObject},
+			wantBlock: 1,
+		},
+		{
+			name:      "empty block retains expression-based requirement",
+			blocks:    []string{expression, emptyBlock},
+			wantBlock: 0,
+		},
+		{
+			name:      "empty block retains resolved requirement",
+			blocks:    []string{legacy, emptyBlock},
+			wantBlock: 0,
+		},
+		{
+			name:      "empty block between declarations",
+			blocks:    []string{expression, emptyBlock, legacy},
+			wantBlock: 2,
+		},
+	}
+
+	for layout, separator := range map[string]string{
+		"one terraform block":       "\n",
+		"separate terraform blocks": "\n}\nterraform {\n",
+	} {
+		t.Run(layout, func(t *testing.T) {
+			for _, tc := range tests {
+				t.Run(tc.name, func(t *testing.T) {
+					parser := testParser(map[string]string{
+						"mod/override.tf": "terraform {\n" + strings.Join(tc.blocks, separator) + "\n}",
+					})
+					override, diags := parser.LoadConfigFileOverride("mod/override.tf")
+					assertNoDiagnostics(t, diags)
+
+					// The whole declaration must come from the winning block,
+					// including its aliases, expressions, and source ranges.
+					want := override.RequiredProviders[tc.wantBlock]
+					mod, diags := NewModule(nil, []*File{override})
+					assertNoDiagnostics(t, diags)
+
+					req, hasResolved := mod.ProviderRequirements.RequiredProviders["random"]
+					expr, hasExpr := mod.ProviderRequirementExprs["random"]
+					if hasResolved == hasExpr {
+						t.Fatalf("expected exactly one representation of the requirement: resolved=%t, expression-based=%t", hasResolved, hasExpr)
+					}
+					assertResultDeepEqual(t, req, want.RequiredProviders["random"])
+					assertResultDeepEqual(t, expr, want.RequiredProviderExprs["random"])
+				})
+			}
+		})
+	}
+}
+
+func TestModuleOverrideRequiredProvidersSameFileRetainsUnr
```

**File**: `internal/configs/parser_config.go` (modified, +1/-4)
```diff
@@ -156,14 +156,11 @@ func parseConfigFile(body hcl.Body, diags hcl.Diagnostics, override, allowExperi
 					}
 
 				case "required_providers":
-					reqs, reqExprs, reqsDiags := decodeRequiredProvidersBlock(innerBlock)
+					reqs, reqsDiags := decodeRequiredProvidersBlock(innerBlock)
 					diags = append(diags, reqsDiags...)
 					if reqs != nil {
 						file.RequiredProviders = append(file.RequiredProviders, reqs)
 					}
-					for _, expr := range reqExprs {
-						file.RequiredProviderExprs = append(file.RequiredProviderExprs, expr)
-					}
 
 				case "provider_meta":
 					providerCfg, cfgDiags := decodeProviderMetaBlock(innerBlock)
```

**File**: `internal/configs/provider_requirements.go` (modified, +15/-12)
```diff
@@ -29,21 +29,24 @@ type RequiredProviders struct {
 	DeclRange         hcl.Range
 }
 
-func decodeRequiredProvidersBlock(block *hcl.Block) (
-	*RequiredProviders,
-	map[string]*ProviderRequirementExpr,
-	hcl.Diagnostics,
-) {
+// RequiredProvidersBlock retains both resolved and deferred declarations from a
+// single required_providers block so that overrides can be applied in block order.
+type RequiredProvidersBlock struct {
+	RequiredProviders     map[string]*RequiredProvider
+	RequiredProviderExprs map[string]*ProviderRequirementExpr
+	DeclRange             hcl.Range
+}
+
+func decodeRequiredProvidersBlock(block *hcl.Block) (*RequiredProvidersBlock, hcl.Diagnostics) {
 	attrs, diags := block.Body.JustAttributes()
 	if diags.HasErrors() {
-		return nil, nil, diags
+		return nil, diags
 	}
 
-	ret := &RequiredProviders{
+	ret := &RequiredProvidersBlock{
 		RequiredProviders: make(map[string]*RequiredProvider),
 		DeclRange:         block.DefRange,
 	}
-	var deferredExprs map[string]*ProviderRequirementExpr
 
 	for name, attr := range attrs {
 		rp := &RequiredProvider{
@@ -196,10 +199,10 @@ func decodeRequiredProvidersBlock(block *hcl.Block) (
 				providerExpr.VersionExpr = versionExpr
 			}
 
-			if deferredExprs == nil {
-				deferredExprs = map[string]*ProviderRequirementExpr{}
+			if ret.RequiredProviderExprs == nil {
+				ret.RequiredProviderExprs = map[string]*ProviderRequirementExpr{}
 			}
-			deferredExprs[name] = providerExpr
+			ret.RequiredProviderExprs[name] = providerExpr
 
 			// Skip adding it to required providers.
 			continue
@@ -224,5 +227,5 @@ func decodeRequiredProvidersBlock(block *hcl.Block) (
 		ret.RequiredProviders[rp.Name] = rp
 	}
 
-	return ret, deferredExprs, diags
+	return ret, diags
 }
```

**File**: `internal/configs/provider_requirements_test.go` (modified, +7/-5)
```diff
@@ -361,7 +361,7 @@ func TestDecodeRequiredProvidersBlock(t *testing.T) {
 
 	for name, test := range tests {
 		t.Run(name, func(t *testing.T) {
-			got, gotExprs, diags := decodeRequiredProvidersBlock(test.Block)
+			got, diags := decodeRequiredProvidersBlock(test.Block)
 			if diags.HasErrors() {
 				if test.Error == "" {
 					t.Fatalf("unexpected error: %v", diags)
@@ -373,11 +373,13 @@ func TestDecodeRequiredProvidersBlock(t *testing.T) {
 				t.Fatalf("expected error")
 			}
 
-			if !cmp.Equal(got, test.Want, ignoreUnexported, comparer) {
-				t.Fatalf("wrong result:\n %s", cmp.Diff(got, test.Want, ignoreUnexported, comparer))
+			want := &RequiredProvidersBlock{
+				RequiredProviders:     test.Want.RequiredProviders,
+				RequiredProviderExprs: test.WantExprs,
+				DeclRange:             test.Want.DeclRange,
 			}
-			if !cmp.Equal(gotExprs, test.WantExprs, providerExprComparer) {
-				t.Fatalf("wrong expressions:\n %s", cmp.Diff(gotExprs, test.WantExprs, providerExprComparer))
+			if diff := cmp.Diff(want, got, ignoreUnexported, comparer, providerExprComparer); diff != "" {
+				t.Fatalf("wrong result (-want +got):\n %s", diff)
 			}
 		})
 	}
```

---

### Incident Patch 7: `2e7ccc3d` (2026-09-21)
**Commit Message**: fix: properly check that plan and apply time -targets match and return a warning when they do not (#39257)

* fix: properly check that plan and apply time -targets match and return a warning when they do not

This fixes a minor issue with the plan/apply -target validation. I made the original fix; an agent added the MakeSet detail which gracefully handled cases I had missed.

**File**: `.changes/v1.18/BUG FIXES-20260921-112948.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+kind: BUG FIXES
+body: 'fix(cli): properly validate apply time -targets match plan -targets'
+time: 2026-09-21T11:29:48.316406-04:00
+custom:
+    Issue: "39257"
```

**File**: `internal/backend/local/backend_apply.go` (modified, +16/-15)
```diff
@@ -422,25 +422,26 @@ func (b *Local) opApply(
 		}
 	}
 
-	// If the user erroneously included any plan options flags when they supplied a plan file,
-	// we'll return an error if the flag values don't match the plan file.
+	// Plan options supplied alongside a saved plan cannot change that plan. Warn
+	// if the apply-time targets don't exactly match those stored in the plan.
 	if len(op.Targets) != 0 {
-		// Do target flags all match targets in the plan?
-		for _, target := range op.Targets {
-			found := false
-			for _, planTarget := range plan.TargetAddrs {
-				if target.TargetContains(planTarget) {
-					found = true
+		planTargets := addrs.MakeSet(plan.TargetAddrs...)
+		applyTargets := addrs.MakeSet(op.Targets...)
+		targetsMatch := len(planTargets) == len(applyTargets)
+		if targetsMatch {
+			for _, target := range applyTargets {
+				if !planTargets.Has(target) {
+					targetsMatch = false
 					break
 				}
 			}
-			if !found {
-				diags = diags.Append(tfdiags.Sourceless(
-					tfdiags.Warning,
-					"Can't change resource targeting when applying a saved plan",
-					fmt.Sprintf("The target address %q was supplied using a -target flag but does not match a target in the saved plan file. This flag will be ignored and won't influence the apply operation.", target),
-				))
-			}
+		}
+		if !targetsMatch {
+			diags = diags.Append(tfdiags.Sourceless(
+				tfdiags.Warning,
+				"Can't change resource targeting when applying a saved plan",
+				"The -target address(es) supplied to the apply command do not match the target options used to create the saved plan. The apply-time options will be ignored and the saved plan will be applied as-is.",
+			))
 		}
 	}
 	if op.PlanMode != plan.UIMode {
```

**File**: `internal/command/apply_test.go` (modified, +82/-1)
```diff
@@ -2122,7 +2122,7 @@ func TestApply_changedPlanOptions_applyTime(t *testing.T) {
 		if !strings.Contains(output.Stdout(), `Warning: Can't change resource targeting when applying a saved plan`) {
 			t.Fatalf("missing warning text:\n%s", output.All())
 		}
-		if !strings.Contains(output.Stdout(), `target address "test_instance.foo"`) {
+		if !strings.Contains(output.Stdout(), `-target address(es) supplied to the apply command`) {
 			t.Fatalf("missing detail from warning:\n%s", output.All())
 		}
 	})
@@ -2192,6 +2192,87 @@ func TestApply_changedPlanOptions_applyTime(t *testing.T) {
 	})
 }
 
+func TestApply_changedTargets_applyTime(t *testing.T) {
+	tests := map[string]struct {
+		planTargets  []string
+		applyTargets []string
+		wantWarning  bool
+	}{
+		"same target": {
+			planTargets:  []string{"test_instance.foo"},
+			applyTargets: []string{"test_instance.foo"},
+			wantWarning:  false,
+		},
+		"same targets in different order": {
+			planTargets:  []string{"test_instance.foo", "test_instance.bar"},
+			applyTargets: []string{"test_instance.bar", "test_instance.foo"},
+			wantWarning:  false,
+		},
+		"narrower target": {
+			planTargets:  []string{"module.foo"},
+			applyTargets: []string{"module.foo.test_instance.bar"},
+			wantWarning:  true,
+		},
+		"broader target": {
+			planTargets:  []string{"module.foo.test_instance.bar"},
+			applyTargets: []string{"module.foo"},
+			wantWarning:  true,
+		},
+		"omitted target": {
+			planTargets:  []string{"test_instance.foo", "test_instance.bar"},
+			applyTargets: []string{"test_instance.foo"},
+			wantWarning:  true,
+		},
+		"additional target": {
+			planTargets:  []string{"test_instance.foo"},
+			applyTargets: []string{"test_instance.foo", "test_instance.bar"},
+			wantWarning:  true,
+		},
+	}
+
+	for name, test := range tests {
+		t.Run(name, func(t *testing.T) {
+			_, snap := testModuleWithSnapshot(t, "apply")
+			plan := testPlan(t)
+			for _, rawTarget := range test.planTargets {
+				target, diags := addrs.ParseTargetStr(rawTarget)
+				if diags.HasErrors() {
+					t.Fatalf("invalid plan target %q: %s", rawTarget, diags.Err())
+				}
+				plan.TargetAddrs = append(plan.TargetAddrs, target.Subject)
+			}
+			planPath := testPlanFile(t, snap, states.NewState(), plan)
+			statePath := testTempFile(t)
+
+			p := applyFixtureProvider()
+			view, done := testView(t)
+			c := &ApplyCommand{
+				Meta: Meta{
+					testingOverrides: metaOverridesForProvider(p),
+					View:             view,
+				},
+			}
+
+			args := []string{"-no-color", "-state-out", statePath}
+			for _, target := range test.applyTargets {
+				args = append(args, "-target", target)
+			}
+			args = append(args, planPath)
+
+			code := c.Run(args)
+			output := done(t)
+			if code != 0 {
+				t.Fatalf("unexpected exit code %d:\n\n%s", code, output.All())
+			}
+
+			gotWarning := strings.Contains(output.Stdout(), `Warning: Can't change resource targeting when applying a saved plan`)
+			if gotWarning != test.wantWarning {
+				t.Fatalf("unexpected targeting warning result (got %t, want %t):\n%s", gotWarning, test.wantWarning, output.All())
+			}
+		})
+	}
+}
+
 // we should be able to apply a plan file with no other file dependencies
 func TestApply_planNoModuleFiles(t *testing.T) {
 	// temporary data directory which we can remove between commands
```

---

### Incident Patch 8: `afd3c002` (2026-09-21)
**Commit Message**: fix(funcs): textdecodebase64 no longer returns an error on valid utf-8 (#39256)

This is a focused fix for #39228:
- Valid UTF-8 containing literal U+FFFD is accepted.
- Malformed UTF-8 remains rejected, including malformed bytes adjacent to literal U+FFFD.

**File**: `.changes/v1.18/BUG FIXES-20260921-100042.yaml` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+kind: BUG FIXES
+body: '`textdecodebase64`: Accept valid UTF-8 strings containing the U+FFFD replacement character'
+time: 2026-09-21T10:00:42.4014-04:00
+custom:
+    Issue: "39256"
```

**File**: `internal/lang/funcs/encoding.go` (modified, +6/-0)
```diff
@@ -171,6 +171,12 @@ var TextDecodeBase64Func = function.New(&function.Spec{
 			}
 
 		}
+		if encName == "UTF-8" {
+			if !utf8.Valid(sDec) {
+				return cty.UnknownVal(cty.String), function.NewArgErrorf(0, "the given string contains symbols that are not defined for %s", encName)
+			}
+			return cty.StringVal(string(sDec)), nil
+		}
 
 		decoder := encoding.NewDecoder()
 		decoded, err := decoder.Bytes(sDec)
```

**File**: `internal/lang/funcs/encoding_test.go` (modified, +12/-0)
```diff
@@ -301,6 +301,18 @@ func TestBase64TextDecode(t *testing.T) {
 			cty.StringVal("abc123!?$*&()'-=@~"),
 			``,
 		},
+		{
+			cty.StringVal("Y2Fm77+9"), // "caf\ufffd" in UTF-8
+			cty.StringVal("UTF-8"),
+			cty.StringVal("caf\ufffd"),
+			``,
+		},
+		{
+			cty.StringVal("77+9/w=="), // literal U+FFFD followed by invalid UTF-8
+			cty.StringVal("UTF-8"),
+			cty.UnknownVal(cty.String).RefineNotNull(),
+			`the given string contains symbols that are not defined for UTF-8`,
+		},
 		{
 			cty.StringVal("YQBiAGMAMQAyADMAIQA/ACQAKgAmACgAKQAnAC0APQBAAH4A"),
 			cty.StringVal("UTF-16LE"),
```

---

### Incident Patch 9: `6a34d000` (2026-09-14)
**Commit Message**: Merge pull request #39195 from hashicorp/sebasslash/sync-query-policy-help-bugfix

query: forward-port -policies help text and experimental cleanup to main

**File**: `.changes/footer-with-experiments.md` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@ Experiments are only enabled in alpha releases of Terraform CLI. The following f
 - `terraform test`: `backend` blocks and `skip_cleanup` attributes:
   - Test authors can now specify `backend` blocks within `run` blocks in Terraform Test files. Run blocks with `backend` blocks will load state from the specified backend instead of starting from empty state on every execution. This allows test authors to keep long-running test infrastructure alive between test operations, saving time during regular test operations.
   - Test authors can now specify `skip_cleanup` attributes within test files and within run blocks. The `skip_cleanup` attribute tells `terraform test` not to clean up state files produced by run blocks with this attribute set to true. The state files for affected run blocks will be written to disk within the `.terraform` directory, where they can then be cleaned up manually using the also experimental `terraform test cleanup` command.
-- `terraform query`: The experimental `-policies` flag permits specifying one or more policy set directory paths to evaluate policies against resources discovered by list blocks during a query operation.
 
 ## Previous Releases
 
```

**File**: `internal/command/arguments/query.go` (modified, +0/-1)
```diff
@@ -22,7 +22,6 @@ type Query struct {
 	// be written to.
 	GenerateConfigPath string
 
-	// EXPERIMENTAL
 	// PolicyPaths contains optional paths to policy set directories that should
 	// be evaluated during this query operation.
 	PolicyPaths []string
```

**File**: `internal/command/arguments/query_test.go` (modified, +12/-0)
```diff
@@ -30,6 +30,18 @@ func TestParseQuery_policies(t *testing.T) {
 			args:         []string{"-policies=/path/one", "-policies=/path/two"},
 			wantPolicies: []string{"/path/one", "/path/two"},
 		},
+		"double dash equals syntax": {
+			args:         []string{"--policies=/some/path"},
+			wantPolicies: []string{"/some/path"},
+		},
+		"double dash space syntax": {
+			args:         []string{"--policies", "/some/path"},
+			wantPolicies: []string{"/some/path"},
+		},
+		"mixed spellings preserve path order": {
+			args:         []string{"--policies=/path/one", "-policies", "/path/two", "--policies", "/path/one"},
+			wantPolicies: []string{"/path/one", "/path/two", "/path/one"},
+		},
 	}
 
 	for name, tc := range testCases {
```

**File**: `internal/command/query.go` (modified, +5/-0)
```diff
@@ -34,6 +34,11 @@ Query Customization Options:
 
   The following options customize how Terraform will run the query.
 
+  -policies=path        Evaluate policies from a policy set directory against
+                        resources discovered by the query. Use this option more
+                        than once to include multiple policy set paths.
+                        The equivalent --policies=path spelling is also supported.
+
   -var 'foo=bar'        Set a value for one of the input variables in the query
                         file of the configuration. Use this option more than
                         once to set more than one variable.
```

**File**: `internal/command/query_test.go` (modified, +18/-27)
```diff
@@ -315,30 +315,24 @@ func TestQueryCommand_Validate(t *testing.T) {
 	missingPath := filepath.Join(t.TempDir(), "does-not-exist")
 
 	tests := []struct {
-		name             string
-		policyPaths      []string
-		allowExperiments bool
-		wantDiags        tfdiags.Diagnostics
+		name        string
+		policyPaths []string
+		wantDiags   tfdiags.Diagnostics
 	}{
 		{
-			name:             "no policies, flag omitted",
-			policyPaths:      nil,
-			allowExperiments: true,
+			name: "no policies, flag omitted",
 		},
 		{
-			name:             "single valid path",
-			policyPaths:      []string{td},
-			allowExperiments: true,
+			name:        "single valid path",
+			policyPaths: []string{td},
 		},
 		{
-			name:             "multiple valid paths",
-			policyPaths:      []string{td, td2},
-			allowExperiments: true,
+			name:        "multiple valid paths",
+			policyPaths: []string{td, td2},
 		},
 		{
-			name:             "non-existent path",
-			policyPaths:      []string{missingPath},
-			allowExperiments: true,
+			name:        "non-existent path",
+			policyPaths: []string{missingPath},
 			wantDiags: tfdiags.Diagnostics{
 				tfdiags.Sourceless(
 					tfdiags.Error,
@@ -351,7 +345,7 @@ func TestQueryCommand_Validate(t *testing.T) {
 
 	for _, tc := range tests {
 		t.Run(tc.name, func(t *testing.T) {
-			cmd := &QueryCommand{Meta: Meta{AllowExperimentalFeatures: tc.allowExperiments}}
+			cmd := &QueryCommand{}
 			got := cmd.Validate(&arguments.Query{PolicyPaths: tc.policyPaths})
 			if tc.wantDiags == nil {
 				tfdiags.AssertNoDiagnostics(t, got)
@@ -398,8 +392,7 @@ func TestQueryCommand_policyClientRouting(t *testing.T) {
 
 			client := policy.NewTestMockClient(t)
 			cmd := &QueryCommand{Meta: Meta{
-				AllowExperimentalFeatures: true,
-				testingOverrides:          &testingOverrides{PolicyClient: client},
+				testingOverrides: &testingOverrides{PolicyClient: client},
 			}}
 			op := &backendrun.Operation{PolicyPaths: tc.policyPaths}
 			stop := cmd.configureQueryPolicyClient(be, op)
@@ -678,10 +671,9 @@ func TestQueryPolicyStatusReporting(t *testing.T) {
 	overrides.PolicyClient = policyClient
 	view, done := testView(t)
 	meta := Meta{
-		testingOverrides:          overrides,
-		View:                      view,
-		AllowExperimentalFeatures: true,
-		ProviderSource:            providerSource,
+		testingOverrides: overrides,
+		View:             view,
+		ProviderSource:   providerSource,
 	}
 
 	init := &InitCommand{Meta: meta}
@@ -794,10 +786,9 @@ func TestQueryPolicyStatusReporting_NoPoliciesArgument(t *testing.T) {
 	overrides.PolicyClient = policyClient
 	view, done := testView(t)
 	meta := Meta{
-		testingOverrides:          overrides,
-		View:                      view,
-		AllowExperimentalFeatures: true,
-		ProviderSource:            providerSource,
+		testingOverrides: overrides,
+		View:             view,
+		ProviderSource:   providerSource,
 	}
 
 	init := &InitCommand{Meta: meta}
```

---

### Incident Patch 10: `e2ccc1d4` (2026-09-11)
**Commit Message**: PSS: Fix provider schema caching issue so `state migrate` can handle two versions of the same provider with schema differences. (#39128)

This change adds a test that fails without cache clearing. The test shows the older provider's schema impacts using an updated schema, as the older schema version in the cache overrides Terraform learning about the newer schema:

In the test, the older provider version has a attribute called `attr_v1`, while the newer provider version replaces that attribute with one called `attr_v2`. Without changes to how we use the cache, the test fails due to the config including attr_v2 but the schema expecting attr_v1, despite using the newer provider version. This is due to the provider cache interfering.

In the `state migrate` command I've added code that invokes a method to clear the schema cache _only_ if an upgrade is in progress. This means the schema cache is only cleared in the circumstances where it causes an issue.

**File**: `internal/command/e2etest/pluggable_state_store_test.go` (modified, +154/-0)
```diff
@@ -16,6 +16,8 @@ import (
 	"github.com/google/go-cmp/cmp"
 	"github.com/hashicorp/go-version"
 	"github.com/hashicorp/terraform/internal/addrs"
+	"github.com/hashicorp/terraform/internal/command"
+	"github.com/hashicorp/terraform/internal/command/clistate"
 	"github.com/hashicorp/terraform/internal/depsfile"
 	"github.com/hashicorp/terraform/internal/e2e"
 	"github.com/hashicorp/terraform/internal/getproviders"
@@ -412,6 +414,158 @@ func TestPrimary_stateStore_stateMigrateCmd_upgrade(t *testing.T) {
 	}
 }
 
+// Test using `terraform state migrate` subcommand when upgrade changes the provider's schema.
+func TestPrimary_stateStore_stateMigrateCmd_upgradeWithSchemaChange(t *testing.T) {
+	t.Parallel()
+	if !canRunGoBuild {
+		// We're running in a separate-build-then-run context, so we can't
+		// currently execute this test which depends on being able to build
+		// new executable at runtime.
+		//
+		// (See the comment on canRunGoBuild's declaration for more information.)
+		t.Skip("can't run without building a new provider executable")
+	}
+
+	fixturePath := filepath.Join("testdata", "state-migrate-upgrade-2")
+
+	tf := e2e.NewBinary(t, experimentalTerraformBin, fixturePath)
+
+	// Load old state for comparison
+	oldStatePath := filepath.Join(tf.WorkDir(), "v1.tfstate.d", "default", "terraform.tfstate")
+	oldStateFile, err := os.Open(oldStatePath)
+	t.Cleanup(func() { oldStateFile.Close() })
+	if err != nil {
+		t.Fatal(err)
+	}
+	oldState, err := statefile.Read(oldStateFile)
+	oldStateFile.Close()
+	if err != nil {
+		t.Fatalf("err: %s", err)
+	}
+
+	// setup FS mirror
+	tmpDir := t.TempDir()
+	mirrorPath := filepath.Join(tmpDir, "mirror")
+	cliCfgFilePath := filepath.Join(tmpDir, "test.tfrc")
+	cfgBody := fmt.Sprintf(`provider_installation {
+  filesystem_mirror {
+    path    = %q
+    include = ["registry.terraform.io/hashicorp/simple6"]
+  }
+  direct {
+    exclude = ["registry.terraform.io/hashicorp/simple6"]
+  }
+}
+`, mirrorPath)
+	os.WriteFile(cliCfgFilePath, []byte(cfgBody), 0o700)
+	tf.AddEnv("TF_CLI_CONFIG_FILE=" + cliCfgFilePath)
+
+	// In order to test integration with PSS we need two provider plugins implementing a state store
+	// which we can tell apart to be able to verify successful upgrade between them.
+	//
+	// To do this we'll change the name of an attribute in the state store implementation's schema at
+	// build time.
+	platform := getproviders.CurrentPlatform.String()
+	// Build v1.0.0 plugin
+	simpleProviderv1 := filepath.Join(t.TempDir(), "terraform-provider-simple6")
+	simpleProviderv1Exe := e2e.GoBuild("github.com/hashicorp/terraform/internal/provider-simple-v6/main",
+		simpleProviderv1, "-ldflags", "-X 'github.com/hashicorp/terraform/internal/provider-simple-v6.attributeName=attr_v1'")
+	providerv1MirrorPath := filepath.Join(mirrorPath, "registry.terraform.io", "hashicorp", "simple6", "1.0.0")
+	if err := os.MkdirAll(filepath.Join(providerv1MirrorPath, platform), os.ModePerm); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.Rename(simpleProviderv1Exe, filepath.Join(providerv1MirrorPath, platform, "terraform-provider-simple6")); err != nil {
+		t.Fatal(err)
+	}
+	// Build v2.0.0 plugin
+	simpleProviderv2 := filepath.Join(t.TempDir(), "terraform-provider-simple6")
+	simpleProviderv2Exe := e2e.GoBuild("github.com/hashicorp/terraform/internal/provider-simple-v6/main",
+		simpleProviderv2, "-ldflags", "-X 'github.com/hashicorp/terraform/internal/provider-simple-v6.attributeName=attr_v2'")
+	providerv2MirrorPath := filepath.Join(mirrorPath, "registry.terraform.io", "hashicorp", "simple6", "2.0.0")
+	if err := os.MkdirAll(filepath.Join(providerv2MirrorPath, platform), os.ModePerm); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.Rename(simpleProviderv2Exe, filepath.Join(providerv2MirrorPath, platform, "terraform-provider-simple6")); err != nil {
+		t.Fatal(err)
+	}
+
+	stdout, stderr, err := tf.Run("state", "migrate", "-upgrade", "-input=false", "-force-copy", "-no-color")
+	if err != nil {
+		t
```

**File**: `internal/command/e2etest/providers_schema_test.go` (modified, +11/-2)
```diff
@@ -275,10 +275,19 @@ func TestProvidersSchema(t *testing.T) {
                     "version":0,
                     "block": {
                         "attributes": {
-                            "workspace_dir": {
+                            "default": {
                                 "type":"string",
-                                "description":"The directory where state files will be created. When unset the value will default to terraform.tfstate.d","description_kind":"plain","optional":true}
+                                "description":"A non-functional attribute whose name can be changed at build time to enable E2E tests using different provider versions, shown by changing schemas. The default attribute name is 'default'.",
+                                "description_kind":"plain",
+                                "optional":true
                             },
+                            "workspace_dir": {
+                                "type":"string",
+                                "description":"The directory where state files will be created. When unset the value will default to terraform.tfstate.d",
+                                "description_kind":"plain",
+                                "optional":true
+                            }
+                        },
                         "description_kind":"plain"
                     }
                 },
```

**File**: `internal/command/e2etest/testdata/state-migrate-upgrade-2/.terraform.lock.hcl` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+# This file is maintained automatically by "terraform init".
+# Manual edits may be lost in future updates.
+
+provider "registry.terraform.io/hashicorp/simple6" {
+  version = "1.0.0"
+}
```

**File**: `internal/command/e2etest/testdata/state-migrate-upgrade-2/upgrade-from.tfmigrate.hcl` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+state_store_provider {
+  simple6 = {
+    source  = "registry.terraform.io/hashicorp/simple6"
+    version = "1.0.0"
+  }
+}
+
+from {
+  state_store "simple6_fs" {
+    provider "simple6" {}
+
+    workspace_dir = "v1.tfstate.d"
+    attr_v1 = "foobar" # Attribute name set as 'attr_v1' during build
+  }
+}
+
```

**File**: `internal/command/e2etest/testdata/state-migrate-upgrade-2/upgrade-to.tf` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+terraform {
+  required_providers {
+    simple6 = {
+      source  = "registry.terraform.io/hashicorp/simple6"
+      version = "2.0.0"
+    }
+  }
+
+  state_store "simple6_fs" {
+    provider "simple6" {}
+
+    workspace_dir = "v2.tfstate.d"
+    attr_v2       = "foobar" # Attribute name set as 'attr_v2' during build
+  }
+}
+
+variable "name" {
+  default = "world"
+}
+
+resource "terraform_data" "my-data" {
+  input = "hello ${var.name}"
+}
```

#### Recent Merged Pull Requests:
- **PR #39313** (2026-09-30): Prepare for 1.16.5 release (@hc-github-team-tf-core)
- **PR #39312** (closed): Error on depends_on referencing an undeclared module output (@aniketatgithub)
- **PR #39308** (2026-09-29): test: Add `fmt` tests that define current behaviour (@SarahFrench)
- **PR #39307** (2026-09-29): move timed command tests to synctest (@jbardin)
- **PR #39297** (closed): terraform test: allow overriding provider versions (@Salman167)
- **PR #39296** (2026-09-25): Backport of apply: send prior BeforeIdentity instead of planned (null) identity when destroying or forgetting a resource into v1.17 (@github-actions[bot])
- **PR #39295** (2026-09-25): Backport of apply: send prior BeforeIdentity instead of planned (null) identity when destroying or forgetting a resource into v1.16 (@github-actions[bot])
- **PR #39294** (2026-09-25): apply: send prior BeforeIdentity instead of planned (null) identity when destroying or forgetting a resource (@mildwonkey)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
