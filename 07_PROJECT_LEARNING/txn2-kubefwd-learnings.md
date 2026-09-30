# Forensic Learning Record (Deep Inspection): txn2/kubefwd

> **Canonical Artifact**: `07_PROJECT_LEARNING/txn2-kubefwd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/txn2/kubefwd](https://github.com/txn2/kubefwd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:28:46.120Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `txn2/kubefwd`
- **Description**: Bulk port forwarding Kubernetes services for local development.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4172 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/kubefwd/kubefwd.go`
```
package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/txn2/kubefwd/cmd/kubefwd/mcp"
	"github.com/txn2/kubefwd/cmd/kubefwd/services"
	"k8s.io/klog/v2"
)

var globalUsage = `Bulk forward Kubernetes services for local development.

Each forwarded service gets its own unique loopback IP (127.x.x.x), allowing
multiple services to use the same port simultaneously. Service names are added
to /etc/hosts for transparent access using cluster service names.

Modes:
  Idle Mode:    Run without -n/--namespace; API enabled, no namespaces forwarded
  Namespace:    Forward all services from specified namespace(s)
  All:          Forward services from all namespaces (--all-namespaces)

The REST API (http://kubefwd.internal/) is auto-enabled in idle mode and allows
adding/removing namespaces and services dynamically.

Subcommands:
  mcp           Start MCP server for AI assistant integration (no sudo needed)
  version       Show version information`
var Version = "0.0.0"

// KlogWriter captures klog output and reformats it through logrus
type KlogWriter struct{}

// throttleRegex matches k8s client-side throttling messages
var throttleRegex = regexp.MustCompile(`Waited for ([\d.]+)s due to client-side throttling`)

func (w *KlogWriter) Write(p []byte) (n int, err error) {
	msg := strings.TrimSpace(string(p))

	// Skip empty lines and trace detail lines
	if msg == "" || strings.HasPrefix(msg, "Trace[") {
		return len(p), nil
	}

	// Extract and reformat throttling messages
	if matches := throttleRegex.FindStringSubmatch(msg); len(matches) > 1 {
		log.Warnf("K8s API throttled: waited %ss", matches[1])
		return len(p), nil
	}

	// Skip trace headers and request noise
	if strings.Contains(msg, "trace.go:") || strings.Contains(msg, "request.go:") {
		return len(p), nil
	}

	// Skip generic "lost connection" messages (lack useful context)
	if strings.Contains(msg, "lost connection to pod") {
		return len(p), nil
	}

	// Log any other unexpected klog messages at debug level
	log.Debugf("k8s: %s", msg)

	return len(p), nil
}

func init() {
	// Redirect k8s client-go klog output through our formatter
	klog.InitFlags(nil)
	klog.SetOutput(&KlogWriter{})
	klog.LogToStderr(false)

	// quiet version
	args := os.Args[1:]
	if len(args) == 2 && args[0] == "version" && args[1] == "quiet" {
		fmt.Println(Version)
		os.Exit(0)
	}

	log.SetOutput(&LogOutputSplitter{})
	if len(args) > 0 && (args[0] == "completion" || args[0] == "__complete" || args[0] == "mcp") {
		log.SetOutput(io.Discard)
	}
}

func newRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "kubefwd",
		Short: "Expose Kubernetes services for local development.",
		Example: `  sudo kubefwd                      # Idle mode (API enabled, no namespaces)
  sudo kubefwd --tui                # Idle mode with TUI
  sudo kubefwd -n myapp             # Forward services from 'myapp' namespace
  sudo kubefwd -n ns1 -n ns2        # Forward from multiple namespaces
  sudo kubefwd -A                   # Forward from all namespaces
  sudo kubefwd -n myapp -l app=web  # Filter by label selector
  kubefwd mcp                       # Start MCP server for AI integration
  kubefwd version                   # Show version`,

		Long: globalUsage,
	}

	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print the version of Kubefwd",
		Example: " kubefwd version\n" +
			" kubefwd version quiet\n",
		Long: ``,
		Run: func(_ *cobra.Command, _ []string) {
			fmt.Printf("Kubefwd version: %s\nhttps://kubefwd.com\n", Version)
		},
	}

	// Pass version to services package for TUI header
	services.Version = Version

	// Pass version to mcp package
	mcp.Version = Version

	cmd.AddCommand(versionCmd, services.Cmd, mcp.Cmd)

	return cmd
}

type LogOutputSplitter struct{}

func (splitter *LogOutputSplitter) Write(p []byte) (n int, err error) {
	if bytes.Contains(p, []byte("level=error")) || bytes.Contains(p, []byte("level=warn")) {
		return os.Stderr.Write(p)
	}
	return os.Stdout.Write(p)
}

// isTUIMode checks if --tui flag is present in args
func isTUIMode() bool {
	for _, arg := range os.Args {
		if arg == "--tui" {
			return true
		}
	}
	return false
}

// isMCPMode checks if running the mcp subcommand
func isMCPMode() bool {
	for _, arg := range os.Args[1:] {
		if arg == "mcp" {
			return true
		}
		// Stop at first non-flag argument
		if !strings.HasPrefix(arg, "-") {
			break
		}
	}
	return false
}

// isKnownSubcommand checks if arg is a known subcommand
func isKnownSubcommand(arg string) bool {
	knownCommands := map[string]bool{
		"services": true, "svcs": true, "svc": true,
		"version": true, "mcp": true,
		"help": true, "completion": true, "__complete": true,
	}
	return knownCommands[arg]
}

func main() {
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp:   true,
		ForceColors:     true,
		TimestampFormat: "15:04:05",
	})

	// If no subcommand provided, default to "svc" (services command)
	// This enables `sudo -E kubefwd` to work directly as idle mode
	args := os.Args[1:]
	if len(args) == 0 || (len(args) > 0 && !isKnownSubcommand(args[0])) {
		// No args, or first arg is a flag/unknown - prepend "svc"
		os.Args = append([]string{os.Args[0], "svc"}, args...)
	}

	// Only print banner in non-TUI, non-MCP mode
	if !isTUIMode() && !isMCPMode() {
		log.Print(` _          _           __             _`)
		log.Print(`| | ___   _| |__   ___ / _|_      ____| |`)
		log.Print(`| |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  |`)
		log.Print(`|   <| |_| | |_) |  __/  _|\ V  V / (_| |`)
		log.Print(`|_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_|`)
		log.Print("")
		log.Printf("Version %s", Version)
		log.Print("https://kubefwd.com")
		log.Print("")
	}

	cmd := newRootCmd()

	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/kubefwd/mcp/mcp.go`
```
// Package mcp provides the MCP (Model Context Protocol) subcommand for kubefwd.
// This command starts an MCP server that connects to a running kubefwd REST API,
// allowing AI assistants like Claude to interact with kubefwd without requiring sudo.
package mcp

import (
	"fmt"
	"os"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdmcp"
)

var (
	apiURL string
	apiKey string
	verbose bool
)

// Version is set by the main package
var Version string

func init() {
	Cmd.Flags().StringVar(&apiURL, "api-url", "http://kubefwd.internal/api", "URL of the kubefwd REST API")
	Cmd.Flags().StringVar(&apiKey, "api-key", "", "API key for authentication (env: KUBEFWD_API_KEY)")
	Cmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output")
}

// Cmd is the MCP subcommand
var Cmd = &cobra.Command{
	Use:   "mcp",
	Short: "Start MCP server (connects to kubefwd REST API)",
	Long: `Start an MCP (Model Context Protocol) server that connects to a running
kubefwd instance via its REST API.

Architecture:
  ┌─────────────┐    stdio     ┌─────────────┐    HTTP      ┌─────────────┐
  │  AI Client  │ ←──────────→ │ kubefwd mcp │ ←──────────→ │   kubefwd   │
  │ (Claude,etc)│   MCP proto  │  (bridge)   │ REST API     │ (with sudo) │
  └─────────────┘              └─────────────┘              └─────────────┘

Why two processes?
  - kubefwd needs sudo for /etc/hosts and network interfaces
  - MCP clients spawn MCP servers as child processes (no sudo possible)
  - So 'kubefwd mcp' runs without sudo and talks to kubefwd via REST API

This command does NOT require sudo and can be spawned by Claude Code, Cursor,
or other MCP-compatible AI assistants.

Prerequisites:
  1. Start kubefwd in a separate terminal (requires sudo):
     sudo -E kubefwd              # Idle mode with API auto-enabled
     sudo -E kubefwd -n default   # Forward namespace (API auto-enabled)

  2. Configure your MCP client (e.g., Claude Code):
     {
       "mcpServers": {
         "kubefwd": {
           "command": "kubefwd",
           "args": ["mcp"]
         }
       }
     }

The MCP server provides developer-focused tools for:
  - Adding/removing namespaces to forward dynamically
  - Adding/removing individual services to forward
  - Discovering available Kubernetes namespaces and services
  - Getting connection info (hostnames, IPs, ports, env vars)
  - Finding forwarded services by name or port
  - Listing and inspecting forwarded services
  - Viewing metrics and logs
  - Triggering reconnections and syncs
  - Diagnosing errors`,
	Example: `  # Start MCP server (connects to kubefwd API at http://kubefwd.internal/api)
  kubefwd mcp

  # Connect to a custom API URL
  kubefwd mcp --api-url http://localhost:8080/api

  # With verbose logging (logs go to stderr, not interfering with stdio MCP)
  kubefwd mcp --verbose`,
	Run: runMCP,
}

func runMCP(_ *cobra.Command, _ []string) {
	// Configure logging to stderr (stdout is used for MCP stdio transport)
	log.SetOutput(os.Stderr)
	if verbose {
		log.SetLevel(log.DebugLevel)
	} else {
		log.SetLevel(log.WarnLevel)
	}

	if apiKey != "" {
		if err := os.Setenv("KUBEFWD_API_KEY", apiKey); err != nil {
			log.Warnf("Failed to set KUBEFWD_API_KEY: %v", err)
		}
	}

	log.Infof("Starting kubefwd MCP server (version %s)", Version)
	log.Infof("Connecting to REST API at: %s", apiURL)

	// Initialize MCP server first so tools are registered for discovery
	// (allows Smithery and other registries to introspect capabilities)
	server := fwdmcp.Init(Version)

	// Check API connection - if unavailable, tools will return helpful errors
	apiAvailable := false
	if err := verifyAPIConnection(apiURL); err != nil {
		log.Warnf("Cannot connect to kubefwd API at %s: %v", apiURL, err)
		log.Warn("MCP server will start but tools require kubefwd to be running.")
		log.Warn("Start kubefwd in another terminal with: sudo -E kubefwd")
	} else {
		log.Info("API connection verified")
		apiAvailable = true
	}

	// Only set up HTTP adapters if API is available
	// If not available, providers stay nil and handlers return helpful instructions
	if apiAvailable {
		// Create HTTP-based adapters
		stateReader := fwdmcp.NewStateReaderHTTP(apiURL)
		metricsProvider := fwdmcp.NewMetricsProviderHTTP(apiURL)
		serviceController := fwdmcp.NewServiceControllerHTTP(apiURL)
		diagnosticsProvider := fwdmcp.NewDiagnosticsProviderHTTP(apiURL)
		managerInfo := fwdmcp.NewManagerInfoHTTP(apiURL)

		// Create CRUD HTTP adapters for developer-focused tools
		namespaceController := fwdmcp.NewNamespaceControllerHTTP(apiURL)
		serviceCRUD := fwdmcp.NewServiceCRUDHTTP(apiURL)
		k8sDiscovery := fwdmcp.NewKubernetesDiscoveryHTTP(apiURL)
		connectionInfo := fwdmcp.NewConnectionInfoProviderHTTP(apiURL)

		// Create enhanced HTTP adapters for AI-optimized tools
		analysisProvider := fwdmcp.NewAnalysisProviderHTTP(apiURL)
		httpTrafficProvider := fwdmcp.NewHTTPTrafficProviderHTTP(apiURL)
		historyProvider := fwdmcp.NewHistoryProviderHTTP(apiURL)

		server.SetStateReader(stateReader)
		server.SetMetricsProvider(metricsProvider)
		server.SetServiceController(serviceController)
		server.SetDiagnosticsProvider(diagnosticsProvider)
		server.SetManagerInfo(func() types.ManagerInfo {
			return managerInfo
		})

		// Set CRUD controllers for developer-focused tools
		server.SetNamespaceController(namespaceController)
		server.SetServiceCRUD(serviceCRUD)
		server.SetKubernetesDiscovery(k8sDiscovery)
		server.SetConnectionInfoProvider(connectionInfo)

		// Set enhanced providers for AI-optimized tools
		server.SetAnalysisProvider(analysisProvider)
		server.SetHTTPTrafficProvider(httpTrafficProvider)
		server.SetHistoryProvider(historyProvider)
	}

	log.Info("MCP server initialized, starting stdio transport...")

	// Run stdio server (blocks until client disconnects)
	if err := server.ServeStdio(); err != nil {
		log.Errorf("MCP server error: %v", err)
		os.Exit(1)
	}

	log.Info("MCP server stopped")
}

// verifyAPIConnection checks if the kubefwd API is reachable
func verifyAPIConnection(baseURL string) error {
	client := fwdmcp.NewHTTPClient(baseURL)

	var resp struct {
		Status string `json:"status"`
	}

	// Try to hit the health endpoint
	if err := client.Get("/health", &resp); err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}

	return nil
}

```

### Core Architecture Module: `cmd/kubefwd/services/services.go`
```
package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/txn2/kubefwd/pkg/fwdapi"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdcfg"
	"github.com/txn2/kubefwd/pkg/fwdhost"
	"github.com/txn2/kubefwd/pkg/fwdmetrics"
	"github.com/txn2/kubefwd/pkg/fwdns"
	"github.com/txn2/kubefwd/pkg/fwdport"
	"github.com/txn2/kubefwd/pkg/fwdsvcregistry"
	"github.com/txn2/kubefwd/pkg/fwdtui"
	"github.com/txn2/kubefwd/pkg/fwdtui/events"
	"github.com/txn2/kubefwd/pkg/fwdtui/state"
	"github.com/txn2/kubefwd/pkg/fwdtui/styles"
	"github.com/txn2/kubefwd/pkg/utils"
	"github.com/txn2/txeh"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	authorizationv1 "k8s.io/api/authorization/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilRuntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

// cmdline arguments
var namespaces []string
var contexts []string
var verbose bool
var domain string
var mappings []string
var isAllNs bool
var fwdConfigurationPath string
var fwdReservations []string
var timeout int
var hostsPath string
var refreshHostsBackup bool
var purgeStaleIps bool
var resyncInterval time.Duration
var retryInterval time.Duration
var tuiMode bool
var apiMode bool
var autoReconnect bool
var themeOverride string

// Version is set by the main package
var Version string

// defaultHostsPath returns the OS-appropriate hosts file path
func defaultHostsPath() string {
	if runtime.GOOS == "windows" {
		return `C:\Windows\System32\drivers\etc\hosts`
	}
	return "/etc/hosts"
}

func init() {
	// override error output from k8s.io/apimachinery/pkg/util/runtime
	utilRuntime.ErrorHandlers[0] = func(_ context.Context, err error, _ string, _ ...interface{}) {
		// "broken pipe" see: https://github.com/kubernetes/kubernetes/issues/74551
		log.Errorf("Runtime: %s", err.Error())
	}

	Cmd.Flags().StringP("kubeconfig", "c", "", "absolute path to a kubectl config file")
	Cmd.Flags().StringSliceVarP(&contexts, "context", "x", []string{}, "specify a context to override the current context")
	Cmd.Flags().StringSliceVarP(&namespaces, "namespace", "n", []string{}, "Specify a namespace. Specify multiple namespaces by duplicating this argument.")
	Cmd.Flags().StringP("selector", "l", "", "Selector (label query) to filter on; supports '=', '==', and '!=' (e.g. -l key1=value1,key2=value2).")
	Cmd.Flags().StringP("field-selector", "f", "", "Field selector to filter on; supports '=', '==', and '!=' (e.g. -f metadata.name=service-name).")
	Cmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output.")
	Cmd.Flags().StringVarP(&domain, "domain", "d", "", "Append a pseudo domain name to generated host names.")
	Cmd.Flags().StringSliceVarP(&mappings, "mapping", "m", []string{}, "Specify a port mapping. Specify multiple mapping by duplicating this argument.")
	Cmd.Flags().BoolVarP(&isAllNs, "all-namespaces", "A", false, "Enable --all-namespaces option like kubectl.")
	Cmd.Flags().StringSliceVarP(&fwdReservations, "reserve", "r", []string{}, "Specify an IP reservation. Specify multiple reservations by duplicating this argument.")
	Cmd.Flags().StringVarP(&fwdConfigurationPath, "fwd-conf", "z", "", "Define an IP reservation configuration")
	Cmd.Flags().IntVarP(&timeout, "timeout", "t", 300, "Specify a timeout seconds for the port forwarding.")
	Cmd.Flags().StringVar(&hostsPath, "hosts-path", defaultHostsPath(), "Hosts file path.")
	Cmd.Flags().BoolVarP(&refreshHostsBackup, "refresh-backup", "b", false, "Create a fresh hosts backup, replacing any existing backup.")
	Cmd.Flags().BoolVarP(&purgeStaleIps, "purge-stale-ips", "p", false, "Remove stale kubefwd host entries (IPs in 127.1.27.1 - 127.255.255.255 range) before starting.")
	Cmd.Flags().DurationVar(&resyncInterval, "resync-interval", 5*time.Minute, "Interval for forced service resync (e.g., 1m, 5m, 30s)")
	Cmd.Flags().DurationVar(&retryInterval, "retry-interval", 10*time.Second, "Retry interval when no pods found for a service (e.g., 5s, 10s, 30s)")
	Cmd.Flags().BoolVar(&tuiMode, "tui", false, "Enable terminal user interface mode for interactive service monitoring")
	Cmd.Flags().BoolVar(&apiMode, "api", false, "Enable REST API server on http://kubefwd.internal/api for automation and monitoring")
	Cmd.Flags().BoolVarP(&autoReconnect, "auto-reconnect", "a", false, "Automatically reconnect when port forwards are lost (exponential backoff: 1s to 5min). Defaults to true in TUI/API mode.")
	Cmd.Flags().StringVar(&themeOverride, "theme", "", "Color theme for TUI: 'light' or 'dark' (auto-detected if not set, env: KUBEFWD_THEME)")
}

var Cmd = &cobra.Command{
	Use:     "services",
	Aliases: []string{"svcs", "svc"},
	Short:   "Forward services",
	Long: `Forward multiple Kubernetes services from one or more namespaces.

Idle Mode:
  When run without specifying namespaces (-n) or --all-namespaces, kubefwd starts
  in idle mode. The REST API is automatically enabled and kubefwd waits for
  namespaces and services to be added via API calls. This is useful for:
  - Running kubefwd as a background daemon
  - AI/MCP integration where all operations are API-driven
  - Dynamic environments where namespaces are not known at startup

  In idle mode, auto-reconnect (-a) is also enabled by default.`,
	Example: "  sudo kubefwd                          # Idle mode with API\n" +
		"  sudo kubefwd --tui                    # Idle mode with TUI\n" +
		"  sudo kubefwd -n the-project           # Forward from namespace\n" +
		"  sudo kubefwd -n the-project --tui     # With TUI\n" +
		"  sudo kubefwd -n the-project -l app=api\n" +
		"  sudo kubefwd -n default -n other-ns   # Multiple namespaces\n" +
		"  sudo kubefwd --all-namespaces         # All namespaces",
	Run: runCmd,
}

// setAllNamespace Form V1Core get all namespace
func setAllNamespace(clientSet kubernetes.Interface, options metav1.ListOptions, namespaces *[]string) {
	nsList, err := clientSet.CoreV1().Namespaces().List(context.TODO(), options)
	if err != nil {
		log.Fatalf("Error get all namespaces by CoreV1: %s\n", err.Error())
	}
	if nsList == nil {
		log.Warn("No namespaces returned.")
		return
	}

	for _, ns := range nsList.Items {
		*namespaces = append(*namespaces, ns.Name)
	}
}

// checkConnection tests if you can connect to the cluster in your config,
// and if you have the necessary permissions to use kubefwd.
func checkConnection(clientSet kubernetes.Interface, namespaces []string) error {
	// Check simple connectivity: can you connect to the api server
	_, err := clientSet.Discovery().ServerVersion()
	if err != nil {
		return err
	}

	// Check RBAC permissions for each of the requested namespaces
	requiredPermissions := []authorizationv1.ResourceAttributes{
		{Verb: "list", Resource: "pods"}, {Verb: "get", Resource: "pods"}, {Verb: "watch", Resource: "pods"},
		{Verb: "get", Resource: "services"},
	}
	for _, namespace := range namespaces {
		for _, perm := range requiredPermissions {
			perm.Namespace = namespace
			var accessReview = &authorizationv1.SelfSubjectAccessReview{
				Spec: authorizationv1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &perm,
				},
			}
			accessReview, err = clientSet.AuthorizationV1().SelfSubjectAccessReviews().Create(context.TODO(), accessReview, metav1.CreateOptions{})
			if err != nil {
				return err
			}
			if !accessReview.Status.Allowed {
				return fmt.Errorf("missing RBAC permission: %v", perm)
			}
		}
	}

	return nil
}

// validateEnvironment checks root privileges and hosts file
func validateEnvironment() bool {
	hasRoot, err := utils.CheckRoot()
	if !hasRoot {
		log.Errorf(`
This program requires superuser privileges to run. These
privileges are required to add IP address aliases to your
loopback interface. Superuser privileges are also needed
to listen on low port numbers for these IP address
```

### Core Architecture Module: `pkg/fwdapi/adapters.go`
```
package fwdapi

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdcfg"
	"github.com/txn2/kubefwd/pkg/fwdmetrics"
	"github.com/txn2/kubefwd/pkg/fwdns"
	"github.com/txn2/kubefwd/pkg/fwdsvcregistry"
	"github.com/txn2/kubefwd/pkg/fwdtui"
	"github.com/txn2/kubefwd/pkg/fwdtui/events"
	"github.com/txn2/kubefwd/pkg/fwdtui/state"
)

// StateReaderAdapter adapts state.Store to the StateReader interface
type StateReaderAdapter struct {
	getStore func() *state.Store
}

// NewStateReaderAdapter creates a new StateReaderAdapter
func NewStateReaderAdapter(getStore func() *state.Store) *StateReaderAdapter {
	return &StateReaderAdapter{getStore: getStore}
}

func (a *StateReaderAdapter) GetServices() []state.ServiceSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetServices()
	}
	return nil
}

func (a *StateReaderAdapter) GetService(key string) *state.ServiceSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetService(key)
	}
	return nil
}

func (a *StateReaderAdapter) GetSummary() state.SummaryStats {
	if store := a.getStore(); store != nil {
		return store.GetSummary()
	}
	return state.SummaryStats{}
}

func (a *StateReaderAdapter) GetFiltered() []state.ForwardSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetFiltered()
	}
	return nil
}

func (a *StateReaderAdapter) GetForward(key string) *state.ForwardSnapshot {
	if store := a.getStore(); store != nil {
		return store.GetForward(key)
	}
	return nil
}

func (a *StateReaderAdapter) GetLogs(count int) []state.LogEntry {
	if store := a.getStore(); store != nil {
		return store.GetLogs(count)
	}
	return nil
}

func (a *StateReaderAdapter) Count() int {
	if store := a.getStore(); store != nil {
		return store.Count()
	}
	return 0
}

func (a *StateReaderAdapter) ServiceCount() int {
	if store := a.getStore(); store != nil {
		return store.ServiceCount()
	}
	return 0
}

// MetricsProviderAdapter adapts fwdmetrics.Registry to the MetricsProvider interface
type MetricsProviderAdapter struct {
	registry *fwdmetrics.Registry
}

// NewMetricsProviderAdapter creates a new MetricsProviderAdapter
func NewMetricsProviderAdapter(registry *fwdmetrics.Registry) *MetricsProviderAdapter {
	return &MetricsProviderAdapter{registry: registry}
}

func (a *MetricsProviderAdapter) GetAllSnapshots() []fwdmetrics.ServiceSnapshot {
	if a.registry != nil {
		return a.registry.GetAllSnapshots()
	}
	return nil
}

func (a *MetricsProviderAdapter) GetServiceSnapshot(key string) *fwdmetrics.ServiceSnapshot {
	if a.registry != nil {
		return a.registry.GetServiceSnapshot(key)
	}
	return nil
}

func (a *MetricsProviderAdapter) GetTotals() (bytesIn, bytesOut uint64, rateIn, rateOut float64) {
	if a.registry != nil {
		return a.registry.GetTotals()
	}
	return 0, 0, 0, 0
}

func (a *MetricsProviderAdapter) ServiceCount() int {
	if a.registry != nil {
		return a.registry.ServiceCount()
	}
	return 0
}

func (a *MetricsProviderAdapter) PortForwardCount() int {
	if a.registry != nil {
		return a.registry.PortForwardCount()
	}
	return 0
}

// ServiceControllerAdapter adapts fwdsvcregistry to the ServiceController interface
type ServiceControllerAdapter struct {
	getStore func() *state.Store
}

// NewServiceControllerAdapter creates a new ServiceControllerAdapter
func NewServiceControllerAdapter(getStore func() *state.Store) *ServiceControllerAdapter {
	return &ServiceControllerAdapter{getStore: getStore}
}

func (a *ServiceControllerAdapter) Reconnect(key string) error {
	svc := fwdsvcregistry.Get(key)
	if svc == nil {
		return fmt.Errorf("service not found: %s", key)
	}
	go svc.ForceReconnect()
	return nil
}

func (a *ServiceControllerAdapter) ReconnectAll() int {
	store := a.getStore()
	if store == nil {
		return 0
	}

	forwards := store.GetFiltered()

	// Collect unique registry keys with errors
	erroredServices := make(map[string]bool)
	for _, fwd := range forwards {
		if fwd.Status == state.StatusError {
			key := fwd.RegistryKey
			if key == "" {
				key = fwd.ServiceKey
			}
			erroredServices[key] = true
		}
	}

	// Trigger reconnection for each errored service
	count := 0
	for registryKey := range erroredServices {
		if svcfwd := fwdsvcregistry.Get(registryKey); svcfwd != nil {
			go svcfwd.ForceReconnect()
			count++
		}
	}

	return count
}

func (a *ServiceControllerAdapter) Sync(key string, force bool) error {
	svc := fwdsvcregistry.Get(key)
	if svc == nil {
		return fmt.Errorf("service not found: %s", key)
	}
	go svc.SyncPodForwards(force)
	return nil
}

// EventStreamerAdapter adapts events.Bus to the EventStreamer interface
type EventStreamerAdapter struct {
	getEventBus func() *events.Bus
	subscribers map[<-chan events.Event]func()
	mu          sync.Mutex
}

// NewEventStreamerAdapter creates a new EventStreamerAdapter
func NewEventStreamerAdapter(getEventBus func() *events.Bus) *EventStreamerAdapter {
	return &EventStreamerAdapter{
		getEventBus: getEventBus,
		subscribers: make(map[<-chan events.Event]func()),
	}
}

func (a *EventStreamerAdapter) Subscribe() (<-chan events.Event, func()) {
	bus := a.getEventBus()
	if bus == nil {
		// Return a closed channel if bus is not available
		ch := make(chan events.Event)
		close(ch)
		return ch, func() {}
	}

	ch := make(chan events.Event, 100)

	// Subscribe to all events from the bus
	bus.SubscribeAll(func(e events.Event) {
		select {
		case ch <- e:
		default:
			// Buffer full, drop event
		}
	})

	a.mu.Lock()
	cancel := func() {
		a.mu.Lock()
		delete(a.subscribers, ch)
		a.mu.Unlock()
		close(ch)
	}
	a.subscribers[ch] = cancel
	a.mu.Unlock()

	return ch, cancel
}

func (a *EventStreamerAdapter) SubscribeType(eventType events.EventType) (<-chan events.Event, func()) {
	bus := a.getEventBus()
	if bus == nil {
		// Return a closed channel if bus is not available
		ch := make(chan events.Event)
		close(ch)
		return ch, func() {}
	}

	ch := make(chan events.Event, 100)

	// Subscribe to specific event type
	bus.Subscribe(eventType, func(e events.Event) {
		select {
		case ch <- e:
		default:
			// Buffer full, drop event
		}
	})

	a.mu.Lock()
	cancel := func() {
		a.mu.Lock()
		delete(a.subscribers, ch)
		a.mu.Unlock()
		close(ch)
	}
	a.subscribers[ch] = cancel
	a.mu.Unlock()

	return ch, cancel
}

// DiagnosticsProviderAdapter provides diagnostic information
type DiagnosticsProviderAdapter struct {
	getStore   func() *state.Store
	getManager func() types.ManagerInfo
}

// NewDiagnosticsProviderAdapter creates a new DiagnosticsProviderAdapter
func NewDiagnosticsProviderAdapter(getStore func() *state.Store, getManager func() types.ManagerInfo) *DiagnosticsProviderAdapter {
	return &DiagnosticsProviderAdapter{
		getStore:   getStore,
		getManager: getManager,
	}
}

func (a *DiagnosticsProviderAdapter) GetSummary() types.DiagnosticSummary {
	store := a.getStore()
	if store == nil {
		return types.DiagnosticSummary{
			Status:    "unknown",
			Timestamp: time.Now(),
		}
	}

	summary := store.GetSummary()
	services := store.GetServices()

	// Calculate service counts by status
	var active, errored, partial, pending int
	for _, svc := range services {
		switch {
		case svc.ActiveCount > 0 && svc.ErrorCount == 0:
			active++
		case svc.ErrorCount > 0 && svc.ActiveCount == 0:
			errored++
		case svc.ErrorCount > 0 && svc.ActiveCount > 0:
			partial++
		default:
			pending++
		}
	}

	// Determine overall status
	status := "healthy"
	if summary.ErrorCount > 0 {
		status = "degraded"
		if summary.ErrorCount > summary.ActiveServices {
			status = "unhealthy"
		}
	}

	uptime := ""
	version := ""
	if manager := a.getManager(); manager != nil {
		uptime = manager.Uptime().String()
		version = manager.Version()
	}

	// Collect current errors
	errors := a.GetErrors(10)

	// Generate recommendations
	var recommendations []string
	if errored > 0 {
		recommendations = appe
```

### Core Architecture Module: `pkg/fwdapi/handlers/analyze.go`
```
package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdtui/state"
)

// AnalyzeHandler handles AI-optimized analysis endpoints
type AnalyzeHandler struct {
	stateReader    types.StateReader
	diagnostics    types.DiagnosticsProvider
	getManagerInfo func() types.ManagerInfo
}

// NewAnalyzeHandler creates a new analyze handler
func NewAnalyzeHandler(stateReader types.StateReader, diagnostics types.DiagnosticsProvider, getManagerInfo func() types.ManagerInfo) *AnalyzeHandler {
	return &AnalyzeHandler{
		stateReader:    stateReader,
		diagnostics:    diagnostics,
		getManagerInfo: getManagerInfo,
	}
}

// StatusResponse is a quick AI-friendly status
type StatusResponse struct {
	Status     string `json:"status"`     // "ok", "issues", "error"
	Message    string `json:"message"`    // Human-readable summary
	ErrorCount int    `json:"errorCount"` // Number of current errors
	Uptime     string `json:"uptime,omitempty"`
}

// Status returns a quick status for AI consumption
// GET /v1/status
func (h *AnalyzeHandler) Status(c *gin.Context) {
	if h.stateReader == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "State reader not available",
			},
		})
		return
	}

	summary := h.stateReader.GetSummary()

	status := "ok"
	var message string

	switch {
	case summary.ErrorCount == 0 && summary.ActiveServices > 0:
		message = fmt.Sprintf("All %d services healthy, %d active forwards",
			summary.ActiveServices, summary.ActiveForwards)
	case summary.ErrorCount > 0 && summary.ActiveServices > summary.ErrorCount:
		status = "issues"
		message = fmt.Sprintf("%d of %d services have issues, %d errors",
			summary.ErrorCount, summary.TotalServices, summary.ErrorCount)
	case summary.ErrorCount > 0:
		status = "error"
		message = fmt.Sprintf("%d services with errors, only %d active",
			summary.ErrorCount, summary.ActiveServices)
	default:
		message = "No services currently forwarded"
	}

	uptime := ""
	if h.getManagerInfo != nil {
		if mgr := h.getManagerInfo(); mgr != nil {
			uptime = mgr.Uptime().Round(time.Second).String()
		}
	}

	response := StatusResponse{
		Status:     status,
		Message:    message,
		ErrorCount: summary.ErrorCount,
		Uptime:     uptime,
	}

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    response,
		Meta: &types.MetaInfo{
			Timestamp: time.Now(),
		},
	})
}

// AnalysisResponse provides full analysis for AI
type AnalysisResponse struct {
	Status           string             `json:"status"`
	Summary          string             `json:"summary"`
	Issues           []Issue            `json:"issues,omitempty"`
	Recommendations  []Recommendation   `json:"recommendations,omitempty"`
	SuggestedActions []ActionSuggestion `json:"suggestedActions,omitempty"`
	Stats            AnalysisStats      `json:"stats"`
}

// Issue represents a detected problem
type Issue struct {
	Severity   string `json:"severity"`  // "critical", "high", "medium", "low"
	Component  string `json:"component"` // "service", "forward", "network"
	ServiceKey string `json:"serviceKey,omitempty"`
	PodName    string `json:"podName,omitempty"`
	Message    string `json:"message"`
	ErrorType  string `json:"errorType,omitempty"`
}

// Recommendation provides actionable advice
type Recommendation struct {
	Priority string `json:"priority"` // "high", "medium", "low"
	Category string `json:"category"` // "performance", "reliability", "configuration"
	Message  string `json:"message"`
}

// ActionSuggestion provides API actions to fix issues
type ActionSuggestion struct {
	Action   string `json:"action"` // "reconnect", "sync", "reconnect_all"
	Target   string `json:"target"` // service key or "all"
	Reason   string `json:"reason"`
	Endpoint string `json:"endpoint"` // POST /v1/services/:key/reconnect
	Method   string `json:"method"`   // POST
}

// AnalysisStats provides statistics
type AnalysisStats struct {
	TotalServices   int    `json:"totalServices"`
	ActiveServices  int    `json:"activeServices"`
	ErroredServices int    `json:"erroredServices"`
	TotalForwards   int    `json:"totalForwards"`
	ActiveForwards  int    `json:"activeForwards"`
	TotalBytesIn    uint64 `json:"totalBytesIn"`
	TotalBytesOut   uint64 `json:"totalBytesOut"`
	Uptime          string `json:"uptime,omitempty"`
}

// errorClassification holds error type and severity
type errorClassification struct {
	errorType string
	severity  string
}

// classifyError classifies an error message into type and severity
func classifyError(errMsg string) errorClassification {
	errLower := strings.ToLower(errMsg)
	switch {
	case strings.Contains(errLower, "connection refused"):
		return errorClassification{"connection_refused", "high"}
	case strings.Contains(errLower, "timeout"):
		return errorClassification{"timeout", "high"}
	case strings.Contains(errLower, "not found"):
		return errorClassification{"pod_not_found", "critical"}
	case strings.Contains(errLower, "broken pipe"):
		return errorClassification{"broken_pipe", "high"}
	default:
		return errorClassification{"unknown", "high"}
	}
}

// buildIssues collects issues from services
func (h *AnalyzeHandler) buildIssues(services []state.ServiceSnapshot) ([]Issue, []string, map[string]int) {
	var issues []Issue
	var erroredServiceKeys []string
	errorTypes := make(map[string]int)

	for _, svc := range services {
		if svc.ErrorCount == 0 {
			continue
		}
		erroredServiceKeys = append(erroredServiceKeys, svc.Key)
		for _, fwd := range svc.PortForwards {
			if fwd.Error == "" {
				continue
			}
			class := classifyError(fwd.Error)
			errorTypes[class.errorType]++
			issues = append(issues, Issue{
				Severity:   class.severity,
				Component:  "forward",
				ServiceKey: svc.Key,
				PodName:    fwd.PodName,
				Message:    fwd.Error,
				ErrorType:  class.errorType,
			})
		}
	}
	return issues, erroredServiceKeys, errorTypes
}

// buildRecommendations generates recommendations based on error analysis
func buildRecommendations(erroredCount int, errorTypes map[string]int, noTraffic bool) []Recommendation {
	var recs []Recommendation

	if erroredCount > 3 {
		recs = append(recs, Recommendation{
			Priority: "high",
			Category: "reliability",
			Message:  fmt.Sprintf("Multiple services (%d) have errors. Consider using reconnect_all to attempt bulk recovery.", erroredCount),
		})
	}
	if errorTypes["pod_not_found"] > 0 {
		recs = append(recs, Recommendation{
			Priority: "high",
			Category: "reliability",
			Message:  "Some pods are missing. Use sync to rediscover pods or check if deployments are healthy.",
		})
	}
	if errorTypes["connection_refused"] > 0 {
		recs = append(recs, Recommendation{
			Priority: "medium",
			Category: "reliability",
			Message:  "Connection refused errors indicate pods may not be ready. Check readiness probes and pod logs.",
		})
	}
	if errorTypes["timeout"] > 0 {
		recs = append(recs, Recommendation{
			Priority: "medium",
			Category: "configuration",
			Message:  "Timeout errors may indicate network policies blocking traffic. Review network policies.",
		})
	}
	if noTraffic {
		recs = append(recs, Recommendation{
			Priority: "low",
			Category: "performance",
			Message:  "No traffic detected. Verify applications are sending requests through forwarded services.",
		})
	}
	return recs
}

// buildActions generates suggested actions based on issues
func buildActions(erroredServiceKeys []string, issues []Issue) []ActionSuggestion {
	var actions []ActionSuggestion

	if len(erroredServiceKeys) > 5 {
		actions = append(actions, ActionSuggestion{
			Action:   "reconnect_all",
			Target:   "all",
			Reason:   fmt.Sprintf("Bulk reconnect %d errored services", len(erroredServiceKeys)),
			Endpoint: "/v1/services/reconnect",
			Method:   "POST",
		})
	} else {
		for _, key := range erroredServiceKeys {
			actions = append(actions, ActionSuggestio
```

### Core Architecture Module: `pkg/fwdapi/handlers/diagnostics.go`
```
package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
)

// DiagnosticsHandler handles diagnostic-related endpoints
type DiagnosticsHandler struct {
	diagnostics types.DiagnosticsProvider
}

// NewDiagnosticsHandler creates a new diagnostics handler
func NewDiagnosticsHandler(diagnostics types.DiagnosticsProvider) *DiagnosticsHandler {
	return &DiagnosticsHandler{
		diagnostics: diagnostics,
	}
}

// Summary returns system-wide diagnostics
// GET /v1/diagnostics
func (h *DiagnosticsHandler) Summary(c *gin.Context) {
	if h.diagnostics == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "Diagnostics provider not available",
			},
		})
		return
	}

	summary := h.diagnostics.GetSummary()

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    summary,
		Meta: &types.MetaInfo{
			Timestamp: time.Now(),
		},
	})
}

// ServiceDiagnostic returns diagnostics for a specific service
// GET /v1/diagnostics/services/:key
func (h *DiagnosticsHandler) ServiceDiagnostic(c *gin.Context) {
	if h.diagnostics == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "Diagnostics provider not available",
			},
		})
		return
	}

	key := c.Param("key")
	diag, err := h.diagnostics.GetServiceDiagnostic(key)

	if err != nil {
		c.JSON(http.StatusNotFound, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_FOUND",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    diag,
		Meta: &types.MetaInfo{
			Timestamp: time.Now(),
		},
	})
}

// ForwardDiagnostic returns diagnostics for a specific forward
// GET /v1/diagnostics/forwards/:key
func (h *DiagnosticsHandler) ForwardDiagnostic(c *gin.Context) {
	if h.diagnostics == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "Diagnostics provider not available",
			},
		})
		return
	}

	key := c.Param("key")
	diag, err := h.diagnostics.GetForwardDiagnostic(key)

	if err != nil {
		c.JSON(http.StatusNotFound, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_FOUND",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    diag,
		Meta: &types.MetaInfo{
			Timestamp: time.Now(),
		},
	})
}

// Network returns network diagnostics
// GET /v1/diagnostics/network
func (h *DiagnosticsHandler) Network(c *gin.Context) {
	if h.diagnostics == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "Diagnostics provider not available",
			},
		})
		return
	}

	network := h.diagnostics.GetNetworkStatus()

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    network,
		Meta: &types.MetaInfo{
			Timestamp: time.Now(),
		},
	})
}

// Errors returns recent errors
// GET /v1/diagnostics/errors?count=50
func (h *DiagnosticsHandler) Errors(c *gin.Context) {
	if h.diagnostics == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "Diagnostics provider not available",
			},
		})
		return
	}

	countStr := c.DefaultQuery("count", "50")
	count, err := strconv.Atoi(countStr)
	if err != nil || count < 1 {
		count = 50
	}
	if count > 500 {
		count = 500
	}

	errors := h.diagnostics.GetErrors(count)

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    errors,
		Meta: &types.MetaInfo{
			Count:     len(errors),
			Timestamp: time.Now(),
		},
	})
}

```

### Core Architecture Module: `pkg/fwdapi/handlers/events.go`
```
package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdtui/events"
)

// EventsHandler handles event streaming endpoints
type EventsHandler struct {
	streamer types.EventStreamer
}

// NewEventsHandler creates a new events handler
func NewEventsHandler(streamer types.EventStreamer) *EventsHandler {
	return &EventsHandler{
		streamer: streamer,
	}
}

// Stream provides Server-Sent Events for real-time event updates
func (h *EventsHandler) Stream(c *gin.Context) {
	if h.streamer == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "Event streamer not available",
			},
		})
		return
	}

	// Get optional event type filter
	eventTypeFilter := c.Query("type")

	// Subscribe to events
	var eventCh <-chan events.Event
	var cancel func()

	if eventTypeFilter != "" {
		eventType := parseEventType(eventTypeFilter)
		eventCh, cancel = h.streamer.SubscribeType(eventType)
	} else {
		eventCh, cancel = h.streamer.Subscribe()
	}
	defer cancel()

	// Check if channel is already closed (indicates no event bus available)
	select {
	case _, ok := <-eventCh:
		if !ok {
			c.JSON(http.StatusServiceUnavailable, types.Response{
				Success: false,
				Error: &types.ErrorInfo{
					Code:    "EVENT_BUS_UNAVAILABLE",
					Message: "Event bus not initialized",
				},
			})
			return
		}
		// If we received an event, we need to handle it - but this shouldn't happen
		// since we haven't set up the stream yet
	default:
		// Channel is open and ready, continue
	}

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering

	// Send initial comment to flush headers and confirm connection
	_, _ = c.Writer.WriteString(": connected\n\n")
	c.Writer.Flush()

	// Send keepalive every 30 seconds
	keepalive := time.NewTicker(30 * time.Second)
	defer keepalive.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case event, ok := <-eventCh:
			if !ok {
				return false
			}
			data := mapEventToResponse(event)
			jsonData, err := json.Marshal(data)
			if err != nil {
				return true // Skip malformed events
			}
			_, _ = fmt.Fprintf(w, "event: %s\n", event.Type.String())
			_, _ = fmt.Fprintf(w, "data: %s\n\n", jsonData)
			return true

		case <-keepalive.C:
			_, _ = fmt.Fprintf(w, ": keepalive\n\n")
			return true

		case <-c.Request.Context().Done():
			return false
		}
	})
}

// mapEventToResponse converts an event to an API response
func mapEventToResponse(e events.Event) types.EventResponse {
	data := map[string]interface{}{
		"serviceKey": e.ServiceKey,
		"service":    e.Service,
		"namespace":  e.Namespace,
		"context":    e.Context,
	}

	if e.RegistryKey != "" {
		data["registryKey"] = e.RegistryKey
	}
	if e.PodName != "" {
		data["podName"] = e.PodName
	}
	if e.ContainerName != "" {
		data["containerName"] = e.ContainerName
	}
	if e.LocalIP != "" {
		data["localIP"] = e.LocalIP
	}
	if e.LocalPort != "" {
		data["localPort"] = e.LocalPort
	}
	if e.PodPort != "" {
		data["podPort"] = e.PodPort
	}
	if len(e.Hostnames) > 0 {
		data["hostnames"] = e.Hostnames
	}
	if e.Status != "" {
		data["status"] = e.Status
	}
	if e.Error != nil {
		data["error"] = e.Error.Error()
	}
	if e.BytesIn > 0 || e.BytesOut > 0 {
		data["bytesIn"] = e.BytesIn
		data["bytesOut"] = e.BytesOut
	}
	if e.RateIn > 0 || e.RateOut > 0 {
		data["rateIn"] = e.RateIn
		data["rateOut"] = e.RateOut
	}

	return types.EventResponse{
		Type:      e.Type.String(),
		Timestamp: e.Timestamp,
		Data:      data,
	}
}

// parseEventType converts a string to an EventType
func parseEventType(s string) events.EventType {
	switch s {
	case "ServiceAdded":
		return events.ServiceAdded
	case "ServiceRemoved":
		return events.ServiceRemoved
	case "ServiceUpdated":
		return events.ServiceUpdated
	case "PodAdded":
		return events.PodAdded
	case "PodRemoved":
		return events.PodRemoved
	case "PodStatusChanged":
		return events.PodStatusChanged
	case "BandwidthUpdate":
		return events.BandwidthUpdate
	case "LogMessage":
		return events.LogMessage
	case "ShutdownStarted":
		return events.ShutdownStarted
	case "ShutdownComplete":
		return events.ShutdownComplete
	default:
		// Return PodStatusChanged as default for unknown types
		return events.PodStatusChanged
	}
}

```

### Core Architecture Module: `pkg/fwdapi/handlers/forwards.go`
```
package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/txn2/kubefwd/pkg/fwdapi/types"
	"github.com/txn2/kubefwd/pkg/fwdtui/state"
)

// ForwardsHandler handles port forward-related endpoints
type ForwardsHandler struct {
	state types.StateReader
}

// NewForwardsHandler creates a new forwards handler
func NewForwardsHandler(stateReader types.StateReader) *ForwardsHandler {
	return &ForwardsHandler{
		state: stateReader,
	}
}

// List returns all port forwards
// Supports query parameters: limit, offset, status, namespace, context, search
func (h *ForwardsHandler) List(c *gin.Context) {
	if h.state == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "State store not available",
			},
		})
		return
	}

	// Parse query parameters
	var params types.ListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		// Ignore binding errors, use defaults
		params = types.ListParams{}
	}

	// Set defaults
	if params.Limit <= 0 || params.Limit > 1000 {
		params.Limit = 100
	}

	forwards := h.state.GetFiltered()
	summary := h.state.GetSummary()

	// Apply filters
	filtered := filterForwards(forwards, params)

	// Apply pagination
	start := params.Offset
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + params.Limit
	if end > len(filtered) {
		end = len(filtered)
	}
	paged := filtered[start:end]

	response := types.ForwardListResponse{
		Forwards: make([]types.ForwardResponse, len(paged)),
		Summary:  mapSummary(summary),
	}

	for i, fwd := range paged {
		response.Forwards[i] = mapForwardSnapshot(fwd)
	}

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    response,
		Meta: &types.MetaInfo{
			Count:     len(paged),
			Timestamp: time.Now(),
		},
	})
}

// forwardMatchesSearch checks if a forward matches the search term (case-insensitive)
func forwardMatchesSearch(fwd *state.ForwardSnapshot, search string) bool {
	searchLower := strings.ToLower(search)
	return strings.Contains(strings.ToLower(fwd.ServiceName), searchLower) ||
		strings.Contains(strings.ToLower(fwd.PodName), searchLower) ||
		strings.Contains(strings.ToLower(fwd.Namespace), searchLower) ||
		strings.Contains(strings.ToLower(fwd.Context), searchLower)
}

// forwardMatchesFilters checks if a forward matches all filter criteria
func forwardMatchesFilters(fwd *state.ForwardSnapshot, params types.ListParams) bool {
	if params.Status != "" && strings.ToLower(fwd.Status.String()) != params.Status {
		return false
	}
	if params.Namespace != "" && fwd.Namespace != params.Namespace {
		return false
	}
	if params.Context != "" && fwd.Context != params.Context {
		return false
	}
	if params.Search != "" && !forwardMatchesSearch(fwd, params.Search) {
		return false
	}
	return true
}

// filterForwards applies query parameter filters to forwards
func filterForwards(forwards []state.ForwardSnapshot, params types.ListParams) []state.ForwardSnapshot {
	if params.Status == "" && params.Namespace == "" && params.Context == "" && params.Search == "" {
		return forwards
	}

	result := make([]state.ForwardSnapshot, 0, len(forwards))
	for i := range forwards {
		if forwardMatchesFilters(&forwards[i], params) {
			result = append(result, forwards[i])
		}
	}
	return result
}

// Get returns a single forward by key
func (h *ForwardsHandler) Get(c *gin.Context) {
	if h.state == nil {
		c.JSON(http.StatusServiceUnavailable, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_READY",
				Message: "State store not available",
			},
		})
		return
	}

	key := c.Param("key")
	fwd := h.state.GetForward(key)

	if fwd == nil {
		c.JSON(http.StatusNotFound, types.Response{
			Success: false,
			Error: &types.ErrorInfo{
				Code:    "NOT_FOUND",
				Message: "Forward not found: " + key,
			},
		})
		return
	}

	c.JSON(http.StatusOK, types.Response{
		Success: true,
		Data:    mapForwardSnapshot(*fwd),
		Meta: &types.MetaInfo{
			Timestamp: time.Now(),
		},
	})
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #509** (2026-05-29): **Auto-reconnect leaves multi-port services in unrecoverable zombie state after TCP RST**
  *Symptoms*: ### kubefwd version  1.25.14  ### Kubernetes version  Client: v1.34.2, Server: Client: v1.34.2  ### Operating System  macOS (Apple Silicon)  ### Bug Description  **Expected behavior:**   When a port-forwarded service experiences a TCP RST on one of its ports (e.g., due to [kubernetes/kubernetes#111825](https://github.com/kubernetes/kubernetes/issues/111825) in kubectl 1.23.6+), kubefwd's auto-reconnect (`-a`) should re-establish forwards for all of the service's ports, restore `/etc/hosts` entries, and return the service to a healthy, traffic-flowing state — without requiring a kubefwd process restart.   **Actual behavior:**   Multi-port services enter an **unrecoverable zombie state** after one port's connection is reset. Specifically:   1. RST on one port causes the underlying kubelet port-forward listener to die (upstream bug [kubernetes/kubernetes#111825](https://github.com/kubernetes/kubernetes/issues/111825), still unfixed in client v1.34.2). 2. The corresponding goroutine in `LoopPodsToForward` logs `PortForward error ... lost connection to pod` and cleans up only its own entry from the `PortForwards` map. The other port's entry remains. 3. All `/etc/hosts` entries for the service are removed by the per-port disconnect cleanup (12 hostname variants in my case). 4. `scheduleReconnect` fires, waits the backoff, calls `SyncPodForwards(true)` — logs show `currentForwards=1, Found 1 eligible pods`. 5. `LoopPodsToForward` skips creating new forwards because of the stale map 

- **Issue #390** (2026-02-04): **Connecting to Wireguard DNS is broken since 1.23.0**
  *Symptoms*: ### kubefwd version  1.25.9  ### Kubernetes version  Client Version: v1.34.1 Kustomize Version: v5.7.1 Server Version: v1.34.3+k3s1  ### Operating System  Windows  ### Bug Description  My Kubernetes Cluster is behind a Wireguard VPN with a custom DNS configured in the Wireguard config. On Version 1.22.4, everything is working as expected.   After upgrading to any version past that (1.23.0+), I can no longer connect to my cluster. I would assume this project started doing some DNS server gymnastics instead of looking up naming properly like any other software does.  The error message shows the IP of my normal DNS server (that's listed under my normal network interface) (10.251.137.88:53) instead of the WireGuard one, so I think that should confirm my theory.   Tools like kubectl work just fine.  ### Steps to Reproduce  - Be on Windows - Have Wireguard VPN connected with a custom DNS server configured - Try to connect - Fail.  ### Verbose Logs  ```shell kubefwd svc -n redacted-dev -v INFO[14:16:16]  _          _           __             _ INFO[14:16:16] | | ___   _| |__   ___ / _|_      ____| | INFO[14:16:16] | |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  | INFO[14:16:16] |   <| |_| | |_) |  __/  _|\ V  V / (_| | INFO[14:16:16] |_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_| INFO[14:16:16] INFO[14:16:16] Version 1.25.9 INFO[14:16:16] https://kubefwd.com INFO[14:16:16] INFO[14:16:16] Press [Ctrl-C] to stop forwarding. INFO[14:16:16] 'cat C:\Windows\System32\drivers\etc\hosts' to see all host
  **Post-Mortem & Fix Analysis**:
  > Just saw that 1.23.0 disabled CGO, I think that might be the problem
  > Building a binary with: set CGO_ENABLED=1 go build -o kubefwd.exe ./cmd/kubefwd/kubefwd.go  works again
  > @davidmayr,   Good catch on the CGO connection. However, a few clarifications, kubefwd doesn't do DNS lookups for the services it forwards, it writes `/etc/hosts` entries, that's its central feature.   > I would assume this project started doing some DNS server gymnastics instead of looking up naming properly like any other software does.  The DNS lookup in your error is the Kubernetes client library resolving your cluster's API server hostname. So this affects connecting to the cluster, not the service forwarding.  You're right that CGO is the factor, but I've been building with `CGO_ENABLED=0` since 2020 for static binaries.  **What changed in v1.23.0 was the Go version from 1.18 to 1.24.**  Go's pure-Go DNS resolver (used when CGO is disabled) behaves differently in newer versions on Windows. It doesn't respect per-adapter DNS settings like VPN-specific DNS servers. It takes a simplified lookup path that bypasses Windows DNS routing rules.  Another quick workaround is to use the IP 

- **Issue #325** (2025-12-28): **kubefwd_checksums.txt.pem asset missing**
  *Symptoms*: ### kubefwd version  N/A  ### Kubernetes version  N/A  ### Operating System  Linux (Ubuntu/Debian)  ### Bug Description  From https://github.com/txn2/kubefwd/releases/tag/v1.24.0  > All release checksums are now signed using Cosign with keyless signing (OIDC identity). Users can verify downloads: > ``` >cosign verify-blob --signature kubefwd_checksums.txt.sig \ >  --certificate kubefwd_checksums.txt.pem \ >  --certificate-oidc-issuer https://token.actions.githubusercontent.com \ >  --certificate-identity-regexp 'https://github.com/txn2/kubefwd/.*' \ >  kubefwd_checksums.txt >```  I'm not sure where to find `kubefwd_checksums.txt.pem` though, it is not in release assets. The .sig is there.  ### Steps to Reproduce  https://github.com/txn2/kubefwd/releases/tag/v1.24.0  ### Verbose Logs  ```shell  ```  ### Configuration  ```yaml  ```  ### Checklist  - [x] I have searched existing issues to ensure this bug hasn't already been reported - [ ] I am running kubefwd with `sudo -E` to preserve environment variables
  **Post-Mortem & Fix Analysis**:
  > @scop thanks! Fixed and released https://github.com/txn2/kubefwd/releases/tag/v1.24.1

- **Issue #278** (2025-12-20): **Panic: index out of range**
  *Symptoms*: Hi! I got an unusual error today: ``` ... INFO[18:23:30] Port-Forward:      127.1.28.46 kafka-cluster-kafka-external-bootstrap.project-staging:9094 to pod kafka-cluster-kafka-0:9094 panic: runtime error: index out of range [116] with length 116  goroutine 494 [running]: github.com/txn2/txeh.(*Hosts).AddHost(0x14000695950, {0x140003f8f10, 0xa}, {0x140002dec80?, 0x140005e9b48?})  github.com/txn2/txeh@v1.3.0/txeh.go:235 +0x500 github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).addHost(0x140005f5080, {0x140002dec80, 0x40})  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:252 +0x11c github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).addHost(0x140005f5080, {0x140002dea00, 0x40})  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:256 +0x164 github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).AddHosts(0x140005f5080)  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:306 +0x2ac github.com/txn2/kubefwd/pkg/fwdport.(*PortForwardOpts).PortForward(0x140005f5080)  github.com/txn2/kubefwd/pkg/fwdport/fwdport.go:160 +0x284 github.com/txn2/kubefwd/pkg/fwdservice.(*ServiceFWD).LoopPodsToForward.func1()  github.com/txn2/kubefwd/pkg/fwdservice/fwdservice.go:333 +0x38 created by github.com/txn2/kubefwd/pkg/fwdservice.(*ServiceFWD).LoopPodsToForward  github.com/txn2/kubefwd/pkg/fwdservice/fwdservice.go:331 +0xb14 ```  OS: ``` ProductName: macOS ProductVersion: 12.3 BuildVersion: 21E230 ```  `kubefwd version`: ``` ... INFO[19:04:36] Version 1.22.5 INFO[19:04:36
  **Post-Mortem & Fix Analysis**:
  > Show u are kube.yaml and some yaml configuation . 
  > This panic is occurring in the `txeh` library (v1.3.0) which kubefwd uses for hosts file management. kubefwd is currently using an outdated version of txeh from 2019.  Several bug fixes have been made to txeh since then, including fixes for parsing edge cases that likely cause this panic.  The fix is to update the txeh dependency from v1.3.0 to v1.5.4. I'll include this in an upcoming release.
  > Fixed in 5ee69c14737bb33d073e9ac74c586d80e3b51fb9 - upgraded txeh from v1.3.0 to v1.7.0 which includes the fix for this index out of range panic in AddHost.

- **Issue #213** (2025-12-19): **SIGSEGV when kubefwd is provided with malformed reserve parameter**
  *Symptoms*: When using the `-r` command line option, kubefwd will SIGSEGV if the reserve string is malformed - specifically if a parameter is provided, but the colon is omitted. It fails gracefully if the parameter is not provided, or if it is provided, but with an invalid ip address.   Reproduce with: `kubefwd svc -r foo`  ``` INFO[18:28:52]  _          _           __             _ INFO[18:28:52] | | ___   _| |__   ___ / _|_      ____| | INFO[18:28:52] | |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  | INFO[18:28:52] |   <| |_| | |_) |  __/  _|\ V  V / (_| | INFO[18:28:52] |_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_| INFO[18:28:52] INFO[18:28:52] Version 1.22.0 INFO[18:28:52] https://github.com/txn2/kubefwd INFO[18:28:52] INFO[18:28:52] Press [Ctrl-C] to stop forwarding. INFO[18:28:52] 'cat /etc/hosts' to see all host entries. INFO[18:28:52] Loaded hosts file /etc/hosts INFO[18:28:52] HostFile management: Original hosts backup already exists at /Users/<snip>/hosts.original INFO[18:28:52] Using namespace <...snip> from current context <...snip>. INFO[18:28:52] Successfully connected context: <...snip> panic: runtime error: invalid memory address or nil pointer dereference [signal SIGSEGV: segmentation violation code=0x1 addr=0x10 pc=0x1dbb177]  goroutine 97 [running]: github.com/txn2/kubefwd/pkg/fwdIp.blockNonLoopbackIPs(0x2c894c0) 	github.com/txn2/kubefwd/pkg/fwdIp/fwdIp.go:197 +0x97 github.com/txn2/kubefwd/pkg/fwdIp.validateForwardConfiguration(0x1f27880) 	github.com/tx
  **Post-Mortem & Fix Analysis**:
  > @mccaig looks like it needs a little more validation. Thanks for the report
  > Fixed in v1.23.0. This release includes improved error handling throughout the codebase:  - Invalid reservation formats now log a warning instead of crashing - Replaced `panic()` and `os.Exit()` calls with proper error returns - Added bounds checking for IP allocation  Malformed `-r` parameters will now fail gracefully with a helpful error message.  See release notes: https://github.com/txn2/kubefwd/releases/tag/v1.23.0

- **Issue #155** (2020-11-07): **`standard_init_linux.go:211: exec**
  *Symptoms*: Hi,  I'm getting  `standard_init_linux.go:211: exec user process caused "no such file or directory"`  trying to run `txn2/kubefwd`  what am I missing? 

- **Issue #136** (2020-09-02): **Problem using multiple clusters/contexts**
  *Symptoms*: When connecting to two clusters, e.g.  ``` sudo kubefwd services \        -n elasticsearch \        -n kubernetes-dashboard \        -n kube-system \        -n prometheus \        -l "k8s-app in (alertmanager,elasticsearch,grafana,kibana,kubernetes-dashboard,prometheus)" \        -x "staging" \        -x "production" ```  It seems to be assigning the same domain suffix to both contexts, and then failing to listen on the ports due to conflicts with itself:  ``` INFO[23:37:10]  _          _           __             _      INFO[23:37:10] | | ___   _| |__   ___ / _|_      ____| |     INFO[23:37:10] | |/ / | | | '_ \ / _ \ |_\ \ /\ / / _  |     INFO[23:37:10] |   <| |_| | |_) |  __/  _|\ V  V / (_| |     INFO[23:37:10] |_|\_\\__,_|_.__/ \___|_|   \_/\_/ \__,_|     INFO[23:37:10]                                               INFO[23:37:10] Version 1.14.0                                INFO[23:37:10] https://github.com/txn2/kubefwd               INFO[23:37:10]                                               INFO[23:37:10] Press [Ctrl-C] to stop forwarding.            INFO[23:37:10] 'cat /etc/hosts' to see all host entries.     INFO[23:37:10] Loaded hosts file /etc/hosts                  INFO[23:37:10] Hostfile management: Original hosts backup already exists at /home/ubuntu/hosts.original  INFO[23:37:10] Succesfully connected context: staging  INFO[23:37:10] Namespaces to forward: [elasticsearch formative kubernetes-dashboard kube-system prometheus yugaby
  **Post-Mortem & Fix Analysis**:
  > This feature broke after 1.7.4. I'll try to get fix in for a new release next month. 

- **Issue #133** (2020-10-27): **headless svc forwarding behaviour changed for sts with single pod**
  *Symptoms*: We noticed that kubefwd 14.x behaves differently for forwarding headless services forwarding to a single sts container  ``` apiVersion: v1 kind: Service metadata:   name: kafka-headless-svc spec:   ports:     - port: 9092       name: broker   clusterIP: None   selector:     app: kafka-sts ```  ``` apiVersion: apps/v1beta1 kind: StatefulSet metadata:   name: kafka-sts   labels:     app: kafka-sts spec:   serviceName: kafka-headless-svc   podManagementPolicy: OrderedReady   replicas: 1   updateStrategy:     type: RollingUpdate   template:     metadata:       labels:         app: kafka-sts     spec:       containers:       - name: kafka-sts         image: "confluentinc/cp-kafka:5.0.1"         imagePullPolicy: "IfNotPresent"         ports:         - containerPort: 9092           name: kafka                 env:         - name: POD_IP           valueFrom:             fieldRef:               fieldPath: status.podIP         - name: HOST_IP           valueFrom:             fieldRef:               fieldPath: status.hostIP         - name: "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP"           value: "PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT"             command:         - sh         - -exc         - |           export KAFKA_BROKER_ID=${HOSTNAME##*-}            export KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka-sts-${HOSTNAME##*-}.kafka-headless-svc:9092,EXTERNAL://${HOST_IP}:$((31090 + ${KAFKA_BROKER_ID})) && \           exec /etc/conf
  **Post-Mortem & Fix Analysis**:
  > This is a bug introduced in 1.14. The last few contributions have caused some issues I need to unwind. I am scheduling some time to work on this in the next two weeks.   Thank you for raising this issue.
  > fix in #134  @onmomo 
  > @calmkart @cjimti thanks a lot and keep it up!

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

### Incident Patch 1: `10533ebd` (2026-07-27)
**Commit Message**: security: bump x/text, x/net, x/crypto to clear remaining vulnerabilities (#563)

Follow-up to #560. Merging that PR completed the integration module's
go.sum, which had been a one-line stub. Dependabot could then see the
module's real transitive graph for the first time and raised 13 alerts
for golang.org/x/crypto v0.51.0 (patched in 0.52.0). The vulnerabilities
predated #560; the stub go.sum was hiding them from every scanner.

Root module:
  golang.org/x/text  v0.37.0 -> v0.39.0  (GO-2026-5970)
  golang.org/x/net   v0.55.0 -> v0.56.0  (GO-2026-5942)
  golang.org/x/crypto v0.52.0 -> v0.53.0
  golang.org/x/term  v0.43.0 -> v0.44.0  (pulled in by the above)

GO-2026-5970 is the only vulnerability in this cleanup that was actually
reachable from production code. govulncheck traced it to:

  pkg/fwdmcp/httpclient.go:156:26: fwdmcp.HTTPClient.Delete calls
  http.Client.Do, which eventually calls norm.Form.Bytes

Neither Dependabot nor the earlier docker/docker alerts surfaced it; it
came from the OSSF Scorecard code-scanning alert's vulnerability list.

test/integration module:
  golang.org/x/crypto v0.51.0 -> v0.53.0
  golang.org/x/sys    v0.45.0 -> v0.46.0

GO-2026-5932 (golang.org/

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -102,12 +102,12 @@ require (
 	go.yaml.in/yaml/v2 v2.4.3 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/arch v0.22.0 // indirect
-	golang.org/x/crypto v0.52.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/crypto v0.53.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.35.0 // indirect
 	golang.org/x/sync v0.21.0 // indirect
-	golang.org/x/term v0.43.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	golang.org/x/time v0.14.0 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
```

**File**: `go.sum` (modified, +12/-12)
```diff
@@ -236,14 +236,14 @@ go.yaml.in/yaml/v3 v3.0.4 h1:tfq32ie2Jv2UxXFdLJdh3jXuOzWiL1fo0bu/FbuKpbc=
 go.yaml.in/yaml/v3 v3.0.4/go.mod h1:DhzuOOF2ATzADvBadXxruRBLzYTpT36CKvDb3+aBEFg=
 golang.org/x/arch v0.22.0 h1:c/Zle32i5ttqRXjdLyyHZESLD/bB90DCU1g9l/0YBDI=
 golang.org/x/arch v0.22.0/go.mod h1:dNHoOeKiyja7GTvF9NJS1l3Z2yntpQNzgrjh1cU103A=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
+golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
 golang.org/x/exp v0.0.0-20231006140011-7918f672742d h1:jtJma62tbqLibJ5sFQz8bKtEM8rJBtfilJ2qTU199MI=
 golang.org/x/exp v0.0.0-20231006140011-7918f672742d/go.mod h1:ldy0pHrwJyGW56pPQzzkH36rKxoZW1tw7ZJpeKx+hdo=
-golang.org/x/mod v0.35.0 h1:Ww1D637e6Pg+Zb2KrWfHQUnH2dQRLBQyAtpr/haaJeM=
-golang.org/x/mod v0.35.0/go.mod h1:+GwiRhIInF8wPm+4AoT6L0FA1QWAad3OMdTRx4tFYlU=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.35.0 h1:Mv2mzuHuZuY2+bkyWXIHMfhNdJAdwW3FuWeCPYN5GVQ=
 golang.org/x/oauth2 v0.35.0/go.mod h1:lzm5WQJQwKZ3nwavOZ3IS5Aulzxi68dUSgRHujetwEA=
 golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
@@ -252,14 +252,14 @@ golang.org/x/sys v0.0.0-20210616094352-59db8d763f22/go.mod h1:oPkhp1MJrh7nUepCBc
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
 golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
-golang.org/x/text v0.37.0 h1:Cqjiwd9eSg8e0QAkyCaQTNHFIIzWtidPahFWR83rTrc=
-golang.org/x/text v0.37.0/go.mod h1:a5sjxXGs9hsn/AJVwuElvCAo9v8QYLzvavO5z2PiM38=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
+golang.org/x/text v0.39.0 h1:UbZz4pLOvn600D6Oh6GGEI6VAmndrEBLv8/6BEXzyus=
+golang.org/x/text v0.39.0/go.mod h1:3UwRclnC2g0TU9x8PZiyfOajCd1zaUNHF9cvqcQZ+ZM=
 golang.org/x/time v0.14.0 h1:MRx4UaLrDotUKUdCIqzPC48t1Y9hANFKIRpNx+Te8PI=
 golang.org/x/time v0.14.0/go.mod h1:eL/Oa2bBBK0TkX57Fyni+NgnyQQN4LitPmob2Hjnqw4=
-golang.org/x/tools v0.44.0 h1:UP4ajHPIcuMjT1GqzDWRlalUEoY+uzoZKnhOjbIPD2c=
-golang.org/x/tools v0.44.0/go.mod h1:KA0AfVErSdxRZIsOVipbv3rQhVXTnlU6UhKxHd1seDI=
+golang.org/x/tools v0.47.0 h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=
+golang.org/x/tools v0.47.0/go.mod h1:dFHnyTvFWY212G+h7ZY4Vsp/K3U4/7W9TyVaAul8uCA=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af h1:+5/Sw3GsDNlEmu7TfklWKPdQ0Ykja5VEmq2i817+jbI=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `test/integration/go.mod` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ require (
 	go.opentelemetry.io/otel v1.41.0 // indirect
 	go.opentelemetry.io/otel/metric v1.41.0 // indirect
 	go.opentelemetry.io/otel/trace v1.41.0 // indirect
-	golang.org/x/crypto v0.52.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
+	golang.org/x/crypto v0.53.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `test/integration/go.sum` (modified, +6/-6)
```diff
@@ -114,15 +114,15 @@ go.opentelemetry.io/otel/sdk/metric v1.35.0 h1:1RriWBmCKgkeHEhM7a2uMjMUfP7MsOF5J
 go.opentelemetry.io/otel/sdk/metric v1.35.0/go.mod h1:is6XYCUMpcKi+ZsOvfluY5YstFnhW0BidkR+gL+qN+w=
 go.opentelemetry.io/otel/trace v1.41.0 h1:Vbk2co6bhj8L59ZJ6/xFTskY+tGAbOnCtQGVVa9TIN0=
 go.opentelemetry.io/otel/trace v1.41.0/go.mod h1:U1NU4ULCoxeDKc09yCWdWe+3QoyweJcISEVa1RBzOis=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
+golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
 golang.org/x/sys v0.0.0-20190916202348-b4ddaad3f8a3/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20201204225414-ed752295db88/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210616094352-59db8d763f22/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
+golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c h1:Hei/4ADfdWqJk1ZMxUNpqntNwaWcugrBjAiHlqqRiVk=
```

---

### Incident Patch 2: `e779c0e6` (2026-07-24)
**Commit Message**: security: resolve all open Dependabot alerts (#560)

Five Go alerts (GHSA-rg2x-37c3-w2rh, GHSA-vp62-88p7-qqf5,
GHSA-x86f-5xw2-fm2r, GHSA-x744-4wpc-v9h2, GHSA-pxq6-2prw-chj9) all
flagged github.com/docker/docker in the test/integration module. That
module path is capped at v28.5.2+incompatible, so no patched release
exists on it -- the fixes landed under the renamed moby module paths.

testcontainers-go v0.42.0 dropped github.com/docker/docker in favor of
the github.com/moby/moby/api and /client submodules, which none of the
advisories cover. Bumping testcontainers-go to v0.43.0 and repointing
the container types import removes the flagged module from the graph
entirely.

Also drops the unused api/types/network import and fills in the
integration module's incomplete go.sum, which was missing entries for
every direct dependency -- `go vet -tags=integration ./...` failed to
build before this change and passes now.

Pygments 2.19.2 -> 2.20.0 in .github/requirements-docs.txt fixes the
ReDoS advisory (GHSA-5239-wwwm-4pmq). Hashes taken from PyPI and
verified with a --require-hashes install.

**File**: `.github/requirements-docs.txt` (modified, +3/-3)
```diff
@@ -287,9 +287,9 @@ platformdirs==4.5.1 \
     --hash=sha256:61d5cdcc6065745cdd94f0f878977f8de9437be93de97c1c12f853c9c0cdcbda \
     --hash=sha256:d03afa3963c806a9bed9d5125c8f4cb2fdaf74a55ab60e5d59b3fde758104d31
     # via mkdocs-get-deps
-pygments==2.19.2 \
-    --hash=sha256:636cb2477cec7f8952536970bc533bc43743542f70392ae026374600add5b887 \
-    --hash=sha256:86540386c03d588bb81d44bc3928634ff26449851e99741617ecb9037ee5ec0b
+pygments==2.20.0 \
+    --hash=sha256:6757cd03768053ff99f3039c1a36d6c0aa0b263438fcab17520b30a303a82b5f \
+    --hash=sha256:81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176
     # via mkdocs-material
 pymdown-extensions==10.21.3 \
     --hash=sha256:72cfcf55f07aea0d4af2c4f11dd4e52466ddfb1bb819673146398e0bd3a77354 \
```

**File**: `test/integration/container_helpers.go` (modified, +1/-2)
```diff
@@ -12,8 +12,7 @@ import (
 	"testing"
 	"time"
 
-	"github.com/docker/docker/api/types/container"
-	"github.com/docker/docker/api/types/network"
+	"github.com/moby/moby/api/types/container"
 	"github.com/testcontainers/testcontainers-go"
 	"github.com/testcontainers/testcontainers-go/wait"
 )
```

**File**: `test/integration/go.mod` (modified, +55/-3)
```diff
@@ -1,8 +1,60 @@
 module github.com/txn2/kubefwd/test/integration
 
-go 1.24.0
+go 1.25.0
 
 require (
-	github.com/docker/docker v28.5.1+incompatible
-	github.com/testcontainers/testcontainers-go v0.40.0
+	github.com/moby/moby/api v1.54.2
+	github.com/testcontainers/testcontainers-go v0.43.0
+)
+
+require (
+	dario.cat/mergo v1.0.2 // indirect
+	github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c // indirect
+	github.com/Microsoft/go-winio v0.6.2 // indirect
+	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
+	github.com/cespare/xxhash/v2 v2.3.0 // indirect
+	github.com/containerd/errdefs v1.0.0 // indirect
+	github.com/containerd/errdefs/pkg v0.3.0 // indirect
+	github.com/containerd/log v0.1.0 // indirect
+	github.com/containerd/platforms v0.2.1 // indirect
+	github.com/cpuguy83/dockercfg v0.3.2 // indirect
+	github.com/davecgh/go-spew v1.1.1 // indirect
+	github.com/distribution/reference v0.6.0 // indirect
+	github.com/docker/go-connections v0.6.0 // indirect
+	github.com/docker/go-units v0.5.0 // indirect
+	github.com/ebitengine/purego v0.10.0 // indirect
+	github.com/felixge/httpsnoop v1.0.4 // indirect
+	github.com/go-logr/logr v1.4.3 // indirect
+	github.com/go-logr/stdr v1.2.2 // indirect
+	github.com/go-ole/go-ole v1.2.6 // indirect
+	github.com/google/uuid v1.6.0 // indirect
+	github.com/klauspost/compress v1.18.5 // indirect
+	github.com/lufia/plan9stats v0.0.0-20211012122336-39d0f177ccd0 // indirect
+	github.com/magiconair/properties v1.8.10 // indirect
+	github.com/moby/docker-image-spec v1.3.1 // indirect
+	github.com/moby/go-archive v0.2.0 // indirect
+	github.com/moby/moby/client v0.4.0 // indirect
+	github.com/moby/patternmatcher v0.6.1 // indirect
+	github.com/moby/sys/sequential v0.6.0 // indirect
+	github.com/moby/sys/user v0.4.0 // indirect
+	github.com/moby/sys/userns v0.1.0 // indirect
+	github.com/moby/term v0.5.2 // indirect
+	github.com/opencontainers/go-digest v1.0.0 // indirect
+	github.com/opencontainers/image-spec v1.1.1 // indirect
+	github.com/pmezard/go-difflib v1.0.0 // indirect
+	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
+	github.com/shirou/gopsutil/v4 v4.26.5 // indirect
+	github.com/sirupsen/logrus v1.9.4 // indirect
+	github.com/stretchr/testify v1.11.1 // indirect
+	github.com/tklauser/go-sysconf v0.3.16 // indirect
+	github.com/tklauser/numcpus v0.11.0 // indirect
+	github.com/yusufpapurcu/wmi v1.2.4 // indirect
+	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
+	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.60.0 // indirect
+	go.opentelemetry.io/otel v1.41.0 // indirect
+	go.opentelemetry.io/otel/metric v1.41.0 // indirect
+	go.opentelemetry.io/otel/trace v1.41.0 // indirect
+	golang.org/x/crypto v0.51.0 // indirect
+	golang.org/x/sys v0.45.0 // indirect
+	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `test/integration/go.sum` (modified, +135/-2)
```diff
@@ -1,2 +1,135 @@
-github.com/docker/docker v28.5.1+incompatible/go.mod h1:eEKB0N0r5NX/I1kEveEz05bcu8tLC/8azJZsviup8Sk=
-github.com/testcontainers/testcontainers-go v0.40.0/go.mod h1:FSXV5KQtX2HAMlm7U3APNyLkkap35zNLxukw9oBi/MY=
+dario.cat/mergo v1.0.2 h1:85+piFYR1tMbRrLcDwR18y4UKJ3aH1Tbzi24VRW1TK8=
+dario.cat/mergo v1.0.2/go.mod h1:E/hbnu0NxMFBjpMIE34DRGLWqDy0g5FuKDhCb31ngxA=
+github.com/AdaLogics/go-fuzz-headers v0.0.0-20240806141605-e8a1dd7889d6 h1:He8afgbRMd7mFxO99hRNu+6tazq8nFF9lIwo9JFroBk=
+github.com/AdaLogics/go-fuzz-headers v0.0.0-20240806141605-e8a1dd7889d6/go.mod h1:8o94RPi1/7XTJvwPpRSzSUedZrtlirdB3r9Z20bi2f8=
+github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c h1:udKWzYgxTojEKWjV8V+WSxDXJ4NFATAsZjh8iIbsQIg=
+github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c/go.mod h1:xomTg63KZ2rFqZQzSB4Vz2SUXa1BpHTVz9L5PTmPC4E=
+github.com/Microsoft/go-winio v0.6.2 h1:F2VQgta7ecxGYO8k3ZZz3RS8fVIXVxONVUPlNERoyfY=
+github.com/Microsoft/go-winio v0.6.2/go.mod h1:yd8OoFMLzJbo9gZq8j5qaps8bJ9aShtEA8Ipt1oGCvU=
+github.com/cenkalti/backoff/v4 v4.3.0 h1:MyRJ/UdXutAwSAT+s3wNd7MfTIcy71VQueUuFK343L8=
+github.com/cenkalti/backoff/v4 v4.3.0/go.mod h1:Y3VNntkOUPxTVeUxJ/G5vcM//AlwfmyYozVcomhLiZE=
+github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
+github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
+github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
+github.com/containerd/errdefs v1.0.0/go.mod h1:+YBYIdtsnF4Iw6nWZhJcqGSg/dwvV7tyJ/kCkyJ2k+M=
+github.com/containerd/errdefs/pkg v0.3.0 h1:9IKJ06FvyNlexW690DXuQNx2KA2cUJXx151Xdx3ZPPE=
+github.com/containerd/errdefs/pkg v0.3.0/go.mod h1:NJw6s9HwNuRhnjJhM7pylWwMyAkmCQvQ4GpJHEqRLVk=
+github.com/containerd/log v0.1.0 h1:TCJt7ioM2cr/tfR8GPbGf9/VRAX8D2B4PjzCpfX540I=
+github.com/containerd/log v0.1.0/go.mod h1:VRRf09a7mHDIRezVKTRCrOq78v577GXq3bSa3EhrzVo=
+github.com/containerd/platforms v0.2.1 h1:zvwtM3rz2YHPQsF2CHYM8+KtB5dvhISiXh5ZpSBQv6A=
+github.com/containerd/platforms v0.2.1/go.mod h1:XHCb+2/hzowdiut9rkudds9bE5yJ7npe7dG/wG+uFPw=
+github.com/cpuguy83/dockercfg v0.3.2 h1:DlJTyZGBDlXqUZ2Dk2Q3xHs/FtnooJJVaad2S9GKorA=
+github.com/cpuguy83/dockercfg v0.3.2/go.mod h1:sugsbF4//dDlL/i+S+rtpIWp+5h0BHJHfjj5/jFyUJc=
+github.com/creack/pty v1.1.24 h1:bJrF4RRfyJnbTJqzRLHzcGaZK1NeM5kTC9jGgovnR1s=
+github.com/creack/pty v1.1.24/go.mod h1:08sCNb52WyoAwi2QDyzUCTgcvVFhUzewun7wtTfvcwE=
+github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
+github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
+github.com/distribution/reference v0.6.0 h1:0IXCQ5g4/QMHHkarYzh5l+u8T3t73zM5QvfrDyIgxBk=
+github.com/distribution/reference v0.6.0/go.mod h1:BbU0aIcezP1/5jX/8MP0YiH4SdvB5Y4f/wlDRiLyi3E=
+github.com/docker/go-connections v0.6.0 h1:LlMG9azAe1TqfR7sO+NJttz1gy6KO7VJBh+pMmjSD94=
+github.com/docker/go-connections v0.6.0/go.mod h1:AahvXYshr6JgfUJGdDCs2b5EZG/vmaMAntpSFH5BFKE=
+github.com/docker/go-units v0.5.0 h1:69rxXcBk27SvSaaxTtLh/8llcHD8vYHT7WSdRZ/jvr4=
+github.com/docker/go-units v0.5.0/go.mod h1:fgPhTUdO+D/Jk86RDLlptpiXQzgHJF7gydDDbaIK4Dk=
+github.com/ebitengine/purego v0.10.0 h1:QIw4xfpWT6GWTzaW5XEKy3HXoqrJGx1ijYHzTF0/ISU=
+github.com/ebitengine/purego v0.10.0/go.mod h1:iIjxzd6CiRiOG0UyXP+V1+jWqUXVjPKLAI0mRfJZTmQ=
+github.com/felixge/httpsnoop v1.0.4 h1:NFTV2Zj1bL4mc9sqWACXbQFVBBg2W3GPvqp8/ESS2Wg=
+github.com/felixge/httpsnoop v1.0.4/go.mod h1:m8KPJKqk1gH5J9DgRY2ASl2lWCfGKXixSwevea8zH2U=
+github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
+github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
+github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
+github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
+github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
+github.com/go-ole/go-ole v1.2.6 h1:/Fpf6oF
```

---

### Incident Patch 3: `3f136362` (2026-06-20)
**Commit Message**: ci: fix SLSA provenance via GitHub-native attestation (#528) (#529)

The standalone provenance job called the SLSA reusable workflow
(generator_generic_slsa3.yml) pinned to v2.0.0, which ships Node 20
actions that GitHub now force-migrates to Node 24. That migration broke
the generator's internal steps (exit 127, missing 'path' input), failing
the provenance job on every release since v1.25.12.

Replace it with GitHub's actively-maintained, Node 24-based
actions/attest-build-provenance, run as a step inside the existing
release job (which already has id-token: write and attestations: write).
The hash step now emits a plain sha256sum checksums file consumed via
subject-checksums.

- release.yml: drop the broken provenance job and unused hashes output;
  add the attestation step; rename the checksum step.
- dependabot.yml: remove the now-dead slsa-github-generator ignore.
- SECURITY.md: document verification via 'gh attestation verify'.

Attestations are stored in GitHub's attestation API rather than attached
as a release asset; verify with:
  gh attestation verify <artifact> --repo txn2/kubefwd

**File**: `.github/dependabot.yml` (modified, +0/-7)
```diff
@@ -21,13 +21,6 @@ updates:
     labels:
       - "dependencies"
       - "github-actions"
-    ignore:
-      # SLSA generator v2.1.x has a privacy-check false positive that halts
-      # provenance generation on public repos. Pinned to v2.0.0 in
-      # release.yml. See issue #471. Drop this ignore once upstream ships
-      # a fix (slsa-framework/slsa-github-generator#4493).
-      - dependency-name: "slsa-framework/slsa-github-generator"
-        versions: ["2.1.x"]
 
   # Docker
   - package-ecosystem: "docker"
```

**File**: `.github/workflows/release.yml` (modified, +24/-25)
```diff
@@ -15,8 +15,6 @@ jobs:
       packages: write
       id-token: write  # Required for keyless signing with Cosign and SLSA provenance
       attestations: write  # Required for GitHub attestations
-    outputs:
-      hashes: ${{ steps.hash.outputs.hashes }}
     steps:
       - name: Checkout
         uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3
@@ -97,20 +95,36 @@ jobs:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: gh release edit "$GITHUB_REF_NAME" --draft=false
 
-      - name: Generate artifact hashes
+      - name: Generate artifact checksums
         id: hash
         run: |
           cd dist
-          # Find all release artifacts and generate hashes
-          # Using find to avoid glob expansion issues when files don't exist
-          find . -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.mcpb" \) -exec sha256sum {} \; > /tmp/hashes.txt
-          if [ -s /tmp/hashes.txt ]; then
-            cat /tmp/hashes.txt | base64 -w0 > /tmp/hashes_b64.txt
-            echo "hashes=$(cat /tmp/hashes_b64.txt)" >> "$GITHUB_OUTPUT"
+          # Find all release artifacts and generate sha256 checksums.
+          # Using find to avoid glob expansion issues when files don't exist.
+          # The checksums file feeds actions/attest-build-provenance below.
+          find . -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.mcpb" \) -exec sha256sum {} \; > /tmp/checksums.txt
+          if [ -s /tmp/checksums.txt ]; then
+            echo "Checksums generated:"
+            cat /tmp/checksums.txt
+            echo "has_artifacts=true" >> "$GITHUB_OUTPUT"
           else
-            echo "No artifacts found for hashing"
+            echo "No artifacts found for checksums"
+            echo "has_artifacts=false" >> "$GITHUB_OUTPUT"
           fi
 
+      - name: Attest build provenance (SLSA)
+        if: steps.hash.outputs.has_artifacts == 'true'
+        # GitHub-native build provenance attestation. Replaces the SLSA
+        # reusable workflow (generator_generic_slsa3.yml), which was pinned to
+        # v2.0.0 and broke under the runner's Node 20 -> 24 migration (see #528,
+        # superseding the v2.1.0 privacy-check workaround tracked in #471).
+        # This action is actively maintained and Node 24-based. Attestations are
+        # stored in GitHub's attestation API; verify with:
+        #   gh attestation verify <artifact> --repo txn2/kubefwd
+        uses: actions/attest-build-provenance@a2bbfa25375fe432b6a289bc6b6cd05ecd0c4c32 # v4.1.0
+        with:
+          subject-checksums: /tmp/checksums.txt
+
       - name: Install mcp-publisher
         run: |
           curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_linux_amd64.tar.gz" | tar xz
@@ -179,18 +193,3 @@ jobs:
 
           # Publish the server to the MCP registry
           mcp-publisher publish
-
-  provenance:
-    needs: [release]
-    if: needs.release.outputs.hashes != ''
-    permissions:
-      actions: read
-      id-token: write
-      contents: write
-    # Pinned to v2.0.0 due to false-positive privacy-check halt in v2.1.0
-    # (slsa-framework/slsa-github-generator#4493). See issue #471.
-    # Re-evaluate when an upstream fix lands.
-    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@5a775b367a56d5bd118a224a811bba288150a563 # v2.0.0
-    with:
-      base64-subjects: "${{ needs.release.outputs.hashes }}"
-      upload-assets: true
```

**File**: `SECURITY.md` (modified, +6/-1)
```diff
@@ -28,7 +28,12 @@ cosign verify-blob \
 
 ### SLSA Provenance
 
-Releases include [SLSA Level 3](https://slsa.dev) provenance attestations generated by the official SLSA GitHub generator. This provides a verifiable record that artifacts were built from this repository using the documented build process.
+Releases include [SLSA](https://slsa.dev) build provenance attestations generated by GitHub's [attest-build-provenance](https://github.com/actions/attest-build-provenance) action. This provides a verifiable record that artifacts were built from this repository using the documented build process. Verify an artifact with the GitHub CLI:
+
+```bash
+# Download a release artifact, then verify its provenance attestation
+gh attestation verify kubefwd_{VERSION}_linux_amd64.tar.gz --repo txn2/kubefwd
+```
 
 ### Software Bill of Materials (SBOM)
 
```

---

### Incident Patch 4: `fd564d92` (2026-05-29)
**Commit Message**: fix: restore dead ports on multi-port service reconnect (#509) (#510)

* build: write verify sentinel for the pre-commit review gate

The local pre-commit gate (~/.claude/hooks/review-gate.sh) requires
`make verify` to record the working-tree diff hash to
.claude/.last-verify-passed on success, but the verify target never
wrote it, so the gate could never be satisfied. Add a write-verify-sentinel
step that records the same hash the gate computes. .claude is gitignored,
so writing the sentinel does not alter the diff.

* fix: restore dead ports on multi-port service reconnect (#509)

A multi-port normal service could enter an unrecoverable zombie state
after one port's connection was reset (e.g. the TCP RST behavior of
kubernetes/kubernetes#111825 that kills a single port's kubelet
listener). Auto-reconnect re-ran SyncPodForwards, found the pod, but
never recreated the dead port or restored its /etc/hosts entries.

Root cause is in syncNormalService: it tracked a single forward KEY to
keep (one port) and skipped LoopPodsToForward entirely whenever any
forward for the pod still existed. The surviving port's map entry caused
the dead port to be skipped forever. This also degraded heal

**File**: `Makefile` (modified, +14/-0)
```diff
@@ -22,9 +22,23 @@ GO ?= go
 
 .PHONY: verify
 verify: check-go-version tidy-check lint test build validate-actions patch-coverage
+	@$(MAKE) --no-print-directory write-verify-sentinel
 	@echo ""
 	@echo "==> verify: all checks passed"
 
+# Record that verify passed against the current working-tree diff. The
+# pre-commit review gate (~/.claude/hooks/review-gate.sh) reads this
+# sentinel and must find the same diff hash it computes, otherwise it
+# blocks the commit. The hash must match the gate's:
+#   { git diff --cached HEAD; git diff; } | shasum -a 256 | cut -c1-16
+# .claude is gitignored, so writing the sentinel does not alter the diff.
+.PHONY: write-verify-sentinel
+write-verify-sentinel:
+	@if git rev-parse --git-dir >/dev/null 2>&1; then \
+	  mkdir -p .claude; \
+	  { git diff --cached HEAD; git diff; } | shasum -a 256 | cut -c1-16 > .claude/.last-verify-passed; \
+	fi
+
 .PHONY: check-go-version
 check-go-version:
 	@have=$$($(GO) env GOVERSION | sed 's/^go//'); \
```

**File**: `pkg/fwdservice/fwdservice.go` (modified, +37/-9)
```diff
@@ -375,12 +375,15 @@ func (svcFwd *ServiceFWD) podStillEligible(podName string, k8sPods []v1.Pod) boo
 	return false
 }
 
-// findKeyToKeep finds a forward key for a pod that is still eligible
-func (svcFwd *ServiceFWD) findKeyToKeep(k8sPods []v1.Pod) string {
+// findPodNameToKeep finds the name of a currently-forwarded pod that is still
+// eligible. For a normal service we forward exactly one pod (all of its ports),
+// so this identifies which pod we should keep forwarding to. Returns "" if none
+// of the currently-forwarded pods are still eligible.
+func (svcFwd *ServiceFWD) findPodNameToKeep(k8sPods []v1.Pod) string {
 	forwards := svcFwd.getForwardInfos()
 	for _, fwd := range forwards {
 		if svcFwd.podStillEligible(fwd.podName, k8sPods) {
-			return fwd.key
+			return fwd.podName
 		}
 	}
 	return ""
@@ -392,21 +395,46 @@ func (svcFwd *ServiceFWD) syncHeadlessService(k8sPods []v1.Pod) {
 	svcFwd.LoopPodsToForward(k8sPods, true)
 }
 
-// syncNormalService syncs forwards for a normal (non-headless) service
+// syncNormalService syncs forwards for a normal (non-headless) service.
+//
+// A normal service forwards a single pod, but that pod may expose multiple
+// ports, each tracked as a separate entry in PortForwards (key:
+// "service.podname.localport"). We therefore reason in terms of the pod NAME to
+// keep, not a single forward key: all forwards belonging to the kept pod must be
+// preserved, and forwards belonging to any other pod removed.
+//
+// Crucially, we always (re)invoke LoopPodsToForward for the kept pod so that any
+// of its ports that are not currently forwarded get re-established.
+// LoopPodsToForward skips ports that already exist, so this is a no-op for a
+// fully-healthy pod, but it recovers a multi-port service when a single port's
+// connection was reset and torn down independently (e.g. the TCP RST behavior of
+// kubernetes/kubernetes#111825). Without this, the surviving port's map entry
+// caused the dead port (and the service's /etc/hosts entries) to never be
+// restored, leaving the service in an unrecoverable zombie state (issue #509).
 func (svcFwd *ServiceFWD) syncNormalService(k8sPods []v1.Pod) {
-	keyToKeep := svcFwd.findKeyToKeep(k8sPods)
+	podNameToKeep := svcFwd.findPodNameToKeep(k8sPods)
 
-	// Remove forwards for pods we're not keeping
+	// Remove forwards belonging to any pod other than the one we're keeping.
 	forwards := svcFwd.getForwardInfos()
 	for _, fwd := range forwards {
-		if fwd.key != keyToKeep {
+		if fwd.podName != podNameToKeep {
 			svcFwd.RemoveServicePod(fwd.key)
 		}
 	}
 
-	// Start new forward if needed
-	if keyToKeep == "" {
+	if podNameToKeep == "" {
+		// No good pod is currently forwarded - start forwarding the first eligible pod.
 		svcFwd.LoopPodsToForward([]v1.Pod{k8sPods[0]}, false)
+		return
+	}
+
+	// Already forwarding a good pod. Ensure ALL of its ports are forwarded,
+	// re-establishing any that were torn down independently.
+	for i := range k8sPods {
+		if k8sPods[i].Name == podNameToKeep {
+			svcFwd.LoopPodsToForward([]v1.Pod{k8sPods[i]}, false)
+			return
+		}
 	}
 }
 
```

**File**: `pkg/fwdservice/fwdservice_test.go` (modified, +165/-0)
```diff
@@ -722,6 +722,171 @@ func TestSyncPodForwards_RemovesStoppedPods_FullKeyFormat(t *testing.T) {
 	}
 }
 
+// TestSyncPodForwards_MultiPort_RestoresDeadPort is a regression test for issue #509.
+//
+// A multi-port normal service can lose one port's forward independently (e.g. the
+// TCP RST behavior of kubernetes/kubernetes#111825 tears down a single port's
+// listener). Auto-reconnect re-runs SyncPodForwards, which must re-establish the
+// missing port while keeping the surviving one. Previously syncNormalService kept
+// only a single forward KEY for the pod and skipped LoopPodsToForward entirely
+// when any forward existed, so the dead port was never recreated and the service
+// was stuck in an unrecoverable zombie state.
+//
+//goland:noinspection DuplicatedCode
+func TestSyncPodForwards_MultiPort_RestoresDeadPort(t *testing.T) {
+	cleanup := setupMockInterface()
+	defer cleanup()
+
+	restClient, restCleanup := setupMockRESTClient()
+	defer restCleanup()
+
+	namespace := "default"
+	labels := map[string]string{"app": "test"}
+
+	runningPod := createTestPod("running-pod", namespace, v1.PodRunning, labels)
+	clientset := fake.NewClientset(runningPod)
+
+	// Two-port service: port A (80) and port B (9100).
+	svc := createTestService("test-svc", namespace, []v1.ServicePort{
+		{Port: 80, TargetPort: intstr.FromInt32(8080), Protocol: v1.ProtocolTCP},
+		{Port: 9100, TargetPort: intstr.FromInt32(9100), Protocol: v1.ProtocolTCP},
+	}, false)
+
+	hosts, err := txeh.NewHosts(&txeh.HostsConfig{})
+	if err != nil {
+		t.Fatalf("Failed to create txeh.Hosts: %v", err)
+	}
+	hostFile := &fwdport.HostFileWithLock{Hosts: hosts}
+
+	debouncer := &mockDebouncer{immediate: true}
+
+	svcFwd := &ServiceFWD{
+		ClientSet:            clientset,
+		Svc:                  svc,
+		PodLabelSelector:     "app=test",
+		Headless:             false,
+		Context:              "test-context",
+		Namespace:            namespace,
+		PortForwards:         make(map[string]*fwdport.PortForwardOpts),
+		NamespaceServiceLock: &sync.Mutex{},
+		Hostfile:             hostFile,
+		SyncDebouncer:        debouncer.debounce,
+		LastSyncedAt:         time.Now().Add(-10 * time.Minute),
+		RESTClient:           restClient,
+	}
+
+	// Simulate the state after port A (80) was reset and cleaned up: only port B
+	// (9100) remains in the map, pointing at a still-eligible pod.
+	survivingPort := &fwdport.PortForwardOpts{
+		PodName:        "running-pod",
+		Service:        "test-svc",
+		LocalPort:      "9100",
+		Namespace:      namespace,
+		Context:        "test-context",
+		ManualStopChan: make(chan struct{}),
+		DoneChan:       make(chan struct{}),
+	}
+	svcFwd.PortForwards["test-svc.running-pod.9100"] = survivingPort
+
+	// Auto-reconnect re-runs the sync.
+	svcFwd.SyncPodForwards(true)
+
+	// Give goroutines time to register the recreated forward.
+	time.Sleep(200 * time.Millisecond)
+
+	svcFwd.NamespaceServiceLock.Lock()
+	_, hasPortA := svcFwd.PortForwards["test-svc.running-pod.80"]
+	_, hasPortB := svcFwd.PortForwards["test-svc.running-pod.9100"]
+	count := len(svcFwd.PortForwards)
+	svcFwd.NamespaceServiceLock.Unlock()
+
+	if !hasPortB {
+		t.Error("Surviving port 9100 should have been kept, but it was removed")
+	}
+	if !hasPortA {
+		t.Error("Dead port 80 should have been re-established by SyncPodForwards, but it is missing. " +
+			"This is a regression of issue #509 (multi-port service stuck in zombie state after a single port's RST).")
+	}
+	if count != 2 {
+		t.Errorf("Expected 2 forwards (both ports of the pod), got %d", count)
+	}
+}
+
+// TestSyncPodForwards_MultiPort_HealthyResyncKeepsAllPorts verifies that a routine
+// resync of a healthy multi-port service does not drop ports. Regression test for
+// the broader bug behind issue #509: syncNormalService used to keep only a single
+// forward key and remove the rest, so a multi-port service would degrade to one
+// port on the first forced resync.
+//
+//goland:noinspection DuplicatedCode
+func TestS
```

**File**: `test/integration/multiport_reconnect_test.go` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+//go:build integration
+// +build integration
+
+package integration
+
+import (
+	"fmt"
+	"io"
+	"net/http"
+	"regexp"
+	"strings"
+	"testing"
+	"time"
+)
+
+// apiBase is the kubefwd REST API base URL. The API server binds a
+// dedicated loopback IP (see pkg/fwdapi/manager.go: APIIP/APIPort) and is
+// enabled with --api.
+const apiBase = "http://127.2.27.1/api"
+
+// TestMultiPortReconnect is the end-to-end regression test for issue #509.
+//
+// A multi-port normal service must keep ALL of its ports forwarded across a
+// resync. Previously syncNormalService kept a single forward key and dropped
+// the rest, so a resync (the path auto-reconnect drives after a single port's
+// connection is reset) left the service unable to recover the dropped port and
+// removed its shared /etc/hosts entry.
+//
+// Reproducing the exact upstream RST trigger (kubernetes/kubernetes#111825) is
+// not deterministic, so this test drives the same code path deterministically:
+// it forces a resync via the REST API (POST /v1/services/:key/sync?force=true,
+// which calls SyncPodForwards(true)) and asserts every port still serves
+// afterwards. On the pre-fix code this forced sync stopped one port and removed
+// the `multiport` hostname, breaking both ports.
+//
+//goland:noinspection DuplicatedCode
+func TestMultiPortReconnect(t *testing.T) {
+	requiresSudo(t)
+	requiresKindCluster(t)
+
+	// Use a known API key so the test can authenticate. startKubefwd copies
+	// os.Environ() into the child process, so set it before starting.
+	const apiKey = "kubefwd-integration-test-key"
+	t.Setenv("KUBEFWD_API_KEY", apiKey)
+
+	// Start kubefwd with auto-reconnect and the REST API enabled.
+	cmd := startKubefwd(t, "svc", "-n", "test-multiport", "-a", "--api", "-v")
+	defer stopKubefwd(t, cmd)
+
+	t.Log("Waiting for initial forwarding to stabilize...")
+	time.Sleep(10 * time.Second)
+
+	// Both ports must serve before we do anything.
+	assertPortServes(t, "http://multiport:80/", "ok-80", "before resync")
+	assertPortServes(t, "http://multiport:8080/", "ok-8080", "before resync")
+	t.Log("✓ Both ports serving before resync")
+
+	// Discover the registry key for the multiport service via the API.
+	key := discoverServiceKey(t, apiKey, "multiport.test-multiport.")
+	t.Logf("Service key: %s", key)
+
+	// Force a resync — the exact code path auto-reconnect drives. On pre-fix
+	// code this drops one port and removes the shared hostname.
+	t.Log("Forcing resync via API...")
+	forceSync(t, apiKey, key)
+
+	// Give the async SyncPodForwards time to run.
+	time.Sleep(8 * time.Second)
+
+	// The crux of #509: after the resync BOTH ports must still serve.
+	assertPortServes(t, "http://multiport:80/", "ok-80", "after resync (#509)")
+	assertPortServes(t, "http://multiport:8080/", "ok-8080", "after resync (#509)")
+	t.Log("✓ Both ports still serving after resync — #509 fixed")
+}
+
+// assertPortServes fails the test if the URL does not return HTTP 200 with the
+// expected body substring. A removed /etc/hosts entry surfaces here as a DNS
+// lookup failure.
+func assertPortServes(t *testing.T, url, wantBody, phase string) {
+	t.Helper()
+
+	resp, err := httpGet(url, 5, 1*time.Second)
+	if err != nil {
+		t.Fatalf("[%s] %s did not respond: %v", phase, url, err)
+	}
+	defer resp.Body.Close()
+
+	body, _ := io.ReadAll(resp.Body)
+	if resp.StatusCode != http.StatusOK {
+		t.Fatalf("[%s] %s returned HTTP %d (expected 200)", phase, url, resp.StatusCode)
+	}
+	if !strings.Contains(string(body), wantBody) {
+		t.Fatalf("[%s] %s body %q does not contain %q", phase, url, string(body), wantBody)
+	}
+}
+
+// discoverServiceKey queries the API service list and returns the first
+// registry key with the given prefix.
+func discoverServiceKey(t *testing.T, apiKey, prefix string) string {
+	t.Helper()
+
+	req, err := http.NewRequest(http.MethodGet, apiBase+"/v1/services", nil)
+	if err != nil {
+		t.Fatalf("failed to build services request: %v", err)
+	}
+	re
```

**File**: `test/manifests/multiport-service.yaml` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+apiVersion: v1
+kind: Namespace
+metadata:
+  name: test-multiport
+---
+# Single nginx serving two ports (80 and 8080) so one pod backs a
+# multi-port service. Used by the #509 reconnect regression test, which
+# verifies a forced resync keeps every port of the service forwarded.
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: multiport-nginx
+  namespace: test-multiport
+data:
+  nginx.conf: |
+    events {}
+    http {
+      server {
+        listen 80;
+        location / { return 200 'ok-80\n'; }
+      }
+      server {
+        listen 8080;
+        location / { return 200 'ok-8080\n'; }
+      }
+    }
+---
+apiVersion: v1
+kind: Service
+metadata:
+  name: multiport
+  namespace: test-multiport
+spec:
+  selector:
+    app: multiport
+  ports:
+    - name: http
+      port: 80
+      targetPort: 80
+    - name: http-alt
+      port: 8080
+      targetPort: 8080
+  type: ClusterIP
+---
+apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: multiport
+  namespace: test-multiport
+spec:
+  replicas: 1
+  selector:
+    matchLabels:
+      app: multiport
+  template:
+    metadata:
+      labels:
+        app: multiport
+    spec:
+      containers:
+        - name: nginx
+          image: nginx:alpine
+          ports:
+            - containerPort: 80
+            - containerPort: 8080
+          volumeMounts:
+            - name: conf
+              mountPath: /etc/nginx/nginx.conf
+              subPath: nginx.conf
+          resources:
+            requests:
+              cpu: 50m
+              memory: 16Mi
+            limits:
+              cpu: 100m
+              memory: 32Mi
+      volumes:
+        - name: conf
+          configMap:
+            name: multiport-nginx
```

---

### Incident Patch 5: `e74f6b47` (2026-04-27)
**Commit Message**: docs: PR #473 review fixes + local DESIGN.md adoption record (#474)

* docs: address PR #473 review findings

Fixes the issues surfaced in the post-merge code review of the txn2
re-skin.

- Scope every homepage component class under .page--home (.hero__*,
  .section, .section__*, .flagship*, .terminal*, .stack*, .coda*,
  .ticker*, .dropcap, .outline). Without scoping, any inner-page
  markdown using class="terminal" or class="section" inherited
  homepage display styling.
- Rename .footer (and __rule, __inner, __col, __label, __text,
  __links, __mono, __base) to .home-footer to remove the global
  collision risk and the dead .page--home + .footer adjacent-sibling
  selector.
- Lower body::before / body::after (grain, vignette) from z-index 100
  to z-index 1 so the rail (z 50) and skiplink (z 200) are no longer
  darkened by the vignette.
- Add @supports not selector(:has(*)) fallback so headings with inline
  code still get mono+signal treatment on Firefox <121 / Safari <15.4.
- Guard the rail/footer UTC-clock IIFE with window.__kubefwdClock so
  Material's navigation.instant rehydration does not register a fresh
  setInterval handle on each navigation.
- Add Mermaid theming via

**File**: `DESIGN.md` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+---
+version: alpha
+spec: https://github.com/google-labs-code/design.md
+name: kubefwd-docs
+description: Local design adoption record for the kubefwd.com documentation site. References txn2/www DESIGN.md as the canonical visual identity for tokens, typography, components, copyright voice, and accessibility rules. Records only the decisions and MkDocs Material learnings that the canonical does not cover.
+upstream:
+  design: https://github.com/txn2/www/blob/master/DESIGN.md
+  tokens: https://github.com/txn2/www/blob/master/tokens.json
+adoption: token-alignment
+stack:
+  generator: MkDocs
+  theme: Material for MkDocs
+  templates: docs/overrides/
+  styles: docs/stylesheets/extra.css
+---
+
+## What is canonical
+
+The canonical visual identity for txn2 lives in [`txn2/www/DESIGN.md`](https://github.com/txn2/www/blob/master/DESIGN.md) with tokens in [`txn2/www/tokens.json`](https://github.com/txn2/www/blob/master/tokens.json). This file defers to those for everything below. If a value here disagrees with upstream, upstream wins.
+
+| Concern              | Source of truth |
+|----------------------|-----------------|
+| Color palette        | upstream `tokens.json` `color.*` |
+| Typography stack     | upstream `tokens.json` `font.*` |
+| Type scale           | upstream `DESIGN.md` Typography table |
+| Spacing / measure    | upstream `tokens.json` `size.*` |
+| Component contracts  | upstream `DESIGN.md` Components |
+| Voice / copy rules   | upstream `DESIGN.md` Voice and Copy |
+| Accessibility rules  | upstream `DESIGN.md` Do's and Don'ts |
+| Mermaid theme        | upstream `DESIGN.md` `mcp__card--feature` block |
+
+Tokens are mirrored as CSS custom properties in `docs/stylesheets/extra.css` `:root`. They are duplicated for runtime use, not as a divergence point. When upstream changes a token, update the value in `extra.css` and ship.
+
+## Adoption level: token alignment
+
+Per the upstream downstream contract, three levels are valid:
+
+1. Reference. Link to upstream, no visual changes.
+2. Token alignment. Keep MkDocs Material, re-skin via `extra.css` against upstream tokens.
+3. Full re-skin. Replace MkDocs Material with custom layouts.
+
+kubefwd runs at **level 2**. The site keeps Material's instant nav, search, sidebar, version selector, code copy, and content extensions. The visual layer is replaced. The homepage is a custom Material template that takes over `block header`, `block container`, and `block footer` for full-bleed treatment.
+
+## File map
+
+| Path | Role |
+|------|------|
+| `mkdocs.yml`                   | Single dark `slate` palette. `font: false` so CSS loads the upstream Google Fonts URL with trimmed axes. |
+| `docs/index.md`                | Stub front matter with `template: home.html`. All homepage HTML lives in the template. |
+| `docs/overrides/main.html`     | Adds the upstream Google Fonts `<link>` plus OG and Twitter meta. Inherited by every page. |
+| `docs/overrides/home.html`     | Custom homepage template. Overrides `block header` (rail), `block tabs` (empty), `block container` (page--home shell with hero, sections, flagship cards, stack, coda), `block footer` (home-footer). |
+| `docs/stylesheets/extra.css`   | All design rules. Two halves: homepage components scoped under `.page--home`, and Material chrome restyle for inner pages via `[data-md-color-scheme="slate"]` variable overrides. |
+
+## Project-specific components
+
+Components ported from upstream verbatim, with kubefwd content:
+
+- `.rail` (replaces Material `.md-header` on the homepage). Brand links to `./`. Live UTC clock in meta. txn2.com link in meta as `part of <em class="serif">txn2</em> ↗`.
+- `.hero` with three Fraunces rows (kubefwd / kubernetes / port forwards.).
+- `.section`, `.section__index`, `.section__title`.
+- `.flagship__card`. Two cards: `--kubefwd` (TUI mode demo) and a second variant for the API + MCP surfaces. Top accent line animates on hover per upstream spec.
+- `.termina
```

**File**: `docs/overrides/home.html` (modified, +33/-24)
```diff
@@ -301,53 +301,54 @@ <h2 class="section__title">
 </main>
 {% endblock %}
 
-{# Custom homepage footer replaces Material's. #}
+{# Custom homepage footer replaces Material's. Class names prefixed
+   home-footer to avoid global collision with markdown class="footer". #}
 {% block footer %}
-<footer class="footer">
-  <div class="footer__rule" aria-hidden="true"></div>
-  <div class="footer__inner">
-    <div class="footer__col">
-      <p class="footer__label">about</p>
-      <p class="footer__text">A bulk Kubernetes service port-forwarder by <a href="https://imti.co">Craig Johnston</a>, part of the <a href="https://txn2.com">txn2</a> open source organization, sponsored by <a href="https://deasil.works">Deasil Works, Inc.</a> and <a href="https://plexara.io">Plexara</a>.</p>
+<footer class="home-footer">
+  <div class="home-footer__rule" aria-hidden="true"></div>
+  <div class="home-footer__inner">
+    <div class="home-footer__col">
+      <p class="home-footer__label">about</p>
+      <p class="home-footer__text">A bulk Kubernetes service port-forwarder by <a href="https://imti.co">Craig Johnston</a>, part of the <a href="https://txn2.com">txn2</a> open source organization, sponsored by <a href="https://deasil.works">Deasil Works, Inc.</a> and <a href="https://plexara.io">Plexara</a>.</p>
     </div>
-    <div class="footer__col">
-      <p class="footer__label">docs</p>
-      <ul class="footer__links">
+    <div class="home-footer__col">
+      <p class="home-footer__label">docs</p>
+      <ul class="home-footer__links">
         <li><a href="getting-started/">getting started</a></li>
         <li><a href="user-guide/">user guide</a></li>
         <li><a href="configuration/">configuration</a></li>
         <li><a href="advanced-usage/">advanced usage</a></li>
         <li><a href="troubleshooting/">troubleshooting</a></li>
       </ul>
     </div>
-    <div class="footer__col">
-      <p class="footer__label">interfaces</p>
-      <ul class="footer__links">
+    <div class="home-footer__col">
+      <p class="home-footer__label">interfaces</p>
+      <ul class="home-footer__links">
         <li><a href="api-reference/">rest api</a></li>
         <li><a href="mcp-integration/">mcp integration</a></li>
         <li><a href="architecture/">architecture</a></li>
         <li><a href="comparison/">comparison</a></li>
       </ul>
     </div>
-    <div class="footer__col">
-      <p class="footer__label">code</p>
-      <ul class="footer__links">
+    <div class="home-footer__col">
+      <p class="home-footer__label">code</p>
+      <ul class="home-footer__links">
         <li><a href="https://github.com/txn2/kubefwd">github.com/txn2/kubefwd</a></li>
         <li><a href="https://github.com/txn2/kubefwd/releases">releases</a></li>
         <li><a href="https://hub.docker.com/r/txn2/kubefwd">docker hub</a></li>
         <li><a href="https://github.com/txn2/kubefwd/issues">issues</a></li>
       </ul>
     </div>
-    <div class="footer__col footer__col--meta">
-      <p class="footer__label">txn2 / org</p>
-      <p class="footer__text"><a href="https://txn2.com">txn2.com&nbsp;↗</a><br>
-      <span class="footer__links__sub">canonical home of the txn2 open source organization</span></p>
-      <p class="footer__mono">apache 2.0 license <span class="dot">·</span> <span data-clock>·· UTC</span></p>
+    <div class="home-footer__col home-footer__col--meta">
+      <p class="home-footer__label">txn2 / org</p>
+      <p class="home-footer__text"><a href="https://txn2.com">txn2.com&nbsp;↗</a><br>
+      <span class="home-footer__links__sub">canonical home of the txn2 open source organization</span></p>
+      <p class="home-footer__mono">apache 2.0 license <span class="dot">·</span> <span data-clock>·· UTC</span></p>
     </div>
   </div>
-  <div class="footer__base">
+  <div class="home-footer__base">
     <p>© 2017-2026 · <a href="https://txn2.com">txn2</a> · kubefwd released under Apache 2.0.</p>
-    <p class="footer__base__ta
```

**File**: `docs/stylesheets/extra.css` (modified, +189/-111)
```diff
@@ -91,6 +91,35 @@
   --md-shadow-z1: 0 1px 0 rgba(255,255,255,0.02);
   --md-shadow-z2: 0 1px 0 rgba(255,255,255,0.02);
   --md-shadow-z3: 0 1px 0 rgba(255,255,255,0.02);
+
+  /* Mermaid theme variables consumed by MkDocs Material's
+     Mermaid integration. Mirrors the txn2 DESIGN.md Mermaid block. */
+  --md-mermaid-font-family:                 var(--mono);
+  --md-mermaid-edge-color:                  var(--mute);
+  --md-mermaid-node-bg-color:               var(--ink-3);
+  --md-mermaid-node-fg-color:               var(--paper);
+  --md-mermaid-label-bg-color:              var(--ink-3);
+  --md-mermaid-label-fg-color:              var(--paper);
+  --md-mermaid-sequence-actor-bg-color:     var(--ink-3);
+  --md-mermaid-sequence-actor-fg-color:     var(--paper);
+  --md-mermaid-sequence-actor-border-color: var(--rule-2);
+  --md-mermaid-sequence-actor-line-color:   var(--rule-2);
+  --md-mermaid-sequence-actorman-bg-color:  var(--ink-3);
+  --md-mermaid-sequence-actorman-line-color: var(--mute);
+  --md-mermaid-sequence-box-bg-color:       var(--ink-2);
+  --md-mermaid-sequence-box-fg-color:       var(--paper);
+  --md-mermaid-sequence-label-bg-color:     var(--ink-2);
+  --md-mermaid-sequence-label-fg-color:     var(--mute);
+  --md-mermaid-sequence-loop-bg-color:      var(--ink-2);
+  --md-mermaid-sequence-loop-fg-color:      var(--paper);
+  --md-mermaid-sequence-loop-border-color:  var(--rule-2);
+  --md-mermaid-sequence-message-fg-color:   var(--paper-dim);
+  --md-mermaid-sequence-message-line-color: var(--mute);
+  --md-mermaid-sequence-note-bg-color:      var(--ink-2);
+  --md-mermaid-sequence-note-fg-color:      var(--paper);
+  --md-mermaid-sequence-note-border-color:  var(--signal);
+  --md-mermaid-sequence-number-bg-color:    var(--signal);
+  --md-mermaid-sequence-number-fg-color:    var(--ink);
 }
 
 /* ──────────────────────────────────────────────────────────────
@@ -153,6 +182,10 @@ em.serif { font-family: var(--serif); font-style: italic; font-weight: 400; }
 
 /* ──────────────────────────────────────────────────────────────
    FILM GRAIN + VIGNETTE / fixed viewport overlays, page-wide
+   z-index 1: above the page background, below the rail (z 50),
+   skiplink (z 200), and any interactive Material chrome. The
+   grain uses overlay blend so it stays subtle even over text;
+   the vignette only dims the corners.
    ────────────────────────────────────────────────────────────── */
 
 body::before,
@@ -161,7 +194,7 @@ body::after {
   position: fixed;
   inset: 0;
   pointer-events: none;
-  z-index: 100;
+  z-index: 1;
 }
 body::before {
   opacity: .08;
@@ -339,6 +372,8 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
 
 /* ──────────────────────────────────────────────────────────────
    HERO
+   All rules scoped under .page--home so component classes never
+   leak into Material-rendered inner pages.
    ────────────────────────────────────────────────────────────── */
 
 .page--home .hero {
@@ -348,7 +383,7 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
   margin: 0 auto;
 }
 
-.hero__stamp {
+.page--home .hero__stamp {
   position: absolute;
   top: clamp(40px, 8vh, 90px);
   right: var(--gutter);
@@ -362,10 +397,10 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
   padding-right: 14px;
   animation: rise 1.1s .1s both ease-out;
 }
-.hero__stamp__line { line-height: 1.7; }
-.hero__stamp__line--ok { color: var(--signal); }
+.page--home .hero__stamp__line { line-height: 1.7; }
+.page--home .hero__stamp__line--ok { color: var(--signal); }
 
-.hero__display {
+.page--home .hero__display {
   font-family: var(--serif);
   font-weight: 300;
   font-size: clamp(60px, 12.5vw, 220px);
@@ -374,32 +409,32 @@ a.rail__brand:focus-visible { outline-offset: 4px; }
   margin-bottom: 56px;
   font-variation-settings: "opsz" 144;
 }
-.hero__row {
+.page--home .hero__row {
   display: flex; align-items: baseline; gap: clamp(12px, 2vw, 36px);
   flex-wrap: wrap;
 }
-.hero__row--1 { animation: 
```

---

### Incident Patch 6: `5eab2dcc` (2026-04-22)
**Commit Message**: ci: fix MCP Registry publish step (fileSha256 field name) (#470)

* ci: use correct MCP schema field name in server.json

The MCP registry schema requires camelCase `fileSha256`, but server.json
used snake_case `file_sha256`, so every Release workflow since v1.25.1
failed at the Publish to MCP Registry step. Those failures prompted a
re-run of the v1.25.13 release, which produced new (non-reproducible)
Go binaries and left the homebrew-tap formula pinned to the old hashes,
breaking `brew install txn2/tap/kubefwd` (txn2/homebrew-tap#5).

Also add a validation step that runs the JSON Schema plus an explicit
MCPB contract check (every mcpb package must have a 64-hex fileSha256)
so this class of regression fails loudly before publish.

* ci: use pipx run for check-jsonschema

Swap the pip install for `pipx run`, which is preinstalled on
ubuntu-latest runners and sidesteps PEP 668 externally-managed-env
issues. Removes the only install-time failure mode in the validation
step, so a transient pip regression can't knock the release workflow
into a failed state that tempts a destructive re-run.

**File**: `.github/workflows/release.yml` (modified, +33/-0)
```diff
@@ -139,6 +139,39 @@ jobs:
           echo "Updated server.json:"
           cat server.json
 
+      - name: Validate server.json against MCP schema
+        run: |
+          # JSON Schema validation (types, formats, top-level required fields).
+          # pipx is preinstalled on ubuntu-latest; `pipx run` isolates the tool
+          # in its own venv, sidestepping PEP 668 externally-managed-env issues.
+          pipx run check-jsonschema \
+            --schemafile "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json" \
+            server.json
+          # MCPB contract: every mcpb package must have a real fileSha256.
+          # The base schema does not enforce this (it's documented-only), so
+          # we check explicitly. Catches wrong field name (file_sha256 vs
+          # fileSha256) and unreplaced PLACEHOLDER_SHA256 values.
+          python3 - <<'PY'
+          import json, re, sys
+          data = json.load(open('server.json'))
+          errors = []
+          for i, pkg in enumerate(data.get('packages', [])):
+              if pkg.get('registryType') != 'mcpb':
+                  continue
+              h = pkg.get('fileSha256')
+              if not h or not re.fullmatch(r'[a-f0-9]{64}', h):
+                  errors.append(
+                      f"packages[{i}] ({pkg.get('identifier','?')}): "
+                      f"missing/invalid fileSha256 (got {h!r})"
+                  )
+          if errors:
+              print('server.json MCPB validation failed:', file=sys.stderr)
+              for e in errors:
+                  print(f'  - {e}', file=sys.stderr)
+              sys.exit(1)
+          print('server.json OK: all mcpb packages have valid fileSha256')
+          PY
+
       - name: Publish to MCP Registry
         run: |
           # Login using GitHub OIDC (id-token: write permission required)
```

**File**: `server.json` (modified, +3/-3)
```diff
@@ -11,23 +11,23 @@
     {
       "registryType": "mcpb",
       "identifier": "https://github.com/txn2/kubefwd/releases/download/v0.0.0/kubefwd-0.0.0-darwin-arm64.mcpb",
-      "file_sha256": "PLACEHOLDER_SHA256",
+      "fileSha256": "PLACEHOLDER_SHA256",
       "transport": {
         "type": "stdio"
       }
     },
     {
       "registryType": "mcpb",
       "identifier": "https://github.com/txn2/kubefwd/releases/download/v0.0.0/kubefwd-0.0.0-darwin-amd64.mcpb",
-      "file_sha256": "PLACEHOLDER_SHA256",
+      "fileSha256": "PLACEHOLDER_SHA256",
       "transport": {
         "type": "stdio"
       }
     },
     {
       "registryType": "mcpb",
       "identifier": "https://github.com/txn2/kubefwd/releases/download/v0.0.0/kubefwd-0.0.0-windows-amd64.mcpb",
-      "file_sha256": "PLACEHOLDER_SHA256",
+      "fileSha256": "PLACEHOLDER_SHA256",
       "transport": {
         "type": "stdio"
       }
```

#### Recent Merged Pull Requests:
- **PR #591** (2026-09-15): ci/deps: roll up open Dependabot updates (@cjimti)
- **PR #589** (closed): ci: bump anchore/sbom-action/download-syft from 0.24.0 to 0.24.2 (@dependabot[bot])
- **PR #588** (closed): ci: bump docker/login-action from 4.4.0 to 4.6.0 (@dependabot[bot])
- **PR #587** (closed): ci: bump docker/setup-qemu-action from 4.2.0 to 4.3.0 (@dependabot[bot])
- **PR #586** (closed): ci: bump github/codeql-action/upload-sarif from 4.37.3 to 4.37.9 (@dependabot[bot])
- **PR #585** (closed): ci: bump actions/attest from 4.2.0 to 4.2.2 (@dependabot[bot])
- **PR #584** (closed): deps: bump k8s.io/cli-runtime from 0.36.3 to 0.37.0 (@dependabot[bot])
- **PR #583** (closed): deps: bump k8s.io/client-go from 0.36.3 to 0.37.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
