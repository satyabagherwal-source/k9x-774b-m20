# Forensic Learning Record (Deep Inspection): kubeshop/botkube

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubeshop-botkube-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubeshop/botkube](https://github.com/kubeshop/botkube))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:30.392Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeshop/botkube`
- **Description**: An app that helps you monitor your Kubernetes cluster, debug critical deployments & gives recommendations for standard practices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2313 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/botkube-agent/main.go`
```
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/go-github/v53/github"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	segment "github.com/segmentio/analytics-go"
	"github.com/sirupsen/logrus"
	"github.com/spf13/pflag"
	"golang.org/x/sync/errgroup"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/utils/strings"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"

	"github.com/kubeshop/botkube/internal/analytics"
	"github.com/kubeshop/botkube/internal/audit"
	"github.com/kubeshop/botkube/internal/command"
	intconfig "github.com/kubeshop/botkube/internal/config"
	"github.com/kubeshop/botkube/internal/config/reloader"
	"github.com/kubeshop/botkube/internal/config/remote"
	"github.com/kubeshop/botkube/internal/health"
	"github.com/kubeshop/botkube/internal/heartbeat"
	"github.com/kubeshop/botkube/internal/insights"
	"github.com/kubeshop/botkube/internal/kubex"
	"github.com/kubeshop/botkube/internal/source"
	"github.com/kubeshop/botkube/internal/status"
	"github.com/kubeshop/botkube/internal/storage"
	"github.com/kubeshop/botkube/pkg/action"
	"github.com/kubeshop/botkube/pkg/bot"
	"github.com/kubeshop/botkube/pkg/bot/interactive"
	"github.com/kubeshop/botkube/pkg/config"
	"github.com/kubeshop/botkube/pkg/controller"
	"github.com/kubeshop/botkube/pkg/execute"
	"github.com/kubeshop/botkube/pkg/httpx"
	"github.com/kubeshop/botkube/pkg/loggerx"
	"github.com/kubeshop/botkube/pkg/maputil"
	"github.com/kubeshop/botkube/pkg/multierror"
	"github.com/kubeshop/botkube/pkg/notifier"
	"github.com/kubeshop/botkube/pkg/plugin"
	"github.com/kubeshop/botkube/pkg/sink"
	"github.com/kubeshop/botkube/pkg/version"
)

const (
	componentLogFieldKey      = "component"
	botLogFieldKey            = "bot"
	sinkLogFieldKey           = "sink"
	commGroupFieldKey         = "commGroup"
	printAPIKeyCharCount      = 3
	reportHeartbeatInterval   = 10
	reportHeartbeatMaxRetries = 30
)

func main() {
	// Set up context
	ctx := signals.SetupSignalHandler()
	ctx, cancelCtxFn := context.WithCancel(ctx)
	defer cancelCtxFn()

	err := run(ctx)
	if errors.Is(err, context.Canceled) {
		return
	}

	loggerx.ExitOnError(err, "while running application")
}

// run wraps the main logic of the app to be able to properly clean up resources via deferred calls.
func run(ctx context.Context) (err error) {
	// Load configuration
	intconfig.RegisterFlags(pflag.CommandLine)

	remoteCfg, remoteCfgEnabled := remote.GetConfig()
	var (
		gqlClient    *remote.Gql
		deployClient *remote.DeploymentClient
	)
	if remoteCfgEnabled {
		gqlClient = remote.NewDefaultGqlClient(remoteCfg)
		deployClient = remote.NewDeploymentClient(gqlClient)
	}

	statusReporter := status.GetReporter(remoteCfgEnabled, gqlClient, deployClient, nil)
	if err = statusReporter.ReportDeploymentConnectionInit(ctx, ""); err != nil {
		return fmt.Errorf("while reporting botkube connection initialization %w", err)
	}

	cfgProvider := intconfig.GetProvider(remoteCfgEnabled, deployClient)
	configs, cfgVersion, err := cfgProvider.Configs(ctx)
	if err != nil {
		return fmt.Errorf("while loading configuration files: %w", err)
	}

	conf, confDetails, err := config.LoadWithDefaults(configs)
	if err != nil {
		return fmt.Errorf("while merging app configuration: %w", err)
	}
	if conf == nil {
		return fmt.Errorf("configuration cannot be nil")
	}

	logger := loggerx.New(conf.Settings.Log)
	if confDetails.ValidateWarnings != nil {
		logger.Warnf("Configuration validation warnings: %v", confDetails.ValidateWarnings.Error())
	}
	// Set up analytics reporter
	analyticsReporter, err := getAnalyticsReporter(conf.Analytics.Disable, logger)
	if err != nil {
		return fmt.Errorf("while creating analytics reporter: %w", err)
	}
	defer func() {
		err := analyticsReporter.Close()
		if err != nil {
			logger.Errorf("while closing reporter: %s", err.Error())
		}
	}()
	// from now on recover from any panic, report it and close reader and app.
	// The reader must be not closed to report the panic properly.
	defer analytics.ReportPanicIfOccurs(logger, analyticsReporter)

	reportFatalError := reportFatalErrFn(logger, analyticsReporter, statusReporter)
	// Prepare K8s clients and mapper
	kubeConfig, err := kubex.BuildConfigFromFlags("", conf.Settings.Kubeconfig, conf.Settings.SACredentialsPathPrefix)
	if err != nil {
		return reportFatalError("while loading k8s config", err)
	}
	dynamicCli, discoveryCli, err := getK8sClients(kubeConfig)
	if err != nil {
		return reportFatalError("while getting K8s clients", err)
	}

	// Register current anonymous identity
	k8sCli, err := kubernetes.NewForConfig(kubeConfig)
	if err != nil {
		return reportFatalError("while creating K8s clientset", err)
	}
	botkubeVersion, k8sVer, err := findVersions(k8sCli)
	if err = statusReporter.ReportDeploymentConnectionInit(ctx, k8sVer); err != nil {
		return reportFatalError("while reporting botkube connection initialization", err)
	}
	err = analyticsReporter.RegisterCurrentIdentity(ctx, k8sCli, remoteCfg.Identifier)
	if err != nil {
		return reportFatalError("while registering current identity", err)
	}
	err = analyticsReporter.ReportPluginsEnabled(conf.Executors, conf.Sources)
	if err != nil {
		logger.Errorf("while reporting plugins configuration: %v", err.Error())
	}

	statusReporter.SetLogger(logger)
	statusReporter.SetResourceVersion(cfgVersion)
	auditReporter := audit.GetReporter(remoteCfgEnabled, logger, gqlClient)

	ctx, cancel := context.WithCancel(ctx)
	errGroup, ctx := errgroup.WithContext(ctx)
	defer func() {
		// This is because, without cancellation, ctx is still alive and lots of other goroutines will not be
		// deferred and this wait will be stuck infinitely
		cancel()

		multiErr := multierror.New()

		errGroupErr := errGroup.Wait()

		if err != nil && !errors.Is(err, context.Canceled) {
			multiErr = multierror.Append(multiErr, err)
		}

		if errGroupErr != nil && !errors.Is(errGroupErr, context.Canceled) {
			multiErr = multierror.Append(multiErr, errGroupErr)
		}

		if multiErr.ErrorOrNil() == nil {
			return
		}

		err = reportFatalError("while waiting for goroutines to finish gracefully", multiErr.ErrorOrNil())
	}()

	errGroup.Go(func() error {
		err := analyticsReporter.Run(ctx)
		if err != nil {
			logger.Errorf("while closing reporter: %s", err.Error())
		}
		return err
	})

	schedulerChan := make(chan string)
	pluginHealthStats := plugin.NewHealthStats(conf.Plugins.RestartPolicy.Threshold)
	collector := plugin.NewCollector(logger)
	enabledPluginExecutors, enabledPluginSources := collector.GetAllEnabledAndUsedPlugins(conf)
	pluginManager := plugin.NewManager(logger, conf.Settings.Log, conf.Plugins, enabledPluginExecutors, enabledPluginSources, schedulerChan, pluginHealthStats)

	// Health endpoint
	healthChecker := health.NewChecker(ctx, conf, pluginHealthStats)
	healthSrv := healthChecker.NewServer(logger.WithField(componentLogFieldKey, "Health server"), conf.Settings.HealthPort)
	errGroup.Go(func() error {
		defer analytics.ReportPanicIfOccurs(logger, analyticsReporter)
		return healthSrv.Serve(ctx)
	})

	err = pluginManager.Start(ctx)
	if err != nil {
		return fmt.Errorf("while starting plugins manager: %w", err)
	}
	defer pluginManager.Shutdown()

	// Prometheus metrics
	metricsSrv := newMetricsServer(logger.WithField(componentLogFieldKey, "Metrics server"), conf.Settings.MetricsPort)
	errGroup.Go(func() error {
		defer analytics.ReportPanicIfOccurs(logger, analyticsReporter)
		return metricsSrv.Serve(ctx)
	})

	cmdGuard := command.NewCommandGuard(logger.WithField(componentLogFieldKey, "Command Guard"), discoveryCli)
	// Create executor factory
	cfgManager := config.NewManager(remoteCfgEnabled, logger.WithField(componentLogFieldKey, "Config manager"), conf.Settings.PersistentConfig, cfgVersion, k8sCli, gqlClient, deployClient)
	executorFactory, err := execute.NewExecutorFactory(
		
```

### Core Architecture Module: `cmd/cli/cmd/config/config.go`
```
package config

import (
	"github.com/spf13/cobra"
)

// NewCmd returns a new cobra.Command subcommand for config-related operations.
func NewCmd() *cobra.Command {
	root := &cobra.Command{
		Use:     "config",
		Aliases: []string{"cfg"},
		Short:   "This command consists of multiple subcommands for working with Botkube configuration",
	}

	root.AddCommand(
		NewGet(),
	)
	return root
}

```

### Core Architecture Module: `cmd/cli/cmd/config/get.go`
```
package config

import (
	"fmt"
	"os"
	"reflect"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"

	"github.com/kubeshop/botkube/internal/cli"
	"github.com/kubeshop/botkube/internal/cli/analytics"
	"github.com/kubeshop/botkube/internal/cli/config"
	"github.com/kubeshop/botkube/internal/cli/heredoc"
	"github.com/kubeshop/botkube/internal/cli/printer"
	"github.com/kubeshop/botkube/internal/kubex"
)

type GetOptions struct {
	OmitEmpty bool
	Exporter  config.ExporterOptions
}

// NewGet returns a cobra.Command for getting Botkube configuration.
func NewGet() *cobra.Command {
	var opts GetOptions

	resourcePrinter := printer.NewForResource(os.Stdout, printer.WithJSON(), printer.WithYAML())

	cmd := &cobra.Command{
		Use:   "get",
		Short: "Displays Botkube configuration",
		Example: heredoc.WithCLIName(`
			# Show configuration for currently installed Botkube
			<cli> config get
			
			# Show configuration in JSON format
			<cli> config get -ojson

			# Save configuration in file
			<cli> config get > config.yaml
		`, cli.Name),
		RunE: func(cmd *cobra.Command, args []string) (err error) {
			status := printer.NewStatus(cmd.ErrOrStderr(), "Fetching Botkube configuration")
			defer func() {
				status.End(err == nil)
			}()

			k8sCfg, err := kubex.LoadRestConfigWithMetaInformation()
			if err != nil {
				return fmt.Errorf("while creating k8s config: %w", err)
			}

			err = status.InfoStructFields("Export details:", exportDetails{
				ExporterVersion: opts.Exporter.Tag,
				K8sCtx:          k8sCfg.CurrentContext,
				LookupNamespace: opts.Exporter.BotkubePodNamespace,
				LookupPodLabel:  opts.Exporter.BotkubePodLabel,
			})
			if err != nil {
				return err
			}

			cfg, botkubeVersionStr, err := config.GetFromCluster(cmd.Context(), status, k8sCfg.K8s, opts.Exporter, false)
			if err != nil {
				return fmt.Errorf("while getting configuration: %w", err)
			}

			var raw interface{}
			err = yaml.Unmarshal(cfg, &raw)
			if err != nil {
				return fmt.Errorf("while loading configuration: %w", err)
			}

			if opts.OmitEmpty {
				status.Step("Removing empty keys from configuration")
				raw = removeEmptyValues(raw)
				status.End(true)
			}

			status.Infof("Exported Botkube configuration (agent version: %q)", botkubeVersionStr)

			return resourcePrinter.Print(raw)
		},
	}

	cmd = analytics.InjectAnalyticsReporting(*cmd, "config get")

	flags := cmd.Flags()

	flags.BoolVar(&opts.OmitEmpty, "omit-empty-values", true, "Omits empty keys from printed configuration")

	opts.Exporter.RegisterFlags(flags)

	resourcePrinter.RegisterFlags(flags)

	return cmd
}

type exportDetails struct {
	K8sCtx          string `pretty:"Kubernetes Context"`
	ExporterVersion string `pretty:"Exporter Version"`
	LookupNamespace string `pretty:"Lookup Namespace"`
	LookupPodLabel  string `pretty:"Lookup Pod Label"`
}

func removeEmptyValues(obj any) any {
	switch v := obj.(type) {
	case map[string]any:
		newObj := make(map[string]any)
		for key, value := range v {
			if value != nil {
				newValue := removeEmptyValues(value)
				if newValue != nil {
					newObj[key] = newValue
				}
			}
		}
		if len(newObj) == 0 {
			return nil
		}
		return newObj
	default:
		val := reflect.ValueOf(v)
		if val.IsZero() {
			return nil
		}
		return obj
	}
}

```

### Core Architecture Module: `cmd/cli/cmd/install.go`
```
package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/kubeshop/botkube/internal/cli"
	"github.com/kubeshop/botkube/internal/cli/analytics"
	"github.com/kubeshop/botkube/internal/cli/heredoc"
	"github.com/kubeshop/botkube/internal/cli/install"
	"github.com/kubeshop/botkube/internal/cli/install/helm"
	"github.com/kubeshop/botkube/internal/kubex"
)

// NewInstall returns a cobra.Command for installing Botkube.
func NewInstall() *cobra.Command {
	var opts install.Config

	installCmd := &cobra.Command{
		Use:     "install [OPTIONS]",
		Short:   "install or upgrade Botkube in k8s cluster",
		Long:    "Use this command to install or upgrade the Botkube agent.",
		Aliases: []string{"instl", "deploy"},
		Example: heredoc.WithCLIName(`
			# Install latest stable Botkube version
			<cli> install

			# Install Botkube 0.1.0 version
			<cli> install --version 0.1.0

			# Install Botkube from local git repository. Needs to be run from the main directory.
			<cli> install --repo @local`, cli.Name),
		RunE: func(cmd *cobra.Command, args []string) error {
			config, err := kubex.LoadRestConfigWithMetaInformation()
			if err != nil {
				return fmt.Errorf("while creating k8s config: %w", err)
			}

			return install.Install(cmd.Context(), os.Stdout, config, opts)
		},
	}

	installCmd = analytics.InjectAnalyticsReporting(*installCmd, "install")

	flags := installCmd.Flags()

	kubex.RegisterKubeconfigFlag(flags)
	flags.DurationVar(&opts.Timeout, "timeout", 10*time.Minute, `Maximum time during which the Botkube installation is being watched, where "0" means "infinite". Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".`)
	flags.BoolVarP(&opts.Watch, "watch", "w", true, "Watches the status of the Botkube installation until it finish or the defined `--timeout` occurs.")

	// common params for install and upgrade operation
	flags.StringVar(&opts.HelmParams.Version, "version", helm.LatestVersionTag, "Botkube version. Possible values @latest, 1.2.0, ...")
	flags.StringVar(&opts.HelmParams.Namespace, "namespace", helm.Namespace, "Botkube installation namespace.")
	flags.StringVar(&opts.HelmParams.ReleaseName, "release-name", helm.ReleaseName, "Botkube Helm chart release name.")
	flags.StringVar(&opts.HelmParams.ChartName, "chart-name", helm.HelmChartName, "Botkube Helm chart name.")
	flags.StringVar(&opts.HelmParams.RepoLocation, "repo", helm.HelmRepoStable, fmt.Sprintf("Botkube Helm chart repository location. It can be relative path to current working directory or URL. Use %s tag to select repository which holds the stable Helm chart versions.", helm.StableVersionTag))
	flags.BoolVar(&opts.HelmParams.DryRun, "dry-run", false, "Simulate an installation")
	flags.BoolVar(&opts.HelmParams.Force, "force", false, "Force resource updates through a replacement strategy")
	flags.BoolVar(&opts.HelmParams.DisableHooks, "no-hooks", false, "Disable pre/post install/upgrade hooks")
	flags.BoolVar(&opts.HelmParams.DisableOpenAPIValidation, "disable-openapi-validation", false, "If set, it will not validate rendered templates against the Kubernetes OpenAPI Schema")
	flags.BoolVar(&opts.HelmParams.SkipCRDs, "skip-crds", false, "If set, no CRDs will be installed.")
	flags.BoolVar(&opts.HelmParams.Atomic, "atomic", false, "If set, process rolls back changes made in case of failed install/upgrade. The --wait flag will be set automatically if --atomic is used")
	flags.BoolVar(&opts.HelmParams.SubNotes, "render-subchart-notes", false, "If set, render subchart notes along with the parent")
	flags.StringVar(&opts.HelmParams.Description, "description", "", "add a custom description")
	flags.BoolVar(&opts.HelmParams.DependencyUpdate, "dependency-update", false, "Update dependencies if they are missing before installing the chart")

	// custom values settings
	flags.StringSliceVarP(&opts.HelmParams.Values.ValueFiles, "values", "f", []string{}, "Specify values in a YAML file or a URL (can specify multiple)")
	flags.StringArrayVar(&opts.HelmParams.Values.Values, "set", []string{}, "Set values on the command line (can specify multiple or separate values with commas: key1=val1,key2=val2)")
	flags.StringArrayVar(&opts.HelmParams.Values.StringValues, "set-string", []string{}, "Set STRING values on the command line (can specify multiple or separate values with commas: key1=val1,key2=val2)")
	flags.StringArrayVar(&opts.HelmParams.Values.FileValues, "set-file", []string{}, "Set values from respective files specified via the command line (can specify multiple or separate values with commas: key1=path1,key2=path2)")
	flags.StringArrayVar(&opts.HelmParams.Values.JSONValues, "set-json", []string{}, "Set JSON values on the command line (can specify multiple or separate values with commas: key1=jsonval1,key2=jsonval2)")
	flags.StringArrayVar(&opts.HelmParams.Values.LiteralValues, "set-literal", []string{}, "Set a literal STRING value on the command line")

	// upgrade only
	flags.BoolVarP(&opts.HelmParams.AutoApprove, "auto-approve", "y", false, "Skips interactive approval when upgrade is required.")
	flags.BoolVar(&opts.HelmParams.ReuseValues, "reuse-values", false, "When upgrading, reuse the last release's values and merge in any overrides from the command line via --set and -f. If '--reset-values' is specified, this is ignored")
	flags.BoolVar(&opts.HelmParams.ResetValues, "reset-values", false, "When upgrading, reset the values to the ones built into the chart")

	return installCmd
}

```

### Core Architecture Module: `cmd/cli/cmd/root.go`
```
package cmd

import (
	"github.com/spf13/cobra"
	"go.szostok.io/version/extension"

	"github.com/kubeshop/botkube/cmd/cli/cmd/config"
	"github.com/kubeshop/botkube/cmd/cli/cmd/telemetry"
	"github.com/kubeshop/botkube/internal/cli"
	"github.com/kubeshop/botkube/internal/cli/heredoc"
)

const (
	orgName  = "kubeshop"
	repoName = "botkube"
)

// NewRoot returns a root cobra.Command for the whole Botkube Cloud CLI.
func NewRoot() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   cli.Name,
		Short: "Botkube CLI",
		Long: heredoc.WithCLIName(`
        <cli> - Botkube CLI

        A utility that simplifies working with Botkube.

        Quick Start:

            $ <cli> install                              # Install Botkube
            $ <cli> uninstall                            # Uninstall Botkube
            `, cli.Name),
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	cli.RegisterVerboseModeFlag(rootCmd.PersistentFlags())

	rootCmd.AddCommand(
		NewDocs(),
		NewInstall(),
		NewUninstall(),
		config.NewCmd(),
		telemetry.NewCmd(),
		extension.NewVersionCobraCmd(
			extension.WithUpgradeNotice(orgName, repoName),
		),
	)

	return rootCmd
}

```

### Core Architecture Module: `cmd/cli/cmd/telemetry/disable.go`
```
package telemetry

import (
	"github.com/spf13/cobra"

	"github.com/kubeshop/botkube/internal/cli"
	"github.com/kubeshop/botkube/internal/cli/heredoc"
)

// NewEnable returns a new cobra.Command for disabling telemetry.
func NewDisable() *cobra.Command {
	enable := &cobra.Command{
		Use:   "disable",
		Short: "Disable Botkube telemetry",
		Example: heredoc.WithCLIName(`
			# To improve the user experience, Botkube collects anonymized data.
			# It does not collect any identifying information, and all analytics
			# are used only as aggregated collection of data to improve Botkube
			# and adjust its roadmap.
			# Read our privacy policy at https://docs.botkube.io/privacy

			# The Botkube CLI tool collects anonymous usage analytics.
			# This data is only available to the Botkube authors and helps us improve the tool.

			# Disable Botkube telemetry
			<cli> telemetry disable
		

		`, cli.Name),
		RunE: func(cmd *cobra.Command, args []string) (err error) {
			config := cli.NewConfig()
			config.Telemetry = cli.TelemetryDisabled
			err = config.Save()
			if err != nil {
				return err
			}
			cmd.Println("Telemetry disabled")
			return nil
		},
	}

	return enable
}

```

### Core Architecture Module: `cmd/cli/cmd/telemetry/enable.go`
```
package telemetry

import (
	"github.com/spf13/cobra"

	"github.com/kubeshop/botkube/internal/cli"
	"github.com/kubeshop/botkube/internal/cli/heredoc"
)

// NewEnable returns a new cobra.Command for enabling telemetry.
func NewEnable() *cobra.Command {
	enable := &cobra.Command{
		Use:   "enable",
		Short: "Enable Botkube telemetry",
		Example: heredoc.WithCLIName(`
			# To improve the user experience, Botkube collects anonymized data.
			# It does not collect any identifying information, and all analytics
			# are used only as aggregated collection of data to improve Botkube
			# and adjust its roadmap.
			# Read our privacy policy at https://docs.botkube.io/privacy

			# Enable Botkube telemetry
			<cli> telemetry enable
		

		`, cli.Name),
		RunE: func(cmd *cobra.Command, args []string) (err error) {
			config := cli.NewConfig()
			config.Telemetry = cli.TelemetryEnabled
			err = config.Save()
			if err != nil {
				return err
			}
			cmd.Println("Telemetry enabled")
			return nil
		},
	}

	return enable
}

```

### Core Architecture Module: `cmd/cli/cmd/telemetry/telemetry.go`
```
package telemetry

import (
	"github.com/spf13/cobra"
)

// NewCmd returns a new cobra.Command subcommand for telemetry-related operations.
func NewCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "telemetry",
		Short: "Configure collection of anonymous analytics",
	}

	root.AddCommand(
		NewEnable(),
		NewDisable(),
	)
	return root
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1483** (2024-11-15): **Remove latest plugin upload to GCS**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Remove latest plugin upload to GCS  GCS bucket is no longer available. 

- **Issue #1481** (2024-11-11): **Fix panic on missing root event type for k8s source**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Fix panic on missing root event type for k8s source    ## Related issue(s)  Fix https://github.com/kubeshop/botkube/issues/1474 

- **Issue #1475** (2024-11-05): **Panic: Send on Closed Channel in Slack SocketMode Client**
  *Symptoms*:  # Bug Report: Panic - Send on Closed Channel in Slack SocketMode Client   ## Description  The Botkube application encounters a panic with the message `send on closed channel` when running the Slack SocketMode client. This issue appears to occur in the `receiveMessagesInto` method within `slack-go/slack` version `v0.12.2`. The issue happens intermittently during the message reception process, causing Botkube to restart unexpectedly. This behavior was observed on Botkube version `v1.8.0`, deployed via Helm.  ## Expected behavior  The Slack SocketMode client should handle messages without triggering a panic, even if channels are closed.  ## Actual behavior  Botkube panics with a `send on closed channel` error, disrupting the Slack integration and triggering an automatic restart. This seems to happen during the message reception phase, as indicated in the logs.  ## Steps to reproduce  1. Set up Botkube version `v1.8.0` with Slack integration using SocketMode, deployed via Helm. 2. Start Botkube and allow it to receive messages for an extended period. 3. Observe intermittent panics with the message `send on closed channel`, followed by a restart of the Botkube process.  ## Logs  ``` panic: send on closed channel  goroutine 112834 [running]: github.com/slack-go/slack/socketmode.(*Client).receiveMessagesInto(0xc00097ee10, {0x2dc2430, 0xc0000baaf0}, 0xc000b2c180?, 0xc000bb0120)     /home/runner/go/pkg/mod/github.com/slack-go/slack@v0.12.2/socketmode/sock
  **Post-Mortem & Fix Analysis**:
  > Hi @maks3201, please try to use the latest version (1.13) as I believe we fixed the issue in one of the newer releases 👍   If you can still encounter, then please reply in the issue. Cheers!

- **Issue #1474** (2024-11-11): **Segmentation Fault in botkube/kubernetes Plugin with autoscaling/v2 HPA Events Monitoring**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the issue: 1. Search open and closed issues for duplicates. 2. Read the contributing guidelines (CONTRIBUTING.md file on root of the repository). -->  ## Description  The botkube/kubernetes plugin encounters repeated memory access errors, specifically segmentation faults and nil pointer dereference issues, when configured with certain sources such as k8s-hpa-events. The issue consistently arises when attempting to monitor the autoscaling/v2 API group for horizontalpodautoscalers events related to HPA scaling. This results in the plugin crashing, and although the Plugin Health Monitor attempts to restart it several times, the plugin ultimately becomes deactivated.  I’m using BotKube v1.13.0, and the issue seems to occur during the plugin’s interaction with the Kubernetes API for these particular resources.  ## Expected behavior  With the k8s-hpa-events source enabled, BotKube should monitor horizontalpodautoscalers resources and successfully capture SuccessfulRescale events without crashing. These events should then be forwarded as notifications to Slack.  ## Actual behavior  When the k8s-hpa-events source is enabled, the following issues occur:  	1.	The kubernetes plugin crashes with a plugin process exited error. 	2.	The Plugin Health Monitor retries the plugin multiple times, but after several failures, it deactivates the plugin. 	3.	Repeated segmentation faults and memory access errors such as inv
  **Post-Mortem & Fix Analysis**:
  > Hi @washswat-west,  Thanks a lot for reporting this issue! I've already created a PR to address that bug.  **However, you can already apply a workaround with version v1.13.0, which you are currently using.** You just need to define the top-level event type: ```yaml sources:   'k8s-hpa-events':     displayName: "HPA Scaling Events"     botkube/kubernetes:       context: &default-plugin-context         rbac:           group:             type: Static             prefix: ""             static:               values: ["botkube-plugins-default"]       enabled: true       config:         namespaces:           include:             - ".*"         event:           types:   # <------ in v1.13.0 this is required and will cause a panic if not set             - create             - delete             - update             - error          resources:           - type: autoscaling/v2/horizontalpodautoscalers             event:               types:                 - crea

- **Issue #1462** (2024-06-19): **Add missing UI URL for prod tests**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Add missing UI URL for prod tests

- **Issue #1448** (2024-05-24): **Update links in Helm chart values file**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Update links in Helm chart values file  

- **Issue #1441** (2024-05-09): **fix: close temporary kubeconfig file**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - ...  ## Testing  <!-- Describe necessary steps to test the changes. You can refer to the existing documentation if some steps are already described. -->  ## Related issue(s)  <!-- If you refer to a particular issue, provide its number. To close the issue after the pull request merge, use `Resolves #123` or `Fixes #123`. Otherwise, use `See also #123` or just `#123`. --> 

- **Issue #1437** (2024-11-19): **Forced to Delete Plugins in Web GUI before updating Botkube Version**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the issue: 1. Search open and closed issues for duplicates. 2. Read the contributing guidelines (CONTRIBUTING.md file on root of the repository). -->  ## Description When I go to update versions (last time it was 1.6->1.8. This time it was 1.8->1.10) it forces me to delete all the plugins that I have installed in the web GUI before it lets me update.  Maybe it is just my setup (Docker>Minikube on a Mac M1 Air) but it has happened twice now. I recorded it happening here. The volume is low, but I have voice on the videos, I promise!  Failing to Upgrade Botkube Version Video: https://drive.google.com/file/d/1l1D7rDrpZbxRsTgOSYL5g90c-kykQ5bT/view?usp=drive_link  Botkube Upgrade working after deleting all plugins: https://drive.google.com/file/d/1jHafkUVPlExU-Taz3hCHaOuHx4CG4GU7/view?usp=sharing   <!-- Provide a clear and concise description of the problem. Describe where it appears, when it occurred, and what it affects. Provide all relevant technical details such as the Botkube version. -->  ## Expected behavior Running the update command will upgrade Botkube from 1.8 to 1.10 while keeping my plugins. <!-- Describe what you expect to happen. -->  ## Actual behavior Botkube fails before the update can finish unless I go into app.botkube.io and delete all plugins first and then run the command <!-- Describe what happens instead. -->  ## Steps to reproduce 1. Run Upgrade command with Kubernetes, Prom
  **Post-Mortem & Fix Analysis**:
  > Reposting original answer from https://kubeshop.slack.com/archives/C03MRCX7UE9/p1714978750726999?thread_ts=1714662799.959579&cid=C03MRCX7UE9:   > Thanks Evan for the report! > Based on the first recording it looks like Botkube restarted itself because of timeout on kubectl download. It might be related to internet connectivity, or [dl.k8s.io](http://dl.k8s.io/) had some issues 🤔 At later stage we should mirror all of the dependencies to fetch them from GCS. > So if CLI says "upgrade failed", the actual upgrade was executed successfully but Botkube restarted with an error. However, with such networking issue, probably a single restart or two should resolve this. >  > You could try to adjust the time when Kubernetes restarts Botkube pod with the livenessProbe configuration (https://github.com/kubeshop/botkube/blob/main/helm/botkube/values.yaml#L742C5-L749C24): >  >  e.g. > ``` > --set deployment.livenessProbe.initialDelaySeconds=30 > ``` >  > Next time if you'll have such 

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

### Incident Patch 1: `2b275b44` (2024-11-11)
**Commit Message**: Fix panic on missing root event type for k8s source (#1481)

**File**: `internal/source/kubernetes/router.go` (modified, +14/-10)
```diff
@@ -2,6 +2,7 @@ package kubernetes
 
 import (
 	"context"
+	"strings"
 
 	"github.com/sirupsen/logrus"
 	"k8s.io/apimachinery/pkg/api/meta"
@@ -156,7 +157,7 @@ func mergeResourceEvents(cfgs map[string]SourceConfig) mergedEvents {
 			if _, ok := out[resource.Type]; !ok {
 				out[resource.Type] = make(map[config.EventType]struct{})
 			}
-			for _, e := range flattenEventTypes(cfg.Event.Types, resource.Event.Types) {
+			for _, e := range flattenEventTypes(cfg.Event, resource.Event) {
 				out[resource.Type][e] = struct{}{}
 			}
 		}
@@ -178,7 +179,7 @@ func (r *Router) mergeEventRoutes(resource string, cfgs map[string]SourceConfig)
 		cfg := srcCfg.cfg
 		for idx := range cfg.Resources {
 			r := cfg.Resources[idx] // make sure that we work on a copy
-			for _, e := range flattenEventTypes(cfg.Event.Types, r.Event.Types) {
+			for _, e := range flattenEventTypes(cfg.Event, r.Event) {
 				if resource != r.Type {
 					continue
 				}
@@ -188,7 +189,7 @@ func (r *Router) mergeEventRoutes(resource string, cfgs map[string]SourceConfig)
 					Annotations:  resourceStringMap(cfg.Annotations, r.Annotations),
 					Labels:       resourceStringMap(cfg.Labels, r.Labels),
 					ResourceName: r.Name,
-					Event:        resourceEvent(*cfg.Event, r.Event),
+					Event:        resourceEvent(cfg.Event, r.Event),
 				}
 				if e == config.UpdateEvent {
 					route.UpdateSetting = &config.UpdateSetting{
@@ -248,7 +249,7 @@ func (r *Router) setEventRouteForRecommendationsIfShould(routeMap *map[config.Ev
 func eventRoutes(routeTable map[string][]entry, targetResource string, targetEvent config.EventType) []route {
 	var out []route
 	for _, routedEvent := range routeTable[targetResource] {
-		if routedEvent.Event == targetEvent {
+		if strings.EqualFold(string(routedEvent.Event), string(targetEvent)) {
 			out = append(out, routedEvent.Routes...)
 		}
 	}
@@ -287,10 +288,13 @@ func (r *Router) mappedInformer(event config.EventType) (registration, bool) {
 	return registration{}, false
 }
 
-func flattenEventTypes(globalEvents []config.EventType, resourceEvents config.KubernetesResourceEventTypes) []config.EventType {
-	checkEvents := globalEvents
-	if len(resourceEvents) > 0 {
-		checkEvents = resourceEvents
+func flattenEventTypes(globalEvents *config.KubernetesEvent, resourceEvents config.KubernetesEvent) []config.EventType {
+	var checkEvents []config.EventType
+	if globalEvents != nil {
+		checkEvents = globalEvents.Types
+	}
+	if len(resourceEvents.Types) > 0 {
+		checkEvents = resourceEvents.Types
 	}
 
 	var out []config.EventType
@@ -321,10 +325,10 @@ func resourceStringMap(sourceMap *map[string]string, resourceMap map[string]stri
 	return sourceMap
 }
 
-func resourceEvent(sourceEvent, resourceEvent config.KubernetesEvent) *config.KubernetesEvent {
+func resourceEvent(sourceEvent *config.KubernetesEvent, resourceEvent config.KubernetesEvent) *config.KubernetesEvent {
 	if resourceEvent.AreConstraintsDefined() {
 		return &resourceEvent
 	}
 
-	return &sourceEvent
+	return sourceEvent
 }
```

**File**: `internal/source/kubernetes/router_test.go` (modified, +34/-0)
```diff
@@ -74,6 +74,40 @@ func TestRouter_BuildTable_CreatesRoutesWithProperEventsList(t *testing.T) {
 	}
 }
 
+func TestRouter_BuildTable_WithoutRootTypes(t *testing.T) {
+	const resourceType = "autoscaling/v2/horizontalpodautoscalers"
+
+	givenCfg := map[string]SourceConfig{
+		"k8s-events": {
+			name: "k8s-events",
+			cfg: config.Config{
+				Resources: []config.Resource{
+					{
+						Type: resourceType,
+						Event: config.KubernetesEvent{
+							Reason: config.RegexConstraints{
+								Include: []string{
+									"SuccessfulRescale",
+								},
+							},
+							Types: config.KubernetesResourceEventTypes{
+								"Normal",
+							},
+						},
+					},
+				},
+				Namespaces: &config.RegexConstraints{
+					Include: []string{
+						".*",
+					},
+				},
+			},
+		},
+	}
+	router := NewRouter(nil, nil, loggerx.NewNoop()).BuildTable(givenCfg)
+	assert.Len(t, router.getSourceRoutes(resourceType, config.NormalEvent), 1)
+}
+
 func TestRouterListMergingNestedFields(t *testing.T) {
 	// given
 	router := NewRouter(nil, nil, loggerx.NewNoop())
```

---

### Incident Patch 2: `3f04c2aa` (2024-06-20)
**Commit Message**: Fix and enable instance details page UI tests (#1461)

**File**: `test/cloud-slack-dev-e2e/botkube_page_helpers_test.go` (modified, +15/-6)
```diff
@@ -174,6 +174,7 @@ func (p *BotkubeCloudPage) FinishWizard(t *testing.T) {
 	t.Log("Navigating to plugin selection")
 	p.page.Screenshot("before-first-next")
 
+	time.Sleep(3 * time.Second)
 	p.page.MustElementR("button", "/^Next$/i").
 		MustWaitEnabled().
 		// We need to wait, otherwise, we click the same 'Next' button twice before the query is executed, and we are not really
@@ -183,6 +184,7 @@ func (p *BotkubeCloudPage) FinishWizard(t *testing.T) {
 	p.page.Screenshot("after-first-next")
 
 	t.Log("Using pre-selected plugins. Navigating to wizard summary")
+	time.Sleep(3 * time.Second)
 	p.page.MustElementR("button", "/^Next$/i").
 		MustWaitEnabled().
 		// We need to wait, otherwise, we click the same 'Next' button twice before the query is executed, and we are not really
@@ -191,26 +193,31 @@ func (p *BotkubeCloudPage) FinishWizard(t *testing.T) {
 	p.page.Screenshot("after-second-next")
 
 	t.Log("Submitting changes")
+	time.Sleep(3 * time.Second)
 	p.page.MustElementR("button", "/^Deploy changes$/i").
 		MustWaitEnabled().
 		MustClick()
 	p.page.Screenshot("after-deploy-changes")
 
-	// wait till gql mutation passes, and navigates to install details, otherwise, we could navigate to instance details with state 'draft'
+	// wait till gql mutation passes, and navigates to instance details, otherwise, we could navigate to instance details with state 'draft'
 	p.page.MustWaitNavigation()
 	p.page.Screenshot("after-deploy-changes-navigation")
 }
 
 func (p *BotkubeCloudPage) UpdateKubectlNamespace(t *testing.T) {
 	t.Log("Updating 'kubectl' namespace property")
-	
+
 	p.openKubectlUpdateForm()
-	
+
 	p.page.MustElementR("input#root_defaultNamespace", "default").MustSelectAllText().MustInput("kube-system")
 	p.page.Screenshot("after-changing-namespace-property")
 	p.page.MustElementR("button", "/^Update$/i").MustClick()
 	p.page.Screenshot("after-clicking-plugin-update")
 
+	t.Log("Moving to top left corner of the page")
+	p.page.Mouse.MustMoveTo(0, 0)
+	p.page.Screenshot("after-moving-to-top-left")
+
 	t.Log("Submitting changes")
 	p.page.MustWaitStable()
 	p.page.MustElementR("button", "/Deploy changes/i").MustClick()
@@ -230,10 +237,12 @@ func (p *BotkubeCloudPage) openKubectlUpdateForm() {
 
 	p.page.MustWaitStable()
 	p.page.Screenshot("after-selecting-plugins-tab")
-	
-	p.page.MustElement(`button[id^="botkube/kubectl_"]`).MustClick()
+
+	p.page.MustElement(`button[id^="botkube/kubectl_"]`).
+		MustWaitEnabled(). // needed as we have an "Outdated version detected" glitch
+		MustClick()
 	p.page.Screenshot("after-opening-kubectl-cfg")
-	
+
 	p.page.MustElement(`div[data-node-key="ui-form"]`).MustClick()
 	p.page.Screenshot("after-selecting-kubectl-cfg-form")
 }
```

**File**: `test/cloud-slack-dev-e2e/cloud_slack_dev_e2e_test.go` (modified, +6/-9)
```diff
@@ -42,7 +42,7 @@ type E2ESlackConfig struct {
 	Slack        SlackConfig
 	BotkubeCloud BotkubeCloudConfig
 
-	PageTimeout    time.Duration `envconfig:"default=5m"`
+	PageTimeout    time.Duration `envconfig:"default=10m"`
 	ScreenshotsDir string        `envconfig:"optional"`
 	DebugMode      bool          `envconfig:"default=false"`
 
@@ -152,20 +152,17 @@ func TestCloudSlackE2E(t *testing.T) {
 		botkubeCloudPage.InstallAgentInCluster(t, cfg.BotkubeCliBinaryPath)
 		botkubeCloudPage.OpenSlackAppIntegrationPage(t)
 
-		slackPage.ConnectWorkspace(t, isHeadless, browser)
+		slackPage.ConnectWorkspace(t, browser)
 
 		botkubeCloudPage.ReAddSlackPlatformIfShould(t, isHeadless)
 		botkubeCloudPage.SetupSlackWorkspace(t, channel.Name())
 		botkubeCloudPage.FinishWizard(t)
 		botkubeCloudPage.VerifyDeploymentStatus(t, "Connected")
 
-		if !isHeadless { // it is flaky on CI, more investigation needed
-			botkubeCloudPage.UpdateKubectlNamespace(t)
-			botkubeCloudPage.VerifyDeploymentStatus(t, "Updating")
-			botkubeCloudPage.VerifyDeploymentStatus(t, "Connected")
-			botkubeCloudPage.VerifyUpdatedKubectlNamespace(t)
-		}
-
+		botkubeCloudPage.UpdateKubectlNamespace(t)
+		botkubeCloudPage.VerifyDeploymentStatus(t, "Updating")
+		botkubeCloudPage.VerifyDeploymentStatus(t, "Connected")
+		botkubeCloudPage.VerifyUpdatedKubectlNamespace(t)
 	})
 
 	t.Run("Run E2E tests with deployment", func(t *testing.T) {
```

**File**: `test/cloud-slack-dev-e2e/slack_page_helpers_test.go` (modified, +46/-25)
```diff
@@ -3,71 +3,92 @@
 package cloud_slack_dev_e2e
 
 import (
+	"context"
+	"errors"
+	"github.com/stretchr/testify/assert"
 	"testing"
 	"time"
 
 	"github.com/go-rod/rod"
 )
 
-const slackBaseURL = "slack.com"
+const (
+	slackBaseURL          = "slack.com"
+	waitTime              = 10 * time.Second
+	contextTimeout        = 30 * time.Second
+	shorterContextTimeout = 10 * time.Second
+)
 
 type SlackPage struct {
 	page *Page
-	cfg  SlackConfig
+	cfg  E2ESlackConfig
 }
 
 func NewSlackPage(t *testing.T, cfg E2ESlackConfig) *SlackPage {
 	return &SlackPage{
 		page: &Page{t: t, cfg: cfg},
-		cfg:  cfg.Slack,
+		cfg:  cfg,
 	}
 }
 
-func (p *SlackPage) ConnectWorkspace(t *testing.T, headless bool, browser *rod.Browser) {
+func (p *SlackPage) ConnectWorkspace(t *testing.T, browser *rod.Browser) {
 	p.page.Page = browser.MustPages().MustFindByURL(slackBaseURL)
+	p.page.MustWaitStable()
 
-	p.page.MustElement("input#domain").MustInput(p.cfg.WorkspaceName)
-
+	defer func(page *Page) {
+		err := page.Close()
+		if err != nil {
+			if errors.Is(err, context.Canceled) {
+				return
+			}
+			t.Fatalf("Failed to close page: %s", err.Error())
+		}
+	}(p.page)
+
+	p.page.MustElement("input#domain").MustInput(p.cfg.Slack.WorkspaceName)
 	p.page.MustElementR("button", "Continue").MustClick()
-	p.page.Screenshot()
-
-	// here we get reloaded, so we need to type it again (looks like bug on Slack side)
-	if !headless {
-		p.page.MustElement("input#domain").MustInput(p.cfg.WorkspaceName)
-		p.page.MustElementR("button", "Continue").MustClick()
-	}
+	p.page.Screenshot("after-continue")
 
 	p.page.MustWaitStable()
 	p.page.MustElementR("a", "sign in with a password instead").MustClick()
-	p.page.Screenshot()
-	p.page.MustElement("input#email").MustInput(p.cfg.Email)
-	p.page.MustElement("input#password").MustInput(p.cfg.Password)
+	p.page.Screenshot("after-sign-in-with-password")
+	p.page.MustElement("input#email").MustInput(p.cfg.Slack.Email)
+	p.page.MustElement("input#password").MustInput(p.cfg.Slack.Password)
 	p.page.Screenshot()
 
 	t.Log("Hide Slack cookie banner that collides with 'Sign in' button")
-	cookie, err := p.page.Timeout(5 * time.Second).Element("button#onetrust-accept-btn-handler")
+	pageWithTimeout := p.page.Timeout(shorterContextTimeout)
+	t.Cleanup(func() {
+		_ = pageWithTimeout.Close()
+	})
+
+	cookieElem, err := pageWithTimeout.Element("button#onetrust-accept-btn-handler")
 	if err != nil {
 		t.Logf("Failed to obtain cookie element: %s. Skipping...", err.Error())
 	} else {
-		cookie.MustClick()
+		cookieElem.MustClick()
 	}
 
 	p.page.MustElementR("button", "/^Sign in$/i").MustClick()
-	p.page.Screenshot()
+	p.page.Screenshot("after-sign-in")
 
+	time.Sleep(waitTime) // ensure the screenshots shows a page after "Sign in" click
+	p.page.Screenshot("after-sign-in-page")
 	p.page.MustElementR("button.c-button:not(.c-button--disabled)", "Allow").MustClick()
 
 	t.Log("Finalizing Slack workspace connection...")
-	if p.cfg.WorkspaceAlreadyConnected {
+	if p.cfg.Slack.WorkspaceAlreadyConnected {
 		t.Log("Expecting already connected message...")
 		p.page.MustElementR("div.ant-result-title", "Organization Already Connected!")
 	} else {
 		t.Log("Finalizing connection...")
-		p.page.Screenshot()
-		p.page.MustElement("button#slack-workspace-connect").MustClick().
-			MustWaitEnabled() // when it's re-enabled, then it means the query was finished 
-		p.page.Screenshot()
+		time.Sleep(waitTime)
+		p.page.Screenshot("before-workspace-connect")
+		p.page.MustElement("button#slack-workspace-connect").MustClick()
+		p.page.Screenshot("after-workspace-connect")
 	}
 
-	_ = p.page.Close() // the page should be closed automatically anyway
+	t.Log("Waiting for page auto-close...")
+	err = p.page.WaitIdle(waitTime) // wait for auto-close
+	assert.NoError(t, err)
 }
```

---

### Incident Patch 3: `1eb65e78` (2024-05-09)
**Commit Message**: fix: close temporary kubeconfig file (#1441)

**File**: `pkg/plugin/kubeconfig.go` (modified, +1/-0)
```diff
@@ -123,6 +123,7 @@ func PersistKubeConfig(_ context.Context, kc []byte) (string, func(context.Conte
 	if err != nil {
 		return "", nil, errors.Wrap(err, "while writing kube config to file")
 	}
+	defer file.Close()
 
 	abs, err := filepath.Abs(file.Name())
 	if err != nil {
```

---

### Incident Patch 4: `a3695165` (2024-05-09)
**Commit Message**: Update go.mod in test pkg to latest cloud version to fix Teams assertion (#1440)

**File**: `test/go.mod` (modified, +2/-2)
```diff
@@ -14,8 +14,8 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/hasura/go-graphql-client v0.10.2
 	github.com/infracloudio/msbotbuilder-go v0.2.6-0.20231130085215-84d2040b3577
-	github.com/kubeshop/botkube v0.13.1-0.20240422102108-216a2f38b7dd
-	github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a
+	github.com/kubeshop/botkube v0.13.1-0.20240508144003-3487564b83a1
+	github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240508145541-6aa7480265af
 	github.com/markbates/errx v1.1.0
 	github.com/microsoftgraph/msgraph-sdk-go v1.31.0
 	github.com/nsf/jsondiff v0.0.0-20230430225905-43f6cf3098c1
```

**File**: `test/go.sum` (modified, +2/-2)
```diff
@@ -852,8 +852,8 @@ github.com/kr/pty v1.1.5/go.mod h1:9r2w37qlBe7rQ6e1fg1S/9xpWHSnaqNdHD3WcMdbPDA=
 github.com/kr/text v0.1.0/go.mod h1:4Jbv+DJW3UT/LiOwJeYQe1efqtUx/iVham/4vfdArNI=
 github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
 github.com/kr/text v0.2.0/go.mod h1:eLer722TekiGuMkidMxC/pM04lWEeraHUUmBw8l2grE=
-github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a h1:Y15ERlsgBYD/XlFEwfVFYOPeEUAooPpns7CO0cxhcz0=
-github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a/go.mod h1:Ggbu2gvDwQxQWHRKcV6JUeqvo+rsZ0k+ww6PV1LSNoo=
+github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240508145541-6aa7480265af h1:ewFR7Y1fGCcG1YzQwpxL36tOUIJmDJK7aR/DMoFrPCQ=
+github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240508145541-6aa7480265af/go.mod h1:qVsXQutuaUP+4eoSs4SCpVWvfZLWxs9yB459JclAAuk=
 github.com/kubeshop/go-adaptive-cards v0.0.0-20231114223529-d6d8b980f0c8 h1:uTChAaS5OdD9gGXnafXMUhMo1gyyX2loCjoCyQr5mlg=
 github.com/kubeshop/go-adaptive-cards v0.0.0-20231114223529-d6d8b980f0c8/go.mod h1:RtCzt65p/zEos6+zhiCFQmiaHmro6M63l9NP7xXx/Lg=
 github.com/kylelemons/godebug v1.1.0 h1:RPNrshWIDI6G2gRW9EHilWtl7Z6Sb1BR0xunSBf0SNc=
```

---

### Incident Patch 5: `d4a164f5` (2024-04-23)
**Commit Message**: Fix integration and E2E tests after Cloud Dev update (#1435)

**File**: `test/cloud-slack-dev-e2e/cloud_slack_dev_e2e_test.go` (modified, +4/-3)
```diff
@@ -646,10 +646,11 @@ func removeSourcesAndAddActions(t *testing.T, gql *graphql.Client, existingDeplo
 	platforms := gqlModel.PlatformsUpdateInput{}
 
 	for _, slack := range existingDeployment.Platforms.CloudSlacks {
-		var channelUpdateInputs []*gqlModel.ChannelBindingsByNameUpdateInput
+		var channelUpdateInputs []*gqlModel.ChannelBindingsByNameAndIDUpdateInput
 		for _, channel := range slack.Channels {
-			channelUpdateInputs = append(channelUpdateInputs, &gqlModel.ChannelBindingsByNameUpdateInput{
-				Name: channel.Name,
+			channelUpdateInputs = append(channelUpdateInputs, &gqlModel.ChannelBindingsByNameAndIDUpdateInput{
+				ChannelID: "", // this is used for UI only so we don't need to provide it
+				Name:      channel.Name,
 				Bindings: &gqlModel.BotBindingsUpdateInput{
 					Sources:   nil,
 					Executors: []*string{&channel.Bindings.Executors[0]},
```

**File**: `test/cloud_graphql/graphql_client.go` (modified, +3/-2)
```diff
@@ -215,9 +215,10 @@ func (c *Client) CreateBasicDeploymentWithCloudSlack(t *testing.T, clusterName,
 					{
 						Name:   "Cloud Slack",
 						TeamID: slackTeamID,
-						Channels: []*gqlModel.ChannelBindingsByNameCreateInput{
+						Channels: []*gqlModel.ChannelBindingsByNameAndIDCreateInput{
 							{
-								Name: channelName,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      channelName,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("kubernetes_config")},
 									Executors: []*string{ptr.FromType("kubectl_config")},
```

**File**: `test/commplatform/slack_tester.go` (modified, +8/-8)
```diff
@@ -596,16 +596,16 @@ func (s *SlackTester) restoreMsgTsIfNeeded() {
 }
 
 var emojiSlackMapping = map[string]string{
-	"🟢": ":large_green_circle:",
-	"💡": ":bulb:",
-	"❗": ":exclamation:",
-	"🚀": ":rocket:",
-	"🏁": ":checkered_flag:",
+	"🟢":  ":large_green_circle:",
+	"💡":  ":bulb:",
+	"❗":  ":exclamation:",
+	"🚀":  ":rocket:",
+	"🏁":  ":checkered_flag:",
 	"🛠️": ":hammer_and_wrench:",
-	"📣": ":mega:",
+	"📣":  ":mega:",
 	"☁️": ":cloud:",
-	"🤖": ":robot_face:",
-	"🔮": ":crystal_ball:",
+	"🤖":  ":robot_face:",
+	"🔮":  ":crystal_ball:",
 }
 
 func replaceEmojiWithTags(content string) string {
```

**File**: `test/e2e/bots_test.go` (modified, +2/-1)
```diff
@@ -6,7 +6,6 @@ import (
 	"bytes"
 	"context"
 	"fmt"
-	"github.com/avast/retry-go/v4"
 	"net/http"
 	"os"
 	"regexp"
@@ -17,6 +16,8 @@ import (
 	"time"
 	"unicode"
 
+	"github.com/avast/retry-go/v4"
+
 	"botkube.io/botube/test/helmx"
 
 	"botkube.io/botube/test/botkubex"
```

**File**: `test/e2e/gql_client.go` (modified, +7/-4)
```diff
@@ -372,25 +372,28 @@ func (c *Client) CreateBasicDeploymentWithCloudSlack(t *testing.T, clusterName,
 					{
 						Name:   "Cloud Slack",
 						TeamID: slackTeamID,
-						Channels: []*gqlModel.ChannelBindingsByNameCreateInput{
+						Channels: []*gqlModel.ChannelBindingsByNameAndIDCreateInput{
 							{
-								Name: firstChannel,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      firstChannel,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("k8s-events"), ptr.FromType("k8s-annotated-cm-delete"), ptr.FromType("k8s-pod-create-events"), ptr.FromType("other-plugins")},
 									Executors: []*string{ptr.FromType("kubectl-first-channel-cmd"), ptr.FromType("other-plugins"), ptr.FromType("helm")},
 								},
 								NotificationsDisabled: ptr.FromType[bool](false),
 							},
 							{
-								Name: secondChannel,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      secondChannel,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("k8s-updates")},
 									Executors: []*string{ptr.FromType("k8s-default-tools")},
 								},
 								NotificationsDisabled: ptr.FromType[bool](true),
 							},
 							{
-								Name: thirdChannel,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      thirdChannel,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("rbac-with-static-mapping"), ptr.FromType("rbac-with-default-configuration")},
 									Executors: []*string{ptr.FromType("rbac-with-channel-mapping"), ptr.FromType("rbac-with-no-configuration")},
```

---

### Incident Patch 6: `9bd883c2` (2024-04-09)
**Commit Message**: Fix Teams integration tests assertions (#1429)

Fix Teams e2e tests assertions

**File**: `test/commplatform/teams_tester.go` (modified, +5/-2)
```diff
@@ -256,8 +256,7 @@ func (s *TeamsTester) WaitForMessagePosted(userID, channelID string, limitMessag
 }
 
 func (s *TeamsTester) WaitForMessagePostedRecentlyEqual(userID, channelID, expectedMsg string) error {
-	msg := api.NewPlaintextMessage(expectedMsg, false)
-	return s.waitForAdaptiveCardMessage(userID, channelID, s.cfg.RecentMessagesLimit, interactive.CoreMessage{Message: msg})
+	return s.WaitForInteractiveMessagePosted(userID, channelID, s.cfg.RecentMessagesLimit, s.AssertEquals(expectedMsg))
 }
 
 func (s *TeamsTester) WaitForInteractiveMessagePosted(userID, channelID string, limitMessages int, assertFn MessageAssertion) error {
@@ -378,6 +377,10 @@ func (s *TeamsTester) AssertEquals(expectedMsg string) MessageAssertion {
 	return func(gotMsg string) (bool, int, string) {
 		gotMsg, expectedMsg = NormalizeTeamsWhitespacesInMessages(gotMsg, expectedMsg)
 		expectedMsg = teamsx.ReplaceEmojiTagsWithActualOne(expectedMsg)
+		// For teams the '*' means the underscore, so we need to replace it with '_'
+		// That's the reason why the 'expectedMsg' should become the api.Message in the future
+		// as we can't use the Markdown formatting directly in our test assertions.
+		expectedMsg = strings.ReplaceAll(expectedMsg, "*", "_")
 		if !strings.EqualFold(expectedMsg, gotMsg) {
 			count := diff.CountMatchBlock(expectedMsg, gotMsg)
 			msgDiff := diff.Diff(expectedMsg, gotMsg)
```

**File**: `test/e2e/bots_test.go` (modified, +17/-33)
```diff
@@ -265,7 +265,7 @@ func runBotTest(t *testing.T,
 			gqlCli.MustCreateAlias(t, alias[0], alias[1], alias[2], deployment.ID)
 		}
 		// Setting env is needed to instrument help msg with cloud sections, and proper links
-		os.Setenv("CONFIG_PROVIDER_IDENTIFIER", deployment.ID) 
+		os.Setenv("CONFIG_PROVIDER_IDENTIFIER", deployment.ID)
 		t.Cleanup(func() {
 			err := helmx.WaitForUninstallation(context.Background(), t, &botkubeDeploymentUninstalled)
 			assert.NoError(t, err)
@@ -382,8 +382,13 @@ func runBotTest(t *testing.T,
 			botDriver.PostMessageToBot(t, botDriver.FirstChannel().Identifier(), command)
 
 			expectedBody := ".... empty response _*<cricket sounds>*_ :cricket: :cricket: :cricket:"
-			if botDriver.Type() == commplatform.SlackBot {
+			switch botDriver.Type() {
+			case commplatform.SlackBot:
 				expectedBody = ".... empty response _*&lt;cricket sounds&gt;*_ :cricket: :cricket: :cricket:"
+			case commplatform.TeamsBot:
+				// the MS Teams treats the '_*<cricket sounds>*_' as the HTML tag and renders it into '<em><em></em></em>'
+				// which is later dropped by the markdown converter
+				expectedBody = ".... empty response  :cricket: :cricket: :cricket:"
 			}
 
 			err = waitForLastPlaintextMessageWithHeaderEqual(appCfg, botDriver, command, expectedBody)
@@ -506,7 +511,7 @@ func runBotTest(t *testing.T,
 			t.Log("Expecting bot message channel...")
 			expectedMsg := fmt.Sprintf("Plugin cm-watcher detected `ADDED` event on `%s/%s`", cfgMap.Namespace, cfgMap.Name)
 
-			err = waitForLastPlaintextMessageEqual(botDriver, botDriver.FirstChannel().ID(), expectedMsg)
+			err = botDriver.OnChannel().WaitForLastMessageEqual(botDriver.BotUserID(), botDriver.FirstChannel().ID(), expectedMsg)
 			assert.NoError(t, err)
 		})
 
@@ -538,7 +543,7 @@ func runBotTest(t *testing.T,
 			t.Log("Expecting bot message channel...")
 			expectedMsg := fmt.Sprintf("*Incoming webhook event:* %s", message)
 
-			err = waitForLastPlaintextMessageEqual(botDriver, botDriver.FirstChannel().ID(), expectedMsg)
+			err = botDriver.OnChannel().WaitForLastMessageEqual(botDriver.BotUserID(), botDriver.FirstChannel().ID(), expectedMsg)
 			assert.NoError(t, err)
 		})
 	})
@@ -1372,7 +1377,7 @@ func runBotTest(t *testing.T,
 			t.Log("Expecting bot message in third channel...")
 			expectedMsg := fmt.Sprintf("Plugin cm-watcher detected `DELETED` event on `%s/%s`", cfgMap.Namespace, cfgMap.Name)
 
-			err = waitForLastPlaintextMessageEqual(botDriver, botDriver.ThirdChannel().ID(), expectedMsg)
+			err = botDriver.OnChannel().WaitForLastMessageEqual(botDriver.BotUserID(), botDriver.ThirdChannel().ID(), expectedMsg)
 			require.NoError(t, err)
 
 			t.Cleanup(func() { cleanupCreatedCfgMapIfShould(t, cfgMapCli, cfgMap.Name, &cfgMapAlreadyDeleted) })
@@ -1736,31 +1741,16 @@ func trimRightWhitespace(input string) string {
 	return strings.Join(lines, "\n")
 }
 
-func waitForLastPlaintextMessageEqual(driver commplatform.BotDriver, channelID, expectedMsg string) error {
-	switch driver.Type() {
-	case commplatform.TeamsBot:
-		// in this case of a plain text message, Teams renderer uses Adaptive Cards format
-		return driver.WaitForLastInteractiveMessagePostedEqual(driver.BotUserID(), channelID, interactive.CoreMessage{
-			Message: api.Message{
-				BaseBody: api.Body{
-					Plaintext: expectedMsg,
-				},
-			},
-		})
-	default:
-		return driver.OnChannel().WaitForLastMessageEqual(driver.BotUserID(), channelID, expectedMsg)
+func waitForLastPlaintextMessageWithHeaderEqual(cfg Config, driver commplatform.BotDriver, cmd, expectedBody string) error {
+	cmdHeader := func(command string) string {
+		return fmt.Sprintf("`%s` on `%s`", command, cfg.ClusterName)
 	}
-}
 
-func waitForLastPlaintextMessageWithHeaderEqual(cfg Config, driver commplatform.BotDriver, cmd, expectedBody string) error {
-	return waitForLastMessageWithHeaderEqual(cfg, driver, cmd, expectedBody, false)
+	expectedMessage := fmt.Sprintf("%s\n%s", cmdHeader(cmd), expectedBody)
+	return
```

---

### Incident Patch 7: `2cb5eacc` (2024-04-03)
**Commit Message**: Reduce memory consumption for Kubernetes source configuration (#1425)

**File**: `cmd/botkube-agent/main.go` (modified, +1/-1)
```diff
@@ -396,7 +396,7 @@ func run(ctx context.Context) (err error) {
 	scheduler := source.NewScheduler(ctx, logger, conf, sourcePluginDispatcher, schedulerChan)
 	err = scheduler.Start(ctx)
 	if err != nil {
-		return reportFatalError("while starting source plugin event dispatcher: %w", err)
+		return reportFatalError("while starting source plugin event dispatcher", err)
 	}
 
 	if conf.Plugins.IncomingWebhook.Enabled {
```

**File**: `internal/source/dispatcher.go` (modified, +0/-2)
```diff
@@ -88,8 +88,6 @@ func NewDispatcher(log logrus.FieldLogger, clusterName string, notifiers map[str
 }
 
 // Dispatch starts a given plugin, watches for incoming events and calling all notifiers to dispatch received event.
-// Once we will have the gRPC contract established with proper Cloud Event schema, we should move also this logic here:
-// https://github.com/kubeshop/botkube/blob/525c737956ff820a09321879284037da8bf5d647/pkg/controller/controller.go#L200-L253
 func (d *Dispatcher) Dispatch(dispatch PluginDispatch) error {
 	log := d.log.WithFields(logrus.Fields{
 		"pluginName": dispatch.pluginName,
```

**File**: `internal/source/kubernetes/bg_processor.go` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+package kubernetes
+
+import (
+	"context"
+	"sync"
+	"time"
+
+	"github.com/sirupsen/logrus"
+	"golang.org/x/sync/errgroup"
+)
+
+// backgroundProcessor is responsible for running background processes.
+type backgroundProcessor struct {
+	mu          sync.RWMutex
+	cancelCtxFn func()
+	startTime   time.Time
+
+	errGroup *errgroup.Group
+}
+
+// newBackgroundProcessor creates new background processor.
+func newBackgroundProcessor() *backgroundProcessor {
+	return &backgroundProcessor{}
+}
+
+// StartTime returns the start time of the background processor.
+func (b *backgroundProcessor) StartTime() time.Time {
+	b.mu.RLock()
+	defer b.mu.RUnlock()
+	return b.startTime
+}
+
+// Run starts the background processes.
+func (b *backgroundProcessor) Run(parentCtx context.Context, fns []func(ctx context.Context)) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+
+	b.startTime = time.Now()
+	ctx, cancelFn := context.WithCancel(parentCtx)
+	b.cancelCtxFn = cancelFn
+
+	errGroup, errGroupCtx := errgroup.WithContext(ctx)
+	b.errGroup = errGroup
+
+	for _, fn := range fns {
+		fn := fn
+		errGroup.Go(func() error {
+			fn(errGroupCtx)
+			return nil
+		})
+	}
+}
+
+// StopAndWait stops the background processes and waits for them to finish.
+func (b *backgroundProcessor) StopAndWait(log logrus.FieldLogger) error {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+
+	if b.cancelCtxFn != nil {
+		log.Debug("Cancelling context of the background processor...")
+		b.cancelCtxFn()
+	}
+
+	if b.errGroup == nil {
+		return nil
+	}
+
+	log.Debug("Waiting for background processor to finish...")
+	return b.errGroup.Wait()
+}
```

**File**: `internal/source/kubernetes/configuration_store.go` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package kubernetes
+
+import (
+	"fmt"
+	"sync"
+
+	"github.com/kubeshop/botkube/pkg/maputil"
+)
+
+// configurationStore stores all source configurations in a thread-safe way.
+type configurationStore struct {
+	store             map[string]SourceConfig
+	storeByKubeconfig map[string]map[string]struct{}
+
+	lock sync.RWMutex
+}
+
+// newConfigurations creates new empty configurationStore instance.
+func newConfigurations() *configurationStore {
+	return &configurationStore{
+		store:             make(map[string]SourceConfig),
+		storeByKubeconfig: make(map[string]map[string]struct{}),
+	}
+}
+
+// Store stores SourceConfig in a thread-safe way.
+func (c *configurationStore) Store(sourceName string, cfg SourceConfig) {
+	c.lock.Lock()
+	defer c.lock.Unlock()
+
+	key := c.keyForStore(sourceName, cfg.isInteractivitySupported)
+
+	c.store[key] = cfg
+
+	kubeConfigKey := string(cfg.kubeConfig)
+	if _, ok := c.storeByKubeconfig[kubeConfigKey]; !ok {
+		c.storeByKubeconfig[kubeConfigKey] = make(map[string]struct{})
+	}
+	c.storeByKubeconfig[kubeConfigKey][key] = struct{}{}
+}
+
+// Get returns SourceConfig by a key.
+func (c *configurationStore) Get(sourceKey string) (SourceConfig, bool) {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+	val, ok := c.store[sourceKey]
+	return val, ok
+}
+
+// GetSystemConfig returns system Source Config.
+// The system config is used for getting system (plugin-wide) logger and informer resync period.
+func (c *configurationStore) GetSystemConfig() (SourceConfig, bool) {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+
+	sortedKeys := maputil.SortKeys(c.store)
+	if len(sortedKeys) == 0 {
+		return SourceConfig{}, false
+	}
+
+	return c.store[sortedKeys[0]], true
+}
+
+// Len returns number of stored SourceConfigs.
+func (c *configurationStore) Len() int {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+	return len(c.store)
+}
+
+// CloneByKubeconfig returns a copy of the underlying map of source configurations grouped by kubeconfigs.
+func (c *configurationStore) CloneByKubeconfig() map[string]map[string]SourceConfig {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+
+	var out = make(map[string]map[string]SourceConfig)
+	for kubeConfig, srcIndex := range c.storeByKubeconfig {
+		if out[kubeConfig] == nil {
+			out[kubeConfig] = make(map[string]SourceConfig)
+		}
+
+		for srcKey := range srcIndex {
+			out[kubeConfig][srcKey] = c.store[srcKey]
+		}
+	}
+
+	return out
+}
+
+// keyForStore returns a key for storing configuration in the store.
+func (c *configurationStore) keyForStore(sourceName string, isInteractivitySupported bool) string {
+	return fmt.Sprintf("%s/%t", sourceName, isInteractivitySupported)
+}
```

**File**: `internal/source/kubernetes/filterengine/filterengine.go` (modified, +1/-2)
```diff
@@ -50,7 +50,6 @@ func New(log logrus.FieldLogger) *DefaultFilterEngine {
 func (f *DefaultFilterEngine) Run(ctx context.Context, event event.Event) event.Event {
 	f.log.Debug("Running registered filters")
 	filters := f.RegisteredFilters()
-	f.log.Debugf("registered filters: %+v", filters)
 
 	for _, filter := range filters {
 		if !filter.Enabled {
@@ -59,7 +58,7 @@ func (f *DefaultFilterEngine) Run(ctx context.Context, event event.Event) event.
 
 		err := filter.Run(ctx, &event)
 		if err != nil {
-			f.log.Errorf("while running filter %q: %w", filter.Name(), err)
+			f.log.Errorf("while running filter %q: %s", filter.Name(), err.Error())
 		}
 		f.log.Debugf("ran filter name: %q, event was skipped: %t", filter.Name(), event.Skip)
 	}
```

---

### Incident Patch 8: `97f6bf84` (2024-03-11)
**Commit Message**: Fix sending file messages in Cloud Slack (#1412)

**File**: `pkg/bot/slack_cloud.go` (modified, +24/-11)
```diff
@@ -417,9 +417,8 @@ func (b *CloudSlack) SendMessage(ctx context.Context, msg interactive.CoreMessag
 	errs := multierror.New()
 	for _, channelName := range b.getChannelsToNotify(sourceBindings) {
 		msgMetadata := slackMessage{
-			Channel:         channelName,
-			ThreadTimeStamp: "",
-			BlockID:         uuid.New().String(),
+			Channel: channelName,
+			BlockID: uuid.New().String(),
 		}
 		err := b.send(ctx, msgMetadata, msg)
 		if err != nil {
@@ -540,11 +539,15 @@ func (b *CloudSlack) handleMessage(ctx context.Context, event slackMessage) erro
 func (b *CloudSlack) send(ctx context.Context, event slackMessage, resp interactive.CoreMessage) error {
 	b.log.Debugf("Sending message to channel %q: %+v", event.Channel, resp)
 
+	if resp.IsEmpty() { // don't send empty messages
+		return nil
+	}
+
 	resp.ReplaceBotNamePlaceholder(b.BotName(), api.BotNameWithClusterName(b.clusterName))
 	markdown := b.renderer.MessageToMarkdown(resp)
 
 	if len(markdown) == 0 {
-		return errors.New("while reading Slack response: empty response")
+		return errors.New("got empty message while converting executor response to Markdown")
 	}
 
 	// Upload message as a file if too long
@@ -555,6 +558,11 @@ func (b *CloudSlack) send(ctx context.Context, event slackMessage, resp interact
 		if err != nil {
 			return err
 		}
+		// the main message body was sent as a file, the only think that left is the filter input (if any)
+		if len(resp.PlaintextInputs) == 0 {
+			return nil
+		}
+
 		resp = interactive.CoreMessage{
 			Message: api.Message{
 				PlaintextInputs: resp.PlaintextInputs,
@@ -608,7 +616,7 @@ func (b *CloudSlack) uploadFileToSlack(ctx context.Context, event slackMessage,
 		InitialComment:  resp.Description,
 		Content:         interactive.MessageToPlaintext(resp, interactive.NewlineFormatter),
 		Channels:        []string{event.Channel},
-		ThreadTimestamp: event.GetTimestamp(),
+		ThreadTimestamp: b.resolveMessageTimestamp(resp, event),
 	}
 
 	file, err := b.client.UploadFileContext(ctx, params)
@@ -646,18 +654,23 @@ func (b *CloudSlack) getThreadOptionIfNeeded(resp interactive.CoreMessage, event
 			}
 		}
 	}
-
-	if resp.ParentActivityID != "" {
-		return slack.MsgOptionTS(resp.Message.ParentActivityID)
-	}
-
-	if ts := event.GetTimestamp(); ts != "" {
+	if ts := b.resolveMessageTimestamp(resp, event); ts != "" {
 		return slack.MsgOptionTS(ts)
 	}
 
 	return nil
 }
 
+func (b *CloudSlack) resolveMessageTimestamp(resp interactive.CoreMessage, event slackMessage) string {
+	// If the message is coming e.g. from source, it may already belong to a given thread
+	if resp.ParentActivityID != "" {
+		return resp.Message.ParentActivityID
+	}
+
+	// otherwise, we use the event timestamp to respond in the thread to the message that triggered our response
+	return event.GetTimestamp()
+}
+
 // NotificationsEnabled returns current notification status for a given channel name.
 func (b *CloudSlack) NotificationsEnabled(channelName string) bool {
 	channel, exists := b.getChannels()[channelName]
```

---

### Incident Patch 9: `027883f1` (2024-03-07)
**Commit Message**: Fix Helm chart upgrade when `lookup` is not supported (#1408)

**File**: `helm/botkube/templates/persistent-config.yaml` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 {{- if not (include "botkube.remoteConfigEnabled" $) }}
 {{- $runtimeStateCfgMap := .Values.settings.persistentConfig.runtime.configMap.name -}}
-{{- $communications := .Values.communications }}
+{{- $communications := .Values.communications | default dict }}
 {{- if .Values.existingCommunicationsSecretName }}
   {{- $secret := lookup "v1" "Secret" .Release.Namespace .Values.existingCommunicationsSecretName | default dict  }}
   {{- $secretData := $secret.data | default dict -}}
   {{- $data := b64dec (index $secretData "comm_config.yaml" | default "") -}}
-  {{- $dataYaml := $data | fromYaml -}}
-  {{- $communications =  $dataYaml.communications }}
+  {{- $dataYaml := $data | fromYaml | default dict -}}
+  {{- $communications =  $dataYaml.communications | default dict }}
 {{- end }}
 apiVersion: v1
 kind: ConfigMap
@@ -24,7 +24,7 @@ metadata:
     botkube.io/config-watch: "true"
 data:
   {{- $prevRuntimeCfgMap := lookup "v1" "ConfigMap" .Release.Namespace $runtimeStateCfgMap | default dict }}
-  {{- $prevRuntimeFile := index ( $prevRuntimeCfgMap.data | default dict ) .Values.settings.persistentConfig.runtime.fileName | default "" | fromYaml -}}
+  {{- $prevRuntimeFile := index ( $prevRuntimeCfgMap.data | default dict ) .Values.settings.persistentConfig.runtime.fileName | default "" | fromYaml | default dict -}}
   {{- $mergedRuntimeCommunications := mustMergeOverwrite (mustDeepCopy (default (dict) $prevRuntimeFile.communications )) (mustDeepCopy $communications) }}
   {{- $mergedRuntimeAction := mustMergeOverwrite (mustDeepCopy (default (dict) $prevRuntimeFile.actions )) (mustDeepCopy .Values.actions) }}
   # This file has a special prefix to load it as the last config file during Botkube startup.
@@ -75,7 +75,7 @@ metadata:
     botkube.io/config-watch: "false" # Explicitly don't watch this ConfigMap
 data:
   {{- $prevStartupCfgMap := lookup "v1" "ConfigMap" .Release.Namespace $startupStateCfgMap | default dict }}
-  {{- $prevStartupFile := index ( $prevStartupCfgMap.data | default dict ) .Values.settings.persistentConfig.startup.fileName | default "" | fromYaml -}}
+  {{- $prevStartupFile := index ( $prevStartupCfgMap.data | default dict ) .Values.settings.persistentConfig.startup.fileName | default "" | fromYaml | default dict -}}
   {{- $mergedStartupCommunications := mustMergeOverwrite (mustDeepCopy (default (dict) $prevStartupFile.communications )) (mustDeepCopy .Values.communications) }}
   # This file has a special prefix to load it as the last config file during Botkube startup.
   {{ .Values.settings.persistentConfig.startup.fileName }}: |
```

---

### Incident Patch 10: `ced876da` (2024-02-27)
**Commit Message**: Fix overwriting custom RBAC config and Kubernetes plugin JSON schema (#1401)

- Fix overwriting custom RBAC config
- Fix Kubernetes extraButtons schema
- Remove unused properties

**File**: `helm/botkube/README.md` (modified, +60/-61)
```diff
@@ -162,67 +162,66 @@ Controller for the Botkube Slack app which helps you monitor your Kubernetes clu
 | [communications.default-group.webhook.enabled](./values.yaml#L660) | bool | `false` | If true, enables Webhook. |
 | [communications.default-group.webhook.url](./values.yaml#L662) | string | `"WEBHOOK_URL"` | The Webhook URL, e.g.: https://example.com:80 |
 | [communications.default-group.webhook.bindings.sources](./values.yaml#L665) | list | `["k8s-err-events","k8s-recommendation-events"]` | Notification sources configuration for the webhook. |
-| [communications.default-group.slack](./values.yaml#L675) | object | See the `values.yaml` file for full object. | Settings for deprecated Slack integration. **DEPRECATED:** Legacy Slack integration has been deprecated and removed from the Slack App Directory. Use `socketSlack` instead. Read more here: https://docs.botkube.io/installation/slack/   |
-| [settings.clusterName](./values.yaml#L693) | string | `"not-configured"` | Cluster name to differentiate incoming messages. |
-| [settings.healthPort](./values.yaml#L696) | int | `2114` | Health check port. |
-| [settings.upgradeNotifier](./values.yaml#L698) | bool | `true` | If true, notifies about new Botkube releases. |
-| [settings.log.level](./values.yaml#L702) | string | `"info"` | Sets one of the log levels. Allowed values: `info`, `warn`, `debug`, `error`, `fatal`, `panic`. |
-| [settings.log.disableColors](./values.yaml#L704) | bool | `false` | If true, disable ANSI colors in logging. Ignored when `json` formatter is used. |
-| [settings.log.formatter](./values.yaml#L706) | string | `"json"` | Configures log format. Allowed values: `text`, `json`. |
-| [settings.systemConfigMap](./values.yaml#L709) | object | `{"name":"botkube-system"}` | Botkube's system ConfigMap where internal data is stored. |
-| [settings.persistentConfig](./values.yaml#L714) | object | `{"runtime":{"configMap":{"annotations":{},"name":"botkube-runtime-config"},"fileName":"_runtime_state.yaml"},"startup":{"configMap":{"annotations":{},"name":"botkube-startup-config"},"fileName":"_startup_state.yaml"}}` | Persistent config contains ConfigMap where persisted configuration is stored. The persistent configuration is evaluated from both chart upgrade and Botkube commands used in runtime. |
-| [ssl.enabled](./values.yaml#L729) | bool | `false` | If true, specify cert path in `config.ssl.cert` property or K8s Secret in `config.ssl.existingSecretName`. |
-| [ssl.existingSecretName](./values.yaml#L735) | string | `""` | Using existing SSL Secret. It MUST be in `botkube` Namespace.  |
-| [ssl.cert](./values.yaml#L738) | string | `""` | SSL Certificate file e.g certs/my-cert.crt. |
-| [service](./values.yaml#L741) | object | `{"name":"metrics","port":2112,"targetPort":2112}` | Configures Service settings for ServiceMonitor CR. |
-| [serviceMonitor](./values.yaml#L748) | object | `{"enabled":false,"interval":"10s","labels":{},"path":"/metrics","port":"metrics"}` | Configures ServiceMonitor settings. [Ref doc](https://github.com/coreos/prometheus-operator/blob/master/Documentation/api.md#servicemonitor). |
-| [deployment.annotations](./values.yaml#L758) | object | `{}` | Extra annotations to pass to the Botkube Deployment. |
-| [deployment.livenessProbe](./values.yaml#L760) | object | `{"failureThreshold":35,"initialDelaySeconds":1,"periodSeconds":2,"successThreshold":1,"timeoutSeconds":1}` | Liveness probe. |
-| [deployment.livenessProbe.initialDelaySeconds](./values.yaml#L762) | int | `1` | The liveness probe initial delay seconds. |
-| [deployment.livenessProbe.periodSeconds](./values.yaml#L764) | int | `2` | The liveness probe period seconds. |
-| [deployment.livenessProbe.timeoutSeconds](./values.yaml#L766) | int | `1` | The liveness probe timeout seconds. |
-| [deployment.livenessProbe.failureThreshold](./values.yaml#L768) | int | `35` | The liveness probe failure threshold. |
-| [deployment.livenessProbe.successThreshold](./values.yaml#L770) | int | `1` | T
```

**File**: `helm/botkube/values.yaml` (modified, +0/-21)
```diff
@@ -666,27 +666,6 @@ communications:
           - k8s-err-events
           - k8s-recommendation-events
 
-    # -- Settings for deprecated Slack integration.
-    # **DEPRECATED:** Legacy Slack integration has been deprecated and removed from the Slack App Directory.
-    # Use `socketSlack` instead. Read more here: https://docs.botkube.io/installation/slack/
-    #
-    # @default -- See the `values.yaml` file for full object.
-    ## This object will be removed as a part of https://github.com/kubeshop/botkube/issues/865.
-    slack:
-      enabled: false
-      channels:
-        'default':
-          name: 'SLACK_CHANNEL'
-          notification:
-            disabled: false
-          bindings:
-            executors:
-              - k8s-default-tools
-            sources:
-              - k8s-err-events
-              - k8s-recommendation-events
-      token: ''
-
 ## Global Botkube configuration.
 settings:
   # -- Cluster name to differentiate incoming messages.
```

**File**: `internal/analytics/segment_reporter.go` (modified, +19/-7)
```diff
@@ -382,14 +382,26 @@ func (r *SegmentReporter) getAnonymizedRBAC(rbac *config.PolicyRule) *config.Pol
 		return nil
 	}
 
-	rbac.Group.Prefix = r.anonymizedValue(rbac.Group.Prefix)
-	for key, name := range rbac.Group.Static.Values {
-		rbac.Group.Static.Values[key] = r.anonymizedValue(name)
+	var anonymizedGroupValues []string
+	for _, name := range rbac.Group.Static.Values {
+		anonymizedGroupValues = append(anonymizedGroupValues, r.anonymizedValue(name))
+	}
+	return &config.PolicyRule{
+		User: config.UserPolicySubject{
+			Type: rbac.User.Type,
+			Static: config.UserStaticSubject{
+				Value: r.anonymizedValue(rbac.User.Static.Value),
+			},
+			Prefix: r.anonymizedValue(rbac.User.Prefix),
+		},
+		Group: config.GroupPolicySubject{
+			Type: rbac.Group.Type,
+			Static: config.GroupStaticSubject{
+				Values: anonymizedGroupValues,
+			},
+			Prefix: r.anonymizedValue(rbac.Group.Prefix),
+		},
 	}
-
-	rbac.User.Prefix = r.anonymizedValue(rbac.User.Prefix)
-	rbac.User.Static.Value = r.anonymizedValue(rbac.User.Static.Value)
-	return rbac
 }
 
 func (r *SegmentReporter) anonymizedValue(value string) string {
```

**File**: `internal/analytics/segment_reporter_test.go` (modified, +34/-7)
```diff
@@ -153,11 +153,7 @@ func TestSegmentReporter_ReportBotEnabled(t *testing.T) {
 
 func TestSegmentReporter_ReportPluginsEnabled(t *testing.T) {
 	// given
-	identity := fixIdentity()
-	segmentReporter, segmentCli := fakeSegmentReporterWithIdentity(identity)
-
-	// when
-	err := segmentReporter.ReportPluginsEnabled(map[string]config.Executors{
+	executors := map[string]config.Executors{
 		"botkube/helm_11yy1": {
 			DisplayName: "helm",
 			Plugins: map[string]config.Plugin{
@@ -227,7 +223,8 @@ func TestSegmentReporter_ReportPluginsEnabled(t *testing.T) {
 				},
 			},
 		},
-	}, map[string]config.Sources{
+	}
+	sources := map[string]config.Sources{
 		"botkube/kubernetes_22yy2": {
 			DisplayName: "k8s",
 			Plugins: map[string]config.Plugin{
@@ -294,11 +291,27 @@ func TestSegmentReporter_ReportPluginsEnabled(t *testing.T) {
 				},
 			},
 		},
-	})
+	}
+
+	executors2, err := deepClone[map[string]config.Executors](executors)
+	require.NoError(t, err)
+
+	sources2, err := deepClone[map[string]config.Sources](sources)
+	require.NoError(t, err)
+
+	identity := fixIdentity()
+	segmentReporter, segmentCli := fakeSegmentReporterWithIdentity(identity)
+
+	// when
+	err = segmentReporter.ReportPluginsEnabled(executors, sources)
 	require.NoError(t, err)
 
 	// then
 	compareMessagesAgainstGoldenFile(t, segmentCli.messages)
+
+	// ensure the report doesn't modify the original maps
+	assert.Equal(t, executors2, executors)
+	assert.Equal(t, sources2, sources)
 }
 
 func TestSegmentReporter_ReportSinkEnabled(t *testing.T) {
@@ -458,3 +471,17 @@ func fixIdentity() *analytics.Identity {
 		ControlPlaneNodeCount: 0,
 	}
 }
+
+func deepClone[T any](in any) (any, error) {
+	origJSON, err := json.Marshal(in)
+	if err != nil {
+		return nil, err
+	}
+
+	var out T
+	if err = json.Unmarshal(origJSON, &out); err != nil {
+		return nil, err
+	}
+
+	return out, nil
+}
```

**File**: `internal/analytics/testdata/TestSegmentReporter_ReportPluginsEnabled.json` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
 					"Group": {
 						"Type": "ChannelName",
 						"Static": {
-							"Values": []
+							"Values": null
 						},
 						"Prefix": "***"
 					}
```

#### Recent Merged Pull Requests:
- **PR #1507** (closed): Implement Prometheus metrics for Botkube (@vijit-vishnoi)
- **PR #1499** (closed): security testing, do not merge (@flo405)
- **PR #1498** (closed): security testing, do not merge (@flo405)
- **PR #1496** (closed): chore: Remove CNAME (@jackylamhk)
- **PR #1484** (2024-11-15): Remove cloud dev e2e testing (@mszostok)
- **PR #1483** (2024-11-15): Remove latest plugin upload to GCS (@pkosiec)
- **PR #1481** (2024-11-11): Fix panic on missing root event type for k8s source (@mszostok)
- **PR #1480** (2024-11-11): Update Socket Slack app upload API (@mszostok)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
