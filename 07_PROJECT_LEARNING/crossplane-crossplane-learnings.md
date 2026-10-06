# Forensic Learning Record (Deep Inspection): crossplane/crossplane

> **Canonical Artifact**: `07_PROJECT_LEARNING/crossplane-crossplane-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crossplane/crossplane](https://github.com/crossplane/crossplane))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:03:07.118Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crossplane/crossplane`
- **Description**: The Cloud Native Control Plane
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12133 stars

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

	XfnCacheDir             string        `default:"/cache/xfn"                         env:"XFN_CACHE_DIR"             group:"Alpha Features:" help:"Directory used for caching function responses. Requires --enable-function-response-cache."`
	XfnCacheMaxTTL          time.Duration `default:"24h"                                env:"XFN_CACHE_MAX_TTL"         group:"Alpha Features:" help:"Maximum TTL for cached function responses. Set to 0 to disable. Requires --enable-function-response-cache."`
	PipelineInspectorSocket string        `default:"/var/run/pipeline-inspector/socket" env:"PIPELINE_INSPECTOR_SOCKET" group:"Alpha Features:" help:"Unix socket path for pipeline inspector sidecar. Requires --enable-pipeline-inspector."`

	EnableDeploymentRuntimeConfigs          bool `default:"true" group:"Beta Features:" help:"Enable support for Deployment Runtime Configs."`
	EnableUsages                            bool `default:"true" env:"ENABLE_USAGES"    group:"Beta Features:"                                                                                                                    
```

### Core Architecture Module: `cmd/crossplane/core/init.go`
```
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

package core

import (
	"context"
	"fmt"

	admv1 "k8s.io/api/admissionregistration/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
	"github.com/crossplane/crossplane-runtime/v2/pkg/logging"

	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
	"github.com/crossplane/crossplane/v2/internal/initializer"
)

// initCommand configuration for the initialization of core Crossplane controllers.
type initCommand struct {
	Providers      []string                    `help:"Pre-install a Provider by giving its image URI. This argument can be repeated."                                            name:"provider"`
	Configurations []string                    `help:"Pre-install a Configuration by giving its image URI. This argument can be repeated."                                       name:"configuration"`
	Functions      []string                    `help:"Pre-install a Function by giving its image URI. This argument can be repeated."                                            name:"function"`
	Activations    []v1alpha1.ActivationPolicy `help:"Pre-install a default managed resource activation policy by providing activations entries. This argument can be repeated." name:"activation"`

	Namespace                 string `default:"crossplane-system"      env:"POD_NAMESPACE"        help:"Namespace used to set as default scope in default secret store config." short:"n"`
	ServiceAccount            string `default:"crossplane"             env:"POD_SERVICE_ACCOUNT"  help:"Name of the Crossplane Service Account."`
	CRDsPath                  string `default:"/crds"                  env:"CRDS_PATH"            help:"Path of Crossplane core Custom Resource Definitions."`
	WebhookConfigurationsPath string `default:"/webhookconfigurations" env:"WEBHOOK_CONFIGS_PATH" help:"Path of Crossplane core Webhook Configurations."`

	EnableWebhooks bool `aliases:"webhook-enabled" default:"true" env:"ENABLE_WEBHOOKS,WEBHOOK_ENABLED" help:"Enable webhook configuration."`

	EnableUsages              bool   `default:"true" env:"ENABLE_USAGES" group:"Beta Features:"             help:"Enable support for deletion ordering and resource protection with Usages. When disabled, the Usage deletion protection webhook configuration is not installed and any existing one is removed."`
	UsageWebhookFailurePolicy string `default:"Fail" enum:"Fail,Ignore"  env:"USAGE_WEBHOOK_FAILURE_POLICY" help:"The failurePolicy of the Usage deletion protection webhook. Set to Ignore for compatibility with managed Kubernetes operations that reject Fail-policy webhooks with wildcard rules."`

	WebhookServiceName      string `env:"WEBHOOK_SERVICE_NAME"      help:"The name of the Service object that the webhook service will be run."`
	WebhookServiceNamespace string `env:"WEBHOOK_SERVICE_NAMESPACE" help:"The namespace of the Service object that the webhook service will be run."`
	WebhookServicePort      int32  `env:"WEBHOOK_SERVICE_PORT"      help:"The port of the Service that the webhook service will be run."`
	TLSCASecretName         string `env:"TLS_CA_SECRET_NAME"        help:"The name of the Secret that the initializer will fill with TLS CA certificate."`
	TLSServerSecretName     string `env:"TLS_SERVER_SECRET_NAME"    help:"The name of the Secret that the initializer will fill with TLS server certificates."`
	TLSClientSecretName     string `env:"TLS_CLIENT_SECRET_NAME"    help:"The name of the Secret that the initializer will fill with TLS client certificates."`
}

// Run starts the initialization process.
func (c *initCommand) Run(s *runtime.Scheme, log logging.Logger) error {
	cfg, err := ctrl.GetConfig()
	if err != nil {
		return errors.Wrap(err, "cannot get config")
	}

	cl, err := client.New(cfg, client.Options{Scheme: s})
	if err != nil {
		return errors.Wrap(err, "cannot create new kubernetes client")
	}

	var steps []initializer.Step

	tlsGeneratorOpts := []initializer.TLSCertificateGeneratorOption{
		initializer.TLSCertificateGeneratorWithClientSecretName(c.TLSClientSecretName, []string{fmt.Sprintf("%s.%s", c.ServiceAccount, c.Namespace)}),
		initializer.TLSCertificateGeneratorWithLogger(log.WithValues("Step", "TLSCertificateGenerator")),
	}
	if c.EnableWebhooks {
		tlsGeneratorOpts = append(tlsGeneratorOpts,
			initializer.TLSCertificateGeneratorWithServerSecretName(c.TLSServerSecretName, initializer.DNSNamesForService(c.WebhookServiceName, c.WebhookServiceNamespace)))
	}

	steps = append(steps,
		initializer.NewTLSCertificateGenerator(c.Namespace, c.TLSCASecretName, tlsGeneratorOpts...),
	)

	if c.EnableWebhooks {
		// Crossplane used to serve these webhooks, but now uses CEL validation.
		steps = append(steps,
			initializer.NewValidatingWebhookRemover("crossplane",
				"compositeresourcedefinitions.apiextensions.crossplane.io",
				"compositions.apiextensions.crossplane.io",
			),
		)

		const (
			usageWebhookConfigName = "crossplane-no-usages"
			usageWebhookName       = "nousages.protection.crossplane.io"
		)

		var whOpts []initializer.WebhookConfigurationsOption
		if c.EnableUsages {
			whOpts = append(whOpts,
				initializer.WithFailurePolicyOverride(usageWebhookConfigName, admv1.FailurePolicyType(c.UsageWebhookFailurePolicy)))
		} else {
			// Usages are disabled: don't install the Usage deletion protection
			// webhook, and remove one left over from a previous install.
			whOpts = append(whOpts,
				initializer.WithSkippedConfigurations(usageWebhookConfigName))
			steps = append(steps,
				initializer.NewValidatingWebhookRemover(usageWebhookConfigName, usageWebhookName))
		}

		nn := types.NamespacedName{
			Name:      c.TLSServerSecretName,
			Namespace: c.Namespace,
		}
		svc := admv1.ServiceReference{
			Name:      c.WebhookServiceName,
			Namespace: c.WebhookServiceNamespace,
			Port:      &c.WebhookServicePort,
		}
		steps = append(steps,
			initializer.NewCoreCRDs(c.CRDsPath, s, initializer.WithWebhookTLSSecretRef(nn)),
			initializer.NewWebhookConfigurations(c.WebhookConfigurationsPath, s, nn, svc, whOpts...))
	} else {
		log.Info("Warning: Webhooks are disabled, so deprecated ValidatingWebhookConfigurations will not be automatically deleted.")
		steps = append(steps,
			initializer.NewCoreCRDs(c.CRDsPath, s),
		)
	}

	// CRD migrator steps are done after core CRDs are applied/updated, so we
	// are always migrating to the most current storage version
	steps = append(steps,
		initializer.NewCoreCRDsMigrator("usages.apiextensions.crossplane.io", "v1beta1"),
		initializer.NewCoreCRDsMigrator("functions.pkg.crossplane.io", "v1beta1"),
		initializer.NewCoreCRDsMigrator("functionrevisions.pkg.crossplane.io", "v1beta1"),
		initializer.NewLockObject(),
		initializer.NewPackageInstaller(c.Providers, c.Configurations, c.Functions),
		initializer.StepFunc(initializer.DefaultDeploymentRuntimeConfig),
		initializer.DefaultManagedResourceActivationPolicy(c.Activations...),
	)

	if err := initializer.New(cl, log, steps...).Init(context.TODO()); err != nil {
		return errors.Wrap(err, "cannot initialize core")
	}

	log.Info("Initialization has been completed")

	return nil
}

```

### Core Architecture Module: `cmd/crossplane/render/render.go`
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

// Package render implements the 'crossplane internal render' subcommand. It
// reads a protobuf RenderRequest from stdin, dispatches to the appropriate
// render implementation based on the oneof variant, and writes a protobuf
// RenderResponse to stdout.
package render

import (
	"context"
	"io"
	"os"
	"time"

	"google.golang.org/protobuf/proto"

	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
	"github.com/crossplane/crossplane-runtime/v2/pkg/logging"

	xcomposite "github.com/crossplane/crossplane/v2/internal/controller/apiextensions/composite"
	"github.com/crossplane/crossplane/v2/internal/render/composite"
	"github.com/crossplane/crossplane/v2/internal/render/operation"
	renderv1alpha1 "github.com/crossplane/crossplane/v2/proto/render/v1alpha1"
)

// ExitCodePipelineFatal is the process exit code reported when a function
// pipeline step returns a SEVERITY_FATAL result. It is distinct from the
// generic non-zero exit Kong reports for other errors so that wrappers can
// branch on FATAL without parsing stderr. See issue #7446.
const ExitCodePipelineFatal = 3

// Command renders a resource using the real reconciler engine backed by a fake
// in-memory client. It reads a protobuf RenderRequest from stdin and writes a
// protobuf RenderResponse to stdout.
type Command struct {
	Timeout time.Duration `default:"2m" help:"Timeout for the render operation."`

	// stdin and stdout default to os.Stdin/os.Stdout. They are unexported
	// so they don't expand the production API surface; in-package tests can
	// set them to substitute buffers without process-level redirection.
	// AfterApply (called by Kong after parsing) populates these if unset,
	// so Run can use them directly.
	stdin  io.Reader
	stdout io.Writer
}

// AfterApply is invoked by Kong after CLI parsing, before Run. It applies
// stdin/stdout defaults so callers (Kong in production, tests injecting
// buffers) only need to override what they want substituted.
func (c *Command) AfterApply() error {
	if c.stdin == nil {
		c.stdin = os.Stdin
	}
	if c.stdout == nil {
		c.stdout = os.Stdout
	}
	return nil
}

// Run executes the render command.
func (c *Command) Run(log logging.Logger) error {
	ctx, cancel := context.WithTimeout(context.Background(), c.Timeout)
	defer cancel()

	data, err := io.ReadAll(c.stdin)
	if err != nil {
		return errors.Wrap(err, "cannot read render request from stdin")
	}

	req := &renderv1alpha1.RenderRequest{}
	if err := proto.Unmarshal(data, req); err != nil {
		return errors.Wrap(err, "cannot unmarshal render request")
	}

	rsp := &renderv1alpha1.RenderResponse{Meta: &renderv1alpha1.ResponseMeta{}}

	// renderErr captures the render-side failure if any. We resolve it after
	// the switch so the success path can still return a marshalled response,
	// and the pipeline-fatal path can return both the partial response on
	// stdout AND a typed error with a distinct exit code.
	var renderErr error

	switch in := req.GetInput().(type) {
	case *renderv1alpha1.RenderRequest_Composite:
		out, err := composite.Render(ctx, log, in.Composite)
		if out != nil {
			rsp.Output = &renderv1alpha1.RenderResponse_Composite{Composite: out}
		}
		if err != nil {
			renderErr = errors.Wrap(err, "cannot render composite resource")
		}

	case *renderv1alpha1.RenderRequest_Operation:
		out, err := operation.Render(ctx, log, in.Operation)
		if out != nil {
			rsp.Output = &renderv1alpha1.RenderResponse_Operation{Operation: out}
		}
		if err != nil {
			renderErr = errors.Wrap(err, "cannot render operation")
		}

	case *renderv1alpha1.RenderRequest_CronOperation:
		out, err := operation.NewFromCronOperation(in.CronOperation)
		if err != nil {
			return errors.Wrap(err, "cannot render cron operation")
		}
		rsp.Output = &renderv1alpha1.RenderResponse_CronOperation{CronOperation: out}

	case *renderv1alpha1.RenderRequest_WatchOperation:
		out, err := operation.NewFromWatchOperation(in.WatchOperation)
		if err != nil {
			return errors.Wrap(err, "cannot render watch operation")
		}
		rsp.Output = &renderv1alpha1.RenderResponse_WatchOperation{WatchOperation: out}

	default:
		return errors.New("render request must set exactly one of: composite, operation, cron_operation, watch_operation")
	}

	// On a pipeline FATAL we surface the partial output to stdout before
	// propagating the error so callers iterating on requirements can recover
	// the recorded RequiredResources/RequiredSchemas. We only take that
	// path when there's actually a partial output to emit (rsp.Output set):
	// if BuildOutput failed alongside the pipeline FATAL, there's no usable
	// stdout to emit so we fall through to the regular error path. Callers
	// can still recover *PipelineFatalError from the returned error via
	// errors.As regardless of which path we take.
	var pfe *xcomposite.PipelineFatalError
	hasPartialOutput := rsp.GetOutput() != nil && errors.As(renderErr, &pfe)
	if renderErr != nil && !hasPartialOutput {
		return renderErr
	}

	out, err := proto.Marshal(rsp)
	if err != nil {
		// Marshal failure means we cannot deliver any stdout; surface both
		// the marshal error and the pipeline FATAL (if any) via errors.Join
		// so callers can still recover *PipelineFatalError via errors.As.
		// When renderErr is nil, errors.Join wraps the marshal error in a
		// MultiError whose Error() string and errors.As/Is behavior match
		// the wrapped error exactly. The combined error does not implement
		// kong.ExitCoder, so the process exits with the generic non-zero
		// code instead of 3 — correct because the partial-output contract
		// isn't being met.
		return errors.Join(errors.Wrap(err, "cannot marshal render response"), renderErr)
	}
	if _, err := c.stdout.Write(out); err != nil {
		return errors.Join(errors.Wrap(err, "cannot write render response"), renderErr)
	}

	if pfe != nil {
		// Wrap with an exit-code marker so Kong (via the kong.ExitCoder
		// interface) sets the process exit code to ExitCodePipelineFatal.
		// The wrapped chain still contains *xcomposite.PipelineFatalError,
		// so
		// callers using errors.As can recover it.
		return &exitCodeError{err: renderErr, code: ExitCodePipelineFatal}
	}
	return nil
}

// exitCodeError wraps an error to communicate a specific process exit code
// to Kong via the kong.ExitCoder interface. Unwrap preserves the chain so
// callers using errors.As/Is still see whatever was wrapped.
type exitCodeError struct {
	err  error
	code int
}

func (e *exitCodeError) Error() string { return e.err.Error() }
func (e *exitCodeError) Unwrap() error { return e.err }
func (e *exitCodeError) ExitCode() int { return e.code }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7838** (2026-09-22): **Old revision not demoted for SA**
  *Symptoms*: ### What happened?  When trying to upgrade from v2.3.3 to v2.4.1, the functions and provider pods didn't start up. In all function/provider resources there are events messages like:  ```     Message:               Package runtime health is "False" with message: post establish runtime hook failed for package: cannot apply function package service account: ServiceAccount "function-sequencer" is invalid: metadata.ownerReferences: Invalid value: [{"apiVersion":"pkg.crossplane.io/v1","kind":"FunctionRevision","name":"function-sequencer-77518d1ebbf7","uid":"f866d50b-cddc-4fe6-90c2-462c76ac7cb9","controller":true,"blockOwnerDeletion":true},{"apiVersion":"pkg.crossplane.io/v1","kind":"FunctionRevision","name":"function-sequencer-bdbbc83b7f94","uid":"ca0276a5-0400-482e-972b-8333f8f093a7","controller":true,"blockOwnerDeletion":true}]: Only one reference can have Controller set to true. Found "true" in references for FunctionRevision/function-sequencer-77518d1ebbf7 and FunctionRevision/function-sequencer-bdbbc83b7f94 ```  SA already had old revision's `controller: true` ownerRef. New revision added another `controller: true`, which Kubernetes rejects.  ### How can we reproduce it?  Any 2.3.x to 2.4.x upgrade with running functions/providers should raise it.  ### What environment did it happen in? Crossplane version: v2.4.1 
  **Post-Mortem & Fix Analysis**:
  > We can confirm the issue. It happened to us when we tried to upgrade from 2.3.5 to 2.4.1
  > in all the testing for https://github.com/crossplane/crossplane/pull/7714, we didn't see this behavior at all, so sorry that we missed it 🙇‍♂️   Can you all share more about your environment, so we can better repro this scenario, i.e. are you using specific configuration for service accounts? 🤔 
  > Nothing special on our side, SA is being created by the providers from a DRC's `serviceAccountTemplate` which adds AWS IRSA annotations.

- **Issue #7756** (2026-09-25): **TestConfigurationPullFromPrivateRegistry is failing**
  *Symptoms*: ### What happened?  On https://github.com/crossplane/crossplane/pull/7755, we noticed that the e2e test `TestConfigurationPullFromPrivateRegistry` is failing consistently with:  ``` DENIED: Permission 'artifactregistry.repositories.downloadArtifacts' denied on resource  '//artifactregistry.googleapis.com/projects/crossplane-playground/locations/us-west1/repositories/xp-install-test'  (or it may not exist). ```  Example failure in https://github.com/crossplane/crossplane/actions/runs/32150003551/job/95753219697?pr=7755  It looks like this test container repository `xp-install-test` in GCP that we use during the e2e tests for validating package pulls from a private repo has been accidentally deleted.  We need to figure out how to restore it or how to migrate it to a more permanent location.  ### How can we reproduce it?  Run any of the `pkg` area e2e tests and `TestConfigurationPullFromPrivateRegistry` will fail.  ### What environment did it happen in?  This is happening across all currently supported crossplane branches (1.20 -> 2.4 and main) 
  **Post-Mortem & Fix Analysis**:
  > we could push it to ghcr and use a token to pull it ?  `us-west1-docker.pkg.dev/crossplane-playground/xp-install-test/configuration:main`
  > The package source is already in this repo: [`test/e2e/manifests/pkg/configuration/private/package/crossplane.yaml`](https://github.com/crossplane/crossplane/blob/main/test/e2e/manifests/pkg/configuration/private/package/crossplane.yaml), a `meta.pkg.crossplane.io/v1` Configuration named `xp-install-test` and nothing else. Rebuilding it just needs the CLI:  ```shell cd test/e2e/manifests/pkg/configuration/private/package crossplane xpkg build -o /tmp/xp-install-test.xpkg docker login <registry> crossplane xpkg push -f /tmp/xp-install-test.xpkg <registry>/<repo>/configuration:main ```  I verified the build step with CLI v2.4.1 — no other files needed. (The old automation was [`make xpkg.push`](https://github.com/crossplane/test/blob/master/Makefile) driven by [`package-push.yml`](https://github.com/crossplane/test/blob/master/.github/workflows/package-push.yml) in the archived `crossplane/test` repo, hence the `:main` tag.)  Whoever picks the new home also needs to update `spec.package`
  > @jbw976 shall we proceed pushing to `ghcr`?

- **Issue #7708** (2026-08-12): **Upgrading to latest `main` builds makes all packages unhealthy**
  *Symptoms*: ### What happened?  Upgrading Crossplane from v2.3.4 to a `main` build (which will be `v2.4` soon) results in every installed Provider and Function being in an unhealthy state.   ``` ❯ kubectl get pkg NAME                                        INSTALLED   HEALTHY   PACKAGE                                                       AGE function.pkg.crossplane.io/function-dummy   True        False     xpkg.crossplane.io/crossplane-contrib/function-dummy:v0.4.1   52m  NAME                                      INSTALLED   HEALTHY   PACKAGE                                                  AGE provider.pkg.crossplane.io/provider-nop   True        False     xpkg.upbound.io/crossplane-contrib/provider-nop:v0.3.0   51m ```  Each new package revision can't apply its runtime Service:  ``` pre establish runtime hook failed for package: cannot apply function package service: Service "function-dummy" is invalid:  metadata.ownerReferences: Invalid value: [...]: Only one reference can have Controller set to true. Found "true" in references for  FunctionRevision/function-dummy-b8a8590f61fb and FunctionRevision/function-dummy-c285fabc6eda ```  PR #7563 switched package runtime objects like [`Service` and `Deployment` to use server side apply](https://github.com/crossplane/crossplane/blob/819178be1fcfd39d05c377f058151151ec0d9e39/internal/controller/pkg/runtime/runtime.go#L173-L183). Each of those declares a single controller owner reference pointing at the current revision. `metadata.ownerReference

- **Issue #7707** (2026-08-05): **Renovate `postUpgradeTasks` failing with `error: experimental Nix feature 'nix-command' is disabled`**
  *Symptoms*: ### What happened?  Renovate's Go dependency PRs failing their [`postUpgradeTasks`](https://github.com/crossplane/crossplane-runtime/blob/a572204f818460176659eb1c01c275a8f210e44c/.github/renovate-nix.json5#L57-L61) with:  ``` Command failed: nix run .#tidy error: experimental Nix feature 'nix-command' is disabled; add '--extra-experimental-features nix-command' to enable it ```  Renovate reports this as an `Artifact update problem` comment on the PR with this error, some examples:  * https://github.com/crossplane/crossplane-runtime/pull/1100  * https://github.com/crossplane/crossplane-runtime/pull/1101 * https://github.com/crossplane/crossplane-runtime/pull/1102 * https://github.com/crossplane/crossplane-runtime/pull/1105   These are all on crossplane-runtime so far, but I believe crossplane/crossplane will also hit this issue as soon as lock file maintenance PRs are flowing more smoothly again after https://github.com/crossplane/crossplane/pull/7701.  A quick analysis by Claude thinks this is happening because there are now two `nix` binaries in the Renovate container. Our [entrypoint](https://github.com/crossplane/crossplane-runtime/blob/a572204f818460176659eb1c01c275a8f210e44c/.github/renovate-entrypoint.sh#L26-L28) installs one from apt and configures it via `/etc/nix/nix.conf`. Separately, Renovate's own nix manager installs a second one through containerbase, whose wrapper [points `NIX_CONF_DIR` at its own cache directory](https://github.com/containerbase/base/blob/main
  **Post-Mortem & Fix Analysis**:
  > The fix from #7709 looks to be working in the latest Renovate run https://github.com/crossplane/crossplane/actions/runs/31018047113 when https://github.com/crossplane/crossplane/pull/7687 was rebased and postUpgradeTasks were run on it.  ``` 15:03:52  install-tool nix 2.35.1        <- containerbase's Nix installs, shadowing ours 15:04:48  crossplane-nix run .#tidy      <- post-upgrade task starts in the same container 15:06:33  Executed post-upgrade task     <- tidy done (105s) 15:06:33  crossplane-nix run .#generate 15:07:15  Executed post-upgrade task     <- generate done (42s) 15:07:20  commit pushed to the PR branch ```

- **Issue #7590** (2026-07-20): **[BUG] Composed Usage continuously updates and opens XR circuit breaker due to first ownerReference check**
  *Symptoms*: # Composed Usage continuously updates and opens XR circuit breaker due to first ownerReference check  ### What happened?  A `Usage` created as a composed resource continuously updates after becoming ready, eventually opening the XR circuit breaker.  Crossplane adds the XR as the Usage's first owner. The Usage controller then adds the resource from `spec.by` as another owner:  ```yaml ownerReferences:   - kind: MyComposite     uid: xr-uid     controller: true   - kind: ConfigMap     uid: using-resource-uid ```  However, the Usage reconciler checks only `owners[0]`:  https://github.com/crossplane/crossplane/blob/v2.1.3/internal/controller/protection/usage/reconciler.go#L507-L525  ```go if owners := u.GetOwnerReferences(); len(owners) == 0 || owners[0].UID != using.GetUID() { 	meta.AddOwnerReference(u, meta.AsOwner( 		meta.TypedReferenceTo(using, using.GetObjectKind().GroupVersionKind()), 	))  	if err := r.client.Update(ctx, u); err != nil { 		// ... 	} } ```  Because `owners[0]` is the XR, it never matches `using.GetUID()`. `meta.AddOwnerReference` finds and replaces the already-present `spec.by` owner, but `client.Update` is still called. This update produces another watch event and repeats indefinitely.  The resulting event burst opens the XR circuit breaker:  ```text Too many watch events from Usage/<name>. Allowing events periodically. ```  The XR receives:  ```yaml type: Responsive status: "False" reason: WatchCircuitOpen ```  This delays composite readiness even when the 
  **Post-Mortem & Fix Analysis**:
  > I’d like to work on a fix for this. My proposed change is to check all Usage owner references instead of only the first one, with a regression test covering composed Usages

- **Issue #7585** (2026-07-13): **Function gRPC client never re-resolves DNS: scaled-up Function pods get zero traffic and load stays unbalanced**
  *Symptoms*: Crossplane creates a **single, process-lifetime** `grpc.ClientConn` per Function, pointed at `dns:///<service>.<namespace>:9443` against a **headless** Service, with `round_robin` load balancing. The intent is documented in the code:  > This configures a gRPC client to use round robin load balancing. This means that if the Function Deployment has more than one Pod, and the Function Service is headless, requests will be spread across each Pod. > — `internal/xfn/function_runner.go:53-56`  In practice the requests are **not** spread across each Pod, because the address list is never refreshed.  grpc-go's DNS resolver does **not** re-resolve periodically after a successful lookup. Its watcher blocks indefinitely on the `ResolveNow` channel (`google.golang.org/grpc@v1.81.1/internal/resolver/dns/dns_resolver.go:206-241`):  ```go if err == nil {     // Success resolving, wait for the next ResolveNow. However, also wait 30     // seconds at the very least to prevent constantly re-resolving.     backoffIndex = 1     nextResolutionTime = internal.TimeNowFunc().Add(MinResolutionInterval)     select {     case <-d.ctx.Done():         return     case <-d.rn:          // <-- blocks here until a subchannel breaks     } } ```  `MinResolutionInterval = 30 * time.Second` (`dns_resolver.go:52`) is a *lower bound* on how often re-resolution may happen, **not** a polling period. `ResolveNow` is only fired by the balancer when a subchannel goes to `TRANSIENT_FAILURE` — i.e. when a connection to a 
  **Post-Mortem & Fix Analysis**:
  > is this duplicate of https://github.com/crossplane/crossplane/issues/7571 ?
  > @haarchri thanks for the reference. Let's track the issue in #7571, I have added my case https://github.com/crossplane/crossplane/issues/7571#issuecomment-4958922987

- **Issue #7550** (2026-07-22): **Inactive package revisions can delete active revision runtime Deployment when DeploymentRuntimeConfig sets a fixed deployment name**
  *Symptoms*: ## Summary  Inactive `ProviderRevision` / `FunctionRevision` objects can delete the active package runtime `Deployment` when `DeploymentRuntimeConfig.spec.deploymentTemplate.metadata.name` is set to a fixed name.  This causes Crossplane providers/functions to be repeatedly recreated even though no new package revision is being created.    ## Environment    - Crossplane version: `v2.3.1`   - Kubernetes: EKS   - Package types affected:     - `Provider`     - `Function`   - Runtime customization:     - `DeploymentRuntimeConfig`     - fixed `spec.deploymentTemplate.metadata.name`   - Package revision history:     - inactive revisions are retained    ## Problem    We configure Crossplane package runtimes with stable Deployment names via `DeploymentRuntimeConfig`, for example:    ```yaml   apiVersion: pkg.crossplane.io/v1beta1   kind: DeploymentRuntimeConfig   metadata:     name: function-go-templating   spec:     deploymentTemplate:       metadata:         name: function-go-templating       spec:         replicas: 1 ```    This is useful for integrations that target a stable Kubernetes object name, such as:    - VerticalPodAutoscaler   - policy exceptions   - monitoring   - other cluster automation    However, when older inactive package revisions are retained, they can still reconcile. When an inactive revision   deactivates its runtime, it appears to delete the runtime Deployment by the configured name without verifying that the   live Deployment is owned by that inactive revisi

- **Issue #7447** (2026-06-03): **`internal render` should honor the schema of the input XR**
  *Symptoms*: ### What happened?  `crossplane internal render` always wraps the input XR with `Schema = SchemaModern`, regardless of whether the XR is backed by a v1 (legacy) XRD or a v2 XRD. As a result, rendering a legacy XR produces output at v2 paths (`spec.crossplane.resourceRefs`, etc.) rather than the v1 paths (`spec.resourceRefs`) that legacy CRDs declare.  Consumers who feed the rendered desired XR back into the apiserver (e.g. via dry-run apply) get rejected with `failed to create typed patch object: .spec.crossplane.resourceRefs: field not declared in schema`. Consumers who diff the rendered desired against cluster state see fields appear at the wrong paths.  This breaks `crossplane-diff` for any v1 XRD scenario in a v2 cluster (the upgrade-path category, where users haven't migrated to v2 XRDs yet). The same bug would surface for any external consumer reading `*ucomposite.Unstructured` accessors on the rendered output (`GetResourceReferences()` etc.) — they'd return empty for legacy XRs because the data is at the wrong path.  **Why the production reconciler doesn't have this bug:**  `internal/controller/apiextensions/composite/reconciler.go:575` initializes the wrapper with the right Schema: ```go xr := composite.New(composite.WithGroupVersionKind(r.gvk), composite.WithSchema(r.schema)) ``` The XRD-controllers (v1-XRD vs v2-XRD) set `r.schema` appropriately before constructing the reconciler, so the shared composite logic dispatches to the right field paths.  **Why `internal re

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

### Incident Patch 1: `8bc97ea4` (2026-10-02)
**Commit Message**: fix(deps): update module google.golang.org/grpc to v1.84.0

**File**: `go.mod` (modified, +1/-2)
```diff
@@ -16,7 +16,7 @@ require (
 	github.com/robfig/cron/v3 v3.0.1
 	github.com/spf13/afero v1.15.0
 	golang.org/x/sync v0.23.0
-	google.golang.org/grpc v1.83.2
+	google.golang.org/grpc v1.84.0
 	google.golang.org/protobuf v1.36.12
 	k8s.io/api v0.35.3
 	k8s.io/apiextensions-apiserver v0.35.0
@@ -46,7 +46,6 @@ require (
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
-	go.opentelemetry.io/otel/sdk/metric v1.45.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 )
 
```

**File**: `go.sum` (modified, +6/-8)
```diff
@@ -179,8 +179,8 @@ github.com/exponent-io/jsonpath v0.0.0-20210407135951-1de76d718b3f h1:Wl78ApPPB2
 github.com/exponent-io/jsonpath v0.0.0-20210407135951-1de76d718b3f/go.mod h1:OSYXu++VVOHnXeitef/D8n/6y4QV8uLHSFXX4NeXMGc=
 github.com/fatih/color v1.18.0 h1:S8gINlzdQ840/4pfAwic/ZE0djQEH3wM94VfqLTZcOM=
 github.com/fatih/color v1.18.0/go.mod h1:4FelSpRwEGDpQ12mAdzqdOukCy4u8WUtOY6lkT/6HfU=
-github.com/felixge/httpsnoop v1.0.4 h1:NFTV2Zj1bL4mc9sqWACXbQFVBBg2W3GPvqp8/ESS2Wg=
-github.com/felixge/httpsnoop v1.0.4/go.mod h1:m8KPJKqk1gH5J9DgRY2ASl2lWCfGKXixSwevea8zH2U=
+github.com/felixge/httpsnoop v1.1.0 h1:3YtUj32ZZkqZtt3sZZsClsymw/QDuVfpNhoA31zeORc=
+github.com/felixge/httpsnoop v1.1.0/go.mod h1:Zqxgdd+1Rkcz8euOqdr7lqgCRJztwr5hp9vDSi5UZCE=
 github.com/fsnotify/fsnotify v1.4.7/go.mod h1:jwhsz4b93w/PPRr/qN1Yymfu8t87LnFCMoQvtojpjFo=
 github.com/fsnotify/fsnotify v1.4.9/go.mod h1:znqG4EE+3YCdAaPaxE2ZRY/06pZUdp0tY4IgpuI1SZQ=
 github.com/fsnotify/fsnotify v1.5.4/go.mod h1:OVB6XrOHzAwXMpEM7uPOzcehqUV2UqJxmVXmkdnm1bU=
@@ -566,8 +566,8 @@ go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.67.0 h1:yI1/OhfEPy7J9eoa6Sj051C7n5dvpj0QX8g4sRchg04=
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.67.0/go.mod h1:NoUCKYWK+3ecatC4HjkRktREheMeEtrXoQxrqYFeHSc=
-go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.67.0 h1:OyrsyzuttWTSur2qN/Lm0m2a8yqyIjUVBZcxFPuXq2o=
-go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.67.0/go.mod h1:C2NGBr+kAB4bk3xtMXfZ94gqFDtg/GkI7e9zqGh5Beg=
+go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 h1:8tvICD4vSTOOsNrsI4Ljf6C+6UKvpTEH5XY3JMoyPoo=
+go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0/go.mod h1:z9+yiacE0IHRqM4qFfkbt/JYlmYXgss8GY/jXoNuPJI=
 go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
 go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
@@ -578,8 +578,6 @@ go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypR
 go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
 go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
 go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
-go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
-go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
 go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
 go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
 go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
@@ -706,8 +704,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a/go.mod h1:1brfde68Npq6+WA75c1EHWPijZEG1kMus61ygPZfn4A=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a h1:qI/YMH1ep2qQtqcp00gMQyoU7mjvbhg88GJKCvfoLj0=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
-google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
+google.golang.org/grpc v1.84.0 h1:soMyaPJ8pAak5PIQ0DGBUir0XRo2fRoMqhNWMLlLxO0=
+google.golang.org/grpc v1.84.0/go.mod h1:ljCht0DrxQrXBDRTZp52Qxh3Ffk8CdYm2sj4O2QN2C0=
 google.golang.org/protobuf v0.0.0-20200109180630-ec00e32a8dfd/go.mod h1:DFci5gLYBciE7Vtevhsrf46CRTquxDuWsQurQQe4oz8=
 google.golang.org/protobuf v0.0.0-20200221191635-4d8936d0db64/go.mod h1:kwYJMbMJ01Woi6D6+Kah6886xMZcty6N08ah7+eCXa0=
 google.golang.org/protobuf v0.0.0-20200228230310-ab0ca4ff8a60/go.mod h1:cfTl7dwQJ+fmap5saPgwCLgHXTUD7jkjRqWcaiX5VyM=
```

**File**: `nix/vendor-hashes.nix` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # by hand.)
 {
   # Root module: github.com/crossplane/crossplane/v2
-  root = "sha256-lFGhFLqgDUK2P+SMQTsDOMAX4oafCznxwUzYAdvL0eM=";
+  root = "sha256-Zkho3YD0PHcBpOM6Dor7uX543WXgV0GxYxw2lqmPs84=";
 
   # apis module: github.com/crossplane/crossplane/apis/v2
   apis = "sha256-LBPg9GFga3rvI5D487ydw+AyE7ezHP07ukxX3PcWLUA=";
```

---

### Incident Patch 2: `dd1fa9aa` (2026-10-02)
**Commit Message**: fix(deps): update module github.com/crossplane/crossplane/apis/v2 to v2.4.2

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ require (
 	github.com/Masterminds/semver/v3 v3.5.0
 	github.com/alecthomas/kong v1.16.1
 	github.com/crossplane/crossplane-runtime/v2 v2.5.0-rc.0
-	github.com/crossplane/crossplane/apis/v2 v2.4.0
+	github.com/crossplane/crossplane/apis/v2 v2.4.2
 	github.com/google/go-cmp v0.7.0
 	github.com/google/go-containerregistry v0.22.1
 	github.com/robfig/cron/v3 v3.0.1
```

---

### Incident Patch 3: `7e78644e` (2026-10-02)
**Commit Message**: fix(deps): update module google.golang.org/protobuf to v1.36.12

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ require (
 	github.com/spf13/afero v1.15.0
 	golang.org/x/sync v0.23.0
 	google.golang.org/grpc v1.83.2
-	google.golang.org/protobuf v1.36.11
+	google.golang.org/protobuf v1.36.12
 	k8s.io/api v0.35.3
 	k8s.io/apiextensions-apiserver v0.35.0
 	k8s.io/apimachinery v0.35.3
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -716,8 +716,8 @@ google.golang.org/protobuf v1.21.0/go.mod h1:47Nbq4nVaFHyn7ilMalzfO3qCViNmqZ2kzi
 google.golang.org/protobuf v1.23.0/go.mod h1:EGpADcykh3NcUnDUJcl1+ZksZNG86OlYog2l/sGQquU=
 google.golang.org/protobuf v1.26.0-rc.1/go.mod h1:jlhhOSvTdKEhbULTjvd4ARK9grFBp09yW+WbY/TyQbw=
 google.golang.org/protobuf v1.26.0/go.mod h1:9q0QmTI4eRPtz6boOQmLYwt+qCgq0jsYwAQnmE0givc=
-google.golang.org/protobuf v1.36.11 h1:fV6ZwhNocDyBLK0dj+fg8ektcVegBBuEolpbTQyBNVE=
-google.golang.org/protobuf v1.36.11/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
+google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
+google.golang.org/protobuf v1.36.12/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c h1:Hei/4ADfdWqJk1ZMxUNpqntNwaWcugrBjAiHlqqRiVk=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c/go.mod h1:JHkPIbrfpd72SG/EVd6muEfDQjcINNoR0C8j2r3qZ4Q=
```

**File**: `nix/vendor-hashes.nix` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # by hand.)
 {
   # Root module: github.com/crossplane/crossplane/v2
-  root = "sha256-IhAnIYsUgUYFkLGqQh4rMdvxT1+zdr+0knLXfmWJ4nI=";
+  root = "sha256-lFGhFLqgDUK2P+SMQTsDOMAX4oafCznxwUzYAdvL0eM=";
 
   # apis module: github.com/crossplane/crossplane/apis/v2
   apis = "sha256-LBPg9GFga3rvI5D487ydw+AyE7ezHP07ukxX3PcWLUA=";
```

---

### Incident Patch 4: `f6ee5d86` (2026-10-01)
**Commit Message**: fix(deps): update module github.com/google/go-containerregistry to v0.22.1

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@ require (
 	github.com/crossplane/crossplane-runtime/v2 v2.5.0-rc.0
 	github.com/crossplane/crossplane/apis/v2 v2.4.0
 	github.com/google/go-cmp v0.7.0
-	github.com/google/go-containerregistry v0.21.8
+	github.com/google/go-containerregistry v0.22.1
 	github.com/robfig/cron/v3 v3.0.1
 	github.com/spf13/afero v1.15.0
 	golang.org/x/sync v0.23.0
@@ -171,7 +171,7 @@ require (
 	github.com/chrismellard/docker-credential-acr-env v0.0.0-20230304212654-82a0ddb27589 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/dimchansky/utfbom v1.1.1 // indirect
-	github.com/docker/cli v29.6.2+incompatible // indirect
+	github.com/docker/cli v29.7.2+incompatible // indirect
 	github.com/docker/docker-credential-helpers v0.9.5 // indirect
 	github.com/emicklei/go-restful/v3 v3.13.0 // indirect
 	github.com/evanphx/json-patch v5.9.11+incompatible // indirect
@@ -189,7 +189,7 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/inconshreveable/mousetrap v1.1.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
-	github.com/klauspost/compress v1.19.1 // indirect
+	github.com/klauspost/compress v1.19.2 // indirect
 	github.com/mattn/go-colorable v0.1.14 // indirect
 	github.com/mattn/go-isatty v0.0.20 // indirect
 	github.com/mitchellh/go-homedir v1.1.0 // indirect
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -163,8 +163,8 @@ github.com/digitorus/timestamp v0.0.0-20231217203849-220c5c2851b7 h1:lxmTCgmHE1G
 github.com/digitorus/timestamp v0.0.0-20231217203849-220c5c2851b7/go.mod h1:GvWntX9qiTlOud0WkQ6ewFm0LPy5JUR1Xo0Ngbd1w6Y=
 github.com/dimchansky/utfbom v1.1.1 h1:vV6w1AhK4VMnhBno/TPVCoK9U/LP0PkLCS9tbxHdi/U=
 github.com/dimchansky/utfbom v1.1.1/go.mod h1:SxdoEBH5qIqFocHMyGOXVAybYJdr71b1Q/j0mACtrfE=
-github.com/docker/cli v29.6.2+incompatible h1:/bjePvcbbFTnRrMfWJBY7AjfICdsiLVgHn6LwTVOcqw=
-github.com/docker/cli v29.6.2+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
+github.com/docker/cli v29.7.2+incompatible h1:dlkwallR8XqfeVnA2ELEhdwvb4lsSwuB4IgsG8Q9cLY=
+github.com/docker/cli v29.7.2+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
 github.com/docker/docker-credential-helpers v0.9.5 h1:EFNN8DHvaiK8zVqFA2DT6BjXE0GzfLOZ38ggPTKePkY=
 github.com/docker/docker-credential-helpers v0.9.5/go.mod h1:v1S+hepowrQXITkEfw6o4+BMbGot02wiKpzWhGUZK6c=
 github.com/dustin/go-humanize v1.0.1 h1:GzkhY7T5VNhEkwH0PVJgjz+fX1rhBrR7pRT3mDkpeCY=
@@ -299,8 +299,8 @@ github.com/google/go-cmp v0.4.0/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/
 github.com/google/go-cmp v0.5.5/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/gNBxE=
 github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
 github.com/google/go-cmp v0.7.0/go.mod h1:pXiqmnSA92OHEEa9HXL2W4E7lf9JzCmGVUdgjX3N/iU=
-github.com/google/go-containerregistry v0.21.8 h1:Ig/zIsnztdCUNaiNNczE+MoP5xcyUMfvpvfOr1xyMLE=
-github.com/google/go-containerregistry v0.21.8/go.mod h1:dP5XNKcL7kMFF/TB3LfvWmVhAcv7iqkHb3oDK8aauTo=
+github.com/google/go-containerregistry v0.22.1 h1:RZuuSYhTvlDvtsK+NkutoCZ//C0X2ebLK8X8l3ULs84=
+github.com/google/go-containerregistry v0.22.1/go.mod h1:bJR35SK8XgisYmhg/FMQ/5RK0S/XrOAqLBV5/LR2XE0=
 github.com/google/go-containerregistry/pkg/authn/k8schain v0.0.0-20260312205200-e9163014982e h1:/ouF9a6+BFnovNKxnj/HYCyx2eldNzYu2lZvKdez3rM=
 github.com/google/go-containerregistry/pkg/authn/k8schain v0.0.0-20260312205200-e9163014982e/go.mod h1:42tJN6TfytRCQlKQiJ2KzfRp5raI2RjN0cjJCFkeSyc=
 github.com/google/go-containerregistry/pkg/authn/kubernetes v0.0.0-20250225234217-098045d5e61f h1:GJRzEBoJv/A/E7JbTekq1Q0jFtAfY7TIxUFAK89Mmic=
@@ -371,8 +371,8 @@ github.com/jmhodges/clock v1.2.0 h1:eq4kys+NI0PLngzaHEe7AmPT90XMGIEySD1JfV1PDIs=
 github.com/jmhodges/clock v1.2.0/go.mod h1:qKjhA7x7u/lQpPB1XAqX1b1lCI/w3/fNuYpI/ZjLynI=
 github.com/json-iterator/go v1.1.12 h1:PV8peI4a0ysnczrg+LtxykD8LfKY9ML6u2jnxaEnrnM=
 github.com/json-iterator/go v1.1.12/go.mod h1:e30LSqwooZae/UwlEbR2852Gd8hjQvJoHmT4TnhNGBo=
-github.com/klauspost/compress v1.19.1 h1:VsB4HPswih7mmZ8WleSFQ75c/Ui1M4trX5oAsJnhSlk=
-github.com/klauspost/compress v1.19.1/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/klauspost/compress v1.19.2 h1:hMRETovs/pu/dVWN7zIT1PGG8t509MwT6bO7XSi26R8=
+github.com/klauspost/compress v1.19.2/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/kr/pretty v0.3.1 h1:flRD4NNwYAUpkphVc1HcthR4KEIFJ65n8Mw5qdRn3LE=
 github.com/kr/pretty v0.3.1/go.mod h1:hoEshYVHaxMs3cyo3Yncou5ZscifuDolrwPKZanG3xk=
 github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
```

**File**: `nix/vendor-hashes.nix` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # by hand.)
 {
   # Root module: github.com/crossplane/crossplane/v2
-  root = "sha256-3w3ER79q+bFXIVLxwX48ttfkNOm0pwiy2V7BjlNkLpk=";
+  root = "sha256-9e5J6uBHTdunjecT07jrn/kbV3xpDbZyMp318rFgnTk=";
 
   # apis module: github.com/crossplane/crossplane/apis/v2
   apis = "sha256-LBPg9GFga3rvI5D487ydw+AyE7ezHP07ukxX3PcWLUA=";
```

---

### Incident Patch 5: `de330834` (2026-10-01)
**Commit Message**: fix(deps): update module golang.org/x/sync to v0.23.0

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ require (
 	github.com/google/go-containerregistry v0.21.8
 	github.com/robfig/cron/v3 v3.0.1
 	github.com/spf13/afero v1.15.0
-	golang.org/x/sync v0.22.0
+	golang.org/x/sync v0.23.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 	k8s.io/api v0.35.3
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -633,8 +633,8 @@ golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.1.0/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.0.0-20180909124046-d0be0721c37e/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190412213103-97732733099d/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
```

**File**: `nix/vendor-hashes.nix` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # by hand.)
 {
   # Root module: github.com/crossplane/crossplane/v2
-  root = "sha256-PtnZ0gWG+HDSASmacqsmjt58QQUZa1m1DIdiSJtUTsI=";
+  root = "sha256-3w3ER79q+bFXIVLxwX48ttfkNOm0pwiy2V7BjlNkLpk=";
 
   # apis module: github.com/crossplane/crossplane/apis/v2
   apis = "sha256-LBPg9GFga3rvI5D487ydw+AyE7ezHP07ukxX3PcWLUA=";
```

---

### Incident Patch 6: `e23b21e7` (2026-10-01)
**Commit Message**: Merge pull request #7878 from adamwg/awg/separate-runtime-builders

pkg: Remove the shared runtime builder layer

**File**: `internal/controller/pkg/runtime/migration.go` (modified, +6/-11)
```diff
@@ -33,7 +33,7 @@ import (
 // DeploymentSelectorMigrator handles migration of provider deployments
 // that have outdated selector labels from older Crossplane versions.
 type DeploymentSelectorMigrator interface {
-	MigrateDeploymentSelector(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
+	MigrateDeploymentSelector(ctx context.Context, pr v1.PackageRevisionWithRuntime, d *appsv1.Deployment) error
 }
 
 // NopDeploymentSelectorMigrator is a no-op implementation of DeploymentSelectorMigrator.
@@ -45,7 +45,7 @@ func NewNopDeploymentSelectorMigrator() *NopDeploymentSelectorMigrator {
 }
 
 // MigrateDeploymentSelector does nothing and always returns nil.
-func (n *NopDeploymentSelectorMigrator) MigrateDeploymentSelector(_ context.Context, _ v1.PackageRevisionWithRuntime, _ ManifestBuilder) error {
+func (n *NopDeploymentSelectorMigrator) MigrateDeploymentSelector(_ context.Context, _ v1.PackageRevisionWithRuntime, _ *appsv1.Deployment) error {
 	return nil
 }
 
@@ -75,7 +75,7 @@ func NewDeletingDeploymentSelectorMigrator(client client.Client, log logging.Log
 // support older Crossplane versions that use the old provider deployment
 // selector labels. The latest Crossplane version using the old selector labels
 // is v1.20.0.
-func (m *DeletingDeploymentSelectorMigrator) MigrateDeploymentSelector(ctx context.Context, pr v1.PackageRevisionWithRuntime, builder ManifestBuilder) error {
+func (m *DeletingDeploymentSelectorMigrator) MigrateDeploymentSelector(ctx context.Context, pr v1.PackageRevisionWithRuntime, d *appsv1.Deployment) error {
 	// Only migrate provider revisions
 	providerRev, ok := pr.(*v1.ProviderRevision)
 	if !ok {
@@ -87,17 +87,12 @@ func (m *DeletingDeploymentSelectorMigrator) MigrateDeploymentSelector(ctx conte
 		return nil
 	}
 
-	// Build the expected deployment to get the correct name and selectors
-	// This respects any DeploymentRuntimeConfig settings
-	sa := builder.ServiceAccount()
-	expectedDeploy := builder.Deployment(sa.Name)
-
 	// Check if there's an existing deployment
 	existingDeploy := &appsv1.Deployment{}
 
 	err := m.client.Get(ctx, types.NamespacedName{
-		Name:      expectedDeploy.Name,
-		Namespace: expectedDeploy.Namespace,
+		Name:      d.Name,
+		Namespace: d.Namespace,
 	}, existingDeploy)
 	if kerrors.IsNotFound(err) {
 		// No existing deployment, no migration needed
@@ -124,7 +119,7 @@ func (m *DeletingDeploymentSelectorMigrator) MigrateDeploymentSelector(ctx conte
 	}
 
 	m.log.Info("Deleting provider deployment with outdated selector",
-		"deployment", expectedDeploy.Name,
+		"deployment", d.Name,
 		"revision", pr.GetName(),
 		"old-provider-label", expected,
 		"new-provider-label", existing)
```

**File**: `internal/controller/pkg/runtime/migration_test.go` (modified, +27/-52)
```diff
@@ -23,7 +23,6 @@ import (
 
 	"github.com/google/go-cmp/cmp"
 	appsv1 "k8s.io/api/apps/v1"
-	corev1 "k8s.io/api/core/v1"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime/schema"
@@ -44,13 +43,13 @@ const (
 
 // MockDeploymentSelectorMigrator is a mock implementation of DeploymentSelectorMigrator.
 type MockDeploymentSelectorMigrator struct {
-	MockMigrateDeploymentSelector func(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
+	MockMigrateDeploymentSelector func(ctx context.Context, pr v1.PackageRevisionWithRuntime, d *appsv1.Deployment) error
 }
 
 // MigrateDeploymentSelector calls MockMigrateDeploymentSelector if set, otherwise returns nil.
-func (m *MockDeploymentSelectorMigrator) MigrateDeploymentSelector(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error {
+func (m *MockDeploymentSelectorMigrator) MigrateDeploymentSelector(ctx context.Context, pr v1.PackageRevisionWithRuntime, d *appsv1.Deployment) error {
 	if m.MockMigrateDeploymentSelector != nil {
-		return m.MockMigrateDeploymentSelector(ctx, pr, b)
+		return m.MockMigrateDeploymentSelector(ctx, pr, d)
 	}
 
 	return nil
@@ -61,31 +60,19 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 	testLog := logging.NewLogrLogger(zap.New(zap.UseDevMode(true), zap.WriteTo(io.Discard)).WithName("testlog"))
 
 	type args struct {
-		client  client.Client
-		pr      v1.PackageRevisionWithRuntime
-		builder ManifestBuilder
+		client   client.Client
+		pr       v1.PackageRevisionWithRuntime
+		expected *appsv1.Deployment
 	}
 
 	type want struct {
 		err error
 	}
 
-	mockBuilder := &MockManifestBuilder{
-		DeploymentFn: func(_ string, _ ...DeploymentOverride) *appsv1.Deployment {
-			return &appsv1.Deployment{
-				ObjectMeta: metav1.ObjectMeta{
-					Name:      testDeploymentName,
-					Namespace: testNamespaceName,
-				},
-			}
-		},
-		ServiceAccountFn: func(_ ...ServiceAccountOverride) *corev1.ServiceAccount {
-			return &corev1.ServiceAccount{
-				ObjectMeta: metav1.ObjectMeta{
-					Name:      "test-sa",
-					Namespace: testNamespaceName,
-				},
-			}
+	expectedDeployment := &appsv1.Deployment{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      testDeploymentName,
+			Namespace: testNamespaceName,
 		},
 	}
 
@@ -97,9 +84,9 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 		"NotProviderRevision": {
 			reason: "Should return nil for non-provider revisions (like function revisions).",
 			args: args{
-				client:  &test.MockClient{},
-				pr:      &v1.FunctionRevision{},
-				builder: mockBuilder,
+				client:   &test.MockClient{},
+				pr:       &v1.FunctionRevision{},
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: nil,
@@ -116,7 +103,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: nil,
@@ -140,7 +127,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: nil,
@@ -164,7 +151,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: errors.Wrap(errBoom, "cannot get existing deployment"),
@@ -194,7 +181,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: nil,
@@ -226,7 +213,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: nil,
@@ -260,7 +247,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: nil,
@@ -314,7 +301,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: nil,
@@ -349,7 +336,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 						},
 					},
 				},
-				builder: mockBuilder,
+				expected: expectedDeployment,
 			},
 			want: want{
 				err: errors.Wrap(errBoom, "cannot delete existing deployment for selector migration"),
@@ -361,7 +348,7 @@ func TestDeletingDeploymentSelectorMigrator_MigrateDeploymentSelector(t *testing
 		t.Run(name, func(t *testing.T) {
 			migrator := NewDeletingDeploymentSelectorMigrator(t
```

**File**: `internal/controller/pkg/runtime/reconciler.go` (modified, +59/-184)
```diff
@@ -25,7 +25,6 @@ import (
 	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/builder"
@@ -43,7 +42,6 @@ import (
 	"github.com/crossplane/crossplane-runtime/v2/pkg/xpkg"
 
 	extv1alpha1 "github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
-	pkgmetav1 "github.com/crossplane/crossplane/apis/v2/pkg/meta/v1"
 	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
 	"github.com/crossplane/crossplane/apis/v2/pkg/v1beta1"
 	"github.com/crossplane/crossplane/v2/internal/controller/pkg/controller"
@@ -59,19 +57,14 @@ const (
 	errGetPackageRevision = "cannot get package revision"
 	errUpdateStatus       = "cannot update package revision status"
 
-	errGetPullConfig = "cannot get image pull secret from config"
-
-	errManifestBuilderOptions = "cannot prepare runtime manifest builder options"
-	errPreHook                = "pre establish runtime hook failed for package"
-	errPostHook               = "post establish runtime hook failed for package"
-	errDeactivateHook         = "deactivation runtime hook failed for package"
+	errRuntimeConfig  = "cannot resolve deployment runtime config for package"
+	errPreHook        = "pre establish runtime hook failed for package"
+	errPostHook       = "post establish runtime hook failed for package"
+	errDeactivateHook = "deactivation runtime hook failed for package"
 
 	errNoRuntimeConfig          = "no deployment runtime config set"
 	errGetRuntimeConfig         = "cannot get referenced deployment runtime config"
 	errUnknownKindRuntimeConfig = "runtime config is set but is an unknown apiVersion and kind"
-	errGetServiceAccount        = "cannot get Crossplane service account"
-
-	errListMRDs = "cannot list ManagedResourceDefinitions to determine whether the provider runtime can start"
 )
 
 // Event reasons.
@@ -115,36 +108,13 @@ func WithRuntimeHooks(h Hooks) ReconcilerOption {
 	}
 }
 
-// WithNamespace specifies the namespace in which the Reconciler should create
-// runtime resources.
-func WithNamespace(n string) ReconcilerOption {
-	return func(r *Reconciler) {
-		r.namespace = n
-	}
-}
-
-// WithServiceAccount specifies the core Crossplane ServiceAccount name.
-func WithServiceAccount(sa string) ReconcilerOption {
-	return func(r *Reconciler) {
-		r.serviceAccount = sa
-	}
-}
-
 // WithFeatureFlags specifies the feature flags to inject into the Reconciler.
 func WithFeatureFlags(f *feature.Flags) ReconcilerOption {
 	return func(r *Reconciler) {
 		r.features = f
 	}
 }
 
-// WithDeploymentSelectorMigrator specifies the deployment selector migrator
-// to use for handling provider deployment selector migrations.
-func WithDeploymentSelectorMigrator(m DeploymentSelectorMigrator) ReconcilerOption {
-	return func(r *Reconciler) {
-		r.migrator = m
-	}
-}
-
 // WithConfigStore specifies how the Reconciler should access image config store.
 func WithConfigStore(c xpkg.ConfigStore) ReconcilerOption {
 	return func(r *Reconciler) {
@@ -154,16 +124,13 @@ func WithConfigStore(c xpkg.ConfigStore) ReconcilerOption {
 
 // Reconciler reconciles packages.
 type Reconciler struct {
-	client         client.Client
-	log            logging.Logger
-	runtimeHook    Hooks
-	record         event.Recorder
-	conditions     conditions.Manager
-	features       *feature.Flags
-	migrator       DeploymentSelectorMigrator
-	namespace      string
-	serviceAccount string
-	pkgConfig      xpkg.ConfigStore
+	client      client.Client
+	log         logging.Logger
+	runtimeHook Hooks
+	record      event.Recorder
+	conditions  conditions.Manager
+	features    *feature.Flags
+	pkgConfig   xpkg.ConfigStore
 
 	newPackageRevisionWithRuntime func() v1.PackageRevisionWithRuntime
 }
@@ -195,11 +162,8 @@ func SetupProviderRevision(mgr ctrl.Manager, o controller.Options) error {
 		WithNewPackageRevisionWithRuntimeFn(nr),
 		WithLogger(log),
 		WithRecorder(event.NewAPIRecorder(mgr.GetEventRecorderFor(name), o.EventFilterFunctions...)),
-		WithNamespace(o.Namespace),
-		WithServiceAccount(o.ServiceAccount),
-		WithRuntimeHooks(NewProviderHooks(mgr.GetClient())),
+		WithRuntimeHooks(NewProviderHooks(mgr.GetClient(), o.Namespace, o.ServiceAccount, NewDeletingDeploymentSelectorMigrator(mgr.GetClient(), log))),
 		WithFeatureFlags(o.Features),
-		WithDeploymentSelectorMigrator(NewDeletingDeploymentSelectorMigrator(mgr.GetClient(), log)),
 		WithConfigStore(xpkg.NewImageConfigStore(mgr.GetClient(), o.Namespace)),
 	)
 
@@ -230,9 +194,7 @@ func SetupFunctionRevision(mgr ctrl.Manager, o controller.Options) error {
 		WithNewPackageRevisionWithRuntimeFn(nr),
 		WithLogger(log),
 		WithRecorder(event.NewAPIRecorder(mgr.GetEventRecorderFor(name), o.EventFilterFunctions...)),
-		WithNamespace(o.Namespace),
-		WithServiceAccount(o.ServiceAccount),
-		WithRuntimeHooks(NewFunctionHooks(mgr.GetClient())),
+
```

**File**: `internal/controller/pkg/runtime/reconciler_test.go` (modified, +64/-618)
```diff
@@ -23,12 +23,10 @@ import (
 	"time"
 
 	"github.com/google/go-cmp/cmp"
-	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime/schema"
-	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/utils/ptr"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/log/zap"
@@ -44,7 +42,6 @@ import (
 	"github.com/crossplane/crossplane-runtime/v2/pkg/test"
 	fakexpkg "github.com/crossplane/crossplane-runtime/v2/pkg/xpkg/fake"
 
-	extv1alpha1 "github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
 	pkgmetav1 "github.com/crossplane/crossplane/apis/v2/pkg/meta/v1"
 	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
 	"github.com/crossplane/crossplane/apis/v2/pkg/v1beta1"
@@ -58,35 +55,35 @@ const (
 
 var _ Hooks = &MockHooks{}
 
-// MockHooks is a mock implementation of Hooks interface.
+// MockHooks is a mock implementation of the Hooks interface.
 type MockHooks struct {
-	MockPre        func(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
-	MockPost       func(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
-	MockDeactivate func(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
+	MockPre        func(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error
+	MockPost       func(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error
+	MockDeactivate func(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error
 }
 
 // Pre calls MockPre if set, otherwise returns nil.
-func (m *MockHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error {
+func (m *MockHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if m.MockPre != nil {
-		return m.MockPre(ctx, pr, b)
+		return m.MockPre(ctx, pr, rc)
 	}
 
 	return nil
 }
 
 // Post calls MockPost if set, otherwise returns nil.
-func (m *MockHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error {
+func (m *MockHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if m.MockPost != nil {
-		return m.MockPost(ctx, pr, b)
+		return m.MockPost(ctx, pr, rc)
 	}
 
 	return nil
 }
 
 // Deactivate calls MockDeactivate if set, otherwise returns nil.
-func (m *MockHooks) Deactivate(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error {
+func (m *MockHooks) Deactivate(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if m.MockDeactivate != nil {
-		return m.MockDeactivate(ctx, pr, b)
+		return m.MockDeactivate(ctx, pr, rc)
 	}
 
 	return nil
@@ -123,10 +120,7 @@ func TestReconcile(t *testing.T) {
 					WithNewPackageRevisionWithRuntimeFn(func() v1.PackageRevisionWithRuntime { return &v1.ProviderRevision{} }),
 					WithLogger(testLog),
 					WithRecorder(event.NewNopRecorder()),
-					WithNamespace(testNamespace),
-					WithServiceAccount(crossplaneName),
 					WithRuntimeHooks(&MockHooks{}),
-					WithDeploymentSelectorMigrator(NewNopDeploymentSelectorMigrator()),
 				},
 			},
 			want: want{
@@ -143,10 +137,7 @@ func TestReconcile(t *testing.T) {
 					WithNewPackageRevisionWithRuntimeFn(func() v1.PackageRevisionWithRuntime { return &v1.ProviderRevision{} }),
 					WithLogger(testLog),
 					WithRecorder(event.NewNopRecorder()),
-					WithNamespace(testNamespace),
-					WithServiceAccount(crossplaneName),
 					WithRuntimeHooks(&MockHooks{}),
-					WithDeploymentSelectorMigrator(NewNopDeploymentSelectorMigrator()),
 				},
 			},
 			want: want{
@@ -174,10 +165,7 @@ func TestReconcile(t *testing.T) {
 					WithNewPackageRevisionWithRuntimeFn(func() v1.PackageRevisionWithRuntime { return &v1.ProviderRevision{} }),
 					WithLogger(testLog),
 					WithRecorder(event.NewNopRecorder()),
-					WithNamespace(testNamespace),
-					WithServiceAccount(crossplaneName),
 					WithRuntimeHooks(&MockHooks{}),
-					WithDeploymentSelectorMigrator(NewNopDeploymentSelectorMigrator()),
 				},
 			},
 			want: want{
@@ -203,10 +191,7 @@ func TestReconcile(t *testing.T) {
 					WithNewPackageRevisionWithRuntimeFn(func() v1.PackageRevisionWithRuntime { return &v1.ProviderRevision{} }),
 					WithLogger(testLog),
 					WithRecorder(event.NewNopRecorder()),
-					WithNamespace(testNamespace),
-					WithServiceAccount(crossplaneName),
 					WithRuntimeHooks(&MockHooks{}),
-					WithDeploymentSelectorMigrator(NewNopDeploymentSelectorMigrator()),
 				},
 			},
 			want: want{
@@ -250,14 +235,11 @@ func TestReconcile(t *testing.T) {
 					WithNewPackageRevisionWithRuntimeFn(func() v1.PackageRevisionWithRuntime { return &v1.ProviderRevision{} }),
 					WithLogger(t
```

**File**: `internal/controller/pkg/runtime/runtime.go` (modified, +59/-306)
```diff
@@ -18,20 +18,16 @@ package runtime
 
 import (
 	"context"
-	"slices"
 
-	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/utils/ptr"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 
 	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
-	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/resource"
 
-	extv1alpha1 "github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
-	pkgmetav1 "github.com/crossplane/crossplane/apis/v2/pkg/meta/v1"
 	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
 	"github.com/crossplane/crossplane/apis/v2/pkg/v1beta1"
 )
@@ -96,37 +92,33 @@ var (
 	AppProtocolTLS = "tls"
 )
 
-// ManifestBuilder builds the runtime manifests for a package revision.
-type ManifestBuilder interface {
-	// ServiceAccount builds and returns the service account manifest.
-	ServiceAccount(overrides ...ServiceAccountOverride) *corev1.ServiceAccount
-	// Deployment builds and returns the deployment manifest.
-	Deployment(serviceAccount string, overrides ...DeploymentOverride) *appsv1.Deployment
-	// Service builds and returns the service manifest.
-	Service(overrides ...ServiceOverride) *corev1.Service
-	// TLSClientSecret builds and returns the TLS client secret manifest.
-	TLSClientSecret() *corev1.Secret
-	// TLSServerSecret builds and returns the TLS server secret manifest.
-	TLSServerSecret() *corev1.Secret
-}
-
-// A Hooks performs runtime operations before and after a revision
-// establishes objects.
+// A Hooks manages the runtime objects of a package's revisions. There is
+// one implementation per package type, constructed once when the runtime
+// controller is set up.
 type Hooks interface {
-	// Pre performs operations meant to happen before establishing objects.
-	Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
-
-	// Post performs operations meant to happen after establishing objects.
-	Post(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
-
-	// Deactivate performs operations meant to happen before deactivating a revision.
-	Deactivate(ctx context.Context, pr v1.PackageRevisionWithRuntime, b ManifestBuilder) error
+	// Pre performs operations meant to happen before a revision establishes
+	// its objects.
+	Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error
+
+	// Post performs operations meant to happen after a revision establishes
+	// its objects. Once the runtime is available it marks the revision's
+	// RuntimeHealthy and RuntimeActive conditions, reporting whether the
+	// runtime is scaled up or scaled to zero awaiting activation of its first
+	// ManagedResourceDefinition.
+	Post(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error
+
+	// Deactivate performs operations meant to happen before deactivating a
+	// revision.
+	Deactivate(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error
 }
 
 const (
 	errCopyRuntimeObject      = "cannot copy package runtime object for deletion"
 	errGetRuntimeDeployment   = "cannot get package runtime deployment for deletion"
 	errGetSharedRuntimeObject = "cannot get existing package runtime object"
+
+	errGetServiceAccount = "cannot get Crossplane service account"
+	errGetPullConfig     = "cannot get image pull secret from config"
 )
 
 func deleteRuntimeObjectControlledBy(ctx context.Context, c client.Client, owner metav1.Object, obj client.Object) error {
@@ -150,28 +142,6 @@ func deleteRuntimeObjectControlledBy(ctx context.Context, c client.Client, owner
 	return c.Delete(ctx, current, client.Preconditions{UID: new(current.GetUID())})
 }
 
-// DeploymentRuntimeBuilder builds the Deployment runtime manifests for
-// a package revision.
-type DeploymentRuntimeBuilder struct {
-	revision                  v1.PackageRevisionWithRuntime
-	namespace                 string
-	serviceAccountPullSecrets []corev1.LocalObjectReference
-	runtimeConfig             *v1beta1.DeploymentRuntimeConfig
-	pullSecrets               []string
-	awaitingActivation        bool
-}
-
-// BuilderOption is used to configure a DeploymentRuntimeBuilder.
-type BuilderOption func(*DeploymentRuntimeBuilder)
-
-// BuilderWithRuntimeConfig sets the deployment runtime config to
-// use when building the runtime manifests.
-func BuilderWithRuntimeConfig(rc *v1beta1.DeploymentRuntimeConfig) BuilderOption {
-	return func(b *DeploymentRuntimeBuilder) {
-		b.runtimeConfig = rc
-	}
-}
-
 // applyRuntimeObject applies runtime manifests using SSA.
 func applyRuntimeObject(ctx context.Context, c client.Client, obj client.Object) error {
 	return c.Patch(
@@ -239,276 +209,59 @@ func demotedControllers(obj metav1.Object, owner metav1.Object) []metav1.OwnerRe
 	return ors
 }
 
-// BuilderWithServiceAccountPullSecrets sets 
```

**File**: `internal/controller/pkg/runtime/runtime_function.go` (modified, +224/-35)
```diff
@@ -27,11 +27,13 @@ import (
 	"k8s.io/apimachinery/pkg/util/intstr"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 
+	"github.com/crossplane/crossplane-runtime/v2/pkg/conditions"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/resource"
 
 	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
+	"github.com/crossplane/crossplane/apis/v2/pkg/v1beta1"
 	"github.com/crossplane/crossplane/v2/internal/initializer"
 )
 
@@ -49,20 +51,31 @@ const (
 // FunctionHooks performs runtime operations for function packages.
 type FunctionHooks struct {
 	client resource.ClientApplicator
+
+	// namespace is the namespace in which runtime objects are created.
+	namespace string
+	// coreServiceAccount is the name of the core Crossplane ServiceAccount. We
+	// propagate its image pull secrets to the runtime ServiceAccount.
+	coreServiceAccount string
+
+	conditions conditions.Manager
 }
 
 // NewFunctionHooks returns a new FunctionHooks.
-func NewFunctionHooks(client client.Client) *FunctionHooks {
+func NewFunctionHooks(c client.Client, namespace, coreServiceAccount string) *FunctionHooks {
 	return &FunctionHooks{
 		client: resource.ClientApplicator{
-			Client:     client,
-			Applicator: resource.NewAPIPatchingApplicator(client),
+			Client:     c,
+			Applicator: resource.NewAPIPatchingApplicator(c),
 		},
+		namespace:          namespace,
+		coreServiceAccount: coreServiceAccount,
+		conditions:         conditions.ObservedGenerationPropagationManager{},
 	}
 }
 
 // Pre performs operations meant to happen before establishing objects.
-func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, build ManifestBuilder) error {
+func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if pr.GetDesiredState() != v1.PackageRevisionActive {
 		return nil
 	}
@@ -77,7 +90,7 @@ func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 	// generating certificates requires the service to be defined. This is why
 	// we're creating the service here but service account and deployment in the
 	// post-establish.
-	svc := build.Service(functionServiceOverrides()...)
+	svc := h.service(pr, rc)
 	if err := applySharedRuntimeObject(ctx, h.client.Client, pr, svc); err != nil {
 		return errors.Wrap(err, errApplyFunctionService)
 	}
@@ -90,7 +103,7 @@ func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 
 	fRev.Status.Endpoint = fmt.Sprintf(ServiceEndpointFmt, svc.Name, svc.Namespace, GRPCPort)
 
-	secServer := build.TLSServerSecret()
+	secServer := h.tlsServerSecret(pr)
 
 	if secServer == nil {
 		// We should wait for the package manager to set the secret name on the
@@ -113,20 +126,30 @@ func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 }
 
 // Post performs operations meant to happen after establishing objects.
-func (h *FunctionHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRuntime, build ManifestBuilder) error {
+func (h *FunctionHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if pr.GetDesiredState() != v1.PackageRevisionActive {
 		return nil
 	}
 
-	sa := build.ServiceAccount()
+	saPullSecrets, err := corePullSecrets(ctx, h.client.Client, h.namespace, h.coreServiceAccount)
+	if err != nil {
+		return err
+	}
+
+	pullSecrets, err := imageConfigPullSecrets(ctx, h.client.Client, pr)
+	if err != nil {
+		return err
+	}
+
+	sa := h.serviceAccount(pr, rc, saPullSecrets)
 
 	// Determine the function's image.
 	image, err := name.ParseReference(pr.GetResolvedSource(), name.StrictValidation)
 	if err != nil {
 		return errors.Wrap(err, errParseFunctionImage)
 	}
 
-	d := build.Deployment(sa.Name, functionDeploymentOverrides(pr, image.Name())...)
+	d := h.deployment(pr, rc, sa.Name, image.Name(), pullSecrets)
 	// Create/Apply the SA only if the deployment references it.
 	// This is to avoid creating a SA that is NOT used by the deployment when
 	// the SA is managed externally by the user and configured by setting
@@ -144,25 +167,26 @@ func (h *FunctionHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 
 	for _, c := range d.Status.Conditions {
 		if c.Type == appsv1.DeploymentAvailable {
-			if c.Status == corev1.ConditionTrue {
-				return nil
+			if c.Status != corev1.ConditionTrue {
+				return errors.Errorf(errFmtUnavailableFunctionDeployment, c.Message)
 			}
 
-			return errors.Errorf(errFmtUnavailableFunctionDeployment, c.Message)
+			h.conditions.For(pr).MarkConditions(v1.RuntimeHealthy(), v1.RuntimeActive())
+
+			return nil
 		}
 	}
 
 	return errors.New(errNoAvailableConditionFunctionDeployment)
 }
 
 // Deactivate performs operations meant to happen before deactivating a revision.
-func (h *FunctionHooks) Deactivate(ctx context.Context, pr
```

**File**: `internal/controller/pkg/runtime/runtime_function_test.go` (modified, +30/-201)
```diff
@@ -33,17 +33,16 @@ import (
 	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/test"
 
+	xpv2 "github.com/crossplane/crossplane/apis/v2/core/v2"
 	pkgmetav1 "github.com/crossplane/crossplane/apis/v2/pkg/meta/v1"
 	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
-	"github.com/crossplane/crossplane/v2/internal/controller/pkg/revision"
 )
 
 func TestFunctionPreHook(t *testing.T) {
 	type args struct {
-		client    client.Client
-		pkg       runtime.Object
-		rev       v1.PackageRevisionWithRuntime
-		manifests ManifestBuilder
+		client client.Client
+		pkg    runtime.Object
+		rev    v1.PackageRevisionWithRuntime
 	}
 
 	type want struct {
@@ -63,6 +62,7 @@ func TestFunctionPreHook(t *testing.T) {
 					Spec: pkgmetav1.FunctionSpec{},
 				},
 				rev: &v1.FunctionRevision{
+					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{v1.LabelParentPackage: "some-service"}},
 					Spec: v1.FunctionRevisionSpec{
 						PackageRevisionSpec: v1.PackageRevisionSpec{
 							DesiredState: v1.PackageRevisionActive,
@@ -72,19 +72,6 @@ func TestFunctionPreHook(t *testing.T) {
 						},
 					},
 				},
-				manifests: &MockManifestBuilder{
-					ServiceFn: func(_ ...ServiceOverride) *corev1.Service {
-						return &corev1.Service{
-							ObjectMeta: metav1.ObjectMeta{
-								Name:      "some-service",
-								Namespace: "some-namespace",
-							},
-						}
-					},
-					TLSServerSecretFn: func() *corev1.Secret {
-						return &corev1.Secret{}
-					},
-				},
 				client: &test.MockClient{
 					MockGet: func(_ context.Context, _ client.ObjectKey, _ client.Object) error {
 						return nil
@@ -99,6 +86,7 @@ func TestFunctionPreHook(t *testing.T) {
 			},
 			want: want{
 				rev: &v1.FunctionRevision{
+					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{v1.LabelParentPackage: "some-service"}},
 					Spec: v1.FunctionRevisionSpec{
 						PackageRevisionSpec: v1.PackageRevisionSpec{
 							DesiredState: v1.PackageRevisionActive,
@@ -108,7 +96,7 @@ func TestFunctionPreHook(t *testing.T) {
 						},
 					},
 					Status: v1.FunctionRevisionStatus{
-						Endpoint: fmt.Sprintf(ServiceEndpointFmt, "some-service", "some-namespace", revision.ServicePort),
+						Endpoint: fmt.Sprintf(ServiceEndpointFmt, "some-service", namespace, GRPCPort),
 						PackageRevisionRuntimeStatus: v1.PackageRevisionRuntimeStatus{
 							TLSServerSecretName: new("some-server-secret"),
 						},
@@ -121,24 +109,11 @@ func TestFunctionPreHook(t *testing.T) {
 			args: args{
 				pkg: &pkgmetav1.Function{},
 				rev: &v1.FunctionRevision{
-					ObjectMeta: metav1.ObjectMeta{Name: incoming.Name, UID: incoming.UID},
+					ObjectMeta: metav1.ObjectMeta{Name: incoming.Name, UID: incoming.UID, Labels: map[string]string{v1.LabelParentPackage: "shared-service"}},
 					Spec: v1.FunctionRevisionSpec{
 						PackageRevisionSpec: v1.PackageRevisionSpec{DesiredState: v1.PackageRevisionActive},
 					},
 				},
-				manifests: &MockManifestBuilder{
-					ServiceFn: func(_ ...ServiceOverride) *corev1.Service {
-						return &corev1.Service{ObjectMeta: metav1.ObjectMeta{
-							Name:      "shared-service",
-							Namespace: "some-namespace",
-						}}
-					},
-					// The builder returns nil for the secret until the revision knows
-					// what its secret is called.
-					TLSServerSecretFn: func() *corev1.Secret {
-						return nil
-					},
-				},
 				client: &test.MockClient{
 					MockGet: test.NewMockGetFn(nil),
 					MockPatch: func(_ context.Context, obj client.Object, _ client.Patch, _ ...client.PatchOption) error {
@@ -151,12 +126,12 @@ func TestFunctionPreHook(t *testing.T) {
 			},
 			want: want{
 				rev: &v1.FunctionRevision{
-					ObjectMeta: metav1.ObjectMeta{Name: incoming.Name, UID: incoming.UID},
+					ObjectMeta: metav1.ObjectMeta{Name: incoming.Name, UID: incoming.UID, Labels: map[string]string{v1.LabelParentPackage: "shared-service"}},
 					Spec: v1.FunctionRevisionSpec{
 						PackageRevisionSpec: v1.PackageRevisionSpec{DesiredState: v1.PackageRevisionActive},
 					},
 					Status: v1.FunctionRevisionStatus{
-						Endpoint: fmt.Sprintf(ServiceEndpointFmt, "shared-service", "some-namespace", revision.ServicePort),
+						Endpoint: fmt.Sprintf(ServiceEndpointFmt, "shared-service", namespace, GRPCPort),
 					},
 				},
 			},
@@ -166,29 +141,14 @@ func TestFunctionPreHook(t *testing.T) {
 			args: args{
 				pkg: &pkgmetav1.Function{},
 				rev: &v1.FunctionRevision{
-					ObjectMeta: metav1.ObjectMeta{Name: incoming.Name, UID: incoming.UID},
+					ObjectMeta: metav1.ObjectMeta{Name: incoming.Name, UID: incoming.UID, Labels: map[string]string{v1.LabelParentPackage: "shared-service"}},
 					Spec: v1.FunctionRevisionSpec{
 						PackageRevisionSpec: v1.PackageRevisionSpec{DesiredState: v1.PackageRevisionActive},
 						PackageRevisionRuntimeSpec: v1.PackageRevisionRuntimeSpec{
 							TLSServerSecretName: new("server-tls"),
 						},
 					},
 				},
-				
```

**File**: `internal/controller/pkg/runtime/runtime_provider.go` (modified, +332/-51)
```diff
@@ -24,15 +24,18 @@ import (
 	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/intstr"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 
+	"github.com/crossplane/crossplane-runtime/v2/pkg/conditions"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/resource"
 
+	extv1alpha1 "github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
+	pkgmetav1 "github.com/crossplane/crossplane/apis/v2/pkg/meta/v1"
 	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
+	"github.com/crossplane/crossplane/apis/v2/pkg/v1beta1"
 	"github.com/crossplane/crossplane/v2/internal/controller/pkg/revision"
 	"github.com/crossplane/crossplane/v2/internal/initializer"
 )
@@ -47,29 +50,60 @@ const (
 	errFmtUnavailableProviderDeployment       = "provider package deployment is unavailable with message: %s"
 	errNoAvailableConditionProviderDeployment = "provider package deployment has no condition of type \"Available\" yet"
 	errParseProviderImage                     = "cannot parse provider package image"
+	errMigrateProviderDeployment              = "cannot migrate provider package deployment selector"
+	errListMRDs                               = "cannot list ManagedResourceDefinitions to determine whether the provider runtime can start"
+
+	msgAwaitingActivation = "Package runtime is scaled to zero; awaiting the first ManagedResourceDefinition to be activated"
 )
 
 // ProviderHooks performs runtime operations for provider packages.
 type ProviderHooks struct {
 	client resource.ClientApplicator
+
+	// namespace is the namespace in which runtime objects are created.
+	namespace string
+	// coreServiceAccount is the name of the core Crossplane ServiceAccount. We
+	// propagate its image pull secrets to the runtime ServiceAccount.
+	coreServiceAccount string
+
+	migrator DeploymentSelectorMigrator
+
+	conditions conditions.Manager
 }
 
 // NewProviderHooks returns a new ProviderHooks.
-func NewProviderHooks(client client.Client) *ProviderHooks {
+func NewProviderHooks(c client.Client, namespace, coreServiceAccount string, m DeploymentSelectorMigrator) *ProviderHooks {
+	if m == nil {
+		m = NewNopDeploymentSelectorMigrator()
+	}
+
 	return &ProviderHooks{
 		client: resource.ClientApplicator{
-			Client:     client,
-			Applicator: resource.NewAPIPatchingApplicator(client),
+			Client:     c,
+			Applicator: resource.NewAPIPatchingApplicator(c),
 		},
+		namespace:          namespace,
+		coreServiceAccount: coreServiceAccount,
+		migrator:           m,
+		conditions:         conditions.ObservedGenerationPropagationManager{},
 	}
 }
 
 // Pre performs operations meant to happen before establishing objects.
-func (h *ProviderHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, build ManifestBuilder) error {
+func (h *ProviderHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if pr.GetDesiredState() != v1.PackageRevisionActive {
 		return nil
 	}
 
+	// Migrate the deployment selector if needed. This has to happen before we
+	// apply anything, so that a deployment with an outdated selector is deleted
+	// and recreated by the post-establish step. Only the deployment's name and
+	// namespace matter here.
+	sa := h.serviceAccount(pr, rc, nil)
+	if err := h.migrator.MigrateDeploymentSelector(ctx, pr, h.deployment(pr, rc, sa.Name, "", nil, false)); err != nil {
+		return errors.Wrap(err, errMigrateProviderDeployment)
+	}
+
 	pr.SetObservedTLSServerSecretName(pr.GetTLSServerSecretName())
 	pr.SetObservedTLSClientSecretName(pr.GetTLSClientSecretName())
 
@@ -80,13 +114,13 @@ func (h *ProviderHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 	// generating certificates requires the service to be defined. This is why
 	// we're creating the service here but service account and deployment in the
 	// post-establish.
-	svc := build.Service(providerServiceOverrides()...)
+	svc := h.service(pr, rc)
 	if err := applySharedRuntimeObject(ctx, h.client.Client, pr, svc); err != nil {
 		return errors.Wrap(err, errApplyProviderService)
 	}
 
-	secClient := build.TLSClientSecret()
-	secServer := build.TLSServerSecret()
+	secClient := h.tlsClientSecret(pr)
+	secServer := h.tlsServerSecret(pr)
 
 	if secClient == nil || secServer == nil {
 		// We should wait for the provider revision reconciler to set the secret
@@ -97,6 +131,7 @@ func (h *ProviderHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 	if err := applySharedRuntimeObject(ctx, h.client.Client, pr, secClient); err != nil {
 		return errors.Wrap(err, errApplyProviderSecret)
 	}
+
 	if err := applySharedRuntimeObject(ctx, h.client.Client, pr, secServer); err != nil {
 		return errors.Wrap(err, errApplyProviderSecret)
 	}
@@ -113,20 +148,37 @@ func (h *Prov
```

---

### Incident Patch 7: `be5e14c7` (2026-09-30)
**Commit Message**: fix(deps): update module github.com/prometheus/client_golang to v1.24.1

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -200,10 +200,10 @@ require (
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
 	github.com/opencontainers/go-digest v1.0.0 // indirect
 	github.com/opencontainers/image-spec v1.1.1 // indirect
-	github.com/prometheus/client_golang v1.23.2
+	github.com/prometheus/client_golang v1.24.1
 	github.com/prometheus/client_model v0.6.2 // indirect
-	github.com/prometheus/common v0.67.5 // indirect
-	github.com/prometheus/procfs v0.20.1 // indirect
+	github.com/prometheus/common v0.70.1 // indirect
+	github.com/prometheus/procfs v0.21.1 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
 	github.com/spf13/cobra v1.10.2 // indirect
 	github.com/spf13/pflag v1.0.10 // indirect
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -447,14 +447,14 @@ github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINE
 github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 h1:Jamvg5psRIccs7FGNTlIRMkT8wgtp5eCXdBlqhYGL6U=
 github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
-github.com/prometheus/client_golang v1.23.2 h1:Je96obch5RDVy3FDMndoUsjAhG5Edi49h0RJWRi/o0o=
-github.com/prometheus/client_golang v1.23.2/go.mod h1:Tb1a6LWHB3/SPIzCoaDXI4I8UHKeFTEQ1YCr+0Gyqmg=
+github.com/prometheus/client_golang v1.24.1 h1:JnJkREXzWxUdCuPFpIWZiPispT9xVV59uiuyR2bPlnU=
+github.com/prometheus/client_golang v1.24.1/go.mod h1:F+oSRECHg4sse5ucfYpYDeIv/hu68Zo0uoHKetWnzcE=
 github.com/prometheus/client_model v0.6.2 h1:oBsgwpGs7iVziMvrGhE53c/GrLUsZdHnqNwqPLxwZyk=
 github.com/prometheus/client_model v0.6.2/go.mod h1:y3m2F6Gdpfy6Ut/GBsUqTWZqCUvMVzSfMLjcu6wAwpE=
-github.com/prometheus/common v0.67.5 h1:pIgK94WWlQt1WLwAC5j2ynLaBRDiinoAb86HZHTUGI4=
-github.com/prometheus/common v0.67.5/go.mod h1:SjE/0MzDEEAyrdr5Gqc6G+sXI67maCxzaT3A2+HqjUw=
-github.com/prometheus/procfs v0.20.1 h1:XwbrGOIplXW/AU3YhIhLODXMJYyC1isLFfYCsTEycfc=
-github.com/prometheus/procfs v0.20.1/go.mod h1:o9EMBZGRyvDrSPH1RqdxhojkuXstoe4UlK79eF5TGGo=
+github.com/prometheus/common v0.70.1 h1:1HvjP4D5oL3t8RsPlwxA9onvvStjtIHYE5XuuwOi/PY=
+github.com/prometheus/common v0.70.1/go.mod h1:VdFUQDMZK3VLkurFUVhia6uys/0suUp86TJz5qbJRhc=
+github.com/prometheus/procfs v0.21.1 h1:GljZCt+zSTS+NZq88cyQ1LjZ+RCHp3uVuabBWA5+OJI=
+github.com/prometheus/procfs v0.21.1/go.mod h1:aB55Cww9pdSJVHk0hUf0inxWyyjPogFIjmHKYgMKmtY=
 github.com/robfig/cron/v3 v3.0.1 h1:WdRxkvbJztn8LMz/QEvLN5sBU+xKpSqwwUO1Pjr4qDs=
 github.com/robfig/cron/v3 v3.0.1/go.mod h1:eQICP3HwyT7UooqI/z+Ov+PtYAWygg1TEWWzGIFLtro=
 github.com/rogpeppe/go-internal v1.14.1 h1:UQB4HGPB6osV0SQTLymcB4TgvyWu6ZyliaW0tI/otEQ=
```

**File**: `nix/vendor-hashes.nix` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # by hand.)
 {
   # Root module: github.com/crossplane/crossplane/v2
-  root = "sha256-0+NHQuKd+tf54t+/9/82OpYYAbZGE16PhRnbWb1kb84=";
+  root = "sha256-PtnZ0gWG+HDSASmacqsmjt58QQUZa1m1DIdiSJtUTsI=";
 
   # apis module: github.com/crossplane/crossplane/apis/v2
   apis = "sha256-LBPg9GFga3rvI5D487ydw+AyE7ezHP07ukxX3PcWLUA=";
```

---

### Incident Patch 8: `c7aa58a6` (2026-09-28)
**Commit Message**: pkg: Remove the unused manifest builder code

Now that the function and provider hooks build their own objects, remove the
unused shared code.

Signed-off-by: Adam Wolfe Gordon <[REDACTED_EMAIL]>

**File**: `internal/controller/pkg/runtime/runtime.go` (modified, +0/-301)
```diff
@@ -18,21 +18,16 @@ package runtime
 
 import (
 	"context"
-	"slices"
 
-	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/utils/ptr"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 
 	"github.com/crossplane/crossplane-runtime/v2/pkg/errors"
-	"github.com/crossplane/crossplane-runtime/v2/pkg/meta"
 	"github.com/crossplane/crossplane-runtime/v2/pkg/resource"
 
-	extv1alpha1 "github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
-	pkgmetav1 "github.com/crossplane/crossplane/apis/v2/pkg/meta/v1"
 	v1 "github.com/crossplane/crossplane/apis/v2/pkg/v1"
 	"github.com/crossplane/crossplane/apis/v2/pkg/v1beta1"
 )
@@ -147,28 +142,6 @@ func deleteRuntimeObjectControlledBy(ctx context.Context, c client.Client, owner
 	return c.Delete(ctx, current, client.Preconditions{UID: new(current.GetUID())})
 }
 
-// DeploymentRuntimeBuilder builds the Deployment runtime manifests for
-// a package revision.
-type DeploymentRuntimeBuilder struct {
-	revision                  v1.PackageRevisionWithRuntime
-	namespace                 string
-	serviceAccountPullSecrets []corev1.LocalObjectReference
-	runtimeConfig             *v1beta1.DeploymentRuntimeConfig
-	pullSecrets               []string
-	awaitingActivation        bool
-}
-
-// BuilderOption is used to configure a DeploymentRuntimeBuilder.
-type BuilderOption func(*DeploymentRuntimeBuilder)
-
-// BuilderWithRuntimeConfig sets the deployment runtime config to
-// use when building the runtime manifests.
-func BuilderWithRuntimeConfig(rc *v1beta1.DeploymentRuntimeConfig) BuilderOption {
-	return func(b *DeploymentRuntimeBuilder) {
-		b.runtimeConfig = rc
-	}
-}
-
 // applyRuntimeObject applies runtime manifests using SSA.
 func applyRuntimeObject(ctx context.Context, c client.Client, obj client.Object) error {
 	return c.Patch(
@@ -292,277 +265,3 @@ func imageConfigPullSecrets(ctx context.Context, c client.Client, pr v1.PackageR
 
 	return nil, nil
 }
-
-// BuilderWithServiceAccountPullSecrets sets the service account
-// pull secrets to use when building the runtime manifests.
-func BuilderWithServiceAccountPullSecrets(secrets []corev1.LocalObjectReference) BuilderOption {
-	return func(b *DeploymentRuntimeBuilder) {
-		b.serviceAccountPullSecrets = secrets
-	}
-}
-
-// BuilderWithPullSecrets sets the pull secrets to use when
-// building the runtime manifests.
-func BuilderWithPullSecrets(secrets ...string) BuilderOption {
-	return func(b *DeploymentRuntimeBuilder) {
-		b.pullSecrets = secrets
-	}
-}
-
-// BuilderWithMRDs configures the builder with the ManagedResourceDefinitions
-// owned by the package revision. If the revision has the safe-start capability
-// and all its owned MRDs are inactive, the builder scales the Deployment to
-// zero replicas until the first MRD is activated.
-func BuilderWithMRDs(mrds []extv1alpha1.ManagedResourceDefinition) BuilderOption {
-	return func(b *DeploymentRuntimeBuilder) {
-		if !pkgmetav1.CapabilitiesContainFuzzyMatch(b.revision.GetCapabilities(), pkgmetav1.ProviderCapabilitySafeStart) {
-			return
-		}
-		// One-way latch: once the runtime has been activated, never scale it
-		// back to zero even if MRDs later appear inactive (deactivation is not
-		// yet supported, but guard against manual edits or future changes).
-		if b.revision.GetCondition(v1.TypeRuntimeActive).Reason == v1.ReasonActiveRuntime {
-			return
-		}
-		if len(mrds) == 0 {
-			return
-		}
-		for _, mrd := range mrds {
-			if mrd.Spec.State.IsActive() {
-				return
-			}
-		}
-		b.awaitingActivation = true
-	}
-}
-
-// AwaitingActivation reports whether the builder has determined that the
-// package runtime should be scaled to zero, awaiting activation of its first
-// ManagedResourceDefinition.
-func (b *DeploymentRuntimeBuilder) AwaitingActivation() bool {
-	return b.awaitingActivation
-}
-
-// NewDeploymentRuntimeBuilder returns a new DeploymentRuntimeBuilder.
-func NewDeploymentRuntimeBuilder(pwr v1.PackageRevisionWithRuntime, namespace string, opts ...BuilderOption) *DeploymentRuntimeBuilder {
-	b := &DeploymentRuntimeBuilder{
-		namespace: namespace,
-		revision:  pwr,
-	}
-
-	for _, o := range opts {
-		o(b)
-	}
-
-	return b
-}
-
-// ServiceAccount builds and returns the ServiceAccount manifest.
-func (b *DeploymentRuntimeBuilder) ServiceAccount(overrides ...ServiceAccountOverride) *corev1.ServiceAccount {
-	sa := &corev1.ServiceAccount{}
-	if b.runtimeConfig != nil {
-		sa = serviceAccountFromRuntimeConfig(b.runtimeConfig.Spec.ServiceAccountTemplate)
-	}
-
-	sa.TypeMeta = metav1.TypeMeta{
-		APIVersion: corev1.SchemeGroupVersion.String(),
-		Kind:       "ServiceAccount",
-	}
-
-	// The overrides passed to the function go last so that they can override
-	// the ones we set here.
-	allOverrides := slices.Concat([]ServiceAccountOverride{
-		// Optional defaults, will be used only if the runtime config does not
-		// specify them.
-		ServiceAccountWi
```

---

### Incident Patch 9: `48ff3ec1` (2026-09-25)
**Commit Message**: pkg: Build function runtime objects without the shared builder

Build function runtime objects directly in the hooks, rather than using the
shared manifest builder. This makes the code easier to understand and will let
us cleanly make changes that apply only to functions without affecting
providers.

Signed-off-by: Adam Wolfe Gordon <[REDACTED_EMAIL]>

**File**: `internal/controller/pkg/runtime/runtime_function.go` (modified, +190/-41)
```diff
@@ -74,20 +74,12 @@ func NewFunctionHooks(c client.Client, namespace, coreServiceAccount string) *Fu
 	}
 }
 
-// builder returns the manifest builder for a function revision's runtime
-// objects. A nil runtime config means the objects are built from scratch.
-func (h *FunctionHooks) builder(pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig, opts ...BuilderOption) *DeploymentRuntimeBuilder {
-	return NewDeploymentRuntimeBuilder(pr, h.namespace, append([]BuilderOption{BuilderWithRuntimeConfig(rc)}, opts...)...)
-}
-
 // Pre performs operations meant to happen before establishing objects.
 func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if pr.GetDesiredState() != v1.PackageRevisionActive {
 		return nil
 	}
 
-	build := h.builder(pr, rc)
-
 	pr.SetObservedTLSServerSecretName(pr.GetTLSServerSecretName())
 	pr.SetObservedTLSClientSecretName(pr.GetTLSClientSecretName())
 
@@ -98,7 +90,7 @@ func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 	// generating certificates requires the service to be defined. This is why
 	// we're creating the service here but service account and deployment in the
 	// post-establish.
-	svc := build.Service(functionServiceOverrides()...)
+	svc := h.service(pr, rc)
 	if err := applySharedRuntimeObject(ctx, h.client.Client, pr, svc); err != nil {
 		return errors.Wrap(err, errApplyFunctionService)
 	}
@@ -111,7 +103,7 @@ func (h *FunctionHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 
 	fRev.Status.Endpoint = fmt.Sprintf(ServiceEndpointFmt, svc.Name, svc.Namespace, GRPCPort)
 
-	secServer := build.TLSServerSecret()
+	secServer := h.tlsServerSecret(pr)
 
 	if secServer == nil {
 		// We should wait for the package manager to set the secret name on the
@@ -149,20 +141,15 @@ func (h *FunctionHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 		return err
 	}
 
-	build := h.builder(pr, rc,
-		BuilderWithServiceAccountPullSecrets(saPullSecrets),
-		BuilderWithPullSecrets(pullSecrets...),
-	)
-
-	sa := build.ServiceAccount()
+	sa := h.serviceAccount(pr, rc, saPullSecrets)
 
 	// Determine the function's image.
 	image, err := name.ParseReference(pr.GetResolvedSource(), name.StrictValidation)
 	if err != nil {
 		return errors.Wrap(err, errParseFunctionImage)
 	}
 
-	d := build.Deployment(sa.Name, functionDeploymentOverrides(pr, image.Name())...)
+	d := h.deployment(pr, rc, sa.Name, image.Name(), pullSecrets)
 	// Create/Apply the SA only if the deployment references it.
 	// This is to avoid creating a SA that is NOT used by the deployment when
 	// the SA is managed externally by the user and configured by setting
@@ -195,14 +182,11 @@ func (h *FunctionHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 
 // Deactivate performs operations meant to happen before deactivating a revision.
 func (h *FunctionHooks) Deactivate(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
-	build := h.builder(pr, rc)
-
-	sa := build.ServiceAccount()
-	// Delete the deployment if it exists.
-	// Different from the Post runtimeHook, we don't need to pass the
-	// "functionDeploymentOverrides()" here, because we're only interested
-	// in the name and namespace of the deployment to delete it.
-	if err := deleteRuntimeObjectControlledBy(ctx, h.client.Client, pr, build.Deployment(sa.Name)); err != nil {
+	// We're only interested in the name and namespace of the deployment in
+	// order to delete it, so we don't bother resolving the image or the pull
+	// secrets here.
+	sa := h.serviceAccount(pr, rc, nil)
+	if err := deleteRuntimeObjectControlledBy(ctx, h.client.Client, pr, h.deployment(pr, rc, sa.Name, "", nil)); err != nil {
 		return errors.Wrap(err, errDeleteFunctionDeployment)
 	}
 
@@ -222,26 +206,102 @@ func (h *FunctionHooks) Deactivate(ctx context.Context, pr v1.PackageRevisionWit
 	return nil
 }
 
-func functionServiceOverrides() []ServiceOverride {
-	return []ServiceOverride{
-		// We want a headless service so that our gRPC client (i.e. the Crossplane
-		// FunctionComposer) can load balance across the endpoints.
-		// https://kubernetes.io/docs/concepts/services-networking/service/#headless-services
-		ServiceWithClusterIP(corev1.ClusterIPNone),
-		ServiceWithAdditionalPorts([]corev1.ServicePort{
+// serviceAccount builds the ServiceAccount of a function revision's runtime.
+// The supplied pull secrets are appended to the revision's own.
+func (h *FunctionHooks) serviceAccount(pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig, pullSecrets []corev1.LocalObjectReference) *corev1.ServiceAccount {
+	sa := &corev1.ServiceAccount{}
+	if rc != nil {
+		sa = serviceAccountFromRuntimeConfig(rc.Spec.ServiceAccountTemplate)
+	}
+
+	sa.TypeMeta = metav1.TypeMeta{
+		APIVersion: corev1.SchemeGroupVersion.String(),
+		Kind:       "ServiceAccount",
+	}
+
+	for _, o := ra
```

**File**: `internal/controller/pkg/runtime/runtime_test.go` (modified, +89/-9)
```diff
@@ -385,9 +385,9 @@ func TestProviderDeployment(t *testing.T) {
 
 func TestFunctionDeployment(t *testing.T) {
 	type args struct {
-		builder            *DeploymentRuntimeBuilder
+		revision           v1.PackageRevisionWithRuntime
+		runtimeConfig      *v1beta1.DeploymentRuntimeConfig
 		serviceAccountName string
-		overrides          []DeploymentOverride
 	}
 
 	type want struct {
@@ -402,12 +402,8 @@ func TestFunctionDeployment(t *testing.T) {
 		"FunctionDeploymentWithoutRuntimeConfig": {
 			reason: "No overrides should result in a deployment with default values",
 			args: args{
-				builder: &DeploymentRuntimeBuilder{
-					revision:  functionRevision,
-					namespace: namespace,
-				},
+				revision:           functionRevision,
 				serviceAccountName: functionRevisionName,
-				overrides:          functionDeploymentOverrides(functionRevision, functionImage),
 			},
 			want: want{
 				want: deploymentFunction(functionName, functionRevisionName, functionImage),
@@ -417,9 +413,9 @@ func TestFunctionDeployment(t *testing.T) {
 
 	for name, tc := range cases {
 		t.Run(name, func(t *testing.T) {
-			got := tc.args.builder.Deployment(tc.args.serviceAccountName, tc.args.overrides...)
+			got := NewFunctionHooks(nil, namespace, crossplaneName).deployment(tc.args.revision, tc.args.runtimeConfig, tc.args.serviceAccountName, functionImage, nil)
 			if diff := cmp.Diff(tc.want.want, got); diff != "" {
-				t.Errorf("\n%s\nDeployment(...): -want, +got:\n%s\n", tc.reason, diff)
+				t.Errorf("\n%s\ndeployment(...): -want, +got:\n%s\n", tc.reason, diff)
 			}
 		})
 	}
@@ -940,6 +936,77 @@ func TestAwaitingActivation(t *testing.T) {
 	}
 }
 
+func TestFunctionService(t *testing.T) {
+	type args struct {
+		revision      v1.PackageRevisionWithRuntime
+		runtimeConfig *v1beta1.DeploymentRuntimeConfig
+	}
+
+	type want struct {
+		want *corev1.Service
+	}
+
+	cases := map[string]struct {
+		reason string
+		args   args
+		want   want
+	}{
+		"FunctionServiceNoRuntimeConfig": {
+			reason: "A function service should be headless and serve gRPC.",
+			args: args{
+				revision: functionRevision,
+			},
+			want: want{
+				want: &corev1.Service{
+					TypeMeta: metav1.TypeMeta{
+						APIVersion: corev1.SchemeGroupVersion.String(),
+						Kind:       "Service",
+					},
+					ObjectMeta: metav1.ObjectMeta{
+						Name:      functionName,
+						Namespace: namespace,
+						OwnerReferences: []metav1.OwnerReference{
+							{
+								APIVersion:         "pkg.crossplane.io/v1beta1",
+								Kind:               "FunctionRevision",
+								Name:               functionRevisionName,
+								UID:                types.UID(functionRevisionUID),
+								Controller:         new(true),
+								BlockOwnerDeletion: new(true),
+							},
+						},
+					},
+					Spec: corev1.ServiceSpec{
+						ClusterIP: corev1.ClusterIPNone,
+						Selector: map[string]string{
+							v1.LabelFunction: functionName,
+							v1.LabelRevision: functionRevisionName,
+						},
+						Ports: []corev1.ServicePort{
+							{
+								Name:        GRPCPortName,
+								Protocol:    corev1.ProtocolTCP,
+								Port:        GRPCPort,
+								TargetPort:  intstr.FromString(GRPCPortName),
+								AppProtocol: &AppProtocolTLS,
+							},
+						},
+					},
+				},
+			},
+		},
+	}
+
+	for name, tc := range cases {
+		t.Run(name, func(t *testing.T) {
+			got := NewFunctionHooks(nil, namespace, crossplaneName).service(tc.args.revision, tc.args.runtimeConfig)
+			if diff := cmp.Diff(tc.want.want, got); diff != "" {
+				t.Errorf("\n%s\nservice(...): -want, +got:\n%s\n", tc.reason, diff)
+			}
+		})
+	}
+}
+
 func TestCorePullSecrets(t *testing.T) {
 	errBoom := errors.New("boom")
 
@@ -1032,6 +1099,19 @@ func TestImageConfigPullSecrets(t *testing.T) {
 			revision: withRefs(v1.ImageConfigRef{Name: "some-config", Reason: v1.ImageConfigReasonSetPullSecret}),
 			want:     want{secrets: []string{"pull-secret"}},
 		},
+		"EmptyPullSecretName": {
+			reason: "We should return nothing if the applied image config names an empty pull secret.",
+			client: &test.MockClient{MockGet: test.NewMockGetFn(nil, func(o client.Object) error {
+				o.(*v1beta1.ImageConfig).Spec.Registry = &v1beta1.RegistryConfig{
+					Authentication: &v1beta1.RegistryAuthentication{
+						PullSecretRef: corev1.LocalObjectReference{Name: ""},
+					},
+				}
+				return nil
+			})},
+			revision: withRefs(v1.ImageConfigRef{Name: "some-config", Reason: v1.ImageConfigReasonSetPullSecret}),
+			want:     want{},
+		},
 	}
 
 	for name, tc := range cases {
```

---

### Incident Patch 10: `a5d133ad` (2026-09-25)
**Commit Message**: pkg: Build provider runtime objects without the shared builder

Build provider runtime objects directly in the hooks, rather than using the
shared manifest builder. This makes the code easier to understand, and avoids
changes that only apply to functions from affecting providers as well.

Signed-off-by: Adam Wolfe Gordon <[REDACTED_EMAIL]>

**File**: `internal/controller/pkg/runtime/runtime_provider.go` (modified, +266/-58)
```diff
@@ -89,25 +89,18 @@ func NewProviderHooks(c client.Client, namespace, coreServiceAccount string, m D
 	}
 }
 
-// builder returns the manifest builder for a provider revision's runtime
-// objects. A nil runtime config means the objects are built from scratch.
-func (h *ProviderHooks) builder(pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig, opts ...BuilderOption) *DeploymentRuntimeBuilder {
-	return NewDeploymentRuntimeBuilder(pr, h.namespace, append([]BuilderOption{BuilderWithRuntimeConfig(rc)}, opts...)...)
-}
-
 // Pre performs operations meant to happen before establishing objects.
 func (h *ProviderHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
 	if pr.GetDesiredState() != v1.PackageRevisionActive {
 		return nil
 	}
 
-	build := h.builder(pr, rc)
-
 	// Migrate the deployment selector if needed. This has to happen before we
 	// apply anything, so that a deployment with an outdated selector is deleted
 	// and recreated by the post-establish step. Only the deployment's name and
 	// namespace matter here.
-	if err := h.migrator.MigrateDeploymentSelector(ctx, pr, build.Deployment(build.ServiceAccount().Name)); err != nil {
+	sa := h.serviceAccount(pr, rc, nil)
+	if err := h.migrator.MigrateDeploymentSelector(ctx, pr, h.deployment(pr, rc, sa.Name, "", nil, false)); err != nil {
 		return errors.Wrap(err, errMigrateProviderDeployment)
 	}
 
@@ -121,13 +114,13 @@ func (h *ProviderHooks) Pre(ctx context.Context, pr v1.PackageRevisionWithRuntim
 	// generating certificates requires the service to be defined. This is why
 	// we're creating the service here but service account and deployment in the
 	// post-establish.
-	svc := build.Service(providerServiceOverrides()...)
+	svc := h.service(pr, rc)
 	if err := applySharedRuntimeObject(ctx, h.client.Client, pr, svc); err != nil {
 		return errors.Wrap(err, errApplyProviderService)
 	}
 
-	secClient := build.TLSClientSecret()
-	secServer := build.TLSServerSecret()
+	secClient := h.tlsClientSecret(pr)
+	secServer := h.tlsServerSecret(pr)
 
 	if secClient == nil || secServer == nil {
 		// We should wait for the provider revision reconciler to set the secret
@@ -175,21 +168,17 @@ func (h *ProviderHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 		return err
 	}
 
-	build := h.builder(pr, rc,
-		BuilderWithServiceAccountPullSecrets(saPullSecrets),
-		BuilderWithPullSecrets(pullSecrets...),
-		BuilderWithMRDs(mrds),
-	)
+	awaiting := awaitingActivation(pr, mrds)
 
-	sa := build.ServiceAccount()
+	sa := h.serviceAccount(pr, rc, saPullSecrets)
 
 	// Determine the provider's image.
 	image, err := name.ParseReference(pr.GetResolvedSource(), name.StrictValidation)
 	if err != nil {
 		return errors.Wrap(err, errParseProviderImage)
 	}
 
-	d := build.Deployment(sa.Name, providerDeploymentOverrides(pr, image.Name())...)
+	d := h.deployment(pr, rc, sa.Name, image.Name(), pullSecrets, awaiting)
 	// Create/Apply the SA only if the deployment references it.
 	// This is to avoid creating a SA that is not used by the deployment when
 	// the SA is managed externally by the user and configured by setting
@@ -211,7 +200,7 @@ func (h *ProviderHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 				return errors.Errorf(errFmtUnavailableProviderDeployment, c.Message)
 			}
 
-			if build.AwaitingActivation() {
+			if awaiting {
 				h.conditions.For(pr).MarkConditions(v1.RuntimeHealthy(), v1.RuntimeAwaitingActivation().WithMessage(msgAwaitingActivation))
 			} else {
 				h.conditions.For(pr).MarkConditions(v1.RuntimeHealthy(), v1.RuntimeActive())
@@ -226,20 +215,20 @@ func (h *ProviderHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 
 // Deactivate performs operations meant to happen before deactivating a revision.
 func (h *ProviderHooks) Deactivate(ctx context.Context, pr v1.PackageRevisionWithRuntime, rc *v1beta1.DeploymentRuntimeConfig) error {
-	build := h.builder(pr, rc)
-
-	sa := build.ServiceAccount()
-	// Delete the deployment if it exists.
-	// Different from the Post runtimeHook, we don't need to pass the
-	// "providerDeploymentOverrides()" here, because we're only interested
-	// in the name and namespace of the deployment to delete it.
-	if err := deleteRuntimeObjectControlledBy(ctx, h.client.Client, pr, build.Deployment(sa.Name)); err != nil {
+	// We're only interested in the name and namespace of the deployment in
+	// order to delete it, so we don't bother resolving the image, the pull
+	// secrets or the replica count here.
+	sa := h.serviceAccount(pr, rc, nil)
+	if err := deleteRuntimeObjectControlledBy(ctx, h.client.Client, pr, h.deployment(pr, rc, sa.Name, "", nil, false)); err != nil {
 		return errors.Wrap(err, errDeleteProviderDeployment)
 	}
 
 	// TODO(phisco): only added to cleanup the service we were previously
 	// 	deploying for each provider revision, remove in a future release.
-	svc := build.Service(ServiceWithName
```

**File**: `internal/controller/pkg/runtime/runtime_test.go` (modified, +187/-207)
```diff
@@ -116,11 +116,12 @@ var (
 	demoted = metav1.OwnerReference{Name: "outgoing", UID: "outgoing-uid", Controller: new(false), BlockOwnerDeletion: new(true)}
 )
 
-func TestRuntimeManifestBuilderDeployment(t *testing.T) {
+func TestProviderDeployment(t *testing.T) {
 	type args struct {
-		builder            *DeploymentRuntimeBuilder
-		overrides          []DeploymentOverride
+		revision           v1.PackageRevisionWithRuntime
+		runtimeConfig      *v1beta1.DeploymentRuntimeConfig
 		serviceAccountName string
+		awaitingActivation bool
 	}
 
 	type want struct {
@@ -132,33 +133,45 @@ func TestRuntimeManifestBuilderDeployment(t *testing.T) {
 		args   args
 		want   want
 	}{
-		"ProviderDeploymentWithoutRuntimeConfig": {
-			reason: "No overrides should result in a deployment with default values",
+		"ProviderDeploymentNoScrapeAnnotation": {
+			reason: "It should be possible to disable default scrape annotations",
 			args: args{
-				builder: &DeploymentRuntimeBuilder{
-					revision:  providerRevision,
-					namespace: namespace,
+				revision: providerRevision,
+				runtimeConfig: &v1beta1.DeploymentRuntimeConfig{
+					Spec: v1beta1.DeploymentRuntimeConfigSpec{
+						DeploymentTemplate: &v1beta1.DeploymentTemplate{
+							Spec: &appsv1.DeploymentSpec{
+								Template: corev1.PodTemplateSpec{
+									ObjectMeta: metav1.ObjectMeta{
+										Annotations: map[string]string{
+											"prometheus.io/scrape": "false",
+										},
+									},
+									Spec: corev1.PodSpec{},
+								},
+							},
+						},
+					},
 				},
 				serviceAccountName: providerRevisionName,
-				overrides:          providerDeploymentOverrides(providerRevision, providerImage),
 			},
 			want: want{
 				want: deploymentProvider(providerName, providerRevisionName, providerImage, DeploymentWithSelectors(map[string]string{
 					v1.LabelProvider: providerName,
 					v1.LabelRevision: providerRevisionName,
-				})),
+				}), func(deployment *appsv1.Deployment) {
+					deployment.Spec.Template.Annotations = map[string]string{
+						"prometheus.io/scrape": "false",
+					}
+				}),
 			},
 		},
 		"ProviderDeploymentScaleToZero": {
 			reason: "Awaiting activation should scale the deployment to zero replicas",
 			args: args{
-				builder: &DeploymentRuntimeBuilder{
-					revision:           providerRevision,
-					namespace:          namespace,
-					awaitingActivation: true,
-				},
+				revision:           providerRevision,
+				awaitingActivation: true,
 				serviceAccountName: providerRevisionName,
-				overrides:          providerDeploymentOverrides(providerRevision, providerImage),
 			},
 			want: want{
 				want: deploymentProvider(providerName, providerRevisionName, providerImage, DeploymentWithSelectors(map[string]string{
@@ -172,22 +185,18 @@ func TestRuntimeManifestBuilderDeployment(t *testing.T) {
 		"ProviderDeploymentScaleToZeroWithRuntimeConfigReplicas": {
 			reason: "Awaiting activation should scale to zero even when the runtime config sets an explicit replica count",
 			args: args{
-				builder: &DeploymentRuntimeBuilder{
-					revision:           providerRevision,
-					namespace:          namespace,
-					awaitingActivation: true,
-					runtimeConfig: &v1beta1.DeploymentRuntimeConfig{
-						Spec: v1beta1.DeploymentRuntimeConfigSpec{
-							DeploymentTemplate: &v1beta1.DeploymentTemplate{
-								Spec: &appsv1.DeploymentSpec{
-									Replicas: ptr.To[int32](3),
-								},
+				revision:           providerRevision,
+				awaitingActivation: true,
+				runtimeConfig: &v1beta1.DeploymentRuntimeConfig{
+					Spec: v1beta1.DeploymentRuntimeConfigSpec{
+						DeploymentTemplate: &v1beta1.DeploymentTemplate{
+							Spec: &appsv1.DeploymentSpec{
+								Replicas: ptr.To[int32](3),
 							},
 						},
 					},
 				},
 				serviceAccountName: providerRevisionName,
-				overrides:          providerDeploymentOverrides(providerRevision, providerImage),
 			},
 			want: want{
 				want: deploymentProvider(providerName, providerRevisionName, providerImage, DeploymentWithSelectors(map[string]string{
@@ -198,38 +207,55 @@ func TestRuntimeManifestBuilderDeployment(t *testing.T) {
 				}),
 			},
 		},
-		"ProviderDeploymentWithRuntimeConfig": {
-			reason: "Baseline provided by the runtime config should be applied to the deployment",
+		"ProviderDeploymentWithAdvancedRuntimeConfig": {
+			reason: "Baseline provided by the runtime config should be applied to the deployment for advanced use cases",
 			args: args{
-				builder: &DeploymentRuntimeBuilder{
-					revision:  providerRevision,
-					namespace: namespace,
-					runtimeConfig: &v1beta1.DeploymentRuntimeConfig{
-						Spec: v1beta1.DeploymentRuntimeConfigSpec{
-							DeploymentTemplate: &v1beta1.DeploymentTemplate{
-								Spec: &appsv1.DeploymentSpec{
-									Replicas: ptr.To[int32](3),
-									Template: corev1.PodTemplateSpec{
-										ObjectMeta: metav1.ObjectMeta{
-											Labels: map[string]string{
-												"k": "v",
-											},
+
```

---

### Incident Patch 11: `fcf872bf` (2026-09-29)
**Commit Message**: chore(deps): update module go.opentelemetry.io/otel/exporters/otlp/otlptrace to v1.45.0 [security]

**File**: `go.mod` (modified, +9/-7)
```diff
@@ -44,8 +44,10 @@ require (
 	github.com/sigstore/sigstore v1.10.8 // indirect
 	github.com/sirupsen/logrus v1.9.4 // indirect
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
+	go.opentelemetry.io/otel/sdk/metric v1.45.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 )
 
 require (
@@ -127,7 +129,7 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/exp v0.0.0-20260218203240-3dfff04db8fa // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	k8s.io/code-generator v0.35.0 // indirect
 	k8s.io/gengo/v2 v2.0.0-20251215205346-5ee0d033ba5b // indirect
@@ -206,9 +208,9 @@ require (
 	github.com/spf13/cobra v1.10.2 // indirect
 	github.com/spf13/pflag v1.0.10 // indirect
 	github.com/vladimirvivien/gexe v0.4.1 // indirect
-	go.opentelemetry.io/otel v1.44.0 // indirect
-	go.opentelemetry.io/otel/metric v1.44.0 // indirect
-	go.opentelemetry.io/otel/trace v1.44.0 // indirect
+	go.opentelemetry.io/otel v1.45.0 // indirect
+	go.opentelemetry.io/otel/metric v1.45.0 // indirect
+	go.opentelemetry.io/otel/trace v1.45.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.uber.org/zap v1.28.0 // indirect
 	golang.org/x/crypto v0.56.0 // indirect
@@ -221,7 +223,7 @@ require (
 	golang.org/x/time v0.15.0 // indirect
 	golang.org/x/tools v0.49.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.5.0 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
```

**File**: `go.sum` (modified, +18/-18)
```diff
@@ -568,22 +568,22 @@ go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.6
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.67.0/go.mod h1:NoUCKYWK+3ecatC4HjkRktREheMeEtrXoQxrqYFeHSc=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.67.0 h1:OyrsyzuttWTSur2qN/Lm0m2a8yqyIjUVBZcxFPuXq2o=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.67.0/go.mod h1:C2NGBr+kAB4bk3xtMXfZ94gqFDtg/GkI7e9zqGh5Beg=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 h1:88Y4s2C8oTui1LGM6bTWkw0ICGcOLCAI5l6zsD1j20k=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0/go.mod h1:Vl1/iaggsuRlrHf/hfPJPvVag77kKyvrLeD10kpMl+A=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.39.0 h1:in9O8ESIOlwJAEGTkkf34DesGRAc/Pn8qJ7k3r/42LM=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.39.0/go.mod h1:Rp0EXBm5tfnv0WL+ARyO/PHBEaEAT8UUHQ6AGJcSq6c=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
-go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
-go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
+go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
+go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
+go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
+go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
+go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
+go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
+go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
+go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.step.sm/crypto v0.77.7 h1:6azC+pD678Vjju8yXnMDHCZJ+HzFaEmL3sCryiezTIA=
 go.step.sm/crypto v0.77.7/go.mod h1:OW/2sEHwTtDKq70PvSQ5B0JGy/CrLyDKOiVy3YvZMTQ=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -702,10 +702,10 @@ google.golang.org/api v0.280.0 h1:F4OfEHZhZh6a7uTufJAXXVd/2TQ8EjM4vZH+jX/vFYk=
 google.golang.org/api v0.280.0/go.mod h1:oGKmPZRDoD3vdkf6MA7F4VNkR1rxCiuaPSkhsf3EolU=
 google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7 h1:XzmzkmB14QhVhgnawEVsOn6OFsnpyxNPRY9QV01dNB0=
 google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7/go.mod h1:L43LFes82YgSonw6iTXTxXUX1OlULt4AQtkik4ULL/I=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a h1:97PfJ4tCxY5C7NzzgGqQEMZmXbISdvSArNNEOoUGKBg=
+google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a/go.mod h1:1brfde68Npq6+WA75c1EHWPijZEG1kMus61ygPZfn4A=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a h1:qI/YMH1ep2qQtqcp00gMQyoU7mjvbhg88GJKCvfoLj0=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a/go.
```

**File**: `nix/vendor-hashes.nix` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # by hand.)
 {
   # Root module: github.com/crossplane/crossplane/v2
-  root = "sha256-YwyoXJ5zYeSTk/PfSNULOnNf7YEt1XldHXD/3L8nYyk=";
+  root = "sha256-0+NHQuKd+tf54t+/9/82OpYYAbZGE16PhRnbWb1kb84=";
 
   # apis module: github.com/crossplane/crossplane/apis/v2
   apis = "sha256-LBPg9GFga3rvI5D487ydw+AyE7ezHP07ukxX3PcWLUA=";
```

---

### Incident Patch 12: `8e7afaad` (2026-09-28)
**Commit Message**: Merge pull request #7860 from erikmiller-gusto/fix/usage-inuse-label-noop-write

fix: stop rewriting the in-use label on every Usage reconcile

**File**: `internal/controller/protection/usage/reconciler.go` (modified, +2/-5)
```diff
@@ -474,11 +474,8 @@ func (r *Reconciler) Reconcile(ctx context.Context, req reconcile.Request) (reco
 		return reconcile.Result{}, err
 	}
 
-	// Used resource should have in-use label.
-	if used.GetLabels()[inUseLabelKey] != "true" || !used.OwnedBy(uu.GetUID()) {
-		// Note(turkenh): Composite controller will not remove this label with
-		// new reconciles since it uses a patching applicator to update the
-		// resource.
+	if used.GetLabels()[inUseLabelKey] != "true" {
+		// Note(turkenh): the composite controller's patching applicator won't remove this label on later reconciles.
 		meta.AddLabels(used, map[string]string{inUseLabelKey: "true"})
 
 		if err := r.client.Update(ctx, used); err != nil {
```

**File**: `internal/controller/protection/usage/reconciler_test.go` (modified, +47/-0)
```diff
@@ -483,6 +483,53 @@ func TestReconcile(t *testing.T) {
 				r: reconcile.Result{},
 			},
 		},
+		"SuccessDoesNotUpdateUsedResourceAlreadyLabeled": {
+			reason: "We should not update the used resource when it already has the in-use label, even if it has no owner reference to the Usage.",
+			args: args{
+				mgr: &fake.Manager{},
+				u:   func() protection.Usage { return &protection.InternalUsage{} },
+				opts: []ReconcilerOption{
+					WithClientApplicator(xpresource.ClientApplicator{
+						Client: &test.MockClient{
+							MockGet: test.NewMockGetFn(nil, func(obj client.Object) error {
+								if o, ok := obj.(*v1beta1.Usage); ok {
+									o.SetAnnotations(map[string]string{detailsAnnotationKey: reason})
+									o.Spec.Of.ResourceRef = &v1beta1.NamespacedResourceRef{Name: "used"}
+									o.Spec.Reason = &reason
+									return nil
+								}
+								if o, ok := obj.(*composed.Unstructured); ok {
+									o.SetLabels(map[string]string{inUseLabelKey: "true"})
+									return nil
+								}
+								return errors.New("unexpected object type")
+							}),
+							MockUpdate: test.NewMockUpdateFn(nil, func(_ client.Object) error {
+								return errors.New("unexpected update")
+							}),
+							MockStatusUpdate: test.NewMockSubResourceUpdateFn(nil, func(obj client.Object) error {
+								o := obj.(*v1beta1.Usage)
+								if o.Status.GetCondition(xpv2.TypeReady).Status != corev1.ConditionTrue {
+									t.Fatalf("expected ready condition to be true")
+								}
+								return nil
+							}),
+						},
+					}),
+					WithSelectorResolver(fakeSelectorResolver{
+						resourceSelectorFn: func(_ context.Context, _ protection.Usage) error {
+							return nil
+						},
+					}),
+					WithFinalizer(xpresource.FinalizerFns{AddFinalizerFn: func(_ context.Context, _ xpresource.Object) error {
+						return nil
+					}}),
+				},
+			},
+			want: want{
+				r: reconcile.Result{},
+			},
+		},
 		"SuccessNoUsingResource": {
 			reason: "We should return no error once we have successfully reconciled the usage resource.",
 			args: args{
```

---

### Incident Patch 13: `b56f55c0` (2026-09-25)
**Commit Message**: Merge pull request #7865 from phisco/fix-e2e-cluster-nop-resource

**File**: `.github/renovate-base.json5` (modified, +6/-0)
```diff
@@ -28,6 +28,12 @@
     'design/**',
     // We test upgrades, so leave it on an older version on purpose.
     "test/e2e/manifests/pkg/provider/provider-initial.yaml",
+    // provider-nop v0.5.0 made NopResource namespaced, and a CRD's scope can't
+    // change on upgrade.
+    "test/e2e/manifests/pkg/provider/provider-upgrade.yaml",
+    // We test activating a new revision on upgrade, so each package's two
+    // versions must differ.
+    "test/e2e/manifests/pkg/activation/**",
     // We test the revision control hand-off on upgrade, so both versions must
     // remain as they are.
     "test/e2e/manifests/pkg/provider-handoff/**",
```

**File**: `test/e2e/install_test.go` (modified, +3/-3)
```diff
@@ -78,7 +78,7 @@ func TestCrossplaneLifecycle(t *testing.T) {
 				// deletion. How is that possible?
 				funcs.ListedResourcesDeletedWithin(1*time.Minute, composed.NewList(composed.FromReferenceToList(corev1.ObjectReference{
 					APIVersion: "nop.crossplane.io/v1alpha1",
-					Kind:       "NopResource",
+					Kind:       "ClusterNopResource",
 				}))),
 			)).
 			Assess("DeletePrerequisites", funcs.AllOf(
@@ -185,7 +185,7 @@ func TestCrossplaneLifecycle(t *testing.T) {
 				// deletion. How is that possible?
 				funcs.ListedResourcesDeletedWithin(1*time.Minute, composed.NewList(composed.FromReferenceToList(corev1.ObjectReference{
 					APIVersion: "nop.crossplane.io/v1alpha1",
-					Kind:       "NopResource",
+					Kind:       "ClusterNopResource",
 				}))),
 			)).
 			WithTeardown("DeletePrerequisites", funcs.AllOf(
@@ -267,7 +267,7 @@ func TestCrossplaneLifecycle(t *testing.T) {
 				// deletion. How is that possible?
 				funcs.ListedResourcesDeletedWithin(1*time.Minute, composed.NewList(composed.FromReferenceToList(corev1.ObjectReference{
 					APIVersion: "nop.crossplane.io/v1alpha1",
-					Kind:       "NopResource",
+					Kind:       "ClusterNopResource",
 				}))),
 			)).
 			WithTeardown("DeletePrerequisites", funcs.AllOf(
```

**File**: `test/e2e/manifests/apiextensions/composition/legacy/setup/composition-nested.yaml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ spec:
             nop-resource-1:
               resource:
                 apiVersion: nop.crossplane.io/v1alpha1
-                kind: NopResource
+                kind: ClusterNopResource
                 spec:
                   forProvider:
                     conditionAfter:
```

**File**: `test/e2e/manifests/apiextensions/usage/composition/composition-updated.yaml` (modified, +4/-4)
```diff
@@ -26,7 +26,7 @@ spec:
               used-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     labels:
                       usage: used
@@ -42,7 +42,7 @@ spec:
               using-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     # We are delaying deletion of using resource with this finalizer. This is to ensure that the used resource is
                     # not deleted before the using resource. Imagine a scenario where a Release resource using a Cluster resource
@@ -72,14 +72,14 @@ spec:
                     replayDeletion: true
                     of:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
                           usage: used
                     by:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
```

**File**: `test/e2e/manifests/apiextensions/usage/composition/setup/composition.yaml` (modified, +4/-4)
```diff
@@ -22,7 +22,7 @@ spec:
               used-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     labels:
                       usage: used
@@ -38,7 +38,7 @@ spec:
               using-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     # We are delaying deletion of using resource with this finalizer. This is to ensure that the used resource is
                     # not deleted before the using resource. Imagine a scenario where a Release resource using a Cluster resource
@@ -67,14 +67,14 @@ spec:
                   spec:
                     of:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
                           usage: used
                     by:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
```

**File**: `test/e2e/manifests/apiextensions/usage/standalone/with-by/usage.yaml` (modified, +2/-2)
```diff
@@ -6,12 +6,12 @@ spec:
   replayDeletion: true
   of:
     apiVersion: nop.crossplane.io/v1alpha1
-    kind: NopResource
+    kind: ClusterNopResource
     resourceSelector:
         matchLabels:
             foo: bar
   by:
     apiVersion: nop.crossplane.io/v1alpha1
-    kind: NopResource
+    kind: ClusterNopResource
     resourceRef:
       name: using-resource
```

**File**: `test/e2e/manifests/apiextensions/usage/standalone/with-by/used.yaml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 apiVersion: nop.crossplane.io/v1alpha1
-kind: NopResource
+kind: ClusterNopResource
 metadata:
   name: used-resource
   labels:
```

**File**: `test/e2e/manifests/apiextensions/usage/standalone/with-by/using.yaml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 apiVersion: nop.crossplane.io/v1alpha1
-kind: NopResource
+kind: ClusterNopResource
 metadata:
   name: using-resource
 spec:
```

---

### Incident Patch 14: `b451ab61` (2026-09-24)
**Commit Message**: test(e2e): fix tests broken by the provider-nop v0.5.0 bump

provider-nop v0.5.0, which the e2e manifests picked up in #7511, made
NopResource namespaced, moved the cluster scoped kind to
ClusterNopResource, and made the provider safe-start. That broke:

- Tests that compose a NopResource from a legacy, cluster scoped XR,
  which fail with "an empty namespace may not be set when a resource
  name is provided", and tests that create one without a namespace.
- TestProviderUpgrade, which can't upgrade from v0.2.0 because a CRD's
  scope is immutable.
- TestActivationPolicyAutomatic, whose first versions were bumped to the
  same versions as its second ones, so no new revision is ever created.
- The default tests in the provider-runtime-activation suite, which
  disables default activations and so scales their safe-start providers
  to zero.

Use ClusterNopResource where the tests need a cluster scoped managed
resource, pin the upgrade and activation manifests back to their
previous versions and exclude them from Renovate, and only run the
provider-runtime-activation suite's own tests.

Signed-off-by: Philippe Scorsolini <[REDACTED_EMAIL]>

**File**: `.github/renovate-base.json5` (modified, +6/-0)
```diff
@@ -28,6 +28,12 @@
     'design/**',
     // We test upgrades, so leave it on an older version on purpose.
     "test/e2e/manifests/pkg/provider/provider-initial.yaml",
+    // provider-nop v0.5.0 made NopResource namespaced, and a CRD's scope can't
+    // change on upgrade.
+    "test/e2e/manifests/pkg/provider/provider-upgrade.yaml",
+    // We test activating a new revision on upgrade, so each package's two
+    // versions must differ.
+    "test/e2e/manifests/pkg/activation/**",
     // We test the revision control hand-off on upgrade, so both versions must
     // remain as they are.
     "test/e2e/manifests/pkg/provider-handoff/**",
```

**File**: `test/e2e/install_test.go` (modified, +3/-3)
```diff
@@ -78,7 +78,7 @@ func TestCrossplaneLifecycle(t *testing.T) {
 				// deletion. How is that possible?
 				funcs.ListedResourcesDeletedWithin(1*time.Minute, composed.NewList(composed.FromReferenceToList(corev1.ObjectReference{
 					APIVersion: "nop.crossplane.io/v1alpha1",
-					Kind:       "NopResource",
+					Kind:       "ClusterNopResource",
 				}))),
 			)).
 			Assess("DeletePrerequisites", funcs.AllOf(
@@ -185,7 +185,7 @@ func TestCrossplaneLifecycle(t *testing.T) {
 				// deletion. How is that possible?
 				funcs.ListedResourcesDeletedWithin(1*time.Minute, composed.NewList(composed.FromReferenceToList(corev1.ObjectReference{
 					APIVersion: "nop.crossplane.io/v1alpha1",
-					Kind:       "NopResource",
+					Kind:       "ClusterNopResource",
 				}))),
 			)).
 			WithTeardown("DeletePrerequisites", funcs.AllOf(
@@ -267,7 +267,7 @@ func TestCrossplaneLifecycle(t *testing.T) {
 				// deletion. How is that possible?
 				funcs.ListedResourcesDeletedWithin(1*time.Minute, composed.NewList(composed.FromReferenceToList(corev1.ObjectReference{
 					APIVersion: "nop.crossplane.io/v1alpha1",
-					Kind:       "NopResource",
+					Kind:       "ClusterNopResource",
 				}))),
 			)).
 			WithTeardown("DeletePrerequisites", funcs.AllOf(
```

**File**: `test/e2e/manifests/apiextensions/composition/legacy/setup/composition-nested.yaml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ spec:
             nop-resource-1:
               resource:
                 apiVersion: nop.crossplane.io/v1alpha1
-                kind: NopResource
+                kind: ClusterNopResource
                 spec:
                   forProvider:
                     conditionAfter:
```

**File**: `test/e2e/manifests/apiextensions/usage/composition/composition-updated.yaml` (modified, +4/-4)
```diff
@@ -26,7 +26,7 @@ spec:
               used-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     labels:
                       usage: used
@@ -42,7 +42,7 @@ spec:
               using-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     # We are delaying deletion of using resource with this finalizer. This is to ensure that the used resource is
                     # not deleted before the using resource. Imagine a scenario where a Release resource using a Cluster resource
@@ -72,14 +72,14 @@ spec:
                     replayDeletion: true
                     of:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
                           usage: used
                     by:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
```

**File**: `test/e2e/manifests/apiextensions/usage/composition/setup/composition.yaml` (modified, +4/-4)
```diff
@@ -22,7 +22,7 @@ spec:
               used-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     labels:
                       usage: used
@@ -38,7 +38,7 @@ spec:
               using-resource:
                 resource:
                   apiVersion: nop.crossplane.io/v1alpha1
-                  kind: NopResource
+                  kind: ClusterNopResource
                   metadata:
                     # We are delaying deletion of using resource with this finalizer. This is to ensure that the used resource is
                     # not deleted before the using resource. Imagine a scenario where a Release resource using a Cluster resource
@@ -67,14 +67,14 @@ spec:
                   spec:
                     of:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
                           usage: used
                     by:
                       apiVersion: nop.crossplane.io/v1alpha1
-                      kind: NopResource
+                      kind: ClusterNopResource
                       resourceSelector:
                         matchControllerRef: true
                         matchLabels:
```

**File**: `test/e2e/manifests/apiextensions/usage/standalone/with-by/usage.yaml` (modified, +2/-2)
```diff
@@ -6,12 +6,12 @@ spec:
   replayDeletion: true
   of:
     apiVersion: nop.crossplane.io/v1alpha1
-    kind: NopResource
+    kind: ClusterNopResource
     resourceSelector:
         matchLabels:
             foo: bar
   by:
     apiVersion: nop.crossplane.io/v1alpha1
-    kind: NopResource
+    kind: ClusterNopResource
     resourceRef:
       name: using-resource
```

**File**: `test/e2e/manifests/apiextensions/usage/standalone/with-by/used.yaml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 apiVersion: nop.crossplane.io/v1alpha1
-kind: NopResource
+kind: ClusterNopResource
 metadata:
   name: used-resource
   labels:
```

**File**: `test/e2e/manifests/apiextensions/usage/standalone/with-by/using.yaml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 apiVersion: nop.crossplane.io/v1alpha1
-kind: NopResource
+kind: ClusterNopResource
 metadata:
   name: using-resource
 spec:
```

---

### Incident Patch 15: `bbd1a681` (2026-09-22)
**Commit Message**: Merge pull request #7789 from SebTardif/fix/claim-xrd-list-fail-closed

fix: fail closed when a claim cannot list its XRD

**File**: `internal/controller/apiextensions/claim/reconciler.go` (modified, +12/-5)
```diff
@@ -58,6 +58,7 @@ const (
 	errDeleteCDs            = "cannot delete connection details"
 	errRemoveFinalizer      = "cannot remove finalizer from claim"
 	errAddFinalizer         = "cannot add finalizer to claim"
+	errListXRD              = "cannot list CompositeResourceDefinitions"
 	errUpgradeManagedFields = "cannot upgrade composite resource's managed fields from client-side to server-side apply"
 	errSync                 = "cannot bind and sync claim with composite resource"
 	errPropagateCDs         = "cannot propagate connection details from composite resource"
@@ -457,11 +458,17 @@ func (r *Reconciler) Reconcile(ctx context.Context, req reconcile.Request) (reco
 	// We use an index to efficiently look up the XRD for this composite GVK.
 	hasEnforcedComposition := false
 	xrdList := &v1.CompositeResourceDefinitionList{}
-	if err := r.client.List(ctx, xrdList, client.MatchingFields{XRDByCompositeGVKIndex(): compositeGVKKeyFor(r.gvkXR)}); err == nil && len(xrdList.Items) > 0 {
-		// There should only be one XRD for a given composite GVK
-		if xrdList.Items[0].Spec.EnforcedCompositionRef != nil {
-			hasEnforcedComposition = true
-		}
+	if err := r.client.List(ctx, xrdList, client.MatchingFields{XRDByCompositeGVKIndex(): compositeGVKKeyFor(r.gvkXR)}); err != nil {
+		err = errors.Wrap(err, errListXRD)
+		record.Event(cm, event.Warning(reasonBind, err))
+		status.MarkConditions(xpv2.ReconcileError(err))
+		_ = r.client.Status().Update(ctx, cm)
+
+		return reconcile.Result{}, err
+	}
+	// There should only be one XRD for a given composite GVK
+	if len(xrdList.Items) > 0 && xrdList.Items[0].Spec.EnforcedCompositionRef != nil {
+		hasEnforcedComposition = true
 	}
 
 	// Create (if necessary), bind, and sync an XR with the claim.
```

**File**: `internal/controller/apiextensions/claim/reconciler_test.go` (modified, +25/-0)
```diff
@@ -391,6 +391,31 @@ func TestReconcile(t *testing.T) {
 				err: cmpopts.AnyError,
 			},
 		},
+		"ListXRDError": {
+			reason: "We should fail the reconcile if we cannot list XRDs to determine whether composition is enforced",
+			args: args{
+				client: &test.MockClient{
+					MockGet:  test.NewMockGetFn(nil),
+					MockList: test.NewMockListFn(errBoom),
+					MockStatusUpdate: WantClaim(t, NewClaim(func(cm *claim.Unstructured) {
+						cm.SetConditions(xpv2.ReconcileError(errors.Wrap(errBoom, errListXRD)))
+					})),
+				},
+				opts: []ReconcilerOption{
+					WithClaimFinalizer(resource.FinalizerFns{
+						AddFinalizerFn: func(_ context.Context, _ resource.Object) error { return nil },
+					}),
+					WithCompositeSyncer(CompositeSyncerFn(func(_ context.Context, _ *claim.Unstructured, _ *composite.Unstructured, _ bool) error {
+						t.Error("Sync must not run when listing XRDs fails")
+						return nil
+					})),
+				},
+			},
+			want: want{
+				r:   reconcile.Result{},
+				err: cmpopts.AnyError,
+			},
+		},
 		"SyncCompositeError": {
 			reason: "We should fail the reconcile if we can't bind and sync the claim with a composite resource",
 			args: args{
```

#### Recent Merged Pull Requests:
- **PR #7902** (2026-10-05): chore(deps): update dependency renovate to v44.135.0 (main) (@crossplane-renovate[bot])
- **PR #7899** (2026-10-05): chore(deps): update gcr.io/distroless/static docker digest to 5813399 (release-1.20) (@crossplane-renovate[bot])
- **PR #7898** (2026-10-05): chore(deps): update e2e-manifests to v0.6.0 (main) (@crossplane-renovate[bot])
- **PR #7897** (2026-10-05): chore(deps): update renovatebot/github-action action to v46.3.7 (main) (@crossplane-renovate[bot])
- **PR #7896** (closed): fix(nix): pass host ssl certificate bundle into container (@seg-fault200)
- **PR #7895** (2026-10-05): chore(deps): update dependency renovate to v44.133.0 (main) (@crossplane-renovate[bot])
- **PR #7894** (2026-10-05): chore(deps): lock file maintenance (release-2.4) (@crossplane-renovate[bot])
- **PR #7893** (2026-10-05): chore(deps): lock file maintenance (release-2.3) (@crossplane-renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
