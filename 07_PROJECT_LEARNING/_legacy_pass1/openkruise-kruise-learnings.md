# Forensic Learning Record (Deep Inspection): openkruise/kruise

> **Canonical Artifact**: `07_PROJECT_LEARNING/openkruise-kruise-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openkruise/kruise](https://github.com/openkruise/kruise))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:37.119Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openkruise/kruise`
- **Description**: Automated management of large-scale applications on Kubernetes (incubating project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5350 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apis/addtoscheme_apps_v1alpha1.go`
```
/*
Copyright 2019 The Kruise Authors.

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

package apis

import (
	"github.com/openkruise/kruise/apis/apps/v1alpha1"
)

func init() {
	// Register the types with the Scheme so the components can map objects to GroupVersionKinds and back
	AddToSchemes = append(AddToSchemes, v1alpha1.SchemeBuilder.AddToScheme)
}

```

### Core Architecture Module: `apis/addtoscheme_apps_v1beta1.go`
```
/*
Copyright 2020 The Kruise Authors.

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

package apis

import (
	"github.com/openkruise/kruise/apis/apps/v1beta1"
)

func init() {
	// Register the types with the Scheme so the components can map objects to GroupVersionKinds and back
	AddToSchemes = append(AddToSchemes, v1beta1.SchemeBuilder.AddToScheme)
}

```

### Core Architecture Module: `apis/addtoscheme_policy_v1alpha1.go`
```
/*
Copyright 2021 The Kruise Authors.

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

package apis

import (
	"github.com/openkruise/kruise/apis/policy/v1alpha1"
)

func init() {
	// Register the types with the Scheme so the components can map objects to GroupVersionKinds and back
	AddToSchemes = append(AddToSchemes, v1alpha1.SchemeBuilder.AddToScheme)
}

```

### Core Architecture Module: `apis/addtoscheme_policy_v1beta1.go`
```
/*
Copyright 2026 The Kruise Authors.

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

package apis

import (
	"github.com/openkruise/kruise/apis/policy/v1beta1"
)

func init() {
	// Register the types with the Scheme so the components can map objects to GroupVersionKinds and back
	AddToSchemes = append(AddToSchemes, v1beta1.SchemeBuilder.AddToScheme)
}

```

### Core Architecture Module: `apis/apis.go`
```
/*
Copyright 2020 The Kruise Authors.

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

package apis

import (
	"k8s.io/apimachinery/pkg/runtime"
)

// AddToSchemes may be used to add all resources defined in the project to a Scheme
var AddToSchemes runtime.SchemeBuilder

// AddToScheme adds all Resources to the Scheme
func AddToScheme(s *runtime.Scheme) error {
	return AddToSchemes.AddToScheme(s)
}

```

### Core Architecture Module: `apis/apps/defaults/pod.go`
```
/*
Copyright 2021 The Kruise Authors.

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

package defaults

import (
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/kubernetes/pkg/apis/core/v1"

	"github.com/openkruise/kruise/pkg/features"
	utilfeature "github.com/openkruise/kruise/pkg/util/feature"
)

// SetDefaultPodSpec sets default pod spec
func SetDefaultPodSpec(in *corev1.PodSpec) {
	v1.SetDefaults_PodSpec(in)
	// DefaultHostNetworkHostPortsInPodTemplates defaults to true before k8s 1.28, and defaults to false starting from 1.28.
	// For compatibility of kruise users, kruise exposes the DefaultHostNetworkHostPortsInPodTemplates featureGate.
	if utilfeature.DefaultFeatureGate.Enabled(features.DefaultHostNetworkHostPortsInPodTemplates) {
		if in.HostNetwork {
			defaultHostNetworkPorts(&in.Containers)
			defaultHostNetworkPorts(&in.InitContainers)
		}
	}
	//default pod volumes
	SetDefaultPodVolumes(in.Volumes)
	for i := range in.InitContainers {
		a := &in.InitContainers[i]
		v1.SetDefaults_Container(a)
		for j := range a.Ports {
			b := &a.Ports[j]
			if b.Protocol == "" {
				b.Protocol = "TCP"
			}
		}
		for j := range a.Env {
			b := &a.Env[j]
			if b.ValueFrom != nil {
				if b.ValueFrom.FieldRef != nil {
					v1.SetDefaults_ObjectFieldSelector(b.ValueFrom.FieldRef)
				}
			}
		}
		v1.SetDefaults_ResourceList(&a.Resources.Limits)
		v1.SetDefaults_ResourceList(&a.Resources.Requests)
		if a.LivenessProbe != nil {
			v1.SetDefaults_Probe(a.LivenessProbe)
			if a.LivenessProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.LivenessProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.ReadinessProbe != nil {
			v1.SetDefaults_Probe(a.ReadinessProbe)
			if a.ReadinessProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.ReadinessProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.StartupProbe != nil {
			v1.SetDefaults_Probe(a.StartupProbe)
			if a.StartupProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.StartupProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.Lifecycle != nil {
			if a.Lifecycle.PostStart != nil {
				if a.Lifecycle.PostStart.HTTPGet != nil {
					v1.SetDefaults_HTTPGetAction(a.Lifecycle.PostStart.HTTPGet)
				}
			}
			if a.Lifecycle.PreStop != nil {
				if a.Lifecycle.PreStop.HTTPGet != nil {
					v1.SetDefaults_HTTPGetAction(a.Lifecycle.PreStop.HTTPGet)
				}
			}
		}
	}
	for i := range in.Containers {
		a := &in.Containers[i]
		// For in-place update, we set default imagePullPolicy to Always
		if a.ImagePullPolicy == "" {
			a.ImagePullPolicy = corev1.PullAlways
		}
		v1.SetDefaults_Container(a)
		for j := range a.Ports {
			b := &a.Ports[j]
			if b.Protocol == "" {
				b.Protocol = "TCP"
			}
		}
		for j := range a.Env {
			b := &a.Env[j]
			if b.ValueFrom != nil {
				if b.ValueFrom.FieldRef != nil {
					v1.SetDefaults_ObjectFieldSelector(b.ValueFrom.FieldRef)
				}
			}
		}
		v1.SetDefaults_ResourceList(&a.Resources.Limits)
		v1.SetDefaults_ResourceList(&a.Resources.Requests)
		if a.LivenessProbe != nil {
			v1.SetDefaults_Probe(a.LivenessProbe)
			if a.LivenessProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.LivenessProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.ReadinessProbe != nil {
			v1.SetDefaults_Probe(a.ReadinessProbe)
			if a.ReadinessProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.ReadinessProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.StartupProbe != nil {
			v1.SetDefaults_Probe(a.StartupProbe)
			if a.StartupProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.StartupProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.Lifecycle != nil {
			if a.Lifecycle.PostStart != nil {
				if a.Lifecycle.PostStart.HTTPGet != nil {
					v1.SetDefaults_HTTPGetAction(a.Lifecycle.PostStart.HTTPGet)
				}
			}
			if a.Lifecycle.PreStop != nil {
				if a.Lifecycle.PreStop.HTTPGet != nil {
					v1.SetDefaults_HTTPGetAction(a.Lifecycle.PreStop.HTTPGet)
				}
			}
		}
	}
	for i := range in.EphemeralContainers {
		a := &in.EphemeralContainers[i]
		for j := range a.EphemeralContainerCommon.Ports {
			b := &a.EphemeralContainerCommon.Ports[j]
			if b.Protocol == "" {
				b.Protocol = "TCP"
			}
		}
		for j := range a.EphemeralContainerCommon.Env {
			b := &a.EphemeralContainerCommon.Env[j]
			if b.ValueFrom != nil {
				if b.ValueFrom.FieldRef != nil {
					v1.SetDefaults_ObjectFieldSelector(b.ValueFrom.FieldRef)
				}
			}
		}
		v1.SetDefaults_ResourceList(&a.EphemeralContainerCommon.Resources.Limits)
		v1.SetDefaults_ResourceList(&a.EphemeralContainerCommon.Resources.Requests)
		if a.EphemeralContainerCommon.LivenessProbe != nil {
			v1.SetDefaults_Probe(a.EphemeralContainerCommon.LivenessProbe)
			if a.EphemeralContainerCommon.LivenessProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.EphemeralContainerCommon.LivenessProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.EphemeralContainerCommon.ReadinessProbe != nil {
			v1.SetDefaults_Probe(a.EphemeralContainerCommon.ReadinessProbe)
			if a.EphemeralContainerCommon.ReadinessProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.EphemeralContainerCommon.ReadinessProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.EphemeralContainerCommon.StartupProbe != nil {
			v1.SetDefaults_Probe(a.EphemeralContainerCommon.StartupProbe)
			if a.EphemeralContainerCommon.StartupProbe.ProbeHandler.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(a.EphemeralContainerCommon.StartupProbe.ProbeHandler.HTTPGet)
			}
		}
		if a.EphemeralContainerCommon.Lifecycle != nil {
			if a.EphemeralContainerCommon.Lifecycle.PostStart != nil {
				if a.EphemeralContainerCommon.Lifecycle.PostStart.HTTPGet != nil {
					v1.SetDefaults_HTTPGetAction(a.EphemeralContainerCommon.Lifecycle.PostStart.HTTPGet)
				}
			}
			if a.EphemeralContainerCommon.Lifecycle.PreStop != nil {
				if a.EphemeralContainerCommon.Lifecycle.PreStop.HTTPGet != nil {
					v1.SetDefaults_HTTPGetAction(a.EphemeralContainerCommon.Lifecycle.PreStop.HTTPGet)
				}
			}
		}
	}
	v1.SetDefaults_ResourceList(&in.Overhead)
}

// With host networking default all container ports to host ports.
func defaultHostNetworkPorts(containers *[]corev1.Container) {
	for i := range *containers {
		for j := range (*containers)[i].Ports {
			if (*containers)[i].Ports[j].HostPort == 0 {
				(*containers)[i].Ports[j].HostPort = (*containers)[i].Ports[j].ContainerPort
			}
		}
	}
}

func SetDefaultPodVolumes(volumes []corev1.Volume) {
	for i := range volumes {
		a := &volumes[i]
		v1.SetDefaults_Volume(a)
		if a.VolumeSource.HostPath != nil {
			v1.SetDefaults_HostPathVolumeSource(a.VolumeSource.HostPath)
		}
		if a.VolumeSource.Secret != nil {
			v1.SetDefaults_SecretVolumeSource(a.VolumeSource.Secret)
		}
		if a.VolumeSource.DownwardAPI != nil {
			v1.SetDefaults_DownwardAPIVolumeSource(a.VolumeSource.DownwardAPI)
			for j := range a.VolumeSource.DownwardAPI.Items {
				b := &a.VolumeSource.DownwardAPI.Items[j]
				if b.FieldRef != nil {
					v1.SetDefaults_ObjectFieldSelector(b.FieldRef)
				}
			}
		}
		if a.VolumeSource.ConfigMap != nil {
			v1.SetDefaults_ConfigMapVolumeSource(a.VolumeSource.ConfigMap)
		}
		if a.VolumeSource.Projected != nil {
			v1.SetDefaults_ProjectedVolumeSource(a.VolumeSource.Projected)
			for j := range a.VolumeSource.Projected.Sources {
				b := &a.VolumeSource.Projected.Sources[j]
				if b.DownwardAPI != nil {
					for k := range b.DownwardAPI.Items {
						c := &b.DownwardAPI.Items[k]
						if c.FieldRef != nil {
							v1.SetDefaults_ObjectFieldSelector(c.FieldRef)
						}
	
```

### Core Architecture Module: `apis/apps/defaults/v1alpha1.go`
```
/*
Copyright 2020 The Kruise Authors.

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

package defaults

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	v1 "k8s.io/kubernetes/pkg/apis/core/v1"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"

	appspub "github.com/openkruise/kruise/apis/apps/pub"
	"github.com/openkruise/kruise/apis/apps/v1alpha1"
	"github.com/openkruise/kruise/pkg/control/sidecarcontrol"
)

const (
	// ProtectionFinalizer is designed to ensure the GC of resources.
	ProtectionFinalizer = "apps.kruise.io/deletion-protection"
)

// SetDefaults_SidecarSet set default values for SidecarSet.
func SetDefaultsSidecarSet(obj *v1alpha1.SidecarSet) {
	setSidecarSetUpdateStrategy(&obj.Spec.UpdateStrategy)

	for i := range obj.Spec.InitContainers {
		setDefaultSidecarContainer(&obj.Spec.InitContainers[i], v1alpha1.AfterAppContainerType)
	}

	for i := range obj.Spec.Containers {
		setDefaultSidecarContainer(&obj.Spec.Containers[i], v1alpha1.BeforeAppContainerType)
	}

	// default setting volumes
	SetDefaultPodVolumes(obj.Spec.Volumes)

	// default setting history revision limitation
	SetDefaultRevisionHistoryLimit(&obj.Spec.RevisionHistoryLimit)

	// default patchPolicy is 'Retain'
	for i := range obj.Spec.PatchPodMetadata {
		patch := &obj.Spec.PatchPodMetadata[i]
		if patch.PatchPolicy == "" {
			patch.PatchPolicy = v1alpha1.SidecarSetRetainPatchPolicy
		}
	}

	// default setting injectRevisionStrategy
	SetDefaultInjectRevision(&obj.Spec.InjectionStrategy)
}

func SetHashSidecarSet(sidecarset *v1alpha1.SidecarSet) error {
	if sidecarset.Annotations == nil {
		sidecarset.Annotations = make(map[string]string)
	}

	hash, err := sidecarcontrol.SidecarSetHash(sidecarset)
	if err != nil {
		return err
	}
	sidecarset.Annotations[sidecarcontrol.SidecarSetHashAnnotation] = hash

	hash, err = sidecarcontrol.SidecarSetHashWithoutImage(sidecarset)
	if err != nil {
		return err
	}
	sidecarset.Annotations[sidecarcontrol.SidecarSetHashWithoutImageAnnotation] = hash

	return nil
}

func SetDefaultInjectRevision(strategy *v1alpha1.SidecarSetInjectionStrategy) {
	if strategy.Revision != nil && strategy.Revision.Policy == "" {
		strategy.Revision.Policy = v1alpha1.AlwaysSidecarSetInjectRevisionPolicy
	}
}

func SetDefaultRevisionHistoryLimit(revisionHistoryLimit **int32) {
	if *revisionHistoryLimit == nil {
		*revisionHistoryLimit = ptr.To(int32(10))
	}
}

func setDefaultSidecarContainer(sidecarContainer *v1alpha1.SidecarContainer, injectPolicy v1alpha1.PodInjectPolicyType) {
	if sidecarContainer.PodInjectPolicy == "" {
		sidecarContainer.PodInjectPolicy = injectPolicy
	}
	if sidecarContainer.UpgradeStrategy.UpgradeType == "" {
		sidecarContainer.UpgradeStrategy.UpgradeType = v1alpha1.SidecarContainerColdUpgrade
	}
	if sidecarContainer.ShareVolumePolicy.Type == "" {
		sidecarContainer.ShareVolumePolicy.Type = v1alpha1.ShareVolumePolicyDisabled
	}

	setDefaultContainer(sidecarContainer)
}

func setSidecarSetUpdateStrategy(strategy *v1alpha1.SidecarSetUpdateStrategy) {
	if strategy.Type == "" {
		strategy.Type = v1alpha1.RollingUpdateSidecarSetStrategyType
	}
	if strategy.MaxUnavailable == nil {
		maxUnavailable := intstr.FromInt(1)
		strategy.MaxUnavailable = &maxUnavailable
	}
	if strategy.Partition == nil {
		partition := intstr.FromInt(0)
		strategy.Partition = &partition
	}
}

func setDefaultContainer(sidecarContainer *v1alpha1.SidecarContainer) {
	container := &sidecarContainer.Container
	v1.SetDefaults_Container(container)
	for i := range container.Ports {
		p := &container.Ports[i]
		if p.Protocol == "" {
			p.Protocol = "TCP"
		}
	}
	for i := range sidecarContainer.TransferEnv {
		tEnv := &sidecarContainer.TransferEnv[i]
		if tEnv.SourceContainerNameFrom != nil {
			v1.SetDefaults_ObjectFieldSelector(tEnv.SourceContainerNameFrom.FieldRef)
		}
	}
	for i := range container.Env {
		e := &container.Env[i]
		if e.ValueFrom != nil {
			if e.ValueFrom.FieldRef != nil {
				v1.SetDefaults_ObjectFieldSelector(e.ValueFrom.FieldRef)
			}
		}
	}
	v1.SetDefaults_ResourceList(&container.Resources.Limits)
	v1.SetDefaults_ResourceList(&container.Resources.Requests)
	if container.LivenessProbe != nil {
		v1.SetDefaults_Probe(container.LivenessProbe)
		if container.LivenessProbe.ProbeHandler.HTTPGet != nil {
			v1.SetDefaults_HTTPGetAction(container.LivenessProbe.ProbeHandler.HTTPGet)
		}
	}
	if container.ReadinessProbe != nil {
		v1.SetDefaults_Probe(container.ReadinessProbe)
		if container.ReadinessProbe.ProbeHandler.HTTPGet != nil {
			v1.SetDefaults_HTTPGetAction(container.ReadinessProbe.ProbeHandler.HTTPGet)
		}
	}
	if container.Lifecycle != nil {
		if container.Lifecycle.PostStart != nil {
			if container.Lifecycle.PostStart.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(container.Lifecycle.PostStart.HTTPGet)
			}
		}
		if container.Lifecycle.PreStop != nil {
			if container.Lifecycle.PreStop.HTTPGet != nil {
				v1.SetDefaults_HTTPGetAction(container.Lifecycle.PreStop.HTTPGet)
			}
		}
	}
}

// SetDefaults_UnitedDeployment set default values for UnitedDeployment.
func SetDefaultsUnitedDeployment(obj *v1alpha1.UnitedDeployment, injectTemplateDefaults bool) {
	if obj.Spec.Replicas == nil {
		obj.Spec.Replicas = ptr.To(int32(1))
	}

	if obj.Spec.RevisionHistoryLimit == nil {
		obj.Spec.RevisionHistoryLimit = ptr.To(int32(10))
	}

	if len(obj.Spec.UpdateStrategy.Type) == 0 {
		obj.Spec.UpdateStrategy.Type = v1alpha1.ManualUpdateStrategyType
	}

	if obj.Spec.UpdateStrategy.Type == v1alpha1.ManualUpdateStrategyType && obj.Spec.UpdateStrategy.ManualUpdate == nil {
		obj.Spec.UpdateStrategy.ManualUpdate = &v1alpha1.ManualUpdate{}
	}

	if obj.Spec.Template.StatefulSetTemplate != nil {
		if injectTemplateDefaults {
			SetDefaultPodSpec(&obj.Spec.Template.StatefulSetTemplate.Spec.Template.Spec)
			for i := range obj.Spec.Template.StatefulSetTemplate.Spec.VolumeClaimTemplates {
				a := &obj.Spec.Template.StatefulSetTemplate.Spec.VolumeClaimTemplates[i]
				v1.SetDefaults_PersistentVolumeClaim(a)
				v1.SetDefaults_ResourceList(&a.Spec.Resources.Limits)
				v1.SetDefaults_ResourceList(&a.Spec.Resources.Requests)
				v1.SetDefaults_ResourceList(&a.Status.Capacity)
			}
		}
	}

	hasReplicasSettings := false
	hasCapacitySettings := false
	for _, subset := range obj.Spec.Topology.Subsets {
		if subset.Replicas != nil {
			hasReplicasSettings = true
		}
		if subset.MinReplicas != nil || subset.MaxReplicas != nil {
			hasCapacitySettings = true
		}
	}
	if hasCapacitySettings && !hasReplicasSettings {
		for i := range obj.Spec.Topology.Subsets {
			subset := &obj.Spec.Topology.Subsets[i]
			if subset.MinReplicas == nil {
				subset.MinReplicas = &intstr.IntOrString{Type: intstr.Int, IntVal: 0}
			}
		}
	}
}

// SetDefaults_CloneSet set default values for CloneSet.
func SetDefaultsCloneSet(obj *v1alpha1.CloneSet, injectTemplateDefaults bool) {
	if obj.Spec.Replicas == nil {
		obj.Spec.Replicas = ptr.To(int32(1))
	}
	if obj.Spec.RevisionHistoryLimit == nil {
		obj.Spec.RevisionHistoryLimit = ptr.To(int32(10))
	}

	if injectTemplateDefaults {
		SetDefaultPodSpec(&obj.Spec.Template.Spec)
		for i := range obj.Spec.VolumeClaimTemplates {
			a := &obj.Spec.VolumeClaimTemplates[i]
			v1.SetDefaults_PersistentVolumeClaim(a)
			v1.SetDefaults_ResourceList(&a.Spec.Resources.Limits)
			v1.SetDefaults_ResourceList(&a.Spec.Resources.Requests)
			v1.SetDefaults_ResourceList(&a.Status.Capacity)
		}
	}

	switch obj.Spe
```

### Core Architecture Module: `apis/apps/defaults/v1beta1.go`
```
/*
Copyright 2020 The Kruise Authors.

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

package defaults

import (
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	v1 "k8s.io/kubernetes/pkg/apis/core/v1"
	"k8s.io/utils/ptr"

	appspub "github.com/openkruise/kruise/apis/apps/pub"
	"github.com/openkruise/kruise/apis/apps/v1beta1"
	"github.com/openkruise/kruise/pkg/control/sidecarcontrol"
	"github.com/openkruise/kruise/pkg/features"
	utilfeature "github.com/openkruise/kruise/pkg/util/feature"
)

// SetDefaultsStatefulSet set default values for StatefulSet.
func SetDefaultsStatefulSet(obj *v1beta1.StatefulSet, injectTemplateDefaults bool) {
	if len(obj.Spec.PodManagementPolicy) == 0 {
		obj.Spec.PodManagementPolicy = appsv1.OrderedReadyPodManagement
	}

	if obj.Spec.UpdateStrategy.Type == "" {
		obj.Spec.UpdateStrategy.Type = appsv1.RollingUpdateStatefulSetStrategyType
	}

	if obj.Spec.UpdateStrategy.Type == appsv1.RollingUpdateStatefulSetStrategyType {
		if obj.Spec.UpdateStrategy.RollingUpdate == nil {
			// UpdateStrategy.RollingUpdate will take default values below.
			obj.Spec.UpdateStrategy.RollingUpdate = &v1beta1.RollingUpdateStatefulSetStrategy{}
		}
		if obj.Spec.UpdateStrategy.RollingUpdate.Partition == nil {
			obj.Spec.UpdateStrategy.RollingUpdate.Partition = ptr.To(int32(0))
		}
		if obj.Spec.UpdateStrategy.RollingUpdate.MaxUnavailable == nil {
			maxUnavailable := intstr.FromInt(1)
			obj.Spec.UpdateStrategy.RollingUpdate.MaxUnavailable = &maxUnavailable
		}
		if obj.Spec.UpdateStrategy.RollingUpdate.PodUpdatePolicy == "" {
			obj.Spec.UpdateStrategy.RollingUpdate.PodUpdatePolicy = v1beta1.RecreatePodUpdateStrategyType
		}
		if obj.Spec.UpdateStrategy.RollingUpdate.MinReadySeconds == nil {
			obj.Spec.UpdateStrategy.RollingUpdate.MinReadySeconds = ptr.To(int32(0))
		}
	}

	if utilfeature.DefaultFeatureGate.Enabled(features.StatefulSetAutoDeletePVC) {
		if obj.Spec.PersistentVolumeClaimRetentionPolicy == nil {
			obj.Spec.PersistentVolumeClaimRetentionPolicy = &v1beta1.StatefulSetPersistentVolumeClaimRetentionPolicy{}
		}
		if len(obj.Spec.PersistentVolumeClaimRetentionPolicy.WhenDeleted) == 0 {
			obj.Spec.PersistentVolumeClaimRetentionPolicy.WhenDeleted = v1beta1.RetainPersistentVolumeClaimRetentionPolicyType
		}
		if len(obj.Spec.PersistentVolumeClaimRetentionPolicy.WhenScaled) == 0 {
			obj.Spec.PersistentVolumeClaimRetentionPolicy.WhenScaled = v1beta1.RetainPersistentVolumeClaimRetentionPolicyType
		}
	}

	if utilfeature.DefaultFeatureGate.Enabled(features.StatefulSetAutoResizePVCGate) {
		if obj.Spec.VolumeClaimUpdateStrategy.Type == "" {
			obj.Spec.VolumeClaimUpdateStrategy.Type = v1beta1.OnPVCDeleteVolumeClaimUpdateStrategyType
		}
	}

	if obj.Spec.Replicas == nil {
		obj.Spec.Replicas = ptr.To(int32(1))
	}
	if obj.Spec.RevisionHistoryLimit == nil {
		obj.Spec.RevisionHistoryLimit = ptr.To(int32(10))
	}

	if injectTemplateDefaults {
		SetDefaultPodSpec(&obj.Spec.Template.Spec)
		for i := range obj.Spec.VolumeClaimTemplates {
			a := &obj.Spec.VolumeClaimTemplates[i]
			v1.SetDefaults_PersistentVolumeClaim(a)
			v1.SetDefaults_ResourceList(&a.Spec.Resources.Limits)
			v1.SetDefaults_ResourceList(&a.Spec.Resources.Requests)
			v1.SetDefaults_ResourceList(&a.Status.Capacity)
		}
	}
}

// SetDefaultsUnitedDeploymentV1beta1 sets default values for v1beta1 UnitedDeployment.
func SetDefaultsUnitedDeploymentV1beta1(obj *v1beta1.UnitedDeployment, injectTemplateDefaults bool) {
	if obj.Spec.Replicas == nil {
		obj.Spec.Replicas = ptr.To(int32(1))
	}

	if obj.Spec.RevisionHistoryLimit == nil {
		obj.Spec.RevisionHistoryLimit = ptr.To(int32(10))
	}

	if len(obj.Spec.UpdateStrategy.Type) == 0 {
		obj.Spec.UpdateStrategy.Type = v1beta1.ManualUpdateStrategyType
	}

	if obj.Spec.UpdateStrategy.Type == v1beta1.ManualUpdateStrategyType && obj.Spec.UpdateStrategy.ManualUpdate == nil {
		obj.Spec.UpdateStrategy.ManualUpdate = &v1beta1.ManualUpdate{}
	}

	if obj.Spec.Template.StatefulSetTemplate != nil {
		if injectTemplateDefaults {
			SetDefaultPodSpec(&obj.Spec.Template.StatefulSetTemplate.Spec.Template.Spec)
			for i := range obj.Spec.Template.StatefulSetTemplate.Spec.VolumeClaimTemplates {
				a := &obj.Spec.Template.StatefulSetTemplate.Spec.VolumeClaimTemplates[i]
				v1.SetDefaults_PersistentVolumeClaim(a)
				v1.SetDefaults_ResourceList(&a.Spec.Resources.Limits)
				v1.SetDefaults_ResourceList(&a.Spec.Resources.Requests)
				v1.SetDefaults_ResourceList(&a.Status.Capacity)
			}
		}
	}

	hasReplicasSettings := false
	hasCapacitySettings := false
	for _, subset := range obj.Spec.Topology.Subsets {
		if subset.Replicas != nil {
			hasReplicasSettings = true
		}
		if subset.MinReplicas != nil || subset.MaxReplicas != nil {
			hasCapacitySettings = true
		}
	}
	if hasCapacitySettings && !hasReplicasSettings {
		for i := range obj.Spec.Topology.Subsets {
			subset := &obj.Spec.Topology.Subsets[i]
			if subset.MinReplicas == nil {
				subset.MinReplicas = &intstr.IntOrString{Type: intstr.Int, IntVal: 0}
			}
		}
	}
}

// SetDefaultsBroadcastJob set default values for BroadcastJob.
func SetDefaultsBroadcastJob(obj *v1beta1.BroadcastJob, injectTemplateDefaults bool) {
	if injectTemplateDefaults {
		SetDefaultPodSpec(&obj.Spec.Template.Spec)
	}
	if obj.Spec.CompletionPolicy.Type == "" {
		obj.Spec.CompletionPolicy.Type = v1beta1.Always
	}

	if obj.Spec.Parallelism == nil {
		parallelism := int32(1<<31 - 1)
		parallelismIntStr := intstr.FromInt(int(parallelism))
		obj.Spec.Parallelism = &parallelismIntStr
	}

	if obj.Spec.FailurePolicy.Type == "" {
		obj.Spec.FailurePolicy.Type = v1beta1.FailurePolicyTypeFailFast
	}
}

// SetDefaultsAdvancedCronJob set default values for AdvancedCronJob.
func SetDefaultsAdvancedCronJob(obj *v1beta1.AdvancedCronJob, injectTemplateDefaults bool) {
	if obj.Spec.Template.JobTemplate != nil && injectTemplateDefaults {
		SetDefaultPodSpec(&obj.Spec.Template.JobTemplate.Spec.Template.Spec)
	}

	if obj.Spec.Template.BroadcastJobTemplate != nil && injectTemplateDefaults {
		SetDefaultPodSpec(&obj.Spec.Template.BroadcastJobTemplate.Spec.Template.Spec)
	}

	if obj.Spec.Template.ImageListPullJobTemplate != nil && obj.Spec.Template.ImageListPullJobTemplate.Spec.CompletionPolicy.Type == "" {
		obj.Spec.Template.ImageListPullJobTemplate.Spec.CompletionPolicy.Type = v1beta1.Always
		if obj.Spec.Template.ImageListPullJobTemplate.Spec.PullPolicy == nil {
			obj.Spec.Template.ImageListPullJobTemplate.Spec.PullPolicy = &v1beta1.PullPolicy{}
		}
		if obj.Spec.Template.ImageListPullJobTemplate.Spec.PullPolicy.TimeoutSeconds == nil {
			obj.Spec.Template.ImageListPullJobTemplate.Spec.PullPolicy.TimeoutSeconds = ptr.To(int32(600))
		}
		if obj.Spec.Template.ImageListPullJobTemplate.Spec.PullPolicy.BackoffLimit == nil {
			obj.Spec.Template.ImageListPullJobTemplate.Spec.PullPolicy.BackoffLimit = ptr.To(int32(3))
		}
		if obj.Spec.Template.ImageListPullJobTemplate.Spec.ImagePullPolicy == "" {
			obj.Spec.Template.ImageListPullJobTemplate.Spec.ImagePullPolicy = v1beta1.PullIfNotPresent
		}
	}

	if obj.Spec.ConcurrencyPolicy == "" {
		if obj.Spec.Template.ImageListPullJobTemplate != nil {
			// concurrent run imagepulljob is useless
			obj.Spec.ConcurrencyPolicy = v1beta1.ReplaceConcurrent
		} else {
			obj.Spec.ConcurrencyPolicy = v1beta1.AllowConcurrent
		}
	}
	if obj.Spec.Paused == nil {
		obj.Spec.Paused = new(bool)
	}

	if obj.Spec.SuccessfulJobsHistoryLimit == nil {
		obj.Spec.SuccessfulJobsHistoryLimit = ne
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2561** (2026-09-11): **cherry-pick #2274 to release-1.8: update Pod condition without conflict retry for specific version**
  *Symptoms*: Cherry-pick #2274 to release-1.8.  Original PR: #2274
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/openkruise/kruise/pull/2561?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openkruise) Report :x: Patch coverage is `38.46154%` with `8 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 43.20%. Comparing base ([`76d1f99`](https://app.codecov.io/gh/openkruise/kruise/commit/76d1f993012bfcf3253ecc31c9d4969b4af8902f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openkruise)) to head ([`6e69260`](https://app.codecov.io/gh/openkruise/kruise/commit/6e692605c96629d37378b8b1df95c24528f4fbc0?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openkruise)). :warning: Report is 1 commits behind head on release-1.8.  | [Files with missing lines](https://app.codecov.io/gh/openkruise/kruise/pull/2561?dropdown
  > /lgtm /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/openkruise/kruise/pull/2561#issuecomment-5632385757" title="Approved">zmberg</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/openkruise/kruise/blob/release-1.8/OWNERS)~~ [zmberg]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #2555** (2026-09-21): **chore(deps): bump github/codeql-action/analyze from 4.31.7 to 4.37.9**
  *Symptoms*: Bumps [github/codeql-action/analyze](https://github.com/github/codeql-action) from 4.31.7 to 4.37.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/analyze's releases</a>.</em></p> <blockquote> <h2>v4.37.9</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.4">2.26.4</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4106">#4106</a></li> </ul> <h2>v4.37.8</h2> <p>No user facing changes.</p> <h2>v4.37.7</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.3">2.26.3</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4085">#4085</a></li> </ul> <h2>v4.37.6</h2> <ul> <li>Changed the default filepath for the new remote file address format that was introduced in CodeQL Action 4.37.0 / 3.37.0 to <code>.github/codeql-config.yml</code> to align it with the suggested path that is used elsewhere. <a href="https://redirect.github.com/github/codeql-action/pull/4070">#4070</a></li> </ul> <h2>v4.37.5</h2> <ul> <li>Fixed a bug where a network error while streaming the download of the CodeQL bundle could terminate the <code>init</code> Action instead of falling back to downloading the bundle before extracting it. <a href="https://redirect.github.com/github/codeql-action/pull/4061">#4061</a></li> </ul> 
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign veophi for approval by writing `/assign @veophi` in a comment. For more information see:[The Kubernetes Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/openkruise/kruise/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["veophi"]} -->
  > Superseded by #2581.

- **Issue #2554** (2026-09-21): **chore(deps): bump crate-ci/typos from 1.39.2 to 1.50.0**
  *Symptoms*: Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.39.2 to 1.50.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/releases">crate-ci/typos's releases</a>.</em></p> <blockquote> <h2>v1.50.0</h2> <h2>[1.50.0] - 2026-08-28</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1587">August 2026</a> changes</li> </ul> <h2>v1.49.1</h2> <h2>[1.49.1] - 2026-08-27</h2> <h3>Fixes</h3> <ul> <li>Don't correct the brand name <code>HashiCorp</code></li> </ul> <h2>v1.49.0</h2> <h2>[1.49.0] - 2026-08-03</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1573">July 2026</a> changes</li> </ul> <h2>v1.48.0</h2> <h2>[1.48.0] - 2026-06-30</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1562">June 2026</a> changes</li> </ul> <h2>v1.47.2</h2> <h2>[1.47.2] - 2026-06-04</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>inferrable</code></li> <li>Correct unused <code>inferible</code> variant</li> </ul> <h2>v1.47.1</h2> <h2>[1.47.1] - 2026-06-03</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>requestors</code></li> </ul> <h2>v1.47.0</h2> <h2>[1.47.0] - 2026-05-29</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1545">May 2026</a> changes</li> </u
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign furykerry for approval by writing `/assign @furykerry` in a comment. For more information see:[The Kubernetes Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/openkruise/kruise/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["furykerry"]} -->
  > Superseded by #2576.

- **Issue #2553** (2026-09-21): **chore(deps): bump github/codeql-action/autobuild from 4.31.7 to 4.37.9**
  *Symptoms*: Bumps [github/codeql-action/autobuild](https://github.com/github/codeql-action) from 4.31.7 to 4.37.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/autobuild's releases</a>.</em></p> <blockquote> <h2>v4.37.9</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.4">2.26.4</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4106">#4106</a></li> </ul> <h2>v4.37.8</h2> <p>No user facing changes.</p> <h2>v4.37.7</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.3">2.26.3</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4085">#4085</a></li> </ul> <h2>v4.37.6</h2> <ul> <li>Changed the default filepath for the new remote file address format that was introduced in CodeQL Action 4.37.0 / 3.37.0 to <code>.github/codeql-config.yml</code> to align it with the suggested path that is used elsewhere. <a href="https://redirect.github.com/github/codeql-action/pull/4070">#4070</a></li> </ul> <h2>v4.37.5</h2> <ul> <li>Fixed a bug where a network error while streaming the download of the CodeQL bundle could terminate the <code>init</code> Action instead of falling back to downloading the bundle before extracting it. <a href="https://redirect.github.com/github/codeql-action/pull/4061">#4061</a></li> </
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign furykerry for approval by writing `/assign @furykerry` in a comment. For more information see:[The Kubernetes Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/openkruise/kruise/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["furykerry"]} -->
  > Superseded by #2580.

- **Issue #2552** (2026-09-21): **chore(deps): bump github/codeql-action/init from 4.31.7 to 4.37.9**
  *Symptoms*: Bumps [github/codeql-action/init](https://github.com/github/codeql-action) from 4.31.7 to 4.37.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/init's releases</a>.</em></p> <blockquote> <h2>v4.37.9</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.4">2.26.4</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4106">#4106</a></li> </ul> <h2>v4.37.8</h2> <p>No user facing changes.</p> <h2>v4.37.7</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.3">2.26.3</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4085">#4085</a></li> </ul> <h2>v4.37.6</h2> <ul> <li>Changed the default filepath for the new remote file address format that was introduced in CodeQL Action 4.37.0 / 3.37.0 to <code>.github/codeql-config.yml</code> to align it with the suggested path that is used elsewhere. <a href="https://redirect.github.com/github/codeql-action/pull/4070">#4070</a></li> </ul> <h2>v4.37.5</h2> <ul> <li>Fixed a bug where a network error while streaming the download of the CodeQL bundle could terminate the <code>init</code> Action instead of falling back to downloading the bundle before extracting it. <a href="https://redirect.github.com/github/codeql-action/pull/4061">#4061</a></li> </ul> <h2>v4
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign veophi for approval by writing `/assign @veophi` in a comment. For more information see:[The Kubernetes Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/openkruise/kruise/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["veophi"]} -->
  > Superseded by #2579.

- **Issue #2551** (2026-08-27): **fix(ci): bump trivy-action to v0.36.0 to fix golangci-lint job failure**
  *Symptoms*: ## What type of PR is this?  /kind bug  ## What this PR does / why we need it  The `golangci-lint` CI job is currently failing on **every** PR (e.g. #2549, #2548, #2547, #2545), blocking all merges.  The failure is **not** in the lint itself — lint passes cleanly (`Issues before processing: 424, after processing: 0`). It fails in the `Run Trivy vulnerability scanner in repo mode` step:  ``` installing Trivy binary aquasecurity/trivy info checking GitHub for tag 'v0.65.0' aquasecurity/trivy info found version: 0.65.0 for v0.65.0/Linux/64bit ##[error]Process completed with exit code 1 ```  ### Root cause  `trivy-action` was pinned to a floating `master` commit (`b6643a29`), whose `action.yaml` defaults to trivy `v0.65.0`.  Upstream has since **deleted the v0.65.0 release**. `v0.65.0` through `v0.69.1` are all gone; the oldest surviving release in that range is `v0.69.2`. So both downloads performed by `contrib/install.sh` now 404:  ``` $ curl -sSL -o /dev/null -w "%{http_code}\n" "https://get.trivy.dev/trivy?os=Linux&arch=64bit&version=0.65.0&type=tar.gz&client=install-script" 404 $ curl -sSL -o /dev/null -w "%{http_code}\n" "https://github.com/aquasecurity/trivy/releases/download/v0.65.0/trivy_0.65.0_checksums.txt" 404 ```  The script runs under `bash -e`, so the failed download exits 1 and fails the whole job.  Because the pin referenced a **branch** rather than a tag, dependabot could not track it — which is exactly how the default silently drifted onto a release that no lon
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please ask for approval from furykerry by writing `/assign @furykerry` in a comment. For more information see:[The Kubernetes Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/openkruise/kruise/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["furykerry"]} -->
  > ## [Codecov](https://app.codecov.io/gh/openkruise/kruise/pull/2551?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openkruise) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 49.92%. Comparing base ([`c9ada9a`](https://app.codecov.io/gh/openkruise/kruise/commit/c9ada9a9e3a565937cb36b5d8af8ec7c847b0f5f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openkruise)) to head ([`a3e6c81`](https://app.codecov.io/gh/openkruise/kruise/commit/a3e6c81bb941faa41143dce076e6fde10f8414e5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=openkruise)). :warning: Report is 5 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ 

- **Issue #2549** (2026-08-28): **chore(deps): bump golangci/golangci-lint-action from 8.0.0 to 9.3.0**
  *Symptoms*: Bumps [golangci/golangci-lint-action](https://github.com/golangci/golangci-lint-action) from 8.0.0 to 9.3.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/golangci/golangci-lint-action/releases">golangci/golangci-lint-action's releases</a>.</em></p> <blockquote> <h2>v9.3.0</h2> <!-- raw HTML omitted --> <h2>What's Changed</h2> <h3>Changes</h3> <ul> <li>feat: add no-run-logs-group as experimental option by <a href="https://github.com/ldez"><code>@​ldez</code></a> in <a href="https://redirect.github.com/golangci/golangci-lint-action/pull/1403">golangci/golangci-lint-action#1403</a></li> </ul> <h3>Dependencies</h3> <ul> <li>build(deps): bump github/codeql-action from 4.35.4 to 4.35.5 in the github-actions group by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/golangci/golangci-lint-action/pull/1395">golangci/golangci-lint-action#1395</a></li> <li>build(deps): bump tmp from 0.2.5 to 0.2.6 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/golangci/golangci-lint-action/pull/1397">golangci/golangci-lint-action#1397</a></li> <li>build(deps): bump github/codeql-action from 4.35.5 to 4.36.0 in the github-actions group by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/golangci/golangci-lint-action/pull/1398">golangci/golangci-lint-action#139
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign veophi for approval by writing `/assign @veophi` in a comment. For more information see:[The Kubernetes Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/openkruise/kruise/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["veophi"]} -->
  > @dependabot rebase

- **Issue #2548** (2026-08-31): **chore(deps): bump github/codeql-action/init from 4.31.7 to 4.37.8**
  *Symptoms*: Bumps [github/codeql-action/init](https://github.com/github/codeql-action) from 4.31.7 to 4.37.8. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/init's releases</a>.</em></p> <blockquote> <h2>v4.37.8</h2> <p>No user facing changes.</p> <h2>v4.37.7</h2> <ul> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.26.3">2.26.3</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4085">#4085</a></li> </ul> <h2>v4.37.6</h2> <ul> <li>Changed the default filepath for the new remote file address format that was introduced in CodeQL Action 4.37.0 / 3.37.0 to <code>.github/codeql-config.yml</code> to align it with the suggested path that is used elsewhere. <a href="https://redirect.github.com/github/codeql-action/pull/4070">#4070</a></li> </ul> <h2>v4.37.5</h2> <ul> <li>Fixed a bug where a network error while streaming the download of the CodeQL bundle could terminate the <code>init</code> Action instead of falling back to downloading the bundle before extracting it. <a href="https://redirect.github.com/github/codeql-action/pull/4061">#4061</a></li> </ul> <h2>v4.37.4</h2> <ul> <li>This version of the CodeQL Action adds support for the <code>tools</code> input for the <code>codeql-action/init</code> step to be specified using a <code>github-codeql-tools</code> <a href="https://docs.github.com/en/organizations/m
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign fillzpp for approval by writing `/assign @fillzpp` in a comment. For more information see:[The Kubernetes Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=openkruise%2Fkruise).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/openkruise/kruise/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["fillzpp"]} -->
  > Superseded by #2552.

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

### Incident Patch 1: `87c1ac88` (2026-02-28)
**Commit Message**: fix occasional restarts of kruise-controller-manager

Signed-off-by: PersistentJZH <zhihao.kan17@gmail.com>

- fix occasional restarts of kruise-controller-manager

**File**: `pkg/util/fieldindex/register.go` (modified, +4/-2)
```diff
@@ -67,8 +67,10 @@ func RegisterFieldIndexes(c cache.Cache) error {
 			return
 		}
 		// ImagePullJob ownerReference
-		if err = c.IndexField(context.TODO(), &appsv1alpha1.ImagePullJob{}, IndexNameForOwnerRefUID, ownerIndexFunc); err != nil {
-			return
+		if utildiscovery.DiscoverObject(&appsv1alpha1.ImagePullJob{}) {
+			if err = c.IndexField(context.TODO(), &appsv1alpha1.ImagePullJob{}, IndexNameForOwnerRefUID, ownerIndexFunc); err != nil {
+				return
+			}
 		}
 		// ImagePullJob ownerReference for v1beta1
 		if utildiscovery.DiscoverObject(&appsv1beta1.ImagePullJob{}) {
```

---

### Incident Patch 2: `62420e13` (2026-08-07)
**Commit Message**: fix(pub): prevent panic on nil Spec.Replicas during update event

Signed-off-by: vishal <httpsvishal07@gmail.com>

**File**: `pkg/controller/podunavailablebudget/podunavailablebudget_controller.go` (modified, +44/-12)
```diff
@@ -36,6 +36,7 @@ import (
 	"k8s.io/client-go/util/retry"
 	"k8s.io/klog/v2"
 	kubecontroller "k8s.io/kubernetes/pkg/controller"
+	"k8s.io/utils/ptr"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/controller"
@@ -138,9 +139,7 @@ func add(mgr manager.Manager, r reconcile.Reconciler) error {
 	// deployment
 	if err = c.Watch(source.Kind(mgr.GetCache(), client.Object(&apps.Deployment{}), &SetEnqueueRequestForPUB{mgr}, predicate.Funcs{
 		UpdateFunc: func(e event.UpdateEvent) bool {
-			old := e.ObjectOld.(*apps.Deployment)
-			new := e.ObjectNew.(*apps.Deployment)
-			return *old.Spec.Replicas != *new.Spec.Replicas
+			return workloadReplicasChanged(e.ObjectOld, e.ObjectNew)
 		},
 		DeleteFunc: func(deleteEvent event.DeleteEvent) bool {
 			return true
@@ -152,9 +151,7 @@ func add(mgr manager.Manager, r reconcile.Reconciler) error {
 	// kruise AdvancedStatefulSet
 	if err = c.Watch(source.Kind(mgr.GetCache(), client.Object(&kruiseappsv1beta1.StatefulSet{}), &SetEnqueueRequestForPUB{mgr}, predicate.Funcs{
 		UpdateFunc: func(e event.UpdateEvent) bool {
-			old := e.ObjectOld.(*kruiseappsv1beta1.StatefulSet)
-			new := e.ObjectNew.(*kruiseappsv1beta1.StatefulSet)
-			return *old.Spec.Replicas != *new.Spec.Replicas
+			return workloadReplicasChanged(e.ObjectOld, e.ObjectNew)
 		},
 		DeleteFunc: func(deleteEvent event.DeleteEvent) bool {
 			return true
@@ -166,9 +163,7 @@ func add(mgr manager.Manager, r reconcile.Reconciler) error {
 	// CloneSet
 	if err = c.Watch(source.Kind(mgr.GetCache(), client.Object(&kruiseappsv1alpha1.CloneSet{}), &SetEnqueueRequestForPUB{mgr}, predicate.Funcs{
 		UpdateFunc: func(e event.UpdateEvent) bool {
-			old := e.ObjectOld.(*kruiseappsv1alpha1.CloneSet)
-			new := e.ObjectNew.(*kruiseappsv1alpha1.CloneSet)
-			return *old.Spec.Replicas != *new.Spec.Replicas
+			return workloadReplicasChanged(e.ObjectOld, e.ObjectNew)
 		},
 		DeleteFunc: func(deleteEvent event.DeleteEvent) bool {
 			return true
@@ -180,9 +175,7 @@ func add(mgr manager.Manager, r reconcile.Reconciler) error {
 	// StatefulSet
 	if err = c.Watch(source.Kind(mgr.GetCache(), client.Object(&apps.StatefulSet{}), &SetEnqueueRequestForPUB{mgr}, predicate.Funcs{
 		UpdateFunc: func(e event.UpdateEvent) bool {
-			old := e.ObjectOld.(*apps.StatefulSet)
-			new := e.ObjectNew.(*apps.StatefulSet)
-			return *old.Spec.Replicas != *new.Spec.Replicas
+			return workloadReplicasChanged(e.ObjectOld, e.ObjectNew)
 		},
 		DeleteFunc: func(deleteEvent event.DeleteEvent) bool {
 			return true
@@ -506,3 +499,42 @@ func (r *ReconcilePodUnavailableBudget) updatePubStatus(pub *policyv1beta1.PodUn
 		"expectedCount", expectedCount, "desiredAvailable", desiredAvailable, "currentAvailable", currentAvailable, "unavailableAllowed", unavailableAllowed)
 	return nil
 }
+
+// workloadReplicasChanged safely compares replica counts for supported workloads.
+// Treats nil replicas as the Kubernetes default of 1.
+func workloadReplicasChanged(oldObj, newObj client.Object) bool {
+	var oldReplicas, newReplicas *int32
+	switch old := oldObj.(type) {
+	case *apps.Deployment:
+		new, ok := newObj.(*apps.Deployment)
+		if !ok {
+			return false
+		}
+		oldReplicas = old.Spec.Replicas
+		newReplicas = new.Spec.Replicas
+	case *kruiseappsv1beta1.StatefulSet:
+		new, ok := newObj.(*kruiseappsv1beta1.StatefulSet)
+		if !ok {
+			return false
+		}
+		oldReplicas = old.Spec.Replicas
+		newReplicas = new.Spec.Replicas
+	case *kruiseappsv1alpha1.CloneSet:
+		new, ok := newObj.(*kruiseappsv1alpha1.CloneSet)
+		if !ok {
+			return false
+		}
+		oldReplicas = old.Spec.Replicas
+		newReplicas = new.Spec.Replicas
+	case *apps.StatefulSet:
+		new, ok := newObj.(*apps.StatefulSet)
+		if !ok {
+			return false
+		}
+		oldReplicas = old.Spec.Replicas
+		newReplicas = new.Spec.Replicas
+	default:
+		return false
+	}
+	return ptr.Deref(oldReplicas, 1) != ptr.Deref(newReplicas, 1)
+}
```

**File**: `pkg/controller/podunavailablebudget/pub_controller_test.go` (modified, +93/-0)
```diff
@@ -37,6 +37,8 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/client/fake"
 
+	kruiseappsv1alpha1 "github.com/openkruise/kruise/apis/apps/v1alpha1"
+	kruiseappsv1beta1 "github.com/openkruise/kruise/apis/apps/v1beta1"
 	policyv1beta1 "github.com/openkruise/kruise/apis/policy/v1beta1"
 	"github.com/openkruise/kruise/pkg/control/pubcontrol"
 	"github.com/openkruise/kruise/pkg/util"
@@ -1364,3 +1366,94 @@ func isPubStatusEqual(expectStatus, nowStatus policyv1beta1.PodUnavailableBudget
 
 	return reflect.DeepEqual(expectStatus, nowStatus)
 }
+
+func TestWorkloadReplicasChanged(t *testing.T) {
+	cases := []struct {
+		name     string
+		oldObj   client.Object
+		newObj   client.Object
+		expected bool
+	}{
+		{
+			name:     "Deployment: both nil (default to 1)",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: nil}},
+			newObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: nil}},
+			expected: false,
+		},
+		{
+			name:     "Deployment: old nil, new 1",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: nil}},
+			newObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](1)}},
+			expected: false,
+		},
+		{
+			name:     "Deployment: old 1, new nil",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](1)}},
+			newObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: nil}},
+			expected: false,
+		},
+		{
+			name:     "Deployment: old nil, new 2",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: nil}},
+			newObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](2)}},
+			expected: true,
+		},
+		{
+			name:     "Deployment: old 2, new nil",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](2)}},
+			newObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: nil}},
+			expected: true,
+		},
+		{
+			name:     "Deployment: old 2, new 2",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](2)}},
+			newObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](2)}},
+			expected: false,
+		},
+		{
+			name:     "Deployment: old 2, new 3",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](2)}},
+			newObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](3)}},
+			expected: true,
+		},
+		{
+			name:     "Kruise StatefulSet: old nil, new 2",
+			oldObj:   &kruiseappsv1beta1.StatefulSet{Spec: kruiseappsv1beta1.StatefulSetSpec{Replicas: nil}},
+			newObj:   &kruiseappsv1beta1.StatefulSet{Spec: kruiseappsv1beta1.StatefulSetSpec{Replicas: ptr.To[int32](2)}},
+			expected: true,
+		},
+		{
+			name:     "CloneSet: old nil, new 2",
+			oldObj:   &kruiseappsv1alpha1.CloneSet{Spec: kruiseappsv1alpha1.CloneSetSpec{Replicas: nil}},
+			newObj:   &kruiseappsv1alpha1.CloneSet{Spec: kruiseappsv1alpha1.CloneSetSpec{Replicas: ptr.To[int32](2)}},
+			expected: true,
+		},
+		{
+			name:     "Apps StatefulSet: old nil, new 2",
+			oldObj:   &apps.StatefulSet{Spec: apps.StatefulSetSpec{Replicas: nil}},
+			newObj:   &apps.StatefulSet{Spec: apps.StatefulSetSpec{Replicas: ptr.To[int32](2)}},
+			expected: true,
+		},
+		{
+			name:     "Type mismatch",
+			oldObj:   &apps.Deployment{Spec: apps.DeploymentSpec{Replicas: ptr.To[int32](1)}},
+			newObj:   &apps.StatefulSet{Spec: apps.StatefulSetSpec{Replicas: ptr.To[int32](2)}},
+			expected: false,
+		},
+		{
+			name:     "Unknown type",
+			oldObj:   &corev1.Pod{},
+			newObj:   &corev1.Pod{},
+			expected: false,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			result := workloadReplicasChanged(tc.oldObj, tc.newObj)
+			if result != tc.expected {
+				t.Errorf("expected %v, got %v", tc.expected, result)
+			}
+		})
+	}
+}
```

---

### Incident Patch 3: `639058be` (2026-08-27)
**Commit Message**: fix(ci): bump trivy-action to v0.36.0 to fix golangci-lint job failure

The golangci-lint job has been failing on every PR at the "Install Trivy"
step with exit code 1, right after resolving the version:

    aquasecurity/trivy info found version: 0.65.0 for v0.65.0/Linux/64bit
    ##[error]Process completed with exit code 1

The lint itself passes (424 issues before processing, 0 after); only the
Trivy scan step fails, which fails the whole job.

Root cause: trivy-action was pinned to a floating "master" commit
(b6643a29) whose default trivy version is v0.65.0. Upstream has since
deleted the v0.65.0 release (v0.65.0 through v0.69.1 are gone, the
oldest surviving release in that range is v0.69.2), so both the tarball
and checksum downloads now return HTTP 404 and contrib/install.sh exits 1.

Because the pin referenced a branch rather than a tag, dependabot could
not track it, which is how the default drifted onto a deleted release.
Pinning the SHA of the v0.36.0 tag restores dependabot tracking and moves
the default trivy version to v0.70.0, which is still published.

Also drop the 'skip-pkg-cache' and 'mod' inputs from the golangci-lint
step. They were removed in golangci-lint-act

**File**: `.github/workflows/ci.yaml` (modified, +1/-3)
```diff
@@ -62,10 +62,8 @@ jobs:
         with:
           version: ${{ env.GOLANGCI_VERSION }}
           args: --verbose
-          skip-pkg-cache: true
-          mod: readonly
       - name: Run Trivy vulnerability scanner in repo mode
-        uses: aquasecurity/trivy-action@b6643a29fecd7f34b3597bc6acb0a98b03d33ff8 # master
+        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
         with:
           scan-type: 'fs'
           ignore-unfixed: true
```

---

### Incident Patch 4: `9d68cb1a` (2026-06-28)
**Commit Message**: fix NodePodProbe nil labels panic

Signed-off-by: Jayant <212013719+Jayant-kernel@users.noreply.github.com>

**File**: `pkg/controller/nodepodprobe/node_pod_probe_controller.go` (modified, +3/-0)
```diff
@@ -337,6 +337,9 @@ func (r *ReconcileNodePodProbe) updatePodProbeStatus(pod *corev1.Pod, status app
 			util.SetPodConditionIfMsgChanged(podClone, condition)
 		}
 		oldMetadata := podClone.ObjectMeta.DeepCopy()
+		if podClone.Labels == nil {
+			podClone.Labels = map[string]string{}
+		}
 		if podClone.Annotations == nil {
 			podClone.Annotations = map[string]string{}
 		}
```

**File**: `pkg/controller/nodepodprobe/node_pod_probe_controller_test.go` (modified, +48/-0)
```diff
@@ -797,6 +797,54 @@ func TestSyncPodFromNodePodProbe(t *testing.T) {
 	}
 }
 
+func TestUpdatePodProbeStatusDoesNotPanicWithNilLabels(t *testing.T) {
+	pod := &corev1.Pod{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "pod-1",
+			Namespace: "default",
+		},
+	}
+	ppm := &appsv1alpha1.PodProbeMarker{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "ppm-1",
+			Namespace: "default",
+		},
+		Spec: appsv1alpha1.PodProbeMarkerSpec{
+			Probes: []appsv1alpha1.PodContainerProbe{
+				{
+					Name: "healthy",
+					MarkerPolicy: []appsv1alpha1.ProbeMarkerPolicy{
+						{
+							State: appsv1alpha1.ProbeSucceeded,
+							Labels: map[string]string{
+								"server-healthy": "true",
+							},
+						},
+					},
+				},
+			},
+		},
+	}
+	status := appsv1alpha1.PodProbeStatus{
+		ProbeStates: []appsv1alpha1.ContainerProbeState{
+			{
+				Name:  "ppm-1#healthy",
+				State: appsv1alpha1.ProbeSucceeded,
+			},
+		},
+	}
+
+	fakeClient := fake.NewClientBuilder().
+		WithScheme(scheme).
+		WithObjects(pod, ppm).
+		Build()
+	recon := ReconcileNodePodProbe{Client: fakeClient}
+
+	if err := recon.updatePodProbeStatus(pod, status); err != nil {
+		t.Fatalf("updatePodProbeStatus failed: %s", err.Error())
+	}
+}
+
 func checkNodePodProbeEqual(c client.WithWatch, t *testing.T, expect []*appsv1alpha1.NodePodProbe) bool {
 	for i := range expect {
 		obj := expect[i]
```

---

### Incident Patch 5: `b6666565` (2026-08-04)
**Commit Message**: fix(daemonset): Check owner kind before parsing API version

Skip API version parsing and error logging for owner references from unrelated controllers.

Refs #2517

Signed-off-by: Colvin-Y <ykwhrimfaxi@gmail.com>

**File**: `pkg/controller/daemonset/daemonset_event_handler.go` (modified, +5/-1)
```diff
@@ -187,12 +187,16 @@ func (e *podEventHandler) Generic(ctx context.Context, evt event.TypedGenericEve
 }
 
 func (e *podEventHandler) resolveControllerRef(namespace string, controllerRef *metav1.OwnerReference) *appsv1beta1.DaemonSet {
+	if controllerRef.Kind != controllerKind.Kind {
+		return nil
+	}
+
 	refGV, err := schema.ParseGroupVersion(controllerRef.APIVersion)
 	if err != nil {
 		klog.ErrorS(err, "Could not parse APIVersion in OwnerReference", "ownerRef", controllerRef)
 		return nil
 	}
-	if controllerRef.Kind != controllerKind.Kind || refGV.Group != controllerKind.Group {
+	if refGV.Group != controllerKind.Group {
 		return nil
 	}
 
```

---

### Incident Patch 6: `f710af4f` (2026-08-03)
**Commit Message**: fix(daemonset): Handle legacy owner reference versions

Resolve DaemonSet Pod owner references by Group and Kind so Pods created through v1alpha1 continue to enqueue the v1beta1 controller after an upgrade. Retain Name and UID validation to prevent owner mismatches.

Fixes #2517

Signed-off-by: Colvin-Y <ykwhrimfaxi@gmail.com>

**File**: `pkg/controller/daemonset/daemonset_event_handler.go` (modified, +7/-1)
```diff
@@ -25,6 +25,7 @@ import (
 	v1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/labels"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/util/workqueue"
 	"k8s.io/klog/v2"
@@ -186,7 +187,12 @@ func (e *podEventHandler) Generic(ctx context.Context, evt event.TypedGenericEve
 }
 
 func (e *podEventHandler) resolveControllerRef(namespace string, controllerRef *metav1.OwnerReference) *appsv1beta1.DaemonSet {
-	if controllerRef.Kind != controllerKind.Kind || controllerRef.APIVersion != controllerKind.GroupVersion().String() {
+	refGV, err := schema.ParseGroupVersion(controllerRef.APIVersion)
+	if err != nil {
+		klog.ErrorS(err, "Could not parse APIVersion in OwnerReference", "ownerRef", controllerRef)
+		return nil
+	}
+	if controllerRef.Kind != controllerKind.Kind || refGV.Group != controllerKind.Group {
 		return nil
 	}
 
```

**File**: `pkg/controller/daemonset/daemonset_event_handler_test.go` (modified, +81/-0)
```diff
@@ -41,6 +41,87 @@ func newTestPodEventHandler(reader client.Reader, expectations kubecontroller.Co
 	}
 }
 
+func TestResolveControllerRef(t *testing.T) {
+	ds := &appsv1beta1.DaemonSet{ObjectMeta: metav1.ObjectMeta{
+		Name:      "ds",
+		Namespace: "default",
+		UID:       "ds-uid",
+	}}
+	handler := newTestPodEventHandler(fake.NewClientBuilder().WithObjects(ds).Build(), nil)
+
+	tests := []struct {
+		name        string
+		ownerRef    metav1.OwnerReference
+		wantResolve bool
+	}{
+		{
+			name: "v1beta1 owner reference",
+			ownerRef: metav1.OwnerReference{
+				APIVersion: "apps.kruise.io/v1beta1",
+				Kind:       "DaemonSet",
+				Name:       "ds",
+				UID:        "ds-uid",
+			},
+			wantResolve: true,
+		},
+		{
+			name: "v1alpha1 owner reference",
+			ownerRef: metav1.OwnerReference{
+				APIVersion: "apps.kruise.io/v1alpha1",
+				Kind:       "DaemonSet",
+				Name:       "ds",
+				UID:        "ds-uid",
+			},
+			wantResolve: true,
+		},
+		{
+			name: "different group",
+			ownerRef: metav1.OwnerReference{
+				APIVersion: "apps.example.io/v1beta1",
+				Kind:       "DaemonSet",
+				Name:       "ds",
+				UID:        "ds-uid",
+			},
+		},
+		{
+			name: "different kind",
+			ownerRef: metav1.OwnerReference{
+				APIVersion: "apps.kruise.io/v1alpha1",
+				Kind:       "CloneSet",
+				Name:       "ds",
+				UID:        "ds-uid",
+			},
+		},
+		{
+			name: "different uid",
+			ownerRef: metav1.OwnerReference{
+				APIVersion: "apps.kruise.io/v1alpha1",
+				Kind:       "DaemonSet",
+				Name:       "ds",
+				UID:        "other-uid",
+			},
+		},
+		{
+			name: "malformed api version",
+			ownerRef: metav1.OwnerReference{
+				APIVersion: "apps.kruise.io/v1alpha1/invalid",
+				Kind:       "DaemonSet",
+				Name:       "ds",
+				UID:        "ds-uid",
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := handler.resolveControllerRef("default", &tt.ownerRef)
+			if (got != nil) != tt.wantResolve {
+				t.Fatalf("resolveControllerRef() resolved = %v, want %v", got != nil, tt.wantResolve)
+			}
+		})
+	}
+}
+
 func TestEnqueueRequestForPodCreate(t *testing.T) {
 	lTrue := true
 	cases := []struct {
```

---

### Incident Patch 7: `07169cfa` (2026-07-02)
**Commit Message**: fix(client): avoid panic in ShouldUpdateResourceByResize on GKE/EKS version strings (#2502)

coreos/go-semver.New panics on strings that are not in dotted-tri format.
The K8s server version returned by /version is reported by some cloud
providers with a trailing '+' or build metadata (e.g. v1.28+gke.1,
v1.30+eks.1), which would previously crash the controller on startup.

Changes:
- Strip the leading 'v' prefix from curVersion.GitVersion.
- Clean each dotted component with a new digitsOnly helper so cloud
  build metadata is dropped before parsing (1.32+gke.1 -> 1.32.1).
- Add a deferred recover() to return false on any remaining format
  exception, preserving the pre-1.32 update path as a safe default.
- Add unit tests covering exact, above, below, GKE/EKS-cleaned,
  empty, garbage, and missing-segment inputs.

**File**: `pkg/client/registry.go` (modified, +39/-2)
```diff
@@ -2,6 +2,7 @@ package client
 
 import (
 	"fmt"
+	"strings"
 
 	"github.com/coreos/go-semver/semver"
 	"k8s.io/apimachinery/pkg/version"
@@ -54,6 +55,42 @@ func GetCurrentServerVersion() *version.Info {
 
 // ShouldUpdateResourceByResize returns whether should update resource by resize
 // The resize sub-resource was introduced in version 1.32, https://github.com/kubernetes/kubernetes/pull/128266
-func ShouldUpdateResourceByResize() bool {
-	return semver.New(fmt.Sprintf("%s.%s.0", curVersion.Major, curVersion.Minor)).Compare(*semver.New("1.32.0")) >= 0
+func ShouldUpdateResourceByResize() (result bool) {
+	defer func() {
+		if r := recover(); r != nil {
+			// semver.New panics on strings that are not in dotted-tri format
+			// (e.g. unexpected non-numeric content from custom build metadata).
+			// Treat that as "not >= 1.32" so the caller falls back to the
+			// pre-1.32 update path.
+			_ = r
+			result = false
+		}
+	}()
+	// coreos/go-semver does not strip the leading 'v' that k8s prefixes on
+	// GitVersion (e.g. "v1.32.0"). Remove it before parsing.
+	v := strings.TrimPrefix(curVersion.GitVersion, "v")
+	// digitsOnly cleans each dotted component so cloud-provider build metadata
+	// (e.g. "1.32+gke.1" → "1.32.1") does not cause a parse panic. SplitN
+	// keeps at most three parts (major/minor/patch); any extra segments are
+	// folded into the last part and then trimmed by digitsOnly. Any
+	// remaining format exception is caught by the deferred recover above.
+	parts := strings.SplitN(v, ".", 3)
+	for i, p := range parts {
+		parts[i] = digitsOnly(p)
+	}
+	cur := semver.New(strings.Join(parts, "."))
+	return cur.Compare(*semver.New("1.32.0")) >= 0
+}
+
+// digitsOnly returns the leading numeric prefix of a version component.
+// This handles GKE/EKS-style build metadata embedded in a component
+// (e.g. "32+gke" → "32"). If the input has no leading digit, an empty
+// string is returned.
+func digitsOnly(s string) string {
+	for i, r := range s {
+		if r < '0' || r > '9' {
+			return s[:i]
+		}
+	}
+	return s
 }
```

**File**: `pkg/client/registry_test.go` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+/*
+Copyright 2026 The Kruise Authors.
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
+	"testing"
+
+	"k8s.io/apimachinery/pkg/version"
+)
+
+func TestDigitsOnly(t *testing.T) {
+	cases := []struct {
+		name string
+		in   string
+		want string
+	}{
+		{name: "empty string", in: "", want: ""},
+		{name: "plain digits", in: "28", want: "28"},
+		{name: "gke build metadata suffix", in: "32+gke", want: "32"},
+		{name: "eks build metadata suffix", in: "30+eks", want: "30"},
+		{name: "trailing plus", in: "28+", want: "28"},
+		{name: "major with plus", in: "1+", want: "1"},
+		{name: "all non-numeric", in: "+++", want: ""},
+		{name: "letters only", in: "abc", want: ""},
+		{name: "leading digits then letters", in: "1a2b3c", want: "1"},
+		{name: "zero", in: "0", want: "0"},
+		{name: "large number", in: "132", want: "132"},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			if got := digitsOnly(tc.in); got != tc.want {
+				t.Errorf("digitsOnly(%q) = %q, want %q", tc.in, got, tc.want)
+			}
+		})
+	}
+}
+
+func TestShouldUpdateResourceByResize(t *testing.T) {
+	original := curVersion
+	t.Cleanup(func() {
+		curVersion = original
+	})
+
+	cases := []struct {
+		name    string
+		version *version.Info
+		want    bool
+	}{
+		{
+			name:    "exactly 1.32.0 returns true",
+			version: &version.Info{Major: "1", Minor: "32", GitVersion: "v1.32.0"},
+			want:    true,
+		},
+		{
+			name:    "above 1.32 returns true",
+			version: &version.Info{Major: "1", Minor: "33", GitVersion: "v1.33.0"},
+			want:    true,
+		},
+		{
+			name:    "below 1.32 returns false",
+			version: &version.Info{Major: "1", Minor: "31", GitVersion: "v1.31.0"},
+			want:    false,
+		},
+		{
+			name:    "gke-style 1.28+gke.1 is cleaned to 1.28.1 and returns false",
+			version: &version.Info{Major: "1", Minor: "28+", GitVersion: "v1.28+gke.1"},
+			want:    false,
+		},
+		{
+			name:    "gke-style 1.32+gke.1 is cleaned to 1.32.1 and returns true",
+			version: &version.Info{Major: "1", Minor: "32+", GitVersion: "v1.32+gke.1"},
+			want:    true,
+		},
+		{
+			name:    "eks-style 1.30+eks.1 is cleaned to 1.30.1 and returns false",
+			version: &version.Info{Major: "1", Minor: "30+", GitVersion: "v1.30+eks.1"},
+			want:    false,
+		},
+		{
+			name:    "1.28+.1 is cleaned to 1.28.1 and returns false",
+			version: &version.Info{Major: "1", Minor: "28+", GitVersion: "v1.28+.1"},
+			want:    false,
+		},
+		{
+			name:    "extra segment after patch is folded into patch and cleaned to 1.32.0",
+			version: &version.Info{Major: "1", Minor: "32", GitVersion: "v1.32.0.extra"},
+			want:    true,
+		},
+		{
+			name:    "empty GitVersion recovers from panic and returns false",
+			version: &version.Info{Major: "1", Minor: ""},
+			want:    false,
+		},
+		{
+			name:    "non-semver garbage recovers from panic and returns false",
+			version: &version.Info{Major: "1", Minor: "32", GitVersion: "garbage"},
+			want:    false,
+		},
+		{
+			name:    "missing patch segment recovers from panic and returns false",
+			version: &version.Info{Major: "1", Minor: "32", GitVersion: "1.32"},
+			want:    false,
+		},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			curVersion = tc.version
+			defer func() {
+				if r := recover(); r != nil {
+					t.Fatalf("ShouldUpdateResourceByResize leaked a panic for GitVersion=%q: %v",
+						tc.version.GitVersion, r)
+				}
+			}()
+			if got := Should
```

---

### Incident Patch 8: `2ba71965` (2026-07-02)
**Commit Message**: fix(e2e): poll for LastTerminationState in 'recreates containers by force'

The 'recreates containers by force' e2e test read
containerStatus.LastTerminationState.Terminated directly after
CRR completion. After a force-recreate the kubelet may not have
populated the previous-termination state yet, leading to a nil
pointer dereference:

  runtime error: invalid memory address or nil pointer dereference
  at test/e2e/apps/v1alpha1/containerrecreate.go:624

Wrap the access in gomega.Eventually that polls the pod until both
containers have a non-nil LastTerminationState.Terminated (matching
the pattern already used in the 'recreates containers with
preStopHook' test), and apply the same hardening to the first block
of the same It (which has the same pattern and the same risk).

**File**: `test/e2e/apps/v1alpha1/containerrecreate.go` (modified, +22/-0)
```diff
@@ -566,6 +566,17 @@ var _ = ginkgo.Describe("ContainerRecreateRequest", ginkgo.Label("ContainerRecre
 				gomega.Expect(sidecarContainerStatus.RestartCount).Should(gomega.Equal(int32(1)))
 
 				ginkgo.By("Check Pod sidecar container recreated not waiting for app container ready")
+				// LastTerminationState.Terminated may not yet be populated by the
+				// kubelet right after a force-recreate, so poll until both
+				// containers have a previous termination recorded.
+				gomega.Eventually(func() bool {
+					pod, err = tester.GetPod(pod.Name)
+					gomega.Expect(err).NotTo(gomega.HaveOccurred())
+					appContainerStatus = util.GetContainerStatus("app", pod)
+					sidecarContainerStatus = util.GetContainerStatus("sidecar", pod)
+					return appContainerStatus.LastTerminationState.Terminated != nil &&
+						sidecarContainerStatus.LastTerminationState.Terminated != nil
+				}, 30*time.Second, time.Second).Should(gomega.Equal(true))
 				interval := sidecarContainerStatus.LastTerminationState.Terminated.FinishedAt.Sub(appContainerStatus.LastTerminationState.Terminated.FinishedAt.Time)
 				gomega.Expect(interval < 3*time.Second).Should(gomega.Equal(true))
 			}
@@ -621,6 +632,17 @@ var _ = ginkgo.Describe("ContainerRecreateRequest", ginkgo.Label("ContainerRecre
 				gomega.Expect(sidecarContainerStatus.RestartCount).Should(gomega.Equal(int32(1)))
 
 				ginkgo.By("Check Pod sidecar container recreated after app container ready")
+				// LastTerminationState.Terminated may not yet be populated by the
+				// kubelet right after a force-recreate, so poll until both
+				// containers have a previous termination recorded.
+				gomega.Eventually(func() bool {
+					pod, err = tester.GetPod(pod.Name)
+					gomega.Expect(err).NotTo(gomega.HaveOccurred())
+					appContainerStatus = util.GetContainerStatus("app", pod)
+					sidecarContainerStatus = util.GetContainerStatus("sidecar", pod)
+					return appContainerStatus.LastTerminationState.Terminated != nil &&
+						sidecarContainerStatus.LastTerminationState.Terminated != nil
+				}, 30*time.Second, time.Second).Should(gomega.Equal(true))
 				interval := sidecarContainerStatus.LastTerminationState.Terminated.FinishedAt.Sub(appContainerStatus.LastTerminationState.Terminated.FinishedAt.Time)
 				gomega.Expect(interval >= 5*time.Second).Should(gomega.Equal(true))
 			}
```

---

### Incident Patch 9: `4c2bbcec` (2026-06-21)
**Commit Message**: fix(cloneset): fix nil annotation panic in getActiveRevisions

When a ControllerRevision from history has nil Annotations, writing to
lastEqualRevision.Annotations causes a panic (assignment to entry in nil
map). This adds a nil check and initialization before the assignment,
following the same pattern used in PatchVCTemplateHash.

Also adds unit tests for getActiveRevisions covering all code branches:
- equal revision with nil annotations (the bug case)
- equal revision is the last (immediately prior)
- no equal revisions, create new one
- equal revision with matching VCT hash
- equal revision with non-nil but different VCT hash
- empty revisions list

**File**: `AGENTS.md` (modified, +16/-9)
```diff
@@ -163,12 +163,19 @@ When adding a new API type or controller:
 5. make generate && make manifests
 ```
 
-## Common Pitfalls
-
-- Forgetting `make generate && make manifests` after modifying API types
-- Using `github.com/pkg/errors` instead of `fmt.Errorf` with `%w`
-- Manually editing generated code under `pkg/client/`, `zz_generated.deepcopy.go`, or `config/crd/bases/`
-- Missing license boilerplate on new `.go` files
-- Import order not matching goimports local prefix convention
-- Performing blocking or locking operations in controller event handlers instead of the reconcile loop
-- Accessing cluster-scoped resources from daemon code
+## Behavioral Rules
+
+- Import order need matching goimports local prefix convention
+- Don't perform blocking or locking operations in controller event handlers instead of the reconcile loop
+- Don't Access cluster-scoped resources from daemon code
+- Read related files before modifying code
+- Don't edit `client/`, `proto/`, `config/crd/` — run `make generate` or `make manifests` instead
+- After modifying `api/`, run `make generate manifests`
+- Don't delete comments unless outdated
+- New `.go` files need Apache 2.0 license header from `hack/boilerplate.go.txt`
+- Use `Expectations` (`pkg/utils/expectations/`) for slow informer cache issues
+- New APIs/architectural changes need proposal in `docs/proposals/`
+- Ask user when unsure about business logic
+- Always edit the files on your own, never use automation tools or scripts
+- All comments must be in English
+- Always commit with sign-off (e.g. `git commit -s`)
```

**File**: `pkg/controller/cloneset/cloneset_controller.go` (modified, +3/-0)
```diff
@@ -498,6 +498,9 @@ func (r *ReconcileCloneSet) getActiveRevisions(cs *appsv1beta1.CloneSet, revisio
 		lastEqualRevision := equalRevisions[equalCount-1]
 		if !VCTHashEqual(lastEqualRevision, updateRevision) {
 			klog.InfoS("Revision vct hash will be updated", "revisionName", lastEqualRevision.Name, "lastRevisionVCTHash", lastEqualRevision.Annotations[volumeclaimtemplate.HashAnnotation], "updateRevisionVCTHash", updateRevision.Annotations[volumeclaimtemplate.HashAnnotation])
+			if lastEqualRevision.Annotations == nil {
+				lastEqualRevision.Annotations = make(map[string]string)
+			}
 			lastEqualRevision.Annotations[volumeclaimtemplate.HashAnnotation] = updateRevision.Annotations[volumeclaimtemplate.HashAnnotation]
 		}
 		// if the equivalent revision is not immediately prior we will roll back by incrementing the
```

**File**: `pkg/controller/cloneset/cloneset_controller_test.go` (modified, +295/-0)
```diff
@@ -1331,3 +1331,298 @@ func randomString(n int) string {
 	}
 	return string(b)
 }
+
+func TestGetActiveRevisions(t *testing.T) {
+	// Helper to create a CloneSet with VolumeClaimTemplates
+	newCloneSetWithVCT := func() *appsv1beta1.CloneSet {
+		cs := &appsv1beta1.CloneSet{
+			ObjectMeta: metav1.ObjectMeta{
+				Name:      "test-cs",
+				Namespace: "default",
+				UID:       types.UID("test-uid"),
+			},
+			Spec: appsv1beta1.CloneSetSpec{
+				Replicas: getInt32(1),
+				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
+				Template: v1.PodTemplateSpec{
+					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
+					Spec: v1.PodSpec{
+						Containers: []v1.Container{{Name: "nginx", Image: "nginx:1.9.1"}},
+					},
+				},
+				VolumeClaimTemplates: []v1.PersistentVolumeClaim{
+					{
+						ObjectMeta: metav1.ObjectMeta{Name: "data-vol"},
+						Spec: v1.PersistentVolumeClaimSpec{
+							AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
+							Resources: v1.VolumeResourceRequirements{
+								Requests: v1.ResourceList{v1.ResourceStorage: resource.MustParse("1Gi")},
+							},
+						},
+					},
+				},
+			},
+		}
+		defaults.SetDefaultsCloneSetV1beta1(cs, true)
+		return cs
+	}
+
+	// Pre-compute the Data.Raw that NewRevision produces for the CloneSet with VCT.
+	// This allows us to construct "equal" history revisions whose Data.Raw matches
+	// the updateRevision that getActiveRevisions will create internally.
+	rc := revisioncontrol.NewRevisionControl()
+	var cc int32
+	refRev, err := rc.NewRevision(newCloneSetWithVCT(), 1, &cc)
+	if err != nil {
+		t.Fatalf("failed to create reference revision: %v", err)
+	}
+	equalDataRaw := refRev.Data.Raw
+	expectedVCTHash := refRev.Annotations[volumeclaimtemplate.HashAnnotation]
+
+	// A different Data.Raw that will not match any equal revision.
+	differentDataRaw := []byte(`{"spec":{"template":{"$patch":"replace","metadata":{"creationTimestamp":null,"labels":{"foo":"bar"}},"spec":{"containers":[{"image":"different:1.0","name":"nginx"}]}}}}`)
+
+	cases := []struct {
+		name         string
+		getCloneSet  func() *appsv1beta1.CloneSet
+		getRevisions func() []*appsv1.ControllerRevision
+		expectErr    bool
+		validate     func(t *testing.T, currentRev, updateRev *appsv1.ControllerRevision, collisionCount int32)
+	}{
+		{
+			// This is the main bug case: an equal revision with nil Annotations.
+			// Before the fix, writing to lastEqualRevision.Annotations[...] panics
+			// because the map is nil.
+			name:        "equal revision with nil annotations should not panic",
+			getCloneSet: newCloneSetWithVCT,
+			getRevisions: func() []*appsv1.ControllerRevision {
+				return []*appsv1.ControllerRevision{
+					{
+						ObjectMeta: metav1.ObjectMeta{
+							Name:        "test-cs-equal-1",
+							Namespace:   "default",
+							Annotations: nil,
+						},
+						Revision: 1,
+						Data:     runtime.RawExtension{Raw: equalDataRaw},
+					},
+					{
+						ObjectMeta: metav1.ObjectMeta{
+							Name:      "test-cs-diff-2",
+							Namespace: "default",
+						},
+						Revision: 2,
+						Data:     runtime.RawExtension{Raw: differentDataRaw},
+					},
+				}
+			},
+			expectErr: false,
+			validate: func(t *testing.T, currentRev, updateRev *appsv1.ControllerRevision, collisionCount int32) {
+				if updateRev == nil {
+					t.Fatal("expected non-nil updateRevision")
+				}
+				// The updateRevision should have been rolled back to the equal revision
+				// with the VCT hash annotation set.
+				if updateRev.Annotations == nil {
+					t.Fatal("expected non-nil annotations on updateRevision")
+				}
+				if got := updateRev.Annotations[volumeclaimtemplate.HashAnnotation]; got != expectedVCTHash {
+					t.Errorf("expected VCT hash %q, got %q", expectedVCTHash, got)
+				}
+				// The updateRevision should have the new revision number (3 = 2 + 1).
+				if updateRev.Revision != 3 {
+					t.Errorf("expected revision 3, g
```

---

### Incident Patch 10: `7ac04141` (2026-06-18)
**Commit Message**: fix(e2e): use Eventually for WorkloadSpread status check after scale down

Signed-off-by: liheng <liheng.zms@alibaba-inc.com>

**File**: `test/e2e/apps/v1beta1/workloadspread.go` (modified, +7/-4)
```diff
@@ -22,6 +22,7 @@ import (
 	"fmt"
 	"sort"
 	"strconv"
+	"time"
 
 	"github.com/onsi/ginkgo/v2"
 	"github.com/onsi/gomega"
@@ -199,10 +200,12 @@ var _ = ginkgo.Describe("WorkloadSpread v1beta1", ginkgo.Label("WorkloadSpread",
 			gomega.Expect(err).NotTo(gomega.HaveOccurred())
 			gomega.Expect(pods).To(gomega.HaveLen(4))
 
-			workloadSpread, err = kc.AppsV1beta1().WorkloadSpreads(workloadSpread.Namespace).Get(context.TODO(), workloadSpread.Name, metav1.GetOptions{})
-			gomega.Expect(err).NotTo(gomega.HaveOccurred())
-			gomega.Expect(workloadSpread.Status.SubsetStatuses[0].Replicas).To(gomega.Equal(int32(2)))
-			gomega.Expect(workloadSpread.Status.SubsetStatuses[1].Replicas).To(gomega.Equal(int32(2)))
+			gomega.Eventually(func(g gomega.Gomega) {
+				ws, getErr := kc.AppsV1beta1().WorkloadSpreads(workloadSpread.Namespace).Get(context.TODO(), workloadSpread.Name, metav1.GetOptions{})
+				g.Expect(getErr).NotTo(gomega.HaveOccurred())
+				g.Expect(ws.Status.SubsetStatuses[0].Replicas).To(gomega.Equal(int32(2)))
+				g.Expect(ws.Status.SubsetStatuses[1].Replicas).To(gomega.Equal(int32(2)))
+			}, time.Minute, time.Second).Should(gomega.Succeed())
 
 			ginkgo.By("v1beta1: deploy in two zones done")
 		})
```

#### Recent Merged Pull Requests:
- **PR #2561** (2026-09-11): cherry-pick #2274 to release-1.8: update Pod condition without conflict retry for specific version (@furykerry)
- **PR #2555** (closed): chore(deps): bump github/codeql-action/analyze from 4.31.7 to 4.37.9 (@dependabot[bot])
- **PR #2554** (closed): chore(deps): bump crate-ci/typos from 1.39.2 to 1.50.0 (@dependabot[bot])
- **PR #2553** (closed): chore(deps): bump github/codeql-action/autobuild from 4.31.7 to 4.37.9 (@dependabot[bot])
- **PR #2552** (closed): chore(deps): bump github/codeql-action/init from 4.31.7 to 4.37.9 (@dependabot[bot])
- **PR #2551** (2026-08-27): fix(ci): bump trivy-action to v0.36.0 to fix golangci-lint job failure (@furykerry)
- **PR #2549** (2026-08-28): chore(deps): bump golangci/golangci-lint-action from 8.0.0 to 9.3.0 (@dependabot[bot])
- **PR #2548** (closed): chore(deps): bump github/codeql-action/init from 4.31.7 to 4.37.8 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
