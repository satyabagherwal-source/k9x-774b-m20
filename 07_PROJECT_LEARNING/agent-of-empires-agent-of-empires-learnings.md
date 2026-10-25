> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `3bf26499`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T04:58:30.686Z  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): agent-of-empires/agent-of-empires

---

## 1. Executive Forensic Architecture & System Mechanics

`agent-of-empires` (`aoe`) is an orchestrator and session multiplexer engineered in Rust (with TypeScript ACP adapter bridge workers) designed to manage long-lived, concurrent, autonomous coding agents (e.g., Claude Code, Codex, OpenCode, Gemini CLI, Mistral Vibe, Hermes) in isolated local environments. 

```
                                  +-------------------------------------------------------+
                                  |                     CLIENTS                           |
                                  |     Ratatui TUI   |   CLI Subcommands  |  Web / WS    |
                                  +-------------------------------------------------------+
                                                             |
                                           Unix Domain Socket (IPC / JSON-RPC)
                                                             |
+------------------------------------------------------------v----------------------------------------------------------+
| AOE CORE DAEMON RUNTIME (Rust / Tokio)                                                                                |
|                                                                                                                       |
|  +---------------------------+   +---------------------------+   +--------------------------------------------------+ |
|  | Daemon Lifecycle Engine   |   | Git Worktree Engine       |   | Worker Process Supervisor                        | |
|  | - O_NOFOLLOW / 0o600 locks|   | - Atomic gitdir rewrites  |   | - Lease & Epoch claims                           | |
|  | - flock / Unix FD handoff |   | - Depth-aware repair      |   | - Birth fingerprinting (cgroups / pid-gen)       | |
|  +---------------------------+   +---------------------------+   +--------------------------------------------------+ |
|                                                                                            |                          |
|                                                     Channel Pair (cmd_rx / event_tx)       | Fork / Exec (stdio PTY)  |
|                                                                                            v                          |
|                                  +----------------------------------------------------------------------------------+ |
|                                  | ACP Client Subsystem (Agent Client Protocol)                                     | |
|                                  | - LifecycleEnvelope & Epoch Demuxing                                             | |
|                                  | - TerminalClaim Compare-And-Swap Gate                                            | |
|                                  | - Watchdog Idle & Off-Protocol Work Tracker                                      | |
|                                  +----------------------------------------------------------------------------------+ |
+------------------------------------------------------------+----------------------------------------------------------+
                                                             |
                                              ndjson / JSON-RPC over stdio
                                                             |
+------------------------------------------------------------v----------------------------------------------------------+
| ACP ADAPTER WORKER (Node.js / Vercel AI SDK 7)                                                                        |
|                                                                                                                       |
|  +---------------------------+   +---------------------------+   +--------------------------------------------------+ |
|  | JSONL Transcript Engine   |   | Inverted Tool Palette     |   | AI SDK Execution Engine                          | |
|  | - Strict User/Asst turns  |   | - Read (fs/read via ACP)  |   | - streamText / stopWhen(16)                      | |
|  | - wx atomic creation      |   | - Write (fs/write via ACP)|   | - Provider multiplexer (anthropic/openai/google) | |
|  | - fsync / directory sync  |   | - Bash (terminal/* via ACP|   | - AbortController per turn                       | |
|  +---------------------------+   +---------------------------+   +--------------------------------------------------+ |
+-----------------------------------------------------------------------------------------------------------------------+
```

### Subsystem Boundaries & Decoupling Invariants
1. **Separation of Disk Ownership and Inference Engine**: The Node.js ACP worker (`aoe-agent`) acts purely as a stateless inference router wrapping Vercel AI SDK 7. It has zero native filesystem (`node:fs`) read/write authority for user workspace code. When an LLM triggers a `Read`, `Write`, or `Bash` tool call, the adapter issues a reverse RPC back to the Rust host process over ACP (`fs/read_text_file`, `fs/write_text_file`, `terminal/create`). Rust retains complete filesystem authority, workspace isolation, sandbox containment, and audit guarantees.
2. **Deterministic Lifecycle Claims via Epoch CAS**: Concurrent events (watchdog timeout ticks, idle timers, external cancellations, adapter-driven completions) race to finalize turns. The client uses an atomic compare-and-swap state machine (`TerminalClaim`) parameterized by a monotonically increasing `epoch: AtomicU64`. Exactly one terminal event (`Stopped`, `Completed`, `Failed`) is emitted per turn. Duplicate and orphaned events are dropped at the driver boundary.
3. **Double-Ended Git Metadata Relocation Invariance**: AoE transparently isolates agent sessions using linked `git worktree` instances. Moving a worktree across arbitrary filesystem depths (such as archiving into `.aoe-trash/<session-id>`) causes standard Git relative pointers (`gitdir: ../..`) to break. AoE intercepts Git's relocation routines, parses the raw OS-encoded byte slice of the worktree pointer, normalizes it to a canonical absolute path prior to running Git commands, and reverts the byte slice if Git encounters mutation failures.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Relative Pointer Canonicalization with Inverted Fallback on Filesystem Mutations
**RULE**:
Before moving, symlinking, or mounting any directory tree containing structured internal reference files (such as `.git`, link pointers, relative configuration maps, or mount-relative paths), the runtime MUST read the pointer, verify its target resolution, canonicalize it to an absolute OS-native byte path, and atomically rewrite it via an exclusive named temporary file in the same parent directory before running upstream tools. If the operation fails or is aborted, the runtime MUST restore the exact original byte stream.

**WHY**:
External submodules and tools (specifically `git worktree move`) execute pre-flight validation routines against working tree metadata before executing mutations. When directories are moved into deeper nested structures (e.g., trashing into a `.aoe-trash/<session-id>` directory hierarchy), relative references like `gitdir: ../../.git/worktrees/wt` resolve to non-existent parent paths. Upstream tools fail with unhelpful validation errors (e.g., `fatal: validation failed, cannot move working tree`). Rewriting the pointer directly without safe atomic persistence risks leaving torn writes upon power loss or process kill.

**WHEN TO APPLY**:
Apply to any container volume mounter, worktree manager, virtualenv relocator, or cache-management subsystem where metadata contains relative paths and directory depth is subject to runtime reorganization.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};
use std::os::unix::ffi::OsStrExt;

pub fn safely_relocate_linked_reference<F, R>(
    worktree_path: &Path, 
    mutation_op: F
) -> Result<R, Box<dyn std::error::Error>> 
where
    F: FnOnce() -> Result<R, Box<dyn std::error::Error>>,
{
    let ref_file = worktree_path.join(".git");
    if !ref_file.is_file() {
        return mutation_op();
    }

    // 1. Read original metadata raw bytes to survive non-UTF-8 paths
    let original_bytes = std::fs::read(&ref_file)?;
    
    // 2. Parse target pointer and check if canonicalization is required
    let mut rewritten = false;
    if let Some(target_dir) = parse_relative_gitdir(&original_bytes, worktree_path) {
        if let Ok(absolute_target) = target_dir.canonicalize() {
            let mut absolute_pointer = b"gitdir: ".to_vec();
            absolute_pointer.extend_from_slice(absolute_target.as_os_str().as_bytes());
            absolute_pointer.push(b'\n');

            if absolute_pointer != original_bytes {
                // 3. Atomic rename via TempFile in same worktree directory
                let mut tmp = tempfile::NamedTempFile::new_in(worktree_path)?;
                std::io::Write::write_all(&mut tmp, &absolute_pointer)?;
                tmp.persist(&ref_file).map_err(|e| e.error)?;
                rewritten = true;
            }
        }
    }

    // 4. Execute mutation with guaranteed restoration on error
    let result = mutation_op();
    if result.is_err() && rewritten {
        // Revert to original bytes on mutation failure
        let _ = std::fs::write(&ref_file, &original_bytes);
    }
    result
}

fn parse_relative_gitdir(content: &[u8], base: &Path) -> Option<PathBuf> {
    let prefix = b"gitdir: ";
    if !content.starts_with(prefix) {
        return None;
    }
    let raw_path = &content[prefix.len()..];
    let trimmed = match raw_path.strip_suffix(b"\n") {
        Some(s) => s.strip_suffix(b"\r").unwrap_or(s),
        None => raw_path,
    };
    use std::ffi::OsStr;
    let path = PathBuf::from(OsStr::from_bytes(trimmed));
    if path.is_relative() {
        Some(base.join(path))
    } else {
        Some(path)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER invoke mutating tool commands directly against relative pointer files
// or overwrite files in place without atomic replace and rollback guards:
pub fn bad_relocate(worktree_path: &Path) {
    let ref_file = worktree_path.join(".git");
    // VIOLATION 1: Blindly mutating in place without atomic rename (risks torn state)
    // VIOLATION 2: No rollback handler if `git worktree move` fails
    // VIOLATION 3: Calling move without resolving relative nesting breaks validation
    std::fs::write(&ref_file, "gitdir: /some/absolute/path\n").unwrap();
    let _ = std::process::Command::new("git")
        .args(["worktree", "move", "from", "to"])
        .status();
}
```

**VERIFICATION METHOD**:
Run an integration test that:
1. Initializes a parent Git repository.
2. Creates a worktree in a sibling folder with a relative pointer (`gitdir: ../../repo/.git/worktrees/wt`).
3. Relocates the worktree into a directory 2 levels deeper (`.trash/nested/wt`).
4. Injects an intentional I/O fault mid-operation to confirm that the `.git` pointer is restored byte-for-byte to its original relative state.

---

### 2. Multi-Producer Epoch-CAS Gate for Terminal Event Publication
**RULE**:
In event-driven architectures where an active task lifecycle can terminate through competing concurrent pathways (e.g., protocol message receipt, watchdog timeouts, manual cancellation, or process exits), terminal state publication MUST be arbitrated by an atomic Compare-And-Swap (CAS) guard tied to a monotonically increasing generation epoch. Secondary or trailing termination handlers MUST NOT emit duplicate terminal events.

**WHY**:
When an agent or client experiences an idle timeout, the watchdog timer triggers a completion routine. Simultaneously, an adapter may emit an end-of-turn event, or an operator may send an explicit cancellation interrupt. If multiple event channels dispatch terminal markers (`Stopped`, `Completed`, `Failed`) without an atomic epoch gate, state machines downstream (TUI render trees, transcript loggers, charge accounts) execute multiple state transitions. This leads to invalid state transitions, duplicate billing deductions, or corrupted prompt buffers.

**WHEN TO APPLY**:
Apply to any asynchronous actor, session supervisor, or protocol bridge where a timeout watchdog races against an in-flight network/IPC response.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

pub struct TerminalClaim {
    epoch: AtomicU64,
    claimed_for: AtomicU64,
}

impl TerminalClaim {
    pub fn new() -> Self {
        Self {
            epoch: AtomicU64::new(1),
            claimed_for: AtomicU64::new(0),
        }
    }

    /// Advances the epoch when a new task or turn begins
    pub fn begin_turn(&self) -> u64 {
        self.epoch.fetch_add(1, Ordering::AcqRel) + 1
    }

    /// Attempts to claim the right to publish the terminal event for the active turn.
    /// Returns `true` if and only if this caller successfully secured the terminal lock.
    pub fn claim(&self) -> bool {
        let current_epoch = self.epoch.load(Ordering::Acquire);
        loop {
            let already_claimed = self.claimed_for.load(Ordering::Acquire);
            if already_claimed == current_epoch {
                // Terminal event was already claimed for this turn epoch
                return false;
            }
            match self.claimed_for.compare_exchange_weak(
                already_claimed,
                current_epoch,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => return true,
                Err(_) => continue, // Raced with another thread, retry loop
            }
        }
    }

    pub fn is_claimed(&self) -> bool {
        self.claimed_for.load(Ordering::Acquire) == self.epoch.load(Ordering::Acquire)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER use raw flags or un-sequenced booleans across asynchronous cancellation races:
pub struct BadTerminalState {
    pub is_stopped: std::sync::atomic::AtomicBool, // Flawed: Lacks epoch linkage
}

impl BadTerminalState {
    pub async fn emit_stopped(&self) {
        // VIOLATION: A late timeout from turn N can claim `is_stopped` true
        // during turn N+1, starving the active prompt or issuing out-of-order events.
        if !self.is_stopped.swap(true, Ordering::SeqCst) {
            publish("Stopped").await;
        }
    }
}
```

**VERIFICATION METHOD**:
Spawn 50 concurrent Tokio tasks that simulate mixed completions, watchdog cancellations, and manual `SIGINT` signals racing to call `claim()` on a single `TerminalClaim` instance. Assert with a test harness that exactly one caller receives `true`, and all 49 remaining tasks receive `false`. Then advance `begin_turn()` and assert that the next race allows exactly one claim for the new epoch.

---

### 3. POSIX File Lock Sanitization with Inode/Device Verification and O_NOFOLLOW
**RULE**:
Runtime lock files and lifecycle synchronizers implemented via `flock` or `fcntl` MUST be opened with explicit POSIX flags `O_NOFOLLOW | O_CLOEXEC`, mode `0o600`, and immediately verified via `fstat` to guarantee:
1. `meta.is_file()` is true (not a directory, socket, or FIFO).
2. `meta.uid()` matches the current effective process UID (`nix::unistd::geteuid()`).
3. `meta.mode() & 0o777 == 0o600` (no group or world permissions).
4. `meta.nlink() == 1` (no hard-link alias attacks).
When passing file locks across child process boundaries (such as daemon fork/exec or descriptor handoff), the receiving process MUST verify that the incoming descriptor matches the exact `dev` and `ino` of the expected target lock file.

**WHY**:
Failure to enforce `O_NOFOLLOW` allows an attacker with local write access to `/tmp` or the runtime directory to plant a symlink pointing to `/etc/passwd` or an arbitrary database file. If an unprivileged user tricks a root or elevated daemon into running `truncate` or `exclusive_lock` on the symlink target, arbitrary files can be locked or corrupted. Verifying `nlink == 1` prevents hard-link hijacking where permissions appear valid, while cross-checking `dev` and `ino` guarantees that file descriptor inheritance across fork/exec hasn't been intercepted.

**WHEN TO APPLY**:
Apply to any daemon initialization routine, multi-process CLI locker, single-instance supervisor, or runtime lock acquisition on Unix systems.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::File;
use std::os::fd::AsFd;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
use std::path::Path;

pub fn acquire_secure_lock(lock_path: &Path) -> Result<File, Box<dyn std::error::Error>> {
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .mode(0o600)
        .custom_flags(nix::libc::O_NOFOLLOW | nix::libc::O_CLOEXEC)
        .open(lock_path)?;

    let meta = file.metadata()?;
    let current_euid = nix::unistd::geteuid().as_raw();

    if !meta.is_file() {
        return Err("Security invariant violated: lock path is not a regular file".into());
    }
    if meta.uid() != current_euid {
        return Err("Security invariant violated: lock file UID does not match process EUID".into());
    }
    if (meta.mode() & 0o777) != 0o600 {
        return Err("Security invariant violated: lock file permissions must be exactly 0600".into());
    }
    if meta.nlink() != 1 {
        return Err("Security invariant violated: hardlink count > 1 (potential link race)".into());
    }

    // Acquire exclusive advisory lock via fs2
    fs2::FileExt::try_lock_exclusive(&file)
        .map_err(|e| format!("Failed to acquire exclusive lock: {e}"))?;

    Ok(file)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER open locks in world-writable or shared directories using bare Path::exists or File::create:
pub fn bad_lock_acquisition(path: &Path) {
    // VIOLATION 1: Follows symlinks blindly (vulnerable to symlink attack)
    // VIOLATION 2: Default umask creates group/world readable files
    // VIOLATION 3: No ownership or hardlink verification
    let mut file = std::fs::File::create(path).unwrap(); 
}
```

**VERIFICATION METHOD**:
Write an integration test on Linux:
1. Create a symlink at the lock location pointing to a canary file.
2. Call `acquire_secure_lock`.
3. Assert that the call fails immediately with an `ELOOP` or `OS error 40` (Too many levels of symbolic links).
4. Create a hard link pointing to the lock file (`nlink == 2`) and verify that the metadata inspection rejects the lock.

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Git Worktree Move Relative Pointer Invalidation on Trash Relocation (BUG-AOE-01)
- **Context**: `src/git/worktree/mod.rs` and `src/git/worktree/relocate.rs`
- **What Was Expected**: Restoring a trashed agent session via `aoe session restore` or moving a worktree to `.aoe-trash/<session-id>` must succeed seamlessly without Git CLI failures.
- **What Actually Happened**: Restoring a worktree failed catastrophically with Git error:
  `Could not restore the worktree: git worktree move: Git worktree command failed: fatal: validation failed, cannot move working tree`.
- **Evidence in Repo**: Commit `0400f174`, PR `#4769`, and Issue `#4748`.
- **Root Cause**:
  1. On worktree creation, AoE called `convert_git_file_to_relative()`, writing a relative pointer into `.git` (e.g., `gitdir: ../../repo/.git/worktrees/bonial`).
  2. When trashing a session, AoE moved the directory tree into `<repo-worktrees>/.aoe-trash/<session-id>`.
  3. The extra nesting level (`.aoe-trash/` + `<session-id>/`) invalidated the relative link.
  4. Git's internal `validate_worktree()` ran before executing `worktree move`, tried to resolve the broken relative path, failed, and aborted before the move could occur.
- **Remediation Code Diff**:
```rust
// @@ -215,12 +215,35 @@ impl GitWorktree {
+        // A relative pointer left stale by an earlier move cannot be followed.
+        if crate::git::cleanup::read_linked_worktree_gitdir(from).is_some_and(|g| !g.exists()) {
+            if let Err(e) = self.repair_worktree(from) {
+                tracing::warn!(target: "git.worktree", from = %from.display(), error = %e,
+                    "move_worktree: could not repair a stale .git pointer");
+            }
+        }
+        let original_pointer = Self::convert_git_file_to_absolute(from).unwrap_or_else(|e| {
+            tracing::warn!(target: "git.worktree", from = %from.display(), error = %e,
+                "move_worktree: could not make the .git pointer absolute");
+            None
+        });
+        let restore_pointer = || {
+            if let Some(original) = &original_pointer {
+                let _ = std::fs::write(from.join(".git"), original);
+            }
+        };
         let moved = run_git_with_timeout(
             &self.repo_path,
             ["worktree", "move", from_str, to_str],
             WORKTREE_MUTATION_TIMEOUT,
         );
+        let Some(output) = moved.inspect_err(|_| restore_pointer())? else {
             // ... handle timeout rollback
+            restore_pointer();
             return Err(error);
         }
```
- **Lesson**: Subprocesses running structural validation on filesystem hierarchies will fail if relative pointers are displaced into deeper directory trees. Pre-canonicalize relative pointers to absolute paths before running upstream tools, and restore original relative forms only after success or failure rollback.

---

### Incident 2: Benchmark Startup PTY Slave Closure EIO & Subprocess Timeout Bypass (BUG-AOE-02)
- **Context**: `scripts/bench-startup.py` and TUI process harness
- **What Was Expected**: If a spawned benchmark process terminates, times out, or closes its PTY slave descriptors, the benchmark runner must log a test failure, record a `FAIL` metric, and proceed to subsequent benchmark runs without crashing.
- **What Actually Happened**: The test harness aborted entirely with an unhandled `subprocess.TimeoutExpired` traceback, bypassing the per-iteration `except RuntimeError` guard and discarding the benchmark suite results.
- **Evidence in Repo**: Issue `#4793`.
- **Root Cause**: On Linux, when all slave file descriptors for a pseudoterminal (PTY) close while the child process remains alive or stuck, reads on the master PTY descriptor return an `EIO` error. The benchmark harness caught `EIO` and attempted a graceful exit by calling `process.wait(timeout=...)`. However, when the child process hung on shutdown, `process.wait()` raised `subprocess.TimeoutExpired`. The benchmark loop only caught `RuntimeError`, allowing `TimeoutExpired` to escape and crash the orchestrator.
- **Remediation Code Diff**:
```python
# @@ scripts/bench-startup.py @@
-    except RuntimeError as err:
-        record_failure(err)
-        continue
+    except (RuntimeError, subprocess.TimeoutExpired) as err:
+        if isinstance(err, subprocess.TimeoutExpired):
+            # Normalize wait timeout into an iteration failure rather than escaping
+            err = RuntimeError("quit timed out after the first frame")
+        record_failure(err)
+        cleanup_child_process(process)
+        continue
```
- **Lesson**: POSIX terminal master handles raise `EIO` when slaves detach. Any fallback call to `process.wait(timeout=...)` inside an exception handler MUST explicitly catch `TimeoutExpired` and normalize it, or the teardown path will mask the primary error with an unhandled exception.

---

### Incident 3: Watchdog Idle Tick Race on Adopted Turn Terminals (BUG-AOE-03)
- **Context**: `src/acp/acp_client/connection/command_loop.rs`
- **What Was Expected**: When an external background task completes or a prompt stream ends, exactly one `Stopped` or `Completed` event must be emitted to the user interface.
- **What Actually Happened**: Between-prompt idle watchdogs collided with detached resume-idle tasks, publishing duplicate terminal completion events and putting the UI reducer into an invalid state.
- **Evidence in Repo**: Issue `#2899`, Issue `#2237`, and `src/acp/acp_client/connection/command_loop.rs` lines 190–210.
- **Root Cause**: An adopted turn ran concurrently with `between_prompt_idle_tick()`. Both threads evaluated the idle state, observed that the turn was complete, and attempted to dispatch completions without checking if the terminal claim was already claimed for that epoch.
- **Remediation Code Diff**:
```rust
// @@ src/acp/acp_client/connection/command_loop.rs @@
     async fn between_prompt_idle_tick(&self) -> bool {
         let shared = &self.shared;
         let Some(cost_seen) = shared.between_prompt.take_idle_fire(now_ms()) else {
             return false;
         };
-        // Published directly without CAS claim
+        // An adopted turn races the detached resume-idle task for its
+        // terminal; state is reset either way.
+        let adopted = shared.adopted_turn_active.swap(false, Ordering::Relaxed);
+        if adopted && !shared.terminal_claim.claim() {
+            return false;
+        }
```
- **Lesson**: Boolean state flags (`adopted_turn_active`) cannot arbitrate multi-threaded event dispatch without being coupled to an atomic swap and a CAS gate.

---

### Incident 4: Third-Party Node.js Security Group Vulnerabilities in Adapters (BUG-AOE-04)
- **Context**: `acp-worker/adapters/claude-agent-acp/package-lock.json` & `acp-worker/adapters/codex-acp/package-lock.json`
- **What Was Expected**: ACP bridge workers must maintain strict type contracts and vulnerability-free serialization when handling LLM outputs.
- **What Actually Happened**: Transitive dependencies (`undici` 8.10.2, `body-parser` 2.3.0, and `zod` 4.6.5) contained memory leak vulnerabilities and malformed payload injection vectors that compromised long-running ACP agent sessions.
- **Evidence in Repo**: Commit `6c7889a6` (PR `#4905`) and Commit `e51a1b33` (PR `#4906`).
- **Root Cause**: High-throughput NDJSON streaming over stdio flooded older versions of `undici` and `body-parser`, triggering socket exhaustion and prototype pollution hazards during JSON schema decoding.
- **Remediation Code Diff**:
```json
// @@ acp-worker/adapters/claude-agent-acp/package-lock.json @@
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-2.3.0.tgz",
+      "version": "2.4.0",
+      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-2.4.0.tgz",
// @@ acp-worker/adapters/codex-acp/package-lock.json @@
-      "version": "4.6.5",
-      "resolved": "https://registry.npmjs.org/zod/-/zod-4.6.5.tgz",
+      "version": "4.6.7",
+      "resolved": "https://registry.npmjs.org/zod/-/zod-4.6.7.tgz",
```
- **Lesson**: Adapters handling high-throughput NDJSON streams must pin and continuously update schema-validation dependencies (`zod`) and underlying HTTP/buffer parsing libraries to prevent buffer overflow and prototype-injection attacks from malicious model output.

---

### Incident 5: Symlink Hijack & Unsafe UID Desynchronization on Daemon Lock File (BUG-AOE-05)
- **Context**: `src/daemon/lifecycle.rs`
- **What Was Expected**: The daemon transaction manager must safely acquire `transaction.lock` and `lifetime.lock` without being tricked by pre-existing symlinks or foreign-owned files in shared temp directories.
- **What Actually Happened**: Standard `OpenOptions::open` followed symlinks. If a malicious process placed a symlink at `transaction.lock`, AoE could lock or mutate the destination target file owned by another user.
- **Evidence in Repo**: `src/daemon/lifecycle.rs` lines 20–35.
- **Root Cause**: The lock file initialization did not use `O_NOFOLLOW` or inspect the resulting file descriptor's ownership (`geteuid()`) and permissions.
- **Remediation Code Diff**:
```rust
// @@ src/daemon/lifecycle.rs @@
 fn open_lock(name: &str) -> Result<File> {
     let file = std::fs::OpenOptions::new()
         .read(true)
         .write(true)
         .create(true)
         .truncate(false)
         .mode(0o600)
+        .custom_flags(nix::libc::O_NOFOLLOW)
         .open(lock_path(name)?)?;
     let meta = file.metadata()?;
+    anyhow::ensure!(
+        meta.is_file()
+            && meta.uid() == nix::unistd::geteuid().as_raw()
+            && meta.mode() & 0o777 == 0o600
+            && meta.nlink() == 1,
+        "Unsafe daemon lock file"
+    );
     Ok(file)
 }
```
- **Lesson**: Never trust a lock file path based on name alone. Always pass `O_NOFOLLOW` and assert that `meta.uid() == geteuid()`, `meta.nlink() == 1`, and file permissions are strictly `0o600`.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Raw OS-Byte Canonicalization**: In `src/git/worktree/mod.rs`, path conversions cannot pass through standard Rust `&str` or `String` primitives because POSIX paths may contain non-UTF-8 byte sequences. The pointer rewrite uses `absolute.as_os_str().as_encoded_bytes()` to prevent panic crashes on valid non-UTF-8 filesystem paths.
- **Truthiness and Empty Turn Guard in Anthropic API**: In `acp-worker/aoe-agent/src/index.ts`:
  ```typescript
  // Anthropic rejects an assistant message with empty content, so skip
  // persisting blank turns (tool-only rounds and cancellations leave
  // the buffer empty) to keep the next prompt's history valid.
  if (assistantBuffer) {
    session.messages.push({ role: "assistant", content: assistantBuffer });
  }
  ```
  Pushing an assistant message where `content === ""` causes the Anthropic API to reject subsequent turns with `400 Bad Request: messages.N.content: string must not be empty`.

### 2. Infinite Loop & Recursion Guards
- **Vercel AI SDK Tool Round Ceiling**: Autonomous agents risk entering infinite execution ping-pongs when tools fail repeatedly. In `acp-worker/aoe-agent/src/index.ts`, `streamText` explicitly caps step recursion:
  ```typescript
  const result = streamText({
    model,
    messages: session.messages,
    tools,
    stopWhen: stepCountIs(16), // Hard ceiling: prevents infinite agent reflection loops
    abortSignal,
  });
  ```
- **Non-blocking Event Loop Draining for Lifecycle Envelopes**: In `src/acp/acp_client/lifecycle.rs`, lifecycle signals must only be forwarded when the prompt loop is active:
  ```rust
  pub(super) async fn forward_lifecycle_signals(...) {
      if !prompt_active {
          return; // Prevents unbounded channel accumulation when reader is inactive
      }
      // ...
  }
  ```
  If forwarded while idle, bounded Tokio MPSC channels back up, deadlocking the protocol notification reader.

### 3. UI & UX Micro-Mechanics
- **Control Character Stripping to Prevent Terminal Escapes**: In `src/cli/runtime_read/render.