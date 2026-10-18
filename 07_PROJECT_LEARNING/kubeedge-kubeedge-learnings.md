> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubeedge-kubeedge-learnings.md`  
> **Source**: github ([https://github.com/kubeedge/kubeedge](https://github.com/kubeedge/kubeedge))  
> **Source Version**: `68df9c23`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:26:19.725Z  
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
> **Harvest Timestamp**: 2026-10-18T21:26:19.271Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeedge/kubeedge`
- **Description**: Kubernetes Native Edge Computing Framework (project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 7606 stars

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
- **Issue #7354** (2026-10-16): **nodetask: add unit tests for the ConfigUpdateJob reconcile handler**
  *Symptoms*: **What type of PR is this?**  /kind test  **What this PR does / why we need it**:  `cloud/pkg/controllermanager/nodetask/configupdatejob_handler.go` has no unit tests (0% coverage on master), while the NodeUpgradeJob and ImagePrePullJob handlers next to it are tested. This PR adds `configupdatejob_handler_test.go`, which covers every method of `ConfigUpdateJobReconcileHandler` and follows the style of the existing handler tests:  - `GetJob`: found, not found, and a client error. - `AddFinalizer`, `RemoveFinalizer` and `NoFinalizer` against a fake client. - `NotInitialized`, `IsFinalPhase` and `IsDeleted`. - `InitNodesStatus`: a node verification failure, and the job's node names and label selector being used to find the nodes. - `CalculateStatus`: tasks in progress, failures above and within the failure tolerance, no tolerance set, and a stale reason being cleared. - `UpdateJobStatus`: success and failure. - `CheckTimeout`: each case that skips the check, a timeout from the last action time or from the job creation time, finished node tasks left unchanged, an invalid action time, and a failed status update.  Coverage of `configupdatejob_handler.go` goes from 0% to 100% of its statements, and the `nodetask` package goes from 64.1% to 85.4%.  **Which issue(s) this PR fixes**:  None. This PR only adds tests.  **Special notes for your reviewer**:  - `CheckTimeout` runs against the controller-runtime fake client instead of patching `GetJob`/`UpdateJobStatus`, so the timed-out stat

- **Issue #7343** (2026-09-29): **controllermanager: escape resource names in JSON patch paths**
  *Symptoms*: **What type of PR is this?**  /kind bug  **What this PR does / why we need it**:  `ResourcesOverrider` inserts qualified resource names such as `nvidia.com/gpu` verbatim into JSON Patch paths. The slash is parsed as a path separator, so replacing an existing request or limit returns a missing-path error.  Escape the resource-name token with the existing `EscapeJsonPointer` helper for both requests and limits. The patch keeps the current `replace` operation and override selection behavior.  Regression tests cover request-only, limit-only, and combined overrides for qualified names; a name containing both `~` and `/`; and ordinary resource paths.  **Which issue(s) this PR fixes**:  Fixes #7341  **Special notes for your reviewer**:  - The change applies to existing `requests` and `limits` maps. Handling absent parent maps is outside this patch. - `make verify` — PASS. - `make test WHAT=cloud` — PASS. - `make integrationtest` — PASS on Ubuntu 22.04.5 with native containerd (edge device 14/14, metaserver 1/1, cloud controller-manager 36/36). - Focused package tests, EdgeApplication subtree tests, `go vet`, and focused race tests — PASS.  **Does this PR introduce a user-facing change?**:  ```release-note Fixed EdgeApplication resource overrides for qualified resource names such as nvidia.com/gpu in existing request and limit maps. ```

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

### Incident Patch 1: `e0efc034` (2026-09-24)
**Commit Message**: fix(viaduct): make fifo teardown safe and release parked QUIC readers

MessageFifo.Close closed the channel that Put sends on. Put runs on a
connection's read loop while Close runs on the teardown path, so a
message arriving while a connection was being torn down crashed the
process with "send on closed channel". This is reachable today on the
WebSocket transport: WSConnection closes the fifo in Close, and the edge
calls UnInit on a live connection during certificate rotation and on
module stop. A unit test running Put against Close reproduces the panic
on the first iteration, and a connection-level test that closes a
WSConnection while the peer keeps sending reproduces it on the real
transport path.

Put and Close are now serialized by a mutex. Close marks the fifo closed
and closes the channel under the lock, and Put takes the same lock and
drops the message once the fifo is closed, so it neither panics nor
blocks. Get stays a plain receive, since a closed buffered channel still
hands out what is buffered before reporting the close. The overflow
path runs under the lock as well, so the slot freed by dropping the
oldest message cannot be taken by another stream's producer before t

**File**: `edge/pkg/edgehub/clients/quicclient/quicclient_test.go` (modified, +40/-0)
```diff
@@ -263,3 +263,43 @@ func TestReceive(t *testing.T) {
 		})
 	}
 }
+
+// TestUnInitReleasesBlockedReceive covers the reconnect path end to end over a
+// real QUIC session. EdgeHub's routeToEdge sits in Receive, and UnInit is the
+// only teardown the edge reaches: the reconnect loop calls it on the dead
+// client before connecting again. Receive has to return so that goroutine can
+// exit, otherwise every reconnect leaves one behind, blocked on the previous
+// connection.
+func TestUnInitReleasesBlockedReceive(t *testing.T) {
+	newTestServer(t)
+
+	qc := newTestQuicClient("uninit", "/tmp/edge.crt", "/tmp/edge.key", "/tmp/edge.crt")
+	if err := qc.Init(); err != nil {
+		t.Fatalf("failed to init, err: %v", err)
+	}
+
+	received := make(chan error, 1)
+	go func() {
+		_, err := qc.Receive()
+		received <- err
+	}()
+
+	// Confirm the reader is parked, so the test cannot pass with a teardown
+	// that only makes later reads fail.
+	select {
+	case err := <-received:
+		t.Fatalf("Receive() returned before UnInit, err: %v", err)
+	case <-time.After(200 * time.Millisecond):
+	}
+
+	qc.UnInit()
+
+	select {
+	case err := <-received:
+		if err == nil {
+			t.Error("Receive() returned a nil error after UnInit, want an error")
+		}
+	case <-time.After(5 * time.Second):
+		t.Fatal("Receive() is still blocked after UnInit; the reader of the closed connection leaked")
+	}
+}
```

**File**: `pkg/viaduct/pkg/client/client.go` (modified, +4/-4)
```diff
@@ -40,10 +40,10 @@ type Options struct {
 	// transport (handleMessage in pkg/viaduct/pkg/conn/ws.go). It surfaces a
 	// stalled half-open TCP connection as a read error within ReadDeadline
 	// instead of waiting for the kernel TCP retransmission timeout
-	// (tcp_retries2, ~15min on Linux). Currently honored only by the
-	// WebSocket transport; QUIC has the same defect (SetReadDeadline is a
-	// no-op there too) and will be addressed in a separate PR. Zero means
-	// no read deadline (legacy behavior).
+	// (tcp_retries2, ~15min on Linux). Honored by the WebSocket transport
+	// only: QUIC detects a half-open path through the session idle timeout
+	// of the transport itself, so it needs no deadline here. Zero means no
+	// read deadline (legacy behavior).
 	ReadDeadline time.Duration
 	// consumer for raw data
 	Consumer io.Writer
```

**File**: `pkg/viaduct/pkg/conn/quic.go` (modified, +12/-0)
```diff
@@ -257,6 +257,11 @@ func (conn *QuicConnection) handleMessage(stream *smgr.Stream) {
 // close the session
 func (conn *QuicConnection) Close() error {
 	conn.state.State = api.StatDisconnected
+	// Release readers parked in ReadMessage: messageFifo.Get blocks on an
+	// open channel, so without this a reader of a torn-down connection
+	// (EdgeHub's routeToEdge) never returns and its goroutine leaks once
+	// per reconnect.
+	conn.messageFifo.Close()
 	conn.streamManager.Destroy()
 	return conn.session.Close()
 }
@@ -325,6 +330,13 @@ func (conn *QuicConnection) ReadMessage(msg *model.Message) error {
 	return conn.messageFifo.Get(msg)
 }
 
+// SetReadDeadline is not implemented for QUIC: the deadline is recorded but
+// never applied to a read, so a caller asking for pending reads to time out
+// does not get that yet. Separately, the transport does not use stream read
+// deadlines for liveness (the WebSocket transport does): stream reads see no
+// data on an idle-but-healthy session, because QUIC keepalive travels at
+// session level, so a half-open path surfaces through the session idle
+// timeout of the transport instead.
 func (conn *QuicConnection) SetReadDeadline(t time.Time) error {
 	conn.readDeadline = t
 	return nil
```

**File**: `pkg/viaduct/pkg/conn/quic_test.go` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
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
+package conn
+
+import (
+	"testing"
+	"time"
+
+	"github.com/golang/mock/gomock"
+
+	"github.com/kubeedge/beehive/pkg/core/model"
+	"github.com/kubeedge/kubeedge/pkg/viaduct/mocks"
+	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/api"
+	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/lane"
+)
+
+// newTestQuicConn builds a connection over a mocked session. No stream is
+// registered with the stream manager, so the Destroy call inside Close is a
+// no-op here and the test stays focused on the teardown of the connection.
+func newTestQuicConn(t *testing.T) *QuicConnection {
+	t.Helper()
+	ctrl := gomock.NewController(t)
+	session := mocks.NewMockSession(ctrl)
+	session.EXPECT().Close().Return(nil).AnyTimes()
+	return NewQuicConn(&ConnectionOptions{
+		ConnType: api.ProtocolTypeQuic,
+		ConnUse:  api.UseTypeMessage,
+		Base:     session,
+		CtrlLane: lane.NewLane(api.ProtocolTypeQuic, mocks.NewMockStream(ctrl)),
+		State:    &ConnectionState{State: api.StatConnected},
+	})
+}
+
+// TestNewQuicConnWiresMessageFifo guards the wiring Close depends on: without
+// a fifo the connection would panic on teardown instead of releasing readers.
+func TestNewQuicConnWiresMessageFifo(t *testing.T) {
+	conn := newTestQuicConn(t)
+
+	if conn.messageFifo == nil {
+		t.Fatal("NewQuicConn left messageFifo nil")
+	}
+	if conn.syncKeeper == nil {
+		t.Fatal("NewQuicConn left syncKeeper nil")
+	}
+	if conn.streamManager == nil {
+		t.Fatal("NewQuicConn left streamManager nil")
+	}
+}
+
+// TestCloseReleasesBlockedReadMessage guards the invariant that tearing the
+// connection down releases its reader. ReadMessage parks on the message fifo,
+// and EdgeHub's reconnect loop calls UnInit (which reaches Close) before
+// starting the next connection: a reader that is never released leaks one
+// goroutine per reconnect and keeps holding the previous connection.
+func TestCloseReleasesBlockedReadMessage(t *testing.T) {
+	conn := newTestQuicConn(t)
+
+	blocked := make(chan error, 1)
+	go func() {
+		msg := &model.Message{}
+		blocked <- conn.ReadMessage(msg)
+	}()
+
+	// Confirm the reader is parked, so the test cannot pass with a Close
+	// that only makes later reads fail.
+	select {
+	case err := <-blocked:
+		t.Fatalf("ReadMessage returned before Close: %v", err)
+	case <-time.After(100 * time.Millisecond):
+	}
+
+	if err := conn.Close(); err != nil {
+		t.Fatalf("Close: %v", err)
+	}
+
+	select {
+	case err := <-blocked:
+		if err == nil {
+			t.Fatal("ReadMessage returned a nil error after Close, want the fifo error")
+		}
+	case <-time.After(5 * time.Second):
+		t.Fatal("ReadMessage is still blocked after Close; the reader was not released")
+	}
+}
+
+// TestCloseIsIdempotent covers the teardown being reached twice on the server
+// side, where serveSession closes the connection when AcceptStream fails and
+// the owner closes it again afterwards.
+func TestCloseIsIdempotent(t *testing.T) {
+	conn := newTestQuicConn(t)
+
+	if err := conn.Close(); err != nil {
+		t.Fatalf("first Close: %v", err)
+	}
+	if err := conn.Close(); err != nil {
+		t.Fatalf("second Close: %v", err)
+	}
+	if conn.state.State != api.StatDisconnected {
+		t.Fatalf("state = %q, want %q", conn.state.State, api.StatDisconnected)
+	}
+}
```

**File**: `pkg/viaduct/pkg/conn/ws_test.go` (modified, +40/-0)
```diff
@@ -32,6 +32,7 @@ import (
 	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/api"
 	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/fifo"
 	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/keeper"
+	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/lane"
 )
 
 var upgrader = websocket.Upgrader{
@@ -459,3 +460,42 @@ func TestSetWriteDeadlinePropagatesToWSConn(t *testing.T) {
 		t.Fatal("expected immediate write error after past deadline; SetWriteDeadline did not propagate")
 	}
 }
+
+// TestCloseWhileDeliveringDoesNotPanic models the edge's UnInit on a live
+// connection (certificate rotation, module stop) while CloudHub keeps sending:
+// handleMessage delivers into the fifo on its own goroutine while Close runs
+// on the reconnect loop. Before Put and Close were serialized, this crashed
+// the process with "send on closed channel".
+func TestCloseWhileDeliveringDoesNotPanic(t *testing.T) {
+	for i := 0; i < 300; i++ {
+		serverConn, clientConn := wsTestPair(t)
+		conn := NewWSConn(&ConnectionOptions{
+			ConnType:  api.ProtocolTypeWS,
+			ConnUse:   api.UseTypeMessage,
+			Base:      clientConn,
+			State:     &ConnectionState{State: api.StatConnected},
+			AutoRoute: false, // edge setting: messages are queued for ReadMessage
+		})
+		go conn.handleMessage()
+
+		stop := make(chan struct{})
+		go func() {
+			l := lane.NewLane(api.ProtocolTypeWS, serverConn)
+			for {
+				select {
+				case <-stop:
+					return
+				default:
+				}
+				msg := model.NewMessage("").BuildRouter("cloud", "x", "res", "op").FillBody("payload")
+				if err := l.WriteMessage(msg); err != nil {
+					return
+				}
+			}
+		}()
+		time.Sleep(2 * time.Millisecond)
+		_ = conn.Close()
+		close(stop)
+		_ = serverConn.Close()
+	}
+}
```

**File**: `pkg/viaduct/pkg/fifo/msgfifo.go` (modified, +34/-13)
```diff
@@ -11,8 +11,9 @@ import (
 )
 
 type MessageFifo struct {
-	fifo      chan model.Message
-	closeOnce sync.Once
+	fifo   chan model.Message
+	mu     sync.Mutex
+	closed bool
 }
 
 // set the fifo capacity to MessageFiFoSizeMax
@@ -23,20 +24,34 @@ func NewMessageFifo() *MessageFifo {
 }
 
 // Put put the message into fifo
+//
+// Put runs on the connection's read loop while Close runs on the teardown
+// path, so the two are serialized by the lock: a Put that starts after Close
+// is dropped instead of sending on a closed channel.
 func (f *MessageFifo) Put(msg *model.Message) {
-	select {
-	case f.fifo <- *msg:
-	default:
-		// discard the old message
-		<-f.fifo
-		// push into fifo
-		f.fifo <- *msg
-		klog.Warning("too many message received, fifo overflow")
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	if f.closed {
+		return
 	}
+	// Only Put sends, and it holds the lock, so a free slot seen here stays
+	// free until the send below. The drop is non-blocking because Get may
+	// empty the fifo meanwhile.
+	if len(f.fifo) == cap(f.fifo) {
+		select {
+		case <-f.fifo:
+			klog.Warning("too many message received, fifo overflow")
+		default:
+		}
+	}
+	f.fifo <- *msg
 }
 
 // Get get message from fifo
 // this api is blocked when the fifo is empty
+//
+// Get takes no lock on purpose: a channel receive is safe against concurrent
+// Put and Close, and blocking under f.mu would stall both.
 func (f *MessageFifo) Get(msg *model.Message) error {
 	var ok bool
 	*msg, ok = <-f.fifo
@@ -46,8 +61,14 @@ func (f *MessageFifo) Get(msg *model.Message) error {
 	return nil
 }
 
+// Close releases the callers blocked in Get. Messages already buffered are
+// still delivered by Get before it reports the close.
 func (f *MessageFifo) Close() {
-	f.closeOnce.Do(func() {
-		close(f.fifo)
-	})
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	if f.closed {
+		return
+	}
+	f.closed = true
+	close(f.fifo)
 }
```

**File**: `pkg/viaduct/pkg/fifo/msgfifo_test.go` (modified, +132/-0)
```diff
@@ -17,10 +17,14 @@ limitations under the License.
 package fifo
 
 import (
+	"io"
+	"os"
+	"sync"
 	"testing"
 	"time"
 
 	"github.com/stretchr/testify/assert"
+	"k8s.io/klog/v2"
 
 	"github.com/kubeedge/beehive/pkg/core/model"
 	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/comm"
@@ -118,6 +122,134 @@ func TestMessageFifo_Close(t *testing.T) {
 	})
 }
 
+// TestMessageFifo_Close_ReleasesBlockedGet covers the reason Close exists: a
+// caller already parked in Get has to be released, otherwise the reader of a
+// torn-down connection never returns.
+func TestMessageFifo_Close_ReleasesBlockedGet(t *testing.T) {
+	f := NewMessageFifo()
+
+	released := make(chan error, 1)
+	go func() {
+		var msg model.Message
+		released <- f.Get(&msg)
+	}()
+
+	select {
+	case <-released:
+		t.Fatal("Get returned before Close")
+	case <-time.After(50 * time.Millisecond):
+	}
+
+	f.Close()
+
+	select {
+	case err := <-released:
+		assert.Error(t, err)
+	case <-time.After(time.Second):
+		t.Fatal("Get is still blocked after Close")
+	}
+}
+
+// TestMessageFifo_Close_ConcurrentWithPut covers the Put/Close overlap: Put
+// runs on a connection read loop while Close runs on the teardown path, and
+// an unsynchronized close of the channel panics with "send on closed channel".
+func TestMessageFifo_Close_ConcurrentWithPut(t *testing.T) {
+	assert.NotPanics(t, func() {
+		for i := 0; i < 100; i++ {
+			f := NewMessageFifo()
+			var wg sync.WaitGroup
+			wg.Add(2)
+			go func() {
+				defer wg.Done()
+				for j := 0; j < 50; j++ {
+					f.Put(&model.Message{Header: model.MessageHeader{ID: "concurrent"}})
+				}
+			}()
+			go func() {
+				defer wg.Done()
+				f.Close()
+			}()
+			wg.Wait()
+		}
+	})
+}
+
+// TestMessageFifo_Put_DropsAfterClose covers Put after Close: it must return
+// without sending, because the channel is closed and a send would panic.
+func TestMessageFifo_Put_DropsAfterClose(t *testing.T) {
+	f := NewMessageFifo()
+	f.Close()
+
+	for i := 0; i < 100; i++ {
+		f.Put(&model.Message{Header: model.MessageHeader{ID: "late"}})
+	}
+
+	var msg model.Message
+	assert.Error(t, f.Get(&msg))
+}
+
+// TestMessageFifo_Put_ReturnsWhenClosedDuringOverflow runs several producers
+// (one per QUIC stream) through the overflow path while Close lands. Producers
+// have to stay serialized there: one that blocked on its send while holding
+// the lock would also keep Close from returning, so Close runs behind the
+// timeout too.
+func TestMessageFifo_Put_ReturnsWhenClosedDuringOverflow(t *testing.T) {
+	// Every overflow logs a warning and this test overflows tens of
+	// thousands of times, which would bury the rest of the -v output.
+	klog.LogToStderr(false)
+	klog.SetOutput(io.Discard)
+	t.Cleanup(func() {
+		klog.Flush()
+		klog.SetOutput(os.Stderr)
+		klog.LogToStderr(true)
+	})
+
+	for round := 0; round < 50; round++ {
+		f := NewMessageFifo()
+		for i := 0; i < comm.MessageFiFoSizeMax; i++ {
+			f.Put(&model.Message{Header: model.MessageHeader{ID: "fill"}})
+		}
+
+		var wg sync.WaitGroup
+		for p := 0; p < 4; p++ {
+			wg.Add(1)
+			go func() {
+				defer wg.Done()
+				for j := 0; j < 500; j++ {
+					f.Put(&model.Message{Header: model.MessageHeader{ID: "late"}})
+				}
+			}()
+		}
+		time.Sleep(time.Millisecond) // let the producers reach the overflow path
+
+		finished := make(chan struct{})
+		go func() {
+			f.Close()
+			wg.Wait()
+			close(finished)
+		}()
+		select {
+		case <-finished:
+		case <-time.After(3 * time.Second):
+			t.Fatalf("round %d: a producer is still blocked in Put after Close", round)
+		}
+	}
+}
+
+// TestMessageFifo_Close_DrainsBufferedMessages documents that a close does not
+// discard messages that were already delivered into the fifo.
+func TestMessageFifo_Close_DrainsBufferedMessages(t *testing.T) {
+	f := NewMessageFifo()
+	f.Put(&model.Message{Header: model.MessageHeader{ID: "buffered"}})
+	f.Close()
+
+	var msg model.Message
+	assert.NoError(t, f.Get(&msg))
+	assert.Equal(t, "buffered", msg.Header.ID)
+
+	assert.Error(t, f.Get(&msg))
+}
+
 func TestMessageFifo_Get_Blocking(t *testing.T) {
 	f := NewMessageFifo()
 	msg := &model.Message{Header: model.MessageHeader{ID: "async"}}
```

---

### Incident Patch 2: `8fe8e619` (2026-07-31)
**Commit Message**: fix(viaduct): respect read deadline on WSConnection

WSConnection.SetReadDeadline stored the deadline in a struct field but
did not propagate it to the underlying gorilla/websocket connection,
and handleMessage never applied a read deadline, so a half-open TCP
socket (e.g. after a WiFi switchover) blocked on ReadMessage until the
kernel's TCP retransmission timeout (net.ipv4.tcp_retries2=15, ~15
minutes on Linux), keeping the edge node NotReady for 15-20 minutes.

Wire WebSocketConfig.ReadDeadline through wsclient.Options to
ConnectionOptions.ReadDeadlineInterval and into WSConnection, and arm
it on every handleMessage iteration. To keep idle-but-healthy
connections alive, pingLoop sends WebSocket protocol pings every half
interval and a pong handler extends the deadline on every pong; the
peer answers pings automatically (gorilla's default ping handler), so
no CloudHub change is needed. A transient WriteControl timeout does
not stop the ping loop; on a terminal write error the loop closes the
connection so the read loop unblocks immediately, and it exits quietly
when the read loop already tore the connection down. The ping period
is guarded against degenerate sub-2ns intervals.

C

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
+		// A read deadline alone would tear down idle-but-healthy
+		// connections: nothing guarantees cloud-to-edge traffic within the
+		// interval (EdgeHub's keepalive is one-way; CloudHub sends no
+		// response to it). pingLoop provides that guarantee at the
+		// WebSocket protocol level, and every pong extends the deadline
+		// here, so expiry now means the peer stopped answering entirely.
+		conn.wsConn.SetPongHandler(func(string) error {
+			return conn.wsConn.SetReadDeadline(time.Now().Add(conn.readDeadlineInterval))
+		})
+		stopPing := make(chan struct{})
+		defer close(stopPing)
+		go conn.pingLoop(stopPing)
+	}
 	for {
+		// Arm/refresh the read deadline so a half-open TCP connection
+		// surfaces as a read error within readDeadlineInterval instead of
+		// waiting for kernel TCP retransmission (tcp_retries2, ~15min on Linux).
+		if conn.readDeadlineInterval > 0 {
+			_ = conn.wsConn.SetReadDeadline(time.Now().Add(conn.readDeadlineInterval))
+		}
 		msg := &model.Message{}

```

**File**: `pkg/viaduct/pkg/conn/ws_test.go` (modified, +338/-0)
```diff
@@ -18,6 +18,8 @@ package conn
 
 import (
 	"bytes"
+	"context"
+	"net"
 	"net/http"
 	"net/http/httptest"
 	"strings"
@@ -26,7 +28,10 @@ import (
 
 	"github.com/gorilla/websocket"
 
+	"github.com/kubeedge/beehive/pkg/core/model"
 	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/api"
+	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/fifo"
+	"github.com/kubeedge/kubeedge/pkg/viaduct/pkg/keeper"
 )
 
 var upgrader = websocket.Upgrader{
@@ -121,3 +126,336 @@ func TestHandleRawDataDoesNotPanic(t *testing.T) {
 		t.Errorf("unexpected payload: got %q, want %q", consumer.Bytes(), payload)
 	}
 }
+
+// newTestWSConn spins up a server-side websocket and connects a client to
+// it. With serverReads=true the server runs a normal read loop, which makes
+// gorilla answer the client's pings with pongs automatically (an idle but
+// healthy peer). With serverReads=false the server swallows bytes at the TCP
+// level without WebSocket-level processing, so pings are never answered —
+// emulating a stalled/half-open peer while keeping the TCP connection open.
+// The returned WSConnection is configured with the supplied read deadline
+// interval; the caller must close srv to release the goroutine.
+func newTestWSConn(t *testing.T, readDeadlineInterval time.Duration, serverReads bool) (*WSConnection, *httptest.Server) {
+	t.Helper()
+
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		c, err := upgrader.Upgrade(w, r, nil)
+		if err != nil {
+			t.Errorf("upgrade: %v", err)
+			return
+		}
+		defer c.Close()
+		if serverReads {
+			// Hold the connection without sending anything so the client
+			// side blocks on Read; pings are auto-answered with pongs.
+			for {
+				if _, _, err := c.ReadMessage(); err != nil {
+					return
+				}
+			}
+		}
+		// Stalled peer: consume raw bytes so the TCP connection stays
+		// open but no pong (or any frame) is ever sent back.
+		buf := make([]byte, 1024)
+		for {
+			if _, err := c.UnderlyingConn().Read(buf); err != nil {
+				return
+			}
+		}
+	}))
+
+	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
+	wsConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
+	if err != nil {
+		srv.Close()
+		t.Fatalf("dial: %v", err)
+	}
+
+	conn := &WSConnection{
+		wsConn:               wsConn,
+		state:                &ConnectionState{State: api.StatConnected, Headers: http.Header{}},
+		connUse:              api.UseTypeMessage,
+		messageFifo:          fifo.NewMessageFifo(),
+		syncKeeper:           keeper.NewSyncKeeper(),
+		readDeadlineInterval: readDeadlineInterval,
+	}
+	return conn, srv
+}
+
+// TestHandleMessageReadDeadlineFiresWithinInterval verifies the half-open
+// detection: when readDeadlineInterval is set and the peer stops answering
+// entirely (not even pongs), handleMessage exits within roughly that
+// interval. Without the fix the goroutine would block until kernel TCP
+// retransmission timeout (~15min).
+func TestHandleMessageReadDeadlineFiresWithinInterval(t *testing.T) {
+	conn, srv := newTestWSConn(t, 100*time.Millisecond, false)
+	defer srv.Close()
+
+	done := make(chan struct{})
+	go func() {
+		conn.handleMessage()
+		close(done)
+	}()
+
+	select {
+	case <-done:
+	case <-time.After(2 * time.Second):
+		t.Fatal("handleMessage did not return within 2s; deadline not applied")
+	}
+
+	// messageFifo must be closed so callers blocked on Get() observe the
+	// error immediately rather than waiting for the next keepalive failure.
+	msg := &model.Message{}
+	if err := conn.ReadMessage(msg); err == nil {
+		t.Fatal("expected ReadMessage to return error after handleMessage timeout")
+	}
+}
+
+// TestHandleMessageZeroReadDeadlineKeepsLegacyBehavior verifies that the
+// existing zero-value behavior (no deadline = block forever) is preserved.
+func TestHandleMessageZeroReadDeadlineKeepsLegacyBehavior(t *testing.T) {
+	conn, srv := newTestWSConn(t, 0, true)
+	defer srv.Close()
+
+	done := make(chan struct{})
+	go func() {
+		conn.handleMessage()
+		close(done)
+	}()
+
+	select {
+	case <-done:
+		t.Fatal("handleMessage returned unexpectedly with no read deadline")
+	case <-time.After(300 * time.Millisecond):
+		// expected: blocks indefinitely
+	}
+
+	// Cleanup: close the underlying conn to unblock the goroutine.
+	_ = conn.wsConn.Close()
+	<-done
+}
+
+// TestHandleMessagePingKeepsIdleConnectionAlive verifies that an idle but
+// healthy connection is NOT torn down by the read deadline: pingLoop keeps
+// sending pings, the peer answers with pongs, and each pong extends the
+// deadline. Only after the peer stops answering does the deadline fire.
+func TestHandleMessagePingKeepsIdleConnectionAlive(t *testing.T) {
+	// Generous interval so that a scheduling hiccup on a loaded CI runner
+	// (ping every interval/2, pong must arrive within interval) does not
+	// fail the test spuriously.
+	interval := 800 * time.Millisecond
+	conn, srv := newTestWSConn(t, interval, true)
+	defer srv.Close()
+
+	done := make(chan struct{})
+	go fun
```

**File**: `pkg/viaduct/pkg/lane/ws.go` (modified, +6/-1)
```diff
@@ -3,6 +3,7 @@ package lane
 import (
 	"errors"
 	"io"
+	"net"
 	"time"
 
 	"github.com/gorilla/websocket"
@@ -30,7 +31,11 @@ func NewWSLane(van interface{}) *WSLane {
 func (l *WSLane) Read(p []byte) (int, error) {
 	_, msgData, err := l.conn.ReadMessage()
 	if err != nil {
-		if !errors.Is(err, io.EOF) {
+		// A deadline expiry is the designed half-open detection path when a
+		// read deadline is armed (see conn.WSConnection.handleMessage); it
+		// is reported there, not here.
+		var netErr net.Error
+		if !errors.Is(err, io.EOF) && !(errors.As(err, &netErr) && netErr.Timeout()) {
 			klog.Errorf("read message error(%+v)", err)
 		}
 		return len(msgData), err
```

**File**: `pkg/viaduct/pkg/lane/ws_test.go` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
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
+package lane
+
+import (
+	"errors"
+	"net"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/gorilla/websocket"
+)
+
+// newWSPair returns a connected server/client websocket pair backed by an
+// httptest server; both are closed on cleanup.
+func newWSPair(t *testing.T) (server, client *websocket.Conn) {
+	t.Helper()
+	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
+	serverChan := make(chan *websocket.Conn, 1)
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		c, err := upgrader.Upgrade(w, r, nil)
+		if err != nil {
+			t.Errorf("upgrade: %v", err)
+			return
+		}
+		serverChan <- c
+	}))
+	t.Cleanup(srv.Close)
+
+	c, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http"), nil)
+	if err != nil {
+		t.Fatalf("dial: %v", err)
+	}
+	t.Cleanup(func() { _ = c.Close() })
+
+	select {
+	case s := <-serverChan:
+		t.Cleanup(func() { _ = s.Close() })
+		return s, c
+	case <-time.After(2 * time.Second):
+		t.Fatal("timeout waiting for the server side of the websocket")
+		return nil, nil
+	}
+}
+
+// TestWSLaneReadReturnsDeadlineTimeout verifies that an expired read deadline
+// surfaces as a net.Error timeout from Read (the designed half-open detection
+// path, reported by the caller rather than logged here).
+func TestWSLaneReadReturnsDeadlineTimeout(t *testing.T) {
+	_, client := newWSPair(t)
+	if err := client.SetReadDeadline(time.Now().Add(-time.Second)); err != nil {
+		t.Fatalf("SetReadDeadline: %v", err)
+	}
+
+	_, err := NewWSLane(client).Read(make([]byte, 16))
+	var netErr net.Error
+	if !errors.As(err, &netErr) || !netErr.Timeout() {
+		t.Fatalf("expected a timeout net.Error, got %v", err)
+	}
+}
+
+// TestWSLaneReadPropagatesPeerClose verifies that a close initiated by the
+// peer is returned to the caller as a non-timeout error.
+func TestWSLaneReadPropagatesPeerClose(t *testing.T) {
+	server, client := newWSPair(t)
+	if err := server.Close(); err != nil {
+		t.Fatalf("server close: %v", err)
+	}
+
+	_, err := NewWSLane(client).Read(make([]byte, 16))
+	if err == nil {
+		t.Fatal("expected an error after the peer closed the connection")
+	}
+	var netErr net.Error
+	if errors.As(err, &netErr) && netErr.Timeout() {
+		t.Fatalf("peer close must not be reported as a timeout: %v", err)
+	}
+}
+
+// TestWSLaneReadDelivers verifies the happy path used by the tests above:
+// a frame written by the peer is returned from Read.
+func TestWSLaneReadDelivers(t *testing.T) {
+	server, client := newWSPair(t)
+	if err := server.WriteMessage(websocket.BinaryMessage, []byte("hello")); err != nil {
+		t.Fatalf("server write: %v", err)
+	}
+
+	buf := make([]byte, 16)
+	n, err := NewWSLane(client).Read(buf)
+	if err != nil || n != len("hello") {
+		t.Fatalf("Read = (%d, %v), want (%d, nil)", n, err, len("hello"))
+	}
+}
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

#### Recent Merged Pull Requests:
- **PR #7354** (2026-10-16): nodetask: add unit tests for the ConfigUpdateJob reconcile handler (@adity1raut)
- **PR #7343** (closed): controllermanager: escape resource names in JSON patch paths (@nzy0804)
- **PR #7342** (closed): controllermanager: escape resource names in JSON patch paths (@nzy0804)
- **PR #7329** (2026-10-16): fix(viaduct): make fifo teardown safe and release parked QUIC readers (@ryoheimorimoto)
- **PR #7324** (2026-09-23): Upgrade golang to 1.25.14 (@Shelley-BaoYue)
- **PR #7323** (2026-09-22): ci: use GitHub-hosted ARM64 runners (@Shelley-BaoYue)

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

## X. viaduct): make fifo teardown safe and release parked QUIC readers

**RULE**:
When implementing operations in `edge/pkg/edgehub/clients/quicclient/quicclient_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubeedge/kubeedge. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e0efc034`: viaduct): make fifo teardown safe and release parked QUIC readers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `edge/pkg/edgehub/clients/quicclient/quicclient_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

// TestUnInitReleasesBlockedReceive covers the reconnect path end to end over a
// real QUIC session. EdgeHub's routeToEdge sits in Receive, and UnInit is the
// only teardown the edge reaches: the reconnect loop calls it on the dead
// client before connecting again. Receive has to return so that goroutine can
// exit, otherwise every reconnect leaves one behind, blocked on the previous
// connection.
func TestUnInitReleasesBlockedReceive(t *testing.T) {
	newTestServer(t)

	qc := newTestQuicClient("uninit", "/tmp/edge.crt", "/tmp/edge.key", "/tmp/edge.crt")
	if err := qc.Init(); err != nil {
		t.Fatalf("failed to init, err: %v", err)
	}

	received := make(chan error, 1)
	go func() {
		_, err := qc.Receive()
		received <- err
	}()

	// Confirm the reader is parked, so the test cannot pass with a teardown
	// that only makes later reads fail.
	select {
	case err := <-received:
		t.Fatalf("Receive() returned before UnInit, err: %v", err)
	case <-time.After(200 * time.Millisecond):
	}

	qc.UnInit()

	select {
	case err := <-received:
		if err == nil {
			t.Error("Receive() returned a nil error after UnInit, want an error")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Receive()
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e0efc034` are properly handled with clean fallback behavior.
