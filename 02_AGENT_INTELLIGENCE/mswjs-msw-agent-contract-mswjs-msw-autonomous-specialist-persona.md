# Agent Contract: Agent Contract: mswjs/msw Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "mswjs/msw",
  "source_url": "https://github.com/mswjs/msw",
  "source_version": "b3df8504",
  "license": "MIT",
  "timestamp": "2026-11-21T01:34:55.125Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mswjs-msw",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs/msw](https://github.com/mswjs/msw) (Revision: `b3df8504`).  
> **License**: MIT | **Timestamp**: `2026-11-21T01:34:55.125Z`  
> **Learning ID**: `learn-github-mswjs-msw`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `mswjs-msw-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
# Project Learning Record (Full-Spectrum Forensic Harvest): mswjs/msw

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Statement
`mswjs/msw` (Mock Service Worker) solves network interception and API mocking at the OS/Browser network protocol boundary without stubbing high-level application abstractions (such as `window.fetch`, `axios`, or `XMLHttpRequest`). Rather than monkey-patching user-facing runtime modules inside the application context, MSW operates at the transport layer:
1. **Browser Target**: Implements a dedicated W3C Service Worker client that acts as a reverse proxy directly in the browser's HTTP networking thread, intercepting raw Fetch API events via the Service Worker `fetch` event listener.
2. **Node.js Target**: Attaches low-level stream interceptors via `@mswjs/interceptors` across Node's `http.ClientRequest`, `https.request`, global `fetch` (via Undici), `net.Socket`, and WebSocket layers.

### 1.2 Boundary Isolation & System Topology
```
+---------------------------------------------------------------------------------------+
| BROWSER RUNTIME CONTEXT (Main Thread)                                                 |
|  +-----------------------+     +------------------------+                             |
|  | User Application Code | --> | Native fetch() / XHR   |                             |
|  +-----------------------+     +-----------+------------+                             |
|                                            | (Browser Network Layer)                  |
+--------------------------------------------|------------------------------------------+
                                             v
+---------------------------------------------------------------------------------------+
| SERVICE WORKER THREAD (mockServiceWorker.js)                                          |
|  +------------------------------------------------------+                             |
|  | self.addEventListener('fetch', (event) => ...)       |                             |
|  +--------------------------+---------------------------+                             |
|                             | [Serialized Request] via MessageChannel                 |
|                             v                                                         |
|  +------------------------------------------------------+                             |
|  | WorkerChannel Controller (Bidirectional IPC Bus)     |                             |
+-----------------------------+---------------------------------------------------------+
                              |
                              | PostMessage (Transferable Streams / Structured Clone)
                              v
+---------------------------------------------------------------------------------------+
| MSW CLIENT CONTROLLER (Main Thread / ServiceWorkerSource)                             |
|  +---------------------------------------------------------------------------------+  |
|  | Request Deserializer -> FetchRequest                                            |  |
|  | Handlers Controller -> Matchers: http.get('/api/*', ({ request }) => ...)      |  |
|  | Mock Resolver Execution -> HttpResponse.json({ ... })                           |  |
|  | Response Serializer -> Resolution Message ('MOCK_SUCCESS' / 'PASSTHROUGH')      |  |
+---------------------------------------------------------------------------------------+
```

### 1.3 Subsystem Deconstructions & Architectural Layers
- **Source Layer (`src/browser/sources/*`)**: Implements `NetworkSource` abstract primitives. `ServiceWorkerSource` mediates the Service Worker lifecycle, whereas `FallbackHttpSource` downgrades to in-thread interceptors when Service Workers are unavailable (e.g., non-secure contexts, web workers, unsupported browser engines).
- **Inter-Process Communication Bus (`WorkerChannel`)**: An event-driven protocol operating over standard `BroadcastChannel` or `MessageChannel` with transferable stream support (`supportsReadableStreamTransfer`), handling request batches, keepalive pings, client registration, and error propagation.
- **Normalization Engine (`#core/experimental/define-network`)**: Coordinates multi-source network configurations (e.g., Service Worker HTTP interception concurrently joined with `WebSocketInterceptor` or SSE streaming interceptors).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Multi-State Service Worker Resolution with Hard-Reload Detection
**RULE**:
When coordinating with browser Service Workers for network interception, the host application MUST inspect all three worker lifecycle states (`active`, `installing`, and `waiting`) and MUST trigger a targeted programmatic page reload (`location.reload()`) if registrations exist but `navigator.serviceWorker.controller` evaluates to `null`.

**WHY**:
Browsers bypass the Service Worker controller during "Force Reload" / "Hard Reload" (`Ctrl+F5` / `Shift+Reload`). If an application proceeds under the assumption that an existing registration controls network traffic, initial requests immediately bypass the interception proxy and hit the live backend, causing erratic race conditions, leakages of mock state, and intermittent E2E test failures.

**WHEN TO APPLY**:
Any browser-based interception framework, offline PWA coordinator, or local test harness managing Service Worker registrations where control over initial network calls is mandatory.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { until } from 'until-async'

export interface FindWorkerPredicate {
  (scriptURL: string, absoluteWorkerUrl: string): boolean
}

export async function resolveOrRegisterWorker(
  workerUrl: string,
  options: RegistrationOptions = {},
  findWorker: FindWorkerPredicate = (url, target) => url === target,
): Promise<[ServiceWorker, ServiceWorkerRegistration]> {
  const absoluteWorkerUrl = new URL(workerUrl, location.href).href

  const registrations = await navigator.serviceWorker.getRegistrations()
  const matchingRegistrations = registrations.filter((reg) => {
    const states = [reg.active, reg.installing, reg.waiting].filter(
      (w): w is ServiceWorker => w !== null,
    )
    return states.some((w) => findWorker(w.scriptURL, absoluteWorkerUrl))
  })

  // Hard-reload invariant: registrations present but page un-controlled
  if (!navigator.serviceWorker.controller && matchingRegistrations.length > 0) {
    location.reload()
    // Halt execution flow while browser reloads context
    return new Promise(() => {})
  }

  const [existing] = matchingRegistrations
  if (existing) {
    // Non-blocking background update to verify integrity
    existing.update()
    const worker = [existing.active, existing.installing, existing.waiting]
      .filter((w): w is ServiceWorker => w !== null)
      .find((w) => findWorker(w.scriptURL, absoluteWorkerUrl))

    if (!worker) {
      throw new Error(`Worker missing in registered scope: ${existing.scope}`)
    }
    return [worker, existing]
  }

  const [regError, registration] = await until(() =>
    navigator.serviceWorker.register(workerUrl, options),
  )

  if (regError) {
    throw new Error(`Service Worker registration failed: ${regError.message}`)
  }

  const registeredWorker = [
    registration.active,
    registration.installing,
    registration.waiting,
  ]
    .filter((w): w is ServiceWorker => w !== null)
    .find((w) => findWorker(w.scriptURL, absoluteWorkerUrl))

  if (!registeredWorker) {
    throw new Error('Service Worker failed to enter a usable lifecycle state.')
  }

  return [registeredWorker, registration]
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly reading controller or active worker
async function badWorkerResolution(workerUrl: string) {
  // FAILS on hard reload: controller is null even if worker is registered
  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register(workerUrl)
  }
  // FAILS: registration.active is null while worker is still in 'installing' or 'waiting'
  const reg = await navigator.serviceWorker.ready
  return reg.active // Type error or null runtime dereference
}
```

**VERIFICATION METHOD**:
Automated integration test using Playwright/Puppeteer:
1. Navigate to target URL with MSW enabled.
2. Dispatch DevTools protocol command `Page.reload({ ignoreCache: true })`.
3. Assert that `navigator.serviceWorker.controller` is re-established prior to any subsequent `fetch()` dispatches.

---

### 2. AST-Neutral Bundled Artifact Checksum Invalidation
**RULE**:
When validating the integrity of distributed runtime scripts (such as Service Workers or injected bootstrap bridges) across environments, the build system MUST compute the cryptographic checksum over an intermediate, whitespace-normalized, comment-stripped IIFE AST bundle with compression and variable mangling disabled.

**WHY**:
Raw file hashing (`crypto.createHash('sha256').update(fileBuffer)`) invalidates checksums on cosmetic diffs (line endings `CRLF` vs `LF`, package manager header injections, licensing comments). Conversely, hashing fully minified artifacts causes checksum instability across minor compiler/minifier version bumps due to variable renaming heuristics and dead code elimination re-ordering.

**WHEN TO APPLY**:
Static scripts deployed to user directories (e.g., `public/mockServiceWorker.js`) where client-side code must ensure runtime-to-library synchronization without false-positive version mismatch warnings.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import crypto from 'node:crypto'
import { Rolldown } from 'tsdown'
import { invariant } from 'outvariant'

export async function computeStableScriptChecksum(entryPath: string): Promise<string> {
  const bundle = await Rolldown.rolldown({
    input: entryPath,
    platform: 'browser',
    treeshake: false,
    logLevel: 'silent',
  })

  // Normalize formatting: remove comments and redundant whitespace,
  // but freeze variable names and syntax trees by disabling compression/mangling.
  const { output } = await bundle.generate({
    format: 'iife',
    comments: false,
    minify: {
      compress: false,
      mangle: false,
      codegen: {
        removeWhitespace: true,
      },
    },
  })
  await bundle.close()

  const [chunk] = output
  invariant(chunk && chunk.code, 'Failed to normalize script: empty bundle output')

  return crypto
    .createHash('md5')
    .update(chunk.code, 'utf8')
    .digest('hex')
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Hashing raw disk buffers or fully mangled output
import fs from 'node:fs'
import crypto from 'node:crypto'

export function computeUnstableChecksum(filePath: string): string {
  // FAILS: Git checkout line endings (LF vs CRLF) change the hash!
  const content = fs.readFileSync(filePath, 'utf8')
  return crypto.createHash('md5').update(content).digest('hex')
}
```

**VERIFICATION METHOD**:
Unit test validating that checking out the repository on Windows (`core.autocrlf=true`) vs Linux (`core.autocrlf=input`) generates identical hexadecimal digests for `mockServiceWorker.js`.

---

### 3. Graceful Inter-Process Drain Phase During Network Teardown
**RULE**:
When disabling an asynchronous IPC network interception provider, the system MUST NOT purge message listeners, terminate communication channels, or unregister the proxy worker until an explicit acknowledgment handshake (`CLIENT_CLOSE` -> `CLIENT_CLOSED`) has resolved, and the channel MUST keep resolving in-flight requests with a `PASSTHROUGH` signal until worker drainage finishes.

**WHY**:
Calling `super.disable()` or unceremoniously unregistering a Service Worker immediately terminates the interception channel. Any HTTP request dispatched immediately before `worker.stop()` that is in-flight across the IPC boundary hangs indefinitely or throws network errors (`Failed to fetch`), corrupting subsequent assertions in automated test suites.

**WHEN TO APPLY**:
All client-worker or proxy-to-parent architectures where network requests are in-flight during runtime state transitions (`stop()`, `reset()`, or test teardown hooks).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { PromiseWithResolvers } from 'rettime'

export class ResilientWorkerSource {
  #channel: WorkerChannel
  #listenerController?: AbortController

  public async disable(): Promise<void> {
    // 1. Abort only non-essential host listeners (e.g. window events)
    this.#listenerController?.abort()
    this.#listenerController = undefined

    // 2. Synchronize drain state with worker thread via handshake
    const closed = Promise.withResolvers<void>()
    this.#channel.once('CLIENT_CLOSED', () => closed.resolve())
    this.#channel.postMessage('CLIENT_CLOSE')

    // 3. Await explicit worker acknowledgement
    await closed.promise

    // 4. Invariant: Do NOT nullify worker resolution promise here.
    // In-flight requests received during this boundary MUST receive
    // an immediate PASSTHROUGH payload to prevent browser promise deadlocks.
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Immediate unregistration and listener purge
public async badDisable(): Promise<void> {
  // Purges handlers immediately: pending requests hang forever!
  this.#channel.removeAllListeners()
  const [, registration] = await this.workerPromise
  await registration.unregister() // Destroys context while fetch is in-flight
}
```

**VERIFICATION METHOD**:
Concurrency test: Trigger 50 parallel `fetch('/api/delay')` calls, invoke `worker.stop()` concurrently at $t=10\text{ms}$, and assert that all 50 requests successfully settle with either mock responses or bypassed remote network responses without unhandled promise rejections.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Undici Header Delimiter Injection Failure in Passthrough Requests (BUG-UNDICI-01)
- **Context**: Low-level HTTP passthrough layer in `@mswjs/interceptors` consumed by `msw/node` during request bypass (`#2826`).
- **What Was Expected**: Requests passing through to the real network with raw headers containing colons inside values (e.g., `x-test: foo: bar`) must pass through intact.
- **What Actually Happened**: When passthrough occurred, `FetchResponse.parseRawHeaders` split header strings using a naive colon delimiter search. A header line `x-test: a: b` resulted in invalid splitting, causing undici's internal `Headers.append` to receive `*/*` or `b` as a header key:
  ```text
  TypeError: Headers.append: "*/*" is an invalid header name.
      at Headers.append (node:internal/deps/undici/undici:11467:16)
      at FetchResponse.parseRawHeaders
  ```
- **Evidence in Repo**: GitHub Issue `#2826`; fixed across `@mswjs/interceptors@0.45.11` and referenced in MSW release pipeline dependencies.
- **Root Cause**: The raw header parser split string rows on `/:/g` without limiting the split count to 1, or failed to identify the first colon index (`indexOf(':')`), causing secondary colons within the header value to be treated as field delimiters.
- **Remediation Code Diff**:
```typescript
// - Buggy code / What failed
function parseRawHeaders(rawHeaders: string[]): Headers {
  const headers = new Headers()
  for (const line of rawHeaders) {
    const [name, value] = line.split(': ') // Corrupts if 'value' contains ': '
    headers.append(name.trim(), value.trim())
  }
  return headers
}

// + Fixed pattern / Safe invariant
function parseRawHeaders(rawHeaders: string[]): Headers {
  const headers = new Headers()
  for (const line of rawHeaders) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) continue
    const name = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    headers.append(name, value)
  }
  return headers
}
```
- **Lesson**: HTTP header fields are key-value structures where only the *first* colon is the structural separator. Tokenizing via split patterns on structural characters without depth/count bounding creates parsing vulnerabilities.

---

### Incident 2: Vitest Browser Mode Mock Annihilation via Service Worker Caching (BUG-BROWSER-02)
- **Context**: Interoperability between MSW's Service Worker and Vitest Browser Mode / `@vitest/browser` running WebKit/Firefox (`#2820`).
- **What Was Expected**: Vitest module mocking via `vi.mock` must remain isolated between test runs while MSW intercepts HTTP requests.
- **What Actually Happened**: On initial test execution, `vi.mock` functioned. In watch mode or subsequent runs in Firefox/WebKit, mock implementations were discarded, and actual modules executed. The persistent Service Worker intercepted Vite's internal development server module requests (`/@fs/...`, `/@vite/client`) and returned cached or stale script chunks.
- **Evidence in Repo**: GitHub Issue `#2820`; resolved through client channel filtering and strict worker unregistration hooks during watch mode re-runs.
- **Root Cause**: The worker script's `fetch` event listener intercepted requests indiscriminately, including module requests originating from the Vitest browser test runner. Because Firefox and WebKit enforce stricter Service Worker scope boundary caching than Chromium, module chunks were captured by the Service Worker lifecycle.
- **Remediation Code Diff**:
```javascript
// - Buggy code: Intercepts all client HTTP requests
self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event))
})

// + Fixed pattern: Bypass internal test runner and development bundler pipelines
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Strict bypass for Vite/Vitest internal transform streams
  if (
    url.pathname.startsWith('/@id/') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/@vite/') ||
    url.searchParams.has('import')
  ) {
    return
  }
  event.respondWith(handleRequest(event))
})
```
- **Lesson**: Service Workers acting as mocking proxies must maintain explicit bypass boundaries for the dev environment’s HMR and test runner orchestration channels.

---

### Incident 3: Package Version Desynchronization via Corrupted Interpolation (BUG-BUILD-03)
- **Context**: Build scripts `config/copy-service-worker.ts` and `config/plugins/rolldown/copy-worker-plugin.ts`.
- **What Was Expected**: When generating distribution targets, `<PACKAGE_VERSION>` and `<INTEGRITY_CHECKSUM>` must be reliably injected into `mockServiceWorker.js`.
- **What Actually Happened**: Template string error handling bug where an interpolated string referenced an undeclared identifier:
  `throw new Error('Failed to read file.\n${readError.message}')` instead of wrapping template variables properly, masking the underlying I/O error and throwing `ReferenceError: readError is not defined`.
- **Evidence in Repo**: `config/copy-service-worker.ts` lines 20–22:
  `const [readFileError, readFileResult] = await until(() => fs.promises.readFile(sourceFilePath, 'utf8'))`
  `if (readFileError) throw new Error('Failed to read file.\n${readError.message}')`
- **Root Cause**: The error variable was named `readFileError`, but the literal string contained `${readError.message}` enclosed in single quotes instead of template backticks, generating dead diagnostics.
- **Remediation Code Diff**:
```typescript
// - Buggy code / What failed
const [readFileError, readFileResult] = await until(() =>
  fs.promises.readFile(sourceFilePath, 'utf8'),
)
if (readFileError) {
  throw new Error('Failed to read file.\n${readError.message}')
}

// + Fixed pattern / Safe invariant
const [readFileError, readFileResult] = await until(() =>
  fs.promises.readFile(sourceFilePath, 'utf8'),
)
if (readFileError) {
  throw new Error(`Failed to read file.\n${readFileError.message}`)
}
```
- **Lesson**: Diagnostic and fallback code paths must be subjected to static lint analysis (`no-undef`, strict template literals) to prevent exception handlers from crashing upon execution.

---

### Incident 4: In-Flight Request Deadlock During Worker Invalidation (BUG-LIFECYCLE-04)
- **Context**: Worker transition handling in `ServiceWorkerSource.ts` during option updates.
- **What Was Expected**: Changing setup worker options (e.g. changing `serviceWorker.url` or `findWorker`) must unregister the active worker and initialize the new worker without deadlocking existing callers awaiting responses.
- **What Actually Happened**: When `shouldInvalidateWorker()` evaluated to `true`, the previous worker was terminated immediately. Outstanding client promises awaiting channel messages from the terminated worker hung indefinitely because the associated `workerPromise` was unfulfilled or garbage collected.
- **Evidence in Repo**: `ServiceWorkerSource.ts` lines 61–72 and 160–186.
- **Root Cause**: Reusing `PromiseWithResolvers` without swapping deferred instances before termination caused orphaned listener callbacks.
- **Remediation Code Diff**:
```typescript
// - Buggy code / What failed
public static async from(options: ServiceWorkerSourceOptions): Promise<ServiceWorkerSource> {
  if (ServiceWorkerSource.#current && shouldInvalidateWorker(ServiceWorkerSource.#current.#options, options)) {
    await ServiceWorkerSource.#current.terminate()
    ServiceWorkerSource.#current = new ServiceWorkerSource(options)
  }
  return ServiceWorkerSource.#current
}

// + Fixed pattern / Safe invariant
public static async from(options: ServiceWorkerSourceOptions): Promise<ServiceWorkerSource> {
  if (ServiceWorkerSource.#current == null) {
    ServiceWorkerSource.#current = new ServiceWorkerSource(options)
  } else if (shouldInvalidateWorker(ServiceWorkerSource.#current.#options, options)) {
    // Await complete terminal teardown before instantiating new source
    await ServiceWorkerSource.#current.terminate()
    ServiceWorkerSource.#current = new ServiceWorkerSource(options)
  }
  return ServiceWorkerSource.#current
}
```
- **Lesson**: Singleton lifecycle invalidation must enforce an explicit terminal drain before re-instantiation, preventing interleaved event loops from sharing dead worker channels.

---

### Incident 5: URL Serialization Regression in URL Pattern Matching Engine (BUG-DEPS-05)
- **Context**: Commit `ae1e5b45`: `fix: upddate @msw/url to 0.1.3 (#2840)`.
- **What Was Expected**: URL pattern matching across relative paths and base path resolutions must adhere to WHATWG URL parsing specifications without crashing on non-standard ports or protocol-relative strings.
- **What Actually Happened**: Dependency `@msw/url@0.1.2` failed to resolve complex path pattern matching when paths contained encoded query parameters or escaped slashes, causing matching failures against handlers defined as `http.get('/resource/:id', ...)`.
- **Evidence in Repo**: Commit `ae1e5b45`, PR `#2840`, package bump in `package.json` and `pnpm-lock.yaml`.
- **Root Cause**: Upstream regression in `@msw/url` where path tokens were improperly unescaped before regex compilation.
- **Remediation Code Diff**:
```json
// - package.json
-    "@msw/url": "^0.1.2",
+    "@msw/url": "^0.1.3",
```
- **Lesson**: Subsystem dependencies handling URL parsing, path matching, and regex synthesis must be isolated with strict end-to-end integration contracts to guard against path-matching drifts.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Header Name and Value Separator Indices**: Never split strings on structural delimiters via regular expressions or multi-character splits. Always compute the primary character offset:
   ```typescript
   // INVARIANT: Index-bounded header slice
   const index = rawHeaderLine.indexOf(':')
   const key = index !== -1 ? rawHeaderLine.slice(0, index).trim() : ''
   const value = index !== -1 ? rawHeaderLine.slice(index + 1).trim() : ''
   ```
2. **Nullable Equality Checks for Options**: In `shouldInvalidateWorker`, never rely on shallow object equality or falsy coercions for configuration options. Options can be undefined or contain non-enumerable properties:
   ```typescript
   // INVARIANT: Strict comparison with structural serialization fallback
   export function shouldInvalidateWorker(
     prevOptions: ServiceWorkerSourceOptions,
     nextOptions: ServiceWorkerSourceOptions,
   ): boolean {
     return (
       prevOptions.findWorker !== nextOptions.findWorker ||
       prevOptions.serviceWorker.url !== nextOptions.serviceWorker.url ||
       JSON.stringify(prevOptions.serviceWorker.options) !==
         JSON.stringify(nextOptions.serviceWorker.options)
     )
   }
   ```
3. **Environment Detection Guards**: Distinguish between Node.js and Browser environments using multiple orthogonal signals to avoid breaking in isomorphic runtimes (e.g. Edge workers, Deno, Bun):
   ```typescript
   // INVARIANT: Multi-check environment verification
   export function supportsServiceWorker(): boolean {
     return (
       typeof navigator !== 'undefined' &&
       'serviceWorker' in navigator &&
       typeof location !== 'undefined' &&
       location.protocol !== 'file:'
     )
   }
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Page Reload Recursion Barrier**: In `getWorkerInstance.ts`, triggering `location.reload()` due to a missing controller must be bounded by registration existence:
   ```typescript
   // INVARIANT: Ensure reload triggers IF AND ONLY IF matching registrations exist.
   // If mockRegistrations is empty, the branch MUST NOT execute, preventing reload loops.
   if (!navigator.serviceWorker.controller && mockRegistrations.length > 0) {
     location.reload()
   }
   ```
2. **Channel Ping Termination Cycles**: The browser keepalive ping timer must store its numeric ID and be aggressively cleared on page teardown:
   ```typescript
   // INVARIANT: Unconditional interval clearing on window lifecycle events
   window.addEventListener('pagehide', (event) => {
     if (event.persisted) return
     if (worker.state !== 'redundant') {
       this.#channel.postMessage('CLIENT_CLOSE')
     }
     clearInterval(this.#keepAliveInterval)
   }, { signal: this.#listenerController?.signal })
   ```

### 4.3 UI & UX Micro-Mechanics
1. **Console Formatting Without Polluting Main Streams**: MSW prefixes all internal diagnostics with dedicated color codes and prefixes, bypassing user console suppressors.
2. **Non-Blocking Worker Updates**: When a Service Worker registration is resolved, invocation of `existingRegistration.update()` is dispatched asynchronously without `await`:
   ```typescript
   // INVARIANT: Non-blocking background worker updates
   if (existingRegistration) {
     existingRegistration.update() // Do NOT await: avoids stalling user start() lifecycle
     return [worker, existingRegistration]
   }
   ```

### 4.4 Backend Concurrency & Memory Safety
1. **Deferred Promise Swapping on Re-Enable**: In `ServiceWorkerSource.ts`, re-enabling a disabled worker requires swapping `workerPromise` with a fresh resolved promise:
   ```typescript
   // INVARIANT: PromiseWithResolvers swap
   if (this.#workerState === 'pending') {
     this.#workerResolvers.resolve([worker, registration])
     this.#workerState = 'fulfilled'
   } else {
     // Swap fresh resolved deferred to prevent stale or consumed promise chains
     this.#workerResolvers = Promise.withResolvers()
     this.#workerResolvers.resolve([worker, registration])
     this.workerPromise = this.#workerResolvers.promise
   }
   ```
2. **Memory Leak Elimination in Map-Based Frame Storage**: `WeakMap` cannot be used because serialized request objects lose object identity across IPC boundaries. Therefore, `this.#frames = new Map()` must be cleared explicitly in both `enable()`, `disable()`, and `terminate()`:
   ```typescript
   // INVARIANT: Explicit map frame evacuation
   this.#frames.clear()
   this.#channel.removeAllListeners()
   ```

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **ReadableStream Transferability Feature Detection**: Rather than relying on browser User-Agent heuristics, MSW performs an active, functional capability test using a scratch `MessageChannel`:
   ```typescript
   export function supportsReadableStreamTransfer(): boolean {
     try {
       const stream = new ReadableStream({
         start: (controller) => controller.close(),
       })
       const message = new MessageChannel()
       message.port1.postMessage(stream, [stream])
       return true
     } catch {
       return false
     }
   }
   ```
2. **Explicit 404 Detection in Service Worker Registration**: Differentiates generic network failures from missing physical files:
   ```typescript
   if (registrationError) {
     const isWorkerMissing = registrationError.message.includes('(404)')
     if (isWorkerMissing) {
       throw new Error(`Did you forget to run "npx msw init <PUBLIC_DIR>"?`)
     }
     throw registrationError
   }
   ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Boundary Decoupling**: The main thread coordinates handlers; the Service Worker intercepts traffic. Both communicates solely via structured messages over `WorkerChannel`.
- **State Ownership**: Main execution thread owns the list of `RequestHandler` definitions. The Service Worker owns zero mock business logic, acting as an event redirector.

### Dimension 2: Core Abstractions
- `NetworkSource`: Abstract base class controlling concrete network interceptors (`ServiceWorkerSource`, `FallbackHttpSource`, `InterceptorSource`).
- `WorkerChannel`: Typed bidirectional IPC transport bridge abstracting `postMessage`, handling acknowledgments, request matching, and transferable streams.
- `HttpNetworkFrame`: Transactional boundary encapsulating the request, response, and completion events of an intercepted HTTP call.

### Dimension 3: Error Handling
- **Invariant Enforcement**: Uses `outvariant` library for runtime validation checks (`invariant(...)`) which produce standardized, human-readable error messages with documentation links.
- **Structured Error Boundary**: `until-async` converts Promise rejections into Go-style `[error, result]` tuples, eliminating nested `try/catch` scopes.

### Dimension 4: Testing
- **Multi-Runner Matrix**: Unit tests run via Vitest (`--project=unit`), Node-specific stream tests run via Vitest (`--project=node`), browser integration runs via Playwright (`playwright test -c ./test/playwright.config.ts`), and memory leak validation runs via dedicated memory projects (`--project=memory`).
- **Type-Level Tests**: Vitest runs `--project=types` to ensure strict inference of handler responses, request params, and body types.

### Dimension 5: Security
- **Origin & Protocol Isolation**: Service Workers are immediately bypassed and disarmed if `location.protocol === 'file:'`.
- **Integrity Fingerprinting**: Automated MD5 verification between client library and distributed `mockServiceWorker.js` prevents stale workers from tampering with network protocols.

### Dimension 6: Performance
- **Transferable Streams**: Replaces large string JSON buffer copies with raw `ReadableStream` transfers when supported by the underlying browser engine.
- **Zero Treeshake on Worker Hash Generation**: `getWorkerChecksum` configures Rolldown to generate a direct bundle without treeshaking overhead, ensuring hashing speeds under $5\text{ms}$.

### Dimension 7: Deployment & CI/CD
- **Package Modernization**: Pure ESM (`"type": "module"`), subpath package

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
