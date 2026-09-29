> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: GitHub ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T16:23:32.709Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: freenet/freenet-core

## 1. Executive Forensic Architecture & System Mechanics
Freenet-core is a decentralized P2P substrate designed for censorship-resistant data storage and execution. It operates as a **distributed state machine** where "Contracts" (data/logic containers) are replicated across a DHT. 
- **Core Abstractions**: 
    - **Delegates**: Sandboxed execution units that manage state transitions.
    - **Renegade Router**: A time-sensitive routing mechanism for DHT propagation.
    - **Contract Sandbox**: An isolated environment (likely WASM-based) for executing untrusted code.
    - **Update/Service Layer**: A system-level manager handling auto-updates and persistent state across OS-level service users.

## 2. Deep Micro-Learnings & Runtime Gotchas
1. **Time-Source Coupling**: Using `std::time::Instant` or `SystemTime` directly in logic (e.g., Renegade clock) breaks determinism and testability. 
   - *Fix*: Inject a `TimeSource` trait to allow mock-time injection during testing.
2. **Race Conditions in Stream Registration**: A classic "Check-then-Act" race between `claim` and `register` operations leads to orphaned streams.
   - *Fix*: Use atomic state transitions or a single-owner registry lock that enforces an "all-or-nothing" registration.
3. **Service User Path Assumptions**: Hardcoding paths like `~/.config` fails in headless service environments (e.g., `systemd` users with no home directory).
   - *Fix*: Use platform-agnostic crate `directories` or explicit environment variable overrides for state storage.
4. **Error Code Semantic Mismatch**: Returning `500 Internal Server Error` for missing assets (404) masks client-side errors as server-side failures.
   - *Fix*: Implement a strict mapping layer between domain-specific errors and HTTP status codes.
5. **Persistence Prematurity**: Persisting container parameters *before* contract verification allows malicious/malformed state to pollute the disk.
   - *Fix*: Implement a "Verify-then-Commit" pattern; never write to persistent storage until the cryptographic signature/schema validation passes.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
- **D1: Structural Boundaries**: Strong separation between the "Network/DHT" layer and the "Execution/Delegate" layer.
- **D2: Asynchronous State**: High reliance on `async` streams; prone to "stranded" states if cancellation tokens aren't propagated.
- **D3: Error Boundaries**: Moving toward typed error handling (e.g., `Missing` delegate type) to avoid generic `Option` or `Result` ambiguity.
- **D4: Resource Lifecycle**: Managing file descriptors for web assets and contract sandboxes; requires RAII-based cleanup.
- **D5: Deserialization**: Contract parameters are high-risk; must be validated against a schema before instantiation.
- **D6: Cross-Platform**: NixOS modules and service-user compatibility indicate a focus on "install-and-forget" server deployments.
- **D7: Build/CI**: Order-dependent tests (e.g., `homepage_renders_dynamic_title`) indicate shared global state in test suites.
- **D8: Forensic Patches**: Recent focus on "lockout expiration" suggests a move toward self-healing systems that don't require manual intervention after transient failures.

## 4. Net-New Universal Engineering Rules

## 73. The "Verify-Before-Persist" Invariant

**RULE**:
Never write to persistent storage (disk, database, or registry) until the input data has passed all cryptographic, schema, and structural validation checks.

**WHY**:
Writing unverified data creates "poisoned state" that can crash the system on restart, bypass security checks, or lead to disk-space exhaustion attacks.

**WHEN TO APPLY**:
Any system handling external input, P2P messages, or user-defined contract parameters.

## 74. The "Time-Injection" Pattern

**RULE**:
All time-dependent logic (timeouts, clocks, scheduling) must consume a `TimeSource` trait rather than calling system-level time APIs directly.

**WHY**:
Direct system calls make distributed systems non-deterministic, impossible to unit test for race conditions, and prone to failure during system clock synchronization (NTP jumps).

**WHEN TO APPLY**:
Distributed DHTs, consensus algorithms, and any system with retry-lockout logic.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Dependency Audit**: Ensure all file-system paths are resolved via `std::env` or `directories` crate, never hardcoded `~`.
- [ ] **Concurrency Check**: Audit all `claim`/`register` patterns for atomic state transitions. Use `tokio::sync::Mutex` or `RwLock` if necessary.
- [ ] **Test Determinism**: Verify that no test relies on global state or execution order. Use `serial_test` if global state is unavoidable.
- [ ] **Error Mapping**: Ensure every domain error has a corresponding HTTP/RPC status code mapping.
- [ ] **Persistence Guard**: Verify that `write_to_disk` calls are guarded by a `validate()` function call.
- [ ] **Time Injection**: Replace `SystemTime::now()` with a `Clock` trait in all business logic.