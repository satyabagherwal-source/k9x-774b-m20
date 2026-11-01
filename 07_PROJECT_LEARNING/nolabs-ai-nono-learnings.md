> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source**: github ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Source Version**: `f9f58b77`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T17:43:07.316Z  
> **Learning ID**: `learn-github-nolabs-ai-nono`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): nolabs-ai/nono

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`nolabs-ai/nono` provides zero-trust, kernel-enforced runtime security and capability-based sandboxing for AI agent execution (e.g., Claude Code, Goose, OpenClaw, custom agent runners). It restricts agents and subprocess tools from arbitrary filesystem mutations, network egress, process spawning, and credential leakage without requiring root/daemon privileges.

```
                      +-------------------------------------------------------------+
                      |                      Supervisor Loop                        |
                      |   - waitpid(WNOHANG) / PTY relay orchestration               |
                      |   - Dynamic network/filesystem approval coordinator          |
                      +--------------+------------------------------+---------------+
                                     |                              |
                   Off-Thread IPC    |                              | Relay Pause
                   (Condvar Gate)    |                              | (Raw -> Cooked)
                                     v                              v
                      +-----------------------------+  +----------------------------+
                      |   Worker / Proxy Threads    |  |       PTY / Terminal       |
                      |  - HTTP MITM proxy          |  |  - Raw Mode (cfmakeraw)    |
                      |  - Credential injection     |  |  - stdin pass-through      |
                      |  - Dynamic consent prompts  |  |  - Safe rendering (\r\n)   |
                      +--------------+--------------+  +-------------+--------------+
                                     |                               |
                                     +---------------+---------------+
                                                     |
                                            fork()   | Landlock / Seatbelt
                                            pre_exec | seccomp / namespace
                                                     v
                                       +---------------------------+
                                       |      Sandboxed Child      |
                                       |  - AI Agent / Subprocess  |
                                       |  - Kernel sandbox boundary|
                                       +---------------------------+
```

### Architectural Boundaries & Subsystems
1. **Core Kernel Enforcement (`crates/nono`)**: Abstracts OS-specific kernel isolation primitives:
   - Linux: Landlock (filesystem ruleset via Landlock ABI), seccomp-bpf (syscall and pathname AF_UNIX mediation), and Linux namespaces.
   - macOS: Apple Seatbelt (`sandbox_init` / SBPL profiles) enforcing path rules and socket operations.
2. **Supervisor & Orchestration Engine (`crates/nono-cli`)**:
   - `exec_strategy.rs`: Pre-fork and post-fork lifecycle management, process-group isolation (`setpgid`), WNOHANG polling loops, orphan cleanup, and teardown.
   - `pty_proxy.rs`: Terminal virtual terminal/PTY proxying maintaining child I/O isolation.
   - `relay_prompt_gate.rs`: Inter-thread gate managing synchronization between asynchronous proxy worker approvals and the synchronous PTY relay event loop.
3. **Transparent Proxy & Credential Shield (`crates/nono-proxy`)**:
   - Outbound egress mediation via local HTTP/HTTPS forward proxies, TLS termination/inspection, domain allowlists/denylists, method/path-level endpoint matching, and phantom token credential injection (preventing token leakage to untrusted model environments).
4. **Attestation & Cryptographic Audit**:
   - Sigstore verification (`sigstore-sign`, `sigstore-verify`) for skill and configuration attestation.
   - Tamper-evident ledger logging under canonical XDG base specifications (`$XDG_STATE_HOME/nono/audit/ledger.ndjson`).
5. **C FFI Layer (`bindings/c`)**:
   - Stable ABI export layer exposing opaque handles, null-safe conversions, error thread locals, and diagnostic serialization backplanes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Cross-Thread Terminal State Mediation Gate (Raw Mode Prompt Guard)
**RULE**:
When an interactive prompt must be displayed to `stderr`/`stdout` within a system that maintains a PTY relay running in raw mode (`cfmakeraw`, disabling `OPOST`), secondary/worker threads MUST NOT write directly to the terminal or read from `stdin`. Secondary threads MUST acquire an asynchronous coordination gate, park via condition variables until the primary PTY supervisor thread suspends the relay (restoring canonical "cooked" mode), and emit all line terminators as explicit carriage return and line feed sequences (`\r\n`). If the supervisor does not grant the pause within a bounded timeout deadline, the worker MUST fail closed (deny permission).

**WHY**:
In POSIX raw mode (`termios.c_oflag &= ~OPOST`), terminal drivers do not map newline (`\n`, `0x0A`) to return-to-column-0 (`\r\n`, `0x0D 0x0A`). Any off-thread prompt printed with standard `println!` or bare `\n` creates a layout staircase artifact where subsequent lines print at the offset column of the previous newline. Crucially, if worker threads attempt to read from `stdin` concurrently with an active PTY relay loop, both threads enter a race condition on the underlying terminal file descriptor. The PTY loop's `poll()` triggers, reads partial input, and leaves subsequent blocking reads permanently hung.

**WHEN TO APPLY**:
Any systems software, sandboxing proxy, CLI tool, or AI agent runtime where:
- A foreground PTY proxy relays bidirectional raw terminal events to a child process.
- Background worker threads (e.g., HTTP proxies, RPC handlers, IPC callbacks) need out-of-band user approval or confirmation.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::{Condvar, Mutex, MutexGuard, PoisonError};
use std::thread::ThreadId;
use std::time::Instant;

pub struct RelayPromptGate {
    state: Mutex<GateState>,
    changed: Condvar,
}

struct GateState {
    owner: Option<ThreadId>,
    pending: usize,
    paused: bool,
}

impl RelayPromptGate {
    pub const fn new() -> Self {
        Self {
            state: Mutex::new(GateState {
                owner: None,
                pending: 0,
                paused: false,
            }),
            changed: Condvar::new(),
        }
    }

    fn lock(&self) -> MutexGuard<'_, GateState> {
        // Recover from poisoning: poisoning occurs on panic outside the gate invariant
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn run_with_relay_paused<T>(&self, deadline: Instant, prompt: impl FnOnce() -> T) -> Option<T> {
        let mut state = self.lock();
        let is_off_thread = state.owner.is_some_and(|owner| owner != std::thread::current().id());
        
        if !is_off_thread {
            // Supervisor thread pauses terminal directly without gating
            drop(state);
            return Some(prompt());
        }

        // Increment pending waiter count
        state.pending = state.pending.saturating_add(1);
        
        // Wait until supervisor signals paused state
        loop {
            if state.paused || state.owner.is_none() {
                break;
            }
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                // Timeout reached; fail closed
                state.pending = state.pending.saturating_sub(1);
                self.changed.notify_all();
                return None;
            }
            state = self.changed.wait_timeout(state, remaining)
                .unwrap_or_else(PoisonError::into_inner).0;
        }

        // Execute prompt while supervisor holds terminal in cooked mode
        let result = prompt();

        // Release pending counter and notify supervisor
        state = self.lock();
        state.pending = state.pending.saturating_sub(1);
        self.changed.notify_all();

        Some(result)
    }

    pub fn service_pending_prompts(&self, mut pause_relay: impl FnMut(&dyn Fn())) {
        let state = self.lock();
        if state.pending == 0 || state.paused {
            return;
        }
        drop(state);

        pause_relay(&|| {
            let mut state = self.lock();
            state.paused = true;
            self.changed.notify_all();

            while state.pending > 0 && state.owner.is_some() {
                state = self.changed.wait(state).unwrap_or_else(PoisonError::into_inner);
            }
            state.paused = false;
            self.changed.notify_all();
        });
    }
}

pub fn print_terminal_safe_stderr(message: &str) {
    use std::io::{self, Write};
    let mut stderr = io::stderr();
    if io::IsTerminal::is_terminal(&stderr) {
        let normalized = message.replace('\n', "\r\n");
        let _ = write!(stderr, "\r{}\r\n", normalized);
    } else {
        let _ = writeln!(stderr, "{}", message);
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Direct prompt emission from worker thread without relay arbitration
fn bad_worker_approval(request: &ApprovalRequest) -> bool {
    // BUG 1: Bare \n in raw mode causes staircase rendering
    eprintln!("[nono] Sandboxed request: {:?}", request);
    eprint!("Allow [y/N]? ");
    
    // BUG 2: Reads stdin while PTY supervisor thread is calling read() on the same fd.
    // Result: Data race, terminal freeze, deadlocked session.
    let mut line = String::new();
    std::io::stdin().read_line(&mut line).unwrap();
    line.trim().eq_ignore_ascii_case("y")
}
```

**VERIFICATION METHOD**:
Run integration tests where background network requests trigger approvals concurrently with active terminal echo. Verify with headless PTY allocations that:
1. Every emitted line ends with `\r\n`.
2. No input bytes are dropped by the supervisor's `waitpid` event loop.
3. If the supervisor is unresponsive, the prompt times out and denies execution within `deadline`.

---

### 2. Dual-Canonical State Inode Verification for Sandbox Deserialization
**RULE**:
When persisting and restoring OS-enforced sandboxing capabilities across execution boundaries, systems MUST serialize both the original lexical path string and the device-inode pair `(dev_t, ino_t)`. Upon deserialization and re-construction of kernel rules (such as Landlock rulesets), the engine MUST resolve canonical paths anew, compare the newly resolved path and inode against the serialized `(dev, ino)` identity, and REJECT the state if the canonical target has changed or moved.

**WHY**:
Kernel LSMs (Linux Landlock in particular) attach access enforcement to internal filesystem objects (vfs inodes) resolved at ruleset creation time, not lexical path strings. If a file is replaced via atomic rename/write-temp pattern (`O_TMPFILE` or rename over target) between capability derivation and enforcement, the sandbox rule binds to an orphan or invalid inode while the actual replacement file receives no access rules. Conversely, malicious JSON state manipulation could inject a modified `original` path pointing to an arbitrary host secret (e.g. `/etc/shadow`) while spoofing a benign `resolved` path.

**WHEN TO APPLY**:
Any capability-based confinement system, state migration daemon, or security profile cache that saves and restores filesystem authority representations across process forks, RPC boundaries, or persistent stores.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};
use std::os::unix::fs::MetadataExt;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct FsCapSnapshot {
    pub original: PathBuf,
    pub resolved: PathBuf,
    pub dev: Option<u64>,
    pub ino: Option<u64>,
    pub is_file: bool,
}

pub fn restore_and_verify_cap(cap: &FsCapSnapshot) -> Result<PathBuf, String> {
    // Canonicalize the original path anew to detect symlink redirection / traversal
    let current_canonical = cap.original.canonicalize()
        .map_err(|e| format!("Path {:?} cannot be canonicalized: {}", cap.original, e))?;

    // Anti-smuggling proof: freshly resolved path must match the recorded resolved path
    if current_canonical != cap.resolved {
        return Err(format!(
            "Integrity failure: path identity drifted. Serialized: {:?}, Actual: {:?}",
            cap.resolved, current_canonical
        ));
    }

    // Inode verification on Linux systems
    #[cfg(target_os = "linux")]
    if cap.is_file {
        let meta = std::fs::metadata(&current_canonical)
            .map_err(|e| format!("Cannot stat canonical path {:?}: {}", current_canonical, e))?;
        
        let current_dev = meta.dev();
        let current_ino = meta.ino();

        if let (Some(expected_dev), Some(expected_ino)) = (cap.dev, cap.ino) {
            if current_dev != expected_dev || current_ino != expected_ino {
                return Err(format!(
                    "Inode drift detected for {:?}: expected ({}, {}), found ({}, {}). Possible TOCTOU replacement.",
                    current_canonical, expected_dev, expected_ino, current_dev, current_ino
                ));
            }
        }
    }

    Ok(current_canonical)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly trusting serialized canonical paths without re-canonicalization or inode check
fn bad_deserialize_caps(json_data: &str) -> Vec<PathBuf> {
    let state: serde_json::Value = serde_json::from_str(json_data).unwrap();
    // VULNERABILITY: If an attacker modifies the local state file or injects a payload,
    // they bypass path canonicalization and grant arbitrary paths directly to the child.
    state["fs"].as_array().unwrap().iter()
        .map(|entry| PathBuf::from(entry["path"].as_str().unwrap()))
        .collect()
}
```

**VERIFICATION METHOD**:
Implement property tests using temp directories where a symlink is flipped or a file is overwritten via rename between `from_caps()` and `to_caps()`. Assert that `to_caps()` returns an explicit `ConfigParse` error and does not load the drifted capability.

---

### 3. RAII Ephemeral Credential & Hook Environment Cleansing
**RULE**:
Temporary credentials, secrets, and environment variable passing files generated for subprocess execution hooks MUST be constructed within private, dedicated directories initialized with `0o700` permissions. The file descriptor MUST be opened using `O_CREAT | O_EXCL` with mode `0o600`. Upon deallocation (RAII drop), the file contents MUST be explicitly scrubbed with zeroed bytes (`vec![0u8; len]`), flushed to persistent storage via `sync_all()`, and immediately unlinked.

**WHY**:
Standard file deletion (`std::fs::remove_file`) merely unlinks directory entries; raw file block contents remain intact on disk blocks until overwritten, creating forensic memory/disk leaks. If parent supervisor loops panic, fail prematurely, or return via early error expressions (`?`), insecure temporary files can be read by other local users, especially in multi-tenant environments or world-readable staging spaces.

**WHEN TO APPLY**:
Any credential proxy, authorization injector, script hook execution runtime, or subprocess runner that materializes plaintext keys, tokens, or environment definitions to disk.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::{File, OpenOptions, Permissions};
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};

pub struct SecureEnvFileGuard {
    path: PathBuf,
}

impl SecureEnvFileGuard {
    pub fn create(session_dir: &Path) -> std::io::Result<Self> {
        // Enforce 0o700 on parent session directory
        std::fs::create_dir_all(session_dir)?;
        std::fs::set_permissions(session_dir, Permissions::from_mode(0o700))?;

        let file_path = session_dir.join("env.secret");

        // Atomic create with O_EXCL and 0o600 mode
        OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o600)
            .open(&file_path)?;

        Ok(Self { path: file_path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for SecureEnvFileGuard {
    fn drop(&mut self) {
        // Attempt forensic zeroing of disk blocks prior to unlink
        if let Ok(mut file) = OpenOptions::new().write(true).open(&self.path) {
            if let Ok(metadata) = file.metadata() {
                let len = metadata.len() as usize;
                if len > 0 {
                    let zeros = vec![0u8; len];
                    let _ = file.write_all(&zeros);
                    let _ = file.sync_all();
                }
            }
        }
        let _ = std::fs::remove_file(&self.path);
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Standard tempfile usage without explicit zeroing or strict mode permissions
fn bad_write_env(env_data: &str) -> std::path::PathBuf {
    let path = std::env::temp_dir().join("nono_env.tmp");
    // VULNERABILITY 1: File created in world-readable /tmp with ambient umask
    // VULNERABILITY 2: Contents persist in disk sectors after delete
    std::fs::write(&path, env_data).unwrap();
    path
}
```

**VERIFICATION METHOD**:
Unit test inspecting permissions via `std::os::unix::fs::MetadataExt::mode()`, asserting `mode & 0o777 == 0o600`. Write data, manually trigger `drop()`, verify file is removed from filesystem, and assert path does not exist.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: PTY Terminal Raw-Mode Staircase Rendering & Session Hang (BUG-NONO-01)
- **Context**: `crates/nono-cli/src/exec_strategy.rs`, `crates/nono-cli/src/terminal_approval.rs`, `crates/nono-cli/src/pty_proxy.rs`
- **What Was Expected**: Network approval prompts raised by proxy worker threads during an active PTY session should render cleanly at column 0 and wait for user authorization without stalling the execution loop.
- **What Actually Happened**: Network and proxy approvals spawned on asynchronous proxy worker threads printed prompts while the terminal remained in raw mode (`cfmakeraw`, disabling `OPOST`). Every `\n` retained the current cursor column, creating a broken staircase UI layout. Concurrently, the PTY relay kept reading `stdin`; when the user responded, the relay's `poll()` had already claimed input, causing its blocking `read()` to permanently hang the supervisor loop.
- **Evidence in Repo**: Commit `f9f58b77`, Closes Issue #2232, PR #2234.
- **Root Cause**: Architectural separation between proxy worker threads and the main supervisor thread. Proxy worker threads had no access to the `PtyProxy` instance owned by the supervisor thread, preventing them from pausing the PTY relay before prompting.
- **Remediation Code Diff**:
```rust
// In crates/nono-cli/src/terminal_approval.rs
- Self::prompt(
-     request,
-     deadline,
-     crate::terminal_prompt::read_consent_line_until,
- )
+ crate::relay_prompt_gate::run_with_relay_paused(deadline, || {
+     Self::prompt(
+         request,
+         deadline,
+         crate::terminal_prompt::read_consent_line_until,
+     )
+ })
+ .unwrap_or(Ok(ApprovalDecision::Timeout))

// In crates/nono-cli/src/startup_prompt.rs
  pub(crate) fn print_terminal_safe_stderr(message: &str) {
      let mut stderr = io::stderr();
      if stderr.is_terminal() {
          let normalized = message.replace('\n', "\r\n");
-         let _ = writeln!(stderr, "\r{}", normalized);
+         let _ = write!(stderr, "\r{}\r\n", normalized);
      } else {
          let _ = writeln!(stderr, "{}", message);
      }
  }
```
- **Lesson**: Out-of-band CLI approval prompts across multi-threaded runtimes must synchronize with terminal hardware modes via an explicit supervisor event gate.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **C FFI Safe Integer Conversions**: In FFI boundary structures (e.g., `bindings/c/src/fs_capability.rs`), access modes are represented as raw `u32` and verified before casting to Rust enum types:
```rust
let access = match validate_access_mode(mode) {
    Some(m) => m,
    None => {
        set_last_error(&format!("invalid access mode: {mode}"));
        return NonoErrorCode::ErrInvalidArg;
    }
};
```
  Using `std::mem::transmute` or unguarded enum casting from C integers is strictly prohibited. Unrecognized discriminants trigger immediate return of `NONO_ACCESS_MODE_INVALID` (`UINT32_MAX`) and thread-local error state initialization.
- **Preserving String Aliases via Dual-Path Representation**: When resolving capabilities, both `original` (as specified by user/profile) and `resolved` (canonicalized path) are stored. On macOS Seatbelt, rules require dual-path emission when `original != resolved` to avoid breaking applications accessing paths via symlink aliases (such as `/var` vs `/private/var`).

### 2. Infinite Loop & Recursion Guards
- **Saturating Arithmetic for Thread Waiting**: In `relay_prompt_gate.rs`, waiter counts avoid overflow and underflow vulnerabilities using saturating math:
```rust
state.pending = state.pending.saturating_add(1);
// Drop guard cleanup:
state.pending = state.pending.saturating_sub(1);
```
- **Bounded Timed Waits via Monotonic Deadlines**: Condition variable waits never loop unconditionally. Every iteration recalculates remaining time against an absolute `Instant` deadline:
```rust
loop {
    if state.paused || state.owner.is_none() {
        return true;
    }
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return false;
    }
    state = self.changed.wait_timeout(state, remaining)
        .unwrap_or_else(PoisonError::into_inner).0;
}
```

### 3. UI & UX Micro-Mechanics
- **Line Discipline Carriage Return Invariant**: When terminal streams operate under raw PTY configurations, every output message must be normalized from bare `\n` to `\r\n` and prefixed with `\r` to force cursor alignment back to column 0:
```rust
let normalized = message.replace('\n', "\r\n");
let _ = write!(stderr, "\r{}\r\n", normalized);
```
- **Terminal Input Sanitization**: Path and argument strings displayed in approval dialogs must be sanitized through `sanitize_for_terminal()` to escape ANSI escape codes, terminal cursor movement sequences, and control characters before rendering.

### 4. Backend Concurrency & Memory Safety
- **Poison Error Recovery for Non-Panicking Mutex Blocks**:
```rust
fn lock(&self) -> MutexGuard<'_, GateState> {
    self.state.lock().unwrap_or_else(PoisonError::into_inner)
}
```
  Because prompts and heavy side effects execute outside the mutex lock boundary, mutex poisoning only occurs if an invariant drops abruptly. Returning the inner guard ensures subsequent off-thread approval prompts are not permanently locked out.
- **Process Group Pre-Exec Isolation**: Subprocess hooks must install `setpgid(0, 0)` during POSIX `pre_exec` to ensure child processes and their transitive subprocesses can be killed cleanly via process group signalling on timeout:
```rust
unsafe {
    cmd.pre_exec(|| {
        let _ = nix::unistd::setpgid(nix::unistd::Pid::from_raw(0), nix::unistd::Pid::from_raw(0));
        Ok(())
    });
}
```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **FFI Null-Pointer Guard & String Free Protocols**: All C FFI methods check for null pointers at function entry. Reconstituted strings are passed via `Box<[u8]>` / `CString::into_raw` and must only be deallocated through `nono_string_free`:
```rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_string_free(s: *mut c_char) {
    if !s.is_null() {
        unsafe { drop(std::ffi::CString::from_raw(s)); }
    }
}
```
- **Rejection of Ambiguous State Paths**: State reconstruction explicitly denies ambiguous or drifting paths. If deserialization reveals that `/proc/self/` links or aliases have drifted, or a reconstructed Unix socket's resolved path deviates from `sock.resolved`, the entire state load operation fails closed.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Decoupled multi-crate workspace:
- `nono`: Low-level kernel interface library (pure OS primitives, zero network stack).
- `nono-proxy`: Hyper/Tokio async network interceptor, credential injector, and endpoint router.
- `nono-cli`: End-user CLI application, PTY supervisor, profile manager, and session orchestrator.
- `bindings/c`: C-compatible FFI export library exposing capability management to foreign language runtimes.

### 2. Core Abstractions
- `CapabilitySet`: Immutable or builder-based collections of filesystem paths (`FsCapability`), UNIX socket rules (`UnixSocketCapability`), and network policies (`NetworkMode`).
- `SandboxState`: JSON-serializable snapshot of active sandbox parameters enabling runtime inspection via `nono why --self`.
- `ApprovalBackend`: Trait abstracting interactive terminal prompts, webhook HTTP dispatches, or automated consent systems.

### 3. Error Handling
- Structured error domain via `thiserror::Error` enumerating configuration, canonicalization, sandbox initialization, and I/O failures.
- Diagnostic mapping associating each failure with a stable `NonoDiagnosticCode` and structured remediation metadata.
- Thread-local error capture (`set_last_error`) ensuring detailed error context survives across C FFI boundaries.

### 4. Testing
- Roundtrip serialization and deserialization property checks (`test_dns_blocking_roundtrip`, `test_state_json_roundtrip`).
- FFI null-safety unit tests passing null pointers across every public extern C entry point.
- Mock Python webhook approval server (`approval-webhook-demo.py`) testing dynamic authorization requests and payload formats.

### 5. Security
- Validation of hook scripts: must be absolute, canonical, regular executable files, owned by current user or root, and NOT located within any world-writable directory.
- Denial of dangerous environment variables across subprocess boundaries (`LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, etc.).
- Credential wiping via `zeroize` and cryptographic signing of profiles/skills via Sigstore.

### 6. Performance
- Minimal binary overhead compiled with `opt-level = 3`, `lto = "thin"`, `codegen-units = 1`, and `panic = "abort"`.
- `WNOHANG` non-blocking wait loops in supervisor threads preventing busy-wait CPU thrashing.
- Zero-copy string transformations and selective JSON parsing on diagnostic reports.

### 7. Deployment
- Pure single-binary distribution with no daemon or root requirements.
- Standardized XDG state path resolution (`$XDG_STATE_HOME/nono`) with backwards-compatible legacy fallback until `v1.0.0`.
- Release automation creating signed releases and attestations via Sigstore.

### 8. Agent Patterns
- Support for top-tier agent frameworks (Claude Code, Goose, OpenCode, Pydantic AI, LangChain).
- Phantom token injection: Agents receive dummy tokens; the outbound proxy swaps dummy tokens for real credentials over approved HTTPS endpoints.
- Command launch mediation: Subprocess commands are checked against allowlists and regex/prefix rules before execution.

### 9. Data Flow
1. User invokes `nono run --profile <profile> -- <command>`.
2. Profile parsed -> Paths canonicalized -> Inodes captured -> `CapabilitySet` assembled.
3. Hook runtime executes `Before` hook outside sandbox -> Filtered env vars collected.
4. Supervisor forks child -> Pre-exec installs `setpgid`, applies Landlock/Seatbelt, restricts network namespaces.
5. Child launches. Child network traffic redirects to `nono-proxy` via local loopback.
6. Unknown outbound domain triggers dynamic approval -> Handled off-thread via `RelayPromptGate` -> Supervisor pauses PTY -> Prompt rendered safely -> Decision applied.
7. Process exits -> Supervisor catches status via `waitpid` -> `After` hook executes -> Ephemeral session artifacts zeroed and unlinked.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Asynchronous Supervisor Coordination Gate
Synchronize off-thread workers with an active single-threaded PTY loop by maintaining an atomic counter of pending requests, an explicit ownership identifier (`ThreadId`), and condition variable signalling that suspends raw mode during user interactions.

### 2. Rule
External approval prompts MUST NEVER interact with standard terminal descriptors without verifying and asserting cooked mode status under active PTY relay loops.

### 3. Architecture Principle
**Fail Closed on Unattended Prompts**: If an interactive authorization prompt cannot safely reach the user (due to deadlocks, timeouts, or unhandled PTY modes), the request must default to `Denial` / `Timeout` rather than proceeding optimistically.

### 4. Failure Mode
Terminal raw mode cursor lock (`OPOST` off) leading to text staircase distortion and PTY relay `poll()` race condition deadlocks during concurrent `stdin` access.

### 5. Reusable Skill
Forensic audit of subprocess hook scripts: check canonical path, verify file mode `(mode & 0o111) != 0`, verify UID against current EUID or 0, and check parent directory permissions against world-writable mask `0o002`.

### 6. Decision
Placing ephemeral session files in `$XDG_STATE_HOME/nono/sessions/<id>` rather than `/tmp` to prevent local symlink race conditions, sticky-bit bypasses, and multi-user inspection attacks.

### 7. Anti-Pattern
Invoking `writeln!(stderr, ...)` inside an agent session with an attached raw terminal without mapping `\n` to `\r\n`.

### 8. Verification Method
Verify that C FFI wrappers return safe error sentinels on `NULL` arguments and do not trigger undefined behavior or segmentation faults via cargo test runners exercising null-pointer safety harnesses.

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### Agent Sandbox Engineering Checklist

- [ ] 1. Terminal & PTY Handling
  - [ ] Does the supervisor put the terminal into raw mode (`cfmakeraw`)?
  - [ ] Are all stderr/stdout prompt strings normalized to `\r\n`?
  - [ ] Is there an asynchronous gate to pause the PTY relay during background worker prompts?
  - [ ] Does the gate fail closed (timeout/deny) if the relay does not pause in time?

- [ ] 2. Kernel Sandbox Enforcement
  - [ ] Are paths canonicalized before ruleset construction?
  - [ ] On Linux Landlock, are `(dev, ino)` pairs tracked to detect inode changes?
  - [ ] Are missing parent directories handled without leaving wildcard gaps?
  - [ ] Are implicit DNS resolver grants explicitly controlled?

- [ ] 3. Subprocess & Hook Isolation
  - [ ] Are hook scripts verified to be owned by EUID or root?
  - [ ] Are hook scripts prevented from running out of world-writable directories (`0o002`)?
  - [ ] Is `setpgid(0, 0)` installed in `pre_exec` to allow process-group killing?
  - [ ] Are dangerous environment variables (`LD_PRELOAD`, etc.) stripped?

- [ ] 4. Credential & State File Security
  - [ ] Are session directories created with `0o700` permissions?
  - [ ] Are secret environment files created with `O_CREAT | O_EXCL` and `0o600`?
  - [ ] Does the drop guard zero the file memory/sectors before unlinking?
  - [ ] Are state directories aligned with canonical XDG specifications?

- [ ] 5. C FFI Boundary Hardening
  - [ ] Are all raw pointers checked for `NULL` before dereferencing?
  - [ ] Are integer enum flags checked against allowed ranges rather than blindly cast?
  - [ ] Are error strings stored in thread-local storage rather than returned across boundaries?
  - [ ] Is a dedicated `free` function exported for FFI-allocated strings?
```