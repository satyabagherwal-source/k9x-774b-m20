# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: dubzzz/fast-check Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "dubzzz/fast-check",
  "source_url": "https://github.com/dubzzz/fast-check",
  "source_version": "1114b71b",
  "license": "MIT",
  "timestamp": "2026-11-17T08:42:32.369Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dubzzz-fast-check",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dubzzz/fast-check](https://github.com/dubzzz/fast-check) (Revision: `1114b71b`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:42:32.369Z`  
> **Learning ID**: `learn-github-dubzzz-fast-check`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence)
- **Confidence Rating**: 63%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from dubzzz/fast-check:

# Project Learning Record (Full-Spectrum Forensic Harvest): dubzzz/fast-check

---

## 1. Executive Forensic Architecture & System Mechanics

`dubzzz/fast-check` is a property-based testing (PBT) and fuzzing engine for JavaScript and TypeScript. PBT shifts the testing paradigm from verifying static input-output pairs to verifying mathematical and behavioral invariants across an infinite generator space.

```
+---------------------------------------------------------------------------------------------------+
|                                      FAST-CHECK RUNNER ENGINE                                      |
+---------------------------------------------------------------------------------------------------+
|  1. ARBITRARY DOMAIN GENERATOR LAYER                                                               |
|     fc.record(), fc.string(), fc.nat(), fc.commands()                                              |
|     - Stream-based generator DAGs with seed-driven PRNG (Mersenne Twister / PCG)                  |
|     - Reversible transformation mappings: Arbitrary<T> -> Shrinkable<T>                           |
+---------------------------------------------------------------------------------------------------+
                                                  | Value Generation
                                                  v
+---------------------------------------------------------------------------------------------------+
|  2. RUNNER & INTERCEPTOR PIPELINE (Synchronous/Asynchronous Dual Pipeline)                         |
|     runAllCallbacksAndReturn() / lifeCycleHooksRunner()                                            |
|     - Zero-overhead synchronous execution branch (prevents microtask queue saturation)            |
|     - Seamless async continuation shift upon detecting Promise/Thenable                           |
|     - Precondition filters (fc.pre): Abort execution without marking as failure                   |
+---------------------------------------------------------------------------------------------------+
                                                  |
                     +----------------------------+----------------------------+
                     | Execution Context                                       | Timeout / Abort Guard
                     v                                                         v
+-------------------------------------------------------+  +----------------------------------------+
| 3. MODEL-BASED STATE MACHINE SUBSYSTEM                |  | 4. SIGNAL & TIMEOUT CONTROL HARNESS   |
|    Command<Model, SystemUnderTest>                   |  |    TimeoutPlugin / mergeSignals        |
|    - check(Model): boolean -> Invariant Filter        |  |    - AbortSignal.any() composition     |
|    - run(Model, Real): void -> State Transition Check |  |    - High-precision wall-clock probes  |
+-------------------------------------------------------+  +----------------------------------------+
                                                  | Test Failure Encountered
                                                  v
+---------------------------------------------------------------------------------------------------+
|  5. SHRINK ENGINE (Counterexample Minimization)                                                    |
|     - Bisects, trims, and simplifies failing input space along the generator tree                 |
|     - Shrinks command sequences by eliminating redundant state transitions while preserving failure|
+---------------------------------------------------------------------------------------------------+
```

### Critical Subsystem Boundaries and Invariants

1. **Arbitrary vs. Shrinkable Decoupling**: The engine isolates value generation from value reduction. An `Arbitrary<T>` defines the structural grammar of random values. When evaluated with a seed, it yields a `Shrinkable<T>`, which encapsulates both the generated instance and a lazy stream of reduced counterexamples.
2. **Dual-Mode Synchronous/Asynchronous Runner**: JavaScript engines incur non-trivial microtask scheduling latency when wrapping functions in `Promise.resolve()`. `fast-check` executes all checks, lifecycle hooks, and callbacks synchronously by default. If and only if a step returns a `thenable` (`typeof out === 'object' && out !== null && 'then' in out'`), the runner promotes the execution pipeline into an asynchronous promise chain (`runAllCallbacksAndReturnAsync`).
3. **Pluggable Execution Context & Signal Composition**: Runner lifecycle extensions (timeouts, custom reporters, `beforeEach`/`afterEach`) are structured as composable higher-order functions decorating the core property runner. Context flows immutably via `PredicateExecutionContext`, where abort signals are combined using `AbortSignal.any()`.
4. **State Machine Verification Boundary**: Stateful fuzzing decouples the abstract mathematical model (`MusicPlayerModel`) from the concrete system under test (`MusicPlayer`). Commands define preconditions via `check(m: Model)` and postconditions/transitions via `run(m: Model, sut: SUT)`. The runner executes command arrays generated by `fc.commands()`, shrinking invalid sequences upon invariant breach.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Track Synchronous-First Execution Pipeline
**RULE**:
Execution harnesses wrapping user callbacks that may be either synchronous or asynchronous MUST execute synchronously by default and MUST NOT convert synchronous returns into Promises. The harness MUST conditionally branch to asynchronous promise continuations only upon encountering a Thenable return value.

**WHY**:
Promoting synchronous functions to `Promise.resolve()` introduces microtask queue hops, destroying throughput in tight execution loops (e.g., 100,000 property iterations). Converting sync executions to promises also alters execution semantics: synchronous stack traces are preserved directly, synchronous side effects complete immediately before subsequent iterations, and unnecessary heap allocations of `Promise` instances are eliminated.

**WHEN TO APPLY**:
Apply to test runners, lifecycle hook orchestrators, middleware pipelines, interceptors, and high-throughput plugin runners that accept `() => void | Promise<void>`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Executes a sequence of callbacks synchronously if possible;
 * shifts to asynchronous resolution only when a callback returns a Thenable.
 */
export function runAllCallbacksAndReturn<T>(
  value: T,
  runCallbackAtIndex: (index: number) => void | Promise<void>,
  callbacksCount: number,
): T | Promise<T> {
  let interceptedOnce = false;
  let interceptedError: unknown = undefined;

  for (let index = 0; index !== callbacksCount; ++index) {
    try {
      const out = runCallbackAtIndex(index);
      if (out !== undefined && typeof out === 'object' && out !== null && 'then' in out) {
        // Asynchronous branch: promote remaining callbacks to async continuation
        return runAllCallbacksAndReturnAsync(
          value,
          runCallbackAtIndex,
          out as Promise<void>,
          index,
          callbacksCount,
          interceptedOnce,
          interceptedError,
        );
      }
    } catch (error) {
      if (!interceptedOnce) {
        interceptedOnce = true;
        interceptedError = error;
      }
    }
  }

  if (interceptedOnce) {
    // Invariant: Never throw synchronously if the API contract guarantees a uniform return/rejection model
    return Promise.reject(interceptedError);
  }
  return value;
}

async function runAllCallbacksAndReturnAsync<T>(
  value: T,
  runCallbackAtIndex: (index: number) => void | Promise<void>,
  firstCallbackResult: Promise<void>,
  callbackIndex: number,
  callbacksCount: number,
  hasInitialError: boolean,
  initialError: unknown,
): Promise<T> {
  let interceptedOnce = hasInitialError;
  let interceptedError = initialError;

  for (let index = callbackIndex; index !== callbacksCount; ++index) {
    try {
      const out = index === callbackIndex ? firstCallbackResult : runCallbackAtIndex(index);
      if (out !== undefined) {
        await out;
      }
    } catch (error) {
      if (!interceptedOnce) {
        interceptedOnce = true;
        interceptedError = error;
      }
    }
  }

  if (interceptedOnce) {
    throw interceptedError;
  }
  return value;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Indiscriminately wrapping every callback in async/await or Promise.resolve
export async function runAllCallbacksBad<T>(
  value: T,
  callbacks: Array<() => void | Promise<void>>,
): Promise<T> {
  // Forcing microtask queue allocation for every synchronous iteration
  for (const cb of callbacks) {
    await cb(); // Performance collapse in 100k+ iterations
  }
  return value;
}
```

**VERIFICATION METHOD**:
Verify with a benchmark and test asserting that purely synchronous callbacks return a non-Promise primitive (`expect(result instanceof Promise).toBe(false)`), and verify execution order matches synchronous invocation without deferral to `process.nextTick` or microtask loops.

---

### 2. Post-Execution Wall-Clock Probe for Non-Preemptible Synchronous Runs
**RULE**:
When implementing timeout bounds around code blocks in single-threaded runtimes (such as JavaScript/Node.js/V8), the timeout harness MUST record a monotonic start timestamp (`performance.now()`) prior to execution and MUST check the elapsed duration upon synchronous return. If elapsed time exceeds the deadline, the harness MUST override any successful return value with a timeout failure.

**WHY**:
In single-threaded event loops, an active synchronous computation blocks the thread entirely; scheduled timer callbacks (`setTimeout`) cannot fire during execution. Without a post-run wall-clock delta check, a synchronous function that blocks the thread for longer than the timeout limit will return control to the runner and falsely register as successful because `clearTimeout` is invoked before the timer callback ever has a chance to execute.

**WHEN TO APPLY**:
Apply to all execution wrappers, test harnesses, sandboxes, and plugin systems where user-provided sync code is bounded by a timeout budget.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const safeSetTimeout = setTimeout;
const safeClearTimeout = clearTimeout;
const safePerformanceNow = performance.now.bind(performance);

export interface ExecutionFailure {
  error: Error;
}

export function timeoutAfter(timeMs: number) {
  let timeoutHandle: ReturnType<typeof safeSetTimeout> | undefined = undefined;
  const abortController = new AbortController();
  const startTimeProbe = safePerformanceNow();

  const promise = new Promise<ExecutionFailure>((resolve) => {
    timeoutHandle = safeSetTimeout(() => {
      const error = new Error(`Execution timeout: exceeded limit of ${timeMs} milliseconds`);
      resolve({ error });
      abortController.abort(error);
    }, timeMs);
  });

  return {
    clear: (): ExecutionFailure | undefined => {
      safeClearTimeout(timeoutHandle);
      // High-precision monotonic elapsed check for blocked synchronous execution
      if (safePerformanceNow() - startTimeProbe >= timeMs) {
        return {
          error: new Error(`Execution timeout: exceeded limit of ${timeMs} milliseconds`),
        };
      }
      return undefined;
    },
    promise,
    signal: abortController.signal,
  };
}

export function executeWithTimeout<TVal, TContext>(
  limitMs: number,
  runFn: (val: TVal, ctx: TContext) => unknown | Promise<unknown>,
  val: TVal,
  ctx: TContext,
): unknown | Promise<unknown> {
  const timer = timeoutAfter(limitMs);
  const out = runFn(val, ctx);

  if (out === null || typeof out !== 'object' || !('then' in out)) {
    // Synchronous execution branch: evaluate elapsed time
    const override = timer.clear();
    if (override !== undefined) {
      return override;
    }
    return out;
  }

  // Asynchronous execution branch: race against timer promise
  return Promise.race([
    out,
    timer.promise.then((failure) => failure),
  ]).finally(() => {
    timer.clear();
  });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Relying strictly on setTimeout for synchronous execution boundaries
function faultyTimeoutRunner(limitMs: number, fn: () => void) {
  let timedOut = false;
  const handle = setTimeout(() => { timedOut = true; }, limitMs);
  
  // If fn() executes synchronously for 5000ms when limitMs is 1000ms,
  // setTimeout cannot fire during this blocking period.
  fn(); 
  
  clearTimeout(handle); // Handle is cleared before the event loop can process timer!
  if (timedOut) throw new Error("Timed out"); // Never reached!
}
```

**VERIFICATION METHOD**:
Implement a mock or fake timer integration test where a synchronous predicate blocks execution past the timeout window (e.g. using `vi.advanceTimersByTime(10_000)` or busy loop), verifying that the harness flags a failure matching `Property timeout: exceeded limit of ${testTimeout} milliseconds`.

---

### 3. Leak-Free Signal-to-Promise Adapter Contract
**RULE**:
Whenever an `AbortSignal` is adapted into a Promise (for racing or notification), the adapter MUST explicitly remove its `abort` event listener when cleared or resolved, and MUST extract the `signal.reason` directly.

**WHY**:
Attaching event listeners to long-lived `AbortSignal` instances without guaranteed unsubscription causes unbounded heap leaks. In property-based testing where thousands of predicates execute against shared or chained signals, failure to deregister listeners retains the entire execution context closure in memory, eventually exhausting the Node.js/V8 heap.

**WHEN TO APPLY**:
Apply to all promise-signal bridging, timeout races, stream cancellations, and context deadline implementations.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function signalAsPromise(signal: AbortSignal): {
  promise: Promise<{ error: unknown }>;
  clear: () => void;
} {
  let onAbort: () => void = () => {};
  const promise = new Promise<{ error: unknown }>((resolve) => {
    onAbort = () => {
      const reason = signal.reason;
      resolve({ error: reason });
      signal.removeEventListener('abort', onAbort);
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return {
    promise,
    clear: () => signal.removeEventListener('abort', onAbort),
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Creating Promise without exposing unhook/clear capability
function leakySignalPromise(signal: AbortSignal) {
  return new Promise((resolve) => {
    // If signal does not abort, this closure retains outer references indefinitely
    signal.addEventListener('abort', () => resolve(signal.reason));
  });
}
```

**VERIFICATION METHOD**:
Execute 10,000 iterations of signal conversion and clearance under test; assert that the listener count on the signal remains zero (`expect(signal.listenerCount?.('abort') ?? 0).toBe(0)`).

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Pass on Synchronous Predicate Timeout Overrun (BUG-FASTCHECK-7573)
- **Context**: TimeoutPlugin execution decorator in `packages/fast-check/src/check/plugin/TimeoutPlugin.ts`
- **What Was Expected**: If a test predicate configured with `timeout(1000)` runs for 10,000ms synchronously, the runner must report a property failure due to exceeding the timeout limit.
- **What Actually Happened**: The predicate returned normally. The `TimeoutPlugin` assumed that because the returned value was synchronous (`runOut === null || !('then' in runOut)`), there was nothing to race against. It called `t.clear()` and returned `runOut`, falsely reporting success despite exceeding the timeout limit by 900%.
- **Evidence in Repo**: Commit `d7278047`, PR #7573, test suite in `packages/fast-check/src/check/plugin/TimeoutPlugin.spec.ts`.
- **Root Cause**: The runner assumed single-threaded execution guarantees meant synchronous timeouts could not be tracked. Because `setTimeout` callbacks cannot interrupt active synchronous JavaScript execution, the plugin cleared the pending timer immediately after execution returned, preventing the scheduled timer from ever detecting the violation.
- **Remediation Code Diff**:
```typescript
--- a/packages/fast-check/src/check/plugin/TimeoutPlugin.ts
+++ b/packages/fast-check/src/check/plugin/TimeoutPlugin.ts
@@ -7,19 +7,30 @@ import { mergeSignals, signalAsPromise } from './utils/Signals.js';
 
 const safeSetTimeout = setTimeout;
 const safeClearTimeout = clearTimeout;
+const safePerformanceNow = performance.now.bind(performance);
+
+function buildErrorMessage(timeMs: number) {
+  return `Property timeout: exceeded limit of ${timeMs} milliseconds`;
+}
 
 function timeoutAfter(timeMs: number) {
   let timeoutHandle: ReturnType<typeof setTimeout> | undefined = undefined;
   const abortController = new AbortController();
+  const startTimeProbe = safePerformanceNow();
   const promise = new Promise<PropertyFailure>((resolve) => {
     timeoutHandle = safeSetTimeout(() => {
-      const error = new Error(`Property timeout: exceeded limit of ${timeMs} milliseconds`);
+      const error = new Error(buildErrorMessage(timeMs));
       resolve({ error });
       abortController.abort(error);
     }, timeMs);
   });
   return {
-    clear: () => safeClearTimeout(timeoutHandle),
+    clear: () => {
+      safeClearTimeout(timeoutHandle);
+      if (safePerformanceNow() - startTimeProbe >= timeMs) {
+        return { error: new Error(buildErrorMessage(timeMs)) };
+      }
+    },
     promise,
     signal: abortController.signal,
   };
@@ -43,7 +54,10 @@ function timeoutRunner(
   const runOut = nestedRun(value, extendedExecutionContext);
   if (runOut === null || !('then' in runOut)) {
     // synchronous run: it already came to an end, nothing to race against the timeout
-    t.clear();
+    const overrideRunOut = t.clear();
+    if (overrideRunOut !== undefined) {
+      return overrideRunOut;
+    }
     return runOut;
   }
```
- **Lesson**: Synchronous code cannot be interrupted cooperatively in single-threaded runtimes, but its completion duration can and must be measured against monotonic time before validating success.

---

### Incident 2: Lifecycle Hook Execution Reversal & Asynchronous Collapse (BUG-FASTCHECK-LIFECYCLE)
- **Context**: Lifecycle hook composition in `packages/fast-check/src/check/plugin/LifeCyclePlugins.ts`
- **What Was Expected**: Teardown hooks returned by `beforeEach` and explicitly declared `afterEach` hooks must execute in reverse declaration order (LIFO), preserving the exact failure state if the inner predicate throws.
- **What Actually Happened**: When switching between synchronous and asynchronous hooks midway through teardown, execution order was violated or errors in teardown functions overwrote predicate failure details.
- **Evidence in Repo**: `packages/fast-check/src/check/plugin/LifeCyclePlugins.ts`, lines 18–39 and 100–160.
- **Root Cause**: Index alignment between dynamic teardown callbacks returned from `beforeEach` and statically declared `afterHooks` was out of order when mapped into a single array. Furthermore, standard Promise rejections in `after` hooks wiped out the initial test failure reason.
- **Remediation Code Diff**:
```typescript
// Unified index-based LIFO sorting:
const afterAndPluginIndices: { index: number; fn: TeardownFunction | AfterEachHook }[] = [];
for (const value of teardownFunctions) {
  const { index, fn } = value;
  afterAndPluginIndices.push({ index: hooks.beforeHooksIndices[index], fn });
}
for (let index = 0; index !== hooks.afterHooks.length; ++index) {
  afterAndPluginIndices.push({ index: hooks.afterHooksIndices[index], fn: hooks.afterHooks[index] });
}
afterAndPluginIndices.sort((a, b) => a.index - b.index);

// Error preservation invariant:
(error) => previous ?? { error } // Never overwrite previous test failure with teardown failure
```
- **Lesson**: Teardown hooks must execute in reverse order (LIFO), and teardown errors must never mask primary assertion failures.

---

### Incident 3: First-Error Latch Inversion in Callback Loops (BUG-FASTCHECK-CALLBACKS)
- **Context**: `packages/fast-check/src/check/runner/utils/AllCallbacksThenReturnRunner.ts`
- **What Was Expected**: When running a batch of callbacks, all callbacks must attempt cleanup, but the runner must fail with the *first* encountered error.
- **What Actually Happened**: If callback #1 threw an error and callback #3 also threw an error during cleanup, subsequent errors overwrote the primary error, obfuscating the root cause.
- **Evidence in Repo**: `AllCallbacksThenReturnRunner.ts`, lines 14–22 and 45–54.
- **Root Cause**: Unlatched `try/catch` in loop reassigned the error variable on each caught exception.
- **Remediation Code Diff**:
```typescript
// Enforce single-latch error capture:
let interceptedOnce = false;
let interceptedError: unknown = undefined;

for (let index = 0; index !== callbacksCount; ++index) {
  try {
    const out = runCallbackAtIndex(index);
    // ...
  } catch (error) {
    if (!interceptedOnce) {
      interceptedOnce = true;
      interceptedError = error;
    }
  }
}
```
- **Lesson**: In multi-step cleanup/teardown pipelines, use a latch pattern (`interceptedOnce`) to capture the primary failure while allowing remaining steps to run.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Thenable Detection via In-Operator vs. Truthiness**:
  Do not use `if (out)` or `if (out instanceof Promise)` to detect promises. In TypeScript/JS library architecture, objects from other realms (Node `vm`, worker threads, or custom Thenables) fail `instanceof Promise`.
  ```typescript
  // CORRECT: Multi-guard boundary check
  if (out !== null && typeof out === 'object' && 'then' in out) {
    wrappedRunContinuation = out;
  }
  ```
- **Symbol Namespace Isolation**:
  Lifecycle plugins use `Symbol.for('fast-check/plugin/life-cycle')` rather than `Symbol('...')` or string properties. This guarantees cross-package and cross-version identity across multiple bundled instances in a monorepo while remaining collision-proof against user-defined object keys.

### 2. Infinite Loop & Recursion Guards
- **Model-Based Generator Shrink Bounds**:
  In state machine testing (`MusicPlayerCommands.ts`), command generation must guard against unbounded state growth:
  ```typescript
  // Invariant: Position modulo model boundary prevents out-of-bounds indexing
  p.addTrack(this.trackName, this.position % (m.numTracks + 1));
  ```
  Without the modulo operator `this.position % (m.numTracks + 1)`, arbitrary natural numbers generated by `fc.nat()` would create sparse arrays or unbounded index gaps, causing memory expansion and iteration hangs during shrinking.

### 3. UI & UX Micro-Mechanics (Test Runner Diagnostics)
- **Error Formatting & Terminal Non-Reflow**:
  Fast-check property outputs format counterexamples into reproducible seeds: `fc.assert(..., { seed: 12345, path: "0:1:0" })`. The formatting mechanics ensure that console outputs do not trigger terminal buffer recalculations or infinite scrollback overhead during long test runs.

### 4. Backend Concurrency & Memory Safety
- **Signal Merging via `AbortSignal.any`**:
  ```typescript
  export function mergeSignals(
    executionContext: PredicateExecutionContext,
    extraSignal: AbortSignal,
  ): PredicateExecutionContext {
    const originalSignal = executionContext.signal;
    const signal = originalSignal === undefined ? extraSignal : AbortSignal.any([originalSignal, extraSignal]);
    return { ...executionContext, signal };
  }
  ```
  `AbortSignal.any()` delegates signal composition to the runtime C++ internals, avoiding memory leaks from manual forwarding event listeners across multiple controllers.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Preservation of Precondition Failures**:
  ```typescript
  onAbort = () => {
    const reason = signal.reason;
    resolve(PreconditionFailure.isFailure(reason) ? reason : { error: reason });
    signal.removeEventListener('abort', onAbort);
  };
  ```
  A precondition rejection (`fc.pre(...)`) represents an invalid input domain that must be skipped, not a test failure. The engine inspects `PreconditionFailure.isFailure(reason)` to prevent false positive regression alerts.

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The repository separates concerns across discrete layers:
- Arbitrary definition (`packages/fast-check/src/arbitrary`)
- Execution engine & property runners (`packages/fast-check/src/check/runner`)
- Plugin & Interceptor decorators (`packages/fast-check/src/check/plugin`)
- Model-Based state machine contracts (`packages/fast-check/src/check/model`)

### Dimension 2: Core Abstractions
- `Arbitrary<T>`: Abstract factory producing `Shrinkable<T>`.
- `Command<Model, SUT>`: Encapsulates state validation (`check`) and execution verification (`run`).
- `UniversalPlugin`: Decorator wrapping `nestedRun` inside higher-order execution logic.

### Dimension 3: Error Handling
- Hierarchical failure discrimination:
  - `PropertyFailure`: Concrete invariant violation (triggers shrinking).
  - `PreconditionFailure`: Discarded candidate value (does not trigger failure; triggers generation retry).
  - System Errors (e.g. timeout overruns): Converted to `PropertyFailure` with full parameter seeds.

### Dimension 4: Testing
- High-order property testing on the testing engine itself (dogfooding):
  - Vitest test suite testing Arbitrary shrink monotonicity.
  - Benchmarks tracking execution throughput across generator configurations.
  - Fake timer tests simulating time jumps for long-running sync tasks.

### Dimension 5: Security
- Sandboxed symbol stores prevent prototype pollution in `PredicateExecutionContext`.
- Monotonic time checks (`performance.now`) prevent time manipulation attacks or clock drift bugs during test property assessment.

### Dimension 6: Performance
- Zero-Promise path optimization: Purely synchronous checks execute with zero event-loop overhead.
- Array iteration avoiding high-order allocation:
  ```typescript
  for (let index = 0; index !== hooks.beforeHooks.length; ++index)
  ```
  Uses strict `!==` bounds without dynamic closure recreation.

### Dimension 7: Deployment & Monorepo Constraints
- Modern toolchain: Built with `rolldown` and `rolldown-plugin-dts`.
- Linting/Formatting: Next-generation Rust-based tooling (`oxlint`, `oxfmt`).
- Node devEngines `>=22` and pnpm `12.21.0`. Strict package publishing checks via `publint`.

### Dimension 8: Agent Patterns & Tooling Interfaces
- Model-based `Command` objects function as deterministic agent actions. An AI agent generating tests can model complex systems by emitting `check()` rules and `run()` verifications, providing mathematical proof of correctness.

### Dimension 9: Data Flow
```
Seed (Integer)
  --> PRNG Stream
    --> Arbitrary Mapping
      --> Value Generation
        --> Predicate Execution (Synchronous / Async)
          --> [On Failure] Bisect & Shrink Tree
            --> Minimal Counterexample Extraction
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern
**Synchronous-Fast Path Runner**:
```typescript
function runOptimisticSync<T>(
  task: () => T | Promise<T>,
  onSuccess: (val: T) => void,
): void | Promise<void> {
  const res = task();
  if (res !== null && typeof res === 'object' && 'then' in res) {
    return (res as Promise<T>).then(onSuccess);
  }
  onSuccess(res);
}
```

### 2. Rule
The execution engine MUST preserve the original test failure when cleanup or teardown hooks fail subsequently. Primary failures MUST NOT be masked by teardown exceptions.

### 3. Architecture Principle
**Invariant Decoupling**: Separation of generation logic (`Arbitrary`) from execution verification (`Property`) and from test execution decorators (`Plugins`).

### 4. Failure Mode
Single-threaded starvation masking: A synchronous blocking function runs longer than a timeout limit, but passes because `clearTimeout` is invoked before the JavaScript event loop can trigger the timer callback.

### 5. Reusable Skill
**Building a Model-Based State Machine Test**:
1. Define abstract `Model` state representing truth.
2. Define `SystemUnderTest` concrete implementation.
3. Write atomic `Command` classes with `check(model)` precondition guards and `run(model, sut)` invariant assertions.
4. Compose commands into `fc.commands(...)` and assert via `fc.assert(fc.property(...))`.

### 6. Decision
Choosing `performance.now()` over `Date.now()`: `performance.now()` provides monotonic timestamps unaffected by system clock adjustments, leap seconds, or NTP synchronization shifts.

### 7. Anti-Pattern
Wrapping synchronous operations in `new Promise((resolve) => resolve(fn()))` inside tight test runner loops, degrading execution throughput.

### 8. Verification Method
Run fake timer property tests verifying that `vi.advanceTimersByTime(exceededTime)` inside a synchronous block correctly yields `{ error: Error("Property timeout: exceeded limit...") }`.

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### AI Coding Agent Verification Checklist for Execution Wrappers

- [ ] **Dual Synchronous/Asynchronous Handling**
  - [ ] Check if the callback return value is a thenable (`'then' in out`).
  - [ ] Do not wrap synchronous callbacks in `Promise.resolve()` or `async/await`.
  - [ ] Ensure synchronous executions return values synchronously without queuing microtasks.

- [ ] **Timeout Enforcement on Synchronous Predicates**
  - [ ] Record start time using monotonic clock: `safePerformanceNow = performance.now.bind(performance)`.
  - [ ] In the `clear()` / cleanup method, compute elapsed duration: `safePerformanceNow() - startTimeProbe`.
  - [ ] If elapsed time >= `timeoutMs`, return/throw timeout error, overriding any successful return value.

- [ ] **Signal & Listener Leak Prevention**
  - [ ] When binding to `AbortSignal`, always provide a teardown function removing the listener (`signal.removeEventListener`).
  - [ ] Use `{ once: true }` when possible.
  - [ ] Use `AbortSignal.any([sigA, sigB])` to compose signals rather than manually forwarding abort events.

-

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
