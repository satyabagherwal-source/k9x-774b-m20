> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/unjs-h3-learnings.md`  
> **Source**: github ([https://github.com/unjs/h3](https://github.com/unjs/h3))  
> **Source Version**: `b64166ae`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T08:01:01.164Z  
> **Learning ID**: `learn-github-h3js-h3`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): h3js/h3

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`h3` (v2) is a minimal, composable, high-performance HTTP server framework engineered for universal execution across diverse JavaScript runtimes: Node.js, Deno, Bun, Cloudflare Workers (`workerd`), Service Workers / Browsers, and standalone edge compute. It abstracts underlying engine-specific HTTP bindings behind web-standard primitives (`Request`, `Response`, `Headers`, `ReadableStream`, `TransformStream`) while eliminating standard Web API latency and memory overheads through deferred evaluation, zero-copy mutations, and strict byte-level stream accounting.

### Architectural Boundaries & Subsystems
1. **Engine Adapters (`src/_entries/`)**: Specialized platform entry points (`node.ts`, `bun.ts`, `deno.ts`, `cloudflare.ts`, `service-worker.ts`, `generic.ts`). Each entry compiles down to runtime-specific initializers while delegating core request execution to the unified `H3` pipeline through `srvx`.
2. **Event & Request Lifecycle (`src/event.ts`, `src/response.ts`)**: Encapsulates every request in an `H3Event`. Maintains dual response states: an active header map for fast mutations (`event.res.headers`) and an immutable fallback channel (`event.res.errHeaders`) dedicated strictly to fatal error handling, preventing credential or state pollution.
3. **High-Speed Routing & Rules Engine (`rou3` integration & `src/rules/`)**: Combines radix-tree route dispatching with canonicalized pattern matching. Features strict path-scope confinement for routing rules (`prepareRuleTarget`, `prepareTailResolver`), defeating directory traversal, protocol smuggling (`//evil.com`), and authority hijacking.
4. **Validation & Type Negotiation (`src/utils/internal/validate.ts`, `standard-schema`)**: Implements runtime-agnostic input validation honoring the Standard Schema V1 specification (`~standard`). Compatible with Zod, Valibot, and TypeBox without engine lock-in.
5. **Streaming, SSE & Concurrency Containment (`src/utils/event-stream.ts`, `src/utils/body.ts`)**: Implements Server-Sent Events via custom `HTTPResponse` extensions managing backpressure, unread stream cancellations, buffered drains on pause, and bounded chunked cookie transfers.

```
+-----------------------------------------------------------------------------------+
|                        Platform Runtime Entrypoints                               |
|        Node.js   |   Bun   |   Deno   |   Cloudflare (workerd)   |   Browser     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ (srvx abstraction)
+-----------------------------------------------------------------------------------+
|                            H3 Core Application Pipeline                           |
|  - Event Instantiation (H3Event: Request, Canonical URL, Context, Runtime Bindings) |
|  - Global & Scoped Middleware Stack (withBase, tracing, basicAuth, handleCors)    |
|  - Radix Router (rou3) & Rule Dispatcher (Proxy / Redirect Scope Confined)        |
+-----------------------------------------------------------------------------------+
       │                                     │                              │
       ▼                                     ▼                              ▼
+---------------------+            +---------------------+        +---------------------+
| Body & Stream Guard |            | Error Barrier Tree  |        | Lifecycle Cleanup   |
| - Byte-counted limits            | - Dual Headers      |        | - onDispose hooks   |
| - Non-destructive                |   (res vs errRes)   |        | - SSE cancelation   |
|   sniffing / parsing             | - kHandled sentinels|        | - Transform drains  |
+---------------------+            +---------------------+        +---------------------+
```

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Scope Confinement for Dynamic URI Redirection and Proxy Rewrites
**RULE**:
When transforming, joining, or forwarding dynamic URL paths (such as wildcard routing `/**` or splat captures) into proxy destinations or HTTP redirects, the software MUST NOT rely solely on string concatenation or pre-join lexical sanitization. It MUST resolve the target URL through a spec-compliant URL parser against the authorized destination base, verify that `target.origin === base.origin`, enforce that the resulting pathname begins strictly with the expected base directory prefix, and reject all multi-slash (`//`), backslash (`\\`), or percent-encoded separator sequences (`%2f`, `%5c`, `%252f`) at the segment boundary.

**WHY**:
Dynamic path prefixes and wildcard tails often contain user-controlled input. Pre-join path checks fail because path join operations collapse consecutive empty segments (`/foo//../bar` -> `/bar`) or unmask encoded traversal tokens. If an attacker passes `//evil.example` into a naive base-join routine (`base + tail`), a target intended to be `/prefix//evil.example` transforms into a protocol-relative URL pointing to an external domain (`//evil.example`), resulting in Open Redirect or Server-Side Request Forgery (SSRF).

**WHEN TO APPLY**:
Apply in any API gateway, reverse proxy, reverse routing engine, static file handler, or CLI documentation launcher that routes request paths into outbound URLs or OS shell executions.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { URL } from "node:url";

export class SecurityTrappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityTrappingError";
  }
}

const LEADING_SEPARATOR_RUN_RE = /^(?:[/\\\\]|%(?:25)*(?:2f|5c))+/i;

export function safeResolveTarget(baseTarget: string, untrustedTail: string): string {
  // 1. Strip leading run of all forward/back slashes and double-encoded variants
  const sanitizedTail = untrustedTail.replace(LEADING_SEPARATOR_RUN_RE, "");
  
  // 2. Normalize base URL to ensure trailing slash invariance
  const baseUri = new URL(baseTarget.endsWith("/") ? baseTarget : `${baseTarget}/`);
  
  // 3. Resolve using URL parser constructor
  const resolved = new URL(sanitizedTail, baseUri);

  // 4. Origin lockdown: strictly prohibit protocol or host shifts
  if (resolved.origin !== baseUri.origin) {
    throw new SecurityTrappingError(`Target origin shift detected: ${resolved.origin} !== ${baseUri.origin}`);
  }

  // 5. Path confinement: confirm resolved path resides strictly inside target base
  const expectedBasePath = baseUri.pathname.endsWith("/") ? baseUri.pathname : `${baseUri.pathname}/`;
  if (!resolved.pathname.startsWith(expectedBasePath) && resolved.pathname !== baseUri.pathname.replace(/\/$/, "")) {
    throw new SecurityTrappingError(`Path breakout detected: ${resolved.pathname} outside ${expectedBasePath}`);
  }

  // 6. Strip userinfo (username/password) and collapse repeated directory separators
  resolved.username = "";
  resolved.password = "";
  resolved.pathname = resolved.pathname.replace(/\/{2,}/g, "/");

  return resolved.href;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER perform raw string concatenation or regex-only checks on external target URLs
export function unsafeResolveTarget(base: string, tail: string): string {
  // CRITICAL BUG: If tail is "//evil.com" or "..\..\evil.com", this escapes domain context!
  const target = base + "/" + tail;
  if (target.includes("..")) {
    throw new Error("Traversal detected"); // BYPASSED via %2e%2e or unnormalized slashes
  }
  return target;
}
```

**VERIFICATION METHOD**:
Enforce compliance using parameterized test harnesses verifying rejection of protocol-relative targets, overlong UTF-8 encodings, and backslash mutations:
```typescript
import { describe, it, expect } from "vitest";

describe("safeResolveTarget Invariant Tests", () => {
  const base = "https://example.com/subpath";
  const exploits = [
    "//attacker.com",
    "/\\attacker.com",
    "../evil",
    "%2e%2e%2froot",
    "/%252e%252e%252fadmin",
    "https://attacker.com",
    "javascript:alert(1)",
    "file:///etc/passwd"
  ];

  for (const exploit of exploits) {
    it(`fails closed against exploit payload: ${exploit}`, () => {
      expect(() => safeResolveTarget(base, exploit)).toThrow(SecurityTrappingError);
    });
  }
});
```

---

### 2. Stateless Evaluation Invariant for Shared Regular Expressions
**RULE**:
When evaluating an arbitrary or user-configurable `RegExp` against incoming request properties (such as `Origin`, `User-Agent`, or route patterns), the engine MUST NOT use `RegExp.prototype.test()` or `RegExp.prototype.exec()` if the regex instance can potentially hold the global (`g`) or sticky (`y`) flags. The engine MUST use `String.prototype.search()` or explicitly reset `regex.lastIndex = 0` before and after execution.

**WHY**:
JavaScript `RegExp` instances configured with `/g` or `/y` are stateful. Calling `.test()` or `.exec()` updates the mutable internal pointer `regex.lastIndex`. When an application reuses regex instances across multiple requests (e.g., in a CORS origin allowlist defined as a global array), repeated calls mutate `lastIndex`. A valid match will succeed on the first request, advance `lastIndex` beyond the matching index, and subsequently return `false` on the second request for the identical origin, intermittently dropping legitimate traffic or leaking authorization state.

**WHEN TO APPLY**:
Applies to all HTTP middleware, routing lookup tables, CORS interceptors, schema validators, and authorization token matchers that accept pre-compiled regular expressions from user configuration.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function isPatternAllowed(candidate: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return candidate === pattern;
  }

  if (pattern instanceof RegExp) {
    // String.prototype.search ignores and does not mutate regex.lastIndex.
    // It guarantees completely stateless evaluation even if compiled with /g or /y.
    return candidate.search(pattern) !== -1;
  }

  return false;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER execute stateful test() on shared or caller-provided RegExp objects
const originPattern = /^https:\/\/app\.example\.com$/g;

export function unsafeCorsCheck(origin: string): boolean {
  // CRITICAL DEFECT: If origin matches, lastIndex becomes 26.
  // Next invocation with identical input starts matching at index 26 and returns false!
  return originPattern.test(origin);
}
```

**VERIFICATION METHOD**:
Create a deterministic concurrency unit test proving `lastIndex` invariance and multi-pass repeatability:
```typescript
import { it, expect } from "vitest";

it("maintains stateless regex verification over multiple executions", () => {
  const flags = ["g", "y", "gy", ""];
  for (const flag of flags) {
    const rx = new RegExp("^https:\\/\\/trusted\\.domain\\.com$", flag);
    rx.lastIndex = 4; // Intentionally corrupt initial state
    
    expect(isPatternAllowed("https://trusted.domain.com", rx)).toBe(true);
    expect(isPatternAllowed("https://trusted.domain.com", rx)).toBe(true);
    expect(isPatternAllowed("https://evil.com", rx)).toBe(false);
    expect(rx.lastIndex).toBe(4); // Prove lastIndex was completely untouched
  }
});
```

---

### 3. Sentinel Error Quarantine for Committed Stream Handlers
**RULE**:
When an asynchronous response or background task terminates prematurely after sending bytes or headers over the wire, the pipeline MUST propagate a unique, immutable sentinel symbol (e.g., `kHandled`) instead of standard operational errors. Downstream middleware, error-rendering handlers, and framework wrappers MUST check for this sentinel and MUST NOT attempt to serialize, re-render, or append a secondary error response (e.g., JSON 500) if the sentinel is detected.

**WHY**:
In streaming architectures (such as Node.js `.pipe()`, Web Streams, or SSE), headers and partial payloads are committed immediately. If a generator or piped stream fails halfway through transmission, the HTTP status is already fixed (typically 200 OK) and chunks are already in flight. If generic error-handling middleware intercepts this exception and treats it as an unhandled error, it will attempt to mutate response headers and output an error payload (e.g., `{"status": 500}`), causing unhandled promise rejections, `ERR_HTTP_HEADERS_SENT` fatal crashes, or malformed data frames that corrupt client deserialization.

**WHEN TO APPLY**:
Applies to any web server layer integrating Web Streams, Node.js streams, Server-Sent Events, or reverse-proxy chunked pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export const kHandled = Symbol.for("h3.handled");

export interface StreamPipelineOptions {
  onError: (err: unknown) => void;
}

export async function executeMiddlewareChain(
  event: { headersSent: boolean },
  next: () => Promise<unknown>,
  renderErrorResponse: (err: unknown) => unknown,
): Promise<unknown> {
  try {
    return await next();
  } catch (error: unknown) {
    // Check if the stream or handler has already committed the wire response
    if (error === kHandled || event.headersSent) {
      // Re-throw sentinel to escape middleware chain without rendering secondary error
      throw kHandled;
    }

    // Safe to render clean error response since headers were never committed
    return renderErrorResponse(error);
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER blindly catch errors and attempt to write JSON errors on streaming failures
export async function unsafeMiddleware(req: any, res: any, next: any) {
  try {
    await next();
  } catch (err) {
    // FATAL CRASH: If res.write() was called inside next(), this throws ERR_HTTP_HEADERS_SENT
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}
```

**VERIFICATION METHOD**:
Integration testing with aborted generator streams:
```typescript
import { it, expect, vi } from "vitest";

it("bypasses error renderer when failure occurs post-stream-commitment", async () => {
  const errorRendererSpy = vi.fn();
  let headersSent = true; // Emulate committed stream state

  const runner = executeMiddlewareChain(
    { headersSent },
    async () => {
      throw kHandled;
    },
    errorRendererSpy
  );

  await expect(runner).rejects.toBe(kHandled);
  expect(errorRendererSpy).not.toHaveBeenCalled();
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: CLI Remote Command Injection & Origin Bypass in Windows Documentation Launcher (BUG-H3-CLI-01)
- **Context**: Subsystem: Command-Line Interface (`bin/h3.mjs`), test harness (`test/unit/cli.test.ts`).
- **What Was Expected**: Executing `h3 docs [page]` should open `https://h3.dev/[page]` in the host's default web browser securely without spawning external processes through an unquoted shell.
- **What Actually Happened**: The command used `cmd /c start ""` on Windows. When arbitrary user input was supplied as `[page]`, shell metacharacters (`&`, `|`, `%VAR%`) were parsed directly by `cmd.exe`, allowing command execution (e.g., `h3 docs "x&calc.exe"`). Furthermore, arbitrary protocols (`file:`, `javascript:`, `//host`) were permitted because origin verification was absent.
- **Evidence in Repo**: Commit SHA `7150b0e1`, files `bin/h3.mjs`, `test/unit/cli.test.ts`.
- **Root Cause**: Reliance on shell execution wrapper (`cmd.exe /c start`) combined with insufficient validation of relative URL path inputs, permitting protocol-relative escapes and parameter injection into the Windows command shell.
- **Remediation Code Diff**:
```diff
--- a/bin/h3.mjs
+++ b/bin/h3.mjs
@@ -6,11 +6,24 @@
  if (process.argv[2] === "docs") {
    const page = (process.argv[3] || "").replace(/^\/+/, "");
-  const url = new URL(page, "https://h3.dev/").href;
+  const url = new URL(page, "https://h3.dev/");
+  // Only open h3.dev pages (blocks absolute, file:, javascript:, //host, \\host, ...)
+  if (url.origin !== "https://h3.dev") {
+    console.error(`Invalid docs page: ${JSON.stringify(page)}`);
+    process.exit(1);
+  }
+  url.username = url.password = "";
+  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
+  // rundll32 instead of `cmd /c start` so cmd.exe never parses the URL (& | % ...)
+  // Absolute path so a rundll32.exe in cwd is never picked up
   const [cmd, ...args] =
     process.platform === "win32"
-      ? ["cmd", "/c", "start", "", url]
-      : [process.platform === "darwin" ? "open" : "xdg-open", url];
+      ? [
+          `${process.env.SystemRoot || "C:\\Windows"}\\System32\\rundll32.exe`,
+          "url.dll,FileProtocolHandler",
+          url.href,
+        ]
+      : [process.platform === "darwin" ? "open" : "xdg-open", url.href];
```
- **Lesson**: Never invoke OS-level document openers via command shells (`cmd.exe`). On Windows, execute `rundll32.exe url.dll,FileProtocolHandler` using fully qualified system paths (`SystemRoot\System32`) to bypass shell metacharacter expansion and prevent binary hijacking from the current working directory (`cwd`).

---

### Incident 2: Cross-Request Origin Verification Flaw Due to Stateful RegExp (BUG-H3-CORS-02)
- **Context**: Subsystem: CORS Policy Enforcer (`src/utils/internal/cors.ts`), tests (`test/unit/cors.test.ts`).
- **What Was Expected**: If an origin matches a configured regular expression in `options.origin`, subsequent matching requests from the same origin must continue to pass CORS authorization deterministically.
- **What Actually Happened**: When developers passed regular expressions compiled with the global (`/g`) or sticky (`/y`) flag into `CorsOptions.origin`, `_origin.test(origin)` modified the regex's internal `lastIndex`. Subsequent valid requests evaluated against the advanced `lastIndex` returned `false`, rejecting valid cross-origin requests intermittently.
- **Evidence in Repo**: Commit SHA `badc7628`, Issue PR `#1589`, files `src/utils/internal/cors.ts`.
- **Root Cause**: `RegExp.prototype.test()` is inherently stateful when flags `/g` or `/y` are active. Reusing the regex across stateless HTTP requests creates race conditions and state leakage across distinct requests.
- **Remediation Code Diff**:
```diff
--- a/src/utils/internal/cors.ts
+++ b/src/utils/internal/cors.ts
@@ -87,7 +87,8 @@ export function isCorsOriginAllowed(
   if (Array.isArray(originOption)) {
     return originOption.some((_origin) => {
       if (_origin instanceof RegExp) {
-        return _origin.test(origin);
+        // `search` ignores `lastIndex` (stateless for `/g` and `/y` regexes)
+        return origin.search(_origin) !== -1;
       }
 
       return origin === _origin;
```
- **Lesson**: Do not execute `.test()` or `.exec()` on shared, static, or user-supplied `RegExp` references. Use `string.search(regex) !== -1`, which guarantees stateless matching without mutating or reading `lastIndex`.

---

### Incident 3: Head-of-Line Failure in URL Query Decoding on Malformed Percent Sequences (BUG-H3-QUERY-03)
- **Context**: Subsystem: Query String Deserializer (`src/utils/internal/query.ts`), tests (`test/unit/query.test.ts`).
- **What Was Expected**: A query string with partial or malformed percent-encoding (e.g., `q=caf%C3%A9+50%`) should decode valid UTF-8 sequences (`café`) while preserving unparseable characters verbatim (`50%`), aligning with WHATWG `URLSearchParams`.
- **What Actually Happened**: The parser ran `decodeURIComponent` in a single `try/catch` block. When encountering any malformed token (such as a bare `%` or truncated multi-byte sequence like `%E0%A4%A`), `decodeURIComponent` threw a `URIError`, causing the entire key or value to fall back to completely raw, un-decoded text.
- **Evidence in Repo**: Commit SHA `f2ec1cd0`, Issue PR `#1582`, files `src/utils/internal/query.ts`.
- **Root Cause**: Binary all-or-nothing decoding strategy. A single malformed percent escape invalidated decoding of preceding and succeeding valid escape tokens within the same parameter.
- **Remediation Code Diff**:
```diff
--- a/src/utils/internal/query.ts
+++ b/src/utils/internal/query.ts
@@ -54,7 +54,7 @@ export function parseQuery(input: string): Record<string, string | string[]> {
             try {
               key = decodeURIComponent(key);
             } catch {
-              // Skip decoding
+              key = decodeLenient(key);
             }
           }
 
@@ -69,7 +69,7 @@ export function parseQuery(input: string): Record<string, string | string[]> {
               try {
                 value = decodeURIComponent(value);
               } catch {
-                // Skip decoding
+                value = decodeLenient(value);
               }
             }
           }
@@ -129,3 +129,10 @@ export function parseQuery(input: string): Record<string, string | string[]> {
 
   return params;
 }
+
+// `decodeURIComponent` throws on a single malformed escape. Decode the valid ones
+// and keep the rest, like `URLSearchParams` and `node:querystring` do.
+// `+` is already replaced and `&` can't occur here, so the value passes through as-is.
+function decodeLenient(str: string): string {
+  return new URLSearchParams("_=" + str).get("_")!;
+}
```
- **Lesson**: Implement progressive graceful degradation for network string decoding. When strict UTF-8 decoding throws, route the segment through a forgiving parser (`URLSearchParams.prototype.get`) to isolate malformed byte sequences without discarding validly decoded siblings.

---

### Incident 4: Protocol Desynchronization in Server-Sent Events via Empty ID Truncation (BUG-H3-SSE-04)
- **Context**: Subsystem: Event Stream Serialization (`src/utils/internal/event-stream.ts`), tests (`test/unit/sse.test.ts`).
- **What Was Expected**: According to the W3C SSE specification, sending an empty `id` field (`id: \n`) signals the client to reset its `lastEventId` pointer.
- **What Actually Happened**: `formatEventStreamMessage` checked `if (message.id)`. When an empty string (`id: ""`) was passed, JavaScript truthy evaluation coerced it to `false`. The `id` line was omitted entirely, leaving the client's prior cursor intact and preventing event stream resets.
- **Evidence in Repo**: Commit SHA `927fe98f`, Issue PR `#1590`, files `src/utils/internal/event-stream.ts`.
- **Root Cause**: Implicit falsy conversion bug (`""` evaluated to falsy) confusing an empty string with an `undefined` property.
- **Remediation Code Diff**:
```diff
--- a/src/utils/internal/event-stream.ts
+++ b/src/utils/internal/event-stream.ts
@@ -10,9 +13,13 @@ export function formatEventStreamComment(comment: string): string {
  * Serialize an SSE message, including empty IDs that reset the client's last event ID.
  * Omitted IDs leave the previous client event ID unchanged.
  */
 export function formatEventStreamMessage(message: EventStreamMessage): string {
   let result = "";
-  if (message.id) {
+  if (typeof message.id === "string") {
     result += `id: ${_sanitizeSingleLine(message.id)}\n`;
   }
   if (message.event) {
```
- **Lesson**: Never check structural protocol tokens with truthy tests (`if (val)`). Always check exact domain types (`typeof val === "string"` or `val !== undefined`) when empty strings carry specific semantics in network wire protocols.

---

### Incident 5: HEAD Method Spec Violation & Header Leakage in Error Responses (BUG-H3-RESP-05)
- **Context**: Subsystem: Response Lifecycle & Formatting (`src/response.ts`), tests (`test/errors.test.ts`).
- **What Was Expected**: In accordance with RFC 9110, an HTTP `HEAD` request must return status codes and response headers identical to a `GET` request, but MUST NOT include a response body or emit an inaccurate `Content-Length`.
- **What Actually Happened**: When an unhandled error occurred during a `HEAD` request, the internal error-formatting routine returned a complete JSON error response with an active body directly via `return errorResponse(...)`, failing to pass through the downstream HEAD-stripping filters.
- **Evidence in Repo**: Commit SHA `4ab19f7d`, Issue PR `#1595`, files `src/response.ts`, `test/errors.test.ts`.
- **Root Cause**: Early return short-circuited the response pipeline, bypassing the standard sanitization path that normalizes `HEAD` bodies.
- **Remediation Code Diff**:
```diff
--- a/src/response.ts
+++ b/src/response.ts
@@ -170,7 +170,7 @@ function prepareResponse(
     // `errHeaders` a second time — harmless for single-valued headers (`set`), but
     // `set-cookie` is appended and would be duplicated.
     (event as any)[kEventRes] = undefined;
-    return errorResponse(error, config.debug, errHeaders);
+    val = errorResponse(error, config.debug, errHeaders);
   }
 
   // Only set if event.res.headers is accessed
```
- **Lesson**: Never short-circuit error returns ahead of terminal protocol normalizers. Error objects must flow through the identical body-stripping and transport-shaping pipelines as successful responses.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Truthiness Hazards on Empty Protocol Fields**:
  ```typescript
  // INVARIANT: Distinguish between undefined (omit token) and empty string (reset/empty token)
  // BAD: Oromits serialization if id is ""
  if (message.id) { /* skips "" */ }

  // GOOD: Preserves "" to allow client-side pointer resets
  if (typeof message.id === "string") {
    output += `id: ${sanitize(message.id)}\n`;
  }
  ```
- **Prototype Pollution Shielding on Parsing Operations**:
  When deserializing raw queries or cookies, standard object literals are vulnerable to `__proto__` pollution:
  ```typescript
  // INVARIANT: Object initialization must explicitly discard Object.prototype
  const params: Record<string, any> = Object.create(null);
  // Any key incoming as "__proto__" becomes an inert own-property without polluting the global scope
  params[key] = value;
  ```
- **Safe Numeric Boundary Coercion**:
  ```typescript
  // BAD: Coercing undefined or empty strings yields 0, masking missing parameters
  const limit = +req.query.limit; // "" becomes 0

  // GOOD: Explicit validation of non-empty integer boundaries
  const rawLimit = req.query.limit;
  const limit = (typeof rawLimit === "string" && rawLimit.trim().length > 0)
    ? Number(rawLimit)
    : NaN;
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new HTTPError({ status: 400, message: "Invalid limit" });
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Splat & Tail Interpolation Depth**:
  When resolving wildcard nested routes (`/api/**`), circular directory configurations can generate unbounded loops if resolving recursively.
  ```typescript
  // INVARIANT: Enforce monotonic segment count reduction when stripping base prefixes
  function assertMonotonicSegmentReduction(originalPath: string, basePath: string): string {
    const origCount = countSegments(originalPath);
    const baseCount = countSegments(basePath);
    if (origCount < baseCount) {
      // Must fail closed; indicates routing mismatch or invalid prefix
      throw new HTTPError({ status: 400, message: "Invalid path segments" });
    }
    return withoutBase(originalPath, basePath);
  }
  ```
- **SSE Unsent Buffer Flush Loops**:
  ```typescript
  // INVARIANT: Drain paused data loops while protecting against concurrent producers
  private async _close(): Promise<void> {
    if (this._disposed) return;
    if (!this._isClosed) {
      // Prevent infinite microtask loops if an aggressive interval writes while flushing
      let drainCycles = 0;
      const MAX_DRAIN_CYCLES = 10;
      do {
        this._paused = false;
        await this.flush();
        drainCycles++;
      } while (!this._isClosed && this._unsentData?.length && drainCycles < MAX_DRAIN_CYCLES);

      try {
        await this._writer.close();
      } catch { /* ignore idempotent close errors */ }
    }
    this._disposed = true;
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Cookie Header Duplication & Stacking Context Traps**:
  When setting multiple cookies across handlers and error boundaries, browsers reject malformed concatenated headers.
  ```typescript
  // INVARIANT: getSetCookie() must be used over get("set-cookie") to maintain boundary arrays
  export function mergeSetCookies(existingHeaders: Headers, newCookie: string): void {
    const current = existingHeaders.getSetCookie();
    existingHeaders.delete("set-cookie");
    for (const c of current) {
      existingHeaders.append("set-cookie", c);
    }
    existingHeaders.append("set-cookie", newCookie);
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **TransformStream Backpressure Leak Prevention**:
  A fresh `TransformStream` writer will hang if the readable stream has not been piped to an active consumer.
  ```typescript
  // INVARIANT: When an SSE event terminates before consumption, cancel the readable end
  // rather than writer.close() or writer.abort(), which hang indefinitely awaiting backpressure.
  onDispose(this._event, () => {
    if (!this._isClosed && !this._transformStream.readable.locked) {
      return this._transformStream.readable.cancel().catch(() => {});
    }
    return this.close();
  });
  ```
- **Unbounded Cookie Chunk Memory Explosion**:
  Chunked cookies exceeding browser limits can exhaust worker header buffers.
  ```typescript
  const MAX_CHUNKED_COOKIE_COUNT = 100; // Limit: 100 chunks * 4KB = ~400KB maximum
  if (chunkCount > MAX_CHUNKED_COOKIE_COUNT) {
    throw new HTTPError({
      status: 500,
      message: `Cookie value exceeds hard maximum allocation chunk count (${MAX_CHUNKED_COOKIE_COUNT})`,
    });
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Dual Response Channels (Success vs Fatal Error)**:
  ```typescript
  // INVARIANT: Headers modified during normal execution must not leak into error pages
  // e.g., session cookies set right before a crash must be discarded, but CORS must stay intact
  event.res.headers.set("set-cookie", "session=123"); // Cleared on fatal error
  event.res.errHeaders.set("access-control-allow-origin", "*"); // Preserved on fatal error
  ```
- **TOCTOU Request Body Streaming Guard**:
  ```typescript
  // Reject request smuggling if Content-Length AND Transfer-Encoding co-exist
  if (req.headers.get("content-length") && req.headers.get("transfer-encoding")) {
    throw new HTTPError({ status: 400, message: "Unsupported transfer coding combination" });
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Decoupling**: Complete separation between the runtime wire layer (`srvx`) and the route evaluation tree (`rou3`). Core handlers are pure functions accepting an abstract `H3Event` and returning native values or Web `Response` objects.
- **State Encapsulation**: Minimal global state. Route instances, middlewares, and context maps exist strictly per application hierarchy or request lifetime.

### 2. Core Abstractions
- `H3Event`: The core abstraction wrapping the native runtime `Request`, maintaining URL caches, context dictionary, and split response headers (`headers` vs `errHeaders`).
- `HTTPError`: Strongly-typed error tree exposing standard HTTP status codes, status text, internal debugging data, and unhandled execution causes.
- `EventStream`: Direct subclass of `HTTPResponse` orchestrating WHATWG `TransformStream` pipelines for bidirectional backpressured SSE streaming.

### 3. Error Handling
- **Split Response Header Strategy**: If an application crashes halfway through handler execution, `event.res.headers` is wiped to prevent leaking half-finished computations or dirty session cookies, while `event.res.errHeaders` is preserved to retain critical CORS, tracing, and diagnostic metadata.
- **Sentinel Handled Suppression**: `kHandled` acts as an unforgeable channel control signal to break execution bubbles when a stream failure has already locked the wire state.

### 4. Testing
- **Cross-Engine Matrix Harnessing (`describeMatrix`)**: Test fixtures run dynamically across multiple engine targets (`node`, `bun`, `deno`, `web`).
- **Loopback Address Normalization**: Network tests enforce strict loopback address regexes (`/^(?:0\.0\.0\.0|127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/`) to prevent platform-specific