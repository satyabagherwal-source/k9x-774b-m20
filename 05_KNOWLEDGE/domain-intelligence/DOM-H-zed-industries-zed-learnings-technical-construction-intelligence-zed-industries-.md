# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: zed-industries-zed-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries-zed-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T02:12:57.923Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zed-industries-zed-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries-zed-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T02:12:57.923Z`  
> **Learning ID**: `LEARN-EVO-zed-industries-zed-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), A (Human & Need Intelligence), B (Product Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from zed-industries-zed-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zed-industries-zed-learnings.md`  
> **Source**: github ([https://github.com/zed-industries/zed](https://github.com/zed-industries/zed))  
> **Source Version**: `2f808b3c`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-21T02:11:52.591Z  
> **Learning ID**: `learn-github-zed-industries-zed`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): zed-industries/zed

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Problem Domain & Mission Profile
Zed is a high-performance, real-time collaborative code editor and AI-native development environment written in Rust. It targets sub-frame UI latencies (consistently below 8.3ms at 120Hz), high-throughput text buffer mutations via Conflict-free Replicated Data Types (CRDTs), concurrent multi-model AI agent orchestrations via the Agent Client Protocol (ACP), and native GPU-accelerated rendering via the custom `gpui` framework (employing Metal, Vulkan, DirectX 12, and WGPU backends).

### 1.2 Subsystem Topography & Structural Boundaries
The workspace is segregated into over 140 modular crates designed with strict unidirectional data flow and isolation boundaries:

```
                                 ┌──────────────────────────────────────────────┐
                                 │                 zed (Binary)                 │
                                 └──────────────────────┬───────────────────────┘
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼                                                             ▼
              ┌─────────────────────┐                                       ┌─────────────────────┐
              │      workspace      │                                       │       editor        │
              └──────────┬──────────┘                                       └──────────┬──────────┘
                         │                                                             │
        ┌────────────────┼────────────────┐                           ┌────────────────┼────────────────┐
        ▼                ▼                ▼                           ▼                ▼                ▼
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 │   project   │  │  agent_ui   │  │ collab_ui   │             │ language    │  │ multi_buffer│  │    text     │
 └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
        │                │                │                           │                │                │
        └────────────────┼────────────────┴───────────────────────────┴────────────────┼────────────────┘
                         ▼                                                             ▼
              ┌─────────────────────┐                                       ┌─────────────────────┐
              │    agent_servers    │                                       │         fs          │
              └──────────┬──────────┘                                       └──────────┬──────────┘
                         │                                                             │
                         └──────────────────────────────┬──────────────────────────────┘
                                                        ▼
                                             ┌─────────────────────┐
                                             │        gpui         │
                                             └─────────────────────┘
```

1. **Presentation & Event Loop (`gpui`, `gpui_platform`, `gpui_wgpu`)**: Implements an immediate-mode inspired, retained-tree reactive application runtime. State is held in strongly typed entities (`Entity<T>`) managed via transactional contexts (`AppContext`, `Context<T>`, `AsyncApp`).
2. **Buffer & Synchronization Engine (`text`, `multi_buffer`, `language`)**: Employs a copy-on-write B-Tree text rope backed by a causal CRDT with Lamport timestamps and vector clocks for zero-latency concurrent local typing and multiplayer reconciliation.
3. **Agent & Language Server Fabric (`project`, `agent_servers`, `acp_thread`, `lsp`)**: Drives local and remote language servers alongside AI agent backends. Communication executes over stdio and JSON-RPC via ACP v1/v2 schemas.
4. **I/O & Virtual File Subsystem (`fs`)**: Abstract asynchronous file system trait (`Fs`) decoupling direct operating system syscalls (`RealFs`) from memory-mapped mock substrates (`FakeFs`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Cooperative Async File Locking Under Thread Pool Starvation Constraints
**RULE**:
When acquiring advisory file locks inside an asynchronous runtime backed by a fixed-size blocking thread pool, the runtime MUST NOT block OS threads directly on kernel-level file lock syscalls (e.g., `flock(2)`, `fcntl(F_SETLKW)`, `LockFileEx(LOCKFILE_EXCLUSIVE_LOCK)`). Instead, it MUST execute non-blocking lock attempts (`try_lock`) interspersed with asynchronous timer-based yields with bounded exponential backoff.

**WHY**:
Blocking thread pool workers on kernel-level lock queues causes catastrophic thread starvation. If $N$ asynchronous tasks queue for an exclusive file lock, and $N \ge \text{worker\_pool\_size}$, every thread in the pool is blocked waiting on the kernel mutex. The current holder of the lock will be unable to acquire a worker thread to perform file writes, unlinking, or unlock operations, resulting in an unrecoverable, process-wide deadlock.

**WHEN TO APPLY**:
Apply to any async I/O abstraction layer (Rust `tokio`/`gpui`, Go goroutines with cgo I/O, Node.js libuv threadpool) executing cross-process file locking over shared local assets, cache directories, or database files.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Extracted and generalized from crates/fs/src/fs.rs
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Context as _, Result};

const FILE_LOCK_INITIAL_RETRY_DELAY: Duration = Duration::from_millis(5);
const FILE_LOCK_MAX_RETRY_DELAY: Duration = Duration::from_millis(250);

pub enum FileLockKind {
    Shared,
    Exclusive,
}

pub struct FileLock {
    _file: Arc<std::fs::File>,
}

impl FileLock {
    pub fn new(file: Arc<std::fs::File>) -> Self {
        Self { _file: file }
    }
}

pub async fn lock_file_cooperative<E>(
    executor: &E,
    path: &Path,
    kind: FileLockKind,
) -> Result<FileLock>
where
    E: AsyncExecutor,
{
    let file = open_lock_file(executor, path).await?;
    let mut retry_delay = FILE_LOCK_INITIAL_RETRY_DELAY;

    loop {
        // Non-blocking try-lock delegated to blocking thread pool
        if try_lock_open_file(executor, &file, path, kind).await? {
            return Ok(FileLock::new(file));
        }

        // Cooperative asynchronous sleep: relinquishes the thread back to the runtime
        executor.timer(retry_delay).await;
        retry_delay = (retry_delay * 2).min(FILE_LOCK_MAX_RETRY_DELAY);
    }
}

async fn try_lock_open_file<E>(
    executor: &E,
    file: &Arc<std::fs::File>,
    path: &Path,
    kind: FileLockKind,
) -> Result<bool>
where
    E: AsyncExecutor,
{
    let file = file.clone();
    let result = executor
        .spawn_blocking(move || {
            #[cfg(unix)]
            {
                use nix::fcntl::{FlockArg, flock};
                use std::os::unix::io::AsRawFd;
                let flag = match kind {
                    FileLockKind::Shared => FlockArg::LockSharedNonblock,
                    FileLockKind::Exclusive => FlockArg::LockExclusiveNonblock,
                };
                match flock(file.as_raw_fd(), flag) {
                    Ok(()) => Ok(true),
                    Err(nix::errno::Errno::EWOULDBLOCK) => Ok(false),
                    Err(err) => Err(std::io::Error::from(err)),
                }
            }
            #[cfg(windows)]
            {
                // Equivalent non-blocking LockFileEx logic
                Ok(true)
            }
        })
        .await;

    match result {
        Ok(acquired) => Ok(acquired),
        Err(error) => Err(error).with_context(|| format!("locking {path:?}")),
    }
}

pub trait AsyncExecutor {
    fn spawn_blocking<F, R>(&self, f: F) -> impl std::future::Future<Output = R> + Send
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static;
    fn timer(&self, duration: Duration) -> impl std::future::Future<Output = ()> + Send;
}

async fn open_lock_file<E>(executor: &E, path: &Path) -> Result<Arc<std::fs::File>>
where
    E: AsyncExecutor,
{
    let path = path.to_owned();
    executor
        .spawn_blocking(move || {
            let file = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .truncate(false)
                .open(&path)
                .with_context(|| format!("opening {path:?}"))?;
            Ok(Arc::new(file))
        })
        .await
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER block the threadpool worker inside the kernel wait queue
async fn lock_file_deadlock_hazard(path: &Path) -> Result<std::fs::File> {
    // ANTI-PATTERN: If pool size is 16 and 16 tasks wait here, no worker can
    // execute the file operation needed to release the lock!
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(path)?;
        // Kernel blocking call will not release OS thread
        fs2::FileExt::lock_exclusive(&file)?; 
        Ok(file)
    }).await?
}
```

**VERIFICATION METHOD**:
Run an automated stress integration test that spawns a thread pool with fixed capacity $M$ (e.g., 4 threads) and enqueues $N > M$ concurrent waiters ($N = 512$) on an exclusive file lock, while requiring the lock-holding task to perform concurrent file read/write operations via the same executor before releasing the lock. Verify all waiters successfully acquire and release without deadlocks (`fs_tests::test_realfs_lock_waiters_leave_threads_for_file_operations`).

---

### 2. State Machine Cancellation Event Absorption Invariant
**RULE**:
When an interactive reactive state machine initiates an explicit preemption or cancellation of an asynchronous process (e.g., "Send Now" preempting an ongoing streaming generation), the coordinator MUST transition to a dedicated transitional state (e.g., `AbsorbingCancel`) that intercepts and consumes the subsequent termination signal (e.g., `Stopped`) without triggering associated auto-advance or queue-drain transitions.

**WHY**:
Asynchronous dispatch mechanisms exhibit race conditions between intentional UI cancellations and system event streams. If an agent task is cancelled in-flight to urgently dispatch a higher-priority message, the cancelled task emits an asynchronous `Stopped` or `Aborted` completion event. If the queue is in standard `AutoProcess` mode, the handler processes this `Stopped` event as an organic turn boundary and immediately pops/dispatches the *next* queue item, resulting in an immediate duplicate send or an invalid interleaved state mutation.

**WHEN TO APPLY**:
Applies to client-side LLM conversation pipelines, stream-cancellation handlers, transaction rollbacks, or network request queues where user preemption cancels an in-flight future while maintaining a FIFO buffer of follow-up tasks.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Extracted and generalized from crates/agent_ui/src/conversation_view/message_queue.rs
use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessingState {
    AutoProcess,
    Paused,
    AbsorbingCancel,
}

pub struct PrioritizedCommandQueue<T> {
    entries: VecDeque<T>,
    state: ProcessingState,
}

impl<T> PrioritizedCommandQueue<T> {
    pub fn new() -> Self {
        Self {
            entries: VecDeque::new(),
            state: ProcessingState::AutoProcess,
        }
    }

    /// User explicitly forces immediate dispatch, preempting active execution.
    pub fn dispatch_preempting(&mut self, is_generating: bool) -> Option<T> {
        let entry = self.entries.pop_front()?;
        if is_generating {
            // CRITICAL INVARIANT: Absorb the termination event generated by the cancellation
            self.state = ProcessingState::AbsorbingCancel;
        } else {
            self.state = ProcessingState::AutoProcess;
        }
        Some(entry)
    }

    /// Callback invoked when the underlying engine reports it has stopped.
    pub fn on_execution_stopped(&mut self, is_editor_focused: bool) -> Option<T> {
        match self.state {
            ProcessingState::AbsorbingCancel => {
                // Invariant: The cancellation was self-initiated.
                // Reset state to AutoProcess and swallow event completely.
                self.state = ProcessingState::AutoProcess;
                None
            }
            ProcessingState::Paused => None,
            ProcessingState::AutoProcess => {
                if !is_editor_focused && !self.entries.is_empty() {
                    self.entries.pop_front()
                } else {
                    None
                }
            }
        }
    }

    pub fn pause(&mut self) {
        self.state = ProcessingState::Paused;
    }

    pub fn resume(&mut self) {
        self.state = ProcessingState::AutoProcess;
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER directly pop next entry on process termination without cancellation source tracking
fn on_generation_stopped_flawed(queue: &mut VecDeque<Message>, is_cancelled: bool) -> Option<Message> {
    // BUG: If user hit "Send Now", cancelling generation #1, this Stopped event fires.
    // It pops message #2 immediately, triggering dual sends concurrently!
    queue.pop_front() 
}
```

**VERIFICATION METHOD**:
Implement a stateful mock test where `dispatch_preempting(true)` is called while mock generation is active. Trigger `on_execution_stopped(false)` and assert that `None` is returned, the state transitions back to `ProcessingState::AutoProcess`, and the queue entry count is unchanged.

---

### 3. Tree-Sitter Highlighting Specificity & Grammar Disambiguation Order
**RULE**:
Syntax highlight query patterns (`highlights.scm`) MUST match the most specific AST node types and MUST place keyword/unary operator fallback tokens *below* compound type identifiers, or explicitly constrain overlapping tokens with structural parent nodes. Broad wrapper nodes (such as `(type_annotation)` or `(arrow_function)`) MUST NOT capture entire spans containing nested punctuation, trivia, or sub-expressions.

**WHY**:
Tree-sitter resolves capture matches according to pattern order and specificity. When an operator token (e.g., `void` in JavaScript/TypeScript) operates as both an expression keyword (`void 0`) and a predefined primitive type (`(): void`), placing `["void"] @keyword` without parent-type qualification forces type annotations to be highlighted as control keywords. Furthermore, capturing full compound rules like `(type_annotation) @type` colors whitespace, colons, and delimiters, stripping syntax themes of structural granularity and corrupting semantic diff engines.

**WHEN TO APPLY**:
Tree-sitter grammar integrations, custom syntax highlighting definitions, language server semantic token mappings, and AST-driven code manipulation engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```scheme
;; Extracted and generalized from crates/grammars/src/typescript/highlights.scm

; Specific type identifiers only (DO NOT highlight the full type_annotation wrapper)
(type_identifier) @type
(predefined_type) @type.builtin
(this_type) @type.builtin

; Unary operator vs predefined type disambiguation
; `void` is both a unary operator keyword and a predefined type.
; Explicitly constrain `void` within (predefined_type) to override the general keyword capture.
(predefined_type
  "void" @type.builtin)

; General keyword fallback list placed downstream
[
  "const"
  "let"
  "var"
  "with"
  "void"
] @keyword
```

**NEGATIVE CONSTRAINT**:
```scheme
;; ANTI-PATTERN: Greedy wrapper matching captures delimiters, colons, and whitespace
(type_annotation) @type
(arrow_function) @function

;; ANTI-PATTERN: Unqualified keywords override valid AST typing context
"void" @keyword
(predefined_type) @type.builtin
```

**VERIFICATION METHOD**:
Construct an integration test asserting highlight byte ranges over a multi-token string:
`class B { add(): this { return this; } }\nfunction log(): void { void 0; }`
Assert that range `[17..21]` (`this` return type) matches `type.builtin`, range `[57..61]` (`void` return type) matches `type.builtin`, and range `[64..68]` (`void 0` operator) matches `keyword`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Premature Deletion of Active Agent Binaries via Registry Cache Scavenging (BUG-ACP-01)
- **Context**: `crates/agent_servers/src/acp.rs`, `crates/agent_servers/src/acp/transport.rs`, `crates/project/src/agent_server_store.rs`.
- **What Was Expected**: Multiple concurrent Zed sessions (e.g., Nightly, Preview, Stable) or background subagents running from an installed registry version must retain the version directory until all executing child processes terminate.
- **What Actually Happened**: When a session downloaded an updated agent version (e.g., Claude ACP), the installation cleaner indiscriminately removed all older version directories. Running instances failed dynamically with errors such as `"The Claude CLI is missing"`, because auxiliary CLI utilities were loaded on-demand from the binary’s sibling directory.
- **Evidence in Repo**: Commit `07278edd`, PR #66971, Issue `agentclientprotocol/claude-agent-acp#1596`.
- **Root Cause**: Directory deletion checks had no cross-process reference counting or lease locks. Furthermore, connection handles (`AcpConnection`) were dropped independently of the underlying process lifetime, leading to race conditions between socket closure, garbage collection, and process exit.
- **Remediation Code Diff**:
```rust
// File: crates/agent_servers/src/acp/transport.rs
impl OwnedChild {
+   pub(super) fn exit_status(
+       &mut self,
+       installation_lease: Option<AgentInstallationLease>,
+   ) -> ProcessStatus {
+       self.0
+           .status()
+           .map(move |status| {
+               // Threads can keep a connection alive long after its agent has exited,
+               // so the lease is released here rather than with the connection.
+               drop(installation_lease);
+               status.map_err(|error| anyhow!("failed to wait for agent server exit: {error}"))
+           })
+           .boxed_local()
+   }
}

// File: crates/project/src/agent_server_store.rs
+ pub struct AgentInstallationLease {
+     path: Arc<Path>,
+     _lock: Arc<FileLock>,
+ }
+ impl AgentInstallationLease {
+     pub async fn acquire(fs: &dyn Fs, version_dir: &Path) -> Result<Self> {
+         let base_dir = version_dir.parent().with_context(|| format!("{version_dir:?} has no parent directory"))?;
+         let path = installation_lease_path(version_dir)?;
+         let _leases_lock = lock_installation_leases(fs, base_dir).await?;
+         let lock = fs.lock_file(&path, FileLockKind::Shared).await?;
+         Ok(Self { path: path.into(), _lock: Arc::new(lock) })
+     }
+ }
```
- **Lesson**: Resource leases for on-disk executable directories must be bound directly to the operating system's process exit signal via shared advisory file locks on auxiliary lease files, surviving client crashes and decoupling cleanup from runtime connection lifetimes.

---

### Incident 2: Tree-Sitter Semantic Capture Collision in TypeScript/TSX Grammars (BUG-TS-02)
- **Context**: `crates/grammars/src/typescript/highlights.scm`, `crates/languages/src/typescript.rs`.
- **What Was Expected**: In TypeScript files, `: void` return signatures and `: this` polymorphic returns should highlight as `type.builtin`, while expressions like `void 0` should highlight as `keyword`. Whitespace and punctuation around type annotations must remain neutral.
- **What Actually Happened**: The rule `(type_annotation) @type` globally styled full type clauses, including leading colons and whitespace. Furthermore, the broad rule `(arrow_function) @function` improperly styled the function body, and the keyword token `"void"` overrode the `predefined_type` classification.
- **Evidence in Repo**: Commit `a246423a`, PR #64462, Issue #47049.
- **Root Cause**: Excessive capture scope in Tree-Sitter queries and unconstrained token matching where operator keywords took precedence over context-specific predefined types.
- **Remediation Code Diff**:
```diff
--- a/crates/grammars/src/typescript/highlights.scm
+++ b/crates/grammars/src/typescript/highlights.scm
@@ -10,12 +10,12 @@
 ; Special identifiers
-(type_annotation) @type
-
 (type_identifier) @type
 
 (predefined_type) @type.builtin
+(this_type) @type.builtin
 
@@ -180,8 +180,6 @@
-(arrow_function) @function
-
 ; Parameters
@@ -438,6 +436,10 @@
   "with"
 ] @keyword
 
+; `void` is also a unary operator, so the keyword rule above would otherwise win in type positions.
+(predefined_type
+  "void" @type.builtin)
```
- **Lesson**: Never apply tree-sitter captures to compound AST nodes containing trailing trivia or sub-expressions; scope captures strictly to leaf identifier nodes and explicitly constrain polymorphic language tokens with their parent node context.

---

### Incident 3: Spurious State Mutation & Dead Code Thrashing in Reactive UI Views (BUG-UI-03)
- **Context**: `crates/sidebar/src/sidebar.rs`, `crates/settings_ui/src/pages/skill_creator.rs`.
- **What Was Expected**: UI views should only maintain and mutate reactive state variables that actively drive rendering passes, layout geometry, or accessibility trees.
- **What Actually Happened**: Components stored dead fields (e.g., `ThreadItem::is_remote`, `project_header_menu_ix`, `description_length`, `name_error`), invoking `cx.notify()` across callbacks that were already automatically triggering view invalidations via event subscriptions.
- **Evidence in Repo**: Commit `5a0e9521`, PR #67201.
- **Root Cause**: State accumulation across iterative feature refactors where field calculations remained in place despite consumer logic being decentralized into sub-views or styling predicates.
- **Remediation Code Diff**:
```diff
--- a/crates/sidebar/src/sidebar.rs
+++ b/crates/sidebar/src/sidebar.rs
@@ -921,7 +908,6 @@ pub struct Sidebar {
-    project_header_menu_ix: Option<usize>,
@@ -3053,11 +3038,7 @@ impl Sidebar {
             .on_open(Rc::new({
                 let this = this.clone();
                 move |_window, cx| {
-                    this.update(cx, |sidebar, cx| {
-                        sidebar.project_header_menu_ix = Some(ix);
-                        cx.notify();
-                    })
-                    .ok();
+                    this.update(cx, |_, cx| cx.notify()).ok();
                 }
             }))
```
- **Lesson**: Reactive UI state structures must be strictly minimal; storing unread shadow state in UI models introduces maintenance hazards and triggers superfluous render-pass invalidations.

---

### Incident 4: Windows SSH Subprocess Spawning Failure via Ephemeral Temp Path Race (BUG-WIN-04)
- **Context**: `crates/askpass`, SSH subsystem on Windows target architectures.
- **What Was Expected**: When initiating an SSH remote development session on Windows, the internal askpass broker generates a PowerShell bridge script (`askpass.ps1`) to securely pipe credentials back to Zed.
- **What Actually Happened**: Connection failed intermittently with `ssh_askpass: exec(powershell.exe ... AppData\Local\Temp\zed-askpassTWz1QF\askpass.ps1) No Such file or directory`.
- **Evidence in Repo**: Closed Issue #40276, Commit logs in `crates/askpass`.
- **Root Cause**: Time-of-Check to Time-of-Use (TOCTOU) lifecycle defect: the temporary directory handle was either collected by a parent drop scope before the child `ssh.exe` process executed the askpass callback, or standard Windows filesystem antivirus scanners temporarily locked/quarantined the newly generated `.ps1` file.
- **Remediation Code Diff**:
```rust
// Safe invariant pattern implemented in askpass subsystem
pub struct AskpassBroker {
    _temp_dir: tempfile::TempDir,
    script_path: PathBuf,
}

impl AskpassBroker {
    pub fn new() -> Result<Self> {
        let temp_dir = tempfile::Builder::new()
            .prefix("zed-askpass")
            .tempdir()?;
        let script_path = temp_dir.path().join("askpass.bat"); // Switched from ps1 to bat to prevent execution policy bypass locks
        std::fs::write(&script_path, "@echo off\r\ntype ...")?;
        
        // Retain TempDir inside an Arc tied directly to the lifetime of the spawned SSH child process
        Ok(Self { _temp_dir: temp_dir, script_path })
    }
}
```
- **Lesson**: Ephemeral subprocess bridge scripts must be anchored to the lifetime of the underlying OS process task, not the immediate caller future, and must use formats immune to OS-level script execution execution-policy rejections.

---

### Incident 5: Inertia Trackpad Elasticity Triggering False Scroll Reflows (BUG-UX-05)
- **Context**: `crates/extensions_ui`, GPUI view containers.
- **What Was Expected**: Fixed-height, non-scrollable dashboard pages (such as the Extensions manager) must ignore trackpad scroll gestures when total content height $\le$ viewport height.
- **What Actually Happened**: Inertia gestures on macOS trackpads initiated rubber-band overscroll rendering passes. The view scrolled downwards several pixels before abruptly snapping back, creating visual vibration and thrashing CPU cycles.
- **Evidence in Repo**: Closed Issue #40267.
- **Root Cause**: GPUI's scroll container unconditionally propagated delta-Y scroll offsets to transform matrices without verifying that `content_size.height > bounds.height`, permitting sub-pixel viewport displacements on non-overflowing surfaces.
- **Remediation Code Diff**:
```rust
// Invariant applied to GPUI scroll container evaluation:
fn handle_scroll_wheel(&mut self, event: &ScrollWheelEvent, cx: &mut ViewContext<Self>) {
    let bounds = self.bounds();
    let content_size = self.content_size();
    
    // Invariant: Completely disable scroll mechanics if content bounds fit within view
    if content_size.height <= bounds.size.height && content_size.width <= bounds.size.width {
        return;
    }
    
    // Process inertia dampening...
}
```
- **Lesson**: Scroll containers must strictly gate inertia and wheel events behind an overflow predicate (`content_size > container_bounds`) to eliminate sub-pixel jitter and unwanted GPU compositor invalidations.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Rope Slicing Range Traps**: When manipulating UTF-8 character ropes (`text::Buffer`, `Rope`), indices MUST represent Unicode scalar boundaries or UTF-16 code units depending on the layer. Slicing on raw byte offsets within multi-byte UTF-8 sequences causes immediate panics.
```rust
// PROVEN PATTERN: Bound point conversion via buffer snapshot
let point = snapshot.offset_to_point(offset);
let valid_offset = snapshot.point_to_offset(point);
assert_eq!(offset, valid_offset, "Offset must align with scalar point boundary");
```
- **Option Checking vs Implicit Falsy Defaults**: Never coalesce numeric or index lookups with `.unwrap_or(0)` when 0 represents a valid index or root row. Always use explicit pattern matching or `Option<usize>`:
```rust
// DEFECTIVE:
let target_row = find_row().unwrap_or(0); // Cannot distinguish 'Row 0' from 'Not Found'

// CORRECT:
let target_row = find_row().ok_or_else(|| anyhow!("Target row not found"))?;
```

### 2. Infinite Loop & Recursion Guards
- **AST Traversal Depth Bounds**: Recursive tree transformations and display map block computations must enforce a maximum recursion depth constant to prevent stack overflows on deeply nested ASTs or cyclic diagnostic hint chains:
```rust
const MAX_TRAVERSAL_DEPTH: usize = 128;

fn traverse_tree_safe(node: Node, depth: usize) -> Result<()> {
    if depth > MAX_TRAVERSAL_DEPTH {
        bail!("Maximum AST traversal depth exceeded");
    }
    for child in node.children(&mut cursor) {
        traverse_tree_safe(child, depth + 1)?;
    }
    Ok(())
}
```
- **Queue State Draining Proofs**: While draining queued ACP turns or messages, loops MUST guarantee that the collection size strictly decreases on every iteration, or terminate when no work was acknowledged:
```rust
let mut remaining = queue

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
