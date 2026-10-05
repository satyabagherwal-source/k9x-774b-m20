> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: GitHub ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T07:44:40.665Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: Hmbown/Codewhale

## 1. Executive Forensic Architecture & System Mechanics

`Codewhale` is a local-first, multi-agent autonomous coding engine designed to execute complex software engineering workflows. It features a rich Terminal User Interface (TUI) and integrates with the Model Context Protocol (MCP) to provide agents with extensible toolsets.

```
                                  +---------------------------------------+
                                  |         TUI Layer (Ratatui)           |
                                  |  - Input Composer   - Render Loop     |
                                  |  - Cursor Control   - Status Footer   |
                                  +-------------------+-------------------+
                                                      | Event Stream
                                                      v
+-----------------------------------------------------+-----------------------------------------------------+
|                                            Core Engine (Rust)                                             |
|                                                                                                           |
|  +------------------------+      +------------------------+      +-----------------+      +------------+  |
|  |   Turn & State Mgr     | ---> |    Compaction Engine   | ---> |  Provider Lake  | ---> |  MCP Host  |  |
|  |  - History Truncation  |      |  - Token Optimization  |      |  - Model Router |      |  - Tools   |  |
|  |  - Wall-Clock Limits   |      |  - Summary Fallbacks   |      |  - Cost Tracker |      |  - PTYs    |  |
|  +------------------------+      +------------------------+      +-----------------+      +------------+  |
+-----------------------------------------------------+-----------------------------------------------------+
                                                      |
                                                      v
                                        +---------------------------+
                                        |  OS Pseudo-Terminal (PTY) |
                                        |  - Shell Execution        |
                                        |  - Liveness Polling       |
                                        +---------------------------+
```

### Architectural Subsystems & Boundaries

1. **The Core Engine & Turn Manager**: Coordinates agent execution loops ("turns"). It manages context windows, applies token compaction, and enforces execution limits (such as wall-clock timeouts).
2. **The TUI Layer (Ratatui/Crossterm)**: A terminal-based user interface that renders agent status, active tool calls, file diffs, and interactive prompts. It relies on a strict frame-rendering loop where state must be synchronized without blocking the main UI thread.
3. **The PTY/Shell Subsystem**: Spawns and manages interactive pseudo-terminals (PTYs) to execute local commands. It must preserve shell state, handle asynchronous output streaming, and manage terminal resizing (`SIGWINCH`) across different operating systems.
4. **The Provider Lake & Model Router**: Resolves model configurations, handles API keys, normalizes model identifiers (e.g., stripping OpenRouter aliases), and tracks token usage and session costs.
5. **The Tool Execution & MCP Host**: Executes filesystem operations, runs tests, and interfaces with external Model Context Protocol servers. It enforces workspace boundaries to prevent agents from writing outside the project root.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

### Failure Mode 1: Idle PTY Dropouts & Resize Deadlocks
* **Failure Mode**: When an agent's owned pseudo-terminal (PTY) remained idle (no command execution or output), the underlying file descriptor was either closed by the OS or became unresponsive to resize events, preventing reconnection or terminal resizing.
* **Root Cause**: The asynchronous read loop for the PTY dropped its polling future when no data was flowing, or blocked indefinitely on a synchronous read call, preventing the event loop from processing incoming resize signals (`SIGWINCH`).
* **Exact Prevention / Fix**: Implement non-blocking PTY reads using asynchronous streams (e.g., `tokio-fd` or `mio`) combined with a liveness channel. Ensure the resize handler is decoupled from the read loop and can execute even when the PTY is idle.

### Failure Mode 2: TUI Style Accumulation & "Black Hole" Render Artifacts
* **Failure Mode**: After running the TUI in focus for extended periods (~30 minutes), background text colors corrupted, and the "jump-to-latest" button rendered with horizontal lines.
* **Root Cause**: The rendering loop failed to explicitly clear or reset cell styles for overlapping or dynamic widgets. Stateful hover rules leaked across frame redraws because the terminal cells retained dirty style states from previous frames.
* **Exact Prevention / Fix**: Ensure every render pass explicitly overrides the style of every cell within its bounding box. Use `Frame::render_widget` with an explicit `Clear` widget or a style-resetting block to wipe background states before drawing dynamic overlays.

### Failure Mode 3: Silent Configuration Failures via Loose Deserialization
* **Failure Mode**: Commands like `codewhale config set calm_mode flase` (typo in value) or `codewhale config set invalid_key 42` exited with code `0` and wrote invalid configurations to disk.
* **Root Cause**: The configuration parser used a permissive map-based deserializer that accepted arbitrary key-value pairs without validating them against a strict schema or enum definition.
* **Exact Prevention / Fix**: Use `serde` with the `#[serde(deny_unknown_fields)]` attribute on the configuration struct. Validate all configuration updates against this schema before writing them to disk.

### Failure Mode 4: Compaction Failures Leading to Token Blowups
* **Failure Mode**: 15 out of 16 context compaction attempts failed silently, causing the engine to send massive uncompacted histories (~219k tokens) to the LLM, resulting in 0% cache hits and high costs.
* **Root Cause**: The compaction engine attempted to summarize tool outputs but crashed when encountering malformed tool logs or when the summary LLM call itself timed out. The engine caught the error but silently fell back to the uncompacted history without alerting the user or retrying with a simpler strategy.
* **Exact Prevention / Fix**: Implement a multi-stage fallback compaction strategy (e.g., summary -> metadata-only truncation -> sliding window). Log compaction failures as warnings and expose compaction health metrics to the user.

### Failure Mode 5: OpenRouter Alias Resolution & Pricing Failures
* **Failure Mode**: OpenRouter session costs consistently reported "rate unavailable" because model IDs containing `~` prefixes (e.g., `openrouter/anthropic/claude-3`) broke provider-lake lookups.
* **Root Cause**: The pricing catalog lookup used exact string matching on the raw model ID, failing to normalize or strip provider-specific prefixes and aliases before querying the rate database.
* **Exact Prevention / Fix**: Implement a strict normalization layer that strips provider prefixes (like `openrouter/` or `~`) and maps aliases to canonical model identifiers before performing pricing or routing lookups.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

### D1: Structural Boundaries & Modularity
`Codewhale` maintains a strict separation between its core execution engine, the TUI presentation layer, and the OS-level PTY subsystem. 

```
+-----------------------------------------------------------------------+
|                             TUI Layer                                 |
|  - Renders state changes received via crossbeam/tokio channels.       |
|  - No direct access to LLM clients or PTY file descriptors.           |
+----------------------------------+------------------------------------+
                                   | Event Channels
                                   v
+----------------------------------+------------------------------------+
|                            Core Engine                                |
|  - Manages agent state, tool execution, and context compaction.       |
|  - Exposes clean traits for LLM providers and PTY execution.          |
+----------------------------------+------------------------------------+
                                   | Trait Interfaces
                                   v
+----------------------------------+------------------------------------+
|                        Subsystem Drivers                              |
|  - Portable-PTY (OS Shells)                                           |
|  - Reqwest/Hyper (LLM APIs)                                           |
+-----------------------------------------------------------------------+
```

This modularity prevents UI rendering delays from blocking agent execution and ensures that OS-specific PTY quirks do not leak into the core agent logic.

### D2: Asynchronous State & Concurrency Defense
The repository previously suffered from test flakes and race conditions in its shared-process architecture (e.g., issue #6698). 
* **The Flake**: Tests relied on hardcoded sleep durations (e.g., `2s` approval readiness gates) to wait for background processes to initialize. Under heavy CI load, these timeouts expired before the process was ready.
* **The Defense**: Replaced arbitrary sleep gates with explicit, event-driven synchronization primitives. Using `tokio::sync::Notify` or tracking state transitions via atomic flags ensures that tests only proceed when the target process emits a "ready" signal.

### D3: Error Boundaries, Recovery & Rollback Protocols
Tool execution is a frequent source of runtime errors (e.g., edit old-text mismatches, workspace boundary violations).
* **Isolation**: Tool executions run inside a sandboxed context that validates the target path against the workspace root *before* any filesystem modifications occur.
* **Rollback**: If a multi-file edit fails halfway through, the engine utilizes an in-memory transaction log to revert modified files to their original state, preventing partial, broken writes.

### D4: Resource Lifecycle & Leak Defenses
Managing OS resources like PTY file descriptors and terminal states requires strict lifecycle management:
* **PTY Cleanup**: When an agent session terminates, the engine must explicitly send `SIGHUP` or `SIGKILL` to the child process group and close the master/slave file descriptors to prevent zombie processes and file descriptor leaks.
* **Terminal Cursor Leak**: On macOS, the terminal cursor could remain visible even when the input composer was hidden (issue #6545). The TUI must explicitly manage cursor visibility using `crossterm::cursor::Hide` and `Show` commands tied directly to the focus state of the UI components, ensuring the cursor is restored on application exit.

### D5: Boundary Deserialization, Schemas & Input Sanitization
To prevent invalid configurations from corrupting the application state, `Codewhale` enforces strict deserialization boundaries:
* **Config Validation**: The configuration loader parses files into a strongly-typed Rust struct. Any unknown keys or invalid value types trigger a parsing error instead of being silently ignored.
* **Model ID Normalization**: Model identifiers from external APIs are sanitized to strip routing prefixes, ensuring consistent lookup keys for pricing and routing tables.

### D6: Cross-Platform & Runtime Compatibility Gotchas
Operating system differences present significant challenges for terminal-based applications:
* **macOS vs. Linux PTYs**: macOS handles PTY allocation and terminal size propagation differently than Linux. `Codewhale` uses the `portable-pty` crate to abstract these differences, but must manually handle `SIGWINCH` signal forwarding on Unix platforms to ensure correct terminal resizing.
* **Windows Compatibility**: Windows console host (conhost) requires special handling for ANSI escape sequences. The TUI layer detects the terminal type and enables virtual terminal processing on Windows when necessary.

### D7: Build, CI/CD, Deployment & Dependency Invariants
Rust compiler updates can introduce breaking changes, such as stricter lint checks:
* **Unfulfilled Lint Expectations**: In Rust 1.89, the compiler introduced stricter checks for the `#[expect(dead_code)]` attribute (issue #6543). If the expected dead code is actually used or not compiled in a specific profile, the build fails.
* **The Fix**: Clean up unused `#[expect(dead_code)]` attributes and ensure that conditional compilation flags (`#[cfg(...)]`) are correctly aligned with the code they guard.

### D8: Concrete Bug Fixes & Forensic Patches

#### Patch 1: Fixing Idle PTY Liveness & Resize Handling
This patch ensures that idle PTYs remain responsive to resize events by decoupling the read loop from the control loop.

```rust
// Before: Blocked on read, ignoring resize events
pub async fn run_pty_loop(mut reader: Box<dyn Read + Send>, mut resize_rx: mpsc::Receiver<Size>) {
    let mut buf = [0; 1024];
    loop {
        // If reader blocks, we can never process resize_rx!
        if let Ok(n) = reader.read(&mut buf) {
            if n == 0 { break; }
            // process output...
        }
    }
}

// After: Non-blocking select loop preserving liveness
pub async fn run_pty_loop_fixed(
    mut async_reader: tokio::io::ReaderStream<tokio::fs::File>, 
    mut resize_rx: mpsc::Receiver<Size>,
    pty_master: Arc<dyn MasterPty + Send + Sync>
) {
    use tokio_stream::StreamExt;
    loop {
        tokio::select! {
            Some(chunk) = async_reader.next() => {
                match chunk {
                    Ok(bytes) => {
                        // Stream output to subscribers
                        emit_output(bytes);
                    }
                    Err(_) => break,
                }
            }
            Some(size) = resize_rx.recv() => {
                // Safely handle resize even when no data is being read
                let _ = pty_master.resize(PtySize {
                    rows: size.rows,
                    cols: size.cols,
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
        }
    }
}
```

#### Patch 2: Preventing TUI Style Leaks & "Black Holes"
This patch ensures that dynamic widgets explicitly clear their background area to prevent rendering artifacts.

```rust
// Before: Overlapping widgets left dirty cell states
impl Widget for JumpButton {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // Rendered text without clearing the background
        buf.set_string(area.x, area.y, "Jump to Latest", Style::default().fg(Color::Yellow));
    }
}

// After: Explicitly clear background and apply strict boundaries
impl Widget for JumpButton {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // 1. Clear the target area to remove stale styles/characters
        for x in area.left()..area.right() {
            for y in area.top()..area.bottom() {
                buf.get_mut(x, y)
                    .reset()
                    .set_symbol(" ")
                    .set_style(Style::default().bg(Color::Reset));
            }
        }
        
        // 2. Render the widget with explicit styling
        let text = "Jump to Latest";
        let style = Style::default().fg(Color::Yellow).bg(Color::Black);
        buf.set_stringn(area.x, area.y, text, area.width as usize, style);
    }
}
```

---

## 4. Net-New Universal Engineering Rules

## 1. Strict Schema Validation for CLI & Configuration Boundaries

**RULE**:
All configuration inputs, whether loaded from files, environment variables, or CLI arguments, must be validated against a strictly-typed schema at the application boundary. Permissive parsing maps (e.g., untyped JSON/YAML maps) must not be used to store configuration state. Any unknown keys or invalid value types must trigger an immediate execution failure (non-zero exit code) rather than being silently ignored.

**WHY**:
Silent configuration failures (such as typos in keys or values) lead to unpredictable runtime behavior that is extremely difficult to debug. For example, setting `calm_mode flase` instead of `false` might be silently accepted as a custom string key, leaving the actual `calm_mode` flag at its default value without alerting the user.

**WHEN TO APPLY**:
Apply this rule to all CLI parsers, configuration file loaders, and API request deserialization layers in any language or framework.

---

## 2. Explicit Terminal State Restoration in TUI Applications

**RULE**:
Any terminal user interface (TUI) application that modifies terminal states (such as enabling raw mode, hiding the cursor, capturing the mouse, or switching to an alternate screen) must wrap its execution in a panic-safe boundary (e.g., Rust's `catch_unwind` or a robust `Drop` implementation) that guarantees the restoration of the original terminal state upon exit, crash, or focus loss.

**WHY**:
If a TUI application crashes or exits abnormally without restoring the terminal state, the user's shell is left in a broken state (e.g., hidden cursor, disabled echo, or trapped mouse input). This ruins the user experience and requires manual terminal resets.

**WHEN TO APPLY**:
Apply this rule to all interactive terminal applications utilizing libraries like `crossterm`, `termion`, or `ncurses`.

---

## 5. Actionable Agent Skill & Implementation Checklist

### Step-by-Step Verification Checklist for AI Coding Agents

1. **PTY & Shell Management**:
   - [ ] Ensure all PTY read operations are non-blocking and integrated into an asynchronous event loop.
   - [ ] Verify that terminal resize events (`SIGWINCH`) are processed immediately, even when the PTY is idle.
   - [ ] Implement explicit process group termination (`SIGHUP`/`SIGKILL`) to prevent zombie processes when sessions close.

2. **TUI Rendering & State**:
   - [ ] Ensure every custom widget explicitly clears its bounding box before rendering new content.
   - [ ] Verify that cursor visibility is explicitly managed and tied directly to the focus state of input components.
   - [ ] Implement a panic hook that restores the terminal to its original state (shows cursor, disables raw mode) before exiting.

3. **Configuration & Validation**:
   - [ ] Use strongly-typed deserialization (e.g., `serde` with `#[serde(deny_unknown_fields)]`) for all configuration files.
   - [ ] Write unit tests to verify that invalid configuration keys or values trigger parsing errors.

4. **Context & Token Management**:
   - [ ] Implement a multi-stage fallback strategy for context compaction to handle summary failures gracefully.
   - [ ] Ensure all model identifiers are normalized (stripping provider-specific prefixes) before performing pricing or routing lookups.