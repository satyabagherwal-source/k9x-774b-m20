# Forensic Learning Record (Deep Inspection): crossplane/crossplane

> **Canonical Artifact**: `07_PROJECT_LEARNING/crossplane-crossplane-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crossplane/crossplane](https://github.com/crossplane/crossplane))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:25:40.729Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crossplane/crossplane`
- **Description**: The Cloud Native Control Plane
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 12126 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apis/apiextensions/apiextensions.go`
```
/*
Copyright 2020 The Crossplane Authors.

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

// Package apiextensions contains Kubernetes API groups for extension types of Crossplane.
package apiextensions

import (
	"k8s.io/apimachinery/pkg/runtime"

	v1 "github.com/crossplane/crossplane/apis/v2/apiextensions/v1"
	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1alpha1"
	"github.com/crossplane/crossplane/apis/v2/apiextensions/v1beta1"
	v2 "github.com/crossplane/crossplane/apis/v2/apiextensions/v2"
)

func init() {
	// Register the types with the Scheme so the components can map objects to GroupVersionKinds and back
	AddToSchemes = append(AddToSchemes,
		v1.AddToScheme,
		v1beta1.AddToScheme,
		v1alpha1.AddToScheme,
		v2.AddToScheme,
	)
}

// AddToSchemes may be used to add all resources defined in the project to a Scheme.
var AddToSchemes runtime.SchemeBuilder

// AddToScheme adds all Resources to the Scheme.
func AddToScheme(s *runtime.Scheme) error {
	return AddToSchemes.AddToScheme(s)
}

```

### Core Architecture Module: `apis/apiextensions/v1/composition_common.go`
```
/*
Copyright 2020 The Crossplane Authors.

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

package v1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	xpv2 "github.com/crossplane/crossplane/apis/v2/core/v2"
)

/*
	NOTE(negz): This file contains types that are shared between the Composition
	and CompositionRevision types. It exists so we can copy these types to the
	apiextensions/v1beta1 package without copying the entire Composition type.
	Once we no longer support v1beta1 CompositionRevisions it can be merged back
	into composition_revision_types.go.
*/

// A CompositionMode determines what mode of Composition is used.
type CompositionMode string

const (
	// CompositionModePipeline indicates that a Composition specifies a
	// pipeline of functions, each of which is responsible for producing
	// composed resources that Crossplane should create or update.
	CompositionModePipeline CompositionMode = "Pipeline"
)

// TypeReference is used to refer to a type for declaring compatibility.
type TypeReference struct {
	// APIVersion of the type.
	APIVersion string `json:"apiVersion"`

	// Kind of the type.
	Kind string `json:"kind"`
}

// TypeReferenceTo returns a reference to the supplied GroupVersionKind.
func TypeReferenceTo(gvk schema.GroupVersionKind) TypeReference {
	return TypeReference{APIVersion: gvk.GroupVersion().String(), Kind: gvk.Kind}
}

// A PipelineStep in a function pipeline.
type PipelineStep struct {
	// Step name. Must be unique within its Pipeline.
	Step string `json:"step"`

	// FunctionRef is a reference to the function this step should
	// execute.
	FunctionRef FunctionReference `json:"functionRef"`

	// Input is an optional, arbitrary Kubernetes resource (i.e. a resource
	// with an apiVersion and kind) that will be passed to the function as
	// the 'input' of its RunFunctionRequest.
	// +optional
	// +kubebuilder:pruning:PreserveUnknownFields
	// +kubebuilder:validation:EmbeddedResource
	Input *runtime.RawExtension `json:"input,omitempty"`

	// Credentials are optional credentials that the function needs.
	// +optional
	// +listType=map
	// +listMapKey=name
	Credentials []FunctionCredentials `json:"credentials,omitempty"`

	// Requirements are resource requirements that will be satisfied before
	// this pipeline step is called for the first time. This allows
	// pre-populating required resources without requiring a function to
	// request them first.
	// +optional
	Requirements *FunctionRequirements `json:"requirements,omitempty"`
}

// A FunctionReference references a function that may be used in a
// Composition pipeline.
type FunctionReference struct {
	// Name of the referenced Function.
	Name string `json:"name"`
}

// FunctionCredentials are optional credentials that a function
// needs to run.
//
// +kubebuilder:validation:XValidation:rule="self.source == 'Secret' && has(self.secretRef)",message="the Secret source requires a secretRef"
type FunctionCredentials struct {
	// Name of this set of credentials.
	Name string `json:"name"`

	// Source of the function credentials.
	// +kubebuilder:validation:Enum=None;Secret
	Source FunctionCredentialsSource `json:"source"`

	// A SecretRef is a reference to a secret containing credentials that should
	// be supplied to the function.
	// +optional
	SecretRef *xpv2.SecretReference `json:"secretRef,omitempty"`
}

// A FunctionCredentialsSource is a source from which function
// credentials may be acquired.
type FunctionCredentialsSource string

const (
	// FunctionCredentialsSourceNone indicates that a function does not require
	// credentials.
	FunctionCredentialsSourceNone FunctionCredentialsSource = "None"

	// FunctionCredentialsSourceSecret indicates that a function should acquire
	// credentials from a secret.
	FunctionCredentialsSourceSecret FunctionCredentialsSource = "Secret"
)

// FunctionRequirements define requirements that a function may need to
// satisfy.
type FunctionRequirements struct {
	// RequiredResources is a list of resources that must be fetched before
	// this function is called.
	// +optional
	// +listType=map
	// +listMapKey=requirementName
	RequiredResources []RequiredResourceSelector `json:"requiredResources,omitempty"`

	// RequiredSchemas is a list of OpenAPI schemas that must be fetched before
	// this function is called.
	// +optional
	// +listType=map
	// +listMapKey=requirementName
	RequiredSchemas []RequiredSchemaSelector `json:"requiredSchemas,omitempty"`
}

// RequiredResourceSelector selects a required resource.
//
// +kubebuilder:validation:XValidation:rule="!(has(self.name) && has(self.matchLabels))",message="name and matchLabels are mutually exclusive"
type RequiredResourceSelector struct {
	// RequirementName is the unique name to identify this required resource
	// in the Required Resources map in the function request.
	RequirementName string `json:"requirementName"`

	// APIVersion of the required resource.
	APIVersion string `json:"apiVersion"`

	// Kind of the required resource.
	Kind string `json:"kind"`

	// Namespace of the required resource if it is namespaced.
	// +optional
	Namespace *string `json:"namespace,omitempty"`

	// Name of the required resource.
	// +optional
	Name *string `json:"name,omitempty"`

	// MatchLabels specifies the set of labels to match for finding the
	// required resource. When specified, Name is ignored.
	// +optional
	MatchLabels map[string]string `json:"matchLabels,omitempty"`
}

// GetRequirementName returns the requirement name.
func (r *RequiredResourceSelector) GetRequirementName() string {
	return r.RequirementName
}

// GetAPIVersion returns the API version.
func (r *RequiredResourceSelector) GetAPIVersion() string {
	return r.APIVersion
}

// GetKind returns the kind.
func (r *RequiredResourceSelector) GetKind() string {
	return r.Kind
}

// GetName returns the name.
func (r *RequiredResourceSelector) GetName() *string {
	return r.Name
}

// GetMatchLabels returns the match labels.
func (r *RequiredResourceSelector) GetMatchLabels() map[string]string {
	return r.MatchLabels
}

// GetNamespace returns the namespace.
func (r *RequiredResourceSelector) GetNamespace() *string {
	return r.Namespace
}

// RequiredSchemaSelector selects a required OpenAPI schema.
type RequiredSchemaSelector struct {
	// RequirementName is the unique name to identify this required schema
	// in the Required Schemas map in the function request.
	RequirementName string `json:"requirementName"`

	// APIVersion of the resource kind whose schema is required, e.g. "example.org/v1".
	APIVersion string `json:"apiVersion"`

	// Kind of resource whose schema is required, e.g. "MyResource".
	Kind string `json:"kind"`
}

// GetRequirementName returns the requirement name.
func (r *RequiredSchemaSelector) GetRequirementName() string {
	return r.RequirementName
}

// GetAPIVersion returns the API version.
func (r *RequiredSchemaSelector) GetAPIVersion() string {
	return r.APIVersion
}

// GetKind returns the kind.
func (r *RequiredSchemaSelector) GetKind() string {
	return r.Kind
}

```

### Core Architecture Module: `apis/apiextensions/v1/composition_hash.go`
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

package v1

import (
	"crypto/sha256"
	"fmt"

	"sigs.k8s.io/yaml"
)

// Hash of the Composition.
func (c *Composition) Hash() string {
	h := sha256.New()

	// I believe marshaling errors should be impossible given we're
	// marshalling a known, strongly typed struct.

	y, err := yaml.Marshal(c.Labels)
	if err != nil {
		return "unknown"
	}

	a, err := yaml.Marshal(c.Annotations)
	if err != nil {
		return "unknown"
	}

	s, err := yaml.Marshal(c.Spec)
	if err != nil {
		return "unknown"
	}

	y = append(y, a...)
	y = append(y, s...)
	_, _ = h.Write(y)

	return fmt.Sprintf("%x", h.Sum(nil))
}

```

### Core Architecture Module: `apis/apiextensions/v1/composition_revision.go`
```
/*
Copyright 2022 The Crossplane Authors.

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

package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// LatestRevision returns the latest revision of the supplied composition.
// We use a hash of the labels, the annotations, and the spec to decide to create a new revision.
// If we revert back to an older state, we increase the existing revision's revision number.
func LatestRevision(c *Composition, revs []CompositionRevision) *CompositionRevision {
	// to make sure that we always return a revision controlled by the composition
	latest := CompositionRevision{}

	for i := range revs {
		if !metav1.IsControlledBy(&revs[i], c) {
			continue
		}

		if latest.Spec.Revision < revs[i].Spec.Revision {
			latest = revs[i]
		}
	}

	// revision numbers start from 1, this means that we have no revision in the list
	// controlled by the composition
	if latest.Spec.Revision == 0 {
		return nil
	}

	return &latest
}

```

### Core Architecture Module: `apis/apiextensions/v1/composition_revision_types.go`
```
/*
Copyright 2022 The Crossplane Authors.

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

package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	xpv2 "github.com/crossplane/crossplane/apis/v2/core/v2"
)

const (
	// LabelCompositionName is the name of the Composition used to create
	// this CompositionRevision.
	LabelCompositionName = "crossplane.io/composition-name"

	// LabelCompositionHash is a hash of the Composition label, annotation
	// and spec used to create this CompositionRevision. Used to identify
	// identical revisions.
	LabelCompositionHash = "crossplane.io/composition-hash"
)

// CompositionRevisionSpec specifies the desired state of the composition
// revision.
type CompositionRevisionSpec struct {
	// CompositeTypeRef specifies the type of composite resource that this
	// composition is compatible with.
	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="Value is immutable"
	CompositeTypeRef TypeReference `json:"compositeTypeRef"`

	// Mode controls what type or "mode" of Composition will be used.
	//
	// "Pipeline" indicates that a Composition specifies a pipeline of
	// functions, each of which is responsible for producing composed
	// resources that Crossplane should create or update.
	//
	// +optional
	// +kubebuilder:validation:Enum=Pipeline
	// +kubebuilder:default=Pipeline
	Mode CompositionMode `json:"mode,omitempty"`

	// Pipeline is a list of function steps that will be used when a
	// composite resource referring to this composition is created.
	//
	// The Pipeline is only used by the "Pipeline" mode of Composition. It is
	// ignored by other modes.
	// +optional
	// +listType=map
	// +listMapKey=step
	Pipeline []PipelineStep `json:"pipeline,omitempty"`

	// WriteConnectionSecretsToNamespace specifies the namespace in which the
	// connection secrets of composite resource dynamically provisioned using
	// this composition will be created.
	// +optional
	WriteConnectionSecretsToNamespace *string `json:"writeConnectionSecretsToNamespace,omitempty"`

	// Revision number. Newer revisions have larger numbers.
	//
	// This number can change. When a Composition transitions from state A
	// -> B -> A there will be only two CompositionRevisions. Crossplane will
	// edit the original CompositionRevision to change its revision number from
	// 0 to 2.
	Revision int64 `json:"revision"`
}

// CompositionRevisionStatus shows the observed state of the composition
// revision.
type CompositionRevisionStatus struct {
	xpv2.ConditionedStatus `json:",inline"`
}

// +kubebuilder:object:root=true
// +kubebuilder:storageversion
// +genclient
// +genclient:nonNamespaced

// A CompositionRevision represents a revision of a Composition. Crossplane
// creates new revisions when there are changes to the Composition.
//
// Crossplane creates and manages CompositionRevisions. Don't directly edit
// CompositionRevisions.
// +kubebuilder:printcolumn:name="REVISION",type="string",JSONPath=".spec.revision"
// +kubebuilder:printcolumn:name="XR-KIND",type="string",JSONPath=".spec.compositeTypeRef.kind"
// +kubebuilder:printcolumn:name="XR-APIVERSION",type="string",JSONPath=".spec.compositeTypeRef.apiVersion"
// +kubebuilder:printcolumn:name="AGE",type="date",JSONPath=".metadata.creationTimestamp"
// +kubebuilder:resource:scope=Cluster,categories=crossplane,shortName=comprev
// +kubebuilder:subresource:status
type CompositionRevision struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   CompositionRevisionSpec   `json:"spec,omitempty"`
	Status CompositionRevisionStatus `json:"status,omitempty"`
}

// GetCondition of this CompositionRevision.
func (in *CompositionRevision) GetCondition(ct xpv2.ConditionType) xpv2.Condition {
	return in.Status.GetCondition(ct)
}

// SetConditions of this CompositionRevision.
func (in *CompositionRevision) SetConditions(c ...xpv2.Condition) {
	in.Status.SetConditions(c...)
}

// +kubebuilder:object:root=true

// CompositionRevisionList contains a list of CompositionRevisions.
type CompositionRevisionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []CompositionRevision `json:"items"`
}

```

### Core Architecture Module: `apis/apiextensions/v1/composition_types.go`
```
/*
Copyright 2020 The Crossplane Authors.

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

package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CompositionSpec specifies desired state of a composition.
//
// +kubebuilder:validation:XValidation:rule="self.mode == 'Pipeline' && has(self.pipeline)",message="an array of pipeline steps is required in Pipeline mode"
type CompositionSpec struct {
	// CompositeTypeRef specifies the type of composite resource that this
	// composition is compatible with.
	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="Value is immutable"
	CompositeTypeRef TypeReference `json:"compositeTypeRef"`

	// Mode controls what type or "mode" of Composition will be used.
	//
	// "Pipeline" indicates that a Composition specifies a pipeline of
	// functions, each of which is responsible for producing composed
	// resources that Crossplane should create or update.
	//
	// +optional
	// +kubebuilder:validation:Enum=Pipeline
	// +kubebuilder:default=Pipeline
	Mode CompositionMode `json:"mode,omitempty"`

	// Pipeline is a list of composition function steps that will be used when a
	// composite resource referring to this composition is created. One of
	// resources and pipeline must be specified - you cannot specify both.
	//
	// The Pipeline is only used by the "Pipeline" mode of Composition. It is
	// ignored by other modes.
	// +optional
	// +listType=map
	// +listMapKey=step
	// +kubebuilder:validation:MinItems=1
	// +kubebuilder:validation:MaxItems=99
	Pipeline []PipelineStep `json:"pipeline,omitempty"`

	// WriteConnectionSecretsToNamespace specifies the namespace in which the
	// connection secrets of composite resource dynamically provisioned using
	// this composition will be created.
	// +optional
	WriteConnectionSecretsToNamespace *string `json:"writeConnectionSecretsToNamespace,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:storageversion
// +genclient
// +genclient:nonNamespaced

// A Composition defines a collection of managed resources or functions that
// Crossplane uses to create and manage new composite resources.
//
// Read the Crossplane documentation for
// [more information about Compositions](https://docs.crossplane.io/latest/composition/compositions/).
// +kubebuilder:printcolumn:name="XR-KIND",type="string",JSONPath=".spec.compositeTypeRef.kind"
// +kubebuilder:printcolumn:name="XR-APIVERSION",type="string",JSONPath=".spec.compositeTypeRef.apiVersion"
// +kubebuilder:printcolumn:name="AGE",type="date",JSONPath=".metadata.creationTimestamp"
// +kubebuilder:resource:scope=Cluster,categories=crossplane,shortName=comp
type Composition struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec CompositionSpec `json:"spec,omitempty"`
}

// +kubebuilder:object:root=true

// CompositionList contains a list of Compositions.
type CompositionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Composition `json:"items"`
}

```

### Core Architecture Module: `apis/apiextensions/v1/conditions.go`
```
/*
Copyright 2020 The Crossplane Authors.

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

package v1

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	xpv2 "github.com/crossplane/crossplane/apis/v2/core/v2"
)

// Condition types.
const (
	// A TypeEstablished XRD has created the CRD for its composite resource and
	// started a controller to reconcile instances of said resource.
	TypeEstablished xpv2.ConditionType = "Established"

	// A TypeOffered XRD has created the CRD for its composite resource claim
	// and started a controller to reconcile instances of said claim.
	TypeOffered xpv2.ConditionType = "Offered"

	// A TypeValidPipeline CompositionRevision has a valid function
	// pipeline.
	TypeValidPipeline xpv2.ConditionType = "ValidPipeline"

	// A TypeResponsive indicates whether the resource is responsive to changes.
	TypeResponsive xpv2.ConditionType = "Responsive"
)

// Reasons a resource is or is not established or offered.
const (
	ReasonWatchingComposite xpv2.ConditionReason = "WatchingCompositeResource"
	ReasonWatchingClaim     xpv2.ConditionReason = "WatchingCompositeResourceClaim"

	ReasonTerminatingComposite xpv2.ConditionReason = "TerminatingCompositeResource"
	ReasonTerminatingClaim     xpv2.ConditionReason = "TerminatingCompositeResourceClaim"

	ReasonValidPipeline       xpv2.ConditionReason = "ValidPipeline"
	ReasonMissingCapabilities xpv2.ConditionReason = "MissingCapabilities"

	ReasonWatchCircuitOpen   xpv2.ConditionReason = "WatchCircuitOpen"
	ReasonWatchCircuitClosed xpv2.ConditionReason = "WatchCircuitClosed"
)

// WatchingComposite indicates that Crossplane has defined and is watching for a
// new kind of composite resource.
func WatchingComposite() xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeEstablished,
		Status:             corev1.ConditionTrue,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonWatchingComposite,
	}
}

// TerminatingComposite indicates that Crossplane is terminating the controller
// for and removing the definition of a composite resource.
func TerminatingComposite() xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeEstablished,
		Status:             corev1.ConditionFalse,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonTerminatingComposite,
	}
}

// WatchingClaim indicates that Crossplane has defined and is watching for a
// new kind of composite resource claim.
func WatchingClaim() xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeOffered,
		Status:             corev1.ConditionTrue,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonWatchingClaim,
	}
}

// TerminatingClaim indicates that Crossplane is terminating the controller and
// removing the definition of a composite resource claim.
func TerminatingClaim() xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeOffered,
		Status:             corev1.ConditionFalse,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonTerminatingClaim,
	}
}

// ValidPipeline indicates that all functions in the CompositionRevision's
// pipeline are valid.
func ValidPipeline() xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeValidPipeline,
		Status:             corev1.ConditionTrue,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonValidPipeline,
	}
}

// MissingCapabilities indicates that one or more functions in the CompositionRevision's
// pipeline are missing required capabilities.
func MissingCapabilities(message string) xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeValidPipeline,
		Status:             corev1.ConditionFalse,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonMissingCapabilities,
		Message:            message,
	}
}

// WatchCircuitOpen indicates the circuit breaker is open due to excessive watch events.
func WatchCircuitOpen(triggeredBy string) xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeResponsive,
		Status:             corev1.ConditionFalse,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonWatchCircuitOpen,
		Message:            fmt.Sprintf("Too many watch events from %s. Allowing events periodically.", triggeredBy),
	}
}

// WatchCircuitClosed indicates the circuit breaker is closed (normal operation).
func WatchCircuitClosed() xpv2.Condition {
	return xpv2.Condition{
		Type:               TypeResponsive,
		Status:             corev1.ConditionTrue,
		LastTransitionTime: metav1.Now(),
		Reason:             ReasonWatchCircuitClosed,
	}
}

// IsSystemConditionType returns true if the condition type is a system
// condition. This includes both core system conditions and
// apiextensions-specific system conditions like the circuit breaker.
func IsSystemConditionType(t xpv2.ConditionType) bool {
	// First check core system conditions
	if xpv2.IsSystemConditionType(t) {
		return true
	}

	// Then check Crossplane-specific system conditions
	return t == TypeResponsive
}

```

### Core Architecture Module: `apis/apiextensions/v1/conversion.go`
```
/*
Copyright 2022 The Crossplane Authors.

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

package v1

import (
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/runtime"
)

// A RevisionSpecConverter converts a CompositionSpec to the equivalent
// CompositionRevisionSpec.
//
// goverter:converter
// goverter:name GeneratedRevisionSpecConverter
// goverter:output:file ./zz_generated.conversion.go
// goverter:extend ConvertRawExtension ConvertResourceQuantity
// goverter:enum:unknown @ignore
// +k8s:deepcopy-gen=false
type RevisionSpecConverter interface {
	// goverter:ignore Revision
	ToRevisionSpec(in CompositionSpec) CompositionRevisionSpec
	FromRevisionSpec(in CompositionRevisionSpec) CompositionSpec
}

// ConvertRawExtension 'converts' a RawExtension by producing a deepcopy. This
// is necessary because goverter can't convert an embedded runtime.Object.
func ConvertRawExtension(in runtime.RawExtension) runtime.RawExtension {
	out := in.DeepCopy()
	return *out
}

// ConvertResourceQuantity 'converts' a Quantity by producing a deepcopy. This
// is necessary because goverter can't convert a Quantity's unexported fields.
func ConvertResourceQuantity(in *resource.Quantity) *resource.Quantity {
	out := in.DeepCopy()
	return &out
}

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

### Incident Patch 1: `fcf872bf` (2026-09-29)
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
 google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7/go.mod h1:L43LFes82YgSonw6iTXTxXUX1OlUL
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

### Incident Patch 2: `8e7afaad` (2026-09-28)
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

### Incident Patch 3: `b56f55c0` (2026-09-25)
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

---

### Incident Patch 4: `b451ab61` (2026-09-24)
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

Signed-off-by: Philippe Scorsolini <5697904+phisco@users.noreply.github.com>

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

---

### Incident Patch 5: `bbd1a681` (2026-09-22)
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

---

### Incident Patch 6: `56d73d69` (2026-09-22)
**Commit Message**: Merge pull request #7839 from fernandezcuesta/fix/demote-sa

**File**: `internal/controller/pkg/runtime/runtime_function.go` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ func (h *FunctionHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 	// `deploymentTemplate.spec.template.spec.serviceAccountName` in the
 	// DeploymentRuntimeConfig.
 	if sa.Name == d.Spec.Template.Spec.ServiceAccountName {
-		if err := applySA(ctx, h.client, sa); err != nil {
+		if err := applySA(ctx, h.client, pr, sa); err != nil {
 			return errors.Wrap(err, errApplyFunctionSA)
 		}
 	}
```

**File**: `internal/controller/pkg/runtime/runtime_provider.go` (modified, +5/-5)
```diff
@@ -133,7 +133,7 @@ func (h *ProviderHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 	// `deploymentTemplate.spec.template.spec.serviceAccountName` in the
 	// DeploymentRuntimeConfig.
 	if sa.Name == d.Spec.Template.Spec.ServiceAccountName {
-		if err := applySA(ctx, h.client, sa); err != nil {
+		if err := applySA(ctx, h.client, pr, sa); err != nil {
 			return errors.Wrap(err, errApplyProviderSA)
 		}
 	}
@@ -267,9 +267,9 @@ func providerDeploymentOverrides(pr v1.PackageRevisionWithRuntime, image string)
 	return do
 }
 
-// applySA creates/updates a ServiceAccount and includes any image pull secrets
-// that have been added by external controllers.
-func applySA(ctx context.Context, cl resource.ClientApplicator, sa *corev1.ServiceAccount) error {
+// applySA creates/updates a ServiceAccount as a shared runtime object and includes
+// any image pull secrets that have been added by external controllers.
+func applySA(ctx context.Context, cl resource.ClientApplicator, owner metav1.Object, sa *corev1.ServiceAccount) error {
 	oldSa := &corev1.ServiceAccount{}
 	if err := cl.Get(ctx, types.NamespacedName{Name: sa.Name, Namespace: sa.Namespace}, oldSa); err == nil {
 		// Add pull secrets created by other controllers
@@ -285,5 +285,5 @@ func applySA(ctx context.Context, cl resource.ClientApplicator, sa *corev1.Servi
 		}
 	}
 
-	return applyRuntimeObject(ctx, cl.Client, sa)
+	return applySharedRuntimeObject(ctx, cl.Client, owner, sa)
 }
```

**File**: `internal/controller/pkg/runtime/runtime_test.go` (modified, +38/-0)
```diff
@@ -849,6 +849,44 @@ func (b *MockManifestBuilder) TLSServerSecret() *corev1.Secret {
 	return b.TLSServerSecretFn()
 }
 
+func TestDemotedControllers(t *testing.T) {
+	owner := &metav1.ObjectMeta{UID: incoming.UID}
+
+	cases := map[string]struct {
+		reason string
+		refs   []metav1.OwnerReference
+		want   []metav1.OwnerReference
+	}{
+		"NewController": {
+			reason: "Should return empty when the only controller is the new owner.",
+			refs:   []metav1.OwnerReference{incoming},
+		},
+		"NewDemotesOld": {
+			reason: "Should demote the old controller when a new revision takes ownership.",
+			refs:   []metav1.OwnerReference{outgoing},
+			want:   []metav1.OwnerReference{demoted},
+		},
+		"MixedReferences": {
+			reason: "Should demote only old controllers; skip incoming and non-controlling refs.",
+			refs:   []metav1.OwnerReference{incoming, outgoing, demoted},
+			want:   []metav1.OwnerReference{demoted},
+		},
+	}
+
+	for name, tc := range cases {
+		t.Run(name, func(t *testing.T) {
+			obj := &corev1.Service{ObjectMeta: metav1.ObjectMeta{OwnerReferences: tc.refs}}
+			got := demotedControllers(obj, owner)
+			if len(got) == 0 {
+				got = nil
+			}
+			if diff := cmp.Diff(tc.want, got); diff != "" {
+				t.Errorf("%s\ndemotedControllers(...): -want, +got:\n%s", tc.reason, diff)
+			}
+		})
+	}
+}
+
 func TestBuilderWithMRDs(t *testing.T) {
 	inactiveMRD := extv1alpha1.ManagedResourceDefinition{
 		Spec: extv1alpha1.ManagedResourceDefinitionSpec{
```

---

### Incident Patch 7: `cf5caf86` (2026-09-16)
**Commit Message**: fix: demote old revision controller ownerReference for SA

Signed-off-by: Jesús Fernández <7312236+fernandezcuesta@users.noreply.github.com>

**File**: `internal/controller/pkg/runtime/runtime_function.go` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ func (h *FunctionHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 	// `deploymentTemplate.spec.template.spec.serviceAccountName` in the
 	// DeploymentRuntimeConfig.
 	if sa.Name == d.Spec.Template.Spec.ServiceAccountName {
-		if err := applySA(ctx, h.client, sa); err != nil {
+		if err := applySA(ctx, h.client, pr, sa); err != nil {
 			return errors.Wrap(err, errApplyFunctionSA)
 		}
 	}
```

**File**: `internal/controller/pkg/runtime/runtime_provider.go` (modified, +9/-3)
```diff
@@ -133,7 +133,7 @@ func (h *ProviderHooks) Post(ctx context.Context, pr v1.PackageRevisionWithRunti
 	// `deploymentTemplate.spec.template.spec.serviceAccountName` in the
 	// DeploymentRuntimeConfig.
 	if sa.Name == d.Spec.Template.Spec.ServiceAccountName {
-		if err := applySA(ctx, h.client, sa); err != nil {
+		if err := applySA(ctx, h.client, pr, sa); err != nil {
 			return errors.Wrap(err, errApplyProviderSA)
 		}
 	}
@@ -268,8 +268,10 @@ func providerDeploymentOverrides(pr v1.PackageRevisionWithRuntime, image string)
 }
 
 // applySA creates/updates a ServiceAccount and includes any image pull secrets
-// that have been added by external controllers.
-func applySA(ctx context.Context, cl resource.ClientApplicator, sa *corev1.ServiceAccount) error {
+// that have been added by external controllers. It also demotes controller
+// owner references from previous revisions to avoid Kubernetes rejecting the
+// object for having multiple controller references.
+func applySA(ctx context.Context, cl resource.ClientApplicator, owner metav1.Object, sa *corev1.ServiceAccount) error {
 	oldSa := &corev1.ServiceAccount{}
 	if err := cl.Get(ctx, types.NamespacedName{Name: sa.Name, Namespace: sa.Namespace}, oldSa); err == nil {
 		// Add pull secrets created by other controllers
@@ -283,6 +285,10 @@ func applySA(ctx context.Context, cl resource.ClientApplicator, sa *corev1.Servi
 				sa.ImagePullSecrets = append(sa.ImagePullSecrets, secret)
 			}
 		}
+
+		// Demote controller owner references from previous revisions so
+		// that only the current revision is the controller.
+		sa.OwnerReferences = append(sa.OwnerReferences, demotedControllers(oldSa, owner)...)
 	}
 
 	return applyRuntimeObject(ctx, cl.Client, sa)
```

---

### Incident Patch 8: `fc43cb97` (2026-09-15)
**Commit Message**: fix(deps): update module github.com/alecthomas/kong to v1.16.1

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ require (
 	dario.cat/mergo v1.0.2
 	github.com/AdaLogics/go-fuzz-headers v0.0.0-20240806141605-e8a1dd7889d6
 	github.com/Masterminds/semver/v3 v3.5.0
-	github.com/alecthomas/kong v1.16.0
+	github.com/alecthomas/kong v1.16.1
 	github.com/crossplane/crossplane-runtime/v2 v2.5.0-rc.0
 	github.com/crossplane/crossplane/apis/v2 v2.4.0
 	github.com/google/go-cmp v0.7.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -72,8 +72,8 @@ github.com/Masterminds/semver/v3 v3.5.0 h1:kQceYJfbupGfZOKZQg0kou0DgAKhzDg2NZPAw
 github.com/Masterminds/semver/v3 v3.5.0/go.mod h1:4V+yj/TJE1HU9XfppCwVMZq3I84lprf4nC11bSS5beM=
 github.com/alecthomas/assert/v2 v2.11.0 h1:2Q9r3ki8+JYXvGsDyBXwH3LcJ+WK5D0gc5E8vS6K3D0=
 github.com/alecthomas/assert/v2 v2.11.0/go.mod h1:Bze95FyfUr7x34QZrjL+XP+0qgp/zg8yS+TtBj1WA3k=
-github.com/alecthomas/kong v1.16.0 h1:g92/kUxBcdcTPOM79yE63viJgtcp5dNyrB3/O2cjYT4=
-github.com/alecthomas/kong v1.16.0/go.mod h1:wrlbXem1CWqUV5Vbmss5ISYhsVPkBb1Yo7YKJghju2I=
+github.com/alecthomas/kong v1.16.1 h1:ixhCt93XkJ98kGposQ54+bl0IK6XwqB40AsMynU7Z8E=
+github.com/alecthomas/kong v1.16.1/go.mod h1:wrlbXem1CWqUV5Vbmss5ISYhsVPkBb1Yo7YKJghju2I=
 github.com/alecthomas/repr v0.5.2 h1:SU73FTI9D1P5UNtvseffFSGmdNci/O6RsqzeXJtP0Qs=
 github.com/alecthomas/repr v0.5.2/go.mod h1:Fr0507jx4eOXV7AlPV6AVZLYrLIuIeSOWtW57eE/O/4=
 github.com/alessio/shellescape v1.4.1 h1:V7yhSDDn8LP4lc4jS8pFkt0zCnzVJlG5JXy9BVKJUX0=
```

**File**: `nix/vendor-hashes.nix` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # by hand.)
 {
   # Root module: github.com/crossplane/crossplane/v2
-  root = "sha256-7qf/0ftXshYRgZoXckR4CAUm+GwsiqtCZop7VEKgkII=";
+  root = "sha256-YwyoXJ5zYeSTk/PfSNULOnNf7YEt1XldHXD/3L8nYyk=";
 
   # apis module: github.com/crossplane/crossplane/apis/v2
   apis = "sha256-LBPg9GFga3rvI5D487ydw+AyE7ezHP07ukxX3PcWLUA=";
```

---

### Incident Patch 9: `fedcf302` (2026-09-09)
**Commit Message**: Merge pull request #7831 from jbw976/security-boundaries

docs(security): add non-goal that Composition authors are trusted

**File**: `SECURITY.md` (modified, +5/-0)
```diff
@@ -43,6 +43,11 @@ directly to confirm receipt of the issue.
 
 ### Report Content
 
+Crossplane's [security non-goals](./security/self-assessment.md#non-goals)
+describe what Crossplane does not intend to protect against. Behavior covered by
+them will not be treated as a vulnerability. Please review them before
+submitting a report.
+
 Make sure to include all the details that might help maintainers better
 understand and prioritize it, for example here is a list of details that might be
 worth adding:
```

**File**: `security/self-assessment.md` (modified, +12/-1)
```diff
@@ -179,13 +179,24 @@ cluster scoped and Crossplane does not have built-in mechanisms or experiences
 to further restrict their access. This can be configured outside of Crossplane
 via manual RBAC or policy configurations.
 
+`Compositions` and `CompositeResourceDefinitions` are cluster scoped resources
+authored by trusted members of the platform team, so Crossplane does not treat
+the logic of a `Composition` as a security boundary. Crossplane executes the
+function pipeline they define and applies the resulting composed resources using
+its own service account. A `Composition` that passes end user input through to
+the kind, scope, or other identity-related fields of a composed resource
+therefore grants that user whatever the `Composition` specifies. Preventing that
+is the platform team's responsibility, for example by controlling who can create
+`Compositions` and `CompositeResourceDefinitions`, by applying admission policy
+to the resources they compose, or by simply not writing `Compositions` that
+grant application developers more access than intended.
+
 Crossplane does not intend to exhaustively restrict the controller workloads
 that are run as extensions in the control plane. Users have the ability to
 configure the `Deployment` that manages the extension's pod (and therefore
 internal controllers), but the specific execution and runtime of the extension
 is not restricted further by Crossplane.
 
-
 ## Self-assessment Use
 
 This self-assessment is created by the Crossplane team to perform an internal
```

---

### Incident Patch 10: `1ac57cfc` (2026-09-09)
**Commit Message**: docs(security): add non-goal that Composition authors are trusted

We've received numerous security vulnerability reports that are actually
inline with the project's security design and policy.

The most common incorrect assumption is that the content of a
Composition is a security boundary. Crossplane considers Composition
authors trusted members of the platform team, but that position wasn't
documented anywhere in the project.

This commit adds a non-goal to the security self-assessment making that
more clear, and points reporters at the non-goals from SECURITY.md before
they submit a report.

Signed-off-by: Jared Watts <jbw976@gmail.com>

**File**: `SECURITY.md` (modified, +5/-0)
```diff
@@ -43,6 +43,11 @@ directly to confirm receipt of the issue.
 
 ### Report Content
 
+Crossplane's [security non-goals](./security/self-assessment.md#non-goals)
+describe what Crossplane does not intend to protect against. Behavior covered by
+them will not be treated as a vulnerability. Please review them before
+submitting a report.
+
 Make sure to include all the details that might help maintainers better
 understand and prioritize it, for example here is a list of details that might be
 worth adding:
```

**File**: `security/self-assessment.md` (modified, +12/-1)
```diff
@@ -179,13 +179,24 @@ cluster scoped and Crossplane does not have built-in mechanisms or experiences
 to further restrict their access. This can be configured outside of Crossplane
 via manual RBAC or policy configurations.
 
+`Compositions` and `CompositeResourceDefinitions` are cluster scoped resources
+authored by trusted members of the platform team, so Crossplane does not treat
+the logic of a `Composition` as a security boundary. Crossplane executes the
+function pipeline they define and applies the resulting composed resources using
+its own service account. A `Composition` that passes end user input through to
+the kind, scope, or other identity-related fields of a composed resource
+therefore grants that user whatever the `Composition` specifies. Preventing that
+is the platform team's responsibility, for example by controlling who can create
+`Compositions` and `CompositeResourceDefinitions`, by applying admission policy
+to the resources they compose, or by simply not writing `Compositions` that
+grant application developers more access than intended.
+
 Crossplane does not intend to exhaustively restrict the controller workloads
 that are run as extensions in the control plane. Users have the ability to
 configure the `Deployment` that manages the extension's pod (and therefore
 internal controllers), but the specific execution and runtime of the extension
 is not restricted further by Crossplane.
 
-
 ## Self-assessment Use
 
 This self-assessment is created by the Crossplane team to perform an internal
```

#### Recent Merged Pull Requests:
- **PR #7877** (2026-09-28): [Backport release-2.4] fix: stop rewriting the in-use label on every Usage reconcile (@github-actions[bot])
- **PR #7876** (2026-09-28): [Backport release-2.3] fix: stop rewriting the in-use label on every Usage reconcile (@github-actions[bot])
- **PR #7875** (2026-09-28): [Backport release-2.2] fix: stop rewriting the in-use label on every Usage reconcile (@github-actions[bot])
- **PR #7873** (2026-09-25): [Backport release-2.4] e2e: Use xpkg.upbound.io for private package pull test (@github-actions[bot])
- **PR #7872** (2026-09-25): [Backport release-2.3] e2e: Use xpkg.upbound.io for private package pull test (@github-actions[bot])
- **PR #7871** (2026-09-25): [Backport release-2.2] e2e: Use xpkg.upbound.io for private package pull test (@github-actions[bot])
- **PR #7870** (2026-09-25): [Backport release-2.1] e2e: Use xpkg.upbound.io for private package pull test (@github-actions[bot])
- **PR #7869** (2026-09-25): [Backport release-1.20] e2e: Use xpkg.upbound.io for private package pull test (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
