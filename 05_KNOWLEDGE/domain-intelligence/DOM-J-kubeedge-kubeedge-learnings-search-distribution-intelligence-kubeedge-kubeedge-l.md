# Domain J — Search & Distribution Intelligence: Search & Distribution Intelligence: kubeedge-kubeedge-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "kubeedge-kubeedge-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T17:34:06.952Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kubeedge-kubeedge-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kubeedge-kubeedge-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T17:34:06.952Z`  
> **Learning ID**: `LEARN-EVO-kubeedge-kubeedge-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain J (Search & Distribution Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from kubeedge-kubeedge-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubeedge-kubeedge-learnings.md`  
> **Source**: github ([https://github.com/kubeedge/kubeedge](https://github.com/kubeedge/kubeedge))  
> **Source Version**: `ddced73b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T17:33:13.600Z  
> **Learning ID**: `learn-github-kubeedge-kubeedge`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kubeedge/kubeedge

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubeedge-kubeedge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubeedge/kubeedge](https://github.com/kubeedge/kubeedge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T17:33:13.592Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeedge/kubeedge`
- **Description**: Kubernetes Native Edge Computing Framework (project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 7644 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

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

		recordBytes, err := json.Marshal(record)
		if err != nil {
			return nil, err
		}

		tunnelPort.Annotations[modules.TunnelPortRecordAnnotationKey] = string(recordBytes)

		if _, err := kubeClient.CoreV1().ConfigMaps(constants.SystemNamespace).
			Update(ctx, tunnelPort, metav1.UpdateOptions{}); err != nil {
			return nil, err
		}

		return &port, nil
	}

	if apierror.IsNotFound(err) {
		port := negotiatePort(record.Port)
		record := iptables.TunnelPortRecord{
			IPTunnelPort: map[string]int{
				localIP: port,
			},
			Port: map[int]bool{
				port: true,
			},
		}
		recordBytes, err := json.Marshal(record)
		if err != nil {
			return nil, err
		}

		_, err = kubeClient.CoreV1().ConfigMaps(constants.SystemNamespace).Create(ctx, &v1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      modules.TunnelPort,
				Namespace: constants.SystemNamespace,
				Annotations: map[string]string{
					modules.TunnelPortRecordAnnotationKey: string(recordBytes),
				},
			},
		}, metav1.CreateOptions{})

		if err != nil {
			return nil, err
		}

		return &port, nil
	}

	return nil, errors.New("failed to negotiate the tunnel port")
}

func negotiatePort(portRecord map[int]bool) int {
	for port := constants.ServerPort; ; {
		port++
		if _, found := portRecord[port]; !found {
			return port
		}
	}
}

func updateCloudCoreConfigMap(c *v1alpha1.CloudCoreConfig) {
	kubeClient := client.GetKubeClient()

	cloudCoreCM, err := kubeClient.CoreV1().ConfigMaps(constants.SystemNamespace).Get(context.TODO(), constants.CloudConfigMapName, metav1.GetOptions{})
	if err != nil {
		klog.Warningf("failed to get CloudCore configMap %s/%s", constants.SystemNamespace, constants.CloudConfigMapName)
		return
	}

	configBytes, err := yaml.Marshal(c)
	if err != nil {
		klog.Errorf("Failed to marshal cloudcore config: %v", err)
		return
	}

	cloudCoreCM.Data["cloudcore.yaml"] = string(configBytes)

	_, err = kubeClient.CoreV1().ConfigMaps(constants.SystemNamespace).Update(context.TODO(), cloudCoreCM, meta
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

### Core Architecture Module: `cloud/pkg/common/messagelayer/util.go`
```
/*
Copyright 2022 The KubeEdge Authors.

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

package messagelayer

import (
	"errors"
	"fmt"
	"strings"

	"k8s.io/klog/v2"

	"github.com/kubeedge/beehive/pkg/core/model"
	"github.com/kubeedge/kubeedge/common/constants"
	pkgutil "github.com/kubeedge/kubeedge/pkg/util"
)

const (
	ResourceNode = "node"

	ResourceNodeIDIndex       = 1
	ResourceNamespaceIndex    = 2
	ResourceResourceTypeIndex = 3
	ResourceResourceNameIndex = 4

	ResourceDeviceIndex          = 2
	ResourceDeviceNamespaceIndex = 3

	ResourceDevice               = "device"
	ResourceTypeTwinEdgeUpdated  = "twin/edge_updated"
	ResourceTypeMembershipDetail = "membership/detail"
	ResourceDeviceStateUpdated   = "state/update"
)

// BuildResource return a string as "beehive/pkg/core/model".Message.Router.Resource
func BuildResource(nodeID, namespace, resourceType, resourceID string) (resource string, err error) {
	if namespace == "" || resourceType == "" || nodeID == "" {
		err = fmt.Errorf("required parameter are not set (node id, namespace or resource type)")
		return
	}

	resource = fmt.Sprintf("%s%s%s%s%s%s%s", ResourceNode, constants.ResourceSep, nodeID, constants.ResourceSep, namespace, constants.ResourceSep, resourceType)
	if resourceID != "" {
		resource += fmt.Sprintf("%s%s", constants.ResourceSep, resourceID)
	}
	return
}

// getElementByIndex returns a string from "beehive/pkg/core/model".Message.Router.Resource by index
func getElementByIndex(msg model.Message, index int) string {
	sli := strings.Split(msg.GetResource(), constants.ResourceSep)
	if len(sli) <= index {
		return ""
	}
	return sli[index]
}

// GetNodeID from "beehive/pkg/core/model".Message.Router.Resource
func GetNodeID(msg model.Message) (string, error) {
	res := getElementByIndex(msg, ResourceNodeIDIndex)
	if res == "" {
		return "", fmt.Errorf("node id not found")
	}
	klog.V(4).Infof("The node id %s, %d", res, ResourceNodeIDIndex)
	return res, nil
}

// GetNamespace from "beehive/pkg/core/model".Model.Router.Resource
func GetNamespace(msg model.Message) (string, error) {
	res := getElementByIndex(msg, ResourceNamespaceIndex)
	if res == "" {
		return "", fmt.Errorf("namespace not found")
	}
	klog.V(4).Infof("The namespace %s, %d", res, ResourceNamespaceIndex)
	return res, nil
}

// GetResourceType from "beehive/pkg/core/model".Model.Router.Resource
func GetResourceType(msg model.Message) (string, error) {
	res := getElementByIndex(msg, ResourceResourceTypeIndex)
	if res == "" {
		return "", fmt.Errorf("resource type not found")
	}
	klog.V(4).Infof("The resource type is %s, %d", res, ResourceResourceTypeIndex)
	return res, nil
}

// GetResourceName from "beehive/pkg/core/model".Model.Router.Resource
func GetResourceName(msg model.Message) (string, error) {
	res := getElementByIndex(msg, ResourceResourceNameIndex)
	if res == "" {
		return "", fmt.Errorf("resource name not found")
	}
	klog.V(4).Infof("The resource name is %s, %d", res, ResourceResourceNameIndex)
	return res, nil
}

// BuildResourceForRouter return a string as "beehive/pkg/core/model".Message.Router.Resource
func BuildResourceForRouter(resourceType, resourceID string) (string, error) {
	if resourceID == "" || resourceType == "" {
		return "", fmt.Errorf("required parameter are not set (resourceID or resource type)")
	}
	return pkgutil.ConcatStrings(resourceType, constants.ResourceSep, resourceID), nil
}

// BuildResourceForDevice return a string as "beehive/pkg/core/model".Message.Router.Resource
func BuildResourceForDevice(nodeID, resourceType, resourceID string) (resource string, err error) {
	if nodeID == "" || resourceType == "" {
		err = fmt.Errorf("required parameter are not set (node id, namespace or resource type)")
		return
	}
	resource = fmt.Sprintf("%s%s%s%s%s", ResourceNode, constants.ResourceSep, nodeID, constants.ResourceSep, resourceType)
	if resourceID != "" {
		resource += fmt.Sprintf("%s%s", constants.ResourceSep, resourceID)
	}
	return
}

// GetDeviceID returns the ID of the device,resource's format:$hw/events/device/{namespace}/{deviceName}
func GetDeviceID(resource string) (string, error) {
	res := strings.Split(resource, "/")
	if len(res) >= ResourceDeviceNamespaceIndex+2 && res[ResourceDeviceIndex] == ResourceDevice {
		return res[ResourceDeviceNamespaceIndex] + "/" + res[ResourceDeviceNamespaceIndex+1], nil
	}
	return "", errors.New("failed to get device id")
}

// GetResourceTypeForDevice returns the resourceType of message received from edge
func GetResourceTypeForDevice(resource string) (string, error) {
	if strings.Contains(resource, ResourceTypeTwinEdgeUpdated) {
		return ResourceTypeTwinEdgeUpdated, nil
	} else if strings.Contains(resource, ResourceTypeMembershipDetail) {
		return ResourceTypeMembershipDetail, nil
	} else if strings.Contains(resource, ResourceDeviceStateUpdated) {
		return ResourceDeviceStateUpdated, nil
	}
	return "", fmt.Errorf("unknown resource, found: %s", resource)
}

```

### Core Architecture Module: `cloud/pkg/controllermanager/edgeapplication/utils/utils.go`
```
package utils

import (
	"fmt"

	core "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/errors"
	"k8s.io/klog/v2"

	appsv1alpha1 "github.com/kubeedge/api/apis/apps/v1alpha1"
	"github.com/kubeedge/kubeedge/cloud/pkg/controllermanager/edgeapplication/overridemanager"
)

type ResourceInfo struct {
	// Ordinal is the index of the template of this resource in
	// the manifests of EdgeApplication.
	Ordinal   int    `json:"ordinal"`
	Group     string `json:"group"`
	Version   string `json:"version"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

func (c *ResourceInfo) String() string {
	return fmt.Sprintf("%d, %s/%s, kind=%s, namespace=%s, name=%s", c.Ordinal, c.Group, c.Version, c.Kind, c.Namespace, c.Name)
}

type TemplateInfo struct {
	Ordinal  int
	Template *unstructured.Unstructured
}

func IsNodeSelected(edgeapp appsv1alpha1.EdgeApplication, node core.Node) bool {
	for _, selector := range edgeapp.Spec.WorkloadScope.TargetNodeLabels {
		if selector.LabelSelector.MatchLabels != nil {
			selected := true
			// Check if all labels in the selector are matched by the node's labels
			for key, value := range selector.LabelSelector.MatchLabels {
				if _, ok := node.Labels[key]; !ok {
					selected = false
					break
				}
				if node.Labels[key] != value {
					selected = false
					break
				}
			}
			// If this node is selected by the edgeapplication, no need to check other selectors
			if selected {
				return true
			}
		}
	}
	return false
}

func GetAllOverriders(edgeApp *appsv1alpha1.EdgeApplication) []overridemanager.OverriderInfo {
	infos := make([]overridemanager.OverriderInfo, 0)

	// Handle overriders from TargetNodeGroups
	for index := range edgeApp.Spec.WorkloadScope.TargetNodeGroups {
		copied := edgeApp.Spec.WorkloadScope.TargetNodeGroups[index].Overriders.DeepCopy()
		infos = append(infos, overridemanager.OverriderInfo{
			TargetNodeGroup: edgeApp.Spec.WorkloadScope.TargetNodeGroups[index].Name,
			Overriders:      copied,
		})
	}

	// Handle overriders from TargetNodeLabels
	for index := range edgeApp.Spec.WorkloadScope.TargetNodeLabels {
		labelSelector := edgeApp.Spec.WorkloadScope.TargetNodeLabels[index].LabelSelector
		copied := edgeApp.Spec.WorkloadScope.TargetNodeLabels[index].Overriders.DeepCopy()

		infos = append(infos, overridemanager.OverriderInfo{
			TargetNodeLabelSelector: labelSelector,
			Overriders:              copied,
		})
	}

	return infos
}
func GetContainedResourceInfos(edgeApp *appsv1alpha1.EdgeApplication, yamlSerializer runtime.Serializer) ([]ResourceInfo, error) {
	tmplInfos, err := GetTemplatesInfosOfEdgeApp(edgeApp, yamlSerializer)
	if err != nil {
		return nil, fmt.Errorf("failed to get contained objs, %v", err)
	}
	infos := []ResourceInfo{}
	for _, tmplInfo := range tmplInfos {
		infos = append(infos, GetResourceInfoOfTemplateInfo(tmplInfo))
	}
	return infos, nil
}

func GetResourceInfoOfTemplateInfo(tmplInfo *TemplateInfo) ResourceInfo {
	tmpl := tmplInfo.Template
	gvk := tmpl.GroupVersionKind()
	info := ResourceInfo{
		Ordinal:   tmplInfo.Ordinal,
		Group:     gvk.Group,
		Version:   gvk.Version,
		Kind:      gvk.Kind,
		Namespace: tmpl.GetNamespace(),
		Name:      tmpl.GetName(),
	}
	return info
}

func GetTemplatesInfosOfEdgeApp(edgeApp *appsv1alpha1.EdgeApplication, yamlSerializer runtime.Serializer) ([]*TemplateInfo, error) {
	tmplInfos := []*TemplateInfo{}
	errs := []error{}
	for index, manifest := range edgeApp.Spec.WorkloadTemplate.Manifests {
		obj := &unstructured.Unstructured{}
		_, _, err := yamlSerializer.Decode(manifest.Raw, nil, obj)
		if err != nil {
			klog.Errorf("failed to decode manifest of edgeapp %s/%s, %v, manifest: %s",
				edgeApp.Namespace, edgeApp.Name, err, manifest)
			errs = append(errs, err)
			continue
		}
		tmplInfos = append(tmplInfos, &TemplateInfo{Ordinal: index, Template: obj})
	}
	return tmplInfos, errors.NewAggregate(errs)
}

func IsInitStatus(status *appsv1alpha1.ManifestStatus) bool {
	identifier := status.Identifier
	return identifier.Group == "" &&
		identifier.Version == "" &&
		identifier.Kind == "" &&
		identifier.Resource == "" &&
		identifier.Namespace == "" &&
		identifier.Name == ""
}

func IsIdentifierSameAsResourceInfo(identifier appsv1alpha1.ResourceIdentifier, info ResourceInfo) bool {
	return identifier.Group == info.Group &&
		identifier.Version == info.Version &&
		identifier.Kind == info.Kind &&
		identifier.Namespace == info.Namespace &&
		identifier.Name == info.Name
}

```

### Core Architecture Module: `cloud/pkg/csidriver/utils.go`
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

package csidriver

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"sync"

	"github.com/container-storage-interface/spec/lib/go/csi"
	"github.com/kubernetes-csi/csi-lib-utils/protosanitizer"
	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"k8s.io/klog/v2"

	"github.com/kubeedge/beehive/pkg/core/model"
	"github.com/kubeedge/kubeedge/common/constants"
)

// Constant defines csi related parameters
const (
	GroupResource            = "resource"
	DefaultNamespace         = "default"
	DefaultReceiveModuleName = "cloudhub"
)

// newNonBlockingGRPCServer creates a new nonblocking server
func newNonBlockingGRPCServer() *nonBlockingGRPCServer {
	return &nonBlockingGRPCServer{}
}

// NonBlocking server
type nonBlockingGRPCServer struct {
	wg     sync.WaitGroup
	server *grpc.Server
}

func (s *nonBlockingGRPCServer) Start(endpoint string, ids csi.IdentityServer, cs csi.ControllerServer, ns csi.NodeServer) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		err := s.serve(endpoint, ids, cs, ns)
		if err != nil {
			panic(err.Error())
		}
	}()
}

func (s *nonBlockingGRPCServer) Wait() {
	s.wg.Wait()
}

func (s *nonBlockingGRPCServer) Stop() {
	s.server.GracefulStop()
}

func (s *nonBlockingGRPCServer) ForceStop() {
	s.server.Stop()
}

func (s *nonBlockingGRPCServer) serve(endpoint string, ids csi.IdentityServer, cs csi.ControllerServer, ns csi.NodeServer) error {
	proto, addr, err := parseEndpoint(endpoint)
	if err != nil {
		klog.Error(err.Error())
		return err
	}

	if proto == "unix" {
		addr = "/" + addr
		if err := os.Remove(addr); err != nil && !os.IsNotExist(err) {
			klog.Warningf("failed to remove %s, error: %s", addr, err.Error())
		}
	}

	listener, err := net.Listen(proto, addr)
	if err != nil {
		klog.Errorf("failed to listen: %v", err)
		return err
	}

	opts := []grpc.ServerOption{
		grpc.UnaryInterceptor(logGRPC),
	}
	server := grpc.NewServer(opts...)
	s.server = server

	if ids != nil {
		csi.RegisterIdentityServer(server, ids)
	}
	if cs != nil {
		csi.RegisterControllerServer(server, cs)
	}
	if ns != nil {
		csi.RegisterNodeServer(server, ns)
	}
	klog.Infof("listening for connections on address: %#v", listener.Addr())
	return server.Serve(listener)
}

func parseEndpoint(ep string) (string, string, error) {
	if strings.HasPrefix(strings.ToLower(ep), "unix://") || strings.HasPrefix(strings.ToLower(ep), "tcp://") {
		s := strings.SplitN(ep, "://", 2)
		if s[1] != "" {
			return s[0], s[1], nil
		}
	}
	return "", "", fmt.Errorf("invalid endpoint: %v", ep)
}

func logGRPC(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	klog.Infof("grpc call: %s", info.FullMethod)
	klog.Infof("grpc request: %+v", protosanitizer.StripSecrets(req))
	resp, err := handler(ctx, req)
	if err != nil {
		klog.Errorf("grpc error: %v", err)
	} else {
		klog.Infof("grpc response: %+v", protosanitizer.StripSecrets(resp))
	}
	return resp, err
}

// buildResource return a string as "beehive/pkg/core/model".Message.Router.Resource
func buildResource(nodeID, namespace, resourceType, resourceID string) (string, error) {
	if nodeID == "" || namespace == "" || resourceType == "" {
		return "", fmt.Errorf("required parameter are not set (node id, namespace or resource type)")
	}
	resource := fmt.Sprintf("%s%s%s%s%s%s%s", "node", constants.ResourceSep, nodeID, constants.ResourceSep, namespace, constants.ResourceSep, resourceType)
	if resourceID != "" {
		resource += fmt.Sprintf("%s%s", constants.ResourceSep, resourceID)
	}
	return resource, nil
}

// sendToKubeEdge sends messages to KubeEdge
func sendToKubeEdge(context, kubeEdgeEndpoint string) (string, error) {
	us := NewUnixDomainSocket(kubeEdgeEndpoint)
	// connect
	r, err := us.Connect()
	if err != nil {
		return "", err
	}
	// send
	res, err := us.Send(r, context)
	if err != nil {
		return "", err
	}
	return res, nil
}

// extractMessage extracts message
func extractMessage(context string) (*model.Message, error) {
	var msg model.Message
	if context == "" {
		err := errors.New("failed to extract message with empty context")
		klog.Errorf("%v", err)
		return nil, err
	}

	err := json.Unmarshal([]byte(context), &msg)
	if err != nil {
		return nil, err
	}

	return &msg, nil
}

```

### Core Architecture Module: `cloud/pkg/dynamiccontroller/filter/util.go`
```
package filter

import (
	"context"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/informers"
	"k8s.io/klog/v2"

	"github.com/kubeedge/kubeedge/cloud/pkg/common/client"
	commoninformers "github.com/kubeedge/kubeedge/cloud/pkg/common/informers"
	"github.com/kubeedge/kubeedge/cloud/pkg/controllermanager/nodegroup"
)

func IsBelongToSameGroup(targetNodeName string, epNodeName string) bool {
	// Return true if both node names are the same
	if targetNodeName == epNodeName {
		return true
	}

	var getNode func(string) (interface{}, error)

	// Define a function to get the node based on whether the informer is synced
	if !GetDynamicResourceInformer(v1.SchemeGroupVersion.WithResource("nodes")).Informer().HasSynced() {
		klog.Info("nodes informer has not synced yet")
		getNode = func(nodeName string) (interface{}, error) {
			return client.GetDynamicClient().Resource(v1.SchemeGroupVersion.WithResource("nodes")).Get(context.TODO(), nodeName, metav1.GetOptions{})
		}
	} else {
		getNode = func(nodeName string) (interface{}, error) {
			return GetDynamicResourceInformer(v1.SchemeGroupVersion.WithResource("nodes")).Lister().Get(nodeName)
		}
	}

	// Get the target node
	targetNode, err := getNode(targetNodeName)
	if err != nil {
		klog.Errorf("failed to get target node %s: %v", targetNodeName, err)
		return false
	}

	// Get the endpoint node
	epNode, err := getNode(epNodeName)
	if err != nil {
		klog.Errorf("failed to get endpoint node %s: %v", epNodeName, err)
		return false
	}

	targetAccessor, err := meta.Accessor(targetNode)
	if err != nil {
		klog.Error(err)
		return false
	}
	epNodeAccessor, err := meta.Accessor(epNode)
	if err != nil {
		klog.Error(err)
		return false
	}

	// Compare the labels
	return targetAccessor.GetLabels()[nodegroup.LabelBelongingTo] == epNodeAccessor.GetLabels()[nodegroup.LabelBelongingTo]
}
func GetDynamicResourceInformer(gvr schema.GroupVersionResource) informers.GenericInformer {
	return commoninformers.GetInformersManager().GetDynamicInformerFactory().ForResource(gvr)
}

```

### Core Architecture Module: `cloud/pkg/router/messagelayer/util.go`
```
package messagelayer

import (
	"fmt"

	"github.com/kubeedge/kubeedge/common/constants"
)

// BuildResourceForRouter return a string as "beehive/pkg/core/model".Message.Router.Resource
func BuildResourceForRouter(namespace, resourceType, resourceID string) (string, error) {
	if namespace == "" {
		namespace = "default"
	}
	if resourceID == "" || resourceType == "" {
		return "", fmt.Errorf("required parameter are not set (resourceID or resource type)")
	}
	return fmt.Sprintf("node/nodeid/%s%s%s%s%s", namespace, constants.ResourceSep, resourceType, constants.ResourceSep, resourceID), nil
}

```

### Core Architecture Module: `cloud/pkg/router/utils/http/http.go`
```
package http

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"k8s.io/klog/v2"
)

const (
	defaultConnectTimeout            = 30 * time.Second
	defaultKeepAliveTimeout          = 30 * time.Second
	defaultResponseReadTimeout       = 300 * time.Second
	defaultMaxIdleConnectionsPerHost = 3
)

var (
	connectTimeout            = defaultConnectTimeout
	keepaliveTimeout          = defaultKeepAliveTimeout
	responseReadTimeout       = defaultResponseReadTimeout
	maxIdleConnectionsPerHost = defaultMaxIdleConnectionsPerHost
)

// NewHTTPClient create new client
func NewHTTPClient() *http.Client {
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   connectTimeout,
			KeepAlive: keepaliveTimeout,
		}).DialContext,
		MaxIdleConnsPerHost:   maxIdleConnectionsPerHost,
		ResponseHeaderTimeout: responseReadTimeout,
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
	}
	klog.Infof("tlsConfig InsecureSkipVerify true")
	return &http.Client{Transport: transport}
}

// NewHTTPSClient create https client
func NewHTTPSClient(certFile, keyFile string) (*http.Client, error) {
	pool := x509.NewCertPool()
	cliCrt, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		klog.Errorf("Cannot create https client , Load x509 key pair err: %v", err)
		return nil, err
	}
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs:      pool,
			Certificates: []tls.Certificate{cliCrt},
			MinVersion:   tls.VersionTLS12,
			CipherSuites: []uint16{
				tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			},
			InsecureSkipVerify: true}, /*Now we need set it true*/
	}
	client := &http.Client{Transport: tr, Timeout: connectTimeout}
	return client, nil
}

// NewHTTPClientWithCA create client without certificate
func NewHTTPClientWithCA(capem []byte, certificate tls.Certificate) (*http.Client, error) {
	pool := x509.NewCertPool()
	if ok := pool.AppendCertsFromPEM(capem); !ok {
		return nil, fmt.Errorf("cannot parse the certificates")
	}
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs:            pool,
			InsecureSkipVerify: false,
			Certificates:       []tls.Certificate{certificate},
		},
	}
	client := &http.Client{Transport: tr, Timeout: connectTimeout}
	return client, nil
}

// SendRequest sends a http request and return the resp info
func SendRequest(req *http.Request, client *http.Client) (*http.Response, error) {
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// BuildRequest Creates a HTTP request.
func BuildRequest(method string, urlStr string, body io.Reader, token string, nodeName string) (*http.Request, error) {
	req, err := http.NewRequest(method, urlStr, body)
	if err != nil {
		return nil, err
	}
	if token != "" {
		bearerToken := "Bearer " + token
		req.Header.Add("Authorization", bearerToken)
	}
	if nodeName != "" {
		req.Header.Add("NodeName", nodeName)
	}
	return req, nil
}

```

### Core Architecture Module: `cloud/pkg/router/utils/path.go`
```
package utils

import (
	"regexp"
	"strings"

	"k8s.io/klog/v2"
)

const (
	pathRegex = "[-A-Za-z0-9+&@#%?=~_|!:,.;]+"
	tailRegex = "/?"
)

var paramRegex = regexp.MustCompile("{" + pathRegex + "}")

// URLToURLRegex return url regex and replace {} in url,e.g.,/abc/{Aa1} to /abc/[-A-Za-z0-9+&@#%?=~_|!:,.;]+/?
func URLToURLRegex(url string) string {
	params := paramRegex.FindAllString(url, -1)
	for _, param := range params {
		url = strings.Replace(url, param, pathRegex, -1)
	}
	url = url + tailRegex
	return url
}

// IsMatch return true if the path match rule using regex
func IsMatch(reg, path string) bool {
	match, err := regexp.MatchString(URLToURLRegex(reg), path)
	if err != nil {
		klog.Errorf("failed to validate res %s and reqPath %s, err: %v", reg, path, err)
		return false
	}
	return match
}

// RuleContains return true if rule 1 contains rule 2, e.g., path /a contains /a/b
func RuleContains(rulePath, rule2Path string) bool {
	path1 := strings.Split(rulePath, "/")
	path2 := strings.Split(rule2Path, "/")
	if len(path1) == 0 {
		return true
	}

	if len(path2) == 0 {
		return false
	}

	for i := 0; i < len(path1) && i < len(path2); i++ {
		// rule1[i] contains rule2[i] when rule1[i] = {} or rule1[i] == rule2[i]
		if path1[i] != path2[i] && URLToURLRegex(path1[i]) != URLToURLRegex(path2[i]) {
			return false
		}
	}
	return true
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7476** (2026-11-20): **metamanager: key edge device edits by device name**
  *Symptoms*: **What type of PR is this?**  /kind bug  **What this PR does / why we need it**:  The metaserver PUT handler for devices sends the edited device to metamanager with the resource `<namespace>/device/updated`, and metamanager uses that resource as the meta key. The device delete path removes `<namespace>/device/<name>`, so the literal `updated` row survived a cloud delete, and `initDeviceInfoFromDB` loaded it again on the next edgecore restart, bringing a deleted device back on the node.  The handler now builds the resource from the device name, so an edge edit updates the same row that the delete path removes.  **Which issue(s) this PR fixes**:  Fixes #7319  **Special notes for your reviewer**:  `TestUpdateEdgeDeviceResourceKey` captures the message sent to metamanager and asserts the resource. It fails on master with `default/device/updated`. The tests patch `beehiveContext.SendSync` with gomonkey, so they need the `-gcflags "all=-N -l"` used by `make test`.  Check: `go test -gcflags "all=-N -l" ./edge/pkg/metamanager/...`  **Does this PR introduce a user-facing change?**:  ```release-note An edge edit of a device is now stored under the device's own meta key, so a device no longer reappears on the node after it is deleted in the cloud and edgecore restarts. 

- **Issue #7458** (2026-11-20): **nodegroup: add and remove the finalizer with a patch**
  *Symptoms*: **What type of PR is this?**  /kind bug  **What this PR does / why we need it**:  The NodeGroup controller adds and removes its finalizer with a full `Client.Update`. That re-sends the whole spec as Go marshals it, so every `omitempty` zero value is dropped from the stored NodeGroup: - `matchLabels: {}` (selects every node) is stored as no `matchLabels`, which selects none (`getNodesByLabels` returns no nodes for a nil map); - an explicit `topologyEnabled: false` is dropped, so a CRD default for that field would turn it back into `true`.  `Reconcile` and `removeFinalizer` now write the finalizer with a `client.MergeFrom` patch, which carries only `metadata.finalizers`. The patch uses `MergeFromWithOptimisticLock`: a merge patch replaces the whole finalizers list, so the `resourceVersion` lock keeps a stale read from dropping or re-adding another finalizer. It gets a conflict and a requeue, as the Update did.  **Which issue(s) this PR fixes**:  None filed.  **Special notes for your reviewer**:  New tests (fake client with an interceptor), on a NodeGroup with `topologyEnabled: false` and `matchLabels: {}`: - `TestFinalizerIsPatched`: each finalizer patch sets only `metadata.finalizers` and `metadata.resourceVersion`, the stored finalizers are right, and no full Update of a NodeGroup happens. The fake client stores Go types, so it cannot show a dropped value itself; the test checks the write that would drop one. - `TestFinalizerPatchConflictsOnStaleRead`: `removeFinalizer` on a 

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

### Incident Patch 1: `ddced73b` (2026-11-24)
**Commit Message**: Merge pull request #7307 from harshrajdebug/fix/offline-sa-token-fallback

metamanager: fall back to the cached service account token when refresh fails

**File**: `edge/pkg/metamanager/client/serviceaccount.go` (modified, +183/-26)
```diff
@@ -87,8 +87,10 @@ func requiresRefresh(tr *authenticationv1.TokenRequest) bool {
 	return false
 }
 
-// KeyFunc keys should be nonconfidential and safe to log
-func KeyFunc(name, namespace string, tr *authenticationv1.TokenRequest) string {
+// baseKey is the spec-derived key prefix that identifies the logical token
+// (independent of which generation). All generations of the same logical token
+// share this prefix. Used for prefix lookup in metaDB.
+func baseKey(name, namespace string, tr *authenticationv1.TokenRequest) string {
 	var exp int64
 	if tr.Spec.ExpirationSeconds != nil {
 		exp = *tr.Spec.ExpirationSeconds
@@ -102,34 +104,106 @@ func KeyFunc(name, namespace string, tr *authenticationv1.TokenRequest) string {
 	return fmt.Sprintf("%q/%q/%#v/%#v/%#v", name, namespace, tr.Spec.Audiences, exp, ref)
 }
 
-func getTokenLocally(name, namespace string, tr *authenticationv1.TokenRequest) (*authenticationv1.TokenRequest, error) {
-	resKey := KeyFunc(name, namespace, tr)
+// KeyFunc returns the per-generation storage key for a TokenRequest. The key
+// is the base (spec-derived) key suffixed with the token's exp timestamp so
+// that successive refreshed tokens for the same logical token are stored as
+// separate rows. This is required to keep the previous (still un-expired)
+// token's row in metaDB during the propagation window between a refresh and
+// the moment the pod re-reads the new token from its projected volume; without
+// it, MetaServer (which authenticates by checking metaDB membership) rejects
+// requests bearing the previous token.
+//
+// Callers without a populated Status.ExpirationTimestamp (i.e., callers that
+// only have a TokenRequest spec, like an upstream kubelet refresh call) should
+// not use KeyFunc — they should use baseKey and a prefix query.
+//
+// Keys are nonconfidential and safe to log.
+func KeyFunc(name, namespace string, tr *authenticationv1.TokenRequest) string {
+	base := baseKey(name, namespace, tr)
+	if tr.Status.ExpirationTimestamp.IsZero() {
+		// Defensive: a write without exp is malformed. Return base so the
+		// behavior is at worst the pre-refactor behavior (one row per
+		// logical token, overwritten on refresh). The caller should ensure
+		// Status.ExpirationTimestamp is populated.
+		return base
+	}
+	return fmt.Sprintf("%s/%d", base, tr.Status.ExpirationTimestamp.UnixNano())
+}
+
+// expired reports whether a token can no longer be used, as distinct from
+// being due for a refresh. requiresRefresh turns true at 80% of the token's
+// lifetime while the token stays usable until its ExpirationTimestamp. A token
+// carrying no expiration timestamp is treated as usable, matching
+// requiresRefresh, which declines to refresh a token whose ExpirationSeconds
+// is nil.
+func expired(tr *authenticationv1.TokenRequest) bool {
+	if tr.Status.ExpirationTimestamp.IsZero() {
+		return false
+	}
+	return time.Now().After(tr.Status.ExpirationTimestamp.Time)
+}
+
+// newestCachedGeneration returns the newest cached generation that has not yet
+// expired. It does not judge whether that generation is due for a refresh,
+// because only the caller knows whether a refresh can succeed.
+func newestCachedGeneration(name, namespace string, tr *authenticationv1.TokenRequest) (*authenticationv1.TokenRequest, error) {
+	prefix := baseKey(name, namespace, tr)
 	ms := dbclient.NewMetaService()
-	metas, err := ms.QueryMeta("key", resKey)
+	metas, err := ms.QueryMetaByKeyPrefix(prefix)
 	if err != nil {
-		klog.Errorf("query meta %s failed: %v", resKey, err)
+		klog.Errorf("query meta by prefix %s failed: %v", prefix, err)
 		return nil, err
 	}
-	if len(*metas) != 1 {
-		klog.Errorf("query meta %s length error", resKey)
-		return nil, fmt.Errorf("query meta %s length error", resKey)
+	if len(metas) == 0 {
+		return nil, fmt.Errorf("no cached token for %s", prefix)
 	}
-	var tokenRequest authenticationv1.TokenRequest
-	err = json.Unmarshal([]byte((*metas)[0]), &tokenRequest)
+
+	// Pick the newest un-expired generation. Older generations may still be
+	// present (kept intentionally to bridge the refresh-propagation window;
+	// the GC sweep removes them after their exp passes), but the freshest
+	// one is what we want to return to the caller.
+	now := time.Now()
+	var newest *authenticationv1.TokenRequest
+	for _, v := range metas {
+		var cur authenticationv1.TokenRequest
+		if err := json.Unmarshal([]byte(v), &cur); err != nil {
+			klog.Errorf("unmarshal cached token under prefix %s failed: %v", prefix, err)
+			continue
+		}
+		if cur.Status.ExpirationTimestamp.IsZero() || !cur.Status.ExpirationTimestamp.Time.After(now) {
+			continue
+		}
+		if newest == nil || cur.Status.ExpirationTimestamp.Time.After(newest.Status.ExpirationTimestamp.Time) {
+			snapshot := cur
+			newest = &snapshot
+		}
+	}
+	if newest == nil {
+		return nil, fmt.Errorf("no un-expired cached token for %s", prefix)
+	}
+	return newest, nil
+}
+
+func getTokenLocally(name, namespace string, t
```

**File**: `edge/pkg/metamanager/client/serviceaccount_offline_test.go` (added, +322/-0)
```diff
@@ -0,0 +1,322 @@
+/*
+Copyright 2026 The KubeEdge Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+   http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package client
+
+import (
+	"encoding/json"
+	"fmt"
+	"os"
+	"path/filepath"
+	"testing"
+	"time"
+
+	authenticationv1 "k8s.io/api/authentication/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+
+	"github.com/kubeedge/api/apis/componentconfig/edgecore/v1alpha2"
+	"github.com/kubeedge/beehive/pkg/core/model"
+	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/dao"
+	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/dao/dbclient"
+	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/dao/models"
+)
+
+// projectedTTL is the lifetime kubelet requests for a projected service
+// account token volume.
+const projectedTTL int64 = 3607
+
+// These tests drive the real metaDB through dao.Init rather than stubbing the
+// data layer, so they exercise the per-generation key scheme end to end.
+func TestMain(m *testing.M) {
+	dir, err := os.MkdirTemp("", "kubeedge-sa-offline")
+	if err != nil {
+		panic(err)
+	}
+	dao.Init(filepath.Join(dir, "meta.db"), &v1alpha2.MetaManager{Enable: true})
+	code := m.Run()
+	os.RemoveAll(dir)
+	os.Exit(code)
+}
+
+// offlineSend fails every sync send, which is what an edge node that has lost
+// its connection to the cloud sees.
+type offlineSend struct{}
+
+func (offlineSend) SendSync(*model.Message) (*model.Message, error) {
+	return nil, fmt.Errorf("timeout to get response")
+}
+func (offlineSend) Send(*model.Message) {}
+
+func specOf(ttl int64) *authenticationv1.TokenRequest {
+	exp := ttl
+	return &authenticationv1.TokenRequest{
+		Spec: authenticationv1.TokenRequestSpec{ExpirationSeconds: &exp},
+	}
+}
+
+// cacheGeneration stores one generation of a token, issued age ago, under the
+// per-generation key that metamanager would use for it.
+func cacheGeneration(t *testing.T, name, namespace string, age time.Duration, token string) *authenticationv1.TokenRequest {
+	t.Helper()
+	exp := projectedTTL
+	issued := time.Now().Add(-age)
+	tr := &authenticationv1.TokenRequest{
+		Spec: authenticationv1.TokenRequestSpec{ExpirationSeconds: &exp},
+		Status: authenticationv1.TokenRequestStatus{
+			Token:               token,
+			ExpirationTimestamp: metav1.NewTime(issued.Add(time.Duration(projectedTTL) * time.Second)),
+		},
+	}
+	value, err := json.Marshal(tr)
+	if err != nil {
+		t.Fatalf("marshal token: %v", err)
+	}
+	if err := dbclient.NewMetaService().SaveMeta(&models.Meta{
+		Key:   KeyFunc(name, namespace, tr),
+		Type:  model.ResourceTypeServiceAccountToken,
+		Value: string(value),
+	}); err != nil {
+		t.Fatalf("save meta: %v", err)
+	}
+	return tr
+}
+
+// A refresh stores the new token under its own key, so the previous generation
+// survives the propagation window during which a pod may still present it.
+func TestGenerationsCoexistAcrossRefresh(t *testing.T) {
+	const name, namespace = "coexist", "default"
+	cacheGeneration(t, name, namespace, 50*time.Minute, "tok-old")
+	cacheGeneration(t, name, namespace, time.Minute, "tok-new")
+
+	rows, err := dbclient.NewMetaService().QueryMetaByKeyPrefix(baseKey(name, namespace, specOf(projectedTTL)))
+	if err != nil {
+		t.Fatalf("query by prefix: %v", err)
+	}
+	if len(rows) != 2 {
+		t.Fatalf("cached generations = %d, want 2", len(rows))
+	}
+
+	// Both remain usable for authentication while they are un-expired.
+	if !CheckTokenExist("tok-old") {
+		t.Error("the previous generation was rejected while it was still valid")
+	}
+	if !CheckTokenExist("tok-new") {
+		t.Error("the refreshed generation was rejected")
+	}
+
+	// The newest generation is the one handed to a caller.
+	got, err := newestCachedGeneration(name, namespace, specOf(projectedTTL))
+	if err != nil {
+		t.Fatalf("newestCachedGeneration: %v", err)
+	}
+	if got.Status.Token != "tok-new" {
+		t.Errorf("token = %q, want %q", got.Status.Token, "tok-new")
+	}
+}
+
+// With the cloud unreachable and a cached token that is past the refresh
+// threshold but not expired, the cached token is served so the pod can start.
+func TestGetServiceAccountTokenServesStaleTokenWhenOffline(t *testing.T) {
+	const name, namespace = "offline-stale", "default"
+	tr := cacheGeneration(t, name, namespace, 50*time.Minute, "tok-stale")
+
+	if !requiresRefresh(tr) {
+		t.Fatal("precondition failed: token is not yet due for refresh")
+	}
+	if expired(tr) {
+		t.Fatal("precondition failed: token has already expired")
+	}
+
+	c := &serviceAccountToken{send: offlineSend{}}
+	got, err := c.GetService
```

**File**: `edge/pkg/metamanager/client/serviceaccount_test.go` (added, +926/-0)
```diff
@@ -0,0 +1,926 @@
+/*
+Copyright 2025 The KubeEdge Authors.
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
+package client
+
+import (
+	"encoding/json"
+	"errors"
+	"fmt"
+	"reflect"
+	"testing"
+	"time"
+
+	"github.com/agiledragon/gomonkey/v2"
+	"github.com/stretchr/testify/assert"
+	authenticationv1 "k8s.io/api/authentication/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+
+	"github.com/kubeedge/beehive/pkg/core/model"
+	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/dao/dbclient"
+	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/dao/models"
+)
+
+type fakeSend struct {
+	syncHandler func(*model.Message) (*model.Message, error)
+	sendHandler func(*model.Message)
+}
+
+func (f *fakeSend) SendSync(message *model.Message) (*model.Message, error) {
+	if f.syncHandler != nil {
+		return f.syncHandler(message)
+	}
+	return &model.Message{}, nil
+}
+
+func (f *fakeSend) Send(message *model.Message) {
+	if f.sendHandler != nil {
+		f.sendHandler(message)
+	}
+}
+
+func newFakeSend() *fakeSend {
+	return &fakeSend{}
+}
+
+func TestNewServiceAccountToken(t *testing.T) {
+	assert := assert.New(t)
+
+	sendInterface := newFakeSend()
+
+	sat := newServiceAccountToken(sendInterface)
+	assert.NotNil(sat)
+	assert.NotNil(sat.send)
+	assert.Equal(sendInterface, sat.send)
+}
+
+func TestRequiresRefresh(t *testing.T) {
+	assert := assert.New(t)
+
+	now := time.Now()
+	testcases := []struct {
+		name     string
+		tr       *authenticationv1.TokenRequest
+		expected bool
+	}{
+		{
+			name: "Not expired",
+			tr: &authenticationv1.TokenRequest{
+				Spec: authenticationv1.TokenRequestSpec{
+					ExpirationSeconds: func() *int64 { i := int64(3600); return &i }(),
+				},
+				Status: authenticationv1.TokenRequestStatus{
+					ExpirationTimestamp: metav1.NewTime(now.Add(time.Hour)),
+				},
+			},
+			expected: false,
+		},
+		{
+			name: "Expired",
+			tr: &authenticationv1.TokenRequest{
+				Spec: authenticationv1.TokenRequestSpec{
+					ExpirationSeconds: func() *int64 { i := int64(3600); return &i }(),
+				},
+				Status: authenticationv1.TokenRequestStatus{
+					ExpirationTimestamp: metav1.NewTime(now.Add(-time.Hour)),
+				},
+			},
+			expected: true,
+		},
+		{
+			name: "Near expiration (within 20% of TTL)",
+			tr: &authenticationv1.TokenRequest{
+				Spec: authenticationv1.TokenRequestSpec{
+					ExpirationSeconds: func() *int64 { i := int64(3600); return &i }(),
+				},
+				Status: authenticationv1.TokenRequestStatus{
+					ExpirationTimestamp: metav1.NewTime(now.Add(time.Minute * 10)),
+				},
+			},
+			expected: true,
+		},
+		{
+			name: "Beyond max TTL",
+			tr: &authenticationv1.TokenRequest{
+				Spec: authenticationv1.TokenRequestSpec{
+					ExpirationSeconds: func() *int64 { i := int64(24 * 3600 * 2); return &i }(),
+				},
+				Status: authenticationv1.TokenRequestStatus{
+					ExpirationTimestamp: metav1.NewTime(now.Add(time.Hour * 48)),
+					Token:               "test-token",
+				},
+			},
+			expected: false,
+		},
+		{
+			name: "Nil ExpirationSeconds",
+			tr: &authenticationv1.TokenRequest{
+				Spec: authenticationv1.TokenRequestSpec{
+					ExpirationSeconds: nil,
+				},
+				Status: authenticationv1.TokenRequestStatus{
+					ExpirationTimestamp: metav1.NewTime(now.Add(time.Hour)),
+				},
+			},
+			expected: false,
+		},
+	}
+
+	for _, test := range testcases {
+		t.Run(test.name, func(t *testing.T) {
+			result := requiresRefresh(test.tr)
+			assert.Equal(test.expected, result)
+		})
+	}
+}
+
+func TestKeyFunc(t *testing.T) {
+	assert := assert.New(t)
+
+	testcases := []struct {
+		name      string
+		saName    string
+		namespace string
+		tr        *authenticationv1.TokenRequest
+		expected  string
+	}{
+		{
+			// Zero ExpirationTimestamp: defensive fallback returns base key only.
+			name:      "Basic TokenRequest",
+			saName:    "test-sa",
+			namespace: "default",
+			tr: &authenticationv1.TokenRequest{
+				Spec: authenticationv1.TokenRequestSpec{
+					Audiences:         []string{"audience1", "audience2"},
+					ExpirationSeconds: func() *int64 { i := int64(3600); return &i }(),
+					BoundObjectRef: &authenticationv1.BoundObjectReference{
+						Kind: "Pod",
+						Name: "test-pod",
+						UID:  "12345",
+					},
+				},
+			},
+			expected: `"test-sa"/"default"/[]string{"audience1", "audience2"}/3600/v1.BoundObjectReference{Kind:"Pod", APIVersion:"", Name:"test-pod", UID:"12345"}`,
+		},
+		{
+			name:      "TokenRequest with nil ExpirationSeconds
```

**File**: `edge/pkg/metamanager/dao/dbclient/meta.go` (modified, +16/-0)
```diff
@@ -106,6 +106,22 @@ func (s *MetaService) QueryMeta(key string, condition string) (*[]string, error)
 	return &result, nil
 }
 
+// QueryMetaByKeyPrefix returns meta values whose Key starts with prefix.
+// The match is exact and case-sensitive. LIKE is not used because SQLite's
+// LIKE ignores ASCII case and treats "%" and "_" in the prefix as wildcards.
+func (s *MetaService) QueryMetaByKeyPrefix(prefix string) ([]string, error) {
+	var metas []models.Meta
+	err := s.db.Where("substr(key, 1, length(?)) = ?", prefix, prefix).Find(&metas).Error
+	if err != nil {
+		return nil, err
+	}
+	result := make([]string, 0, len(metas))
+	for _, v := range metas {
+		result = append(result, v.Value)
+	}
+	return result, nil
+}
+
 // QueryAllMeta returns all metas for given key and condition
 func (s *MetaService) QueryAllMeta(key string, condition string) (*[]models.Meta, error) {
 	var metas []models.Meta
```

**File**: `edge/pkg/metamanager/metamanager.go` (modified, +3/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	beehiveContext "github.com/kubeedge/beehive/pkg/core/context"
 
 	"github.com/kubeedge/kubeedge/edge/pkg/common/modules"
+	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/client"
 	metamanagerconfig "github.com/kubeedge/kubeedge/edge/pkg/metamanager/config"
 	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/dao/dbclient"
 	"github.com/kubeedge/kubeedge/edge/pkg/metamanager/metaserver"
@@ -63,5 +64,7 @@ func (m *metaManager) Start() {
 		go metaserver.NewMetaServer().Start(beehiveContext.Done())
 	}
 
+	go client.RunExpiredTokenGC(beehiveContext.Done(), 0)
+
 	m.runMetaManager()
 }
```

#### Recent Merged Pull Requests:
- **PR #7476** (closed): metamanager: key edge device edits by device name (@codeafridi)
- **PR #7458** (2026-11-20): nodegroup: add and remove the finalizer with a patch (@mkhon)
- **PR #7454** (2026-11-19): metaserver: keep retrying when getting the CA fails (@arshil42)
- **PR #7432** (2026-11-16): Upgrade docker dependency to v28.0.0 (@Shelley-BaoYue)
- **PR #7431** (2026-11-16): Upgrade golang.org/x/crypto to v0.52.0 (@Shelley-BaoYue)
- **PR #7428** (closed): Upgrade golang.org/x/crypto to v0.52.0 (@kubeedge-bot)

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

## X. Empirical Invariant Guard in serviceaccount.go

**RULE**:
When implementing operations in `edge/pkg/metamanager/client/serviceaccount.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubeedge/kubeedge. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ddced73b`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `edge/pkg/metamanager/client/serviceaccount.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// baseKey is the spec-derived key prefix that identifies the logical token
// (independent of which generation). All generations of the same logical token
// share this prefix. Used for prefix lookup in metaDB.
func baseKey(name, namespace string, tr *authenticationv1.TokenRequest) string {
// KeyFunc returns the per-generation storage key for a TokenRequest. The key
// is the base (spec-derived) key suffixed with the token's exp timestamp so
// that successive refreshed tokens for the same logical token are stored as
// separate rows. This is required to keep the previous (still un-expired)
// token's row in metaDB during the propagation window between a refresh and
// the moment the pod re-reads the new token from its projected volume; without
// it, MetaServer (which authenticates by checking metaDB membership) rejects
// requests bearing the previous token.
//
// Callers without a populated Status.ExpirationTimestamp (i.e., callers that
// only have a TokenRequest spec, like an upstream kubelet refresh call) should
// not use KeyFunc — they should use baseKey and a prefix query.
//
// Keys are nonconfidential and safe to log.
func KeyFunc(name, namespace string, tr *authentica
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// KeyFunc keys should be nonconfidential and safe to log
func KeyFunc(name, namespace string, tr *authenticationv1.TokenRequest) string {
func getTokenLocally(name, namespace string, tr *authenticationv1.TokenRequest) (*authenticationv1.TokenRequest, error) {
	resKey := KeyFunc(name, namespace, tr)
	metas, err := ms.QueryMeta("key", resKey)
		klog.Errorf("query meta %s failed: %v", resKey, err)
	if len(*metas) != 1 {
		klog.Errorf("query meta %s length error", resKey)
		return nil, fmt.Errorf("query meta %s length error", resKey)
	var tokenRequest authenticationv1.TokenRequest
	err = json.Unmarshal([]byte((*metas)[0]), &tokenRequest)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ddced73b` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
