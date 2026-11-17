> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `9c7cb976`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-17T19:54:40.903Z  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): codewhale-hq/Codewhale

---

## 1. Executive Forensic Architecture & System Mechanics

`codewhale-hq/Codewhale` is a high-concurrency, cross-platform terminal coding agent and orchestrator written in Rust. It executes autonomous multi-agent loops, manages external tool integrations via the Model Context Protocol (MCP), enforces zero-escalation capability boundaries, and delivers predictable local/remote LLM interactions.

```
+---------------------------------------------------------------------------------------------------------+
|                                        TUI LAYER (crates/tui)                                           |
| - Terminal rendering loop (Ratatui)               - Input event router & hotkey scheduler               |
| - Context Reference Inspector                     - Bounded snapshot receiver (Session Confirmation)    |
+---------------------------------------------------+-----------------------------------------------------+
                                                    |
                                    tokio mpsc / oneshot / Engine API
                                                    v
+---------------------------------------------------------------------------------------------------------+
|                                      ENGINE CORE (crates/engine)                                        |
| +-----------------------------------------------+ +---------------------------------------------------+ |
| |        RuntimeThreadManager (Orchestrator)    | |             Extension Host & Supervisor           | |
| | - Turn settlement pipeline & deadlock watchdog| | - Process cohort manager (Reviewed vs Agent)      | |
| | - OS-level advisory file locks (fsync-bound)  | | - Generational host tracker (host_generation u64) | |
| | - PrefixStabilityManager (Prompt KV-cache)    | | - MCP Pool & Native Connectors Manager            | |
| +-----------------------------------------------+ +---------------------------------------------------+ |
|                         |                                                 |                             |
|          Child derivation / Non-escalation                Supervision RPC / stdio IPC                   |
|                         v                                                 v                             |
| +-----------------------------------------------+ +---------------------------------------------------+ |
| |        Worker Runtime Profile Subsystem       | |             Sandboxed Dynamic Plugins             | |
| | - ChildGrant (Least permissive Ord::min)      | | - Node / Native runtimes                          | |
| | - Dual-axis authority (FileGrant, ShellGrant) | | - Dirty teardown detector & planned recycler      | |
| +-----------------------------------------------+ +---------------------------------------------------+ |
+---------------------------------------------------------------------------------------------------------+
       |                                       |                                           |
       v                                       v                                           v
+--------------------+               +--------------------+                      +--------------------+
| crates/agent-contract |            | crates/core        |                      | crates/config      |
| Role presets &     |               | Fragment bounds,   |                      | Setup state, hooks |
| Authority Envelopes|               | KMP overlap algo   |                      | & atomic state dir |
+--------------------+               +--------------------+                      +--------------------+
```

### Architectural Subsystem Boundaries and Isolation Contracts

1. **Host Isolation Cohorts (`crates/engine/src/extension_host`)**:
   Code execution and tool plugins run within explicit *Host Cohorts* (`HostCohort::Reviewed` vs. `HostCohort::Agent`). Code executed on behalf of untrusted or sub-agent activity is cordoned off in separate OS processes. A crash loop in the `Agent` cohort cannot fault or poison the `Reviewed` cohort host.
2. **Generational Extension Host Supervision**:
   Processes in a cohort undergo automated teardowns upon memory saturation or protocol errors. The orchestrator tracks host lifetimes through a monotonically incrementing atomic counter (`host_generation: AtomicU64`). MCP connector activations do not fail abruptly during planned recycles; instead, they observe generational transitions and await host stabilization within bounded deadlines.
3. **Capability Derivation & Non-Escalation Engine (`crates/agent-contract`)**:
   Sub-agents operate under a mathematical capability intersection contract (`parent.intersect(child)`). Sub-agent roles (such as `Scout`, `Reviewer`, `Planner`, `Builder`) are bounded projections across file, shell, network, and delegation axes. Authority can only narrow (`Ord::min`), eliminating privilege escalation at runtime.
4. **Durable Event Storage & File Locking (`crates/engine/src/runtime_threads.rs`)**:
   Event sequencing across multiple processes is coordinated via an OS-level file lock (`events.lock`) accompanied by explicit transaction write cycles and `fsync` flushes. Waiters poll at millisecond intervals up to bounded deadlock limits.
5. **Deterministic Prefix Caching (`crates/core/src/prefix_cache.rs`)**:
   To exploit KV-cache reuse in large language models, the orchestrator divides system prompts and tool schemas into an immutable prefix, append-only history, and the latest user turn. The prefix is fingerprinted using SHA-256 over canonicalized JSON tool definitions in strict wire order. Any structural drift is trapped, attributed, and isolated.

---

## 2. Net-New Universal Engineering Rules

### 1. Generational Host State-Aware Retry Invariant
**RULE**:
When an RPC or IPC client initiates a connection to an ephemeral, supervised worker process, it MUST NOT treat an in-flight status of `Restarting` or `Unresponsive` as a fatal terminal error. The connector MUST sample the supervisor's generational counter (`host_generation: AtomicU64`), await recovery via an asynchronous state-change notification bounded by the overall operation deadline, and verify that the target host generation has incremented before retrying.

**WHY**:
Supervised host environments recycle processes periodically due to memory limits, dirty process terminations, or dynamic reconfiguration. If an orchestrator attempts an MCP or plugin connection in the idle gap between an unmount and a respawn, classifying `Restarting` as an immediate connection failure causes non-deterministic operational flakes under load.

**WHEN TO APPLY**:
Subsystems managing child processes, plugin runtimes, local MCP servers, language servers (LSP), and supervised microservices managed via supervisors with automated self-healing.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::time::{Instant, timeout_at};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostStatus {
    Starting,
    Active,
    Restarting,
    Unresponsive,
    Dead,
}

pub struct SupervisorState {
    pub generation: AtomicU64,
    pub status: parking_lot::RwLock<HostStatus>,
    pub notify: tokio::sync::Notify,
}

#[derive(Debug, thiserror::Error)]
pub enum ConnectionError {
    #[error("Client operation deadline exceeded")]
    DeadlineExceeded,
    #[error("Host permanently failed: {0}")]
    Fatal(String),
}

pub async fn connect_with_generational_retry<C, F, Fut>(
    supervisor: Arc<SupervisorState>,
    deadline: Instant,
    mut connect_fn: F,
) -> Result<C, ConnectionError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<C, String>>,
{
    loop {
        let initial_gen = supervisor.generation.load(Ordering::SeqCst);
        let status = *supervisor.status.read();

        match status {
            HostStatus::Active => {
                let attempt = connect_fn();
                match timeout_at(deadline, attempt).await {
                    Ok(Ok(client)) => return Ok(client),
                    Ok(Err(err)) => {
                        // Check if connection failed because host began recycling mid-flight
                        let current_gen = supervisor.generation.load(Ordering::SeqCst);
                        let is_restarting = matches!(
                            *supervisor.status.read(),
                            HostStatus::Restarting | HostStatus::Starting
                        );
                        if current_gen == initial_gen && !is_restarting {
                            return Err(ConnectionError::Fatal(err));
                        }
                    }
                    Err(_) => return Err(ConnectionError::DeadlineExceeded),
                }
            }
            HostStatus::Starting | HostStatus::Restarting | HostStatus::Unresponsive => {
                // Passively wait for generation increment or state notification within deadline
            }
            HostStatus::Dead => return Err(ConnectionError::Fatal("Host declared dead".into())),
        }

        // Bounded passive wait
        let notification = supervisor.notify.notified();
        if timeout_at(deadline, notification).await.is_err() {
            return Err(ConnectionError::DeadlineExceeded);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Failing fast on supervisor transitional states
let status = supervisor.get_status();
if status == HostStatus::Restarting {
    // BUG: Rejects valid in-flight operations during planned recycling
    return Err(ConnectionError::Fatal("Extension host is restarting".into()));
}
```

**VERIFICATION METHOD**:
Inject a synthetic planned recycle trigger (`fire_pre_connect_hook`) immediately prior to socket dial. Verify with a deterministic test harness that the operation pauses without raising an error, waits for the generation counter to bump, and cleanly connects within the outer deadline window.

---

### 2. Multi-Process Durable Transaction Lock Ceiling
**RULE**:
When coordinating disk-backed state across multiple independent processes using file-level advisory locks (`flock` / `LockFileEx`), developers MUST size transaction acquisition timeouts to accommodate worst-case, concurrent `fsync` / `FlushFileBuffers` I/O latencies under peak IOPS saturation. Diagnostic and synchronization timeouts MUST be treated as deadlock watchdogs rather than performance SLAs.

**WHY**:
An atomic disk append requires an advisory file lock, directory entry modifications, and an `fsync` call. Under concurrent load (e.g., CI runners or loaded spinning disks), multiple threads or processes flushing multi-megabyte write-ahead logs can easily stall disk queues for 10–20 seconds. An interactive timeout (e.g., 2–5 seconds) causes lock acquisition failures even when the lock holder is making continuous forward progress.

**WHEN TO APPLY**:
Multi-process CLI agents, SQLite/WAL operations, custom transaction logs, and cross-process telemetry queues running on Windows, macOS, and containerized Linux environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::{File, OpenOptions};
use std::path::Path;
use std::time::{Duration, Instant};

pub const TRANSACTION_DEADLOCK_CEILING: Duration = Duration::from_secs(25);
pub const LOCK_POLL_INTERVAL: Duration = Duration::from_millis(5);

#[derive(Debug, thiserror::Error)]
#[error("Runtime event lock timed out after {0:?}")]
pub struct LockTimeoutError(Duration);

pub struct FileTransactionLock {
    file: File,
}

impl FileTransactionLock {
    pub fn acquire(lock_path: &Path, ceiling: Duration) -> Result<Self, LockTimeoutError> {
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(lock_path)
            .expect("Failed to open transaction lock file");

        let started = Instant::now();
        loop {
            // Attempt non-blocking flock / LockFileEx
            match fs2::FileExt::try_lock_exclusive(&file) {
                Ok(()) => return Ok(Self { file }),
                Err(_) => {
                    if started.elapsed() >= ceiling {
                        return Err(LockTimeoutError(ceiling));
                    }
                    std::thread::sleep(LOCK_POLL_INTERVAL);
                }
            }
        }
    }
}

impl Drop for FileTransactionLock {
    fn drop(&mut self) {
        let _ = fs2::FileExt::unlock(&self.file);
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Imposing interactive UI latencies onto durable OS file transactions
pub fn acquire_lock(file: &File) -> Result<(), Error> {
    // BUG: 2-5 seconds fails under parallel disk fsync on CI virtual disks
    let deadline = Instant::now() + Duration::from_secs(2);
    while fs2::FileExt::try_lock_exclusive(file).is_err() {
        if Instant::now() > deadline {
            panic!("Runtime event lock timed out after 2s");
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    Ok(())
}
```

**VERIFICATION METHOD**:
Run 8 child processes concurrently executing loops of 16 transactional events with an explicit `fsync` after each write. Ensure zero lock-timeout errors occur across 100 consecutive runs on virtualized Windows CI instances.

---

### 3. Capability Non-Escalation Derivation via Bounded Monotonicity
**RULE**:
Child agent authorization MUST be modeled as a monotonic lattice intersection where child permissions are strictly derived from parent permissions via operations bounded by `Ord::min` or Boolean conjunction (`&&`). Child profiles MUST NEVER accept unconstrained raw string lists or explicit role names to expand permissions beyond the parent's ambient grant.

**WHY**:
Allowing sub-agents to declare standalone role boundaries causes privilege escalation: an unprivileged `Scout` agent could spawn a `Builder` agent capable of arbitrary workspace mutations or network exfiltration unless derivation algebraically intersects against the parent's actual authority.

**WHEN TO APPLY**:
Multi-agent orchestrators, LLM sub-agent spawning, plugin permission boundaries, dynamic role delegation frameworks.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FileGrant {
    None,
    Read,
    Write,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ShellGrant {
    None,
    Inspect,
    Verify,
    Full,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityProfile {
    pub files: FileGrant,
    pub shell: ShellGrant,
    pub network: bool,
    pub spawn: bool,
    pub allowed_tools: Option<Vec<String>>,
}

impl AuthorityProfile {
    #[must_use]
    pub fn derive_child(&self, requested: &AuthorityProfile) -> Self {
        // Enforce monotonic non-escalation across every authority axis
        let files = self.files.min(requested.files);
        let shell = self.shell.min(requested.shell);
        let network = self.network && requested.network;
        let spawn = self.spawn && requested.spawn;

        // Tool scope intersection
        let allowed_tools = match (&self.allowed_tools, &requested.allowed_tools) {
            (Some(parent_tools), Some(child_tools)) => {
                let filtered: Vec<String> = child_tools
                    .iter()
                    .filter(|tool| parent_tools.contains(tool))
                    .cloned()
                    .collect();
                Some(filtered)
            }
            (Some(parent_tools), None) => Some(parent_tools.clone()),
            (None, Some(child_tools)) => Some(child_tools.clone()),
            (None, None) => None,
        };

        Self {
            files,
            shell,
            network,
            spawn,
            allowed_tools,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Trusting requested child role blindly without parent intersection
pub fn spawn_child(parent: &Worker, requested_role: FleetRole) -> Worker {
    // BUG: If parent is read-only, spawning a Builder escalates to write access
    let grant = ChildGrant::for_role(&requested_role);
    Worker::new(grant)
}
```

**VERIFICATION METHOD**:
Implement property-based tests verifying the non-escalation invariant:
$\forall (P, R), \text{derive\_child}(P, R) \le P$ across all dimensions (`files`, `shell`, `network`, `spawn`).

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: MCP Native Connector Flake During Host Process Recycling (BUG-DSH-01)
- **Context**: Extension host supervisor and native MCP client (`crates/engine/src/extension_host/dsh_plugins.rs`).
- **What Was Expected**: Installing or activating a plugin requiring a native MCP connector must reliably initialize connectors within the allotted activation deadline, even if the underlying process cohort undergoes an automatic recycle.
- **What Actually Happened**: The extension host monitor periodically triggers a planned restart (`HostStatus::Restarting`) after repeated dirty teardowns or memory saturation. When an MCP connection request hit this idle transition window, it immediately treated `HostStatus::Restarting` as an unrecoverable failure and aborted the installation with:
  `required MCP connectors failed: restarting after: planned restart after repeated dirty teardowns`.
- **Evidence in Repo**: Commit `21619f0b`, PR CW-7957.
- **Root Cause**: `connect_required_plugin_mcp_servers` categorized any non-zero failure immediately as `McpActivationError::Failed` without verifying if the extension host cohort was merely cycling generations.
- **Remediation Code Diff**:
```rust
// In crates/engine/src/extension_host/dsh_plugins.rs
 enum McpActivationError {
     Cancelled,
     Failed(String),
+    HostRestarting(String),
 }

@@ -1755,11 +1812,14 @@ async fn connect_required_plugin_mcp_servers(
             format!("required MCP connectors failed: {}", failures.join("; "))
         };
         let mut truncated = false;
-        return Err(McpActivationError::Failed(cap_text(
-            joined,
-            MAX_DIAGNOSTIC_BYTES,
-            &mut truncated,
-        )));
+        let capped = cap_text(joined, MAX_DIAGNOSTIC_BYTES, &mut truncated);
+        let recycling =
+            !deadline_hit && host_recycling(&super::manager().shared, cohort, since_generation);
+        return Err(if recycling {
+            McpActivationError::HostRestarting(capped)
+        } else {
+            McpActivationError::Failed(capped)
+        });
     }
```
- **Lesson**: Ephemeral processes under supervisor lifecycles must expose explicit generational identifiers so clients can distinguish between permanent process death and intentional restarts.

---

### Incident 2: Cross-Process Event-Store Lockout Under Fsync Saturation (BUG-RTLOCK-02)
- **Context**: Durable runtime thread persistence (`crates/engine/src/runtime_threads.rs`).
- **What Was Expected**: Multi-process thread workers appending events to the append-only event store must serialize cleanly via OS file locking.
- **What Actually Happened**: On busy Windows and macOS CI workers running parallel test suites, writer threads holding `events.lock` flushed dirty pages via `fsync`. Slower readers polling with a 5 ms backoff exhausted their 5-second lock timeout ceiling, crashing with:
  `Runtime event lock timed out after 5s`.
- **Evidence in Repo**: Commit `36d6a6fd`, PR CW-7957.
- **Root Cause**: An arbitrary 5-second timeout was hardcoded for cross-process file-lock acquisitions, conflating interactive user latency goals with storage deadlock ceilings under extreme I/O contention.
- **Remediation Code Diff**:
```rust
// In crates/engine/src/runtime_threads.rs
 pub const RUNTIME_EVENT_REPLAY_BATCH_SIZE: usize = 256;
 pub const MAX_RUNTIME_EVENT_REPLAY_TAIL: usize = 4096;
 pub const MAX_RUNTIME_TURN_OPERATION_KEY_BYTES: usize = 128;
-const EVENT_TRANSACTION_LOCK_TIMEOUT: Duration = Duration::from_secs(5);
+const EVENT_TRANSACTION_LOCK_TIMEOUT: Duration = Duration::from_secs(25);
 const EVENT_TRANSACTION_LOCK_POLL: Duration = Duration::from_millis(5);
```
- **Lesson**: Lock timeouts protecting durable storage transactions against deadlock must be decoupled from UI-facing latency budgets.

---

### Incident 3: Test Flakes Caused by Conflating Deadlock Ceilings with Performance Gates (BUG-RTLOAD-03)
- **Context**: Thread manager integration tests (`crates/engine/src/runtime_threads/tests.rs` and `subagent/budget_handback_tests.rs`).
- **What Was Expected**: Test harnesses asserting asynchronous state settlement (e.g., turn steering, subagent token usage accounting) should verify state transitions deterministically.
- **What Actually Happened**: Six asynchronous tests failed non-deterministically on Windows runners within a 2-minute span. The tests placed tight 2-second timeout gates over the monitor's settlement pipeline (which performs successive disk flushes for terminal saves, turn saves, and receipt logs).
- **Evidence in Repo**: Commit `cacb7ec3`, PR CW-7957.
- **Root Cause**: Test assertions used optimistic 2-second `tokio::time::timeout` gates as performance assertions rather than using realistic deadlock ceilings.
- **Remediation Code Diff**:
```rust
// In crates/engine/src/runtime_threads/tests.rs
-// Deadlock ceiling for monitor settlement in the 10k-test lib binary. This is
-// a test watchdog, not an expected runtime latency or a customer-facing SLO.
-const TURN_SETTLEMENT_DEADLOCK_TIMEOUT: Duration = Duration::from_secs(10);
+const TURN_SETTLEMENT_DEADLOCK_TIMEOUT: Duration = Duration::from_secs(60);

@@ -17105,7 +17105,7 @@ async fn terminal_turn_cancels_pending_dynamic_tool_exactly_once() -> Result<()>
     });
-    tokio::time::timeout(Duration::from_secs(2), async {
+    tokio::time::timeout(TURN_SETTLEMENT_DEADLOCK_TIMEOUT, async {
         loop {
             if !manager
```
- **Lesson**: In asynchronous, I/O-heavy integration tests, timeouts must act solely as deadlock sentinels, never as latent performance gates.

---

### Incident 4: Sub-Agent Workspace Law Amnesia via Prompt Isolation (BUG-SUBAGENT-04)
- **Context**: Child agent spawning and prompt construction (`crates/engine/src/subagent`).
- **What Was Expected**: System-level pinned rules and memory (e.g., "always run tests before committing", "only edit in `./src`") pinned by the user must bind sub-agents delegated to execute tasks.
- **What Actually Happened**: Root agents followed pinned rules, but delegated sub-agents violated workspace guidelines. `Engine::new_child_admitted` cleared `memory_enabled`, causing child prompts to omit the session's native memory packet and hygiene guidance entirely.
- **Evidence in Repo**: Issue #7359.
- **Root Cause**: The child initialization sequence cleared the memory flag to prevent child turns from inadvertently duplicating root-session memory reconciliation logic, but neglected to inject the parent's compiled memory packet into the child's static prompt.
- **Remediation Code Diff**:
```rust
// In crates/engine/src/subagent/prompt.rs
 pub fn build_subagent_system_prompt_with_skills(
     context: &ToolContext,
     role_contract: &str,
     catalog: &SkillCatalog,
 ) -> String {
     let mut prompt = String::from(role_contract);
+    // Recompose memory packet without enabling active reconciliation
+    if let Some(memory_section) = memory_prompt_section(&context.memory_path) {
+        prompt.push_str("\n\n");
+        prompt.push_str(&memory_section);
+    }
     prompt.push_str("\n\n");
     prompt.push_str(&catalog.render());
     prompt
 }
```
- **Lesson**: Immutable constraints and governance rules must be decoupled from mutable operational state flags so child contexts inherit security envelopes without inheriting parent session-state loops.

---

### Incident 5: TUI Terminal Event Loop Lockup on Unbounded Session Snapshot Waits (BUG-TUI-05)
- **Context**: Terminal UI engine snapshot polling (`crates/tui`).
- **What Was Expected**: The TUI must remain responsive to keyboard input and refresh terminal rendering even if the underlying engine is busy executing a multi-stage turn.
- **What Actually Happened**: When a queued turn began before the preceding completion handler received its engine snapshot, the TUI entered an unbounded synchronous wait on the snapshot response channel. The UI thread blocked, halting rendering and discarding user keystrokes.
- **Evidence in Repo**: Issue #7361 / #7360.
- **Root Cause**: The snapshot request future had no localized timeout, tying UI frame dispatch directly to background turn duration.
- **Remediation Code Diff**:
```rust
// In crates/tui/src/session.rs
-let snapshot = engine_rx.await?;
+let snapshot = match tokio::time::timeout(SESSION_CONFIRMATION_BUDGET, engine_rx).await {
+    Ok(Ok(snap)) => snap,
+    Ok(Err(err)) => return Err(SessionError::SnapshotChannelClosed(err)),
+    Err(_) => {
+        tracing::warn!("Engine snapshot timed out; keeping recovery checkpoint");
+        return Ok(SessionWaitState::PendingSnapshot);
+    }
+};
```
- **Lesson**: A UI rendering thread must never await a background execution worker without a strict deadline and an explicit degraded/pending fallback state.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Attachment Path Extraction & Ambiguity Avoidance
When matching substrings in unstructured LLM output, greedy or reverse splits introduce edge-case parsing bugs. For example, macOS screenshots contain the substring `" at "` in their default filenames (e.g., `Screenshot 2026-09-28 at 9.18.11 AM.png`). Using `rsplit_once(" at ")` corrupts the path.

```rust
// In crates/core/src/context_reference.rs
fn attachment_path(rest: &str) -> &str {
    if looks_absolute(rest) {
        return rest;
    }
    // Match the FIRST occurrence of " at " followed by a valid absolute path
    rest.match_indices(" at ")
        .map(|(idx, sep)| &rest[idx + sep.len()..])
        .find(|candidate| looks_absolute(candidate))
        // Fall back to rsplit_once ONLY for legacy relative paths
        .or_else(|| rest.rsplit_once(" at ").map(|(_, path)| path))
        .unwrap_or(rest)
}

fn looks_absolute(path: &str) -> bool {
    let bytes = path.as_bytes();
    path.starts_with(['/', '\\', '~'])
        || (bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && matches!(bytes[2], b'\\' | b'/'))
}
```

#### Safe UTF-8 Boundary Truncation
Truncating a byte buffer directly at an arbitrary byte limit risks slicing multibyte UTF-8 codepoints, leading to runtime panics.

```rust
// In crates/core/src/fragments.rs
let mut end = INSTRUCTIONS_FILE_MAX_BYTES.min(text.len());
while end > 0 && !text.is_char_boundary(end) {
    end -= 1; // Step backward until a valid UTF-8 codepoint boundary is reached
}
text.truncate(end);
```

#### Shell Exit Code Type Safety
Windows NT status codes (such as `0xC0000005` for Access Violation) translate to unsigned 32-bit values (`3221225477`). Representing exit codes as standard POSIX `i32` causes sign overflow, making crash conditions impossible to match in predicates. Exit codes must always be handled as `i64`:

```rust
// In crates/config/src/hooks.rs
pub enum HookCondition {
    ExitCode {
        // i64 avoids sign truncation of Windows NT 32-bit crash codes
        code: i64,
    },
}
```

---

### 2. Infinite Loop & Recursion Guards

#### Monotonic KMP Overlap Invariant
When calculating transcript re-entry overlaps during session restoration, nested loop comparisons are vulnerable to $O(N^2)$ algorithmic stalling attacks. The engine uses a Knuth-Morris-Pratt (KMP) failure-function prefix table to find the longest repeated slice in strictly linear $O(N + M)$ time.

```rust
// In crates/core/src/lib.rs
pub fn persisted_overlap<T: PartialEq>(persisted: &[T], offered: &[T]) -> usize {
    if offered.is_empty() {
        return 0;
    }
    let mut failure = vec![0; offered.len()];
    for index in 1..offered.len() {
        let mut matched = failure[index - 1];
        while matched > 0 && offered[index] != offered[matched] {
            matched = failure[matched - 1];
        }
        if offered[index] == offered[matched] {
            matched += 1;
        }
        failure[index] = matched;
    }
    let mut matched = 0;
    for item in persisted {
        if matched == offered.len() {
            matched = failure[matched - 1];
        }
        while matched > 0 && *item != offered[matched] {
            matched = failure[matched - 1];
        }
        if *item == offered[matched] {
            matched += 1;
        }
    }
    matched
}
```

#### Context Fragment Clamping & Token Budgets
To prevent model context overflow and token exhaustion attacks, incoming fragments are bounded by hard caps:

```rust
// In crates/core/src/fragments.rs
pub const MAX_FRAGMENT_TOKENS: usize = 10_000;
pub const MAX_FRAGMENT_BYTES: usize = MAX_FRAGMENT_TOKENS * 4; // 40_000 bytes
pub const MAX_FRAGMENTS_PER_CONTEXT: usize = 16;

pub fn validate_fragment_set(fragments: &[BoundedFragment]) -> Result<(), FragmentCapError> {
    if fragments.len() > MAX_FRAGMENTS_PER_CONTEXT {
        return Err(FragmentCapError::TooManyFragments {
            count: fragments.len(),
            max: MAX_FRAGMENTS_PER_CONTEXT,
        });
    }
    for f in fragments {
        validate_fragment(f)?;
    }
    Ok(())
}
```

---

### 3. UI & UX Micro-Mechanics

#### Pacing Signal Resends to Prevent Process Desynchronization
When interrupting running commands (via `Ctrl-C`), blindly spamming `SIGINT` can overflow terminal queues, while sending a single unconfirmed signal leaves processes running if the initial signal is missed during runtime startup. The engine paces signals defensively:

```rust
// Resend SIGINT every 500ms, capped strictly at a 2-second confirmation window
let interrupt_deadline = Instant::now() + Duration::from_secs(2);
while command_holds_terminal() {
    send_interrupt_signal();
    tokio::time::sleep(Duration::from_millis(500)).await;
    if Instant::now() >= interrupt_deadline {
        bail!("cancellation was not confirmed within 2 seconds");
    }
}
```

#### Bounded TUI Diagnostics Formatting
Unbounded diagnostic traces in UI widgets can exhaust system memory and trigger frame reflow thrashing. Formatting logic enforces strict truncation boundaries:

```rust
pub const MAX_DIAGNOSTIC_BYTES: usize = 2048;

pub fn cap_text(input: String, max: usize, truncated: &mut bool) -> String {
    if input.len() <= max {
        return input;
    }
    *truncated = true;
    let mut boundary = max;
    while boundary > 0 && !input.is_char_boundary(boundary) {
        boundary -= 1;
    }
    let mut res = input[..boundary].to_string();
    res.push_str("... [truncated]");
    res
}
```

---

### 4. Backend Concurrency & Memory Safety

#### Defensive Directory Path Traversal Validation
To prevent directory traversal exploits via user-controlled or environment configuration values, every state directory parameter is validated before joining against the application root:

```rust
// In crates/config/src/state_dirs.rs
pub(crate) fn ensure_safe_state_subdir(subdir: &str) -> Result<()> {
    if subdir.is_empty() {
        bail!("state subdir must not be empty");
    }
    let path = std::path::Path::new(subdir);
    if path.is_absolute() {
        bail!("state subdir must not be an absolute path: {subdir}");
    }
    if path.components().any(|c| {
        matches!(
            c,
            std::path::Component::RootDir | std::path::Component::Prefix(_)
        )
    }) {
        bail!("state subdir must not contain a root or prefix: {subdir}");
    }
    if path
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        bail!("state subdir must not contain parent-dir (..) components: {subdir}");
    }
    Ok(())
}
```

#### Atomic Directory Relocation with Copy Fallbacks
When migrating directories across filesystem boundaries, atomic operations like `rename` can fail with `EXDEV` (cross-device link). Robust systems catch this error and fall back to recursive copies:

```rust
// In crates/config/src/state_dirs.rs
match std::fs::rename(&legacy, primary) {
    Ok(()) => Ok(LegacyStateMigration::Migrated(/* Relocated */)),
    Err(err) => {
        // Fall back to recursive copy on cross-device link errors
        match copy_dir_into_place(&legacy, primary) {
            Ok(()) => Ok(LegacyStateMigration::Migrated(/* Copied */)),
            Err(copy_err) => Ok(LegacyStateMigration::Failed { legacy }),
        }
    }
}
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### Wire-Order Tool Catalog Serialization for KV-Cache Hit Preservation
When generating hashes to verify prefix stability, tool schemas must be hashed in their exact wire order. Sorting tool arrays alphabetically preserves canonical equivalence across processes, but invalidates LLM KV-caches that rely on identical token ordering.

```rust
// In crates/core/src/prefix_cache.rs
// Serialization MUST preserve provider wire order; sorting produces false cache hits
let tools_sha256 = match tools {
    Some(tools) if !tools.is_empty() => cache.fingerprint_for(tools).sha256_hex,
    _ => sha256_hex(b""),
};
let combined = format!("{system_sha256}:{tools_sha256}");
let combined_sha256 = sha256_hex(combined.as_bytes());
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Codewhale separates terminal presentation (`crates/tui`), session orchestration (`crates/engine`), shared contracts (`crates/agent-contract`), and runtime sandboxing. Inter-process communication across engine components uses typed JSON schemas via standard I/O channels. State management uses an event-sourcing model where in-