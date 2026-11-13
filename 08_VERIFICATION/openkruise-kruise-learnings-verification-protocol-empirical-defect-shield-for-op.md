# Verification Protocol: Verification Protocol: Empirical Defect Shield for openkruise-kruise-learnings

<!-- PROVENANCE_START
{
  "source_repository": "openkruise-kruise-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:42:52.165Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-openkruise-kruise-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [openkruise-kruise-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:42:52.165Z`  
> **Learning ID**: `LEARN-REEXTRACT-openkruise-kruise-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `openkruise-kruise-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/openkruise-kruise-learnings.md`  
> **Source**: github ([https://github.com/openkruise/kruise](https://github.com/openkruise/kruise))  
> **Source Version**: `c6d10667`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T09:12:28.067Z  
> **Learning ID**: `learn-github-openkruise-kruise`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): openkruise/kruise

> **Canonical Artifact**: `07_PROJECT_LEARNING/openkruise-kruise-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openkruise/kruise](https://github.com/openkruise/kruise))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T09:12:28.059Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openkruise/kruise`
- **Description**: Automated management of large-scale applications on Kubernetes (incubating project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5376 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2649** (2026-11-05): **[release-1.9] Backport Nov 5 controller fixes**
  *Symptoms*: ## Summary - Backport five fixes merged into master on 2026-11-05:   - `c6e343cc1`: reconcile WorkloadSpread when a Pod becomes unschedulable.   - `df39dca75`: prevent an empty custom-workload scale selector from matching every Pod.   - `c8edcbce7`: wait for PVC and StorageClass caches in StatefulSet test setup.   - `174e02a85`: clear CloneSet's stale ProgressDeadlineExceeded condition on a new update revision.   - `c6d106679`: do not count failed BroadcastJob Pod creations as active. - Preserve release-1.9 APIs: adapt the CloneSet backport to existing `v1alpha1` types; no API promotion/removal, CRD, generated-client, or webhook changes. - Exclude `0a6738682`, which fixes only CloneSet `v1beta1` validation; release-1.9's `v1alpha1` validation already uses the correct assignment.  ## Test plan - [x] `go test -race ./pkg/controller/workloadspread ./pkg/util/controllerfinder ./pkg/controller/statefulset ./pkg/controller/cloneset ./pkg/controller/broadcastjob` with Kubernetes 1.32.0 envtest assets. - [x] `go test -race ./pkg/webhook/cloneset/validating ./pkg/controller/cloneset/utils ./pkg/util/workloadspread`. - [x] Verify formatting, `git diff --check`, and unchanged API definitions, CRDs, and generated clients. - [x] Backport-specific static code review.

- **Issue #2648** (2026-11-05): **[BUG] WorkloadSpread Adaptive rescheduling can stall when a Pod becomes Unschedulable**
  *Symptoms*: # [BUG] WorkloadSpread Adaptive rescheduling can stall when a Pod becomes Unschedulable after reconciliation  ## What happened?  A Pod assigned to the first subset of an Adaptive WorkloadSpread did not automatically fall back to the next subset, despite `rescheduleCriticalSeconds: 1`.  The controller reconciled the WorkloadSpread several times during Pod creation, then did not reconcile this WorkloadSpread again for approximately 25 minutes. I manually evicted the Pod afterward. The eviction admission handler updated the WorkloadSpread status, and the subsequent reconciliation immediately detected that the first subset was unschedulable. The replacement Pod was assigned to the second subset.  The eviction was **manually initiated**, not an automatic action by the Adaptive rescheduling controller.  ## What did you expect to happen?  When a managed Pod becomes `Pending` with an empty `spec.nodeName` and `PodScheduled=False, reason=Unschedulable`, the controller should reconcile its WorkloadSpread and evaluate the configured rescheduling timeout.  If the timeout has already elapsed, the controller should mark the subset unschedulable and delete the Pod so that the workload can create a replacement in an eligible fallback subset. Otherwise, it should schedule a check for the remaining timeout.  ## Configuration  The affected workload is a CloneSet. The following simplified demo illustrates the relevant setup, rather than reproducing the production configuration. Assume no availab

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

### Incident Patch 1: `0a673868` (2026-11-05)
**Commit Message**: fix(cloneset): prevent maxSurge variable shadowing in v1beta1 validation (#2617)

In validateUpdateStrategyV1beta1(), maxSurge was declared in the outer
scope (var maxSurge int) but re-declared using := inside the
rollingUpdate.MaxSurge != nil block (maxSurge, maxSurgeErr := ...).
This shadowed the outer variable, leaving it at 0.

As a result, the subsequent combined check
replicas > 0 && maxUnavailable < 1 && maxSurge < 1
always evaluated maxSurge < 1 as true, incorrectly rejecting valid
surge-only rolling update configurations (e.g. maxUnavailable=0 and
maxSurge=1).

Fix the shadowing by declaring maxSurgeErr beforehand and assigning to
the existing maxSurge variable.

Signed-off-by: bhuvan-somisetty <[REDACTED_EMAIL]>

**File**: `pkg/webhook/cloneset/validating/validation.go` (modified, +2/-1)
```diff
@@ -384,8 +384,9 @@ func validateUpdateStrategyV1beta1(strategy *v1beta1.CloneSetUpdateStrategy, rep
 
 		// Validate MaxSurge
 		var maxSurge int
+		var maxSurgeErr error
 		if rollingUpdate.MaxSurge != nil {
-			maxSurge, maxSurgeErr := util.GetScaledValueFromIntOrPercent(rollingUpdate.MaxSurge, replicas, true)
+			maxSurge, maxSurgeErr = util.GetScaledValueFromIntOrPercent(rollingUpdate.MaxSurge, replicas, true)
 			if maxSurgeErr != nil {
 				allErrs = append(allErrs, field.Invalid(rollingUpdatePath.Child("maxSurge"), rollingUpdate.MaxSurge.String(),
 					fmt.Sprintf("failed GetScaledValueFromIntOrPercent for maxSurge: %v", maxSurgeErr)))
```

**File**: `pkg/webhook/cloneset/validating/validation_test.go` (modified, +92/-0)
```diff
@@ -772,3 +772,95 @@ func TestValidateImagePreDownloadParallelism(t *testing.T) {
 		})
 	}
 }
+
+// TestValidateUpdateStrategyV1beta1MaxSurgeShadow is a regression test for the variable shadowing
+// bug in validateUpdateStrategyV1beta1 where `maxSurge, maxSurgeErr :=` inside the if-block
+// created a new inner variable, leaving the outer maxSurge always 0.  As a result the
+// combined check `maxUnavailable < 1 && maxSurge < 1` at line 400 incorrectly rejected
+// configurations with maxUnavailable=0 and maxSurge>0, which are perfectly valid.
+func TestValidateUpdateStrategyV1beta1MaxSurgeShadow(t *testing.T) {
+	maxUnavailable := intstr.FromInt32(0)
+	maxSurge := intstr.FromInt32(1)
+	partition := intstr.FromInt32(0)
+
+	tests := []struct {
+		name          string
+		strategy      *v1beta1.CloneSetUpdateStrategy
+		replicas      int
+		expectErr     bool
+		forbiddenPath string
+	}{
+		{
+			// maxUnavailable=0, maxSurge=1 is a valid surge-only rolling update.
+			// Before the fix the combined check saw outer maxSurge==0 and raised
+			// a spurious "maxUnavailable and maxSurge should not both be less than 1" error.
+			name: "valid maxUnavailable=0 maxSurge=1 should not error",
+			strategy: &v1beta1.CloneSetUpdateStrategy{
+				Type: v1beta1.RollingUpdateCloneSetUpdateStrategyType,
+				RollingUpdate: &v1beta1.RollingUpdateCloneSetStrategy{
+					PodUpdatePolicy: v1beta1.RecreateCloneSetPodUpdateStrategyType,
+					MaxUnavailable:  &maxUnavailable,
+					MaxSurge:        &maxSurge,
+					Partition:       &partition,
+				},
+			},
+			replicas:  3,
+			expectErr: false,
+		},
+		{
+			// maxUnavailable=0, maxSurge=0: genuinely invalid; both are less than 1.
+			name: "invalid maxUnavailable=0 maxSurge=0 should error",
+			strategy: &v1beta1.CloneSetUpdateStrategy{
+				Type: v1beta1.RollingUpdateCloneSetUpdateStrategyType,
+				RollingUpdate: &v1beta1.RollingUpdateCloneSetStrategy{
+					PodUpdatePolicy: v1beta1.RecreateCloneSetPodUpdateStrategyType,
+					MaxUnavailable:  &maxUnavailable,
+					MaxSurge:        func() *intstr.IntOrString { s := intstr.FromInt32(0); return &s }(),
+					Partition:       &partition,
+				},
+			},
+			replicas:      3,
+			expectErr:     true,
+			forbiddenPath: "updateStrategy.rollingUpdate.maxUnavailable",
+		},
+		{
+			// InPlaceOnly + maxSurge>0 must still be rejected.
+			name: "InPlaceOnly with maxSurge=1 should error",
+			strategy: &v1beta1.CloneSetUpdateStrategy{
+				Type: v1beta1.RollingUpdateCloneSetUpdateStrategyType,
+				RollingUpdate: &v1beta1.RollingUpdateCloneSetStrategy{
+					PodUpdatePolicy: v1beta1.InPlaceOnlyCloneSetPodUpdateStrategyType,
+					MaxUnavailable:  &maxUnavailable,
+					MaxSurge:        &maxSurge,
+					Partition:       &partition,
+				},
+			},
+			replicas:      3,
+			expectErr:     true,
+			forbiddenPath: "updateStrategy.rollingUpdate.maxSurge",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			allErrs := validateUpdateStrategyV1beta1(tt.strategy, tt.replicas, field.NewPath("updateStrategy"))
+			hasErr := len(allErrs) > 0
+			if hasErr != tt.expectErr {
+				t.Errorf("expected error=%v, got error=%v, errs=%v", tt.expectErr, hasErr, allErrs)
+				return
+			}
+			if tt.expectErr && tt.forbiddenPath != "" {
+				found := false
+				for _, e := range allErrs {
+					if e.Field == tt.forbiddenPath {
+						found = true
+						break
+					}
+				}
+				if !found {
+					t.Errorf("expected error at field %q, got: %v", tt.forbiddenPath, allErrs)
+				}
+			}
+		})
+	}
+}
```

---

### Incident Patch 2: `c6e343cc` (2026-10-22)
**Commit Message**: fix(workloadspread): reconcile when a pod becomes unschedulable

With the adaptive schedule strategy, a pod is rescheduled to another
subset once it has been unschedulable for rescheduleCriticalSeconds.
The timeout is only checked during a reconcile, and the reconcile that
first sees the PodScheduled=False/Unschedulable condition is the one
that requeues for it.

The pod update handler only enqueued the WorkloadSpread when a pod
became inactive or changed revision. The scheduler usually reports a
pod unschedulable after the reconciles triggered by its creation have
already run, so nothing requeued the WorkloadSpread and the pod stayed
pending in its subset until some unrelated event caused a reconcile.

Enqueue the WorkloadSpread when a pod becomes unschedulable.

Signed-off-by: Ishaan400 <[REDACTED_EMAIL]>

**File**: `pkg/controller/workloadspread/workloadspread_event_handler.go` (modified, +19/-0)
```diff
@@ -66,7 +66,26 @@ func (p *podEventHandler) Update(ctx context.Context, evt event.TypedUpdateEvent
 
 	if kubecontroller.IsPodActive(oldPod) && !kubecontroller.IsPodActive(newPod) || wsutil.GetPodVersion(oldPod) != wsutil.GetPodVersion(newPod) {
 		p.handlePod(q, newPod, UpdateEventAction)
+		return
+	}
+
+	// The adaptive strategy reschedules a Pod only once it has been reported unschedulable, and the
+	// reconcile that sees this condition is the one that requeues for rescheduleCriticalSeconds.
+	// The scheduler usually reports it after the reconciles triggered by the Pod creation have run,
+	// so enqueue when the Pod becomes unschedulable.
+	if !isPodUnschedulable(oldPod) && isPodUnschedulable(newPod) {
+		p.handlePod(q, newPod, UpdateEventAction)
+	}
+}
+
+// isPodUnschedulable returns true if the scheduler has reported the Pod as unschedulable.
+func isPodUnschedulable(pod *corev1.Pod) bool {
+	for _, condition := range pod.Status.Conditions {
+		if condition.Type == corev1.PodScheduled {
+			return condition.Status == corev1.ConditionFalse && condition.Reason == corev1.PodReasonUnschedulable
+		}
 	}
+	return false
 }
 
 func (p *podEventHandler) Delete(ctx context.Context, evt event.TypedDeleteEvent[*corev1.Pod], q workqueue.TypedRateLimitingInterface[reconcile.Request]) {
```

**File**: `pkg/controller/workloadspread/workloadspread_event_handler_test.go` (modified, +82/-0)
```diff
@@ -231,6 +231,88 @@ func TestPodEventHandler(t *testing.T) {
 	}
 }
 
+func TestPodEventHandlerUpdateUnschedulable(t *testing.T) {
+	injectWorkloadSpread := &wsutil.InjectWorkloadSpread{
+		Name:   "test-workloadSpread",
+		Subset: "subset-demo",
+	}
+	by, _ := json.Marshal(injectWorkloadSpread)
+
+	scheduledCondition := func(status corev1.ConditionStatus, reason, message string) []corev1.PodCondition {
+		return []corev1.PodCondition{{Type: corev1.PodScheduled, Status: status, Reason: reason, Message: message}}
+	}
+	pendingPod := func(annotated bool, conditions []corev1.PodCondition) *corev1.Pod {
+		pod := podDemo.DeepCopy()
+		pod.Spec.NodeName = ""
+		pod.Status.Phase = corev1.PodPending
+		pod.Status.Conditions = conditions
+		if annotated {
+			pod.Annotations = map[string]string{wsutil.MatchedWorkloadSpreadSubsetAnnotations: string(by)}
+		}
+		return pod
+	}
+
+	cases := []struct {
+		name          string
+		oldPod        *corev1.Pod
+		newPod        *corev1.Pod
+		expectEnqueue bool
+	}{
+		{
+			name:          "pod becomes unschedulable",
+			oldPod:        pendingPod(true, nil),
+			newPod:        pendingPod(true, scheduledCondition(corev1.ConditionFalse, corev1.PodReasonUnschedulable, "0/3 nodes are available")),
+			expectEnqueue: true,
+		},
+		{
+			name:          "pod becomes unschedulable after its scheduling gates are removed",
+			oldPod:        pendingPod(true, scheduledCondition(corev1.ConditionFalse, corev1.PodReasonSchedulingGated, "")),
+			newPod:        pendingPod(true, scheduledCondition(corev1.ConditionFalse, corev1.PodReasonUnschedulable, "0/3 nodes are available")),
+			expectEnqueue: true,
+		},
+		{
+			name:          "unschedulable pod only gets a new message",
+			oldPod:        pendingPod(true, scheduledCondition(corev1.ConditionFalse, corev1.PodReasonUnschedulable, "0/3 nodes are available")),
+			newPod:        pendingPod(true, scheduledCondition(corev1.ConditionFalse, corev1.PodReasonUnschedulable, "0/4 nodes are available")),
+			expectEnqueue: false,
+		},
+		{
+			name:          "pod not managed by a WorkloadSpread becomes unschedulable",
+			oldPod:        pendingPod(false, nil),
+			newPod:        pendingPod(false, scheduledCondition(corev1.ConditionFalse, corev1.PodReasonUnschedulable, "0/3 nodes are available")),
+			expectEnqueue: false,
+		},
+	}
+
+	for _, cs := range cases {
+		t.Run(cs.name, func(t *testing.T) {
+			handler := &podEventHandler{}
+			updateQ := workqueue.NewTypedRateLimitingQueue(
+				workqueue.DefaultTypedControllerRateLimiter[reconcile.Request](),
+			)
+			updateEvt := event.TypedUpdateEvent[*corev1.Pod]{
+				ObjectOld: cs.oldPod,
+				ObjectNew: cs.newPod,
+			}
+			handler.Update(context.TODO(), updateEvt, updateQ)
+
+			expectLen := 0
+			if cs.expectEnqueue {
+				expectLen = 1
+			}
+			if updateQ.Len() != expectLen {
+				t.Fatalf("unexpected update event handle queue size, expected %d actual %d", expectLen, updateQ.Len())
+			}
+			if cs.expectEnqueue {
+				key, _ := updateQ.Get()
+				if key.Namespace != cs.newPod.Namespace || key.Name != injectWorkloadSpread.Name {
+					t.Errorf("matching WorkloadSpread %s/%s failed, got %s", cs.newPod.Namespace, injectWorkloadSpread.Name, key)
+				}
+			}
+		})
+	}
+}
+
 func TestGetWorkloadSpreadForCloneSet(t *testing.T) {
 	cases := []struct {
 		name                 string
```

---

### Incident Patch 3: `c6d10667` (2026-10-16)
**Commit Message**: fix(broadcastjob): do not count failed pod creations as active

Signed-off-by: Sarthak Sharma <[REDACTED_EMAIL]>

**File**: `pkg/controller/broadcastjob/broadcastjob_controller.go` (modified, +1/-0)
```diff
@@ -460,6 +460,7 @@ func (r *ReconcileBroadcastJob) reconcilePods(job *appsv1beta1.BroadcastJob,
 					if err != nil {
 						defer utilruntime.HandleError(err)
 						errCh <- err
+						return
 					}
 					// If succeed, increase active counter
 					activeLock.Lock()
```

**File**: `pkg/controller/broadcastjob/broadcastjob_controller_test.go` (modified, +50/-0)
```diff
@@ -37,6 +37,7 @@ import (
 	"k8s.io/klog/v2"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
 	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 
 	appsv1beta1 "github.com/openkruise/kruise/apis/apps/v1beta1"
@@ -676,3 +677,52 @@ func patchPodName(pod *v1.Pod) {
 		pod.Name = pod.GenerateName + string(uuid.NewUUID())
 	}
 }
+
+// Test scenario:
+// 3 nodes without pod running
+// parallelism = 3
+// every pod creation fails, so no pod must be counted as active
+func TestReconcileJobCreatePodFailedNotCountedAsActive(t *testing.T) {
+	scheme := runtime.NewScheme()
+	utilruntime.Must(appsv1beta1.AddToScheme(scheme))
+	utilruntime.Must(v1.AddToScheme(scheme))
+
+	job := createJob("job-create-fail", intstr.FromInt(3))
+	node1 := createNode("node1")
+	node2 := createNode("node2")
+	node3 := createNode("node3")
+
+	reconcileJob := createReconcileJob(scheme, job, node1, node2, node3)
+	reconcileJob.Client = interceptor.NewClient(reconcileJob.Client.(client.WithWatch), interceptor.Funcs{
+		Create: func(ctx context.Context, c client.WithWatch, obj client.Object, opts ...client.CreateOption) error {
+			if _, ok := obj.(*v1.Pod); ok {
+				return fmt.Errorf("injected pod create error")
+			}
+			return c.Create(ctx, obj, opts...)
+		},
+	})
+
+	request := reconcile.Request{
+		NamespacedName: types.NamespacedName{
+			Name:      "job-create-fail",
+			Namespace: "default",
+		},
+	}
+
+	_, err := reconcileJob.Reconcile(context.TODO(), request)
+	assert.Error(t, err)
+
+	retrievedJob := &appsv1beta1.BroadcastJob{}
+	err = reconcileJob.Get(context.TODO(), request.NamespacedName, retrievedJob)
+	assert.NoError(t, err)
+
+	podList := &v1.PodList{}
+	err = reconcileJob.List(context.TODO(), podList, client.InNamespace(request.Namespace))
+	assert.NoError(t, err)
+
+	// no pod was created
+	assert.Empty(t, podList.Items)
+	// failed creations must not be counted as active
+	assert.Equal(t, int32(0), retrievedJob.Status.Active)
+	assert.Equal(t, int32(3), retrievedJob.Status.Desired)
+}
```

#### Recent Merged Pull Requests:
- **PR #2649** (2026-11-05): [release-1.9] Backport Nov 5 controller fixes (@furykerry)
- **PR #2642** (2026-11-05): fix(controllerfinder): don't match every pod for an empty scale selector (@sarankumar1325)
- **PR #2635** (2026-11-05): fix(statefulset): wait for PVC and StorageClass caches in test setup (@photoszzt)
- **PR #2634** (2026-11-05): fix(workloadspread): reconcile when a pod becomes unschedulable (@Ishaan400)
- **PR #2626** (2026-10-20): docs(changelog): add v1.9.1 and v1.9.2 release notes (@furykerry)
- **PR #2625** (2026-10-19): fix(ci): bump trivy-action to v0.36.0 and golangci-lint-action to v9.3.0 (@furykerry)

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

## X. cloneset): prevent maxSurge variable shadowing in v1beta1 validation (#2617)

**RULE**:
When implementing operations in `pkg/webhook/cloneset/validating/validation.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in openkruise/kruise. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0a673868`: cloneset): prevent maxSurge variable shadowing in v1beta1 validation (#2617). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/webhook/cloneset/validating/validation.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		var maxSurgeErr error
			maxSurge, maxSurgeErr = util.GetScaledValueFromIntOrPercent(rollingUpdate.MaxSurge, replicas, true)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			maxSurge, maxSurgeErr := util.GetScaledValueFromIntOrPercent(rollingUpdate.MaxSurge, replicas, true)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0a673868` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
