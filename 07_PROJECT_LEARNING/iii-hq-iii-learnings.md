> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/iii-hq-iii-learnings.md`  
> **Source**: GitHub ([https://github.com/iii-hq/iii](https://github.com/iii-hq/iii))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:54:38.234Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: iii-hq/iii

## 1. Executive Forensic Architecture & System Mechanics
`iii` is a polyglot agent-orchestration engine designed to bridge high-level AI agent logic (Python/TypeScript) with low-level infrastructure primitives (Docker/Compose/Sockets). Its architecture centers on a **Configuration-as-Code** engine that dynamically reconciles state between a host environment and containerized workers. The system acts as a middleware layer that manages worker registration, stream multiplexing, and lifecycle orchestration, effectively turning local development environments into distributed agent clusters.

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **Pitfall: Environment Variable Shadowing in Compose.**
    *   **Root Cause:** Generated `.env` files were not explicitly injected into the engine container, causing runtime resolution failures for secrets (e.g., RabbitMQ credentials).
    *   **Fix:** Implement a centralized `ConfigurationService` that explicitly merges runtime overrides with static manifests before container instantiation.
*   **Pitfall: Socket Leakage on Side-Disconnect.**
    *   **Root Cause:** Channel sockets remained open after a participant left, leading to resource exhaustion.
    *   **Fix:** Implement an RAII-based socket manager that triggers an immediate `drop()` or explicit `close()` on the channel handle upon detection of a peer-disconnect signal.
*   **Pitfall: Race Condition in Lifecycle Management.**
    *   **Root Cause:** The engine lifetime was decoupled from the `docker-compose` lifecycle, leading to zombie processes.
    *   **Fix:** Tie the engine process supervisor directly to the `compose` orchestration signal (SIGTERM/SIGINT) to ensure atomic shutdown.
*   **Pitfall: Permission Denied on Data Volume Mounting.**
    *   **Root Cause:** Linux host UID/GID mismatch between the host user and the containerized `configuration` worker attempting to initialize `./data`.
    *   **Fix:** Ensure the entrypoint script performs a `chown` or uses a non-root user with mapped volume permissions before initializing the data directory.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries:** Strong separation between the `engine` (Rust) and `workers` (Python/TS). The boundary is enforced via a registration protocol that is currently sensitive to naming collisions.
*   **D2: Asynchronous State:** High reliance on event-driven streams. The system struggles with "state drift" where the console view lags behind the actual worker registration count.
*   **D3: Error Boundaries:** The system lacks a robust "rollback" mechanism for failed worker registrations, often leaving the engine in a partially registered state.
*   **D4: Resource Lifecycle:** Significant improvements made in socket management; however, file descriptor leaks remain a risk in long-running stream subscriptions.
*   **D5: Deserialization:** Heavy reliance on `config.yaml` and `.env`. The system is vulnerable to schema mismatches when legacy config formats conflict with generated ones.
*   **D6: Cross-Platform:** Linux/macOS/Windows parity issues persist, specifically regarding filesystem permissions and shell execution (e.g., `bun` resolution).
*   **D7: Build/CI:** The project uses a "Mintlify" bot for docs and "Dependabot" for deps, but the core logic relies on complex `docker-compose` generation which is prone to "configuration drift."
*   **D8: Forensic Patches:** Recent patches (e.g., #2231, #2230) demonstrate a shift toward "Runtime-Only Overrides," moving away from static file mutation.

## 4. Net-New Universal Engineering Rules

## 72. The "Orchestrator-Lifecycle" Invariant

**RULE**:
Any managed child process (container, worker, or sidecar) must have its lifecycle strictly bound to the parent orchestrator's signal handler. If the parent dies, the child must receive an immediate SIGTERM, followed by a forced SIGKILL after a deterministic timeout (e.g., 5s).

**WHY**:
Prevents "Zombie Orchestration," where orphaned workers continue to consume resources or hold locks on shared data volumes, leading to "Permission Denied" or "Port Already In Use" errors on subsequent restarts.

**WHEN TO APPLY**:
Any system using `docker-compose`, `k8s` sidecars, or process-spawning supervisors in Rust/Go/Node.js.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Verify Environment Injection:** Ensure all generated `.env` variables are explicitly passed to the container runtime, not just the host shell.
- [ ] **Socket RAII Audit:** Check that every `Stream` or `Channel` object implements `Drop` to close the underlying file descriptor.
- [ ] **Permission Pre-flight:** Add a startup check that verifies write access to data directories *before* the worker attempts to initialize.
- [ ] **Naming Collision Guard:** Implement a unique identifier (UUID) for worker registration to prevent the "double-registration" bug observed in Issue #1407.
- [ ] **Config Precedence:** Enforce a strict hierarchy: `Runtime Overrides > Generated Config > Legacy Config`. Never allow generated files to silently overwrite user-defined legacy settings.