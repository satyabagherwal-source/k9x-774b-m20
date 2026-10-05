# Forensic Learning Record (Deep Inspection): modelcontextprotocol/csharp-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-csharp-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/csharp-sdk](https://github.com/modelcontextprotocol/csharp-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:49:39.219Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/csharp-sdk`
- **Description**: The official C# SDK for Model Context Protocol servers and clients. Maintained in collaboration with Microsoft.
- **Primary Language / Ecosystem**: C#
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4555 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/inject-version-picker.mjs`
```
// Inject the version-picker widget into every .html page of a built docs site.
//
// Usage:
//   node scripts/inject-version-picker.mjs <siteDir> <slug> [--base /] [--versions <path>]
//
// <siteDir> is a single version's built output (e.g. combined/2.0).
// <slug>    is that version's slug (must match an entry in docs-versions.json).
// The widget config is derived from docs-versions.json and written into each page's
// <head>. The picker assets are referenced relative to each generated page so they
// work from both a custom domain and a project Pages subpath.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { manifestPath } from "./manifest-path.mjs";

const MARKER = "<!--dv-picker-->";

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else positional.push(a);
  }
  return { positional, opts };
}

function normalizeBase(base) {
  let b = (base || "/").trim();
  if (!b.startsWith("/")) b = "/" + b;
  if (!b.endsWith("/")) b += "/";
  return b.replace(/\/{2,}/g, "/");
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.isFile() && /\.html?$/i.test(entry.name)) yield full;
  }
}

async function assetRevision(name) {
  const contents = await readFile(new URL(`../docs/version-picker/${name}`, import.meta.url));
  return createHash("sha256").update(contents).digest("hex").slice(0, 12);
}

async function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  const [siteDir, slug] = positional;
  if (!siteDir || !slug) {
    console.error("usage: inject-version-picker.mjs <siteDir> <slug> [--base /] [--versions <path>]");
    process.exit(2);
  }

  const base = normalizeBase(opts.base);
  const versionsPath = opts.versions
    ? path.resolve(opts.versions)
    : manifestPath;
  const manifest = JSON.parse(await readFile(versionsPath, "utf8"));

  if (!manifest.versions.some((v) => v.slug === slug)) {
    console.error(`error: slug "${slug}" is not present in docs-versions.json`);
    process.exit(1);
  }

  const config = {
    version: slug,
    base,
    default: manifest.default,
    versions: manifest.versions.map((v) => ({
      slug: v.slug,
      label: v.label,
      prerelease: !!v.prerelease,
    })),
  };

  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  const [cssRevision, jsRevision] = await Promise.all([
    assetRevision("version-picker.css"),
    assetRevision("version-picker.js"),
  ]);

  let injected = 0;
  let skipped = 0;
  const assetsDir = path.resolve(siteDir, "..", "assets");
  for await (const file of htmlFiles(siteDir)) {
    const html = await readFile(file, "utf8");
    if (html.includes(MARKER)) {
      skipped++;
      continue;
    }
    const idx = html.search(/<\/head>/i);
    if (idx === -1) {
      skipped++;
      continue;
    }
    const assetBase = path.relative(path.dirname(file), assetsDir).split(path.sep).join("/") + "/";
    const snippet =
      `\n${MARKER}\n` +
      `<script>window.__DOCS__=${json};</script>\n` +
      `<link rel="stylesheet" href="${assetBase}version-picker.css?v=${cssRevision}">\n` +
      `<script type="module" src="${assetBase}version-picker.js?v=${jsRevision}"></script>\n`;
    await writeFile(file, html.slice(0, idx) + snippet + html.slice(idx));
    injected++;
  }

  console.log(`[inject] ${slug}: injected into ${injected} page(s), skipped ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

```

### Core Architecture Module: `scripts/list-versions.mjs`
```
// Print the versions to build, one per line, as "<slug>\t<ref>".
// Consumed by the multi-version docs workflow to drive its build loop.
//
// Usage: node scripts/list-versions.mjs [--versions <path>]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { manifestPath } from "./manifest-path.mjs";

const arg = process.argv.slice(2);
const i = arg.indexOf("--versions");
const versionsPath = i !== -1 ? path.resolve(arg[i + 1]) : manifestPath;

const manifest = JSON.parse(await readFile(versionsPath, "utf8"));
for (const v of manifest.versions) {
  process.stdout.write(`${v.slug}\t${v.ref}\n`);
}

```

### Core Architecture Module: `scripts/manifest-path.mjs`
```
// Location of the docs-versions manifest.
//
// This manifest is a build-time artifact produced during docs publishing, which
// only ever runs in CI -- never on a developer's machine. It therefore lives in
// the runner's temporary directory (RUNNER_TEMP on GitHub Actions, falling back
// to the OS temp dir for local testing) so it never touches the repository tree
// and needs no .gitignore entry. Every script agrees on this path, so the
// workflow does not need to thread it between steps.

import os from "node:os";
import path from "node:path";

export const manifestPath = path.join(
  process.env.RUNNER_TEMP || os.tmpdir(),
  "docs-versions.json"
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1800** (2026-08-14): **mcp.protocol.version activity tag not emitted on server spans in stateless HTTP mode**
  *Symptoms*: # mcp.protocol.version activity tag not emitted on server spans in stateless HTTP mode  ## Description  `McpSessionHandler.AddTags` tags the request `Activity` with `mcp.protocol.version` from `NegotiatedProtocolVersion`:  ```csharp if (NegotiatedProtocolVersion is not null) {     tags.Add("mcp.protocol.version", NegotiatedProtocolVersion); } ```  `NegotiatedProtocolVersion` is a session-level property, set once during the `initialize` handshake (or from `McpServer.NegotiatedProtocolVersion` after negotiation completes). In **stateless HTTP mode** (`HttpServerTransportOptions.Stateless = true`, the default) and especially under the `2026-07-28` protocol revision (no `initialize` handshake, no session), each HTTP request gets its own short-lived `McpServer`/session, and per-request protocol negotiation happens via the `MCP-Protocol-Version` header / `_meta.io.modelcontextprotocol/protocolVersion` field rather than a one-time handshake.  In practice this means `NegotiatedProtocolVersion` is `null` (or not populated in time) when `AddTags` runs for a given request, so the SDK's own `mcp.protocol.version` tag never materializes on the span — even though the request does carry a negotiated version via the header/`_meta` field.  ## Impact  Consumers building custom telemetry filters/enrichers around MCP spans (e.g. `IEndpointFilter`, `ConfigureSessionOptions`, or a `tools/call` request filter) can't rely on the SDK to tag `mcp.protocol.version` in stateless mode and end up re-deriv
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. @luisangelrod has opened #1810 to address this. @NikiforovAll, could you please review the PR as well?

- **Issue #1799** (2026-09-04): **server/discover fallback fails when 400 body isn't JSON-RPC shaped (non-JSON-RPC error envelope)**
  *Symptoms*: ## Description  Related to #1765 and #1790, but a distinct third case neither covers: a `server/discover` probe response that is HTTP 400 **with a JSON body that isn't JSON-RPC shaped at all** (no `jsonrpc`/`id` fields, a string error `code` rather than an integer, extra fields like `param`/`type`/`details`) causes the connection to fail hard instead of falling back to `initialize`, even though the HTTP status (400) is exactly the status #1765's fix already handles for non-JSON-RPC (plain-text) bodies.  **Server response observed** (Azure AI Foundry's Toolbox MCP proxy, rejecting an unrecognized `server/discover` method - the server does not yet implement SEP-2575):  ```http HTTP/1.1 400 Bad Request Content-Type: application/json; charset=utf-8  {   "error": {     "code": "invalid_payload",     "message": "Failed to deserialize request body: Unknown ToolsetMCPMethodName value. (Parameter 'value')\nActual value was server/discover. [Request ID: ...]",     "param": "$",     "type": "invalid_request_error",     "details": [],     "additionalInfo": { "request_id": "..." }   } } ```  Note there is no `jsonrpc` field, no top-level `id`, and `error.code` is a string, not an integer JSON-RPC error code. This is a generic API-gateway/model-binding-failure envelope (the same shape OpenAI-compatible APIs commonly return for a validation error), not an MCP JSON-RPC error object.  Compare to #1765's repro, where the rejecting server returned a **plain-text** body ("Invalid session ID") on
  **Post-Mortem & Fix Analysis**:
  > open video
  > Thanks for the detailed report and analysis. We've triaged this as a high-impact compatibility issue and will review it alongside #1790 as we evaluate the server/discover fallback handling.
  > This no longer reproduces on current `main`. I tested the response shape from this issue, an HTTP 400 `application/json` body with a non-JSON-RPC error envelope and string error code. Both Streamable HTTP and AutoDetect correctly fell back to `initialize`.  This path is handled by #1766. #1791 covers the adjacent structured JSON-RPC classification case. Closing as fixed.

- **Issue #1790** (2026-09-03): **Fix structured HTTP error classification during server/discover fallback**
  *Symptoms*: ## Description  Two related gaps remain in the HTTP backward-compatibility handling for the `server/discover` probe.  ### 1. Structured HTTP 400 with `-32600` can skip `initialize` fallback  A session-enforcing pre-SEP-2575 server can respond to the initial `server/discover` request with:  ```http HTTP/1.1 400 Bad Request Content-Type: application/json  {   "jsonrpc": "2.0",   "id": 1,   "error": {     "code": -32600,     "message": "Unknown or missing Mcp-Session-Id. Send initialize first."   } } ```  `StreamableHttpClientSessionTransport` correctly converts the structured HTTP 400 response to `McpProtocolException`. However, `McpClientImpl.ConnectAsync` has a special catch for `InvalidRequest` errors whose message contains `Mcp-Session-Id`. That catch describes the error as locally generated and rethrows it, even though client-side protocol exceptions currently originate from remote JSON-RPC responses. The remote error therefore never reaches the generic `McpProtocolException` branch that falls back to `initialize`.  The 2026-07-28 Streamable HTTP compatibility rules identify only `-32020` (`HeaderMismatch`), `-32021` (`MissingRequiredClientCapability`), and `-32022` (`UnsupportedProtocolVersion`) as recognized modern MCP errors. A structured `-32600` response is not a recognized modern error and should fall back to `initialize`, regardless of message text.  The special message-based catch appears stale: there are no local client-side `McpProtocolException` throw sites on c
  **Post-Mortem & Fix Analysis**:
  > Thanks @muthu-rathinam for finding and reporting this issue.

- **Issue #1783** (2026-09-13): **SDK 2.0 rejects ChatGPT requests containing 2026-07-28 metadata with protocol 2025-11-25**
  *Symptoms*: Hi,  I'm testing a new MCP server with "ChatGPT plugins" and it appears that the 2.0 version of the SDK is strict about request validation and breaks compatibility with ChatGPT.  At the moment, ChatGPT negotiates MCP protocol version `2025-11-25` but sends per-request metadata following `2026-07-28`.  The SDK rejects this with:  ``` {   "type": "json_rpc_error",   "code": -32600,   "message": "The reserved per-request metadata key '_meta/io.modelcontextprotocol/clientCapabilities' is not valid with protocol version '2025-11-25'.",   "is_error": true } ```  <img width="836" height="872" alt="Image" src="https://github.com/user-attachments/assets/39a47c22-02f1-4bb9-abf7-3b9b0992d968" />  Ideally this should be fixed by OpenAI but it's obviously impossible for me to reach them, while I can report the issue here.
  **Post-Mortem & Fix Analysis**:
  > Same issue here.   <img width="884" height="371" alt="Image" src="https://github.com/user-attachments/assets/b1fe31a0-d532-4d06-bb86-4ff891d5a5d4" />  Edit: I was able to do a workaround by making a Middleware with Fable, by showing the issue I had. No version rollback needed after that.
  > i have the same issue  ```clientCapabilities metadata is invalid for protocol version 2025-11-25```
  > lets put some comments here https://x.com/OpenAIDevs/status/2085398373511918022 maybe opai will check it

- **Issue #1774** (2026-09-13): **server/discover advertises deprecated `logging` unconditionally, but logging/setLevel rejects 2026-07-28+ with MethodNotFound**
  *Symptoms*: ### Summary  `server/discover` advertises the deprecated `logging` capability unconditionally, while the `logging/setLevel` handler rejects `2026-07-28`+ requests with `MethodNotFound`. Since `server/discover` only exists on `2026-07-28`+, the server advertises a capability whose only method it refuses to serve on the very era doing the asking.  There is also no way for a server author to opt out.  ### Detail  `McpServerImpl.ConfigureLogging` is called unconditionally from the constructor and does:  ```csharp ServerCapabilities.Logging = new(); ```  with no guard — not on `Handlers.SetLoggingLevelHandler` being non-null, not on protocol version, not on any option.  The same method's handler then rejects the modern era:  ```csharp if (IsJuly2026OrLaterProtocolRequest(jsonRpcRequest)) {     throw new McpProtocolException(         $"The method '{RequestMethods.LoggingSetLevel}' is not available on protocol version '...'. Use per-request _meta/{MetaKeys.LogLevel} instead.",         McpErrorCode.MethodNotFound); } ```  So a `2026-07-28` client reading `capabilities.logging` from `server/discover` and calling `logging/setLevel` gets `MethodNotFound`.  ### Why a server author cannot work around it  `McpServerOptions.Capabilities` is not the source of the advertised set. `McpServerImpl` builds its own `ServerCapabilities = new()` and reads only two members from options (`Experimental`, `Extensions`); everything else is derived from registrations. Measured against 2.0.0 on a stateless

- **Issue #1772** (2026-09-09): **SEP-2575 HTTP status mapping is timing-sensitive under load**
  *Symptoms*: ### Description  `RawHttpConformanceTests.July2026Post_MissingRequiredCapability_Returns400` intermittently receives HTTP 200 instead of HTTP 400.  The server correctly produces a `MissingRequiredClientCapabilityException` and sends the corresponding JSON-RPC error. However, the HTTP status can already be committed as 200 before that error reaches the response callback.  ### Evidence  The failure occurred in:  - https://github.com/modelcontextprotocol/csharp-sdk/actions/runs/30440416457/job/90538136230 - Expected status: `BadRequest` - Actual status: `OK`  The test log shows:  1. `requires_sampling` threw `MissingRequiredClientCapabilityException`. 2. The handler took approximately 219 ms. 3. Kestrel completed the request with HTTP 200. 4. The process did not crash; `--blame-crash` only attached its standard collector.  The same test previously failed with the same 200-versus-400 result on an earlier workflow attempt and then passed when rerun:  - Failed attempt: https://github.com/modelcontextprotocol/csharp-sdk/actions/runs/30432932916/job/90514051740 - Successful retry: https://github.com/modelcontextprotocol/csharp-sdk/actions/runs/30432932916/job/90523495608  The failure has occurred under different configurations and target frameworks, while the other frameworks in the same jobs passed.  ### Root cause  `StreamableHttpPostTransport` defers committing response headers for a fixed 250 ms window:  ```csharp internal static readonly TimeSpan DeferredHeaderFlushGrace =     T
  **Post-Mortem & Fix Analysis**:
  > Taking this based on the direction confirmed on #1795: for 2026-07-28 requests, wait for the first JSON-RPC message so SEP-2575 status mapping is deterministic; keep eager header flush for older protocol revisions. I will keep the change scoped to the transport behavior and add the slow-handler conformance regression discussed there.

- **Issue #1765** (2026-07-31): **Client fails to connect when a server rejects the server/discover probe with HTTP 404**
  *Symptoms*: **Describe the bug**  Under the 2026-07-28 revision (SEP-2575) a client with `ProtocolVersion` unset probes `server/discover` and is documented to fall back to the `initialize` handshake automatically for servers that don't support it. That fallback is keyed on `McpProtocolException` (plus the probe timeout), so it only fires when the server answers with a JSON-RPC error.  A Streamable HTTP server that requires `Mcp-Session-Id` on every non-initialize POST rejects the session-less `server/discover` probe at the HTTP layer instead. That surfaces as `HttpRequestException` from `EnsureSuccessStatusCodeWithResponseBodyAsync`, which no catch in `McpClientImpl.ConnectAsync` handles, so it escapes and the connection fails outright — the fallback never runs.  `StreamableHttpClientSessionTransport` surfaces non-400 statuses as `HttpRequestException` deliberately ("404 session-not-found ... continue to surface as HttpRequestException to preserve back-compat with transport-layer behaviors"), so the gap is at the connect layer, not the transport.  Datadog's hosted MCP server (`https://mcp.datadoghq.com/api/unstable/mcp-server/mcp`) is a public example: it answers the probe with `404 "Invalid session ID"`.  **To Reproduce**  Steps to reproduce the behavior:  1. Connect to a Streamable HTTP server that requires a session on every non-initialize POST, with `ProtocolVersion` left unset: ```csharp var transport = new HttpClientTransport(new HttpClientTransportOptions {     Endpoint = new Uri(
  **Post-Mortem & Fix Analysis**:
  > While fixing this I hit two adjacent problems worth separating out:  **1. `AutoDetect` has an independent channel-lifetime bug.** With `TransportMode.AutoDetect` (the default), a 404 on the probe disposes the provisional Streamable transport and tries SSE; when the SSE GET fails, `SseClientSessionTransport.SetDisconnected` completes the *shared* message channel. Any subsequent `initialize` is answered by the server but its response can never be read, so the connect stalls until `InitializationTimeout`. Measured locally: `ClientTransportClosedException` after ~6s with the initialize confirmed received, versus an immediate, clear 404 without any fallback. This is why #1766 gates its fallback to the explicit Streamable HTTP transport — falling back under AutoDetect would be strictly worse than today's behavior. The real fix is for provisional SSE failure to leave the shared channel open, the way `StreamableHttpClientSessionTransport` already does.  **2. Plain HTTP 400 is unhandled too.** 
  > We are planning on shipping the fix in the next 2.x release, but in the meantime, as a workaround you can pin the protocol version on the client: `ProtocolVersion = "2025-11-25"`.

- **Issue #1721** (2026-07-27): **bug(2.0.0-preview.3): `resultType`, `ttlMs`, and `cacheScope` emitted on all responses regardless of negotiated protocol version (breaks 2025-11-25 clients)**
  *Symptoms*: **Describe the bug**  When a client negotiates `"protocolVersion": "2025-11-25"` via the `initialize` handshake, the server (v2.0.0-preview.3) still includes `resultType`, `ttlMs`, and `cacheScope` in every JSON-RPC result object. These fields are exclusive to the 2026-07-28 draft spec and must be absent from responses on a 2025-11-25 session. Clients that strictly validate against the 2025-11-25 schema — such as MCP Inspector 1.0.0 — treat them as unrecognized keys and fail the handshake.  **To Reproduce**  1. Start a C# MCP server built with v2.0.0-preview.3 (stateless or stateful). 2. Send an `initialize` request with `"protocolVersion": "2025-11-25"`. 3. Observe that the `InitializeResult` contains `"resultType": "complete"` despite the server echoing back `"protocolVersion": "2025-11-25"`. 4. Send a `tools/list` request. 5. Observe that the result contains `"resultType": "complete"`, `"ttlMs": 0`, and `"cacheScope": "private"`. 6. Point MCP Inspector 1.0.0 at the server — it rejects the handshake on these unrecognized fields.  **Expected behavior**  For sessions where the negotiated protocol version is `2025-11-25`, `resultType`, `ttlMs`, and `cacheScope` must be absent from all result objects. The serializer already uses `WhenWritingNull` — if these properties are left `null` they are correctly omitted. The server should only stamp them when the negotiated (or per-request) version is 2026-07-28 or later.  **Logs**  `InitializeResult` wire shape (negotiated version `2025
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to take this. I confirmed the unconditional result decoration is still present on current `main`.  My proposed scope is to gate the SDK-provided `resultType`, `ttlMs`, and `cacheScope` defaults on the effective request protocol version, including normal, alternate, and task-augmented handlers, while preserving explicit handler values. I would also gate the initialize result and add wire-level regression coverage proving 2025-11-25 omits these fields and 2026-07-28 retains them.  Could a maintainer assign me to the issue? I will keep the change inside the existing server result-decoration path and avoid public API changes.  
  > @jstar0 I overlooked that you had offered to take this on. I've assigned both you and @tarekgh from the team. This should be fixed on Monday since it's a blocker for the 2.0.0 release (to be released either late Monday or Tuesday).  @p-ob thanks so much for finding and reporting this with the great detail!

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `c40ee044` (2026-09-19)
**Commit Message**: fix(client): skip the SSE fallback when the server/discover probe is rejected with 400/404 (#1855)

**File**: `src/ModelContextProtocol.Core/Client/AutoDetectingClientSessionTransport.cs` (modified, +32/-2)
```diff
@@ -99,15 +99,33 @@ private async Task InitializeAsync(JsonRpcMessage message, CancellationToken can
                 // behavior. Capture the underlying error (status + body) before falling back so that,
                 // if SSE also fails, we can surface the real Streamable HTTP diagnostic to the caller
                 // instead of dropping it on the floor (see https://github.com/modelcontextprotocol/csharp-sdk/issues/1526).
-                LogStreamableHttpFailed(_name, response.StatusCode);
-
                 // This reads the response body a second time for the application/json case, where
                 // TryReadJsonRpcErrorAsync above already read it. HttpContent buffers after the first
                 // read, so this returns the same buffered content and is safe (not a second stream
                 // consumption). For the common non-JSON error responses (415, 405, plain text)
                 // TryReadJsonRpcErrorAsync returns early on the content type, so there is no double read.
                 var streamableHttpError = await HttpResponseMessageExtensions.CreateHttpRequestExceptionWithBodyAsync(response, cancellationToken).ConfigureAwait(false);
 
+                if (IsDiscoverProbeRejection(message, response.StatusCode))
+                {
+                    // The server/discover probe is protocol negotiation, not transport detection. A server
+                    // predating SEP-2575 rejects the session-less POST with 400 (can't parse the request) or
+                    // 404 (requires Mcp-Session-Id on every non-initialize POST) whether it speaks Streamable
+                    // HTTP or SSE, so neither status is evidence about which transport to use. McpClientImpl
+                    // .ConnectAsync treats exactly these two statuses as "initialize-handshake server" and
+                    // immediately retries with initialize on this same transport — and that attempt still
+                    // falls back to SSE, so an SSE-only server is reached one POST later rather than not at
+                    // all. Attempting SSE here instead spends a GET whose result is discarded on every
+                    // connect to a Streamable-HTTP-only server that predates SEP-2575, and logs a "falling
+                    // back to SSE transport" line that misreports settled protocol negotiation as a failure.
+                    LogSkippingSseFallbackForDiscoverProbe(_name, response.StatusCode);
+
+                    await streamableHttpTransport.DisposeAsync().ConfigureAwait(false);
+                    throw streamableHttpError;
+                }
+
+                LogStreamableHttpFailed(_name, response.StatusCode);
+
                 await streamableHttpTransport.DisposeAsync().ConfigureAwait(false);
                 await InitializeSseTransportAsync(message, streamableHttpError, cancellationToken).ConfigureAwait(false);
             }
@@ -122,6 +140,15 @@ private async Task InitializeAsync(JsonRpcMessage message, CancellationToken can
         }
     }
 
+    /// <summary>
+    /// Returns <see langword="true"/> when the failed request was the SEP-2575 <c>server/discover</c> probe and the
+    /// status is one of the two <see cref="McpClientImpl"/> already reads as "this server requires the initialize
+    /// handshake", meaning the SSE fallback cannot contribute anything the initialize retry won't.
+    /// </summary>
+    private static bool IsDiscoverProbeRejection(JsonRpcMessage message, HttpStatusCode statusCode) =>
+        statusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound &&
+        message is JsonRpcRequest { Method: RequestMethods.ServerDiscover };
+
     private async Task InitializeSseTransportAsync(JsonRpcMessage message, HttpRequestException? streamableHttpError, CancellationToken cancellationToken)
     {
         if (_options.KnownSessionId is not null)
@@ -184,6 +211,9 @@ public async ValueTask DisposeAsync()
     [LoggerMessage(Level = LogLevel.Informat
```

**File**: `tests/ModelContextProtocol.Tests/Transport/HttpClientTransportAutoDetectTests.cs` (modified, +151/-0)
```diff
@@ -505,4 +505,155 @@ await Assert.ThrowsAnyAsync<Exception>(() =>
             MockLoggerProvider.LogMessages,
             m => m.LogLevel == LogLevel.Warning && m.Message.Contains("SSE fallback failed"));
     }
+
+    // A 400/404 on the SEP-2575 server/discover probe is protocol negotiation, not transport detection:
+    // a pre-SEP-2575 server rejects the session-less POST whether it speaks Streamable HTTP or SSE, and
+    // McpClientImpl.ConnectAsync reads exactly those two statuses as "initialize-handshake server" and
+    // retries with initialize. The SSE GET can therefore only waste a round trip here.
+    [Theory]
+    [InlineData(HttpStatusCode.NotFound)]
+    [InlineData(HttpStatusCode.BadRequest)]
+    public async Task AutoDetectMode_SkipsSseFallback_WhenDiscoverProbeIsRejected(HttpStatusCode statusCode)
+    {
+        var options = new HttpClientTransportOptions
+        {
+            Endpoint = new Uri("http://localhost"),
+            TransportMode = HttpTransportMode.AutoDetect,
+            Name = "AutoDetect discover probe test client"
+        };
+
+        using var mockHttpHandler = new MockHttpHandler();
+        using var httpClient = new HttpClient(mockHttpHandler);
+        await using var transport = new HttpClientTransport(options, httpClient, LoggerFactory);
+        var getCount = 0;
+
+        mockHttpHandler.RequestHandler = request =>
+        {
+            if (request.Method == HttpMethod.Get)
+            {
+                getCount++;
+                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.MethodNotAllowed));
+            }
+
+            return Task.FromResult(new HttpResponseMessage(statusCode)
+            {
+                Content = new StringContent("Not Found"),
+            });
+        };
+
+        await using var session = await transport.ConnectAsync(TestContext.Current.CancellationToken);
+
+        var ex = await Assert.ThrowsAsync<HttpRequestException>(() =>
+            session.SendMessageAsync(
+                new JsonRpcRequest { Method = RequestMethods.ServerDiscover, Id = new RequestId(1) },
+                TestContext.Current.CancellationToken));
+
+        Assert.Equal(0, getCount);
+        Assert.Equal(statusCode, ex.Data["ModelContextProtocol.HttpStatusCode"]);
+        Assert.DoesNotContain(
+            MockLoggerProvider.LogMessages,
+            m => m.Message.Contains("falling back to SSE transport"));
+    }
+
+    // Skipping the SSE attempt on the discover probe must not strand an SSE-only server: the initialize
+    // retry that McpClientImpl.ConnectAsync issues next goes through this same transport and still falls
+    // back to SSE, so such a server is reached one POST later rather than not at all.
+    [Fact]
+    public async Task AutoDetectMode_StillFallsBackToSse_WhenInitializeFollowsRejectedDiscoverProbe()
+    {
+        var options = new HttpClientTransportOptions
+        {
+            Endpoint = new Uri("http://localhost"),
+            TransportMode = HttpTransportMode.AutoDetect,
+            Name = "AutoDetect discover probe then initialize test client"
+        };
+
+        using var mockHttpHandler = new MockHttpHandler();
+        using var httpClient = new HttpClient(mockHttpHandler);
+        await using var transport = new HttpClientTransport(options, httpClient, LoggerFactory);
+        var ssePipe = new Pipe();
+        var sseEndpointPostCount = 0;
+
+        await ssePipe.Writer.WriteAsync(
+            System.Text.Encoding.UTF8.GetBytes("event: endpoint\r\ndata: /sse-endpoint\r\n\r\n"),
+            TestContext.Current.CancellationToken);
+        await ssePipe.Writer.FlushAsync(TestContext.Current.CancellationToken);
+
+        mockHttpHandler.RequestHandler = request =>
+        {
+            if (request.Method == HttpMethod.Get)
+            {
+                var content = new StreamContent(ssePipe.Reader.AsStream());
+                content.Headers.ContentType = new("text/event-stream");
+
```

---

### Incident Patch 2: `cb3e6e87` (2026-09-09)
**Commit Message**: fix(aspnetcore): make SEP-2575 status mapping deterministic (#1837)

**File**: `src/ModelContextProtocol.Core/Server/StreamableHttpPostTransport.cs` (modified, +13/-73)
```diff
@@ -76,9 +76,6 @@ public async ValueTask<bool> HandlePostAsync(JsonRpcMessage message, Cancellatio
             return false;
         }
 
-        CancellationTokenSource? deferredFlushCts = null;
-        Task? deferredFlushTask = null;
-        bool deferHeaderFlush = false;
         using (await _messageLock.LockAsync(cancellationToken).ConfigureAwait(false))
         {
             var primingItem = await TryStartSseEventStreamAsync(_pendingRequest).ConfigureAwait(false);
@@ -87,88 +84,33 @@ public async ValueTask<bool> HandlePostAsync(JsonRpcMessage message, Cancellatio
                 await NotifyResponseStartingAsync(firstMessage: null).ConfigureAwait(false);
                 await _httpSseWriter.WriteAsync(primingItem.Value, cancellationToken).ConfigureAwait(false);
             }
-            else if (onResponseStarting is null)
+            else if (onResponseStarting is not null &&
+                McpProtocolVersions.RequiresPerRequestMetadata(message.Context.ProtocolVersion))
             {
-                // If there's no priming write, flush the stream to ensure HTTP response headers are
-                // sent to the client now that the server is ready to process the request.
-                // This prevents HttpClient timeout for long-running requests.
-                await responseStream.FlushAsync(cancellationToken).ConfigureAwait(false);
+                // Per-request-metadata protocol revisions map the first JSON-RPC error onto the HTTP
+                // status line. Keep the headers uncommitted until that message arrives so the mapping
+                // cannot depend on how long dispatch takes.
             }
             else
             {
-                deferHeaderFlush = true;
+                // Earlier protocol revisions keep the eager header flush for long-running handlers.
+                // Mark the response as started before flushing because any later JSON-RPC error must
+                // not attempt to change an already committed status line.
+                await NotifyResponseStartingAsync(firstMessage: null).ConfigureAwait(false);
+                await responseStream.FlushAsync(cancellationToken).ConfigureAwait(false);
             }
 
             // Ensure that we've sent the priming event before processing the incoming request.
             await parentTransport.MessageWriter.WriteAsync(message, cancellationToken).ConfigureAwait(false);
         }
 
-        if (deferHeaderFlush)
-        {
-            // Defer the flush (and the header commit it implies) so the callback can still choose
-            // the HTTP status line for an immediate JSON-RPC error. Start the bounded grace period
-            // only after the request has been queued for dispatch.
-            deferredFlushCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
-            deferredFlushTask = DeferredHeaderFlushAsync(deferredFlushCts.Token);
-        }
-
-        try
-        {
-            // Wait for the response to be written before returning from the handler.
-            // This keeps the HTTP response open until the final response message is sent.
-            await _httpResponseTcs.Task.WaitAsync(cancellationToken).ConfigureAwait(false);
-        }
-        finally
-        {
-            if (deferredFlushCts is not null)
-            {
-                deferredFlushCts.Cancel();
-                await deferredFlushTask!.ConfigureAwait(false);
-                deferredFlushCts.Dispose();
-            }
-        }
+        // Wait for the response to be written before returning from the handler.
+        // This keeps the HTTP response open until the final response message is sent.
+        await _httpResponseTcs.Task.WaitAsync(cancellationToken).ConfigureAwait(false);
 
         return true;
     }
 
-    /// <summary>
-    /// Bounds the deferred header flush: after a short grace window, flushes the response headers
-    /// if no response message has been written yet. 
```

**File**: `src/ModelContextProtocol.Core/Server/StreamableHttpServerTransport.cs` (modified, +7/-7)
```diff
@@ -216,14 +216,14 @@ public Task<bool> HandlePostRequestAsync(JsonRpcMessage message, Stream response
     /// This overload additionally reports the first JSON-RPC message written to the response via
     /// <paramref name="onResponseStarting"/>, before any response bytes are written, so the HTTP
     /// application can still choose the response status line (SEP-2575 maps some JSON-RPC error
-    /// codes to HTTP statuses). When <paramref name="onResponseStarting"/> is provided, the eager
-    /// response-header flush that normally precedes request processing is deferred until that first
-    /// message; the callback receives <see langword="null"/> when the first write is not a JSON-RPC
-    /// message (e.g. a resumability priming event).
+    /// codes to HTTP statuses). When <paramref name="onResponseStarting"/> is provided for a
+    /// per-request-metadata protocol revision, the eager response-header flush that normally precedes
+    /// request processing is deferred until that first message; the callback receives
+    /// <see langword="null"/> when the first write is not a JSON-RPC message (e.g. a resumability
+    /// priming event).
     /// The status line can only be influenced by the FIRST write: when a handler streams a
-    /// notification (e.g. progress) before failing, or runs past the transport's bounded
-    /// header-flush grace window, the status is already committed and a later JSON-RPC error
-    /// rides the committed status.
+    /// notification (e.g. progress) before failing, the status is already committed and a later
+    /// JSON-RPC error rides the committed status.
     /// </summary>
     /// <param name="message">The JSON-RPC message to process.</param>
     /// <param name="responseStream">The response stream to write any JSON-RPC responses to.</param>
```

**File**: `tests/ModelContextProtocol.AspNetCore.Tests/MapMcpTests.cs` (modified, +8/-5)
```diff
@@ -239,10 +239,9 @@ public async Task Server_ShutsDownQuickly_WhenClientIsConnected()
     [Fact]
     public async Task LongRunningToolCall_DoesNotTimeout_WhenNoEventStreamStore()
     {
-        // Regression test for: Tool calls that last over HttpClient timeout without producing
-        // intermediate notifications will timeout because HttpClient doesn't see the 200 response
-        // until the first message is written. When primingItem is null (no ISseEventStreamStore),
-        // we should flush the response stream so HttpClient sees the 200 immediately.
+        // Legacy Streamable HTTP tool calls that run past the HttpClient timeout without producing
+        // intermediate notifications need an eager response flush. Per-request-metadata protocol
+        // revisions instead wait for the first JSON-RPC message so SEP-2575 can map its status.
 
         Builder.Services.AddMcpServer().WithHttpTransport(ConfigureStateless).WithTools<LongRunningTools>();
 
@@ -274,7 +273,11 @@ public async Task LongRunningToolCall_DoesNotTimeout_WhenNoEventStreamStore()
                     TransportMode = transportMode,
                 }, shortTimeoutClient, LoggerFactory);
 
-                await using var mcpClient = await McpClient.CreateAsync(transport, loggerFactory: LoggerFactory, cancellationToken: TestContext.Current.CancellationToken);
+                await using var mcpClient = await McpClient.CreateAsync(
+                    transport,
+                    new McpClientOptions { ProtocolVersion = "2025-11-25" },
+                    LoggerFactory,
+                    TestContext.Current.CancellationToken);
 
                 // Call a tool that takes 2 seconds - this should succeed despite the 1 second HttpClient timeout
                 // because the response stream is flushed immediately after receiving the request
```

**File**: `tests/ModelContextProtocol.AspNetCore.Tests/RawHttpConformanceTests.cs` (modified, +32/-0)
```diff
@@ -207,6 +207,27 @@ public async Task July2026Post_MissingRequiredCapability_Returns400()
         Assert.Equal((int)McpErrorCode.MissingRequiredClientCapability, json["error"]!["code"]!.GetValue<int>());
     }
 
+    [Fact]
+    public async Task July2026Post_SlowHandler_MissingRequiredCapability_Returns400()
+    {
+        await StartAsync();
+
+        var body =
+            @"{""jsonrpc"":""2.0"",""id"":20,""method"":""tools/call"",""params"":{""name"":""slow_requires_sampling"",""arguments"":{}," +
+            July2026ProtocolMetaFragment() + "}}";
+
+        using var request = new HttpRequestMessage(HttpMethod.Post, "") { Content = JsonContent(body) };
+        request.Headers.Add(ProtocolVersionHeader, McpProtocolVersions.July2026ProtocolVersion);
+        request.Headers.Add("Mcp-Method", "tools/call");
+        request.Headers.Add("Mcp-Name", "slow_requires_sampling");
+        using var response = await HttpClient.SendAsync(request, TestContext.Current.CancellationToken);
+
+        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
+        var json = await ReadJsonResponseAsync(response, TestContext.Current.CancellationToken);
+        Assert.Equal(20, json["id"]!.GetValue<long>());
+        Assert.Equal((int)McpErrorCode.MissingRequiredClientCapability, json["error"]!["code"]!.GetValue<int>());
+    }
+
     [Fact]
     public async Task ServerDiscover_WithConfiguredPerRequestMetadataProtocol_ReturnsOnlyConfiguredVersion()
     {
@@ -500,10 +521,21 @@ public async Task July2026Post_MalformedClientCapabilities_Returns400_WithInvali
     [McpServerToolType]
     private sealed class CapabilityTools
     {
+        private static readonly TimeSpan SlowHandlerDelay = TimeSpan.FromSeconds(1);
+
         [McpServerTool(Name = "requires_sampling")]
         public static string RequiresSampling() =>
             throw new MissingRequiredClientCapabilityException(
                 new ClientCapabilities { Sampling = new() },
                 "sampling capability required but not declared by client");
+
+        [McpServerTool(Name = "slow_requires_sampling")]
+        public static async Task<string> SlowRequiresSampling(CancellationToken cancellationToken)
+        {
+            await Task.Delay(SlowHandlerDelay, cancellationToken);
+            throw new MissingRequiredClientCapabilityException(
+                new ClientCapabilities { Sampling = new() },
+                "sampling capability required but not declared by client");
+        }
     }
 }
```

---

### Incident Patch 3: `df11d7da` (2026-09-03)
**Commit Message**: Fix HTTP fallback error handling (#1791)

**File**: `src/ModelContextProtocol.Core/Client/AutoDetectingClientSessionTransport.cs` (modified, +11/-8)
```diff
@@ -77,16 +77,19 @@ private async Task InitializeAsync(JsonRpcMessage message, CancellationToken can
             else if (await StreamableHttpClientSessionTransport.TryReadJsonRpcErrorAsync(response, cancellationToken).ConfigureAwait(false) is { } parsedError)
             {
                 // A JSON-RPC error envelope in the body means the peer IS a Streamable HTTP server.
-                // It just rejected our specific request (e.g., -32022 UnsupportedProtocolVersion,
-                // -32021 MissingRequiredClientCapability, -32020 HeaderMismatch, or any other
-                // application-level error). Don't fall back to SSE — that would mask the real signal
-                // and surface a misleading "session id required" error from the SSE GET path.
-                // Adopt the Streamable HTTP transport and throw the structured exception so the
-                // connect-time fallback logic can react per spec PR #2844. Setting ActiveTransport
-                // first makes the catch filter below leave the now-owned transport alone.
+                // Adopt it before surfacing the failure so the catch filter leaves the now-owned
+                // transport alone, and never mask the response by attempting deprecated SSE.
                 LogUsingStreamableHttp(_name);
                 ActiveTransport = streamableHttpTransport;
-                throw McpSessionHandler.CreateRemoteProtocolExceptionFromError(parsedError);
+
+                if (StreamableHttpClientSessionTransport.ShouldSurfaceJsonRpcErrorAsProtocolException(response.StatusCode, parsedError))
+                {
+                    throw McpSessionHandler.CreateRemoteProtocolExceptionFromError(parsedError);
+                }
+
+                // TryReadJsonRpcErrorAsync buffered the content, so this preserves the same response
+                // body and status without consuming the network stream a second time.
+                throw await HttpResponseMessageExtensions.CreateHttpRequestExceptionWithBodyAsync(response, cancellationToken).ConfigureAwait(false);
             }
             else
             {
```

**File**: `src/ModelContextProtocol.Core/Client/McpClientImpl.cs` (modified, +0/-8)
```diff
@@ -367,14 +367,6 @@ public async Task ConnectAsync(CancellationToken cancellationToken = default)
                         // fallback): falling back to initialize wouldn't fix a malformed envelope.
                         throw;
                     }
-                    catch (McpProtocolException ex) when (
-                        ex.ErrorCode == McpErrorCode.InvalidRequest &&
-                        ex.Message.Contains(McpHttpHeaders.SessionId, StringComparison.Ordinal))
-                    {
-                        // Local transport validation: a 2026-07-28+ response must not carry HTTP session state.
-                        // This is not evidence of an initialize-handshake server, so do not fall back.
-                        throw;
-                    }
                     catch (McpProtocolException)
                     {
                         // Per spec PR #2844, the fallback MUST NOT be keyed to a single error code.
```

**File**: `src/ModelContextProtocol.Core/Client/StreamableHttpClientSessionTransport.cs` (modified, +6/-6)
```diff
@@ -80,19 +80,19 @@ public override async Task SendMessageAsync(JsonRpcMessage message, Cancellation
         // for robustness. Servers occasionally emit them with 4xx codes other than 400.
         if (!response.IsSuccessStatusCode &&
             await TryReadJsonRpcErrorAsync(response, cancellationToken).ConfigureAwait(false) is { } parsedError &&
-            (response.StatusCode == HttpStatusCode.BadRequest ||
-             IsPerRequestMetadataProtocolErrorCode((McpErrorCode)parsedError.Error.Code)))
+            ShouldSurfaceJsonRpcErrorAsProtocolException(response.StatusCode, parsedError))
         {
             throw McpSessionHandler.CreateRemoteProtocolExceptionFromError(parsedError);
         }
 
         await response.EnsureSuccessStatusCodeWithResponseBodyAsync(cancellationToken).ConfigureAwait(false);
     }
 
-    private static bool IsPerRequestMetadataProtocolErrorCode(McpErrorCode code) =>
-        code is McpErrorCode.UnsupportedProtocolVersion
-             or McpErrorCode.MissingRequiredClientCapability
-             or McpErrorCode.HeaderMismatch;
+    internal static bool ShouldSurfaceJsonRpcErrorAsProtocolException(HttpStatusCode statusCode, JsonRpcError error) =>
+        statusCode == HttpStatusCode.BadRequest ||
+        (McpErrorCode)error.Error.Code is McpErrorCode.UnsupportedProtocolVersion
+                                          or McpErrorCode.MissingRequiredClientCapability
+                                          or McpErrorCode.HeaderMismatch;
 
     /// <summary>
     /// Reads a JSON-RPC error envelope from an <c>application/json</c> response body, returning
```

**File**: `tests/ModelContextProtocol.AspNetCore.Tests/July2026ProtocolHttpFallbackTests.cs` (modified, +66/-2)
```diff
@@ -57,15 +57,22 @@ public async ValueTask DisposeAsync()
         base.Dispose();
     }
 
-    private async Task StartServerAsync(RequestDelegate handler)
+    private async Task StartServerAsync(RequestDelegate handler, bool acceptGet = false)
     {
         Builder.Services.Configure<JsonOptions>(options =>
         {
             options.SerializerOptions.TypeInfoResolverChain.Add(McpJsonUtilities.DefaultOptions.TypeInfoResolver!);
         });
 
         _app = Builder.Build();
-        _app.MapPost("/mcp", handler);
+        if (acceptGet)
+        {
+            _app.MapMethods("/mcp", [HttpMethods.Get, HttpMethods.Post], handler);
+        }
+        else
+        {
+            _app.MapPost("/mcp", handler);
+        }
         await _app.StartAsync(TestContext.Current.CancellationToken);
     }
 
@@ -302,6 +309,63 @@ await WriteJsonRpcErrorAsync(context, HttpStatusCode.BadRequest,
         Assert.False(initializeReceived);
     }
 
+    [Theory]
+    [InlineData(HttpStatusCode.Unauthorized)]
+    [InlineData(HttpStatusCode.Forbidden)]
+    [InlineData(HttpStatusCode.InternalServerError)]
+    public async Task AutoDetect_OnNonModernJsonRpcErrorOutside400_PreservesHttpFailure_NoFallback(HttpStatusCode statusCode)
+    {
+        var ct = TestContext.Current.CancellationToken;
+        var initializeRequests = 0;
+        var sseGetRequests = 0;
+
+        await StartServerAsync(async context =>
+        {
+            if (HttpMethods.IsGet(context.Request.Method))
+            {
+                sseGetRequests++;
+                context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
+                return;
+            }
+
+            var message = await JsonSerializer.DeserializeAsync(
+                context.Request.Body,
+                GetJsonTypeInfo<JsonRpcMessage>(),
+                ct);
+
+            if (message is JsonRpcRequest { Method: RequestMethods.Initialize })
+            {
+                initializeRequests++;
+            }
+
+            await WriteJsonRpcErrorAsync(
+                context,
+                statusCode,
+                code: (int)McpErrorCode.InvalidRequest,
+                message: "non-modern structured error");
+        }, acceptGet: true);
+
+        await using var transport = new HttpClientTransport(new()
+        {
+            Endpoint = new("http://localhost:5000/mcp"),
+            TransportMode = HttpTransportMode.AutoDetect,
+        }, HttpClient, LoggerFactory);
+
+        var exception = await Assert.ThrowsAsync<HttpRequestException>(async () =>
+        {
+            await using var client = await McpClient.CreateAsync(
+                transport,
+                new McpClientOptions(),
+                loggerFactory: LoggerFactory,
+                cancellationToken: ct);
+        });
+
+        Assert.Equal(statusCode, exception.StatusCode);
+        Assert.Contains("non-modern structured error", exception.Message);
+        Assert.Equal(0, initializeRequests);
+        Assert.Equal(0, sseGetRequests);
+    }
+
     [Fact]
     public async Task Client_OnPerRequestMetadataResponseWithMcpSessionId_IgnoresSessionState()
     {
```

**File**: `tests/ModelContextProtocol.Tests/Client/July2026ProtocolFallbackTests.cs` (modified, +63/-0)
```diff
@@ -239,6 +239,28 @@ public async Task Client_OnFallbackHttpStatusFromProbe_FallsBackTo_Initialize(
         Assert.Equal(McpProtocolVersions.November2025ProtocolVersion, client.NegotiatedProtocolVersion);
     }
 
+    [Theory]
+    [InlineData(HttpTransportMode.StreamableHttp)]
+    [InlineData(HttpTransportMode.AutoDetect)]
+    public async Task Client_OnStructuredInvalidRequestFromHttpProbe_FallsBackTo_Initialize(
+        HttpTransportMode transportMode)
+    {
+        var ct = TestContext.Current.CancellationToken;
+        var initializeReceived = false;
+
+        using var mockHttpHandler = new MockHttpHandler();
+        using var httpClient = new HttpClient(mockHttpHandler);
+        mockHttpHandler.RequestHandler = CreateStructuredInvalidRequestProbeServer(
+            () => initializeReceived = true);
+
+        await using var transport = CreateTransport(httpClient, transportMode);
+        await using var client = await McpClient.CreateAsync(transport, new McpClientOptions(),
+            loggerFactory: LoggerFactory, cancellationToken: ct);
+
+        Assert.True(initializeReceived);
+        Assert.Equal(McpProtocolVersions.November2025ProtocolVersion, client.NegotiatedProtocolVersion);
+    }
+
     [Theory]
     [InlineData(HttpStatusCode.InternalServerError, HttpTransportMode.StreamableHttp)]
     [InlineData(HttpStatusCode.Forbidden, HttpTransportMode.StreamableHttp)]
@@ -317,6 +339,47 @@ private static Func<HttpRequestMessage, Task<HttpResponseMessage>> CreateProbeRe
             }
         };
 
+    private static Func<HttpRequestMessage, Task<HttpResponseMessage>> CreateStructuredInvalidRequestProbeServer(
+        Action onInitialize)
+        => async request =>
+        {
+            if (request.Method == HttpMethod.Get)
+                return EmptyResponse(HttpStatusCode.MethodNotAllowed);
+
+            var body = await request.Content!.ReadAsStringAsync();
+            using var doc = JsonDocument.Parse(body);
+            if (!doc.RootElement.TryGetProperty("method", out var methodElement))
+                return EmptyResponse(HttpStatusCode.Accepted);
+
+            if (methodElement.GetString() == RequestMethods.ServerDiscover)
+            {
+                var id = doc.RootElement.GetProperty("id").GetRawText();
+                var error = "{\"jsonrpc\":\"2.0\",\"id\":" + id
+                    + ",\"error\":{\"code\":-32600,\"message\":\"Mcp-Session-Id header is required\"}}";
+                return new HttpResponseMessage(HttpStatusCode.BadRequest)
+                {
+                    Content = new StringContent(error, Encoding.UTF8, "application/json"),
+                };
+            }
+
+            if (methodElement.GetString() == RequestMethods.Initialize)
+            {
+                onInitialize();
+                var id = doc.RootElement.GetProperty("id").GetRawText();
+                var result = "{\"jsonrpc\":\"2.0\",\"id\":" + id
+                    + ",\"result\":{\"protocolVersion\":\"" + McpProtocolVersions.November2025ProtocolVersion
+                    + "\",\"capabilities\":{},\"serverInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}";
+                var response = new HttpResponseMessage(HttpStatusCode.OK)
+                {
+                    Content = new StringContent(result, Encoding.UTF8, "application/json"),
+                };
+                response.Headers.Add("mcp-session-id", "test-session");
+                return response;
+            }
+
+            return EmptyResponse(HttpStatusCode.Accepted);
+        };
+
     private static HttpResponseMessage EmptyResponse(HttpStatusCode status)
         => new(status) { Content = new StringContent(string.Empty) };
 
```

---

### Incident Patch 4: `8754e19f` (2026-08-14)
**Commit Message**: Fix protocol version tag for stateless server spans (#1810)

Co-authored-by: Luis Rodriguez <25299418+luisangelrod@users.noreply.github.com>
Co-authored-by: Tarek Mahmoud Sayed <tarekms@ntdev.microsoft.com>

**File**: `src/ModelContextProtocol.Core/McpSessionHandler.cs` (modified, +3/-2)
```diff
@@ -962,9 +962,10 @@ private void AddTags(ref TagList tags, Activity? activity, JsonRpcMessage messag
             tags.Add("network.protocol.name", "http");
         }
 
-        if (NegotiatedProtocolVersion is not null)
+        string? protocolVersion = (message as JsonRpcRequest)?.Context?.ProtocolVersion ?? NegotiatedProtocolVersion;
+        if (protocolVersion is not null)
         {
-            tags.Add("mcp.protocol.version", NegotiatedProtocolVersion);
+            tags.Add("mcp.protocol.version", protocolVersion);
         }
 
         if (activity is { IsAllDataRequested: true })
```

**File**: `tests/ModelContextProtocol.AspNetCore.Tests/MapMcpStatelessTests.cs` (modified, +53/-0)
```diff
@@ -2,6 +2,8 @@
 using Microsoft.Extensions.DependencyInjection;
 using ModelContextProtocol.Protocol;
 using ModelContextProtocol.Server;
+using OpenTelemetry.Trace;
+using System.Diagnostics;
 
 namespace ModelContextProtocol.AspNetCore.Tests;
 
@@ -10,6 +12,57 @@ public class MapMcpStatelessTests(ITestOutputHelper outputHelper) : MapMcpStream
     protected override bool UseStreamableHttp => true;
     protected override bool Stateless => true;
 
+    // In stateless mode each HTTP request is served by a fresh, un-negotiated McpServer, so the
+    // session-level NegotiatedProtocolVersion is null when the server span is tagged. The tag must
+    // therefore come from the per-request MCP-Protocol-Version header / _meta value. Exercising more
+    // than one version proves the tag tracks the per-request value rather than coincidentally matching
+    // a single hard-coded version (and would regress to an absent tag if the per-request fallback were
+    // removed, since the negotiated value is null at tagging time).
+    [Theory]
+    [InlineData("2025-11-25")]
+    [InlineData("2026-07-28")]
+    public async Task ServerActivity_TagsPerRequestProtocolVersion_InStatelessMode(string protocolVersion)
+    {
+        var activities = new List<Activity>();
+        string? capturedNegotiatedProtocolVersion = null;
+
+        var protocolVersionTool = McpServerTool.Create(
+            (RequestContext<CallToolRequestParams> context) =>
+            {
+                capturedNegotiatedProtocolVersion = context.Server.NegotiatedProtocolVersion;
+                return "ok";
+            },
+            new() { Name = "stateless-capture-version" });
+
+        using (var tracerProvider = OpenTelemetry.Sdk.CreateTracerProviderBuilder()
+            .AddSource("Experimental.ModelContextProtocol")
+            .AddInMemoryExporter(activities)
+            .Build())
+        {
+            Builder.Services.AddMcpServer()
+                .WithHttpTransport(ConfigureStateless)
+                .WithTools([protocolVersionTool]);
+
+            await using var app = Builder.Build();
+            app.MapMcp();
+            await app.StartAsync(TestContext.Current.CancellationToken);
+
+            await using var client = await ConnectAsync(configureClient: options =>
+                options.ProtocolVersion = protocolVersion);
+
+            await client.CallToolAsync("stateless-capture-version", cancellationToken: TestContext.Current.CancellationToken);
+        }
+
+        Assert.Contains(activities, activity =>
+            activity.DisplayName == "tools/call stateless-capture-version" &&
+            activity.Kind == ActivityKind.Server &&
+            activity.GetTagItem("mcp.protocol.version") as string == protocolVersion);
+
+        // Once the per-request version is applied, the request-scoped server settles on that same version,
+        // so the value tagged on the span and the version the session ends up negotiating agree.
+        Assert.Equal(protocolVersion, capturedNegotiatedProtocolVersion);
+    }
+
     [Fact]
     public async Task EnablePollingAsync_ThrowsInvalidOperationException_InStatelessMode()
     {
```

**File**: `tests/ModelContextProtocol.AspNetCore.Tests/MapMcpStreamableHttpTests.cs` (modified, +56/-0)
```diff
@@ -6,7 +6,9 @@
 using ModelContextProtocol.Protocol;
 using ModelContextProtocol.Server;
 using ModelContextProtocol.Tests.Utils;
+using OpenTelemetry.Trace;
 using System.Collections.Concurrent;
+using System.Diagnostics;
 using System.Net;
 using System.Security.Claims;
 using System.Threading;
@@ -46,6 +48,60 @@ public async Task CanConnect_WithMcpClient_AfterCustomizingRoute(string routePat
         Assert.Equal("TestCustomRouteServer", mcpClient.ServerInfo.Name);
     }
 
+    // 2025-11-25 is negotiated through the initialize handshake, so in the (default) stateful configuration
+    // the session-level NegotiatedProtocolVersion is populated and the client sends a matching
+    // MCP-Protocol-Version header on every follow-up request. This asserts the span carries the negotiated
+    // version and that the tagged value agrees with the session's NegotiatedProtocolVersion.
+    //
+    // A scenario where the per-request and negotiated versions differ is intentionally not asserted here:
+    // a single MCP session must not change protocol versions, so the server rejects a follow-up request
+    // whose header/_meta version differs from the negotiated one, and a conformant client never sends a
+    // differing header. Reaching that divergence would require a hand-crafted request on an invalid
+    // (failing) code path and would pin the current ordering of tagging relative to version-change
+    // validation. Instead the two inputs to the tag are covered independently: the per-request path in
+    // stateless mode (MapMcpStatelessTests, where NegotiatedProtocolVersion is null at tagging time) and the
+    // negotiated-only fallback over a header-less transport (DiagnosticTests).
+    [Fact]
+    public async Task ServerActivity_TagsNegotiatedProtocolVersion()
+    {
+        var activities = new List<Activity>();
+        string? capturedNegotiatedProtocolVersion = null;
+
+        var protocolVersionTool = McpServerTool.Create(
+            (RequestContext<CallToolRequestParams> context) =>
+            {
+                capturedNegotiatedProtocolVersion = context.Server.NegotiatedProtocolVersion;
+                return "ok";
+            },
+            new() { Name = "negotiated-capture-version" });
+
+        using (var tracerProvider = OpenTelemetry.Sdk.CreateTracerProviderBuilder()
+            .AddSource("Experimental.ModelContextProtocol")
+            .AddInMemoryExporter(activities)
+            .Build())
+        {
+            Builder.Services.AddMcpServer()
+                .WithHttpTransport(ConfigureStateless)
+                .WithTools([protocolVersionTool]);
+
+            await using var app = Builder.Build();
+            app.MapMcp();
+            await app.StartAsync(TestContext.Current.CancellationToken);
+
+            await using var client = await ConnectAsync(configureClient: options =>
+                options.ProtocolVersion = "2025-11-25");
+
+            await client.CallToolAsync("negotiated-capture-version", cancellationToken: TestContext.Current.CancellationToken);
+        }
+
+        Assert.Contains(activities, activity =>
+            activity.DisplayName == "tools/call negotiated-capture-version" &&
+            activity.Kind == ActivityKind.Server &&
+            activity.GetTagItem("mcp.protocol.version") as string == "2025-11-25");
+
+        Assert.Equal("2025-11-25", capturedNegotiatedProtocolVersion);
+    }
+
     [Fact]
     public async Task StreamableHttpMode_Works_WithRootEndpoint()
     {
```

---

### Incident Patch 5: `bba45c44` (2026-08-13)
**Commit Message**: Fix McpHeaderEncoder.DecodeValue throwing on the degenerate base64 wrapper (#1805)

**File**: `src/ModelContextProtocol.Core/Protocol/McpHeaderEncoder.cs` (modified, +2/-1)
```diff
@@ -126,7 +126,8 @@ public static class McpHeaderEncoder
 
         // Check for Base64 wrapper. The spec requires the sentinel markers to be
         // case-sensitive and exactly lowercase per SEP-2243.
-        if (headerValue.StartsWith(Base64Prefix, StringComparison.Ordinal) &&
+        if (headerValue.Length >= Base64Prefix.Length + Base64Suffix.Length &&
+            headerValue.StartsWith(Base64Prefix, StringComparison.Ordinal) &&
             headerValue.EndsWith(Base64Suffix, StringComparison.Ordinal))
         {
             var base64Content = headerValue.Substring(
```

**File**: `tests/ModelContextProtocol.Tests/Client/McpHeaderEncoderTests.cs` (modified, +10/-0)
```diff
@@ -104,6 +104,16 @@ public void DecodeValue_ValidBase64_Decodes()
         Assert.Equal("Hello", result);
     }
 
+    [Fact]
+    public void DecodeValue_DegenerateWrapper_ReturnsLiteralValue()
+    {
+        // "=?base64?=" matches both the prefix "=?base64?" and the suffix "?=" because they
+        // overlap on the shared '?', but it is too short to contain any base64 content. It must be
+        // returned as-is rather than throwing when the wrapper is stripped.
+        var result = McpHeaderEncoder.DecodeValue("=?base64?=");
+        Assert.Equal("=?base64?=", result);
+    }
+
     [Fact]
     public void DecodeValue_CaseSensitivePrefix_ReturnsLiteralValue()
     {
```

---

### Incident Patch 6: `2912e94f` (2026-08-13)
**Commit Message**: Fix duplicated word in test comment (#1809)

**File**: `tests/ModelContextProtocol.AspNetCore.Tests/Utils/KestrelInMemoryConnection.cs` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ public override Task FlushAsync(CancellationToken cancellationToken)
 
         protected override void Dispose(bool disposing)
         {
-            // Signal to the server the the client has closed the connection, and dispose the client-half of the Pipes.
+            // Signal to the server the client has closed the connection, and dispose the client-half of the Pipes.
             ThreadPool.UnsafeQueueUserWorkItem(static cts => ((CancellationTokenSource)cts!).Cancel(), connectionClosedCts);
             duplexPipe.Input.Complete();
             duplexPipe.Output.Complete();
```

---

### Incident Patch 7: `149c5c47` (2026-08-13)
**Commit Message**: Fix dead relative link to versioning docs in bump-version skill (#1807)

**File**: `.github/skills/bump-version/references/semver-assessment.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ While the candidate version uses a prerelease suffix (e.g., `X.Y.Z-preview.N`, `
 
 Going to GA drops the suffix entirely: `2.0.0-rc.2` → `2.0.0`.
 
-This is purely about how to *compute* the next version. It does **not** declare any new policy about what kinds of changes are permitted between previews — refer to the existing [versioning documentation](../../../../docs/versioning.html) for breaking-change policy.
+This is purely about how to *compute* the next version. It does **not** declare any new policy about what kinds of changes are permitted between previews — refer to the existing [versioning documentation](../../../../docs/versioning.md) for breaking-change policy.
 
 ### Branch context
 
```

---

### Incident Patch 8: `87f5b09b` (2026-08-04)
**Commit Message**: Add README for the InMemoryTransport sample (#1769)

Co-authored-by: Akbar Dızajı <akbar@skedda.com>
Co-authored-by: Claude Fable 5 <noreply@anthropic.com>

**File**: `samples/InMemoryTransport/README.md` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+# In-Memory Transport Sample
+
+Demonstrates connecting an MCP client and server in the same process using stream-based
+transports over in-memory pipes (`System.IO.Pipelines`) — no child process, no network.
+
+The server is created directly with `McpServer.Create`, without a host or dependency
+injection container, and exposes a single `Echo` tool defined from a delegate with
+`McpServerTool.Create`. The client connects over the same pipe pair with
+`StreamClientTransport`, lists the server's tools, and invokes the tool.
+
+This pattern is useful for testing MCP servers, embedding a server inside a larger
+application, or running a client and server in the same process without transport overhead.
+See [Transports: In-memory transport](../../docs/concepts/transports/transports.md) for more
+background.
+
+## Run
+
+```bash
+dotnet run --project samples/InMemoryTransport/InMemoryTransport.csproj
+```
+
+Expected output:
+
+```
+Tool Name: Echo
+
+Echo: Hello World
+```
+
+## Key files
+
+- [`Program.cs`](Program.cs) — the entire sample: pipe setup, server creation, client
+  connection, tool listing, and tool invocation.
+
+## Notes
+
+- `StreamServerTransport` and `StreamClientTransport` work with any `Stream`. This sample
+  wires them to a pair of `Pipe` instances, one per direction; the client's output stream is
+  the server's input stream and vice versa.
+- The server is started with a fire-and-forget `server.RunAsync()` because both endpoints
+  live in the same process. `await using` on the server and client ensures both are disposed
+  when the program exits.
```

---

### Incident Patch 9: `ec216b52` (2026-07-26)
**Commit Message**: Fix: swallow _receiveTask exceptions in SseClientSessionTransport.CloseAsync (#1432)

Co-authored-by: Xue Cai <xuecai@microsoft.com>
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Co-authored-by: Jeff Handley <jeffhandley@users.noreply.github.com>

**File**: `src/ModelContextProtocol.Core/Client/SseClientSessionTransport.cs` (modified, +1/-2)
```diff
@@ -66,7 +66,7 @@ public async Task ConnectAsync(CancellationToken cancellationToken = default)
         {
             LogTransportConnectFailed(Name, ex);
             await CloseAsync().ConfigureAwait(false);
-            throw new IOException("Failed to connect transport.", ex);
+            throw;
         }
     }
 
@@ -198,7 +198,6 @@ private async Task ReceiveMessagesAsync(CancellationToken cancellationToken)
 
                 LogTransportReadMessagesFailed(Name, ex);
                 _connectionEstablished.TrySetException(ex);
-                throw;
             }
         }
         finally
```

**File**: `tests/ModelContextProtocol.Tests/Transport/HttpClientTransportAutoDetectTests.cs` (modified, +54/-0)
```diff
@@ -49,6 +49,60 @@ public async Task AutoDetectMode_UsesStreamableHttp_WhenServerSupportsIt()
         Assert.NotNull(session);
     }
 
+    [Fact]
+    public async Task AutoDetectMode_WhenBothTransportsFail_PreservesStreamableHttpException()
+    {
+        // Regression test: when Streamable HTTP POST fails (e.g. 403) and the SSE GET
+        // fallback also fails (e.g. 405), the original Streamable HTTP error should
+        // be preserved. The SSE connection failure is available as its inner exception.
+        var options = new HttpClientTransportOptions
+        {
+            Endpoint = new Uri("http://localhost"),
+            TransportMode = HttpTransportMode.AutoDetect,
+            Name = "AutoDetect test client"
+        };
+
+        using var mockHttpHandler = new MockHttpHandler();
+        using var httpClient = new HttpClient(mockHttpHandler);
+        await using var transport = new HttpClientTransport(options, httpClient, LoggerFactory);
+
+        mockHttpHandler.RequestHandler = (request) =>
+        {
+            if (request.Method == HttpMethod.Post)
+            {
+                // Streamable HTTP POST fails with 403 (auth error)
+                return Task.FromResult(new HttpResponseMessage
+                {
+                    StatusCode = HttpStatusCode.Forbidden,
+                    Content = new StringContent("Forbidden")
+                });
+            }
+
+            if (request.Method == HttpMethod.Get)
+            {
+                // SSE GET fallback fails with 405
+                return Task.FromResult(new HttpResponseMessage
+                {
+                    StatusCode = HttpStatusCode.MethodNotAllowed,
+                    Content = new StringContent("Method Not Allowed")
+                });
+            }
+
+            throw new InvalidOperationException($"Unexpected request: {request.Method}");
+        };
+
+        // ConnectAsync for AutoDetect mode just creates the transport without sending
+        // any HTTP request. The auto-detection is triggered lazily by the first
+        // SendMessageAsync call, which happens inside McpClient.CreateAsync when it
+        // sends the JSON-RPC "initialize" message.
+        var ex = await Assert.ThrowsAsync<HttpRequestException>(
+            () => McpClient.CreateAsync(transport, cancellationToken: TestContext.Current.CancellationToken));
+
+        Assert.Contains("403", ex.Message);
+        Assert.IsType<HttpRequestException>(ex.InnerException);
+        Assert.Contains("405", ex.InnerException.Message);
+    }
+
     [Fact]
     public async Task AutoDetectMode_FallsBackToSse_WhenStreamableHttpFails()
     {
```

---

### Incident Patch 10: `f7c61faf` (2026-07-24)
**Commit Message**: Extend server/discover probe timeout in in-memory tests to fix flaky Windows Debug CI hang (#1701) (#1702)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Co-authored-by: Stephen Halter <halter73@gmail.com>

**File**: `tests/ModelContextProtocol.Tests/ClientServerTestBase.cs` (modified, +6/-0)
```diff
@@ -86,6 +86,12 @@ public async ValueTask DisposeAsync()
 
     protected async Task<McpClient> CreateMcpClientForServer(McpClientOptions? clientOptions = null)
     {
+        clientOptions ??= new McpClientOptions();
+
+        // Disable the server/discover probe timeout to avoid CI slowness spuriously tripping it (issue #1701).
+        // Tests that need a specific probe timeout should create their own client instead of using this helper.
+        clientOptions.DiscoverProbeTimeout = TestConstants.DefaultTimeout;
+
         return await McpClient.CreateAsync(
             new StreamClientTransport(
                 serverInput: _clientToServerPipe.Writer.AsStream(),
```

#### Recent Merged Pull Requests:
- **PR #1886** (closed): Bump the opentelemetry-testing group with 6 updates (@dependabot[bot])
- **PR #1884** (closed): fix(aspnetcore): return 400 InvalidParams for invalid initialize params instead of 500 (@Digvijay)
- **PR #1873** (2026-09-12): Update SourceLink to resolve vulnerable Git build dependency (@halter73)
- **PR #1857** (closed): Register List<object> JSON metadata for Native AOT array tool arguments (@kondv)
- **PR #1855** (2026-09-19): fix(client): skip the SSE fallback when the server/discover probe is rejected with 400/404 (@scottt732)
- **PR #1852** (2026-09-13): Relax legacy request metadata validation (@halter73)
- **PR #1837** (2026-09-09): fix(aspnetcore): make SEP-2575 status mapping deterministic (@jstar0)
- **PR #1831** (closed): Keep interactive OAuth flows alive when the triggering request is canceled (@PederHP)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
