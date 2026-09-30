# Forensic Learning Record (Deep Inspection): kgateway-dev/kgateway

> **Canonical Artifact**: `07_PROJECT_LEARNING/kgateway-dev-kgateway-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:30:08.941Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kgateway-dev/kgateway`
- **Description**: The Cloud-Native API Gateway and AI Gateway
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5695 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/annotations/delegation.go`
```
package annotations

const (
	// DelegationInheritMatcher is the annotation used on a child HTTPRoute that
	// participates in a delegation chain to indicate that child route should inherit
	// the route matcher from the parent route.
	DelegationInheritMatcher = "delegation.kgateway.dev/inherit-parent-matcher"
)

```

### Core Architecture Module: `api/annotations/gateway.go`
```
package annotations

import gwv1 "sigs.k8s.io/gateway-api/apis/v1"

const (
	// AlpnProtocols is the annotation key used to set the ALPN protocols for a TLS listener.
	// The value is a comma separated list of protocols, e.g "h2,http/1.1".
	// If not present, the listener will use the default ALPN protocols ("h2", "http/1.1").
	// Use in the TLS options field of a TLS listener.
	// example:
	// ```
	// tls:
	//
	//	options:
	//	  kgateway.dev/alpn-protocols: "h2,http/1.1"
	//
	// ```
	AlpnProtocols gwv1.AnnotationKey = "kgateway.dev/alpn-protocols"

	// AllowEmptyAlpnProtocols is an annotation value for the ALPN protocols.
	// It is used to allow empty ALPN protocols for a TLS listener.
	// The value is a boolean, e.g "true".
	AllowEmptyAlpnProtocols gwv1.AnnotationValue = "allow-empty"

	// CipherSuites is the annotation key used to set the cipher suites for a TLS listener.
	// The value is a comma separated list of cipher suites, e.g "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384".
	// Use in the TLS options field of a TLS listener.
	CipherSuites gwv1.AnnotationKey = "kgateway.dev/cipher-suites"

	// EcdhCurves is the annotation key used to set the ECDH curves for a TLS listener.
	// The value is a comma separated list of curves, e.g "X25519MLKEM768,X25519,P-256".
	// Use in the TLS options field of a TLS listener.
	EcdhCurves gwv1.AnnotationKey = "kgateway.dev/ecdh-curves"

	// SignatureAlgorithms is the annotation key used to set the supported algorithms for a TLS listener.
	// The value is a comma separated list of algorithms, e.g "ecdsa_secp256r1_sha256,rsa_pss_rsae_sha256".
	// Use in the TLS options field of a TLS listener.
	SignatureAlgorithms gwv1.AnnotationKey = "kgateway.dev/signature-algorithms"

	// MinTLSVersion is the annotation key used to set the minimum TLS version for a TLS listener.
	// The value is a string representing the version, e.g "1.2".
	// Use in the TLS options field of a TLS listener.
	MinTLSVersion gwv1.AnnotationKey = "kgateway.dev/min-tls-version"

	// MaxTLSVersion is the annotation key used to set the maximum TLS version for a TLS listener.
	// The value is a string representing the version, e.g "1.3".
	// Use in the TLS options field of a TLS listener.
	MaxTLSVersion gwv1.AnnotationKey = "kgateway.dev/max-tls-version"

	// VerifySubjectAltNames is the annotation key used to set the verify subject alt names for a TLS listener.
	// The value is a comma separated list of subject alt names, e.g "example.com,www.example.com".
	// Use in the TLS options field of a TLS listener.
	// Note: This annotation requires a trusted CA to be configured
	VerifySubjectAltNames gwv1.AnnotationKey = "kgateway.dev/verify-subject-alt-names"

	// VerifyCertificateHash is the annotation key used to set the verify certificate hash used by the client.
	// The value is a comma or "-" separated list of certificate hashes which may be whitespace padded for readability.
	// Valid values are sha256 hashes in hex format, e.g "7D86C6654C8229364ECFE4D4964C69410090AE09E9B4D0C9B2AD7854175AD51D" or "7D:86:C6:65:4C:82:29:36:4E:CF:E4:D4:96:4C:69:41:00:90:AE:09:E9:B4:D0:C9:B2:AD:78:54:17:5A:D5:1D".
	// All characters, including formatting, are limited to 4096 characters by the annotation value specification https://gateway-api.sigs.k8s.io/reference/1.4/spec/#annotationvalue
	VerifyCertificateHash gwv1.AnnotationKey = "kgateway.dev/verify-certificate-hash"
)

```

### Core Architecture Module: `api/annotations/policy.go`
```
package annotations

const (
	// InheritedPolicyPriority is the annotation used on a Gateway or parent HTTPRoute to specify
	// the priority of corresponding policies attached that are inherited by attached routes or child routes respectively.
	InheritedPolicyPriority = "kgateway.dev/inherited-policy-priority"

	// PolicyPrecedenceWeight is an annotation that can be set on a policy CR to specify the weight of
	// the policy as an integer value (negative values are allowed).
	// Policies with higher weight implies higher priority, and are evaluated before policies with lower weight.
	// By default, policies have a weight of 0.
	// The policy's weight is relevant to policy prioritization during policy merging, such that higher priority
	// policies are preferred during a merge conflict or when ordering policies during a merge.
	// Note: for policies that are implemented using GatewayExtensions (such as extAuth, etcProc), the weight specified on the GatewayExtension
	// will be used instead.
	PolicyPrecedenceWeight = "kgateway.dev/policy-weight"

	// DisableIstioAutoMTLS, if present on any backend object (Backend, K8s Service, ServiceEntry, etc.),
	// disables Istio auto-mTLS for that specific backend.
	// This is useful for cases where you want to disable Istio auto-mTLS for a specific backend, but still use other TLS mechanisms
	// (by applying a BackendConfigPolicy or BackendTLSPolicy).
	DisableIstioAutoMTLS = "kgateway.dev/disable-istio-auto-mtls"

	// HTTPRedirectStatusCode is an annotation that can be set on an HTTPRoute to specify the HTTP status code for the RequestRedirect
	// filter. The value must be one of 301, 302, 303, 307, 308.
	// By default, this annotation will override the statusCode field on the RequestRedirect filter for all route rules using the RequestRedirect filter.
	// E.g., kgateway.dev/http-redirect-status-code: "307" will set the status code to 307 for all RequestRedirect filters on the HTTPRoute.
	// To set a different status code for individual route rules, the value must be a comma-separated list of rule-name=status-code pairs.
	// E.g., kgateway.dev/http-redirect-status-code: "rule1=307,rule2=308" will set the status code to 307 for filter on rule1 and 308 for filter on rule2.
	HTTPRedirectStatusCode = "kgateway.dev/http-redirect-status-code"
)

// InheritedPolicyPriorityValue is the value for the InheritedPolicyPriority annotation
type InheritedPolicyPriorityValue string

const (
	// ShallowMergePreferParent is the value for the InheritedPolicyPriority annotation to indicate that
	// inherited parent policies (attached to the Gateway or parent HTTPRoute) should be shallow merged and
	// preferred over policies directly attached to child routes in case of conflicts.
	ShallowMergePreferParent InheritedPolicyPriorityValue = "ShallowMergePreferParent"

	// ShallowMergePreferChild is the value for the InheritedPolicyPriority annotation to indicate that
	// policies attached to the child route should be shallow merged and preferred over inherited parent policies
	// (attached to the Gateway or parent HTTPRoute) in case of conflicts.
	ShallowMergePreferChild InheritedPolicyPriorityValue = "ShallowMergePreferChild"

	// DeepMergePreferParent is the value for the InheritedPolicyPriority annotation to indicate that
	// inherited parent policies (attached to the Gateway or parent HTTPRoute) should be deep merged and
	// preferred over policies directly attached to child routes in case of conflicts.
	DeepMergePreferParent InheritedPolicyPriorityValue = "DeepMergePreferParent"

	// DeepMergePreferChild is the value for the InheritedPolicyPriority annotation to indicate that
	// policies attached to the child route should be deep merged and preferred over inherited parent policies
	// (attached to the Gateway or parent HTTPRoute) in case of conflicts.
	DeepMergePreferChild InheritedPolicyPriorityValue = "DeepMergePreferChild"
)

```

### Core Architecture Module: `api/annotations/routes.go`
```
package annotations

const (
	// RoutePrecedenceWeight is an annotation that can be set on an HTTPRoute to specify the weight of
	// the route as an integer value (negative values are allowed).
	// Routes with higher weight implies higher priority, and are evaluated before routes with lower weight.
	// By default, routes have a weight of 0.
	RoutePrecedenceWeight = "kgateway.dev/route-weight"
)

```

### Core Architecture Module: `api/conditions/conditions.go`
```
package conditions

const (

	// This condition indicates whether a route has generated some
	// configuration that will soon be ready in the underlying data plane.
	KgatewayConditionProgrammed = "kgateway.dev/Programmed"

	// This reason is used with the "kgateway.dev/Programmed" condition when
	// the condition is true.
	KgatewayReasonProgrammed = "Programmed"
)

```

### Core Architecture Module: `api/labels/delegation.go`
```
package labels

import "github.com/kgateway-dev/kgateway/v2/pkg/utils/envutils"

// DelegationLabelSelector is the label used to select HTTPRoutes to delegate to
// using a single label key-value pair
const DelegationLabelSelector = "delegation.kgateway.dev/label"

// DelegationLabelSelectorWildcardNamespace wildcards the namespace to select delegatee routes
// using the DelegationLabelSelector label.
// Note: this must be a valid RFC 1123 DNS label
var DelegationLabelSelectorWildcardNamespace = envutils.GetOrDefault("DELEGATION_WILDCARD_NAMESPACE", "all", false)

```

### Core Architecture Module: `api/settings/settings.go`
```
package settings

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/kelseyhightower/envconfig"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// ValidationMode determines how invalid routes and policies are handled during translation.
// Higher levels increase safety guarantees, but may have performance implications.
type ValidationMode string

const (
	// ValidationStandard rewrites invalid routes to direct responses
	// (typically HTTP 500), preserving a valid config while isolating failures.
	// This limits the blast radius of misconfigured routes or policies without
	// affecting unrelated tenants.
	ValidationStandard ValidationMode = "STANDARD"
	// ValidationStrict builds on standard by running targeted validation
	// (e.g. RDS, CDS, and security-related policies). Routes that fail these
	// checks are also replaced with direct responses, and helps prevent unsafe
	// config from reaching Envoy.
	// Strict Validation is not supported with Rustformation yet,
	// see docs/guides/transformation.md for details
	ValidationStrict ValidationMode = "STRICT"
)

// Decode implements envconfig.Decoder.
func (v *ValidationMode) Decode(value string) error {
	level := ValidationMode(strings.ToUpper(value))
	switch level {
	case ValidationStandard, ValidationStrict:
		*v = level
		return nil
	default:
		return fmt.Errorf("invalid validation mode: %q", value)
	}
}

// ValidatorMode selects the strict-validation execution strategy.
type ValidatorMode string

const (
	// ValidatorBinary forks envoy --mode validate per call.
	ValidatorBinary ValidatorMode = "BINARY"
	// ValidatorCache wraps ValidatorBinary with an LRU result cache.
	ValidatorCache ValidatorMode = "CACHE"
)

// Decode implements envconfig.Decoder.
func (v *ValidatorMode) Decode(value string) error {
	mode := ValidatorMode(strings.ToUpper(value))
	switch mode {
	case ValidatorBinary, ValidatorCache:
		*v = mode
		return nil
	default:
		return fmt.Errorf("invalid validator mode: %q", value)
	}
}

// ReferenceGrantMode controls how strictly cross-namespace references are validated
// via ReferenceGrant across the control plane.
type ReferenceGrantMode string

const (
	// ReferenceGrantOff disables all ReferenceGrant validation. All cross-namespace
	// references are permitted without any grant. Use only in environments where
	// namespace isolation is enforced by other means.
	ReferenceGrantOff ReferenceGrantMode = "OFF"

	// ReferenceGrantPermissive enforces ReferenceGrant for cross-namespace
	// BackendRef and SecretRef references (current default behavior). Cross-namespace
	// ExtensionRef references are permitted without a grant.
	ReferenceGrantPermissive ReferenceGrantMode = "PERMISSIVE"

	// ReferenceGrantStrict enforces ReferenceGrant for all cross-namespace references,
	// including ExtensionRef (e.g., TrafficPolicy referencing a GatewayExtension in
	// another namespace).
	ReferenceGrantStrict ReferenceGrantMode = "STRICT"
)

// Decode implements envconfig.Decoder.
func (r *ReferenceGrantMode) Decode(value string) error {
	mode := ReferenceGrantMode(strings.ToUpper(value))
	switch mode {
	case ReferenceGrantOff, ReferenceGrantPermissive, ReferenceGrantStrict:
		*r = mode
		return nil
	default:
		return fmt.Errorf("invalid reference grant mode: %q", value)
	}
}

// DnsLookupFamily controls the DNS lookup family for all static clusters created via Backend resources.
type DnsLookupFamily string

const (
	// DnsLookupFamilyV4Preferred is the default value for DnsLookupFamily.
	// The DNS resolver will first perform a lookup for addresses in the IPv4 family
	// and fallback to a lookup for addresses in the IPv6 family. The callback target
	// will only get v6 addresses if there were no v4 addresses to return.
	DnsLookupFamilyV4Preferred DnsLookupFamily = "V4_PREFERRED"
	// DnsLookupFamilyV4Only is the value for DnsLookupFamily that only performs
	// DNS lookups for addresses in the IPv4 family.
	DnsLookupFamilyV4Only DnsLookupFamily = "V4_ONLY"
	// DnsLookupFamilyV6Only is the value for DnsLookupFamily that only performs
	// DNS lookups for addresses in the IPv6 family.
	DnsLookupFamilyV6Only DnsLookupFamily = "V6_ONLY"
	// DnsLookupFamilyAll is the value for DnsLookupFamily that performs lookups
	// for both IPv4 and IPv6 families and returns all resolved addresses.
	DnsLookupFamilyAll DnsLookupFamily = "ALL"
	// DnsLookupFamilyAuto is the value for DnsLookupFamily that first performs
	// a lookup for addresses in the IPv6 family and falls back to a lookup for
	// addresses in the IPv4 family. This is semantically equivalent to a
	// non-existent V6_PREFERRED option and is a legacy name that will be
	// deprecated in favor of V6_PREFERRED in a future major version.
	DnsLookupFamilyAuto DnsLookupFamily = "AUTO"
)

// Decode implements envconfig.Decoder.
func (m *DnsLookupFamily) Decode(value string) error {
	mode := DnsLookupFamily(value)
	switch mode {
	case DnsLookupFamilyV4Preferred, DnsLookupFamilyV4Only, DnsLookupFamilyV6Only, DnsLookupFamilyAll, DnsLookupFamilyAuto:
		*m = mode
		return nil
	default:
		return fmt.Errorf("invalid DNS lookup family: %q", value)
	}
}

// GatewayClassParametersRefs maps GatewayClass names to ParametersReference
type GatewayClassParametersRefs map[string]*gwv1.ParametersReference

// Decode implements envconfig.Decoder
func (r *GatewayClassParametersRefs) Decode(value string) error {
	if value == "" {
		*r = nil
		return nil
	}

	// First parse as a simple map to validate name is present
	var simpleParsed map[string]struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Group     string `json:"group,omitempty"`
		Kind      string `json:"kind,omitempty"`
	}
	if err := json.Unmarshal([]byte(value), &simpleParsed); err != nil {
		return fmt.Errorf("invalid gateway class parameters refs: %w", err)
	}

	parsed := make(map[string]*gwv1.ParametersReference, len(simpleParsed))
	for className, ref := range simpleParsed {
		if strings.TrimSpace(ref.Name) == "" {
			return fmt.Errorf("gateway class %q parametersRef.name must be set", className)
		}
		if strings.TrimSpace(ref.Namespace) == "" {
			return fmt.Errorf("gateway class %q parametersRef.namespace must be set", className)
		}
		ns := gwv1.Namespace(ref.Namespace)
		paramsRef := &gwv1.ParametersReference{
			Name:      ref.Name,
			Namespace: &ns,
		}
		if ref.Group != "" {
			paramsRef.Group = gwv1.Group(ref.Group)
		}
		if ref.Kind != "" {
			paramsRef.Kind = gwv1.Kind(ref.Kind)
		}

		parsed[className] = paramsRef
	}

	*r = parsed
	return nil
}

type Settings struct {
	// Controls the DnsLookupFamily for all static clusters created via Backend resources.
	// If not set, kgateway will default to "V4_PREFERRED". Note that this is different
	// from the Envoy default of "AUTO", which is effectively "V6_PREFERRED".
	// Supported values are: "ALL", "AUTO", "V4_PREFERRED", "V4_ONLY", "V6_ONLY"
	// Details on the behavior of these options are available on the Envoy documentation:
	// https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/cluster/v3/cluster.proto#enum-config-cluster-v3-cluster-dnslookupfamily
	DnsLookupFamily DnsLookupFamily `split_words:"true" default:"V4_PREFERRED"`

	// Controls the listener bind address. Can be either V4 or V6
	ListenerBindIpv6 bool `split_words:"true" default:"true"`

	// AdminBindAddress controls which host the admin/debug server binds to.
	// The default loopback-only binding avoids exposing pprof, logging control,
	// and config snapshots outside the pod unless explicitly enabled.
	AdminBindAddress string `split_words:"true" default:"localhost"`

	EnableIstioIntegration bool `split_words:"true"`
	EnableIstioAutoMtls    bool `split_words:"true"`

	// IstioNamespace is the namespace where Istio control plane components are installed.
	// Defaults to "istio-system".
	IstioNamespace string `split_words:"true" default:"istio-system"`

	// WorkloadEntriesExclusionLabels is a comma-separated list of label keys. WorkloadEntries carrying
	// any o
```

### Core Architecture Module: `api/v1alpha1/kgateway/backend_config_policy_types.go`
```
package kgateway

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/shared"
)

// +kubebuilder:rbac:groups=gateway.kgateway.dev,resources=backendconfigpolicies,verbs=get;list;watch
// +kubebuilder:rbac:groups=gateway.kgateway.dev,resources=backendconfigpolicies/status,verbs=get;update;patch

// +kubebuilder:printcolumn:name="Accepted",type=string,JSONPath=".status.ancestors[*].conditions[?(@.type=='Accepted')].status",description="Backend config policy acceptance status"
// +kubebuilder:printcolumn:name="Attached",type=string,JSONPath=".status.ancestors[*].conditions[?(@.type=='Attached')].status",description="Backend config policy attachment status"

// +genclient
// +kubebuilder:object:root=true
// +kubebuilder:metadata:labels={app=kgateway,app.kubernetes.io/name=kgateway,gateway.networking.k8s.io/policy=Direct}
// +kubebuilder:resource:categories=kgateway
// +kubebuilder:subresource:status
type BackendConfigPolicy struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`
	// +required
	Spec BackendConfigPolicySpec `json:"spec"`
	// +optional
	Status gwv1.PolicyStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true
type BackendConfigPolicyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []BackendConfigPolicy `json:"items"`
}

// BackendConfigPolicySpec defines the desired state of BackendConfigPolicy.
//
// +kubebuilder:validation:AtMostOneOf=http1ProtocolOptions;http2ProtocolOptions
type BackendConfigPolicySpec struct {
	// TargetRefs specifies the target references to attach the policy to.
	// +optional
	// +kubebuilder:validation:MinItems=1
	// +kubebuilder:validation:MaxItems=16
	// +kubebuilder:validation:XValidation:rule="self.all(r, (r.group == '' && r.kind == 'Service') || (r.group == 'gateway.kgateway.dev' && r.kind == 'Backend') || (r.group == 'networking.istio.io' && r.kind == 'Hostname'))",message="TargetRefs must reference either a Kubernetes Service, a Backend, or an Istio Hostname"
	TargetRefs []shared.LocalPolicyTargetReference `json:"targetRefs,omitempty"`

	// TargetSelectors specifies the target selectors to select resources to attach the policy to.
	// +optional
	// +kubebuilder:validation:XValidation:rule="self.all(r, (r.group == '' && r.kind == 'Service') || (r.group == 'gateway.kgateway.dev' && r.kind == 'Backend') || (r.group == 'networking.istio.io' && r.kind == 'Hostname'))",message="TargetSelectors must reference either a Kubernetes Service, a Backend, or an Istio Hostname"
	TargetSelectors []shared.LocalPolicyTargetSelector `json:"targetSelectors,omitempty"`

	// The timeout for new network connections to hosts in the cluster.
	// +optional
	// +kubebuilder:validation:Type=string
	// +kubebuilder:validation:MaxLength=32
	// +kubebuilder:validation:XValidation:rule="matches(self, '^([0-9]{1,5}(h|m|s|ms)){1,4}$')",message="invalid duration value"
	ConnectTimeout *metav1.Duration `json:"connectTimeout,omitempty"`

	// DNS contains DNS configuration. Note that this only applies to backends that resolve to Envoy DNS clusters, i.e.,
	// Backends of type Static, AWS, or GCP.
	// +optional
	DNS *DNS `json:"dns,omitempty"`

	// Soft limit on the size of the cluster's connections read and write buffers.
	// If unspecified, an implementation-defined default is applied (1MiB).
	// +optional
	// +kubebuilder:validation:Minimum=0
	PerConnectionBufferLimitBytes *int32 `json:"perConnectionBufferLimitBytes,omitempty"`

	// Configure OS-level TCP keepalive checks.
	// +optional
	TCPKeepalive *TCPKeepalive `json:"tcpKeepalive,omitempty"`

	// Additional options when handling HTTP requests upstream, applicable to
	// both HTTP1 and HTTP2 requests.
	// +optional
	CommonHttpProtocolOptions *CommonHttpProtocolOptions `json:"commonHttpProtocolOptions,omitempty"`

	// Additional options when handling HTTP1 requests upstream.
	// +optional
	Http1ProtocolOptions *Http1ProtocolOptions `json:"http1ProtocolOptions,omitempty"`

	// Http2ProtocolOptions contains the options necessary to configure HTTP/2 backends.
	// Note: Http2ProtocolOptions can only be applied to HTTP/2 backends.
	// See [Envoy documentation](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/transport_sockets/tls/v3/tls.proto#envoy-v3-api-msg-extensions-transport-sockets-tls-v3-sslconfig) for more details.
	// +optional
	Http2ProtocolOptions *Http2ProtocolOptions `json:"http2ProtocolOptions,omitempty"`

	// TLS contains the options necessary to configure a backend to use TLS origination.
	// See [Envoy documentation](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/transport_sockets/tls/v3/tls.proto#envoy-v3-api-msg-extensions-transport-sockets-tls-v3-sslconfig) for more details.
	// +optional
	TLS *TLS `json:"tls,omitempty"`

	// LoadBalancer contains the options necessary to configure the load balancer.
	// +optional
	LoadBalancer *LoadBalancer `json:"loadBalancer,omitempty"`

	// HealthCheck contains the options necessary to configure the health check.
	// +optional
	HealthCheck *HealthCheck `json:"healthCheck,omitempty"`

	// OutlierDetection contains the options necessary to configure passive health checking.
	// +optional
	OutlierDetection *OutlierDetection `json:"outlierDetection,omitempty"`

	// CircuitBreakers contains the options necessary to configure circuit breaking.
	// See [Envoy documentation](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking) for more details.
	// +optional
	CircuitBreakers *CircuitBreakers `json:"circuitBreakers,omitempty"`

	// UpstreamProxyProtocol configures the PROXY protocol for upstream connections to the backend.
	// When enabled, the proxy protocol header is prepended to upstream connections,
	// allowing backend services to see the original client connection information.
	// See [Envoy documentation](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/transport_sockets/proxy_protocol/v3/upstream_proxy_protocol.proto) for more details.
	// +optional
	UpstreamProxyProtocol *UpstreamProxyProtocol `json:"upstreamProxyProtocol,omitempty"`
}

// CircuitBreakers contains the options to configure circuit breaker thresholds for the default priority.
// See [Envoy documentation](https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/cluster/v3/circuit_breaker.proto) for more details.
// +kubebuilder:validation:AtLeastOneOf=maxConnections;maxPendingRequests;maxRequests;maxRetries
type CircuitBreakers struct {
	// MaxConnections is the maximum number of connections that will be made to
	// the upstream cluster. If not specified, defaults to 1024.
	// +optional
	// +kubebuilder:validation:Minimum=1
	MaxConnections *int32 `json:"maxConnections,omitempty"`

	// MaxPendingRequests is the maximum number of pending requests that are
	// allowed to the upstream cluster. If not specified, defaults to 1024.
	// +optional
	// +kubebuilder:validation:Minimum=1
	MaxPendingRequests *int32 `json:"maxPendingRequests,omitempty"`

	// MaxRequests is the maximum number of parallel requests that are allowed
	// to the upstream cluster. If not specified, defaults to 1024.
	// +optional
	// +kubebuilder:validation:Minimum=1
	MaxRequests *int32 `json:"maxRequests,omitempty"`

	// MaxRetries is the maximum number of parallel retries that are allowed
	// to the upstream cluster. If not specified, defaults to 3.
	// +optional
	// +kubebuilder:validation:Minimum=0
	MaxRetries *int32 `json:"maxRetries,omitempty"`

	// TrackRemaining controls whether Envoy tracks the remaining resource
	// gauges for this circuit breaker threshold group. When enabled, the
	// remaining_cx, remaining_pending, remaining_rq, and remaining_retries
	// statistics are populated. Enabling this has a performance cost.
	// If not specified, de
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14768** (2026-09-28): **test: fold e2e extproc server into the root Go module**
  *Symptoms*: # Description  **Motivation:** `test/e2e/defaults/extproc` was its own Go module with its own `go.mod`/`go.sum`. Security scanners report on every manifest, so each root-module CVE bump had to be repeated there, and in practice it lagged behind: it pinned `go-control-plane/envoy v1.37.0` while the root module was already on a newer pseudo-version. Ten commits since #13376 exist only to re-bump this file (#13467, #13706, #13836, #14023, #14076, #14103, #14403, #14459, #14588, #14669). The server imports only `go-control-plane/envoy` and `grpc`, which the root module already requires, so a separate module buys nothing.  **What changed:** - Delete `test/e2e/defaults/extproc/go.mod` and `go.sum`; the server is now a `package main` in the root module. `go mod tidy` at the root is a no-op. - Build the binary on the host from the root module and copy it into `cgr.dev/chainguard/static`, following the `dummy-idp` pattern (#14739). This drops the in-image `cgr.dev/chainguard/go:latest` builder stage. - The image rebuilds when root `go.mod`/`go.sum` change, so dependency bumps reach the image. - Remove the extproc entries from `mod-download`, `mod-tidy`, and `MOD_FILES`. - `main.go` now falls under the root lint config. Lint fixes it required: `errors.Is(err, io.EOF)`, `envoycorev3` import alias, snake_case log key.  # Change Type  /kind cleanup  # Changelog  ```release-note NONE ```  # Additional Notes  - Image tag (`ghcr.io/kgateway-dev/extproc-server:0.0.1`), 

- **Issue #14765** (2026-09-28): **bump: go 1.26.8**
  *Symptoms*: <!-- Thanks for opening a PR! Please delete any sections that don’t apply. -->  # Description  Bump go. go 1.26.8 is an internal bug fix release only. <!-- A concise explanation of the change. You may include: - **Motivation:** why this change is needed - **What changed:** key implementation details - **Related issues:** e.g., `Fixes #123` -->  # Change Type /kind bump  <!-- Select one or more of the following by including the corresponding slash-command.  If you pick more than one, the release note is filed under whichever appears first here (manual reordering does not have any effect): ``` /kind breaking_change /kind feature /kind fix /kind deprecation /kind documentation /kind cleanup /kind install /kind bump (the following kinds are not included in release notes) /kind design /kind flake /kind test ``` -->  # Changelog  <!-- Provide the exact line to appear in the release notes for this PR.  A PR gets one release note, filed under the highest-precedence /kind above. If this change needs no release note, write "NONE" in the block below. -->  ```release-note NONE ```  # Additional Notes  <!-- Any extra context or edge cases for reviewers. --> 

- **Issue #14764** (2026-09-28): **Bump OpenTelemetry Go modules for CVE-2026-81870**
  *Symptoms*: # Description  Upgrade the OpenTelemetry SDK and OTLP trace exporters to v1.45.0 in the root and tools Go modules to address CVE-2026-81870. Refresh module sums and license attribution.  # Change Type  /kind bump  # Changelog  ```release-note Upgrade OpenTelemetry Go dependencies to address CVE-2026-81870. ```  # Additional Notes  Verified with `go build -tags e2e ./...` and `make osv-scan`; the local scan no longer reports CVE-2026-81870. GO-2026-6225 remains in the tools module because no fixed version is published. The published image alerts for CVE-2026-81870 should clear after images are rebuilt and rescanned.  <!-- Thanks for opening a PR! Please delete any sections that don’t apply. --> 

- **Issue #14763** (2026-09-28): **[2.3] Bump OpenTelemetry Go modules for CVE-2026-81870**
  *Symptoms*: # Description  Upgrade the OpenTelemetry SDK and OTLP trace exporters to v1.45.0 in the root and tools Go modules to address CVE-2026-81870. Refresh module sums and license attribution.  # Change Type  /kind bump  # Changelog  ```release-note Upgrade OpenTelemetry Go dependencies to address CVE-2026-81870. ```  # Additional Notes  Verified with `go build -tags e2e ./...` and `make osv-scan`; the local scan no longer reports CVE-2026-81870. GO-2026-6225 remains in the tools module because no fixed version is published. The published v2.3.x images also report Ubuntu OS package advisories. The current Envoy base already runs `apt-get upgrade`; no compatible fixed base image was identified.  <!-- Thanks for opening a PR! Please delete any sections that don’t apply. --> 

- **Issue #14762** (2026-09-28): **[2.4] Bump OpenTelemetry Go modules for CVE-2026-81870**
  *Symptoms*: # Description  Upgrade the OpenTelemetry SDK and OTLP trace exporters to v1.45.0 in the root and tools Go modules to address CVE-2026-81870. Refresh module sums and license attribution.  # Change Type  /kind bump  # Changelog  ```release-note Upgrade OpenTelemetry Go dependencies to address CVE-2026-81870. ```  # Additional Notes  Verified with `go build -tags e2e ./...` and `make osv-scan`; the local scan no longer reports CVE-2026-81870. GO-2026-6225 remains in the tools module because no fixed version is published. The published image alerts for CVE-2026-81870 should clear after images are rebuilt and rescanned.  <!-- Thanks for opening a PR! Please delete any sections that don’t apply. --> 

- **Issue #14759** (2026-09-25): **[2.4] Report status for delegated child routes whose parentRef omits the namespace**
  *Symptoms*: # Description  Cherry-pick https://github.com/kgateway-dev/kgateway/pull/14758 to v2.4.x.  **Motivation:** A delegated child HTTPRoute whose HTTPRoute `parentRef` omits `namespace` (which the Gateway API defaults to the child's own namespace) attaches and serves traffic, but gets no `status` at all.  **Root cause:** The child's route report was keyed by a synthesized parentRef that always carried an explicit `namespace`. `BuildRouteStatus` looks parents up by the route's spec `parentRefs` as written, so the lookup missed and the parent was skipped. Two places synthesized this reference independently: the query layer (`RouteInfo.ParentRef`, which flows into the IR routes the IR translator reports under) and `flattenDelegatedRoutes`.  **What changed:** - New `delegation.MatchingParentRef` returns the child's spec parentRef that references the parent, exactly as written (namespace defaulting to the child's). `ChildRouteCanAttachToParentRef` now delegates to it, so attachment and status share one matching rule. - The query layer sets a child's `RouteInfo.ParentRef` to that reference, falling back to the fully qualified synthesized one for children that attach implicitly (no `parentRefs`). - `flattenDelegatedRoutes` reports under `child.ParentRef` instead of synthesizing its own, so the child gets exactly one parent status entry, echoing its spec.  Fixes #14755  # Change Type  /kind fix  # Changelog  ```release-note Fixed delegated child HTTPRoutes getting no status when their HTT

- **Issue #14758** (2026-09-25): **Report status for delegated child routes whose parentRef omits the namespace**
  *Symptoms*: # Description  **Motivation:** A delegated child HTTPRoute whose HTTPRoute `parentRef` omits `namespace` (which the Gateway API defaults to the child's own namespace) attaches and serves traffic, but gets no `status` at all.  **Root cause:** The child's route report was keyed by a synthesized parentRef that always carried an explicit `namespace`. `BuildRouteStatus` looks parents up by the route's spec `parentRefs` as written, so the lookup missed and the parent was skipped. Two places synthesized this reference independently: the query layer (`RouteInfo.ParentRef`, which flows into the IR routes the IR translator reports under) and `flattenDelegatedRoutes`.  **What changed:** - New `delegation.MatchingParentRef` returns the child's spec parentRef that references the parent, exactly as written (namespace defaulting to the child's). `ChildRouteCanAttachToParentRef` now delegates to it, so attachment and status share one matching rule. - The query layer sets a child's `RouteInfo.ParentRef` to that reference, falling back to the fully qualified synthesized one for children that attach implicitly (no `parentRefs`). - `flattenDelegatedRoutes` reports under `child.ParentRef` instead of synthesizing its own, so the child gets exactly one parent status entry, echoing its spec.  Fixes #14755  # Change Type  /kind fix  # Changelog  ```release-note Fixed delegated child HTTPRoutes getting no status when their HTTPRoute parentRef omits the namespace. ```  # Additional Notes  - New golden 

- **Issue #14755** (2026-09-25): **Delegated child HTTPRoute gets no status when its HTTPRoute parentRef omits the namespace**
  *Symptoms*: ### kgateway version  v2.4.1  ### Kubernetes Version  v.1.34.10  ### Describe the bug  When a delegated child HTTPRoute references its parent HTTPRoute in `spec.parentRefs` without setting `namespace`, the child is attached and serves traffic to the parent `HTTPRoute` in the same namespace, but the child route has no `status` at all.   Setting `namespace` explicitly on the child `HTTPRoute` works around the problem.  ### Expected Behavior  Per the Gateway API spec, `ParentReference.namespace` is optional:  > [If not present, the namespace of the referent is assumed to be the same as the namespace of the referring object. ](https://github.com/kubernetes-sigs/gateway-api/blob/8bb74df00e56ec8f944d48c25e6c1c9c2f6848e3/apis/v1/shared_types.go#L1056)   When a `HTTPRoute` `spec.parentRefs` is used, the child route should have its status updated.  ### Steps to reproduce the bug  Create a parent route and a delegated child in the same namespace, where the child's parentRef has no namespace:     ```yaml    apiVersion: gateway.networking.k8s.io/v1    kind: HTTPRoute    metadata:      name: parent-same-ns      namespace: team1    spec:      parentRefs:      - name: gateway        namespace: kgateway-base      rules:      - matches:        - path:            type: PathPrefix            value: /anything/team1        backendRefs:        - group: gateway.networking.k8s.io          kind: HTTPRoute          name: svc1-child    ---    apiVersion: gateway.networking.k8s.io/v1    kind: HTTPRoute 

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

### Incident Patch 1: `f7c2e6e4` (2026-09-24)
**Commit Message**: fix(backend): rewrite Host to the Lambda endpoint before SigV4 signing (#14712)

Signed-off-by: Rishabh <rishabhsaiv@gmail.com>
Signed-off-by: omar <omar.hammami@solo.io>
Co-authored-by: omar <omar.hammami@solo.io>

**File**: `pkg/kgateway/extensions2/plugins/backend/aws.go` (modified, +17/-0)
```diff
@@ -5,6 +5,7 @@ import (
 	"fmt"
 	"net/url"
 	"strconv"
+	"strings"
 	"unicode/utf8"
 
 	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
@@ -241,6 +242,7 @@ func (u *lambdaFilters) Equals(other *lambdaFilters) bool {
 func buildLambdaFilters(
 	arn string,
 	region string,
+	hostRewrite string,
 	auth *kgateway.AwsAuth,
 	secret *ir.Secret,
 	invokeMode envoy_lambda_v3.Config_InvocationMode,
@@ -254,10 +256,12 @@ func buildLambdaFilters(
 		payloadPassthrough = false
 	}
 
+	// Use the Lambda endpoint authority instead of the client authority or a route-level rewrite.
 	lambdaConfigAny, err := utils.MessageToAny(&envoy_lambda_v3.Config{
 		Arn:                arn,
 		InvocationMode:     invokeMode,
 		PayloadPassthrough: payloadPassthrough,
+		HostRewrite:        hostRewrite,
 	})
 	if err != nil {
 		return nil, fmt.Errorf("failed to create lambda config: %w", err)
@@ -334,6 +338,19 @@ type lambdaEndpointConfig struct {
 	useTLS   bool
 }
 
+// authority returns the HTTP authority, omitting only the scheme's default port.
+func (u *lambdaEndpointConfig) authority() string {
+	host := u.hostname
+	if strings.Contains(host, ":") {
+		// url.Hostname() strips the brackets an IPv6 authority needs.
+		host = "[" + host + "]"
+	}
+	if (u.useTLS && u.port == 443) || (!u.useTLS && u.port == 80) {
+		return host
+	}
+	return host + ":" + strconv.FormatUint(uint64(u.port), 10)
+}
+
 // Equals checks if two lambdaEndpointConfig objects are equal.
 func (u *lambdaEndpointConfig) Equals(other *lambdaEndpointConfig) bool {
 	return u.hostname == other.hostname && u.port == other.port && u.useTLS == other.useTLS
```

**File**: `pkg/kgateway/extensions2/plugins/backend/aws_test.go` (modified, +47/-9)
```diff
@@ -6,6 +6,7 @@ import (
 
 	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
 	envoydnsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/clusters/dns/v3"
+	envoy_lambda_v3 "github.com/envoyproxy/go-control-plane/envoy/extensions/filters/http/aws_lambda/v3"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"google.golang.org/protobuf/proto"
@@ -127,15 +128,15 @@ func TestBuildLambdaARNFallsBackToDeprecatedBackendAccountID(t *testing.T) {
 func TestBuildTranslateFuncFailsClosedForLambdaEndpointWithoutPort(t *testing.T) {
 	translate := buildTranslateFunc(nil, nil, true)
 
-	backendIR := translate(krt.TestingDummyContext{}, newLambdaBackend("lambda-backend", "https://lambda.us-east-1.amazonaws.com"))
+	backendIR := translate(krt.TestingDummyContext{}, newLambdaBackend("us-east-1", "https://lambda.us-east-1.amazonaws.com"))
 
 	require.NotEmpty(t, backendIR.errors)
 	assert.ErrorContains(t, backendIR.errors[0], "failed to parse port")
 	assert.Nil(t, backendIR.awsIr, "translate() should not build AWS IR for an invalid lambda endpoint")
 }
 
 func TestBackendIrEqualsDetectsLambdaErrorOnlyChanges(t *testing.T) {
-	backend := newLambdaBackend("example-aws-backend", "https://lambda.us-east-1.amazonaws.com:443")
+	backend := newLambdaBackend("us-east-1", "https://lambda.us-east-1.amazonaws.com:443")
 	backend.ObjectMeta = metav1.ObjectMeta{
 		Name:      "example-aws-backend",
 		Namespace: "kgateway-base",
@@ -167,22 +168,59 @@ func TestBackendIrEqualsDetectsLambdaErrorOnlyChanges(t *testing.T) {
 	assert.False(t, invalidSecretIR.Equals(missingSecretIR), "backend IR equality should remain symmetric")
 }
 
-func newLambdaBackend(name, endpointURL string) *kgateway.Backend {
+// newLambdaBackend builds a Lambda Backend in the given region. An empty
+// endpointURL leaves the default AWS endpoint in place.
+func newLambdaBackend(region, endpointURL string) *kgateway.Backend {
+	lambda := &kgateway.AwsLambda{
+		FunctionName: "hello-function",
+		Qualifier:    "live",
+	}
+	if endpointURL != "" {
+		lambda.EndpointURL = &endpointURL
+	}
 	return &kgateway.Backend{
 		Spec: kgateway.BackendSpec{
 			Aws: &kgateway.AwsBackend{
-				Region:    "us-east-1",
+				Region:    region,
 				AccountId: "111111111111",
-				Lambda: &kgateway.AwsLambda{
-					FunctionName: "hello-function",
-					Qualifier:    "live",
-					EndpointURL:  &endpointURL,
-				},
+				Lambda:    lambda,
 			},
 		},
 	}
 }
 
+func TestLambdaFiltersRewriteHostToTheLambdaEndpoint(t *testing.T) {
+	tests := []struct {
+		name     string
+		endpoint string
+		want     string
+	}{
+		{name: "default endpoint", want: "lambda.us-east-2.amazonaws.com"},
+		{name: "custom HTTP port", endpoint: "http://localstack:4566", want: "localstack:4566"},
+		{name: "custom HTTPS port", endpoint: "https://localstack:4566", want: "localstack:4566"},
+		{name: "default HTTP port", endpoint: "http://localstack:80", want: "localstack"},
+		{name: "default HTTPS port", endpoint: "https://localstack:443", want: "localstack"},
+		{name: "HTTP on port 443", endpoint: "http://localstack:443", want: "localstack:443"},
+		{name: "HTTPS on port 80", endpoint: "https://localstack:80", want: "localstack:80"},
+		{name: "IPv6 custom port", endpoint: "http://[::1]:4566", want: "[::1]:4566"},
+		{name: "IPv6 default port", endpoint: "http://[::1]:80", want: "[::1]"},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			backend := newLambdaBackend("us-east-2", tt.endpoint)
+			backendIR := buildTranslateFunc(nil, nil, true)(krt.TestingDummyContext{}, backend)
+			require.Empty(t, backendIR.errors)
+			require.NotNil(t, backendIR.awsIr)
+
+			var lambdaConfig envoy_lambda_v3.Config
+			err := anypb.UnmarshalTo(backendIR.awsIr.lambdaIr.lambdaFilters.lambdaConfigAny, &lambdaConfig, proto.UnmarshalOptions{})
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, lambdaConfig.GetHostRewrite())
+		})
+	}
+}
+
 // Tes
```

**File**: `pkg/kgateway/extensions2/plugins/backend/plugin.go` (modified, +1/-1)
```diff
@@ -235,7 +235,7 @@ func buildTranslateFunc(
 				}
 
 				lambdaFilters, err := buildLambdaFilters(
-					lambdaArn, region, i.Spec.Aws.Auth, secret, invokeMode, i.Spec.Aws.Lambda.PayloadTransformMode)
+					lambdaArn, region, endpointConfig.authority(), i.Spec.Aws.Auth, secret, invokeMode, i.Spec.Aws.Lambda.PayloadTransformMode)
 				if err != nil {
 					beIr.errors = append(beIr.errors, err)
 					break
```

**File**: `pkg/kgateway/setup/testdata/standard/lambda-custom-endpoint-out.yaml` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ clusters:
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_lambda.v3.Config
           arn: arn:aws:lambda:us-east-1:000000000000:function:my-test-function:$LATEST
+          hostRewrite: 172.18.0.2:4566
       - name: envoy.filters.http.aws_request_signing
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_request_signing.v3.AwsRequestSigning
```

**File**: `pkg/kgateway/setup/testdata/standard/lambda-defaults-out.yaml` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ clusters:
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_lambda.v3.Config
           arn: arn:aws:lambda:us-east-1:000000000000:function:my-lambda-function:$LATEST
+          hostRewrite: lambda.us-east-1.amazonaws.com
       - name: envoy.filters.http.aws_request_signing
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_request_signing.v3.AwsRequestSigning
```

---

### Incident Patch 2: `ca82f136` (2026-09-24)
**Commit Message**: Fix false convergence timeouts in xDS fleet reconnect tests (#14751)

Signed-off-by: David L. Chandler <david.chandler@solo.io>

**File**: `test/e2e/features/loadtesting/types_test.go` (modified, +42/-2)
```diff
@@ -137,7 +137,7 @@ func TestBenchConvergenceRequiresQuietWindow(t *testing.T) {
 	defer server.Close()
 	fleet := &XdsFleetSuite{metricsURL: server.URL}
 	fleet.SetT(t)
-	_, ok := fleet.waitConverged(0)
+	_, ok := fleet.waitConverged(0, true)
 	assert.False(t, ok, "a transform without a full quiet window must time out")
 	cost := &XdsCostSuite{metricsURL: server.URL}
 	cost.SetT(t)
@@ -279,7 +279,7 @@ func TestFleetCrashEmitsVerdictWithUnavailableMetrics(t *testing.T) {
 	fleet.SetT(t)
 	fleet.TestXdsFleet()
 	assert.False(t, fleet.waitServed(nil, time.Second), "a restart must prevent readiness even if all streams are ready")
-	_, converged := fleet.waitConverged(0)
+	_, converged := fleet.waitConverged(0, true)
 	assert.False(t, converged, "a restart must stop convergence polling")
 	data, err := os.ReadFile(outputPath)
 	require.NoError(t, err)
@@ -420,3 +420,43 @@ func TestFleetPumpPreservesEndpointSubscriptionOnACK(t *testing.T) {
 	assert.Equal(t, "rds-nonce", stream.sent[3].ResponseNonce)
 	assert.EqualValues(t, 3, c.acks.Load())
 }
+
+func TestFleetConvergence(t *testing.T) {
+	oldSettle, oldTimeout := fleetSettleMillis, fleetIterTimeout
+	fleetSettleMillis, fleetIterTimeout = 100, 2*time.Second
+	testutils.Cleanup(t, func() {
+		fleetSettleMillis, fleetIterTimeout = oldSettle, oldTimeout
+	})
+
+	for _, tc := range []struct {
+		name             string
+		requireTransform bool
+		values           []int // A negative value represents an unavailable metrics endpoint.
+		want             bool
+	}{
+		{name: "cached reconnect", values: []int{10}, want: true},
+		{name: "churn requires a transform", requireTransform: true, values: []int{10}},
+		{name: "churn transforms", requireTransform: true, values: []int{11}, want: true},
+		{name: "scrape failure after transform", requireTransform: true, values: []int{11, -1, 11}, want: true},
+		{name: "unavailable metrics", values: []int{-1}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			calls := 0
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
+				value := tc.values[min(calls, len(tc.values)-1)]
+				calls++
+				if value < 0 {
+					w.WriteHeader(http.StatusServiceUnavailable)
+					return
+				}
+				fmt.Fprintf(w, "# TYPE kgateway_xds_snapshot_transforms_total counter\nkgateway_xds_snapshot_transforms_total %d\n", value)
+			}))
+			defer server.Close()
+			s := &XdsFleetSuite{metricsURL: server.URL}
+			_, got := s.waitConverged(10, tc.requireTransform)
+			if got != tc.want {
+				t.Fatalf("converged = %v, want %v", got, tc.want)
+			}
+		})
+	}
+}
```

**File**: `test/e2e/features/loadtesting/xdsfleet_suite.go` (modified, +15/-6)
```diff
@@ -522,9 +522,11 @@ func (s *XdsFleetSuite) TestXdsFleet() {
 		s.survivedGateways = connected
 	}
 
-	s.runFleetPhase("EdsChurn", func(i int) { s.churnEndpointSlice(i) })
-	s.runFleetPhase("BaseChurn", func(i int) { s.churnInlineBackend(i) })
-	s.runFleetPhase("StreamReconnect", func(i int) { s.reconnectOneGateway(i) })
+	s.runFleetPhase("EdsChurn", func(i int) { s.churnEndpointSlice(i) }, true)
+	s.runFleetPhase("BaseChurn", func(i int) { s.churnInlineBackend(i) }, true)
+	// Reopened streams must be served (checked by reconnectOneGateway), but
+	// serving a cached snapshot does not require a new transform.
+	s.runFleetPhase("StreamReconnect", func(i int) { s.reconnectOneGateway(i) }, false)
 }
 
 // clientsPerGateway is how many unique clients one Gateway's replicas produce.
@@ -540,7 +542,7 @@ func (s *XdsFleetSuite) clientsPerGateway() int {
 	return 1
 }
 
-func (s *XdsFleetSuite) runFleetPhase(name string, mutate func(int)) {
+func (s *XdsFleetSuite) runFleetPhase(name string, mutate func(int), requireTransform bool) {
 	s.T().Logf("=== fleet phase %s at %d clients", name, fleetGateways*s.clientsPerGateway())
 	s.Require().True(s.waitQuiet(time.Duration(fleetSettleMillis)*time.Millisecond, fleetWaveTimeout),
 		"controller must go quiet before phase %s", name)
@@ -553,7 +555,7 @@ func (s *XdsFleetSuite) runFleetPhase(name string, mutate func(int)) {
 		t0 := time.Now()
 		tBefore := s.scrape().Transforms
 		mutate(i)
-		last, ok := s.waitConverged(tBefore)
+		last, ok := s.waitConverged(tBefore, requireTransform)
 		if !ok {
 			timedOut++
 			s.T().Logf("phase %s iteration %d did not converge in %s", name, i, fleetIterTimeout)
@@ -1361,10 +1363,11 @@ func (s *XdsFleetSuite) controllerRestarts() int32 {
 	return total
 }
 
-func (s *XdsFleetSuite) waitConverged(before float64) (time.Time, bool) {
+func (s *XdsFleetSuite) waitConverged(before float64, requireTransform bool) (time.Time, bool) {
 	settle := time.Duration(fleetSettleMillis) * time.Millisecond
 	deadline := time.Now().Add(fleetIterTimeout)
 	last := time.Time{}
+	transformed := false
 	seen := before
 	for time.Now().Before(deadline) {
 		time.Sleep(250 * time.Millisecond)
@@ -1379,9 +1382,15 @@ func (s *XdsFleetSuite) waitConverged(before float64) (time.Time, bool) {
 		cur := sample.Transforms
 		if cur > seen {
 			seen = cur
+			transformed = true
 			last = time.Now()
 			continue
 		}
+		// Start (or restart after a failed scrape) the quiet window only once
+		// the phase's progress requirement has been met.
+		if last.IsZero() && (!requireTransform || transformed) {
+			last = time.Now()
+		}
 		if !last.IsZero() && time.Since(last) >= settle {
 			return last, true
 		}
```

---

### Incident Patch 3: `53b29e26` (2026-09-24)
**Commit Message**: make the ReferenceGrant source identity configurable and stop leaking selector matches (#14643)

Signed-off-by: omar <omar.hammami@solo.io>

**File**: `devel/reference_grant/reference-grant-mode.md` (modified, +4/-3)
```diff
@@ -161,7 +161,8 @@ mode is `Strict` and the target namespace differs from the source namespace:
 FetchGatewayExtension()                pkg/.../trafficpolicy/constructor.go
   if mode == Strict:
     RefGrants.ReferenceAllowed(
-      from: TrafficPolicy GK, fromNs,
+      from: TrafficPolicy GK (or the kind set via
+            WithSourceGroupKind), fromNs,
       to:   GatewayExtension GK, targetNs, name
     )
     -> ErrMissingReferenceGrant if denied
@@ -181,8 +182,8 @@ invalidation is needed.
 | `api/settings/settings.go` | `ReferenceGrantMode` type and `Settings.ReferenceGrantMode` field |
 | `pkg/krtcollections/policy.go` | `RefGrantIndex`, `NewRefGrantIndex`, `ReferenceAllowed` |
 | `pkg/pluginsdk/collections/collections.go` | Wires mode from settings into `NewRefGrantIndex` |
-| `pkg/kgateway/extensions2/plugins/trafficpolicy/constructor.go` | `FetchGatewayExtension` — Strict-mode ExtensionRef check |
-| `pkg/krtcollections/secrets.go` | SecretRef enforcement via `GetSecret` -> `ReferenceAllowed` |
+| `pkg/kgateway/extensions2/plugins/trafficpolicy/constructor.go` | `FetchGatewayExtension` — Strict-mode ExtensionRef check; `WithSourceGroupKind` |
+| `pkg/krtcollections/secrets.go` | SecretRef enforcement via `GetSecret` -> `ReferenceAllowed`; `From` |
 
 ## Tests
 
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/api_key_auth.go` (modified, +1/-6)
```diff
@@ -13,7 +13,6 @@ import (
 	"k8s.io/apimachinery/pkg/runtime/schema"
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
-	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/krtcollections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/collections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
@@ -75,6 +74,7 @@ type parsedAPIKey struct {
 func constructAPIKeyAuth(
 	krtctx krt.HandlerContext,
 	policy *kgateway.TrafficPolicy,
+	from krtcollections.From,
 	commoncol *collections.CommonCollections,
 	out *trafficPolicySpecIr,
 ) error {
@@ -96,11 +96,6 @@ func constructAPIKeyAuth(
 	// Resolve secrets using SecretIndex with ReferenceGrant validation
 	var secrets []ir.Secret
 	secretGK := schema.GroupKind{Group: "", Kind: "Secret"}
-	policyGK := wellknown.TrafficPolicyGVK.GroupKind()
-	from := krtcollections.From{
-		GroupKind: policyGK,
-		Namespace: policy.Namespace,
-	}
 
 	if ak.SecretRef != nil {
 		secret, err := commoncol.Secrets.GetSecret(krtctx, from, *ak.SecretRef)
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/basic_auth_policy.go` (modified, +4/-10)
```diff
@@ -14,7 +14,6 @@ import (
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
-	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/krtcollections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 )
@@ -102,6 +101,7 @@ func (p *trafficPolicyPluginGwPass) handleBasicAuth(
 func constructBasicAuth(
 	krtctx krt.HandlerContext,
 	in *kgateway.TrafficPolicy,
+	from krtcollections.From,
 	out *trafficPolicySpecIr,
 	secrets *krtcollections.SecretIndex,
 ) error {
@@ -127,7 +127,7 @@ func constructBasicAuth(
 		htpasswdData = strings.Join(spec.Users, "\n")
 	} else if spec.SecretRef != nil {
 		// Fetch from secret
-		htpasswdData, err = fetchHtpasswdFromSecret(krtctx, secrets, spec.SecretRef, in.Namespace)
+		htpasswdData, err = fetchHtpasswdFromSecret(krtctx, secrets, spec.SecretRef, from)
 		if err != nil {
 			return fmt.Errorf("basic auth: %w", err)
 		}
@@ -176,10 +176,10 @@ func fetchHtpasswdFromSecret(
 	krtctx krt.HandlerContext,
 	secrets *krtcollections.SecretIndex,
 	secretRef *kgateway.SecretReference,
-	policyNamespace string,
+	from krtcollections.From,
 ) (string, error) {
 	// Determine namespace - use secret's namespace if specified, otherwise policy's namespace
-	namespace := gwv1.Namespace(policyNamespace)
+	namespace := gwv1.Namespace(from.Namespace)
 	if secretRef.Namespace != nil {
 		namespace = *secretRef.Namespace
 	}
@@ -196,12 +196,6 @@ func fetchHtpasswdFromSecret(
 		Namespace: &namespace,
 	}
 
-	// Use TrafficPolicy as the source for reference grants
-	from := krtcollections.From{
-		GroupKind: wellknown.TrafficPolicyGVK.GroupKind(),
-		Namespace: policyNamespace,
-	}
-
 	// Fetch the secret
 	secret, err := secrets.GetSecret(krtctx, from, secretObjRef)
 	if err != nil {
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/constructor.go` (modified, +48/-14)
```diff
@@ -5,6 +5,7 @@ import (
 	"fmt"
 
 	"istio.io/istio/pkg/kube/krt"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/utils/ptr"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
@@ -26,22 +27,57 @@ type TrafficPolicyConstructor struct {
 	commoncol         *collections.CommonCollections
 	gatewayExtensions krt.Collection[TrafficPolicyGatewayExtensionIR]
 	extBuilder        func(krtctx krt.HandlerContext, gExt ir.GatewayExtension) *TrafficPolicyGatewayExtensionIR
+
+	// sourceGroupKind is the identity a ReferenceGrant has to name to permit the
+	// cross-namespace references in TrafficPolicySpec. Empty means TrafficPolicy;
+	// see WithSourceGroupKind.
+	sourceGroupKind schema.GroupKind
+}
+
+// TrafficPolicyConstructorOption configures a TrafficPolicyConstructor.
+type TrafficPolicyConstructorOption func(*TrafficPolicyConstructor)
+
+// WithSourceGroupKind sets the identity that ReferenceGrants are evaluated against
+// for the cross-namespace references TrafficPolicySpec holds: API key and basic auth
+// secrets, secret-backed header values, and, in Strict mode, GatewayExtension
+// references.
+//
+// Defaults to gateway.kgateway.dev/TrafficPolicy
+func WithSourceGroupKind(gk schema.GroupKind) TrafficPolicyConstructorOption {
+	return func(c *TrafficPolicyConstructor) {
+		c.sourceGroupKind = gk
+	}
 }
 
 func NewTrafficPolicyConstructor(
 	ctx context.Context,
 	commoncol *collections.CommonCollections,
+	opts ...TrafficPolicyConstructorOption,
 ) *TrafficPolicyConstructor {
 	extBuilder := TranslateGatewayExtensionBuilder(ctx, commoncol)
 	defaultExtBuilder := func(krtctx krt.HandlerContext, gExt ir.GatewayExtension) *TrafficPolicyGatewayExtensionIR {
 		return extBuilder(krtctx, gExt)
 	}
 	gatewayExtensions := krt.NewCollection(commoncol.GatewayExtensions, defaultExtBuilder)
-	return &TrafficPolicyConstructor{
+	c := &TrafficPolicyConstructor{
 		commoncol:         commoncol,
 		gatewayExtensions: gatewayExtensions,
 		extBuilder:        extBuilder,
 	}
+	for _, opt := range opts {
+		opt(c)
+	}
+	return c
+}
+
+// refGrantSource returns the source identity that ReferenceGrants are evaluated
+// against for references held by a TrafficPolicySpec in ns.
+func (c *TrafficPolicyConstructor) refGrantSource(ns string) krtcollections.From {
+	gk := c.sourceGroupKind
+	if gk.Empty() {
+		gk = wellknown.TrafficPolicyGVK.GroupKind()
+	}
+	return krtcollections.From{GroupKind: gk, Namespace: ns}
 }
 
 func (c *TrafficPolicyConstructor) ConstructIR(
@@ -81,7 +117,7 @@ func (c *TrafficPolicyConstructor) ConstructIR(
 	constructCompression(policyCR.Spec, &outSpec)
 
 	// Construct header modifiers specific IR
-	if err := constructHeaderModifiers(krtctx, policyCR, c.commoncol.Secrets, &outSpec); err != nil {
+	if err := constructHeaderModifiers(krtctx, policyCR, c.refGrantSource(policyCR.Namespace), c.commoncol.Secrets, &outSpec); err != nil {
 		errors = append(errors, err)
 	}
 	// Construct request mirror specific IR
@@ -111,7 +147,7 @@ func (c *TrafficPolicyConstructor) ConstructIR(
 	}
 
 	// Construct API key auth specific IR
-	if err := constructAPIKeyAuth(krtctx, policyCR, c.commoncol, &outSpec); err != nil {
+	if err := constructAPIKeyAuth(krtctx, policyCR, c.refGrantSource(policyCR.Namespace), c.commoncol, &outSpec); err != nil {
 		errors = append(errors, err)
 	}
 
@@ -131,7 +167,7 @@ func (c *TrafficPolicyConstructor) ConstructIR(
 	// Construct stat prefix specific IR
 	constructStatPrefix(policyCR.Spec, &outSpec)
 	// Construct basic auth specific IR
-	if err := constructBasicAuth(krtctx, policyCR, &outSpec, c.commoncol.Secrets); err != nil {
+	if err := constructBasicAuth(krtctx, policyCR, c.refGrantSource(policyCR.Namespace), &outSpec, c.commoncol.Secrets); err != nil {
 		errors = append(errors, err)
 	}
 
@@ -151,16 +187,14 @@ func (c *TrafficPolicyConstructor) FetchGatewayExtension(krtctx krt.HandlerConte
 
 	// In Strict mode, cross-namespace ExtensionRef requires a ReferenceGrant.
 	if
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/header_modifiers.go` (modified, +1/-5)
```diff
@@ -9,7 +9,6 @@ import (
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/pluginutils"
-	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/krtcollections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 )
@@ -49,6 +48,7 @@ func (hm *headerModifiersIR) Validate() error {
 func constructHeaderModifiers(
 	krtctx krt.HandlerContext,
 	policy *kgateway.TrafficPolicy,
+	from krtcollections.From,
 	secrets *krtcollections.SecretIndex,
 	out *trafficPolicySpecIr,
 ) error {
@@ -57,10 +57,6 @@ func constructHeaderModifiers(
 	}
 
 	spec := policy.Spec.HeaderModifiers
-	from := krtcollections.From{
-		GroupKind: wellknown.TrafficPolicyGVK.GroupKind(),
-		Namespace: policy.Namespace,
-	}
 
 	p := &header_mutationv3.HeaderMutationPerRoute{
 		Mutations: &header_mutationv3.Mutations{},
```

---

### Incident Patch 4: `2d0490db` (2026-09-23)
**Commit Message**: fix(krtcollections): report the port when a backend ref misses on port only (#14706)

Signed-off-by: Bbn08 <atrancendentbeing@gmail.com>
Signed-off-by: omar <omar.hammami@solo.io>
Co-authored-by: Bbn08 <atrancendentbeing@gmail.com>

**File**: `pkg/kgateway/translator/gateway/gateway_translator_test.go` (modified, +13/-0)
```diff
@@ -297,6 +297,19 @@ func TestBasic(t *testing.T) {
 		})
 	})
 
+	t.Run("httproute with backend ref to an undefined port reports correctly", func(t *testing.T) {
+		test(t, translatorTestCase{
+			inputFiles: []string{"backends/backend-ref-port-not-found.yaml"},
+			outputFile: "backends/backend-ref-port-not-found.yaml",
+			gwNN: types.NamespacedName{
+				Namespace: "default",
+				Name:      "example-gateway",
+			},
+		}, func(s *apisettings.Settings) {
+			s.EnableIstioIntegration = true
+		})
+	})
+
 	t.Run("httproute with backend port error reports correctly", func(t *testing.T) {
 		test(t, translatorTestCase{
 			inputFiles: []string{"backends/backend-ref-port-error.yaml"},
```

**File**: `pkg/kgateway/translator/gateway/testutils/inputs/backends/backend-ref-port-not-found.yaml` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+apiVersion: gateway.networking.k8s.io/v1
+kind: Gateway
+metadata:
+  name: example-gateway
+spec:
+  gatewayClassName: example-gateway-class
+  listeners:
+  - name: http
+    protocol: HTTP
+    port: 80
+---
+# Service exists, but does not define port 8080.
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: service-wrong-port
+spec:
+  parentRefs:
+  - name: example-gateway
+  hostnames:
+  - "svc.example.com"
+  rules:
+  - backendRefs:
+    - name: example-svc
+      port: 8080
+---
+# ServiceEntry exists, but does not define port 8080.
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: serviceentry-wrong-port
+spec:
+  parentRefs:
+  - name: example-gateway
+  hostnames:
+  - "se.example.com"
+  rules:
+  - backendRefs:
+    - name: example-se
+      kind: ServiceEntry
+      group: networking.istio.io
+      port: 8080
+---
+# Hostname resolves through the ServiceEntry's alias, but port 8080 is not defined.
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: hostname-wrong-port
+spec:
+  parentRefs:
+  - name: example-gateway
+  hostnames:
+  - "hostname.example.com"
+  rules:
+  - backendRefs:
+    - name: se.example.internal
+      kind: Hostname
+      group: networking.istio.io
+      port: 8080
+---
+apiVersion: v1
+kind: Service
+metadata:
+  name: example-svc
+spec:
+  selector:
+    app: example
+  ports:
+  - protocol: TCP
+    port: 80
+    targetPort: 8080
+---
+apiVersion: networking.istio.io/v1
+kind: ServiceEntry
+metadata:
+  name: example-se
+spec:
+  hosts:
+  - se.example.internal
+  ports:
+  - number: 80
+    name: http
+    protocol: HTTP
+  resolution: DNS
+  location: MESH_EXTERNAL
```

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/backends/backend-ref-port-not-found.yaml` (added, +208/-0)
```diff
@@ -0,0 +1,208 @@
+Clusters:
+- clusterType:
+    name: envoy.clusters.dns
+    typedConfig:
+      '@type': type.googleapis.com/envoy.extensions.clusters.dns.v3.DnsCluster
+      dnsLookupFamily: V4_PREFERRED
+  connectTimeout: 5s
+  loadAssignment:
+    clusterName: istio-se_default_example-se_se.example.internal_80
+    endpoints:
+    - lbEndpoints:
+      - endpoint:
+          address:
+            socketAddress:
+              address: se.example.internal
+              portValue: 80
+      loadBalancingWeight: 1
+  name: istio-se_default_example-se_se.example.internal_80
+- commonLbConfig:
+    localityWeightedLbConfig: {}
+  connectTimeout: 5s
+  edsClusterConfig:
+    edsConfig:
+      ads: {}
+      resourceApiVersion: V3
+  ignoreHealthOnHostRemoval: true
+  name: kube_default_example-svc_80
+  type: EDS
+- connectTimeout: 5s
+  name: test-backend-plugin_default_example-svc_80
+Listeners:
+- address:
+    socketAddress:
+      address: '::'
+      ipv4Compat: true
+      portValue: 80
+  filterChains:
+  - filters:
+    - name: envoy.filters.network.http_connection_manager
+      typedConfig:
+        '@type': type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
+        httpFilters:
+        - name: envoy.filters.http.router
+          typedConfig:
+            '@type': type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
+        mergeSlashes: true
+        normalizePath: true
+        rds:
+          configSource:
+            ads: {}
+            resourceApiVersion: V3
+          routeConfigName: listener~80
+        statPrefix: http
+        useRemoteAddress: true
+    name: listener~80
+  name: listener~80
+Routes:
+- ignorePortInHostMatching: true
+  name: listener~80
+  virtualHosts:
+  - domains:
+    - hostname.example.com
+    name: listener~80~hostname_example_com
+    routes:
+    - match:
+        prefix: /
+      name: listener~80~hostname_example_com-route-0-httproute-hostname-wrong-port-default-0-0-matcher-0
+      route:
+        cluster: blackhole-cluster
+        clusterNotFoundResponseCode: INTERNAL_SERVER_ERROR
+  - domains:
+    - se.example.com
+    name: listener~80~se_example_com
+    routes:
+    - match:
+        prefix: /
+      name: listener~80~se_example_com-route-0-httproute-serviceentry-wrong-port-default-0-0-matcher-0
+      route:
+        cluster: blackhole-cluster
+        clusterNotFoundResponseCode: INTERNAL_SERVER_ERROR
+  - domains:
+    - svc.example.com
+    name: listener~80~svc_example_com
+    routes:
+    - match:
+        prefix: /
+      name: listener~80~svc_example_com-route-0-httproute-service-wrong-port-default-0-0-matcher-0
+      route:
+        cluster: blackhole-cluster
+        clusterNotFoundResponseCode: INTERNAL_SERVER_ERROR
+Statuses:
+  gateways:
+    default/example-gateway:
+      conditions:
+      - lastTransitionTime: null
+        message: Successfully accepted Gateway
+        reason: Accepted
+        status: "True"
+        type: Accepted
+      - lastTransitionTime: null
+        message: Successfully programmed Gateway
+        reason: Programmed
+        status: "True"
+        type: Programmed
+      - lastTransitionTime: null
+        message: Successfully resolved all Gateway references
+        reason: ResolvedRefs
+        status: "True"
+        type: ResolvedRefs
+      listeners:
+      - attachedRoutes: 3
+        conditions:
+        - lastTransitionTime: null
+          message: Successfully accepted Listener
+          reason: Accepted
+          status: "True"
+          type: Accepted
+        - lastTransitionTime: null
+          message: Successfully verified that Listener has no conflicts
+          reason: NoConflicts
+          status: "False"
+          type: Conflicted
+        - lastTransitionTime: null
+          message: Successfully resolved all references
+          reason: ResolvedRefs
+          status: "True"
+          type: ResolvedRefs
+        - 
```

**File**: `pkg/krtcollections/backend_port_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+package krtcollections
+
+import (
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+	"istio.io/istio/pkg/kube/krt"
+	"istio.io/istio/pkg/kube/krt/krttest"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
+	gwv1b1 "sigs.k8s.io/gateway-api/apis/v1beta1"
+
+	apisettings "github.com/kgateway-dev/kgateway/v2/api/settings"
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
+	sdk "github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk"
+	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
+	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/krtutil"
+)
+
+// serviceEntryLikeBackends mimics the ServiceEntry plugin: one backend per port,
+// keyed with the hostname as extraKey so it only resolves through the alias index.
+func serviceEntryLikeBackends(services krt.Collection[*corev1.Service]) krt.Collection[ir.BackendObjectIR] {
+	return krt.NewManyCollection(services, func(kctx krt.HandlerContext, svc *corev1.Service) []ir.BackendObjectIR {
+		objSrc := ir.ObjectSource{
+			Group:     wellknown.ServiceEntryGVK.Group,
+			Kind:      wellknown.ServiceEntryGVK.Kind,
+			Namespace: svc.Namespace,
+			Name:      svc.Name,
+		}
+		hostname := svc.Name + ".example.com"
+		out := make([]ir.BackendObjectIR, 0, len(svc.Spec.Ports))
+		for _, port := range svc.Spec.Ports {
+			backend := ir.NewBackendObjectIR(objSrc, port.Port, hostname, "")
+			backend.Obj = svc
+			backend.Aliases = []ir.ObjectSource{
+				objSrc,
+				{
+					Group:     wellknown.HostnameGVK.Group,
+					Kind:      wellknown.HostnameGVK.Kind,
+					Namespace: "",
+					Name:      hostname,
+				},
+			}
+			out = append(out, backend)
+		}
+		return out
+	})
+}
+
+// newPortTestBackendIndex serves default/foo:8080 as both a Service and a
+// ServiceEntry-like backend.
+func newPortTestBackendIndex(t *testing.T) *BackendIndex {
+	t.Helper()
+
+	svc := &corev1.Service{
+		ObjectMeta: metav1.ObjectMeta{Name: "foo", Namespace: "default"},
+		Spec: corev1.ServiceSpec{
+			Ports: []corev1.ServicePort{{Port: 8080}},
+		},
+	}
+
+	mock := krttest.NewMock(t, []any{svc})
+	services := krttest.GetMockCollection[*corev1.Service](mock)
+	policyCol := krttest.GetMockCollection[ir.PolicyWrapper](mock)
+	policies := NewPolicyIndex(krtutil.KrtOptions{}, sdk.ContributesPolicies{}, apisettings.Settings{})
+	refgrants := NewRefGrantIndex(krttest.GetMockCollection[*gwv1b1.ReferenceGrant](mock), apisettings.ReferenceGrantPermissive)
+
+	backends := NewBackendIndex(krtutil.KrtOptions{}, policies, refgrants)
+	backends.AddBackends(svcGk, k8sSvcUpstreams(services))
+	backends.AddBackends(
+		wellknown.ServiceEntryGVK.GroupKind(),
+		serviceEntryLikeBackends(services),
+		wellknown.HostnameGVK.GroupKind(),
+		wellknown.ServiceEntryGVK.GroupKind(),
+	)
+
+	services.WaitUntilSynced(nil)
+	policyCol.WaitUntilSynced(nil)
+	for !backends.HasSynced() {
+		time.Sleep(time.Second / 10)
+	}
+	return backends
+}
+
+func TestGetBackendFromRefPortErrors(t *testing.T) {
+	backends := newPortTestBackendIndex(t)
+	src := ir.ObjectSource{
+		Group:     gwv1.GroupVersion.Group,
+		Kind:      "HTTPRoute",
+		Namespace: "default",
+		Name:      "route",
+	}
+
+	group := func(g string) *gwv1.Group { gg := gwv1.Group(g); return &gg }
+	kind := func(k string) *gwv1.Kind { kk := gwv1.Kind(k); return &kk }
+	port := func(p int32) *gwv1.PortNumber { pp := gwv1.PortNumber(p); return &pp }
+
+	cases := []struct {
+		name    string
+		ref     gwv1.BackendObjectReference
+		wantErr string
+	}{
+		{
+			// direct krt-key lookup on a core Service
+			name:    "service wrong port",
+			ref:     gwv1.BackendObjectReference{Name: "foo", Port: port(9090)},
+			wantErr: "Service default/foo found, but port 9090 not defined",
+		},
+		{
+			name:    "service missing",
+			ref:     gwv1.BackendObjectReference{Name: "nope", Port: port(9090)},
+			wantErr: "Service default/nope not found",
+		},
+		{
+			// no port in the ref: mu
```

**File**: `pkg/krtcollections/policy.go` (modified, +78/-14)
```diff
@@ -71,6 +71,19 @@ func (e *UnsupportedRouteKindError) Error() string {
 		e.Backend.Kind, e.Backend.Namespace, e.Backend.Name, e.RouteKind.Kind, strings.Join(supported, ", "))
 }
 
+// BackendPortNotFoundError is returned instead of NotFoundError when the referenced
+// backend exists but does not define the referenced port.
+type BackendPortNotFoundError struct {
+	// Named `PortNotFound` so it is easy to find in a krt dump, like NotFoundError.
+	PortNotFoundObj ir.ObjectSource
+	Port            int32
+}
+
+func (e *BackendPortNotFoundError) Error() string {
+	return e.PortNotFoundObj.Kind + " " + e.PortNotFoundObj.Namespace + "/" + e.PortNotFoundObj.Name +
+		" found, but port " + strconv.Itoa(int(e.Port)) + " not defined"
+}
+
 type BackendPortNotAllowedError struct {
 	BackendName string
 }
@@ -91,6 +104,9 @@ type BackendIndex struct {
 	availableBackendsWithPolicyByGK map[schema.GroupKind]krt.Collection[*ir.BackendObjectIR]
 	// aliasIndexWithPolicy indexes the policy-attached backends for a given GK by alias.
 	aliasIndexWithPolicy map[schema.GroupKind]krt.Index[backendKey, *ir.BackendObjectIR]
+	// nameIndexWithPolicy indexes the policy-attached backends for a given GK by object
+	// source and aliases, without port. Only consulted after a port-exact lookup misses.
+	nameIndexWithPolicy map[schema.GroupKind]krt.Index[ir.ObjectSource, *ir.BackendObjectIR]
 
 	// availableBackendsWithPolicy stores the policy-attached backend collections.
 	// BackendsWithPolicy is the public interface to access this.
@@ -127,6 +143,7 @@ func NewBackendIndex(
 		refgrants:                       refgrants,
 		availableBackendsWithPolicyByGK: map[schema.GroupKind]krt.Collection[*ir.BackendObjectIR]{},
 		aliasIndexWithPolicy:            map[schema.GroupKind]krt.Index[backendKey, *ir.BackendObjectIR]{},
+		nameIndexWithPolicy:             map[schema.GroupKind]krt.Index[ir.ObjectSource, *ir.BackendObjectIR]{},
 		gkAliases:                       map[schema.GroupKind][]schema.GroupKind{},
 		krtopts:                         krtopts,
 	}
@@ -249,8 +266,17 @@ func (i *BackendIndex) AddBackends(gk schema.GroupKind, col krt.Collection[ir.Ba
 		}
 		return aliasKeys
 	})
+	nameIdxWithPolicy := krtpkg.UnnamedIndex(backendsWithPoliciesCol, func(backendObj *ir.BackendObjectIR) []ir.ObjectSource {
+		if backendObj == nil {
+			return nil
+		}
+		keys := make([]ir.ObjectSource, 0, 1+len(backendObj.Aliases))
+		keys = append(keys, backendObj.GetObjectSource())
+		return append(keys, backendObj.Aliases...)
+	})
 	i.availableBackendsWithPolicyByGK[gk] = backendsWithPoliciesCol
 	i.aliasIndexWithPolicy[gk] = idxWithPolicy
+	i.nameIndexWithPolicy[gk] = nameIdxWithPolicy
 	i.availableBackendsWithPolicy = append(i.availableBackendsWithPolicy, backendsWithPoliciesCol)
 	i.backendsRequiringPolicyStatus = append(i.backendsRequiringPolicyStatus, backendsRequiringPolicyStatus)
 
@@ -310,25 +336,63 @@ func (i *BackendIndex) getBackend(kctx krt.HandlerContext, gk schema.GroupKind,
 	}
 
 	col := i.availableBackendsWithPolicyByGK[gk]
-	if col == nil {
-		return i.getBackendFromAlias(kctx, gk, n, port)
+	if col != nil {
+		if up := krt.FetchOne(kctx, col, krt.FilterKey(ir.BackendResourceName(key, port, ""))); up != nil {
+			return *up, nil
+		}
 	}
 
-	up := krt.FetchOne(kctx, col, krt.FilterKey(ir.BackendResourceName(key, port, "")))
-	if up == nil {
-		var (
-			err     error
-			aliasUp *ir.BackendObjectIR
-		)
-		if aliasUp, err = i.getBackendFromAlias(kctx, gk, n, port); err != nil {
-			// getBackendFromAlias returns ErrUnknownBackendKind when there are no aliases
-			// so return our own NotFoundError here
-			return nil, &NotFoundError{NotFoundObj: key}
-		}
+	aliasUp, err := i.getBackendFromAlias(kctx, gk, n, port)
+	if err == nil {
 		return aliasUp, nil
 	}
+	if col == nil && errors.Is(err, ErrUnknownBackendKind) {
+		// no collection and no aliases: nothing serves this kind at all
+		return nil, err
+	}
+	// getBackendFromAlias reports on the alias key, so
```

---

### Incident Patch 5: `e506cf82` (2026-09-22)
**Commit Message**: fix(backendtlspolicy): report status against the policy's targets (#14659)

Signed-off-by: omar <omar.hammami@solo.io>

**File**: `pkg/kgateway/extensions2/plugins/backendtlspolicy/plugin.go` (modified, +0/-1)
```diff
@@ -136,7 +136,6 @@ func NewPlugin(ctx context.Context, commoncol *collections.CommonCollections) sd
 					// kgateway Valid/Pending vocabulary the standard grading expects.
 					pluginutils.NoConditionErrorMetric,
 				),
-				PolicyStatusFromGatewayReports: true,
 			},
 		},
 	}
```

**File**: `pkg/kgateway/extensions2/plugins/backendtlspolicy/status.go` (modified, +39/-0)
```diff
@@ -8,13 +8,21 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/reports"
 )
 
 // BuildDesiredPolicyStatus builds the controller-owned portion of a BackendTLSPolicy's
 // desired status from its typed report fragment, preserving LastTransitionTime for unchanged
 // conditions. The status writer preserves other controllers' ancestors and enforces the
 // Gateway API ancestor limit when it merges this desired status with the live object.
+//
+// Target ancestors are a fallback. The per-backend status path reports every policy against
+// the target it attaches to, so that a policy no route references still gets a status; see
+// reportBackendTLSPolicies. Once route translation reports a Gateway ancestor, that Gateway
+// is the ancestor the Gateway API expects and the one existing tooling reads, so the target
+// ancestors are dropped rather than listed beside it. A routed policy therefore reports
+// exactly the ancestors it reported before target ancestors existed.
 func BuildDesiredPolicyStatus(report *reports.PolicyReport, pol *gwv1.BackendTLSPolicy, controller string) *gwv1.PolicyStatus {
 	currentStatus := pol.Status
 	if report == nil {
@@ -25,7 +33,23 @@ func BuildDesiredPolicyStatus(report *reports.PolicyReport, pol *gwv1.BackendTLS
 		Ancestors: make([]gwv1.PolicyAncestorStatus, 0, len(report.Ancestors)),
 	}
 
+	// Suppression is per policy, not per target: a Gateway ancestor records only the parent
+	// it came from, never which targetRef earned it, so there is no way here to tell a
+	// routed target apart from an unrouted one on a policy that has both. A policy mixing
+	// routed and unrouted targets reports only its Gateway ancestors.
+	hasGatewayAncestor := false
+	for parentKey := range report.Ancestors {
+		if isGatewayAncestor(parentKey) {
+			hasGatewayAncestor = true
+			break
+		}
+	}
+
 	for parentKey, ancestorReport := range report.Ancestors {
+		if hasGatewayAncestor && !isGatewayAncestor(parentKey) {
+			continue
+		}
+
 		ancestorRef := gwv1.ParentReference{
 			Group:     new(gwv1.Group(parentKey.Group)),
 			Kind:      new(gwv1.Kind(parentKey.Kind)),
@@ -73,3 +97,18 @@ func BuildDesiredPolicyStatus(report *reports.PolicyReport, pol *gwv1.BackendTLS
 
 	return &status
 }
+
+// isGatewayAncestor reports whether an ancestor names a Gateway-side parent: the Gateway
+// itself, or the XListenerSet that contributed the listener a route attached to. Those are
+// the ancestors route translation reports. Every other ancestor in a BackendTLSPolicy's
+// report is a target ancestor from the per-backend status path.
+func isGatewayAncestor(key reports.ParentRefKey) bool {
+	switch {
+	case key.Group == wellknown.GatewayGroup && key.Kind == wellknown.GatewayKind:
+		return true
+	case key.Group == wellknown.XListenerSetGroup && key.Kind == wellknown.XListenerSetKind:
+		return true
+	default:
+		return false
+	}
+}
```

**File**: `pkg/kgateway/extensions2/plugins/backendtlspolicy/status_test.go` (modified, +73/-0)
```diff
@@ -8,6 +8,7 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 	pluginreporter "github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/reporter"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/statussync"
@@ -185,6 +186,78 @@ func TestBuildDesiredPolicyStatusLeavesAncestorCapToWriter(t *testing.T) {
 	require.Len(t, merged, reports.MaxPolicyStatusAncestors)
 }
 
+func TestBuildDesiredPolicyStatusSuppressesTargetAncestors(t *testing.T) {
+	key := pluginreporter.PolicyKey{
+		Group:     gwv1.GroupVersion.Group,
+		Kind:      "BackendTLSPolicy",
+		Namespace: "default",
+		Name:      "tls-policy",
+	}
+	ref := func(group, kind, name string) gwv1.ParentReference {
+		return gwv1.ParentReference{
+			Group:     new(gwv1.Group(group)),
+			Kind:      new(gwv1.Kind(kind)),
+			Namespace: new(gwv1.Namespace("default")),
+			Name:      gwv1.ObjectName(name),
+		}
+	}
+	serviceRef := ref("", wellknown.ServiceKind, "svc")
+	backendRef := ref(wellknown.BackendGVK.Group, wellknown.BackendGVK.Kind, "oauth-backend")
+	gatewayRef := ref(wellknown.GatewayGroup, wellknown.GatewayKind, "gw")
+	listenerSetRef := ref(wellknown.XListenerSetGroup, wellknown.XListenerSetKind, "ls")
+
+	build := func(t *testing.T, refs ...gwv1.ParentReference) []gwv1.PolicyAncestorStatus {
+		t.Helper()
+		rm := reports.NewReportMap()
+		policyReporter := reports.NewReporter(&rm).Policy(key, 1)
+		for _, r := range refs {
+			ancestorReporter := policyReporter.AncestorRef(r)
+			for _, condition := range BuildPolicyConditions(newTestPolicyAtt("tls-policy", time.Unix(10, 0)), nil) {
+				ancestorReporter.SetCondition(condition)
+			}
+		}
+		status := BuildDesiredPolicyStatus(rm.PolicyReport(key), &gwv1.BackendTLSPolicy{
+			ObjectMeta: metav1.ObjectMeta{Namespace: key.Namespace, Name: key.Name},
+		}, "kgateway.dev/kgateway")
+		require.NotNil(t, status)
+		return status.Ancestors
+	}
+	names := func(ancestors []gwv1.PolicyAncestorStatus) []string {
+		out := make([]string, 0, len(ancestors))
+		for _, a := range ancestors {
+			out = append(out, string(*a.AncestorRef.Kind)+"/"+string(a.AncestorRef.Name))
+		}
+		return out
+	}
+
+	t.Run("target ancestors are the whole status when no route reaches the target", func(t *testing.T) {
+		got := build(t, serviceRef, backendRef)
+		require.ElementsMatch(t, []string{"Service/svc", "Backend/oauth-backend"}, names(got),
+			"an unrouted policy should report every target it attaches to")
+	})
+
+	t.Run("a Gateway ancestor suppresses target ancestors", func(t *testing.T) {
+		got := build(t, serviceRef, gatewayRef)
+		require.Equal(t, []string{"Gateway/gw"}, names(got),
+			"a routed policy should report the same ancestors it reported before target ancestors existed")
+	})
+
+	t.Run("an XListenerSet ancestor suppresses target ancestors", func(t *testing.T) {
+		got := build(t, serviceRef, listenerSetRef)
+		require.Equal(t, []string{"XListenerSet/ls"}, names(got),
+			"a route attached through a listener set reports the listener set, not the target")
+	})
+
+	t.Run("suppression is per policy, not per target", func(t *testing.T) {
+		// backendRef is unrouted, but serviceRef is routed and earns the Gateway ancestor.
+		// Nothing in the report says which targetRef the Gateway ancestor came from, so the
+		// unrouted target loses its ancestor too. Known gap: a policy mixing routed and
+		// unrouted targets reports only its Gateway ancestors.
+		got := build(t, serviceRef, backendRef, gatewayRef)
+		require.Equal(t, []string{"Gateway/gw"}, names(got))
+	})
+}
+
 func newTestPolicyAtt(name string, created time.Time) ir.PolicyAtt {
 	return ir.PolicyAtt{
 		Generation: 1,
```

**File**: `pkg/kgateway/proxy_syncer/proxy_syncer.go` (modified, +1/-12)
```diff
@@ -289,18 +289,7 @@ func (s *ProxySyncer) Init(ctx context.Context, krtopts krtutil.KrtOptions) {
 		localClusterEpPerClient,
 	)
 
-	excludedPolicyKinds := make(map[schema.GroupKind]struct{})
-	for gk, plugin := range s.plugins.ContributesPolicies {
-		if plugin.PolicyStatusFromGatewayReports {
-			excludedPolicyKinds[gk] = struct{}{}
-		}
-	}
-
-	backendPolicyContributions := backendPolicyStatusContributions(
-		finalBackendsWithPolicyStatus,
-		excludedPolicyKinds,
-		krtopts,
-	)
+	backendPolicyContributions := backendPolicyStatusContributions(finalBackendsWithPolicyStatus, krtopts)
 
 	// Backend status is reduced per Backend. Indexed cluster and plugin-condition
 	// dependencies ensure one client's error only recomputes its owning Backend.
```

**File**: `pkg/kgateway/proxy_syncer/status.go` (modified, +63/-12)
```diff
@@ -5,13 +5,13 @@ import (
 	"slices"
 
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/shared"
 	backendconfigpolicyplugin "github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/plugins/backendconfigpolicy"
+	backendtlspolicyplugin "github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/plugins/backendtlspolicy"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/pluginutils"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
@@ -28,21 +28,34 @@ var _ ObjWithAttachedPolicies = ir.BackendObjectIR{}
 
 // GenerateBackendPolicyReport generates a report map for all policies attached to the given backends.
 // Exported for testing.
-func GenerateBackendPolicyReport(in []*ir.BackendObjectIR, excludedPolicyKinds map[schema.GroupKind]struct{}) reports.ReportMap {
+func GenerateBackendPolicyReport(in []*ir.BackendObjectIR) reports.ReportMap {
 	merged := reports.NewPolicyReportMap()
 	reporter := reports.NewReporter(&merged)
 
 	// iterate all backends and aggregate all policies attached to them
 	// we track each attachment point of the policy to be tracked as an
 	// ancestor for reporting status
+	bcpGK := wellknown.BackendConfigPolicyGVK.GroupKind()
+	btpGK := wellknown.BackendTLSPolicyGVK.GroupKind()
 	for _, obj := range in {
 		conflictingBTP := winningBackendTLSPolicyRef(obj.GetAttachedPolicies())
-		bcpGK := wellknown.BackendConfigPolicyGVK.GroupKind()
+		targetRef := backendAncestorRef(obj.GetObjectSource())
+
+		// BackendTLSPolicy speaks the Gateway API's own condition vocabulary
+		// (Accepted/ResolvedRefs/Conflicted) rather than kgateway's Valid/Attached, and
+		// resolves conflicts the way translation does. The target ancestor reported here is a
+		// fallback: it is the only status an unrouted target, or a Backend used solely by a
+		// GatewayExtension, ever gets. It is reported unconditionally because this collection
+		// cannot see whether a route reaches the target — that is knowable only once both
+		// contribution sources have been reduced, so BuildDesiredPolicyStatus drops these
+		// again for any policy that also has a Gateway ancestor.
+		reportBackendTLSPolicies(reporter, targetRef, obj.GetAttachedPolicies().Policies[btpGK])
+
 		for gk, polAtts := range obj.GetAttachedPolicies().Policies {
+			if gk == btpGK {
+				continue
+			}
 			for _, polAtt := range polAtts {
-				if _, excluded := excludedPolicyKinds[polAtt.GroupKind]; excluded {
-					continue
-				}
 				if polAtt.PolicyRef == nil {
 					// the policyRef may be nil in the case of virtual plugins (e.g. istio settings)
 					// since there's no real policy object, we don't need to generate status for it
@@ -55,12 +68,7 @@ func GenerateBackendPolicyReport(in []*ir.BackendObjectIR, excludedPolicyKinds m
 					Namespace: polAtt.PolicyRef.Namespace,
 					Name:      polAtt.PolicyRef.Name,
 				}
-				ancestorRef := gwv1.ParentReference{
-					Group:     new(gwv1.Group(obj.GetObjectSource().Group)),
-					Kind:      new(gwv1.Kind(obj.GetObjectSource().Kind)),
-					Namespace: new(gwv1.Namespace(obj.GetObjectSource().Namespace)),
-					Name:      gwv1.ObjectName(obj.GetObjectSource().Name),
-				}
+				ancestorRef := targetRef
 				if polAtt.PolicyRef.SectionName != "" {
 					ancestorRef.SectionName = new(gwv1.SectionName(polAtt.PolicyRef.SectionName))
 				}
@@ -100,6 +108,49 @@ func GenerateBackendPolicyReport(in []*ir.BackendObjectIR, excludedPolicyKinds m
 	return merged
 }
 
+// backendAncestorRef returns the ancestor ref for a policy attached to a backend: the
+// target object itself. Callers add a sectionName for port-specific attachments.
+func backendAncestorRef(src ir.ObjectSource) gwv1.ParentReference {
+	return gwv
```

---

### Incident Patch 6: `ef23f159` (2026-09-21)
**Commit Message**: fix: correct xDS benchmark validation quoting and artifact upload aut… (#14740)

Signed-off-by: David L. Chandler <david.chandler@solo.io>
Co-authored-by: copilot-swe-agent[bot] <198982749+Copilot@users.noreply.github.com>

**File**: `.github/actions/upload-artifact/action.yaml` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ runs:
     - name: Get Job ID from GH API
       shell: bash
       id: get-job-id
+      env:
+        GH_TOKEN: ${{ github.token }}
       run: |
         jobs=$(gh api repos/${{ github.repository }}/actions/runs/${{ github.run_id}}/attempts/${{ github.run_attempt }}/jobs)
         job_len=$(echo $jobs | jq -r '[.jobs[] | select(.runner_name=="${{ runner.name }}")] | length')
```

**File**: `.github/workflows/release.yaml` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ env:
   CGO_ENABLED: '0'
 
 permissions:
+  actions: read
   contents: write
   packages: write
 
```

**File**: `Makefile` (modified, +12/-12)
```diff
@@ -1323,18 +1323,18 @@ run-xds-bench-ci: ## Run bounded xDS benchmarks and validate their results (exis
 .PHONY: validate-xds-bench-ci-results
 validate-xds-bench-ci-results: ## Check benchmark completion and fleet failure verdicts
 	@jq -es --arg suite "$(XDS_BENCH_SUITE)" \
-		'if $$suite == "cost" then \
-			([.[] | select(.event == "xds_cost_result") | .data.phase] | sort) == ["BaseChurn","EdsChurn","Reconnect"] \
-			and all(.[] | select(.event == "xds_cost_result"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
-			and any(.[]; .event == "xds_cost_summary" and (.data.phases | length) == 3) \
-		elif $$suite == "fleet" then \
-			all(.[]; .event != "xds_fleet_verdict") \
-			and ([.[] | select(.event == "xds_fleet_wave")] | length) == 4 \
-			and all(.[] | select(.event == "xds_fleet_wave"); .data.served == true and .data.settled == true) \
-			and any(.[]; .event == "xds_fleet_wave" and .data.gateways == 24 and .data.clients == 24) \
-			and ([.[] | select(.event == "xds_fleet_result") | .data.phase] | sort) == ["BaseChurn","EdsChurn","StreamReconnect"] \
-			and all(.[] | select(.event == "xds_fleet_result"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
-		else false end' "$(XDS_BENCH_OUTPUT_DIR)/$(XDS_BENCH_SUITE).jsonl"
+		"if \$$suite == \"cost\" then \
+			([.[] | select(.event == \"xds_cost_result\") | .data.phase] | sort) == [\"BaseChurn\",\"EdsChurn\",\"Reconnect\"] \
+			and all(.[] | select(.event == \"xds_cost_result\"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
+			and any(.[]; .event == \"xds_cost_summary\" and (.data.phases | length) == 3) \
+		elif \$$suite == \"fleet\" then \
+			all(.[]; .event != \"xds_fleet_verdict\") \
+			and ([.[] | select(.event == \"xds_fleet_wave\")] | length) == 4 \
+			and all(.[] | select(.event == \"xds_fleet_wave\"); .data.served == true and .data.settled == true) \
+			and any(.[]; .event == \"xds_fleet_wave\" and .data.gateways == 24 and .data.clients == 24) \
+			and ([.[] | select(.event == \"xds_fleet_result\") | .data.phase] | sort) == [\"BaseChurn\",\"EdsChurn\",\"StreamReconnect\"] \
+			and all(.[] | select(.event == \"xds_fleet_result\"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
+		else false end" "$(XDS_BENCH_OUTPUT_DIR)/$(XDS_BENCH_SUITE).jsonl"
 
 #----------------------------------------------------------------------------------
 # MARK: Conformance
```

---

### Incident Patch 7: `0191e720` (2026-09-18)
**Commit Message**: fix(aws): reject empty accessKey/secretKey in AWS Backend Secret (#14741)

Signed-off-by: omar <omar.hammami@solo.io>

**File**: `pkg/kgateway/extensions2/plugins/backend/aws.go` (modified, +31/-12)
```diff
@@ -376,23 +376,42 @@ type staticSecretDerivation struct {
 }
 
 // deriveStaticSecret derives the static secret from the given secret.
+//
+// Envoy's InlineCredentialProvider requires access_key_id and secret_access_key
+// to be non-empty (min_len: 1) and imposes no such constraint on session_token.
+// Enforcing the same rules here keeps a malformed Secret from producing a
+// cluster that Envoy rejects, which in the default validation mode discards the
+// entire CDS response. Returned errors name the Secret data key at fault and
+// never include the secret values themselves.
 func deriveStaticSecret(awsSecrets *ir.Secret) (*staticSecretDerivation, error) {
-	var errs []error
-	// validate that the secret has field in string format and has an access_key and secret_key
-	if awsSecrets.Data[wellknown.AccessKey] == nil || !utf8.Valid(awsSecrets.Data[wellknown.AccessKey]) {
-		// err is nil here but this is still safe
-		errs = append(errs, errors.New("access_key is not a valid string"))
-	}
-	if awsSecrets.Data[wellknown.SecretKey] == nil || !utf8.Valid(awsSecrets.Data[wellknown.SecretKey]) {
-		errs = append(errs, errors.New("secret_key is not a valid string"))
+	errs := []error{
+		validateSecretDataKey(awsSecrets.Data, wellknown.AccessKey, true),
+		validateSecretDataKey(awsSecrets.Data, wellknown.SecretKey, true),
+		validateSecretDataKey(awsSecrets.Data, wellknown.SessionToken, false),
 	}
-	// Session key is optional, but if it is present, it must be a valid string.
-	if awsSecrets.Data[wellknown.SessionToken] != nil && !utf8.Valid(awsSecrets.Data[wellknown.SessionToken]) {
-		errs = append(errs, errors.New("session_key is not a valid string"))
+	if err := errors.Join(errs...); err != nil {
+		return nil, err
 	}
 	return &staticSecretDerivation{
 		access:  string(awsSecrets.Data[wellknown.AccessKey]),
 		session: string(awsSecrets.Data[wellknown.SessionToken]),
 		secret:  string(awsSecrets.Data[wellknown.SecretKey]),
-	}, errors.Join(errs...)
+	}, nil
+}
+
+// validateSecretDataKey checks the value stored under key in a Secret's data.
+// A required key must be present, non-empty and valid UTF-8; an optional key
+// may be absent or empty but must be valid UTF-8 when set.
+func validateSecretDataKey(data map[string][]byte, key string, required bool) error {
+	value, ok := data[key]
+	if !ok || len(value) == 0 {
+		if required {
+			return fmt.Errorf("secret data key %q is missing or empty", key)
+		}
+		return nil
+	}
+	if !utf8.Valid(value) {
+		return fmt.Errorf("secret data key %q is not a valid UTF-8 string", key)
+	}
+	return nil
 }
```

**File**: `pkg/kgateway/extensions2/plugins/backend/aws_test.go` (modified, +98/-0)
```diff
@@ -1,6 +1,7 @@
 package backend
 
 import (
+	"strings"
 	"testing"
 
 	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
@@ -181,3 +182,100 @@ func newLambdaBackend(name, endpointURL string) *kgateway.Backend {
 		},
 	}
 }
+
+// TestDeriveStaticSecret pins the input validation that keeps a malformed
+// Secret from producing an InlineCredentialProvider Envoy rejects (its
+// access_key_id and secret_access_key carry min_len: 1). See issue #14736.
+func TestDeriveStaticSecret(t *testing.T) {
+	valid := func() map[string][]byte {
+		return map[string][]byte{
+			wellknown.AccessKey:    []byte("access"),
+			wellknown.SecretKey:    []byte("secret"),
+			wellknown.SessionToken: []byte("session"),
+		}
+	}
+	tests := []struct {
+		name     string
+		mutate   func(map[string][]byte)
+		wantErrs []string
+		want     *staticSecretDerivation
+	}{
+		{
+			name:   "all keys present",
+			mutate: func(map[string][]byte) {},
+			want:   &staticSecretDerivation{access: "access", secret: "secret", session: "session"},
+		},
+		{
+			name:   "session token absent is allowed",
+			mutate: func(d map[string][]byte) { delete(d, wellknown.SessionToken) },
+			want:   &staticSecretDerivation{access: "access", secret: "secret"},
+		},
+		{
+			name:   "session token empty is allowed",
+			mutate: func(d map[string][]byte) { d[wellknown.SessionToken] = []byte{} },
+			want:   &staticSecretDerivation{access: "access", secret: "secret"},
+		},
+		{
+			name:     "empty access key is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.AccessKey] = []byte("") },
+			wantErrs: []string{`secret data key "accessKey" is missing or empty`},
+		},
+		{
+			name:     "empty secret key is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.SecretKey] = []byte{} },
+			wantErrs: []string{`secret data key "secretKey" is missing or empty`},
+		},
+		{
+			name: "missing access and secret keys are both reported",
+			mutate: func(d map[string][]byte) {
+				delete(d, wellknown.AccessKey)
+				delete(d, wellknown.SecretKey)
+			},
+			wantErrs: []string{
+				`secret data key "accessKey" is missing or empty`,
+				`secret data key "secretKey" is missing or empty`,
+			},
+		},
+		{
+			name:     "invalid utf-8 access key is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.AccessKey] = []byte{0xff, 0xfe} },
+			wantErrs: []string{`secret data key "accessKey" is not a valid UTF-8 string`},
+		},
+		{
+			name:     "invalid utf-8 session token is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.SessionToken] = []byte{0xff} },
+			wantErrs: []string{`secret data key "sessionToken" is not a valid UTF-8 string`},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			data := valid()
+			tt.mutate(data)
+			got, err := deriveStaticSecret(&ir.Secret{Data: data})
+			if len(tt.wantErrs) == 0 {
+				require.NoError(t, err)
+				assert.Equal(t, tt.want, got)
+				return
+			}
+			require.Error(t, err)
+			assert.Nil(t, got, "no credentials should be returned alongside a validation error")
+			assert.Equal(t, tt.wantErrs, strings.Split(err.Error(), "\n"))
+		})
+	}
+}
+
+// TestConfigureAWSAuthSecretEmptyAccessKey covers the end-to-end path from
+// issue #14736: an empty accessKey must fail translation rather than be copied
+// into an InlineCredentialProvider that Envoy rejects.
+func TestConfigureAWSAuthSecretEmptyAccessKey(t *testing.T) {
+	secret := &ir.Secret{Data: map[string][]byte{
+		wellknown.AccessKey: []byte(""),
+		wellknown.SecretKey: []byte("secret"),
+	}}
+	auth := &kgateway.AwsAuth{
+		Type:      kgateway.AwsAuthTypeSecret,
+		SecretRef: &corev1.LocalObjectReference{Name: "aws-creds"},
+	}
+	_, err := configureAWSAuth(auth, secret, "us-east-1")
+	require.EqualError(t, err, `failed to derive static secret: secret data key "accessKey" is missing or empty`)
+}
```

**File**: `pkg/kgateway/extensions2/plugins/backend/ec2_test.go` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ func TestClassifyEc2DiscoveryError(t *testing.T) {
 	}{
 		{
 			name:       "credential error",
-			err:        &ec2CredentialError{err: errors.New("invalid aws secret: access_key is not a valid string")},
+			err:        &ec2CredentialError{err: errors.New(`invalid aws secret: secret data key "accessKey" is missing or empty`)},
 			wantReason: string(kgateway.BackendReasonCredentialError),
 		},
 		{
```

**File**: `test/e2e/features/backends/suite.go` (modified, +2/-2)
```diff
@@ -134,8 +134,8 @@ func (s *testingSuite) TestBackendWithRuntimeError() {
 		Type:   "Accepted",
 		Status: metav1.ConditionFalse,
 		Reason: "Invalid",
-		Message: `Backend error: "failed to create aws request signing config: failed to derive static secret: access_key is not a valid string
-secret_key is not a valid string"`,
+		Message: `Backend error: "failed to create aws request signing config: failed to derive static secret: secret data key "accessKey" is missing or empty
+secret data key "secretKey" is missing or empty"`,
 	})
 }
 
```

---

### Incident Patch 8: `e24f392f` (2026-09-14)
**Commit Message**: Test flakes and fixes (#14690)

Signed-off-by: Seth Heidkamp <seth.heidkamp@gmail.com>

**File**: `hack/setup-localstack.sh` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@ function install_localstack() {
   $HELM repo update
 
   $HELM upgrade -i --create-namespace localstack localstack-repo/localstack --version 0.6.26 --namespace localstack -f ${ROOT_DIR}/localstack-values.yaml
+  # `kubectl wait` fails immediately when no pod matches yet, so let the rollout create it first
+  kubectl rollout status deployment/localstack --namespace localstack --timeout=120s
   kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=localstack -n localstack --timeout=120s
 }
 
```

**File**: `pkg/utils/kubeutils/kubectl/cli.go` (modified, +35/-12)
```diff
@@ -440,33 +440,56 @@ func (c *Cli) GetContainerLogs(ctx context.Context, namespace string, name strin
 	return stdout + stderr, err
 }
 
-// GetPodsInNsWithLabel returns the pods in the specified namespace with the specified label
+// GetPodsInNsWithLabel returns the pods in the specified namespace with the specified label,
+// excluding pods that are terminating to avoid counting lingering pods from the last test
+// that are in the process of being deleted.
 func (c *Cli) GetPodsInNsWithLabel(ctx context.Context, namespace string, label string) ([]string, error) {
+	return c.getPodsInNsWithLabel(ctx, namespace, label, true)
+}
+
+// GetAllPodsInNsWithLabel is GetPodsInNsWithLabel including terminating pods.
+func (c *Cli) GetAllPodsInNsWithLabel(ctx context.Context, namespace string, label string) ([]string, error) {
+	return c.getPodsInNsWithLabel(ctx, namespace, label, false)
+}
+
+func (c *Cli) getPodsInNsWithLabel(ctx context.Context, namespace string, label string, excludeTerminating bool) ([]string, error) {
 	podStdOut := bytes.NewBuffer(nil)
 	podStdErr := bytes.NewBuffer(nil)
 
-	// Fetch the names of the pods with the given label
+	// deletionTimestamp renders as the empty string unless the pod is terminating
 	getPodNamesCmd := c.Command(ctx, "get", "pod", "-n", namespace,
-		"--selector", label, "--output", "jsonpath='{.items[*].metadata.name}'")
+		"--selector", label, "--output",
+		`jsonpath={range .items[*]}{.metadata.name}{"\t"}{.metadata.deletionTimestamp}{"\n"}{end}`)
 	err := getPodNamesCmd.WithStdout(podStdOut).WithStderr(podStdErr).Run().Cause()
 	if err != nil {
 		fmt.Printf("error running get pod names command: %v\n", err)
 	}
 
-	// Clean up and check the output
-	podNamesString := strings.Trim(podStdOut.String(), "'")
-	if podNamesString == "" {
-		if !c.quiet {
-			fmt.Printf("no %s pods found in namespace %s\n", label, namespace)
-		}
-		return []string{}, nil
+	podNames := selectPodNames(podStdOut.String(), excludeTerminating)
+	if len(podNames) == 0 && !c.quiet {
+		fmt.Printf("no %s pods found in namespace %s\n", label, namespace)
 	}
 
-	// Split the string on whitespace to get the pod names
-	podNames := strings.Fields(podNamesString)
 	return podNames, nil
 }
 
+// selectPodNames reads the "<name>\t<deletionTimestamp>" lines emitted by getPodsInNsWithLabel
+// and returns the names of the pods that should be reported.
+func selectPodNames(jsonpathOutput string, excludeTerminating bool) []string {
+	podNames := []string{}
+	for line := range strings.SplitSeq(jsonpathOutput, "\n") {
+		name, deletionTimestamp, _ := strings.Cut(strings.TrimSpace(line), "\t")
+		if name == "" {
+			continue
+		}
+		if excludeTerminating && deletionTimestamp != "" {
+			continue
+		}
+		podNames = append(podNames, name)
+	}
+	return podNames
+}
+
 func (c *Cli) GetLeaseHolder(ctx context.Context, namespace string, leaderElectionID string) (string, error) {
 	stdout, stderr, err := c.Execute(ctx, "get", "leases", "-n", namespace,
 		leaderElectionID, "--output", "jsonpath='{.spec.holderIdentity}'")
```

**File**: `pkg/utils/kubeutils/kubectl/cli_test.go` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+package kubectl
+
+import (
+	"slices"
+	"testing"
+)
+
+func TestSelectPodNames(t *testing.T) {
+	// a rollout reports both the outgoing (terminating) and incoming pod
+	const rollout = "gw-6b54c85cbf-x6v7s\t2026-09-11T05:23:30Z\ngw-74f7b79947-tfz48\t\n"
+
+	tests := []struct {
+		name               string
+		jsonpathOutput     string
+		excludeTerminating bool
+		expected           []string
+	}{
+		{
+			name:               "drops terminating pod during a rollout",
+			jsonpathOutput:     rollout,
+			excludeTerminating: true,
+			expected:           []string{"gw-74f7b79947-tfz48"},
+		},
+		{
+			name:               "keeps terminating pod when not excluding",
+			jsonpathOutput:     rollout,
+			excludeTerminating: false,
+			expected:           []string{"gw-6b54c85cbf-x6v7s", "gw-74f7b79947-tfz48"},
+		},
+		{
+			name:               "no pods matched the selector",
+			jsonpathOutput:     "",
+			excludeTerminating: true,
+			expected:           []string{},
+		},
+		{
+			name:               "every pod is terminating",
+			jsonpathOutput:     "gw-a\t2026-09-11T05:23:30Z\ngw-b\t2026-09-11T05:23:31Z\n",
+			excludeTerminating: true,
+			expected:           []string{},
+		},
+		{
+			name:               "several running pods are all returned",
+			jsonpathOutput:     "gw-a\t\ngw-b\t\ngw-c\t\n",
+			excludeTerminating: true,
+			expected:           []string{"gw-a", "gw-b", "gw-c"},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := selectPodNames(tt.jsonpathOutput, tt.excludeTerminating)
+			if !slices.Equal(got, tt.expected) {
+				t.Errorf("selectPodNames() = %v, want %v", got, tt.expected)
+			}
+		})
+	}
+}
```

**File**: `test/e2e/features/dfp/suite.go` (modified, +8/-1)
```diff
@@ -36,8 +36,15 @@ func NewTestingSuite(ctx context.Context, testInst *e2e.TestInstallation) suite.
 	setup := base.TestCase{
 		Manifests: []string{gatewayWithRouteManifest},
 	}
+	testCases := map[string]*base.TestCase{
+		"TestDynamicForwardProxyConnectTermination": {
+			Manifests: []string{connectTerminationManifest},
+			// the manifest attaches its TrafficPolicy by sectionName, which needs a named route rule
+			MinGwApiVersion: base.GwApiRequireRouteNames,
+		},
+	}
 	return &testingSuite{
-		BaseTestingSuite: base.NewBaseTestingSuite(ctx, testInst, setup, nil),
+		BaseTestingSuite: base.NewBaseTestingSuite(ctx, testInst, setup, testCases),
 	}
 }
 
```

**File**: `test/e2e/features/dfp/testdata/common.yaml` (modified, +1/-25)
```diff
@@ -17,31 +17,7 @@ spec:
     - name: gateway
       namespace: kgateway-base
   rules:
-    - name: connect
-      matches:
-        - method: CONNECT
-      backendRefs:
+    - backendRefs:
         - name: dfp-backend
           group: gateway.kgateway.dev
           kind: Backend
-    - name: http
-      backendRefs:
-        - name: dfp-backend
-          group: gateway.kgateway.dev
-          kind: Backend
----
-apiVersion: gateway.kgateway.dev/v1alpha1
-kind: TrafficPolicy
-metadata:
-  name: dfp-connect-termination
-  namespace: kgateway-base
-spec:
-  targetRefs:
-    - group: gateway.networking.k8s.io
-      kind: HTTPRoute
-      name: route-dfp
-      sectionName: connect
-  httpUpgrade:
-    - type: CONNECT
-      connect:
-        terminate: true
```

---

### Incident Patch 9: `e1bbcba7` (2026-09-12)
**Commit Message**: fix(deployer): merge gmsaCredentialSpecName from its own field (#14660)

Signed-off-by: Max Freedom Pollard <272618364+MaxFreedomPollard@users.noreply.github.com>

**File**: `pkg/deployer/merge.go` (modified, +1/-1)
```diff
@@ -203,7 +203,7 @@ func deepMergeWindowsSecurityContextOptions(dst, src *corev1.WindowsSecurityCont
 		return src
 	}
 
-	dst.GMSACredentialSpecName = MergePointers(dst.GMSACredentialSpec, src.GMSACredentialSpec)
+	dst.GMSACredentialSpecName = MergePointers(dst.GMSACredentialSpecName, src.GMSACredentialSpecName)
 	dst.GMSACredentialSpec = MergePointers(dst.GMSACredentialSpec, src.GMSACredentialSpec)
 	dst.RunAsUserName = MergePointers(dst.RunAsUserName, src.RunAsUserName)
 	dst.HostProcess = MergePointers(dst.HostProcess, src.HostProcess)
```

**File**: `pkg/deployer/merge_test.go` (modified, +68/-0)
```diff
@@ -607,3 +607,71 @@ func TestDeepMergeImage(t *testing.T) {
 		})
 	}
 }
+
+func TestDeepMergeSecurityContextWindowsOptions(t *testing.T) {
+	const gmsaSpec = `{"apiVersion":"windows.k8s.io/v1","kind":"GMSACredentialSpec"}`
+
+	tests := []struct {
+		name string
+		dst  *corev1.WindowsSecurityContextOptions
+		src  *corev1.WindowsSecurityContextOptions
+		want *corev1.WindowsSecurityContextOptions
+	}{
+		{
+			name: "src gmsaCredentialSpecName overrides dst",
+			dst: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("default-gmsa"),
+				RunAsUserName:          new("default-user"),
+			},
+			src: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+			},
+			want: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+				RunAsUserName:          new("default-user"),
+			},
+		},
+		{
+			name: "dst gmsaCredentialSpecName is kept when src does not set it",
+			dst: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("default-gmsa"),
+			},
+			src: &corev1.WindowsSecurityContextOptions{
+				RunAsUserName: new("override-user"),
+			},
+			want: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("default-gmsa"),
+				RunAsUserName:          new("override-user"),
+			},
+		},
+		{
+			name: "gmsaCredentialSpec does not leak into gmsaCredentialSpecName",
+			dst: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpec: new(gmsaSpec),
+			},
+			src: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+			},
+			want: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+				GMSACredentialSpec:     new(gmsaSpec),
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := DeepMergeSecurityContext(
+				&corev1.SecurityContext{WindowsOptions: tt.dst.DeepCopy()},
+				&corev1.SecurityContext{WindowsOptions: tt.src.DeepCopy()},
+			)
+			assert.Equal(t, tt.want, got.WindowsOptions, "container securityContext.windowsOptions")
+
+			gotPod := deepMergePodSecurityContext(
+				&corev1.PodSecurityContext{WindowsOptions: tt.dst.DeepCopy()},
+				&corev1.PodSecurityContext{WindowsOptions: tt.src.DeepCopy()},
+			)
+			assert.Equal(t, tt.want, gotPod.WindowsOptions, "pod securityContext.windowsOptions")
+		})
+	}
+}
```

---

### Incident Patch 10: `09e50467` (2026-09-11)
**Commit Message**: fix: re-derive xDS client identity per request (#14582)

Signed-off-by: David L. Chandler <david.chandler@solo.io>

**File**: `.github/workflows/e2e.yaml` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ jobs:
           # May 29, 2026: ~4 minutes
           - cluster-name: 'cluster-seven'
             go-test-args: '-timeout=25m'
-            go-test-run-regex: '^TestAPIValidation$$|^TestKgateway$$/^OAuth$$|^TestKgateway$$/^TrafficPolicyStatus$$|^TestKgateway$$/^XdsStarvation$$'
+            go-test-run-regex: '^TestAPIValidation$$|^TestKgateway$$/^OAuth$$|^TestKgateway$$/^TrafficPolicyStatus$$|^TestKgateway$$/^XdsStarvation$$|^TestKgateway$$/^XdsIdentityRace$$'
             localstack: 'false'
             ordered-ads: 'false'
           # May 29, 2026: ~5 minutes
```

**File**: `pkg/krtcollections/uniqueclients.go` (modified, +144/-43)
```diff
@@ -68,11 +68,20 @@ func xdsFirstConnectDelay() time.Duration {
 
 type ConnectedClient struct {
 	uniqueClientName string
+	// originalRole is the role as presented on the stream's FIRST request,
+	// before newStream rewrites the node metadata to the unique cache key.
+	// Follow-up SotW requests often omit Node, and go-control-plane then
+	// reuses the mutated Node object — so per-request identity re-derivation
+	// must start from this pinned role, never from the node's (possibly
+	// already-augmented) one, or augmentation compounds and every ACK looks
+	// like an identity change.
+	originalRole string
 }
 
-func newConnectedClient(uniqueClientName string) ConnectedClient {
+func newConnectedClient(uniqueClientName, originalRole string) ConnectedClient {
 	return ConnectedClient{
 		uniqueClientName: uniqueClientName,
+		originalRole:     originalRole,
 	}
 }
 
@@ -272,46 +281,145 @@ func NormalizeGatewayRole(originalRole, namespace string, labels map[string]stri
 	return xds.OwnerNamespaceNameID(wellknown.GatewayApiProxyValue, namespace, gwName)
 }
 
-func (x *callbacksCollection) add(sid int64, r *envoy_service_discovery_v3.DiscoveryRequest, peer peerInfo) (ucName string, newStream bool, err error) {
-	var pod *LocalityPod
+// deriveClientIdentity resolves the client's identity (role, namespace,
+// labels, locality) from the CURRENT pod state. The pod lookup is a
+// point-in-time read outside KRT dependency tracking — nothing re-runs this
+// when the pod changes — so callers must re-derive per request (see add) to
+// keep a stream's identity from being frozen on data that was stale at
+// connect time.
+func (x *callbacksCollection) deriveClientIdentity(r *envoy_service_discovery_v3.DiscoveryRequest, peer peerInfo) (*ir.UniquelyConnectedClient, error) {
+	var locality ir.PodLocality
+	var ns string
+	var labels map[string]string
 	// see if user wants to use pod locality info; this is only possible when podRef is set in getPeerInfo
 	if peer.podRef != nil {
 		k := krt.Named{Name: peer.podRef.Name, Namespace: peer.podRef.Namespace}.ResourceName()
-		pod = x.augmentedPods.GetKey(k)
+		pod := x.augmentedPods.GetKey(k)
+		if pod == nil {
+			// we need to use the pod locality info, so it's an error if we can't get the pod.
+			// Only the node id goes in the message: this error is constructed on
+			// every request while the pod is absent (and discarded on established
+			// streams), so formatting the full Node proto here would be pure waste.
+			return nil, fmt.Errorf("pod not found for node %q", r.GetNode().GetId())
+		}
+		locality = pod.Locality
+		ns = pod.Namespace
+		labels = pod.AugmentedLabels
+		peer.role = NormalizeGatewayRole(peer.role, ns, labels)
 	}
-	x.stateLock.Lock()
-	defer x.stateLock.Unlock()
+	ucc := ir.NewUniquelyConnectedClient(peer.role, ns, labels, locality)
+	return &ucc, nil
+}
+
+func (x *callbacksCollection) add(sid int64, r *envoy_service_discovery_v3.DiscoveryRequest, peer peerInfo) (ucName string, newStream bool, err error) {
+	// Identity is re-derived from current pod state on EVERY request, not just
+	// the first. A stream's first request can race the pod/node informers
+	// (controller start is exactly when every Envoy reconnects), freezing an
+	// identity built from stale or incomplete labels/locality — wrong
+	// DestinationRule selection and failover priorities for the stream's
+	// whole lifetime, with nothing to ever correct it short of an Envoy
+	// restart. The derivation is a map lookup plus a label hash, and stream
+	// requests are infrequent.
+	//
+	// deriveClientIdentity does an augmentedPods.GetKey lookup and a label
+	// hash (NewUniquelyConnectedClient), neither of which touches our shared
+	// maps — so it runs WITHOUT stateLock held. Keeping it inside the
+	// critical section would serialize every concurrent xDS stream behind one
+	// client's pod lookup. We hold the lock only to read the per-stream entry
+	// up front and to mutate the maps at the end. go-c
```

**File**: `pkg/krtcollections/uniqueclients_test.go` (modified, +292/-0)
```diff
@@ -414,6 +414,298 @@ func TestUniqueClientsLocalClusterCapabilityGatingSharedBucket(t *testing.T) {
 	}).Should(BeTrue(), "the remaining stream already confirmed support")
 }
 
+// A stream's identity is derived from pod data that can be stale at connect
+// time (informer lag during controller start — exactly when every Envoy
+// reconnects). The identity cannot be changed in place for an open stream
+// (the snapshot cache key is bound to it), so when the freshly derived
+// identity differs, the stream must be REJECTED so the client reconnects and
+// re-identifies against current state — instead of serving wrong
+// locality/label-derived config until an Envoy restart.
+// go-control-plane reuses the first request's Node object for follow-up SotW
+// requests that omit Node — including the role newStream rewrote in place to
+// the unique cache key. Follow-up identity re-derivation must start from the
+// stream's pinned original role: otherwise, for pods without a gateway-name
+// label (where NormalizeGatewayRole is a passthrough), the already-augmented
+// role re-augments into a different resource name and every ACK closes the
+// stream as a false identity change.
+func TestUniqueClientsFollowUpWithReusedAugmentedNode(t *testing.T) {
+	t.Cleanup(SetXdsFirstConnectDelayForTest(0))
+	g := NewWithT(t)
+	ctx := context.Background()
+
+	role := wellknown.GatewayApiProxyValue + "~best-proxy-role"
+	labels := map[string]string{"a": "b"} // deliberately no gateway-name label
+	driftedLabels := map[string]string{"a": "b", corev1.LabelTopologyZone: "zone-1"}
+
+	pods := krt.NewStaticCollection[LocalityPod](nil, []LocalityPod{{
+		Named:           krt.Named{Name: "podname", Namespace: "ns"},
+		AugmentedLabels: labels,
+	}})
+
+	cb, uccBuilder := NewUniquelyConnectedClients(nil, false)
+	ucc := uccBuilder(ctx, krtutil.KrtOptions{}, pods)
+	ucc.WaitUntilSynced(ctx.Done())
+
+	req := &envoy_service_discovery_v3.DiscoveryRequest{
+		Node: &envoycorev3.Node{
+			Id: "podname.ns",
+			Metadata: &structpb.Struct{
+				Fields: map[string]*structpb.Value{
+					xds.RoleKey: structpb.NewStringValue(role),
+				},
+			},
+		},
+	}
+	uniqueName := fmt.Sprintf("%s~%d~ns", role, utils.HashLabels(labels))
+
+	// The first request rewrites req's Node role in place to the unique key.
+	g.Expect(cb.OnStreamRequest(1, req)).To(Succeed())
+	g.Expect(req.GetNode().GetMetadata().GetFields()[xds.RoleKey].GetStringValue()).To(Equal(uniqueName),
+		"newStream must have augmented the node role in place")
+
+	// Follow-ups reuse the SAME mutated request object (as go-control-plane
+	// does). They must not read as identity changes.
+	for range 3 {
+		g.Expect(cb.OnStreamRequest(1, req)).To(Succeed(),
+			"an ACK carrying the reused augmented node must not close the stream")
+	}
+	g.Eventually(func() []ir.UniquelyConnectedClient { return ucc.List() }, "1s").Should(HaveLen(1))
+	g.Expect(ucc.List()[0].ResourceName()).To(Equal(uniqueName))
+
+	// Genuine pod-state drift must still be detected through the reused node.
+	pods.UpdateObject(LocalityPod{
+		Named:           krt.Named{Name: "podname", Namespace: "ns"},
+		AugmentedLabels: driftedLabels,
+	})
+	g.Expect(cb.OnStreamRequest(1, req)).To(MatchError(ContainSubstring("xds client identity changed")),
+		"real label drift must still close the stream even with a reused node")
+}
+
+func TestUniqueClientsReidentifyOnPodChange(t *testing.T) {
+	t.Cleanup(SetXdsFirstConnectDelayForTest(0))
+	g := NewWithT(t)
+	ctx := context.Background()
+
+	role := wellknown.GatewayApiProxyValue + "~best-proxy-role"
+	staleLabels := map[string]string{"a": "b"}
+	freshLabels := map[string]string{"a": "b", corev1.LabelTopologyZone: "zone-1"}
+
+	pods := krt.NewStaticCollection[LocalityPod](nil, []LocalityPod{{
+		Named:           krt.Named{Name: "podname", Namespace: "ns"},
+		AugmentedLabels: staleLabels,
+	}})
+
+	cb, uccBuilder := NewUniquelyConnectedClients(nil, false)
+	ucc := uccBuilder(ctx, krtutil.KrtOptions{}, pods)

```

**File**: `test/e2e/features/xdsidentityrace/suite.go` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+//go:build e2e
+
+package xdsidentityrace
+
+import (
+	"context"
+	"fmt"
+	"regexp"
+	"strings"
+	"time"
+
+	"github.com/onsi/gomega"
+	"github.com/stretchr/testify/suite"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/util/sets"
+
+	"github.com/kgateway-dev/kgateway/v2/pkg/utils/kubeutils/kubectl"
+	"github.com/kgateway-dev/kgateway/v2/test/controllerutils/admincli"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e/defaults"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e/tests/base"
+	"github.com/kgateway-dev/kgateway/v2/test/helpers"
+)
+
+var _ e2e.NewSuiteFunc = NewTestingSuite
+
+// identityChangeLog is the controller log emitted when a connected Envoy's
+// re-derived identity no longer matches the one its stream opened with. This
+// line is the proof that the per-request re-derivation fired and closed the
+// stream so the client could re-identify; it is absent in the pre-fix behavior
+// (identity frozen on the first request).
+const identityChangeLog = "xds client identity changed; closing stream"
+
+// uccNameRE matches a UniquelyConnectedClient resource name belonging to the base
+// "gateway" proxy in kgateway-base. The format is
+// role~hash(AugmentedLabels)~namespace, i.e.
+// kgateway-kube-gateway-api~<ns>~<gw>~<hash>~<ns>. Only the hash varies when the
+// proxy pod's labels change, so capturing the full name lets us assert that the
+// identity transitioned without recomputing the hash ourselves. The same name is
+// the node-id key under which the proxy's xDS snapshot is published.
+var uccNameRE = regexp.MustCompile(`kgateway-kube-gateway-api~kgateway-base~gateway~\d+~kgateway-base`)
+
+// testingSuite exercises the xDS client-identity re-derivation end-to-end: a
+// connected Envoy whose pod labels drift after the stream is established must
+// have its stream closed and re-identified against current state, rather than
+// serving config bound to the stale identity for the stream's lifetime.
+//
+// All signals are read from the controller's xDS snapshot admin endpoint and the
+// controller logs, reached via port-forward. We deliberately avoid curling the
+// gateway's LoadBalancer address, which is not routable from the host on local
+// kind.
+//
+// The KRT snapshot endpoint would be the more direct read of UCC membership, but
+// it is deliberately not used: it marshals every registered collection in a
+// single json.Marshal (see krt.DebugHandler.MarshalJSON), so any one
+// unmarshalable object anywhere in the process turns the whole endpoint into a
+// 500 whose body is a "json: ..." error string. That coupling has nothing to do
+// with what this suite tests.
+type testingSuite struct {
+	*base.BaseTestingSuite
+}
+
+func NewTestingSuite(ctx context.Context, testInst *e2e.TestInstallation) suite.TestingSuite {
+	return &testingSuite{
+		BaseTestingSuite: base.NewBaseTestingSuite(ctx, testInst, setup, testCases),
+	}
+}
+
+// TestReidentifyOnPodLabelDrift artificially manipulates the startup race the
+// fix is designed to heal. The race: a stream's first xDS request can be
+// processed before the pod informer has surfaced the proxy pod's full labels,
+// freezing a stale identity. We can't control informer-vs-request timing in a
+// live cluster, but the identity is a pure function of the pod's labels
+// (resource name = role~hash(AugmentedLabels)~ns), so we inject a label the
+// "first request missed" AFTER the stream is established. We then force an xDS
+// push so the established stream re-derives, detects the drift, closes, and the
+// Envoy reconnects under the corrected identity.
+func (s *testingSuite) TestReidentifyOnPodLabelDrift() {
+	ctx := s.Ctx
+	a := s.TestInstallation.AssertionsT(s.T())
+
+	controllerNamespace := s.TestInstallation.Metadata.InstallNamespace
+	controllerMeta := metav1.ObjectMeta{
+		Name:      helpers.DefaultKgatewayDeploymentName,
+		Namespace: controllerNamespace,
+	
```

**File**: `test/e2e/features/xdsidentityrace/testdata/route1.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: xdsrace-route1
+  namespace: kgateway-base
+spec:
+  parentRefs:
+    - name: gateway
+      namespace: kgateway-base
+  hostnames:
+    - "xdsrace.example.com"
+  rules:
+    - matches:
+        - path:
+            type: PathPrefix
+            value: /route1
+      backendRefs:
+        # The shared backend deployed by the base TestKgateway setup in
+        # kgateway-base; this route only exists to force xDS pushes.
+        - name: backend
+          port: 80
```

#### Recent Merged Pull Requests:
- **PR #14768** (2026-09-28): test: fold e2e extproc server into the root Go module (@chandler-solo)
- **PR #14765** (2026-09-28): bump: go 1.26.8 (@chandler-solo)
- **PR #14764** (2026-09-28): Bump OpenTelemetry Go modules for CVE-2026-81870 (@chandler-solo)
- **PR #14763** (2026-09-28): [2.3] Bump OpenTelemetry Go modules for CVE-2026-81870 (@chandler-solo)
- **PR #14762** (2026-09-28): [2.4] Bump OpenTelemetry Go modules for CVE-2026-81870 (@chandler-solo)
- **PR #14759** (2026-09-25): [2.4] Report status for delegated child routes whose parentRef omits the namespace (@puertomontt)
- **PR #14758** (2026-09-25): Report status for delegated child routes whose parentRef omits the namespace (@puertomontt)
- **PR #14754** (2026-09-24): pluginsdk: base-cluster hook, no-op overlay elision, waypoint inputs … (@chandler-solo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
