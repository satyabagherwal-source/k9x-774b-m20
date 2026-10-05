> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/stakater-reloader-learnings.md`  
> **Source**: GitHub ([https://github.com/stakater/Reloader](https://github.com/stakater/Reloader))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:55:03.811Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: stakater/Reloader

## 1. Executive Forensic Architecture & System Mechanics
Reloader is a Kubernetes controller that implements an **Event-Driven Reconciliation Loop** to bridge the gap between external configuration changes (ConfigMaps/Secrets) and workload restarts (Deployments/StatefulSets). 

**Core Mechanics:**
*   **Watch-Triggered Reconciliation:** Uses `k8s.io/client-go` Informers to watch for `Update` events on ConfigMaps/Secrets.
*   **Annotation-Based Discovery:** Uses custom annotations (e.g., `reloader.stakater.com/reload`) to map configuration dependencies to target workloads.
*   **State Injection:** Triggers rolling updates by patching the `spec.template.metadata.annotations` of the target workload with a hash of the configuration data.
*   **Boundary:** Operates as a cluster-wide or namespace-scoped controller; it is essentially a "side-effect engine" that transforms configuration state into workload lifecycle events.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

1.  **Regex Panic Vector:**
    *   **Failure:** Controller panics when processing malformed regex in reload annotations.
    *   **Root Cause:** Lack of `recover()` or pre-validation on user-provided regex strings before `regexp.Compile`.
    *   **Fix:** Always validate regex patterns at the admission controller level or via a `regexp.Compile` check before adding to the internal watch-map.

2.  **Non-Positive Duration Logic:**
    *   **Failure:** System accepts `0` or negative values for `pause-period`, leading to tight-loop thrashing or undefined behavior in the reconciliation ticker.
    *   **Root Cause:** Missing input sanitization on configuration parameters.
    *   **Fix:** Implement a strict `if duration <= 0 { return fmt.Errorf(...) }` guard at the configuration parsing layer.

3.  **Dependency Vulnerability Propagation:**
    *   **Failure:** CVEs in transitive dependencies (e.g., `golang.org/x/text`).
    *   **Root Cause:** Deep dependency trees in Go projects often pull in outdated sub-packages.
    *   **Fix:** Use `go mod tidy` and `go list -m all` to audit dependencies; enforce `dependabot` or equivalent automated PRs for security patches.

4.  **Lease/Lock Cleanup:**
    *   **Failure:** Leftover `Lease` objects in the cluster after controller migration or deletion.
    *   **Root Cause:** Controller logic failing to handle graceful shutdown or cleanup of leader-election artifacts.
    *   **Fix:** Implement `context.Context` cancellation hooks that trigger a cleanup routine for cluster-scoped resources.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

*   **D1: Structural Boundaries:** Reloader separates the *Watcher* (Informer) from the *Mutator* (Patching logic). This is critical for testing; the mutator can be unit-tested without a live K8s API.
*   **D2: Asynchronous State:** The system relies on eventual consistency. The "hash" mechanism is the source of truth—it prevents unnecessary restarts if the hash hasn't changed.
*   **D3: Error Boundaries:** The controller uses a queue-based worker pattern. If a reconciliation fails, it uses `utilruntime.HandleError` to requeue the item with exponential backoff.
*   **D4: Resource Lifecycle:** High-frequency watches can lead to memory pressure. Reloader mitigates this by filtering events early in the `EventHandlers`.
*   **D5: Deserialization:** Uses `k8s.io/apimachinery` for robust YAML/JSON handling. Custom annotations must be treated as untrusted input.
*   **D6: Compatibility:** Heavily dependent on `client-go` versions. Upgrading Go versions (e.g., 1.26.8) requires verifying `spdystream` and other low-level network dependencies.
*   **D7: CI/CD:** The repo uses a multi-stage release process (Beta/Enterprise/Stable). The use of `subcharts` allows for modular feature toggling (Enterprise vs. Open Source).
*   **D8: Forensic Patches:** Recent patches focus on "hardening" (rejecting bad inputs) rather than adding features, indicating a mature, stable codebase.

---

## 4. Net-New Universal Engineering Rules

### Rule 72: The "Input-to-Panic" Boundary Guard

**RULE**: 
Any user-provided string that is passed to a compiler (Regex, Template, SQL, or Expression Language) must be validated against a "Safe-Compile" check before being stored in the application state.

**WHY**: 
Runtime panics in long-running controllers (like K8s operators) are catastrophic; they crash the entire reconciliation loop, stopping all updates for the cluster.

**WHEN TO APPLY**: 
Any controller or service that parses custom annotations, labels, or CRD fields.

---

## 5. Actionable Agent Skill & Implementation Checklist

- [ ] **Validation Layer:** Does the code validate all configuration inputs (durations, regex, selectors) *before* they enter the `Reconcile` loop?
- [ ] **Panic Safety:** Are there `defer recover()` blocks in high-concurrency worker routines?
- [ ] **Dependency Audit:** Is `go.mod` checked against the latest security advisories for transitive dependencies?
- [ ] **Graceful Shutdown:** Does the controller handle `SIGTERM` by cleaning up `Lease` objects and finishing current reconciliations?
- [ ] **Idempotency:** Is the `Patch` operation idempotent? (i.e., does it check if the hash already matches before sending an API request?)