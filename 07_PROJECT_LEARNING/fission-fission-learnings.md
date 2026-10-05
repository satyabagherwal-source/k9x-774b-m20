# Forensic Learning Record (Deep Inspection): fission/fission

> **Canonical Artifact**: `07_PROJECT_LEARNING/fission-fission-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fission/fission](https://github.com/fission/fission))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:58:56.265Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fission/fission`
- **Description**: Fast and Simple Serverless Functions for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 8929 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/apis/core/v1/conditions.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

// Standard condition Type values populated on each CRD's Status.Conditions
// by Fission controllers. Names follow the Kubernetes convention of being
// CamelCase and namespaced per CRD.
const (
	// Function conditions
	FunctionConditionReady        = "Ready"
	FunctionConditionPackageReady = "PackageReady"
	// FunctionConditionToolExposed reports whether the MCP server is advertising
	// this function as a tool (set by pkg/mcp's reconciler).
	FunctionConditionToolExposed = "ToolExposed"
	// FunctionConditionProvisioned reports whether the executor's provisioner
	// (RFC-0026) has reached the requested warm-pod floor for this function.
	// True = ProvisionedReady >= ProvisionedTarget; False with reason
	// ProvisionedWarming = still warming or draining; False with reason
	// ProvisionedDisabled = provisioned concurrency off (target=0 / spec nil).
	FunctionConditionProvisioned = "Provisioned"

	// Package conditions
	PackageConditionBuildSucceeded = "BuildSucceeded"
	PackageConditionReady          = "Ready"
	// PackageConditionOCIPublished reports the RFC-0012 producer outcome:
	// True = the build was published as a digest-pinned OCI image; False
	// with reason OCIPublishDegraded = the push failed and the build fell
	// back to the storagesvc tarball.
	PackageConditionOCIPublished = "OCIPublished"

	// HTTPTrigger conditions
	HTTPTriggerConditionRouteAdmitted = "RouteAdmitted"
	HTTPTriggerConditionReady         = "Ready"

	// KubernetesWatchTrigger conditions
	KubernetesWatchTriggerConditionSubscribed = "Subscribed"
	KubernetesWatchTriggerConditionReady      = "Ready"

	// TimeTrigger conditions
	TimeTriggerConditionScheduled = "Scheduled"
	TimeTriggerConditionReady     = "Ready"

	// MessageQueueTrigger conditions
	MessageQueueTriggerConditionBindingReady = "BindingReady"
	MessageQueueTriggerConditionReady        = "Ready"

	// CanaryConfig conditions
	CanaryConfigConditionProgressing = "Progressing"
	CanaryConfigConditionReady       = "Ready"

	// Environment conditions
	//
	// EnvironmentConditionReady is reserved for future use. This PR
	// deliberately leaves Environment.Status.Conditions empty because the
	// buildermgr composes the env's builder service hostname from
	// env.ResourceVersion (see pkg/buildermgr/common.go.buildPackage);
	// any status write would bump RV and break in-flight source-archive
	// builds. The constant is kept so a follow-up that decouples the
	// service name from RV can wire writers without an api churn.
	EnvironmentConditionReady = "Ready"

	// FissionTenant conditions (multi-namespace tenancy). The tenant-lifecycle
	// controller writes RBACProvisioned/ServiceAccountsReady/Ready; the auth-key
	// and dynamic-watch workstreams (Phases 4-5) write AuthKeyProvisioned and
	// WatchActive into the same slice. Ready is the rollup over its declared
	// prerequisites.
	FissionTenantConditionRBACProvisioned      = "RBACProvisioned"
	FissionTenantConditionServiceAccountsReady = "ServiceAccountsReady"
	FissionTenantConditionAuthKeyProvisioned   = "AuthKeyProvisioned"
	FissionTenantConditionWatchActive          = "WatchActive"
	FissionTenantConditionReady                = "Ready"

	// Workflow conditions (RFC-0022). The workflow head's Workflow reconciler
	// writes Validated (graph validation result, mirroring admission so GitOps
	// bypasses still surface); constants ship with the types in phase 1, the
	// writer lands with the head in phase 2.
	WorkflowConditionValidated = "Validated"

	// WorkflowRun conditions. Accepted reports that a running workflow
	// controller has picked the run up — CRDs install regardless of
	// workflows.enabled, so a run created with the head disabled must be
	// distinguishable from one that is merely queued.
	WorkflowRunConditionAccepted = "Accepted"

	// FunctionAlias conditions (RFC-0025). Resolved reports whether the
	// alias's spec target (Version or PackageDigest) currently resolves to a
	// FunctionVersion: True with reason FunctionAliasReasonResolved once
	// Status.ResolvedVersion is populated; False with reason
	// FunctionAliasReasonVersionNotFound (name-pinned target missing) or
	// FunctionAliasReasonDigestUnmatched (digest-pinned target not yet — or
	// no longer — recorded by any FunctionVersion) otherwise.
	FunctionAliasConditionResolved = "Resolved"
	// FunctionAliasConditionEnvDrift surfaces the RFC-0025 "Environment &
	// Package changes across the version boundary" gap: an Environment
	// update bumps no Function Generation and recycles pods under EVERY
	// version, so a version's pinned code+config can silently run against a
	// runtime that has moved on since publish. True with reason
	// FunctionAliasReasonEnvGenerationDrift means the resolved target
	// FunctionVersion's EnvObservedGeneration (recorded at publish) no
	// longer matches the live Environment's Generation — the alias is
	// observably drifted, not blocked; rollback restores code/config, never
	// the runtime. False with reason FunctionAliasReasonEnvCurrent means
	// they still match. The condition is REMOVED (absent, not False) when
	// drift is not assessable at all: the alias is unresolved, its target
	// FunctionVersion is missing, or the Environment it names is missing —
	// absence reads as "cannot tell", which is distinct from "checked, no
	// drift".
	FunctionAliasConditionEnvDrift = "EnvDrift"
)

// Standard Reason values written alongside each condition. PascalCase per
// Kubernetes convention. Keeping them in the api package gives controllers
// a single import path to grep when introducing new conditions and
// guarantees we never drift on spelling across writers.
//
// Reasons are deliberately coarse-grained: the executor runs on the
// cold-start hot path and could otherwise flip Reason every few
// milliseconds. Detailed transient failure data lives in metrics and
// logs, not in condition history.
const (
	// Function condition reasons
	FunctionReasonReady             = "Available"          // executor: backend is serving requests
	FunctionReasonPackageReady      = "PackageReady"       // buildermgr: package built
	FunctionReasonPackageFailed     = "PackageBuildFailed" // buildermgr: package build failed
	FunctionReasonToolExposed       = "ToolExposed"        // mcp: advertised as an MCP tool
	FunctionReasonToolNameConflict  = "ToolNameConflict"   // mcp: tool name already used by another function
	FunctionReasonToolInvalidSchema = "ToolInvalidSchema"  // mcp: input schema the MCP SDK cannot register (not advertised)
	// FunctionReasonToolAliasFallback: RFC-0025 alias-addressed Tool
	// (Spec.Tool.Alias set) whose alias has never resolved a target — the mcp
	// reconciler is serving a fallback entry built from THIS function's own
	// live Tool config (not the alias's snapshot) so the tool is not
	// invisible while the alias catches up. Distinct from
	// FunctionReasonToolExposed so `kubectl get function -o
	// jsonpath='{.status.conditions}'` can tell snapshot-serving from
	// fallback-serving without reading logs.
	FunctionReasonToolAliasFallback = "ToolAliasFallback"

	// Provisioned condition reasons (RFC-0026 provisioner).
	FunctionReasonProvisionedSatisfied = "ProvisionedSatisfied" // ProvisionedReady >= ProvisionedTarget
	FunctionReasonProvisionedWarming   = "ProvisionedWarming"   // ProvisionedReady < ProvisionedTarget (still warming or draining)
	FunctionReasonProvisionedDisabled  = "ProvisionedDisabled"  // provisioned concurrency off (target=0 / spec field nil)
	FunctionReasonProvisionedClamped   = "ProvisionedClamped"   // spec.Target exceeded the namespace cap; effective target was clamped

	// Package condition reasons (mirror BuildStatus enum + composites)
	PackageReasonBuildSucceeded  = "BuildSucceeded"
	PackageReasonBuildFailed     = "BuildFailed"
	PackageReasonBuildPending    = "BuildPending"
	PackageReasonBuildRunning    = "BuildRunning"
	PackageReasonNoBuildRequired = "NoBuildRequired"
	PackageReasonUnknown         = "Unknown"
	// OCI producer (RFC-0012) publish outcome reasons.
	PackageReasonOCIPublished       = "OCIPublished"
	PackageReasonOCIPublishDegraded = "OCIPublishDegraded" // push failed; the build fell back to the storagesvc tarball

	// Environment condition reasons — no writer in this PR.
	// See pkg/buildermgr/envwatcher.go.AddUpdateBuilder for why.

	// HTTPTrigger condition reasons
	HTTPTriggerReasonRouteAdmitted        = "RouteAdmitted"
	HTTPTriggerReasonMuxBuildFail         = "MuxBuildFailed"
	HTTPTriggerReasonInvalidCorsConfig    = "InvalidCorsConfig"    // CORS origin/max-age failed url.Parse/time.ParseDuration
	HTTPTriggerReasonInvalidIngressConfig = "InvalidIngressConfig" // ingress path/host failed POSIX-regex/DNS validation
	HTTPTriggerReasonFunctionNotFound     = "FunctionNotFound"     // the referenced function does not exist; the route is not served
	HTTPTriggerReasonRouteConflict        = "RouteConflict"        // another trigger registered the same route shape and wins by precedence; this one is shadowed
	HTTPTriggerReasonInvalidRouteTemplate = "InvalidRouteTemplate" // the path's gorilla template does not compile (capturing groups, unbalanced braces, ...)

	// KubernetesWatchTrigger condition reasons
	KubernetesWatchTriggerReasonSubscribed  = "Subscribed"
	KubernetesWatchTriggerReasonStartFailed = "WatchStartFailed"

	// TimeTrigger condition reasons
	TimeTriggerReasonCronRegistered = "CronRegistered"
	TimeTriggerReasonInvalidCron    = "InvalidCron" // cron failed the robfig/cron parser (CEL cannot express it)

	// MessageQueueTrigger condition reasons
	MessageQueueTriggerReasonSubscribed = "Subscribed"
	// MessageQueueTriggerReasonNotOwned: the head that held this trigger's
	// subscription tore it down because a spec change moved the trigger to a
	// different MQ type/kind — whether another head picks it up depends on that
	// head being deployed.
	MessageQueueTriggerReasonNotOwned = "NotOwned"

	/
```

### Core Architecture Module: `pkg/apis/core/v1/const.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

import (
	"net/url"
)

var (
	MinimumKubernetesVersion = [3]int{1, 32, 0}
)

const (
	EXECUTOR_INSTANCEID_LABEL string = "executorInstanceId"
	DEFAULT_FUNCTION_TIMEOUT  int    = 60

	// DefaultStreamIdleSeconds is the idle timeout applied to a streaming function
	// when StreamingConfig.IdleTimeoutSeconds is unset. Overridable cluster-wide via
	// the router's ROUTER_STREAM_IDLE_TIMEOUT env.
	DefaultStreamIdleSeconds int = 60
)

const (
	// ResourceVersionCount env variable is used for updating configmaps and secrets in pods
	ResourceVersionCount string = "RESOURCE_VERSION_COUNT"
)

const (
	// DefaultInternalAuthSecret is the chart's master-bearing Secret. It is the
	// DEFAULT, not a fixed fact: an operator may point the chart at a
	// pre-created Secret instead (internalAuth.existingSecret), which is the
	// supported path for GitOps renderers, where the chart's lookup-based
	// preservation of a generated value cannot work.
	//
	// Read it through InternalAuthSecretName, not this constant directly — see
	// that function's doc for why two components must agree on the name.
	DefaultInternalAuthSecret = "fission-internal-auth"

	// InternalAuthSecretNameEnv overrides DefaultInternalAuthSecret. The chart
	// sets it on every component that resolves the master.
	InternalAuthSecretNameEnv = "FISSION_INTERNAL_AUTH_SECRET_NAME"

	// InternalAuthSecretEnv and InternalAuthSecretOldEnv carry the
	// internal-auth HMAC master (and, during rotation, the previous master),
	// injected by the chart via secretKeyRef (internalAuth.envs). Readers may
	// Getenv them freely: ValidateInternalAuthEnv rejects the
	// present-but-empty state at every binary's entry point, so past startup
	// an empty read can only mean "absent" (internal auth disabled).
	InternalAuthSecretEnv    = "FISSION_INTERNAL_AUTH_SECRET"
	InternalAuthSecretOldEnv = "FISSION_INTERNAL_AUTH_SECRET_OLD"

	// TenantAuthKeysSecret is the controller-owned Secret (one per tenant
	// namespace) holding that namespace's derived HMAC keys. It is deliberately
	// a DIFFERENT name from the chart's master-bearing "fission-internal-auth":
	// an existing install already replicated the master copy into every function
	// namespace, so a same-named controller Secret would collide (AlreadyExists)
	// and silently never write the derived keys, leaving the data plane to 401.
	// A distinct name lets the controller create it cleanly, own it fully for
	// teardown (without touching the Helm-managed master Secret), and reach the
	// "master never in a tenant namespace" end state by simply having the chart
	// stop replicating the master copy — no in-place merge/removal needed.
	TenantAuthKeysSecret = "fission-internal-auth-keys"

	// Data-key fields inside TenantAuthKeysSecret. Shared by the tenant
	// controller (writer) and the fetcher pod-spec (reader) so the two cannot
	// drift.
	TenantAuthFetcherKey = "fetcherKey"
	TenantAuthBuilderKey = "builderKey"
	TenantAuthStorageKey = "storageKey"
)

const (
	// AuthKeySchemeAnnotation records which HMAC key scheme a fetcher-bearing
	// pod was created with, so the executor signs each /specialize call with the
	// key that pod's verifier actually expects (version-aware signing across a
	// rolling upgrade). It is stamped on the pod template only when dynamic
	// multi-namespace tenancy is on for the pod's namespace; its absence means
	// the master-derived key scheme, which is the only scheme pre-tenancy pods
	// and all single-namespace installs ever use.
	AuthKeySchemeAnnotation string = "fission.io/auth-key-scheme"

	// AuthKeySchemeNamespace is the AuthKeySchemeAnnotation value meaning the
	// pod's fetcher verifies with a per-namespace derived key (it holds only its
	// own namespace's key, never the master), so the executor must sign with
	// ServiceSignerNS for the pod's namespace.
	AuthKeySchemeNamespace string = "namespace"
)

// HasNamespaceKeyScheme reports whether a fetcher/builder pod's annotations mark
// it as verifying with a per-namespace derived key (the AuthKeySchemeNamespace
// scheme). The executor and buildermgr read it to choose version-aware signing;
// keeping the annotation key/value pairing in one place means a change to the
// scheme is a single edit.
func HasNamespaceKeyScheme(annotations map[string]string) bool {
	return annotations[AuthKeySchemeAnnotation] == AuthKeySchemeNamespace
}

const (
	ChecksumTypeSHA256 ChecksumType = "sha256"
)

const (
	// ArchiveTypeLiteral means the package contents are specified in the Literal field of
	// resource itself.
	ArchiveTypeLiteral ArchiveType = "literal"

	// ArchiveTypeUrl means the package contents are at the specified URL.
	ArchiveTypeUrl ArchiveType = "url"

	// ArchiveTypeOCI means the package contents are the filesystem of an
	// OCI image referenced in the OCI field of the resource.
	ArchiveTypeOCI ArchiveType = "oci"
)

// StorageServiceArchivePath is the exact URL path at which storagesvc serves
// archives (the archive id travels as the `id` query param, so the path never
// has a sub-segment). It is the single classifier for "this URL targets our
// own storage service" — the fetcher signs those requests with internal HMAC
// and admission forbids attaching external SecretRef credentials to them.
// Kept in one place so the runtime and admission classifications cannot drift.
const StorageServiceArchivePath = "/v1/archive"

// IsStorageServiceURL reports whether rawURL targets the internal storage
// service. The host is deliberately not matched — it depends on service name,
// namespace, and port-forwarding — so the path is the classifier, and it is
// matched EXACTLY: storagesvc registers only `/v1/archive` (id as a query
// param), so a legitimate external artifact server whose path merely begins
// with that (e.g. https://repo.example.com/v1/archive/app.zip) is correctly
// treated as external. An unparseable URL is treated as NOT storagesvc:
// signing an external/garbage URL with internal credentials is the worse
// failure (exfiltration), so both the fetcher's client selection and
// admission fail open to "external, unsigned" here.
func IsStorageServiceURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	return parsed.Path == StorageServiceArchivePath
}

const (
	BuildStatusPending   BuildStatus = "pending"
	BuildStatusRunning   BuildStatus = "running"
	BuildStatusSucceeded BuildStatus = "succeeded"
	BuildStatusFailed    BuildStatus = "failed"
	BuildStatusNone      BuildStatus = "none"
)

const (
	AllowedFunctionsPerContainerSingle   = "single"
	AllowedFunctionsPerContainerInfinite = "infinite"
)

const (
	// StreamingAuto flushes immediately and lets the upstream decide the framing
	// (SSE, chunked, or a WebSocket Upgrade); the safe default.
	StreamingAuto      StreamingProtocol = "auto"
	StreamingSSE       StreamingProtocol = "sse"
	StreamingChunked   StreamingProtocol = "chunked"
	StreamingWebSocket StreamingProtocol = "websocket"
)

const (
	ExecutorTypePoolmgr   ExecutorType = "poolmgr"
	ExecutorTypeNewdeploy ExecutorType = "newdeploy"
	ExecutorTypeContainer ExecutorType = "container"
)

// RFC-0025 function versioning modes.
const (
	VersioningModeAuto   VersioningMode = "auto"
	VersioningModeManual VersioningMode = "manual"
)

// RFC-0023 keyed-state defaults and sticky-routing sources.
const (
	StickySourceHeader     StickySource = "header"
	StickySourceQueryParam StickySource = "queryparam"

	// DefaultStateMaxValueBytes caps a single state value when
	// StateConfig.MaxValueBytes is unset (256KiB; blobs belong in object
	// storage).
	DefaultStateMaxValueBytes int64 = 262144

	// MaxStateMaxValueBytes is the hard ceiling a tenant may set
	// FunctionSpec.State.MaxValueBytes to (4MiB, 16x the default). It bounds the
	// amplification the /v1/eventlog/append body cap derives from MaxValueBytes
	// (MaxAppendEvents * MaxValueBytes * 4/3), so no single tenant can force the
	// shared statesvc to size an unbounded request body — blobs belong in object
	// storage, not a state value.
	MaxStateMaxValueBytes int64 = 4 << 20

	// DefaultStateMaxKeys caps a keyspace's live keys when
	// StateConfig.MaxKeys is unset.
	DefaultStateMaxKeys int64 = 10000
)

const (
	StrategyTypeExecution = "execution"
)

const (
	RuntimePodSpecPath = "/etc/fission/runtime-podspec-patch.yaml"
	BuilderPodSpecPath = "/etc/fission/builder-podspec-patch.yaml"
)

const (
	SharedVolumeUserfunc   = "userfunc"
	SharedVolumePackages   = "packages"
	SharedVolumeSecrets    = "secrets"
	SharedVolumeConfigmaps = "configmaps"
	PodInfoVolume          = "podinfo"
	PodInfoMount           = "/etc/podinfo"
)

const (
	MessageQueueTypeKafka = "kafka"
	// MessageQueueTypeStatestore is the RFC-0027 built-in provider: topics are
	// EventLog streams on the RFC-0021 statestore — no external broker.
	MessageQueueTypeStatestore = "statestore"
)

const (
	// FunctionReferenceFunctionName means that the function
	// reference is simply by function name.
	FunctionReferenceTypeFunctionName = "name"

	FunctionReferenceTypeFunctionWeights = "function-weights"

	// Other function reference types we'd like to support:
	//   Versioned function, latest version
	//   Versioned function. by semver "latest compatible"
	//   Set of function references (recursively), by percentage of traffic
)

const (
	// failure type currently supported is http status code. This could be extended
	// in the future.
	FailureTypeStatusCode FailureType = "status-code"

	// Status of canary config can be one of the following
	CanaryConfigStatusPending   = "pending"
	CanaryConfigStatusSucceeded = "succeeded"
	CanaryConfigStatusFailed    = "failed"
	CanaryConfigStatusAborted   = "aborted"

	// set a max number for iterations to prevent infinite processing of canary config
	MaxIterationsForCanaryConfig = 10
)

const (
	DefaultSpecializationTimeOut = 120
)

const (
	FETCH_SOURCE = 
```

### Core Architecture Module: `pkg/apis/core/v1/doc.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

// This file tells deepcopy-gen to generate deepcopy methods for all structs in the package.
// For more details, please visit https://blog.openshift.com/kubernetes-deep-dive-code-generation-customresources/

// +k8s:deepcopy-gen=package
// +k8s:defaulter-gen=TypeMeta
// +groupName=fission.io
// +groupGoName=core
package v1

const (
	CRD_VERSION          = "fission.io/v1"
	CRD_NAME_ENVIRONMENT = "Environment"
)

```

### Core Architecture Module: `pkg/apis/core/v1/env_refs.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

// EnvSecretNames returns the Secret names this function references through
// Env[].valueFrom.secretKeyRef and EnvFrom[].secretRef. These references are
// same-namespace by construction (LocalObjectReference carries no namespace).
// The executor's rotation watcher and the pod-template RVSum must treat them
// exactly like Spec.Secrets: Kubernetes never refreshes env in a running
// container, so a rotation that misses them propagates to nothing — silently
// stale credentials (RFC-0030 §5).
func (spec FunctionSpec) EnvSecretNames() []string {
	var names []string
	for _, e := range spec.Env {
		if e.ValueFrom != nil && e.ValueFrom.SecretKeyRef != nil {
			names = append(names, e.ValueFrom.SecretKeyRef.Name)
		}
	}
	for _, src := range spec.EnvFrom {
		if src.SecretRef != nil {
			names = append(names, src.SecretRef.Name)
		}
	}
	return names
}

// EnvConfigMapNames is the ConfigMap counterpart of EnvSecretNames.
func (spec FunctionSpec) EnvConfigMapNames() []string {
	var names []string
	for _, e := range spec.Env {
		if e.ValueFrom != nil && e.ValueFrom.ConfigMapKeyRef != nil {
			names = append(names, e.ValueFrom.ConfigMapKeyRef.Name)
		}
	}
	for _, src := range spec.EnvFrom {
		if src.ConfigMapRef != nil {
			names = append(names, src.ConfigMapRef.Name)
		}
	}
	return names
}

```

### Core Architecture Module: `pkg/apis/core/v1/env_validation.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

import (
	"errors"
	"strings"

	apiv1 "k8s.io/api/core/v1"
)

// Reserved environment-variable names (RFC-0030 §1). Two tiers, two reasons:
//
//   - Platform contract: FISSION_* and RESOURCE_VERSION_COUNT are the names the
//     platform itself sets on the user container. The load-bearing case is
//     FISSION_STATE_URL — redirecting it exfiltrates the RFC-0023 state token
//     to an attacker-chosen endpoint.
//   - Interpreter/proxy hijack: the names that turn env injection into a
//     code-execution or traffic-interception primitive (LD_PRELOAD,
//     NODE_OPTIONS, PYTHONPATH, the proxy set). A function legitimately
//     needing a proxy sets it in its own code or environment image.
//
// OTEL_* is deliberately NOT reserved: OTel env lands on the fetcher sidecar
// only, so there is no platform value on the user container to protect.
//
// Admission checks literal Env names against this list as fast feedback; the
// authoritative enforcement is at injection time (kubelet last-wins ordering
// on newdeploy/container, fetcher-side key filtering on poolmgr), because
// EnvFrom-expanded names are the referenced object's data keys — unknowable
// and mutable after admission.
const ReservedEnvPrefix = "FISSION_"

var reservedEnvNames = map[string]struct{}{
	"RESOURCE_VERSION_COUNT": {},
	"HTTP_PROXY":             {},
	"HTTPS_PROXY":            {},
	"NO_PROXY":               {},
	"http_proxy":             {},
	"https_proxy":            {},
	"no_proxy":               {},
	"LD_PRELOAD":             {},
	"NODE_OPTIONS":           {},
	"PYTHONPATH":             {},
}

// IsReservedEnvName reports whether name is platform-reserved and must never
// be user-settable on the function container. Exported because the poolmgr
// phase's injection-time filter (fetcher-side EnvFrom expansion) enforces the
// same list.
func IsReservedEnvName(name string) bool {
	if strings.HasPrefix(name, ReservedEnvPrefix) {
		return true
	}
	_, reserved := reservedEnvNames[name]
	return reserved
}

// validateFunctionEnv validates FunctionSpec.Env / EnvFrom (RFC-0030 §1):
// literal names non-empty, unique and non-reserved; valueFrom narrowed to
// secretKeyRef/configMapKeyRef (poolmgr's specialize-time injection cannot
// honor pod-level fieldRef/resourceFieldRef portably); each EnvFrom source
// names exactly one of a Secret or a ConfigMap.
func validateFunctionEnv(env []apiv1.EnvVar, envFrom []apiv1.EnvFromSource) error {
	var errs error
	seen := make(map[string]struct{}, len(env))
	for _, e := range env {
		if e.Name == "" {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "environment variable name must not be empty"))
			continue
		}
		if _, dup := seen[e.Name]; dup {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "duplicate environment variable name"))
		}
		seen[e.Name] = struct{}{}
		if IsReservedEnvName(e.Name) {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "name is reserved by the platform (FISSION_*, RESOURCE_VERSION_COUNT, proxy and interpreter-hijack variables)"))
		}
		if e.ValueFrom != nil {
			if e.Value != "" {
				errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "value and valueFrom are mutually exclusive"))
			}
			if e.ValueFrom.FieldRef != nil || e.ValueFrom.ResourceFieldRef != nil {
				errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "valueFrom supports only secretKeyRef and configMapKeyRef (downward-API refs cannot be honored portably across executors)"))
			}
			refs := 0
			// An empty object name passes the API server's schema (name is
			// optional on LocalObjectReference) but makes the built pod spec
			// unadmittable, leaving the function healthy-looking with no pods.
			if ref := e.ValueFrom.SecretKeyRef; ref != nil {
				refs++
				if ref.Name == "" {
					errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "secretKeyRef.name must not be empty"))
				}
			}
			if ref := e.ValueFrom.ConfigMapKeyRef; ref != nil {
				refs++
				if ref.Name == "" {
					errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "configMapKeyRef.name must not be empty"))
				}
			}
			if refs != 1 && e.ValueFrom.FieldRef == nil && e.ValueFrom.ResourceFieldRef == nil {
				errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.Env", e.Name, "valueFrom must name exactly one of secretKeyRef or configMapKeyRef"))
			}
		}
	}
	for i, src := range envFrom {
		refs := 0
		if ref := src.SecretRef; ref != nil {
			refs++
			if ref.Name == "" {
				errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.EnvFrom", i, "secretRef.name must not be empty"))
			}
		}
		if ref := src.ConfigMapRef; ref != nil {
			refs++
			if ref.Name == "" {
				errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.EnvFrom", i, "configMapRef.name must not be empty"))
			}
		}
		if refs != 1 {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "FunctionSpec.EnvFrom", i, "each envFrom source must name exactly one of secretRef or configMapRef"))
		}
	}
	return errs
}

// DefaultTerminationGracePeriod is the drain window an Environment gets when
// spec.terminationGracePeriod is nil — the in-process mirror of the CRD
// structural default (types.go: +kubebuilder:default=90). Keep the two equal:
// the apiserver applies the marker at serving time, so this constant is only
// reached by objects that never crossed the apiserver (hand-built fixtures,
// direct constructors).
const DefaultTerminationGracePeriod int64 = 90

// EffectiveTerminationGracePeriod returns the drain window the pod template
// actually gets: the field's value when set — an explicit 0 means "no drain
// window, kill instantly" — else DefaultTerminationGracePeriod.
func (spec EnvironmentSpec) EffectiveTerminationGracePeriod() int64 {
	if spec.TerminationGracePeriod == nil {
		return DefaultTerminationGracePeriod
	}
	return *spec.TerminationGracePeriod
}

```

### Core Architecture Module: `pkg/apis/core/v1/functionalias.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

// EffectiveTarget returns the FunctionVersion name a FunctionAlias currently
// points at: Spec.Version if the alias is name-pinned, else
// Status.ResolvedVersion (the async-resolved outcome of a PackageDigest
// pin). THIS is the one precedence rule for "what version does this alias
// mean right now" -- every consumer of a FunctionAlias (the router's
// resolveByAlias, the MCP tool reconciler, ...) must go through this method
// rather than re-deriving the fallback locally, so the rule only needs to
// change in one place. Returns "" when the alias has not resolved to a
// version yet.
func (fa *FunctionAlias) EffectiveTarget() string {
	if fa.Spec.Version != "" {
		return fa.Spec.Version
	}
	return fa.Status.ResolvedVersion
}

// ReferencedVersionNames returns every FunctionVersion name this alias
// references (primary pin, secondary, resolved) -- THE definition of "an
// alias references a version" (retention invariant V3). Callers must not
// re-derive the field list.
func (fa *FunctionAlias) ReferencedVersionNames() []string {
	var names []string
	for _, name := range [...]string{fa.Spec.Version, fa.Spec.SecondaryVersion, fa.Status.ResolvedVersion} {
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

```

### Core Architecture Module: `pkg/apis/core/v1/groupversion_info.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

// Package v1 contains API Schema definitions for the fission.io v1 API group
// +kubebuilder:object:generate=true
// +groupName=fission.io
package v1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	// GroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: "fission.io", Version: "v1"}

	// SchemeBuilder is used to add go types to the GroupVersionKind scheme
	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)

	// AddToScheme adds the types in this group-version to the given scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

```

### Core Architecture Module: `pkg/apis/core/v1/internalauth.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

import (
	"fmt"
	"os"
	"strings"
)

// ValidateInternalAuthEnv enforces the fail-closed contract on the
// internal-auth environment. It is called once from every binary's entry
// point (fission-bundle — covering all its subsystems — fetcher, builder,
// and the CLI) before anything constructs a signer or verifier.
//
// Three states, two of them fine:
//   - variable ABSENT: internal auth is disabled; signers and verifiers pass
//     through, the documented dev-mode contract.
//   - present and NON-EMPTY: internal auth is on.
//   - present but blank (empty OR whitespace-only): refused. An empty value is
//     exactly what a misconfigured Secret produces — the chart's secretKeyRef
//     injects an existing-but-empty `secret` key verbatim — and every
//     downstream constructor treats a blank key as "disabled", silently
//     demoting the deployment to unauthenticated pass-through: the
//     GHSA-3g33-6vg6-27m8 exposure internal auth exists to close.
//
// On the chart's CONTROL-PLANE Deployments a MISSING key already fails closed
// (the secretKeyRef is non-optional, so the pod wedges in
// CreateContainerConfigError) — the blank value was the one that failed open.
// Note this does NOT reach the fetcher/builder sidecars, whose secretKeyRef is
// `optional: true`: a missing key there yields ABSENT, which is the documented
// auth-disabled state. Closing that (a renamed data key on an existingSecret
// leaving function-pod verifiers in pass-through) needs a non-optional mount
// or a data-key check, tracked separately.
//
// Validating once per process is what lets the many env readers stay unchanged
// and unable to disagree: past startup, in every shipped binary, an empty
// Getenv can only mean absent. (In-process test harnesses bypass main() and
// may set these vars mid-process; they own their own state.)
func ValidateInternalAuthEnv() error {
	for _, env := range []string{InternalAuthSecretEnv, InternalAuthSecretOldEnv} {
		if v, ok := os.LookupEnv(env); ok && strings.TrimSpace(v) == "" {
			return fmt.Errorf("%s is set but blank: internal auth is configured, yet the key material is missing — refusing to run with HMAC verification silently disabled; fix the referenced Secret's key, or remove the variable to run with internal auth off", env)
		}
	}
	return nil
}

// InternalAuthSecretName is the name of the Secret holding the internal-auth
// HMAC master for this install.
//
// It is the resolver for IN-CLUSTER components (the fetcher pod-spec builder,
// the storagesvc server), which read the name from their own process env. A
// disagreement between them does not fail loudly: the fetcher's secretKeyRef
// is marked optional, so the pod starts, the env var is simply absent, and
// every archive fetch and builder upload 401s with nothing naming the Secret
// as the cause.
//
// Off-cluster callers (the CLI) have no such env and resolve the name from the
// running cluster instead — see internalAuthSecretNameFromCluster in
// pkg/storagesvc/client, whose precedence is a strict superset of this one
// (this function's env-or-default is its tiers 1 and 3).
//
// The default is the chart-generated name. internalAuth.existingSecret points
// an install at a pre-created Secret instead — the supported path for GitOps
// renderers, where the chart cannot preserve a generated value across a
// `helm template` sync.
func InternalAuthSecretName() string {
	if name := os.Getenv(InternalAuthSecretNameEnv); name != "" {
		return name
	}
	return DefaultInternalAuthSecret
}

```

### Core Architecture Module: `pkg/apis/core/v1/mountpath_validation.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

import (
	"errors"
	"fmt"
	"path"
	"strings"
)

// CleanMountPath normalises a MountPath and reports whether it is usable.
//
// The value is RELATIVE to the /secrets or /configs root, never absolute
// (RFC-0030 §4): generic pool pods share a fixed set of emptyDirs frozen at
// pool creation, so the fetcher physically cannot materialise a file at an
// arbitrary absolute path, and the container executor accepts the same
// constraint rather than diverging per executor.
//
// It is exported because the fetcher must derive exactly the same directory the
// webhook validated. Two implementations of "where does this go" would drift,
// and the drift would only show up as files written somewhere nobody looks.
func CleanMountPath(mountPath string) (string, error) {
	if mountPath == "" {
		return "", nil
	}
	if path.IsAbs(mountPath) {
		return "", fmt.Errorf("mountPath %q must be relative: it is resolved under the shared secrets/configs root, not the container filesystem root", mountPath)
	}
	if strings.ContainsRune(mountPath, '\\') {
		return "", fmt.Errorf("mountPath %q must not contain a backslash", mountPath)
	}

	cleaned := path.Clean(mountPath)
	// path.Clean turns "a/../.." into ".." and "." into "."; both escape or
	// collapse to the root, neither of which is a usable per-object directory.
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", fmt.Errorf("mountPath %q must stay within the shared secrets/configs root", mountPath)
	}
	return cleaned, nil
}

// ObjectSubPath is the directory one referenced object's keys are written to,
// relative to the shared /secrets or /configs root: MountPath when set, the
// historical <namespace>/<name> otherwise.
//
// Exported so the fetcher derives exactly the directory admission validated.
// Two implementations of "where does this go" would drift, and the drift would
// surface only as files written somewhere nobody looks.
func ObjectSubPath(mountPath, namespace, name string) (string, error) {
	cleaned, err := CleanMountPath(mountPath)
	if err != nil {
		return "", err
	}
	if cleaned != "" {
		return cleaned, nil
	}
	return path.Join(namespace, name), nil
}

// validateMountPaths applies the RFC-0030 §4 rules to a function's file
// projections: each MountPath must be relative and confined, and no two
// references of the same kind may resolve to the same directory.
//
// The duplicate rule is the part admission can enforce. The final path segment
// written is the referenced object's DATA KEY, and keys are mutable after
// admission, so a webhook cannot see them — two references sharing a directory
// can have one object's later-added key overwrite a file the other wrote.
// Rejecting the shared directory removes the half this layer can see; the
// fetcher refuses to overwrite a file another object wrote in the same
// specialization pass, which covers the keys admission cannot know about.
//
// Collisions are computed on the RESOLVED directory, not on MountPath alone. A
// reference with no MountPath still occupies <namespace>/<name>, so an explicit
// MountPath of "default/creds" collides with a reference to secret "creds" in
// namespace "default" even though only one of the two sets the field. Checking
// explicit values against each other would miss exactly that case while
// claiming the directory is unshared.
func (spec FunctionSpec) validateMountPaths() error {
	var errs error

	// Secrets and ConfigMaps land under DIFFERENT roots, so a path may repeat
	// across the two kinds without colliding — track them separately.
	seenSecret := map[string]string{}
	seenConfig := map[string]string{}

	for _, s := range spec.Secrets {
		dir, err := ObjectSubPath(s.MountPath, s.Namespace, s.Name)
		if err != nil {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "SecretReference.MountPath", s.MountPath, err.Error()))
			continue
		}
		if prev, dup := seenSecret[dir]; dup {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "SecretReference.MountPath", s.MountPath,
				fmt.Sprintf("resolves to %q, already used by secret %q; two secrets writing to one directory can overwrite each other's keys", dir, prev)))
			continue
		}
		seenSecret[dir] = s.Name
	}

	for _, c := range spec.ConfigMaps {
		dir, err := ObjectSubPath(c.MountPath, c.Namespace, c.Name)
		if err != nil {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "ConfigMapReference.MountPath", c.MountPath, err.Error()))
			continue
		}
		if prev, dup := seenConfig[dir]; dup {
			errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "ConfigMapReference.MountPath", c.MountPath,
				fmt.Sprintf("resolves to %q, already used by configmap %q; two configmaps writing to one directory can overwrite each other's keys", dir, prev)))
			continue
		}
		seenConfig[dir] = c.Name
	}

	return errs
}

```

### Core Architecture Module: `pkg/apis/core/v1/ownerref.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// FunctionOwnerRef is the ownerRef an RFC-0025 object (FunctionVersion,
// FunctionAlias) carries back to the Function it belongs to, so the garbage
// collector removes it along with that Function; Controller and
// BlockOwnerDeletion are left unset because no controller adopts these
// objects and Function deletion must never block on them.
func FunctionOwnerRef(fn *Function) metav1.OwnerReference {
	return metav1.OwnerReference{
		APIVersion: SchemeGroupVersion.String(),
		Kind:       "Function",
		Name:       fn.Name,
		UID:        fn.UID,
	}
}

```

### Core Architecture Module: `pkg/apis/core/v1/register.go`
```
// SPDX-FileCopyrightText: The Kubernetes Authors
//
// SPDX-License-Identifier: Apache-2.0

// The file comes from Kubernetes code-generator repo with custom modification.
// https://github.com/kubernetes/code-generator/blob/0826954c61ed88ac5d75e771ade6aae646ca5268/_examples/HyphenGroup/apis/example/v1/register.go

package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// addKnownTypes registers the manually written types with the scheme. The
// registration of the generated functions takes place in the generated files.
// The separation makes the code compile even when the generated files are missing.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&Function{},
		&FunctionList{},
		&Environment{},
		&EnvironmentList{},
		&HTTPTrigger{},
		&HTTPTriggerList{},
		&KubernetesWatchTrigger{},
		&KubernetesWatchTriggerList{},
		&TimeTrigger{},
		&TimeTriggerList{},
		&MessageQueueTrigger{},
		&MessageQueueTriggerList{},
		&Package{},
		&PackageList{},
		&CanaryConfig{},
		&CanaryConfigList{},
		&FissionTenant{},
		&FissionTenantList{},
		&Workflow{},
		&WorkflowList{},
		&WorkflowRun{},
		&WorkflowRunList{},
		&FunctionVersion{},
		&FunctionVersionList{},
		&FunctionAlias{},
		&FunctionAliasList{})
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}

```

### Core Architecture Module: `pkg/apis/core/v1/status_accessors.go`
```
// SPDX-FileCopyrightText: The Fission Authors
//
// SPDX-License-Identifier: Apache-2.0

package v1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// GetConditions returns a pointer to the object's Status.Conditions slice.
//
// These accessors let generic controller helpers (see pkg/controller) read and
// mutate a CRD's status conditions without knowing the concrete type. They are
// hand-written rather than generated because the code-generator does not emit
// status-condition accessors; keep one method per CRD that carries
// Status.Conditions.

func (p *Package) GetConditions() *[]metav1.Condition { return &p.Status.Conditions }

func (f *Function) GetConditions() *[]metav1.Condition { return &f.Status.Conditions }

func (e *Environment) GetConditions() *[]metav1.Condition { return &e.Status.Conditions }

func (h *HTTPTrigger) GetConditions() *[]metav1.Condition { return &h.Status.Conditions }

func (k *KubernetesWatchTrigger) GetConditions() *[]metav1.Condition {
	return &k.Status.Conditions
}

func (t *TimeTrigger) GetConditions() *[]metav1.Condition { return &t.Status.Conditions }

func (m *MessageQueueTrigger) GetConditions() *[]metav1.Condition {
	return &m.Status.Conditions
}

func (c *CanaryConfig) GetConditions() *[]metav1.Condition { return &c.Status.Conditions }

func (ft *FissionTenant) GetConditions() *[]metav1.Condition { return &ft.Status.Conditions }

func (w *Workflow) GetConditions() *[]metav1.Condition { return &w.Status.Conditions }

func (wr *WorkflowRun) GetConditions() *[]metav1.Condition { return &wr.Status.Conditions }

func (fa *FunctionAlias) GetConditions() *[]metav1.Condition { return &fa.Status.Conditions }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3610** (2026-08-21): **Flaky: TestAsyncInvocationOnSuccessFunctionDestination times out waiting on the shared async queue under CI contention**
  *Symptoms*: ## Summary  `TestAsyncInvocationOnSuccessFunctionDestination` (suites/serial, RFC-0024) intermittently fails in CI with `Condition never satisfied` after ~120-190s, then passes on rerun.  Observed three times in the last two days on unrelated heads: - PR #3599 head `47980c7e` precursor run, leg v1.36.1 - PR #3599 head `133aaacb` run 30070118449, leg v1.32.11 (122s) - PR #3608 run 30095299405, leg v1.34.8 (190s) — a PR that touches no async code at all  ## Likely mechanism  The test waits for an onSuccess destination fire through the single global async-invocation queue (RFC-0024 design). Under runner contention the delivery/redelivery backoff chain can exceed the test's wait window; the sibling `TestAsyncInvocationDepthCapBounds` showed the same shape once. Related: the settle-budget fix (#3604) removed one source of stuck leases, but the window-vs-backoff race remains.  ## Suggested direction  Either widen the destination-fire wait to comfortably cover the worst-case backoff chain (the async-pin tests in the RFC-0025 suite were recently moved to a 5m window for the same reason), or make the test's function respond immediately so only queue latency (not function latency) is in the budget.

- **Issue #3588** (2026-07-19): **fission function test is broken after router public/internal listener split**
  *Symptoms*: **Fission/Kubernetes version**  <pre> client:   fission/core:     BuildDate: "2026-06-22T12:02:31Z"     GitCommit: 1e1401cd     Version: v1.27.0 server:   fission/core:     BuildDate: "2026-06-22T12:02:31Z"     GitCommit: 1e1401cd     Version: **v1.27.0** </pre>  **Kubernetes platform (e.g. Google Kubernetes Engine)**  OpenShift/Kubernetes.  Fission is installed in the `fission` namespace. Functions are deployed in the `fission-functions` namespace.  **Describe the bug**  `fission function test` consistently returns `404 page not found` on Fission v1.27.0, including for a minimal valid Python function.  The function itself works correctly when invoked through an HTTPTrigger on the public router. The failure is isolated to the direct invocation path used by `fission function test`.  Verbose output shows that the CLI port-forwards to the public router listener on port `8888`, then calls:  <pre> /fission-function/&lt;namespace&gt;/&lt;function&gt; </pre>  That direct invocation endpoint is no longer served by the public listener. The router therefore returns `404` before the request reaches the executor.  The installed router services appear to be configured as expected:  <pre> $ oc -n fission get svc router router-internal \ -o custom-columns='NAME:.metadata.name,PORT:.spec.ports[*].port,TARGET:.spec.ports[*].targetPort' NAME PORT TARGET router 80 8888 router-internal 8889 8889 </pre>  **To Reproduce**  Create a minimal Python function:  <pre> $ cat &gt; hello_min.py &lt;&lt;'P

- **Issue #3059** (2026-06-22): **Creating a route causes the router pod to crash**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! -->  <!-- Documentation URL: https://fission.io/docs --> <!-- Troubleshooting guide: https://fission.io/docs/trouble-shooting/ -->  **Fission/Kubernetes version**  <!-- If you tested with other services, for example Istio, please also provide the version of service as well. -->  <pre> $ fission version v1.20.2 $ kubectl version Client Version: v1.28.13 Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3 Server Version: v1.28.13  </pre>  **Describe the bug** When a route is created using a command, the status of the router pod eventually changes to CrashLoopBackOff. command: fission route create --name all-12 --function all  --url /{url} --method GET --method POST  router pod CrashLoopBackOff： ![image](https://github.com/user-attachments/assets/edf6e8d3-739a-450b-a86d-938de2829c0a)  router  pod log： ![image](https://github.com/user-attachments/assets/bd99ee64-4755-42bd-b1ea-87642341b58e)  executor pod log: ![image](https://github.com/user-attachments/assets/198d23b5-ff44-4c21-b3a2-133316450d78)    **To Reproduce**  <!-- Please provide steps for reproducing the error. --> Use this command to create a route： fission route create --name all-12 --function all  --url /{url} --method GET --method POST  **Additional context** <!--Add any other context about the problem here.--> 
  **Post-Mortem & Fix Analysis**:
  > @sanketsudake
  > Fixed on `main`. Route templates that fail to compile no longer panic the router's route build — they're rejected under panic-recovery and surfaced as `RouteAdmitted=False` on the trigger instead of crash-looping the pod (`pkg/router/httpTriggers.go`), and the router mux was rewritten off gorilla/mux onto the internal httpmux (#3512), which hardened route building further.  Closing as fixed — please reopen with a repro if you still see a crash on a current build.

- **Issue #3034** (2024-10-08): **Fix: an invalid env manifest file breaks the executor component which stops the creation and deletion of envs**
  *Symptoms*: <!--  Thanks for sending a pull request! We request you provide detailed description as much as possible. -->  ## Description <!--- Describe your changes in detail. --> <!-- Typically try to give details of what, why and how of the PR changes. --> - If we create an environment with invalid values in manifest file then environment creation will fail. We will see the respective logs in executor. No issues here. - Now if we delete that environment then `poolmgr` cleanup service is called and `return` statement in this service breaks the Go routine.  ## Which issue(s) this PR fixes: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. --> Fixes #  ## Testing <!--- Please describe in detail how you tested your changes. --> - Create environment manifest using `fission spec` command. ``` $ fission spec init $ fission env create --name go --image ghcr.io/fission/go-env --builder ghcr.io/fission/go-builder --spec ``` - Now edit the `specs/env-go.yaml` file and use an invalid container name for `runtime`. Valid name = envName **spec.runtime.container.name = invalid** ``` apiVersion: fission.io/v1 kind: Environment metadata:   creationTimestamp: null   name: go spec:   builder:     command: build     container:       name: ""       resources: {}     image: ghcr.io/fission/go-builder   imagepullsecret: ""   keeparchive: false   poolsize: 3   resources: {}   runtime:     conta
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/fission/fission/pull/3034?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=fission) Report Attention: Patch coverage is `0%` with `1 line` in your changes missing coverage. Please review. > Project coverage is 45.84%. Comparing base [(`db2b0ad`)](https://app.codecov.io/gh/fission/fission/commit/db2b0ad4a058b03fbd433635995fff98d367a4ae?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=fission) to head [(`c02c9b5`)](https://app.codecov.io/gh/fission/fission/commit/c02c9b5250dc91a8ca20917a35cacffea0adfc79?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=fission). > Report is 2 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/fission/fission/pull/3034?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_s

- **Issue #3023** (2024-09-27): **Unable to create model in fission version 1.20.4 when upgrading from 1.20.1**
  *Symptoms*: **Fission Version:** client:   fission/core:     BuildDate: "2024-09-02T07:18:37Z"     GitCommit: cf55fbec     Version: v1.20.4 server:   fission/core:     BuildDate: "2024-09-02T07:18:37Z"     GitCommit: cf55fbec     Version: v1.20.4  **Kubectl version**  Client Version: v1.26.3 Kustomize Version: v4.5.7 Server Version: v1.28.9  **To Reproduce**  Current version of fission installed: 1.20.1 New Version Installed : 1.20.4  When upgrading the fission version from 1:20.1->1.20.4  Model creation is working fine on 1.20.1   when updated fto 1.20.4 got the following error in router:- 2024-09-20T08:55:54.824961861Z {"level":"info","ts":"2024-09-20T08:55:54.824Z","caller":"crd/client.go:143","msg":"Checking function CRD access","namespace":"default","timeout":"30s"} 2024-09-20T08:55:55.909738766Z {"level":"info","ts":"2024-09-20T08:55:55.909Z","caller":"router/router.go:217","msg":"starting router","port":8888} 2024-09-20T08:55:55.909893968Z {"level":"info","ts":"2024-09-20T08:55:55.909Z","caller":"httpserver/server.go:22","msg":"starting server","service":"router/metrics","addr":":8080"} 2024-09-20T08:55:55.918949597Z {"level":"info","ts":"2024-09-20T08:55:55.909Z","caller":"httpserver/server.go:22","msg":"starting server","service":"router","addr":":8888"} 2024-09-20T09:36:39.124555051Z 2024/09/20 09:36:39 [DEBUG] POST http://executor.fission/v2/getServiceForFunction 2024-09-20T09:36:51.628764549Z 2024/09/20 09:36:51 [DEBUG] POST http://executor.f
  **Post-Mortem & Fix Analysis**:
  > @sanketsudake..we noticed when we updated to 1.20.4..there is no pods in fission-function..  <img width="749" alt="image" src="https://github.com/user-attachments/assets/f47f4b44-23cd-4306-9077-16f0c4370a48">  and in executor pod its giving poolmgr-python-env-build-2-default-535606343-67b4589b89-2xlfq - not found    
  > Please share your helm configuration   ``` helm get values <fission_installation> -n <fission installed _namespace> ```  Also share share specs for function and enviroment  ``` fission fn list  fission env list  ```  I think there may be something wrong at configuration level, which was not supported but being used. 
  > @sanketsudake   **helm get values fission -n fission**  USER-SUPPLIED VALUES: analytics: false builderNamespace: fission-builder defaultNamespace: default functionNamespace: fission-function prometheus:   enabled: false   serviceEndpoint: https://prometheus-kube-prometheus-prometheus.operations.svc.cluster.local routerServiceType: ClusterIP  **fission env list**   <img width="955" alt="image" src="https://github.com/user-attachments/assets/8a5063ef-4671-43f1-9330-5b50998de5c3">   **fission fn list**     <img width="713" alt="image" src="https://github.com/user-attachments/assets/d60473cd-50ce-4c97-8104-50484c354fca">   

- **Issue #3018** (2024-09-30): **Fix slice init length in fetcher pod spec addition**
  *Symptoms*: <!--  Thanks for sending a pull request! We request you provide detailed description as much as possible. -->  ## Description <!--- Describe your changes in detail. --> <!-- Typically try to give details of what, why and how of the PR changes. -->  Fix slice init length   ## Which issue(s) this PR fixes: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. --> Fixes #  ## Testing <!--- Please describe in detail how you tested your changes. -->  ## Checklist: <!-- Please tick following checkboxes as per your understanding. --> - [ ] I ran tests as well as code linting locally to verify my changes.  - [ ] I have done manual verification of my changes, changes working as expected. - [ ] I have added new tests to cover my changes. - [ ] My changes follow contributing guidelines of Fission. - [ ] I have signed all of my commits. 
  **Post-Mortem & Fix Analysis**:
  > @cuishuang Thank you for the PR. Please sign your commit. 
  > > @cuishuang Thank you for the PR. Please sign your commit.  Thanks. Signed.

- **Issue #2926** (2024-06-25): **fission package build stuck in running**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! -->  <!-- Documentation URL: https://fission.io/docs --> <!-- Troubleshooting guide: https://fission.io/docs/trouble-shooting/ -->  **Fission/Kubernetes version** v1.29 <!-- If you tested with other services, for example Istio, please also provide the version of service as well. -->  <pre> $ fission version v1.20.1 $ kubectl version v1.25 </pre>  **Kubernetes platform (e.g. Google Kubernetes Engine)** Amazon EKS  **Describe the bug** <!--A clear and concise description of what the bug is.-->  The packages are getting stuck in the running state, and there are no logs available for the packages. I tried below things: 1. I attempted to create a package out of a simple .py file, but it also became stuck in a running state. 2. I tried deleting everything, including the environment, routes, and all packages, and then created a new package, but the issue persists. 3. The fission check shows everything is functioning correctly, and all pods are operational. 4. I verified the AWS keys in the deployment configuration as well. I checked the logs of the executor and StorageSVC pod, but there are no error logs available to debug this issue. [Using S3 as storage] 5. Tried rollout restarting the whole fission deployments.  **To Reproduce**  <!-- Please provide steps for reproducing the error. --> fission pkg create --sourcearchive new-test.zip --env nodejs --name node-sample-test  **E
  **Post-Mortem & Fix Analysis**:
  > Please follow this the readme for nodejs [examples](https://github.com/fission/examples/tree/main/nodejs) Please check following points: 1.  Use builder while creating nodejs environment ``` $ fission env create --name nodeenv --image fission/node-env:latest --builder fission/node-builder:latest ``` 2. Provide an entry point while creating the function ``` $ fission fn create --name hello --pkg [pkgname] --entrypoint "hello" ```

- **Issue #2917** (2024-05-28): **Router cannot create resource Ingresses**
  *Symptoms*: <!-- Please answer these questions before submitting your issue. Thanks! -->  <!-- Documentation URL: https://fission.io/docs --> <!-- Troubleshooting guide: https://fission.io/docs/trouble-shooting/ -->  **Fission/Kubernetes version**  <!-- If you tested with other services, for example Istio, please also provide the version of service as well. -->  <pre> $ fission version client:   fission/core:     BuildDate: "2024-01-14T15:43:35Z"     GitCommit: 7e8d5dd7     Version: v1.20.1 server:   fission/core:     BuildDate: "2024-01-14T15:43:35Z"     GitCommit: 7e8d5dd7     Version: v1.20.1  $ kubectl version Client Version: v1.28.2 Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3 Server Version: v1.29.1+k3s2 </pre>  **Kubernetes platform (e.g. Google Kubernetes Engine)** - Self-hosted k3s  **Describe the bug** <!--A clear and concise description of what the bug is.--> ```json {   "level":"error",   "ts":"2024-02-17T19:03:27.056Z",   "logger":"triggerset.http_trigger_set",   "caller":"router/ingress.go:48",   "msg":"failed to create ingress",   "error":"ingresses.networking.k8s.io is forbidden: User \"system:serviceaccount:fission:fission-router\" cannot create resource \"ingresses\" in API group \"networking.k8s.io\" in the namespace \"fission\"","stacktrace":"github.com/fission/fission/pkg/router.createIngress\n\tpkg/router/ingress.go:48" } ``` fission-router has access to create ingress in default namespace, but it try to create i
  **Post-Mortem & Fix Analysis**:
  > I'm also seeing this. I was expecting the ingress to be created in the same namespace as the HttpTrigger, but instead it's being added to the fission namespace. Looking at the CRD there seems to be no way of specifying the ingress namespace.  Can the default be changed to match the namespace of the HttpTrigger, and also an option be added to the CRD for overriding?
  > As a workaround, it seems you can apply the below after helm install, which is just the fission-all/templates/router/role-kubernetes.yaml from the helm chart, with the namespace on each object changed from default to fission.  The ingresses get created in fission namespace but they do work. ``` apiVersion: rbac.authorization.k8s.io/v1 kind: Role metadata:   name: "fission-router"   namespace: fission rules: - apiGroups:   - networking.k8s.io   resources:   - ingresses   verbs:   - create   - get   - list   - watch   - update   - patch   - delete - apiGroups:   - apiextensions.k8s.io   resources:   - customresourcedefinitions   verbs:   - get   - list   - watch --- # Source: fission-all/templates/router/role-kubernetes.yaml kind: RoleBinding apiVersion: rbac.authorization.k8s.io/v1 metadata:   name: "fission-router"   namespace: fission subjects:   - kind: ServiceAccount     name: "fission-router"     namespace: fission roleRef:   kind: Role   na

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

### Incident Patch 1: `c096200b` (2026-09-15)
**Commit Message**: storagesvc/client: pull the MinIO test fixture from quay.io (#3727)

The Docker Hub mirror minio/minio was removed in 2026-09 and now answers
"pull access denied", so dockertest could not start the fixture and the
S3 storage-service test log.Fatal'd on every run — the lint job is red on
main and on every open PR since 2026-09-15. quay.io is MinIO's official
registry; pin a release tag rather than latest so the fixture is
reproducible. Verified locally against colima.

**File**: `pkg/storagesvc/client/storagesvc_test.go` (modified, +6/-2)
```diff
@@ -53,8 +53,12 @@ func MakeTestFile(size int) (*os.File, error) {
 
 func runMinioDockerContainer(pool *dockertest.Pool) *dockertest.Resource {
 	options := &dockertest.RunOptions{
-		Repository: "minio/minio",
-		Tag:        "latest",
+		// quay.io is MinIO's official registry; the Docker Hub mirror
+		// (minio/minio) was removed in 2026-09 and now answers "pull access
+		// denied", which log.Fatal'd this test on every CI run. A release tag,
+		// not "latest", so the fixture is reproducible.
+		Repository: "quay.io/minio/minio",
+		Tag:        "RELEASE.2025-09-07T16-13-09Z",
 		Cmd:        []string{"server", "/data"},
 		PortBindings: map[dc.Port][]dc.PortBinding{
 			"9000/tcp": {{HostIP: "", HostPort: "9000"}},
```

---

### Incident Patch 2: `405b5da9` (2026-09-15)
**Commit Message**: tlc: pin tla2tools to the stable v1.7.4 release instead of the rebuilt v1.8.0 prerelease (#3724)

The v1.8.0 tag is a GitHub prerelease whose assets the tlaplus project
re-uploads on every master push, so the SHA256 pin drifted again the same
afternoon #3723 bumped it, and the tlc job fails at the checksum step on
unrelated PRs (#3685, #3723, #3722). v1.7.4 is the latest stable release;
its tla2tools.jar has been immutable since 2024-08-08.

Pin the script default and the workflow env to 1.7.4 with the verified
checksum (manifest Main-class tlc2.TLC, Implementation-Vendor Microsoft
Corp., Implementation-Version 2.0 2024-08-08, X-Git-ShortRevision 5a47802,
tlc2/TLC.class present). Every green config passes and every negative
config fails as expected on it, run end to end with the script defaults.

**File**: `.github/workflows/tlc.yaml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ permissions:
   contents: read
 
 env:
-  TLA2TOOLS_VERSION: "1.8.0"
+  TLA2TOOLS_VERSION: "1.7.4"
 
 jobs:
   tlc:
```

**File**: `hack/run-tlc.sh` (modified, +15/-16)
```diff
@@ -14,22 +14,21 @@
 
 set -euo pipefail
 
-TLA2TOOLS_VERSION="${TLA2TOOLS_VERSION:-1.8.0}"
-# SHA256 of the tla2tools.jar attached to the v1.8.0 GitHub release. NOTE: the
-# tlaplus project periodically REBUILDS and re-uploads this release asset (the jar
-# manifest carries a build date), so its SHA drifts over time. A checksum mismatch
-# here therefore usually means an upstream rebuild, not corruption or tampering —
-# re-verify the jar is genuine tla2tools (manifest Main-class tlc2.TLC, Microsoft
-# vendor) and bump this pin. The pin stays so an UNEXPECTED artifact still fails
-# loudly rather than silently running arbitrary downloaded code.
-# Last bumped 2026-09-11 for the upstream rebuild dated 2026-09-10. Verified
-# before bumping, per the note above: manifest Main-class tlc2.TLC,
-# Implementation-Title "TLA+ Tools", Implementation-Vendor "Microsoft Corp.",
-# Implementation-Version "2.0 2026-09-10", X-Git-Revision
-# c3af5e2dcc6e54860e96b8e7adf7509d3f685d25 on tlaplus master, tlc2/TLC.class
-# present, downloaded from the official tlaplus/tlaplus v1.8.0 release URL
-# (asset re-uploaded 2026-09-10T19:16:09Z, 4490846 bytes).
-TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-957b23b2bb31d08f19346e105e23585f93fea9a139a712b0ac347eedaf26afea}"
+TLA2TOOLS_VERSION="${TLA2TOOLS_VERSION:-1.7.4}"
+# SHA256 of the tla2tools.jar attached to the v1.7.4 GitHub release — the
+# latest STABLE (non-prerelease) tlaplus release. Its asset has been immutable
+# since 2024-08-08. Do NOT move this to v1.8.0: that tag is marked prerelease
+# and the tlaplus project re-uploads its assets on every master push (the jar
+# manifest carries a build date), so a v1.8.0 pin drifts daily and the job
+# fails at this checksum step on unrelated PRs (#3685, #3723, then again the
+# same afternoon). The pin stays so an UNEXPECTED artifact still fails loudly
+# rather than silently running arbitrary downloaded code.
+# Verified before pinning: manifest Main-class tlc2.TLC, Implementation-Title
+# "TLA+ Tools", Implementation-Vendor "Microsoft Corp.", Implementation-Version
+# "2.0 2024-08-08", X-Git-ShortRevision 5a47802, tlc2/TLC.class present,
+# 2274532 bytes, downloaded from the official tlaplus/tlaplus v1.7.4 release
+# URL; every green and negative config in this script passes on it.
+TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88}"
 
 REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 SPECS_DIR="${REPO_ROOT}/docs/rfc/specs"
```

---

### Incident Patch 3: `89dc34df` (2026-09-11)
**Commit Message**: hack/run-tlc: bump the tla2tools pin for the 2026-09-10 rebuild (#3723)

The tlaplus project re-uploaded the v1.8.0 tla2tools.jar release asset on
2026-09-10 (manifest Implementation-Version "2.0 2026-09-10", X-Git-Revision
c3af5e2dcc6e54860e96b8e7adf7509d3f685d25), so the pinned SHA256 no longer
matches and the tlc job fails at the checksum step on every PR. Verified the
new jar per the note in the script (Main-class tlc2.TLC, Implementation-Vendor
Microsoft Corp., tlc2/TLC.class present, size matches the release asset) and
bumped the pin.

**File**: `hack/run-tlc.sh` (modified, +6/-5)
```diff
@@ -22,13 +22,14 @@ TLA2TOOLS_VERSION="${TLA2TOOLS_VERSION:-1.8.0}"
 # re-verify the jar is genuine tla2tools (manifest Main-class tlc2.TLC, Microsoft
 # vendor) and bump this pin. The pin stays so an UNEXPECTED artifact still fails
 # loudly rather than silently running arbitrary downloaded code.
-# Last bumped 2026-08-17 for the upstream rebuild dated 2026-08-11. Verified
+# Last bumped 2026-09-11 for the upstream rebuild dated 2026-09-10. Verified
 # before bumping, per the note above: manifest Main-class tlc2.TLC,
 # Implementation-Title "TLA+ Tools", Implementation-Vendor "Microsoft Corp.",
-# Implementation-Version "2.0 2026-08-11", X-Git-Revision
-# 0894c3407f4717fec7cc18bde3bf3c857fa47333 on tlaplus master, tlc2/TLC.class
-# present, downloaded from the official tlaplus/tlaplus v1.8.0 release URL.
-TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-eabd140a70f49eb9305a3bd3f3df944eddf87e5a90d329789085f8953a80533a}"
+# Implementation-Version "2.0 2026-09-10", X-Git-Revision
+# c3af5e2dcc6e54860e96b8e7adf7509d3f685d25 on tlaplus master, tlc2/TLC.class
+# present, downloaded from the official tlaplus/tlaplus v1.8.0 release URL
+# (asset re-uploaded 2026-09-10T19:16:09Z, 4490846 bytes).
+TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-957b23b2bb31d08f19346e105e23585f93fea9a139a712b0ac347eedaf26afea}"
 
 REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 SPECS_DIR="${REPO_ROOT}/docs/rfc/specs"
```

---

### Incident Patch 4: `0052b003` (2026-08-22)
**Commit Message**: test: golden-pin JSON byte contracts and v1 wire fixtures ahead of json/v2 (#3694)

* test: pin the JSON byte-stability contracts ahead of the json/v2 migration

Golden tests fix the exact sha256 output of builderSpecHash and
envRuntimeHash for canonical fixtures, so any marshaler change (including
a future encoding/json/v2 migration) fails loudly instead of shipping a
silent cluster-wide builder rebuild or warm-pool roll.

Comments mark the four sites that stay on encoding/json (v1)
permanently: the two hash sites, the kubewatcher payload printer
(user-visible null-vs-[] emission), and the poolmgr StrategicMergePatch
marshal (null means field deletion in merge-patch semantics).

* test: capture v1 JSON wire fixtures as the compat gate for json/v2

Byte-golden and round-trip fixtures for every durable or cross-version
JSON surface, captured while the tree is still entirely on
encoding/json (v1): workflow checkpoint docs and event payloads, async
Envelope/ResultEnvelope queue payloads, the DLQ two-type probe, MQ
EgressJob, the fetcher statetoken file read by cross-language SDKs, the
fetcher specialize request decoded by long-lived pool-pod fetchers, the
executor client's fv1.Functio

**File**: `hack/run-tlc.sh` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ TLA2TOOLS_VERSION="${TLA2TOOLS_VERSION:-1.8.0}"
 # Implementation-Version "2.0 2026-08-11", X-Git-Revision
 # 0894c3407f4717fec7cc18bde3bf3c857fa47333 on tlaplus master, tlc2/TLC.class
 # present, downloaded from the official tlaplus/tlaplus v1.8.0 release URL.
-TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-ab323b79802aedc3203b3f9af37c6aca3ed43f4e0225b36f2aa77b26de46c05f}"
+TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-eabd140a70f49eb9305a3bd3f3df944eddf87e5a90d329789085f8953a80533a}"
 
 REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 SPECS_DIR="${REPO_ROOT}/docs/rfc/specs"
```

**File**: `pkg/builder/jsonwire_compat_test.go` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package builder
+
+import (
+	"encoding/json"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// compat gate for the json/v2 migration — cross-version RPC wire (rolling-upgrade
+// skew; builder images and pool pods outlive releases); if this fails after a
+// migration commit, add compat options at the marshal site, do not update the
+// fixture.
+//
+// PackageBuildRequest/PackageBuildResponse are the buildermgr<->builder wire
+// types (pkg/builder/client, and the Handler/reply methods in builder.go).
+// The builder binary is baked into environment builder images that are NOT
+// rebuilt per Fission release, so a buildermgr on a new release can be talking
+// to a builder pod running an old image (and vice versa during a rolling
+// upgrade) for a long skew window — any drift in these bytes breaks that pair
+// silently. Both types happen to have no `omitempty` tags at all, so these
+// fixtures pin plain field-value fidelity rather than the struct-omitempty
+// defaulting risk (see pkg/executor/client and pkg/storagesvc for that case).
+
+func TestPackageBuildRequestJSONWireCompat(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name   string
+		req    PackageBuildRequest
+		golden string
+	}{
+		{
+			name: "full",
+			req: PackageBuildRequest{
+				SrcPkgFilename: "pkg-abc123",
+				BuildCommand:   "npm run build",
+			},
+			golden: `{"srcPkgFilename":"pkg-abc123","command":"npm run build"}`,
+		},
+		{
+			name:   "zero_heavy",
+			req:    PackageBuildRequest{},
+			golden: `{"srcPkgFilename":"","command":""}`,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			body, err := json.Marshal(tc.req)
+			require.NoError(t, err)
+			require.Equal(t, tc.golden, string(body),
+				"compat gate for the json/v2 migration — cross-version RPC wire "+
+					"(rolling-upgrade skew; builder images and pool pods outlive "+
+					"releases); if this fails after a migration commit, add compat "+
+					"options at the marshal site, do not update the fixture")
+
+			var decoded PackageBuildRequest
+			require.NoError(t, json.Unmarshal([]byte(tc.golden), &decoded))
+			assert.Equal(t, tc.req, decoded)
+		})
+	}
+}
+
+func TestPackageBuildResponseJSONWireCompat(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name   string
+		resp   PackageBuildResponse
+		golden string
+	}{
+		{
+			name: "full",
+			resp: PackageBuildResponse{
+				ArtifactFilename: "deploy-abc123-xyz",
+				BuildLogs:        "build succeeded\ndone in 4.2s\n",
+			},
+			golden: `{"artifactFilename":"deploy-abc123-xyz","buildLogs":"build succeeded\ndone in 4.2s\n"}`,
+		},
+		{
+			name:   "zero_heavy",
+			resp:   PackageBuildResponse{},
+			golden: `{"artifactFilename":"","buildLogs":""}`,
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			body, err := json.Marshal(tc.resp)
+			require.NoError(t, err)
+			require.Equal(t, tc.golden, string(body),
+				"compat gate for the json/v2 migration — cross-version RPC wire "+
+					"(rolling-upgrade skew; builder images and pool pods outlive "+
+					"releases); if this fails after a migration commit, add compat "+
+					"options at the marshal site, do not update the fixture")
+
+			var decoded PackageBuildResponse
+			require.NoError(t, json.Unmarshal([]byte(tc.golden), &decoded))
+			assert.Equal(t, tc.resp, decoded)
+		})
+	}
+}
```

**File**: `pkg/buildermgr/environment_reconciler.go` (modified, +5/-0)
```diff
@@ -637,6 +637,11 @@ func (r *EnvironmentReconciler) genBuilderDeployment(env *fv1.Environment, ns st
 // Sorting by name is safe because container order carries no meaning here: the
 // entrypoint is chosen by name, and init containers are appended by the same
 // merge rather than ordered by the user.
+//
+// This site stays on encoding/json (v1) permanently: the hash is a byte-level
+// contract compared against values stamped by earlier releases, and json/v2
+// changes output bytes (nil slice/map emission, omitempty semantics,
+// escaping). TestBuilderSpecHashGolden pins the exact values.
 func builderSpecHash(tmpl *apiv1.PodTemplateSpec) (string, error) {
 	canonical := tmpl.DeepCopy()
 	sortByName(canonical.Spec.Containers)
```

**File**: `pkg/buildermgr/environment_reconciler_test.go` (modified, +61/-0)
```diff
@@ -475,3 +475,64 @@ func TestBuilderSpecHashIsStableAcrossCalls(t *testing.T) {
 			"hash must not depend on map iteration order (differed on call %d)", i+2)
 	}
 }
+
+// TestBuilderSpecHashGolden pins the exact output of builderSpecHash. The hash
+// is stamped on builder Deployments and compared on every reconcile: if the
+// value moves for an unchanged template, every environment's builder is torn
+// down and rebuilt on the release that shipped the change. This test exists so
+// that any change to canonicalisation, struct field order, or the JSON
+// marshaler feeding sha256 — including a future encoding/json/v2 migration —
+// fails loudly here instead of shipping a silent fleet-wide builder rebuild.
+//
+// If this test fails, DO NOT just update the constants: decide first whether a
+// one-time builder rebuild is acceptable for the release, and release-note it.
+func TestBuilderSpecHashGolden(t *testing.T) {
+	t.Parallel()
+
+	full := &apiv1.PodTemplateSpec{
+		ObjectMeta: metav1.ObjectMeta{
+			Labels: map[string]string{"envName": "golden", "owner": "buildermgr"},
+		},
+		Spec: apiv1.PodSpec{
+			Containers: []apiv1.Container{
+				{
+					Name:    "builder",
+					Image:   "fission/builder:1.2.3",
+					Command: []string{"/builder"},
+					Env: []apiv1.EnvVar{
+						{Name: "B", Value: "2"},
+						{Name: "A", Value: "1"},
+					},
+					VolumeMounts: []apiv1.VolumeMount{
+						{Name: "userfunc", MountPath: "/userfunc"},
+					},
+				},
+				{Name: "fetcher", Image: "fission/fetcher:1.2.3"},
+			},
+			Volumes: []apiv1.Volume{
+				{Name: "userfunc", VolumeSource: apiv1.VolumeSource{
+					EmptyDir: &apiv1.EmptyDirVolumeSource{},
+				}},
+			},
+		},
+	}
+	zero := &apiv1.PodTemplateSpec{}
+
+	tests := []struct {
+		name string
+		tmpl *apiv1.PodTemplateSpec
+		want string
+	}{
+		// Golden values captured on go1.27.0 (encoding/json v1 semantics).
+		{name: "fully populated", tmpl: full, want: "sha256:6693cf48ecdfdec04ee9911fb0326a148c6d702ab1262f7da3a2ae1b372bcef5"},
+		{name: "zero template", tmpl: zero, want: "sha256:103650a8e8747dd18003a892139ffabcb7111196e28ddc389da8e510ec1ef9d7"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			got, err := builderSpecHash(tt.tmpl)
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, got)
+		})
+	}
+}
```

**File**: `pkg/executor/client/jsonwire_compat_test.go` (added, +221/-0)
```diff
@@ -0,0 +1,221 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package client
+
+import (
+	"bytes"
+	"encoding/json"
+	"os"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	asv2 "k8s.io/api/autoscaling/v2"
+	apiv1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/api/resource"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+
+	fv1 "github.com/fission/fission/pkg/apis/core/v1"
+)
+
+// compat gate for the json/v2 migration — cross-version RPC wire (rolling-upgrade
+// skew; builder images and pool pods outlive releases); if this fails after a
+// migration commit, add compat options at the marshal site, do not update the
+// fixture.
+//
+// GetServiceForFunction / EnsureCapacity (pkg/executor/client/client.go) marshal
+// a full *fv1.Function as the RPC request body sent to the executor. fv1's CRD
+// types have several non-pointer struct fields tagged `omitempty` (e.g.
+// FunctionStatus, RetryPolicy) that v1's json.Marshal always emits even when
+// every field of the struct is zero, and several slice fields with no
+// `omitempty` at all (e.g. apiv1.PodSpec.Containers, reachable through
+// FunctionSpec.PodSpec) that v1 emits as JSON null when nil. encoding/json/v2's
+// default omitempty semantics treat a zero-valued struct as empty (it would be
+// OMITTED) and its default nil-slice behavior can differ from v1's `null` — a
+// silent wire-format change an old executor/builder/router on the other side of
+// a rolling upgrade would not tolerate. These tests pin today's exact v1 output
+// so a migration that changes it fails loudly here instead of in production.
+
+// richFunction returns a *fv1.Function with every optional section populated,
+// including the InvocationConfig.Retry sub-struct left at its all-pointers-nil
+// zero value to exercise the same struct-omitempty risk one level deeper.
+func richFunction() *fv1.Function {
+	idle := 120
+	maxAge := metav1.Duration{Duration: 300 * time.Second}
+	return &fv1.Function{
+		TypeMeta: metav1.TypeMeta{
+			Kind:       "Function",
+			APIVersion: "fission.io/v1",
+		},
+		ObjectMeta: metav1.ObjectMeta{
+			Name:            "rich-fn",
+			Namespace:       "test-ns",
+			ResourceVersion: "12345",
+			UID:             types.UID("11111111-1111-1111-1111-111111111111"),
+			Labels: map[string]string{
+				"app": "demo",
+				"env": "prod",
+			},
+			Annotations: map[string]string{
+				"note": "rich fixture",
+			},
+		},
+		Spec: fv1.FunctionSpec{
+			Environment: fv1.EnvironmentReference{
+				Namespace: "test-ns",
+				Name:      "nodejs",
+			},
+			Package: fv1.FunctionPackageRef{
+				PackageRef: fv1.PackageRef{
+					Namespace:       "test-ns",
+					Name:            "rich-pkg",
+					ResourceVersion: "1",
+				},
+				FunctionName: "handler",
+			},
+			Secrets: []fv1.SecretReference{
+				{Namespace: "test-ns", Name: "sec1", MountPath: "sec1"},
+				{Namespace: "test-ns", Name: "sec2"},
+			},
+			ConfigMaps: []fv1.ConfigMapReference{
+				{Namespace: "test-ns", Name: "cm1"},
+			},
+			Env: []apiv1.EnvVar{
+				{Name: "FOO", Value: "bar"},
+			},
+			Resources: apiv1.ResourceRequirements{
+				Limits: apiv1.ResourceList{
+					apiv1.ResourceCPU:    resource.MustParse("200m"),
+					apiv1.ResourceMemory: resource.MustParse("256Mi"),
+				},
+				Requests: apiv1.ResourceList{
+					apiv1.ResourceCPU:    resource.MustParse("100m"),
+					apiv1.ResourceMemory: resource.MustParse("128Mi"),
+				},
+			},
+			InvokeStrategy: fv1.InvokeStrategy{
+				ExecutionStrategy: fv1.ExecutionStrategy{
+					ExecutorType:          fv1.ExecutorTypePoolmgr,
+					MinScale:              1,
+					MaxScale:              3,
+					SpecializationTimeout: 120,
+					Metrics: []asv2.MetricSpec{
+						{Type: asv2.ResourceMetricSourceType},
+					},
+				},
+				StrategyType: fv1.StrategyTypeExecution,
+			},
+			FunctionTimeout: 60,
+			IdleTimeout:     &idle,
+			Streaming: &fv1.StreamingConfig{
+				Protocol:           fv1.StreamingSSE,
+				IdleTimeoutSeconds: 30,
+			},
+			Concurrency:    500,
+			RequestsPerPod: 1,
+			Invocation: &fv1.InvocationConfig{
+				Retry:  fv1.RetryPolicy{},
+				MaxAge: &maxAge,
+			},
+		},
+		Status: fv1.FunctionStatus{
+			ObservedGeneration:    3,
+			ProvisionedReady:      2,
+			ProvisionedTarget:     3,
+			ProvisionedSpecTarget: 5,
+		},
+	}
+}
+
+// zeroHeavyFunction returns a *fv1.Function with only Name/Namespace set and
+// every other field left at its Go zero value. This pins two v1 behaviors a
+// naive json/v2 migration would silently change: FunctionStatus (a non-pointer
+// struct tagged `status,omitempty`) is still emitted as `"status":{}` even
+// though every one of its fields is zero, and FunctionSpec.Resources (tagged
+// `resources` with no omitempty at all) is emitted as `"resources":{}`.
+func zeroHeavyFunction() *fv1.Function {
+	return &fv1.Function{
+		ObjectMeta: metav1.Obj
```

**File**: `pkg/executor/client/testdata/function_rich.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"kind":"Function","apiVersion":"fission.io/v1","metadata":{"name":"rich-fn","namespace":"test-ns","uid":"11111111-1111-1111-1111-111111111111","resourceVersion":"12345","labels":{"app":"demo","env":"prod"},"annotations":{"note":"rich fixture"}},"spec":{"environment":{"namespace":"test-ns","name":"nodejs"},"package":{"packageref":{"namespace":"test-ns","name":"rich-pkg","resourceversion":"1"},"functionName":"handler"},"secrets":[{"namespace":"test-ns","name":"sec1","mountPath":"sec1"},{"namespace":"test-ns","name":"sec2"}],"configmaps":[{"namespace":"test-ns","name":"cm1"}],"env":[{"name":"FOO","value":"bar"}],"resources":{"limits":{"cpu":"200m","memory":"256Mi"},"requests":{"cpu":"100m","memory":"128Mi"}},"InvokeStrategy":{"ExecutionStrategy":{"ExecutorType":"poolmgr","MinScale":1,"MaxScale":3,"TargetCPUPercent":0,"SpecializationTimeout":120,"hpaMetrics":[{"type":"Resource"}]},"StrategyType":"execution"},"functionTimeout":60,"idletimeout":120,"streaming":{"protocol":"sse","idleTimeoutSeconds":30},"invocation":{"retry":{},"maxAge":"5m0s"},"concurrency":500,"requestsPerPod":1},"status":{"observedGeneration":3,"provisionedReady":2,"provisionedTarget":3,"provisionedSpecTarget":5}}
```

**File**: `pkg/executor/client/testdata/function_zero_heavy.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"metadata":{"name":"zero-fn","namespace":"default"},"spec":{"environment":{"namespace":""},"package":{"packageref":{"namespace":""}},"resources":{},"InvokeStrategy":{"ExecutionStrategy":{"ExecutorType":"","MinScale":0,"MaxScale":0,"TargetCPUPercent":0,"SpecializationTimeout":0},"StrategyType":""}},"status":{}}
```

**File**: `pkg/executor/executortype/poolmgr/common.go` (modified, +4/-0)
```diff
@@ -31,6 +31,10 @@ import (
 // sorted), so the value is stable across processes. Changing this function's
 // input set in a future release costs at most one warm-pod recycle wave on
 // the upgrade that ships the change — document it there if it happens.
+//
+// This site stays on encoding/json (v1) permanently: the hash is a byte-level
+// contract, and json/v2 changes output bytes (nil-map emission, omitempty
+// semantics, escaping). TestEnvRuntimeHashGolden pins the exact values.
 func envRuntimeHash(env *fv1.Environment) string {
 	in := struct {
 		Runtime     fv1.Runtime                `json:"runtime"`
```

---

### Incident Patch 5: `ab333fe4` (2026-08-18)
**Commit Message**: antislop: bump to v0.2.0 and drop the shell workaround (#3686)

v0.2.0 implements natively what hack/antislop.sh was hand-rolling, so
the script goes: 158 lines of bash replaced by two Makefile targets.

The gate is now 'go tool antislop -baseline <file> ./...'. The script
existed only because the analyzer had no baseline flag and no way to
scope a rule to a path, so it reimplemented both — summarising findings
into '<count> <file> <analyzer>' rows, comparing them with awk, and
guarding the exit codes by hand. The baseline file is byte-comparable
either way; only its header changed, now that the tool writes it.

nostructuralnames is ON again. It was disabled for the whole module
because "route shape" is RFC-0013 vocabulary, exposed as the metric
label value shape_changed and in HTTPTrigger condition messages —
giving up the rule everywhere to accommodate one package.
-nostructuralnames.exclude 'pkg/router/...' scopes it instead, and the
finding count is unchanged at 65: every finding the rule reports is in
pkg/router, so nothing outside it was being masked, and the rule now
guards the rest of the tree again.

make antislop gates; make antislop-update re-records. The policy
rational

**File**: `Makefile` (modified, +29/-4)
```diff
@@ -38,12 +38,37 @@ code-checks: verify-gomod
 # Gate the tree with the antislop analyzers (low-evidence Go patterns: any in
 # signatures, narrowing out of any, reflect, structural names, untyped
 # decoding) against hack/antislop-baseline.txt. Runs in CI (lint.yaml); the
-# analyzer is pinned by the tool directive in go.mod. Kept out of code-checks
-# so `make test-run`/`check` stay golangci-only. See hack/antislop.sh for the
-# baseline contract and `hack/antislop.sh --list` for every finding.
+# analyzer is pinned by the tool directive in go.mod.
+#
+# The baseline is a ratchet: a file/analyzer pair that is missing or grows
+# fails the gate, one that shrinks passes and can be re-recorded with
+# `make antislop-update`. Everything in it today is pkg/workflow, and it is
+# one claim — the workflow engine addresses ARBITRARY USER JSON with JSONPath
+# (RFC-0022, Step Functions parity), so there is no named type to decode into.
+# Wrapping the document tree was designed and rejected: a json.RawMessage
+# Document re-decodes per Choice condition, and a generic Value[any] launders
+# the empty interface through a type parameter without adding evidence. The
+# engine-owned shapes that DO have a fixed schema are typed — see catchError
+# and branchErrorCause in pkg/workflow/fold.go.
+#
+# ANTISLOP_FLAGS records the one scoping decision: "route shape" is RFC-0013
+# vocabulary, exposed as the metric label value shape_changed and in
+# HTTPTrigger condition messages, so nostructuralnames is exempted for
+# pkg/router rather than turned off for the whole module.
+#
+# `go tool antislop ./...` on its own lists every finding, baselined or not.
+ANTISLOP_FLAGS ?= -nostructuralnames.exclude 'pkg/router/...'
+ANTISLOP_BASELINE ?= hack/antislop-baseline.txt
+
 .PHONY: antislop
 antislop:
-	hack/antislop.sh
+	go tool antislop $(ANTISLOP_FLAGS) -baseline $(ANTISLOP_BASELINE) ./...
+
+# Re-record the accepted set. Every new line is a design claim; justify it in
+# review rather than regenerating to make the gate quiet.
+.PHONY: antislop-update
+antislop-update:
+	go tool antislop $(ANTISLOP_FLAGS) -baseline $(ANTISLOP_BASELINE) -update ./...
 
 # Fail if go.mod does not keep direct and indirect requirements in separate
 # blocks. `go mod tidy` does not enforce this layout, so this guard does.
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -198,7 +198,7 @@ require (
 	github.com/rogpeppe/go-internal v1.15.0 // indirect
 	github.com/rs/xid v1.6.0 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
-	github.com/sanketsudake/antislop v0.1.0 // indirect
+	github.com/sanketsudake/antislop v0.2.0 // indirect
 	github.com/segmentio/asm v1.1.3 // indirect
 	github.com/segmentio/encoding v0.5.4 // indirect
 	github.com/sergi/go-diff v1.4.0 // indirect
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -453,6 +453,8 @@ github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06 h1:OkMGxebDj
 github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06/go.mod h1:+ePHsJ1keEjQtpvf9HHw0f4ZeJ0TLRsxhunSI2hYJSs=
 github.com/sanketsudake/antislop v0.1.0 h1:+tlU218vHEQt9n2D9rABiShwa/H7N5EPwxk+/MLBGmY=
 github.com/sanketsudake/antislop v0.1.0/go.mod h1:/g3pgt8Zj5nPLTIL5SB8qPhERXKVci5IeYcFGL9tzao=
+github.com/sanketsudake/antislop v0.2.0 h1:1c5gcCUiv1pNCFGtTE/IyNSaHz1UsJi816YOJ+q52WY=
+github.com/sanketsudake/antislop v0.2.0/go.mod h1:/g3pgt8Zj5nPLTIL5SB8qPhERXKVci5IeYcFGL9tzao=
 github.com/sanketsudake/go-portless v0.4.0 h1:jT2dF5Fbe84SI1mXe54bqY9jXTWZCVIEaJtX6hjki+k=
 github.com/sanketsudake/go-portless v0.4.0/go.mod h1:jRGHM6BOYLizSy8fvFfQOX9pmBayEuAWpOz8GYhrPbI=
 github.com/sanketsudake/go-portless/k8s v0.3.0 h1:upMXPHIcFPeeQXIUTxUlfgvxVbMZx3oqXWyBOrYj3VU=
```

**File**: `hack/antislop-baseline.txt` (modified, +11/-26)
```diff
@@ -1,44 +1,29 @@
-# antislop findings accepted for this repository.
+# antislop findings accepted for this tree, written by 'antislop -baseline <file> -update'.
 #
-# Format: <count> <file> <analyzer>. No line numbers on purpose — an
-# edit above a finding must not churn this file. Regenerate with
-# 'hack/antislop.sh --update'; the gate is 'hack/antislop.sh'.
+# Format: <count> <file> <analyzer>. No line numbers on purpose, so an edit
+# above a finding does not churn this file.
 #
-# Everything listed here is pkg/workflow, and all of it is one claim:
-# the workflow engine addresses ARBITRARY USER JSON with JSONPath
-# (RFC-0022, Step Functions parity), so there is no named type to
-# decode into — the schema belongs to the user, not to us. Wrapping
-# the tree was designed and rejected: a json.RawMessage-backed
-# Document re-decodes the whole document per Choice condition, and a
-# generic Value[any] launders the empty interface through a type
-# parameter without adding any evidence. Each narrowing site here is
-# a comma-ok or a type switch whose default branch is correct.
-#
-# The engine-owned shapes that DO have a fixed schema are typed:
-# see catchError / branchErrorCause in pkg/workflow/fold.go. The two
-# noknownwidening entries are those structs being handed to
-# expr.Path.SetResult, which takes any because the tree it writes
-# into is user JSON.
-#
-# Adding a line here is a design claim. Justify it in review.
+# The gate fails when a file/analyzer pair is missing from this list or its
+# count grows; a pair that shrinks passes. Every line is a claim that the
+# pattern is right for that file — justify new ones in review.
 1 pkg/workflow/decide_test.go noanycontainers
 1 pkg/workflow/decide_test.go nountypedunmarshal
 3 pkg/workflow/engine_branch_test.go noanycontainers
 3 pkg/workflow/engine_branch_test.go nountypedunmarshal
 2 pkg/workflow/engine_branch_test.go safetycomment
-18 pkg/workflow/expr/eval_test.go noanycontainers
-1 pkg/workflow/expr/eval_test.go noanyfields
 2 pkg/workflow/expr/eval.go noanyparams
 2 pkg/workflow/expr/eval.go noanyreturns
-1 pkg/workflow/fold_branch_test.go noanycontainers
-1 pkg/workflow/fold_branch_test.go nountypedunmarshal
+18 pkg/workflow/expr/eval_test.go noanycontainers
+1 pkg/workflow/expr/eval_test.go noanyfields
 1 pkg/workflow/fold.go noanyfields
 1 pkg/workflow/fold.go noanyreturns
 2 pkg/workflow/fold.go noknownwidening
 1 pkg/workflow/fold.go nonarrowany
 1 pkg/workflow/fold.go nountypedunmarshal
+1 pkg/workflow/fold_branch_test.go noanycontainers
+1 pkg/workflow/fold_branch_test.go nountypedunmarshal
 3 pkg/workflow/invoker.go nountypedunmarshal
-10 pkg/workflow/paths_test.go noanycontainers
 6 pkg/workflow/paths.go noanyparams
 2 pkg/workflow/paths.go noanyreturns
 3 pkg/workflow/paths.go nonarrowany
+10 pkg/workflow/paths_test.go noanycontainers
```

**File**: `hack/antislop.sh` (removed, +0/-158)
```diff
@@ -1,158 +0,0 @@
-#!/bin/bash
-# SPDX-FileCopyrightText: The Fission Authors
-#
-# SPDX-License-Identifier: Apache-2.0
-#
-# Runs the antislop analyzers (github.com/sanketsudake/antislop) over the
-# module. antislop rejects code that destroys or fabricates type evidence:
-# `any` in signatures, fields and containers, narrowing back out of `any`,
-# reflect, monkey patching, structural names, and untyped decoding.
-#
-# The analyzer is pinned by the `tool` directive in go.mod and invoked with
-# `go tool antislop`, the same way this repo pins addlicense, controller-gen
-# and setup-envtest. Set $ANTISLOP to a locally built binary to run an
-# unreleased build against the tree (for developing the analyzer itself).
-#
-# Usage:
-#   make antislop                    gate the tree against the baseline
-#   hack/antislop.sh                 same, directly
-#   hack/antislop.sh --list          print every finding, baselined or not
-#   hack/antislop.sh --update        rewrite the baseline from the current tree
-#   hack/antislop.sh ./pkg/router/…  report on specific packages (no gating)
-#
-# Gating is against hack/antislop-baseline.txt, which records the ACCEPTED
-# findings as "<count> <file> <analyzer>" — deliberately without line numbers,
-# so unrelated edits above a finding do not churn it. The gate fails when a
-# file/analyzer pair appears that the baseline does not list, or when a
-# baselined pair grows. A pair that shrinks passes.
-#
-# The cost of dropping line numbers is that a net-zero swap within one
-# file/analyzer pair — delete one finding, introduce another — is not caught.
-# Diff stability is worth more than catching that case; the alternative churns
-# the baseline on every edit above a finding.
-#
-# A baseline exists because the standalone binary has no per-package scoping
-# and honours no //nolint directive, so the only alternatives would be to
-# disable an analyzer for the whole module or to leave the tree ungated.
-# Read hack/antislop-baseline.txt before adding to it: every entry there is a
-# claim that `any` is the honest type at that spot, not a to-do.
-
-set -euo pipefail
-
-cd "$(dirname "$0")/.."
-
-BASELINE="hack/antislop-baseline.txt"
-
-if [ -n "${ANTISLOP:-}" ]; then
-	bin=("$ANTISLOP")
-else
-	# `go tool`, not `go run`: go run reports its own exit 1 for any non-zero
-	# child status, which would make "found findings" (3) indistinguishable
-	# from "failed to build" (1), and it writes progress lines into the
-	# stream the gate parses.
-	bin=(go tool antislop)
-fi
-
-# Flags that record deliberate policy for this repository. Add a comment for
-# every deviation from the analyzer defaults.
-#
-# nostructuralnames is off: its only default term is "shape", and in this
-# repository "route shape" is RFC-0013 vocabulary — the set of HTTPTrigger
-# fields whose change forces a mux rebuild — that is exposed as the metric
-# label value shape_changed / shape_change and in HTTPTrigger condition
-# messages. Renaming the identifiers alone would split the vocabulary and
-# renaming the labels is a user-visible metrics change. The analyzer has no
-# per-package exemption (-nostructuralnames.terms replaces the whole list).
-POLICY_FLAGS=(-nostructuralnames=false)
-
-# summarize turns raw findings into the baseline's "<count> <file> <analyzer>"
-# form, sorted so the file is stable across runs.
-summarize() {
-	sed -E 's#^\./##; s#^'"$PWD"'/##; s#:[0-9]+:[0-9]+: ([a-z]+):.*#\t\1#' |
-		sort | uniq -c | awk '{print $1, $2, $3}' | sort -k2,2 -k3,3
-}
-
-# run invokes the analyzer. Exit codes follow go/analysis singlechecker:
-# 0 = clean, 3 = diagnostics reported (the normal case here). Anything else
-# means it did not run at all — 1 for a package load error, 2 for a bad flag,
-# 127 for a missing binary. Those must never be mistaken for a clean tree, so
-# they abort loudly instead of yielding empty output the gate would read as
-# "no findings".
-run() {
-	local out status
-	out="$("${bin[@]}" "${POLICY_FLAGS[@]}" "$@" 2>&1)" && status=0 || status=$?
-	case "$status" in
-	0 | 3) ;;
-	*)
-		echo "antislop: analyzer did not run (exit $status):" >&2
-		echo "$out" >&2
-		exit 2
-		;;
-	esac
-	printf '%s\n' "$out"
-}
-
-case "${1:-}" in
---list)
-	run ./...
-	;;
---update)
-	{
-		echo "# antislop findings accepted for this repository."
-		echo "#"
-		echo "# Format: <count> <file> <analyzer>. No line numbers on purpose — an"
-		echo "# edit above a finding must not churn this file. Regenerate with"
-		echo "# 'hack/antislop.sh --update'; the gate is 'hack/antislop.sh'."
-		echo "#"
-		echo "# Everything listed here is pkg/workflow, and all of it is one claim:"
-		echo "# the workflow engine addresses ARBITRARY USER JSON with JSONPath"
-		echo "# (RFC-0022, Step Functions parity), so there is no named type to"
-		echo "# decode into — the schema belongs to the user, not to us. Wrapping"
-		echo "# the tree was designed and rejected: a json.RawMessage-backed"
-		echo "# Document re-decodes th
```

---

### Incident Patch 6: `413cd473` (2026-08-17)
**Commit Message**: hack/run-tlc: bump the tla2tools pin for the 2026-08-11 rebuild (#3685)

The tlaplus project rebuilt and re-uploaded the v1.8.0 release asset
again, so the pinned SHA no longer matches and every tlc run fails at
the checksum step. Same recurring drift the comment above the pin
describes; main last ran tlc green on 2026-08-04, before the rebuild.

Verified before bumping, per that comment: downloaded from the official
tlaplus/tlaplus v1.8.0 release URL, manifest Main-class tlc2.TLC,
Implementation-Title "TLA+ Tools", Implementation-Vendor "Microsoft
Corp.", Implementation-Version "2.0 2026-08-11", X-Git-Revision
0894c3407f4717fec7cc18bde3bf3c857fa47333 on tlaplus master,
tlc2/TLC.class present. Full suite run locally against the new jar: all
green configs pass and all four negative configs fail as designed.

**File**: `hack/run-tlc.sh` (modified, +6/-5)
```diff
@@ -22,12 +22,13 @@ TLA2TOOLS_VERSION="${TLA2TOOLS_VERSION:-1.8.0}"
 # re-verify the jar is genuine tla2tools (manifest Main-class tlc2.TLC, Microsoft
 # vendor) and bump this pin. The pin stays so an UNEXPECTED artifact still fails
 # loudly rather than silently running arbitrary downloaded code.
-# Last bumped 2026-08-02 for the upstream rebuild dated 2026-07-31. Verified
+# Last bumped 2026-08-17 for the upstream rebuild dated 2026-08-11. Verified
 # before bumping, per the note above: manifest Main-class tlc2.TLC,
-# Implementation-Vendor "Microsoft Corp.", Implementation-Version "2.0
-# 2026-07-31", tlc2/TLC.class present, downloaded from the official
-# tlaplus/tlaplus v1.8.0 release URL.
-TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-e22f8ffb4bacdea0a871f444dd94fe5fb0d8013b3388ae39e82e26f852c735d5}"
+# Implementation-Title "TLA+ Tools", Implementation-Vendor "Microsoft Corp.",
+# Implementation-Version "2.0 2026-08-11", X-Git-Revision
+# 0894c3407f4717fec7cc18bde3bf3c857fa47333 on tlaplus master, tlc2/TLC.class
+# present, downloaded from the official tlaplus/tlaplus v1.8.0 release URL.
+TLA2TOOLS_SHA256="${TLA2TOOLS_SHA256:-ab323b79802aedc3203b3f9af37c6aca3ed43f4e0225b36f2aa77b26de46c05f}"
 
 REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 SPECS_DIR="${REPO_ROOT}/docs/rfc/specs"
```

---

### Incident Patch 7: `abcb8dec` (2026-08-17)
**Commit Message**: Remove low-evidence Go patterns; fix --graceperiod defaulting to 0 (#3684)

* throttler: make RunOnce generic over the callback result

RunOnce returned the callback's result as an untyped value, so every
caller narrowed it back with a type assertion (and two of them panicked
on a mismatch that the compiler can now rule out). It is a package-level
generic function now; the follower-timeout path returns the zero T with
the error, and the router resolver checks err instead of a nil result.

Adds a synctest-based test for the follower-timeout path.

* poolmgr: store a typed value in podFSVCMap

The pod→function/address map held a two-element []any that the CPU
metrics collector unpacked with a pair of type assertions. Store a
podFuncSvc struct instead; the one remaining assertion on sync.Map.Load
carries its SAFETY invariant.

* poolmgr: build the pod relabel patch from a typed struct

Replaces the nested map[string]any literal with podRelabelPatch. No
omitempty on the maps on purpose: a nil map must still marshal as null
(delete semantics under StrategicMergePatchType).

* canaryconfigmgr: switch on the prometheus value type directly

executeQuery compared val.Type() and then asserte

**File**: `.github/workflows/lint.yaml` (modified, +7/-0)
```diff
@@ -75,6 +75,13 @@ jobs:
           version: ${{ env.GOLANGCI_LINT_VERSION }}
           args: --timeout=${{ env.GOLANGCI_LINT_TIMEOUT }}
 
+      # Gates low-evidence Go patterns against hack/antislop-baseline.txt.
+      # Fails on a finding the baseline does not already accept; see
+      # hack/antislop.sh for the contract. The analyzer is pinned by the
+      # tool directive in go.mod.
+      - name: Run antislop
+        run: make antislop
+
       - name: Detect git changes
         if: always()
         run: |
```

**File**: `Makefile` (modified, +10/-0)
```diff
@@ -35,6 +35,16 @@ check: test-run build-fission-cli clean
 code-checks: verify-gomod
 	golangci-lint run
 
+# Gate the tree with the antislop analyzers (low-evidence Go patterns: any in
+# signatures, narrowing out of any, reflect, structural names, untyped
+# decoding) against hack/antislop-baseline.txt. Runs in CI (lint.yaml); the
+# analyzer is pinned by the tool directive in go.mod. Kept out of code-checks
+# so `make test-run`/`check` stay golangci-only. See hack/antislop.sh for the
+# baseline contract and `hack/antislop.sh --list` for every finding.
+.PHONY: antislop
+antislop:
+	hack/antislop.sh
+
 # Fail if go.mod does not keep direct and indirect requirements in separate
 # blocks. `go mod tidy` does not enforce this layout, so this guard does.
 # Convention: .claude/resources/go-mod-conventions.md
```

**File**: `cmd/preupgradechecks/applycrds_test.go` (modified, +4/-3)
```diff
@@ -14,6 +14,7 @@ import (
 
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 
 	"github.com/fission/fission/crds"
 )
@@ -38,10 +39,10 @@ func TestEmbeddedCRDsAreApplyable(t *testing.T) {
 
 		// The apply body must be valid JSON carrying the same identity, or
 		// the apiserver rejects the patch.
-		var decoded map[string]any
+		var decoded metav1.TypeMeta
 		require.NoError(t, json.Unmarshal(body, &decoded), m.Name)
-		assert.Equal(t, "apiextensions.k8s.io/v1", decoded["apiVersion"], m.Name)
-		assert.Equal(t, "CustomResourceDefinition", decoded["kind"], m.Name)
+		assert.Equal(t, "apiextensions.k8s.io/v1", decoded.APIVersion, m.Name)
+		assert.Equal(t, "CustomResourceDefinition", decoded.Kind, m.Name)
 	}
 
 	// Spot-check the CRDs the control plane cannot start without, so a
```

**File**: `go.mod` (modified, +2/-0)
```diff
@@ -198,6 +198,7 @@ require (
 	github.com/rogpeppe/go-internal v1.15.0 // indirect
 	github.com/rs/xid v1.6.0 // indirect
 	github.com/russross/blackfriday/v2 v2.1.0 // indirect
+	github.com/sanketsudake/antislop v0.1.0 // indirect
 	github.com/segmentio/asm v1.1.3 // indirect
 	github.com/segmentio/encoding v0.5.4 // indirect
 	github.com/sergi/go-diff v1.4.0 // indirect
@@ -256,6 +257,7 @@ require (
 tool (
 	github.com/elastic/crd-ref-docs
 	github.com/google/addlicense
+	github.com/sanketsudake/antislop/cmd/antislop
 	k8s.io/code-generator
 	sigs.k8s.io/controller-runtime/tools/setup-envtest
 	sigs.k8s.io/controller-tools/cmd/controller-gen
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -451,6 +451,8 @@ github.com/russross/blackfriday/v2 v2.1.0/go.mod h1:+Rmxgy9KzJVeS9/2gXHxylqXiyQD
 github.com/rwcarlsen/goexif v0.0.0-20190401172101-9e8deecbddbd/go.mod h1:hPqNNc0+uJM6H+SuU8sEs5K5IQeKccPqeSjfgcKGgPk=
 github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06 h1:OkMGxebDjyw0ULyrTYWeN0UNCCkmCWfjPnIA2W6oviI=
 github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06/go.mod h1:+ePHsJ1keEjQtpvf9HHw0f4ZeJ0TLRsxhunSI2hYJSs=
+github.com/sanketsudake/antislop v0.1.0 h1:+tlU218vHEQt9n2D9rABiShwa/H7N5EPwxk+/MLBGmY=
+github.com/sanketsudake/antislop v0.1.0/go.mod h1:/g3pgt8Zj5nPLTIL5SB8qPhERXKVci5IeYcFGL9tzao=
 github.com/sanketsudake/go-portless v0.4.0 h1:jT2dF5Fbe84SI1mXe54bqY9jXTWZCVIEaJtX6hjki+k=
 github.com/sanketsudake/go-portless v0.4.0/go.mod h1:jRGHM6BOYLizSy8fvFfQOX9pmBayEuAWpOz8GYhrPbI=
 github.com/sanketsudake/go-portless/k8s v0.3.0 h1:upMXPHIcFPeeQXIUTxUlfgvxVbMZx3oqXWyBOrYj3VU=
```

**File**: `hack/antislop-baseline.txt` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# antislop findings accepted for this repository.
+#
+# Format: <count> <file> <analyzer>. No line numbers on purpose — an
+# edit above a finding must not churn this file. Regenerate with
+# 'hack/antislop.sh --update'; the gate is 'hack/antislop.sh'.
+#
+# Everything listed here is pkg/workflow, and all of it is one claim:
+# the workflow engine addresses ARBITRARY USER JSON with JSONPath
+# (RFC-0022, Step Functions parity), so there is no named type to
+# decode into — the schema belongs to the user, not to us. Wrapping
+# the tree was designed and rejected: a json.RawMessage-backed
+# Document re-decodes the whole document per Choice condition, and a
+# generic Value[any] launders the empty interface through a type
+# parameter without adding any evidence. Each narrowing site here is
+# a comma-ok or a type switch whose default branch is correct.
+#
+# The engine-owned shapes that DO have a fixed schema are typed:
+# see catchError / branchErrorCause in pkg/workflow/fold.go. The two
+# noknownwidening entries are those structs being handed to
+# expr.Path.SetResult, which takes any because the tree it writes
+# into is user JSON.
+#
+# Adding a line here is a design claim. Justify it in review.
+1 pkg/workflow/decide_test.go noanycontainers
+1 pkg/workflow/decide_test.go nountypedunmarshal
+3 pkg/workflow/engine_branch_test.go noanycontainers
+3 pkg/workflow/engine_branch_test.go nountypedunmarshal
+2 pkg/workflow/engine_branch_test.go safetycomment
+18 pkg/workflow/expr/eval_test.go noanycontainers
+1 pkg/workflow/expr/eval_test.go noanyfields
+2 pkg/workflow/expr/eval.go noanyparams
+2 pkg/workflow/expr/eval.go noanyreturns
+1 pkg/workflow/fold_branch_test.go noanycontainers
+1 pkg/workflow/fold_branch_test.go nountypedunmarshal
+1 pkg/workflow/fold.go noanyfields
+1 pkg/workflow/fold.go noanyreturns
+2 pkg/workflow/fold.go noknownwidening
+1 pkg/workflow/fold.go nonarrowany
+1 pkg/workflow/fold.go nountypedunmarshal
+3 pkg/workflow/invoker.go nountypedunmarshal
+10 pkg/workflow/paths_test.go noanycontainers
+6 pkg/workflow/paths.go noanyparams
+2 pkg/workflow/paths.go noanyreturns
+3 pkg/workflow/paths.go nonarrowany
```

**File**: `hack/antislop.sh` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+#!/bin/bash
+# SPDX-FileCopyrightText: The Fission Authors
+#
+# SPDX-License-Identifier: Apache-2.0
+#
+# Runs the antislop analyzers (github.com/sanketsudake/antislop) over the
+# module. antislop rejects code that destroys or fabricates type evidence:
+# `any` in signatures, fields and containers, narrowing back out of `any`,
+# reflect, monkey patching, structural names, and untyped decoding.
+#
+# The analyzer is pinned by the `tool` directive in go.mod and invoked with
+# `go tool antislop`, the same way this repo pins addlicense, controller-gen
+# and setup-envtest. Set $ANTISLOP to a locally built binary to run an
+# unreleased build against the tree (for developing the analyzer itself).
+#
+# Usage:
+#   make antislop                    gate the tree against the baseline
+#   hack/antislop.sh                 same, directly
+#   hack/antislop.sh --list          print every finding, baselined or not
+#   hack/antislop.sh --update        rewrite the baseline from the current tree
+#   hack/antislop.sh ./pkg/router/…  report on specific packages (no gating)
+#
+# Gating is against hack/antislop-baseline.txt, which records the ACCEPTED
+# findings as "<count> <file> <analyzer>" — deliberately without line numbers,
+# so unrelated edits above a finding do not churn it. The gate fails when a
+# file/analyzer pair appears that the baseline does not list, or when a
+# baselined pair grows. A pair that shrinks passes.
+#
+# The cost of dropping line numbers is that a net-zero swap within one
+# file/analyzer pair — delete one finding, introduce another — is not caught.
+# Diff stability is worth more than catching that case; the alternative churns
+# the baseline on every edit above a finding.
+#
+# A baseline exists because the standalone binary has no per-package scoping
+# and honours no //nolint directive, so the only alternatives would be to
+# disable an analyzer for the whole module or to leave the tree ungated.
+# Read hack/antislop-baseline.txt before adding to it: every entry there is a
+# claim that `any` is the honest type at that spot, not a to-do.
+
+set -euo pipefail
+
+cd "$(dirname "$0")/.."
+
+BASELINE="hack/antislop-baseline.txt"
+
+if [ -n "${ANTISLOP:-}" ]; then
+	bin=("$ANTISLOP")
+else
+	# `go tool`, not `go run`: go run reports its own exit 1 for any non-zero
+	# child status, which would make "found findings" (3) indistinguishable
+	# from "failed to build" (1), and it writes progress lines into the
+	# stream the gate parses.
+	bin=(go tool antislop)
+fi
+
+# Flags that record deliberate policy for this repository. Add a comment for
+# every deviation from the analyzer defaults.
+#
+# nostructuralnames is off: its only default term is "shape", and in this
+# repository "route shape" is RFC-0013 vocabulary — the set of HTTPTrigger
+# fields whose change forces a mux rebuild — that is exposed as the metric
+# label value shape_changed / shape_change and in HTTPTrigger condition
+# messages. Renaming the identifiers alone would split the vocabulary and
+# renaming the labels is a user-visible metrics change. The analyzer has no
+# per-package exemption (-nostructuralnames.terms replaces the whole list).
+POLICY_FLAGS=(-nostructuralnames=false)
+
+# summarize turns raw findings into the baseline's "<count> <file> <analyzer>"
+# form, sorted so the file is stable across runs.
+summarize() {
+	sed -E 's#^\./##; s#^'"$PWD"'/##; s#:[0-9]+:[0-9]+: ([a-z]+):.*#\t\1#' |
+		sort | uniq -c | awk '{print $1, $2, $3}' | sort -k2,2 -k3,3
+}
+
+# run invokes the analyzer. Exit codes follow go/analysis singlechecker:
+# 0 = clean, 3 = diagnostics reported (the normal case here). Anything else
+# means it did not run at all — 1 for a package load error, 2 for a bad flag,
+# 127 for a missing binary. Those must never be mistaken for a clean tree, so
+# they abort loudly instead of yielding empty output the gate would read as
+# "no findings".
+run() {
+	local out status
+	out="$("${bin[@]}" "${POLICY_FLAGS[@]}" "$@" 2>&1)" && status=0 || status=$?
+	case "$status" in
+	0 | 3) ;;
+	*)
+		echo "antislop: analyzer did not run (exit $status):" >&2
+		echo "$out" >&2
+		exit 2
+		;;
+	esac
+	printf '%s\n' "$out"
+}
+
+case "${1:-}" in
+--list)
+	run ./...
+	;;
+--update)
+	{
+		echo "# antislop findings accepted for this repository."
+		echo "#"
+		echo "# Format: <count> <file> <analyzer>. No line numbers on purpose — an"
+		echo "# edit above a finding must not churn this file. Regenerate with"
+		echo "# 'hack/antislop.sh --update'; the gate is 'hack/antislop.sh'."
+		echo "#"
+		echo "# Everything listed here is pkg/workflow, and all of it is one claim:"
+		echo "# the workflow engine addresses ARBITRARY USER JSON with JSONPath"
+		echo "# (RFC-0022, Step Functions parity), so there is no named type to"
+		echo "# decode into — the schema belongs to the user, not to us. Wrapping"
+		echo "# the tree was designed and rejected: a json.RawMessage-backed"
+		echo "# Document re-decodes th
```

**File**: `pkg/apis/core/v1/status_test.go` (modified, +70/-137)
```diff
@@ -38,135 +38,93 @@ func sampleConditions() []metav1.Condition {
 	}
 }
 
-// statusCase couples a Status value with a freshly-constructed empty value
-// for unmarshal targets — needed because *Status types are distinct and we
-// want to keep this table generic over them.
-type statusCase struct {
-	name string
-	// got is the populated value to marshal.
-	got any
-	// fresh returns a zero-valued instance of the same concrete type.
-	fresh func() any
+// roundTripJSON marshals got, unmarshals into a fresh T and compares the JSON
+// projections. Comparing the round-tripped Go value to the original via deep
+// equality is brittle because metav1.Time embeds a time.Time whose
+// *time.Location pointer differs after unmarshal even though the instant is
+// identical; the JSON projection is the contract the apiserver and clients
+// actually care about.
+func roundTripJSON[T any](t *testing.T, got T) {
+	t.Helper()
+	first, err := json.Marshal(got)
+	require.NoError(t, err)
+
+	var target T
+	require.NoError(t, json.Unmarshal(first, &target))
+
+	second, err := json.Marshal(target)
+	require.NoError(t, err)
+	require.JSONEq(t, string(first), string(second))
 }
 
-func statusCases() []statusCase {
+func TestStatusJSONRoundTrip(t *testing.T) {
 	conds := sampleConditions()
-	return []statusCase{
-		{
-			name:  "FunctionStatus",
-			got:   FunctionStatus{ObservedGeneration: 7, Conditions: conds},
-			fresh: func() any { return &FunctionStatus{} },
-		},
-		{
-			name:  "EnvironmentStatus",
-			got:   EnvironmentStatus{ObservedGeneration: 3, Conditions: conds},
-			fresh: func() any { return &EnvironmentStatus{} },
-		},
-		{
-			name:  "HTTPTriggerStatus",
-			got:   HTTPTriggerStatus{ObservedGeneration: 1, Conditions: conds},
-			fresh: func() any { return &HTTPTriggerStatus{} },
-		},
-		{
-			name:  "KubernetesWatchTriggerStatus",
-			got:   KubernetesWatchTriggerStatus{ObservedGeneration: 2, Conditions: conds},
-			fresh: func() any { return &KubernetesWatchTriggerStatus{} },
-		},
-		{
-			name:  "TimeTriggerStatus",
-			got:   TimeTriggerStatus{ObservedGeneration: 4, Conditions: conds},
-			fresh: func() any { return &TimeTriggerStatus{} },
-		},
-		{
-			name:  "MessageQueueTriggerStatus",
-			got:   MessageQueueTriggerStatus{ObservedGeneration: 5, Conditions: conds},
-			fresh: func() any { return &MessageQueueTriggerStatus{} },
-		},
-		{
-			name: "PackageStatus",
-			got: PackageStatus{
+	cases := []struct {
+		name string
+		run  func(t *testing.T)
+	}{
+		{"FunctionStatus", func(t *testing.T) { roundTripJSON(t, FunctionStatus{ObservedGeneration: 7, Conditions: conds}) }},
+		{"EnvironmentStatus", func(t *testing.T) { roundTripJSON(t, EnvironmentStatus{ObservedGeneration: 3, Conditions: conds}) }},
+		{"HTTPTriggerStatus", func(t *testing.T) { roundTripJSON(t, HTTPTriggerStatus{ObservedGeneration: 1, Conditions: conds}) }},
+		{"KubernetesWatchTriggerStatus", func(t *testing.T) {
+			roundTripJSON(t, KubernetesWatchTriggerStatus{ObservedGeneration: 2, Conditions: conds})
+		}},
+		{"TimeTriggerStatus", func(t *testing.T) { roundTripJSON(t, TimeTriggerStatus{ObservedGeneration: 4, Conditions: conds}) }},
+		{"MessageQueueTriggerStatus", func(t *testing.T) {
+			roundTripJSON(t, MessageQueueTriggerStatus{ObservedGeneration: 5, Conditions: conds})
+		}},
+		{"PackageStatus", func(t *testing.T) {
+			roundTripJSON(t, PackageStatus{
 				BuildStatus:         BuildStatusSucceeded,
 				BuildLog:            "ok",
 				LastUpdateTimestamp: metav1.NewTime(time.Date(2026, time.May, 1, 12, 0, 0, 0, time.UTC)),
 				Conditions:          conds,
-			},
-			fresh: func() any { return &PackageStatus{} },
-		},
-		{
-			name:  "CanaryConfigStatus",
-			got:   CanaryConfigStatus{Status: "Pending", Conditions: conds},
-			fresh: func() any { return &CanaryConfigStatus{} },
-		},
+			})
+		}},
+		{"CanaryConfigStatus", func(t *testing.T) { roundTripJSON(t, CanaryConfigStatus{Status: "Pending", Conditions: conds}) }},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, tc.run)
 	}
 }
 
-func TestStatusJSONRoundTrip(t *testing.T) {
-	for _, tc := range statusCases() {
-		t.Run(tc.name, func(t *testing.T) {
-			first, err := json.Marshal(tc.got)
-			require.NoError(t, err)
-
-			target := tc.fresh()
-			require.NoError(t, json.Unmarshal(first, target))
-
-			// Comparing the round-tripped Go value to the original via deep
-			// equality is brittle because metav1.Time embeds a time.Time whose
-			// *time.Location pointer differs after unmarshal even though the
-			// instant is identical. We compare the JSON projection instead —
-			// it's the contract the apiserver and clients actually care about.
-			second, err := json.Marshal(derefAny(target))
-			require.NoError(t, err)
-			require.JSONEq(t, string(first), string(second))
-		})
-	}
+// checkDeepCopy asserts dup equals orig and that mutate (which edits dup)
+// leaves orig untouched, i.e. the copy has independent backing storage.
+func checkDeepCopy[T any](t *testi
```

---

### Incident Patch 8: `1edf86f0` (2026-08-11)
**Commit Message**: cli: --watch to stream build logs during package create/update/rebuild and fn create (#3678)

* cli: add --watch to package create/update/rebuild to follow builds live (#3676)

Watching a build is two decoupled halves. The guarantee is the status
poll: it decides completion, prints the final Status.BuildLog (the
authoritative record), and exits non-zero on a failed build. Streaming
live lines from the environment's builder pod is best-effort decoration
on top — pod lookup and log-follow failures degrade silently to
"wait and print the final log", never to a hang or spurious failure.

This structure closes every flaw of the abandoned --streamlog attempt
(PR #2643): logs come from the env's builder pod rather than the
buildermgr (selector envName+owner=buildermgr, preferring the current
envResourceVersion generation), no namespace is hardcoded (env
namespace first, cluster-wide fallback for remapped builder
namespaces), termination is the package's terminal build status rather
than Follow-forever, and an empty pod list is just a retry, not a
panic.

--timeout defaults to 0 (wait indefinitely, kubectl-logs -f semantics);
--watch is rejected with --spec-save/--spec-dry since a spec fil

**File**: `pkg/apis/core/v1/const.go` (modified, +18/-5)
```diff
@@ -111,11 +111,11 @@ const (
 )
 
 const (
-	BuildStatusPending   = "pending"
-	BuildStatusRunning   = "running"
-	BuildStatusSucceeded = "succeeded"
-	BuildStatusFailed    = "failed"
-	BuildStatusNone      = "none"
+	BuildStatusPending   BuildStatus = "pending"
+	BuildStatusRunning   BuildStatus = "running"
+	BuildStatusSucceeded BuildStatus = "succeeded"
+	BuildStatusFailed    BuildStatus = "failed"
+	BuildStatusNone      BuildStatus = "none"
 )
 
 const (
@@ -416,3 +416,16 @@ const (
 const (
 	BuilderContainerName = "builder"
 )
+
+// Labels buildermgr's EnvironmentReconciler stamps on every environment
+// builder Service/Deployment/pod. Shared here so the CLI's build watch can
+// select builder pods without importing pkg/buildermgr. Note the
+// BuilderLabelEnvNamespace value is the BUILDER namespace (where the pod
+// runs), not the Environment's own namespace.
+const (
+	BuilderLabelEnvName            = "envName"
+	BuilderLabelEnvNamespace       = "envNamespace"
+	BuilderLabelEnvResourceVersion = "envResourceVersion"
+	BuilderLabelOwner              = "owner"
+	BuilderOwnerBuilderMgr         = "buildermgr"
+)
```

**File**: `pkg/apis/core/v1/types.go` (modified, +9/-0)
```diff
@@ -2455,6 +2455,15 @@ func (a Archive) IsEmpty() bool {
 	return len(a.Literal) == 0 && len(a.URL) == 0 && a.OCI == nil
 }
 
+// HasBuilder reports whether this environment can run package builds: v1
+// environments predate builders, and without a builder image there is nothing
+// to run one in. Shared by buildermgr's EnvironmentReconciler (which skips
+// builder creation on !HasBuilder) and the CLI's build watch (which refuses
+// to wait on a build that can never start).
+func (env Environment) HasBuilder() bool {
+	return env.Spec.Version != 1 && len(env.Spec.Builder.Image) > 0
+}
+
 func (fn Function) GetConcurrency() int {
 	if fn.Spec.Concurrency == 0 {
 		return DefaultConcurrency
```

**File**: `pkg/buildermgr/environment_reconciler.go` (modified, +8/-6)
```diff
@@ -33,11 +33,13 @@ import (
 )
 
 const (
-	LABEL_ENV_NAME            = "envName"
-	LABEL_ENV_NAMESPACE       = "envNamespace"
-	LABEL_ENV_RESOURCEVERSION = "envResourceVersion"
-	LABEL_DEPLOYMENT_OWNER    = "owner"
-	BUILDER_MGR               = "buildermgr"
+	// Aliases of the shared fv1.BuilderLabel* constants (the CLI's build
+	// watch selects builder pods by the same labels).
+	LABEL_ENV_NAME            = fv1.BuilderLabelEnvName
+	LABEL_ENV_NAMESPACE       = fv1.BuilderLabelEnvNamespace
+	LABEL_ENV_RESOURCEVERSION = fv1.BuilderLabelEnvResourceVersion
+	LABEL_DEPLOYMENT_OWNER    = fv1.BuilderLabelOwner
+	BUILDER_MGR               = fv1.BuilderOwnerBuilderMgr
 
 	// builderSpecHashAnnotation carries a hash of the builder pod template the
 	// reconciler last applied, so drift that does NOT bump the Environment's
@@ -124,7 +126,7 @@ func (r *EnvironmentReconciler) Reconcile(ctx context.Context, req ctrl.Request)
 
 	// builder is not supported with the v1 interface; ignore envs without a
 	// builder image.
-	if env.Spec.Version == 1 || len(env.Spec.Builder.Image) == 0 {
+	if !env.HasBuilder() {
 		return ctrl.Result{}, nil
 	}
 
```

**File**: `pkg/buildermgr/package_reconciler_test.go` (modified, +3/-3)
```diff
@@ -160,7 +160,7 @@ func TestPackageReconcileGate(t *testing.T) {
 
 		got, err := fc.CoreV1().Packages("default").Get(t.Context(), "init", metav1.GetOptions{})
 		require.NoError(t, err)
-		assert.Equal(t, fv1.BuildStatusPending, string(got.Status.BuildStatus),
+		assert.Equal(t, fv1.BuildStatusPending, got.Status.BuildStatus,
 			"empty-status source package must be initialised to pending")
 	})
 
@@ -175,7 +175,7 @@ func TestPackageReconcileGate(t *testing.T) {
 
 		got, err := fc.CoreV1().Packages("default").Get(t.Context(), "done", metav1.GetOptions{})
 		require.NoError(t, err)
-		assert.Equal(t, fv1.BuildStatusSucceeded, string(got.Status.BuildStatus), "terminal status must be left untouched")
+		assert.Equal(t, fv1.BuildStatusSucceeded, got.Status.BuildStatus, "terminal status must be left untouched")
 	})
 
 	t.Run("pending with missing environment fails terminally", func(t *testing.T) {
@@ -189,7 +189,7 @@ func TestPackageReconcileGate(t *testing.T) {
 
 		got, err := fc.CoreV1().Packages("default").Get(t.Context(), "noenv", metav1.GetOptions{})
 		require.NoError(t, err)
-		assert.Equal(t, fv1.BuildStatusFailed, string(got.Status.BuildStatus))
+		assert.Equal(t, fv1.BuildStatusFailed, got.Status.BuildStatus)
 		assert.Contains(t, got.Status.BuildLog, "environment does not exist")
 	})
 
```

**File**: `pkg/fission-cli/cmd/function/command.go` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ func Commands() *cobra.Command {
 			// TODO retired pkg & trigger related flags from function cmd
 			flag.PkgCode, flag.PkgSrcArchive, flag.PkgDeployArchive,
 			flag.PkgSrcChecksum, flag.PkgDeployChecksum, flag.PkgInsecure,
-			flag.PkgOCI, flag.FnBuildCmd,
+			flag.PkgOCI, flag.FnBuildCmd, flag.PkgWatch, flag.PkgWatchTimeout,
 
 			flag.HtUrl, flag.HtPrefix, flag.HtMethod,
 
```

**File**: `pkg/fission-cli/cmd/function/create.go` (modified, +36/-2)
```diff
@@ -637,6 +637,10 @@ func generatePackageName(fnName string, id string) string {
 // run write the resource to a spec file or create a fission CRD with remote fission server.
 // It also prints warning/error if necessary.
 func (opts *CreateSubCommand) run(input cli.Input) error {
+	if err := _package.ValidateWatchNotSpecMode(input); err != nil {
+		return err
+	}
+
 	// if we're writing a spec, don't create the function; save/print and return.
 	if handled, err := spec.SaveOrDry(input, *opts.function, opts.specFile); handled {
 		return err
@@ -653,7 +657,7 @@ func (opts *CreateSubCommand) run(input cli.Input) error {
 	triggerUrl := input.String(flagkey.HtUrl)
 	prefix := input.String(flagkey.HtPrefix)
 	if len(triggerUrl) == 0 && len(prefix) == 0 {
-		return nil
+		return opts.watchBuildIfRequested(input)
 	}
 	if len(prefix) != 0 && len(triggerUrl) > 0 {
 		console.Warn("Prefix will take precedence over URL/RelativeURL")
@@ -693,7 +697,37 @@ func (opts *CreateSubCommand) run(input cli.Input) error {
 	}
 
 	fmt.Printf("route created: %s %s -> %s\n", methods, triggerUrl, opts.function.Name)
-	return nil
+	return opts.watchBuildIfRequested(input)
+}
+
+// watchBuildIfRequested follows the referenced package's build to completion
+// when --watch was given — `fn create --src` is the most common way users
+// trigger a build (issue #3676). It runs after function/trigger creation so a
+// failed build never blocks those; the non-nil error on a failed build only
+// sets the exit code.
+//
+// For a package THIS command created (no --pkg given), any state — including
+// an already terminal one — is this command's own build outcome, so the watch
+// always runs. For `--pkg <existing>`, fn create triggers no build: only a
+// build already in flight is worth attaching to, and a terminal status is
+// stale history that must not be replayed as if it were this command's
+// result.
+func (opts *CreateSubCommand) watchBuildIfRequested(input cli.Input) error {
+	if !input.Bool(flagkey.PkgWatch) {
+		return nil
+	}
+	ref := opts.function.Spec.Package.PackageRef
+	if usedExistingPackage := len(input.String(flagkey.FnPackageName)) > 0; usedExistingPackage {
+		pkg, err := opts.Client().FissionClientSet.CoreV1().Packages(ref.Namespace).Get(input.Context(), ref.Name, metav1.GetOptions{})
+		if err != nil {
+			return fmt.Errorf("error getting package for --%v: %w", flagkey.PkgWatch, err)
+		}
+		if !_package.IsBuildInFlight(pkg.Status.BuildStatus) {
+			fmt.Fprintf(input.Stdout(), "Package '%v' already exists and no build was triggered; nothing to watch\n", ref.Name)
+			return nil
+		}
+	}
+	return _package.WatchPackageBuild(input, opts.Client(), ref.Namespace, ref.Name)
 }
 
 func getInvokeStrategy(input cli.Input, existingInvokeStrategy *fv1.InvokeStrategy) (strategy *fv1.InvokeStrategy, err error) {
```

**File**: `pkg/fission-cli/cmd/package/buildwatch.go` (added, +361/-0)
```diff
@@ -0,0 +1,361 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package _package
+
+import (
+	"bufio"
+	"context"
+	"fmt"
+	"io"
+	"sort"
+	"strings"
+	"sync"
+	"time"
+
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/labels"
+
+	fv1 "github.com/fission/fission/pkg/apis/core/v1"
+	"github.com/fission/fission/pkg/fission-cli/cliwrapper/cli"
+	"github.com/fission/fission/pkg/fission-cli/cmd"
+	flagkey "github.com/fission/fission/pkg/fission-cli/flag/key"
+	"github.com/fission/fission/pkg/fission-cli/logdb"
+	"github.com/fission/fission/pkg/fission-cli/util"
+	"github.com/fission/fission/pkg/utils"
+)
+
+const buildWatchPollInterval = time.Second
+
+// buildWatchMaxConsecutiveGetErrors bounds how long the status poll tolerates
+// consecutive non-NotFound API errors before surfacing the last one. Without
+// it a persistent failure (expired token, RBAC deny) combined with the
+// default no-timeout watch would hang forever with zero output.
+const buildWatchMaxConsecutiveGetErrors = 5
+
+// WatchPackageBuild is the cli.Input-facing wrapper around watchPackageBuild:
+// it applies --timeout only when positive (flag.PkgWatchTimeout defaults to 0
+// — a build has no natural upper bound, so the default is to wait
+// indefinitely, like `kubectl logs -f`) and writes to the input's stdout.
+func WatchPackageBuild(input cli.Input, client cmd.Client, namespace, name string) error {
+	ctx := input.Context()
+	if timeout := input.Duration(flagkey.WaitTimeout); timeout > 0 {
+		var cancel context.CancelFunc
+		ctx, cancel = context.WithTimeout(ctx, timeout)
+		defer cancel()
+	}
+	return watchPackageBuild(ctx, client, input.Stdout(), namespace, name)
+}
+
+// watchPackageBuild follows the build of the package at namespace/name to a
+// terminal state. The guarantee is the status poll: it decides completion,
+// prints the final Status.BuildLog (the source of truth), and returns non-nil
+// on a failed build so the command exits non-zero. Streaming live lines from
+// the environment's builder pod is strictly best-effort decoration on top —
+// any failure there (builder pod not up yet, rolled mid-build, RBAC denying a
+// cross-namespace pod list) silently degrades to "wait and print the final
+// log", never to a hang or a spurious command failure.
+func watchPackageBuild(ctx context.Context, client cmd.Client, out io.Writer, namespace, name string) error {
+	// One startup read fails fast on an environment that can never run this
+	// build (otherwise a source package against a builder-less env stays
+	// pending and a default no-timeout watch would wait forever) and seeds
+	// the log stream's env identity so it needn't re-derive it every tick. A
+	// transient read error here is not terminal — the poll's error budget
+	// below decides.
+	var envName, envNamespace string
+	if initial, err := client.FissionClientSet.CoreV1().Packages(namespace).Get(ctx, name, metav1.GetOptions{}); err == nil {
+		if err := refuseBuilderlessEnv(ctx, client, namespace, initial); err != nil {
+			return err
+		}
+		envName = initial.Spec.Environment.Name
+		envNamespace = initial.Spec.Environment.Namespace
+		if envNamespace == "" {
+			envNamespace = namespace
+		}
+	} else if util.IsNotFound(err) {
+		return fmt.Errorf("package %s/%s not found: %w", namespace, name, err)
+	}
+
+	lw := logdb.NewLockedWriter(out)
+
+	streamCtx, stopStream := context.WithCancel(ctx)
+	var wg sync.WaitGroup
+	wg.Go(func() {
+		streamBuilderLogs(streamCtx, client, lw, namespace, name, envName, envNamespace)
+	})
+	// Stop the log stream before the final build-log print regardless of how
+	// the poll ends, so stream lines can't interleave into the final report.
+	stopAndWait := sync.OnceFunc(func() {
+		stopStream()
+		wg.Wait()
+	})
+	defer stopAndWait()
+
+	var pkg *fv1.Package
+	// Zero value matches no status the poll can observe (an empty status is
+	// normalized to pending below), so the first poll announces the state.
+	var lastStatus fv1.BuildStatus
+	consecutiveGetErrors := 0
+	check := func(ctx context.Context) (bool, error) {
+		p, err := client.FissionClientSet.CoreV1().Packages(namespace).Get(ctx, name, metav1.GetOptions{})
+		if err != nil {
+			if util.IsNotFound(err) {
+				// The caller just created/updated this package; NotFound now
+				// means it was deleted underneath the watch.
+				return false, fmt.Errorf("package %s/%s no longer exists: %w", namespace, name, err)
+			}
+			// Tolerate a transient API blip, but a persistent failure
+			// (expired token, RBAC deny) must surface rather than spin
+			// silently forever under the default no-timeout watch.
+			consecutiveGetErrors++
+			if consecutiveGetErrors >= buildWatchMaxConsecutiveGetErrors {
+				return false, fmt.Errorf("getting package %s/%s repeatedly failed while watching the build: %w", namespace, name, err)
+			}
+			return false, nil
+		}
+		consecutiveGetErrors = 
```

**File**: `pkg/fission-cli/cmd/package/buildwatch_test.go` (added, +298/-0)
```diff
@@ -0,0 +1,298 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package _package
+
+import (
+	"bytes"
+	"context"
+	"errors"
+	"testing"
+	"testing/synctest"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	k8sfake "k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
+
+	fv1 "github.com/fission/fission/pkg/apis/core/v1"
+	"github.com/fission/fission/pkg/fission-cli/cmd"
+	fissionfake "github.com/fission/fission/pkg/generated/clientset/versioned/fake"
+)
+
+const (
+	watchTestNS  = "default"
+	watchTestPkg = "watch-pkg"
+	watchTestEnv = "watch-env"
+)
+
+func watchTestPackage(status fv1.BuildStatus) *fv1.Package {
+	return &fv1.Package{
+		ObjectMeta: metav1.ObjectMeta{Name: watchTestPkg, Namespace: watchTestNS},
+		Spec: fv1.PackageSpec{
+			Environment: fv1.EnvironmentReference{Name: watchTestEnv, Namespace: watchTestNS},
+		},
+		Status: fv1.PackageStatus{BuildStatus: status},
+	}
+}
+
+func watchTestBuilderPod() *corev1.Pod {
+	return &corev1.Pod{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      watchTestEnv + "-1234-abc",
+			Namespace: watchTestNS,
+			Labels: map[string]string{
+				fv1.BuilderLabelOwner:   fv1.BuilderOwnerBuilderMgr,
+				fv1.BuilderLabelEnvName: watchTestEnv,
+			},
+		},
+		Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: fv1.BuilderContainerName}}},
+		Status: corev1.PodStatus{
+			PodIP:             "10.1.2.3",
+			ContainerStatuses: []corev1.ContainerStatus{{Name: fv1.BuilderContainerName, Ready: true}},
+		},
+	}
+}
+
+// setBuildStatus flips the package's build status (and optionally the build
+// log) through the fake clientset's status subresource, the way buildermgr
+// does. It is called from spawned goroutines, so it must not use require
+// (t.FailNow is only legal on the test goroutine); assert's t.Errorf is safe
+// and still fails the test with the real error.
+func setBuildStatus(t *testing.T, client cmd.Client, status fv1.BuildStatus, buildLog string) {
+	t.Helper()
+	pkg, err := client.FissionClientSet.CoreV1().Packages(watchTestNS).Get(t.Context(), watchTestPkg, metav1.GetOptions{})
+	if !assert.NoError(t, err) {
+		return
+	}
+	pkg.Status.BuildStatus = status
+	pkg.Status.BuildLog = buildLog
+	_, err = client.FissionClientSet.CoreV1().Packages(watchTestNS).UpdateStatus(t.Context(), pkg, metav1.UpdateOptions{})
+	assert.NoError(t, err)
+}
+
+func TestWatchPackageBuildSucceeds(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		client := cmd.Client{
+			FissionClientSet: fissionfake.NewSimpleClientset(watchTestPackage(fv1.BuildStatusPending)),
+			KubernetesClient: k8sfake.NewSimpleClientset(watchTestBuilderPod()),
+		}
+
+		go func() {
+			time.Sleep(2 * time.Second)
+			setBuildStatus(t, client, fv1.BuildStatusRunning, "")
+			time.Sleep(2 * time.Second)
+			setBuildStatus(t, client, fv1.BuildStatusSucceeded, "collecting deps\nbuild ok\n")
+		}()
+
+		var out bytes.Buffer
+		err := watchPackageBuild(t.Context(), client, &out, watchTestNS, watchTestPkg)
+		require.NoError(t, err)
+
+		got := out.String()
+		assert.Contains(t, got, "Waiting for package 'watch-pkg' build to start")
+		assert.Contains(t, got, "Package 'watch-pkg' build running")
+		// The live stream is plumbed through the fake pod-log endpoint, whose
+		// canned body is "fake logs" — content fidelity is integration-tested.
+		assert.Contains(t, got, "fake logs")
+		// The final report is the authoritative Status.BuildLog.
+		assert.Contains(t, got, "========= build log =========")
+		assert.Contains(t, got, "collecting deps\nbuild ok\n")
+		assert.Contains(t, got, "Package 'watch-pkg' build succeeded")
+	})
+}
+
+func TestWatchPackageBuildFails(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		client := cmd.Client{
+			FissionClientSet: fissionfake.NewSimpleClientset(watchTestPackage(fv1.BuildStatusPending)),
+			KubernetesClient: k8sfake.NewSimpleClientset(), // no builder pod at all: stream must degrade silently
+		}
+
+		go func() {
+			time.Sleep(2 * time.Second)
+			setBuildStatus(t, client, fv1.BuildStatusFailed, "error: no module named flask\n")
+		}()
+
+		var out bytes.Buffer
+		err := watchPackageBuild(t.Context(), client, &out, watchTestNS, watchTestPkg)
+		require.Error(t, err)
+		assert.Contains(t, err.Error(), "build failed")
+
+		got := out.String()
+		assert.Contains(t, got, "error: no module named flask")
+	})
+}
+
+func TestWatchPackageBuildNothingToBuild(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		client := cmd.Client{
+			FissionClientSet: fissionfake.NewSimpleClientset(watchTestPackage(fv1.BuildStatusNone)),
+			KubernetesClient: k8sfake.NewSimpleClientset(),
+		}
+
+		var out bytes.Buffer
+		err := watchPackageBuild(t.Context(), client, &out, watchTestNS, watchTestPkg)
+		require.NoError(t, err)
+		assert.Contai
```

---

### Incident Patch 9: `a455a040` (2026-08-09)
**Commit Message**: Internal communication: targeted transport and HMAC body-handling fixes (#3673)

* router: correct stale executorResolver doc comment

Since the EndpointSlice data plane became the default (RFC-0002), warm
poolmgr traffic is admitted from the slice-fed endpoint index and never
reaches this resolver. The comment still claimed poolmgr lookups always
RPC the executor, which mis-describes the hot path for anyone auditing
router latency. Describe the actual routes that take the RPC.

* publisher: give webhook publishers a dedicated pooled transport

The webhook publisher (kubewatcher, timer, mqtrigger) drove the router
internal listener through bare http.DefaultTransport, whose process-wide
2-idle-conns-per-host pool lets unrelated traffic evict the publisher's
keep-alive connection between events — every eviction costs a fresh TCP
dial on the next publish. Share one httpx.PooledTransport base across
publishers, matching the other internal clients (kafka consumer, MCP
proxy, executor client).

The publisher's send loop stays serialized, so this is a keep-alive
stability fix, not a concurrency change.

* fetcher/storagesvc clients: share a pooled base transport

Both clients rode bare ht

**File**: `docs/internal-auth/00-design.md` (modified, +5/-4)
```diff
@@ -294,12 +294,13 @@ The complexity is not justified when HKDF gives the same isolation from one mast
 The scheme has known limitations operators should plan around.
 
 **Maximum body size.**
-The verifier reads the entire request body into memory before computing the signature so the body bytes can be re-injected for downstream handlers (multipart parsers, etc.).
-That cost is bounded by `VerifierOpts.MaxBodyBytes` (default 256 MiB, set on each registration).
+The verifier must drain the entire request body before computing the signature so the body bytes can be re-injected for downstream handlers (multipart parsers, etc.).
+The size of a body it accepts is bounded by `VerifierOpts.MaxBodyBytes` (default 256 MiB, set on each registration).
 Bodies that exceed the cap are rejected with `413 Request Entity Too Large` *before* signature verification — i.e. an unauthenticated attacker cannot use a giant unsigned body to DoS a signed service.
 Operators that legitimately need to upload archives larger than 256 MiB should bump the cap rather than disable enforcement; the cap is the largest archive size we expect to see in practice.
-For the one bulk-data endpoint, `storagesvc /v1/archive`, the cap is operator-tunable: set the Helm value `storagesvc.maxArchiveSizeMib` (env var `STORAGE_MAX_ARCHIVE_SIZE_MIB`), and size the storagesvc memory request/limit to match, since the body is held in memory during verification.
-The other registrations (fetcher, builder, executor, router-internal) carry small control-plane payloads and keep the 256 MiB default.
+For the one bulk-data endpoint, `storagesvc /v1/archive`, the cap is operator-tunable: set the Helm value `storagesvc.maxArchiveSizeMib` (env var `STORAGE_MAX_ARCHIVE_SIZE_MIB`).
+Whether the drained body is *held in memory* is a separate knob: with `VerifierOpts.SpoolThresholdBytes` set (storagesvc sets 4 MiB), over-threshold bodies are hashed while streaming to a temp file and re-read from it, so verifier memory is bounded by the threshold — raising the archive cap no longer requires raising the storagesvc memory request/limit to match.
+The other registrations (fetcher, builder, executor, router-internal) carry small or latency-sensitive payloads and stay fully in-memory with the 256 MiB default cap (the router internal listener caps at 64 MiB).
 For very large packages, OCI-native delivery (`packageRegistry`) is the better-managed alternative to raising the cap — the code is pulled and mounted from a registry rather than buffered through storagesvc.
 
 **Replay within the skew window.**
```

**File**: `pkg/auth/hmac/hmac.go` (modified, +41/-8)
```diff
@@ -33,32 +33,65 @@ import (
 	"fmt"
 )
 
+// BodyHashHex returns hex(SHA256(body)) — the body component of the
+// canonical string. A nil body hashes identically to an empty one, so
+// bodiless requests (GETs) canonicalize the same whether the caller
+// passes nil or []byte{}.
+func BodyHashHex(body []byte) string {
+	bodyHash := sha256.Sum256(body)
+	return hex.EncodeToString(bodyHash[:])
+}
+
+// emptyBodyHashHex is the canonical body component for bodiless requests,
+// precomputed once so signer and verifier don't rehash emptiness per request.
+var emptyBodyHashHex = BodyHashHex(nil)
+
+// CanonicalFromHash is Canonical for callers that already hold the body's
+// SHA-256 (hex) — computed once across several Verify candidates, or
+// streamed without buffering the body. bodyHashHex MUST be hex(SHA256(body))
+// for the exact bytes on the wire.
+func CanonicalFromHash(method, requestURI, bodyHashHex string, timestampSec int64) string {
+	minute := timestampSec - (timestampSec % 60)
+	return fmt.Sprintf("%s\n%s\n%s\n%d", method, requestURI, bodyHashHex, minute)
+}
+
 // Canonical returns the canonical string that is fed into HMAC-SHA256.
 // timestampSec is rounded down to the nearest minute. The `requestURI`
 // argument should be path + raw query (e.g. r.URL.RequestURI()), not
 // just the path — query parameters MUST be bound to the signature for
 // services like storagesvc that key on `?id=`.
 func Canonical(method, requestURI string, body []byte, timestampSec int64) string {
-	bodyHash := sha256.Sum256(body)
-	minute := timestampSec - (timestampSec % 60)
-	return fmt.Sprintf("%s\n%s\n%s\n%d", method, requestURI, hex.EncodeToString(bodyHash[:]), minute)
+	return CanonicalFromHash(method, requestURI, BodyHashHex(body), timestampSec)
+}
+
+// SignFromHash is Sign for callers that already hold hex(SHA256(body))
+// (see CanonicalFromHash).
+func SignFromHash(secret []byte, method, requestURI, bodyHashHex string, timestampSec int64) string {
+	mac := cryptohmac.New(sha256.New, secret)
+	mac.Write([]byte(CanonicalFromHash(method, requestURI, bodyHashHex, timestampSec)))
+	return hex.EncodeToString(mac.Sum(nil))
 }
 
 // Sign returns hex(HMAC-SHA256(secret, Canonical(...))). `requestURI`
 // is path + raw query (see Canonical).
 func Sign(secret []byte, method, requestURI string, body []byte, timestampSec int64) string {
-	mac := cryptohmac.New(sha256.New, secret)
-	mac.Write([]byte(Canonical(method, requestURI, body, timestampSec)))
-	return hex.EncodeToString(mac.Sum(nil))
+	return SignFromHash(secret, method, requestURI, BodyHashHex(body), timestampSec)
+}
+
+// VerifyFromHash is Verify for callers that already hold hex(SHA256(body)) —
+// the verifier middleware hashes the body once and reuses it across candidate
+// keys (active, rotation, per-namespace) instead of rehashing per candidate.
+func VerifyFromHash(secret []byte, method, requestURI, bodyHashHex string, timestampSec int64, sig string) bool {
+	want := SignFromHash(secret, method, requestURI, bodyHashHex, timestampSec)
+	return cryptohmac.Equal([]byte(want), []byte(sig))
 }
 
 // Verify is a constant-time signature check at the request's own timestamp.
 // Use VerifyWithSkew for clock-skew tolerance; bare Verify is intended for
 // callers that have already validated freshness (e.g. unit tests).
 // `requestURI` is path + raw query (see Canonical).
 func Verify(secret []byte, method, requestURI string, body []byte, timestampSec int64, sig string) bool {
-	want := Sign(secret, method, requestURI, body, timestampSec)
-	return cryptohmac.Equal([]byte(want), []byte(sig))
+	return VerifyFromHash(secret, method, requestURI, BodyHashHex(body), timestampSec, sig)
 }
 
 // VerifyWithSkew accepts the signature if the request timestamp is within
```

**File**: `pkg/auth/hmac/signer.go` (modified, +67/-30)
```diff
@@ -6,6 +6,8 @@ package hmac
 
 import (
 	"bytes"
+	"crypto/sha256"
+	"encoding/hex"
 	"io"
 	"net/http"
 	"strconv"
@@ -29,7 +31,9 @@ const (
 
 // Signer is an http.RoundTripper wrapper that signs every outgoing request
 // with the HMAC scheme described in the design at docs/internal-auth/00-design.md.
-// It buffers the request body to compute the body hash, then re-injects it.
+// It streams the body hash from GetBody when the request has one, and only
+// falls back to buffering the body (re-injecting it afterwards) when it
+// doesn't — see bodyHashForRequest.
 //
 // A Signer constructed with an empty secret short-circuits to pass-through:
 // it forwards the request to the inner transport unmodified, without
@@ -68,42 +72,75 @@ func (s *Signer) RoundTrip(r *http.Request) (*http.Response, error) {
 	if len(s.secret) == 0 {
 		return s.rt.RoundTrip(r)
 	}
-	var body []byte
-	if r.Body != nil {
-		original := r.Body
-		var err error
-		body, err = io.ReadAll(original)
-		// Close the original body before replacing it: callers that hand
-		// in a real *os.File-backed io.ReadCloser would otherwise leak
-		// the underlying file descriptor.
-		closeErr := original.Close()
-		if err != nil {
-			return nil, err
-		}
-		if closeErr != nil {
-			return nil, closeErr
-		}
-		r.Body = io.NopCloser(bytes.NewReader(body))
-		// GetBody must be repopulated alongside Body. Rewind-aware
-		// retry layers (net/http's replay after a broken connection,
-		// pkg/utils/httpretry) refuse to retry a request whose GetBody
-		// is nil, so leaving it unset silently makes signed requests
-		// un-retryable; and a naive caller re-submitting the same
-		// *http.Request re-reads the consumed reader above and sends —
-		// re-signed on the second pass through this signer — an EMPTY
-		// body, which the verifier happily accepts: silent success with
-		// an empty payload rather than a 401.
-		r.GetBody = func() (io.ReadCloser, error) {
-			return io.NopCloser(bytes.NewReader(body)), nil
-		}
+	bodyHash, err := bodyHashForRequest(r)
+	if err != nil {
+		return nil, err
 	}
 	ts := s.now().Unix()
 	// Sign over the request-URI (path + raw query) so query parameters
 	// like ?id= are bound to the signature. Signing the path alone would
 	// let an attacker replay a captured /v1/archive?id=A signature
 	// against a different ?id=B within the skew window.
-	sig := Sign(s.secret, r.Method, r.URL.RequestURI(), body, ts)
+	sig := SignFromHash(s.secret, r.Method, r.URL.RequestURI(), bodyHash, ts)
 	r.Header.Set(HeaderTimestamp, strconv.FormatInt(ts, 10))
 	r.Header.Set(HeaderSignature, sig)
 	return s.rt.RoundTrip(r)
 }
+
+// bodyHashForRequest returns hex(SHA256(body)) for the request's body,
+// preferring a streaming read over buffering.
+//
+// When GetBody is set (net/http populates it automatically for requests
+// built from *bytes.Buffer / *bytes.Reader / *strings.Reader, and
+// file-backed callers can set it themselves), the hash is streamed from a
+// fresh GetBody reader and the request's Body/GetBody are left untouched —
+// the transport streams the original body, so the signer holds no copy of
+// it. This matters for archive uploads, whose multipart body previously got
+// a second full in-memory copy here just to be hashed.
+//
+// Without GetBody, the body is buffered and re-injected (Body AND GetBody —
+// rewind-aware retry layers, net/http's replay after a broken connection and
+// pkg/utils/httpretry, refuse to retry a request whose GetBody is nil, so
+// leaving it unset silently makes signed requests un-retryable; and a naive
+// caller re-submitting the same *http.Request would re-read the consumed
+// reader and send — re-signed on the second pass — an EMPTY body, which the
+// verifier happily accepts: silent success with an empty payload rather
+// than a 401).
+func bodyHashForRequest(r *http.Request) (string, error) {
+	if r.GetBody != nil {
+		fresh, err := r.GetBody()
+		if err != nil {
+			return "", err
+		}
+		h := sha256.New()
+		_, err = io.Copy(h, fresh)
+		closeErr := fresh.Close()
+		if err != nil {
+			return "", err
+		}
+		if closeErr != nil {
+			return "", closeErr
+		}
+		return hex.EncodeToString(h.Sum(nil)), nil
+	}
+	if r.Body == nil {
+		return emptyBodyHashHex, nil
+	}
+	original := r.Body
+	body, err := io.ReadAll(original)
+	// Close the original body before replacing it: callers that hand
+	// in a real *os.File-backed io.ReadCloser would otherwise leak
+	// the underlying file descriptor.
+	closeErr := original.Close()
+	if err != nil {
+		return "", err
+	}
+	if closeErr != nil {
+		return "", closeErr
+	}
+	r.Body = io.NopCloser(bytes.NewReader(body))
+	r.GetBody = func() (io.ReadCloser, error) {
+		return io.NopCloser(bytes.NewReader(body)), nil
+	}
+	return BodyHashHex(body), nil
+}
```

**File**: `pkg/auth/hmac/signer_test.go` (modified, +46/-0)
```diff
@@ -115,6 +115,52 @@ func TestSignerRepopulatesGetBody(t *testing.T) {
 		"the retried attempt must re-send (and re-sign) the original body, never an empty one")
 }
 
+// TestSignerStreamsHashViaGetBody pins the no-buffer contract: when a
+// request is rewindable (GetBody set — net/http populates it for requests
+// built from bytes/strings readers, which covers every JSON client and the
+// storagesvc archive upload), the signer must stream the body hash from a
+// fresh GetBody reader and leave Body/GetBody untouched, rather than
+// buffering a second full copy of the body just to hash it.
+func TestSignerStreamsHashViaGetBody(t *testing.T) {
+	secret := []byte("test-secret-must-be-32-bytes-min")
+
+	var gotBody string
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		body, _ := io.ReadAll(r.Body)
+		ts, err := strconv.ParseInt(r.Header.Get(HeaderTimestamp), 10, 64)
+		require.NoError(t, err)
+		require.True(t, Verify(secret, r.Method, r.URL.Path, body, ts, r.Header.Get(HeaderSignature)),
+			"the streamed hash must sign the exact bytes on the wire")
+		gotBody = string(body)
+		w.WriteHeader(200)
+	}))
+	t.Cleanup(srv.Close)
+
+	req, err := http.NewRequest(http.MethodPost, srv.URL+"/v1/archive", strings.NewReader("payload"))
+	require.NoError(t, err)
+	require.NotNil(t, req.GetBody, "precondition: net/http must have made the request rewindable")
+
+	// Count GetBody calls and remember the original hooks so we can assert
+	// the signer read a fresh reader once and replaced nothing.
+	origBody := req.Body
+	origGetBody := req.GetBody
+	getBodyCalls := 0
+	req.GetBody = func() (io.ReadCloser, error) {
+		getBodyCalls++
+		return origGetBody()
+	}
+
+	signer := NewSigner(secret, http.DefaultTransport, time.Now)
+	resp, err := signer.RoundTrip(req)
+	require.NoError(t, err)
+	_ = resp.Body.Close()
+
+	assert.Equal(t, 200, resp.StatusCode)
+	assert.Equal(t, "payload", gotBody, "the transport must still stream the original body")
+	assert.Equal(t, 1, getBodyCalls, "the hash must be streamed from exactly one fresh GetBody reader")
+	assert.True(t, req.Body == origBody, "the signer must not replace a rewindable request's Body")
+}
+
 // TestSignerBindsQueryParameter pins the security-critical contract from
 // the design doc (docs/internal-auth/00-design.md): a captured signature
 // for /v1/archive?id=A must NOT verify against /v1/archive?id=B within
```

**File**: `pkg/auth/hmac/spool.go` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package hmac
+
+import (
+	"bytes"
+	"crypto/sha256"
+	"encoding/hex"
+	"errors"
+	"io"
+	"os"
+)
+
+// bodySpool holds a request body the verifier drained while hashing it:
+// in memory when it fit within the spool threshold, in a temp file when it
+// did not. Exactly one of mem/file is set.
+type bodySpool struct {
+	hashHex string
+	mem     []byte
+	file    *os.File
+}
+
+// spoolBody drains src, hashing as it reads. Bodies up to threshold bytes
+// stay in memory (the historical behavior); anything larger spills to a
+// temp file, so the caller's memory stays bounded by the threshold no
+// matter how large the body is. On error the returned spool (if any) has
+// already been cleaned up.
+func spoolBody(src io.Reader, threshold int64) (*bodySpool, error) {
+	h := sha256.New()
+	tee := io.TeeReader(src, h)
+	var buf bytes.Buffer
+	// Read one byte past the threshold: landing EOF at or before
+	// threshold+1 means the whole body fit and stays in memory.
+	_, err := io.CopyN(&buf, tee, threshold+1)
+	if errors.Is(err, io.EOF) {
+		return &bodySpool{hashHex: hex.EncodeToString(h.Sum(nil)), mem: buf.Bytes()}, nil
+	}
+	if err != nil {
+		return nil, err
+	}
+	f, err := os.CreateTemp("", "fission-hmac-body-*")
+	if err != nil {
+		return nil, err
+	}
+	sp := &bodySpool{file: f}
+	if _, err := f.Write(buf.Bytes()); err != nil {
+		sp.cleanup()
+		return nil, err
+	}
+	if _, err := io.Copy(f, tee); err != nil {
+		sp.cleanup()
+		return nil, err
+	}
+	sp.hashHex = hex.EncodeToString(h.Sum(nil))
+	return sp, nil
+}
+
+// reader returns the spooled body, rewound, for re-injection as r.Body.
+// Call it once. Both arms wrap with io.NopCloser so a handler's deferred
+// r.Body.Close() cannot close the temp file out from under cleanup, which
+// owns the file's lifecycle (io.NopCloser also forwards WriterTo, keeping
+// *os.File's copy fast path available to whoever drains the body).
+func (s *bodySpool) reader() (io.ReadCloser, error) {
+	if s.file == nil {
+		return io.NopCloser(bytes.NewReader(s.mem)), nil
+	}
+	if _, err := s.file.Seek(0, io.SeekStart); err != nil {
+		return nil, err
+	}
+	return io.NopCloser(s.file), nil
+}
+
+// cleanup closes and removes the temp file, if any. Idempotent; call it
+// (deferred) once the downstream handler has returned.
+func (s *bodySpool) cleanup() {
+	if s.file == nil {
+		return
+	}
+	name := s.file.Name()
+	_ = s.file.Close()
+	_ = os.Remove(name)
+	s.file = nil
+}
```

**File**: `pkg/auth/hmac/spool_test.go` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package hmac
+
+import (
+	"bytes"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"os"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// spoolTempDir points os.CreateTemp at a fresh per-test directory so the
+// tests can assert exactly which temp files the spool created and that
+// cleanup removed them.
+func spoolTempDir(t *testing.T) string {
+	t.Helper()
+	dir := t.TempDir()
+	t.Setenv("TMPDIR", dir)
+	return dir
+}
+
+func requireEmptyDir(t *testing.T, dir, msg string) {
+	t.Helper()
+	entries, err := os.ReadDir(dir)
+	require.NoError(t, err)
+	require.Empty(t, entries, msg)
+}
+
+func TestSpoolBodyBoundary(t *testing.T) {
+	dir := spoolTempDir(t)
+
+	// Exactly at the threshold: stays in memory, no temp file.
+	atLimit, err := spoolBody(strings.NewReader("12345678"), 8)
+	require.NoError(t, err)
+	assert.Nil(t, atLimit.file, "a body of exactly threshold bytes must stay in memory")
+	assert.Equal(t, BodyHashHex([]byte("12345678")), atLimit.hashHex)
+	requireEmptyDir(t, dir, "the in-memory path must not create temp files")
+
+	// One byte over: spills to a temp file, same hash as hashing in memory.
+	over, err := spoolBody(strings.NewReader("123456789"), 8)
+	require.NoError(t, err)
+	require.NotNil(t, over.file, "a body of threshold+1 bytes must spill to disk")
+	assert.Equal(t, BodyHashHex([]byte("123456789")), over.hashHex,
+		"the streamed hash must equal the in-memory hash")
+	rd, err := over.reader()
+	require.NoError(t, err)
+	got, err := io.ReadAll(rd)
+	require.NoError(t, err)
+	assert.Equal(t, "123456789", string(got), "the spooled reader must replay the full body")
+	over.cleanup()
+	over.cleanup() // idempotent
+	requireEmptyDir(t, dir, "cleanup must remove the temp file")
+}
+
+// TestVerifierSpoolsLargeBody pins the bounded-memory contract: with
+// SpoolThresholdBytes set, an over-threshold body still verifies, reaches
+// the handler intact from the temp file, and the temp file is gone once
+// the request completes.
+func TestVerifierSpoolsLargeBody(t *testing.T) {
+	dir := spoolTempDir(t)
+	secret := []byte("test-secret-must-be-32-bytes-min")
+	now := func() time.Time { return time.Unix(1715000000, 0) }
+	body := bytes.Repeat([]byte("A"), 64)
+
+	var gotBody []byte
+	h := Verifier(VerifierOpts{Secret: secret, SkewSec: 60, Now: now, SpoolThresholdBytes: 8})(
+		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			var err error
+			gotBody, err = io.ReadAll(r.Body)
+			require.NoError(t, err)
+			_ = r.Body.Close() // a handler's defer Close must not break cleanup
+			w.WriteHeader(200)
+		}))
+
+	sig := Sign(secret, "POST", "/v1/archive", body, 1715000000)
+	rr := httptest.NewRecorder()
+	req := httptest.NewRequest("POST", "/v1/archive", bytes.NewReader(body))
+	req.Header.Set(HeaderTimestamp, "1715000000")
+	req.Header.Set(HeaderSignature, sig)
+	h.ServeHTTP(rr, req)
+
+	assert.Equal(t, 200, rr.Code)
+	assert.Equal(t, body, gotBody, "the handler must read the full body back from the spool")
+	requireEmptyDir(t, dir, "the spool temp file must be removed after the handler returns")
+}
+
+// TestVerifierSpoolSmallBodyStaysInMemory: under the threshold the spool
+// path must behave exactly like the historical in-memory path — no files.
+func TestVerifierSpoolSmallBodyStaysInMemory(t *testing.T) {
+	dir := spoolTempDir(t)
+	secret := []byte("test-secret-must-be-32-bytes-min")
+	now := func() time.Time { return time.Unix(1715000000, 0) }
+	body := []byte("small")
+
+	h := Verifier(VerifierOpts{Secret: secret, SkewSec: 60, Now: now, SpoolThresholdBytes: 1024})(
+		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			got, err := io.ReadAll(r.Body)
+			require.NoError(t, err)
+			assert.Equal(t, body, got)
+			w.WriteHeader(200)
+		}))
+
+	sig := Sign(secret, "POST", "/v1/archive", body, 1715000000)
+	rr := httptest.NewRecorder()
+	req := httptest.NewRequest("POST", "/v1/archive", bytes.NewReader(body))
+	req.Header.Set(HeaderTimestamp, "1715000000")
+	req.Header.Set(HeaderSignature, sig)
+	h.ServeHTTP(rr, req)
+
+	assert.Equal(t, 200, rr.Code)
+	requireEmptyDir(t, dir, "an under-threshold body must never touch disk")
+}
+
+// TestVerifierSpoolCleansUpOnBadSignature: a spilled body whose signature
+// does not verify must be rejected AND leave no temp file behind.
+func TestVerifierSpoolCleansUpOnBadSignature(t *testing.T) {
+	dir := spoolTempDir(t)
+	secret := []byte("test-secret-must-be-32-bytes-min")
+	now := func() time.Time { return time.Unix(1715000000, 0) }
+	body := bytes.Repeat([]byte("B"), 64)
+
+	called := false
+	h := Verifier(VerifierOpts{Secret: secret, SkewSec: 60, Now: now, SpoolThresholdBytes: 8})(
+		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			called = true
+			w.WriteHeader(200)
+		}))
+
+	rr := httptest.NewRecorder()
+	req := httptest.NewRe
```

**File**: `pkg/auth/hmac/verifier.go` (modified, +60/-25)
```diff
@@ -5,10 +5,9 @@
 package hmac
 
 import (
-	"bytes"
 	"context"
 	"errors"
-	"io"
+	"math"
 	"net/http"
 	"strconv"
 	"strings"
@@ -74,6 +73,16 @@ type VerifierOpts struct {
 	// The cap is only applied when enforcement is on (Secret non-empty); the
 	// pass-through short-circuit deliberately leaves the body untouched.
 	MaxBodyBytes int64
+	// SpoolThresholdBytes, when positive, bounds how much of the request body
+	// the verifier holds in memory while hashing: bodies up to the threshold
+	// stay in memory as before, larger ones spool to a temp file that the
+	// re-injected r.Body reads back from — so verifier memory is bounded by
+	// the threshold (not MaxBodyBytes) per request. Zero or negative keeps
+	// the fully in-memory behavior. The trade is a disk write+read for
+	// spooled bodies: set it on listeners where large bodies are real
+	// (storagesvc archive uploads) and leave it off on latency-sensitive
+	// ones (the router internal listener).
+	SpoolThresholdBytes int64
 	// Logger receives V(1) messages on each rejection. The zero value is
 	// substituted with logr.Discard() at construction so callers that don't
 	// care about audit logs don't crash. Rejection log lines deliberately
@@ -176,40 +185,45 @@ func Verifier(opts VerifierOpts) func(http.Handler) http.Handler {
 				return
 			}
 
-			var body []byte
+			bodyHash := emptyBodyHashHex
 			if r.Body != nil {
 				if opts.MaxBodyBytes > 0 {
 					r.Body = http.MaxBytesReader(w, r.Body, opts.MaxBodyBytes)
 				}
-				body, err = io.ReadAll(r.Body)
-				if err != nil {
-					var maxErr *http.MaxBytesError
-					if errors.As(err, &maxErr) {
-						opts.Logger.V(1).Info("HMAC verification failed",
-							"reason", "body exceeds MaxBodyBytes",
-							"method", r.Method, "path", r.URL.Path,
-							"remoteAddr", r.RemoteAddr,
-							"limit", maxErr.Limit)
-						w.WriteHeader(http.StatusRequestEntityTooLarge)
-						return
-					}
-					opts.Logger.V(1).Info("HMAC verification failed",
-						"reason", "body read error",
-						"method", r.Method, "path", r.URL.Path,
-						"remoteAddr", r.RemoteAddr)
-					w.WriteHeader(http.StatusUnauthorized)
+				// Spooling disabled resolves to an effectively-infinite
+				// threshold: the single drain path below then keeps every
+				// body in memory, which is the historical behavior.
+				spoolAt := opts.SpoolThresholdBytes
+				if spoolAt <= 0 {
+					spoolAt = math.MaxInt64 - 1
+				}
+				spool, spoolErr := spoolBody(r.Body, spoolAt)
+				if spoolErr != nil {
+					rejectBodyReadError(w, r, opts.Logger, spoolErr)
+					return
+				}
+				// The temp file (if the body spilled) must outlive the
+				// downstream handler, which reads the re-injected body
+				// from it; remove it once the handler returns.
+				defer spool.cleanup()
+				body, readerErr := spool.reader()
+				if readerErr != nil {
+					rejectBodyReadError(w, r, opts.Logger, readerErr)
 					return
 				}
-				r.Body = io.NopCloser(bytes.NewReader(body))
+				bodyHash = spool.hashHex
+				r.Body = body
 			}
 
 			// Sign over RequestURI (path + raw query) so query parameters
-			// like ?id= are bound to the signature. Try each candidate key in
-			// order (active, then rotation, or the per-request namespace keys);
-			// constant-time compare happens inside Verify per candidate.
+			// like ?id= are bound to the signature. The body was hashed ONCE
+			// while draining it; try each candidate key in order (active,
+			// then rotation, or the per-request namespace keys) against the
+			// same hash; constant-time compare happens inside VerifyFromHash
+			// per candidate.
 			ru := r.URL.RequestURI()
 			for _, c := range opts.labeledCandidates(r) {
-				if len(c.Key) > 0 && Verify(c.Key, r.Method, ru, body, tsNum, sig) {
+				if len(c.Key) > 0 && VerifyFromHash(c.Key, r.Method, ru, bodyHash, tsNum, sig) {
 					// Record the principal whose key matched so downstream
 					// handlers authorize on the authenticated namespace rather
 					// than a caller-controlled header.
@@ -226,3 +240,24 @@ func Verifier(opts VerifierOpts) func(http.Handler) http.Handler {
 		})
 	}
 }
+
+// rejectBodyReadError writes the response for a body the verifier could not
+// drain: an *http.MaxBytesError means the body exceeded MaxBodyBytes (413);
+// anything else is a read error (401). Shared by the in-memory and spooling
+// body paths so both reject identically.
+func rejectBodyReadError(w http.ResponseWriter, r *http.Request, logger logr.Logger, err error) {
+	if maxErr, ok := errors.AsType[*http.MaxBytesError](err); ok {
+		logger.V(1).Info("HMAC verification failed",
+			"reason", "body exceeds MaxBodyBytes",
+			"method", r.Method, "path", r.URL.Path,
+			"remoteAddr", r.RemoteAddr,
+			"limit", maxErr.Limit)
+		w.WriteHeader(http.StatusRequestEntityTooLarge)
+		return
+	}
+	logger.V(1).Info("HMAC verification failed",
+		"reason", "body read error",
+		"method", r.Method, "path", r.URL.Path,
+		"remoteAddr", r.RemoteAddr)
+	w.WriteHeader
```

**File**: `pkg/fetcher/client/client.go` (modified, +17/-2)
```diff
@@ -23,8 +23,23 @@ import (
 	ferror "github.com/fission/fission/pkg/error"
 	"github.com/fission/fission/pkg/fetcher"
 	"github.com/fission/fission/pkg/utils/correlation"
+	"github.com/fission/fission/pkg/utils/httpx"
 )
 
+// fetcherIdleConnsPerHost sizes the shared transport's idle pool per target
+// fetcher. Specialization fans out across pods (one host each), but buildermgr
+// runs concurrent builds of the same environment against a single builder
+// pod's fetcher — the stdlib default of 2 idle conns per host churns
+// connections there.
+const fetcherIdleConnsPerHost = 16
+
+// fetcherBaseTransport is shared by every fetcher client in the process. A
+// client is constructed per specialization (see poolmgr's gp_specialize), so
+// the underlying transport must be package-level: a per-client transport
+// would grow a fresh idle pool on every specialization and reuse nothing. The
+// per-client otel/signer wrappers are cheap and layer on top.
+var fetcherBaseTransport = httpx.PooledTransport(fetcherIdleConnsPerHost)
+
 type (
 	ClientInterface interface {
 		Specialize(context.Context, *fetcher.FunctionSpecializeRequest) error
@@ -54,7 +69,7 @@ type (
 // (FISSION_INTERNAL_AUTH_SECRET) backs every internal channel's
 // signing/verification.
 func MakeClient(logger logr.Logger, fetcherUrl string, masterSecret []byte) ClientInterface {
-	var rt http.RoundTripper = otelhttp.NewTransport(http.DefaultTransport)
+	var rt http.RoundTripper = otelhttp.NewTransport(fetcherBaseTransport)
 	if len(masterSecret) > 0 {
 		rt = hmacauth.ServiceSigner(masterSecret, hmacauth.ServiceFetcher, rt, time.Now)
 	}
@@ -68,7 +83,7 @@ func MakeClient(logger logr.Logger, fetcherUrl string, masterSecret []byte) Clie
 // used to specialize another tenant's pod. An empty master yields an unsigned
 // client (pass-through), matching MakeClient.
 func MakeClientNS(logger logr.Logger, fetcherUrl string, masterSecret []byte, namespace string) ClientInterface {
-	var rt http.RoundTripper = otelhttp.NewTransport(http.DefaultTransport)
+	var rt http.RoundTripper = otelhttp.NewTransport(fetcherBaseTransport)
 	if len(masterSecret) > 0 {
 		rt = hmacauth.ServiceSignerNS(masterSecret, hmacauth.ServiceFetcher, namespace, rt, time.Now)
 	}
```

---

### Incident Patch 10: `f3eeb709` (2026-08-06)
**Commit Message**: fix(router): re-scope EndpointSlice cache for runtime-onboarded tenants (#3647) (#3653)

* fix(router): re-scope EndpointSlice cache for runtime-onboarded tenants (#3647)

Dynamic tenancy onboards namespaces at runtime, but the router's
EndpointSlice informer was scoped once at startup and the router SA had
no RoleBinding in the new tenant namespace — so the RFC-0002 warm path
never saw a runtime-onboarded tenant's slices and every request fell
back to the executor RPC.

RBAC: render a fission-router-dataplane-tenant ClusterRole in dynamic
mode, add fission-router to the admission-policy SA allowlist, and have
the tenant controller bind it per namespace at onboarding (deleted at
offboard).

Data plane: replace the manager-cache informer with per-namespace
informers (NamespaceInformers) in dynamic mode. A resolver-sync hook
re-scopes the set on every FissionTenant change. Teardown is fenced:
Sync cancels, waits for the informer's goroutines to drain
(factory.Shutdown), and only then sweeps the index — all under one lock,
so offboard/re-onboard overlap cannot resurrect stale endpoints or wipe
a replacement informer's fresh entries.

Readiness: namespaces that fail the EndpointSlice R

**File**: `charts/fission-all/templates/tenant-controller/_tenant-workload-roles.tpl` (modified, +5/-0)
```diff
@@ -32,4 +32,9 @@ tests (a drift would fail tenant onboarding / the admission-policy test).
   rules: fissionFunction.builderRules
 - name: fission-fetcher-websocket-tenant-workload
   rules: fissionFunction.fetcherWebsocketRules
+# router-dataplane: read Fission-managed EndpointSlices + Services in tenant
+# namespaces (RFC-0002 warm path). The dynamic twin of the static per-namespace
+# Role in router/role-dataplane.yaml; pkg/tenant/provision.go binds this by name.
+- name: fission-router-dataplane-tenant
+  rules: router-dataplane-kuberules
 {{- end -}}
```

**File**: `charts/fission-all/templates/tenant-controller/admission-policy.yaml` (modified, +4/-4)
```diff
@@ -12,8 +12,8 @@
 # them to an attacker-controlled ServiceAccount, granting that SA the namespace's
 # secret/configmap read. This policy rejects ANY RoleBinding that references a
 # tenant-workload ClusterRole unless every subject is one of the fixed Fission
-# fetcher/builder/executor/buildermgr ServiceAccounts — so the grant can only ever
-# reach Fission's own pods, never an arbitrary SA.
+# fetcher/builder/executor/buildermgr/router ServiceAccounts — so the grant can
+# only ever reach Fission's own pods, never an arbitrary SA.
 #
 # It is a cluster-wide ValidatingAdmissionPolicy (GA in k8s 1.30; the chart's floor
 # is 1.32) keyed on the binding's roleRef, so it applies to the binding SHAPE, not
@@ -49,12 +49,12 @@ spec:
     - expression: >
         !has(object.subjects) || object.subjects.all(s,
           s.kind == 'ServiceAccount' && s.name in [
-            'fission-fetcher', 'fission-builder', 'fission-executor', 'fission-buildermgr'
+            'fission-fetcher', 'fission-builder', 'fission-executor', 'fission-buildermgr', 'fission-router'
           ])
       reason: Forbidden
       message: >
         a RoleBinding to a Fission tenant-workload ClusterRole may only bind the
-        fixed fission fetcher/builder/executor/buildermgr ServiceAccounts
+        fixed fission fetcher/builder/executor/buildermgr/router ServiceAccounts
 ---
 apiVersion: admissionregistration.k8s.io/v1
 kind: ValidatingAdmissionPolicyBinding
```

**File**: `charts/fission-all/templates/tenant-controller/rbac.yaml` (modified, +2/-1)
```diff
@@ -62,7 +62,8 @@ rules:
   - deletecollection
 # Bind ONLY the fixed-name tenant-workload ClusterRoles into tenant namespaces (via
 # the RoleBindings the controller provisions): the executor/buildermgr workload
-# roles AND the fetcher/builder/fetcher-websocket function-pod read roles.
+# roles, the fetcher/builder/fetcher-websocket function-pod read roles, AND the
+# router-dataplane EndpointSlice + Service read role.
 # resourceNames-scoped: the controller cannot bind any other ClusterRole, so it
 # cannot escalate itself to arbitrary cluster permissions.
 - apiGroups:
```

**File**: `pkg/apis/core/v1/const.go` (modified, +7/-2)
```diff
@@ -369,8 +369,11 @@ const (
 	// Control-plane ServiceAccounts (in the install/release namespace) that need
 	// workload RBAC in each tenant namespace under dynamic tenancy. The tenant
 	// controller binds them to the *TenantWorkloadClusterRole below per namespace.
+	// FissionRouterSA is the router's data-plane SA, bound to
+	// RouterDataplaneTenantClusterRole for EndpointSlice + Service reads.
 	FissionExecutorSA   = "fission-executor"
 	FissionBuildermgrSA = "fission-buildermgr"
+	FissionRouterSA     = "fission-router"
 
 	// The *TenantWorkloadClusterRole names are the fixed-name ClusterRoles
 	// (chart-rendered only in dynamic mode) holding the per-namespace rules a
@@ -379,13 +382,15 @@ const (
 	// install-independent (dynamic tenancy is one Fission install per cluster,
 	// since it watches cluster-wide). Executor/buildermgr carry workload-management
 	// rules; fetcher/builder/fetcher-websocket carry the function-pod sidecar read
-	// rules — all single-sourced from the chart's shared partials so the static
-	// and dynamic paths cannot drift.
+	// rules; router-dataplane carries the EndpointSlice + Service read grant for
+	// the RFC-0002 warm path — all single-sourced from the chart's shared partials
+	// so the static and dynamic paths cannot drift.
 	ExecutorTenantWorkloadClusterRole         = "fission-executor-tenant-workload"
 	BuildermgrTenantWorkloadClusterRole       = "fission-buildermgr-tenant-workload"
 	FetcherTenantWorkloadClusterRole          = "fission-fetcher-tenant-workload"
 	BuilderTenantWorkloadClusterRole          = "fission-builder-tenant-workload"
 	FetcherWebsocketTenantWorkloadClusterRole = "fission-fetcher-websocket-tenant-workload"
+	RouterDataplaneTenantClusterRole          = "fission-router-dataplane-tenant"
 )
 
 const (
```

**File**: `pkg/router/dynamic_endpoint_cache_test.go` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package router
+
+import (
+	"context"
+	"sync/atomic"
+	"testing"
+	"testing/synctest"
+	"time"
+
+	"github.com/go-logr/logr"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	authorizationv1 "k8s.io/api/authorization/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/manager"
+
+	"github.com/fission/fission/pkg/router/endpointcache"
+	"github.com/fission/fission/pkg/utils"
+)
+
+// addOnlyManager lets setupDynamicEndpointCache register its startup runnable
+// without starting a full controller-runtime manager. No other Manager method
+// is used while setupDynamicEndpointCache is being called.
+type addOnlyManager struct {
+	ctrl.Manager
+}
+
+func (*addOnlyManager) Add(manager.Runnable) error {
+	return nil
+}
+
+// TestSetupDynamicEndpointCacheReusesPreflightRBAC verifies that namespaces
+// approved by the startup preflight are reused by the initial dynamic-cache
+// sync instead of issuing the same SelfSubjectAccessReviews again.
+func TestSetupDynamicEndpointCacheReusesPreflightRBAC(t *testing.T) {
+	kubeClient := fake.NewSimpleClientset()
+	var sarCalls atomic.Int32
+	kubeClient.PrependReactor("create", "selfsubjectaccessreviews", func(action k8stesting.Action) (bool, runtime.Object, error) {
+		sarCalls.Add(1)
+		sar := action.(k8stesting.CreateAction).GetObject().(*authorizationv1.SelfSubjectAccessReview)
+		return true, &authorizationv1.SelfSubjectAccessReview{
+			Spec:   sar.Spec,
+			Status: authorizationv1.SubjectAccessReviewStatus{Allowed: true},
+		}, nil
+	})
+
+	precheckedNamespaces := sliceWatchNamespaces()
+	require.NotEmpty(t, precheckedNamespaces)
+
+	ctx, cancel := context.WithCancel(t.Context())
+	t.Cleanup(cancel)
+	_, hooks, err := setupDynamicEndpointCache(
+		ctx,
+		kubeClient,
+		endpointcache.NewIndex(),
+		&addOnlyManager{},
+		nil,
+		logr.Discard(),
+		precheckedNamespaces,
+	)
+	require.NoError(t, err)
+	require.Len(t, hooks, 1)
+
+	pending := hooks[0]()
+	assert.False(t, pending)
+	assert.Zero(t, sarCalls.Load(), "preflight-approved namespaces must not repeat SARs during dynamic-cache setup")
+}
+
+// newDynamicCacheTest builds a dynamicEndpointCache backed by a fake clientset
+// whose SAR reactor consults the allowedNS map. A namespace present with value
+// true → SAR Allowed=true; absent or false → Allowed=false. The map is shared
+// so tests can flip a namespace's RBAC state between calls (the re-onboard
+// scenario). Returns the cache and the resolver (so tests can onboard/offboard).
+func newDynamicCacheTest(t *testing.T, allowedNS map[string]bool) (*dynamicEndpointCache, *utils.NamespaceResolver) {
+	t.Helper()
+	kubeClient := fake.NewSimpleClientset()
+	kubeClient.PrependReactor("create", "selfsubjectaccessreviews", func(action k8stesting.Action) (bool, runtime.Object, error) {
+		sar := action.(k8stesting.CreateAction).GetObject().(*authorizationv1.SelfSubjectAccessReview)
+		ns := sar.Spec.ResourceAttributes.Namespace
+		return true, &authorizationv1.SelfSubjectAccessReview{
+			Spec:   sar.Spec,
+			Status: authorizationv1.SubjectAccessReviewStatus{Allowed: allowedNS[ns]},
+		}, nil
+	})
+	resolver := &utils.NamespaceResolver{}
+	nsi := endpointcache.NewNamespaceInformers(kubeClient, endpointcache.NewIndex(), logr.Discard())
+	t.Cleanup(nsi.Close)
+	dynCache := &dynamicEndpointCache{
+		kubeClient:  kubeClient,
+		resolver:    resolver,
+		nsInformers: nsi,
+		logger:      logr.Discard(),
+	}
+	return dynCache, resolver
+}
+
+// TestDynamicCacheAllowedCachesAndIncludes verifies the happy path: a namespace
+// that passes SAR is cached in rbacChecked, included in the informer set, and
+// does not report pending.
+func TestDynamicCacheAllowedCachesAndIncludes(t *testing.T) {
+	t.Parallel()
+	allowedNS := map[string]bool{"team-a": true}
+	dyn, resolver := newDynamicCacheTest(t, allowedNS)
+	resolver.SetTenants(map[string]string{"team-a": "team-a"})
+
+	pending := dyn.syncInformers(t.Context())
+	assert.False(t, pending, "allowed namespace must not report pending")
+	_, cached := dyn.rbacChecked.Load("team-a")
+	assert.True(t, cached, "allowed namespace must be cached in rbacChecked")
+}
+
+// TestDynamicCacheDeniedExcludesAndReportsPending verifies the #3647 exclusion:
+// a namespace whose SAR returns Allowed=false is EXCLUDED from the informer set
+// (not cached) and reports pending=true so the reconciler requeues.
+func TestDynamicCacheDeniedExcludesAndReportsPending(t *testing.T) {
+	t.Parallel()
+	allowedNS := map[string]bool{"team-a": false}
+	dyn, resolver := newDynamicCacheTest(t, allowedNS)
+	resolver.SetTenants(map[string]string{"team-a": "team-a"})
+
+	pending := dyn.syncInformers(t.Context())
+	assert.True(t, pending, "denied namespace must report pending")
+	_, 
```

**File**: `pkg/router/endpointcache/handlers.go` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package endpointcache
+
+import (
+	"github.com/go-logr/logr"
+	discoveryv1 "k8s.io/api/discovery/v1"
+	"k8s.io/client-go/tools/cache"
+)
+
+// endpointSliceHandlers returns the Add/Update/Delete handlers that feed the
+// Index from EndpointSlice informer events. Shared by the manager-cache
+// informer (informer.go) and the per-namespace informers (nsinformers.go) so
+// the event-handling logic — including tombstone unwrapping — cannot drift
+// between the two paths.
+func endpointSliceHandlers(ix *Index, logger logr.Logger) cache.ResourceEventHandlerFuncs {
+	return cache.ResourceEventHandlerFuncs{
+		AddFunc: func(obj any) {
+			if es, ok := obj.(*discoveryv1.EndpointSlice); ok {
+				ix.ApplySlice(es)
+			}
+		},
+		UpdateFunc: func(_, newObj any) {
+			if es, ok := newObj.(*discoveryv1.EndpointSlice); ok {
+				ix.ApplySlice(es)
+			}
+		},
+		DeleteFunc: func(obj any) {
+			es, ok := obj.(*discoveryv1.EndpointSlice)
+			if !ok {
+				tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
+				if !ok {
+					logger.V(1).Info("unexpected object type in endpointslice delete event")
+					return
+				}
+				es, ok = tombstone.Obj.(*discoveryv1.EndpointSlice)
+				if !ok {
+					logger.V(1).Info("unexpected tombstone object type in endpointslice delete event")
+					return
+				}
+			}
+			ix.DeleteSlice(es)
+		},
+	}
+}
```

**File**: `pkg/router/endpointcache/index.go` (modified, +53/-0)
```diff
@@ -12,6 +12,7 @@ package endpointcache
 import (
 	"fmt"
 	"net/url"
+	"strings"
 	"sync"
 	"sync/atomic"
 	"time"
@@ -330,6 +331,58 @@ func (ix *Index) DeleteSlice(es *discoveryv1.EndpointSlice) {
 	}
 }
 
+// RemoveNamespace drops every slice whose object namespace matches, used when a
+// tenant is offboarded and its informer is stopped (nsinformers.go Sync).
+// FnKey.Namespace comes from the slice's functionNamespace label and may differ
+// from the namespace containing the slice, so cleanup must inspect the stored
+// slice keys. Function entries are rebuilt or removed after matching slices are
+// deleted.
+//
+// Two side effects worth noting, neither a bug:
+//
+//  1. A partially-removed entry (slices in multiple namespaces, only the
+//     offboarded one matched) has its quarantined set and strike map cleared
+//     for the surviving addresses. The old code never touched surviving
+//     entries. This is consistent with the "any slice event lifts quarantines"
+//     rule applied by ApplySlice/DeleteSlice, but it is a new side effect for
+//     offboard.
+//
+//  2. The shard lock is held for the full sweep with one entry lock taken per
+//     inhabited entry, so on a large index offboard briefly stalls concurrent
+//     Lookup/Admit. Acceptable because offboard is rare (a tenant removal), but
+//     a caller doing bulk offboard on a hot router should expect a short
+//     admission pause proportional to the shard size.
+func (ix *Index) RemoveNamespace(ns string) {
+	for i := range ix.shards {
+		s := &ix.shards[i]
+		s.mu.Lock()
+		for key, e := range s.m {
+			e.mu.Lock()
+			removed := false
+			for sliceKey := range e.slices {
+				sliceNamespace, _, ok := strings.Cut(sliceKey, "/")
+				if ok && sliceNamespace == ns {
+					delete(e.slices, sliceKey)
+					removed = true
+				}
+			}
+			if !removed {
+				e.mu.Unlock()
+				continue
+			}
+			e.quarantined.Store(nil)
+			e.strikes = nil
+			e.rebuildLocked()
+			if len(e.slices) == 0 {
+				delete(s.m, key)
+				ix.size.Add(-1)
+			}
+			e.mu.Unlock()
+		}
+		s.mu.Unlock()
+	}
+}
+
 // rebuildLocked re-merges the per-slice endpoint lists into the copy-on-write
 // snapshot, attaching each pod's shared in-flight counter (created on first
 // sight, pruned when the pod leaves every slice). Caller holds e.mu.
```

**File**: `pkg/router/endpointcache/index_test.go` (modified, +64/-1)
```diff
@@ -25,7 +25,7 @@ func slice(name, fnName, fnNamespace string, port int32, addrs ...string) *disco
 	es := &discoveryv1.EndpointSlice{
 		ObjectMeta: metav1.ObjectMeta{
 			Name:      name,
-			Namespace: "fn-ns",
+			Namespace: fnNamespace,
 			Labels: map[string]string{
 				fv1.FUNCTION_NAME:      fnName,
 				fv1.FUNCTION_NAMESPACE: fnNamespace,
@@ -471,3 +471,66 @@ func TestReportDialTimeoutIgnoredWhileQuarantined(t *testing.T) {
 		assert.False(t, ix.ReportDialTimeout("default", "fn-a", "", "10.0.0.1:8888"))
 	}
 }
+
+func TestRemoveNamespace(t *testing.T) {
+	t.Parallel()
+
+	t.Run("matching function and slice namespaces", func(t *testing.T) {
+		ix := NewIndex()
+		// Populate functions across three namespaces.
+		ix.ApplySlice(slice("s1", "fn-a", "ns-1", 8888, "10.0.0.1"))
+		ix.ApplySlice(slice("s2", "fn-b", "ns-1", 8888, "10.0.0.2"))
+		ix.ApplySlice(slice("s3", "fn-c", "ns-2", 8888, "10.0.0.3"))
+		ix.ApplySlice(slice("s4", "fn-d", "ns-3", 8888, "10.0.0.4"))
+		assert.Equal(t, 4, ix.Size())
+
+		// Remove ns-1 only; ns-2 and ns-3 must survive.
+		ix.RemoveNamespace("ns-1")
+		assert.Empty(t, ix.Lookup("ns-1", "fn-a", ""), "ns-1 fn-a must be gone")
+		assert.Empty(t, ix.Lookup("ns-1", "fn-b", ""), "ns-1 fn-b must be gone")
+		assert.ElementsMatch(t, []string{"10.0.0.3:8888"}, addrs(ix.Lookup("ns-2", "fn-c", "")))
+		assert.ElementsMatch(t, []string{"10.0.0.4:8888"}, addrs(ix.Lookup("ns-3", "fn-d", "")))
+		assert.Equal(t, 2, ix.Size(), "only ns-2 and ns-3 functions remain")
+
+		// Removing a namespace that was never populated is a no-op.
+		ix.RemoveNamespace("never-existed")
+		assert.Equal(t, 2, ix.Size())
+
+		// Remove the rest.
+		ix.RemoveNamespace("ns-2")
+		ix.RemoveNamespace("ns-3")
+		assert.Equal(t, 0, ix.Size())
+		assert.Empty(t, ix.Lookup("ns-2", "fn-c", ""))
+		assert.Empty(t, ix.Lookup("ns-3", "fn-d", ""))
+	})
+
+	t.Run("different function and slice namespaces", func(t *testing.T) {
+		ix := NewIndex()
+		sl := slice("s5", "hello", "default", 8888, "10.0.0.5")
+		sl.Namespace = "workloads"
+		ix.ApplySlice(sl)
+		assert.Equal(t, 1, ix.Size())
+		assert.ElementsMatch(t, []string{"10.0.0.5:8888"}, addrs(ix.Lookup("default", "hello", "")))
+		ix.RemoveNamespace("workloads")
+		assert.Empty(t, ix.Lookup("default", "hello", ""))
+		assert.Equal(t, 0, ix.Size())
+	})
+
+	t.Run("preserves slices from other namespaces", func(t *testing.T) {
+		ix := NewIndex()
+		first := slice("s6", "hello", "default", 8888, "10.0.0.6")
+		first.Namespace = "workloads-a"
+		second := slice("s7", "hello", "default", 8888, "10.0.0.7")
+		second.Namespace = "workloads-b"
+		ix.ApplySlice(first)
+		ix.ApplySlice(second)
+
+		ix.RemoveNamespace("workloads-a")
+		assert.ElementsMatch(t, []string{"10.0.0.7:8888"}, addrs(ix.Lookup("default", "hello", "")))
+		assert.Equal(t, 1, ix.Size())
+
+		ix.RemoveNamespace("workloads-b")
+		assert.Empty(t, ix.Lookup("default", "hello", ""))
+		assert.Equal(t, 0, ix.Size())
+	})
+}
```

---

### Incident Patch 11: `9c716f90` (2026-08-04)
**Commit Message**: executor: create-routed reconciles must converge the deployment spec — fixes the swallowed-update staleness behind the TestFunctionNameUpdate flake (#3662)

* executor: create-routed reconciles must converge the deployment spec, or a coalesced update is swallowed forever

TestFunctionNameUpdate flaked with the route serving the OLD entrypoint's
body for its full 180s window — status 200, "alpha" — after fn update had
demonstrably landed on the API object. Attempt-level forensics on the
failed run split the two instances: attempt 1 was the (since-fixed) DNS
cascade killing the router->executor RPC; attempt 2 had zero DNS lines and
is this bug.

The reconcile routing has create-routed branches that can be handed a spec
UPDATE: newdeploy's drift-recreate branch (resourcesExist false), and both
of container's create-routed branches. createFunction only adopts/scales
an existing deployment — it never rewrites the pod spec. So when such a
branch fires on the reconcile that carries a spec change (a create+update
coalesced into the first reconcile, or resourcesExist false-alarming from
Manager-cache lag on the update's own reconcile), the deployment is
adopted on its old spec, the reconcil

**File**: `pkg/executor/executortype/container/containermgr.go` (modified, +47/-0)
```diff
@@ -16,6 +16,7 @@ import (
 
 	appsv1 "k8s.io/api/apps/v1"
 	apiv1 "k8s.io/api/core/v1"
+	apiequality "k8s.io/apimachinery/pkg/api/equality"
 	k8sErrs "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/labels"
@@ -606,6 +607,40 @@ func (caaf *Container) updateFunction(ctx context.Context, oldFn *fv1.Function,
 	return nil
 }
 
+// reconcileDeploymentSpec brings an already-existing deployment up to the
+// function's current spec when it lags — the container-type mirror of
+// newdeploy's helper, and the level-trigger half of every create-routed
+// reconcile (see createAndConverge in reconciler.go for why it must follow
+// createFunction). The deployment carries the function's ResourceVersion as
+// an annotation (getDeployAnnotations); compare it and push the current spec
+// when stale. A no-op when already current.
+func (caaf *Container) reconcileDeploymentSpec(ctx context.Context, fn *fv1.Function) error {
+	// Live entry only: versioned projections sharing the UID pin immutable
+	// snapshots that must not be rewritten to the live spec.
+	fsvc, err := caaf.fsCache.GetLiveByFunctionUID(fn.UID)
+	if err != nil {
+		// Not specialized yet — no deployment to reconcile; the on-demand path
+		// creates it from the current spec on first invocation.
+		return nil
+	}
+	ns := caaf.nsResolver.GetFunctionNS(fn.Namespace)
+	existingDepl, err := caaf.kubernetesClient.AppsV1().Deployments(ns).Get(ctx, fsvc.Name, metav1.GetOptions{})
+	if err != nil {
+		if k8sErrs.IsNotFound(err) {
+			return nil
+		}
+		return err
+	}
+	deplRV := existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION]
+	if deplRV == fn.ResourceVersion {
+		return nil // deployment already reflects the current function spec
+	}
+	caaf.logger.Info("reconciling stale deployment to current function spec",
+		"function", fn.Name, "deployment", fsvc.Name,
+		"deployment_rv", deplRV, "function_rv", fn.ResourceVersion)
+	return caaf.updateFuncDeployment(ctx, fn)
+}
+
 func (caaf *Container) updateFuncDeployment(ctx context.Context, fn *fv1.Function) error {
 	// Live entry only — see updateFunction: versioned projections' entries
 	// share the UID but must keep their pinned spec.
@@ -638,6 +673,18 @@ func (caaf *Container) updateFuncDeployment(ctx context.Context, fn *fv1.Functio
 		return err
 	}
 
+	// A Deployment's selector is immutable, and for container functions it is
+	// derived from the Function CR's own labels (getDeployLabels copies them),
+	// which can change without bumping Generation. An in-place Update with a
+	// different selector is rejected by the API server; returning nil (not an
+	// error) avoids requeuing forever against a permanently immutable field —
+	// the same guard newdeploy's updateFuncDeployment carries.
+	if !apiequality.Semantic.DeepEqual(existingDepl.Spec.Selector, newDeployment.Spec.Selector) {
+		caaf.logger.Info("deployment selector changed (function labels changed); cannot update in place, leaving existing deployment",
+			"deployment", fnObjName, "function", fn.Name)
+		return nil
+	}
+
 	err = caaf.updateDeployment(ctx, newDeployment, ns)
 	if err != nil {
 		caaf.updateStatus(fn, err, "failed to update deployment while updating function")
```

**File**: `pkg/executor/executortype/container/reconciler.go` (modified, +22/-4)
```diff
@@ -19,6 +19,7 @@ import (
 type functionManager interface {
 	createFunction(context.Context, *fv1.Function) (*fscache.FuncSvc, error)
 	updateFunction(context.Context, *fv1.Function, *fv1.Function) error
+	reconcileDeploymentSpec(context.Context, *fv1.Function) error
 	deleteFunction(context.Context, *fv1.Function) error
 	// resourcesExist reports whether the function's backing Deployment and Service
 	// are present (read from the Manager cache). False means they drifted away
@@ -49,20 +50,37 @@ func (caaf *Container) DeleteFunction(ctx context.Context, fn *fv1.Function) err
 // get-or-create path rather than diffing a no-longer-existent object.
 func reconcileContainerFunc(ctx context.Context, mgr functionManager, old, fn *fv1.Function) error {
 	if old == nil {
-		_, err := mgr.createFunction(ctx, fn)
-		return err
+		return createAndConverge(ctx, mgr, fn)
 	}
 	exist, err := mgr.resourcesExist(ctx, fn)
 	if err != nil {
 		return err
 	}
 	if !exist {
-		_, err := mgr.createFunction(ctx, fn)
-		return err
+		return createAndConverge(ctx, mgr, fn)
 	}
 	return mgr.updateFunction(ctx, old, fn)
 }
 
+// createAndConverge is the create-routed path both branches above take, mirroring
+// newdeploy: create (or adopt) the function's backing objects, then bring the
+// deployment to the current spec. reconcileDeploymentSpec is a no-op when the
+// deployment already reflects fn.
+//
+// The second step is not optional. createFunction only adopts/scales an existing
+// deployment — it never rewrites the pod spec — so when this reconcile is the ONLY
+// carrier of a spec change (a create and an update coalesced into one first
+// reconcile, or a drift false-alarm from cache lag on the update's own reconcile),
+// adopting without a respec consumes the update permanently: lastReconciled stores
+// the new spec, GenerationChangedPredicate filters resyncs, and no event ever
+// re-fires.
+func createAndConverge(ctx context.Context, mgr functionManager, fn *fv1.Function) error {
+	if _, err := mgr.createFunction(ctx, fn); err != nil {
+		return err
+	}
+	return mgr.reconcileDeploymentSpec(ctx, fn)
+}
+
 // RegisterReconcilers registers no type-specific watches: the container type's
 // Function reconciles are handled by the shared executor-level Function
 // reconciler (see funcreconciler.RegisterReconciler), which it plugs into via
```

**File**: `pkg/executor/executortype/container/reconciler_test.go` (modified, +30/-5)
```diff
@@ -17,40 +17,56 @@ import (
 )
 
 type fakeFuncMgr struct {
-	created, updated, deleted []string
-	resourcesGone             bool // resourcesExist returns false (drift)
+	created, updated, deleted, reconciled []string
+	calls                                 []string // ordered call log: "create", "converge", "update"
+	createErr                             error    // injected createFunction failure
+	resourcesGone                         bool     // resourcesExist returns false (drift)
 }
 
 func (f *fakeFuncMgr) resourcesExist(_ context.Context, _ *fv1.Function) (bool, error) {
 	return !f.resourcesGone, nil
 }
 
 func (f *fakeFuncMgr) createFunction(_ context.Context, fn *fv1.Function) (*fscache.FuncSvc, error) {
+	f.calls = append(f.calls, "create")
+	if f.createErr != nil {
+		return nil, f.createErr
+	}
 	f.created = append(f.created, fn.Name)
 	return nil, nil
 }
 func (f *fakeFuncMgr) updateFunction(_ context.Context, old, _ *fv1.Function) error {
+	f.calls = append(f.calls, "update")
 	f.updated = append(f.updated, old.Name)
 	return nil
 }
 func (f *fakeFuncMgr) deleteFunction(_ context.Context, fn *fv1.Function) error {
 	f.deleted = append(f.deleted, fn.Name)
 	return nil
 }
+func (f *fakeFuncMgr) reconcileDeploymentSpec(_ context.Context, fn *fv1.Function) error {
+	f.calls = append(f.calls, "converge")
+	f.reconciled = append(f.reconciled, fn.Name)
+	return nil
+}
 
 func fnOfType(name string, et fv1.ExecutorType) *fv1.Function {
 	fn := &fv1.Function{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"}}
 	fn.Spec.InvokeStrategy.ExecutionStrategy.ExecutorType = et
 	return fn
 }
 
+// Every create-routed reconcile must chase createFunction with
+// reconcileDeploymentSpec — see createAndConverge for why skipping it swallows a
+// coalesced update permanently.
 func TestReconcileContainerFunc(t *testing.T) {
 	fn := fnOfType("fn", fv1.ExecutorTypeContainer)
 
-	t.Run("create (old == nil) creates the function", func(t *testing.T) {
+	t.Run("create (old == nil) creates the function and converges the spec", func(t *testing.T) {
 		mgr := &fakeFuncMgr{}
 		require.NoError(t, reconcileContainerFunc(t.Context(), mgr, nil, fn))
-		assert.Equal(t, []string{"fn"}, mgr.created)
+		assert.Equal(t, []string{"create", "converge"}, mgr.calls,
+			"createFunction adopts without a respec; the chaser must run AFTER it")
 		assert.Empty(t, mgr.updated)
 	})
 
@@ -59,15 +75,24 @@ func TestReconcileContainerFunc(t *testing.T) {
 		require.NoError(t, reconcileContainerFunc(t.Context(), mgr, fn, fn))
 		assert.Equal(t, []string{"fn"}, mgr.updated)
 		assert.Empty(t, mgr.created)
+		assert.Empty(t, mgr.reconciled, "the diff path owns spec convergence on plain updates")
 	})
 
 	t.Run("drift: missing backing resources are recreated, not diffed", func(t *testing.T) {
 		mgr := &fakeFuncMgr{resourcesGone: true}
 		require.NoError(t, reconcileContainerFunc(t.Context(), mgr, fn, fn))
-		assert.Equal(t, []string{"fn"}, mgr.created, "drifted-away resources must be recreated via get-or-create")
+		assert.Equal(t, []string{"create", "converge"}, mgr.calls,
+			"the chase must FOLLOW the create — a drift false-alarm converges the adopted deployment, in that order")
 		assert.Empty(t, mgr.updated, "no diff against a non-existent object")
 	})
 
+	t.Run("create failure short-circuits the chaser", func(t *testing.T) {
+		mgr := &fakeFuncMgr{resourcesGone: true, createErr: assert.AnError}
+		require.Error(t, reconcileContainerFunc(t.Context(), mgr, fn, fn))
+		assert.Equal(t, []string{"create"}, mgr.calls,
+			"a failed create must propagate before the converge runs; the retry re-enters the whole branch")
+	})
+
 	t.Run("DeleteFunction tears down the function", func(t *testing.T) {
 		// DeleteFunction delegates straight to deleteFunction; exercise the wiring.
 		mgr := &fakeFuncMgr{}
```

**File**: `pkg/executor/executortype/container/reconcilespec_test.go` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package container
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/kubernetes/fake"
+
+	fv1 "github.com/fission/fission/pkg/apis/core/v1"
+	"github.com/fission/fission/pkg/executor/fscache"
+	hpautils "github.com/fission/fission/pkg/executor/util/hpa"
+	"github.com/fission/fission/pkg/utils"
+	"github.com/fission/fission/pkg/utils/loggerfactory"
+)
+
+func newSpecTestContainer(t *testing.T) *Container {
+	t.Helper()
+	logger := loggerfactory.GetLogger()
+	kubeClient := fake.NewClientset()
+	return &Container{
+		logger:           logger,
+		kubernetesClient: kubeClient,
+		fsCache:          fscache.MakeFunctionServiceCache(logger),
+		nsResolver:       utils.DefaultNSResolver(),
+		hpaops:           hpautils.NewHpaOperations(logger, kubeClient, "test-instance"),
+	}
+}
+
+func countDeploymentUpdates(t *testing.T, caaf *Container) int {
+	t.Helper()
+	n := 0
+	for _, a := range caaf.kubernetesClient.(*fake.Clientset).Actions() {
+		if a.GetVerb() == "update" && a.GetResource().Resource == "deployments" {
+			n++
+		}
+	}
+	return n
+}
+
+// seedFnWithDeployment creates the function's deployment via the production
+// spec builder (so the selector and annotations are the real ones), records it
+// in the fake clientset, and registers the live fsvc entry the helper resolves
+// through. The deployment's RV annotation is whatever fn.ResourceVersion was at
+// seed time.
+func seedFnWithDeployment(t *testing.T, caaf *Container, fn *fv1.Function) string {
+	t.Helper()
+	objName := caaf.getObjName(fn)
+	one := int32(1)
+	depl, err := caaf.getDeploymentSpec(t.Context(), fn, &one, objName, "default",
+		caaf.getDeployLabels(fn.ObjectMeta), caaf.getDeployAnnotations(fn.ObjectMeta))
+	require.NoError(t, err)
+	_, err = caaf.kubernetesClient.AppsV1().Deployments("default").Create(t.Context(), depl, metav1.CreateOptions{})
+	require.NoError(t, err)
+	_, err = caaf.fsCache.Add(fscache.FuncSvc{
+		Name:     objName,
+		Function: &fn.ObjectMeta,
+		Address:  "10.0.0.1:8888",
+		Executor: fv1.ExecutorTypeContainer,
+	})
+	require.NoError(t, err)
+	return objName
+}
+
+// TestContainerReconcileDeploymentSpec pins the helper's four branches — the
+// RV-equal no-op is the idempotency claim every create-routed reconcile leans
+// on, and the stale branch is the level-trigger that un-swallows a coalesced
+// update.
+func TestContainerReconcileDeploymentSpec(t *testing.T) {
+	t.Parallel()
+
+	t.Run("no live cache entry is a no-op", func(t *testing.T) {
+		t.Parallel()
+		caaf := newSpecTestContainer(t)
+		fn := newTestContainerFunction()
+		fn.UID = "00000000-0000-0000-0000-000000000001"
+		require.NoError(t, caaf.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countDeploymentUpdates(t, caaf))
+	})
+
+	t.Run("deployment gone is a no-op, not an error", func(t *testing.T) {
+		t.Parallel()
+		caaf := newSpecTestContainer(t)
+		fn := newTestContainerFunction()
+		fn.UID = "00000000-0000-0000-0000-000000000002"
+		_, err := caaf.fsCache.Add(fscache.FuncSvc{
+			Name: "vanished", Function: &fn.ObjectMeta, Address: "10.0.0.9:8888", Executor: fv1.ExecutorTypeContainer,
+		})
+		require.NoError(t, err)
+		require.NoError(t, caaf.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countDeploymentUpdates(t, caaf))
+	})
+
+	t.Run("matching RV annotation issues no update", func(t *testing.T) {
+		t.Parallel()
+		caaf := newSpecTestContainer(t)
+		fn := newTestContainerFunction()
+		fn.UID = "00000000-0000-0000-0000-000000000003"
+		fn.ResourceVersion = "41"
+		seedFnWithDeployment(t, caaf, fn)
+		require.NoError(t, caaf.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countDeploymentUpdates(t, caaf), "an already-current deployment must not be rewritten")
+	})
+
+	t.Run("stale RV annotation pushes the current spec", func(t *testing.T) {
+		t.Parallel()
+		caaf := newSpecTestContainer(t)
+		fn := newTestContainerFunction()
+		fn.UID = "00000000-0000-0000-0000-000000000004"
+		fn.ResourceVersion = "41"
+		objName := seedFnWithDeployment(t, caaf, fn)
+
+		fn.ResourceVersion = "42" // the update the deployment never saw
+		require.NoError(t, caaf.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Equal(t, 1, countDeploymentUpdates(t, caaf), "a stale deployment must be converged")
+
+		depl, err := caaf.kubernetesClient.AppsV1().Deployments("default").Get(t.Context(), objName, metav1.GetOptions{})
+		require.NoError(t, err)
+		assert.Equal(t, "42", depl.Annotations[fv1.FUNCTION_RESOURCE_VERSION],
+			"the converged deployment must carry the new function RV")
+	})
+}
+
+// TestContainerUpdateFuncDeploymentSelectorGuard pins the immutable-selector
+// guard: a Function whose CR labels changed (which changes the computed
+// selector without bumping Generation) must be left in place w
```

**File**: `pkg/executor/executortype/newdeploy/newdeploymgr.go` (modified, +11/-13)
```diff
@@ -700,15 +700,11 @@ func (deploy *NewDeploy) updateFunction(ctx context.Context, oldFn *fv1.Function
 }
 
 // reconcileDeploymentSpec brings an already-existing deployment up to the
-// function's current spec when it lags. createFunction only *adopts/scales* an
-// existing deployment (it does not rewrite the pod spec), and updateFunction is
-// diff-based against the last-reconciled object. So if a function's create and a
-// later spec update coalesce into a single first reconcile — common when the
-// router specializes the function on-demand (creating the deployment) just before
-// `fission fn update` lands — the deployment can be left on the old spec with no
-// transition for updateFunction to diff. The deployment carries the function's
-// ResourceVersion as a metadata annotation (getDeployAnnotations), so compare it:
-// if stale, push the current spec. A no-op when already current.
+// function's current spec when it lags — the level-trigger half of every
+// create-routed reconcile (see createAndConverge in reconciler.go for why it
+// must follow createFunction). The deployment carries the function's
+// ResourceVersion as a metadata annotation (getDeployAnnotations), so compare
+// it: if stale, push the current spec. A no-op when already current.
 func (deploy *NewDeploy) reconcileDeploymentSpec(ctx context.Context, fn *fv1.Function) error {
 	// Live entry only: fn is the live Function CR here, and versioned
 	// projections sharing its UID pin immutable snapshots that must not be
@@ -727,17 +723,18 @@ func (deploy *NewDeploy) reconcileDeploymentSpec(ctx context.Context, fn *fv1.Fu
 		}
 		return err
 	}
-	if existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION] == fn.ResourceVersion {
+	deplRV := existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION]
+	if deplRV == fn.ResourceVersion {
 		return nil // deployment already reflects the current function spec
 	}
 	env, err := deploy.fissionClient.CoreV1().Environments(fn.Spec.Environment.Namespace).
 		Get(ctx, fn.Spec.Environment.Name, metav1.GetOptions{})
 	if err != nil {
 		return err
 	}
-	deploy.logger.Info("reconciling stale deployment to current function spec on first sight",
+	deploy.logger.Info("reconciling stale deployment to current function spec",
 		"function", fn.Name, "deployment", fsvc.Name,
-		"deployment_rv", existingDepl.Annotations[fv1.FUNCTION_RESOURCE_VERSION], "function_rv", fn.ResourceVersion)
+		"deployment_rv", deplRV, "function_rv", fn.ResourceVersion)
 	return deploy.updateFuncDeployment(ctx, fn, env)
 }
 
@@ -979,7 +976,8 @@ func (deploy *NewDeploy) DumpDebugInfo(ctx context.Context) error {
 // that lands in the pod template but is missing from this diff leaves the CR
 // and the running container disagreeing indefinitely, because updateFunction
 // is the only steady-state path that rewrites the template (the RV-annotation
-// catch-all in reconcileDeploymentSpec runs only on the old == nil branch).
+// catch-all in reconcileDeploymentSpec runs only on create-routed reconciles —
+// first sight and drift-recreate — never on the plain update path).
 func podTemplateChanged(oldFn, newFn *fv1.Function) bool {
 	return oldFn.Spec.Environment != newFn.Spec.Environment ||
 		oldFn.Spec.Package.PackageRef != newFn.Spec.Package.PackageRef ||
```

**File**: `pkg/executor/executortype/newdeploy/reconciler.go` (modified, +25/-10)
```diff
@@ -40,10 +40,8 @@ type envFunctionUpdater interface {
 // last-reconciled cache and executor-type transitions, so this only sees same-type
 // create/update:
 //
-//   - create (old == nil): createFunction, then reconcileDeploymentSpec to bring a
-//     possibly-stale adopted deployment (e.g. the router specialized the function
-//     on-demand before `fn update` landed) to the current spec. A no-op when
-//     already current.
+//   - create (old == nil), and any reconcile whose backing objects drifted away:
+//     createAndConverge.
 //   - update (old != nil): updateFunction(old, fn), which diffs HPA min/max/metrics
 //     and secret/configmap/package changes.
 func (deploy *NewDeploy) ReconcileFunction(ctx context.Context, old, fn *fv1.Function) error {
@@ -65,22 +63,39 @@ func (deploy *NewDeploy) DeleteFunction(ctx context.Context, fn *fv1.Function) e
 // functions warm without waiting for one.)
 func reconcileNewdeployFunc(ctx context.Context, mgr funcManager, old, fn *fv1.Function) error {
 	if old == nil {
-		if _, err := mgr.createFunction(ctx, fn); err != nil {
-			return err
-		}
-		return mgr.reconcileDeploymentSpec(ctx, fn)
+		return createAndConverge(ctx, mgr, fn)
 	}
 	exist, err := mgr.resourcesExist(ctx, fn)
 	if err != nil {
 		return err
 	}
 	if !exist {
-		_, err := mgr.createFunction(ctx, fn)
-		return err
+		return createAndConverge(ctx, mgr, fn)
 	}
 	return mgr.updateFunction(ctx, old, fn)
 }
 
+// createAndConverge is the create-routed path both branches above take: create (or
+// adopt) the function's backing objects, then bring the deployment to the current
+// spec. reconcileDeploymentSpec is a no-op when the deployment already reflects fn.
+//
+// The second step is not optional. createFunction only adopts/scales an existing
+// deployment — it never rewrites the pod spec — so when this reconcile is the ONLY
+// carrier of a spec change, adopting without a respec consumes the update
+// permanently: lastReconciled stores the new spec, GenerationChangedPredicate
+// filters resyncs, and no event ever re-fires (measured in the wild as a function
+// serving its old entrypoint indefinitely after `fn update`). Two ways in: a create
+// and a later update coalescing into one first reconcile — the router specialized
+// the function on-demand just before `fission fn update` landed — or a cache
+// false-alarm where !exist saw a Deployment that had lagged out of the Manager
+// cache.
+func createAndConverge(ctx context.Context, mgr funcManager, fn *fv1.Function) error {
+	if _, err := mgr.createFunction(ctx, fn); err != nil {
+		return err
+	}
+	return mgr.reconcileDeploymentSpec(ctx, fn)
+}
+
 // ReconcileEnvironment satisfies executortype.EnvReconciler: it propagates an
 // environment's runtime-image change to the deployments of its newdeploy
 // functions. It acts only on an image change (the informer handler it replaced
```

**File**: `pkg/executor/executortype/newdeploy/reconciler_test.go` (modified, +24/-4)
```diff
@@ -18,18 +18,25 @@ import (
 
 type fakeFuncMgr struct {
 	created, updated, deleted, reconciled []string
-	resourcesGone                         bool // resourcesExist returns false (drift)
+	calls                                 []string // ordered call log: "create", "converge", "update"
+	createErr                             error    // injected createFunction failure
+	resourcesGone                         bool     // resourcesExist returns false (drift)
 }
 
 func (f *fakeFuncMgr) resourcesExist(_ context.Context, _ *fv1.Function) (bool, error) {
 	return !f.resourcesGone, nil
 }
 
 func (f *fakeFuncMgr) createFunction(_ context.Context, fn *fv1.Function) (*fscache.FuncSvc, error) {
+	f.calls = append(f.calls, "create")
+	if f.createErr != nil {
+		return nil, f.createErr
+	}
 	f.created = append(f.created, fn.Name)
 	return nil, nil
 }
 func (f *fakeFuncMgr) updateFunction(_ context.Context, old, _ *fv1.Function) error {
+	f.calls = append(f.calls, "update")
 	f.updated = append(f.updated, old.Name)
 	return nil
 }
@@ -38,6 +45,7 @@ func (f *fakeFuncMgr) deleteFunction(_ context.Context, fn *fv1.Function) error
 	return nil
 }
 func (f *fakeFuncMgr) reconcileDeploymentSpec(_ context.Context, fn *fv1.Function) error {
+	f.calls = append(f.calls, "converge")
 	f.reconciled = append(f.reconciled, fn.Name)
 	return nil
 }
@@ -63,14 +71,17 @@ func envWithImage(name, image string) *fv1.Environment {
 	return env
 }
 
+// Every create-routed reconcile must chase createFunction with
+// reconcileDeploymentSpec — see createAndConverge for why skipping it swallows a
+// coalesced update permanently.
 func TestReconcileNewdeployFunc(t *testing.T) {
 	fn := fnOfType("fn", fv1.ExecutorTypeNewdeploy)
 
 	t.Run("create (old == nil) creates then reconciles the deployment spec", func(t *testing.T) {
 		mgr := &fakeFuncMgr{}
 		require.NoError(t, reconcileNewdeployFunc(t.Context(), mgr, nil, fn))
-		assert.Equal(t, []string{"fn"}, mgr.created)
-		assert.Equal(t, []string{"fn"}, mgr.reconciled, "first sight must reconcile a possibly-stale adopted deployment to current spec")
+		assert.Equal(t, []string{"create", "converge"}, mgr.calls,
+			"first sight must reconcile a possibly-stale adopted deployment AFTER creating")
 		assert.Empty(t, mgr.updated)
 	})
 
@@ -79,15 +90,24 @@ func TestReconcileNewdeployFunc(t *testing.T) {
 		require.NoError(t, reconcileNewdeployFunc(t.Context(), mgr, fn, fn))
 		assert.Equal(t, []string{"fn"}, mgr.updated)
 		assert.Empty(t, mgr.created)
+		assert.Empty(t, mgr.reconciled, "the diff path owns spec convergence on plain updates")
 	})
 
 	t.Run("drift: missing backing resources are recreated, not diffed", func(t *testing.T) {
 		mgr := &fakeFuncMgr{resourcesGone: true}
 		require.NoError(t, reconcileNewdeployFunc(t.Context(), mgr, fn, fn))
-		assert.Equal(t, []string{"fn"}, mgr.created, "drifted-away resources must be recreated via get-or-create")
+		assert.Equal(t, []string{"create", "converge"}, mgr.calls,
+			"the chase must FOLLOW the create — a drift false-alarm converges the adopted deployment, in that order")
 		assert.Empty(t, mgr.updated, "no diff against a non-existent object")
 	})
 
+	t.Run("create failure short-circuits the chaser", func(t *testing.T) {
+		mgr := &fakeFuncMgr{resourcesGone: true, createErr: assert.AnError}
+		require.Error(t, reconcileNewdeployFunc(t.Context(), mgr, fn, fn))
+		assert.Equal(t, []string{"create"}, mgr.calls,
+			"a failed create must propagate before the converge runs; the retry re-enters the whole branch")
+	})
+
 	t.Run("DeleteFunction tears down the function", func(t *testing.T) {
 		// DeleteFunction delegates straight to deleteFunction; exercise the wiring.
 		mgr := &fakeFuncMgr{}
```

**File**: `pkg/executor/executortype/newdeploy/reconcilespec_test.go` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package newdeploy
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	appsv1 "k8s.io/api/apps/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/kubernetes/fake"
+
+	fv1 "github.com/fission/fission/pkg/apis/core/v1"
+	"github.com/fission/fission/pkg/executor/fscache"
+	"github.com/fission/fission/pkg/utils"
+	"github.com/fission/fission/pkg/utils/loggerfactory"
+)
+
+// TestNewdeployReconcileDeploymentSpec pins the helper's cheap branches (the
+// full stale-push path needs an Environment and is exercised by the container
+// twin, whose helper mirrors this one, and by the integration suite). The
+// RV-equal no-op is the idempotency claim every create-routed reconcile leans
+// on.
+func TestNewdeployReconcileDeploymentSpec(t *testing.T) {
+	t.Parallel()
+
+	newDeployFixture := func() (*NewDeploy, *fake.Clientset) {
+		logger := loggerfactory.GetLogger()
+		kubeClient := fake.NewClientset()
+		return &NewDeploy{
+			logger:           logger,
+			kubernetesClient: kubeClient,
+			fsCache:          fscache.MakeFunctionServiceCache(logger),
+			nsResolver:       utils.DefaultNSResolver(),
+		}, kubeClient
+	}
+	countUpdates := func(client *fake.Clientset) int {
+		n := 0
+		for _, a := range client.Actions() {
+			if a.GetVerb() == "update" && a.GetResource().Resource == "deployments" {
+				n++
+			}
+		}
+		return n
+	}
+
+	t.Run("no live cache entry is a no-op", func(t *testing.T) {
+		t.Parallel()
+		deploy, client := newDeployFixture()
+		fn := fnOfType("fn", fv1.ExecutorTypeNewdeploy)
+		fn.UID = "00000000-0000-0000-0000-0000000000a1"
+		require.NoError(t, deploy.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countUpdates(client))
+	})
+
+	t.Run("deployment gone is a no-op, not an error", func(t *testing.T) {
+		t.Parallel()
+		deploy, client := newDeployFixture()
+		fn := fnOfType("fn", fv1.ExecutorTypeNewdeploy)
+		fn.UID = "00000000-0000-0000-0000-0000000000a2"
+		_, err := deploy.fsCache.Add(fscache.FuncSvc{
+			Name: "vanished", Function: &fn.ObjectMeta, Address: "10.0.0.9:8888", Executor: fv1.ExecutorTypeNewdeploy,
+		})
+		require.NoError(t, err)
+		require.NoError(t, deploy.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countUpdates(client))
+	})
+
+	t.Run("matching RV annotation issues no update", func(t *testing.T) {
+		t.Parallel()
+		deploy, client := newDeployFixture()
+		fn := fnOfType("fn", fv1.ExecutorTypeNewdeploy)
+		fn.UID = "00000000-0000-0000-0000-0000000000a3"
+		fn.ResourceVersion = "41"
+		_, err := client.AppsV1().Deployments("default").Create(t.Context(), &appsv1.Deployment{
+			ObjectMeta: metav1.ObjectMeta{
+				Name: "nd-fn", Namespace: "default",
+				Annotations: map[string]string{fv1.FUNCTION_RESOURCE_VERSION: "41"},
+			},
+		}, metav1.CreateOptions{})
+		require.NoError(t, err)
+		_, err = deploy.fsCache.Add(fscache.FuncSvc{
+			Name: "nd-fn", Function: &fn.ObjectMeta, Address: "10.0.0.1:8888", Executor: fv1.ExecutorTypeNewdeploy,
+		})
+		require.NoError(t, err)
+		require.NoError(t, deploy.reconcileDeploymentSpec(t.Context(), fn))
+		assert.Zero(t, countUpdates(client), "an already-current deployment must not be rewritten")
+	})
+}
```

---

### Incident Patch 12: `9c564d37` (2026-08-04)
**Commit Message**: api: Environment.TerminationGracePeriod becomes *int64 so typed clients can say 0 (#3657)

An explicit terminationGracePeriod: 0 (no drain window; instant kill) was a
raw-YAML-only setting: on the int64 field, omitempty dropped a zero before
the apiserver saw it, and the CRD default served the absence back as 90. The
CLI accepted --graceperiod 0 and silently produced a 90s environment.

The pointer restores 0 as a first-class value — nil means "use the default"
and marshals as absent, a set 0 reaches the wire and is kept — pinned by a
wire-contract test. In-process readers go through a new
EffectiveTerminationGracePeriod(), which folds nil to the CRD default's
in-process mirror for objects that never crossed the apiserver.

Pool-roll stability: envRuntimeHash is fed the EFFECTIVE value, so nil and
an explicit 90 hash alike and the hash is byte-identical across this
migration — no warm-pod recycle wave on the release that ships it (pinned
alongside the discriminator's other cases). The benchmark harness guards
its EnvOptions conversion so an unset option stays nil instead of becoming
an explicit instant-kill zero.

CLI: create/update hand the flag value through as a pointer; an upda

**File**: `RELEASES.md` (modified, +2/-2)
```diff
@@ -78,8 +78,8 @@ Set `terminationGracePeriod` per environment if your functions serve requests lo
 This is the **Environment-level** grace only; the container executor's function-level `--graceperiod` keeps its 360s default.
 How it reaches existing objects: CRD structural defaults apply when the apiserver **serves** an object, not only at write time — so an Environment stored without the field reads back as 90 the moment the upgraded CRD is applied, with no object update.
 Practically, every such environment's pods roll **once** on the first executor reconcile after this upgrade (the pod template's grace changes 0→90); that roll is the fix taking effect.
-Only an explicit `terminationGracePeriod: 0` applied as raw YAML keeps 0 — and raw YAML is now the *only* way to express 0: the Go field's `omitempty` drops a zero before the apiserver sees it, so the CLI and any typed client cannot set it (they never could — `omitempty` predates this change — but previously the served value for an absent field was 0, so it looked like it worked).
-Making 0 first-class again for typed clients requires migrating the field to a pointer; tracked as follow-up work.
+An explicit `terminationGracePeriod: 0` (no drain window; instant kill) is preserved wherever it is expressed: the Go field is now a `*int64`, so `fission env create|update --graceperiod 0` and typed clients marshal a real 0 instead of `omitempty` dropping it, and the apiserver keeps it rather than serving back 90.
+For Go library consumers this is an API break: `EnvironmentSpec.TerminationGracePeriod` changed from `int64` to `*int64` (nil means "use the default"); read it through `EffectiveTerminationGracePeriod()`, which folds nil to the CRD default.
 
 ## Deprecation policy
 
```

**File**: `crds/v1/fission.io_environments.yaml` (modified, +10/-5)
```diff
@@ -20228,11 +20228,16 @@ spec:
                   it per environment for functions with longer request timeouts.
 
                   The CRD default below is what makes the documented default true for
-                  API-created Environments: the field is an int64, so before it existed
-                  an Environment created without the field got 0 — instant SIGKILL,
-                  every in-flight request on the pod dying as a connection reset. The
-                  in-code fallback cannot distinguish that 0 from an explicit one, and
-                  admission-time defaulting can.
+                  API-created Environments: nil means "use the default" and the
+                  apiserver fills an absent field with 90 at serving time.
+
+                  The *pointer* is what makes an EXPLICIT 0 ("no drain window, kill
+                  instantly") expressible from typed Go clients: on the previous
+                  int64 field, omitempty marshalled 0 as absent and the apiserver
+                  served it back as 90, so raw YAML was the only way to say 0.
+                  In-process readers must use EffectiveTerminationGracePeriod()
+                  (env_validation.go), which mirrors the CRD default for objects
+                  that never crossed the apiserver.
                   (Optional) defaults to 90 seconds
                 format: int64
                 minimum: 0
```

**File**: `pkg/apis/core/v1/env_validation.go` (modified, +18/-0)
```diff
@@ -125,3 +125,21 @@ func validateFunctionEnv(env []apiv1.EnvVar, envFrom []apiv1.EnvFromSource) erro
 	}
 	return errs
 }
+
+// DefaultTerminationGracePeriod is the drain window an Environment gets when
+// spec.terminationGracePeriod is nil — the in-process mirror of the CRD
+// structural default (types.go: +kubebuilder:default=90). Keep the two equal:
+// the apiserver applies the marker at serving time, so this constant is only
+// reached by objects that never crossed the apiserver (hand-built fixtures,
+// direct constructors).
+const DefaultTerminationGracePeriod int64 = 90
+
+// EffectiveTerminationGracePeriod returns the drain window the pod template
+// actually gets: the field's value when set — an explicit 0 means "no drain
+// window, kill instantly" — else DefaultTerminationGracePeriod.
+func (spec EnvironmentSpec) EffectiveTerminationGracePeriod() int64 {
+	if spec.TerminationGracePeriod == nil {
+		return DefaultTerminationGracePeriod
+	}
+	return *spec.TerminationGracePeriod
+}
```

**File**: `pkg/apis/core/v1/env_validation_test.go` (modified, +30/-0)
```diff
@@ -5,6 +5,7 @@
 package v1
 
 import (
+	"encoding/json"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -187,3 +188,32 @@ func TestFunctionSpecEnvPhaseGates(t *testing.T) {
 		assert.NoError(t, s.Validate())
 	})
 }
+
+// TestTerminationGracePeriodWireContract pins the reason the field is a
+// pointer: an explicit 0 must survive marshalling (the previous int64 +
+// omitempty dropped it as absent, and the apiserver's CRD default served it
+// back as 90 — "instant kill" was expressible only via raw YAML), while an
+// unset field must still marshal as absent so the CRD default applies.
+func TestTerminationGracePeriodWireContract(t *testing.T) {
+	t.Parallel()
+
+	explicitZero, err := json.Marshal(EnvironmentSpec{TerminationGracePeriod: new(int64(0))})
+	require.NoError(t, err)
+	assert.Contains(t, string(explicitZero), `"terminationGracePeriod":0`,
+		"an explicit 0 must reach the wire — it is a real value, not the absence of one")
+
+	unset, err := json.Marshal(EnvironmentSpec{})
+	require.NoError(t, err)
+	assert.NotContains(t, string(unset), "terminationGracePeriod",
+		"nil must marshal as absent so the apiserver's CRD default fills it")
+}
+
+func TestEffectiveTerminationGracePeriod(t *testing.T) {
+	t.Parallel()
+
+	assert.Equal(t, DefaultTerminationGracePeriod, EnvironmentSpec{}.EffectiveTerminationGracePeriod(),
+		"nil means: use the default")
+	assert.Zero(t, EnvironmentSpec{TerminationGracePeriod: new(int64(0))}.EffectiveTerminationGracePeriod(),
+		"an explicit 0 is 0, never the default")
+	assert.Equal(t, int64(300), EnvironmentSpec{TerminationGracePeriod: new(int64(300))}.EffectiveTerminationGracePeriod())
+}
```

**File**: `pkg/apis/core/v1/types.go` (modified, +10/-10)
```diff
@@ -1898,21 +1898,21 @@ type (
 		// it per environment for functions with longer request timeouts.
 		//
 		// The CRD default below is what makes the documented default true for
-		// API-created Environments: the field is an int64, so before it existed
-		// an Environment created without the field got 0 — instant SIGKILL,
-		// every in-flight request on the pod dying as a connection reset.
+		// API-created Environments: nil means "use the default" and the
+		// apiserver fills an absent field with 90 at serving time.
 		//
-		// Consequence of defaulting a non-pointer field with omitempty: an
-		// explicit 0 survives ONLY via raw YAML/JSON. Every typed Go client
-		// (the CLI included) marshals 0 as absent, which the apiserver then
-		// serves as 90. Restoring 0 as a first-class typed-client value means
-		// migrating this field to *int64; until then, "instant kill" is a
-		// raw-manifest-only setting.
+		// The *pointer* is what makes an EXPLICIT 0 ("no drain window, kill
+		// instantly") expressible from typed Go clients: on the previous
+		// int64 field, omitempty marshalled 0 as absent and the apiserver
+		// served it back as 90, so raw YAML was the only way to say 0.
+		// In-process readers must use EffectiveTerminationGracePeriod()
+		// (env_validation.go), which mirrors the CRD default for objects
+		// that never crossed the apiserver.
 		// (Optional) defaults to 90 seconds
 		// +optional
 		// +kubebuilder:default=90
 		// +kubebuilder:validation:Minimum=0
-		TerminationGracePeriod int64 `json:"terminationGracePeriod,omitempty"`
+		TerminationGracePeriod *int64 `json:"terminationGracePeriod,omitempty"`
 
 		// KeepArchive is used by fetcher to determine if the extracted archive
 		// or unarchived file should be placed, which is then used by specialize handler.
```

**File**: `pkg/apis/core/v1/validation.go` (modified, +2/-2)
```diff
@@ -900,8 +900,8 @@ func (spec EnvironmentSpec) Validate() error {
 		errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "EnvironmentSpec.Poolsize", spec.Poolsize, "must be greater than or equal to 0"))
 	}
 
-	if spec.TerminationGracePeriod < 0 {
-		errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "EnvironmentSpec.TerminationGracePeriod", spec.TerminationGracePeriod, "must be greater than or equal to 0"))
+	if spec.TerminationGracePeriod != nil && *spec.TerminationGracePeriod < 0 {
+		errs = errors.Join(errs, MakeValidationErr(ErrorInvalidValue, "EnvironmentSpec.TerminationGracePeriod", *spec.TerminationGracePeriod, "must be greater than or equal to 0"))
 	}
 
 	return errs
```

**File**: `pkg/apis/core/v1/zz_generated.deepcopy.go` (modified, +5/-0)
```diff
@@ -329,6 +329,11 @@ func (in *EnvironmentSpec) DeepCopyInto(out *EnvironmentSpec) {
 	in.Runtime.DeepCopyInto(&out.Runtime)
 	in.Builder.DeepCopyInto(&out.Builder)
 	in.Resources.DeepCopyInto(&out.Resources)
+	if in.TerminationGracePeriod != nil {
+		in, out := &in.TerminationGracePeriod, &out.TerminationGracePeriod
+		*out = new(int64)
+		**out = **in
+	}
 }
 
 // DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new EnvironmentSpec.
```

**File**: `pkg/executor/executortype/newdeploy/newdeploy.go` (modified, +5/-6)
```diff
@@ -121,12 +121,11 @@ func (deploy *NewDeploy) getDeploymentSpec(ctx context.Context, fn *fv1.Function
 		replicas = *targetReplicas
 	}
 
-	// The env value is authoritative: CRD validation floors it at 0 and the
-	// CRD default fills an omitted field with 90, so there is no in-code
-	// fallback — the previous 360s one was dead (the >= 0 guard is a
-	// tautology for a floored int64) and misled readers into believing a
-	// six-minute default existed.
-	gracePeriodSeconds := env.Spec.TerminationGracePeriod
+	// Effective value: the apiserver fills an absent field with the CRD
+	// default (90); the helper mirrors that for objects that never crossed
+	// it. An explicit 0 — expressible from typed clients since the field
+	// became a pointer — means no drain window.
+	gracePeriodSeconds := env.Spec.EffectiveTerminationGracePeriod()
 
 	podAnnotations := env.Annotations
 	if podAnnotations == nil {
```

---

### Incident Patch 13: `f2ecd4e9` (2026-08-03)
**Commit Message**: upgrade gate: attributable failures + a terminationGracePeriod that actually defaults (90s) (#3651)

* feat(benchmark): make the upgrade-under-load gate attributable

The gate reports six counters and nothing else: 146 poolmgr transport
failures on main is a number with no when, no what, and no correlation
to what was rolling at the time. Every fix planned against it would be
validated by guesswork. This adds the attribution layer, observation
code only -- no product change.

- loadgen Observe now hands the caller an Observation carrying latency
  alongside status/header/error. A 30s transport failure is a client
  timeout; a 120ms one is a connection refusal -- the distinction is
  the difference between "requests hang in the cold path" and "pods
  are dropping connections", and totals cannot express it.

- upgradeRecorder timestamps every failure (bounded, 512/target, with
  a drop counter -- the TIMELINE keeps counting past the cap so totals
  never lie), buckets all outcomes into 5s cells per target, and marks
  the choreography phases. Classification is factored into ONE function
  shared with the gate counters, so the timeline can never tell a
  different story from the numbe

**File**: `.github/workflows/upgrade_test.yaml` (modified, +13/-1)
```diff
@@ -215,6 +215,7 @@ jobs:
             --namespace default --fission-namespace ${{ env.FISSION_NAMESPACE }} \
             --fission-version "${{ env.LATEST_TAG }}->HEAD (${{ matrix.upgradeFrom }})" \
             --git-sha "${{ github.sha }}" \
+            --artifact-dir "$GITHUB_WORKSPACE/upgrade-artifacts" \
             --out "$GITHUB_WORKSPACE/upgrade-results.json"
           # The benchmark CLI's failure budget records scenario errors in the
           # results instead of failing the process; an infra error or a skip
@@ -225,6 +226,15 @@ jobs:
             exit 1
           fi
 
+      # Cluster events are the cheapest failure-window correlator and expire
+      # from etcd long before anyone downloads an artifact — capture them now.
+      - name: Dump cluster events
+        if: ${{ always() && env.SKIP_LEG != '1' }}
+        run: |
+          mkdir -p upgrade-artifacts
+          kubectl get events -A --sort-by=.lastTimestamp > upgrade-artifacts/kube-events.txt || true
+          tail -n 60 upgrade-artifacts/kube-events.txt || true
+
       # The pre-upgrade hook stamps helm.sh/resource-policy=keep onto the
       # chart-generated Secrets so a later release can stop rendering them
       # without Helm pruning the live objects. Nothing else in this workflow
@@ -282,7 +292,9 @@ jobs:
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
         with:
           name: upgrade-results-${{ github.run_id }}-${{ matrix.kindversion }}-${{ matrix.upgradeFrom }}
-          path: upgrade-results.json
+          path: |
+            upgrade-results.json
+            upgrade-artifacts/**
           retention-days: 14
           # A skipped leg (SKIP_LEG=1: fewer than three published appVersions,
           # so there is no N-2 to skip-level from) never writes the file, and
```

**File**: `RELEASES.md` (modified, +12/-0)
```diff
@@ -59,6 +59,18 @@ Only hook Jobs are affected — no Deployment, Service, Secret, ConfigMap, Servi
 Set `nameFormat: legacy` to keep the previous names.
 A hook Job that failed and was never cleaned up will linger under its old name after the upgrade; it is inert, but can be deleted by hand.
 
+- **`Environment.terminationGracePeriod` defaults to `90` seconds — and now actually defaults.**
+A terminating function pod keeps serving for the whole grace window (the drain preStop hook sleeps through it), so this value is exactly how long every pod teardown takes: idle reap, environment update, upgrade, node drain.
+Two changes land together.
+First, the CRD now carries the default, closing a hole where an Environment created via the API (GitOps, Terraform, `kubectl apply`) without the field got **0** — pods were SIGKILLed instantly and every in-flight request on them died as a connection reset; only the CLI's client-side default masked this.
+Second, the default drops from 360 to 90: 90s covers endpoint propagation plus the 60s default function timeout with margin (mirroring the router's own 75s-drain/90s-grace posture), where 360 made every teardown linger six minutes per pod.
+Set `terminationGracePeriod` per environment if your functions serve requests longer than ~80s.
+This is the **Environment-level** grace only; the container executor's function-level `--graceperiod` keeps its 360s default.
+How it reaches existing objects: CRD structural defaults apply when the apiserver **serves** an object, not only at write time — so an Environment stored without the field reads back as 90 the moment the upgraded CRD is applied, with no object update.
+Practically, every such environment's pods roll **once** on the first executor reconcile after this upgrade (the pod template's grace changes 0→90); that roll is the fix taking effect.
+Only an explicit `terminationGracePeriod: 0` applied as raw YAML keeps 0 — and raw YAML is now the *only* way to express 0: the Go field's `omitempty` drops a zero before the apiserver sees it, so the CLI and any typed client cannot set it (they never could — `omitempty` predates this change — but previously the served value for an absent field was 0, so it looked like it worked).
+Making 0 first-class again for typed clients requires migrating the field to a pointer; tracked as follow-up work.
+
 ## Deprecation policy
 
 - Flags, CRD fields, chart values, and CLI commands are deprecated with **notice in one full minor release before removal**.
```

**File**: `charts/fission-all/values.yaml` (modified, +1/-1)
```diff
@@ -557,7 +557,7 @@ router:
     ## However, the drawback is it takes longer to switch to newly created function pods
     ## if using newdeploy as executor type for function. If you want to preserve the
     ## performance while keeping the short switching time to new function, you can create
-    ## an environment with short grace period by setting flag "--graceperiod" (default 360s),
+    ## an environment with short grace period by setting flag "--graceperiod" (default 90s),
     ## so that kubernetes will be able to reap old function pod quickly.
     ##
     ## For details, see https://github.com/fission/fission/issues/723
```

**File**: `crds/v1/fission.io_environments.yaml` (modified, +16/-1)
```diff
@@ -20216,9 +20216,24 @@ spec:
                     || self.container.securityContext.capabilities.add.all(c, c ==
                     ''NET_BIND_SERVICE'')'
               terminationGracePeriod:
+                default: 90
                 description: |-
                   The grace time for pod to perform connection draining before termination. The unit is in seconds.
-                  (Optional) defaults to 360 seconds
+                  A terminating function pod keeps serving for the WHOLE grace window
+                  (the preStop hook sleeps through it, then the kubelet kills the pod),
+                  so this value is exactly how long every teardown — idle reap, env
+                  update roll, upgrade, node drain — takes per pod. 90s covers endpoint
+                  propagation (seconds) plus the 60s default function timeout with
+                  margin, mirroring the router's own 75s-drain/90s-grace posture; set
+                  it per environment for functions with longer request timeouts.
+
+                  The CRD default below is what makes the documented default true for
+                  API-created Environments: the field is an int64, so before it existed
+                  an Environment created without the field got 0 — instant SIGKILL,
+                  every in-flight request on the pod dying as a connection reset. The
+                  in-code fallback cannot distinguish that 0 from an explicit one, and
+                  admission-time defaulting can.
+                  (Optional) defaults to 90 seconds
                 format: int64
                 minimum: 0
                 type: integer
```

**File**: `pkg/apis/core/v1/types.go` (modified, +22/-2)
```diff
@@ -1889,8 +1889,28 @@ type (
 		Poolsize int `json:"poolsize,omitempty"`
 
 		// The grace time for pod to perform connection draining before termination. The unit is in seconds.
-		// (Optional) defaults to 360 seconds
-		// +optional
+		// A terminating function pod keeps serving for the WHOLE grace window
+		// (the preStop hook sleeps through it, then the kubelet kills the pod),
+		// so this value is exactly how long every teardown — idle reap, env
+		// update roll, upgrade, node drain — takes per pod. 90s covers endpoint
+		// propagation (seconds) plus the 60s default function timeout with
+		// margin, mirroring the router's own 75s-drain/90s-grace posture; set
+		// it per environment for functions with longer request timeouts.
+		//
+		// The CRD default below is what makes the documented default true for
+		// API-created Environments: the field is an int64, so before it existed
+		// an Environment created without the field got 0 — instant SIGKILL,
+		// every in-flight request on the pod dying as a connection reset.
+		//
+		// Consequence of defaulting a non-pointer field with omitempty: an
+		// explicit 0 survives ONLY via raw YAML/JSON. Every typed Go client
+		// (the CLI included) marshals 0 as absent, which the apiserver then
+		// serves as 90. Restoring 0 as a first-class typed-client value means
+		// migrating this field to *int64; until then, "instant kill" is a
+		// raw-manifest-only setting.
+		// (Optional) defaults to 90 seconds
+		// +optional
+		// +kubebuilder:default=90
 		// +kubebuilder:validation:Minimum=0
 		TerminationGracePeriod int64 `json:"terminationGracePeriod,omitempty"`
 
```

**File**: `pkg/apis/core/v1/zz_generated.swagger_doc_generated.go` (modified, +383/-36)
```diff
@@ -14,6 +14,14 @@ package v1
 //
 // Those methods can be generated by using hack/update-swagger-docs.sh
 // AUTO-GENERATED FUNCTIONS START HERE
+var map_AliasTargetRecord = map[string]string{
+	"": "AliasTargetRecord is one entry in FunctionAliasStatus.History: a previously resolved target, kept for audit / rollback visibility.",
+}
+
+func (AliasTargetRecord) SwaggerDoc() map[string]string {
+	return map_AliasTargetRecord
+}
+
 var map_Archive = map[string]string{
 	"":         "Archive contains or references a collection of sources or binary files. The CEL rule below deliberately never references self.literal: any access to a byte-format field (even has()) makes the apiserver convert its base64 value for CEL using URL-safe decoding, which rejects any standard-base64 payload containing '/' or '+' — in practice every zipped literal archive. The literal/oci combination is instead rejected by the webhook (Archive.Validate), with the same message.",
 	"type":     "Type defines how the package is specified: literal, URL, or OCI. Available value:\n - literal\n - url\n - oci",
@@ -95,13 +103,24 @@ func (Checksum) SwaggerDoc() map[string]string {
 }
 
 var map_ConfigMapReference = map[string]string{
-	"": "ConfigMapReference is a reference to a kubernetes configmap.",
+	"":          "ConfigMapReference is a reference to a kubernetes configmap.",
+	"mountPath": "MountPath redirects this configmap's file projection from the default /configs/<namespace>/<name>; relative to the /configs root. See SecretReference.MountPath for the constraint rationale.",
 }
 
 func (ConfigMapReference) SwaggerDoc() map[string]string {
 	return map_ConfigMapReference
 }
 
+var map_DestinationRef = map[string]string{
+	"":         "DestinationRef routes an async invocation's result to exactly one target: a Function (invoked async through the same machinery, depth-capped) or a Topic (published to a message queue). Exactly one of Function/Topic must be set. Topic destinations on the built-in statestore provider are supported (RFC-0027); broker types are rejected by the webhook until the egress phase lands.",
+	"function": "Function is a same-namespace function destination, invoked asynchronously with the result envelope as its body (depth-capped to stop runaway chains).",
+	"topic":    "Topic publishes the result envelope to a message-queue topic.",
+}
+
+func (DestinationRef) SwaggerDoc() map[string]string {
+	return map_DestinationRef
+}
+
 var map_Environment = map[string]string{
 	"": "Environment is environment for building and running user functions.",
 }
@@ -136,7 +155,7 @@ var map_EnvironmentSpec = map[string]string{
 	"allowAccessToExternalNetwork": "Istio default blocks all egress traffic for safety. To enable accessibility of external network for builder/function pod, set to 'true'. (Optional) defaults to 'false'",
 	"resources":                    "The request and limit CPU/MEM resource setting for poolmanager to set up pods in the pre-warm pool. (Optional) defaults to no limitation.",
 	"poolsize":                     "The initial pool size for environment",
-	"terminationGracePeriod":       "The grace time for pod to perform connection draining before termination. The unit is in seconds. (Optional) defaults to 360 seconds",
+	"terminationGracePeriod":       "The grace time for pod to perform connection draining before termination. The unit is in seconds. A terminating function pod keeps serving for the WHOLE grace window (the preStop hook sleeps through it, then the kubelet kills the pod), so this value is exactly how long every teardown — idle reap, env update roll, upgrade, node drain — takes per pod. 90s covers endpoint propagation (seconds) plus the 60s default function timeout with margin, mirroring the router's own 75s-drain/90s-grace posture; set it per environment for functions with longer request timeouts.\n\nThe CRD default below is what makes the documented default true for API-created Environments: the field is an int64, so before it existed an Environment created without the field got 0 — instant SIGKILL, every in-flight request on the pod dying as a connection reset.\n\nConsequence of defaulting a non-pointer field with omitempty: an explicit 0 survives ONLY via raw YAML/JSON. Every typed Go client (the CLI included) marshals 0 as absent, which the apiserver then serves as 90. Restoring 0 as a first-class typed-client value means migrating this field to *int64; until then, \"instant kill\" is a raw-manifest-only setting. (Optional) defaults to 90 seconds",
 	"keeparchive":                  "KeepArchive is used by fetcher to determine if the extracted archive or unarchived file should be placed, which is then used by specialize handler. (This is mainly for the JVM environment because .jar is one kind of zip archive.)",
 	"imagepullsecret":              "ImagePullSecret is the secret for Kubernetes to pull an image from a private registry.",
 }
@@ -213,6 +232,44 @@ func (Function) SwaggerDoc() map[string]string 
```

**File**: `pkg/executor/executortype/newdeploy/newdeploy.go` (modified, +6/-4)
```diff
@@ -121,10 +121,12 @@ func (deploy *NewDeploy) getDeploymentSpec(ctx context.Context, fn *fv1.Function
 		replicas = *targetReplicas
 	}
 
-	gracePeriodSeconds := int64(6 * 60)
-	if env.Spec.TerminationGracePeriod >= 0 {
-		gracePeriodSeconds = env.Spec.TerminationGracePeriod
-	}
+	// The env value is authoritative: CRD validation floors it at 0 and the
+	// CRD default fills an omitted field with 90, so there is no in-code
+	// fallback — the previous 360s one was dead (the >= 0 guard is a
+	// tautology for a floored int64) and misled readers into believing a
+	// six-minute default existed.
+	gracePeriodSeconds := env.Spec.TerminationGracePeriod
 
 	podAnnotations := env.Annotations
 	if podAnnotations == nil {
```

**File**: `pkg/executor/executortype/poolmgr/gp_deployment.go` (modified, +6/-4)
```diff
@@ -70,10 +70,12 @@ func (gp *GenericPool) genDeploymentSpec(env *fv1.Environment) (*appsv1.Deployme
 	deployLabels := gp.getEnvironmentPoolLabels(env)
 	// Use long terminationGracePeriodSeconds for connection draining in case that
 	// pod still runs user functions.
-	gracePeriodSeconds := int64(6 * 60)
-	if env.Spec.TerminationGracePeriod >= 0 {
-		gracePeriodSeconds = env.Spec.TerminationGracePeriod
-	}
+	// The env value is authoritative: CRD validation floors it at 0 and the
+	// CRD default fills an omitted field with 90, so there is no in-code
+	// fallback — the previous 360s one was dead (the >= 0 guard is a
+	// tautology for a floored int64) and misled readers into believing a
+	// six-minute default existed.
+	gracePeriodSeconds := env.Spec.TerminationGracePeriod
 
 	podAnnotations := env.Annotations
 	if podAnnotations == nil {
```

---

### Incident Patch 14: `f367a699` (2026-08-03)
**Commit Message**: RFC-0028/0029 wave: auth-material provisioning, name inventory, spec-apply idempotency, CI flake fixes (#3649)

* test(chart): pin NetworkPolicy svc selectors to real workloads

The fixed-name inventory RFC-0029 phase 2 asks for, made executable rather than
written down.

NetworkPolicies address workloads by a bare `svc:` pod label — a string that no
template or Go constant forces to agree with the labels the Deployments carry.
A rename, which is exactly what phase 2 does, can orphan an allowlist entry,
and the failure is silent: traffic is dropped rather than rejected and surfaces
far away as `dial tcp <ip>:8889: i/o timeout` in an unrelated integration test.
This repo has paid for that debugging more than once.

Every `svc:` value referenced by a policy — its own podSelector and every
ingress from-selector — must be carried by some rendered pod template. Renaming
statesvc's pod label fails it with the two policies that would silently drop
that traffic.

The render enables every optional component (canaryDeployment, workflows and
its statestore prerequisite, functionState, mcp) on purpose: the allowlist
legitimately names workloads that only exist behind a flag, so a default rende

**File**: `.github/workflows/upgrade_test.yaml` (modified, +5/-0)
```diff
@@ -284,6 +284,11 @@ jobs:
           name: upgrade-results-${{ github.run_id }}-${{ matrix.kindversion }}-${{ matrix.upgradeFrom }}
           path: upgrade-results.json
           retention-days: 14
+          # A skipped leg (SKIP_LEG=1: fewer than three published appVersions,
+          # so there is no N-2 to skip-level from) never writes the file, and
+          # this step still runs under always(). Default `warn` would print a
+          # red herring on every such run; the leg is meant to skip cleanly.
+          if-no-files-found: ignore
 
       - name: Kind export logs
         if: ${{ always() }}
```

**File**: `charts/fission-all/templates/_helpers.tpl` (modified, +86/-5)
```diff
@@ -199,6 +199,41 @@ it). Disabled by default → behaviour is unchanged for single-replica installs.
       fieldPath: metadata.name
 {{- end }}
 
+{{/*
+fission.internalAuthSecretName is the Secret holding the internal-auth HMAC
+master: the operator's pre-created one when internalAuth.existingSecret is set,
+otherwise the chart-generated "fission-internal-auth".
+
+Every consumer must go through this. The Go side resolves the same name from
+FISSION_INTERNAL_AUTH_SECRET_NAME (fv1.InternalAuthSecretName), and a
+disagreement between the two does not fail loudly — the secretKeyRef is
+optional, so pods start with the env var absent and every archive fetch and
+builder upload 401s with nothing naming the Secret as the cause.
+*/}}
+{{- define "fission.internalAuthSecretName" -}}
+{{- default "fission-internal-auth" .Values.internalAuth.existingSecret -}}
+{{- end -}}
+
+{{/*
+fission.internalAuthGenerateInCluster is non-empty when the pre-upgrade hook,
+not the template, mints the master.
+
+Exactly one of them may provision it, and this is the ONLY place that decides
+which. Three templates gate on this answer — the Secret itself, the hook's
+GENERATE_AUTH_SECRET env, and the hook's RBAC — and open-coding the condition
+in each is how they drift apart. Both drift directions fail silently: both
+provisioning means two masters race and half the derived keys are wrong;
+neither means no master at all and every internal call is unsigned.
+
+The whitespace trimming is load-bearing. A stray newline would make the
+`include` non-empty, so the helper would read as true in every case.
+*/}}
+{{- define "fission.internalAuthGenerateInCluster" -}}
+{{- if and .Values.internalAuth.enabled .Values.internalAuth.autoGenerate (not .Values.internalAuth.existingSecret) (not .Values.internalAuth.secret) -}}
+true
+{{- end -}}
+{{- end -}}
+
 {{/*
 internalAuth.envs renders the two env entries that wire the HMAC shared
 secret into a Fission control-plane container. See the design at docs/internal-auth/00-design.md. The OLD
@@ -210,14 +245,18 @@ forcing the chart to render an empty key.
 - name: FISSION_INTERNAL_AUTH_SECRET
   valueFrom:
     secretKeyRef:
-      name: fission-internal-auth
+      name: {{ include "fission.internalAuthSecretName" . }}
       key: secret
 - name: FISSION_INTERNAL_AUTH_SECRET_OLD
   valueFrom:
     secretKeyRef:
-      name: fission-internal-auth
+      name: {{ include "fission.internalAuthSecretName" . }}
       key: oldSecret
       optional: true
+# The Go side (fetcher pod-spec builder, storagesvc client) resolves the same
+# name from this env var; see fv1.InternalAuthSecretName.
+- name: FISSION_INTERNAL_AUTH_SECRET_NAME
+  value: {{ include "fission.internalAuthSecretName" . | quote }}
 {{- end }}
 {{- end }}
 
@@ -414,15 +453,57 @@ the pre-upgrade hook stamps helm.sh/resource-policy=keep onto, so that moving
 their generation out of the templating layer does not prune the live object on
 the next upgrade (RFC-0029 §3; mechanism verified on Helm v4.2.3).
 
-Only Secrets the chart itself may have created belong here — never one supplied
-via an existingSecret value, which the operator owns and Helm never manages.
+What belongs here is decided by ONE question: could Helm prune this object?
+Not "who owns it" — that reading is what the internalAuth entry below had to
+stop using, and the two entries genuinely differ:
+
+  - internal-auth-secret.yaml and webhook-server/cert.yaml carry NO
+    helm.sh/hook annotation, so they are ordinary release-manifest resources
+    and Helm prunes them the moment a template stops rendering them. They need
+    retention whether or not an existingSecret is set.
+  - router/secret.yaml IS a hook resource ("helm.sh/hook": pre-install,
+    pre-upgrade), so it lives outside Helm's deletion set and is never pruned.
+    Its existingSecret guard below is therefore correct and must stay.
+
+That asymmetry looks like an oversight and is not. Do not "fix" it by making
+the two branches match.
+
 Empty when nothing needs adopting, which makes the whole migration render away.
 */}}
 {{- define "fission.adoptSecretNames" -}}
 {{- $names := list -}}
-{{- if and .Values.internalAuth.enabled (not .Values.internalAuth.existingSecret) -}}
+{{- /*
+The CHART-GENERATED name, unconditionally — deliberately not the resolved one.
+
+Retention has to cover the object Helm previously managed, and setting
+existingSecret is exactly what removes that object from the rendered manifest.
+The obvious-looking `(not .Values.internalAuth.existingSecret)` guard here
+destroys the master in the most natural adoption there is: an operator with a
+chart-generated master who sets `existingSecret: fission-internal-auth` to take
+ownership of it. The template stops rendering it, nothing stamps keep, and Helm
+prunes a Secret that is still in use — every control-plane pod wedges on next
+restart and function pods run unsigned.
+
+Naming a Secret that does not exist is free (the hook logs "no li
```

**File**: `charts/fission-all/templates/internal-auth-secret.yaml` (modified, +18/-2)
```diff
@@ -1,4 +1,20 @@
-{{- if .Values.internalAuth.enabled }}
+{{- /*
+existingSecret hands the master to the operator: the chart renders NOTHING and
+every consumer reads the named Secret instead. This is the supported path for
+GitOps renderers, where `lookup` returns empty under `helm template` and the
+preservation below cannot work, so a generated value would be re-minted on
+every sync and break every pod signed with the previous one.
+
+Upgrading an existing install into this mode is safe ONLY because the
+pre-upgrade retention hook stamps helm.sh/resource-policy=keep on the live
+Secret before Helm computes its deletion set. Without that, Helm would prune
+the master it is no longer rendering and wedge every control-plane pod in
+CreateContainerConfigError.
+*/ -}}
+{{- /* autoGenerate hands generation to the pre-upgrade hook, so the template
+       must stop rendering the Secret — the retention hook keeps the live value
+       from being pruned when it does. */ -}}
+{{- if and .Values.internalAuth.enabled (not .Values.internalAuth.existingSecret) (not (include "fission.internalAuthGenerateInCluster" .)) }}
 {{- /*
 fission-internal-auth holds the shared HMAC secret used by Fission's
 internal application-layer auth (the design at docs/internal-auth/00-design.md).
@@ -61,7 +77,7 @@ rotation window) and re-run helm upgrade.
 apiVersion: v1
 kind: Secret
 metadata:
-  name: fission-internal-auth
+  name: {{ include "fission.internalAuthSecretName" $ }}
   namespace: {{ $ns }}
   labels:
     chart: "{{ $.Chart.Name }}-{{ $.Chart.Version }}"
```

**File**: `charts/fission-all/templates/pre-upgrade-checks/pre-upgrade-job.yaml` (modified, +16/-0)
```diff
@@ -6,6 +6,16 @@ schemas at all.
 {{- if and (eq (include "fission.crdsMode" .) "hook") (not .Values.preUpgradeChecks.enabled) }}
 {{- fail "crds.mode=hook delivers the CRDs through the pre-upgrade-checks Job, so preUpgradeChecks.enabled must be true (or set crds.mode=none)" }}
 {{- end }}
+{{- /*
+Same shape, same reason: internalAuth.autoGenerate moves master provisioning
+from the template into THIS Job, so the template renders no Secret. With the
+Job switched off, nothing provisions it at all and every control-plane pod
+wedges in CreateContainerConfigError on a required secretKeyRef — a whole
+install that comes up dead, from two values that each look reasonable alone.
+*/}}
+{{- if and (include "fission.internalAuthGenerateInCluster" .) (not .Values.preUpgradeChecks.enabled) }}
+{{- fail "internalAuth.autoGenerate provisions the master through the pre-upgrade-checks Job, so preUpgradeChecks.enabled must be true (or set internalAuth.secret / internalAuth.existingSecret instead)" }}
+{{- end }}
 {{- if .Values.preUpgradeChecks.enabled }}
 apiVersion: batch/v1
 kind: Job
@@ -47,6 +57,12 @@ spec:
         - name: ADOPT_SECRET_NAMESPACES
           value: {{ include "fission.adoptSecretNamespaces" $ | quote }}
         {{- end }}
+{{- if include "fission.internalAuthGenerateInCluster" . }}
+        - name: GENERATE_AUTH_SECRET
+          value: {{ include "fission.internalAuthSecretName" . | quote }}
+        - name: GENERATE_AUTH_SECRET_NAMESPACES
+          value: {{ include "fission.adoptSecretNamespaces" . | quote }}
+{{- end }}
         {{- include "fission.podNamespaceEnv" . | nindent 8 }}
         - name: CRDS_MODE
           value: {{ include "fission.crdsMode" . | quote }}
```

**File**: `charts/fission-all/templates/pre-upgrade-checks/role-fission-cr.yaml` (modified, +108/-1)
```diff
@@ -11,14 +11,23 @@ annotates chart-generated Secrets with helm.sh/resource-policy=keep before Helm
 computes its deletion set, so a template can stop rendering them without the
 live object being pruned.
 
-PATCH ONLY, fenced by resourceNames to exactly the Secrets the chart generates.
+PATCH ONLY, fenced by resourceNames to the exact Secret NAMES the chart uses.
 resourceNames does restrict get and patch (both name the object in the request
 path), and deliberately no `get`: the merge patch is idempotent, so the hook
 never needs to read, and these are the highest-value Secrets in the namespace —
 a grant that cannot read the HMAC master, the JWT signing key or the webhook TLS
 key is worth far more than one that can. No list (which would let this identity
 enumerate every Secret), no create, no delete.
 
+"NAMES the chart uses", not "Secrets the chart generates" — the distinction is
+real. fission.adoptSecretNames names the internal-auth Secret unconditionally,
+because retention has to cover whatever Helm could prune, so with
+`internalAuth.existingSecret: fission-internal-auth` this grants patch on an
+object the OPERATOR owns. That is intended: it is the only way to stop Helm
+deleting it. Note the grant is `patch`, which is full .data mutation even
+though the hook writes one annotation — accepted knowingly, and bounded by the
+ServiceAccount being torn down with the hook.
+
 Rendered once per namespace the master is replicated into, and only when the
 Job that uses it actually renders — a standing Secret grant bound to a
 ServiceAccount that runs nothing is pointless, and worse, an operator with
@@ -64,3 +73,101 @@ roleRef:
   apiGroup: rbac.authorization.k8s.io
 {{- end }}
 {{- end }}
+
+{{- /*
+Generation grant (see cmd/preupgradechecks/generateauth.go), SEPARATE from the
+adoption grant above on purpose.
+
+Adoption is patch-only and deliberately cannot read: a grant that cannot read
+the HMAC master, the JWT signing key or the webhook TLS key is worth far more
+than one that can. Generation genuinely needs `get` — it must tell "already
+provisioned" from "absent", and without that a re-run would mint a new master
+and rotate every derived key with no dual-accept window. Widening the adoption
+Role would have handed that read over all three Secrets; a separate Role fenced
+to the master ALONE confines it to the one object that needs it.
+
+Rendered only when the chart is actually generating, and only in the namespaces
+the master is replicated into — under dynamic/cluster tenancy the release
+namespace alone, because tenant namespaces receive controller-owned derived keys
+and the master must never land there.
+*/}}
+{{- if and .Values.preUpgradeChecks.enabled (include "fission.internalAuthGenerateInCluster" .) }}
+{{- range $ns := splitList " " (include "fission.adoptSecretNamespaces" $) }}
+---
+apiVersion: rbac.authorization.k8s.io/v1
+kind: Role
+metadata:
+  name: "{{ $.Release.Name }}-preupgrade-authgen"
+  namespace: {{ $ns }}
+  annotations:
+    helm.sh/hook: pre-install,pre-upgrade
+    helm.sh/hook-delete-policy: hook-succeeded,hook-failed,before-hook-creation
+    helm.sh/hook-weight: "-2"
+rules:
+# get IS name-scoped: a GET carries the name in the request path, so the
+# authorizer matches it against resourceNames and this read reaches the
+# master and nothing else.
+- apiGroups: [""]
+  resources: ["secrets"]
+  verbs: ["get"]
+  resourceNames:
+  - {{ include "fission.internalAuthSecretName" $ }}
+# create CANNOT be name-scoped, and pairing it with resourceNames does not
+# tighten the grant — it voids it. A POST carries the object name in the
+# BODY, not the path, so the authorizer sees an empty name, a
+# resourceNames-fenced rule never matches, and generation fails Forbidden.
+# The grant would be inert and the feature dead on arrival.
+#
+# This is the exact inverse of the CRD ClusterRole next door, which DOES
+# keep its resourceNames scope on create: server-side apply PATCHes a
+# named path, so the create authorization it additionally needs is
+# evaluated against that name. createIfAbsent uses a plain Create, not an
+# apply, deliberately — apply would take ownership of .data and rotate the
+# master, which is the one thing this hook must never do.
+#
+# So the residual grant is "create A Secret in this namespace". It cannot
+# patch or delete an existing one, and create fails AlreadyExists rather than
+# overwriting the master.
+#
+# Do NOT read that as harmless, and note it is the floor plain RBAC reaches,
+# not the floor the cluster can enforce. Two things sharpen it:
+#
+#   - It composes with the fenced `get` above. On a fresh install an actor
+#     with execution in the hook pod can create <master-name> as a
+#     kubernetes.io/service-account-token Secret annotated for any
+#     ServiceAccount in the namespace, let the token controller populate it,
+#     then read the token back through that `get`. Neither verb is a
+#     token-read primitive alone; together
```

**File**: `charts/fission-all/values.yaml` (modified, +41/-0)
```diff
@@ -1628,4 +1628,45 @@ internalAuth:
   enabled: true
   # secret: "" — auto-generated on first install; preserved on upgrade.
   # oldSecret: "" — set during rotation; accepted by the verifier alongside `secret`.
+  ## autoGenerate moves master generation OUT of the chart template and into
+  ## the pre-install/pre-upgrade hook, which creates it only if absent.
+  ##
+  ## Why: the template preserves a generated value across upgrades with
+  ## `lookup`, and `lookup` returns EMPTY under `helm template`. A GitOps
+  ## renderer therefore re-mints the master on every sync, breaking every pod
+  ## signed with the previous one. An in-cluster create-if-absent survives any
+  ## renderer. Prefer existingSecret if you would rather own the value.
+  ##
+  ## Default false, so existing installs are untouched.
+  ##
+  ## The hook writes the master into the same namespaces the template would
+  ## have: under static tenancy the release namespace plus defaultNamespace
+  ## plus each additionalFissionNamespaces; under dynamic/cluster tenancy the
+  ## release namespace ONLY, since tenant namespaces get controller-owned
+  ## derived keys and the master must never land there.
+  ##
+  autoGenerate: false
+  ## existingSecret names a Secret you create yourself, holding key `secret`
+  ## (and optionally `oldSecret`). When set the chart renders NO master Secret
+  ## and every component reads yours instead.
+  ##
+  ## Recommended for GitOps renderers (Argo CD, Flux). Those run `helm
+  ## template`, where the chart's `lookup`-based preservation of a generated
+  ## value cannot work — so a generated master would be re-minted on every
+  ## sync, breaking every pod signed with the previous one.
+  ##
+  ## YOU MUST CREATE IT IN EVERY NAMESPACE FISSION RUNS PODS IN — the release
+  ## namespace plus defaultNamespace plus each additionalFissionNamespaces.
+  ## kubelet cannot resolve a cross-namespace secretKeyRef, so a single copy in
+  ## the release namespace leaves builder and function pods without the key:
+  ## the mount is optional, so those pods START and then 401 on every archive
+  ## fetch and builder upload. (Under dynamic/cluster tenancy only the release
+  ## namespace is needed; tenant namespaces get controller-owned derived keys.)
+  ##
+  ## Switching an existing install to this is safe: the pre-upgrade retention
+  ## hook stamps helm.sh/resource-policy=keep on the chart-generated Secret
+  ## before Helm computes its deletion set, so the value it stops rendering is
+  ## not pruned.
+  ##
+  existingSecret: ""
 
```

**File**: `cmd/preupgradechecks/generateauth.go` (added, +228/-0)
```diff
@@ -0,0 +1,228 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package main
+
+import (
+	"bytes"
+	"context"
+	"crypto/rand"
+	"encoding/base64"
+	"fmt"
+
+	"github.com/go-logr/logr"
+	apiv1 "k8s.io/api/core/v1"
+	k8serrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/kubernetes"
+)
+
+const (
+	// authSecretKey is the data key holding the HMAC master.
+	authSecretKey = "secret"
+	// authMasterBytes is the generated master's length before base64. 32 bytes
+	// matches what the chart's randAlphaNum 32 produced. Note the signer
+	// itself enforces no minimum — it only rejects a zero-length master
+	// (pkg/auth/hmac/keys.go) — so this length is the guarantee, not a floor
+	// something downstream would catch.
+	authMasterBytes = 32
+
+	// provisionAttempts bounds the adopt-the-winner retry; a third round means
+	// two runs each won a different namespace, which no value can reconcile.
+	provisionAttempts = 3
+)
+
+// GenerateAuthSecret creates the internal-auth master where it is missing,
+// using ONE value across every namespace it writes.
+//
+// Why this exists (RFC-0029 §10): the chart generated the master in the
+// templating layer, preserved across upgrades by `lookup`. Under a GitOps
+// renderer `lookup` returns empty — Argo and Flux run `helm template` — so the
+// value was re-minted on every sync, breaking every pod signed with the
+// previous one. Generation has to be an idempotent in-cluster action instead.
+//
+// The namespace set is supplied by the caller, NOT derived here, and that is
+// deliberate: it is tenancy-dependent, and the chart already computes it in one
+// place (fission.adoptSecretNamespaces). Under STATIC tenancy the master is
+// replicated into the release namespace plus defaultNamespace plus each
+// additionalFissionNamespaces, because kubelet cannot resolve a cross-namespace
+// secretKeyRef. Under DYNAMIC or CLUSTER tenancy it goes to the release
+// namespace ONLY — tenant namespaces receive controller-owned derived keys and
+// the master must never land there, which is the whole isolation end state.
+// Duplicating that rule in Go would be a second source of truth for a
+// security-relevant decision.
+//
+// Idempotent by construction, which matters because this runs on every install
+// AND every upgrade: an existing master anywhere in the set is reused rather
+// than regenerated, and a namespace that already has it is left untouched. A
+// regenerated master would rotate every derived key with no dual-accept window.
+func GenerateAuthSecret(ctx context.Context, client kubernetes.Interface, logger logr.Logger, namespaces []string, secretName string) error {
+	if len(namespaces) == 0 || secretName == "" {
+		return nil
+	}
+
+	// Retry, because a create that loses to a concurrent hook Job does not mean
+	// this run's master is the right one — it means someone else's is. Re-read
+	// and adopt the winner rather than carrying our own value into the
+	// remaining namespaces, which is how the set would diverge permanently.
+	for attempt := range provisionAttempts {
+		// Reuse an existing value if there is one. Reading the master is what
+		// the `get` grant on this single name is for: without it a second run
+		// could not tell "already provisioned" from "absent" and would mint a
+		// new master, which is strictly worse than the read.
+		master, found, err := existingMaster(ctx, client, namespaces, secretName)
+		if err != nil {
+			return err
+		}
+		if !found {
+			master, err = newMaster()
+			if err != nil {
+				return err
+			}
+			logger.Info("generating internal-auth master", "secret", secretName)
+		}
+
+		lost, err := writeMaster(ctx, client, logger, namespaces, secretName, master)
+		if err != nil {
+			return err
+		}
+		if !lost {
+			return nil
+		}
+		logger.Info("lost a create to a concurrent run; re-reading the winning master",
+			"secret", secretName, "attempt", attempt+1)
+	}
+	// Two runs each won a different namespace. There is no value that makes the
+	// set consistent, and guessing would leave half the derived keys wrong with
+	// no error anywhere, so stop and say so.
+	return fmt.Errorf("internal-auth master %q still disagrees across namespaces after %d attempts; "+
+		"delete the inconsistent copies and re-run", secretName, provisionAttempts)
+}
+
+// writeMaster provisions master into every namespace, reporting whether any
+// namespace already held a DIFFERENT one (in which case the caller must adopt
+// the winner and try again).
+func writeMaster(ctx context.Context, client kubernetes.Interface, logger logr.Logger, namespaces []string, secretName string, master []byte) (bool, error) {
+	for _, ns := range namespaces {
+		if ns == "" {
+			continue
+		}
+		created, agreed, err := createIfAbsent(ctx, client, ns, secretName, master)
+		if err != nil {
+			return false, err
+		}
+		if !agreed {
+			return true, nil
+		}
+		i
```

**File**: `cmd/preupgradechecks/generateauth_test.go` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package main
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	apiv1 "k8s.io/api/core/v1"
+	k8serrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
+
+	"github.com/fission/fission/pkg/utils/loggerfactory"
+)
+
+const testAuthSecret = "fission-internal-auth"
+
+func masterIn(t *testing.T, cs kubernetes.Interface, ns string) []byte {
+	t.Helper()
+	s, err := cs.CoreV1().Secrets(ns).Get(t.Context(), testAuthSecret, metav1.GetOptions{})
+	require.NoErrorf(t, err, "expected the master in %q", ns)
+	return s.Data[authSecretKey]
+}
+
+func TestGenerateAuthSecret(t *testing.T) {
+	t.Parallel()
+	logger := loggerfactory.GetLogger()
+
+	// STATIC tenancy: the master is replicated because kubelet cannot resolve a
+	// cross-namespace secretKeyRef, so builder and function pods in
+	// defaultNamespace need a local copy. Every copy must hold the SAME value —
+	// they are one HMAC master, not three.
+	t.Run("static tenancy: one value across every namespace", func(t *testing.T) {
+		t.Parallel()
+		cs := fake.NewClientset()
+		nss := []string{"fission", "default", "fission-fn"}
+		require.NoError(t, GenerateAuthSecret(t.Context(), cs, logger, nss, testAuthSecret))
+
+		want := masterIn(t, cs, "fission")
+		assert.NotEmpty(t, want)
+		for _, ns := range nss[1:] {
+			assert.Equalf(t, want, masterIn(t, cs, ns),
+				"every namespace must carry the same master; %q differs", ns)
+		}
+	})
+
+	// DYNAMIC/CLUSTER tenancy: the chart passes ONLY the release namespace,
+	// because tenant namespaces get controller-owned derived keys and the
+	// master must never land there. This asserts the hook writes exactly what
+	// it is given and invents no fan-out of its own.
+	t.Run("dynamic tenancy: the master reaches only the namespace it was given", func(t *testing.T) {
+		t.Parallel()
+		cs := fake.NewClientset()
+		require.NoError(t, GenerateAuthSecret(t.Context(), cs, logger, []string{"fission"}, testAuthSecret))
+
+		assert.NotEmpty(t, masterIn(t, cs, "fission"))
+		for _, tenant := range []string{"default", "tenant-a"} {
+			_, err := cs.CoreV1().Secrets(tenant).Get(t.Context(), testAuthSecret, metav1.GetOptions{})
+			assert.Errorf(t, err, "the master must NOT appear in %q under dynamic tenancy", tenant)
+		}
+	})
+
+	// The hook runs on every install AND every upgrade. Regenerating would
+	// rotate every derived key with no dual-accept window, so a second run must
+	// change nothing.
+	t.Run("re-running preserves the existing master", func(t *testing.T) {
+		t.Parallel()
+		cs := fake.NewClientset()
+		nss := []string{"fission", "default"}
+		require.NoError(t, GenerateAuthSecret(t.Context(), cs, logger, nss, testAuthSecret))
+		first := masterIn(t, cs, "fission")
+
+		for range 3 {
+			require.NoError(t, GenerateAuthSecret(t.Context(), cs, logger, nss, testAuthSecret))
+		}
+		assert.Equal(t, first, masterIn(t, cs, "fission"),
+			"re-running must not re-mint the master: that rotates every derived key with no dual-accept window")
+		assert.Equal(t, first, masterIn(t, cs, "default"))
+	})
+
+	// Upgrade path: an install predating this hook already has the master in
+	// the release namespace. Adding a namespace must copy THAT value, not a new
+	// one, or the new namespace's pods sign with a key nobody verifies.
+	t.Run("an existing master is reused when filling a new namespace", func(t *testing.T) {
+		t.Parallel()
+		existing := []byte("already-provisioned-master-value")
+		cs := fake.NewClientset(&apiv1.Secret{
+			ObjectMeta: metav1.ObjectMeta{Name: testAuthSecret, Namespace: "fission"},
+			Data:       map[string][]byte{authSecretKey: existing},
+		})
+		require.NoError(t, GenerateAuthSecret(t.Context(), cs, logger, []string{"fission", "default"}, testAuthSecret))
+
+		assert.Equal(t, existing, masterIn(t, cs, "fission"), "the pre-existing master must be left alone")
+		assert.Equal(t, existing, masterIn(t, cs, "default"), "the new copy must carry the SAME value, not a fresh one")
+	})
+
+	// A copy that exists only outside the release namespace is still the
+	// install's master; ignoring it would mint a second one.
+	t.Run("a master found in a later namespace is reused", func(t *testing.T) {
+		t.Parallel()
+		existing := []byte("master-living-in-default")
+		cs := fake.NewClientset(&apiv1.Secret{
+			ObjectMeta: metav1.ObjectMeta{Name: testAuthSecret, Namespace: "default"},
+			Data:       map[string][]byte{authSecretKey: existing},
+		})
+		require.NoError(t, GenerateAuthSecret(t.Context(), cs, logger, []string{"fission", "default"}, testAuthSecret))
+		assert.Equal(t, existing, masterIn(t, cs, "fission"))
+	})
+
+	t.Run("no na
```

---

### Incident Patch 15: `5cbaffdf` (2026-08-02)
**Commit Message**: RFC-0028 phase 3: roll drifted builders (#776) + skew reporting (#3637)

* fix(buildermgr): roll the builder when its spec drifts without an env change

Closes the half of #776 the Environment ResourceVersion cannot cover. Most of
what a builder pod is made of comes from the chart, not the CR — the fetcher
image, the builder image-pull policy, the pod-spec patch. None of those touch
the Environment, so its ResourceVersion is unchanged, the RV-keyed name and
selector still match, and ensureBuilder found a Deployment and did nothing. The
builder went on running the previous image until someone deleted the Deployment
by hand. Deleting the POD did not help: the ReplicaSet recreated it from the
same stale template.

The reconciler now stamps a hash of the pod template it applied and compares it
on every pass, updating in place when they differ and letting Kubernetes roll
the pods. In place, not recreated: the Deployment is named <env>-<rv>, which
buildPackage resolves as a DNS hostname.

Hashing OUR desired object rather than diffing the live PodSpec is the load-
bearing choice. The apiserver defaults dozens of fields on write, so a
live-vs-desired comparison is never equal and would re

**File**: `.gitignore` (modified, +7/-0)
```diff
@@ -51,6 +51,13 @@ output.sarif
 *.sarif
 /fission-bundle
 
+# Stray binaries from `go build ./cmd/<name>` with no -o: Go writes the binary
+# into the working directory, which is the repo root. Each is ~90MB.
+/preupgradechecks
+/fetcher
+/builder
+/reporter
+
 # Stray archive-download artifacts from e2e CLI test runs (UUID-named files
 # written to the test's working directory by `fission archive download`).
 test/e2e/cli/????????-????-????-????-????????????
```

**File**: `charts/fission-all/templates/_fission-kubernetes-roles.tpl` (modified, +5/-0)
```diff
@@ -65,6 +65,11 @@ rules:
   verbs:
   - list
   - create
+  # update: the reconciler rolls a builder Deployment whose pod template has
+  # drifted from the chart (RFC-0028 phase 3, #776). Without this verb the
+  # drift is detected and the update is denied, so the builder silently keeps
+  # running the stale image — the exact symptom the feature removes.
+  - update
   - delete
 - apiGroups:
   - apiextensions.k8s.io
```

**File**: `pkg/buildermgr/environment_reconciler.go` (modified, +144/-4)
```diff
@@ -6,9 +6,13 @@ package buildermgr
 
 import (
 	"context"
+	"crypto/sha256"
+	"encoding/json"
 	"fmt"
 	"os"
+	"slices"
 	"strconv"
+	"strings"
 
 	"github.com/go-logr/logr"
 	appsv1 "k8s.io/api/apps/v1"
@@ -34,6 +38,11 @@ const (
 	LABEL_ENV_RESOURCEVERSION = "envResourceVersion"
 	LABEL_DEPLOYMENT_OWNER    = "owner"
 	BUILDER_MGR               = "buildermgr"
+
+	// builderSpecHashAnnotation carries a hash of the builder pod template the
+	// reconciler last applied, so drift that does NOT bump the Environment's
+	// ResourceVersion is still detectable (RFC-0028 phase 3, issue #776).
+	builderSpecHashAnnotation = "fission.io/builder-spec-hash"
 )
 
 var (
@@ -187,13 +196,67 @@ func (r *EnvironmentReconciler) ensureBuilder(ctx context.Context, env *fv1.Envi
 			return fmt.Errorf("error creating builder deployment for environment %s in namespace %s: %w", env.Name, ns, err)
 		}
 	case 1:
-		// already present
+		if err := r.reconcileBuilderDeployment(ctx, env, ns, &deployList[0]); err != nil {
+			return fmt.Errorf("error reconciling builder deployment for environment %s in namespace %s: %w", env.Name, ns, err)
+		}
 	default:
 		return fmt.Errorf("found more than one builder deployment for environment %s in namespace %s", env.Name, ns)
 	}
 	return nil
 }
 
+// reconcileBuilderDeployment rolls an existing builder Deployment whose pod
+// template no longer matches what this reconciler would create.
+//
+// The Environment's ResourceVersion is NOT a sufficient trigger (issue #776).
+// Everything the builder pod is made of that comes from the chart rather than
+// the CR — the fetcher image, the builder image-pull policy, the pod-spec patch
+// — changes without the Environment being touched at all. The RV-keyed
+// name/selector stays identical, so the old code found a matching Deployment
+// and did nothing, and the builder kept running the previous image until
+// someone deleted the Deployment by hand. Deleting the POD does not help
+// either: the ReplicaSet just recreates it from the same stale template.
+//
+// The Deployment is updated in place rather than recreated: its name is
+// <env>-<rv>, which buildPackage resolves as a DNS hostname, so renaming or
+// recreating per-generation would break in-flight builds.
+func (r *EnvironmentReconciler) reconcileBuilderDeployment(ctx context.Context, env *fv1.Environment, ns string, live *appsv1.Deployment) error {
+	desired, err := r.genBuilderDeployment(env, ns)
+	if err != nil {
+		return err
+	}
+	want := desired.Annotations[builderSpecHashAnnotation]
+	if live.Annotations[builderSpecHashAnnotation] == want {
+		return nil
+	}
+
+	// Carry the live object's identity so this is an update, not a create, and
+	// so we do not clobber annotations set by anything else.
+	updated := live.DeepCopy()
+	updated.Spec = desired.Spec
+	updated.Labels = desired.Labels
+	// Selector is immutable on a Deployment: sending a different one makes the
+	// apiserver reject the whole update. It is derived from the same
+	// name/namespace/RV as the live object's, so it cannot legitimately differ
+	// — keep the live value rather than betting the update on that staying true.
+	updated.Spec.Selector = live.Spec.Selector
+	if updated.Annotations == nil {
+		updated.Annotations = map[string]string{}
+	}
+	updated.Annotations[builderSpecHashAnnotation] = want
+
+	if _, err := r.kubernetesClient.AppsV1().Deployments(ns).Update(ctx, updated, metav1.UpdateOptions{}); err != nil {
+		return err
+	}
+	// An empty previous hash means the Deployment predates this annotation, so
+	// the first reconcile after upgrade rolls every builder exactly once — a
+	// one-time cost, not ongoing churn, because the hash matches from then on.
+	r.logger.Info("builder deployment spec drifted, rolling it",
+		"deployment", updated.Name, "namespace", ns,
+		"previous", live.Annotations[builderSpecHashAnnotation], "current", want)
+	return nil
+}
+
 // deleteStaleBuilders removes builder Services/Deployments owned by this
 // Environment whose embedded ResourceVersion label no longer matches the live
 // Environment — i.e. objects left behind by a previous generation.
@@ -381,7 +444,11 @@ func builderAuthEnvVars(namespace string) []apiv1.EnvVar {
 	}
 }
 
-func (r *EnvironmentReconciler) createBuilderDeployment(ctx context.Context, env *fv1.Environment, ns string) (*appsv1.Deployment, error) {
+// genBuilderDeployment computes the DESIRED builder Deployment for an
+// Environment. Split out from the create path so the reconciler can compute the
+// same object on every pass and compare it against what is live — see
+// builderSpecHash and ensureBuilder.
+func (r *EnvironmentReconciler) genBuilderDeployment(env *fv1.Environment, ns string) (*appsv1.Deployment, error) {
 	name := fmt.Sprintf("%v-%v", env.Name, env.ResourceVersion)
 	sel := r.getLabels(env.Name, ns, env.ResourceVersion)
 	var replicas int32 = 1
@@ -532,12 +599,85 @@ func (r *EnvironmentReconciler) createBuilderDeployment(ctx context.Cont
```

**File**: `pkg/buildermgr/environment_reconciler_test.go` (modified, +151/-0)
```diff
@@ -16,6 +16,7 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	k8sfake "k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/client/fake"
@@ -326,3 +327,153 @@ func TestEnvironmentReconcilePrunesStaleGeneration(t *testing.T) {
 	_, err = r.kubernetesClient.CoreV1().Services(ns).Get(t.Context(), env.Name+"-2", metav1.GetOptions{})
 	require.NoError(t, err, "current-generation builder service must exist")
 }
+
+// TestEnvironmentReconcileRollsDriftedBuilder is issue #776: builder drift that
+// does NOT bump the Environment's ResourceVersion must still roll the builder.
+//
+// Everything the builder pod is made of that comes from the chart rather than
+// the CR — the fetcher image, the builder image-pull policy, the pod-spec patch
+// — changes without the Environment being touched. The name and selector are
+// keyed on the RV, so they still match, and the reconciler used to find a
+// Deployment and do nothing. The builder then ran the previous image until
+// someone deleted the Deployment by hand; deleting the POD did nothing, because
+// the ReplicaSet recreated it from the same stale template.
+func TestEnvironmentReconcileRollsDriftedBuilder(t *testing.T) {
+	env := newTestBuilderEnv()
+	env.ResourceVersion = "7"
+	r := newTestEnvironmentReconciler(t, nil, env)
+	ns := r.nsResolver.GetBuilderNS(env.Namespace)
+
+	// First reconcile creates the builder at the current desired spec.
+	_, err := r.Reconcile(t.Context(), envReq(env))
+	require.NoError(t, err)
+
+	name := env.Name + "-7"
+	created, err := r.kubernetesClient.AppsV1().Deployments(ns).Get(t.Context(), name, metav1.GetOptions{})
+	require.NoError(t, err)
+	originalHash := created.Annotations[builderSpecHashAnnotation]
+	require.NotEmpty(t, originalHash, "the created builder must carry a spec hash to compare against later")
+
+	// Drift the live Deployment the way a chart-level change would: the pod
+	// template no longer matches what the reconciler would produce, while the
+	// Environment — and therefore the name, selector and RV label — is untouched.
+	drifted := created.DeepCopy()
+	drifted.Spec.Template.Spec.Containers[0].Image = "fission/python-builder:STALE"
+	drifted.Annotations[builderSpecHashAnnotation] = "sha256:stale"
+	_, err = r.kubernetesClient.AppsV1().Deployments(ns).Update(t.Context(), drifted, metav1.UpdateOptions{})
+	require.NoError(t, err)
+
+	_, err = r.Reconcile(t.Context(), envReq(env))
+	require.NoError(t, err)
+
+	got, err := r.kubernetesClient.AppsV1().Deployments(ns).Get(t.Context(), name, metav1.GetOptions{})
+	require.NoError(t, err)
+	assert.Equal(t, env.Spec.Builder.Image, got.Spec.Template.Spec.Containers[0].Image,
+		"a drifted builder must be rolled back onto the desired image")
+	assert.Equal(t, originalHash, got.Annotations[builderSpecHashAnnotation],
+		"the spec hash must be re-stamped so the next reconcile is a no-op")
+	assert.Equal(t, name, got.Name,
+		"the Deployment must be updated in place: buildPackage resolves <env>-<rv> as a DNS hostname")
+}
+
+// TestEnvironmentReconcileDoesNotRollAnUndriftedBuilder is the other half, and
+// the direction whose failure mode is silent: a reconciler that rewrote the
+// Deployment every pass would roll every builder on every resync forever.
+// Comparing the apiserver's view of the PodSpec would do exactly that, since it
+// defaults fields we never set — hence hashing our own desired object instead.
+func TestEnvironmentReconcileDoesNotRollAnUndriftedBuilder(t *testing.T) {
+	env := newTestBuilderEnv()
+	env.ResourceVersion = "7"
+	r := newTestEnvironmentReconciler(t, nil, env)
+	ns := r.nsResolver.GetBuilderNS(env.Namespace)
+
+	_, err := r.Reconcile(t.Context(), envReq(env))
+	require.NoError(t, err)
+	_, err = r.kubernetesClient.AppsV1().Deployments(ns).Get(t.Context(), env.Name+"-7", metav1.GetOptions{})
+	require.NoError(t, err)
+
+	// Count Deployment writes with a reactor rather than comparing
+	// ResourceVersion: the fake clientset does not bump RV on Update, so an
+	// RV comparison passes even when the reconciler rewrites the object on
+	// every pass — the exact regression this test exists to catch.
+	var updates int
+	fakeCS, ok := r.kubernetesClient.(*k8sfake.Clientset)
+	require.True(t, ok, "test reconciler must use the fake clientset")
+	fakeCS.PrependReactor("update", "deployments", func(k8stesting.Action) (bool, runtime.Object, error) {
+		updates++
+		return false, nil, nil
+	})
+
+	for range 3 {
+		_, err = r.Reconcile(t.Context(), envReq(env))
+		require.NoError(t, err)
+	}
+
+	assert.Zero(t, updates,
+		"repeated reconciles of an unchanged environment must not write the Deployment at all")
+}
+
+// TestEnvironmentReconcileDoesNotRollWhenPodSpecPatched is the case the drift
+// check exists for, and the one that breaks a naive hash.
+//
+// env.Sp
```

**File**: `pkg/healthcheck/healthcheck.go` (modified, +16/-4)
```diff
@@ -117,11 +117,23 @@ func (hc *HealthChecker) CheckFissionVersion(ctx context.Context, input cli.Inpu
 	console.Verbose(2, "clientVersion: %s", clientVersion)
 	console.Verbose(2, "serverVersion: %s", serverVersion)
 
-	if clientVersion != serverVersion {
-		return fmt.Errorf("client version %s does not match with server version %s", clientVersion, serverVersion)
+	// Judged against the support window in RELEASES.md rather than by string
+	// equality. Exact equality failed on any patch difference — which the
+	// policy explicitly permits — and on the ordinary state of a staged
+	// rollout, where the CLI and the cluster are upgraded at different moments.
+	verdict, detail := CheckVersionSkew(clientVersion, serverVersion)
+	switch verdict {
+	case SkewSame:
+		return nil
+	case SkewSupported, SkewUnknown:
+		// Reported, not failed: both are states a healthy cluster is legitimately
+		// in, and turning them into an error is what made this check something
+		// users learned to ignore.
+		console.Warn(detail)
+		return nil
+	default:
+		return fmt.Errorf("unsupported version skew: %s", detail)
 	}
-
-	return nil
 }
 
 func NewCategory(id CategoryID, checkers []Checker, enabled bool) *Category {
```

**File**: `pkg/healthcheck/skew.go` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package healthcheck
+
+import (
+	"fmt"
+	"strconv"
+	"strings"
+)
+
+// SupportedMinorSkew is how many minor releases the CLI may differ from the
+// control plane and still be supported.
+//
+// It is 1 because RELEASES.md promises fixes for the latest TWO minor lines:
+// with 1.N and 1.N-1 both supported, a CLI and a cluster on adjacent minors are
+// both in the window, and anything further apart is not. Changing the support
+// window means changing this constant, and vice versa — they are one policy.
+const SupportedMinorSkew = 1
+
+// SkewVerdict is the outcome of comparing a client and server version.
+type SkewVerdict int
+
+const (
+	// SkewSame — identical minor. Nothing to report.
+	SkewSame SkewVerdict = iota
+	// SkewSupported — different minor, still inside the support window. This
+	// is the normal state during a staged rollout and must NOT be an error.
+	SkewSupported
+	// SkewUnsupported — outside the window; behaviour is not guaranteed.
+	SkewUnsupported
+	// SkewUnknown — at least one version could not be parsed (a dev build, a
+	// source build, an unreachable control plane).
+	SkewUnknown
+)
+
+// semver is a parsed major.minor.patch, ignoring any pre-release or build
+// suffix and a leading "v".
+type semver struct {
+	major, minor, patch int
+}
+
+// parseSemver parses "v1.27.0", "1.27.0", "1.27.0-rc1" and "1.27" leniently.
+// It reports ok=false for anything it cannot read as major.minor, including the
+// empty string and dev builds, so callers can distinguish "no skew" from "no
+// idea" rather than silently treating an unparsable version as 0.0.0.
+func parseSemver(v string) (semver, bool) {
+	v = strings.TrimSpace(v)
+	v = strings.TrimPrefix(v, "v")
+	if v == "" {
+		return semver{}, false
+	}
+	// Drop pre-release / build metadata: 1.27.0-rc1+abc -> 1.27.0
+	if i := strings.IndexAny(v, "-+"); i >= 0 {
+		v = v[:i]
+	}
+	parts := strings.Split(v, ".")
+	if len(parts) < 2 {
+		return semver{}, false
+	}
+	out := semver{}
+	var err error
+	if out.major, err = strconv.Atoi(parts[0]); err != nil {
+		return semver{}, false
+	}
+	if out.minor, err = strconv.Atoi(parts[1]); err != nil {
+		return semver{}, false
+	}
+	if len(parts) > 2 {
+		// A non-numeric patch is tolerated: the skew rule only reads
+		// major.minor, so refusing the whole version over it would report
+		// "unknown" for versions we can in fact judge.
+		out.patch, _ = strconv.Atoi(parts[2])
+	}
+	return out, true
+}
+
+// CheckVersionSkew judges a client version against a server version under the
+// support window in RELEASES.md.
+//
+// A DIFFERING MINOR IS NOT AN ERROR. The previous check required exact string
+// equality, which fails during any staged rollout — the CLI is upgraded on a
+// laptop or in CI at a different moment from the cluster — and contradicts the
+// published policy of supporting two minor lines. It also failed on any patch
+// difference, which the policy explicitly permits.
+//
+// A differing MAJOR is always unsupported: nothing in the policy promises
+// compatibility across a major.
+func CheckVersionSkew(clientVersion, serverVersion string) (SkewVerdict, string) {
+	c, cok := parseSemver(clientVersion)
+	s, sok := parseSemver(serverVersion)
+	if !cok || !sok {
+		return SkewUnknown, fmt.Sprintf(
+			"cannot compare versions (client %q, server %q); this is expected for dev or source builds",
+			clientVersion, serverVersion)
+	}
+
+	if c.major != s.major {
+		return SkewUnsupported, fmt.Sprintf(
+			"client %s and server %s are on different major versions; compatibility is not supported across a major",
+			clientVersion, serverVersion)
+	}
+
+	skew := c.minor - s.minor
+	if skew < 0 {
+		skew = -skew
+	}
+	switch {
+	case skew == 0:
+		return SkewSame, ""
+	case skew <= SupportedMinorSkew:
+		return SkewSupported, fmt.Sprintf(
+			"client %s and server %s differ by %d minor version(s); both are inside the supported window of %d",
+			clientVersion, serverVersion, skew, SupportedMinorSkew)
+	default:
+		return SkewUnsupported, fmt.Sprintf(
+			"client %s and server %s are %d minor versions apart; only %d is supported (see RELEASES.md). Upgrade the CLI or the cluster before relying on this client",
+			clientVersion, serverVersion, skew, SupportedMinorSkew)
+	}
+}
```

**File**: `pkg/healthcheck/skew_test.go` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+// SPDX-FileCopyrightText: The Fission Authors
+//
+// SPDX-License-Identifier: Apache-2.0
+
+package healthcheck
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+// TestCheckVersionSkew pins the support window from RELEASES.md: the latest two
+// minor lines are supported, so adjacent minors are fine and anything further
+// apart is not.
+//
+// The cases that matter most are the ones the previous exact-equality check got
+// wrong — a patch difference and a one-minor difference are both NORMAL, and
+// failing them is what made `fission check` noisy enough to ignore.
+func TestCheckVersionSkew(t *testing.T) {
+	t.Parallel()
+	cases := []struct {
+		name           string
+		client, server string
+		want           SkewVerdict
+	}{
+		{"identical", "1.27.0", "1.27.0", SkewSame},
+		{"identical with v prefix on one side", "v1.27.0", "1.27.0", SkewSame},
+		{"patch differs — explicitly permitted by the policy", "1.27.3", "1.27.0", SkewSame},
+		{"pre-release suffix is ignored", "1.27.0-rc1", "1.27.0", SkewSame},
+		{"build metadata is ignored", "1.27.0+abc123", "1.27.0", SkewSame},
+
+		{"client one minor ahead — staged rollout", "1.28.0", "1.27.0", SkewSupported},
+		{"client one minor behind — staged rollout", "1.26.0", "1.27.0", SkewSupported},
+
+		{"two minors apart is outside the window", "1.29.0", "1.27.0", SkewUnsupported},
+		{"two minors behind is outside the window", "1.25.0", "1.27.0", SkewUnsupported},
+		{"different major is never supported", "2.0.0", "1.27.0", SkewUnsupported},
+		{"different major, adjacent minor number", "2.27.0", "1.27.0", SkewUnsupported},
+
+		{"dev build client", "dev", "1.27.0", SkewUnknown},
+		{"empty server (control plane unreachable)", "1.27.0", "", SkewUnknown},
+		{"both unparsable", "", "", SkewUnknown},
+		{"major only is not enough to judge a minor skew", "1", "1.27.0", SkewUnknown},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			got, detail := CheckVersionSkew(tc.client, tc.server)
+			assert.Equal(t, tc.want, got)
+			if tc.want == SkewSame {
+				assert.Empty(t, detail, "an in-sync pair must produce no message to print")
+			} else {
+				assert.NotEmpty(t, detail, "every non-trivial verdict must explain itself to the user")
+			}
+		})
+	}
+}
+
+// TestCheckVersionSkewIsSymmetric pins that the rule judges DISTANCE, not
+// direction: a client one minor ahead of the cluster and one minor behind it
+// are equally supported. Only the message differs.
+func TestCheckVersionSkewIsSymmetric(t *testing.T) {
+	t.Parallel()
+	for _, pair := range [][2]string{
+		{"1.28.0", "1.27.0"},
+		{"1.29.0", "1.27.0"},
+		{"1.27.0", "1.27.0"},
+	} {
+		fwd, _ := CheckVersionSkew(pair[0], pair[1])
+		rev, _ := CheckVersionSkew(pair[1], pair[0])
+		assert.Equalf(t, fwd, rev, "verdict must not depend on which side is newer (%s vs %s)", pair[0], pair[1])
+	}
+}
+
+// TestSupportedMinorSkewMatchesPolicy guards the coupling between this constant
+// and RELEASES.md. Two supported minor lines means adjacent minors are in the
+// window and two-apart is not; if someone widens the support window without
+// touching the constant (or the reverse), one of these fails.
+func TestSupportedMinorSkewMatchesPolicy(t *testing.T) {
+	t.Parallel()
+	assert.Equal(t, 1, SupportedMinorSkew,
+		"RELEASES.md promises the latest TWO minor lines, which is a skew of exactly 1")
+
+	adjacent, _ := CheckVersionSkew("1.28.0", "1.27.0")
+	assert.Equal(t, SkewSupported, adjacent, "two supported lines must make adjacent minors supported")
+
+	twoApart, _ := CheckVersionSkew("1.29.0", "1.27.0")
+	assert.Equal(t, SkewUnsupported, twoApart, "two supported lines must make a two-minor gap unsupported")
+}
```

**File**: `test/helm/portdrift_test.go` (modified, +73/-0)
```diff
@@ -499,6 +499,79 @@ func TestStateSvcChart(t *testing.T) {
 	})
 }
 
+// verbsFor returns the verbs a rendered Role/ClusterRole grants for a resource
+// in an API group, merged across every rule that mentions it.
+func verbsFor(doc map[string]any, apiGroup, resource string) map[string]bool {
+	out := map[string]bool{}
+	rules, _ := doc["rules"].([]any)
+	for _, r := range rules {
+		rule, _ := r.(map[string]any)
+		groups, _ := rule["apiGroups"].([]any)
+		hasGroup := false
+		for _, g := range groups {
+			if s, _ := g.(string); s == apiGroup {
+				hasGroup = true
+			}
+		}
+		if !hasGroup {
+			continue
+		}
+		resources, _ := rule["resources"].([]any)
+		hasResource := false
+		for _, res := range resources {
+			if s, _ := res.(string); s == resource {
+				hasResource = true
+			}
+		}
+		if !hasResource {
+			continue
+		}
+		verbs, _ := rule["verbs"].([]any)
+		for _, v := range verbs {
+			if s, _ := v.(string); s != "" {
+				out[s] = true
+			}
+		}
+	}
+	return out
+}
+
+// TestBuildermgrCanRollBuilderDeployments guards an RBAC gap that fails CLOSED
+// and silently: buildermgr rolls a builder Deployment whose pod template has
+// drifted from the chart (RFC-0028 phase 3, #776), which needs `update` on
+// deployments. The Role historically granted only list/create/delete.
+//
+// Nothing else would catch this. The reconciler's unit tests use a fake
+// clientset, which does not enforce RBAC, so they pass either way; in a real
+// cluster the drift is detected, the update is denied, and the builder keeps
+// running the stale image — the exact symptom the feature exists to remove.
+func TestBuildermgrCanRollBuilderDeployments(t *testing.T) {
+	docs := render(t)
+
+	var found bool
+	for _, doc := range docs {
+		kind, _ := doc["kind"].(string)
+		if kind != "Role" && kind != "ClusterRole" {
+			continue
+		}
+		meta, _ := doc["metadata"].(map[string]any)
+		name, _ := meta["name"].(string)
+		if !strings.Contains(name, "buildermgr") {
+			continue
+		}
+		verbs := verbsFor(doc, "apps", "deployments")
+		if len(verbs) == 0 {
+			continue
+		}
+		found = true
+		for _, want := range []string{"list", "create", "update", "delete"} {
+			assert.Truef(t, verbs[want],
+				"%s %q must grant %q on apps/deployments (have %v)", kind, name, want, verbs)
+		}
+	}
+	require.True(t, found, "no buildermgr Role/ClusterRole granting apps/deployments was rendered")
+}
+
 // TestNameFormat pins RFC-0029 phase 2's naming groundwork.
 //
 // The property that matters most is that `legacy` is the default and changes
```

#### Recent Merged Pull Requests:
- **PR #3729** (closed): chore(deps): bump the go-dependencies group across 1 directory with 18 updates (@dependabot[bot])
- **PR #3727** (2026-09-15): storagesvc/client: pull the MinIO test fixture from quay.io (Docker Hub mirror removed) (@sanketsudake)
- **PR #3726** (closed): chore(deps): bump the go-dependencies group across 1 directory with 16 updates (@dependabot[bot])
- **PR #3724** (2026-09-15): tlc: pin tla2tools to the stable v1.7.4 release instead of the rebuilt v1.8.0 prerelease (@sanketsudake)
- **PR #3723** (2026-09-11): hack/run-tlc: bump the tla2tools pin for the 2026-09-10 upstream rebuild (@sanketsudake)
- **PR #3722** (2026-09-15): Carve feature-independent changes out of the agent runtime (#3710): env runtimeClassName, statesvc EventLog routes, MCP _meta tracing, environment egress NetworkPolicy (@sanketsudake)
- **PR #3721** (closed): chore(deps): bump the github-actions group across 1 directory with 8 updates (@dependabot[bot])
- **PR #3720** (closed): chore(deps): bump the go-dependencies group with 10 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
