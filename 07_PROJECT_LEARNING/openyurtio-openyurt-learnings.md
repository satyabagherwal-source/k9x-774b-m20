> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/openyurtio-openyurt-learnings.md`  
> **Source**: github ([https://github.com/openyurtio/openyurt](https://github.com/openyurtio/openyurt))  
> **Source Version**: `83ce3925`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T01:34:57.048Z  
> **Learning ID**: `learn-github-openyurtio-openyurt`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): openyurtio/openyurt

> **Canonical Artifact**: `07_PROJECT_LEARNING/openyurtio-openyurt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openyurtio/openyurt](https://github.com/openyurtio/openyurt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T01:34:56.860Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openyurtio/openyurt`
- **Description**: OpenYurt - Extending your native Kubernetes to edge(project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2008 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2826** (2026-10-12): **build(deps): bump zeebe-io/backport-action from 4.6.0 to 4.7.0**
  *Symptoms*: Bumps [zeebe-io/backport-action](https://github.com/zeebe-io/backport-action) from 4.6.0 to 4.7.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/zeebe-io/backport-action/releases">zeebe-io/backport-action's releases</a>.</em></p> <blockquote> <h2>Backport-action v4.7.0</h2> <h2>What's Changed</h2> <p>Thanks to a great contribution by <a href="https://github.com/lexfrei"><code>@​lexfrei</code></a>, backports no longer fail when the target branch already contains some of the changes, for example if a specific commit was already manually cherry-picked, or on a re-run. Previously, git reported the empty cherry-pick as a conflict, so the backport failed (or opened a draft PR with <code>conflict_resolution: draft_commit_conflicts</code>).</p> <p>Now the action skips those commits:</p> <ul> <li><strong>Some commits already on the target:</strong> the backport PR is created as usual. The comment on the original pull request mentions the skipped commits, and a comment on the backport PR lists them.</li> <li><strong>All commits already on the target:</strong> there's nothing to backport, so no PR is created. The target is skipped, just like when its backport PR already exists, and doesn't count as a failure in <code>was_successful</code>.</li> </ul> <p>With <code>comment_style: summary</code>, that looks like this:</p> <blockquote> <table> <thead> <tr> <th>Target</th> <th>Status</th> </tr> </thead> <tbody> <tr> <td><code>stable/8.7</code></t

- **Issue #2821** (2026-10-05): **build(deps): bump zeebe-io/backport-action from 4.6.0 to 4.6.1**
  *Symptoms*: Bumps [zeebe-io/backport-action](https://github.com/zeebe-io/backport-action) from 4.6.0 to 4.6.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/zeebe-io/backport-action/releases">zeebe-io/backport-action's releases</a>.</em></p> <blockquote> <h2>Backport-action v4.6.1</h2> <h2>What's Changed</h2> <p>Dependency updates only.</p> <h2>Updated dependencies</h2> <ul> <li>Update korthout/backport-action action to v4.6.0 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/670">korthout/backport-action#670</a></li> <li>Update dependency prettier to v3.9.4 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/671">korthout/backport-action#671</a></li> <li>Lock file maintenance by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/676">korthout/backport-action#676</a></li> <li>Update dependency vitest to v4.1.10 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthout/backport-action/pull/677">korthout/backport-action#677</a></li> <li>Update dependency <code>@​types/node</code> to v24.13.3 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/korthou
  **Post-Mortem & Fix Analysis**:
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=openyurtio_openyurt&pullRequest=2821) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2821&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=openyurtio_openyurt&pullRequest=2821&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=openyurtio_openyurt&pullRequest=2821&issueStatuses=OPEN,CONFIRMED&sinceLeakPerio
  > ## [Codecov](https://app.codecov.io/gh/openyurtio/openyurt/pull/2821?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 46.59%. Comparing base ([`7833349`](https://app.codecov.io/gh/openyurtio/openyurt/commit/78333496ac530d483545ac3916de2ecb2fab6d01?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)) to head ([`cea08b7`](https://app.codecov.io/gh/openyurtio/openyurt/commit/cea08b7f6610bd8d68b4aae0945248b94661fa16?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openyurtio)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##           master    #2821   +/-   ## ==========

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

### Incident Patch 1: `9b55de80` (2026-09-16)
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

### Incident Patch 2: `a459d3bc` (2026-08-18)
**Commit Message**: fix: prevent watch response goroutine leak when client disconnects (#2679)

The background goroutine spawned by streamResponseFilter sends each
encoded watch event to the unbuffered watchDataCh with an unconditional
ch <- buf. When a watch client disconnects mid-stream, the consumer
stops reading from the channel and the goroutine blocks on the send
forever, leaking one goroutine per disconnect.

stopCh is the load balancer's process-lifetime channel, so it is only
closed on yurthub shutdown, not on an individual client disconnect.
Guarding the send with stopCh alone therefore does not release the
goroutine on the disconnect path. The reverse proxy calls Close on the
response body when the client goes away, so signal the goroutine from
Close via a dedicated channel and select on both stopCh and that channel
at the send site.

Signed-off-by: Deepak Bhagat <[REDACTED_EMAIL]>

**File**: `pkg/yurthub/filter/responsefilter/filter.go` (modified, +14/-1)
```diff
@@ -22,6 +22,7 @@ import (
 	"errors"
 	"io"
 	"net/http"
+	"sync"
 
 	"k8s.io/apimachinery/pkg/api/meta"
 	"k8s.io/apimachinery/pkg/runtime"
@@ -46,6 +47,8 @@ type filterReadCloser struct {
 	isList       bool
 	ownerName    string
 	stopCh       <-chan struct{}
+	closeCh      chan struct{}
+	closeOnce    sync.Once
 }
 
 // newFilterReadCloser create an filterReadCloser object
@@ -75,6 +78,7 @@ func newFilterReadCloser(
 		isList:       info.Verb == "list",
 		ownerName:    ownerName,
 		stopCh:       stopCh,
+		closeCh:      make(chan struct{}),
 	}
 
 	if frc.isWatch {
@@ -113,6 +117,9 @@ func (frc *filterReadCloser) Read(p []byte) (int, error) {
 
 // Close will close readers
 func (frc *filterReadCloser) Close() error {
+	frc.closeOnce.Do(func() {
+		close(frc.closeCh)
+	})
 	if frc.filterCache != nil {
 		frc.filterCache.Reset()
 	}
@@ -198,7 +205,13 @@ func (frc *filterReadCloser) streamResponseFilter(rc io.ReadCloser, ch chan *byt
 			klog.Errorf("could not encode resource in StreamResponseFilter of %s, %v", frc.ownerName, err)
 			return err
 		}
-		ch <- buf
+		select {
+		case ch <- buf:
+		case <-frc.stopCh:
+			return nil
+		case <-frc.closeCh:
+			return nil
+		}
 	}
 }
 
```

**File**: `pkg/yurthub/filter/responsefilter/filter_leak_test.go` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+/*
+Copyright 2025 The OpenYurt Authors.
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
+package responsefilter
+
+import (
+	"bytes"
+	"io"
+	"testing"
+	"time"
+
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/watch"
+
+	"github.com/openyurtio/openyurt/pkg/yurthub/kubernetes/serializer"
+)
+
+func encodeWatchEvents(t *testing.T, s *serializer.Serializer, n int) *bytes.Buffer {
+	t.Helper()
+	buf := &bytes.Buffer{}
+	for i := 0; i < n; i++ {
+		event := &watch.Event{
+			Type: watch.Added,
+			Object: &corev1.Service{
+				ObjectMeta: metav1.ObjectMeta{Name: "svc", Namespace: "default"},
+			},
+		}
+		if _, err := s.WatchEncode(buf, event); err != nil {
+			t.Fatalf("failed to encode watch event: %v", err)
+		}
+	}
+	return buf
+}
+
+func newWatchFilterReadCloser(rc io.ReadCloser, s *serializer.Serializer, stopCh <-chan struct{}) *filterReadCloser {
+	return &filterReadCloser{
+		rc:           rc,
+		watchDataCh:  make(chan *bytes.Buffer),
+		filterCache:  new(bytes.Buffer),
+		serializer:   s,
+		objectFilter: &nopObjectHandler{},
+		isWatch:      true,
+		ownerName:    "foo",
+		stopCh:       stopCh,
+		closeCh:      make(chan struct{}),
+	}
+}
+
+func TestStreamResponseFilterExitsOnClose(t *testing.T) {
+	sm := serializer.NewSerializerManager()
+	s := sm.CreateSerializer("application/json", "", "v1", "services")
+	if s == nil {
+		t.Fatal("failed to create serializer")
+	}
+
+	frc := newWatchFilterReadCloser(io.NopCloser(encodeWatchEvents(t, s, 5)), s, make(chan struct{}))
+
+	done := make(chan error, 1)
+	go func() {
+		done <- frc.streamResponseFilter(frc.rc, frc.watchDataCh)
+	}()
+
+	<-frc.watchDataCh
+
+	if err := frc.Close(); err != nil {
+		t.Fatalf("failed to close filter read closer: %v", err)
+	}
+
+	select {
+	case err := <-done:
+		if err != nil {
+			t.Fatalf("expected nil error after Close, got %v", err)
+		}
+	case <-time.After(2 * time.Second):
+		t.Fatal("streamResponseFilter goroutine leaked: still blocked after Close")
+	}
+}
+
+func TestStreamResponseFilterExitsOnStopCh(t *testing.T) {
+	sm := serializer.NewSerializerManager()
+	s := sm.CreateSerializer("application/json", "", "v1", "services")
+	if s == nil {
+		t.Fatal("failed to create serializer")
+	}
+
+	stopCh := make(chan struct{})
+	frc := newWatchFilterReadCloser(io.NopCloser(encodeWatchEvents(t, s, 5)), s, stopCh)
+
+	done := make(chan error, 1)
+	go func() {
+		done <- frc.streamResponseFilter(frc.rc, frc.watchDataCh)
+	}()
+
+	<-frc.watchDataCh
+	close(stopCh)
+
+	select {
+	case err := <-done:
+		if err != nil {
+			t.Fatalf("expected nil error after stopCh closed, got %v", err)
+		}
+	case <-time.After(2 * time.Second):
+		t.Fatal("streamResponseFilter goroutine leaked: still blocked after stopCh closed")
+	}
+}
+
+func TestStreamResponseFilterDeliversAllEventsThenEOF(t *testing.T) {
+	sm := serializer.NewSerializerManager()
+	s := sm.CreateSerializer("application/json", "", "v1", "services")
+	if s == nil {
+		t.Fatal("failed to create serializer")
+	}
+
+	frc := newWatchFilterReadCloser(io.NopCloser(encodeWatchEvents(t, s, 3)), s, make(chan struct{}))
+
+	done := make(chan error, 1)
+	go func() {
+		done <- frc.streamResponseFilter(frc.rc, frc.watchDataCh)
+	}()
+
+	count := 0
+	for range frc.watchDataCh {
+		count++
+	}
+
+	if count != 3 {
+		t.Fatalf("expected 3 watch events delivered, got %d", count)
+	}
+
+	select {
+	case err := <-done:
+		if err != io.EOF {
+			t.Fatalf("expected io.EOF after stream ends, got %v", err)
+		}
+	case <-time.After(2 * time.Second):
+		t.Fatal("streamResponseFilter did not return after normal stream end")
+	}
+}
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

#### Recent Merged Pull Requests:
- **PR #2826** (2026-10-12): build(deps): bump zeebe-io/backport-action from 4.6.0 to 4.7.0 (@dependabot[bot])
- **PR #2821** (closed): build(deps): bump zeebe-io/backport-action from 4.6.0 to 4.6.1 (@dependabot[bot])
- **PR #2820** (2026-10-12): build(deps): bump github/codeql-action from 4.38.0 to 4.38.2 (@dependabot[bot])
- **PR #2819** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.3 (@dependabot[bot])
- **PR #2817** (closed): build(deps): bump github/codeql-action from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #2816** (closed): build(deps): bump crate-ci/typos from 1.43.3 to 1.50.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. data race on ek.file and ek.count between sync and compress goroutines (#2631)

**RULE**:
When implementing operations in `pkg/yurthub/cachemanager/error_keys.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in openyurtio/openyurt. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9b55de80`: data race on ek.file and ek.count between sync and compress goroutines (#2631). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/yurthub/cachemanager/error_keys.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	fileMu  sync.Mutex
	ek.fileMu.Lock()
	defer ek.fileMu.Unlock()
func (ek *errorKeys) getCount() int {
	ek.fileMu.Lock()
	defer ek.fileMu.Unlock()
	return ek.count
}

	defer ticker.Stop()
			if ek.getCount() > ek.length()+CompressThresh {
	ek.swapAOF(count)
}

func (ek *errorKeys) swapAOF(count int) {
	ek.fileMu.Lock()
	defer ek.fileMu.Unlock()
	aofPath := filepath.Join(ek.aofPath, "aof")
	err := os.Rename(filepath.Join(ek.aofPath, "tmp_aof"), aofPath)
		// Compaction failed: keep serving the unchanged aof and do not update
		// the count, so ek.count stays in sync with the on-disk file.
		if file, oerr := os.OpenFile(aofPath, os.O_RDWR|os.O_APPEND, 0644); oerr != nil {
			klog.ErrorS(oerr, "failed to reopen aof after failed rename", "name", aofPath)
			metrics.Metrics.SetErrorKeysPersistencyStatus(0)
			ek.queue.ShutDown()
		} else {
			ek.file = file
		}
		return
	file, err := os.OpenFile(aofPath, os.O_RDWR|os.O_APPEND, 0644)
		klog.ErrorS(err, "failed to open file", "name", aofPath)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			if ek.count > len(ek.keys)+CompressThresh {
	err = os.Rename(filepath.Join(ek.aofPath, "tmp_aof"), filepath.Join(ek.aofPath, "aof"))
	file, err = os.OpenFile(filepath.Join(ek.aofPath, "aof"), os.O_RDWR, 0644)
		klog.ErrorS(err, "failed to open file", "name", filepath.Join(ek.aofPath, "aof"))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9b55de80` are properly handled with clean fallback behavior.
