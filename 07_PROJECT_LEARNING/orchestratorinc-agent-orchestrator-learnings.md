> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/orchestratorinc-agent-orchestrator-learnings.md`  
> **Source**: GitHub ([https://github.com/OrchestratorInc/agent-orchestrator](https://github.com/OrchestratorInc/agent-orchestrator))  
> **License**: Apache-2.0  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-10-05T03:41:30.058Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): OrchestratorInc/agent-orchestrator

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 The Core Problem
`agent-orchestrator` (AO) solves the operational chaos of supervising heterogeneous, concurrent, long-lived autonomous coding agents (Codex, Claude Code, Cursor, Copilot CLI, Amp, Auggie, Agy, Cline, Crush) across Git repositories. Single-agent CLI harnesses fail in multi-agent fleet operations due to:
- Workspace collisions across agents sharing the same file tree.
- Loss of session state, credential expiration desynchronization, and silent process drift.
- Desynchronized terminal virtual geometries resulting in malformed shell redraws (e.g., zsh `%` wrapping artifacts).
- Terminal/Chat UI split-brain during model handoff.
- Target ambiguity in embedded browser automation (e.g., popup navigation causing silent action execution on stale tabs).

AO bridges this gap through a three-tier architecture:
1. **Desktop Client (Electron / React / Tailwind / Radix / Lexical / Xterm.js)**: Local operator cockpit managing terminal emulators, diff/file viewers, browser automation viewports, and conversation composers.
2. **Local Engine / Daemon (`ao` written in Go)**: Core orchestrator maintaining Git worktrees per task, managing isolated Unix PTYs/Windows ConPTYs, running embedded HTTP/WebSocket/SSE control planes, injecting agent hooks, and tracking normalized activity state machines.
3. **Cloud Control Plane & Isolated Execution Worker (`ao-cloud` / `ao-worker`)**: High-scale tenant isolation runtime executing headless coding agents inside micro-VM or containerized sandboxes, reconciling webhooks with internal SCM, and multiplexing bi-directional event streams over ticketed WebSocket channels.

```
┌────────────────────────────────────────────────────────────────────────┐
│             Desktop Shell (Electron Host / Preload IPC)                │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │     Xterm Portals      │  │     Chat Workspace (Lexical / SSE)   │  │
│  └───────────┬────────────┘  └──────────────────┬───────────────────┘  │
│  ┌───────────┴────────────┐  ┌──────────────────┴───────────────────┐  │
│  │   Browser View Host    │  │   Workspace Diff & File Workspaces   │  │
│  └───────────┬────────────┘  └──────────────────┬───────────────────┘  │
└──────────────┼──────────────────────────────────┼──────────────────────┘
               │ Loopback HTTP / SSE / WS         │
┌──────────────▼──────────────────────────────────▼──────────────────────┐
│                  Local Daemon Engine (Go / SQLite)                     │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ ConPTY / PTY Subsystem │  │   Session & Activity State Machine   │  │
│  │ (Deferred Startup Grid)│  │   (Normalizer / Lifecycle Fences)    │  │
│  └───────────┬────────────┘  └──────────────────┬───────────────────┘  │
│  ┌───────────┴────────────┐  ┌──────────────────┴───────────────────┐  │
│  │ Git Worktree Isolation │  │ Multi-Agent Hook Dispatch Engine     │  │
│  │ (Safe Exclude / Trust) │  │ (Codex, Claude, Cursor, Copilot...) │  │
│  └────────────────────────┘  └──────────────────┬───────────────────┘  │
└─────────────────────────────────────────────────┼──────────────────────┘
                                                  │ gRPC / Secure WS
┌─────────────────────────────────────────────────▼──────────────────────┐
│           Remote Cloud Sandbox Runtime (ao-cloud / ao-worker)          │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Sandbox Supervisor     │  │ Native Provider Harness Bridges      │  │
│  │ (Worktree Runner / PTY)│  │ (Codex app-server, Claude ACP, etc.) │  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Subsystem Decoupling & Invariant State Contracts

```
[Agent Hook Execution] ──(CLI invocation)──> [AO Hook Subcommand]
                                                     │
                                             (JSON via loopback)
                                                     ▼
[Agent Event Stream] ──(Provider Protocol)──> [Activity State Machine]
                                                     │
                                            (Normalized State)
                                                     ▼
                                        [Session State Invalidation]
                                                     │
                                                (CDC / SSE)
                                                     ▼
                                           [Frontend UI Stores]
```

1. **Agent Lifecycle Normalization**:
   - Each agent adapter implements a strict hook injection strategy (`ports.WorkspaceHookConfig`).
   - Hooks bridge heterogeneous vendor events (e.g., Cline's `TaskStart`, Claude's `SessionStart`, Cursor's `beforeShellExecution`) into uniform domain activity states: `Active`, `Idle`, `WaitingInput`, and `Blocked`.
   - Normalizers must enforce fail-closed or non-blocking semantics per hook type. For instance, Cursor shell execution hooks fail closed (`FailClosed: true`) to enforce approval boundaries, whereas Cline wrappers execute `|| true` to prevent agent stalling if the daemon is terminating.

2. **Terminal State Ownership & The Deferred PTY Contract**:
   - PTY allocation does not initialize the OS subprocess until the front-end layout measures the true viewport grid dimensions (`cols`, `rows`).
   - Early keyboard input is captured in an append-only in-memory ring buffer (up to 64 KB) and replayed immediately upon the first layout-driven resize event.

3. **Session Fencing & Interface Handoff**:
   - Transitioning an agent between Chat UI (structured API/Markdown) and Terminal UI (interactive PTY) requires deterministic fencing.
   - The dying terminal must signal process exit before the supervisor frees the provider's thread writer lock, preventing concurrent writes to the provider's conversation history.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Browser Popup Target Drift & Unsafe Action Fall-Through (BUG-BROWSER-01)
- **Context**: `frontend/src/main/browser-view-host.ts`, `backend/internal/httpd/controllers/browser.go`
- **What Was Expected**: When an agent clicks a link that spawns a popup tab (`t2`), subsequent automation commands directed at the target tab must execute strictly against that tab. If the automation runtime cannot target `t2`, the command must immediately abort without altering state.
- **What Actually Happened**: When target resynchronization failed (`tab-select` on `t2` rejected by `agent-browser`), the host previously caught the error, logged a warning (`accepting drift`), and left the target pointer referencing the previously focused tab (`t1`). The agent's subsequent `click`, `fill`, or `screenshot` executed silently against `t1`—an authenticated, wrong tab—causing silent data corruption and unauthorized mutations.
- **Evidence in Repo**: Commit `6deea9b3`, Issue #4821, PR tests in `browser-view-host.test.ts`.
- **Root Cause**: The automation queue caught `AGENT_BROWSER_COMMAND_FAILED` and resolved the promise as a degraded success, failing open instead of failing closed with a domain-level conflict error.
- **Remediation Code Diff**:
```typescript
// - Previous: Fall through and accept drift
// } catch (resyncError) {
//   if (!isAgentBrowserCommandFailure(resyncError)) throw resyncError;
//   console.warn(`[browser] automation runtime still can't target tab ${tabId} ... accepting drift`);
// }

// + Fixed: Fail closed with typed domain conflict
} catch (resyncError) {
  if (!isAgentBrowserCommandFailure(resyncError)) throw resyncError;
  throw browserError(
    "BROWSER_TARGET_MISMATCH",
    `Browser automation could not target AO tab ${tabId}`,
  );
}
```
- **Lesson**: Automation adapters must fail closed on target ambiguity. A failed target synchronization must never allow subsequent mutations to land on an implicitly retained active pointer.

---

### Incident 2: Early Terminal Spawning & zsh Partial-Line Prompt Wrap (BUG-TERM-02)
- **Context**: `backend/internal/adapters/runtime/conpty/deferred_pty.go`, `host_conpty_darwin.go`, `host_conpty_linux.go`
- **What Was Expected**: Interactive shell terminals must display clean initial prompts regardless of desktop window geometry.
- **What Actually Happened**: Terminals spawned immediately upon tab creation with a hardcoded virtual size of $220 \times 50$. In UI viewports narrower than 220 columns, `zsh` calculated its right-side prompt and partial-line marker (`%`) based on 220 columns. When rendered in a smaller panel (e.g., 80 columns), the line wrapped prematurely, permanently leaving an orphaned `%` marker on line 1 above the real prompt.
- **Evidence in Repo**: Commit `d54d680c`, Issue #6175, replaced stacked PR #6174.
- **Root Cause**: Architectural separation inverted dependency order: the backend process initialized before the frontend DOM rendered and measured the enclosing `<canvas>` / `<xterm>` container.
- **Remediation Code Diff**:
```go
// - Previous: Immediate spawn with static constants
// f, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: 220, Rows: 50})

// + Fixed: Deferred PTY initialization on first explicit Resize event
type deferredPTY struct {
    start       func(cols, rows uint16) (ptyConn, error)
    mu          sync.Mutex
    conn        ptyConn
    pending     []byte
    startedOnce sync.Once
    startedC    chan struct{}
}

func (d *deferredPTY) Resize(cols, rows int) error {
    d.mu.Lock()
    if conn := d.conn; conn != nil {
        d.mu.Unlock()
        return conn.Resize(cols, rows)
    }
    defer d.mu.Unlock()
    conn, err := d.start(uint16(cols), uint16(rows))
    if err != nil {
        d.failed = true
        d.markStarted()
        return err
    }
    d.conn = conn
    if len(d.pending) > 0 {
        _, _ = conn.Write(d.pending)
        d.pending = nil
    }
    d.markStarted()
    return nil
}
```
- **Lesson**: Viewport-dependent subprocesses must defer initialization until the consuming UI measures its true layout boundary, maintaining an in-memory queue for early user input.

---

### Incident 3: Stale Shell Tab Reappearance from Asynchronous Mutation Refetch Races (BUG-TERM-03)
- **Context**: `frontend/src/renderer/hooks/useShellTerminals.ts`
- **What Was Expected**: Closing multiple shell tabs rapidly must immediately and permanently remove them from the UI tab bar.
- **What Actually Happened**: When closing Tab A then Tab B, Tab A's `DELETE` finished first, triggering a TanStack Query cache invalidation. The backend query response was generated before Tab B's `DELETE` had completed processing. Tab B flickered back into existence in the UI, then disappeared once Tab B's request resolved.
- **Evidence in Repo**: Commit `03c2cdc3`, PR #6196.
- **Root Cause**: Optimistic UI mutations invalidated the parent query list on settlement (`onSettled`) without maintaining a tombstone registry for in-flight sibling mutations across refetches.
- **Remediation Code Diff**:
```typescript
// - Previous: Rely purely on react-query optimistic cache update and query invalidation
// onSettled: () => { void queryClient.invalidateQueries({ queryKey }); }

// + Fixed: Synchronous tombstone registry masking in-flight refetches
const closingShellHandles = new Map<string, Set<string>>();

async function fetchListedShellTerminals(hostId?: HostId): Promise<ShellTerminal[]> {
  const { data, error } = await clientForSessionHost(hostId).GET("/api/v1/shell-terminals");
  if (error) throw error;
  const closing = closingShellHandles.get(hostKey(hostId));
  return [
    ...(data?.shellTerminals ?? [])
      .filter((terminal) => !closing?.has(terminal.handleId))
      .map((terminal) => toShellTerminal(terminal, hostId)),
  ];
}
```
- **Lesson**: Server-state invalidations triggered by concurrent mutations must be filtered through a local client-side tombstone filter until the mutation definitively settles.

---

### Incident 4: Multiplexed Stream Citation Corruption and Markdown Link Leaking (BUG-CHAT-04)
- **Context**: `backend/internal/adapters/chatdriver/codexappserver/citations.go`, `markdown.go`
- **What Was Expected**: Codex internal citation markers (`\ue200cite\ue202<id>\ue201`) multiplexed across concurrent thread streams must resolve to clean Markdown links `[1](<url>)` without leaking control tokens or misattributing sources across subagent turns.
- **What Actually Happened**: When delta streams were chunked across network boundaries, a marker split in half (e.g., chunk 1: `\ue200ci`, chunk 2: `te\ue202ref\ue201`) caused the regex parser to miss the marker. Raw private Unicode glyphs streamed to the UI. Furthermore, search results arrived asynchronously; if a delta emitted text before the `itemWebSearch` result completed, links were permanently emitted as broken or blank text.
- **Evidence in Repo**: Commit `b7f64053`, Issue #6231.
- **Root Cause**: Parsing was performed statelessly per stream chunk without an append-only prefix verification accumulator and turn-keyed source lookup.
- **Remediation Code Diff**:
```go
// + Fixed: Prefix-preserving stream buffer with turn-isolated formatting
func (f *citationFormatter) formatEvent(threadID string, ev ports.ChatEvent) (ports.ChatEvent, bool) {
    key := citationMessageKey{threadID: threadID, turnID: ev.ProviderTurnID, itemID: ev.ProviderItemID}
    switch ev.Kind {
    case ports.ChatEventMessageDelta:
        message := f.messages[key]
        if message == nil {
            message = &citationMessage{}
            f.messages[key] = message
        }
        message.raw += ev.Delta
        if !message.pending && !strings.Contains(ev.Delta, citationStart) {
            message.rendered += ev.Delta
            return ev, true
        }
        rendered, pending := f.markdownWithPending(message.raw, threadID, ev.ProviderTurnID, false)
        if !strings.HasPrefix(rendered, message.rendered) {
            // Unfinished marker or late search source: hold delta in buffer
            return ev, false
        }
        ev.Delta = strings.TrimPrefix(rendered, message.rendered)
        message.rendered = rendered
        message.pending = pending
        return ev, ev.Delta != ""
    }
}
```
- **Lesson**: Streaming lexers converting proprietary protocol tokens into standard representations must buffer unresolved spans and only emit monotonic string prefixes.

---

### Incident 5: Subprocess Teardown Hangs on SIGTERM-Ignoring Shells (BUG-CONCURRENCY-05)
- **Context**: `backend/internal/adapters/runtime/conpty/host_conpty_darwin.go`, `host_conpty_linux.go`
- **What Was Expected**: Closing a terminal tab must immediately kill the associated shell process and all child processes within its process group.
- **What Actually Happened**: Terminal closure sent `SIGTERM` followed by a grace period timeout (500ms) before sending `SIGKILL`. Standard interactive shells (`zsh`, `bash`) ignore `SIGTERM` by POSIX design. Every closed tab hung for the full 500ms timeout before terminating, stalling daemon worker pools during bulk tab closures.
- **Evidence in Repo**: Commit `d54d680c`, PR #6213.
- **Root Cause**: The teardown logic treated an interactive PTY session leader like a standard batch daemon process, forgetting that interactive shells require `SIGHUP` to trigger standard hangup termination.
- **Remediation Code Diff**:
```go
// - Previous: SIGTERM followed by timeout then SIGKILL
// pgid := c.cmd.Process.Pid
// _ = syscall.Kill(-pgid, syscall.SIGTERM)
// if !waitForDarwinProcessGroupExit(pgid, darwinPTYCloseGrace) {
//     _ = syscall.Kill(-pgid, syscall.SIGKILL)
// }

// + Fixed: Send SIGHUP first to emulate terminal window death
pgid := c.cmd.Process.Pid
_ = syscall.Kill(-pgid, syscall.SIGHUP)
_ = syscall.Kill(-pgid, syscall.SIGTERM)
if !waitForDarwinProcessGroupExit(pgid, darwinPTYCloseGrace) {
    _ = syscall.Kill(-pgid, syscall.SIGKILL)
}
```
- **Lesson**: Simulating terminal window destruction requires sending `SIGHUP` to the process group leader. Sending only `SIGTERM` blocks until timeout because interactive shells intentionally mask `SIGTERM`.

---

## 3. Microscopic Code-Level Invariants

### 3.1 Micro-Syntax & Token-Level Precision
1. **Explicit String Sanitization in Markdown URLs**:
   ```go
   // citation/markdown.go
   func safeWebURL(raw string) bool {
       for _, r := range raw {
           if unicode.IsSpace(r) || unicode.IsControl(r) || r == '<' || r == '>' || r == '\\' {
               return false
           }
       }
       u, err := url.Parse(raw)
       return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != "" && u.User == nil
   }
   ```
   *Invariant*: Never pass raw provider URLs directly to Markdown renderers. Explicitly verify the URI scheme (`http`/`https` only), verify user-info is nil (preventing `https://user:pass@host` credential leakage), and reject control characters and angle brackets to avoid Markdown link escape exploits.

2. **JSON Extra-Field Preservation via Custom Unmarshaler**:
   ```go
   // autohand/hooks.go
   type autohandHookEntry struct {
       Event       string `json:"event"`
       Command     string `json:"command"`
       Description string `json:"description,omitempty"`
       Enabled     bool   `json:"enabled"`
       Timeout     int    `json:"timeout,omitempty"`
       Extra       map[string]json.RawMessage `json:"-"`
   }
   ```
   *Invariant*: When modifying configuration files owned by third-party developer tools (e.g., Autohand, Claude, Cursor), unmarshaling into a concrete struct strips unknown keys. You MUST unmarshal into an alias type, calculate the set difference against managed keys, retain unmanaged keys in an `Extra` map, and merge them back during serialization.

3. **Display Label Mutation vs. Search Index Corruption**:
   *Defect Trap (Issue #6106)*: Modifying an object's `label` property in-place (e.g., stripping `"Claude "` to shorten UI chip width) mutates the memory reference backing global search combobox indexes. Subsequent keystroke searches fail because users type the full name while the index only contains the modified prefix.
   *Rule*: Never mutate data model identifiers or labels in-place. Apply formatting functions strictly within JSX rendering boundaries or create dedicated display-only projection records.

---

### 3.2 Infinite Loop & Recursion Guards
1. **Promise Chain Memory & Execution Leaks in Queue Serialization**:
   ```typescript
   // browser-view-host.ts
   const queueNativeOperation = <T>(
     session: BrowserSessionEntry,
     operation: () => Promise<T>,
     signal?: AbortSignal,
   ): Promise<T> => {
     const run = async () => {
       throwIfAborted(signal);
       return operation();
     };
     const queued = session.nativeOperationQueue.then(run, run);
     // Chain tail must catch and discard to prevent permanent rejection poisoning
     session.nativeOperationQueue = queued.then(
       () => undefined,
       () => undefined,
     );
     return abortableBrowserResult(queued, signal);
   };
   ```
   *Termination Invariant*: Sequential execution chains mapped to `Promise.then` must ensure that an error in step $N$ does not permanently wedge the queue for step $N+1$. The shared pointer MUST attach a no-op handler (`() => undefined`), while the individual caller receives the unmasked rejection.

2. **Lexical / ContentEditable Caret Restoration Loop**:
   *Mechanics (`ComposerEditor.tsx`)*: Calling `editor.focus()` on click triggers a browser selection change, which in turns fires a focus event, which triggers an autofocus reconciliation effect.
   *Guard*:
   ```typescript
   function focusEditor(editor: LexicalEditor): void {
     editor.focus();
     const root = editor.getRootElement();
     if (root && document.activeElement !== root) {
       root.focus({ preventScroll: true });
     }
   }
   ```
   Prevent focus oscillation by explicitly verifying `document.activeElement !== root` prior to calling DOM `focus()`, and always supply `{ preventScroll: true }` to avoid triggering window-level layout thrashing.

---

### 3.3 UI & UX Micro-Mechanics
1. **Shadow DOM Piercing for Scroll Restoration**:
   ```typescript
   // ReadOnlyFileView.tsx
   const diffsContainer = containerRef.current?.querySelector("diffs-container");
   const line = diffsContainer?.shadowRoot?.querySelector<HTMLElement>(`[data-line="${target.line}"]`);
   if (!line) return;
   line.scrollIntoView({ block: "center" });
   ```
   *Rule*: Web Components encapsulating syntax-highlighted code inside Open Shadow Roots cannot be targeted via standard parent `querySelector`. The parent container must navigate through `element.shadowRoot`, handle null states during async post-render cycles, and issue scroll commands within a `requestAnimationFrame` callback.

2. **macOS Traffic-Light Button Desynchronization Across Zoom Factors**:
   ```typescript
   // window-chrome.ts
   export function syncMacWindowButtons(window: BaseWindow, shell: WebContents): void {
     if (window.isDestroyed() || shell.isDestroyed() || window.isFullScreen()) return;
     const y = Math.max(0, Math.round((MAC_TITLEBAR_HEIGHT * shell.getZoomFactor()) / 2 - MAC_WINDOW_BUTTON_RADIUS));
     const current = window.getWindowButtonPosition();
     if (current?.x === MAC_WINDOW_BUTTON_X && current.y === y) return;
     window.setWindowButtonPosition({ x: MAC_WINDOW_BUTTON_X, y });
   }
   ```
   *Subtlety*: Chromium zoom scales DOM elements via CSS pixel ratios, but macOS native title bar buttons ("traffic lights") are laid out in native AppKit points. When the user presses `Cmd + +`, the web header expands vertically, causing native buttons to become optically misaligned. Electron hosts must listen for `zoom-changed` events and adjust AppKit button positions using `setWindowButtonPosition`.

---

### 3.4 Backend Concurrency & Memory Safety
1. **TOCTOU in Process Group Reaping**:
   ```go
   // host_conpty_linux.go
   procs := linuxFindSessionProcesses(c.leaderPID, c.leaderStartTime)
   if len(procs) > 0 {
       signalValidatedSessionProcs(procs, syscall.SIGHUP)
       signalValidatedSessionProcs(procs, syscall.SIGTERM)
       _ = waitForProcIdentitiesExit(procs, linuxPTYCloseGrace)
   }
   ```
   *Race Condition*: Between discovering PIDs in `/proc` and sending signals, a process can exit and its PID can be recycled by the OS kernel for an unrelated application.
   *Mitigation*: You must read both PID and process start time (`/proc/[pid]/stat` field 22) during enumeration. Prior to dispatching kill signals, re-verify that the PID's current start time matches the recorded start time.

2. **Buffered Channel Deadlocks on Context Cancellation**:
   ```go
   // shellterm/cueready.go
   select {
   case <-ctx.Done():
       return ctx.Err()
   case <-waitCtx.Done():
       if err := ctx.Err(); err != nil {
           return err
       }
   ```
   *Invariant*: When a child context (`waitCtx`) derives from a parent context (`ctx`), the resolution order across concurrent `select` cases is non-deterministic in Go. When `waitCtx.Done()` unblocks, explicitly evaluate `ctx.Err()` to guarantee that if the cancellation originated from the parent context, the parent's error is returned rather than a generic timeout error.

---

### 3.5 Defect & Error Prevention ("Galti Pakadna")
1. **Windows PowerShell Command Hook Quotation Traps**:
   ```go
   // codex/hooks.go
   func shellQuoteHookExecutable(executable string) string {
       if runtime.GOOS == "windows" {
           return `& "` + executable + `"`
       }
       return `'` + strings.ReplaceAll(executable, `'`, `'\"'\"'`) + `'`
   }
   ```
   *Traps*: On Windows, running `powershell.exe -Command "\"C:\Program Files\ao.exe\" hooks codex session-start"` fails silently because PowerShell treats a leading quoted string as a literal string expression, not an executable path. It requires the invocation call operator `& `. Failing to include `& ` prevents activity hooks from firing on Windows.

2. **Database Migration DDL Concurrency Locks**:
   *Incident (PR #6163 Post-Mortem)*: Adding an index to `ao_github_webhook_deliveries` using standard `CREATE INDEX` acquires an `ACCESS EXCLUSIVE` lock on PostgreSQL, queuing and stalling all incoming HTTP webhook deliveries during production deployments.
   *Rule*: All index creation migrations on append-heavy tables MUST use `CREATE INDEX CONCURRENTLY` coupled with Goose/Flyway `-- +goose NO TRANSACTION` annotations to avoid system-wide connection pool starvation.

---

## 4. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
AO decouples system layers cleanly:
- **Port Interfaces (`internal/ports`)**: Defines contracts for `AgentRuntime`, `ChatDriver`, `WorkspaceManager`, and `Storage`. Implementations are strictly forbidden from leaking concrete vendor protocol libraries across port boundaries.
- **Adapter Isolation (`internal/adapters`)**: Every external agent is isolated inside its own package (`codex`, `claudecode`, `cline`, `cursor`, etc.). Each adapter is self-contained: it manages its own binary resolution, hook generation, and config manipulation.
- **Central Normalizer Engine**: Translates vendor-specific events into domain events (`ports.ChatEvent`, `domain.ActivityState`), isolating the frontend and cloud tiers from external API churn.

### Dimension 2: Core Abstractions
```go
// ports/chat.go
type ChatEvent struct {
    Kind                   ChatEventKind
    ProviderConversationID string
    ProviderTurnID         string
    ProviderItemID         string
    ProviderEventID        string
    Delta                  string
    Text                   string
    Err                    error
    TurnState              domain.TurnState
    Account                *ChatAccount
}
```
*Contracts*:
- `ProviderTurnID`: Authoritative idempotency key mapping agent reasoning loops to durable storage turns.
- `Delta`: Monotonic textual increments, guaranteed to contain valid, balanced Markdown representations.
- `TurnState`: Terminal states (`Completed`, `Failed`, `Interrupted`) enforce strict transition barriers; a turn cannot transition from `Completed` to `Failed`.

### Dimension 3: Error Handling
- **Fault Boundaries**: Daemon subsystems run on isolated Go worker loops. A panic or failure in a PTY reader never tears down the HTTP daemon or other active sessions.
- **Fail-Closed Safety**: Critical security domains (e.g., automation browser targeting, Cursor MCP tool approvals) default to hard failure upon ambiguity, requiring explicit user re-authorization.
- **Error Trees**: Adapters map vendor-specific strings (e.g., `"Tab not found"`, `"Context window exceeded"`) into typed, deterministic domain errors (`ports.ErrAgentBinaryNotFound`, `BROWSER_TARGET_MISMATCH`).

### Dimension 4: Testing
- **In-Memory Harness Stubs**: `fakeShellRuntime`, `EventSourceStub`, and fake agent bridges allow deep testing of race conditions without spawning OS processes.
- **Boundary Property Assertions**: Tests enforce layout and coordination invariants (e.g., `MATH.abs(nav.center - header.center) <= 1px` across zoom factors).
- **Time Invariant Mocking**: Vitest timers and Go fake clocks simulate reconnection grace intervals, verifying that background scans do not trigger premature session terminations.

### Dimension 5: Security
- **Strict Webhook & IPC Sanitization**: Electron preload scripts expose only typed, white-listed IPC APIs, blocking arbitrary renderer-to-main channel dispatch.
- **Main-Frame Origin Scoping**: Clipboard read/write permissions for