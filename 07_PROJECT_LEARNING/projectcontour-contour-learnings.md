# Forensic Learning Record (Deep Inspection): projectcontour/contour

> **Canonical Artifact**: `07_PROJECT_LEARNING/projectcontour-contour-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/projectcontour/contour](https://github.com/projectcontour/contour))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:20:55.189Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectcontour/contour`
- **Description**: Contour is a Kubernetes ingress controller using Envoy proxy.
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3956 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/xds/util.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package xds

import (
	"strings"

	"k8s.io/apimachinery/pkg/types"
)

// ClusterLoadAssignmentName generates the name used for an EDS
// ClusterLoadAssignment, given a fully qualified Service name and
// port. This name is a contract between the producer of a cluster
// (i.e. the EDS service) and the consumer of a cluster (most likely
// a HTTP Route Action).
func ClusterLoadAssignmentName(service types.NamespacedName, portName string) string {
	name := []string{
		service.Namespace,
		service.Name,
		portName,
	}

	// If the port is empty, omit it.
	if portName == "" {
		return strings.Join(name[:2], "/")
	}

	return strings.Join(name, "/")
}

```

### Core Architecture Module: `apis/projectcontour/doc.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package projectcontour

```

### Core Architecture Module: `apis/projectcontour/v1/detailedconditions.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +k8s:deepcopy-gen=package

// Package v1 is the v1 version of the API.
// +groupName=projectcontour.io
package v1

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ConditionStatus is a type alias for the k8s.io/apimachinery/pkg/apis/meta/v1
// ConditionStatus type to maintain API compatibility.
// +k8s:deepcopy-gen=false
type ConditionStatus = meta_v1.ConditionStatus

// These are valid condition statuses. "ConditionTrue" means a resource is in the condition.
// "ConditionFalse" means a resource is not in the condition. "ConditionUnknown" means kubernetes
// can't decide if a resource is in the condition or not. In the future, we could add other
// intermediate conditions, e.g. ConditionDegraded. These are retained here for API compatibility.
const (
	ConditionTrue    ConditionStatus = meta_v1.ConditionTrue
	ConditionFalse   ConditionStatus = meta_v1.ConditionFalse
	ConditionUnknown ConditionStatus = meta_v1.ConditionUnknown
)

// Condition is a type alias for the k8s.io/apimachinery/pkg/apis/meta/v1
// Condition type to maintain API compatibility.
// +k8s:deepcopy-gen=false
type Condition = meta_v1.Condition

// SubCondition is a Condition-like type intended for use as a subcondition inside a DetailedCondition.
//
// It contains a subset of the Condition fields.
//
// It is intended for warnings and errors, so `type` names should use abnormal-true polarity,
// that is, they should be of the form "ErrorPresent: true".
//
// The expected lifecycle for these errors is that they should only be present when the error or warning is,
// and should be removed when they are not relevant.
type SubCondition struct {
	// Type of condition in `CamelCase` or in `foo.example.com/CamelCase`.
	//
	// This must be in abnormal-true polarity, that is, `ErrorFound` or `controller.io/ErrorFound`.
	//
	// The regex it matches is (dns1123SubdomainFmt/)?(qualifiedNameFmt)
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:Pattern=`^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*/)?(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])$`
	// +kubebuilder:validation:MaxLength=316
	Type string `json:"type" protobuf:"bytes,1,opt,name=type"`
	// Status of the condition, one of True, False, Unknown.
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:Enum=True;False;Unknown
	Status ConditionStatus `json:"status" protobuf:"bytes,2,opt,name=status"`
	// Reason contains a programmatic identifier indicating the reason for the condition's last transition.
	// Producers of specific condition types may define expected values and meanings for this field,
	// and whether the values are considered a guaranteed API.
	//
	// The value should be a CamelCase string.
	//
	// This field may not be empty.
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MaxLength=1024
	// +kubebuilder:validation:MinLength=1
	// +kubebuilder:validation:Pattern=`^[A-Za-z]([A-Za-z0-9_,:]*[A-Za-z0-9_])?$`
	Reason string `json:"reason" protobuf:"bytes,3,opt,name=reason"`
	// Message is a human readable message indicating details about the transition.
	//
	// This may be an empty string.
	//
	// +required
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MaxLength=32768
	Message string `json:"message" protobuf:"bytes,4,opt,name=message"`
}

// DetailedCondition is an extension of the normal Kubernetes conditions, with two extra
// fields to hold sub-conditions, which provide more detailed reasons for the state (True or False)
// of the condition.
//
// `errors` holds information about sub-conditions which are fatal to that condition and render its state False.
//
// `warnings` holds information about sub-conditions which are not fatal to that condition and do not force the state to be False.
//
// Remember that Conditions have a type, a status, and a reason.
//
// The type is the type of the condition, the most important one in this CRD set is `Valid`.
// `Valid` is a positive-polarity condition: when it is `status: true` there are no problems.
//
// In more detail, `status: true` means that the object is has been ingested into Contour with no errors.
// `warnings` may still be present, and will be indicated in the Reason field. There must be zero entries in the `errors`
// slice in this case.
//
// `Valid`, `status: false` means that the object has had one or more fatal errors during processing into Contour.
// The details of the errors will be present under the `errors` field. There must be at least one error in the `errors`
// slice if `status` is `false`.
//
// For DetailedConditions of types other than `Valid`, the Condition must be in the negative polarity.
// When they have `status` `true`, there is an error. There must be at least one entry in the `errors` Subcondition slice.
// When they have `status` `false`, there are no serious errors, and there must be zero entries in the `errors` slice.
// In either case, there may be entries in the `warnings` slice.
//
// Regardless of the polarity, the `reason` and `message` fields must be updated with either the detail of the reason
// (if there is one and only one entry in total across both the `errors` and `warnings` slices), or
// `MultipleReasons` if there is more than one entry.
type DetailedCondition struct {
	Condition `json:",inline"`
	// Errors contains a slice of relevant error subconditions for this object.
	//
	// Subconditions are expected to appear when relevant (when there is a error), and disappear when not relevant.
	// An empty slice here indicates no errors.
	// +optional
	Errors []SubCondition `json:"errors,omitempty"`
	// Warnings contains a slice of relevant warning subconditions for this object.
	//
	// Subconditions are expected to appear when relevant (when there is a warning), and disappear when not relevant.
	// An empty slice here indicates no warnings.
	// +optional
	Warnings []SubCondition `json:"warnings,omitempty"`
}

const (
	// ValidConditionType describes an valid condition.
	ValidConditionType = "Valid"

	// ConditionTypeAuthError describes an error condition related to Auth.
	ConditionTypeAuthError = "AuthError"

	// ConditionTypeCORSError describes an error condition related to CORS.
	ConditionTypeCORSError = "CORSError"

	// ConditionTypeIPFilterError describes an error condition related to IP filters.
	ConditionTypeIPFilterError = "IPFilterError"

	// ConditionTypeJWTVerificationError describes an error condition related to JWT verification.
	ConditionTypeJWTVerificationError = "JWTVerificationError"

	// ConditionTypeIncludeError describes an error condition with
	// inclusion of another HTTPProxy resource.
	ConditionTypeIncludeError = "IncludeError"

	// ConditionTypeOrphanedError describes an error condition
	// with an HTTPProxy resource which is not part of a delegation chain.
	ConditionTypeOrphanedError = "Orphaned"

	// ConditionTypePrefixReplaceError describes an error condition with
	// an HTTPProxy path prefix replacement issue.
	ConditionTypePrefixReplaceError = "PrefixReplaceError"

	// ConditionTypeRootNamespaceError describes an error condition
	// with an HTTPProxy resource created in non-root namespace.
	ConditionTypeRootNamespaceError = "RootNamespaceError"

	// ConditionTypeRouteError describes an error condition that
	// relates to Routes within an HTTPProxy.
	ConditionTypeRouteError = "RouteError"

	// ConditionTypeServiceError describes an error condition that
	// relates to a Service error within an HTTPProxy.
	ConditionTypeServiceError = "ServiceError"

	// ConditionTypeSpecError describes an error condition that
	// relates to the Spec of an HTTPProxy resource.
	ConditionTypeSpecError = "SpecError"

	// ConditionTypeTCPProxyIncludeError describes an error condition
	// with inclusion of another HTTPProxy TCP Proxy resource.
	ConditionTypeTCPProxyIncludeError = "TCPProxyIncludeError"

	// ConditionTypeTCPProxyError describes an error condition relating
	// to a TCP Proxy HTTPProxy resource.
	ConditionTypeTCPProxyError = "TCPProxyError"

	// ConditionTypeTLSError describes an error condition relating
	// to TLS configuration.
	ConditionTypeTLSError = "TLSError"

	// ConditionTypeVirtualHostError describes an error condition relating
	// to the VirtualHost configuration section of an HTTPProxy resource.
	ConditionTypeVirtualHostError = "VirtualHostError"

	// ConditionTypeListenerError describes an error condition relating
	// to the configuration of Listeners.
	ConditionTypeListenerError = "ListenerError"
)

```

### Core Architecture Module: `apis/projectcontour/v1/doc.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +k8s:deepcopy-gen=package

// Package v1 holds the specification for the projectcontour.io Custom Resource Definitions (CRDs).
//
// In building this CRD, we've inadvertently overloaded the word "Condition", so we've tried to make
// this spec clear as to which types of condition are which.
//
// `MatchConditions` are used by `Routes` and `Includes` to specify rules to match requests against for either
// routing or inclusion.
//
// `DetailedConditions` are used in the `Status` of these objects to hold information about the relevant
// state of the object and the world around it.
//
// `SubConditions` are used underneath `DetailedConditions` to give more detail to errors or warnings.
//
// +groupName=projectcontour.io
package v1

```

### Core Architecture Module: `apis/projectcontour/v1/helpers.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v1

import (
	"fmt"
	"maps"
)

// AuthorizationConfigured returns whether authorization  is
// configured on this virtual host.
func (v *VirtualHost) AuthorizationConfigured() bool {
	return v.Authorization != nil
}

// DisableAuthorization returns true if this virtual host disables
// authorization. If an authorization server is present, the default
// policy is to not disable.
func (v *VirtualHost) DisableAuthorization() bool {
	// No authorization, so it is disabled.
	if v.AuthorizationConfigured() {
		// No policy specified, default is to not disable.
		if v.Authorization.AuthPolicy == nil {
			return false
		}

		return v.Authorization.AuthPolicy.Disabled
	}

	return false
}

// IsConfigured returns whether service ref is configured
func (r *ExtensionServiceReference) IsConfigured() bool {
	return r.Name != ""
}

// AuthorizationContext returns the authorization policy context (if present).
func (v *VirtualHost) AuthorizationContext() map[string]string {
	if v.AuthorizationConfigured() {
		if v.Authorization.AuthPolicy != nil {
			return v.Authorization.AuthPolicy.Context
		}
	}

	return nil
}

// GetPrefixReplacements returns replacement prefixes from the path
// rewrite policy (if any).
func (r *Route) GetPrefixReplacements() []ReplacePrefix {
	if r.PathRewritePolicy != nil {
		return r.PathRewritePolicy.ReplacePrefix
	}
	return nil
}

// AuthorizationContext merges the parent context entries with the
// context from this Route. Common keys from the parent map will be
// overwritten by keys from the route. The parent map may be nil.
func (r *Route) AuthorizationContext(parent map[string]string) map[string]string {
	values := make(map[string]string, len(parent))

	maps.Copy(values, parent)

	if r.AuthPolicy != nil {
		maps.Copy(values, r.AuthPolicy.Context)
	}

	if len(values) == 0 {
		return nil
	}

	return values
}

// AddError adds an error-level Subcondition to the DetailedCondition.
// AddError will also update the DetailedCondition's state to take into account
// the error that's present.
// If a SubCondition with the given errorType exists, will overwrite the details.
func (dc *DetailedCondition) AddError(errorType, reason, message string) {
	message = truncateLongMessage(message)

	// Update the condition so that it indicates there's at least one error
	// This needs to be here because conditions may be normal-true (positive)
	// polarity (like `Valid`), or abnormal-true (negative) polarity
	// (like `ErrorPresent`)
	if dc.IsPositivePolarity() {
		dc.Status = ConditionFalse
	} else {
		dc.Status = ConditionTrue
	}
	dc.Reason = "ErrorPresent"
	dc.Message = "At least one error present, see Errors for details"

	dc.Errors = append(dc.Errors, SubCondition{
		Type:    errorType,
		Status:  ConditionTrue,
		Message: message,
		Reason:  reason,
	})
}

// AddErrorf adds an error-level Subcondition to the DetailedCondition, using
// fmt.Sprintf on the formatmsg and args params.
// If a SubCondition with the given errorType exists, will overwrite the details.
func (dc *DetailedCondition) AddErrorf(errorType, reason, formatmsg string, args ...any) {
	dc.AddError(errorType, reason, fmt.Sprintf(formatmsg, args...))
}

// GetError gets an error of the given errorType.
// Similar to a hash lookup, will return true in the second value if a match is
// found, and false otherwise.
func (dc *DetailedCondition) GetError(errorType string) (SubCondition, bool) {
	i := getIndex(errorType, dc.Errors)

	if i == -1 {
		return SubCondition{}, false
	}

	return dc.Errors[i], true
}

// AddWarning adds an warning-level Subcondition to the DetailedCondition.
// If a SubCondition with the given warnType exists, will overwrite the details.
// Note that adding warnings does not update the DetailedCondition Reason or Message.
func (dc *DetailedCondition) AddWarning(warnType, reason, message string) {
	message = truncateLongMessage(message)

	dc.Warnings = append(dc.Warnings, SubCondition{
		Type:    warnType,
		Status:  ConditionTrue,
		Reason:  reason,
		Message: message,
	})
}

// AddWarningf adds an warning-level Subcondition to the DetailedCondition, using
// fmt.Sprintf on the formatmsg and args params.
// If a SubCondition with the given errorType exists, will overwrite the details.
// Note that adding warnings does not update the DetailedCondition Reason or Message.
func (dc *DetailedCondition) AddWarningf(warnType, reason, formatmsg string, args ...any) {
	dc.AddWarning(warnType, reason, fmt.Sprintf(formatmsg, args...))
}

// GetWarning gets an warning of the given warnType.
// Similar to a hash lookup, will return true in the second value if a match is
// found, and false otherwise.
func (dc *DetailedCondition) GetWarning(warnType string) (SubCondition, bool) {
	i := getIndex(warnType, dc.Warnings)

	if i == -1 {
		return SubCondition{}, false
	}

	return dc.Warnings[i], true
}

// IsPositivePolarity returns true if the DetailedCondition is a positive-polarity
// condition like `Valid` or `Ready`, and false otherwise.
func (dc *DetailedCondition) IsPositivePolarity() bool {
	switch dc.Type {
	case ValidConditionType:
		return true
	default:
		return false
	}
}

// getIndex checks if a SubCondition of type condType exists in the
// slice, and returns its index if so. If not, returns -1.
func getIndex(condType string, subconds []SubCondition) int {
	for i, cond := range subconds {
		if cond.Type == condType {
			return i
		}
	}
	return -1
}

// GetConditionFor returns the a pointer to the condition for a given type,
// or nil if there are none currently present.
func (status *HTTPProxyStatus) GetConditionFor(condType string) *DetailedCondition {
	for i, cond := range status.Conditions {
		if cond.Type == condType {
			return &status.Conditions[i]
		}
	}

	return nil
}

// LongMessageLength specifies the maximum size any message field should be.
// This is enforced on the apiserver side by CRD validation requirements.
const LongMessageLength = 32760

// truncateLongMessage truncates long message strings
// to near the max size.
func truncateLongMessage(message string) string {
	if len(message) > LongMessageLength {
		return message[:LongMessageLength]
	}
	return message
}

```

### Core Architecture Module: `apis/projectcontour/v1/httpproxy.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v1

import (
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// HTTPProxySpec defines the spec of the CRD.
type HTTPProxySpec struct {
	// Virtualhost appears at most once. If it is present, the object is considered
	// to be a "root" HTTPProxy.
	// +optional
	VirtualHost *VirtualHost `json:"virtualhost,omitempty"`
	// Routes are the ingress routes. If TCPProxy is present, Routes is ignored.
	//  +optional
	Routes []Route `json:"routes,omitempty"`
	// TCPProxy holds TCP proxy information.
	// +optional
	TCPProxy *TCPProxy `json:"tcpproxy,omitempty"`
	// Includes allow for specific routing configuration to be included from another HTTPProxy,
	// possibly in another namespace.
	// +optional
	Includes []Include `json:"includes,omitempty"`
	// IngressClassName optionally specifies the ingress class to use for this
	// HTTPProxy. This replaces the deprecated `kubernetes.io/ingress.class`
	// annotation. For backwards compatibility, when that annotation is set, it
	// is given precedence over this field.
	// +optional
	IngressClassName string `json:"ingressClassName,omitempty"`
}

// Namespace refers to a Kubernetes namespace. It must be a RFC 1123 label.
//
// This validation is based off of the corresponding Kubernetes validation:
// https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187
//
// This is used for Namespace name validation here:
// https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63
//
// Valid values include:
//
// * "example"
//
// Invalid values include:
//
// * "example.com" - "." is an invalid character
//
// +kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
// +kubebuilder:validation:MinLength=1
// +kubebuilder:validation:MaxLength=63
type Namespace string

// Include describes a set of policies that can be applied to an HTTPProxy in a namespace.
type Include struct {
	// Name of the HTTPProxy
	// +kubebuilder:validation:MinLength=1
	Name string `json:"name"`
	// Namespace of the HTTPProxy to include. Defaults to the current namespace if not supplied.
	// +optional
	Namespace string `json:"namespace,omitempty"`
	// Conditions are a set of rules that are applied to included HTTPProxies.
	// In effect, they are added onto the Conditions of included HTTPProxy Route
	// structs.
	// When applied, they are merged using AND, with one exception:
	// There can be only one Prefix MatchCondition per Conditions slice.
	// More than one Prefix, or contradictory Conditions, will make the
	// include invalid. Exact and Regex match conditions are not allowed
	// on includes.
	// +optional
	Conditions []MatchCondition `json:"conditions,omitempty"`
}

// MatchCondition are a general holder for matching rules for HTTPProxies.
// One of Prefix, Exact, Regex, Header or QueryParameter must be provided.
type MatchCondition struct {
	// Prefix defines a prefix match for a request.
	// +optional
	Prefix string `json:"prefix,omitempty"`

	// Exact defines a exact match for a request.
	// This field is not allowed in include match conditions.
	// +optional
	Exact string `json:"exact,omitempty"`

	// Regex defines a regex match for a request.
	// This field is not allowed in include match conditions.
	// +optional
	Regex string `json:"regex,omitempty"`

	// Header specifies the header condition to match.
	// +optional
	Header *HeaderMatchCondition `json:"header,omitempty"`

	// QueryParameter specifies the query parameter condition to match.
	// +optional
	QueryParameter *QueryParameterMatchCondition `json:"queryParameter,omitempty"`
}

// HeaderMatchCondition specifies how to conditionally match against HTTP
// headers. The Name field is required, only one of Present, NotPresent,
// Contains, NotContains, Exact, NotExact and Regex can be set.
// For negative matching rules only (e.g. NotContains or NotExact) you can set
// TreatMissingAsEmpty.
// IgnoreCase has no effect for Regex.
type HeaderMatchCondition struct {
	// Name is the name of the header to match against. Name is required.
	// Header names are case insensitive.
	// +kubebuilder:validation:MinLength=1
	Name string `json:"name"`

	// Present specifies that condition is true when the named header
	// is present, regardless of its value. Note that setting Present
	// to false does not make the condition true if the named header
	// is absent.
	// +optional
	Present bool `json:"present,omitempty"`

	// NotPresent specifies that condition is true when the named header
	// is not present. Note that setting NotPresent to false does not
	// make the condition true if the named header is present.
	// +optional
	NotPresent bool `json:"notpresent,omitempty"`

	// Contains specifies a substring that must be present in
	// the header value.
	// +optional
	Contains string `json:"contains,omitempty"`

	// NotContains specifies a substring that must not be present
	// in the header value.
	// +optional
	NotContains string `json:"notcontains,omitempty"`

	// IgnoreCase specifies that string matching should be case insensitive.
	// Note that this has no effect on the Regex parameter.
	// +optional
	IgnoreCase bool `json:"ignoreCase,omitempty"`

	// Exact specifies a string that the header value must be equal to.
	// +optional
	Exact string `json:"exact,omitempty"`

	// NoExact specifies a string that the header value must not be
	// equal to. The condition is true if the header has any other value.
	// +optional
	NotExact string `json:"notexact,omitempty"`

	// Regex specifies a regular expression pattern that must match the header
	// value.
	// +optional
	Regex string `json:"regex,omitempty"`

	// TreatMissingAsEmpty specifies if the header match rule specified header
	// does not exist, this header value will be treated as empty. Defaults to false.
	// Unlike the underlying Envoy implementation this is **only** supported for
	// negative matches (e.g. NotContains, NotExact).
	// +optional
	TreatMissingAsEmpty bool `json:"treatMissingAsEmpty,omitempty"`
}

// QueryParameterMatchCondition specifies how to conditionally match against HTTP
// query parameters. The Name field is required, only one of Exact, Prefix,
// Suffix, Regex, Contains and Present can be set. IgnoreCase has no effect
// for Regex.
type QueryParameterMatchCondition struct {
	// Name is the name of the query parameter to match against. Name is required.
	// Query parameter names are case insensitive.
	Name string `json:"name"`

	// Exact specifies a string that the query parameter value must be equal to.
	// +optional
	Exact string `json:"exact,omitempty"`

	// Prefix defines a prefix match for the query parameter value.
	// +optional
	Prefix string `json:"prefix,omitempty"`

	// Suffix defines a suffix match for a query parameter value.
	// +optional
	Suffix string `json:"suffix,omitempty"`

	// Regex specifies a regular expression pattern that must match the query
	// parameter value.
	// +optional
	Regex string `json:"regex,omitempty"`

	// Contains specifies a substring that must be present in
	// the query parameter value.
	// +optional
	Contains string `json:"contains,omitempty"`

	// IgnoreCase specifies that string matching should be case insensitive.
	// Note that this has no effect on the Regex parameter.
	// +optional
	IgnoreCase bool `json:"ignoreCase,omitempty"`

	// Present specifies that condition is true when the named query parameter
	// is present, regardless of its value. Note that setting Present
	// to false does not make the condition true if the named query parameter
	// is absent.
	// +optional
	Present bool `json:"present,omitempty"`
}

// ExtensionServiceReference names an ExtensionService resource.
type ExtensionServiceReference struct {
	// API version of the referent.
	// If this field is not specified, the default "projectcontour.io/v1alpha1" will be used
	//
	// +optional
	// +kubebuilder:validation:MinLength=1
	APIVersion string `json:"apiVersion,omitempty" protobuf:"bytes,5,opt,name=apiVersion"`

	// Namespace of the referent.
	// If this field is not specifies, the namespace of the resource that targets the referent will be used.
	//
	// More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
	//
	// +optional
	// +kubebuilder:validation:MinLength=1
	Namespace string `json:"namespace,omitempty" protobuf:"bytes,2,opt,name=namespace"`

	// Name of the referent.
	//
	// More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
	//
	// +kubebuilder:validation:MinLength=1
	Name string `json:"name,omitempty" protobuf:"bytes,3,opt,name=name"`
}

// AuthorizationServiceType indicates the protocol
// implemented by the external authorization server.
type AuthorizationServiceType string

const (
	AuthorizationGRPCService AuthorizationServiceType = "grpc"
	AuthorizationHTTPService AuthorizationServiceType = "http"
)

// AuthorizationServer configures an external server to authenticate
// client requests. The external server must implement the v3 Envoy
// external authorization GRPC protocol (https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto)
// or the HTTP authorization server protocol.
// +kubebuilder:validation:XValidation:message="httpSettings can only be set when serviceType is 'http'",rule="!has(self.
```

### Core Architecture Module: `apis/projectcontour/v1/register.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v1

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	// GroupName is the group name for the Contour API
	GroupName = "projectcontour.io"
)

// SchemeGroupVersion is a compatibility name for the GroupVersion.
// New code should use GroupVersion.
var SchemeGroupVersion = GroupVersion

var (
	HTTPProxyGVR                = GroupVersion.WithResource("httpproxies")
	TLSCertificateDelegationGVR = GroupVersion.WithResource("tlscertificatedelegations")
)

// Resource gets an Contour GroupResource for a specified resource
func Resource(resource string) schema.GroupResource {
	return GroupVersion.WithResource(resource).GroupResource()
}

// AddKnownTypes is exported for backwards compatibility with third
// parties who depend on this symbol, but all new code should use
// AddToScheme.
func AddKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(
		GroupVersion,
		&HTTPProxy{},
		&HTTPProxyList{},
		&TLSCertificateDelegation{},
		&TLSCertificateDelegationList{},
	)
	meta_v1.AddToGroupVersion(scheme, GroupVersion)
	return nil
}

// The following declarations are kubebuilder-compatible and will be expected
// by third parties who import the Contour API types.

var (
	// GroupVersion is group version used to register these objects
	GroupVersion = schema.GroupVersion{Group: GroupName, Version: "v1"}

	// SchemeBuilder is used to add go types to the GroupVersionKind scheme
	SchemeBuilder = runtime.NewSchemeBuilder(AddKnownTypes)

	// AddToScheme adds the types in this group-version to the given scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)

```

### Core Architecture Module: `apis/projectcontour/v1/tlscertificatedelegation.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v1

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TLSCertificateDelegationSpec defines the spec of the CRD
type TLSCertificateDelegationSpec struct {
	Delegations []CertificateDelegation `json:"delegations"`
}

// CertificateDelegation maps the authority to reference a secret
// in the current namespace to a set of namespaces.
type CertificateDelegation struct {
	// required, the name of a secret in the current namespace.
	SecretName string `json:"secretName"`

	// required, the namespaces the authority to reference the
	// secret will be delegated to.
	// If TargetNamespaces is nil or empty, the CertificateDelegation'
	// is ignored. If the TargetNamespace list contains the character, "*"
	// the secret will be delegated to all namespaces.
	TargetNamespaces []string `json:"targetNamespaces"`
}

// TLSCertificateDelegationStatus allows for the status of the delegation
// to be presented to the user.
type TLSCertificateDelegationStatus struct {
	// +optional
	// Conditions contains information about the current status of the HTTPProxy,
	// in an upstream-friendly container.
	//
	// Contour will update a single condition, `Valid`, that is in normal-true polarity.
	// That is, when `currentStatus` is `valid`, the `Valid` condition will be `status: true`,
	// and vice versa.
	//
	// Contour will leave untouched any other Conditions set in this block,
	// in case some other controller wants to add a Condition.
	//
	// If you are another controller owner and wish to add a condition, you *should*
	// namespace your condition with a label, like `controller.domain.com\ConditionName`.
	// +patchMergeKey=type
	// +patchStrategy=merge
	// +listType=map
	// +listMapKey=type
	Conditions []DetailedCondition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type"`
}

// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// TLSCertificateDelegation is an TLS Certificate Delegation CRD specification.
// See design/tls-certificate-delegation.md for details.
// +k8s:openapi-gen=true
// +kubebuilder:resource:scope=Namespaced,path=tlscertificatedelegations,shortName=tlscerts,singular=tlscertificatedelegation
// +kubebuilder:subresource:status
type TLSCertificateDelegation struct {
	meta_v1.TypeMeta   `json:",inline"`
	meta_v1.ObjectMeta `json:"metadata"`

	Spec TLSCertificateDelegationSpec `json:"spec"`
	// +optional
	Status TLSCertificateDelegationStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// TLSCertificateDelegationList is a list of TLSCertificateDelegations.
type TLSCertificateDelegationList struct {
	meta_v1.TypeMeta `json:",inline"`
	meta_v1.ListMeta `json:"metadata"`
	Items            []TLSCertificateDelegation `json:"items"`
}

```

### Core Architecture Module: `apis/projectcontour/v1/zz_generated.deepcopy.go`
```
//go:build !ignore_autogenerated

/*
Copyright Project Contour Authors

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

package v1

import (
	"k8s.io/apimachinery/pkg/runtime"
)

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *AuthorizationPolicy) DeepCopyInto(out *AuthorizationPolicy) {
	*out = *in
	if in.Context != nil {
		in, out := &in.Context, &out.Context
		*out = make(map[string]string, len(*in))
		for key, val := range *in {
			(*out)[key] = val
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new AuthorizationPolicy.
func (in *AuthorizationPolicy) DeepCopy() *AuthorizationPolicy {
	if in == nil {
		return nil
	}
	out := new(AuthorizationPolicy)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *AuthorizationServer) DeepCopyInto(out *AuthorizationServer) {
	*out = *in
	out.ExtensionServiceRef = in.ExtensionServiceRef
	if in.HTTPServerSettings != nil {
		in, out := &in.HTTPServerSettings, &out.HTTPServerSettings
		*out = new(HTTPAuthorizationServerSettings)
		(*in).DeepCopyInto(*out)
	}
	if in.AuthPolicy != nil {
		in, out := &in.AuthPolicy, &out.AuthPolicy
		*out = new(AuthorizationPolicy)
		(*in).DeepCopyInto(*out)
	}
	if in.WithRequestBody != nil {
		in, out := &in.WithRequestBody, &out.WithRequestBody
		*out = new(AuthorizationServerBufferSettings)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new AuthorizationServer.
func (in *AuthorizationServer) DeepCopy() *AuthorizationServer {
	if in == nil {
		return nil
	}
	out := new(AuthorizationServer)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *AuthorizationServerBufferSettings) DeepCopyInto(out *AuthorizationServerBufferSettings) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new AuthorizationServerBufferSettings.
func (in *AuthorizationServerBufferSettings) DeepCopy() *AuthorizationServerBufferSettings {
	if in == nil {
		return nil
	}
	out := new(AuthorizationServerBufferSettings)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *CORSPolicy) DeepCopyInto(out *CORSPolicy) {
	*out = *in
	if in.AllowOrigin != nil {
		in, out := &in.AllowOrigin, &out.AllowOrigin
		*out = make([]string, len(*in))
		copy(*out, *in)
	}
	if in.AllowMethods != nil {
		in, out := &in.AllowMethods, &out.AllowMethods
		*out = make([]CORSHeaderValue, len(*in))
		copy(*out, *in)
	}
	if in.AllowHeaders != nil {
		in, out := &in.AllowHeaders, &out.AllowHeaders
		*out = make([]CORSHeaderValue, len(*in))
		copy(*out, *in)
	}
	if in.ExposeHeaders != nil {
		in, out := &in.ExposeHeaders, &out.ExposeHeaders
		*out = make([]CORSHeaderValue, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new CORSPolicy.
func (in *CORSPolicy) DeepCopy() *CORSPolicy {
	if in == nil {
		return nil
	}
	out := new(CORSPolicy)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *CertificateDelegation) DeepCopyInto(out *CertificateDelegation) {
	*out = *in
	if in.TargetNamespaces != nil {
		in, out := &in.TargetNamespaces, &out.TargetNamespaces
		*out = make([]string, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new CertificateDelegation.
func (in *CertificateDelegation) DeepCopy() *CertificateDelegation {
	if in == nil {
		return nil
	}
	out := new(CertificateDelegation)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *ClientCertificateDetails) DeepCopyInto(out *ClientCertificateDetails) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ClientCertificateDetails.
func (in *ClientCertificateDetails) DeepCopy() *ClientCertificateDetails {
	if in == nil {
		return nil
	}
	out := new(ClientCertificateDetails)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *CookieDomainRewrite) DeepCopyInto(out *CookieDomainRewrite) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new CookieDomainRewrite.
func (in *CookieDomainRewrite) DeepCopy() *CookieDomainRewrite {
	if in == nil {
		return nil
	}
	out := new(CookieDomainRewrite)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *CookiePathRewrite) DeepCopyInto(out *CookiePathRewrite) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new CookiePathRewrite.
func (in *CookiePathRewrite) DeepCopy() *CookiePathRewrite {
	if in == nil {
		return nil
	}
	out := new(CookiePathRewrite)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *CookieRewritePolicy) DeepCopyInto(out *CookieRewritePolicy) {
	*out = *in
	if in.PathRewrite != nil {
		in, out := &in.PathRewrite, &out.PathRewrite
		*out = new(CookiePathRewrite)
		**out = **in
	}
	if in.DomainRewrite != nil {
		in, out := &in.DomainRewrite, &out.DomainRewrite
		*out = new(CookieDomainRewrite)
		**out = **in
	}
	if in.Secure != nil {
		in, out := &in.Secure, &out.Secure
		*out = new(bool)
		**out = **in
	}
	if in.SameSite != nil {
		in, out := &in.SameSite, &out.SameSite
		*out = new(string)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new CookieRewritePolicy.
func (in *CookieRewritePolicy) DeepCopy() *CookieRewritePolicy {
	if in == nil {
		return nil
	}
	out := new(CookieRewritePolicy)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *DetailedCondition) DeepCopyInto(out *DetailedCondition) {
	*out = *in
	in.Condition.DeepCopyInto(&out.Condition)
	if in.Errors != nil {
		in, out := &in.Errors, &out.Errors
		*out = make([]SubCondition, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
	if in.Warnings != nil {
		in, out := &in.Warnings, &out.Warnings
		*out = make([]SubCondition, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new DetailedCondition.
func (in *DetailedCondition) DeepCopy() *DetailedCondition {
	if in == nil {
		return nil
	}
	out := new(DetailedCondition)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *DownstreamValidation) DeepCopyInto(out *DownstreamValidation) {
	*out = *in
	if in.ForwardClientCertificate != nil {
		in, out := &in.ForwardClientCertificate, &out.ForwardClientCertificate
		*out = new(ClientCertificateDetails)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new DownstreamValidation.
func (in *DownstreamValidation) DeepCopy() *DownstreamValidation {
	if in == nil {
		return nil
	}
	out := new(DownstreamValidation)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *ExtensionServiceReference) DeepCopyInto(out *ExtensionServiceReference) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ExtensionServiceReference.
func (in *ExtensionServiceReference) DeepCopy() *ExtensionServiceReference {
	if in == nil {
		return nil
	}
	out := new(ExtensionServiceReference)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *GenericKeyDescriptor) DeepCopyInto(out *GenericKeyDescriptor) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GenericKeyDescriptor.
func (in *GenericKeyDescriptor) DeepCopy() *GenericKeyDescriptor {
	if in == nil {
		return nil
	}
	out := new(GenericKeyDescriptor)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *GlobalRateLimitPolicy) DeepCopyInto(out *GlobalRateLimitPolicy) {
	*out = *in
	if in.Descriptors != nil {
		in, out := &in.Descriptors, &out.Descriptors
		*out = make([]RateLimitDescriptor, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GlobalRateLimitPolicy.
func (in *GlobalRateLimitPolicy) DeepCopy() *GlobalRateLimitPolicy {
	if in == ni
```

### Core Architecture Module: `apis/projectcontour/v1alpha1/accesslog.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v1alpha1

import (
	"fmt"
	"regexp"
	"strings"
)

// DefaultAccessLogJSONFields are fields that will be included by default when JSON logging is enabled.
var DefaultAccessLogJSONFields = AccessLogJSONFields([]string{
	"@timestamp",
	"authority",
	"bytes_received",
	"bytes_sent",
	"downstream_local_address",
	"downstream_remote_address",
	"duration",
	"method",
	"path",
	"protocol",
	"request_id",
	"requested_server_name",
	"response_code",
	"response_flags",
	"uber_trace_id",
	"upstream_cluster",
	"upstream_host",
	"upstream_local_address",
	"upstream_service_time",
	"user_agent",
	"x_forwarded_for",
	"grpc_status",
	"grpc_status_number",
})

// DefaultAccessLogType is the default access log format.
const DefaultAccessLogType = EnvoyAccessLog

// jsonFields is the canonical translation table for JSON fields to Envoy log template formats,
// used for specifying fields for Envoy to log when JSON logging is enabled.
var jsonFields = map[string]string{
	"@timestamp":               "%START_TIME%",
	"ts":                       "%START_TIME%",
	"authority":                "%REQ(:AUTHORITY)%",
	"method":                   "%REQ(:METHOD)%",
	"path":                     "%REQ(X-ENVOY-ORIGINAL-PATH?:PATH)%",
	"request_id":               "%REQ(X-REQUEST-ID)%",
	"uber_trace_id":            "%REQ(UBER-TRACE-ID)%",
	"upstream_service_time":    "%RESP(X-ENVOY-UPSTREAM-SERVICE-TIME)%",
	"user_agent":               "%REQ(USER-AGENT)%",
	"x_forwarded_for":          "%REQ(X-FORWARDED-FOR)%",
	"x_trace_id":               "%REQ(X-TRACE-ID)%",
	"tls_ja3_fingerprint":      "%TLS_JA3_FINGERPRINT%",
	"tls_ja4_fingerprint":      "%TLS_JA4_FINGERPRINT%",
	"contour_config_kind":      "%METADATA(ROUTE:envoy.access_loggers.file:io.projectcontour.kind)%",
	"contour_config_namespace": "%METADATA(ROUTE:envoy.access_loggers.file:io.projectcontour.namespace)%",
	"contour_config_name":      "%METADATA(ROUTE:envoy.access_loggers.file:io.projectcontour.name)%",
}

// envoySimpleOperators is the list of known supported Envoy log template keywords that do not
// have arguments nor require canonical translations.
var envoySimpleOperators = map[string]struct{}{
	"BYTES_RECEIVED":                                {},
	"BYTES_SENT":                                    {},
	"CONNECTION_ID":                                 {},
	"CONNECTION_TERMINATION_DETAILS":                {},
	"DOWNSTREAM_DIRECT_REMOTE_ADDRESS":              {},
	"DOWNSTREAM_DIRECT_REMOTE_ADDRESS_WITHOUT_PORT": {},
	"DOWNSTREAM_DIRECT_REMOTE_PORT":                 {},
	"DOWNSTREAM_HEADER_BYTES_RECEIVED":              {},
	"DOWNSTREAM_HEADER_BYTES_SENT":                  {},
	"DOWNSTREAM_LOCAL_ADDRESS":                      {},
	"DOWNSTREAM_LOCAL_ADDRESS_WITHOUT_PORT":         {},
	"DOWNSTREAM_LOCAL_PORT":                         {},
	"DOWNSTREAM_LOCAL_SUBJECT":                      {},
	"DOWNSTREAM_LOCAL_URI_SAN":                      {},
	"DOWNSTREAM_PEER_CERT":                          {},
	"DOWNSTREAM_PEER_CERT_V_END":                    {},
	"DOWNSTREAM_PEER_CERT_V_START":                  {},
	"DOWNSTREAM_PEER_FINGERPRINT_1":                 {},
	"DOWNSTREAM_PEER_FINGERPRINT_256":               {},
	"DOWNSTREAM_PEER_ISSUER":                        {},
	"DOWNSTREAM_PEER_SERIAL":                        {},
	"DOWNSTREAM_PEER_SUBJECT":                       {},
	"DOWNSTREAM_PEER_URI_SAN":                       {},
	"DOWNSTREAM_REMOTE_ADDRESS":                     {},
	"DOWNSTREAM_REMOTE_ADDRESS_WITHOUT_PORT":        {},
	"DOWNSTREAM_REMOTE_PORT":                        {},
	"DOWNSTREAM_TLS_CIPHER":                         {},
	"DOWNSTREAM_TLS_SESSION_ID":                     {},
	"DOWNSTREAM_TLS_VERSION":                        {},
	"DOWNSTREAM_WIRE_BYTES_RECEIVED":                {},
	"DOWNSTREAM_WIRE_BYTES_SENT":                    {},
	"DURATION":                                      {},
	"FILTER_CHAIN_NAME":                             {},
	"GRPC_STATUS":                                   {},
	"GRPC_STATUS_NUMBER":                            {},
	"HOSTNAME":                                      {},
	"LOCAL_REPLY_BODY":                              {},
	"PROTOCOL":                                      {},
	"REQUEST_HEADERS_BYTES":                         {},
	"REQUESTED_SERVER_NAME":                         {},
	"REQUEST_DURATION":                              {},
	"REQUEST_TX_DURATION":                           {},
	"RESPONSE_CODE":                                 {},
	"RESPONSE_CODE_DETAILS":                         {},
	"RESPONSE_DURATION":                             {},
	"RESPONSE_FLAGS":                                {},
	"RESPONSE_HEADERS_BYTES":                        {},
	"RESPONSE_TRAILERS_BYTES":                       {},
	"RESPONSE_TX_DURATION":                          {},
	"ROUTE_NAME":                                    {},
	"SPAN_ID":                                       {},
	"START_TIME":                                    {},
	"TLS_JA3_FINGERPRINT":                           {},
	"TLS_JA4_FINGERPRINT":                           {},
	"TRACE_ID":                                      {},
	"UPSTREAM_CLUSTER":                              {},
	"UPSTREAM_FILTER_STATE":                         {},
	"UPSTREAM_HEADER_BYTES_RECEIVED":                {},
	"UPSTREAM_HEADER_BYTES_SENT":                    {},
	"UPSTREAM_HOST":                                 {},
	"UPSTREAM_LOCAL_ADDRESS":                        {},
	"UPSTREAM_LOCAL_ADDRESS_WITHOUT_PORT":           {},
	"UPSTREAM_LOCAL_PORT":                           {},
	"UPSTREAM_PEER_CERT":                            {},
	"UPSTREAM_PEER_CERT_V_END":                      {},
	"UPSTREAM_PEER_CERT_V_START":                    {},
	"UPSTREAM_PEER_ISSUER":                          {},
	"UPSTREAM_PEER_SUBJECT":                         {},
	"UPSTREAM_PROTOCOL":                             {},
	"UPSTREAM_REMOTE_ADDRESS":                       {},
	"UPSTREAM_REMOTE_ADDRESS_WITHOUT_PORT":          {},
	"UPSTREAM_REMOTE_PORT":                          {},
	"UPSTREAM_REQUEST_ATTEMPT_COUNT":                {},
	"UPSTREAM_TLS_CIPHER":                           {},
	"UPSTREAM_TLS_SESSION_ID":                       {},
	"UPSTREAM_TLS_VERSION":                          {},
	"UPSTREAM_TRANSPORT_FAILURE_REASON":             {},
	"UPSTREAM_WIRE_BYTES_RECEIVED":                  {},
	"UPSTREAM_WIRE_BYTES_SENT":                      {},
	"VIRTUAL_CLUSTER_NAME":                          {},
}

// envoyComplexOperators is the list of known Envoy log template keywords that require
// arguments.
var envoyComplexOperators = map[string]struct {
	argsOptional       bool
	truncateDisallowed bool
}{
	"ENVIRONMENT":       {},
	"METADATA":          {},
	"REQ":               {},
	"REQ_WITHOUT_QUERY": {},
	"RESP":              {},
	"START_TIME": {
		argsOptional:       true,
		truncateDisallowed: true,
	},
	"TRAILER": {},
}

// AccessLogType is the name of a supported access logging mechanism.
type AccessLogType string

func (a AccessLogType) Validate() error {
	switch a {
	case EnvoyAccessLog, JSONAccessLog:
		return nil
	default:
		return fmt.Errorf("invalid access log format %q", a)
	}
}

const (
	// Set the Envoy access logging to Envoy's standard format.
	// Can be customized using `accessLogFormatString`.
	EnvoyAccessLog AccessLogType = "envoy"
	// Set the Envoy access logging to a JSON format.
	// Can be customized using `jsonFields`.
	JSONAccessLog AccessLogType = "json"
)

type AccessLogJSONFields []string

func (a AccessLogJSONFields) Validate() error {
	for key, val := range a.AsFieldMap() {
		if val == "" {
			return fmt.Errorf("invalid JSON log field name %s", key)
		}

		if jsonFields[key] == val {
			continue
		}

		err := parseAccessLogFormatString(val)
		if err != nil {
			return fmt.Errorf("invalid JSON field: %s", err)
		}
	}

	return nil
}

func (a AccessLogJSONFields) AsFieldMap() map[string]string {
	fieldMap := map[string]string{}

	for _, val := range a {
		parts := strings.SplitN(val, "=", 2)

		if len(parts) == 1 {
			operator, foundInFieldMapping := jsonFields[val]
			_, isSimpleOperator := envoySimpleOperators[strings.ToUpper(val)]

			switch {
			case isSimpleOperator && !foundInFieldMapping:
				// Operator name is known to be simple, upcase and wrap it in percents.
				fieldMap[val] = fmt.Sprintf("%%%s%%", strings.ToUpper(val))
			case foundInFieldMapping:
				// Operator name has a known mapping, store the result of the mapping.
				fieldMap[val] = operator
			default:
				// Operator name not found, save as emptystring and let validation catch it later.
				fieldMap[val] = ""
			}
		} else {
			// Value is a full key:value pair, store it as is.
			fieldMap[parts[0]] = parts[1]
		}
	}

	return fieldMap
}

type AccessLogLevel string

func (a AccessLogLevel) Validate() error {
	switch a {
	case LogLevelDisabled, LogLevelError, LogLevelCritical, LogLevelInfo:
		return nil
	default:
		return fmt.Errorf("invalid access log level %q", a)
	}
}

const (
	// Log all requests. This is the default.
	LogLevelInfo AccessLogLevel = "info"
	// Log only requests that result in a non-success (i.e. 300+) response code
	LogLevelError AccessLogLevel = "error"
	// Log only requests that result in an server error (i.e. 500+) response code.
	LogLevelCritical AccessLogLevel = "critical"
	// Disable the access log.
	LogLevelDisabled AccessLogLevel = "disabled"

```

### Core Architecture Module: `apis/projectcontour/v1alpha1/ciphersuites.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v1alpha1

// DefaultTLSCiphers contains the list of default ciphers used by Contour. A handful are
// commented out, as they're arguably less secure. They're also unnecessary
// - most of the clients that might need to use the commented ciphers are
// unable to connect without TLS 1.0, which contour never enables.
//
// Ciphers are listed in order of preference.
// [cipher1|cipher2|...] defines an equal-preference group of ciphers.
//
// This list is ignored if the client and server negotiate TLS 1.3.
//
// The commented ciphers are left in place to simplify updating this list for future
// versions of envoy.
var DefaultTLSCiphers = []string{
	"[ECDHE-ECDSA-AES128-GCM-SHA256|ECDHE-ECDSA-CHACHA20-POLY1305]",
	"[ECDHE-RSA-AES128-GCM-SHA256|ECDHE-RSA-CHACHA20-POLY1305]",
	// "ECDHE-ECDSA-AES128-SHA",
	// "ECDHE-RSA-AES128-SHA",
	// "AES128-GCM-SHA256",
	// "AES128-SHA",
	"ECDHE-ECDSA-AES256-GCM-SHA384",
	"ECDHE-RSA-AES256-GCM-SHA384",
	// "ECDHE-ECDSA-AES256-SHA",
	// "ECDHE-RSA-AES256-SHA",
	// "AES256-GCM-SHA384",
	// "AES256-SHA",
}

// ValidTLSCiphers contains the list of TLS ciphers that Envoy supports
// See: https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/transport_sockets/tls/v3/common.proto#extensions-transport-sockets-tls-v3-tlsparameters
// Note: This list is a superset of what is valid for stock Envoy builds and those using BoringSSL FIPS.
var ValidTLSCiphers = map[string]struct{}{
	"ECDHE-ECDSA-CHACHA20-POLY1305": {},
	"ECDHE-RSA-CHACHA20-POLY1305":   {},
	"ECDHE-ECDSA-AES128-GCM-SHA256": {},
	"ECDHE-RSA-AES128-GCM-SHA256":   {},
	"ECDHE-ECDSA-AES128-SHA":        {},
	"ECDHE-RSA-AES128-SHA":          {},
	"AES128-GCM-SHA256":             {},
	"AES128-SHA":                    {},
	"ECDHE-ECDSA-AES256-GCM-SHA384": {},
	"ECDHE-RSA-AES256-GCM-SHA384":   {},
	"ECDHE-ECDSA-AES256-SHA":        {},
	"ECDHE-RSA-AES256-SHA":          {},
	"AES256-GCM-SHA384":             {},
	"AES256-SHA":                    {},
}

```

### Core Architecture Module: `apis/projectcontour/v1alpha1/compression.go`
```
// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package v1alpha1

import "fmt"

// CompressionAlgorithm defines the type of compression algorithm applied in default HTTP listener filter chain.
// Allowable values are defined as names of well known compression algorithms (plus "disabled").
type CompressionAlgorithm string

// EnvoyCompression defines configuration related to compression in the default HTTP Listener filter chain.
type EnvoyCompression struct {
	// Algorithm selects the response compression type applied in the compression HTTP filter of the default Listener filters.
	// Values: `gzip` (default), `brotli`, `zstd`, `disabled`.
	// Setting this to `disabled` will make Envoy skip "Accept-Encoding: gzip,deflate" request header and always return uncompressed response.
	// +kubebuilder:validation:Enum="gzip";"brotli";"zstd";"disabled"
	// +optional
	Algorithm CompressionAlgorithm `json:"algorithm,omitempty"`
}

func (a CompressionAlgorithm) Validate() error {
	switch a {
	case BrotliCompression, DisabledCompression, GzipCompression, ZstdCompression, "":
		return nil
	default:
		return fmt.Errorf("invalid compression type: %q", a)
	}
}

const (
	// BrotliCompression specifies brotli as the default HTTP filter chain compression mechanism
	BrotliCompression CompressionAlgorithm = "brotli"

	// DisabledCompression specifies that there will be no compression in the default HTTP filter chain
	DisabledCompression CompressionAlgorithm = "disabled"

	// GzipCompression specifies gzip as the default HTTP filter chain compression mechanism
	GzipCompression CompressionAlgorithm = "gzip"

	// ZstdCompression specifies zstd as the default HTTP filter chain compression mechanism
	ZstdCompression CompressionAlgorithm = "zstd"
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7740** (2026-10-01): **site: render table of contents on upgrading page**
  *Symptoms*: The upgrading page has shown an empty box instead of a table of contents since the site moved from Jekyll to Hugo (#3704). The `<div id="toc" class="navigation"></div>` in `upgrading.md` was where the old jQuery `toc.js` plugin rendered the TOC, but nothing in the Hugo theme fills it.  This PR:  - adds an opt-in TOC to the `page` layout (`_default/page.html`), turned on with `toc: true` in front matter and built from `.Fragments.Headings` - lists the top-level sections, with their subsections in a collapsed `<details>`. On this page that means 5 sections, with the 45 "Upgrading Contour X to Y" entries under the legacy section. Hugo's default TOC (h2–h3) would drop the h1 sections and list around 185 entries. - enables it on `resources/upgrading.md` and removes the dead div - styles it like the docs right-hand TOC  Other `page`-layout pages don't change because none of them sets `toc: true`.  This PR only touches the theme and one page, so I think `release-note/none-required` fits better than `release-note/small`. Could a maintainer update the label?  Fixes #2094  **Before**  <img width="1132" height="844" alt="image" src="https://github.com/user-attachments/assets/5fd32f2a-21d0-47e7-a35c-f8e6ae1d1197" />  **After**  <img width="1225" height="851" alt="image" src="https://github.com/user-attachments/assets/a356e530-a731-4e9b-b764-2297a887703e" />  <img width="1131" height="838" alt="image" src="https://github.com/user-attachments/assets/8fd3520b-4446-443
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/projectcontour/contour/pull/7740?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=projectcontour) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 84.04%. Comparing base ([`3d9acd4`](https://app.codecov.io/gh/projectcontour/contour/commit/3d9acd4eca9045bcd4c2e8906267392dafa70799?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=projectcontour)) to head ([`6cde3fe`](https://app.codecov.io/gh/projectcontour/contour/commit/6cde3fec9b298a94f8db9460455afc64d7a50f16?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=projectcontour)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/projectcontour/contour

- **Issue #7738** (2026-09-21): **build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1**
  *Symptoms*: Bumps [codecov/codecov-action](https://github.com/codecov/codecov-action) from 7.0.0 to 7.1.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/codecov/codecov-action/releases">codecov/codecov-action's releases</a>.</em></p> <blockquote> <h2>v7.1.1</h2> <h2>What's Changed</h2> <ul> <li>chore(release): 7.1.1 by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1973">codecov/codecov-action#1973</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v7.1.0...v7.1.1">https://github.com/codecov/codecov-action/compare/v7.1.0...v7.1.1</a></p> <h2>v7.1.0</h2> <h2>What's Changed</h2> <ul> <li>chore(release): 7.1.0 by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1971">codecov/codecov-action#1971</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v7.0.0...v7.1.0">https://github.com/codecov/codecov-action/compare/v7.0.0...v7.1.0</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/codecov/codecov-action/commit/303a32d7a59b442fa8d48b6a1cc6825c09c847a5"><code>303a32d</code></a> chore(release): 7.1.1 (<a href="https://redirect.github.com/codecov/codecov-action/issues/

- **Issue #7737** (2026-09-21): **build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1**
  *Symptoms*: Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.3.0 to 4.4.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/docker/setup-buildx-action/releases">docker/setup-buildx-action's releases</a>.</em></p> <blockquote> <h2>v4.4.1</h2> <ul> <li>Skip BuildKit image pre-pulls for explicit endpoints by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/624">docker/setup-buildx-action#624</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/docker/setup-buildx-action/compare/v4.4.0...v4.4.1">https://github.com/docker/setup-buildx-action/compare/v4.4.0...v4.4.1</a></p> <h2>v4.4.0</h2> <ul> <li>Use official Buildx releases for cloud driver by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/606">docker/setup-buildx-action#606</a></li> <li>Pull BuildKit image before builder creation by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/609">docker/setup-buildx-action#609</a></li> <li>Use shared error helpers for Buildx and Docker commands by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/620">docker/setup-buildx-action#620</a><

- **Issue #7736** (2026-09-21): **build(deps): bump sigs.k8s.io/controller-runtime from 0.25.0 to 0.25.1**
  *Symptoms*: Bumps [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) from 0.25.0 to 0.25.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/kubernetes-sigs/controller-runtime/releases">sigs.k8s.io/controller-runtime's releases</a>.</em></p> <blockquote> <h2>v0.25.1</h2> <h2>What's Changed</h2> <ul> <li>🐛 priorityqueue: fix data race on []*item in logState by <a href="https://github.com/k8s-infra-cherrypick-robot"><code>@​k8s-infra-cherrypick-robot</code></a> in <a href="https://redirect.github.com/kubernetes-sigs/controller-runtime/pull/3593">kubernetes-sigs/controller-runtime#3593</a></li> <li>🐛 client: fix subresource create RV parse error under read-your-writes consistency by <a href="https://github.com/k8s-infra-cherrypick-robot"><code>@​k8s-infra-cherrypick-robot</code></a> in <a href="https://redirect.github.com/kubernetes-sigs/controller-runtime/pull/3596">kubernetes-sigs/controller-runtime#3596</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/kubernetes-sigs/controller-runtime/compare/v0.25.0...v0.25.1">https://github.com/kubernetes-sigs/controller-runtime/compare/v0.25.0...v0.25.1</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/kubernetes-sigs/controller-runtime/commit/67b72c2517be1d2b0dec612477eb20c3c959a8aa"><code>67b72c2</code></a> [release-0.25] 🐛 client: fix subresource create RV parse error under read-yo

- **Issue #7735** (2026-09-21): **build(deps): bump github.com/onsi/ginkgo/v2 from 2.32.2 to 2.33.0**
  *Symptoms*: Bumps [github.com/onsi/ginkgo/v2](https://github.com/onsi/ginkgo) from 2.32.2 to 2.33.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/onsi/ginkgo/releases">github.com/onsi/ginkgo/v2's releases</a>.</em></p> <blockquote> <h2>v2.33.0</h2> <h3>Features</h3> <ul> <li>The JUnit reporter now records each spec's <code>ReportEntry</code>s as <code>&lt;properties&gt;</code> on its <code>&lt;testcase&gt;</code> element, with the entry's name and its JSON-encoded value.  Thanks <a href="https://github.com/pohly"><code>@​pohly</code></a>! [23db51a]</li> </ul> <h3>Maintenance</h3> <ul> <li>Releases are now cut by a GitHub Actions workflow (Actions -&gt; Release -&gt; Run workflow) rather than by hand, with changelog entries collected under <code>## Unreleased</code> as the work happens.  See RELEASING.md. [8616ecb]</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/onsi/ginkgo/blob/master/CHANGELOG.md">github.com/onsi/ginkgo/v2's changelog</a>.</em></p> <blockquote> <h2>2.33.0</h2> <h3>Features</h3> <ul> <li>The JUnit reporter now records each spec's <code>ReportEntry</code>s as <code>&lt;properties&gt;</code> on its <code>&lt;testcase&gt;</code> element, with the entry's name and its JSON-encoded value.  Thanks <a href="https://github.com/pohly"><code>@​pohly</code></a>! [23db51a]</li> </ul> <h3>Maintenance</h3> <ul> <li>Releases are now cut by a GitHub Actions workflow (

- **Issue #7734** (2026-09-21): **build(deps): bump golang.org/x/oauth2 from 0.36.0 to 0.37.0**
  *Symptoms*: Bumps [golang.org/x/oauth2](https://github.com/golang/oauth2) from 0.36.0 to 0.37.0. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/golang/oauth2/commit/c624b89dadc3221560b7345c090bbe69e90808ee"><code>c624b89</code></a> google: change the snake case endpoint to kebab-case</li> <li><a href="https://github.com/golang/oauth2/commit/09a82f63d4c718720369edfee3c7d0ff953c0b6f"><code>09a82f6</code></a> all: upgrade go directive to at least 1.26.0 [generated]</li> <li>See full diff in <a href="https://github.com/golang/oauth2/compare/v0.36.0...v0.37.0">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=golang.org/x/oauth2&package-manager=go_modules&previous-version=0.36.0&new-version=0.37.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show 

- **Issue #7733** (2026-09-21): **build(deps): bump google.golang.org/grpc from 1.83.2 to 1.84.0**
  *Symptoms*: Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.83.2 to 1.84.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/grpc/grpc-go/releases">google.golang.org/grpc's releases</a>.</em></p> <blockquote> <h2>Release 1.84.0</h2> <h1>Behavior Changes</h1> <ul> <li>stats/otel: The <code>grpc.lb.pick_first.*</code> metrics have been removed and replaced with <code>grpc.subchannel.*</code> metrics. See <a href="https://github.com/grpc/proposal/blob/master/A94-subchannel-otel-metrics.md">gRFC A94</a> for more details. (<a href="https://redirect.github.com/grpc/grpc-go/issues/9215">#9215</a>)</li> </ul> <h1>New Features</h1> <ul> <li>xds: Add support for <code>contains_match</code> in route header matchers. (<a href="https://redirect.github.com/grpc/grpc-go/issues/9223">#9223</a>) <ul> <li>Special Thanks: <a href="https://github.com/nvxbug"><code>@​nvxbug</code></a></li> </ul> </li> </ul> <h1>Bug Fixes</h1> <ul> <li>client: Fix a bug where a <code>ClientConn</code> could get permanently stuck in IDLE when an RPC was canceled during stream creation. Previously, such cancellations triggered stream cleanup twice, corrupting the channel's idleness state and causing subsequent RPCs to fail with deadline exceeded errors. (<a href="https://redirect.github.com/grpc/grpc-go/issues/9191">#9191</a>) <ul> <li>Special Thanks: <a href="https://github.com/utkuozdemir"><code>@​utkuozdemir</code></a></li> </ul> </li> <li>client: Fix a bug whe

- **Issue #7731** (2026-09-14): **build(deps): bump the codeql-action group with 4 updates**
  *Symptoms*: Bumps the codeql-action group with 4 updates: [github/codeql-action/init](https://github.com/github/codeql-action), [github/codeql-action/autobuild](https://github.com/github/codeql-action), [github/codeql-action/analyze](https://github.com/github/codeql-action) and [github/codeql-action/upload-sarif](https://github.com/github/codeql-action).  Updates `github/codeql-action/init` from 4.37.9 to 4.38.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/init's releases</a>.</em></p> <blockquote> <h2>v4.38.0</h2> <ul> <li>On GitHub-hosted runners, the CodeQL Action now deletes unused CodeQL bundles from the toolcache before downloading a different bundle, which frees up disk space for the analysis. We expect to roll this change out to everyone in September. <a href="https://redirect.github.com/github/codeql-action/pull/4124">#4124</a></li> <li>The CodeQL Action now supports CodeQL releases that are compatible with Linux Arm64 and downloads the native <code>linux-arm64</code> CodeQL bundle when available. <a href="https://redirect.github.com/github/codeql-action/pull/4072">#4072</a></li> <li>Update default CodeQL bundle version to <a href="https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.27.0">2.27.0</a>. <a href="https://redirect.github.com/github/codeql-action/pull/4129">#4129</a></li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Source

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

### Incident Patch 1: `238bd94c` (2026-10-01)
**Commit Message**: site: render table of contents on upgrading page (#7740)

Signed-off-by: mate <[REDACTED_EMAIL]>

**File**: `site/content/resources/upgrading.md` (modified, +1/-2)
```diff
@@ -1,14 +1,13 @@
 ---
 title: Upgrading Contour
 layout: page
+toc: true
 ---
 
 <!-- NOTE: this document should be formatted with one sentence per line to made reviewing easier. -->
 
 This document describes the changes needed to upgrade your Contour installation.
 
-<div id="toc" class="navigation"></div>
-
 # Before you start
 
 Contour currently only tests sequential upgrades, i.e. without skipping any minor or patch versions.
```

**File**: `site/themes/contour/assets/scss/_components.scss` (modified, +33/-0)
```diff
@@ -371,6 +371,39 @@
             margin-top: 0px;
             padding-top: 0px;
         }
+        .page-toc {
+            background-color: #EFEFEF;
+            padding: 20px 30px;
+            margin: 20px 0px 30px 0px;
+            h4 {
+                font-size: 16px;
+                margin-top: 0px;
+            }
+            ul {
+                list-style: none;
+                padding-left: 0px;
+                margin-bottom: 0px;
+                li {
+                    list-style-image: none;
+                    display: block;
+                    margin-bottom: 7px;
+                    a {
+                        font-family: $metropolis-light;
+                        font-size: 14px;
+                    }
+                }
+                ul {
+                    margin-top: 7px;
+                    padding-inline-start: 14px;
+                }
+            }
+            summary {
+                cursor: pointer;
+                font-size: 14px;
+                color: $darkgrey;
+                margin-top: 7px;
+            }
+        }
     }
 }
 
```

**File**: `site/themes/contour/layouts/_default/page.html` (modified, +29/-0)
```diff
@@ -7,6 +7,35 @@ <h1>{{ .Title }}</h1>
 		</div>
 		<div class="wrapper subpage blog">
 			<div class="blog-post content">
+				{{ if .Params.toc }}
+					{{ $headings := .Fragments.Headings }}
+					{{/* Pages without an h1 get a placeholder root heading with no ID. */}}
+					{{ range seq 6 }}
+						{{ if and (eq (len $headings) 1) (not (index $headings 0).ID) }}
+							{{ $headings = (index $headings 0).Headings }}
+						{{ end }}
+					{{ end }}
+					{{ with $headings }}
+					<nav class="page-toc" aria-label="On this page">
+						<h4>On this page</h4>
+						<ul>
+							{{ range . }}
+							<li>
+								<a href="#{{ .ID }}">{{ .Title | safeHTML }}</a>
+								{{ with .Headings }}
+								<details>
+									<summary>Show {{ len . }} subsections</summary>
+									<ul>
+										{{ range . }}<li><a href="#{{ .ID }}">{{ .Title | safeHTML }}</a></li>{{ end }}
+									</ul>
+								</details>
+								{{ end }}
+							</li>
+							{{ end }}
+						</ul>
+					</nav>
+					{{ end }}
+				{{ end }}
 				{{ .Content }}
 			</div>
 		</div>
```

---

### Incident Patch 2: `3d9acd4e` (2026-09-21)
**Commit Message**: build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1 (#7738)

Bumps [codecov/codecov-action](https://github.com/codecov/codecov-action) from 7.0.0 to 7.1.1.
- [Release notes](https://github.com/codecov/codecov-action/releases)
- [Changelog](https://github.com/codecov/codecov-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/codecov/codecov-action/compare/fb8b3582c8e4def4969c97caa2f19720cb33a72f...303a32d7a59b442fa8d48b6a1cc6825c09c847a5)

---
updated-dependencies:
- dependency-name: codecov/codecov-action
  dependency-version: 7.1.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/prbuild.yaml` (modified, +1/-1)
```diff
@@ -248,7 +248,7 @@ jobs:
         make check-coverage
     - name: codeCoverage
       if: ${{ success() }}
-      uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v7.0.0
+      uses: codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7.1.1
       with:
         token: ${{ secrets.CODECOV_TOKEN }}
         files: coverage.out
```

---

### Incident Patch 3: `c002120d` (2026-09-21)
**Commit Message**: build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1 (#7737)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.3.0 to 4.4.1.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/37fe631027851001ddb9b187196cc803df7f5f0e...f87e5991a6d7451dcb8d9637bfbc97413f497069)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.4.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/build_main.yaml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
       with:
         persist-credentials: false
     - name: Set up Docker Buildx
-      uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+      uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       with:
         version: latest
     - name: Log in to GHCR
```

**File**: `.github/workflows/build_tag.yaml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
       with:
         persist-credentials: false
     - name: Set up Docker Buildx
-      uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+      uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       with:
         version: latest
     - name: Log in to GHCR
```

**File**: `.github/workflows/prbuild.yaml` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ jobs:
       with:
         persist-credentials: false
     - name: Set up Docker Buildx
-      uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+      uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       with:
         version: latest
     - name: Build image
```

---

### Incident Patch 4: `5169f18d` (2026-09-21)
**Commit Message**: build(deps): bump sigs.k8s.io/controller-runtime from 0.25.0 to 0.25.1 (#7736)

Bumps [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) from 0.25.0 to 0.25.1.
- [Release notes](https://github.com/kubernetes-sigs/controller-runtime/releases)
- [Changelog](https://github.com/kubernetes-sigs/controller-runtime/blob/main/RELEASE.md)
- [Commits](https://github.com/kubernetes-sigs/controller-runtime/compare/v0.25.0...v0.25.1)

---
updated-dependencies:
- dependency-name: sigs.k8s.io/controller-runtime
  dependency-version: 0.25.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ require (
 	k8s.io/client-go v0.37.0
 	k8s.io/klog/v2 v2.140.0
 	k8s.io/utils v0.0.0-20260626114624-be93311217bd
-	sigs.k8s.io/controller-runtime v0.25.0
+	sigs.k8s.io/controller-runtime v0.25.1
 	sigs.k8s.io/gateway-api v1.3.0
 	sigs.k8s.io/kustomize/kyaml v0.21.1
 )
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -324,8 +324,8 @@ k8s.io/utils v0.0.0-20260626114624-be93311217bd h1:Ea7fgQ5we8Y9T0OX5o0dAHzQOBRI0
 k8s.io/utils v0.0.0-20260626114624-be93311217bd/go.mod h1:xDxuJ0whA3d0I4mf/C4ppKHxXynQ+fxnkmQH0vTHnuk=
 rsc.io/pdf v0.1.1 h1:k1MczvYDUvJBe93bYd7wrZLLUEcLZAuF824/I4e5Xr4=
 rsc.io/pdf v0.1.1/go.mod h1:n8OzWcQ6Sp37PL01nO98y4iUCRdTGarVfzxY20ICaU4=
-sigs.k8s.io/controller-runtime v0.25.0 h1:44KgRUPew331KSJpNu8zJow3iTR5W0p/SfrHdw3lV40=
-sigs.k8s.io/controller-runtime v0.25.0/go.mod h1:4QqLdT6z/L6Olj8JJCtvztid4/fnIiYsfaTFScegctc=
+sigs.k8s.io/controller-runtime v0.25.1 h1:BKgU9OeE8xv8EbbM8cY0NVzTQs35rokkdq1jh12fMb4=
+sigs.k8s.io/controller-runtime v0.25.1/go.mod h1:4QqLdT6z/L6Olj8JJCtvztid4/fnIiYsfaTFScegctc=
 sigs.k8s.io/gateway-api v1.3.0 h1:q6okN+/UKDATola4JY7zXzx40WO4VISk7i9DIfOvr9M=
 sigs.k8s.io/gateway-api v1.3.0/go.mod h1:d8NV8nJbaRbEKem+5IuxkL8gJGOZ+FJ+NvOIltV8gDk=
 sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 h1:IpInykpT6ceI+QxKBbEflcR5EXP7sU1kvOlxwZh5txg=
```

---

### Incident Patch 5: `1bd4cad8` (2026-09-21)
**Commit Message**: build(deps): bump github.com/onsi/ginkgo/v2 from 2.32.2 to 2.33.0 (#7735)

Bumps [github.com/onsi/ginkgo/v2](https://github.com/onsi/ginkgo) from 2.32.2 to 2.33.0.
- [Release notes](https://github.com/onsi/ginkgo/releases)
- [Changelog](https://github.com/onsi/ginkgo/blob/master/CHANGELOG.md)
- [Commits](https://github.com/onsi/ginkgo/compare/v2.32.2...v2.33.0)

---
updated-dependencies:
- dependency-name: github.com/onsi/ginkgo/v2
  dependency-version: 2.33.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ require (
 	github.com/google/go-github/v48 v48.2.0
 	github.com/google/uuid v1.6.0
 	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
-	github.com/onsi/ginkgo/v2 v2.32.2
+	github.com/onsi/ginkgo/v2 v2.33.0
 	github.com/onsi/gomega v1.43.0
 	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.24.1
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -166,8 +166,8 @@ github.com/modern-go/reflect2 v1.0.3-0.20250322232337-35a7c28c31ee h1:W5t00kpgFd
 github.com/modern-go/reflect2 v1.0.3-0.20250322232337-35a7c28c31ee/go.mod h1:yWuevngMOJpCy52FWWMvUC8ws7m/LJsjYzDa0/r8luk=
 github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 h1:C3w9PqII01/Oq1c1nUAm88MOHcQC9l5mIlSMApZMrHA=
 github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822/go.mod h1:+n7T8mK8HuQTcFwEeznm/DIxMOiR9yIdICNftLE1DvQ=
-github.com/onsi/ginkgo/v2 v2.32.2 h1:2o6vyFvR6snrJWgRVztC+OwuqqPEMI1UzYl2s2iU7Cg=
-github.com/onsi/ginkgo/v2 v2.32.2/go.mod h1:+aXOY+vzZ5mu2iI2HpTZUPmM//oQfsNFX6gU9kNcA44=
+github.com/onsi/ginkgo/v2 v2.33.0 h1:C8gBA6Uc2ZEubiV+SXiu5tZnMTwEmXHgkJwGozKtZf8=
+github.com/onsi/ginkgo/v2 v2.33.0/go.mod h1:+aXOY+vzZ5mu2iI2HpTZUPmM//oQfsNFX6gU9kNcA44=
 github.com/onsi/gomega v1.43.0 h1:VlG/1FxqNxhSO+lq/OHBNaaqwiBK/mO8JbVkX9Y+FeU=
 github.com/onsi/gomega v1.43.0/go.mod h1:REff/hsDsodHoKlWsP2mAPhu1+5/6hVYNf9rIEBpeSg=
 github.com/opencontainers/go-digest v1.0.0 h1:apOUWs51W5PlhuyGyz9FCeeBIOUDA/6nW8Oi/yOhh5U=
```

---

### Incident Patch 6: `e22bbfdf` (2026-09-21)
**Commit Message**: build(deps): bump golang.org/x/oauth2 from 0.36.0 to 0.37.0 (#7734)

Bumps [golang.org/x/oauth2](https://github.com/golang/oauth2) from 0.36.0 to 0.37.0.
- [Commits](https://github.com/golang/oauth2/compare/v0.36.0...v0.37.0)

---
updated-dependencies:
- dependency-name: golang.org/x/oauth2
  dependency-version: 0.37.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ require (
 	github.com/tsaarni/certyaml v0.13.0
 	go.uber.org/automaxprocs v1.6.0
 	golang.org/x/net v0.59.0
-	golang.org/x/oauth2 v0.36.0
+	golang.org/x/oauth2 v0.37.0
 	gonum.org/v1/plot v0.17.0
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800
 	google.golang.org/grpc v1.84.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -252,8 +252,8 @@ golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLL
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.59.0 h1:5zfYln+w5XCxwrnMMJPufRgNoXEaGxl0wo5GqPXyues=
 golang.org/x/net v0.59.0/go.mod h1:2DA/G1UfVbCpQPeWTmMPGY7Cs2PkBkwu743bVX5PIVg=
-golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
-golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
+golang.org/x/oauth2 v0.37.0 h1:JUlcxA8oAtauLfiH8FX2/FkAWHAdi0QtGCGc+hofE98=
+golang.org/x/oauth2 v0.37.0/go.mod h1:IxwZNxUULJmpBFf9K/9NTMSIfZZuvuTy1gGxhigP/58=
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
```

---

### Incident Patch 7: `c2ef8245` (2026-09-21)
**Commit Message**: build(deps): bump google.golang.org/grpc from 1.83.2 to 1.84.0 (#7733)

Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.83.2 to 1.84.0.
- [Release notes](https://github.com/grpc/grpc-go/releases)
- [Commits](https://github.com/grpc/grpc-go/compare/v1.83.2...v1.84.0)

---
updated-dependencies:
- dependency-name: google.golang.org/grpc
  dependency-version: 1.84.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -29,8 +29,8 @@ require (
 	golang.org/x/net v0.59.0
 	golang.org/x/oauth2 v0.36.0
 	gonum.org/v1/plot v0.17.0
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa
-	google.golang.org/grpc v1.83.2
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800
+	google.golang.org/grpc v1.84.0
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v3 v3.0.1
 	k8s.io/api v0.37.0
@@ -110,7 +110,7 @@ require (
 	golang.org/x/time v0.15.0 // indirect
 	golang.org/x/tools v0.49.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260706201446-f0a921348800 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/kube-openapi v0.0.0-20260721132016-d427ff9ee9ad // indirect
```

**File**: `go.sum` (modified, +6/-20)
```diff
@@ -73,8 +73,6 @@ github.com/go-errors/errors v1.4.2 h1:J6MZopCL4uSllY1OfXM374weqZFFItUbrImctkmUxI
 github.com/go-errors/errors v1.4.2/go.mod h1:sIVyrIiJhuEF+Pj9Ebtd6P/rEYROXFi3BopGUQ5a5Og=
 github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
 github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
-github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
-github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
 github.com/go-logr/zapr v1.3.0 h1:XGdV8XW8zdwFiwOA2Dryh1gj2KRQyOOoNmBy4EplIcQ=
 github.com/go-logr/zapr v1.3.0/go.mod h1:YKepepNBd1u/oyhd/yQmtjVXmm9uML4IXUgMOwR8/Gg=
 github.com/go-openapi/jsonpointer v1.0.0 h1:kR9tHqY0CtZaOPVFm622dPVNhrvYpwr4uCxgL3h1H8s=
@@ -227,18 +225,6 @@ github.com/x448/float16 v0.8.4/go.mod h1:14CWIYCyZA/cWjXOioeEpHeN/83MdbZDRQHoFcY
 github.com/xhit/go-str2duration/v2 v2.1.0 h1:lxklc02Drh6ynqX+DdPyp5pCKLUQpRT8bp8Ydu2Bstc=
 github.com/xhit/go-str2duration/v2 v2.1.0/go.mod h1:ohY8p+0f07DiV6Em5LKB0s2YpLtXVyJfNt1+BlmyAsU=
 github.com/yuin/goldmark v1.2.1/go.mod h1:3hX8gzYuyVAZsxl0MRgGTJEmQBFcNTphYh9decYSb74=
-go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ64=
-go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.uber.org/automaxprocs v1.6.0 h1:O3y2/QNTOdbF+e/dpXNNW7Rx2hZ4sTIPyybbxyNqTUs=
 go.uber.org/automaxprocs v1.6.0/go.mod h1:ifeIMSnPZuznNm6jmdzmU3/bfk01Fe2fotchwEFJ8r8=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -301,12 +287,12 @@ gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
 gonum.org/v1/gonum v0.17.0/go.mod h1:El3tOrEuMpv2UdMrbNlKEh9vd86bmQ6vqIcDwxEOc1E=
 gonum.org/v1/plot v0.17.0 h1:d0DwPVBe9jnEGqQBoZGl/P2M9WciJbG2CnV59C9QBT4=
 gonum.org/v1/plot v0.17.0/go.mod h1:ipt2GUN1oqzr2O7wCjLDtw1ShfIYYNBp4o0O1Ez5B3Y=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
-google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260706201446-f0a921348800 h1:admdQBe8jR3VWhBsUrAOaF2Qw6K/+p5pSm1GN8+6Fw4=
+google.golang.org/genproto/googleapis/api v0.0.0-20260706201446-f0a921348800/go.mod h1:FPk7EXUKMtImne7AmknoYjT4QXqKIzzRbeQIXzLk6fQ=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800 h1:qEHAMpSaUhtD0p3NbEEI83HwNGFxEwaSJ1G9PLnCBZE=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/grpc v1.84.0 h1:soMyaPJ8pAak5PIQ0DGBUir0XRo2fRoMqhNWMLlLxO0=
+google.golang.org/grpc v1.84.0/go.mod h1:ljCht0DrxQrXBDRTZp52Qxh3Ffk8CdYm2sj4O2QN2C0=
 google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
 google.golang.org/protobuf v1.36.12/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

---

### Incident Patch 8: `38d535f6` (2026-09-16)
**Commit Message**: build(deps): bump sigs.k8s.io/controller-runtime from 0.24.0 to 0.25.0 (#7730)

* build(deps): bump sigs.k8s.io/controller-runtime from 0.24.0 to 0.25.0

Bumps [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime) from 0.24.0 to 0.25.0.
- [Release notes](https://github.com/kubernetes-sigs/controller-runtime/releases)
- [Changelog](https://github.com/kubernetes-sigs/controller-runtime/blob/main/RELEASE.md)
- [Commits](https://github.com/kubernetes-sigs/controller-runtime/compare/v0.24.0...v0.25.0)

---
updated-dependencies:
- dependency-name: sigs.k8s.io/controller-runtime
  dependency-version: 0.25.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* make generate

Signed-off-by: Tero Saarni <[REDACTED_EMAIL]>

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Signed-off-by: Tero Saarni <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Tero Saarni <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ require (
 	k8s.io/client-go v0.37.0
 	k8s.io/klog/v2 v2.140.0
 	k8s.io/utils v0.0.0-20260626114624-be93311217bd
-	sigs.k8s.io/controller-runtime v0.24.0
+	sigs.k8s.io/controller-runtime v0.25.0
 	sigs.k8s.io/gateway-api v1.3.0
 	sigs.k8s.io/kustomize/kyaml v0.21.1
 )
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -338,8 +338,8 @@ k8s.io/utils v0.0.0-20260626114624-be93311217bd h1:Ea7fgQ5we8Y9T0OX5o0dAHzQOBRI0
 k8s.io/utils v0.0.0-20260626114624-be93311217bd/go.mod h1:xDxuJ0whA3d0I4mf/C4ppKHxXynQ+fxnkmQH0vTHnuk=
 rsc.io/pdf v0.1.1 h1:k1MczvYDUvJBe93bYd7wrZLLUEcLZAuF824/I4e5Xr4=
 rsc.io/pdf v0.1.1/go.mod h1:n8OzWcQ6Sp37PL01nO98y4iUCRdTGarVfzxY20ICaU4=
-sigs.k8s.io/controller-runtime v0.24.0 h1:Ck6N2LdS8Lovy1o25BB4r1xjvLEKUl1s2o9kU+KWDE4=
-sigs.k8s.io/controller-runtime v0.24.0/go.mod h1:vFkfY5fGt5xAC/sKb8IBFKgWPNKG9OUG29dR8Y2wImw=
+sigs.k8s.io/controller-runtime v0.25.0 h1:44KgRUPew331KSJpNu8zJow3iTR5W0p/SfrHdw3lV40=
+sigs.k8s.io/controller-runtime v0.25.0/go.mod h1:4QqLdT6z/L6Olj8JJCtvztid4/fnIiYsfaTFScegctc=
 sigs.k8s.io/gateway-api v1.3.0 h1:q6okN+/UKDATola4JY7zXzx40WO4VISk7i9DIfOvr9M=
 sigs.k8s.io/gateway-api v1.3.0/go.mod h1:d8NV8nJbaRbEKem+5IuxkL8gJGOZ+FJ+NvOIltV8gDk=
 sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 h1:IpInykpT6ceI+QxKBbEflcR5EXP7sU1kvOlxwZh5txg=
```

**File**: `internal/k8s/mocks/cache.go` (modified, +17/-17)
```diff
@@ -3,7 +3,7 @@
 package mocks
 
 import (
-	cache "sigs.k8s.io/controller-runtime/pkg/cache"
+	cacheapi "sigs.k8s.io/controller-runtime/pkg/cache/cacheapi"
 	client "sigs.k8s.io/controller-runtime/pkg/client"
 
 	context "context"
@@ -44,7 +44,7 @@ func (_m *Cache) Get(ctx context.Context, key client.ObjectKey, obj client.Objec
 }
 
 // GetInformer provides a mock function with given fields: ctx, obj, opts
-func (_m *Cache) GetInformer(ctx context.Context, obj client.Object, opts ...cache.InformerGetOption) (cache.Informer, error) {
+func (_m *Cache) GetInformer(ctx context.Context, obj cacheapi.Object, opts ...cacheapi.InformerGetOption) (cacheapi.Informer, error) {
 	_va := make([]interface{}, len(opts))
 	for _i := range opts {
 		_va[_i] = opts[_i]
@@ -58,20 +58,20 @@ func (_m *Cache) GetInformer(ctx context.Context, obj client.Object, opts ...cac
 		panic("no return value specified for GetInformer")
 	}
 
-	var r0 cache.Informer
+	var r0 cacheapi.Informer
 	var r1 error
-	if rf, ok := ret.Get(0).(func(context.Context, client.Object, ...cache.InformerGetOption) (cache.Informer, error)); ok {
+	if rf, ok := ret.Get(0).(func(context.Context, cacheapi.Object, ...cacheapi.InformerGetOption) (cacheapi.Informer, error)); ok {
 		return rf(ctx, obj, opts...)
 	}
-	if rf, ok := ret.Get(0).(func(context.Context, client.Object, ...cache.InformerGetOption) cache.Informer); ok {
+	if rf, ok := ret.Get(0).(func(context.Context, cacheapi.Object, ...cacheapi.InformerGetOption) cacheapi.Informer); ok {
 		r0 = rf(ctx, obj, opts...)
 	} else {
 		if ret.Get(0) != nil {
-			r0 = ret.Get(0).(cache.Informer)
+			r0 = ret.Get(0).(cacheapi.Informer)
 		}
 	}
 
-	if rf, ok := ret.Get(1).(func(context.Context, client.Object, ...cache.InformerGetOption) error); ok {
+	if rf, ok := ret.Get(1).(func(context.Context, cacheapi.Object, ...cacheapi.InformerGetOption) error); ok {
 		r1 = rf(ctx, obj, opts...)
 	} else {
 		r1 = ret.Error(1)
@@ -81,7 +81,7 @@ func (_m *Cache) GetInformer(ctx context.Context, obj client.Object, opts ...cac
 }
 
 // GetInformerForKind provides a mock function with given fields: ctx, gvk, opts
-func (_m *Cache) GetInformerForKind(ctx context.Context, gvk schema.GroupVersionKind, opts ...cache.InformerGetOption) (cache.Informer, error) {
+func (_m *Cache) GetInformerForKind(ctx context.Context, gvk schema.GroupVersionKind, opts ...cacheapi.InformerGetOption) (cacheapi.Informer, error) {
 	_va := make([]interface{}, len(opts))
 	for _i := range opts {
 		_va[_i] = opts[_i]
@@ -95,20 +95,20 @@ func (_m *Cache) GetInformerForKind(ctx context.Context, gvk schema.GroupVersion
 		panic("no return value specified for GetInformerForKind")
 	}
 
-	var r0 cache.Informer
+	var r0 cacheapi.Informer
 	var r1 error
-	if rf, ok := ret.Get(0).(func(context.Context, schema.GroupVersionKind, ...cache.InformerGetOption) (cache.Informer, error)); ok {
+	if rf, ok := ret.Get(0).(func(context.Context, schema.GroupVersionKind, ...cacheapi.InformerGetOption) (cacheapi.Informer, error)); ok {
 		return rf(ctx, gvk, opts...)
 	}
-	if rf, ok := ret.Get(0).(func(context.Context, schema.GroupVersionKind, ...cache.InformerGetOption) cache.Informer); ok {
+	if rf, ok := ret.Get(0).(func(context.Context, schema.GroupVersionKind, ...cacheapi.InformerGetOption) cacheapi.Informer); ok {
 		r0 = rf(ctx, gvk, opts...)
 	} else {
 		if ret.Get(0) != nil {
-			r0 = ret.Get(0).(cache.Informer)
+			r0 = ret.Get(0).(cacheapi.Informer)
 		}
 	}
 
-	if rf, ok := ret.Get(1).(func(context.Context, schema.GroupVersionKind, ...cache.InformerGetOption) error); ok {
+	if rf, ok := ret.Get(1).(func(context.Context, schema.GroupVersionKind, ...cacheapi.InformerGetOption) error); ok {
 		r1 = rf(ctx, gvk, opts...)
 	} else {
 		r1 = ret.Error(1)
@@ -118,15 +118,15 @@ func (_m *Cache) GetInformerForKind(ctx context.Context, gvk schema.GroupVersion
 }
 
 // IndexField provides a mock function with given fields: ctx, obj, field, extractValue
-func (_m *Cache) IndexField(ctx context.Context, obj client.Object, field string, extractValue client.IndexerFunc) error {
+func (_m *Cache) IndexField(ctx context.Context, obj cacheapi.Object, field string, extractValue cacheapi.IndexerFunc) error {
 	ret := _m.Called(ctx, obj, field, extractValue)
 
 	if len(ret) == 0 {
 		panic("no return value specified for IndexField")
 	}
 
 	var r0 error
-	if rf, ok := ret.Get(0).(func(context.Context, client.Object, string, client.IndexerFunc) error); ok {
+	if rf, ok := ret.Get(0).(func(context.Context, cacheapi.Object, string, cacheapi.IndexerFunc) error); ok {
 		r0 = rf(ctx, obj, field, extractValue)
 	} else {
 		r0 = ret.Error(0)
@@ -161,15 +161,15 @@ func (_m *Cache) List(ctx context.Context, list client.ObjectList, opts ...clien
 }
 
 // RemoveInformer provides a mock function with given fields: ctx, obj
-func (_m *Cache) RemoveInformer(ctx context.Context, obj client.Object) error {
+func (_m *Cache) RemoveInformer(ctx context.Context, obj cacheapi.Object) error {
 	ret 
```

---

### Incident Patch 9: `69bead06` (2026-09-16)
**Commit Message**: build(deps): bump github.com/onsi/gomega from 1.42.1 to 1.43.0 (#7728)

Bumps [github.com/onsi/gomega](https://github.com/onsi/gomega) from 1.42.1 to 1.43.0.
- [Release notes](https://github.com/onsi/gomega/releases)
- [Changelog](https://github.com/onsi/gomega/blob/master/CHANGELOG.md)
- [Commits](https://github.com/onsi/gomega/compare/v1.42.1...v1.43.0)

---
updated-dependencies:
- dependency-name: github.com/onsi/gomega
  dependency-version: 1.43.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
 	github.com/onsi/ginkgo/v2 v2.32.2
-	github.com/onsi/gomega v1.42.1
+	github.com/onsi/gomega v1.43.0
 	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.24.1
 	github.com/prometheus/client_model v0.6.3
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -170,8 +170,8 @@ github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 h1:C3w9PqII01/Oq
 github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822/go.mod h1:+n7T8mK8HuQTcFwEeznm/DIxMOiR9yIdICNftLE1DvQ=
 github.com/onsi/ginkgo/v2 v2.32.2 h1:2o6vyFvR6snrJWgRVztC+OwuqqPEMI1UzYl2s2iU7Cg=
 github.com/onsi/ginkgo/v2 v2.32.2/go.mod h1:+aXOY+vzZ5mu2iI2HpTZUPmM//oQfsNFX6gU9kNcA44=
-github.com/onsi/gomega v1.42.1 h1:iN1rCUX+44NZ1Dc97MPoeFYbFR0vh8zxoxMFwKdyZ6I=
-github.com/onsi/gomega v1.42.1/go.mod h1:REff/hsDsodHoKlWsP2mAPhu1+5/6hVYNf9rIEBpeSg=
+github.com/onsi/gomega v1.43.0 h1:VlG/1FxqNxhSO+lq/OHBNaaqwiBK/mO8JbVkX9Y+FeU=
+github.com/onsi/gomega v1.43.0/go.mod h1:REff/hsDsodHoKlWsP2mAPhu1+5/6hVYNf9rIEBpeSg=
 github.com/opencontainers/go-digest v1.0.0 h1:apOUWs51W5PlhuyGyz9FCeeBIOUDA/6nW8Oi/yOhh5U=
 github.com/opencontainers/go-digest v1.0.0/go.mod h1:0JzlMkj0TRzQZfJkVvzbP0HBR3IKzErnv2BNG4W4MAM=
 github.com/pkg/errors v0.9.1 h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt4=
```

---

### Incident Patch 10: `df4b533e` (2026-09-14)
**Commit Message**: build(deps): bump the codeql-action group with 4 updates (#7731)

Bumps the codeql-action group with 4 updates: [github/codeql-action/init](https://github.com/github/codeql-action), [github/codeql-action/autobuild](https://github.com/github/codeql-action), [github/codeql-action/analyze](https://github.com/github/codeql-action) and [github/codeql-action/upload-sarif](https://github.com/github/codeql-action).


Updates `github/codeql-action/init` from 4.37.9 to 4.38.0
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/cdf488f595d80d6e07e03d4674febd5ab45fa938...b96794f015dfd88f77b49b1c93e0fa7110f94c63)

Updates `github/codeql-action/autobuild` from 4.37.9 to 4.38.0
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/cdf488f595d80d6e07e03d4674febd5ab45fa938...b96794f015dfd88f77b49b1c93e0fa7110f94c63)

Updates `github/codeql-action/analyze` from 4.37.9 to 4.38.0
- [Release notes](htt

**File**: `.github/workflows/codeql-analysis.yml` (modified, +5/-5)
```diff
@@ -45,14 +45,14 @@ jobs:
         cache: false
     # Initializes the CodeQL tools for scanning.
     - name: Initialize CodeQL
-      uses: github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+      uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
       with:
         languages: go
     # Autobuild attempts to build any compiled languages  (C/C++, C#, or Java).
     - name: Autobuild
-      uses: github/codeql-action/autobuild@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+      uses: github/codeql-action/autobuild@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
     - name: Perform CodeQL Analysis
-      uses: github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+      uses: github/codeql-action/analyze@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
       with:
         category: /language:go
 
@@ -65,10 +65,10 @@ jobs:
       with:
         persist-credentials: false
     - name: Initialize CodeQL
-      uses: github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+      uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
       with:
         languages: actions
     - name: Perform CodeQL Analysis
-      uses: github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+      uses: github/codeql-action/analyze@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
       with:
         category: /language:actions
```

**File**: `.github/workflows/openssf-scorecard.yaml` (modified, +1/-1)
```diff
@@ -37,6 +37,6 @@ jobs:
         name: SARIF file
         path: results.sarif
     - name: "Upload to code-scanning"
-      uses: github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+      uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
       with:
         sarif_file: results.sarif
```

**File**: `.github/workflows/trivy-scan.yaml` (modified, +1/-1)
```diff
@@ -33,6 +33,6 @@ jobs:
           output: 'trivy-results.sarif'
           ignore-unfixed: true
           severity: 'HIGH,CRITICAL'
-      - uses: github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+      - uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
         with:
           sarif_file: 'trivy-results.sarif'
```

---

### Incident Patch 11: `876bce45` (2026-09-14)
**Commit Message**: build(deps): bump golang.org/x/net from 0.58.0 to 0.59.0 (#7729)

Bumps [golang.org/x/net](https://github.com/golang/net) from 0.58.0 to 0.59.0.
- [Commits](https://github.com/golang/net/compare/v0.58.0...v0.59.0)

---
updated-dependencies:
- dependency-name: golang.org/x/net
  dependency-version: 0.59.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +8/-8)
```diff
@@ -26,7 +26,7 @@ require (
 	github.com/stretchr/testify v1.12.1
 	github.com/tsaarni/certyaml v0.13.0
 	go.uber.org/automaxprocs v1.6.0
-	golang.org/x/net v0.58.0
+	golang.org/x/net v0.59.0
 	golang.org/x/oauth2 v0.36.0
 	gonum.org/v1/plot v0.17.0
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa
@@ -100,15 +100,15 @@ require (
 	github.com/xhit/go-str2duration/v2 v2.1.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.57.0 // indirect
 	golang.org/x/image v0.41.0 // indirect
-	golang.org/x/mod v0.38.0 // indirect
-	golang.org/x/sync v0.22.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/mod v0.41.0 // indirect
+	golang.org/x/sync v0.23.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/term v0.46.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.48.0 // indirect
+	golang.org/x/tools v0.49.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -254,43 +254,43 @@ go.yaml.in/yaml/v3 v3.0.5/go.mod h1:HVTZu1O7/Vkt2N+BFy8Zza+lnLsABggaTM2ZpNIGuKg=
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8UmvKecakEJjdnWj3jj499lnFckfCI=
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.57.0 h1:3ZVCjf8Ggz7zneR/EHRVx68Ctf+2pmIMP2UFhh9cC6M=
+golang.org/x/crypto v0.57.0/go.mod h1:Fdz0i5U6CoizGwLda9DttjSk6qlZo25zYNtR+ycvuZA=
 golang.org/x/image v0.41.0 h1:8wS72eGJMJaBxK6okTzd4WaXumUlTVlb753MlsSvTCo=
 golang.org/x/image v0.41.0/go.mod h1:uIc348UZMSvS5Z65CVZ7iDPaNobNFEPeJ4kbqTOszmA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
-golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
+golang.org/x/mod v0.41.0 h1:qJmnOUb4YB+FsEuM3HcWucdZASCPGhsX6uljO6pog0c=
+golang.org/x/mod v0.41.0/go.mod h1:Ek9pY8RKWXwsWvd3rQiHYtMqkjSUV+s1Rj7j4H5Ur6o=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
-golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
-golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
+golang.org/x/net v0.59.0 h1:5zfYln+w5XCxwrnMMJPufRgNoXEaGxl0wo5GqPXyues=
+golang.org/x/net v0.59.0/go.mod h1:2DA/G1UfVbCpQPeWTmMPGY7Cs2PkBkwu743bVX5PIVg=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190412213103-97732733099d/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20200930185726-fdedc70b468f/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210119212857-b64e53b001e4/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
-golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
-golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.45.0 h1:NwWyBmoJCbfTHpxrWoZ9C6/VxOf7ic219I8xZZFdrf0=
-golang.org/x/term v0.45.0/go.mod h1:9aqxs0blBcrm/n0L9QW0aRVD+ktan8ssZromtqJC43w=
+golang.org/x/sys v0.48.0 h1:bbX/i/6MgT9BVLM9RT1thmxL04yeTAhbEz4SyadbXoo=
+golang.org/x/sys v0.48.0/go.mod h1:hNLxWAXmnKAxqDtdwIYC4bM9oQPEecfsnNMuSxOs3og=
+golang.org/x/term v0.46.0 h1:3+OXuTbaKDgwk8jTi3aSLHRlmWqHEUDUtxnbFigO4YE=
+golang.org/x/term v0.46.0/go.mod h1:+K02xbkittuwc0Am4abfA3Fc+XRGXkvBXNO88NCXPoc=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
-golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
+golang.org/x/text v0.42.0 h1:JbOZXgfeCPU9gacVtYliJqOhD+zhrEqK4LfdpmlUZqI=
+golang.org/x/text v0.42.0/go.mod h1:ojzP1Z+2QtioaF8DTtO8K5q7JWVVYwZKenzujK0Zd0E=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
 golang.org/x/tools v0.0.0-20191119224855-298f0cb1881e/go.mod h1:b+2E5dAYhXwXZwtnZ6UAqBI28+e2cm9otk0dWdXHAEo=
 golang.org/x/tools v0.1.0/go.mod h1:xkSsbof2nBLbhDlRMhhhyNLN/zl3eTqcnHD5viDpcZ0=
-golang.org/x/tools v0.48.0 h1:3+hClM1aLL5mjMKm5ovokw9epgRXPuu2tILgismM6RE=
-golang.org/x/tools v0.48.0/go.mod h1:08xX0orndb/F7jJxGDicx061tyd5pcMto75YMAXr6lk=
+golang.org/x/tools v0.49.0 h1:3NI7VXzL9+1WZD52Dx2ttoPwD5DWrFGpl9mFZDlmisI=
+golang.org/x/tools v0.49.0/go.mod h1:SJNXV9DBKT0UbdttsQjbfJlAE/q+y36++zo3uL3N0Oo=
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/
```

---

### Incident Patch 12: `ef7cef2a` (2026-09-14)
**Commit Message**: build(deps): bump github.com/onsi/ginkgo/v2 from 2.32.1 to 2.32.2 (#7727)

Bumps [github.com/onsi/ginkgo/v2](https://github.com/onsi/ginkgo) from 2.32.1 to 2.32.2.
- [Release notes](https://github.com/onsi/ginkgo/releases)
- [Changelog](https://github.com/onsi/ginkgo/blob/master/CHANGELOG.md)
- [Commits](https://github.com/onsi/ginkgo/compare/v2.32.1...v2.32.2)

---
updated-dependencies:
- dependency-name: github.com/onsi/ginkgo/v2
  dependency-version: 2.32.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ require (
 	github.com/google/go-github/v48 v48.2.0
 	github.com/google/uuid v1.6.0
 	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
-	github.com/onsi/ginkgo/v2 v2.32.1
+	github.com/onsi/ginkgo/v2 v2.32.2
 	github.com/onsi/gomega v1.42.1
 	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.24.1
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -168,8 +168,8 @@ github.com/modern-go/reflect2 v1.0.3-0.20250322232337-35a7c28c31ee h1:W5t00kpgFd
 github.com/modern-go/reflect2 v1.0.3-0.20250322232337-35a7c28c31ee/go.mod h1:yWuevngMOJpCy52FWWMvUC8ws7m/LJsjYzDa0/r8luk=
 github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 h1:C3w9PqII01/Oq1c1nUAm88MOHcQC9l5mIlSMApZMrHA=
 github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822/go.mod h1:+n7T8mK8HuQTcFwEeznm/DIxMOiR9yIdICNftLE1DvQ=
-github.com/onsi/ginkgo/v2 v2.32.1 h1:6tlvcDm/3sE8lGJbZ4+d4mO3RLy24/tQWOFzVSQNIfw=
-github.com/onsi/ginkgo/v2 v2.32.1/go.mod h1:+aXOY+vzZ5mu2iI2HpTZUPmM//oQfsNFX6gU9kNcA44=
+github.com/onsi/ginkgo/v2 v2.32.2 h1:2o6vyFvR6snrJWgRVztC+OwuqqPEMI1UzYl2s2iU7Cg=
+github.com/onsi/ginkgo/v2 v2.32.2/go.mod h1:+aXOY+vzZ5mu2iI2HpTZUPmM//oQfsNFX6gU9kNcA44=
 github.com/onsi/gomega v1.42.1 h1:iN1rCUX+44NZ1Dc97MPoeFYbFR0vh8zxoxMFwKdyZ6I=
 github.com/onsi/gomega v1.42.1/go.mod h1:REff/hsDsodHoKlWsP2mAPhu1+5/6hVYNf9rIEBpeSg=
 github.com/opencontainers/go-digest v1.0.0 h1:apOUWs51W5PlhuyGyz9FCeeBIOUDA/6nW8Oi/yOhh5U=
```

---

### Incident Patch 13: `9f90a7ea` (2026-09-07)
**Commit Message**: build(deps): bump github.com/prometheus/common from 0.70.1 to 0.71.0 (#7720)

Bumps [github.com/prometheus/common](https://github.com/prometheus/common) from 0.70.1 to 0.71.0.
- [Release notes](https://github.com/prometheus/common/releases)
- [Changelog](https://github.com/prometheus/common/blob/main/CHANGELOG.md)
- [Commits](https://github.com/prometheus/common/compare/v0.70.1...v0.71.0)

---
updated-dependencies:
- dependency-name: github.com/prometheus/common
  dependency-version: 0.71.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ require (
 	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.24.1
 	github.com/prometheus/client_model v0.6.3
-	github.com/prometheus/common v0.70.1
+	github.com/prometheus/common v0.71.0
 	github.com/sirupsen/logrus v1.10.2
 	github.com/stretchr/testify v1.12.1
 	github.com/tsaarni/certyaml v0.13.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -187,8 +187,8 @@ github.com/prometheus/client_golang v1.24.1 h1:JnJkREXzWxUdCuPFpIWZiPispT9xVV59u
 github.com/prometheus/client_golang v1.24.1/go.mod h1:F+oSRECHg4sse5ucfYpYDeIv/hu68Zo0uoHKetWnzcE=
 github.com/prometheus/client_model v0.6.3 h1:O0jaTVAYNxTHYInEPFJt5I3+sN8zqBtVMPTB1qyxiEo=
 github.com/prometheus/client_model v0.6.3/go.mod h1:gpN5P9S7Rr6Yr92PiQ+Ixvhf6JZEkF1dnxsYL2aPBEM=
-github.com/prometheus/common v0.70.1 h1:1HvjP4D5oL3t8RsPlwxA9onvvStjtIHYE5XuuwOi/PY=
-github.com/prometheus/common v0.70.1/go.mod h1:VdFUQDMZK3VLkurFUVhia6uys/0suUp86TJz5qbJRhc=
+github.com/prometheus/common v0.71.0 h1:9KDAKb7Mj3HEVKyFCK6Dc/HIwlBzZIN2l7/lrHl3KK8=
+github.com/prometheus/common v0.71.0/go.mod h1:CLJ5H8TEsGX8bl31BdMkfhIZ+QmZ9tBPPotUxUbfcmk=
 github.com/prometheus/procfs v0.21.1 h1:GljZCt+zSTS+NZq88cyQ1LjZ+RCHp3uVuabBWA5+OJI=
 github.com/prometheus/procfs v0.21.1/go.mod h1:aB55Cww9pdSJVHk0hUf0inxWyyjPogFIjmHKYgMKmtY=
 github.com/rogpeppe/go-internal v1.14.1 h1:UQB4HGPB6osV0SQTLymcB4TgvyWu6ZyliaW0tI/otEQ=
```

---

### Incident Patch 14: `885feeda` (2026-09-07)
**Commit Message**: build(deps): bump github.com/tsaarni/certyaml from 0.12.0 to 0.13.0 (#7718)

Bumps [github.com/tsaarni/certyaml](https://github.com/tsaarni/certyaml) from 0.12.0 to 0.13.0.
- [Release notes](https://github.com/tsaarni/certyaml/releases)
- [Commits](https://github.com/tsaarni/certyaml/compare/v0.12.0...v0.13.0)

---
updated-dependencies:
- dependency-name: github.com/tsaarni/certyaml
  dependency-version: 0.13.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 module github.com/projectcontour/contour
 
-go 1.26.0
+go 1.27
 
 require (
 	dario.cat/mergo v1.0.2
@@ -24,7 +24,7 @@ require (
 	github.com/prometheus/common v0.70.1
 	github.com/sirupsen/logrus v1.10.2
 	github.com/stretchr/testify v1.12.1
-	github.com/tsaarni/certyaml v0.12.0
+	github.com/tsaarni/certyaml v0.13.0
 	go.uber.org/automaxprocs v1.6.0
 	golang.org/x/net v0.58.0
 	golang.org/x/oauth2 v0.36.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -218,8 +218,8 @@ github.com/tidwall/pretty v1.2.1 h1:qjsOFOWWQl+N3RsoF5/ssm1pHmJJwhjlSbZ51I6wMl4=
 github.com/tidwall/pretty v1.2.1/go.mod h1:ITEVvHYasfjBbM0u2Pg8T2nJnzm8xPwvNhhsoaGGjNU=
 github.com/tidwall/sjson v1.2.5 h1:kLy8mja+1c9jlljvWTlSazM7cKDRfJuR/bOJhcY5NcY=
 github.com/tidwall/sjson v1.2.5/go.mod h1:Fvgq9kS/6ociJEDnK0Fk1cpYF4FIW6ZF7LAe+6jwd28=
-github.com/tsaarni/certyaml v0.12.0 h1:ADrQFfSTsr4VjPaCOabbEb3kyJG9FE/CivDtKcJi5GE=
-github.com/tsaarni/certyaml v0.12.0/go.mod h1:QhRQoqRztFOqh3FNkhUaM9ZMwH0OYDBfwjCbiCUkJZc=
+github.com/tsaarni/certyaml v0.13.0 h1:QZAW7S4nRQUn2k4E6jZyErn7kzE1Nk5v3LnoiS0F+Fo=
+github.com/tsaarni/certyaml v0.13.0/go.mod h1:UZgnD4kY4DWzeRjbtVeb77dGlV2DX4R2eV5TZIIJruU=
 github.com/tsaarni/x500dn v1.1.0 h1:+rgqGj7LQEkdIIRLsYJm5S6M2dDBscb6/xiEcGW678s=
 github.com/tsaarni/x500dn v1.1.0/go.mod h1:vzfi5pu5wr1eeFf9/0rIr5Bc1kxeyes4jFMCcp0wfCk=
 github.com/x448/float16 v0.8.4 h1:qLwI1I70+NjRFUR3zs1JPUCgaCXSh3SW62uAKT1mSBM=
```

---

### Incident Patch 15: `45fa97d5` (2026-09-07)
**Commit Message**: build(deps): bump github.com/prometheus/client_model from 0.6.2 to 0.6.3 (#7716)

Bumps [github.com/prometheus/client_model](https://github.com/prometheus/client_model) from 0.6.2 to 0.6.3.
- [Release notes](https://github.com/prometheus/client_model/releases)
- [Commits](https://github.com/prometheus/client_model/compare/v0.6.2...v0.6.3)

---
updated-dependencies:
- dependency-name: github.com/prometheus/client_model
  dependency-version: 0.6.3
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ require (
 	github.com/onsi/gomega v1.42.1
 	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.24.1
-	github.com/prometheus/client_model v0.6.2
+	github.com/prometheus/client_model v0.6.3
 	github.com/prometheus/common v0.70.1
 	github.com/sirupsen/logrus v1.10.2
 	github.com/stretchr/testify v1.12.1
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -185,8 +185,8 @@ github.com/prashantv/gostub v1.1.0 h1:BTyx3RfQjRHnUWaGF9oQos79AlQ5k8WNktv7VGvVH4
 github.com/prashantv/gostub v1.1.0/go.mod h1:A5zLQHz7ieHGG7is6LLXLz7I8+3LZzsrV0P1IAHhP5U=
 github.com/prometheus/client_golang v1.24.1 h1:JnJkREXzWxUdCuPFpIWZiPispT9xVV59uiuyR2bPlnU=
 github.com/prometheus/client_golang v1.24.1/go.mod h1:F+oSRECHg4sse5ucfYpYDeIv/hu68Zo0uoHKetWnzcE=
-github.com/prometheus/client_model v0.6.2 h1:oBsgwpGs7iVziMvrGhE53c/GrLUsZdHnqNwqPLxwZyk=
-github.com/prometheus/client_model v0.6.2/go.mod h1:y3m2F6Gdpfy6Ut/GBsUqTWZqCUvMVzSfMLjcu6wAwpE=
+github.com/prometheus/client_model v0.6.3 h1:O0jaTVAYNxTHYInEPFJt5I3+sN8zqBtVMPTB1qyxiEo=
+github.com/prometheus/client_model v0.6.3/go.mod h1:gpN5P9S7Rr6Yr92PiQ+Ixvhf6JZEkF1dnxsYL2aPBEM=
 github.com/prometheus/common v0.70.1 h1:1HvjP4D5oL3t8RsPlwxA9onvvStjtIHYE5XuuwOi/PY=
 github.com/prometheus/common v0.70.1/go.mod h1:VdFUQDMZK3VLkurFUVhia6uys/0suUp86TJz5qbJRhc=
 github.com/prometheus/procfs v0.21.1 h1:GljZCt+zSTS+NZq88cyQ1LjZ+RCHp3uVuabBWA5+OJI=
```

#### Recent Merged Pull Requests:
- **PR #7740** (2026-10-01): site: render table of contents on upgrading page (@MateSousa)
- **PR #7738** (2026-09-21): build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1 (@dependabot[bot])
- **PR #7737** (2026-09-21): build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1 (@dependabot[bot])
- **PR #7736** (2026-09-21): build(deps): bump sigs.k8s.io/controller-runtime from 0.25.0 to 0.25.1 (@dependabot[bot])
- **PR #7735** (2026-09-21): build(deps): bump github.com/onsi/ginkgo/v2 from 2.32.2 to 2.33.0 (@dependabot[bot])
- **PR #7734** (2026-09-21): build(deps): bump golang.org/x/oauth2 from 0.36.0 to 0.37.0 (@dependabot[bot])
- **PR #7733** (2026-09-21): build(deps): bump google.golang.org/grpc from 1.83.2 to 1.84.0 (@dependabot[bot])
- **PR #7731** (2026-09-14): build(deps): bump the codeql-action group with 4 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
