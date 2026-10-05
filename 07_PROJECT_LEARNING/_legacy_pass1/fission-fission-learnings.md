# Forensic Learning Record (Deep Inspection): fission/fission

> **Canonical Artifact**: `07_PROJECT_LEARNING/fission-fission-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fission/fission](https://github.com/fission/fission))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:21:29.472Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fission/fission`
- **Description**: Fast and Simple Serverless Functions for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 8929 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/fetcher/app/server.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package app

import (
	"context"
	"encoding/json/v2"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"sync/atomic"

	"go.opentelemetry.io/otel"
	"golang.org/x/sync/errgroup"

	"github.com/go-logr/logr"

	fv1 "github.com/fission/fission/pkg/apis/core/v1"
	hmacauth "github.com/fission/fission/pkg/auth/hmac"
	"github.com/fission/fission/pkg/crd"
	"github.com/fission/fission/pkg/fetcher"
	"github.com/fission/fission/pkg/utils/httpsecurity"
	"github.com/fission/fission/pkg/utils/httpserver"
	otelUtils "github.com/fission/fission/pkg/utils/otel"
)

var (
	readyToServe atomic.Uint32
)

func Run(ctx context.Context, clientGen crd.ClientGeneratorInterface, logger logr.Logger, mgr *errgroup.Group, port string, podInfoMountDir string) error {
	flag.Usage = fetcherUsage
	specializeOnStart := flag.Bool("specialize-on-startup", false, "Flag to activate specialize process at pod startup")
	specializePayload := flag.String("specialize-request", "", "JSON payload for specialize request")
	secretDir := flag.String("secret-dir", "", "Path to shared secrets directory")
	configDir := flag.String("cfgmap-dir", "", "Path to shared configmap directory")

	flag.Parse()
	if flag.NArg() == 0 {
		flag.Usage()
		return errors.New("missing arguments")
	}
	// Fail closed on a present-but-empty internal-auth key before the
	// specialize/fetch verifier is constructed from it.
	if err := fv1.ValidateInternalAuthEnv(); err != nil {
		return err
	}

	dir := flag.Arg(0)
	if _, err := os.Stat(dir); err != nil {
		if os.IsNotExist(err) {
			err = os.MkdirAll(dir, os.ModeDir|0700)
			if err != nil {
				return fmt.Errorf("error creating directory %s: %w", dir, err)
			}
		}
	}

	shutdown, err := otelUtils.InitProvider(ctx, logger, "Fission-Fetcher")
	if err != nil {
		return fmt.Errorf("error initializing OTLP provider: %w", err)
	}
	if shutdown != nil {
		defer shutdown(ctx)
	}

	tracer := otel.Tracer("fetcher")
	ctx, span := tracer.Start(ctx, "fetcher/Run")
	defer span.End()

	f, err := fetcher.MakeFetcher(logger, clientGen, dir, *secretDir, *configDir, podInfoMountDir)
	if err != nil {
		return fmt.Errorf("error making fetcher: %w", err)
	}

	// do specialization in other goroutine to prevent blocking in newdeploy
	mgr.Go(func() error {
		if *specializeOnStart {
			var specializeReq fetcher.FunctionSpecializeRequest

			err := json.Unmarshal([]byte(*specializePayload), &specializeReq)
			if err != nil {
				logger.Error(err, "error decoding specialize request")
				return nil
			}

			code, err := f.SpecializePod(ctx, specializeReq.FetchReq, specializeReq.LoadReq)
			if err != nil {
				logger.Error(err, "error specializing function pod", "statusCode", code)
				return nil
			}
		}
		readyToServe.Store(1)
		return nil
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/fetch", f.FetchHandler)
	mux.HandleFunc("/specialize", f.SpecializeHandler)
	mux.HandleFunc("/upload", f.UploadHandler)
	mux.HandleFunc("/version", f.VersionHandler)
	mux.HandleFunc("/wsevent/start", f.WsStartHandler)
	mux.HandleFunc("/wsevent/end", f.WsEndHandler)

	readinessHandler := func(w http.ResponseWriter, r *http.Request) {
		if readyToServe.Load() == 1 {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}

	mux.HandleFunc("/readiness-healthz", readinessHandler)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	logger.Info("fetcher ready to receive requests")

	// Wrap the mux with the HMAC verifier middleware. The master
	// secret (when set via FISSION_INTERNAL_AUTH_SECRET on the function
	// pod's fetcher container) is derived per-service for
	// ServiceFetcher so a leak of this fetcher's runtime memory cannot
	// forge requests on other Fission internal channels (storagesvc,
	// builder, executor, router-internal). An empty master means the
	// underlying Verifier short-circuits to pass-through, preserving
	// backwards compatibility for installs with internalAuth disabled.
	// /healthz and /readiness-healthz are bypassed so kubelet probes
	// continue to pass without signing. See
	// docs/internal-auth/00-design.md.
	vopts := hmacauth.VerifierOpts{
		SkewSec:      60,
		Bypass:       []string{"/healthz", "/readiness-healthz"},
		MaxBodyBytes: hmacauth.DefaultMaxBodyBytes,
		Logger:       logger.WithName("hmac"),
	}
	// Per-namespace tenancy: when the tenant controller has mounted a derived
	// fetcher key (FISSION_FETCHER_KEY), verify /specialize with it directly —
	// this pod then never holds the master, so a leak of its memory cannot forge
	// requests as another tenant's fetcher. Otherwise fall back to deriving the
	// ServiceFetcher key from the master (existing behaviour; empty master =
	// pass-through).
	verifier := hmacauth.VerifierFromKeyOrMaster(
		hmacauth.DecodeKeyFromEnv(os.Getenv("FISSION_FETCHER_KEY")),
		hmacauth.DecodeKeyFromEnv(os.Getenv("FISSION_FETCHER_KEY_OLD")),
		[]byte(os.Getenv("FISSION_INTERNAL_AUTH_SECRET")),
		[]byte(os.Getenv("FISSION_INTERNAL_AUTH_SECRET_OLD")),
		hmacauth.ServiceFetcher, vopts)
	// Fetcher is a pod-local sidecar with no Service; no legitimate
	// browser caller. SecurityHeaders + DenyAllCORS as defense-in-depth
	// against a hostile package running in the same pod-network namespace.
	handler := httpsecurity.SecurityHeaders(
		httpsecurity.DenyAllCORS(
			otelUtils.GetHandlerWithOTEL(verifier(mux), "fission-fetcher", otelUtils.UrlsToIgnore("/healthz", "/readiness-healthz")),
		),
	)
	httpserver.Serve(ctx, logger, mgr, httpserver.ServerOptions{Name: "fetcher", Addr: port, Handler: handler})
	return nil
}

func fetcherUsage() {
	fmt.Println("Usage: fetcher [-specialize-on-startup] [-specialize-request <json>] [-secret-dir <string>] [-cfgmap-dir <string>] <shared volume path>")
}

```

### Core Architecture Module: `cmd/fetcher/main.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"os"
	"strconv"

	"golang.org/x/sync/errgroup"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"

	"github.com/fission/fission/cmd/fetcher/app"
	fv1 "github.com/fission/fission/pkg/apis/core/v1"
	"github.com/fission/fission/pkg/crd"
	"github.com/fission/fission/pkg/svcinfo"
	"github.com/fission/fission/pkg/utils/loggerfactory"
	"github.com/fission/fission/pkg/utils/profile"
)

// Usage: fetcher <shared volume path>
func main() {

	mgr := &errgroup.Group{}
	defer func() { _ = mgr.Wait() }()

	logger := loggerfactory.GetLogger()

	ctx := signals.SetupSignalHandler()
	profile.ProfileIfEnabled(ctx, logger, mgr)

	err := app.Run(ctx, crd.NewClientGenerator(), logger, mgr, strconv.Itoa(svcinfo.PortFetcher), fv1.PodInfoMount)
	if err != nil {
		logger.Error(err, "fetcher failed")
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/fission-bundle/main.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/go-logr/logr"
	"golang.org/x/sync/errgroup"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"
	cnwebhook "sigs.k8s.io/controller-runtime/pkg/webhook"

	"github.com/fission/fission/cmd/fission-bundle/mqtrigger"
	fv1 "github.com/fission/fission/pkg/apis/core/v1"
	"github.com/fission/fission/pkg/buildermgr"
	"github.com/fission/fission/pkg/canaryconfigmgr"
	"github.com/fission/fission/pkg/crd"
	"github.com/fission/fission/pkg/executor"
	eclient "github.com/fission/fission/pkg/executor/client"
	"github.com/fission/fission/pkg/info"
	"github.com/fission/fission/pkg/kubewatcher"
	"github.com/fission/fission/pkg/mcp"
	mqt "github.com/fission/fission/pkg/mqtrigger"
	"github.com/fission/fission/pkg/router"
	"github.com/fission/fission/pkg/statestore/statestoresvc"
	"github.com/fission/fission/pkg/statesvc"
	"github.com/fission/fission/pkg/storagesvc"
	storagesvcClient "github.com/fission/fission/pkg/storagesvc/client"
	"github.com/fission/fission/pkg/svcinfo"
	"github.com/fission/fission/pkg/tenant"
	"github.com/fission/fission/pkg/timer"
	"github.com/fission/fission/pkg/utils"
	"github.com/fission/fission/pkg/utils/loggerfactory"
	"github.com/fission/fission/pkg/utils/otel"
	"github.com/fission/fission/pkg/utils/profile"
	"github.com/fission/fission/pkg/webhook"
	"github.com/fission/fission/pkg/workflow"
)

// Command line arguments
type CommandLineArgs struct {
	// Flags
	canaryConfig     bool
	kubewatcher      bool
	timer            bool
	mqt              bool
	mqt_keda         bool
	builderMgr       bool
	showVersion      bool
	tenantController bool
	seedTenants      bool

	// Port values
	webhookPort        int
	routerPort         int
	routerInternalPort int
	executorPort       int
	storageServicePort int
	mcpPort            int
	statestorePort     int
	workflowPort       int
	stateAPIPort       int

	// URL values — empty means "not set": the resolver derives the
	// in-cluster default from POD_NAMESPACE (see svcinfo.AddressResolver)
	executorUrl   string
	routerUrl     string
	storageSvcUrl string

	// Other configurations
	storageType string
}

// Usage information
const usageText string = `fission-bundle: Package of all fission microservices: router, executor.

Use it to start one or more of the fission servers:

 Pool manager maintains a pool of generalized function containers, and
 specializes them on-demand. Executor must be run from a pod in a
 Kubernetes cluster.

 Router implements HTTP triggers: it routes to running instances,
 working with the executor.

 Kubewatcher implements Kubernetes Watch triggers: it watches
 Kubernetes resources and invokes functions described in the
 KubernetesWatchTrigger.

 The storage service implements storage for functions too large to fit
 in the Kubernetes API resource object. It supports various storage
 backends.

Usage:
  fission-bundle --canaryConfig
  fission-bundle --routerPort=<port> [--executorUrl=<url>]
  fission-bundle --executorPort=<port> [--namespace=<namespace>] [--fission-namespace=<namespace>]
  fission-bundle --kubewatcher [--routerUrl=<url>]
  fission-bundle --storageServicePort=<port> --storageType=<storateType>
  fission-bundle --builderMgr [--storageSvcUrl=<url>] [--envbuilder-namespace=<namespace>]
  fission-bundle --timer [--routerUrl=<url>]
  fission-bundle --mqt   [--routerUrl=<url>]
  fission-bundle --mqt_keda [--routerUrl=<url>]
  fission-bundle --webhookPort=<port>
  fission-bundle --version
Options:
  --canaryConfig		  		  Start canary config server.
  --webhookPort=<port>             Port that the webhook should listen on.
  --routerPort=<port>             Port that the router should listen on.
  --executorPort=<port>           Port that the executor should listen on.
  --storageServicePort=<port>     Port that the storage service should listen on.
  --executorUrl=<url>             Executor URL. Not required if --executorPort is specified.
  --routerUrl=<url>               Router URL.
  --storageSvcUrl=<url>           StorageService URL.
  --kubewatcher                   Start Kubernetes events watcher.
  --timer                         Start Timer.
  --mqt                           Start message queue trigger.
  --mqt_keda					  Start message queue trigger of kind KEDA
  --builderMgr                    Start builder manager.
  --tenantController              Start the multi-namespace tenant lifecycle controller.
  --version                       Print version information`

func main() {
	mgr := &errgroup.Group{}
	defer func() { _ = mgr.Wait() }()

	// Set up command line parsing
	args := setupCommandLineArgs()

	// Handle version request specially - exit after printing
	if args.showVersion {
		fmt.Printf("Fission Bundle Version: %s\n", info.BuildInfo().String())
		os.Exit(0)
	}

	// Initialize logger
	logger := loggerfactory.GetLogger()

	// Fail closed on a present-but-empty internal-auth key before ANY
	// subsystem constructs a verifier — every --<flag> this binary dispatches
	// to reads the same environment, so this one check covers them all.
	if err := fv1.ValidateInternalAuthEnv(); err != nil {
		logger.Error(err, "invalid internal-auth environment")
		os.Exit(1)
	}

	// GOMAXPROCS is left to the runtime: Go ≥1.25 derives it from the cgroup
	// CPU quota (including on in-place resize); automaxprocs would regress that.

	// ctrl.SetLogger targets controller-runtime's process-global logger. Set it
	// once here, before any subsystem's Start builds its manager, so every
	// subsystem routes controller-runtime's own logs (cache-sync, reconcile,
	// leader-election) through our logger instead of dropping them with a one-off
	// "log.SetLogger was never called" stack trace.
	ctrl.SetLogger(logger.WithName("controller-runtime"))

	// Set up signal handling for graceful shutdown
	ctx := signals.SetupSignalHandler()

	// Enable profiling if configured
	profile.ProfileIfEnabled(ctx, logger, mgr)

	// Initialize OpenTelemetry
	serviceName := getServiceNameFromArgs(args)
	shutdown, err := otel.InitProvider(ctx, logger, serviceName)
	if err != nil {
		logger.Error(err, "error initializing provider for OTLP")
		return
	}
	if shutdown != nil {
		defer shutdown(ctx)
	}

	// Initialize client generator
	clientGen := crd.NewClientGenerator()

	// Start the appropriate service based on command line arguments
	startRequestedService(ctx, args, clientGen, logger, mgr)

	<-ctx.Done()
	logger.Info("exiting")
}

// setupCommandLineArgs parses command line arguments and returns them
func setupCommandLineArgs() *CommandLineArgs {
	args := &CommandLineArgs{}

	// Override the default usage function
	flag.Usage = func() {
		fmt.Println(usageText)
	}

	// Tell glog to log into STDERR
	flag.Set("logtostderr", "true") //nolint: errcheck

	// Define flags
	flag.BoolVar(&args.canaryConfig, "canaryConfig", false, "Start canary config server")
	flag.BoolVar(&args.kubewatcher, "kubewatcher", false, "Start Kubernetes events watcher")
	flag.BoolVar(&args.timer, "timer", false, "Start Timer")
	flag.BoolVar(&args.mqt, "mqt", false, "Start message queue trigger")
	flag.BoolVar(&args.mqt_keda, "mqt_keda", false, "Start message queue trigger of kind KEDA")
	flag.BoolVar(&args.builderMgr, "builderMgr", false, "Start builder manager")
	flag.BoolVar(&args.tenantController, "tenantController", false, "Start the multi-namespace tenant lifecycle controller")
	flag.BoolVar(&args.seedTenants, "seedTenants", false, "Seed FissionTenant CRs from the env namespace config, then exit (migration hook)")
	flag.BoolVar(&args.showVersion, "version", false, "Print version information")

	// Port flags
	flag.IntVar(&args.webhookPort, "webhookPort", 0, "Port that the webhook should listen on")
	flag.IntVar(&args.routerPort, "routerPort", 0, "Port that the router should listen on")
	flag.IntVar(&args.routerInternalPort, "routerInternalPo
```

### Core Architecture Module: `cmd/fission-bundle/mqtrigger/mqtrigger.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package mqtrigger

import (
	"context"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/go-logr/logr"
	"golang.org/x/sync/errgroup"

	fv1 "github.com/fission/fission/pkg/apis/core/v1"
	"github.com/fission/fission/pkg/controller"
	"github.com/fission/fission/pkg/crd"
	"github.com/fission/fission/pkg/mqtrigger"
	"github.com/fission/fission/pkg/mqtrigger/egress"
	"github.com/fission/fission/pkg/mqtrigger/factory"
	"github.com/fission/fission/pkg/mqtrigger/messageQueue"
	_ "github.com/fission/fission/pkg/mqtrigger/messageQueue/kafka"
	_ "github.com/fission/fission/pkg/mqtrigger/messageQueue/statestore"
	"github.com/fission/fission/pkg/statestore"

	// Statestore drivers the statestore MQ provider opens via STATESTORE_DRIVER:
	// the HTTP client (embedded mode → svc/statestore) and Postgres (external
	// mode → the DB directly). Registered here, not in the provider package, so
	// importing the provider for its validator (fission CLI) links no drivers.
	_ "github.com/fission/fission/pkg/statestore/client"
	_ "github.com/fission/fission/pkg/statestore/postgres"
	"github.com/fission/fission/pkg/utils/crmanager"
	"github.com/fission/fission/pkg/utils/metrics"
)

// mqtReconcileConcurrency lets independent MessageQueueTriggers subscribe in
// parallel, matching the throughput of the previous 4 create/update workers.
const mqtReconcileConcurrency = 4

func Start(ctx context.Context, clientGen crd.ClientGeneratorInterface, logger logr.Logger, _ *errgroup.Group, routerUrl string) error {
	// fissionClient is needed below for the subscription manager; NewTriggerManager
	// resolves its own to wait for the Function CRDs (a cheap cached call).
	fissionClient, err := clientGen.GetFissionClient()
	if err != nil {
		return fmt.Errorf("failed to get fission client: %w", err)
	}

	mqType := (fv1.MessageQueueType)(os.Getenv("MESSAGE_QUEUE_TYPE"))
	mqUrl := os.Getenv("MESSAGE_QUEUE_URL")

	secretsPath := strings.TrimSpace(os.Getenv("MESSAGE_QUEUE_SECRETS"))

	var secrets map[string][]byte
	if len(secretsPath) > 0 {
		// For authentication with message queue
		secrets, err = readSecrets(logger, secretsPath)
		if err != nil {
			return err
		}
	}

	mq, err := factory.Create(
		logger,
		mqType,
		messageQueue.Config{
			MQType:  (string)(mqType),
			Url:     mqUrl,
			Secrets: secrets,
		},
		routerUrl,
	)
	if err != nil {
		return fmt.Errorf("failed to connect to remote message queue server: %w", err)
	}

	// Active-passive HA via native controller-runtime leader election: only the
	// elected leader consumes the message queue and manages triggers, so two
	// replicas don't double-consume. No-op when LEADER_ELECTION_ENABLED is unset
	// (single-replica default). The reconciler watches MessageQueueTriggers
	// through the Manager's cache and runs only on the leader.
	crMgr, err := crmanager.NewTriggerManager(ctx, clientGen, "fission-mqtrigger", logger)
	if err != nil {
		return err
	}

	// Serve the subsystem's custom metrics on every replica (the crmanager
	// Manager's own metrics server is disabled), so a scrape hits whichever pod.
	if err := crMgr.Add(crmanager.NonLeaderRunnable(func(c context.Context) error {
		gm := &errgroup.Group{}
		metrics.ServeMetrics(c, "mqtrigger", logger, gm)
		<-c.Done()
		return gm.Wait()
	})); err != nil {
		return err
	}

	// RFC-0027 broker egress: a broker provider (kafka) also runs the publisher
	// loop over its per-type statestore queue mq-egress-<mqType> — the jobs the
	// router's async dispatcher enqueues for broker-destined topic publishes.
	// Requires the statestore wiring (chart sets STATESTORE_DRIVER/DSN on broker
	// heads when statestore.enabled); without it the loop is skipped with a log,
	// matching the admission story (broker topic destinations are usable only on
	// statestore-enabled installs). Queue leases are SKIP LOCKED, so the loop
	// runs on every replica (NonLeader), like the async dispatcher itself.
	if provider, ok := mq.(egress.BrokerPublisherProvider); ok {
		if driver := os.Getenv("STATESTORE_DRIVER"); driver != "" {
			caps, err := statestore.Open(ctx, statestore.Config{Driver: driver, DSN: os.Getenv("STATESTORE_DSN")})
			if err != nil {
				return fmt.Errorf("opening statestore for broker egress: %w", err)
			}
			queue, err := statestore.NewScoped(caps, nil).Queue()
			if err != nil {
				_ = caps.Close()
				return fmt.Errorf("statestore queue capability for broker egress: %w", err)
			}
			publish, producerCloser, err := provider.NewEgressPublisher()
			if err != nil {
				_ = caps.Close()
				return fmt.Errorf("creating broker egress publisher: %w", err)
			}
			consumer := egress.New(logger, queue, string(mqType), publish)
			if err := crMgr.Add(crmanager.NonLeaderRunnable(func(c context.Context) error {
				// Producer and store handles are released on shutdown; opened
				// here rather than process-lifetime so a flush happens.
				defer func() { _ = caps.Close() }()
				defer func() { _ = producerCloser.Close() }()
				return consumer.Run(c)
			})); err != nil {
				_ = producerCloser.Close()
				_ = caps.Close()
				return err
			}
		} else {
			logger.Info("statestore not configured; broker egress consumer disabled",
				"mqType", mqType)
		}
	}

	// The subscription manager (service() actor) is leader-only: only the leader
	// holds live queue subscriptions, so a standby doesn't double-consume.
	mqtMgr := mqtrigger.MakeMessageQueueTriggerManager(logger, fissionClient, mqType, mq)
	if err := crMgr.Add(crmanager.LeaderRunnable(mqtMgr.Start)); err != nil {
		return err
	}

	r := mqtrigger.NewMessageQueueTriggerReconciler(logger, crMgr.GetClient(), mqtMgr)
	if err := controller.RegisterTenantScopedWithConcurrency(crMgr, &fv1.MessageQueueTrigger{}, r, "messagequeuetrigger", mqtReconcileConcurrency); err != nil {
		return fmt.Errorf("error registering messagequeuetrigger reconciler: %w", err)
	}
	return crMgr.Start(ctx)
}

func readSecrets(logger logr.Logger, secretsPath string) (map[string][]byte, error) {
	// return if no secrets exist
	if _, err := os.Stat(secretsPath); os.IsNotExist(err) {
		return nil, err
	}

	secretFiles, err := os.ReadDir(secretsPath)
	if err != nil {
		return nil, err
	}

	secrets := make(map[string][]byte)
	for _, secretFile := range secretFiles {

		fileName := secretFile.Name()
		// /etc/secrets contain some hidden directories (like .data)
		// ignore them
		if !secretFile.IsDir() && !strings.HasPrefix(fileName, ".") {
			logger.Info(fmt.Sprintf("Reading secret from %s", fileName))

			filePath := path.Join(secretsPath, fileName)
			secret, fileReadErr := os.ReadFile(filePath)
			if fileReadErr != nil {
				return nil, fileReadErr
			}

			secrets[fileName] = secret
		}
	}

	return secrets, nil
}

```

### Core Architecture Module: `cmd/fission-cli/app/app.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package app

import (
	"fmt"

	"github.com/spf13/cobra"

	wrapper "github.com/fission/fission/pkg/fission-cli/cliwrapper/driver/cobra"
	"github.com/fission/fission/pkg/fission-cli/cliwrapper/driver/cobra/helptemplate"
	"github.com/fission/fission/pkg/fission-cli/cmd"
	"github.com/fission/fission/pkg/fission-cli/cmd/archive"
	"github.com/fission/fission/pkg/fission-cli/cmd/canaryconfig"
	"github.com/fission/fission/pkg/fission-cli/cmd/check"
	"github.com/fission/fission/pkg/fission-cli/cmd/environment"
	"github.com/fission/fission/pkg/fission-cli/cmd/function"
	"github.com/fission/fission/pkg/fission-cli/cmd/functionalias"
	"github.com/fission/fission/pkg/fission-cli/cmd/httptrigger"
	"github.com/fission/fission/pkg/fission-cli/cmd/kubewatch"
	"github.com/fission/fission/pkg/fission-cli/cmd/mqtrigger"
	_package "github.com/fission/fission/pkg/fission-cli/cmd/package"
	"github.com/fission/fission/pkg/fission-cli/cmd/spec"
	"github.com/fission/fission/pkg/fission-cli/cmd/support"
	"github.com/fission/fission/pkg/fission-cli/cmd/tenant"
	"github.com/fission/fission/pkg/fission-cli/cmd/timetrigger"
	"github.com/fission/fission/pkg/fission-cli/cmd/token"
	"github.com/fission/fission/pkg/fission-cli/cmd/topic"
	"github.com/fission/fission/pkg/fission-cli/cmd/version"
	"github.com/fission/fission/pkg/fission-cli/cmd/workflow"
	"github.com/fission/fission/pkg/fission-cli/console"
	"github.com/fission/fission/pkg/fission-cli/flag"
	flagkey "github.com/fission/fission/pkg/fission-cli/flag/key"
	_ "github.com/fission/fission/pkg/mqtrigger/messageQueue/kafka"
	_ "github.com/fission/fission/pkg/mqtrigger/messageQueue/statestore"
)

const (
	usage = `Fission: Fast and Simple Serverless Functions for Kubernetes

 * GitHub: https://github.com/fission/fission
 * Documentation: https://fission.io/docs
`
)

func App(clientOptions cmd.ClientOptions) *cobra.Command {
	cobra.EnableCommandSorting = false

	rootCmd := &cobra.Command{
		Use:  "fission",
		Long: usage,
		//SilenceUsage: true,
		// Raw cobra hook (not the cli.Input wrapper) so it can read the executed
		// leaf command's annotations — used to let cluster-optional commands run
		// without a kubeconfig.
		PersistentPreRunE: func(c *cobra.Command, _ []string) error {
			if v, err := c.Flags().GetInt(flagkey.Verbosity); err == nil {
				console.Verbosity = v
			}
			clientOptions.KubeContext, _ = c.Flags().GetString(flagkey.KubeContext)
			client, err := cmd.NewClient(clientOptions)
			if err != nil {
				// Commands marked cluster-optional (e.g. `function run-local
				// --image`) can run without a kubeconfig; defer the failure to the
				// cluster-dependent paths that actually need a client.
				if c.Annotations[cmd.ClusterOptionalAnnotation] == "true" {
					console.Verbose(2, "no Kubernetes configuration found (%v); continuing — cluster features are unavailable", err)
					return nil
				}
				return fmt.Errorf("failed to get fission client: %w", err)
			}
			cmd.SetClientset(*client)
			return nil
		},
	}

	// Workaround fix for not to show help command
	// https://github.com/spf13/cobra/issues/587
	rootCmd.SetHelpCommand(&cobra.Command{
		Use:    "no-help",
		Hidden: true,
	})

	wrapper.SetFlags(rootCmd, flag.FlagSet{
		Global: []flag.Flag{flag.GlobalVerbosity, flag.KubeContext, flag.Namespace},
	})

	groups := helptemplate.CommandGroups{}
	groups = append(groups, helptemplate.CreateCmdGroup("Auth Commands(Note: Authentication should be enabled to use a command in this group.)", token.Commands()))
	groups = append(groups, helptemplate.CreateCmdGroup("Basic Commands", environment.Commands(), _package.Commands(), function.Commands(), archive.Commands(), functionalias.Commands()))
	groups = append(groups, helptemplate.CreateCmdGroup("Trigger Commands", httptrigger.Commands(), mqtrigger.Commands(), timetrigger.Commands(), kubewatch.Commands(), topic.Commands()))
	groups = append(groups, helptemplate.CreateCmdGroup("Workflow Commands", workflow.Commands()))
	groups = append(groups, helptemplate.CreateCmdGroup("Deploy Strategies Commands", canaryconfig.Commands()))
	groups = append(groups, helptemplate.CreateCmdGroup("Declarative Application Commands", spec.Commands()))
	groups = append(groups, helptemplate.CreateCmdGroup("Administration Commands", tenant.Commands()))
	groups = append(groups, helptemplate.CreateCmdGroup("Other Commands", support.Commands(), version.Commands(), check.Commands()))
	groups.Add(rootCmd)

	flagExposer := helptemplate.ActsAsRootCommand(rootCmd, nil, groups...)
	// show global options in usage
	flagExposer.ExposeFlags(rootCmd, flagkey.Server, flagkey.Verbosity, flagkey.KubeContext, flagkey.Namespace)

	return rootCmd
}

```

### Core Architecture Module: `cmd/fission-cli/main.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"os"

	"github.com/fission/fission/cmd/fission-cli/app"
	fv1 "github.com/fission/fission/pkg/apis/core/v1"
	"github.com/fission/fission/pkg/fission-cli/cmd"
	"github.com/fission/fission/pkg/fission-cli/console"
)

func main() {
	// Same fail-closed contract as the server binaries: an exported-but-empty
	// FISSION_INTERNAL_AUTH_SECRET would make every signed CLI call silently
	// fall back to unsigned (and 401 against a verifying cluster) — refuse it
	// with a message that names the variable instead.
	if err := fv1.ValidateInternalAuthEnv(); err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}

	cmd := app.App(cmd.ClientOptions{})
	cmd.SilenceErrors = true // use our own error message printer

	err := cmd.Execute()
	if err != nil {
		// let program exit with non-zero code when error occurs
		console.Error(err.Error())
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/preupgradechecks/adoptsecrets.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"strings"
	"unicode"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"

	"github.com/go-logr/logr"
)

// keepPolicyAnnotation tells Helm never to delete an object it would otherwise
// consider removed from the release.
const keepPolicyAnnotation = "helm.sh/resource-policy"

// AdoptSecretsForKeep stamps helm.sh/resource-policy=keep onto live Secrets so
// the chart can stop rendering them without Helm pruning them on upgrade.
//
// Why this exists. Several Secrets are generated in the templating layer today
// (the internal-auth HMAC master, the router's password/JWT signing key, the
// webhook serving cert). Moving generation out of templating — which RFC-0029
// §3 requires, because `lookup` returns empty under `helm template` and a
// GitOps sync would otherwise re-mint them on every reconcile — means the
// template stops rendering the object. Helm deletes resources that disappear
// from a release, so the naive change PRUNES the live Secret on the first
// upgrade. For the internal-auth master that wedges every control-plane pod in
// CreateContainerConfigError, because internalAuth.envs mounts it with a
// required secretKeyRef.
//
// Why an annotation on the LIVE object works, verified against a real cluster
// (Helm v4.2.3, kind): Helm reads helm.sh/resource-policy from the object as
// it exists in the cluster at delete time, NOT from the stored release
// manifest. A Secret installed WITHOUT the annotation, then annotated
// out-of-band, survives an upgrade that stops rendering it. Pre-upgrade hooks
// complete before Helm applies manifests and computes the deletion set, so
// stamping here is a valid one-release migration — no intermediate release
// that users must pass through.
//
// Why it takes a namespace SET rather than just the release namespace: under
// static tenancy the internal-auth master is replicated into defaultNamespace
// and every additionalFissionNamespaces, because kubelet cannot resolve a
// cross-namespace secretKeyRef. Those copies prune on the same upgrade, and
// they fail differently from the control-plane one — the fetcher mounts them
// with optional: true, so function pods come up UNSIGNED and every storagesvc
// call 401s, with no CreateContainerConfigError to point at the cause.
//
// Idempotent by construction: already-annotated and absent Secrets are both
// no-ops, so this runs harmlessly on every upgrade forever.
func AdoptSecretsForKeep(ctx context.Context, client kubernetes.Interface, logger logr.Logger, namespaces, names []string) error {
	for _, namespace := range namespaces {
		if namespace == "" {
			continue
		}
		if err := adoptInNamespace(ctx, client, logger, namespace, names); err != nil {
			return err
		}
	}
	return nil
}

// adoptInNamespace stamps every named Secret in one namespace.
func adoptInNamespace(ctx context.Context, client kubernetes.Interface, logger logr.Logger, namespace string, names []string) error {
	for _, name := range names {
		if name == "" {
			continue
		}
		// Patch unconditionally rather than reading first. The merge patch is
		// idempotent, so a re-annotation is a no-op that does not even bump
		// resourceVersion — and skipping the read means this identity needs NO
		// get verb at all. That matters: these are the highest-value Secrets in
		// the namespace (the HMAC master, the JWT signing key, the webhook TLS
		// private key), and a grant that cannot read them is worth far more
		// than one that can.
		//
		// A merge patch on the single annotation, rather than a read-modify-
		// write Update, also means it cannot clobber a concurrent writer's
		// changes to the secret's data — which for the HMAC master would be
		// catastrophic.
		patch := []byte(`{"metadata":{"annotations":{"` + keepPolicyAnnotation + `":"keep"}}}`)
		if _, err := client.CoreV1().Secrets(namespace).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{}); err != nil {
			if k8serrors.IsNotFound(err) {
				// A fresh install, or a namespace that never had this Secret.
				logger.Info("no live secret to adopt", "secret", name, "namespace", namespace)
				continue
			}
			return fmt.Errorf("annotate secret %s/%s for retention: %w", namespace, name, err)
		}
		logger.Info("annotated secret for retention across upgrades", "secret", name, "namespace", namespace)
	}
	return nil
}

// adoptSecretNames parses the ADOPT_SECRETS env value, accepting either commas
// or whitespace as separators. Accepting both is deliberate: the chart renders
// this list (today via `join " "`) and nothing cross-checks the two ends, so a
// separator mismatch would silently yield one bogus name like "a b" — which
// RBAC rejects, failing every install. Empty entries are ignored so an empty
// list is a clean no-op.
func adoptSecretNames(raw string) []string {
	return strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || unicode.IsSpace(r)
	})
}

```

### Core Architecture Module: `cmd/preupgradechecks/applycrds.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"time"

	apiextv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"sigs.k8s.io/yaml"

	"github.com/fission/fission/crds"
)

// crdFieldManager is the server-side-apply field manager the hook owns. It is
// distinct from Helm's and from kubectl's so ownership is attributable, and
// stable across releases so successive upgrades converge instead of fighting.
const crdFieldManager = "fission-crd-hook"

// ApplyCRDs server-side-applies the CRD bundle this binary was built with, so
// the schemas and the controllers that depend on them ship as one artifact
// (RFC-0029 §1).
//
// Server-side apply rather than create-or-update, for three reasons: four of
// the generated CRDs exceed the 262,144-byte client-side-apply annotation
// limit, so client-side apply cannot round-trip them at all; SSA creates and
// updates through one call, which a `pre-install,pre-upgrade` hook needs; and
// it makes field ownership explicit and attributable.
//
// The request body is the generated manifest converted to JSON — byte-for-byte
// the intent in crds/v1, with nothing added. Hand-assembling an apply
// configuration would mean maintaining a parallel copy of the CRD schema
// structure, and any field it failed to carry would be silently dropped from
// the applied schema.
//
// force (crds.forceConflicts, default true) applies to EVERY apply, not only
// the first: it exists because CRDs from the documented
// `kubectl create -k crds/v1` flow carry managedFields owned by kubectl-create
// as an Update operation, so an apply from a new field manager conflicts on
// precisely the fields a schema-changing upgrade must change. The cost of
// leaving it on permanently is that it also silently wins against any other
// writer — a hand-added CEL rule on a Fission CRD, or a GitOps controller
// managing the same objects. Setting crds.forceConflicts=false turns that
// silence into a hard conflict error, which is the right choice once an
// install is past adoption; crds.mode=none opts out of chart-managed CRDs
// entirely.
func (client *PreUpgradeTaskClient) ApplyCRDs(ctx context.Context, force bool) error {
	manifests, err := crds.All()
	if err != nil {
		return err
	}
	applying := make([]string, 0, len(manifests))
	for _, m := range manifests {
		name, jsonBytes, err := crdApplyBody(m)
		if err != nil {
			return err
		}
		applied, err := client.apiExtClient.ApiextensionsV1().CustomResourceDefinitions().Patch(
			ctx, name, types.ApplyPatchType, jsonBytes,
			metav1.PatchOptions{FieldManager: crdFieldManager, Force: &force},
		)
		if err != nil {
			return fmt.Errorf("apply CRD %s: %w", name, err)
		}
		applying = append(applying, applied.Name)
		client.logger.Info("applied CRD", "name", applied.Name, "resourceVersion", applied.ResourceVersion)
	}

	// A CRD is not servable the instant the apply returns: the apiserver has
	// to accept the schema and publish discovery, which takes ~100ms. The very
	// next thing this binary does is LIST Functions, so without this wait a
	// fresh install races its own CRD creation and dies on "the server could
	// not find the requested resource" — with backoffLimit 0, that is a failed
	// install, not a retry.
	if err := client.waitForEstablished(ctx, applying); err != nil {
		return err
	}
	client.logger.Info("CRD bundle applied", "count", len(manifests))
	return nil
}

// establishedTimeout bounds the wait for the apiserver to accept and publish
// the applied schemas.
const establishedTimeout = 2 * time.Minute

// waitForEstablished blocks until every named CRD reports Established=True, or
// the timeout elapses. NamesAccepted=False is terminal (a name collision with
// another CRD) and fails immediately rather than burning the whole budget.
func (client *PreUpgradeTaskClient) waitForEstablished(ctx context.Context, names []string) error {
	ctx, cancel := context.WithTimeout(ctx, establishedTimeout)
	defer cancel()
	for _, name := range names {
		err := wait.PollUntilContextCancel(ctx, 100*time.Millisecond, true, func(ctx context.Context) (bool, error) {
			crd, err := client.apiExtClient.ApiextensionsV1().CustomResourceDefinitions().Get(ctx, name, metav1.GetOptions{})
			if err != nil {
				// The object was just applied; a transient read error is worth
				// retrying inside the budget rather than failing the install.
				return false, nil
			}
			for _, c := range crd.Status.Conditions {
				switch {
				case c.Type == apiextv1.Established && c.Status == apiextv1.ConditionTrue:
					return true, nil
				case c.Type == apiextv1.NamesAccepted && c.Status == apiextv1.ConditionFalse:
					return false, fmt.Errorf("CRD %s has conflicting names: %s", name, c.Message)
				}
			}
			return false, nil
		})
		if err != nil {
			return fmt.Errorf("waiting for CRD %s to be established: %w", name, err)
		}
	}
	return nil
}

// crdApplyBody validates one embedded manifest and returns its name plus the
// JSON body to apply. Decoding first is what catches a malformed or non-CRD
// document at the hook rather than as an opaque apiserver rejection, and it
// enforces the same two invariants the admission policy asserts — group is
// exactly fission.io, and no conversion webhook — so the two agree rather
// than one being looser than the other.
func crdApplyBody(m crds.Manifest) (string, []byte, error) {
	var crd apiextv1.CustomResourceDefinition
	if err := yaml.UnmarshalStrict(m.YAML, &crd); err != nil {
		return "", nil, fmt.Errorf("parse embedded CRD %s: %w", m.Name, err)
	}
	if crd.Kind != "CustomResourceDefinition" {
		return "", nil, fmt.Errorf("embedded manifest %s is a %q, not a CustomResourceDefinition", m.Name, crd.Kind)
	}
	if crd.Name == "" {
		return "", nil, fmt.Errorf("embedded CRD %s has no metadata.name", m.Name)
	}
	if crd.Spec.Group != "fission.io" {
		return "", nil, fmt.Errorf("embedded CRD %s declares group %q; this hook only manages fission.io CRDs", m.Name, crd.Spec.Group)
	}
	if c := crd.Spec.Conversion; c != nil && c.Strategy != apiextv1.NoneConverter {
		return "", nil, fmt.Errorf("embedded CRD %s declares conversion strategy %q; Fission CRDs use a single storage version and no conversion webhook", m.Name, c.Strategy)
	}
	jsonBytes, err := yaml.YAMLToJSON(m.YAML)
	if err != nil {
		return "", nil, fmt.Errorf("convert embedded CRD %s to JSON: %w", m.Name, err)
	}
	return crd.Name, jsonBytes, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3610** (2026-08-21): **Flaky: TestAsyncInvocationOnSuccessFunctionDestination times out waiting on the shared async queue under CI contention**
  *Symptoms*: ## Summary  `TestAsyncInvocationOnSuccessFunctionDestination` (suites/serial, RFC-0024) intermittently fails in CI with `Condition never satisfied` after ~120-190s, then passes on rerun.  Observed three times in the last two days on unrelated heads: - PR #3599 head `47980c7e` precursor run, leg v1.36.1 - PR #3599 head `133aaacb` run 30070118449, leg v1.32.11 (122s) - PR #3608 run 30095299405, leg v1.34.8 (190s) — a PR that touches no async code at all  ## Likely mechanism  The test waits for an onSuccess destination fire through the single global async-invocation queue (RFC-0024 design). Under runner contention the delivery/redelivery backoff chain can exceed the test's wait window; the sibling `TestAsyncInvocationDepthCapBounds` showed the same shape once. Related: the settle-budget fix (#3604) removed one source of stuck leases, but the window-vs-backoff race remains.  ## Suggested direction  Either widen the destination-fire wait to comfortably cover the worst-case backoff chain (the async-pin tests in the RFC-0025 suite were recently moved to a 5m window for the same reason), or make the test's function respond immediately so only queue latency (not function latency) is in the budget.

- **Issue #3588** (2026-07-19): **fission function test is broken after router public/internal listener split**
  *Symptoms*: **Fission/Kubernetes version**  <pre> client:   fission/core:     BuildDate: "2026-06-22T12:02:31Z"     GitCommit: 1e1401cd     Version: v1.27.0 server:   fission/core:     BuildDate: "2026-06-22T12:02:31Z"     GitCommit: 1e1401cd     Version: **v1.27.0** </pre>  **Kubernetes platform (e.g. Google Kubernetes Engine)**  OpenShift/Kubernetes.  Fission is installed in the `fission` namespace. Functions are deployed in the `fission-functions` namespace.  **Describe the bug**  `fission function test` consistently returns `404 page not found` on Fission v1.27.0, including for a minimal valid Python function.  The function itself works correctly when invoked through an HTTPTrigger on the public router. The failure is isolated to the direct invocation path used by `fission function test`.  Verbose output shows that the CLI port-forwards to the public router listener on port `8888`, then calls:  <pre> /fission-function/&lt;namespace&gt;/&lt;function&gt; </pre>  That direct invocation endpoint is no longer served by the public listener. The router therefore returns `404` before the request reaches the executor.  The installed router services appear to be configured as expected:  <pre> $ oc -n fission get svc router router-internal \ -o custom-columns='NAME:.metadata.name,PORT:.spec.ports[*].port,TARGET:.spec.ports[*].targetPort' NAME PORT TARGET router 80 8888 router-internal 8889 8889 </pre>  **To Reproduce**  Create a minimal Python function:  <pre> $ cat &gt; hello_min.py &lt;&lt;'P

- **Issue #3059** (2026-06-22): **Creating a route causes the router pod to crash**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! -->  <!-- Documentation URL: https://fission.io/docs --> <!-- Troubleshooting guide: https://fission.io/docs/trouble-shooting/ -->  **Fission/Kubernetes version**  <!-- If you tested with other services, for example Istio, please also provide the version of service as well. -->  <pre> $ fission version v1.20.2 $ kubectl version Client Version: v1.28.13 Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3 Server Version: v1.28.13  </pre>  **Describe the bug** When a route is created using a command, the status of the router pod eventually changes to CrashLoopBackOff. command: fission route create --name all-12 --function all  --url /{url} --method GET --method POST  router pod CrashLoopBackOff： ![image](https://github.com/user-attachments/assets/edf6e8d3-739a-450b-a86d-938de2829c0a)  router  pod log： ![image](https://github.com/user-attachments/assets/bd99ee64-4755-42bd-b1ea-87642341b58e)  executor pod log: ![image](https://github.com/user-attachments/assets/198d23b5-ff44-4c21-b3a2-133316450d78)    **To Reproduce**  <!-- Please provide steps for reproducing the error. --> Use this command to create a route： fission route create --name all-12 --function all  --url /{url} --method GET --method POST  **Additional context** <!--Add any other context about the problem here.--> 
  **Post-Mortem & Fix Analysis**:
  > @sanketsudake
  > Fixed on `main`. Route templates that fail to compile no longer panic the router's route build — they're rejected under panic-recovery and surfaced as `RouteAdmitted=False` on the trigger instead of crash-looping the pod (`pkg/router/httpTriggers.go`), and the router mux was rewritten off gorilla/mux onto the internal httpmux (#3512), which hardened route building further.  Closing as fixed — please reopen with a repro if you still see a crash on a current build.

- **Issue #3034** (2024-10-08): **Fix: an invalid env manifest file breaks the executor component which stops the creation and deletion of envs**
  *Symptoms*: <!--  Thanks for sending a pull request! We request you provide detailed description as much as possible. -->  ## Description <!--- Describe your changes in detail. --> <!-- Typically try to give details of what, why and how of the PR changes. --> - If we create an environment with invalid values in manifest file then environment creation will fail. We will see the respective logs in executor. No issues here. - Now if we delete that environment then `poolmgr` cleanup service is called and `return` statement in this service breaks the Go routine.  ## Which issue(s) this PR fixes: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. --> Fixes #  ## Testing <!--- Please describe in detail how you tested your changes. --> - Create environment manifest using `fission spec` command. ``` $ fission spec init $ fission env create --name go --image ghcr.io/fission/go-env --builder ghcr.io/fission/go-builder --spec ``` - Now edit the `specs/env-go.yaml` file and use an invalid container name for `runtime`. Valid name = envName **spec.runtime.container.name = invalid** ``` apiVersion: fission.io/v1 kind: Environment metadata:   creationTimestamp: null   name: go spec:   builder:     command: build     container:       name: ""       resources: {}     image: ghcr.io/fission/go-builder   imagepullsecret: ""   keeparchive: false   poolsize: 3   resources: {}   runtime:     conta
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/fission/fission/pull/3034?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=fission) Report Attention: Patch coverage is `0%` with `1 line` in your changes missing coverage. Please review. > Project coverage is 45.84%. Comparing base [(`db2b0ad`)](https://app.codecov.io/gh/fission/fission/commit/db2b0ad4a058b03fbd433635995fff98d367a4ae?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=fission) to head [(`c02c9b5`)](https://app.codecov.io/gh/fission/fission/commit/c02c9b5250dc91a8ca20917a35cacffea0adfc79?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=fission). > Report is 2 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/fission/fission/pull/3034?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_s

- **Issue #3023** (2024-09-27): **Unable to create model in fission version 1.20.4 when upgrading from 1.20.1**
  *Symptoms*: **Fission Version:** client:   fission/core:     BuildDate: "2024-09-02T07:18:37Z"     GitCommit: cf55fbec     Version: v1.20.4 server:   fission/core:     BuildDate: "2024-09-02T07:18:37Z"     GitCommit: cf55fbec     Version: v1.20.4  **Kubectl version**  Client Version: v1.26.3 Kustomize Version: v4.5.7 Server Version: v1.28.9  **To Reproduce**  Current version of fission installed: 1.20.1 New Version Installed : 1.20.4  When upgrading the fission version from 1:20.1->1.20.4  Model creation is working fine on 1.20.1   when updated fto 1.20.4 got the following error in router:- 2024-09-20T08:55:54.824961861Z {"level":"info","ts":"2024-09-20T08:55:54.824Z","caller":"crd/client.go:143","msg":"Checking function CRD access","namespace":"default","timeout":"30s"} 2024-09-20T08:55:55.909738766Z {"level":"info","ts":"2024-09-20T08:55:55.909Z","caller":"router/router.go:217","msg":"starting router","port":8888} 2024-09-20T08:55:55.909893968Z {"level":"info","ts":"2024-09-20T08:55:55.909Z","caller":"httpserver/server.go:22","msg":"starting server","service":"router/metrics","addr":":8080"} 2024-09-20T08:55:55.918949597Z {"level":"info","ts":"2024-09-20T08:55:55.909Z","caller":"httpserver/server.go:22","msg":"starting server","service":"router","addr":":8888"} 2024-09-20T09:36:39.124555051Z 2024/09/20 09:36:39 [DEBUG] POST http://executor.fission/v2/getServiceForFunction 2024-09-20T09:36:51.628764549Z 2024/09/20 09:36:51 [DEBUG] POST http://executor.f
  **Post-Mortem & Fix Analysis**:
  > @sanketsudake..we noticed when we updated to 1.20.4..there is no pods in fission-function..  <img width="749" alt="image" src="https://github.com/user-attachments/assets/f47f4b44-23cd-4306-9077-16f0c4370a48">  and in executor pod its giving poolmgr-python-env-build-2-default-535606343-67b4589b89-2xlfq - not found    
  > Please share your helm configuration   ``` helm get values <fission_installation> -n <fission installed _namespace> ```  Also share share specs for function and enviroment  ``` fission fn list  fission env list  ```  I think there may be something wrong at configuration level, which was not supported but being used. 
  > @sanketsudake   **helm get values fission -n fission**  USER-SUPPLIED VALUES: analytics: false builderNamespace: fission-builder defaultNamespace: default functionNamespace: fission-function prometheus:   enabled: false   serviceEndpoint: https://prometheus-kube-prometheus-prometheus.operations.svc.cluster.local routerServiceType: ClusterIP  **fission env list**   <img width="955" alt="image" src="https://github.com/user-attachments/assets/8a5063ef-4671-43f1-9330-5b50998de5c3">   **fission fn list**     <img width="713" alt="image" src="https://github.com/user-attachments/assets/d60473cd-50ce-4c97-8104-50484c354fca">   

- **Issue #3018** (2024-09-30): **Fix slice init length in fetcher pod spec addition**
  *Symptoms*: <!--  Thanks for sending a pull request! We request you provide detailed description as much as possible. -->  ## Description <!--- Describe your changes in detail. --> <!-- Typically try to give details of what, why and how of the PR changes. -->  Fix slice init length   ## Which issue(s) this PR fixes: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. --> Fixes #  ## Testing <!--- Please describe in detail how you tested your changes. -->  ## Checklist: <!-- Please tick following checkboxes as per your understanding. --> - [ ] I ran tests as well as code linting locally to verify my changes.  - [ ] I have done manual verification of my changes, changes working as expected. - [ ] I have added new tests to cover my changes. - [ ] My changes follow contributing guidelines of Fission. - [ ] I have signed all of my commits. 
  **Post-Mortem & Fix Analysis**:
  > @cuishuang Thank you for the PR. Please sign your commit. 
  > > @cuishuang Thank you for the PR. Please sign your commit.  Thanks. Signed.

- **Issue #2926** (2024-06-25): **fission package build stuck in running**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! -->  <!-- Documentation URL: https://fission.io/docs --> <!-- Troubleshooting guide: https://fission.io/docs/trouble-shooting/ -->  **Fission/Kubernetes version** v1.29 <!-- If you tested with other services, for example Istio, please also provide the version of service as well. -->  <pre> $ fission version v1.20.1 $ kubectl version v1.25 </pre>  **Kubernetes platform (e.g. Google Kubernetes Engine)** Amazon EKS  **Describe the bug** <!--A clear and concise description of what the bug is.-->  The packages are getting stuck in the running state, and there are no logs available for the packages. I tried below things: 1. I attempted to create a package out of a simple .py file, but it also became stuck in a running state. 2. I tried deleting everything, including the environment, routes, and all packages, and then created a new package, but the issue persists. 3. The fission check shows everything is functioning correctly, and all pods are operational. 4. I verified the AWS keys in the deployment configuration as well. I checked the logs of the executor and StorageSVC pod, but there are no error logs available to debug this issue. [Using S3 as storage] 5. Tried rollout restarting the whole fission deployments.  **To Reproduce**  <!-- Please provide steps for reproducing the error. --> fission pkg create --sourcearchive new-test.zip --env nodejs --name node-sample-test  **E
  **Post-Mortem & Fix Analysis**:
  > Please follow this the readme for nodejs [examples](https://github.com/fission/examples/tree/main/nodejs) Please check following points: 1.  Use builder while creating nodejs environment ``` $ fission env create --name nodeenv --image fission/node-env:latest --builder fission/node-builder:latest ``` 2. Provide an entry point while creating the function ``` $ fission fn create --name hello --pkg [pkgname] --entrypoint "hello" ```

- **Issue #2917** (2024-05-28): **Router cannot create resource Ingresses**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! -->  <!-- Documentation URL: https://fission.io/docs --> <!-- Troubleshooting guide: https://fission.io/docs/trouble-shooting/ -->  **Fission/Kubernetes version**  <!-- If you tested with other services, for example Istio, please also provide the version of service as well. -->  <pre> $ fission version client:   fission/core:     BuildDate: "2024-01-14T15:43:35Z"     GitCommit: 7e8d5dd7     Version: v1.20.1 server:   fission/core:     BuildDate: "2024-01-14T15:43:35Z"     GitCommit: 7e8d5dd7     Version: v1.20.1  $ kubectl version Client Version: v1.28.2 Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3 Server Version: v1.29.1+k3s2 </pre>  **Kubernetes platform (e.g. Google Kubernetes Engine)** - Self-hosted k3s  **Describe the bug** <!--A clear and concise description of what the bug is.--> ```json {   "level":"error",   "ts":"2024-02-17T19:03:27.056Z",   "logger":"triggerset.http_trigger_set",   "caller":"router/ingress.go:48",   "msg":"failed to create ingress",   "error":"ingresses.networking.k8s.io is forbidden: User \"system:serviceaccount:fission:fission-router\" cannot create resource \"ingresses\" in API group \"networking.k8s.io\" in the namespace \"fission\"","stacktrace":"github.com/fission/fission/pkg/router.createIngress\n\tpkg/router/ingress.go:48" } ``` fission-router has access to create ingress in default namespace, but it try to create i
  **Post-Mortem & Fix Analysis**:
  > I'm also seeing this. I was expecting the ingress to be created in the same namespace as the HttpTrigger, but instead it's being added to the fission namespace. Looking at the CRD there seems to be no way of specifying the ingress namespace.  Can the default be changed to match the namespace of the HttpTrigger, and also an option be added to the CRD for overriding?
  > As a workaround, it seems you can apply the below after helm install, which is just the fission-all/templates/router/role-kubernetes.yaml from the helm chart, with the namespace on each object changed from default to fission.  The ingresses get created in fission namespace but they do work. ``` apiVersion: rbac.authorization.k8s.io/v1 kind: Role metadata:   name: "fission-router"   namespace: fission rules: - apiGroups:   - networking.k8s.io   resources:   - ingresses   verbs:   - create   - get   - list   - watch   - update   - patch   - delete - apiGroups:   - apiextensions.k8s.io   resources:   - customresourcedefinitions   verbs:   - get   - list   - watch --- # Source: fission-all/templates/router/role-kubernetes.yaml kind: RoleBinding apiVersion: rbac.authorization.k8s.io/v1 metadata:   name: "fission-router"   namespace: fission subjects:   - kind: ServiceAccount     name: "fission-router"     namespace: fission roleRef:   kind: Role   na

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

### Incident Patch 1: `c096200b` (2026-09-15)
**Commit Message**: storagesvc/client: pull the MinIO test fixture from quay.io (#3727)

The Docker Hub mirror minio/minio was removed in 2026-09 and now answers
"pull access denied", so dockertest could not start the fixture and the
S3 storage-service test log.Fatal'd on every run — the lint job is red on
main and on every open PR since 2026-09-15. quay.io is MinIO's official
registry; pin a release tag rather than latest so the fixture is
reproducible. Verified locally against colima.

**File**: `pkg/storagesvc/client/storagesvc_test.go` (modified, +6/-2)
```diff
@@ -53,8 +53,12 @@ func MakeTestFile(size int) (*os.File, error) {
 
 func runMinioDockerContainer(pool *dockertest.Pool) *dockertest.Resource {
 	options := &dockertest.RunOptions{
-		Repository: "minio/minio",
-		Tag:        "latest",
+		// quay.io is MinIO's official registry; the Docker Hub mirror
+		// (minio/minio) was removed in 2026-09 and now answers "pull access
+		// denied", which log.Fatal'd this test on every CI run. A release tag,
+		// not "latest", so the fixture is reproducible.
+		Repository: "quay.io/minio/minio",
+		Tag:        "RELEASE.2025-09-07T16-13-09Z",
 		Cmd:        []string{"server", "/data"},
 		PortBindings: map[dc.Port][]dc.PortBinding{
 			"9000/tcp": {{HostIP: "", HostPort: "9000"}},
```

---

### Incident Patch 2: `0052b003` (2026-08-22)
**Commit Message**: test: golden-pin JSON byte contracts and v1 wire fixtures ahead of json/v2 (#3694)

* test: pin the JSON byte-stability contracts ahead of the json/v2 migration

Golden tests fix the exact sha256 output of builderSpecHash and
envRuntimeHash for canonical fixtures, so any marshaler change (including
a future encoding/json/v2 migration) fails loudly instead of shipping a
silent cluster-wide builder rebuild or warm-pool roll.

Comments mark the four sites that stay on encoding/json (v1)
permanently: the two hash sites, the kubewatcher payload printer
(user-visible null-vs-[] emission), and the poolmgr StrategicMergePatch
marshal (null means field deletion in merge-patch semantics).

* test: capture v1 JSON wire fixtures as the compat gate for json/v2

Byte-golden and round-trip fixtures for every durable or cross-version
JSON surface, captured while the tree is still entirely on
encoding/json (v1): workflow checkpoint docs and event payloads, async
Envelope/ResultEnvelope queue payloads, the DLQ two-type probe, MQ
EgressJob, the fetcher statetoken file read by cross-language SDKs, the
fetcher specialize request decoded by long-lived pool-pod fetchers, the
executor client's fv1.Functio

**File**: `hack/run-tlc.sh` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ TLA2TOOLS_VERSION="${TLA2TOOLS_VERSION:-1.8.0}"
 # Implementation-Version "2.0 2026-08-11", X-Git-Revision
 # 0894c3407f4717fec7cc18bde3bf3c857fa47333 on tlaplus master, tlc2/TLC.class
 # present, downloaded from the official tlaplus/tlaplus v1.8.0 release URL.
-TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-ab323b79802aedc3203b3f9af37c6aca3ed43f4e0225b36f2aa77b26de46c05f}"
+TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-eabd140a70f49eb9305a3bd3f3df944eddf87e5a90d329789085f8953a80533a}"
 
 REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 SPECS_DIR="${REPO_ROOT}/docs/rfc/specs"
```

**File**: `pkg/builder/jsonwire_compat_test.go` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package builder
+
+import (
+	"encoding/json"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// compat gate for the json/v2 migration — cross-version RPC wire (rolling-upgrade
+// skew; builder images and pool pods outlive releases); if this fails after a
+// migration commit, add compat options at the marshal site, do not update the
+// fixture.
+//
+// PackageBuildRequest/PackageBuildResponse are the buildermgr<->builder wire
+// types (pkg/builder/client, and the Handler/reply methods in builder.go).
+// The builder binary is baked into environment builder images that are NOT
+// rebuilt per Fission release, so a buildermgr on a new release can be talking
+// to a builder pod running an old image (and vice versa during a rolling
+// upgrade) for a long skew window — any drift in these bytes breaks that pair
+// silently. Both types happen to have no `omitempty` tags at all, so these
+// fixtures pin plain field-value fidelity rather than the struct-omitempty
+// defaulting risk (see pkg/executor/client and pkg/storagesvc for that case).
+
+func TestPackageBuildRequestJSONWireCompat(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name   string
+		req    PackageBuildRequest
+		golden string
+	}{
+		{
+			name: "full",
+			req: PackageBuildRequest{
+				SrcPkgFilename: "pkg-abc123",
+				BuildCommand:   "npm run build",
+			},
+			golden: `{"srcPkgFilename":"pkg-abc123","command":"npm run build"}`,
+		},
+		{
+			name:   "zero_heavy",
+			req:    PackageBuildRequest{},
+			golden: `{"srcPkgFilename":"","command":""}`,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			body, err := json.Marshal(tc.req)
+			require.NoError(t, err)
+			require.Equal(t, tc.golden, string(body),
+				"compat gate for the json/v2 migration — cross-version RPC wire "+
+					"(rolling-upgrade skew; builder images and pool pods outlive "+
+					"releases); if this fails after a migration commit, add compat "+
+					"options at the marshal site, do not update the fixture")
+
+			var decoded PackageBuildRequest
+			require.NoError(t, json.Unmarshal([]byte(tc.golden), &decoded))
+			assert.Equal(t, tc.req, decoded)
+		})
+	}
+}
+
+func TestPackageBuildResponseJSONWireCompat(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name   string
+		resp   PackageBuildResponse
+		golden string
+	}{
+		{
+			name: "full",
+			resp: PackageBuildResponse{
+				ArtifactFilename: "deploy-abc123-xyz",
+				BuildLogs:        "build succeeded\ndone in 4.2s\n",
+			},
+			golden: `{"artifactFilename":"deploy-abc123-xyz","buildLogs":"build succeeded\ndone in 4.2s\n"}`,
+		},
+		{
+			name:   "zero_heavy",
+			resp:   PackageBuildResponse{},
+			golden: `{"artifactFilename":"","buildLogs":""}`,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			body, err := json.Marshal(tc.resp)
+			require.NoError(t, err)
+			require.Equal(t, tc.golden, string(body),
+				"compat gate for the json/v2 migration — cross-version RPC wire "+
+					"(rolling-upgrade skew; builder images and pool pods outlive "+
+					"releases); if this fails after a migration commit, add compat "+
+					"options at the marshal site, do not update the fixture")
+
+			var decoded PackageBuildResponse
+			require.NoError(t, json.Unmarshal([]byte(tc.golden), &decoded))
+			assert.Equal(t, tc.resp, decoded)
+		})
+	}
+}
```

**File**: `pkg/buildermgr/environment_reconciler.go` (modified, +5/-0)
```diff
@@ -637,6 +637,11 @@ func (r *EnvironmentReconciler) genBuilderDeployment(env *fv1.Environment, ns st
 // Sorting by name is safe because container order carries no meaning here: the
 // entrypoint is chosen by name, and init containers are appended by the same
 // merge rather than ordered by the user.
+//
+// This site stays on encoding/json (v1) permanently: the hash is a byte-level
+// contract compared against values stamped by earlier releases, and json/v2
+// changes output bytes (nil slice/map emission, omitempty semantics,
+// escaping). TestBuilderSpecHashGolden pins the exact values.
 func builderSpecHash(tmpl *apiv1.PodTemplateSpec) (string, error) {
 	canonical := tmpl.DeepCopy()
 	sortByName(canonical.Spec.Containers)
```

**File**: `pkg/buildermgr/environment_reconciler_test.go` (modified, +61/-0)
```diff
@@ -475,3 +475,64 @@ func TestBuilderSpecHashIsStableAcrossCalls(t *testing.T) {
 			"hash must not depend on map iteration order (differed on call %d)", i+2)
 	}
 }
+
+// TestBuilderSpecHashGolden pins the exact output of builderSpecHash. The hash
+// is stamped on builder Deployments and compared on every reconcile: if the
+// value moves for an unchanged template, every environment's builder is torn
+// down and rebuilt on the release that shipped the change. This test exists so
+// that any change to canonicalisation, struct field order, or the JSON
+// marshaler feeding sha256 — including a future encoding/json/v2 migration —
+// fails loudly here instead of shipping a silent fleet-wide builder rebuild.
+//
+// If this test fails, DO NOT just update the constants: decide first whether a
+// one-time builder rebuild is acceptable for the release, and release-note it.
+func TestBuilderSpecHashGolden(t *testing.T) {
+	t.Parallel()
+
+	full := &apiv1.PodTemplateSpec{
+		ObjectMeta: metav1.ObjectMeta{
+			Labels: map[string]string{"envName": "golden", "owner": "buildermgr"},
+		},
+		Spec: apiv1.PodSpec{
+			Containers: []apiv1.Container{
+				{
+					Name:    "builder",
+					Image:   "fission/builder:1.2.3",
+					Command: []string{"/builder"},
+					Env: []apiv1.EnvVar{
+						{Name: "B", Value: "2"},
+						{Name: "A", Value: "1"},
+					},
+					VolumeMounts: []apiv1.VolumeMount{
+						{Name: "userfunc", MountPath: "/userfunc"},
+					},
+				},
+				{Name: "fetcher", Image: "fission/fetcher:1.2.3"},
+			},
+			Volumes: []apiv1.Volume{
+				{Name: "userfunc", VolumeSource: apiv1.VolumeSource{
+					EmptyDir: &apiv1.EmptyDirVolumeSource{},
+				}},
+			},
+		},
+	}
+	zero := &apiv1.PodTemplateSpec{}
+
+	tests := []struct {
+		name string
+		tmpl *apiv1.PodTemplateSpec
+		want string
+	}{
+		// Golden values captured on go1.27.0 (encoding/json v1 semantics).
+		{name: "fully populated", tmpl: full, want: "sha256:6693cf48ecdfdec04ee9911fb0326a148c6d702ab1262f7da3a2ae1b372bcef5"},
+		{name: "zero template", tmpl: zero, want: "sha256:103650a8e8747dd18003a892139ffabcb7111196e28ddc389da8e510ec1ef9d7"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			got, err := builderSpecHash(tt.tmpl)
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, got)
+		})
+	}
+}
```

**File**: `pkg/executor/client/jsonwire_compat_test.go` (added, +221/-0)
```diff
@@ -0,0 +1,221 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package client
+
+import (
+	"bytes"
+	"encoding/json"
+	"os"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	asv2 "k8s.io/api/autoscaling/v2"
+	apiv1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/api/resource"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+
+	fv1 "github.com/fission/fission/pkg/apis/core/v1"
+)
+
+// compat gate for the json/v2 migration — cross-version RPC wire (rolling-upgrade
+// skew; builder images and pool pods outlive releases); if this fails after a
+// migration commit, add compat options at the marshal site, do not update the
+// fixture.
+//
+// GetServiceForFunction / EnsureCapacity (pkg/executor/client/client.go) marshal
+// a full *fv1.Function as the RPC request body sent to the executor. fv1's CRD
+// types have several non-pointer struct fields tagged `omitempty` (e.g.
+// FunctionStatus, RetryPolicy) that v1's json.Marshal always emits even when
+// every field of the struct is zero, and several slice fields with no
+// `omitempty` at all (e.g. apiv1.PodSpec.Containers, reachable through
+// FunctionSpec.PodSpec) that v1 emits as JSON null when nil. encoding/json/v2's
+// default omitempty semantics treat a zero-valued struct as empty (it would be
+// OMITTED) and its default nil-slice behavior can differ from v1's `null` — a
+// silent wire-format change an old executor/builder/router on the other side of
+// a rolling upgrade would not tolerate. These tests pin today's exact v1 output
+// so a migration that changes it fails loudly here instead of in production.
+
+// richFunction returns a *fv1.Function with every optional section populated,
+// including the InvocationConfig.Retry sub-struct left at its all-pointers-nil
+// zero value to exercise the same struct-omitempty risk one level deeper.
+func richFunction() *fv1.Function {
+	idle := 120
+	maxAge := metav1.Duration{Duration: 300 * time.Second}
+	return &fv1.Function{
+		TypeMeta: metav1.TypeMeta{
+			Kind:       "Function",
+			APIVersion: "fission.io/v1",
+		},
+		ObjectMeta: metav1.ObjectMeta{
+			Name:            "rich-fn",
+			Namespace:       "test-ns",
+			ResourceVersion: "12345",
+			UID:             types.UID("11111111-1111-1111-1111-111111111111"),
+			Labels: map[string]string{
+				"app": "demo",
+				"env": "prod",
+			},
+			Annotations: map[string]string{
+				"note": "rich fixture",
+			},
+		},
+		Spec: fv1.FunctionSpec{
+			Environment: fv1.EnvironmentReference{
+				Namespace: "test-ns",
+				Name:      "nodejs",
+			},
+			Package: fv1.FunctionPackageRef{
+				PackageRef: fv1.PackageRef{
+					Namespace:       "test-ns",
+					Name:            "rich-pkg",
+					ResourceVersion: "1",
+				},
+				FunctionName: "handler",
+			},
+			Secrets: []fv1.SecretReference{
+				{Namespace: "test-ns", Name: "sec1", MountPath: "sec1"},
+				{Namespace: "test-ns", Name: "sec2"},
+			},
+			ConfigMaps: []fv1.ConfigMapReference{
+				{Namespace: "test-ns", Name: "cm1"},
+			},
+			Env: []apiv1.EnvVar{
+				{Name: "FOO", Value: "bar"},
+			},
+			Resources: apiv1.ResourceRequirements{
+				Limits: apiv1.ResourceList{
+					apiv1.ResourceCPU:    resource.MustParse("200m"),
+					apiv1.ResourceMemory: resource.MustParse("256Mi"),
+				},
+				Requests: apiv1.ResourceList{
+					apiv1.ResourceCPU:    resource.MustParse("100m"),
+					apiv1.ResourceMemory: resource.MustParse("128Mi"),
+				},
+			},
+			InvokeStrategy: fv1.InvokeStrategy{
+				ExecutionStrategy: fv1.ExecutionStrategy{
+					ExecutorType:          fv1.ExecutorTypePoolmgr,
+					MinScale:              1,
+					MaxScale:              3,
+					SpecializationTimeout: 120,
+					Metrics: []asv2.MetricSpec{
+						{Type: asv2.ResourceMetricSourceType},
+					},
+				},
+				StrategyType: fv1.StrategyTypeExecution,
+			},
+			FunctionTimeout: 60,
+			IdleTimeout:     &i
```

---

### Incident Patch 3: `ab333fe4` (2026-08-18)
**Commit Message**: antislop: bump to v0.2.0 and drop the shell workaround (#3686)

v0.2.0 implements natively what hack/antislop.sh was hand-rolling, so
the script goes: 158 lines of bash replaced by two Makefile targets.

The gate is now 'go tool antislop -baseline <file> ./...'. The script
existed only because the analyzer had no baseline flag and no way to
scope a rule to a path, so it reimplemented both — summarising findings
into '<count> <file> <analyzer>' rows, comparing them with awk, and
guarding the exit codes by hand. The baseline file is byte-comparable
either way; only its header changed, now that the tool writes it.

nostructuralnames is ON again. It was disabled for the whole module
because "route shape" is RFC-0013 vocabulary, exposed as the metric
label value shape_changed and in HTTPTrigger condition messages —
giving up the rule everywhere to accommodate one package.
-nostructuralnames.exclude 'pkg/router/...' scopes it instead, and the
finding count is unchanged at 65: every finding the rule reports is in
pkg/router, so nothing outside it was being masked, and the rule now
guards the rest of the tree again.

make antislop gates; make antislop-update re-records. The policy
rational

**File**: `Makefile` (modified, +29/-4)
```diff
@@ -38,12 +38,37 @@ code-checks: verify-gomod
 # Gate the tree with the antislop analyzers (low-evidence Go patterns: any in
 # signatures, narrowing out of any, reflect, structural names, untyped
 # decoding) against hack/antislop-baseline.txt. Runs in CI (lint.yaml); the
-# analyzer is pinned by the tool directive in go.mod. Kept out of code-checks
-# so `make test-run`/`check` stay golangci-only. See hack/antislop.sh for the
-# baseline contract and `hack/antislop.sh --list` for every finding.
+# analyzer is pinned by the tool directive in go.mod.
+#
+# The baseline is a ratchet: a file/analyzer pair that is missing or grows
+# fails the gate, one that shrinks passes and can be re-recorded with
+# `make antislop-update`. Everything in it today is pkg/workflow, and it is
+# one claim — the workflow engine addresses ARBITRARY USER JSON with JSONPath
+# (RFC-0022, Step Functions parity), so there is no named type to decode into.
+# Wrapping the document tree was designed and rejected: a json.RawMessage
+# Document re-decodes per Choice condition, and a generic Value[any] launders
+# the empty interface through a type parameter without adding evidence. The
+# engine-owned shapes that DO have a fixed schema are typed — see catchError
+# and branchErrorCause in pkg/workflow/fold.go.
+#
+# ANTISLOP_FLAGS records the one scoping decision: "route shape" is RFC-0013
+# vocabulary, exposed as the metric label value shape_changed and in
+# HTTPTrigger condition messages, so nostructuralnames is exempted for
+# pkg/router rather than turned off for the whole module.
+#
+# `go tool antislop ./...` on its own lists every finding, baselined or not.
+ANTISLOP_FLAGS ?= -nostructuralnames.exclude 'pkg/router/...'
+ANTISLOP_BASELINE ?= hack/antislop-baseline.txt
+
 .PHONY: antislop
 antislop:
-	hack/antislop.sh
+	go tool antislop $(ANTISLOP_FLAGS) -baseline $(ANTISLOP_BASELINE) ./...
+
+# Re-record the accepted set. Every new line is a design claim; justify it in
+# review rather than regenerating to make the gate quiet.
+.PHONY: antislop-update
+antislop-update:
+	go tool antislop $(ANTISLOP_FLAGS) -baseline $(ANTISLOP_BASELINE) -update ./...
 
 # Fail if go.mod does not keep direct and indirect requirements in separate
 # blocks. `go mod tidy` does not enforce this layout, so this guard does.
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -198,7 +198,7 @@ require (
 	github.com/rogpeppe/go-internal v1.15.0 // indirect
 	github.com/rs/xid v1.6.0 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
-	github.com/sanketsudake/antislop v0.1.0 // indirect
+	github.com/sanketsudake/antislop v0.2.0 // indirect
 	github.com/segmentio/asm v1.1.3 // indirect
 	github.com/segmentio/encoding v0.5.4 // indirect
 	github.com/sergi/go-diff v1.4.0 // indirect
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -453,6 +453,8 @@ github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06 h1:OkMGxebDj
 github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06/go.mod h1:+ePHsJ1keEjQtpvf9HHw0f4ZeJ0TLRsxhunSI2hYJSs=
 github.com/sanketsudake/antislop v0.1.0 h1:+tlU218vHEQt9n2D9rABiShwa/H7N5EPwxk+/MLBGmY=
 github.com/sanketsudake/antislop v0.1.0/go.mod h1:/g3pgt8Zj5nPLTIL5SB8qPhERXKVci5IeYcFGL9tzao=
+github.com/sanketsudake/antislop v0.2.0 h1:1c5gcCUiv1pNCFGtTE/IyNSaHz1UsJi816YOJ+q52WY=
+github.com/sanketsudake/antislop v0.2.0/go.mod h1:/g3pgt8Zj5nPLTIL5SB8qPhERXKVci5IeYcFGL9tzao=
 github.com/sanketsudake/go-portless v0.4.0 h1:jT2dF5Fbe84SI1mXe54bqY9jXTWZCVIEaJtX6hjki+k=
 github.com/sanketsudake/go-portless v0.4.0/go.mod h1:jRGHM6BOYLizSy8fvFfQOX9pmBayEuAWpOz8GYhrPbI=
 github.com/sanketsudake/go-portless/k8s v0.3.0 h1:upMXPHIcFPeeQXIUTxUlfgvxVbMZx3oqXWyBOrYj3VU=
```

**File**: `hack/antislop-baseline.txt` (modified, +11/-26)
```diff
@@ -1,44 +1,29 @@
-# antislop findings accepted for this repository.
+# antislop findings accepted for this tree, written by 'antislop -baseline <file> -update'.
 #
-# Format: <count> <file> <analyzer>. No line numbers on purpose — an
-# edit above a finding must not churn this file. Regenerate with
-# 'hack/antislop.sh --update'; the gate is 'hack/antislop.sh'.
+# Format: <count> <file> <analyzer>. No line numbers on purpose, so an edit
+# above a finding does not churn this file.
 #
-# Everything listed here is pkg/workflow, and all of it is one claim:
-# the workflow engine addresses ARBITRARY USER JSON with JSONPath
-# (RFC-0022, Step Functions parity), so there is no named type to
-# decode into — the schema belongs to the user, not to us. Wrapping
-# the tree was designed and rejected: a json.RawMessage-backed
-# Document re-decodes the whole document per Choice condition, and a
-# generic Value[any] launders the empty interface through a type
-# parameter without adding any evidence. Each narrowing site here is
-# a comma-ok or a type switch whose default branch is correct.
-#
-# The engine-owned shapes that DO have a fixed schema are typed:
-# see catchError / branchErrorCause in pkg/workflow/fold.go. The two
-# noknownwidening entries are those structs being handed to
-# expr.Path.SetResult, which takes any because the tree it writes
-# into is user JSON.
-#
-# Adding a line here is a design claim. Justify it in review.
+# The gate fails when a file/analyzer pair is missing from this list or its
+# count grows; a pair that shrinks passes. Every line is a claim that the
+# pattern is right for that file — justify new ones in review.
 1 pkg/workflow/decide_test.go noanycontainers
 1 pkg/workflow/decide_test.go nountypedunmarshal
 3 pkg/workflow/engine_branch_test.go noanycontainers
 3 pkg/workflow/engine_branch_test.go nountypedunmarshal
 2 pkg/workflow/engine_branch_test.go safetycomment
-18 pkg/workflow/expr/eval_test.go noanycontainers
-1 pkg/workflow/expr/eval_test.go noanyfields
 2 pkg/workflow/expr/eval.go noanyparams
 2 pkg/workflow/expr/eval.go noanyreturns
-1 pkg/workflow/fold_branch_test.go noanycontainers
-1 pkg/workflow/fold_branch_test.go nountypedunmarshal
+18 pkg/workflow/expr/eval_test.go noanycontainers
+1 pkg/workflow/expr/eval_test.go noanyfields
 1 pkg/workflow/fold.go noanyfields
 1 pkg/workflow/fold.go noanyreturns
 2 pkg/workflow/fold.go noknownwidening
 1 pkg/workflow/fold.go nonarrowany
 1 pkg/workflow/fold.go nountypedunmarshal
+1 pkg/workflow/fold_branch_test.go noanycontainers
+1 pkg/workflow/fold_branch_test.go nountypedunmarshal
 3 pkg/workflow/invoker.go nountypedunmarshal
-10 pkg/workflow/paths_test.go noanycontainers
 6 pkg/workflow/paths.go noanyparams
 2 pkg/workflow/paths.go noanyreturns
 3 pkg/workflow/paths.go nonarrowany
+10 pkg/workflow/paths_test.go noanycontainers
```

**File**: `hack/antislop.sh` (removed, +0/-158)
```diff
@@ -1,158 +0,0 @@
-#!/bin/bash
-# SPDX-FileCopyrightText: The Fission Authors
-#
-# SPDX-License-Identifier: Apache-2.0
-#
-# Runs the antislop analyzers (github.com/sanketsudake/antislop) over the
-# module. antislop rejects code that destroys or fabricates type evidence:
-# `any` in signatures, fields and containers, narrowing back out of `any`,
-# reflect, monkey patching, structural names, and untyped decoding.
-#
-# The analyzer is pinned by the `tool` directive in go.mod and invoked with
-# `go tool antislop`, the same way this repo pins addlicense, controller-gen
-# and setup-envtest. Set $ANTISLOP to a locally built binary to run an
-# unreleased build against the tree (for developing the analyzer itself).
-#
-# Usage:
-#   make antislop                    gate the tree against the baseline
-#   hack/antislop.sh                 same, directly
-#   hack/antislop.sh --list          print every finding, baselined or not
-#   hack/antislop.sh --update        rewrite the baseline from the current tree
-#   hack/antislop.sh ./pkg/router/…  report on specific packages (no gating)
-#
-# Gating is against hack/antislop-baseline.txt, which records the ACCEPTED
-# findings as "<count> <file> <analyzer>" — deliberately without line numbers,
-# so unrelated edits above a finding do not churn it. The gate fails when a
-# file/analyzer pair appears that the baseline does not list, or when a
-# baselined pair grows. A pair that shrinks passes.
-#
-# The cost of dropping line numbers is that a net-zero swap within one
-# file/analyzer pair — delete one finding, introduce another — is not caught.
-# Diff stability is worth more than catching that case; the alternative churns
-# the baseline on every edit above a finding.
-#
-# A baseline exists because the standalone binary has no per-package scoping
-# and honours no //nolint directive, so the only alternatives would be to
-# disable an analyzer for the whole module or to leave the tree ungated.
-# Read hack/antislop-baseline.txt before adding to it: every entry there is a
-# claim that `any` is the honest type at that spot, not a to-do.
-
-set -euo pipefail
-
-cd "$(dirname "$0")/.."
-
-BASELINE="hack/antislop-baseline.txt"
-
-if [ -n "${ANTISLOP:-}" ]; then
-	bin=("$ANTISLOP")
-else
-	# `go tool`, not `go run`: go run reports its own exit 1 for any non-zero
-	# child status, which would make "found findings" (3) indistinguishable
-	# from "failed to build" (1), and it writes progress lines into the
-	# stream the gate parses.
-	bin=(go tool antislop)
-fi
-
-# Flags that record deliberate policy for this repository. Add a comment for
-# every deviation from the analyzer defaults.
-#
-# nostructuralnames is off: its only default term is "shape", and in this
-# repository "route shape" is RFC-0013 vocabulary — the set of HTTPTrigger
-# fields whose change forces a mux rebuild — that is exposed as the metric
-# label value shape_changed / shape_change and in HTTPTrigger condition
-# messages. Renaming the identifiers alone would split the vocabulary and
-# renaming the labels is a user-visible metrics change. The analyzer has no
-# per-package exemption (-nostructuralnames.terms replaces the whole list).
-POLICY_FLAGS=(-nostructuralnames=false)
-
-# summarize turns raw findings into the baseline's "<count> <file> <analyzer>"
-# form, sorted so the file is stable across runs.
-summarize() {
-	sed -E 's#^\./##; s#^'"$PWD"'/##; s#:[0-9]+:[0-9]+: ([a-z]+):.*#\t\1#' |
-		sort | uniq -c | awk '{print $1, $2, $3}' | sort -k2,2 -k3,3
-}
-
-# run invokes the analyzer. Exit codes follow go/analysis singlechecker:
-# 0 = clean, 3 = diagnostics reported (the normal case here). Anything else
-# means it did not run at all — 1 for a package load error, 2 for a bad flag,
-# 127 for a missing binary. Those must never be mistaken for a clean tree, so
-# they abort loudly instead of yielding empty output the gate would read as
-# "no findings".
-run() {
-	local out status
-	out="$("${bin[@]}" "${POLICY_FL
```

---

### Incident Patch 4: `abcb8dec` (2026-08-17)
**Commit Message**: Remove low-evidence Go patterns; fix --graceperiod defaulting to 0 (#3684)

* throttler: make RunOnce generic over the callback result

RunOnce returned the callback's result as an untyped value, so every
caller narrowed it back with a type assertion (and two of them panicked
on a mismatch that the compiler can now rule out). It is a package-level
generic function now; the follower-timeout path returns the zero T with
the error, and the router resolver checks err instead of a nil result.

Adds a synctest-based test for the follower-timeout path.

* poolmgr: store a typed value in podFSVCMap

The pod→function/address map held a two-element []any that the CPU
metrics collector unpacked with a pair of type assertions. Store a
podFuncSvc struct instead; the one remaining assertion on sync.Map.Load
carries its SAFETY invariant.

* poolmgr: build the pod relabel patch from a typed struct

Replaces the nested map[string]any literal with podRelabelPatch. No
omitempty on the maps on purpose: a nil map must still marshal as null
(delete semantics under StrategicMergePatchType).

* canaryconfigmgr: switch on the prometheus value type directly

executeQuery compared val.Type() and then asserte

**File**: `.github/workflows/lint.yaml` (modified, +7/-0)
```diff
@@ -75,6 +75,13 @@ jobs:
           version: ${{ env.GOLANGCI_LINT_VERSION }}
           args: --timeout=${{ env.GOLANGCI_LINT_TIMEOUT }}
 
+      # Gates low-evidence Go patterns against hack/antislop-baseline.txt.
+      # Fails on a finding the baseline does not already accept; see
+      # hack/antislop.sh for the contract. The analyzer is pinned by the
+      # tool directive in go.mod.
+      - name: Run antislop
+        run: make antislop
+
       - name: Detect git changes
         if: always()
         run: |
```

**File**: `Makefile` (modified, +10/-0)
```diff
@@ -35,6 +35,16 @@ check: test-run build-fission-cli clean
 code-checks: verify-gomod
 	golangci-lint run
 
+# Gate the tree with the antislop analyzers (low-evidence Go patterns: any in
+# signatures, narrowing out of any, reflect, structural names, untyped
+# decoding) against hack/antislop-baseline.txt. Runs in CI (lint.yaml); the
+# analyzer is pinned by the tool directive in go.mod. Kept out of code-checks
+# so `make test-run`/`check` stay golangci-only. See hack/antislop.sh for the
+# baseline contract and `hack/antislop.sh --list` for every finding.
+.PHONY: antislop
+antislop:
+	hack/antislop.sh
+
 # Fail if go.mod does not keep direct and indirect requirements in separate
 # blocks. `go mod tidy` does not enforce this layout, so this guard does.
 # Convention: .claude/resources/go-mod-conventions.md
```

**File**: `cmd/preupgradechecks/applycrds_test.go` (modified, +4/-3)
```diff
@@ -14,6 +14,7 @@ import (
 
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 
 	"github.com/fission/fission/crds"
 )
@@ -38,10 +39,10 @@ func TestEmbeddedCRDsAreApplyable(t *testing.T) {
 
 		// The apply body must be valid JSON carrying the same identity, or
 		// the apiserver rejects the patch.
-		var decoded map[string]any
+		var decoded metav1.TypeMeta
 		require.NoError(t, json.Unmarshal(body, &decoded), m.Name)
-		assert.Equal(t, "apiextensions.k8s.io/v1", decoded["apiVersion"], m.Name)
-		assert.Equal(t, "CustomResourceDefinition", decoded["kind"], m.Name)
+		assert.Equal(t, "apiextensions.k8s.io/v1", decoded.APIVersion, m.Name)
+		assert.Equal(t, "CustomResourceDefinition", decoded.Kind, m.Name)
 	}
 
 	// Spot-check the CRDs the control plane cannot start without, so a
```

**File**: `go.mod` (modified, +2/-0)
```diff
@@ -198,6 +198,7 @@ require (
 	github.com/rogpeppe/go-internal v1.15.0 // indirect
 	github.com/rs/xid v1.6.0 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
+	github.com/sanketsudake/antislop v0.1.0 // indirect
 	github.com/segmentio/asm v1.1.3 // indirect
 	github.com/segmentio/encoding v0.5.4 // indirect
 	github.com/sergi/go-diff v1.4.0 // indirect
@@ -256,6 +257,7 @@ require (
 tool (
 	github.com/elastic/crd-ref-docs
 	github.com/google/addlicense
+	github.com/sanketsudake/antislop/cmd/antislop
 	k8s.io/code-generator
 	sigs.k8s.io/controller-runtime/tools/setup-envtest
 	sigs.k8s.io/controller-tools/cmd/controller-gen
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -451,6 +451,8 @@ github.com/russross/blackfriday/v2 v2.1.0/go.mod h1:+Rmxgy9KzJVeS9/2gXHxylqXiyQD
 github.com/rwcarlsen/goexif v0.0.0-20190401172101-9e8deecbddbd/go.mod h1:hPqNNc0+uJM6H+SuU8sEs5K5IQeKccPqeSjfgcKGgPk=
 github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06 h1:OkMGxebDjyw0ULyrTYWeN0UNCCkmCWfjPnIA2W6oviI=
 github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06/go.mod h1:+ePHsJ1keEjQtpvf9HHw0f4ZeJ0TLRsxhunSI2hYJSs=
+github.com/sanketsudake/antislop v0.1.0 h1:+tlU218vHEQt9n2D9rABiShwa/H7N5EPwxk+/MLBGmY=
+github.com/sanketsudake/antislop v0.1.0/go.mod h1:/g3pgt8Zj5nPLTIL5SB8qPhERXKVci5IeYcFGL9tzao=
 github.com/sanketsudake/go-portless v0.4.0 h1:jT2dF5Fbe84SI1mXe54bqY9jXTWZCVIEaJtX6hjki+k=
 github.com/sanketsudake/go-portless v0.4.0/go.mod h1:jRGHM6BOYLizSy8fvFfQOX9pmBayEuAWpOz8GYhrPbI=
 github.com/sanketsudake/go-portless/k8s v0.3.0 h1:upMXPHIcFPeeQXIUTxUlfgvxVbMZx3oqXWyBOrYj3VU=
```

---

### Incident Patch 5: `a455a040` (2026-08-09)
**Commit Message**: Internal communication: targeted transport and HMAC body-handling fixes (#3673)

* router: correct stale executorResolver doc comment

Since the EndpointSlice data plane became the default (RFC-0002), warm
poolmgr traffic is admitted from the slice-fed endpoint index and never
reaches this resolver. The comment still claimed poolmgr lookups always
RPC the executor, which mis-describes the hot path for anyone auditing
router latency. Describe the actual routes that take the RPC.

* publisher: give webhook publishers a dedicated pooled transport

The webhook publisher (kubewatcher, timer, mqtrigger) drove the router
internal listener through bare http.DefaultTransport, whose process-wide
2-idle-conns-per-host pool lets unrelated traffic evict the publisher's
keep-alive connection between events — every eviction costs a fresh TCP
dial on the next publish. Share one httpx.PooledTransport base across
publishers, matching the other internal clients (kafka consumer, MCP
proxy, executor client).

The publisher's send loop stays serialized, so this is a keep-alive
stability fix, not a concurrency change.

* fetcher/storagesvc clients: share a pooled base transport

Both clients rode bare ht

**File**: `docs/internal-auth/00-design.md` (modified, +5/-4)
```diff
@@ -294,12 +294,13 @@ The complexity is not justified when HKDF gives the same isolation from one mast
 The scheme has known limitations operators should plan around.
 
 **Maximum body size.**
-The verifier reads the entire request body into memory before computing the signature so the body bytes can be re-injected for downstream handlers (multipart parsers, etc.).
-That cost is bounded by `VerifierOpts.MaxBodyBytes` (default 256 MiB, set on each registration).
+The verifier must drain the entire request body before computing the signature so the body bytes can be re-injected for downstream handlers (multipart parsers, etc.).
+The size of a body it accepts is bounded by `VerifierOpts.MaxBodyBytes` (default 256 MiB, set on each registration).
 Bodies that exceed the cap are rejected with `413 Request Entity Too Large` *before* signature verification — i.e. an unauthenticated attacker cannot use a giant unsigned body to DoS a signed service.
 Operators that legitimately need to upload archives larger than 256 MiB should bump the cap rather than disable enforcement; the cap is the largest archive size we expect to see in practice.
-For the one bulk-data endpoint, `storagesvc /v1/archive`, the cap is operator-tunable: set the Helm value `storagesvc.maxArchiveSizeMib` (env var `STORAGE_MAX_ARCHIVE_SIZE_MIB`), and size the storagesvc memory request/limit to match, since the body is held in memory during verification.
-The other registrations (fetcher, builder, executor, router-internal) carry small control-plane payloads and keep the 256 MiB default.
+For the one bulk-data endpoint, `storagesvc /v1/archive`, the cap is operator-tunable: set the Helm value `storagesvc.maxArchiveSizeMib` (env var `STORAGE_MAX_ARCHIVE_SIZE_MIB`).
+Whether the drained body is *held in memory* is a separate knob: with `VerifierOpts.SpoolThresholdBytes` set (storagesvc sets 4 MiB), over-threshold bodies are hashed while streaming to a temp file and re-read from it, so verifier memory is bounded by the threshold — raising the archive cap no longer requires raising the storagesvc memory request/limit to match.
+The other registrations (fetcher, builder, executor, router-internal) carry small or latency-sensitive payloads and stay fully in-memory with the 256 MiB default cap (the router internal listener caps at 64 MiB).
 For very large packages, OCI-native delivery (`packageRegistry`) is the better-managed alternative to raising the cap — the code is pulled and mounted from a registry rather than buffered through storagesvc.
 
 **Replay within the skew window.**
```

**File**: `pkg/auth/hmac/hmac.go` (modified, +41/-8)
```diff
@@ -33,32 +33,65 @@ import (
 	"fmt"
 )
 
+// BodyHashHex returns hex(SHA256(body)) — the body component of the
+// canonical string. A nil body hashes identically to an empty one, so
+// bodiless requests (GETs) canonicalize the same whether the caller
+// passes nil or []byte{}.
+func BodyHashHex(body []byte) string {
+	bodyHash := sha256.Sum256(body)
+	return hex.EncodeToString(bodyHash[:])
+}
+
+// emptyBodyHashHex is the canonical body component for bodiless requests,
+// precomputed once so signer and verifier don't rehash emptiness per request.
+var emptyBodyHashHex = BodyHashHex(nil)
+
+// CanonicalFromHash is Canonical for callers that already hold the body's
+// SHA-256 (hex) — computed once across several Verify candidates, or
+// streamed without buffering the body. bodyHashHex MUST be hex(SHA256(body))
+// for the exact bytes on the wire.
+func CanonicalFromHash(method, requestURI, bodyHashHex string, timestampSec int64) string {
+	minute := timestampSec - (timestampSec % 60)
+	return fmt.Sprintf("%s\n%s\n%s\n%d", method, requestURI, bodyHashHex, minute)
+}
+
 // Canonical returns the canonical string that is fed into HMAC-SHA256.
 // timestampSec is rounded down to the nearest minute. The `requestURI`
 // argument should be path + raw query (e.g. r.URL.RequestURI()), not
 // just the path — query parameters MUST be bound to the signature for
 // services like storagesvc that key on `?id=`.
 func Canonical(method, requestURI string, body []byte, timestampSec int64) string {
-	bodyHash := sha256.Sum256(body)
-	minute := timestampSec - (timestampSec % 60)
-	return fmt.Sprintf("%s\n%s\n%s\n%d", method, requestURI, hex.EncodeToString(bodyHash[:]), minute)
+	return CanonicalFromHash(method, requestURI, BodyHashHex(body), timestampSec)
+}
+
+// SignFromHash is Sign for callers that already hold hex(SHA256(body))
+// (see CanonicalFromHash).
+func SignFromHash(secret []byte, method, requestURI, bodyHashHex string, timestampSec int64) string {
+	mac := cryptohmac.New(sha256.New, secret)
+	mac.Write([]byte(CanonicalFromHash(method, requestURI, bodyHashHex, timestampSec)))
+	return hex.EncodeToString(mac.Sum(nil))
 }
 
 // Sign returns hex(HMAC-SHA256(secret, Canonical(...))). `requestURI`
 // is path + raw query (see Canonical).
 func Sign(secret []byte, method, requestURI string, body []byte, timestampSec int64) string {
-	mac := cryptohmac.New(sha256.New, secret)
-	mac.Write([]byte(Canonical(method, requestURI, body, timestampSec)))
-	return hex.EncodeToString(mac.Sum(nil))
+	return SignFromHash(secret, method, requestURI, BodyHashHex(body), timestampSec)
+}
+
+// VerifyFromHash is Verify for callers that already hold hex(SHA256(body)) —
+// the verifier middleware hashes the body once and reuses it across candidate
+// keys (active, rotation, per-namespace) instead of rehashing per candidate.
+func VerifyFromHash(secret []byte, method, requestURI, bodyHashHex string, timestampSec int64, sig string) bool {
+	want := SignFromHash(secret, method, requestURI, bodyHashHex, timestampSec)
+	return cryptohmac.Equal([]byte(want), []byte(sig))
 }
 
 // Verify is a constant-time signature check at the request's own timestamp.
 // Use VerifyWithSkew for clock-skew tolerance; bare Verify is intended for
 // callers that have already validated freshness (e.g. unit tests).
 // `requestURI` is path + raw query (see Canonical).
 func Verify(secret []byte, method, requestURI string, body []byte, timestampSec int64, sig string) bool {
-	want := Sign(secret, method, requestURI, body, timestampSec)
-	return cryptohmac.Equal([]byte(want), []byte(sig))
+	return VerifyFromHash(secret, method, requestURI, BodyHashHex(body), timestampSec, sig)
 }
 
 // VerifyWithSkew accepts the signature if the request timestamp is within
```

**File**: `pkg/auth/hmac/signer.go` (modified, +67/-30)
```diff
@@ -6,6 +6,8 @@ package hmac
 
 import (
 	"bytes"
+	"crypto/sha256"
+	"encoding/hex"
 	"io"
 	"net/http"
 	"strconv"
@@ -29,7 +31,9 @@ const (
 
 // Signer is an http.RoundTripper wrapper that signs every outgoing request
 // with the HMAC scheme described in the design at docs/internal-auth/00-design.md.
-// It buffers the request body to compute the body hash, then re-injects it.
+// It streams the body hash from GetBody when the request has one, and only
+// falls back to buffering the body (re-injecting it afterwards) when it
+// doesn't — see bodyHashForRequest.
 //
 // A Signer constructed with an empty secret short-circuits to pass-through:
 // it forwards the request to the inner transport unmodified, without
@@ -68,42 +72,75 @@ func (s *Signer) RoundTrip(r *http.Request) (*http.Response, error) {
 	if len(s.secret) == 0 {
 		return s.rt.RoundTrip(r)
 	}
-	var body []byte
-	if r.Body != nil {
-		original := r.Body
-		var err error
-		body, err = io.ReadAll(original)
-		// Close the original body before replacing it: callers that hand
-		// in a real *os.File-backed io.ReadCloser would otherwise leak
-		// the underlying file descriptor.
-		closeErr := original.Close()
-		if err != nil {
-			return nil, err
-		}
-		if closeErr != nil {
-			return nil, closeErr
-		}
-		r.Body = io.NopCloser(bytes.NewReader(body))
-		// GetBody must be repopulated alongside Body. Rewind-aware
-		// retry layers (net/http's replay after a broken connection,
-		// pkg/utils/httpretry) refuse to retry a request whose GetBody
-		// is nil, so leaving it unset silently makes signed requests
-		// un-retryable; and a naive caller re-submitting the same
-		// *http.Request re-reads the consumed reader above and sends —
-		// re-signed on the second pass through this signer — an EMPTY
-		// body, which the verifier happily accepts: silent success with
-		// an empty payload rather than a 401.
-		r.GetBody = func() (io.ReadCloser, error) {
-			return io.NopCloser(bytes.NewReader(body)), nil
-		}
+	bodyHash, err := bodyHashForRequest(r)
+	if err != nil {
+		return nil, err
 	}
 	ts := s.now().Unix()
 	// Sign over the request-URI (path + raw query) so query parameters
 	// like ?id= are bound to the signature. Signing the path alone would
 	// let an attacker replay a captured /v1/archive?id=A signature
 	// against a different ?id=B within the skew window.
-	sig := Sign(s.secret, r.Method, r.URL.RequestURI(), body, ts)
+	sig := SignFromHash(s.secret, r.Method, r.URL.RequestURI(), bodyHash, ts)
 	r.Header.Set(HeaderTimestamp, strconv.FormatInt(ts, 10))
 	r.Header.Set(HeaderSignature, sig)
 	return s.rt.RoundTrip(r)
 }
+
+// bodyHashForRequest returns hex(SHA256(body)) for the request's body,
+// preferring a streaming read over buffering.
+//
+// When GetBody is set (net/http populates it automatically for requests
+// built from *bytes.Buffer / *bytes.Reader / *strings.Reader, and
+// file-backed callers can set it themselves), the hash is streamed from a
+// fresh GetBody reader and the request's Body/GetBody are left untouched —
+// the transport streams the original body, so the signer holds no copy of
+// it. This matters for archive uploads, whose multipart body previously got
+// a second full in-memory copy here just to be hashed.
+//
+// Without GetBody, the body is buffered and re-injected (Body AND GetBody —
+// rewind-aware retry layers, net/http's replay after a broken connection and
+// pkg/utils/httpretry, refuse to retry a request whose GetBody is nil, so
+// leaving it unset silently makes signed requests un-retryable; and a naive
+// caller re-submitting the same *http.Request would re-read the consumed
+// reader and send — re-signed on the second pass — an EMPTY body, which the
+// verifier happily accepts: silent success with an empty payload rather
+// than a 401).
+func bodyHashForRequest(r *http.Request) (string, error) {
+	if r.GetBody != nil {
+		fresh, err := r.GetBody()
+		if err != nil {
+			return "", err
+		}
+		h :=
```

**File**: `pkg/auth/hmac/signer_test.go` (modified, +46/-0)
```diff
@@ -115,6 +115,52 @@ func TestSignerRepopulatesGetBody(t *testing.T) {
 		"the retried attempt must re-send (and re-sign) the original body, never an empty one")
 }
 
+// TestSignerStreamsHashViaGetBody pins the no-buffer contract: when a
+// request is rewindable (GetBody set — net/http populates it for requests
+// built from bytes/strings readers, which covers every JSON client and the
+// storagesvc archive upload), the signer must stream the body hash from a
+// fresh GetBody reader and leave Body/GetBody untouched, rather than
+// buffering a second full copy of the body just to hash it.
+func TestSignerStreamsHashViaGetBody(t *testing.T) {
+	secret := []byte("test-secret-must-be-32-bytes-min")
+
+	var gotBody string
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		body, _ := io.ReadAll(r.Body)
+		ts, err := strconv.ParseInt(r.Header.Get(HeaderTimestamp), 10, 64)
+		require.NoError(t, err)
+		require.True(t, Verify(secret, r.Method, r.URL.Path, body, ts, r.Header.Get(HeaderSignature)),
+			"the streamed hash must sign the exact bytes on the wire")
+		gotBody = string(body)
+		w.WriteHeader(200)
+	}))
+	t.Cleanup(srv.Close)
+
+	req, err := http.NewRequest(http.MethodPost, srv.URL+"/v1/archive", strings.NewReader("payload"))
+	require.NoError(t, err)
+	require.NotNil(t, req.GetBody, "precondition: net/http must have made the request rewindable")
+
+	// Count GetBody calls and remember the original hooks so we can assert
+	// the signer read a fresh reader once and replaced nothing.
+	origBody := req.Body
+	origGetBody := req.GetBody
+	getBodyCalls := 0
+	req.GetBody = func() (io.ReadCloser, error) {
+		getBodyCalls++
+		return origGetBody()
+	}
+
+	signer := NewSigner(secret, http.DefaultTransport, time.Now)
+	resp, err := signer.RoundTrip(req)
+	require.NoError(t, err)
+	_ = resp.Body.Close()
+
+	assert.Equal(t, 200, resp.StatusCode)
+	assert.Equal(t, "payload", gotBody, "the transport must still stream the original body")
+	assert.Equal(t, 1, getBodyCalls, "the hash must be streamed from exactly one fresh GetBody reader")
+	assert.True(t, req.Body == origBody, "the signer must not replace a rewindable request's Body")
+}
+
 // TestSignerBindsQueryParameter pins the security-critical contract from
 // the design doc (docs/internal-auth/00-design.md): a captured signature
 // for /v1/archive?id=A must NOT verify against /v1/archive?id=B within
```

**File**: `pkg/auth/hmac/spool.go` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package hmac
+
+import (
+	"bytes"
+	"crypto/sha256"
+	"encoding/hex"
+	"errors"
+	"io"
+	"os"
+)
+
+// bodySpool holds a request body the verifier drained while hashing it:
+// in memory when it fit within the spool threshold, in a temp file when it
+// did not. Exactly one of mem/file is set.
+type bodySpool struct {
+	hashHex string
+	mem     []byte
+	file    *os.File
+}
+
+// spoolBody drains src, hashing as it reads. Bodies up to threshold bytes
+// stay in memory (the historical behavior); anything larger spills to a
+// temp file, so the caller's memory stays bounded by the threshold no
+// matter how large the body is. On error the returned spool (if any) has
+// already been cleaned up.
+func spoolBody(src io.Reader, threshold int64) (*bodySpool, error) {
+	h := sha256.New()
+	tee := io.TeeReader(src, h)
+	var buf bytes.Buffer
+	// Read one byte past the threshold: landing EOF at or before
+	// threshold+1 means the whole body fit and stays in memory.
+	_, err := io.CopyN(&buf, tee, threshold+1)
+	if errors.Is(err, io.EOF) {
+		return &bodySpool{hashHex: hex.EncodeToString(h.Sum(nil)), mem: buf.Bytes()}, nil
+	}
+	if err != nil {
+		return nil, err
+	}
+	f, err := os.CreateTemp("", "fission-hmac-body-*")
+	if err != nil {
+		return nil, err
+	}
+	sp := &bodySpool{file: f}
+	if _, err := f.Write(buf.Bytes()); err != nil {
+		sp.cleanup()
+		return nil, err
+	}
+	if _, err := io.Copy(f, tee); err != nil {
+		sp.cleanup()
+		return nil, err
+	}
+	sp.hashHex = hex.EncodeToString(h.Sum(nil))
+	return sp, nil
+}
+
+// reader returns the spooled body, rewound, for re-injection as r.Body.
+// Call it once. Both arms wrap with io.NopCloser so a handler's deferred
+// r.Body.Close() cannot close the temp file out from under cleanup, which
+// owns the file's lifecycle (io.NopCloser also forwards WriterTo, keeping
+// *os.File's copy fast path available to whoever drains the body).
+func (s *bodySpool) reader() (io.ReadCloser, error) {
+	if s.file == nil {
+		return io.NopCloser(bytes.NewReader(s.mem)), nil
+	}
+	if _, err := s.file.Seek(0, io.SeekStart); err != nil {
+		return nil, err
+	}
+	return io.NopCloser(s.file), nil
+}
+
+// cleanup closes and removes the temp file, if any. Idempotent; call it
+// (deferred) once the downstream handler has returned.
+func (s *bodySpool) cleanup() {
+	if s.file == nil {
+		return
+	}
+	name := s.file.Name()
+	_ = s.file.Close()
+	_ = os.Remove(name)
+	s.file = nil
+}
```

---

### Incident Patch 6: `f3eeb709` (2026-08-06)
**Commit Message**: fix(router): re-scope EndpointSlice cache for runtime-onboarded tenants (#3647) (#3653)

* fix(router): re-scope EndpointSlice cache for runtime-onboarded tenants (#3647)

Dynamic tenancy onboards namespaces at runtime, but the router's
EndpointSlice informer was scoped once at startup and the router SA had
no RoleBinding in the new tenant namespace — so the RFC-0002 warm path
never saw a runtime-onboarded tenant's slices and every request fell
back to the executor RPC.

RBAC: render a fission-router-dataplane-tenant ClusterRole in dynamic
mode, add fission-router to the admission-policy SA allowlist, and have
the tenant controller bind it per namespace at onboarding (deleted at
offboard).

Data plane: replace the manager-cache informer with per-namespace
informers (NamespaceInformers) in dynamic mode. A resolver-sync hook
re-scopes the set on every FissionTenant change. Teardown is fenced:
Sync cancels, waits for the informer's goroutines to drain
(factory.Shutdown), and only then sweeps the index — all under one lock,
so offboard/re-onboard overlap cannot resurrect stale endpoints or wipe
a replacement informer's fresh entries.

Readiness: namespaces that fail the EndpointSlice R

**File**: `charts/fission-all/templates/tenant-controller/_tenant-workload-roles.tpl` (modified, +5/-0)
```diff
@@ -32,4 +32,9 @@ tests (a drift would fail tenant onboarding / the admission-policy test).
   rules: fissionFunction.builderRules
 - name: fission-fetcher-websocket-tenant-workload
   rules: fissionFunction.fetcherWebsocketRules
+# router-dataplane: read Fission-managed EndpointSlices + Services in tenant
+# namespaces (RFC-0002 warm path). The dynamic twin of the static per-namespace
+# Role in router/role-dataplane.yaml; pkg/tenant/provision.go binds this by name.
+- name: fission-router-dataplane-tenant
+  rules: router-dataplane-kuberules
 {{- end -}}
```

**File**: `charts/fission-all/templates/tenant-controller/admission-policy.yaml` (modified, +4/-4)
```diff
@@ -12,8 +12,8 @@
 # them to an attacker-controlled ServiceAccount, granting that SA the namespace's
 # secret/configmap read. This policy rejects ANY RoleBinding that references a
 # tenant-workload ClusterRole unless every subject is one of the fixed Fission
-# fetcher/builder/executor/buildermgr ServiceAccounts — so the grant can only ever
-# reach Fission's own pods, never an arbitrary SA.
+# fetcher/builder/executor/buildermgr/router ServiceAccounts — so the grant can
+# only ever reach Fission's own pods, never an arbitrary SA.
 #
 # It is a cluster-wide ValidatingAdmissionPolicy (GA in k8s 1.30; the chart's floor
 # is 1.32) keyed on the binding's roleRef, so it applies to the binding SHAPE, not
@@ -49,12 +49,12 @@ spec:
     - expression: >
         !has(object.subjects) || object.subjects.all(s,
           s.kind == 'ServiceAccount' && s.name in [
-            'fission-fetcher', 'fission-builder', 'fission-executor', 'fission-buildermgr'
+            'fission-fetcher', 'fission-builder', 'fission-executor', 'fission-buildermgr', 'fission-router'
           ])
       reason: Forbidden
       message: >
         a RoleBinding to a Fission tenant-workload ClusterRole may only bind the
-        fixed fission fetcher/builder/executor/buildermgr ServiceAccounts
+        fixed fission fetcher/builder/executor/buildermgr/router ServiceAccounts
 ---
 apiVersion: admissionregistration.k8s.io/v1
 kind: ValidatingAdmissionPolicyBinding
```

**File**: `charts/fission-all/templates/tenant-controller/rbac.yaml` (modified, +2/-1)
```diff
@@ -62,7 +62,8 @@ rules:
   - deletecollection
 # Bind ONLY the fixed-name tenant-workload ClusterRoles into tenant namespaces (via
 # the RoleBindings the controller provisions): the executor/buildermgr workload
-# roles AND the fetcher/builder/fetcher-websocket function-pod read roles.
+# roles, the fetcher/builder/fetcher-websocket function-pod read roles, AND the
+# router-dataplane EndpointSlice + Service read role.
 # resourceNames-scoped: the controller cannot bind any other ClusterRole, so it
 # cannot escalate itself to arbitrary cluster permissions.
 - apiGroups:
```

**File**: `pkg/apis/core/v1/const.go` (modified, +7/-2)
```diff
@@ -369,8 +369,11 @@ const (
 	// Control-plane ServiceAccounts (in the install/release namespace) that need
 	// workload RBAC in each tenant namespace under dynamic tenancy. The tenant
 	// controller binds them to the *TenantWorkloadClusterRole below per namespace.
+	// FissionRouterSA is the router's data-plane SA, bound to
+	// RouterDataplaneTenantClusterRole for EndpointSlice + Service reads.
 	FissionExecutorSA   = "fission-executor"
 	FissionBuildermgrSA = "fission-buildermgr"
+	FissionRouterSA     = "fission-router"
 
 	// The *TenantWorkloadClusterRole names are the fixed-name ClusterRoles
 	// (chart-rendered only in dynamic mode) holding the per-namespace rules a
@@ -379,13 +382,15 @@ const (
 	// install-independent (dynamic tenancy is one Fission install per cluster,
 	// since it watches cluster-wide). Executor/buildermgr carry workload-management
 	// rules; fetcher/builder/fetcher-websocket carry the function-pod sidecar read
-	// rules — all single-sourced from the chart's shared partials so the static
-	// and dynamic paths cannot drift.
+	// rules; router-dataplane carries the EndpointSlice + Service read grant for
+	// the RFC-0002 warm path — all single-sourced from the chart's shared partials
+	// so the static and dynamic paths cannot drift.
 	ExecutorTenantWorkloadClusterRole         = "fission-executor-tenant-workload"
 	BuildermgrTenantWorkloadClusterRole       = "fission-buildermgr-tenant-workload"
 	FetcherTenantWorkloadClusterRole          = "fission-fetcher-tenant-workload"
 	BuilderTenantWorkloadClusterRole          = "fission-builder-tenant-workload"
 	FetcherWebsocketTenantWorkloadClusterRole = "fission-fetcher-websocket-tenant-workload"
+	RouterDataplaneTenantClusterRole          = "fission-router-dataplane-tenant"
 )
 
 const (
```

**File**: `pkg/router/dynamic_endpoint_cache_test.go` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package router
+
+import (
+	"context"
+	"sync/atomic"
+	"testing"
+	"testing/synctest"
+	"time"
+
+	"github.com/go-logr/logr"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	authorizationv1 "k8s.io/api/authorization/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/manager"
+
+	"github.com/fission/fission/pkg/router/endpointcache"
+	"github.com/fission/fission/pkg/utils"
+)
+
+// addOnlyManager lets setupDynamicEndpointCache register its startup runnable
+// without starting a full controller-runtime manager. No other Manager method
+// is used while setupDynamicEndpointCache is being called.
+type addOnlyManager struct {
+	ctrl.Manager
+}
+
+func (*addOnlyManager) Add(manager.Runnable) error {
+	return nil
+}
+
+// TestSetupDynamicEndpointCacheReusesPreflightRBAC verifies that namespaces
+// approved by the startup preflight are reused by the initial dynamic-cache
+// sync instead of issuing the same SelfSubjectAccessReviews again.
+func TestSetupDynamicEndpointCacheReusesPreflightRBAC(t *testing.T) {
+	kubeClient := fake.NewSimpleClientset()
+	var sarCalls atomic.Int32
+	kubeClient.PrependReactor("create", "selfsubjectaccessreviews", func(action k8stesting.Action) (bool, runtime.Object, error) {
+		sarCalls.Add(1)
+		sar := action.(k8stesting.CreateAction).GetObject().(*authorizationv1.SelfSubjectAccessReview)
+		return true, &authorizationv1.SelfSubjectAccessReview{
+			Spec:   sar.Spec,
+			Status: authorizationv1.SubjectAccessReviewStatus{Allowed: true},
+		}, nil
+	})
+
+	precheckedNamespaces := sliceWatchNamespaces()
+	require.NotEmpty(t, precheckedNamespaces)
+
+	ctx, cancel := context.WithCancel(t.Context())
+	t.Cleanup(cancel)
+	_, hooks, err := setupDynamicEndpointCache(
+		ctx,
+		kubeClient,
+		endpointcache.NewIndex(),
+		&addOnlyManager{},
+		nil,
+		logr.Discard(),
+		precheckedNamespaces,
+	)
+	require.NoError(t, err)
+	require.Len(t, hooks, 1)
+
+	pending := hooks[0]()
+	assert.False(t, pending)
+	assert.Zero(t, sarCalls.Load(), "preflight-approved namespaces must not repeat SARs during dynamic-cache setup")
+}
+
+// newDynamicCacheTest builds a dynamicEndpointCache backed by a fake clientset
+// whose SAR reactor consults the allowedNS map. A namespace present with value
+// true → SAR Allowed=true; absent or false → Allowed=false. The map is shared
+// so tests can flip a namespace's RBAC state between calls (the re-onboard
+// scenario). Returns the cache and the resolver (so tests can onboard/offboard).
+func newDynamicCacheTest(t *testing.T, allowedNS map[string]bool) (*dynamicEndpointCache, *utils.NamespaceResolver) {
+	t.Helper()
+	kubeClient := fake.NewSimpleClientset()
+	kubeClient.PrependReactor("create", "selfsubjectaccessreviews", func(action k8stesting.Action) (bool, runtime.Object, error) {
+		sar := action.(k8stesting.CreateAction).GetObject().(*authorizationv1.SelfSubjectAccessReview)
+		ns := sar.Spec.ResourceAttributes.Namespace
+		return true, &authorizationv1.SelfSubjectAccessReview{
+			Spec:   sar.Spec,
+			Status: authorizationv1.SubjectAccessReviewStatus{Allowed: allowedNS[ns]},
+		}, nil
+	})
+	resolver := &utils.NamespaceResolver{}
+	nsi := endpointcache.NewNamespaceInformers(kubeClient, endpointcache.NewIndex(), logr.Discard())
+	t.Cleanup(nsi.Close)
+	dynCache := &dynamicEndpointCache{
+		kubeClient:  kubeClient,
+		resolver:    resolver,
+		nsInformers: nsi,
+		logger:      logr.Discard(),
+	}
+	return dynCache, resolver
+}
+
+// TestDynamicCacheAllowedCachesAndIncludes verifies the happy path: a namespace
+// that passes SAR is cached in rbacChecked, included in the informer set, and
+// does not report pending.
+func TestDynamicCacheAllowedCachesAndIncludes(t *testing.T) {
+	t.Parallel()
+	al
```

---

### Incident Patch 7: `9c716f90` (2026-08-04)
**Commit Message**: executor: create-routed reconciles must converge the deployment spec — fixes the swallowed-update staleness behind the TestFunctionNameUpdate flake (#3662)

* executor: create-routed reconciles must converge the deployment spec, or a coalesced update is swallowed forever

TestFunctionNameUpdate flaked with the route serving the OLD entrypoint's
body for its full 180s window — status 200, "alpha" — after fn update had
demonstrably landed on the API object. Attempt-level forensics on the
failed run split the two instances: attempt 1 was the (since-fixed) DNS
cascade killing the router->executor RPC; attempt 2 had zero DNS lines and
is this bug.

The reconcile routing has create-routed branches that can be handed a spec
UPDATE: newdeploy's drift-recreate branch (resourcesExist false), and both
of container's create-routed branches. createFunction only adopts/scales
an existing deployment — it never rewrites the pod spec. So when such a
branch fires on the reconcile that carries a spec change (a create+update
coalesced into the first reconcile, or resourcesExist false-alarming from
Manager-cache lag on the update's own reconcile), the deployment is
adopted on its old spec, the reconcil

**File**: `pkg/executor/executortype/container/containermgr.go` (modified, +47/-0)
```diff
@@ -16,6 +16,7 @@ import (
 
 	appsv1 "k8s.io/api/apps/v1"
 	apiv1 "k8s.io/api/core/v1"
+	apiequality "k8s.io/apimachinery/pkg/api/equality"
 	k8sErrs "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/labels"
@@ -606,6 +607,40 @@ func (caaf *Container) updateFunction(ctx context.Context, oldFn *fv1.Function,
 	return nil
 }
 
+// reconcileDeploymentSpec brings an already-existing deployment up to the
+// function's current spec when it lags — the container-type mirror of
+// newdeploy's helper, and the level-trigger half of every create-routed
+// reconcile (see createAndConverge in reconciler.go for why it must follow
+// createFunction). The deployment carries the function's ResourceVersion as
+// an annotation (getDeployAnnotations); compare it and push the current spec
+// when stale. A no-op when already current.
+func (caaf *Container) reconcileDeploymentSpec(ctx context.Context, fn *fv1.Function) error {
+	// Live entry only: versioned projections sharing the UID pin immutable
+	// snapshots that must not be rewritten to the live spec.
+	fsvc, err := caaf.fsCache.GetLiveByFunctionUID(fn.UID)
+	if err != nil {
+		// Not specialized yet — no deployment to reconcile; the on-demand path
+		// creates it from the current spec on first invocation.
+		return nil
+	}
+	ns := caaf.nsResolver.GetFunctionNS(fn.Namespace)
+	existingDepl, err := caaf.kubernetesClient.AppsV1().Deployments(ns).Get(ctx, fsvc.Name, metav1.GetOptions{})
+	if err != nil {
+		if k8sErrs.IsNotFound(err) {
+			return nil
+		}
+		return err
+	}
+	deplRV := existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION]
+	if deplRV == fn.ResourceVersion {
+		return nil // deployment already reflects the current function spec
+	}
+	caaf.logger.Info("reconciling stale deployment to current function spec",
+		"function", fn.Name, "deployment", fsvc.Name,
+		"deployment_rv", deplRV, "function_rv", fn.ResourceVersion)
+	return caaf.updateFuncDeployment(ctx, fn)
+}
+
 func (caaf *Container) updateFuncDeployment(ctx context.Context, fn *fv1.Function) error {
 	// Live entry only — see updateFunction: versioned projections' entries
 	// share the UID but must keep their pinned spec.
@@ -638,6 +673,18 @@ func (caaf *Container) updateFuncDeployment(ctx context.Context, fn *fv1.Functio
 		return err
 	}
 
+	// A Deployment's selector is immutable, and for container functions it is
+	// derived from the Function CR's own labels (getDeployLabels copies them),
+	// which can change without bumping Generation. An in-place Update with a
+	// different selector is rejected by the API server; returning nil (not an
+	// error) avoids requeuing forever against a permanently immutable field —
+	// the same guard newdeploy's updateFuncDeployment carries.
+	if !apiequality.Semantic.DeepEqual(existingDepl.Spec.Selector, newDeployment.Spec.Selector) {
+		caaf.logger.Info("deployment selector changed (function labels changed); cannot update in place, leaving existing deployment",
+			"deployment", fnObjName, "function", fn.Name)
+		return nil
+	}
+
 	err = caaf.updateDeployment(ctx, newDeployment, ns)
 	if err != nil {
 		caaf.updateStatus(fn, err, "failed to update deployment while updating function")
```

**File**: `pkg/executor/executortype/container/reconciler.go` (modified, +22/-4)
```diff
@@ -19,6 +19,7 @@ import (
 type functionManager interface {
 	createFunction(context.Context, *fv1.Function) (*fscache.FuncSvc, error)
 	updateFunction(context.Context, *fv1.Function, *fv1.Function) error
+	reconcileDeploymentSpec(context.Context, *fv1.Function) error
 	deleteFunction(context.Context, *fv1.Function) error
 	// resourcesExist reports whether the function's backing Deployment and Service
 	// are present (read from the Manager cache). False means they drifted away
@@ -49,20 +50,37 @@ func (caaf *Container) DeleteFunction(ctx context.Context, fn *fv1.Function) err
 // get-or-create path rather than diffing a no-longer-existent object.
 func reconcileContainerFunc(ctx context.Context, mgr functionManager, old, fn *fv1.Function) error {
 	if old == nil {
-		_, err := mgr.createFunction(ctx, fn)
-		return err
+		return createAndConverge(ctx, mgr, fn)
 	}
 	exist, err := mgr.resourcesExist(ctx, fn)
 	if err != nil {
 		return err
 	}
 	if !exist {
-		_, err := mgr.createFunction(ctx, fn)
-		return err
+		return createAndConverge(ctx, mgr, fn)
 	}
 	return mgr.updateFunction(ctx, old, fn)
 }
 
+// createAndConverge is the create-routed path both branches above take, mirroring
+// newdeploy: create (or adopt) the function's backing objects, then bring the
+// deployment to the current spec. reconcileDeploymentSpec is a no-op when the
+// deployment already reflects fn.
+//
+// The second step is not optional. createFunction only adopts/scales an existing
+// deployment — it never rewrites the pod spec — so when this reconcile is the ONLY
+// carrier of a spec change (a create and an update coalesced into one first
+// reconcile, or a drift false-alarm from cache lag on the update's own reconcile),
+// adopting without a respec consumes the update permanently: lastReconciled stores
+// the new spec, GenerationChangedPredicate filters resyncs, and no event ever
+// re-fires.
+func createAndConverge(ctx context.Context, mgr functionManager, fn *fv1.Function) error {
+	if _, err := mgr.createFunction(ctx, fn); err != nil {
+		return err
+	}
+	return mgr.reconcileDeploymentSpec(ctx, fn)
+}
+
 // RegisterReconcilers registers no type-specific watches: the container type's
 // Function reconciles are handled by the shared executor-level Function
 // reconciler (see funcreconciler.RegisterReconciler), which it plugs into via
```

**File**: `pkg/executor/executortype/container/reconciler_test.go` (modified, +30/-5)
```diff
@@ -17,40 +17,56 @@ import (
 )
 
 type fakeFuncMgr struct {
-	created, updated, deleted []string
-	resourcesGone             bool // resourcesExist returns false (drift)
+	created, updated, deleted, reconciled []string
+	calls                                 []string // ordered call log: "create", "converge", "update"
+	createErr                             error    // injected createFunction failure
+	resourcesGone                         bool     // resourcesExist returns false (drift)
 }
 
 func (f *fakeFuncMgr) resourcesExist(_ context.Context, _ *fv1.Function) (bool, error) {
 	return !f.resourcesGone, nil
 }
 
 func (f *fakeFuncMgr) createFunction(_ context.Context, fn *fv1.Function) (*fscache.FuncSvc, error) {
+	f.calls = append(f.calls, "create")
+	if f.createErr != nil {
+		return nil, f.createErr
+	}
 	f.created = append(f.created, fn.Name)
 	return nil, nil
 }
 func (f *fakeFuncMgr) updateFunction(_ context.Context, old, _ *fv1.Function) error {
+	f.calls = append(f.calls, "update")
 	f.updated = append(f.updated, old.Name)
 	return nil
 }
 func (f *fakeFuncMgr) deleteFunction(_ context.Context, fn *fv1.Function) error {
 	f.deleted = append(f.deleted, fn.Name)
 	return nil
 }
+func (f *fakeFuncMgr) reconcileDeploymentSpec(_ context.Context, fn *fv1.Function) error {
+	f.calls = append(f.calls, "converge")
+	f.reconciled = append(f.reconciled, fn.Name)
+	return nil
+}
 
 func fnOfType(name string, et fv1.ExecutorType) *fv1.Function {
 	fn := &fv1.Function{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"}}
 	fn.Spec.InvokeStrategy.ExecutionStrategy.ExecutorType = et
 	return fn
 }
 
+// Every create-routed reconcile must chase createFunction with
+// reconcileDeploymentSpec — see createAndConverge for why skipping it swallows a
+// coalesced update permanently.
 func TestReconcileContainerFunc(t *testing.T) {
 	fn := fnOfType("fn", fv1.ExecutorTypeContainer)
 
-	t.Run("create (old == nil) creates the function", func(t *testing.T) {
+	t.Run("create (old == nil) creates the function and converges the spec", func(t *testing.T) {
 		mgr := &fakeFuncMgr{}
 		require.NoError(t, reconcileContainerFunc(t.Context(), mgr, nil, fn))
-		assert.Equal(t, []string{"fn"}, mgr.created)
+		assert.Equal(t, []string{"create", "converge"}, mgr.calls,
+			"createFunction adopts without a respec; the chaser must run AFTER it")
 		assert.Empty(t, mgr.updated)
 	})
 
@@ -59,15 +75,24 @@ func TestReconcileContainerFunc(t *testing.T) {
 		require.NoError(t, reconcileContainerFunc(t.Context(), mgr, fn, fn))
 		assert.Equal(t, []string{"fn"}, mgr.updated)
 		assert.Empty(t, mgr.created)
+		assert.Empty(t, mgr.reconciled, "the diff path owns spec convergence on plain updates")
 	})
 
 	t.Run("drift: missing backing resources are recreated, not diffed", func(t *testing.T) {
 		mgr := &fakeFuncMgr{resourcesGone: true}
 		require.NoError(t, reconcileContainerFunc(t.Context(), mgr, fn, fn))
-		assert.Equal(t, []string{"fn"}, mgr.created, "drifted-away resources must be recreated via get-or-create")
+		assert.Equal(t, []string{"create", "converge"}, mgr.calls,
+			"the chase must FOLLOW the create — a drift false-alarm converges the adopted deployment, in that order")
 		assert.Empty(t, mgr.updated, "no diff against a non-existent object")
 	})
 
+	t.Run("create failure short-circuits the chaser", func(t *testing.T) {
+		mgr := &fakeFuncMgr{resourcesGone: true, createErr: assert.AnError}
+		require.Error(t, reconcileContainerFunc(t.Context(), mgr, fn, fn))
+		assert.Equal(t, []string{"create"}, mgr.calls,
+			"a failed create must propagate before the converge runs; the retry re-enters the whole branch")
+	})
+
 	t.Run("DeleteFunction tears down the function", func(t *testing.T) {
 		// DeleteFunction delegates straight to deleteFunction; exercise the wiring.
 		mgr := &fakeFuncMgr{}
```

**File**: `pkg/executor/executortype/container/reconcilespec_test.go` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package container
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/kubernetes/fake"
+
+	fv1 "github.com/fission/fission/pkg/apis/core/v1"
+	"github.com/fission/fission/pkg/executor/fscache"
+	hpautils "github.com/fission/fission/pkg/executor/util/hpa"
+	"github.com/fission/fission/pkg/utils"
+	"github.com/fission/fission/pkg/utils/loggerfactory"
+)
+
+func newSpecTestContainer(t *testing.T) *Container {
+	t.Helper()
+	logger := loggerfactory.GetLogger()
+	kubeClient := fake.NewClientset()
+	return &Container{
+		logger:           logger,
+		kubernetesClient: kubeClient,
+		fsCache:          fscache.MakeFunctionServiceCache(logger),
+		nsResolver:       utils.DefaultNSResolver(),
+		hpaops:           hpautils.NewHpaOperations(logger, kubeClient, "test-instance"),
+	}
+}
+
+func countDeploymentUpdates(t *testing.T, caaf *Container) int {
+	t.Helper()
+	n := 0
+	for _, a := range caaf.kubernetesClient.(*fake.Clientset).Actions() {
+		if a.GetVerb() == "update" && a.GetResource().Resource == "deployments" {
+			n++
+		}
+	}
+	return n
+}
+
+// seedFnWithDeployment creates the function's deployment via the production
+// spec builder (so the selector and annotations are the real ones), records it
+// in the fake clientset, and registers the live fsvc entry the helper resolves
+// through. The deployment's RV annotation is whatever fn.ResourceVersion was at
+// seed time.
+func seedFnWithDeployment(t *testing.T, caaf *Container, fn *fv1.Function) string {
+	t.Helper()
+	objName := caaf.getObjName(fn)
+	one := int32(1)
+	depl, err := caaf.getDeploymentSpec(t.Context(), fn, &one, objName, "default",
+		caaf.getDeployLabels(fn.ObjectMeta), caaf.getDeployAnnotations(fn.ObjectMeta))
+	require.NoError(t, err)
+	_, err = caaf.kubernetesClient.AppsV1().Deployments("default").Create(t.Context(), depl, metav1.CreateOptions{})
+	require.NoError(t, err)
+	_, err = caaf.fsCache.Add(fscache.FuncSvc{
+		Name:     objName,
+		Function: &fn.ObjectMeta,
+		Address:  "10.0.0.1:8888",
+		Executor: fv1.ExecutorTypeContainer,
+	})
+	require.NoError(t, err)
+	return objName
+}
+
+// TestContainerReconcileDeploymentSpec pins the helper's four branches — the
+// RV-equal no-op is the idempotency claim every create-routed reconcile leans
+// on, and the stale branch is the level-trigger that un-swallows a coalesced
+// update.
+func TestContainerReconcileDeploymentSpec(t *testing.T) {
+	t.Parallel()
+
+	t.Run("no live cache entry is a no-op", func(t *testing.T) {
+		t.Parallel()
+		caaf := newSpecTestContainer(t)
+		fn := newTestContainerFunction()
+		fn.UID = "00000000-0000-0000-0000-000000000001"
+		require.NoError(t, caaf.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countDeploymentUpdates(t, caaf))
+	})
+
+	t.Run("deployment gone is a no-op, not an error", func(t *testing.T) {
+		t.Parallel()
+		caaf := newSpecTestContainer(t)
+		fn := newTestContainerFunction()
+		fn.UID = "00000000-0000-0000-0000-000000000002"
+		_, err := caaf.fsCache.Add(fscache.FuncSvc{
+			Name: "vanished", Function: &fn.ObjectMeta, Address: "10.0.0.9:8888", Executor: fv1.ExecutorTypeContainer,
+		})
+		require.NoError(t, err)
+		require.NoError(t, caaf.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countDeploymentUpdates(t, caaf))
+	})
+
+	t.Run("matching RV annotation issues no update", func(t *testing.T) {
+		t.Parallel()
+		caaf := newSpecTestContainer(t)
+		fn := newTestContainerFunction()
+		fn.UID = "00000000-0000-0000-0000-000000000003"
+		fn.ResourceVersion = "41"
+		seedFnWithDeployment(t, caaf, fn)
+		require.NoError(t, caaf.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countDeploymentUpdates(t, caaf), "an already-current deployment must not be rewritten")
+	})
+
+	t.Run("stale RV annotation pushes
```

**File**: `pkg/executor/executortype/newdeploy/newdeploymgr.go` (modified, +11/-13)
```diff
@@ -700,15 +700,11 @@ func (deploy *NewDeploy) updateFunction(ctx context.Context, oldFn *fv1.Function
 }
 
 // reconcileDeploymentSpec brings an already-existing deployment up to the
-// function's current spec when it lags. createFunction only *adopts/scales* an
-// existing deployment (it does not rewrite the pod spec), and updateFunction is
-// diff-based against the last-reconciled object. So if a function's create and a
-// later spec update coalesce into a single first reconcile — common when the
-// router specializes the function on-demand (creating the deployment) just before
-// `fission fn update` lands — the deployment can be left on the old spec with no
-// transition for updateFunction to diff. The deployment carries the function's
-// ResourceVersion as a metadata annotation (getDeployAnnotations), so compare it:
-// if stale, push the current spec. A no-op when already current.
+// function's current spec when it lags — the level-trigger half of every
+// create-routed reconcile (see createAndConverge in reconciler.go for why it
+// must follow createFunction). The deployment carries the function's
+// ResourceVersion as a metadata annotation (getDeployAnnotations), so compare
+// it: if stale, push the current spec. A no-op when already current.
 func (deploy *NewDeploy) reconcileDeploymentSpec(ctx context.Context, fn *fv1.Function) error {
 	// Live entry only: fn is the live Function CR here, and versioned
 	// projections sharing its UID pin immutable snapshots that must not be
@@ -727,17 +723,18 @@ func (deploy *NewDeploy) reconcileDeploymentSpec(ctx context.Context, fn *fv1.Fu
 		}
 		return err
 	}
-	if existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION] == fn.ResourceVersion {
+	deplRV := existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION]
+	if deplRV == fn.ResourceVersion {
 		return nil // deployment already reflects the current function spec
 	}
 	env, err := deploy.fissionClient.CoreV1().Environments(fn.Spec.Environment.Namespace).
 		Get(ctx, fn.Spec.Environment.Name, metav1.GetOptions{})
 	if err != nil {
 		return err
 	}
-	deploy.logger.Info("reconciling stale deployment to current function spec on first sight",
+	deploy.logger.Info("reconciling stale deployment to current function spec",
 		"function", fn.Name, "deployment", fsvc.Name,
-		"deployment_rv", existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION], "function_rv", fn.ResourceVersion)
+		"deployment_rv", deplRV, "function_rv", fn.ResourceVersion)
 	return deploy.updateFuncDeployment(ctx, fn, env)
 }
 
@@ -979,7 +976,8 @@ func (deploy *NewDeploy) DumpDebugInfo(ctx context.Context) error {
 // that lands in the pod template but is missing from this diff leaves the CR
 // and the running container disagreeing indefinitely, because updateFunction
 // is the only steady-state path that rewrites the template (the RV-annotation
-// catch-all in reconcileDeploymentSpec runs only on the old == nil branch).
+// catch-all in reconcileDeploymentSpec runs only on create-routed reconciles —
+// first sight and drift-recreate — never on the plain update path).
 func podTemplateChanged(oldFn, newFn *fv1.Function) bool {
 	return oldFn.Spec.Environment != newFn.Spec.Environment ||
 		oldFn.Spec.Package.PackageRef != newFn.Spec.Package.PackageRef ||
```

---

### Incident Patch 8: `9c564d37` (2026-08-04)
**Commit Message**: api: Environment.TerminationGracePeriod becomes *int64 so typed clients can say 0 (#3657)

An explicit terminationGracePeriod: 0 (no drain window; instant kill) was a
raw-YAML-only setting: on the int64 field, omitempty dropped a zero before
the apiserver saw it, and the CRD default served the absence back as 90. The
CLI accepted --graceperiod 0 and silently produced a 90s environment.

The pointer restores 0 as a first-class value — nil means "use the default"
and marshals as absent, a set 0 reaches the wire and is kept — pinned by a
wire-contract test. In-process readers go through a new
EffectiveTerminationGracePeriod(), which folds nil to the CRD default's
in-process mirror for objects that never crossed the apiserver.

Pool-roll stability: envRuntimeHash is fed the EFFECTIVE value, so nil and
an explicit 90 hash alike and the hash is byte-identical across this
migration — no warm-pod recycle wave on the release that ships it (pinned
alongside the discriminator's other cases). The benchmark harness guards
its EnvOptions conversion so an unset option stays nil instead of becoming
an explicit instant-kill zero.

CLI: create/update hand the flag value through as a pointer; an upda

**File**: `RELEASES.md` (modified, +2/-2)
```diff
@@ -78,8 +78,8 @@ Set `terminationGracePeriod` per environment if your functions serve requests lo
 This is the **Environment-level** grace only; the container executor's function-level `--graceperiod` keeps its 360s default.
 How it reaches existing objects: CRD structural defaults apply when the apiserver **serves** an object, not only at write time — so an Environment stored without the field reads back as 90 the moment the upgraded CRD is applied, with no object update.
 Practically, every such environment's pods roll **once** on the first executor reconcile after this upgrade (the pod template's grace changes 0→90); that roll is the fix taking effect.
-Only an explicit `terminationGracePeriod: 0` applied as raw YAML keeps 0 — and raw YAML is now the *only* way to express 0: the Go field's `omitempty` drops a zero before the apiserver sees it, so the CLI and any typed client cannot set it (they never could — `omitempty` predates this change — but previously the served value for an absent field was 0, so it looked like it worked).
-Making 0 first-class again for typed clients requires migrating the field to a pointer; tracked as follow-up work.
+An explicit `terminationGracePeriod: 0` (no drain window; instant kill) is preserved wherever it is expressed: the Go field is now a `*int64`, so `fission env create|update --graceperiod 0` and typed clients marshal a real 0 instead of `omitempty` dropping it, and the apiserver keeps it rather than serving back 90.
+For Go library consumers this is an API break: `EnvironmentSpec.TerminationGracePeriod` changed from `int64` to `*int64` (nil means "use the default"); read it through `EffectiveTerminationGracePeriod()`, which folds nil to the CRD default.
 
 ## Deprecation policy
 
```

**File**: `crds/v1/fission.io_environments.yaml` (modified, +10/-5)
```diff
@@ -20228,11 +20228,16 @@ spec:
                   it per environment for functions with longer request timeouts.
 
                   The CRD default below is what makes the documented default true for
-                  API-created Environments: the field is an int64, so before it existed
-                  an Environment created without the field got 0 — instant SIGKILL,
-                  every in-flight request on the pod dying as a connection reset. The
-                  in-code fallback cannot distinguish that 0 from an explicit one, and
-                  admission-time defaulting can.
+                  API-created Environments: nil means "use the default" and the
+                  apiserver fills an absent field with 90 at serving time.
+
+                  The *pointer* is what makes an EXPLICIT 0 ("no drain window, kill
+                  instantly") expressible from typed Go clients: on the previous
+                  int64 field, omitempty marshalled 0 as absent and the apiserver
+                  served it back as 90, so raw YAML was the only way to say 0.
+                  In-process readers must use EffectiveTerminationGracePeriod()
+                  (env_validation.go), which mirrors the CRD default for objects
+                  that never crossed the apiserver.
                   (Optional) defaults to 90 seconds
                 format: int64
                 minimum: 0
```

**File**: `pkg/apis/core/v1/env_validation.go` (modified, +18/-0)
```diff
@@ -125,3 +125,21 @@ func validateFunctionEnv(env []apiv1.EnvVar, envFrom []apiv1.EnvFromSource) erro
 	}
 	return errs
 }
+
+// DefaultTerminationGracePeriod is the drain window an Environment gets when
+// spec.terminationGracePeriod is nil — the in-process mirror of the CRD
+// structural default (types.go: +kubebuilder:default=90). Keep the two equal:
+// the apiserver applies the marker at serving time, so this constant is only
+// reached by objects that never crossed the apiserver (hand-built fixtures,
+// direct constructors).
+const DefaultTerminationGracePeriod int64 = 90
+
+// EffectiveTerminationGracePeriod returns the drain window the pod template
+// actually gets: the field's value when set — an explicit 0 means "no drain
+// window, kill instantly" — else DefaultTerminationGracePeriod.
+func (spec EnvironmentSpec) EffectiveTerminationGracePeriod() int64 {
+	if spec.TerminationGracePeriod == nil {
+		return DefaultTerminationGracePeriod
+	}
+	return *spec.TerminationGracePeriod
+}
```

**File**: `pkg/apis/core/v1/env_validation_test.go` (modified, +30/-0)
```diff
@@ -5,6 +5,7 @@
 package v1
 
 import (
+	"encoding/json"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -187,3 +188,32 @@ func TestFunctionSpecEnvPhaseGates(t *testing.T) {
 		assert.NoError(t, s.Validate())
 	})
 }
+
+// TestTerminationGracePeriodWireContract pins the reason the field is a
+// pointer: an explicit 0 must survive marshalling (the previous int64 +
+// omitempty dropped it as absent, and the apiserver's CRD default served it
+// back as 90 — "instant kill" was expressible only via raw YAML), while an
+// unset field must still marshal as absent so the CRD default applies.
+func TestTerminationGracePeriodWireContract(t *testing.T) {
+	t.Parallel()
+
+	explicitZero, err := json.Marshal(EnvironmentSpec{TerminationGracePeriod: new(int64(0))})
+	require.NoError(t, err)
+	assert.Contains(t, string(explicitZero), `"terminationGracePeriod":0`,
+		"an explicit 0 must reach the wire — it is a real value, not the absence of one")
+
+	unset, err := json.Marshal(EnvironmentSpec{})
+	require.NoError(t, err)
+	assert.NotContains(t, string(unset), "terminationGracePeriod",
+		"nil must marshal as absent so the apiserver's CRD default fills it")
+}
+
+func TestEffectiveTerminationGracePeriod(t *testing.T) {
+	t.Parallel()
+
+	assert.Equal(t, DefaultTerminationGracePeriod, EnvironmentSpec{}.EffectiveTerminationGracePeriod(),
+		"nil means: use the default")
+	assert.Zero(t, EnvironmentSpec{TerminationGracePeriod: new(int64(0))}.EffectiveTerminationGracePeriod(),
+		"an explicit 0 is 0, never the default")
+	assert.Equal(t, int64(300), EnvironmentSpec{TerminationGracePeriod: new(int64(300))}.EffectiveTerminationGracePeriod())
+}
```

**File**: `pkg/apis/core/v1/types.go` (modified, +10/-10)
```diff
@@ -1898,21 +1898,21 @@ type (
 		// it per environment for functions with longer request timeouts.
 		//
 		// The CRD default below is what makes the documented default true for
-		// API-created Environments: the field is an int64, so before it existed
-		// an Environment created without the field got 0 — instant SIGKILL,
-		// every in-flight request on the pod dying as a connection reset.
+		// API-created Environments: nil means "use the default" and the
+		// apiserver fills an absent field with 90 at serving time.
 		//
-		// Consequence of defaulting a non-pointer field with omitempty: an
-		// explicit 0 survives ONLY via raw YAML/JSON. Every typed Go client
-		// (the CLI included) marshals 0 as absent, which the apiserver then
-		// serves as 90. Restoring 0 as a first-class typed-client value means
-		// migrating this field to *int64; until then, "instant kill" is a
-		// raw-manifest-only setting.
+		// The *pointer* is what makes an EXPLICIT 0 ("no drain window, kill
+		// instantly") expressible from typed Go clients: on the previous
+		// int64 field, omitempty marshalled 0 as absent and the apiserver
+		// served it back as 90, so raw YAML was the only way to say 0.
+		// In-process readers must use EffectiveTerminationGracePeriod()
+		// (env_validation.go), which mirrors the CRD default for objects
+		// that never crossed the apiserver.
 		// (Optional) defaults to 90 seconds
 		// +optional
 		// +kubebuilder:default=90
 		// +kubebuilder:validation:Minimum=0
-		TerminationGracePeriod int64 `json:"terminationGracePeriod,omitempty"`
+		TerminationGracePeriod *int64 `json:"terminationGracePeriod,omitempty"`
 
 		// KeepArchive is used by fetcher to determine if the extracted archive
 		// or unarchived file should be placed, which is then used by specialize handler.
```

---

### Incident Patch 9: `f2ecd4e9` (2026-08-03)
**Commit Message**: upgrade gate: attributable failures + a terminationGracePeriod that actually defaults (90s) (#3651)

* feat(benchmark): make the upgrade-under-load gate attributable

The gate reports six counters and nothing else: 146 poolmgr transport
failures on main is a number with no when, no what, and no correlation
to what was rolling at the time. Every fix planned against it would be
validated by guesswork. This adds the attribution layer, observation
code only -- no product change.

- loadgen Observe now hands the caller an Observation carrying latency
  alongside status/header/error. A 30s transport failure is a client
  timeout; a 120ms one is a connection refusal -- the distinction is
  the difference between "requests hang in the cold path" and "pods
  are dropping connections", and totals cannot express it.

- upgradeRecorder timestamps every failure (bounded, 512/target, with
  a drop counter -- the TIMELINE keeps counting past the cap so totals
  never lie), buckets all outcomes into 5s cells per target, and marks
  the choreography phases. Classification is factored into ONE function
  shared with the gate counters, so the timeline can never tell a
  different story from the numbe

**File**: `.github/workflows/upgrade_test.yaml` (modified, +13/-1)
```diff
@@ -215,6 +215,7 @@ jobs:
             --namespace default --fission-namespace ${{ env.FISSION_NAMESPACE }} \
             --fission-version "${{ env.LATEST_TAG }}->HEAD (${{ matrix.upgradeFrom }})" \
             --git-sha "${{ github.sha }}" \
+            --artifact-dir "$GITHUB_WORKSPACE/upgrade-artifacts" \
             --out "$GITHUB_WORKSPACE/upgrade-results.json"
           # The benchmark CLI's failure budget records scenario errors in the
           # results instead of failing the process; an infra error or a skip
@@ -225,6 +226,15 @@ jobs:
             exit 1
           fi
 
+      # Cluster events are the cheapest failure-window correlator and expire
+      # from etcd long before anyone downloads an artifact — capture them now.
+      - name: Dump cluster events
+        if: ${{ always() && env.SKIP_LEG != '1' }}
+        run: |
+          mkdir -p upgrade-artifacts
+          kubectl get events -A --sort-by=.lastTimestamp > upgrade-artifacts/kube-events.txt || true
+          tail -n 60 upgrade-artifacts/kube-events.txt || true
+
       # The pre-upgrade hook stamps helm.sh/resource-policy=keep onto the
       # chart-generated Secrets so a later release can stop rendering them
       # without Helm pruning the live objects. Nothing else in this workflow
@@ -282,7 +292,9 @@ jobs:
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
         with:
           name: upgrade-results-${{ github.run_id }}-${{ matrix.kindversion }}-${{ matrix.upgradeFrom }}
-          path: upgrade-results.json
+          path: |
+            upgrade-results.json
+            upgrade-artifacts/**
           retention-days: 14
           # A skipped leg (SKIP_LEG=1: fewer than three published appVersions,
           # so there is no N-2 to skip-level from) never writes the file, and
```

**File**: `RELEASES.md` (modified, +12/-0)
```diff
@@ -59,6 +59,18 @@ Only hook Jobs are affected — no Deployment, Service, Secret, ConfigMap, Servi
 Set `nameFormat: legacy` to keep the previous names.
 A hook Job that failed and was never cleaned up will linger under its old name after the upgrade; it is inert, but can be deleted by hand.
 
+- **`Environment.terminationGracePeriod` defaults to `90` seconds — and now actually defaults.**
+A terminating function pod keeps serving for the whole grace window (the drain preStop hook sleeps through it), so this value is exactly how long every pod teardown takes: idle reap, environment update, upgrade, node drain.
+Two changes land together.
+First, the CRD now carries the default, closing a hole where an Environment created via the API (GitOps, Terraform, `kubectl apply`) without the field got **0** — pods were SIGKILLed instantly and every in-flight request on them died as a connection reset; only the CLI's client-side default masked this.
+Second, the default drops from 360 to 90: 90s covers endpoint propagation plus the 60s default function timeout with margin (mirroring the router's own 75s-drain/90s-grace posture), where 360 made every teardown linger six minutes per pod.
+Set `terminationGracePeriod` per environment if your functions serve requests longer than ~80s.
+This is the **Environment-level** grace only; the container executor's function-level `--graceperiod` keeps its 360s default.
+How it reaches existing objects: CRD structural defaults apply when the apiserver **serves** an object, not only at write time — so an Environment stored without the field reads back as 90 the moment the upgraded CRD is applied, with no object update.
+Practically, every such environment's pods roll **once** on the first executor reconcile after this upgrade (the pod template's grace changes 0→90); that roll is the fix taking effect.
+Only an explicit `terminationGracePeriod: 0` applied as raw YAML keeps 0 — and raw YAML is now the *only* way to express 0: the Go field's `omitempty` drops a zero before the apiserver sees it, so the CLI and any typed client cannot set it (they never could — `omitempty` predates this change — but previously the served value for an absent field was 0, so it looked like it worked).
+Making 0 first-class again for typed clients requires migrating the field to a pointer; tracked as follow-up work.
+
 ## Deprecation policy
 
 - Flags, CRD fields, chart values, and CLI commands are deprecated with **notice in one full minor release before removal**.
```

**File**: `charts/fission-all/values.yaml` (modified, +1/-1)
```diff
@@ -557,7 +557,7 @@ router:
     ## However, the drawback is it takes longer to switch to newly created function pods
     ## if using newdeploy as executor type for function. If you want to preserve the
     ## performance while keeping the short switching time to new function, you can create
-    ## an environment with short grace period by setting flag "--graceperiod" (default 360s),
+    ## an environment with short grace period by setting flag "--graceperiod" (default 90s),
     ## so that kubernetes will be able to reap old function pod quickly.
     ##
     ## For details, see https://github.com/fission/fission/issues/723
```

**File**: `crds/v1/fission.io_environments.yaml` (modified, +16/-1)
```diff
@@ -20216,9 +20216,24 @@ spec:
                     || self.container.securityContext.capabilities.add.all(c, c ==
                     ''NET_BIND_SERVICE'')'
               terminationGracePeriod:
+                default: 90
                 description: |-
                   The grace time for pod to perform connection draining before termination. The unit is in seconds.
-                  (Optional) defaults to 360 seconds
+                  A terminating function pod keeps serving for the WHOLE grace window
+                  (the preStop hook sleeps through it, then the kubelet kills the pod),
+                  so this value is exactly how long every teardown — idle reap, env
+                  update roll, upgrade, node drain — takes per pod. 90s covers endpoint
+                  propagation (seconds) plus the 60s default function timeout with
+                  margin, mirroring the router's own 75s-drain/90s-grace posture; set
+                  it per environment for functions with longer request timeouts.
+
+                  The CRD default below is what makes the documented default true for
+                  API-created Environments: the field is an int64, so before it existed
+                  an Environment created without the field got 0 — instant SIGKILL,
+                  every in-flight request on the pod dying as a connection reset. The
+                  in-code fallback cannot distinguish that 0 from an explicit one, and
+                  admission-time defaulting can.
+                  (Optional) defaults to 90 seconds
                 format: int64
                 minimum: 0
                 type: integer
```

**File**: `pkg/apis/core/v1/types.go` (modified, +22/-2)
```diff
@@ -1889,8 +1889,28 @@ type (
 		Poolsize int `json:"poolsize,omitempty"`
 
 		// The grace time for pod to perform connection draining before termination. The unit is in seconds.
-		// (Optional) defaults to 360 seconds
-		// +optional
+		// A terminating function pod keeps serving for the WHOLE grace window
+		// (the preStop hook sleeps through it, then the kubelet kills the pod),
+		// so this value is exactly how long every teardown — idle reap, env
+		// update roll, upgrade, node drain — takes per pod. 90s covers endpoint
+		// propagation (seconds) plus the 60s default function timeout with
+		// margin, mirroring the router's own 75s-drain/90s-grace posture; set
+		// it per environment for functions with longer request timeouts.
+		//
+		// The CRD default below is what makes the documented default true for
+		// API-created Environments: the field is an int64, so before it existed
+		// an Environment created without the field got 0 — instant SIGKILL,
+		// every in-flight request on the pod dying as a connection reset.
+		//
+		// Consequence of defaulting a non-pointer field with omitempty: an
+		// explicit 0 survives ONLY via raw YAML/JSON. Every typed Go client
+		// (the CLI included) marshals 0 as absent, which the apiserver then
+		// serves as 90. Restoring 0 as a first-class typed-client value means
+		// migrating this field to *int64; until then, "instant kill" is a
+		// raw-manifest-only setting.
+		// (Optional) defaults to 90 seconds
+		// +optional
+		// +kubebuilder:default=90
 		// +kubebuilder:validation:Minimum=0
 		TerminationGracePeriod int64 `json:"terminationGracePeriod,omitempty"`
 
```

---

### Incident Patch 10: `f367a699` (2026-08-03)
**Commit Message**: RFC-0028/0029 wave: auth-material provisioning, name inventory, spec-apply idempotency, CI flake fixes (#3649)

* test(chart): pin NetworkPolicy svc selectors to real workloads

The fixed-name inventory RFC-0029 phase 2 asks for, made executable rather than
written down.

NetworkPolicies address workloads by a bare `svc:` pod label — a string that no
template or Go constant forces to agree with the labels the Deployments carry.
A rename, which is exactly what phase 2 does, can orphan an allowlist entry,
and the failure is silent: traffic is dropped rather than rejected and surfaces
far away as `dial tcp <ip>:8889: i/o timeout` in an unrelated integration test.
This repo has paid for that debugging more than once.

Every `svc:` value referenced by a policy — its own podSelector and every
ingress from-selector — must be carried by some rendered pod template. Renaming
statesvc's pod label fails it with the two policies that would silently drop
that traffic.

The render enables every optional component (canaryDeployment, workflows and
its statestore prerequisite, functionState, mcp) on purpose: the allowlist
legitimately names workloads that only exist behind a flag, so a default rende

**File**: `.github/workflows/upgrade_test.yaml` (modified, +5/-0)
```diff
@@ -284,6 +284,11 @@ jobs:
           name: upgrade-results-${{ github.run_id }}-${{ matrix.kindversion }}-${{ matrix.upgradeFrom }}
           path: upgrade-results.json
           retention-days: 14
+          # A skipped leg (SKIP_LEG=1: fewer than three published appVersions,
+          # so there is no N-2 to skip-level from) never writes the file, and
+          # this step still runs under always(). Default `warn` would print a
+          # red herring on every such run; the leg is meant to skip cleanly.
+          if-no-files-found: ignore
 
       - name: Kind export logs
         if: ${{ always() }}
```

**File**: `charts/fission-all/templates/_helpers.tpl` (modified, +86/-5)
```diff
@@ -199,6 +199,41 @@ it). Disabled by default → behaviour is unchanged for single-replica installs.
       fieldPath: metadata.name
 {{- end }}
 
+{{/*
+fission.internalAuthSecretName is the Secret holding the internal-auth HMAC
+master: the operator's pre-created one when internalAuth.existingSecret is set,
+otherwise the chart-generated "fission-internal-auth".
+
+Every consumer must go through this. The Go side resolves the same name from
+FISSION_INTERNAL_AUTH_SECRET_NAME (fv1.InternalAuthSecretName), and a
+disagreement between the two does not fail loudly — the secretKeyRef is
+optional, so pods start with the env var absent and every archive fetch and
+builder upload 401s with nothing naming the Secret as the cause.
+*/}}
+{{- define "fission.internalAuthSecretName" -}}
+{{- default "fission-internal-auth" .Values.internalAuth.existingSecret -}}
+{{- end -}}
+
+{{/*
+fission.internalAuthGenerateInCluster is non-empty when the pre-upgrade hook,
+not the template, mints the master.
+
+Exactly one of them may provision it, and this is the ONLY place that decides
+which. Three templates gate on this answer — the Secret itself, the hook's
+GENERATE_AUTH_SECRET env, and the hook's RBAC — and open-coding the condition
+in each is how they drift apart. Both drift directions fail silently: both
+provisioning means two masters race and half the derived keys are wrong;
+neither means no master at all and every internal call is unsigned.
+
+The whitespace trimming is load-bearing. A stray newline would make the
+`include` non-empty, so the helper would read as true in every case.
+*/}}
+{{- define "fission.internalAuthGenerateInCluster" -}}
+{{- if and .Values.internalAuth.enabled .Values.internalAuth.autoGenerate (not .Values.internalAuth.existingSecret) (not .Values.internalAuth.secret) -}}
+true
+{{- end -}}
+{{- end -}}
+
 {{/*
 internalAuth.envs renders the two env entries that wire the HMAC shared
 secret into a Fission control-plane container. See the design at docs/internal-auth/00-design.md. The OLD
@@ -210,14 +245,18 @@ forcing the chart to render an empty key.
 - name: FISSION_INTERNAL_AUTH_SECRET
   valueFrom:
     secretKeyRef:
-      name: fission-internal-auth
+      name: {{ include "fission.internalAuthSecretName" . }}
       key: secret
 - name: FISSION_INTERNAL_AUTH_SECRET_OLD
   valueFrom:
     secretKeyRef:
-      name: fission-internal-auth
+      name: {{ include "fission.internalAuthSecretName" . }}
       key: oldSecret
       optional: true
+# The Go side (fetcher pod-spec builder, storagesvc client) resolves the same
+# name from this env var; see fv1.InternalAuthSecretName.
+- name: FISSION_INTERNAL_AUTH_SECRET_NAME
+  value: {{ include "fission.internalAuthSecretName" . | quote }}
 {{- end }}
 {{- end }}
 
@@ -414,15 +453,57 @@ the pre-upgrade hook stamps helm.sh/resource-policy=keep onto, so that moving
 their generation out of the templating layer does not prune the live object on
 the next upgrade (RFC-0029 §3; mechanism verified on Helm v4.2.3).
 
-Only Secrets the chart itself may have created belong here — never one supplied
-via an existingSecret value, which the operator owns and Helm never manages.
+What belongs here is decided by ONE question: could Helm prune this object?
+Not "who owns it" — that reading is what the internalAuth entry below had to
+stop using, and the two entries genuinely differ:
+
+  - internal-auth-secret.yaml and webhook-server/cert.yaml carry NO
+    helm.sh/hook annotation, so they are ordinary release-manifest resources
+    and Helm prunes them the moment a template stops rendering them. They need
+    retention whether or not an existingSecret is set.
+  - router/secret.yaml IS a hook resource ("helm.sh/hook": pre-install,
+    pre-upgrade), so it lives outside Helm's deletion set and is never pruned.
+    Its existingSecret guard below is therefore correct and must stay.
+
+That asymmetry looks like an oversight and is not. Do not "fix" it by making
+the two branch
```

**File**: `charts/fission-all/templates/internal-auth-secret.yaml` (modified, +18/-2)
```diff
@@ -1,4 +1,20 @@
-{{- if .Values.internalAuth.enabled }}
+{{- /*
+existingSecret hands the master to the operator: the chart renders NOTHING and
+every consumer reads the named Secret instead. This is the supported path for
+GitOps renderers, where `lookup` returns empty under `helm template` and the
+preservation below cannot work, so a generated value would be re-minted on
+every sync and break every pod signed with the previous one.
+
+Upgrading an existing install into this mode is safe ONLY because the
+pre-upgrade retention hook stamps helm.sh/resource-policy=keep on the live
+Secret before Helm computes its deletion set. Without that, Helm would prune
+the master it is no longer rendering and wedge every control-plane pod in
+CreateContainerConfigError.
+*/ -}}
+{{- /* autoGenerate hands generation to the pre-upgrade hook, so the template
+       must stop rendering the Secret — the retention hook keeps the live value
+       from being pruned when it does. */ -}}
+{{- if and .Values.internalAuth.enabled (not .Values.internalAuth.existingSecret) (not (include "fission.internalAuthGenerateInCluster" .)) }}
 {{- /*
 fission-internal-auth holds the shared HMAC secret used by Fission's
 internal application-layer auth (the design at docs/internal-auth/00-design.md).
@@ -61,7 +77,7 @@ rotation window) and re-run helm upgrade.
 apiVersion: v1
 kind: Secret
 metadata:
-  name: fission-internal-auth
+  name: {{ include "fission.internalAuthSecretName" $ }}
   namespace: {{ $ns }}
   labels:
     chart: "{{ $.Chart.Name }}-{{ $.Chart.Version }}"
```

**File**: `charts/fission-all/templates/pre-upgrade-checks/pre-upgrade-job.yaml` (modified, +16/-0)
```diff
@@ -6,6 +6,16 @@ schemas at all.
 {{- if and (eq (include "fission.crdsMode" .) "hook") (not .Values.preUpgradeChecks.enabled) }}
 {{- fail "crds.mode=hook delivers the CRDs through the pre-upgrade-checks Job, so preUpgradeChecks.enabled must be true (or set crds.mode=none)" }}
 {{- end }}
+{{- /*
+Same shape, same reason: internalAuth.autoGenerate moves master provisioning
+from the template into THIS Job, so the template renders no Secret. With the
+Job switched off, nothing provisions it at all and every control-plane pod
+wedges in CreateContainerConfigError on a required secretKeyRef — a whole
+install that comes up dead, from two values that each look reasonable alone.
+*/}}
+{{- if and (include "fission.internalAuthGenerateInCluster" .) (not .Values.preUpgradeChecks.enabled) }}
+{{- fail "internalAuth.autoGenerate provisions the master through the pre-upgrade-checks Job, so preUpgradeChecks.enabled must be true (or set internalAuth.secret / internalAuth.existingSecret instead)" }}
+{{- end }}
 {{- if .Values.preUpgradeChecks.enabled }}
 apiVersion: batch/v1
 kind: Job
@@ -47,6 +57,12 @@ spec:
         - name: ADOPT_SECRET_NAMESPACES
           value: {{ include "fission.adoptSecretNamespaces" $ | quote }}
         {{- end }}
+{{- if include "fission.internalAuthGenerateInCluster" . }}
+        - name: GENERATE_AUTH_SECRET
+          value: {{ include "fission.internalAuthSecretName" . | quote }}
+        - name: GENERATE_AUTH_SECRET_NAMESPACES
+          value: {{ include "fission.adoptSecretNamespaces" . | quote }}
+{{- end }}
         {{- include "fission.podNamespaceEnv" . | nindent 8 }}
         - name: CRDS_MODE
           value: {{ include "fission.crdsMode" . | quote }}
```

**File**: `charts/fission-all/templates/pre-upgrade-checks/role-fission-cr.yaml` (modified, +108/-1)
```diff
@@ -11,14 +11,23 @@ annotates chart-generated Secrets with helm.sh/resource-policy=keep before Helm
 computes its deletion set, so a template can stop rendering them without the
 live object being pruned.
 
-PATCH ONLY, fenced by resourceNames to exactly the Secrets the chart generates.
+PATCH ONLY, fenced by resourceNames to the exact Secret NAMES the chart uses.
 resourceNames does restrict get and patch (both name the object in the request
 path), and deliberately no `get`: the merge patch is idempotent, so the hook
 never needs to read, and these are the highest-value Secrets in the namespace —
 a grant that cannot read the HMAC master, the JWT signing key or the webhook TLS
 key is worth far more than one that can. No list (which would let this identity
 enumerate every Secret), no create, no delete.
 
+"NAMES the chart uses", not "Secrets the chart generates" — the distinction is
+real. fission.adoptSecretNames names the internal-auth Secret unconditionally,
+because retention has to cover whatever Helm could prune, so with
+`internalAuth.existingSecret: fission-internal-auth` this grants patch on an
+object the OPERATOR owns. That is intended: it is the only way to stop Helm
+deleting it. Note the grant is `patch`, which is full .data mutation even
+though the hook writes one annotation — accepted knowingly, and bounded by the
+ServiceAccount being torn down with the hook.
+
 Rendered once per namespace the master is replicated into, and only when the
 Job that uses it actually renders — a standing Secret grant bound to a
 ServiceAccount that runs nothing is pointless, and worse, an operator with
@@ -64,3 +73,101 @@ roleRef:
   apiGroup: rbac.authorization.k8s.io
 {{- end }}
 {{- end }}
+
+{{- /*
+Generation grant (see cmd/preupgradechecks/generateauth.go), SEPARATE from the
+adoption grant above on purpose.
+
+Adoption is patch-only and deliberately cannot read: a grant that cannot read
+the HMAC master, the JWT signing key or the webhook TLS key is worth far more
+than one that can. Generation genuinely needs `get` — it must tell "already
+provisioned" from "absent", and without that a re-run would mint a new master
+and rotate every derived key with no dual-accept window. Widening the adoption
+Role would have handed that read over all three Secrets; a separate Role fenced
+to the master ALONE confines it to the one object that needs it.
+
+Rendered only when the chart is actually generating, and only in the namespaces
+the master is replicated into — under dynamic/cluster tenancy the release
+namespace alone, because tenant namespaces receive controller-owned derived keys
+and the master must never land there.
+*/}}
+{{- if and .Values.preUpgradeChecks.enabled (include "fission.internalAuthGenerateInCluster" .) }}
+{{- range $ns := splitList " " (include "fission.adoptSecretNamespaces" $) }}
+---
+apiVersion: rbac.authorization.k8s.io/v1
+kind: Role
+metadata:
+  name: "{{ $.Release.Name }}-preupgrade-authgen"
+  namespace: {{ $ns }}
+  annotations:
+    helm.sh/hook: pre-install,pre-upgrade
+    helm.sh/hook-delete-policy: hook-succeeded,hook-failed,before-hook-creation
+    helm.sh/hook-weight: "-2"
+rules:
+# get IS name-scoped: a GET carries the name in the request path, so the
+# authorizer matches it against resourceNames and this read reaches the
+# master and nothing else.
+- apiGroups: [""]
+  resources: ["secrets"]
+  verbs: ["get"]
+  resourceNames:
+  - {{ include "fission.internalAuthSecretName" $ }}
+# create CANNOT be name-scoped, and pairing it with resourceNames does not
+# tighten the grant — it voids it. A POST carries the object name in the
+# BODY, not the path, so the authorizer sees an empty name, a
+# resourceNames-fenced rule never matches, and generation fails Forbidden.
+# The grant would be inert and the feature dead on arrival.
+#
+# This is the exact inverse of the CRD ClusterRole next door, which DOES
+# keep its resourceNames scope on create: server-side apply PATCHes a
+# named path,
```

#### Recent Merged Pull Requests:
- **PR #3729** (closed): chore(deps): bump the go-dependencies group across 1 directory with 18 updates (@dependabot[bot])
- **PR #3727** (2026-09-15): storagesvc/client: pull the MinIO test fixture from quay.io (Docker Hub mirror removed) (@sanketsudake)
- **PR #3726** (closed): chore(deps): bump the go-dependencies group across 1 directory with 16 updates (@dependabot[bot])
- **PR #3724** (2026-09-15): tlc: pin tla2tools to the stable v1.7.4 release instead of the rebuilt v1.8.0 prerelease (@sanketsudake)
- **PR #3723** (2026-09-11): hack/run-tlc: bump the tla2tools pin for the 2026-09-10 upstream rebuild (@sanketsudake)
- **PR #3722** (2026-09-15): Carve feature-independent changes out of the agent runtime (#3710): env runtimeClassName, statesvc EventLog routes, MCP _meta tracing, environment egress NetworkPolicy (@sanketsudake)
- **PR #3721** (closed): chore(deps): bump the github-actions group across 1 directory with 8 updates (@dependabot[bot])
- **PR #3720** (closed): chore(deps): bump the go-dependencies group with 10 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
