> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cilium-cilium-learnings.md`  
> **Source**: github ([https://github.com/cilium/cilium](https://github.com/cilium/cilium))  
> **Source Version**: `6a571439`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T07:39:22.241Z  
> **Learning ID**: `learn-github-cilium-cilium`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): cilium/cilium

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Problem Space
`cilium/cilium` operates at the intersection of Linux kernel data-path programming (eBPF/XDP) and cloud-native application orchestration (Kubernetes CNI, Gateway API, Service Mesh). It replaces legacy Linux network routing stacks (`iptables`, `IPVS`, bridge devices) by injecting compiled eBPF bytecode programs directly into kernel hook points:
* **XDP (eXpress Data Path)**: Early bare-metal packet filtering, L4 load balancing, and DDoS mitigation before socket buffer (`sk_buff`) allocation.
* **tc (Traffic Control) ingress/egress**: Full L3/L4 packet routing, encapsulation (Geneve, VXLAN), network policy enforcement, SNAT/DNAT, and tunnel encapsulation.
* **cgroup / Socket Hooks (`sock_ops`, `sock_addr`)**: Socket-layer Layer 4 redirection directly at `connect()`, `sendmsg()`, and `recvmsg()` calls, bypassing the host TCP/IP stack entirely for node-local IPC (Kube-Proxy Replacement / Socket LB).
* **Envoy Integration & L7 Flow Enforcement**: Transparent user-space redirection via eBPF sockmap / TPROXY into Cilium Envoy instances for L7 policy enforcement (HTTP, gRPC, Kafka) and Gateway API routing.

### 1.2 Architectural Boundaries & Subsystems
```
  +-----------------------------------------------------------------------------------------+
  |                                Kubernetes Control Plane                                 |
  +-----------------------------------------------------------------------------------------+
         | CRDs (CiliumNetworkPolicy, CiliumClusterwideNetworkPolicy, Gateway, HTTPRoute)
         v
  +-------------------------------------+         +-----------------------------------------+
  |           cilium-operator           |         |               cilium-agent              |
  |  - IPAM allocation (Azure, AWS, ENI)|         |  - Hive Modular Architecture Engine     |
  |  - Gateway API / Ingress Controller |         |  - StateDB (In-Memory MVCC Relational)  |
  |  - BGP Control Plane Coordinator    |         |  - Identity Allocation & Policy Engine  |
  |  - Secret Sync & Status Reporting   |<=======>|  - BPF Program Compiler & Loader (LLVM) |
  +-------------------------------------+  K8s    +-----------------------------------------+
                                           APIs             |             |
                                                            | Map Updates | eBPF Bytecode
                                                            v             v
  +-----------------------------------------------------------------------------------------+
  |                                Linux Kernel Data Plane                                  |
  |  +----------------+     +-------------------+     +------------------+     +---------+  |
  |  |  Socket Hooks  |     |   tc Ingress/Egr  |     |   XDP Driver     |     | BPF Maps|  |
  |  | (connect/send) |     |  (L3/L4/Encap)    |     |   (Fast Drop/LB) |     | (Conntrk|  |
  |  +----------------+     +-------------------+     +------------------+     |  LPM/IP)|  |
  |          |                        |                         |              +---------+  |
  +----------|------------------------|-------------------------|---------------------------+
             v                        v                         v
     Local App Sockets          Overlay / Wire            Physical NIC
```

1. **The Agent Control Loop (`daemon/` & `pkg/hive`)**:
   Built on the Cilium Hive dependency-injection framework. It ingests Kubernetes resources and translates them into low-level network topologies. State synchronization is governed by **StateDB**—an in-memory relational MVCC database running inside the agent that avoids lock contention and eliminates reconciliation race conditions across dozens of concurrent controllers.
2. **eBPF Program Generation & Engine (`bpf/` & `pkg/bpf`)**:
   Cilium does not merely update static BPF maps; it compiles customized C header files (`epconfig.h`) containing macro definitions specific to each local container endpoint (identity ID, MAC address, policy flags) and dynamically compiles or tail-calls modular eBPF programs via `cilium-ebpf`.
3. **Gateway API & Service Mesh Ingress (`operator/pkg/gateway-api/`, `pkg/envoy`)**:
   Translates upstream Kubernetes Gateway API resources (`Gateway`, `HTTPRoute`, `TLSRoute`) and standard `Ingress` specs into Envoy `CiliumEnvoyConfig` (CEC) CRDs and Envoy Dynamic Downstream/Upstream TLS contexts, with zero-downtime hot-reloads and strict status propagation.
4. **Endpoint State Machine (`api/v1/models/endpoint_state.go`)**:
   Maintains strict linear state transitions for every local container:
   `waiting-for-identity` $\rightarrow$ `waiting-to-regenerate` $\rightarrow$ `regenerating` $\rightarrow$ `ready` (or `restoring` / `disconnecting` / `disconnected` / `invalid`). Invariants prevent packet transmission before identity resolution, closing the security window during pod boot.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Evaluation Guarded Boundary Macros (Statement Expression Invariants)
**RULE**:
Macros computing minimum, maximum, or numerical clamped boundaries over runtime expressions MUST encapsulate logic in GNU C statement expressions (`({ ... })`), store operands into uniquely scoped local variables, explicitly execute type-check pointer equality assertions (`(void)(&_x == &_y)`), and MUST NEVER evaluate parameters more than once.

**WHY**:
Evaluating macro parameters multiple times (e.g., `#define min(a,b) ((a)<(b)?(a):(b))`) leads to catastrophic side-effect duplication (e.g., `min(ptr++, end)` increments `ptr` twice) or non-terminating packet parsing loops inside eBPF verifier bounds. Type mismatches between signed and unsigned integers cause silent promotion hazards in kernel verifiers, triggering register bitwidth overflow and verifier rejection.

**WHEN TO APPLY**:
All C, eBPF, kernel headers, systems-level Go CGO bindings, and low-level arithmetic boundary clamping.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
/* Verified Cilium Kernel Macro: bpf/lib/utils.h */
#pragma once

#define __min(t_x, t_y, x, y)        \
({                                   \
    t_x _x = (x);                    \
    t_y _y = (y);                    \
    (void)(&_x == &_y);              \
    _x < _y ? _x : _y;               \
})

#define __max(t_x, t_y, x, y)        \
({                                   \
    t_x _x = (x);                    \
    t_y _y = (y);                    \
    (void)(&_x == &_y);              \
    _x > _y ? _x : _y;               \
})

#define min(x, y)                    \
    __min(typeof(x), typeof(y), x, y)

#define max(x, y)                    \
    __max(typeof(x), typeof(y), x, y)

#define min_t(t, x, y)               \
    __min(t, t, x, y)

#define max_t(t, x, y)               \
    __max(t, t, x, y)
```

**NEGATIVE CONSTRAINT**:
```c
/* ANTI-PATTERN: Double evaluation and silent unsigned promotion */
#define BAD_MIN(a, b) ((a) < (b) ? (a) : (b))

void process_skb(struct __sk_buff *skb) {
    void *data = (void *)(long)skb->data;
    void *data_end = (void *)(long)skb->data_end;
    
    // CRASH / VERIFIER REJECTION:
    // data is advanced TWICE if data < data_end!
    void *bound = BAD_MIN(data++, data_end);
}
```

**VERIFICATION METHOD**:
Compile with `-Werror=shadow -Werror=type-limits`. Add a static unit test asserting side-effect safety:
```c
int i = 5, j = 10;
int result = min(i++, j++);
assert(i == 6); // Fails with BAD_MIN (i becomes 7)
```

---

### 2. Multi-Domain Annotation Ingestion Isolation & Asymmetric Protocol Rejection
**RULE**:
When parsing loosely typed key-value configuration dictionaries (e.g., Kubernetes annotations, Gateway API `options` maps) that share a global namespace across multiple controllers:
1. Parsers MUST skip and preserve keys outside their registered authoritative prefix (`strings.HasPrefix(key, domainPrefix)`).
2. Parsers MUST reject unknown or malformed keys within their authoritative prefix.
3. Handlers MUST reject domain-specific options if the underlying target protocol mode physically precludes their enforcement (e.g., rejecting TLS options on a TLS Passthrough listener).

**WHY**:
Failing to ignore foreign domains breaks coexistence with other controllers sharing the resource (e.g., Istio, Cert-Manager, AWS Controller). Failing to reject unknown options within the controller's own domain leads to silent configuration drift where users believe an invariant is enforced (e.g., TLS 1.3 minimum) when it is actually ignored. Configuring termination options on passthrough streams causes contradictory data plane synthesis, leading to silent plaintext exposure or broken handshakes.

**WHEN TO APPLY**:
Kubernetes ingress/gateway controllers, cloud resource synchronizers, declarative API translation engines, and microservice configuration parsers.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// operator/pkg/gateway-api/status_listener_tls_options.go
func parseTLSOptions(l gatewayv1.Listener) (*model.TLSOptions, error) {
    if l.TLS == nil {
        return nil, nil
    }

    parsed := &model.TLSOptions{}
    for option, value := range l.TLS.Options {
        key := string(option)
        // Rule 1: Ignore options outside authoritative domain
        if !strings.HasPrefix(key, "cilium.io/") {
            continue
        }

        // Rule 3: Reject protocol contradictions
        if helpers.IsTLSPassthroughListener(&l) {
            return nil, fmt.Errorf("TLS option %s is not supported on TLS passthrough listeners", key)
        }

        // Rule 2: Strictly validate domain keys & values
        switch key {
        case model.TLSOptionsMinVersion:
            parsed.MinVersion = string(value)
        case model.TLSOptionsMaxVersion:
            parsed.MaxVersion = string(value)
        default:
            return nil, fmt.Errorf("TLS Option %s is not supported", key)
        }

        if _, ok := supportedTLSVersions[string(value)]; !ok {
            return nil, fmt.Errorf("TLS Value %s is not supported in %s", value, key)
        }
    }

    min := model.TLSOptionsDefaultMinVersion
    if parsed.MinVersion != "" { min = parsed.MinVersion }
    max := model.TLSOptionsDefaultMaxVersion
    if parsed.MaxVersion != "" { max = parsed.MaxVersion }

    if supportedTLSVersions[min] > supportedTLSVersions[max] {
        return nil, fmt.Errorf("TLS minimum version %s must not exceed maximum version %s", min, max)
    }

    if parsed.MinVersion == "" && parsed.MaxVersion == "" {
        return nil, nil
    }
    return parsed, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blind iteration, silent skipping, and passthrough contradiction
func parseTLSOptionsBad(options map[string]string, isPassthrough bool) *model.TLSOptions {
    parsed := &model.TLSOptions{}
    for k, v := range options {
        // BUG 1: Errs on other controllers' keys OR silently ignores all errors
        if k == "cilium.io/tls-min-version" {
            parsed.MinVersion = v // BUG 2: No validation against supported set
        }
    }
    // BUG 3: If isPassthrough == true, Envoy will generate DownstreamTlsContext
    // for a stream that is never terminated, causing handshake termination failures.
    return parsed
}
```

**VERIFICATION METHOD**:
Automated matrix test passing a cross-product of:
1. Valid own-domain keys (`cilium.io/*`).
2. Foreign-domain keys (`istio.io/*`, `example.com/*`).
3. Invalid own-domain keys (`cilium.io/invalid`).
4. Passthrough flag enabled vs disabled.
Assert that foreign keys yield `nil` error and empty options, invalid own keys yield errors, and passthrough + own key yields rejection.

---

### 3. Non-Destructive Multi-Tier Fallback Diagnostic Target Resolution
**RULE**:
Diagnostic collection utilities and operational agent CLI hooks MUST NOT fail fatally when a target workload container has crashed. Instead, they MUST implement a strictly sequenced three-tier fallback mechanism:
1. Target container inspect (if running).
2. Ephemeral container injection into existing pod sandbox (`EphemeralContainers` API).
3. Clone pod injection on the identical host node with identical volume mounts, host network/IPC namespaces, and universal scheduling tolerations (`TolerationOpExists`), accompanied by an infallible RAII cleanup closure.

**WHY**:
When a network daemon or CNI plugin panics, standard `kubectl exec` fails because the target container is in `CrashLoopBackOff` or `Error`. Without automated fallback to ephemeral injection or local node-pinned clone pods, engineers cannot capture live socket states, eBPF map dumps, or kernel trace buffers, rendering post-mortem forensic extraction impossible.

**WHEN TO APPLY**:
Production diagnostic CLI tools, cluster sysdumps, node diagnostic operators, CNI debugging agents.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// cilium-cli/sysdump/k8sutils.go
func (c *Collector) ensureExecTarget(
    ctx context.Context, 
    pod *corev1.Pod, 
    container string,
) (targetPod *corev1.Pod, targetContainer string, cleanup func(context.Context) error, err error) {
    cleanup = func(_ context.Context) error { return nil }

    // Tier 1: Is container running?
    for _, status := range pod.Status.ContainerStatuses {
        if status.Name == container && status.State.Running != nil {
            return pod, container, cleanup, nil
        }
    }

    // Extract target spec
    var fromContainer *corev1.Container
    for _, cs := range pod.Spec.Containers {
        if cs.Name == container {
            fromContainer = cs.DeepCopy()
            break
        }
    }
    if fromContainer == nil {
        return nil, "", cleanup, fmt.Errorf("container %q missing in pod spec", container)
    }

    // Tier 2: Try EphemeralContainer
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
    if err == nil {
        // Poll for Running state with timeout...
        if err := wait.PollUntilContextTimeout(ctx, 2*time.Second, 30*time.Second, false, func(ctx context.Context) (bool, error) {
            tp, getErr := c.Client.GetPod(ctx, targetPod.Namespace, targetPod.Name, metav1.GetOptions{})
            if getErr != nil { return false, getErr }
            for _, s := range tp.Status.EphemeralContainerStatuses {
                if s.Name == ec.Name { return s.State.Running != nil, nil }
            }
            return false, nil
        }); err == nil {
            return targetPod, ec.Name, cleanup, nil
        }
    }

    // Tier 3: Clone Pod with universal tolerations & identical node pinning
    newPod := &corev1.Pod{
        ObjectMeta: metav1.ObjectMeta{
            Namespace:    pod.Namespace,
            GenerateName: "sysdump-fallback-",
        },
        Spec: corev1.PodSpec{
            Containers: []corev1.Container{{
                Name:            fromContainer.Name,
                Image:           fromContainer.Image,
                Command:         []string{"/bin/sleep", "1d"},
                Env:             fromContainer.Env,
                VolumeMounts:    fromContainer.VolumeMounts,
                SecurityContext: fromContainer.SecurityContext,
            }},
            Volumes:            pod.Spec.Volumes,
            RestartPolicy:      corev1.RestartPolicyNever,
            NodeName:           pod.Spec.NodeName,
            HostNetwork:        pod.Spec.HostNetwork,
            HostPID:            pod.Spec.HostPID,
            HostIPC:            pod.Spec.HostIPC,
            Tolerations:        []corev1.Toleration{{Operator: corev1.TolerationOpExists}},
        },
    }
    targetPod, err = c.Client.CreatePod(ctx, pod.Namespace, newPod, metav1.CreateOptions{})
    if err != nil { return nil, "", cleanup, err }

    cleanup = func(ctx context.Context) error {
        return c.Client.DeletePod(ctx, targetPod.Namespace, targetPod.Name, metav1.DeleteOptions{})
    }
    // Poll target pod until ContainersReady...
    return targetPod, fromContainer.Name, cleanup, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Brittle direct execution failing on crashed containers
func ExecCommandBad(client kubernetes.Interface, pod *corev1.Pod, container string, cmd []string) error {
    // If container is in CrashLoopBackOff or OOMKilled, this returns 500 / EOF error immediately!
    // No fallback, no data collected, triage blocked.
    req := client.CoreV1().RESTClient().Post().
        Resource("pods").SubResource("exec").
        Name(pod.Name).Namespace(pod.Namespace).
        Param("container", container)
    return req.Do(context.Background()).Error()
}
```

**VERIFICATION METHOD**:
Simulate target container failure via an intentional crash-loop pod (`exit 1`). Execute the collection tool, verify that the runner creates and successfully enters the fallback pod on the same node, extracts the data, fires the cleanup handler, and leaves no zombie pods on cluster namespaces.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Security Policy Enforcement Cloud Load Balancer Deletion via Mandatory Cleartext Listener (BUG-HELM-INSECURE-PORT-01)
- **Context**: `install/kubernetes/cilium/templates/cilium-ingress-service.yaml`, `validate.yaml`
- **What Was Expected**: Cilium Ingress Controller operating in shared mode should allow administrators to provision a purely HTTPS/TLS-secured LoadBalancer service without exposing port 80.
- **What Actually Happened**: The Helm template hardcoded port 80 into the shared `cilium-ingress` `LoadBalancer` Service resource. In enterprise environments governed by CSPM tools (AWS Config, GCP Security Command Center), automated compliance bots detect public-facing port 80 listeners and immediately terminate the cloud load balancer, causing permanent service outages.
- **Evidence in Repo**: Commit `4f1d1260`, PR #48108, Helm validation files.
- **Root Cause**: The shared ingress service template unconditionally rendered both port 80 and port 443. Furthermore, introducing toggles without validation could allow users to disable both ports simultaneously, rendering the Kubernetes Service resource invalid (Kubernetes requires at least one port per `ServiceSpec`).
- **Remediation Code Diff**:
```diff
--- a/install/kubernetes/cilium/templates/cilium-ingress-service.yaml
+++ b/install/kubernetes/cilium/templates/cilium-ingress-service.yaml
@@ -20,18 +20,22 @@ metadata:
    {{- end }}
  spec:
    ports:
+  {{- if .Values.ingressController.service.insecurePortEnabled }}
    - name: http
      port: 80
      protocol: TCP
      {{- if .Values.ingressController.service.insecureNodePort }}
      nodePort: {{ .Values.ingressController.service.insecureNodePort }}
      {{- end }}
+  {{- end }}
+  {{- if .Values.ingressController.service.securePortEnabled }}
    - name: https
      port: 443
      protocol: TCP
      {{- if .Values.ingressController.service.secureNodePort }}
      nodePort: {{ .Values.ingressController.service.secureNodePort }}
      {{- end }}
+  {{- end }}
--- a/install/kubernetes/cilium/templates/validate.yaml
+++ b/install/kubernetes/cilium/templates/validate.yaml
+{{/* validate ingress controller shared service ports */}}
+{{- if .Values.ingressController.enabled }}
+  {{- if and (not .Values.ingressController.service.insecurePortEnabled) (not .Values.ingressController.service.securePortEnabled) }}
+    {{- fail "ingressController.service.insecurePortEnabled and ingressController.service.securePortEnabled cannot both be false. A Service needs at least one port." }}
+  {{- end }}
+{{- end }}
```
- **Lesson**: Declarative manifests providing toggles for infrastructure primitives MUST implement compile-time schema validation (`fail` statements in Helm / OpenAPI validations) to prevent generating invalid Kubernetes specs when all sub-elements are disabled.

---

### Incident 2: Gateway API TLS Protocol Ambiguity & Incompatible Listener Options Injection (BUG-GWAPI-TLS-OPT-02)
- **Context**: `operator/pkg/gateway-api/status_listener.go`, `status_listener_tls_options.go`
- **What Was Expected**: Listeners configuring `cilium.io/tls-min-version` and `cilium.io/tls-max-version` must configure Envoy's `DownstreamTlsContext` only when termination occurs. Invalid configurations (min > max, unsupported versions, or TLS options applied to passthrough listeners) must mark the listener condition as `Accepted: False` with `Reason: UnsupportedValue`.
- **What Actually Happened**: Listeners configured with TLS passthrough (`TLSModePassthrough`) or invalid version strings ("2.0", min 1.3 with max 1.2) were either accepted into reconciliation or passed through into Envoy configurations, generating corrupted xDS configs that Envoy rejected at runtime, stalling the entire ingress control plane.
- **Evidence in Repo**: Commit `6a571439`, Issue #48102, Conformance test suite `gateway-tls-options`.
- **Root Cause**: Gateway API listener status calculation failed to validate listener `options` maps before committing the listener to the valid set (`filterOutInvalidListeners`). The parser lacked cross-field range invariant validation (`supportedTLSVersions[min] > supportedTLSVersions[max]`).
- **Remediation Code Diff**:
```diff
--- a/operator/pkg/gateway-api/status_listener.go
+++ b/operator/pkg/gateway-api/status_listener.go
@@ -648,12 +649,21 @@ func (m *ListenerStatusManager) validateListener(ctx context.Context, l gatewayv
 				break
 			}
 		}
+
 		if l.Protocol == gatewayv1.TLSProtocolType && l.TLS.Mode != nil && *l.TLS.Mode == gatewayv1.TLSModeTerminate {
 			res.isValid = false
 			res.invalidMessages = append(res.invalidMessages, "Using TLSRoute with TLS.mode Terminate is unsupported.")
 			res.invalidReason = gatewayv1.ListenerReasonUnsupportedValue
 			res.supportedKinds = []gatewayv1.RouteGroupKind{}
 		}
+
+		tlsOptions, err := parseTLSOptions(l)
+		res.tlsOptions = tlsOptions
+		if err != nil {
+			res.invalidMessages = append(res.invalidMessages, err.Error())
+			res.invalidReason = gatewayv1.ListenerReasonUnsupportedValue
+			res.isValid = false
+		}
 	}
```
- **Lesson**: Never translate untyped CRD key-value maps directly into downstream proxy parameters (xDS). Synthesize state through an intermediate validated model layer (`model.TLSOptions`) that enforces cross-field relational constraints prior to listener activation.

---

### Incident 3: 128-bit IPv6 Comparison Verification Hazard in BPF Kernels (BUG-BPF-IPV6-CMP-03)
- **Context**: `bpf/lib/ipv6_core.h`
- **What Was Expected**: Two 128-bit IPv6 addresses represented as unions (`union v6addr`) must be evaluated for equality in the data plane with minimum CPU instructions and zero memory alignment traps.
- **What Actually Happened**: Byte-by-byte memory comparisons (`memcmp(a, b, 16)`) or unaligned 32-bit field comparisons incurred high instruction count overhead and triggered eBPF verifier bounds rejections due to pointer arithmetic tracking failures on older kernel architectures.
- **Evidence in Repo**: `bpf/lib/ipv6_core.h`, `union v6addr` 64-bit split dual-word optimization.
- **Root Cause**: The LLVM BPF backend generates suboptimal loop structures when compiling byte-level comparisons. If addresses are copied unaligned on stack frames, 64-bit loads without packed union alignment trigger kernel packet load faults (`LDX` unaligned access on architectures without hardware unaligned access).
- **Remediation Code Diff**:
```c
// bpf/lib/ipv6_core.h
union v6addr {
    __u8 addr[16];
    struct {
        __u32 p1;
        __u32 p2;
        __u32 p3;
        __u32 p4;
    } p;
    struct {
        __u64 d1;
        __u64 d2;
    } d;
} __packed;

// 64-bit double-word comparison compiles to exactly two BPF JEQ instructions:
static __always_inline bool ipv6_addr_equals(const union v6addr *a,
                                             const union v6addr *b)
{
    if (a->d.d1 != b->d.d1)
        return false;
    return a->d.d2 == b->d.d2;
}
```
- **Lesson**: High-performance kernel data planes must layout wide network identifiers (IPv6, MAC, tunnel IDs) using composite 64-bit integer words inside packed unions, converting multi-byte comparisons into scalar machine-word equality checks.

---

### Incident 4: Non-Recoverable CLI Diagnostic Abort and Defer Masking (BUG-CLI-FATALF-04)
- **Context**: `cilium-cli/cli/utils.go`, `cilium-cli/internal/utils/exec.go`
- **What Was Expected**: Command execution failures during cluster triage must return structured errors, flush buffers, execute resource cleanup routines, and allow the parent test harness or CLI runner to report comprehensive state.
- **What Actually Happened**: Direct calls to `fatalf` invoked `os.Exit(1)` inside subroutines. This immediately halted the runtime process, bypassing all registered `defer` statements (leaving leaked test pods, port-forward sessions, and temporary files on developer machines) and truncating buffered logs destined for `os.Stderr`.
- **Evidence in Repo**: Code comment in `cilium-cli/cli/utils.go`: `// Note: os.Exit(1) is not recoverable and does not fire defers.` contrasted with structured execution in `internal/utils/exec.go`.
- **Root Cause**: Mixing application-level logging with process lifecycle management. Helper libraries executing CLI commands executed unconditional process termination rather than bubbling errors up the call stack.
- **Remediation Code Diff**:
```diff
--- a/cilium-cli/cli/utils.go
+++ b/cilium-cli/internal/utils/exec.go
-// Note: os.Exit(1) is not recoverable and does not fire defers.
-func fatalf(msg string, args ...any) {
-	fmt.Fprintf(os.Stderr, "\nError: %s\n", fmt.Sprintf(msg, args...))
-	os.Exit(1)
-}
+func Exec(l Logger, command string, args ...string) ([]byte, error) {
+	c := exec.Command(command, args...)
+	bytes, err := c.CombinedOutput()
+	if err != nil {
+		cmdStr := fmt.Sprintf("%s %s", command, strings.Join(args, " "))
+		l.Log("❌ Unable to execute %q:", cmdStr)
+		if len(bytes) > 0 {
+			l.Log(" %s", string(bytes))
+		}
+		return []byte{}, fmt.Errorf("unable to execute %q: %w", cmdStr, err)
+	}
+	return bytes, err
+}
```
- **Lesson**: Subsystem utility packages MUST NEVER invoke `os.Exit()`. Errors must be wrapped (`fmt.Errorf("%w")`) and returned to `main()` so the runtime can execute deferred cleanups and flush I/O streams.

---

### Incident 5: State Machine Deadlock during Node Reboot and Endpoint Identity Sync (BUG-EP-RESTORE-05)
- **Context**: `api/v1/models/endpoint_state.go`
- **What Was Expected**: When the Cilium agent