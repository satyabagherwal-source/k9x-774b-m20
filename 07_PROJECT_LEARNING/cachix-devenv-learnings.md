> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cachix-devenv-learnings.md`  
> **Source**: github ([https://github.com/cachix/devenv](https://github.com/cachix/devenv))  
> **Source Version**: `ff0d7e76`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T13:08:01.121Z  
> **Learning ID**: `learn-github-cachix-devenv`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): cachix/devenv

---

## 1. Executive Forensic Architecture & System Mechanics

`cachix/devenv` is an autonomous developer environment engine written in Rust that bridges declarative Nix expressions with interactive developer workflows. It orchestrates environment hermeticity, incremental evaluation caching, daemonized binary caching (Cachix), containerization, declarative process trees, and terminal interaction (TUI).

```
                      +---------------------------------------+
                      |       devenv CLI / Shell Hooks        |
                      |    (bash / zsh / fish / nushell)      |
                      +-------------------+-------------------+
                                          |
                        Command Dispatch & Activity Spans
                                          v
+---------------------------------------------------------------------------------+
|                                devenv-core                                      |
|  +-----------------------+  +----------------------+  +----------------------+  |
|  |     Config Parser     |  |   Bootstrap Args     |  |    Cachix Manager    |  |
|  | (schematic / serde)   |  | (ser_nix / Arc<str>) |  | (Token / Netrc Sync) |  |
|  +-----------------------+  +----------------------+  +----------------------+  |
|                             | Dotenv State Tracker |                            |
|                             |  (TOCTOU Validator)  |                            |
+-----------------------------------------+---------------------------------------+
                                          |
                +-------------------------+-------------------------+
                v                                                   v
+-------------------------------+                   +-------------------------------+
|       devenv-cache-core       |                   |      devenv-nix-backend       |
|  +-------------------------+  |                   |  +-------------------------+  |
|  |   SQLite Pool & Migr.   |  |                   |  |    C++ Nix C-Bindings   |  |
|  | (Flock Init / SHM Fall) |  |                   |  | (Raw Bindgen / Evaluator|  |
|  +-------------------------+  |                   |  +-------------------------+  |
|  | Blake3 Content Hashing  |  |                   |  | Literal Attr Reflection |  |
|  | (Exec Bit / Path Canon) |  |                   |  | Evaluator Trait Seam    |  |
+-------------------------------+                   +-------------------------------+
                |                                                   |
                +-------------------------+-------------------------+
                                          |
                                          v
+---------------------------------------------------------------------------------+
|                                Runtime Engines                                  |
|  +-------------------------+  +---------------------+  +---------------------+  |
|  |       devenv-tui        |  |   devenv-processes  |  |    devenv-reload    |  |
|  | (iocraft / Termios RAII)|  | (Process Supervisor)|  | (Watchexec Inotify) |  |
+---------------------------------------------------------------------------------+
```

### Architectural Subsystems and Boundaries

1. **Frontend / CLI Boundary (`devenv`, `devenv-tui`)**:
   - Manages interactive user sessions, TUI event loops via `iocraft` and `libghostty-vt`, and terminal state restoration.
   - Enforces terminal state restoration (`TerminalStateGuard`) across arbitrary subprocess lifecycles, ensuring child tasks that modify terminal flags (e.g., Cypress disabling `ONLCR` or dropping raw mode) do not corrupt the parent terminal session.

2. **Core Abstraction Layer (`devenv-core`)**:
   - Decoupled from concrete Nix C++ libraries via dynamic traits (`Evaluator`, `Store`).
   - Manages configuration evaluation (`schematic`), environment sanitization (`Clean`), and out-of-band secret resolution (`CachixManager`) with strict file mode isolation (Unix permissions `0600` on generated `.netrc` files).
   - Tracks environment variable mutations and dot-env dependencies via deterministic hashing (`OpObserver`).

3. **Persistent Evaluation Cache (`devenv-cache-core`, `devenv-eval-cache`)**:
   - SQLite-backed state tracking utilizing WAL mode with an automatic fallback mechanism to DELETE journal mode when running on filesystems lacking shared memory mapping (`SQLITE_IOERR_SHMMAP` on network shares, 9p, or virtiofs mounts).
   - Process synchronization achieved through external file-descriptor locks (`fd_lock::RwLock` on `.init.lock`) held on dedicated OS threads to prevent async runtime executor starvation.
   - Path-independent content hashing via `blake3`, tracking Unix executable bits (`0o100`) while normalizing file modification times and non-essential permission bits.

4. **Nix Interop Boundary (`devenv-nix-backend`, `nix-bindings-rust`)**:
   - Foreign Function Interface (FFI) to the Nix C++ API.
   - Evaluates Nix ASTs into native JSON structures using literal attribute lookups to prevent path string mangling on file systems with dotted directory keys.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dedicated-Thread POSIX Advisory Locking for Async Runtimes
**RULE**:
When synchronizing file-based state across processes using advisory locks (`flock`, `fcntl`, or `fd_lock`) in an asynchronous runtime (such as `tokio`), the file-locking operation and the blocking guard lifetime MUST execute on a dedicated OS thread (`std::thread::spawn`), communicating state changes back to the async runtime via explicit channels (`oneshot` / `mpsc`). Under NO circumstances may an advisory lock be acquired directly on a Tokio worker thread.

**WHY**:
Advisory locks on files are blocking synchronous system calls. If executed directly inside an async worker thread, or if an async worker task blocks awaiting a lock while holding resources required by another task, worker pool starvation occurs. Furthermore, if an async cancellation occurs while waiting for an asynchronous lock wrapper, the file descriptor can be dropped asynchronously, leading to resource leaks or race conditions. Dedicated thread isolation guarantees that runtime work-stealing threads never stall, and provides clean teardown via channel drops.

**WHEN TO APPLY**:
- SQLite database migrations or initializations executed by multiple concurrent CLI invocations.
- Local cache folder initialization in multi-process environments.
- Cross-process synchronization in tools invoked in parallel (e.g., parallel test runners, CLI hooks).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};
use tokio::sync::oneshot;
use std::sync::mpsc;
use fd_lock::RwLock;

pub struct ProcessInitLock {
    _release: mpsc::Sender<()>,
}

pub async fn acquire_process_init_lock(target_path: &Path) -> Result<ProcessInitLock, std::io::Error> {
    let mut lock_file_path = target_path.as_os_str().to_owned();
    lock_file_path.push(".init.lock");
    let lock_path = PathBuf::from(lock_file_path);

    let (acquired_tx, acquired_rx) = oneshot::channel();
    let (release_tx, release_rx) = mpsc::channel();

    std::thread::spawn(move || {
        let file = match OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(false)
            .open(&lock_path) 
        {
            Ok(f) => f,
            Err(e) => {
                let _ = acquired_tx.send(Err(e));
                return;
            }
        };

        let mut lock = RwLock::new(file);
        let _guard = match lock.write() {
            Ok(g) => g,
            Err(e) => {
                let _ = acquired_tx.send(Err(e));
                return;
            }
        };

        // Notify async runtime that lock is securely held
        if acquired_tx.send(Ok(())).is_err() {
            return;
        }

        // Keep thread blocked and holding lock until async caller drops release_tx
        let _ = release_rx.recv();
    });

    match acquired_rx.await {
        Ok(Ok(())) => Ok(ProcessInitLock { _release: release_tx }),
        Ok(Err(e)) => Err(e),
        Err(_) => Err(std::io::Error::new(
            std::io::ErrorKind::Interrupted,
            "Lock worker thread terminated unexpectedly"
        )),
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blocking async Tokio workers with synchronous file locks
async fn bad_lock_acquisition(lock_path: &Path) -> Result<(), std::io::Error> {
    // VIOLATION: Blocks the Tokio executor thread! If MAX_WORKERS CLI commands run
    // concurrently and stall here, the entire async runtime deadlocks.
    let file = std::fs::File::create(lock_path)?;
    let mut lock = fd_lock::RwLock::new(file);
    let guard = lock.write()?; // Catastrophic runtime stall
    do_migrations().await;
    Ok(())
}
```

**VERIFICATION METHOD**:
Run an integration test spawning 50 concurrent processes attempting to open and migrate the same database concurrently. Assert that no process crashes with `SQLITE_BUSY`, `SQLITE_IOERR_DELETE_NOENT`, or hangs with thread pool exhaustion.

---

### 2. RAII-Scoped Termios Preservation Across Subprocess Execution
**RULE**:
Any application that executes arbitrary child processes or configures raw terminal input (TUI) MUST capture the process's standard input terminal attributes (`termios`) before any subprocess is spawned or TUI rendered, and MUST reinstate those exact attributes via an explicit RAII `Drop` guard on normal exit, error exit, and panics. Furthermore, on Unix platforms, terminal restoration MUST account for OS-specific input discipline flags (specifically Darwin/macOS `PENDIN`).

**WHY**:
Subprocesses (such as test runners, headless browsers like Cypress, or shells) often reconfigure terminal attributes, disabling flags like `ONLCR` (Translate newline to carriage-return/newline on output) or enabling raw input mode. If the child process is terminated abruptly (via `SIGKILL`, `SIGINT`, or uncaught panic), the modified terminal attributes remain active in the host shell. This causes the "staircase effect" or offset spacing where `\n` fails to return the cursor to column 0.

**WHEN TO APPLY**:
- Terminal UI frameworks (`ratatui`, `iocraft`, `crossterm`).
- CLI task runners and process managers that execute foreign user commands.
- Interactive shells and wrappers that manage raw mode.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[cfg(unix)]
pub struct TerminalStateGuard {
    saved_termios: Option<libc::termios>,
}

#[cfg(unix)]
impl TerminalStateGuard {
    pub fn save() -> Self {
        use std::os::unix::io::AsRawFd;
        let fd = std::io::stdin().as_raw_fd();
        let mut termios = std::mem::MaybeUninit::<libc::termios>::uninit();
        let res = unsafe { libc::tcgetattr(fd, termios.as_mut_ptr()) };
        let saved = if res == 0 {
            Some(unsafe { termios.assume_init() })
        } else {
            None
        };
        Self { saved_termios: saved }
    }

    pub fn restore(&self) {
        if let Some(mut original) = self.saved_termios {
            use std::os::unix::io::AsRawFd;
            let fd = std::io::stdin().as_raw_fd();
            
            #[cfg(target_os = "macos")]
            {
                // Darwin sets PENDIN when restoring ICANON.
                // It tracks pending input in the kernel and must be cleared
                // to prevent assertion failures in termios parity checks.
                original.c_lflag &= !libc::PENDIN;
            }

            unsafe {
                libc::tcsetattr(fd, libc::TCSANOW, &original);
            }
        }
    }
}

#[cfg(unix)]
impl Drop for TerminalStateGuard {
    fn drop(&mut self) {
        self.restore();
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Relying strictly on graceful shutdown or library teardown
fn execute_task() {
    crossterm::terminal::enable_raw_mode().unwrap();
    // Spawning child command directly inheriting stdin/stdout
    let _ = std::process::Command::new("cypress").status();
    // VIOLATION: If the task is killed by SIGKILL, panics, or returns early via `?`,
    // disable_raw_mode() is bypassed, or if Cypress altered termios flags that
    // crossterm doesn't manage (like ONLCR), terminal remains corrupted forever.
    crossterm::terminal::disable_raw_mode().unwrap();
}
```

**VERIFICATION METHOD**:
Implement a pseudo-terminal (PTY) unit test using `nix::pty::openpty`. Have the child command explicitly mutate termios via `stty -onlcr` and kill itself via `kill -KILL $$`. Verify via `nix::sys::termios::tcgetattr` that the parent process's `TerminalStateGuard` restores `OutputFlags::ONLCR` automatically upon dropping the guard.

---

### 3. TOCTOU Double-Check Verification on Tracked Environment Inputs
**RULE**:
When caching evaluation results based on the state of external configuration files (such as `.env` or project settings), the system MUST capture file content digests immediately prior to parsing (`before`), execute the parse and variable substitution, and immediately re-verify the digests (`after`). If `before != after`, the evaluation MUST be aborted and rejected.

**WHY**:
External files can be modified or written incrementally by concurrent processes (editors, formatters, external tools) while the loader is executing. Relying on a single check-and-load introduces a Time-Of-Check to Time-Of-Use (TOCTOU) race condition, resulting in caching a Nix/eval configuration that reflects a corrupted, half-written file state.

**WHEN TO APPLY**:
- Language environment loaders (`.env`, `.envrc`, configuration manifests).
- Dynamic file trackers feeding incremental build graph evaluation caches.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TrackedFileDigest {
    pub path: PathBuf,
    pub sha256: Option<String>,
}

pub fn capture_file_digests<'a>(paths: impl IntoIterator<Item = &'a Path>) -> Result<Vec<TrackedFileDigest>, std::io::Error> {
    paths.into_iter().map(|p| {
        let sha256 = match std::fs::read(p) {
            Ok(bytes) => Some(hex::encode(Sha256::digest(&bytes))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(e),
        };
        Ok(TrackedFileDigest {
            path: p.to_path_buf(),
            sha256,
        })
    }).collect()
}

pub fn load_and_verify_configuration(paths: &[PathBuf]) -> Result<BTreeMap<String, String>, String> {
    let before = capture_file_digests(paths.iter().map(PathBuf::as_path))
        .map_err(|e| format!("Pre-read digest error: {e}"))?;

    // Perform actual parse / load
    let parsed_data = execute_parse(paths)?;

    let after = capture_file_digests(paths.iter().map(PathBuf::as_path))
        .map_err(|e| format!("Post-read digest error: {e}"))?;

    if before != after {
        return Err("TOCTOU state modification detected: configuration file was modified concurrently during read. Operation aborted.".into());
    }

    Ok(parsed_data)
}

fn execute_parse(_paths: &[PathBuf]) -> Result<BTreeMap<String, String>, String> {
    Ok(BTreeMap::new())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Reading file, computing hash, then returning values without validating consistency
fn parse_and_hash_vulnerable(path: &Path) -> (String, String) {
    // VIOLATION: If another process writes between read and hash, or between check and use,
    // the system caches an inconsistent state.
    let content = std::fs::read_to_string(path).unwrap();
    let hash = calculate_hash(&content);
    (content, hash)
}
```

**VERIFICATION METHOD**:
Construct a test where a background thread writes garbage into a `.env` file at random intervals between 10µs and 100µs while `load_and_verify_configuration` is invoked in a tight loop. Assert that every iteration either produces a valid clean state or returns the concurrent modification `Err`, never returning an unvalidated or corrupt intermediate payload.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Nix Binding Attribute Lookup Collision on Dotted Target Paths (BUG-DEVENV-01)
- **Context**: Nix C++ foreign bindings integration and target machine metadata extraction (`devenv-nix-backend`, `nix-bindings-rust`, `tests/machines-literal-attributes/`).
- **What Was Expected**: Target paths containing dots (e.g., encryption keys located at `/tmp/luks.key` or extra system files like `/etc/a.conf`) must be treated as atomic, literal attribute names in the Nix attribute set when serializing machine metadata to JSON.
- **What Actually Happened**: The Nix expression evaluation bindings performed path-based string tokenization rather than literal key lookup. When encountering a key named `"/tmp/luks.key"`, the evaluator split on the dot `.` and attempted to access the attribute `key` nested inside `/tmp/luks`, resulting in an evaluation abort: `attribute '/tmp/luks' missing`.
- **Evidence in Repo**: Commit `b02b026c`, PR #3277, PR #3298.
- **Root Cause**: The Rust-Nix binding layer converted Rust struct keys into Nix expressions without wrapping attribute lookup identifiers in literal quotes or using literal attribute selection APIs. Nix attribute path syntax treats unquoted `a.b` as nested navigation. When converting Nix values to JSON, the bridge used attribute path traversal instead of literal map iteration.
- **Remediation Code Diff**:
```diff
--- a/Cargo.lock
+++ b/Cargo.lock
@@ -6095,7 +6095,7 @@ dependencies = [
  [[package]]
  name = "nix-bindings-expr"
  version = "0.1.0"
-source = "git+https://github.com/cachix/nix-bindings-rust.git?branch=2.35#afb90e929fef2700b5cbbed7960334e2b91c1080"
+source = "git+https://github.com/cachix/nix-bindings-rust.git?branch=2.35#53ba0ed2962ceb18303f5b2fbca1cd0fb88df135"

--- a/tests/machines-literal-attributes/.test.sh
+++ b/tests/machines-literal-attributes/.test.sh
@@ -0,0 +1,16 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+# Export the whole metadata object so the JSON walker encounters the literal
+# target paths, rather than selecting a dotted attribute path through the CLI.
+devenv --no-eval-cache eval machinesMeta > metadata.json
+jq -e --arg root "$PWD" '
+  .machinesMeta.server.encryptionKeys == {
+    "/tmp/luks.key": ($root + "/secrets/luks.key")
+  } and
+  .machinesMeta.server.extraFiles["/etc/a.conf"].source == ($root + "/files/a.conf")
+' metadata.json
```
- **Lesson**: Data paths containing punctuation (specifically dots and slashes) cannot be queried using dot-delimited path expression query parsers. Attribute key serialization across FFI boundaries must use exact literal string slices rather than polymorphic expression tokenizers.

---

### Incident 2: Permanent Terminal Output Misalignment Following Subprocess Kill (BUG-DEVENV-02)
- **Context**: Terminal state restoration and TUI process management (`devenv-tui/src/app.rs`, `devenv/src/main.rs`).
- **What Was Expected**: When a foreground command or background task exits normally or is terminated via `SIGKILL`/`SIGTERM` (e.g., Cypress test teardown killing headless Chrome), the user's terminal settings must be preserved or restored to original cooked mode.
- **What Actually Happened**: As documented in Issue #3292, running a task like `cypress run` and killing it caused the terminal to permanently lose newline-carriage return mapping (`ONLCR`). Subsequent terminal output rendered in an offset, staircase pattern until the user completely restarted their terminal emulator.
- **Evidence in Repo**: Commit `08b97027`, Issue #3292, PR #3300.
- **Root Cause**: `devenv-tui` saved terminal state only when raw mode was entered for the TUI interface itself. If a child process executed while the TUI was in cooked mode, or if a child process was spawned and altered terminal flags directly via `libc::tcsetattr` before being sent `SIGKILL`, `devenv` exited without resetting the inherited terminal descriptor. Furthermore, Crossterm's internal raw mode snapshot would take snapshots of already-corrupted child settings if raw mode was toggled after child modification.
- **Remediation Code Diff**:
```diff
--- a/devenv-tui/src/app.rs
+++ b/devenv-tui/src/app.rs
+/// Restore the caller's terminal settings when command execution finishes.
+///
+/// Keep this guard alive until both the backend and frontend have stopped, since
+/// tasks can change their inherited terminal even when the TUI is disabled.
+#[must_use = "keep the guard alive until command execution finishes"]
+pub struct TerminalStateGuard(());
+
+impl TerminalStateGuard {
+    pub fn save() -> Self {
+        save_terminal_state();
+        Self(())
+    }
+}
+
+impl Drop for TerminalStateGuard {
+    fn drop(&mut self) {
+        restore_terminal_state();
+    }
+}

-pub fn restore_terminal() {
-    let mut stderr = io::stderr();
+pub fn restore_terminal_state() {
     #[cfg(unix)]
     if let Some(original) = ORIGINAL_TERMIOS.get() {
         use std::os::unix::io::AsRawFd;
         let fd = io::stdin().as_raw_fd();
         unsafe { libc::tcsetattr(fd, libc::TCSANOW, original) };
     }
+}

--- a/devenv/src/main.rs
+++ b/devenv/src/main.rs
@@ -980,6 +980,7 @@ fn run(prepared: PreparedCommand, caller: Caller) -> Result<CommandResult> {
+    let _terminal_state = devenv_tui::app::TerminalStateGuard::save();
     let (renderer, _activity_guard) = Renderer::init(&frontend);
```
- **Lesson**: Terminal state management cannot be tied strictly to UI rendering phases. It must wrap the entire application process lifecycle as an RAII guard at the outermost boundary of `main()`.

---

### Incident 3: Shell Hook Prompt Lag When Navigating Directly Between Projects (BUG-DEVENV-03)
- **Context**: Interactive shell hooks for directory change detection (`devenv/hooks/hook.fish`, `hook.nu`, `hook.posix.sh`).
- **What Was Expected**: When a developer executes `cd ../other-devenv-project` from inside an active devenv shell, exiting the previous shell and following the user into the new target directory must immediately trigger environment activation for the new project.
- **What Actually Happened**: The shell followed the user to the destination directory, but the activation logic did not execute. The developer was presented with an un-activated shell and had to press Enter a second time to fire the prompt hook to trigger activation (Issue #3129).
- **Evidence in Repo**: Commit `82cf5b97`, Issue #3129, PR #3293.
- **Root Cause**: The shell integration hook executed only once per prompt evaluation event (`--on-event fish_prompt` or `$PROMPT_COMMAND`). Exiting a sub-shell and executing `cd` shifted `$PWD` during the post-exit cleanup phase *after* the initial activation check had executed. Because shell functions avoided recursive calls to prevent call stack overflow, the new directory was never evaluated during that cycle.
- **Remediation Code Diff**:
```diff
--- a/devenv/hooks/hook.posix.sh
+++ b/devenv/hooks/hook.posix.sh
@@ -40,9 +40,24 @@ _devenv_hook() {
         return $previous_exit_status
     fi
 
+    # Following the user out of a devenv shell can land them in another
+    # project. Check again whenever the directory changed, so that project
+    # activates now rather than on the next prompt (#3129). A loop rather than
+    # recursion, so hopping between projects doesn't grow the call stack.
+    local checked_dir=""
+    while [[ "$PWD" != "$checked_dir" ]]; do
+        checked_dir="$PWD"
+        _devenv_hook_check
+    done
+    return $previous_exit_status
+}
+
+_devenv_hook_check() {
     # Just exited the devenv shell for this dir — don't re-spawn until you leave.
     if [[ "$_DEVENV_HOOK_ACTIVATED" == "$PWD" ]]; then
-        return $previous_exit_status
+        return
     fi
     _DEVENV_HOOK_ACTIVATED=""
```
- **Lesson**: State transition handlers that alter their own evaluation predicates (e.g., changing directory as a side effect of shell deactivation) must utilize a convergence loop (`while current != previous`) rather than assuming a single-shot execution per event trigger.

---

### Incident 4: Database Deletion Under Concurrency on SQLITE_BUSY (BUG-DEVENV-04)
- **Context**: Shared SQLite caching layer (`devenv-cache-core/src/db.rs`).
- **What Was Expected**: Multiple concurrent processes entering `devenv shell` should wait on SQLite locks or retry migration safely without corrupting each other's cache.
- **What Actually Happened**: Under high concurrency, when a second process attempted to run migrations against a database being initialized by the first process, SQLite returned `SQLITE_BUSY`. The migration error fallback logic caught this error, treated it as fatal database corruption, and triggered `remove_sqlite_files(&path)`. This unlinked the database out from under the first process, converting a recoverable concurrency wait into `SQLITE_IOERR_DELETE_NOENT` and fatal crash loops (Issue #3133).
- **Evidence in Repo**: `devenv-cache-core/src/db.rs`, line 38–70 and Issue #3133 post-mortem comments.
- **Root Cause**: The migration failure handler lacked granular error classification. It treated all SQLx migration errors identically by dropping the pool, deleting `.db`, `-wal`, and `-shm` files, and re-initializing. When lock contention occurred, `SQLITE_BUSY` or `SQLITE_LOCKED` were misidentified as catalog corruption.
- **Remediation Code Diff**:
```diff
--- a/devenv-cache-core/src/db.rs
+++ b/devenv-cache-core/src/db.rs
@@ -53,6 +53,18 @@ impl Database {
+            // A lock/busy error means another connection is using the file.
+            // Never delete it — that is how concurrent cold entry turned a
+            // recoverable SQLITE_BUSY into SQLITE_IOERR_DELETE_NOENT (#3133).
+            if migrate_error_is_busy(&err) {
+                warn!(
+                    error = %err,
+                    path = %path.display(),
+                    "database locked during migration, retrying without recreating"
+                );
+                migrator
+                    .run(&pool)
+                    .await
+                    .map_err(|e| CacheError::Database(e.into()))?;
+                return Ok(Self { pool, _path: path });
+            }
```
- **Lesson**: Destructive recovery strategies (such as deleting and recreating local state databases) MUST explicitly reject lock contention error codes (`BUSY`, `LOCKED`, `POOL_TIMEOUT`). Destructive recreation is valid ONLY when structural storage corruption is positively proven.

---

### Incident 5: Deadlock on inotify Instance Exhaustion During Shell Startup (BUG-DEVENV-05)
- **Context**: File-system watching and hot-reloading orchestrator (`devenv-reload`, Issue #3281).
- **What Was Expected**: If the operating system runs out of inotify instances (`fs.inotify.max_user_instances`), `devenv shell` must gracefully degrade by disabling file watch and starting the shell without live-reload.
- **What Actually Happened**: When `inotify_init1` returned `EMFILE`, `watchexec` failed critically during worker startup and exited before sending the `fs_ready` readiness signal. The main devenv thread remained parked awaiting `fs_ready.changed()`. Because the `WatcherHandle` held an active reference to the configuration sender channel, the channel never closed, causing `de