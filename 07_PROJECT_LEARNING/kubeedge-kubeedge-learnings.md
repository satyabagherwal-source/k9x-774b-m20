# Forensic Learning Record (Deep Inspection): kubeedge/kubeedge

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubeedge-kubeedge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubeedge/kubeedge](https://github.com/kubeedge/kubeedge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:23:53.721Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeedge/kubeedge`
- **Description**: Kubernetes Native Edge Computing Framework (project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 7590 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cloud/cmd/admission/admission.go`
```
/*
Copyright 2019 The KubeEdge Authors.

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
	"os"

	"k8s.io/component-base/logs"

	"github.com/kubeedge/kubeedge/cloud/cmd/admission/app"
)

func main() {
	command := app.NewAdmissionCommand()
	logs.InitLogs()
	defer logs.FlushLogs()

	if err := command.Execute(); err != nil {
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cloud/cmd/admission/app/options/options.go`
```
/*
Copyright 2019 The KubeEdge Authors.

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
	cliflag "k8s.io/component-base/cli/flag"
)

// AdmissionOptions admission-controller server config.
type AdmissionOptions struct {
	Master                    string
	Kubeconfig                string
	CertFile                  string
	KeyFile                   string
	CaCertFile                string
	Port                      int32
	PrintVersion              bool
	AdmissionServiceName      string
	AdmissionServiceNamespace string
	SchedulerName             string
}

// NewAdmissionOptions create new config
func NewAdmissionOptions() *AdmissionOptions {
	return &AdmissionOptions{}
}

// Flags add flags for admission webhook
func (o *AdmissionOptions) Flags() (fss cliflag.NamedFlagSets) {
	fs := fss.FlagSet("admission")
	fs.StringVar(&o.Master, "master", o.Master, "The address of the Kubernetes API server (overrides any value in kubeconfig)")
	fs.StringVar(&o.Kubeconfig, "kubeconfig", o.Kubeconfig, "Path to kubeconfig file with authorization and master location information.")
	fs.StringVar(&o.CertFile, "tls-cert-file", o.CertFile, ""+
		"File containing the default x509 Certificate for HTTPS. (CA cert, if any, concatenated "+"after server cert).")
	fs.StringVar(&o.KeyFile, "tls-private-key-file", o.KeyFile, "File containing the default x509 private key matching --tls-cert-file.")
	fs.StringVar(&o.CaCertFile, "ca-cert-file", o.CaCertFile, "File containing the x509 Certificate for HTTPS.")
	fs.Int32Var(&o.Port, "port", 443, "the port used by admission-controller-server.")
	fs.StringVar(&o.AdmissionServiceNamespace, "webhook-namespace", "kubeedge", "The namespace of this webhook")
	fs.StringVar(&o.AdmissionServiceName, "webhook-service-name", "kubeedge-admission-service", "The name of this admission service")
	return
}

```

### Core Architecture Module: `cloud/cmd/admission/app/server.go`
```
/*
Copyright 2019 The KubeEdge Authors.

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
	"fmt"

	"github.com/spf13/cobra"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/component-base/cli/globalflag"
	"k8s.io/component-base/term"
	"k8s.io/klog/v2"

	"github.com/kubeedge/kubeedge/cloud/cmd/admission/app/options"
	"github.com/kubeedge/kubeedge/cloud/pkg/admissioncontroller"
	"github.com/kubeedge/kubeedge/pkg/util/flag"
	"github.com/kubeedge/kubeedge/pkg/version"
	"github.com/kubeedge/kubeedge/pkg/version/verflag"
)

func NewAdmissionCommand() *cobra.Command {
	ops := options.NewAdmissionOptions()
	cmd := &cobra.Command{
		Use: "admission",
		Long: `Admission leverage the feature of Dynamic Admission Control from kubernetes, start it
if want to admission control some kubeedge resources.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			verflag.PrintAndExitIfRequested()
			flag.PrintFlags(cmd.Flags())

			// To help debugging, immediately log version
			klog.Infof("Version: %+v", version.Get())
			return admissioncontroller.Run(ops)
		},
	}

	fs := cmd.Flags()
	namedFs := ops.Flags()
	verflag.AddFlags(namedFs.FlagSet("global"))
	globalflag.AddGlobalFlags(namedFs.FlagSet("global"), cmd.Name())
	for _, f := range namedFs.FlagSets {
		fs.AddFlagSet(f)
	}

	usageFmt := "Usage:\n  %s\n"
	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	cmd.SetUsageFunc(func(cmd *cobra.Command) error {
		fmt.Fprintf(cmd.OutOrStderr(), usageFmt, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStderr(), namedFs, cols)
		return nil
	})
	cmd.SetHelpFunc(func(cmd *cobra.Command, args []string) {
		fmt.Fprintf(cmd.OutOrStdout(), "%s\n\n"+usageFmt, cmd.Long, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStdout(), namedFs, cols)
	})

	return cmd
}

```

### Core Architecture Module: `cloud/cmd/cloudcore/app/options/options.go`
```
/*
Copyright 2019 The KubeEdge Authors.

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
	"path"

	"k8s.io/apimachinery/pkg/util/validation/field"
	cliflag "k8s.io/component-base/cli/flag"

	"github.com/kubeedge/api/apis/common/constants"
	config "github.com/kubeedge/api/apis/componentconfig/cloudcore/v1alpha1"
	"github.com/kubeedge/kubeedge/pkg/util/validation"
)

type CloudCoreOptions struct {
	ConfigFile string
}

func NewCloudCoreOptions() *CloudCoreOptions {
	return &CloudCoreOptions{
		ConfigFile: path.Join(constants.DefaultConfigDir, "cloudcore.yaml"),
	}
}

func (o *CloudCoreOptions) Flags() (fss cliflag.NamedFlagSets) {
	fs := fss.FlagSet("global")
	fs.StringVar(&o.ConfigFile, "config", o.ConfigFile, "The path to the configuration file. Flags override values in this file.")
	return
}

func (o *CloudCoreOptions) Validate() []error {
	var errs []error
	if !validation.FileIsExist(o.ConfigFile) {
		errs = append(errs, field.Required(field.NewPath("config"),
			fmt.Sprintf("config file %v not exist. For the configuration file format, please refer to --minconfig and --defaultconfig command", o.ConfigFile)))
	}
	return errs
}

func (o *CloudCoreOptions) Config() (*config.CloudCoreConfig, error) {
	cfg := config.NewDefaultCloudCoreConfig()
	if err := cfg.Parse(o.ConfigFile); err != nil {
		return nil, err
	}
	return cfg, nil
}

```

### Core Architecture Module: `cloud/cmd/cloudcore/app/server.go`
```
/*
Copyright 2019 The KubeEdge Authors.

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
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/spf13/cobra"
	v1 "k8s.io/api/core/v1"
	apierror "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/component-base/cli/globalflag"
	"k8s.io/component-base/term"
	"k8s.io/klog/v2"
	"sigs.k8s.io/yaml"

	"github.com/kubeedge/api/apis/componentconfig/cloudcore/v1alpha1"
	"github.com/kubeedge/api/apis/componentconfig/cloudcore/v1alpha1/validation"
	"github.com/kubeedge/beehive/pkg/core"
	beehiveContext "github.com/kubeedge/beehive/pkg/core/context"
	"github.com/kubeedge/kubeedge/cloud/cmd/cloudcore/app/options"
	"github.com/kubeedge/kubeedge/cloud/pkg/cloudhub"
	"github.com/kubeedge/kubeedge/cloud/pkg/cloudstream"
	"github.com/kubeedge/kubeedge/cloud/pkg/cloudstream/iptables"
	"github.com/kubeedge/kubeedge/cloud/pkg/common/client"
	"github.com/kubeedge/kubeedge/cloud/pkg/common/informers"
	"github.com/kubeedge/kubeedge/cloud/pkg/common/modules"
	"github.com/kubeedge/kubeedge/cloud/pkg/common/monitor"
	"github.com/kubeedge/kubeedge/cloud/pkg/csrapprovercontroller"
	"github.com/kubeedge/kubeedge/cloud/pkg/devicecontroller"
	"github.com/kubeedge/kubeedge/cloud/pkg/dynamiccontroller"
	"github.com/kubeedge/kubeedge/cloud/pkg/edgecontroller"
	"github.com/kubeedge/kubeedge/cloud/pkg/policycontroller"
	"github.com/kubeedge/kubeedge/cloud/pkg/router"
	"github.com/kubeedge/kubeedge/cloud/pkg/synccontroller"
	"github.com/kubeedge/kubeedge/cloud/pkg/taskmanager"
	"github.com/kubeedge/kubeedge/common/constants"
	"github.com/kubeedge/kubeedge/pkg/features"
	"github.com/kubeedge/kubeedge/pkg/util"
	"github.com/kubeedge/kubeedge/pkg/util/flag"
	"github.com/kubeedge/kubeedge/pkg/version"
)

func NewCloudCoreCommand() *cobra.Command {
	opts := options.NewCloudCoreOptions()
	cmd := &cobra.Command{
		Use: "cloudcore",
		Long: `CloudCore is the core cloud part of KubeEdge, which contains three modules: cloudhub,
edgecontroller, and devicecontroller. Cloudhub is a web server responsible for watching changes at the cloud side,
caching and sending messages to EdgeHub. EdgeController is an extended kubernetes controller which manages
edge nodes and pods metadata so that the data can be targeted to a specific edge node. DeviceController is an extended
kubernetes controller which manages devices so that the device metadata/status date can be synced between edge and cloud.`,
		Run: func(cmd *cobra.Command, args []string) {
			flag.PrintMinConfigAndExitIfRequested(v1alpha1.NewMinCloudCoreConfig())
			flag.PrintDefaultConfigAndExitIfRequested(v1alpha1.NewDefaultCloudCoreConfig())
			flag.PrintFlags(cmd.Flags())

			if errs := opts.Validate(); len(errs) > 0 {
				klog.Exit(util.SpliceErrors(errs))
			}

			config, err := opts.Config()
			if err != nil {
				klog.Exit(err)
			}
			if errs := validation.ValidateCloudCoreConfiguration(config); len(errs) > 0 {
				klog.Exit(util.SpliceErrors(errs.ToAggregate().Errors()))
			}

			if err := features.DefaultMutableFeatureGate.SetFromMap(config.FeatureGates); err != nil {
				klog.Exit(err)
			}

			// start monitor server
			go monitor.ServeMonitor(config.CommonConfig.MonitorServer)

			// To help debugging, immediately log version
			klog.Infof("Version: %+v", version.Get())
			enableImpersonation := config.Modules.CloudHub.Authorization != nil &&
				config.Modules.CloudHub.Authorization.Enable &&
				!config.Modules.CloudHub.Authorization.Debug
			client.InitKubeEdgeClient(config.KubeAPIConfig, enableImpersonation)

			// Negotiate TunnelPort for multi cloudcore instances
			waitTime := rand.Int31n(10)
			time.Sleep(time.Duration(waitTime) * time.Second)
			tunnelport, err := NegotiateTunnelPort()
			if err != nil {
				panic(err)
			}

			config.CommonConfig.TunnelPort = *tunnelport

			if changed := v1alpha1.AdjustCloudCoreConfig(config); changed {
				updateCloudCoreConfigMap(config)
			}

			ctx := beehiveContext.GetContext()
			if features.DefaultFeatureGate.Enabled(features.RequireAuthorization) {
				go csrapprovercontroller.NewCSRApprover(client.GetKubeClient(), informers.GetInformersManager().GetKubeInformerFactory().Certificates().V1().CertificateSigningRequests()).
					Run(5, ctx.Done())
			}

			gis := informers.GetInformersManager()

			registerModules(config)

			if config.Modules.IptablesManager == nil || config.Modules.IptablesManager.Enable && config.Modules.IptablesManager.Mode == v1alpha1.InternalMode {
				// By default, IptablesManager manages tunnel port related iptables rules
				// The internal mode will share the host network, forward to the stream port.
				streamPort := int(config.Modules.CloudStream.StreamPort)
				go iptables.NewIptablesManager(config.KubeAPIConfig, streamPort).Run(ctx)
			}

			// Start all modules
			core.StartModules()
			gis.Start(ctx.Done())
			core.GracefulShutdown()
		},
	}
	fs := cmd.Flags()
	namedFs := opts.Flags()
	flag.AddFlags(namedFs.FlagSet("global"))
	globalflag.AddGlobalFlags(namedFs.FlagSet("global"), cmd.Name())
	for _, f := range namedFs.FlagSets {
		fs.AddFlagSet(f)
	}

	usageFmt := "Usage:\n  %s\n"
	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	cmd.SetUsageFunc(func(cmd *cobra.Command) error {
		fmt.Fprintf(cmd.OutOrStderr(), usageFmt, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStderr(), namedFs, cols)
		return nil
	})
	cmd.SetHelpFunc(func(cmd *cobra.Command, args []string) {
		fmt.Fprintf(cmd.OutOrStdout(), "%s\n\n"+usageFmt, cmd.Long, cmd.UseLine())
		cliflag.PrintSections(cmd.OutOrStdout(), namedFs, cols)
	})

	return cmd
}

// registerModules register all the modules started in cloudcore
func registerModules(c *v1alpha1.CloudCoreConfig) {
	enableAuthorization := c.Modules.CloudHub.Authorization != nil &&
		c.Modules.CloudHub.Authorization.Enable &&
		!c.Modules.CloudHub.Authorization.Debug

	cloudhub.Register(c.Modules.CloudHub)
	edgecontroller.Register(c.Modules.EdgeController)
	devicecontroller.Register(c.Modules.DeviceController)
	taskmanager.Register(c.Modules.TaskManager)
	synccontroller.Register(c.Modules.SyncController)
	cloudstream.Register(c.Modules.CloudStream, c.CommonConfig)
	router.Register(c.Modules.Router)
	dynamiccontroller.Register(c.Modules.DynamicController, enableAuthorization)
	policycontroller.Register(client.CrdConfig)
}

func NegotiateTunnelPort() (*int, error) {
	ctx := context.Background()
	kubeClient := client.GetKubeClient()
	err := client.CreateNamespaceIfNeeded(ctx, constants.SystemNamespace)
	if err != nil {
		return nil, fmt.Errorf("failed to create system namespace: %v", err)
	}

	tunnelPort, err := kubeClient.CoreV1().ConfigMaps(constants.SystemNamespace).
		Get(ctx, modules.TunnelPort, metav1.GetOptions{})

	if err != nil && !apierror.IsNotFound(err) {
		return nil, err
	}

	hostnameOverride := util.GetHostname()
	localIP, _ := util.GetLocalIP(hostnameOverride)

	var record iptables.TunnelPortRecord
	if err == nil {
		recordStr, found := tunnelPort.Annotations[modules.TunnelPortRecordAnnotationKey]
		recordBytes := []byte(recordStr)
		if !found {
			return nil, errors.New("failed to get tunnel port record")
		}

		if err := json.Unmarshal(recordBytes, &record); err != nil {
			return nil, err
		}

		port, found := record.IPTunnelPort[localIP]
		if found {
			return &port, nil
		}

		port = negotiatePort(record.Port)

		record.IPTunnelPort[localIP] = port
		record.Port[port] = true

```

### Core Architecture Module: `cloud/cmd/cloudcore/cloudcore.go`
```
/*
Copyright 2019 The KubeEdge Authors.

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
	"os"

	"k8s.io/component-base/logs"

	"github.com/kubeedge/kubeedge/cloud/cmd/cloudcore/app"
)

func main() {
	command := app.NewCloudCoreCommand()
	logs.InitLogs()
	defer logs.FlushLogs()

	if err := command.Execute(); err != nil {
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cloud/cmd/controllermanager/app/controllermanager.go`
```
package app

import (
	"context"
	"flag"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/component-base/cli/globalflag"
	"k8s.io/klog/v2"
	controllerruntime "sigs.k8s.io/controller-runtime"
	_ "sigs.k8s.io/controller-runtime/pkg/client/config" // using to set --kubeconfig flag
	"sigs.k8s.io/controller-runtime/pkg/log"

	"github.com/kubeedge/kubeedge/cloud/cmd/controllermanager/app/options"
	"github.com/kubeedge/kubeedge/cloud/pkg/controllermanager"
	"github.com/kubeedge/kubeedge/pkg/features"
	"github.com/kubeedge/kubeedge/pkg/version/verflag"
)

func NewControllerManagerCommand(ctx context.Context) *cobra.Command {
	log.SetLogger(klog.FromContext(ctx))
	opts := options.NewControllerManagerOptions()
	cmd := &cobra.Command{
		Use:  "controller-manager",
		Long: `The node group controller manager run a bunch of controllers`,
		Run: func(_cmd *cobra.Command, _args []string) {
			for _, fg := range opts.FeatureGates {
				if err := features.DefaultMutableFeatureGate.Set(fmt.Sprintf("%s=true", fg)); err != nil {
					klog.Errorf("failed to set feature gate '%s', err: %v", fg, err)
				}
			}
			kubeconfig := controllerruntime.GetConfigOrDie()
			mgr, err := controllermanager.NewControllerManager(ctx, kubeconfig, opts.HealthProbeBindAddress)
			if err != nil {
				klog.Fatalf("failed to get controller manager, %v", err)
			}

			// mgr.Start will block until the manager has stopped
			if err := mgr.Start(ctx); err != nil {
				klog.Fatalf("failed to start controller manager, %v", err)
			}
		},
	}

	pflag.CommandLine.AddGoFlagSet(flag.CommandLine)
	fs := cmd.Flags()
	namedFs := opts.Flags()
	verflag.AddFlags(namedFs.FlagSet("global"))
	globalflag.AddGlobalFlags(namedFs.FlagSet("global"), cmd.Name())
	for _, f := range namedFs.FlagSets {
		fs.AddFlagSet(f)
	}

	return cmd
}

```

### Core Architecture Module: `cloud/cmd/controllermanager/app/options/options.go`
```
package options

import (
	cliflag "k8s.io/component-base/cli/flag"
)

type ControllerManagerOptions struct {
	UseServerSideApply     bool
	HealthProbeBindAddress string
	FeatureGates           []string
}

func NewControllerManagerOptions() *ControllerManagerOptions {
	return &ControllerManagerOptions{}
}

func (o *ControllerManagerOptions) Flags() (fss cliflag.NamedFlagSets) {
	fs := fss.FlagSet("ControllerManager")
	fs.BoolVar(&o.UseServerSideApply, "use-server-side-apply", o.UseServerSideApply, "If use server-side apply when updating templates.")
	fs.StringVar(&o.HealthProbeBindAddress, "health-probe-bind-address", ":9001", "The TCP address that the controller should bind to for serving health probes.")
	fs.StringArrayVar(&o.FeatureGates, "feature-gates", o.FeatureGates, "Used to enable some features.")
	return
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7343** (2026-09-29): **controllermanager: escape resource names in JSON patch paths**
  *Symptoms*: **What type of PR is this?**  /kind bug  **What this PR does / why we need it**:  `ResourcesOverrider` inserts qualified resource names such as `nvidia.com/gpu` verbatim into JSON Patch paths. The slash is parsed as a path separator, so replacing an existing request or limit returns a missing-path error.  Escape the resource-name token with the existing `EscapeJsonPointer` helper for both requests and limits. The patch keeps the current `replace` operation and override selection behavior.  Regression tests cover request-only, limit-only, and combined overrides for qualified names; a name containing both `~` and `/`; and ordinary resource paths.  **Which issue(s) this PR fixes**:  Fixes #7341  **Special notes for your reviewer**:  - The change applies to existing `requests` and `limits` maps. Handling absent parent maps is outside this patch. - `make verify` — PASS. - `make test WHAT=cloud` — PASS. - `make integrationtest` — PASS on Ubuntu 22.04.5 with native containerd (edge device 14/14, metaserver 1/1, cloud controller-manager 36/36). - Focused package tests, EdgeApplication subtree tests, `go vet`, and focused race tests — PASS.  **Does this PR introduce a user-facing change?**:  ```release-note Fixed EdgeApplication resource overrides for qualified resource names such as nvidia.com/gpu in existing request and limit maps. ```
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **kevin-wangzefeng** after the PR has been reviewed. You can assign the PR to them by writing `/assign @kevin-wangzefeng` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubeedge%2Fkubeedge).  <details open> Needs approval from an approver in each of these files:  - **[cloud/pkg/controllermanager/OWNERS](https://github.com/kubeedge/kubeedge/blob/master/cloud/pkg/controllermanager/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["kevin-wangzefeng"]} -->
  > Superseded by #7344 to satisfy the DCO sign-off check without force-pushing. The code change is identical.

- **Issue #7342** (2026-09-29): **controllermanager: escape resource names in JSON patch paths**
  *Symptoms*: **What type of PR is this?**  /kind bug  **What this PR does / why we need it**:  `ResourcesOverrider` inserts qualified resource names such as `nvidia.com/gpu` verbatim into JSON Patch paths. The slash is parsed as a path separator, so replacing an existing request or limit returns a missing-path error.  Escape the resource-name token with the existing `EscapeJsonPointer` helper for both requests and limits. The patch keeps the current `replace` operation and override selection behavior.  Regression tests cover request-only, limit-only, and combined overrides for qualified names; a name containing both `~` and `/`; and ordinary resource paths.  **Which issue(s) this PR fixes**:  Fixes #7341  **Special notes for your reviewer**:  - The change applies to existing `requests` and `limits` maps. Handling absent parent maps is outside this patch. - `make verify` — PASS. - `make test WHAT=cloud` — PASS. - `make integrationtest` — PASS on Ubuntu 22.04.5 with native containerd (edge device 14/14, metaserver 1/1, cloud controller-manager 36/36). - Focused package tests, EdgeApplication subtree tests, `go vet`, and focused race tests — PASS.  **Does this PR introduce a user-facing change?**:  ```release-note Fixed EdgeApplication resource overrides for qualified resource names such as nvidia.com/gpu in existing request and limit maps. ```
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **fisherxu** after the PR has been reviewed. You can assign the PR to them by writing `/assign @fisherxu` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubeedge%2Fkubeedge).  <details open> Needs approval from an approver in each of these files:  - **[cloud/pkg/controllermanager/OWNERS](https://github.com/kubeedge/kubeedge/blob/master/cloud/pkg/controllermanager/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["fisherxu"]} -->
  > [Keywords](https://help.github.com/articles/closing-issues-using-keywords) which can automatically close issues and at(@) or hashtag(#) mentions are not allowed in commit messages.  **The list of commits with invalid commit messages**:  - [5826ac8](https://github.com/kubeedge/kubeedge/commits/5826ac856e4fa075591bc60ddb722d3b136e0505) controllermanager: escape resource names in JSON patch paths  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide/pull-requests.md).  If you have questions or suggestions related to my behavior, please file an issue against the [kubernetes/test-infra](https://github.com/kubernetes/test-infra/issues/new?title=Prow%20issue:) repository. I understand the commands that are listed [here](https://go.k8s.io/bot-commands). </details> 
  > Welcome @nzy0804! It looks like this is your first PR to kubeedge/kubeedge 🎉

- **Issue #7324** (2026-09-23): **Upgrade golang to 1.25.14**
  *Symptoms*:  <!--  Thanks for sending a pull request!  Here are some tips for you:  1. If this is your first time, please read our contributor guidelines: https://github.com/kubeedge/kubeedge/blob/master/CONTRIBUTING.md 2. Ensure you have added or ran the appropriate tests for your PR  -->  **What type of PR is this?**  /kind feature    **What this PR does / why we need it**:  Upgrade golang to 1.25.14 and golang-lint to v2  **Which issue(s) this PR fixes**: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. _If PR is about `failing-tests or flakes`, please post the related issues/tests in a comment and do not use `Fixes`_* --> Fixes #  **Special notes for your reviewer**:  **Does this PR introduce a user-facing change?**: <!-- If no, just write "NONE" in the release-note block below. If yes, a release note is required: Enter your extended release note in the block below. If the PR requires additional action from users switching to the new release, include the string "action required". --> ```release-note  ``` 
  **Post-Mortem & Fix Analysis**:
  > /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubeedge/kubeedge/pull/7324#issuecomment-5792983209" title="Approved">WillardHu</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubeedge%2Fkubeedge).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubeedge/kubeedge/blob/master/OWNERS)~~ [WillardHu]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > /lgtm 

- **Issue #7323** (2026-09-22): **ci: use GitHub-hosted ARM64 runners**
  *Symptoms*: ## What type of PR is this?  /kind test  ## What this PR does / why we need it  The `openeuler-linux-arm64` self-hosted runner label currently has no available matching runner, leaving the ARM64 workflow queued until cancellation.  This switches both jobs in `.github/workflows/main-arm64.yaml` to GitHub-hosted `ubuntu-22.04-arm` runners so ARM64 CI can start without depending on the unavailable self-hosted runner.  ## Which issue(s) this PR fixes  None  ## Special notes for your reviewer  This PR only changes the runner labels. Existing Docker image handling, artifact paths, and build commands are unchanged.
  **Post-Mortem & Fix Analysis**:
  > /lgtm /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubeedge/kubeedge/pull/7323#issuecomment-5778210230" title="Approved">DoisLONG</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubeedge%2Fkubeedge).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubeedge/kubeedge/blob/master/OWNERS)~~ [DoisLONG]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7322** (2026-09-22): **bump Go version to v1.25.14 for build-tools basic image**
  *Symptoms*: <!--  Thanks for sending a pull request!  Here are some tips for you:  1. If this is your first time, please read our contributor guidelines: https://github.com/kubeedge/kubeedge/blob/master/CONTRIBUTING.md 2. Ensure you have added or ran the appropriate tests for your PR  -->  **What type of PR is this?**   /kind feature    **What this PR does / why we need it**:  bump Go version to v1.25.14 for build-tools basic image  **Which issue(s) this PR fixes**: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. _If PR is about `failing-tests or flakes`, please post the related issues/tests in a comment and do not use `Fixes`_* --> Fixes #  **Special notes for your reviewer**:  **Does this PR introduce a user-facing change?**: <!-- If no, just write "NONE" in the release-note block below. If yes, a release note is required: Enter your extended release note in the block below. If the PR requires additional action from users switching to the new release, include the string "action required". --> ```release-note  ``` 
  **Post-Mortem & Fix Analysis**:
  > /lgtm /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubeedge/kubeedge/pull/7322#issuecomment-5770515442" title="Approved">DoisLONG</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubeedge%2Fkubeedge).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubeedge/kubeedge/blob/master/OWNERS)~~ [DoisLONG]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7318** (2026-09-22): **policycontroller: don't abort VisitRulesFor on a dangling roleRef**
  *Symptoms*: **What type of PR is this?**  /kind bug  **What this PR does / why we need it**:  `VisitRulesFor` in `cloud/pkg/policycontroller/manager/reconcile.go` scans a service account's ClusterRoleBindings and RoleBindings and resolves each one's `RoleRef` into policy rules. If any single binding's `RoleRef` points at a Role/ClusterRole that no longer exists (e.g. the Role was deleted but the binding wasn't cleaned up), the lookup returns a NotFound error and the code did `return` immediately — aborting the scan and silently dropping every other still-valid binding for that service account from the resulting `ServiceAccountAccess` object. One stale binding therefore stripped an edge service account of access it should still have. Upstream Kubernetes' equivalent RBAC visitor logs the error for the offending binding and continues with the rest.  **Which issue(s) this PR fixes**: Fixes #  **Special notes for your reviewer**:  Approach: changed `return` to `continue` in both the ClusterRoleBinding loop and the RoleBinding loop inside `VisitRulesFor`, so a dangling `RoleRef` only skips that one binding (still logged via the existing `klog.Errorf`) instead of aborting the whole visit. The two `List()` error paths above each loop are untouched and still `return`, since those represent a failure to read the dataset at all rather than one bad entry.  Validation: - Added `TestVisitRulesForSkipsDanglingRoleRef` in `reconcile_test.go`, covering both   loops with one resolvable and one dangling bi
  **Post-Mortem & Fix Analysis**:
  > /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubeedge/kubeedge/pull/7318#issuecomment-5770591133" title="Approved">WillardHu</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubeedge%2Fkubeedge).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubeedge/kubeedge/blob/master/OWNERS)~~ [WillardHu]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7317** (2026-09-22): **policycontroller: one dangling roleRef drops the rest of a service account's bindings**
  *Symptoms*: I tried VisitRulesFor with two ClusterRoleBindings for the same service account, one pointing at a ClusterRole that doesn't exist and one at a real one, and the access object came back with no rules at all. GetRoleReferenceRules returns an error for the missing role and the loop returns right there ([reconcile.go#L589-L593](https://github.com/kubeedge/kubeedge/blob/d062d298/cloud/pkg/policycontroller/manager/reconcile.go#L589-L593)), so every binding after it is skipped. The RoleBinding loop below does the same at [L612-L616](https://github.com/kubeedge/kubeedge/blob/d062d298/cloud/pkg/policycontroller/manager/reconcile.go#L612-L616). Upstream Kubernetes hands that error to the visitor and carries on with the rest of the bindings.  So one stale binding quietly strips a service account of access it should still have on the edge. I checked it at master d062d298 with a unit test against the fake client, and the log line was "failed to get rules for clusterrolebinding dangling". 

- **Issue #7298** (2026-09-18): **keadm: support zypper package manager**
  *Symptoms*: **What type of PR is this?**  /kind feature  **What this PR does / why we need it**:  Adds support for the `zypper` package manager in `keadm`.  Currently, `keadm` detects `apt`, `yum`, and `pacman` package managers. This PR adds `zypper` detection and introduces a `ZypperOS` implementation for hosts using the zypper package manager, including MQTT installation through zypper.  The implementation reuses the existing common KubeEdge installation and process-management logic while keeping package-manager-specific MQTT installation in `ZypperOS`.  Tests are added/updated for zypper package-manager detection and the new `ZypperOS` implementation.  **Which issue(s) this PR fixes**:  Fixes #7297  **Special notes for your reviewer**:  The full util package test suite has two environment-dependent failures in `TestRemoveContainers` because the expected CRI/containerd Unix sockets are unavailable in the test environment. The zypper-specific and package-manager tests pass.  **Does this PR introduce a user-facing change?**:  Yes. `keadm` can now detect and use the `zypper` package manager on supported hosts such as openSUSE Tumbleweed.  ```release-note Add zypper package manager support to keadm.
  **Post-Mortem & Fix Analysis**:
  > Welcome @chandan009s! It looks like this is your first PR to kubeedge/kubeedge 🎉
  > /lgtm
  > @WillardHu can u review again, just added the copyrights, so the lgtm label has been removed!!

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

### Incident Patch 1: `cd73fe75` (2026-09-23)
**Commit Message**: Merge pull request #7293 from Rucha0901/fix-typos-comments

Cleanup: Fix spelling mistakes in code comments

**File**: `cloud/pkg/dynamiccontroller/application/selector.go` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import (
 	"github.com/kubeedge/kubeedge/pkg/metaserver/util"
 )
 
-// TODO: how to solve json marshal unmashal problem against labels.Selector or fields.Selector?
+// TODO: how to solve json marshal unmarshal problem against labels.Selector or fields.Selector?
 type LabelFieldSelector struct {
 	Label labels.Selector
 	Field fields.Selector
```

**File**: `pkg/viaduct/pkg/conn/conn.go` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import (
 )
 
 // connection states
-// TODO: add connection state filed
+// TODO: add connection state field
 type ConnectionState struct {
 	State            string
 	Headers          http.Header
```

---

### Incident Patch 2: `8b224c3d` (2026-09-15)
**Commit Message**: Merge pull request #7285 from adity1raut/fix/crio-mapper-image-import

tests: fix modbus mapper image import for the cri-o e2e job

**File**: `tests/scripts/generate_mapper.sh` (modified, +14/-3)
```diff
@@ -60,16 +60,27 @@ docker build -f Dockerfile_nostream -t ${mapper_image} . && echo "successfully b
 docker save -o modbus-mapper.tar ${mapper_image}
 
 if [[ "${CONTAINER_RUNTIME}" = "cri-o" ]]; then
-  # Keep the short mapper image name used by the e2e deployment.
+  # CRI-O resolves the short image name used by the e2e deployment to
+  # docker.io/library/<name>, so the image has to be stored under that name.
+  # A podman tag with a short target name stores localhost/<name> instead,
+  # which CRI-O never finds, so always tag with the fully qualified name.
+  crio_mapper_image=docker.io/library/${mapper_image}
+  # Depending on the podman release, the loaded archive is named either after
+  # the repository:tag it was saved with or localhost/v1.0.0:latest, so take
+  # the name from the load output.
   load_output=$(sudo podman load -i modbus-mapper.tar)
   echo "${load_output}"
   loaded_image=$(printf '%s\n' "${load_output}" | awk -F': ' '/^Loaded image/ {print $2}' | tail -n 1)
   if [[ -z "${loaded_image}" ]]; then
     echo "failed to detect loaded modbus mapper image name"
     exit 1
   fi
-  if [[ "${loaded_image}" != "${mapper_image}" ]]; then
-    sudo podman tag "${loaded_image}" "${mapper_image}"
+  if [[ "${loaded_image}" != "${crio_mapper_image}" ]]; then
+    sudo podman tag "${loaded_image}" "${crio_mapper_image}"
+  fi
+  if ! sudo podman image exists "${crio_mapper_image}"; then
+    echo "modbus mapper image ${crio_mapper_image} not found in CRI-O storage"
+    exit 1
   fi
   echo "successfully import modbus mapper image to CRI-O"
 elif [[ "${CONTAINER_RUNTIME}" = "isulad" ]]; then
```

---

### Incident Patch 3: `617a496c` (2026-09-03)
**Commit Message**: tests: fix modbus mapper image import for the cri-o e2e job

The cri-o container runtime e2e job is still failing on master after
#7263. The mapper image is now imported, but the modbus-mapper pod
never leaves Pending and E2E_MAPPER_1 times out:

  Loaded image(s): localhost/v1.0.0:latest
  + sudo podman tag localhost/v1.0.0:latest modbus-e2e-mapper:v1.0.0
  successfully import modbus mapper image to CRI-O
  ...
  Wait for pods come into running status timeout: 4m0s

#7263 takes the loaded image name from the podman load output, which
handles podman releases naming the archive either localhost/v1.0.0:latest
or after its original repository:tag. It then tags the image with the
short name modbus-e2e-mapper:v1.0.0, which podman stores as
localhost/modbus-e2e-mapper:v1.0.0. CRI-O resolves the short image name
in the e2e deployment to docker.io/library/modbus-e2e-mapper:v1.0.0, so
the image is not found locally and the pod cannot start.

Keep reading the loaded name from the load output, but tag it with the
fully qualified docker.io/library name CRI-O looks up, and fail the
import step if that image is still missing so the problem surfaces here
instead of as a pod timeout later.

Signed

**File**: `tests/scripts/generate_mapper.sh` (modified, +14/-3)
```diff
@@ -60,16 +60,27 @@ docker build -f Dockerfile_nostream -t ${mapper_image} . && echo "successfully b
 docker save -o modbus-mapper.tar ${mapper_image}
 
 if [[ "${CONTAINER_RUNTIME}" = "cri-o" ]]; then
-  # Keep the short mapper image name used by the e2e deployment.
+  # CRI-O resolves the short image name used by the e2e deployment to
+  # docker.io/library/<name>, so the image has to be stored under that name.
+  # A podman tag with a short target name stores localhost/<name> instead,
+  # which CRI-O never finds, so always tag with the fully qualified name.
+  crio_mapper_image=docker.io/library/${mapper_image}
+  # Depending on the podman release, the loaded archive is named either after
+  # the repository:tag it was saved with or localhost/v1.0.0:latest, so take
+  # the name from the load output.
   load_output=$(sudo podman load -i modbus-mapper.tar)
   echo "${load_output}"
   loaded_image=$(printf '%s\n' "${load_output}" | awk -F': ' '/^Loaded image/ {print $2}' | tail -n 1)
   if [[ -z "${loaded_image}" ]]; then
     echo "failed to detect loaded modbus mapper image name"
     exit 1
   fi
-  if [[ "${loaded_image}" != "${mapper_image}" ]]; then
-    sudo podman tag "${loaded_image}" "${mapper_image}"
+  if [[ "${loaded_image}" != "${crio_mapper_image}" ]]; then
+    sudo podman tag "${loaded_image}" "${crio_mapper_image}"
+  fi
+  if ! sudo podman image exists "${crio_mapper_image}"; then
+    echo "modbus mapper image ${crio_mapper_image} not found in CRI-O storage"
+    exit 1
   fi
   echo "successfully import modbus mapper image to CRI-O"
 elif [[ "${CONTAINER_RUNTIME}" = "isulad" ]]; then
```

---

### Incident Patch 4: `12532aba` (2026-09-14)
**Commit Message**: Merge pull request #7287 from adity1raut/fix/edgecontroller-createnode-swallowed-patch-error

edgecontroller: report failures to patch reserved node labels

**File**: `cloud/pkg/edgecontroller/controller/upstream.go` (modified, +11/-2)
```diff
@@ -564,9 +564,18 @@ func (uc *UpstreamController) createNode(nodeID, name string, node *v1.Node) (*v
 	node.Annotations[common.EdgeMappingCloudKey] = localIP
 	node, err = uc.kubeClient.CoreV1().Nodes().Create(utilcontext.WithEdgeNode(context.Background(), nodeID), node, metaV1.CreateOptions{})
 	if err == nil && len(kubernetesReversedLabels) > 0 {
-		patchBytes, err := json.Marshal(map[string]interface{}{"metadata": map[string]interface{}{"labels": kubernetesReversedLabels}})
+		// Assign to the enclosing err rather than declaring a new one, so that a
+		// failure to add the reserved labels is reported to the caller instead of
+		// being reported as a successful registration. Keep the created node on
+		// failure, it exists in the cluster even when the patch did not apply.
+		var patchBytes []byte
+		patchBytes, err = json.Marshal(map[string]interface{}{"metadata": map[string]interface{}{"labels": kubernetesReversedLabels}})
 		if err == nil {
-			node, err = uc.kubeClient.CoreV1().Nodes().Patch(context.TODO(), name, patchtypes.MergePatchType, patchBytes, metaV1.PatchOptions{})
+			var patchedNode *v1.Node
+			patchedNode, err = uc.kubeClient.CoreV1().Nodes().Patch(context.TODO(), name, patchtypes.MergePatchType, patchBytes, metaV1.PatchOptions{})
+			if err == nil {
+				node = patchedNode
+			}
 		}
 	}
 	return node, err
```

**File**: `cloud/pkg/edgecontroller/controller/upstream_test.go` (modified, +45/-0)
```diff
@@ -33,9 +33,11 @@ import (
 	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/api/resource"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/informers"
 	"k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
 
 	"github.com/stretchr/testify/require"
 
@@ -1383,3 +1385,46 @@ func TestUnmarshalPodStatusMessage(t *testing.T) {
 		t.Errorf("expected nil podStatuses on single pod unmarshal error, got %v", resSingleInvalid)
 	}
 }
+
+func TestCreateNodeReservedLabelPatch(t *testing.T) {
+	newNode := func() *corev1.Node {
+		return &corev1.Node{
+			ObjectMeta: metav1.ObjectMeta{
+				Name: "edge-node",
+				Labels: map[string]string{
+					"kubernetes.io/os": "linux",
+					"custom-label":     "value",
+				},
+			},
+		}
+	}
+
+	t.Run("patch failure is reported to the caller", func(t *testing.T) {
+		kubeClient := fake.NewSimpleClientset()
+		kubeClient.PrependReactor("patch", "nodes",
+			func(k8stesting.Action) (bool, runtime.Object, error) {
+				return true, nil, errors.New("patch nodes failed")
+			})
+		uc := &UpstreamController{kubeClient: kubeClient}
+
+		node, err := uc.createNode("edge-node", "edge-node", newNode())
+
+		require.Error(t, err, "a failed reserved label patch must not be reported as a successful registration")
+		require.Contains(t, err.Error(), "patch nodes failed")
+		// The node was created, so it is still returned for the caller to report on.
+		require.NotNil(t, node)
+		require.Equal(t, "edge-node", node.Name)
+	})
+
+	t.Run("reserved labels are applied on success", func(t *testing.T) {
+		kubeClient := fake.NewSimpleClientset()
+		uc := &UpstreamController{kubeClient: kubeClient}
+
+		node, err := uc.createNode("edge-node", "edge-node", newNode())
+
+		require.NoError(t, err)
+		require.NotNil(t, node)
+		require.Equal(t, "linux", node.Labels["kubernetes.io/os"])
+		require.Equal(t, "value", node.Labels["custom-label"])
+	})
+}
```

---

### Incident Patch 5: `57dfc315` (2026-09-12)
**Commit Message**: Cleanup: Fix spelling mistakes in code comments

Signed-off-by: Rucha0901 <imt_2025071@iiitm.ac.in>

**File**: `cloud/pkg/dynamiccontroller/application/selector.go` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import (
 	"github.com/kubeedge/kubeedge/pkg/metaserver/util"
 )
 
-// TODO: how to solve json marshal unmashal problem against labels.Selector or fields.Selector?
+// TODO: how to solve json marshal unmarshal problem against labels.Selector or fields.Selector?
 type LabelFieldSelector struct {
 	Label labels.Selector
 	Field fields.Selector
```

**File**: `pkg/viaduct/pkg/conn/conn.go` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import (
 )
 
 // connection states
-// TODO: add connection state filed
+// TODO: add connection state field
 type ConnectionState struct {
 	State            string
 	Headers          http.Header
```

---

### Incident Patch 6: `62940139` (2026-09-11)
**Commit Message**: Merge pull request #7284 from adity1raut/fix/cloudhub-ack-channel-double-close

cloudhub: fix panic on double close of the ack channel

**File**: `cloud/pkg/cloudhub/session/node_session.go` (modified, +6/-2)
```diff
@@ -125,10 +125,14 @@ func (ns *NodeSession) KeepAliveMessage() {
 
 // ReceiveMessageAck receive the message ack from edge node
 func (ns *NodeSession) ReceiveMessageAck(parentID string) {
-	ackChan, exist := ns.ackMessageCache.Load(parentID)
+	// LoadAndDelete is atomic, so that only one caller can obtain the ack channel
+	// and close it. The same message is resent several times by sendMessageWithRetry,
+	// hence duplicated acks carrying the same parentID are expected, and they may be
+	// handled concurrently. A separate Load and Delete would let two of them close
+	// the same channel and panic.
+	ackChan, exist := ns.ackMessageCache.LoadAndDelete(parentID)
 	if exist {
 		close(ackChan.(chan struct{}))
-		ns.ackMessageCache.Delete(parentID)
 	}
 }
 
```

**File**: `cloud/pkg/cloudhub/session/node_session_test.go` (modified, +33/-0)
```diff
@@ -340,6 +340,39 @@ func TestNodeSessionSendAckMessage(t *testing.T) {
 	}
 }
 
+// TestNodeSessionReceiveMessageAckConcurrently verifies that duplicated acks
+// carrying the same parentID, which sendMessageWithRetry makes an expected case
+// by resending the same message, do not close the ack channel more than once.
+func TestNodeSessionReceiveMessageAckConcurrently(t *testing.T) {
+	const (
+		rounds     = 20000
+		concurrent = 4
+		parentID   = "1c5d1a1a-4b0c-4a2f-9d38-4c1a08c1b0e6"
+	)
+
+	for i := 0; i < rounds; i++ {
+		ns := &NodeSession{}
+		ns.ackMessageCache.Store(parentID, make(chan struct{}))
+
+		var start, done sync.WaitGroup
+		start.Add(1)
+		done.Add(concurrent)
+		for j := 0; j < concurrent; j++ {
+			go func() {
+				defer done.Done()
+				start.Wait()
+				ns.ReceiveMessageAck(parentID)
+			}()
+		}
+		start.Done()
+		done.Wait()
+
+		if _, exist := ns.ackMessageCache.Load(parentID); exist {
+			t.Fatalf("ack channel of %s was not removed from the cache", parentID)
+		}
+	}
+}
+
 func normalSimulateMessageFunc(pool *common.NodeMessagePool, messages []*beehivemodel.Message) {
 	for _, message := range messages {
 		enqueueAckMessage(pool, message)
```

---

### Incident Patch 7: `ffa4a0e2` (2026-09-11)
**Commit Message**: Merge pull request #6966 from ryoheimorimoto/fix/viaduct-ws-read-deadline

fix(viaduct): respect read deadline on WSConnection

**File**: `edge/pkg/edgehub/clients/wsclient/websocket.go` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@ func (wsc *WebSocketClient) Init() error {
 
 	option := wsclient.Options{
 		HandshakeTimeout: wsc.config.HandshakeTimeout,
+		ReadDeadline:     wsc.config.ReadDeadline,
 		TLSConfig:        tlsConfig,
 		Type:             api.ProtocolTypeWS,
 		Addr:             wsc.config.URL,
```

**File**: `pkg/viaduct/pkg/client/client.go` (modified, +9/-0)
```diff
@@ -36,6 +36,15 @@ type Options struct {
 	AutoRoute bool
 	// HandshakeTimeout is the maximum duration that the cryptographic handshake may take.
 	HandshakeTimeout time.Duration
+	// ReadDeadline is a per-iteration read deadline applied by the WebSocket
+	// transport (handleMessage in pkg/viaduct/pkg/conn/ws.go). It surfaces a
+	// stalled half-open TCP connection as a read error within ReadDeadline
+	// instead of waiting for the kernel TCP retransmission timeout
+	// (tcp_retries2, ~15min on Linux). Currently honored only by the
+	// WebSocket transport; QUIC has the same defect (SetReadDeadline is a
+	// no-op there too) and will be addressed in a separate PR. Zero means
+	// no read deadline (legacy behavior).
+	ReadDeadline time.Duration
 	// consumer for raw data
 	Consumer io.Writer
 }
```

**File**: `pkg/viaduct/pkg/client/ws.go` (modified, +2/-1)
```diff
@@ -66,7 +66,8 @@ func (c *WSClient) Connect() (conn.Connection, error) {
 				Headers:          c.exOpts.Header.Clone(),
 				PeerCertificates: peerCerts,
 			},
-			AutoRoute: c.options.AutoRoute,
+			AutoRoute:            c.options.AutoRoute,
+			ReadDeadlineInterval: c.options.ReadDeadline,
 		}), nil
 	}
 
```

**File**: `pkg/viaduct/pkg/conn/factory.go` (modified, +7/-0)
```diff
@@ -2,6 +2,7 @@ package conn
 
 import (
 	"io"
+	"time"
 
 	"k8s.io/klog/v2"
 
@@ -30,6 +31,12 @@ type ConnectionOptions struct {
 	AutoRoute bool
 	// OnReadTransportErr
 	OnReadTransportErr func(nodeID, projectID string)
+	// ReadDeadlineInterval is applied by handleMessage to the underlying
+	// connection on every iteration so a stalled half-open TCP socket
+	// surfaces as a read error within this interval. Zero means no read
+	// deadline (legacy behavior). The duration semantics distinguish this
+	// from WSConnection.ReadDeadline (a time.Time absolute deadline).
+	ReadDeadlineInterval time.Duration
 }
 
 // get connection interface by ConnTye
```

**File**: `pkg/viaduct/pkg/conn/ws.go` (modified, +114/-23)
```diff
@@ -20,30 +20,32 @@ import (
 )
 
 type WSConnection struct {
-	WriteDeadline      time.Time
-	ReadDeadline       time.Time
-	handler            mux.Handler
-	wsConn             *websocket.Conn
-	state              *ConnectionState
-	syncKeeper         *keeper.SyncKeeper
-	connUse            api.UseType
-	consumer           io.Writer
-	autoRoute          bool
-	messageFifo        *fifo.MessageFifo
-	locker             sync.Mutex
-	OnReadTransportErr func(nodeID, projectID string)
+	WriteDeadline        time.Time
+	ReadDeadline         time.Time
+	handler              mux.Handler
+	wsConn               *websocket.Conn
+	state                *ConnectionState
+	syncKeeper           *keeper.SyncKeeper
+	connUse              api.UseType
+	consumer             io.Writer
+	autoRoute            bool
+	messageFifo          *fifo.MessageFifo
+	locker               sync.Mutex
+	OnReadTransportErr   func(nodeID, projectID string)
+	readDeadlineInterval time.Duration
 }
 
 func NewWSConn(options *ConnectionOptions) *WSConnection {
 	return &WSConnection{
-		wsConn:             options.Base.(*websocket.Conn),
-		handler:            options.Handler,
-		syncKeeper:         keeper.NewSyncKeeper(),
-		state:              options.State,
-		connUse:            options.ConnUse,
-		autoRoute:          options.AutoRoute,
-		messageFifo:        fifo.NewMessageFifo(),
-		OnReadTransportErr: options.OnReadTransportErr,
+		wsConn:               options.Base.(*websocket.Conn),
+		handler:              options.Handler,
+		syncKeeper:           keeper.NewSyncKeeper(),
+		state:                options.State,
+		connUse:              options.ConnUse,
+		autoRoute:            options.AutoRoute,
+		messageFifo:          fifo.NewMessageFifo(),
+		OnReadTransportErr:   options.OnReadTransportErr,
+		readDeadlineInterval: options.ReadDeadlineInterval,
 	}
 }
 
@@ -99,16 +101,105 @@ func (conn *WSConnection) handleRawData() {
 	}
 }
 
+// pingLoop keeps guaranteed inbound traffic flowing on an otherwise idle
+// connection by sending WebSocket protocol pings every half of
+// readDeadlineInterval. The pongs sent back by the peer (gorilla answers
+// pings automatically as long as its read loop is running) reset the read
+// deadline via the pong handler registered in handleMessage, so the deadline
+// only expires when the connection is genuinely stalled.
+func (conn *WSConnection) pingLoop(stop <-chan struct{}) {
+	period := conn.readDeadlineInterval / 2
+	if period <= 0 {
+		// In-repo configuration is int32 seconds (>= 1s), but the field
+		// takes a raw Duration: guard the integer division against sub-2ns
+		// values so NewTicker cannot panic.
+		period = time.Millisecond
+	}
+	ticker := time.NewTicker(period)
+	defer ticker.Stop()
+	for {
+		select {
+		case <-stop:
+			return
+		case <-ticker.C:
+			// WriteControl is safe for concurrent use with the data-plane
+			// writes going through conn.locker.
+			if err := conn.wsConn.WriteControl(websocket.PingMessage, nil, time.Now().Add(period)); err != nil {
+				var netErr net.Error
+				if errors.As(err, &netErr) && netErr.Timeout() {
+					// The write lock was held past the deadline (e.g. a
+					// large message on a slow link); the connection may
+					// well be healthy. Keep pinging — liveness is judged
+					// by the read deadline, not here.
+					continue
+				}
+				// If handleMessage already tore the connection down (stop is
+				// closed), this error is a consequence of that shutdown, not a
+				// new failure: exit quietly without a misleading log or a
+				// double close.
+				select {
+				case <-stop:
+					return
+				default:
+				}
+				// The connection is gone (closed or broken); close it so the
+				// read loop unblocks immediately instead of waiting for the
+				// read deadline to expire.
+				klog.V(2).Infof("ping loop stopped: %v", err)
+				_ = conn.wsConn.Close()
+				return
+			}
+		}
+	}
+}
+
 func (conn *WSConnection) handleMessage() {
+	if conn.readDeadlineInterval > 0 {
+
```

---

### Incident Patch 8: `f35d08df` (2026-09-11)
**Commit Message**: Merge pull request #6888 from Priyanshubhartistm/fix/metaserver-count-panic

fix: edge/metaserver: replace Count panic with sentinel error in sqlite store

**File**: `edge/pkg/metamanager/metaserver/kubernetes/storage/sqlite/store.go` (modified, +8/-2)
```diff
@@ -2,6 +2,7 @@ package sqlite
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"reflect"
 	"strconv"
@@ -25,6 +26,11 @@ import (
 	"github.com/kubeedge/kubeedge/pkg/metaserver/util"
 )
 
+// ErrCountUnsupported is returned by Count to signal that the operation is
+// not implemented by this SQLite-backed store. Callers can test for it with
+// errors.Is.
+var ErrCountUnsupported = errors.New("Count is not supported by the edge SQLite store")
+
 /*
 This file is designed to encapsulate the Imitator as Store.Interface,
 */
@@ -138,8 +144,8 @@ func (s *store) GuaranteedUpdate(context.Context, string, runtime.Object, bool,
 	panic("Do not call this function")
 }
 
-func (s *store) Count(string) (int64, error) {
-	panic("implement me")
+func (s *store) Count(_ string) (int64, error) {
+	return 0, ErrCountUnsupported
 }
 
 func (s *store) RequestWatchProgress(context.Context) error {
```

**File**: `edge/pkg/metamanager/metaserver/kubernetes/storage/sqlite/store_test.go` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+/*
+Copyright 2026 The KubeEdge Authors.
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
+package sqlite
+
+import (
+	"errors"
+	"testing"
+)
+
+// TestCountReturnsErrorAndDoesNotPanic verifies that Count:
+//  1. does not panic (regression guard against the original panic("implement me"))
+//  2. returns exactly 0 as the count
+//  3. returns a non-nil error
+//  4. returns ErrCountUnsupported so callers can use errors.Is
+func TestCountReturnsErrorAndDoesNotPanic(t *testing.T) {
+	s := &store{}
+
+	// Ensure Count does not panic.
+	defer func() {
+		if r := recover(); r != nil {
+			t.Errorf("Count panicked: %v", r)
+		}
+	}()
+
+	count, err := s.Count("any/key")
+
+	if count != 0 {
+		t.Errorf("Count() count = %d, want 0", count)
+	}
+
+	if err == nil {
+		t.Error("Count() error = nil, want non-nil error")
+	}
+
+	if !errors.Is(err, ErrCountUnsupported) {
+		t.Errorf("Count() error = %v, want errors.Is(err, ErrCountUnsupported) == true", err)
+	}
+}
```

---

### Incident Patch 9: `63ecac7a` (2026-09-10)
**Commit Message**: Merge pull request #7255 from Priyanshu6968/fixes/#7254

admissioncontroller: reject AdmissionReview with no request

**File**: `cloud/pkg/admissioncontroller/common.go` (modified, +9/-0)
```diff
@@ -3,6 +3,7 @@ package admissioncontroller
 import (
 	"context"
 	"encoding/json"
+	"errors"
 	"io"
 	"net/http"
 
@@ -62,6 +63,9 @@ func registerMutatingWebhook(client admissionregistrationv1client.MutatingWebhoo
 	return nil
 }
 
+// errNilAdmissionRequest is returned when a decoded AdmissionReview carries no request.
+var errNilAdmissionRequest = errors.New("the request field of the AdmissionReview is nil")
+
 // hookFunc is the type we use for all of our validators and mutators
 type hookFunc func(admissionv1.AdmissionReview) *admissionv1.AdmissionResponse
 
@@ -92,6 +96,11 @@ func serve(w http.ResponseWriter, r *http.Request, hook hookFunc) {
 	if _, _, err := deserializer.Decode(body, nil, &requestedAdmissionReview); err != nil {
 		klog.Errorf("decode failed with error: %v", err)
 		responseAdmissionReview.Response = toAdmissionResponse(err)
+	} else if requestedAdmissionReview.Request == nil {
+		// Every hook dereferences the request, so reject the review here
+		// instead of letting the hook panic on a nil pointer.
+		klog.Errorf("invalid admission review: %v", errNilAdmissionRequest)
+		responseAdmissionReview.Response = toAdmissionResponse(errNilAdmissionRequest)
 	} else {
 		responseAdmissionReview.Response = hook(requestedAdmissionReview)
 		// Return the same UID
```

**File**: `cloud/pkg/admissioncontroller/common_test.go` (modified, +20/-0)
```diff
@@ -3,6 +3,7 @@ package admissioncontroller
 import (
 	"bytes"
 	"context"
+	"encoding/json"
 	"errors"
 	"io"
 	"net/http"
@@ -169,6 +170,25 @@ func TestServe(t *testing.T) {
 		}, hookfn)
 	})
 
+	t.Run("nil admission request", func(t *testing.T) {
+		assert := assert.New(t)
+
+		w := httpfake.NewResponseWriter()
+		raw := "{\"apiVersion\": \"admission.k8s.io/v1\", \"kind\": \"AdmissionReview\"}"
+		serve(w, &http.Request{
+			Header: map[string][]string{
+				"Content-Type": {"application/json"},
+			},
+			Body: io.NopCloser(bytes.NewReader([]byte(raw))),
+		}, hookfn)
+
+		responseAdmissionReview := admissionv1.AdmissionReview{}
+		assert.NoError(json.Unmarshal(w.Body, &responseAdmissionReview))
+		assert.NotNil(responseAdmissionReview.Response)
+		assert.False(responseAdmissionReview.Response.Allowed)
+		assert.Equal(errNilAdmissionRequest.Error(), responseAdmissionReview.Response.Result.Message)
+	})
+
 	t.Run("handle hook func", func(_ *testing.T) {
 		raw := "{\"request\": {\"uid\": \"1\"}}"
 		serve(w, &http.Request{
```

---

### Incident Patch 10: `1ebd6300` (2026-09-10)
**Commit Message**: Merge pull request #7257 from Priyanshu6968/fixes/#7256

controllermanager: let the manager own the node cache

**File**: `cloud/pkg/controllermanager/controllermanager.go` (modified, +3/-38)
```diff
@@ -2,20 +2,16 @@ package controllermanager
 
 import (
 	"context"
-	"errors"
 	"fmt"
 	"net/http"
 
-	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/runtime/serializer/json"
 	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
 	"k8s.io/client-go/kubernetes/scheme"
 	"k8s.io/client-go/rest"
 	"k8s.io/klog/v2"
 	controllerruntime "sigs.k8s.io/controller-runtime"
-	"sigs.k8s.io/controller-runtime/pkg/cache"
-	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/manager"
 	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 
@@ -62,48 +58,17 @@ func NewControllerManager(ctx context.Context, kubeCfg *rest.Config, healthProbe
 		return nil, fmt.Errorf("failed to add readyz check, err: %v", err)
 	}
 
-	che, err := newAndStartCache(ctx, kubeCfg)
-	if err != nil {
-		return nil, err
-	}
-
-	if err := setupControllers(ctx, mgr, che); err != nil {
+	if err := setupControllers(ctx, mgr); err != nil {
 		return nil, err
 	}
 	return mgr, nil
 }
 
-func newAndStartCache(ctx context.Context, kubeCfg *rest.Config,
-) (che cache.Cache, err error) {
-	che, err = cache.New(kubeCfg, cache.Options{
-		// Register resources that need to be cached.
-		ByObject: map[client.Object]cache.ByObject{
-			&corev1.Node{}: {},
-		},
-	})
-	if err != nil {
-		err = fmt.Errorf("failed to create the cache, err: %v", err)
-		return
-	}
-	go func() {
-		err = che.Start(ctx)
-	}()
-	synced := che.WaitForCacheSync(ctx)
-	if err != nil {
-		err = fmt.Errorf("failed to start the cache, err: %v", err)
-		return
-	}
-	if !synced {
-		err = errors.New("could not sync the cache")
-		return
-	}
-	return
-}
-
-func setupControllers(ctx context.Context, mgr manager.Manager, che cache.Cache) error {
+func setupControllers(ctx context.Context, mgr manager.Manager) error {
 	serializer := json.NewSerializerWithOptions(json.DefaultMetaFactory,
 		kubeedgeScheme, kubeedgeScheme, json.SerializerOptions{Yaml: true})
 	cli := mgr.GetClient()
+	che := mgr.GetCache()
 
 	ctls := []Controller{
 		nodegroup.NewController(cli),
```

**File**: `cloud/pkg/controllermanager/controllermanager_test.go` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+/*
+Copyright 2026 The KubeEdge Authors.
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
+package controllermanager
+
+import (
+	"context"
+	"net/http"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"k8s.io/apimachinery/pkg/api/meta"
+	"k8s.io/client-go/rest"
+	"k8s.io/utils/ptr"
+	controllerruntime "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/config"
+)
+
+// unreachableAPIServer is a host no API server listens on, so that the tests
+// never reach a real cluster.
+const unreachableAPIServer = "127.0.0.1:1"
+
+// newTestRESTMapper maps every kind of the kubeedge scheme, so that the manager
+// can set up its informers without discovering the kinds from an API server.
+func newTestRESTMapper() meta.RESTMapper {
+	mapper := meta.NewDefaultRESTMapper(nil)
+	for gvk := range kubeedgeScheme.AllKnownTypes() {
+		mapper.Add(gvk, meta.RESTScopeNamespace)
+	}
+	return mapper
+}
+
+func TestSetupControllers(t *testing.T) {
+	mgr, err := controllerruntime.NewManager(&rest.Config{Host: unreachableAPIServer}, controllerruntime.Options{
+		Scheme: kubeedgeScheme,
+		// Controller names are registered process wide, so skip the uniqueness
+		// check to keep this test repeatable.
+		Controller: config.Controller{SkipNameValidation: ptr.To(true)},
+		MapperProvider: func(_ *rest.Config, _ *http.Client) (meta.RESTMapper, error) {
+			return newTestRESTMapper(), nil
+		},
+	})
+	require.NoError(t, err)
+
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	// Every controller, including the node task ones that used to be given a
+	// separate cache, is set up with the cache owned by the manager.
+	assert.NoError(t, setupControllers(ctx, mgr))
+}
+
+func TestNewControllerManager(t *testing.T) {
+	// Setting up the controllers needs the API server, so it fails here and the
+	// error has to be returned instead of a manager.
+	mgr, err := NewControllerManager(context.Background(), &rest.Config{Host: unreachableAPIServer}, "")
+	assert.Error(t, err)
+	assert.Nil(t, mgr)
+}
```

#### Recent Merged Pull Requests:
- **PR #7343** (closed): controllermanager: escape resource names in JSON patch paths (@nzy0804)
- **PR #7342** (closed): controllermanager: escape resource names in JSON patch paths (@nzy0804)
- **PR #7324** (2026-09-23): Upgrade golang to 1.25.14 (@Shelley-BaoYue)
- **PR #7323** (2026-09-22): ci: use GitHub-hosted ARM64 runners (@Shelley-BaoYue)
- **PR #7322** (2026-09-22): bump Go version to v1.25.14 for build-tools basic image (@Shelley-BaoYue)
- **PR #7318** (2026-09-22): policycontroller: don't abort VisitRulesFor on a dangling roleRef (@pujitha24)
- **PR #7298** (2026-09-18): keadm: support zypper package manager (@chandan009s)
- **PR #7293** (2026-09-23): Cleanup: Fix spelling mistakes in code comments (@Rucha0901)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
