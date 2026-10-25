> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/herdrdev-herdr-learnings.md`  
> **Source**: github ([https://github.com/herdrdev/herdr](https://github.com/herdrdev/herdr))  
> **Source Version**: `5608de06`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T08:23:58.113Z  
> **Learning ID**: `learn-github-herdrdev-herdr`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): herdrdev/herdr

---

## 1. Executive Forensic Architecture & System Mechanics

`herdr` is an asynchronous, client-server terminal multiplexer and agent workspace orchestrator engineered in Rust. Unlike legacy multiplexers (e.g., `tmux`, `screen`), which prioritize interactive human shell sessions via pseudo-terminal (PTY) emulation and synchronous redraw loops, `herdr` is architected around the lifecycle contracts of autonomous AI coding agents (Claude Code, OpenCode, Kilo, Pi, Codex, Cursor).

```
                      +-------------------------------------------------------------+
                      |                        Thin Client                          |
                      |  - Crossterm Event Loop & Raw Mode                          |
                      |  - SGR Pixel Mouse & Kitty Graphic Passthrough              |
                      |  - Hit-Map Coordinate Routing (ShellHitMap)                 |
                      |  - BlitEncoder / Semantic Frame Differencing               |
                      +------------------------------+------------------------------+
                                                     |
                                        IPC Transport (Framed JSON/Bincode)
                                        Unix Domain Sockets / Windows Named Pipes
                                                     |
                      +------------------------------v------------------------------+
                      |                    herdr Server Engine                      |
                      |                                                             |
                      |  +---------------------+           +---------------------+  |
                      |  | App Runtime Reactor |<--------->| Session Persistence |  |
                      |  | - AppEvent Loop     |           | - Debounced Writer  |  |
                      |  | - SIGHUP Trap/Probe |           | - Snapshot Store    |  |
                      |  +----------+----------+           +---------------------+  |
                      |             |                                               |
                      |             v                                               |
                      |  +---------------------+           +---------------------+  |
                      |  | Ghostty VT Engine   |<--------->| Integration Server  |  |
                      |  | - Native PTY Stream |           | - JSON-RPC Over Pipe|  |
                      |  | - OSC 8 / SGR Parser|           | - Subprocess Probes |  |
                      |  +----------+----------+           +----------+----------+  |
                      +-------------|---------------------------------|-------------+
                                    |                                 |
                                    v                                 v
                         +--------------------+            +--------------------+
                         | Target PTY / Shell |            | Agent Hook Bridge  |
                         | (zsh, bash, sh)    |            | (Node/TS Injected) |
                         +--------------------+            +--------------------+
```

### Architectural Subsystems and Decoupling Invariants
1. **The Client-Server Separation Barrier**:
   The runtime isolates the display frontend (`ClientState`, `ClientShellState`) from the execution backend (`App`, `Workspace`, `Pane`). Communication occurs over a framed local transport (`src/ipc.rs`) using platform abstractions (Unix domain sockets with abstract namespace or filesystem paths; Windows Named Pipes prefixed with `\\.\pipe\`). The server process outlives all terminal clients, SSH disconnects, and parent session tears.
2. **Ghostty-VT Virtual Terminal Core**:
   Embedded as an in-tree workspace crate (`crates/ghostty-vt`), this subsystem wraps Zig/C-level terminal abstractions (`ghostty_terminal_vt_write`). It provides zero-copy VT sequence decoding, SGR attribute management, OSC 8 hyperlink routing, and Kitty graphics protocol handling directly in Rust memory without requiring external terminal dependencies.
3. **Agent State Observability & Sequence Synchronization Engine**:
   Autonomous agents report structured telemetry (`working`, `blocked`, `idle`) into the multiplexer through injected shims (`src/integration/assets/*`). State transitions are versioned with monotonically increasing, high-precision sequence numbers (`reportSeq = Date.now() * 1000 + increment`). The server enforces total ordering over async state streams, reconciling out-of-order completions and client acknowledgments before updating composite UI status badges.
4. **Session Persistence & Crash Barrier Layer**:
   Session topology (workspaces, tabs, split trees, working directories) is continuously staged in memory and flushed to disk (`session.json`) using an atomic write-replace debounce pattern. System shutdown detection coordinates POSIX signal traps with OS-level inhibitor locks (`zbus` logind delay inhibitor on Linux). This prevents process cascade kills from wiping persistent layout state.

---

## 2. Net-New Universal Engineering Rules

### 1. POSIX Asynchronous Signal-Safe Ephemeral Horizon Recording
**RULE**:
Daemons and persistent multiplexers handling child process lifetimes MUST record process-level termination signals (such as `SIGHUP` and `SIGTERM`) inside a low-level, atomic, async-signal-safe hook using monotonic time. They MUST NOT evaluate process or child exit classifications purely through synchronous event loops or Tokio signal channels during system shutdown.

**WHY**:
When an OS initiates shutdown, the init system (systemd, sysvinit) broadcasts signals concurrently to process groups. PTY child processes frequently die *before* the server's asynchronous runtime can poll and dispatch the asynchronous signal stream. If child process exit handlers interpret this sudden mass termination as clean, intentional user exits (`ChildExitReason::Exited`), the server deletes active workspace state, leaving an empty layout file when it finally shuts down.

**WHEN TO APPLY**:
Any daemon, supervisor, multiplexer, or background worker architecture managing subordinate child processes, sockets, or persistent session descriptors on POSIX platforms.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::atomic::{AtomicU64, Ordering};

// Monotonically tracked millisecond timestamp of last SIGHUP reception
static LAST_SERVER_HANGUP_MS: AtomicU64 = AtomicU64::new(0);

fn monotonic_millis() -> u64 {
    let mut now: libc::timespec = unsafe { std::mem::zeroed() };
    // CLOCK_MONOTONIC is guaranteed async-signal-safe on POSIX systems
    if unsafe { libc::clock_gettime(libc::CLOCK_MONOTONIC, &mut now) } != 0 {
        return 0;
    }
    (now.tv_sec as u64)
        .saturating_mul(1000)
        .saturating_add(now.tv_nsec as u64 / 1_000_000)
        .saturating_add(1)
}

extern "C" fn record_server_hangup() {
    LAST_SERVER_HANGUP_MS.store(monotonic_millis(), Ordering::Relaxed);
}

pub fn within_server_hangup_window(hangup_ms: u64, now_ms: u64, window_ms: u64) -> bool {
    hangup_ms != 0
        && now_ms
            .checked_sub(hangup_ms)
            .is_some_and(|elapsed| elapsed <= window_ms)
}

pub fn server_hangup_is_recent() -> bool {
    within_server_hangup_window(
        LAST_SERVER_HANGUP_MS.load(Ordering::Relaxed),
        monotonic_millis(),
        5_000,
    )
}

pub fn initialize_early_signal_traps() -> Result<(), Box<dyn std::error::Error>> {
    // Registered via signal-hook before Tokio or any worker threads spawn
    unsafe {
        signal_hook::low_level::register(libc::SIGHUP, record_server_hangup)?;
    }
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Relying exclusively on async channel dispatch for crash protection.
// If child PTYs die while this channel message is buffered or queued behind
// async I/O tasks, child reaper callbacks run under the false presumption of normal operation.
tokio::spawn(async move {
    let mut stream = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::hangup()).unwrap();
    while let Some(()) = stream.recv().await {
        // TOO LATE: Child processes have already exited and flushed their state!
        app_state.mark_shutdown();
    }
});
```

**VERIFICATION METHOD**:
Verify using an automated integration test that raises a raw signal via `libc::raise(libc::SIGHUP)` in a separate thread. Assert that `server_hangup_is_recent()` returns `true` immediately before any Tokio event loop ticks, and assert expiration precisely at `window_ms + 1`.

---

### 2. Unix Local Socket Liveness Differentiation: Refusal vs Timeout
**RULE**:
When probing Unix domain sockets for connection stale status, an implementation MUST classify a connection as stale (safe to unlink/replace) ONLY on immediate deterministic connection rejection errors (`io::ErrorKind::ConnectionRefused` or `io::ErrorKind::NotFound`). An implementation MUST NOT classify an operating system connect timeout (`io::ErrorKind::TimedOut`) on a Unix domain socket as a dead server.

**WHY**:
Unlike TCP sockets across lossy networks, a local Unix domain socket connect operation only fails with `TimedOut` or hangs under extreme kernel lock contention, heavy scheduler saturation, or when the server daemon's listen backlog is temporarily full. Treating `TimedOut` as proof of a stale socket causes clients to unlink the active server's listening socket. This leaves the server orphaned and spawns colliding split-brain daemon processes on the same configuration directory. On Windows, Named Pipes legitimately use timeout mechanisms during handshake negotiations (`ERROR_SEM_TIMEOUT`), necessitating platform-gated error matching.

**WHEN TO APPLY**:
Client-server IPC layers, local CLI daemons, fast RPC discovery protocols, and single-instance Unix daemons.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::io;

pub fn is_stale_socket_connect_error(kind: io::ErrorKind) -> bool {
    // Under Unix: Only explicit refuse or missing path indicates dead daemon.
    // TimedOut means host/server is saturated; NEVER unlink or declare stale.
    matches!(
        kind,
        io::ErrorKind::ConnectionRefused | io::ErrorKind::NotFound
    ) || (cfg!(windows) && matches!(kind, io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock))
}

pub fn prepare_ipc_socket(socket_path: &std::path::Path) -> io::Result<()> {
    match connect_to_server(socket_path) {
        Ok(_stream) => Err(io::Error::new(io::ErrorKind::AlreadyExists, "server running")),
        Err(err) if is_stale_socket_connect_error(err.kind()) => {
            // Safe to clean up dead socket file
            #[cfg(unix)]
            let _ = std::fs::remove_file(socket_path);
            bind_new_server(socket_path)
        }
        Err(err) => {
            // Saturated server, permission failure, or IO problem: ABORT, DO NOT UNLINK!
            Err(err)
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blithely lumping TimedOut into stale socket detection across all platforms.
fn stale_socket_connect_error(kind: io::ErrorKind) -> bool {
    matches!(
        kind,
        io::ErrorKind::ConnectionRefused | io::ErrorKind::NotFound | io::ErrorKind::TimedOut // DANGER!
    )
}
```

**VERIFICATION METHOD**:
Implement a unit test parameterized across `cfg!(unix)` and `cfg!(windows)`. Assert that `is_stale_socket_connect_error(io::ErrorKind::TimedOut)` evaluates strictly to `false` on Unix targets and `true` on Windows targets.

---

### 3. Agent Integration Multi-Instance Session Isolation via Process Environment Traps
**RULE**:
Agent state telemetry hooks injected into terminal shells MUST inspect ancestor execution marker variables (e.g., `OMPCODE`, `HERDR_NESTED_AGENT`) and CLI execution vectors before acquiring session authority. If a subordinate child agent process is detected, the hook MUST NOT overwrite or report session identities over the pane's root agent.

**WHY**:
Coding agents frequently spawn sub-agents or nested commands that share identical installed plugins or global environment hooks (e.g., when Claude Code or OMP spawns bash to run a script containing another agent invocation). If the nested process blindly sends `pane.report_agent_session`, the multiplexer rebinds the pane's entire persistence tracking to an ephemeral child process. When that child finishes seconds later, the pane is falsely classified as dead, or status tracking disconnects from the parent agent.

**WHEN TO APPLY**:
Telemetry hooks, process supervision wrappers, observability instrumentation, and shell hooks designed for autonomous tools capable of sub-shell branching.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import net from "node:net";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const paneId = process.env.HERDR_PANE_ID;

// Guard against nested sub-shell execution overriding parent session identity:
// Example: OMP sets OMPCODE=1 on child shells it launches.
const isNestedSession = process.env.OMPCODE === "1";

export function isSessionTelemetryEligible(): boolean {
  return (
    HERDR_ENV === "1" &&
    Boolean(socketPath) &&
    Boolean(paneId) &&
    !isNestedSession
  );
}

export function buildSafeSessionPayload(
  ctx: { hasUI?: boolean; mode?: string },
  sessionRef: Record<string, unknown>
): Record<string, unknown> | null {
  if (!isSessionTelemetryEligible()) {
    return null;
  }
  // Headless execution (JSON/print/RPC) must not claim root PTY visual ownership
  if (ctx.hasUI !== true && ctx.mode !== "tui") {
    return null;
  }
  return {
    pane_id: paneId,
    source: "herdr:agent",
    session_start_source: "startup",
    ...sessionRef,
  };
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Blindly attaching to hook lifecycle and blasting IPC messages.
export const Plugin = () => ({
  "session.created": async ({ sessionID }) => {
    // Disregards whether this is a nested sub-process or headless worker.
    // Destroys outer multiplexer session fidelity!
    await reportToMultiplexer({ sessionID });
  }
});
```

**VERIFICATION METHOD**:
Simulate a nested sub-shell run by executing the agent integration unit harness with `OMPCODE=1`. Assert that socket dispatch functions are short-circuited and zero packets are written to the mock IPC endpoint.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: System Shutdown Wipes Session Layout File (BUG-HERDR-01)
- **Context**: Subsystem `src/platform/unix_common.rs`, `src/app/session.rs`, and `src/app/api.rs`.
- **What Was Expected**: On system shutdown/reboot, the server daemon should retain the existing `session.json` containing the full hierarchy of workspaces, tabs, panes, and current working directories, so that upon reboot the session restores completely.
- **What Actually Happened**: On machines using sysvinit or uninhibited systemd shutdown paths, the server received SIGHUP, logged `ignoring SIGHUP; server keeps running`, but child panes terminated immediately due to SIGHUP. As each pane died, it emitted an `AppEvent::PaneDied` event with reason `ChildExitReason::Exited`. The application's debounce logic interpreted this as the user closing all panes interactively, wiped `session.json`, and saved an empty layout.
- **Evidence in Repo**: Commit `6b526626` (refs #5349, PR #5510).
- **Root Cause**: The application classified pane deaths as intentional closures unless `exit_reason.requires_session_checkpoint()` evaluated to true (which only matched unexpected crashes/signals). Because child shells exited via normal termination when their controlling terminal died, they yielded `ChildExitReason::Exited`. Furthermore, the asynchronous signal monitor had not yet processed the signal due to Tokio event loop scheduling, meaning the server had no awareness that a host shutdown was underway.
- **Remediation Code Diff**:
```rust
// Cargo.toml
+[target.'cfg(unix)'.dependencies]
+signal-hook = "0.3"

// src/platform/unix_common.rs
+static LAST_SERVER_HANGUP_MS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
+
+fn monotonic_millis() -> u64 {
+    let mut now: libc::timespec = unsafe { std::mem::zeroed() };
+    if unsafe { libc::clock_gettime(libc::CLOCK_MONOTONIC, &mut now) } != 0 {
+        return 0;
+    }
+    (now.tv_sec as u64)
+        .saturating_mul(1000)
+        .saturating_add(now.tv_nsec as u64 / 1_000_000)
+        .saturating_add(1)
+}
+
+fn record_server_hangup() {
+    LAST_SERVER_HANGUP_MS.store(monotonic_millis(), std::sync::atomic::Ordering::Relaxed);
+}
+
+pub(crate) fn ignore_server_hangup() {
+    if let Err(err) = unsafe { signal_hook::low_level::register(libc::SIGHUP, record_server_hangup) } {
+        tracing::warn!(%err, "failed to install SIGHUP handler");
+    }
+}

// src/app/api.rs
-            } if exit_reason.requires_session_checkpoint() && self.find_pane(*pane_id).is_some() && !self.overlay_panes.contains_key(pane_id)
+            } if (exit_reason.requires_session_checkpoint()
+                || (*exit_reason == crate::platform::ChildExitReason::Exited
+                    && (self.server_hangup_probe)()))
+                && self.find_pane(*pane_id).is_some() && !self.overlay_panes.contains_key(pane_id)
```
- **Lesson**: During system shutdown, child processes exit before async runtimes process termination signals. Low-level signal traps recording monotonic timestamps in atomic primitives allow asynchronous event handlers to correlate child exits with external shutdown events.

---

### Incident 2: Premature Socket Deletion Under Heavy CPU/IO Load (BUG-HERDR-02)
- **Context**: Subsystem `src/ipc.rs` (Stale socket garbage collection).
- **What Was Expected**: If an existing server daemon is active but processing a heavy workload, a newly spawned client should wait or fail cleanly. It must never destroy the active server's IPC socket.
- **What Actually Happened**: When a machine experienced high load, `connect()` to the local domain socket timed out. The client classified `io::ErrorKind::TimedOut` as evidence of a "stale socket", deleted the domain socket file from the filesystem, and attempted to start a second server. This resulted in two active servers colliding on disk, corrupting `session.json`.
- **Evidence in Repo**: Commit `ff5881ef` (refs #5230, PR #5511).
- **Root Cause**: `stale_socket_connect_error()` contained `io::ErrorKind::TimedOut` unconditionally. On Unix, a domain socket connect cannot timeout due to missing network endpoints; a timeout indicates system exhaustion or an overwhelmed server listener backlog.
- **Remediation Code Diff**:
```rust
// src/ipc.rs
 fn stale_socket_connect_error(kind: io::ErrorKind) -> bool {
     matches!(
         kind,
-        io::ErrorKind::ConnectionRefused | io::ErrorKind::NotFound | io::ErrorKind::TimedOut
-    ) || (cfg!(windows) && kind == io::ErrorKind::WouldBlock)
+        io::ErrorKind::ConnectionRefused | io::ErrorKind::NotFound
+    ) || (cfg!(windows) && matches!(kind, io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock))
 }
```
- **Lesson**: Never equate latency or timeouts with target absence on local IPC channels. On Unix, only hard refusals (`ECONNREFUSED`) or non-existent files (`ENOENT`) prove that a socket endpoint is dead.

---

### Incident 3: Server SIGSEGV in Terminal Hyperlink Parsing (BUG-HERDR-03)
- **Context**: Embedded `ghostty-vt` terminal engine integration (`crates/ghostty-vt/src/bindings.rs`, `process_pty_bytes`).
- **What Was Expected**: Long PTY output streams interleaving ANSI SGR formatting, OSC 8 hyperlinks, cursor movements, and alternate screen switches should render without memory faults.
- **What Actually Happened**: The server died with `EXC_BAD_ACCESS (SIGSEGV)` at offset `0x0000000000000020` inside `terminal.Screen.endHyperlink`. This killed the background daemon and terminated all agent sessions across all panes.
- **Evidence in Repo**: Issue #5296; repro via `python3 repro.py 1 16777216` generating high-entropy terminal streams containing OSC 8 sequences.
- **Root Cause**: The VT parser state machine failed to synchronize the lifecycle of an active hyperlink reference across screen buffer switches (switching between primary and alternate screens). When SGR styles were cleared, `endHyperlink` attempted to dereference a cell hyperlink pointer from the inactive screen buffer, triggering a null/dangling pointer dereference at structure offset `0x20`.
- **Remediation**: Hardened the FFI boundary in `ghostty-vt` to isolate VT state resets and sanitize OSC 8 hyperlink tracking across screen allocations. This ensures hyperlink state is flushed whenever terminal dimensions or active screen buffers mutate.
- **Lesson**: When bridging native C/Zig VT parsing libraries with Rust, terminal screen buffer allocations (primary vs alternate screen) must explicitly invalidate and flush inline text styling and hyperlink structures. State must not leak across buffer switches.

---

### Incident 4: Pane Appearance Theme Desynchronization Race (BUG-HERDR-04)
- **Context**: Subsystem `src/app/agent_resume.rs`, `src/app/api.rs`, `src/app/creation.rs`, `src/app/custom_commands.rs`.
- **What Was Expected**: When new panes launch, their background color and color scheme (Dark vs Light) must match the host terminal's appearance exactly to prevent visual flashing and unreadable agent text.
- **What Actually Happened**: Spawning a pane read `self.state.host_terminal_appearance` directly. If an appearance query had been dispatched to the host terminal but the response was still pending, or if an appearance change transaction was held during layout generation, newly opened panes received stale cached appearance settings. This caused the terminal background to invert (e.g., bright white background on a dark theme) until an explicit resize or theme broadcast occurred.
- **Evidence in Repo**: Commit `3f5032c9` (refs #4183, PR #5517).
- **Root Cause**: Direct struct property access bypassed an internal gate check (`pane_host_terminal_appearance()`). This gate buffers and coordinates appearance transitions, ensuring that theme payloads are dispatched only *after* the corresponding background clear sequence has been applied.
- **Remediation Code Diff**:
```rust
// Multiple files across src/app/
-            self.state.host_terminal_appearance,
+            self.pane_host_terminal_appearance(),
```
- **Lesson**: Encapsulate transactional display properties behind accessor methods that enforce phase ordering. Never expose mutable configuration fields directly to child instantiation points when initialization sequences depend on ordered protocol handshakes.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Zero vs Falsy in Terminal Row Offsets**:
  In Rust UI geometry, using signed integer casts carelessly causes underflows when calculating screen bounds. For example:
  ```rust
  // DANGEROUS: If area.height is 0, (0 - 1) as u16 underflows to 65535 in release mode
  let y = area.y + area.height - 1; 

  // CORRECT: Explicit saturation prevents integer wrap-around panics and off-screen drawing
  let y = area.y + area.height.saturating_sub(1);
  ```
* **Unicode Width Calculation**:
  Byte length (`str::len()`) and character count (`chars().count()`) MUST NOT be used for terminal cell allocations. In `src/client/shell/render.rs`, cell consumption is calculated using Unicode display width:
  ```rust
  x = x.saturating_add(
      u16::try_from(UnicodeWidthStr::width(text.as_str()))
          .unwrap_or(u16::MAX)
          .min(remaining),
  );
  ```
  Failure to use `UnicodeWidthStr::width()` causes multi-byte UTF-8 sequences (e.g., emojis `😀`, Asian scripts `你好`, and ANSI box characters `│`) to misalign terminal buffers, corrupting mouse click coordinate maps.

---

### 2. Infinite Loop & Recursion Guards
* **State Machine Queue Draining Guard**:
  In JavaScript/TypeScript integration hooks (`src/integration/assets/omp/herdr-agent-state.ts`), sending asynchronous status updates over sockets can trigger re-entrant events. The queue drainer uses an explicit lock flag with loop resumption rather than unbounded recursive calls:
  ```typescript
  let sendInFlight = false;
  let queuedState: QueuedState | undefined;

  async function drainStateQueue(): Promise<void> {
    if (sendInFlight) {
      return; // Prevents recursive stack overflows on rapid state transitions
    }
    sendInFlight = true;
    try {
      while (queuedState) {
        const next = queuedState;
        queuedState = undefined;
        await sendState(next.state, next.message, next.seq);
      }
    } finally {
      sendInFlight = false;
      // Loop termination invariant: Re-check if state was queued during await
      if (queuedState) {
        void drainStateQueue();
      }
    }
  }
  ```
* **Child Session Tree Cycle Protection**:
  In `opencode/herdr-agent-state.js`, child session lookups traverse a parent-child map to locate the root session. If an agent emits cyclic parent pointers (`A -> B -> A`), a naive `while` loop would lock the V8 event loop:
  ```javascript
  let rootSessionID = sessionID;
  const visited = new Set();
  while (childSessions.has(rootSessionID) && !visited.has(rootSessionID)) {
    visited.add(rootSessionID);
    rootSessionID = childSessions.get(rootSessionID);
  }
  ```

---

### 3. UI & UX Micro-Mechanics
* **Coordinate Hit-Map Generation**:
  Terminal UIs cannot query a live DOM for mouse events. In `src/client/shell/state.rs`, every render pass produces a fresh `ShellHitMap` storing physical rectangular cells (`Rect { x, y, width, height }`):
  ```rust
  pub(super) struct PaneHit {
      pub(super) rect: Rect,
      pub(super) inner_rect: Rect,
      pub(super) scrollbar_rect: Option<Rect>,
      pub(super) pane_id: String,
      pub(super) mouse_reporting: bool,
      pub(super) sgr_pixel_mouse: bool,
      pub(super) pixel_width: u32,
      pub(super) pixel_height: u32,
  }
  ```
* **Pixel vs Cell Mouse Routing**:
  When a terminal supports SGR-Pixel Mouse Mode (Mode 1016), click coordinates are dispatched in raw physical pixels rather than cell columns. The multiplexer calculates:
  ```rust
  pub(super) fn pixel_mouse_available(&self) -> bool {
      self.pixel_geometry_exact && self.host_sgr_pixel_mouse == Some(true)
  }
  ```
  If `pixel_geometry_exact` is false, mouse events fall back to cell-based standard SGR encoding. This prevents misaligned mouse selections when run in custom or unverified terminal emulators.

---

### 4. Backend Concurrency & Memory Safety
* **Debounced Atomic Persistence**:
  In `src/app/session.rs`, disk writes are debounced (`SESSION_SAVE_DEBOUNCE = 250ms`) to protect solid-state drives and prevent I/O stalls during bursts of agent activity. A background worker thread executes the file write, guarded by an atomic generation counter:
  ```rust
  if self.pane_exit_checkpoint_pending && !self.state.session_dirty {
      self.session_save_deadline = None;
      return;
  }
  ```
* **Socket Unlink TOCTOU Protection**:
  Before binding to a Unix domain socket, stale verification is handled through explicit connection checks rather than file existence probes (`std::path::Path::exists()` followed by `bind()` is vulnerable to Time-of-Check to Time-of-Use bugs). The socket is unlinked *only* after `connect()` fails with an explicit `ECONNREFUSED`.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Subprocess Timer Leaks via `unref()`**:
  In Node.js agent integration scripts, any `setTimeout` call for debounce or retry tracking MUST invoke `.unref()`:
  ```javascript
  const timeout = setTimeout(() => finish(false), timeoutMs);
  timeout.unref?.();
  ```
  Omitting `.unref()` forces the V8 event loop to stay open indefinitely. When an agent command finishes executing, the process hangs in the background for the full duration of the timeout, blocking parent PTY teardowns.
* **Stream Buffer Framing Invariant**:
  IPC messages over local sockets are newline-delimited JSON. Reading must maintain an internal accumulation buffer to handle arbitrary TCP/pipe fragmentation:
  ```rust
  // Messages must be consumed strictly up to the '\n' token;
  // trailing bytes belong to the next incoming payload frame.
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
`herdr` follows a split-core reactive pattern. The persistent background daemon retains the definitive virtual terminal grids and active PTY handles. The frontend thin client is a transient terminal consumer that attaches, renders differential ANSI blits, maps crossterm inputs back to server requests, and cleanly detaches (`Ctrl+B Q`) without interrupting background operations.

### 2. Core Abstractions
- `Palette`: The theming abstraction decoupling UI styling from ratatui widgets. Supports Catppuccin Mocha/Latte, Tokyo Night, Dracula, Nord, and fallback 16-color ANSI profiles.
- `PaneSurfaceFrame`: A serialized transport representation of a rendered grid surface, containing cells, damage rectangles, OSC 8 hyperlinks, cursor position, and Kitty graphic identifiers.
- `EndpointAgentPresentation`: Client-side agent reconciliation tracker handling sequence-based status transitions (`Working`, `Blocked`, `Idle`, `Done`) and computing aggregate status badges for tabs and workspaces.

### 3. Error Handling
The engine implements strict boundary defenses:
- Unhandled PTY terminations are isolated and categorized by `classify_child_exit`. A pane crashing with `SIGSEGV` or `SIGKILL` isolates its split region, marks the pane as dead with the signal number, and leaves surrounding panes and the parent workspace completely intact.
- IPC parse errors discard the malformed frame without terminating the local transport stream.

### 4. Testing
- Low-level signal integration tests make direct use of `libc::raise(libc::SIGHUP)` to prove signal handler execution before async event loop