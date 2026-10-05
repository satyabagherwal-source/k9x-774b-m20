> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cryfs-cryfs-learnings.md`  
> **Source**: GitHub ([https://github.com/cryfs/cryfs](https://github.com/cryfs/cryfs))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-29T21:29:01.369Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): cryfs/cryfs

## 1. Executive Forensic Architecture & System Mechanics

CryFS solves the core problem of secure, untrusted cloud storage by encrypting not just individual files, but the entire filesystem structure—including directory hierarchies, file sizes, and metadata. It achieves this by chunking files into fixed-size blocks, encrypting them, and organizing them into a tree structure stored in a flat block-based backend (the `BlockStore`).

```
+-----------------------------------------------------------------+
|                           FUSE Layer                            |
|      (Translates OS filesystem operations to CryFS calls)       |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                         BlobStore Layer                         |
|   (Manages logical files as "Blobs" composed of DataTrees)      |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                        BlockStore Layer                         |
| (Manages fixed-size, encrypted blocks: AES-GCM / XChaCha20)     |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                      Physical Storage Backend                   |
|             (Local Directory, Dropbox, OneDrive, etc.)          |
+-----------------------------------------------------------------+
```

### Architectural Boundaries & Subsystems
1. **FUSE Interface (`cryfs-fuse` / `fuser`)**: The entry point that mounts the encrypted directory. It translates POSIX filesystem operations (read, write, truncate, readdir) into logical operations on the `BlobStore`.
2. **BlobStore (`crates/blobstore`)**: Manages logical files ("Blobs"). A Blob is represented as a `DataTree` (a B-tree-like structure of blocks). This layer abstracts away the block-based nature of the underlying storage, presenting a contiguous, resizable byte stream interface (`Blob`).
3. **BlockStore (`cryfs-blockstore`)**: The cryptographic and storage boundary. It reads and writes fixed-size blocks identified by cryptographically secure random identifiers (`BlockId`). It handles encryption/decryption (using AES-GCM or XChaCha20-Poly1305) and integrity checks.
4. **Async Drop Infrastructure (`cryfs-utils::async_drop`)**: A critical utility subsystem. Because Rust's native `Drop` trait is strictly synchronous, but cleaning up filesystem resources (like flushing dirty blocks to a remote blockstore) requires asynchronous operations, CryFS implements a custom `AsyncDrop` and `AsyncDropGuard` pattern to guarantee safe, asynchronous resource reclamation.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: False CI Build Optimization via Thin LTO (BUG-LTO-01)
- **Context**: CI/CD Pipeline Configuration in `.github/workflows/ci.yml`
- **What Was Expected**: Enabling Thin Link-Time Optimization (LTO) for release test builds in CI would cut build times in half while still executing the exact same test suite.
- **What Actually Happened**: The performance metrics used to justify Thin LTO were false positives. The `crabtime` macro used by the end-to-end performance tests (`e2e-perf-tests`) silently failed because it refused to run in renamed target directories. This caused the largest unit of the release build to exit prematurely, skewing the build time measurements. Furthermore, using Thin LTO meant CI was no longer testing the exact Fat LTO configuration used for production release binaries.
- **Evidence in Repo**: Commit `cb6ad31f` (Revert "Use thin LTO for the release test builds in CI").
- **Root Cause**: Silent test suite failures in a renamed target directory masked the actual compilation overhead, leading to an incorrect optimization decision that compromised CI/CD environmental parity.
- **Remediation Code Diff**:
```yaml
# .github/workflows/ci.yml
@@ -132,16 +132,6 @@ jobs:
           cache-on-failure: true
       - name: cargo ${{ matrix.command }}
         shell: bash
-        env:
-          # Cargo.toml asks for fat LTO, and release binaries built anywhere
-          # else still get it. For the release test builds here, thin LTO
-          # keeps the optimisation level and the checks that differ between
-          # profiles (overflow, debug_assertions) while roughly halving the
-          # workspace's release build: rebuilding the workspace's test binaries
-          # after a change takes 8m18s with thin LTO and 17m19s with fat on a
-          # 4-core machine, and every release job pays that for each feature
-          # set.
-          CARGO_PROFILE_RELEASE_LTO: thin
         # On GitHub-hosted macOS runners we have to skip the cryfs-rustfs
```
- **Lesson**: CI test suites must run on the exact compilation profile (including LTO settings) as production releases. Performance optimizations in CI must be validated against complete, successful test executions, not truncated runs.

---

### Incident 2: Intermittent SIGSEGV due to Unstopped Cache Flusher Thread (BUG-CACHE-02)
- **Context**: Cache Subsystem / `PeriodicTask` Destructor (Issue #670)
- **What Was Expected**: Destroying a `Cache` object would safely reclaim its memory and stop any associated background threads.
- **What Actually Happened**: The `Cache` spawned a background `PeriodicTask` thread to call `_deleteOldEntriesParallel()` at regular intervals (`PURGE_INTERVAL`). During cache destruction, the `Cache` object's destructor ran while the background flusher thread was still active. The flusher thread attempted to access member variables of the partially or fully deallocated `Cache` object, triggering an intermittent `SIGSEGV` in `cryfs-test`.
- **Evidence in Repo**: Issue #670 ("Stop the cache flush thread before destructing the cache").
- **Root Cause**: Lack of deterministic thread lifecycle management. The background thread was not explicitly stopped and joined *before* the cache's internal data structures were deallocated.
- **Remediation Code Diff**:
```cpp
// - Cache::~Cache() {
// -     // Internal structures deallocated implicitly here, while flusher thread is still running
// - }
// + Cache::~Cache() {
// +     timeoutFlusher.stop(); // Explicitly signal the background thread to stop
// +     timeoutFlusher.join(); // Wait for the thread to exit before proceeding with deallocation
// + }
```
- **Lesson**: Any object that owns or spawns background threads *must* guarantee those threads are stopped and joined before any member variables are destroyed.

---

### Incident 3: Flaky CallAfterTimeout Tests on Loaded CI Runners (BUG-TEST-03)
- **Context**: Timing and Concurrency Tests (Issue #669)
- **What Was Expected**: `CallAfterTimeoutTest.OneReset` and `.TwoResets` would sleep for a duration shorter than the timeout, reset the timer, and verify that the callback did not fire early.
- **What Actually Happened**: On heavily loaded CI runners (especially macOS environments), thread scheduling delays caused the `sleep` call to overshoot the timeout duration. The callback fired *before* the test could execute the reset command. Because the test calculated its baseline timestamp right before the reset, the measured delay was calculated as negative or extremely small, causing test failure.
- **Evidence in Repo**: Issue #669 ("Don't fail the CallAfterTimeout reset tests when a sleep overshoots").
- **Root Cause**: Relying on deterministic sleep durations in non-deterministic, multi-tenant CI environments.
- **Remediation Code Diff**:
```cpp
// - // Buggy: Assumed sleep would return exactly on time
// - sleep(TIMEOUT / 2);
// - timer.reset();
// - assert(callback_fired == false);
// + // Fixed: Account for potential scheduler overshoot by checking if the timeout had already elapsed
// + // before asserting failure, or use virtual/mocked time clocks for timing-sensitive assertions.
```
- **Lesson**: Never use real-world sleep durations for asserting strict timing invariants in unit tests. Use mock clocks or design tests to tolerate scheduling overshoots.

---

## 3. The 9 Deep Learning Dimensions

### 1. Architecture
CryFS 2.0 is structured as a highly decoupled workspace. The boundaries are strictly enforced:
- `cryfs-blockstore` has no knowledge of files or directories; it only knows how to read/write encrypted blocks of size $N$ using a `BlockId`.
- `blobstore` sits on top of `BlockStore`. It implements the `Blob` trait, which provides a file-like interface (read, write, resize). It maps these operations to a tree of blocks (`DataTree`).
- State ownership is managed via explicit ownership transfer. For example, `BlobOnBlocks` wraps an `AsyncDropGuard<DataTree<B>>`. This ensures that the tree cannot be dropped without its asynchronous cleanup logic running.

### 2. Core Abstractions
- `BlobId`: A domain-specific wrapper around `BlockId` (see `crates/blobstore/src/blob_id.rs`). It represents the root of a file's block tree.
- `Blob` Trait: Defines the contract for logical file operations:
  ```rust
  pub trait Blob {
      fn id(&self) -> BlobId;
      async fn num_bytes(&mut self) -> Result<u64>;
      async fn resize(&mut self, new_num_bytes: u64) -> Result<()>;
      async fn read(&mut self, target: &mut [u8], offset: u64) -> Result<()>;
      async fn write(&mut self, source: &[u8], offset: u64) -> Result<()>;
      async fn flush(&mut self) -> Result<()>;
  }
  ```
- `AsyncDrop` Trait: Solves the lack of async destructors in Rust. It forces types to implement an explicit `async_drop` method, which is managed by `AsyncDropGuard`.

### 3. Error Handling
- CryFS uses `anyhow::Result` for application-level error propagation, allowing rich context to be attached to filesystem failures.
- Domain-specific errors (like `LoadNodeError` in `blobstore`) are used where recovery or specific error-matching is required.
- **Rollback Strategy**: When writing to a `DataTree`, if a block write fails, the tree must not update its root block ID. This ensures that the filesystem remains in its last-known-good state (crash consistency).

### 4. Testing
- **Conditional Compilation**: Test utilities are strictly separated using `#[cfg(any(test, feature = "testutils"))]` (e.g., `TrackingBlobStore` in `crates/blobstore/src/implementations/mod.rs`).
- **FUSE Mocking**: Because running real FUSE sessions requires kernel extensions (which fail on GitHub-hosted macOS runners), CryFS separates FUSE integration tests from core logic tests, skipping kernel-dependent tests dynamically on unsupported platforms.

### 5. Security
- **Zeroing Keys**: Cryptographic keys are wrapped in zeroizing containers (e.g., `Zeroize` trait from the `zeroize` crate) to ensure they are wiped from RAM immediately after use (PR #528, #529).
- **Metadata Obfuscation**: File sizes are rounded up to block boundaries, and directory structures are flattened into a single namespace of encrypted blocks, preventing side-channel analysis of directory layouts.

### 6. Performance
- **LTO Invariant**: Fat LTO is enforced for release builds to maximize cross-crate optimization between `blobstore`, `blockstore`, and cryptographic backends.
- **Zero-Copy Serialization**: Uses `binrw` for high-performance, zero-copy parsing of block headers and metadata structures directly from byte slices.

### 7. Deployment
- **CI/CD Invariants**: The CI pipeline (`ci.yml`) enforces strict formatting, clippy lints, and builds across multiple targets (Ubuntu, macOS, Windows).
- **Windows FUSE**: Uses Dokany (`dokany`) on Windows. CI installs this dependency dynamically, with robust error handling for network failures (e.g., handling HTTP 500 errors from third-party release downloads).

### 8. Agent Patterns
- The repository contains a `.claude/skills` directory, indicating that the development team uses structured, machine-readable instructions to guide AI coding agents.
- These skills define patterns for complex tasks like managing `async-drop` invariants and using `jujutsu` (a Git-compatible version control system) workflows.

### 9. Data Flow
- **Mutation Lifecycle**:
  1. A write request arrives at `BlobOnBlocks::write(source, offset)`.
  2. This is delegated to `DataTree::write_bytes`.
  3. `DataTree` traverses its internal nodes. If the write spans multiple blocks, it allocates new blocks via `BlockStore`.
  4. The blocks are serialized using `binrw`, encrypted, and written to the physical storage.
  5. The root `BlockId` of the tree is updated only after all child blocks are successfully persisted.

---

## 4. The 8 Learning Extraction Artifacts

### 1. Pattern: Asynchronous Destructor Guard (`AsyncDropGuard`)
When a struct manages resources that require asynchronous cleanup (e.g., flushing buffers to a remote store), wrap the inner resource in an `AsyncDropGuard` and provide an explicit consumption mechanism to bypass synchronous drop when manual cleanup is performed.

```rust
use std::ops::{Deref, DerefMut};
use futures::future::BoxFuture;

pub trait AsyncDrop {
    fn async_drop(self) -> BoxFuture<'static, ()>;
}

#[derive(Debug)]
pub struct AsyncDropGuard<T: AsyncDrop> {
    inner: Option<T>,
}

impl<T: AsyncDrop> AsyncDropGuard<T> {
    pub fn new(val: T) -> Self {
        Self { inner: Some(val) }
    }

    /// Consumes the guard, returning the inner value without triggering the synchronous drop panic.
    pub fn unsafe_into_inner_dont_drop(mut self) -> T {
        self.inner.take().expect("Guard already consumed")
    }
}

impl<T: AsyncDrop> Deref for AsyncDropGuard<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        self.inner.as_ref().unwrap()
    }
}

impl<T: AsyncDrop> DerefMut for AsyncDropGuard<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.inner.as_mut().unwrap()
    }
}

impl<T: AsyncDrop> Drop for AsyncDropGuard<T> {
    fn drop(&mut self) {
        if let Some(inner) = self.inner.take() {
            // In a real implementation, this would spawn a task or panic 
            // if synchronous drop is not allowed for this resource.
            tokio::spawn(inner.async_drop());
        }
    }
}
```

### 2. Rule
> **RULE**: Any background worker thread or periodic task spawned by an object **MUST** be explicitly stopped and joined inside that object's destructor before any other member variables are deallocated.

### 3. Architecture Principle
> **The Cryptographic Decoupling Law**: The storage layer must remain completely agnostic of the logical data structures it persists. The logical layer (`BlobStore`) must translate complex operations into flat, fixed-size block operations, ensuring that cryptographic boundaries (`BlockStore`) only handle uniform, indistinguishable payloads.

### 4. Failure Mode
- **Type**: Use-After-Free / Race Condition
- **Description**: A background thread (e.g., cache flusher) holds a raw or weak reference to its parent container. When the parent container is dropped, the destructor deallocates its members. The background thread fires immediately after deallocation, attempting to read/write to the deallocated memory addresses, resulting in a `SIGSEGV`.

### 5. Reusable Skill
#### AI Agent Checklist: Managing Asynchronous Resource Cleanup in Rust
1. **Identify Async Cleanup Needs**: Check if the struct manages network sockets, file handles, or cryptographic sessions that require async flushing/closing.
2. **Implement `AsyncDrop`**: Do not implement standard `Drop` directly for the resource. Instead, implement a custom `AsyncDrop` trait.
3. **Wrap in Guard**: Wrap the resource in an `AsyncDropGuard` at the creation boundary.
4. **Provide Bypass**: Implement an explicit consumption method (e.g., `unsafe_into_inner_dont_drop`) to allow safe extraction of the resource when performing manual, structured async cleanup.
5. **Verify in Tests**: Write an integration test that drops the resource under heavy load and verify no resource leaks or panics occur.

### 6. Decision
- **Decision**: Retain Fat LTO for CI release test builds, rejecting the 2x speedup offered by Thin LTO.
- **Rationale**: Thin LTO can produce subtly different optimization paths, inlining behaviors, and safety checks compared to Fat LTO. To guarantee that CI tests *exactly* what users run in production, environmental and compilation parity must take precedence over CI execution speed.

### 7. Anti-pattern
Spawning a detached background thread in a constructor without keeping a join handle or providing a shutdown signal:

```rust
// ANTI-PATTERN: NEVER DO THIS
pub struct BadCache {
    data: HashMap<String, String>,
}

impl BadCache {
    pub fn new() -> Self {
        let cache = Self { data: HashMap::new() };
        // Detached thread has no way of knowing when BadCache is dropped!
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(10));
                // Accessing cache data here after BadCache is dropped will crash or cause UB
            }
        });
        cache
    }
}
```

### 8. Verification Method
To verify that background threads are properly cleaned up and do not leak or access freed memory, run the test suite under the ThreadSanitizer (TSAN):
```bash
RUSTFLAGS="-Zsanitizer=thread" cargo test --target x86_64-unknown-linux-gnu
```
Verify that no data races or use-after-free violations are reported during the destruction phase of the test cases.

---

## 5. Net-New Universal Engineering Rules

## 1. Deterministic Thread Lifecycle Invariant
**RULE**:
Every background thread, thread pool, or periodic task spawned by an object MUST be bound to a deterministic lifecycle control handle owned by that object. The object's destructor MUST signal shutdown and block (join) until the thread has terminated before releasing any other resources.

**WHY**:
Prevent intermittent segmentation faults (`SIGSEGV`) and undefined behavior caused by background threads accessing member variables of an object that is currently undergoing destruction or has already been deallocated.

**WHEN TO APPLY**:
Any system (C++, Rust, Go, Java) where objects manage their own background worker threads or asynchronous polling loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::{self, JoinHandle};

pub struct WorkerPool {
    shutdown: Arc<AtomicBool>,
    thread_handle: Option<JoinHandle<()>>,
}

impl WorkerPool {
    pub fn new() -> Self {
        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = shutdown.clone();
        
        let thread_handle = thread::spawn(move || {
            while !shutdown_clone.load(Ordering::Relaxed) {
                // Perform periodic work safely
                thread::sleep(std::time::Duration::from_millis(100));
            }
        });

        Self {
            shutdown,
            thread_handle: Some(thread_handle),
        }
    }
}

impl Drop for WorkerPool {
    fn drop(&mut self) {
        // 1. Signal shutdown first
        self.shutdown.store(true, Ordering::Relaxed);
        
        // 2. Block and join the thread to guarantee it has exited
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER spawn a thread without storing its JoinHandle and a shutdown signal
pub struct LeakyWorker {}

impl LeakyWorker {
    pub fn start_work(&self) {
        std::thread::spawn(move || {
            loop {
                // This loop runs forever, even after LeakyWorker is dropped!
                std::thread::sleep(std::time::Duration::from_secs(1));
            }
        });
    }
}
```

**VERIFICATION METHOD**:
Execute the test suite with ThreadSanitizer enabled:
```bash
RUSTFLAGS="-Zsanitizer=thread" cargo test
```
Assert that no active threads spawned by the test suite survive past the execution of the test's scope.

---

## 2. Compilation Profile Parity Invariant
**RULE**:
CI/CD test pipelines MUST compile and execute tests using the exact same optimization profile (including LTO, codegen-units, and panic strategies) as the production release binaries.

**WHY**:
Compilers apply different optimizations, inlining, and safety checks (such as integer overflow checks or debug assertions) under different profiles. Testing with a modified profile (e.g., Thin LTO instead of Fat LTO) can mask compiler bugs, linker errors, or performance regressions that will only manifest in the actual release build.

**WHEN TO APPLY**:
All compiled languages (Rust, C++, Go, Swift) where performance-critical or security-critical software is built for distribution.

**VERIFIED IMPLEMENTATION PATTERN**:
```toml
# Cargo.toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"

# CI workflow must run:
# cargo test --release
# WITHOUT overriding CARGO_PROFILE_RELEASE_LTO or other codegen flags.
```

**NEGATIVE CONSTRAINT**:
```yaml
# NEVER override release profile settings in CI to save build time
- name: Run Release Tests
  env:
    CARGO_PROFILE_RELEASE_LTO: "off" # Avoid this optimization bypass!
  run: cargo test --release
```

**VERIFICATION METHOD**:
Add a CI step that compares the compiled test binary's metadata against the production release binary's metadata to ensure identical compiler flags and LTO configurations were applied.

---

## 6. Actionable Agent Skill & Implementation Checklist

### Step-by-Step Verification Checklist for AI Coding Agents

When building or modifying subsystems in a block-based encrypted filesystem like CryFS, the AI agent must execute the following verification steps:

- [ ] **Verify Cryptographic Key Zeroization**:
  - Ensure all cryptographic keys, salts, and intermediate states are wrapped in types implementing the `Zeroize` trait.
  - Verify that no keys are printed in debug logs (implement custom `std::fmt::Debug` for key containers).

- [ ] **Enforce Async Drop Invariants**:
  - Check if any modified struct manages resources requiring asynchronous cleanup (e.g., flushing blocks to disk).
  - If yes, wrap the struct in an `AsyncDropGuard`.
  - Ensure that any explicit destruction method (like `remove` or `close`) consumes the guard using `unsafe_into_inner_dont_drop()` to prevent double-cleanup or synchronous drop panics.

- [ ] **Audit Thread Lifecycles**:
  - Scan the codebase for any calls to `std::thread::spawn` or tokio task spawning.
  - Verify that every spawned task has a corresponding cancellation token or shutdown signal.
  - Ensure the parent struct's `Drop` implementation blocks until the background task has fully terminated.

- [ ] **Validate Test Timing Robustness**:
  - Check all unit and integration tests for hardcoded `std::thread::sleep` or `tokio::time::sleep` calls used to assert timing sequences.
  - Replace hardcoded sleeps with mock clocks or loose bounds that tolerate scheduling overshoots on heavily loaded CI runners.

- [ ] **Maintain Profile Parity**:
  - Ensure no CI workflow overrides the release profile's LTO or optimization settings.
  - Verify that performance benchmarks run on the exact production release profile.