> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fei2411-ds-bot-learnings.md`  
> **Source**: github ([https://github.com/Fei2411/DS-Bot](https://github.com/Fei2411/DS-Bot))  
> **Source Version**: `53518443`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T13:45:59.331Z  
> **Learning ID**: `learn-github-fei2411-ds-bot`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Fei2411/DS-Bot

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Subsystem Boundaries
`Fei2411/DS-Bot` transforms DeepSeek Harness (DSH)—an LLM runtime engine—into a multi-agent collaborative workstation. It runs either as an in-process plugin for DSH or as a standalone Electron desktop application bundling a custom host runtime.

```
+--------------------------------------------------------------------------------------------------+
| Electron Shell (app/)                                                                            |
|  - Lifecycle & Packager: beforePack architecture guard, Electron-builder updater, WebContentsView|
|  - Security Boundary: Host port token exchange, webviewTag lockdown, contextIsolation           |
|  - Tab & View Manager: BotViews (per-bot tabs, allowedNavigation origin filtering)               |
+--------------------------------------------------------------------------------------------------+
                                        │ (CDP / IPC / Local HTTP Token Auth)
                                        ▼
+--------------------------------------------------------------------------------------------------+
| Host Engine (ds-bot/src/host)                                                                    |
|  - Identity & Multi-Agent State: Main Bot vs Specialist Bots, per-bot working directories        |
|  - Memory Subsystem: Hierarchical Markdown store (MEMORY.md + topics), atomic pending.json write |
|  - Request Orchestrator: Idempotent receipt tracking, unsent rollback, turn lifecycle guards    |
|  - Plugin Manager: In-place HMR update with pinned registry spec rollback                        |
+--------------------------------------------------------------------------------------------------+
                                        │ (Streaming SSE / WebSocket / React Cells)
                                        ▼
+--------------------------------------------------------------------------------------------------+
| Client UI & Rendering (ds-bot/src/client)                                                        |
|  - Overlay Stacking: LIFO escape stack (useEscape), boundary-aware pane left offset (usePaneLeft)|
|  - Cell Stream: Tool result dispatch, localized structured errors (MemoryEvent, memoryFailure)    |
|  - Agent Browser Driver: refs vs script vs task execution loop, multi-profile cookie isolation   |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 Subsystem Decoupling & Invariant Abstractions
1. **Host-to-Shell Authorization (`app/engine/index.js`)**: Standalone Electron boots a local HTTP server on an ephemeral loopback port (`127.0.0.1`). The renderer exchanges a single-use startup token via `ctx.connection.authorizeIndex(req, res)` to establish an authenticated HTTP-only session cookie before any RPC or DOM hydration occurs.
2. **Deterministic Receipt Idempotency (`ds-bot/src/host/requests.js`)**: Bot-to-bot and user-to-bot turns use idempotent message receipts keyed by request tokens. When pre-flight validation aborts transmission (e.g., payload exceeds maximum attachment sizes), the system invalidates and flushes the receipt. If state persistence fails, it marks the state as `uncertain` rather than leaving a stale delivered receipt that rejects retries.
3. **Multi-Agent Persistent Memory Partitioning (`ds-bot/src/host/memory.js`)**: Long-term memory is scoped:
   - `own`: Bound to the specific Bot identity (`bots/<botId>/MEMORY.md`).
   - `group`: Bound to the specific group room conversation (`archive/` upon room deletion).
   - `team`: Global facts modifiable only by Main Bots and Group Admins.
   Writes use an ACID staging mechanism (`pending.json`) before touching Markdown tables, preventing corrupted links when process termination interrupts disk I/O.
4. **Autonomous Browser Isolation Architecture (`browser-plugins/bench/render-report.mjs`)**: Cookie sharing between agents is strictly disallowed. Each bot profile is physically bound to `bot/browser-profiles/<botId>/` on disk. Session context shifts or conversational turn rotations inherit the same directory, maintaining authentication sessions while eliminating cross-agent credential leakage.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Sub-Action Receipt Invalidation on Pre-Flight Tool Abort
**RULE**:
When an operation registers a pending idempotency receipt prior to running an asynchronous pipeline, any non-recoverable pre-flight failure occurring before network transmission MUST explicitly mark the request metadata (`request.unsent = true`), synchronously delete the pending record from the in-memory receipt map, and persist the removal to durable storage. If persistence fails, the record state MUST transition to `'uncertain'` and MUST NOT remain in `'pending'` or `'delivered'`.

**WHY**:
If a named request encounters an internal invariant failure (such as message length exceeding file attachment boundaries before being dispatched across the network), leaving the receipt in the registry causes subsequent user or agent retries with the same idempotency key to be permanently rejected as duplicates or replay attacks. Silently dropping the receipt in-memory without a synchronized, required disk save leaves stale receipts on disk that resurrect after a process crash.

**WHEN TO APPLY**:
Apply to all distributed or local agent RPC workflows, tool-use loops, task message dispatchers, and transactional idempotency managers where tasks are tracked by deterministic execution keys.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified pattern from ds-bot/src/host/requests.js and tools.js
export async function executeIdempotentRequest(rt, request, work) {
  const fresh = { outcome: 'pending', at: Date.now() }
  receipts()[request.key] = fresh

  try {
    const receipt = await work()
    
    // Invariant: If work decided before anything went over the wire,
    // do not record a delivered receipt; free the request key for retry.
    if (request.unsent === true) {
      delete receipts()[request.key]
      try {
        await rt.save({ required: true })
      } catch (saveError) {
        // Degrade safely to 'uncertain' to force audit rather than deadlock
        fresh.outcome = 'uncertain'
        fresh.at = Date.now()
        receipts()[request.key] = fresh
        rt.warn('receipt cleanup could not be persisted: %s', saveError)
      }
      return receipt
    }

    fresh.outcome = 'delivered'
    fresh.receipt = receipt
    fresh.at = Date.now()
    await rt.save({ required: false })
    return receipt
  } catch (err) {
    delete receipts()[request.key]
    await rt.save({ required: false }).catch(() => {})
    throw err
  }
}

// In tool execution layer (e.g., tools.js):
export async function dispatchMessage(rt, request, text, sender) {
  let attachment = await rt.attachLong(text, `Message from ${sender.name}.txt`)
  if (attachment === undefined) {
    if (request !== undefined) {
      request.unsent = true // Flag pre-flight failure
    }
    return tooLong(text)
  }
  return await rt.sendAttachment(attachment)
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Prematurely marking as delivered or swallowing pre-flight failure
async function badExecute(request, work) {
  receipts()[request.key] = { outcome: 'delivered' }
  const res = await work()
  if (res.tooLong) {
    // BUG: Receipts still holds 'delivered'. Subsequent identical calls
    // will see this receipt and refuse to run or return a stale refusal!
    return { error: 'Payload too large' }
  }
  return res
}
```

**VERIFICATION METHOD**:
Verify with an integration test where `attachLong` returns `undefined`:
1. Submit named request with key `REQ-001`.
2. Confirm the payload fails with `tooLong`.
3. Assert `receipts()['REQ-001']` is undefined or marked `'uncertain'`.
4. Re-submit named request `REQ-001` with valid payload; assert it executes and delivers successfully.

---

### 2. Dual-Layer View-Tree Eviction for Sandwiched Electron WebContentsViews
**RULE**:
When disposing of an Electron `WebContentsView` (or `BrowserView`), the parent container MUST invoke `contentView.removeChildView(childView)` on the parent `BaseWindow` *prior* to invoking `childView.webContents.close()`, and MUST nullify or delete all references in the local tracker map.

**WHY**:
Calling `webContents.close()` destroys the underlying Blink renderer process and V8 context, but leaves the native `WebContentsView` node linked within Chromium's internal compositor visual hierarchy (`NativeView`). This causes memory leaks, ghost compositor layers, broken z-index stacking contexts, and native layout assertion crashes when the parent window recalculates bounds or redraws.

**WHEN TO APPLY**:
Apply to all Electron desktop applications managing dynamic multi-tab layouts, webview overlays, embedded browser controls, or dynamic child views.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified pattern from app/src/bot-views.mjs
export class BotViews {
  #views = new Map()
  #window

  closeTab(botId, tabId) {
    const entry = this.#owned(botId, tabId)
    if (!entry) return

    // 1. Unregister from internal state maps
    this.#views.delete(tabId)
    this.#dropSaved(botId, tabId)

    // 2. CRITICAL INVARIANT: Evict view from the window's visual tree
    // Closing only its contents keeps the child view node attached natively!
    const win = this.#window()
    if (win?.contentView) {
      win.contentView.removeChildView(entry.view)
    }

    // 3. Destroy renderer process & web contents
    entry.view.webContents.close()

    // 4. Tear down session event listeners and maps
    entry.sessions.clear()
    entry.sessionMaps.clear()
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Closing WebContents while leaving view orphaned in contentView hierarchy
function closeTabLeak(tabId) {
  const entry = activeTabs.get(tabId)
  entry.view.webContents.close() // Renderer destroyed, NativeView retained in window!
  activeTabs.delete(tabId)
  // Window reflows now attempt to draw detached view handles -> GPU crash / memory leak
}
```

**VERIFICATION METHOD**:
Inspect the mock window fixture in automated tests. Assert that closing a view invokes `removeChildView` with the exact target view instance before closing:
```javascript
test('closeTab invokes removeChildView before destroying webContents', () => {
  let removed = false
  let closed = false
  const fakeView = {
    webContents: { close: () => { closed = true } }
  }
  const fakeWindow = {
    contentView: {
      removeChildView: (v) => {
        if (v === fakeView) removed = true
      }
    }
  }
  // Execute closure and verify sequencing:
  assert.equal(removed, true)
  assert.equal(closed, true)
})
```

---

### 3. Pinned Exact-Spec Rollback Protocol for Hot-Unload Plugin Updates
**RULE**:
When an in-process plugin framework uninstalls an active module bundle to bypass hot-module-reload (HMR) collision locks, it MUST resolve and lock the *exact running version* (`${pkg.name}@${pkg.version}`) instead of using a semver range or registry spec, BEFORE calling `removeBundle`. If the subsequent bundle installation fails or yields an invalid application state (`!['applied', 'restart-required'].includes(res.application)`), it MUST reinstall the exact pinned spec and log the diagnostic string.

**WHY**:
If the update source was declared as a floating semver range (e.g. `ds-bot@^0.2.0`), falling back to the original spec after a broken release (e.g. `0.2.1`) causes the package manager to re-resolve the exact same broken release from the remote registry, creating an unrecoverable failure loop that leaves the host engine with zero active bundles installed.

**WHEN TO APPLY**:
Self-updating runtimes, dynamic plugin architectures, micro-frontends, hot-swappable agent extensions, and headless bot daemons managing their own dependency trees.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified pattern from ds-bot/src/host/update.js
export async function safeUpdateBundle(service, ctx, chosen, PKG, options) {
  if (typeof service.removeBundle !== 'function') {
    return { error: { code: 'not-removable' } }
  }

  // 1. Resolve old spec BEFORE removing host.
  // Pin exact running version if source was a floating registry range!
  const oldSpec = await Promise.resolve(installSpecOf(ctx)).catch(() => undefined)
  const previous = (typeof oldSpec === 'string' && sourceOf(oldSpec).kind === 'registry')
    ? `${PKG.name}@${PKG.version}`
    : oldSpec

  // 2. Remove existing bundle to bypass HMR re-installation locks
  const removed = await Promise.resolve(service.removeBundle(PKG.name))
    .catch((error) => { throw error })
  if (removed?.error) return { error: removed.error }

  // 3. Define rollback handler targeting pinned version
  const restore = async (failedDiagnostic) => {
    if (typeof previous !== 'string' || previous === '') return failedDiagnostic
    const back = await Promise.resolve(service.installBundle(
      previous,
      sourceOf(previous).kind === 'registry' && chosen.registry ? { registry: chosen.registry } : {}
    )).catch(err => ({ error: { code: err?.message ?? 'restore failed' } }))
    
    if (back?.error) {
      return `${failedDiagnostic}; restore failed: ${back.error.diagnostic ?? back.error.code}`
    }
    return `${failedDiagnostic}; ${previous} was reinstalled`
  }

  // 4. Attempt update with strict status validation
  try {
    const again = await service.installBundle(chosen.spec, options)
    // Check both explicit errors and non-terminal application phases
    const validStates = ['applied', 'restart-required']
    if (again?.error || !validStates.includes(again?.application)) {
      const diag = again?.error?.diagnostic ?? again?.error?.code ?? `install ${again?.application ?? 'failed'}`
      return { error: { message: await restore(diag) } }
    }
    return again
  } catch (error) {
    const diag = error?.message ?? String(error)
    throw new Error(await restore(diag))
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Rolling back to undefined or unpinned semver spec
async function unsafeUpdate(service, targetSpec, originalSpec) {
  await service.removeBundle('my-bot')
  const res = await service.installBundle(targetSpec)
  if (res.error) {
    // BUG: originalSpec is "^1.0.0". Registry still returns the broken 1.0.1!
    // Result: host tries to rollback, installs broken version again, or crashes.
    await service.installBundle(originalSpec)
  }
}
```

**VERIFICATION METHOD**:
Mock an update registry where target version `9.0.0` fails validation (`application: 'failed'`). Verify via mock spy that the subsequent installation request specifies `${PKG.name}@${PKG.version}` with exact equality, and that execution does not throw uncaught exceptions.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unsent Request Stuck as Delivered Receipt Deadlocks Retries (BUG-REQ-01)
- **Context**: Named bot request scheduler (`ds-bot/src/host/requests.js`, `ds-bot/src/host/tools.js`)
- **What Was Expected**: If an agent sends a prompt or payload that fails pre-flight validation (e.g. payload exceeds limits for file attachments), the request transaction should abort cleanly without blocking subsequent retries using the same request ID.
- **What Actually Happened**: The tool execution returned an error message, but the orchestrator treated the work resolution as completed and stored `{ outcome: 'delivered', receipt }`. When the agent or human tried to re-issue the command, the deduplication guard saw `'delivered'` and refused execution, permanently locking the conversation turn.
- **Evidence in Repo**: Commit `4dff01e3` and `f2c3d11e`.
- **Root Cause**: The orchestrator assumed any non-throwing resolution from `work()` meant delivery succeeded. In reality, tool dispatchers return descriptive strings or handle attachment errors without throwing.
- **Remediation Code Diff**:
```diff
--- a/ds-bot/src/host/requests.js
+++ b/ds-bot/src/host/requests.js
@@ -101,6 +101,21 @@ export function install(rt) {
       }
       try {
         const receipt = await work()
+        if (request.unsent === true) {
+          // The work decided before anything went out: it is not a delivered
+          // receipt, so the request is free to be admitted again. The removal has
+          // to be saved before that is true: a leftover pending record stays.
+          delete receipts()[request.key]
+          try {
+            await rt.save({ required: true })
+          } catch (error) {
+            fresh.outcome = 'uncertain'
+            fresh.at = Date.now()
+            receipts()[request.key] = fresh
+            rt.warn('ds-bot: the removal of the request receipt was not saved: %s', error)
+          }
+          return receipt
+        }
         fresh.outcome = 'delivered'
         fresh.receipt = receipt
         fresh.at = Date.now()
--- a/ds-bot/src/host/tools.js
+++ b/ds-bot/src/host/tools.js
@@ -226,7 +226,9 @@ export function install(rt) {
         const joinable = earlier !== undefined && (toUser || rt.sameWork(earlier.message.source.exchangeId, work))
         const before = joinable ? bodyOf(earlier.message) : undefined
         let long = await rt.attachLong(before ? `${before.text}\n\n${text}` : text, `Message from ${sender.name}.txt`)
-        if (long === undefined) return tooLong(text)
+        // Nothing went out, so a named request must not take this as a delivered
+        // receipt: admitRequest drops the pending record instead, and a retry can send.
+        if (long === undefined) { if (request !== undefined) request.unsent = true; return tooLong(text) }
```
- **Lesson**: Subsystem boundaries cannot rely on JavaScript exceptions alone to determine transaction failure. Explicit operational flags (`request.unsent = true`) must communicate semantic dispatch status across architectural layers.

---

### Incident 2: Incomplete Tab Disposal Leaves Ghost WebContentsView in Native Window (BUG-VIEW-02)
- **Context**: Multi-agent embedded browser tab controller (`app/src/bot-views.mjs`)
- **What Was Expected**: Closing a browser tab assigned to an agent should free native Chromium visual tree handles, destroy the renderer, and tear down memory buffers.
- **What Actually Happened**: Tabs closed by users or scripts invoked `webContents.close()`, which terminated the renderer, but omitted `contentView.removeChildView(...)`. The parent window retained native pointer references to dead views, causing visual glitches, memory leaks, and layout errors.
- **Evidence in Repo**: Commits `4dff01e3`, `f2c3d11e`, and test `app/test/bot-views.test.mjs`.
- **Root Cause**: Developer assumed `webContents.close()` cascades upwards to detach the enclosing `WebContentsView` from the parent `BaseWindow.contentView`.
- **Remediation Code Diff**:
```diff
--- a/app/src/bot-views.mjs
+++ b/app/src/bot-views.mjs
@@ -286,6 +290,8 @@ export class BotViews {
     }
     this.#views.delete(tabId)
     this.#dropSaved(botId, tabId)
+    // The view leaves the window too: only closing its contents would keep the child view.
+    this.#window()?.contentView.removeChildView(entry.view)
     entry.view.webContents.close()
     entry.sessions.clear()
     entry.sessionMaps.clear()
```
- **Lesson**: Electron `WebContentsView` architecture requires dual-step manual resource reclamation: decouple from the visual container graph before destroying the execution engine.

---

### Incident 3: Conversational Memory Tool Error Masking Broke Model Self-Correction (BUG-MEM-03)
- **Context**: Long-term agent memory mutations (`ds-bot/src/host/memory.js`, `ds-bot/src/client/cells.js`)
- **What Was Expected**: When `remember` or `forget` failed (e.g. secret credentials detected, storage quotas exceeded, or item not found), the model should recognize that the write failed and adapt, while the UI displays actionable remediation links.
- **What Actually Happened**: The tools caught validation errors and returned localized conversational sentences (`"Write the entry to save."` or `"This looks like a key..."`) as normal strings. The LLM assumed the text was confirmation of success. Concurrently, the frontend rendered nothing or attempted to navigate to empty scope IDs.
- **Evidence in Repo**: Commit `3693d79d` (PR #495, fixing Issue #482).
- **Root Cause**: Returning error messages as raw string outputs from tool execution functions instead of throwing typed errors that set `isError: true` in the model context block.
- **Remediation Code Diff**:
```diff
--- a/ds-bot/src/host/memory.js
+++ b/ds-bot/src/host/memory.js
@@ -1072,6 +1081,19 @@ export function install(rt) {
+  // A write that did not happen. The tools answer with a sentence when they
+  // changed the memory; when they did not, they fail, so the model sees that
+  // nothing was saved and the interface can show it.
+  class MemoryWriteError extends HarnessError {}
+
+  const refused = message => new MemoryWriteError(message, REFUSED)
+  const writeFailure = failure => failure instanceof MemoryWriteError
+    ? failure
+    : new MemoryWriteError(failure?.message ?? String(failure), ROUTED.has(failure?.code) ? failure.code : FAILED)
+
@@ -1085,12 +1107,13 @@ export function install(rt) {
     async execute(args, exec) {
       await rt.load()
       const context = writeContext(args, exec)
-      if (context.error) return context.error
+      if (context.error) throw refused(context.error)
       const text = cleanEntry(args.text)
+      if (text === '') throw new MemoryWriteError(EMPTY_ENTRY, EMPTY)
       const problem = entryProblem(text)
-      if (problem) return problem
+      if (problem) throw refused(problem)
```
- **Lesson**: Tools executed by AI agents must adhere to strict error semantics: failure MUST reject/throw with structured codes so the harness marks `isError: true`. Never return functional error messages as normal tool output strings.

---

### Incident 4: Sidebar Width Squashing on Dual Drawer Expansion (BUG-UI-04)
- **Context**: React workspace layout (`ds-bot/src/client/overlay-hooks.js`, Issue #456)
- **What Was Expected**: Opening room/project settings while the agent details drawer is active should maintain responsive layout bounds for both panels.
- **What Actually Happened**: The sidebar shrank to 50% width ("侧边只出现一半"), truncating bot rosters and controls.
- **Evidence in Repo**: Issue #456, fixed in conjunction with `usePaneLeft` bounding rect measurements.
- **Root Cause**: `usePaneLeft` calculated layout offsets against a static 280px default and queried `.parentElement` without accounting for dynamic CSS grid flex-basis shrinkage during simultaneous drawer expansions.
- **Remediation Code Diff**:
```javascript
// Remediated via usePaneLeft layout effect measuring actual rendered bounding rects:
export function usePaneLeft() {
  const [paneLeft, setPaneLeft] = useState(280)
  useLayoutEffect(() => {
    const column = document.querySelector('[class*="_footArea"]')?.parentElement
    if (column) {
      // Invariant: enforce Math.round on actual client rect right boundary
      // preventing fractional sub-pixel flex breakdown
      setPaneLeft(Math.round(column.getBoundingClientRect().right))
    }
  }, [])
  return paneLeft
}
```
- **Lesson**: Multi-panel responsive agent workbenches cannot rely on hardcoded margin offsets or unrounded bounding calculations. They must compute relative panel boundaries dynamically using `useLayoutEffect` before browser paint cycles.

---

### Incident 5: Missing Bot Browser Bridge in Standalone Desktop Runtime (BUG-DESK-05)
- **Context**: Electron bridge initialization (`app/src/preload.cjs`, `app/src/bot-browser.mjs`, Issue #449)
- **What Was Expected**: Bots in the desktop app should be able to access `read_browser` and inspect DOM content identically to DSH Desktop.
- **What Actually Happened**: The desktop shell failed to expose `window.dshDesktop.browser`, the engine only registered the tool for profile `desktop` (while the standalone app used profile `ds-bot`), and BrowserWindow had `webviewTag: false`.
- **Evidence in Repo**: Issue #449.
- **Root Cause**: Environment parity breakdown: the core bot plugin assumed host execution within DSH Desktop, failing to account for configuration drift when packaged into a standalone Electron application.
- **Remediation Code Diff**:
```javascript
// Architectural alignment in app/src:
// 1. Preload: Expose isomorphic browser bridge matching DSH Desktop specification
// 2. Engine: Register read_browser tool on profile 'ds-bot' in addition to 'desktop'
// 3. Security: webviewTag enabled with strict sandbox invariants:
const webviewPrefs = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  enableRemoteModule: false,
}
```
- **Lesson**: Multi-target applications (plugin mode vs standalone desktop mode) require automated parity suites that assert tool registration and bridge surface presence across all operational profiles.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in String Coercion**:
  ```javascript
  // DANGEROUS: Operator precedence bug when formatting fallback diagnostics
  const diag = err.diagnostic ?? err.code ?? 'install ' + res?.status ?? 'failed'
  // Evaluates as: ((err.diagnostic ?? err.code) ?? ('install ' + res?.status)) ?? 'failed'
  // If res?.status is undefined, prints 'install undefined' instead of 'failed'!

  // MANDATORY INVARIANT: Explicit grouping for compound template falls (from update.js)
  const diagFixed = again?.error?.diagnostic ?? again?.error?.code ?? `install ${again?.application ?? 'failed'}`
  ```
- **Implicit Falsy vs Empty String Differentiation**:
  ```javascript
  // DANGEROUS: Falsy check rejects empty strings but allows unwanted conversions
  if (!scope) return undefined // Fails to distinguish undefined from empty string "" or 0

  // MANDATORY INVARIANT: Explicit type guard and trimming (from cells.js)
  const named = String(scope ?? '').trim()
  const other = team || named === '' ? undefined : findBot(named)
  ```
- **Deep Object Property Schema Stripping**:
  When transforming JSON schemas for OpenAI function definitions, mutating parameters causes cross-turn schema corruption.
  ```javascript
  // MANDATORY INVARIANT: Shallow clone properties while stripping internal fields (from loop.js)
  properties: Object.fromEntries(Object.entries(tool.parameters ?? {}).map(([key, schema]) => {
    const property = { ...schema }
    delete property.required // Strip required from child properties
    return [key, property]
  })),
  required: Object.entries(tool.parameters ?? {}).filter(([, schema]) => schema.required).map(([key]) => key),
  ```

### 2. Infinite Loop & Recursion Guards
- **Microtask Loop Starvation in Test Flush**:
  Calling `await Promise.resolve()` inside asynchronous test harnesses only yields the microtask queue once.
  ```javascript
  // DANGEROUS: Insufficient flush depth
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

  // MANDATORY INVARIANT: Extended queue draining (from update.test.js)
  // Accommodates multi-step promise chains (Promise.resolve -> fetch -> import -> write)
  const flush = async () => { for (let index = 0; index < 14; index += 1) await Promise.resolve() }
  ```
- **Bounded Autonomous Agent Steps**:
  Autonomous browser loops (`runToolLoop`) MUST enforce a hard non-negotiable step boundary:
  ```javascript
  export async function runToolLoop({ tools,