# Forensic Learning Record (Deep Inspection): openyurtio/openyurt

> **Canonical Artifact**: `07_PROJECT_LEARNING/openyurtio-openyurt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openyurtio/openyurt](https://github.com/openyurtio/openyurt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:20:34.024Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openyurtio/openyurt`
- **Description**: OpenYurt - Extending your native Kubernetes to edge(project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2001 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/yurt-iot-dock/app/core.go`
```
/*
Copyright 2023 The OpenYurt Authors.

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

package app

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	"github.com/openyurtio/openyurt/cmd/yurt-iot-dock/app/options"
	"github.com/openyurtio/openyurt/pkg/apis"
	edgexclients "github.com/openyurtio/openyurt/pkg/yurtiotdock/clients/edgex-foundry"
	"github.com/openyurtio/openyurt/pkg/yurtiotdock/controllers"
	"github.com/openyurtio/openyurt/pkg/yurtiotdock/controllers/util"
)

var (
	scheme   = runtime.NewScheme()
	setupLog = ctrl.Log.WithName("setup")
)

func init() {
	_ = clientgoscheme.AddToScheme(scheme)

	_ = apis.AddToScheme(clientgoscheme.Scheme)
	_ = apis.AddToScheme(scheme)

	// +kubebuilder:scaffold:scheme
}

func NewCmdYurtIoTDock(stopCh <-chan struct{}) *cobra.Command {
	yurtIoTDockOptions := options.NewYurtIoTDockOptions()
	cmd := &cobra.Command{
		Use:   "yurt-iot-dock",
		Short: "Launch yurt-iot-dock",
		Long:  "Launch yurt-iot-dock",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Flags().VisitAll(func(f *pflag.Flag) {
				klog.V(1).Infof("FLAG: --%s=%q", f.Name, f.Value)
			})
			if err := options.ValidateOptions(yurtIoTDockOptions); err != nil {
				klog.Fatalf("validate options: %v", err)
			}
			Run(yurtIoTDockOptions, stopCh)
		},
	}

	opts := zap.Options{
		Development: true,
	}
	opts.BindFlags(flag.CommandLine)
	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))

	yurtIoTDockOptions.AddFlags(cmd.Flags())
	return cmd
}

func Run(opts *options.YurtIoTDockOptions, stopCh <-chan struct{}) {
	cfg := ctrl.GetConfigOrDie()

	metricsServerOpts := metricsserver.Options{
		BindAddress:   opts.MetricsAddr,
		ExtraHandlers: make(map[string]http.Handler, 0),
	}

	mgr, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme:                 scheme,
		Metrics:                metricsServerOpts,
		HealthProbeBindAddress: opts.ProbeAddr,
		LeaderElection:         opts.EnableLeaderElection,
		LeaderElectionID:       "yurt-iot-dock",
	})
	if err != nil {
		setupLog.Error(err, "unable to start manager")
		os.Exit(1)
	}

	// perform preflight check
	setupLog.Info("[preflight] Running pre-flight checks")
	if err := preflightCheck(mgr, opts); err != nil {
		setupLog.Error(err, "could not run pre-flight checks")
		os.Exit(1)
	}

	// register the field indexers
	setupLog.Info("[preflight] Registering the field indexers")
	if err := util.RegisterFieldIndexers(mgr.GetFieldIndexer()); err != nil {
		setupLog.Error(err, "could not register field indexers")
		os.Exit(1)
	}
	// get nodepool where yurt-iot-dock run
	if opts.Nodepool == "" {
		opts.Nodepool, err = util.GetNodePool(mgr.GetConfig())
		if err != nil {
			setupLog.Error(err, "could not get the nodepool where yurt-iot-dock run")
			os.Exit(1)
		}
	}

	edgexdock := edgexclients.NewEdgexDock(opts.Version, opts.CoreMetadataAddr, opts.CoreCommandAddr)

	// setup the DeviceProfile Reconciler and Syncer
	if err = (&controllers.DeviceProfileReconciler{
		Client: mgr.GetClient(),
		Scheme: mgr.GetScheme(),
	}).SetupWithManager(mgr, opts, edgexdock); err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "DeviceProfile")
		os.Exit(1)
	}
	dfs, err := controllers.NewDeviceProfileSyncer(mgr.GetClient(), opts, edgexdock)
	if err != nil {
		setupLog.Error(err, "unable to create syncer", "syncer", "DeviceProfile")
		os.Exit(1)
	}
	err = mgr.Add(dfs.NewDeviceProfileSyncerRunnable())
	if err != nil {
		setupLog.Error(err, "unable to create syncer runnable", "syncer", "DeviceProfile")
		os.Exit(1)
	}

	// setup the Device Reconciler and Syncer
	if err = (&controllers.DeviceReconciler{
		Client: mgr.GetClient(),
		Scheme: mgr.GetScheme(),
	}).SetupWithManager(mgr, opts, edgexdock); err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "Device")
		os.Exit(1)
	}
	ds, err := controllers.NewDeviceSyncer(mgr.GetClient(), opts, edgexdock)
	if err != nil {
		setupLog.Error(err, "unable to create syncer", "controller", "Device")
		os.Exit(1)
	}
	err = mgr.Add(ds.NewDeviceSyncerRunnable())
	if err != nil {
		setupLog.Error(err, "unable to create syncer runnable", "syncer", "Device")
		os.Exit(1)
	}

	// setup the DeviceService Reconciler and Syncer
	if err = (&controllers.DeviceServiceReconciler{
		Client: mgr.GetClient(),
		Scheme: mgr.GetScheme(),
	}).SetupWithManager(mgr, opts, edgexdock); err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "DeviceService")
		os.Exit(1)
	}
	dss, err := controllers.NewDeviceServiceSyncer(mgr.GetClient(), opts, edgexdock)
	if err != nil {
		setupLog.Error(err, "unable to create syncer", "syncer", "DeviceService")
		os.Exit(1)
	}
	err = mgr.Add(dss.NewDeviceServiceSyncerRunnable())
	if err != nil {
		setupLog.Error(err, "unable to create syncer runnable", "syncer", "DeviceService")
		os.Exit(1)
	}
	//+kubebuilder:scaffold:builder

	if err := mgr.AddHealthzCheck("health", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up health check")
		os.Exit(1)
	}
	if err := mgr.AddReadyzCheck("check", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up ready check")
		os.Exit(1)
	}

	setupLog.Info("[run controllers] Starting manager, acting on " + fmt.Sprintf("[NodePool: %s, Namespace: %s]", opts.Nodepool, opts.Namespace))
	if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
		setupLog.Error(err, "could not running manager")
		os.Exit(1)
	}
}

func deleteCRsOnControllerShutdown(ctx context.Context, cli client.Client, opts *options.YurtIoTDockOptions) error {
	setupLog.Info("[deleteCRsOnControllerShutdown] start delete device crd")
	if err := controllers.DeleteDevicesOnControllerShutdown(ctx, cli, opts); err != nil {
		setupLog.Error(err, "could not shutdown device cr")
		return err
	}

	setupLog.Info("[deleteCRsOnControllerShutdown] start delete deviceprofile crd")
	if err := controllers.DeleteDeviceProfilesOnControllerShutdown(ctx, cli, opts); err != nil {
		setupLog.Error(err, "could not shutdown deviceprofile cr")
		return err
	}

	setupLog.Info("[deleteCRsOnControllerShutdown] start delete deviceservice crd")
	if err := controllers.DeleteDeviceServicesOnControllerShutdown(ctx, cli, opts); err != nil {
		setupLog.Error(err, "could not shutdown deviceservice cr")
		return err
	}

	return nil
}

var onlyOneSignalHandler = make(chan struct{})
var shutdownSignals = []os.Signal{syscall.SIGTERM}

func SetupSignalHandler(client client.Client, opts *options.YurtIoTDockOptions) context.Context {
	close(onlyOneSignalHandler) // panics when called twice

	ctx, cancel := context.WithCancel(context.Background())
	setupLog.Info("[SetupSignalHandler] shutdown controller with crd")
	c := make(chan os.Signal, 2)
	signal.Notify(c, shutdownSignals...)
	go func() {
		<-c
		setupLog.Info("[SetupSignalHandler] shutdown signal concur")
		deleteCRsOnControllerShutdown(ctx, client, opts)
		cancel()
		<-c
		os.Exit(1) // second signal. Exit directly.
	}()

	return ctx
}

func preflightCheck(mgr ctrl.Manager, opts *options.YurtIoTDockOptions)
```

### Core Architecture Module: `cmd/yurt-iot-dock/app/options/options.go`
```
/*
Copyright 2023 The OpenYurt Authors.

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

package options

import (
	"fmt"
	"net"

	"github.com/spf13/pflag"
)

// YurtIoTDockOptions is the main settings for the yurt-iot-dock
type YurtIoTDockOptions struct {
	MetricsAddr          string
	ProbeAddr            string
	EnableLeaderElection bool
	Nodepool             string
	Namespace            string
	Version              string
	CoreDataAddr         string
	CoreMetadataAddr     string
	CoreCommandAddr      string
	EdgeSyncPeriod       uint
}

func NewYurtIoTDockOptions() *YurtIoTDockOptions {
	return &YurtIoTDockOptions{
		MetricsAddr:          ":8080",
		ProbeAddr:            ":8080",
		EnableLeaderElection: false,
		Nodepool:             "",
		Namespace:            "default",
		Version:              "",
		CoreDataAddr:         "edgex-core-data:59880",
		CoreMetadataAddr:     "edgex-core-metadata:59881",
		CoreCommandAddr:      "edgex-core-command:59882",
		EdgeSyncPeriod:       5,
	}
}

func ValidateOptions(options *YurtIoTDockOptions) error {
	if err := ValidateEdgePlatformAddress(options); err != nil {
		return err
	}
	return nil
}

func (o *YurtIoTDockOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar(&o.MetricsAddr, "metrics-bind-address", o.MetricsAddr, "The address the metric endpoint binds to.")
	fs.StringVar(&o.ProbeAddr, "health-probe-bind-address", ":8081", "The address the probe endpoint binds to.")
	fs.BoolVar(&o.EnableLeaderElection, "leader-elect", false, "Enable leader election for controller manager. "+"Enabling this will ensure there is only one active controller manager.")
	fs.StringVar(&o.Nodepool, "nodepool", "", "The nodePool deviceController is deployed in.(just for debugging)")
	fs.StringVar(&o.Namespace, "namespace", "default", "The cluster namespace for edge resources synchronization.")
	fs.StringVar(&o.Version, "version", "", "The version of edge resources deployment.")
	fs.StringVar(&o.CoreDataAddr, "core-data-address", "edgex-core-data:59880", "The address of edge core-data service.")
	fs.StringVar(&o.CoreMetadataAddr, "core-metadata-address", "edgex-core-metadata:59881", "The address of edge core-metadata service.")
	fs.StringVar(&o.CoreCommandAddr, "core-command-address", "edgex-core-command:59882", "The address of edge core-command service.")
	fs.UintVar(&o.EdgeSyncPeriod, "edge-sync-period", 5, "The period of the device management platform synchronizing the device status to the cloud.(in seconds,not less than 5 seconds)")
}

func ValidateEdgePlatformAddress(options *YurtIoTDockOptions) error {
	addrs := []string{options.CoreDataAddr, options.CoreMetadataAddr, options.CoreCommandAddr}
	for _, addr := range addrs {
		if addr != "" {
			if _, _, err := net.SplitHostPort(addr); err != nil {
				return fmt.Errorf("invalid address: %s", err)
			}
		}
	}
	return nil
}

```

### Core Architecture Module: `cmd/yurt-iot-dock/yurt-iot-dock.go`
```
/*
Copyright 2023 The OpenYurt Authors.

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

package main

import (
	"flag"

	"k8s.io/apimachinery/pkg/util/wait"
	// Import all Kubernetes client auth plugins (e.g. Azure, GCP, OIDC, etc.)
	// to ensure that exec-entrypoint and run can make use of them.
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
	"k8s.io/klog/v2"

	"github.com/openyurtio/openyurt/cmd/yurt-iot-dock/app"
)

func main() {
	klog.InitFlags(nil)
	defer klog.Flush()

	cmd := app.NewCmdYurtIoTDock(wait.NeverStop)
	cmd.Flags().AddGoFlagSet(flag.CommandLine)
	if err := cmd.Execute(); err != nil {
		panic(err)
	}
}

```

### Core Architecture Module: `cmd/yurt-manager/app/client/client.go`
```
/*
Copyright 2024 The OpenYurt Authors.

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

package app

import (
	"net/http"
	"sync"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/manager"

	"github.com/openyurtio/openyurt/cmd/yurt-manager/app/config"
)

const serviceAccountPrefix = "yurt-manager-"

var clientStore = &struct {
	clientByName map[string]client.Client
	lock         sync.Mutex
}{
	clientByName: make(map[string]client.Client),
	lock:         sync.Mutex{},
}

var configStore = &struct {
	configByName map[string]*rest.Config
	lock         sync.Mutex
	// baseClient is used to get service account token for each controller client
	baseClient *kubernetes.Clientset
}{
	configByName: make(map[string]*rest.Config),
	lock:         sync.Mutex{},
}

func GetConfigByControllerNameOrDie(mgr manager.Manager, controllerName string) *rest.Config {

	namespace := config.WorkingNamespace

	// if controllerName is empty, return the base config of manager
	if controllerName == "" {
		return mgr.GetConfig()
	}

	configStore.lock.Lock()
	defer configStore.lock.Unlock()

	if cfg, ok := configStore.configByName[controllerName]; ok {
		return cfg
	}

	// get base config
	baseCfg := mgr.GetConfig()

	// get base client
	var err error
	if configStore.baseClient == nil {
		configStore.baseClient, err = kubernetes.NewForConfig(baseCfg)
		if err != nil {
			klog.Fatalf("failed to create base client: %v", err)
		}
	}

	// rename cfg user-agent
	cfg := rest.CopyConfig(baseCfg)
	rest.AddUserAgent(cfg, controllerName)

	// clean cert/key info in tls config for ensuring service account will be used.
	cfg.KeyFile = ""
	cfg.CertFile = ""
	cfg.CertData = []byte{}
	cfg.KeyData = []byte{}

	// add controller-specific token wrapper to cfg
	cachedTokenSource := transport.NewCachedTokenSource(&tokenSourceImpl{
		namespace:          namespace,
		serviceAccountName: serviceAccountPrefix + controllerName,
		cli:                *configStore.baseClient,
		expirationSeconds:  defaultExpirationSeconds,
		leewayPercent:      defaultLeewayPercent,
	})

	// Notice: The execution order is the opposite of the display order
	// EmptyIfHasAuthorization -> Reset Authorization -> PostCheck
	cfg.Wrap(CheckAuthorization)
	cfg.Wrap(transport.ResettableTokenSourceWrapTransport(cachedTokenSource))
	cfg.Wrap(EmptyIfHasAuthorization)

	configStore.configByName[controllerName] = cfg
	klog.V(5).Infof("create new client config for controller %s", controllerName)

	return cfg
}

func GetClientByControllerNameOrDie(mgr manager.Manager, controllerName string) client.Client {
	// if controllerName is empty, return the base client of manager
	if controllerName == "" {
		return mgr.GetClient()
	}

	clientStore.lock.Lock()
	defer clientStore.lock.Unlock()

	if cli, ok := clientStore.clientByName[controllerName]; ok {
		return cli
	}

	// construct client options
	clientOptions := client.Options{
		Scheme: mgr.GetScheme(),
		Mapper: mgr.GetRESTMapper(),
		// controller client should get/list unstructured resource from cache instead of kube-apiserver,
		// because only base client has the right privilege to list/watch unstructured resources.
		Cache: &client.CacheOptions{
			Unstructured: true,
			Reader:       mgr.GetCache(),
		},
	}

	cfg := GetConfigByControllerNameOrDie(mgr, controllerName)
	cli, err := client.New(cfg, clientOptions)
	if err != nil {
		panic(err)
	}
	clientStore.clientByName[controllerName] = cli

	return cli
}

func EmptyIfHasAuthorization(rt http.RoundTripper) http.RoundTripper {
	return TokenResetter{
		defaultRT: rt,
	}
}

type TokenResetter struct {
	defaultRT http.RoundTripper
}

func (tr TokenResetter) RoundTrip(req *http.Request) (*http.Response, error) {
	if len(req.Header.Get("Authorization")) > 0 {
		klog.V(5).Info("[before] check request credential: already set, reset it")
		req.Header.Set("Authorization", "")
	}
	return tr.defaultRT.RoundTrip(req)
}

func CheckAuthorization(rt http.RoundTripper) http.RoundTripper {
	return RequestInspector{
		defaultRT: rt,
	}
}

type RequestInspector struct {
	defaultRT http.RoundTripper
}

func (r RequestInspector) RoundTrip(req *http.Request) (*http.Response, error) {
	if len(req.Header.Get("Authorization")) > 0 {
		klog.V(5).Infof("[after] check request credential: %s", req.Header.Get("Authorization"))
	}
	return r.defaultRT.RoundTrip(req)
}

```

### Core Architecture Module: `cmd/yurt-manager/app/client/token.go`
```
/*
Copyright 2024 The OpenYurt Authors.
Copyright 2018 The Kubernetes Authors.

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
package app

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/oauth2"
	v1authenticationapi "k8s.io/api/authentication/v1"
	v1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
	utilpointer "k8s.io/utils/ptr"
)

var (
	// defaultExpirationSeconds defines the duration of a TokenRequest in seconds.
	defaultExpirationSeconds = int64(3600)
	// defaultLeewayPercent defines the percentage of expiration left before the client trigger a token rotation.
	// range[0, 100]
	defaultLeewayPercent = 20
)

// migrate from kubernetes/staging/src/k8s.io/controller-manager/pkg/clientbuilder/client_builder_dynamic.go
type tokenSourceImpl struct {
	namespace          string
	serviceAccountName string
	cli                kubernetes.Clientset
	expirationSeconds  int64
	leewayPercent      int
}

func (ts *tokenSourceImpl) Token() (*oauth2.Token, error) {
	klog.V(5).Info("start get token")
	var retTokenRequest *v1authenticationapi.TokenRequest

	backoff := wait.Backoff{
		Duration: 500 * time.Millisecond,
		Factor:   2, // double the timeout for every failure
		Steps:    4,
	}
	if err := wait.ExponentialBackoff(backoff, func() (bool, error) {
		_, inErr := getOrCreateServiceAccount(ts.cli, ts.namespace, ts.serviceAccountName)
		if inErr != nil {
			klog.Warningf("get or create service account failed: %v", inErr)
			return false, nil
		}
		klog.V(5).Infof("get serviceaccount %s successfully", ts.serviceAccountName)

		tr, inErr := ts.cli.CoreV1().ServiceAccounts(ts.namespace).CreateToken(context.TODO(), ts.serviceAccountName, &v1authenticationapi.TokenRequest{
			Spec: v1authenticationapi.TokenRequestSpec{
				ExpirationSeconds: utilpointer.To(ts.expirationSeconds),
			},
		}, metav1.CreateOptions{})
		if inErr != nil {
			klog.Warningf("get token failed: %v", inErr)
			return false, nil
		}
		retTokenRequest = tr
		klog.V(5).Infof("create token successfully for serviceaccount %s", ts.serviceAccountName)

		return true, nil
	}); err != nil {
		return nil, fmt.Errorf("failed to get token for %s/%s: %v", ts.namespace, ts.serviceAccountName, err)
	}

	if retTokenRequest.Spec.ExpirationSeconds == nil {
		return nil, fmt.Errorf("nil pointer of expiration in token request")
	}

	lifetime := time.Until(retTokenRequest.Status.ExpirationTimestamp.Time)
	if lifetime < time.Minute*10 {
		// possible clock skew issue, pin to minimum token lifetime
		lifetime = time.Minute * 10
	}

	leeway := time.Duration(int64(lifetime) * int64(ts.leewayPercent) / 100)
	expiry := time.Now().Add(lifetime).Add(-1 * leeway)

	return &oauth2.Token{
		AccessToken: retTokenRequest.Status.Token,
		TokenType:   "Bearer",
		Expiry:      expiry,
	}, nil
}

func getOrCreateServiceAccount(cli kubernetes.Clientset, namespace, name string) (*v1.ServiceAccount, error) {
	sa, err := cli.CoreV1().ServiceAccounts(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err == nil {
		return sa, nil
	}
	if !apierrors.IsNotFound(err) {
		return nil, err
	}

	// Create the namespace if we can't verify it exists.
	// Tolerate errors, since we don't know whether this component has namespace creation permissions.
	if _, err := cli.CoreV1().Namespaces().Get(context.TODO(), namespace, metav1.GetOptions{}); apierrors.IsNotFound(err) {
		if _, err = cli.CoreV1().Namespaces().Create(context.TODO(), &v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: namespace}}, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
			klog.Warningf("create non-exist namespace %s failed:%v", namespace, err)
		}
	}

	// Create the service account
	sa, err = cli.CoreV1().ServiceAccounts(namespace).Create(context.TODO(), &v1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}, metav1.CreateOptions{})
	if apierrors.IsAlreadyExists(err) {
		// If we're racing to init and someone else already created it, re-fetch
		return cli.CoreV1().ServiceAccounts(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	}
	return sa, err
}

```

### Core Architecture Module: `cmd/yurt-manager/app/config/config.go`
```
/*
Copyright 2023 The OpenYurt Authors.

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

package config

import (
	yurtctrlmgrconfig "github.com/openyurtio/openyurt/pkg/yurtmanager/controller/apis/config"
)

var WorkingNamespace string

// Config is the main context object for the controller manager.
type Config struct {
	ComponentConfig yurtctrlmgrconfig.YurtManagerConfiguration
}

type completedConfig struct {
	*Config
}

// CompletedConfig same as Config, just to swap private object.
type CompletedConfig struct {
	// Embed a private pointer that cannot be instantiated outside of this package.
	*completedConfig
}

// Complete fills in any fields not set that are required to have valid data. It's mutating the receiver.
func (c *Config) Complete() *CompletedConfig {
	cc := completedConfig{c}

	return &CompletedConfig{&cc}
}

```

### Core Architecture Module: `cmd/yurt-manager/app/manager.go`
```
/*
Copyright 2023 The OpenYurt Authors.

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

package app

import (
	"flag"
	"fmt"
	"net/http"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/component-base/cli/globalflag"
	"k8s.io/component-base/term"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	runtimewebhook "sigs.k8s.io/controller-runtime/pkg/webhook"

	"github.com/openyurtio/openyurt/cmd/yurt-manager/app/config"
	"github.com/openyurtio/openyurt/cmd/yurt-manager/app/options"
	"github.com/openyurtio/openyurt/cmd/yurt-manager/names"
	"github.com/openyurtio/openyurt/pkg/apis"
	"github.com/openyurtio/openyurt/pkg/projectinfo"
	"github.com/openyurtio/openyurt/pkg/util/profile"
	controller "github.com/openyurtio/openyurt/pkg/yurtmanager/controller/base"
	"github.com/openyurtio/openyurt/pkg/yurtmanager/webhook"
	"github.com/openyurtio/openyurt/pkg/yurtmanager/webhook/util"
)

var (
	scheme   = runtime.NewScheme()
	setupLog = ctrl.Log.WithName("setup")
)

func init() {
	_ = clientgoscheme.AddToScheme(scheme)

	_ = apis.AddToScheme(clientgoscheme.Scheme)
	_ = apis.AddToScheme(scheme)

	// +kubebuilder:scaffold:scheme
}

const (
	YurtManager = "yurt-manager"
)

// NewYurtManagerCommand creates a *cobra.Command object with default parameters
func NewYurtManagerCommand() *cobra.Command {
	s, err := options.NewYurtManagerOptions()
	if err != nil {
		klog.Fatalf("unable to initialize command options: %v", err)
	}

	cmd := &cobra.Command{
		Use: YurtManager,
		Long: `The yurt manager is a daemon that embeds
the all control loops shipped with openyurt. In applications of robotics and
automation, a control loop is a non-terminating loop that regulates the state of
the system. In openyurt, a controller is a control loop that watches the shared
state of the cluster through the apiserver and makes changes attempting to move the
current state towards the desired state.`,
		PersistentPreRunE: func(*cobra.Command, []string) error {
			// silence client-go warnings.
			// yurt-manager generically watches APIs (including deprecated ones),
			// and CI ensures it works properly against matching kube-apiserver versions.
			rest.SetDefaultWarningHandler(rest.NoWarnings{})
			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			// verflag.PrintAndExitIfRequested()
			fmt.Printf("%s version: %#v\n", projectinfo.GetYurtManagerName(), projectinfo.Get())
			if s.Generic.Version {
				return
			}
			projectinfo.RegisterVersionInfo(metrics.Registry, projectinfo.GetYurtManagerName())

			PrintFlags(cmd.Flags())

			c, err := s.Config(controller.KnownControllers(), names.YurtManagerControllerAliases())
			if err != nil {
				fmt.Fprintf(os.Stderr, "%v\n", err)
				os.Exit(1)
			}

			if err := Run(c.Complete(), wait.NeverStop); err != nil {
				fmt.Fprintf(os.Stderr, "%v\n", err)
				os.Exit(1)
			}
		},
		Args: func(cmd *cobra.Command, args []string) error {
			for _, arg := range args {
				if len(arg) > 0 {
					return fmt.Errorf("%q does not take any arguments, got %q", cmd.CommandPath(), args)
				}
			}
			return nil
		},
	}

	fs := cmd.Flags()

	opts := zap.Options{
		Development: true,
	}
	opts.BindFlags(flag.CommandLine)
	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))

	namedFlagSets := s.Flags(controller.KnownControllers(), controller.ControllersDisabledByDefault.List())
	// verflag.AddFlags(namedFlagSets.FlagSet("global"))
	globalflag.AddGlobalFlags(namedFlagSets.FlagSet("global"), cmd.Name())
	for _, f := range namedFlagSets.FlagSets {
		fs.AddFlagSet(f)
	}
	usageFmt := "Usage:\n  %s\n"
	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	cmd.SetUsageFunc(func(cmd *cobra.Command) error {
		fmt.Fprintf(cmd.OutOrStderr(), usageFmt, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStderr(), namedFlagSets, cols)
		return nil
	})
	cmd.SetHelpFunc(func(cmd *cobra.Command, args []string) {
		fmt.Fprintf(cmd.OutOrStdout(), "%s\n\n"+usageFmt, cmd.Long, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStdout(), namedFlagSets, cols)
	})

	config.WorkingNamespace = s.Generic.WorkingNamespace

	return cmd
}

// PrintFlags logs the flags in the flagSet
func PrintFlags(flags *pflag.FlagSet) {
	flags.VisitAll(func(flag *pflag.Flag) {
		klog.V(1).Infof("FLAG: --%s=%q", flag.Name, flag.Value)
	})
}

// Run runs the KubeControllerManagerOptions.  This should never exit.
func Run(c *config.CompletedConfig, stopCh <-chan struct{}) error {
	ctx := ctrl.SetupSignalHandler()
	cfg := ctrl.GetConfigOrDie()
	setRestConfig(cfg, c)

	metricsServerOpts := metricsserver.Options{
		BindAddress:   c.ComponentConfig.Generic.MetricsAddr,
		ExtraHandlers: make(map[string]http.Handler, 0),
	}
	for path, handler := range profile.GetPprofHandlers() {
		metricsServerOpts.ExtraHandlers[path] = handler
	}

	trimManagedFields := func(obj interface{}) (interface{}, error) {
		if accessor, err := meta.Accessor(obj); err == nil {
			if accessor.GetManagedFields() != nil {
				accessor.SetManagedFields(nil)
			}
		}
		return obj, nil
	}
	mgr, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme:                     scheme,
		Metrics:                    metricsServerOpts,
		HealthProbeBindAddress:     c.ComponentConfig.Generic.HealthProbeAddr,
		LeaderElection:             c.ComponentConfig.Generic.LeaderElection.LeaderElect,
		LeaderElectionID:           c.ComponentConfig.Generic.LeaderElection.ResourceName,
		LeaderElectionNamespace:    c.ComponentConfig.Generic.LeaderElection.ResourceNamespace,
		LeaderElectionResourceLock: c.ComponentConfig.Generic.LeaderElection.ResourceLock,
		WebhookServer: runtimewebhook.NewServer(runtimewebhook.Options{
			Host:    "0.0.0.0",
			Port:    util.GetWebHookPort(),
			CertDir: util.GetCertDir(),
		}),
		Logger: setupLog,
		Cache: cache.Options{
			DefaultTransform: trimManagedFields,
		},
	})
	if err != nil {
		setupLog.Error(err, "unable to start manager")
		os.Exit(1)
	}

	setupLog.Info("setup controllers")
	if err = controller.SetupWithManager(ctx, c, mgr); err != nil {
		setupLog.Error(err, "unable to setup controllers")
		os.Exit(1)
	}

	setupLog.Info("setup webhook")
	if err = webhook.SetupWithManager(c, mgr); err != nil {
		setupLog.Error(err, "unable to setup webhook")
		os.Exit(1)
	}

	if len(webhook.WebhookHandlerPath) != 0 {
		// +kubebuilder:scaffold:builder
		setupLog.Info("initialize webhook")
		if err := webhook.Initialize(ctx, c, mgr.GetConfig()); err != nil {
			setupLog.Error(err, "unable to initialize webhook")
			os.Exit(1)
		}

		if err := mgr.AddReadyzCheck("webhook-ready", mgr.GetWebhookServer().StartedChecker()); err != nil {
			setupLog.Error(err, "unable to add readyz check")
			os.Exit(1)
		}
	} else {
		klog.Infof("no webhook is registered, so skip webhook setup")
	}

	if err := mgr.AddHealthzCheck("health", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up health check")
		os.Exit(1)
	}
	if err := mgr.AddReadyzCheck("check", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up ready check")
		os.Exit(1)
	}

	setupLog.Info("starting manager")
```

### Core Architecture Module: `cmd/yurt-manager/app/options/csrapprovercontroller.go`
```
/*
Copyright 2024 The OpenYurt Authors.

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package options

import (
	"github.com/spf13/pflag"

	"github.com/openyurtio/openyurt/pkg/yurtmanager/controller/csrapprover/config"
)

type CsrApproverControllerOptions struct {
	*config.CsrApproverControllerConfiguration
}

func NewCsrApproverControllerOptions() *CsrApproverControllerOptions {
	return &CsrApproverControllerOptions{
		&config.CsrApproverControllerConfiguration{
			ConcurrentCsrApproverWorkers: 3,
		},
	}
}

// AddFlags adds flags related to nodePool for yurt-manager to the specified FlagSet.
func (o *CsrApproverControllerOptions) AddFlags(fs *pflag.FlagSet) {
	if o == nil {
		return
	}

	fs.Int32Var(&o.ConcurrentCsrApproverWorkers, "concurrent-csr-approver-workers", o.ConcurrentCsrApproverWorkers, "The number of csr objects that are allowed to reconcile concurrently. Larger number = more responsive csrs, but more CPU (and network) load")
}

// ApplyTo fills up nodePool config with options.
func (o *CsrApproverControllerOptions) ApplyTo(cfg *config.CsrApproverControllerConfiguration) error {
	if o == nil {
		return nil
	}

	cfg.ConcurrentCsrApproverWorkers = o.ConcurrentCsrApproverWorkers
	return nil
}

// Validate checks validation of CsrApproverControllerOptions.
func (o *CsrApproverControllerOptions) Validate() []error {
	if o == nil {
		return nil
	}
	errs := []error{}
	return errs
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2817** (2026-09-28): **build(deps): bump github/codeql-action from 4.38.0 to 4.38.1**
  *Symptoms*: Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p> <blockquote> <h2>v4.38.1</h2> <ul> <li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support analysis for a single language and are therefore smaller than the combined bundles that allow analysis for all supported languages. As a result, per-language bundles take up less space on disk and are faster to download. We expect to roll this change out to everyone in the coming weeks. <a href="https://redirect.github.com/github/codeql-action/pull/4146">#4146</a></li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/blob/main/CHANGELOG.md">github/codeql-action's changelog</a>.</em></p> <blockquote> <h2>4.38.1 - 18 Sept 2026</h2> <ul> <li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support analysis for a single language and are therefore smaller than the combined bundles that allow analysis for all supported languages. As a result, per-language bundles take up less space on disk and are faster to download. We expect to roll this change out to everyone in the coming 
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2817) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2817&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2817&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2817&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2817?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.58%. Comparing base ([`7833349`](https://app.codecov.io/gh/openyurtio/openyurt/commit/78333496ac530d483545ac3916de2ecb2fab6d01?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`5443d53`](https://app.codecov.io/gh/openyurtio/openyurt/commit/5443d53ff3c57b5e1ae4ce336aa2eb13b365aaba?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##           master    #2817      +/-   ## ====
  > Superseded by #2820.

- **Issue #2816** (2026-09-28): **build(deps): bump crate-ci/typos from 1.43.3 to 1.50.2**
  *Symptoms*: Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.43.3 to 1.50.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/releases">crate-ci/typos's releases</a>.</em></p> <blockquote> <h2>v1.50.2</h2> <h2>[1.50.2] - 2026-09-15</h2> <h3>Fixes</h3> <ul> <li>Don't panic when files being examined are removed</li> </ul> <h2>v1.50.1</h2> <h2>[1.50.1] - 2026-09-01</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>asend</code> in Python code</li> </ul> <h2>v1.50.0</h2> <h2>[1.50.0] - 2026-08-28</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1587">August 2026</a> changes</li> </ul> <h2>v1.49.1</h2> <h2>[1.49.1] - 2026-08-27</h2> <h3>Fixes</h3> <ul> <li>Don't correct the brand name <code>HashiCorp</code></li> </ul> <h2>v1.49.0</h2> <h2>[1.49.0] - 2026-08-03</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1573">July 2026</a> changes</li> </ul> <h2>v1.48.0</h2> <h2>[1.48.0] - 2026-06-30</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1562">June 2026</a> changes</li> </ul> <h2>v1.47.2</h2> <h2>[1.47.2] - 2026-06-04</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>inferrable</code></li> <li>Correct unused <code>inferible</code> variant</li> </ul> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2816) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2816&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2816&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2816&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2816?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.58%. Comparing base ([`7833349`](https://app.codecov.io/gh/openyurtio/openyurt/commit/78333496ac530d483545ac3916de2ecb2fab6d01?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`a61ba48`](https://app.codecov.io/gh/openyurtio/openyurt/commit/a61ba48d03702ba0e535d39da1b073a86f386ea5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #2816   +/-   ## ==========
  > Superseded by #2819.

- **Issue #2809** (2026-09-17): **[BUG] Stale EndpointSlice addresses after a disconnected reboot break ClusterIP traffic and cluster DNS on the edge node**
  *Symptoms*: **What happened**:  An edge node lost its connection to the cloud API server and was then rebooted. The CNI gave every pod a new address. EndpointSlices are written only by the endpoint controller in the control plane, which was unreachable, so nothing updated them. yurthub served kube-proxy and CoreDNS the addresses it had cached before the outage. Every one of those addresses was dead.  kube-proxy programmed DNAT rules to dead pod addresses, so all ClusterIP Service traffic on the node failed. CoreDNS runs as a DaemonSet on the edge and got a new address too, so the `kube-dns` ClusterIP pointed at a dead CoreDNS and cluster DNS was down for the whole window. An application that builds its connection pool once at startup stayed broken after DNS recovered. In our run one of four application pods was unusable for 34 minutes. The only recovery was to hand-edit JSON in yurthub's cache directory and restart three components.  There is a second half. Even if yurthub served corrected addresses, nobody would ask for them. While the cloud is unreachable the multiplexer's cacher is fed from an unchanging disk cache and emits no watch events. kube-proxy and CoreDNS finish their initial LIST and keep that view until they are restarted.  **What you expected to happen**:  While the node is disconnected, yurthub should serve EndpointSlices whose addresses match the pods actually running on the node. Consumers that already LISTed should be told to LIST again when those addresses change. Edg
  **Post-Mortem & Fix Analysis**:
  > Closing, will refile with a shorter report.

- **Issue #2803** (2026-09-16): **build(deps): bump github/codeql-action from 4.37.4 to 4.38.0**
  *Symptoms*: Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.37.4 to 4.38.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p> <blockquote> <h2>v4.38.0</h2> <ul> <li>On GitHub-hosted runners, the CodeQL Action now deletes unused CodeQL bundles from the toolcache before downloading a different bundle, which frees up disk space for the analysis. We expect to roll this change out to everyone in September. <a href="https://redirect.github.com/github/codeql-action/pull/4124">#4124</a></li> <li>The CodeQL Action now supports CodeQL releases that are compatible with Linux Arm64 and downloads the native <code>linux-arm64</code> CodeQL bundle when available. <a href="https://redirect.github.com/github/codeql-action/pull/4072">#4072</a></li> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.27.0">2.27.0</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4129">#4129</a></li> </ul> <h2>v4.37.9</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.4">2.26.4</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4106">#4106</a></li> </ul> <h2>v4.37.8</h2> <p>No user facing changes.</p> <h2>v4.37.7</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.co
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2803) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2803&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2803&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2803&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2803?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.23%. Comparing base ([`fbefb6b`](https://app.codecov.io/gh/openyurtio/openyurt/commit/fbefb6baca665cf4431cf37100a9cc0c0528fb4d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`b1b3921`](https://app.codecov.io/gh/openyurtio/openyurt/commit/b1b39219bc0c77b8f42bad1d178dae5baf6e1a74?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #2803   +/-   ## ==========
  > /LGTM

- **Issue #2799** (2026-09-16): **build(deps): bump crate-ci/typos from 1.43.3 to 1.50.1**
  *Symptoms*: Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.43.3 to 1.50.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/releases">crate-ci/typos's releases</a>.</em></p> <blockquote> <h2>v1.50.1</h2> <h2>[1.50.1] - 2026-09-01</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>asend</code> in Python code</li> </ul> <h2>v1.50.0</h2> <h2>[1.50.0] - 2026-08-28</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1587">August 2026</a> changes</li> </ul> <h2>v1.49.1</h2> <h2>[1.49.1] - 2026-08-27</h2> <h3>Fixes</h3> <ul> <li>Don't correct the brand name <code>HashiCorp</code></li> </ul> <h2>v1.49.0</h2> <h2>[1.49.0] - 2026-08-03</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1573">July 2026</a> changes</li> </ul> <h2>v1.48.0</h2> <h2>[1.48.0] - 2026-06-30</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1562">June 2026</a> changes</li> </ul> <h2>v1.47.2</h2> <h2>[1.47.2] - 2026-06-04</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>inferrable</code></li> <li>Correct unused <code>inferible</code> variant</li> </ul> <h2>v1.47.1</h2> <h2>[1.47.1] - 2026-06-03</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>requestors</code></li> </ul> <!-- raw HTML omitted --> </blockquote> <p>... (truncated)</p> </detai
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2799) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2799&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2799&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2799&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2799?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.23%. Comparing base ([`fbefb6b`](https://app.codecov.io/gh/openyurtio/openyurt/commit/fbefb6baca665cf4431cf37100a9cc0c0528fb4d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`fc501ef`](https://app.codecov.io/gh/openyurtio/openyurt/commit/fc501ef89b3d73cdca09d708e95174b79ffd8975?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #2799   +/-   ## ==========
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`. You can also ignore all major, minor, or patch releases for a dependency by adding an [`ignore` condition](https://docs.github.com/en/code-security/supply-chain-security/configuration-options-for-dependency-updates#ignore) with the desired `update_types` to your config file.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #2798** (2026-09-16): **build(deps): bump google.golang.org/grpc from 1.79.3 to 1.83.1**
  *Symptoms*: Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.79.3 to 1.83.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/grpc/grpc-go/releases">google.golang.org/grpc's releases</a>.</em></p> <blockquote> <h2>Release 1.83.1</h2> <h1>Security</h1> <ul> <li>xds/rbac: Fix a bug where nested <code>Principal</code> or <code>Permission</code> rules with <code>:scheme</code> or <code>grpc-</code> prefixed header matchers were not rejected, which could cause DENY rules to fail open. (<a href="https://redirect.github.com/grpc/grpc-go/issues/9258">#9258</a>) <ul> <li>Special Thanks: <a href="https://github.com/nvxbug"><code>@​nvxbug</code></a></li> </ul> </li> <li>xds/rbac: Fix a bug where the <code>host</code> header matcher was not being replaced with <code>:authority</code> in nested <code>Principal</code> or <code>Permission</code> rules. (<a href="https://redirect.github.com/grpc/grpc-go/issues/9258">#9258</a>) <ul> <li>Special Thanks: <a href="https://github.com/nvxbug"><code>@​nvxbug</code></a></li> </ul> </li> <li>xds/rbac: Fix a bug where a header matcher whose name was not lowercase, such as <code>X-Role</code>, matched no header, which could cause DENY rules to fail open. (<a href="https://redirect.github.com/grpc/grpc-go/issues/9332">#9332</a>) <ul> <li>Special Thanks: <a href="https://github.com/alimony"><code>@​alimony</code></a></li> </ul> </li> <li>xds/rbac: Fix a bug where a <code>:scheme</code> or <code>grpc-</c
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2798) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2798&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2798&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2798&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2798?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.23%. Comparing base ([`fbefb6b`](https://app.codecov.io/gh/openyurtio/openyurt/commit/fbefb6baca665cf4431cf37100a9cc0c0528fb4d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`29c0c09`](https://app.codecov.io/gh/openyurtio/openyurt/commit/29c0c0954fe8da160364d3d14789f95cff6f9f14?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #2798   +/-   ## ==========

- **Issue #2796** (2026-09-14): **build(deps): bump github/codeql-action from 4.37.4 to 4.37.9**
  *Symptoms*: Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.37.4 to 4.37.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p> <blockquote> <h2>v4.37.9</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.4">2.26.4</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4106">#4106</a></li> </ul> <h2>v4.37.8</h2> <p>No user facing changes.</p> <h2>v4.37.7</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.3">2.26.3</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4085">#4085</a></li> </ul> <h2>v4.37.6</h2> <ul> <li>Changed the default filepath for the new remote file address format that was introduced in CodeQL Action 4.37.0 / 3.37.0 to <code>.github/codeql-config.yml</code> to align it with the suggested path that is used elsewhere. <a href="https://redirect.github.com/github/codeql-action/pull/4070">#4070</a></li> </ul> <h2>v4.37.5</h2> <ul> <li>Fixed a bug where a network error while streaming the download of the CodeQL bundle could terminate the <code>init</code> Action instead of falling back to downloading the bundle before extracting it. <a href="https://redirect.github.com/github/codeql-action/pull/4061">#4061</a></li> </ul> </blockquote> </
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2796) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2796&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2796&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2796&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2796?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.22%. Comparing base ([`fbefb6b`](https://app.codecov.io/gh/openyurtio/openyurt/commit/fbefb6baca665cf4431cf37100a9cc0c0528fb4d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`c54d88c`](https://app.codecov.io/gh/openyurtio/openyurt/commit/c54d88c11158edc97445e55b7985d81ba11c199b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##           master    #2796      +/-   ## ====
  > Superseded by #2803.

- **Issue #2795** (2026-09-07): **build(deps): bump crate-ci/typos from 1.43.3 to 1.50.0**
  *Symptoms*: Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.43.3 to 1.50.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/releases">crate-ci/typos's releases</a>.</em></p> <blockquote> <h2>v1.50.0</h2> <h2>[1.50.0] - 2026-08-28</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1587">August 2026</a> changes</li> </ul> <h2>v1.49.1</h2> <h2>[1.49.1] - 2026-08-27</h2> <h3>Fixes</h3> <ul> <li>Don't correct the brand name <code>HashiCorp</code></li> </ul> <h2>v1.49.0</h2> <h2>[1.49.0] - 2026-08-03</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1573">July 2026</a> changes</li> </ul> <h2>v1.48.0</h2> <h2>[1.48.0] - 2026-06-30</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1562">June 2026</a> changes</li> </ul> <h2>v1.47.2</h2> <h2>[1.47.2] - 2026-06-04</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>inferrable</code></li> <li>Correct unused <code>inferible</code> variant</li> </ul> <h2>v1.47.1</h2> <h2>[1.47.1] - 2026-06-03</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>requestors</code></li> </ul> <h2>v1.47.0</h2> <h2>[1.47.0] - 2026-05-29</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1545">May 2026</a> changes</li> </u
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2795) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2795&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2795&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2795&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2795?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.23%. Comparing base ([`fbefb6b`](https://app.codecov.io/gh/openyurtio/openyurt/commit/fbefb6baca665cf4431cf37100a9cc0c0528fb4d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`fa09d30`](https://app.codecov.io/gh/openyurtio/openyurt/commit/fa09d30d90448c498120e9573093577f1ce99d6c?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #2795   +/-   ## ==========
  > Superseded by #2799.

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

### Incident Patch 1: `d066363a` (2026-09-16)
**Commit Message**: Bugfix: prevent Raven DNS panic on nil ConfigMap data (#2710)

**File**: `pkg/yurtmanager/controller/raven/dns/gateway_dns_controller.go` (modified, +3/-0)
```diff
@@ -153,6 +153,9 @@ func (r *ReconcileDNS) Reconcile(ctx context.Context, req reconcile.Request) (re
 		klog.Error(Format("could not list node, error %s", err.Error()))
 		return reconcile.Result{Requeue: true, RequeueAfter: 2 * time.Second}, err
 	}
+	if cm.Data == nil {
+		cm.Data = make(map[string]string)
+	}
 	cm.Data[util.ProxyNodesKey] = buildDNSRecords(&nodeList, enableProxy, proxyAddress)
 	err = r.updateDNS(cm)
 	if err != nil {
```

**File**: `pkg/yurtmanager/controller/raven/dns/gateway_dns_controller_test.go` (modified, +28/-0)
```diff
@@ -205,3 +205,31 @@ func TestReconcileDNS_getService(t *testing.T) {
 		assert.Equal(t, ProxyIP, svc.Spec.ClusterIP, "expected correct clusterIP")
 	})
 }
+
+func TestReconcileDNS_InitializesNilConfigMapData(t *testing.T) {
+	r := mockReconciler()
+	key := client.ObjectKey{
+		Namespace: util.WorkingNamespace,
+		Name:      util.RavenProxyNodesConfig,
+	}
+
+	cm := &v1.ConfigMap{}
+	err := r.Get(context.Background(), key, cm)
+	assert.NoError(t, err)
+
+	cm.Data = nil
+	err = r.Update(context.Background(), cm)
+	assert.NoError(t, err)
+
+	_, err = r.Reconcile(context.Background(), reconcile.Request{
+		NamespacedName: key,
+	})
+	assert.NoError(t, err)
+
+	updated := &v1.ConfigMap{}
+	err = r.Get(context.Background(), key, updated)
+	assert.NoError(t, err)
+	assert.NotNil(t, updated.Data)
+	_, exists := updated.Data[util.ProxyNodesKey]
+	assert.True(t, exists)
+}
```

---

### Incident Patch 2: `b05a7818` (2026-09-16)
**Commit Message**: fix(yurtmanager): initialize configmap Data before writing framework in platformadmin controller (#2708)

writeFramework fetches the existing framework ConfigMap for a
PlatformAdmin and then writes the encoded framework straight into
cm.Data inside the CreateOrUpdate mutate function. The nil-map guard
only exists on the create path via initFramework; if the ConfigMap
already exists but has a nil Data map (for example when it was
created or edited outside the normal reconcile path), the write
panics with "assignment to entry in nil map".

This initializes cm.Data before writing to it, matching the guard
already used for the same class of issue elsewhere in the codebase.

Fixes #2707

**File**: `pkg/yurtmanager/controller/platformadmin/platform_admin_controller.go` (modified, +3/-0)
```diff
@@ -717,6 +717,9 @@ func (r *ReconcilePlatformAdmin) writeFramework(ctx context.Context, platformAdm
 
 	// Creates configmap on behalf of the framework, which is called only once upon creation
 	_, err = controllerutil.CreateOrUpdate(ctx, r.Client, cm, func() error {
+		if cm.Data == nil {
+			cm.Data = map[string]string{}
+		}
 		cm.Data["framework"] = string(data)
 		return controllerutil.SetOwnerReference(platformAdmin, cm, r.Scheme())
 	})
```

**File**: `pkg/yurtmanager/controller/platformadmin/platform_admin_controller_test.go` (modified, +45/-0)
```diff
@@ -180,3 +180,48 @@ func TestReconcilePlatformAdmin(t *testing.T) {
 		})
 	}
 }
+
+func TestWriteFrameworkWithNilConfigMapData(t *testing.T) {
+	platformAdmin := &iotv1beta1.PlatformAdmin{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "test-platformadmin",
+			Namespace: "default",
+		},
+		Spec: iotv1beta1.PlatformAdminSpec{
+			Version:   "minnesota",
+			NodePools: []string{"pool1"},
+		},
+	}
+
+	// The framework configmap already exists but its Data field is nil, e.g. because
+	// it was created or edited outside of the normal reconcile path.
+	existingConfigMap := &corev1.ConfigMap{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "test-platformadmin-framework",
+			Namespace: "default",
+		},
+	}
+
+	fakeClient := fake.NewClientBuilder().WithScheme(fakeScheme).WithObjects(platformAdmin, existingConfigMap).Build()
+
+	r := &ReconcilePlatformAdmin{
+		Client:         fakeClient,
+		scheme:         fakeScheme,
+		recorder:       &fakeEventRecorder{},
+		yamlSerializer: kjson.NewSerializerWithOptions(kjson.DefaultMetaFactory, scheme.Scheme, scheme.Scheme, kjson.SerializerOptions{Yaml: true, Pretty: true}),
+	}
+
+	platformAdminFramework := &PlatformAdminFramework{
+		name: "test-platformadmin-framework",
+	}
+
+	assert.NotPanics(t, func() {
+		err := r.writeFramework(context.TODO(), platformAdmin, platformAdminFramework)
+		assert.NoError(t, err)
+	})
+
+	updatedConfigMap := &corev1.ConfigMap{}
+	err := fakeClient.Get(context.TODO(), client.ObjectKey{Name: "test-platformadmin-framework", Namespace: "default"}, updatedConfigMap)
+	assert.NoError(t, err)
+	assert.Contains(t, updatedConfigMap.Data, "framework")
+}
```

---

### Incident Patch 3: `94a39328` (2026-09-16)
**Commit Message**: fix(controller): prevent infinite Requeue loop during conversion Job deletion (#2706)

* fix(controller): prevent infinite Requeue loop during conversion Job deletion

* test(controller): add coverage for stale Job DeletionTimestamp check

**File**: `pkg/yurtmanager/controller/yurtnodeconversion/yurt_node_conversion_controller.go` (modified, +5/-0)
```diff
@@ -226,6 +226,11 @@ func (r *ReconcileYurtNodeConversion) handleStaleJob(
 	ctx context.Context, node *corev1.Node, job *batchv1.Job,
 	desiredAction, currentJobAction string,
 ) (reconcile.Result, error) {
+	if job.DeletionTimestamp != nil {
+		klog.V(4).Info(Format("node(%s) stale job %s is already deleting, waiting for it to be removed", node.Name, job.Name))
+		return reconcile.Result{}, nil
+	}
+
 	if isJobFinished(job) {
 		klog.V(4).Info(Format("node(%s) deleting stale job %s, desiredAction=%s currentJobAction=%s",
 			node.Name, job.Name, desiredAction, currentJobAction))
```

**File**: `pkg/yurtmanager/controller/yurtnodeconversion/yurt_node_conversion_controller_test.go` (modified, +28/-0)
```diff
@@ -282,6 +282,34 @@ func TestReconcileDeleteStaleFinishedJob(t *testing.T) {
 	assert.Error(t, err)
 }
 
+func TestReconcileIgnoreDeletingStaleJob(t *testing.T) {
+	node := newNode("node-a", map[string]string{
+		projectinfo.GetEdgeWorkerLabelKey(): "true",
+	}, false, nil)
+	job := newConversionJobForTest(t, actionConvert, "node-a")
+	job.Status.Conditions = []batchv1.JobCondition{{
+		Type:   batchv1.JobComplete,
+		Status: corev1.ConditionTrue,
+	}}
+	job.Status.Succeeded = 1
+	now := metav1.Now()
+	job.DeletionTimestamp = &now
+	job.Finalizers = []string{"dummy-finalizer"}
+
+	r, cli := newReconcilerForTest(t, node, job)
+
+	result, err := r.Reconcile(context.Background(), reconcile.Request{NamespacedName: types.NamespacedName{Name: "node-a"}})
+	require.NoError(t, err)
+	assert.False(t, result.Requeue)
+
+	ignoredJob := &batchv1.Job{}
+	err = cli.Get(context.Background(), types.NamespacedName{
+		Namespace: r.conversionJobNamespace(),
+		Name:      conversionJobName("node-a"),
+	}, ignoredJob)
+	assert.NoError(t, err)
+}
+
 func TestReconcileKeepRunningJobInProgress(t *testing.T) {
 	node := newNode("node-a", map[string]string{
 		projectinfo.GetNodePoolLabel(): "pool-a",
```

---

### Incident Patch 4: `32f19200` (2026-09-16)
**Commit Message**: fix(yurthub): use sync.Once to protect stopCh from concurrent panics (#2701)

**File**: `pkg/yurthub/multiplexer/filterwatch.go` (modified, +9/-8)
```diff
@@ -17,6 +17,8 @@ limitations under the License.
 package multiplexer
 
 import (
+	"sync"
+
 	"k8s.io/apimachinery/pkg/runtime"
 	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
 	"k8s.io/apimachinery/pkg/watch"
@@ -26,19 +28,18 @@ import (
 )
 
 type filterWatch struct {
-	source watch.Interface
-	filter filter.ObjectFilter
-	result chan watch.Event
-	done   chan struct{}
+	source   watch.Interface
+	filter   filter.ObjectFilter
+	result   chan watch.Event
+	done     chan struct{}
+	stopOnce sync.Once
 }
 
 func (f *filterWatch) Stop() {
-	select {
-	case <-f.done:
-	default:
+	f.stopOnce.Do(func() {
 		close(f.done)
 		f.source.Stop()
-	}
+	})
 }
 
 func newFilterWatch(source watch.Interface, filter filter.ObjectFilter) watch.Interface {
```

---

### Incident Patch 5: `ddbb268d` (2026-09-16)
**Commit Message**: Bugfix: restrict webhook certificate and private key file permissions (#2699)

certToProjectionMap assigned mode 0666 to every file it writes, including the
CA private key (ca-key.pem) and the server private keys (key.pem, tls.key).
That makes private key material readable and writable by every user on the
host. prepareToWrite additionally created the certificate directory with 0777.

These modes are not softened by the process umask. atomic_writer.go calls
os.Chmod explicitly after writing each file, specifically so that the requested
mode is applied "no matter what the umask is", so an operator cannot restrict
them from outside.

Both permissive modes carried TODO comments noting they were meant to be
reduced.

Private keys are now written 0600 and certificates 0644, and the certificate
directory is created 0755, matching the mode the atomic writer already applies
to its own timestamped data directory. The webhook server reads these files as
the same user that writes them, so narrowing owner-only access is sufficient.

The package had no tests. Added coverage asserting the mode of each projected
file and that no file or the containing directory is group or world writable.

Signed

**File**: `pkg/yurtmanager/webhook/util/writer/fs.go` (modified, +16/-9)
```diff
@@ -30,6 +30,15 @@ import (
 
 const (
 	FsCertWriter = "fs"
+
+	// keyFileMode is the mode used for private key material. Private keys are
+	// readable and writable by the owner only.
+	keyFileMode int32 = 0600
+	// certFileMode is the mode used for certificates, which are public material.
+	certFileMode int32 = 0644
+	// certDirMode is the mode used for the directory holding the certificates. It
+	// matches the mode the atomic writer already applies to its own data directory.
+	certDirMode os.FileMode = 0755
 )
 
 // fsCertWriter provisions the certificate by reading and writing to the filesystem.
@@ -122,8 +131,7 @@ func prepareToWrite(dir string) error {
 	switch {
 	case os.IsNotExist(err):
 		klog.Info("cert directory doesn't exist, creating", "directory", dir)
-		// TODO: figure out if we can reduce the permission. (Now it's 0777)
-		err = os.MkdirAll(dir, 0777)
+		err = os.MkdirAll(dir, certDirMode)
 		if err != nil {
 			return fmt.Errorf("can't create dir: %v", dir)
 		}
@@ -197,31 +205,30 @@ func ensureExist(dir string) error {
 }
 
 func certToProjectionMap(cert *generator.Artifacts) map[string]atomic.FileProjection {
-	// TODO: figure out if we can reduce the permission. (Now it's 0666)
 	return map[string]atomic.FileProjection{
 		CAKeyName: {
 			Data: cert.CAKey,
-			Mode: 0666,
+			Mode: keyFileMode,
 		},
 		CACertName: {
 			Data: cert.CACert,
-			Mode: 0666,
+			Mode: certFileMode,
 		},
 		ServerCertName: {
 			Data: cert.Cert,
-			Mode: 0666,
+			Mode: certFileMode,
 		},
 		ServerCertName2: {
 			Data: cert.Cert,
-			Mode: 0666,
+			Mode: certFileMode,
 		},
 		ServerKeyName: {
 			Data: cert.Key,
-			Mode: 0666,
+			Mode: keyFileMode,
 		},
 		ServerKeyName2: {
 			Data: cert.Key,
-			Mode: 0666,
+			Mode: keyFileMode,
 		},
 	}
 }
```

**File**: `pkg/yurtmanager/webhook/util/writer/fs_test.go` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/*
+Copyright 2026 The OpenYurt Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+	http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package writer
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/openyurtio/openyurt/pkg/yurtmanager/webhook/util/generator"
+)
+
+func TestCertToProjectionMapModes(t *testing.T) {
+	certs := &generator.Artifacts{
+		CAKey:  []byte("ca-key"),
+		CACert: []byte("ca-cert"),
+		Cert:   []byte("cert"),
+		Key:    []byte("key"),
+	}
+
+	projections := certToProjectionMap(certs)
+
+	tests := []struct {
+		name         string
+		file         string
+		expectedMode int32
+	}{
+		{name: "CA private key is not group or world readable", file: CAKeyName, expectedMode: keyFileMode},
+		{name: "server private key is not group or world readable", file: ServerKeyName, expectedMode: keyFileMode},
+		{name: "server private key alias is not group or world readable", file: ServerKeyName2, expectedMode: keyFileMode},
+		{name: "CA certificate is world readable", file: CACertName, expectedMode: certFileMode},
+		{name: "server certificate is world readable", file: ServerCertName, expectedMode: certFileMode},
+		{name: "server certificate alias is world readable", file: ServerCertName2, expectedMode: certFileMode},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			projection, ok := projections[tt.file]
+			require.Truef(t, ok, "no projection for %s", tt.file)
+			require.Equalf(t, tt.expectedMode, projection.Mode, "unexpected mode for %s", tt.file)
+		})
+	}
+
+	// The writer calls os.Chmod with these modes explicitly, so they are applied
+	// regardless of the process umask. No file may be writable by group or other.
+	for file, projection := range projections {
+		require.Zerof(t, projection.Mode&0022, "%s is group or world writable (mode %#o)", file, projection.Mode)
+	}
+}
+
+func TestCertDirModeIsNotWorldWritable(t *testing.T) {
+	require.Zerof(t, certDirMode&0022, "cert directory is group or world writable (mode %#o)", certDirMode)
+}
```

---

### Incident Patch 6: `99a82765` (2026-09-16)
**Commit Message**: fix: add missing return after WriteErr in getPodList (fixes #2693) (#2695)

* fix: add missing return after WriteErr in getPodList (fixes #2693)

* test: add unit tests for getPodList covering all code paths including error returns

* fix: add missing return after WriteErr in getPodList (fixes #2693)

**File**: `pkg/yurthub/server/server.go` (modified, +5/-2)
```diff
@@ -35,6 +35,8 @@ import (
 	otautil "github.com/openyurtio/openyurt/pkg/yurthub/otaupdate/util"
 )
 
+var encodePodsFn = otautil.EncodePods
+
 // RunYurtHubServers is used to start up all servers for yurthub
 func RunYurtHubServers(cfg *config.YurtHubConfiguration,
 	proxyHandler http.Handler,
@@ -127,7 +129,6 @@ func readyz(cfg *config.YurtHubConfiguration) http.Handler {
 		fmt.Fprintf(w, "OK")
 	})
 }
-
 func getPodList(sharedFactory informers.SharedInformerFactory) http.Handler {
 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		podLister := sharedFactory.Core().V1().Pods().Lister()
@@ -137,15 +138,17 @@ func getPodList(sharedFactory informers.SharedInformerFactory) http.Handler {
 			otautil.WriteErr(w, "Get pods key failed", http.StatusInternalServerError)
 			return
 		}
+
 		pl := new(corev1.PodList)
 		for i := range podList {
 			pl.Items = append(pl.Items, *podList[i])
 		}
 
-		data, err := otautil.EncodePods(pl)
+		data, err := encodePodsFn(pl)
 		if err != nil {
 			klog.Errorf("Encode pod list failed, %v", err)
 			otautil.WriteErr(w, "Encode pod list failed", http.StatusInternalServerError)
+			return
 		}
 		otautil.WriteJSONResponse(w, data)
 	})
```

**File**: `pkg/yurthub/server/server_test.go` (added, +303/-0)
```diff
@@ -0,0 +1,303 @@
+/*
+Copyright 2022 The OpenYurt Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package server
+
+import (
+	"encoding/json"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"reflect"
+	"strings"
+	"testing"
+
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/labels"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/informers"
+	admissionregistration "k8s.io/client-go/informers/admissionregistration"
+	apiserverinternal "k8s.io/client-go/informers/apiserverinternal"
+	apps "k8s.io/client-go/informers/apps"
+	autoscaling "k8s.io/client-go/informers/autoscaling"
+	batch "k8s.io/client-go/informers/batch"
+	certificates "k8s.io/client-go/informers/certificates"
+	coordination "k8s.io/client-go/informers/coordination"
+	coreinformers "k8s.io/client-go/informers/core"
+	corev1informers "k8s.io/client-go/informers/core/v1"
+	discovery "k8s.io/client-go/informers/discovery"
+	events "k8s.io/client-go/informers/events"
+	extensions "k8s.io/client-go/informers/extensions"
+	flowcontrol "k8s.io/client-go/informers/flowcontrol"
+	internalinterfaces "k8s.io/client-go/informers/internalinterfaces"
+	networking "k8s.io/client-go/informers/networking"
+	node "k8s.io/client-go/informers/node"
+	policy "k8s.io/client-go/informers/policy"
+	rbac "k8s.io/client-go/informers/rbac"
+	resource "k8s.io/client-go/informers/resource"
+	scheduling "k8s.io/client-go/informers/scheduling"
+	storage "k8s.io/client-go/informers/storage"
+	storagemigration "k8s.io/client-go/informers/storagemigration"
+	"k8s.io/client-go/kubernetes/fake"
+	listersv1 "k8s.io/client-go/listers/core/v1"
+	"k8s.io/client-go/tools/cache"
+
+	otautil "github.com/openyurtio/openyurt/pkg/yurthub/otaupdate/util"
+)
+
+func TestGetPodList_Success(t *testing.T) {
+	pod1 := &corev1.Pod{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "pod1",
+			Namespace: "default",
+		},
+		Status: corev1.PodStatus{
+			Phase: corev1.PodRunning,
+		},
+	}
+	pod2 := &corev1.Pod{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "pod2",
+			Namespace: "default",
+		},
+		Status: corev1.PodStatus{
+			Phase: corev1.PodPending,
+		},
+	}
+
+	fakeClientset := fake.NewSimpleClientset(pod1, pod2)
+	factory := informers.NewSharedInformerFactory(fakeClientset, 0)
+
+	factory.Core().V1().Pods().Informer()
+
+	stopCh := make(chan struct{})
+	defer close(stopCh)
+	factory.Start(stopCh)
+	factory.WaitForCacheSync(stopCh)
+
+	handler := getPodList(factory)
+
+	req := httptest.NewRequest(http.MethodGet, "/pods", nil)
+	w := httptest.NewRecorder()
+	handler.ServeHTTP(w, req)
+
+	if w.Code != http.StatusOK {
+		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
+	}
+
+	var got, expected corev1.PodList
+	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
+		t.Fatalf("Failed to decode response: %v", err)
+	}
+	expectedPodList := &corev1.PodList{}
+	for _, p := range []*corev1.Pod{pod1, pod2} {
+		expectedPodList.Items = append(expectedPodList.Items, *p)
+	}
+	expectedData, err := otautil.EncodePods(expectedPodList)
+	if err != nil {
+		t.Fatalf("Failed to encode expected pod list: %v", err)
+	}
+	if err := json.Unmarshal(expectedData, &expected); err != nil {
+		t.Fatalf("Failed to decode expected: %v", err)
+	}
+
+	if len(got.Items) != len(expected.Items) {
+		t.Errorf("Expected %d pods, got %d", len(expected.Items), len(got.Items))
+	}
+	gotByName := make(map[string]bool)
+	for _, p :
```

---

### Incident Patch 7: `7873b0ea` (2026-09-16)
**Commit Message**: fix(yurtmanager): initialize Annotations before setting AdditionalNodepools in platformadmin conversion webhook (#2692)

In the PlatformAdmin v1alpha2 conversion webhook, ConvertFrom copies
ObjectMeta directly from the stored v1beta1 object. When that object has
more than one entry in Spec.NodePools but no annotations set, Annotations
is nil, and writing the AdditionalNodepools key into it panics with
"assignment to entry in nil map".

This initializes Annotations before the write, matching the guard already
used for the equivalent NodePool conversion webhooks.

Fixes #2691

**File**: `pkg/apis/iot/v1alpha2/platformadmin_conversion.go` (modified, +3/-0)
```diff
@@ -77,6 +77,9 @@ func (c *PlatformAdmin) ConvertFrom(srcRaw conversion.Hub) error {
 		if err != nil {
 			return err
 		}
+		if c.Annotations == nil {
+			c.Annotations = make(map[string]string)
+		}
 		c.Annotations["AdditionalNodepools"] = string(additionalNodePoolsJSON)
 	}
 	c.Spec.Platform = PlatformAdminPlatformEdgeX
```

**File**: `pkg/apis/iot/v1alpha2/platformadmin_conversion_test.go` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+/*
+Copyright 2023 The OpenYurt Authors.
+
+Licensed under the Apache License, Version 2.0 (the License);
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an AS IS BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package v1alpha2
+
+import (
+	"encoding/json"
+	"testing"
+
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+
+	"github.com/openyurtio/openyurt/pkg/apis/iot/v1beta1"
+)
+
+func TestPlatformAdminConvertFrom(t *testing.T) {
+	cases := map[string]struct {
+		src            *v1beta1.PlatformAdmin
+		wantErr        bool
+		wantPoolName   string
+		wantAdditional []string
+	}{
+		"multiple nodepools with nil annotations": {
+			src: &v1beta1.PlatformAdmin{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "sample",
+				},
+				Spec: v1beta1.PlatformAdminSpec{
+					NodePools: []string{"nodepool-a", "nodepool-b", "nodepool-c"},
+				},
+			},
+			wantErr:        false,
+			wantPoolName:   "nodepool-a",
+			wantAdditional: []string{"nodepool-b", "nodepool-c"},
+		},
+		"multiple nodepools with existing annotations": {
+			src: &v1beta1.PlatformAdmin{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "sample",
+					Annotations: map[string]string{
+						"existing": "value",
+					},
+				},
+				Spec: v1beta1.PlatformAdminSpec{
+					NodePools: []string{"nodepool-a", "nodepool-b"},
+				},
+			},
+			wantErr:        false,
+			wantPoolName:   "nodepool-a",
+			wantAdditional: []string{"nodepool-b"},
+		},
+		"single nodepool with nil annotations": {
+			src: &v1beta1.PlatformAdmin{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "sample",
+				},
+				Spec: v1beta1.PlatformAdminSpec{
+					NodePools: []string{"nodepool-a"},
+				},
+			},
+			wantErr:      false,
+			wantPoolName: "nodepool-a",
+		},
+	}
+
+	for name, tc := range cases {
+		t.Run(name, func(t *testing.T) {
+			dst := &PlatformAdmin{}
+			err := dst.ConvertFrom(tc.src)
+			if tc.wantErr {
+				if err == nil {
+					t.Fatalf("expected error, got nil")
+				}
+				return
+			}
+			if err != nil {
+				t.Fatalf("unexpected error: %v", err)
+			}
+
+			if dst.Spec.PoolName != tc.wantPoolName {
+				t.Errorf("PoolName = %q, want %q", dst.Spec.PoolName, tc.wantPoolName)
+			}
+
+			if len(tc.wantAdditional) == 0 {
+				return
+			}
+
+			raw, ok := dst.Annotations["AdditionalNodepools"]
+			if !ok {
+				t.Fatalf("expected AdditionalNodepools annotation to be set")
+			}
+
+			var got []string
+			if err := json.Unmarshal([]byte(raw), &got); err != nil {
+				t.Fatalf("failed to unmarshal AdditionalNodepools annotation: %v", err)
+			}
+
+			if len(got) != len(tc.wantAdditional) {
+				t.Fatalf("AdditionalNodepools = %v, want %v", got, tc.wantAdditional)
+			}
+			for i := range got {
+				if got[i] != tc.wantAdditional[i] {
+					t.Errorf("AdditionalNodepools[%d] = %q, want %q", i, got[i], tc.wantAdditional[i])
+				}
+			}
+		})
+	}
+}
```

---

### Incident Patch 8: `661d3fd7` (2026-09-16)
**Commit Message**: fix(yurtmanager): initialize node.Labels before setting nodepool label in node mutating webhook (#2681)

* fix(yurtmanager): prevent ValidateUpdate and ValidateDelete from re-validating oldObj in gateway v1alpha1 webhook

ValidateUpdate should only validate the incoming new object, and ValidateDelete
should allow deletion without running business-logic validation checks.

Fixes #2648

* fix(yurtmanager): initialize node.Labels before setting nodepool label in node mutating webhook

In node Default() mutating webhook, when falling back to apps.DesiredNodePoolLabel,
node.Labels was accessed before verifying if the map was nil. If node.Labels is nil,
writing into it causes a runtime panic (assignment to entry in nil map).

This fix ensures node.Labels is initialized before setting the nodepool label.

Fixes #2680

**File**: `pkg/yurtmanager/webhook/node/v1/node_default.go` (modified, +3/-0)
```diff
@@ -41,6 +41,9 @@ func (webhook *NodeHandler) Default(ctx context.Context, obj runtime.Object) err
 	if len(npName) == 0 {
 		npName = node.Labels[apps.DesiredNodePoolLabel]
 		if len(npName) != 0 {
+			if node.Labels == nil {
+				node.Labels = make(map[string]string)
+			}
 			node.Labels[projectinfo.GetNodePoolLabel()] = npName
 		} else {
 			return nil
```

**File**: `pkg/yurtmanager/webhook/node/v1/node_default_test.go` (modified, +21/-0)
```diff
@@ -31,6 +31,7 @@ import (
 	fakeclient "sigs.k8s.io/controller-runtime/pkg/client/fake"
 
 	"github.com/openyurtio/openyurt/pkg/apis"
+	"github.com/openyurtio/openyurt/pkg/apis/apps"
 	appsv1beta2 "github.com/openyurtio/openyurt/pkg/apis/apps/v1beta2"
 	"github.com/openyurtio/openyurt/pkg/projectinfo"
 )
@@ -82,6 +83,26 @@ func TestDefault(t *testing.T) {
 			},
 			errCode: 0,
 		},
+		"add labels for node with desired nodepool label": {
+			node: &corev1.Node{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "foo",
+					Labels: map[string]string{
+						apps.DesiredNodePoolLabel: "beijing",
+					},
+				},
+			},
+			pool: &appsv1beta2.NodePool{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "beijing",
+				},
+				Spec: appsv1beta2.NodePoolSpec{
+					Type:        appsv1beta2.Edge,
+					HostNetwork: true,
+				},
+			},
+			errCode: 0,
+		},
 	}
 
 	for k, tc := range testcases {
```

---

### Incident Patch 9: `e87f887a` (2026-09-16)
**Commit Message**: Bugfix: use EventsV1 API in gcEvents for events.k8s.io/v1 cache verification (#2677)

Signed-off-by: Jay2006sawant <jay242902@gmail.com>

**File**: `pkg/yurthub/gc/gc.go` (modified, +27/-4)
```diff
@@ -207,13 +207,14 @@ func (m *GCManager) gcEvents(kubeClient clientset.Interface, component string) {
 			continue
 		}
 
-		_, err := kubeClient.CoreV1().Events(ns).Get(context.Background(), name, metav1.GetOptions{})
-		if apierrors.IsNotFound(err) {
-			deletedEvents = append(deletedEvents, key)
-		} else if err != nil {
+		exists, err := eventExistsOnAPIServer(kubeClient, ns, name)
+		if err != nil {
 			klog.Errorf("could not get %s %s event for node(%s), %v", component, key.Key(), m.nodeName, err)
 			break
 		}
+		if !exists {
+			deletedEvents = append(deletedEvents, key)
+		}
 	}
 
 	for _, key := range deletedEvents {
@@ -224,3 +225,25 @@ func (m *GCManager) gcEvents(kubeClient clientset.Interface, component string) {
 		}
 	}
 }
+
+// eventExistsOnAPIServer checks whether an event still exists on the apiserver.
+// Cached events use events.k8s.io/v1, so EventsV1 is checked first with a CoreV1 fallback
+// for older clusters that only serve core/v1 Events.
+func eventExistsOnAPIServer(kubeClient clientset.Interface, ns, name string) (bool, error) {
+	_, err := kubeClient.EventsV1().Events(ns).Get(context.Background(), name, metav1.GetOptions{})
+	if err == nil {
+		return true, nil
+	}
+	if !apierrors.IsNotFound(err) {
+		return false, err
+	}
+
+	_, err = kubeClient.CoreV1().Events(ns).Get(context.Background(), name, metav1.GetOptions{})
+	if err == nil {
+		return true, nil
+	}
+	if apierrors.IsNotFound(err) {
+		return false, nil
+	}
+	return false, err
+}
```

**File**: `pkg/yurthub/gc/gc_test.go` (modified, +261/-0)
```diff
@@ -17,13 +17,18 @@ limitations under the License.
 package gc
 
 import (
+	"context"
+	"fmt"
 	"net/url"
 	"os"
 	"path/filepath"
 	"testing"
+	"time"
 
 	v1 "k8s.io/api/core/v1"
+	eventsv1 "k8s.io/api/events/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/kubernetes/fake"
@@ -35,6 +40,8 @@ import (
 	"github.com/openyurtio/openyurt/pkg/yurthub/transport"
 )
 
+const testEventName = "test-event.abc123"
+
 type testKey string
 
 func (k testKey) Key() string {
@@ -52,6 +59,260 @@ func (s *storeWithFixedKeys) ListResourceKeysOfComponent(_ string, _ schema.Grou
 	return s.keys, nil
 }
 
+func newTestGCManager(t *testing.T) (*GCManager, cachemanager.StorageWrapper, func()) {
+	t.Helper()
+
+	dir := fmt.Sprintf("/tmp/yurthub-gc-test-%d", time.Now().UnixNano())
+	dStorage, err := disk.NewDiskStorage(dir)
+	if err != nil {
+		t.Fatalf("failed to create disk storage: %v", err)
+	}
+	sWrapper := cachemanager.NewStorageWrapper(dStorage)
+	mgr := &GCManager{
+		store:    sWrapper,
+		nodeName: "test-node",
+	}
+	return mgr, sWrapper, func() { _ = os.RemoveAll(dir) }
+}
+
+func cacheEventsV1Event(t *testing.T, sWrapper cachemanager.StorageWrapper, component, eventName string, obj *eventsv1.Event) storage.Key {
+	t.Helper()
+
+	eventKey, err := sWrapper.KeyFunc(storage.KeyBuildInfo{
+		Component: component,
+		Resources: "events",
+		Namespace: "default",
+		Name:      eventName,
+		Group:     "events.k8s.io",
+		Version:   "v1",
+	})
+	if err != nil {
+		t.Fatalf("failed to build event key: %v", err)
+	}
+	if err := sWrapper.Create(eventKey, obj); err != nil {
+		t.Fatalf("failed to create cached event: %v", err)
+	}
+	return eventKey
+}
+
+func newEventsV1Event(eventName string) *eventsv1.Event {
+	return &eventsv1.Event{
+		TypeMeta: metav1.TypeMeta{
+			APIVersion: "events.k8s.io/v1",
+			Kind:       "Event",
+		},
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      eventName,
+			Namespace: "default",
+		},
+		EventTime:           metav1.NowMicro(),
+		ReportingController: "kubelet",
+		ReportingInstance:   "test-node",
+		Action:              "Started",
+		Reason:              "Started",
+		Regarding: v1.ObjectReference{
+			Kind: "Pod",
+			Name: "mypod",
+		},
+	}
+}
+
+func newCoreV1Event(eventName string) *v1.Event {
+	return &v1.Event{
+		TypeMeta: metav1.TypeMeta{
+			APIVersion: "v1",
+			Kind:       "Event",
+		},
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      eventName,
+			Namespace: "default",
+		},
+		Reason:  "Started",
+		Message: "started",
+		InvolvedObject: v1.ObjectReference{
+			Kind: "Pod",
+			Name: "mypod",
+		},
+	}
+}
+
+func listCachedEventKeys(t *testing.T, sWrapper cachemanager.StorageWrapper, component string) []storage.Key {
+	t.Helper()
+
+	keys, err := sWrapper.ListResourceKeysOfComponent(component, schema.GroupVersionResource{
+		Group:    "events.k8s.io",
+		Version:  "v1",
+		Resource: "events",
+	})
+	if err != nil {
+		t.Fatalf("failed to list cached event keys: %v", err)
+	}
+	return keys
+}
+
+func TestEventExistsOnAPIServer(t *testing.T) {
+	eventName := testEventName
+	eventsV1Obj := newEventsV1Event(eventName)
+	coreV1Obj := newCoreV1Event(eventName)
+
+	tests := []struct {
+		name    string
+		objects []runtime.Object
+		want    bool
+		wantErr bool
+	}{
+		{
+			name:    "event exists in EventsV1",
+			objects: []runtime.Object{eventsV1Obj},
+			want:    true,
+		},
+		{
+			name:    "event exists only in CoreV1",
+			objects: []runtime.Object{coreV1Obj},
+			want:    true,
+		},
+		{
+			name:    "event missing from both APIs",
+			objects: nil,
+			want:    false,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			kubeClient := fake.NewSimpleClientset(tt.objects...)
+			got, err := eventExistsOnAPIServer(kubeClient, "default", eventName)
+			if (err != nil) != tt.wantErr {
+				t.Fatalf("eventExistsOnAPIServer() error = %v,
```

---

### Incident Patch 10: `3cc4b05d` (2026-09-16)
**Commit Message**: fix: log correct expired revision name instead of current revision in cleanRevisions error path (#2665)

* fix: log correct expired revision name instead of current revision in cleanRevisions error path

* test: add coverage for cleanRevisions delete-failure error path

**File**: `pkg/yurtmanager/controller/yurtappset/revision.go` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ func cleanRevisions(cli client.Client, yas *appsbetav1.YurtAppSet, revisions []*
 				continue
 			}
 			if err := cli.Delete(context.TODO(), revisions[i]); err != nil {
-				klog.Errorf("YurtAppSet [%s/%s] delete expired revision %s error: %v", yas.GetNamespace(), yas.GetName(), yas.Status.CurrentRevision, err)
+				klog.Errorf("YurtAppSet [%s/%s] delete expired revision %s error: %v", yas.GetNamespace(), yas.GetName(), revisions[i].GetName(), err)
 				return err
 			}
 			klog.Infof("YurtAppSet [%s/%s] delete expired revision %s", yas.GetNamespace(), yas.GetName(), revisions[i].Name)
```

**File**: `pkg/yurtmanager/controller/yurtappset/revision_test.go` (modified, +35/-1)
```diff
@@ -17,6 +17,8 @@ limitations under the License.
 package yurtappset
 
 import (
+	"context"
+	"fmt"
 	"reflect"
 	"testing"
 
@@ -414,6 +416,14 @@ func TestCreateControllerRevision(t *testing.T) {
 
 }
 
+type errorOnDeleteClient struct {
+	client.Client
+}
+
+func (e *errorOnDeleteClient) Delete(ctx context.Context, obj client.Object, opts ...client.DeleteOption) error {
+	return fmt.Errorf("simulated delete failure")
+}
+
 func TestCleanRevisions(t *testing.T) {
 
 	itemRevisionHistoryLimit := int32(0)
@@ -462,12 +472,36 @@ func TestCleanRevisions(t *testing.T) {
 				cr2.DeepCopy(),
 			).Build(),
 		},
+		{
+			name: "clean fails when delete errors",
+			yas: &beta1.YurtAppSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:      "test-yurtappset",
+					Namespace: "default",
+				},
+				Spec: beta1.YurtAppSetSpec{
+					RevisionHistoryLimit: &itemRevisionHistoryLimit,
+				},
+			},
+			revisions: []*apps.ControllerRevision{
+				cr1.DeepCopy(), cr2.DeepCopy(),
+			},
+			err: true,
+			cli: &errorOnDeleteClient{
+				Client: fake.NewClientBuilder().WithScheme(fakeScheme).WithObjects(
+					cr1.DeepCopy(),
+					cr2.DeepCopy(),
+				).Build(),
+			},
+		},
 	}
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			err := cleanRevisions(tt.cli, tt.yas, tt.revisions)
-			if !tt.err {
+			if tt.err {
+				assert.Error(t, err)
+			} else {
 				assert.NoError(t, err)
 			}
 		})
```

#### Recent Merged Pull Requests:
- **PR #2817** (closed): build(deps): bump github/codeql-action from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #2816** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.2 (@dependabot[bot])
- **PR #2803** (2026-09-16): build(deps): bump github/codeql-action from 4.37.4 to 4.38.0 (@dependabot[bot])
- **PR #2799** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.1 (@dependabot[bot])
- **PR #2798** (2026-09-16): build(deps): bump google.golang.org/grpc from 1.79.3 to 1.83.1 (@dependabot[bot])
- **PR #2796** (closed): build(deps): bump github/codeql-action from 4.37.4 to 4.37.9 (@dependabot[bot])
- **PR #2795** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.0 (@dependabot[bot])
- **PR #2766** (closed): build(deps): bump github/codeql-action from 4.37.4 to 4.37.8 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
