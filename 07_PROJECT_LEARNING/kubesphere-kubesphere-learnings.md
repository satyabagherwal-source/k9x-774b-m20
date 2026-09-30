# Forensic Learning Record (Deep Inspection): kubesphere/kubesphere

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubesphere-kubesphere-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubesphere/kubesphere](https://github.com/kubesphere/kubesphere))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:19.896Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubesphere/kubesphere`
- **Description**: The container platform tailored for Kubernetes multi-cloud, datacenter, and edge management ⎈ 🖥 ☁️
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 17059 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/ks-apiserver/apiserver.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package main

import (
	"os"

	"k8s.io/component-base/cli"

	"kubesphere.io/kubesphere/cmd/ks-apiserver/app"
)

func main() {
	cmd := app.NewAPIServerCommand()
	code := cli.Run(cmd)
	os.Exit(code)
}

```

### Core Architecture Module: `cmd/ks-apiserver/app/options/options.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package options

import (
	"crypto/tls"
	"flag"
	"fmt"
	"net/http"
	"strings"

	"github.com/Masterminds/semver/v3"
	"golang.org/x/net/context"
	corev1 "k8s.io/api/core/v1"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/cluster"

	"kubesphere.io/kubesphere/pkg/apiserver"
	"kubesphere.io/kubesphere/pkg/apiserver/authentication/identityprovider"
	"kubesphere.io/kubesphere/pkg/apiserver/options"
	"kubesphere.io/kubesphere/pkg/config"
	"kubesphere.io/kubesphere/pkg/models/auth"
	"kubesphere.io/kubesphere/pkg/models/registries/imagesearch"
	resourcev1beta1 "kubesphere.io/kubesphere/pkg/models/resources/v1beta1"
	"kubesphere.io/kubesphere/pkg/scheme"
	genericoptions "kubesphere.io/kubesphere/pkg/server/options"
	"kubesphere.io/kubesphere/pkg/simple/client/cache"
	"kubesphere.io/kubesphere/pkg/simple/client/k8s"
	"kubesphere.io/kubesphere/pkg/utils/clusterclient"
)

type APIServerOptions struct {
	options.Options
	GenericServerRunOptions *genericoptions.ServerRunOptions
	ConfigFile              string
	DebugMode               bool
}

func NewAPIServerOptions() *APIServerOptions {
	return &APIServerOptions{
		GenericServerRunOptions: genericoptions.NewServerRunOptions(),
	}
}

func (s *APIServerOptions) Flags() (fss cliflag.NamedFlagSets) {
	fs := fss.FlagSet("generic")
	fs.BoolVar(&s.DebugMode, "debug", false, "Don't enable this if you don't know what it means.")
	s.GenericServerRunOptions.AddFlags(fs, s.GenericServerRunOptions)
	s.KubernetesOptions.AddFlags(fss.FlagSet("kubernetes"), s.KubernetesOptions)
	s.AuthenticationOptions.AddFlags(fss.FlagSet("authentication"), s.AuthenticationOptions)
	s.AuthorizationOptions.AddFlags(fss.FlagSet("authorization"), s.AuthorizationOptions)
	s.MultiClusterOptions.AddFlags(fss.FlagSet("multicluster"), s.MultiClusterOptions)
	s.AuditingOptions.AddFlags(fss.FlagSet("auditing"), s.AuditingOptions)

	fs = fss.FlagSet("klog")
	local := flag.NewFlagSet("klog", flag.ExitOnError)
	klog.InitFlags(local)
	local.VisitAll(func(fl *flag.Flag) {
		fl.Name = strings.Replace(fl.Name, "_", "-", -1)
		fs.AddGoFlag(fl)
	})

	return fss
}

// NewAPIServer creates an APIServer instance using given options
func (s *APIServerOptions) NewAPIServer(ctx context.Context) (*apiserver.APIServer, error) {
	apiServer := &apiserver.APIServer{
		Options: s.Options,
	}

	ctrl.SetLogger(klog.NewKlogr())

	var err error
	if apiServer.K8sClient, err = k8s.NewKubernetesClient(s.KubernetesOptions); err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client, error: %v", err)
	}

	if apiServer.CacheClient, err = cache.New(s.CacheOptions, ctx.Done()); err != nil {
		return nil, fmt.Errorf("failed to create cache, error: %v", err)
	}

	if c, err := cluster.New(apiServer.K8sClient.Config(), func(options *cluster.Options) {
		options.Scheme = scheme.Scheme
	}); err != nil {
		return nil, fmt.Errorf("unable to create controller runtime cluster: %v", err)
	} else {
		apiServer.RuntimeCache = c.GetCache()
		key := "involvedObject.name"
		indexerFunc := func(obj client.Object) []string {
			e := obj.(*corev1.Event)
			return []string{e.InvolvedObject.Name}
		}
		if err = apiServer.RuntimeCache.IndexField(ctx, &corev1.Event{}, key, indexerFunc); err != nil {
			klog.Fatalf("unable to create index field: %v", err)
		}
		apiServer.RuntimeClient = c.GetClient()
	}

	apiServer.ResourceManager, err = resourcev1beta1.New(ctx, apiServer.RuntimeClient, apiServer.RuntimeCache)
	if err != nil {
		return nil, fmt.Errorf("unable to create resource manager: %v", err)
	}

	if err := identityprovider.SharedIdentityProviderController.WatchConfigurationChanges(ctx, apiServer.RuntimeCache); err != nil {
		return nil, fmt.Errorf("unable to setup identity provider: %v", err)
	}

	if err := imagesearch.SharedImageSearchProviderController.WatchConfigurationChanges(ctx, apiServer.RuntimeCache); err != nil {
		return nil, fmt.Errorf("unable to setup image search provider: %v", err)
	}

	if apiServer.ClusterClient, err = clusterclient.NewClusterClientSet(apiServer.RuntimeCache); err != nil {
		return nil, fmt.Errorf("unable to create cluster client: %v", err)
	}

	if apiServer.TokenOperator, err = auth.NewTokenOperator(apiServer.CacheClient, s.Options.AuthenticationOptions); err != nil {
		return nil, fmt.Errorf("unable to create issuer: %v", err)
	}

	k8sVersionInfo, err := apiServer.K8sClient.Discovery().ServerVersion()
	if err != nil {
		return nil, fmt.Errorf("unable to fetch k8s version info: %v", err)
	}
	k8sVersion, err := semver.NewVersion(k8sVersionInfo.GitVersion)
	if err != nil {
		return nil, err
	}

	apiServer.K8sVersionInfo = k8sVersionInfo
	apiServer.K8sVersion = k8sVersion

	server := &http.Server{
		Addr: fmt.Sprintf(":%d", s.GenericServerRunOptions.InsecurePort),
	}

	if s.GenericServerRunOptions.SecurePort != 0 {
		certificate, err := tls.LoadX509KeyPair(s.GenericServerRunOptions.TlsCertFile, s.GenericServerRunOptions.TlsPrivateKey)
		if err != nil {
			return nil, err
		}
		server.TLSConfig = &tls.Config{
			Certificates: []tls.Certificate{certificate},
		}
		server.Addr = fmt.Sprintf(":%d", s.GenericServerRunOptions.SecurePort)
	}

	apiServer.Server = server

	return apiServer, nil
}

func (s *APIServerOptions) Merge(conf *config.Config) {
	if conf == nil {
		return
	}
	if conf.KubernetesOptions != nil {
		s.KubernetesOptions = conf.KubernetesOptions
	}
	if conf.CacheOptions != nil {
		s.CacheOptions = conf.CacheOptions
	}
	if conf.AuthenticationOptions != nil {
		s.AuthenticationOptions = conf.AuthenticationOptions
	}
	if conf.AuthorizationOptions != nil {
		s.AuthorizationOptions = conf.AuthorizationOptions
	}
	if conf.MultiClusterOptions != nil {
		s.MultiClusterOptions = conf.MultiClusterOptions
	}
	if conf.AuditingOptions != nil {
		s.AuditingOptions = conf.AuditingOptions
	}
	if conf.TerminalOptions != nil {
		s.TerminalOptions = conf.TerminalOptions
	}
	if conf.S3Options != nil {
		s.S3Options = conf.S3Options
	}
	if conf.ExperimentalOptions != nil {
		s.ExperimentalOptions = conf.ExperimentalOptions
	}
}

```

### Core Architecture Module: `cmd/ks-apiserver/app/options/validation.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package options

// Validate validates server run options, to find
// options' misconfiguration
func (s *APIServerOptions) Validate() []error {
	var errors []error
	errors = append(errors, s.GenericServerRunOptions.Validate()...)
	errors = append(errors, s.KubernetesOptions.Validate()...)
	errors = append(errors, s.AuthenticationOptions.Validate()...)
	errors = append(errors, s.AuthorizationOptions.Validate()...)
	errors = append(errors, s.AuditingOptions.Validate()...)
	return errors
}

```

### Core Architecture Module: `cmd/ks-apiserver/app/server.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/google/gops/agent"
	"github.com/spf13/cobra"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"

	"kubesphere.io/kubesphere/cmd/ks-apiserver/app/options"
	"kubesphere.io/kubesphere/pkg/config"
	"kubesphere.io/kubesphere/pkg/constants"
	"kubesphere.io/kubesphere/pkg/utils/term"
	"kubesphere.io/kubesphere/pkg/version"
)

func NewAPIServerCommand() *cobra.Command {
	s := options.NewAPIServerOptions()
	if conf, err := config.TryLoadFromDisk(); err == nil {
		s.Merge(conf)
	} else {
		klog.Fatalf("Failed to load configuration from disk: %v", err)
	}

	cmd := &cobra.Command{
		Use: constants.KubeSphereAPIServerName,
		Long: `The KubeSphere API server validates and configures data for the API objects. 
The API Server services REST operations and provides the frontend to the
cluster's shared state through which all other components interact.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if errs := s.Validate(); len(errs) != 0 {
				return utilerrors.NewAggregate(errs)
			}

			if s.DebugMode {
				// Add agent to report additional information such as the current stack trace, Go version, memory stats, etc.
				// Bind to a random port on address 127.0.0.1.
				if err := agent.Listen(agent.Options{}); err != nil {
					klog.Fatalln(err)
				}
			}

			return Run(signals.SetupSignalHandler(), s)
		},
		SilenceUsage: true,
	}

	fs := cmd.Flags()
	namedFlagSets := s.Flags()
	for _, f := range namedFlagSets.FlagSets {
		fs.AddFlagSet(f)
	}

	usageFmt := "Usage:\n  %s\n"
	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	cmd.SetHelpFunc(func(cmd *cobra.Command, args []string) {
		_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s\n\n"+usageFmt, cmd.Long, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStdout(), namedFlagSets, cols)
	})

	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print the version of KubeSphere ks-apiserver",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Println(version.Get())
		},
	}

	cmd.AddCommand(versionCmd)
	return cmd
}

func Run(ctx context.Context, s *options.APIServerOptions) error {
	apiServer, err := s.NewAPIServer(ctx)
	if err != nil {
		return err
	}

	if err = apiServer.PrepareRun(ctx.Done()); err != nil {
		return err
	}

	if errors.Is(apiServer.Run(ctx), http.ErrServerClosed) {
		return nil
	}
	return err
}

```

### Core Architecture Module: `cmd/ks-controller-manager/app/options/options.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package options

import (
	"flag"
	"fmt"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/tools/leaderelection"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	"kubesphere.io/kubesphere/pkg/config"
	"kubesphere.io/kubesphere/pkg/controller"
	"kubesphere.io/kubesphere/pkg/controller/options"
	"kubesphere.io/kubesphere/pkg/scheme"
	"kubesphere.io/kubesphere/pkg/simple/client/k8s"
	"kubesphere.io/kubesphere/pkg/utils/clusterclient"
)

type ControllerManagerOptions struct {
	options.Options
	LeaderElect    bool
	LeaderElection *leaderelection.LeaderElectionConfig
	WebhookCertDir string
	// ControllerGates is the list of controller gates to enable or disable controller.
	// '*' means "all enabled by default controllers"
	// 'foo' means "enable 'foo'"
	// '-foo' means "disable 'foo'"
	// first item for a particular name wins.
	//     e.g. '-foo,foo' means "disable foo", 'foo,-foo' means "enable foo"
	// * has the lowest priority.
	//     e.g. *,-foo, means "disable 'foo'"
	ControllerGates []string

	DebugMode bool
}

func NewControllerManagerOptions() *ControllerManagerOptions {
	return &ControllerManagerOptions{
		LeaderElection: &leaderelection.LeaderElectionConfig{
			LeaseDuration: 30 * time.Second,
			RenewDeadline: 15 * time.Second,
			RetryPeriod:   5 * time.Second,
		},
		LeaderElect:     false,
		WebhookCertDir:  "",
		ControllerGates: []string{"*"},
	}
}

func (s *ControllerManagerOptions) Flags() cliflag.NamedFlagSets {
	fss := cliflag.NamedFlagSets{}

	s.KubernetesOptions.AddFlags(fss.FlagSet("kubernetes"), s.KubernetesOptions)
	s.AuthenticationOptions.AddFlags(fss.FlagSet("authentication"), s.AuthenticationOptions)
	s.MultiClusterOptions.AddFlags(fss.FlagSet("multicluster"), s.MultiClusterOptions)
	fs := fss.FlagSet("leaderelection")
	s.bindLeaderElectionFlags(s.LeaderElection, fs)

	fs.BoolVar(&s.LeaderElect, "leader-elect", s.LeaderElect, ""+
		"Whether to enable leader election. This field should be enabled when controller manager"+
		"deployed with multiple replicas.")

	fs.StringVar(&s.WebhookCertDir, "webhook-cert-dir", s.WebhookCertDir, ""+
		"Certificate directory used to setup webhooks, need tls.crt and tls.key placed inside."+
		"if not set, webhook server would look up the server key and certificate in"+
		"{TempDir}/k8s-webhook-server/serving-certs")

	gfs := fss.FlagSet("generic")
	gfs.StringSliceVar(&s.ControllerGates, "controllers", []string{"*"}, fmt.Sprintf(""+
		"A list of controllers to enable. '*' enables all on-by-default controllers, 'foo' enables the controller "+
		"named 'foo', '-foo' disables the controller named 'foo'.\nAll controllers: %s",
		strings.Join(controller.Controllers.Keys(), ", ")))

	gfs.BoolVar(&s.DebugMode, "debug", false, "Don't enable this if you don't know what it means.")

	kfs := fss.FlagSet("klog")
	local := flag.NewFlagSet("klog", flag.ExitOnError)
	klog.InitFlags(local)
	local.VisitAll(func(fl *flag.Flag) {
		fl.Name = strings.Replace(fl.Name, "_", "-", -1)
		kfs.AddGoFlag(fl)
	})

	return fss
}

// Validate Options and Genetic Options
func (s *ControllerManagerOptions) Validate() []error {
	var errs []error
	errs = append(errs, s.KubernetesOptions.Validate()...)
	errs = append(errs, s.MultiClusterOptions.Validate()...)
	errs = append(errs, s.ComposedAppOptions.Validate()...)

	// genetic option: controllers, check all selectors are valid
	allControllersNameSet := sets.KeySet(controller.Controllers)
	for _, selector := range s.ControllerGates {
		if selector == "*" {
			continue
		}
		selector = strings.TrimPrefix(selector, "-")
		if !allControllersNameSet.Has(selector) {
			errs = append(errs, fmt.Errorf("%q is not in the list of known controllers", selector))
		}
	}
	return errs
}

func (s *ControllerManagerOptions) bindLeaderElectionFlags(l *leaderelection.LeaderElectionConfig, fs *pflag.FlagSet) {
	fs.DurationVar(&l.LeaseDuration, "leader-elect-lease-duration", l.LeaseDuration, ""+
		"The duration that non-leader candidates will wait after observing a leadership "+
		"renewal until attempting to acquire leadership of a led but unrenewed leader "+
		"slot. This is effectively the maximum duration that a leader can be stopped "+
		"before it is replaced by another candidate. This is only applicable if leader "+
		"election is enabled.")
	fs.DurationVar(&l.RenewDeadline, "leader-elect-renew-deadline", l.RenewDeadline, ""+
		"The interval between attempts by the acting master to renew a leadership slot "+
		"before it stops leading. This must be less than or equal to the lease duration. "+
		"This is only applicable if leader election is enabled.")
	fs.DurationVar(&l.RetryPeriod, "leader-elect-retry-period", l.RetryPeriod, ""+
		"The duration the clients should wait between attempting acquisition and renewal "+
		"of a leadership. This is only applicable if leader election is enabled.")
}

// Merge new config without validation
// When misconfigured, the app should just crash directly
func (s *ControllerManagerOptions) Merge(conf *config.Config) {
	if conf == nil {
		return
	}
	if conf.KubernetesOptions != nil {
		s.KubernetesOptions = conf.KubernetesOptions
	}
	if conf.AuthenticationOptions != nil {
		s.AuthenticationOptions = conf.AuthenticationOptions
	}
	if conf.MultiClusterOptions != nil {
		s.MultiClusterOptions = conf.MultiClusterOptions
	}
	if conf.TerminalOptions != nil {
		s.TerminalOptions = conf.TerminalOptions
	}
	if conf.KubeconfigOptions != nil {
		s.KubeconfigOptions = conf.KubeconfigOptions
	}
	if conf.HelmExecutorOptions != nil {
		s.HelmExecutorOptions = conf.HelmExecutorOptions
	}
	if conf.ExtensionOptions != nil {
		s.ExtensionOptions = conf.ExtensionOptions
	}
	if conf.KubeSphereOptions != nil {
		s.KubeSphereOptions = conf.KubeSphereOptions
	}
	if conf.ComposedAppOptions != nil {
		s.ComposedAppOptions = conf.ComposedAppOptions
	}
	if conf.S3Options != nil {
		s.S3Options = conf.S3Options
	}
}

func (s *ControllerManagerOptions) NewControllerManager() (*controller.Manager, error) {
	cm := &controller.Manager{}

	webhookServer := webhook.NewServer(webhook.Options{
		CertDir: s.WebhookCertDir,
		Port:    8443,
	})

	cmOptions := manager.Options{
		Scheme:        scheme.Scheme,
		WebhookServer: webhookServer,
	}

	if s.LeaderElect {
		cmOptions = manager.Options{
			Scheme:                  scheme.Scheme,
			WebhookServer:           webhookServer,
			LeaderElection:          s.LeaderElect,
			LeaderElectionNamespace: "kubesphere-system",
			LeaderElectionID:        "ks-controller-manager-leader-election",
			LeaseDuration:           &s.LeaderElection.LeaseDuration,
			RetryPeriod:             &s.LeaderElection.RetryPeriod,
			RenewDeadline:           &s.LeaderElection.RenewDeadline,
		}
	}

	k8sClient, err := k8s.NewKubernetesClient(s.KubernetesOptions)
	if err != nil {
		return nil, fmt.Errorf("unable to create kubernetes client: %v", err)
	}
	k8sVersionInfo, err := k8sClient.Discovery().ServerVersion()
	if err != nil {
		return nil, fmt.Errorf("unable to fetch k8s version info: %v", err)
	}
	k8sVersion, err := semver.NewVersion(k8sVersionInfo.GitVersion)
	if err != nil {
		return nil, err
	}

	klog.V(0).Info("setting up manager")
	ctrl.SetLogger(klog.NewKlogr())
	// Use 8443 instead of 443 because we need root permission to bind port 443
	mgr, err := manager.New(k8sClient.Config(), cmOptions)
	if err != nil {
		klog.Fatalf("unable to set up overall controller manager: %v", err)
	}

	clusterClient, err := clusterclient.NewClusterClientSet(mgr.GetCache())
	if err != nil {
		return nil, fmt.Errorf("unable to create cluster client: %v", err)
	}

	cm.K8sClient =
```

### Core Architecture Module: `cmd/ks-controller-manager/app/server.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package app

import (
	"context"
	"fmt"

	"github.com/google/gops/agent"
	"github.com/spf13/cobra"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	"k8s.io/apimachinery/pkg/util/runtime"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/manager/signals"

	"kubesphere.io/kubesphere/cmd/ks-controller-manager/app/options"
	"kubesphere.io/kubesphere/pkg/config"
	"kubesphere.io/kubesphere/pkg/controller"
	"kubesphere.io/kubesphere/pkg/controller/application"
	"kubesphere.io/kubesphere/pkg/controller/certificatesigningrequest"
	"kubesphere.io/kubesphere/pkg/controller/cluster"
	"kubesphere.io/kubesphere/pkg/controller/clusterlabel"
	"kubesphere.io/kubesphere/pkg/controller/clusterrole"
	"kubesphere.io/kubesphere/pkg/controller/clusterrolebinding"
	ksconfig "kubesphere.io/kubesphere/pkg/controller/config"
	"kubesphere.io/kubesphere/pkg/controller/conversion"
	"kubesphere.io/kubesphere/pkg/controller/core"
	"kubesphere.io/kubesphere/pkg/controller/extension"
	"kubesphere.io/kubesphere/pkg/controller/globalrole"
	"kubesphere.io/kubesphere/pkg/controller/globalrolebinding"
	"kubesphere.io/kubesphere/pkg/controller/job"
	"kubesphere.io/kubesphere/pkg/controller/k8sapplication"
	"kubesphere.io/kubesphere/pkg/controller/ksserviceaccount"
	"kubesphere.io/kubesphere/pkg/controller/kubeconfig"
	"kubesphere.io/kubesphere/pkg/controller/kubectl"
	"kubesphere.io/kubesphere/pkg/controller/loginrecord"
	"kubesphere.io/kubesphere/pkg/controller/namespace"
	"kubesphere.io/kubesphere/pkg/controller/quota"
	"kubesphere.io/kubesphere/pkg/controller/resourceprotection"
	"kubesphere.io/kubesphere/pkg/controller/role"
	"kubesphere.io/kubesphere/pkg/controller/rolebinding"
	"kubesphere.io/kubesphere/pkg/controller/roletemplate"
	"kubesphere.io/kubesphere/pkg/controller/secret"
	"kubesphere.io/kubesphere/pkg/controller/serviceaccount"
	"kubesphere.io/kubesphere/pkg/controller/serviceaccounttoken"
	"kubesphere.io/kubesphere/pkg/controller/storageclass"
	"kubesphere.io/kubesphere/pkg/controller/telemetry"
	"kubesphere.io/kubesphere/pkg/controller/user"
	"kubesphere.io/kubesphere/pkg/controller/workspace"
	"kubesphere.io/kubesphere/pkg/controller/workspacerole"
	"kubesphere.io/kubesphere/pkg/controller/workspacerolebinding"
	"kubesphere.io/kubesphere/pkg/controller/workspacetemplate"
	"kubesphere.io/kubesphere/pkg/utils/term"
	"kubesphere.io/kubesphere/pkg/version"
)

func init() {
	// core
	runtime.Must(controller.Register(&core.ExtensionReconciler{}))
	runtime.Must(controller.Register(&core.ExtensionVersionReconciler{}))
	runtime.Must(controller.Register(&core.CategoryReconciler{}))
	runtime.Must(controller.Register(&core.RepositoryReconciler{}))
	runtime.Must(controller.Register(&core.InstallPlanReconciler{}))
	runtime.Must(controller.Register(&core.InstallPlanWebhook{}))
	// extension
	runtime.Must(controller.Register(&extension.JSBundleWebhook{}))
	runtime.Must(controller.Register(&extension.APIServiceWebhook{}))
	runtime.Must(controller.Register(&extension.ReverseProxyWebhook{}))
	runtime.Must(controller.Register(&extension.ExtensionEntryWebhook{}))
	// rbac
	runtime.Must(controller.Register(&globalrole.Reconciler{}))
	runtime.Must(controller.Register(&globalrolebinding.Reconciler{}))
	runtime.Must(controller.Register(&workspacerole.Reconciler{}))
	runtime.Must(controller.Register(&workspacerolebinding.Reconciler{}))
	runtime.Must(controller.Register(&clusterrole.Reconciler{}))
	runtime.Must(controller.Register(&clusterrolebinding.Reconciler{}))
	runtime.Must(controller.Register(&role.Reconciler{}))
	runtime.Must(controller.Register(&rolebinding.Reconciler{}))
	runtime.Must(controller.Register(&roletemplate.Reconciler{}))
	runtime.Must(controller.Register(&namespace.Reconciler{}))
	// user management
	runtime.Must(controller.Register(&user.Reconciler{}))
	runtime.Must(controller.Register(&user.Webhook{}))
	runtime.Must(controller.Register(&loginrecord.Reconciler{}))
	// multi cluster
	runtime.Must(controller.Register(&cluster.Reconciler{}))
	runtime.Must(controller.Register(&cluster.Webhook{}))
	runtime.Must(controller.Register(&clusterlabel.Reconciler{}))
	// multi tenancy
	runtime.Must(controller.Register(&workspace.Reconciler{}))
	runtime.Must(controller.Register(&workspacetemplate.Reconciler{}))
	// kubesphere service account
	runtime.Must(controller.Register(&ksserviceaccount.Reconciler{}))
	runtime.Must(controller.Register(&ksserviceaccount.Webhook{}))
	runtime.Must(controller.Register(&secret.ServiceAccountSecretReconciler{}))
	// additional capabilities
	runtime.Must(controller.Register(&serviceaccount.Reconciler{}))
	runtime.Must(controller.Register(&job.Reconciler{}))
	runtime.Must(controller.Register(&storageclass.Reconciler{}))
	runtime.Must(controller.Register(&telemetry.Reconciler{}))
	runtime.Must(controller.Register(&ksconfig.Webhook{}))
	runtime.Must(controller.Register(&conversion.Webhook{}))
	// kubeconfig
	runtime.Must(controller.Register(&kubeconfig.Reconciler{}))
	runtime.Must(controller.Register(&certificatesigningrequest.Reconciler{}))
	// resource quota
	runtime.Must(controller.Register(&quota.Reconciler{}))
	runtime.Must(controller.Register(&quota.Webhook{}))
	// app store
	runtime.Must(controller.Register(&application.AppReleaseReconciler{}))
	runtime.Must(controller.Register(&application.RepoReconciler{}))
	runtime.Must(controller.Register(&application.AppCategoryReconciler{}))
	runtime.Must(controller.Register(&application.AppVersionReconciler{}))
	// k8s application
	runtime.Must(controller.Register(&k8sapplication.Reconciler{}))
	runtime.Must(controller.Register(&application.ReleaseWebhook{}))
	// kubectl
	runtime.Must(controller.Register(&kubectl.Reconciler{}))
	runtime.Must(controller.Register(&serviceaccounttoken.Reconciler{}))
	runtime.Must(controller.Register(&resourceprotection.Webhook{}))
}

func NewControllerManagerCommand() *cobra.Command {
	s := options.NewControllerManagerOptions()
	if conf, err := config.TryLoadFromDisk(); err == nil {
		s.Merge(conf)
	} else {
		klog.Fatalf("Failed to load configuration from disk: %v", err)
	}

	cmd := &cobra.Command{
		Use:  "controller-manager",
		Long: `KubeSphere controller manager is a daemon that embeds the control loops shipped with KubeSphere.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if errs := s.Validate(); len(errs) != 0 {
				return utilerrors.NewAggregate(errs)
			}
			if s.DebugMode {
				// Add agent to report additional information such as the current stack trace, Go version, memory stats, etc.
				// Bind to a random port on address 127.0.0.1
				if err := agent.Listen(agent.Options{}); err != nil {
					klog.Fatalln(err)
				}
			}
			return Run(signals.SetupSignalHandler(), s)
		},
		SilenceUsage: true,
	}

	namedFlagSets := s.Flags()

	for _, f := range namedFlagSets.FlagSets {
		cmd.Flags().AddFlagSet(f)
	}

	usageFmt := "Usage:\n  %s\n"
	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	cmd.SetHelpFunc(func(cmd *cobra.Command, args []string) {
		_, _ = fmt.Fprintf(cmd.OutOrStdout(), "%s\n\n"+usageFmt, cmd.Long, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStdout(), namedFlagSets, cols)
	})

	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print the version of KubeSphere controller-manager",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Println(version.Get())
		},
	}

	cmd.AddCommand(versionCmd)
	return cmd
}

func Run(ctx context.Context, s *options.ControllerManagerOptions) error {
	cm, err := s.NewControllerManager()
	if err != nil {
		return fmt.Errorf("failed to create controller manager: %v", err)
	}
	if err := cm.Run(ctx, controller.Controllers); err != nil {
		return fmt.Errorf("failed to run controller manager: %v", err)
	}
	return nil
}

```

### Core Architecture Module: `cmd/ks-controller-manager/controller-manager.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package main

import (
	"os"

	"k8s.io/component-base/cli"

	"kubesphere.io/kubesphere/cmd/ks-controller-manager/app"
)

func main() {
	cmd := app.NewControllerManagerCommand()
	code := cli.Run(cmd)
	os.Exit(code)
}

```

### Core Architecture Module: `kube/pkg/apis/core/v1/helper/helpers.go`
```
/*
Copyright 2014 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package helper

import (
	"fmt"
	"strings"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/util/validation"
)

// IsExtendedResourceName returns true if:
// 1. the resource name is not in the default namespace;
// 2. resource name does not have "requests." prefix,
// to avoid confusion with the convention in quota
// 3. it satisfies the rules in IsQualifiedName() after converted into quota resource name
func IsExtendedResourceName(name v1.ResourceName) bool {
	if IsNativeResource(name) || strings.HasPrefix(string(name), v1.DefaultResourceRequestsPrefix) {
		return false
	}
	// Ensure it satisfies the rules in IsQualifiedName() after converted into quota resource name
	nameForQuota := fmt.Sprintf("%s%s", v1.DefaultResourceRequestsPrefix, string(name))
	if errs := validation.IsQualifiedName(string(nameForQuota)); len(errs) != 0 {
		return false
	}
	return true
}

// IsPrefixedNativeResource returns true if the resource name is in the
// *kubernetes.io/ namespace.
func IsPrefixedNativeResource(name v1.ResourceName) bool {
	return strings.Contains(string(name), v1.ResourceDefaultNamespacePrefix)
}

// IsNativeResource returns true if the resource name is in the
// *kubernetes.io/ namespace. Partially-qualified (unprefixed) names are
// implicitly in the kubernetes.io/ namespace.
func IsNativeResource(name v1.ResourceName) bool {
	return !strings.Contains(string(name), "/") ||
		IsPrefixedNativeResource(name)
}

// GetPersistentVolumeClaimClass returns StorageClassName. If no storage class was
// requested, it returns "".
func GetPersistentVolumeClaimClass(claim *v1.PersistentVolumeClaim) string {
	// Use beta annotation first
	if class, found := claim.Annotations[v1.BetaStorageClassAnnotation]; found {
		return class
	}

	if claim.Spec.StorageClassName != nil {
		return *claim.Spec.StorageClassName
	}

	return ""
}

// ScopedResourceSelectorRequirementsAsSelector converts the ScopedResourceSelectorRequirement api type into a struct that implements
// labels.Selector.
func ScopedResourceSelectorRequirementsAsSelector(ssr v1.ScopedResourceSelectorRequirement) (labels.Selector, error) {
	selector := labels.NewSelector()
	var op selection.Operator
	switch ssr.Operator {
	case v1.ScopeSelectorOpIn:
		op = selection.In
	case v1.ScopeSelectorOpNotIn:
		op = selection.NotIn
	case v1.ScopeSelectorOpExists:
		op = selection.Exists
	case v1.ScopeSelectorOpDoesNotExist:
		op = selection.DoesNotExist
	default:
		return nil, fmt.Errorf("%q is not a valid scope selector operator", ssr.Operator)
	}
	r, err := labels.NewRequirement(string(ssr.ScopeName), op, ssr.Values)
	if err != nil {
		return nil, err
	}
	selector = selector.Add(*r)
	return selector, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6657** (2026-09-30): **fix: retry member cluster KS Core install after a failed attempt**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression --> /kind bug  ### What this PR does / why we need it: When adding a member cluster with a custom/private image registry configured, a failed first attempt to install/upgrade the KS Core Helm release in that member cluster permanently stops the host cluster's `cluster` controller from ever retrying, so the member cluster is silently stuck (e.g. still pulling from the default registry) with no future correction.  Root cause: in `reconcileMemberCluster`, `setConfigHash(cluster)` was called unconditionally after every install/upgrade attempt, even when it failed (`status == corev1.ConditionFalse`). `configChanged()` only
  **Post-Mortem & Fix Analysis**:
  > /assign @zheng1  This has been green and waiting a few days — happy to adjust anything that would help review.
  > Closing this to keep my open PR queue manageable - it has been open a while without review, and I would rather not leave stale PRs sitting in your queue. The change itself still applies; happy to reopen and rebase if it is useful to you.

- **Issue #6654** (2026-09-30): **Block SSRF and cross-namespace secret exfiltration in git credential verify**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression --> /kind bug  ### What this PR does / why we need it:  `POST /kapis/resources.kubesphere.io/v1alpha2/git/verify` is reachable by any authenticated user (the built-in `authenticated` GlobalRole grants `create` on `resources.kubesphere.io/git` cluster-wide). The handler passed the caller-supplied `remoteUrl` straight to go-git's `origin.List()`, which makes an outbound HTTP request using ks-apiserver's own network identity and reflected the upstream response body back to the caller in the JSON error message — a server-side request forgery primitive against loopback, link-local (including the `169.254.169.254` cloud met
  **Post-Mortem & Fix Analysis**:
  > /assign @shaowenchen  This has been open a week and is green on CI — would appreciate a look when you have time, since it touches pkg/models/git which you own.
  > Closing this to keep my open PR queue manageable - it has been open a while without review, and I would rather not leave stale PRs sitting in your queue. The change itself still applies; happy to reopen and rebase if it is useful to you.

- **Issue #6652** (2026-08-27): **fix: remove invalid status.lastSyncTime null from extensions-museum Repository manifest**
  *Symptoms*: /kind bug  What this PR does / why we need it:  Motivation: Installing or upgrading ks-core fails with:    Error: UPGRADE FAILED: failed to create resource: Repository.kubesphere.io   "extensions-museum" is invalid: status.lastSyncTime: Invalid value: "null":   status.lastSyncTime in body must be of type string: "null"  This is caused by config/ks-core/templates/extension-museum.yaml rendering the extensions-museum Repository custom resource with an explicit `status: {lastSyncTime: null}` block (added in #6463). The Repository CRD (config/ks-core/charts/ks-crds/crds/kubesphere.io_repositories.yaml) defines `lastSyncTime` as `type: string, format: date-time` without `nullable: true`, and does not declare a status subresource, so the whole object (spec+status) is validated together on create. An explicit YAML/JSON `null` for a non-nullable string field fails Kubernetes' OpenAPI validation, blocking every fresh install and upgrade that renders this template.  Approach: Remove the two lines that hardcode `status.lastSyncTime: null` on the extensions-museum Repository manifest. The field is optional (`LastSyncTime *metav1.Time` with `omitempty` in staging/src/kubesphere.io/api/core/v1alpha1/types.go), and the repository controller already treats a nil/absent LastSyncTime as "never synced yet" (pkg/controller/core/repository_controller.go), populating it itself on first reconcile. Every other place in the codebase that constructs a Repository object (pkg/kapis/package/v1alpha1/hand
  **Post-Mortem & Fix Analysis**:
  > Closing this to keep my open PR queue manageable - it has been open a while without review, and I would rather not leave stale PRs sitting in your queue. The change itself still applies; happy to reopen and rebase if it is useful to you.

- **Issue #6650** (2026-08-12): **Add token-count badge to README**
  *Symptoms*: Hi! This PR adds one line to the README: a badge showing an estimate of how many LLM tokens this repo weighs. Since this project is the kind of thing people load into an LLM's context window, the number seemed genuinely useful to surface.  Preview: ![tokens](https://img.shields.io/endpoint?url=https://gittokens.rsamf.com/badge/kubesphere/kubesphere)  Full disclosure: I built the free, open-source service behind the badge (https://github.com/rsamf/gittokens), and I'm proposing it to a small, hand-picked set of repos where it seems like a good fit. If it isn't a fit here, please just close this, and I won't resubmit.

- **Issue #6647** (2026-07-15): **add kubesphere-gateway and kubesphere-gateway-api skills**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression -->   ### What this PR does / why we need it:  ### Which issue(s) this PR fixes: <!-- Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. _If PR is about `failing-tests or flakes`, please post the related issues/tests in a comment and do not use `Fixes`_* --> Fixes #  ### Special notes for reviewers: ``` ```  ### Does this PR introduced a user-facing change? <!-- If no, just write "None" in the release-note block below. If yes, a release note is required: Enter your extended release note in the block below. If the PR requires additional action from users switchin
  **Post-Mortem & Fix Analysis**:
  > /lgtm

- **Issue #6646** (2026-06-25): **feat: add kubeeye skills**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression --> /kind feature  ### What this PR does / why we need it:  ### Which issue(s) this PR fixes: <!-- Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. _If PR is about `failing-tests or flakes`, please post the related issues/tests in a comment and do not use `Fixes`_* --> Fixes #  ### Special notes for reviewers: ``` ```  ### Does this PR introduced a user-facing change? <!-- If no, just write "None" in the release-note block below. If yes, a release note is required: Enter your extended release note in the block below. If the PR requires additional action from u
  **Post-Mortem & Fix Analysis**:
  > /lgtm

- **Issue #6644** (2026-06-04): **Add openpitrix skill**
  *Symptoms*: ## Summary - Add an OpenPitrix skill covering KubeSphere application management APIs and troubleshooting workflows - Include KSE application.kubesphere.io/v2 examples, legacy OpenPitrix API notes, and eval scenarios  ## Testing - Validated evals.json parses as JSON - Tested skill activation locally via Codex skill symlink before cleanup
  **Post-Mortem & Fix Analysis**:
  > /lgtm

- **Issue #6642** (2026-06-02): **[skills] Merge pull request #60 from kubesphere-extensions/dev**
  *Symptoms*: Source PR: https://github.com/kubesphere-extensions/kube-frontend-forge-controller/pull/60
  **Post-Mortem & Fix Analysis**:
  > /lgtm

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

### Incident Patch 1: `00d94f40` (2026-05-06)
**Commit Message**: Merge pull request #6636 from xiaolai/fix/nlpm-duplicate-section

fix(devops-overview): remove duplicate Project Components ASCII diagram



---

### Incident Patch 2: `8150e6c4` (2026-05-06)
**Commit Message**: Merge pull request #6635 from xiaolai/fix/nlpm-broken-markdown

fix(devops-pipeline): close unclosed bold marker in 'Step 3b' heading



---

### Incident Patch 3: `bdc50fcf` (2026-05-06)
**Commit Message**: Merge pull request #6634 from xiaolai/fix/nlpm-wrong-step-reference

fix(whizard-logging): correct 'From Step 3' placeholder to 'From Step 2'



---

### Incident Patch 4: `b47ecd38` (2026-05-06)
**Commit Message**: Merge pull request #6633 from xiaolai/fix/nlpm-yaml-syntax-error

fix(fluid): close unclosed double-quote in Dataset tieredstore YAML template



---

### Incident Patch 5: `2ae4fc43` (2026-05-06)
**Commit Message**: Merge pull request #6632 from xiaolai/fix/nlpm-wrong-credential-type

fix(devops-credentials): use correct Secret type in credential API examples



---

### Incident Patch 6: `e08088d6` (2026-05-06)
**Commit Message**: Merge pull request #6630 from xiaolai/fix/nlpm-overview-duplicate

fix: remove duplicate Project Components diagram in devops-overview

**File**: `skills/kubesphere-devops-overview/SKILL.md` (modified, +0/-17)
```diff
@@ -107,23 +107,6 @@ EOF
 └──────────────┘ └───────────┘ └─────────────┘
 ```
 
-```
-┌──────────────────────────────────────────────────────────────┐
-│                     DevOps Project                            │
-│  (Namespace with devops.kubesphere.io/managed=true label)    │
-└──────────────────────┬───────────────────────────────────────┘
-                       │
-        ┌──────────────┼──────────────┐
-        │              │              │
-┌───────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
-│  Pipelines   │ │Credentials│ │   Webhooks  │
-│              │ │           │ │             │
-│ - Graphical  │ │ - SSH     │ │ - GitHub    │
-│ - Jenkinsfile│ │ - Basic   │ │ - GitLab    │
-│ - Multi-branch│ │ - Token  │ │ - Generic   │
-└──────────────┘ └───────────┘ └─────────────┘
-```
-
 ## Installation
 
 ### Using InstallPlan (Recommended for Production)
```

---

### Incident Patch 7: `e320666a` (2026-05-06)
**Commit Message**: Merge pull request #6629 from xiaolai/fix/nlpm-pipeline-markdown

fix: close unclosed bold marker in devops-pipeline SKILL.md

**File**: `skills/kubesphere-devops-pipeline/SKILL.md` (modified, +1/-1)
```diff
@@ -320,7 +320,7 @@ spec:
     script_path: go/Jenkinsfile  # Path to Jenkinsfile in repo
 ```
 
-**Step 3b: For Private Repository (with credential):
+**Step 3b: For Private Repository (with credential):**
 ```yaml
 apiVersion: devops.kubesphere.io/v1alpha3
 kind: Pipeline
```

---

### Incident Patch 8: `40fe02a1` (2026-05-06)
**Commit Message**: Merge pull request #6628 from xiaolai/fix/nlpm-logging-step-ref

fix: correct step references in whizard-logging installation guide

**File**: `skills/whizard-logging/SKILL.md` (modified, +2/-2)
```diff
@@ -101,7 +101,7 @@ spec:
 ```
 
 **Replace placeholders:**
-- `<VERSION>`: From Step 3 (e.g., `1.4.0`)
+- `<VERSION>`: From Step 2 (e.g., `1.4.0`)
 - `<TARGET_CLUSTERS>`: User-confirmed cluster names
 
 **Note:** OpenSearch sink configuration (endpoints, auth) is provided by the **vector** extension. Make sure vector is installed and configured with OpenSearch before installing logging.
@@ -118,7 +118,7 @@ metadata:
 spec:
   extension:
     name: whizard-logging
-    version: <VERSION>  # From Step 3
+    version: <VERSION>  # From Step 2
   enabled: true
   upgradeStrategy: Manual
   config: |
```

---

### Incident Patch 9: `4906bf6b` (2026-05-06)
**Commit Message**: Merge pull request #6627 from xiaolai/fix/nlpm-fluid-yaml-syntax

fix: close missing double-quote in fluid Dataset YAML template

**File**: `skills/kubesphere-fluid/SKILL.md` (modified, +1/-1)
```diff
@@ -407,7 +407,7 @@ spec:
         path: {{path}}
         quota: {{quota}}
         high: "{{high}}"
-        low: "{{low}}
+        low: "{{low}}"
 ```
 
 **When user explicitly asks for "Dataset with Runtime", generate both:**
```

---

### Incident Patch 10: `b1b888de` (2026-05-06)
**Commit Message**: Merge pull request #6626 from xiaolai/fix/nlpm-credential-type

fix: correct Secret type in DevOps credential API examples

**File**: `skills/kubesphere-devops-credentials/SKILL.md` (modified, +4/-4)
```diff
@@ -107,7 +107,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
       "username": "git",
       "privatekey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/ssh-auth"
   }'
 ```
 
@@ -130,7 +130,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
       "username": "docker-user",
       "password": "docker-password"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/basic-auth"
   }'
 ```
 
@@ -191,7 +191,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
     "stringData": {
       "secret": "my-api-token-value"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/secret-text"
   }'
 ```
 
@@ -465,7 +465,7 @@ curl -s -X POST "${KUBESPHERE_API}/kapis/devops.kubesphere.io/v1alpha3/namespace
       "username": "git",
       "password": "'${GITHUB_TOKEN}'"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/basic-auth"
   }' | jq -r '.metadata.name'
 
 # 2. Create GitRepository
```

#### Recent Merged Pull Requests:
- **PR #6657** (closed): fix: retry member cluster KS Core install after a failed attempt (@pujitha24)
- **PR #6654** (closed): Block SSRF and cross-namespace secret exfiltration in git credential verify (@pujitha24)
- **PR #6652** (closed): fix: remove invalid status.lastSyncTime null from extensions-museum Repository manifest (@pujitha24)
- **PR #6650** (closed): Add token-count badge to README (@rsamf)
- **PR #6647** (2026-07-15): add kubesphere-gateway and kubesphere-gateway-api skills (@junotx)
- **PR #6646** (2026-06-25): feat: add kubeeye skills (@redscholar)
- **PR #6644** (2026-06-04): Add openpitrix skill (@smartcat999)
- **PR #6642** (2026-06-02): [skills] Merge pull request #60 from kubesphere-extensions/dev (@ks-ci-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
