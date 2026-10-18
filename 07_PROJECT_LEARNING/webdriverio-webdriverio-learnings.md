> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source**: github ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Source Version**: `eebbd1b0`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T07:28:57.699Z  
> **Learning ID**: `learn-github-webdriverio-webdriverio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): webdriverio/webdriverio

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
WebdriverIO is a next-generation browser and mobile automation runtime for Node.js. It abstracts the W3C WebDriver Classic HTTP protocol, the W3C WebDriver BiDi (Bidirectional WebSocket) specification, CDP (Chrome DevTools Protocol), and Appium mobile endpoints into a unified, chainable, cross-browser JavaScript/TypeScript execution environment. It bridges asynchronous remote browser automation engines with heterogeneous test runners (Mocha, Jasmine, Cucumber) and reporting backends (Allure, JUnit, Spec).

### Architectural Boundaries & Subsystems
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             WDIO Testrunner CLI                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Framework Adapters:      @wdio/mocha-framework  │  @wdio/cucumber-framework │
│ Lifecycle / Shims:       @wdio/utils (executeAsync, testFnWrapper, monad)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Core Monad & Element:    webdriverio (Element, Browser, ElementArray)        │
│ Middleware Pipeline:     Implicit Wait, Stale Recovery, Refetch Chaining   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Low-Level Protocols:     webdriver (Classic HTTP RPC)  │  BidiCore (JSON-RPC)│
├─────────────────────────────────────────────────────────────────────────────┤
│ Downstream Endpoints:    W3C ChromeDriver / GeckoDriver / Appium / Browsers │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Protocol Monad & Dispatch Subsystem (`@wdio/utils/monad`, `webdriver`)**: Constructs client objects (`Browser`, `Element`) dynamically using prototype inheritance and command wrapping. It controls command serialization, argument sanitization (`verifyArgsAndStripIfElement`), context binding, and telemetry hook interception (`beforeCommand`, `afterCommand`).
2. **Dynamic Element Resolution Pipeline (`webdriverio/middlewares`, `refetchElement`)**: Implements lazy element evaluation, chainable DOM promises, automated implicit waiting on interaction, and stale element reference auto-refetching across nested frames and multi-tab browsing contexts.
3. **BiDi WebSocket Multiplexing Engine (`webdriver/bidi/core`)**: Maintains persistent full-duplex WebSocket connections for bidirectional protocol frames. It manages in-flight command IDs, handles asynchronous frame parsing, masks sensitive capabilities, tracks connection lifecycle states (`#closed`, `#isConnected`), and converts socket disconnects into clean runtime rejections rather than unhandled process terminations.
4. **Test Framework Formatter & Event Normalizer (`@wdio/cucumber-framework`, `@wdio/mocha-framework`, `@wdio/reporter`)**: Translates framework-specific lifecycle events (Cucumber test case envelopes, Mocha `Runnable` timeouts, Jasmine spec statuses) into normalized WDIO reporter event envelopes (`suite:start`, `test:start`, `test:pending`, `test:pass`, `test:fail`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. WeakMap Error Tagging and Semantic Classification Rule
**RULE**: Systems that handle cascading retries or middleware wrapping MUST tag errors using instance-independent semantic codes or process-local `WeakMap` metadata instead of checking raw `error.message` strings or string matching on class names.

**WHY**: Error message matching (`err.message.includes('timeout')` or matching against selectors) fails when localized, when dynamic selectors include matching phrases (e.g., `button[title*="timeout"]`), or when an inner middleware layer wraps/alters the message. This causes false positives where non-timeout errors trigger retry loops, or stale element errors get masked, leading to exponential timeout amplification ($O(N \cdot T)$).

**WHEN TO APPLY**: In layered middleware pipelines, RPC transports, command-retry wrappers, and selector resolution engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Define unique Symbol or constant error codes
export const TIMER_TIMEOUT = 'WDIO_TIMER_TIMEOUT'
export const ELEMENT_NOT_FOUND_AGAIN = 'WDIO_ELEMENT_NOT_FOUND_AGAIN'

// Process-local WeakMap for memory-safe, non-enumerable error state tagging
const notFoundRegistry = new WeakMap<object, object | boolean>()

export function markWaited(err: unknown): void {
    if (err && typeof err === 'object' && !notFoundRegistry.has(err)) {
        notFoundRegistry.set(err, true)
    }
}

export function wasWaitedFor(err: unknown): boolean {
    return Boolean(err && typeof err === 'object' && notFoundRegistry.has(err))
}

export function hasErrorCode(err: unknown, expectedCode: string): boolean {
    return Boolean(
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === expectedCode
    )
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER inspect error messages to determine control flow or error category
if (err.message.includes('timeout') || err.message === timeoutMsg) {
    // Fails when user selector contains the phrase or driver returns localized string
    retryOperation()
}
```

**VERIFICATION METHOD**: Unit test a failing operation where the payload message explicitly contains the forbidden string (e.g., `Error("custom selector: [data-status='timeout']")`). Assert that `hasErrorCode(err, TIMER_TIMEOUT)` returns `false` and that no retry loop executes.

---

### 2. Functional String Replacement Safety Rule
**RULE**: When mutating strings or error stacks via `.replace(target, replacement)` where the replacement or target contains untrusted runtime inputs (selectors, command arguments, error messages), you MUST pass a replacer callback function `() => replacementString` rather than passing the replacement string directly.

**WHY**: JavaScript's `String.prototype.replace(string|RegExp, string)` interprets special dollar sequences in the replacement argument: `$$` inserts a single `$`, `$&` inserts the matched substring, `$`` inserts the preceding portion, and `$'` inserts the following portion. In DOM automation frameworks where selector syntax frequently contains `$()` or `$$()`, a direct string replacement will corrupt `$$(div)` into `$(div)` or recursively inject matched strings, breaking error reports and stack trace rewrite logic.

**WHEN TO APPLY**: All stack rewriting, dynamic error formatting, template interpolation, and string mutation involving dynamic identifiers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function safePatchMessage(originalText: string, searchTarget: string, newSnippet: string): string {
    // Replacer function guarantees dollar patterns ($$, $&, $1) in newSnippet are preserved literally
    return originalText.replace(searchTarget, () => newSnippet)
}

export function updateErrorStack(err: Error, oldMsg: string, newMsg: string): void {
    if (typeof err.stack === 'string') {
        err.stack = err.stack.replace(oldMsg, () => newMsg)
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct string replacement
const selector = "$$('#button')[0]"
const message = `Element ${selector} failed`
// If newMsg contains '$$', String.replace converts '$$' to '$':
err.stack = err.stack.replace(oldMsg, newMsg) // CORRUPTS selector syntax!
```

**VERIFICATION METHOD**: Execute an assertion testing replacements with patterns containing `$$`, `$&`, `$'`:
```typescript
const out = safePatchMessage("failed on target", "target", "$$(selector)[5]")
assert.strictEqual(out, "failed on $$(selector)[5]")
```

---

### 3. Asynchronous Connection Lifecycle Rejection Boundary Rule
**RULE**: Background event listeners, polling loops, or asynchronous observers communicating over dynamic stateful sockets MUST register defensive catch handlers checking for connection-termination error types (`isSessionEndedError`) and MUST NOT allow connection teardown rejections to bubble to global unhandled exception hooks.

**WHY**: When an automation connection or transport terminates, any commands currently in flight across that channel are rejected. Unattached background listeners (such as network response mockers or viewport mutation observers) have no active caller awaiting their completion. Leaving these unhandled results in Node.js emitting an `unhandledRejection` event, which defaults to crashing the process with exit code 1 during tear-down.

**WHEN TO APPLY**: WebSocket subscribers, protocol stream consumers, background telemetry reporters, and mock request forwarders.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export const SESSION_ENDED_ERROR = 'session ended'

export function isSessionEndedError(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    return err.name === SESSION_ENDED_ERROR || err.name === 'invalid session id'
}

export async function safeBackgroundDispatch(
    bidiClient: { isClosed: boolean },
    action: () => Promise<unknown>
): Promise<void> {
    try {
        await action()
    } catch (err: unknown) {
        if (bidiClient.isClosed || isSessionEndedError(err)) {
            // Normal connection teardown boundary; silently suppress or log at trace level
            return
        }
        // Genuine unhandled runtime failure
        throw err
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Fire-and-forget in event listener without session-closure guards
socket.on('network.requestPaused', async (event) => {
    // If browser closes while this executes, browser.continueRequest rejects
    // and causes Node.js process crash via unhandledRejection
    await browser.continueRequest({ requestId: event.requestId })
})
```

**VERIFICATION METHOD**: Set up a test with a Mock HTTP server, trigger 100 fast concurrent background requests, immediately trigger session destruction (`deleteSession()`), and assert that `process.listenerCount('unhandledRejection')` registers zero unhandled rejections while exiting cleanly with status 0.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Exponential Timeout Cascade on Gone List Items (BUG-WDIO-01)
- **Context**: `packages/webdriverio/src/middlewares.ts`, `packages/webdriverio/src/utils/refetchElement.ts`
- **What Was Expected**: Calling an accessor (`getText()`, `isDisplayed()`) on a stale element in a list (`$$('.items')[n]`) that was removed from the DOM should attempt to refetch the element once up to `waitforTimeout` and fail quickly.
- **What Actually Happened**: The command hung for $(n + 1) \times 2 \times \text{waitforTimeout}$. For index 10 with a 10-second timeout, the operation hung for over 220 seconds.
- **Evidence in Repo**: Commit `6000ffdb`, `799f6b25`, PR #16077, PR #16070.
- **Root Cause**: Two interlocking bugs:
  1. `getElements()` passed a shared descriptor object to the monad of every list item. The monad wrapped functions in place, causing item index $n$ to be wrapped $n + 1$ times with the element error handling middleware.
  2. When refetching a gone element, the middleware previously re-threw the raw `stale element reference` error. Each outer middleware layer caught that stale error and initiated another full `implicitWait` cycle.
- **Remediation Code Diff**:
```typescript
// packages/wdio-utils/src/monad.ts
- export default function WebDriver(options: object, modifier?: Function, propertiesObject: PropertiesObject = {}) {
+ export default function WebDriver(options: object, modifier?: Function, properties: PropertiesObject = {}) {
...
     function unit(this: void, sessionId: string, commandWrapper?: Function) {
+        const propertiesObject: PropertiesObject = { ...properties }
+        delete propertiesObject.scope
...
-        propertiesObject[commandName].value = commandWrapper(commandName, value, propertiesObject)
+        propertiesObject[commandName] = {
+            ...descriptor,
+            value: commandWrapper(commandName, value, propertiesObject),
+            configurable: true
+        }
```
```typescript
// packages/webdriverio/src/middlewares.ts
- const stale = err.name === 'stale element reference' || isStaleElementError(err)
+ const stale = !waitedFor(err) && (err.name === 'stale element reference' || isStaleElementError(err))
  if (stale) {
      try {
          const refetched = await refetchElement(element, commandName)
          element.elementId = refetched.elementId
          return await execute()
      } catch (refetchErr) {
+         if (waitedFor(refetchErr)) {
+             if (refetchErr instanceof Error && notFoundElement(refetchErr) !== undefined) {
+                 nameNotFoundAgain(refetchErr, element, commandName, err)
+             }
+             throw refetchErr
+         }
```
- **Lesson**: Layered middleware wrappers must never modify caller-provided descriptor definitions in place, and recovery logic must distinguish between an initial transient stale state and a terminal "waited-and-not-found" error.

---

### Incident 2: Background BiDi Command Rejections Causing Process Exit 1 (BUG-WDIO-02)
- **Context**: `packages/webdriver/src/bidi/core.ts`, `packages/webdriver/src/command.ts`, `packages/webdriver/src/sessionEnded.ts`
- **What Was Expected**: When `browser.deleteSession()` executes, all active network mocks and context event handlers should gracefully terminate without throwing unhandled promise rejections.
- **What Actually Happened**: Standalone scripts using `browser.mock()` exited with code 1. In-flight BiDi WebSocket frames were rejected when the socket was closed by `deleteSession()`, and background event callbacks had no outer Promise awaiting them to capture the rejection.
- **Evidence in Repo**: Commit `17251edb`, PR #16065, `e2e/standalone/session-end-mock.test.ts`.
- **Root Cause**: `BidiCore` rejected pending commands with generic errors upon `#handleClose()`. Because background listeners were decoupled from the main test runner tick, the unhandled rejection reached Node's top-level process listener.
- **Remediation Code Diff**:
```typescript
// packages/webdriver/src/bidi/core.ts
  #handleClose (code?: number) {
      this._isConnected = false
+     this.#closed = true
      this.#expiredCommands.clear()
      this.#ws = undefined
      this.#rejectPendingCommands(
          `Connection to ${this.#webSocketUrl} closed${typeof code === 'number' ? ` (code ${code})` : ''}`,
+         SESSION_ENDED_ERROR
      )
  }
...
  public sendAsync (params: Omit<CommandData, 'id'>) {
      if (!this.#ws || !this._isConnected) {
          const error = new Error('No connection to WebDriver Bidi was established')
+         if (this.#closed) {
+             error.name = SESSION_ENDED_ERROR
+         }
          throw error
      }
```
- **Lesson**: Transport termination must explicitly stamp rejected promises with a terminal domain name (`SESSION_ENDED_ERROR`) that background observers can check and filter without false-positive process crashes.

---

### Incident 3: BiDi Serializer Data Loss on Async Element Arrays (BUG-WDIO-03)
- **Context**: `packages/webdriverio/src/utils/bidi/value.ts`, `packages/webdriverio/src/commands/browser/execute.ts`
- **What Was Expected**: Executing `await browser.execute((els) => els.length, await $$('.x'))` in a BiDi session should pass the array of element references directly to the browser script.
- **What Actually Happened**: The browser script received an empty array `[]`.
- **Evidence in Repo**: Commit `2aa2f7ce`, Issue #16109, PR #16067.
- **Root Cause**: In WDIO, `$$()` returns an `ElementArray` that subclasses `Array` but overrides `.forEach` to return a `Promise`. The BiDi `LocalValue` serializer used `argument.forEach(...)`, assuming standard synchronous array semantics. Because `forEach` returned a Promise instead of executing synchronously, the serialization completed before elements were appended to the payload.
- **Remediation Code Diff**:
```typescript
// packages/webdriverio/src/utils/bidi/value.ts
  if (argument instanceof Array) {
      const arr: (ReferenceValue | LocalValue)[] = []
-     argument.forEach((value) => {
+     Array.prototype.forEach.call(argument, (value: unknown) => {
          arr.push(LocalValue.getArgument(value))
      })
      return LocalValue.createArrayValue(arr)
  }
```
- **Lesson**: When serializing data structures that may be instances of custom subclasses or array-like duck-typed promises, never rely on instance method polymorphism. Force standard execution using `Array.prototype.method.call(...)`.

---

### Incident 4: Cucumber Allure historyId Mutation in Grouped Random Specs (BUG-WDIO-04)
- **Context**: `packages/wdio-cucumber-framework/src/cucumberFormatter.ts`
- **What Was Expected**: Running Cucumber scenarios with `order: 'random'` and spec grouping should maintain stable Allure `historyId` identifiers for historical test tracking across runs.
- **What Actually Happened**: Scenarios received newly generated `historyId`s depending on the random seed order. Features split across multiple iterations were stamped with dynamic suite UIDs (`<feature id>#2`, `<feature id>#3`), which leaked into the scenario `parent` field and altered its `fullTitle`.
- **Evidence in Repo**: Commit `cb8a867f`, PR #16118, Issue #16068.
- **Root Cause**: The formatter used the dynamic partitioned feature part UID as the `parent` property of the child scenarios, breaking test identity stability.
- **Remediation Code Diff**:
```typescript
// packages/wdio-cucumber-framework/src/cucumberFormatter.ts
- featureUid(uri: string, feature: Feature) {
-     return this.usesSpecGrouping() && this._currentFeatureUid
-         ? this._currentFeatureUid
-         : getFeatureId(uri, feature)
- }
+ featurePartUid(uri: string, feature: Feature) {
+     return this._currentFeatureUid ?? getFeatureId(uri, feature)
+ }
...
  const payload = {
      uid: scenario.id,
      title: this.getTitle(scenario),
-     parent: this.featureUid(doc?.uri as string, doc?.feature as Feature),
+     parent: getFeatureId(doc?.uri as string, doc?.feature as Feature),
      type: 'scenario',
  }
```
- **Lesson**: Reporting hierarchies must decouple physical execution groupings (suites/partitions needed for reporter display order) from canonical entity identity (`historyId`, `parent`).

---

### Incident 5: False Positive Stale Element Reference Bypass in BiDi (BUG-WDIO-05)
- **Context**: `packages/webdriverio/src/scripts/checkVisibility.ts`, `packages/webdriverio/src/scripts/isFocused.ts`
- **What Was Expected**: Calling `isDisplayed()` or `isClickable()` on an element that was re-rendered or removed from the DOM in BiDi should fail with a stale element error and trigger automatic refetching, exactly as it does in Classic.
- **What Actually Happened**: In WebDriver BiDi, executing a script on a removed DOM node did not throw an engine-level stale reference error. The script evaluated against the detached node, causing `isDisplayed()` to return `false`. Consequently, inverse checks such as `waitForDisplayed({ reverse: true })` or `expect(elem).not.toBeDisplayed()` passed erroneously on elements that were actively present on the screen under a new DOM reference.
- **Evidence in Repo**: Commit `1240b599`, PR #16059.
- **Root Cause**: Chrome/Firefox BiDi implementations return detached DOM nodes to `script.callFunction` without raising a W3C StaleElement error. The WDIO execution scripts assumed disconnected nodes would be rejected at the protocol layer.
- **Remediation Code Diff**:
```typescript
// packages/webdriverio/src/scripts/checkVisibility.ts
export default function checkVisibility (elem: HTMLElement, params: CheckVisibilityOptions): boolean | null {
+   if ((typeof elem.isConnected === 'boolean' && !elem.isConnected) || (elem.ownerDocument && elem.ownerDocument !== document)) {
+       throw new Error('stale element reference: element is not attached to the page document')
+   }
    if (typeof elem.checkVisibility === 'function') {
        return elem.checkVisibility(params)
    }
    return null
}
```
- **Lesson**: Do not rely on protocol-level driver invariants when transitioning from HTTP-based RPC to bidirectional protocol sockets; browser DOM evaluation scripts must explicitly validate DOM liveness (`elem.isConnected`).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **`Object.keys()` Array Index Traps**: Never use `Object.keys(ARRAY).includes(element)` to check for membership. In JS, `Object.keys(['a', 'b'])` produces `["0", "1"]`. Commit `40c89b17` resolved a bug where `(EVENTHANDLER_FUNCTIONS as readonly string[]).includes(commandName)` was mistakenly written as `Object.keys(EVENTHANDLER_FUNCTIONS).includes(commandName)`. This caused command wrappers to misidentify `emit`, `on`, and `off` as regular automation commands and attach async hooks to event listeners.
- **Dollar Replacement Tokens**: When updating stack traces with dynamic test titles:
  ```typescript
  // INVARIANT: Always use lambda replacer
  err.stack = stack.replace(message, () => err.message)
  ```
  Passing a raw string like `stack.replace(message, err.message)` causes any selector containing `$` or `$$` to be treated as special replacement tokens (`$$` -> `$`).

### 2. Infinite Loop & Recursion Guards
- **Middleware Stale Recovery Circuit Breakers**:
  ```typescript
  const stale = !waitedFor(err) && (err.name === 'stale element reference' || isStaleElementError(err))
  ```
  An element refetch chain can cause infinite recursion if refetching encounters another stale reference. Marking the error via `recordNotFound(err, element)` guarantees that an inner implicit wait failure breaks the middleware loop immediately.
- **BiDi Command Timeouts**: `BidiCore` enforces strict promise termination using double timers:
  ```typescript
  const t = setTimeout(() => {
      /* reject with timeout */
  }, DEFAULT_RESPONSE_TIMEOUT)
  const scriptTimer = setTimeout(() => {
      /* reject with script timeout */
  }, userScriptTimeout)
  ```
  Both timers are cleared synchronously in the response dispatcher.

### 3. UI & UX Micro-Mechanics
- **`Element.checkVisibility` vs Legacy Polyfill**:
  Checking visibility via style properties (`display === 'none'`) triggers layout reflows and fails on CSS container queries, subgrid clipping, and Shadow DOM boundaries. WDIO standardizes on `elem.checkVisibility()` natively, falling back to legacy scripts only when undefined in older browser engines.
- **Iframe Document Offset Transformation**:
  When capturing full-page screenshots containing nested frames, top-level viewport coordinates cannot be used directly. WDIO recursively calculates offsets via `frameOffset()`:
  ```typescript
  const rect = document.documentElement.getBoundingClientRect()
  return { x: rect.x + offset.x, y: rect.y + offset.y, width: rect.width, height: rect.height }
  ```

### 4. Backend Concurrency & Memory Safety
- **Descriptor Object Leaks**: Passing shared prototype descriptors to multiple client instances attaches wrapper mutations across clients:
  ```typescript
  // INVARIANT: Shallow clone descriptors before mutation per unit
  const propertiesObject: PropertiesObject = { ...properties }
  delete propertiesObject.scope
  ```
- **WeakMap Error Tracking**: Error associations must use `WeakMap<object, unknown>` (`notFound = new WeakMap<object, object | true>()`). Attaching arbitrary metadata directly to error objects can lead to memory leaks or fail if `Object.freeze()` was called on the error object.
- **BiDi Command Garbage Collection**: To prevent unbounded memory growth during long-running test suites, expired command tracking must be explicitly pruned (`this.#expiredCommands.clear()`).

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Null-Prototype Objects**: In argument sanitization routines, never write `arg.constructor.name`. An object instantiated via `Object.create(null)` has no prototype, causing `arg.constructor?.name` to throw an uncaught `TypeError: Cannot read properties of undefined`. Always use safe optional chaining: `arg?.constructor?.name`.
- **Timeout Code Distinction**: Never distinguish timeout failures using error message equality (`e.message === 'timeout'`). Use explicit, non-overlapping error codes (`hasCode(e, TIMER_TIMEOUT)` vs `hasCode(e, WAIT_UNTIL_TIMEOUT)`).

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
WDIO uses a multi-layered monad pattern. `webdriverMonad` initializes the client interface, binding capabilities, command wrappers, and runtime options to a target prototype. The architectural boundary between low-level transports (`webdriver`, `BidiCore`) and high-level interfaces (`WebdriverIO.Browser`, `WebdriverIO.Element`) ensures that protocol-specific mechanics (HTTP endpoints vs WebSocket JSON-RPC IDs) do not leak into consumer commands.

### 2. Core Abstractions
- **`WebdriverIO.Element`**: A first-class citizen representing a lazy remote DOM node reference that encapsulates its own selector, parent chain, and refetch logic.
- **`ElementArray`**: An array subclass that supports asynchronous iterations (`forEach`, `map`) while maintaining its own chainable thenable interface.
- **`BidiCore`**: The transport engine managing bidirectional communication with the browser over WebSocket, handling frame matching and state machines.

### 3. Error Handling
The runtime implements an error propagation hierarchy:
1. Low-level driver errors (HTTP 4xx/5xx or BiDi error payloads).
2. Protocol-level errors (`stale element reference`, `no such element`).
3. Middleware recovery errors (initiating `refetchElement` via `implicitWait`).
4. Normalized reporter errors (`ERR_MOCHA_TIMEOUT`, `ELEMENT_NOT_FOUND_AGAIN`).

### 4. Testing
- **Multi-layer E2E & Smoke Shields**: Headless Chrome, Firefox, and Edge run cross-protocol (Classic vs BiDi) smoke suites (`tests/smoke.runner.js`).
- **Fake Timer Vitest Invariants**: Time-dependent test cases (Mocha timeout shims, Cucumber duration calculation) use `vi.useFakeTimers({ toFake: ['Date'] })` to deterministically verify time boundaries without real clock drift.

### 5. Security
- **Command Parameter Masking**: Commands containing passwords, access keys, or binary blobs are filtered using `maskBidiCommand` and `APPIUM_MASKING_HEADER`.
- **Zero Raw Execution in Shells**: Subprocess orchestration (`startWebDriver`) spawns binaries using structured string arguments without invoking intermediate system shell interpreters (`shell: false`).

### 6. Performance
- **Zero In-Memory Duplicate Buffering**: Screenshots captured over BiDi return raw base64 data streams directly to reporters without intermediate disk serialization unless requested via `saveScreenshot`.
- **Command Wrapping Bypass**: Functions identified as event handlers (`on`, `off`, `emit`) are excluded from command wrapper allocation pipelines to reduce V8 hidden-class thrashing and avoid microtask queue contention.

### 7. Deployment
- **Polyrepo Compilation via Monorepo Tooling**: Uses `pnpm` workspace filters combined with a custom orchestrator (`@wdio/compiler`). Builds compile core packages (`@wdio/logger`, `@wdio/types`, `@wdio/protocols`) before building dependent layers (`webdriver`, `webdriverio`).
- **Oxlint Pre-Pass Architecture**: Utilizes ultra-fast Rust-based linting (`oxlint packages examples tests infra`) prior to full compilation and Vitest execution in CI workflows.

### 8. Agent Patterns
- **Standardized Migration Knowledge Extraction**: Houses structured machine-readable migration skills under `.agents/skills/wdio-v10-migration/SKILL.md` to guide autonomous refactoring agents on API signature shifts.
- **Strict Verification Workflows**: The `.agents/skills/verify-webdriverio/SKILL.md` file enforces specific CLI run lanes (`changed-lanes.ts`) so agents execute only the necessary regression subsets based on touched directories.

### 9. Data Flow
```
User Invocation: $('button').click()
 └──> Monad Command Wrapper (wrapCommand)
       ├──> Emits: beforeCommand
       └──> Element Middleware (invokeElementCommand)
             ├──> Checks Element Validity / Stale State
             ├──> Executes Driver Transport (POST /session/:id/element/:id/click OR BiDi input.performActions)
             │     └──> Success: returns result
             │     └──> Stale Failure: refetchElement() -> repeats call
             └──> Emits: afterCommand (with result or terminal error)
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Transparent BiDi-to-Classic Reporter Compatibility Bridge
```typescript
export async function withScreenshotEvents(
    browser: WebdriverIO.Browser,
    command: 'takeScreenshot' | 'takeElementScreenshot',
    capture: () => Promise<string>,
    elementId?: string
): Promise<string> {
    const event = {
        command,
        method: 'GET',
        endpoint: command === 'takeElementScreenshot'
            ? `/session/:sessionId/element/${elementId}/screenshot`
            : '/session/:sessionId/screenshot',
        body: {}
    }
    browser.emit('command', event)
    try {
        const data = await capture()
        browser.emit('result', { ...event, result: { value: data } })
        return data
    } catch (error) {
        browser.emit('result', { ...event, result: { error } })
        throw error
    }
}
```

### 2. Rule
When designing bidirectional event streams intended to feed downstream legacy plugins, you MUST synthesize legacy transport events (`command`, `result`) if the newer protocol bypasses the classic event bus.

### 3. Architecture Principle
**Decouple Execution Ordering from Reporting Identity**: Logical entities (features, tests, suites) must maintain consistent global unique identifiers regardless of runtime execution strategies (e.g., test shuffling, interleaving, or parallel batching).

### 4. Failure Mode
**Middleware Prototype Mutation Collision**: Mutating function properties or sharing property descriptors across instantiated monads creates an $O(N)$ wrapper leak, resulting in geometric slowdowns during command execution and retry storms.

### 5. Reusable Skill: Sanitizing Object Descriptors in Factory Monads
1. Receive incoming property descriptor bag `propertiesObject`.
2. Perform a shallow clone of the root object descriptor dictionary.
3. Remove runtime-specific transient symbols (`scope`, `__elementOverrides__`).
4. Iterate over enumerable entries; clone the descriptor for each method and write wrapped functions to the *cloned* descriptor.
5. Apply the isolated descriptor map to the target instance via `Object.defineProperties()`.

### 6. Decision: Revert Stale Error Masking in Favor of Semantic Waited Codes
The team rejected masking refetch errors with generic stale errors (#15627) and reverted the behavior (#16077). Instead, they chose to pass the actual lookup error up the stack while annotating it with `ELEMENT_NOT_FOUND_AGAIN`.  
*Rationale*: Masking causes outer middleware layers to assume the element is still in a transient state, re-triggering full `waitforTimeout` delays at every layer of the call stack.

### 7. Anti-Pattern: Relying on Subclass Array Polymorphism for Functional Iteration
```typescript
// NEVER DO THIS in serialization utilities:
function serialize(input: any[]) {
    // If input is an ElementArray or custom Thenable array, .forEach might return a Promise!
    input.forEach((item) => buffer.push(item))
}
```

### 8. Verification Method
Run regression test suites validating that stale list items do not hang tests:
```bash
npx vitest run packages/webdriverio/tests/utils/findElementAgain.test.ts
```
Verify that the number of `refetchElement` calls for `$$('.item')[2]` exactly matches the single lookup made for a direct `$()` query.

---

## 7. Actionable Agent Skill & Implementation Checklist

### Procedural Implementation Checklist for Autonomous Agents
- [ ] **Sanitize Monad Descriptors**: Ensure any factory generating stateful proxy or monad wrappers creates a distinct copy of property descriptors before invoking wrapping functions.
- [ ] **Check Array Iteration Invariants**: Ensure internal serialization engines use `Array.prototype.forEach.call(arr, ...)` instead of `arr.forEach(...)` to prevent bugs with custom async array extensions.
- [ ] **Guard WebSocket Close Events**: When wrapping persistent network connections, tag close-induced rejections with a unique identifier (`SESSION_ENDED_ERROR`) to allow background event loops to terminate cleanly.
- [ ] **Check Error Replacement String Mechanics**: When replacing messages in error stacks, ensure all string replacements use lambda replacers (`.replace(str, () => replacement)`) to prevent `$$` token corruption.
- [ ] **Use Semantic Error Codes