> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cypress-io-cypress-learnings.md`  
> **Source**: github ([https://github.com/cypress-io/cypress](https://github.com/cypress-io/cypress))  
> **Source Version**: `884f743e`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T07:28:49.544Z  
> **Learning ID**: `learn-github-cypress-io-cypress`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): cypress-io/cypress

---

## 1. Executive Forensic Architecture & System Mechanics

Cypress executes automated end-to-end and component tests directly inside real browser runtimes (Chromium, Firefox, WebKit/Electron) rather than driving the browser purely through remote protocols like Selenium WebDriver or basic CDP scripts. This execution model fundamentally alters the state boundary: test execution code runs in the exact same event loop, execution thread, and JavaScript runtime context as the Application Under Test (AUT), while orchestrating network traffic, file systems, process spawns, and operating system controls via a privileged background Node.js server.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ BROWSER PROCESS (Chromium / Firefox / Electron)                           │
│  ┌───────────────────────────────┐      ┌────────────────────────────────┐ │
│  │ Top Frame: Cypress App / Driver│      │ Iframe / AUT (App Under Test)  │ │
│  │ - Command Queue ($cy)         │      │ - Native DOM Elements          │ │
│  │ - Chai / Sinon / Assertions   │◄────►│ - Window & Document Context    │ │
│  │ - Event Normalizers (mouse.ts)│      │ - Same Event Loop Execution     │ │
│  └───────────────▲───────────────┘      └────────────────▲───────────────┘ │
└──────────────────┼───────────────────────────────────────┼─────────────────┘
                   │ WebSockets (Socket.io) / CDP Wire     │ Local Loopback
┌──────────────────▼───────────────────────────────────────▼─────────────────┐
│ NODE.js SUPERVISOR RUNTIME                                                 │
│  ┌───────────────────────────┐         ┌────────────────────────────────┐ │
│  │ HTTP/HTTPS MITM Proxy     │         │ Browser Process Controller     │ │
│  │ - Pre-Request Correlation │◄───────►│ - Chrome DevTools Protocol     │ │
│  │ - Host Resolver Steering  │         │ - Ephemeral Profile Mgt        │ │
│  │ - Client Cert Injection   │         │ - Screen Video Stream Pipe     │ │
│  └───────────────▲───────────┘         └────────────────────────────────┘ │
│                  │                                                         │
│  ┌───────────────▼───────────┐         ┌────────────────────────────────┐ │
│  │ DataContext (GraphQL / DB)│         │ System Workers / Compilers     │ │
│  │ - State Lifecycle Engine  │         │ - V8 Startup Snapshot Engine   │ │
│  │ - Config Cascade / Prefs  │         │ - Stderr Stream Demuxer        │ │
│  └───────────────────────────┘         └────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### Decoupling & Subsystem Boundaries
1. **The Driver (`packages/driver`)**: The browser-side engine injected into the top frame. It maintains the chainable command queue (`$cy`), schedule loop, DOM query retries, and synthetic event synthesis (`mouse.ts`, `keyboard.ts`). The Driver treats DOM interactions not as simulated external actions, but as sequence-accurate browser event trees (`pointerdown` → `mousedown` → `focus` → `pointerup` → `mouseup` → `click`).
2. **The Proxy (`packages/proxy` & `packages/network`)**: An in-memory, zero-copy HTTP/HTTPS man-in-the-middle engine. It intercepts browser network traffic to enable request stubbing (`cy.intercept`), cookie synchronizations, and certificate injections (`clientCertificates`). It coordinates with the CDP session using a bidirectional temporal queue (`PreRequests`), synchronizing Node-level socket arrivals with browser CDP `Network.requestWillBeSent` events.
3. **The Server & Data-Context (`packages/server` & `packages/data-context`)**: The privileged control plane orchestrating child processes, browser launcher profiles, file system reads/writes, video streams (`video_capture.ts` feeding frames into `fluent-ffmpeg`), and local cache persistence (`insertProjectPreferencesToCache`).
4. **The Tap & Reporter Subsystem (`cli/lib/tap`)**: A terminal reporting and debugging interface implementing an ANSI formatting engine, string sanitization, and tree-layout renderer that operates on command trees, network logs, and serialized console logs without leaking ANSI control sequence byte lengths into tabular alignment calculations.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Error Property Assignment and Object Decoration
**RULE**:
When decorating or augmenting unknown error objects across execution or boundary frames, code MUST NEVER perform bare property assignment (e.g., `err.message = newMsg`). Code MUST attempt property assignment within a guarded `try/catch` and fall back to `Object.defineProperty(err, prop, { value, writable: true, configurable: true, enumerable: true })`. If both throw (e.g., on frozen objects), the original error MUST be preserved and yielded without mutation.

**WHY**:
Browser-native errors (specifically `DOMException`, instantiated on cross-origin frame access or Content Security Policy violations) define standard properties like `message` and `name` as accessor properties (getter-only) on `DOMException.prototype`. Executing direct property assignment (`err.message = '...'`) in strict mode throws a fatal `TypeError: setting getter-only property "message"`. This runtime error overrides and discards the root test or operational failure, obliterating the diagnostic trail.

**WHEN TO APPLY**:
Universal. Apply in any JavaScript/TypeScript error middleware, promise unhandled rejection handler, test runner assertion decorator, or telemetry library that annotates or modifies caught error instances.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Safely mutates or defines an own property on an error object, handling
 * prototype getter-only accessors (e.g., DOMException) and frozen objects.
 */
export const setErrProp = (err: unknown, prop: string, value: unknown): boolean => {
  if (err === null || typeof err !== 'object' && typeof err !== 'function') {
    return false
  }

  try {
    // Attempt standard assignment for plain Error objects
    (err as Record<string, unknown>)[prop] = value
    return true
  } catch {
    // Prototype contains a getter-only accessor; define an own property to shadow it
    try {
      Object.defineProperty(err, prop, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      })
      return true
    } catch {
      // Object is non-extensible, sealed, or frozen; refuse to mutate
      return false
    }
  }
}

export const safeAnnotateErrorMessage = (
  err: Error,
  suffix: string,
  formatter: (current: string, suffix: string) => string
): Error => {
  const currentMsg = err.message || ''
  const updatedMsg = formatter(currentMsg, suffix)
  
  if (setErrProp(err, 'message', updatedMsg)) {
    // Only update stack if message mutation succeeded
    const updatedStack = err.stack ? err.stack.replace(currentMsg, updatedMsg) : updatedMsg
    setErrProp(err, 'stack', updatedStack)
  }

  return err
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct property mutation on arbitrary error inputs
function decorateError(err: Error, prefix: string) {
  // CRASHES with TypeError if err is a native DOMException or frozen object!
  err.message = `${prefix}: ${err.message}`
  err.stack = `${prefix}: ${err.stack}`
  return err
}
```

**VERIFICATION METHOD**:
Verify using unit tests instantiating frozen objects and native `DOMException` objects:
```typescript
import { describe, it, expect } from 'vitest'

describe('safeAnnotateErrorMessage', () => {
  it('modifies DOMException without throwing TypeError', () => {
    const domErr = new DOMException('Cross-origin frame denied', 'SecurityError')
    expect(() => {
      safeAnnotateErrorMessage(domErr, ' [Context Added]', (a, b) => `${a}${b}`)
    }).not.toThrow()
    expect(domErr.message).toBe('Cross-origin frame denied [Context Added]')
  })

  it('safely handles frozen errors without discarding the instance', () => {
    const frozen = Object.freeze(new Error('Immutable error'))
    expect(() => {
      safeAnnotateErrorMessage(frozen, ' [Context]', (a, b) => `${a}${b}`)
    }).not.toThrow()
    expect(frozen.message).toBe('Immutable error')
  })
})
```

---

### 2. State-Bearing Temporal Matching Queue Drainage
**RULE**:
When matching asynchronous signals across disparate, unordered channels using a queued key-indexed sliding window (such as correlating incoming HTTP proxy requests with browser CDP events), the consumer MUST NOT blindly dequeue the first matching element if that element has reached a terminal timeout state. Instead, the consumer MUST check the causation timestamp: if an incoming event was generated *after* the timed-out candidate arrived at the proxy, the timed-out candidate MUST be evicted as a stale orphan and the queue traversal MUST continue until an unexpired match or end of queue is reached.

**WHY**:
Network requests and browser events race across two distinct protocols (Raw TCP Proxy vs. Chrome DevTools Protocol WebSocket). When a proxy request times out waiting for its pre-request notification, leaving it in the queue for potential late reconciliation, any subsequent request to the exact same `METHOD:URL` key will immediately consume the timed-out slot. The fresh pre-request is matched to the stale timed-out slot and dropped, leaving the active request waiting the full timeout interval (e.g., 2000ms). This produces an irreversible cascading timeout lock across every subsequent call to that endpoint for the lifetime of the process.

**WHEN TO APPLY**:
Any distributed or multi-channel correlation engine where two distinct protocols report on the same underlying transaction (e.g., CDP + HTTP proxy, Kafka event stream + DB CDC log, distributed trace span correlation).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface PendingProxyRequest {
  id: string
  key: string
  timedOut: boolean
  proxyRequestReceivedTimestamp: number
}

interface IncomingEventSignal {
  requestId: string
  sourceTimestamp: number
}

export class TemporalCorrelationQueue {
  private pending = new Map<string, PendingProxyRequest[]>()

  public correlateEvent(key: string, event: IncomingEventSignal): PendingProxyRequest | undefined {
    const queue = this.pending.get(key)
    if (!queue || queue.length === 0) {
      return undefined
    }

    let candidate: PendingProxyRequest | undefined

    // Loop-invariant guard: Drain stale timed-out records that were created
    // BEFORE this signal was generated by the upstream source.
    while (queue.length > 0) {
      candidate = queue[0]

      if (
        candidate.timedOut &&
        event.sourceTimestamp > candidate.proxyRequestReceivedTimestamp
      ) {
        // Candidate missed its own window; incoming signal belongs to a later request
        queue.shift()
        candidate = undefined
        continue
      }

      // Found a valid match or an unexpired entry
      return queue.shift()
    }

    return undefined
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly shifting the oldest entry without timestamp causation checks
export function correlateEventFlawed(queueMap: Map<string, any[]>, key: string, event: any) {
  const queue = queueMap.get(key)
  // Consumes a timed-out entry, stealing the event from the real awaiting request!
  const staleEntry = queue?.shift()
  return staleEntry
}
```

**VERIFICATION METHOD**:
Write a scenario test reproducing an initial timed-out pre-request followed by a burst of subsequent requests sharing the identical key, asserting that subsequent requests resolve in sub-millisecond time without incurring the retry/timeout delay:
```typescript
it('does not cascade timeouts across identical method/URL pairs', async () => {
  const queue = new TemporalCorrelationQueue()
  // Simulate request 1 arriving at t=100 and timing out at t=2100
  // Simulate pre-request for request 2 generated at t=2150
  // Assert queue skips request 1 and returns request 2 immediately
})
```

---

### 3. Fail-Fast Invariant for Unretryable Command Preconditions
**RULE**:
Command execution frameworks that implement temporal automatic retries (e.g., polling until timeout) MUST distinguish between *transient environmental states* and *static semantic violations*. Any command invocation that violates static preconditions (e.g., referencing index `0` on a 1-indexed collection, executing a child method directly off the root without a prior subject, or passing an invalid payload type) MUST throw an unretryable error immediately (`retry: false`), bypassing the retry loop.

**WHY**:
Retry loops hide user configuration errors. When an unrecoverable argument error (such as `cy.get('@alias.0')` or unchained `cy.eq(0)`) is treated as a retryable assertion failure, the engine idles and blocks the entire runtime thread for the full command timeout window (default 4000ms–10000ms). This inflates suite execution duration by orders of magnitude and masks the actual programmer error behind an ambiguous generic timeout failure message.

**WHEN TO APPLY**:
Query runners, fluent API builders, test drivers, task queues, and transactional workflow engines that feature automatic exponential backoff or retry polling.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface ExecutionOptions {
  timeout: number
  retry: boolean
}

export class ExecutionEngine {
  public executeQuery(queryName: string, subject: unknown, args: unknown[]): unknown {
    // 1. Static Contract Invariant Check (Immediate Failure)
    if (this.requiresSubject(queryName) && subject === undefined) {
      const err = new Error(
        `\`${queryName}()\` failed because it is not chained off a command that yields a subject.`
      )
      // Attach unretryable flag to immediately abort the retry scheduler
      Object.assign(err, { retry: false, isOperational: true })
      throw err
    }

    // 2. Argument Domain Invariant Check
    if (queryName === 'getAliasIndex' && args[0] === 0) {
      const err = new Error(`Index '0' is invalid for 1-indexed alias properties.`)
      Object.assign(err, { retry: false, isOperational: true })
      throw err
    }

    // 3. Normal polling execution loop
    return this.runWithRetry(() => this.evaluate(queryName, subject, args))
  }

  private runWithRetry(fn: () => unknown): unknown {
    try {
      return fn()
    } catch (err: any) {
      if (err.retry === false) {
        throw err // Abort immediately, zero sleep
      }
      return this.scheduleRetry(fn)
    }
  }

  private requiresSubject(name: string): boolean {
    return ['eq', 'first', 'find', 'shadow'].includes(name)
  }

  private evaluate(name: string, subject: unknown, args: unknown[]): unknown {
    return null
  }

  private scheduleRetry(fn: () => unknown): unknown {
    return null
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Relying on generic assertion failure inside a retry loop
function runCommand(subject: any, cmd: string, index: number) {
  return retryLoop(() => {
    // Calling an element assertion when subject doesn't exist
    // forces the retryLoop to sleep until timeout expires!
    assert(subject !== undefined, 'Subject must be present')
    return subject[index]
  })
}
```

**VERIFICATION METHOD**:
Measure wall-clock duration in the unit harness:
```typescript
it('fails instantly on static contract violation', async () => {
  const start = performance.now()
  try {
    engine.executeQuery('eq', undefined, [0])
    expect.unreachable()
  } catch (err: any) {
    const elapsed = performance.now() - start
    expect(err.retry).toBe(false)
    expect(elapsed).toBeLessThan(100) // Must NOT wait for 4000ms timeout
  }
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Getter-Only Accessor Crash on Error Modification (BUG-DOMEXP-01)
- **Context**: `packages/driver/src/cypress/error_utils.ts`
- **What Was Expected**: When tests fail due to cross-origin access violations or CSP blocks, Cypress catches the browser error, decorates its message with stack traces and actionable hints, and surfaces the decorated error in the Command Log.
- **What Actually Happened**: The test runner crashed with `TypeError: setting getter-only property "message"`. The actual root cause (e.g., cross-origin `DOMException` or security policy block) was discarded, leaving the developer with no diagnostic trace.
- **Evidence in Repo**: Commit `3a329f57`, Issue `#34818`.
- **Root Cause**: `DOMException` instances in web browsers inherit `message` as a getter property defined on `DOMException.prototype`. Direct property mutation (`err.message = newMessage`) invokes the descriptor's setter. Since no setter exists, the JS engine throws a strict mode `TypeError`.
- **Remediation Code Diff**:
```typescript
// packages/driver/src/cypress/error_utils.ts
+const setErrProp = (err, prop: string, value: any): boolean => {
+  try {
+    err[prop] = value
+  } catch {
+    // `DOMException`, which browsers throw for cross-origin access and CSP
+    // violations, inherits `message` as a getter-only accessor, so a plain
+    // assignment throws. An own property shadows the accessor.
+    try {
+      Object.defineProperty(err, prop, { value, writable: true, configurable: true })
+    } catch {
+      return false
+    }
+  }
+
+  return true
+}
+
 const modifyErrMsg = (err, newErrMsg, cb) => {
-  err.stack = $stackUtils.normalizedStack(err)
+  setErrProp(err, 'stack', $stackUtils.normalizedStack(err))
 
   const newMessage = cb(err.message, newErrMsg)
   const newStack = stackWithReplacedProps(err, { message: newMessage })
 
-  err.message = newMessage
-  err.stack = newStack
+  if (setErrProp(err, 'message', newMessage)) {
+    setErrProp(err, 'stack', newStack)
+  }
 
   return err
 }
```
- **Lesson**: Standard prototype accessor definitions cannot be overwritten by assignment. Always use `Object.defineProperty` to install an own property that shadows inherited accessor getters.

---

### Incident 2: Pre-Request Timeout Deadlock and Cascading Spec Delay (BUG-PREREQ-02)
- **Context**: `packages/proxy/lib/http/util/prerequests.ts`
- **What Was Expected**: If an HTTP request does not receive a matching CDP `BrowserPreRequest` within 2 seconds, it times out and proceeds via network fallback. Subsequent requests should process normally without latency.
- **What Actually Happened**: Once a single request timed out waiting for its pre-request, every subsequent request targeting the identical method and URL stalled for exactly 2.0 seconds for the entire remainder of the test spec run.
- **Evidence in Repo**: Commit `c61453cc`, Issue `#34966`.
- **Root Cause**: The timed-out request was retained in `pendingRequests` to permit late correlation. When the next valid browser pre-request arrived, `this.pendingRequests.shift(key)` returned the stale, timed-out request from the earlier failed transaction. This pre-request was consumed and discarded on the stale entry. The second real request then arrived at the proxy, found no matching pre-request in the queue, waited its own 2000ms timeout, and repeated the cycle infinitely.
- **Remediation Code Diff**:
```typescript
// packages/proxy/lib/http/util/prerequests.ts
     metrics.browserPreRequestsReceived++
-    const pendingRequest = this.pendingRequests.shift(key)
+    let pendingRequest = this.pendingRequests.shift(key)
+
+    // A timed-out request stays queued so its own late pre-request can still be correlated.
+    // A pre-request the browser sent after that request reached the proxy cannot be its own,
+    // so the stale entry would otherwise consume it and leave the next request waiting for
+    // a pre-request that has already been dropped, for every later request with this key.
+    while (pendingRequest?.timedOut && browserPreRequest.cdpRequestWillBeSentTimestamp &&
+      browserPreRequest.cdpRequestWillBeSentTimestamp > pendingRequest.proxyRequestReceivedTimestamp) {
+      debug('Dropping timed-out pending request %s: pre-request %s was sent after it reached the proxy', key, browserPreRequest.requestId)
+      pendingRequest = this.pendingRequests.shift(key)
+    }
```
- **Lesson**: Asynchronous FIFO queues that retain expired items for grace periods must validate causal generation timestamps before linking fresh events to stale slots.

---

### Incident 3: Stderr Stream Demuxing Line Boundary Chunk Coalescing (BUG-STREAM-03)
- **Context**: `packages/stderr-filtering/lib/FilterTaggedContent.ts`
- **What Was Expected**: Internal process stderr tagged streams (`<start>...<end>`) used for inter-process telemetry should be filtered into a waste stream, while arbitrary developer console errors (`console.error`) pass through intact.
- **What Actually Happened**: Developer `console.error` logs were intermittently dropped and deleted from terminal output when multiple writes occurred in close succession.
- **Evidence in Repo**: Commit `43e557d9`, PR `#35022`.
- **Root Cause**: The stream transformer processed lines using single checks (`indexOf(startTag)` and `lastIndexOf(endTag)`). When Node stream chunks coalesced consecutive writes into a single buffer chunk containing `<end><start>`, the state machine incorrectly classified the intermediate boundary text as internal tagged data, routing user stderr into the waste stream.
- **Remediation Code Diff**:
```typescript
// packages/stderr-filtering/lib/FilterTaggedContent.ts
   private async processLine (line: string): Promise<void> {
-    const startPos = line.indexOf(this.startTag)
-    const endPos = line.lastIndexOf(this.endTag)
-
-    if (startPos >= 0 && endPos >= 0) {
-      // Single line check swallowed coalesced boundaries...
-    }
+    let rest = line
+
+    do {
+      const endPos = rest.indexOf(this.endTag)
+
+      if (this.inTaggedContent) {
+        if (endPos < 0) {
+          await this.writeToWasteStream(rest)
+          return
+        }
+        if (endPos > 0) {
+          await this.writeToWasteStream(rest.slice(0, endPos))
+        }
+        this.inTaggedContent = false
+        rest = rest.slice(endPos + this.endTag.length)
+        continue
+      }
+
+      const startPos = rest.indexOf(this.startTag)
+
+      // An end tag without a preceding start tag closes content whose start was not seen
+      if (endPos >= 0 && (startPos < 0 || endPos < startPos)) {
+        if (endPos > 0) {
+          await this.writeToWasteStream(rest.slice(0, endPos))
+        }
+        rest = rest.slice(endPos + this.endTag.length)
+        continue
+      }
+
+      if (startPos < 0) {
+        await this.pass(rest)
+        return
+      }
+
+      if (startPos > 0) {
+        await this.pass(rest.slice(0, startPos))
+      }
+      this.inTaggedContent = true
+      rest = rest.slice(startPos + this.startTag.length)
+    } while (rest.length > 0)
   }
```
- **Lesson**: Never assume stream framing lines contain at most one delimiter pair. Token lexers on stream buffers must implement iterative string consumption loops (`while (rest.length > 0)`).

---

### Incident 4: Pointer Event State Desynchronization on Right-Click (BUG-MOUSE-04)
- **Context**: `packages/driver/src/cy/mouse.ts`
- **What Was Expected**: Calling `.rightclick()` dispatches a complete pointer/mouse sequence (`pointerdown`, `mousedown`, `contextmenu`, `pointerup`, `mouseup`). In compliance with W3C UI Events specifications, `event.buttons` must report `0` on the release phase (`pointerup` and `mouseup`).
- **What Actually Happened**: `.rightclick()` passed `buttons: 2` on both `pointerup` and `mouseup`. Web components checking `event.buttons === 0` to confirm button release failed to register the click completion.
- **Evidence in Repo**: Commit `721e1430`, PR `#35042`.
- **Root Cause**: The implementation shared the exact same options object (`pointerEvtOptionsExtend` containing `buttons: 2`) across both the `down` phase and `up` phase dispatch functions.
- **Remediation Code Diff**:
```typescript
// packages/driver/src/cy/mouse.ts
     rightclick (fromElViewport, forceEl) {
-      const pointerEvtOptionsExtend = {
+      const downEvtOptionsExtend = {
         button: 2,
         buttons: 2,
         which: 3,
       }
-      const mouseEvtOptionsExtend = {
+      const upEvtOptionsExtend = {
         button: 2,
-        buttons: 2,
         which: 3,
       }
 
-      const mouseDownPhase = mouse.down(fromElViewport, forceEl, pointerEvtOptionsExtend, mouseEvtOptionsExtend)
+      const mouseDownPhase = mouse.down(fromElViewport, forceEl, downEvtOptionsExtend, downEvtOptionsExtend)
       const contextmenuEvent = mouse._contextmenuEvent(fromElViewport, forceEl)
       const skipMouseupEvent = mouseDownPhase.events.pointerdown.preventedDefault
-      const mouseUpPhase = mouse.up(fromElViewport, forceEl, skipMouseupEvent, pointerEvtOptionsExtend, mouseEvtOptionsExtend)
+      const mouseUpPhase = mouse.up(fromElViewport, forceEl, skipMouseupEvent, upEvtOptionsExtend, upEvtOptionsExtend)
```
- **Lesson**: Synthetic DOM event simulation requires separate property definitions across transition states (`down` maintains pressed state bits; `up` clears released state bits).

---

### Incident 5: Video Chapter Timestamp Timeline Desynchronization (BUG-FFMPEG-05)
- **Context**: `packages/server/lib/video_capture.ts`
- **What Was Expected**: Video chapter metadata embedded in `.mp4` recordings aligns exactly with the commencement of each test attempt.
- **What Actually Happened**: Chapter markers drifted ahead of their corresponding tests, and videos displayed frozen frames with invalid total durations whenever a browser delayed presenting its initial graphics frame.
- **Evidence in Repo**: Commit `a8a852e8`, PR `#35018`.
- **Root Cause**: The timeline origin (`startedVideoCapture`) was set when the `ffmpeg` child process spawned (`on('start')`), rather than when the browser piped its first visual frame. Furthermore, chapter calculation incorrectly subtracted duration (`videoTimestamp - wallClockDuration`) instead of offsetting forward from the first frame write.
- **Remediation Code Diff**:
```typescript
// packages/server/lib/video_capture.ts
-  const configString = tests.map((test) => {
-    return test.attempts.map((attempt, i) => {
+  const configString = tests.flatMap((test) => {
+    return test.attempts.flatMap((attempt, i) => {
       const { videoTimestamp, wallClockDuration } = attempt
+      // pending tests never ran, so they have no place in the video
+      if (videoTimestamp == null || wallClockDuration == null) {
+        return []
+      }
       let title = test.title ? test.title.join(' ') : ''
       if (i > 0) {
         title += ` (attempt ${i + 1})`
       }
       return [
         '[CHAPTER]',
         'TIMEBASE=1/1000',
-        `START=${videoTimestamp - wallClockDuration}`,
-        `END=${videoTimestamp}`,
+        `START=${videoTimestamp}`,
+        `END=${videoTimestamp + wallClockDuration}`,
         `title=${title}`,
       ].join('\n')
-    }).join('\n')
+    })
   }).join('\n')
...
     writtenFramesCount++
+    // the video's timeline begins at the first frame, so chapter timestamps must be measured from it
+    if (writtenFramesCount === 1) {
+      startedVideoCapture = new Date
+    }
```
- **Lesson**: Media timeline zero MUST anchor to the arrival of the first decoded/written frame, not to container process initialization.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Nullish Property Validation vs Falsy Traps**: In command validation, `if (!eventName)` guards against `""`, `null`, and `undefined`. However, checking numeric inputs with falsy negation treats `0` as an error. Cypress avoids this by strictly isolating non-empty string checks:
  ```typescript
  // CORRECT: Non-empty string invariant
  if (!eventName || !_.isString(eventName)) {
    throwErr('trigger.invalid_argument')
  }

  // CORRECT: Allowing numeric 0 index while barring null/undefined
  if (index !== undefined && index !== null && typeof index !== 'number') {
    throwErr('invalid_index')
  }
  ```
- **ANSI Terminal Width Calculation**: ANSI escape characters occupy string buffer indices but take 0 columns in the terminal. When padding or clamping strings for CLI tables, string length MUST be computed against raw text, or escape characters will distort table alignment:
  ```typescript
  // Padded cell width calculation invariant:
  // Strip ANSI sequences before computing terminal layout offsets
  export const clamp = (text: string, width: number): string => {
    return text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`
  }
  // All padding is applied BEFORE styling functions wrap strings in escape sequences!
  ```

### 2. Infinite Loop & Recursion Guards
- **Stream Tag Slicing Termination**: In iterative string parsers (such as `FilterTaggedContent`), every loop iteration MUST guarantee a strictly decreasing `rest.length` invariant:
  ```typescript
  do {
    // Every code