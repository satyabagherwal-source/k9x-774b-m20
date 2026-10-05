> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubernetes-sigs-aws-load-balancer-controller-learnings.md`  
> **Source**: GitHub ([https://github.com/kubernetes-sigs/aws-load-balancer-controller](https://github.com/kubernetes-sigs/aws-load-balancer-controller))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T20:20:59.421Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: kubernetes-sigs/aws-load-balancer-controller

## 1. Executive Forensic Architecture & System Mechanics
The `aws-load-balancer-controller` acts as a high-fidelity bridge between Kubernetes control plane primitives (Ingress, Gateway API, Service) and AWS infrastructure (ALB, NLB, Target Groups). 

**Architectural Boundaries:**
*   **Reconciliation Loop:** Operates on a standard controller-runtime pattern, mapping K8s object state to AWS API state.
*   **Abstraction Layer:** Decouples K8s `Service` ports from AWS `TargetGroup` abstractions.
*   **State Synchronization:** Manages the "Source of Truth" conflict between K8s etcd and AWS Cloud provider state.

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **Failure Mode: Non-Deterministic Reconciliation (CIDR Canonicalization)**
    *   **Root Cause:** AWS API returns CIDRs in a specific format (e.g., `10.0.0.0/24`), but K8s inputs may vary. Comparing raw strings leads to infinite reconciliation loops.
    *   **Fix:** Always normalize/canonicalize network inputs (using `net.ParseCIDR`) before performing equality checks against existing AWS state.
*   **Failure Mode: Tombstone Handling in Informers**
    *   **Root Cause:** `DeletedFinalStateUnknown` objects occur when the controller misses a delete event. Accessing the object directly without checking the tombstone type causes nil pointer dereferences.
    *   **Fix:** Use `cache.DeletionHandlingMetaNamespaceKeyFunc` or explicitly type-assert the tombstone in `DeleteFunc`.
*   **Failure Mode: Duplicate Target Group Naming**
    *   **Root Cause:** Services with multiple named ports can trigger multiple reconciliation requests that resolve to the same AWS Target Group name, causing API collisions.
    *   **Fix:** Implement a deterministic hashing or naming strategy that incorporates the port name/number into the AWS resource tag/name.
*   **Failure Mode: WAF ACL Empty String Injection**
    *   **Root Cause:** Passing an empty string to AWS SDKs for WAF configuration often triggers a validation error rather than a "no-op."
    *   **Fix:** Explicitly filter out empty strings in the reconciliation logic before invoking the AWS SDK.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: Strong separation between `pkg/ingress` (legacy) and `pkg/gateway` (modern). Logic is partitioned by AWS resource type (ELBv2, WAF, etc.).
*   **D2: Asynchronous State**: High reliance on `controller-runtime` caches. The primary risk is "stale state" where the AWS API has moved forward, but the local informer cache has not yet updated.
*   **D3: Error Boundaries**: Heavy use of `reconcile.Result{RequeueAfter: ...}` to handle eventual consistency of AWS resources.
*   **D4: Resource Lifecycle**: The controller manages external AWS resources; manual deletion of these resources by users creates "orphan" state in K8s, requiring robust finalizers.
*   **D5: Input Sanitization**: Critical need for CIDR canonicalization and string trimming (WAF/Tags).
*   **D6: Runtime Compatibility**: Heavily dependent on AWS SDK v2; requires careful handling of context timeouts during long-running AWS API calls.
*   **D7: Build/CI/CD**: E2E tests are highly sensitive to image availability. Mirroring images to internal registries is a mandatory pattern for stability.
*   **D8: Forensic Patches**: The shift toward `TargetGroupBinding` (TGB) requires strict protection against manual user interference; documentation and validation are the only defenses against "drift."

## 4. Net-New Universal Engineering Rules

## 72. The Canonicalization Invariant

**RULE**:
All external inputs representing network identifiers (CIDRs, IPs, Hostnames) or resource identifiers (ARNs, Names) must be passed through a canonicalization function before comparison with existing system state.

**WHY**:
External APIs (AWS/GCP/Azure) and internal K8s manifests often use different formatting for the same logical entity. String-based equality checks will fail, triggering infinite reconciliation loops and unnecessary API churn.

**WHEN TO APPLY**:
Any controller or middleware that synchronizes local state with an external API provider.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Informer Safety**: Verify all `DeleteFunc` implementations handle `cache.DeletedFinalStateUnknown`.
- [ ] **Input Normalization**: Audit all API-bound structs for string fields that require normalization (CIDRs, trimmed whitespace).
- [ ] **Deterministic Naming**: Ensure all generated AWS resource names include a hash of the source K8s object metadata to prevent collisions.
- [ ] **Finalizer Logic**: Ensure every created external resource has a corresponding finalizer to prevent orphaned cloud infrastructure.
- [ ] **E2E Stability**: Verify that all test images are mirrored to a stable, controlled registry to prevent CI flakiness due to upstream image pulls.