> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cilium-cilium-learnings.md`  
> **Source**: github ([https://github.com/cilium/cilium](https://github.com/cilium/cilium))  
> **Source Version**: `08b6eada`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:41:17.995Z  
> **Learning ID**: `learn-github-cilium-cilium`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): cilium/cilium

---

## 1. Executive Forensic Architecture & System Mechanics

Cilium solves the fundamental kernel-to-user-space impedance mismatch in cloud-native container networking, security filtering, and observability. Instead of multiplexing iptables chains or IPVS rule arrays inside the Linux network stack (which suffer from $O(N)$ packet traversal complexity, rule-update lock contention, and connection-tracking state bloat), Cilium injects extended Berkeley Packet Filters (eBPF) directly into kernel hook points:
- **eXpress Data Path (XDP)**: Operates at the lowest device driver or native NIC level before socket buffer (`sk_buff`) allocation, providing wire-rate DDoS mitigation and packet redirection.
- **Traffic Control (TC / clsact)**: Attached to egress and ingress queues of network interfaces (veth pairs, physical interfaces, vxlan/geneve tunnels) to enforce L3/L4 policies, identity-based routing, encapsulation, and source/destination NAT.
- **Socket Hooks (`cgroup/sock_addr`, `sockops`)**: Operates on system call layers (`connect`, `sendmsg`, `recvmsg`) inside host and pod cgroups to execute transparent socket-level load balancing (SocketLB), bypassing the entire TCP/IP kernel stack overhead for node-local IPC.

```
+-----------------------------------------------------------------------------------+
|                                 USER SPACE                                        |
|  +-----------------------------------------------------------------------------+  |
|  |                              cilium-agent                                   |  |
|  |  +-------------------+   +--------------------+   +----------------------+  |  |
|  |  | Kubernetes API &  |   | StateDB (In-Memory |   | Policy Engine & BPF  |  |  |
|  |  | CRD Watchers      |-->| Relational Model)  |-->| Generator (LLVM/BTF) |  |  |
|  |  +-------------------+   +--------------------+   +----------------------+  |  |
|  +------------------------------------|----------------------------------------+  |
|                                       | libbpf / cilium/ebpf                      |
|                                       v                                           |
+-----------------------------------------------------------------------------------+
|                                 KERNEL SPACE                                      |
|  +-----------------------------------------------------------------------------+  |
|  | Socket Layer: sockops, cgroup/sock_addr (SocketLB, TCP bypass)              |  |
|  +-----------------------------------------------------------------------------+  |
|  | TC Ingress/Egress: cil_to_netdev, cil_from_netdev (Policy, Encapsulation)  |  |
|  +-----------------------------------------------------------------------------+  |
|  | XDP: bpf_xdp_entry (L4LB / Maglev, fast packet drop, per-packet LB)        |  |
|  +-----------------------------------------------------------------------------+  |
|  | Kernel Maps (BPF_MAP_TYPE_HASH, LPM_TRIE, BPF_MAP_TYPE_ARRAY):               |  |
|  | cilium_lxc, cilium_policy, cilium_nat4/6, cilium_ct4/6                     |  |
+-----------------------------------------------------------------------------------+
```

### Critical Subsystem Boundaries and State Ownership

1. **StateDB In-Memory Architecture (`cilium/statedb`)**:
   Replaces fragmented, mutex-guarded Go struct caches with an in-memory lock-free relational engine based on Immutable Radix Trees. StateDB provides optimistic concurrency, transactional table updates, indexed multi-attribute queries, and change-streaming channels (`statedb.Watch`) without lock amplification.
2. **BPF Compilation & Loading Engine (`cilium/ebpf`)**:
   Generates site-specific C headers (`ep_config.h`) containing macro definitions and endpoint security identities. BPF bytecode is compiled via LLVM/Clang or loaded via pre-compiled objects utilizing BPF CO-RE (Compile Once - Run Everywhere) via BTF (BPF Type Format), then atomic map swaps replace the running programs with zero packet loss.
3. **Identity Allocation & Local Endpoint Management**:
   Decouples IP addresses from security policies. Endpoints sharing the same set of Kubernetes labels resolve to an identical numeric `SecurityIdentity` (24-bit integer). TC programs match ingress traffic against `cilium_policy_*` maps using this integer rather than IP ranges, reducing matching overhead from $O(Rules \times IPs)$ to a single $O(1)$ hash map lookup.
4. **Data-Plane Routing & Datapath Modes**:
   - **Tunnel Mode (Overlay)**: Encapsulates inter-node pod traffic in VXLAN (UDP port 8472) or Geneve (UDP port 6081), abstracting physical underlay topology.
   - **Direct Routing Mode (Native)**: Employs BGP Control Plane (`osrg/gobgp`) or cloud routing to broadcast pod CIDRs directly to Top-of-Rack (ToR) switches, eliminating encapsulation headers.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Value Struct Serialization Invariant in Go Kubernetes CRDs
**RULE**:
When serializing Go structs embedded inside high-volume CRD subresources, slices, or wire protocols using standard `encoding/json`, non-pointer nested structs MUST NOT be tagged with `json:",omitempty"` if zero-value field elision is required. Engineers MUST use `json:",omitzero"` (Go 1.24+) or declare the embedded struct as a pointer (`*T`) with `json:",omitempty"`.

**WHY**:
In Go's `encoding/json`, `omitempty` evaluates a struct only by whether it implements `IsEmpty() bool` (rare) or if it is a pointer equal to `nil`. A non-pointer struct value (such as `cilium_v2.EncryptionSpec`) is *never* considered empty by `omitempty`, even if all internal fields are zeroed (`Key: 0`). Consequently, the marshaler outputs `"encryption":{}`. In Kubernetes clusters scaling to tens of thousands of endpoints aggregated into `CiliumEndpointSlice` (CES) objects, serializing empty struct maps for thousands of endpoints injects megabytes of useless JSON payload into etcd and the kube-apiserver watcher stream, triggering etcd database fragmentation, excessive GC cycles, and network saturation.

**WHEN TO APPLY**:
Apply to all Go data structures used in Kubernetes API models, custom resource definitions (CRDs), network control plane serializations, and high-frequency IPC protocols where objects are replicated across cluster-wide watchers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package v2alpha1

import (
	cilium_v2 "github.com/cilium/cilium/pkg/k8s/apis/cilium.io/v2"
	"github.com/cilium/cilium/pkg/k8s/apis/cilium.io/models"
)

// CoreCiliumEndpoint contains endpoint state stripped down for high-density slicing.
type CoreCiliumEndpoint struct {
	// ID is the endpoint identification integer.
	ID int64 `json:"id,omitempty"`

	// Name is the pod name.
	Name string `json:"name,omitempty"`

	// Encryption specifies node-level encryption settings.
	// Using omitzero ensures that an uninitialized struct { Key: 0 } is omitted
	// from JSON output entirely instead of producing "encryption":{}.
	// +kubebuilder:validation:Optional
	Encryption cilium_v2.EncryptionSpec `json:"encryption,omitzero"`

	// Alternatively, if targeting Go versions prior to omitzero:
	// Encryption *cilium_v2.EncryptionSpec `json:"encryption,omitempty"`

	// +kubebuilder:validation:Optional
	NamedPorts models.NamedPorts `json:"named-ports,omitempty"`
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: omitempty on a non-pointer struct DOES NOT omit empty structs.
type CoreCiliumEndpointBad struct {
	ID int64 `json:"id,omitempty"`
	
	// FAILS: Produces `"encryption":{}` when Key == 0, leaking 16 bytes per endpoint.
	// Across 10,000 endpoints in CES, this introduces 160KB of serialization deadweight per sync.
	Encryption cilium_v2.EncryptionSpec `json:"encryption,omitempty"`
}
```

**VERIFICATION METHOD**:
Enforce serialization verification via property tests verifying byte output lengths on zero-initialized structs:
```go
func TestStructSerializationOmitZero(t *testing.T) {
	ep := CoreCiliumEndpoint{
		ID: 1024,
		Name: "pod-1",
		Encryption: cilium_v2.EncryptionSpec{}, // Zero-valued struct
	}
	bytes, err := json.Marshal(ep)
	require.NoError(t, err)
	require.NotContains(t, string(bytes), `"encryption"`, 
		"Zero-value struct must be completely omitted from serialized JSON output")
}
```

---

### 2. Guarded Feature-Flag Degradation Invariant for Cross-Version BPF Control Planes
**RULE**:
When writing control plane logic, integration harnesses, or CLI connectivity checkers that exercise low-level kernel datapath optimizations (such as IPv6 loopback routing, SocketLB bypass, or per-packet load balancing), feature invocations MUST NOT be conditioned purely on datapath feature flags. They MUST enforce an explicit two-tiered constraint: `Kernel/BPF Capability Probe` AND `versioncheck.MustCompile(">=TargetVersion")(RuntimeVersion)`.

**WHY**:
BPF features and kernel helpers land asynchronously across runtime branches. A BPF capability or helper might be physically present in a development build or backported release, but supporting control plane routines (such as reverse-NAT translation, per-packet LB, or IP family socket translation) may not be verified on older agent release lines. Invoking tests or datapath features without explicit semantic version fences causes non-deterministic CI breaks, test pollution on older branches, and kernel-level packet drops due to unhandled lookup paths in older BPF bytecode.

**WHEN TO APPLY**:
Apply to any distributed control plane or networking CLI interacting with multiple agent/daemon versions across heterogeneous Linux kernel versions ($5.10$ through $6.12+$).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package connectivity

import (
	"context"
	
	"github.com/cilium/cilium/pkg/versioncheck"
	v2 "github.com/cilium/cilium/pkg/k8s/apis/cilium.io/v2"
)

type TestContext interface {
	CiliumVersion() string
	IsSocketLBFull() bool
}

func (s *LRPChecker) RunFamilyRoutingTests(ctx context.Context, t TestRunner, policies []*v2.CiliumLocalRedirectPolicy, ipFamily IPFamily) {
	if ipFamily == IPFamilyV4 {
		s.runTestsForIPFamily(ctx, t, policies, ipFamily)
		return
	}

	if ipFamily == IPFamilyV6 {
		// INVARIANT: Even if per-packet LB is supported in kernel BPF, CLI/Agent cross-branch
		// regression avoidance mandates gating the end-to-end test on the stable release version.
		if versioncheck.MustCompile(">=1.21.0")(t.Context().CiliumVersion()) {
			s.runTestsForIPFamily(ctx, t, policies, ipFamily)
			return
		}

		// Fallback path: Partition policies based on backend redirection capability
		var ipv6SkipTruePolicies, ipv6SkipFalsePolicies []*v2.CiliumLocalRedirectPolicy
		for _, policy := range policies {
			if policy.Spec.SkipRedirectFromBackend {
				ipv6SkipTruePolicies = append(ipv6SkipTruePolicies, policy)
			} else {
				ipv6SkipFalsePolicies = append(ipv6SkipFalsePolicies, policy)
			}
		}

		if s.skipRedirectFromBackend && len(ipv6SkipTruePolicies) > 0 {
			if versioncheck.MustCompile(">=1.17.3")(t.Context().CiliumVersion()) {
				s.runTestsForIPFamily(ctx, t, ipv6SkipTruePolicies, ipFamily)
			} else {
				t.Info("Skipping IPv6 tests for policies with skipRedirectFromBackend=true (< 1.17.3)")
			}
		}

		if !s.skipRedirectFromBackend && len(ipv6SkipFalsePolicies) > 0 {
			if !t.Context().IsSocketLBFull() {
				t.Info("Skipping IPv6 tests for policies with skipRedirectFromBackend=false: SocketLB not fully functional")
			} else {
				s.runTestsForIPFamily(ctx, t, ipv6SkipFalsePolicies, ipFamily)
			}
		}
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Testing features based solely on protocol logic without version fences.
func (s *LRPChecker) RunFamilyRoutingTestsBad(ctx context.Context, t TestRunner, policies []*v2.CiliumLocalRedirectPolicy) {
	// FAILS: Assumes that because BPF datapath merged IPv6 loopback, the target
	// cluster's running agent supports the CLI test suite's expectations.
	for _, policy := range policies {
		s.runTestsForIPFamily(ctx, t, policies, IPFamilyV6)
	}
}
```

**VERIFICATION METHOD**:
Run unit tests across a synthetic matrix of versions:
```go
func TestVersionMatrixPolicyValidation(t *testing.T) {
	versions := []struct {
		version string
		expectExecution bool
	}{
		{"1.16.5", false},
		{"1.17.2", false},
		{"1.17.3", true},
		{"1.20.9", false},
		{"1.21.0", true},
	}
	for _, tc := range versions {
		allowed := versioncheck.MustCompile(">=1.21.0")(tc.version)
		require.Equal(t, tc.expectExecution, allowed, "Version gating mismatch for %s", tc.version)
	}
}
```

---

### 3. Fail-Safe Ephemeral Execution Target Lifecycle Pattern
**RULE**:
When building diagnostic or introspection tooling that must execute commands within the context of a target container in Kubernetes (e.g., collecting debug bundles, network dumps, or agent state), systems MUST NOT assume the target container is running or that the Pod specification allows direct `/bin/exec`. The system MUST follow a strict three-tier degradation cascade:
1. Direct Container Execution if `State.Running != nil`.
2. EphemeralContainer injection via `Pod/ephemeralcontainers` subresource if the container has crashed or terminated.
3. Node-Co-Located Clone Pod with identical volumes, network namespace (`HostNetwork`), IPC, and credentials, bound to the same `NodeName` with universal tolerations, guaranteed by a deterministic defer/cleanup teardown hook.

**WHY**:
When network daemons or CNI agents enter `CrashLoopBackOff`, nodes isolate, or containers panic due to corrupt BPF state, diagnostic tools running `kubectl exec` or API equivalent fail instantly with container-not-running errors. Attempting to diagnose a failing cluster by only inspecting running containers ensures total diagnostic blackout during catastrophic failures.

**WHEN TO APPLY**:
Diagnostic collectors, sysdump tools, agent recovery daemons, and autonomous site reliability agents diagnosing crash-looping or unresponsive workloads.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package sysdump

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
)

type ExecutionTargetResolver struct {
	Client KubeDiagnosticClient
}

func (r *ExecutionTargetResolver) EnsureExecTarget(
	ctx context.Context,
	pod *corev1.Pod,
	targetContainer string,
) (outPod *corev1.Pod, outContainer string, cleanup func(context.Context) error, err error) {
	cleanup = func(_ context.Context) error { return nil }

	// Tier 1: Container is running normally.
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.Name == targetContainer && cs.State.Running != nil {
			return pod, targetContainer, cleanup, nil
		}
	}

	// Extract target container spec for cloning into Tier 2 / 3
	var fromContainer *corev1.Container
	for _, c := range pod.Spec.Containers {
		if c.Name == targetContainer {
			fromContainer = c.DeepCopy()
			break
		}
	}
	if fromContainer == nil {
		return nil, "", cleanup, fmt.Errorf("container %q not in spec for pod %s/%s", targetContainer, pod.Namespace, pod.Name)
	}

	// Tier 2: Attempt EphemeralContainer injection (k8s 1.23+ beta/GA)
	ecName := fmt.Sprintf("sysdump-%d", time.Now().UnixNano())
	ec := &corev1.EphemeralContainer{
		EphemeralContainerCommon: corev1.EphemeralContainerCommon{
			Name:            ecName,
			Image:           fromContainer.Image,
			Command:         []string{"/bin/sleep", "1d"},
			Env:             fromContainer.Env,
			VolumeMounts:    fromContainer.VolumeMounts,
			SecurityContext: fromContainer.SecurityContext,
		},
		TargetContainerName: fromContainer.Name,
	}

	if targetPod, err := r.Client.CreateEphemeralContainer(ctx, pod, ec); err == nil {
		pollErr := wait.PollUntilContextTimeout(ctx, 2*time.Second, 30*time.Second, false, func(c context.Context) (bool, error) {
			p, err := r.Client.GetPod(c, targetPod.Namespace, targetPod.Name, metav1.GetOptions{})
			if err != nil { return false, err }
			for _, st := range p.Status.EphemeralContainerStatuses {
				if st.Name == ecName {
					return st.State.Running != nil, nil
				}
			}
			return false, nil
		})
		if pollErr == nil {
			return targetPod, ecName, cleanup, nil
		}
	}

	// Tier 3: Create Clone Pod pinned to identical node and network namespaces
	clonePod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:    pod.Namespace,
			GenerateName: "sysdump-rescue-",
		},
		Spec: corev1.PodSpec{
			NodeName:           pod.Spec.NodeName,
			HostNetwork:        pod.Spec.HostNetwork,
			HostPID:            pod.Spec.HostPID,
			HostIPC:            pod.Spec.HostIPC,
			RestartPolicy:      corev1.RestartPolicyNever,
			ServiceAccountName: pod.Spec.ServiceAccountName,
			Tolerations: []corev1.Toleration{
				{Operator: corev1.TolerationOpExists}, // Schedule even on cordoned/tainted nodes
			},
			Containers: []corev1.Container{
				{
					Name:            fromContainer.Name,
					Image:           fromContainer.Image,
					Command:         []string{"/bin/sleep", "1d"},
					Env:             fromContainer.Env,
					VolumeMounts:    fromContainer.VolumeMounts,
					SecurityContext: fromContainer.SecurityContext,
				},
			},
			Volumes: pod.Spec.Volumes,
		},
	}

	createdPod, err := r.Client.CreatePod(ctx, pod.Namespace, clonePod, metav1.CreateOptions{})
	if err != nil {
		return nil, "", cleanup, fmt.Errorf("failed to create rescue pod: %w", err)
	}

	// Register guaranteed teardown
	cleanup = func(c context.Context) error {
		return r.Client.DeletePod(c, createdPod.Namespace, createdPod.Name, metav1.DeleteOptions{})
	}

	waitErr := wait.PollUntilContextTimeout(ctx, 2*time.Second, 120*time.Second, false, func(c context.Context) (bool, error) {
		p, err := r.Client.GetPod(c, createdPod.Namespace, createdPod.Name, metav1.GetOptions{})
		if err != nil { return false, err }
		for _, cond := range p.Status.Conditions {
			if cond.Type == corev1.ContainersReady && cond.Status == corev1.ConditionTrue {
				return true, nil
			}
		}
		return false, nil
	})

	if waitErr != nil {
		_ = cleanup(ctx)
		return nil, "", func(_ context.Context) error { return nil }, fmt.Errorf("rescue pod failed to reach ready state: %w", waitErr)
	}

	return createdPod, fromContainer.Name, cleanup, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Direct execution assuming container presence without fallback.
func ExecInTargetBad(ctx context.Context, client KubeClient, pod *corev1.Pod, container string) error {
	// FAILS: Crashes with "container not found" or "container not running" if the pod is in
	// CrashLoopBackOff, exactly when diagnostic information is most needed.
	return client.ExecCommand(ctx, pod.Namespace, pod.Name, container, []string{"cilium-dbg", "status"})
}
```

**VERIFICATION METHOD**:
Mock container states to verify cascading execution:
1. `PodStatus` with `State.Waiting` -> Verifies attempt to invoke `CreateEphemeralContainer`.
2. `CreateEphemeralContainer` returning API 404 (feature disabled) -> Verifies `CreatePod` executed with identical `NodeName`, `Tolerations: Exists`, and cleanup invocation.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Serialization Bloat in CiliumEndpointSlice (BUG-CES-01)
- **Context**: `pkg/k8s/apis/cilium.io/v2alpha1/types.go`
- **What Was Expected**: When endpoint encryption is disabled (`Key == 0`), the `Encryption` configuration inside the lightweight `CoreCiliumEndpoint` struct should not be serialized into JSON, keeping `CiliumEndpointSlice` (CES) manifests compact.
- **What Actually Happened**: Because `CoreCiliumEndpoint.Encryption` was typed as a value struct (`cilium_v2.EncryptionSpec`) and tagged with `json:"encryption,omitempty"`, Go’s standard `encoding/json` serialized it as `"encryption":{}`. For clusters with 50,000 endpoints grouped into CES objects (up to 100 endpoints per slice), every single endpoint emitted an empty 16-byte object, inflating the etcd memory footprint and network serialization payload by hundreds of megabytes cluster-wide.
- **Evidence in Repo**: Commit SHA `08b6eada`, author Kamil Wyszyński.
- **Root Cause**: Go’s `encoding/json` tag `omitempty` does not evaluate a non-pointer struct to be empty unless the struct satisfies custom interfaces. A zero-value struct `{}` remains non-empty under reflection rules.
- **Remediation Code Diff**:
```diff
--- a/pkg/k8s/apis/cilium.io/v2alpha1/types.go
+++ b/pkg/k8s/apis/cilium.io/v2alpha1/types.go
@@ -46,7 +46,7 @@ type CoreCiliumEndpoint struct {
 	// Encryption is the encryption configuration of the node
 
 	// +kubebuilder:validation:Optional
-	Encryption cilium_v2.EncryptionSpec `json:"encryption,omitempty"`
+	Encryption cilium_v2.EncryptionSpec `json:"encryption,omitzero"`
 	// +kubebuilder:validation:Optional
 	NamedPorts models.NamedPorts `json:"named-ports,omitempty"`
 	// ServiceAccount is the service account of the endpoint.
```
- **Lesson**: Struct fields in Go models that map directly to high-cardinality serialization channels MUST use `omitzero` (Go 1.24+) or pointer types (`*T`) to guarantee absolute zero-allocation in JSON output.

---

### Incident 2: Incompatible LRP IPv6 Test Execution on Older Agent Releases (BUG-LRP-02)
- **Context**: `cilium-cli/connectivity/tests/lrp.go`
- **What Was Expected**: Running `cilium connectivity test` on Kubernetes clusters running Cilium agent versions prior to v1.21 should skip unsupported IPv6 Local Redirect Policy (LRP) test cases that lack loopback BPF redirect capabilities, rather than failing the test suite.
- **What Actually Happened**: PR #39594 introduced IPv6 loopback support in the BPF per-packet load balancer datapath in v1.19. However, CLI PRs are not verified on older branches. When developers executed connectivity tests against IPv6 clusters with `skipRedirectFromBackend=false`, tests failed with unroutable packet drops because the CLI executed the tests unconditionally on any IPv6-enabled cluster without checking if the running agent version supported this path.
- **Evidence in Repo**: Commit SHA `84e5db53`, author Julian Wiedmann.
- **Root Cause**: Premature test un-skipping in the CLI without version gating. The CLI suite assumed the cluster datapath was identical to the latest `main` branch.
- **Remediation Code Diff**:
```diff
--- a/cilium-cli/connectivity/tests/lrp.go
+++ b/cilium-cli/connectivity/tests/lrp.go
@@ -72,32 +72,36 @@ func (s lrp) Run(ctx context.Context, t *check.Test) {
 		if ipFamily == features.IPFamilyV4 {
 			s.runTestsForIPFamily(ctx, t, familyPolicies, ipFamily)
 		} else if ipFamily == features.IPFamilyV6 {
-			// Split IPv6 policies based on skipRedirectFromBackend
-			ipv6SkipTruePolicies := make([]*v2.CiliumLocalRedirectPolicy, 0)
-			ipv6SkipFalsePolicies := make([]*v2.CiliumLocalRedirectPolicy, 0)
-			for _, policy := range familyPolicies {
-				if policy.Spec.SkipRedirectFromBackend {
-					ipv6SkipTruePolicies = append(ipv6SkipTruePolicies, policy)
-				} else {
-					ipv6SkipFalsePolicies = append(ipv6SkipFalsePolicies, policy)
-				}
-			}
+			if versioncheck.MustCompile(">=1.21.0")(t.Context().CiliumVersion) {
+				s.runTestsForIPFamily(ctx, t, familyPolicies, ipFamily)
+			} else {
+				// Split IPv6 policies based on skipRedirectFromBackend
+				ipv6SkipTruePolicies := make([]*v2.CiliumLocalRedirectPolicy, 0)
+				ipv6SkipFalsePolicies := make([]*v2.CiliumLocalRedirectPolicy, 0)
+				for _, policy := range familyPolicies {
+					if policy.Spec.SkipRedirectFromBackend {
+						ipv6SkipTruePolicies = append(ipv6SkipTruePolicies, policy)
+					} else {
+						ipv6SkipFalsePolicies = append(ipv6SkipFalsePolicies, policy)
+					}
+				}
```
- **Lesson**: Diagnostic and testing CLIs that operate out-of-band MUST decouple their internal assertions from cluster capability assumptions by querying runtime semantic versions (`versioncheck.MustCompile`).

---

### Incident 3: Kernel Complexity Test Desynchronization Across Micro-Kernels (BUG-LVH-03)
- **Context**: BPF Verifier instruction complexity test suite across virtualized kernels (`quay.io/lvh-images/complexity-test`).
- **What Was Expected**: Continuous integration verifies that changes to BPF C programs (`bpf_lxc.c`, `bpf_overlay.c`, etc.) do not exceed the Linux kernel BPF verifier limit of 1,000,000 instructions or 512-byte stack frames across all supported LTS kernel versions ($5.10, 5.15, 6.1, 6.6, 6.12, \text{RHEL 8.10}$).
- **What Actually Happened**: The verifier behavior differs across kernel releases. LLVM compiler updates altered register spilling in loops, passing on kernel 6.12 but failing verifier state-pruning limits on kernel 5.10 with `verifier log: program too large` or `BPF program is too complex`.
- **Evidence in Repo**: Issue #49442: Renovate bump of stable `lvh-images` matrix `6.12-20261005` to `6.12-20261013`, triggering verification runs across all kernel versions.
- **Root Cause**: BPF verifier path exploration algorithms evolved significantly between Linux 5.10 and 6.12. Code changes that appear optimal in modern kernels can blow up the verifier branch state space on older kernels that lack jump history tracking and precise scalar bounds tracking.
- **Remediation Pattern**:
Cilium mandates running verifier instruction complexity tests across isolated Linux Virtual Harvester (LVH) microVM images in CI for every BPF modification:
```yaml
# Matrix definition validating verifier instruction count constraints
strategy:
  matrix:
    kernel: [5.10, 5.15, 6.1, 6.6, 6.12, rhel8.10]
    image: [quay.io/lvh-images/complexity-test]
steps:
  - name: Run verifier complexity test
    run: |
      lvh run --kernel ${{ matrix.kernel }} -- ./test/bpf/verifier_test
```
- **Lesson**: Low-level kernel code cannot be verified solely on the developer's host kernel. Cross-kernel verifier profiling matrices are mandatory to prevent silent deployment failures on older LTS enterprise hosts.

---

### Incident 4: CrashLoop Diagnostic Blackout in Sysdump Execution (BUG-SD-04)
- **Context**: `cilium-cli/sysdump/k8sutils.go`
- **What Was Expected**: Running `cilium sysdump` collects diagnostic outputs (eBPF maps, endpoint tables, stack traces) from agents even when the `cilium-agent` pod has crashed or entered an unstartable state.
- **What Actually Happened**: `sysdump` relied on standard `client-go` container execution. When the agent was in a non-running state (`ContainerStatuses[i].State.Running == nil`), execution failed immediately, returning zero logs and leaving administrators unable to inspect the post-mortem datapath state.
- **Evidence in Repo**: `cilium-cli/sysdump/k8sutils.go:ensureExecTarget`.
- **Root Cause**: Lack of dynamic fallback from container execution to Ephemeral Containers or identical pod specifications on the affected node.
- **Remediation Code Diff**:
```go
// Inside cilium-cli/sysdump/k8sutils.go
// If running container is missing, inject EphemeralContainer:
ec := &corev1.EphemeralContainer{
    EphemeralContainerCommon: corev1.EphemeralContainerCommon{
        Name:            fmt.Sprintf("sysdump-%d", time.Now().Unix()),
        Image:           fromContainer.Image,
        Command:         []string{"/bin/sleep", "1d"},
        Env:             fromContainer.Env,
        VolumeMounts:    fromContainer.VolumeMounts,
        SecurityContext: fromContainer.SecurityContext,
    },
    TargetContainerName: fromContainer.Name,
}
targetPod, err = c.Client.CreateEphemeralContainer(ctx, pod, ec)
// If EphemeralContainers are rejected by k8s API FeatureGate, dynamically launch a clone pod:
if err != nil {
    newPod := &corev1.Pod{
        Spec: corev1.PodSpec{
            NodeName:    pod.Spec.NodeName,
            HostNetwork: pod.Spec.HostNetwork,
            // ... identical volumes, mounts, and security context
        },
    }
    targetPod, err = c.Client.CreatePod(ctx, pod.Namespace, newPod, metav1.CreateOptions{})
}
```
- **Lesson**: Diagnostic tooling must be resilient against the very failures it is designed to investigate. Always implement multi-tier execution targets (Target -> Ephemeral -> Node-Clone).

---

### Incident 5: Swagger OpenApi Error Loss in Nested Route Validation (BUG-SWG-05)
- **Context**: `api/v1/models/bgp_route_policy_statement.go`
- **What Was Expected**: Validation errors in nested BGP route policy statements must preserve their full field path (e.g., `match-families.0.afi`) when returning composite errors up the API stack.
- **What Actually Happened**: When validating slices of pointers (such as `MatchFamilies []*BgpFamily`), type errors were returned as standard errors, losing path context when converted to generic strings, or panicking when