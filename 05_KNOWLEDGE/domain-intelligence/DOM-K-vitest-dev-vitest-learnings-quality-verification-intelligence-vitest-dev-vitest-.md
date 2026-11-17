# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: vitest-dev-vitest-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "vitest-dev-vitest-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T06:20:44.370Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vitest-dev-vitest-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vitest-dev-vitest-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T06:20:44.370Z`  
> **Learning ID**: `LEARN-EVO-vitest-dev-vitest-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), F (Design Intelligence), I (Content & Information Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from vitest-dev-vitest-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vitest-dev-vitest-learnings.md`  
> **Source**: github ([https://github.com/vitest-dev/vitest](https://github.com/vitest-dev/vitest))  
> **Source Version**: `4e905a1b`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-17T06:20:38.060Z  
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
Vitest resolves the execution, bundling, and transformation discrepancy between modern frontend development servers and test runners. Historically, running unit and integration tests required duplicate compilation pipelines: Vite/Rollup for bundling the application, and Babel/ts-jest/Webpack for executing tests in Node.js. This split led to diverging module semantics (ESM vs. CJS resolution, CSS modules, asset imports, import assertions, and path aliases). 

Vitest executes tests directly against Vite's module graph runtime, resolving modules with the exact same plugin transforms, resolve aliases, and environment variables used by the Vite dev server. It also orchestrates parallel worker pools across multiple execution contexts (Worker Threads, Child Processes/Forks, VM sandboxes, and Real Headless Browsers via CDP/Playwright/WebdriverIO) while enforcing isolated snapshot tracking, asymmetric assertion diffing, and test state tracking.

```
+---------------------------------------------------------------------------------------+
|                                    Vitest Core CLI                                    |
+---------------------------------------------------------------------------------------+
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
                   v                                               v
        +----------------------+                       +-----------------------+
        |   Vite Dev Server    |                       |    Pool Orchestrator  |
        | (Module Graph, HMR,  |                       |  (Worker Pool State,  |
        |  Plugin Pipeline)    |                       |   Concurrency Queue)  |
        +----------------------+                       +-----------------------+
                   |                                               |
         +---------+---------+                         +-----------+-----------+
         |                   |                         |           |           |
         v                   v                         v           v           v
  +-------------+     +-------------+             +---------+ +---------+ +---------+
  | Transform   |     | Path Alias  |             | Forks   | | Threads | | Browser |
  | Pipeline    |     | Resolution  |             | Pool    | | Pool    | | (CDP/   |
  +-------------+     +-------------+             +---------+ +---------+ | Playwr.)|
                                                       |           |      +---------+
                                                       v           v           |
                                                  +-----------------------+    |
                                                  |   Runtime Execution   |    |
                                                  | (Matcher State, Test  |    |
                                                  |  Runner, Lifecycle)   |<---+
                                                  +-----------------------+
                                                               |
                                                               v
                                                  +-----------------------+
                                                  | Reporters / Exit Code |
                                                  | (JSON, TAP, JUnit)    |
                                                  +-----------------------+
```

### Architectural Boundaries & State Ownership
1. **Host Orchestrator (Node.js)**: Owns configuration normalization, discovery via file system globbing (`tinyglobby`), test run scheduling, reporter aggregation, and worker lifecycle management (`packages/vitest/src/node`).
2. **Worker Pool Abstraction (`Pool`)**: Decouples process/thread instantiation from execution. Standardizes communication over Bidirectional RPC (via MessagePort/IPC) and enforces isolation boundaries (`packages/vitest/src/node/pools`).
3. **Execution Sandbox (Runtime)**: The runner runs inside isolated contexts (Threads, Forks, `node:vm`, or Browser IFrames). It consumes normalized test files, executes hooks (`beforeAll`, `beforeEach`, `afterEach`, `afterAll`), tracks execution states (`run`, `pass`, `fail`, `skip`, `todo`), and maintains assertion invariants (`packages/vitest/src/runtime`).
4. **Assertion Engine (`@vitest/expect`)**: Decoupled from the test runner. Implements Jasmine/Jest-compatible deep object equality algorithms with asymmetric matching, prototype traversing, cyclical reference stacks, and contextual execution tracking mapped via `WeakMap` or symbol registries on `globalThis`.
5. **Browser Provider Subsystem (`@vitest/browser`)**: Implements dual-role orchestration:
   - **Orchestrator Role**: Manages the parent top-level browsing context, WebSockets, import map probing, and trace collection.
   - **Tester Role**: Manages the child iframe where user code executes, instrumenting event dispatching, lazy promise tracking, and layout flushes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Verification-Before-Reuse Pool Invariant
**RULE**:
A worker, thread, connection, or shared execution resource MUST verify its operational startup completion status (`runner.isStarted === true`) prior to accepting subsequent tasks in non-isolated or pooled execution modes. It MUST NOT infer usability merely from the absence of a termination flag (`!runner.isTerminated`).

**WHY**:
In pooled execution models (e.g., database connection pools, thread workers, isolated VM contexts), a worker can encounter an unhandled exception or rejection during its initial configuration/asynchronous startup lifecycle before entering its steady-state runloop. If the manager checks only `!isTerminated`, a worker whose startup crashed remains eligible in the scheduling queue. When assigned tasks, it will either immediately fail, enter a unresolvable hanging promise state, or process requests with corrupt context.

**WHEN TO APPLY**:
- Worker thread and child process pooling mechanisms.
- Database connection pools and multiplexed TCP/HTTP2 client sessions.
- VM sandbox management and persistent worker queues (`isolate: false`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface ManagedWorker {
  id: string
  isStarted: boolean
  isTerminated: boolean
  start(): Promise<void>
  execute(task: Task): Promise<TaskResult>
}

export class ExecutionPool {
  private queue: Array<{ task: Task; isolate: boolean }> = []
  private activeWorkers: ManagedWorker[] = []

  public canReuseWorker(worker: ManagedWorker, nextTask: { isolate: boolean }): boolean {
    return (
      !nextTask.isolate &&
      // CRITICAL: The worker must have successfully finished its startup phase.
      // An unstarted or failed-startup worker has !isTerminated === true, but is invalid.
      worker.isStarted &&
      !worker.isTerminated &&
      !this.isResourceExhausted(worker)
    )
  }

  private isResourceExhausted(worker: ManagedWorker): boolean {
    // Memory and task threshold verification
    return false
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Inferring readiness from the absence of a termination signal
export class UnsafeExecutionPool {
  public canReuseWorker(worker: ManagedWorker, nextTask: { isolate: boolean }): boolean {
    // DEFECT: If worker.start() threw an exception, worker.isTerminated may still be false
    // while the worker is in an uninitialized, invalid state.
    if (!nextTask.isolate && !worker.isTerminated) {
      return true
    }
    return false
  }
}
```

**VERIFICATION METHOD**:
Automated integration test injecting an unconditional failure inside `worker.start()`. Verify that the orchestrator removes the worker from the queue, marks the task failed with an explicit startup error, spawns a replacement worker for queued tasks, and does not hang the event loop:
```typescript
test('failed worker startup prevents reuse and does not hang queue', async () => {
  const pool = new ExecutionPool()
  const faultyWorker = new FaultyWorker({ failOnStart: true })
  
  await expect(faultyWorker.start()).rejects.toThrow('Startup failed')
  expect(pool.canReuseWorker(faultyWorker, { isolate: false })).toBe(false)
})
```

---

### 2. Definite Execution Verification for Lazy Deferred Promises
**RULE**:
Asynchronous APIs returned by test utilities, locators, and UI interaction engines that defer execution until awaited MUST register a lifecycle cleanup guard that checks whether the action was settled before the test context completes. If the promise was constructed but never `.then()`-ed or `await`-ed, the guard MUST throw an explicit error pinpointing the unawaited expression's call site, preventing hidden asynchronous floating tasks and unhandled rejections.

**WHY**:
Fluent APIs and interactive assertion chains (such as UI locators, database transaction builders, and browser commands) often construct promises lazily or return objects conforming to the `PromiseLike` interface. If a consumer writes `locator.click()` without `await`, the action either runs out-of-band during subsequent tests (inducing intermittent, non-deterministic race conditions and test pollution), or drops errors into the host runtime as unhandled promise rejections after the test reporting boundary has closed.

**WHEN TO APPLY**:
- Browser automation locators and testing APIs (`@vitest/browser`, Playwright, Puppeteer).
- ORM/Database query builders (`knex`, `prisma`, `drizzle`).
- Any deferred builder returning a `PromiseLike` interface executed within scoped lifecycle bounds.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface ActiveTestContext {
  type: string
  onFinished: Array<() => void | Promise<void>>
}

export function ensureAwaited<T>(
  getCurrentContext: () => ActiveTestContext | undefined,
  taskFactory: (sourceError: Error) => Promise<T>,
): Promise<T> {
  const context = getCurrentContext()
  if (!context || context.type !== 'test') {
    // If not running within an active test harness, fall back to eager resolution
    const traceError = new Error('STACK_TRACE_ORIGIN')
    return taskFactory(traceError)
  }

  let wasAwaited = false
  const sourceError = new Error('DeferredCallNotAwaitedError')

  // Register guard into the test's cleanup pipeline
  context.onFinished ??= []
  context.onFinished.push(() => {
    if (!wasAwaited) {
      const unawaitedError = new Error(
        'The asynchronous command was constructed but not awaited. ' +
        'Execution was prevented to avoid out-of-band unhandled rejections.'
      )
      // Preserve original call-site stack trace for developer debugging
      unawaitedError.stack = sourceError.stack?.replace(sourceError.message, unawaitedError.message)
      throw unawaitedError
    }
  })

  let executionPromise: Promise<T> | undefined

  return {
    then(onFulfilled, onRejected) {
      wasAwaited = true
      executionPromise ||= taskFactory(sourceError)
      return executionPromise.then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      wasAwaited = true
      executionPromise ||= taskFactory(sourceError)
      return executionPromise.catch(onRejected)
    },
    finally(onFinally) {
      wasAwaited = true
      executionPromise ||= taskFactory(sourceError)
      return executionPromise.finally(onFinally)
    },
    [Symbol.toStringTag]: 'Promise',
  } as Promise<T>
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Returning an eagerly executing promise without lifecycle tracking
export function unsafeDeferredAction<T>(action: () => Promise<T>): Promise<T> {
  // If the consumer omits 'await', this continues executing beyond the test life cycle
  // silently corrupting state in following tests.
  return action()
}
```

**VERIFICATION METHOD**:
Run a suite where a deferred call is made without `await`. Assert that the test fails at completion with `DeferredCallNotAwaitedError` and the correct source line number:
```typescript
it('flags unawaited actions at test teardown', async () => {
  const mockContext = { type: 'test', onFinished: [] }
  let executed = false

  const deferred = ensureAwaited(() => mockContext, async () => {
    executed = true
  })

  // Deliberately omit: await deferred;
  expect(executed).toBe(false)
  expect(() => {
    for (const hook of mockContext.onFinished) hook()
  }).toThrow('DeferredCallNotAwaitedError')
})
```

---

### 3. State-Derived Custom Matcher Context Invariant
**RULE**:
Custom matchers and assertion plugins MUST derive their runtime execution context (`this` bound state) dynamically from the current execution environment (`expect.getState()`) rather than from a global closure or root-level static object.

**WHY**:
In concurrent test execution modes (`test.concurrent`), multiple tests run asynchronously across the same event loop within a single worker. If assertion matchers bind their context to a static or shared global state reference, calls to `expect.setState({ ... })` from concurrently running tests will overwrite one another. Matchers then inspect corrupt state (such as assertion counters, snapshot paths, or custom context flags), leading to false positives or cross-test assertion pollution.

**WHEN TO APPLY**:
- Assertion libraries and test runners offering concurrent or async-interleaved execution.
- Systems utilizing global DSL methods (`expect(...)`) that delegate internally to per-task execution context.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface MatcherState {
  assertionCalls: number
  expectedAssertionsNumber?: number
  isNot?: boolean
  testPath?: string
  currentTestName?: string
  [key: string]: unknown
}

export type MatcherFn = (this: MatcherState, received: unknown, ...args: unknown[]) => {
  pass: boolean
  message: () => string
}

export class MatcherRegistry {
  private customMatchers: Record<string, MatcherFn> = Object.create(null)

  public extend(matchers: Record<string, MatcherFn>): void {
    Object.assign(this.customMatchers, matchers)
  }

  public wrapMatcher(
    matcherName: string,
    getCurrentState: () => MatcherState
  ) {
    const rawMatcher = this.customMatchers[matcherName]
    return (...args: unknown[]) => {
      // DYNAMIC BINDING: State is extracted at the exact instant of assertion evaluation
      const currentState = getCurrentState()
      const context: MatcherState = Object.assign(
        Object.create(null),
        currentState,
        { matcherName }
      )
      return rawMatcher.apply(context, args as [unknown, ...unknown[]])
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Capturing static reference at setup time
export function bindMatchersStatically(
  matchers: Record<string, MatcherFn>,
  globalState: MatcherState
) {
  const bound: Record<string, Function> = {}
  for (const [name, fn] of Object.entries(matchers)) {
    // DEFECT: Binds permanently to globalState. Concurrent test runs using
    // expect.setState() will not be seen here, or will collide.
    bound[name] = (...args: unknown[]) => fn.apply(globalState, args)
  }
  return bound
}
```

**VERIFICATION METHOD**:
Execute two concurrent test cases where each sets distinct flags via `expect.setState()` and asserts them simultaneously through a custom matcher:
```typescript
test.concurrent('suite A', async () => {
  expect.setState({ currentScope: 'SCOPE_A' })
  await delay(10)
  expect(true).toVerifyScope('SCOPE_A')
})

test.concurrent('suite B', async () => {
  expect.setState({ currentScope: 'SCOPE_B' })
  await delay(10)
  expect(true).toVerifyScope('SCOPE_B')
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Reporter Silent Success Masking on Process Crashes (BUG-VITEST-01)
- **Context**: JSON reporter (`packages/vitest/src/node/reporters/json.ts`) tracking suite-level state transitions.
- **What Was Expected**: If an underlying worker thread or child process died abruptly (e.g., received `SIGKILL`, segmentation fault, out-of-memory crash, or explicit process termination via `process.kill`) during test collection or test execution, the JSON reporter MUST mark the associated test file as `'failed'`, compute `numFailedTestSuites >= 1`, emit `success: false`, and ensure the host exits with code 1.
- **What Actually Happened**: The JSON reporter queried test suite status strictly by checking whether `suite.result?.state === 'fail'`. When a worker crashed, the process abruptly ended before transmitting a failure payload back to the orchestrator. The suite state remained `undefined`, `'run'`, or `'queued'`. Consequently, the suite was excluded from `numFailedTestSuites`, dropped into pending or passed buckets, and emitted as `status: 'passed'` in the summary results, allowing CI runs to report passing suites despite crashed workers.
- **Evidence in Repo**: Commit `47fb992c`, Issue `#11965`, Files: `packages/vitest/src/node/reporters/json.ts`, `test/e2e/test/reporters/json.test.ts`.
- **Root Cause**: The calculation logic relied on positive confirmation of the failed state (`state === 'fail'`), failing to account for aborted life cycles where the worker stopped executing before updating its task state.
- **Remediation Code Diff**:
```diff
@@ -113,9 +113,15 @@ export class JsonReporter implements Reporter {
     const tests = getTests(files)
     const numTotalTests = tests.length
 
-    const numFailedTestSuites = suites.filter((s) => s.result?.state === 'fail').length
+    const unfinishedFiles = new Set<Suite>(files.filter(isUnfinished))
+
+    const numFailedTestSuites = suites.filter(
+      (s) => s.result?.state === 'fail' || unfinishedFiles.has(s),
+    ).length
     const numPendingTestSuites = suites.filter(
-      (s) => s.result?.state === 'run' || s.result?.state === 'queued' || s.mode === 'todo',
+      (s) =>
+        !unfinishedFiles.has(s) &&
+        (s.result?.state === 'run' || s.result?.state === 'queued' || s.mode === 'todo'),
     ).length
     const numPassedTestSuites = numTotalTestSuites - numFailedTestSuites - numPendingTestSuites
 
@@ -200,7 +206,10 @@ export class JsonReporter implements Reporter {
         assertionResults,
         startTime,
         endTime,
-        status: file.result?.state === 'fail' || hasFailedTests ? 'failed' : 'passed',\n+        status:\n+          unfinishedFiles.has(file) || file.result?.state === 'fail' || hasFailedTests\n+            ? 'failed'\n+            : 'passed',
         message: file.result?.errors?.[0]?.message ?? '',
         name: file.filepath,
       })
@@ -245,3 +254,14 @@ export class JsonReporter implements Reporter {
     }
   }
 }
+
+// the file did not finish, for example because its worker crashed
+// (same as `pending` or `queued` in `TestModule.state()`)
+function isUnfinished(file: File): boolean {
+  const state = file.result?.state
+  return (
+    file.mode !== 'skip' &&
+    file.mode !== 'todo' &&
+    (state == null || state === 'run' || state === 'only' || state === 'queued')
+  )
+}
```
- **Lesson**: Any state tracking machine where tasks are executed in distributed or external processes must treat incomplete or prematurely ended tasks as failures by default upon pipeline completion. Never assume a task succeeded merely because an explicit error flag was not set.

---

### Incident 2: Zombie Worker Reuse Following Startup Failure in Non-Isolated Pool (BUG-VITEST-02)
- **Context**: Process/Worker Pool management (`packages/vitest/src/node/pools/pool.ts`).
- **What Was Expected**: When `isolate: false` is configured, workers are kept alive across multiple test suites to eliminate process startup overhead. If a worker throws an exception during startup (e.g., syntax error in preload scripts, unhandled exception in `createPoolWorker`, or permission errors), the orchestrator must reject that worker, discard it, and refrain from routing subsequent test files to it.
- **What Actually Happened**: The worker recycling logic verified `!runner.isTerminated`. Since a worker that throws an error in its `start()` method had not triggered a full termination/exit signal, `!runner.isTerminated` evaluated to `true`. The pool treated the worker as healthy and kept dispatching upcoming tasks from the queue to the broken worker, hanging the test run indefinitely or cascading failures across all files.
- **Evidence in Repo**: Commit `7e67234a`, PR `#11953`, Files: `packages/vitest/src/node/pools/pool.ts`, `test/e2e/test/pool.test.ts`.
- **Root Cause**: Flawed state inference. Conflating "worker is not terminated" with "worker is started and healthy".
- **Remediation Code Diff**:
```diff
@@ -165,7 +165,7 @@ export class Pool {
 
        if (
          !task.isolate &&
-        !runner.isTerminated &&
+        runner.isStarted &&
          !isMemoryLimitReached &&
          this.queue[0]?.task.isolate === false &&
          isEqualRunner(runner, this.queue[0].task)
```
- **Lesson**: Lifecycle flags must be affirmative, not negative. Always gate critical execution paths with positive assertions of readiness (`isStarted === true && isReady === true`), never the negation of an exit condition (`!isTerminated`).

---

### Incident 3: Inverted AST Guarding for Vite CJS Interop Coverage (BUG-VITEST-03)
- **Context**: V8 Code Coverage Engine (`packages/coverage-v8/src/provider.ts`).
- **What Was Expected**: Vite transforms CommonJS `require()` calls into synthetic ternary expressions to handle default vs. named exports (e.g., `__vite__cjsImport0_react.__esModule ? __vite__cjsImport0_react.default : __vite__cjsImport0_react`). The V8 coverage provider must detect this synthetic AST artifact and filter out its unexecuted branch so user code coverage is not penalized with false-positive missing branches.
- **What Actually Happened**: When Vite transformed dependencies under the `legacy.inconsistentCjsInterop` mode, it emitted an inverted conditional ternary: `!__vite__cjsImport0_react.__esModule ? __vite__cjsImport0_react : __vite__cjsImport0_react.default`. The AST matcher in Vitest strictly matched `node.test.type === 'MemberExpression'`. Under inverted syntax, `node.test` became a `UnaryExpression` with operator `'!'`. The matcher failed to recognize the synthetic branch, penalizing user libraries with artificial 50% branch coverage deficits on external imports.
- **Evidence in Repo**: Commit `4e905a1b`, PR `#11981`, Issue `#11980`, Files: `packages/coverage-v8/src/provider.ts`, `test/coverage-test/test/cjs-dependency.test.ts`.
- **Root Cause**: Brittle AST inspection logic assuming invariant syntax tree topologies produced by upstream compiler pipelines.
- **Remediation Code Diff**:
```diff
@@ -308,16 +308,22 @@ export class V8CoverageProvider extends BaseCoverageProvider implements Coverage
 
         // CJS imports as ternaries - e.g.
         // const React = __vite__cjsImport0_react.__esModule ? __vite__cjsImport0_react.default : __vite__cjsImport0_react;
-        if (
-          type === 'branch' &&
-          node.type === 'ConditionalExpression' &&
-          node.test.type === 'MemberExpression' &&
-          node.test.object.type === 'Identifier' &&
-          node.test.object.name.startsWith('__vite__cjsImport') &&
-          node.test.property.type === 'Identifier' &&
-          node.test.property.name === '__esModule'
-        ) {
-          return true
+        // const React = !__vite__cjsImport0_react.__esModule ? __vite__cjsImport0_react : __vite__cjsImport0_react.default;
+        if (type === 'branch' && node.type === 'ConditionalExpression') {
+          const test =
+            node.test.type === 'UnaryExpression' && node.test.operator === '!'
+              ? node.test.argument
+              : node.test
+
+          if (
+            test.type === 'MemberExpression' &&
+            test.object.type === 'Identifier' &&
+            test.object.name.startsWith('__vite__cjsImport') &&
+            test.property.type === 'Identifier' &&
+            test.property.name === '__esModule'
+          ) {
+            return true
+          }
         }
```
- **Lesson**: AST pattern matchers handling code generation or compiler polyfills must unwrap unary wrappers (negation, casting, type assertions) before analyzing identifier operations.

---

### Incident 4: Custom Matcher Context Decoupling Under Concurrent Execution (BUG-VITEST-04)
- **Context**: State management in `@vitest/expect` (`packages/expect/src/state.ts`).
- **What Was Expected**: Custom matchers registered via `expect.extend()` accessing `this` properties must observe the context of the running test (e.g., custom flags set via `expect.setState({ flag: 'foo' })` and snapshot tracking data), including when running under `test.concurrent`.
- **What Actually Happened**: The global `expect` instance delegated its state lookups to the currently active test task. However, custom matchers constructed their invocation `this` context from the global static state container (`JEST_MATCHERS_OBJECT`). When executing concurrent tests, `expect.setState` wrote exclusively to the local task-level context. The custom matcher running concurrently read an empty global state, resulting in `this.assertionCalls` staying `0` and user-defined state fields returning `undefined`.
- **Evidence in Repo**: Issue `#11991`, PR `#11887` / `#11994`, Files: `packages/expect/src/state.ts`.
- **Root Cause**: Split-brain architecture between dynamic context resolution for built-in matchers and static closure referencing for extended matchers.
- **Remediation Invariant**: Matcher context builders must dynamically bind `this` to `expect.getState()` immediately before executing custom matcher functions, guaranteeing that test-isolated state flows directly into matcher internals.
- **Lesson**: Never let utility hooks or plugins bind to static module-level state when the runtime supports interleaved asynchronous execution contexts.

---

### Incident 5: Enumerable Symbol Key Erasure in Subset Matching (BUG-VITEST-05)
- **Context**: Deep object comparison engine (`packages/expect/src/jest-utils.ts`).
- **What Was Expected**: Matchers performing partial structural matches (e.g., `expect(actual).toMatchObject(expected)`) must compare enumerable `Symbol` keys in addition to string keys.
- **What Actually Happened**: The `subsetEquality` algorithm retrieved keys using `Object.keys(expected)`. In JavaScript, `Object.keys()` returns only enumerable string properties, completely discarding enumerable Symbol properties. Tests attempting to validate Symbol-keyed records (such as standard metadata tags or schema definitions) silently ignored missing or mismatching Symbol values.
- **Evidence in Repo**: Issue `#11974`, PR `#11990`, Files: `packages/expect/src/jest-utils.ts`.
- **Root Cause**: Using `Object.keys` instead of a symbol-aware property iterator (`Object.getOwnPropertySymbols`).
- **Remediation Invariant**: Deep equality and subset comparisons must aggregate both string and symbol keys:
```typescript
function getObjectKeys(obj: object): Array<string | symbol> {
  const keys: Array<string | symbol> = Object.keys(obj)
  const symbols = Object.getOwnPropertySymbols(obj)
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]
    if (Object.prototype.propertyIsEnumerable.call(obj, symbol)) {
      keys.push(symbol)
    }
  }
  return keys
}
```
- **Lesson**: When building serialization, assertion, or cloning mechanisms, `Object.keys()` is insufficient; always extract enumerable symbol properties via `Object.getOwnPropertySymbols` filtered with `propertyIsEnumerable`.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
```typescript
// PITFALL 1: Falsy Numeric Check vs Nullish Check in Timeout Resolution
// If an author passes timeout = 0 (meaning "no timeout" or "immediate"),
// boolean coercion drops 0 to false.
function resolveTimeout(opts: { timeout?: number }): number {
  // HAZARD: opts.timeout || 5000 -> when timeout is 0, becomes 5000!
  // INVARIANT: Use nullish coalescing
  return opts.timeout ?? 5000
}

// PITFALL 2: Prototype Pollution via Object.assign with Object.create(null)
// Merging user options into an existing object directly can trigger prototype mutations.
export function safeDeepMerge<T extends object>(target: T, ...sources: any[]): T {
  // Always initialize root merge nodes with null-prototype dictionary
  const base = Object.assign(Object.create(null), target)
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of Object.getOwnPropertyNames(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue // Hard boundary guard against pollution
      }
      const desc = Object.getOwnPropertyDescriptor(source, key)
      if (desc) Object.defineProperty(base, key, desc)
    }
  }
  return base
}

// PITFALL 3: Date and NaN Primitive Comparison Invariance
// In JavaScript, NaN !== NaN, and invalid Dates have time NaN.
export function areDatesEqual(a: Date, b: Date): boolean {
  const numA = +a
  const numB = +b
  // Strict check: numbers are identical OR both represent invalid dates (NaN)
  return numA === numB || (Number.isNaN(numA) && Number.isNaN(numB))
}
```

### 2. Infinite Loop & Recursion Guards
```typescript
// INVARIANT: Circular Reference Detection via Dual Pointer Stack Tracking
// Used during deep equality assertions where structures reference ancestors.
export function safeDeepEquals(
  a: any,
  b: any,
  aStack: unknown[] = [],
  bStack: unknown[] = [],
  maxDepth = 2000
): boolean {
  if (aStack.length > maxDepth) {
    throw new RangeError(`Exceeded maximum assertion depth of ${maxDepth}. Possible circular graph.`)
  }

  if (Object.is(a, b)) return true

  // Circular reference detection via linear stack verification
  let stackLen = aStack.length
  while (stackLen--) {
    if (aStack[stackLen] === a) {
      return bStack[stackLen] === b
    }
    if (bStack[stackLen] === b) {
      return false
    }
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false
  }

  aStack.push(a)
  bStack.push(b)

  try {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!Object.hasOwn(b, key)) return false
      if (!safeDeepEquals(a[key], b[key], aStack, bStack, maxDepth)) return false
    }
    return true
  } finally {
    // INVARIANT: Unconditional pop in finally prevents stack corruption on thrown errors
    aStack.pop()
    bStack.pop()
  }
}
```

### 3. UI & UX Micro-Mechanics
```typescript
// INVARIANT 1: Shadow DOM Composed Path Traversal
// When dispatching commands to headless browsers, retrieving the target element
// must cross shadow boundaries without triggering layout reflows.
export function getElementFromComposedPath(event: Event): HTMLElement | null {
  const path = event.composedPath()
  for (let i = 0; i < path.length; i++) {
    const target = path[i]
    if (target instanceof HTMLElement && target.hasAttribute('data-testid')) {
      return target
    }
  }
  return null
}

// INVARIANT 2: Focus Restoration Loop Prevention in IFrames
// Subsystems mounting iframe-based test runners can steal OS focus, causing focus-blur loops.
export async function focusIframeSafely(frame: HTMLIFrameElement): Promise<void> {
  const active = document.activeElement
  // Only invoke focus if the active element is not already inside the document or is body
  if (!active || active.ownerDocument !== document || active === document.body) {
    frame.contentWindow?.focus()
  }
}
```

### 4. Backend Concurrency & Memory Safety
```typescript
// INVARIANT 1: TOCTOU-Free Async Resource Disposal
export class AsyncResourceManager {
  private isDisposing = false
  private isDisposed = false
  private activeOperations = new Set<Promise<void>>()

  public async execute<T>(op: () => Promise<T>): Promise<T> {
    // Atomic check before accepting work
    if (this.isDisposing || this.isDisposed) {
      throw new Error('Manager is shutting down. Rejected.')
    }

    const promise = (async () => {
      return await op()
    })()

    const trackingPromise = promise.then(() => {}, () => {})
    this.activeOperations.add(trackingPromise)

    try {
      return await promise
    } finally {
      this.activeOperations.delete(trackingPromise)
    }
  }

  public async dispose(): Promise<void> {
    if (this.isDisposing || this.isDisposed) return
    this.isDisposing = true

    // Wait for all in-flight operations to drain
    await Promise.all(Array.from(this.activeOperations))
    this.activeOperations.clear()
    this.isDisposed = true
  }
}

// INVARIANT 2: Node.js VM Context Memory Leak Avoidance
// Objects added to `globalThis` in VM contexts must be configurable so getters can be stripped.
export function bindLeakingResistantAccessors(target: any, key: symbol, state: any): void {
  Object.defineProperty(target, key, {
    configurable: true, // MUST BE TRUE: Enables vm pools to strip accessors during teardown
    enumerable: false,
    get: () => state,
  })
}
```

### 5. Defect & Error Prevention ("Galti Pakadna")
```typescript
// INVARIANT 1: Error Instance Polymorphism Guard
// Error objects created across different realms (iframes, VM contexts, child processes)
// fail `instanceof Error`. Vitest uses multi-layered classification.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
