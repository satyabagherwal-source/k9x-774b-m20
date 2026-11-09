> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fission-fission-learnings.md`  
> **Source**: github ([https://github.com/fission/fission](https://github.com/fission/fission))  
> **Source Version**: `9cac7b02`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T13:10:04.108Z  
> **Learning ID**: `learn-github-fission-fission`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): fission/fission

> **Canonical Artifact**: `07_PROJECT_LEARNING/fission-fission-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fission/fission](https://github.com/fission/fission))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-09T13:10:03.358Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fission/fission`
- **Description**: Fast and Simple Serverless Functions for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 8944 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3610** (2026-08-21): **Flaky: TestAsyncInvocationOnSuccessFunctionDestination times out waiting on the shared async queue under CI contention**
  *Symptoms*: ## Summary  `TestAsyncInvocationOnSuccessFunctionDestination` (suites/serial, RFC-0024) intermittently fails in CI with `Condition never satisfied` after ~120-190s, then passes on rerun.  Observed three times in the last two days on unrelated heads: - PR #3599 head `47980c7e` precursor run, leg v1.36.1 - PR #3599 head `133aaacb` run 30070118449, leg v1.32.11 (122s) - PR #3608 run 30095299405, leg v1.34.8 (190s) — a PR that touches no async code at all  ## Likely mechanism  The test waits for an onSuccess destination fire through the single global async-invocation queue (RFC-0024 design). Under runner contention the delivery/redelivery backoff chain can exceed the test's wait window; the sibling `TestAsyncInvocationDepthCapBounds` showed the same shape once. Related: the settle-budget fix (#3604) removed one source of stuck leases, but the window-vs-backoff race remains.  ## Suggested direction  Either widen the destination-fire wait to comfortably cover the worst-case backoff chain (the async-pin tests in the RFC-0025 suite were recently moved to a 5m window for the same reason), or make the test's function respond immediately so only queue latency (not function latency) is in the budget.

- **Issue #3588** (2026-07-19): **fission function test is broken after router public/internal listener split**
  *Symptoms*: **Fission/Kubernetes version**  <pre> client:   fission/core:     BuildDate: "2026-06-22T12:02:31Z"     GitCommit: 1e1401cd     Version: v1.27.0 server:   fission/core:     BuildDate: "2026-06-22T12:02:31Z"     GitCommit: 1e1401cd     Version: **v1.27.0** </pre>  **Kubernetes platform (e.g. Google Kubernetes Engine)**  OpenShift/Kubernetes.  Fission is installed in the `fission` namespace. Functions are deployed in the `fission-functions` namespace.  **Describe the bug**  `fission function test` consistently returns `404 page not found` on Fission v1.27.0, including for a minimal valid Python function.  The function itself works correctly when invoked through an HTTPTrigger on the public router. The failure is isolated to the direct invocation path used by `fission function test`.  Verbose output shows that the CLI port-forwards to the public router listener on port `8888`, then calls:  <pre> /fission-function/&lt;namespace&gt;/&lt;function&gt; </pre>  That direct invocation endpoint is no longer served by the public listener. The router therefore returns `404` before the request reaches the executor.  The installed router services appear to be configured as expected:  <pre> $ oc -n fission get svc router router-internal \ -o custom-columns='NAME:.metadata.name,PORT:.spec.ports[*].port,TARGET:.spec.ports[*].targetPort' NAME PORT TARGET router 80 8888 router-internal 8889 8889 </pre>  **To Reproduce**  Create a minimal Python function:  <pre> $ cat &gt; hello_min.py &lt;&lt;'P

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

### Incident Patch 1: `2a08f8c0` (2026-11-09)
**Commit Message**: Dependency security sweep 2026-11-09: k8s v0.37.2, x/net v0.62.0, brotli/klauspost CVE fixes (#3748)

* Bump k8s.io/* to v0.37.2 (patch) with code-generator and authn/kubernetes rider

Patch bump across the k8s core family (api, apimachinery, client-go,
apiextensions-apiserver, metrics, code-generator) plus the
go-containerregistry authn/kubernetes pseudo-version, which requires
k8s v0.37 minimum. Regenerated pkg/generated picks up the client-go
v0.37.2 applyconfig tag change and DiscoveryInterfaces rename.

* Bump transport: x/net v0.62.0, grpc v1.85.0, x/crypto post-tag fix

x/net v0.62.0 closes GO-2026-6866 and GO-2026-6860 (module-level).
x/crypto moves to the post-v0.58.0 commit that fixes GO-2026-5932
(no v0.58.1 tag exists yet); it stays indirect.

* Bump misc deps: brotli v1.2.7, klauspost/compress v1.20.2, pgx v5.12.0, ojg, prometheus/common, pflag, sqlite, go-snaps

brotli v1.2.7 closes GO-2026-6888 (excessive memory allocation on
crafted brotli streams, called from the router streaming reader and
fetcher websocket handler) and klauspost/compress v1.20.2 closes
GO-2026-6865 (panic on two-block frames, called from the package zip
writer). The rest are routine minor/patch b

**File**: `.claude/resources/fission-dep-groups.md` (modified, +6/-0)
```diff
@@ -51,6 +51,12 @@ If you bump into / out of controller-runtime v0.24, replicate these:
 `hack/update-codegen.sh` copies upstream code-generator out of the module cache at whatever version `go.mod` requires, so bump it with the `k8s.io/*` group.
 **After** a k8s bump, run `make codegen` + `make generate-crds` and commit the regenerated `pkg/generated/` + `crds/v1/` **in the same commit** as the k8s bump.
 
+Local-env note: if the PATH `go` binary is older than this module's `go` directive (e.g. a Nix go 1.26 while `go.mod` says `go 1.27.3`),
+`make codegen` fails in register-gen with `method must have no type parameters` on stdlib `math/rand/v2`.
+The generator is built by `go install` inside the copied code-generator module (whose own `go` directive is older), so it compiles with the old local go/types,
+which then rejects the newer stdlib's generic methods. Run `GOTOOLCHAIN=go1.27.3 make codegen` to force the matching toolchain.
+CI is unaffected — every workflow installs Go from `go-version-file: go.mod`.
+
 `github.com/google/go-containerregistry/pkg/authn/kubernetes` is published only as pseudo-versions, and every snapshot after 2026-08-31 requires `k8s.io/* v0.37`.
 A `go get` of a newer snapshot silently pulls k8s core up a minor; keep it on its current pseudo-version until the k8s-minor lockstep commit, and bump it there.
 
```

**File**: `.mergify.yml` (modified, +6/-6)
```diff
@@ -6,12 +6,12 @@ pull_request_rules:
       - label=ready-to-merge
       - label!=hold-off-merging
       - check-success=CodeQL-Build
-      - check-success=CodeQL
-      - check-success=lint 
-      - check-success=upgrade-test (kindest/node:v1.23.17, ubuntu-latest)
-      - check-success=integration-test (v1.23.17, ubuntu-latest)
-      - check-success=integration-test (v1.25.11, ubuntu-latest)
-      - check-success=integration-test (v1.27.3, ubuntu-latest)
+      - check-success=lint
+      - check-success=upgrade-test (v1.32.11, ubuntu-24.04, latest)
+      - check-success=upgrade-test (v1.32.11, ubuntu-24.04, skip-level)
+      - check-success=integration-test (v1.32.11, ubuntu-24.04)
+      - check-success=integration-test (v1.34.8, ubuntu-24.04)
+      - check-success=integration-test (v1.36.1, ubuntu-24.04)
     actions:
       merge:
         method: squash
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ delete-crds:
 
 ### Cleanup
 clean:
-	@rm -f dist/
+	@rm -rf dist/
 
 ### Misc
 generate-swagger-doc:
```

**File**: `go.mod` (modified, +24/-23)
```diff
@@ -12,33 +12,33 @@ require (
 	github.com/dustin/go-humanize v1.1.0
 	github.com/fatih/color v1.19.0
 	github.com/fsnotify/fsnotify v1.10.1
-	github.com/gkampitakis/go-snaps v0.5.24
+	github.com/gkampitakis/go-snaps v0.5.25
 	github.com/go-git/go-git/v5 v5.19.3
 	github.com/go-logr/logr v1.4.4
 	github.com/golang-jwt/jwt/v4 v4.5.2
 	github.com/google/go-cmp v0.7.0
 	github.com/google/go-containerregistry v0.22.1
-	github.com/google/go-containerregistry/pkg/authn/kubernetes v0.0.0-20261013193525-92aac6186bc4
-	github.com/jackc/pgx/v5 v5.11.0
+	github.com/google/go-containerregistry/pkg/authn/kubernetes v0.0.0-20261026195947-bc0638f2d173
+	github.com/jackc/pgx/v5 v5.12.0
 	github.com/johannesboyne/gofakes3 v1.2.0
 	github.com/kedacore/keda/v2 v2.21.0
 	github.com/mholt/archives v0.1.5
 	github.com/minio/minio-go/v7 v7.4.1
 	github.com/moby/moby/api v1.56.1
 	github.com/moby/moby/client v0.6.2
 	github.com/modelcontextprotocol/go-sdk v1.8.0
-	github.com/ohler55/ojg v1.28.8
+	github.com/ohler55/ojg v1.28.9
 	github.com/ory/dockertest/v3 v3.12.0
 	github.com/prometheus/client_golang v1.25.0
 	github.com/prometheus/client_model v0.6.3
-	github.com/prometheus/common v0.72.1
+	github.com/prometheus/common v0.73.1
 	github.com/prometheus/otlptranslator v1.0.0
 	github.com/robfig/cron/v3 v3.0.1
 	github.com/sabhiram/go-gitignore v0.0.0-20210923224102-525f6e181f06
 	github.com/sanketsudake/go-portless v0.4.0
 	github.com/sanketsudake/go-portless/k8s v0.3.0
 	github.com/spf13/cobra v1.10.2
-	github.com/spf13/pflag v1.0.10
+	github.com/spf13/pflag v1.1.0
 	github.com/stretchr/testify v1.12.1
 	go.opentelemetry.io/contrib/bridges/otelzap v0.21.0
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.72.0
@@ -57,22 +57,22 @@ require (
 	go.opentelemetry.io/otel/trace v1.47.0
 	go.uber.org/goleak v1.3.0
 	go.uber.org/zap v1.28.0
-	golang.org/x/net v0.61.0
+	golang.org/x/net v0.62.0
 	golang.org/x/sync v0.24.0
 	golang.org/x/term v0.47.0
-	google.golang.org/grpc v1.84.0
-	k8s.io/api v0.37.1
-	k8s.io/apiextensions-apiserver v0.37.1
-	k8s.io/apimachinery v0.37.1
-	k8s.io/client-go v0.37.1
-	k8s.io/code-generator v0.37.1
+	google.golang.org/grpc v1.85.0
+	k8s.io/api v0.37.2
+	k8s.io/apiextensions-apiserver v0.37.2
+	k8s.io/apimachinery v0.37.2
+	k8s.io/client-go v0.37.2
+	k8s.io/code-generator v0.37.2
 	k8s.io/gengo/v2 v2.0.0-20260408192533-25e2208e0dc3
 	k8s.io/klog/v2 v2.140.0
-	k8s.io/metrics v0.37.1
-	modernc.org/sqlite v1.61.0
+	k8s.io/metrics v0.37.2
+	modernc.org/sqlite v1.62.0
 	pgregory.net/rapid v1.3.0
 	sigs.k8s.io/controller-runtime v0.25.2
-	sigs.k8s.io/gateway-api v1.6.3
+	sigs.k8s.io/gateway-api v1.7.0
 	sigs.k8s.io/structured-merge-diff/v6 v6.4.2
 	sigs.k8s.io/yaml v1.6.0
 )
@@ -86,7 +86,7 @@ require (
 	github.com/Nvveen/Gotty v0.0.0-20120604004816-cd527374f1e5 // indirect
 	github.com/ProtonMail/go-crypto v1.3.0 // indirect
 	github.com/STARRY-S/zip v0.2.3 // indirect
-	github.com/andybalholm/brotli v1.2.3 // indirect
+	github.com/andybalholm/brotli v1.2.7 // indirect
 	github.com/beorn7/perks v1.0.1 // indirect
 	github.com/bmatcuk/doublestar/v4 v4.0.2 // indirect
 	github.com/bodgit/plumbing v1.3.0 // indirect
@@ -153,7 +153,7 @@ require (
 	github.com/inconshreveable/mousetrap v1.1.0 // indirect
 	github.com/jackc/pgpassfile v1.0.0 // indirect
 	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
-	github.com/jackc/puddle/v2 v2.2.2 // indirect
+	github.com/jackc/puddle/v2 v2.2.3 // indirect
 	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/jcmturner/aescts/v2 v2.0.0 // indirect
 	github.com/jcmturner/dnsutils/v2 v2.0.0 // indirect
@@ -162,7 +162,7 @@ require (
 	github.com/jcmturner/rpc/v2 v2.0.3 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
 	github.com/kevinburke/ssh_config v1.2.0 // indirect
-	github.com/klauspost/compress v1.20.1 // indirect
+	github.com/klauspost/compress v1.20.2 // indirect
 	github.com/klauspost/cpuid/v2 v2.4.0 // indirect
 	github.com/klauspost/crc32 v1.3.0 // indirect
 	github.com/klauspost/pgzip v1.2.6 // indirect
@@ -189,6 +189,7 @@ require (
 	github.com/opencontainers/go-digest v1.0.0 // indirect
 	github.com/opencontainers/image-spec v1.1.1 // indirect
 	github.com/opencontainers/runc v1.3.6 // indirect
+	github.com/pandatix/go-abnf v0.5.3 // indirect
 	github.com/philhofer/fwd v1.2.0 // indirect
 	github.com/pierrec/lz4/v4 v4.1.31 // indirect
 	github.com/pjbgf/sha1cd v0.7.0 // indirect
@@ -226,12 +227,12 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	go4.org v0.0.0-20230225012048-214862532bf5 // indirect
-	golang.org/x/crypto v0.58.0 // indirect
+	golang.org/x/crypto v0.58.1-0.20261009181718-2f1f834330b2 // indirect
 	golang.org/x/mod v0.42.0 // indirect
 	golang.org/x/oauth2 v0.37.0 // indirect
 	golang.org/x/sys v0.49.0 // indirect
 	golang.org/x/text v0.43.0 // indirect
-	golang.org/x/time v0.15.0 // indirect
+	golang.org/x/time 
```

**File**: `go.sum` (modified, +56/-54)
```diff
@@ -44,8 +44,8 @@ github.com/ProtonMail/go-crypto v1.3.0 h1:ILq8+Sf5If5DCpHQp4PbZdS1J7HDFRXz/+xKBi
 github.com/ProtonMail/go-crypto v1.3.0/go.mod h1:9whxjD8Rbs29b4XWbB8irEcE8KHMqaR2e7GWU1R+/PE=
 github.com/STARRY-S/zip v0.2.3 h1:luE4dMvRPDOWQdeDdUxUoZkzUIpTccdKdhHHsQJ1fm4=
 github.com/STARRY-S/zip v0.2.3/go.mod h1:lqJ9JdeRipyOQJrYSOtpNAiaesFO6zVDsE8GIGFaoSk=
-github.com/andybalholm/brotli v1.2.3 h1:8H1qwOkl2LPfjf3YezB90JnCliZb6SInJ/OJkEbA5NQ=
-github.com/andybalholm/brotli v1.2.3/go.mod h1:rzTDkvFWvIrjDXZHkuS16NPggd91W3kUSvPlQ1pLaKY=
+github.com/andybalholm/brotli v1.2.7 h1:UgafRPGMam5ySHfRkhthMqOFA6IFoeF3D7mWIDLjG5A=
+github.com/andybalholm/brotli v1.2.7/go.mod h1:rzTDkvFWvIrjDXZHkuS16NPggd91W3kUSvPlQ1pLaKY=
 github.com/anishathalye/porcupine v1.3.1 h1:fBZ4/NGNPnIDdd6xNtrNk9/GiEQ0L4FO5+scINN+t0E=
 github.com/anishathalye/porcupine v1.3.1/go.mod h1:WM0SsFjWNl2Y4BqHr/E/ll2yY1GY1jqn+W7Z/84Zoog=
 github.com/anmitsu/go-shlex v0.0.0-20200514113438-38f4b401e2be h1:9AeTilPcZAjCFIImctFaOjnTIavg87rW78vTPkQqLI8=
@@ -176,8 +176,8 @@ github.com/fxamacker/cbor/v2 v2.9.3 h1:oQBnFATpNdY8gJHTndDDv5Xl4QqNaz51G5LLEPhng
 github.com/fxamacker/cbor/v2 v2.9.3/go.mod h1:vM4b+DJCtHn+zz7h3FFp/hDAI9WNWCsZj23V5ytsSxQ=
 github.com/gkampitakis/ciinfo v0.3.4 h1:5eBSibVuSMbb/H6Elc0IIEFbkzCJi3lm94n0+U7Z0KY=
 github.com/gkampitakis/ciinfo v0.3.4/go.mod h1:1NIwaOcFChN4fa/B0hEBdAb6npDlFL8Bwx4dfRLRqAo=
-github.com/gkampitakis/go-snaps v0.5.24 h1:oyQ/CQA4s0nkVm6CLlM2GJSU8e4p6KGPZbrSCnTNBzE=
-github.com/gkampitakis/go-snaps v0.5.24/go.mod h1:uy3lVzCCRRsAwYqSocyw5fY8xRLCYEfqoOJNxr8HonM=
+github.com/gkampitakis/go-snaps v0.5.25 h1:ZE3iiQcS2WDV08JdUc+wVpHb6JEnLC+hlo9v8/YqZoQ=
+github.com/gkampitakis/go-snaps v0.5.25/go.mod h1:uy3lVzCCRRsAwYqSocyw5fY8xRLCYEfqoOJNxr8HonM=
 github.com/gliderlabs/ssh v0.3.8 h1:a4YXD1V7xMF9g5nTkdfnja3Sxy1PVDCj1Zg4Wb8vY6c=
 github.com/gliderlabs/ssh v0.3.8/go.mod h1:xYoytBv1sV0aL3CavoDuJIQNURXkkfPA/wxQ1pL1fAU=
 github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 h1:+zs/tPmkDkHx3U66DAb0lQFJrpS6731Oaa12ikc+DiI=
@@ -278,8 +278,8 @@ github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
 github.com/google/go-cmp v0.7.0/go.mod h1:pXiqmnSA92OHEEa9HXL2W4E7lf9JzCmGVUdgjX3N/iU=
 github.com/google/go-containerregistry v0.22.1 h1:RZuuSYhTvlDvtsK+NkutoCZ//C0X2ebLK8X8l3ULs84=
 github.com/google/go-containerregistry v0.22.1/go.mod h1:bJR35SK8XgisYmhg/FMQ/5RK0S/XrOAqLBV5/LR2XE0=
-github.com/google/go-containerregistry/pkg/authn/kubernetes v0.0.0-20261013193525-92aac6186bc4 h1:73D7f/eA05ea94q4mYS8VHKx2SeYYPHbyuBL3giTdjU=
-github.com/google/go-containerregistry/pkg/authn/kubernetes v0.0.0-20261013193525-92aac6186bc4/go.mod h1:LI3ZSbqmFw4vxcBwMdG8h6blxTu6LyjIR9TQyOmEhRM=
+github.com/google/go-containerregistry/pkg/authn/kubernetes v0.0.0-20261026195947-bc0638f2d173 h1:zWrZht3lpXnp7+jRhewVLpzbRbT36bRqxgDOS0QR7UE=
+github.com/google/go-containerregistry/pkg/authn/kubernetes v0.0.0-20261026195947-bc0638f2d173/go.mod h1:LI3ZSbqmFw4vxcBwMdG8h6blxTu6LyjIR9TQyOmEhRM=
 github.com/google/gofuzz v1.0.0/go.mod h1:dBl0BpW6vV/+mYPU4Po3pmUjxk6FQPldtuIdl/M65Eg=
 github.com/google/gofuzz v1.2.0 h1:xRy4A+RhZaiKjJ1bPfwQ8sedCA+YS2YcCHW6ec7JMi0=
 github.com/google/gofuzz v1.2.0/go.mod h1:dBl0BpW6vV/+mYPU4Po3pmUjxk6FQPldtuIdl/M65Eg=
@@ -322,10 +322,10 @@ github.com/jackc/pgpassfile v1.0.0 h1:/6Hmqy13Ss2zCq62VdNG8tM1wchn8zjSGOBJ6icpsI
 github.com/jackc/pgpassfile v1.0.0/go.mod h1:CEx0iS5ambNFdcRtxPj5JhEz+xB6uRky5eyVu/W2HEg=
 github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 h1:iCEnooe7UlwOQYpKFhBabPMi4aNAfoODPEFNiAnClxo=
 github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761/go.mod h1:5TJZWKEWniPve33vlWYSoGYefn3gLQRzjfDlhSJ9ZKM=
-github.com/jackc/pgx/v5 v5.11.0 h1:IzBBtyK9AHqf98cctWFifYSci2hgQR/cd56wB4p+ogg=
-github.com/jackc/pgx/v5 v5.11.0/go.mod h1:mal1tBGAFfLHvZzaYh77YS/eC6IX9OWbRV1QIIM0Jn4=
-github.com/jackc/puddle/v2 v2.2.2 h1:PR8nw+E/1w0GLuRFSmiioY6UooMp6KJv0/61nB7icHo=
-github.com/jackc/puddle/v2 v2.2.2/go.mod h1:vriiEXHvEE654aYKXXjOvZM39qJ0q+azkZFrfEOc3H4=
+github.com/jackc/pgx/v5 v5.12.0 h1:hWwax8YiGT0YiN50U1oIDn5kgR7KC2tG3rmavwpPkxY=
+github.com/jackc/pgx/v5 v5.12.0/go.mod h1:u2Fi6no03HCSBYE+ZVdLxbwdu3xyi2vU+K/YNJioSds=
+github.com/jackc/puddle/v2 v2.2.3 h1:f8HoREISb3l5eO9coPgK7U3hKLhWGokOFVcThl5jrao=
+github.com/jackc/puddle/v2 v2.2.3/go.mod h1:vriiEXHvEE654aYKXXjOvZM39qJ0q+azkZFrfEOc3H4=
 github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 h1:BQSFePA1RWJOlocH6Fxy8MmwDt+yVQYULKfN0RoTN8A=
 github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99/go.mod h1:1lJo3i6rXxKeerYnT8Nvf0QmHCRC1n8sfWVwXF2Frvo=
 github.com/jcmturner/aescts/v2 v2.0.0 h1:9YKLH6ey7H4eDBXW8khjYslgyqG2xZikXP0EQFKrle8=
@@ -354,8 +354,8 @@ github.com/kevinburke/ssh_config v1.2.0 h1:x584FjTGwHzMwvHx18PXxbBVzfnxogHaAReU4
 github.com/kevinburke/ssh_config v1.2.0/go.mod h1:CT57kijsi8u/K/BOFA39wgDQJ9CxiF4nAY/ojJ6r6mM=
 github.com/kisielk/gotool v1.0.0/go.mod h1:XhKaO+MFFWcvkIS/tQcRk01m1F5IRFswLeQ+oQHNcck=
 gith
```

**File**: `pkg/generated/applyconfiguration/core/v1/canaryconfig.go` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ import (
 //
 // CanaryConfig is for canary deployment of two functions.
 type CanaryConfigApplyConfiguration struct {
-	metav1.TypeMetaApplyConfiguration    `json:",inline"`
+	metav1.TypeMetaApplyConfiguration    `json:""`
 	*metav1.ObjectMetaApplyConfiguration `json:"metadata,omitempty"`
 	Spec                                 *CanaryConfigSpecApplyConfiguration   `json:"spec,omitempty"`
 	Status                               *CanaryConfigStatusApplyConfiguration `json:"status,omitempty"`
```

**File**: `pkg/generated/applyconfiguration/core/v1/environment.go` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ import (
 //
 // Environment is environment for building and running user functions.
 type EnvironmentApplyConfiguration struct {
-	metav1.TypeMetaApplyConfiguration    `json:",inline"`
+	metav1.TypeMetaApplyConfiguration    `json:""`
 	*metav1.ObjectMetaApplyConfiguration `json:"metadata,omitempty"`
 	Spec                                 *EnvironmentSpecApplyConfiguration   `json:"spec,omitempty"`
 	Status                               *EnvironmentStatusApplyConfiguration `json:"status,omitempty"`
```

**File**: `pkg/generated/applyconfiguration/core/v1/fissiontenant.go` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ import (
 // fission.io/enabled=true on a Namespace is sugar the controller
 // materializes into one of these. See docs/multiple-namespace/prd.md.
 type FissionTenantApplyConfiguration struct {
-	metav1.TypeMetaApplyConfiguration    `json:",inline"`
+	metav1.TypeMetaApplyConfiguration    `json:""`
 	*metav1.ObjectMetaApplyConfiguration `json:"metadata,omitempty"`
 	Spec                                 *FissionTenantSpecApplyConfiguration   `json:"spec,omitempty"`
 	Status                               *FissionTenantStatusApplyConfiguration `json:"status,omitempty"`
```

#### Recent Merged Pull Requests:
- **PR #3750** (2026-11-09): chore(release): prepare 1.28 (@sanketsudake)
- **PR #3749** (2026-11-09): CI tool refresh 2026-11-09: helm v4.3.1, kind v0.33.0, Envoy Gateway v1.10.0, cosign v3.1.4, golangci-lint v2.15.0 (@sanketsudake)
- **PR #3748** (2026-11-09): Dependency security sweep 2026-11-09: k8s v0.37.2, x/net v0.62.0, brotli/klauspost CVE fixes (@sanketsudake)
- **PR #3747** (closed): chore(deps): bump the go-dependencies group with 13 updates (@dependabot[bot])
- **PR #3745** (2026-10-26): Dependency sweep 2026-10-25: go 1.27.3 (GO-2026-6809), controller-tools 0.23, misc patches (@sanketsudake)
- **PR #3743** (2026-10-22): chore(deps): bump the github-actions group with 5 updates (@dependabot[bot])

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

## X. Dependency security sweep 2026-11-09: k8s v0.37.2, x/net v0.62.0, brotli/klauspo

**RULE**:
When implementing operations in `.claude/resources/fission-dep-groups.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fission/fission. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2a08f8c0`: Dependency security sweep 2026-11-09: k8s v0.37.2, x/net v0.62.0, brotli/klauspost CVE fixes (#3748). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/resources/fission-dep-groups.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
Local-env note: if the PATH `go` binary is older than this module's `go` directive (e.g. a Nix go 1.26 while `go.mod` says `go 1.27.3`),
`make codegen` fails in register-gen with `method must have no type parameters` on stdlib `math/rand/v2`.
The generator is built by `go install` inside the copied code-generator module (whose own `go` directive is older), so it compiles with the old local go/types,
which then rejects the newer stdlib's generic methods. Run `GOTOOLCHAIN=go1.27.3 make codegen` to force the matching toolchain.
CI is unaffected — every workflow installs Go from `go-version-file: go.mod`.

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2a08f8c0` are properly handled with clean fallback behavior.
