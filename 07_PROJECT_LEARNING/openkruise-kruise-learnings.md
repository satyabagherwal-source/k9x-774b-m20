# Forensic Learning Record (Deep Inspection): openkruise/kruise

> **Canonical Artifact**: `07_PROJECT_LEARNING/openkruise-kruise-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openkruise/kruise](https://github.com/openkruise/kruise))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:42:06.350Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openkruise/kruise`
- **Description**: Automated management of large-scale applications on Kubernetes (incubating project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5349 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apis/apps/pub/lifecycle.go`
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

package pub

const (
	LifecycleStateKey     = "lifecycle.apps.kruise.io/state"
	LifecycleTimestampKey = "lifecycle.apps.kruise.io/timestamp"

	// LifecycleStatePreparingNormal means the Pod is created but unavailable.
	// It will translate to Normal state if Lifecycle.PreNormal is hooked.
	LifecycleStatePreparingNormal LifecycleStateType = "PreparingNormal"
	// LifecycleStateNormal is a necessary condition for Pod to be available.
	LifecycleStateNormal LifecycleStateType = "Normal"
	// LifecycleStatePreparingUpdate means pod is being prepared to update.
	// It will translate to Updating state if Lifecycle.InPlaceUpdate is Not hooked.
	LifecycleStatePreparingUpdate LifecycleStateType = "PreparingUpdate"
	// LifecycleStateUpdating means the Pod is being updated.
	// It will translate to Updated state if the in-place update of the Pod is done.
	LifecycleStateUpdating LifecycleStateType = "Updating"
	// LifecycleStateUpdated means the Pod is updated, but unavailable.
	// It will translate to Normal state if Lifecycle.InPlaceUpdate is hooked.
	LifecycleStateUpdated LifecycleStateType = "Updated"
	// LifecycleStatePreparingDelete means the Pod is prepared to delete.
	// The Pod will be deleted by workload if Lifecycle.PreDelete is Not hooked.
	LifecycleStatePreparingDelete LifecycleStateType = "PreparingDelete"
)

type LifecycleStateType string

// Lifecycle contains the hooks for Pod lifecycle.
type Lifecycle struct {
	// PreDelete is the hook before Pod to be deleted.
	PreDelete *LifecycleHook `json:"preDelete,omitempty"`
	// InPlaceUpdate is the hook before Pod to update and after Pod has been updated.
	InPlaceUpdate *LifecycleHook `json:"inPlaceUpdate,omitempty"`
	// PreNormal is the hook after Pod to be created and ready to be Normal.
	PreNormal *LifecycleHook `json:"preNormal,omitempty"`
}

type LifecycleHook struct {
	LabelsHandler     map[string]string `json:"labelsHandler,omitempty"`
	FinalizersHandler []string          `json:"finalizersHandler,omitempty"`
	// MarkPodNotReady = true means:
	// - Pod will be set to 'NotReady' at preparingDelete/preparingUpdate state.
	// - Pod will be restored to 'Ready' at Updated state if it was set to 'NotReady' at preparingUpdate state.
	// Currently, MarkPodNotReady only takes effect on InPlaceUpdate & PreDelete hook.
	// Default to false.
	MarkPodNotReady bool `json:"markPodNotReady,omitempty"`
}

```

### Core Architecture Module: `apis/apps/v1alpha1/persistent_pod_state_conversion.go`
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

package v1alpha1

import (
	"fmt"

	"sigs.k8s.io/controller-runtime/pkg/conversion"

	appsv1beta1 "github.com/openkruise/kruise/apis/apps/v1beta1"
)

func (src *PersistentPodState) ConvertTo(dstRaw conversion.Hub) error {
	dst, ok := dstRaw.(*appsv1beta1.PersistentPodState)
	if !ok {
		return fmt.Errorf("unsupported hub type %T", dstRaw)
	}
	return convertPersistentPodStateToV1beta1(src, dst)
}

func (dst *PersistentPodState) ConvertFrom(srcRaw conversion.Hub) error {
	src, ok := srcRaw.(*appsv1beta1.PersistentPodState)
	if !ok {
		return fmt.Errorf("unsupported hub type %T", srcRaw)
	}
	return convertPersistentPodStateFromV1beta1(src, dst)
}

func convertPersistentPodStateToV1beta1(src *PersistentPodState, dst *appsv1beta1.PersistentPodState) error {
	dst.ObjectMeta = src.ObjectMeta

	dst.Spec = appsv1beta1.PersistentPodStateSpec{
		TargetReference: appsv1beta1.TargetReference{
			APIVersion: src.Spec.TargetReference.APIVersion,
			Kind:       src.Spec.TargetReference.Kind,
			Name:       src.Spec.TargetReference.Name,
		},
		PersistentPodStateRetentionPolicy: appsv1beta1.PersistentPodStateRetentionPolicyType(src.Spec.PersistentPodStateRetentionPolicy),
	}
	if len(src.Spec.PersistentPodAnnotations) > 0 {
		dst.Spec.PersistentPodAnnotations = make([]appsv1beta1.PersistentPodAnnotation, len(src.Spec.PersistentPodAnnotations))
		for i, item := range src.Spec.PersistentPodAnnotations {
			dst.Spec.PersistentPodAnnotations[i] = appsv1beta1.PersistentPodAnnotation{Key: item.Key}
		}
	}
	if src.Spec.RequiredPersistentTopology != nil {
		dst.Spec.RequiredPersistentTopology = &appsv1beta1.NodeTopologyTerm{
			Keys: append([]string(nil), src.Spec.RequiredPersistentTopology.NodeTopologyKeys...),
		}
	}
	if len(src.Spec.PreferredPersistentTopology) > 0 {
		dst.Spec.PreferredPersistentTopology = make([]appsv1beta1.PreferredTopologyTerm, len(src.Spec.PreferredPersistentTopology))
		for i, item := range src.Spec.PreferredPersistentTopology {
			dst.Spec.PreferredPersistentTopology[i] = appsv1beta1.PreferredTopologyTerm{
				Weight: item.Weight,
				Preference: appsv1beta1.NodeTopologyTerm{
					Keys: append([]string(nil), item.Preference.NodeTopologyKeys...),
				},
			}
		}
	}
	dst.Status = convertPersistentPodStateStatusToV1beta1(src.Status)
	return nil
}

func convertPersistentPodStateFromV1beta1(src *appsv1beta1.PersistentPodState, dst *PersistentPodState) error {
	dst.ObjectMeta = src.ObjectMeta

	dst.Spec = PersistentPodStateSpec{
		TargetReference: TargetReference{
			APIVersion: src.Spec.TargetReference.APIVersion,
			Kind:       src.Spec.TargetReference.Kind,
			Name:       src.Spec.TargetReference.Name,
		},
		PersistentPodStateRetentionPolicy: PersistentPodStateRetentionPolicyType(src.Spec.PersistentPodStateRetentionPolicy),
	}
	if len(src.Spec.PersistentPodAnnotations) > 0 {
		dst.Spec.PersistentPodAnnotations = make([]PersistentPodAnnotation, len(src.Spec.PersistentPodAnnotations))
		for i, item := range src.Spec.PersistentPodAnnotations {
			dst.Spec.PersistentPodAnnotations[i] = PersistentPodAnnotation{Key: item.Key}
		}
	}
	if src.Spec.RequiredPersistentTopology != nil {
		dst.Spec.RequiredPersistentTopology = &NodeTopologyTerm{
			NodeTopologyKeys: append([]string(nil), src.Spec.RequiredPersistentTopology.Keys...),
		}
	}
	if len(src.Spec.PreferredPersistentTopology) > 0 {
		dst.Spec.PreferredPersistentTopology = make([]PreferredTopologyTerm, len(src.Spec.PreferredPersistentTopology))
		for i, item := range src.Spec.PreferredPersistentTopology {
			dst.Spec.PreferredPersistentTopology[i] = PreferredTopologyTerm{
				Weight: item.Weight,
				Preference: NodeTopologyTerm{
					NodeTopologyKeys: append([]string(nil), item.Preference.Keys...),
				},
			}
		}
	}
	dst.Status = convertPersistentPodStateStatusFromV1beta1(src.Status)
	return nil
}

func convertPersistentPodStateStatusToV1beta1(src PersistentPodStateStatus) appsv1beta1.PersistentPodStateStatus {
	dst := appsv1beta1.PersistentPodStateStatus{
		ObservedGeneration: src.ObservedGeneration,
	}
	if len(src.PodStates) == 0 {
		return dst
	}
	dst.PodStates = make(map[string]appsv1beta1.PodState, len(src.PodStates))
	for name, state := range src.PodStates {
		podState := appsv1beta1.PodState{NodeName: state.NodeName}
		if len(state.NodeTopologyLabels) > 0 {
			podState.NodeTopologyLabels = make(map[string]string, len(state.NodeTopologyLabels))
			for k, v := range state.NodeTopologyLabels {
				podState.NodeTopologyLabels[k] = v
			}
		}
		if len(state.Annotations) > 0 {
			podState.Annotations = make(map[string]string, len(state.Annotations))
			for k, v := range state.Annotations {
				podState.Annotations[k] = v
			}
		}
		dst.PodStates[name] = podState
	}
	return dst
}

func convertPersistentPodStateStatusFromV1beta1(src appsv1beta1.PersistentPodStateStatus) PersistentPodStateStatus {
	dst := PersistentPodStateStatus{
		ObservedGeneration: src.ObservedGeneration,
	}
	if len(src.PodStates) == 0 {
		return dst
	}
	dst.PodStates = make(map[string]PodState, len(src.PodStates))
	for name, state := range src.PodStates {
		podState := PodState{NodeName: state.NodeName}
		if len(state.NodeTopologyLabels) > 0 {
			podState.NodeTopologyLabels = make(map[string]string, len(state.NodeTopologyLabels))
			for k, v := range state.NodeTopologyLabels {
				podState.NodeTopologyLabels[k] = v
			}
		}
		if len(state.Annotations) > 0 {
			podState.Annotations = make(map[string]string, len(state.Annotations))
			for k, v := range state.Annotations {
				podState.Annotations[k] = v
			}
		}
		dst.PodStates[name] = podState
	}
	return dst
}

```

### Core Architecture Module: `apis/apps/v1alpha1/persistent_pod_state_types.go`
```
/*
Copyright 2022 The Kruise Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless persistent by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!
// NOTE: json tags are persistent.  Any new fields you add must have json tags for the fields to be serialized.

const (
	// AnnotationAutoGeneratePersistentPodState indicates kruise will auto generate PersistentPodState object
	// Need to work with AnnotationRequiredPersistentTopology and AnnotationPreferredPersistentTopology
	AnnotationAutoGeneratePersistentPodState = "kruise.io/auto-generate-persistent-pod-state"
	// AnnotationRequiredPersistentTopology Pod rebuilt topology required for node labels
	// for example kruise.io/required-persistent-topology: topology.kubernetes.io/zone[,xxx]
	// optional
	AnnotationRequiredPersistentTopology = "kruise.io/required-persistent-topology"
	// AnnotationPreferredPersistentTopology Pod rebuilt topology preferred for node labels and default with 100 weight
	// for example kruise.io/preferred-persistent-topology: kubernetes.io/hostname[,xxx]
	// optional
	AnnotationPreferredPersistentTopology = "kruise.io/preferred-persistent-topology"
	// AnnotationPersistentPodAnnotations Pod needs persistent annotations
	// for example kruise.io/persistent-pod-annotations: cni.projectcalico.org/podIP[,xxx]
	// optional
	AnnotationPersistentPodAnnotations = "kruise.io/persistent-pod-annotations"
)

// PersistentPodStateSpec defines the desired state of PersistentPodState
type PersistentPodStateSpec struct {
	// TargetReference contains enough information to let you identify a workload for PersistentPodState
	// Selector and TargetReference are mutually exclusive, TargetReference is priority to take effect
	// current only support StatefulSet
	TargetReference TargetReference `json:"targetRef"`

	// Persist the annotations information of the pods that need to be saved
	PersistentPodAnnotations []PersistentPodAnnotation `json:"persistentPodAnnotations,omitempty"`

	// Pod rebuilt topology required for node labels
	// for example kubernetes.io/hostname, failure-domain.beta.kubernetes.io/zone
	RequiredPersistentTopology *NodeTopologyTerm `json:"requiredPersistentTopology,omitempty"`

	// Pod rebuilt topology preferred for node labels, with xx weight
	// for example  kubernetes.io/hostname, failure-domain.beta.kubernetes.io/zone
	PreferredPersistentTopology []PreferredTopologyTerm `json:"preferredPersistentTopology,omitempty"`

	// PersistentPodStateRetentionPolicy describes the policy used for PodState.
	// The default policy of 'WhenScaled' causes when scale down statefulSet, deleting it.
	// +optional
	PersistentPodStateRetentionPolicy PersistentPodStateRetentionPolicyType `json:"persistentPodStateRetentionPolicy,omitempty"`
}

type PreferredTopologyTerm struct {
	Weight     int32            `json:"weight"`
	Preference NodeTopologyTerm `json:"preference"`
}
type NodeTopologyTerm struct {
	// A list of node selector requirements by node's labels.
	NodeTopologyKeys []string `json:"nodeTopologyKeys"`
}

type PersistentPodAnnotation struct {
	Key string `json:"key"`
}

type PersistentPodStateRetentionPolicyType string

const (
	// PersistentPodStateRetentionPolicyWhenScaled specifies when scale down statefulSet, deleting podState record.
	PersistentPodStateRetentionPolicyWhenScaled = "WhenScaled"
	// PersistentPodStateRetentionPolicyWhenDeleted specifies when delete statefulSet, deleting podState record.
	PersistentPodStateRetentionPolicyWhenDeleted = "WhenDeleted"
)

type PersistentPodStateStatus struct {
	// observedGeneration is the most recent generation observed for this PersistentPodState. It corresponds to the
	// PersistentPodState's generation, which is updated on mutation by the API Server.
	ObservedGeneration int64 `json:"observedGeneration"`
	// When the pod is ready, record some status information of the pod, such as: labels, annotations, topologies, etc.
	// map[string]PodState -> map[Pod.Name]PodState
	PodStates map[string]PodState `json:"podStates,omitempty"`
}

type PodState struct {
	// pod.spec.nodeName
	NodeName string `json:"nodeName,omitempty"`
	// node topology labels key=value
	// for example kubernetes.io/hostname=node-1
	NodeTopologyLabels map[string]string `json:"nodeTopologyLabels,omitempty"`
	// pod persistent annotations
	Annotations map[string]string `json:"annotations,omitempty"`
}

// +genclient
// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

// PersistentPodState is the Schema for the PersistentPodState API
type PersistentPodState struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   PersistentPodStateSpec   `json:"spec,omitempty"`
	Status PersistentPodStateStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// PersistentPodStateList contains a list of PersistentPodState
type PersistentPodStateList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []PersistentPodState `json:"items"`
}

func init() {
	SchemeBuilder.Register(&PersistentPodState{}, &PersistentPodStateList{})
}

```

### Core Architecture Module: `apis/apps/v1alpha1/statefulset_conversion.go`
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

package v1alpha1

import (
	"fmt"

	"sigs.k8s.io/controller-runtime/pkg/conversion"

	"github.com/openkruise/kruise/apis/apps/v1beta1"
)

func (sts *StatefulSet) ConvertTo(dst conversion.Hub) error {
	switch t := dst.(type) {
	case *v1beta1.StatefulSet:
		stsv1beta1 := dst.(*v1beta1.StatefulSet)
		stsv1beta1.ObjectMeta = sts.ObjectMeta

		// spec
		stsv1beta1.Spec = v1beta1.StatefulSetSpec{
			Replicas:             sts.Spec.Replicas,
			Selector:             sts.Spec.Selector,
			Template:             sts.Spec.Template,
			VolumeClaimTemplates: sts.Spec.VolumeClaimTemplates,
			ServiceName:          sts.Spec.ServiceName,
			PodManagementPolicy:  sts.Spec.PodManagementPolicy,
			UpdateStrategy: v1beta1.StatefulSetUpdateStrategy{
				Type: sts.Spec.UpdateStrategy.Type,
			},
			RevisionHistoryLimit: sts.Spec.RevisionHistoryLimit,
		}
		if sts.Spec.UpdateStrategy.RollingUpdate != nil {
			stsv1beta1.Spec.UpdateStrategy.RollingUpdate = &v1beta1.RollingUpdateStatefulSetStrategy{
				Partition:             sts.Spec.UpdateStrategy.RollingUpdate.Partition,
				MaxUnavailable:        sts.Spec.UpdateStrategy.RollingUpdate.MaxUnavailable,
				PodUpdatePolicy:       v1beta1.PodUpdateStrategyType(sts.Spec.UpdateStrategy.RollingUpdate.PodUpdatePolicy),
				Paused:                sts.Spec.UpdateStrategy.RollingUpdate.Paused,
				InPlaceUpdateStrategy: sts.Spec.UpdateStrategy.RollingUpdate.InPlaceUpdateStrategy,
				MinReadySeconds:       sts.Spec.UpdateStrategy.RollingUpdate.MinReadySeconds,
			}
			if sts.Spec.UpdateStrategy.RollingUpdate.UnorderedUpdate != nil {
				stsv1beta1.Spec.UpdateStrategy.RollingUpdate.UnorderedUpdate = &v1beta1.UnorderedUpdateStrategy{
					PriorityStrategy: sts.Spec.UpdateStrategy.RollingUpdate.UnorderedUpdate.PriorityStrategy,
				}
			}
		}

		// status
		stsv1beta1.Status = v1beta1.StatefulSetStatus{
			ObservedGeneration: sts.Status.ObservedGeneration,
			Replicas:           sts.Status.Replicas,
			ReadyReplicas:      sts.Status.ReadyReplicas,
			AvailableReplicas:  sts.Status.AvailableReplicas,
			CurrentReplicas:    sts.Status.CurrentReplicas,
			UpdatedReplicas:    sts.Status.UpdatedReplicas,
			CurrentRevision:    sts.Status.CurrentRevision,
			UpdateRevision:     sts.Status.UpdateRevision,
			CollisionCount:     sts.Status.CollisionCount,
			Conditions:         sts.Status.Conditions,
			LabelSelector:      sts.Status.LabelSelector,
		}

		return nil

	default:
		return fmt.Errorf("unsupported type %v", t)
	}
}

func (sts *StatefulSet) ConvertFrom(src conversion.Hub) error {
	switch t := src.(type) {
	case *v1beta1.StatefulSet:
		stsv1beta1 := src.(*v1beta1.StatefulSet)
		sts.ObjectMeta = stsv1beta1.ObjectMeta

		// spec
		sts.Spec = StatefulSetSpec{
			Replicas:             stsv1beta1.Spec.Replicas,
			Selector:             stsv1beta1.Spec.Selector,
			Template:             stsv1beta1.Spec.Template,
			VolumeClaimTemplates: stsv1beta1.Spec.VolumeClaimTemplates,
			ServiceName:          stsv1beta1.Spec.ServiceName,
			PodManagementPolicy:  stsv1beta1.Spec.PodManagementPolicy,
			UpdateStrategy: StatefulSetUpdateStrategy{
				Type: stsv1beta1.Spec.UpdateStrategy.Type,
			},
			RevisionHistoryLimit: stsv1beta1.Spec.RevisionHistoryLimit,
		}
		if stsv1beta1.Spec.UpdateStrategy.RollingUpdate != nil {
			sts.Spec.UpdateStrategy.RollingUpdate = &RollingUpdateStatefulSetStrategy{
				Partition:             stsv1beta1.Spec.UpdateStrategy.RollingUpdate.Partition,
				MaxUnavailable:        stsv1beta1.Spec.UpdateStrategy.RollingUpdate.MaxUnavailable,
				PodUpdatePolicy:       PodUpdateStrategyType(stsv1beta1.Spec.UpdateStrategy.RollingUpdate.PodUpdatePolicy),
				Paused:                stsv1beta1.Spec.UpdateStrategy.RollingUpdate.Paused,
				InPlaceUpdateStrategy: stsv1beta1.Spec.UpdateStrategy.RollingUpdate.InPlaceUpdateStrategy,
				MinReadySeconds:       stsv1beta1.Spec.UpdateStrategy.RollingUpdate.MinReadySeconds,
			}
			if stsv1beta1.Spec.UpdateStrategy.RollingUpdate.UnorderedUpdate != nil {
				sts.Spec.UpdateStrategy.RollingUpdate.UnorderedUpdate = &UnorderedUpdateStrategy{
					PriorityStrategy: stsv1beta1.Spec.UpdateStrategy.RollingUpdate.UnorderedUpdate.PriorityStrategy,
				}
			}
		}

		// status
		sts.Status = StatefulSetStatus{
			ObservedGeneration: stsv1beta1.Status.ObservedGeneration,
			Replicas:           stsv1beta1.Status.Replicas,
			ReadyReplicas:      stsv1beta1.Status.ReadyReplicas,
			AvailableReplicas:  stsv1beta1.Status.AvailableReplicas,
			CurrentReplicas:    stsv1beta1.Status.CurrentReplicas,
			UpdatedReplicas:    stsv1beta1.Status.UpdatedReplicas,
			CurrentRevision:    stsv1beta1.Status.CurrentRevision,
			UpdateRevision:     stsv1beta1.Status.UpdateRevision,
			CollisionCount:     stsv1beta1.Status.CollisionCount,
			Conditions:         stsv1beta1.Status.Conditions,
			LabelSelector:      stsv1beta1.Status.LabelSelector,
		}

		return nil
	default:
		return fmt.Errorf("unsupported type %v", t)
	}
}

```

### Core Architecture Module: `apis/apps/v1alpha1/statefulset_types.go`
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

package v1alpha1

import (
	apps "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	appspub "github.com/openkruise/kruise/apis/apps/pub"
)

const (
	// MaxMinReadySeconds is the max value of MinReadySeconds
	MaxMinReadySeconds = 300
)

// StatefulSetUpdateStrategy indicates the strategy that the StatefulSet
// controller will use to perform updates. It includes any additional parameters
// necessary to perform the update for the indicated strategy.
type StatefulSetUpdateStrategy struct {
	// Type indicates the type of the StatefulSetUpdateStrategy.
	// Default is RollingUpdate.
	// +optional
	Type apps.StatefulSetUpdateStrategyType `json:"type,omitempty"`
	// RollingUpdate is used to communicate parameters when Type is RollingUpdateStatefulSetStrategyType.
	// +optional
	RollingUpdate *RollingUpdateStatefulSetStrategy `json:"rollingUpdate,omitempty"`
}

// RollingUpdateStatefulSetStrategy is used to communicate parameter for RollingUpdateStatefulSetStrategyType.
type RollingUpdateStatefulSetStrategy struct {
	// Partition indicates the ordinal at which the StatefulSet should be partitioned by default.
	// But if unorderedUpdate has been set:
	//   - Partition indicates the number of pods with non-updated revisions when rolling update.
	//   - It means controller will update $(replicas - partition) number of pod.
	// Default value is 0.
	// +optional
	Partition *int32 `json:"partition,omitempty"`
	// The maximum number of pods that can be unavailable during the update.
	// Value can be an absolute number (ex: 5) or a percentage of desired pods (ex: 10%).
	// Absolute number is calculated from percentage by rounding down.
	// Also, maxUnavailable can just be allowed to work with Parallel podManagementPolicy.
	// Defaults to 1.
	// +optional
	MaxUnavailable *intstr.IntOrString `json:"maxUnavailable,omitempty"`
	// PodUpdatePolicy indicates how pods should be updated
	// Default value is "ReCreate"
	// +optional
	PodUpdatePolicy PodUpdateStrategyType `json:"podUpdatePolicy,omitempty"`
	// Paused indicates that the StatefulSet is paused.
	// Default value is false
	// +optional
	Paused bool `json:"paused,omitempty"`
	// UnorderedUpdate contains strategies for non-ordered update.
	// If it is not nil, pods will be updated with non-ordered sequence.
	// Noted that UnorderedUpdate can only be allowed to work with Parallel podManagementPolicy
	// +optional
	UnorderedUpdate *UnorderedUpdateStrategy `json:"unorderedUpdate,omitempty"`
	// InPlaceUpdateStrategy contains strategies for in-place update.
	// +optional
	InPlaceUpdateStrategy *appspub.InPlaceUpdateStrategy `json:"inPlaceUpdateStrategy,omitempty"`
	// MinReadySeconds indicates how long will the pod be considered ready after it's updated.
	// MinReadySeconds works with both OrderedReady and Parallel podManagementPolicy.
	// It affects the pod scale up speed when the podManagementPolicy is set to be OrderedReady.
	// Combined with MaxUnavailable, it affects the pod update speed regardless of podManagementPolicy.
	// Default value is 0, max is 300.
	// +optional
	MinReadySeconds *int32 `json:"minReadySeconds,omitempty"`
}

// UnorderedUpdateStrategy defines strategies for non-ordered update.
type UnorderedUpdateStrategy struct {
	// Priorities are the rules for calculating the priority of updating pods.
	// Each pod to be updated, will pass through these terms and get a sum of weights.
	// +optional
	PriorityStrategy *appspub.UpdatePriorityStrategy `json:"priorityStrategy,omitempty"`
}

// PodUpdateStrategyType is a string enumeration type that enumerates
// all possible ways we can update a Pod when updating application
type PodUpdateStrategyType string

const (
	// RecreatePodUpdateStrategyType indicates that we always delete Pod and create new Pod
	// during Pod update, which is the default behavior
	RecreatePodUpdateStrategyType PodUpdateStrategyType = "ReCreate"
	// InPlaceIfPossiblePodUpdateStrategyType indicates that we try to in-place update Pod instead of
	// recreating Pod when possible. Currently, only image update of pod spec is allowed. Any other changes to the pod
	// spec will fall back to ReCreate PodUpdateStrategyType where pod will be recreated.
	InPlaceIfPossiblePodUpdateStrategyType PodUpdateStrategyType = "InPlaceIfPossible"
	// InPlaceOnlyPodUpdateStrategyType indicates that we will in-place update Pod instead of
	// recreating pod. Currently we only allow image update for pod spec. Any other changes to the pod spec will be
	// rejected by kube-apiserver
	InPlaceOnlyPodUpdateStrategyType PodUpdateStrategyType = "InPlaceOnly"
)

// StatefulSetSpec defines the desired state of StatefulSet
type StatefulSetSpec struct {
	// replicas is the desired number of replicas of the given Template.
	// These are replicas in the sense that they are instantiations of the
	// same Template, but individual replicas also have a consistent identity.
	// If unspecified, defaults to 1.
	// TODO: Consider a rename of this field.
	// +optional
	Replicas *int32 `json:"replicas,omitempty"`

	// selector is a label query over pods that should match the replica count.
	// It must match the pod template's labels.
	// More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
	Selector *metav1.LabelSelector `json:"selector"`

	// template is the object that describes the pod that will be created if
	// insufficient replicas are detected. Each pod stamped out by the StatefulSet
	// will fulfill this Template, but have a unique identity from the rest
	// of the StatefulSet.
	// +kubebuilder:pruning:PreserveUnknownFields
	// +kubebuilder:validation:Schemaless
	Template v1.PodTemplateSpec `json:"template"`

	// volumeClaimTemplates is a list of claims that pods are allowed to reference.
	// The StatefulSet controller is responsible for mapping network identities to
	// claims in a way that maintains the identity of a pod. Every claim in
	// this list must have at least one matching (by name) volumeMount in one
	// container in the template. A claim in this list takes precedence over
	// any volumes in the template, with the same name.
	// TODO: Define the behavior if a claim already exists with the same name.
	// +optional
	// +kubebuilder:pruning:PreserveUnknownFields
	// +kubebuilder:validation:Schemaless
	VolumeClaimTemplates []v1.PersistentVolumeClaim `json:"volumeClaimTemplates,omitempty"`

	// serviceName is the name of the service that governs this StatefulSet.
	// This service must exist before the StatefulSet, and is responsible for
	// the network identity of the set. Pods get DNS/hostnames that follow the
	// pattern: pod-specific-string.serviceName.default.svc.cluster.local
	// where "pod-specific-string" is managed by the StatefulSet controller.
	ServiceName string `json:"serviceName,omitempty"`

	// podManagementPolicy controls how pods are created during initial scale up,
	// when replacing pods on nodes, or when scaling down. The default policy is
	// `OrderedReady`, where pods are created in increasing order (pod-0, then
	// pod-1, etc) and the controller will wait until each pod is ready before
	// continuing. When scaling down, the pods are removed in the opposite order.
	// The alternative policy is `Parallel` which will create pods in parallel
	// to match the desired scale without waiting, and on scale down will delete
	// all pods at once.
	// +optional
	PodManagementPolicy apps.PodManagementPolicyType `json:"podManagementPolicy,omitempty"`

	// updateStrategy indicates the StatefulSetUpdateStrategy that will be
	// employed to update Pods in the StatefulSet when a revision is made to
	// Template.
	UpdateStrategy StatefulSetUpdateStrategy `json:"updateStrategy,omitempty"`

	// revisionHistoryLimit is the maximum number of revisions that will
	// be maintained in the StatefulSet's revision history. The revision history
	// consists of all revisions not represented by a currently applied
	// StatefulSetSpec version. The default value is 10.
	RevisionHistoryLimit *int32 `json:"revisionHistoryLimit,omitempty"`
}

// StatefulSetStatus defines the observed state of StatefulSet
type StatefulSetStatus struct {
	// observedGeneration is the most recent generation observed for this StatefulSet. It corresponds to the
	// StatefulSet's generation, which is updated on mutation by the API Server.
	// +optional
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`

	// replicas is the number of Pods created by the StatefulSet controller.
	Replicas int32 `json:"replicas"`

	// readyReplicas is the number of Pods created by the StatefulSet controller that have a Ready Condition.
	ReadyReplicas int32 `json:"readyReplicas"`

	// AvailableReplicas is the number of Pods created by the StatefulSet controller that have been ready for
	//minReadySeconds.
	AvailableReplicas int32 `json:"availableReplicas"`

	// currentReplicas is the number of Pods created by the StatefulSet controller from the StatefulSet version
	// indicated by currentRevision.
	CurrentReplicas int32 `json:"currentReplicas"`

	// updatedReplicas is the number of Pods created by the StatefulSet controller from the StatefulSet version
	// indicated by updateRevision.
	UpdatedReplicas int32 `json:"updatedReplicas"`

	// currentRevision, if not empty, indicates the version of the StatefulSet used to generate Pods in the
	/
```

### Core Architecture Module: `apis/apps/v1beta1/persistent_pod_state_conversion.go`
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

package v1beta1

func (*PersistentPodState) Hub() {}

```

### Core Architecture Module: `apis/apps/v1beta1/persistent_pod_state_types.go`
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

package v1beta1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PersistentPodStateSpec defines the desired state of PersistentPodState
type PersistentPodStateSpec struct {
	// TargetReference contains enough information to let you identify a workload for PersistentPodState
	// Selector and TargetReference are mutually exclusive, TargetReference is priority to take effect
	// current only support StatefulSet
	TargetReference TargetReference `json:"targetRef"`

	// Persist the annotations information of the pods that need to be saved
	PersistentPodAnnotations []PersistentPodAnnotation `json:"persistentPodAnnotations,omitempty"`

	// Pod rebuilt topology required for node labels
	// for example kubernetes.io/hostname, failure-domain.beta.kubernetes.io/zone
	RequiredPersistentTopology *NodeTopologyTerm `json:"requiredPersistentTopology,omitempty"`

	// Pod rebuilt topology preferred for node labels, with xx weight
	// for example  kubernetes.io/hostname, failure-domain.beta.kubernetes.io/zone
	PreferredPersistentTopology []PreferredTopologyTerm `json:"preferredPersistentTopology,omitempty"`

	// PersistentPodStateRetentionPolicy describes the policy used for PodState.
	// The default policy of 'WhenScaled' causes when scale down statefulSet, deleting it.
	// +optional
	PersistentPodStateRetentionPolicy PersistentPodStateRetentionPolicyType `json:"persistentPodStateRetentionPolicy,omitempty"`
}

type PreferredTopologyTerm struct {
	// +kubebuilder:validation:Minimum=0
	Weight     int32            `json:"weight"`
	Preference NodeTopologyTerm `json:"preference"`
}

type NodeTopologyTerm struct {
	// A list of node label keys used for topology persistence.
	Keys []string `json:"keys"`
}

type PersistentPodAnnotation struct {
	Key string `json:"key"`
}

// +kubebuilder:validation:Enum=WhenScaled;WhenDeleted
type PersistentPodStateRetentionPolicyType string

const (
	PersistentPodStateRetentionPolicyWhenScaled  = "WhenScaled"
	PersistentPodStateRetentionPolicyWhenDeleted = "WhenDeleted"
)

type PersistentPodStateStatus struct {
	// observedGeneration is the most recent generation observed for this PersistentPodState. It corresponds to the
	// PersistentPodState's generation, which is updated on mutation by the API Server.
	ObservedGeneration int64 `json:"observedGeneration"`
	// When the pod is ready, record some status information of the pod, such as: labels, annotations, topologies, etc.
	// map[string]PodState -> map[Pod.Name]PodState
	PodStates map[string]PodState `json:"podStates,omitempty"`
}

type PodState struct {
	// pod.spec.nodeName
	NodeName string `json:"nodeName,omitempty"`
	// node topology labels key=value
	// for example kubernetes.io/hostname=node-1
	NodeTopologyLabels map[string]string `json:"nodeTopologyLabels,omitempty"`
	// pod persistent annotations
	Annotations map[string]string `json:"annotations,omitempty"`
}

// TargetReference contains enough information to let you identify a workload
type TargetReference struct {
	// API version of the referent.
	APIVersion string `json:"apiVersion"`
	// Kind of the referent.
	Kind string `json:"kind"`
	// Name of the referent.
	Name string `json:"name"`
}

// +genclient
// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:storageversion

// PersistentPodState is the Schema for the PersistentPodState API
type PersistentPodState struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   PersistentPodStateSpec   `json:"spec,omitempty"`
	Status PersistentPodStateStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// PersistentPodStateList contains a list of PersistentPodState
type PersistentPodStateList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []PersistentPodState `json:"items"`
}

func init() {
	SchemeBuilder.Register(&PersistentPodState{}, &PersistentPodStateList{})
}

```

### Core Architecture Module: `apis/apps/v1beta1/statefulset_conversion.go`
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

package v1beta1

func (*StatefulSet) Hub() {}

```

### Core Architecture Module: `apis/apps/v1beta1/statefulset_types.go`
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

package v1beta1

import (
	apps "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	appspub "github.com/openkruise/kruise/apis/apps/pub"
)

const (
	// MaxMinReadySeconds is the max value of MinReadySeconds
	MaxMinReadySeconds = 300
)

// VolumeClaimUpdateStrategyType defines the update strategy types for volume claims.
// It is an enumerated type that provides two different update strategies.
// +enum
type VolumeClaimUpdateStrategyType string

const (
	// OnPodRollingUpdateVolumeClaimUpdateStrategyType indicates that volume claim updates are triggered when associated Pods undergo rolling updates.
	// This strategy ensures that storage availability and integrity are maintained during the update process.
	OnPodRollingUpdateVolumeClaimUpdateStrategyType VolumeClaimUpdateStrategyType = "OnPodRollingUpdate"

	// OnPVCDeleteVolumeClaimUpdateStrategyType indicates that updates are triggered when a Persistent Volume Claim (PVC) is deleted.
	// This strategy places full control of the update timing in the hands of the user, typically executed after ensuring data has been backed up or there are no data security concerns,
	// allowing for storage resource management that aligns with specific user requirements and security policies.
	OnPVCDeleteVolumeClaimUpdateStrategyType VolumeClaimUpdateStrategyType = "OnDelete"
)

// VolumeClaimStatus describes the status of a volume claim template.
// It provides details about the compatibility and readiness of the volume claim.
type VolumeClaimStatus struct {
	// VolumeClaimName is the name of the volume claim.
	// This is a unique identifier used to reference a specific volume claim.
	VolumeClaimName string `json:"volumeClaimName"`
	// CompatibleReplicas is the number of replicas currently compatible with the volume claim.
	// It indicates how many replicas can function properly, being compatible with this volume claim.
	// Compatibility is determined by whether the PVC spec storage requests are greater than or equal to the template spec storage requests
	CompatibleReplicas int32 `json:"compatibleReplicas"`
	// CompatibleReadyReplicas is the number of replicas that are both ready and compatible with the volume claim.
	// It highlights that these replicas are not only compatible but also ready to be put into service immediately.
	// Compatibility is determined by whether the pvc spec storage requests are greater than or equal to the template spec storage requests
	// The "ready" status is determined by whether the PVC status capacity is greater than or equal to the PVC spec storage requests.
	CompatibleReadyReplicas int32 `json:"compatibleReadyReplicas"`
}

// StatefulSetUpdateStrategy indicates the strategy that the StatefulSet
// controller will use to perform updates. It includes any additional parameters
// necessary to perform the update for the indicated strategy.
type StatefulSetUpdateStrategy struct {
	// Type indicates the type of the StatefulSetUpdateStrategy.
	// Default is RollingUpdate.
	// +optional
	Type apps.StatefulSetUpdateStrategyType `json:"type,omitempty"`
	// RollingUpdate is used to communicate parameters when Type is RollingUpdateStatefulSetStrategyType.
	// +optional
	RollingUpdate *RollingUpdateStatefulSetStrategy `json:"rollingUpdate,omitempty"`
}

// VolumeClaimUpdateStrategy defines the strategy for updating volume claims.
// This structure is used to control how updates to PersistentVolumeClaims are handled during pod rolling updates or PersistentVolumeClaim deletions.
type VolumeClaimUpdateStrategy struct {
	// Type specifies the type of update strategy, possible values include:
	// OnPodRollingUpdateVolumeClaimUpdateStrategyType: Apply the update strategy during pod rolling updates.
	// OnPVCDeleteVolumeClaimUpdateStrategyType: Apply the update strategy when a PersistentVolumeClaim is deleted.
	Type VolumeClaimUpdateStrategyType `json:"type,omitempty"`
}

// RollingUpdateStatefulSetStrategy is used to communicate parameter for RollingUpdateStatefulSetStrategyType.
type RollingUpdateStatefulSetStrategy struct {
	// Partition indicates the number of pods the StatefulSet should be partitioned by default.
	//   - It means controller will update $(replicas - partition) number of pod.
	// Default value is 0.
	// +optional
	Partition *int32 `json:"partition,omitempty"`
	// The maximum number of pods that can be unavailable during the update.
	// Value can be an absolute number (ex: 5) or a percentage of desired pods (ex: 10%).
	// Absolute number is calculated from percentage by rounding down.
	// Also, maxUnavailable can just be allowed to work with Parallel podManagementPolicy.
	// Defaults to 1.
	// +optional
	MaxUnavailable *intstr.IntOrString `json:"maxUnavailable,omitempty"`
	// PodUpdatePolicy indicates how pods should be updated
	// Default value is "ReCreate"
	// +optional
	PodUpdatePolicy PodUpdateStrategyType `json:"podUpdatePolicy,omitempty"`
	// Paused indicates that the StatefulSet is paused.
	// Default value is false
	// +optional
	Paused bool `json:"paused,omitempty"`
	// UnorderedUpdate contains strategies for non-ordered update.
	// If it is not nil, pods will be updated with non-ordered sequence.
	// Noted that UnorderedUpdate can only be allowed to work with Parallel podManagementPolicy
	// +optional
	UnorderedUpdate *UnorderedUpdateStrategy `json:"unorderedUpdate,omitempty"`
	// InPlaceUpdateStrategy contains strategies for in-place update.
	// +optional
	InPlaceUpdateStrategy *appspub.InPlaceUpdateStrategy `json:"inPlaceUpdateStrategy,omitempty"`
	// MinReadySeconds indicates how long will the pod be considered ready after it's updated.
	// MinReadySeconds works with both OrderedReady and Parallel podManagementPolicy.
	// It affects the pod scale up speed when the podManagementPolicy is set to be OrderedReady.
	// Combined with MaxUnavailable, it affects the pod update speed regardless of podManagementPolicy.
	// Default value is 0, max is 300.
	// +optional
	MinReadySeconds *int32 `json:"minReadySeconds,omitempty"`
}

// UnorderedUpdateStrategy defines strategies for non-ordered update.
type UnorderedUpdateStrategy struct {
	// Priorities are the rules for calculating the priority of updating pods.
	// Each pod to be updated, will pass through these terms and get a sum of weights.
	// +optional
	PriorityStrategy *appspub.UpdatePriorityStrategy `json:"priorityStrategy,omitempty"`
}

// PodUpdateStrategyType is a string enumeration type that enumerates
// all possible ways we can update a Pod when updating application
type PodUpdateStrategyType string

const (
	// RecreatePodUpdateStrategyType indicates that we always delete Pod and create new Pod
	// during Pod update, which is the default behavior
	RecreatePodUpdateStrategyType PodUpdateStrategyType = "ReCreate"
	// InPlaceIfPossiblePodUpdateStrategyType indicates that we try to in-place update Pod instead of
	// recreating Pod when possible. Currently, only image update of pod spec is allowed. Any other changes to the pod
	// spec will fall back to ReCreate PodUpdateStrategyType where pod will be recreated.
	InPlaceIfPossiblePodUpdateStrategyType PodUpdateStrategyType = "InPlaceIfPossible"
	// InPlaceOnlyPodUpdateStrategyType indicates that we will in-place update Pod instead of
	// recreating pod. Currently we only allow image update for pod spec. Any other changes to the pod spec will be
	// rejected by kube-apiserver
	InPlaceOnlyPodUpdateStrategyType PodUpdateStrategyType = "InPlaceOnly"
)

// PersistentVolumeClaimRetentionPolicyType is a string enumeration of the policies that will determine
// when volumes from the VolumeClaimTemplates will be deleted when the controlling StatefulSet is
// deleted or scaled down.
type PersistentVolumeClaimRetentionPolicyType string

const (
	// RetainPersistentVolumeClaimRetentionPolicyType is the default
	// PersistentVolumeClaimRetentionPolicy and specifies that
	// PersistentVolumeClaims associated with StatefulSet VolumeClaimTemplates
	// will not be deleted.
	RetainPersistentVolumeClaimRetentionPolicyType PersistentVolumeClaimRetentionPolicyType = "Retain"
	// DeletePersistentVolumeClaimRetentionPolicyType specifies that
	// PersistentVolumeClaims associated with StatefulSet VolumeClaimTemplates
	// will be deleted in the scenario specified in
	// StatefulSetPersistentVolumeClaimPolicy.
	DeletePersistentVolumeClaimRetentionPolicyType PersistentVolumeClaimRetentionPolicyType = "Delete"
)

// StatefulSetPersistentVolumeClaimRetentionPolicy describes the policy used for PVCs
// created from the StatefulSet VolumeClaims.
type StatefulSetPersistentVolumeClaimRetentionPolicy struct {
	// WhenDeleted specifies what happens to PVCs created from StatefulSet
	// VolumeClaimTemplates when the StatefulSet is deleted. The default policy
	// of `Retain` causes PVCs to not be affected by StatefulSet deletion. The
	// `Delete` policy causes those PVCs to be deleted.
	WhenDeleted PersistentVolumeClaimRetentionPolicyType `json:"whenDeleted,omitempty"`
	// WhenScaled specifies what happens to PVCs created from StatefulSet
	// VolumeClaimTemplates when the StatefulSet is scaled down. The default
	// policy of `Retain` causes PVCs to not be affected by a scaledown. The
	// `Delete` policy causes the associated PVCs for any excess pods above
	// the replica count to be deleted.
	WhenScaled PersistentVolumeClaimRetentionPol
```

### Core Architecture Module: `cmd/helm_hook/main.go`
```
/*
Copyright 2024 The Kruise Authors.

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
	"context"
	"log"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	kruiseclientset "github.com/openkruise/kruise/pkg/client/clientset/versioned"
)

func main() {
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err)
	}
	kc, err := kruiseclientset.NewForConfig(config)
	if err != nil {
		panic(err)
	}
	cloneSets, err := kc.AppsV1alpha1().CloneSets("").List(context.Background(), metav1.ListOptions{Limit: 1})
	if err != nil {
		panic(err)
	}
	if len(cloneSets.Items) > 0 || cloneSets.Continue != "" {
		log.Fatalln("there still exists some clonesets in the cluster")
	}
	statefulSets, err := kc.AppsV1alpha1().StatefulSets("").List(context.Background(), metav1.ListOptions{Limit: 1})
	if err != nil {
		panic(err)
	}
	if len(statefulSets.Items) > 0 || statefulSets.Continue != "" {
		log.Fatalln("there still exists some advanced statefulsets in the cluster")
	}
	statefulSetsBeta1, err := kc.AppsV1beta1().StatefulSets("").List(context.Background(), metav1.ListOptions{Limit: 1})
	if err != nil {
		panic(err)
	}
	if len(statefulSetsBeta1.Items) > 0 || statefulSetsBeta1.Continue != "" {
		log.Fatalln("there still exists some advanced statefulsets in the cluster")
	}
	daemonSets, err := kc.AppsV1alpha1().DaemonSets("").List(context.Background(), metav1.ListOptions{Limit: 1})
	if err != nil {
		panic(err)
	}
	if len(daemonSets.Items) > 0 || daemonSets.Continue != "" {
		log.Fatalln("there still exists some advanced daemonsets in the cluster")
	}
	log.Println("cluster is clean, ready to delete kruise")
}

```

### Core Architecture Module: `pkg/client/clientset/versioned/typed/apps/v1alpha1/fake/fake_persistentpodstate.go`
```
/*
Copyright 2025 The Kruise Authors.

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
// Code generated by client-gen. DO NOT EDIT.

package fake

import (
	v1alpha1 "github.com/openkruise/kruise/apis/apps/v1alpha1"
	appsv1alpha1 "github.com/openkruise/kruise/pkg/client/clientset/versioned/typed/apps/v1alpha1"
	gentype "k8s.io/client-go/gentype"
)

// fakePersistentPodStates implements PersistentPodStateInterface
type fakePersistentPodStates struct {
	*gentype.FakeClientWithList[*v1alpha1.PersistentPodState, *v1alpha1.PersistentPodStateList]
	Fake *FakeAppsV1alpha1
}

func newFakePersistentPodStates(fake *FakeAppsV1alpha1, namespace string) appsv1alpha1.PersistentPodStateInterface {
	return &fakePersistentPodStates{
		gentype.NewFakeClientWithList[*v1alpha1.PersistentPodState, *v1alpha1.PersistentPodStateList](
			fake.Fake,
			namespace,
			v1alpha1.SchemeGroupVersion.WithResource("persistentpodstates"),
			v1alpha1.SchemeGroupVersion.WithKind("PersistentPodState"),
			func() *v1alpha1.PersistentPodState { return &v1alpha1.PersistentPodState{} },
			func() *v1alpha1.PersistentPodStateList { return &v1alpha1.PersistentPodStateList{} },
			func(dst, src *v1alpha1.PersistentPodStateList) { dst.ListMeta = src.ListMeta },
			func(list *v1alpha1.PersistentPodStateList) []*v1alpha1.PersistentPodState {
				return gentype.ToPointerSlice(list.Items)
			},
			func(list *v1alpha1.PersistentPodStateList, items []*v1alpha1.PersistentPodState) {
				list.Items = gentype.FromPointerSlice(items)
			},
		),
		fake,
	}
}

```

### Core Architecture Module: `pkg/client/clientset/versioned/typed/apps/v1alpha1/fake/fake_statefulset.go`
```
/*
Copyright 2025 The Kruise Authors.

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
// Code generated by client-gen. DO NOT EDIT.

package fake

import (
	context "context"

	v1alpha1 "github.com/openkruise/kruise/apis/apps/v1alpha1"
	appsv1alpha1 "github.com/openkruise/kruise/pkg/client/clientset/versioned/typed/apps/v1alpha1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	gentype "k8s.io/client-go/gentype"
	testing "k8s.io/client-go/testing"
)

// fakeStatefulSets implements StatefulSetInterface
type fakeStatefulSets struct {
	*gentype.FakeClientWithList[*v1alpha1.StatefulSet, *v1alpha1.StatefulSetList]
	Fake *FakeAppsV1alpha1
}

func newFakeStatefulSets(fake *FakeAppsV1alpha1, namespace string) appsv1alpha1.StatefulSetInterface {
	return &fakeStatefulSets{
		gentype.NewFakeClientWithList[*v1alpha1.StatefulSet, *v1alpha1.StatefulSetList](
			fake.Fake,
			namespace,
			v1alpha1.SchemeGroupVersion.WithResource("statefulsets"),
			v1alpha1.SchemeGroupVersion.WithKind("StatefulSet"),
			func() *v1alpha1.StatefulSet { return &v1alpha1.StatefulSet{} },
			func() *v1alpha1.StatefulSetList { return &v1alpha1.StatefulSetList{} },
			func(dst, src *v1alpha1.StatefulSetList) { dst.ListMeta = src.ListMeta },
			func(list *v1alpha1.StatefulSetList) []*v1alpha1.StatefulSet {
				return gentype.ToPointerSlice(list.Items)
			},
			func(list *v1alpha1.StatefulSetList, items []*v1alpha1.StatefulSet) {
				list.Items = gentype.FromPointerSlice(items)
			},
		),
		fake,
	}
}

// GetScale takes name of the statefulSet, and returns the corresponding scale object, and an error if there is any.
func (c *fakeStatefulSets) GetScale(ctx context.Context, statefulSetName string, options v1.GetOptions) (result *autoscalingv1.Scale, err error) {
	emptyResult := &autoscalingv1.Scale{}
	obj, err := c.Fake.
		Invokes(testing.NewGetSubresourceActionWithOptions(c.Resource(), c.Namespace(), "scale", statefulSetName, options), emptyResult)

	if obj == nil {
		return emptyResult, err
	}
	return obj.(*autoscalingv1.Scale), err
}

// UpdateScale takes the representation of a scale and updates it. Returns the server's representation of the scale, and an error, if there is any.
func (c *fakeStatefulSets) UpdateScale(ctx context.Context, statefulSetName string, scale *autoscalingv1.Scale, opts v1.UpdateOptions) (result *autoscalingv1.Scale, err error) {
	emptyResult := &autoscalingv1.Scale{}
	obj, err := c.Fake.
		Invokes(testing.NewUpdateSubresourceActionWithOptions(c.Resource(), "scale", c.Namespace(), scale, opts), &autoscalingv1.Scale{})

	if obj == nil {
		return emptyResult, err
	}
	return obj.(*autoscalingv1.Scale), err
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2587** (2026-10-02): **[BUG] ResourceDistribution calculateNewStatus panics or misidentifies conditions when Status.Conditions is reordered or partially populated**
  *Symptoms*: ### What happened: In `pkg/controller/resourcedistribution/utils.go`, `calculateNewStatus` updates the status conditions of a `ResourceDistribution` by iterating over `NumberOfConditionTypes` (6) and performing positional index lookup into `distributor.Status.Conditions`:  ```go 	oldConditions := distributor.Status.Conditions 	for i := 0; i < NumberOfConditionTypes; i++ { 		... 		if len(oldConditions) == 0 || oldConditions[i].Status != newConditions[i].Status { 			newConditions[i].LastTransitionTime = metav1.Time{Time: time.Now()} 		} else { 			newConditions[i].LastTransitionTime = oldConditions[i].LastTransitionTime 		} 	} ```  This causes two issues: 1. **Panic (index out of range)**: If `oldConditions` is partially populated (`0 < len(oldConditions) < NumberOfConditionTypes`, e.g., 1 to 5 conditions present), accessing `oldConditions[i]` causes a runtime panic `runtime error: index out of range [i]` when `i >= len(oldConditions)`. 2. **Incorrect condition matching and transition time**: Kubernetes status conditions are slices without a guaranteed fixed order. If `oldConditions` has condition types in a different order, positional indexing compares the status of one condition type against a completely different condition type and copies `LastTransitionTime` from the wrong condition.  ### What you expected to happen: `calculateNewStatus` should look up existing conditions by `condition.Type` (standard Kubernetes condition handling pattern), avoiding index out of range panics
  **Post-Mortem & Fix Analysis**:
  > Closing as duplicate of #2586.

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

Signed-off-by: PersistentJZH <[REDACTED_EMAIL]>

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

Signed-off-by: vishal <[REDACTED_EMAIL]>

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

Signed-off-by: Jayant <[REDACTED_EMAIL]>

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

Signed-off-by: Colvin-Y <[REDACTED_EMAIL]>

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

Signed-off-by: Colvin-Y <[REDACTED_EMAIL]>

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
+			if got := ShouldUpdateResourceByResize(); got != tc.want {
+				t.Errorf("ShouldUpdateResourceByResize() for GitVersion=%q = %v, want %v",
+					tc.version.GitVersion, got, tc.want)
+			}
+		})
+	}
+}
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
+					t.Errorf("expected revision 3, got %d", updateRev.Revision)
+				}
+			},
+		},
+		{
+			name:        "equal revision is the last (immediately prior)",
+			getCloneSet: newCloneSetWithVCT,
+			getRevisions: func() []*appsv1.ControllerRevision {
+				return []*appsv1.ControllerRevision{
+					{
+						ObjectMeta: metav1.ObjectMeta{
+							Name:      "test-cs-diff-1",
+							Namespace: "default",
+						},
+						Revision: 1,
+						Data:     runtime.RawExtension{Raw: differentDataRaw},
+					},
+					{
+						ObjectMeta: metav1.ObjectMeta{
+							Name:        "test-cs-equal-2",
+							Namespace:   "default",
+							Annotations: map[string]string{volumeclaimtemplate.HashAnnotation: expectedVCTHash},
+						},
+						Revision: 2,
+						Data:     runtime.RawExtension{Raw: equalDataRaw},
+					},
+				}
+			},
+			expectErr: false,
+			validate: func(t *testing.T, currentRev, updateRev *appsv1.ControllerRevision, collisionCount int32) {
+				if updateRev == nil {
+					t.Fatal("expected non-nil updateRevision")
+			
```

---

### Incident Patch 10: `7ac04141` (2026-06-18)
**Commit Message**: fix(e2e): use Eventually for WorkloadSpread status check after scale down

Signed-off-by: liheng <[REDACTED_EMAIL]>

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

---

### Incident Patch 11: `9a8addc9` (2026-06-18)
**Commit Message**: fix(resourcedistribution): use unstructured watch to match cache read path

controller-runtime maintains separate informer caches for Structured
(typed) and Unstructured objects. The controller reads owned resources
(Secret/ConfigMap) via unstructured.Unstructured, which hits the
Unstructured cache. However, the watch was set up with typed objects
(&corev1.Secret{}/&corev1.ConfigMap{}), which uses the Structured cache.

When a Secret is modified externally, the typed informer fires the
event handler before the unstructured informer processes the same
event. The controller then reads the stale (pre-update) version from
the unstructured cache, finds needToUpdate=false, and exits without
reverting. With no resync period configured, the missed update is
never recovered.

Switch the watch objects back to unstructured (matching the original
v1alpha1 implementation) so that both watch events and cache reads
use the same Unstructured informer, eliminating the race window.

Signed-off-by: liheng <[REDACTED_EMAIL]>

**File**: `pkg/controller/resourcedistribution/resourcedistribution_controller.go` (modified, +5/-4)
```diff
@@ -374,8 +374,9 @@ func (r *ReconcileResourceDistribution) SetupWithManager(mgr ctrl.Manager) error
 }
 
 func supportedResourceWatchObjects() []client.Object {
-	return []client.Object{
-		&corev1.Secret{},
-		&corev1.ConfigMap{},
-	}
+	secret := &unstructured.Unstructured{}
+	secret.SetGroupVersionKind(corev1.SchemeGroupVersion.WithKind("Secret"))
+	configMap := &unstructured.Unstructured{}
+	configMap.SetGroupVersionKind(corev1.SchemeGroupVersion.WithKind("ConfigMap"))
+	return []client.Object{secret, configMap}
 }
```

---

### Incident Patch 12: `f2a2e955` (2026-06-17)
**Commit Message**: fix: use Data instead of StringData in ResourceDistribution E2E revert check

StringData is a write-only field in Kubernetes Secret API — it is always
empty when read back. The previous check `len(secret.StringData) != 0`
always passed immediately, causing a race between the test's delete and
the controller's reconcile. Check `len(secret.Data) != 1` instead to
wait for the controller to actually revert the Secret before proceeding.

Signed-off-by: liheng <[REDACTED_EMAIL]>

**File**: `test/e2e/apps/v1alpha1/resourcedistribution.go` (modified, +2/-2)
```diff
@@ -161,8 +161,8 @@ var _ = ginkgo.Describe("ResourceDistribution", ginkgo.Serial, ginkgo.Label("Res
 				if err != nil {
 					return err
 				}
-				if len(secret.StringData) != 0 {
-					return fmt.Errorf("secret not yet reverted")
+				if len(secret.Data) != 1 {
+					return fmt.Errorf("secret not yet reverted, data keys: %d", len(secret.Data))
 				}
 				return nil
 			}, 3*time.Minute, time.Second).Should(gomega.BeNil())
```

**File**: `test/e2e/apps/v1beta1/resourcedistribution.go` (modified, +2/-2)
```diff
@@ -151,8 +151,8 @@ var _ = ginkgo.Describe("ResourceDistribution", ginkgo.Serial, ginkgo.Label("Res
 				if err != nil {
 					return err
 				}
-				if len(secret.StringData) != 0 {
-					return fmt.Errorf("secret not yet reverted")
+				if len(secret.Data) != 1 {
+					return fmt.Errorf("secret not yet reverted, data keys: %d", len(secret.Data))
 				}
 				return nil
 			}, 3*time.Minute, time.Second).Should(gomega.BeNil())
```

---

### Incident Patch 13: `d42041d6` (2026-06-17)
**Commit Message**: fix(crr): remove StartedAt false-positive in container restart detection

The StartedAt.After(crr.CreationTimestamp) check in
getCurrentCRRContainersRecreateStates can falsely detect a container as
restarted when the CRR is created shortly after the pod becomes Ready.
This causes orderedRecreate to skip the kill step for affected
containers, leaving IsKilled=false. Container ID and RestartCount
checks already cover all legitimate restart scenarios.

Signed-off-by: liheng <[REDACTED_EMAIL]>

**File**: `pkg/daemon/containerrecreate/crr_daemon_util.go` (modified, +1/-2)
```diff
@@ -108,8 +108,7 @@ func getCurrentCRRContainersRecreateStates(
 				Phase: appsv1beta1.ContainerRecreateRequestPending,
 			}
 		} else if c.StatusContext != nil && (kubeContainerStatus.ID.String() != c.StatusContext.ContainerID ||
-			kubeContainerStatus.RestartCount > int(c.StatusContext.RestartCount) ||
-			kubeContainerStatus.StartedAt.After(crr.CreationTimestamp.Time)) {
+			kubeContainerStatus.RestartCount > int(c.StatusContext.RestartCount)) {
 			// already recreated or restarted
 			currentState = appsv1beta1.ContainerRecreateRequestContainerRecreateState{
 				Name:     c.Name,
```

---

### Incident Patch 14: `9dc51a1f` (2026-06-17)
**Commit Message**: fix: use Eventually for CloneSet progressing condition checks in E2E

Signed-off-by: liheng <[REDACTED_EMAIL]>

**File**: `test/e2e/apps/v1alpha1/cloneset.go` (modified, +21/-19)
```diff
@@ -489,7 +489,6 @@ var _ = ginkgo.Describe("CloneSet", ginkgo.Label("CloneSet", "workload"), func()
 				gomega.Expect(err).NotTo(gomega.HaveOccurred())
 				return condition
 			}, 120*time.Second, 3*time.Second).Should(gomega.Equal(tester.NewCloneSetAvailableCondition()))
-			condition, err := tester.GetCloneSetProgressingConditionWithoutTime(cs.Name)
 
 			oldPods, err := tester.ListPodsForCloneSet(cs.Name)
 			gomega.Expect(err).NotTo(gomega.HaveOccurred())
@@ -515,18 +514,19 @@ var _ = ginkgo.Describe("CloneSet", ginkgo.Label("CloneSet", "workload"), func()
 				return cs.Status.Replicas
 			}, 5*time.Second, time.Second).Should(gomega.Equal(int32(3)))
 
-			ginkgo.By("Check cloneSet progressing condition with origin available reason")
-			waitPreDeleteProgressingCondition, err := tester.GetCloneSetProgressingConditionWithoutTime(cs.Name)
-			gomega.Expect(err).NotTo(gomega.HaveOccurred())
-			condition = &appsv1alpha1.CloneSetCondition{
+			ginkgo.By("Check cloneSet progressing condition with updated reason")
+			gomega.Eventually(func() *appsv1alpha1.CloneSetCondition {
+				condition, err := tester.GetCloneSetProgressingConditionWithoutTime(cs.Name)
+				gomega.Expect(err).NotTo(gomega.HaveOccurred())
+				return condition
+			}, 30*time.Second, 3*time.Second).Should(gomega.Equal(&appsv1alpha1.CloneSetCondition{
 				Type:               appsv1alpha1.CloneSetConditionTypeProgressing,
 				Status:             v1.ConditionTrue,
 				LastUpdateTime:     metav1.Time{},
 				LastTransitionTime: metav1.Time{},
 				Reason:             string(appsv1alpha1.CloneSetProgressUpdated),
 				Message:            "CloneSet is progressing",
-			}
-			gomega.Expect(waitPreDeleteProgressingCondition).To(gomega.Equal(condition))
+			}))
 
 			newPods, err := tester.ListPodsForCloneSet(cs.Name)
 			gomega.Expect(err).NotTo(gomega.HaveOccurred())
@@ -561,18 +561,19 @@ var _ = ginkgo.Describe("CloneSet", ginkgo.Label("CloneSet", "workload"), func()
 			keepOldPods := util.GetPodNames(newPods).Intersection(util.GetPodNames(oldPods)).List()
 			gomega.Expect(keepOldPods).To(gomega.HaveLen(2))
 
-			ginkgo.By("Check cloneSet progressing condition with origin available reason")
-			finalProgressingCondition, err := tester.GetCloneSetProgressingConditionWithoutTime(cs.Name)
-			gomega.Expect(err).NotTo(gomega.HaveOccurred())
-			condition = &appsv1alpha1.CloneSetCondition{
+			ginkgo.By("Check cloneSet progressing condition with available reason")
+			gomega.Eventually(func() *appsv1alpha1.CloneSetCondition {
+				condition, err := tester.GetCloneSetProgressingConditionWithoutTime(cs.Name)
+				gomega.Expect(err).NotTo(gomega.HaveOccurred())
+				return condition
+			}, 30*time.Second, 3*time.Second).Should(gomega.Equal(&appsv1alpha1.CloneSetCondition{
 				Type:               appsv1alpha1.CloneSetConditionTypeProgressing,
 				Status:             v1.ConditionTrue,
 				LastUpdateTime:     metav1.Time{},
 				LastTransitionTime: metav1.Time{},
 				Reason:             string(appsv1alpha1.CloneSetAvailable),
 				Message:            "CloneSet is available",
-			}
-			gomega.Expect(finalProgressingCondition).To(gomega.Equal(condition))
+			}))
 		})
 
 		ginkgo.It("specific scale down with lifecycle and then scale up, when scalingExcludePreparingDelete is enabled", func() {
@@ -693,18 +694,19 @@ var _ = ginkgo.Describe("CloneSet", ginkgo.Label("CloneSet", "workload"), func()
 			keepOldPods := util.GetPodNames(newPods).Intersection(util.GetPodNames(oldPods)).List()
 			gomega.Expect(keepOldPods).To(gomega.HaveLen(2))
 
-			ginkgo.By("Check cloneSet progressing condition with origin available reason")
-			finalProgressingCondition, err := tester.GetCloneSetProgressingConditionWithoutTime(cs.Name)
-			gomega.Expect(err).NotTo(gomega.HaveOccurred())
-			condition = &appsv1alpha1.CloneSetCondition{
+			ginkgo.By("Check cloneSet progressing condition with available reason")
+			gomega.Eventually(func() *appsv1alpha1.CloneSetCondition {
+				condition, err := tester.GetCloneSetProgressingConditionWithoutTime(cs.Name)
+				gomega.Expect(err).NotTo(gomega.HaveOccurred())
+				return condition
+			}, 30*time.Second, 3*time.Second).Should(gomega.Equal(&appsv1alpha1.CloneSetCondition{
 				Type:               appsv1alpha1.CloneSetConditionTypeProgressing,
 				Status:             v1.ConditionTrue,
 				LastUpdateTime:     metav1.Time{},
 				LastTransitionTime: metav1.Time{},
 				Reason:             string(appsv1alpha1.CloneSetAvailable),
 				Message:            "CloneSet is available",
-			}
-			gomega.Expect(finalProgressingCondition).To(gomega.Equal(condition))
+			}))
 		})
 	})
 
```

---

### Incident Patch 15: `338eb53e` (2026-06-17)
**Commit Message**: fix: resolve ImagePullJob high CPU caused by cascading reconcile amplification

When multiple ImagePullJobs target different tags of the same image,
a single tag TTL expiry triggers reconciliation of ALL sibling jobs,
causing ~887 reconcile/s and 94.6% CPU in large clusters.

1. syncJobPullSecrets: early return when job has no pullSecrets
2. syncNodeImages: fix pullSecrets never persisted when tag+owner exists
3. handleUpdate: tag-level change detection instead of image-name level,
   reducing reconcile rate by ~99.5%

Signed-off-by: liheng <[REDACTED_EMAIL]>

**File**: `pkg/controller/imagepulljob/imagepulljob_controller.go` (modified, +28/-8)
```diff
@@ -296,6 +296,10 @@ func (r *ReconcileImagePullJob) Reconcile(_ context.Context, request reconcile.R
 // so it is necessary to synchronize the pullsecrets of imagepulljob to the kruise-daemon-config namespace
 // to facilitate kruise-daemon to fetch them.
 func (r *ReconcileImagePullJob) syncJobPullSecrets(job *appsv1beta1.ImagePullJob) ([]appsv1beta1.ReferenceObject, error) {
+	if len(job.Spec.PullSecrets) == 0 && job.DeletionTimestamp.IsZero() && job.Status.CompletionTime == nil {
+		return nil, nil
+	}
+
 	var secretRefs []appsv1beta1.ReferenceObject
 	// If it's in kruise-daemon-config namespace, no need to go through the sync logic, return directly
 	if job.Namespace == util.GetKruiseDaemonConfigNamespace() {
@@ -355,21 +359,28 @@ func (r *ReconcileImagePullJob) syncNodeImages(job *appsv1beta1.ImagePullJob, ne
 			imageSpec := nodeImage.Spec.Images[imageName]
 			imageSpec.SandboxConfig = job.Spec.SandboxConfig
 
-			for _, secret := range secrets {
-				if !containsObject(imageSpec.PullSecrets, secret) {
-					imageSpec.PullSecrets = append(imageSpec.PullSecrets, secret)
-				}
-			}
-
 			var found bool
+			var secretsSynced bool
 			for i := range imageSpec.Tags {
 				tagSpec := &imageSpec.Tags[i]
 				if tagSpec.Tag != imageTag {
 					continue
 				}
 				if util.ContainsObjectRef(tagSpec.OwnerReferences, *ownerRef) {
-					skip = true
-					return nil
+					needUpdate := false
+					for _, secret := range secrets {
+						if !containsObject(imageSpec.PullSecrets, secret) {
+							imageSpec.PullSecrets = append(imageSpec.PullSecrets, secret)
+							needUpdate = true
+						}
+					}
+					if !needUpdate {
+						skip = true
+						return nil
+					}
+					secretsSynced = true
+					found = true
+					break
 				}
 				// increase version to start a new round of image downloads
 				tagSpec.Version++
@@ -380,6 +391,15 @@ func (r *ReconcileImagePullJob) syncNodeImages(job *appsv1beta1.ImagePullJob, ne
 				found = true
 				break
 			}
+
+			if !secretsSynced {
+				for _, secret := range secrets {
+					if !containsObject(imageSpec.PullSecrets, secret) {
+						imageSpec.PullSecrets = append(imageSpec.PullSecrets, secret)
+					}
+				}
+			}
+
 			if !found {
 				var foundVersion int64 = -1
 				if imageStatus, ok := nodeImage.Status.ImageStatuses[imageName]; ok {
```

**File**: `pkg/controller/imagepulljob/imagepulljob_controller_test.go` (modified, +380/-0)
```diff
@@ -11,6 +11,7 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/apimachinery/pkg/util/intstr"
 	"k8s.io/apimachinery/pkg/util/sets"
 	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
 	k8stesting "k8s.io/utils/clock/testing"
@@ -2281,6 +2282,385 @@ func TestSyncJobPullSecrets_NoPullSecrets(t *testing.T) {
 	assert.Nil(t, result)
 }
 
+func TestSyncJobPullSecrets_EarlyReturn(t *testing.T) {
+	kruiseDaemonConfigNs := util.GetKruiseDaemonConfigNamespace()
+	now := metav1.Now()
+
+	syncedSecret := &v1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "synced-secret-abc",
+			Namespace: kruiseDaemonConfigNs,
+			Annotations: map[string]string{
+				SecretAnnotationReferenceJobs:   "default/test-job",
+				SecretAnnotationSourceSecretKey: "default/my-secret",
+			},
+		},
+		Data: map[string][]byte{"key": []byte("val")},
+	}
+	daemonConfigNs := &v1.Namespace{
+		ObjectMeta: metav1.ObjectMeta{Name: kruiseDaemonConfigNs},
+	}
+
+	tests := []struct {
+		name             string
+		job              *appsv1beta1.ImagePullJob
+		objects          []client.Object
+		expectEarlyNil   bool
+		expectSecretGCed bool
+	}{
+		{
+			name: "no pullSecrets + active job: early return nil",
+			job: &appsv1beta1.ImagePullJob{
+				ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "default"},
+				Spec:       appsv1beta1.ImagePullJobSpec{},
+			},
+			expectEarlyNil: true,
+		},
+		{
+			name: "no pullSecrets + DeletionTimestamp set: should NOT early return, proceeds to cleanup",
+			job: &appsv1beta1.ImagePullJob{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:              "test-job",
+					Namespace:         "default",
+					DeletionTimestamp:  &now,
+					Finalizers:        []string{"test"},
+				},
+				Spec: appsv1beta1.ImagePullJobSpec{},
+			},
+			objects:          []client.Object{daemonConfigNs, syncedSecret},
+			expectEarlyNil:   false,
+			expectSecretGCed: true,
+		},
+		{
+			name: "no pullSecrets + CompletionTime set: should NOT early return, proceeds to cleanup",
+			job: &appsv1beta1.ImagePullJob{
+				ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "default"},
+				Spec:       appsv1beta1.ImagePullJobSpec{},
+				Status:     appsv1beta1.ImagePullJobStatus{CompletionTime: &now},
+			},
+			objects:          []client.Object{daemonConfigNs, syncedSecret},
+			expectEarlyNil:   false,
+			expectSecretGCed: true,
+		},
+		{
+			name: "has pullSecrets + active job: should NOT early return",
+			job: &appsv1beta1.ImagePullJob{
+				ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "default"},
+				Spec: appsv1beta1.ImagePullJobSpec{
+					ImagePullJobTemplate: appsv1beta1.ImagePullJobTemplate{
+						PullSecrets: []string{"my-secret"},
+					},
+				},
+			},
+			objects:        []client.Object{daemonConfigNs, &v1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "my-secret", Namespace: "default"}, Data: map[string][]byte{"key": []byte("val")}}},
+			expectEarlyNil: false,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			builder := fake.NewClientBuilder().WithScheme(scheme)
+			if len(tt.objects) > 0 {
+				builder = builder.WithObjects(tt.objects...)
+			}
+			fakeClient := builder.Build()
+			r := &ReconcileImagePullJob{
+				Client:                   fakeClient,
+				scheme:                   scheme,
+				generateRandomStringFunc: defaultGenerateRandomString,
+			}
+
+			result, err := r.syncJobPullSecrets(tt.job)
+			assert.NoError(t, err)
+
+			if tt.expectEarlyNil {
+				assert.Nil(t, result)
+				return
+			}
+
+			if tt.expectSecretGCed {
+				secret := &v1.Secret{}
+				getErr := fakeClient.Get(context.TODO(), types.NamespacedName{
+					Namespace: kruiseDaemonConfigNs,
+					Name:      "synced-secret-abc",
+				}, secret)
+				assert.True(t, getErr != nil, "synced secret should have been deleted during cleanup")
+			}
+		})
+	}
+}
+
+func TestSyncNodeImages(t *testing.T) {
+	fakeClock := k8stesting.NewFakeClock(time.Now())
+	jobUID := types.UID("job-uid-1")
+	ownerRef := v1.ObjectReference{
+		APIVersion: controllerKind.GroupVersion().String(),
+		Kind:       controllerKind.Kind,
+		Name:       "test-job",
+		Namespace:  "default",
+		UID:        jobUID,
+	}
+	otherOwnerRef := v1.ObjectReference{
+		APIVersion: controllerKind.GroupVersion().String(),
+		Kind:       controllerKind.Kind,
+		Name:       "other-job",
+		Namespace:  "default",
+		UID:        types.UID("other-uid"),
+	}
+	secretA := appsv1beta1.ReferenceObject{Namespace: "kruise-daemon-config", Name: "secret-a"}
+	secretB := appsv1beta1.ReferenceObject{Namespace: "kruise-daemon-config", Name: "secret-b"}
+
+	tests := []struct {
+		name                string
+		job                 *appsv1beta1.ImagePullJob
+		secrets             []appsv1beta1.ReferenceObject
+		existingNodeImage   *appsv1beta1.NodeImage
+		expectUpdate        bool
+		expectPullSecrets   []appsv1beta1.ReferenceObject
+		expectTagCo
```

**File**: `pkg/controller/imagepulljob/imagepulljob_event_handler.go` (modified, +82/-10)
```diff
@@ -80,29 +80,60 @@ func (e *nodeImageEventHandler) handle(nodeImage *appsv1beta1.NodeImage, q workq
 }
 
 func (e *nodeImageEventHandler) handleUpdate(nodeImage, oldNodeImage *appsv1beta1.NodeImage, q workqueue.TypedRateLimitingInterface[reconcile.Request]) {
-	changedImages := sets.NewString()
+	// changedTags tracks which tags changed per image name.
+	// nil value = image-level field change (PullSecrets/SandboxConfig/deleted), enqueue all jobs for that image
+	// non-nil value = only specific tags changed, only enqueue jobs owning those tags
+	changedTags := make(map[string]sets.String)
 	tmpOldNodeImage := oldNodeImage.DeepCopy()
+
 	for name, imageSpec := range nodeImage.Spec.Images {
 		oldImageSpec := tmpOldNodeImage.Spec.Images[name]
 		delete(tmpOldNodeImage.Spec.Images, name)
-		if !reflect.DeepEqual(imageSpec, oldImageSpec) {
-			changedImages.Insert(name)
+		if reflect.DeepEqual(imageSpec, oldImageSpec) {
+			continue
+		}
+		if !reflect.DeepEqual(imageSpec.PullSecrets, oldImageSpec.PullSecrets) ||
+			!reflect.DeepEqual(imageSpec.SandboxConfig, oldImageSpec.SandboxConfig) {
+			changedTags[name] = nil
+		} else {
+			tags := getChangedSpecTags(imageSpec.Tags, oldImageSpec.Tags)
+			if prev, ok := changedTags[name]; ok && prev != nil {
+				changedTags[name] = prev.Union(tags)
+			} else if !ok {
+				changedTags[name] = tags
+			}
 		}
 	}
 	for name := range tmpOldNodeImage.Spec.Images {
-		changedImages.Insert(name)
+		changedTags[name] = nil
 	}
+
 	for name, imageStatus := range nodeImage.Status.ImageStatuses {
 		oldImageStatus := tmpOldNodeImage.Status.ImageStatuses[name]
 		delete(tmpOldNodeImage.Status.ImageStatuses, name)
-		if !reflect.DeepEqual(imageStatus, oldImageStatus) {
-			changedImages.Insert(name)
+		if reflect.DeepEqual(imageStatus, oldImageStatus) {
+			continue
+		}
+		tags := getChangedStatusTags(imageStatus.Tags, oldImageStatus.Tags)
+		if prev, ok := changedTags[name]; ok && prev != nil {
+			changedTags[name] = prev.Union(tags)
+		} else if !ok {
+			changedTags[name] = tags
 		}
 	}
 	for name := range tmpOldNodeImage.Status.ImageStatuses {
-		changedImages.Insert(name)
+		if _, ok := changedTags[name]; !ok {
+			changedTags[name] = nil
+		}
+	}
+
+	if klog.V(5).Enabled() {
+		changedImages := make([]string, 0, len(changedTags))
+		for name := range changedTags {
+			changedImages = append(changedImages, name)
+		}
+		klog.InfoS("Found NodeImage updated", "nodeImageName", nodeImage.Name, "changedImages", changedImages)
 	}
-	klog.V(5).InfoS("Found NodeImage updated and only affect images", "nodeImageName", nodeImage.Name, "changedImages", changedImages.List())
 
 	// Get jobs related to this NodeImage
 	newJobs, oldJobs, err := utilimagejob.GetActiveJobsForNodeImage(e.Reader, nodeImage, oldNodeImage)
@@ -111,12 +142,17 @@ func (e *nodeImageEventHandler) handleUpdate(nodeImage, oldNodeImage *appsv1beta
 	}
 	diffSet := diffJobs(newJobs, oldJobs)
 	for _, j := range newJobs {
-		imageName, _, err := daemonutil.NormalizeImageRefToNameTag(j.Spec.Image)
+		imageName, imageTag, err := daemonutil.NormalizeImageRefToNameTag(j.Spec.Image)
 		if err != nil {
 			klog.InfoS("Invalid image in job", "image", j.Spec.Image, "imagePullJob", klog.KObj(j))
 			continue
 		}
-		if changedImages.Has(imageName) {
+		tags, ok := changedTags[imageName]
+		if !ok {
+			continue
+		}
+		// nil means image-level change, enqueue all jobs for this image
+		if tags == nil || tags.Has(imageTag) {
 			diffSet[types.NamespacedName{Namespace: j.Namespace, Name: j.Name}] = struct{}{}
 		}
 	}
@@ -125,6 +161,42 @@ func (e *nodeImageEventHandler) handleUpdate(nodeImage, oldNodeImage *appsv1beta
 	}
 }
 
+func getChangedSpecTags(newTags, oldTags []appsv1beta1.ImageTagSpec) sets.String {
+	changed := sets.NewString()
+	oldMap := make(map[string]appsv1beta1.ImageTagSpec, len(oldTags))
+	for _, t := range oldTags {
+		oldMap[t.Tag] = t
+	}
+	for _, t := range newTags {
+		if old, ok := oldMap[t.Tag]; !ok || !reflect.DeepEqual(t, old) {
+			changed.Insert(t.Tag)
+		}
+		delete(oldMap, t.Tag)
+	}
+	for tag := range oldMap {
+		changed.Insert(tag)
+	}
+	return changed
+}
+
+func getChangedStatusTags(newTags, oldTags []appsv1beta1.ImageTagStatus) sets.String {
+	changed := sets.NewString()
+	oldMap := make(map[string]appsv1beta1.ImageTagStatus, len(oldTags))
+	for _, t := range oldTags {
+		oldMap[t.Tag] = t
+	}
+	for _, t := range newTags {
+		if old, ok := oldMap[t.Tag]; !ok || !reflect.DeepEqual(t, old) {
+			changed.Insert(t.Tag)
+		}
+		delete(oldMap, t.Tag)
+	}
+	for tag := range oldMap {
+		changed.Insert(tag)
+	}
+	return changed
+}
+
 type podEventHandler struct {
 	client.Reader
 }
```

**File**: `pkg/controller/imagepulljob/imagepulljob_event_handler_test.go` (modified, +485/-0)
```diff
@@ -363,3 +363,488 @@ func TestNodeImageEventHandler_handleUpdate(t *testing.T) {
 		})
 	}
 }
+
+func TestGetChangedSpecTags(t *testing.T) {
+	tagSpec := func(tag string, version int64) appsv1beta1.ImageTagSpec {
+		return appsv1beta1.ImageTagSpec{Tag: tag, Version: version}
+	}
+
+	tests := []struct {
+		name     string
+		newTags  []appsv1beta1.ImageTagSpec
+		oldTags  []appsv1beta1.ImageTagSpec
+		expected []string
+	}{
+		{
+			name:     "both empty",
+			newTags:  nil,
+			oldTags:  nil,
+			expected: []string{},
+		},
+		{
+			name:     "identical tags",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.21", 1)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.21", 1)},
+			expected: []string{},
+		},
+		{
+			name:     "reordered tags: same content different order returns empty",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.21", 1), tagSpec("1.20", 1)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.21", 1)},
+			expected: []string{},
+		},
+		{
+			name:     "tag added",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.21", 1)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1)},
+			expected: []string{"1.21"},
+		},
+		{
+			name:     "tag removed",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.21", 1)},
+			expected: []string{"1.21"},
+		},
+		{
+			name:     "tag version changed",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 2), tagSpec("1.21", 1)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.21", 1)},
+			expected: []string{"1.20"},
+		},
+		{
+			name:     "all tags replaced",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.22", 1)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1)},
+			expected: []string{"1.20", "1.22"},
+		},
+		{
+			name:     "duplicate tags in old: last wins in map, compared against new",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 2)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.20", 2)},
+			expected: []string{},
+		},
+		{
+			name:     "duplicate tags in new: last wins in iteration, delete removes from old map",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1), tagSpec("1.20", 3)},
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 2)},
+			expected: []string{"1.20"},
+		},
+		{
+			name:     "old empty, new has tags",
+			newTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1)},
+			oldTags:  nil,
+			expected: []string{"1.20"},
+		},
+		{
+			name:     "new empty, old has tags",
+			newTags:  nil,
+			oldTags:  []appsv1beta1.ImageTagSpec{tagSpec("1.20", 1)},
+			expected: []string{"1.20"},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			result := getChangedSpecTags(tt.newTags, tt.oldTags)
+			assert.ElementsMatch(t, tt.expected, result.List())
+		})
+	}
+}
+
+func TestGetChangedStatusTags(t *testing.T) {
+	tagStatus := func(tag string, version int64, phase appsv1beta1.ImagePullPhase) appsv1beta1.ImageTagStatus {
+		return appsv1beta1.ImageTagStatus{Tag: tag, Version: version, Phase: phase}
+	}
+
+	tests := []struct {
+		name     string
+		newTags  []appsv1beta1.ImageTagStatus
+		oldTags  []appsv1beta1.ImageTagStatus
+		expected []string
+	}{
+		{
+			name:     "both empty",
+			newTags:  nil,
+			oldTags:  nil,
+			expected: []string{},
+		},
+		{
+			name:     "identical status",
+			newTags:  []appsv1beta1.ImageTagStatus{tagStatus("1.20", 1, appsv1beta1.ImagePhasePulling)},
+			oldTags:  []appsv1beta1.ImageTagStatus{tagStatus("1.20", 1, appsv1beta1.ImagePhasePulling)},
+			expected: []string{},
+		},
+		{
+			name: "reordered status: same content different order returns empty",
+			newTags: []appsv1beta1.ImageTagStatus{
+				tagStatus("1.21", 1, appsv1beta1.ImagePhasePulling),
+				tagStatus("1.20", 1, appsv1beta1.ImagePhaseSucceeded),
+			},
+			oldTags: []appsv1beta1.ImageTagStatus{
+				tagStatus("1.20", 1, appsv1beta1.ImagePhaseSucceeded),
+				tagStatus("1.21", 1, appsv1beta1.ImagePhasePulling),
+			},
+			expected: []string{},
+		},
+		{
+			name:     "phase changed",
+			newTags:  []appsv1beta1.ImageTagStatus{tagStatus("1.20", 1, appsv1beta1.ImagePhaseSucceeded)},
+			oldTags:  []appsv1beta1.ImageTagStatus{tagStatus("1.20", 1, appsv1beta1.ImagePhasePulling)},
+			expected: []string{"1.20"},
+		},
+		{
+			name: "status tag added",
+			newTags: []appsv1beta1.ImageTagStatus{
+				tagStatus("1.20", 1, appsv1beta1.ImagePhasePulling),
+				tagStatus("1.21", 1, appsv1beta1.ImagePhasePulling),
+			},
+			oldTags:  []appsv1beta1.ImageTagStatus{tagStatus("1.20", 1, appsv1beta1.ImagePhasePulling)},
+			expected: []string{"1.21"},
+		},
+		{
+			name:     "status tag removed",
+			newTags:  nil,
+			oldTags:  []appsv1beta1.ImageTagStatus{tagStatus("1.20", 1, appsv1beta1.ImagePhaseSucceeded)},
+			expected: []string{"1.20"},
+
```

**File**: `pkg/webhook/imagepulljob/validating/imagepulljob_create_update_handler.go` (modified, +20/-0)
```diff
@@ -20,9 +20,11 @@ import (
 	"context"
 	"fmt"
 	"net/http"
+	"reflect"
 	"strconv"
 	"strings"
 
+	admissionv1 "k8s.io/api/admission/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/util/intstr"
 	"k8s.io/apimachinery/pkg/util/sets"
@@ -60,6 +62,15 @@ func (h *ImagePullJobCreateUpdateHandler) Handle(ctx context.Context, req admiss
 		if err := h.Decoder.Decode(req, obj); err != nil {
 			return admission.Errored(http.StatusBadRequest, err)
 		}
+		if req.AdmissionRequest.Operation == admissionv1.Update {
+			oldObj := &appsv1beta1.ImagePullJob{}
+			if err := h.Decoder.DecodeRaw(req.OldObject, oldObj); err != nil {
+				return admission.Errored(http.StatusBadRequest, err)
+			}
+			if !reflect.DeepEqual(obj.Spec.PullSecrets, oldObj.Spec.PullSecrets) {
+				return admission.Denied("spec.pullSecrets is immutable")
+			}
+		}
 		if err := validateV1beta1(obj); err != nil {
 			klog.ErrorS(err, "Error validate ImagePullJob", "namespace", obj.Namespace, "name", obj.Name)
 			return admission.Errored(http.StatusBadRequest, err)
@@ -70,6 +81,15 @@ func (h *ImagePullJobCreateUpdateHandler) Handle(ctx context.Context, req admiss
 		if err := h.Decoder.Decode(req, obj); err != nil {
 			return admission.Errored(http.StatusBadRequest, err)
 		}
+		if req.AdmissionRequest.Operation == admissionv1.Update {
+			oldObj := &appsv1alpha1.ImagePullJob{}
+			if err := h.Decoder.DecodeRaw(req.OldObject, oldObj); err != nil {
+				return admission.Errored(http.StatusBadRequest, err)
+			}
+			if !reflect.DeepEqual(obj.Spec.PullSecrets, oldObj.Spec.PullSecrets) {
+				return admission.Denied("spec.pullSecrets is immutable")
+			}
+		}
 		if err := validate(obj); err != nil {
 			klog.ErrorS(err, "Error validate ImagePullJob", "namespace", obj.Namespace, "name", obj.Name)
 			return admission.Errored(http.StatusBadRequest, err)
```

**File**: `pkg/webhook/imagepulljob/validating/imagepulljob_create_update_handler_test.go` (modified, +118/-0)
```diff
@@ -17,15 +17,25 @@ limitations under the License.
 package validating
 
 import (
+	"context"
+	"encoding/json"
 	"strings"
 	"testing"
 
+	admissionv1 "k8s.io/api/admission/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
 	"k8s.io/apimachinery/pkg/util/intstr"
+	"k8s.io/client-go/kubernetes/scheme"
 	"k8s.io/utils/ptr"
+	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
 
+	"github.com/openkruise/kruise/apis"
 	appsv1alpha1 "github.com/openkruise/kruise/apis/apps/v1alpha1"
 	appsv1beta1 "github.com/openkruise/kruise/apis/apps/v1beta1"
+	"github.com/openkruise/kruise/pkg/features"
+	utilfeature "github.com/openkruise/kruise/pkg/util/feature"
 )
 
 func TestValidateParallelismV1alpha1(t *testing.T) {
@@ -124,6 +134,114 @@ func TestValidateParallelismV1alpha1(t *testing.T) {
 	}
 }
 
+func TestPullSecretsImmutability(t *testing.T) {
+	utilruntime.Must(apis.AddToScheme(scheme.Scheme))
+	defer utilfeature.SetFeatureGateDuringTest(t, utilfeature.DefaultMutableFeatureGate, features.KruiseDaemon, true)()
+	defer utilfeature.SetFeatureGateDuringTest(t, utilfeature.DefaultMutableFeatureGate, features.ImagePullJobGate, true)()
+
+	baseJob := func(pullSecrets []string) *appsv1beta1.ImagePullJob {
+		return &appsv1beta1.ImagePullJob{
+			ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "default"},
+			Spec: appsv1beta1.ImagePullJobSpec{
+				Image: "nginx:latest",
+				ImagePullJobTemplate: appsv1beta1.ImagePullJobTemplate{
+					PullSecrets:      pullSecrets,
+					CompletionPolicy: appsv1beta1.CompletionPolicy{Type: appsv1beta1.Always},
+					PullPolicy:       &appsv1beta1.PullPolicy{TimeoutSeconds: ptr.To[int32](600)},
+				},
+			},
+		}
+	}
+	marshal := func(t *testing.T, obj interface{}) []byte {
+		t.Helper()
+		data, err := json.Marshal(obj)
+		if err != nil {
+			t.Fatal(err)
+		}
+		return data
+	}
+
+	tests := []struct {
+		name      string
+		newObj    *appsv1beta1.ImagePullJob
+		oldObj    *appsv1beta1.ImagePullJob
+		operation admissionv1.Operation
+		allowed   bool
+	}{
+		{
+			name:      "create with pullSecrets is allowed",
+			newObj:    baseJob([]string{"secret1"}),
+			operation: admissionv1.Create,
+			allowed:   true,
+		},
+		{
+			name:      "update with unchanged pullSecrets is allowed",
+			newObj:    baseJob([]string{"secret1"}),
+			oldObj:    baseJob([]string{"secret1"}),
+			operation: admissionv1.Update,
+			allowed:   true,
+		},
+		{
+			name:      "update with changed pullSecrets is denied",
+			newObj:    baseJob([]string{"secret2"}),
+			oldObj:    baseJob([]string{"secret1"}),
+			operation: admissionv1.Update,
+			allowed:   false,
+		},
+		{
+			name:      "update adding pullSecrets is denied",
+			newObj:    baseJob([]string{"secret1"}),
+			oldObj:    baseJob(nil),
+			operation: admissionv1.Update,
+			allowed:   false,
+		},
+		{
+			name:      "update removing pullSecrets is denied",
+			newObj:    baseJob(nil),
+			oldObj:    baseJob([]string{"secret1"}),
+			operation: admissionv1.Update,
+			allowed:   false,
+		},
+		{
+			name:      "update with both nil pullSecrets is allowed",
+			newObj:    baseJob(nil),
+			oldObj:    baseJob(nil),
+			operation: admissionv1.Update,
+			allowed:   true,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			decoder := admission.NewDecoder(scheme.Scheme)
+			handler := &ImagePullJobCreateUpdateHandler{Decoder: decoder}
+
+			req := admission.Request{
+				AdmissionRequest: admissionv1.AdmissionRequest{
+					Operation: tt.operation,
+					Resource: metav1.GroupVersionResource{
+						Group:    appsv1beta1.GroupVersion.Group,
+						Version:  appsv1beta1.GroupVersion.Version,
+						Resource: "imagepulljobs",
+					},
+					Object: runtime.RawExtension{Raw: marshal(t, tt.newObj)},
+				},
+			}
+			if tt.oldObj != nil {
+				req.AdmissionRequest.OldObject = runtime.RawExtension{Raw: marshal(t, tt.oldObj)}
+			}
+
+			resp := handler.Handle(context.Background(), req)
+			if resp.Allowed != tt.allowed {
+				t.Errorf("expected allowed=%v, got allowed=%v, reason=%s", tt.allowed, resp.Allowed, resp.Result.Message)
+			}
+			if !tt.allowed && resp.Result != nil && !strings.Contains(resp.Result.Message, "pullSecrets") {
+				t.Errorf("expected error about pullSecrets, got: %s", resp.Result.Message)
+			}
+		})
+	}
+}
+
 func TestValidateParallelismV1beta1(t *testing.T) {
 	tests := []struct {
 		name        string
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
