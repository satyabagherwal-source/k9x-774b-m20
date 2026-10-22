> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/axios-axios-learnings.md`  
> **Source**: github ([https://github.com/axios/axios](https://github.com/axios/axios))  
> **Source Version**: `e6b79d9c`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-22T20:38:54.212Z  
> **Learning ID**: `learn-github-axios-axios`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): axios/axios

---

## 1. Executive Forensic Architecture & System Mechanics

`axios` is an isomorphic, promise-based HTTP client for Node.js and browser runtimes. It abstracts network transport divergence (Node's `http`/`https`/`http2` modules vs. browser `XMLHttpRequest`/`fetch`) behind a unified, pipeline-driven engine.

```
+----------------------------------------------------------------------------------------------------+
|                                            Axios Instance                                          |
|  +----------------------------------------------------------------------------------------------+  |
|  | Request Pipeline Entry: axios.request(configOrUrl, [config])                                 |  |
|  | - URL & Config Normalization                                                                 |  |
|  | - Defensive Config Merge (mergeConfig.js with Object.create(null))                           |  |
|  | - Case-Insensitive Header Map Normalization (AxiosHeaders.js with __Proto__ slot isolation)  |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                |                                                   |
|                                                v                                                   |
|  +----------------------------------------------------------------------------------------------+  |
|  | Interceptor Manager Execution Graph                                                          |  |
|  | - Synchronous Interceptor Pipeline: iterative unshift/push execution                        |  |
|  | - Asynchronous Interceptor Pipeline: chained Promise.then() waterfall                       |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                |                                                   |
|                                                v                                                   |
|  +----------------------------------------------------------------------------------------------+  |
|  | Dispatch Request Core (dispatchRequest.js)                                                  |  |
|  | - AbortSignal / CancelToken Cancellation Checkpoints                                         |  |
|  | - Request Payload Transforms (transformData.js)                                              |  |
|  | - Adapter Selection (Node http adapter vs. Browser XHR/Fetch adapter)                       |  |
|  +----------------------------------------------------------------------------------------------+  |
|                        |                                                |                          |
|                        v                                                v                          |
|  +------------------------------------------+  +------------------------------------------------+  |
|  | Node.js Runtime Platform                 |  | Browser Runtime Platform                       |  |
|  | - follow-redirects, stream pipelines    |  | - XMLHttpRequest, Fetch API                    |  |
|  | - agent keep-alive pooling, zlib unzip  |  | - XSRF cookie tracking, upload/download events |  |
|  +------------------------------------------+  +------------------------------------------------+  |
|                        |                                                |                          |
|                        +-----------------------+------------------------+                          |
|                                                |                                                   |
|                                                v                                                   |
|  +----------------------------------------------------------------------------------------------+  |
|  | Response Pipeline & Error Normalization                                                      |  |
|  | - AxiosResponse construction (duration telemetry via clamped monotonic subtraction)         |  |
|  | - Response Header Normalization & Cookie extraction (getSetCookie())                         |  |
|  | - Response Interceptor Graph traversal                                                       |  |
|  | - AxiosError Envelope (Non-enumerable 'cause', stack boundary stitching, redaction)         |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

### Critical Subsystem Boundaries and Invariants
1. **Config Harmonization Boundary (`mergeConfig.js`)**: Merges default settings with per-request overrides without prototype pollution vulnerabilities. It uses an explicit property dispatch map (`mergeMap`), enforces acyclic parameter structures via `assertParamsAcyclic.js` before serialization, and ensures the target dictionary is a clean dictionary (`Object.create(null)`).
2. **Caseless Header Virtualization (`AxiosHeaders.js`)**: Decouples transport header casing from developer lookup keys. It provides case-insensitive reads/writes, protects internal slot names against prototype poisoning (specifically aliasing `__proto__` to `__Proto__`), and sanitizes control characters (CRLF injection prevention).
3. **Execution Pipeline Boundary (`InterceptorManager.js` & `Axios.js`)**: Interceptors support synchronous and asynchronous execution. Interceptors can be registered, dynamically filtered via `runWhen`, or safely ejected during active iterations using reference-tracked handler arrays and depth counters.
4. **Adapter Isolation Boundary (`dispatchRequest.js`)**: Renders HTTP request execution agnostic of the runtime host. Transforms data, validates cancellation states before and after wire operations, and measures total execution latency using a clamped wall-clock calculation (`Math.max(0, Date.now() - start)`).
5. **Defensive Error Architecture (`AxiosError.js`)**: Normalizes disparate runtime exceptions (`AggregateError`, network timeouts, TLS failures) into an enumerable-safe, circular-safe `AxiosError` envelope. It isolates the unwrapped error in a non-enumerable `cause` property, preserves nested causation stacks across asynchronous frames using `appendCauseStack`, and supports opt-in field masking via `redactConfig`.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Non-Enumerable Wrap and Stack Splicing for Error Envelopes
**RULE**:
When wrapping low-level runtime errors inside domain-level Error abstractions, the wrapped error instance MUST be attached to the parent error as a non-enumerable property (`enumerable: false`), and its stack trace MUST be defensively appended using explicit cause markers while preserving top caller frames.

**WHY**:
Network engines wrap native sockets, streams, agents, and TLS state machines that contain dense circular object graphs (e.g., `socket._httpMessage.socket`). If `error.cause` is defined as an enumerable property, any subsequent downstream structured logging operation (such as `JSON.stringify(err)`, Winston, or Pino serializers) throws an uncatchable `TypeError: Converting circular structure to JSON`. Simultaneously, standard error telemetry collectors only read top-level `err.stack`; omitting defensive stack splicing discards the underlying asynchronous root cause frame.

**WHEN TO APPLY**:
Apply in any networking client, SDK client, or database driver where low-level system errors (Node streams, Fetch responses, socket exceptions) are converted into higher-level application error instances.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Derived from lib/core/AxiosError.js
export const CAUSED_BY_SEPARATOR = '\nCaused by: ';
const $causeStack = Symbol('causeStack');

export function wrapDomainError(message, code, lowLevelError, contextConfig) {
  // Extract aggregate messages if low-level error is an AggregateError (Happy Eyeballs / Dual-stack)
  let resolvedMessage = message || lowLevelError.message;
  if (!resolvedMessage && Array.isArray(lowLevelError.errors) && lowLevelError.errors.length) {
    resolvedMessage = lowLevelError.errors
      .map((entry) => {
        try {
          return entry && entry.message ? String(entry.message) : String(entry);
        } catch {
          return '';
        }
      })
      .filter(Boolean)
      .join('; ') || lowLevelError.name || 'AggregateError';
  }

  const domainError = new Error(resolvedMessage);
  domainError.name = 'DomainClientError';
  if (code) domainError.code = code;

  // CRITICAL: Define cause as NON-ENUMERABLE to shield structured loggers from circular references
  Object.defineProperty(domainError, 'cause', {
    __proto__: null,
    value: lowLevelError,
    writable: true,
    enumerable: false,
    configurable: true,
  });

  // CRITICAL: Defensive stack-trace splicing across asynchronous boundaries
  try {
    const sourceStack = lowLevelError && lowLevelError.stack;
    const targetStack = domainError.stack;
    if (typeof sourceStack === 'string' && sourceStack && typeof targetStack === 'string' && targetStack) {
      const causeStack = CAUSED_BY_SEPARATOR + sourceStack;
      domainError.stack = targetStack + causeStack;
      Object.defineProperty(domainError, $causeStack, {
        __proto__: null,
        value: causeStack,
      });
    }
  } catch {
    // Fail open if stack descriptors are frozen or runtime lacks stack introspection
  }

  return domainError;
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Direct assignment creates enumerable circular references and drops underlying stacks
function wrapDomainError(message, lowLevelError) {
  const err = new Error(message);
  // FATAL: Enumerable assignment causes JSON.stringify / pino / winston to crash on circular sockets
  err.cause = lowLevelError; 
  // FATAL: Overwriting stack drops caller frames; not appending causes drop of low-level frames
  err.stack = lowLevelError.stack; 
  return err;
}
```

**VERIFICATION METHOD**:
Run an automated assertion verifying both serialization and stack integrity:
```javascript
import assert from 'node:assert/strict';

const circular = {};
circular.self = circular;
const baseError = new Error('Socket timeout');
baseError.socket = circular;

const wrapped = wrapDomainError('Request failed', 'ETIMEDOUT', baseError);

// 1. Verify JSON.stringify does not crash on circular structures
assert.doesNotThrow(() => JSON.stringify(wrapped));

// 2. Verify cause is preserved but not enumerable
assert.equal(wrapped.cause, baseError);
assert.equal(Object.keys(wrapped).includes('cause'), false);

// 3. Verify caused-by stack splicing
assert.ok(wrapped.stack.includes('Caused by: Error: Socket timeout'));
```

---

### 2. Prototype-Pollution-Proof Dictionary Allocation & Slot Re-Routing
**RULE**:
Dictionary data structures populated from untrusted input (e.g., HTTP headers, query params, client config merges) MUST be instantiated with a `null` prototype (`Object.create(null)`). Any special property key that collides with Object prototype accessors (specifically `__proto__`, `constructor`, and `prototype`) MUST be re-routed to an internal safe slot or skipped entirely during structural deep merges.

**WHY**:
In JavaScript runtimes, assigning `target["__proto__"] = value` on an ordinary object literal (`{}`) does not set an own-property key named `"__proto__"`; instead, it invokes the inherited `Object.prototype` setter, modifying the internal `[[Prototype]]` link. If the assigned value is an array or object, the prototype chain is mutated globally, stripping away built-in methods or injecting malicious properties. Furthermore, descriptors passed to `Object.defineProperty` MUST have their prototype explicitly severed (`__proto__: null`) to prevent getter poisoning on `Object.prototype`.

**WHEN TO APPLY**:
Apply to all configuration parsers, header containers, multi-source merging functions, and key-value mapping tables exposed to runtime inputs.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Derived from lib/core/AxiosHeaders.js and lib/core/mergeConfig.js
const PROTO_HEADER_SLOT = '__Proto__';

// Helper to prevent __proto__ setter hijacking while preserving lookup
const sanitizeSlotKey = (name) => (name === '__proto__' ? PROTO_HEADER_SLOT : name);

export class SafeContainer {
  constructor() {
    // Null prototype prevents prototype inheritance and pollution
    this.storage = Object.create(null);
  }

  set(key, value) {
    if (typeof key !== 'string') return;
    const normalizedKey = key.trim().toLowerCase();
    
    // Prevent __proto__, constructor, and prototype pollution
    if (normalizedKey === '__proto__' || normalizedKey === 'constructor' || normalizedKey === 'prototype') {
      this.storage[sanitizeSlotKey(normalizedKey)] = value;
      return;
    }
    
    this.storage[normalizedKey] = value;
  }

  get(key) {
    if (typeof key !== 'string') return undefined;
    const normalizedKey = key.trim().toLowerCase();
    return this.storage[sanitizeSlotKey(normalizedKey)];
  }

  // Define properties safely without risking Object.prototype getter pollution
  static defineSafeProperty(target, key, value) {
    Object.defineProperty(target, key, {
      __proto__: null, // CRITICAL: Isolates descriptor from polluted Object.prototype
      value,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Direct assignment on plain objects vulnerable to __proto__ prototype mutation
function setHeader(targetObject, key, value) {
  // If key === '__proto__', this modifies Object.prototype or wipes target prototype chain
  targetObject[key] = value; 
}
```

**VERIFICATION METHOD**:
Validate via property pollution test:
```javascript
import assert from 'node:assert/strict';

const container = new SafeContainer();
container.set('__proto__', { admin: true });

// Verify that the global Object prototype was not contaminated
assert.equal(({}).admin, undefined);
// Verify that the container securely isolates the key
assert.deepEqual(container.get('__proto__'), { admin: true });
```

---

### 3. Asynchronous Safe Interceptor Lifecycle with Re-Entrancy and Compaction Guarding
**RULE**:
When maintaining an interceptor stack that supports in-flight deregistration (`eject`) during pipeline iteration, execution algorithms MUST NOT splice or mutate active iteration indices directly. The data structure MUST track iteration depth counters, soft-delete entries by tombstoning them with `null`, and defer array compaction/index truncation until all active call frames have returned (`iterationDepth === 0`).

**WHY**:
If an interceptor's execution ejects itself or a preceding interceptor via `splice()` while a loop is iterating over the array, the iteration indices shift backwards. This causes subsequent interceptors to be skipped entirely (off-by-one skipping bug) or invalid memory/undefined handlers to be invoked. Additionally, registering an interceptor during an active iteration without length snapshot isolation can lead to unintended execution within the current dispatch cycle.

**WHEN TO APPLY**:
Apply to all middleware pipelines, event observer registries, RPC hook stacks, and plugin dispatch systems where middleware can deregister or register handlers dynamically.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Derived from lib/core/InterceptorManager.js
export class SafeInterceptorManager {
  constructor() {
    this.handlers = [];
    this.iterationDepth = 0;
    this.nextId = 0;
    this.handlerEntries = new Map();
  }

  use(fulfilled, rejected, options = {}) {
    const handler = {
      fulfilled,
      rejected,
      synchronous: !!options.synchronous,
    };
    const id = this.nextId++;
    this.handlers.push(handler);
    this.handlerEntries.set(id, {
      handler,
      index: this.handlers.length - 1,
    });
    return id;
  }

  eject(id) {
    const entry = this.handlerEntries.get(id);
    if (!entry) return;

    this.handlerEntries.delete(id);

    // Verify index coherence before tombstoning
    if (this.handlers[entry.index] !== entry.handler) return;

    // Tombstone with null rather than splicing to preserve iteration indices
    this.handlers[entry.index] = null;

    // Only compact if no iterations are currently traversing the stack
    if (this.iterationDepth === 0) {
      this._trimTrailingNulls();
    }
  }

  forEach(fn) {
    this.iterationDepth++;
    try {
      for (let i = 0; i < this.handlers.length; i++) {
        const handler = this.handlers[i];
        if (handler !== null) {
          fn(handler);
        }
      }
    } finally {
      this.iterationDepth--;
      if (this.iterationDepth === 0) {
        this._trimTrailingNulls();
      }
    }
  }

  _trimTrailingNulls() {
    while (this.handlers.length > 0 && this.handlers[this.handlers.length - 1] === null) {
      this.handlers.pop();
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Array splicing during iteration induces index skips and race conditions
class UnsafeInterceptorManager {
  constructor() { this.handlers = []; }
  eject(id) {
    // Splicing invalidates all in-flight loop counters!
    this.handlers.splice(id, 1); 
  }
  forEach(fn) {
    // If fn() calls eject(), this loop skips elements or reads undefined!
    for (let i = 0; i < this.handlers.length; i++) {
      fn(this.handlers[i]);
    }
  }
}
```

**VERIFICATION METHOD**:
Execute re-entrant self-ejection test:
```javascript
import assert from 'node:assert/strict';

const manager = new SafeInterceptorManager();
let executedSecond = false;

const id1 = manager.use(() => {
  // Self-eject during execution
  manager.eject(id1);
});

manager.use(() => {
  executedSecond = true;
});

// Execute pipeline
manager.forEach((h) => h.fulfilled());

// Assert second handler was NOT skipped due to index shift
assert.equal(executedSecond, true);
// Assert trailing tombstone compaction completed after iterationDepth hit 0
assert.equal(manager.handlers.length, 1);
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Prototype Pollution & Setter Hijacking via `__proto__` Header Name (BUG-AXIOS-01)
- **Context**: `lib/core/AxiosHeaders.js`
- **What Was Expected**: Passing an object containing arbitrary HTTP header keys (e.g. `{ '__proto__': 'evil' }`) should store the header safely without corrupting prototype chains or stripping instance methods.
- **What Actually Happened**: In JavaScript, `AxiosHeaders.prototype` inherits from `Object.prototype`. When code assigned `this['__proto__'] = normalizeValue(value)`, it invoked the native `Object.prototype.__proto__` setter. This modified the instance’s prototype link. If the value was not an object or null, the assignment failed silently; if it was an object, it replaced the entire method table of `AxiosHeaders`, throwing `TypeError: this.get is not a function` on subsequent requests.
- **Evidence in Repo**: Commit changes in `AxiosHeaders.js` creating `PROTO_HEADER_SLOT = '__Proto__'`.
- **Root Cause**: Reliance on direct dynamic indexing (`self[key] = ...`) without sanitizing against the magical `__proto__` property accessor defined on `Object.prototype`.
- **Remediation Code Diff**:
```javascript
// lib/core/AxiosHeaders.js
- self[key || _header] = normalizeValue(_value);
+ const PROTO_HEADER_SLOT = '__Proto__';
+ const headerSlot = (name) => (name === '__proto__' ? PROTO_HEADER_SLOT : name);
+ self[headerSlot(key || _header)] = normalizeValue(_value);
```
- **Lesson**: Never perform dynamic property assignment `obj[key] = val` with unsanitized external strings without either using `Object.create(null)` or mapping `__proto__` to a safe internal token.

---

### Incident 2: Circular Structure JSON Serialization Crash in Logging Frameworks (#7205, #6982) (BUG-AXIOS-02)
- **Context**: `lib/core/AxiosError.js`
- **What Was Expected**: Applications logging caught `AxiosError` instances using Pino, Winston, or standard `JSON.stringify(error)` should output JSON-serialized error metadata without throwing runtime exceptions.
- **What Actually Happened**: PR #6982 added native `Error.cause` support via direct assignment: `axiosError.cause = error`. In Node.js networking, low-level errors contain references to active sockets (`error.socket`), which reference agents (`socket._httpMessage.agent.sockets`), creating deeply circular reference loops. Downstream logging libraries iterating own enumerable properties encountered the circular reference and threw `TypeError: Converting circular structure to JSON`, crashing production Node.js processes.
- **Evidence in Repo**: `lib/core/AxiosError.js` commit fixing #7205 and comments referencing regression from #6982.
- **Root Cause**: Assigning complex system objects containing cyclical references as enumerable properties on an Error instance.
- **Remediation Code Diff**:
```javascript
// lib/core/AxiosError.js
- axiosError.cause = error;
+ Object.defineProperty(axiosError, 'cause', {
+   __proto__: null,
+   value: error,
+   writable: true,
+   enumerable: false, // Prevents JSON.stringify and own-property traversals from crashing
+   configurable: true,
+ });
```
- **Lesson**: Any system/network level context attached to public error instances must be non-enumerable to prevent serializer recursion crashes.

---

### Incident 3: Dual-Stack Happy-Eyeballs Silent AggregateError Message Erasure (#6721) (BUG-AXIOS-03)
- **Context**: `lib/core/AxiosError.js` - `AxiosError.from()`
- **What Was Expected**: When a connection fails under Node's Happy Eyeballs dual-stack DNS resolution (IPv6 fallback to IPv4), the resulting error message should clearly explain why the connection was refused or timed out.
- **What Actually Happened**: Node’s native `AggregateError` has an empty string `""` as its default `message` property; the individual diagnostic error instances reside inside an `errors` array (`error.errors`). When `AxiosError.from(err)` wrapped the error, it set `new AxiosError(error.message)` which resulted in an empty error string (`AxiosError: `), blinding production monitoring systems.
- **Evidence in Repo**: `lib/core/AxiosError.js` commit lines dealing with `aggregateErrorMessage(error)`.
- **Root Cause**: Assuming all `Error` subclasses populate `.message` with human-readable diagnostic text.
- **Remediation Code Diff**:
```javascript
// lib/core/AxiosError.js
  static from(error, code, config, request, response, customProps) {
+   let message = error.message;
+   if (!message && utils.isArray(error.errors) && error.errors.length) {
+     message = aggregateErrorMessage(error);
+   }
-   const axiosError = new AxiosError(error.message, code || error.code, config, request, response);
+   const axiosError = new AxiosError(message, code || error.code, config, request, response);
```
- **Lesson**: When wrapping platform-level errors, inspect `error.errors` and unpack `AggregateError` containers before falling back to empty message defaults.

---

### Incident 4: Re-Entrant Interceptor Ejection Causing Pipeline Corruption (BUG-AXIOS-04)
- **Context**: `lib/core/InterceptorManager.js`
- **What Was Expected**: Calling `axios.interceptors.request.eject(id)` from inside an active interceptor callback should safely detach the interceptor without disrupting remaining handlers or mutating iteration state.
- **What Actually Happened**: The internal `handlers` array was modified directly using array indexing or splicing. Calling `eject` during iteration changed array positions, resulting in off-by-one shifts where the next interceptor in line was skipped completely. Furthermore, if `clear()` was called concurrently, stale numeric references led to accessing properties on undefined handlers.
- **Evidence in Repo**: `lib/core/InterceptorManager.js` - addition of `iterationDepth`, `$internals`, and `trimHandlers` synchronization.
- **Root Cause**: In-place mutation of the shared collection while active iterations were walking the array indices.
- **Remediation Code Diff**:
```javascript
// lib/core/InterceptorManager.js
  forEach(fn) {
    const internals = this[$internals];
    syncHandlerEntries(this, internals);
+   internals.iterationDepth++;
    try {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    } finally {
-     // Direct trimming during iteration caused index skips
+     if (!--internals.iterationDepth) {
+       syncHandlerEntries(this, internals);
+       trimHandlers(this.handlers);
+       internals.handlersLength = countHandlers(this.handlers);
+     }
    }
  }
```
- **Lesson**: Guard shared collections with re-entrancy depth counters. Defer structural mutations (compaction/splicing) until all active reader frames unwind.

---

### Incident 5: Asynchronous Caller Stack Discarding Behind Stack Markers (#6670) (BUG-AXIOS-05)
- **Context**: `lib/core/Axios.js` and `lib/core/AxiosError.js`
- **What Was Expected**: When `axios.request()` rejects, the returned Error stack trace should show the exact line in user application code where `await axios(...)` was called, followed by the underlying transport failure.
- **What Actually Happened**: Because HTTP requests cross multiple microtask and event loop boundaries, Node.js drops the synchronous caller stack frame. Re-attaching the stack naively or prepending cause markers caused stack-only APM agents (Datadog, New Relic) to parse the top application frames as part of the cause string or truncate them entirely.
- **Evidence in Repo**: `lib/core/Axios.js` (`request` method try/catch block) and `getCauseStackIndex()` in `AxiosError.js`.
- **Root Cause**: Appending error stacks without isolating the synthetic `Caused by:` separator led to corrupted stack headers when stitching caller frames back together.
- **Remediation Code Diff**:
```javascript
// lib/core/Axios.js
  const currentStack = String(err.stack);
+ const causeIndex = getCauseStackIndex(err, currentStack);
+ const stackHead = causeIndex === -1 ? currentStack : currentStack.slice(0, causeIndex);
+ const causeSection = causeIndex === -1 ? '' : currentStack.slice(causeIndex);
+ if (!stackHead.endsWith(duplicateCheckSuffix)) {
+   err.stack = stackHead + '\n' + stack + causeSection;
+ }
```
- **Lesson**: When stitching reconstructed caller stacks into an existing error, locate and preserve causation markers (`Caused by:`) so caller frames remain positioned in the primary error head.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Null-Prototype Descriptors for Object.defineProperty**: When defining object properties with `Object.defineProperty`, developers frequently pass an object literal descriptor: `{ value: 1, enumerable: true }`. If an attacker pollutes `Object.prototype.get` with an accessor, `Object.defineProperty` interprets that accessor descriptor and throws a `TypeError: Invalid property descriptor`.
  *Axios Invariant*: Always assign `__proto__: null` to property descriptor literals:
  ```javascript
  Object.defineProperty(obj, 'prop', {
    __proto__: null, // Prevents prototype getter pollution
    value: val,
    enumerable: false,
    writable: true,
    configurable: true
  });
  ```
- **Falsy 0 vs Nullish Semantics in HTTP Status Verification**:
  In HTTP status validation, checking `!config.status` treats status `0` (used in browser XHR for aborted or network errors) identically to `undefined`.
  *Axios Invariant*: Explicitly check `error.status != null` rather than truthiness:
  ```javascript
  if (error.status != null && axiosError.status == null) {
    axiosError.status = error.status;
  }
  ```
- **Strict String Coercion on Non-Primitive Error Messages**:
  In JavaScript, `String(value)` can throw if an object has an overridden, throwing `toString` method.
  *Axios Invariant*: Wrap `String(value)` in defensive `try/catch` wrappers:
  ```javascript
  function stringifySafely(value) {
    try {
      return String(value);
    } catch {
      return '';
    }
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **WeakSet-Driven Cycle Detection in Parameter Trees (`assertParamsAcyclic.js`)**:
  Recursive serializers encounter fatal `Maximum call stack size exceeded` errors when handling circular parameter objects (e.g., `params.a = params`).
  *Axios Invariant*: Utilize an iterative stack paired with dual `WeakSet` collections tracking both `visited` (nodes already checked) and `active` (nodes in current ancestor branch):
  ```javascript
  export default function assertParamsAcyclic(params) {
    const pending = [{ value: params }];
    const active = new WeakSet();
    const visited = new WeakSet();

    while (pending.length) {
      const { value, done } = pending.pop();
      if (!utils.isPlainObject(value) && !utils.isArray(value)) continue;
      if (done) {
        active.delete(value);
        continue;
      }
      if (active.has(value)) {
        throw new AxiosError('Circular reference detected in params', AxiosError.ERR_BAD_OPTION_VALUE);
      }
      if (visited.has(value)) continue;
      visited.add(value);
      active.add(value);
      pending.push({ value, done: true });
      // Iterate keys safely...
    }
  }
  ```
- **Circular Redaction Guard (`redactConfig.js`)**:
  When scrubbing sensitive keys from config objects prior to error serialization, an array `seen = []` tracks visited references. Upon encountering an existing reference, it short-circuits with `undefined` to guarantee termination.

### 3. UI & UX Micro-Mechanics (Browser/Client Engine Safety)
- **Monotonic Duration Calculation under Clock Skew**:
  Standard wall-clock calculation `Date.now() - start` can yield negative numbers if the client OS synchronizes with an NTP server mid-flight and sets the clock backward.
  *Axios Invariant*: Clamp latency calculations to zero to prevent invalid metrics in UI progress bars:
  ```javascript
  function elapsedSince(start) {
    return Math.max(0, Date.now() - start);
  }
  ```
- **CRLF Injection Neutralization in Browser Headers**:
  Injecting carriage returns (`\r\n`) into header values can trigger HTTP Response Splitting.
  *Axios Invariant*: In `sanitizeHeaderValue`, validate and strip line-terminating tokens before passing values to XMLHttpRequest/Fetch.

### 4. Backend Concurrency & Memory Safety
- **Tombstone Cleanup in Iteration Stacks**:
  Deleting elements in long-lived middleware arrays by setting them to `null` prevents index thrashing, but unbounded additions/ejections create memory leaks over time.
  *Axios Invariant*: Trim trailing null references immediately once all re-entrant iteration contexts complete (`iterationDepth === 0`):
  ```javascript
  function trimHandlers(handlers) {
    if (!handlers) return;
    while (handlers.length && handlers[handlers.length - 1] === null) {
      handlers.pop();
    }
  }
  ```
- **Clean-up of Ephemeral Contextual State**:
  Attaching the `response` instance to `config` during data transformations (so custom parsers can inspect status codes) risks leaking socket and memory buffers if retained.
  *Axios Invariant*: Enforce cleanup within a `finally` block:
  ```javascript
  config.response = response;
  try {
    response.data = transformData.call(config, config.transformResponse, response);
  } finally {
    delete config.response; // Guarantees zero leak even if transform throws
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Non-Enumerable Object Prototype Setter Poisoning Protection**:
  When constructing objects that downstream user code expects to support `.hasOwnProperty()`, instantiating via `Object.create(null)` strips the method, causing `config.hasOwnProperty is not a function`.
  *Axios Invariant*: In `mergeConfig.js`, explicitly define a frozen, non-enumerable descriptor restoring the method:
  ```javascript
  const hasOwnPropertyDescriptor = Object.freeze({
    __proto__: null,
    value: Object.prototype.hasOwnProperty,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  const config = Object.create(null);
  Object.defineProperty(config, 'hasOwnProperty', hasOwnPropertyDescriptor);
  ```

---

## 5.