# Forensic Learning Record (Deep Inspection): 21st-dev/magic-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/21st-dev-magic-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/21st-dev/magic-mcp](https://github.com/21st-dev/magic-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:01:25.428Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `21st-dev/magic-mcp`
- **Description**: It's like v0, but in your Cursor / Claude Code / Windsurf: search 10,000+ React/Tailwind components, generate new UI with AI, and publish your own — right from your editor. Magic MCP is now the 21st MCP; this package keeps old configs working. Setup: 21st.dev/mcp
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 5951 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/index.ts`
```
#!/usr/bin/env node

// Magic MCP is now the 21st MCP.
//
// This package used to be a standalone stdio MCP server talking to
// magic.21st.dev. Since 0.2.0 it is a thin stdio<->HTTP proxy to the unified
// 21st MCP endpoint (https://21st.dev/api/mcp), kept alive because the old
// install command (`npx -y @21st-dev/magic@latest API_KEY="..."`) is baked
// into countless agent configs and model memories. New setups should use:
//
//   npx @21st-dev/cli@latest init --client <cursor|claude|vscode|windsurf|codex>
//
// The server keeps the legacy Magic tool names callable
// (21st_magic_component_builder, 21st_magic_component_inspiration,
// 21st_magic_component_refiner, logo_search), so old agent muscle memory
// still works through this proxy.

import { createInterface } from "node:readline";

const VERSION = "0.2.3";
const DEFAULT_ENDPOINT = "https://21st.dev/api/mcp";

// ---------------------------------------------------------------------------
// API key resolution - every format the old Magic client ever accepted, plus
// the new CLI's API_KEY_21ST. Positional `API_KEY="x"` is the form models
// memorized from the old README.
// ---------------------------------------------------------------------------
function resolveApiKey(): string | undefined {
  const patterns = [
    /^([A-Z_0-9]+)=(.+)$/, // API_KEY=value
    /^--([A-Z_0-9]+)=(.+)$/, // --API_KEY=value
    /^\/([A-Z_0-9]+):(.+)$/, // /API_KEY:value (Windows style)
    /^-([A-Z_0-9]+)=(.+)$/, // -API_KEY=value
  ];
  const argv = process.argv.slice(2);
  const fromArgs: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let matched = false;
    for (const re of patterns) {
      const m = arg.match(re);
      if (m) {
        fromArgs[m[1]] = stripQuotes(m[2]);
        matched = true;
        break;
      }
    }
    // `-API_KEY value` (separate argv entries)
    if (!matched && /^-[A-Z_0-9]+$/.test(arg) && argv[i + 1]) {
      fromArgs[arg.slice(1)] = stripQuotes(argv[++i]);
    }
  }
  return (
    fromArgs.API_KEY ??
    fromArgs.TWENTY_FIRST_API_KEY ??
    fromArgs.API_KEY_21ST ??
    process.env.TWENTY_FIRST_API_KEY ??
    process.env.API_KEY_21ST ??
    process.env.API_KEY
  );
}

function stripQuotes(v: string): string {
  const t = v.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

const apiKey = resolveApiKey();
const endpoint = process.env.MCP_URL_21ST || DEFAULT_ENDPOINT;

// stderr only - stdout is the JSON-RPC channel.
console.error(
  `Magic MCP is now the 21st MCP - proxying to ${endpoint} (shim v${VERSION}).`,
);
if (!apiKey) {
  console.error(
    "No API key found. Old Magic keys were reset - get a fresh key at https://21st.dev/mcp " +
      'and pass it as API_KEY="..." (or env TWENTY_FIRST_API_KEY / API_KEY_21ST).',
  );
}

// ---------------------------------------------------------------------------
// stdio <-> HTTP proxy. One POST per inbound JSON-RPC message; the endpoint
// answers plain JSON (or empty for notifications). Mcp-Session-Id from the
// initialize response is echoed on subsequent requests so capability
// negotiation (e.g. inline UI) keeps working through the proxy.
// ---------------------------------------------------------------------------
let sessionId: string | undefined;

type JsonRpcMsg = { id?: unknown; method?: unknown };

function writeOut(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

// The endpoint's own wording, so an agent reads the same sentence whether the
// refusal came from here or from the server.
const NOT_AUTHED =
  "Not authenticated - your API key is missing or was reset. Get a fresh key at https://21st.dev/mcp and update your MCP config (x-api-key / Bearer).";

// Latched once the endpoint answers 401. A key cannot become valid inside one
// process: this proxy reads it at startup from argv/env and never re-reads it.
// Without the latch the host client re-runs `initialize` after every failure
// and the proxy dutifully forwards it forever - the endpoint saw ~100k of those
// an hour after 0.2.0 shipped, from clients that could never succeed.
let authRefused = false;

async function forward(line: string): Promise<void> {
  let msg: JsonRpcMsg | JsonRpcMsg[];
  try {
    msg = JSON.parse(line);
  } catch {
    writeOut(rpcError(null, -32700, "Parse error"));
    return;
  }

  const single = !Array.isArray(msg) ? msg : undefined;
  const expectsReply = Array.isArray(msg)
    ? msg.some((m) => m && m.id !== undefined && m.id !== null)
    : single!.id !== undefined && single!.id !== null;

  // Answer locally when the outcome is already known: no key was found at all,
  // or the endpoint has already refused this one. Both are settled for the life
  // of the process, so sending the request would only cost both sides a round
  // trip to reach the same sentence.
  if (!apiKey || authRefused) {
    if (expectsReply) writeOut(rpcError(single?.id ?? null, -32001, NOT_AUTHED));
    return;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "user-agent": `21st-magic-shim/${VERSION}`,
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  if (sessionId) headers["mcp-session-id"] = sessionId;

  let res: Response;
  let text: string;
  try {
    res = await fetch(endpoint, { method: "POST", headers, body: line });
    text = await res.text();
  } catch (e) {
    if (expectsReply) {
      const detail = e instanceof Error ? e.message : String(e);
      writeOut(
        rpcError(
          single?.id ?? null,
          -32000,
          `21st MCP endpoint unreachable (${endpoint}): ${detail}`,
        ),
      );
    }
    return;
  }

  if (res.status === 401) authRefused = true;

  const newSession = res.headers.get("mcp-session-id");
  if (newSession) sessionId = newSession;

  if (!expectsReply) return; // notification - nothing to write back
  if (!text.trim()) {
    writeOut(
      rpcError(single?.id ?? null, -32000, `Empty response (HTTP ${res.status})`),
    );
    return;
  }

  try {
    const parsed = JSON.parse(text);
    // Auth failures come back with id:null; restore the request id so strict
    // clients can correlate (and agents get to read the "key was reset" text).
    if (
      single &&
      parsed &&
      !Array.isArray(parsed) &&
      parsed.id == null &&
      single.id != null
    ) {
      parsed.id = single.id;
    }
    writeOut(parsed);
  } catch {
    writeOut(
      rpcError(
        single?.id ?? null,
        -32000,
        `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`,
      ),
    );
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
// Sequential pump: strict request ordering, one in-flight request at a time.
// MCP clients pipeline rarely enough that this is not a bottleneck, and it
// guarantees the initialize -> session-id handshake lands before anything else.
let queue: Promise<void> = Promise.resolve();
rl.on("line", (line) => {
  if (!line.trim()) return;
  queue = queue.then(() => forward(line));
});
rl.on("close", () => {
  void queue.then(() => process.exit(0));
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #79** (2026-08-31): **Add Codex plugin manifest**
  *Symptoms*: Adds `.codex-plugin/plugin.json` so the repo also works as an OpenAI Codex/ChatGPT plugin (same skills/, same `.mcp.json`, interface metadata for their directory). Prep for the OpenAI plugin submission portal. <!-- devin-review-badge-begin -->  ---  <a href="https://app.devin.ai/review/21st-dev/magic-mcp/pull/79" target="_blank">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-devin-review-dark.svg?v=3">     <img src="https://static.devin.ai/assets/gh-devin-review-light.svg?v=3" alt="Devin Review">   </picture> </a> <!-- devin-review-badge-end -->

- **Issue #78** (2026-08-31): **Package the 21st MCP as an agent plugin (Cursor / Claude / Grok)**
  *Symptoms*: Adds plugin manifests so this repo can be listed on the Cursor Marketplace (which also powers Grok Bot's in-app plugin catalog) and xAI's Grok Build marketplace.  - `.cursor-plugin/plugin.json` + `mcp.json` — Cursor plugin: HTTP MCP at `https://21st.dev/api/mcp`, API key supplied via the `API_KEY_21ST` dashboard variable - `.claude-plugin/plugin.json` + `.mcp.json` — Claude-format manifest, accepted by Grok Build's marketplace as-is - `skills/21st-ui/SKILL.md` — teaches agents the search → get_component → install flow, generate, and search_logo - `assets/logo.png` — current 21st mark, 512×512 on solid background - `LICENSE` — ISC, matching the existing `package.json` license field - README section on plugin installs  No changes to the proxy code. <!-- devin-review-badge-begin -->  ---  <a href="https://app.devin.ai/review/21st-dev/magic-mcp/pull/78" target="_blank">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-devin-review-dark.svg?v=3">     <img src="https://static.devin.ai/assets/gh-devin-review-light.svg?v=3" alt="Devin Review">   </picture> </a> <!-- devin-review-badge-end -->

- **Issue #75** (2026-07-24): **21st_magic_component_builder times out (MCP error -32001), related to #73, #68, #55**
  *Symptoms*: Summary: 21st_magic_component_builder consistently times out over MCP with "MCP error -32001: Request timed out" after roughly 60 seconds. This may share a root cause with the malformed-content bug already reported in #73 for component_inspiration, and with the "[object Object]" responses reported in #68 and #55 for component_builder, since all of these tools share the same MCP response layer. Filing separately since the symptom here is a hard timeout rather than a schema or serialization error.  Environment: Package 21st-dev/magic-mcp, connected via an MCP client (JSON-RPC over the standard MCP tool interface). Account is on the paid Builder plan with credits available, so this is not a free-tier or credits limitation.  Steps to reproduce: Call 21st_magic_component_builder with a simple message and searchQuery such as "button", plus valid absolute file and project directory paths, then wait for a response.  Expected: A valid MCP content block containing a generated component snippet, similar to what 21st.dev's own web-based "21st AI" chat produces for the same prompt on the same account.  Actual: The call hangs and eventually fails with "MCP error -32001: Request timed out".  Notes: logo_search works correctly on the same connection and account. The 21st.dev web chat (same account) generates components successfully, so the underlying generation service looks healthy. This appears isolated to the MCP tool response path for component_builder specifically. Reproduced identicall
  **Post-Mortem & Fix Analysis**:
  > Additional data point: separately, in an unrelated Claude session, I got "Could not connect to MCP server @21st-dev/magic" right when opening the app, before I had triggered any tool call at all. So it's not just component_builder/component_inspiration returning bad data, the server also seems to fail outright at connection time on its own, intermittently. Flagging in case it points to a broader stability issue on the server side rather than something specific to these two tools.
  > Additional data point: separately, in an unrelated Claude session, I got "Could not connect to MCP server @21st-dev/magic" right when opening the app, before I had triggered any tool call at all. So it's not just component_builder/component_inspiration returning bad data, the server also seems to fail outright at connection time on its own, intermittently. Flagging in case it points to a broader stability issue on the server side rather than something specific to these two tools.
  > Closing: as of v0.2.0 this package was replaced by a thin proxy to the unified 21st MCP (https://21st.dev/api/mcp) and the standalone server this issue was filed against is retired. The failures reported here (timeouts, [object Object], -32602/-32001 errors, tool-name and client-compat problems, key creation failures) were all symptoms of the old backend, whose API keys have also been reset. Current setup: get a key at https://21st.dev/mcp and run npx @21st-dev/cli@latest init - or keep your existing @21st-dev/magic config, it now proxies to the new server. If anything still misbehaves on 0.2.0+, please open a fresh issue.

- **Issue #73** (2026-07-24): **component_inspiration tool returns malformed content -> MCP error -32602 Invalid tools/call result**
  *Symptoms*: ## Summary  The `21st_magic_component_inspiration` MCP tool reproducibly returns a `content` item in its `tools/call` result that fails the MCP SDK's Zod schema validation, causing the client to reject the whole response with `MCP error -32602: Invalid tools/call result`.  ## Environment  - Package: `@21st-dev/magic` (installed via `npx -y @21st-dev/magic@latest`) - Server-reported version from `initialize` capabilities: `{"name":"21st-magic","version":"0.0.46"}` — note this appears out of sync with `npm view @21st-dev/magic version`, which currently resolves to `0.1.0` - MCP client: Claude Code (stdio transport) - OS: Windows 11, Node v22.16.0, npm 10.9.2  ## Steps to reproduce  1. Configure the MCP server: `npx -y @21st-dev/magic@latest` with a valid `API_KEY`. 2. Call the `21st_magic_component_inspiration` tool with any search query, e.g. `searchQuery: "button component"`, `message: "looking for a simple button component"`. 3. Observe the error below.  ## Actual result  MCP error -32602: MCP error -32602: Invalid tools/call result: [   {     "code": "invalid_union",     "errors": [       [ { "expected": "string", "code": "invalid_type", "path": ["text"], "message": "Invalid input: expected string, received undefined" } ],       [ { "code": "invalid_value", "values": ["image"], "path": ["type"], "message": "Invalid input: expected \"image\"" },         { "expected": "string", "code": "invalid_type", "path": ["data"], "message": "Invalid input: expected string, received unde
  **Post-Mortem & Fix Analysis**:
  > Confirming I hit this too, reproducible every time on a paid Builder plan, so it isn't a credits or free-tier limitation. Same MCP error -32602 invalid_union shape on component_inspiration. logo_search and 21st.dev's own web chat both work fine on the same account, so the underlying generation service looks healthy, this seems isolated to how content is serialized for the MCP response on this tool specifically. Also seeing a related but separate issue on component_builder, filed as #75.
  > Closing: as of v0.2.0 this package was replaced by a thin proxy to the unified 21st MCP (https://21st.dev/api/mcp) and the standalone server this issue was filed against is retired. The failures reported here (timeouts, [object Object], -32602/-32001 errors, tool-name and client-compat problems, key creation failures) were all symptoms of the old backend, whose API keys have also been reset. Current setup: get a key at https://21st.dev/mcp and run npx @21st-dev/cli@latest init - or keep your existing @21st-dev/magic config, it now proxies to the new server. If anything still misbehaves on 0.2.0+, please open a fresh issue.

- **Issue #72** (2026-07-24): **fix: prevent server crash on JSON-RPC requests with non-scalar id**
  *Symptoms*: ## Summary  When the MCP SDK receives a JSON-RPC request whose `id` field is a non-scalar (e.g. an object like `{"bad":"id"}`), the SDK creates an error response that either drops the `id` (if it was `undefined`) or causes `JSON.stringify` to throw when it encounters a non-serialisable object `id`.  The crash path: 1. `Session.handleRequest()` creates an error response with the invalid `id` 2. `JSON.stringify()` throws (or omits `id` leaving an invalid response) 3. `StdioServerTransport` emits an `'error'` event 4. The top-level `.catch()` handler calls `cleanup()` → `process.exit(0)` 5. Server is dead; all subsequent requests on that connection fail  The server also crashes on valid-but-unsupported `id` types like `boolean`.  ## Fix  Install a `process.stdout.write` guard **before** the MCP server connects the transport. Every JSON string written to stdout is intercepted, parsed, and validated. If the `id` field in a JSON-RPC response is not a valid JSON-RPC type (`string | number | null`), it is replaced with `null` before the string reaches the OS-level stdout buffer.  This is a belt-and-suspenders guard that is completely harmless for valid responses (no-op) and prevents the crash for the invalid-`id` path.  **Before (crash):** ``` {"jsonrpc":"2.0","id":{"bad":"id"},"error":{"code":-32600,"message":"Invalid Request"}} ```  **After (safe):** ``` {"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Invalid Request"}} ```  ## Changes  - **`src/utils/safe-transport.ts
  **Post-Mortem & Fix Analysis**:
  > Hi maintainers — gentle ping on this PR. It fixes a server crash when JSON-RPC requests have non-scalar `id` values (arrays, objects, etc.) by validating the `id` field before processing. All tests pass. Would appreciate a review when you have a moment. Thanks!
  > Thanks for the contribution! As of v0.2.0 this package was rewritten from a standalone MCP server into a thin stdio proxy to the unified 21st MCP (https://21st.dev/api/mcp), and the code this PR targets no longer exists. Tool annotations, JSON-RPC handling, and the tools themselves now live server-side. Closing as obsolete - see the new README for the current setup (npx @21st-dev/cli@latest init).

- **Issue #71** (2026-07-24): **Server crashes on a JSON-RPC request with a non-scalar `id`**
  *Symptoms*: Hi — found a reproducible crash in `@21st-dev/magic` (v0.0.46) while exercising it as an MCP client would.  **What happens:** a JSON-RPC request whose `id` is an object (instead of a string/number/null) causes the server to shut down rather than reject the request. It logs `Shutting down server (PID: ...)` and closes stdin, and every later request on that connection then fails because the process has exited.  **Minimal reproducer** — send this one frame after a normal initialize:  ```json {"jsonrpc": "2.0", "id": {"bad": "id"}, "method": "ping"} ```  **Expected:** reject the malformed `id` with a JSON-RPC error and stay running. **Actual:** server logs `Shutting down server (PID: ...)` and exits.  (Per the [JSON-RPC 2.0 spec](https://www.jsonrpc.org/specification#request_object), `id` must be a String, Number, or Null, so the ideal behavior is to reject it with an error and stay up.)  For context, everything else handled correctly right up to this point: wrong-type tool arguments returned proper `-32602` validation errors, and an unknown method returned `-32601`. It's specifically the malformed `id` that takes it down. Reproduced identically under both Claude Code and Cursor client behavior; a fresh relaunch and re-handshake works fine.  **How I found it:** I ran the server in an isolated sandbox under emulated Claude Code and Cursor traffic (a tool I'm building, Throne). Full sealed record with the step-by-step JSON-RPC trace: https://usethrone.dev/server/21st-dev-magic  Hap
  **Post-Mortem & Fix Analysis**:
  > Closing: as of v0.2.0 this package was replaced by a thin proxy to the unified 21st MCP (https://21st.dev/api/mcp) and the standalone server this issue was filed against is retired. The failures reported here (timeouts, [object Object], -32602/-32001 errors, tool-name and client-compat problems, key creation failures) were all symptoms of the old backend, whose API keys have also been reset. Current setup: get a key at https://21st.dev/mcp and run npx @21st-dev/cli@latest init - or keep your existing @21st-dev/magic config, it now proxies to the new server. If anything still misbehaves on 0.2.0+, please open a fresh issue.

- **Issue #70** (2026-07-10): **fix(http-client): throw on non-2xx responses so MCP tools surface errors correctly**
  *Symptoms*: ## Summary  Fixes https://github.com/21st-dev/magic-mcp/issues/66  **Before:** `response.ok` was never checked, so server errors (500, 503, etc.) returned as successful tool results with the error text as the output. Example: `/api/refine-ui` returning "Anthropic experiencing high load" as HTTP 200 would appear as a successful refinement to the MCP client — the client could not distinguish an outage from a real refinement.  **After:** `createMethod` now throws an `Error` with the HTTP status and server error body when `response.ok` is false. MCP clients receive a proper error they can surface to the user.  ## Changes  - **src/utils/http-client.ts** — after `fetch()`, check `response.ok`. If false, read the response body as text and throw `Error(HTTP {status} {statusText}: {errorText})`. If the body can't be read, fall back to just the status text. - **src/utils/http-client.test.ts** — 3 new regression tests covering:   - 500 with JSON error body → full error message in thrown Error   - 503 with no body → status-only thrown Error   - 401 with JSON error body → full error message in thrown Error  ## Test results  ``` PASS src/utils/http-client.test.ts   http-client     √ should use production URL in production environment (1 ms)   http-client error handling     √ throws on non-2xx response with status and error message (25 ms)     √ throws on non-2xx response when response has no body (2 ms)     √ throws on 401 with the error body from server (2 ms) Tests: 4 passed, 4 total ```
  **Post-Mortem & Fix Analysis**:
  > This PR is related to issue #66 — the http-client currently returns data.text unconditionally without checking esponse.status, so server-side errors like the 'Anthropic experiencing high load' canned response surface as successful MCP tool results. This fix throws on non-2xx responses so MCP clients can properly surface errors.
  > Stale PR (no activity for 4+ weeks). Feel free to reopen if still relevant.

- **Issue #69** (2026-07-06): **fix(create-ui): parse JSON callback data to extract component code**
  *Symptoms*: ## Summary  The `21st_magic_component_builder` tool was returning `[object Object]` instead of the actual component TSX code when called from Claude Code.  ## Problem  The callback server receives component data as a JSON string (e.g. `{"component": "export function Button()..."}`) and passes it through as-is. The `execute()` method was using the raw string directly as `prompt`, causing JavaScript to convert the JSON string to `[object Object]` when embedded in the response template.  ## Solution  Parse the callback data as JSON and extract the `component` or `text` field:  - If data is a non-empty string -> try to parse as JSON and extract `component` or `text` - If JSON parsing fails -> use the raw string - If data is empty string or non-string (e.g. timeout object) -> use the default fallback message  ## Testing  - [x] Unit tests added in `src/tools/create-ui.test.ts` - [x] Test for JSON with `component` field - [x] Test for JSON with `text` field - [x] Test for raw string fallback - [x] Test for empty string fallback - [x] Test for timed-out callback object fallback - [x] All 6 tests pass (including pre-existing http-client test)  ## Files Changed  - `src/tools/create-ui.ts` - JSON parsing fix for callback data - `src/tools/create-ui.test.ts` - unit tests for callback data parsing  Fixes #68
  **Post-Mortem & Fix Analysis**:
  > LGTM — the fix is clean and well-scoped. The JSON.parse in a try/catch with fallback to raw string handles all three cases (component field, text field, non-JSON string) correctly. The 6 new tests cover the edge cases thoroughly. One minor nit: the test file is missing a trailing newline (EOF). Ready to merge.
  > Spotted a minor nit from self-review: the test file is missing a trailing newline at EOF. Trivial one-liner — can be fixed by adding a blank line at the end of src/tools/create-ui.test.ts. Since I can't push to this branch directly (no write access to 21st-dev/magic-mcp), leaving this note for whoever merges: just add a final newline to the file before merging.
  > Stale PR (no maintainer activity for 4+ weeks). Feel free to reopen if still relevant.

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

### Incident Patch 1: `4fd82ae7` (2026-09-09)
**Commit Message**: fix: align MCP proxy skills and metadata with hosted AI access

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     {
       "name": "21st",
       "source": "./",
-      "description": "Search 10,000+ production-ready React/Tailwind components, install them with dependencies, and generate new UI with AI — the 21st.dev Magic MCP plus a UI skill.",
+      "description": "Find UI components and themes, retrieve their code, and use hosted 21st AI when enabled.",
       "category": "design",
       "homepage": "https://21st.dev/mcp",
       "keywords": ["21st", "21st.dev", "magic-mcp", "ui-components", "react", "tailwind"]
```

**File**: `.claude-plugin/plugin.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "21st",
-  "version": "1.0.0",
-  "description": "Search 10,000+ production-ready React/Tailwind components, install them with dependencies, and generate new UI with AI — the 21st.dev Magic MCP, right in your agent.",
+  "version": "1.0.1",
+  "description": "Find UI components and themes, retrieve their code, and use hosted 21st AI when enabled.",
   "author": {
     "name": "21st.dev",
     "email": "sergey@21st.dev",
```

**File**: `.codex-plugin/plugin.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "21st",
-  "version": "1.0.0",
-  "description": "Search 10,000+ production-ready React/Tailwind components, install them with dependencies, and generate new UI with AI — the 21st.dev Magic MCP, right in your agent.",
+  "version": "1.0.1",
+  "description": "Find UI components and themes, retrieve their code, and use hosted 21st AI when enabled.",
   "author": {
     "name": "21st.dev",
     "email": "sergey@21st.dev"
```

**File**: `.cursor-plugin/plugin.json` (modified, +3/-3)
```diff
@@ -1,8 +1,8 @@
 {
   "name": "21st",
   "displayName": "21st.dev",
-  "version": "1.0.0",
-  "description": "Search 10,000+ production-ready React/Tailwind components, install them with dependencies, and generate new UI with AI — the 21st.dev Magic MCP, right in your agent.",
+  "version": "1.0.1",
+  "description": "Find UI components and themes, retrieve their code, and use hosted 21st AI when enabled.",
   "author": {
     "name": "21st.dev",
     "email": "sergey@21st.dev"
@@ -20,7 +20,7 @@
       "API_KEY_21ST": {
         "type": "string",
         "title": "21st.dev API key",
-        "description": "Get a free key at https://21st.dev/mcp (sign in, the key is issued instantly). Free tier includes catalog search and 2 component installs per day; AI generation uses credits."
+        "description": "Get a free key at https://21st.dev/mcp (sign in, the key is issued instantly). Free tier includes catalog search and 2 component installs per day; hosted AI requires AI access and credits."
       }
     },
     "required": ["API_KEY_21ST"]
```

**File**: `README.md` (modified, +19/-3)
```diff
@@ -27,10 +27,26 @@ Get an API key at [21st.dev/mcp](https://21st.dev/mcp).
 
 ## What this package does now (v0.2.0+)
 
-`npx -y @21st-dev/magic@latest API_KEY="..."` still works: since v0.2.0 it is a small stdio proxy that forwards every MCP message to the 21st MCP server. Existing `mcp.json` entries that reference `@21st-dev/magic` keep functioning — but they now speak to the same server as the 21st CLI, with the full current toolset.
+`npx -y @21st-dev/magic@latest API_KEY="..."` still works: since v0.2.0 it is a small stdio proxy that forwards every MCP message to the 21st MCP server. Existing `mcp.json` entries that reference `@21st-dev/magic` keep functioning — but they now speak to the same server as the 21st CLI, with the tools available to the authenticated account.
 
 The API key is accepted in all the historical forms: positional `API_KEY="..."`, `--API_KEY=...`, `/API_KEY:...`, `-API_KEY ...`, or the `TWENTY_FIRST_API_KEY` / `API_KEY_21ST` environment variables.
 
+## AI access
+
+Builder component access does not enable hosted 21st AI. The server lists
+`generate` and `iterate_generation` only when AI access is enabled. Check
+`get_usage.aiGenerationEnabled`; this reports access, not the remaining AI
+credit balance. With AI off, use `search` and `get_component`, then adapt the
+code with your own coding agent. Existing drafts remain readable.
+
+A cached or legacy generation call can return `ai_subscription_required`. Do
+not retry until AI is enabled. Refresh the client tool list or reconnect after
+enabling AI. The proxy forwards discovery to the server, so existing proxy
+versions receive this behavior without an npm update.
+
+`server.json` mirrors the official `dev.21st/mcp` registry listing. The registry
+version is independent of this compatibility package version.
+
 ## Old tool names → new tool names
 
 The 21st MCP still accepts the legacy Magic tool names and translates them, so agents that remember the old names keep working. Prefer the new names:
@@ -42,7 +58,7 @@ The 21st MCP still accepts the legacy Magic tool names and translates them, so a
 | `21st_magic_component_refiner` | `generate` (new generation from the refinement prompt) |
 | `logo_search` | `search_logo` (one query per call) |
 
-The current server exposes much more than the old four tools: catalog search across components/themes/templates, paid code retrieval, bookmarks, team libraries, UI generation with variants, profile management, and more. Connect and call `tools/list` to see the full set.
+The current server exposes much more than the old four tools: catalog search across components/themes/templates, paid code retrieval, bookmarks, team libraries, UI generation with variants, profile management, and more. Connect and call `tools/list` to see the tools available to your account.
 
 ## Install as a plugin
 
@@ -81,4 +97,4 @@ The plugin config expects the API key in the `API_KEY_21ST` variable in every cl
 The Magic backend (`magic.21st.dev`) was superseded by the unified 21st MCP, and all old API keys were reset for security. Update to a fresh key from [21st.dev/mcp](https://21st.dev/mcp) — your existing `@21st-dev/magic` config will then work again through this compatibility proxy, though we recommend switching to `npx @21st-dev/cli@latest init`.
 
 **Is `/ui` still a thing?**
-Use natural language: ask your agent to search 21st for components (`search`), or generate new UI (`generate`). The old `/ui`, `/21` trigger phrases were a convention of the legacy tools' descriptions, not the protocol.
+Use natural language: ask your agent to search 21st for components (`search`), or use hosted UI generation (`generate`) when AI is enabled. The old `/ui`, `/21` trigger phrases were a convention of the legacy tools' descriptions, not the protocol.
```

---

### Incident Patch 2: `b07bc9d1` (2026-02-17)
**Commit Message**: Merge pull request #41 from 21st-dev/fix/security-patches

fix: update MCP SDK to patch security vulnerabilities

**File**: `package-lock.json` (modified, +364/-631)
```diff
@@ -9,7 +9,7 @@
       "version": "0.1.1-beta.1",
       "license": "ISC",
       "dependencies": {
-        "@modelcontextprotocol/sdk": "^1.8.0",
+        "@modelcontextprotocol/sdk": "^1.25.3",
         "@types/cors": "^2.8.17",
         "@types/express": "^5.0.0",
         "cors": "^2.8.5",
@@ -554,6 +554,18 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/@hono/node-server": {
+      "version": "1.19.9",
+      "resolved": "https://registry.npmjs.org/@hono/node-server/-/node-server-1.19.9.tgz",
+      "integrity": "sha512-vHL6w3ecZsky+8P5MD+eFfaGTyCeOHUIFYMGpQGbrBTSmNNoxv0if69rEZ5giu36weC5saFuznL411gRX7bJDw==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=18.14.1"
+      },
+      "peerDependencies": {
+        "hono": "^4"
+      }
+    },
     "node_modules/@istanbuljs/load-nyc-config": {
       "version": "1.1.0",
       "resolved": "https://registry.npmjs.org/@istanbuljs/load-nyc-config/-/load-nyc-config-1.1.0.tgz",
@@ -927,263 +939,61 @@
       }
     },
     "node_modules/@modelcontextprotocol/sdk": {
-      "version": "1.8.0",
-      "resolved": "https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.8.0.tgz",
-      "integrity": "sha512-e06W7SwrontJDHwCawNO5SGxG+nU9AAx+jpHHZqGl/WrDBdWOpvirC+s58VpJTB5QemI4jTRcjWT4Pt3Q1NPQQ==",
+      "version": "1.26.0",
+      "resolved": "https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.26.0.tgz",
+      "integrity": "sha512-Y5RmPncpiDtTXDbLKswIJzTqu2hyBKxTNsgKqKclDbhIgg1wgtf1fRuvxgTnRfcnxtvvgbIEcqUOzZrJ6iSReg==",
       "license": "MIT",
       "dependencies": {
+        "@hono/node-server": "^1.19.9",
+        "ajv": "^8.17.1",
+        "ajv-formats": "^3.0.1",
         "content-type": "^1.0.5",
         "cors": "^2.8.5",
-        "cross-spawn": "^7.0.3",
+        "cross-spawn": "^7.0.5",
         "eventsource": "^3.0.2",
-        "express": "^5.0.1",
-        "express-rate-limit": "^7.5.0",
-        "pkce-challenge": "^4.1.0",
+        "eventsource-parser": "^3.0.0",
+        "express": "^5.2.1",
+        "express-rate-limit": "^8.2.1",
+        "hono": "^4.11.4",
+        "jose": "^6.1.3",
+        "json-schema-typed": "^8.0.2",
+        "pkce-challenge": "^5.0.0",
         "raw-body": "^3.0.0",
-        "zod": "^3.23.8",
-        "zod-to-json-schema": "^3.24.1"
+        "zod": "^3.25 || ^4.0",
+        "zod-to-json-schema": "^3.25.1"
       },
       "engines": {
         "node": ">=18"
-      }
-    },
-    "node_modules/@modelcontextprotocol/sdk/node_modules/accepts": {
-      "version": "2.0.0",
-      "resolved": "https://registry.npmjs.org/accepts/-/accepts-2.0.0.tgz",
-      "integrity": "sha512-5cvg6CtKwfgdmVqY1WIiXKc3Q1bkRqGLi+2W/6ao+6Y7gu/RCwRuAhGEzh5B4KlszSuTLgZYuqFqo5bImjNKng==",
-      "license": "MIT",
-      "dependencies": {
-        "mime-types": "^3.0.0",
-        "negotiator": "^1.0.0"
       },
-      "engines": {
-        "node": ">= 0.6"
-      }
-    },
-    "node_modules/@modelcontextprotocol/sdk/node_modules/body-parser": {
-      "version": "2.2.0",
-      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-2.2.0.tgz",
-      "integrity": "sha512-02qvAaxv8tp7fBa/mw1ga98OGm+eCbqzJOKoRt70sLmfEEi+jyBYVTDGfCL/k06/4EMk/z01gCe7HoCH/f2LTg==",
-      "license": "MIT",
-      "dependencies": {
-        "bytes": "^3.1.2",
-        "content-type": "^1.0.5",
-        "debug": "^4.4.0",
-        "http-errors": "^2.0.0",
-        "iconv-lite": "^0.6.3",
-        "on-finished": "^2.4.1",
-        "qs": "^6.14.0",
-        "raw-body": "^3.0.0",
-        "type-is": "^2.0.0"
-      },
-      "engines": {
-        "node": ">=18"
-      }
-    },
-    "node_modules/@modelcontextprotocol/sdk/node_modules/content-disposition": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/content-disposition/-/content-disposition-1.0.0.tgz",
-      "integrity": "sha512-Au9nRL8VNUut/XSzbQA38+M78dzP4D+eqg3gfJHMIHHYa3bg067xj1KxMUWj+VULbiZMowKngFFbKczUrNJ1mg==",
-      "license": "MIT",

```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
   "author": "serafim@21st.dev",
   "license": "ISC",
   "dependencies": {
-    "@modelcontextprotocol/sdk": "^1.8.0",
+    "@modelcontextprotocol/sdk": "^1.25.3",
     "@types/cors": "^2.8.17",
     "@types/express": "^5.0.0",
     "cors": "^2.8.5",
```

---

### Incident Patch 3: `54f95c18` (2026-02-17)
**Commit Message**: fix: update @modelcontextprotocol/sdk to ^1.25.3

Patches HIGH security vulnerabilities:
- ReDoS vulnerability (CVE fix)
- Missing input validation (CVE fix)

Also updates transitive deps (qs, body-parser, js-yaml).

**File**: `package-lock.json` (modified, +364/-631)
```diff
@@ -9,7 +9,7 @@
       "version": "0.1.1-beta.1",
       "license": "ISC",
       "dependencies": {
-        "@modelcontextprotocol/sdk": "^1.8.0",
+        "@modelcontextprotocol/sdk": "^1.25.3",
         "@types/cors": "^2.8.17",
         "@types/express": "^5.0.0",
         "cors": "^2.8.5",
@@ -554,6 +554,18 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/@hono/node-server": {
+      "version": "1.19.9",
+      "resolved": "https://registry.npmjs.org/@hono/node-server/-/node-server-1.19.9.tgz",
+      "integrity": "sha512-vHL6w3ecZsky+8P5MD+eFfaGTyCeOHUIFYMGpQGbrBTSmNNoxv0if69rEZ5giu36weC5saFuznL411gRX7bJDw==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=18.14.1"
+      },
+      "peerDependencies": {
+        "hono": "^4"
+      }
+    },
     "node_modules/@istanbuljs/load-nyc-config": {
       "version": "1.1.0",
       "resolved": "https://registry.npmjs.org/@istanbuljs/load-nyc-config/-/load-nyc-config-1.1.0.tgz",
@@ -927,263 +939,61 @@
       }
     },
     "node_modules/@modelcontextprotocol/sdk": {
-      "version": "1.8.0",
-      "resolved": "https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.8.0.tgz",
-      "integrity": "sha512-e06W7SwrontJDHwCawNO5SGxG+nU9AAx+jpHHZqGl/WrDBdWOpvirC+s58VpJTB5QemI4jTRcjWT4Pt3Q1NPQQ==",
+      "version": "1.26.0",
+      "resolved": "https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.26.0.tgz",
+      "integrity": "sha512-Y5RmPncpiDtTXDbLKswIJzTqu2hyBKxTNsgKqKclDbhIgg1wgtf1fRuvxgTnRfcnxtvvgbIEcqUOzZrJ6iSReg==",
       "license": "MIT",
       "dependencies": {
+        "@hono/node-server": "^1.19.9",
+        "ajv": "^8.17.1",
+        "ajv-formats": "^3.0.1",
         "content-type": "^1.0.5",
         "cors": "^2.8.5",
-        "cross-spawn": "^7.0.3",
+        "cross-spawn": "^7.0.5",
         "eventsource": "^3.0.2",
-        "express": "^5.0.1",
-        "express-rate-limit": "^7.5.0",
-        "pkce-challenge": "^4.1.0",
+        "eventsource-parser": "^3.0.0",
+        "express": "^5.2.1",
+        "express-rate-limit": "^8.2.1",
+        "hono": "^4.11.4",
+        "jose": "^6.1.3",
+        "json-schema-typed": "^8.0.2",
+        "pkce-challenge": "^5.0.0",
         "raw-body": "^3.0.0",
-        "zod": "^3.23.8",
-        "zod-to-json-schema": "^3.24.1"
+        "zod": "^3.25 || ^4.0",
+        "zod-to-json-schema": "^3.25.1"
       },
       "engines": {
         "node": ">=18"
-      }
-    },
-    "node_modules/@modelcontextprotocol/sdk/node_modules/accepts": {
-      "version": "2.0.0",
-      "resolved": "https://registry.npmjs.org/accepts/-/accepts-2.0.0.tgz",
-      "integrity": "sha512-5cvg6CtKwfgdmVqY1WIiXKc3Q1bkRqGLi+2W/6ao+6Y7gu/RCwRuAhGEzh5B4KlszSuTLgZYuqFqo5bImjNKng==",
-      "license": "MIT",
-      "dependencies": {
-        "mime-types": "^3.0.0",
-        "negotiator": "^1.0.0"
       },
-      "engines": {
-        "node": ">= 0.6"
-      }
-    },
-    "node_modules/@modelcontextprotocol/sdk/node_modules/body-parser": {
-      "version": "2.2.0",
-      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-2.2.0.tgz",
-      "integrity": "sha512-02qvAaxv8tp7fBa/mw1ga98OGm+eCbqzJOKoRt70sLmfEEi+jyBYVTDGfCL/k06/4EMk/z01gCe7HoCH/f2LTg==",
-      "license": "MIT",
-      "dependencies": {
-        "bytes": "^3.1.2",
-        "content-type": "^1.0.5",
-        "debug": "^4.4.0",
-        "http-errors": "^2.0.0",
-        "iconv-lite": "^0.6.3",
-        "on-finished": "^2.4.1",
-        "qs": "^6.14.0",
-        "raw-body": "^3.0.0",
-        "type-is": "^2.0.0"
-      },
-      "engines": {
-        "node": ">=18"
-      }
-    },
-    "node_modules/@modelcontextprotocol/sdk/node_modules/content-disposition": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/content-disposition/-/content-disposition-1.0.0.tgz",
-      "integrity": "sha512-Au9nRL8VNUut/XSzbQA38+M78dzP4D+eqg3gfJHMIHHYa3bg067xj1KxMUWj+VULbiZMowKngFFbKczUrNJ1mg==",
-      "license": "MIT",

```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
   "author": "serafim@21st.dev",
   "license": "ISC",
   "dependencies": {
-    "@modelcontextprotocol/sdk": "^1.8.0",
+    "@modelcontextprotocol/sdk": "^1.25.3",
     "@types/cors": "^2.8.17",
     "@types/express": "^5.0.0",
     "cors": "^2.8.5",
```

---

### Incident Patch 4: `d7be57a8` (2025-12-23)
**Commit Message**: prompt fix

**File**: `src/tools/create-ui.ts` (modified, +2/-1)
```diff
@@ -45,6 +45,7 @@ export class CreateUiTool extends BaseTool {
   async execute({
     standaloneRequestQuery,
     absolutePathToProjectDirectory,
+    message,
   }: z.infer<typeof this.schema>): Promise<{
     content: Array<{ type: "text"; text: string }>;
   }> {
@@ -59,7 +60,7 @@ export class CreateUiTool extends BaseTool {
 
       if (config.canvas) {
         const params = new URLSearchParams({
-          q: standaloneRequestQuery,
+          q: `Primary request: ${message} \n\nAdditional context: ${standaloneRequestQuery}`,
           mcp: "true",
           port: port.toString(),
         });
```

---

### Incident Patch 5: `a5b0adad` (2025-06-09)
**Commit Message**: Magic v2 fix

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@21st-dev/magic",
-  "version": "0.0.46",
+  "version": "0.0.47",
   "type": "module",
   "description": "Magic MCP UI builder by 21st.dev",
   "homepage": "https://21st.dev/magic",
@@ -26,7 +26,7 @@
   ],
   "main": "dist/index.js",
   "scripts": {
-    "build": "tsc && shx cp -r previewer dist/ && shx chmod +x dist/*.js",
+    "build": "tsc && shx chmod +x dist/*.js",
     "build:prod": "npm run build && npm run test",
     "debug": "npm run build && npx @modelcontextprotocol/inspector node dist/index.js DEBUG=true",
     "start": "node dist/index.js",
```

**File**: `src/tools/create-ui.ts` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ export class CreateUiTool extends BaseTool {
       const callbackPromise = server.waitForCallback();
       const port = server.getPort();
 
-      open(`http://localhost:3000/magic-chat?q=${encodeURIComponent(standaloneRequestQuery)}&mcp=true&port=${port}`);
+      open(`http://21st.dev/magic-chat?q=${encodeURIComponent(standaloneRequestQuery)}&mcp=true&port=${port}`);
 
       const { data } = await callbackPromise;
 
```

---

### Incident Patch 6: `9663a688` (2025-04-03)
**Commit Message**: fix: enhance UI tool description for clarity on user-specific refinements

**File**: `src/tools/refine-ui.ts` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ export class RefineUiTool extends BaseTool {
     context: z
       .string()
       .describe(
-        "What user asks to refactor specifically, hints related to current file/codebase"
+        "Extract the specific UI elements and aspects that need improvement based on user messages, code, and conversation history. Identify exactly which components (buttons, forms, modals, etc.) the user is referring to and what aspects (styling, layout, responsiveness, etc.) they want to enhance. Do not include generic improvements - focus only on what the user explicitly mentions or what can be reasonably inferred from the available context. If nothing specific is mentioned or you cannot determine what needs improvement, return an empty string."
       ),
   });
 
```

---

### Incident Patch 7: `b116d1c3` (2025-04-02)
**Commit Message**: fix: update tool description for UI component refinement to clarify functionality

**File**: `src/tools/refine-ui.ts` (modified, +2/-2)
```diff
@@ -5,8 +5,8 @@ import { twentyFirstClient } from "../utils/http-client.js";
 const REFINE_UI_TOOL_NAME = "21st_magic_component_refiner";
 const REFINE_UI_TOOL_DESCRIPTION = `
 "Use this tool when the user requests to refine/improve current UI component with /ui or /21 commands, 
-or when context is about improving, fixing, or refining UI for a small component or molecule (NOT for big pages).
-This tool ONLY returns the refined version of that UI component based on user feedback."
+or when context is about improving, or refining UI for a React component or molecule (NOT for big pages).
+This tool improves UI of components and returns improved version of the component and instructions on how to implement it."
 `;
 
 interface RefineUiResponse {
```

---

### Incident Patch 8: `bf92cc47` (2025-03-31)
**Commit Message**: feat: auto fix error

**File**: `package-lock.json` (modified, +126/-0)
```diff
@@ -12,9 +12,11 @@
         "@modelcontextprotocol/sdk": "^1.5.0",
         "@types/cors": "^2.8.17",
         "@types/express": "^5.0.0",
+        "@types/node-fetch": "^2.6.12",
         "cors": "^2.8.5",
         "express": "^4.21.2",
         "mcps-logger": "^1.0.0-rc.1",
+        "node-fetch": "^2.7.0",
         "open": "^10.1.0",
         "zod": "^3.24.2"
       },
@@ -1143,6 +1145,16 @@
         "undici-types": "~6.20.0"
       }
     },
+    "node_modules/@types/node-fetch": {
+      "version": "2.6.12",
+      "resolved": "https://registry.npmjs.org/@types/node-fetch/-/node-fetch-2.6.12.tgz",
+      "integrity": "sha512-8nneRWKCg3rMtF69nLQJnOYUcbafYeFSjqkw3jCRLsqkWFlHaoQrr5mXmofFGOx3DKn7UfmBMyov8ySvLRVldA==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/node": "*",
+        "form-data": "^4.0.0"
+      }
+    },
     "node_modules/@types/qs": {
       "version": "6.9.18",
       "resolved": "https://registry.npmjs.org/@types/qs/-/qs-6.9.18.tgz",
@@ -1292,6 +1304,12 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/asynckit": {
+      "version": "0.4.0",
+      "resolved": "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz",
+      "integrity": "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==",
+      "license": "MIT"
+    },
     "node_modules/babel-jest": {
       "version": "29.7.0",
       "resolved": "https://registry.npmjs.org/babel-jest/-/babel-jest-29.7.0.tgz",
@@ -1836,6 +1854,18 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/combined-stream": {
+      "version": "1.0.8",
+      "resolved": "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.8.tgz",
+      "integrity": "sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==",
+      "license": "MIT",
+      "dependencies": {
+        "delayed-stream": "~1.0.0"
+      },
+      "engines": {
+        "node": ">= 0.8"
+      }
+    },
     "node_modules/concat-map": {
       "version": "0.0.1",
       "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
@@ -2019,6 +2049,15 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/delayed-stream": {
+      "version": "1.0.0",
+      "resolved": "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz",
+      "integrity": "sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=0.4.0"
+      }
+    },
     "node_modules/depd": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/depd/-/depd-2.0.0.tgz",
@@ -2170,6 +2209,21 @@
         "node": ">= 0.4"
       }
     },
+    "node_modules/es-set-tostringtag": {
+      "version": "2.1.0",
+      "resolved": "https://registry.npmjs.org/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz",
+      "integrity": "sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==",
+      "license": "MIT",
+      "dependencies": {
+        "es-errors": "^1.3.0",
+        "get-intrinsic": "^1.2.6",
+        "has-tostringtag": "^1.0.2",
+        "hasown": "^2.0.2"
+      },
+      "engines": {
+        "node": ">= 0.4"
+      }
+    },
     "node_modules/escalade": {
       "version": "3.2.0",
       "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
@@ -2461,6 +2515,21 @@
         "node": ">=8"
       }
     },
+    "node_modules/form-data": {
+      "version": "4.0.2",
+      "resolved": "https://registry.npmjs.org/form-data/-/form-data-4.0.2.tgz",
+      "integrity": "sha512-hGfm/slu0ZabnNt4oaRZ6uREyfCj6P4fT/n6A1rGV+Z0VdGXjfOhVUpkn6qVQONHGIFwmveGXyDs75+nr6FM8w==",
+      "license": "MIT",
+      "dependencies": {
+        "asynckit": "^0.4.0",
+        "combined-stream": "^1.0.8",
+        "es-set-tostringtag": "^2.1.0",
+        "mime-types": 
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -40,9 +40,11 @@
     "@modelcontextprotocol/sdk": "^1.5.0",
     "@types/cors": "^2.8.17",
     "@types/express": "^5.0.0",
+    "@types/node-fetch": "^2.6.12",
     "cors": "^2.8.5",
     "express": "^4.21.2",
     "mcps-logger": "^1.0.0-rc.1",
+    "node-fetch": "^2.7.0",
     "open": "^10.1.0",
     "zod": "^3.24.2"
   },
```

**File**: `src/utils/callback-server.ts` (modified, +45/-2)
```diff
@@ -1,10 +1,10 @@
-import express from "express";
+import express, { Request, Response } from "express";
 import { Server } from "http";
-import { AddressInfo } from "net";
 import open from "open";
 import path from "path";
 import { fileURLToPath } from "url";
 import net from "net";
+import { twentyFirstClient } from "./http-client.js";
 
 const __filename = fileURLToPath(import.meta.url);
 const __dirname = path.dirname(__filename);
@@ -57,6 +57,49 @@ export class CallbackServer {
       res.json({ status: "success" });
     });
 
+    this.app.post<{ id: string }, any, { code: string; errorMessage: string }>(
+      "/fix-code-error/:id",
+      async (req, res): Promise<void> => {
+        const { id } = req.params;
+        const { code, errorMessage } = req.body;
+
+        if (id !== this.sessionId) {
+          res
+            .status(404)
+            .json({ status: "error", message: "Session not found" });
+          return;
+        }
+
+        if (!code || !errorMessage) {
+          res
+            .status(400)
+            .json({ status: "error", message: "Missing code or errorMessage" });
+          return;
+        }
+
+        try {
+          const response = await twentyFirstClient.post<{ fixedCode: string }>(
+            "/api/fix-code-error",
+            { code, errorMessage }
+          );
+
+          if (response.status === 200) {
+            res.json({ status: "success", data: response.data });
+          } else {
+            res
+              .status(response.status)
+              .json({ status: "error", message: response.data || "API Error" });
+          }
+        } catch (error: any) {
+          console.error("Error proxying /fix-code-error:", error);
+          res.status(500).json({
+            status: "error",
+            message: error.message || "Internal Server Error",
+          });
+        }
+      }
+    );
+
     this.app.get("*", (req, res) => {
       res.sendFile(path.join(previewerPath, "index.html"));
     });
```

**File**: `src/utils/http-client.ts` (modified, +5/-1)
```diff
@@ -1,9 +1,10 @@
 import { config } from "./config.js";
+import fetch, { HeadersInit, RequestInit } from "node-fetch";
 
 const TWENTY_FIRST_API_KEY =
   config.apiKey || process.env.TWENTY_FIRST_API_KEY || process.env.API_KEY;
 
-const BASE_URL = "https://magic.21st.dev";
+export const BASE_URL = "https://magic.21st.dev"; // "http://localhost:3005";
 
 type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
 
@@ -46,13 +47,16 @@ const createMethod = (method: HttpMethod) => {
       ...options.headers,
     };
 
+    console.log("BASE_URL", BASE_URL);
+
     const response = await fetch(`${BASE_URL}${endpoint}`, {
       ...options,
       method,
       headers,
       ...(data ? { body: JSON.stringify(data) } : {}),
     });
 
+    console.log("response", response);
     return { status: response.status, data: (await response.json()) as T };
   };
 };
```

#### Recent Merged Pull Requests:
- **PR #79** (2026-08-31): Add Codex plugin manifest (@bunasQ)
- **PR #78** (2026-08-31): Package the 21st MCP as an agent plugin (Cursor / Claude / Grok) (@bunasQ)
- **PR #72** (closed): fix: prevent server crash on JSON-RPC requests with non-scalar id (@fuleinist)
- **PR #70** (closed): fix(http-client): throw on non-2xx responses so MCP tools surface errors correctly (@fuleinist)
- **PR #69** (closed): fix(create-ui): parse JSON callback data to extract component code (@fuleinist)
- **PR #65** (closed): Add SECURITY.md and Deno workflow for linting and testing (@Rankvnq)
- **PR #56** (closed): ci: add HOL skill-publish validate workflow (@internet-dot)
- **PR #52** (closed): Add Codex plugin quality gate CI (@internet-dot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
