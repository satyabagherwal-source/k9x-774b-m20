> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrispybacon-dev-dockflare-learnings.md`  
> **Source**: GitHub ([https://github.com/ChrispyBacon-dev/DockFlare](https://github.com/ChrispyBacon-dev/DockFlare))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T07:44:57.032Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: ChrispyBacon-dev/DockFlare

## 1. Executive Forensic Architecture & System Mechanics
DockFlare acts as a **declarative abstraction layer** between Docker container metadata (labels) and Cloudflare’s Zero Trust/Tunnel API. It functions as an **event-driven reconciliation loop**:
*   **Ingress Controller Pattern**: Monitors Docker socket events to dynamically provision/deprovision Cloudflare Tunnels and Access Policies.
*   **State Reconciliation**: Maintains a local state (often cached) to bridge the gap between ephemeral container lifecycles and persistent cloud infrastructure.
*   **Hybrid Configuration**: Merges UI-defined overrides with Docker-label-defined defaults, creating a complex state-merging problem where "source of truth" conflicts are frequent.

---

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **Failure Mode: The "Ghost Override" Lifecycle Bug**
    *   **Root Cause**: UI-overridden rules (`rule_ui_override: true`) were not correctly reconciled during container lifecycle events (start/restart), causing the system to treat them as transient container-sourced rules.
    *   **Fix**: Implement a **State-Persistence Guard**. Before applying container-label updates, check for the `ui_override` flag in the persistent store. If `true`, ignore label-based updates for that specific key.
*   **Failure Mode: TLD Parsing Fragility**
    *   **Root Cause**: Naive string splitting on `.` for domain parsing fails on multi-part TLDs (e.g., `.co.uk`).
    *   **Fix**: Never implement custom domain splitting. Use `tldextract` or equivalent libraries that utilize the Public Suffix List (PSL).
*   **Failure Mode: Cache Invalidation Mismatch**
    *   **Root Cause**: The application logic assumed a `RedisCache` interface but attempted to use pattern-based invalidation on a `SimpleCache` (in-memory) implementation.
    *   **Fix**: Implement a **Capability-Check Pattern**. Abstract cache operations behind a common interface and throw an `UnsupportedOperationError` at initialization if the configured backend does not support the required feature set.
*   **Failure Mode: Circular Dependency in State Manager**
    *   **Root Cause**: Improper modularization led to `app.core.state_manager` requiring imports from modules that it also provides, causing `ImportError` during runtime redeployments.
    *   **Fix**: Use **Dependency Injection** or a central `Registry` pattern to decouple the state manager from specific command-execution logic.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: The system suffers from "God-Module" syndrome in `state_manager`. Logic for tunnel orchestration and UI state management should be strictly separated.
*   **D2: Async State**: The use of SSE (Server-Sent Events) for dashboard updates creates race conditions where the UI may attempt to reload state before the backend reconciliation loop has finished.
*   **D3: Error Boundaries**: The 500-error on redeploy indicates a lack of "Dry-Run" validation. Commands should be validated against the schema *before* being queued.
*   **D4: Resource Lifecycle**: The "pending_deletion" bug highlights a failure to implement a **Two-Phase Commit** for resource cleanup: (1) Mark for deletion, (2) Verify container state, (3) Execute API deletion.
*   **D5: Deserialization**: Input sanitization is weak; container names with invalid characters are passed directly to the Cloudflare API, causing downstream failures.
*   **D6: Compatibility**: The reliance on Docker labels makes the system highly sensitive to Docker engine versioning and label-parsing nuances.
*   **D7: CI/CD**: The frequent "hotfix" commits suggest a lack of integration testing for the "UI-Override vs. Label" conflict scenario.
*   **D8: Forensic Patches**: The fix for CVE email routes and policy bypasses indicates that security logic was tightly coupled with business logic, allowing policy bypasses to leak into public routes.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Source-of-Truth" Precedence Rule

**RULE**:
When merging state from two sources (e.g., UI vs. Infrastructure Labels), implement a **Precedence Matrix** with an explicit `override_lock` bit. If `override_lock` is set, the secondary source (Labels) must be ignored for that specific field.

**WHY**:
Prevents "Configuration Flapping," where infrastructure events (container restarts) inadvertently overwrite user-defined security policies.

**WHEN TO APPLY**:
Any system that reconciles ephemeral infrastructure state with persistent user-defined configuration.

---

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Schema Validation**: Ensure all input (labels, API payloads) is validated against a Pydantic model *before* reaching the state manager.
- [ ] **Interface Segregation**: Verify that cache backends implement a strict interface; if a feature (e.g., pattern invalidation) is missing, the system must fail-fast at startup.
- [ ] **Lifecycle Testing**: Create a test suite that specifically triggers `container_stop` -> `container_start` while `ui_override` is active to ensure state persistence.
- [ ] **Domain Parsing**: Replace all manual string-split logic for hostnames with `tldextract`.
- [ ] **Dependency Audit**: Run `import-linter` to detect circular dependencies between `core` modules.