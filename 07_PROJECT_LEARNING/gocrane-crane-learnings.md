# Forensic Learning Record (Deep Inspection): gocrane/crane

> **Canonical Artifact**: `07_PROJECT_LEARNING/gocrane-crane-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gocrane/crane](https://github.com/gocrane/crane))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:34.033Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gocrane/crane`
- **Description**: Crane is a FinOps Platform for Cloud Resource Analytics and Economics in Kubernetes clusters. The goal is not only to help users to manage cloud cost easier but also ensure the quality of applications.  
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2058 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/crane-agent/app/agent.go`
```
package app

import (
	"context"
	"flag"
	"os"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"

	ensuranceapi "github.com/gocrane/api/ensurance/v1alpha1"
	craneclientset "github.com/gocrane/api/pkg/generated/clientset/versioned"
	craneinformers "github.com/gocrane/api/pkg/generated/informers/externalversions"

	"github.com/gocrane/crane/cmd/crane-agent/app/options"
	"github.com/gocrane/crane/pkg/agent"
	"github.com/gocrane/crane/pkg/metrics"
)

var (
	scheme = runtime.NewScheme()
)

const (
	specNodeNameField  = "spec.nodeName"
	informerSyncPeriod = time.Minute
	DefaultWorkers     = 2
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(ensuranceapi.AddToScheme(scheme))
}

// NewAgentCommand creates a *cobra.Command object with default parameters
func NewAgentCommand(ctx context.Context) *cobra.Command {
	opts := options.NewOptions()

	cmd := &cobra.Command{
		Use:  "crane-agent",
		Long: `The crane agent is running in each node and responsible for QoS ensurance`,
		Run: func(cmd *cobra.Command, args []string) {
			if err := opts.Complete(); err != nil {
				klog.Exitf("Opts complete failed: %v", err)
			}
			if err := opts.Validate(); err != nil {
				klog.Exitf("Opts validate failed: %v", err)
			}

			cmd.Flags().VisitAll(func(flag *pflag.Flag) {
				klog.Infof("FLAG: --%s=%q\n", flag.Name, flag.Value)
			})

			if err := Run(ctx, opts); err != nil {
				klog.Exit(err)
			}
		},
	}

	cmd.Flags().AddGoFlagSet(flag.CommandLine)
	opts.AddFlags(cmd.Flags())
	utilfeature.DefaultMutableFeatureGate.AddFlag(cmd.Flags())

	return cmd
}

func Run(ctx context.Context, opts *options.Options) error {
	hostname := getHostName(opts.HostnameOverride)
	healthCheck := metrics.NewHealthCheck(opts.MaxInactivity)
	metrics.RegisterCraneAgent()

	kubeClient, craneClient, err := buildClient()
	if err != nil {
		return err
	}

	podInformerFactory := informers.NewSharedInformerFactoryWithOptions(kubeClient, informerSyncPeriod,
		informers.WithTweakListOptions(func(options *metav1.ListOptions) {
			options.FieldSelector = fields.OneTermEqualSelector(specNodeNameField, hostname).String()
		}),
	)

	nodeInformerFactory := informers.NewSharedInformerFactoryWithOptions(kubeClient, informerSyncPeriod,
		informers.WithTweakListOptions(func(options *metav1.ListOptions) {
			options.FieldSelector = fields.OneTermEqualSelector(metav1.ObjectNameField, hostname).String()
		}),
	)
	podInformer := podInformerFactory.Core().V1().Pods()
	nodeInformer := nodeInformerFactory.Core().V1().Nodes()

	craneInformerFactory := craneinformers.NewSharedInformerFactory(craneClient, informerSyncPeriod)
	nodeQOSInformer := craneInformerFactory.Ensurance().V1alpha1().NodeQOSs()
	podQOSInformer := craneInformerFactory.Ensurance().V1alpha1().PodQOSs()
	actionInformer := craneInformerFactory.Ensurance().V1alpha1().AvoidanceActions()
	tspInformer := craneInformerFactory.Prediction().V1alpha1().TimeSeriesPredictions()

	nrtInformerFactory := craneinformers.NewSharedInformerFactoryWithOptions(craneClient, informerSyncPeriod,
		craneinformers.WithTweakListOptions(func(options *metav1.ListOptions) {
			options.FieldSelector = fields.OneTermEqualSelector(metav1.ObjectNameField, hostname).String()
		}),
	)
	nrtInformer := nrtInformerFactory.Topology().V1alpha1().NodeResourceTopologies()

	newAgent, err := agent.NewAgent(ctx, hostname, opts.RuntimeEndpoint, opts.CgroupDriver, opts.SysPath,
		opts.KubeletRootPath, kubeClient, craneClient, podInformer, nodeInformer, nodeQOSInformer, podQOSInformer,
		actionInformer, tspInformer, nrtInformer, opts.NodeResourceReserved, opts.Ifaces, healthCheck,
		opts.CollectInterval, opts.ExecuteExcess, opts.CPUManagerReconcilePeriod, opts.DefaultCPUPolicy)

	if err != nil {
		return err
	}

	podInformerFactory.Start(ctx.Done())
	nodeInformerFactory.Start(ctx.Done())
	craneInformerFactory.Start(ctx.Done())
	nrtInformerFactory.Start(ctx.Done())

	podInformerFactory.WaitForCacheSync(ctx.Done())
	nodeInformerFactory.WaitForCacheSync(ctx.Done())
	craneInformerFactory.WaitForCacheSync(ctx.Done())
	nrtInformerFactory.WaitForCacheSync(ctx.Done())

	newAgent.Run(healthCheck, opts.EnableProfiling, opts.BindAddr)
	return nil
}

func buildClient() (kubernetes.Interface, craneclientset.Interface, error) {
	config, err := ctrl.GetConfig()
	if err != nil {
		klog.Errorf("Failed to get GetConfig, %v.", err)
		return nil, nil, err
	}
	kubeClient, err := kubernetes.NewForConfig(config)
	if err != nil {
		klog.Errorf("Failed to new kubernetes client, %v.", err)
		return nil, nil, err
	}
	craneClient, err := craneclientset.NewForConfig(config)
	if err != nil {
		klog.Errorf("Failed to new crane client, %v.", err)
		return nil, nil, err
	}
	return kubeClient, craneClient, nil
}

func getHostName(override string) string {
	nodeName, _ := os.Hostname()
	if os.Getenv("NODE_NAME") != "" {
		nodeName = os.Getenv("NODE_NAME")
	}
	if len(override) != 0 {
		nodeName = override
	}
	return nodeName
}

```

### Core Architecture Module: `cmd/crane-agent/app/options/option.go`
```
package options

import (
	"time"

	"github.com/spf13/pflag"
	cliflag "k8s.io/component-base/cli/flag"

	topologyapi "github.com/gocrane/api/topology/v1alpha1"
)

// Options hold the command-line options about crane manager
type Options struct {
	// HostnameOverride is the name of k8s node
	HostnameOverride string
	// RuntimeEndpoint is the endpoint of runtime
	RuntimeEndpoint string
	// driver that the kubelet uses to manipulate cgroups on the host (cgroupfs or systemd)
	CgroupDriver string
	// SysPath is the path to /sys dir.
	SysPath string
	// KubeletRootPath is the Path to kubelet root directory.
	KubeletRootPath string
	// Is debug/pprof endpoint enabled
	EnableProfiling bool
	// BindAddr is the address the endpoint binds to.
	BindAddr string
	// CollectInterval is the period for state collector to collect metrics
	CollectInterval time.Duration
	// MaxInactivity is the maximum time from last recorded activity before automatic restart
	MaxInactivity time.Duration
	// Ifaces is the network devices to collect metric
	Ifaces               []string
	NodeResourceReserved map[string]string
	// ExecuteExcess is the percentage of executions that exceed the gap between current usage and watermarks
	ExecuteExcess string
	// CPUManagerReconcilePeriod is a duration that cpu manager reconciles.
	CPUManagerReconcilePeriod time.Duration
	// DefaultCPUPolicy is the default cpu policy, default to exclusive.
	DefaultCPUPolicy string
}

// NewOptions builds an empty options.
func NewOptions() *Options {
	return &Options{}
}

// Complete completes all the required options.
func (o *Options) Complete() error {
	return nil
}

// Validate all required options.
func (o *Options) Validate() error {
	return nil
}

// AddFlags adds flags to the specified FlagSet.
func (o *Options) AddFlags(flags *pflag.FlagSet) {
	flags.StringVar(&o.HostnameOverride, "hostname-override", "", "Which is the name of k8s node be used to filtered.")
	flags.StringVar(&o.RuntimeEndpoint, "runtime-endpoint", "", "The runtime endpoint docker: unix:///var/run/dockershim.sock, containerd: unix:///run/containerd/containerd.sock, cri-o: unix:///run/crio/crio.sock, k3s: unix:///run/k3s/containerd/containerd.sock.")
	flags.StringVar(&o.CgroupDriver, "cgroup-driver", "cgroupfs", "Driver that the kubelet uses to manipulate cgroups on the host.  Possible values: 'cgroupfs', 'systemd'. Default to 'cgroupfs'")
	flags.StringVar(&o.SysPath, "sys-path", "/sys", "Path to /sys dir.")
	flags.StringVar(&o.KubeletRootPath, "kubelet-root-path", "/var/lib/kubelet", "Path to the kubelet root directory.")
	flags.Bool("enable-profiling", false, "Is debug/pprof endpoint enabled, default: false")
	flags.StringVar(&o.BindAddr, "bind-address", "0.0.0.0:8081", "The address the agent binds to for metrics, health-check and pprof, default: 0.0.0.0:8081.")
	flags.DurationVar(&o.CollectInterval, "collect-interval", 10*time.Second, "Period for the state collector to collect metrics, default: 10s")
	flags.StringArrayVar(&o.Ifaces, "ifaces", []string{"eth0"}, "The network devices to collect metric, use comma to separated, default: eth0")
	flags.Var(cliflag.NewMapStringString(&o.NodeResourceReserved), "node-resource-reserved", "A set of ResourceName=Percent (e.g. cpu=40%,memory=40%)")
	flags.DurationVar(&o.MaxInactivity, "max-inactivity", 5*time.Minute, "Maximum time from last recorded activity before automatic restart, default: 5min")
	flags.StringVar(&o.ExecuteExcess, "execute-excess", "10%", "The percentage of executions that exceed the gap between current usage and watermarks, default: 10%.")
	flags.DurationVar(&o.CPUManagerReconcilePeriod, "cpu-manager-reconcile-period", 5*time.Second, "Specifies how often cpu manager reconciles.")
	flags.StringVar(&o.DefaultCPUPolicy, "default-cpu-policy", topologyapi.AnnotationPodCPUPolicyExclusive, "The default cpu policy if pod does not specify, should be one of none, exclusive, numa or immovable, default to exclusive.")
}

```

### Core Architecture Module: `cmd/crane-agent/main.go`
```
package main

import (
	"flag"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/spf13/pflag"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"

	"github.com/gocrane/crane/cmd/crane-agent/app"
)

// crane-agent main.
func main() {
	klog.InitFlags(nil)
	pflag.CommandLine.AddGoFlagSet(flag.CommandLine)
	rand.Seed(time.Now().UnixNano())

	ctx := signals.SetupSignalHandler()

	if err := app.NewAgentCommand(ctx).Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/craned/app/manager.go`
```
package app

import (
	"context"
	"flag"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/scale"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/healthz"

	analysisapi "github.com/gocrane/api/analysis/v1alpha1"
	autoscalingapi "github.com/gocrane/api/autoscaling/v1alpha1"
	ensuranceapi "github.com/gocrane/api/ensurance/v1alpha1"
	predictionapi "github.com/gocrane/api/prediction/v1alpha1"

	"github.com/gocrane/crane/cmd/craned/app/options"
	"github.com/gocrane/crane/pkg/controller/analytics"
	"github.com/gocrane/crane/pkg/controller/cnp"
	"github.com/gocrane/crane/pkg/controller/ehpa"
	"github.com/gocrane/crane/pkg/controller/evpa"
	recommendationctrl "github.com/gocrane/crane/pkg/controller/recommendation"
	"github.com/gocrane/crane/pkg/controller/timeseriesprediction"
	"github.com/gocrane/crane/pkg/features"
	"github.com/gocrane/crane/pkg/known"
	"github.com/gocrane/crane/pkg/metrics"
	"github.com/gocrane/crane/pkg/oom"
	"github.com/gocrane/crane/pkg/predictor"
	prometheus_adapter "github.com/gocrane/crane/pkg/prometheus-adapter"
	"github.com/gocrane/crane/pkg/providers"
	"github.com/gocrane/crane/pkg/providers/grpc"
	"github.com/gocrane/crane/pkg/providers/metricserver"
	"github.com/gocrane/crane/pkg/providers/mock"
	"github.com/gocrane/crane/pkg/providers/prom"
	_ "github.com/gocrane/crane/pkg/querybuilder-providers/grpc"
	_ "github.com/gocrane/crane/pkg/querybuilder-providers/metricserver"
	_ "github.com/gocrane/crane/pkg/querybuilder-providers/prometheus"
	"github.com/gocrane/crane/pkg/recommendation"
	"github.com/gocrane/crane/pkg/server"
	serverconfig "github.com/gocrane/crane/pkg/server/config"
	"github.com/gocrane/crane/pkg/utils"
	"github.com/gocrane/crane/pkg/utils/target"
	"github.com/gocrane/crane/pkg/webhooks"
)

var (
	scheme = runtime.NewScheme()
)

// NewManagerCommand creates a *cobra.Command object with default parameters
func NewManagerCommand(ctx context.Context) *cobra.Command {
	opts := options.NewOptions()

	cmd := &cobra.Command{
		Use:  "craned",
		Long: `The crane manager is responsible for manage controllers in crane`,
		Run: func(cmd *cobra.Command, args []string) {
			if err := opts.Complete(); err != nil {
				klog.Exit(err)
			}
			if errs := opts.Validate(); len(errs) != 0 {
				klog.Exit(errs)
			}

			if err := Run(ctx, opts); err != nil {
				klog.Exit(err)
			}
		},
	}

	cmd.Flags().AddGoFlagSet(flag.CommandLine)
	opts.AddFlags(cmd.Flags())
	utilfeature.DefaultMutableFeatureGate.AddFlag(cmd.Flags())

	return cmd
}

// Run runs the craned with options. This should never exit.
func Run(ctx context.Context, opts *options.Options) error {
	config := ctrl.GetConfigOrDie()
	config.QPS = float32(opts.ApiQps)
	config.Burst = opts.ApiBurst

	ctrlOptions := ctrl.Options{
		Scheme:                  scheme,
		MetricsBindAddress:      opts.MetricsAddr,
		Port:                    9443,
		HealthProbeBindAddress:  opts.BindAddr,
		LeaderElection:          opts.LeaderElection.LeaderElect,
		LeaderElectionID:        "craned",
		LeaderElectionNamespace: known.CraneSystemNamespace,
	}
	if opts.CacheUnstructured {
		ctrlOptions.NewClient = NewCacheUnstructuredClient
	}

	mgr, err := ctrl.NewManager(config, ctrlOptions)
	if err != nil {
		klog.ErrorS(err, "unable to start crane manager")
		return err
	}

	if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
		klog.ErrorS(err, "failed to add health check endpoint")
		return err
	}

	if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
		klog.ErrorS(err, "failed to add health check endpoint")
		return err
	}
	// initialize data sources and predictor
	realtimeDataSources, historyDataSources, dataSourceProviders := initDataSources(mgr, opts)
	predictorMgr := initPredictorManager(opts, realtimeDataSources, historyDataSources)

	initScheme()
	initFieldIndexer(mgr)
	initWebhooks(mgr, opts)

	podOOMRecorder := &oom.PodOOMRecorder{
		Client:             mgr.GetClient(),
		OOMRecordMaxNumber: opts.OOMRecordMaxNumber,
	}
	if err := podOOMRecorder.SetupWithManager(mgr); err != nil {
		klog.Exit(err, "Unable to create controller", "PodOOMRecorder")
	}
	go func() {
		if err := podOOMRecorder.Run(ctx.Done()); err != nil {
			klog.Warningf("Run oom recorder failed: %v", err)
		}
	}()

	initControllers(ctx, podOOMRecorder, mgr, opts, predictorMgr, historyDataSources[providers.PrometheusDataSource])
	// initialize custom collector metrics
	initMetricCollector(mgr)
	runAll(ctx, mgr, predictorMgr, dataSourceProviders[providers.PrometheusDataSource], opts)

	return nil
}

func initRecommenderManager(opts *options.Options) recommendation.RecommenderManager {
	return recommendation.NewRecommenderManager(opts.RecommendationConfiguration)
}

func initScheme() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	if utilfeature.DefaultFeatureGate.Enabled(features.CraneAutoscaling) {
		utilruntime.Must(autoscalingapi.AddToScheme(scheme))
	}
	if utilfeature.DefaultFeatureGate.Enabled(features.CraneNodeResource) || utilfeature.DefaultFeatureGate.Enabled(features.CraneClusterNodePrediction) {
		utilruntime.Must(ensuranceapi.AddToScheme(scheme))
	}
	if utilfeature.DefaultFeatureGate.Enabled(features.CraneAnalysis) {
		utilruntime.Must(analysisapi.AddToScheme(scheme))
	}
	if utilfeature.DefaultFeatureGate.Enabled(features.CraneTimeSeriesPrediction) {
		utilruntime.Must(predictionapi.AddToScheme(scheme))
	}
}

func initFieldIndexer(mgr ctrl.Manager) {
	// register nodeName indexer
	if err := mgr.GetFieldIndexer().IndexField(context.TODO(), &corev1.Pod{}, "spec.nodeName", func(obj client.Object) []string {
		pod, ok := obj.(*corev1.Pod)
		if !ok {
			return []string{}
		}
		if len(pod.Spec.NodeName) == 0 {
			return []string{}
		} else {
			return []string{pod.Spec.NodeName}
		}
	}); err != nil {
		panic(err)
	}
}

func initMetricCollector(mgr ctrl.Manager) {
	discoveryClientSet, err := discovery.NewDiscoveryClientForConfig(mgr.GetConfig())
	if err != nil {
		klog.Exit(err, "Unable to create discover client")
	}

	scaleKindResolver := scale.NewDiscoveryScaleKindResolver(discoveryClientSet)
	scaleClient := scale.New(
		discoveryClientSet.RESTClient(), mgr.GetRESTMapper(),
		dynamic.LegacyAPIPathResolverFunc,
		scaleKindResolver,
	)
	// register as prometheus metric collector
	metrics.CustomCollectorRegister(metrics.NewCraneMetricCollector(mgr.GetClient(), scaleClient, mgr.GetRESTMapper()))
}

func initWebhooks(mgr ctrl.Manager, opts *options.Options) {
	if !opts.WebhookConfig.Enabled {
		return
	}

	if certDir := os.Getenv("WEBHOOK_CERT_DIR"); len(certDir) > 0 {
		mgr.GetWebhookServer().CertDir = certDir
	}

	if err := webhooks.SetupWebhookWithManager(mgr,
		utilfeature.DefaultFeatureGate.Enabled(features.CraneAutoscaling),
		utilfeature.DefaultFeatureGate.Enabled(features.CraneNodeResource),
		utilfeature.DefaultFeatureGate.Enabled(features.CraneClusterNodePrediction),
		utilfeature.DefaultMutableFeatureGate.Enabled(features.CraneAnalysis),
		utilfeature.DefaultFeatureGate.Enabled(features.CraneTimeSeriesPrediction),
		utilfeature.DefaultFeatureGate.Enabled(features.QOSInitializer), opts.QOSConfigFile); err != nil {
		klog.Exit(err, "unable to create webhook", "webhook", "TimeSeriesPrediction")
	}
}

func initDataSources(mgr ctrl.Manager, opts *options.Options) (map[providers.DataSourceType]providers.RealTime, map[providers.DataSourceType]providers.History, map[providers.DataSourceType]providers.Interface) {
	realtimeDataSources := make(map[providers.DataSourceType]providers.RealTime)
	historyDataSources := make(m
```

### Core Architecture Module: `cmd/craned/app/options/options.go`
```
package options

import (
	"time"

	"github.com/spf13/pflag"
	componentbaseconfig "k8s.io/component-base/config"

	"github.com/gocrane/crane/pkg/controller/ehpa"
	"github.com/gocrane/crane/pkg/prediction/config"
	"github.com/gocrane/crane/pkg/providers"
	serverconfig "github.com/gocrane/crane/pkg/server/config"
	"github.com/gocrane/crane/pkg/webhooks"
)

// Options hold the command-line options about craned
type Options struct {
	// ApiQps for rest client
	ApiQps int
	// ApiBurst for rest  client
	ApiBurst int
	// LeaderElection hold the configurations for manager leader election.
	LeaderElection componentbaseconfig.LeaderElectionConfiguration
	// MetricsAddr is The address the metric endpoint binds to.
	MetricsAddr string
	// BindAddr is The address the probe endpoint binds to.
	BindAddr string

	PredictionUpdateFrequency time.Duration
	// DataSource is the datasource of the predictor, such as prometheus, nodelocal, etc.
	DataSource []string
	// DataSourcePromConfig is the prometheus datasource config
	DataSourcePromConfig providers.PromConfig
	// DataSourceMockConfig is the mock data provider
	DataSourceMockConfig providers.MockConfig
	// DataSourceGrpcConfig is the config for grpc provider
	DataSourceGrpcConfig providers.GrpcConfig

	// AlgorithmModelConfig
	AlgorithmModelConfig config.AlgorithmModelConfig

	// WebhookConfig
	WebhookConfig webhooks.WebhookConfig

	// RecommendationConfigFile is the configuration file for resource/HPA recommendations.
	// If unspecified, a default is provided.
	RecommendationConfigFile string

	// QOSConfigFile is the configuration file for QOS.
	QOSConfigFile string

	// ServerOptions hold the craned web server options
	ServerOptions *ServerOptions

	// EhpaControllerConfig is the configuration for Ehpa controller
	EhpaControllerConfig ehpa.EhpaControllerConfig

	// RecommendationConfiguration is configuration file for recommendation framework.
	// If unspecified, a default is provided.
	RecommendationConfiguration string

	// OOMRecordMaxNumber is the max number for oom record
	OOMRecordMaxNumber int

	// TimeSeriesPredictionMaxConcurrentReconciles is the max concurrent reconciles for TimeSeriesPrediction controller
	TimeSeriesPredictionMaxConcurrentReconciles int

	// CacheUnstructured indicates whether to cache Unstructured objects. When enabled, it will speed up reading Unstructured objects, but will increase memory usage.
	CacheUnstructured bool

	// MonitorInterval is the interval for recommendation checker
	MonitorInterval time.Duration

	// OutDateInterval is the checking interval for identify a recommendation is outdated
	OutDateInterval time.Duration
}

// NewOptions builds an empty options.
func NewOptions() *Options {
	return &Options{
		ServerOptions: NewServerOptions(),
	}
}

// Complete completes all the required options.
func (o *Options) Complete() error {
	return o.ServerOptions.Complete()
}

// Validate all required options.
func (o *Options) Validate() []error {
	return o.ServerOptions.Validate()
}

func (o *Options) ApplyTo(cfg *serverconfig.Config) error {
	return o.ServerOptions.ApplyTo(cfg)
}

// AddFlags adds flags to the specified FlagSet.
func (o *Options) AddFlags(flags *pflag.FlagSet) {
	o.ServerOptions.AddFlags(flags)

	flags.IntVar(&o.ApiQps, "api-qps", 300, "QPS of rest config.")
	flags.IntVar(&o.ApiBurst, "api-burst", 400, "Burst of rest config.")
	flags.StringVar(&o.MetricsAddr, "metrics-bind-address", ":8080", "The address the metric endpoint binds to.")
	flags.StringVar(&o.BindAddr, "health-probe-bind-address", ":8081", "The address the probe endpoint binds to.")
	flags.BoolVar(&o.LeaderElection.LeaderElect, "leader-elect", true, "Start a leader election client and gain leadership before executing the main loop. Enable this when running replicated components for high availability.")
	flags.DurationVar(&o.LeaderElection.LeaseDuration.Duration, "lease-duration", 15*time.Second,
		"Specifies the expiration period of lease.")
	flags.DurationVar(&o.LeaderElection.RetryPeriod.Duration, "lease-retry-period", 2*time.Second,
		"Specifies the lease renew interval.")
	flags.DurationVar(&o.LeaderElection.RenewDeadline.Duration, "lease-renew-period", 10*time.Second,
		"Specifies the lease renew interval.")

	flags.DurationVar(&o.PredictionUpdateFrequency, "prediction-update-frequency-duration", 30*time.Second,
		"Specifies the update frequency of the prediction.")
	flags.StringSliceVar(&o.DataSource, "datasource", []string{"prom"}, "data source of the predictor, prom, mock is available")
	flags.StringVar(&o.DataSourcePromConfig.Address, "prometheus-address", "", "prometheus address")
	flags.StringVar(&o.DataSourcePromConfig.AdapterConfigMapNS, "prometheus-adapter-configmap-namespace", "", "prometheus adapter-configmap namespace")
	flags.StringVar(&o.DataSourcePromConfig.AdapterConfigMapName, "prometheus-adapter-configmap-name", "", "prometheus adapter-configmap name")
	flags.StringVar(&o.DataSourcePromConfig.AdapterConfigMapKey, "prometheus-adapter-configmap-key", "", "prometheus adapter-configmap key")
	flags.StringVar(&o.DataSourcePromConfig.AdapterConfig, "prometheus-adapter-config", "", "prometheus adapter-config path")
	flags.StringVar(&o.DataSourcePromConfig.AdapterExtensionLabels, "prometheus-adapter-extension-labels", "", "prometheus adapter extension-labels for expressionQuery")
	flags.StringVar(&o.DataSourcePromConfig.ExtensionLabels, "extension-labels", "", "extension-labels for every prometheus query")
	flags.StringVar(&o.DataSourcePromConfig.Auth.Username, "prometheus-auth-username", "", "prometheus auth username")
	flags.StringVar(&o.DataSourcePromConfig.Auth.Password, "prometheus-auth-password", "", "prometheus auth password")
	flags.StringVar(&o.DataSourcePromConfig.Auth.BearerToken, "prometheus-auth-bearertoken", "", "prometheus auth bearertoken")
	flags.IntVar(&o.DataSourcePromConfig.QueryConcurrency, "prometheus-query-concurrency", 10, "prometheus query concurrency")
	flags.BoolVar(&o.DataSourcePromConfig.InsecureSkipVerify, "prometheus-insecure-skip-verify", false, "prometheus insecure skip verify")
	flags.DurationVar(&o.DataSourcePromConfig.KeepAlive, "prometheus-keepalive", 60*time.Second, "prometheus keep alive")
	flags.DurationVar(&o.DataSourcePromConfig.Timeout, "prometheus-timeout", 3*time.Minute, "prometheus timeout")
	flags.BoolVar(&o.DataSourcePromConfig.BRateLimit, "prometheus-bratelimit", false, "prometheus bratelimit")
	flags.IntVar(&o.DataSourcePromConfig.MaxPointsLimitPerTimeSeries, "prometheus-maxpoints", 11000, "prometheus max points limit per time series")
	flags.StringVar(&o.DataSourceMockConfig.SeedFile, "seed-file", "", "mock provider seed file")
	flags.StringVar(&o.DataSourceGrpcConfig.Address, "grpc-ds-address", "localhost:50051", "grpc data source server address")
	flags.DurationVar(&o.DataSourceGrpcConfig.Timeout, "grpc-ds-timeout", time.Minute, "grpc timeout")
	flags.DurationVar(&o.AlgorithmModelConfig.UpdateInterval, "model-update-interval", 12*time.Hour, "algorithm model update interval, now used for dsp model update interval")
	flags.BoolVar(&o.WebhookConfig.Enabled, "webhook-enabled", true, "whether enable webhook or not, default to true")
	flags.StringVar(&o.RecommendationConfigFile, "recommendation-config-file", "", "recommendation configuration file")
	flags.StringVar(&o.RecommendationConfiguration, "recommendation-configuration-file", "/tmp/recommendation-framework/recommendation_configuration.yaml", "recommendation configuration file")
	flags.StringVar(&o.QOSConfigFile, "qos-config-file", "", "qos configuration file")
	flags.StringSliceVar(&o.EhpaControllerConfig.PropagationConfig.LabelPrefixes, "ehpa-propagation-label-prefixes", []string{}, "propagate labels whose key has the prefix to hpa")
	flags.StringSliceVar(&o.EhpaControllerConfig.PropagationConfig.AnnotationPrefixes, "ehpa-propagation-annotation-prefixes", []string{}, "propagate annotations whose key has the prefix to hpa")
	flags.StringSliceVar(&o.EhpaControllerConfig.Propagati
```

### Core Architecture Module: `cmd/craned/app/options/server_options.go`
```
package options

import (
	"fmt"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/spf13/pflag"
	"gopkg.in/gcfg.v1"

	serverconfig "github.com/gocrane/crane/pkg/server/config"
	"github.com/gocrane/crane/pkg/server/service/dashboard"
	"github.com/gocrane/crane/pkg/server/store/secret"
)

// ServerOptions used for craned web server
type ServerOptions struct {
	BindAddress string
	BindPort    int

	EnableProfiling bool
	EnableMetrics   bool
	Mode            string

	EnableGrafana     bool
	GrafanaConfigFile string
	dashboard.GrafanaConfig

	StoreType string
}

func NewServerOptions() *ServerOptions {
	return &ServerOptions{}
}

func (o *ServerOptions) Complete() error {
	if o.EnableGrafana {
		var gconfig dashboard.GrafanaConfig
		grafanaConfig, err := os.Open(o.GrafanaConfigFile)
		if err != nil {
			return err
		}
		defer grafanaConfig.Close()

		if err := gcfg.FatalOnly(gcfg.ReadInto(&gconfig, grafanaConfig)); err != nil {
			return err
		}
		o.GrafanaConfig = gconfig
	}
	return nil
}

func (o *ServerOptions) ApplyTo(cfg *serverconfig.Config) error {
	cfg.BindAddress = o.BindAddress
	cfg.BindPort = o.BindPort

	cfg.Mode = o.Mode
	cfg.EnableMetrics = o.EnableMetrics
	cfg.EnableProfiling = o.EnableProfiling

	cfg.EnableGrafana = o.EnableGrafana
	cfg.GrafanaConfig = &o.GrafanaConfig
	cfg.StoreType = o.StoreType
	return nil
}

func (o *ServerOptions) Validate() []error {
	var errors []error

	if o.EnableGrafana {
		if o.APIKey == "" && o.Username == "" && o.Password == "" {
			errors = append(errors, fmt.Errorf("no apikey or username&password specified"))
		}
	}

	if o.BindPort < 0 || o.BindPort > 65535 {
		errors = append(
			errors,
			fmt.Errorf(
				"--server-bind-port %v must be between 0 and 65535, inclusive. 0 for turning off insecure (HTTP) port",
				o.BindPort,
			),
		)
	}

	if strings.ToLower(o.StoreType) != secret.StoreType {
		errors = append(errors, fmt.Errorf("--server-store only support secret now"))
	}

	return errors
}

// AddFlags adds flags related to features for a specific server option to the
// specified FlagSet.
func (o *ServerOptions) AddFlags(fs *pflag.FlagSet) {
	if fs == nil {
		return
	}

	fs.StringVar(&o.BindAddress, "server-bind-address", "0.0.0.0", ""+
		"The IP address on which to serve the --server-bind-port "+
		"(set to 0.0.0.0 for all IPv4 interfaces and :: for all IPv6 interfaces).")
	fs.IntVar(&o.BindPort, "server-bind-port", 8082,
		"The port on which to serve unsecured, unauthenticated access")

	fs.BoolVar(&o.EnableProfiling, "server-enable-profiling", o.EnableProfiling,
		"Enable profiling via web interface host:port/debug/pprof/")

	fs.BoolVar(&o.EnableMetrics, "server-enable-metrics", o.EnableMetrics,
		"Enables metrics on the server at /metrics")

	fs.StringVar(&o.Mode, "server-mode", gin.ReleaseMode,
		"Debug mode of the gin server, support release,debug,test")

	fs.BoolVar(&o.EnableGrafana, "server-enable-grafana", o.EnableGrafana,
		"Enable grafana will read grafana config file to requests grafana dashboard")

	fs.StringVar(&o.GrafanaConfigFile, "server-grafana-config", o.GrafanaConfigFile,
		"Grafana config file, file contents is grafana config")

	fs.StringVar(&o.StoreType, "server-store", secret.StoreType, "Server storage type, support secret now")

}

```

### Core Architecture Module: `cmd/craned/main.go`
```
package main

import (
	"fmt"
	"os"

	"k8s.io/component-base/logs"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"

	"github.com/gocrane/crane/cmd/craned/app"
)

// craned main.
func main() {
	logs.InitLogs()
	defer logs.FlushLogs()

	ctx := signals.SetupSignalHandler()

	if err := app.NewManagerCommand(ctx).Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/metric-adapter/main.go`
```
package main

import (
	"flag"
	"os"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	openapinamer "k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	v1core "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/scale"
	"k8s.io/client-go/tools/record"
	"k8s.io/component-base/logs"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"
	basecmd "sigs.k8s.io/custom-metrics-apiserver/pkg/cmd"
	"sigs.k8s.io/custom-metrics-apiserver/pkg/provider"

	autoscalingapi "github.com/gocrane/api/autoscaling/v1alpha1"
	generatedopenapi "github.com/gocrane/api/pkg/generated/openapi"
	predictionapi "github.com/gocrane/api/prediction/v1alpha1"

	"github.com/gocrane/crane/pkg/metricprovider"
)

var (
	scheme = runtime.NewScheme()
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))

	utilruntime.Must(autoscalingapi.AddToScheme(scheme))
	utilruntime.Must(predictionapi.AddToScheme(scheme))
	//+kubebuilder:scaffold:scheme

}

type MetricAdapter struct {
	basecmd.AdapterBase

	// Message is printed on successful startup
	Message string
}

func (a *MetricAdapter) makeCustomMetricProvider(remoteAdapter *metricprovider.RemoteAdapter, client client.Client, recorder record.EventRecorder) provider.CustomMetricsProvider {
	return metricprovider.NewCustomMetricProvider(client, remoteAdapter, recorder)
}

func (a *MetricAdapter) makeExternalMetricProvider(remoteAdapter *metricprovider.RemoteAdapter, client client.Client, recorder record.EventRecorder, scaleClient scale.ScalesGetter, restMapper meta.RESTMapper) *metricprovider.ExternalMetricProvider {
	return metricprovider.NewExternalMetricProvider(client, remoteAdapter, recorder, scaleClient, restMapper)
}

func main() {
	logs.InitLogs()
	defer logs.FlushLogs()

	cmd := &MetricAdapter{}

	cmd.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(generatedopenapi.GetOpenAPIDefinitions, openapinamer.NewDefinitionNamer(scheme))
	cmd.OpenAPIConfig.Info.Title = "crane-metric-adapter"
	cmd.OpenAPIConfig.Info.Version = "1.0.0"

	var enableRemoteAdapter bool
	var remoteAdapterServiceNamespace string
	var remoteAdapterServiceName string
	var remoteAdapterServicePort int
	var apiQps int
	var apiBurst int

	cmd.Flags().StringVar(&cmd.Message, "msg", "Starting adapter...", "startup message")
	cmd.Flags().BoolVar(&enableRemoteAdapter, "remote-adapter", false, "Enable a remote adapter to provide a set of custom metrics")
	cmd.Flags().StringVar(&remoteAdapterServiceNamespace, "remote-adapter-service-namespace", "", "Namespace of remote adapter's service")
	cmd.Flags().StringVar(&remoteAdapterServiceName, "remote-adapter-service-name", "", "Name of remote adapter's service")
	cmd.Flags().IntVar(&remoteAdapterServicePort, "remote-adapter-service-port", 6443, "Port of remote adapter's service")
	cmd.Flags().IntVar(&apiQps, "api-qps", 300, "QPS of rest config.")
	cmd.Flags().IntVar(&apiBurst, "api-burst", 400, "Burst of rest config.")
	cmd.Flags().AddGoFlagSet(flag.CommandLine) // make sure we get the klog flags
	if err := cmd.Flags().Parse(os.Args); err != nil {
		return
	}

	config, err := ctrl.GetConfig()
	if err != nil {
		klog.Exitf("Failed to get config: %v", err)
	}

	config.QPS = float32(apiQps)
	config.Burst = apiBurst

	clientOptions := client.Options{Scheme: scheme}
	client, err := client.New(config, clientOptions)
	if err != nil {
		klog.Exitf("Failed to get client: %v", err)
	}

	var remoteAdapter *metricprovider.RemoteAdapter
	if enableRemoteAdapter {
		klog.Infof("Enable remote adapter: %s/%s", remoteAdapterServiceNamespace, remoteAdapterServiceName)
		remoteAdapter, err = metricprovider.NewRemoteAdapter(remoteAdapterServiceNamespace, remoteAdapterServiceName, remoteAdapterServicePort, config, client)
		if err != nil {
			klog.Exitf("Failed to create remote adapter: %v", err)
		}
	}

	kubeClient, err := kubernetes.NewForConfig(config)
	if err != nil {
		klog.Exitf("Failed to create kube client: %v", err)
	}
	discoveryClientSet, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		klog.Exit(err, "Unable to create discover client")
	}

	restMapper, err := apiutil.NewDynamicRESTMapper(config)
	if err != nil {
		klog.Exit(err, "Unable to create rest mapper")
	}

	scaleKindResolver := scale.NewDiscoveryScaleKindResolver(discoveryClientSet)
	scaleClient := scale.New(
		discoveryClientSet.RESTClient(), restMapper,
		dynamic.LegacyAPIPathResolverFunc,
		scaleKindResolver,
	)

	broadcaster := record.NewBroadcaster()
	broadcaster.StartRecordingToSink(&v1core.EventSinkImpl{
		Interface: kubeClient.CoreV1().Events(""),
	})
	recorder := broadcaster.NewRecorder(scheme, corev1.EventSource{Component: "crane-metric-adapter"})

	ctx := signals.SetupSignalHandler()

	customMetricProvider := cmd.makeCustomMetricProvider(remoteAdapter, client, recorder)
	externalMetricProvider := cmd.makeExternalMetricProvider(remoteAdapter, client, recorder, scaleClient, restMapper)

	cmd.WithCustomMetrics(customMetricProvider)
	cmd.WithExternalMetrics(externalMetricProvider)

	klog.Infof(cmd.Message)
	if err := cmd.Run(ctx.Done()); err != nil {
		klog.ErrorS(err, "Failed to run metrics adapter")
		os.Exit(1)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #933** (2026-09-17): **oom-record ConfigMap exceeds 1MB limit, causing craned busy-loop and OOMKilled/CrashLoopBackOff**
  *Symptoms*: E0727 19:30:17.587574       1 recorder.go:144] Update oomRecord failed: ConfigMap "oom-record" is invalid: []: Too long: must have at most 1048576 bytes  When the `oom-record` ConfigMap in `crane-system` grows to the Kubernetes 1MB object size limit (1048576 bytes), `PodOOMRecorder` can no longer update it and enters an unbounded, no-backoff retry loop. This floods the log, drives CPU/memory usage up, and eventually gets the `craned` container OOMKilled, leading to CrashLoopBackOff. After restart the ConfigMap is still oversized, so it never self-heals.  

- **Issue #932** (2026-07-05): **feat: add carbon grid api, add automatic apply and make UI changes**
  *Symptoms*: 

- **Issue #931** (2026-09-17): **Private channel for reporting a security issue**
  *Symptoms*: Hello maintainers,  I found potential security issues affecting GitHub Actions workflows in this repository.  I do not want to disclose technical details publicly before maintainers have reviewed them. Could you please enable GitHub private vulnerability reporting or provide an alternative private security contact email?  I can provide a detailed report including:  - affected workflow paths; - current affected commit; - vulnerability mechanism; - required attacker permissions and preconditions; - security impact assessment; - non-destructive validation steps; - suggested remediation.  Thank you.

- **Issue #928** (2026-01-10): **Update main.go**
  *Symptoms*: <!--  Thanks for sending a pull request!  -->  #### What type of PR is this?   #### What this PR does / why we need it:  #### Which issue(s) this PR fixes: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. --> Fixes #  #### Special notes for your reviewer:  

- **Issue #927** (2026-09-17): **目前支持华为云cce吗？**
  *Symptoms*: ## Describe the feature 目前支持华为云cce吗？

- **Issue #926** (2026-09-17): **我看官网有提到支持内存超分，但实测发现无效，是我使用方式不对吗**
  *Symptoms*: **环境**： k8s版本为1.19，且组件已安装好  <img width="507" height="107" alt="Image" src="https://github.com/user-attachments/assets/a9397541-a6dc-439e-8743-3e453508ec8a" />   **A机器内存情况**： k8s可分配-k8s已分配=大约20G，  <img width="383" height="212" alt="Image" src="https://github.com/user-attachments/assets/b2a7b05a-72d7-425d-83a9-37fbb443aca4" />  但机器的实际可用内存大于20G  <img width="689" height="39" alt="Image" src="https://github.com/user-attachments/assets/e92856ec-7a84-4c06-aff5-0052aba8c1b0" />  **现象**： 创建pod并指定调度到A机器，内存使用的配置是gocrane.io/memory: 25Gi  <img width="274" height="112" alt="Image" src="https://github.com/user-attachments/assets/a651c33f-777d-4d72-bfae-3cdd0fedde5b" />  提示pod还是由于节点内存不足而无法调度  **疑问**： https://gocrane.io/zh-cn/docs/tutorials/colocation-with-enhanced-qos/qos-dynamic-resource-oversold-and-limit.zh/ 提到可以使用配置gocrane.io/<$ResourceName>：<$value>来实现超分，是我理解或者用得不对吗

- **Issue #924** (2026-09-17): **Crane Container Image for s390x**
  *Symptoms*: ## Describe the feature  You are providing container images for arm and x856 until now. Other open source projects are using your container images as a foundation for building their own projects. Kubernetes-based projects have got new hybrid cloud features and that makes it possible to combine x86 and arm together with the mainframe architecture s390x.  I have seen, that you are building your container images with docker buildx, what is the best opportunity for multi-arch container images. Based on that, you can build for following architectures:  linux/amd64, linux/amd64/v2, linux/amd64/v3, linux/arm64, linux/riscv64, linux/ppc64, linux/ppc64le, linux/s390x, linux/386, linux/mips64le, linux/mips64, linux/loong64, linux/arm/v7, linux/arm/v6  I want to add the s390x architecture to your build pipelines. Your code is buildable on this architecture (verified via openSUSE). Is that ok for you?

- **Issue #922** (2026-09-17): **[Security Issue] metric-adapter ClusterRole grants full cluster-wide privileges**
  *Symptoms*: ## 🔐 [Security Issue] `metric-adapter` ClusterRole grants full cluster-wide privileges  The current configuration of the `metric-adapter` component defines an overly permissive ClusterRole and applies it directly to a running pod through a ServiceAccount and ClusterRoleBinding. This creates a **critical security risk** where compromising a single pod could lead to **complete cluster takeover**.  ---  ### 🔍 Misconfigured RBAC Flow with Source Links  ---  #### 1️⃣ Overprivileged `ClusterRole` definition   📄 [`rbac.yaml` lines 1–8](https://github.com/gocrane/crane/blob/2b0ddae8ebbca49788d77ece632d73b252533ef9/deploy/metric-adapter/rbac.yaml#L1-L8)  ```yaml apiVersion: rbac.authorization.k8s.io/v1 kind: ClusterRole metadata:   name: metric-adapter  # <-- (A) overly permissive role rules:   - apiGroups: [ "*" ]     resources: [ "*" ]     verbs: [ "*" ] ```  > This ClusterRole grants **full access to all API groups, resources, and actions**, including reading secrets, modifying configurations, deleting deployments, and more.  ---  #### 2️⃣ Binding the ClusterRole to a ServiceAccount   📄 [`rbac.yaml` lines 100–111](https://github.com/gocrane/crane/blob/2b0ddae8ebbca49788d77ece632d73b252533ef9/deploy/metric-adapter/rbac.yaml#L100-L111)  ```yaml apiVersion: rbac.authorization.k8s.io/v1 kind: ClusterRoleBinding metadata:   name: metric-adapter roleRef:   kind: ClusterRole   name: metric-adapter  # <-- (A) reference to the powerful role subjects:   - kind: ServiceAccount     name: m
  **Post-Mortem & Fix Analysis**:
  > ### You may look for issues: 1. 54% #920  <sub>🤖 By [issues-similarity-analysis](https://github.com/actions-cool/issues-similarity-analysis)</sub>  <!-- Created by actions-cool/issues-similarity-analysis. Do not remove. --> 

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

### Incident Patch 1: `2b0ddae8` (2024-12-20)
**Commit Message**: Merge pull request #915 from Cloudzp/fix_recommendation_trigger_err

fix the issue that trigger recommendation by run number abormal

**File**: `pkg/controller/recommendation/recommendation_trigger_controller.go` (modified, +1/-2)
```diff
@@ -101,12 +101,11 @@ func (c *RecommendationTriggerController) Reconcile(ctx context.Context, req ctr
 		}
 	}
 
+	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if currentMissionIndex == -1 {
 		klog.Warningf("cannot found recommendation mission %s", recommendationRuleRef.Name)
 		return ctrl.Result{}, nil
 	}
-
-	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if newStatus.Recommendations[currentMissionIndex].Message != "Success" {
 		err = c.Client.Delete(context.TODO(), recommendation)
 		if err != nil {
```

---

### Incident Patch 2: `7acac494` (2024-12-04)
**Commit Message**: fix the issue that trigger recommendation by run number abormal

**File**: `pkg/controller/recommendation/recommendation_trigger_controller.go` (modified, +1/-2)
```diff
@@ -101,12 +101,11 @@ func (c *RecommendationTriggerController) Reconcile(ctx context.Context, req ctr
 		}
 	}
 
+	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if currentMissionIndex == -1 {
 		klog.Warningf("cannot found recommendation mission %s", recommendationRuleRef.Name)
 		return ctrl.Result{}, nil
 	}
-
-	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if newStatus.Recommendations[currentMissionIndex].Message != "Success" {
 		err = c.Client.Delete(context.TODO(), recommendation)
 		if err != nil {
```

---

### Incident Patch 3: `d5e108b9` (2024-05-12)
**Commit Message**: fix: close SeedFile

**File**: `pkg/providers/mock/mock.go` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ func NewProvider(config *providers.MockConfig) (providers.Interface, error) {
 		klog.ErrorS(err, "Failed to open seed file", "seedFile", config.SeedFile)
 		return nil, err
 	}
+	defer r.Close()
 	buf, err := ioutil.ReadAll(r)
 	if err != nil {
 		klog.ErrorS(err, "Failed to read seed file", "seedFile", config.SeedFile)
```

---

### Incident Patch 4: `4f4e3cdb` (2024-04-17)
**Commit Message**: Merge pull request #900 from Cloudzp/bugfix

 fix issues #898

**File**: `go.mod` (modified, +6/-1)
```diff
@@ -9,6 +9,9 @@ require (
 	github.com/google/cadvisor v0.41.0
 	github.com/jaypipes/ghw v0.9.0
 	github.com/mjibson/go-dsp v0.0.0-20180508042940-11479a337f12
+	github.com/onsi/ginkgo v1.16.5
+	github.com/onsi/gomega v1.15.0
+	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.11.0
 	github.com/prometheus/common v0.26.0
 	github.com/shirou/gopsutil v3.21.10+incompatible
@@ -78,6 +81,7 @@ require (
 	github.com/ghodss/yaml v1.0.0 // indirect
 	github.com/gin-contrib/sse v0.1.0 // indirect
 	github.com/go-logr/logr v0.4.0 // indirect
+	github.com/go-logr/zapr v0.4.0 // indirect
 	github.com/go-ole/go-ole v1.2.6 // indirect
 	github.com/go-openapi/jsonpointer v0.19.5 // indirect
 	github.com/go-openapi/jsonreference v0.19.5 // indirect
@@ -113,12 +117,12 @@ require (
 	github.com/modern-go/reflect2 v1.0.2 // indirect
 	github.com/mrunalp/fileutils v0.5.0 // indirect
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
+	github.com/nxadm/tail v1.4.8 // indirect
 	github.com/opencontainers/go-digest v1.0.0 // indirect
 	github.com/opencontainers/image-spec v1.0.1 // indirect
 	github.com/opencontainers/runc v1.0.2 // indirect
 	github.com/opencontainers/runtime-spec v1.0.3-0.20210326190908-1c3f411f0417 // indirect
 	github.com/opencontainers/selinux v1.8.2 // indirect
-	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
 	github.com/prometheus/client_model v0.2.0 // indirect
 	github.com/prometheus/procfs v0.6.0 // indirect
@@ -155,6 +159,7 @@ require (
 	google.golang.org/appengine v1.6.7 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.0.0 // indirect
+	gopkg.in/tomb.v1 v1.0.0-20141024135613-dd632973f1e7 // indirect
 	gopkg.in/warnings.v0 v0.1.2 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
 	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b // indirect
```

**File**: `pkg/controller/recommendation/recommendation_checker.go` (modified, +1/-1)
```diff
@@ -60,6 +60,6 @@ func (r Checker) runChecker() {
 			"owner_name":    recommend.Spec.TargetRef.Name,
 			"update_status": updateStatus,
 			"result_status": resultStatus,
-		}).Set(1)
+		}).Set(time.Now().Sub(recommend.Status.LastUpdateTime.Time).Seconds())
 	}
 }
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +117/-6)
```diff
@@ -15,12 +15,16 @@ import (
 	"k8s.io/apimachinery/pkg/api/meta"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	unstructuredv1 "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/labels"
 	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/discovery"
 	"k8s.io/client-go/dynamic"
+	"k8s.io/client-go/dynamic/dynamicinformer"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/scale"
+	"k8s.io/client-go/tools/cache"
 	"k8s.io/client-go/tools/record"
 	"k8s.io/client-go/util/retry"
 	"k8s.io/klog/v2"
@@ -30,7 +34,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/predicate"
 
 	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
-
 	"github.com/gocrane/crane/pkg/known"
 	"github.com/gocrane/crane/pkg/metrics"
 	"github.com/gocrane/crane/pkg/oom"
@@ -54,6 +57,7 @@ type RecommendationRuleController struct {
 	dynamicClient   dynamic.Interface
 	discoveryClient discovery.DiscoveryInterface
 	Provider        providers.History
+	dynamicLister   DynamicLister
 }
 
 func (c *RecommendationRuleController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
@@ -147,9 +151,10 @@ func (c *RecommendationRuleController) doReconcile(ctx context.Context, recommen
 		keys = append(keys, k)
 	}
 	sort.Strings(keys) // sort key to get a certain order
+	recommendationIndex := NewRecommendationIndex(currRecommendations)
 	for _, key := range keys {
 		id := identities[key]
-		id.Recommendation = GetRecommendationFromIdentity(identities[key], currRecommendations)
+		id.Recommendation = recommendationIndex.GetRecommendation(id)
 		identitiesArray = append(identitiesArray, id)
 	}
 
@@ -243,6 +248,8 @@ func (c *RecommendationRuleController) SetupWithManager(mgr ctrl.Manager) error
 	c.kubeClient = kubernetes.NewForConfigOrDie(mgr.GetConfig())
 	c.discoveryClient = discovery.NewDiscoveryClientForConfigOrDie(mgr.GetConfig())
 	c.dynamicClient = dynamic.NewForConfigOrDie(mgr.GetConfig())
+	dynamicInformerFactory := dynamicinformer.NewDynamicSharedInformerFactory(c.dynamicClient, 0)
+	c.dynamicLister = NewDynamicInformerLister(dynamicInformerFactory)
 
 	return ctrl.NewControllerManagedBy(mgr).
 		For(&analysisv1alph1.RecommendationRule{}, builder.WithPredicates(predicate.GenerationChangedPredicate{})).
@@ -264,19 +271,19 @@ func (c *RecommendationRuleController) getIdentities(ctx context.Context, recomm
 
 		var unstructureds []unstructuredv1.Unstructured
 		if recommendationRule.Spec.NamespaceSelector.Any {
-			unstructuredList, err := c.dynamicClient.Resource(*gvr).List(ctx, metav1.ListOptions{})
+			unstructuredList, err := c.dynamicLister.List(ctx, *gvr, "")
 			if err != nil {
 				return nil, err
 			}
-			unstructureds = append(unstructureds, unstructuredList.Items...)
+			unstructureds = append(unstructureds, unstructuredList...)
 		} else {
 			for _, namespace := range recommendationRule.Spec.NamespaceSelector.MatchNames {
-				unstructuredList, err := c.dynamicClient.Resource(*gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
+				unstructuredList, err := c.dynamicLister.List(ctx, *gvr, namespace)
 				if err != nil {
 					return nil, err
 				}
 
-				unstructureds = append(unstructureds, unstructuredList.Items...)
+				unstructureds = append(unstructureds, unstructuredList...)
 			}
 		}
 
@@ -453,6 +460,7 @@ func executeIdentity(ctx context.Context, wg *sync.WaitGroup, recommenderMgr rec
 	defer func() {
 		if wg != nil {
 			wg.Done()
+			metrics.RecommendationExecutionCounter.WithLabelValues(id.APIVersion, id.Kind, id.Namespace, id.Name, id.Recommender).Inc()
 		}
 	}()
 	var message string
@@ -528,3 +536,106 @@ func IsConvertFromAnalytics(recommendationRule *analysisv1alph1.RecommendationRu
 
 	return false, ""
 }
+
+// DynamicLister is a lister for dynamic resources.
+type DynamicLister interface {
+	// List returns a list of resources matching the given groupVersionResource.
+	List(ctx contex
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller_test.go` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+package recommendation
+
+import (
+	"reflect"
+	"testing"
+
+	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
+	corev1 "k8s.io/api/core/v1"
+	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+)
+
+func TestRecommendationIndex_GetRecommendation(t *testing.T) {
+	type fields struct {
+		recommendationList analysisv1alph1.RecommendationList
+	}
+	type args struct {
+		id ObjectIdentity
+	}
+
+	tests := []struct {
+		name   string
+		fields fields
+		args   args
+		want   *analysisv1alph1.Recommendation
+	}{
+		{
+			name: "TestRecommendationIndex_GetRecommendation good case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-bar",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-foo",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+					},
+				},
+			},
+			want: &analysisv1alph1.Recommendation{
+				ObjectMeta: v1.ObjectMeta{
+					Name:      "test-recommendation-rule",
+					Namespace: "test-namespace",
+				},
+				Spec: analysisv1alph1.RecommendationSpec{
+					TargetRef: corev1.ObjectReference{
+						Namespace:  "test-namespace",
+						Kind:       "Deployment",
+						Name:       "test-deployment-bar",
+						APIVersion: "app/v1",
+					},
+					Type: analysisv1alph1.AnalysisTypeResource,
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-bar",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resource",
+				},
+			},
+		},
+		{
+			name: "TestRecommendationIndex_GetRecommendation empty case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{},
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-name",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resources",
+				},
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			idx := NewRecommendationIndex(tt.fields.recommendationList)
+			if got := idx.GetRecommendation(tt.args.id); !reflect.DeepEqual(got, tt.want) {
+				t.Errorf("GetRecommendation() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
```

**File**: `pkg/metrics/analysis.go` (modified, +11/-1)
```diff
@@ -6,6 +6,16 @@ import (
 )
 
 var (
+	RecommendationExecutionCounter = prometheus.NewCounterVec(
+		prometheus.CounterOpts{
+			Namespace: "crane",
+			Subsystem: "analysis",
+			Name:      "recommendation_execution_total",
+			Help:      "The number of times Recommendation has been executed",
+		},
+		[]string{"apiversion", "owner_kind", "namespace", "owner_name", "type"},
+	)
+
 	ResourceRecommendation = prometheus.NewGaugeVec(
 		prometheus.GaugeOpts{
 			Namespace: "crane",
@@ -48,5 +58,5 @@ var (
 )
 
 func init() {
-	metrics.Registry.MustRegister(ResourceRecommendation, ReplicasRecommendation, SelectTargets, RecommendationsStatus)
+	metrics.Registry.MustRegister(RecommendationExecutionCounter, ResourceRecommendation, ReplicasRecommendation, SelectTargets, RecommendationsStatus)
 }
```

---

### Incident Patch 5: `d8d5dd20` (2024-04-17)
**Commit Message**: fix ut and fmt  error

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +4/-5)
```diff
@@ -3,10 +3,6 @@ package recommendation
 import (
 	"context"
 	"fmt"
-	"k8s.io/apimachinery/pkg/labels"
-	"k8s.io/apimachinery/pkg/runtime/schema"
-	"k8s.io/client-go/dynamic/dynamicinformer"
-	"k8s.io/client-go/tools/cache"
 	"sort"
 	"strconv"
 	"strings"
@@ -19,12 +15,16 @@ import (
 	"k8s.io/apimachinery/pkg/api/meta"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	unstructuredv1 "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/labels"
 	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/discovery"
 	"k8s.io/client-go/dynamic"
+	"k8s.io/client-go/dynamic/dynamicinformer"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/scale"
+	"k8s.io/client-go/tools/cache"
 	"k8s.io/client-go/tools/record"
 	"k8s.io/client-go/util/retry"
 	"k8s.io/klog/v2"
@@ -34,7 +34,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/predicate"
 
 	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
-
 	"github.com/gocrane/crane/pkg/known"
 	"github.com/gocrane/crane/pkg/metrics"
 	"github.com/gocrane/crane/pkg/oom"
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller_test.go` (modified, +6/-4)
```diff
@@ -1,11 +1,12 @@
 package recommendation
 
 import (
+	"reflect"
+	"testing"
+
 	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
 	corev1 "k8s.io/api/core/v1"
 	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	"reflect"
-	"testing"
 )
 
 func TestRecommendationIndex_GetRecommendation(t *testing.T) {
@@ -69,14 +70,15 @@ func TestRecommendationIndex_GetRecommendation(t *testing.T) {
 					TargetRef: corev1.ObjectReference{
 						Namespace:  "test-namespace",
 						Kind:       "Deployment",
-						Name:       "test-deployment-name",
+						Name:       "test-deployment-bar",
 						APIVersion: "app/v1",
 					},
+					Type: analysisv1alph1.AnalysisTypeResource,
 				},
 			},
 			args: args{
 				id: ObjectIdentity{
-					Name:        "test-deployment-name",
+					Name:        "test-deployment-bar",
 					Namespace:   "test-namespace",
 					APIVersion:  "app/v1",
 					Kind:        "Deployment",
```

---

### Incident Patch 6: `c48a90b0` (2024-04-07)
**Commit Message**: fix issues #898

**File**: `go.mod` (modified, +6/-1)
```diff
@@ -9,6 +9,9 @@ require (
 	github.com/google/cadvisor v0.41.0
 	github.com/jaypipes/ghw v0.9.0
 	github.com/mjibson/go-dsp v0.0.0-20180508042940-11479a337f12
+	github.com/onsi/ginkgo v1.16.5
+	github.com/onsi/gomega v1.15.0
+	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.11.0
 	github.com/prometheus/common v0.26.0
 	github.com/shirou/gopsutil v3.21.10+incompatible
@@ -78,6 +81,7 @@ require (
 	github.com/ghodss/yaml v1.0.0 // indirect
 	github.com/gin-contrib/sse v0.1.0 // indirect
 	github.com/go-logr/logr v0.4.0 // indirect
+	github.com/go-logr/zapr v0.4.0 // indirect
 	github.com/go-ole/go-ole v1.2.6 // indirect
 	github.com/go-openapi/jsonpointer v0.19.5 // indirect
 	github.com/go-openapi/jsonreference v0.19.5 // indirect
@@ -113,12 +117,12 @@ require (
 	github.com/modern-go/reflect2 v1.0.2 // indirect
 	github.com/mrunalp/fileutils v0.5.0 // indirect
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
+	github.com/nxadm/tail v1.4.8 // indirect
 	github.com/opencontainers/go-digest v1.0.0 // indirect
 	github.com/opencontainers/image-spec v1.0.1 // indirect
 	github.com/opencontainers/runc v1.0.2 // indirect
 	github.com/opencontainers/runtime-spec v1.0.3-0.20210326190908-1c3f411f0417 // indirect
 	github.com/opencontainers/selinux v1.8.2 // indirect
-	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
 	github.com/prometheus/client_model v0.2.0 // indirect
 	github.com/prometheus/procfs v0.6.0 // indirect
@@ -155,6 +159,7 @@ require (
 	google.golang.org/appengine v1.6.7 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.0.0 // indirect
+	gopkg.in/tomb.v1 v1.0.0-20141024135613-dd632973f1e7 // indirect
 	gopkg.in/warnings.v0 v0.1.2 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
 	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b // indirect
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +116/-5)
```diff
@@ -3,6 +3,10 @@ package recommendation
 import (
 	"context"
 	"fmt"
+	"k8s.io/apimachinery/pkg/labels"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/dynamic/dynamicinformer"
+	"k8s.io/client-go/tools/cache"
 	"sort"
 	"strconv"
 	"strings"
@@ -54,6 +58,7 @@ type RecommendationRuleController struct {
 	dynamicClient   dynamic.Interface
 	discoveryClient discovery.DiscoveryInterface
 	Provider        providers.History
+	dynamicLister   DynamicLister
 }
 
 func (c *RecommendationRuleController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
@@ -147,9 +152,10 @@ func (c *RecommendationRuleController) doReconcile(ctx context.Context, recommen
 		keys = append(keys, k)
 	}
 	sort.Strings(keys) // sort key to get a certain order
+	recommendationIndex := NewRecommendationIndex(currRecommendations)
 	for _, key := range keys {
 		id := identities[key]
-		id.Recommendation = GetRecommendationFromIdentity(identities[key], currRecommendations)
+		id.Recommendation = recommendationIndex.GetRecommendation(id)
 		identitiesArray = append(identitiesArray, id)
 	}
 
@@ -243,6 +249,8 @@ func (c *RecommendationRuleController) SetupWithManager(mgr ctrl.Manager) error
 	c.kubeClient = kubernetes.NewForConfigOrDie(mgr.GetConfig())
 	c.discoveryClient = discovery.NewDiscoveryClientForConfigOrDie(mgr.GetConfig())
 	c.dynamicClient = dynamic.NewForConfigOrDie(mgr.GetConfig())
+	dynamicInformerFactory := dynamicinformer.NewDynamicSharedInformerFactory(c.dynamicClient, 0)
+	c.dynamicLister = NewDynamicInformerLister(dynamicInformerFactory)
 
 	return ctrl.NewControllerManagedBy(mgr).
 		For(&analysisv1alph1.RecommendationRule{}, builder.WithPredicates(predicate.GenerationChangedPredicate{})).
@@ -264,19 +272,19 @@ func (c *RecommendationRuleController) getIdentities(ctx context.Context, recomm
 
 		var unstructureds []unstructuredv1.Unstructured
 		if recommendationRule.Spec.NamespaceSelector.Any {
-			unstructuredList, err := c.dynamicClient.Resource(*gvr).List(ctx, metav1.ListOptions{})
+			unstructuredList, err := c.dynamicLister.List(ctx, *gvr, "")
 			if err != nil {
 				return nil, err
 			}
-			unstructureds = append(unstructureds, unstructuredList.Items...)
+			unstructureds = append(unstructureds, unstructuredList...)
 		} else {
 			for _, namespace := range recommendationRule.Spec.NamespaceSelector.MatchNames {
-				unstructuredList, err := c.dynamicClient.Resource(*gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
+				unstructuredList, err := c.dynamicLister.List(ctx, *gvr, namespace)
 				if err != nil {
 					return nil, err
 				}
 
-				unstructureds = append(unstructureds, unstructuredList.Items...)
+				unstructureds = append(unstructureds, unstructuredList...)
 			}
 		}
 
@@ -528,3 +536,106 @@ func IsConvertFromAnalytics(recommendationRule *analysisv1alph1.RecommendationRu
 
 	return false, ""
 }
+
+// DynamicLister is a lister for dynamic resources.
+type DynamicLister interface {
+	// List returns a list of resources matching the given groupVersionResource.
+	List(ctx context.Context, gvk schema.GroupVersionResource, namespace string) ([]unstructuredv1.Unstructured, error)
+}
+
+type dynamicInformerLister struct {
+	dynamicLister          map[schema.GroupVersionResource]cache.GenericLister
+	dynamicInformerFactory dynamicinformer.DynamicSharedInformerFactory
+	stopCh                 <-chan struct{}
+}
+
+func NewDynamicInformerLister(dynamicInformerFactory dynamicinformer.DynamicSharedInformerFactory) DynamicLister {
+	return &dynamicInformerLister{
+		dynamicLister:          map[schema.GroupVersionResource]cache.GenericLister{},
+		dynamicInformerFactory: dynamicInformerFactory,
+		stopCh:                 make(chan struct{}),
+	}
+}
+
+func (d *dynamicInformerLister) List(ctx context.Context, gvr schema.GroupVersionResource, namespace string) ([]unstructuredv1.Unstructured, error) {
+	var (
+		objects []runtime.Object
+		err     error
+	)
+
+	lister, exists := d.dynamicLister[g
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller_test.go` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+package recommendation
+
+import (
+	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
+	corev1 "k8s.io/api/core/v1"
+	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"reflect"
+	"testing"
+)
+
+func TestRecommendationIndex_GetRecommendation(t *testing.T) {
+	type fields struct {
+		recommendationList analysisv1alph1.RecommendationList
+	}
+	type args struct {
+		id ObjectIdentity
+	}
+
+	tests := []struct {
+		name   string
+		fields fields
+		args   args
+		want   *analysisv1alph1.Recommendation
+	}{
+		{
+			name: "TestRecommendationIndex_GetRecommendation good case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-bar",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-foo",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+					},
+				},
+			},
+			want: &analysisv1alph1.Recommendation{
+				ObjectMeta: v1.ObjectMeta{
+					Name:      "test-recommendation-rule",
+					Namespace: "test-namespace",
+				},
+				Spec: analysisv1alph1.RecommendationSpec{
+					TargetRef: corev1.ObjectReference{
+						Namespace:  "test-namespace",
+						Kind:       "Deployment",
+						Name:       "test-deployment-name",
+						APIVersion: "app/v1",
+					},
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-name",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resource",
+				},
+			},
+		},
+		{
+			name: "TestRecommendationIndex_GetRecommendation empty case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{},
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-name",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resources",
+				},
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			idx := NewRecommendationIndex(tt.fields.recommendationList)
+			if got := idx.GetRecommendation(tt.args.id); !reflect.DeepEqual(got, tt.want) {
+				t.Errorf("GetRecommendation() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
```

---

### Incident Patch 7: `ed43bd2a` (2024-01-22)
**Commit Message**: Merge pull request #891 from payall4u/bugfix/avoid-panic-with-ext-memory

Fix crane agent panic when handling ext memory pods.

**File**: `pkg/ensurance/collector/cadvisor/cadvisor_linux.go` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ func (c *CadvisorCollector) Collect() (map[string][]common.TimeSeries, error) {
 				continue
 			}
 
-			if hasExtMemRes {
+			if hasExtMemRes && v.Stats[0].Memory != nil {
 				extResMemUse += float64(v.Stats[0].Memory.WorkingSet)
 			}
 
```

---

### Incident Patch 8: `ea200862` (2024-01-20)
**Commit Message**: Fix crane agent panic when pod use ext memory

Signed-off-by: payall4u <payall4u@qq.com>

**File**: `pkg/ensurance/collector/cadvisor/cadvisor_linux.go` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ func (c *CadvisorCollector) Collect() (map[string][]common.TimeSeries, error) {
 				continue
 			}
 
-			if hasExtMemRes {
+			if hasExtMemRes && v.Stats[0].Memory != nil {
 				extResMemUse += float64(v.Stats[0].Memory.WorkingSet)
 			}
 
```

---

### Incident Patch 9: `5c180262` (2024-01-18)
**Commit Message**: Merge pull request #888 from pmsl/bugfix/craned-rbac

change update workload to update workload status

**File**: `deploy/craned/rbac.yaml` (modified, +10/-1)
```diff
@@ -72,7 +72,16 @@ rules:
   - get
   - list
   - watch
-  - update
+- apiGroups:
+    - apps
+  resources:
+    - daemonsets/status
+    - deployments/status
+    - deployments/scale
+    - statefulsets/status
+    - statefulsets/scale
+  verbs:
+    - update
 - apiGroups:
   - autoscaling
   resources:
```

**File**: `pkg/controller/recommendation/updater.go` (modified, +2/-1)
```diff
@@ -99,7 +99,8 @@ func (c *RecommendationController) UpdateRecommendation(ctx context.Context, rec
 
 		if needUpdate {
 			unstructed.SetAnnotations(annotation)
-			err = c.Client.Update(ctx, unstructed)
+			//Convergence craned permissions
+			err = c.Client.Status().Update(ctx, unstructed)
 			if err != nil {
 				return false, fmt.Errorf("update target annotation failed: %v. ", err)
 			}
```

---

### Incident Patch 10: `832e1bc4` (2024-01-01)
**Commit Message**: fix oom record sort

**File**: `pkg/oom/recorder.go` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ func (r *PodOOMRecorder) cleanOOMRecords(oomRecords []OOMRecord) []OOMRecord {
 			return records[i].OOMAt.Before(records[j].OOMAt)
 		})
 
-		records = records[0:r.OOMRecordMaxNumber]
+		records = records[len(oomRecords)-r.OOMRecordMaxNumber : len(oomRecords)]
 		oomRecords = records
 	}
 
```

#### Recent Merged Pull Requests:
- **PR #932** (closed): feat: add carbon grid api, add automatic apply and make UI changes (@ekaterina-despotova)
- **PR #928** (closed): Update main.go (@barakhari25outlook)
- **PR #915** (2024-12-20): fix the issue that trigger recommendation by run number abormal (@Cloudzp)
- **PR #911** (closed): Update .golangci.yaml (@Cloudzp)
- **PR #909** (closed): Cherrypick to support v1.26+ (@Cloudzp)
- **PR #908** (closed): Cherrypick to k8s 1.26 (@Cloudzp)
- **PR #902** (2024-06-04): fix: close SeedFile (@testwill)
- **PR #900** (2024-04-17):  fix issues #898  (@Cloudzp)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
