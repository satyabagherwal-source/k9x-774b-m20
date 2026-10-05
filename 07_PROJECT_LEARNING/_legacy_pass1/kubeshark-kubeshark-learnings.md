# Forensic Learning Record (Deep Inspection): kubeshark/kubeshark

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubeshark-kubeshark-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubeshark/kubeshark](https://github.com/kubeshark/kubeshark))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:29:25.586Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeshark/kubeshark`
- **Description**: eBPF-powered network observability for Kubernetes. Indexes L4/L7 traffic with full K8s context, decrypts TLS without keys. Queryable by AI agents via MCP and humans via dashboard.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12092 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/clean.go`
```
package cmd

import (
	"fmt"

	"github.com/creasty/defaults"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/kubeshark/kubeshark/config"
	"github.com/kubeshark/kubeshark/config/configStructs"
	"github.com/kubeshark/kubeshark/kubernetes/helm"
	"github.com/kubeshark/kubeshark/misc"
)

var cleanCmd = &cobra.Command{
	Use:   "clean",
	Short: fmt.Sprintf("Removes all %s resources", misc.Software),
	RunE: func(cmd *cobra.Command, args []string) error {
		resp, err := helm.NewHelm(
			config.Config.Tap.Release.Repo,
			config.Config.Tap.Release.Name,
			config.Config.Tap.Release.Namespace,
		).Uninstall()
		if err != nil {
			log.Error().Err(err).Send()
		} else {
			log.Info().Msgf("Uninstalled the Helm release: %s", resp.Release.Name)
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(cleanCmd)

	defaultTapConfig := configStructs.TapConfig{}
	if err := defaults.Set(&defaultTapConfig); err != nil {
		log.Debug().Err(err).Send()
	}

	cleanCmd.Flags().StringP(configStructs.ReleaseNamespaceLabel, "s", defaultTapConfig.Release.Namespace, "Release namespace of Kubeshark")
}

```

### Core Architecture Module: `cmd/common.go`
```
package cmd

import (
	"context"
	"errors"
	"fmt"
	"path"
	"regexp"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/kubeshark/kubeshark/config"
	"github.com/kubeshark/kubeshark/errormessage"
	"github.com/kubeshark/kubeshark/internal/connect"
	"github.com/kubeshark/kubeshark/kubernetes"
	"github.com/kubeshark/kubeshark/misc"
	"github.com/kubeshark/kubeshark/misc/fsUtils"
)

func startProxyReportErrorIfAny(kubernetesProvider *kubernetes.Provider, ctx context.Context, serviceName string, podName string, proxyPortLabel string, srcPort uint16, dstPort uint16, healthCheck string) {
	httpServer, err := kubernetes.StartProxy(kubernetesProvider, config.Config.Tap.Proxy.Host, srcPort, config.Config.Tap.Release.Namespace, serviceName)
	if err != nil {
		log.Error().
			Err(errormessage.FormatError(err)).
			Msg(fmt.Sprintf("Error occurred while running K8s proxy. Try setting different port using --%s", proxyPortLabel))
		return
	}

	connector := connect.NewConnector(kubernetes.GetProxyOnPort(srcPort), connect.DefaultRetries, connect.DefaultTimeout)
	if err := connector.TestConnection(healthCheck); err != nil {
		log.Warn().
			Str("service", serviceName).
			Msg("Couldn't connect using proxy, stopping proxy and trying to create port-forward...")
		if err := httpServer.Shutdown(ctx); err != nil {
			log.Error().
				Err(errormessage.FormatError(err)).
				Msg("Error occurred while stopping proxy.")
		}

		podRegex, _ := regexp.Compile(podName)
		if _, err := kubernetes.NewPortForward(kubernetesProvider, config.Config.Tap.Release.Namespace, podRegex, srcPort, dstPort, ctx); err != nil {
			log.Error().
				Str("pod-regex", podRegex.String()).
				Err(errormessage.FormatError(err)).
				Msg(fmt.Sprintf("Error occurred while running port forward. Try setting different port using --%s", proxyPortLabel))
			return
		}

		connector = connect.NewConnector(kubernetes.GetProxyOnPort(srcPort), connect.DefaultRetries, connect.DefaultTimeout)
		if err := connector.TestConnection(healthCheck); err != nil {
			log.Error().
				Str("service", serviceName).
				Err(errormessage.FormatError(err)).
				Msg("Couldn't connect to service.")
			return
		}
	}
}

func getKubernetesProviderForCli(silent bool, dontCheckVersion bool) (*kubernetes.Provider, error) {
	kubeConfigPath := config.Config.KubeConfigPath()
	kubernetesProvider, err := kubernetes.NewProvider(kubeConfigPath, config.Config.Kube.Context)
	if err != nil {
		handleKubernetesProviderError(err)
		return nil, err
	}

	if !silent {
		log.Info().Str("path", kubeConfigPath).Msg("Using kubeconfig:")
	}

	if err := kubernetesProvider.ValidateNotProxy(); err != nil {
		handleKubernetesProviderError(err)
		return nil, err
	}

	if !dontCheckVersion {
		kubernetesVersion, err := kubernetesProvider.GetKubernetesVersion()
		if err != nil {
			handleKubernetesProviderError(err)
			return nil, err
		}

		if err := kubernetes.ValidateKubernetesVersion(kubernetesVersion); err != nil {
			handleKubernetesProviderError(err)
			return nil, err
		}
	}

	return kubernetesProvider, nil
}

func handleKubernetesProviderError(err error) {
	var clusterBehindProxyErr *kubernetes.ClusterBehindProxyError
	if ok := errors.As(err, &clusterBehindProxyErr); ok {
		log.Error().Msg(fmt.Sprintf("Cannot establish http-proxy connection to the Kubernetes cluster. If you’re using Lens or similar tool, please run '%s' with regular kubectl config using --%v %v=$HOME/.kube/config flag", misc.Program, config.SetCommandName, config.KubeConfigPathConfigName))
	} else {
		log.Error().Err(err).Send()
	}
}

func finishSelfExecution(kubernetesProvider *kubernetes.Provider) {
	removalCtx, cancel := context.WithTimeout(context.Background(), cleanupTimeout)
	defer cancel()
	dumpLogsIfNeeded(removalCtx, kubernetesProvider)
}

func dumpLogsIfNeeded(ctx context.Context, kubernetesProvider *kubernetes.Provider) {
	if !config.Config.DumpLogs {
		return
	}
	dotDir := misc.GetDotFolderPath()
	filePath := path.Join(dotDir, fmt.Sprintf("%s_logs_%s.zip", misc.Program, time.Now().Format("2006_01_02__15_04_05")))
	if err := fsUtils.DumpLogs(ctx, kubernetesProvider, filePath, config.Config.Logs.Grep); err != nil {
		log.Error().Err(err).Msg("Failed to dump logs.")
	}
}

```

### Core Architecture Module: `cmd/config.go`
```
package cmd

import (
	"fmt"

	"github.com/creasty/defaults"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/kubeshark/kubeshark/config"
	"github.com/kubeshark/kubeshark/config/configStructs"
	"github.com/kubeshark/kubeshark/misc"
	"github.com/kubeshark/kubeshark/utils"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: fmt.Sprintf("Generate %s config with default values", misc.Software),
	RunE: func(cmd *cobra.Command, args []string) error {
		if config.Config.Config.Regenerate {
			defaultConfig := config.CreateDefaultConfig()
			if err := defaults.Set(&defaultConfig); err != nil {
				log.Error().Err(err).Send()
				return nil
			}
			if err := config.WriteConfig(&defaultConfig); err != nil {
				log.Error().Err(err).Msg("Failed generating config with defaults.")
				return nil
			}

			log.Info().Str("config-path", config.ConfigFilePath).Msg("Template file written to config path.")
		} else {
			template, err := utils.PrettyYaml(config.Config)
			if err != nil {
				log.Error().Err(err).Msg("Failed converting config with defaults to YAML.")
				return nil
			}

			log.Debug().Str("template", template).Msg("Printing template config...")
			fmt.Printf("%v", template)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(configCmd)

	defaultConfig := config.CreateDefaultConfig()
	if err := defaults.Set(&defaultConfig); err != nil {
		log.Debug().Err(err).Send()
	}

	configCmd.Flags().BoolP(configStructs.RegenerateConfigName, "r", defaultConfig.Config.Regenerate, fmt.Sprintf("Regenerate the config file with default values to path %s", config.GetConfigFilePath(nil)))
}

```

### Core Architecture Module: `cmd/console.go`
```
package cmd

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/creasty/defaults"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/kubeshark/kubeshark/config"
	"github.com/kubeshark/kubeshark/config/configStructs"
	"github.com/kubeshark/kubeshark/kubernetes"
	"github.com/kubeshark/kubeshark/utils"
)

var consoleCmd = &cobra.Command{
	Use:   "console",
	Short: "Stream the scripting console logs into shell (temporarily non-functional — under refactoring after hub API changes)",
	Long: `Stream the scripting console logs into shell.

NOTE: This command is currently non-functional and under refactoring. The hub
moved scripting-console log streaming off the /scripts/logs WebSocket onto a
Connect-RPC streaming service, and this client has not yet been updated to use
it, so no logs will stream until the migration lands.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		log.Warn().Msg(fmt.Sprintf(utils.Yellow, "The 'console' command is temporarily non-functional and under refactoring: the hub moved scripting-console log streaming off the /scripts/logs WebSocket onto a Connect-RPC service, and this client has not yet been updated. No logs will stream, so the command exits without doing anything."))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(consoleCmd)

	defaultTapConfig := configStructs.TapConfig{}
	if err := defaults.Set(&defaultTapConfig); err != nil {
		log.Debug().Err(err).Send()
	}

	consoleCmd.Flags().Uint16(configStructs.ProxyFrontPortLabel, defaultTapConfig.Proxy.Front.Port, "Provide a custom port for the Kubeshark")
	consoleCmd.Flags().String(configStructs.ProxyHostLabel, defaultTapConfig.Proxy.Host, "Provide a custom host for the Kubeshark")
	consoleCmd.Flags().StringP(configStructs.ReleaseNamespaceLabel, "s", defaultTapConfig.Release.Namespace, "Release namespace of Kubeshark")
}

//nolint:unused // retained for the in-progress console refactoring; re-wired once the Connect-RPC client lands
func runConsoleWithoutProxy() {
	log.Info().Msg("Starting scripting console ...")
	time.Sleep(5 * time.Second)

	// Best-effort: mint a scoped ServiceAccount token to authenticate to a
	// gated Hub as kubeshark-cli; fall back to License-Key when not possible.
	saToken := ""
	if provider, err := getKubernetesProviderForCli(true, true); err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if tok, terr := provider.MintHubToken(ctx, config.Config.Tap.Release.Namespace); terr == nil {
			saToken = tok
		}
		cancel()
	}

	hubUrl := kubernetes.GetHubUrl()
	for {

		// Attempt to connect to the Hub every second
		response, err := http.Get(fmt.Sprintf("%s/echo", hubUrl))
		if err != nil || response.StatusCode != 200 {
			log.Info().Msg(fmt.Sprintf(utils.Yellow, "Couldn't connect to Hub."))
			time.Sleep(5 * time.Second)
			continue
		}

		interrupt := make(chan os.Signal, 1)
		signal.Notify(interrupt, os.Interrupt)

		log.Info().Str("host", config.Config.Tap.Proxy.Host).Str("url", hubUrl).Msg("Connecting to:")
		u := url.URL{
			Scheme: "ws",
			Host:   fmt.Sprintf("%s:%d", config.Config.Tap.Proxy.Host, config.Config.Tap.Proxy.Front.Port),
			Path:   "/api/scripts/logs",
		}
		headers := http.Header{}
		headers.Set(utils.X_KUBESHARK_CAPTURE_HEADER_KEY, utils.X_KUBESHARK_CAPTURE_HEADER_IGNORE_VALUE)
		if saToken != "" {
			headers.Set(utils.CLI_AUTH_HEADER, saToken)
		} else {
			headers.Set(utils.LICENSE_KEY_HEADER, config.Config.License)
		}

		c, _, err := websocket.DefaultDialer.Dial(u.String(), headers)
		if err != nil {
			log.Error().Err(err).Msg("Websocket dial error, retrying in 5 seconds...")
			time.Sleep(5 * time.Second) // Delay before retrying
			continue
		}
		defer c.Close()

		done := make(chan struct{})

		go func() {
			defer close(done)
			for {
				_, message, err := c.ReadMessage()
				if err != nil {
					log.Error().Err(err).Msg("Error reading websocket message, reconnecting...")
					break // Break to reconnect
				}

				msg := string(message)
				if strings.Contains(msg, ":ERROR]") {
					msg = fmt.Sprintf(utils.Red, msg)
					fmt.Fprintln(os.Stderr, msg)
				} else {
					fmt.Fprintln(os.Stdout, msg)
				}
			}
		}()

		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		select {
		case <-done:
			log.Warn().Msg(fmt.Sprintf(utils.Yellow, "Connection closed, reconnecting..."))
			time.Sleep(5 * time.Second) // Delay before reconnecting
			continue                    // Reconnect after error
		case <-interrupt:
			err := c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Error().Err(err).Send()
				continue
			}

			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return
		}
	}
}

//nolint:unused // retained for the in-progress console refactoring; re-wired once the Connect-RPC client lands
func runConsole() {
	log.Warn().Msg(fmt.Sprintf(utils.Yellow, "The 'console' command is temporarily non-functional and under refactoring: the hub moved scripting-console log streaming off the /scripts/logs WebSocket onto a Connect-RPC service, and this client has not yet been updated. No logs will stream."))

	go runConsoleWithoutProxy()

	// Create interrupt channel and setup signal handling once
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	done := make(chan struct{})

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-interrupt:
			// Handle interrupt and exit gracefully
			log.Warn().Msg(fmt.Sprintf(utils.Yellow, "Received interrupt, exiting..."))
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return

		case <-ticker.C:
			// Attempt to connect to the Hub every second
			hubUrl := kubernetes.GetHubUrl()
			response, err := http.Get(fmt.Sprintf("%s/echo", hubUrl))
			if err != nil || response.StatusCode != 200 {
				log.Info().Msg(fmt.Sprintf(utils.Yellow, "Couldn't connect to Hub. Establishing proxy..."))
				runProxy(false, true)
			}
		}
	}
}

```

### Core Architecture Module: `cmd/createNoFollow_unix.go`
```
//go:build !windows

package cmd

import (
	"os"
	"syscall"
)

// createNoFollow creates or truncates name for writing and fails if the final
// path component is a symlink. Used for MCP download destinations so a symlink
// cannot redirect the write outside the confined download directory.
func createNoFollow(name string) (*os.File, error) {
	return os.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, 0o644)
}

```

### Core Architecture Module: `cmd/createNoFollow_windows.go`
```
package cmd

import "os"

// createNoFollow mirrors the Unix helper. Windows has no O_NOFOLLOW; creating a
// symlink there requires either administrator rights or developer mode, so the
// symlink-planting scenario the flag guards against does not apply in the same
// way. secureDownloadDest still rejects destinations that resolve through a
// symlink outside the download directory.
func createNoFollow(name string) (*os.File, error) {
	return os.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
}

```

### Core Architecture Module: `cmd/license.go`
```
package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/kubeshark/kubeshark/config"
)

var licenseCmd = &cobra.Command{
	Use:   "license",
	Short: "Print the license loaded string",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println(config.Config.License)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(licenseCmd)
}

```

### Core Architecture Module: `cmd/logs.go`
```
package cmd

import (
	"context"
	"fmt"

	"github.com/creasty/defaults"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/kubeshark/kubeshark/config"
	"github.com/kubeshark/kubeshark/config/configStructs"
	"github.com/kubeshark/kubeshark/errormessage"
	"github.com/kubeshark/kubeshark/misc"
	"github.com/kubeshark/kubeshark/misc/fsUtils"
)

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Create a ZIP file with logs for GitHub issues or troubleshooting",
	RunE: func(cmd *cobra.Command, args []string) error {
		kubernetesProvider, err := getKubernetesProviderForCli(false, false)
		if err != nil {
			return nil
		}
		ctx := context.Background()

		if validationErr := config.Config.Logs.Validate(); validationErr != nil {
			return errormessage.FormatError(validationErr)
		}

		log.Debug().Str("logs-path", config.Config.Logs.FilePath()).Msg("Using this logs path...")

		if dumpLogsErr := fsUtils.DumpLogs(ctx, kubernetesProvider, config.Config.Logs.FilePath(), config.Config.Logs.Grep); dumpLogsErr != nil {
			log.Error().Err(dumpLogsErr).Msg("Failed to dump logs.")
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(logsCmd)

	defaultLogsConfig := configStructs.LogsConfig{}
	if err := defaults.Set(&defaultLogsConfig); err != nil {
		log.Debug().Err(err).Send()
	}

	logsCmd.Flags().StringP(configStructs.FileLogsName, "f", defaultLogsConfig.FileStr, fmt.Sprintf("Path for zip file (default current <pwd>\\%s_logs.zip)", misc.Program))
	logsCmd.Flags().StringP(configStructs.GrepLogsName, "g", defaultLogsConfig.Grep, "Regexp to do grepping on the logs")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1959** (2026-08-20): **Kubeshark shows an empty dashboard when started without a license**
  *Symptoms*: ### Description  When Kubeshark is started **without a license**, the dashboard never populates. The API Stream stays stuck on the "Preparing" spinner and shows **0 displayed items**, even though traffic is being captured across the targeted pods. With a valid license the same environment is expected to display up to ~3,000–6,000 entries.  In short: **no license → empty dashboard**. The unlicensed/free tier should still stream a bounded number of entries (the documented free-tier cap), not zero.  **Regression:** This is a regression. It does **not** reproduce on **v53.3.0** (unlicensed dashboard populates normally) and **does** reproduce on **v53.4.0**. The breaking change is somewhere in the v53.3.0 → v53.4.0 range.  ### Steps to Reproduce  1. Deploy Kubeshark **without applying a license** (free tier). 2. Confirm targeting is active (e.g. "Targeting 79 pods in 6 namespaces across 3 nodes"). 3. Open the dashboard → **API STREAM** tab with the stream **Live**. 4. Observe: the stream shows "Preparing" indefinitely and **Displayed items: 0**. License indicator reads **NOT DETECTED**.  ### Expected Behavior  Without a license, Kubeshark should still start and stream traffic up to the free-tier entry cap (~3,000–6,000 entries). The dashboard should populate with entries rather than remaining empty.  ### Workaround / Remedy  Until this is fixed, either of the following restores a populated dashboard:  1. **Use a license** — sign up / log in so the session gains the required `snaps

- **Issue #1900** (2026-04-10): **EFS persistent storage: workers crash with PebbleDB lock conflict**
  *Symptoms*: ## Description  When using AWS EFS as persistent storage (`persistentStorage: true` + `persistentStorageStatic: true`), all worker DaemonSet pods share the same PVC and write PebbleDB to the same path `/app/data/captureDB`, causing file lock conflicts.  ## Error  ``` {"level":"fatal","error":"failed to create pebble db: resource temporarily unavailable","backend":"pebble","message":"Failed to initialize common storage for extensions"} ```  All workers except one enter CrashLoopBackOff with this error.  ## Root Cause  The init container `cleanup-data-dir` correctly creates per-node directories (`/app/data/$NODE_NAME`) using `spec.nodeName`, but the `sniffer` and `tracer` containers mount `/app/data` directly without `subPathExpr`. This means all workers on all nodes write to the same `captureDB` path on the shared EFS volume.  With `emptyDir` this is not an issue because each pod gets its own isolated volume. But with a shared PVC (EFS ReadWriteMany), all pods see the same filesystem.  ## Proposed Fix  Add `NODE_NAME` env var (from `spec.nodeName`) and `subPathExpr: $(NODE_NAME)` to the `sniffer` and `tracer` volume mounts in `helm-chart/templates/09-worker-daemon-set.yaml`, only when `persistentStorage` is enabled.  ## Environment  - Kubeshark chart version: 53.1.0 - Kubernetes: EKS 1.34 - Storage: AWS EFS with aws-efs-csi-driver v2.1.15 - Region: eu-central-1 - Static PV with `volumeHandle` pointing to EFS filesystem ID
  **Post-Mortem & Fix Analysis**:
  > > 🤖 *This analysis was generated by [Claude Code](https://claude.ai/code) (RCA Agent)*  **Likely Affected Repos**: kubeshark  **Summary**: The worker DaemonSet's init container (`cleanup-data-dir`) creates per-node subdirectories under `/app/data/$NODE_NAME`, but the `sniffer` and `tracer` containers mount `/app/data` directly without `subPathExpr`, so all pods on a shared EFS volume write PebbleDB to the same path and conflict on file locks.  **Detailed Findings**: - The init container (line 50–69 of `09-worker-daemon-set.yaml`) correctly sets `NODE_NAME` from `spec.nodeName` and runs `mkdir -p /app/data/$NODE_NAME`, creating per-node directories on the shared EFS filesystem. - The `sniffer` container volume mount (lines 220–229) mounts volume `data` at `/app/data` with no `subPath` or `subPathExpr`, meaning all nodes write to the same root path. - The `tracer` container volume mount (lines 321–330) has the identical issue — mounts `/app/data` directly without per-node isolation. - T

- **Issue #1882** (2026-03-24): **Decrypted TLS traffic missing from snapshots during delayed dissection**
  *Symptoms*: ### Description  TLS traffic that is successfully decrypted and displayed in real-time is not present when viewing a snapshot. During delayed dissection of a snapshot, the decrypted TLS content is missing — only the non-TLS traffic appears. This means snapshots do not accurately represent what was observed during live capture.  ### Why Is This Needed?  Snapshots are a core feature for offline analysis, sharing, and incident review. If decrypted TLS traffic is visible in real-time but absent from snapshots, users lose visibility into a significant portion of their traffic when reviewing captured data later. This undermines the value of snapshots for post-incident analysis and collaboration.  ### Additional Context  - In real-time mode, TLS traffic is decrypted via eBPF hooks and displayed as dissected API calls. - During snapshot creation/delayed dissection, the decrypted plaintext is apparently not persisted or re-dissected, resulting in the TLS traffic being absent from the snapshot. - The fix likely involves ensuring that the decrypted plaintext (captured via eBPF at the TLS layer) is included in the PCAP data or stored alongside it, so that delayed dissection can access and process it. - This is related to the PCAP capture pipeline — if raw PCAP only contains the encrypted bytes, delayed dissection has no way to recover the plaintext without the original eBPF hooks being active.

- **Issue #1741** (2025-04-10): **443 TCP traffic is filtered out automatically, when using eBPF implementation (with not supported TLS libraries)**
  *Symptoms*: On some occasions, especially with TLS libraries not supported by Kubeshark are used (e.g. with Java apps), 443 TCP traffic will be filtered out and will not show in the dashboard. This happens when the EBPF implementation is used. The issue does not exists with the AF_PACKET implementation. Same traffic will show when using the AF_PACKET implementation.  As an interim fix: To use AF_PACKET, use: `--set tap.packetCApture=af_packet`
  **Post-Mortem & Fix Analysis**:
  > fixed with: https://github.com/kubeshark/kubeshark/releases/tag/v52.6.0

- **Issue #1720** (2025-03-07): **Worker random and occasional processing halt**
  *Symptoms*: It was reported by several users that on rare and random occasions, and after some time, the Worker would stop processing traffic (go into a halt state), and require restart to resume operations. 
  **Post-Mortem & Fix Analysis**:
  > Fixed in: https://github.com/kubeshark/kubeshark/releases/tag/v52.5.0 and https://github.com/kubeshark/kubeshark/releases/tag/v52.4.0

- **Issue #1602** (2024-09-10): **fix: respect `tap.docker.imagePullSecrets`**
  *Symptoms*: fixes #1601 
  **Post-Mortem & Fix Analysis**:
  > @zyue110026 thank you so much! Seems correct but we need to add it to three more places as well:  https://github.com/kubeshark/kubeshark/blob/f155e4f1b7f2c632341ed6aeba23389e8ec9a81c/helm-chart/templates/09-worker-daemon-set.yaml#L32  https://github.com/kubeshark/kubeshark/blob/f155e4f1b7f2c632341ed6aeba23389e8ec9a81c/helm-chart/templates/09-worker-daemon-set.yaml#L78  https://github.com/kubeshark/kubeshark/blob/f155e4f1b7f2c632341ed6aeba23389e8ec9a81c/helm-chart/templates/09-worker-daemon-set.yaml#L181  Would you do these three as well? or should I do them after merging this PR?
  > @mertyildiran I added the fixes in these three places, please check.
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/kubeshark/kubeshark/pull/1602?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report All modified and coverable lines are covered by tests :white_check_mark: > Project coverage is 23.14%. Comparing base [(`d3789f2`)](https://app.codecov.io/gh/kubeshark/kubeshark/commit/d3789f2bc0db9b86a56760aa0f6402feedb05470?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) to head [(`b871d18`)](https://app.codecov.io/gh/kubeshark/kubeshark/commit/b871d18d74caaf94ccee69696e754cf9cfdbdec7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comment

- **Issue #1534** (2024-04-19): **Upgrade fails**
  *Symptoms*: ```Error: UPGRADE FAILED: cannot patch "kubeshark-worker-daemon-set" with kind DaemonSet: DaemonSet.apps "kubeshark-worker-daemon-set" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{"<http://app.kubernetes.io/instance|app.kubernetes.io/instance>":"kubeshark", "<http://app.kubernetes.io/managed-by|app.kubernetes.io/managed-by>":"Helm", "<http://app.kubernetes.io/name|app.kubernetes.io/name>":"kubeshark", "<http://app.kubernetes.io/version|app.kubernetes.io/version>":"52.1.77", "<http://app.kubeshark.co/app|app.kubeshark.co/app>":"worker", "<http://helm.sh/chart|helm.sh/chart>":"kubeshark-52.1.77"}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable &amp;&amp; cannot patch "kubeshark-hub" with kind Deployment: Deployment.apps "kubeshark-hub" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{"<http://app.kubernetes.io/instance|app.kubernetes.io/instance>":"kubeshark", "<http://app.kubernetes.io/managed-by|app.kubernetes.io/managed-by>":"Helm", "<http://app.kubernetes.io/name|app.kubernetes.io/name>":"kubeshark", "<http://app.kubernetes.io/version|app.kubernetes.io/version>":"52.1.77", "<http://app.kubeshark.co/app|app.kubeshark.co/app>":"hub", "<http://helm.sh/chart|helm.sh/chart>":"kubeshark-52.1.77"}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable &amp;&amp; cannot patch "kubeshark-front" with kind Deployment: Deployment.apps "kubeshark-front" is inv
  **Post-Mortem & Fix Analysis**:
  > Fixed with: https://github.com/kubeshark/kubeshark/commit/6b6915c7ee43ababc9180bd1945ac3b53fa3c3fd

- **Issue #1466** (2023-12-19): **PF-RING doesn't load when Tracer is running**
  *Symptoms*: When both `tracer` and `sniffer` run as part of the Worker DaemonSet, PF-RING doesn't load. PF-RING does load when running without the `tracer` (e.g. by using `--set tap.tls=false`)
  **Post-Mortem & Fix Analysis**:
  > Fixed with v52.0.x

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

### Incident Patch 1: `35e484c9` (2026-09-24)
**Commit Message**: fix: compare semantic versions numerically (#1925)

Co-authored-by: Volodymyr Stoiko <me@volodymyrstoiko.com>

**File**: `kubernetes/provider_test.go` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+package kubernetes
+
+import (
+	"testing"
+
+	"github.com/kubeshark/kubeshark/semver"
+)
+
+func TestValidateKubernetesVersionRejectsNumericVersionBelowMinimum(t *testing.T) {
+	serverVersion := semver.SemVersion("v1.9.0")
+
+	if err := ValidateKubernetesVersion(&serverVersion); err == nil {
+		t.Fatalf("expected Kubernetes version %s to be rejected", serverVersion)
+	}
+}
+
+func TestValidateKubernetesVersionAcceptsMinimumVersion(t *testing.T) {
+	serverVersion := semver.SemVersion(MinKubernetesServerVersion)
+
+	if err := ValidateKubernetesVersion(&serverVersion); err != nil {
+		t.Fatalf("expected Kubernetes version %s to be accepted: %v", serverVersion, err)
+	}
+}
```

**File**: `semver/semver.go` (modified, +19/-5)
```diff
@@ -2,6 +2,7 @@ package semver
 
 import (
 	"regexp"
+	"strconv"
 )
 
 type SemVersion string
@@ -36,21 +37,34 @@ func (v SemVersion) Patch() string {
 }
 
 func (v SemVersion) GreaterThan(v2 SemVersion) bool {
-	if v.Major() > v2.Major() {
+	vMajor, vMinor, vPatch := v.breakdownInt()
+	v2Major, v2Minor, v2Patch := v2.breakdownInt()
+
+	if vMajor > v2Major {
 		return true
-	} else if v.Major() < v2.Major() {
+	} else if vMajor < v2Major {
 		return false
 	}
 
-	if v.Minor() > v2.Minor() {
+	if vMinor > v2Minor {
 		return true
-	} else if v.Minor() < v2.Minor() {
+	} else if vMinor < v2Minor {
 		return false
 	}
 
-	if v.Patch() > v2.Patch() {
+	if vPatch > v2Patch {
 		return true
 	}
 
 	return false
 }
+
+func (v SemVersion) breakdownInt() (int, int, int) {
+	major, minor, patch := v.Breakdown()
+
+	majorInt, _ := strconv.Atoi(major)
+	minorInt, _ := strconv.Atoi(minor)
+	patchInt, _ := strconv.Atoi(patch)
+
+	return majorInt, minorInt, patchInt
+}
```

**File**: `semver/semver_test.go` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+package semver
+
+import "testing"
+
+func TestGreaterThanComparesNumericComponents(t *testing.T) {
+	tests := []struct {
+		name string
+		v1   SemVersion
+		v2   SemVersion
+		want bool
+	}{
+		{
+			name: "minor component with fewer digits",
+			v1:   "1.16.0",
+			v2:   "1.9.0",
+			want: true,
+		},
+		{
+			name: "patch component with fewer digits",
+			v1:   "1.16.10",
+			v2:   "1.16.9",
+			want: true,
+		},
+		{
+			name: "lower major component",
+			v1:   "1.30.0",
+			v2:   "2.0.0",
+			want: false,
+		},
+		{
+			name: "same version",
+			v1:   "1.16.0",
+			v2:   "1.16.0",
+			want: false,
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			if got := test.v1.GreaterThan(test.v2); got != test.want {
+				t.Fatalf("%s.GreaterThan(%s) = %t, want %t", test.v1, test.v2, got, test.want)
+			}
+		})
+	}
+}
+
+func TestGreaterThanSupportsKubernetesGitVersionPrefix(t *testing.T) {
+	if !SemVersion("v1.16.0").GreaterThan("v1.9.0") {
+		t.Fatal("expected v1.16.0 to be greater than v1.9.0")
+	}
+}
```

---

### Incident Patch 2: `9396e64b` (2026-05-21)
**Commit Message**: Fix tool-to-section mapping in security-audit skill (#1940)

Co-authored-by: Alon Girmonsky <alongir@Alons-Mac-Studio.local>

**File**: `skills/security-audit/SKILL.md` (modified, +29/-64)
```diff
@@ -113,25 +113,15 @@ waiting for snapshot creation or dissection.
 
 Confirm Kubeshark is running and which tools are available.
 
-**Tool**: `get_data_boundaries`
-
-Check how far back raw capture data exists. You need this to plan snapshot
-creation in Step 3 — call it now so the data is ready when you need it.
-
-**Tool**: `list_workloads` (no snapshot_id — queries live state)
-
-Get the current workload inventory for the target namespace. This returns
-pod names, namespaces, and IP addresses. Save the IPs — you'll need them
-throughout the audit.
+### Step 2: Query Live Traffic
 
-**Note**: `list_workloads` without a `snapshot_id` may fail with some
-Kubeshark versions (`snapshot_id is required for filtered listing`). If
-this happens, use individual lookups with `name` + `namespace` parameters,
-or skip to Step 3 and get the workload inventory from the first snapshot.
+**Tool**: `get_l7_data_boundaries`
 
-### Step 2: Query Live Traffic
+Check the time boundaries of dissected API calls in the real-time database.
+This tells you how far back L7 data is available — use it to understand
+the scope of your real-time queries before running them.
 
-In parallel, query the real-time dissected traffic across key dimensions.
+Then query the real-time dissected traffic across key dimensions.
 Use `list_api_calls` and `list_l4_flows` **without** a `snapshot_id` to
 hit the live data.
 
@@ -155,6 +145,12 @@ appear. Treat Section A findings as a fast first pass, not the final word.
 
 While analyzing real-time data, begin creating snapshots for Section B.
 
+**Tool**: `get_data_boundaries`
+
+Check how far back raw capture data exists. Raw capture is the FIFO buffer
+that feeds snapshot creation — this tells you the time window available
+for snapshots (which is different from the L7 boundaries in Step 2).
+
 **CRITICAL: Create snapshots ONE AT A TIME, sequentially.** Kubeshark only
 supports one concurrent snapshot download. Parallel creation will cause
 failures and data loss. The pattern is:
@@ -164,8 +160,7 @@ failures and data loss. The pattern is:
 3. You do NOT need to wait for dissection before creating the next snapshot.
    Create the next snapshot while the previous one dissects.
 
-Use the data boundaries from Step 1 (`get_data_boundaries`) to calculate
-how many snapshots are needed:
+Use `get_data_boundaries` to calculate how many snapshots are needed:
 
 ```
 total_range_ms = newest_timestamp - oldest_timestamp
@@ -247,7 +242,6 @@ wait for dissection to use the first two:
 | Source | Available | Tool | What It Provides |
 |--------|-----------|------|-----------------|
 | **Workloads & IPs** | Immediately | `list_workloads` with `snapshot_id` | Pod names, namespaces, IPs at capture time |
-| **L4 Flows** | Immediately | `list_l4_flows` with `snapshot_id` | TCP/UDP connections: src/dst IPs, ports, bytes, duration |
 | **PCAP Export** | Immediately | `export_snapshot_pcap` | Raw packets filtered by BPF expression |
 | **L7 Dissection** | After indexing | `list_api_calls`, `get_api_call`, `get_api_stats` | DNS queries, HTTP requests, SQL statements, Redis commands, gRPC methods |
 
@@ -261,12 +255,12 @@ Snapshot ready
   ├── Start dissection (background)
   ├── Phase 1: list_workloads (immediate) — workload inventory + IPs
   │            export_snapshot_pcap (immediate) — raw packet evidence
-  ├── Phase 3: list_l4_flows (immediate) — external flows, port scanning
-  ├── Phase 4: list_l4_flows (immediate) — lateral movement, fan-out
   │
   ├── [dissection completes]
   │
   ├── Phase 2: list_api_calls — DNS threat analysis
+  ├── Phase 3: list_api_calls — external HTTP communication
+  ├── Phase 4: list_api_calls — lateral movement, K8s API access
   ├── Phase 5: list_api_calls — protocol abuse (PG, Redis, gRPC)
   ├── Phase 6: list_api_calls — credential access (IMDS, cloud APIs)
   └── Phase 7: correlate all findings
@@ -396,32 +390,14 @@ Compare the count of failed queries to total queries per source pod.
 
 **Goal**
```

---

### Incident Patch 3: `cd13d8f8` (2026-05-15)
**Commit Message**: Add security-audit skill for MITRE ATT&CK-based threat detection (#1934)

New skill that guides systematic 8-phase network security audits across
MITRE ATT&CK tactics using snapshot-based traffic analysis. Includes
threat catalog, KFL security filter reference, and report template.

Co-authored-by: Alon Girmonsky <alongir@Alons-Mac-Studio.local>

**File**: `skills/README.md` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ compatible agents.
 | [`network-rca`](network-rca/) | Network Root Cause Analysis. Retrospective traffic analysis via snapshots, with two investigation routes: PCAP (for Wireshark/compliance) and Dissection (for AI-driven API-level investigation). |
 | [`kfl`](kfl/) | KFL2 (Kubeshark Filter Language) expert. Complete reference for writing, debugging, and optimizing CEL-based traffic filters across all supported protocols. |
 | [`security-audit`](security-audit/) | Network Security Audit. Systematic 8-phase threat detection across MITRE ATT&CK tactics — C2, exfiltration, lateral movement, credential theft, cryptomining, protocol abuse — using snapshot-based traffic analysis. |
-| [`install`](install/) | Installation & Deployment. Guides CLI and Helm installation, builds custom values files, handles platform-specific config (EKS/GKE/AKS/OpenShift/KinD), auth, ingress, cloud storage, and troubleshooting. |
 
 ## Prerequisites
 
```

**File**: `skills/security-audit/SKILL.md` (added, +724/-0)
```diff
@@ -0,0 +1,724 @@
+---
+name: security-audit
+description: >
+  Kubernetes network security audit skill powered by Kubeshark MCP. Use this skill
+  whenever the user wants to audit a cluster for security threats, detect compromised
+  workloads, find malicious traffic patterns, hunt for indicators of compromise (IOCs),
+  check for data exfiltration, identify C2 (command and control) communication,
+  detect cryptomining, find lateral movement, discover credential theft attempts,
+  assess network security posture, or perform threat hunting in Kubernetes.
+  Also trigger when the user mentions security audit, threat detection, compromise
+  assessment, vulnerability scan, "is my cluster compromised", "find malicious traffic",
+  "check for threats", DNS exfiltration, DNS tunneling, port scanning, IMDS access,
+  reverse shell, crypto miner, MITRE ATT&CK, IOC detection, anomaly detection,
+  suspicious traffic, rogue workloads, unauthorized access, or any request to
+  evaluate cluster security through network traffic analysis.
+---
+
+# Kubernetes Network Security Audit with Kubeshark MCP
+
+You are a Kubernetes network security specialist. Your job is to systematically
+audit cluster traffic for indicators of compromise, malicious behavior, and
+security threats — using network traffic as the ground truth.
+
+Network traffic cannot lie. Logs can be tampered with, metrics can be spoofed,
+but packets on the wire reveal what workloads actually do — what they connect to,
+what protocols they speak, what data they send. Your audit leverages this by
+examining DNS queries, HTTP requests, L4 flows, and protocol-level payloads
+across every dimension of the MITRE ATT&CK framework.
+
+## Prerequisites
+
+Before starting any audit, verify the environment is ready.
+
+**Tool**: `check_kubeshark_status`
+
+Confirm Kubeshark is deployed and tools are available. You need at minimum:
+`list_api_calls`, `list_l4_flows`, `list_workloads`, `get_api_call`.
+
+**KFL requirement**: This skill uses KFL filters for all queries. Before
+constructing any filter, load the KFL skill (`skills/kfl/`). KFL is statically
+typed — incorrect field names will fail silently. If the KFL skill is not
+loaded, only use the exact filter examples shown in this skill.
+
+**KFL error resilience**: If a KFL filter returns `undeclared reference` or
+similar errors, **do not give up on that phase**. Fall back to:
+1. Port-based filtering: `dst.port == 5432` instead of protocol flags
+2. Name-based filtering: `dst.name.contains("db")` or `src.name.contains("pod-name")`
+3. Browsing entries with `get_api_call` on IDs from `list_l4_flows`
+A KFL error means the filter syntax is wrong, not that the data doesn't exist.
+
+## Audit Methodology
+
+A security audit is NOT an incident investigation. You are not responding to
+a known event — you are proactively searching for threats that may be hiding
+in normal traffic. This requires a systematic sweep across all threat categories,
+not a single focused query.
+
+The audit has **two sections** that run in sequence:
+
+```
+SECTION A: Real-Time Analysis       → Instant, uses live dissected traffic
+SECTION B: Snapshot Deep Dive       → Immutable evidence, protocol-level inspection
+```
+
+### Why Two Sections?
+
+Kubeshark has two modes of data access:
+
+1. **Real-time dissection** — traffic is dissected as it flows through the
+   cluster. Provides instant access to L7 data (DNS, HTTP, etc.) that is
+   already captured and indexed. However, real-time dissection is resource-
+   intensive and may not be enabled, or may have gaps in coverage.
+
+2. **Snapshots** — immutable captures of raw traffic within a time window.
+   Must be created explicitly, then dissected separately. Guarantees complete
+   coverage of all packets in the window, but takes time to create and index.
+
+Section A uses whatever is already available — fast, immediate, but possibly
+incomplete. Section B creates snapshots for thorough, evidence-grade analy
```

**File**: `skills/security-audit/references/kfl-security-filters.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# KFL Quick Reference: Security Audit Filters
+
+## DNS Threat Hunting
+```
+dns                                                    // All DNS traffic
+dns && dns_response && size(dns_answers) == 0          // Failed lookups (NXDOMAIN — no answers)
+dns && dns_questions.exists(q, q.contains("minexmr"))  // Mining pool DNS
+dns && dns_questions.exists(q, q.contains("nanopool"))  // Mining pool DNS
+dns && dns_questions.exists(q, q.contains("amazonaws")) // Cloud API resolution
+dns && dns_questions.exists(q, q.contains("cloudflare-dns"))  // DoH bypass
+dns && dns_questions.exists(q, q.contains("dns.google"))      // DoH bypass
+```
+
+## External Communication
+```
+http && dst.name.contains("attacker")                  // Known-bad destinations
+http && map_get(request.headers, "user-agent", "").contains("Mozilla/4.0")  // Suspicious UA
+http && map_get(request.headers, "accept", "").contains("dns-json")         // DoH requests
+http && map_get(request.headers, "upgrade", "") == "websocket"              // WebSocket (potential mining)
+```
+
+## Lateral Movement
+```
+src.pod.namespace != dst.pod.namespace                 // Cross-namespace traffic
+http && path.startsWith("/api/v1/secrets")             // Secret enumeration
+http && path == "/.env"                                // Service fingerprinting
+http && path == "/actuator/info"                       // Spring Boot fingerprinting
+http && path == "/version"                             // Version fingerprinting
+```
+
+## Protocol Inspection
+```
+postgresql                                             // PostgreSQL wire protocol
+postgresql && postgresql_query.contains("UNION SELECT") // SQL injection patterns
+postgresql && !postgresql_success                       // Failed PostgreSQL queries
+redis                                                  // Redis protocol
+grpc                                                   // gRPC calls (native detection)
+grpc && grpc_method.contains("Reflection")             // gRPC reflection enumeration
+```
+
+## Credential Theft
+```
+dst.ip == "169.254.169.254"                            // IMDS access
+http && path.contains("/meta-data/iam")                // IAM credential paths
+http && map_get(request.headers, "authorization", "").startsWith("AWS4-HMAC-SHA256")  // Stolen AWS creds
+http && "x-aws-ec2-metadata-token-ttl-seconds" in request.headers                     // IMDSv2 token request
+```
+
+## Resource Hijacking
+```
+dst.port == 3333                                       // Stratum mining (standard)
+dst.port == 14433                                      // Stratum mining (alt)
+dst.port == 45700                                      // Stratum mining (alt)
+dst.port == 4444                                       // Reverse shell / backdoor
+```
+
+## Per-Namespace Scoping
+
+Add namespace filters to any query above:
+```
+dns && src.pod.namespace == "k8s-mule"                 // DNS from specific namespace
+http && src.pod.namespace == "k8s-mule"                // HTTP from specific namespace
+redis && src.pod.namespace == "k8s-mule"               // Redis from specific namespace
+```
```

**File**: `skills/security-audit/references/report-template.md` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+# Security Audit Report Template
+
+Use this template for the markdown report. Fill in all sections, then convert
+to PDF.
+
+```markdown
+# Kubernetes Network Security Audit Report
+
+**Cluster**: <cluster name/context>
+**Namespace**: <target namespace>
+**Date**: <audit date and time, local timezone>
+**Audit window**: <start time> — <end time> (<duration>)
+**Snapshots analyzed**: <count and IDs>
+**Audited by**: Claude Code + Kubeshark MCP
+
+---
+
+## Executive Summary
+
+<2-3 sentence summary: how many threats found, highest severity,
+whether an active attack chain was identified, top recommendation>
+
+## Threat Summary
+
+| # | Severity | Workload | Threat | MITRE ATT&CK |
+|---|----------|----------|--------|---------------|
+| 1 | CRITICAL | log-shipper | DNS Tunneling | T1048.003 |
+| 2 | CRITICAL | cloud-health-monitor | IMDS Credential Theft | T1552.005 |
+| ... | | | | |
+
+## Detailed Findings
+
+### Finding 1: <Title> (CRITICAL)
+
+**Workload**: <pod name>
+**MITRE ATT&CK**: <technique ID and name>
+**Snapshot**: <snapshot ID>
+**Detection method**: <which phase and tool detected this>
+
+**Evidence**:
+<Specific traffic data — DNS queries, HTTP requests, L4 flows,
+protocol payloads. Include timestamps, source/dest, and relevant
+content. Quote actual query names, URLs, SQL statements, or
+Redis commands observed.>
+
+**Impact**:
+<What this means — data at risk, credentials exposed, scope of access>
+
+**Recommendation**:
+<Specific remediation — NetworkPolicy, RBAC change, pod deletion, credential rotation>
+
+---
+
+(repeat for each finding)
+
+## Attack Chain Analysis
+
+<If findings correlate, map the kill chain:
+Initial Access → Reconnaissance → Credential Access → Lateral Movement →
+Exfiltration → Persistence. Identify which workloads participate in each stage.>
+
+## Detection Coverage
+
+| Phase | Checked | Findings |
+|-------|---------|----------|
+| Workload Inventory | Yes | <count> |
+| DNS Threat Analysis | Yes | <count> |
+| External Communication | Yes | <count> |
+| Lateral Movement | Yes | <count> |
+| Protocol Abuse | Yes | <count> |
+| Credential Access | Yes | <count> |
+
+## Limitations
+
+<What this audit cannot detect — config-level vulnerabilities,
+image CVEs, idle threats. Recommend complementary tools.>
+
+## Immediate Actions
+
+1. <Highest priority action>
+2. <Second priority>
+3. ...
+
+## Evidence Preservation
+
+<List snapshot IDs created during this audit. Recommend uploading
+to cloud storage for long-term retention. Include PCAP export
+commands for key findings.>
+```
+
+## Quality Guidelines
+
+- **Include raw evidence** — quote actual DNS queries, HTTP URLs, SQL
+  statements, Redis commands. The reader should be able to verify findings
+  without re-running the audit.
+- **Timestamp everything** — every finding should reference the snapshot ID
+  and timestamp (local time with UTC in parentheses).
+- **Be specific in recommendations** — not "fix RBAC" but "revoke
+  ClusterRoleBinding `mule-recon-cluster-admin` and replace with a
+  namespace-scoped Role granting only `get` on `pods`".
+- **Include MITRE ATT&CK IDs** — makes the report actionable for security
+  teams that track coverage against the framework.
```

**File**: `skills/security-audit/references/threat-catalog.md` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+# Network Threat Catalog
+
+22 network-observable threat patterns organized by MITRE ATT&CK tactic.
+Each entry describes the attack, what it looks like on the wire, and how
+to detect it with Kubeshark.
+
+## Command & Control (TA0011)
+
+### DGA Beaconing (T1568.002)
+- **What**: Malware generates pseudo-random domain names daily and queries DNS
+  for each. The C2 operator registers a few; most resolve to NXDOMAIN.
+- **Wire signature**: Burst of DNS queries for high-entropy .com/.net domains
+  with >80% NXDOMAIN response rate.
+- **KFL**: `dns && dns_response && size(dns_answers) == 0` — then check for entropy in queried names.
+- **Difficulty**: Medium. NXDOMAIN flood is distinctive but low-rate DGA can
+  blend with legitimate DNS failures.
+
+### HTTP C2 Beaconing (T1071.001)
+- **What**: Implant calls home via HTTP GET at regular intervals, receiving
+  tasking in the response body. Cobalt Strike, Meterpreter pattern.
+- **Wire signature**: Periodic HTTP GET to fixed external URL at suspiciously
+  regular intervals (30-60s). Outdated User-Agent (Mozilla/4.0). Session
+  identifiers in URL path.
+- **KFL**: `http && dst.name.contains("attacker")` or check for User-Agent anomalies.
+- **Difficulty**: Medium. Regularity is the key anomaly.
+
+### Encrypted C2 (T1573.002)
+- **What**: C2 over HTTPS. Content is encrypted but TLS SNI reveals suspicious
+  domain names.
+- **Wire signature**: Outbound TLS to non-standard domains (darknet, cdn-mirror).
+  DNS queries preceding the connection reveal the target.
+- **KFL**: `dns && (dns_questions.exists(q, q.contains("darknet")) || dns_questions.exists(q, q.contains("cdn-mirror")))`.
+- **Difficulty**: Hard. Encrypted, uses standard port 443.
+
+### DNS-over-HTTPS C2 (T1572)
+- **What**: Bypasses cluster DNS by sending queries as HTTPS to public DoH
+  resolvers (cloudflare-dns.com, dns.google). C2 commands embedded in TXT
+  responses.
+- **Wire signature**: HTTP requests to DoH endpoints with `accept: application/dns-json`
+  header. No corresponding queries on port 53.
+- **KFL**: `http && (dst.name.contains("cloudflare-dns") || dst.name.contains("dns.google"))`.
+- **Difficulty**: Hard. Looks like regular HTTPS to trusted providers.
+
+## Exfiltration (TA0010)
+
+### DNS Tunneling (T1048.003)
+- **What**: Full bidirectional data channel over DNS using tools like iodine,
+  dnscat2. Data encoded in long subdomain labels.
+- **Wire signature**: High-frequency DNS queries (20+/burst) with subdomain
+  labels near 63-byte limit. Mix of A, TXT, NULL query types.
+- **KFL**: `dns && dns_questions.exists(q, q.contains("data-relay"))` or look for
+  high query rates per source.
+- **Difficulty**: Medium. Volume and long subdomains are distinctive.
+
+### HTTP Header Exfiltration (T1048.001)
+- **What**: Data exfiltrated in HTTP headers (Cookie, X-Trace-ID) disguised
+  as analytics tracking. Low volume to evade detection.
+- **Wire signature**: HTTP GET to analytics-looking URL with oversized Cookie
+  or custom headers containing base64-encoded data.
+- **KFL**: `http && dst.name.contains("cdn-provider")`.
+- **Difficulty**: Hard. Low volume, standard HTTP, looks like analytics.
+
+### DNS Credential Exfiltration (T1048.003)
+- **What**: Stolen JWT tokens or credentials encoded in DNS TXT queries to
+  attacker-controlled authoritative nameserver.
+- **Wire signature**: DNS TXT queries with structured multi-label subdomains
+  containing base64-like encoded data.
+- **KFL**: `dns && dns_questions.exists(q, q.contains("steal-creds"))`.
+- **Difficulty**: Medium. Multi-label structure is distinctive.
+
+### gRPC Stream Exfiltration (T1048.001)
+- **What**: Data exfiltration via gRPC (HTTP/2) POST to external endpoint.
+  Blends with normal microservice traffic.
+- **Wire signature**: HTTP/2 POST with `Content-Type: application/grpc` to
+  external destination with exfil-related method names.
+- **KFL**: `grpc && dst.name.contains("attacker")`.
+- **Difficulty**: 
```

---

### Incident Patch 4: `9f5a1a41` (2026-05-01)
**Commit Message**: fix(release-pr): sync bumped Chart.yaml to kubeshark.github.io (#1913)

* fix(release-pr): sync bumped Chart.yaml to kubeshark.github.io

The release-pr target was switching back to master (and pulling)
BEFORE copying helm-chart/ into ../kubeshark.github.io/charts/chart.
That reverted the working tree to the pre-bump Chart.yaml, so the
kubeshark.github.io PR shipped the previous version and the
chart-releaser action failed trying to recreate an existing tag.

Copy the bumped chart from the release/vX.Y.Z working tree, then
switch kubeshark back to master at the end of the target.

Also consolidate iterative robustness improvements: VERSION
validation, idempotent sibling-repo tagging, idempotent branch /
commit / push / PR creation, and a "nothing to commit" guard so
reruns of release-pr do not fail.

* refactor(release): split release-pr into three rerunnable targets

Before, release-pr did three things in one recipe: tag sibling
repos, create the kubeshark release PR, and create the helm chart
PR. If any step failed, the whole target had to be rerun, even for
the parts that had already succeeded, and some sub-steps (like
tagging worker/hub/front after a docker-image-only rebuild) 

**File**: `Makefile` (modified, +92/-33)
```diff
@@ -253,52 +253,111 @@ port-forward:
 	kubectl port-forward $$(kubectl get pods | awk '$$1 ~ /^$(POD_PREFIX)/' | awk 'END {print $$1}') $(SRC_PORT):$(DST_PORT)
 
 release: ## Print release workflow instructions.
-	@echo "Release workflow (2 steps):"
+	@echo "Release workflow — each step is idempotent and can be rerun on its own:"
 	@echo ""
-	@echo "  1. make release-pr VERSION=x.y.z"
-	@echo "     Tags sibling repos, bumps version, creates PRs"
-	@echo "     (kubeshark + kubeshark.github.io helm chart)."
-	@echo "     Review and merge both PRs manually."
+	@echo "  1. make release-siblings VERSION=x.y.z"
+	@echo "     Tag worker, hub, front with vx.y.z. Also run standalone when"
+	@echo "     rebuilding docker images without cutting a full release."
 	@echo ""
-	@echo "  2. (automatic) Tag is created when release PR merges."
-	@echo "     Fallback: make release-tag VERSION=x.y.z"
-
-release-pr: ## Step 1: Tag sibling repos, bump version, create release PR.
-	@cd ../worker && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-	@cd ../hub && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-	@cd ../front && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@echo "  2. make release-pr-kubeshark VERSION=x.y.z"
+	@echo "     Bump Helm Chart.yaml, build, open release PR on kubeshark."
+	@echo ""
+	@echo "  3. make release-pr-helm VERSION=x.y.z"
+	@echo "     Sync helm-chart/ into kubeshark.github.io, open helm PR."
+	@echo "     Requires release/vx.y.z branch (created by step 2)."
+	@echo ""
+	@echo "  Shortcut: make release-pr VERSION=x.y.z runs 1 → 2 → 3."
+	@echo ""
+	@echo "  After both PRs merge: tag is created automatically,"
+	@echo "  or run: make release-tag VERSION=x.y.z"
+
+# Internal: validate VERSION before any release-* target runs.
+_release-check-version:
+	@if [ -z "$(VERSION)" ]; then echo "ERROR: VERSION is required. Usage: make <target> VERSION=x.y.z"; exit 1; fi
+	@echo "$(VERSION)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' || { echo "ERROR: VERSION must be semver (e.g. 53.2.4)"; exit 1; }
+
+release-siblings: _release-check-version ## Tag worker, hub, front with v$(VERSION). Idempotent; standalone for docker-image-only updates.
+	@for repo in worker hub front; do \
+		echo "==> $$repo: ensuring v$(VERSION) tag"; \
+		(cd ../$$repo && git checkout master && git pull) || exit 1; \
+		if (cd ../$$repo && git ls-remote --tags origin "refs/tags/v$(VERSION)" | grep -q .); then \
+			echo "    v$(VERSION) already on origin — skipping"; \
+		else \
+			(cd ../$$repo && git tag -d v$(VERSION) 2>/dev/null; git tag v$(VERSION) && git push origin "refs/tags/v$(VERSION)") || exit 1; \
+		fi; \
+	done
+
+release-pr-kubeshark: _release-check-version ## Bump Chart.yaml, build, open release PR on kubeshark.
 	@cd ../kubeshark && git checkout master && git pull
-	@sed -i '' "s/^version:.*/version: \"$(shell echo $(VERSION) | sed -E 's/^([0-9]+\.[0-9]+\.[0-9]+)\..*/\1/')\"/" helm-chart/Chart.yaml
+	@NEW=$$(echo $(VERSION) | sed -E 's/^([0-9]+\.[0-9]+\.[0-9]+).*/\1/'); \
+	CUR=$$(awk '/^version:/ {gsub(/"/,"",$$2); print $$2; exit}' helm-chart/Chart.yaml); \
+	if [ "$$CUR" != "$$NEW" ]; then \
+		sed -i '' "s/^version:.*/version: \"$$NEW\"/" helm-chart/Chart.yaml; \
+	else \
+		echo "Chart.yaml already at $$NEW"; \
+	fi
 	@$(MAKE) build VER=$(VERSION)
 	@if [ "$(shell uname)" = "Darwin" ]; then \
 		codesign --sign - --force --preserve-metadata=entitlements,requirements,flags,runtime ./bin/kubeshark__; \
 	fi
 	@$(MAKE) generate-helm-values && $(MAKE) generate-manifests
+	@if git show-ref --verify --quiet refs/heads/release/v$(VERSION); then \
+		git branch -D release/v$(VERSION); \
+	fi
 	@git checkout -b release/v$(VERSION)
 	@git add -A .
-	@git commit -m ":bookmark: Bump the Helm chart version to $(VERSION)"
-	@git push -u origin release/v$(VERSION)
-	@gh pr create 
```

---

### Incident Patch 5: `3a1ad64b` (2026-04-10)
**Commit Message**: fix: add subPathExpr to worker DaemonSet for shared persistent storage (#1901)

Co-authored-by: Volodymyr Stoiko <me@volodymyrstoiko.com>
Co-authored-by: Alon Girmonsky <1990761+alongir@users.noreply.github.com>

**File**: `helm-chart/templates/09-worker-daemon-set.yaml` (modified, +14/-0)
```diff
@@ -131,6 +131,10 @@ spec:
             valueFrom:
               fieldRef:
                 fieldPath: metadata.namespace
+          - name: NODE_NAME
+            valueFrom:
+              fieldRef:
+                fieldPath: spec.nodeName
           - name: TCP_STREAM_CHANNEL_TIMEOUT_MS
             value: '{{ .Values.tap.misc.tcpStreamChannelTimeoutMs }}'
           - name: TCP_STREAM_CHANNEL_TIMEOUT_SHOW
@@ -227,6 +231,9 @@ spec:
               mountPropagation: HostToContainer
             - mountPath: /app/data
               name: data
+{{- if .Values.tap.persistentStorage }}
+              subPathExpr: $(NODE_NAME)
+{{- end }}
       {{- if .Values.tap.tls }}
         - command:
             - ./tracer
@@ -257,6 +264,10 @@ spec:
             valueFrom:
               fieldRef:
                 fieldPath: metadata.namespace
+          - name: NODE_NAME
+            valueFrom:
+              fieldRef:
+                fieldPath: spec.nodeName
           - name: PROFILING_ENABLED
             value: '{{ .Values.tap.pprof.enabled }}'
           - name: SENTRY_ENABLED
@@ -328,6 +339,9 @@ spec:
               mountPropagation: HostToContainer
             - mountPath: /app/data
               name: data
+{{- if .Values.tap.persistentStorage }}
+              subPathExpr: $(NODE_NAME)
+{{- end }}
             - mountPath: /etc/os-release
               name: os-release
               readOnly: true
```

---

### Incident Patch 6: `4695acb4` (2026-03-31)
**Commit Message**: :bug: Fix release-pr Makefile target cleanup and macOS sed compatibility (#1890)

- Fix macOS sed -i requiring empty backup extension argument
- Checkout master after creating kubeshark release PR
- Checkout master in kubeshark.github.io before and after creating helm PR
- Run all kubeshark.github.io operations in a single shell to avoid lost cd context

Co-authored-by: Alon Girmonsky <alongir@Alons-Mac-Studio.local>

**File**: `Makefile` (modified, +12/-10)
```diff
@@ -264,10 +264,10 @@ release: ## Print release workflow instructions.
 	@echo "     Fallback: make release-tag VERSION=x.y.z"
 
 release-pr: ## Step 1: Tag sibling repos, bump version, create release PR.
-# 	@cd ../worker && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-# 	@cd ../hub && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-# 	@cd ../front && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
-# 	@cd ../kubeshark && git checkout master && git pull
+	@cd ../worker && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@cd ../hub && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@cd ../front && git checkout master && git pull && git tag -d v$(VERSION); git tag v$(VERSION) && git push origin --tags
+	@cd ../kubeshark && git checkout master && git pull
 	@sed -i '' "s/^version:.*/version: \"$(shell echo $(VERSION) | sed -E 's/^([0-9]+\.[0-9]+\.[0-9]+)\..*/\1/')\"/" helm-chart/Chart.yaml
 	@$(MAKE) build VER=$(VERSION)
 	@if [ "$(shell uname)" = "Darwin" ]; then \
@@ -282,19 +282,21 @@ release-pr: ## Step 1: Tag sibling repos, bump version, create release PR.
 		--body "Automated release PR for v$(VERSION)." \
 		--base master \
 		--reviewer corest
-	@rm -rf ../kubeshark.github.io/charts/chart
-	@mkdir ../kubeshark.github.io/charts/chart
-	@cp -r helm-chart/ ../kubeshark.github.io/charts/chart/
-	@cd ../kubeshark.github.io && git checkout master && git pull \
+	@git checkout master && git pull
+	@cd ../kubeshark.github.io \
+		&& git checkout master && git pull \
+		&& rm -rf charts/chart \
+		&& mkdir charts/chart \
+		&& cp -r ../kubeshark/helm-chart/ charts/chart/ \
 		&& git checkout -b helm-v$(VERSION) \
 		&& git add -A . \
 		&& git commit -m ":sparkles: Update the Helm chart to v$(VERSION)" \
 		&& git push -u origin helm-v$(VERSION) \
 		&& gh pr create --title ":sparkles: Helm chart v$(VERSION)" \
 			--body "Update Helm chart for release v$(VERSION)." \
 			--base master \
-			--reviewer corest
-	@cd ../kubeshark
+			--reviewer corest \
+		&& git checkout master
 	@echo ""
 	@echo "Release PRs created:"
 	@echo "  - kubeshark: Review and merge the release PR."
```

---

### Incident Patch 7: `c63740ec` (2026-03-20)
**Commit Message**: :bug: Fix dissection-control `front` env logic (#1878)

**File**: `helm-chart/templates/06-front-deployment.yaml` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ spec:
               value: '{{- if and (not .Values.demoModeEnabled) (not .Values.tap.capture.dissection.enabled) -}}
                         true
                       {{- else -}}
-                        {{ not (default false .Values.demoModeEnabled) | ternary false true }}
+                        {{ (default false .Values.demoModeEnabled) | ternary false true }}
                       {{- end -}}'
             - name: 'REACT_APP_CLOUD_LICENSE_ENABLED'
               value: '{{- if or (and .Values.cloudLicenseEnabled (not (empty .Values.license))) (not .Values.internetConnectivity) -}}
```

---

### Incident Patch 8: `963b3e4a` (2026-03-17)
**Commit Message**: :bug: Add default value for `demoModeEnabled` (#1872)

**File**: `helm-chart/templates/12-config-map.yaml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ data:
     INGRESS_HOST: '{{ .Values.tap.ingress.host }}'
     PROXY_FRONT_PORT: '{{ .Values.tap.proxy.front.port }}'
     AUTH_ENABLED: '{{- if and .Values.cloudLicenseEnabled (not (empty .Values.license)) -}}
-                        {{ .Values.demoModeEnabled | ternary true ((and .Values.tap.auth.enabled (eq .Values.tap.auth.type "dex")) | ternary true false) }}
+                        {{ (default false .Values.demoModeEnabled) | ternary true ((and .Values.tap.auth.enabled (eq .Values.tap.auth.type "dex")) | ternary true false) }}
                   {{- else -}}
                         {{ .Values.cloudLicenseEnabled | ternary "true" ((default false .Values.demoModeEnabled) | ternary "true" .Values.tap.auth.enabled) }}
                   {{- end }}'
```

---

### Incident Patch 9: `f9a5fbbb` (2026-03-06)
**Commit Message**: Fix snapshots local storage size (#1859)

Co-authored-by: Alon Girmonsky <1990761+alongir@users.noreply.github.com>

**File**: `helm-chart/templates/04-hub-deployment.yaml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ spec:
             - -capture-stop-after
             - "{{ if hasKey .Values.tap.capture.dissection "stopAfter" }}{{ .Values.tap.capture.dissection.stopAfter }}{{ else }}5m{{ end }}"
             - -snapshot-size-limit
-            - '{{ .Values.tap.snapshots.storageSize }}'
+            - '{{ .Values.tap.snapshots.local.storageSize }}'
             - -dissector-image
           {{- if .Values.tap.docker.overrideImage.worker }}
             - '{{ .Values.tap.docker.overrideImage.worker }}'
```

---

### Incident Patch 10: `a6daefc5` (2026-03-06)
**Commit Message**: Fix MCP Registry publish by using OIDC auth instead of interactive OAuth (#1857)

mcp-publisher login github uses the device flow (interactive OAuth) which
requires a human to visit a URL - this can never work in CI. Switch to
github-oidc which uses the OIDC token provided by GitHub Actions.

**File**: `.github/workflows/mcp-publish.yml` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ jobs:
       - name: Login to MCP Registry
         if: github.event_name != 'workflow_dispatch' || github.event.inputs.dry_run != 'true'
         shell: bash
-        run: mcp-publisher login github
+        run: mcp-publisher login github-oidc
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
```

#### Recent Merged Pull Requests:
- **PR #1969** (closed): Link testing methodology from release notes (@corest)
- **PR #1966** (2026-09-09): chart: drop demoModeEnabled in favour of tap.auth.defaultRole (@corest)
- **PR #1965** (closed): cmd: iterate MCP path segments with SplitSeq (@daixiheguu)
- **PR #1964** (closed): Document BoringSSL TLS support (@kVinsom)
- **PR #1962** (2026-09-08): Add support for extra objects in helm chart (@corest)
- **PR #1961** (closed): feat: validate configuration schema version (@kVinsom)
- **PR #1958** (2026-08-13): :bookmark: Release v53.4.0 (@corest)
- **PR #1957** (2026-08-12): mcp: confine download_file destination and harden start_kubeshark argument handling (@corest)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
