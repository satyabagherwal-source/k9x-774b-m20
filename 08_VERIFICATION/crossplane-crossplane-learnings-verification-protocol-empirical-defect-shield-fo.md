# Verification Protocol: Verification Protocol: Empirical Defect Shield for crossplane-crossplane-learnings

<!-- PROVENANCE_START
{
  "source_repository": "crossplane-crossplane-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T07:30:57.721Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-crossplane-crossplane-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [crossplane-crossplane-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T07:30:57.721Z`  
> **Learning ID**: `LEARN-EVO-crossplane-crossplane-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `crossplane-crossplane-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crossplane-crossplane-learnings.md`  
> **Source**: github ([https://github.com/crossplane/crossplane](https://github.com/crossplane/crossplane))  
> **Source Version**: `ba22c621`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T07:30:49.272Z  
> **Learning ID**: `learn-github-crossplane-crossplane`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): crossplane/crossplane

> **Canonical Artifact**: `07_PROJECT_LEARNING/crossplane-crossplane-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crossplane/crossplane](https://github.com/crossplane/crossplane))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T07:30:49.266Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crossplane/crossplane`
- **Description**: The Cloud Native Control Plane
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12251 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apis/core/v2/condition.go`
```
/*
Copyright 2019 The Crossplane Authors.

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

package v2

import (
	"sort"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// A ConditionType represents a condition a resource could be in.
type ConditionType string

// Condition types.
const (
	// TypeReady resources are believed to be ready to handle work.
	TypeReady ConditionType = "Ready"

	// TypeSynced resources are believed to be in sync with the
	// Kubernetes resources that manage their lifecycle.
	TypeSynced ConditionType = "Synced"

	// TypeHealthy resources are believed to be in a healthy state and to have all
	// of their child resources in a healthy state. For example, a claim is
	// healthy when the claim is synced and the underlying composite resource is
	// both synced and healthy. A composite resource is healthy when the composite
	// resource is synced and all composed resources are synced and, if
	// applicable, healthy (e.g., the composed resource is a composite resource).
	// TODO: This condition is not yet implemented. It is currently just reserved
	// as a system condition. See the tracking issue for more details
	// https://github.com/crossplane/crossplane/issues/5643.
	TypeHealthy ConditionType = "Healthy"

	// TypeUpToDate resources are believed to accurately represent the remote resource state.
	// The condition is controlled by the ResourceUpToDate return value from the Observe method
	// in the managed reconciler.
	TypeUpToDate ConditionType = "UpToDate"
)

// A ConditionReason represents the reason a resource is in a condition.
type ConditionReason string

// Reasons a resource is or is not ready.
const (
	ReasonAvailable   ConditionReason = "Available"
	ReasonUnavailable ConditionReason = "Unavailable"
	ReasonCreating    ConditionReason = "Creating"
	ReasonDeleting    ConditionReason = "Deleting"
)

// Reasons a resource is or is not synced.
const (
	ReasonReconcileSuccess ConditionReason = "ReconcileSuccess"
	ReasonReconcileError   ConditionReason = "ReconcileError"
	ReasonReconcilePaused  ConditionReason = "ReconcilePaused"
)

// Reasons a resource is or is not up to date.
const (
	ReasonUpdateRestricted ConditionReason = "UpdateRestricted"
	ReasonObserveMatched   ConditionReason = "ObserveMatched"
	ReasonUpdateFailed     ConditionReason = "UpdateFailed"
	ReasonUpdateRequested  ConditionReason = "UpdateRequested"
)

// See https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#typical-status-properties

// A Condition that may apply to a resource.
type Condition struct { //nolint:recvcheck // False positive - only has non-pointer methods AFAICT.
	// Type of this condition. At most one of each condition type may apply to
	// a resource at any point in time.
	Type ConditionType `json:"type"`

	// Status of this condition; is it currently True, False, or Unknown?
	Status corev1.ConditionStatus `json:"status"`

	// LastTransitionTime is the last time this condition transitioned from one
	// status to another.
	LastTransitionTime metav1.Time `json:"lastTransitionTime"`

	// A Reason for this condition's last transition from one status to another.
	Reason ConditionReason `json:"reason"`

	// A Message containing details about this condition's last transition from
	// one status to another, if any.
	// +optional
	Message string `json:"message,omitempty"`

	// ObservedGeneration represents the .metadata.generation that the condition was set based upon.
	// For instance, if .metadata.generation is currently 12, but the .status.conditions[x].observedGeneration is 9, the condition is out of date
	// with respect to the current state of the instance.
	// +optional
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
}

// Equal returns true if the condition is identical to the supplied condition,
// ignoring the LastTransitionTime.  If one or both conditions have not
// provided the ObservedGeneration it is not considered in the comparison.
func (c Condition) Equal(other Condition) bool {
	if c.ObservedGeneration == 0 || other.ObservedGeneration == 0 {
		return c.Type == other.Type &&
			c.Status == other.Status &&
			c.Reason == other.Reason &&
			c.Message == other.Message
	}
	return c.Type == other.Type &&
		c.Status == other.Status &&
		c.Reason == other.Reason &&
		c.Message == other.Message &&
		c.ObservedGeneration == other.ObservedGeneration
}

// WithMessage returns a condition by adding the provided message to existing
// condition.
func (c Condition) WithMessage(msg string) Condition {
	c.Message = msg
	return c
}

// WithObservedGeneration returns a condition by adding the provided observed generation
// to existing condition.
func (c Condition) WithObservedGeneration(gen int64) Condition {
	c.ObservedGeneration = gen
	return c
}

// IsSystemConditionType returns true if the condition is owned by the
// Crossplane system (e.g, Ready, Synced, Healthy).
func IsSystemConditionType(t ConditionType) bool {
	switch t {
	case TypeReady, TypeSynced, TypeHealthy, TypeUpToDate:
		return true
	}

	return false
}

// NOTE(negz): Conditions are implemented as a slice rather than a map to comply
// with Kubernetes API conventions. Ideally we'd comply by using a map that
// marshalled to a JSON array, but doing so confuses the CRD schema generator.
// https://github.com/kubernetes/community/blob/9bf8cd/contributors/devel/sig-architecture/api-conventions.md#lists-of-named-subobjects-preferred-over-maps

// NOTE(negz): Do not manipulate Conditions directly. Use the Set method.

// A ConditionedStatus reflects the observed status of a resource. Only
// one condition of each type may exist.
type ConditionedStatus struct {
	// Conditions of the resource.
	// +listType=map
	// +listMapKey=type
	// +optional
	Conditions []Condition `json:"conditions,omitempty"`
}

// NewConditionedStatus returns a stat with the supplied conditions set.
func NewConditionedStatus(c ...Condition) *ConditionedStatus {
	s := &ConditionedStatus{}
	s.SetConditions(c...)

	return s
}

// GetCondition returns the condition for the given ConditionType if exists,
// otherwise returns nil.
func (s *ConditionedStatus) GetCondition(ct ConditionType) Condition {
	for _, c := range s.Conditions {
		if c.Type == ct {
			return c
		}
	}

	return Condition{Type: ct, Status: corev1.ConditionUnknown}
}

// SetConditions sets the supplied conditions, replacing any existing conditions
// of the same type. This is a no-op if all supplied conditions are identical,
// ignoring the last transition time, to those already set.
func (s *ConditionedStatus) SetConditions(c ...Condition) {
	for _, cond := range c {
		exists := false

		for i, existing := range s.Conditions {
			if existing.Type != cond.Type {
				continue
			}

			if existing.Equal(cond) {
				exists = true
				continue
			}

			s.Conditions[i] = cond
			exists = true
		}

		if !exists {
			s.Conditions = append(s.Conditions, cond)
		}
	}
}

// Equal returns true if the status is identical to the supplied status,
// ignoring the LastTransitionTimes and order of statuses.
func (s *ConditionedStatus) Equal(other *ConditionedStatus) bool {
	if s == nil || other == nil {
		return s == nil && other == nil
	}

	if len(other.Conditions) != len(s.Conditions) {
		return false
	}

	sc := make([]Condition, len(s.Conditions))
	copy(sc, s.Conditions)

	oc := make([]Condition, len(other.Conditions))
	copy(oc, other.Conditions)

	// We should not have more than one condition of each type.
	sort.Slice(sc, func(i, j int) bool { return sc[i].Type < sc[j].Type })
	sort.Slice(oc, func(i, j int) bool { return oc[i].Type < oc[j].Type })

	for i := range sc {
		if !sc[i].Equal(oc[i]) {
			return false
		}
	}

	return true
}

// Creating returns a condition that indicates the resource is currently
// being created.
func Creating() Condition {
	return Condition{
		Type:               TypeReady,
		Status:             corev1.ConditionFalse,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonCreating,
	}
}

// Deleting returns a condition that indicates the resource is currently
// being deleted.
func Deleting() Condition {
	return Condition{
		Type:               TypeReady,
		Status:             corev1.ConditionFalse,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonDeleting,
	}
}

// Available returns a condition that indicates the resource is
// currently observed to be available for use.
func Available() Condition {
	return Condition{
		Type:               TypeReady,
		Status:             corev1.ConditionTrue,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonAvailable,
	}
}

// Unavailable returns a condition that indicates the resource is not
// currently available for use. Unavailable should be set only when Crossplane
// expects the resource to be available but knows it is not, for example
// because its API reports it is unhealthy.
func Unavailable() Condition {
	return Condition{
		Type:               TypeReady,
		Status:             corev1.ConditionFalse,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonUnavailable,
	}
}

// ReconcileSuccess returns a condition indicating that Crossplane successfully
// completed the most recent reconciliation of the resource.
func ReconcileSuccess() Condition {
	return Condition{
		Type:               TypeSynced,
		Status:             corev1.ConditionTrue,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonReconcileSuccess,
	}
}

// Rec
```

### Core Architecture Module: `apis/core/v2/doc.go`
```
/*
Copyright 2026 The Crossplane Authors.

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

// Package v2 contains common API types used by Crossplane resources.
//
// +kubebuilder:object:generate=true
package v2

```

### Core Architecture Module: `apis/core/v2/observation.go`
```
/*
Copyright 2024 The Crossplane Authors.

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

package v2

// ObservedStatus contains the recent reconciliation stats.
type ObservedStatus struct {
	// ObservedGeneration is the latest metadata.generation
	// which resulted in either a ready state, or stalled due to error
	// it can not recover from without human intervention.
	// +optional
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`

	// LastHandledReconcileAt holds the value of the most recent
	// reconcile-requested-at annotation token that the controller has
	// processed. Users can compare this to the annotation to determine
	// whether a reconcile request has been handled.
	// +optional
	LastHandledReconcileAt string `json:"lastHandledReconcileAt,omitempty"`
}

// SetObservedGeneration sets the generation of the main resource
// during the last reconciliation.
func (s *ObservedStatus) SetObservedGeneration(generation int64) {
	s.ObservedGeneration = generation
}

// GetObservedGeneration returns the last observed generation of the main resource.
func (s *ObservedStatus) GetObservedGeneration() int64 {
	return s.ObservedGeneration
}

// SetLastHandledReconcileAt sets the most recently handled reconcile request
// token.
func (s *ObservedStatus) SetLastHandledReconcileAt(token string) {
	s.LastHandledReconcileAt = token
}

// GetLastHandledReconcileAt returns the most recently handled reconcile
// request token.
func (s *ObservedStatus) GetLastHandledReconcileAt() string {
	return s.LastHandledReconcileAt
}

```

### Core Architecture Module: `apis/core/v2/policies.go`
```
/*
Copyright 2019 The Crossplane Authors.

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

package v2

// ManagementPolicies determine how should Crossplane controllers manage an
// external resource through an array of ManagementActions.
type ManagementPolicies []ManagementAction

// A ManagementAction represents an action that the Crossplane controllers
// can take on an external resource.
// +kubebuilder:validation:Enum=Observe;Create;Update;Delete;LateInitialize;*
type ManagementAction string

const (
	// ManagementActionObserve means that the managed resource status.atProvider
	// will be updated with the external resource state.
	ManagementActionObserve ManagementAction = "Observe"

	// ManagementActionCreate means that the external resource will be created
	// using the managed resource spec.initProvider and spec.forProvider.
	ManagementActionCreate ManagementAction = "Create"

	// ManagementActionUpdate means that the external resource will be updated
	// using the managed resource spec.forProvider.
	ManagementActionUpdate ManagementAction = "Update"

	// ManagementActionDelete means that the external resource will be deleted
	// when the managed resource is deleted.
	ManagementActionDelete ManagementAction = "Delete"

	// ManagementActionLateInitialize means that unspecified fields of the managed
	// resource spec.forProvider will be updated with the external resource state.
	ManagementActionLateInitialize ManagementAction = "LateInitialize"

	// ManagementActionAll means that all of the above actions will be taken
	// by the Crossplane controllers.
	ManagementActionAll ManagementAction = "*"
)

// A DeletionPolicy determines what should happen to the underlying external
// resource when a managed resource is deleted.
// +kubebuilder:validation:Enum=Orphan;Delete
type DeletionPolicy string

const (
	// DeletionOrphan means the external resource will be orphaned when its
	// managed resource is deleted.
	DeletionOrphan DeletionPolicy = "Orphan"

	// DeletionDelete means both the  external resource will be deleted when its
	// managed resource is deleted.
	DeletionDelete DeletionPolicy = "Delete"
)

// A CompositeDeletePolicy determines how the composite resource should be deleted
// when the corresponding claim is deleted.
// +kubebuilder:validation:Enum=Background;Foreground
type CompositeDeletePolicy string

const (
	// CompositeDeleteBackground means the composite resource will be deleted using
	// the Background Propagation Policy when the claim is deleted.
	CompositeDeleteBackground CompositeDeletePolicy = "Background"

	// CompositeDeleteForeground means the composite resource will be deleted using
	// the Foreground Propagation Policy when the claim is deleted.
	CompositeDeleteForeground CompositeDeletePolicy = "Foreground"
)

// An UpdatePolicy determines how something should be updated - either
// automatically (without human intervention) or manually.
// +kubebuilder:validation:Enum=Automatic;Manual
type UpdatePolicy string

const (
	// UpdateAutomatic means the resource should be updated automatically,
	// without any human intervention.
	UpdateAutomatic UpdatePolicy = "Automatic"

	// UpdateManual means the resource requires human intervention to
	// update.
	UpdateManual UpdatePolicy = "Manual"
)

// ResolvePolicy is a type for resolve policy.
type ResolvePolicy string

// ResolutionPolicy is a type for resolution policy.
type ResolutionPolicy string

const (
	// ResolvePolicyAlways is a resolve option.
	// When the ResolvePolicy is set to ResolvePolicyAlways the reference will
	// be tried to resolve for every reconcile loop.
	ResolvePolicyAlways ResolvePolicy = "Always"

	// ResolutionPolicyRequired is a resolution option.
	// When the ResolutionPolicy is set to ResolutionPolicyRequired the execution
	// could not continue even if the reference cannot be resolved.
	ResolutionPolicyRequired ResolutionPolicy = "Required"

	// ResolutionPolicyOptional is a resolution option.
	// When the ReferenceResolutionPolicy is set to ReferencePolicyOptional the
	// execution could continue even if the reference cannot be resolved.
	ResolutionPolicyOptional ResolutionPolicy = "Optional"
)

```

### Core Architecture Module: `apis/core/v2/resource.go`
```
/*
Copyright 2019 The Crossplane Authors.

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

package v2

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

const (
	// CredentialsSecretEndpointKey is the key inside a connection secret for the connection endpoint.
	CredentialsSecretEndpointKey = "endpoint"
	// CredentialsSecretPortKey is the key inside a connection secret for the connection port.
	CredentialsSecretPortKey = "port"
	// CredentialsSecretUserKey is the key inside a connection secret for the connection user.
	CredentialsSecretUserKey = "username"
	// CredentialsSecretPasswordKey is the key inside a connection secret for the connection password.
	CredentialsSecretPasswordKey = "password"
	// CredentialsSecretCAKey is the key inside a connection secret for the server CA certificate.
	CredentialsSecretCAKey = "clusterCA"
	// CredentialsSecretClientCertKey is the key inside a connection secret for the client certificate.
	CredentialsSecretClientCertKey = "clientCert"
	// CredentialsSecretClientKeyKey is the key inside a connection secret for the client key.
	CredentialsSecretClientKeyKey = "clientKey"
	// CredentialsSecretTokenKey is the key inside a connection secret for the bearer token value.
	CredentialsSecretTokenKey = "token"
	// CredentialsSecretKubeconfigKey is the key inside a connection secret for the raw kubeconfig yaml.
	CredentialsSecretKubeconfigKey = "kubeconfig"
)

// LabelKeyProviderKind is added to ProviderConfigUsages to relate them to their
// ProviderConfig.
const LabelKeyProviderKind = "crossplane.io/provider-config-kind"

// LabelKeyProviderName is added to ProviderConfigUsages to relate them to their
// ProviderConfig.
const LabelKeyProviderName = "crossplane.io/provider-config"

// NOTE(negz): The below secret references differ from ObjectReference and
// LocalObjectReference in that they include only the fields Crossplane needs to
// reference a secret, and make those fields required. This reduces ambiguity in
// the API for resource authors.

// A LocalSecretReference is a reference to a secret in the same namespace as
// the referencer.
type LocalSecretReference struct {
	// Name of the secret.
	Name string `json:"name"`
}

// A SecretReference is a reference to a secret in an arbitrary namespace.
type SecretReference struct {
	// Name of the secret.
	Name string `json:"name"`

	// Namespace of the secret.
	Namespace string `json:"namespace"`
}

// A SecretKeySelector is a reference to a secret key in an arbitrary namespace.
type SecretKeySelector struct {
	SecretReference `json:",inline"`

	// The key to select.
	Key string `json:"key"`
}

// A LocalSecretKeySelector is a reference to a secret key
// in the same namespace with the referencing object.
type LocalSecretKeySelector struct {
	LocalSecretReference `json:",inline"`

	Key string `json:"key"`
}

// ToSecretKeySelector is a convenience method for converting the
// LocalSecretKeySelector to a SecretKeySelector with the given namespace.
func (ls *LocalSecretKeySelector) ToSecretKeySelector(namespace string) *SecretKeySelector {
	return &SecretKeySelector{
		SecretReference: SecretReference{
			Name:      ls.Name,
			Namespace: namespace,
		},
		Key: ls.Key,
	}
}

// Policy represents the Resolve and Resolution policies of Reference instance.
type Policy struct {
	// Resolve specifies when this reference should be resolved. The default
	// is 'IfNotPresent', which will attempt to resolve the reference only when
	// the corresponding field is not present. Use 'Always' to resolve the
	// reference on every reconcile.
	// +optional
	// +kubebuilder:validation:Enum=Always;IfNotPresent
	Resolve *ResolvePolicy `json:"resolve,omitempty"`

	// Resolution specifies whether resolution of this reference is required.
	// The default is 'Required', which means the reconcile will fail if the
	// reference cannot be resolved. 'Optional' means this reference will be
	// a no-op if it cannot be resolved.
	// +optional
	// +kubebuilder:default=Required
	// +kubebuilder:validation:Enum=Required;Optional
	Resolution *ResolutionPolicy `json:"resolution,omitempty"`
}

// IsResolutionPolicyOptional checks whether the resolution policy of relevant reference is Optional.
func (p *Policy) IsResolutionPolicyOptional() bool {
	if p == nil || p.Resolution == nil {
		return false
	}

	return *p.Resolution == ResolutionPolicyOptional
}

// IsResolvePolicyAlways checks whether the resolution policy of relevant reference is Always.
func (p *Policy) IsResolvePolicyAlways() bool {
	if p == nil || p.Resolve == nil {
		return false
	}

	return *p.Resolve == ResolvePolicyAlways
}

// A Reference to a named object.
type Reference struct {
	// Name of the referenced object.
	Name string `json:"name"`

	// Policies for referencing.
	// +optional
	Policy *Policy `json:"policy,omitempty"`
}

// A NamespacedReference to a named object.
type NamespacedReference struct {
	// Name of the referenced object.
	Name string `json:"name"`
	// Namespace of the referenced object
	// +optional
	Namespace string `json:"namespace,omitempty"`
	// Policies for referencing.
	// +optional
	Policy *Policy `json:"policy,omitempty"`
}

// A TypedReference refers to an object by Name, Kind, and APIVersion. It is
// commonly used to reference cluster-scoped objects or objects where the
// namespace is already known.
type TypedReference struct {
	// APIVersion of the referenced object.
	APIVersion string `json:"apiVersion"`

	// Kind of the referenced object.
	Kind string `json:"kind"`

	// Name of the referenced object.
	Name string `json:"name"`

	// UID of the referenced object.
	// +optional
	UID types.UID `json:"uid,omitempty"`
}

// A Selector selects an object.
type Selector struct {
	// MatchLabels ensures an object with matching labels is selected.
	MatchLabels map[string]string `json:"matchLabels,omitempty"`

	// MatchControllerRef ensures an object with the same controller reference
	// as the selecting object is selected.
	MatchControllerRef *bool `json:"matchControllerRef,omitempty"`

	// Policies for selection.
	// +optional
	Policy *Policy `json:"policy,omitempty"`
}

// NamespacedSelector selects a namespaced object.
type NamespacedSelector struct {
	// MatchLabels ensures an object with matching labels is selected.
	MatchLabels map[string]string `json:"matchLabels,omitempty"`

	// MatchControllerRef ensures an object with the same controller reference
	// as the selecting object is selected.
	MatchControllerRef *bool `json:"matchControllerRef,omitempty"`

	// Policies for selection.
	// +optional
	Policy *Policy `json:"policy,omitempty"`

	// Namespace for the selector
	// +optional
	Namespace string `json:"namespace,omitempty"`
}

// ProviderConfigReference is a typed reference to a ProviderConfig
// object, with a known api group.
type ProviderConfigReference struct {
	// Kind of the referenced object.
	Kind string `json:"kind"`

	// Name of the referenced object.
	Name string `json:"name"`
}

// SetGroupVersionKind sets the Kind and APIVersion of a TypedReference.
func (obj *TypedReference) SetGroupVersionKind(gvk schema.GroupVersionKind) {
	obj.APIVersion, obj.Kind = gvk.ToAPIVersionAndKind()
}

// GroupVersionKind gets the GroupVersionKind of a TypedReference.
func (obj *TypedReference) GroupVersionKind() schema.GroupVersionKind {
	return schema.FromAPIVersionAndKind(obj.APIVersion, obj.Kind)
}

// GetObjectKind get the ObjectKind of a TypedReference.
func (obj *TypedReference) GetObjectKind() schema.ObjectKind { return obj }

// ManagedResourceStatus represents the observed state of a managed resource.
type ManagedResourceStatus struct {
	ConditionedStatus `json:",inline"`
	ObservedStatus    `json:",inline"`
}

// A CredentialsSource is a source from which provider credentials may be
// acquired.
type CredentialsSource string

const (
	// CredentialsSourceNone indicates that a provider does not require
	// credentials.
	CredentialsSourceNone CredentialsSource = "None"

	// CredentialsSourceSecret indicates that a provider should acquire
	// credentials from a secret.
	CredentialsSourceSecret CredentialsSource = "Secret"

	// CredentialsSourceInjectedIdentity indicates that a provider should use
	// credentials via its (pod's) identity; i.e. via IRSA for AWS,
	// Workload Identity for GCP, Pod Identity for Azure, or in-cluster
	// authentication for the Kubernetes API.
	CredentialsSourceInjectedIdentity CredentialsSource = "InjectedIdentity"

	// CredentialsSourceEnvironment indicates that a provider should acquire
	// credentials from an environment variable.
	CredentialsSourceEnvironment CredentialsSource = "Environment"

	// CredentialsSourceFilesystem indicates that a provider should acquire
	// credentials from the filesystem.
	CredentialsSourceFilesystem CredentialsSource = "Filesystem"
)

// CommonCredentialSelectors provides common selectors for extracting
// credentials.
type CommonCredentialSelectors struct {
	// Fs is a reference to a filesystem location that contains credentials that
	// must be used to connect to the provider.
	// +optional
	Fs *FsSelector `json:"fs,omitempty"`

	// Env is a reference to an environment variable that contains credentials
	// that must be used to connect to the provider.
	// +optional
	Env *EnvSelector `json:"env,omitempty"`

	// A SecretRef is a reference to a secret key that contains the credentials
	// that must be used to connect to the provider.
	// +optional
	SecretRef *SecretKeySelector `json:"secretRef,omite
```

### Core Architecture Module: `apis/core/v2/resource_cluster.go`
```
/*
Copyright 2019 The Crossplane Authors.

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

package v2

// A ClusterManagedResourceSpec defines the desired state of a cluster-scoped
// managed resource.
type ClusterManagedResourceSpec struct {
	// WriteConnectionSecretToReference specifies the namespace and name of a
	// Secret to which any connection details for this managed resource should
	// be written. Connection details frequently include the endpoint, username,
	// and password required to connect to the managed resource.
	// +optional
	WriteConnectionSecretToReference *SecretReference `json:"writeConnectionSecretToRef,omitempty"`

	// ProviderConfigReference specifies how the provider that will be used to
	// create, observe, update, and delete this managed resource should be
	// configured.
	// +kubebuilder:default={"name": "default"}
	ProviderConfigReference *Reference `json:"providerConfigRef,omitempty"`

	// THIS IS A BETA FIELD. It is on by default but can be opted out
	// through a Crossplane feature flag.
	// ManagementPolicies specify the array of actions Crossplane is allowed to
	// take on the managed and external resources.
	// This field is planned to replace the DeletionPolicy field in a future
	// release. Currently, both could be set independently and non-default
	// values would be honored if the feature flag is enabled. If both are
	// custom, the DeletionPolicy field will be ignored.
	// See the design doc for more information: https://github.com/crossplane/crossplane/blob/499895a25d1a1a0ba1604944ef98ac7a1a71f197/design/design-doc-observe-only-resources.md?plain=1#L223
	// and this one: https://github.com/crossplane/crossplane/blob/444267e84783136daa93568b364a5f01228cacbe/design/one-pager-ignore-changes.md
	// +optional
	// +kubebuilder:default={"*"}
	ManagementPolicies ManagementPolicies `json:"managementPolicies,omitempty"`

	// DeletionPolicy specifies what will happen to the underlying external
	// when this managed resource is deleted - either "Delete" or "Orphan" the
	// external resource.
	// This field is planned to be deprecated in favor of the ManagementPolicies
	// field in a future release. Currently, both could be set independently and
	// non-default values would be honored if the feature flag is enabled.
	// See the design doc for more information: https://github.com/crossplane/crossplane/blob/499895a25d1a1a0ba1604944ef98ac7a1a71f197/design/design-doc-observe-only-resources.md?plain=1#L223
	// +optional
	// +kubebuilder:default=Delete
	DeletionPolicy DeletionPolicy `json:"deletionPolicy,omitempty"`
}

```

### Core Architecture Module: `apis/core/v2/resource_namespace.go`
```
/*
Copyright 2019 The Crossplane Authors.

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

package v2

// A ManagedResourceSpec defines the desired state of a
// namespace-scoped managed resource.
type ManagedResourceSpec struct {
	// WriteConnectionSecretToReference specifies the namespace and name of a
	// Secret to which any connection details for this managed resource should
	// be written. Connection details frequently include the endpoint, username,
	// and password required to connect to the managed resource.
	// +optional
	WriteConnectionSecretToReference *LocalSecretReference `json:"writeConnectionSecretToRef,omitempty"`

	// ProviderConfigReference specifies how the provider that will be used to
	// create, observe, update, and delete this managed resource should be
	// configured.
	// +kubebuilder:default={"kind": "ClusterProviderConfig", "name": "default"}
	ProviderConfigReference *ProviderConfigReference `json:"providerConfigRef,omitempty"`

	// THIS IS A BETA FIELD. It is on by default but can be opted out
	// through a Crossplane feature flag.
	// ManagementPolicies specify the array of actions Crossplane is allowed to
	// take on the managed and external resources.
	// See the design doc for more information: https://github.com/crossplane/crossplane/blob/499895a25d1a1a0ba1604944ef98ac7a1a71f197/design/design-doc-observe-only-resources.md?plain=1#L223
	// and this one: https://github.com/crossplane/crossplane/blob/444267e84783136daa93568b364a5f01228cacbe/design/one-pager-ignore-changes.md
	// +optional
	// +kubebuilder:default={"*"}
	ManagementPolicies ManagementPolicies `json:"managementPolicies,omitempty"`
}

```

### Core Architecture Module: `apis/core/v2/zz_generated.deepcopy.go`
```
//go:build !ignore_autogenerated

/*
Copyright 2021 The Crossplane Authors.

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

// Code generated by controller-gen. DO NOT EDIT.

package v2

import ()

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *ClusterManagedResourceSpec) DeepCopyInto(out *ClusterManagedResourceSpec) {
	*out = *in
	if in.WriteConnectionSecretToReference != nil {
		in, out := &in.WriteConnectionSecretToReference, &out.WriteConnectionSecretToReference
		*out = new(SecretReference)
		**out = **in
	}
	if in.ProviderConfigReference != nil {
		in, out := &in.ProviderConfigReference, &out.ProviderConfigReference
		*out = new(Reference)
		(*in).DeepCopyInto(*out)
	}
	if in.ManagementPolicies != nil {
		in, out := &in.ManagementPolicies, &out.ManagementPolicies
		*out = make(ManagementPolicies, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ClusterManagedResourceSpec.
func (in *ClusterManagedResourceSpec) DeepCopy() *ClusterManagedResourceSpec {
	if in == nil {
		return nil
	}
	out := new(ClusterManagedResourceSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *CommonCredentialSelectors) DeepCopyInto(out *CommonCredentialSelectors) {
	*out = *in
	if in.Fs != nil {
		in, out := &in.Fs, &out.Fs
		*out = new(FsSelector)
		**out = **in
	}
	if in.Env != nil {
		in, out := &in.Env, &out.Env
		*out = new(EnvSelector)
		**out = **in
	}
	if in.SecretRef != nil {
		in, out := &in.SecretRef, &out.SecretRef
		*out = new(SecretKeySelector)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new CommonCredentialSelectors.
func (in *CommonCredentialSelectors) DeepCopy() *CommonCredentialSelectors {
	if in == nil {
		return nil
	}
	out := new(CommonCredentialSelectors)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Condition) DeepCopyInto(out *Condition) {
	*out = *in
	in.LastTransitionTime.DeepCopyInto(&out.LastTransitionTime)
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new Condition.
func (in *Condition) DeepCopy() *Condition {
	if in == nil {
		return nil
	}
	out := new(Condition)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *ConditionedStatus) DeepCopyInto(out *ConditionedStatus) {
	*out = *in
	if in.Conditions != nil {
		in, out := &in.Conditions, &out.Conditions
		*out = make([]Condition, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ConditionedStatus.
func (in *ConditionedStatus) DeepCopy() *ConditionedStatus {
	if in == nil {
		return nil
	}
	out := new(ConditionedStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *EnvSelector) DeepCopyInto(out *EnvSelector) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new EnvSelector.
func (in *EnvSelector) DeepCopy() *EnvSelector {
	if in == nil {
		return nil
	}
	out := new(EnvSelector)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *FsSelector) DeepCopyInto(out *FsSelector) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new FsSelector.
func (in *FsSelector) DeepCopy() *FsSelector {
	if in == nil {
		return nil
	}
	out := new(FsSelector)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *LocalSecretKeySelector) DeepCopyInto(out *LocalSecretKeySelector) {
	*out = *in
	out.LocalSecretReference = in.LocalSecretReference
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new LocalSecretKeySelector.
func (in *LocalSecretKeySelector) DeepCopy() *LocalSecretKeySelector {
	if in == nil {
		return nil
	}
	out := new(LocalSecretKeySelector)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *LocalSecretReference) DeepCopyInto(out *LocalSecretReference) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new LocalSecretReference.
func (in *LocalSecretReference) DeepCopy() *LocalSecretReference {
	if in == nil {
		return nil
	}
	out := new(LocalSecretReference)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *ManagedResourceSpec) DeepCopyInto(out *ManagedResourceSpec) {
	*out = *in
	if in.WriteConnectionSecretToReference != nil {
		in, out := &in.WriteConnectionSecretToReference, &out.WriteConnectionSecretToReference
		*out = new(LocalSecretReference)
		**out = **in
	}
	if in.ProviderConfigReference != nil {
		in, out := &in.ProviderConfigReference, &out.ProviderConfigReference
		*out = new(ProviderConfigReference)
		**out = **in
	}
	if in.ManagementPolicies != nil {
		in, out := &in.ManagementPolicies, &out.ManagementPolicies
		*out = make(ManagementPolicies, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ManagedResourceSpec.
func (in *ManagedResourceSpec) DeepCopy() *ManagedResourceSpec {
	if in == nil {
		return nil
	}
	out := new(ManagedResourceSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *ManagedResourceStatus) DeepCopyInto(out *ManagedResourceStatus) {
	*out = *in
	in.ConditionedStatus.DeepCopyInto(&out.ConditionedStatus)
	out.ObservedStatus = in.ObservedStatus
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ManagedResourceStatus.
func (in *ManagedResourceStatus) DeepCopy() *ManagedResourceStatus {
	if in == nil {
		return nil
	}
	out := new(ManagedResourceStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in ManagementPolicies) DeepCopyInto(out *ManagementPolicies) {
	{
		in := &in
		*out = make(ManagementPolicies, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ManagementPolicies.
func (in ManagementPolicies) DeepCopy() ManagementPolicies {
	if in == nil {
		return nil
	}
	out := new(ManagementPolicies)
	in.DeepCopyInto(out)
	return *out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *NamespacedReference) DeepCopyInto(out *NamespacedReference) {
	*out = *in
	if in.Policy != nil {
		in, out := &in.Policy, &out.Policy
		*out = new(Policy)
		(*in).DeepCopyInto(*out)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new NamespacedReference.
func (in *NamespacedReference) DeepCopy() *NamespacedReference {
	if in == nil {
		return nil
	}
	out := new(NamespacedReference)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *NamespacedSelector) DeepCopyInto(out *NamespacedSelector) {
	*out = *in
	if in.MatchLabels != nil {
		in, out := &in.MatchLabels, &out.MatchLabels
		*out = make(map[string]string, len(*in))
		for key, val := range *in {
			(*out)[key] = val
		}
	}
	if in.MatchControllerRef != nil {
		in, out := &in.MatchControllerRef, &out.MatchControllerRef
		*out = new(bool)
		**out = **in
	}
	if in.Policy != nil {
		in, out := &in.Policy, &out.Policy
		*out = new(Policy)
		(*in).DeepCopyInto(*out)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new NamespacedSelector.
func (in *NamespacedSelector) DeepCopy() *NamespacedSelector {
	if in == nil {
		return nil
	}
	out := new(NamespacedSelector)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *ObservedStatus) DeepCopyInto(out *ObservedStatus) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ObservedStatus.
func (in *ObservedStatus) DeepCopy() *ObservedStatus {
	if in == nil {
		return nil
	}
	out := new(ObservedStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Policy) DeepCopyInto(out *Policy) {
	*out = *in
	if in.Resolve != nil {
		in, out := &in.Resolve, &out.Resolve
		*out = new(ResolvePolicy)
		**out = **in
	}
	if in.Resolution != nil {
		in, out := &in.Resolution, &out.Resolution
		*out = new(ResolutionPolicy)
		**out = **in
	}
}

// D
```

### Core Architecture Module: `cmd/crossplane/core/certs.go`
```
/*
Copyright 2023 The Crossplane Authors.

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

package core

import (
	"crypto/x509"
	"os"
	"path/filepath"

	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
)

// ParseCertificatesFromPath parses PEM file containing extra x509
// certificates(s) and combines them with the built in root CA CertPool.
func ParseCertificatesFromPath(path string) (*x509.CertPool, error) {
	// Get the SystemCertPool, continue with an empty pool on error
	rootCAs, _ := x509.SystemCertPool()
	if rootCAs == nil {
		rootCAs = x509.NewCertPool()
	}

	// Read in the cert file
	certs, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to append %q to RootCAs", path)
	}

	// Append our cert to the system pool
	if ok := rootCAs.AppendCertsFromPEM(certs); !ok {
		return nil, errors.Errorf("No certificates could be parsed from %q", path)
	}

	return rootCAs, nil
}

```

### Core Architecture Module: `cmd/crossplane/core/core.go`
```
/*
Copyright 2019 The Crossplane Authors.

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

// Package core implements Crossplane's core controller manager.
package core

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/alecthomas/kong"
	"github.com/spf13/afero"
	corev1 "k8s.io/api/core/v1"
	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	kmeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	kcache "k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/leaderelection/resourcelock"
	"k8s.io/client-go/tools/record"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	"github.com/crossplane/crossplane-runtime/v2/pkg/certificates"
	"github.com/crossplane/crossplane-runtime/v2/pkg/controller"
	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
	"github.com/crossplane/crossplane-runtime/v2/pkg/event"
	"github.com/crossplane/crossplane-runtime/v2/pkg/feature"
	"github.com/crossplane/crossplane-runtime/v2/pkg/logging"
	"github.com/crossplane/crossplane-runtime/v2/pkg/reconciler/customresourcesgate"
	"github.com/crossplane/crossplane-runtime/v2/pkg/resource/unstructured"
	"github.com/crossplane/crossplane-runtime/v2/pkg/xpkg"
	"github.com/crossplane/crossplane-runtime/v2/pkg/xpkg/parser"
	"github.com/crossplane/crossplane-runtime/v2/pkg/xpkg/signature"

	pkgv1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
	"github.com/crossplane/crossplane/v2/internal/circuit"
	"github.com/crossplane/crossplane/v2/internal/controller/apiextensions"
	apiextensionscontroller "github.com/crossplane/crossplane/v2/internal/controller/apiextensions/controller"
	"github.com/crossplane/crossplane/v2/internal/controller/ops"
	opscontroller "github.com/crossplane/crossplane/v2/internal/controller/ops/controller"
	"github.com/crossplane/crossplane/v2/internal/controller/pkg"
	pkgcontroller "github.com/crossplane/crossplane/v2/internal/controller/pkg/controller"
	"github.com/crossplane/crossplane/v2/internal/controller/protection"
	"github.com/crossplane/crossplane/v2/internal/engine"
	"github.com/crossplane/crossplane/v2/internal/features"
	"github.com/crossplane/crossplane/v2/internal/initializer"
	"github.com/crossplane/crossplane/v2/internal/metrics"
	"github.com/crossplane/crossplane/v2/internal/protection/usage"
	"github.com/crossplane/crossplane/v2/internal/transport"
	usagehook "github.com/crossplane/crossplane/v2/internal/webhook/protection/usage"
	"github.com/crossplane/crossplane/v2/internal/xfn"
	xfncached "github.com/crossplane/crossplane/v2/internal/xfn/cached"
	"github.com/crossplane/crossplane/v2/internal/xfn/inspected"
)

// Command runs the core crossplane controllers.
type Command struct {
	Start startCommand `cmd:"" help:"Start Crossplane controllers."`
	Init  initCommand  `cmd:"" help:"Make cluster ready for Crossplane controllers."`
}

// KongVars represent the kong variables associated with the CLI parser
// required for the Registry default variable interpolation.
var KongVars = kong.Vars{ //nolint:gochecknoglobals // We treat these as constants.
	"default_user_agent": transport.DefaultUserAgent(),
}

// Run is the no-op method required for kong call tree
// Kong requires each node in the calling path to have associated
// Run method.
func (c *Command) Run() error {
	return nil
}

type startCommand struct {
	Profile string `help:"Serve runtime profiling data via HTTP at /debug/pprof." placeholder:"host:port"`

	Namespace      string `default:"crossplane-system"     env:"POD_NAMESPACE"                                                      help:"Namespace used to unpack and run packages."                      short:"n"`
	ServiceAccount string `default:"crossplane"            env:"POD_SERVICE_ACCOUNT"                                                help:"Name of the Crossplane Service Account."`
	LeaderElection bool   `default:"false"                 env:"LEADER_ELECTION"                                                    help:"Use leader election for the controller manager."                 short:"l"`
	CABundlePath   string `env:"CA_BUNDLE_PATH"            help:"Additional CA bundle to use when fetching packages from registry."`
	UserAgent      string `default:"${default_user_agent}" env:"USER_AGENT"                                                         help:"The User-Agent header that will be set on all package requests."`

	XpkgCacheDir string `aliases:"cache-dir" default:"/cache/xpkg" env:"XPKG_CACHE_DIR,CACHE_DIR" help:"Directory used for caching package images." short:"c"`

	PackageRuntime string `default:"Deployment" env:"PACKAGE_RUNTIME" help:"The package runtime to use for packages with a runtime (e.g. Providers and Functions)" placeholder:"runtime | runtime1=package1;runtime2=package2"`

	SyncInterval                     time.Duration `default:"1h"                 help:"How often all resources will be double-checked for drift from the desired state."                  short:"s"`
	PollInterval                     time.Duration `default:"1m"                 help:"How often individual resources will be checked for drift from the desired state."`
	MinPollInterval                  time.Duration `default:"1s"                 help:"Minimum per-resource poll interval allowed via the crossplane.io/poll-interval annotation."`
	MaxConcurrentReconciles          int           `aliases:"max-reconcile-rate" default:"100"                                                                                            help:"The maximum number of concurrent reconcile operations (worker pool size)."`
	MaxConcurrentPackageEstablishers int           `default:"10"                 help:"The maximum number of goroutines to use for establishing Providers, Configurations and Functions."`

	CircuitBreakerBurst      float64       `default:"100.0" help:"XR circuit breaker token bucket capacity."`
	CircuitBreakerRefillRate float64       `default:"1.0"   help:"XR circuit breaker token refill rate (tokens/second)."`
	CircuitBreakerCooldown   time.Duration `default:"5m"    help:"How long XR circuit breakers stay open after triggering."`

	EnableWebhooks bool `aliases:"webhook-enabled" default:"true" env:"ENABLE_WEBHOOKS,WEBHOOK_ENABLED" help:"Enable webhook configuration."`

	WebhookPort     int `default:"9443" env:"WEBHOOK_PORT"      help:"The port the webhook server listens on."`
	MetricsPort     int `default:"8080" env:"METRICS_PORT"      help:"The port the metrics server listens on."`
	HealthProbePort int `default:"8081" env:"HEALTH_PROBE_PORT" help:"The port the health probe endpoint listens on."`

	TLSServerSecretName string `env:"TLS_SERVER_SECRET_NAME" help:"The name of the TLS Secret that will store Crossplane's server certificate."`
	TLSServerCertsDir   string `env:"TLS_SERVER_CERTS_DIR"   help:"The path of the folder which will store TLS server certificate of Crossplane."`
	TLSClientSecretName string `env:"TLS_CLIENT_SECRET_NAME" help:"The name of the TLS Secret that will be store Crossplane's client certificate."`
	TLSClientCertsDir   string `env:"TLS_CLIENT_CERTS_DIR"   help:"The path of the folder which will store TLS client certificate of Crossplane."`

	EnableDependencyVersionUpgrades   bool `group:"Alpha Features:" help:"Enable support for upgrading dependency versions when the parent package is updated."`
	EnableDependencyVersionDowngrades bool `group:"Alpha Features:" help:"Enable support for upgrading and downgrading dependency versions when a dependent package is updated."`
	EnableSignatureVerification       bool `group:"Alpha Features:" help:"Enable support for package signature verification via ImageConfig API."`
	EnableFunctionResponseCache       bool `group:"Alpha Features:" help:"Enable support for caching composition function responses."`
	EnableOperations                  bool `group:"Alpha Features:" help:"Enable support for Operations."`
	EnablePipelineInspector           bool `group:"Alpha Features:" help:"Enable support for emitting function pipeline execution data to a sidecar."`
	EnableProviderDeletionProtection  bool `group:"Alpha Features:" help:"Enable automatic protection of Providers from deletion when they have active managed resources. Requires --enable-usages."`
	EnablePipelineOCIReferences       bool `group:"Alpha Features:" help:"Enable support for referencing functions by OCI reference in Composition and Operation pipelines."`
	EnableCompositionRevisionGC       bool `group:"Alpha Features:" help:"Enable garbage collection of unused CompositionRevisions."`
	EnableFunctionControlledDeletion  bool `group:"Alpha Features:" help:"Enable support for Composition deletion policies (Background, Foreground, Pipeline), which control how a Composition's XRs are deleted."`

	XfnCacheDir             string        `default:"/cache/xfn"                         env:"XFN_CACHE_DIR"             group:"Alpha Features:" help:"Directory used for caching function responses. Requires --enable-function-response-cache."`
	XfnCacheMaxTTL          time.Duration `default:"24h"                                env:"XFN_CACHE_MAX_TTL"         group:"Alpha Features:" help:"Maximum TTL for cached function responses. Set to 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7921** (2026-10-22): **RBAC manager doesn't grant `/scale` for XRDs that declare a scale subresource**
  *Symptoms*: ### What happened? Since #7004, XRDs can declare a scale subresource, so I expected users with crossplane-edit/crossplane-admin to be able to `kubectl scale` an XR. I attempted to use `kubectl scale` on an XR and got the following error: ``` ➭ kubectl scale modeldeployment glm -n ml-team --replicas=0 Error from server (Forbidden): modeldeployments.modelplane.ai "glm" is forbidden: User "upbound:user:dalorion" cannot patch resource "modeldeployments/scale" in API group "modelplane.ai" in the namespace "ml-team" ➭ k auth can-i --list -n ml-team | grep -E 'Resources|modeldeployments' Resources                                                                                Non-Resource URLs   Resource Names   Verbs modeldeployments.modelplane.ai/status                                                    []                  []               [get list watch *] modeldeployments.modelplane.ai                                                           []                  []               [get list watch *] ``` However I was able to patch the resource and scale down just fine:  ``` kubectl patch modeldeployment glm -n ml-team --type merge -p '{"spec":{"replicas":0}}' ```  ### How can we reproduce it? 1. Create a kind cluster ``` ➭ export KUBECONFIG=~/.kube/kubeconfig-scale-rbac ➭ kind create cluster --name scale-rbac --kubeconfig "$KUBECONFIG" ... ➭ k auth whoami  ATTRIBUTE                                           VALUE Username                                            kubernetes-admin

- **Issue #7838** (2026-09-22): **Old revision not demoted for SA**
  *Symptoms*: ### What happened?  When trying to upgrade from v2.3.3 to v2.4.1, the functions and provider pods didn't start up. In all function/provider resources there are events messages like:  ```     Message:               Package runtime health is "False" with message: post establish runtime hook failed for package: cannot apply function package service account: ServiceAccount "function-sequencer" is invalid: metadata.ownerReferences: Invalid value: [{"apiVersion":"pkg.crossplane.io/v1","kind":"FunctionRevision","name":"function-sequencer-77518d1ebbf7","uid":"f866d50b-cddc-4fe6-90c2-462c76ac7cb9","controller":true,"blockOwnerDeletion":true},{"apiVersion":"pkg.crossplane.io/v1","kind":"FunctionRevision","name":"function-sequencer-bdbbc83b7f94","uid":"ca0276a5-0400-482e-972b-8333f8f093a7","controller":true,"blockOwnerDeletion":true}]: Only one reference can have Controller set to true. Found "true" in references for FunctionRevision/function-sequencer-77518d1ebbf7 and FunctionRevision/function-sequencer-bdbbc83b7f94 ```  SA already had old revision's `controller: true` ownerRef. New revision added another `controller: true`, which Kubernetes rejects.  ### How can we reproduce it?  Any 2.3.x to 2.4.x upgrade with running functions/providers should raise it.  ### What environment did it happen in? Crossplane version: v2.4.1 

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

### Incident Patch 1: `138fe3c6` (2026-10-05)
**Commit Message**: fix(pkg): link converted MRDs to the CRDs their package installed

Requiring an MRD to already own a CRD before it may update it blocked
the default upgrade from Crossplane v1. CRD-to-MRD conversion creates
each MRD from package content, but nothing linked it to the CRD the
provider had already installed, so every converted MRD stayed blocked
until an administrator added the owner reference by hand.

Have the establisher, which writes the MRD from package content, add the
MRD and the revision as owners of an existing CRD with the same name
when that CRD is already owned by the revision, its Provider, or the
MRD. Skip any other CRD and let the MRD controller block that MRD, so
one name collision doesn't fail the rest of the package. Leave the CRD's
controller and schema to the MRD controller, and use an optimistic lock
so a concurrent ownership change fails instead of being overwritten.
Watch MRDs so the revision reconciles again once its MRD exists, and
keep TypeMeta across typed creates so the status references used to
release control keep their kind.

Cover the ownership rules and a package with an unlinkable CRD in unit
tests, and add an opt-in API-server test that migrates a CR

**File**: `internal/controller/apiextensions/managed/migration_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+/*
+Copyright 2026 The Crossplane Authors.
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
+package managed
+
+import (
+	"context"
+	"slices"
+	"testing"
+	"time"
+
+	corev1 "k8s.io/api/core/v1"
+	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/util/wait"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
+
+	"github.com/crossplane/crossplane-runtime/v2/pkg/conditions"
+	"github.com/crossplane/crossplane-runtime/v2/pkg/event"
+	"github.com/crossplane/crossplane-runtime/v2/pkg/logging"
+	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
+
+	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
+	pkgv1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
+	"github.com/crossplane/crossplane/v2/internal/controller/pkg/revision"
+	"github.com/crossplane/crossplane/v2/internal/converter"
+	"github.com/crossplane/crossplane/v2/internal/ssa"
+)
+
+func TestPackageCRDMigration(t *testing.T) {
+	c := newMRDEnvtestClient(t)
+	ctx := context.Background()
+	ns := "crossplane-system"
+	if err := c.Create(ctx, &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: ns}}); err != nil {
+		t.Fatal(err)
+	}
+	if err := c.Create(ctx, &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "tls", Namespace: ns}, Data: map[string][]byte{"tls.crt": []byte("test-ca")}}); err != nil {
+		t.Fatal(err)
+	}
+	provider := metav1.OwnerReference{APIVersion: "pkg.crossplane.io/v1", Kind: "Provider", Name: "provider", UID: "provider-uid", Controller: new(true)}
+	old := &pkgv1.ProviderRevision{
+		TypeMeta:   metav1.TypeMeta{APIVersion: "pkg.crossplane.io/v1", Kind: "ProviderRevision"},
+		ObjectMeta: metav1.ObjectMeta{Name: "revision-old", UID: "revision-old-uid", Labels: map[string]string{pkgv1.LabelParentPackage: provider.Name}, OwnerReferences: []metav1.OwnerReference{provider}},
+		Status:     pkgv1.ProviderRevisionStatus{PackageRevisionRuntimeStatus: pkgv1.PackageRevisionRuntimeStatus{TLSServerSecretName: new("tls")}},
+	}
+	content := &extv1.CustomResourceDefinition{
+		TypeMeta:   metav1.TypeMeta{APIVersion: extv1.SchemeGroupVersion.String(), Kind: "CustomResourceDefinition"},
+		ObjectMeta: metav1.ObjectMeta{Name: "widgets.example.org"},
+		Spec: extv1.CustomResourceDefinitionSpec{
+			Group: "example.org", Scope: extv1.ClusterScoped, Names: extv1.CustomResourceDefinitionNames{Plural: "widgets", Kind: "Widget"},
+			Versions: []extv1.CustomResourceDefinitionVersion{{Name: "v1", Served: true, Storage: true, Schema: &extv1.CustomResourceValidation{OpenAPIV3Schema: &extv1.JSONSchemaProps{Type: "object", Properties: map[string]extv1.JSONSchemaProps{"obsolete": {Type: "string"}}}}}},
+		},
+	}
+	e := revision.NewAPIEstablisher(c, ns, func() pkgv1.PackageRevision { return &pkgv1.ProviderRevision{} }, 1)
+	// Install the CRD as older Crossplane versions did, before conversion.
+	if _, err := e.Establish(ctx, []runtime.Object{content.DeepCopy()}, old, true); err != nil {
+		t.Fatal(err)
+	}
+	crd := &extv1.CustomResourceDefinition{}
+	readCRD := func() {
+		t.Helper()
+		if err := c.Get(ctx, client.ObjectKey{Name: content.Name}, crd); err != nil {
+			t.Fatal(err)
+		}
+	}
+	readCRD()
+	originalUID := crd.UID
+	// A converted package revision changes the schema and creates its MRD.
+	content.Spec.Versions[0].Schema.OpenAPIV3Schema.Properties = map[string]extv1.JSONSchemaProps{"current": {Type: "string"}}
+	establish := func(pr *pkgv1.ProviderRevision) {
+		t.Helper()
+		if err := wait.PollUntilContextTimeout(ctx, 50*time.Millisecond, 10*time.Second, true, func(ctx context.Context) (bool, error) {
+			objects, err := converter.CustomToManagedResourceDefinitions(true, content.DeepCopy())
+			if err != nil {
+				return false, err
+			}
+			refs, err := e.Establish(ctx, objects, pr, true)
+			if kerrors.IsConflict(err) {
+				return false, nil
+			}
+			pr.SetObjects(refs)
+			return err == nil, err
+		}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	r := &Reconciler{client: c, managedFields: ssa.NewPatchingManagedFieldsUpgrader(c, ssa.ExactMatch(FieldOwnerMRD)), log: logging.NewNopLogger(), record: event.NewNopRecorder(), conditions: conditions.ObservedGenerationPropagationManager{}}
+	apply := func() {
+		t.Helper()
+		for range 3 {
+			if err := wait.PollUntilContextTimeout(ctx, 50*time.Millisecond, 10*time.Second,
```

**File**: `internal/controller/apiextensions/managed/ssa_test.go` (modified, +12/-5)
```diff
@@ -22,6 +22,7 @@ import (
 	"testing"
 	"time"
 
+	corev1 "k8s.io/api/core/v1"
 	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
@@ -39,10 +40,10 @@ import (
 	"github.com/crossplane/crossplane/v2/internal/ssa"
 )
 
-// TestCRDPrunesFieldsAfterCreate needs real managedFields and CRD merge semantics.
-// Set KUBEBUILDER_ASSETS to a directory containing kube-apiserver and etcd.
-// This is an opt-in local regression; CI does not currently provide the assets.
-func TestCRDPrunesFieldsAfterCreate(t *testing.T) {
+// newMRDEnvtestClient starts an isolated API server for opt-in local regressions.
+// CI does not currently provide KUBEBUILDER_ASSETS.
+func newMRDEnvtestClient(t *testing.T) client.Client {
+	t.Helper()
 	assets := os.Getenv("KUBEBUILDER_ASSETS")
 	if assets == "" {
 		t.Skip("set KUBEBUILDER_ASSETS to run the API-server regression")
@@ -61,7 +62,7 @@ func TestCRDPrunesFieldsAfterCreate(t *testing.T) {
 		}
 	})
 	scheme := runtime.NewScheme()
-	for _, add := range []func(*runtime.Scheme) error{extv1.AddToScheme, v1alpha1.AddToScheme} {
+	for _, add := range []func(*runtime.Scheme) error{corev1.AddToScheme, extv1.AddToScheme, v1alpha1.AddToScheme} {
 		if err := add(scheme); err != nil {
 			t.Fatal(err)
 		}
@@ -70,6 +71,12 @@ func TestCRDPrunesFieldsAfterCreate(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
+	return c
+}
+
+// TestCRDPrunesFieldsAfterCreate needs real managedFields and CRD merge semantics.
+func TestCRDPrunesFieldsAfterCreate(t *testing.T) {
+	c := newMRDEnvtestClient(t)
 	ctx := context.Background()
 	oldSchema := &v1alpha1.CustomResourceValidation{OpenAPIV3Schema: runtime.RawExtension{Raw: []byte(`{"type":"object","properties":{"spec":{"type":"object","properties":{"keep":{"type":"string"},"obsolete":{"type":"string"}}}}}`)}}
 	mrd := &v1alpha1.ManagedResourceDefinition{
```

**File**: `internal/controller/pkg/revision/establisher.go` (modified, +16/-16)
```diff
@@ -471,26 +471,21 @@ func (e *APIEstablisher) establish(ctx context.Context, allObjs []currentDesired
 	out := make(chan xpv2.TypedReference, len(allObjs))
 	for _, cd := range allObjs {
 		g.Go(func() error {
-			if !cd.Exists {
-				// Only create a missing resource if we are going to control it.
-				// This prevents an inactive revision from racing to create a
-				// resource before an active revision of the same parent.
-				if control {
-					if err := e.create(ctx, cd.Desired, parent); err != nil {
-						return err
-					}
+			if cd.Exists {
+				if err := e.update(ctx, cd.Current, cd.Desired, parent, control); err != nil {
+					return err
 				}
-
-				select {
-				case out <- *meta.TypedReferenceTo(cd.Desired, cd.Desired.GetObjectKind().GroupVersionKind()):
-					return nil
-				case <-ctx.Done():
-					return ctx.Err()
+			} else if control {
+				// Inactive revisions must not race to create missing resources.
+				if err := e.create(ctx, cd.Desired, parent); err != nil {
+					return err
 				}
 			}
 
-			if err := e.update(ctx, cd.Current, cd.Desired, parent, control); err != nil {
-				return err
+			if control {
+				if err := e.establishMRDCRDOwnership(ctx, cd.Desired, parent); err != nil {
+					return err
+				}
 			}
 
 			select {
@@ -517,6 +512,11 @@ func (e *APIEstablisher) establish(ctx context.Context, allObjs []currentDesired
 }
 
 func (e *APIEstablisher) create(ctx context.Context, obj resource.Object, parent resource.Object, opts ...client.CreateOption) error {
+	// Typed creates can clear TypeMeta. Preserve it for the status references
+	// used to release control when a revision is deactivated.
+	gvk := obj.GetObjectKind().GroupVersionKind()
+	defer obj.GetObjectKind().SetGroupVersionKind(gvk)
+
 	refs := []metav1.OwnerReference{
 		meta.AsController(meta.TypedReferenceTo(parent, parent.GetObjectKind().GroupVersionKind())),
 	}
```

**File**: `internal/controller/pkg/revision/establisher_test.go` (modified, +1/-1)
```diff
@@ -688,7 +688,7 @@ func TestAPIEstablisherEstablish(t *testing.T) {
 							}
 							return nil
 						}
-						return nil
+						return kerrors.NewNotFound(schema.GroupResource{}, obj.GetName())
 					},
 					MockUpdate: func(_ context.Context, obj client.Object, _ ...client.UpdateOption) error {
 						// Verify the merge logic for all combinations
```

**File**: `internal/controller/pkg/revision/migration.go` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+/*
+Copyright 2026 The Crossplane Authors.
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
+package revision
+
+import (
+	"context"
+
+	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+
+	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
+	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
+	"github.com/crossplane/crossplane-runtime/v2/pkg/resource"
+
+	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
+	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
+)
+
+// establishMRDCRDOwnership links an established package MRD to an existing CRD.
+// This runs after writing the MRD from package content. It skips a CRD it
+// can't link, leaving the MRD controller to block that MRD rather than
+// failing the rest of the package.
+func (e *APIEstablisher) establishMRDCRDOwnership(ctx context.Context, obj, parent client.Object) error {
+	mrd, ok := obj.(*v1alpha1.ManagedResourceDefinition)
+	if !ok {
+		return nil
+	}
+	pr, ok := parent.(*v1.ProviderRevision)
+	if !ok {
+		return nil
+	}
+
+	crd := &unstructured.Unstructured{}
+	crd.SetGroupVersionKind(extv1.SchemeGroupVersion.WithKind("CustomResourceDefinition"))
+	if err := e.client.Get(ctx, client.ObjectKey{Name: mrd.GetName()}, crd); err != nil {
+		return errors.Wrap(resource.IgnoreNotFound(err), "cannot get CRD for package MRD")
+	}
+	if mrd.GetUID() == "" || pr.GetUID() == "" {
+		return errors.New("cannot establish CRD ownership without MRD and ProviderRevision UIDs")
+	}
+	mrdRef := meta.AsOwner(meta.TypedReferenceTo(mrd, v1alpha1.ManagedResourceDefinitionGroupVersionKind))
+	prRef := meta.AsOwner(meta.TypedReferenceTo(pr, v1.ProviderRevisionGroupVersionKind))
+	// The Provider path lets revisions that replaced the CRD's original one
+	// adopt it.
+	provider := metav1.GetControllerOf(pr)
+	ownedByProvider := provider != nil &&
+		schema.FromAPIVersionAndKind(provider.APIVersion, provider.Kind).GroupKind() == v1.ProviderGroupVersionKind.GroupKind() &&
+		hasOwner(crd, *provider)
+	if !hasOwner(crd, mrdRef) && !hasOwner(crd, prRef) && !ownedByProvider {
+		return nil
+	}
+
+	before := crd.DeepCopy()
+	changed := false
+	for _, ref := range []metav1.OwnerReference{mrdRef, prRef} {
+		if !hasOwner(crd, ref) {
+			meta.AddOwnerReference(crd, ref)
+			changed = true
+		}
+	}
+	if !changed {
+		return nil
+	}
+	// The revision retains grants even while the MRD is inactive. Leave the
+	// CRD's current controller and schema to the MRD controller, and reject
+	// concurrent changes to the ownership we checked.
+	return errors.Wrap(e.client.Patch(ctx, crd, client.MergeFromWithOptions(before, client.MergeFromWithOptimisticLock{})), "cannot establish package MRD ownership of CRD")
+}
+
+func hasOwner(obj metav1.Object, want metav1.OwnerReference) bool {
+	if want.UID == "" {
+		return false
+	}
+	for _, ref := range obj.GetOwnerReferences() {
+		if ref.UID == want.UID && ref.Name == want.Name &&
+			schema.FromAPIVersionAndKind(ref.APIVersion, ref.Kind).GroupKind() == schema.FromAPIVersionAndKind(want.APIVersion, want.Kind).GroupKind() {
+			return true
+		}
+	}
+	return false
+}
```

**File**: `internal/controller/pkg/revision/migration_test.go` (added, +252/-0)
```diff
@@ -0,0 +1,252 @@
+/*
+Copyright 2026 The Crossplane Authors.
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
+package revision
+
+import (
+	"context"
+	"testing"
+
+	"github.com/google/go-cmp/cmp"
+	corev1 "k8s.io/api/core/v1"
+	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
+
+	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
+
+	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
+	xpv2 "github.com/crossplane/crossplane/apis/v2/core/v2"
+	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
+	"github.com/crossplane/crossplane/v2/internal/controller/rbac/grant"
+	"github.com/crossplane/crossplane/v2/internal/converter"
+)
+
+func TestEstablishConvertedCRDOwnership(t *testing.T) {
+	provider := metav1.OwnerReference{APIVersion: "pkg.crossplane.io/v1", Kind: "Provider", Name: "provider", UID: "provider-uid", Controller: new(true)}
+	revision := &v1.ProviderRevision{
+		TypeMeta:   metav1.TypeMeta{APIVersion: "pkg.crossplane.io/v1", Kind: "ProviderRevision"},
+		ObjectMeta: metav1.ObjectMeta{Name: "revision-new", UID: "revision-new-uid", Labels: map[string]string{v1.LabelParentPackage: provider.Name}, OwnerReferences: []metav1.OwnerReference{provider}},
+		Status:     v1.ProviderRevisionStatus{PackageRevisionRuntimeStatus: v1.PackageRevisionRuntimeStatus{TLSServerSecretName: new("tls")}},
+	}
+	oldRevision := meta.AsController(meta.TypedReferenceTo(revision, v1.ProviderRevisionGroupVersionKind))
+	oldRevision.Name = "revision-old"
+	oldRevision.UID = "revision-old-uid"
+	provider.Controller = new(false)
+	foreignUID := provider
+	foreignUID.UID = "foreign-uid"
+	foreignName := provider
+	foreignName.Name = "foreign-name"
+	foreignKind := provider
+	foreignKind.Kind = "Configuration"
+	foreignGroup := provider
+	foreignGroup.APIVersion = "foreign.example.org/v1"
+
+	for name, tc := range map[string]struct {
+		owners                                                                 []metav1.OwnerReference
+		inactiveRevision, inactiveMRD, statusOnly, absentCRD, race, failCreate bool
+		wantLink, wantError                                                    bool
+	}{
+		"LegacyProvider":                   {owners: []metav1.OwnerReference{provider, oldRevision}, wantLink: true},
+		"CurrentRevision":                  {owners: []metav1.OwnerReference{meta.AsController(meta.TypedReferenceTo(revision, v1.ProviderRevisionGroupVersionKind))}, wantLink: true},
+		"InactiveMRDRetainsRevisionGrants": {owners: []metav1.OwnerReference{provider, oldRevision}, inactiveMRD: true, wantLink: true},
+		"InactiveRevision":                 {owners: []metav1.OwnerReference{provider, oldRevision}, inactiveRevision: true},
+		"StatusOnly":                       {owners: []metav1.OwnerReference{provider, oldRevision}, statusOnly: true},
+		"NoExistingCRD":                    {absentCRD: true},
+		"UnownedCRD":                       {},
+		"ForeignUID":                       {owners: []metav1.OwnerReference{foreignUID}},
+		"ForeignName":                      {owners: []metav1.OwnerReference{foreignName}},
+		"ForeignKind":                      {owners: []metav1.OwnerReference{foreignKind}},
+		"ForeignGroup":                     {owners: []metav1.OwnerReference{foreignGroup}},
+		"OwnershipRace":                    {owners: []metav1.OwnerReference{provider, oldRevision}, race: true, wantError: true},
+		"FailedMRDCreate":                  {owners: []metav1.OwnerReference{provider, oldRevision}, failCreate: true, wantError: true},
+	} {
+		t.Run(name, func(t *testing.T) {
+			ctx := context.Background()
+			scheme := runtime.NewScheme()
+			for _, add := range []func(*runtime.Scheme) error{corev1.AddToScheme, extv1.AddToScheme, v1alpha1.AddToScheme, v1.AddToScheme} {
+				if err := add(scheme); err != nil {
+					t.Fatal(err)
+				}
+			}
+			content := &extv1.CustomResourceDefinition{
+				TypeMeta:   metav1.TypeMeta{APIVersion: extv1.SchemeGroupVersion.String(), Kind: "CustomResourceDefinition"},
+				ObjectMeta: metav1.ObjectMeta{Name: "widgets.example.org"},
+				Spec:       extv1.CustomResourceDefinitionSpec{Group: "example.org", Scope: extv1.ClusterSc
```

**File**: `internal/controller/pkg/revision/reconciler.go` (modified, +3/-0)
```diff
@@ -31,8 +31,10 @@ import (
 	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/utils/ptr"
 	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/builder"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/manager"
+	"sigs.k8s.io/controller-runtime/pkg/predicate"
 	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 
 	"github.com/crossplane/crossplane-runtime/v2/pkg/conditions"
@@ -231,6 +233,7 @@ func SetupProviderRevision(mgr ctrl.Manager, o controller.Options) error {
 		Named(name).
 		For(&v1.ProviderRevision{}).
 		Owns(&corev1.Secret{}). // Watch secret changes to react if pull or cert secrets change.
+		Owns(&extv1alpha1.ManagedResourceDefinition{}, builder.WithPredicates(predicate.GenerationChangedPredicate{})).
 		Watches(&v1beta1.Lock{}, EnqueuePackageRevisionsForLock(mgr.GetClient(), &v1.ProviderRevisionList{}, log)).
 		Watches(&v1beta1.ImageConfig{}, EnqueuePackageRevisionsForImageConfig(mgr.GetClient(), &v1.ProviderRevisionList{}, log))
 
```

---

### Incident Patch 2: `105f2a6d` (2026-09-08)
**Commit Message**: fix(managed): preserve apply ownership and retry CRD conflicts

Create CRDs with a distinct field manager so the existing upgrader
transfers create-time Update ownership to Apply. Otherwise an omitted
owner reference can remain co-owned: an API-server test reproduces a
failed revision handoff because both old and new controller references
survive.

Retry conflicts from managed-fields upgrades and CRD apply, and
concurrent create races, before emitting warnings or writing Blocked
conditions. Cover quiet retries and add an opt-in API-server test for
ownership transfer and field removal after create.

Clarify that MRD controller references provide attribution, improve
ownership errors, and report CRD discovery failures through XRD events.

Signed-off-by: Philippe Scorsolini <[REDACTED_EMAIL]>

**File**: `internal/controller/apiextensions/managed/crd.go` (modified, +1/-0)
```diff
@@ -99,6 +99,7 @@ func CRDAsUnstructured(mrd *v1alpha1.ManagedResourceDefinition) (*unstructured.U
 
 	// Add owner references
 	meta.AddOwnerReference(u, meta.AsOwner(meta.TypedReferenceTo(mrd, v1alpha1.ManagedResourceDefinitionGroupVersionKind)))
+	// This reference records the installing package.
 	if owner := metav1.GetControllerOf(mrd); owner != nil {
 		meta.AddOwnerReference(u, *owner)
 	}
```

**File**: `internal/controller/apiextensions/managed/ownership_test.go` (modified, +37/-7)
```diff
@@ -28,7 +28,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/reconcile"
 
 	"github.com/crossplane/crossplane-runtime/v2/pkg/conditions"
-	"github.com/crossplane/crossplane-runtime/v2/pkg/event"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/logging"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/test"
@@ -59,6 +58,7 @@ func TestReconcileCRDOwnership(t *testing.T) {
 		owners                []metav1.OwnerReference
 		installer             *metav1.OwnerReference
 		absent, allowed, race bool
+		upgradeRace           bool
 	}{
 		"Create":                 {absent: true, allowed: true},
 		"CreateRace":             {absent: true, allowed: true, race: true},
@@ -71,6 +71,7 @@ func TestReconcileCRDOwnership(t *testing.T) {
 		"WrongName":              {owners: []metav1.OwnerReference{wrongName}},
 		"WrongKind":              {owners: []metav1.OwnerReference{wrongKind}},
 		"ForeignInstaller":       {owners: []metav1.OwnerReference{foreign}, installer: &foreign},
+		"UpgradeRace":            {owners: []metav1.OwnerReference{mrdOwner}, allowed: true, upgradeRace: true},
 		"UpdateRace":             {owners: []metav1.OwnerReference{mrdOwner}, allowed: true, race: true},
 	} {
 		t.Run(name, func(t *testing.T) {
@@ -79,6 +80,8 @@ func TestReconcileCRDOwnership(t *testing.T) {
 				parent.OwnerReferences = []metav1.OwnerReference{*tc.installer}
 			}
 			writes := 0
+			statusUpdates := 0
+			recorder := &testRecorder{}
 			c := &test.MockClient{
 				MockGet: func(_ context.Context, _ client.ObjectKey, obj client.Object) error {
 					switch o := obj.(type) {
@@ -92,7 +95,11 @@ func TestReconcileCRDOwnership(t *testing.T) {
 					}
 					return nil
 				},
-				MockCreate: func(_ context.Context, _ client.Object, _ ...client.CreateOption) error {
+				MockCreate: func(_ context.Context, _ client.Object, opts ...client.CreateOption) error {
+					options := (&client.CreateOptions{}).ApplyOptions(opts)
+					if ssa.ExactMatch(FieldOwnerMRD)(options.FieldManager) {
+						t.Error("create manager must trigger the managed-fields upgrade")
+					}
 					writes++
 					if !tc.absent {
 						t.Error("must update an existing CRD")
@@ -115,15 +122,32 @@ func TestReconcileCRDOwnership(t *testing.T) {
 					}
 					return nil
 				},
-				MockStatusUpdate: test.NewMockSubResourceUpdateFn(nil),
+				MockStatusUpdate: func(_ context.Context, _ client.Object, _ ...client.SubResourceUpdateOption) error {
+					statusUpdates++
+					return nil
+				},
 			}
-			r := &Reconciler{client: c, managedFields: &ssa.NopManagedFieldsUpgrader{}, log: logging.NewNopLogger(), record: event.NewNopRecorder(), conditions: conditions.ObservedGenerationPropagationManager{}}
-			_, err := r.Reconcile(context.Background(), reconcile.Request{NamespacedName: client.ObjectKeyFromObject(parent)})
-			if got, want := err != nil, !tc.allowed || tc.race; got != want {
+			var upgrader ssa.ManagedFieldsUpgrader = &ssa.NopManagedFieldsUpgrader{}
+			if tc.upgradeRace {
+				upgrader = managedFieldsUpgradeFn(func(context.Context, client.Object) error {
+					return kerrors.NewConflict(schema.GroupResource{}, parent.Name, nil)
+				})
+			}
+			r := &Reconciler{client: c, managedFields: upgrader, log: logging.NewNopLogger(), record: recorder, conditions: conditions.ObservedGenerationPropagationManager{}}
+			result, err := r.Reconcile(context.Background(), reconcile.Request{NamespacedName: client.ObjectKeyFromObject(parent)})
+			if got, want := err != nil, !tc.allowed; got != want {
 				t.Errorf("error = %v, want error %v", err, want)
 			}
+			retry := tc.race || tc.upgradeRace
+			wantResult := reconcile.Result{Requeue: retry}
+			if result != wantResult {
+				t.Errorf("result = %v, want %v", result, wantResult)
+			}
+			if retry && (len(recorder.events) != 0 || statusUpdates != 0) {
+				t.Errorf("retry emitted %d events and %d status updates", len(recorder.events), statusUpdates)
+			}
 			wantWrites := 0
-			if tc.allowed {
+			if tc.allowed && !tc.upgradeRace {
 				wantWrites = 1
 			}
 			if writes != wantWrites {
@@ -132,3 +156,9 @@ func TestReconcileCRDOwnership(t *testing.T) {
 		})
 	}
 }
+
+type managedFieldsUpgradeFn func(context.Context, client.Object) error
+
+func (fn managedFieldsUpgradeFn) Upgrade(ctx context.Context, obj client.Object) error {
+	return fn(ctx, obj)
+}
```

**File**: `internal/controller/apiextensions/managed/reconciler.go` (modified, +12/-1)
```diff
@@ -22,6 +22,7 @@ import (
 	"time"
 
 	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	kunstructured "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
 	"k8s.io/apimachinery/pkg/runtime"
@@ -155,6 +156,9 @@ func (r *Reconciler) Reconcile(ogctx context.Context, req reconcile.Request) (re
 	// apply. This is necessary when a CRD was previously managed using
 	// client-side apply, but should now be managed using server-side apply.
 	if err := r.managedFields.Upgrade(ctx, crd); err != nil {
+		if kerrors.IsConflict(err) {
+			return reconcile.Result{Requeue: true}, nil
+		}
 		log.Debug("cannot upgrade managed fields", "error", err)
 		r.record.Event(mrd, event.Warning(reasonReconcile, err))
 		status.MarkConditions(v1alpha1.BlockedManaged().WithMessage("unable to upgrade managed fields, see events"))
@@ -188,13 +192,20 @@ func (r *Reconciler) Reconcile(ogctx context.Context, req reconcile.Request) (re
 	// pin apply to the resource version whose ownership we checked. Upgrade
 	// refreshes that version if it patches managed fields.
 	if getErr != nil {
-		err = r.client.Create(ctx, patch, client.FieldOwner(FieldOwnerMRD))
+		// A distinct create manager lets the upgrader transfer its Update
+		// ownership to Apply. Otherwise omitted fields can remain co-owned.
+		err = r.client.Create(ctx, patch, client.FieldOwner(FieldOwnerMRD+"/create"))
 	} else {
 		patch.SetResourceVersion(crd.GetResourceVersion())
 		//nolint:staticcheck // TODO(adamwg): Stop using client.Apply after the v2.2 release.
 		err = r.client.Patch(ctx, patch, client.Apply, client.ForceOwnership, client.FieldOwner(FieldOwnerMRD))
 	}
 	if err != nil {
+		// Cached reads may trail CRD status updates or concurrent creation.
+		// Retry without replacing healthy conditions or emitting warnings.
+		if kerrors.IsConflict(err) || kerrors.IsAlreadyExists(err) {
+			return reconcile.Result{Requeue: true}, nil
+		}
 		log.Debug("cannot apply CustomResourceDefinition", "error", err)
 		r.record.Event(mrd, event.Warning(reasonApplyCRD, err))
 		status.MarkConditions(v1alpha1.BlockedManaged().WithMessage("unable to apply CustomResourceDefinition, see events"))
```

**File**: `internal/controller/apiextensions/managed/ssa_test.go` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+/*
+Copyright 2026 The Crossplane Authors.
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
+package managed
+
+import (
+	"context"
+	"os"
+	"testing"
+	"time"
+
+	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/util/wait"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/envtest"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
+
+	"github.com/crossplane/crossplane-runtime/v2/pkg/conditions"
+	"github.com/crossplane/crossplane-runtime/v2/pkg/event"
+	"github.com/crossplane/crossplane-runtime/v2/pkg/logging"
+
+	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
+	"github.com/crossplane/crossplane/v2/internal/ssa"
+)
+
+// TestCRDPrunesFieldsAfterCreate needs real managedFields and CRD merge semantics.
+// Set KUBEBUILDER_ASSETS to a directory containing kube-apiserver and etcd.
+func TestCRDPrunesFieldsAfterCreate(t *testing.T) {
+	assets := os.Getenv("KUBEBUILDER_ASSETS")
+	if assets == "" {
+		t.Skip("set KUBEBUILDER_ASSETS to run the API-server regression")
+	}
+	env := &envtest.Environment{
+		UseExistingCluster: new(false), BinaryAssetsDirectory: assets,
+		CRDDirectoryPaths: []string{"../../../../cluster/crds/apiextensions.crossplane.io_managedresourcedefinitions.yaml"}, ErrorIfCRDPathMissing: true,
+	}
+	cfg, err := env.Start()
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() {
+		if err := env.Stop(); err != nil {
+			t.Error(err)
+		}
+	})
+	scheme := runtime.NewScheme()
+	for _, add := range []func(*runtime.Scheme) error{extv1.AddToScheme, v1alpha1.AddToScheme} {
+		if err := add(scheme); err != nil {
+			t.Fatal(err)
+		}
+	}
+	c, err := client.New(cfg, client.Options{Scheme: scheme})
+	if err != nil {
+		t.Fatal(err)
+	}
+	ctx := context.Background()
+	oldSchema := &v1alpha1.CustomResourceValidation{OpenAPIV3Schema: runtime.RawExtension{Raw: []byte(`{"type":"object","properties":{"spec":{"type":"object","properties":{"keep":{"type":"string"},"obsolete":{"type":"string"}}}}}`)}}
+	mrd := &v1alpha1.ManagedResourceDefinition{
+		ObjectMeta: metav1.ObjectMeta{Name: "widgets.example.org", OwnerReferences: []metav1.OwnerReference{{
+			APIVersion: "pkg.crossplane.io/v1", Kind: "ProviderRevision", Name: "provider-old", UID: "provider-old-uid", Controller: new(true),
+		}}},
+		Spec: v1alpha1.ManagedResourceDefinitionSpec{
+			State: v1alpha1.ManagedResourceDefinitionActive,
+			CustomResourceDefinitionSpec: v1alpha1.CustomResourceDefinitionSpec{
+				Group: "example.org", Scope: extv1.ClusterScoped,
+				Names: extv1.CustomResourceDefinitionNames{Kind: "Widget", Plural: "widgets"},
+				Versions: []v1alpha1.CustomResourceDefinitionVersion{
+					{Name: "v1beta1", Served: true, Schema: oldSchema},
+					{Name: "v1", Served: true, Storage: true, Schema: oldSchema, AdditionalPrinterColumns: []extv1.CustomResourceColumnDefinition{{Name: "Obsolete", Type: "string", JSONPath: ".spec.obsolete"}}},
+				},
+			},
+		},
+	}
+	if err := c.Create(ctx, mrd); err != nil {
+		t.Fatal(err)
+	}
+	r := &Reconciler{
+		client: c, managedFields: ssa.NewPatchingManagedFieldsUpgrader(c, ssa.ExactMatch(FieldOwnerMRD)),
+		log: logging.NewNopLogger(), record: event.NewNopRecorder(), conditions: conditions.ObservedGenerationPropagationManager{},
+	}
+	reconcileOnce := func() {
+		t.Helper()
+		if err := wait.PollUntilContextTimeout(ctx, 50*time.Millisecond, 10*time.Second, true, func(ctx context.Context) (bool, error) {
+			result, err := r.Reconcile(ctx, reconcile.Request{NamespacedName: client.ObjectKeyFromObject(mrd)})
+			if kerrors.IsConflict(err) {
+				return false, nil
+			}
+			return result == (reconcile.Result{}), err
+		}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	// Create, transfer fields to apply, and finish the managed-fields upgrade.
+	for range 3 {
+		reconcileOnce()
+	}
+	if err := c.Get(ctx, client.ObjectKeyFromObject(mrd), mrd); err != nil {
+		t.Fatal(err)
+	}
+	mrd.OwnerReferences[0].Name = "provider-new"
+	mrd.OwnerReferences[0].UID = "provider-new-uid"
+	mrd.Spec.Versions = []v1alpha1.CustomResourceDefinitionVersion{{
+		Name: "v1", Served: true, Storage: true,
+		Schema: &v1alpha1.CustomResourceValidation{OpenAPIV3Schema: runtime.RawExtension{Raw: []byte(`{"type":"object","properties":{"spec":{"type":"object","properties":{"keep":{"type":"string"}}}}}`)}},
+	}}
+	if e
```

**File**: `internal/controller/apiextensions/ownership/ownership.go` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ func MustBeControlledBy(owner metav1.Object) resource.ApplyOption {
 			return err
 		}
 		if owner.GetUID() == "" || !metav1.IsControlledBy(m, owner) {
-			return errors.New("CustomResourceDefinition is not controlled by this CompositeResourceDefinition")
+			return errors.Errorf("CustomResourceDefinition %q is not controlled by %q (UID %q)", m.GetName(), owner.GetName(), owner.GetUID())
 		}
 		return nil
 	}
```

**File**: `internal/controller/rbac/definition/reconciler.go` (modified, +2/-0)
```diff
@@ -184,6 +184,8 @@ func (r *Reconciler) Reconcile(ctx context.Context, req reconcile.Request) (reco
 
 	crds, err := grant.OwnedCRDs(ctx, r.client, d, v1.CompositeResourceDefinitionGroupVersionKind.GroupKind())
 	if err != nil {
+		log.Debug("Cannot discover owned CustomResourceDefinitions", "error", err)
+		r.record.Event(d, event.Warning(reasonApplyRoles, err))
 		return reconcile.Result{}, err
 	}
 	names := make(map[string]bool, len(crds))
```

**File**: `internal/controller/rbac/grant/grant.go` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ func Permitted(group, plural string) bool {
 		return false
 	}
 
+	// Groups under k8s.io are reserved for Kubernetes APIs.
 	if group == "k8s.io" || strings.HasSuffix(group, ".k8s.io") {
 		return false
 	}
```

---

### Incident Patch 3: `a1749f0a` (2026-09-08)
**Commit Message**: fix(rbac): require exact MRD ownership and preserve fixed grants

Require an existing CRD to reference the exact MRD before the MRD
controller updates it. Remove both migration exceptions; normal handoff
of an existing MRD remains supported.

Preserve fixed provider startup and SafeStart permissions when no CRDs
qualify. Revoke composite and claim grants independently, and retry
discovery conflicts before recording warning events.

Cover owner reference mismatches, startup permissions, claim survival and
quiet retries. Clarify the generic ownership helper and document that
the SSA API-server test is opt-in locally and skipped by current CI.

Signed-off-by: Philippe Scorsolini <[REDACTED_EMAIL]>

**File**: `internal/controller/apiextensions/managed/crd.go` (modified, +3/-25)
```diff
@@ -30,7 +30,6 @@ import (
 	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
 
 	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
-	pkgv1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
 )
 
 // CRDAsUnstructured builds an Unstructured CRD from an MRD.
@@ -152,34 +151,13 @@ func buildVersion(version v1alpha1.CustomResourceDefinitionVersion) (map[string]
 	return p.UnstructuredContent(), nil
 }
 
-// mayApplyTo permits updates to CRDs already owned by this MRD, or by its
-// installing ProviderRevision or Provider when migrating a directly installed
-// CRD to an MRD, including migration during a revision upgrade.
-// An editable MRD must not establish ownership of an unrelated existing CRD.
+// mayApplyTo permits updates only to CRDs already owned by this MRD.
 func mayApplyTo(mrd *v1alpha1.ManagedResourceDefinition, crd metav1.Object) bool {
-	installer := metav1.GetControllerOf(mrd)
 	for _, owner := range crd.GetOwnerReferences() {
-		if owner.UID == "" {
-			continue
-		}
-		gk := schema.FromAPIVersionAndKind(owner.APIVersion, owner.Kind).GroupKind()
-		if owner.UID == mrd.GetUID() && owner.Name == mrd.GetName() && gk == v1alpha1.ManagedResourceDefinitionGroupVersionKind.GroupKind() {
-			return true
-		}
-		if installer != nil && owner.UID == installer.UID && owner.Name == installer.Name &&
-			gk == pkgv1.ProviderRevisionGroupVersionKind.GroupKind() &&
-			schema.FromAPIVersionAndKind(installer.APIVersion, installer.Kind).GroupKind() == gk {
+		if owner.UID != "" && owner.UID == mrd.GetUID() && owner.Name == mrd.GetName() &&
+			schema.FromAPIVersionAndKind(owner.APIVersion, owner.Kind).GroupKind() == v1alpha1.ManagedResourceDefinitionGroupVersionKind.GroupKind() {
 			return true
 		}
-		// The stable Provider owner survives revision changes. Only accept this
-		// package kind, never an arbitrary owner copied onto an editable MRD.
-		if gk == pkgv1.ProviderGroupVersionKind.GroupKind() {
-			for _, parent := range mrd.GetOwnerReferences() {
-				if parent.UID == owner.UID && parent.Name == owner.Name && schema.FromAPIVersionAndKind(parent.APIVersion, parent.Kind).GroupKind() == gk {
-					return true
-				}
-			}
-		}
 	}
 	return false
 }
```

**File**: `internal/controller/apiextensions/managed/ownership_test.go` (modified, +26/-18)
```diff
@@ -54,32 +54,36 @@ func TestReconcileCRDOwnership(t *testing.T) {
 	oldInstaller.UID = "old-revision-uid"
 	foreign := installer
 	foreign.Kind = "UnrelatedController"
+	// Only the CRD's reference to this MRD allows an existing CRD to be
+	// updated.
 	for name, tc := range map[string]struct {
 		owners                []metav1.OwnerReference
 		installer             *metav1.OwnerReference
 		absent, allowed, race bool
 		upgradeRace           bool
 	}{
-		"Create":                 {absent: true, allowed: true},
-		"CreateRace":             {absent: true, allowed: true, race: true},
-		"Unowned":                {},
-		"OwnedByMRD":             {owners: []metav1.OwnerReference{mrdOwner}, allowed: true},
-		"RevisionHandoff":        {owners: []metav1.OwnerReference{mrdOwner, foreign}, allowed: true},
-		"MigrateDirectCRD":       {owners: []metav1.OwnerReference{installer}, allowed: true},
-		"MigrateAcrossRevisions": {owners: []metav1.OwnerReference{provider, oldInstaller}, allowed: true},
-		"WrongUID":               {owners: []metav1.OwnerReference{wrongUID}},
-		"WrongName":              {owners: []metav1.OwnerReference{wrongName}},
-		"WrongKind":              {owners: []metav1.OwnerReference{wrongKind}},
-		"ForeignInstaller":       {owners: []metav1.OwnerReference{foreign}, installer: &foreign},
-		"UpgradeRace":            {owners: []metav1.OwnerReference{mrdOwner}, allowed: true, upgradeRace: true},
-		"UpdateRace":             {owners: []metav1.OwnerReference{mrdOwner}, allowed: true, race: true},
+		"Create":                            {absent: true, allowed: true},
+		"CreateRace":                        {absent: true, allowed: true, race: true},
+		"Unowned":                           {},
+		"OwnedByMRD":                        {owners: []metav1.OwnerReference{mrdOwner}, allowed: true},
+		"RevisionHandoff":                   {owners: []metav1.OwnerReference{mrdOwner, foreign}, allowed: true},
+		"InstallerReferenceOnly":            {owners: []metav1.OwnerReference{installer}},
+		"ProviderReferenceOnly":             {owners: []metav1.OwnerReference{provider, oldInstaller}},
+		"ProviderReferenceWithoutInstaller": {owners: []metav1.OwnerReference{provider, oldInstaller}, installer: &provider},
+		"WrongUID":                          {owners: []metav1.OwnerReference{wrongUID}},
+		"WrongName":                         {owners: []metav1.OwnerReference{wrongName}},
+		"WrongKind":                         {owners: []metav1.OwnerReference{wrongKind}},
+		"ForeignInstaller":                  {owners: []metav1.OwnerReference{foreign}, installer: &foreign},
+		"UpgradeRace":                       {owners: []metav1.OwnerReference{mrdOwner}, allowed: true, upgradeRace: true},
+		"UpdateRace":                        {owners: []metav1.OwnerReference{mrdOwner}, allowed: true, race: true},
 	} {
 		t.Run(name, func(t *testing.T) {
 			parent := mrd.DeepCopy()
 			if tc.installer != nil {
 				parent.OwnerReferences = []metav1.OwnerReference{*tc.installer}
 			}
 			writes := 0
+			upgrades := 0
 			statusUpdates := 0
 			recorder := &testRecorder{}
 			c := &test.MockClient{
@@ -127,12 +131,13 @@ func TestReconcileCRDOwnership(t *testing.T) {
 					return nil
 				},
 			}
-			var upgrader ssa.ManagedFieldsUpgrader = &ssa.NopManagedFieldsUpgrader{}
-			if tc.upgradeRace {
-				upgrader = managedFieldsUpgradeFn(func(context.Context, client.Object) error {
+			upgrader := managedFieldsUpgradeFn(func(context.Context, client.Object) error {
+				upgrades++
+				if tc.upgradeRace {
 					return kerrors.NewConflict(schema.GroupResource{}, parent.Name, nil)
-				})
-			}
+				}
+				return nil
+			})
 			r := &Reconciler{client: c, managedFields: upgrader, log: logging.NewNopLogger(), record: recorder, conditions: conditions.ObservedGenerationPropagationManager{}}
 			result, err := r.Reconcile(context.Background(), reconcile.Request{NamespacedName: client.ObjectKeyFromObject(parent)})
 			if got, want := err != nil, !tc.allowed; got != want {
@@ -153,6 +158,9 @@ func TestReconcileCRDOwnership(t *testing.T) {
 			if writes != wantWrites {
 				t.Errorf("CRD writes = %d, want %d", writes, wantWrites)
 			}
+			if !tc.allowed && upgrades != 0 {
+				t.Errorf("upgraded managed fields %d times before rejecting ownership", upgrades)
+			}
 		})
 	}
 }
```

**File**: `internal/controller/apiextensions/managed/reconciler.go` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ func (r *Reconciler) Reconcile(ogctx context.Context, req reconcile.Request) (re
 	}
 
 	if getErr == nil && !mayApplyTo(mrd, crd) {
-		err := errors.New("CustomResourceDefinition is not owned by this ManagedResourceDefinition or its installing package")
+		err := errors.New("CustomResourceDefinition is not owned by this ManagedResourceDefinition")
 		r.record.Event(mrd, event.Warning(reasonApplyCRD, err))
 		status.MarkConditions(v1alpha1.BlockedManaged().WithMessage(err.Error()))
 		_ = r.client.Status().Update(ogctx, mrd)
```

**File**: `internal/controller/apiextensions/managed/ssa_test.go` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ import (
 
 // TestCRDPrunesFieldsAfterCreate needs real managedFields and CRD merge semantics.
 // Set KUBEBUILDER_ASSETS to a directory containing kube-apiserver and etcd.
+// This is an opt-in local regression; CI does not currently provide the assets.
 func TestCRDPrunesFieldsAfterCreate(t *testing.T) {
 	assets := os.Getenv("KUBEBUILDER_ASSETS")
 	if assets == "" {
```

**File**: `internal/controller/apiextensions/ownership/ownership.go` (modified, +5/-5)
```diff
@@ -14,7 +14,7 @@ See the License for the specific language governing permissions and
 limitations under the License.
 */
 
-// Package ownership protects CRDs from adoption by editable definitions.
+// Package ownership provides apply options that require existing ownership.
 package ownership
 
 import (
@@ -28,17 +28,17 @@ import (
 	"github.com/crossplane/crossplane-runtime/v2/pkg/resource"
 )
 
-// MustBeControlledBy requires an existing CRD to already be controlled by owner.
-// New CRDs are created separately by the applicator. Unlike controllability,
-// existing control does not permit adoption of unrelated, uncontrolled CRDs.
+// MustBeControlledBy requires the current object's controller reference to match
+// owner's non-empty UID. Objects with no controller reference are rejected.
+// The applicator creates new objects without calling this option.
 func MustBeControlledBy(owner metav1.Object) resource.ApplyOption {
 	return func(_ context.Context, current, _ runtime.Object) error {
 		m, err := meta.Accessor(current)
 		if err != nil {
 			return err
 		}
 		if owner.GetUID() == "" || !metav1.IsControlledBy(m, owner) {
-			return errors.Errorf("CustomResourceDefinition %q is not controlled by %q (UID %q)", m.GetName(), owner.GetName(), owner.GetUID())
+			return errors.Errorf("existing object %q is not controlled by %q (UID %q)", m.GetName(), owner.GetName(), owner.GetUID())
 		}
 		return nil
 	}
```

**File**: `internal/controller/rbac/definition/reconciler.go` (modified, +2/-2)
```diff
@@ -192,8 +192,8 @@ func (r *Reconciler) Reconcile(ctx context.Context, req reconcile.Request) (reco
 	for _, crd := range crds {
 		names[crd.Name] = true
 	}
-	// Render only resources backed by CRDs this XRD actually owns. Keeping
-	// the original identity allows empty roles to revoke stale permissions.
+	// Check composite and claim CRDs independently so loss of one revokes
+	// only its grants. Keep the XRD identity to update existing roles.
 	desired := d.DeepCopy()
 	if !names[d.Spec.Names.Plural+"."+d.Spec.Group] {
 		desired.Spec.Names.Plural = ""
```

**File**: `internal/controller/rbac/definition/roles.go` (modified, +10/-10)
```diff
@@ -167,6 +167,14 @@ func RenderClusterRoles(d *v1.CompositeResourceDefinition) []rbacv1.ClusterRole
 		})
 	}
 
+	if !grant.Permitted(d.Spec.Group, d.Spec.Names.Plural) {
+		// Clear composite grants independently; an owned claim CRD can remain
+		// available while its composite CRD is absent.
+		for _, role := range []*rbacv1.ClusterRole{system, edit, view, browse} {
+			role.Rules = nil
+		}
+	}
+
 	if d.Spec.ClaimNames != nil && grant.Permitted(d.Spec.Group, d.Spec.ClaimNames.Plural) {
 		system.Rules = append(system.Rules, rbacv1.PolicyRule{
 			APIGroups: []string{d.Spec.Group},
@@ -220,16 +228,8 @@ func RenderClusterRoles(d *v1.CompositeResourceDefinition) []rbacv1.ClusterRole
 		meta.AddOwnerReference(o, meta.AsController(meta.TypedReferenceTo(d, v1.CompositeResourceDefinitionGroupVersionKind)))
 	}
 
-	roles := []rbacv1.ClusterRole{*system, *edit, *view, *browse}
-	if !grant.Permitted(d.Spec.Group, d.Spec.Names.Plural) {
-		// Keep the roles and their ownership so reconciliation replaces any
-		// previously granted rules with empty rules, including after upgrade.
-		for i := range roles {
-			roles[i].Rules = nil
-		}
-	}
-
-	return roles
+	// Keep empty roles to revoke previously granted rules during reconciliation.
+	return []rbacv1.ClusterRole{*system, *edit, *view, *browse}
 }
 
 func servesScale(d *v1.CompositeResourceDefinition) bool {
```

**File**: `internal/controller/rbac/provider/roles/reconciler.go` (modified, +3/-0)
```diff
@@ -228,6 +228,9 @@ func (r *Reconciler) Reconcile(ctx context.Context, req reconcile.Request) (reco
 
 	resources, err := r.definedResources(ctx, pr)
 	if err != nil {
+		if kerrors.IsConflict(err) {
+			return reconcile.Result{Requeue: true}, nil
+		}
 		r.record.Event(pr, event.Warning(reasonApplyRoles, err))
 		return reconcile.Result{}, err
 	}
```

#### Recent Merged Pull Requests:
- **PR #8061** (2026-11-18): [Backport release-2.2] fix(rbac): derive generated roles from owned CRDs (@phisco)
- **PR #8060** (2026-11-17): [Backport release-2.2] fix(rbac): limit provider Deployment discovery to runtime namespace (@phisco)
- **PR #8059** (2026-11-18): [Backport release-2.4] fix(rbac): derive generated roles from owned CRDs (@github-actions[bot])
- **PR #8058** (2026-11-18): [Backport release-2.3] fix(rbac): derive generated roles from owned CRDs (@github-actions[bot])
- **PR #8057** (2026-11-18): [Backport release-2.4] fix(rbac): limit provider Deployment discovery to runtime namespace (@github-actions[bot])
- **PR #8056** (2026-11-18): [Backport release-2.3] fix(rbac): limit provider Deployment discovery to runtime namespace (@github-actions[bot])

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

## X. pkg): link converted MRDs to the CRDs their package installed

**RULE**:
When implementing operations in `internal/controller/apiextensions/managed/migration_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in crossplane/crossplane. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `138fe3c6`: pkg): link converted MRDs to the CRDs their package installed. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/controller/apiextensions/managed/migration_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
/*
Copyright 2026 The Crossplane Authors.

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

package managed

import (
	"context"
	"slices"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	extv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"github.com/crossplane/crossplane-runtime/v2/pkg/conditions"
	"github.com/crossplane/crossplane-runtime/v2/pkg/event"
	"github.com/crossplane/crossplane-runtime/v2/pkg/logging"
	"github.com/crossplane/crossp
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `138fe3c6` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
