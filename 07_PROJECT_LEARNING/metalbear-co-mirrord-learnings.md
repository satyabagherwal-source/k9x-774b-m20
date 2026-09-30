> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/metalbear-co-mirrord-learnings.md`  
> **Source**: GitHub ([https://github.com/metalbear-co/mirrord](https://github.com/metalbear-co/mirrord))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T14:01:58.724Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): metalbear-co/mirrord

## 1. Executive Forensic Architecture & System Mechanics
`mirrord` is a high-fidelity, transparent traffic and file-system redirection engine for Kubernetes. It enables local processes to "inhabit" a remote pod's context by intercepting syscalls (via `LD_PRELOAD` on Linux or `DYLD_INSERT_LIBRARIES` on macOS) and proxying them to a remote agent running in the target pod.

**Architectural Boundaries:**
- **Layer (Client-side):** A shared library that hooks libc/syscalls (file, network, DNS).
- **Agent (Server-side):** A sidecar/ephemeral container in the target pod that executes operations in the pod's namespace.
- **IntProxy:** A mediator for gRPC-based communication between the local layer and the remote agent.

**Critical Abstractions:**
- **`FileManager`**: Manages remote file descriptors, symlink resolution, and path mapping (Host vs. Target root).
- **`HookManager`**: Manages the lifecycle of syscall interception.
- **`PathResolver`**: A critical security boundary that prevents Local File Inclusion (LFI) by ensuring resolved paths remain within the target container's root.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: `fstatat` Path Resolution Double-Prefixing (BUG-PATH-01)
- **Context**: `mirrord/agent/src/file.rs`
- **What Was Expected**: `fstatat` should resolve paths relative to a directory file descriptor correctly within the target root.
- **What Actually Happened**: The agent was double-prefixing the target root, and targetless mode resolved paths relative to the agent's working directory instead of `/`.
- **Evidence**: Commit `86ed1d03`, `changelog.d/+fstatat-dirfd.fixed.md`.
- **Root Cause**: Incorrect state management of `parent_path` during path joining; the code failed to "unresolve" the path before re-joining.
- **Remediation Code Diff**:
```rust
// - RemoteFile::Directory(parent_path) => parent_path.join(path),
// + RemoteFile::Directory(parent_path) => match self.path_resolver.as_ref() {
// +     Some(resolver) => resolver.unresolve(parent_path)?.join(path),
// +     None => parent_path.join(path),
// + },
```
- **Lesson**: When performing path arithmetic in a chroot-like environment, always normalize to the "logical" root before applying relative path components.

### Incident 2: gRPC Fork Deadlock (BUG-SYNC-02)
- **Context**: `mirrord/layer/src/lib.rs`
- **What Was Expected**: Multi-threaded applications using gRPC should be fork-safe.
- **What Actually Happened**: A deadlock occurred because a mutex was held by a thread that was not the one calling `fork()`. The child process inherited the locked mutex, causing subsequent calls to hang.
- **Evidence**: Commit `cb0bacbe`, `COR-1908`.
- **Root Cause**: Lack of `pthread_atfork` handlers to guard global state (sockets, files) during the fork syscall.
- **Lesson**: Global state protected by `std::sync::Mutex` is inherently unsafe across `fork()` in multi-threaded environments.

---

## 3. The 9 Deep Learning Dimensions
1. **Architecture**: Highly decoupled; the layer is a thin shim, the agent is a heavy-duty executor.
2. **Core Abstractions**: `CheckedEnv` provides type-safe environment variable parsing, preventing runtime configuration drift.
3. **Error Handling**: Uses `thiserror` for structured error trees; `graceful_exit!` handles critical failures.
4. **Testing**: Uses `rstest` for parameterized testing of complex path resolution scenarios.
5. **Security**: `PathResolver` enforces strict boundary checks to prevent LFI.
6. **Performance**: Heavy reliance on zero-copy where possible, but syscall interception introduces inherent latency.
7. **Deployment**: Uses `docker run --init` to ensure PID 1 is an init process for proper signal handling.
8. **Agent Patterns**: Uses a "Workload Companion" pattern for serverless environments.
9. **Data Flow**: gRPC streams are used for bi-directional traffic mirroring.

---

## 4. The 8 Learning Extraction Artifacts
1. **Pattern**: `pthread_atfork` handlers for global mutexes.
2. **Rule**: NEVER allow a mutex to be held across a `fork()` call without an `atfork` handler.
3. **Architecture Principle**: "The Agent is the Truth" — the agent must always validate paths against its own root.
4. **Failure Mode**: `EAGAIN` on `stdin` due to `libuv` setting `O_NONBLOCK` on a shared file descriptor.
5. **Reusable Skill**: Use `std::cell::Cell` in thread-local storage to track lock state during fork.
6. **Decision**: Chose `pthread_atfork` over manual lock-dropping to ensure compatibility with user-defined fork handlers.
7. **Anti-pattern**: `curl | sh` without explicit shell invocation (e.g., `bash`).
8. **Verification Method**: `rstest` with `Mode::Targeted` and `Mode::Targetless` to verify path resolution invariants.

---

## 5. Net-New Universal Engineering Rules

## 1. The Fork-Safety Invariant
**RULE**: Any global state protected by a `Mutex` or `RwLock` MUST be guarded by `pthread_atfork` handlers if the process is capable of `fork()`.
**WHY**: In multi-threaded programs, a thread may hold a lock while another thread calls `fork()`. The child process inherits the lock in a "locked" state, but the thread that held it does not exist in the child, leading to permanent deadlock.
**VERIFIED IMPLEMENTATION PATTERN**:
```rust
extern "C" fn atfork_prepare() {
    GLOBAL_LOCK.lock().unwrap();
}
// Register in constructor
```
**NEGATIVE CONSTRAINT**:
```rust
// Never assume a Mutex is safe to use in a child process after fork()
// without explicit synchronization handlers.
```

---

## 6. Actionable Agent Skill & Implementation Checklist
1. **Verify Syscall Interception**: Ensure `LD_PRELOAD` is correctly scoped to the target process.
2. **Validate Path Resolution**: Run path-traversal tests (e.g., `../../etc/passwd`) against the `PathResolver` to ensure it stays within the target root.
3. **Check Fork Safety**: Audit all global `Mutex` instances for `atfork` handlers.
4. **Environment Sanitization**: Use `CheckedEnv` to parse all incoming configuration to prevent injection.
5. **Signal Handling**: Ensure the process runs with an init-like signal handler to prevent zombie processes.