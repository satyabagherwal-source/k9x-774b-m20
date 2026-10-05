# Forensic Learning Record (Deep Inspection): DNSControl/dnscontrol

> **Canonical Artifact**: `07_PROJECT_LEARNING/dnscontrol-dnscontrol-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DNSControl/dnscontrol](https://github.com/DNSControl/dnscontrol))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:33:12.783Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DNSControl/dnscontrol`
- **Description**: Infrastructure as code for DNS!
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3960 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `commands/cmdzonecache.go`
```
package commands

import "github.com/DNSControl/dnscontrol/v5/pkg/providers"

// FYI(tlim): This file was originally called zonecache.go. To remove any
// confusion between it and pkg/zonecache, we've renamed it. We've also added
// "cmd" or "Cmd" to various labels too.

// NewCmdZoneCache creates a zoneCache.
func NewCmdZoneCache() *CmdZoneCache {
	return &CmdZoneCache{}
}

func (zc *CmdZoneCache) zoneList(name string, lister providers.ZoneLister) (*[]string, error) {
	zc.Lock()
	defer zc.Unlock()

	if zc.cache == nil {
		zc.cache = map[string]*[]string{}
	}

	if v, ok := zc.cache[name]; ok {
		return v, nil
	}

	zones, err := lister.ListZones()
	if err != nil {
		return nil, err
	}
	zc.cache[name] = &zones
	return &zones, nil
}

```

### Core Architecture Module: `commands/commands.go`
```
package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/DNSControl/dnscontrol/v5/models"
	"github.com/DNSControl/dnscontrol/v5/pkg/diff2"
	"github.com/DNSControl/dnscontrol/v5/pkg/js"
	"github.com/DNSControl/dnscontrol/v5/pkg/printer"
	"github.com/DNSControl/dnscontrol/v5/pkg/version"
	"github.com/fatih/color"
	"github.com/urfave/cli/v3"
)

// categories of commands.
const (
	catMain  = "\b main" // screwed up to alphebatize first
	catDebug = "debug"
	catUtils = "utility"
)

var commands = []*cli.Command{}

func commandNotFound(ctx context.Context, c *cli.Command, command string) {
	fmt.Fprintf(c.Root().ErrWriter, "Unknown command: %s\n", command)
	cli.OsExiter(1)
}

func cmd(cat string, c *cli.Command) bool {
	c.Category = cat
	commands = append(commands, c)
	return true
}

var _ = cmd(catDebug, &cli.Command{
	Name:  "version",
	Usage: "Print version information",
	Action: func(ctx context.Context, c *cli.Command) error {
		_, err := fmt.Println(version.Version())
		return err
	},
})

// Run will execute the CLI.
func Run(v string) int {
	cli.VersionFlag = &cli.BoolFlag{
		Name:    "version",
		Aliases: []string{"V"},
		Usage:   "print the version",
	}

	app := &cli.Command{
		Name:    "dnscontrol",
		Usage:   "DNSControl is a compiler and DSL for managing dns zones",
		Version: v,
	}
	app.CommandNotFound = commandNotFound
	app.Flags = []cli.Flag{
		&cli.BoolFlag{
			Name:        "debug",
			Usage:       "Enable debug logging",
			Destination: &printer.DefaultPrinter.Verbose,
		},
		&cli.BoolFlag{
			Name:        "allow-fetch",
			Usage:       "Enable JS fetch(), dangerous on untrusted code!",
			Destination: &js.EnableFetch,
		},
		&cli.BoolFlag{
			Name:   "diff2",
			Usage:  "Obsolete flag. Will be removed in v5 or later",
			Hidden: true,
			Action: func(ctx context.Context, c *cli.Command, v bool) error {
				pobsoleteDiff2FlagUsed = true
				return nil
			},
		},
		&cli.BoolFlag{
			Name:        "disableordering",
			Usage:       "Disables update reordering",
			Destination: &diff2.DisableOrdering,
		},
		&cli.BoolFlag{
			Name:        "no-colors",
			Usage:       "Disable colors",
			Destination: &color.NoColor,
			Value:       false,
		},
		&cli.BoolFlag{
			Name:   "generate-bash-completion",
			Usage:  "Generate bash completion",
			Hidden: true,
		},
	}
	app.Before = func(ctx context.Context, c *cli.Command) (context.Context, error) {
		// In v2, EnableBashCompletion would automatically add this flag and trigger completion.
		// In v3, we need to handle it manually.
		// Only handle at root level - subcommands like shell-completion will handle their own.
		if c.Bool("generate-bash-completion") && c.Root() == c {
			if c.Root().ShellComplete != nil {
				c.Root().ShellComplete(ctx, c)
			}
			return ctx, cli.Exit("", 0)
		}
		return ctx, nil
	}
	sort.Slice(commands, func(i, j int) bool {
		return commands[i].Name < commands[j].Name
	})
	app.Commands = commands
	app.ShellComplete = func(ctx context.Context, c *cli.Command) {
		// ripped from cli.DefaultCompleteWithFlags
		var lastArg string

		if len(os.Args) > 2 {
			lastArg = os.Args[len(os.Args)-2]
		}

		if lastArg != "" {
			if strings.HasPrefix(lastArg, "-") {
				if !islastFlagComplete(lastArg, app.Flags) {
					dnscontrolPrintFlagSuggestions(lastArg, app.Flags, c.Writer)
					return
				}
			}
		}
		dnscontrolPrintCommandSuggestions(app.Commands, c.Writer)
	}
	if err := app.Run(context.Background(), os.Args); err != nil {
		return 1
	}
	return 0
}

// Shared config types

// GetDNSConfigArgs contains what we need to get a valid dns config.
// Could come from parsing js, or from stored json.
type GetDNSConfigArgs struct {
	ExecuteDSLArgs
	JSONFile string
}

func (args *GetDNSConfigArgs) flags() []cli.Flag {
	return append(args.ExecuteDSLArgs.flags(),
		&cli.StringFlag{
			Destination: &args.JSONFile,
			Name:        "ir",
			Usage:       "Read IR (json) directly from this file. Do not process DSL at all",
		},
		&cli.StringFlag{
			Destination: &args.JSONFile,
			Name:        "json",
			Hidden:      true,
			Usage:       "same as -ir. only here for backwards compatibility, hence hidden",
		},
	)
}

// GetDNSConfig reads the json-formatted IR file. Or executes javascript. All depending on flags provided.
func GetDNSConfig(args GetDNSConfigArgs) (*models.DNSConfig, error) {
	var err error
	cfg := &models.DNSConfig{}

	if args.JSONFile == "" {
		// No IR file specified. Generate the IR by running dnsconfig.json
		// as normal.
		cfg, err = ExecuteDSL(args.ExecuteDSLArgs)
		if err != nil {
			return nil, err
		}
	} else {
		// Read an IR file.
		f, err := os.Open(args.JSONFile)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		dec := json.NewDecoder(f)
		if err = dec.Decode(cfg); err != nil {
			return nil, err
		}
	}

	return preloadProviders(cfg)
}

// the json only contains provider names inside domains. This denormalizes the data for more
// convenient access patterns. Does everything we need to prepare for the validation phase, but
// cannot do anything that requires the credentials file yet.
func preloadProviders(cfg *models.DNSConfig) (*models.DNSConfig, error) {
	// build name to type maps
	cfg.RegistrarsByName = map[string]*models.RegistrarConfig{}
	cfg.DNSProvidersByName = map[string]*models.DNSProviderConfig{}
	for _, reg := range cfg.Registrars {
		cfg.RegistrarsByName[reg.Name] = reg
	}
	for _, p := range cfg.DNSProviders {
		cfg.DNSProvidersByName[p.Name] = p
	}
	// make registrar and dns provider shims. Include name, type, and other metadata, but can't instantiate
	// driver until we load creds in later
	for _, d := range cfg.Domains {
		reg, ok := cfg.RegistrarsByName[d.RegistrarName]
		if !ok {
			return nil, fmt.Errorf("registrar named %s expected for %s, but never registered", d.RegistrarName, d.Name)
		}
		d.RegistrarInstance = &models.RegistrarInstance{
			Name:         reg.Name,
			ProviderType: reg.Type,
		}
		for pName, n := range d.DNSProviderNames {
			prov, ok := cfg.DNSProvidersByName[pName]
			if !ok {
				return nil, fmt.Errorf("DNS Provider named %s expected for %s, but never registered", pName, d.Name)
			}
			d.DNSProviderInstances = append(d.DNSProviderInstances, &models.DNSProviderInstance{
				Name:                pName,
				ProviderType:        prov.Type,
				NumberOfNameservers: n,
			})
		}
		// sort so everything is deterministic
		sort.Slice(d.DNSProviderInstances, func(i, j int) bool {
			return d.DNSProviderInstances[i].Name < d.DNSProviderInstances[j].Name
		})
	}
	return cfg, nil
}

// ExecuteDSLArgs are used anytime we need to read and execute dnscontrol DSL.
type ExecuteDSLArgs struct {
	JSFile   string
	JSONFile string
	DevMode  bool
	Variable []string
}

func (args *ExecuteDSLArgs) flags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{
			Name:        "config",
			Value:       "dnsconfig.js",
			Destination: &args.JSFile,
			Usage:       "File containing dns config in javascript DSL",
		},
		&cli.StringFlag{
			Name:        "js",
			Value:       "dnsconfig.js",
			Hidden:      true,
			Destination: &args.JSFile,
			Usage:       "same as config. for back compatibility",
		},
		&cli.BoolFlag{
			Name:        "dev",
			Destination: &args.DevMode,
			Usage:       "Use helpers.js from disk instead of embedded copy",
		},
		&cli.StringSliceFlag{
			Name:        "variable",
			Aliases:     []string{"v"},
			Destination: &args.Variable,
			Usage:       "Add variable that is passed to JS",
		},
	}
}

// PrintJSONArgs are used anytime a command may print some json.
type PrintJSONArgs struct {
	Pretty bool
	Output string
}

func (args *PrintJSONArgs) flags() []cli.Flag {
	return []cli.Flag{
		&cli.BoolFlag{
			Name:        "pretty",
			Destination: &args.Pretty,
			Usage:       "Pretty print IR JSON",
		},
		&cli.StringFlag{
			Name:        "out",
			Destination: &args.Output,
			Usage:       "File to write IR JSON to (default stdout)",
		},
	}
}

// GetCredentialsArgs encapsulates the fl
```

### Core Architecture Module: `commands/completion.go`
```
package commands

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"slices"
	"strings"
	"text/template"
	"unicode/utf8"

	"github.com/urfave/cli/v3"
)

//go:embed completion-scripts/completion.*.gotmpl
var completionScripts embed.FS

type contextKey int

const contextKeyCompletionHandled contextKey = iota

func shellCompletionCommand() *cli.Command {
	supportedShells, templates, err := getCompletionSupportedShells()
	if err != nil {
		panic(err)
	}
	return &cli.Command{
		Name:        "shell-completion",
		Usage:       "generate shell completion scripts",
		ArgsUsage:   fmt.Sprintf("[ %s ]", strings.Join(supportedShells, " | ")),
		Description: fmt.Sprintf("Generate shell completion script for [ %s ]", strings.Join(supportedShells, " | ")),
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:   "generate-bash-completion",
				Usage:  "Generate bash completion",
				Hidden: true,
			},
		},
		Before: func(ctx context.Context, cmd *cli.Command) (context.Context, error) {
			// In v2, EnableBashCompletion would automatically add this flag and trigger completion.
			// In v3, we need to handle it manually.
			// This runs before Action, so we intercept the flag here.
			if cmd.Bool("generate-bash-completion") {
				if cmd.ShellComplete != nil {
					cmd.ShellComplete(ctx, cmd)
				}
				// Mark that we handled completion so Action can skip
				return context.WithValue(ctx, contextKeyCompletionHandled, true), nil
			}
			return ctx, nil
		},
		ShellComplete: func(ctx context.Context, cmd *cli.Command) {
			for _, shell := range supportedShells {
				if strings.HasPrefix(shell, cmd.Args().First()) {
					if _, err := cmd.Root().Writer.Write([]byte(shell + "\n")); err != nil {
						panic(err)
					}
				}
			}
		},
		Action: func(ctx context.Context, cmd *cli.Command) error {
			// If completion was handled in Before, skip normal action
			if ctx.Value(contextKeyCompletionHandled) != nil {
				return nil
			}

			var inputShell string
			if inputShell = cmd.Args().First(); inputShell == "" {
				if inputShell = os.Getenv("SHELL"); inputShell == "" {
					return cli.Exit(errors.New("shell not specified"), 1)
				}
			}
			shellName := path.Base(inputShell) // necessary if using $SHELL, noop otherwise
			//fmt.Printf("DEBUG: shellName = %q\n", shellName)

			template := templates[shellName]
			if template == nil {
				return cli.Exit(fmt.Errorf("unknown shell: %s", inputShell), 1)
			}

			err = template.Execute(cmd.Root().Writer, struct {
				App *cli.Command
			}{cmd.Root()})
			if err != nil {
				return cli.Exit(fmt.Errorf("failed to print completion script: %w", err), 1)
			}
			return nil
		},
	}
}

var _ = cmd(catUtils, shellCompletionCommand())

// getCompletionSupportedShells returns a list of shells with available completions.
// The list is generated from the embedded completion scripts.
func getCompletionSupportedShells() (shells []string, shellCompletionScripts map[string]*template.Template, err error) {
	scripts, err := completionScripts.ReadDir("completion-scripts")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read completion scripts: %w", err)
	}

	shellCompletionScripts = make(map[string]*template.Template)

	for _, f := range scripts {
		fNameWithoutExtension := strings.TrimSuffix(f.Name(), ".gotmpl")
		shellName := strings.TrimPrefix(path.Ext(fNameWithoutExtension), ".")

		content, err := completionScripts.ReadFile(path.Join("completion-scripts", f.Name()))
		if err != nil {
			return nil, nil, fmt.Errorf("failed to read completion script %s", f.Name())
		}

		t := template.New(shellName)
		t, err = t.Parse(string(content))
		if err != nil {
			return nil, nil, fmt.Errorf("failed to parse template %s", f.Name())
		}

		shells = append(shells, shellName)
		shellCompletionScripts[shellName] = t
	}
	return shells, shellCompletionScripts, nil
}

func dnscontrolPrintCommandSuggestions(commands []*cli.Command, writer io.Writer) {
	for _, command := range commands {
		if command.Hidden {
			continue
		}
		if strings.HasSuffix(os.Getenv("SHELL"), "zsh") {
			for _, name := range command.Names() {
				_, _ = fmt.Fprintf(writer, "%s:%s\n", name, command.Usage)
			}
		} else {
			for _, name := range command.Names() {
				_, _ = fmt.Fprintf(writer, "%s\n", name)
			}
		}
	}
}

func dnscontrolCliArgContains(flagName string) bool {
	for name := range strings.SplitSeq(flagName, ",") {
		name = strings.TrimSpace(name)
		count := min(utf8.RuneCountInString(name), 2)
		flag := fmt.Sprintf("%s%s", strings.Repeat("-", count), name)
		if slices.Contains(os.Args, flag) {
			return true
		}
	}
	return false
}

func dnscontrolPrintFlagSuggestions(lastArg string, flags []cli.Flag, writer io.Writer) {
	cur := strings.TrimPrefix(lastArg, "-")
	cur = strings.TrimPrefix(cur, "-")
	for _, flag := range flags {
		if bflag, ok := flag.(*cli.BoolFlag); ok && bflag.Hidden {
			continue
		}
		for _, name := range flag.Names() {
			name = strings.TrimSpace(name)
			// this will get total count utf8 letters in flag name
			count := min(utf8.RuneCountInString(name),
				// reuse this count to generate single - or -- in flag completion
				2)
			// if flag name has more than one utf8 letter and last argument in cli has -- prefix then
			// skip flag completion for short flags example -v or -x
			if strings.HasPrefix(lastArg, "--") && count == 1 {
				continue
			}
			// match if last argument matches this flag and it is not repeated
			if strings.HasPrefix(name, cur) && cur != name && !dnscontrolCliArgContains(name) {
				flagCompletion := fmt.Sprintf("%s%s", strings.Repeat("-", count), name)
				_, _ = fmt.Fprintln(writer, flagCompletion)
			}
		}
	}
}

func islastFlagComplete(lastArg string, flags []cli.Flag) bool {
	cur := strings.TrimPrefix(lastArg, "-")
	cur = strings.TrimPrefix(cur, "-")
	for _, flag := range flags {
		for _, name := range flag.Names() {
			name = strings.TrimSpace(name)
			if strings.HasPrefix(name, cur) && cur != name && !dnscontrolCliArgContains(name) {
				return false
			}
		}
	}
	return true
}

```

### Core Architecture Module: `commands/createDomains.go`
```
package commands

import (
	"context"
	"fmt"

	"github.com/DNSControl/dnscontrol/v5/pkg/credsfile"
	"github.com/DNSControl/dnscontrol/v5/pkg/providers"
	"github.com/urfave/cli/v3"
)

var _ = cmd(catUtils, func() *cli.Command {
	var args CreateDomainsArgs
	return &cli.Command{
		Name:  "create-domains",
		Usage: "DEPRECATED: Ensures that all domains in your configuration are activated at their Domain Service Provider (This does not purchase the domain or otherwise interact with Registrars.)",
		Action: func(ctx context.Context, c *cli.Command) error {
			return exit(CreateDomains(args))
		},
		Flags: args.flags(),
		Before: func(ctx context.Context, c *cli.Command) (context.Context, error) {
			fmt.Println("DEPRECATED: This command is deprecated. The domain is automatically created at the Domain Service Provider during the push command.")
			fmt.Println("DEPRECATED: To prevent disable auto-creating, use --no-populate with the push command.")
			return ctx, nil
		},
	}
}())

// CreateDomainsArgs args required for the create-domain subcommand.
type CreateDomainsArgs struct {
	GetDNSConfigArgs
	GetCredentialsArgs
}

func (args *CreateDomainsArgs) flags() []cli.Flag {
	flags := args.GetDNSConfigArgs.flags()
	flags = append(flags, args.GetCredentialsArgs.flags()...)
	return flags
}

// CreateDomains contains all data/flags needed to run create-domains, independently of CLI.
func CreateDomains(args CreateDomainsArgs) error {
	cfg, err := GetDNSConfig(args.GetDNSConfigArgs)
	if err != nil {
		return err
	}
	providerConfigs, err := credsfile.LoadProviderConfigs(args.CredsFile)
	if err != nil {
		return err
	}
	_, err = InitializeProviders(cfg, providerConfigs, false)
	if err != nil {
		return err
	}
	for _, domain := range cfg.Domains {
		fmt.Println("*** ", domain.Name)
		for _, provider := range domain.DNSProviderInstances {
			if creator, ok := provider.Driver.(providers.ZoneCreator); ok {
				fmt.Println("  -", provider.Name)
				err := creator.EnsureZoneExists(domain)
				if err != nil {
					fmt.Printf("Error creating domain: %s\n", err)
				}
			}
		}
	}
	return nil
}

```

### Core Architecture Module: `commands/fmt.go`
```
package commands

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/ditashi/jsbeautifier-go/jsbeautifier"
	"github.com/urfave/cli/v3"
)

var _ = cmd(catUtils, func() *cli.Command {
	var args FmtArgs
	return &cli.Command{
		Name:  "fmt",
		Usage: "[BETA] Format and prettify a given file",
		Action: func(ctx context.Context, c *cli.Command) error {
			return exit(FmtFile(args))
		},
		Flags: args.flags(),
	}
}())

// FmtArgs stores arguments related to the fmt subcommand.
type FmtArgs struct {
	InputFile  string
	OutputFile string
	Verbose    bool
}

func (args *FmtArgs) flags() []cli.Flag {
	var flags []cli.Flag
	flags = append(flags, &cli.StringFlag{
		Name:        "input",
		Aliases:     []string{"i"},
		Value:       "dnsconfig.js",
		Usage:       "Input file",
		Destination: &args.InputFile,
	})
	flags = append(flags, &cli.StringFlag{
		Name:        "output",
		Aliases:     []string{"o"},
		Value:       "dnsconfig.js",
		Usage:       "Output file",
		Destination: &args.OutputFile,
	})
	flags = append(flags, &cli.BoolFlag{
		Name:        "verbose",
		Aliases:     []string{"v"},
		Value:       false,
		Usage:       "Enable verbose output",
		Destination: &args.Verbose,
	})
	return flags
}

// FmtFile reads and formats a file.
func FmtFile(args FmtArgs) error {
	var fileBytes []byte
	if args.InputFile == "" {
		var err error
		fileBytes, err = io.ReadAll(os.Stdin)
		if err != nil {
			return err
		}
	} else {
		var err error
		fileBytes, err = os.ReadFile(args.InputFile)
		if err != nil {
			return err
		}
	}
	original := string(fileBytes)

	opts := jsbeautifier.DefaultOptions()
	beautified, beautifyErr := jsbeautifier.Beautify(&original, opts)
	if beautifyErr != nil {
		return beautifyErr
	}

	beautified = strings.TrimSpace(beautified)
	if len(beautified) != 0 {
		beautified = beautified + "\n"
	}

	if args.OutputFile == "" {
		fmt.Print(beautified)
	} else {
		changed := original != beautified
		if changed {
			if err := os.WriteFile(args.OutputFile, []byte(beautified), 0o744); err != nil {
				return err
			}
		}
		if args.Verbose || changed {
			if changed {
				fmt.Fprintf(os.Stderr, "%s (formatted)\n", args.OutputFile)
			} else {
				fmt.Fprintf(os.Stderr, "%s (unchanged)\n", args.OutputFile)
			}
		}
	}
	return nil
}

```

### Core Architecture Module: `commands/getZones.go`
```
package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/DNSControl/dnscontrol/v5/models"
	"github.com/DNSControl/dnscontrol/v5/pkg/credsfile"
	"github.com/DNSControl/dnscontrol/v5/pkg/prettyzone"
	"github.com/DNSControl/dnscontrol/v5/pkg/providers"
	"github.com/urfave/cli/v3"
)

var _ = cmd(catUtils, func() *cli.Command {
	var args GetZoneArgs
	return &cli.Command{
		Name:    "get-zones",
		Aliases: []string{"get-zone"},
		Usage:   "gets a zone from a provider (stand-alone)",
		Action: func(ctx context.Context, c *cli.Command) error {
			if c.NArg() < 2 {
				return cli.Exit("Arguments should be: credskey zone(s) (Ex: my_cloudflare example.com)", 1)
			}
			args.CredName = c.Args().Get(0)
			if c.NArg() == 2 || c.Args().Get(1) == "-" {
				args.ProviderName = ""
				if c.Args().Get(1) == "-" {
					args.ZoneNames = c.Args().Slice()[2:]
				} else {
					args.ZoneNames = c.Args().Slice()[1:]
				}
			} else {
				arg1 := c.Args().Get(1)
				if _, ok := providers.DNSProviderTypes[arg1]; ok {
					// Deprecated form: credkey provider zone [...]
					args.ProviderName = arg1
					args.ZoneNames = c.Args().Slice()[2:]
					fmt.Fprintf(os.Stderr, "WARNING: The provider name argument is deprecated. Please use \"dnscontrol get-zones %s %s\" instead. See %q\n",
						args.CredName, strings.Join(args.ZoneNames, " "),
						"https://docs.dnscontrol.org/commands/get-zones",
					)
				} else {
					// New form with multiple zones: credkey zone1 zone2 [...]
					args.ProviderName = ""
					args.ZoneNames = c.Args().Slice()[1:]
				}
			}

			return exit(GetZone(args))
		},
		Flags:     args.flags(),
		UsageText: "dnscontrol get-zones [command options] credkey zone [...]",
		Description: `Download a zone from a provider.  This is a stand-alone utility.

ARGUMENTS:
   credkey:  The name used in creds.json
   zone:     One or more zones (domains) to download; or "all".

EXAMPLES:
   dnscontrol get-zones my_route53 example.com
   dnscontrol get-zones my_gandi example.com other.com
   dnscontrol get-zones my_cloudflare all
   dnscontrol get-zones --format=tsv my_bind example.com
   dnscontrol get-zones --format=djs --out=draft.js my_gcloud example.com

Documentation: https://docs.dnscontrol.org/commands/get-zones`,
	}
}())

// check-creds foo bar
// is the same as
// get-zones --format=nameonly foo bar all.
var _ = cmd(catUtils, func() *cli.Command {
	var args GetZoneArgs
	return &cli.Command{
		Name:  "check-creds",
		Usage: "Do a small operation to verify credentials (stand-alone)",
		Action: func(ctx context.Context, c *cli.Command) error {
			var arg0, arg1 string
			// This takes one or two command-line args.
			// Starting in v3.16: Using it with 2 args will generate a warning.
			// Starting in v4.0: Using it with 2 args might be an error.
			// After v5.0, it will be an error. (FIXME(tlim): Make it an error)
			if c.NArg() == 1 {
				arg0 = c.Args().Get(0)
				arg1 = ""
			} else if c.NArg() == 2 {
				arg0 = c.Args().Get(0)
				arg1 = c.Args().Get(1)
			} else {
				return cli.Exit("Arguments should be: credskey [providername] (Ex: r53 ROUTE53)", 1)
			}
			args.CredName = arg0
			args.ProviderName = arg1
			args.ZoneNames = []string{"all"}
			args.OutputFormat = "nameonly"
			return exit(GetZone(args))
		},
		Flags:     args.flags(),
		UsageText: "dnscontrol check-creds [command options] credkey provider",
		Description: `Do a trivia operation to verify credentials.  This is a stand-alone utility.

If successful, a list of zones will be output. If not, hopefully you
see verbose error messages.

ARGUMENTS:
   credkey:  The name used in creds.json (first parameter to NewDnsProvider() in dnsconfig.js)
   provider: The name of the provider (second parameter to NewDnsProvider() in dnsconfig.js)

EXAMPLES:
   dnscontrol check-creds myr53 ROUTE53      # Pre v3.16, or pre-v4.0 for backwards-compatibility
   dnscontrol check-creds myr53
   dnscontrol check-creds --out=/dev/null myr53 && echo Success

Documentation: https://docs.dnscontrol.org/commands/check-creds`,
	}
}())

// GetZoneArgs args required for the create-domain subcommand.
type GetZoneArgs struct {
	GetCredentialsArgs          // Args related to creds.json
	CredName           string   // key in creds.json
	ProviderName       string   // provider type: BIND, GANDI_V5, etc or "-"  (NB(tlim): In 4.0, this field goes away.)
	ZoneNames          []string // The zones to get
	OutputFormat       string   // Output format
	OutputFile         string   // Filename to send output ("" means stdout)
	DefaultTTL         int      // default TTL for providers where it is unknown
}

func (args *GetZoneArgs) flags() []cli.Flag {
	flags := args.GetCredentialsArgs.flags()
	flags = append(flags, &cli.StringFlag{
		Name:        "format",
		Destination: &args.OutputFormat,
		Value:       "zone",
		Usage:       `Output format: js djs zone tsv nameonly`,
	})
	flags = append(flags, &cli.StringFlag{
		Name:        "out",
		Destination: &args.OutputFile,
		Usage:       `Instead of stdout, write to this file`,
	})
	flags = append(flags, &cli.IntFlag{
		Name:        "ttl",
		Destination: &args.DefaultTTL,
		Usage:       `Default TTL (0 picks the most common TTL)`,
	})
	return flags
}

// GetZone contains all data/flags needed to run get-zones, independently of CLI.
func GetZone(args GetZoneArgs) error {
	var providerConfigs map[string]map[string]string
	var err error

	// Read it in:
	providerConfigs, err = credsfile.LoadProviderConfigs(args.CredsFile)
	if err != nil {
		return fmt.Errorf("failed GetZone LoadProviderConfigs(%q): %w", args.CredsFile, err)
	}
	provider, err := providers.CreateDNSProvider(args.ProviderName, providerConfigs[args.CredName], nil)
	if err != nil {
		return fmt.Errorf("failed GetZone CDP: %w", err)
	}

	// Get the actual provider type name from creds.json or args
	providerType := args.ProviderName
	if providerType == "" || providerType == "-" {
		providerType = providerConfigs[args.CredName][pproviderTypeFieldName]
	}

	// decide which zones we need to convert
	zones := args.ZoneNames
	if len(args.ZoneNames) == 1 && args.ZoneNames[0] == "all" {
		lister, ok := provider.(providers.ZoneLister)
		if !ok {
			return fmt.Errorf("provider type %s:%s cannot list zones to use the 'all' feature", args.CredName, args.ProviderName)
		}
		zones, err = lister.ListZones()
		if err != nil {
			return fmt.Errorf("failed GetZone LZ: %w", err)
		}
	}

	// first open output stream and print initial header (if applicable)
	w := os.Stdout
	if args.OutputFile != "" {
		w, err = os.Create(args.OutputFile)
	}
	if err != nil {
		return fmt.Errorf("failed GetZone Create(%q): %w", args.OutputFile, err)
	}
	defer w.Close()

	if args.OutputFormat == "nameonly" {
		for _, zone := range zones {
			fmt.Fprintln(w, zone)
		}
		return nil
	}

	// fetch all of the records
	zoneRecs := make([]models.Records, len(zones))
	for i, zone := range zones {
		dc, err := models.NewDomainConfig(zone)
		if err != nil {
			return fmt.Errorf("failed GetZone NewDC: %w", err)
		}
		recs, err := provider.GetZoneRecords(dc)
		if err != nil {
			return fmt.Errorf("failed GetZone gzr: %w", err)
		}
		zoneRecs[i] = recs
	}

	// Write the heading:

	dspVariableName := "DSP_" + strings.ToUpper(args.CredName)

	if args.OutputFormat == "js" || args.OutputFormat == "djs" {
		fmt.Fprintf(w, "// generated by get-zones. This is 'a decent first draft' and requires editing.\n")
		fmt.Fprintf(w, "\n")
		if args.ProviderName == "-" {
			fmt.Fprintf(w, `var %s = NewDnsProvider("%s");`+"\n",
				dspVariableName, args.CredName)
		} else {
			fmt.Fprintf(w, `var %s = NewDnsProvider("%s", "%s");`+"\n",
				dspVariableName, args.CredName, args.ProviderName)
		}
		fmt.Fprintf(w, `var REG_CHANGEME = NewRegistrar("none");`+"\n\n")
	}

	// print each zone
	for i, recs := range zoneRecs {
		zoneName := zones[i]

		z := prettyzone.PrettySort(recs, zoneName, 0, nil)
		switch args.OutputFormat {
		case "zone":
			fmt.Fprintf(w, "$ORIGIN %s.\n", zoneNa
```

### Core Architecture Module: `commands/init.go`
```
package commands

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"maps"
	"os"
	"os/exec"
	"sort"
	"strings"

	"github.com/DNSControl/dnscontrol/v5/models"
	"github.com/DNSControl/dnscontrol/v5/pkg/credsfile"
	"github.com/DNSControl/dnscontrol/v5/pkg/prettyzone"
	"github.com/DNSControl/dnscontrol/v5/pkg/providers"
	"github.com/urfave/cli/v3"
)

var verifyDNSProviderCredsFunc = verifyDNSProviderCredsReal
var verifyRegistrarCredsFunc = verifyRegistrarCredsReal
var fetchZoneRecordsFunc = fetchZoneRecordsReal

var _ = cmd(catMain, func() *cli.Command {
	var args InitArgs
	return &cli.Command{
		Name:  "init",
		Usage: "Interactively create a creds.json and starter dnsconfig.js",
		Description: "Walks you through picking a registrar and DNS provider, " +
			"entering their credentials, and writing a creds.json plus a minimal " +
			"dnsconfig.js so a fresh setup can run `dnscontrol preview` immediately.",
		Action: func(ctx context.Context, c *cli.Command) error {
			return exit(Init(args))
		},
		Flags: args.flags(),
	}
}())

// InitArgs carries the flag values for the `init` subcommand.
type InitArgs struct {
	CredsFile  string
	ConfigFile string
	SkipConfig bool
}

func (args *InitArgs) flags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{
			Name:        "creds",
			Value:       "creds.json",
			Usage:       "Output path for the credentials file",
			Destination: &args.CredsFile,
		},
		&cli.StringFlag{
			Name:        "config",
			Value:       "dnsconfig.js",
			Usage:       "Output path for the starter DNSControl config",
			Destination: &args.ConfigFile,
		},
		&cli.BoolFlag{
			Name:        "no-config",
			Value:       false,
			Usage:       "Do not write a starter dnsconfig.js",
			Destination: &args.SkipConfig,
		},
	}
}

// Init runs the interactive onboarding flow described by InitArgs.
func Init(args InitArgs) error {
	return runInit(args, surveyAsker{})
}

// runInit is the test friendly entry point. It takes an Asker so tests
// can stub the interactive prompts.
func runInit(args InitArgs, asker Asker) error {
	fmt.Println("Welcome to dnscontrol init.")
	fmt.Println("This wizard creates a creds.json and a starter dnsconfig.js.")

	existingCreds, err := loadExistingCreds(args.CredsFile)
	if err != nil {
		return err
	}

	registrarType, dnsProviderType, sameAccount, err := pickProviders(asker)
	if err != nil {
		return err
	}

	entries, choice, availableZones, err := collectEntries(asker, registrarType, dnsProviderType, sameAccount)
	if err != nil {
		return err
	}

	if !args.SkipConfig {
		choice.Domains, err = askDomainsWithZones(asker, availableZones, displayName(dnsProviderType))
		if err != nil {
			return err
		}

		if sample, ok := dnsSample(entries); ok && len(choice.Domains) > 0 {
			fmt.Printf("\nFetching records for %d zone(s) from %s...\n", len(choice.Domains), displayName(sample.TypeName))
			choice.DomainRecords = importRecords(sample, choice.Domains)
			if imported := len(choice.DomainRecords); imported > 0 {
				fmt.Printf("Imported records for %d zone(s).\n", imported)
			}
		}
	}

	credsBytes, err := renderCredsJSON(existingCreds, entries)
	if err != nil {
		return err
	}
	var configBytes []byte
	if !args.SkipConfig {
		configBytes = renderDnsconfigJS(choice)
	}

	if err := confirmAndWrite(asker, args, existingCreds, entries, credsBytes, configBytes); err != nil {
		return err
	}

	fmt.Println()
	fmt.Println("Done.")
	return offerFollowUps(asker, args, entries, choice)
}

// pickProviders walks the user through choosing a DNS provider and a
// registrar. It returns the chosen registrar TYPE, DNS provider TYPE,
// and whether the registrar should reuse the DNS provider's credentials.
func pickProviders(asker Asker) (registrarType, dnsProviderType string, sameAccount bool, err error) {
	// DNS first because most users think in terms of where their records
	// live. NONE defers the choice. The picker only lists providers
	// whose maintainers have registered onboarding metadata so the
	// wizard can drive the prompts. Other providers should be set up
	// from the documentation.
	dnsOptions := providersWithMetadata(keysOf(providers.DNSProviderTypes))
	dnsOptions = append([]string{"NONE"}, dnsOptions...)
	fmt.Println()
	fmt.Println("A DNS provider hosts the records (A, MX, TXT, CNAME, and so on) for your zones.")
	fmt.Println("Pick NONE if you want to defer this choice.")
	fmt.Println("Providers not listed below can be configured from their documentation page at https://docs.dnscontrol.org/provider/.")
	dnsProviderType, err = pickProvider(asker, "Which DNS service provider do you want to configure?", dnsOptions)
	if err != nil {
		return "", "", false, err
	}

	// If the chosen DNS provider can also act as a registrar, offer to
	// reuse it; otherwise ask which registrar to use, with NONE as the
	// default.
	if dnsProviderType != "NONE" {
		if _, alsoRegistrar := providers.RegistrarTypes[dnsProviderType]; alsoRegistrar {
			meta, _ := providers.GetCredsMetadata(dnsProviderType)
			sameAccount, err = asker.Confirm(
				fmt.Sprintf("Use the same %s account for the registrar role too?", displayName(meta.TypeName)),
				"",
				true,
			)
			if err != nil {
				return "", "", false, err
			}
			if sameAccount {
				return dnsProviderType, dnsProviderType, true, nil
			}
		}
	}

	fmt.Println()
	fmt.Println("A registrar is where the domain itself is registered. DNSControl updates the NS delegation there.")
	fmt.Println("Pick NONE if you manage the registrar outside DNSControl.")
	fmt.Println("Registrars not listed below can be configured from their documentation page at https://docs.dnscontrol.org/provider/.")
	registrarType, err = pickProvider(asker, "Which registrar do you want to configure?",
		providersWithMetadata(keysOf(providers.RegistrarTypes)))
	if err != nil {
		return "", "", false, err
	}
	return registrarType, dnsProviderType, false, nil
}

// confirmAndWrite shows the rendered files, warns the user about any
// pre existing files that will be merged or replaced, asks for
// confirmation, and writes the files when accepted. It also runs the
// per provider PostWrite hooks and validates that the resulting
// creds.json still parses.
func confirmAndWrite(asker Asker, args InitArgs, existingCreds map[string]map[string]string, entries []InitCredsEntry, credsBytes, configBytes []byte) error {
	fmt.Println()
	fmt.Printf("--- %s ---\n", args.CredsFile)
	fmt.Println(string(credsBytes))
	if !args.SkipConfig {
		fmt.Printf("--- %s ---\n", args.ConfigFile)
		fmt.Println(string(configBytes))
	}

	credsExists := len(existingCreds) > 0
	configExists := false
	if !args.SkipConfig {
		if _, err := os.Stat(args.ConfigFile); err == nil {
			configExists = true
		}
	}
	if credsExists || configExists {
		fmt.Println()
		if credsExists {
			fmt.Printf("NOTE: %s already exists; new entries are merged in.\n", args.CredsFile)
		}
		if configExists {
			fmt.Printf("NOTE: %s already exists and will be replaced.\n", args.ConfigFile)
		}
	}

	confirm, err := asker.Confirm("Write these files?", "", true)
	if err != nil {
		return err
	}
	if !confirm {
		return errInitAborted
	}

	if err := writeFile(args.CredsFile, credsBytes); err != nil {
		return err
	}
	if !args.SkipConfig {
		if err := writeFile(args.ConfigFile, configBytes); err != nil {
			return err
		}
	}
	runPostWriteHooks(entries)

	// Round trip: confirm credsfile can still load the result.
	if _, err := credsfile.LoadProviderConfigs(args.CredsFile); err != nil {
		return fmt.Errorf("wrote %s but it failed to parse: %w", args.CredsFile, err)
	}
	return nil
}

func verifyAndRetry(asker Asker, meta providers.CredsMetadata, entry InitCredsEntry, role string, verify func(InitCredsEntry) ([]string, error)) (map[string]string, []string, error) {
	fields := entry.Fields
	for {
		fmt.Println()
		fmt.Printf("Verifying credentials for %s...\n", displayName(entry.TypeName))

		zones, err := verify(InitCredsEntry{
			Name:     entry.Name,
			TypeName: entry.TypeName,
			Fields:   fields,
		})

```

### Core Architecture Module: `commands/init_prompt.go`
```
package commands

import (
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	"github.com/DNSControl/dnscontrol/v5/pkg/providers"
)

// Asker is the minimal set of interactive prompts used by `dnscontrol
// init`. Tests provide a stub implementation to drive the flow
// deterministically.
type Asker interface {
	// Select asks the user to pick one value from a list. The default is
	// suggested and returned when the user accepts without typing.
	Select(message, help string, options []string, defaultOption string) (string, error)
	// MultiSelect asks the user to pick zero or more values from a list.
	MultiSelect(message, help string, options []string) ([]string, error)
	// Input asks for a free form string.
	Input(message, help, defaultValue string) (string, error)
	// Secret asks for a string and masks the input.
	Secret(message, help string) (string, error)
	// Multiline opens an external editor so the user can enter a value
	// that contains newlines (for example a PEM encoded private key).
	Multiline(message, help string) (string, error)
	// Confirm asks a yes/no question.
	Confirm(message, help string, defaultValue bool) (bool, error)
}

// surveyAsker is the default Asker backed by github.com/AlecAivazis/survey/v2.
type surveyAsker struct{}

// Select implements Asker.
func (surveyAsker) Select(message, help string, options []string, defaultOption string) (string, error) {
	var answer string
	prompt := &survey.Select{
		Message:  message,
		Options:  options,
		Help:     help,
		PageSize: 15,
	}
	// Survey rejects a Default that is not one of the options. Only set
	// it when it matches, otherwise fall back to the first option.
	if slices.Contains(options, defaultOption) {
		prompt.Default = defaultOption
	}
	if err := survey.AskOne(prompt, &answer); err != nil {
		return "", err
	}
	return answer, nil
}

// MultiSelect implements Asker.
func (surveyAsker) MultiSelect(message, help string, options []string) ([]string, error) {
	var answers []string
	prompt := &survey.MultiSelect{
		Message:  message,
		Options:  options,
		Help:     help,
		PageSize: 15,
	}
	if err := survey.AskOne(prompt, &answers); err != nil {
		return nil, err
	}
	return answers, nil
}

// Input implements Asker.
func (surveyAsker) Input(message, help, defaultValue string) (string, error) {
	var answer string
	prompt := &survey.Input{
		Message: message,
		Default: defaultValue,
		Help:    help,
	}
	if err := survey.AskOne(prompt, &answer); err != nil {
		return "", err
	}
	return answer, nil
}

// Secret implements Asker.
func (surveyAsker) Secret(message, help string) (string, error) {
	var answer string
	prompt := &survey.Password{Message: message, Help: help}
	if err := survey.AskOne(prompt, &answer); err != nil {
		return "", err
	}
	return answer, nil
}

// Multiline implements Asker.
func (surveyAsker) Multiline(message, help string) (string, error) {
	var answer string
	prompt := &survey.Editor{
		Message:       message,
		Help:          help,
		HideDefault:   true,
		AppendDefault: true,
	}
	if err := survey.AskOne(prompt, &answer); err != nil {
		return "", err
	}
	return answer, nil
}

// Confirm implements Asker.
func (surveyAsker) Confirm(message, help string, defaultValue bool) (bool, error) {
	var answer bool
	prompt := &survey.Confirm{Message: message, Help: help, Default: defaultValue}
	if err := survey.AskOne(prompt, &answer); err != nil {
		return false, err
	}
	return answer, nil
}

// askField prompts for a single CredsField and returns the value the user
// entered, respecting Required, Secret, Default and Choices.
func askField(asker Asker, field providers.CredsField) (string, error) {
	defaultValue := field.Default
	if field.EnvVar != "" {
		if envValue := os.Getenv(field.EnvVar); envValue != "" {
			defaultValue = envValue
		}
	}

	label := fieldLabel(field)

	for {
		var (
			value string
			err   error
		)
		switch {
		case field.ConfirmValue != "":
			var confirmed bool
			confirmed, err = asker.Confirm(label, field.Help, defaultValue == field.ConfirmValue)
			if confirmed {
				value = field.ConfirmValue
			}
		case len(field.Choices) > 0:
			value, err = asker.Select(label, field.Help, field.Choices, defaultValue)
		case field.Multiline:
			value, err = asker.Multiline(label, field.Help)
		case field.Secret:
			value, err = asker.Secret(label, field.Help)
		default:
			value, err = asker.Input(label, field.Help, defaultValue)
		}
		if err != nil {
			return "", err
		}
		value = strings.TrimSpace(value)
		if value == "" && field.Required {
			fmt.Fprintln(os.Stderr, "A value is required.")
			continue
		}
		if field.Validator != nil && value != "" {
			if err := field.Validator(value); err != nil {
				fmt.Fprintln(os.Stderr, err.Error())
				continue
			}
		}
		return value, nil
	}
}

func fieldLabel(field providers.CredsField) string {
	label := strings.TrimSuffix(field.Label, "(optional)")
	label = strings.TrimSpace(strings.TrimSuffix(label, "(required)"))
	if label == "" {
		label = field.Key
	} else if !strings.EqualFold(label, field.Key) {
		label += " [" + field.Key + "]"
	}
	if field.ConfirmValue != "" {
		return label
	}
	if field.Required {
		return label + " (required)"
	}
	return label + " (optional)"
}

// openPortalHint prints the portal URL plus any provider notes so the
// user can open the link themselves before answering the credential
// prompts.
func openPortalHint(_ Asker, meta providers.CredsMetadata) error {
	if meta.PortalURL == "" && meta.Notes == "" {
		return nil
	}
	fmt.Println()
	if meta.PortalURL != "" {
		fmt.Printf("API settings for %s: %s\n", displayName(meta.TypeName), meta.PortalURL)
	}
	if meta.Notes != "" {
		fmt.Println(meta.Notes)
	}
	return nil
}

// collectFields runs askField for every field defined in meta and returns
// the resulting key/value map. Fields whose ShowIf condition does not
// match are skipped. Internal fields are not written to the output.
// Empty optional answers are dropped.
func collectFields(asker Asker, meta providers.CredsMetadata) (map[string]string, error) {
	answers := map[string]string{}
	output := map[string]string{}
	for _, field := range meta.Fields {
		if !showField(field, answers) {
			continue
		}
		value, err := askField(asker, field)
		if err != nil {
			return nil, err
		}
		answers[field.Key] = value
		if field.Internal {
			continue
		}
		if value == "" && !field.Required {
			continue
		}
		if value == field.Default && !field.Required {
			continue
		}
		output[field.Key] = value
	}
	return output, nil
}

// showField evaluates the ShowIf map against the already collected
// answers.
func showField(field providers.CredsField, answers map[string]string) bool {
	for key, want := range field.ShowIf {
		if answers[key] != want {
			return false
		}
	}
	return true
}

// displayName returns the human friendly DisplayName registered for the
// given provider type, falling back to the type name itself when no
// metadata or DisplayName is registered.
func displayName(typeName string) string {
	if meta, ok := providers.GetCredsMetadata(typeName); ok && meta.DisplayName != "" {
		return meta.DisplayName
	}
	return typeName
}

// errInitAborted is returned when the user aborts the init flow.
var errInitAborted = errors.New("init aborted by user")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4953** (2026-09-30): **build(deps): bump brace-expansion from 5.0.9 to 5.0.12**
  *Symptoms*: Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 5.0.9 to 5.0.12. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/juliangruber/brace-expansion/commit/f3410159d768f56c9d9f4511d3e1b46425fc1099"><code>f341015</code></a> 5.0.12</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/33a5ef17b8d800bbfa8c52b14c39043b6aac1a96"><code>33a5ef1</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/82479277b90f2f86263e946f9ff89689b3734568"><code>8247927</code></a> 5.0.11</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/935d78f32f335b2ff76578e5c5e877d31ae9888c"><code>935d78f</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/df7682f386cdf2d7fef6067bc78ed70d824e1f3f"><code>df7682f</code></a> 5.0.10</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/1ade9de71f3a8719c82c61a7977121067bb55b02"><code>1ade9de</code></a> npm run format</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/6735c94873ca570bcdd6a0690033bdd3126379d3"><code>6735c94</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/4e7046543469d31e2b324b1bf14d8606d74f7f18"><code>4e70465</code></a> chore: ensure prettier formatting (<a href="https://redirect.github.com/juliangruber/brace-expansion/issues/154">#154</a>)</li> <li><a href="ht

- **Issue #4952** (2026-09-30): **build(deps): bump js-yaml from 5.2.3 to 5.4.2**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 5.2.3 to 5.4.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>[5.4.2] - 2026-09-13</h2> <h3>Fixed</h3> <ul> <li><code>forceQuotes</code> no longer quotes non-string scalars, <a href="https://redirect.github.com/nodeca/js-yaml/issues/798">#798</a>.</li> </ul> <h2>[5.4.1] - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> <h2>[5.4.0] - 2026-08-25</h2> <h3>Added</h3> <ul> <li>Added the <code>scalarStyleRules</code> dumper option to customize string formatting. See <a href="https://github.com/nodeca/js-yaml/blob/master/docs/scalar_styling.md">Scalar styling</a> for details.</li> </ul> <h3>Changed</h3> <ul> <li>[breaking] Flattened the low-level AST node style representation. Scalar and collection nodes now use <code>SCALAR_STYLE</code> and <code>COLLECTION_STYLE</code> values; explicit tags use the separate <code>tagged</code> property. Alias nodes now contain only <code>kind</code> and <code>anchor</code>. This only affects code that directly constructs or edits AST nodes.</li> <li>[breaking] The <code>sortKeys</code> option was rewritten using 

- **Issue #4951** (2026-09-30): **feat(p/BUNNYDNS): manage health monitoring features via dnsconfig.js**
  *Symptoms*: Following #4941, add support for [Bunny DNS's health monitoring feature](https://bunny.net/docs/dns/records#health-monitoring).  Tested on my own DNS zone and confirmed working.
  **Post-Mortem & Fix Analysis**:
  > Q: what will happen if someone had enabled health monitoring outside of DNSControl. Their dnsconfig.js won't have the health monitoring metadata.  Will the next "dnscontrol push" remove the health monitoring?  That could be an unpleasant surprise.  It might be better to have a rule: "no metadata == leave it alone; If you want to delete it, set bunny_monitor_type=none" 
  > In this case `dnscontrol push` will remove health monitoring. However I will be very surprised if users are actually doing this. If I want to use some feature not yet supported by DNSControl, I would have `IGNORE`d that record and managed it completely manually.  I also don't like the UX of doing nothing when metadata isn't set, since if a user removes the health monitoring metadata expecting to disable it, they will also be surprised that it isn't actually disabled.
  > @xddxdd Ok!  I'll make a note in the release notes.

- **Issue #4948** (2026-09-29): **docs: Autogenerate the table in README.md**
  *Symptoms*: # Issue  The table in README.md is difficult to update and quite out of date.  # Resolution  Generate it instead. 
  **Post-Mortem & Fix Analysis**:
  > P.S. This will fail the "check git status" test until https://github.com/DNSControl/dnscontrol/pull/4947/changes is merged.

- **Issue #4947** (2026-09-29): **chore: Update FORTIGATE capabilities, INFOBLOX owner, and linting**
  *Symptoms*: <!-- ## Before submiting a pull request  Please make sure you've run the following commands from the root directory.      bin/generate-all.sh  (this runs commands like "go generate", fixes formatting, and so on)  ## Pull request title  The pull request title becomes the commit message on main and must follow Conventional Commits (the "PR: Commitlint" check enforces this). Provider-specific changes use the scope "p/PROVIDERNAME". The subject starts with a lowercase letter.  Some examples: * ci: add required GHA permissions for goreleaser * docs: fix providers with "contributor support" table * feat(p/ROUTE53): allow R53_ALIAS records to enable target health evaluation  More details can be found in CONTRIBUTING.md under "Pull request titles". !--> 
  **Post-Mortem & Fix Analysis**:
  > I'd normally wait but I need to merge this for another PR. Thanks for understanding!

- **Issue #4946** (2026-09-28): **chore: Update dependencies**
  *Symptoms*: 

- **Issue #4945** (2026-09-28): **fix(p/REALTIMEREGISTER): ensure proper quoting of txt records**
  *Symptoms*: Fixes issue #4943.

- **Issue #4944** (2026-09-30): **feat: Normalize all "targethost" and hex-encoded fields**
  *Symptoms*: # Issue  Not all fields are normalized (changed to lowercase) so that future comparisons do not need to be case aware.  This issue was fixed for CNAME in https://github.com/DNSControl/dnscontrol/pull/4940 but other record fields, such as the MX record's Mx, are not normalized.  Tracking which record type fields need to be normalized is a PITA.  # Resolution  Create a function `normalizeRDATA()` which normalizes fields. The function will be code-generated so that future rtypes will be properly normalized.  While we're at it, let's normalize hex data to lowercase instead of uppercase like the rest of the world does.   

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

### Incident Patch 1: `333b7b19` (2026-09-30)
**Commit Message**: fix(p/FORTIGATE): ask the TLS and HTTP debug settings as yes/no questions in init (#4878)

While looking into https://github.com/DNSControl/dnscontrol/issues/4381
(the INWX sandbox question in `dnscontrol init` being confusing),
FortiGate turned out to have two prompts of the same kind.
`insecure_tls` and `debug_http` are on/off settings, but `init` asks for
them as free text and only the `?` help explains that the value has to
be `true`. The provider compares against `true` (case insensitive), so
answering `yes` or `1` silently leaves TLS verification on.

Both settings are now yes/no questions with no as the default. Answering
yes writes `"true"`, so the resulting `creds.json` is the same as
before.

Before, after typing `?` at the TLS prompt:

```text
API settings for FortiGate: https://docs.fortinet.com/
? FortiGate host [host] (required) fw.example.com
? VDOM (required) root
? API key [apiKey] (required) [? for help] *****
? Set to "true" to skip TLS certificate verification when connecting to the FortiGate.
? Skip TLS verification (optional) [insecure_tls] (optional)
```

After, after typing `?` at the TLS prompt:

```text
API settings for FortiGate: https://docs.fortinet.com

**File**: `providers/fortigate/fortigateProvider.go` (modified, +8/-6)
```diff
@@ -75,14 +75,16 @@ func init() {
 				Required: true,
 			},
 			{
-				Key:   "insecure_tls",
-				Label: "Skip TLS verification",
-				Help:  "Set to \"true\" to skip TLS certificate verification when connecting to the FortiGate.",
+				Key:          "insecure_tls",
+				Label:        "Skip TLS certificate verification when connecting to the FortiGate?",
+				Help:         "Answer yes only when the FortiGate uses a self-signed certificate.",
+				ConfirmValue: "true",
 			},
 			{
-				Key:   "debug_http",
-				Label: "Debug HTTP",
-				Help:  "Set to \"true\" to log HTTP requests and responses for debugging.",
+				Key:          "debug_http",
+				Label:        "Log HTTP requests and responses for debugging?",
+				Help:         "Answer no for normal use.",
+				ConfirmValue: "true",
 			},
 		},
 	})
```

---

### Incident Patch 2: `dae209b9` (2026-09-30)
**Commit Message**: build(deps): bump brace-expansion from 5.0.9 to 5.0.12 (#4953)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion)
from 5.0.9 to 5.0.12.
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/f3410159d768f56c9d9f4511d3e1b46425fc1099"><code>f341015</code></a>
5.0.12</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/33a5ef17b8d800bbfa8c52b14c39043b6aac1a96"><code>33a5ef1</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/82479277b90f2f86263e946f9ff89689b3734568"><code>8247927</code></a>
5.0.11</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/935d78f32f335b2ff76578e5c5e877d31ae9888c"><code>935d78f</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/df7682f386cdf2d7fef6067bc78ed70d824e1f3f"><code>df7682f</code></a>
5.0.10</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/1ade9de71f3a8719c82c61a7977121067bb55b02"><code>1ade9de</code></a>
npm run format</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/6735c9487

**File**: `package-lock.json` (modified, +3/-3)
```diff
@@ -1027,9 +1027,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
```

---

### Incident Patch 3: `c5fabaa6` (2026-09-28)
**Commit Message**: fix(p/REALTIMEREGISTER): ensure proper quoting of txt records (#4945)

Fixes issue #4943.

**File**: `providers/realtimeregister/realtimeregisterProvider.go` (modified, +1/-2)
```diff
@@ -264,8 +264,7 @@ func toRecord(rc *models.RecordConfig) Record {
 	case dnsv2.TypeNAPTR, dnsv2.TypeSSHFP, dnsv2.TypeTLSA, dnsv2.TypeCAA:
 		record.Content = rc.GetRDATA().String()
 	case dnsv2.TypeTXT:
-		//record.Content = addEscapeChars(record.Content)
-		record.Content = rc.AsTXT().String()
+		record.Content = rc.GetTargetTXTJoined()
 	case dnsv2.TypeDS:
 		f := rc.AsDS()
 		record.Content = fmt.Sprintf("%d %d %d %s", f.KeyTag, f.Algorithm, f.DigestType, strings.ToUpper(f.Digest))
```

**File**: `providers/realtimeregister/realtimeregisterProvider_test.go` (modified, +15/-0)
```diff
@@ -3,6 +3,8 @@ package realtimeregister
 import (
 	"testing"
 
+	dnsv2 "codeberg.org/miekg/dns"
+	"github.com/DNSControl/dnscontrol/v5/models"
 	"github.com/stretchr/testify/assert"
 )
 
@@ -15,3 +17,16 @@ func TestAddEscapeChars(t *testing.T) {
 	addedString := addEscapeChars("\\\"")
 	assert.Equal(t, "\\\\\\\"", addedString)
 }
+
+func TestTxtRecordQuotes(t *testing.T) {
+	dc := models.MustNewDomainConfig("example.com")
+
+	testStrings := [...]string{"unquoted", "\"quoted\"", "embedded \"quotes\" in string"}
+
+	for _, testString := range testStrings {
+		rc := dc.MustNewRecordConfig("@", 0, dnsv2.TypeTXT, testString)
+		record := toRecord(rc)
+
+		assert.Equal(t, testString, record.Content)
+	}
+}
```

---

### Incident Patch 4: `d12f3926` (2026-09-26)
**Commit Message**: fix: lowercase cname rdata in normalization (#4940)

## Apply Normalization to CNAME Target

See commit message(s).

### Related

- Fixes https://github.com/DNSControl/dnscontrol/issues/4938

**File**: `models/rdata.go` (modified, +4/-0)
```diff
@@ -11,6 +11,7 @@ import (
 
 	dnsv2 "codeberg.org/miekg/dns"
 	dnsrdatav2 "codeberg.org/miekg/dns/rdata"
+	"github.com/DNSControl/dnscontrol/v5/pkg/domaintags"
 	_ "github.com/DNSControl/dnscontrol/v5/pkg/privatetypes"
 	_ "github.com/DNSControl/dnscontrol/v5/pkg/privatetypes/rdata"
 )
@@ -117,6 +118,9 @@ func normalizeRDATA(rd2 dnsv2.RDATA) dnsv2.RDATA {
 		v.Txt = TXTSegmented(v)
 		return v
 
+	case dnsrdatav2.CNAME:
+		v.Target = domaintags.EfficientToASCII(v.Target)
+		return v
 	}
 
 	return rd2
```

---

### Incident Patch 5: `e7e452fd` (2026-09-25)
**Commit Message**: fix(p/OPENPROVIDER): retry transient API failures with diagnostics (#4937)

## Summary

As a continuation of [PR
#4891](https://github.com/DNSControl/dnscontrol/pull/4891),
improve Openprovider API resilience when transient errors occur.

The provider now:

- Retries HTTP 400 responses with Openprovider error code `18002`
- Uses exponential backoff delays of 1, 2, 4, 8, 15, and 30 seconds
- Re-authenticates once when a request receives HTTP 401
- Prints a redacted curl-style request/response dump when retrying
- Includes response status, headers, and body in retry diagnostics

Additional tests cover retry behavior, non-retryable errors, response
diagnostics,
and bearer-token redaction.

The high-volume `pager101` integration test now excludes Openprovider
because
bulk cleanup can intermittently fail with API gateway timeouts.

## Validation

- [x] `go test ./providers/openprovider`
- [x] `go test ./integrationTest`
- [x] `gofmt` verification
- [x] `git diff --check`

## Notes

The retry diagnostics should make it easier to determine whether
failures
originate from the Openprovider API response or from the request
generated by
DNSControl.

## Example Output

```
helpers_integration_

**File**: `integrationTest/integration_test.go` (modified, +1/-0)
```diff
@@ -740,6 +740,7 @@ func makeTests() []*TestGroup {
 				"LOOPIA",       // Their API is so damn slow. Plus, no paging.
 				"NAMEDOTCOM",   // Their API is so damn slow. We'll add it back as needed.
 				"NS1",          // Free acct only allows 50 records, therefore we skip
+				"OPENPROVIDER", // Bulk cleanup intermittently fails with API gateway timeouts.
 				// "ROUTE53",       // Batches up changes in pages.
 				"TRANSIP", // Doesn't page. Works fine.  Due to the slow API we skip.
 				"VERCEL",  // Rate limit 100 creation per hour, 101 needs an hour, too much
```

**File**: `providers/openprovider/api.go` (modified, +59/-13)
```diff
@@ -8,18 +8,30 @@ import (
 	"fmt"
 	"io"
 	"net/http"
+	"net/http/httputil"
 	"net/url"
 	"strconv"
 	"strings"
 	"sync"
 	"time"
+
+	"github.com/DNSControl/dnscontrol/v5/pkg/printer"
 )
 
 const (
 	defaultAPIURL = "https://api.openprovider.eu/v1"
 	pageSize      = 500
 )
 
+var transientRetryBackoffs = [...]time.Duration{
+	time.Second,
+	2 * time.Second,
+	4 * time.Second,
+	8 * time.Second,
+	15 * time.Second,
+	30 * time.Second,
+}
+
 type apiError struct {
 	Operation   string
 	StatusCode  int
@@ -43,11 +55,17 @@ func isNotFound(err error) bool {
 	return errors.As(err, &apiErr) && (apiErr.StatusCode == http.StatusNotFound || apiErr.Code == 800 || apiErr.Code == 872)
 }
 
+func isRetryable(err error) bool {
+	var apiErr *apiError
+	return errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusBadRequest && apiErr.Code == 18002
+}
+
 type apiClient struct {
 	baseURL    string
 	username   string
 	password   string
 	httpClient *http.Client
+	sleep      func(time.Duration)
 
 	tokenMu sync.Mutex
 	token   string
@@ -67,6 +85,7 @@ func newAPIClient(baseURL, username, password string) (*apiClient, error) {
 		httpClient: &http.Client{
 			Timeout: 90 * time.Second,
 		},
+		sleep: time.Sleep,
 	}, nil
 }
 
@@ -159,25 +178,35 @@ func (c *apiClient) doRequest(method, path string, body, result any, operation s
 		return fmt.Errorf("OPENPROVIDER: %s: encode request: %w", operation, err)
 	}
 
-	for attempt := range 2 {
+	unauthorizedRetried := false
+	transientRetries := 0
+	for {
 		token, err := c.getToken()
 		if err != nil {
 			return err
 		}
 
-		status, responseBody, err := c.send(context.Background(), method, path, payload, token)
+		response, responseBody, err := c.send(context.Background(), method, path, payload, token)
 		if err != nil {
 			return fmt.Errorf("OPENPROVIDER: %s: %w", operation, err)
 		}
-		if status == http.StatusUnauthorized && attempt == 0 {
+		status := response.StatusCode
+		if status == http.StatusUnauthorized && !unauthorizedRetried {
 			c.invalidateToken(token)
+			unauthorizedRetried = true
 			continue
 		}
 
-		return decodeResponse(operation, status, responseBody, result)
-	}
+		err = decodeResponse(operation, status, responseBody, result)
+		if !isRetryable(err) || transientRetries >= len(transientRetryBackoffs) {
+			return err
+		}
 
-	panic("unreachable")
+		backoff := transientRetryBackoffs[transientRetries]
+		transientRetries++
+		printer.Warnf("OPENPROVIDER: API temporarily unavailable, retrying in %v (attempt %d/%d)\n%s", backoff, transientRetries, len(transientRetryBackoffs), formatRetryDiagnostics(response, payload, responseBody))
+		c.sleep(backoff)
+	}
 }
 
 func marshalPayload(body any) ([]byte, error) {
@@ -203,13 +232,13 @@ func (c *apiClient) getToken() (string, error) {
 		return "", errors.New("OPENPROVIDER: authenticate: encode request")
 	}
 
-	status, responseBody, err := c.send(context.Background(), http.MethodPost, "/auth/login", payload, "")
+	httpResponse, responseBody, err := c.send(context.Background(), http.MethodPost, "/auth/login", payload, "")
 	if err != nil {
 		return "", fmt.Errorf("OPENPROVIDER: authenticate: %w", err)
 	}
 
 	var response loginResponse
-	if err := decodeResponse("authenticate", status, responseBody, &response); err != nil {
+	if err := decodeResponse("authenticate", httpResponse.StatusCode, responseBody, &response); err != nil {
 		return "", err
 	}
 	if response.Token == "" {
@@ -228,15 +257,15 @@ func (c *apiClient) invalidateToken(token string) {
 	}
 }
 
-func (c *apiClient) send(ctx context.Context, method, path string, payload []byte, token string) (int, []byte, error) {
+func (c *apiClient) send(ctx context.Context, method, path string, payload []byte, token string) (*http.Response, []byte, error) {
 	var body io.Reader
 	if payload != nil {
 		body = bytes.NewReader(payload)
 	}
 
 	request, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
 	if err != nil {
-		return 0, nil, err
+		return nil, nil,
```

**File**: `providers/openprovider/api_test.go` (modified, +80/-0)
```diff
@@ -3,10 +3,12 @@ package openprovider
 import (
 	"encoding/json"
 	"fmt"
+	"io"
 	"net/http"
 	"net/http/httptest"
 	"strings"
 	"testing"
+	"time"
 )
 
 func TestAPITokenReuse(t *testing.T) {
@@ -86,6 +88,84 @@ func TestAPIReauthenticatesAfterUnauthorized(t *testing.T) {
 	}
 }
 
+func TestAPIRetriesTransientOpenproviderError(t *testing.T) {
+	updateCalls := 0
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		switch r.URL.Path {
+		case "/auth/login":
+			writeJSON(t, w, http.StatusOK, `{"code":0,"data":{"token":"token"},"desc":""}`)
+		case "/dns/zones/example.com":
+			updateCalls++
+			if updateCalls < 3 {
+				writeJSON(t, w, http.StatusBadRequest, `{"code":18002,"data":"","desc":"Data you sent is invalid or service is not available, try again later"}`)
+				return
+			}
+			writeJSON(t, w, http.StatusOK, `{"code":0,"data":{"success":true},"desc":""}`)
+		default:
+			http.NotFound(w, r)
+		}
+	}))
+	defer server.Close()
+
+	client := testAPIClient(t, server.URL)
+	client.sleep = func(time.Duration) {}
+	if err := client.updateZone(apiZone{ID: 1, Name: "example.com"}, recordUpdates{Add: []apiRecord{{Type: "A", Value: "192.0.2.1", TTL: 900}}}); err != nil {
+		t.Fatalf("updateZone: %v", err)
+	}
+	if updateCalls != 3 {
+		t.Fatalf("update calls = %d, want 3", updateCalls)
+	}
+}
+
+func TestAPIDoesNotRetryOtherBadRequest(t *testing.T) {
+	updateCalls := 0
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if r.URL.Path == "/auth/login" {
+			writeJSON(t, w, http.StatusOK, `{"code":0,"data":{"token":"token"},"desc":""}`)
+			return
+		}
+		updateCalls++
+		writeJSON(t, w, http.StatusBadRequest, `{"code":12345,"data":"","desc":"invalid record"}`)
+	}))
+	defer server.Close()
+
+	client := testAPIClient(t, server.URL)
+	client.sleep = func(time.Duration) { t.Fatal("unexpected retry delay") }
+	err := client.updateZone(apiZone{ID: 1, Name: "example.com"}, recordUpdates{Add: []apiRecord{{Type: "A", Value: "192.0.2.1", TTL: 900}}})
+	if err == nil || updateCalls != 1 {
+		t.Fatalf("updateZone error=%v, calls=%d; want one request and an error", err, updateCalls)
+	}
+}
+
+func TestFormatRetryDiagnosticsIncludesExchangeAndRedactsToken(t *testing.T) {
+	request := httptest.NewRequest(http.MethodPut, "https://api.example.test/v1/dns/zones/example.com", strings.NewReader(`{"records":[]}`))
+	request.Header.Set("Authorization", "Bearer secret-token")
+	request.Header.Set("Content-Type", "application/json")
+	response := &http.Response{
+		StatusCode: http.StatusBadRequest,
+		Status:     "400 Bad Request",
+		Header:     http.Header{"X-Request-ID": []string{"request-123"}},
+		Request:    request,
+		Body:       io.NopCloser(strings.NewReader(`{"code":18002,"desc":"try again later"}`)),
+	}
+
+	diagnostics := formatRetryDiagnostics(response, []byte(`{"records":[]}`), []byte(`{"code":18002,"desc":"try again later"}`))
+	for _, expected := range []string{
+		"PUT /v1/dns/zones/example.com HTTP/1.1",
+		"Authorization: <redacted>",
+		"X-Request-ID: request-123",
+		"400 Bad Request",
+		`{"code":18002,"desc":"try again later"}`,
+	} {
+		if !strings.Contains(diagnostics, expected) {
+			t.Errorf("diagnostics do not contain %q:\n%s", expected, diagnostics)
+		}
+	}
+	if strings.Contains(diagnostics, "secret-token") {
+		t.Error("diagnostics contain the bearer token")
+	}
+}
+
 func TestAPIErrorDoesNotExposeSecrets(t *testing.T) {
 	const (
 		username = "secret-user"
```

---

### Incident Patch 6: `6cc7283b` (2026-09-23)
**Commit Message**: fix: gRPC-Go xDS servers: Denial of Service (DoS) bug (low impact) (#4934)

Note: this doesn't affect DNSControl since it is a client, not a server.
Patching for good measure.

A vulnerability exists in gRPC-Go servers configured with
xds.NewGRPCServer() where a crafted request missing both :authority and
Host headers can cause a server panic, resulting in a Denial of Service
(DoS).

**File**: `go.mod` (modified, +5/-5)
```diff
@@ -162,10 +162,10 @@ require (
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.mongodb.org/mongo-driver v1.17.7 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 // indirect
-	go.opentelemetry.io/otel v1.44.0 // indirect
-	go.opentelemetry.io/otel/metric v1.44.0 // indirect
-	go.opentelemetry.io/otel/trace v1.44.0 // indirect
+	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0 // indirect
+	go.opentelemetry.io/otel v1.45.0 // indirect
+	go.opentelemetry.io/otel/metric v1.45.0 // indirect
+	go.opentelemetry.io/otel/trace v1.45.0 // indirect
 	go.uber.org/ratelimit v0.3.1 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/crypto v0.57.0 // indirect
@@ -175,7 +175,7 @@ require (
 	golang.org/x/term v0.46.0 // indirect
 	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260921155816-b14227669459 // indirect
-	google.golang.org/grpc v1.84.0 // indirect
+	google.golang.org/grpc v1.85.0-dev.0.20260825072537-93e31b48545e // indirect
 	google.golang.org/protobuf v1.36.12 // indirect
 	gopkg.in/ini.v1 v1.67.3 // indirect
 	gopkg.in/sourcemap.v1 v1.0.5 // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -452,18 +452,18 @@ go.mongodb.org/mongo-driver v1.17.7 h1:a9w+U3Vt67eYzcfq3k/OAv284/uUUkL0uP75VE5rC
 go.mongodb.org/mongo-driver v1.17.7/go.mod h1:Hy04i7O2kC4RS06ZrhPRqj/u4DTYkFDAAccj+rVKqgQ=
 go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ64=
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
-go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 h1:8tvICD4vSTOOsNrsI4Ljf6C+6UKvpTEH5XY3JMoyPoo=
-go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0/go.mod h1:z9+yiacE0IHRqM4qFfkbt/JYlmYXgss8GY/jXoNuPJI=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
+go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0 h1:LMuyCAyfalSjDyjdC65nK6N0zoTT63+E/u95X0JovZI=
+go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0/go.mod h1:085m8qbm4hgc8rZWGDEa4vmyyo2c3nPxUslYUKUIU04=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
+go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
+go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
+go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
+go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
+go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
+go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
+go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
+go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
 go.uber.org/atomic v1.9.0 h1:ECmE8Bn/WFTYwEW/bpKD3M8VtR/zQVbavAoalC1PYyE=
 go.uber.org/atomic v1.9.0/go.mod h1:fEN4uk6kAWBTFdckzkM89CLk9XfWZrxpCo0nPH17wJc=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -592,16 +592,16 @@ google.golang.org/genproto v0.0.0-20180817151627-c66870c02cf8/go.mod h1:JiN7NxoA
 google.golang.org/genproto v0.0.0-20190819201941-24fa4b261c55/go.mod h1:DMBHOl98Agz4BDEuKkezgsaosCRResVns1a3J2ZsMNc=
 google.golang.org/genproto v0.0.0-20260715232425-e75dac1f907d h1:C9v1o0/4quuhOAfmRXA2j+we0PqZIp8traLdeogF3Ms=
 google.golang.org/genproto v0.0.0-20260715232425-e75dac1f907d/go.mod h1:Wz2wFJntZFmLGo7pLDXZ3wYk5hyc0Mb+SkHhDDXT+lU=
-google.golang.org/genproto/googleapis/api v0.0.0-20260715232425-e75dac1f907d h1:QwnJwPte4XXAkhPu26LTDIahnsMSUV0kK8HkxbC+Pc4=
-google.golang.org/genproto/googleapis/api v0.0.0-20260715232425-e75dac1f907d/go.mod h1:WRrQ7/7N19PypuT0fxLOL5Lq0waoiRri4FbtHDEKrGE=
+google.golang.org/genproto/googleapis/api v0.0.0-20260817212433-ac3dfec99bb1 h1:lrupDmKL3p5kEX1M92oan027eCKcouzjuPbH6YBK+Rs=
+google.golang.org/genproto/googleapis/api v0.0.0-20260817212433-ac3dfec99bb1/go.mod h1:q/3oV3jAi5vwelxsVAprMBC8BcM2zmNe+IjRGd+9/ks=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260921155816-b14227669459 h1:b0xCahf3FK2m2Cv0p4vTozGPWncCvLfwV86
```

---

### Incident Patch 7: `e090a711` (2026-09-22)
**Commit Message**: docs(p/DNSMADEEASY): fix the sandbox control panel link (#4892)

The sandbox control panel link on the DNS Made Easy provider page points
to `sandbox.dnsmadeeasy.com` without a scheme, so GitBook treats it as a
relative path and renders it as
https://github.com/DNSControl/dnscontrol/tree/main/documentation/provider/sandbox.dnsmadeeasy.com,
which is a dead link. This adds the `https://` scheme so the link opens
the sandbox control panel. The link was introduced in #4469.

## AI-attributie

Assisted-by: Claude Code:claude-opus-5

**File**: `documentation/provider/dnsmadeeasy.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ Global Traffic Director feature is not supported.
 
 ### DNS Made Easy sandbox environment
 
-Sandbox control panel is available at [https://sandbox.dnsmadeeasy.com/](sandbox.dnsmadeeasy.com). To generate sandbox API credentials, sign up for a free trial and go to [Account Information](https://sandbox.dnsmadeeasy.com/account/info) in Config menu.
+Sandbox control panel is available at [https://sandbox.dnsmadeeasy.com/](https://sandbox.dnsmadeeasy.com/). To generate sandbox API credentials, sign up for a free trial and go to [Account Information](https://sandbox.dnsmadeeasy.com/account/info) in Config menu.
 
 Set `sandbox` key to a non-empty value in credentials JSON alongside `TYPE`, `api_key` and `secret_key` to make all API calls against DNS Made Easy sandbox environment. Details in [DNS Made Easy API documentation](https://api-docs.dnsmadeeasy.com/).
 
```

---

### Incident Patch 8: `1e05eea5` (2026-09-22)
**Commit Message**: fix: fix an unlikely JSON injection security vulnerability (#4928)

# Issue

An MX record with the target `mx1.example.com"),
A("attacker-controlled", "203.0.113.66` will force `dnscontrol get-zone
--format js` to generate a `dnsconfig.js` file with an extra `A` record.

# Resolution

JSON-quote all fields.

# Risk

Low.

* The attacker would have to access your portal... at which point they
could just insert the record with their mouse.
* If the attacker is the DNS service provider, they could serve evil
records without you knowing.
* Before you are powned.... every `dnscontrol preview` would highlight
the change.
* Before you are powned.... every `dnscontrol push` would undo their
change.
* While you are being powned... after you run `dnscontrol get-zone
--format js` you are forced to edit the output (it isn't perfect, just
"a good first draft") and you'd probably notice this situation,
especially if you run `dnscontrol fmt`

Alas, stranger attacks have happened. Therefore, we're fixing this.

CC @cafferata who did the work, I'm just merging the PR.

**File**: `commands/getZones.go` (modified, +12/-12)
```diff
@@ -484,12 +484,12 @@ func formatDsl(rec *models.RecordConfig, defaultTTL uint32) string {
 		// DnsControl uses the API to get this info. NAMESERVER() is just
 		// to override that when needed.
 		if rec.Name == "@" {
-			return fmt.Sprintf(`//NAMESERVER("%s")`, rec.AsNS().Ns)
+			return fmt.Sprintf(`//NAMESERVER(%s)`, jsonQuoted(rec.AsNS().Ns))
 		}
-		target = `"` + rec.AsNS().Ns + `"`
+		target = jsonQuoted(rec.AsNS().Ns)
 	case "MIKROTIK_FORWARDER":
 		// Forwarder: target is dns-servers, metadata has doh_servers/verify_doh_cert
-		target = `"` + rec.GetRDATA().String() + `"`
+		target = jsonQuoted(rec.GetRDATA().String())
 		if rec.Metadata != nil {
 			var fwdParts []string
 			if v := rec.Metadata["doh_servers"]; v != "" {
@@ -510,31 +510,31 @@ func formatDsl(rec *models.RecordConfig, defaultTTL uint32) string {
 		target = strings.Join(fj, ", ")
 	}
 
-	return fmt.Sprintf(`%s("%s", %s%s%s%s%s%s%s%s)`, rec.Type, rec.Name, target, cfproxy, cfflatten, cfcomment, cftags, mtmeta, hednsDynamic, ttlop)
+	return fmt.Sprintf(`%s(%s, %s%s%s%s%s%s%s%s)`, rec.Type, jsonQuoted(rec.Name), target, cfproxy, cfflatten, cfcomment, cftags, mtmeta, hednsDynamic, ttlop)
 }
 
 func makeCaa(rec *models.RecordConfig, ttlop string) string {
 	f := rec.AsCAA()
 	var target string
 	if f.Flag == 128 {
-		target = fmt.Sprintf(`"%s", "%s", CAA_CRITICAL`, f.Tag, f.Value)
+		target = fmt.Sprintf(`%s, %s, CAA_CRITICAL`, jsonQuoted(f.Tag), jsonQuoted(f.Value))
 	} else {
-		target = fmt.Sprintf(`"%s", "%s"`, f.Tag, f.Value)
+		target = fmt.Sprintf(`%s, %s`, jsonQuoted(f.Tag), jsonQuoted(f.Value))
 	}
-	return fmt.Sprintf(`%s("%s", %s%s)`, rec.Type, rec.Name, target, ttlop)
+	return fmt.Sprintf(`%s(%s, %s%s)`, rec.Type, jsonQuoted(rec.Name), target, ttlop)
 
 	// TODO(tlim): Generate a CAA_BUILDER() instead?
 }
 
 func makeR53alias(rec *models.RecordConfig, ttl uint32) string {
 	f := rec.AsR53ALIAS()
 	items := []string{
-		`"` + rec.Name + `"`,
-		`"` + f.AliasType + `"`,
-		`"` + f.Target + `"`,
+		jsonQuoted(rec.Name),
+		jsonQuoted(f.AliasType),
+		jsonQuoted(f.Target),
 	}
 	if f.ZoneID != "" {
-		items = append(items, `R53_ZONE("`+f.ZoneID+`")`)
+		items = append(items, `R53_ZONE(`+jsonQuoted(f.ZoneID)+`)`)
 	}
 	if f.EvalTargetHealth == "true" {
 		items = append(items, "R53_EVALUATE_TARGET_HEALTH(true)")
@@ -546,5 +546,5 @@ func makeR53alias(rec *models.RecordConfig, ttl uint32) string {
 }
 
 func makeUknown(rc *models.RecordConfig, ttl uint32) string {
-	return fmt.Sprintf(`// %s("%s", TTL(%d))`, rc.UnknownTypeName, rc.GetRDATA().String(), ttl)
+	return fmt.Sprintf(`// %s(%s, TTL(%d))`, strings.NewReplacer("\r", " ", "\n", " ").Replace(rc.UnknownTypeName), jsonQuoted(rc.GetRDATA().String()), ttl)
 }
```

**File**: `commands/gz_test.go` (modified, +48/-0)
```diff
@@ -3,8 +3,11 @@ package commands
 import (
 	"fmt"
 	"os"
+	"strings"
 	"testing"
 
+	"github.com/DNSControl/dnscontrol/v5/models"
+	"github.com/DNSControl/dnscontrol/v5/pkg/js"
 	_ "github.com/DNSControl/dnscontrol/v5/pkg/providers/_all"
 	"github.com/google/go-cmp/cmp"
 )
@@ -76,3 +79,48 @@ func testFormat(t *testing.T, domain, format string) {
 		t.Errorf("testFormat mismatch (-got +want):\n%s", diff)
 	}
 }
+
+func TestFormatDslEscaping(t *testing.T) {
+	dc := &models.DomainConfig{Name: "example.com"}
+	hostile := `x"), A("injected", "192.0.2.66`
+
+	tests := []struct {
+		name  string
+		label string
+		rtype string
+		args  []any
+	}{
+		{"label", hostile, "A", []any{"192.0.2.1"}},
+		{"ns", "sub", "NS", []any{hostile + ".example.net."}},
+		{"apex ns", "@", "NS", []any{"ns1.example.net.\n" + hostile}},
+		{"caa", "@", "CAA", []any{0, "issue", hostile}},
+		{"caa critical", "@", "CAA", []any{128, "issue", hostile}},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			rc, err := dc.NewRecordConfig(tt.label, 300, tt.rtype, tt.args...)
+			if err != nil {
+				t.Fatalf("NewRecordConfig: %v", err)
+			}
+			line := formatDsl(rc, 300)
+			script := fmt.Sprintf("D(\"example.com\", NewRegistrar(\"none\"), DnsProvider(NewDnsProvider(\"none\")),\n%s\n);\n", line)
+			conf, err := js.ExecuteJavascriptString([]byte(script), false, nil)
+			if err != nil {
+				t.Fatalf("generated line does not parse: %v\n%s", err, line)
+			}
+			records := conf.Domains[0].Records
+			if strings.HasPrefix(line, "//") {
+				if len(records) != 0 {
+					t.Fatalf("commented-out line produced %d records:\n%s", len(records), line)
+				}
+				return
+			}
+			if len(records) != 1 {
+				t.Fatalf("got %d records, want 1:\n%s", len(records), line)
+			}
+			if got, want := records[0].GetRDATA().String(), rc.GetRDATA().String(); got != want {
+				t.Errorf("RDATA = %q, want %q", got, want)
+			}
+		})
+	}
+}
```

---

### Incident Patch 9: `93f20a26` (2026-09-20)
**Commit Message**: fix(p/GCORE): parse API names without a trailing dot (#4923)

This PR fixes #4922 which explains the purpose of the PR further. The
fix is fairly simple, and it fixes up the tests too.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `providers/gcore/convert.go` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@ import (
 // nativeToRecord takes a DNS record from G-Core and returns a native RecordConfig struct.
 func nativeToRecords(n gcoreRRSetExtended, dc *models.DomainConfig) (models.Records, error) {
 	var rcs models.Records
-	recName := dc.LabelFromFQDNWithDot(n.Name)
+	// G-Core returns FQDNs without a trailing dot ("www.example.com").
+	recName := dc.LabelFromFQDNNoDot(n.Name)
 	recType := n.Type
 
 	// Split G-Core's RRset into individual records
```

**File**: `providers/gcore/convert_test.go` (modified, +16/-5)
```diff
@@ -14,24 +14,35 @@ func TestNativeToRecords(t *testing.T) {
 	}
 	tests := []struct {
 		name       string
+		rrname     string
 		rrtype     string
 		content    []any
+		wantLabel  string
+		wantFQDN   string
 		wantTarget string
 	}{
-		{"A", "A", []any{"192.0.2.1"}, "192.0.2.1"},
-		{"MX", "MX", []any{int64(10), "mail.example.net."}, "10 mail.example.net."},
-		{"CAA", "CAA", []any{int64(0), "issue", "letsencrypt.org"}, `0 issue "letsencrypt.org"`},
-		{"TXT", "TXT", []any{"raw text"}, `"raw text"`},
+		{"A", "www.example.com", "A", []any{"192.0.2.1"}, "www", "www.example.com", "192.0.2.1"},
+		{"apex A", "example.com", "A", []any{"192.0.2.1"}, "@", "example.com", "192.0.2.1"},
+		{"nested AAAA", "ygg.irc.example.com", "AAAA", []any{"2001:db8::1"}, "ygg.irc", "ygg.irc.example.com", "2001:db8::1"},
+		{"MX", "www.example.com", "MX", []any{int64(10), "mail.example.net."}, "www", "www.example.com", "10 mail.example.net."},
+		{"CAA", "example.com", "CAA", []any{int64(0), "issue", "letsencrypt.org"}, "@", "example.com", `0 issue "letsencrypt.org"`},
+		{"TXT", "www.example.com", "TXT", []any{"raw text"}, "www", "www.example.com", `"raw text"`},
 	}
 	for _, tc := range tests {
 		t.Run(tc.name, func(t *testing.T) {
 			records, err := nativeToRecords(gcoreRRSetExtended{
-				Name: "www.example.com.", Type: tc.rrtype, TTL: 300,
+				Name: tc.rrname, Type: tc.rrtype, TTL: 300,
 				Records: []dnssdk.ResourceRecord{{Content: tc.content}},
 			}, dc)
 			if err != nil {
 				t.Fatal(err)
 			}
+			if got := records[0].GetLabel(); got != tc.wantLabel {
+				t.Errorf("label = %q, want %q", got, tc.wantLabel)
+			}
+			if got := records[0].GetLabelFQDN(); got != tc.wantFQDN {
+				t.Errorf("fqdn = %q, want %q", got, tc.wantFQDN)
+			}
 			if got := records[0].GetRDATA().String(); got != tc.wantTarget {
 				t.Errorf("target = %q, want %q", got, tc.wantTarget)
 			}
```

---

### Incident Patch 10: `1f400d2c` (2026-09-19)
**Commit Message**: fix(p/SCALEWAY): correct TXT round-trip, SVCB params, SSHFP case, NS TTL, and PTR support (#4919)

Five fixes to the SCALEWAY provider, all found by running the
integration suite against a live Scaleway zone.

## TXT round-trip

`unquoteTXT` assumed the value Scaleway returns is escaped the same way
as the value we send. It is not, and the asymmetry is easy to miss:

* On **write**, Scaleway accepts a BIND-style quoted string and
unescapes it.
* On **read**, it wraps the raw stored bytes in quotes and escapes
*only* interior double quotes (`"` to `\"`). Backslashes come back
verbatim.

So the correct inverse strips the surrounding quotes and unescapes `\"`
alone. Unescaping `\` as well double-unescaped the value, halving runs
of backslashes: `a\\b` read back as `a\b`, and the record was then
offered as a correction on every run.

The unit test now models both sides of the server round-trip rather than
just calling `quoteTXT`/`unquoteTXT` back to back, which is what let the
bug through: the two functions were each other's inverse, but the server
is not.

## TXT values Scaleway silently rewrites

Two new audit rules, because Scaleway modifies these server-side and the
record can ther

**File**: `documentation/provider/index.md` (modified, +1/-1)
```diff
@@ -229,7 +229,7 @@ Jump to a table:
 | [`ROUTE53`](route53.md) | ❌ | ❔ | ❌ | ✅ | ✅ |
 | [`RWTH`](rwth.md) | ❌ | ❔ | ❌ | ✅ | ❔ |
 | [`SAKURACLOUD`](sakuracloud.md) | ✅ | ❌ | ❌ | ✅ | ❌ |
-| [`SCALEWAY`](scaleway.md) | ✅ | ✅ | ❌ | ✅ | ❌ |
+| [`SCALEWAY`](scaleway.md) | ✅ | ✅ | ❌ | ❌ | ❌ |
 | [`SOFTLAYER`](softlayer.md) | ❔ | ❔ | ❌ | ❔ | ❔ |
 | [`TENCENTDNS`](tencentdns.md) | ❌ | ❔ | ❔ | ❌ | ❔ |
 | [`TRANSIP`](transip.md) | ✅ | ❌ | ❌ | ❌ | ❌ |
```

**File**: `documentation/provider/scaleway.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ managed by DNSControl.
   - [`ALIAS`](../language-reference/domain-modifiers/ALIAS.md): ✅
   - [`DNAME`](../language-reference/domain-modifiers/DNAME.md): ✅
   - [`LOC`](../language-reference/domain-modifiers/LOC.md): ❌
-  - [`PTR`](../language-reference/domain-modifiers/PTR.md): ✅
+  - [`PTR`](../language-reference/domain-modifiers/PTR.md): ❌
   - [`SOA`](../language-reference/domain-modifiers/SOA.md): ❌
 - Service discovery
   - [`DHCID`](../language-reference/domain-modifiers/DHCID.md): ❌
```

**File**: `providers/scaleway/auditrecords.go` (modified, +27/-0)
```diff
@@ -1,6 +1,8 @@
 package scaleway
 
 import (
+	"errors"
+
 	"github.com/DNSControl/dnscontrol/v5/models"
 	"github.com/DNSControl/dnscontrol/v5/pkg/rejectif"
 )
@@ -11,5 +13,30 @@ import (
 func AuditRecords(records models.Records) []error {
 	a := rejectif.Auditor{}
 	a.Add("TXT", rejectif.TxtIsEmpty)
+
+	// The API trims a TXT value before storing it, so a leading or trailing
+	// space is dropped without being reported. Left alone that reads as a
+	// permanently pending change: the record never matches what was asked for.
+	// Interior whitespace is kept. Last verified 2026-09-19.
+	a.Add("TXT", rejectif.TxtStartsOrEndsWithSpaces)
+
+	// Last verified 2026-09-19.
+	a.Add("TXT", txtStartsOrEndsWithDoubleQuote)
+
 	return a.Audit(records)
 }
+
+// txtStartsOrEndsWithDoubleQuote rejects TXT values that begin or end with a
+// double quote. Scaleway drops a leading or trailing double quote server-side,
+// so such a value can never round-trip. Interior double quotes are stored
+// as-is and are therefore not rejected.
+func txtStartsOrEndsWithDoubleQuote(rc *models.RecordConfig) error {
+	txt := rc.GetTargetTXTJoined()
+	if txt == "" {
+		return nil
+	}
+	if txt[0] == '"' || txt[len(txt)-1] == '"' {
+		return errors.New("txtstring starts or ends with a doublequote")
+	}
+	return nil
+}
```

**File**: `providers/scaleway/convert.go` (modified, +42/-9)
```diff
@@ -4,6 +4,8 @@ import (
 	"fmt"
 	"strings"
 
+	dnsrdatav2 "codeberg.org/miekg/dns/rdata"
+
 	"github.com/DNSControl/dnscontrol/v5/models"
 	domain "github.com/scaleway/scaleway-sdk-go/api/domain/v2beta1"
 )
@@ -62,16 +64,42 @@ func fromRecordConfig(rc *models.RecordConfig) domain.Record {
 		TTL:  rc.TTL,
 	}
 
-	if rc.Type == "TXT" {
+	switch rc.Type {
+	case "TXT":
 		// Scaleway accepts the TXT data BIND-style quoted, so build that form
 		// from the joined value directly.
 		rec.Data = quoteTXT(rc.GetTargetTXTJoined())
-		return rec
+	case "SVCB", "HTTPS":
+		// The RDATA's String() quotes every SvcParam value (e.g. port="80",
+		// alpn="h2,h3"), which Scaleway's parser rejects. Build the data with
+		// unquoted params (port=80, alpn=h2,h3) instead.
+		rec.Data = svcbData(rc)
+	case "SSHFP":
+		// dnscontrol stores the fingerprint uppercase (for case-insensitive
+		// comparison) but Scaleway only accepts lowercase hex.
+		rec.Data = strings.ToLower(rc.GetRDATA().String())
+	default:
+		rec.Data = rc.GetRDATA().String()
 	}
-	rec.Data = rc.GetRDATA().String()
 	return rec
 }
 
+// svcbData renders a SVCB or HTTPS record as "<priority> <target> <params>",
+// with the params left unquoted.
+func svcbData(rc *models.RecordConfig) string {
+	var f dnsrdatav2.SVCB
+	if rc.Type == "HTTPS" {
+		f = rc.AsHTTPS()
+	} else {
+		f = rc.AsSVCB()
+	}
+	params := models.Svcbv2ValueToString(f.Value)
+	if params == "" {
+		return fmt.Sprintf("%d %s", f.Priority, f.Target)
+	}
+	return fmt.Sprintf("%d %s %s", f.Priority, f.Target, params)
+}
+
 // quoteTXT returns s as a BIND-style quoted string: every `\` and `"` is
 // escaped with a backslash and the whole thing is wrapped in double quotes.
 func quoteTXT(s string) string {
@@ -89,8 +117,14 @@ func quoteTXT(s string) string {
 	return b.String()
 }
 
-// unquoteTXT parses a BIND-style quoted TXT value back to its raw bytes.
-// If the input has no surrounding quotes, it is returned unchanged.
+// unquoteTXT recovers the raw TXT value from what Scaleway returns.
+//
+// Scaleway unescapes the BIND-quoted value we send on write. On read it wraps
+// the raw stored bytes in a pair of quotes and escapes only interior double
+// quotes (`"` -> `\"`); backslashes are returned verbatim, NOT re-escaped. So
+// the correct inverse is to strip the surrounding quotes and unescape `\"`
+// only — unescaping `\` as well would double-unescape (e.g. halving runs of
+// backslashes). If the input has no surrounding quotes it is returned as-is.
 func unquoteTXT(s string) (string, error) {
 	if len(s) < 2 || s[0] != '"' || s[len(s)-1] != '"' {
 		return s, nil
@@ -99,13 +133,12 @@ func unquoteTXT(s string) (string, error) {
 	var b strings.Builder
 	b.Grow(len(inner))
 	for i := 0; i < len(inner); i++ {
-		c := inner[i]
-		if c == '\\' && i+1 < len(inner) {
+		if inner[i] == '\\' && i+1 < len(inner) && inner[i+1] == '"' {
+			b.WriteByte('"')
 			i++
-			b.WriteByte(inner[i])
 			continue
 		}
-		b.WriteByte(c)
+		b.WriteByte(inner[i])
 	}
 	return b.String(), nil
 }
```

**File**: `providers/scaleway/convert_test.go` (modified, +47/-8)
```diff
@@ -1,23 +1,62 @@
 package scaleway
 
-import "testing"
+import (
+	"strings"
+	"testing"
+)
 
-func TestQuoteUnquoteTXT(t *testing.T) {
+// bindUnescape mimics Scaleway's write-side handling: it takes the BIND-style
+// quoted value we send and returns the raw bytes Scaleway stores (strip the
+// surrounding quotes, then process `\` escapes).
+func bindUnescape(s string) string {
+	if len(s) < 2 || s[0] != '"' || s[len(s)-1] != '"' {
+		return s
+	}
+	inner := s[1 : len(s)-1]
+	var b strings.Builder
+	for i := 0; i < len(inner); i++ {
+		if inner[i] == '\\' && i+1 < len(inner) {
+			i++
+		}
+		b.WriteByte(inner[i])
+	}
+	return b.String()
+}
+
+// fakeScalewayRoundTrip simulates the full server round-trip for a TXT value:
+// we send quoteTXT(value); Scaleway unescapes and stores it; on read it wraps
+// the raw bytes in quotes again, escaping interior double quotes as `\"` but
+// leaving backslashes verbatim.
+func fakeScalewayRoundTrip(value string) string {
+	stored := bindUnescape(quoteTXT(value))
+	returned := strings.ReplaceAll(stored, `"`, `\"`)
+	return `"` + returned + `"`
+}
+
+// TestTXTRoundTrip checks that a TXT value survives the trip through Scaleway.
+// Values that AuditRecords rejects are left out: they never reach this code.
+func TestTXTRoundTrip(t *testing.T) {
 	cases := []string{
-		"",
 		"hello",
 		`a "quoted" string`,
-		`back\slash`,
+		`in"side`,
+		`in"ter"ior`,
+		`1back\slash`,
+		`2back\\slash`,
+		`3back\\\slash`,
+		`4back\\\\slash`,
 		"v=spf1 include:_spf.example.com ~all",
+		"with spaces",
 	}
 	for _, in := range cases {
-		q := quoteTXT(in)
-		out, err := unquoteTXT(q)
+		returned := fakeScalewayRoundTrip(in)
+		out, err := unquoteTXT(returned)
 		if err != nil {
-			t.Fatalf("unquoteTXT(%q) err: %v", q, err)
+			t.Fatalf("unquoteTXT(%q) err: %v", returned, err)
 		}
 		if out != in {
-			t.Errorf("round-trip mismatch: in=%q quoted=%q out=%q", in, q, out)
+			t.Errorf("round-trip mismatch: in=%q sent=%q returned=%q out=%q",
+				in, quoteTXT(in), returned, out)
 		}
 	}
 }
```

#### Recent Merged Pull Requests:
- **PR #4953** (2026-09-30): build(deps): bump brace-expansion from 5.0.9 to 5.0.12 (@dependabot[bot])
- **PR #4952** (2026-09-30): build(deps): bump js-yaml from 5.2.3 to 5.4.2 (@dependabot[bot])
- **PR #4951** (2026-09-30): feat(p/BUNNYDNS): manage health monitoring features via dnsconfig.js (@xddxdd)
- **PR #4948** (2026-09-29): docs: Autogenerate the table in README.md (@TomOnTime)
- **PR #4947** (2026-09-29): chore: Update FORTIGATE capabilities, INFOBLOX owner, and linting (@TomOnTime)
- **PR #4946** (2026-09-28): chore: Update dependencies (@TomOnTime)
- **PR #4945** (2026-09-28): fix(p/REALTIMEREGISTER): ensure proper quoting of txt records (@BigDataJohan)
- **PR #4944** (2026-09-30): feat: Normalize all "targethost" and hex-encoded fields (@TomOnTime)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
