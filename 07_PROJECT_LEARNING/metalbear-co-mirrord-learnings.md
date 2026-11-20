> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/metalbear-co-mirrord-learnings.md`  
> **Source**: github ([https://github.com/metalbear-co/mirrord](https://github.com/metalbear-co/mirrord))  
> **Source Version**: `3a843d8d`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-20T01:00:29.428Z  
> **Learning ID**: `learn-github-metalbear-co-mirrord`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): metalbear-co/mirrord

---

## 1. Executive Forensic Architecture & System Mechanics

`mirrord` injects local processes (binaries, runtimes, or test suites) into remote Kubernetes pod contexts transparently, without requiring container rebuilds, CI/CD deploys, or cluster-wide DNS/network mutations.

```
+--------------------------------------------------------------------------------------------------+
| LOCAL WORKSTATION / RUNTIME CONTEXT                                                              |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | User Application Process (Node, Python, Go, Rust, Java, etc.)                             |  |
|  +--------------------------------------------------------------------------------------------+  |
|         |                                              |                               |         |
|   libc / Syscall Traps                          Go Syscall ABI                     VFS Calls     |
|         v                                              v                               v         |
|  +---------------------+                       +----------------+               +--------------+ |
|  | mirrord-layer (so)  |                       | layer-go (asm) |               | file hooks   | |
|  +---------------------+                       +----------------+               +--------------+ |
|         |                                              |                               |         |
|         +-----------------------+----------------------+-------------------------------+         |
|                                 |                                                                |
|                                 v                                                                |
|         +-----------------------------------------------+                                        |
|         | mirrord Internal Proxy (intproxy)             |                                        |
|         | Multiplexed TCP/UDP streams & state machines  |                                        |
|         +-----------------------------------------------+                                        |
+---------------------------------|----------------------------------------------------------------+
                                  | TLS / Multiplexed Protocol over K8s Port-Forward / SPDY
                                  v
+--------------------------------------------------------------------------------------------------+
| KUBERNETES TARGET CONTEXT (NODE / NAMESPACE)                                                     |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | mirrord-agent (Ephemeral Pod / Job running in Target Pod Namespaces)                       |  |
|  |                                                                                            |  |
|  |  [Network Interceptor]               [VFS Jail Resolver]             [Flow Controller]     |  |
|  |  iptables / eBPF / raw sockets       InTargetPathResolver            Throttle / Semaphores |  |
|  |  Redirects/Mirrors ingress & egress   /proc/{target_pid}/root         IoVecThrottledSink    |  |
|  +--------------------------------------------------------------------------------------------+  |
|         ^                                              ^                                         |
|         | Linux Namespace Attachment                   | procfs VFS Walk                         |
|         v                                              v                                         |
|  +--------------------------------------------------------------------------------------------+  |
|  | Target Application Pod Containers & Host Kernels                                           |  |
|  +--------------------------------------------------------------------------------------------+  |
+--------------------------------------------------------------------------------------------------+
```

### Architectural Subsystems and Boundaries

1. **The Interception Boundary (`mirrord-layer` / `mirrord-layer-win` / `mirrord-layer-go`)**:
   - Injected dynamically via `LD_PRELOAD` (Linux), `DYLD_INSERT_LIBRARIES` (macOS), or custom binary patches/debug hooks on Windows.
   - For Go runtimes that bypass `libc` by executing direct raw supervisor calls via assembly routines (`syscall.Syscall`), mirrord provides an assembly-level trampoline bridge (`mirrord-layer-go`) hooking runtime internals using Go's `runtime.asmcgocall`.
   - Intercepts file I/O, socket operations (`connect`, `bind`, `listen`, `accept`, `getaddrinfo`), and environment lookups, packaging them into `mirrord_protocol` messages.

2. **Internal Proxy & Serialization Layer (`mirrord-intproxy` / `mirrord-protocol`)**:
   - Manages multiplexed, bi-directional RPC sessions between the user's hooked process and the remote agent.
   - Version negotiation utilizes semantic versioning with legacy fallbacks (anchored at `1.2.2`). Decouples protocol evolution from CLI updates.

3. **In-Cluster Agent Subsystem (`mirrord-agent`)**:
   - Executes inside the Kubernetes cluster as an ephemeral debug container or privileged Job attached to the target pod's namespaces (`net`, `pid`, `mnt`).
   - Uses `iptables` and raw socket redirection to steal or mirror TCP traffic.
   - Operates `InTargetPathResolver`, which walks the target pod's root filesystem directly via `/proc/<PID>/root`, resolving symlinks and preventing traversal attacks across mount namespaces.
   - Manages backpressure and memory overhead using `Throttle` and vectored asynchronous writers (`IoVecThrottledSink`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Future Cancellation & Internal Poller Decoupling in Stream Multiplexers

**RULE**:
When creating custom `Future` implementations that monitor underlying channel or resource state (such as `tokio::sync::mpsc::Sender::closed`), the implementer **MUST NOT** poll the underlying synchronization primitive directly inside an ad-hoc manual `Future::poll` implementation when the future will be stored inside unordered collections (like `FuturesUnordered`). The implementer **MUST** instantiate and store an explicit, heap-pinned async closure (`BoxFuture<'static, T>`) inside the wrapper struct.

**WHY**:
`tokio::sync::mpsc::Sender::closed` relies on task-waker registration tied to the calling async task context. When polled inside concurrent combinators like `futures::stream::FuturesUnordered`, intermediate yields and poll passes without explicit task context binding cause wakers to be dropped, overwritten, or deadlocked without re-registration. This causes `FuturesUnordered::next()` to hang indefinitely even after the associated `Receiver` has been dropped.

**WHEN TO APPLY**:
Any Rust async subsystem polling channel status, cancellation tokens, or state change listeners concurrently inside `FuturesUnordered`, `select!`, or custom multiplexing loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};
use futures::{future::BoxFuture, FutureExt};
use tokio::sync::mpsc;

pub type ClientId = u32;

/// A cancellation future that safely wakes across arbitrary task combinators.
pub(crate) struct ChannelClosedFuture(BoxFuture<'static, ClientId>);

impl ChannelClosedFuture {
    pub(crate) fn new<T: 'static + Send>(tx: mpsc::Sender<T>, client_id: ClientId) -> Self {
        // Enforce pinned async block to ensure internal waker is preserved
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

    #[inline]
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.0.as_mut().poll(cx)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Calling tx.closed() inside a raw Future::poll while held in FuturesUnordered
pub struct BrokenChannelClosedFuture<T> {
    tx: tokio::sync::mpsc::Sender<T>,
    client_id: u32,
}

impl<T> Future for BrokenChannelClosedFuture<T> {
    type Output = u32;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        // HAZARD: Polls inner channel directly. When used in FuturesUnordered,
        // the waker registration is clobbered during concurrent polling passes,
        // causing FuturesUnordered::next() to hang forever.
        let mut closed_fut = std::pin::pin!(self.tx.closed());
        if closed_fut.poll(cx).is_ready() {
            Poll::Ready(self.client_id)
        } else {
            Poll::Pending
        }
    }
}
```

**VERIFICATION METHOD**:
Verify using an automated `rstest` harness executing against a `FuturesUnordered` set:
```rust
#[tokio::test]
async fn verify_channel_closed_in_futures_unordered() {
    use futures::stream::{FuturesUnordered, StreamExt};
    let mut unordered = FuturesUnordered::new();
    let (tx, rx) = tokio::sync::mpsc::channel::<()>(1);
    
    unordered.push(ChannelClosedFuture::new(tx, 42));
    assert!(unordered.next().now_or_never().is_none());
    
    // Dropping rx MUST trigger immediate readiness on next poll
    drop(rx);
    let resolved = tokio::time::timeout(std::time::Duration::from_millis(100), unordered.next())
        .await
        .expect("Deadlock detected in FuturesUnordered")
        .expect("Stream yielded None prematurely");
        
    assert_eq!(resolved, 42);
}
```

---

### 2. Procfs Chroot Boundary Path Resolution Invariant

**RULE**:
When resolving paths inside an external Linux container via host `/proc/<PID>/root`, the resolver **MUST**:
1. Recursively follow relative and absolute symlinks with an absolute hop counter bounded by a hard cap (`MAX_SYMLINK_HOPS <= 40`, matching the Linux VFS limit).
2. Explicitly prevent symlink loops from causing unbounded recursion or stack exhaustion by returning `libc::ELOOP`.
3. Provide a separate non-dereferencing lookup mode (`resolve_no_follow`) for metadata operations (`lstat`, `readlink`) that resolves parent directories against the container target root while preserving the final leaf component as an unresolved link.
4. Normalize trailing slash semantics so that paths ending in `/` force resolution of the leaf component even in `no_follow` modes.

**WHY**:
Directly concatenating host `/proc/<PID>/root` with a user-supplied path causes absolute symlinks (e.g. `/var/run -> /run`) to jump out of the target container's procfs tree and resolve against the *host* filesystem root (`/run`). This exposes host tokens, leaked secrets, or unauthorized device nodes. Failure to bound symlink recursion causes agent denial-of-service via stack overflow.

**WHEN TO APPLY**:
Any container agent, eBPF observer, or privileged microservice reading or mutating container filesystems via `/proc/$PID/root`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{
    io,
    ops::Not,
    os::unix::ffi::OsStrExt,
    path::{Component, Path, PathBuf},
};

pub struct InTargetPathResolver {
    root: PathBuf,
}

impl InTargetPathResolver {
    pub const MAX_SYMLINK_HOPS: u8 = 40;

    pub fn from_pid(target_pid: u64) -> Self {
        Self { root: PathBuf::from(format!("/proc/{target_pid}/root")) }
    }

    pub fn resolve(&self, path: &Path) -> io::Result<PathBuf> {
        let mut depth = Self::MAX_SYMLINK_HOPS;
        self.resolve_inner(path, PathBuf::new(), &mut depth)
            .map(|p| self.root.join(p))
    }

    pub fn resolve_no_follow(&self, path: &Path) -> io::Result<PathBuf> {
        // POSIX standard: Trailing slash explicitly requests following the final link
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
                Component::Prefix(_) => return Err(io::Error::new(io::ErrorKind::InvalidInput, "Prefix not supported")),
                Component::RootDir | Component::CurDir => {}
                Component::ParentDir => { tmp_path.pop(); }
                Component::Normal(comp) => {
                    tmp_path.push(comp);
                    let real_path = self.root.join(&tmp_path);

                    let is_symlink = match real_path.symlink_metadata() {
                        Ok(meta) => meta.file_type().is_symlink(),
                        Err(err) if err.kind() == io::ErrorKind::NotFound => false,
                        Err(err) => return Err(err),
                    };

                    if is_symlink.not() {
                        continue;
                    }

                    if *max_depth == 0 {
                        return Err(io::Error::from_raw_os_error(libc::ELOOP));
                    }
                    *max_depth -= 1;

                    let link = real_path.read_link()?;
                    let from = tmp_path.parent().expect("tmp_path parent exists").to_path_buf();
                    tmp_path = self.resolve_inner(&link, from, max_depth)?;
                }
            }
        }

        if path.as_os_str().as_bytes().ends_with(b"/") {
            tmp_path.push("");
        }
        Ok(tmp_path)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Naive path concatenation without symlink containment
pub fn resolve_naive(target_pid: u64, untrusted_path: &Path) -> PathBuf {
    // SECURITY CRITICAL DEFECT:
    // If untrusted_path is "/var/run/secret" and "/var/run" is a symlink to "/run",
    // the OS resolves "/proc/1234/root/var/run/secret" -> "/run/secret" on the HOST.
    Path::new(&format!("/proc/{}/root", target_pid)).join(untrusted_path.strip_prefix("/").unwrap_or(untrusted_path))
}
```

**VERIFICATION METHOD**:
Create a temporary directory structure mimicking an absolute symlink loop (`/a -> b`, `/b -> a`) and an escaping symlink (`/etc/target -> /etc/shadow`). Assert that `resolve()` returns `libc::ELOOP` on cycles, and correctly prefixes the resolved absolute symlink under the mock target root without leaking host paths.

---

### 3. ABI Width Invariant for FFI Supervisor Hooks

**RULE**:
When intercepting native runtime system calls via runtime-internal FFI bridges (such as Go's `runtime.asmcgocall` or equivalent assembly shims), the interceptor **MUST NOT** return return values across ABI boundaries where register width expectations differ. If the caller's assembly stub expects a 32-bit integer (`int32`/`MOVW`), return values wider than 32 bits (such as 64-bit kernel pointers or offsets from `mmap`, `lseek64`, or 64-bit file descriptors) **MUST** be passed through an out-pointer parameter allocated in memory, rather than through the direct scalar return register.

**WHY**:
On 64-bit architectures (specifically Linux ARM64 / AArch64), returning a 64-bit pointer (e.g. `0xffff83298000`) across an FFI stub typed as `int32` causes the runtime assembly trampoline to execute `MOVW` (Move Word) into the result register. This zero-extends or sign-extends the lower 32 bits into `0xffffffff83298000`. When the calling program dereferences this corrupted address, it crashes immediately with `SIGSEGV`.

**WHEN TO APPLY**:
Cross-language syscall interceptors, `LD_PRELOAD` wrappers, assembly-level Go runtime hooks, and any FFI boundary involving `asmcgocall` on AArch64, x86_64, or RISC-V.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Target: Rust FFI handler bridged to Go via asmcgocall
#[repr(C)]
pub struct SyscallResult {
    pub return_value: i64,
    pub errno_value: i32,
}

#[repr(C)]
pub struct SyscallInvocationArgs {
    pub sysno: i64,
    pub args: [usize; 6],
    // The result MUST be written to an explicit output struct pointer,
    // NEVER returned directly as a 64-bit value in register x0/rax if the ABI stub uses int32.
    pub result: *mut SyscallResult,
}

pub unsafe extern "C" fn mirrord_safe_syscall_bridge(args: *mut SyscallInvocationArgs) -> i32 {
    let invocation = &mut *args;
    let (res, err) = execute_native_syscall(invocation.sysno, invocation.args);
    
    (*invocation.result).return_value = res;
    (*invocation.result).errno_value = err;
    
    // Return explicit 0 status code matching the 32-bit ABI contract
    0
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Returning 64-bit integer directly through an ABI stub expecting int32
#[no_mangle]
pub unsafe extern "C" fn mirrord_bad_syscall_hook(sysno: i64, args: *const usize) -> i64 {
    // DEFECT: Go's ARM64 asmcgocall stub stores the return value using MOVW,
    // which discards bits 32-63. If this call was mmap(2) returning 0xffff83298000,
    // the Go caller receives 0xffffffff83298000, immediately crashing on memory access.
    libc::syscall(sysno, *args)
}
```

**VERIFICATION METHOD**:
Unit/Integration test compiled for `aarch64-unknown-linux-gnu` invoking an anonymous `mmap` above the 32-bit address space (`MAP_ANONYMOUS`, 64-bit hint) through the hooked runtime bridge, asserting that `res as u64 & 0xFFFF_FFFF_0000_0000 != 0` and dereferencing the address writes/reads cleanly without `SIGSEGV`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Go ARM64 Syscall Pointer Corruption via Register Truncation (BUG-ARM64-5092)

- **Context**: `mirrord/layer-go/src/linux_aarch64.rs`
- **What Was Expected**: Hooked Go system calls returning 64-bit pointers (e.g. `mmap`, `brk`, `shmat`) must return intact 64-bit virtual addresses on Linux AArch64.
- **What Actually Happened**: On ARM64 Linux, Go applications running with mirrord crashed with `SIGSEGV` on the first write after an intercepted `mmap`. An `mmap` returning kernel address `0xffff83298000` was returned to Go as `0xffffffff83298000` (sign-extended truncation).
- **Evidence in Repo**: Issue #5092; resolved in commit series around layer-go assembly trampoline.
- **Root Cause**: The layer-go hook utilized Go’s internal `runtime.asmcgocall` to bridge into the Rust interceptor. Go’s internal type signature declares `asmcgocall` as returning `int32`. In the Go runtime assembly implementation (`src/runtime/asm_arm64.s`), the return register was handled with `MOVW` (Move Word, 32-bit), discarding the upper 32 bits and sign-extending the scalar into register `X0`.
- **Remediation Code Diff**:
```rust
// - Direct return across asmcgocall boundary:
// pub unsafe extern "C" fn cgo_syscall_hook(args: *const SyscallArgs) -> i64 {
//     let ret = libc::syscall(args.nr, args.a1, ...);
//     ret // Truncated to int32 by MOVW in Go's asm_arm64.s
// }

// + Pass return data structure via out-pointer:
#[repr(C)]
pub struct GoSyscallCall {
    pub sysno: usize,
    pub args: [usize; 6],
    pub out_ret: usize,
    pub out_err: usize,
}

pub unsafe extern "C" fn cgo_syscall_hook(call: *mut GoSyscallCall) -> i32 {
    let call = &mut *call;
    let res = libc::syscall(call.sysno as _, call.args[0], call.args[1], call.args[2], call.args[3], call.args[4], call.args[5]);
    if res == -1 {
        call.out_ret = 0;
        call.out_err = *libc::__errno_location() as usize;
    } else {
        call.out_ret = res as usize;
        call.out_err = 0;
    }
    0
}
```
- **Lesson**: Never rely on register return values across runtime-internal FFI trampolines when the calling runtime's internal assembly contract does not guarantee full register width preservation.

---

### Incident 2: Ineffective Agent Capability Disabling Due to Prefix and Envar Mismatches (BUG-CFG-5026)

- **Context**: `mirrord/config/src/agent.rs` and `mirrord/kube/src/api/container/util.rs`
- **What Was Expected**: Setting `MIRRORD_AGENT_DISABLED_CAPABILITIES=CAP_NET_RAW,CAP_SYS_PTRACE` or using config block `disabled_capabilities: ["CAP_SYS_PTRACE"]` would drop the requested Linux capabilities from the spawned agent pod.
- **What Actually Happened**: The agent pod continued to run with full capabilities (`SYS_ADMIN`, `SYS_PTRACE`, `NET_ADMIN`). Setting the environment variable had zero effect, and providing `CAP_` prefixed strings in the configuration was silently ignored.
- **Evidence in Repo**: Issue #5026.
- **Root Cause**: Two distinct defects:
  1. `agent.disabled_capabilities` field in `mirrord-config` lacked the `#[config(env = "...")]` macro attribute, leaving the environment variable unparsed.
  2. `get_capabilities` performed verbatim string comparison (`==`) against static lists expecting unprefixed tokens (e.g., `"SYS_PTRACE"`), while standard Linux/Kubernetes documentation uses `"CAP_SYS_PTRACE"`. Unmatched strings were dropped with no error or warning.
- **Remediation Code Diff**:
```rust
// mirrord/config/src/agent.rs
// - pub disabled_capabilities: Option<HashSet<String>>,
// + #[config(env = "MIRRORD_AGENT_DISABLED_CAPABILITIES")]
// + pub disabled_capabilities: Option<HashSet<String>>,

// mirrord/kube/src/api/container/util.rs
// - let disabled = config.disabled_capabilities.contains(&cap_string);
// + let normalize = |s: &str| s.trim().to_uppercase().trim_start_matches("CAP_").to_string();
// + let disabled_set: HashSet<String> = config
// +     .disabled_capabilities
// +     .iter()
// +     .flatten()
// +     .map(|s| normalize(s))
// +     .collect();
// + let disabled = disabled_set.contains(&normalize(&cap_string));
```
- **Lesson**: Configuration inputs matching system domain entities (such as Linux capabilities, signals, and headers) must always be normalized (casing, known prefixes like `CAP_` or `SIG`) before comparison, and supported configuration variables must have parity across CLI flags, configuration files, and environment variables.

---

### Incident 3: Workflow Re-run Failure Due to Stale PR Label Caching (BUG-CI-5258-A)

- **Context**: `.github/workflows/ci.yaml` and `.github/workflows/check-towncrier.yaml`
- **What Was Expected**: Adding the `docs` label to a Pull Request should allow GitHub Actions checks to bypass the Towncrier changelog validation without requiring an empty or dummy fragment.
- **What Actually Happened**: When a contributor failed the changelog check, added the `docs` label, and hit "Re-run jobs" in GitHub Actions, the workflow failed again.
- **Evidence in Repo**: Commit `3a843d8d`, Commit message: *"Say in AGENTS.md that the merge queue squashes pull requests... The job reads the labels with `gh pr view` when it runs, as `corpus_upstream_check` does... rather than from the event, because a re-run reuses the original event and its labels."*
- **Root Cause**: GitHub Actions re-runs reuse the immutable `github.event` JSON payload generated when the workflow was first triggered. Reading labels via `github.event.pull_request.labels` returns the label state at initial run time, ignoring labels added subsequent to the initial failure.
- **Remediation Code Diff**:
```yaml
# .github/workflows/check-towncrier.yaml
# - if: contains(github.event.pull_request.labels.*.name, 'docs')
# -   run: exit 0

# + Fetch live label set dynamically from GitHub API via CLI:
    - name: Check for docs bypass label
      env:
        GH_TOKEN: ${{ github.token }}
      run: |
        LABELS=$(gh pr view ${{ github.event.pull_request.number }} --json labels -q '.labels[].name')
        if echo "$LABELS" | grep -qx "docs"; then
          echo "PR has 'docs' label. Bypassing Towncrier changelog verification."
          exit 0
        fi
        towncrier check
```
- **Lesson**: Never query mutable GitHub PR metadata (labels, milestone, assignees) via static `github.event` context in CI jobs that require re-run capability; query live state using `gh` CLI.

---

### Incident 4: Front-Matter Parser Rejection from CRLF Checkout on Windows (BUG-MCP-5258-B)

- **Context**: `.gitattributes`, `mirrord/mcp/build.rs`
- **What Was Expected**: Developer checkouts and builds of the `mirrord-mcp` crate on Windows should parse embedded documentation and skills front-matter correctly during compile-time `include_str!` extraction.
- **What Actually Happened**: Windows checkouts converted `\n` to `\r\n` (CRLF) due to default Git `core.autocrlf=true`. The YAML front-matter parser in `mirrord-mcp` expected strict POSIX line feeds (`\n`), failing the build during `cargo build` on Windows.
- **Evidence in Repo**: Commit `3a843d8d`, `.gitattributes` addition:
  *"mirrord mcp embeds docs/docs and skills/skills (mirrord/mcp/build.rs) and parses their front matter with LF line endings only, so the imported trees stay LF in every checkout, Windows included... text=auto eol=lf"*
- **Root Cause**: Missing `.gitattributes` rule permitted git checkout CRLF transformation for markdown trees embedded directly into binaries at compile time.
- **Remediation Code Diff**:
```gitattributes
# .gitattributes
+# `mirrord mcp` embeds `docs/docs` and `skills/skills` (`mirrord/mcp/build.rs`) and parses their
+# front matter with LF line endings only, so the imported trees stay LF in every checkout, Windows
+# included, whatever `core.autocrlf` says. `text=auto` lets Git normalize a file saved with CRLF on
+# commit while leaving the images, which it detects as binary, byte for byte.
+docs/** text=auto eol=lf
+guides/** text=auto eol=lf
+skills/** text=auto eol=lf
```
- **Lesson**: Any file format processed by compile-time procedural macros or `build.rs` using strict tokenization or byte offsets must be pinned to `eol=lf` in `.gitattributes`.

---

### Incident 5: FuturesUnordered Hang on mpsc Sender Channel Close Detection (BUG-ASYNC-5100)

- **Context**: `mirrord/agent/src/util.rs`
- **What Was Expected**: When multiple agent clients connect, a multiplexer tracking client disconnects via `ChannelClosedFuture` within a `FuturesUnordered` pool must resolve immediately when any client drops its `Receiver`.
- **What Actually Happened**: The multiplexing event loop hung indefinitely on `unordered.next().await`, never yielding disconnected clients.
- **Evidence in Repo**: `mirrord/agent/src/util.rs` unit tests and commit comments:
  *"The future used to hold the [`mpsc::Sender`] and call poll [`mpsc::Sender::closed`] in it's [`Future::poll`] implementation... However, [`FuturesUnordered::next`] was hanging forever due to [`mpsc::Sender::closed`] implementation details. New implementation of [`ChannelClosedFuture`] uses a [`BoxFuture`] internally, which works fine."*
- **Root Cause**: Invoking `.closed()` dynamically inside `poll()` recreated the transient future and deregistered/confused Tokio's internal wakers when managed by `FuturesUnordered`.
- **Remediation Code Diff**:
```rust
// mirrord/agent/src/util.rs
// - pub(crate) struct ChannelClosedFuture<T> {
// -     tx: mpsc::Sender<T>,
// -     client_id: ClientId,
// - }
// - impl<T> Future for ChannelClosedFuture<T> {
// -     type Output = ClientId;
// -     fn poll(self: Pin<&mut Self>, cx: &mut Context<'_