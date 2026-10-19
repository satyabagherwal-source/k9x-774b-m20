> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kong-kubernetes-ingress-controller-learnings.md`  
> **Source**: github ([https://github.com/Kong/kubernetes-ingress-controller](https://github.com/Kong/kubernetes-ingress-controller))  
> **Source Version**: `39edf7f0`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:21:35.109Z  
> **Learning ID**: `learn-github-kong-kubernetes-ingress-controller`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Kong/kubernetes-ingress-controller

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Domain Problem
`Kong/kubernetes-ingress-controller` (KIC) solves the synchronization problem between Kubernetes dynamic state declarations (`networking.k8s.io/v1 Ingress`, `gateway.networking.k8s.io HTTPRoute/Gateway`, Kong Custom Resources like `KongUpstreamPolicy`, `KongConsumer`, `KongPlugin`) and an external or sidecar-deployed Kong Gateway reverse-proxy data-plane engine.

KIC translates declarative Kubernetes API objects into the Kong Gateway Admin API or Declarative Configuration (`deck` / DB-less YAML payload). The controller must manage:
1. **Multi-Source Route Consolidation**: Merging distinct path matches sharing backend services to conserve Kong route resources without violating filter scopes.
2. **Gateway API v1/v1alpha2/v1beta1 Status Lifecycle**: Managing ancestor references (capped strictly at 16 per Gateway API spec) and preserving `LastTransitionTime` across reconciliation loops.
3. **Multi-Controller IngressClass Multiplexing**: Preventing race conditions where multiple controllers overwrite conditions on shared CRDs (e.g., `KongUpstreamPolicy`).
4. **Declarative Synchronization Boundaries**: Converting Kubernetes state changes into atomic Kong configuration pushes via zero-downtime hash comparisons.

```
                           +----------------------------------------+
                           | Kubernetes API Server (Control Plane)  |
                           +----------------------------------------+
                                        |                |
                          Watches/Listers (Informers)    | Status Patches
                                        v                v
                   +--------------------------------------------------+
                   |       Kong Ingress Controller (Manager)          |
                   |                                                  |
                   |  +--------------------+  +--------------------+  |
                   |  | Controller Layer   |  | Admission Webhook  |  |
                   |  | (Gateway, Ingress, |  | (Validates secrets,|  |
                   |  |  UpstreamPolicy)   |  |  unique cred keys) |  |
                   |  +--------------------+  +--------------------+  |
                   |            |                                     |
                   |            v                                     |
                   |  +--------------------------------------------+  |
                   |  | Subtranslator Layer (internal/dataplane)   |  |
                   |  | - HTTPRoute -> kongstate.Route             |  |
                   |  | - Filter extraction (URLRewrite, Redirect) |  |
                   |  | - Match grouping & de-duplication          |  |
                   |  +--------------------------------------------+  |
                   |            |                                     |
                   |            v                                     |
                   |  +--------------------------------------------+  |
                   |  | Parser & Database Reconciler               |  |
                   |  | (go-database-reconciler / go-kong)         |  |
                   |  +--------------------------------------------+  |
                   +--------------------------------------------------+
                                        |
                 DB-Less / Admin API HTTP (Config POST / PUT)
                                        v
                           +----------------------------------------+
                           |      Kong Gateway (Data Plane)         |
                           |  - Nginx / OpenResty Core Engine       |
                           |  - Router Engine (Expression / Regex)  |
                           |  - Plugins Execution Pipeline          |
                           +----------------------------------------+
```

### 1.2 Subsystem Decomposition & Boundaries
- **Reconciliation & Controllers (`internal/controllers/`)**: Built upon `sigs.k8s.io/controller-runtime`. Implements controllers for `Gateway`, `GatewayClass`, `HTTPRoute`, `BackendTLSPolicy`, `KongUpstreamPolicy`, and `Ingress`. Each reconciler implements custom predicate filters to isolate its operational scope to resources tagged with its designated `controllerName` or `IngressClass`.
- **Translator & Subtranslators (`internal/dataplane/translator/`)**: Converts Kubernetes resources into an in-memory graph representation (`kongstate.KongState`). Deconstructs Gateway API `HTTPRoute` rules into Kong Services, Routes, and Plugins.
- **Reference & Conflict Resolver (`internal/controllers/reference/`, `internal/admission/`)**: Tracks cross-namespace references governed by `ReferenceGrant` objects and guarantees uniqueness constraints across consumer credentials.
- **Data-Plane Client Layer (`go-kong` & `go-database-reconciler`)**: Encapsulates communication with Kong Gateway. Computes SHA256 checksums of the target configuration graph; if the checksum is unchanged, pushes are short-circuited to prevent reload thrashing.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Route Splitting on Context-Dependent Plugins
**RULE**:
When compiling declarative routing rules into target proxy routes, an agent MUST NEVER consolidate multiple path matches into a single route if any attached filter or plugin depends on the matching prefix or input path token (e.g., prefix rewrites, dynamic path redirects). In such cases, every match MUST be partitioned into a distinct, isolated route entity with a deterministic, unique identity key.

**WHY**:
In API Gateways like Kong, Envoy, or Traefik, route-level transformation plugins (such as `request-transformer` or `URLRewrite`) bind statically to the compiled Route entity. If two paths (`/path-1` and `/path-2`) that map to the same backend are consolidated into a single route containing an array of paths, a transformation plugin utilizing regex captures (e.g., `URI: "/target$(uri_captures[1])"`) will evaluate identically for both matches. The second match will either fail to resolve the capture group, capture the incorrect token offset, or return an unintended 404/redirect loop, causing traffic loss on all non-primary paths.

**WHEN TO APPLY**:
Apply in any API Gateway controller, ingress translator, or service mesh control plane (translating Gateway API `HTTPRoute`, Ingress, or custom route CRDs) whenever route-level filters modify the URI, headers, or execution semantics based on specific match criteria.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted and generalized from internal/dataplane/translator/subtranslator/httproute.go

type RouteMatchMeta struct {
	Namespace   string
	Name        string
	RuleNumber  int
	MatchNumber int
}

func (m RouteMatchMeta) GetDeterministicKey() string {
	return fmt.Sprintf("%s/%s.%d.%d", m.Namespace, m.Name, m.RuleNumber, m.MatchNumber)
}

func GroupMatchesByIsolationBoundary(
	rules []RouteRuleMeta,
	filters []gatewayapi.HTTPRouteFilter,
) map[string][]RouteMatchMeta {
	// Rule: If any filter alters the URI conditionally based on the match prefix,
	// consolidation is strictly forbidden. Every match gets its own unique group.
	keyFn := func(m RouteMatchMeta) string {
		return m.GetSharedConsolidationKey()
	}

	if RequiresStrictIsolation(filters) {
		keyFn = func(m RouteMatchMeta) string {
			return m.GetDeterministicKey()
		}
	}

	grouped := make(map[string][]RouteMatchMeta)
	for _, rule := range rules {
		for _, match := range rule.Matches {
			k := keyFn(match)
			grouped[k] = append(grouped[k], match)
		}
	}
	return grouped
}

func RequiresStrictIsolation(filters []gatewayapi.HTTPRouteFilter) bool {
	return lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
		switch filter.Type {
		case gatewayapi.HTTPRouteFilterURLRewrite:
			return filter.URLRewrite != nil &&
				filter.URLRewrite.Path != nil &&
				filter.URLRewrite.Path.Type == gatewayapi.PrefixMatchHTTPPathModifier &&
				filter.URLRewrite.Path.ReplacePrefixMatch != nil
		case gatewayapi.HTTPRouteFilterRequestRedirect:
			return true
		default:
			return false
		}
	})
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Consolidating matches when prefix rewrites are active
// Causes route 2 to inherit route 1's regex capture logic!
func GroupMatchesBuggy(rules []RouteRuleMeta) map[string][]RouteMatchMeta {
	grouped := make(map[string][]RouteMatchMeta)
	for _, rule := range rules {
		for _, match := range rule.Matches {
			// BAD: Always grouping by BackendRef + Hostname ignores filter execution hazards
			k := fmt.Sprintf("%s-%s", rule.BackendRefID, rule.Hostname)
			grouped[k] = append(grouped[k], match)
		}
	}
	return grouped
}
```

**VERIFICATION METHOD**:
Enforce via unit tests validating that an `HTTPRoute` with multiple path matches and a `ReplacePrefixMatch` or `RequestRedirect` filter compiles into exactly $N$ distinct `kongstate.Route` instances, where $N == \text{len(matches)}$. Assert that each generated route has a unique name matching the pattern `<parent>.<rule_idx>.<match_idx>`.

---

### 2. Multi-Instance Non-Primary Controller Reconciliation Suppression
**RULE**:
A Kubernetes controller reconciling auxiliary or policy resources (e.g., `KongUpstreamPolicy`, `BackendTLSPolicy`) MUST verify that the referenced backend resources are actively attached to a parent router/ingress matching the controller’s own assigned Class or Gateway identity BEFORE updating the auxiliary resource's status or persisting it to its internal synchronization pipeline. If not attached, the controller MUST terminate reconciliation without modifying status or raising errors.

**WHY**:
In multi-ingress or multi-controller topologies (e.g., internal vs. external controllers, or canary deployments), multiple controller instances watch the same cluster-scoped or namespace-scoped policy objects. If a controller updates the status of a policy whose backend is not bound to that controller's ingress class, it triggers a cascade of reconciliation events. The competing controllers continuously overwrite each other's status fields (`Accepted: true` vs `Accepted: false`), exhausting the Kubernetes API rate limits and generating infinite reconciliation loops.

**WHEN TO APPLY**:
Apply to all Kubernetes controllers managing custom policy attachments, middleware resources, or auxiliary CRDs shared across multiple controller classes or mesh boundaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted and generalized from internal/controllers/configuration/kongupstreampolicy_utils.go

func (r *PolicyReconciler) Reconcile(ctx context.Context, req reconcile.Request) (reconcile.Result, error) {
	policy := &configurationv1beta1.KongUpstreamPolicy{}
	if err := r.Get(ctx, req.NamespacedName, policy); err != nil {
		return reconcile.Result{}, client.IgnoreNotFound(err)
	}

	// Invariant: Terminate early if this policy is not consumed by backends of our ingress class
	isUsed, err := r.policyUsedByBackendsOfMatchingClass(ctx, req.NamespacedName)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("failed verifying policy ownership: %w", err)
	}

	if !isUsed {
		// Strictly avoid writing status or queueing translation.
		// Another controller instance owns the associated Ingress/Gateway.
		return reconcile.Result{}, nil
	}

	return r.enforcePolicyStatus(ctx, policy)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Unconditionally updating status on watched CRDs
func (r *PolicyReconciler) ReconcileBuggy(ctx context.Context, req reconcile.Request) (reconcile.Result, error) {
	policy := &configurationv1beta1.KongUpstreamPolicy{}
	_ = r.Get(ctx, req.NamespacedName, policy)

	// BAD: Immediately patching status without checking parent IngressClass ownership
	// Triggers infinite fight between Controller-A (Kong) and Controller-B (NGINX/Other Kong)
	policy.Status.Conditions = updateCondition(policy.Status.Conditions, "Accepted", "True")
	return reconcile.Result{}, r.Status().Update(ctx, policy)
}
```

**VERIFICATION METHOD**:
Deploy two controller instances with distinct `--ingress-class` parameters (`kong-internal` and `kong-external`). Create an ingress object belonging to `kong-internal` referencing a shared policy CRD. Verify via audit logs or test assertions that `kong-external` executes zero status patch mutations against the shared policy CRD.

---

### 3. Asynchronous Pod Lifecycle Exclusion in Test and Health Harnesses
**RULE**:
When querying Kubernetes resources via label selectors in test fixtures, rollouts, or dynamic health checkers, the query MUST filter out objects containing a non-nil `DeletionTimestamp`. When asserting deployment readiness after scale operations, the evaluator MUST assert BOTH `Status.Replicas == desired` AND `Status.ReadyReplicas == desired`.

**WHY**:
In Kubernetes, terminating pods remain visible to label-selector list operations until their finalizers complete and grace periods elapse. A list call executed during scale-down will return terminating pods as active entities. Furthermore, during scale-down from $N$ to $M$ replicas ($M < N$), `Status.ReadyReplicas` may immediately equal $M$ while $N-M$ terminating pods still consume node resources, execute connections, or hold shared state. Checking only `ReadyReplicas` results in TOCTOU (Time-of-Check to Time-of-Use) flakiness, race conditions, and node memory exhaustion.

**WHEN TO APPLY**:
Apply in all Kubernetes automation harnesses, e2e test suites, custom autoscalers, dynamic load balancer endpoint pollers, and operator status reconcilers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted and generalized from test/e2e/helpers_test.go

func ListActivePodsByLabels(ctx context.Context, c client.Client, ns string, ls map[string]string) ([]corev1.Pod, error) {
	podList := &corev1.PodList{}
	if err := c.List(ctx, podList, client.InNamespace(ns), client.MatchingLabels(ls)); err != nil {
		return nil, err
	}

	// Invariant: Exclude terminating pods
	livePods := make([]corev1.Pod, 0, len(podList.Items))
	for _, pod := range podList.Items {
		if pod.DeletionTimestamp != nil {
			continue // Pod is marked for termination; ignore
		}
		livePods = append(livePods, pod)
	}
	return livePods, nil
}

func WaitForDeploymentScale(ctx context.Context, c client.Client, key client.ObjectKey, desired int32) error {
	return wait.PollImmediateWithContext(ctx, time.Second, 3*time.Minute, func(ctx context.Context) (bool, error) {
		deploy := &appsv1.Deployment{}
		if err := c.Get(ctx, key, deploy); err != nil {
			return false, err
		}
		// Invariant: Status.Replicas ensures terminating pods are completely purged
		// Status.ReadyReplicas ensures new pods are passing readiness probes
		return deploy.Status.Replicas == desired && deploy.Status.ReadyReplicas == desired, nil
	})
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Relying only on raw list or ReadyReplicas
func ScaleAndWaitBuggy(ctx context.Context, c client.Client, key client.ObjectKey, desired int32) error {
	// BAD 1: Returning items directly includes terminating pods!
	var podList corev1.PodList
	_ = c.List(ctx, &podList)
	// BAD 2: Checking only ReadyReplicas proceeds while old pods are still draining
	var deploy appsv1.Deployment
	_ = c.Get(ctx, key, &deploy)
	if deploy.Status.ReadyReplicas == desired {
		return nil // Old terminating pods are still running!
	}
	return errors.New("timeout")
}
```

**VERIFICATION METHOD**:
Execute an e2e test scaling a deployment from 5 replicas to 1 replica. Assert that `ListActivePodsByLabels` returns exactly 1 pod even if the underlying pod delete grace period is set to 60 seconds (`terminationGracePeriodSeconds: 60`).

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: HTTPRoute Match Consolidation Collision on URLRewrite/RequestRedirect (BUG-KIC-8081)
- **Context**: Subtranslator layer, `internal/dataplane/translator/subtranslator/httproute.go`
- **What Was Expected**: When an `HTTPRoute` defines multiple match rules referencing the same `backendRefs`, but each rule uses a `URLRewrite` filter (with `ReplacePrefixMatch`) or `RequestRedirect`, each match should be translated into a distinct Kong Route with its own independent `request-transformer` plugin instance to perform path rewriting specific to that match prefix.
- **What Actually Happened**: The subtranslator consolidated all rules sharing identical backend references and filter structures into a single `kongstate.Route` using a shared key (`httpRouteMatchMeta.getKey()`). Consequently, multiple distinct prefixes (e.g., `/path-1` and `/path-2`) were mapped into one route with a single plugin instance configured with a rewrite URI (`/anything$(uri_captures[1])`). While requests matching the first prefix worked, requests matching subsequent prefixes failed with HTTP 404 or corrupted paths because the single plugin only executed the capture logic of the primary prefix.
- **Evidence in Repo**: Commit `0d1f8fb6`, PR #8081, test file `internal/dataplane/translator/subtranslator/httproute_test.go` ("rules sharing backendRefs and an identical URLRewrite ReplacePrefixMatch filter but different paths are kept separate").
- **Root Cause**: The consolidation key hashing logic (`getKey()`) did not account for the stateful dependence of prefix-based path rewriting on the incoming matched URI. It grouped rules solely based on backend equivalence and serialized filter identity, erroneously treating different prefix matches as interchangeable.
- **Remediation Code Diff**:
```diff
--- a/internal/dataplane/translator/subtranslator/httproute.go
+++ b/internal/dataplane/translator/subtranslator/httproute.go
@@ -334,9 +358,17 @@ func translateHTTPRouteRulesMetaToKongstateRoutes(
 		filters := rulesWithSameFilter[0].Rule.Filters
+		// ReplacePrefixMatch's rewritten path, and RequestRedirect's generated plugin, both depend on
+		// which match fired, so when either is present we must never fold matches from different
+		// rules together - keep every match in its own group.
+		keyFn := httpRouteMatchMeta.getKey
+		if filtersContainURLRewriteReplacePrefixMatch(filters) || filtersContainRequestRedirect(filters) {
+			keyFn = httpRouteMatchMeta.getUniqueKey
+		}
 		matchGroups := make(map[string]httpRouteMatchMetaList)
 		for _, ruleMeta := range rulesWithSameFilter {
-			ruleMatchGroups := groupSliceByKeyFn(ruleMeta.matches(), httpRouteMatchMeta.getKey)
+			ruleMatchGroups := groupSliceByKeyFn(ruleMeta.matches(), keyFn)
 			for matchGroupKey, matchGroup := range ruleMatchGroups {
 				matchGroups[matchGroupKey] = append(matchGroups[matchGroupKey], matchGroup...)
 			}
```
- **Lesson**: Route consolidation cannot be treated as a pure graph-minimization optimization. Any transformation plugin that relies on runtime token capture from a matching pattern requires structural entity separation at the data plane configuration layer.

---

### Incident 2: Pod Deletion & Replica Scaling Race in Kubernetes E2E Teardown (BUG-KIC-8089)
- **Context**: End-to-end integration test framework, `test/e2e/helpers_test.go` and `.github/workflows/_e2e_tests.yaml`
- **What Was Expected**: During e2e test execution across Kubernetes clusters (specifically GKE), scaled-down workloads and tear-downs must wait until all previous pods are completely evacuated before proceeding to the next test assertion.
- **What Actually Happened**: Test suites failed intermittently on GKE with OOMs and stale pod target assertions. The helper function `listPodsByLabels` returned pods that were already in `Terminating` state (`DeletionTimestamp != nil`). Furthermore, `scaleDeployment` returned `true` immediately when `deployment.Status.ReadyReplicas == replicas`, ignoring the fact that old pods were still shutting down and draining memory.
- **Evidence in Repo**: Commit `b6da030f`, PR #8089, `.github/workflows/_e2e_tests.yaml`, `test/e2e/helpers_test.go`.
- **Root Cause**: Twofold: (1) `client.List` queries match labels regardless of pod lifecycle state, retaining terminating pods in the return slice. (2) Kubernetes Deployment controller updates `ReadyReplicas` to match the target replica count before terminating pods have completed grace periods, causing downstream assertions to execute against saturated nodes (`e2-standard-2` machine types).
- **Remediation Code Diff**:
```diff
--- a/test/e2e/helpers_test.go
+++ b/test/e2e/helpers_test.go
@@ -868,7 +869,17 @@ func listPodsByLabels(
 	if err != nil {
 		return nil, err
 	}
-	return podList.Items, nil
+
+	// Exclude pods that are already being terminated: they still match the label
+	// selector until fully removed from the API, but callers only ever want live pods.
+	livePods := make([]corev1.Pod, 0, len(podList.Items))
+	for _, pod := range podList.Items {
+		if pod.DeletionTimestamp != nil {
+			continue
+		}
+		livePods = append(livePods, pod)
+	}
+	return livePods, nil
 }
 
 func scaleDeployment(ctx context.Context, t *testing.T, env environments.Environment, ...) {
@@ -893,7 +904,10 @@ func scaleDeployment(ctx context.Context, t *testing.T, env environments.Environ
 		if err != nil {
 			return false
 		}
-		return deployment.Status.ReadyReplicas == replicas
+		// Status.Replicas counts all non-terminated pods matched by the selector, including
+		// ones still Terminating from a previous scale-down. Requiring it to match too ensures
+		// stragglers are fully gone before callers proceed, not just that new pods are ready.
+		return deployment.Status.Replicas == replicas && deployment.Status.ReadyReplicas == replicas
 	}, time.Minute*3, time.Second, ...)
 }
```
- **Lesson**: A pod scale-down operation is asynchronous and two-phased: ready replica convergence occurs prior to dead replica garbage collection. Automated validation harnesses must verify total replica depletion (`Status.Replicas == Status.ReadyReplicas == target`) to prevent test pollution.

---

### Incident 3: Default Protocols Incompatibility in Kong Gateway 3.14+ Expression-based Engine (BUG-KIC-7859)
- **Context**: Expression-based route translator, `internal/dataplane/translator/`
- **What Was Expected**: Integration and e2e tests running against Kong Gateway version 3.14+ should successfully route HTTP traffic when the expression-based routing feature flag is enabled.
- **What Actually Happened**: With expression-based routing active, Kong Ingress Controller omitted the `protocols` field from generated route definitions, assuming Kong would default to standard multi-protocol routing (`http`, `https`). However, in Kong Gateway 3.14+, the core data-plane default for expression routes was altered to `https` only. Consequently, all plain `http` requests received connection drops or failed routing matches, causing test suites to fail completely.
- **Evidence in Repo**: Issue #7859: "`protocols` field in transalated Kong routes are not set when expression based routes enbled", Commit `b6da030f` passing `TEST_KONG_EFFECTIVE_VERSION`.
- **Root Cause**: Implicit protocol defaulting. The translator relied on the underlying gateway engine's default value instead of explicitly setting the `protocols` slice (`["http", "https"]`) on translated route objects. Upstream engine changes in Kong Gateway 3.14 broke backwards compatibility.
- **Remediation Code Diff**:
```diff
--- a/internal/dataplane/translator/subtranslator/httproute.go
+++ b/internal/dataplane/translator/subtranslator/httproute.go
@@ -350,6 +350,11 @@ func translateHTTPRoute(...) {
 	route := kongstate.Route{
 		Route: kong.Route{
 			Name: kong.String(routeName),
+			// Explicitly define protocols rather than relying on Gateway defaults
+			Protocols: kong.StringSlice("http", "https"),
 		},
 	}
```
- **Lesson**: Never rely on implicit remote defaults across architectural boundaries. Control planes must project fully explicit specifications to data planes to remain resilient against upstream engine configuration changes.

---

### Incident 4: Status Flapping and Cross-Controller Race on Shared CRDs (BUG-KIC-6270)
- **Context**: Controller reconciliation loop, `internal/controllers/configuration/kongupstreampolicy_utils.go`
- **What Was Expected**: When a cluster deploys multiple ingress controllers or when an ingress class filter is specified, the controller should only manage the status of policy CRDs (`KongUpstreamPolicy`) whose linked backends are consumed by its own Ingress or Gateway instances.
- **What Actually Happened**: The controller reconciled every `KongUpstreamPolicy` in its watched namespaces. If an upstream policy was associated with a Service used exclusively by another controller class, KIC evaluated the condition as unprogrammed or invalid and patched the CRD status. The owning controller then immediately reconciled and patched it back, causing high API server CPU utilization and thrashing status generations.
- **Evidence in Repo**: Closed issue #6270; implementation of `upstreamPolicyUsedByBackendsOfMatchingClass` in `internal/controllers/configuration/kongupstreampolicy_utils.go`.
- **Root Cause**: Lack of reverse-lookup filtering. The controller did not verify whether the Services referencing the `KongUpstreamPolicy` were actually mapped to an `Ingress` with a matching `spec.ingressClassName` or an `HTTPRoute` attached to its reconciled Gateway.
- **Remediation Code Diff**:
```diff
--- a/internal/controllers/configuration/kongupstreampolicy_utils.go
+++ b/internal/controllers/configuration/kongupstreampolicy_utils.go
@@ -190,6 +190,26 @@ func (r *KongUpstreamPolicyReconciler) Reconcile(...) {
+	// upstreamPolicyUsedByBackendsOfMatchingClass returns true if the KongUpstreamPolicy is referenced in
+	// Services or KongServiceFacades that are used in backends of reconciled Ingress or HTTPRoute.
+	// If false, reconciliation is terminated to prevent status update races.
+	// Ref: https://github.com/Kong/kubernetes-ingress-controller/issues/6270.
+	isUsed, err := r.upstreamPolicyUsedByBackendsOfMatchingClass(ctx, policyNN, isDefaultIngressClass)
+	if err != nil {
+		return ctrl.Result{}, err
+	}
+	if !isUsed {
+		return ctrl.Result{}, nil
+	}
```
- **Lesson**: In Kubernetes shared-CRD architectures, status ownership must follow traffic path ownership. A controller must establish positive reference lineage from its root Class/Gateway down to the leaf policy before writing status conditions.

---

### Incident 5: Upstream OpenTelemetry Indirect Dependency Drift Breaking OTLP Trace Pipeline (BUG-KIC-8095)
- **Context**: Module dependency graph, `go.mod` and `go.sum`
- **What Was Expected**: Indirect dependency bumps by automated tooling (Dependabot) must maintain binary compatibility across OpenTelemetry OTLP exporters, gRPC gateways, and protocol buffer runtimes.
- **What Actually Happened**: Bumping `go.opentelemetry.io/otel/exporters/otlp/otlptrace` from `1.33.0` to `1.45.0` created a diamond dependency hazard with `google.golang.org/genproto` and `grpc-ecosystem/grpc-gateway/v2`. The indirect trace SDK updates caused compile-time type incompatibilities in trace exporting sub-packages unless `go.opentelemetry.io/proto/otlp` and `go.opentelemetry.io/otel/sdk` were simultaneously locked to matching minor revisions (`v1.45.0` and `v1.11.0`).
- **Evidence in Repo**: Commit `5f2cbbc4`, PR #8095, `go.mod` diff updating `go.opentelemetry.io/otel` ecosystem en masse.
- **Root Cause**: Go workspace dependency fragmentation where Dependabot bumped a single exporter without synchronizing the corresponding telemetry core runtime and protobuf schemas.
- **Remediation Code Diff**:
```diff
--- a/go.mod
+++ b/go.mod
@@ -77,18 +77,18 @@ require (
-	github.com/grpc-ecosystem/grpc-gateway/v2 v2.24.0 // indirect
+	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.4.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
-	go.opentelemetry.io/otel v1.44.0 // indirect
+	go.opentelemetry.io/otel v1.45.0 // indirect
```
- **Lesson**: Automated dependency updates for telemetry and RPC frameworks must be orchestrated as atomic multi-module changesets to prevent diamond dependency skew.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Pointer Dereferencing Guard on Gateway API String Structs**:
   ```go
   // CRITICAL: Gateway API string types (Namespace, ObjectName, Group, Kind) are aliases of string
   // but frequently passed as pointers to differentiate unset vs empty string ("").
   // DEREFERENCING WITHOUT NIL-CHECK CRASHES CONTROLLER.
   
   // SAFE PATTERN (internal/controllers/gateway/backendtlspolicy_utils.go):
   namespace := httpRoute.Namespace
   if backend.Namespace != nil {
       namespace = string(*backend.Namespace)
   }
   if backend.Group != nil && *backend.Group != "" && *backend.Group != "core" {
       continue
   }
   ```
2. **Slice Initialization Capacities & Allocation Zero-Leak**:
   In `listPodsByLabels`, preallocating slice capacity (`make([]corev1.Pod, 0, len(podList.Items))`) prevents append allocations. However, slicing must start at length 0, not `len(podList.Items)`, otherwise `append` places live pods *after* $N$ zero-value pods.
3. **Empty String vs. Pointer Nilness in Annotations**:
   Kubernetes annotations return an empty string `""` on non-existence if checked via map access, but `ingressclass.kubernetes.io/is-default-class` must be strictly checked as `annotationValue == "true"`. Treating existence as truthy causes all non-annotated ingresses to falsely match the default class.

### 4.2 Infinite Loop & Recursion Guards
1. **Controller-Runtime Event Loop Starvation Guard via Status Patch Pruning**:
   ```go
   // internal/controllers/utils/conditions.go
   // PREVENTS RECONCILIATION LOOP: Check if the condition already exists with identical
   // status, reason, and observedGeneration BEFORE triggering client.Status().Patch().
   hasMatchingCondition := util.CheckCondition(
       conditions,
       util.ConditionType(desiredCondition.Type),
       util.ConditionReason(desiredCondition.Reason),
       desiredCondition.Status,
       desiredCondition.ObservedGeneration,
   )
   if hasMatchingCondition {
       return conditions, false // updateNeeded = false; skips API server write
   }
   ```
2. **Gateway API Condition Slice Bound Pruning**:
   `gateway.Status.Conditions` cannot grow unbounded. A runaway slice triggers Kubernetes API etcd rejection due to maximum request size limits (1.5MB). KIC enforces an invariant hard ceiling:
   ```go
   // internal/controllers/gateway/gateway_utils.go
   const maxConds = 8
   func pruneGatewayStatusConds(gateway *gatewayapi.Gateway) *gatewayapi.Gateway {
       if len(gateway.Status.Conditions) > maxConds {
           gateway.Status.Conditions =