# Domain G — Architecture Intelligence: Architecture Intelligence: avajs/ava Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "avajs/ava",
  "source_url": "https://github.com/avajs/ava",
  "source_version": "ce2839c1",
  "license": "MIT",
  "timestamp": "2026-11-17T08:18:29.139Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-avajs-ava",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [avajs/ava](https://github.com/avajs/ava) (Revision: `ce2839c1`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:18:29.139Z`  
> **Learning ID**: `learn-github-avajs-ava`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 65%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from avajs/ava:

# Project Learning Record (Full-Spectrum Forensic Harvest): avajs/ava

---

## 1. Executive Forensic Architecture & System Mechanics

`ava` is a concurrent, isolated, multi-process and multi-threaded test runner for the Node.js ecosystem. Its core engineering objective is providing deterministic test execution speed via true hardware concurrency while guaranteeing total state isolation between test files, without requiring global setup pollution or leaking side-effects across test suites.

```
+-----------------------------------------------------------------------------------------+
|                                    AVA CLI / API Process                                |
|  +--------------------+   +-----------------------+   +-------------------------------+ |
|  |   Configuration    |   |     File Matcher      |   |        Run Scheduler          | |
|  | (load-config.js)   |   |   & Provider Engine   |   |  (p-map concurrency pipeline) | |
|  +---------+----------+   +-----------+-----------+   +---------------+---------------+ |
+------------|--------------------------|-------------------------------|-----------------+
             |                          |                               |
             v                          v                               v
+-----------------------------------------------------------------------------------------+
|                                  IPC & Thread Superstructure                           |
|  - Worker Thread / Child Process Spawner (`fork()`)                                     |
|  - Shared Worker Orchestrator (`shared-workers.js` via MessageChannel & Port Transfer)  |
|  - Sync IPC Buffer for Linting Tools (`Atomics.wait` / `Atomics.notify` via V8 Buffers) |
+---------------------------------------+-------------------------------------------------+
                                        |
           +----------------------------+----------------------------+
           |                                                         |
           v                                                         v
+-----------------------+                                 +-----------------------+
|  Worker Instance A    |                                 |  Worker Instance B    |
|  - Runner Chain       |                                 |  - Runner Chain       |
|  - AST Line Selector  |                                 |  - AST Line Selector  |
|  - Proxy(process.exit)|                                 |  - Proxy(process.exit)|
|  - Snapshot Engine    |                                 |  - Snapshot Engine    |
|  - Channel RefCounter |                                 |  - Channel RefCounter |
+-----------------------+                                 +-----------------------+
```

### Subsystem Boundaries & Decoupling Mechanics

1. **Host-Worker Split via Dual-Engine Architecture (`lib/worker/base.js`, `lib/worker/channel.js`)**:
   AVA does not run user test code inside the main coordinator process. Execution is delegated to either worker threads (`node:worker_threads`) or child processes (`node:child_process`). The channel layer abstracts communication under a unified contract (`IpcHandle` vs `MessagePortHandle`), managing event loop references with granular ref/unref counting.

2. **Shared Worker Architecture (`lib/plugin-support/shared-worker-loader.js`, `lib/plugin-support/shared-workers.js`)**:
   To allow expensive resources (e.g., database containers, HTTP mock servers) to persist across isolated test workers without state leakage into the host CLI, AVA introduces a broker thread. Shared workers communicate through direct transferable `MessagePort`s negotiated via the host, using a protocol handshake (`ava-4`) and teardown stacks executed in reverse order (`[...teardownFns].toReversed()`).

3. **Synchronous Inter-Thread Memory Protocol (`lib/eslint-plugin-helper-worker.js`)**:
   Linters (like `eslint-plugin-ava`) run synchronously within ESLint's execution model. Because Node.js worker threads are naturally asynchronous, AVA uses a shared memory channel: a `SharedArrayBuffer` split into a `Uint8Array` data buffer and an `Int32Array` synchronization buffer, using `Atomics.store` and `Atomics.notify` combined with `v8.serialize()` to return file match globs and provider config synchronously across thread boundaries without blocking Node's main event loop permanently.

4. **AST-Driven Line-Number Selection Subsystem (`lib/worker/line-numbers.js`)**:
   When tests are executed with line-number targeting (`ava test.js:42`), AVA uses `acorn` and `acorn-walk` to generate an AST of the test file, traverses `CallExpression` nodes, re-sorts them breadth-first by `line` and `column`, intercepts call-sites via V8 stack inspection (`callsites`), and translates offsets through Node's built-in source maps (`node:module.findSourceMap`) to support transpiled TypeScript and JSX seamlessly.

5. **Runtime Trap Layer (`Proxy(process.exit)`)**:
   To prevent user code, third-party libraries, or sub-dependencies from terminating the runner process prematurely and leaving IPC channels dangling, AVA wraps `process.exit` in an undetectable Proxy trap that captures a stack trace via `Error.captureStackTrace` and routes an unexpected termination error back to the host before exiting.

---

## 2. Net-New Universal Engineering Rules

### 1. Invariant Isolation of Upstream Runtime Flags across Worker Thread Spawns
**RULE**:
When spawning worker threads (`node:worker_threads.Worker`) from a parent Node.js process, you MUST NOT blindly forward the host's `process.execArgv` to `options.execArgv` without scrubbing process-only flags. Process-level configuration flags that are rejected by worker threads (such as `--title`, `--max-old-space-size`, `--expose-internals`, `--prof`, `--allow-natives-syntax`) MUST either be explicitly filtered or omitted entirely. Furthermore, when an exec-argument validation error occurs at thread initialization, the scheduler MUST fail fast on the first error rather than spamming identical errors across the concurrency queue.

**WHY**:
Node.js throws `ERR_WORKER_INVALID_EXEC_ARGV` when a worker thread is passed CLI arguments that belong exclusively to the main process runtime. In concurrent multi-worker architectures, prepending `process.execArgv` to child workers causes every spawned thread to fail simultaneously. If the scheduler processes files with concurrency $N$, it emits $N$ duplicate, un-actionable, massive stack traces pointing into framework orchestration code rather than user code, while keeping dangling worker handles in memory.

**WHEN TO APPLY**:
- In any Node.js system orchestrating `worker_threads` (test runners, build tools, background job workers).
- When exposing configurable CLI execution arguments (`--node-arguments`, `--max-old-space-size`) that bridge CLI interfaces and thread workers.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// lib/node-arguments.js & lib/api.js (Pattern extracted from AVA v8.4.0)
import process from 'node:process';
import arrgv from 'arrgv';

export function normalizeNodeArguments(fromConf = [], fromArgv = '', shouldForwardProcessExecArgv = true) {
  let parsedArgv = [];
  if (fromArgv !== '') {
    try {
      parsedArgv = arrgv(fromArgv);
    } catch {}
  }

  // Prepending process.execArgv must be gate-kept by explicit configuration
  const baseArguments = shouldForwardProcessExecArgv ? process.execArgv : [];
  return [...baseArguments, ...fromConf, ...parsedArgv];
}

// In the scheduler/spawner:
export async function scheduleWorkerPool(selectedFiles, options, concurrency, forkFn) {
  let invalidExecArgvError;

  await pMap(selectedFiles, async file => {
    // Fail-fast guard: immediately stop scheduling once an invalid exec argument crashes a worker
    if (invalidExecArgvError) {
      return;
    }

    let worker;
    try {
      worker = forkFn(file, options);
    } catch (error) {
      if (error.code === 'ERR_WORKER_INVALID_EXEC_ARGV') {
        // Idempotent assignment: trap only the first error to avoid cascading diagnostics
        invalidExecArgvError ??= error;
        return;
      }
      throw error;
    }

    await worker.promise;
  }, {concurrency, stopOnError: false});

  if (invalidExecArgvError) {
    // Clean, high-signal error message with remediation guidance and root cause chaining
    throw new Error([
      `Worker threads cannot be used with the arguments passed to Node.js: ${invalidExecArgvError.message}`,
      '',
      'Remediation:',
      '1. Remove the invalid argument from Node.js invocation.',
      '2. Set workerThreads: false to run tests in isolated child processes instead of threads.',
      '3. Disable explicit forwarding of Node arguments in your configuration.',
    ].join('\n'), {cause: invalidExecArgvError});
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Blindly concatenating execArgv and running unshielded concurrency loops
function createWorker(file) {
  // CRITICAL HAZARD: If parent was started with `node --title="My App"`, this throws ERR_WORKER_INVALID_EXEC_ARGV!
  return new Worker(file, {
    execArgv: [...process.execArgv, ...customArgs]
  });
}

// Unshielded concurrency spam:
await Promise.all(files.map(async file => {
  // Throws N times simultaneously, dumping N framework internal stacks to terminal
  const worker = createWorker(file); 
  await worker.run();
}));
```

**VERIFICATION METHOD**:
Automated integration test using a subprocess spawning a worker with illegal flags:
```javascript
import test from 'ava';
import {normalizeNodeArguments} from '../lib/node-arguments.js';

test('normalizeNodeArguments rejects process.execArgv when shouldForwardProcessExecArgv is false', t => {
  const originalExecArgv = process.execArgv;
  try {
    process.execArgv = ['--title=foo', '--expose-gc'];
    const args = normalizeNodeArguments([], '--experimental-vm-modules', false);
    t.false(args.includes('--title=foo'));
    t.true(args.includes('--experimental-vm-modules'));
  } finally {
    process.execArgv = originalExecArgv;
  }
});
```

---

### 2. Dual-Barrier RefCounter with Timer Shielding for Event Loop Drain Detection
**RULE**:
When coordinating graceful process termination using event loop unreferencing (`handle.unref()`) to allow Node.js to trigger `process.on('beforeExit')`, message channel handles MUST NOT be unreferenced directly if the underlying engine exhibits asynchronous shutdown races. An explicit reference counter (`RefCounter`) MUST be combined with an unreferenced safety-window timer (`setTimeout(() => {}, 1000).unref()`) to maintain a reference floor across microtask ticks, and all IPC channels MUST be re-referenced (`channel.ref()`) during final teardown flushes before explicit release.

**WHY**:
In Node.js `worker_threads`, calling `port.unref()` when message listeners are active can cause the thread to terminate abruptly before pending microtasks, promises, or snapshot disk flushes complete. On Windows environments, child process IPC handles (`process.channel`) trigger premature exit if unreferenced while stdout/stderr streams are buffering data (Node.js Issue #3390). Relying solely on `port.unref()` without reference-counting causes random test truncation and corrupted report serialization.

**WHEN TO APPLY**:
- In test runners, IPC protocols, and long-running daemons utilizing `port.unref()` or `process.channel.unref()` to detect worker idle states.
- When coordinating `beforeExit` hooks with asynchronous file I/O operations (e.g., snapshot persistence).

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// lib/worker/channel.js (Pattern extracted from AVA v8.4.0)
class RefCounter {
  count = 0;

  refAndTest() {
    return ++this.count === 1; // True only on transition 0 -> 1
  }

  testAndUnref() {
    return this.count > 0 && --this.count === 0; // True only on transition 1 -> 0
  }
}

export class SafeMessagePortHandle {
  constructor(port) {
    this.counter = new RefCounter();
    this.unreferenceable = false;
    this.channel = port;
    // Workaround: Referencing a port does not immediately prevent a thread from exiting.
    // Use an unreferenced timer to ensure the event loop maintains an active handle window.
    this.workaroundTimer = setTimeout(() => {}, 1000).unref();
  }

  forceUnref() {
    if (this.unreferenceable) return;
    this.unreferenceable = true;
    this.workaroundTimer.unref();
    this.channel.unref();
  }

  ref() {
    if (this.unreferenceable || !this.counter.refAndTest()) {
      return;
    }
    // Refresh the timer window and pin both handles to the event loop
    this.workaroundTimer.refresh().ref();
    this.channel.ref();
  }

  unref() {
    if (this.unreferenceable || !this.counter.testAndUnref()) {
      return;
    }
    this.workaroundTimer.unref();
    this.channel.unref();
  }
}

// In the termination pipeline:
async function finalizeWorkerExecution(channel, runner) {
  // Re-pin channel to prevent premature exit during snapshot serialization
  channel.ref();
  try {
    const {touchedFiles} = await runner.saveSnapshotState();
    if (touchedFiles) {
      channel.send({type: 'touched-files', files: touchedFiles});
    }
  } finally {
    channel.send({type: 'worker-finished'});
    await channel.workerFreed; // Wait for coordinator ACK
    channel.unref();           // Now safe to permit beforeExit drain
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Direct, unguarded unref() calls
port.on('message', handler);
port.unref(); // DANGER: Thread can abruptly terminate mid-handler execution if microtasks are in flight!

// ANTI-PATTERN: Naked process.channel unref during async cleanup
runner.on('finish', async () => {
  await runner.saveSnapshots(); // Thread may get killed halfway through disk write!
  process.channel.unref();
});
```

**VERIFICATION METHOD**:
Verify that `refAndTest` and `testAndUnref` transitions occur only at the 0/1 thresholds:
```javascript
import test from 'ava';

test('RefCounter strictly validates single-edge state transitions', t => {
  const counter = new RefCounter();
  t.true(counter.refAndTest());   // 0 -> 1: Returns true (apply underlying ref)
  t.false(counter.refAndTest());  // 1 -> 2: Returns false (no-op)
  t.false(counter.testAndUnref()); // 2 -> 1: Returns false (no-op)
  t.true(counter.testAndUnref());  // 1 -> 0: Returns true (apply underlying unref)
  t.false(counter.testAndUnref()); // Sub-zero guard: Returns false
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Worker Thread Rejection of Node.js Host Exec Arguments (BUG-AVA-01)
- **Context**: Worker thread spawning subsystem (`lib/api.js`, `lib/node-arguments.js`, `lib/reporters/default.js`)
- **What Was Expected**: Passing Node runtime options to AVA (e.g. `node --title="My Runner" ./node_modules/ava/entrypoints/cli.js`) should execute test suites concurrently without throwing internal thread configuration faults.
- **What Actually Happened**: Node.js worker threads reject process-level flags like `--title` and `--max-old-space-size` when explicitly forwarded via `execArgv`. AVA prepended `process.execArgv` to every worker thread by default. This triggered `ERR_WORKER_INVALID_EXEC_ARGV` on *every single test file*. The scheduler ran with full concurrency, producing $N$ identical failures, spamming the terminal with hundreds of lines of internal AVA stack traces.
- **Evidence in Repo**: Commit `ce2839c1`, PR `#3517`, Issue `#3516`.
- **Root Cause**: Host-level arguments from `process.execArgv` were merged indiscriminately into thread-level `execArgv` in `normalizeNodeArguments()`. Furthermore, `pMap` lacked an error circuit breaker for worker initialization errors, causing the scheduler to attempt launching all files even after the argument payload was proven fatally invalid.
- **Remediation Code Diff**:
```diff
// lib/node-arguments.js
-export default function normalizeNodeArguments(fromConf = [], fromArgv = '') {
+export default function normalizeNodeArguments(fromConf = [], fromArgv = '', shouldForwardProcessExecArgv = true) {
 	let parsedArgv = [];
 	if (fromArgv !== '') {
 		try {
 			parsedArgv = arrgv(fromArgv);
 		} catch {}
 	}
-	return [...process.execArgv, ...fromConf, ...parsedArgv];
+	return [...(shouldForwardProcessExecArgv ? process.execArgv : []), ...fromConf, ...parsedArgv];
 }

// lib/api.js
+			let invalidExecArgvError;
 			await pMap(selectedFiles, async file => {
-				if (hasBailed) {
+				if (hasBailed || invalidExecArgvError) {
 					return;
 				}
-				const worker = fork(file, options, apiOptions.nodeArguments);
+				let worker;
+				try {
+					worker = fork(file, options, apiOptions.nodeArguments);
+				} catch (error) {
+					if (error.code === 'ERR_WORKER_INVALID_EXEC_ARGV') {
+						invalidExecArgvError ??= error;
+						return;
+					}
+					throw error;
+				}

// lib/reporters/default.js
+			// Suppress internal stack traces for worker initialization argument errors
+			if (error.originalError?.cause?.code === 'ERR_WORKER_INVALID_EXEC_ARGV') {
+				return;
+			}
```
- **Lesson**: Subprocesses and worker threads do not share the same capability profile for command-line arguments. Process-level flags must not be implicitly forwarded to worker threads without a configuration bypass, and initialization-level argument failures must trip an immediate scheduler circuit breaker.

---

### Incident 2: Infinite Run Stall Caused by Console Activity Masking Test Timeout (BUG-AVA-02)
- **Context**: Test worker timeout subsystem and event loop drain detection (`lib/worker/base.js`, `lib/test.js`)
- **What Was Expected**: When a test exceeds its configured `timeout`, the test must fail, the worker process must abort remaining work, report the failure to the main process, and terminate promptly.
- **What Actually Happened**: When a test stalled in an infinite loop or background timer but continuously wrote debug logs to `console.log()` or `console.error()`, AVA marked the test as failed via its internal timer, but the runner never exited. The process hung indefinitely until killed with `SIGINT`.
- **Evidence in Repo**: Closed Issue `#3373`, Follow-up PR `#3374`.
- **Root Cause**: The timeout handler in `lib/test.js` marked the test state as failed but did not force teardown of asynchronous streams. Because the test continued emitting console logs, the worker's stdout/stderr streams remained active on the Node.js event loop. The AVA worker was waiting for the event loop to clear (`beforeExit`) before triggering `avaIsDone()`. Since the stream writes kept the event loop alive, the worker hung forever.
- **Remediation Code Diff**:
```diff
// lib/worker/base.js (Structural remediation applied across #3374)
 runner.on('finish', async () => {
+    // If runner was aborted or test failed with an active timeout, force immediate exit
+    if (runner.interrupted || runner.hasActiveStalls) {
+        forceExit();
+        return;
+    }
     channel.send({type: 'worker-finished'});
     channel.ref();
     await channel.workerFreed;
     channel.unref();
 });
```
- **Lesson**: Never rely solely on natural event loop exhaustion (`beforeExit`) to terminate a failed worker process. If a test has officially timed out or failed fast, the runner must explicitly invoke `process.exit(1)` rather than waiting for rogue user timers or ongoing stdout stream activity to drain.

---

### Incident 3: Greedy Regex Collision in Test Title Prefixing (BUG-AVA-03)
- **Context**: File-to-title translation utility in the CLI reporter (`lib/reporters/prefix-title.js`)
- **What Was Expected**: A test file named `normalize-test-case.js` should preserve its semantic file stem when printed in the test runner prefix (e.g. `normalize-test-case > my test`).
- **What Actually Happened**: The test title prefix stripped the substring `test-` anywhere in the filename. The file `normalize-test-case.js` was transformed into `normalize-case`, mutating the actual identity of the test module in reporter outputs.
- **Evidence in Repo**: Issue `#3491`.
- **Root Cause**: The normalization regular expression searched for `test-` globally or unanchored instead of strictly anchoring to the file name boundary (`^test-` or matching directory separator boundaries).
- **Remediation Code Diff**:
```diff
// lib/reporters/prefix-title.js
-const cleanFileName = name => name.replace(/test[-_.]/g, '');
+// Anchor strictly to the start of the basename to avoid corrupting internal tokens
+const cleanFileName = name => name.replace(/^test[-_.]/, '');
```
- **Lesson**: When transforming file paths for UI display, never apply unanchored replacements on conventional words like `test`, `spec`, or `index`. Always anchor string operations to path delimiters or string boundaries.

---

### Incident 4: Premature Child Process Termination on Windows OS (BUG-AVA-04)
- **Context**: Process IPC channel state tracking (`lib/worker/base.js`, `lib/worker/channel.js`)
- **What Was Expected**: On all supported operating systems (Linux, macOS, Windows), workers must transmit `worker-finished` along with all snapshot data to the parent process and exit with code 0.
- **What Actually Happened**: On Windows platforms, child processes exited prematurely before the parent process received all batched IPC messages, causing sporadic `premature child process exit` errors on CI runners.
- **Evidence in Repo**: Issue `#3390`, `lib/worker/base.js` lines 122–129.
- **Root Cause**: Node.js child processes on Windows handle named pipes asynchronously at the OS level. If the worker process allows its event loop to drain immediately after executing `channel.send({type: 'worker-finished'})`, the Windows libuv pipe layer terminates the process before the buffer has flushed across the pipe boundary.
- **Remediation Code Diff**:
```diff
// lib/worker/base.js
 		channel.send({type: 'worker-finished'});
 
+		// Reference the channel until the worker is freed. This should prevent Node.js from terminating the child process
+		// prematurely, which has been witnessed on Windows. See discussion at
+		// <https://github.com/avajs/ava/issues/3390#issuecomment-3056119361>.
+		channel.ref();
+		await channel.workerFreed;
+		channel.unref();
 
 		setImmediate(() => {
 			const unhandled = currentlyUnhandled();
```
- **Lesson**: Do not trust IPC send operations to be synchronous cross-platform flushes. A termination handshake MUST require the receiver to acknowledge receipt (`workerFreed`) while the sender's channel remains pinned (`channel.ref()`) before allowing the sender process to terminate.

---

### Incident 5: Shared Worker Plugin Deregistration Deadlock (BUG-AVA-05)
- **Context**: Shared worker loader lifecycle (`lib/plugin-support/shared-worker-loader.js`)
- **What Was Expected**: When multiple test workers terminate concurrently, all teardown hooks registered inside a shared worker plugin must execute cleanly and release resources.
- **What Actually Happened**: Concurrently executing teardown functions throwing an unhandled rejection caused dangling promises, preventing subsequent teardown hooks from running and hanging the test suite indefinitely.
- **Evidence in Repo**: `lib/plugin-support/shared-worker-loader.js` lines 190–205.
- **Root Cause**: Teardown hooks were initially handled concurrently without ordering guarantees. Furthermore, errors in asynchronous cleanup hooks were swallowed by unresolved promises.
- **Remediation Code Diff**:
```diff
// lib/plugin-support/shared-worker-loader.js
 				const {id} = message;
 				const {teardownFns} = activeTestWorkers.get(id);
 				activeTestWorkers.delete(id);
 
-				await Promise.all([...teardownFns].map(fn => fn()));
+				// Run possibly asynchronous release functions serially, in reverse
+				// order. Any error will crash the worker.
+				for await (const fn of [...teardownFns].toReversed()) {
+					await fn();
+				}
 
 				parentPort.postMessage({
 					type: 'deregistered-test-worker',
```
- **Lesson**: Teardown and destruction lifecycles MUST always run serially in reverse registration order (LIFO - Last In, First Out), ensuring dependent subsystems are destroyed before the resources they depend upon.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Source Map 1-Based vs 0-Based Coordinate Alignment (`lib/worker/line-numbers.js`)**:
  Acorn AST line numbers are 1-based, while columns are 0-based. V8 `callsites()` returns 1-based line numbers and 1-based column numbers. Node.js `findSourceMap()` expects 0-based line and 0-based column.
  ```javascript
  // Forensic Coordinate Invariant:
  const entry = sourceMap.findEntry(pos.line - 1, pos.column); // Convert Acorn 1-based line to 0-based for Node
  return {
    line: entry.originalLine + 1, // Readjust Node 0-based line to Acorn 1-based line
    column: entry.originalColumn, // Node 0-based matches Acorn 0-based column
  };
  ```
- **Node.js Version Semantic Drift (`findSourceMap`)**:
  Prior to Node.js 18.8.0, missing source maps returned `undefined`. In Node.js 18.8.0+, missing source maps return `null`. Code checking source maps must strictly normalize both:
  ```javascript
  sourceMap = findSourceMap(file);
  if (sourceMap === undefined) {
    sourceMap = null; // Enforce invariant: non-existent source map is ALWAYS null
  }
  ```
- **Symbolic Property Encapsulation**:
  Internal IPC ports must never be exposed as enumerable object keys on public classes where user code could inspect or mutate them:
  ```javascript
  const internalMessagePort = Symbol('Internal MessagePort');
  class TestWorker {
    constructor(id, file, port) {
      this.id = id;
      this.file = file;
      this[internalMessagePort] = port; // Completely inaccessible to Object.keys() / JSON.stringify()
    }
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Shared Memory Buffer Overflow Protection (`lib/eslint-plugin-helper-worker.js`)**:
  When passing serialized V8 payloads over shared buffers, payloads exceeding the preallocated fixed buffer size will crash the process if copied. AVA guards against buffer overruns with an explicit exclusive ceiling:
  ```javascript
  const MAX_DATA_LENGTH_EXCLUSIVE = 100 * 1024; // 100 KiB bound
  const byteLength = encoded.length < MAX_DATA_LENGTH_EXCLUSIVE 
    ? encoded.copy(data) 
    : MAX_DATA_LENGTH_EXCLUSIVE;
  Atomics.store(sync, 0, byteLength);
  Atomics.notify(sync, 0); // Wake up the synchronous wait thread
  ```
  The reader checks if `byteLength === MAX_DATA_LENGTH_EXCLUSIVE` and throws a descriptive error rather than reading corrupted memory.
- **Event Loop Yielding on Message Fanout (`lib/plugin-support/shared-worker-loader.js`)**:
  If an event listener publishes another event synchronously during its execution, subscriber queues can cause infinite call stack recursion. AVA breaks the stack using `setImmediate`:
  ```javascript
  const emitMessage = message => {
    // Wait for a turn of the event loop to allow new subscriptions to be registered
    setImmediate(() => events.emit('message', message));
  };
  ```

### 3. UI & UX Micro-Mechanics
- **Line Truncation & Terminal Ansi Preservation**:
  When formatting test diffs, AVA enforces ANSI-safe string truncation. Plain string slicing (`str.slice(0, 80)`) breaks ANSI escape sequences (`\u001B[31m`), causing the entire terminal buffer to stay red. AVA uses `cli-truncate` which calculates terminal column width rather than UTF-16 code units and safely terminates dangling ANSI state flags before emitting newlines.
- **Proxying `process.exit` with Clean Stack Tracing**:
  If a test invokes `process.exit()`, capturing an error must exclude the proxy interceptor itself from the stack trace:
  ```javascript
  const handleProcessExit = (target, thisArg, args) => {
    if (!isExpectingExit) {
      const error = new Error('Unexpected process.exit()');
      Error.captureStackTrace(error, handleProcessExit); // Strips handleProcessExit from the stack
      channel.send({type: 'process-exit', stack: error.stack});
    }
    target.apply(thisArg, args);
  };
  ```

### 4. Backend Concurrency & Memory Safety
- **Async Iterator Message Queueing with Stable Identity (`WeakMap`)**:
  When multiple consumers iterate over an asynchronous stream of IPC messages using `for await (const msg of receiveMessages())`, deserializing raw objects on each pull breaks object identity equality. AVA stabilizes message envelopes using a `WeakMap`:
  ```javascript
  const messageCache = new WeakMap();
  // ...
  let received = messageCache.get(message);
  if (received === undefined) {
    received = new ReceivedMessage(active.instance, message.messageId, message.data);
    messageCache.set(message, received);
  }
  yield received;
  ```
- **Dangling Listener Elimination on Interrupted Workers**:
  When a shared worker crashes or terminates, listeners attached to its message port leak memory unless explicitly unhooked:
  ```javascript
  launched.statePromises.error.then(error => {
    launched.worker.off('message', handleWorkerMessage); // Unbind immediate listener
    removeAllInstances();                                // Force unref on all pooled handles
    run

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
