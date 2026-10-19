> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source**: github ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Source Version**: `c7c266c3`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:59:32.424Z  
> **Learning ID**: `learn-github-t8y2-dbx`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): t8y2/dbx

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Space & Operational Envelope
`t8y2/dbx` is an ultra-compact (~25 MB binary footprint), multi-engine database management environment, developer workspace, and autonomous agent substrate supporting over 100 database engines (RDBMS, NoSQL, TimeSeries, OLAP, Search, Message Queues). It delivers desktop (Tauri 2 / Vue 3 / CodeMirror 6), Docker, headless CLI, and Model Context Protocol (MCP) server operational modes.

The core engineering challenge `dbx` addresses is **heterogeneous protocol virtualization under extreme resource constraints**:
1. Unifying radically divergent driver runtimes—including Rust-native async drivers (`tokio-postgres`, `mysql_async`, `tiberius`), Go-based out-of-process RPC bridges (`vastbase-go`, `iotdb-client-go`), and WebSocket-based native agents (`taosws`/TDengine)—behind a deterministic, zero-leak capability model.
2. Managing document, selection, undo/redo, and viewport state across dynamic multi-tab database query sessions without leaking cross-tab mutations, polluting history, or suffering WebKit/WebView2 scroll drops.
3. Maintaining backward compatibility with deprecated enterprise infrastructure (Windows 7 / Server 2012 R2, legacy ciphers, GaussDB dialect anomalies) without sacrificing zero-cost abstractions or memory safety in modern environments.

```
+--------------------------------------------------------------------------------------------------+
|                                    DBX SYSTEM RUNTIME TOPOLOGY                                    |
+--------------------------------------------------------------------------------------------------+
|  DESKTOP GUI LAYER (Tauri 2 + Vue 3 + CodeMirror 6)                                               |
|  - App.vue (Global Keybind Dispatch, Dialog Focus Arbitration)                                  |
|  - ConnectionTree.vue (Tree Virtualization, Focus Recovery, Dialog State Invariant)              |
|  - QueryEditor.vue / useQueryEditorDocumentState.ts (Isolated Tab State Cache, History Isolation) |
+-------------------------------------------------+------------------------------------------------+
                                                  | IPC / Custom Tauri Commands / Subprocess Stdin
                                                  v
+--------------------------------------------------------------------------------------------------+
|  RUST HOST CORE (dbx-core, dbx-drivers, dbx-mcp, dbx-sql)                                        |
|  - Vendored Runtime Patches (wry Webview2 self-healing, tiberius surrogate sanitization)         |
|  - tokio-postgres-gaussdb (GaussDB / openGauss AST & Protocol Quirks Layer)                     |
|  - Async Connection Pools & Session State Trackers                                               |
+-------------------------------------------------+------------------------------------------------+
                                                  | Stdin/Stdout JSON-RPC 2.0 Streaming Protocol
                                                  v
+--------------------------------------------------------------------------------------------------+
|  OUT-OF-PROCESS DRIVER AGENTS (tdengine, vastbase-go, iotdb-client-go)                            |
|  - AgentSession (Semaphore slots: MAX_AGENT_SESSIONS=256, MAX_CONCURRENT_REQUESTS=64)            |
|  - StructuredError v1 Envelope & CancellationToken Operation Guards                              |
|  - SQL Ast Session-Affinity Scanner (Regex & Tokenizer for Advisory Locks / Temp Tables)         |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 Subsystem Boundaries & Invariant State Ownership
1. **Host-to-Agent IPC Boundary (`agents/drivers/*`)**: Out-of-process database drivers communicate with the Tauri host over stdio via JSON-RPC 2.0 lines. The protocol enforces fixed limits (`MAX_AGENT_SESSIONS = 256`, `MAX_CONCURRENT_REQUESTS = 64`) governed by RAII semaphore permits (`OwnedSemaphorePermit`). Each operation tracks a monotonically incremented `AtomicU64` operation ID married to a Tokio `CancellationToken`. Dropping the `OperationGuard` automatically unregisters active execution.
2. **Editor Virtualization & History Isolation (`useQueryEditorDocumentState.ts`)**: A single CodeMirror 6 instance is reused across arbitrary open query tabs to conserve DOM and layout overhead. Cross-tab state leakage is eliminated via a double-transaction history compartment swap:
   - Outgoing tab state (`EditorState`, scroll offsets, cursor selections) is snapshotted into an LRU cache (`MAX_CACHED_TAB_STATES = 16`).
   - First-activation or cache-evicted tabs undergo a non-history doc update (`Transaction.addToHistory.of(false)`), followed by reconfiguring `historyResetComp` to `[]` and then immediately to `codeMirrorHistory()`. This flushes residual undo trees that survive single-pass reconfigurations.
3. **Session Affinity & Dynamic Connection Routing (`vastbase-go/connection_state.go`)**: Connection pooling for stateful databases requires dynamic affinity detection. If incoming SQL sets session configurations (`SET_CONFIG`), acquires application/advisory locks (`GET_LOCK`, `PG_TRY_ADVISORY_LOCK`), modifies variables (`@var :=`), or creates `#temp` tables, the driver pins the physical backend connection (`sessionAffinity = true`) and bypasses pooling.
4. **Binary Wire-Level & Numeric Precision Invariants (`value.rs`, `utils.go`)**:
   - `f32` serialization explicitly avoids direct widening to `f64` (which introduces dirty binary approximation digits such as `8.6_f32` widening to `8.600000381469727`). Instead, it stringifies at single-precision before parsing to `f64`, ensuring JSON payload stability.
   - Microsecond and nanosecond timestamps preserve fractional precision without trailing zero noise via bounded slice trimming.
   - SQL Server raw surrogate byte pairs are sanitized to Unicode replacement characters (`U+FFFD`) to prevent panic cascades in rendering pipelines.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Reusable Single-Instance Editor Tab Isolation
**RULE**:
When virtualizing multiple editable tabs or documents over a single persistent editor core (e.g., CodeMirror, Monaco), the host system **MUST NOT** perform an in-place text replacement within the existing transaction history. It **MUST** snapshot the outgoing tab's exact state, and on switching to an uncached tab, it **MUST** perform an undo-exempt document replacement followed by a **two-phase compartment cycle** (reconfiguring the history extension to an empty configuration `[]` in Transaction 1, then re-attaching the active history provider in Transaction 2).

**WHY**:
In modern extensible editors (such as CodeMirror 6), a single compartment reconfiguration (`effects: comp.reconfigure(history())`) retains internal state fields if the extension provider retains the same state key. Consequently, if a user switches from Tab A to Tab B and presses `Ctrl+Z`, the undo tree rolls back into Tab A’s text buffer, corrupting Tab B’s buffer with alien tokens and exposing cross-session data. Executing an intermediate transaction with an empty array forces the state field to unmount completely, dropping the previous tab's undo graph.

**WHEN TO APPLY**:
Apply to any multi-tab or virtualized editor environment in web, desktop (Electron/Tauri), or mobile frameworks where editor instances are pooled, recycled, or kept as singletons.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production pattern from apps/desktop/src/components/editor/useQueryEditorDocumentState.ts
import { Transaction, type Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

interface EditorStateRuntime {
  historyResetComp: Compartment;
  codeMirrorHistory: () => any;
}

export function switchEditorDocumentClean(
  view: EditorView,
  runtime: EditorStateRuntime,
  incomingText: string
): void {
  // Phase 1: Swap document content strictly bypassing history tracking
  if (incomingText !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: incomingText },
      annotations: Transaction.addToHistory.of(false),
    });
  }

  // Phase 2: Transaction 1 - Completely eject the history extension state field
  view.dispatch({
    effects: runtime.historyResetComp.reconfigure([]),
  });

  // Phase 3: Transaction 2 - Instantiate an empty, pristine history state tree
  view.dispatch({
    effects: runtime.historyResetComp.reconfigure(runtime.codeMirrorHistory()),
  });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER DO THIS
// Leaks Tab A's undo history into Tab B; single reconfigure retains existing state field.
function unsafeTabSwitch(view: EditorView, runtime: EditorStateRuntime, doc: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
    effects: runtime.historyResetComp.reconfigure(runtime.codeMirrorHistory())
  });
}
```

**VERIFICATION METHOD**:
Verify using automated end-to-end or headless editor tests:
1. Initialize Editor with Document A ("SELECT 1;").
2. Type an edit ("SELECT 10;").
3. Switch tab to Document B ("SELECT 2;").
4. Dispatch `undo(view)`.
5. Assert `view.state.doc.toString() === "SELECT 2;"` and that Document A's contents are not restored.

---

### 2. Multi-Surface Focus Reclamation Guard
**RULE**:
When an overlay, modal dialog, or inline editor in a virtualized tree/list dismisses, it **MUST NOT** unconditionally reclaim focus to the previous anchor or active node. It **MUST** verify two invariants:
1. `document.activeElement` is either null or has fallen back to `document.body` (proving focus was orphaned rather than deliberately captured by a concurrent UI element like an editor or search input).
2. The dismissal was not triggered by a navigation event that spawned an immediate sibling surface (e.g., driver store, tunnel settings, sub-dialogs).

**WHY**:
Unconditional focus restoration causes "focus fighting":
- If an inline rename commits due to an explicit click on an external input (e.g., search box or query editor), an unconditional focus call steals focus back to the row, disrupting keyboard input.
- If closing Dialog A immediately opens Dialog B (such as clicking "Configure Drivers" inside a Connection Error Dialog), delayed focus recovery (e.g., in a microtask or `nextTick`) steals focus from Dialog B’s auto-focused inputs back to the background sidebar tree.

**WHEN TO APPLY**:
Any desktop or rich web client utilizing complex hierarchical navigation, virtual trees, modal stacks, or inline rename inputs.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production pattern from apps/desktop/src/components/sidebar/TreeItem.vue
// and ConnectionTree.vue
import { nextTick, type Ref } from "vue";

export function createFocusReclaimer(
  rowElementRef: Ref<HTMLElement | null>,
  isAnySiblingDialogOpen: () => boolean
) {
  return function restoreFocusSafely(options?: { restoreFocus?: boolean }) {
    if (options?.restoreFocus === false) {
      return;
    }

    void nextTick(() => {
      // Invariant 1: If another dialog opened synchronously, do not steal focus
      if (isAnySiblingDialogOpen()) {
        return;
      }

      // Invariant 2: Only reclaim focus when it fell back to document.body.
      // If the user intentionally clicked or tabbed to an input/editor, leave it alone.
      if (document.activeElement && document.activeElement !== document.body) {
        return;
      }

      // Invariant 3: Focus target must exist and must not force disruptive viewport jumps
      rowElementRef.value?.focus({ preventScroll: true });
    });
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER DO THIS
// Unconditionally grabbing focus breaks Tab navigation, clicks outside, and dialog handoffs.
function unsafeDismiss(rowElement: HTMLElement) {
  closeDialog();
  setTimeout(() => {
    rowElement.focus(); // Steals focus from search box or newly opened modal!
  }, 50);
}
```

**VERIFICATION METHOD**:
Execute Vitest / Playwright suite checking focus transfer:
```typescript
it("keeps focus on the external target when blur commits the action", async () => {
  const outsideInput = document.createElement("input");
  document.body.appendChild(outsideInput);
  outsideInput.focus();
  
  // Trigger blur on inline item
  inlineItemInput.dispatchEvent(new FocusEvent("blur"));
  await nextTick();
  await nextTick();

  expect(document.activeElement).toBe(outsideInput);
});
```

---

### 3. Keyboard Auto-Repeat and In-Flight Execution Race Shield
**RULE**:
All execution-triggering keyboard shortcuts (such as `Mod+Enter` for SQL execution, builds, or network mutations) **MUST** evaluate both `!event.repeat` and `!state.isExecuting` before dispatching. If `event.repeat` is true or an operation is in-flight, the keydown handler **MUST** immediately consume the event via `event.preventDefault()` and `event.stopPropagation()`, return early, and cancel any pending viewport tracking requests.

**WHY**:
When a user holds down `Mod+Enter`, the operating system emits repeated `keydown` events every 30–50ms. If the execution handler does not explicitly check `event.repeat`, or if the async state update for `isExecuting` lags by even a single frame:
1. Multiple duplicate asynchronous execution requests flood the event loop and backend connection pool.
2. The query execution timer in the UI receives overlapping start/stop signals, causing running elapsed counters to freeze or fail to terminate upon query resolution.
3. The backend driver's request capacity semaphore is abruptly exhausted, failing subsequent legitimate operations.

**WHEN TO APPLY**:
Any desktop or web code editor, IDE interface, or command center dispatching long-running asynchronous operations via hotkeys.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production pattern from apps/desktop/src/components/editor/QueryEditor.vue
// and useSqlExecution.ts

export interface ShortcutExecutionGuardOptions {
  isExecuting: () => boolean;
  cancelPendingViewportRequest: (requestId?: number) => void;
}

export function createExecutionShortcutHandler(options: ShortcutExecutionGuardOptions) {
  return function handleExecutionShortcut(event: KeyboardEvent, requestId?: number): boolean {
    const isExecutionKey = event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (!isExecutionKey) {
      return false;
    }

    // Shield 1: Discard OS-level auto-repeat pulses
    // Shield 2: Discard execution requests if a background query is already running
    if (event.repeat || options.isExecuting()) {
      event.preventDefault();
      event.stopPropagation();
      if (requestId !== undefined) {
        options.cancelPendingViewportRequest(requestId);
      }
      return true; // Marked as handled and suppressed
    }

    return false;
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER DO THIS
// Allows auto-repeat to queue dozens of identical queries while one is in progress.
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    runQuery(); // Unbounded dispatch under OS key repetition!
  }
}
```

**VERIFICATION METHOD**:
Unit test utilizing mock `KeyboardEvent` with `repeat: true`:
```typescript
it("suppresses execution shortcuts when event.repeat is true", () => {
  const handler = createExecutionShortcutHandler({
    isExecuting: () => false,
    cancelPendingViewportRequest: vi.fn(),
  });
  const event = new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, repeat: true });
  const preventDefaultSpy = vi.spyOn(event, "preventDefault");

  expect(handler(event)).toBe(true);
  expect(preventDefaultSpy).toHaveBeenCalled();
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: SQL Repeat Shortcut Execution Timer Glitch & Busy Rejection (BUG-EXEC-01)
- **Context**: `apps/desktop/src/App.vue`, `QueryEditor.vue`, `useSqlExecution.ts`
- **What Was Expected**: Holding down `Mod+Enter` should execute the query once. When rows return, the query execution timer must cleanly terminate, displaying exact elapsed milliseconds.
- **What Actually Happened**: Holding the shortcut generated repeated key events. When data sets of $\ge 100$ rows returned, the elapsed timer never disappeared and remained stuck in an active state. Subsequent queries entered a broken UI state (Issue #12696).
- **Evidence in Repo**: Commit `d51b9299`, Issue #12696.
- **Root Cause**: The keydown handlers in `App.vue` and `QueryEditor.vue` did not check `e.repeat` or `activeTab.value.isExecuting`. As long as the key was held, asynchronous execution attempts flooded `useSqlExecution`. While the first query was rendering results, subsequent repeated dispatches collided with the pending execution promise, mutating state flags out-of-order and leaving the timer ticker interval uncleaned.
- **Remediation Code Diff**:
```diff
--- a/apps/desktop/src/App.vue
+++ b/apps/desktop/src/App.vue
@@ -4750,8 +4750,8 @@ async function handleKeydown(e: KeyboardEvent) {
-  if (isExecuteSqlShortcut(e, shortcuts) && defaultQueryShortcutTarget) {
+  if (isExecuteSqlShortcut(e, shortcuts) && defaultQueryShortcutTarget) {
     e.preventDefault();
     e.stopPropagation();
-    void newQuery({ preferredSource: "sidebar", openDefault: true });
+    if (!e.repeat) void newQuery({ preferredSource: "sidebar", openDefault: true });
     return;
   }
   if (activeTab.value?.mode === "query" && isExecuteSqlShortcut(e, shortcuts) && e.target instanceof Element && e.target.closest("[data-query-editor-root]")) {
     e.preventDefault();
     e.stopPropagation();
-    if (!contentAreaRef.value?.shouldBlockQueryEditorExecutionShortcut?.(e)) requestActiveEditorExecute();
+    if (!e.repeat && !activeTab.value.isExecuting && !contentAreaRef.value?.shouldBlockQueryEditorExecutionShortcut?.(e)) requestActiveEditorExecute();
     return;
   }

--- a/apps/desktop/src/composables/useSqlExecution.ts
+++ b/apps/desktop/src/composables/useSqlExecution.ts
@@ -306,6 +307,10 @@ export function useSqlExecution(deps: {
     if (tab.isExecuting) {
       cancelEditorViewportRequest(editorViewportRequestId);
       return notStarted("busy", context.tabId);
     }
```
- **Lesson**: Keyboard shortcut routers must treat OS-level key repeat as a distinct hazard vector, enforcing both `!event.repeat` and asynchronous operation concurrency fences.

---

### Incident 2: Tree Focus Stealing After Surface Handoff & Quick Rename (BUG-UI-02)
- **Context**: `apps/desktop/src/components/sidebar/ConnectionTree.vue`, `TreeItem.vue`, `App.vue`
- **What Was Expected**: Closing a connection dialog or completing an inline node rename should return focus to the tree node *only* if the user has not intentionally navigated to another UI element or opened a chained modal.
- **What Actually Happened**: Clicking "Driver Store" or "Settings" inside the connection dialog closed the dialog and opened the target page, but `setConnectionDialogOpen(false)` unconditionally called `focusSelectedNode()`. This stole focus back from the newly opened page's search inputs. Furthermore, blurring an inline rename input by clicking the query editor caused the rename completion handler to refocus the tree node, stealing focus away from the editor.
- **Evidence in Repo**: Commit `5a183a70`, `TreeItem.connectionRename.spec.ts`.
- **Root Cause**: Focus restoration did not inspect `document.activeElement` to check whether focus had legitimately shifted elsewhere. Furthermore, modal exit transitions did not provide an opt-out mechanism (`restoreFocus: false`) when transitioning to a chained UI surface.
- **Remediation Code Diff**:
```diff
--- a/apps/desktop/src/App.vue
+++ b/apps/desktop/src/App.vue
@@ -3185,7 +3185,11 @@ async function openPendingPluginInstallLinks() {
-function setConnectionDialogOpen(value: boolean) {
+function setConnectionDialogOpen(value: boolean, options?: { restoreFocus?: boolean }) {
   showConnectionDialog.value = value;
   if (!value) {
     connectionDialogPrefill.value = null;
+    if (options?.restoreFocus !== false) void appSidebarRef.value?.focusSelectedNode();
   }
 }

--- a/apps/desktop/src/components/sidebar/TreeItem.vue
+++ b/apps/desktop/src/components/sidebar/TreeItem.vue
@@ -1114,6 +1114,16 @@ const renameInputRef = ref<HTMLInputElement>();
+function restoreRowFocus() {
+  void nextTick(() => {
+    // Only reclaim focus when it is genuinely lost (fell back to <body>).
+    // A blur triggered by the user focusing something else must keep that target focused.
+    if (document.activeElement && document.activeElement !== document.body) return;
+    rowRef.value?.focus({ preventScroll: true });
+  });
+}
```
- **Lesson**: Never reclaim focus without checking whether `document.activeElement` is already set to a non-body target, and allow dialog close dispatchers to explicitly suppress focus restoration.

---

### Incident 3: GaussDB / openGauss Catalog Opclass Join Ordering Failure (BUG-SQL-03)
- **Context**: `crates/dbx-driver-postgres/src/postgres.rs`
- **What Was Expected**: Index queries on PostgreSQL-compatible engines (like Huawei GaussDB and openGauss) should query table and index catalog relations via the compat-tier SQL without syntax errors.
- **What Actually Happened**: Every index listing and schema comparison on GaussDB / openGauss failed immediately with `syntax error at or near "LEFT"` (Issues #12650, #12675).
- **Evidence in Repo**: Commit `45c0ccad`.
- **Root Cause**: The catalog SQL generation placed an inner `LEFT JOIN pg_opclass oc` **after** the `WHERE` clause:
  `... FROM generate_series(...) LEFT JOIN pg_attribute ... WHERE (indkey)[pos.n] >= 0 LEFT JOIN pg_opclass ...`. Standard SQL grammar strictly requires all `JOIN` declarations in a table reference to precede the `WHERE` filter. GaussDB only executes the compat tier (`list_indexes_compat_first`), triggering a syntax error on every call.
- **Remediation Code Diff**:
```diff
--- a/crates/dbx-driver-postgres/src/postgres.rs
+++ b/crates/dbx-driver-postgres/src/postgres.rs
@@ -9724,9 +9724,9 @@ const POSTGRES_INDEXES_COMPAT_SQL: &str = "SELECT i.relname AS index_name, \
                  ON a.attrelid = t.oid \
                 AND a.attnum = (string_to_array(ix.indkey::text, ' '))[pos.n]::int2 \
                 AND a.attnum > 0 \
-               WHERE (string_to_array(ix.indkey::text, ' '))[pos.n]::int2 >= 0 \
                LEFT JOIN pg_opclass oc \
                  ON oc.oid = (string_to_array(ix.indclass::text, ' '))[pos.n]::oid \
+               WHERE (string_to_array(ix.indkey::text, ' '))[pos.n]::int2 >= 0 \
                ORDER BY pos.n \
              ) AS column_opclasses, \
```
- **Lesson**: Handcrafted catalog queries targeting legacy/compat engines must be tested against live engines or checked by AST SQL validators to prevent syntax errors that modern primary-tier paths hide.

---

### Incident 4: Multi-SELECT Batch Execution Missing LIMIT Clause (BUG-EXEC-04)
- **Context**: Query execution engine, batch splitter (Issue #12660)
- **What Was Expected**: When executing multiple `SELECT` statements at once in a query tab, default limit protections (e.g., `LIMIT 1000`) should apply uniformly across all statements in the batch.
- **What Actually Happened**: The AST rewriting parser applied the configured default LIMIT clause to statements $1 \dots N-1$, but missed the final statement if it terminated without a semicolon or was split as the trailing buffer. The final `SELECT` ran unbounded against tables with millions of rows, locking the connection and causing memory bloat.
- **Evidence in Repo**: Issue #12660 (Priority: P0 Critical).
- **Root Cause**: The statement batch parser used a delimiter-split iteration that treated the final item as an uncompleted expression, bypassing the transformation visitor that appends missing limit clauses.
- **Remediation Invariant**: The query execution planner must run the statement transformer over the entire token stream array, ensuring that *every* query of kind `Select` receives a limit injection regardless of its position in the batch:
```rust
// Architectural invariant enforced in dbx-sql
pub fn apply_default_limit_to_all(statements: &mut [Statement], default_limit: usize) {
    for stmt in statements.iter_mut() {
        if let Statement::Select(ref mut select) = stmt {
            if select.limit.is_none() {
                select.limit = Some(default_limit);
            }
        }
    }
}
```
- **Lesson**: Batch query transformations must be modeled as an exhaustive iteration over parsed statement AST nodes, never relying on text splitting or loop terminal assumptions.

---

### Incident 5: WebKit / WebView2 Viewport Zero-Reset During Tab Deactivation (BUG-VIEW-05)
- **Context**: `apps/desktop/src/components/editor/useQueryEditorDocumentState.ts`
- **What Was Expected**: Switching tabs back and forth should maintain the exact scroll position (`scrollTop`, `scrollLeft`) of each tab's editor.
- **What Actually Happened**: On WebKit and certain WebView2 runtimes, switching away from a tab caused `currentView.scrollDOM.scrollTop` to report `0` during the deactivation lifecycle, overwriting the saved scroll position with zero.
- **Evidence in Repo**: `BEFORE_TAB_SWITCH_EVENT` architecture in `useQueryEditorDocumentState.ts`.
- **Root Cause**: Vue's `<KeepAlive>` and dynamic component swapping unmounts or hides DOM nodes before tab change handlers fire. When an element is detached from the render tree or hidden via `display: none`, WebKit resets layout boxes and reports `scrollTop = 0`.
- **Remediation Code Diff**:
```typescript
// Enforced in useQueryEditorDocumentState.ts:
// Capture scroll position before tab deactivation begins:
function captureEditorStateBeforeTabSwitch(event: Event) {
  const fromTabId = (event as CustomEvent<{ fromTabId?: string }>).detail?.fromTabId;
  if (!view.value || !fromTabId || fromTabId !== props.tabId) return;
  // Capture while the outgoing editor is still visible. Once KeepAlive starts
  // deactivating the surface, WebKit can report a reset scrollTop of zero.
  flushEditorViewport();
  flushEditorSelection();
  emit("editorStateFlushed");
}
```
- **Lesson**: Never measure DOM geometry or scroll offsets during or after component deactivation; capture and lock layout state *prior* to triggering framework lifecycle transitions.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 4.1 Micro-Syntax & Token-Level Precision
1. **Float-to-JSON Serialization Precision**:
   In `agents/drivers/tdengine/src/value.rs`, casting `f32` directly to `f64` before stringifying causes IEEE-754 binary expansion artifacts:
   ```rust
   // WRONG: Direct widening produces "8.600000381469727"
   let wide = value as f64;
   Value::Number(Number::from_f64(wide).unwrap())

   // CORRECT: Format as f32 string first, then parse to finite f64
   fn finite_float_number(value: f32) -> Value {
       let shortest = value.to_string();
       if value.is_finite() {
           let rounded = shortest.parse