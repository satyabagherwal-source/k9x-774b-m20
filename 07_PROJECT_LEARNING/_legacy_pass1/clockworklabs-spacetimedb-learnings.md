> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clockworklabs-spacetimedb-learnings.md`  
> **Source**: GitHub ([https://github.com/clockworklabs/SpacetimeDB](https://github.com/clockworklabs/SpacetimeDB))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T16:23:56.076Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: clockworklabs/SpacetimeDB

## 1. Executive Forensic Architecture & System Mechanics
SpacetimeDB is a **relational, state-synchronized, multi-language serverless database engine** designed for real-time applications (MMORPGs/Web). It operates by embedding a WASM runtime (for user-defined logic/reducers) directly into the database engine. 

**Architectural Boundaries:**
*   **The WASM Sandbox:** User logic executes in a restricted environment; state changes are transactional and reactive.
*   **The Relational Core:** A custom relational engine that tracks state dependencies to push updates to clients.
*   **The Multi-Language SDK Layer:** Bridges the gap between the Rust-based core and client-side runtimes (C#, TS, C++), handling serialization, WebSocket lifecycle, and WASM-to-Host communication.

## 2. Deep Micro-Learnings & Runtime Gotchas
1.  **Lock Poisoning in Memoization:** Using `std::sync::Mutex` in global/static memoization macros leads to permanent system deadlock if a thread panics while holding the lock.
    *   *Fix:* Use `std::panic::catch_unwind` or `parking_lot`'s `Mutex` which handles poisoning differently, or ensure the memoization cache is cleared/re-initialized on panic.
2.  **WASM Table/Call Incompatibility:** Upgrading host environments (e.g., Emscripten) can silently deprecate low-level WASM bridge functions (`dynCall`).
    *   *Fix:* Implement a feature-detection layer that probes the WASM environment for available call-gate signatures before execution.
3.  **Negative Literal Parsing:** SQL parsers often fail on negative numeric literals if the grammar is strictly defined as `[0-9]+` without handling unary operators in the `INSERT` value clause.
    *   *Fix:* Ensure the lexer/parser treats the unary `-` as a distinct token that can be optionally prepended to numeric literals during AST construction.
4.  **Resource Exhaustion in JWT/Auth:** Byte-source exhaustion (reading from a stream without a length limit) allows malicious payloads to trigger OOM.
    *   *Fix:* Always wrap byte-source readers in `take(MAX_ALLOWED_BYTES)` before passing to cryptographic or parsing logic.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: Strong separation between the Rust core and the WASM-hosted user logic. The boundary is enforced via a strict ABI (Application Binary Interface).
*   **D2: Asynchronous State**: The system relies on "Reducers" (transactions) that must trigger view updates. Failure to link a procedure to a view update is a common state-sync bug.
*   **D3: Error Boundaries**: The system struggles with "Lock Poisoning" and "Panic Propagation" across the Rust/WASM boundary.
*   **D4: Resource Lifecycle**: Heavy reliance on `ArrayPool` in C# SDKs to prevent GC pressure during high-frequency WebSocket message processing.
*   **D5: Deserialization**: The system is highly sensitive to schema changes; `spacetime generate` must be idempotent and handle path-traversal (`..`) safely.
*   **D6: Cross-Platform**: Windows-specific V8/ICU errors indicate that the WASM runtime environment is sensitive to host-OS locale and filesystem pathing.
*   **D7: Build/CI**: The repo uses `cache-warm` and strict versioning to manage the complexity of multi-language SDK generation.
*   **D8: Forensic Patches**: Recent patches focus on "Internal Authority" (ensuring HTTP handlers respect transaction context) and "Sequence Rollback" (ensuring atomicity).

## 4. Net-New Universal Engineering Rules

## 72. The "Poison-Proof" Memoization Rule

**RULE**:
Never use `std::sync::Mutex` for global memoization caches. Use `parking_lot::Mutex` or a `RwLock` with an explicit panic-recovery mechanism.

**WHY**:
Standard library Mutexes become "poisoned" on panic. In a long-running server, a single thread panic will permanently lock the resource, causing a cascading system failure that requires a full process restart.

**WHEN TO APPLY**:
Any global state, singleton caches, or shared configuration objects in Rust services.

## 73. The "WASM-Bridge" Feature Detection Rule

**RULE**:
When bridging host-to-WASM calls, never hardcode the invocation method (e.g., `dynCall`). Implement a runtime probe that checks for the existence of the bridge function and falls back to modern alternatives.

**WHY**:
WASM runtimes (Emscripten, Wasmtime) evolve rapidly. Hardcoded bridge calls are "brittle points" that break during minor host-environment upgrades.

**WHEN TO APPLY**:
Any SDK or system that executes user-defined WASM code.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Panic Audit**: Search for `Mutex::lock()` in the codebase. Replace with `parking_lot` or add `catch_unwind` wrappers.
- [ ] **Path Sanitization**: Verify all CLI tools using `--out-dir` use `std::fs::canonicalize` or equivalent to prevent `..` traversal attacks.
- [ ] **Buffer Management**: Audit all WebSocket/Network message handlers. Ensure they use `ArrayPool` (C#) or `BytesMut` (Rust) to prevent heap fragmentation.
- [ ] **Transaction Authority**: Verify that every HTTP/API handler explicitly validates the `Authority` context before executing a database transaction.
- [ ] **Schema Idempotency**: Ensure the `generate` command creates files in a temporary directory first, then performs an atomic move to the target destination.