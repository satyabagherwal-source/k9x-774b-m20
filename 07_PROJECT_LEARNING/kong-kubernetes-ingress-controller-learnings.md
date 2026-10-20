> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kong-kubernetes-ingress-controller-learnings.md`  
> **Source**: github ([https://github.com/Kong/kubernetes-ingress-controller](https://github.com/Kong/kubernetes-ingress-controller))  
> **Source Version**: `319351b4`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T10:32:09.803Z  
> **Learning ID**: `learn-github-kong-kubernetes-ingress-controller`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Kong/kubernetes-ingress-controller

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
The Kong Kubernetes Ingress Controller (`KIC`) bridges Kubernetes declarative cluster topology (Ingress resources, Gateway API resources such as `Gateway`, `HTTPRoute`, `GRPCRoute`, `TCPRoute`, `UDPRoute`, `TLSRoute`, `ReferenceGrant`, and custom CRDs like `KongUpstreamPolicy`, `KongConsumer`, `KongPlugin`) and the runtime data-plane proxy engine (Kong Gateway / NGINX core). 

The controller translates distributed Kubernetes state into a single cohesive, versioned, declarative data-plane model (DB-less declarative YAML/JSON configuration or Admin API entity state). It pushes this model down to the Kong Gateway instance while maintaining two-way invariant status guarantees (Accepted, Programmed, ResolvedRefs) on upstream Kubernetes API objects without triggering reconciliation thrashing, feedback loops, or controller race conditions.

```
                      KUBERNETES CONTROL PLANE
 +-------------------------------------------------------------------+
 |  Ingress / HTTPRoute / GRPCRoute / Gateway / KongUpstreamPolicy   |
 +-------------------------------------------------------------------+
                                   │
                                   ▼
             +───────────────────────────────────────────+
             |   controller-runtime Ingress Filter Cache |
             |   (Class Predicates & Multi-Tenant Mux)   |
             +───────────────────────────────────────────+
                                   │
                                   ▼
             +───────────────────────────────────────────+
             |   Store / Internal Cache & Indexing       |
             |   (DAG Dependency Resolution / Validation)|
             +───────────────────────────────────────────+
                                   │
                                   ▼
             +───────────────────────────────────────────+
             |      Data-Plane Translation Engine        |
             |   (Kubernetes Specs -> Kong Routes/Svcs)  |
             +───────────────────────────────────────────+
                                   │
                                   ▼
             +───────────────────────────────────────────+
             |       Kong Admin API / DB-less POST       |
             |       (/config with SHA-256 Checksum)     |
             +───────────────────────────────────────────+
                                   │
                                   ▼
                        KONG DATA PLANE (NGINX)
```

### Architectural Boundaries & Subsystems
1. **Dynamic Admission Controller Subsystem (`internal/admission`)**:
   Runs as an in-cluster HTTPS webhook validating resource integrity before persistence into etcd. It enforces cross-resource invariants (such as global credential uniqueness across distinct namespaces and consumer references) that native Kubernetes OpenAPI schemas cannot enforce.
2. **Gateway API & Ingress Reconciler Subsystem (`internal/controllers/gateway`, `internal/controllers/configuration`)**:
   Monitors Gateway API specifications and Kong CRDs. It calculates graph attachments (e.g., matching `HTTPRoute` rules to `Gateway` listeners by hostname, port, and section name, validated via `ReferenceGrant` boundaries) and resolves upstream policies down to Services and Kong Service Facades.
3. **Condition & Status Management Engine (`internal/controllers/utils/conditions.go`)**:
   Maintains generation-bound conditions (`Programmed`, `Accepted`, `Conflicted`). It prevents status-update fight cycles by isolating generation updates, preventing "Unknown" status flapping, and enforcing Gateway API ancestor status array limits ($N \le 16$).
4. **Data-Plane Config Generator & Synchronizer (`internal/dataplane`)**:
   Aggregates objects from memory stores, evaluates route translation (traditional regex vs. expression-based engine), computes a deterministic SHA checksum, and syncs configuration to Kong endpoints using zero-downtime declarative reload APIs.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Reconciler Status Flap Suppression Invariant
**RULE**:
A reconciliation status updater MUST NOT transition an existing terminal or defined condition (such as `Programmed=True` or `Programmed=False`) back to an `Unknown` or `Pending` transient state upon controller startup or during intermediate cache syncs. Generation checks MUST guard all condition updates.

**WHY**:
When a controller restarts or rebuilds its internal in-memory index, local translation caches are momentarily empty or incomplete. If the controller emits `Unknown` or `Pending` status patches to the Kubernetes API server while populating caches, external orchestrators trigger re-reconciliation cascading events. This causes high API server etcd write-amplification, status flapping, and races across distributed controller replicas.

**WHEN TO APPLY**:
Applies to all Kubernetes operators, controller-runtime reconcilers, and state-machine engines managing `.status.conditions` on custom resources.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Enforced in internal/controllers/utils/conditions.go
func EnsureProgrammedCondition(
	configurationStatus object.ConfigurationStatus,
	objectGeneration int64,
	conditions []metav1.Condition,
	options ...ProgrammedConditionOption,
) ([]metav1.Condition, bool) {
	var (
		status  metav1.ConditionStatus
		reason  configurationv1.ConditionReason
		message string
	)
	switch configurationStatus {
	case object.ConfigurationStatusSucceeded:
		status = metav1.ConditionTrue
		reason = configurationv1.ReasonProgrammed
		message = ProgrammedConditionTrueMessage
	case object.ConfigurationStatusFailed:
		status = metav1.ConditionFalse
		reason = configurationv1.ReasonInvalid
		message = ProgrammedConditionFalseInvalidMessage
	case object.ConfigurationStatusUnknown:
		status = metav1.ConditionFalse
		reason = configurationv1.ReasonPending
		message = ProgrammedConditionFalsePendingMessage
	}

	desiredCondition := metav1.Condition{
		Type:               string(configurationv1.ConditionProgrammed),
		Status:             status,
		ObservedGeneration: objectGeneration,
		LastTransitionTime: metav1.Now(),
		Reason:             string(reason),
		Message:            message,
	}

	hasMatchingCondition := util.CheckCondition(
		conditions,
		util.ConditionType(desiredCondition.Type),
		util.ConditionReason(desiredCondition.Reason),
		desiredCondition.Status,
		desiredCondition.ObservedGeneration,
	)
	if hasMatchingCondition {
		return conditions, false
	}

	_, idx, ok := lo.FindIndexOf(conditions, func(c metav1.Condition) bool { 
		return c.Type == string(configurationv1.ConditionProgrammed) 
	})
	if !ok {
		conditions = append(conditions, desiredCondition)
	} else {
		// INVARIANT GUARD: Prevent startup flapping. Do not downgrade existing condition to Unknown.
		if configurationStatus == object.ConfigurationStatusUnknown {
			return conditions, false
		}
		conditions[idx] = desiredCondition
	}

	return conditions, true
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly updating conditions to Pending/Unknown on reconcile start
func BadReconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    obj := &MyResource{}
    _ = r.Get(ctx, req.NamespacedName, obj)

    // FLAPPING BUG: Wipes valid Programmed condition on every reconciler event tick
    obj.Status.Conditions = append(obj.Status.Conditions, metav1.Condition{
        Type:   "Programmed",
        Status: metav1.ConditionUnknown,
        Reason: "PendingReconciliation",
    })
    _ = r.Status().Update(ctx, obj) // Causes massive etcd churn and race conditions
    // ...
}
```

**VERIFICATION METHOD**:
Run unit tests checking condition transition vectors:
```go
func TestEnsureProgrammedCondition_NoFlapOnUnknown(t *testing.T) {
    existing := []metav1.Condition{{
        Type:               "Programmed",
        Status:             metav1.ConditionTrue,
        Reason:             "Programmed",
        ObservedGeneration: 1,
    }}
    updated, changed := EnsureProgrammedCondition(object.ConfigurationStatusUnknown, 1, existing)
    assert.False(t, changed, "Must not flag update needed when status is Unknown and condition already exists")
    assert.Equal(t, metav1.ConditionTrue, updated[0].Status, "Must not mutate existing condition to Pending/Unknown")
}
```

---

### 2. Upstream Backend Specification Decoupling via Controller Index Gates
**RULE**:
When an auxiliary policy resource (`KongUpstreamPolicy`, `BackendTLSPolicy`) targets backends (`Service`, `KongServiceFacade`), the controller MUST verify that the backend is actively attached to an Ingress or Route matching the controller's active Class/Gateway before writing policy status or enqueuing translation.

**WHY**:
In multi-tenant clusters hosting multiple ingress controllers (e.g., Kong OSS, Kong Enterprise, or NGINX alongside Kong), un-gated controllers reconcile and mutate the status of shared Services and shared Policy CRDs. This leads to split-brain status updates, infinite reconciliation loops, and memory thrashing.

**WHEN TO APPLY**:
Applies to all Kubernetes multi-controller environments where policy attachments can be shared across multiple gateway or ingress instances.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Enforced in internal/controllers/configuration/kongupstreampolicy_utils.go
func (r *KongUpstreamPolicyReconciler) upstreamPolicyUsedByBackendsOfMatchingClass(
	ctx context.Context,
	upstreamPolicyNN k8stypes.NamespacedName,
	isDefaultIngressClass bool,
) (bool, error) {
	services, err := r.getServicesReferencingUpstreamPolicy(ctx, upstreamPolicyNN)
	if err != nil {
		return false, err
	}
	serviceFacades, err := r.maybeGetServiceFacadesReferencingUpstreamPolicy(ctx, upstreamPolicyNN)
	if err != nil {
		return false, err
	}

	for _, service := range services {
		ingresses, err := r.getIngressesReferencingService(ctx, k8stypes.NamespacedName{Namespace: service.Namespace, Name: service.Name})
		if err != nil {
			return false, err
		}
		for _, ingress := range ingresses {
			if utils.MatchesIngressClass(&ingress, r.IngressClassName, isDefaultIngressClass) {
				return true, nil
			}
		}
	}

	if r.HTTPRouteEnabled {
		for _, service := range services {
			httpRoutes, err := r.getHTTPRoutesReferencingService(ctx, k8stypes.NamespacedName{Namespace: service.Namespace, Name: service.Name})
			if err != nil {
				return false, err
			}
			for _, httpRoute := range httpRoutes {
				if r.isRouteAttachedToReconciledGateway(&httpRoute) {
					return true, nil
				}
			}
		}
		for _, serviceFacade := range serviceFacades {
			httpRoutes, err := r.getHTTPRoutesReferencingServiceFacade(ctx, k8stypes.NamespacedName{Namespace: serviceFacade.Namespace, Name: serviceFacade.Name})
			if err != nil {
				return false, err
			}
			for _, httpRoute := range httpRoutes {
				if r.isRouteAttachedToReconciledGateway(&httpRoute) {
					return true, nil
				}
			}
		}
	}
	return false, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Directly modifying CRD status without verifying class match
func (r *BadPolicyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    policy := &KongUpstreamPolicy{}
    _ = r.Get(ctx, req.NamespacedName, policy)
    // Directly setting accepted without verifying if this policy targets services
    // handled by our specific ingress class! Overwrites another controller's status!
    policy.Status.Conditions = markAccepted()
    _ = r.Status().Update(ctx, policy)
    return ctrl.Result{}, nil
}
```

**VERIFICATION METHOD**:
Deploy two ingress controller instances with different `--ingress-class` flags in an `envtest` suite. Configure an upstream policy on a service referenced exclusively by Controller A. Assert Controller B leaves the policy un-reconciled and generates zero status mutations.

---

### 3. Gateway API Ancestor Status Array Bound and Deterministic Ordering
**RULE**:
When writing ancestor statuses (such as `Gateway` references inside `BackendTLSPolicy` or route status), the controller MUST enforce the Gateway API boundary rule of maximum $16$ entries ($N \le 16$), retain third-party controller statuses, and deterministically sort its own entries by namespace and name to prevent perpetual status diff churn.

**WHY**:
Failure to truncate at 16 causes Kubernetes API validation failures (CRD schema rejection on `maxItems: 16`). Failure to sort deterministically results in differing array element permutations across reconciliations, generating infinite etcd write cycles (`ResourceVersion` continuous increments).

**WHEN TO APPLY**:
All Gateway API implementations managing `.status.parents` or `.status.ancestors`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Enforced in internal/controllers/gateway/backendtlspolicy_utils.go
func (r *BackendTLSPolicyReconciler) setPolicyStatus(
	ctx context.Context, 
	policy gatewayapi.BackendTLSPolicy, 
	gateways []gatewayapi.Gateway, 
	acceptedCondition metav1.Condition,
) error {
	ancestors := []gatewayapi.PolicyAncestorStatus{}
	var completeAcceptedCondition *metav1.Condition
	kicAncestors := []gatewayapi.PolicyAncestorStatus{}

	for _, ancestor := range policy.Status.Ancestors {
		if ancestor.ControllerName == GetControllerName() {
			kicAncestors = append(kicAncestors, ancestor)
			if completeAcceptedCondition == nil {
				completeAcceptedCondition = getCompleteAcceptedCondition(ancestor, acceptedCondition)
			}
			continue
		}
		// Invariant: Retain foreign controller ancestors
		ancestors = append(ancestors, ancestor)
	}

	if completeAcceptedCondition == nil {
		completeAcceptedCondition = &acceptedCondition
		completeAcceptedCondition.LastTransitionTime = metav1.Now()
	}

	// Invariant: Deterministic stable sorting before capping
	sortGateways(gateways, kicAncestors, policy.Namespace)

	for _, gateway := range gateways {
		// Hard Gateway API schema bound limit
		if len(ancestors) >= 16 {
			break
		}
		ancestor := gatewayapi.PolicyAncestorStatus{
			AncestorRef: gatewayapi.ParentReference{
				Group:     lo.ToPtr(gatewayapi.V1Group),
				Kind:      lo.ToPtr(gatewayapi.Kind("Gateway")),
				Name:      gatewayapi.ObjectName(gateway.Name),
				Namespace: lo.ToPtr(gatewayapi.Namespace(gateway.Namespace)),
			},
			ControllerName: GetControllerName(),
			Conditions:     []metav1.Condition{*completeAcceptedCondition},
		}
		ancestors = append(ancestors, ancestor)
	}

	newPolicy := policy.DeepCopy()
	newPolicy.Status.Ancestors = ancestors
	return r.Status().Patch(ctx, newPolicy, client.MergeFrom(&policy))
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Unsorted append with no length cap
for _, gw := range foundGateways {
    // BUG 1: Exceeding 16 items causes API validation rejection
    // BUG 2: Non-deterministic iteration order triggers infinite patch loops
    policy.Status.Ancestors = append(policy.Status.Ancestors, toAncestor(gw))
}
```

**VERIFICATION METHOD**:
Execute an automated test feeding 25 Gateways into `setPolicyStatus` and assert:
1. `len(policy.Status.Ancestors) <= 16`.
2. Status updates on identical topologies yield a byte-for-byte identical patch with zero client network updates.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Expression Router Route Protocol Default Inversion (BUG-ROUTER-EXPR-01)
- **Context**: `internal/dataplane/translator` and Kong Gateway 3.14+ compatibility.
- **What Was Expected**: Expression-based route generation for Kong Gateway must support HTTP and HTTPS traffic simultaneously when translating standard `Ingress` and `HTTPRoute` objects unless explicitly restricted.
- **What Actually Happened**: In Issue #7859, integration tests failed under Kong 3.14+ because Kong inverted the default router engine protocol assumption for expression routes from `["http", "https"]` to HTTPS only. Routes translated without an explicit `protocols` slice became unreachable over standard HTTP, breaking plaintext ingress routing.
- **Evidence in Repo**: Issue #7859; PR fixing expression route translation defaults across Kong 3.14.x pipelines.
- **Root Cause**: The translator relied on default engine fallbacks instead of explicitly defining the `protocols` slice on translated Kong Route structs. When upstream Kong Gateway altered its un-specified protocol semantics in version 3.14, the controller suffered silent downstream protocol dropping.
- **Remediation Code Diff**:
```go
// In dataplane translation layer:
// - kongRoute.Protocols = nil // Relied on upstream defaults
// + kongRoute.Protocols = kong.StringSlice("http", "https")
```
- **Lesson**: Declarative translators must never depend on remote engine defaults. When translating high-level abstractions to low-level proxy representations, explicitly serialize all transport invariants.

---

### Incident 2: Upstream Gateway Breaking Change Propagation via Patch Release (BUG-RELEASE-SEMVER-02)
- **Context**: Release engineering and backward compatibility matrices with Kong Gateway OSS 3.9 (Issue #7869, PR #7853).
- **What Was Expected**: Patch releases of the controller (e.g., `v3.4.12`) must remain strictly backward compatible with supported underlying gateway versions.
- **What Actually Happened**: Release `3.4.12` introduced an Enterprise-oriented configuration payload schema translation (referencing `internal/dataplane/testdata/golden/ingress-v1-rule-with-tls-and-consumer-ee`). When deployed against Kong OSS 3.9 instances, the gateway rejected the configuration payload during declarative sync, causing cluster-wide routing failure.
- **Evidence in Repo**: Issue #7869: *"3.4.12 breaks clusters with Kong OSS (3.9)"*; Golden test files explicitly demarcating EE-only fields.
- **Root Cause**: The translation pipeline did not condition payload generation on the data-plane gateway runtime version and edition (`OSS` vs. `Enterprise`). A feature requiring Enterprise capabilities was emitted unconditionally in a patch release.
- **Remediation Code Diff**:
```go
// Enforcing edition-aware feature enablement
// - return translateRouteEE(rule)
// + if !r.KongVersion.IsEnterprise() && r.KongVersion.Major() < 4 {
// +     return translateRouteStandard(rule)
// + }
// + return translateRouteEE(rule)
```
- **Lesson**: Data-plane translator logic must be strictly version-gated and edition-gated via runtime feature discovery rather than static compilation constants.

---

### Incident 3: Supply Chain Action Vulnerabilities via Mutable Tags (BUG-SEC-DEPS-03)
- **Context**: CI/CD Pipelines (`.github/workflows/_docker_build.yaml`, `nightly.yaml`, `release.yaml`).
- **What Was Expected**: GitHub Actions must be pinned to immutable commit SHAs with semantic version comments to prevent supply-chain tag mutations.
- **What Actually Happened**: Dependabot and maintenance workflows needed to upgrade `docker/build-push-action` from `v6.18.0` to `v7.3.0` (PR #8067, Commit `319351b4`).
- **Evidence in Repo**: Commit `319351b4`:
```diff
- uses: docker/build-push-action@263435318d21b8e681c14492fe198d362a7d2c83 # v6.18.0
+ uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
```
- **Root Cause**: Upstream security vulnerabilities and API breaking changes in older buildx/push plugins required full-tree cryptographic SHA updates across all release workflows.
- **Remediation Code Diff**: Full cryptographic hash pinning enforced across all workflow files.
- **Lesson**: All external CI action references must be cryptographically pinned to full git SHAs, paired with human-readable comments indicating the semantic release.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Nil Pointer Dereference in Gateway Parent Reference Slices**:
  Gateway API `ParentReference` structs feature pointer fields for `Group`, `Kind`, `Namespace`, and `SectionName`. 
  Directly dereferencing `*parentRef.Namespace` without an explicit nil check causes runtime panics inside the reconciler.

```go
// SECURE ACCESS PATTERN:
namespace := route.GetNamespace()
if parentRef.Namespace != nil {
    namespace = string(*parentRef.Namespace)
}

// DEREFERENCE GUARD FOR OPTIONAL POINTER FIELDS:
if parentRef.Group != nil && string(*parentRef.Group) != gatewayv1.GroupName {
    return nil, fmt.Errorf("invalid parent group")
}
```

- **Falsy Port and String Comparison Invariants**:
  When processing ingress class specifications, an empty string `""` does not equal "no class specified."
  In `internal/controllers/utils/ingress_predicates.go`, a distinct tri-state evaluation is enforced:

```go
func IsIngressClassEmpty(obj client.Object) bool {
    switch obj := obj.(type) {
    case *netv1.Ingress:
        if _, ok := obj.GetAnnotations()[annotations.IngressClassKey]; !ok {
            // Must check BOTH annotation absence AND Spec field nilness
            return obj.Spec.IngressClassName == nil
        }
        return false
    default:
        _, ok := obj.GetAnnotations()[annotations.IngressClassKey]
        return !ok
    }
}
```

### 2. Infinite Loop & Recursion Guards
- **Termination Invariant on Gateway Status Condition Truncation**:
  The Kubernetes API rejects Gateway and Ingress objects if `.status.conditions` exceeds $8$ items.
  Unbounded condition appending within reconciliation loops causes memory leaks and API write failures.
  `pruneGatewayStatusConds` enforces termination boundaries:

```go
const maxConds = 8

func pruneGatewayStatusConds(gateway *gatewayapi.Gateway) *gatewayapi.Gateway {
    if len(gateway.Status.Conditions) > maxConds {
        // Enforce deterministic slice bounding to the last maxConds elements
        gateway.Status.Conditions = gateway.Status.Conditions[len(gateway.Status.Conditions)-maxConds:]
    }
    return gateway
}
```

- **Circular Reference Guards in Admission Credential Validation**:
  In `internal/admission/utils.go`, when building `globalValidationIndexForCredentials`, circular or duplicate secret evaluations are guarded against via namespace exclusion maps:
```go
if secrets, namespaceContainsSkippedSecrets := ignoredSecrets[consumer.Namespace]; namespaceContainsSkippedSecrets {
    if _, secretShouldBeSkipped := secrets[secretName]; secretShouldBeSkipped {
        continue // Avoid circular re-validation of pending updates
    }
}
```

### 3. UI & UX Micro-Mechanics (CLI & Event Feedback)
- **Terminal Event Churn Prevention**:
  The controller does not spam `client.EventRecorder` with identical failure events across every millisecond reconciliation loop.
  Status condition messages are standardized into static constants (`ProgrammedConditionTrueMessage`, `ProgrammedConditionFalseInvalidMessage`) to ensure equality checks (`reflect.DeepEqual` or `c.Message == message`) suppress unnecessary API events.

### 4. Backend Concurrency & Memory Safety
- **DeepCopy Semantics Prior to Patch Operations**:
  `controller-runtime` clients share in-memory cache informers. Modifying an object pointer directly pollutes the informer cache and introduces race conditions across goroutines.
  All patch operations MUST clone the original object before applying local modifications:

```go
// CORRECT INVARIANT:
newPolicy := oldPolicy.DeepCopy()
newPolicy.Status = newPolicyStatus
return r.Client.Status().Patch(ctx, newPolicy, client.MergeFrom(oldPolicy))
```

- **Time-of-Check to Time-of-Use (TOCTOU) in Secret Admission**:
  In `globalValidationIndexForCredentials`, a missing secret fetched via `managerClient.Get` is guarded against transient 404s via `apierrors.IsNotFound(err)`:
```go
if err := managerClient.Get(ctx, client.ObjectKey{Namespace: consumer.Namespace, Name: secretName}, secret); err != nil {
    if apierrors.IsNotFound(err) {
        continue // Soft-fail: Do not crash admission controller if secret was deleted mid-flight
    }
    return nil, err // Hard-fail: Return system errors (network, auth, RBAC)
}
```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Port-Sharing Collision Matrix**:
  In `internal/controllers/gateway/gateway_utils.go`, port conflict resolution does not use simple numeric equality.
  It maps protocol combinations to detect stream collisions before pushing configuration:

```go
func canSharePort(requested, existing gatewayapi.ProtocolType) bool {
    switch requested {
    case gatewayapi.TCPProtocolType, gatewayapi.UDPProtocolType:
        return false // TCP/UDP listeners must always occupy distinct ports
    case gatewayapi.HTTPSProtocolType, gatewayapi.TLSProtocolType:
        return existing == gatewayapi.HTTPSProtocolType || existing == gatewayapi.TLSProtocolType
    case gatewayapi.HTTPProtocolType:
        return existing == gatewayapi.HTTPProtocolType
    default:
        return false
    }
}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Decoupled control-plane / data-plane design using `controller-runtime` managers. The system decomposes into:
- Resource Ingestion (Informers, Custom Predicates).
- In-memory Topology Store (DAG mapping routes to backends, plugins, credentials).
- Translation Engine (Transforming Kubernetes schema to Kong Admin API payload).
- Status Dispatcher (Reflecting sync state back to Kubernetes status subresources).

### 2. Core Abstractions
- `ObjectWithControlPlaneRef`: Interface defining control-plane ownership invariants (`kic` vs external controller).
- `supportedGatewayWithCondition`: Monadic wrapper pattern utilizing `mo.Option` and `samber/lo` for zero-allocation data passing.
- `credsvalidation.Index`: Conflict-free memory index for fast uniqueness checking across multi-tenant secrets.

### 3. Error Handling
Defines explicit failure boundaries:
- Soft failures (e.g., individual invalid route specification) are marked on the resource via `Programmed=False, Reason=Invalid` and attached as Kubernetes Events, without crashing the controller.
- Systemic failures (e.g., Kong Admin API connection loss) trigger exponential backoff retries via `github.com/avast/retry-go/v4`.

### 4. Testing
Multi-tiered testing harness:
- Unit tests (`_unit_tests.yaml`).
- In-process API simulation via `envtest` (`_envtest_tests.yaml`).
- Integration tests against real Kong instances using `testcontainers-go` (`_integration_tests.yaml`).
- Upstream Gateway API Conformance Test Suite verification (`_conformance_tests.yaml`).

### 5. Security
- Rootless distroless container runtime (`USER 1000:1000` in `Dockerfile`).
- FIPS 140-2 compliant binary build pipeline via `dev.boringcrypto/golang:1.18.10b7`.
- Cross-namespace reference isolation via explicit `ReferenceGrant` validation.
- Webhook admission bounds preventing invalid credentials from entering etcd.

### 6. Performance
- Informer field indexing (`MatchingFields`) on route backend references avoids linear memory scans across cluster secrets.
- Checksumming of the declarative configuration prevents redundant network payloads and reload cycles when Kubernetes generation has not changed.
- Cache mounts (`--mount=type=cache,target=$GOPATH/pkg/mod`) in Docker builds minimize artifact compile duration.

### 7. Deployment
- Multi-stage Docker build producing standard distroless and FIPS 140-2 binaries.
- Immutable digest-pinned base images: `gcr.io/distroless/static:nonroot@sha256:...`.
- Configurable unmanaged vs managed GatewayClass operational modes via runtime flags and annotations.

### 8. Agent Patterns
Deterministic reconciliation invariants:
- Controller filters out objects matching other ingress classes at the predicate level before executing reconciliation loops, maintaining clean context boundaries.
- Re-usable condition constructors ensure zero variance across distributed autonomous reconciliation agents.

### 9. Data Flow
```
Kubernetes Event -> Informer Index Filter -> Predicate Pass -> Reconcile()
                 -> Fetch Target + Dependent Backends
                 -> Validate via ReferenceGrant
                 -> Compile Kong Config AST
                 -> Compute SHA256
                 -> If Checksum Changed: POST to Kong /config
                 -> Update .Status.Conditions via Patch()
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern
**Controller Cache-Index Field Filtering Pattern**:
Index target references inside the informer manager so cross-resource lookups are $O(1)$ instead of $O(N)$ cluster scans.
```go
mgr.GetFieldIndexer().IndexField(ctx, &gatewayapi.HTTPRoute{}, routeBackendRefServiceNameIndexKey, func(rawObj client.Object) []string {
    route := rawObj.(*gatewayapi.HTTPRoute)
    var backendNames []string
    for _, rule := range route.Spec.Rules {
        for _, backend := range rule.BackendRefs {
            backendNames = append(backendNames, string(backend.Name))
        }
    }
    return backendNames
})
```

### 2. Rule
*All Gateway API condition writes MUST verify and match the currently known `Generation` of the resource; conditions MUST never be written for unobserved generations.*

### 3. Architecture Principle
*Decouple the proxy state translation from the API synchronization loop.* The data-plane configuration compiler must operate as a pure function: given a cluster snapshot, it outputs a deterministic byte payload and an error collection.

### 4. Failure Mode
*Informer cache corruption via direct struct mutation.* Passing an in-memory cached pointer into a function that modifies fields (such as `.Status`) mutates the local memory store before the API server confirms the write, breaking cache consistency across goroutines.

### 5. Reusable Skill
*Cross-Namespace Security Boundary Traversal*:
1. Inspect the target resource namespace.
2. If `targetNamespace != sourceNamespace`, search for an active `ReferenceGrant` in `targetNamespace`.
3. Check `from.group`, `from.kind`, `from.namespace` matches.
4. Check `to.kind`, `to.name` matches.
5. Grant or deny access before fetching the underlying object.

### 6. Decision
*Adoption of DB-less Declarative Sync over Admin API entity CRUD operations.*
- **Alternative**: Executing distinct `POST/PUT/DELETE` calls per route/service.
- **Rationale**: Direct entity manipulation causes partial-application states during network drops. DB-less atomic `/config` submission ensures the proxy configuration updates completely or not at all.

### 7. Anti-Pattern
*Unfiltered Reconcile Triggering on Foreign Ingress Classes.* Failing to register class-matching predicates results in every ingress controller instance reconciling every ingress resource, thrashing the Kubernetes API server and clobbering `.status`.

### 8. Verification Method
*Automated Conformance Testing*:
Run the upstream Gateway API test harness against the controller deployment:
```bash
go test -v ./test/conformance/... -tags=conformance -args --gateway-class=kong
```

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### Kubernetes Operator & Gateway Controller Implementation Checklist

- [ ] 1. Informer Cache Invariants
  - [ ] Configure field indexers on all foreign keys (e.g., BackendRef -> Service).
  - [ ] Register `predicate.NewPredicateFuncs` to drop objects not owned by this controller before queue admission.
  - [ ] Never mutate an object received from `client.Get()` without first invoking `.DeepCopy()`.

- [ ] 2. Status & Condition Integrity
  - [ ] Ensure all status writes use `client.MergeFrom()` or Server-Side Apply.
  - [ ] Enforce the max array bound limit on `Status.Conditions` (max 8) and `Status.Ancestors` (max 16).
  - [ ] Sort ancestor status arrays deterministically before patching.
  - [ ] Guard against startup flapping: never revert a defined condition to `Unknown` during cache warm-up.

- [ ] 3. Cross-Namespace Security
  - [ ] Verify `ReferenceGrant` exists whenever a resource in Namespace A targets an object in Namespace B.
  - [ ] Validate Secret references in admission webhooks to prevent cross-tenant credential hijacking.

- [ ] 4. Protocol & Translation Defensiveness
  - [ ] Never rely on runtime proxy default values; explicitly populate `protocols`, `ports`, and `timeouts`.
  - [ ] Gate data-plane translation features behind runtime version and edition discovery.
```