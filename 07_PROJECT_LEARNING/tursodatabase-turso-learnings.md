> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tursodatabase-turso-learnings.md`  
> **Source**: GitHub ([https://github.com/tursodatabase/turso](https://github.com/tursodatabase/turso))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T16:23:28.280Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: tursodatabase/turso

## 1. Executive Forensic Architecture & System Mechanics
Turso is a distributed, edge-optimized SQL engine built on libSQL (a fork of SQLite). Its architecture is defined by a **multi-layered abstraction of the database state**:
*   **Core Engine:** A C-based SQLite core wrapped in Rust, requiring strict memory safety boundaries.
*   **Sync Engine:** A state-machine-driven replication layer that manages remote-to-local synchronization.
*   **Language Bindings (JNI/N-API/Wasm):** A high-risk surface area where Rust’s memory safety must be manually enforced against foreign function interfaces (FFI).
*   **Program Builder:** A query-compilation layer that transforms high-level SQL into internal execution plans, requiring strict identifier uniqueness.

## 2. Deep Micro-Learnings & Runtime Gotchas
1.  **FFI Use-After-Free (UAF):**
    *   **Pitfall:** Java/React Native bindings allowed operations on closed connections/statements.
    *   **Root Cause:** The native pointer was not nullified or checked against a "closed" state before dereferencing.
    *   **Fix:** Implement a `State` enum (Open/Closed) in the wrapper object; check state atomically before every FFI call.
2.  **Pragma Scope Leakage:**
    *   **Pitfall:** `page_size` pragma applied to the wrong database in an attached-database environment.
    *   **Root Cause:** Implicit targeting of the default database instead of the specific schema handle.
    *   **Fix:** Explicitly qualify pragma targets (e.g., `PRAGMA main.page_size` vs `PRAGMA temp.page_size`).
3.  **Cursor ID Collision:**
    *   **Pitfall:** `ProgramBuilder` generated non-unique keys for cursors.
    *   **Root Cause:** Using table names as keys without accounting for aliases or scope.
    *   **Fix:** Use a unique, monotonic ID generator or a scoped namespace tuple `(Table, Alias, ScopeID)`.
4.  **Secret Exposure:**
    *   **Pitfall:** Encryption keys stored as raw strings.
    *   **Root Cause:** Memory dumps or logging could expose sensitive material.
    *   **Fix:** Wrap sensitive data in a `Secret<T>` type that implements `Zeroize` and prevents `Debug` trait printing.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries:** Strong separation between the `core` (libSQL) and `bindings` (FFI). The bindings act as a "safety shim" that must validate state before crossing the FFI boundary.
*   **D2: Asynchronous State:** Sync engine uses a state-machine approach to handle remote encryption keys, ensuring keys are never held in plaintext longer than necessary.
*   **D3: Error Boundaries:** The system relies on explicit rejection of operations on closed handles rather than relying on the underlying C-layer to return an error code.
*   **D4: Resource Lifecycle:** High focus on "Host Object" lifetime in React Native/Java. If the host object is GC'd while the native side holds a reference, a crash is inevitable.
*   **D5: Deserialization:** Input sanitization is handled at the `ProgramBuilder` level to prevent SQL injection and cursor collisions.
*   **D6: Cross-Platform:** Heavy reliance on CI pinning (e.g., iOS workload 10.0.401) to prevent non-deterministic build failures in cross-compiled environments.
*   **D7: Dependency Invariants:** Strict removal of non-permissive licenses (CDDL) to maintain a clean supply chain.
*   **D8: Forensic Patches:** The recent patches emphasize "State-Awareness" in FFI—never assume the native pointer is valid just because it isn't null.

## 4. Net-New Universal Engineering Rules

## 72. The FFI State-Guard Invariant

**RULE**:
Every FFI-exposed object must maintain an internal `AtomicState` (Open/Closed/Closing). Any method crossing the FFI boundary must perform an atomic check of this state *before* accessing the underlying native pointer.

**WHY**:
Native pointers are "dumb" memory addresses. If the host language (Java/JS) GC triggers a cleanup while a background thread is accessing the pointer, a UAF occurs. The state guard acts as a software-level lock to prevent access to deallocated memory.

**WHEN TO APPLY**:
Any Rust project exposing a C-ABI or using `bindgen` to create language bindings (JNI, N-API, Wasm).

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **State-Check Verification:** Does every public method in the binding layer check the object's `is_closed` flag?
- [ ] **Zeroize Audit:** Are all cryptographic keys, passwords, and tokens wrapped in a `Zeroize` trait-enabled container?
- [ ] **FFI Pointer Nullification:** Does the `drop` implementation for the native wrapper explicitly nullify the pointer after freeing?
- [ ] **Pragma Qualification:** Are all `PRAGMA` statements in the codebase explicitly qualified with the database schema (e.g., `main.`, `temp.`)?
- [ ] **Dependency License Scan:** Does the `Cargo.toml` or build pipeline include a check for non-permissive licenses (CDDL, GPL) in the dependency tree?