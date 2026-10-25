> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kumahq-kuma-learnings.md`  
> **Source**: github ([https://github.com/kumahq/kuma](https://github.com/kumahq/kuma))  
> **Source Version**: `c0ee7238`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T08:56:55.236Z  
> **Learning ID**: `learn-github-kumahq-kuma`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): kumahq/kuma

---

## 1. Executive Forensic Architecture & System Mechanics

Kuma is an enterprise-grade, multi-zone, multi-mesh control plane built for Envoy proxies across Kubernetes and Universal (VM/bare-metal) environments. At its core, Kuma solves the problem of decoupled policy specification versus real-time Envoy Dynamic Discovery Service (xDS v3) configuration convergence across distributed boundaries.

```
                    +-----------------------------------------+
                    |       Global Control Plane (Kuma CP)    |
                    |   (DB/CRD Storage, Policy Convergence)  |
                    +--------------------+--------------------+
                                         |
                       Kuma Discovery Service (KDS / gRPC)
                                         |
                    +--------------------+--------------------+
                    |        Zone Control Plane (Kuma CP)     |
                    | (Local Ingress/Egress, DNS Resolution)   |
                    +---------+---------------------+---------+
                              |                     |
                   Envoy xDS (gRPC L4/L7)       Envoy xDS (gRPC L4/L7)
                              |                     |
                     +--------v-------+    +--------v-------+
                     | Sidecar Proxy  |    | Sidecar Proxy  |
                     |  (App Pod A)   |    |  (App Pod B)   |
                     +----------------+    +----------------+
```

### Critical Subsystem Boundaries and Mechanics

1. **Topology Separation (Global vs. Zone Control Plane)**:
   - *Global Control Plane*: Owns the system of record (PostgreSQL or Kubernetes CRDs across the entire estate). It synchronizes global policies to Zone control planes using KDS (Kuma Discovery Service, an Envoy xDS-derived protocol). It does not directly manage Envoy sidecars or resolve zone-local DNS hostnames.
   - *Zone Control Plane*: Connects directly to Envoy dataplane proxies via standard Envoy xDS (ADS, CDS, LDS, RDS, EDS). It resolves endpoint IP addresses, computes localized policies (e.g., `MeshTrafficPermission`, `MeshTimeout`), and manages zone-ingress/zone-egress proxies.

2. **Policy Merging and Evaluation Pipeline**:
   - High-level intent policies (`MeshTrafficPermission`, `MeshRoute`, `MeshRetry`) are transformed into intermediate configuration objects (`inbound.Rule`, `outbound.Rule`).
   - Envoy evaluation semantics require strict ordering: Envoy RBAC filters evaluate field matchers sequentially and terminate evaluation at the first match. The control plane must merge mesh-wide, namespace-scoped, and service-scoped rules such that `DENY` policies always precede `ALLOW` policies, preventing authorization bypasses caused by broad matching scopes.

3. **Runtime Abstraction (`pkg/core/runtime`)**:
   - Enforces a unified component lifecycle across heterogeneous hosting environments. Core components (`ResourceManager`, `LeaderElector`, `MetricsEngine`, `MeshContextBuilder`) run identically whether backed by Kubernetes API client-go or Universal PostgreSQL drivers (`pgx/v5`).

4. **Transparent Proxying and CNI Injection Subsystem (`app/cni`)**:
   - Runs as a DaemonSet node agent. It inspects Linux procfs to intercept socket traffic, dynamically programs iptables/nftables via netlink, and routes ingress/egress through the Envoy sidecar. Strict separation is maintained between stdout (reserved for CNI JSON runtime contracts) and stderr (reserved for diagnostic logging).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Evaluation Preservation in Shadowed Policy Compilers
**RULE**:
When compiling split-pipeline authorization configurations into first-match-wins rule evaluation engines (such as Envoy RBAC or iptables), every permission classification (`DENY`, `ALLOW`, `SHADOW_DENY`) MUST preserve exact policy hierarchy across all parallel matcher lists. Specifically, a shadow enforcement pipeline MUST NOT evaluate unshadowed allow-rules as implicitly denied fallthroughs; explicit `ALLOW` matchers MUST be projected into the shadow evaluation pipeline beneath the `SHADOW_DENY` rules.

**WHY**:
In first-match-wins engines, rule ordering dictates authorization. If a shadow pipeline only registers `SHADOW_DENY` matchers with a default `DENY` fallthrough (`onNoMatch`), any client explicitly permitted by an `ALLOW` rule will bypass the shadow deny rules, fail to match any shadow allow rule, hit the `onNoMatch` fallthrough, and be incorrectly reported as shadow-denied. This corrupts audit metrics, generates false-positive alerts, and causes operational outages during dry-run validations.

**WHEN TO APPLY**:
Applies to any firewall, service mesh RBAC, API gateway policy compiler, or declarative authorization engine where policies support audit/dry-run/shadow modes alongside active enforcement.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package rbac

import (
	"slices"
	matcher_config "github.com/cncf/xds/go/xds/type/matcher/v3"
	rbac_config "github.com/envoyproxy/go-control-plane/envoy/config/rbac/v3"
)

type RuleConf struct {
	Allow               *[]Match
	Deny                *[]Match
	AllowWithShadowDeny *[]Match
}

// InboundRule encapsulates policy origins and configuration blocks
type InboundRule struct {
	Conf   RuleConf
	Origin string
}

type RBACConfigurer struct {
	InboundRules []*InboundRule
}

// createMatcher generates active enforcement rules:
// Active DENY = conf.Deny
// Active ALLOW = conf.Allow + conf.AllowWithShadowDeny (still allowed actively)
func (c *RBACConfigurer) createMatcher() (*matcher_config.Matcher, error) {
	return c.buildMatcher(
		func(conf RuleConf) []Match {
			return derefSlice(conf.Deny)
		},
		func(conf RuleConf) []Match {
			return slices.Concat(derefSlice(conf.Allow), derefSlice(conf.AllowWithShadowDeny))
		},
	)
}

// createShadowMatcher mirrors active matching with AllowWithShadowDeny promoted to DENY.
// Callers matched ONLY by conf.Allow MUST be explicitly registered as ALLOW in the shadow matcher
// to prevent falling through to the default onNoMatch DENY action.
func (c *RBACConfigurer) createShadowMatcher() (*matcher_config.Matcher, error) {
	hasShadowDeny := slices.ContainsFunc(c.InboundRules, func(rule *InboundRule) bool {
		return rule.Conf.AllowWithShadowDeny != nil
	})
	if !hasShadowDeny {
		return nil, nil
	}

	return c.buildMatcher(
		func(conf RuleConf) []Match {
			// In shadow mode: both real Deny and AllowWithShadowDeny are treated as DENY
			return slices.Concat(derefSlice(conf.Deny), derefSlice(conf.AllowWithShadowDeny))
		},
		func(conf RuleConf) []Match {
			// In shadow mode: pure Allow remains ALLOW to shield valid callers from fallback DENY
			return derefSlice(conf.Allow)
		},
	)
}

func (c *RBACConfigurer) buildMatcher(
	denyFunc, allowFunc func(RuleConf) []Match,
) (*matcher_config.Matcher, error) {
	var fieldMatchers []*matcher_config.Matcher_MatcherList_FieldMatcher

	// Invariant: All DENY rules MUST precede ALLOW rules across the entire merged rule set
	for _, rule := range c.InboundRules {
		denies := denyFunc(rule.Conf)
		if len(denies) > 0 {
			matchers, err := buildMatchers(denies, rbac_config.RBAC_DENY, rule.Origin)
			if err != nil {
				return nil, err
			}
			fieldMatchers = append(fieldMatchers, matchers)
		}
	}

	for _, rule := range c.InboundRules {
		allows := allowFunc(rule.Conf)
		if len(allows) > 0 {
			matchers, err := buildMatchers(allows, rbac_config.RBAC_ALLOW, rule.Origin)
			if err != nil {
				return nil, err
			}
			fieldMatchers = append(fieldMatchers, matchers)
		}
	}

	return assembleEnvoyMatcherList(fieldMatchers)
}

func derefSlice[T any](s *[]T) []T {
	if s == nil {
		return nil
	}
	return *s
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Shadow pipeline only evaluates the shadow-denied items
// and fails to register explicit allows before the default onNoMatch DENY fallthrough!
func (c *RBACConfigurer) createShadowMatcherBROKEN() (*matcher_config.Matcher, error) {
	var fieldMatchers []*matcher_config.Matcher_MatcherList_FieldMatcher
	for _, rule := range c.InboundRules {
		if rule.Conf.AllowWithShadowDeny == nil {
			continue
		}
		// BUG: Only AllowWithShadowDeny is added.
		// A caller that is in `rule.Conf.Allow` will NOT match this list,
		// will drop to OnNoMatch(RBAC_DENY), and will trigger false positive shadow violation alerts!
		m, _ := buildMatchers(*rule.Conf.AllowWithShadowDeny, rbac_config.RBAC_DENY, rule.Origin)
		fieldMatchers = append(fieldMatchers, m)
	}
	return assembleEnvoyMatcherListWithDefaultDeny(fieldMatchers)
}
```

**VERIFICATION METHOD**:
Run unit/property tests asserting that a principal in `Allow` evaluated against `shadowMatcher` returns `ALLOW` instead of the default `DENY`. Verify through golden file generation that the output xDS JSON contains an `onMatch` block with `action: ALLOW` matching the principal's SPIFFE ID within the `shadowMatcher.matcherList.matchers` array.

---

### 2. Environment-Aware Upstream Resolution Decoupling
**RULE**:
Control plane components that operate above execution dataplane domains (e.g., Global Control Planes, Multi-Cluster Orchestrators, Aggregators) MUST NOT perform network I/O or DNS address resolutions for domain resources owned by remote downstream child execution environments. Hostnames and addresses belonging to remote zones MUST be preserved as verbatim strings without local resolution attempts.

**WHY**:
1. Remote zone hostnames (e.g., internal Kubernetes `.cluster.local` names or cloud VPC private DNS endpoints) are unresolvable from a global management plane running in a separate network perimeter.
2. Synchronous or retried DNS lookups (`net.LookupIP`) on unresolvable hosts block the resource serialization worker thread, saturate OS DNS resolver threads, fill logs with bogus `no such host` errors, and induce severe control plane latency or memory pressure.

**WHEN TO APPLY**:
Applies to distributed systems where a management plane processes metadata containing target network addresses meant for downstream or peripheral execution nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package context

import (
	"context"
	"net"
)

type MeshContextBuilderOption func(*meshContextBuilder)

type meshContextBuilder struct {
	rm                     ResourceManager
	skipAddressResolution  bool
	dnsLookup              func(host string) ([]net.IP, error)
}

// WithoutAddressResolution disables DNS translation, keeping hostnames raw.
func WithoutAddressResolution() MeshContextBuilderOption {
	return func(m *meshContextBuilder) {
		m.skipAddressResolution = true
	}
}

func (m *meshContextBuilder) fetchResourceList(ctx context.Context, resType ResourceType) (ResourceList, error) {
	list := m.rm.NewList(resType)
	if err := m.rm.List(ctx, list); err != nil {
		return nil, err
	}

	// Architectural Invariant: If resolution is disabled, return early without
	// touching DNS resolvers or processing socket addresses.
	if m.skipAddressResolution || (resType != DataplaneType && resType != MeshZoneAddressType) {
		return list, nil
	}

	return m.resolveResourceAddresses(ctx, list)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Unconditionally resolving addresses on all control plane tiers
func (m *meshContextBuilder) fetchResourceListBROKEN(ctx context.Context, resType ResourceType) (ResourceList, error) {
	list := m.rm.NewList(resType)
	_ = m.rm.List(ctx, list)

	// BUG: Executes on Global CP where "backend.dns.name" does not exist in local DNS.
	// Will block for DNS timeout (e.g., 5s), fail, log error, or crash snapshot synthesis.
	for _, item := range list.GetItems() {
		ips, err := net.LookupIP(item.GetAddress())
		if err != nil {
			log.Error(err, "failed to resolve host", "host", item.GetAddress())
		}
		item.SetIP(ips[0].String())
	}
	return list, nil
}
```

**VERIFICATION METHOD**:
Implement a mock DNS lookup function that increments an atomic invocation counter and returns an error. Construct a context builder configured with `WithoutAddressResolution()`, invoke `Build()`, and assert using Ginkgo/Gomega:
```go
Expect(lookupsCount).To(BeZero())
Expect(dataplane.Spec.GetNetworking().GetAddress()).To(Equal("backend.dns.name"))
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Policy Inversion in RBAC Shadow Matcher Evaluation (BUG-KUMA-01)
- **Context**: `pkg/plugins/policies/meshtrafficpermission/xds/rbac_configurer.go`
- **What Was Expected**: When `MeshTrafficPermission` configures `allowWithShadowDeny`, traffic matching the rule should be actively permitted, but recorded as denied in shadow metrics. Conversely, traffic matched by existing `allow` rules should remain shadow-allowed.
- **What Actually Happened**: The `createShadowMatcher` method constructed a shadow matcher containing *only* the `AllowWithShadowDeny` entries with a fallback `onNoMatch: DENY`. As a result, callers matched exclusively by standard `Allow` rules were dropped into `onNoMatch: DENY` in the shadow matcher, generating false shadow violations and polluting observability metrics.
- **Evidence in Repo**: Commit `3b84ea2f`, PR #19173, golden file updates in `matching-api.golden.yaml` and `rbac_configurer_test.go`.
- **Root Cause**: The shadow matcher failed to replicate the full active matcher structure. It treated shadow inspection as an isolated match list instead of a complete authorization pipeline mirror where `AllowWithShadowDeny` is converted to `DENY` while pure `Allow` rules remain `ALLOW`.
- **Remediation Code Diff**:
```go
// pkg/plugins/policies/meshtrafficpermission/xds/rbac_configurer.go
-func (c *RBACConfigurer) createMatcher() (*matcher_config.Matcher, error) {
+func (c *RBACConfigurer) createMatcher() (*matcher_config.Matcher, error) {
+	return c.buildMatcher(
+		func(conf policies_api.RuleConf) []common_api.Match {
+			return pointer.Deref(conf.Deny)
+		},
+		func(conf policies_api.RuleConf) []common_api.Match {
+			return slices.Concat(pointer.Deref(conf.Allow), pointer.Deref(conf.AllowWithShadowDeny))
+		},
+	)
+}
+
+func (c *RBACConfigurer) createShadowMatcher() (*matcher_config.Matcher, error) {
+	hasShadowDeny := slices.ContainsFunc(c.InboundRules, func(rule *inbound.Rule) bool {
+		return rule.Conf.(policies_api.RuleConf).AllowWithShadowDeny != nil
+	})
+	if !hasShadowDeny {
+		return nil, nil
+	}
+	return c.buildMatcher(
+		func(conf policies_api.RuleConf) []common_api.Match {
+			return slices.Concat(pointer.Deref(conf.Deny), pointer.Deref(conf.AllowWithShadowDeny))
+		},
+		func(conf policies_api.RuleConf) []common_api.Match {
+			return pointer.Deref(conf.Allow)
+		},
+	)
+}
-func (c *RBACConfigurer) createShadowMatcher() (*matcher_config.Matcher, error) {
-	var fieldMatchers []*matcher_config.Matcher_MatcherList_FieldMatcher
-	for _, rule := range c.InboundRules {
-		conf := rule.Conf.(policies_api.RuleConf)
-		if conf.AllowWithShadowDeny == nil { continue }
-		shadowDenyMatchers, err := buildMatchers(pointer.Deref(conf.AllowWithShadowDeny), rbac_config.RBAC_DENY, rule.Origin)
-		fieldMatchers = append(fieldMatchers, shadowDenyMatchers)
-	}
-	return bldrs_matchers.NewMatcherBuilder().Configure(bldrs_matchers.MatchersList(fieldMatchers)).Configure(bldrs_matchers.OnNoMatch(bldrs_matchers.NewOnMatch().Configure(bldrs_matchers.RbacAction(rbac_config.RBAC_DENY, "default")))).Build()
-}
```
- **Lesson**: Mirroring pipelines (such as shadow enforcement or dry-run auditing) must compile the complete predicate decision tree. Omitting explicit affirmative rules in a default-deny engine inverts authorization semantics for valid traffic.

---

### Incident 2: Prometheus Histogram Dynamic Range Distortion via Metric Scale Mismatch (BUG-KUMA-02)
- **Context**: Status updaters across core resource packages (`pkg/core/resources/apis/meshservice/generate/generator.go`, `allocator.go`, `status_updater.go`).
- **What Was Expected**: Controller execution duration histograms measuring millisecond-scale execution cycles should capture accurate distributions across sub-second buckets.
- **What Actually Happened**: Histograms registered without explicit bucket specifications defaulted to Prometheus's default buckets (`DefBuckets`: `.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10` seconds). The timers recorded durations using milliseconds, meaning a 5ms operation was recorded as value `5`, falling into the upper-tail buckets (between 5 and 10 seconds). This rendered latency quantiles (p50, p99) inaccurate.
- **Evidence in Repo**: Commit `2e1d8780`, PR #19166.
- **Root Cause**: Missing metric configuration options when initializing Prometheus histograms for background loops measured in milliseconds instead of seconds.
- **Remediation Code Diff**:
```go
// pkg/core/resources/apis/core/vip/allocator.go
 	metric := prometheus.NewHistogram(prometheus.HistogramOpts{
-		Name: "component_vip_allocator",
-		Help: "Summary of VIP allocation duration",
+		Name:    "component_vip_allocator",
+		Help:    "Summary of VIP allocation duration",
+		Buckets: core_metrics.MillisecondBuckets,
 	})
```
- **Lesson**: When instantiating metrics collectors, always bind the bucket scale directly to the measured duration unit. If the metric reports milliseconds, supply explicit millisecond-scale buckets (`MillisecondBuckets`) rather than accepting the Prometheus SDK standard second-scale defaults.

---

### Incident 3: DNS Lookup Storm on Global Control Plane from Local Dataplanes (BUG-KUMA-03)
- **Context**: `pkg/xds/context/mesh_context_builder.go`, `pkg/api-server/server.go`, `pkg/core/bootstrap/bootstrap.go`
- **What Was Expected**: Global control plane processes mesh metadata synced from zones without attempting to resolve zone-local network addresses.
- **What Actually Happened**: The global control plane ran `fetchResourceList` across Dataplanes and `MeshZoneAddress` objects. When these definitions contained zone-internal hostnames (e.g., Kubernetes internal DNS names or VPC private hostnames), the global control plane attempted synchronous `net.LookupIP` calls. These calls consistently failed with `no such host`, logged noisy error cascades, and slowed down mesh context builds.
- **Evidence in Repo**: Commit `6aa24f12`, PR #19228.
- **Root Cause**: `meshContextBuilder` lacked knowledge of the control plane execution mode (`Global` vs. `Zone`), applying dataplane address resolution logic globally even though global control planes serve no Envoy proxies directly.
- **Remediation Code Diff**:
```go
// pkg/xds/context/mesh_context_builder.go
+func WithoutAddressResolution() MeshContextBuilderOption {
+	return func(m *meshContextBuilder) {
+		m.skipAddressResolution = true
+	}
+}
...
-	if resType != core_mesh.DataplaneType && resType != meshzoneaddress_api.MeshZoneAddressType {
+	if m.skipAddressResolution || (resType != core_mesh.DataplaneType && resType != meshzoneaddress_api.MeshZoneAddressType) {
 		// No post processing stuff so return the list as is
 		return list, nil
 	}
```
- **Lesson**: Boundary isolation requires skipping locality-dependent resolution on orchestrator/global tiers. Use the Functional Options pattern to pass tier-specific constraints into shared builders.

---

### Incident 4: End-to-End Upgrade Split-Brain on Legacy Outbounds (BUG-KUMA-04)
- **Context**: `test/e2e_env/multizone/helm/kuma_helm_deploy_multizone.go`, test suite versions matrix.
- **What Was Expected**: Upgrade test `Upgrade Zone with Helm chart > upgrade zone > from version: 3.0.0` should seamlessly resolve downstream backend services during step upgrades.
- **What Actually Happened**: E2E tests targeting upgrade paths from 3.0.0 failed with `curl: (6) Could not resolve host: test-server_helm-upgrade-ns_svc_80.mesh`.
- **Evidence in Repo**: Closed Issue #19232, PR #19232 commit log.
- **Root Cause**: In Kuma 2.14, outbound DNS was resolved using legacy tag-based hostnames (`<service>_<namespace>_svc_<port>.mesh`). In Kuma 3.0, tag-based outbounds (#17904) and the `kuma.io/service` tag (#18392) were removed in favor of `MeshService`. The Helm upgrade test sent traffic to the old legacy synthetic hostname format, which ceased to resolve on 3.0+ zones.
- **Remediation Code Diff**:
```markdown
// test/e2e/helm_upgrade
- curl http://test-server_helm-upgrade-ns_svc_80.mesh
+ curl http://test-server.helm-upgrade-ns.svc.cluster.local
```
- **Lesson**: Integration and upgrade harnesses must test across canonical, forward-compatible network identities (such as standard Kubernetes FQDNs mapped via `MeshService` refs) rather than relying on deprecated, platform-specific synthetic hostnames across major version boundaries.

---

### Incident 5: Standard Output Contamination in CNI Process Supervision (BUG-KUMA-05)
- **Context**: `app/cni/pkg/install/utils.go`, `app/cni/pkg/cni/utils_linux.go`
- **What Was Expected**: CNI plugin executes iptables and procfs inspection, writing diagnostic log events without interfering with the CNI orchestrator (kubelet).
- **What Actually Happened**: Standard loggers initialized to `os.Stdout` printed diagnostic and trace logs into stdout. Kubernetes CNI runtime protocol requires `stdout` to contain strictly formatted JSON response objects (CNI result payload). Emitting text logs to stdout caused kubelet pod creation to fail with CNI response unmarshalling errors.
- **Evidence in Repo**: `app/cni/pkg/install/utils.go:28`
- **Root Cause**: Direct usage of standard process logger defaults without binding CNI process output exclusively to `os.Stderr`.
- **Remediation Code Diff**:
```go
// app/cni/pkg/install/utils.go
func CreateNewLogger(name string, logLevel kuma_log.LogLevel) logr.Logger {
-	return core.NewLogger(logLevel).WithName(name)
+	// kubelet expects a specific JSON on stdout, so we're using stderr in CNI
+	return core.NewLoggerTo(os.Stderr, logLevel).WithName(name)
}
```
- **Lesson**: CLI utilities and container plugins operating under standard IPC protocols (such as CNI or Git credential helpers) must restrict stdout strictly to machine-readable contract payloads, directing all telemetry, logs, and diagnostics exclusively to stderr.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Pointer Dereferencing and Empty Slice Semantics
In `pkg/plugins/policies/meshtrafficpermission/xds/rbac_configurer.go`, policy matchers are stored as optional pointers to slices: `*[]common_api.Match`. 
```go
// INVARIANT: Do not use direct slice access on pointer types.
// A nil pointer dereference panic occurs if the policy struct has an unset allow/deny block.
// Use pointer.Deref() which safely maps nil -> empty slice, but be aware of memory allocation.

// SAFE:
matchers, err := buildMatchers(pointer.Deref(conf.Allow), rbac_config.RBAC_ALLOW, rule.Origin)

// HAZARD:
// If conf.Allow is nil, *conf.Allow panics at runtime.
matchers, err := buildMatchers(*conf.Allow, rbac_config.RBAC_ALLOW, rule.Origin)
```

#### Slice Concatenation with Go 1.22+ Standard Library
The codebase uses `slices.Concat` instead of repeated `append` calls:
```go
// SAFE & IDIOMATIC (Go 1.22+):
// Pre-calculates capacity, preventing intermediate re-allocations and slice header mutation leaks.
return slices.Concat(pointer.Deref(conf.Allow), pointer.Deref(conf.AllowWithShadowDeny))

// DANGEROUS & SUBTLE:
// append(a, b...) mutates the backing array of 'a' if 'a' has excess capacity!
// If 'a' is a referenced slice in a cached configuration, concurrent policy generators
// will corrupt each other's memory.
a := pointer.Deref(conf.Allow)
return append(a, pointer.Deref(conf.AllowWithShadowDeny)...)
```

---

### 2. Infinite Loop & Recursion Guards

#### Linux `/proc` Directory Traversal Termination
In `app/cni/pkg/cni/utils_linux.go`, discovering processes requires iterating over the Linux `/proc` filesystem. Reading `/proc` presents subtle failure modes: `/proc` contains transient PID directories that are created and destroyed continuously, which can trigger infinite loops or descriptor exhaustion if directory streams are handled naively.

```go
func getPids(name string) []int {
	var pids []int
	if name == "" {
		return nil
	}

	dirFD, err := os.Open("/proc")
	if err != nil {
		return nil
	}
	defer dirFD.Close()

	for {
		// INVARIANT: Read a fixed batch size (10 entries) instead of Readdir(-1).
		// Readdir(-1) attempts to read all entries into memory at once, which can
		// allocate hundreds of thousands of FileInfo structs on high-density nodes.
		ls, err := dirFD.Readdir(10)
		if err == io.EOF {
			// INVARIANT: Must check io.EOF explicitly to terminate the infinite loop cleanly.
			break
		}
		if err != nil {
			// Return cleanly on I/O error (e.g. permission error during iteration)
			return nil
		}

		for _, entry := range ls {
			if !entry.IsDir() {
				continue
			}

			// INVARIANT: Skip non-numeric directories immediately.
			// Prevents executing expensive ReadFile calls against /proc/sys, /proc/net, etc.
			pid, err := strconv.Atoi(entry.Name())
			if err != nil {
				continue
			}

			// Read /proc/<pid>/cmdline safely
			cmdline, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cmdline"))
			if err != nil {
				// Process died between Readdir and ReadFile; continue gracefully
				continue
			}

			// Parse command line using null-byte delimiter invariant
			parts := bytes.SplitN(cmdline, []byte{0}, 2)
			if len(parts) == 0 {
				continue
			}
			exe := strings.FieldsFunc(string(parts[0]), func(c rune) bool {
				return unicode.IsSpace(c) || c == ':'
			})
			if len(exe) == 0 {
				continue
			}
			if name == exe[0] {
				pids = append(pids, pid)
			}
		}
	}
	return pids
}
```

---

### 3. UI & UX Micro-Mechanics (Service Worker & Event Streams)

In `app/kuma-ui/pkg/resources/data/mockServiceWorker.js`, mock service worker event interception must handle Server-Sent Events (SSE) and DevTools edge cases without breaking stream lifetimes or corrupting memory.

#### Server-Sent Events (SSE) Stream Clone Invariant
Cloning a response via `response.clone()` splits the underlying `ReadableStream` into a "teed" stream. A teed stream buffers all chunks until *both* branches are consumed or canceled. If applied to an indefinite `text/event-stream`, this creates an unbounded memory leak.

```javascript
// INVARIANT: Do NOT clone response bodies for Server-Sent Events (SSE).
const isEventStreamResponse = response.headers
  .get('content-type')
  ?.toLowerCase()
  .startsWith('text/event-stream')

// Cloning such responses prevents client-side stream cancellations from reaching
// the server and buffers the entire infinite stream into memory indefinitely.
const responseClone = isEventStreamResponse ? null : response.clone()
```

#### Chrome DevTools "only-if-cached" Fetch Trap
```javascript
// INVARIANT: Bypass requests where cache is 'only-if-cached' and mode is not 'same-origin'.
// Opening Chrome DevTools generates background network probes with:
// { cache: "only-if-cached", mode: "no-cors" }
// Standard fetch() specs strictly throw a TypeError if only-if-cached is combined with anything
// other than same-origin. Service workers must bypass these directly.
if (
  event.request.cache === 'only-if-cached' &&
  event.request.mode !== 'same-origin'
) {
  return
}
```

---

### 4. Backend Concurrency & Memory Safety

#### Dual Signal Shutdown Channels
In `pkg/cmd/util.go`, control plane shutdown coordinates gentle drain vs force kill:
```go
type RunCmdOpts struct {
	// Dual-stage context teardown invariant:
	// 1. firstStopSignalReceived (SIGINT/SIGTERM): Triggers graceful draining, 
	//    stops listening on new ports, sends Envoy draining commands.
	// 2. secondStopSignalReceived (second SIGINT/SIGTERM): Forcefully terminates process.
	// 3. usr2Received: Non-blocking channel buffering exactly 1 notification for SIGUSR2 
	//    (used for runtime diagnostic stack dumps).
	SetupSignalHandler func() (
		firstStopSignalReceived context.Context, 
		secondStopSignalReceived context.Context, 
		usr2Received <-chan struct{},
	)
}
```

#### Recursive Map Reflection and Pointer Mutation
In `app/kumactl/cmd/install/render_helm_files.go`, dynamic values overrides construct nested maps from reflection:
```go
// INVARIANT: Go reflection field values from structs can produce map[string]string,
// but Helm v4's chart engine strictly requires map[string]any (interface{}).
func adjustType(value any) any {
	if m, ok := value.(map[string]string); ok {
		result := map[string]any{}
		for k, v := range m {
			result[k] = v
		}
		return result
	}
	return value
}
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### Deterministic Map Serialization for Kubernetes Manifest Golden Testing
In `app/kumactl/cmd/install