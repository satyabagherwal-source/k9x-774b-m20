> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vitest-dev-vitest-learnings.md`  
> **Source**: github ([https://github.com/vitest-dev/vitest](https://github.com/vitest-dev/vitest))  
> **Source Version**: `272296e5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T07:39:45.212Z  
> **Learning ID**: `learn-github-vitest-dev-vitest`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): vitest-dev/vitest

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Vitest resolves the execution, compilation, and evaluation impedance mismatch between modern ESM-first web applications built with Vite and traditional CommonJS/isolated test runners (e.g., legacy Jest). It eliminates duplicate build pipelines by repurposing Vite’s module graph, resolution plugins, and AST transformers directly within test execution worker pools and native browser execution runtimes.

### Architectural Boundaries & Subsystems
```
+---------------------------------------------------------------------------------------+
|                                    CLI / User Core                                     |
+---------------------------------------------------------------------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
                   v                                         v
   +-------------------------------+         +-------------------------------+
   |      Node Worker Runner       |         |     Browser Mode Subsystem    |
   | (Worker Threads / Child Proc) |         | (Playwright / Webdriver / CDP)|
   +---------------+---------------+         +---------------+---------------+
                   |                                         |
                   | Module Runner / Vite Dev Server RPC     | Iframe Orchestrator / WS RPC
                   v                                         v
   +-------------------------------------------------------------------------+
   |                     Vite Server & Transform Engine                      |
   | - ModuleGraph Collector & Resolver                                      |
   | - FS Sandboxing (isFileLoadingAllowed)                                  |
   | - Environment Partitioning (node, jsdom, happy-dom, browser)            |
   +-------------------------------------------------------------------------+
```

1. **Test Orchestration Layer (`packages/vitest`)**: Manages the workspace topology, CLI flags, project-level configurations, module graph extraction, and reporter pipelines (Console, HTML, JUnit). It maintains process-level lifecycle state and distributes spec files across worker pools or browser providers.
2. **Execution Worker Sandbox (`packages/runner`)**: Implements the runner interface executing test suites (`describe`, `it`, `test`). It intercepts unhandled promises via custom microtask queues and enforces execution timeouts.
3. **Expect & Assertion Engine (`packages/expect`)**: A standalone, zero-leak assertion engine built on Jasmine/Jest compatibility layers with custom equality testers, asymmetric matchers, and circular reference-safe deep equality comparisons using dual-stack traversal.
4. **Browser Mode Subsystem (`packages/browser` & `packages/browser-playwright`)**: Manages real headless/headed browser sessions via CDP/Playwright. It splits the browser context into an **Orchestrator** frame (holding master WS RPC, traces, and runner state) and a **Tester** iframe (where test code executes under sandboxed globals with custom import maps).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Cross-Origin Frame Timebase Normalization
**RULE**:
When computing duration or measuring wall-clock deltas across distinct execution browsing contexts (e.g., window vs. iframe, web worker vs. main thread, or host vs. guest runner), you MUST calculate absolute timestamps using `performance.timeOrigin + performance.now()` rather than relying solely on `performance.now()`.

**WHY**:
Each execution context (window, nested iframe, web worker) establishes its own distinct `performance.timeOrigin` upon document creation. `performance.now()` returns milliseconds elapsed *only since that specific context's timeOrigin*. Subtracting a parent context's `performance.now()` timestamp from a child iframe's `performance.now()` produces invalid or negative durations whenever the child iframe is initialized, reloaded, or destroyed after the parent context began.

**WHEN TO APPLY**:
Apply in any multi-frame or multi-agent runtime where latency, execution benchmarks, spans, or traces originate in sub-contexts (iframes, Web Workers, Node.js `worker_threads` with distinct V8 contexts) and are aggregated at an orchestrator layer.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/browser/src/client/orchestrator.ts & tester.ts

// Context A (Orchestrator Window) initiates tracking:
export function recordGlobalTimestamp(): number {
  // Normalize to absolute system-epoch high-resolution millisecond mark
  return performance.timeOrigin + performance.now()
}

// Context B (Tester Iframe) calculates elapsed duration:
export function computeDeltaDuration(normalizedStartMark: number): number {
  const currentNormalizedMark = performance.timeOrigin + performance.now()
  return currentNormalizedMark - normalizedStartMark
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER subtract cross-context performance.now() marks directly
// Context A:
const startTime = performance.now() // e.g., 1054.2ms into Parent

// Context B (Newly spawned iframe):
// In iframe, performance.now() starts at 0.0ms!
// state.durations.prepare = 12.1ms - 1054.2ms = -1042.1ms (Catastrophic Underflow)
state.durations.prepare = performance.now() - startTime
```

**VERIFICATION METHOD**:
Enforce via an automated cross-context duration invariant test:
```typescript
test('cross-context duration invariant holds across delayed frames', async () => {
  const orchestratorOrigin = performance.timeOrigin + performance.now()
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const iframeNow = iframe.contentWindow!.performance.timeOrigin + 
                    iframe.contentWindow!.performance.now()
  const duration = iframeNow - orchestratorOrigin
  
  expect(duration).toBeGreaterThanOrEqual(50)
  expect(Number.isFinite(duration)).toBe(true)
  iframe.remove()
})
```

---

### 2. Disarming Asynchronous Resource Races
**RULE**:
When racing an asynchronous operation against an explicit timeout via `Promise.race()`, you MUST return an explicit cleanup handle (`clear()`) for the underlying timer and execute it in a `finally` block immediately upon resolution or rejection of the race.

**WHY**:
Node.js and modern runtime event loops maintain strong references to active timers scheduled via `setTimeout()`. An uncleaned timer scheduled inside a `Promise.race()` keeps the Node.js event loop alive until the timer expires (e.g., 30–60 seconds), even if the primary operation completes within 5 milliseconds. This causes process hang defects during CLI runs and worker teardowns.

**WHEN TO APPLY**:
Any async utility racing I/O operations, network fetches, visual stability checks, worker pings, or command executions against an abort/timeout deadline.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/browser/src/node/commands/screenshotMatcher/utils.ts

export function asyncTimeout(timeout: number): { promise: Promise<null>; clear: () => void } {
  let timer: NodeJS.Timeout | undefined

  const promise = new Promise<null>((resolve) => {
    if (timeout === 0) {
      resolve(null)
    } else {
      timer = setTimeout(resolve, timeout, null)
    }
  })

  return { 
    promise, 
    clear: () => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    } 
  }
}

// Consumption:
export async function executeWithTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>, 
  timeoutMs: number
): Promise<T | null> {
  if (timeoutMs === 0) {
    return task(new AbortController().signal)
  }

  const abortController = new AbortController()
  const stabilityTimeout = asyncTimeout(timeoutMs)

  try {
    return await Promise.race([
      task(abortController.signal),
      stabilityTimeout.promise.finally(() => abortController.abort()),
    ])
  } finally {
    stabilityTimeout.clear()
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER instantiate naked timeout promises inside Promise.race
async function brokenRace<T>(task: Promise<T>, timeout: number): Promise<T | null> {
  // Timer remains queued in libuv loop for `timeout` ms!
  // If timeout = 30000, process hangs for 30s after test finishes.
  return Promise.race([
    task,
    new Promise<null>((r) => setTimeout(r, timeout, null))
  ])
}
```

**VERIFICATION METHOD**:
Verify that the active event loop handle count returns to zero immediately following execution:
```typescript
import { test, expect } from 'vitest'

test('event loop handles released immediately after race resolution', async () => {
  const handlesBefore = (process as any)._getActiveHandles().length
  await executeWithTimeout(async () => 'fast-resolution', 30_000)
  const handlesAfter = (process as any)._getActiveHandles().length
  expect(handlesAfter).toBe(handlesBefore)
})
```

---

### 3. Graceful Graph Environmental Tolerance on Bail/Cancellation
**RULE**:
Reporting and post-processing collectors querying AST, module dependency graphs, or project execution contexts MUST treat execution environments as optional (`undefined`) and skip un-materialized modules rather than throwing invariant access errors.

**WHY**:
When a test runner aborts execution via `--bail` or uncaught critical faults, only a fraction of the scheduled test suite files are processed by Vite dev server environments. If reporters (such as HTML or JSON generators) assume every planned module successfully instantiated a Vite `DevEnvironment` module graph, reporter crashes mask the actual underlying failure and drop crash diagnostics.

**WHEN TO APPLY**:
Reporters, visualizer graphs, tracing synthesizers, and coverage aggregators operating over aborted, bailed, or cancelled test batches.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/vitest/src/utils/graph.ts

function findModuleGraphEnvironment(
  project: TestProject,
  testFilePath: string,
  viteEnvironment?: string,
): DevEnvironment | undefined {
  if (viteEnvironment) {
    return project.vite.environments[viteEnvironment]
  }
  return project.config.experimental.viteModuleRunner === false
    ? project.vite.environments.__vitest__
    : getTestFileEnvironment(project, testFilePath, project.config.browser.enabled)
}

export function getSharedModuleGraphByEnvironment(
  project: TestProject,
  testModules: TestModule[],
): SharedModuleGraphByProject[string] {
  const collectors: { [environmentName: string]: ModuleGraphCollector } = {}
  
  for (const testModule of testModules) {
    const environment = findModuleGraphEnvironment(
      project,
      testModule.moduleId,
      testModule.viteEnvironment?.name,
    )
    
    // Invariant guard: Test files cancelled before worker dispatch have no active environment
    if (!environment) {
      continue
    }
    
    collectors[environment.name] ??= createModuleGraphCollector(project, environment)
    collectors[environment.name].add(testModule.moduleId)
  }
  
  return Object.fromEntries(
    Object.entries(collectors).map(([env, c]) => [env, { modules: c.data.modules, roots: c.roots }])
  )
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly throwing invariant errors on post-mortem modules
function getModuleGraphEnvironment(project: TestProject, testFilePath: string) {
  const environment = project.vite.environments[testFilePath]
  if (!environment) {
    // CRASHES reporter if execution was terminated by --bail 1!
    throw new Error(`Cannot find environment for ${testFilePath}`)
  }
  return environment
}
```

**VERIFICATION METHOD**:
Run an integration test executing consecutive specs with `bail: 1` and verify the HTML reporter produces valid output:
```bash
vitest run --bail 1 --reporter html --reporter default
# Verification: Process exits with test failure code, NOT reporter crash stack trace,
# and index.html exists in reporter output folder.
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Cross-Iframe Clock Skew in Browser Test Orchestrator (BUG-VITEST-01)
- **Context**: `packages/browser/src/client/orchestrator.ts` & `packages/browser/src/client/tester/tester.ts`
- **What Was Expected**: `prepareDuration` diagnostics reflect accurate initialization time spent bootstrapping Vite's runner and DOM environment in the tester iframe.
- **What Actually Happened**: `prepareDuration` for subsequent test modules returned negative times or leaked durations from preceding test files, corrupting browser performance metrics.
- **Evidence in Repo**: Commit `a3ed42a1`, PR `#11667`, Test: `test/browser/specs/prepare-duration.test.ts`.
- **Root Cause**: The orchestrator iframe recorded `startTime` as `performance.now()`. When the tester iframe loaded, its high-resolution clock started from 0 at its own `timeOrigin`. Subtracting the orchestrator's `startTime` (thousands of ms into the parent page life) from the newly spawned iframe's `performance.now()` caused an underflow.
- **Remediation Code Diff**:
```typescript
// packages/browser/src/client/orchestrator.ts
- const startTime = performance.now()
+ // tester iframes have their own time origin
+ const startTime = performance.timeOrigin + performance.now()

// packages/browser/src/client/tester/tester.ts
- state.durations.prepare = performance.now() - state.durations.prepare
+ state.durations.prepare = performance.timeOrigin + performance.now() - options.startTime
```
- **Lesson**: High-resolution performance timers cannot cross browser window/iframe boundaries without normalizing against `performance.timeOrigin`.

---

### Incident 2: Process Hang via Leaked Screenshot Stability Timer (BUG-VITEST-02)
- **Context**: `packages/browser/src/node/commands/screenshotMatcher/index.ts`
- **What Was Expected**: Running screenshot comparisons in headless mode exits cleanly immediately upon test completion.
- **What Actually Happened**: Vitest processes hung indefinitely (or until the 30-second teardown timeout elapsed), causing CI pipelines to stall.
- **Evidence in Repo**: Commit `fbe37c08`, PR `#11659`, Test: `test/browser/specs/to-match-screenshot.test.ts`.
- **Root Cause**: `waitForStableScreenshot` used `Promise.race([stableScreenshot, asyncTimeout(timeout)])`. `asyncTimeout` registered an active `setTimeout` without retaining the timer reference. When `stableScreenshot` resolved early, the timeout remained active in Node's libuv event loop.
- **Remediation Code Diff**:
```typescript
// packages/browser/src/node/commands/screenshotMatcher/utils.ts
- export function asyncTimeout(timeout: number): Promise<null> {
-   return new Promise((resolve) => {
-     if (timeout === 0) resolve(null)
-     else setTimeout(resolve, timeout, null)
-   })
- }
+ export function asyncTimeout(timeout: number): { promise: Promise<null>; clear: () => void } {
+   let timer: NodeJS.Timeout | undefined
+   const promise = new Promise<null>((resolve) => {
+     if (timeout === 0) resolve(null)
+     else timer = setTimeout(resolve, timeout, null)
+   })
+   return { promise, clear: () => clearTimeout(timer) }
+ }

// packages/browser/src/node/commands/screenshotMatcher/index.ts
+ const stabilityTimeout = asyncTimeout(timeout)
+ try {
+   return await Promise.race([
+     stableScreenshot,
+     stabilityTimeout.promise.finally(() => abortController.abort()),
+   ])
+ } finally {
+   stabilityTimeout.clear()
+ }
```
- **Lesson**: Any timer registered for an async race MUST be cleared in a `finally` block to prevent holding the Node.js event loop open.

---

### Incident 3: HTML Reporter Fatal Crash Under `--bail` (BUG-VITEST-03)
- **Context**: `packages/vitest/src/utils/graph.ts`
- **What Was Expected**: Enabling `--bail` stops execution on failure and generates standard test reports for all executed and unexecuted modules.
- **What Actually Happened**: The HTML reporter threw an unhandled exception: `Error: Cannot find environment for b-pass.test.ts`, causing the entire CLI process to exit with an error before writing report files.
- **Evidence in Repo**: Commit `36a5fa13`, PR `#11693`, Test: `test/e2e/test/reporters/html.test.ts`.
- **Root Cause**: When `--bail 1` triggered, unexecuted files in the queue were cancelled before their Vite `DevEnvironment` was instantiated. `getModuleGraphEnvironment` threw an unconditional error whenever an environment was missing, terminating post-run reporting.
- **Remediation Code Diff**:
```typescript
// packages/vitest/src/utils/graph.ts
- function getModuleGraphEnvironment(...) {
-   if (!environment) {
-     throw new Error(`Cannot find environment for ${testFilePath}`)
-   }
-   return environment
- }
+ function findModuleGraphEnvironment(...): DevEnvironment | undefined {
+   if (viteEnvironment) {
+     return project.vite.environments[viteEnvironment]
+   }
+   return project.config.experimental.viteModuleRunner === false
+     ? project.vite.environments.__vitest__
+     : getTestFileEnvironment(project, testFilePath, project.config.browser.enabled)
+ }

// In caller:
+ const environment = findModuleGraphEnvironment(...)
+ // test files that never ran (e.g. cancelled by bail) have no module graph
+ if (!environment) {
+   continue
+ }
```
- **Lesson**: Diagnostic and reporting infrastructure must follow lenient collection semantics for un-materialized entities during aborted states.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
```typescript
// EQUALITY INVARIANT: packages/expect/src/jest-utils.ts
// Standard JavaScript `==` or `===` fails on edge cases:
// 1. +0 === -0 is true, but Object.is(+0, -0) is false.
// 2. NaN === NaN is false, but Object.is(NaN, NaN) is true.
// 3. Dates with invalid time: numA === numB will be NaN === NaN (false),
//    requiring explicit Number.isNaN fallback:

case '[object Date]': {
  const numA = +a
  const numB = +b
  return numA === numB || (Number.isNaN(numA) && Number.isNaN(numB))
}

// PRIMITIVE WRAPPER TRAP:
// new String('a') === new String('a') is FALSE by reference.
// Vitest checks for boxed primitives using className inspection,
// then falls back to valueOf():
if (typeof a !== 'object' && typeof b !== 'object') {
  return Object.is(a, b)
} else {
  return Object.is(a.valueOf(), b.valueOf())
}
```

### 2. Infinite Loop & Recursion Guards
```typescript
// CIRCULAR REFERENCE DETECTION: packages/expect/src/jest-utils.ts
// Deep equality on arbitrary objects can easily cause a Call Stack Overflow
// when objects have cyclic self-references.
// Vitest maintains twin stacks (aStack, bStack) acting as back-link registers:

let length = aStack.length
while (length--) {
  // Circular references at identical depth are verified equal
  if (aStack[length] === a) {
    return bStack[length] === b
  } else if (bStack[length] === b) {
    return false
  }
}
// Push references before recursing into object graph
aStack.push(a)
bStack.push(b)

try {
  // Recurse into children...
} finally {
  // Stack pop MUST occur in finally block to preserve stack frames across throws
  aStack.pop()
  bStack.pop()
}
```

```typescript
// UN-AWAITED ASYNC PROMISE STARVATION GUARD: packages/browser/src/client/utils.ts
// Hanging or unhandled promise chains can crash browser runners silently.
// Vitest wraps asynchronous locator operations in `ensureAwaited`:
export function ensureAwaited<T>(promise: (error?: Error) => Promise<T>): Promise<T> {
  let awaited = false
  const sourceError = new Error('STACK_TRACE_ERROR')
  
  test.onFinished.push(() => {
    if (!awaited) {
      const error = new Error(
        `The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.`
      )
      error.stack = sourceError.stack?.replace(sourceError.message, error.message)
      throw error
    }
  })

  let promiseResult: Promise<T> | undefined
  return {
    then(onFulfilled, onRejected) {
      awaited = true
      return (promiseResult ||= promise(sourceError)).then(onFulfilled, onRejected)
    },
    // ...
  } satisfies Promise<T>
}
```

### 3. UI & UX Micro-Mechanics
```typescript
// PATH TRAVERSAL SANITIZATION: packages/browser/src/node/commands/screenshotMatcher/utils.ts
// Screenshot baselines allow arbitrary naming from tests.
// Prevent Directory Traversal attacks (e.g., "../../etc/passwd"):
function sanitizeArg(input: string): string {
  // 1. Force absolute join to root '/'
  // 2. Relative from '/' eliminates any leading '../' escape attempts
  // 3. Segment-by-segment regex scrubbing
  return sanitize(relative('/', join('/', input)), true)
}

function sanitize(input: string, keepPaths: boolean): string {
  if (keepPaths === false) {
    return input
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/-{2,}/g, '-')
  }
  return input
    .split('/')
    .map((path) => sanitize(path, false))
    .join('/')
}
```

### 4. Backend Concurrency & Memory Safety
```typescript
// VM CONTEXT MEMORY LEAK ELIMINATION: packages/expect/src/state.ts
// Node.js vm contexts often leak memory because property descriptors on globalThis
// capture closures holding root ASTs and project scopes.
// Vitest configures property definitions as `configurable: true`:

Object.defineProperty(globalThis, MATCHERS_OBJECT, {
  configurable: true, // Allows VM pools to delete/strip accessors on teardown!
  get: () => globalState,
})

// SECURE FILE ACCESS CHECK: packages/browser/src/node/utils.ts
// Mitigates TOCTOU & Browser-to-Host Hostile FS Access
export function assertBrowserFileAccess(project: TestProject, path: string): void {
  const normalized = slash(path)
  if (
    !isFileLoadingAllowed(project.vite.config, normalized) &&
    !isFileLoadingAllowed(project.vitest.vite.config, normalized)
  ) {
    throw new Error(
      `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`
    )
  }
}
```

### 5. Defect & Error Prevention ("Galti Pakadna")
```typescript
// SYMBOL PROPERTY LEAK CHECK IN COMPARISONS: packages/expect/src/jest-utils.ts
// Traditional `for...in` and `Object.keys()` omit non-enumerable symbols.
// Vitest explicitly traverses enumerable Symbols:
function keys(obj: object, hasKey: (obj: object, key: string) => boolean) {
  const keys = []
  for (const key in obj) {
    if (hasKey(obj, key)) keys.push(key)
  }
  return keys.concat(
    (Object.getOwnPropertySymbols(obj) as Array<any>).filter(
      (symbol) => (Object.getOwnPropertyDescriptor(obj, symbol) as PropertyDescriptor).enumerable
    )
  )
}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Vitest uses an Inverted Control Microkernel architecture. The core CLI creates a long-lived Vite Dev Server. Worker pools (threads, child processes, or browser tabs) run thin client runners that fetch transpiled ESM code directly from Vite via HTTP/WebSocket RPC, bypassing ahead-of-time bundling overhead.

### 2. Core Abstractions
- `TestProject`: Encapsulates an isolated workspace configuration, plugins, and Vite server instance.
- `SerializedLocator`: A cross-boundary transport protocol enabling NodeJS-based tests to drive Playwright/CDP DOM actions across WebSocket serialization barriers without leaking raw DOM handles.
- `BrowserRunnerState`: A global bus attached to `window.__vitest_browser_runner__` providing iframe decoupling.

### 3. Error Handling
Vitest preserves error cause chains across worker RPC boundaries. It customizes `Error.stack` transformations using SourceMap registries stored directly in memory, ensuring assertions thrown from inside Vite-transformed code map directly back to the original TypeScript source lines.

### 4. Testing
Uses self-hosting e2e harnesses (`runInlineTests`, `runVitestCli`) with virtual file systems (`useTmpFS`). Reporters are validated against inline snapshots of formatted terminal output and AST assertion trees.

### 5. Security
Strict enforcement of Vite’s `server.fs.strict`. The Browser Mode explicitly checks `isFileLoadingAllowed` for any source or asset request. File-writing APIs are guarded by `project.config.api.allowWrite` to prevent arbitrary file overwrites when running tests over exposed local network bindings.

### 6. Performance
Zero-copy module execution: Vitest leverages native ESM evaluation where possible. In the expect matcher engine, object comparisons abort early on array length or key size mismatches before descending into recursive tree traversals.

### 7. Deployment
Mono-repo managed with `pnpm` and isolated declarations via `unplugin-isolated-decl`. Strict CI matrix isolating unit, e2e, coverage, browser, and workspace tests. Node runtime engine constraint explicitly pegged to `^22.12.0 || ^24.0.0 || >=26.0.0`.

### 8. Agent Patterns
Agent governance rules are enforced at repository boundaries: `.claude/agents/vitest-test-writer.md` and `AGENTS.md` mandate human-approval verification steps and prohibit synthetic automated PR submissions lacking real failing test fixtures.

### 9. Data Flow
Test files -> Vite AST Parser/Transformer -> Module Runner -> Assertion Frame Execution -> RPC Channel -> Diagnostic Collector -> Reporter Sink.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Lazy Property Initializer via Self-Replacing Accessors
```typescript
// packages/browser/src/node/commands/screenshotMatcher/utils.ts
export interface ResolvedOptions {
  paths: {
    reference: string
    diffs: { reference: string; actual: string; diff: string }
  }
}

// Defer heavy path computation until the property is actually read:
paths: {
  reference: resolvedOptions.resolveScreenshotPath(resolvePathData),
  get diffs() {
    const diffs = {
      reference: resolvedOptions.resolveDiffPath({ ...resolvePathData, arg: `${resolvePathData.arg}-reference` }),
      actual: resolvedOptions.resolveDiffPath({ ...resolvePathData, arg: `${resolvePathData.arg}-actual` }),
      diff: resolvedOptions.resolveDiffPath({ ...resolvePathData, arg: `${resolvePathData.arg}-diff` }),
    }
    // Self-replace the getter with the concrete value to avoid re-computation
    Object.defineProperty(this, 'diffs', { value: diffs, enumerable: true })
    return diffs
  }
}
```

### 2. Rule
*All long-lived state attached to `globalThis` within dynamically reloaded contexts MUST be defined with `configurable: true` to prevent memory leaks across teardowns.*

### 3. Architecture Principle
*Decouple orchestration from execution environments: The harness orchestrating a suite must never share a synchronous execution context or unnormalized time origin with the code under test.*

### 4. Failure Mode
Event loop starvation via dangling `setTimeout` instances within asynchronous `Promise.race()` control flows, causing CLI runners to hang indefinitely after test execution passes.

### 5. Reusable Skill: Cross-Context Timing Measurement Checklist
1. Identify the origin of the start timestamp (`timeOrigin` + `now()`).
2. Transmit the absolute timestamp across the context boundary.
3. In the target frame, query local `performance.timeOrigin + performance.now()`.
4. Calculate duration delta using the absolute offsets.

### 6. Decision
Vitest opted for dual-stack (`aStack` / `bStack`) linear search over `Set` or `WeakMap` for circular dependency detection during deep object equality checks.  
*Rationale*: Retains compatibility across custom VM sandboxes where non-extensible objects, frozen prototypes, and primitive wrappers break WeakMap key semantics.

### 7. Anti-pattern
Invoking `Promise.race` with an unmanaged `setTimeout` fallback, leaking open event loop handles:
```typescript
// DO NOT DO THIS:
await Promise.race([fetchData(), new Promise(r => setTimeout(r, 5000))])
```

### 8. Verification Method
Run isolated CLI execution asserting that the exit code is 0 and that `stderr` contains zero leak warnings or open handles:
```bash
node --trace-exit ./node_modules/vitest/vitest.mjs run --teardownTimeout 1000
```

---

## 7. Actionable Agent Skill & Implementation Checklist

### Asynchronous Resource & Race Verification Checklist
- [ ] Are all `setTimeout` calls within async race operations wrapped in a cleanup helper that calls `clearTimeout`?
- [ ] Is `clearTimeout` executed inside a `finally` block to guarantee invocation regardless of rejection?
- [ ] Are cross-context duration measurements using `performance.timeOrigin + performance.now()` instead of raw `performance.now()`?
- [ ] Does deep object graph traversal guard against cyclic self-references using push/pop tracking stacks inside `try...finally` blocks?
- [ ] Do reporters and summary collectors guard against `undefined` environments caused by early cancellations (`--bail`)?
- [ ] Are all global context bindings marked `configurable: true` to allow full garbage collection during VM teardown?
- [ ] Are screenshot names and file artifacts scrubbed via strict path-traversal sanitizers (`relative('/', join('/', input))`)?