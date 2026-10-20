> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/testing-library-dom-testing-library-learnings.md`  
> **Source**: github ([https://github.com/testing-library/dom-testing-library](https://github.com/testing-library/dom-testing-library))  
> **Source Version**: `6049cc0b`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T03:40:45.313Z  
> **Learning ID**: `learn-github-testing-library-dom-testing-library`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): testing-library/dom-testing-library

---

## 1. Executive Forensic Architecture & System Mechanics

`@testing-library/dom` (`dom-testing-library`) is the foundational, framework-agnostic runtime for the entire Testing Library ecosystem (React Testing Library, Vue Testing Library, Svelte Testing Library, Angular Testing Library). Its architectural mission is to decouple test assertions from implementation details (internal component state, class instances, virtual DOM abstractions, private methods) by forcing test harnesses to interact exclusively with the Document Object Model (DOM) through user-centric accessibility trees and semantic contracts.

```
+-----------------------------------------------------------------------------------+
|                        CONSUMING TESTING LIBRARIES                                |
|          @testing-library/react | @testing-library/vue | @testing-library/svelte  |
+-----------------------------------------------------------------------------------+
                                        │
                                        ▼
+-----------------------------------------------------------------------------------+
|                            DOM-TESTING-LIBRARY                                    |
|  +---------------------+  +------------------------+  +------------------------+  |
|  |     Event Engine    |  |     Async Engine       |  |     Query Engine       |  |
|  | (fireEvent, events) |  |   (waitFor, findBy*)   |  | (getBy*, queryBy*, etc)|  |
|  +---------------------+  +------------------------+  +------------------------+  |
|             │                         │                            │              |
|             ▼                         ▼                            ▼              |
|  +---------------------+  +------------------------+  +------------------------+  |
|  | Prototype Mutation  |  | Fake/Real Timer Sync   |  | Accessibility Tree     |  |
|  | & Dispatch Layer    |  | MutationObserver Loop  |  | (aria-query, dom-aapi) |  |
|  +---------------------+  +------------------------+  +------------------------+  |
+-----------------------------------------------------------------------------------+
                                        │
                                        ▼
+-----------------------------------------------------------------------------------+
|                         BROWSER DOM RUNTIME / JSDOM                               |
|        Node / Element / EventTarget / Document / Window / MutationObserver        |
+-----------------------------------------------------------------------------------+
```

### Architectural Subsystem Boundaries

1. **Accessibility & Query Engine (`src/queries/*`, `aria-query`, `dom-accessibility-api`)**:
   Resolves nodes matching accessible roles (`ByRole`), accessible names, form controls (`ByLabelText`), placeholders, and text contents. It maps raw DOM nodes against the W3C Accessible Rich Internet Applications (WAI-ARIA) specifications.
2. **Synthetic Event Simulation Engine (`src/events.js`, `src/event-map.js`)**:
   Provides `fireEvent` and `createEvent`. It bypasses raw JavaScript constructor variance across browser vs. Node/JSDOM contexts, normalizes bubbling/cancellation invariants per event type, and forces DOM input state synchronization by intercepting native HTML property setters.
3. **Asynchronous Reconciliation Engine (`src/wait-for.js`)**:
   Implements adaptive polling over DOM mutation streams (`MutationObserver`) and macro/microtask timers. It bridges the gap between simulated fake clocks (Jest, Sinon, Vitest) and real-world microtask flush cycles while integrating with external framework schedulers (e.g., React's `unstable_advanceTimersWrapper` / `asyncWrapper`).
4. **Diagnostic & Serialization Pipeline (`src/pretty-dom.js`, `src/DOMElementFilter.ts`, `src/get-user-code-frame.js`)**:
   Generates targeted, high-readability DOM element diffs on assertion failure without overflowing terminal buffers. It filters uninformative subtrees (e.g., `<script>`, `<style>`) and isolates failure call stacks from testing framework internals.
5. **Configuration & Global State Pipeline (`src/config.ts`)**:
   Houses the mutable configuration hub holding hooks for test attributes, timeouts, and framework lifecycle hooks (`eventWrapper`, `asyncWrapper`, `unstable_advanceTimersWrapper`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Prototype Property Descriptor Decoupling for Synthetic Value Mutation
**RULE**:
When programmatically mutating a DOM node or object property whose setter has been overridden by a reactive framework (e.g., React, Vue, Angular tracking synthetic input events via internal trackers), you MUST traverse the prototype chain via `Object.getPrototypeOf()` to retrieve and invoke the original prototype property descriptor setter (`HTMLInputElement.prototype`), rather than assigning directly to `element[property]`.

**WHY**:
Frameworks like React patch property descriptors (specifically `value`, `checked`) on the target element instance to intercept user inputs and reconcile virtual DOM state. A direct property assignment (`element.value = "foo"`) merely triggers the framework's internal tracker without changing the underlying DOM state properly, or fails to fire necessary tracker flags when a subsequent `change` or `input` event is dispatched. Bypassing the immediate descriptor ensures the true underlying C++/host-level property mutation executes.

**WHEN TO APPLY**:
Any library, end-to-end framework, testing harness, or browser extension that programmatically changes native DOM element properties (`value`, `checked`, `files`) before dispatching synthetic DOM events (`input`, `change`).

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Complete production pattern from src/events.js
function setNativeValue(element, value) {
  // 1. Check for setter on current instance
  const {set: valueSetter} = Object.getOwnPropertyDescriptor(element, 'value') || {}
  
  // 2. Extract setter from the prototype (e.g., HTMLInputElement.prototype)
  const prototype = Object.getPrototypeOf(element)
  const {set: prototypeValueSetter} = Object.getOwnPropertyDescriptor(prototype, 'value') || {}

  // 3. If instance hijacked the setter, invoke the prototype's raw setter
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value)
  } else if (valueSetter) {
    valueSetter.call(element, value)
  } else {
    throw new Error('The given element does not have a value setter')
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: NEVER mutate properties directly when simulating native input
function naiveSetValue(element, value) {
  // FAILS: React 16+ tracks input value changes via setter wrapping.
  // Direct assignment makes React consider the input "not dirty", swallowing synthetic events!
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
```

**VERIFICATION METHOD**:
Mount an input component in a simulated React test harness that records state updates via `onChange`. Assert that dispatching `fireEvent.change(input, {target: {value: 'abc'}})` triggers the state update handler and updates the rendered DOM node without throwing warnings.

---

### 2. Pre-Execution Termination Guard in Asynchronous Polling Engines
**RULE**:
When implementing an asynchronous polling loop driven by simulated or fake timers (e.g., `jest.advanceTimersByTime()`), you MUST check the loop's `finished` / `timedOut` sentinel flag immediately *after* timer advancement and *before* invoking the worker callback.

**WHY**:
Timer advancement routines (`advanceTimersByTime`) trigger pending macro-tasks synchronously. If the allotted time budget expires inside that advancement window, the timeout handler marks the task complete/rejected. If the polling loop immediately proceeds to invoke the worker callback without verifying the termination condition, the callback executes in an expired, poisoned context. This causes unhandled promise rejections, race conditions, and React `act()` boundary leaks.

**WHEN TO APPLY**:
Any async utility, test runner, wait-condition engine (`waitFor`, `poll`, `retryUntil`), or reconciliation worker operating in an environment supporting fake/virtualized system clocks.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Complete production pattern adapted from src/wait-for.js
async function runPollingLoopWithFakeTimers({
  checkCallback,
  timeoutMs,
  intervalMs,
  advanceTimers,
}) {
  let finished = false
  let timedOut = false

  const timerId = setTimeout(() => {
    timedOut = true
    finished = true
  }, timeoutMs)

  try {
    while (!finished) {
      // Advance virtual clock, flushing queued timers
      advanceTimers(intervalMs)

      // CRITICAL GUARD: Check termination IMMEDIATELY after clock advancement.
      // Clock advancement might have fired the timeout handler synchronously!
      if (finished) {
        break
      }

      // Safe to run callback; clock has not expired
      checkCallback()
    }
  } finally {
    clearTimeout(timerId)
  }

  if (timedOut) {
    throw new Error(`Timed out after ${timeoutMs}ms.`)
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Executing work after timer jump without checking termination
while (!finished) {
  advanceTimers(intervalMs); // Synchronously triggers timeout handler -> finished = true!
  
  // DEFECT: Callback runs even though the operation timed out!
  // Leaks execution outside the async boundary.
  checkCallback(); 

  if (finished) {
    break;
  }
}
```

**VERIFICATION METHOD**:
Configure fake timers with `jest.useFakeTimers()`. Execute a `waitFor` loop where the callback always throws and the timeout is `100ms` with an interval of `50ms`. Assert via an asynchronous tracking spy that when the assertion rejects with a timeout, the callback is NOT invoked after the timeout rejection resolves.

---

### 3. Safe Cross-Realm Environment Variable Parsing
**RULE**:
When parsing environment configuration flags in code that executes across multiple JavaScript execution realms (Node.js CLI, Jest JSDOM runner, Browser bundlers, Edge workers), you MUST NOT use bare `process.env` access or assume `process.env[KEY]` contains valid JSON. You MUST wrap JSON deserialization in a `try/catch` and explicitly assert primitive types (`typeof result === 'boolean'`), defaulting safely without throwing exceptions on malformed input.

**WHY**:
Tooling environments inject stubbed or mock `process` globals into browser bundles (via Webpack, Vite, Rollup, or JSDOM). If an environment variable is defined as an empty string (`""`), a non-JSON string (`"true"` vs `"1"`), or an unparseable object, `JSON.parse(process?.env?.KEY)` throws an uncaught syntax exception. Reverting to host detection must be resilient to partially shimmed host objects where `process` exists but `process.versions` is undefined.

**WHEN TO APPLY**:
Configuration modules, logging layers, and CLI tools targeting isomorphic / cross-realm execution environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Extracted and fortified from src/pretty-dom.js
const shouldHighlight = () => {
  let colors
  try {
    // Defensively access process and parse only if defined
    if (typeof process !== 'undefined' && process?.env?.COLORS !== undefined) {
      colors = JSON.parse(process.env.COLORS)
    }
  } catch {
    // Swallowing JSON parse error is safe here: 
    // malformed env vars must fall back gracefully to environment detection.
  }

  if (typeof colors === 'boolean') {
    return colors
  }

  // Multi-tier defensive host detection
  return (
    typeof process !== 'undefined' &&
    process.versions !== undefined &&
    process.versions.node !== undefined
  )
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Fragile assumption of process presence and JSON formatting
const shouldHighlightBad = () => {
  // THROWS: SyntaxError: Unexpected token in JSON at position 0 if COLORS="true" (without quotes)
  // CRASHES: TypeError if running in browser bundle where process is undefined!
  return JSON.parse(process.env.COLORS) || Boolean(process.versions.node);
}
```

**VERIFICATION METHOD**:
Execute unit tests in 3 states: (1) `process.env.COLORS = ''`, (2) `process.env.COLORS = '{}'`, (3) `delete process.versions.node`. Verify that the function returns deterministic boolean outputs without throwing `SyntaxError` or `TypeError`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Post-Timeout `waitFor` Callback Execution Poisoning Framework Act Boundaries (BUG-WAITFOR-01)
- **Context**: Asynchronous test reconciliation loop in `src/wait-for.js`.
- **What Was Expected**: When `waitFor` times out while running modern fake timers (e.g., `jest.useFakeTimers('modern')`), the execution loop must terminate immediately. No subsequent worker callbacks should execute.
- **What Actually Happened**: The test harness continued executing `checkCallback()` once *after* the timeout had already elapsed. In React testing environments, this extra invocation occurred after the containing `asyncWrapper` / `act()` context had dismantled, triggering severe `Warning: An update to Component inside a test was not wrapped in act(...)` diagnostics and test flakiness.
- **Evidence in Repo**: Commit `9aaf7152`, Issue `#1271`, File: `src/wait-for.js`, Tests: `src/__tests__/wait-for.js`.
- **Root Cause**: In fake timer mode, `jest.advanceTimersByTime(interval)` was executed synchronously within a loop. The advance step caused the internal timeout timer to expire, setting `finished = true`. However, `checkCallback()` was positioned *before* the check on `finished`. Consequently, the loop ran the callback in a timed-out state before checking the sentinel flag.
- **Remediation Code Diff**:
```diff
--- a/src/wait-for.js
+++ b/src/wait-for.js
@@ -81,15 +81,15 @@ function waitFor(
           jest.advanceTimersByTime(interval)
         })
 
+        // Could have timed-out during jest.advanceTimersByTime
+        if (finished) {
+          break
+        }
         // It's really important that checkCallback is run *before* we flush
         // in-flight promises.
         checkCallback()
-
-        if (finished) {
-          break
-        }
       }
     } else {
```
- **Lesson**: Clock advancement in virtualized environments is synchronous. Any termination flag driven by a timer must be evaluated immediately at the boundary where the virtual clock advances.

---

### Incident 2: Host Detection Breakage & Crash Under Non-Boolean Environment Variables (BUG-PRETTYDOM-02)
- **Context**: Pretty-printing DOM nodes on assertion failure in `src/pretty-dom.js`.
- **What Was Expected**: If an environment variable `COLORS` is provided, parse it if it represents a boolean; if invalid or omitted, dynamically detect if running under Node.js (`process.versions.node`) to enable ANSI terminal coloring.
- **What Actually Happened**: PR `#1321` attempted to optimize exception handling in `prettyDom`, but inadvertently broke edge cases where `process.env.COLORS` was undefined, empty, or an object string, resulting in colors being erroneously disabled in Node environments or throwing in environments with incomplete `process` shims. PR `#1325` had to revert and re-architect the fallback.
- **Evidence in Repo**: Commit `fdc12ecf`, Issue `#1321`, Revert PR `#1325`, Files: `src/pretty-dom.js`, `src/__tests__/pretty-dom.js`.
- **Root Cause**: The refactored code relied on `process?.env?.COLORS` truthiness checks and simplified `JSON.parse` logic that misclassified empty strings and non-boolean JSON structures, bypassing the Node environment fallback: `typeof process !== 'undefined' && process.versions !== undefined && process.versions.node !== undefined`.
- **Remediation Code Diff**:
```diff
--- a/src/pretty-dom.js
+++ b/src/pretty-dom.js
@@ -5,20 +5,25 @@
 const shouldHighlight = () => {
+  let colors
   try {
-    const colors = process?.env?.COLORS
-    if (colors) {
-      const b = JSON.parse(colors)
-      if (typeof b === 'boolean') return b
-    }
-  } catch {
-    // Ignore (non-critical) - Make a defaulting choice below.
+    colors = JSON.parse(process?.env?.COLORS)
+  } catch (e) {
+    // If this throws, process?.env?.COLORS wasn't parsable. Since we only
+    // care about `true` or `false`, we can safely ignore the error.
   }
 
-  return !!process?.versions?.node
+  if (typeof colors === 'boolean') {
+    // If `colors` is set explicitly (both `true` and `false`), use that value.
+    return colors
+  } else {
+    // If `colors` is not set, colorize if we're in node.
+    return (
+      typeof process !== 'undefined' &&
+      process.versions !== undefined &&
+      process.versions.node !== undefined
+    )
+  }
 }
```
- **Lesson**: Do not optimize exception handling by collapsing error boundaries if the fallback relies on a precise three-state model (`true`, `false`, `undefined`). Preserve explicit type-checking against primitives.

---

### Incident 3: Semantic Event Interface Incompatibility for Load/Error Handlers (BUG-EVENTS-03)
- **Context**: Event creation dispatch mapping in `src/event-map.js`.
- **What Was Expected**: Firing a `load` or `error` event on target elements like `<img />` or `<script />` should match the DOM Level 3 Events specification and actual browser engine implementation.
- **What Actually Happened**: `eventMap` mapped `load` and `error` to `UIEvent`. When tests dispatched `fireEvent.load(scriptElement)`, the DOM rejected or mishandled the event, because modern browser engines and JSDOM initialize image and script load events as generic `Event` interfaces, not `UIEvent` (which requires a `window` view).
- **Evidence in Repo**: Issue `#498`, PR `#1147`, File: `src/event-map.js`.
- **Root Cause**: Incorrect mapping in `eventMap` assuming all UI-related lifecycle occurrences inherited from `UIEvent`.
- **Remediation Code Diff**:
```diff
--- a/src/event-map.js
+++ b/src/event-map.js
@@ -165,11 +165,13 @@ export const eventMap = {
   // Events
   load: {
-    EventType: 'UIEvent',
+    // load events can be UIEvent or Event depending on what generated them.
+    // But the common targets are <img />, <script /> and window.
+    // Neither of these targets receive a UIEvent
+    EventType: 'Event',
     defaultInit: {bubbles: false, cancelable: false},
   },
   error: {
-    EventType: 'UIEvent',
+    EventType: 'Event',
     defaultInit: {bubbles: false, cancelable: false},
   },
```
- **Lesson**: Synthetic event generators must reflect actual DOM host object dispatch behavior, not speculative hierarchical abstractions. When an event type diverges across targets, choose the specification-compliant common denominator.

---

### Incident 4: Dependency Weight & ESM Transpilation Fragility in Diagnostic Tracing (BUG-DEPS-04)
- **Context**: Terminal diagnostic framing in `src/get-user-code-frame.js`.
- **What Was Expected**: User code frames highlighting assertion sites should display ANSI colored stack traces without bloating browser bundles or requiring massive dependency trees.
- **What Actually Happened**: The `chalk` dependency introduced transitively deep dependency chains, issues with dual CJS/ESM bundling, and breaking upstream changes in compilation targets across Babel and Browserslist in consumer projects.
- **Evidence in Repo**: Commit `225a3e4c`, Issue `#1341`, Files: `package.json`, `src/get-user-code-frame.js`.
- **Root Cause**: `chalk` v4/v5 migration introduced complex ESM constraints and larger footprint in an otherwise lightweight DOM testing utility.
- **Remediation Code Diff**:
```diff
--- a/package.json
+++ b/package.json
@@ -63,3 +63,3 @@
-    "chalk": "^4.1.0",
+    "picocolors": "1.1.1",
--- a/src/get-user-code-frame.js
+++ b/src/get-user-code-frame.js
@@ -1,5 +1,5 @@
 // We try to load node dependencies
-let chalk = null
+let picocolors = null
@@ -11,7 +11,7 @@ try {
-  chalk = nodeRequire.call(module, 'chalk')
+  picocolors = nodeRequire.call(module, 'picocolors')
 } catch {
   // We're in a browser environment
 }
@@ -46,3 +46,3 @@ function getCodeFrame(frame) {
-  return `${chalk.dim(frameLocation)}\n${codeFrame}\n`
+  return `${picocolors.dim(frameLocation)}\n${codeFrame}\n`
```
- **Lesson**: Core test infrastructure libraries must aggressively minimize transitive runtime footprint. Zero-dependency single-file utilities (like `picocolors`) are strictly superior to feature-rich terminal stylers for embedded diagnostic outputs.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Node Type Literal Invariants**: Never compare `nodeType` against raw numbers inline without named constants.
  ```typescript
  // INVARIANT: Use DOM level standard nodeType constants
  const ELEMENT_NODE = 1
  const TEXT_NODE = 3
  const COMMENT_NODE = 8
  const FRAGMENT_NODE = 11

  // PREVENTS: Silent bug where attribute nodes (nodeType 2) or CDATA (nodeType 4) match
  if (child.nodeType === TEXT_NODE && Boolean(child.textContent)) { ... }
  ```
- **Strict Boolean vs. Falsy Coercion**: In query filters, an empty string `""` is a valid text value for empty DOM nodes. Using `if (node.textContent)` treats empty strings as false, swallowing nodes. Check explicitly:
  ```typescript
  // CORRECT: Preserves empty string text nodes if needed
  const textContent = node.textContent ?? ''
  
  // WRONG: Coerces empty string "" to false, corrupting match count
  if (!node.textContent) return null
  ```
- **Custom Element Detection**: Checking `tagName.includes('-')` is necessary but insufficient. Custom elements using the `is` attribute extension must also be accounted for:
  ```typescript
  const isCustomElement = (val: any): boolean => {
    const {tagName} = val
    return Boolean(
      (typeof tagName === 'string' && tagName.includes('-')) ||
        (typeof val.hasAttribute === 'function' && val.hasAttribute('is')),
    )
  }
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Depth Capping in DOM Serialization**: Serializing deep DOM trees to build error diagnostics easily leads to call-stack overflow or out-of-memory errors. The serialization engine enforces an explicit `maxDepth` increment guard:
  ```typescript
  // Production pattern from src/DOMElementFilter.ts
  if (++depth > config.maxDepth) {
    return printElementAsLeaf(type, config) // Returns <element … /> and terminates recursion
  }
  ```
- **MutationObserver Disconnect Invariant**: An active `MutationObserver` holding references to DOM subtrees causes severe memory leaks if not torn down upon promise resolution or rejection:
  ```typescript
  // MUST enforce finally cleanup
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(onMutation)
    observer.observe(container, {subtree: true, childList: true, attributes: true})
    
    function cleanup() {
      observer.disconnect()
      clearTimeout(timeoutId)
    }
    
    // Both resolution paths MUST invoke cleanup
    function onDone(res) { cleanup(); resolve(res); }
    function onError(err) { cleanup(); reject(err); }
  })
  ```

---

### 3. UI & UX Micro-Mechanics
- **Focus Restoration and Event Sequencing**: Dispatching synthetic focus events must honor browser focus invariants. `focus` and `blur` events DO NOT bubble (`bubbles: false`), whereas `focusin` and `focusout` DO bubble (`bubbles: true`):
  ```javascript
  // src/event-map.js Invariant:
  focus: {
    EventType: 'FocusEvent',
    defaultInit: {bubbles: false, cancelable: false, composed: true},
  },
  focusIn: {
    EventType: 'FocusEvent',
    defaultInit: {bubbles: true, cancelable: false, composed: true},
  }
  ```
- **DataTransfer Mocking for jsdom Deficiencies**: JSDOM does not implement the `DataTransfer` interface. Simulating drag-and-drop or paste events requires dynamic object definition on the fly:
  ```javascript
  // Defensively inject DataTransfer properties if absent
  if (typeof window.DataTransfer === 'function') {
    Object.defineProperty(event, dataTransferKey, {
      value: Object.getOwnPropertyNames(dataTransferValue).reduce((acc, prop) => {
        Object.defineProperty(acc, prop, {value: dataTransferValue[prop]})
        return acc
      }, new window.DataTransfer())
    })
  } else {
    Object.defineProperty(event, dataTransferKey, {value: dataTransferValue})
  }
  ```

---

### 4. Backend Concurrency & Memory Safety
- **Expensive Diagnostic Suppression During Assertions**:
  Building user code frames and serializing DOM trees during normal, high-frequency query retries crushes CPU performance. The engine disables expensive error diagnostics during speculative iterations:
  ```typescript
  // src/config.ts
  export function runWithExpensiveErrorDiagnosticsDisabled<T>(callback: () => T): T {
    try {
      config._disableExpensiveErrorDiagnostics = true
      return callback()
    } finally {
      // INVARIANT: Re-enable in finally block to prevent permanent silencing
      config._disableExpensiveErrorDiagnostics = false
    }
  }
  ```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Dynamic Window Extraction from Nodes**: Code running in multi-window environments (e.g., `<iframe />` or popups) cannot use the global `window` object to construct events. The event constructor MUST be pulled from the node's owner document:
  ```javascript
  // src/helpers.js
  export function getWindowFromNode(node) {
    return (
      (node.ownerDocument && node.ownerDocument.defaultView) ||
      node.defaultView ||
      (node.document && node.document.defaultView) ||
      window
    )
  }
  ```
- **Read-Only File Property Workaround**: In HTML `<input type="file" />`, the `files` property is a non-writable getter on the native prototype. Direct assignment (`node.files = [file]`) throws a runtime `TypeError`:
  ```javascript
  // Safe override pattern in src/events.js
  Object.defineProperty(node, 'files', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: files,
  })
  ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Boundary Decoupling**: The library operates strictly against standard DOM Level 3 / WHATWG DOM specifications. It has zero knowledge of JSX, VDOMs, Fiber trees, or component life cycles.
- **Subsystem Orchestration**: High-level queries (`getByRole`) delegate to accessibility calculation tools (`dom-accessibility-api`), which run on top of low-level tree traversal filters, wrapped by async observers (`waitFor`), which wrap event dispatch hooks (`eventWrapper`).
- **State Isolation**: The only mutable state is the centralized configuration object (`src/config.ts`), designed to be cloned or mutated via explicit `configure()` calls.

### Dimension 2: Core Abstractions
- **The Query Matrix**: Every search dimension provides a strict 6-method matrix:
  - `getBy*`: Returns element or throws if 0 or >1 matches.
  - `getAllBy*`: Returns array of elements or throws if 0 matches.
  - `queryBy*`: Returns element or `null` if 0 matches; throws if >1 matches.
  - `queryAllBy*`: Returns array of elements (empty array if 0 matches).
  - `findBy*`: Returns Promise resolving to element; rejects on timeout or >1 matches.
  - `findAllBy*`: Returns Promise resolving to array of elements; rejects on timeout.

### Dimension 3: Error Handling
- **Diagnostic Enrichment**: When a query fails, the error message does not simply state "element not found". It formats the containing DOM hierarchy (via `prettyDOM`), lists ignored elements (`script`, `style`), and displays accessible role suggestions via `aria-query`.
- **Stack Sanitization**: Stack traces remove framework-internal frames (`src/get-user-code-frame.js`), pinpointing the exact line in consumer test code where the query assertion was invoked.

### Dimension 4: Testing
- **Dual-Realm CI Harness**: `jest.config.js` divides the suite into two explicit project runners:
  - `jest.config.dom.js`: Executes inside `jsdom` for browser-simulated tree assertions.
  - `jest.config.node.js`: Executes inside pure Node.js to enforce zero-DOM resilience for utilities, SSR diagnostics, and node-only scripts.

### Dimension 5: Security
- **Untrusted DOM Sanitization**: `escapeHTML` replaces `<` and `>` when generating terminal previews (`src/DOMElementFilter.ts`) to avoid leaking terminal control sequences or misinterpreting raw HTML.
- **Prototype Injection Shielding**: When copying properties during event simulation (`createEvent`), properties are extracted via `Object.getOwnPropertyNames` to avoid inheriting mutated prototype extensions.

### Dimension 6: Performance
- **Zero-Copy Traversal**: Node collection relies on native `childNodes` and tree iterators rather than converting entire DOM subtrees into deep JavaScript object structures.
- **Diagnostic Throttling**: As long as `waitFor` is actively retrying, expensive serialization and code-frame generation are disabled via `_disableExpensiveErrorDiagnostics`.

### Dimension 7: Deployment
- **Bundler Multi-Targeting**: Bundled via Rollup (`kcd-scripts`) producing:
  - CJS (`dist/index.js`) for legacy Node test runners.
  - ESM (`dist/@testing-library/dom.esm.js`) for Vite/modern ESM runners.
  - UMD (`dist/@testing-library/dom.umd.js`) for CDN/vanilla browser environments.
- **Babel Compilers Pinned**: Strict overrides in `package.json` lock `@babel/helper-compilation-targets` and `browserslist` to guarantee deterministic build outputs across CI nodes.

### Dimension 8: Agent Patterns
- **Standardized Tool Contracts**: The query signatures provide an ideal target for autonomous LLM agents: queries are declarative, deterministic, self-describing, and provide actionable remediation errors when they fail (e.g., suggesting the exact accessible role name).

### Dimension 9: Data Flow
- **Bidirectional Event-to-State Propagation**:
  1. Consumer calls `fireEvent.change(input, {target: {value: 'x'}})`
  2. `setNativeValue` circumvents framework getters/setters on target node.
  3. Window-aware event is constructed (`createEvent`).
  4. Wrapped in framework scheduler: `config.eventWrapper(() => node.dispatchEvent(event))`.
  5. Reactive listeners process mutation synchronously.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Framework-Safe Native Input Setter
Bypasses React/Vue synthetic value trackers by invoking the native HTMLInputElement setter via prototype extraction.
```javascript
function setNativeValue(element, value) {
  const {set: valueSetter} = Object.getOwnPropertyDescriptor(element, 'value') || {}
  const prototype = Object.getPrototypeOf(element)
  const {set: prototypeValueSetter} = Object.getOwnPropertyDescriptor(prototype, 'value') || {}
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value)
  } else if (valueSetter) {
    valueSetter.call(element, value)
  }
}
```

### 2. Rule: Clock Advancement Termination Check
You MUST verify the asynchronous polling termination condition immediately following virtual clock advancement and before calling the assertion callback.

### 3. Architecture Principle: User-Centric Accessibility Decoupling
Software verification must interact with systems solely through the surfaces exposed to end-users (visual text, ARIA roles, labels) rather than technical implementation details (component hierarchy, internal hooks, database schema).

### 4. Failure Mode: Virtual Clock Desynchronization
Advancing virtual clocks inside polling loops without immediate sentinel checks results in assertion callbacks executing inside destroyed framework boundaries, yielding unhandled promise rejections and false-positive test results.

### 5. Reusable Skill: Cross-Realm Window Retrieval
When building DOM manipulation utilities, never reference the global `window` directly; extract the window context dynamically from the target node:
```javascript
const elementWindow = (node.ownerDocument && node.ownerDocument.defaultView) || window
```

### 6. Decision: Picocolors Over Chalk
Rejected `chalk` in favor of `picocolors` to eliminate complex ESM-only transpilation chains, reduce package attack surface, and decrease bundle overhead in resource-constrained CI environments.

### 7. Anti-Pattern: Direct Assignment to Read-Only Host Object Properties
Attempting to assign values directly to read-only browser properties (like `input.files = files`) fails with a runtime exception. You must redefine the descriptor via `Object.defineProperty`.

### 8. Verification Method: Dual Jest Project Validation
Configure CI to execute test suites under both JSDOM and pure Node.js environments:
```javascript
// jest.config.js
module.exports = {
  projects: [
    require.resolve('./tests/jest.config.dom.js'),
    require.resolve('./tests/jest.config.node.js'),
  ],
}
```

---

## 7. Actionable Agent Skill & Implementation Checklist

When tasked with generating, maintaining, or refactoring UI testing utilities or DOM manipulation libraries, follow this systematic implementation checklist:

```
[ ] STEP 1: Context Isolation
    [ ] Never use the global `window` or `document`.
    [ ] Resolve owner context via `node.ownerDocument.defaultView || window`.

[ ] STEP 2: Input Simulation Hardening
    [ ] Do not assign `node.value = ...` directly.
    [ ] Invoke `setNativeValue(node, val)` via `Object.getPrototypeOf(node)`.
    [ ] Redefine `files` properties on file inputs via `Object.defineProperty`.

[ ] STEP 3: Synthetic Event Configuration
    [ ] Lookup target event in `eventMap` to ensure correct `EventType` (`Event` vs `UIEvent`).
    [ ] Set `bubbles: false` for `focus`, `blur`, `load`, `error`.
    [ ] Set `bubbles: true` for `focusin`, `focusout`, `click`, `change`, `input`.

[ ] STEP 4: Asynchronous Polling Integrity
    [ ] When testing with fake timers, call `advanceTimers