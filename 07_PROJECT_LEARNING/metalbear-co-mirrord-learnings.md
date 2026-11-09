> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/metalbear-co-mirrord-learnings.md`  
> **Source**: github ([https://github.com/metalbear-co/mirrord](https://github.com/metalbear-co/mirrord))  
> **Source Version**: `ba0b4a85`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T03:05:10.036Z  
> **Learning ID**: `learn-github-metalbear-co-mirrord`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): metalbear-co/mirrord

---

## 1. Executive Forensic Architecture & System Mechanics

`mirrord` connects a local process directly into a Kubernetes pod context without requiring container builds, image pushes, CI runs, or pod restarts. It hooks system calls at the libc/dynamic loader layer (macOS `DYLD_INSERT_LIBRARIES`, Linux `LD_PRELOAD`, Windows DLL injection, and Go runtime syscall interception) to transparently redirect network, file I/O, and environment variable accesses into an ephemeral agent pod co-located in the Kubernetes cluster.

```
+-----------------------------------------------------------------------------------------+
|                                    LOCAL MACHINE                                        |
|                                                                                         |
|  +--------------------+                                       +----------------------+  |
|  | User Application   |                                       | mirrord CLI / IDE    |  |
|  | (Go, Node, Rust...) |                                       | Extension Controller |  |
|  +---------+----------+                                       +----------+-----------+  |
|            | Syscall Hook (libc / asm / Go runtime)                      |              |
|  +---------v------------------------------------------------+            |              |
|  | mirrord-layer                                            |            | K8s API      |
|  | (Intercepts socket(), connect(), openat(), getenv(), etc) |            | Handshake    |
|  +---------+------------------------------------------------+            |              |
|            | Multiplexed mirrord-protocol over TCP                       |              |
+------------|-------------------------------------------------------------|--------------+
             |                                                             |
             v                                                             v
+------------+-------------------------------------------------------------+--------------+
|                                  KUBERNETES CLUSTER                                     |
|                                                                                         |
|  +-----------------------------------+             +---------------------------------+  |
|  | Target Pod                        |             | mirrord-agent (Job / Ephemeral) |  |
|  |                                   |  Linux      |                                 |  |
|  |  +-----------------------------+  |  Namespaces |  +---------------------------+  |  |
|  |  | Target Workload Container   |  |<------------+--| InTargetPathResolver      |  |  |
|  |  | (/proc/<pid>/root, netns)   |  | (NET, PID,  |  | (/proc/<target_pid>/root) |  |  |
|  |  +-----------------------------+  |   MOUNT)    |  +---------------------------+  |  |
|  |                                   |             |  | Traffic Stealer/Mirrorer  |  |  |
|  |                                   |             |  | (iptables, raw sockets)   |  |  |
|  +-----------------------------------+             +---------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

### Architectural Subsystems and Boundaries
1. **Dynamic Interception Layer (`mirrord-layer`)**: Injected into the target debug process. Replaces standard POSIX I/O calls (`read`, `write`, `connect`, `openat`, `getaddrinfo`) with asynchronous message passing over a multiplexed Unix/TCP socket back to the CLI controller or agent.
2. **Cluster Agent Engine (`mirrord-agent`)**: Runs inside the cluster with elevated capabilities (`CAP_NET_ADMIN`, `CAP_SYS_PTRACE`). Joins the target container's Linux namespaces (`setns` for `mnt`, `net`, and `pid`). Uses raw sockets or iptables rules to mirror or redirect network traffic, exposes remote filesystems via `/proc/<pid>/root`, and resolves environment variables.
3. **Traffic Router & Protocol Multiplexer (`mirrord-protocol`)**: Framing and serialization protocol (bincode-based) supporting bi-directional asynchronous RPCs for remote socket creation, TCP connection mirroring, TCP stealing (sniffing and dropping cluster-bound ACK packets), UDP proxying, DNS queries, and file access primitives.
4. **Target Path Virtualizer (`InTargetPathResolver`)**: Resolves virtual container file access inside the host mount namespace by traversing paths relative to `/proc/<target_pid>/root`, preventing escape attacks and handling cyclic symlinks.
5. **Operator & Database Branching Subsystem (`mirrord-operator`)**: Manages session isolation, multi-tenant agent scheduling, and database branching lifecycle hooks (e.g., automated shadow branch creation and state cleanups for MySQL, PostgreSQL, and MongoDB).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. In-Target Filesystem Path Resolution Without Host Namespace Escape
**RULE**:
When resolving paths inside a foreign container mount namespace via `/proc/<PID>/root`, implementations MUST NOT use host-relative `std::fs::canonicalize` or recursive unconstrained symlink following. Path traversal MUST be bounded by a decrementing recursion limit (maximum 40 hops matching the Linux kernel `MAXSYMLINKS` constant) and MUST reject `Component::Prefix` while strictly rebasing absolute symlink targets against the synthetic container root directory `/proc/<PID>/root`.

**WHY**:
Standard library filesystem calls like `std::fs::canonicalize` evaluate symlinks against the host system's root directory (`/`). If a target container contains an absolute symlink such as `/var/run -> /run`, standard host resolution opens `/run` on the agent host, causing credential leakage, incorrect file mutations, or target container escapes. Unbounded symlink following causes stack overflows or hangs via circular symlinks.

**WHEN TO APPLY**:
Any time an agent, sidecar, daemon, or debugger inspects or mutates a target process's filesystem via `/proc/<PID>/root` or container mount namespace references.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{
    io,
    ops::Not,
    os::unix::ffi::OsStrExt,
    path::{Component, Path, PathBuf},
};

#[derive(Debug, Clone)]
pub struct InTargetPathResolver {
    root: PathBuf,
}

impl InTargetPathResolver {
    const MAX_SYMLINK_HOPS: u8 = 40; // POSIX/Linux standard MAXSYMLINKS

    pub fn from_pid(target_pid: u64) -> Self {
        Self {
            root: PathBuf::from(format!("/proc/{target_pid}/root")),
        }
    }

    pub fn resolve(&self, path: &Path) -> io::Result<PathBuf> {
        let mut depth = Self::MAX_SYMLINK_HOPS;
        self.resolve_inner(path, PathBuf::new(), &mut depth)
            .map(|p| self.root.join(&p))
    }

    pub fn resolve_no_follow(&self, path: &Path) -> io::Result<PathBuf> {
        if path.as_os_str().as_bytes().ends_with(b"/") {
            return self.resolve(path);
        }
        match (path.parent(), path.file_name()) {
            (Some(parent), Some(name)) => Ok(self.resolve(parent)?.join(name)),
            _ => self.resolve(path),
        }
    }

    fn resolve_inner(&self, path: &Path, from: PathBuf, max_depth: &mut u8) -> io::Result<PathBuf> {
        let mut tmp_path = if path.has_root() { PathBuf::new() } else { from };

        for comp in path.components() {
            match comp {
                Component::Prefix(_) => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidInput,
                        "Path prefixes are not supported in POSIX container root",
                    ));
                }
                Component::RootDir => {}
                Component::CurDir => {}
                Component::ParentDir => {
                    tmp_path.pop();
                }
                Component::Normal(comp) => {
                    tmp_path.push(comp);
                    let real_path = self.root.join(&tmp_path);

                    let is_symlink = match real_path.symlink_metadata() {
                        Ok(meta) => meta.file_type().is_symlink(),
                        Err(err) if err.kind() == io::ErrorKind::NotFound => false,
                        Err(err) => return Err(err),
                    };

                    if !is_symlink {
                        continue;
                    }

                    if *max_depth == 0 {
                        return Err(io::Error::from_raw_os_error(libc::ELOOP));
                    }
                    *max_depth -= 1;

                    let link = real_path.read_link()?;
                    let from = tmp_path
                        .parent()
                        .expect("tmp_path cannot be empty after pushing a Normal component");

                    tmp_path = self.resolve_inner(&link, from.to_path_buf(), max_depth)?;
                }
            }
        }

        assert!(tmp_path.has_root().not());

        if path.as_os_str().as_bytes().ends_with(b"/") {
            tmp_path.push("");
        }

        Ok(tmp_path)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER use host std::fs::canonicalize or naively join to /proc/<pid>/root
pub fn unsafe_resolve(target_pid: u64, user_path: &Path) -> io::Result<PathBuf> {
    let synthetic_root = PathBuf::from(format!("/proc/{target_pid}/root"));
    let raw_combined = synthetic_root.join(user_path);
    // VULNERABILITY: std::fs::canonicalize resolves absolute symlinks against host '/'!
    // If target has /etc/hosts -> /tmp/custom_hosts, it checks /tmp/custom_hosts on the HOST!
    std::fs::canonicalize(raw_combined)
}
```

**VERIFICATION METHOD**:
Run unit tests with synthetic directory hierarchies featuring nested symlinks, circular loops, and trailing slashes:
```rust
#[test]
fn symlink_loop_returns_eloop() {
    let root = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink("b", root.path().join("a")).unwrap();
    std::os::unix::fs::symlink("a", root.path().join("b")).unwrap();
    let resolver = InTargetPathResolver::with_root_path(root.path().to_path_buf());
    let err = resolver.resolve(Path::new("/a")).unwrap_err();
    assert_eq!(err.raw_os_error(), Some(libc::ELOOP));
}
```

---

### 2. Backpressure-Bounded Asynchronous IO Streams via Semaphore Permits
**RULE**:
When buffering or proxying arbitrary client streams into background tasks over channels (`mpsc`), the channel or intermediate buffer MUST NOT be unbounded unless accompanied by an explicit memory accounting throttle. Each buffered byte slice MUST hold an acquired permit against a shared memory budget (`Semaphore`) that is only released when the data is written to the destination transport or explicitly dropped.

**WHY**:
TCP socket buffers and process syscall intercepts can generate hundreds of megabytes of payload before the remote agent or network transport can transmit them. Using unbounded `mpsc::unbounded()` without byte-weighted permits causes uncontrolled resident memory growth (OOM killer termination of debug agents).

**WHEN TO APPLY**:
All network sinks, socket proxiers, and IPC transports where data rates between producer and consumer can decouple.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{ops::Deref, sync::Arc};
use bytes::Bytes;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tokio_util::sync::PollSemaphore;

pub trait IsClientData {
    fn size(&self) -> usize;
}

impl IsClientData for Bytes {
    fn size(&self) -> usize {
        self.len() + std::mem::size_of::<Bytes>()
    }
}

#[derive(Debug)]
pub struct Throttled<D> {
    data: D,
    permit: OwnedSemaphorePermit,
}

impl<D> Throttled<D> {
    pub fn new(data: D, permit: OwnedSemaphorePermit) -> Self {
        Self { data, permit }
    }

    pub fn unpack(self) -> (D, OwnedSemaphorePermit) {
        (self.data, self.permit)
    }
}

impl<D> Deref for Throttled<D> {
    type Target = D;
    fn deref(&self) -> &Self::Target {
        &self.data
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER queue arbitrary client network chunks in an unbounded memory buffer
// without accounting for the actual byte-length against a system budget.
pub struct UnsafeBuffer<T> {
    queue: std::collections::VecDeque<T>, // Unbounded memory allocation
}
impl<T> UnsafeBuffer<T> {
    pub fn push(&mut self, item: T) {
        self.queue.push_back(item); // OOM hazard under high throughput
    }
}
```

**VERIFICATION METHOD**:
Assert permit acquisition limits memory usage:
```rust
#[tokio::test]
async fn verify_throttle_limits_pending_buffers() {
    let throttle_limit = 1024;
    let sem = Arc::new(Semaphore::new(throttle_limit));
    let permit = sem.clone().try_acquire_many_owned(512).unwrap();
    assert_eq!(sem.available_permits(), 512);
    let permit2 = sem.clone().try_acquire_many_owned(512).unwrap();
    assert_eq!(sem.available_permits(), 0);
    assert!(sem.clone().try_acquire_owned().is_err());
    drop(permit);
    assert_eq!(sem.available_permits(), 512);
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Go ARM64 Pointer Truncation via `asmcgocall` Sign-Extension (BUG-AARCH64-01)
- **Context**: Interception of Go system calls on Linux AArch64 (`mirrord/layer-go/src/linux_aarch64.rs`).
- **What Was Expected**: When a Go program triggers an intercepted syscall (e.g. `mmap`, `brk`, `openat`), the 64-bit return value from mirrord's Rust handler must be delivered intact to Go's caller stack frame.
- **What Actually Happened**: On ARM64 Linux, 64-bit addresses returned by `mmap` with high bits set (e.g., `0xffff83298000`) were corrupted into `0xffffffff83298000`. Writing to the pointer caused immediate `SIGSEGV` segmentation faults.
- **Evidence in Repo**: Closed Issue #5092, commits referencing Go ARM64 ABI calling convention mismatch.
- **Root Cause**: Go's internal runtime declares `runtime.asmcgocall` as returning `int32`. In the Go assembly implementation for `arm64` (`src/runtime/asm_arm64.s`), Go executes `MOVW` (Move Word, 32-bit with sign extension) on the register returning the value from C/Rust. Because mirrord's Rust hook handler returned an `i64` directly via the function return register (`x0`), Go truncated bits 32-63 and sign-extended bit 31 across the top half of the 64-bit register.
- **Remediation Code Diff**:
```rust
// - Buggy Hook Strategy:
// Go ABI calls asmcgocall which executes MOVW, truncating the 64-bit return register:
// pub extern "C" fn mirrord_syscall_hook(ctx: *mut SyscallContext) -> i64 {
//     let ret: i64 = execute_syscall(ctx);
//     ret // Return value passed via x0 is truncated by Go runtime asm!
// }

// + Fixed Safe Invariant:
// Pass return value via an explicit 64-bit out-pointer inside the arguments struct:
#[repr(C)]
pub struct SyscallContext {
    pub args: [usize; 6],
    pub syscall_nr: usize,
    pub ret_val: i64, // Written explicitly to memory by the Rust handler
}

#[no_mangle]
pub unsafe extern "C" fn mirrord_syscall_handler(ctx: *mut SyscallContext) -> i32 {
    let result = execute_syscall_safe(&*ctx);
    (*ctx).ret_val = result; // Bypass register truncation
    0 // Return i32 status code to satisfy Go's asmcgocall contract
}
```
- **Lesson**: Foreign Function Interfaces (FFI) invoking runtimes with custom assembly stubs (such as Go's runtime) must never rely on platform C-ABI register widths if the guest runtime stub casts or stores the return value using sub-register width instructions. Pointer/64-bit payloads must be marshaled via reference pointers.

---

### Incident 2: Collision and Stale Resource Lock on Failed Database Branch Creation (BUG-DB-02)
- **Context**: Operator client handling database branch CRDs (`mirrord/operator/src/client/database_branches.rs`).
- **What Was Expected**: If a database branch operation (Postgres, MySQL, MongoDB) entered a `Failed` phase, subsequent debugging runs would cleanly retry or provide clear diagnostic commands for immediate recovery.
- **What Actually Happened**: The failed branch CRD remained in the cluster under the deterministic name assigned to the session. Subsequent debug invocations hit a naming collision against the failed resource, aborting with uninformative generic errors and stranding the developer in an unrecoverable state.
- **Evidence in Repo**: Commit `ba0b4a85`, PR #5194, issue changelog `+db-branch-failure-destroy-hint.fixed.md`.
- **Root Cause**: `create_mysql_branches`, `create_pg_branches`, `create_mongodb_branches`, and `create_branches` returned an ad-hoc error string discarding the namespace and branch name metadata needed to build a cleanup hint. Furthermore, migration failure did not differentiate between a catastrophic branch crash and a reusable branch requiring schema migration repair.
- **Remediation Code Diff**:
```rust
// File: mirrord/operator/src/client/database_branches.rs
-        if let Some(status) = &db.status
-            && status.phase == BranchDatabasePhase::Failed
-        {
-            let error_msg = status
-                .error
-                .clone()
-                .unwrap_or_else(|| "Branch database creation failed".to_owned());
-            return Err(OperatorApiError::BranchCreationFailed {
-                operation: OperatorOperation::MysqlBranching,
-                message: error_msg,
-            });
-        }
+        if let Some(status) = &db.status
+            && status.phase == BranchDatabasePhase::Failed
+        {
+            return Err(branch_failed_error(
+                OperatorOperation::MysqlBranching,
+                &db,
+                status.error.as_deref(),
+            ));
+        }
...
+pub(crate) fn branch_failed_error<K: ResourceExt>(
+    operation: OperatorOperation,
+    branch: &K,
+    reason: Option<&str>,
+) -> OperatorApiError {
+    let name = branch.name_any();
+    let reason = reason.unwrap_or("no failure reason recorded");
+    OperatorApiError::BranchCreationFailed {
+        operation,
+        message: format!(
+            "branch database `{name}` failed: {reason}. {}",
+            destroy_branch_hint(branch.namespace().as_deref(), &name)
+        ),
+    }
+}
```
- **Lesson**: When an orchestrator names external resources deterministically, failure errors MUST generate the exact CLI command or programmatic remediation required to purge the orphaned resource.

---

### Incident 3: Agent Capability Mask Silent Deserialization Bypass (BUG-AGENT-03)
- **Context**: Configuration parsing for agent security context (`mirrord/kube/src/api/container/util.rs`, `mirrord/config/src/agent.rs`).
- **What Was Expected**: Users configuring disabled capabilities via environment variables or configuration files (e.g. `MIRRORD_AGENT_DISABLED_CAPABILITIES=CAP_NET_RAW,CAP_SYS_PTRACE`) expect the container runner to strip those Linux capabilities from the spawned agent pod.
- **What Actually Happened**: The environment variable was ignored because the config parser lacked environment binding for that field. Furthermore, in configuration files, string values containing the canonical Linux kernel capability prefix `CAP_` (or lowercase equivalents) were checked using raw exact string comparison (`==`). As a result, capabilities like `"CAP_SYS_PTRACE"` were silently ignored without warnings, leaving elevated capabilities fully active on the agent.
- **Evidence in Repo**: Issue #5026.
- **Root Cause**: Lack of string normalization (case-folding and prefix stripping) during capability matching, combined with missing environment variable attributes in the configuration struct macro.
- **Remediation Code Diff**:
```rust
// - Buggy Direct Comparison:
// fn get_capabilities(disabled: &[String]) -> Vec<Capability> {
//     DEFAULT_CAPS.iter().filter(|c| !disabled.contains(c)).cloned().collect()
// }

// + Normalized String Evaluation:
pub fn normalize_capability(name: &str) -> String {
    let upper = name.to_ascii_uppercase();
    if let Some(stripped) = upper.strip_prefix("CAP_") {
        stripped.to_string()
    } else {
        upper
    }
}

pub fn filter_capabilities(requested: &[String], disabled: &[String]) -> Vec<String> {
    let disabled_set: std::collections::HashSet<String> = disabled
        .iter()
        .map(|s| normalize_capability(s))
        .collect();

    requested
        .iter()
        .filter(|cap| !disabled_set.contains(&normalize_capability(cap)))
        .cloned()
        .collect()
}
```
- **Lesson**: All configuration inputs representing operating system primitives (capabilities, signals, syscalls) MUST be normalized (stripped of standard prefixes like `SIG` or `CAP_` and case-folded) prior to equality evaluations.

---

### Incident 4: `FuturesUnordered` Polling Hang in Channel Termination Watchers (BUG-ASYNC-04)
- **Context**: Background client connection lifecycle tracking (`mirrord/agent/src/util.rs`).
- **What Was Expected**: An agent managing multiple client connections maintains a collection of futures that resolve when any client drops its communication channel.
- **What Actually Happened**: When tracking client channel closures inside `futures::stream::FuturesUnordered`, the stream would hang indefinitely even after the client dropped the corresponding `mpsc::Receiver`.
- **Evidence in Repo**: Unit test and comment in `mirrord/agent/src/util.rs: channel_closed_works_in_futures_unordered`.
- **Root Cause**: The original future stored `mpsc::Sender` directly and invoked `poll_closed()` on the inner Tokio sender within `Future::poll`. Due to Tokio's waker registration semantics inside `mpsc::Sender::poll_closed()`, registering interest across task boundaries inside `FuturesUnordered` failed to wake the parent task when the receiver dropped.
- **Remediation Code Diff**:
```rust
// - Storing Sender and polling poll_closed inside custom Future::poll:
// struct ChannelClosedFuture<T> {
//     tx: mpsc::Sender<T>,
//     client_id: ClientId,
// }
// impl<T> Future for ChannelClosedFuture<T> {
//     type Output = ClientId;
//     fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<ClientId> {
//         ready!(self.tx.poll_closed(cx));
//         Poll::Ready(self.client_id)
//     }
// }

// + Wrapping async block into a BoxFuture with clean async/.await semantics:
pub(crate) struct ChannelClosedFuture(BoxFuture<'static, ClientId>);

impl ChannelClosedFuture {
    pub(crate) fn new<T: 'static + Send>(tx: mpsc::Sender<T>, client_id: ClientId) -> Self {
        let future = async move {
            tx.closed().await;
            client_id
        }
        .boxed();

        Self(future)
    }
}

impl Future for ChannelClosedFuture {
    type Output = ClientId;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.get_mut().0.as_mut().poll(cx)
    }
}
```
- **Lesson**: When writing custom manual `Future` implementations for complex Tokio primitives, prefer delegating the leaf polling state to a pinned, boxed async block (`.boxed()`) to ensure proper waker propagation across multi-future combinators like `FuturesUnordered`.

---

### Incident 5: HTTP Partial Frame Boundary Read Freezes (BUG-IO-05)
- **Context**: Framing protocol decoder for hyper HTTP/2 bodies (`mirrord/agent/src/incoming/connection/body_utils.rs`).
- **What Was Expected**: Reading from a sequence of HTTP body frames (`FramesReader`) into a caller-supplied slice must handle empty chunks, partial chunk reads, and arbitrary frame splits transparently.
- **What Actually Happened**: When incoming payloads contained empty frames (e.g. metadata or zero-length chunks), `read` loops would either spin without consuming bytes, or stop prematurely on non-data frames before the stream was exhausted.
- **Evidence in Repo**: `mirrord/agent/src/incoming/connection/body_utils.rs: FramesReader::read` and test suite `test_framelike`.
- **Root Cause**: The slice windowing did not advance the slice reference across empty frames before checking slice length against the current buffer read offset.
- **Remediation Code Diff**:
```rust
// File: mirrord/agent/src/incoming/connection/body_utils.rs
impl<T: Framelike> Read for FramesReader<'_, T> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let frame = loop {
            let [first, rest @ ..] = self.remaining else {
                return Ok(0);
            };

            let Some(frame) = first.data_ref() else {
                return Ok(0);
            };

            if self.read_until == frame.len() {
                self.remaining = rest;
                self.read_until = 0;
            } else {
                assert!(self.read_until < frame.len());
                break frame;
            }
        };

        let until = Ord::min(frame.len(), self.read_until + buf.len());
        let range = self.read_until..until;

        buf.get_mut(..range.len())
            .unwrap()
            .copy_from_slice(frame.get(range.clone()).unwrap());

        self.read_until = until;

        Ok(range.len())
    }
}
```
- **Lesson**: IO slice adapters must handle zero-length chunks explicitly in a forward loop before querying sub-slice ranges to prevent premature zero-read (spurious EOF) returns.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In Rust system interceptors, subtle memory and type invariants dictate stability:

- **Strict Range Bounds (`std::ops::Range`)**:
  When slicing byte buffers inside zero-copy adapters, never use direct index lookups (`buf[..n]`). Use checked `.get()` or `.get_mut()` with an explicit range length:
  ```rust
  let until = Ord::min(frame.len(), self.read_until + buf.len());
  let range = self.read_until..until;
  buf.get_mut(..range.len())
      .expect("destination buffer index out of bounds")
      .copy_from_slice(frame.get(range.clone()).expect("source frame out of bounds"));
  ```
- **Option Checking Invariants (`is_some_and` vs `map_or`)**:
  Avoid truthiness patterns or nested `if let Some` when verifying phase flags. Use modern non-short-circuiting predicates:
  ```rust
  let branch_failed = branch
      .status
      .as_ref()
      .is_some_and(|status| status.phase == BranchDatabasePhase::Failed);
  ```
- **Byte Slicing and Trailing Slashes**:
  File path string manipulation must operate on raw byte slices rather than UTF-8 string parsers to support Unix paths with arbitrary byte encoding:
  ```rust
  use std::os::unix::ffi::OsStrExt;
  if path.as_os_str().as_bytes().ends_with(b"/") {
      tmp_path.push("");
  }
  ```

### 2. Infinite Loop & Recursion Guards
System-level path resolution and async loop designs require strict bounding:

- **Recursion Depth Token Passing**:
  When walking filesystem symlinks, recursive calls must pass a mutable counter reference rather than an integer value. This prevents branch-level stack resets from circumventing the global hop ceiling:
  ```rust
  fn resolve_inner(&self, path: &Path, from: PathBuf, max_depth: &mut u8) -> io::Result<PathBuf> {
      // ...
      if *max_depth == 0 {
          return Err(io::Error::from_raw_os_error(libc::ELOOP));
      }
      *max_depth -= 1;
      // Recursion shares the exact same &mut max_depth across parallel branches
      self.resolve_inner(&link, from, max_depth)
  }
  ```
- **Stream Flush Loop Termination**:
  When processing vectored writes in `IoVecThrottledSink`, the drain loop must guarantee forward progress on `written` bytes:
  ```rust
  loop {
      let popped = this.buffered.pop_front_if(|chunk| {
          if chunk.len() <= written {
              return true;
          }
          chunk.data.advance(written);
          false
      });
      if let Some(popped) = popped {
          written -= popped.len();
      } else {
          break;
      }
  }
  ```
  *Invariant*: If `written == 0` when entering the write check, the loop must terminate immediately with `io::ErrorKind::WriteZero` to avoid an infinite busy-poll loop.

### 3. UI & UX Micro-Mechanics (CLI & Extension Invariants)
- **Deterministic Cleanup Commands**:
  When a cloud resource (such as a database branch) enters an unrecoverable state, error diagnostics must print the exact, copy-pasteable remediation command including all namespace and context flags:
  ```rust
  format!(
      "branch database `{name}` failed: {reason}. Delete it with `mirrord db-branches -n {namespace} destroy {name}` and restart."
  )
  ```
- **Progress Bars and Stderr Isolation**:
  CLI terminal progress bars (`indicatif`) must be decoupled from stdout streaming to prevent protocol corruption when stdout is used for process IPC or JSON payloads.

### 4. Backend Concurrency & Memory Safety
- **Lock-Free Version Negotiation**:
  Avoid holding mutex locks across async protocol steps. For protocol versioning, store state behind an `Arc<Mutex<semver::Version>>` and perform instant cloning or copy-matches:
  ```rust
  pub struct ClientProtocolVersion(Arc<Mutex<semver::Version>>);
  impl ClientProtocolVersion {
      pub fn matches(&self, version_req: &semver::VersionReq) -> bool {
          version_req.matches(&self.0.lock().unwrap())
      }
  }
  ```
- **TOCTOU Elimination via `/proc/<pid>/root`**:
  To avoid time-of-check to time-of-use vulnerabilities when inspecting container paths, always resolve intermediate parent directories and verify non-symlink metadata before issuing file descriptors to the caller.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Fused Stream Termination Guarantees**:
  Streams wrapping background tasks (`UnboundedBufferedStream`) must implement `FusedStream` and track termination via an `Option<JoinHandle>`:
  ```rust
  impl<T> FusedStream for UnboundedBufferedStream<T> {
      fn is_terminated(&self) -> bool {
          self.task.is_none()
      }
  }
  ```
  If `self.task.is_none()`, `poll_next` must immediately return `Poll::Ready(None)` to prevent polling a finished task or closed channel.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
`mirrord` employs an asymmetric dual-agent topology:
- The **Client Layer** runs inside the developer's local process memory space via library injection. It hooks system calls and translates them into an RPC command stream.
- The **Target Agent** executes inside the Kubernetes cluster. It runs in the target container's network and mount namespaces, acting as the local process's remote proxy.
- Communication between the layer and the agent is mediated by the CLI, which establishes a port-forward or API connection to the target pod.

### 2. Core Abstractions
- `Framelike`: Abstraction over HTTP/1.x, HTTP/2 frames, and raw TCP segments providing unified byte-slice references.
- `InTargetPathResolver`: Virtual filesystem router that traverses `/proc/<pid>/root` while enforcing container isolation.
- `RolledBackStream`: Specialized async stream wrapper that prepends pre-read protocol inspection bytes back onto an unread transport stream.
- `Throttled<D>`: Zero-cost wrapper bundling data with a RAII semaphore permit to ensure hard bounds on buffered memory.

### 3. Error Handling
- **Typed Protocol Errors (`OperatorApiError`, `AgentRuntimeError`)**: Structured error enums built via `thiserror`.
- **System Call Error Mapping**: Operating system errors originating in the container are translated back to their libc integer equivalents (e.g., `libc::ENOENT`, `libc::ELOOP`, `libc::EACCES`) so the local process sees identical syscall responses.

### 4. Testing
- **Multi-App Matrix Testing**: Dedicated test fixtures for specific languages (`tests/apps/fileops`, `tests/rust-e2e-fileops`, `issue1776`, etc.).
- **Subprocess Hook Verification**: Custom harnesses compiling real binary targets in Go, Node, Python, and C, verifying that injected symbols intercept calls without memory corruption.
- **Flaky Test Shields**: Automated CI workflows (`.github/scripts/flaky-tests.sh`) monitoring and isolating nondeterministic network timing issues.

### 5. Security
- **Namespace Confinement**: Preventing target container traversal escapes via strict `Component` pattern matching on path components.
- **Capability Stripping**: Ensuring agent pods run with the minimum set of capabilities (`CAP_NET_ADMIN`, `CAP_SYS_PTRACE`) and validating that capability disable flags properly filter agent permissions.

### 6. Performance
- **Vectored Async Writes (`IoVecThrottledSink`)**: Aggregates up to 16 separate memory frames into a single `poll_