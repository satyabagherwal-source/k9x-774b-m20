> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitnami-sealed-secrets-learnings.md`  
> **Source**: GitHub ([https://github.com/bitnami/sealed-secrets](https://github.com/bitnami/sealed-secrets))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:54:52.351Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: bitnami/sealed-secrets

## 1. Executive Forensic Architecture & System Mechanics
`sealed-secrets` implements a **GitOps-native asymmetric encryption bridge** for Kubernetes. It solves the "Secret-in-Git" paradox by allowing users to encrypt sensitive data locally (using a public key) and decrypting it only within the cluster (using a private key managed by the controller).

**Core Subsystems:**
*   **The Controller (Operator):** A custom controller watching `SealedSecret` CRDs. It manages the private key lifecycle and performs the decryption-to-Secret transformation.
*   **The Client (`kubeseal`):** A CLI tool that fetches the public key from the controller and performs client-side encryption.
*   **The Cryptographic Boundary:** Uses RSA/AES-GCM. The controller acts as a decryption oracle, necessitating strict input validation to prevent side-channel attacks (e.g., oracle attacks).

---

## 2. Deep Micro-Learnings & Runtime Gotchas
1.  **Concurrent Map Mutation Panic:**
    *   **Failure:** Controller panics when starting informers for multiple namespaces in parallel.
    *   **Root Cause:** Go maps are not thread-safe. Concurrent writes during initialization of the informer cache.
    *   **Fix:** Use `sync.Mutex` or `sync.Map` for shared configuration state, or initialize the map before spawning goroutines.
2.  **Decryption Oracle Vulnerability:**
    *   **Failure:** `/v1/rotate` endpoint leaked information about key validity.
    *   **Root Cause:** Improper endpoint authorization/logic allowed unauthenticated or malformed requests to probe the decryption state.
    *   **Fix:** Strict request body size capping and decoupling administrative rotation logic from public-facing endpoints.
3.  **Metrics Leakage (Zombie Metrics):**
    *   **Failure:** Metrics persisted for deleted `SealedSecret` objects.
    *   **Root Cause:** Lack of cleanup logic in the controller's reconciliation loop for Prometheus metrics when a resource is deleted.
    *   **Fix:** Implement `Finalizers` or explicit `defer` blocks to unregister/decrement metrics upon resource deletion.
4.  **Context-Dependent CLI Failure:**
    *   **Failure:** `kubeseal` fails without an active `kubectl` context.
    *   **Root Cause:** Hard dependency on local kubeconfig for fetching the public key.
    *   **Fix:** Implement a fallback mechanism (e.g., `--cert` flag) to allow offline sealing without cluster connectivity.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries:** The separation between the `kubeseal` CLI and the controller is clean, but the controller's reliance on `scheme` registration is a common point of failure in K8s operators.
*   **D2: Concurrency Defense:** The recent panic (Issue #2045) highlights that even mature Go projects struggle with shared state in `init()` or startup phases.
*   **D3: Error Boundaries:** The controller must treat every decryption request as potentially malicious. Input sanitization is the primary defense against oracle attacks.
*   **D4: Resource Lifecycle:** Metrics and Informers are the primary sources of memory leaks. Always pair `AddEventHandler` with a cleanup strategy.
*   **D5: Deserialization:** The fix for `/v1/rotate` (capping request body size) is a classic defense against DoS via memory exhaustion.
*   **D6: Compatibility:** Helm chart typos and network policy conflicts (Issue #1469) demonstrate that infrastructure-as-code (IaC) requires the same unit testing rigor as application code.
*   **D7: CI/CD:** Heavy reliance on `dependabot` for Go dependencies is standard, but requires automated integration testing to catch breaking changes in `controller-runtime`.
*   **D8: Forensic Patches:** The shift from "trusting the request" to "validating the request size and origin" is the most critical security evolution in this repo.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Concurrent Map Initialization" Invariant

**RULE**:
Never initialize or modify a shared map across goroutine boundaries during the startup phase of a controller or service.

**WHY**:
Go's runtime will trigger a fatal panic on concurrent map writes. Even if the code appears sequential, hidden goroutines (e.g., informer caches, metrics collectors) often trigger initialization logic simultaneously.

**WHEN TO APPLY**:
Any Kubernetes Operator, Controller, or high-concurrency Go service using `map[string]interface{}` for configuration or state tracking.

---

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Concurrency Audit:** Scan for `map` access inside `go` routines. Replace with `sync.Map` or wrap in a `Mutex` struct.
- [ ] **Input Hardening:** For all HTTP endpoints, enforce `http.MaxBytesReader` to prevent large-payload DoS attacks.
- [ ] **Lifecycle Verification:** Ensure every `Register` or `Add` operation has a corresponding `Unregister` or `Remove` in the cleanup/shutdown path.
- [ ] **IaC Validation:** Treat Helm charts as code. Use `kube-linter` or `polaris` to validate `ServiceMonitor` and `NetworkPolicy` selectors against actual deployment labels.
- [ ] **Oracle Defense:** Ensure decryption endpoints return generic errors (e.g., "invalid request") rather than specific cryptographic failure details to prevent side-channel analysis.