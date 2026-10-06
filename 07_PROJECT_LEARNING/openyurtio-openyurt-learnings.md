# Forensic Learning Record (Deep Inspection): openyurtio/openyurt

> **Canonical Artifact**: `07_PROJECT_LEARNING/openyurtio-openyurt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openyurtio/openyurt](https://github.com/openyurtio/openyurt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:47:27.731Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openyurtio/openyurt`
- **Description**: OpenYurt - Extending your native Kubernetes to edge(project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2002 stars

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

func preflightCheck(mgr ctrl.Manager, opts *options.YurtIoTDockOptions) error {
	client, err := kubernetes.NewForConfig(mgr.GetConfig())
	if err != nil {
		return err
	}
	if _, err := client.CoreV1().Namespaces().Get(context.TODO(), opts.Namespace, metav1.GetOptions{}); err != nil {
		return err
	}
	return nil
}

```

### Core Architecture Module: `cmd/yurt-manager/app/options/nodelifecyclecontroller.go`
```
/*
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

package options

import (
	"fmt"
	"time"

	"github.com/spf13/pflag"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-controller-manager/config/v1alpha1"

	"github.com/openyurtio/openyurt/cmd/yurt-manager/names"
)

// NodeLifecycleControllerOptions holds the NodeLifecycleController options.
type NodeLifecycleControllerOptions struct {
	*v1alpha1.NodeLifecycleControllerConfiguration
}

func NewNodeLifecycleControllerOptions() *NodeLifecycleControllerOptions {
	return &NodeLifecycleControllerOptions{
		NodeLifecycleControllerConfiguration: &v1alpha1.NodeLifecycleControllerConfiguration{
			PodEvictionTimeout:     metav1.Duration{Duration: 5 * time.Minute},
			NodeMonitorGracePeriod: metav1.Duration{Duration: 40 * time.Second},
			NodeStartupGracePeriod: metav1.Duration{Duration: 60 * time.Second},
		},
	}
}

// AddFlags adds flags related to NodeLifecycleController for controller manager to the specified FlagSet.
func (o *NodeLifecycleControllerOptions) AddFlags(fs *pflag.FlagSet) {
	if o == nil {
		return
	}

	fs.DurationVar(&o.NodeStartupGracePeriod.Duration, "node-startup-grace-period", o.NodeStartupGracePeriod.Duration,
		"Amount of time which we allow starting Node to be unresponsive before marking it unhealthy.")
	fs.DurationVar(&o.NodeMonitorGracePeriod.Duration, "node-monitor-grace-period", o.NodeMonitorGracePeriod.Duration,
		"Amount of time which we allow running Node to be unresponsive before marking it unhealthy. "+
			"Must be N times more than kubelet's nodeStatusUpdateFrequency, "+
			"where N means number of retries allowed for kubelet to post node status.")
	fs.Float32Var(&o.NodeEvictionRate, "node-eviction-rate", 0.1, "Number of nodes per second on which pods are deleted in case of node failure when a zone is healthy (see --unhealthy-zone-threshold for definition of healthy/unhealthy). Zone refers to entire cluster in non-multizone clusters.")
	fs.Float32Var(&o.SecondaryNodeEvictionRate, "secondary-node-eviction-rate", 0.01, "Number of nodes per second on which pods are deleted in case of node failure when a zone is unhealthy (see --unhealthy-zone-threshold for definition of healthy/unhealthy). Zone refers to entire cluster in non-multizone clusters. This value is implicitly overridden to 0 if the cluster size is smaller than --large-cluster-size-threshold.")
	fs.Int32Var(&o.LargeClusterSizeThreshold, "large-cluster-size-threshold", 50, fmt.Sprintf("Number of nodes from which %s treats the cluster as large for the eviction logic purposes. --secondary-node-eviction-rate is implicitly overridden to 0 for clusters this size or smaller.", names.NodeLifeCycleController))
	fs.Float32Var(&o.UnhealthyZoneThreshold, "unhealthy-zone-threshold", 0.55, "Fraction of Nodes in a zone which needs to be not Ready (minimum 3) for zone to be treated as unhealthy. ")
}

// ApplyTo fills up NodeLifecycleController config with options.
func (o *NodeLifecycleControllerOptions) ApplyTo(cfg *v1alpha1.NodeLifecycleControllerConfiguration) error {
	if o == nil {
		return nil
	}

	cfg.NodeStartupGracePeriod = o.NodeStartupGracePeriod
	cfg.NodeMonitorGracePeriod = o.NodeMonitorGracePeriod
	cfg.NodeEvictionRate = o.NodeEvictionRate
	cfg.SecondaryNodeEvictionRate = o.SecondaryNodeEvictionRate
	cfg.LargeClusterSizeThreshold = o.LargeClusterSizeThreshold
	cfg.UnhealthyZoneThreshold = o.UnhealthyZoneThreshold

	return nil
}

// Validate checks validation of NodeLifecycleControllerOptions.
func (o *NodeLifecycleControllerOptions) Validate() []error {
	if o == nil {
		return nil
	}

	errs := []error{}
	return errs
}

```

### Core Architecture Module: `pkg/node-servant/components/util.go`
```
/*
Copyright 2021 The OpenYurt Authors.

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

package components

import (
	"os"
)

const (
	KubeletSvcEnv           = "KUBELET_SVC"
	KubeletSvcPathSystemUsr = "/usr/lib/systemd/system/kubelet.service.d/10-kubeadm.conf"
	KubelerSvcPathSystemEtc = "/etc/systemd/system/kubelet.service.d/10-kubeadm.conf"
)

func GetDefaultKubeadmConfPath() []string {
	kubeadmConfPath := []string{}
	path := os.Getenv(KubeletSvcEnv)
	if path != "" && path != KubeletSvcPathSystemUsr && path != KubelerSvcPathSystemEtc {
		kubeadmConfPath = append(kubeadmConfPath, path)
	}
	kubeadmConfPath = append(kubeadmConfPath, KubeletSvcPathSystemUsr, KubelerSvcPathSystemEtc)
	return kubeadmConfPath
}

```

### Core Architecture Module: `pkg/node-servant/static-pod-upgrade/util/pods.go`
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

package util

import (
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"time"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
)

const (
	YurtHubAddress = "http://127.0.0.1:10267"
	YurtHubAPIPath = "/pods"
)

func GetPodFromYurtHub(namespace, name string) (*v1.Pod, error) {
	podList, err := GetPodsFromYurtHub(YurtHubAddress + YurtHubAPIPath)
	if err != nil {
		return nil, err
	}

	for i, pod := range podList.Items {
		if pod.Namespace == namespace && pod.Name == name {
			return &podList.Items[i], nil
		}
	}

	return nil, fmt.Errorf("could not find pod %s/%s", namespace, name)
}

func GetPodsFromYurtHub(url string) (*v1.PodList, error) {
	data, err := getPodsDataFromYurtHub(url)
	if err != nil {
		return nil, err
	}

	podList, err := decodePods(data)
	if err != nil {
		return nil, err
	}

	return podList, nil
}

func getPodsDataFromYurtHub(url string) ([]byte, error) {
	// avoid accessing conflict
	time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("could not access yurthub pods API, returned status: %v", resp.Status)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func decodePods(data []byte) (*v1.PodList, error) {
	codecFactory := serializer.NewCodecFactory(runtime.NewScheme())
	codec := codecFactory.LegacyCodec(schema.GroupVersion{Group: v1.GroupName, Version: "v1"})

	podList := new(v1.PodList)
	if _, _, err := codec.Decode(data, nil, podList); err != nil {
		return nil, fmt.Errorf("could not decode pod list: %s", err)
	}
	return podList, nil
}

```

### Core Architecture Module: `pkg/node-servant/static-pod-upgrade/util/util.go`
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

package util

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	v1 "k8s.io/api/core/v1"
	"k8s.io/klog/v2"
)

const (
	YamlSuffix    string = ".yaml"
	BackupSuffix         = ".bak"
	UpgradeSuffix string = ".upgrade"

	StaticPodHashAnnotation = "openyurt.io/static-pod-hash"
)

func WithYamlSuffix(path string) string {
	return path + YamlSuffix
}

func WithBackupSuffix(path string) string {
	return path + BackupSuffix
}

func WithUpgradeSuffix(path string) string {
	return path + UpgradeSuffix
}

// CopyFile copy file content from src to dst, if destination file not exist, then create it
func CopyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0666)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}
	return nil
}

// WaitForPodRunning waits static pod to run
// Success: Static pod annotation `StaticPodHashAnnotation` value equals to function argument hash
// Failed: Receive PodFailed event
func WaitForPodRunning(namespace, name, hash string, timeout time.Duration) (bool, error) {
	klog.Infof("WaitForPodRunning namespace is %s, name is %s", namespace, name)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	checkPod := func(pod *v1.Pod) (hasResult, result bool) {
		h := pod.Annotations[StaticPodHashAnnotation]
		if pod.Status.Phase == v1.PodRunning && h == hash {
			return true, true
		}

		if pod.Status.Phase == v1.PodFailed {
			return true, false
		}

		return false, false
	}

	for {
		select {
		case <-ctx.Done():
			return false, fmt.Errorf("timeout waiting for static pod %s/%s to be running", namespace, name)
		case <-ticker.C:
			pod, err := GetPodFromYurtHub(namespace, name)
			if err != nil {
				klog.V(4).Infof("Temporarily fail to get pod from YurtHub, %v", err)
			}
			if pod != nil {
				hasResult, result := checkPod(pod)
				if hasResult {
					return result, nil
				}
			}
		}
	}
}

```

### Core Architecture Module: `pkg/util/certmanager/factory/factory.go`
```
/*
Copyright 2022 The OpenYurt Authors.

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

package factory

import (
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"fmt"
	"net"

	certificatesv1 "k8s.io/api/certificates/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/certificate"
	"k8s.io/klog/v2"

	"github.com/openyurtio/openyurt/pkg/util"
	"github.com/openyurtio/openyurt/pkg/util/certmanager/store"
)

type IPGetter func() ([]net.IP, error)
type DNSGetter func() ([]string, error)

// CertManagerConfig specifies the attributes of the created CertManager
type CertManagerConfig struct {
	// ComponentName represents the name of the component which will use this CertManager.
	ComponentName string
	// CommonName is CN of cert.
	CommonName string
	// CertDir represents the dir of local file system where the cert related files will be stored.
	CertDir string
	// Organizations is O of cert.
	Organizations []string
	// DNSNames contain a list of DNS names this component will use.
	// Note:
	// If DNSGetter is set and it can get dns names with no error returned,
	// DNSNames will be ignored and what got from DNSGetter will be used.
	DNSNames []string
	// DNSGetter can get dns names at runtime. If no error returned when getting dns names,
	// these dns names will be used in the cert instead of the DNSNames.
	DNSGetter
	// IPs contain a list of IP this component will use.
	// Note:
	// If IPGetter is set and it can get ips with no error returned,
	// IPs will be ignored and what got from IPGetter will be used.
	IPs []net.IP
	// IPGetter can get ips at runtime. If no error returned when getting ips,
	// these ips will be used in the cert instead of the IPs.
	IPGetter
	// SignerName can specified the signer of Kubernetes, which can be one of
	// 1. "kubernetes.io/kube-apiserver-client"
	// 2. "kubernetes.io/kube-apiserver-client-kubelet"
	// 3. "kubernetes.io/kubelet-serving"
	// More details can be found at k8s.io/api/certificates/v1
	SignerName string
	// ForServerUsage indicates the usage of this cert.
	// If set, UsageServerAuth will be used, otherwise UsageClientAuth will be used.
	// Additionally, UsageKeyEncipherment and UsageDigitalSignature are always used.
	ForServerUsage bool
}

// CertManagerFactory knows how to create CertManager for OpenYurt Components.
type CertManagerFactory interface {
	// New function will create the CertManager as what CertManagerConfig specified.
	New(*CertManagerConfig) (certificate.Manager, error)
}

type factory struct {
	clientsetFn certificate.ClientsetFunc
	fileStore   certificate.FileStore
}

func NewCertManagerFactory(clientSet kubernetes.Interface) CertManagerFactory {
	return &factory{
		clientsetFn: func(current *tls.Certificate) (kubernetes.Interface, error) {
			return clientSet, nil
		},
	}
}

func NewCertManagerFactoryWithFnAndStore(clientsetFn certificate.ClientsetFunc, store certificate.FileStore) CertManagerFactory {
	return &factory{
		clientsetFn: clientsetFn,
		fileStore:   store,
	}
}

func (f *factory) New(cfg *CertManagerConfig) (certificate.Manager, error) {
	var err error
	if util.IsNil(f.fileStore) {
		f.fileStore, err = store.NewFileStoreWrapper(cfg.ComponentName, cfg.CertDir, cfg.CertDir, "", "")
		if err != nil {
			return nil, fmt.Errorf("could not initialize the server certificate store: %w", err)
		}
	}

	ips, dnsNames := cfg.IPs, cfg.DNSNames
	getTemplate := func() *x509.CertificateRequest {
		if cfg.IPGetter != nil {
			newIPs, err := cfg.IPGetter()
			if err == nil && len(newIPs) != 0 {
				klog.V(4).Infof("cr template of %s uses ips=%#+v", cfg.ComponentName, newIPs)
				ips = newIPs
			}
			if err != nil {
				klog.Errorf("could not get ips for %s when preparing cr template, %v", cfg.ComponentName, err)
				return nil
			}
		}
		if cfg.DNSGetter != nil {
			newDNSNames, err := cfg.DNSGetter()
			if err == nil && len(newDNSNames) != 0 {
				klog.V(4).Infof("cr template of %s uses dns names=%#+v", cfg.ComponentName, newDNSNames)
				dnsNames = newDNSNames
			}
			if err != nil {
				klog.Errorf("could not get dns names for %s when preparing cr template, %v", cfg.ComponentName, err)
				return nil
			}
		}
		return &x509.CertificateRequest{
			Subject: pkix.Name{
				CommonName:   cfg.CommonName,
				Organization: cfg.Organizations,
			},
			DNSNames:    dnsNames,
			IPAddresses: ips,
		}
	}

	usages := []certificatesv1.KeyUsage{
		certificatesv1.UsageKeyEncipherment,
		certificatesv1.UsageDigitalSignature,
	}
	if cfg.ForServerUsage {
		usages = append(usages, certificatesv1.UsageServerAuth)
	} else {
		usages = append(usages, certificatesv1.UsageClientAuth)
	}

	return certificate.NewManager(&certificate.Config{
		ClientsetFn:      f.clientsetFn,
		SignerName:       cfg.SignerName,
		GetTemplate:      getTemplate,
		Usages:           usages,
		CertificateStore: f.fileStore,
	})
}

```

### Core Architecture Module: `pkg/util/certmanager/pki.go`
```
/*
Copyright 2020 The OpenYurt Authors.

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

package certmanager

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"os"

	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/certificate"
)

// GenTLSConfigUseCurrentCertAndCertPool generates a TLS configuration
// using the given current certificate and x509 CertPool
func GenTLSConfigUseCurrentCertAndCertPool(
	current func() *tls.Certificate,
	root *x509.CertPool,
	mode string) (*tls.Config, error) {
	tlsConfig := &tls.Config{
		// Can't use SSLv3 because of POODLE and BEAST
		// Can't use TLSv1.0 because of POODLE and BEAST using CBC cipher
		// Can't use TLSv1.1 because of RC4 cipher usage
		MinVersion: tls.VersionTLS12,
	}

	switch mode {
	case "server":
		tlsConfig.ClientCAs = root
		tlsConfig.ClientAuth = tls.VerifyClientCertIfGiven
		if current != nil {
			tlsConfig.GetCertificate = func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
				cert := current()
				if cert == nil {
					return &tls.Certificate{Certificate: nil}, nil
				}
				return cert, nil
			}
		}
	case "client":
		tlsConfig.RootCAs = root
		if current != nil {
			tlsConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
				cert := current()
				if cert == nil {
					return &tls.Certificate{Certificate: nil}, nil
				}
				return cert, nil
			}
		}
	default:
		return nil, fmt.Errorf("unsupported cert manager mode(only server or client), %s", mode)
	}

	return tlsConfig, nil
}

// GenRootCertPool generates a x509 CertPool based on the given kubeconfig,
// if the kubeConfig is empty, it will creates the CertPool using the CA file
func GenRootCertPool(kubeConfig, caFile string) (*x509.CertPool, error) {
	if kubeConfig != "" {
		// kubeconfig is given, generate the clientset based on it
		if _, err := os.Stat(kubeConfig); os.IsNotExist(err) {
			return nil, err
		}

		// load the root ca from the given kubeconfig file
		config, err := clientcmd.LoadFromFile(kubeConfig)
		if err != nil || config == nil {
			return nil, fmt.Errorf("could not load the kubeconfig file(%s), %w",
				kubeConfig, err)
		}

		if len(config.CurrentContext) == 0 {
			return nil, fmt.Errorf("'current context' is not set in %s",
				kubeConfig)
		}

		ctx, ok := config.Contexts[config.CurrentContext]
		if !ok || ctx == nil {
			return nil, fmt.Errorf("'current context(%s)' is not found in %s",
				config.CurrentContext, kubeConfig)
		}

		cluster, ok := config.Clusters[ctx.Cluster]
		if !ok || cluster == nil {
			return nil, fmt.Errorf("'cluster(%s)' is not found in %s",
				ctx.Cluster, kubeConfig)
		}

		if len(cluster.CertificateAuthorityData) == 0 {
			return nil, fmt.Errorf("'certificate authority data of the cluster(%s) is not set in %s",
				ctx.Cluster, kubeConfig)
		}

		rootCertPool := x509.NewCertPool()
		rootCertPool.AppendCertsFromPEM(cluster.CertificateAuthorityData)
		return rootCertPool, nil
	}

	// kubeConfig is missing, generate the cluster root ca based on the given ca file
	return GenCertPoolUseCA(caFile)
}

// GenTLSConfigUseCertMgrAndCA generates a TLS configuration based on the
// given certificate manager and the CA file
func GenTLSConfigUseCertMgrAndCA(
	m certificate.Manager,
	serverAddr, caFile string) (*tls.Config, error) {
	root, err := GenCertPoolUseCA(caFile)
	if err != nil {
		return nil, err
	}

	host, _, err := net.SplitHostPort(serverAddr)
	if err != nil {
		return nil, err
	}

	tlsConfig := &tls.Config{
		// Can't use SSLv3 because of POODLE and BEAST
		// Can't use TLSv1.0 because of POODLE and BEAST using CBC cipher
		// Can't use TLSv1.1 because of RC4 cipher usage
		MinVersion: tls.VersionTLS12,
		ServerName: host,
		RootCAs:    root,
	}

	tlsConfig.GetClientCertificate =
		func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
			cert := m.Current()
			if cert == nil {
				return &tls.Certificate{Certificate: nil}, nil
			}
			return cert, nil
		}
	tlsConfig.GetCertificate =
		func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
			cert := m.Current()
			if cert == nil {
				return &tls.Certificate{Certificate: nil}, nil
			}
			return cert, nil
		}

	return tlsConfig, nil
}

// GenCertPoolUseCA generates a x509 CertPool based on the given CA file
func GenCertPoolUseCA(caFile string) (*x509.CertPool, error) {
	if caFile == "" {
		return nil, errors.New("CA file is not set")
	}

	if _, err := os.Stat(caFile); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("CA file(%s) doesn't exist", caFile)
		}
		return nil, fmt.Errorf("could not stat the CA file(%s): %w", caFile, err)
	}

	caData, err := os.ReadFile(caFile)
	if err != nil {
		return nil, err
	}

	certPool := x509.NewCertPool()
	certPool.AppendCertsFromPEM(caData)
	return certPool, nil
}

// GenCertPoolUseCAData generates a x509 CertPool based on the given CA data
func GenCertPoolUseCAData(caData []byte) (*x509.CertPool, error) {
	certPool := x509.NewCertPool()
	certPool.AppendCertsFromPEM(caData)
	return certPool, nil
}

```

### Core Architecture Module: `pkg/util/certmanager/store/filestore_wrapper.go`
```
/*
Copyright 2021 The OpenYurt Authors.

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

package store

import (
	"crypto/tls"

	"k8s.io/client-go/util/certificate"
	"k8s.io/klog/v2"
)

// fileStoreWrapper is a wrapper for "k8s.io/client-go/util/certificate#FileStore"
// This wrapper increases tolerance for unexpected situations and is more robust.
type fileStoreWrapper struct {
	certificate.FileStore
}

// NewFileStoreWrapper returns a wrapper for "k8s.io/client-go/util/certificate#FileStore"
// This wrapper increases tolerance for unexpected situations and is more robust.
func NewFileStoreWrapper(pairNamePrefix, certDirectory, keyDirectory, certFile, keyFile string) (certificate.FileStore, error) {
	fileStore, err := certificate.NewFileStore(pairNamePrefix, certDirectory, keyDirectory, certFile, keyFile)
	if err != nil {
		return nil, err
	}
	return &fileStoreWrapper{
		FileStore: fileStore,
	}, nil
}

func (s *fileStoreWrapper) Current() (*tls.Certificate, error) {
	cert, err := s.FileStore.Current()
	// If an error occurs, just return the NoCertKeyError.
	// The cert-manager will regenerate the related certificates when it receives the NoCertKeyError.
	if err != nil {
		klog.Warningf("unexpected error occurred when loading the certificate: %v, will regenerate it", err)
		noCertKeyErr := certificate.NoCertKeyError("NO_VALID_CERT")
		return nil, &noCertKeyErr
	}
	return cert, nil
}

```

### Core Architecture Module: `pkg/util/file/file.go`
```
/*
Copyright 2022 The OpenYurt Authors.

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

package file

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	clientsetscheme "k8s.io/client-go/kubernetes/scheme"
)

// FileExists checks if specified file exists.
func FileExists(filename string) (bool, error) {
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return false, nil
	} else if err != nil {
		return false, err
	}
	return true, nil
}

func ReadObjectFromYamlFile(path string) (runtime.Object, error) {
	buf, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read object from yaml file(%s) with error: %v", path, err)
	}

	const mediaType = runtime.ContentTypeYAML
	info, ok := runtime.SerializerInfoForMediaType(clientsetscheme.Codecs.SupportedMediaTypes(), mediaType)
	if !ok {
		return nil, fmt.Errorf("unsupported media type %q", mediaType)
	}

	decoder := clientsetscheme.Codecs.DecoderToVersion(info.Serializer, v1.SchemeGroupVersion)
	return runtime.Decode(decoder, buf)
}

func WriteObjectToYamlFile(obj runtime.Object, path string) error {
	const mediaType = runtime.ContentTypeYAML
	info, ok := runtime.SerializerInfoForMediaType(clientsetscheme.Codecs.SupportedMediaTypes(), mediaType)
	if !ok {
		return fmt.Errorf("unsupported media type %q", mediaType)
	}

	encoder := clientsetscheme.Codecs.EncoderForVersion(info.Serializer, v1.SchemeGroupVersion)
	buf, err := runtime.Encode(encoder, obj)
	if err != nil {
		return fmt.Errorf("failed to encode object, %v", err)
	}

	tmpPath := fmt.Sprintf("%s.tmp", path)
	if err := os.WriteFile(tmpPath, buf, 0600); err != nil {
		return fmt.Errorf("failed to write object into manifest file(%s), %v", tmpPath, err)
	}

	if err := backupFile(path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	if err := os.Remove(path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	// rename tmp path file to path file
	return os.Rename(tmpPath, path)
}

func backupFile(path string) error {
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer src.Close()

	fileName := filepath.Base(path)
	bakFile := filepath.Join("/tmp", fileName)
	dst, err := os.Create(bakFile)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return err
	}

	if err = dst.Sync(); err != nil {
		return err
	}
	return nil
}

```

### Core Architecture Module: `pkg/util/helper/helpers.go`
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
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
)

// Semantic can do semantic deep equality checks for core objects.
// Example: apiequality.Semantic.DeepEqual(aPod, aPodWithNonNilButEmptyMaps) == true
var Semantic = conversion.EqualitiesOrDie(
	func(a, b resource.Quantity) bool {
		// Ignore formatting, only care that numeric value stayed the same.
		// TODO: if we decide it's important, it should be safe to start comparing the format.
		//
		// Uninitialized quantities are equivalent to 0 quantities.
		return a.Cmp(b) == 0
	},
	func(a, b metav1.MicroTime) bool {
		return a.UTC().Equal(b.UTC())
	},
	func(a, b metav1.Time) bool {
		return a.UTC().Equal(b.UTC())
	},
	func(a, b labels.Selector) bool {
		return a.String() == b.String()
	},
	func(a, b fields.Selector) bool {
		return a.String() == b.String()
	},
)

// GetMatchingTolerations returns true and list of Tolerations matching all Taints if all are tolerated, or false otherwise.
func GetMatchingTolerations(taints []v1.Taint, tolerations []v1.Toleration) (bool, []v1.Toleration) {
	if len(taints) == 0 {
		return true, []v1.Toleration{}
	}
	if len(tolerations) == 0 && len(taints) > 0 {
		return false, []v1.Toleration{}
	}
	result := []v1.Toleration{}
	for i := range taints {
		tolerated := false
		for j := range tolerations {
			if tolerations[j].ToleratesTaint(&taints[i]) {
				result = append(result, tolerations[j])
				tolerated = true
				break
			}
		}
		if !tolerated {
			return false, []v1.Toleration{}
		}
	}
	return true, result
}

```

### Core Architecture Module: `pkg/util/ip/ip.go`
```
/*
Copyright 2021 The OpenYurt Authors.

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

package ip

import (
	"net"
	"strings"

	"k8s.io/klog/v2"
	utilnet "k8s.io/utils/net"
)

const (
	DefaultLoopbackIP4 = "127.0.0.1"
	DefaultLoopbackIP6 = "::1"
)

// MustGetLoopbackIP is a wrapper for GetLoopbackIP. If any error occurs or loopback interface is not found,
// will fall back to 127.0.0.1 for ipv4 or ::1 for ipv6.
func MustGetLoopbackIP(wantIPv6 bool) string {
	ip, err := GetLoopbackIP(wantIPv6)
	if err != nil {
		klog.Errorf("failed to get loopback addr: %v", err)
	}
	if ip != "" {
		return ip
	}
	if wantIPv6 {
		return DefaultLoopbackIP6
	}
	return DefaultLoopbackIP4
}

// GetLoopbackIP returns the ip address of local loopback interface.
func GetLoopbackIP(wantIPv6 bool) (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && ipnet.IP.IsLoopback() && wantIPv6 == utilnet.IsIPv6(ipnet.IP) {
			return ipnet.IP.String(), nil
		}
	}
	return "", nil
}

func JoinIPStrings(ips []net.IP) string {
	var strs []string
	for _, ip := range ips {
		strs = append(strs, ip.String())
	}
	return strings.Join(strs, ",")
}

// RemoveDupIPs removes duplicate ips from the ip list and returns a new created list
func RemoveDupIPs(ips []net.IP) []net.IP {
	results := make([]net.IP, 0, len(ips))
	temp := map[string]bool{}
	for _, ip := range ips {
		if _, ok := temp[string(ip)]; ip != nil && !ok {
			temp[string(ip)] = true
			results = append(results, ip)
		}
	}
	return results
}

// Parse a list of IP Strings to net.IP type
func ParseIPList(ips []string) []net.IP {
	results := make([]net.IP, len(ips))
	for idx, ip := range ips {
		results[idx] = net.ParseIP(ip)
	}
	return results
}

// searchIP returns true if ip is in ipList
func SearchIP(ipList []net.IP, ip net.IP) bool {
	for _, ipItem := range ipList {
		if ipItem.Equal(ip) {
			return true
		}
	}
	return false
}

// searchAllIP returns true if all ips are in ipList
func SearchAllIP(ipList []net.IP, ips []net.IP) bool {
	for _, ip := range ips {
		if !SearchIP(ipList, ip) {
			return false
		}
	}
	return true
}

```

### Core Architecture Module: `pkg/util/iptables/iptables.go`
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

package iptables

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/util/sets"
	utilversion "k8s.io/apimachinery/pkg/util/version"
	utilwait "k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/klog/v2"
	utilexec "k8s.io/utils/exec"
	utiltrace "k8s.io/utils/trace"
)

// RulePosition holds the -I/-A flags for iptable
type RulePosition string

const (
	// Prepend is the insert flag for iptable
	Prepend RulePosition = "-I"
	// Append is the append flag for iptable
	Append RulePosition = "-A"
)

// Interface is an injectable interface for running iptables commands.  Implementations must be goroutine-safe.
type Interface interface {
	// EnsureChain checks if the specified chain exists and, if not, creates it.  If the chain existed, return true.
	EnsureChain(table Table, chain Chain) (bool, error)
	// FlushChain clears the specified chain.  If the chain did not exist, return error.
	FlushChain(table Table, chain Chain) error
	// DeleteChain deletes the specified chain.  If the chain did not exist, return error.
	DeleteChain(table Table, chain Chain) error
	// ChainExists tests whether the specified chain exists, returning an error if it
	// does not, or if it is unable to check.
	ChainExists(table Table, chain Chain) (bool, error)
	// EnsureRule checks if the specified rule is present and, if not, creates it.  If the rule existed, return true.
	EnsureRule(position RulePosition, table Table, chain Chain, args ...string) (bool, error)
	// DeleteRule checks if the specified rule is present and, if so, deletes it.
	DeleteRule(table Table, chain Chain, args ...string) error
	// IsIPv6 returns true if this is managing ipv6 tables.
	IsIPv6() bool
	// Protocol returns the IP family this instance is managing,
	Protocol() Protocol
	// SaveInto calls `iptables-save` for table and stores result in a given buffer.
	SaveInto(table Table, buffer *bytes.Buffer) error
	// Restore runs `iptables-restore` passing data through []byte.
	// table is the Table to restore
	// data should be formatted like the output of SaveInto()
	// flush sets the presence of the "--noflush" flag. see: FlushFlag
	// counters sets the "--counters" flag. see: RestoreCountersFlag
	Restore(table Table, data []byte, flush FlushFlag, counters RestoreCountersFlag) error
	// RestoreAll is the same as Restore except that no table is specified.
	RestoreAll(data []byte, flush FlushFlag, counters RestoreCountersFlag) error
	// Monitor detects when the given iptables tables have been flushed by an external
	// tool (e.g. a firewall reload) by creating canary chains and polling to see if
	// they have been deleted. (Specifically, it polls tables[0] every interval until
	// the canary has been deleted from there, then waits a short additional time for
	// the canaries to be deleted from the remaining tables as well. You can optimize
	// the polling by listing a relatively empty table in tables[0]). When a flush is
	// detected, this calls the reloadFunc so the caller can reload their own iptables
	// rules. If it is unable to create the canary chains (either initially or after
	// a reload) it will log an error and stop monitoring.
	// (This function should be called from a goroutine.)
	Monitor(canary Chain, tables []Table, reloadFunc func(), interval time.Duration, stopCh <-chan struct{})
	// HasRandomFully reveals whether `-j MASQUERADE` takes the
	// `--random-fully` option.  This is helpful to work around a
	// Linux kernel bug that sometimes causes multiple flows to get
	// mapped to the same IP:PORT and consequently some suffer packet
	// drops.
	HasRandomFully() bool

	// Present checks if the kernel supports the iptable interface
	Present() bool
}

// Protocol defines the ip protocol either ipv4 or ipv6
type Protocol string

const (
	// ProtocolIPv4 represents ipv4 protocol in iptables
	ProtocolIPv4 Protocol = "IPv4"
	// ProtocolIPv6 represents ipv6 protocol in iptables
	ProtocolIPv6 Protocol = "IPv6"
)

// Table represents different iptable like filter,nat, mangle and raw
type Table string

const (
	// TableNAT represents the built-in nat table
	TableNAT Table = "nat"
	// TableFilter represents the built-in filter table
	TableFilter Table = "filter"
	// TableMangle represents the built-in mangle table
	TableMangle Table = "mangle"
)

// Chain represents the different rules
type Chain string

const (
	// ChainPostrouting used for source NAT in nat table
	ChainPostrouting Chain = "POSTROUTING"
	// ChainPrerouting used for DNAT (destination NAT) in nat table
	ChainPrerouting Chain = "PREROUTING"
	// ChainOutput used for the packets going out from local
	ChainOutput Chain = "OUTPUT"
	// ChainInput used for incoming packets
	ChainInput Chain = "INPUT"
	// ChainForward used for the packets for another NIC
	ChainForward Chain = "FORWARD"
)

const (
	cmdIPTablesSave     string = "iptables-save"
	cmdIPTablesRestore  string = "iptables-restore"
	cmdIPTables         string = "iptables"
	cmdIP6TablesRestore string = "ip6tables-restore"
	cmdIP6TablesSave    string = "ip6tables-save"
	cmdIP6Tables        string = "ip6tables"
)

// RestoreCountersFlag is an option flag for Restore
type RestoreCountersFlag bool

// RestoreCounters a boolean true constant for the option flag RestoreCountersFlag
const RestoreCounters RestoreCountersFlag = true

// NoRestoreCounters a boolean false constant for the option flag RestoreCountersFlag
const NoRestoreCounters RestoreCountersFlag = false

// FlushFlag an option flag for Flush
type FlushFlag bool

// FlushTables a boolean true constant for option flag FlushFlag
const FlushTables FlushFlag = true

// NoFlushTables a boolean false constant for option flag FlushFlag
const NoFlushTables FlushFlag = false

// MinCheckVersion minimum version to be checked
// Versions of iptables less than this do not support the -C / --check flag
// (test whether a rule exists).
var MinCheckVersion = utilversion.MustParseGeneric("1.4.11")

// RandomFullyMinVersion is the minimum version from which the --random-fully flag is supported,
// used for port mapping to be fully randomized
var RandomFullyMinVersion = utilversion.MustParseGeneric("1.6.2")

// WaitMinVersion a minimum iptables versions supporting the -w and -w<seconds> flags
var WaitMinVersion = utilversion.MustParseGeneric("1.4.20")

// WaitIntervalMinVersion a minimum iptables versions supporting the wait interval useconds
var WaitIntervalMinVersion = utilversion.MustParseGeneric("1.6.1")

// WaitSecondsMinVersion a minimum iptables versions supporting the wait seconds
var WaitSecondsMinVersion = utilversion.MustParseGeneric("1.4.22")

// WaitRestoreMinVersion a minimum iptables versions supporting the wait restore seconds
var WaitRestoreMinVersion = utilversion.MustParseGeneric("1.6.2")

// WaitString a constant for specifying the wait flag
const WaitString = "-w"

// WaitSecondsValue a constant for specifying the default wait seconds
const WaitSecondsValue = "5"

// WaitIntervalString a constant for specifying the wait interval flag
const WaitIntervalString = "-W"

// WaitIntervalUsecondsValue a constant for specifying the default wait interval useconds
const WaitIntervalUsecondsValue = "100000"

// LockfilePath16x is the iptables 1.6.x lock file acquired by any process that's making any change in the iptable rule
const LockfilePath16x = "/run/xtables.lock"

// LockfilePath14x is the iptables 1.4.x lock file acquired by any process that's making any change in the iptable rule
const LockfilePath14x = "@xtables"

// runner implements Interface in terms of exec("iptables").
type runner struct {
	mu              sync.Mutex
	exec            utilexec.Interface
	protocol        Protocol
	hasCheck        bool
	hasRandomFully  bool
	waitFlag        []string
	restoreWaitFlag []string
	lockfilePath14x string
	lockfilePath16x string
}

// newInternal returns a new Interface which will exec iptables, and allows the
// caller to change the iptables-restore lockfile path
func newInternal(exec utilexec.Interface, protocol Protocol, lockfilePath14x, lockfilePath16x string) Interface {
	version, err := getIPTablesVersion(exec, protocol)
	if err != nil {
		klog.InfoS("Error checking iptables version, assuming version at least", "version", MinCheckVersion, "err", err)
		version = MinCheckVersion
	}

	if lockfilePath16x == "" {
		lockfilePath16x = LockfilePath16x
	}
	if lockfilePath14x == "" {
		lockfilePath14x = LockfilePath14x
	}

	runner := &runner{
		exec:            exec,
		protocol:        protocol,
		hasCheck:        version.AtLeast(MinCheckVersion),
		hasRandomFully:  version.AtLeast(RandomFullyMinVersion),
		waitFlag:        getIPTablesWaitFlag(version),
		restoreWaitFlag: getIPTablesRestoreWaitFlag(version, exec, protocol),
		lockfilePath14x: lockfilePath14x,
		lockfilePath16x: lockfilePath16x,
	}
	return runner
}

// New returns a new Interface which will exec iptables.
func New(exec utilexec.Interface, protocol Protocol) Interface {
	return newInternal(exec, protocol, "", "")
}

// EnsureChain is part of Interface.
func (runner *runner) EnsureChain(table Table, chain Chain) (bool, error) {
	fullArgs := makeFullArgs(table, chain)

	runner.mu.Lock()
	defer runner.mu.Unlock()

	out, err := runner.run(opCreateChain, fullArgs)
	if err != nil {
		if ee, ok := err.(utilexec.ExitError); ok {
			if ee.Exited() && ee.ExitStatus() == 1 {
				return true, nil
			}
		}
		return false, fmt.Errorf("er
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2821** (2026-10-05): **build(deps): bump zeebe-io/backport-action from 4.6.0 to 4.6.1**
  *Symptoms*: Bumps [zeebe-io/backport-action](https://github.com/zeebe-io/backport-action) from 4.6.0 to 4.6.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/zeebe-io/backport-action/releases">zeebe-io/backport-action's releases</a>.</em></p> <blockquote> <h2>Backport-action v4.6.1</h2> <h2>What's Changed</h2> <p>Dependency updates only.</p> <h2>Updated dependencies</h2> <ul> <li>Update korthout/backport-action action to v4.6.0 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/670">korthout/backport-action#670</a></li> <li>Update dependency prettier to v3.9.4 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/671">korthout/backport-action#671</a></li> <li>Lock file maintenance by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/676">korthout/backport-action#676</a></li> <li>Update dependency vitest to v4.1.10 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/677">korthout/backport-action#677</a></li> <li>Update dependency <code>@​types/node</code> to v24.13.3 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthou
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2821) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2821&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2821&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2821&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2821?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.59%. Comparing base ([`7833349`](https://app.codecov.io/gh/openyurtio/openyurt/commit/78333496ac530d483545ac3916de2ecb2fab6d01?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`cea08b7`](https://app.codecov.io/gh/openyurtio/openyurt/commit/cea08b7f6610bd8d68b4aae0945248b94661fa16?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #2821   +/-   ## ==========
  > Superseded by #2826.

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

### Incident Patch 1: `78333496` (2026-09-16)
**Commit Message**: build(deps): bump google.golang.org/grpc from 1.79.3 to 1.83.1 (#2798)

Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.79.3 to 1.83.1.
- [Release notes](https://github.com/grpc/grpc-go/releases)
- [Commits](https://github.com/grpc/grpc-go/compare/v1.79.3...v1.83.1)

---
updated-dependencies:
- dependency-name: google.golang.org/grpc
  dependency-version: 1.83.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +11/-11)
```diff
@@ -31,9 +31,9 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/vishvananda/netlink v1.3.1
 	golang.org/x/net v0.56.0
-	golang.org/x/oauth2 v0.34.0
+	golang.org/x/oauth2 v0.36.0
 	golang.org/x/sys v0.46.0
-	google.golang.org/grpc v1.79.3
+	google.golang.org/grpc v1.83.1
 	gopkg.in/cheggaaa/pb.v1 v1.0.28
 	gopkg.in/yaml.v3 v3.0.1
 	k8s.io/api v0.34.0
@@ -72,7 +72,7 @@ require (
 )
 
 require (
-	cel.dev/expr v0.25.1 // indirect
+	cel.dev/expr v0.25.2 // indirect
 	cyphar.com/go-pathrs v0.2.1 // indirect
 	github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161 // indirect
 	github.com/Masterminds/semver/v3 v3.4.0 // indirect
@@ -141,13 +141,13 @@ require (
 	go.etcd.io/etcd/client/v3 v3.6.4 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.60.0 // indirect
-	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.58.0 // indirect
-	go.opentelemetry.io/otel v1.43.0 // indirect
+	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect
+	go.opentelemetry.io/otel v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.34.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.34.0 // indirect
-	go.opentelemetry.io/otel/metric v1.43.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.43.0 // indirect
-	go.opentelemetry.io/otel/trace v1.43.0 // indirect
+	go.opentelemetry.io/otel/metric v1.44.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
+	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.5.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.uber.org/zap v1.27.0 // indirect
@@ -162,9 +162,9 @@ require (
 	golang.org/x/time v0.9.0 // indirect
 	golang.org/x/tools v0.45.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20251202230838-ff82c1b0f217 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20251202230838-ff82c1b0f217 // indirect
-	google.golang.org/protobuf v1.36.10 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.12.0 // indirect
 	gopkg.in/go-jose/go-jose.v2 v2.6.3 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
```

**File**: `go.sum` (modified, +26/-26)
```diff
@@ -1,5 +1,5 @@
-cel.dev/expr v0.25.1 h1:1KrZg61W6TWSxuNZ37Xy49ps13NUovb66QLprthtwi4=
-cel.dev/expr v0.25.1/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
+cel.dev/expr v0.25.2 h1:K6j46C81hXtZQfuX60cVWQFBJahKSE2gfRbNuvr5bFs=
+cel.dev/expr v0.25.2/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
 cloud.google.com/go v0.26.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
 cloud.google.com/go v0.34.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
 cloud.google.com/go v0.38.0/go.mod h1:990N+gfupTy94rShfmMCWGDn0LpTmnzTp2qbd1dvSRU=
@@ -1252,22 +1252,22 @@ go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.60.0 h1:x7wzEgXfnzJcHDwStJT+mxOz4etr2EcexjqhBvmoakw=
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.60.0/go.mod h1:rg+RlpR5dKwaS95IyyZqj5Wd4E13lk/msnTS0Xl9lJM=
-go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.58.0 h1:yd02MEjBdJkG3uabWP9apV+OuWRIXGDuJEUJbOHmCFU=
-go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.58.0/go.mod h1:umTcuxiv1n/s/S6/c2AT/g2CQ7u5C59sHDNmfSwgz7Q=
-go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
-go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
+go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 h1:F7Jx+6hwnZ41NSFTO5q4LYDtJRXBf2PD0rNBkeB/lus=
+go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0/go.mod h1:UHB22Z8QsdRDrnAtX4PntOl36ajSxcdUMt1sF7Y6E7Q=
+go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
+go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.34.0 h1:OeNbIYk/2C15ckl7glBlOBp5+WlYsOElzTNmiPW/x60=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.34.0/go.mod h1:7Bept48yIeqxP2OZ9/AqIpYS94h2or0aB4FypJTc8ZM=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.34.0 h1:tgJ0uaNS4c98WRNUEx5U3aDlrDOI5Rs+1Vifcw4DJ8U=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.34.0/go.mod h1:U7HYyW0zt/a9x5J1Kjs+r1f/d4ZHnYFclhYY2+YbeoE=
-go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
-go.opentelemetry.io/otel/metric v1.43.0/go.mod h1:RDnPtIxvqlgO8GRW18W6Z/4P462ldprJtfxHxyKd2PY=
-go.opentelemetry.io/otel/sdk v1.43.0 h1:pi5mE86i5rTeLXqoF/hhiBtUNcrAGHLKQdhg4h4V9Dg=
-go.opentelemetry.io/otel/sdk v1.43.0/go.mod h1:P+IkVU3iWukmiit/Yf9AWvpyRDlUeBaRg6Y+C58QHzg=
-go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
-go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
-go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
-go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
+go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
+go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
+go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
+go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
+go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
+go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
+go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.opentelemetry.io/proto/otlp v0.7.0/go.mod h1:PqfVotwruBrMGOCsRd/89rSnXhoiJIqeYNgFYFoEGnI=
 go.opentelemetry.io/proto/otlp v0.15.0/go.mod h1:H7XAot3MsfNsj7EXtrA2q5xSNQ10UqI405h3+duxN4U=
 go.opentelemetry.io/proto/otlp v0.19.0/go.mod h1:H7XAot3MsfNsj7EXtrA2q5xSNQ10UqI405h3+duxN4U=
@@ -1461,8 +1461,8 @@ golang.org/x/oauth2 v0.4.0/go.mod h1:RznEsdpjGAINPTOF0UH/t+xJ75L18YO3Ho6Pyn+uRec
 golang.org/x/oauth2 v0.5.0/go.mod h1:9/XBHVqLaWO3/BRHs5jbpYCnOZVjj5V0ndyaAM7KB4I=
 golang.org/x/oauth2 v0.6.0/go.mod h1:ycmewcwgD4Rpr3eZJLSB4Kyyljb3qDh40vJ8STE5HKw=
 golang.org/x/oauth2 v0.7.0/go.mod h1:hPLQkd9LyjfXTiRohC/41GhcFqxisoUQ99sCUOHO9x4=
-golang.org/x/oauth2 v0.34.0 h1:hqK/t4AKgbqWkdkcAeI8XLmbK+4m4G5YeQRrmiotGlw=
-golang.org/x/oauth2 v0.34.0/go.mod h1:lzm5WQJQwKZ3nwavOZ3IS5Aulzxi68dUSgRHujetwEA=
+golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
+golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20180314180146-1d60e4601c6f/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20181108010431-42b317875d0f/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.or
```

---

### Incident Patch 2: `664da631` (2026-09-16)
**Commit Message**: build(deps): bump github/codeql-action from 4.37.4 to 4.38.0 (#2803)

Bumps [github/codeql-action](https://github.com/github/codeql-action) from 4.37.4 to 4.38.0.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/v4.37.4...v4.38.0)

---
updated-dependencies:
- dependency-name: github/codeql-action
  dependency-version: 4.38.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/sonarcloud.yaml` (modified, +1/-1)
```diff
@@ -48,6 +48,6 @@ jobs:
           retention-days: 5
 
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@v4.37.4
+        uses: github/codeql-action/upload-sarif@v4.38.0
         with:
           sarif_file: results.sarif
```

**File**: `.github/workflows/trivy-scan.yml` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ jobs:
           output: 'trivy-results.sarif'
 
       - name: Upload Trivy scan results to GitHub Security
-        uses: github/codeql-action/upload-sarif@v4.37.4
+        uses: github/codeql-action/upload-sarif@v4.38.0
         if: always()
         with:
           sarif_file: 'trivy-results.sarif'
```

---

### Incident Patch 3: `d066363a` (2026-09-16)
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

### Incident Patch 4: `b05a7818` (2026-09-16)
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

### Incident Patch 5: `94a39328` (2026-09-16)
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

### Incident Patch 6: `32f19200` (2026-09-16)
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

### Incident Patch 7: `ddbb268d` (2026-09-16)
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

### Incident Patch 8: `99a82765` (2026-09-16)
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
+	for _, p := range got.Items {
+		gotByName[p.Name] = true
+	}
+	for _, p := range expected.Items {
+		if !gotByName[p.Name] {
+			t.Errorf("Expected pod %s not found in response", p.Name)
+		}
+	}
+}
+
+func TestGetPodList_ListError(t *testing.T) {
+	factory := &mockFactory{
+		core: &mockCore{
+			v1iface: &mockV1Interface{
+				podInformer: &mockPodInformer{
+					lister: &mockPodLister{
+						err: fmt.Errorf("list error"),
+					},
+				},
+			},
+		},
+	}
+
+	handler := getPodList(factory)
+
+	req := httptest.NewRequest(http.MethodGet, "/pods", nil)
+	w := httptest.NewRecorder()
+	handler.ServeHTTP(w, req)
+
+	if w.Code != http.StatusInternalServerError {
+		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, w.Code)
+	}
+
+	if !strings.Contains(w.Body.String(), "Get pods key failed") {
+		t.Errorf("Expected body to contain 'Get pods key failed', got: %s", w.Body.String())
+	}
+}
+
+func TestGetPodList_EncodeError(t *testing.T) {
+	defer func(old func(*corev1.PodList) ([]
```

---

### Incident Patch 9: `7873b0ea` (2026-09-16)
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

### Incident Patch 10: `661d3fd7` (2026-09-16)
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

### Incident Patch 11: `e87f887a` (2026-09-16)
**Commit Message**: Bugfix: use EventsV1 API in gcEvents for events.k8s.io/v1 cache verification (#2677)

Signed-off-by: Jay2006sawant <[REDACTED_EMAIL]>

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
+				t.Fatalf("eventExistsOnAPIServer() error = %v, wantErr %v", err, tt.wantErr)
+			}
+			if got != tt.want {
+				t.Fatalf("eventExistsOnAPIServer() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
+
+func TestGcEventsPreservesEventsV1OnlyEvent(t *testing.T) {
+	mgr, sWrapper, cleanup := newTestGCManager(t)
+	defer cleanup()
+
+	eventObj := newEventsV1Event(testEventName)
+	cacheEventsV1Event(t, sWrapper, "kubelet", testEventName, eventObj)
+
+	kubeClient := fake.NewSimpleClientset(eventObj)
+	if _, err := kubeClient.EventsV1().Events("default").Get(context.Background(), testEventName, metav1.GetOptions{}); err != nil {
+		t.Fatalf("EventsV1 Get should succeed: %v", err)
+	}
+	if _, err := kubeClient.CoreV1().Events("default").Get(context.Background(), testEventName, metav1.GetOptions{}); err == nil {
+		t.Fatal("CoreV1 Get should return NotFound for events.k8s.io-only event")
+	}
+
+	mgr.gcEvents(kubeClient, "kubelet")
+
+	keys := listCachedEventKeys(t, sWrapper, "kubelet")
+	if len(keys) != 1 {
+		t.Fatalf("expected cached event t
```

---

### Incident Patch 12: `3cc4b05d` (2026-09-16)
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

---

### Incident Patch 13: `9b55de80` (2026-09-16)
**Commit Message**: fix: data race on ek.file and ek.count between sync and compress goroutines (#2631)

* fix: serialize ek.file and ek.count access in error_keys

NewErrorKeys starts sync() and compress() goroutines that both access
ek.file and ek.count. processNextOperator wrote these fields with no lock
held, while rewrite closed and reassigned them under a read lock, so the
two goroutines had an unsynchronized path to the same state. compress
also read ek.count and len(ek.keys) with no lock.

Guard ek.file and ek.count with a dedicated fileMu, read the compaction
counters through getCount and length, and move the file swap into swapAOF
under that lock. rewrite keeps the existing read lock for the keys
snapshot, and fileMu is never held across the queue-drain wait, so the
sync goroutine can keep draining while rewrite waits and no deadlock is
introduced.

go test -race ./pkg/yurthub/cachemanager/... now reports zero data races.

Signed-off-by: Deepak Bhagat <[REDACTED_EMAIL]>

* Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

* fix: address review on AOF swap and ticker in error_keys

- Open the swapped AOF with O_APPEND so post-compaction 

**File**: `pkg/yurthub/cachemanager/error_keys.go` (modified, +31/-4)
```diff
@@ -41,6 +41,7 @@ type errorKeys struct {
 	sync.RWMutex
 	keys    map[string]string
 	queue   workqueue.TypedRateLimitingInterface[operation]
+	fileMu  sync.Mutex
 	file    *os.File
 	count   int
 	aofPath string
@@ -135,17 +136,26 @@ func (ek *errorKeys) processNextOperator() bool {
 		klog.Errorf("failed to serialize and persist operation: %v", op)
 		return false
 	}
+	ek.fileMu.Lock()
+	defer ek.fileMu.Unlock()
 	ek.file.Write(append(data, '\n'))
 	ek.file.Sync()
 	ek.count++
 	return true
 }
 
+func (ek *errorKeys) getCount() int {
+	ek.fileMu.Lock()
+	defer ek.fileMu.Unlock()
+	return ek.count
+}
+
 func (ek *errorKeys) compress() {
 	ticker := time.NewTicker(30 * time.Second)
+	defer ticker.Stop()
 	for range ticker.C {
 		if !ek.queue.ShuttingDown() {
-			if ek.count > len(ek.keys)+CompressThresh {
+			if ek.getCount() > ek.length()+CompressThresh {
 				ek.rewrite()
 			}
 		} else {
@@ -192,15 +202,32 @@ func (ek *errorKeys) rewrite() {
 		klog.Errorf("failed to wait for queue to be empty")
 		return
 	}
+	ek.swapAOF(count)
+}
+
+func (ek *errorKeys) swapAOF(count int) {
+	ek.fileMu.Lock()
+	defer ek.fileMu.Unlock()
 	ek.file.Close()
 
-	err = os.Rename(filepath.Join(ek.aofPath, "tmp_aof"), filepath.Join(ek.aofPath, "aof"))
+	aofPath := filepath.Join(ek.aofPath, "aof")
+	err := os.Rename(filepath.Join(ek.aofPath, "tmp_aof"), aofPath)
 	if err != nil {
 		klog.Errorf("failed to rename tmp_aof to aof, %v", err)
+		// Compaction failed: keep serving the unchanged aof and do not update
+		// the count, so ek.count stays in sync with the on-disk file.
+		if file, oerr := os.OpenFile(aofPath, os.O_RDWR|os.O_APPEND, 0644); oerr != nil {
+			klog.ErrorS(oerr, "failed to reopen aof after failed rename", "name", aofPath)
+			metrics.Metrics.SetErrorKeysPersistencyStatus(0)
+			ek.queue.ShutDown()
+		} else {
+			ek.file = file
+		}
+		return
 	}
-	file, err = os.OpenFile(filepath.Join(ek.aofPath, "aof"), os.O_RDWR, 0644)
+	file, err := os.OpenFile(aofPath, os.O_RDWR|os.O_APPEND, 0644)
 	if err != nil {
-		klog.ErrorS(err, "failed to open file", "name", filepath.Join(ek.aofPath, "aof"))
+		klog.ErrorS(err, "failed to open file", "name", aofPath)
 		metrics.Metrics.SetErrorKeysPersistencyStatus(0)
 		ek.queue.ShutDown()
 		return
```

**File**: `pkg/yurthub/cachemanager/error_keys_test.go` (modified, +32/-1)
```diff
@@ -24,6 +24,7 @@ import (
 	"os"
 	"path/filepath"
 	"strings"
+	"sync"
 	"testing"
 	"time"
 
@@ -133,14 +134,44 @@ func TestCompress(t *testing.T) {
 	}
 	err = wait.PollUntilContextTimeout(context.TODO(), time.Second, time.Minute, false,
 		func(ctx context.Context) (bool, error) {
-			if keys.count == 50 {
+			if keys.getCount() == 50 {
 				return true, nil
 			}
 			return false, nil
 		})
 	if err != nil {
 		t.Errorf("failed to sync")
 	}
+	keys.queue.ShutDown()
+}
+
+func TestConcurrentSyncAndRewrite(t *testing.T) {
+	aofPath, err := os.MkdirTemp("", "errorkeys")
+	if err != nil {
+		t.Fatalf("failed to create dir: %v", err)
+	}
+	defer os.RemoveAll(aofPath)
+
+	ek := NewErrorKeys(aofPath)
+	defer ek.queue.ShutDown()
+
+	var wg sync.WaitGroup
+	wg.Add(2)
+	go func() {
+		defer wg.Done()
+		for i := 0; i < 100; i++ {
+			ek.put(fmt.Sprintf("key-%d", i), fmt.Sprintf("value-%d", i))
+			time.Sleep(time.Millisecond)
+		}
+	}()
+	go func() {
+		defer wg.Done()
+		for i := 0; i < 5; i++ {
+			ek.rewrite()
+			time.Sleep(10 * time.Millisecond)
+		}
+	}()
+	wg.Wait()
 }
 
 func TestRecoverCorruptedJSON(t *testing.T) {
```

---

### Incident Patch 14: `835cba4a` (2026-09-16)
**Commit Message**: fix: prevent silent cache corruption when AOF json unmarshal fails (#2634)

* fix: prevent silent cache corruption when AOF json unmarshal fails

Signed-off-by: alokkumardalei-wq <[REDACTED_EMAIL]>

* test: add unit test for corrupted AOF unmarshal error handling

---------

Signed-off-by: alokkumardalei-wq <[REDACTED_EMAIL]>

**File**: `pkg/yurthub/cachemanager/error_keys.go` (modified, +4/-1)
```diff
@@ -225,7 +225,10 @@ func (ek *errorKeys) recover() {
 	for scanner.Scan() {
 		bytes := scanner.Bytes()
 		var operation operation
-		json.Unmarshal(bytes, &operation)
+		if err := json.Unmarshal(bytes, &operation); err != nil {
+			klog.Errorf("failed to unmarshal AOF operation, skipping corrupted entry: %v", err)
+			continue
+		}
 		operations = append(operations, operation)
 	}
 	for _, op := range operations {
```

**File**: `pkg/yurthub/cachemanager/error_keys_test.go` (modified, +37/-0)
```diff
@@ -142,3 +142,40 @@ func TestCompress(t *testing.T) {
 		t.Errorf("failed to sync")
 	}
 }
+
+func TestRecoverCorruptedJSON(t *testing.T) {
+	aofPath, err := os.MkdirTemp("", "errorkeys")
+	if err != nil {
+		t.Errorf("failed to create dir: %v", err)
+	}
+	defer os.RemoveAll(aofPath)
+	file, err := os.OpenFile(filepath.Join(aofPath, "aof"), os.O_CREATE|os.O_RDWR, 0644)
+	if err != nil {
+		t.Errorf("failed to open file: %v", err)
+	}
+	corruptedData := []byte(`{"key":"kubelet", "val":"fail to xxx", "operator":`)
+	file.Write(corruptedData)
+	file.Write([]byte("\n"))
+	op := operation{
+		Key:      "flannel",
+		Val:      "fail to yyy",
+		Operator: PUT,
+	}
+	data, err := json.Marshal(op)
+	if err != nil {
+		t.Errorf("failed to marshal: %v", err)
+	}
+	file.Write(data)
+	file.Write([]byte("\n"))
+	file.Sync()
+	file.Close()
+	ek := NewErrorKeys(aofPath)
+	ek.recover()
+	if _, ok := ek.keys["kubelet"]; ok {
+		t.Errorf("expected corrupted key 'kubelet' to be skipped")
+	}
+	if _, ok := ek.keys["flannel"]; !ok {
+		t.Errorf("expected valid key 'flannel' to be recovered")
+	}
+	ek.queue.ShutDown()
+}
```

---

### Incident Patch 15: `fbefb6ba` (2026-08-18)
**Commit Message**: fix(yurtmanager): prevent ValidateUpdate from re-validating oldObj in platformadmin webhooks (#2641)

* fix(yurtmanager): prevent ValidateUpdate from re-validating oldObj in platformadmin webhooks

* fix(yurtmanager): remove unused oldPlatformAdmin in ValidateUpdate

**File**: `pkg/yurtmanager/webhook/platformadmin/v1alpha2/platformadmin_validation.go` (modified, +2/-4)
```diff
@@ -64,15 +64,13 @@ func (webhook *PlatformAdminHandler) ValidateUpdate(
 	if !ok {
 		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a PlatformAdmin but got a %T", newObj))
 	}
-	oldPlatformAdmin, ok := oldObj.(*v1alpha2.PlatformAdmin)
+	_, ok = oldObj.(*v1alpha2.PlatformAdmin)
 	if !ok {
 		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a PlatformAdmin but got a %T", oldObj))
 	}
 
 	// validate
-	newErrorList := webhook.validate(ctx, newPlatformAdmin)
-	oldErrorList := webhook.validate(ctx, oldPlatformAdmin)
-	if allErrs := append(newErrorList, oldErrorList...); len(allErrs) > 0 {
+	if allErrs := webhook.validate(ctx, newPlatformAdmin); len(allErrs) > 0 {
 		return nil, apierrors.NewInvalid(
 			v1alpha2.GroupVersion.WithKind("PlatformAdmin").GroupKind(),
 			newPlatformAdmin.Name,
```

**File**: `pkg/yurtmanager/webhook/platformadmin/v1alpha2/platformadmin_validation_test.go` (modified, +2/-2)
```diff
@@ -229,7 +229,7 @@ func TestValidateUpdate(t *testing.T) {
 			errCode: http.StatusUnprocessableEntity,
 		},
 		{
-			name:   "should get StatusUnprocessableEntityError when old PlatformAdmin is invalid and old PlatformAdmin is valid",
+			name:   "should pass when old PlatformAdmin is invalid but new PlatformAdmin is valid",
 			client: NewFakeClient(buildClient(buildNodePool(), buildPlatformAdmin())).Build(),
 			oldObj: &v1alpha2.PlatformAdmin{},
 			newObj: &v1alpha2.PlatformAdmin{
@@ -242,7 +242,7 @@ func TestValidateUpdate(t *testing.T) {
 					Version:  "v2",
 				},
 			},
-			errCode: http.StatusUnprocessableEntity,
+			errCode: 0,
 		},
 		{
 			name:   "should no err when new PlatformAdmin and old PlatformAdmin both valid",
```

**File**: `pkg/yurtmanager/webhook/platformadmin/v1beta1/platformadmin_validation.go` (modified, +2/-4)
```diff
@@ -63,15 +63,13 @@ func (webhook *PlatformAdminHandler) ValidateUpdate(
 	if !ok {
 		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a PlatformAdmin but got a %T", newObj))
 	}
-	oldPlatformAdmin, ok := oldObj.(*v1beta1.PlatformAdmin)
+	_, ok = oldObj.(*v1beta1.PlatformAdmin)
 	if !ok {
 		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a PlatformAdmin but got a %T", oldObj))
 	}
 
 	// validate
-	newErrorList := webhook.validate(ctx, newPlatformAdmin)
-	oldErrorList := webhook.validate(ctx, oldPlatformAdmin)
-	if allErrs := append(newErrorList, oldErrorList...); len(allErrs) > 0 {
+	if allErrs := webhook.validate(ctx, newPlatformAdmin); len(allErrs) > 0 {
 		return nil, apierrors.NewInvalid(
 			v1beta1.GroupVersion.WithKind("PlatformAdmin").GroupKind(),
 			newPlatformAdmin.Name,
```

**File**: `pkg/yurtmanager/webhook/platformadmin/v1beta1/platformadmin_validation_test.go` (modified, +2/-2)
```diff
@@ -229,7 +229,7 @@ func TestValidateUpdate(t *testing.T) {
 			errCode: http.StatusUnprocessableEntity,
 		},
 		{
-			name:   "should get StatusUnprocessableEntityError when old PlatformAdmin is invalid and old PlatformAdmin is valid",
+			name:   "should pass when old PlatformAdmin is invalid but new PlatformAdmin is valid",
 			client: NewFakeClient(buildClient(buildNodePool(), buildPlatformAdmin())).Build(),
 			oldObj: &v1beta1.PlatformAdmin{},
 			newObj: &v1beta1.PlatformAdmin{
@@ -242,7 +242,7 @@ func TestValidateUpdate(t *testing.T) {
 					Version:   "v2",
 				},
 			},
-			errCode: http.StatusUnprocessableEntity,
+			errCode: 0,
 		},
 		{
 			name:   "should no err when new PlatformAdmin and old PlatformAdmin both valid",
```

#### Recent Merged Pull Requests:
- **PR #2821** (closed): build(deps): bump zeebe-io/backport-action from 4.6.0 to 4.6.1 (@dependabot[bot])
- **PR #2817** (closed): build(deps): bump github/codeql-action from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #2816** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.2 (@dependabot[bot])
- **PR #2803** (2026-09-16): build(deps): bump github/codeql-action from 4.37.4 to 4.38.0 (@dependabot[bot])
- **PR #2799** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.1 (@dependabot[bot])
- **PR #2798** (2026-09-16): build(deps): bump google.golang.org/grpc from 1.79.3 to 1.83.1 (@dependabot[bot])
- **PR #2796** (closed): build(deps): bump github/codeql-action from 4.37.4 to 4.37.9 (@dependabot[bot])
- **PR #2795** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
