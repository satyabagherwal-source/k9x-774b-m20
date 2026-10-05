# Forensic Learning Record (Deep Inspection): linkerd/linkerd2

> **Canonical Artifact**: `07_PROJECT_LEARNING/linkerd-linkerd2-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/linkerd/linkerd2](https://github.com/linkerd/linkerd2))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:29:38.787Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `linkerd/linkerd2`
- **Description**: Ultralight, security-first service mesh for Kubernetes. Main repo for Linkerd 2.x.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 11506 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `charts/templates.go`
```
package charts

import (
	"embed"
)

//go:embed linkerd-control-plane linkerd-crds linkerd2-cni all:partials patch
var Templates embed.FS

```

### Core Architecture Module: `cli/cmd/authz.go`
```
package cmd

import (
	"fmt"
	"os"

	"github.com/linkerd/linkerd2/cli/table"
	pkgcmd "github.com/linkerd/linkerd2/pkg/cmd"
	"github.com/linkerd/linkerd2/pkg/k8s"
	"github.com/spf13/cobra"
)

func newCmdAuthz() *cobra.Command {

	var namespace string

	cmd := &cobra.Command{
		Use:   "authz [flags] resource",
		Short: "List authorizations for a resource",
		Long:  "List authorizations for a resource.",
		Args:  cobra.RangeArgs(1, 2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {

			k8sAPI, err := k8s.NewAPI(kubeconfigPath, kubeContext, impersonate, impersonateGroup, 0)
			if err != nil {
				return nil, cobra.ShellCompDirectiveError
			}

			if namespace == "" {
				namespace = pkgcmd.GetDefaultNamespace(kubeconfigPath, kubeContext)
			}

			cc := k8s.NewCommandCompletion(k8sAPI, namespace)

			results, err := cc.Complete(args, toComplete)
			if err != nil {
				return nil, cobra.ShellCompDirectiveError
			}

			return results, cobra.ShellCompDirectiveDefault
		},
		RunE: func(cmd *cobra.Command, args []string) error {

			if namespace == "" {
				namespace = pkgcmd.GetDefaultNamespace(kubeconfigPath, kubeContext)
			}

			k8sAPI, err := k8s.NewAPI(kubeconfigPath, kubeContext, impersonate, impersonateGroup, 0)
			if err != nil {
				return err
			}

			var resource string
			if len(args) == 1 {
				resource = args[0]
			} else if len(args) == 2 {
				resource = args[0] + "/" + args[1]
			}

			rows := make([]table.Row, 0)

			authzs, err := k8s.AuthorizationsForResource(cmd.Context(), k8sAPI, namespace, resource)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to get serverauthorization resources: %s\n", err)
				os.Exit(1)
			}

			for _, authz := range authzs {
				if authz.Route == "" {
					authz.Route = "*"
				}
				rows = append(rows, table.Row{authz.Route, authz.Server, authz.AuthorizationPolicy, authz.ServerAuthorization})
			}

			cols := []table.Column{
				{Header: "ROUTE", Width: 6, Flexible: true, LeftAlign: true},
				{Header: "SERVER", Width: 6, Flexible: true, LeftAlign: true},
				{Header: "AUTHORIZATION_POLICY", Width: 21, Flexible: true, LeftAlign: true},
				{Header: "SERVER_AUTHORIZATION", Width: 21, Flexible: true, LeftAlign: true},
			}

			table := table.NewTable(cols, rows)
			table.Render(os.Stdout)

			return nil
		},
	}

	cmd.PersistentFlags().StringVarP(&namespace, "namespace", "n", "", "Namespace of resource")

	pkgcmd.ConfigureNamespaceFlagCompletion(cmd, []string{"namespace"},
		kubeconfigPath, impersonate, impersonateGroup, kubeContext)
	return cmd
}

```

### Core Architecture Module: `cli/cmd/check.go`
```
package cmd

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	charts "github.com/linkerd/linkerd2/pkg/charts/linkerd2"
	pkgcmd "github.com/linkerd/linkerd2/pkg/cmd"
	"github.com/linkerd/linkerd2/pkg/healthcheck"
	"github.com/linkerd/linkerd2/pkg/k8s"
	"github.com/linkerd/linkerd2/pkg/version"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	valuespkg "helm.sh/helm/v3/pkg/cli/values"
	utilsexec "k8s.io/utils/exec"
)

type checkOptions struct {
	versionOverride    string
	preInstallOnly     bool
	crdsOnly           bool
	dataPlaneOnly      bool
	wait               time.Duration
	namespace          string
	cniEnabled         bool
	output             string
	cliVersionOverride string
}

func newCheckOptions() *checkOptions {
	return &checkOptions{
		versionOverride:    "",
		preInstallOnly:     false,
		crdsOnly:           false,
		dataPlaneOnly:      false,
		wait:               300 * time.Second,
		namespace:          "",
		cniEnabled:         false,
		output:             tableOutput,
		cliVersionOverride: "",
	}
}

// nonConfigFlagSet specifies flags not allowed with `linkerd check config`
func (options *checkOptions) nonConfigFlagSet() *pflag.FlagSet {
	flags := pflag.NewFlagSet("non-config-check", pflag.ExitOnError)

	flags.BoolVar(&options.cniEnabled, "linkerd-cni-enabled", options.cniEnabled, "When running pre-installation checks (--pre), assume the linkerd-cni plugin is already installed, and a NET_ADMIN check is not needed")
	flags.StringVarP(&options.namespace, "namespace", "n", options.namespace, "Namespace to use for --proxy checks (default: all namespaces)")
	flags.BoolVar(&options.preInstallOnly, "pre", options.preInstallOnly, "Only run pre-installation checks, to determine if the control plane can be installed")
	flags.BoolVar(&options.crdsOnly, "crds", options.crdsOnly, "Only run checks which determine if the Linkerd CRDs have been installed")
	flags.BoolVar(&options.dataPlaneOnly, "proxy", options.dataPlaneOnly, "Only run data-plane checks, to determine if the data plane is healthy")

	return flags
}

// checkFlagSet specifies flags allowed with and without `config`
func (options *checkOptions) checkFlagSet() *pflag.FlagSet {
	flags := pflag.NewFlagSet("check", pflag.ExitOnError)

	flags.StringVar(&options.versionOverride, "expected-version", options.versionOverride, "Overrides the version used when checking if Linkerd is running the latest version (mostly for testing)")
	flags.StringVar(&options.cliVersionOverride, "cli-version-override", "", "Used to override the version of the cli (mostly for testing)")
	flags.StringVarP(&options.output, "output", "o", options.output, "Output format. One of: table, json, short")
	flags.DurationVar(&options.wait, "wait", options.wait, "Maximum allowed time for all tests to pass")

	return flags
}

func (options *checkOptions) validate() error {
	if options.preInstallOnly && options.dataPlaneOnly {
		return errors.New("--pre and --proxy flags are mutually exclusive")
	}
	if options.preInstallOnly && options.crdsOnly {
		return errors.New("--pre and --crds flags are mutually exclusive")
	}
	if !options.preInstallOnly && options.cniEnabled {
		return errors.New("--linkerd-cni-enabled can only be used with --pre")
	}
	if options.output != tableOutput && options.output != jsonOutput && options.output != shortOutput {
		return fmt.Errorf("Invalid output type '%s'. Supported output types are: %s, %s, %s", options.output, jsonOutput, tableOutput, shortOutput)
	}
	return nil
}

func newCmdCheck() *cobra.Command {
	options := newCheckOptions()
	checkFlags := options.checkFlagSet()
	nonConfigFlags := options.nonConfigFlagSet()

	cmd := &cobra.Command{
		Use:   "check [flags]",
		Args:  cobra.NoArgs,
		Short: "Check the Linkerd installation for potential problems",
		Long: `Check the Linkerd installation for potential problems.

The check command will perform a series of checks to validate that the linkerd
CLI and control plane are configured correctly. If the command encounters a
failure it will print additional information about the failure and exit with a
non-zero exit code.`,
		Example: `  # Check that the Linkerd control plane is up and running
  linkerd check

  # Check that the Linkerd control plane can be installed in the "test" namespace
  linkerd check --pre --linkerd-namespace test

  # Check that the Linkerd data plane proxies in the "app" namespace are up and running
  linkerd check --proxy --namespace app`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return configureAndRunChecks(cmd, stdout, stderr, options)
		},
	}

	cmd.PersistentFlags().AddFlagSet(checkFlags)
	cmd.Flags().AddFlagSet(nonConfigFlags)

	pkgcmd.ConfigureNamespaceFlagCompletion(cmd, []string{"namespace"},
		kubeconfigPath, impersonate, impersonateGroup, kubeContext)

	return cmd
}

func configureAndRunChecks(cmd *cobra.Command, wout io.Writer, werr io.Writer, options *checkOptions) error {
	err := options.validate()
	if err != nil {
		return fmt.Errorf("Validation error when executing check command: %w", err)
	}

	if options.cliVersionOverride != "" {
		version.Version = options.cliVersionOverride
	}

	checks := []healthcheck.CategoryID{
		healthcheck.KubernetesAPIChecks,
		healthcheck.KubernetesVersionChecks,
		healthcheck.GatewayAPICRDChecks,
		healthcheck.LinkerdVersionChecks,
	}

	crdManifest := bytes.Buffer{}
	err = renderCRDs(cmd.Context(), nil, &crdManifest, valuespkg.Options{
		// Gateway API CRDs are checked separately by GatewayAPICRDChecks.
		Values: []string{
			"installGatewayAPI=false",
		},
	}, "yaml")
	if err != nil {
		return err
	}
	var installManifest string
	var values *charts.Values
	if options.preInstallOnly {
		checks = append(checks, healthcheck.LinkerdPreInstallChecks)
		if options.cniEnabled {
			checks = append(checks, healthcheck.LinkerdCNIPluginChecks)
		}
		values, installManifest, err = renderInstallManifest(cmd.Context())
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error rendering install manifest: %s\n", err)
			os.Exit(1)
		}
	} else if options.crdsOnly {
		checks = append(checks, healthcheck.LinkerdCRDChecks)
	} else {
		checks = append(checks, healthcheck.LinkerdConfigChecks)

		checks = append(checks, healthcheck.LinkerdControlPlaneExistenceChecks)
		checks = append(checks, healthcheck.LinkerdIdentity)
		checks = append(checks, healthcheck.LinkerdWebhooksAndAPISvcTLS)
		checks = append(checks, healthcheck.LinkerdControlPlaneProxyChecks)

		if options.dataPlaneOnly {
			checks = append(checks, healthcheck.LinkerdDataPlaneChecks)
			checks = append(checks, healthcheck.LinkerdIdentityDataPlane)
			checks = append(checks, healthcheck.LinkerdOpaquePortsDefinitionChecks)
		} else {
			checks = append(checks, healthcheck.LinkerdControlPlaneVersionChecks)
			checks = append(checks, healthcheck.LinkerdExtensionChecks)
		}
		checks = append(checks, healthcheck.LinkerdCNIPluginChecks)
		checks = append(checks, healthcheck.LinkerdHAChecks)
	}

	hc := healthcheck.NewHealthChecker(checks, &healthcheck.Options{
		IsMainCheckCommand:    true,
		ControlPlaneNamespace: controlPlaneNamespace,
		CNINamespace:          cniNamespace,
		DataPlaneNamespace:    options.namespace,
		KubeConfig:            kubeconfigPath,
		KubeContext:           kubeContext,
		Impersonate:           impersonate,
		ImpersonateGroup:      impersonateGroup,
		APIAddr:               apiAddr,
		VersionOverride:       options.versionOverride,
		RetryDeadline:         time.Now().Add(options.wait),
		CNIEnabled:            options.cniEnabled,
		InstallManifest:       installManifest,
		CRDManifest:           crdManifest.String(),
		ChartValues:           values,
	})

	success, warning := healthcheck.RunChecks(wout, werr, hc, options.output)

	if !options.preInstallOnly && !options.crdsOnly {
		extensionSuccess, extensionWarning, err := runExtensionChecks(cmd, wout, werr, options)
		if err != nil {
			fmt.Fprintf(werr, "Failed to run extensions checks: %s\n", err)
			os.Exit(1)
		}

```

### Core Architecture Module: `cli/cmd/check_extensions.go`
```
package cmd

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/briandowns/spinner"
	"github.com/linkerd/linkerd2/pkg/healthcheck"
	"github.com/linkerd/linkerd2/pkg/version"
	"github.com/mattn/go-isatty"
	utilsexec "k8s.io/utils/exec"
)

// glob is satisfied by filepath.Glob.
type glob func(string) ([]string, error)

// extension contains the full path of an extension executable. If it's a
// a built-in extension, path will be the `linkerd` executable and builtin will
// be the extension name (multicluster, or viz).
type extension struct {
	path    string
	builtin string
}

var (
	builtInChecks = map[string]struct{}{
		"multicluster": {},
		"viz":          {},
	}
)

// findExtensions searches the path for all linkerd-* executables and returns a
// slice of check commands, and a slice of missing checks.
func findExtensions(pathEnv string, glob glob, exec utilsexec.Interface, nsLabels []string) ([]extension, []string) {
	cliExtensions := findCLIExtensionsOnPath(pathEnv, glob, exec)

	// first, collect extensions that are "always" enabled
	extensions := findAlwaysChecks(cliExtensions, exec)

	alwaysSuffixSet := map[string]struct{}{}
	for _, e := range extensions {
		alwaysSuffixSet[suffix(e.path)] = struct{}{}
	}

	// nsLabelSet is the set of extension names which are installed on the cluster
	// but are not "always" checks
	nsLabelSet := map[string]struct{}{}
	for _, label := range nsLabels {
		if _, ok := alwaysSuffixSet[label]; !ok {
			nsLabelSet[label] = struct{}{}
		}
	}

	// second, collect on-cluster extensions
	for _, e := range cliExtensions {
		suffix := suffix(e)
		if _, ok := nsLabelSet[suffix]; ok {
			extensions = append(extensions, extension{path: e})
			delete(nsLabelSet, suffix)
		}
	}

	// third, collect built-in extensions
	for label := range nsLabelSet {
		if _, ok := builtInChecks[label]; ok {
			extensions = append(extensions, extension{path: os.Args[0], builtin: label})
			delete(nsLabelSet, label)
		}
	}

	// anything left in nsLabelSet is a missing executable
	missing := []string{}
	for label := range nsLabelSet {
		missing = append(missing, fmt.Sprintf("linkerd-%s", label))
	}

	sort.Slice(extensions, func(i, j int) bool {
		if extensions[i].path != extensions[j].path {
			_, filename1 := filepath.Split(extensions[i].path)
			_, filename2 := filepath.Split(extensions[j].path)
			return filename1 < filename2
		}
		return extensions[i].builtin < extensions[j].builtin
	})
	sort.Strings(missing)

	return extensions, missing
}

// findCLIExtensionsOnPath searches the path for all linkerd-* executables and
// returns a slice of unique filepaths. if multiple executables have the same
// name, only the one which comes earliest in the pathEnv is returned.
func findCLIExtensionsOnPath(pathEnv string, glob glob, exec utilsexec.Interface) []string {
	executables := []string{}
	seen := map[string]struct{}{}

	for _, dir := range filepath.SplitList(pathEnv) {
		matches, err := glob(filepath.Join(dir, "linkerd-*"))
		if err != nil {
			continue
		}
		sort.Strings(matches)

		for _, match := range matches {
			suffix := suffix(match)
			if _, ok := seen[suffix]; ok {
				continue
			}

			path, err := exec.LookPath(match)
			if err != nil {
				continue
			}

			executables = append(executables, path)
			seen[suffix] = struct{}{}
		}
	}

	return executables
}

// findAlwaysChecks filters a slice of linkerd-* executables to only those that
// support the "_extension-metadata" subcommand, and announce themselves to
// "always" run.
func findAlwaysChecks(cliExtensions []string, exec utilsexec.Interface) []extension {
	extensions := []extension{}

	for _, e := range cliExtensions {
		if isAlwaysCheck(e, exec) {
			extensions = append(extensions, extension{path: e})
		}
	}

	return extensions
}

// isAlwaysCheck executes a command with an "_extension-metadata" subcommand,
// and returns true if the output is a valid ExtensionMetadataOutput struct.
func isAlwaysCheck(path string, exec utilsexec.Interface) bool {
	cmd := exec.Command(path, healthcheck.ExtensionMetadataSubcommand)
	var stdout, stderr bytes.Buffer
	cmd.SetStdout(&stdout)
	cmd.SetStderr(&stderr)
	err := cmd.Run()
	if err != nil {
		return false
	}

	metadataOutput, err := parseJSONMetadataOutput(stdout.Bytes())
	if err != nil {
		return false
	}

	// output of _extension-metadata must match the executable name, and specific
	// "always"
	// i.e. linkerd-foo is allowed, linkerd-foo-v0.XX.X is not
	_, filename := filepath.Split(path)
	return strings.EqualFold(metadataOutput.Name, filename) && metadataOutput.Checks == healthcheck.Always
}

// parseJSONMetadataOutput parses the output of an _extension-metadata
// subcommand. The data is expected to be a ExtensionMetadataOutput struct
// serialized to json.
func parseJSONMetadataOutput(data []byte) (healthcheck.ExtensionMetadataOutput, error) {
	var metadata healthcheck.ExtensionMetadataOutput
	err := json.Unmarshal(data, &metadata)
	if err != nil {
		return healthcheck.ExtensionMetadataOutput{}, err
	}
	return metadata, nil
}

// runExtensionsChecks runs checks for each extension name passed into the
// `extensions` parameter and handles formatting the output for each extension's
// check. This function also prints check warnings for missing extensions.
func runExtensionsChecks(
	wout io.Writer, werr io.Writer, extensions []extension, missing []string, utilsexec utilsexec.Interface, flags []string, output string,
) (bool, bool) {
	spin := spinner.New(spinner.CharSets[9], 100*time.Millisecond)
	spin.Writer = wout

	success := true
	warning := false
	for _, extension := range extensions {
		args := append([]string{"check"}, flags...)
		if extension.builtin != "" {
			args = append([]string{extension.builtin}, args...)
		}

		if isatty.IsTerminal(os.Stdout.Fd()) {
			name := suffix(extension.path)
			if extension.builtin != "" {
				name = extension.builtin
			}

			spin.Suffix = fmt.Sprintf(" Running %s extension check", name)
			spin.Color("bold") // this calls spin.Restart()
		}

		plugin := utilsexec.Command(extension.path, args...)
		var stdout, stderr bytes.Buffer
		plugin.SetStdout(&stdout)
		plugin.SetStderr(&stderr)
		plugin.Run()
		results, err := parseJSONCheckOutput(stdout.Bytes())
		spin.Stop()
		if err != nil {
			success = false

			command := fmt.Sprintf("%s %s", extension.path, strings.Join(args, " "))
			if len(stderr.String()) > 0 {
				err = errors.New(stderr.String())
			} else {
				err = fmt.Errorf("invalid extension check output from \"%s\" (JSON object expected):\n%s\n[%w]", command, stdout.String(), err)
			}
			_, filename := filepath.Split(extension.path)
			results = healthcheck.CheckResults{
				Results: []healthcheck.CheckResult{
					{
						Category:    healthcheck.CategoryID(filename),
						Description: fmt.Sprintf("Running: %s", command),
						Err:         err,
						HintURL:     healthcheck.HintBaseURL(version.Version) + "extensions",
					},
				},
			}
		}

		extensionSuccess, extensionWarning := healthcheck.RunChecks(wout, werr, results, output)
		if !extensionSuccess {
			success = false
		}
		if extensionWarning {
			warning = true
		}
	}

	for _, m := range missing {
		results := healthcheck.CheckResults{
			Results: []healthcheck.CheckResult{
				{
					Category:    healthcheck.CategoryID(m),
					Description: fmt.Sprintf("Linkerd extension command %s exists", m),
					Err:         &exec.Error{Name: m, Err: exec.ErrNotFound},
					HintURL:     healthcheck.HintBaseURL(version.Version) + "extensions",
					Warning:     true,
				},
			},
		}

		extensionSuccess, extensionWarning := healthcheck.RunChecks(wout, werr, results, output)
		if !extensionSuccess {
			success = false
		}
		if extensionWarning {
			warning = true
		}
	}

	return success, warning
}

// parseJSONCheckOutput parses the output of a check command run with json
// output mode. The data is expected to be a CheckOutput struct serialized
// to json. In 
```

### Core Architecture Module: `cli/cmd/completion.go`
```
package cmd

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/spf13/cobra"
)

// newCmdCompletion creates a new cobra command `completion` which contains commands for
// enabling linkerd auto completion
func newCmdCompletion() *cobra.Command {
	example := `  # bash <= 3.2:
  # To load shell completion into your current shell session
  source /dev/stdin <<< "$(linkerd completion bash)"

  # bash >= 4.0:
  source <(linkerd completion bash)

  # To load shell completion for every shell session
  # bash <= 3.2 on osx:
  brew install bash-completion # ensure you have bash-completion 1.3+
  linkerd completion bash > $(brew --prefix)/etc/bash_completion.d/linkerd

  # bash >= 4.0 on osx:
  brew install bash-completion@2
  linkerd completion bash > $(brew --prefix)/etc/bash_completion.d/linkerd

  # bash >= 4.0 on linux:
  linkerd completion bash > /etc/bash_completion.d/linkerd

  # You will need to start a new shell for this setup to take effect.

  # zsh:
  # If shell completion is not already enabled in your environment you will need
  # to enable it.  You can execute the following once:

  echo "autoload -U compinit && compinit" >> ~/.zshrc

  # create a linkerd 'plugins' folder and add it to your $fpath
  mkdir $ZSH/plugins/linkerd && echo "fpath=($ZSH/plugins/linkerd $fpath)" >> ~/.zshrc

  # To load completions for each session, execute once:
  linkerd completion zsh > "${fpath[1]}/_linkerd" && exec $SHELL

  # You will need to start a new shell for this setup to take effect.

  # fish:
  linkerd completion fish | source

  # To load fish shell completions for each session, execute once:
  linkerd completion fish > ~/.config/fish/completions/linkerd.fish`

	cmd := &cobra.Command{
		Use:       "completion [bash|zsh|fish]",
		Short:     "Output shell completion code for the specified shell (bash, zsh or fish)",
		Long:      "Output shell completion code for the specified shell (bash, zsh or fish).",
		Example:   example,
		Args:      cobra.ExactArgs(1),
		ValidArgs: []string{"bash", "zsh", "fish"},
		RunE: func(cmd *cobra.Command, args []string) error {
			out, err := getCompletion(args[0], cmd.Parent())
			if err != nil {
				return err
			}

			fmt.Print(out)
			return nil
		},
	}

	return cmd
}

// getCompletion will return the auto completion shell script, if supported
func getCompletion(sh string, parent *cobra.Command) (string, error) {
	var err error
	var buf bytes.Buffer

	switch sh {
	case "bash":
		err = parent.GenBashCompletion(&buf)
	case "zsh":
		err = parent.GenZshCompletion(&buf)
	case "fish":
		err = parent.GenFishCompletion(&buf, true)

	default:
		err = errors.New("unsupported shell type (must be bash, zsh or fish): " + sh)
	}

	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

```

### Core Architecture Module: `cli/cmd/controller-metrics.go`
```
package cmd

import (
	"bytes"
	"fmt"
	"time"

	"github.com/linkerd/linkerd2/pkg/k8s"
	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ControllerMetricsOptions holds values for command line flags that apply to the controller-metrics
// command.
type ControllerMetricsOptions struct {
	wait time.Duration
}

// newControllerMetricsOptions initializes controller-metrics options setting
// the max wait time duration as 30 seconds to fetch controller-metrics
//
// This option may be overridden on the CLI at run-time
func newControllerMetricsOptions() *ControllerMetricsOptions {
	return &ControllerMetricsOptions{
		wait: 30 * time.Second,
	}
}

// newCmdControllerMetrics creates a new cobra command `controller-metrics` which contains commands to fetch control plane container's metrics
func newCmdControllerMetrics() *cobra.Command {
	options := newControllerMetricsOptions()

	cmd := &cobra.Command{
		Use:     "controller-metrics",
		Aliases: []string{"cp-metrics"},
		Short:   "Fetch metrics directly from the Linkerd control plane containers",
		Long: `Fetch metrics directly from Linkerd control plane containers.

  This command initiates port-forward to each control plane process, and
  queries the /metrics endpoint on them.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			k8sAPI, err := k8s.NewAPI(kubeconfigPath, kubeContext, impersonate, impersonateGroup, 0)
			if err != nil {
				return err
			}

			pods, err := k8sAPI.CoreV1().Pods(controlPlaneNamespace).List(cmd.Context(), metav1.ListOptions{})
			if err != nil {
				return err
			}

			results := getMetrics(k8sAPI, pods.Items, k8s.AdminHTTPPortNameSuffix, options.wait, verbose)

			var buf bytes.Buffer
			for i, result := range results {
				content := fmt.Sprintf("#\n# POD %s (%d of %d)\n", result.pod, i+1, len(results))
				if result.err != nil {
					content += fmt.Sprintf("# ERROR %s\n", result.err)
				} else {
					content += fmt.Sprintf("# CONTAINER %s \n#\n", result.container)
					content += string(result.metrics)
				}
				buf.WriteString(content)
			}
			fmt.Printf("%s", buf.String())

			return nil
		},
	}

	cmd.Flags().DurationVarP(&options.wait, "wait", "w", options.wait, "Time allowed to fetch diagnostics")

	return cmd
}

```

### Core Architecture Module: `cli/cmd/diagnostics.go`
```
package cmd

import (
	"github.com/spf13/cobra"
)

// newCmdDiagnostics creates a new cobra command `diagnostics` which contains commands to fetch Linkerd diagnostics
func newCmdDiagnostics() *cobra.Command {

	diagnosticsCmd := &cobra.Command{
		Use:     "diagnostics [flags]",
		Aliases: []string{"dg"},
		Args:    cobra.NoArgs,
		Short:   "Commands used to diagnose Linkerd components",
		Long: `Commands used to diagnose Linkerd components.

This command provides subcommands to diagnose the functionality of Linkerd.`,
		Example: `  # Get control-plane component metrics
  linkerd diagnostics controller-metrics

  # Get metrics from the web deployment in the emojivoto namespace.
  linkerd diagnostics proxy-metrics -n emojivoto deploy/web

  # Get the endpoints for authorities in Linkerd's control-plane itself
  linkerd diagnostics endpoints web.linkerd-viz.svc.cluster.local:8084
  `,
	}

	diagnosticsCmd.AddCommand(newCmdControllerMetrics())
	diagnosticsCmd.AddCommand(newCmdEndpoints())
	diagnosticsCmd.AddCommand(newCmdMetrics())
	diagnosticsCmd.AddCommand(newCmdPolicy())
	diagnosticsCmd.AddCommand(newCmdDiagnosticsProfile())

	return diagnosticsCmd
}

```

### Core Architecture Module: `cli/cmd/diagnostics_profile.go`
```
package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	destinationPb "github.com/linkerd/linkerd2-proxy-api/go/destination"
	"github.com/linkerd/linkerd2/controller/api/destination"
	pkgcmd "github.com/linkerd/linkerd2/pkg/cmd"
	"github.com/linkerd/linkerd2/pkg/k8s"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
)

type diagProfileOptions struct {
	destinationPod string
	contextToken   string
}

// validate performs all validation on the command-line options.
// It returns the first error encountered, or `nil` if the options are valid.
func (o *diagProfileOptions) validate() error {
	return nil
}

func newDiagProfileOptions() *diagProfileOptions {
	return &diagProfileOptions{}
}

func newCmdDiagnosticsProfile() *cobra.Command {
	options := newDiagProfileOptions()

	example := `  # Get the service profile for the service or endpoint at 10.20.2.4:8080
  linkerd diagnostics profile 10.20.2.4:8080`

	cmd := &cobra.Command{
		Use:     "profile [flags] address",
		Aliases: []string{"ep"},
		Short:   "Introspect Linkerd's service discovery state",
		Long: `Introspect Linkerd's service discovery state.

This command provides debug information about the internal state of the
control-plane's destination controller. It queries the same Destination service
endpoint as the linkerd-proxy's, and returns the profile associated with that
destination.`,
		Example: example,
		Args:    cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			err := options.validate()
			if err != nil {
				return err
			}

			var client destinationPb.DestinationClient
			var conn *grpc.ClientConn
			if apiAddr != "" {
				client, conn, err = destination.NewClient(apiAddr)
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error creating destination client: %s\n", err)
					os.Exit(1)
				}
			} else {
				k8sAPI, err := k8s.NewAPI(kubeconfigPath, kubeContext, impersonate, impersonateGroup, 0)
				if err != nil {
					return err
				}

				client, conn, err = destination.NewExternalClient(cmd.Context(), controlPlaneNamespace, k8sAPI, options.destinationPod)
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error creating destination client: %s\n", err)
					os.Exit(1)
				}
			}

			defer conn.Close()

			profile, err := requestProfileFromAPI(client, options.contextToken, args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "Destination API error: %s\n", err)
				os.Exit(1)
			}

			return writeProfileJSON(os.Stdout, profile)
		},
	}

	cmd.PersistentFlags().StringVar(&options.destinationPod, "destination-pod", "", "Target a specific destination Pod when there are multiple running")
	cmd.PersistentFlags().StringVar(&options.contextToken, "token", "", "The context token to use when making the request to the destination API")

	pkgcmd.ConfigureOutputFlagCompletion(cmd)

	return cmd
}

func requestProfileFromAPI(client destinationPb.DestinationClient, token string, addr string) (*destinationPb.DestinationProfile, error) {
	dest := &destinationPb.GetDestination{
		Path:         addr,
		ContextToken: token,
	}

	rsp, err := client.GetProfile(context.Background(), dest)
	if err != nil {
		return nil, err
	}

	return rsp.Recv()
}

func writeProfileJSON(w io.Writer, profile *destinationPb.DestinationProfile) error {
	b, err := json.MarshalIndent(profile, "", "  ")
	if err != nil {
		return err
	}

	_, err = fmt.Fprintln(w, string(b))
	return err
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15664** (2026-09-26): **version-2.20 tag was moved at some point**
  *Symptoms*: ### What is the issue?  https://github.com/Homebrew/homebrew-core/pull/299023  Hello, this is a homebrew maintainer and I have noticed that the tag was moved at some point. There was a PR to fix this but we haven't check it is intended or not.   Can you check the moved commit for tag v2.2.0 is valid and fine to use? Then I will open a new PR to fix this.  Thanks,  ### How can it be reproduced?  ``` brew install linkerd --build-from-source ```  ### Logs, error output, etc  ``` ==> Fetching downloads for: linkerd ✘ Formula linkerd (2.20) Error: version-2.20 tag should be 7977d505fc3d9ae7dddddd11779a82f813e405ac but is actually eadc1acf79ad2e766afbdceadb77f1594296fd77 ```  ### output of `linkerd check -o short`  none  ### Environment  MacOS 26  ### Possible solution  Just check wheth  ### Additional context  _No response_  ### Would you like to work on fixing this bug?  None
  **Post-Mortem & Fix Analysis**:
  > Formula is now deprecated. - https://github.com/Homebrew/homebrew-core/pull/312030
  > @daeho-ro Thanks for raising this! I had written a response to this last week and apparently never hit RETURN. 🙁   `version-2.20` actually wasn't moved: it was never the same as its associated edge release although it should've been, so the `eadc1acf` commit is actually correct. Can I just PR that into `homebrew-core`, or is there some other process here?  Thanks!

- **Issue #15551** (2026-08-21): **linkerd-destination panics with a nil pointer dereference when an ExternalWorkload is deleted**
  *Symptoms*: ### What is the issue?  `linkerd-destination` panics with a nil pointer dereference when an `ExternalWorkload` is deleted, if any proxy currently holds a discovery subscription for that workload's IP:port.  ### How can it be reproduced?  1. Mesh an external workload so an `ExternalWorkload` exists with `spec.ports` and `spec.workloadIPs`. 2. Send traffic to it, so a proxy holds an active discovery subscription for that IP:port. 3. Delete the `ExternalWorkload`.  ### Logs, error output, etc  Raw logs: ~~~~ panic: runtime error: invalid memory address or nil pointer dereference [signal SIGSEGV: segmentation violation code=0x1 addr=0x20 pc=0x1eb6c35]  goroutine 98438 [running]: watcher.(*workloadPublisher).updateExternalWorkload(0xc0022db0e0, 0x0) 	controller/api/destination/watcher/workload_watcher.go:774 +0x175 watcher.(*WorkloadWatcher).submitExternalWorkloadUpdate(0xc000666a80, 0xc000a11380, 0xd0?) 	controller/api/destination/watcher/workload_watcher.go:314 +0x1e5 created by watcher.(*WorkloadWatcher).deleteExternalWorkload in goroutine 211 	controller/api/destination/watcher/workload_watcher.go:239 +0x168 ~~~~  ### output of `linkerd check -o short`  ``` linkerd-identity ---------------- ‼ issuer cert is valid for at least 60 days     issuer certificate will expire on [REDACTED]  linkerd-version --------------- ‼ cli is up-to-date     is running version 2.20.0 but the latest enterprise version is 2.20.1  control-plane-version --------------------- ‼ control plane is up-to-d

- **Issue #15548** (2026-08-21): **Deleting a MeshTLSAuthentication referenced by an AuthorizationPolicy does not revoke access**
  *Symptoms*: ### What is the issue?  When an `AuthorizationPolicy` references a `MeshTLSAuthentication` and that `MeshTLSAuthentication` is deleted, traffic from the formerly-authorized client continues to be accepted, even though the `Server` has `accessPolicy: deny` and the referenced authentication resource no longer exists.  Restarting the protected workload's pod does not change the behaviour. After restarting `linkerd-destination`, the requests are denied as expected.  Expected: deleting a `MeshTLSAuthentication` referenced by an `AuthorizationPolicy` revokes the authorization, and the affected server falls back to its default deny access policy without any restart. This is security-relevant, since revoking a client's access has no effect at the time of revocation.  ### How can it be reproduced?  1. Apply the manifests below. 2. Verify the client can reach the server (HTTP 200):    ```bash    kubectl exec -n demo deploy/client -c client -- \      curl -sS -o /dev/null -w '%{http_code}\n' http://server:8080/    ``` 3. Delete the authentication resource:    ```bash    kubectl delete meshtlsauthentication -n demo client-auth    ``` 4. Repeat the request from step 2 -> still 200 (expected: 403). 5. `kubectl rollout restart deploy/server -n demo`, wait for rollout, repeat the request -> still 200. 6. `kubectl rollout restart deploy/linkerd-destination -n linkerd`, wait for rollout, repeat the request -> 403, as expected.  [Manifests for reproduction](https://gist.github.com/bkittinger/0e
  **Post-Mortem & Fix Analysis**:
  > Just realized that this apparently has already been fixed in #15326 and included in 26.6.2. We'll test with a newer version of linkerd and verify that this behavior does not occur anymore.
  > Tested with 26.6.3 - in that release the problem no longer occurs.

- **Issue #15506** (2026-08-04): **policy-controller leader election panic**
  *Symptoms*: ### What is the issue?  The status controller task inside the policy container of linkerd-destination entered a crash loop on 2026-07-21, cycling through all linkerd-destination replicas with 7,591 lease transitions before going silent. Because the panic occurs inside a Tokio-spawned task (not the main process thread), the container process never exits, Kubernetes never restarts it, and the failure is invisible: restarts=0, ready=true. After the loop stopped, no status controller held the lease. New policy resources (Server, HTTPRoute, AuthorizationPolicy) deployed after the crash are never reconciled — proxies don't receive route policies and silently fall back to the server's accessPolicy default.  ### How can it be reproduced?  Not really sure how to re-pro it, but this is described in [an old PR #10584](https://github.com/linkerd/linkerd2/pull/10584). The only thing I can think of is to reproduce a kube-api failure (of getting/checking the lease) by just deleting the lease itself.  ### Logs, error output, etc  very pod that won the policy-controller-write leader election immediately panicked:  {"message":"Status controller leadership change","leader":"true",...} thread 'tokio-rt-worker' panicked at /build/policy-controller/k8s/status/src/index.rs:267:25: Claims watch must not be dropped: RecvError(()) thread 'tokio-rt-worker' panicked at /build/policy-controller/k8s/status/src/index.rs:407:25: Claims watch must not be dropped: RecvError(())  The Kubernetes policy-controll

- **Issue #15414** (2026-08-26): **http/retry: PeekTrailersBody reports exact DATA size when trailers are buffered, causing  intermittent gRPC-Web missing trailers**
  *Symptoms*: ### What is the issue?  # http/retry: PeekTrailersBody reports exact DATA size when trailers are buffered, causing intermittent gRPC-Web missing trailers  ## Summary  We are seeing intermittent gRPC-Web responses where the client receives HTTP 200 and the DATA frame, but the gRPC-Web trailer frame is missing.  The failing response looks like:  ```text http_status=200 http_content_length=-1 http_transfer_encoding=chunked body_bytes=5 data_frames=1 has_trailer=false trailer_bytes=0 grpc_web_code=unknown ```  The 5-byte body is the empty gRPC-Web DATA frame:  ```text 00 00 00 00 00 ```  The expected successful response is 26 bytes:  ```text 5-byte DATA frame + gRPC-Web trailer frame containing grpc-status: 0 ```  So the response is being terminated after DATA, before the trailer frame is delivered.  ## Impact  gRPC-Web clients fail with errors equivalent to:  ```text missing trailer ```  or receive a 200 response that cannot be interpreted as a valid gRPC-Web response because `grpc-status` is absent.  ## Observed environment  Observed with Linkerd proxy:  ```text edge-26.5.1 ```  Topology:  ```text HTTP/1.1 gRPC-Web client   -> meshed Traefik   -> meshed API service   -> meshed downstream gRPC service ```  The downstream service returns OK. The API service also logs successful egress.  ## Regression finding  We added a deterministic unit test for `PeekTrailersBody`:  ```text DATA("hello") + immediate TRAILERS -> trailers are peeked -> size_hint.lower() == 5 -> size_hint.exact() 
  **Post-Mortem & Fix Analysis**:
  > This is specific enough for a focused regression test around http/retry: PeekTrailersBody reports exact DATA size when trailers are buffered, causing interm.... The test should set up the failing path, assert the intended behavior, and include the current error or bad output so the fix is not only verified manually. `grpc-status` is a useful concrete anchor because it is named directly in the report. 

- **Issue #15223** (2026-05-08): **Linkerd SetToServerProtocol() cross-namespace bug**
  *Symptoms*: ### What is the issue?   ## Title  `SetToServerProtocol()` matches Server resources across namespaces, causing cluster-wide protocol hint poisoning  ## Bug Report  ### What is the issue?  `SetToServerProtocol()` in `controller/api/destination/watcher/endpoints_watcher.go` lists all Server resources cluster-wide without filtering by namespace. When a Server with `proxyProtocol: opaque` exists in any namespace, it marks pods in **every** namespace as opaque if their labels match the Server's `podSelector`.  This contradicts the Server CRD being namespace-scoped and can cause cluster-wide outages.  ### Affected code  https://github.com/linkerd/linkerd2/blob/main/controller/api/destination/watcher/endpoints_watcher.go  ```go func SetToServerProtocol(k8sAPI *k8s.API, address *Address, log *logging.Entry) error {     servers, err := k8sAPI.Srv().Lister().Servers("").List(labels.Everything())     // ^^^ Lists ALL Servers across ALL namespaces — no namespace filter      for _, server := range servers {         if server.Spec.ProxyProtocol == opaqueProtocol &&            selector.Matches(labels.Set(address.Pod.Labels)) {             if portMatch {                 address.OpaqueProtocol = true             }         }     } } ```  Note: `updateServer()` in the same file correctly filters by namespace:  ```go func (ew *EndpointsWatcher) updateServer(...) {     for id, sp := range ew.publishers {         if id.Namespace == namespace {  // ← Correct: namespace-scoped             sp.updateS

- **Issue #15200** (2026-04-29): **Service mirror cleanup logic does not respect namespaces**
  *Symptoms*: ### What is the issue?  We have two headless multi-cluster services with the same name (and thus the same `mirror.linkerd.io/headless-mirror-svc-name` label on all endpoint mirror services) in two different namespaces. These services front a StatefulSet with differing numbers of replicas. On reconcile, the service mirror controller seems to be deleting the endpoint mirror services for pods that are healthy in the remote cluster. I'd expect the service mirror to leave the endpoint mirror services for the healthy pods alone.  I also posted about this issue in the Slack channel [here](https://linkerd.slack.com/archives/C89RTCWJF/p1776779919651119).  ### How can it be reproduced?  1.  Create two headless services and StatefulSets with the same name in two separate namespaces in the remote cluster. 2. Set the number of replicas to 1 and 2 for the first and second STS, respectively. 3. On reconcile, check that there is only 1 endpoint mirror service in the local cluster for the namespace with 2 replicas. The endpoint mirror service for the second replica will be missing or created and then quickly deleted.  This pattern doesn't happen on every reconcile but you should notice a lot of churn for the 2nd replica's endpoint mirror service.  ### Logs, error output, etc  Controller logs: ``` time="2026-04-21T13:49:36Z" level=info msg="Creating a new endpoint mirror service gf-lw-production-usa-t2j9zb/c4t2a-xl-gpt-1-2-gke-us-central1-prod for exported headless service gf-lw-production-usa

- **Issue #15199** (2026-08-24): **linkerd-proxy mangles error code / message / trailer forwarding for sufficiently large messages**
  *Symptoms*: ### What is the issue?  In some release _after_ edge-25.2.1, linkerd-proxy began failing to forward gRPC status codes, error messages and trailers in cases where the total gRPC response trailer size was at or over roughly 12 kilobytes. The error message generated by the server is replaced by code 13, the message is replaced by `stream terminated by RST_STREAM with error code: INTERNAL_ERROR`, and no trailer information is forwarded.  This is tested on server version edge-26.4.2.  ### How can it be reproduced?  I have put together a full demonstration of this effect as a client-server combo and a helm chart:  https://github.com/odenio/echoerror  To install on your cluster, run:  ``` helm upgrade --install echoerror ./chart/echoerror ```  To vary the amount of requested data in the trailers, add `--set client.padMessageKb=<int>`.  This is a toy server implementation that implements a single gRPC API, `EchoError`, which takes an `EchoRequest` message that lets the client specify the kind of result it wants:  ``` message EchoRequest {   int32 code = 1;   string message = 2;   int32 pad_message_kb = 3; } ```  The client code continuously sends messages to the server, iterating over codes `0` through `16`, generating a random `message` per request, and setting a configured padding size. The response from the server is then compared to the request and any mismatch is logged.  On our cluster, if pad_message_kb is set to `11` or below, no mismatch errors are noted. But if it is set to
  **Post-Mortem & Fix Analysis**:
  > thank you very much for filing this, and for including a reproduction @n-oden. i am going to start working on fixing this issue this week.
  > @cratelyn you're quite welcome; please let me know if I can provide any more details/telemetry
  > ## Update: Fix Available in linkerd2-proxy  This issue is caused by a bug in the linkerd2-proxy's HTTP/2 trailer handling. The fix has been implemented in the proxy repository:  **Proxy Fix PR:** https://github.com/wahajahmed010/linkerd2-proxy/pull/1  ### Root Cause The regression was introduced when linkerd2-proxy upgraded from `h2 0.3.26` to `h2 0.4.x` between proxy v2.277.0 (working) and v2.290.0+ (broken). When gRPC trailers exceed ~12KB (the HTTP/2 MAX_FRAME_SIZE limit), the h2 0.4.x series had bugs in how HEADERS frames were sent on reset streams, causing trailers to be dropped and RST_STREAM(INTERNAL_ERROR) to be sent instead.  ### Fix Bumping `h2` from `0.4.13` to `0.4.14` in linkerd2-proxy resolves the issue. The h2 0.4.14 release includes: - Fix sending HEADERS on a reset stream before the RST_STREAM frame - Fix leaking connection flow control of padded DATA frames - Optimizations for header value decoding  Once linkerd2-proxy is updated, the `.proxy-version` in this repo wil

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

### Incident Patch 1: `6f974586` (2026-09-25)
**Commit Message**: docs: fix stale chart and workflow paths (#15682)

BUILD.md still points at `charts/linkerd2`, which no longer exists: the
control plane chart is `charts/linkerd-control-plane` and its CRDs moved to
`charts/linkerd-crds`. The example `bin/helm install linkerd2 charts/linkerd2`
fails for the same reason. Two other READMEs have broken relative links:
`grafana/README.md` links `grafana/authzpolicy-grafana.yaml` from inside
`grafana/`, and `policy-test/README.md` links a `policy_controller.yml`
workflow that no longer exists.

Point BUILD.md at `charts/linkerd-control-plane` and `charts/linkerd-crds`,
install the CRDs chart before the control plane chart in the example, passing
the identity certificates the chart requires (as the chart READMEs do), and fix
the two links. The policy tests now run from
`.github/workflows/integration.yml`.

Validation: every new link target exists in the tree (`ls charts/`,
`ls grafana/`, `grep policy-test .github/workflows/integration.yml`).

Prepared with AI assistance (Claude Code) and reviewed with GitHub Copilot,
which caught the missing identity flags in the install example.

Signed-off-by: ZainnQureshii <43629888+ZainnQureshii@users.noreply.github.

**File**: `BUILD.md` (modified, +17/-10)
```diff
@@ -459,20 +459,27 @@ bin/update-codegen.sh
 ## Linkerd Helm chart
 
 The Linkerd control plane chart is located in the
-[`charts/linkerd2`](charts/linkerd2) folder. The [`charts/patch`](charts/patch)
-chart consists of the Linkerd proxy specification, which is used by the proxy
-injector to inject the proxy container. Both charts depend on the partials
-subchart which can be found in the [`charts/partials`](charts/partials) folder.
+[`charts/linkerd-control-plane`](charts/linkerd-control-plane) folder, and the
+CRDs it needs are in the [`charts/linkerd-crds`](charts/linkerd-crds) chart.
+The [`charts/patch`](charts/patch) chart consists of the Linkerd proxy
+specification, which is used by the proxy injector to inject the proxy
+container. All three charts depend on the partials subchart which can be found
+in the [`charts/partials`](charts/partials) folder.
 
-Note that the `charts/linkerd2/values.yaml` file contains a placeholder
-`linkerdVersionValue` that you need to replace with an appropriate string (like
-`edge-20.2.2`) before proceeding.
+Note that the `charts/linkerd-control-plane/values.yaml` file contains a
+placeholder `linkerdVersionValue` that you need to replace with an appropriate
+string (like `edge-20.2.2`) before proceeding.
 
 During development, please use the [`bin/helm`](bin/helm) wrapper script to
 invoke the Helm commands. For example,
 
 ```bash
-bin/helm install linkerd2 charts/linkerd2
+bin/helm install linkerd-crds -n linkerd --create-namespace charts/linkerd-crds
+bin/helm install linkerd-control-plane -n linkerd \
+  --set-file identityTrustAnchorsPEM=ca.crt \
+  --set-file identity.issuer.tls.crtPEM=issuer.crt \
+  --set-file identity.issuer.tls.keyPEM=issuer.key \
+  charts/linkerd-control-plane
 ```
 
 This ensures that you use the same Helm version as that of the Linkerd CI
@@ -494,8 +501,8 @@ Extensions provide each their own chart:
 ### Making changes to the chart templates
 
 Whenever you make changes to the files under
-[`charts/linkerd2/templates`](charts/linkerd2/templates) or its dependency
-[`charts/partials`](charts/partials), make sure to run
+[`charts/linkerd-control-plane/templates`](charts/linkerd-control-plane/templates)
+or its dependency [`charts/partials`](charts/partials), make sure to run
 [`bin/helm-build`](bin/helm-build) which will refresh the dependencies and lint
 the templates.
 
```

**File**: `grafana/README.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ Prometheus instance has been restricted through the `prometheus-admin`
 AuthorizationPolicy, granting access only to the `metrics-api` ServiceAccount.
 In order to grant access to Grafana, you need to add an AuthorizationPolicy
 pointing to its ServiceAccount. You can apply
-[authzpolicy-grafana.yaml](grafana/authzpolicy-grafana.yaml) which grants
+[authzpolicy-grafana.yaml](authzpolicy-grafana.yaml) which grants
 permission for the `grafana` ServiceAccount.
 
 ## Note to developers
```

**File**: `policy-test/README.md` (modified, +1/-1)
```diff
@@ -10,4 +10,4 @@ The `policy-test` crate includes integration tests for the policy controller.
 
 ## Running in CI
 
-See the [workflow](.github/workflows/policy_controller.yml).
+See the [workflow](../.github/workflows/integration.yml).
```

---

### Incident Patch 2: `d5b59617` (2026-09-03)
**Commit Message**: fix(destination): return retry-able error on ip conflict (#15627)

When encountering a cluster ip conflict (multiple services mapping onto
a single IP) return 'Unavailable' versus 'FailedPrecondition.'

The FailedPrecondiction error code is used to indicate the error state
is terminal, and the client should not retry without an external change.

The Unavailable error code is used when the client can retry the call.

The conflict is the result of rescheduling a node, combined with the
underlying IPAM implementation re-provisioning the same address.

This change will result in the caller (proxy) issuing a retry w/
backoff.

**File**: `controller/api/destination/server.go` (modified, +7/-1)
```diff
@@ -28,6 +28,12 @@ import (
 // updates buffered per stream before the stream is closed.
 const DefaultStreamQueueCapacity = 100
 
+var (
+	// errIPConflict is a sentinel error returned when multiple services are
+	// indexed by the same underlying IP address (clusterIP).
+	errIPConflict = status.Error(codes.Unavailable, "found multiple services with conflicting cluster IP")
+)
+
 type (
 	Config struct {
 		ControllerNS,
@@ -642,7 +648,7 @@ func getSvcID(k8sAPI *k8s.API, clusterIP string, log *logging.Entry) (*watcher.S
 			conflictingServices = append(conflictingServices, fmt.Sprintf("%s:%s", service.Namespace, service.Name))
 		}
 		log.Warnf("found conflicting %s cluster IP: %s", clusterIP, strings.Join(conflictingServices, ","))
-		return nil, status.Errorf(codes.FailedPrecondition, "found %d services with conflicting cluster IP %s", len(services), clusterIP)
+		return nil, errIPConflict
 	}
 	if len(services) == 0 {
 		return nil, nil
```

**File**: `controller/api/destination/server_test.go` (modified, +49/-0)
```diff
@@ -1277,6 +1277,55 @@ spec:
 			t.Fatalf("Expected not to find service mapped to [%s]", badClusterIP)
 		}
 	})
+
+	t.Run("Return Unavailable when services conflict on the same cluster IP", func(t *testing.T) {
+		conflictingClusterIP := "10.245.0.99"
+		k8sConfigs := []string{`
+apiVersion: v1
+kind: Service
+metadata:
+  name: service-a
+  namespace: test
+spec:
+  type: ClusterIP
+  clusterIP: 10.245.0.99
+  clusterIPs:
+  - 10.245.0.99
+  ports:
+  - port: 1234`, `
+apiVersion: v1
+kind: Service
+metadata:
+  name: service-b
+  namespace: test
+spec:
+  type: ClusterIP
+  clusterIP: 10.245.0.99
+  clusterIPs:
+  - 10.245.0.99
+  ports:
+  - port: 1234`}
+		k8sAPI, err := k8s.NewFakeAPI(k8sConfigs...)
+		if err != nil {
+			t.Fatalf("NewFakeAPI returned an error: %s", err)
+		}
+		err = watcher.InitializeIndexers(k8sAPI)
+		if err != nil {
+			t.Fatalf("InitializeIndexers returned an error: %s", err)
+		}
+		k8sAPI.Sync(nil)
+
+		svc, err := getSvcID(k8sAPI, conflictingClusterIP, logging.WithFields(nil))
+		if svc != nil {
+			t.Fatalf("Expected no service to be returned for conflicting cluster IP [%s]", conflictingClusterIP)
+		}
+		if err == nil {
+			t.Fatalf("Expected an error for conflicting cluster IP [%s]", conflictingClusterIP)
+		}
+		if code := status.Code(err); code != codes.Unavailable {
+			t.Fatalf("Expected error code %s, but got %s: %s", codes.Unavailable, code, err)
+		}
+	})
 }
 
 func testReturnEndpoints(t *testing.T, fqdn, ip string, port uint32) {
```

---

### Incident Patch 3: `f178e2d3` (2026-09-01)
**Commit Message**: fix(multicluster): disallow exec auth provider in remote credentials (#15625)

Cluster credentials secrets created by `linkerd multicluster link` use
the token auth provider. This change disallows the exec auth provider
since it is not used or necessary.

Additionally, we narrow Link resource lookups to restrict them to
the `linkerd-multicluster` namespace.

Signed-off-by: Alex Leong <alex@buoyant.io>

**File**: `controller/api/destination/watcher/cluster_store.go` (modified, +3/-0)
```diff
@@ -265,6 +265,9 @@ func decodeK8sConfigFromSecret(data []byte, cluster string, enableEndpointSlices
 		return nil, nil, err
 	}
 
+	// Disallow the Exec auth provider.
+	cfg.ExecProvider = nil
+
 	ctx := context.Background()
 	var remoteAPI *k8s.API
 	if enableEndpointSlices {
```

**File**: `multicluster/cmd/check.go` (modified, +14/-2)
```diff
@@ -344,7 +344,11 @@ func (hc *healthChecker) linkAccess(ctx context.Context) error {
 }
 
 func (hc *healthChecker) checkLinks(ctx context.Context) error {
-	links, err := hc.KubeAPIClient().L5dCrdClient.LinkV1alpha3().Links("").List(ctx, metav1.ListOptions{})
+	namespace, err := hc.KubeAPIClient().GetNamespaceWithExtensionLabel(ctx, MulticlusterExtensionName)
+	if err != nil {
+		return err
+	}
+	links, err := hc.KubeAPIClient().L5dCrdClient.LinkV1alpha3().Links(namespace.Name).List(ctx, metav1.ListOptions{})
 	if err != nil {
 		return err
 	}
@@ -403,6 +407,8 @@ func (hc *healthChecker) checkRemoteClusterConnectivity(ctx context.Context) err
 			errors = append(errors, fmt.Errorf("* secret: [%s/%s] cluster: [%s]: unable to parse api config: %w", secret.Namespace, secret.Name, link.Spec.TargetClusterName, err))
 			continue
 		}
+		// Disallow the Exec auth provider.
+		clientConfig.ExecProvider = nil
 		remoteAPI, err := k8s.NewAPIForConfig(clientConfig, "", []string{}, healthcheck.RequestTimeout, 0, 0)
 		if err != nil {
 			errors = append(errors, fmt.Errorf("* secret: [%s/%s] cluster: [%s]: could not instantiate api for target cluster: %w", secret.Namespace, secret.Name, link.Spec.TargetClusterName, err))
@@ -451,6 +457,8 @@ func (hc *healthChecker) checkRemoteClusterAnchors(ctx context.Context, localAnc
 			errors = append(errors, fmt.Sprintf("* secret: [%s/%s] cluster: [%s]: unable to parse api config: %s", secret.Namespace, secret.Name, link.Spec.TargetClusterName, err))
 			continue
 		}
+		// Disallow the Exec auth provider.
+		clientConfig.ExecProvider = nil
 		remoteAPI, err := k8s.NewAPIForConfig(clientConfig, "", []string{}, healthcheck.RequestTimeout, 0, 0)
 		if err != nil {
 			errors = append(errors, fmt.Sprintf("* secret: [%s/%s] cluster: [%s]: could not instantiate api for target cluster: %s", secret.Namespace, secret.Name, link.Spec.TargetClusterName, err))
@@ -817,7 +825,11 @@ func (hc *healthChecker) checkForOrphanedServices(ctx context.Context) error {
 	if err != nil {
 		return err
 	}
-	links, err := hc.KubeAPIClient().L5dCrdClient.LinkV1alpha3().Links("").List(ctx, metav1.ListOptions{})
+	namespace, err := hc.KubeAPIClient().GetNamespaceWithExtensionLabel(ctx, MulticlusterExtensionName)
+	if err != nil {
+		return err
+	}
+	links, err := hc.KubeAPIClient().L5dCrdClient.LinkV1alpha3().Links(namespace.Name).List(ctx, metav1.ListOptions{})
 	if err != nil {
 		return err
 	}
```

**File**: `multicluster/cmd/service-mirror/main.go` (modified, +2/-0)
```diff
@@ -352,6 +352,8 @@ func restartClusterWatcher(
 	if err != nil {
 		return fmt.Errorf("unable to parse kube config: %w", err)
 	}
+	// Disallow the Exec auth provider.
+	cfg.ExecProvider = nil
 	remoteAPI, err := controllerK8s.InitializeAPIForConfig(ctx, cfg, false, link.Spec.TargetClusterName, controllerK8s.Svc, controllerK8s.Endpoint)
 	if err != nil {
 		return fmt.Errorf("cannot initialize api for target cluster %s: %w", link.Spec.TargetClusterName, err)
```

---

### Incident Patch 4: `e41c08e6` (2026-08-24)
**Commit Message**: fix(policy-controller): negotiate the TLSRoute API version with the cluster (#15584)

Followup to #15567

2f7472750 bound TLSRoute to `v1alpha2`, since the `gateway-api` crate binds
it to `v1` and that version does not exist before Gateway API v1.5. That
pin is wrong in the other direction: the standard channel of v1.5 marks
`v1alpha2` `served: false`, so discovery 404s, silently dropping
TLSRoute support on the configuration where TLSRoute is finally GA.

No single version covers the supported range:

```
  bundle            channel        served
  v1.2.1 - v1.4     experimental   v1alpha2 (v1.4 adds v1alpha3)
  v1.2.1 - v1.4     standard       no TLSRoute CRD
  v1.5.x            experimental   v1, v1alpha2, v1alpha3
  v1.5.x            standard       v1 only
  linkerd-crds      (vendored)     v1alpha2
```

So the version is now negotiated at startup: the controller probes
`gateway.networking.k8s.io/v1` then `/v1alpha2` for kind TLSRoute and
watches whichever it finds, preferring `v1`. `TLSRouteV1Alpha2` keeps the
`v1alpha2` binding alongside the crate's `v1` `TLSRoute`; the CRDs declare
no conversion strategy, so events from a `v1alpha2` watch are converted
into the `v1` represen

**File**: `.github/workflows/integration.yml` (modified, +12/-0)
```diff
@@ -159,21 +159,33 @@ jobs:
         # version, as well as the vendored Gateway API CRDs.
         k8s:
           - v1.36
+        # 'tls-route' is the TLSRoute API version the bundle serves, and that
+        # the policy controller therefore negotiates, or 'none' when the bundle
+        # ships no TLSRoute CRD at all. TLSRoute only graduated to 'v1', and to
+        # the standard channel, in Gateway API v1.5; the vendored CRDs and
+        # older bundles serve 'v1alpha2'.
         gateway-api:
           - version: linkerd
             channel: experimental
+            tls-route: v1alpha2
           - version: v1.5.1
             channel: experimental
+            tls-route: v1
+          - version: v1.5.1
+            channel: standard
+            tls-route: v1
         # Also test the Minimum Supported Kubernetes Version with the Minimum
         # Supported Gateway API version.
         include:
           - k8s: v1.31
             gateway-api:
               version: v1.2.1
               channel: standard
+              tls-route: none
     env:
       GATEWAY_API_VERSION: ${{ matrix.gateway-api.version }}
       GATEWAY_API_CHANNEL: ${{ matrix.gateway-api.channel }}
+      GATEWAY_API_TLS_ROUTE: ${{ matrix.gateway-api.tls-route }}
     steps:
       - uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3
         env:
```

**File**: `justfile` (modified, +12/-3)
```diff
@@ -139,7 +139,9 @@ export POLICY_TEST_CONTEXT := env_var_or_default("POLICY_TEST_CONTEXT", "k3d-" +
 # Install linkerd in the test cluster and run the policy tests.
 policy-test: linkerd-install policy-test-deps-load policy-test-run && policy-test-cleanup linkerd-uninstall
 
-_policy-test-flags := "--no-default-features" + if GATEWAY_API_CHANNEL == "experimental" { " --features=gateway-api-experimental" } else { "" }
+_policy-test-tls-route-flags := if GATEWAY_API_TLS_ROUTE == "none" { "" } else if GATEWAY_API_TLS_ROUTE =~ '^v1(alpha2)?$' { " --features=gateway-api-tls-route-" + GATEWAY_API_TLS_ROUTE } else { error("GATEWAY_API_TLS_ROUTE must be 'v1', 'v1alpha2', or 'none'") }
+
+_policy-test-flags := "--no-default-features" + (if GATEWAY_API_CHANNEL == "experimental" { " --features=gateway-api-experimental" } else { "" }) + _policy-test-tls-route-flags
 
 # Run the policy tests without installing linkerd.
 policy-test-run *flags:
@@ -296,10 +298,17 @@ proxy-image := DOCKER_REGISTRY + "/proxy"
 export GATEWAY_API_VERSION := env_var_or_default("GATEWAY_API_VERSION", "v1.5.1")
 
 # When GATEWAY_API_CHANNEL is 'experimental', we enable testing of experimental
-# resource types (TCPRoute, TLSRoute). Alternatively, the 'standard' channel may
-# be used.
+# resource types (TCPRoute). Alternatively, the 'standard' channel may be used.
 export GATEWAY_API_CHANNEL := env_var_or_default("GATEWAY_API_CHANNEL", "experimental")
 
+# The TLSRoute API version to test against, or 'none' to skip the TLSRoute
+# tests. TLSRoute has no version that is served by every supported Gateway API
+# bundle: v1.2--v1.4 and the CRDs vendored by the linkerd-crds chart serve
+# 'v1alpha2' only (and only in the experimental channel), while the standard
+# channel of v1.5 serves 'v1' only. The policy controller negotiates a version
+# with the API server; this tells the tests which one it will pick.
+export GATEWAY_API_TLS_ROUTE := env_var_or_default("GATEWAY_API_TLS_ROUTE", if GATEWAY_API_VERSION == "linkerd" { "v1alpha2" } else { "v1" })
+
 _gateway-url := if GATEWAY_API_VERSION != "linkerd" { "https://github.com/kubernetes-sigs/gateway-api/releases/download/" + GATEWAY_API_VERSION + "/" + GATEWAY_API_CHANNEL + "-install.yaml" } else { "" }
 
 # External dependencies
```

**File**: `policy-controller/k8s/api/src/lib.rs` (modified, +165/-18)
```diff
@@ -38,27 +38,119 @@ pub mod gateway {
     pub use gateway_api::apis::experimental::tcproutes::*;
     pub use gateway_api::apis::experimental::tlsroutes::*;
 
-    /// A `TLSRoute` pinned to `v1alpha2`.
+    /// The `TLSRoute` API versions the policy controller knows how to watch,
+    /// in order of preference.
+    ///
+    /// No single version is served by every supported Gateway API bundle:
+    /// v1.2--v1.4 serve `v1alpha2` only (and only in the experimental
+    /// channel), while v1.5 serves `v1` in both channels and stops serving
+    /// `v1alpha2` in the standard channel. The version to use is therefore
+    /// negotiated with the API server at startup.
+    ///
+    /// The CRDs declare no conversion strategy, so all served versions are the
+    /// same stored object under a different `apiVersion`.
+    #[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
+    pub enum TlsRouteApiVersion {
+        #[default]
+        V1,
+        V1Alpha2,
+    }
+
+    impl TlsRouteApiVersion {
+        /// All supported versions, most preferred first.
+        pub const ALL: &'static [Self] = &[Self::V1, Self::V1Alpha2];
+
+        pub fn version(&self) -> &'static str {
+            match self {
+                Self::V1 => "v1",
+                Self::V1Alpha2 => "v1alpha2",
+            }
+        }
+
+        pub fn api_version(&self) -> &'static str {
+            match self {
+                Self::V1 => "gateway.networking.k8s.io/v1",
+                Self::V1Alpha2 => "gateway.networking.k8s.io/v1alpha2",
+            }
+        }
+    }
+
+    /// A `TLSRoute` bound to `v1alpha2`.
     ///
-    /// This deliberately shadows the `TLSRoute` from the glob import above.
     /// The `gateway-api` crate binds `TLSRoute` to `v1`, which is only served
-    /// by Gateway API v1.5 and later. `v1alpha2` is served by every release
-    /// from v1.1 through v1.5 (deprecated but still served, and the CRD
-    /// declares no conversion strategy, so the versions are the same object
-    /// under a different `apiVersion`). Using it keeps us compatible with
-    /// clusters that predate v1.5.
+    /// by Gateway API v1.5 and later. Clusters running v1.2--v1.4, as well as
+    /// clusters using the CRDs vendored by the `linkerd-crds` chart, serve
+    /// `v1alpha2` instead, so we keep a second binding for them and pick
+    /// between the two at runtime.
     ///
     /// The spec and status types are reused from the `gateway-api` crate, so
-    /// this only overrides the group/version/kind the client addresses.
+    /// this only overrides the group/version/kind the client addresses; the
+    /// one schema difference between the versions -- `v1` requires
+    /// `spec.hostnames` and `v1alpha2` does not -- is handled by
+    /// `deserialize_v1alpha2_spec`.
     #[derive(Clone, Debug, Default, PartialEq, serde::Deserialize)]
     #[serde(rename_all = "camelCase")]
-    pub struct TLSRoute {
+    pub struct TLSRouteV1Alpha2 {
         pub metadata: k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta,
+        #[serde(deserialize_with = "deserialize_v1alpha2_spec")]
         pub spec: TlsRouteSpec,
         pub status: Option<TlsRouteStatus>,
     }
 
-    impl kube::Resource for TLSRoute {
+    /// A `TlsRouteSpec` read from a `v1alpha2` payload.
+    ///
+    /// Admission requests are dispatched on the version they carry, so this
+    /// makes `deserialize_v1alpha2_spec`'s leniency available to the admission
+    /// controller, which parses specs on their own.
+    #[derive(Clone, Debug, PartialEq)]
+    pub struct TlsRouteSpecV1Alpha2(pub TlsRouteSpec);
+
+    impl<'de> serde::Deserialize<'de> for TlsRouteSpecV1Alpha2 {
+        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
+        where
+            D: serde::Deserializer<'de>,
+        {
+            deserialize_v1alpha2_spec(deserializer).map(Self)
+        }
+    }
+
+    /// Deserializes a `TlsRouteSpec` from a `v1alpha2` payload, where
```

**File**: `policy-controller/k8s/status/src/index.rs` (modified, +28/-8)
```diff
@@ -58,6 +58,10 @@ pub struct Controller {
     updates: mpsc::Receiver<Update>,
     patch_timeout: Duration,
 
+    /// The version of the TLSRoute API served by the cluster, as negotiated at
+    /// startup. TLSRoute statuses must be patched through a served version.
+    tls_route_api_version: gateway::TlsRouteApiVersion,
+
     metrics: ControllerMetrics,
 }
 
@@ -97,6 +101,10 @@ pub struct Index {
     services: HashMap<ResourceId, Service>,
     cluster_networks: Vec<Cidr>,
 
+    /// The version of the TLSRoute API served by the cluster, as negotiated at
+    /// startup. It is the `apiVersion` written in TLSRoute status patches.
+    tls_route_api_version: gateway::TlsRouteApiVersion,
+
     metrics: IndexMetrics,
 }
 
@@ -231,13 +239,15 @@ impl Controller {
         updates: mpsc::Receiver<Update>,
         patch_timeout: Duration,
         metrics: ControllerMetrics,
+        tls_route_api_version: gateway::TlsRouteApiVersion,
     ) -> Self {
         Self {
             claims,
             client,
             name,
             updates,
             patch_timeout,
+            tls_route_api_version,
             metrics,
         }
     }
@@ -282,7 +292,14 @@ impl Controller {
                         } else if id.is_a::<gateway::TCPRoute>() {
                             self.patch::<gateway::TCPRoute>(&id.gkn.name, &id.namespace, patch).await;
                         } else if id.is_a::<gateway::TLSRoute>() {
-                            self.patch::<gateway::TLSRoute>(&id.gkn.name, &id.namespace, patch).await;
+                            match self.tls_route_api_version {
+                                gateway::TlsRouteApiVersion::V1 => {
+                                    self.patch::<gateway::TLSRoute>(&id.gkn.name, &id.namespace, patch).await;
+                                }
+                                gateway::TlsRouteApiVersion::V1Alpha2 => {
+                                    self.patch::<gateway::TLSRouteV1Alpha2>(&id.gkn.name, &id.namespace, patch).await;
+                                }
+                            }
                         } else if id.is_a::<policy::HttpLocalRateLimitPolicy>() {
                             self.patch::<policy::HttpLocalRateLimitPolicy>(&id.gkn.name, &id.namespace, patch).await;
                         } else if id.is_a::<policy::EgressNetwork>() {
@@ -348,6 +365,7 @@ impl Index {
         updates: mpsc::Sender<Update>,
         metrics: IndexMetrics,
         cluster_networks: Vec<IpNet>,
+        tls_route_api_version: gateway::TlsRouteApiVersion,
     ) -> SharedIndex {
         let cluster_networks = cluster_networks.into_iter().map(Into::into).collect();
         Arc::new(RwLock::new(Self {
@@ -364,6 +382,7 @@ impl Index {
             services: HashMap::new(),
             metrics,
             cluster_networks,
+            tls_route_api_version,
         }))
     }
 
@@ -950,7 +969,7 @@ impl Index {
             parents: all_statuses,
         };
 
-        make_patch(id, status)
+        make_patch(id, status, self.tls_route_api_version)
     }
 
     fn make_grpc_route_patch(
@@ -987,7 +1006,7 @@ impl Index {
             parents: all_statuses,
         };
 
-        make_patch(id, status)
+        make_patch(id, status, self.tls_route_api_version)
     }
 
     fn make_tls_route_patch(
@@ -1024,7 +1043,7 @@ impl Index {
             parents: all_statuses,
         };
 
-        make_patch(id, status)
+        make_patch(id, status, self.tls_route_api_version)
     }
 
     fn make_tcp_route_patch(
@@ -1061,7 +1080,7 @@ impl Index {
             parents: all_statuses,
         };
 
-        make_patch(id, status)
+        make_patch(id, status, self.tls_route_api_version)
     }
 
     fn target_ref_status(
@@ -1127,7 +1146,7 @@ impl Index {
             return None;
         }
 
-        make_patch(id, status)
+        make_patch(id, status, self.tls_route_api_version)
     }
 
     fn network_condition(&self, egress_net: &EgressNetw
```

**File**: `policy-controller/k8s/status/src/resource_id.rs` (modified, +9/-2)
```diff
@@ -22,7 +22,14 @@ pub struct NamespaceGroupKindName {
 }
 
 impl NamespaceGroupKindName {
-    pub fn api_version(&self) -> anyhow::Result<Cow<'static, str>> {
+    /// The `apiVersion` to write in this resource's status patch.
+    ///
+    /// Every kind but TLSRoute is served under a single version; TLSRoute's is
+    /// negotiated with the API server at startup and must be passed in.
+    pub fn api_version(
+        &self,
+        tls_route_api_version: gateway::TlsRouteApiVersion,
+    ) -> anyhow::Result<Cow<'static, str>> {
         match (self.gkn.group.as_ref(), self.gkn.kind.as_ref()) {
             (POLICY_API_GROUP, "HTTPRoute") => Ok(linkerd_k8s_api::HttpRoute::api_version(&())),
             (POLICY_API_GROUP, "HTTPLocalRateLimitPolicy") => {
@@ -34,7 +41,7 @@ impl NamespaceGroupKindName {
             (GATEWAY_API_GROUP, "HTTPRoute") => Ok(gateway::HTTPRoute::api_version(&())),
             (GATEWAY_API_GROUP, "GRPCRoute") => Ok(gateway::GRPCRoute::api_version(&())),
             (GATEWAY_API_GROUP, "TCPRoute") => Ok(gateway::TCPRoute::api_version(&())),
-            (GATEWAY_API_GROUP, "TLSRoute") => Ok(gateway::TLSRoute::api_version(&())),
+            (GATEWAY_API_GROUP, "TLSRoute") => Ok(tls_route_api_version.api_version().into()),
             (group, kind) => {
                 anyhow::bail!("unknown group + kind combination: ({group}, {kind})")
             }
```

---

### Incident Patch 5: `8a29b116` (2026-08-04)
**Commit Message**: fix(destination): Remove duplicate Job informer (#15523)

Problem

At startup, the destination controller logs:

    failed to register Prometheus gauge Desc{fqName: "job_cache_size",
    help: "Number of items in the client-go job cache", constLabels:
    {cluster="local"}, variableLabels: {}}: duplicate metrics collector
    registration attempted

The controller watches Jobs twice: once through a typed client-go
informer (`k8s.Job` in the `InitializeAPI` resource list) and once
through the metadata API (`k8s.Job` in the `InitializeMetadataAPI`
resource list, added in #11541). Each informer registers a
`job_cache_size` gauge with identical name and labels, so the second
registration fails and produces the warning.

The typed Job informer is unused: all Job lookups in the destination
controller (owner-reference resolution in the workload watcher and the
endpoints watcher's port publisher) go through the metadata API. The
typed informer only maintains a cluster-wide cache of full Job objects
that nothing reads.

Solution

Remove `k8s.Job` from the typed API resource lists in the destination
controller. Jobs remain watched by the metadata API, whose informer now
successfully registe

**File**: `controller/cmd/destination/main.go` (modified, +5/-2)
```diff
@@ -141,22 +141,25 @@ func Main(args []string) {
 		log.Fatalf("Failed to start with EndpointSlices enabled: %s", err)
 	}
 
+	// Jobs are only watched via the metadata API below; adding k8s.Job here
+	// as well would attempt to register a duplicate job_cache_size gauge
+	// (see issue #12710).
 	var k8sAPI *k8s.API
 	if *enableEndpointSlices {
 		k8sAPI, err = k8s.InitializeAPI(
 			ctx,
 			*kubeConfigPath,
 			true,
 			"local",
-			k8s.Endpoint, k8s.ES, k8s.Pod, k8s.Svc, k8s.SP, k8s.Job, k8s.Srv, k8s.ExtWorkload,
+			k8s.Endpoint, k8s.ES, k8s.Pod, k8s.Svc, k8s.SP, k8s.Srv, k8s.ExtWorkload,
 		)
 	} else {
 		k8sAPI, err = k8s.InitializeAPI(
 			ctx,
 			*kubeConfigPath,
 			true,
 			"local",
-			k8s.Endpoint, k8s.Pod, k8s.Svc, k8s.SP, k8s.Job, k8s.Srv, k8s.ExtWorkload,
+			k8s.Endpoint, k8s.Pod, k8s.Svc, k8s.SP, k8s.Srv, k8s.ExtWorkload,
 		)
 	}
 	if err != nil {
```

---

### Incident Patch 6: `3af2f450` (2026-07-30)
**Commit Message**: fix(lint): re-enable the gosec G402 rule (#15540)

`G402: TLS MinVersion too low` was excluded in #9693 to work around a
gosec false positive, with the exclusion documented as temporary until
golangci-lint moved past v1.50.1 (gosec v2.13.1 -> v2.14.0).

That upgrade happened long ago -- CI now runs golangci-lint v1.64.8 via
the `ghcr.io/linkerd/dev:v50-go` image -- so the workaround is obsolete.

Removes the exclusion. No code changes are needed: linting the tree with
the rule re-enabled reports no G402 findings.

Fixes #9700

Signed-off-by: Sudhir Jaiswal <jaiswalsudhir2944@gmail.com>
Co-authored-by: Sudhir Jaiswal <jaiswalsudhir2944@gmail.com>

**File**: `.golangci.yml` (modified, +0/-8)
```diff
@@ -97,14 +97,6 @@ issues:
     - gosec
     text: "G101: Potential hardcoded credentials"
 
-  # Temporarily disable this check until the next golang-ci upgrade (greater
-  # than v1.50.1) which upgrades gosec from v2.13.1 to v2.14.0. The fix is in
-  # this commit, that refers to G404 but it seems it also affects G402:
-  # https://github.com/securego/gosec/commit/dfde579243e1bfe0856ddafc5fc6aebb29c0edf6
-  - linters:
-    - gosec
-    text: "G402: TLS MinVersion too low"
-
   # Flag operations are fallible if the flag does not exist. We assume these
   # exist as they are generally flags we are deprecating or use only for
   # development.
```

#### Recent Merged Pull Requests:
- **PR #15682** (2026-09-25): docs: fix stale chart and workflow paths (@ZainnQureshii)
- **PR #15671** (closed): Keep reading trust anchors after a non-certificate PEM block (@arpitjain099)
- **PR #15667** (2026-09-16): chore(deps): bump rustls to 0.23.45 (@anthoturc)
- **PR #15666** (2026-09-16): proxy: v2.369.0 (@l5d-bot)
- **PR #15663** (2026-09-14): chore(deps): upgrade proxy-init to v2.4.10 and cni-plugin to v1.7.0 (@anthoturc)
- **PR #15657** (2026-09-30): build(deps): bump github.com/mattn/go-runewidth from 0.0.29 to 0.0.30 (@dependabot[bot])
- **PR #15656** (2026-09-30): build(deps): bump github.com/prometheus/common from 0.70.1 to 0.71.0 (@dependabot[bot])
- **PR #15655** (2026-09-30): build(deps): bump helm.sh/helm/v3 from 3.21.4 to 3.22.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
