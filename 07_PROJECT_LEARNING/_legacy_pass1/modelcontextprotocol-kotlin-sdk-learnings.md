# Forensic Learning Record (Deep Inspection): modelcontextprotocol/kotlin-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-kotlin-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/kotlin-sdk](https://github.com/modelcontextprotocol/kotlin-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:40:18.718Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/kotlin-sdk`
- **Description**: The official Kotlin SDK for Model Context Protocol servers and clients. Maintained in collaboration with JetBrains
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1463 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #908** (2026-07-28): **Stateless Streamable HTTP: `eventStore` parameter is inert**
  *Symptoms*: `mcpStatelessStreamableHttp` accepts an `eventStore` that is never read or written: the DSL hardcodes `enableJsonResponse = true` and answers `GET` with `405` without registering an SSE route, which leaves every path that stores or replays events unreachable. Resumption is always driven by a `GET` carrying `Last-Event-ID`, so a POST-only endpoint cannot offer it at all, and [SEP-2575](https://modelcontextprotocol.io/seps/2575-stateless-mcp.md) removes resumable streams outright. The TypeScript SDK keeps `eventStore` on the transport and exposes it on no stateless facade. Fix: drop the parameter from the stateless overload, keeping the old signature as a deprecated one so existing call sites get a migration hint. `mcpStreamableHttp`, `EventStore` and `Configuration.eventStore` are unaffected. 

- **Issue #869** (2026-07-15): **`Protocol.request` timeout only bounds sending the request, not awaiting the response**
  *Symptoms*: **Describe the bug**  In `Protocol.request()`, `withTimeout(timeout)` wraps only the `transport.send(...)` call; awaiting the response (`result.await()`) happens outside the block. When the peer never delivers a response, the request therefore stays suspended past `RequestOptions.timeout` (default `DEFAULT_REQUEST_TIMEOUT` = 60s).  The KDoc for `RequestOptions.timeout` states "If exceeded, a `McpException` with code `RequestTimeout` is raised from `Protocol.request`", which differs from the current behavior.  Affected version: `0.14.0`; observed on `main` at 420b64d.  **To Reproduce**  Steps to reproduce the behavior:  1. Connect a `Protocol` to a `Transport` that accepts outgoing messages but never delivers a response. 2. Call `request()` with `RequestOptions(timeout = 100.milliseconds)`. 3. Drive the test scheduler until idle; a correct implementation should advance to the request timeout and complete the request. 4. Expected: the request fails with an `McpException` (code `RequestTimeout`). Actual: on `main`, the request remains suspended because the response wait is outside the timeout scope.  <details> <summary>Runnable reproducer (placed in kotlin-sdk-core commonTest)</summary>  ```kotlin @OptIn(ExperimentalCoroutinesApi::class) class RequestTimeoutReproTest {     @Test     fun `request fails with RequestTimeout when the response never arrives`() = runTest {         val protocol = object : Protocol(null) {             override fun assertCapabilityForMethod(method: Metho

- **Issue #866** (2026-07-22): **Streamable HTTP transport omits JSON-RPC `id` when rejecting parsed requests**
  *Symptoms*: **Describe the bug**  When the Kotlin SDK's Streamable HTTP transport rejects a request after parsing the JSON-RPC body, the error response can omit the JSON-RPC `id` field. One reproducible case is a duplicate `initialize` request on an existing session.  > Error responses **MUST** include the same ID as the request they correspond to (except in error cases where the ID could not be read due a malformed request).  In the observed case, the request body has already been parsed and the request `id` is available, so this is not a case where the ID could not be read.  The concrete reproduction below uses the duplicate-initialize path. In that path, the transport-level `reject()` helper serializes the error with `id = null`. Other call sites that invoke the same helper after successfully parsing a request body may have the same response-correlation issue. The same duplicate-initialize request rejected via stdio produces an error response with the `id` present.  - Environment   - Reproduced with stable release `0.12.0` (`c339d8cb8656ae419d6149b3342a568ba0119351`)   - Transport: Streamable HTTP, stateful mode  **To reproduce**  1. Start a Kotlin SDK MCP server over Streamable HTTP. 2. Complete a normal `initialize` handshake to establish a session. 3. Send a second `initialize` request on the same session:  ```json {"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{"roots":{"listChanged":true},"sampling":{},"elicitation":{}},"clie

- **Issue #845** (2026-06-29): **completion/complete is gated on the prompts capability instead of completions**
  *Symptoms*: **Describe the bug**  `Client.assertCapabilityForMethod` gates `completion/complete` (`CompletionComplete`) on the server's `prompts` capability instead of `completions`. A server that declares `completions` but not `prompts` therefore cannot be used for completion.  Affected version: `0.13.0` / `main`.  **To Reproduce**  Steps to reproduce the behavior:  1. Connect a `Client` (default options) to a server whose `initialize` response declares `completions` (and `resources`) but not `prompts`. 2. Send a completion request:  ```kotlin val request = buildCompleteRequest {     ref(ResourceTemplateReference("db://{table}/{id}"))     argument("table", "user") } client.complete(request) // throws IllegalStateException: "Server does not support prompts (required for CompletionComplete)" ```  Such a server is a legitimate configuration: completion also serves resource-template URIs (`ref/resource`), not only prompt arguments.  **Expected behavior**  `completion/complete` is gated on the server's `completions` capability: a server that declares `completions` (regardless of `prompts`) can be used for completion, and a server without `completions` is rejected.  **Additional context**  In `Client.kt`, `CompletionComplete` is grouped with `PromptsGet` / `PromptsList` and checked against `serverCapabilities?.prompts`, while `completions` is a separate capability in `ServerCapabilities`. The TypeScript SDK [gates this method on `completions`](https://github.com/modelcontextprotocol/typescrip

- **Issue #830** (2026-07-22): **Malformed initialize request with missing required params returns different JSON-RPC error codes per transport**
  *Symptoms*: **Describe the bug**  When an `initialize` request has a valid JSON-RPC envelope and a recognized method name, but is missing required fields such as `params.protocolVersion`, the Kotlin SDK appears to return different JSON-RPC error codes depending on the transport:  * stdio returns `-32603 Internal error`, with the error message exposing the underlying Kotlin serialization exception. * Streamable HTTP returns `-32600 Invalid Request`.  For the same JSON-RPC method and payload, I would expect the transports to classify the error consistently.  - Environment   - Reproduced with stable release `0.13.0` (`b7eeeb12058099f980fa98d1468506489a6b5f32`)   - Transports: stdio and Streamable HTTP  **To reproduce**  1. Start a Kotlin SDK MCP server over stdio or Streamable HTTP. 2. Send this malformed `initialize` request:  ```json {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"repro","version":"0.1.0"}}} ```  The request intentionally omits `params.protocolVersion`.  **Expected behavior**  Because the method exists but the method-specific params are incomplete, I would expect a consistent JSON-RPC error. The exact message can vary, but the error category should be stable across transports for the same input.  **Logs**  stdio returns `-32603 Internal error`. The error message appears to expose the underlying `kotlinx.serialization.MissingFieldException` message:  ```json {"id":1,"error":{"code":-32603,"message":"Fields [protocolVersion, c

- **Issue #786** (2026-07-15): **Stateless Streamable HTTP: server sessions are registered but never removed**
  *Symptoms*: # Stateless Streamable HTTP: server sessions are registered but never removed  ## Summary  When serving MCP over the stateless Streamable HTTP transport (`Application.mcpStatelessStreamableHttp { ... }`), every incoming POST request registers a new `ServerSession` but never removes it. The session registry and its notification-service subscriptions grow without bound across requests, since the stateless endpoint creates a fresh `Server`/transport/session per request and never closes them.  ## Affected version  - `io.modelcontextprotocol:kotlin-sdk` **0.12.0**, and current `main`   (verified at commit `37ee423`, 31 commits past the 0.12.0 tag — no relevant fix   in between).  ## Environment  - JVM 21, Kotlin 2.3.x, Ktor 3.5.0 (Netty) - Transport: `Application.mcpStatelessStreamableHttp`, POST `/mcp`, `enableJsonResponse = true`  ## Steps to reproduce  Start a minimal stateless server exposing one tool, then send several `tools/call` requests:  ```bash for n in 1 2 3 4 5; do   curl -s -H "Content-Type: application/json" \        -H "Accept: application/json, text/event-stream" \        -X POST http://localhost:8080/mcp \        -d "{\"jsonrpc\":\"2.0\",\"id\":$n,\"method\":\"tools/call\",\"params\":{\"name\":\"ping\",\"arguments\":{}}}" done ```  ## Actual behavior  `ServerSessionRegistry` logs one `Adding session` per request and never logs `Removing session`; the registered-session count rises monotonically. The per-request `block` is also re-invoked each time (a new `Server`

- **Issue #715** (2026-09-29): **GET SSE stream reconnect fails due to stale STANDALONE_SSE_STREAM_ID mapping**
  *Symptoms*: **Describe the bug**    When a GET SSE stream disconnects and the client reconnects on the same session, the new GET is silently rejected because the previous stream's `STANDALONE_SSE_STREAM_ID` entry in `streamsMapping` hasn't been   cleaned up yet. Clients see a 200 OK with an immediately-closed empty SSE stream, causing a retry loop that manifests as a permanently lost MCP connection.    **To Reproduce**    1. Start a Streamable HTTP MCP server using `mcpStreamableHttp`   2. Initialize a session via POST to `/mcp`   3. Open a GET SSE stream on `/mcp`, consume the flush event, then close the connection   4. Immediately open a new GET SSE stream on `/mcp` with the same session ID   5. The new stream is dead — first `readLine()` returns null    **Expected behavior**    The reconnected GET SSE stream should be live and functional. The TypeScript reference implementation handles this correctly because `ReadableStream.cancel()` removes the stream mapping synchronously on   disconnect.    **Logs**    Server-side `CallLogging` reports 409 Conflict, but this status never reaches the client (Ktor's `sse {}` handler commits 200 OK before the transport handler runs):  ```   13:47:05.141 WARN  io.ktor.server.Application - GET /mcp → 409 Conflict (session=d4aed42f-86af-49da-ab1d-3b8b61f9ad13)   13:47:05.339 WARN  io.ktor.server.Application - GET /mcp → 409 Conflict (session=9601a9a7-0583-43bb-9c0f-1664c113f771)   13:47:05.356 WARN  io.ktor.server.Application - GET /mcp → 409 Conflict (s

- **Issue #708** (2026-06-01): **StdioServerTransport: onClose callback not called when stdin receives EOF**
  *Symptoms*: ## Description  When running an MCP server with `StdioServerTransport` inside a Docker container, the `server.onClose` and `session.onClose` callbacks are never triggered when the MCP client (opencode) closes the connection by closing stdin.  ## Steps to Reproduce  1. Start an MCP server using `StdioServerTransport` 2. Connect a client via stdio (e.g. opencode) 3. Close the client  ## Expected Behavior  `server.onClose` or `session.onClose` callback is called, allowing the server process to exit gracefully.  ## Actual Behavior  Neither `server.onClose` nor `session.onClose` is triggered. The log shows session removal: [DefaultDispatcher-worker-3] INFO ServerSessionRegistry - Removing session: 3a737289-2a49-454d-9cb1-a692c646634b  But the process continues to hang indefinitely.  ## Workaround  Wrapping `System.in` to detect EOF manually:  ```kotlin class EofDetectingInputStream(     private val delegate: InputStream,     private val onEof: () -> Unit, ) : InputStream() {     override fun read(): Int {         val b = delegate.read()         if (b == -1) onEof()         return b     }      override fun read(b: ByteArray, off: Int, len: Int): Int {         val n = delegate.read(b, off, len)         if (n == -1) onEof()         return n     } }  val transport = StdioServerTransport(     inputStream = EofDetectingInputStream(System.`in`) { exitProcess(0) }.asSource().buffered(),     outputStream = System.out.asSink().buffered(), ) ```  ## Environment  - kotlin-sdk version: (укажи 

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

### Incident Patch 1: `43c7c252` (2026-09-30)
**Commit Message**: test: remove redundant tests and fix vacuous ones (#1054)

Trims the test suite down to tests that protect real SDK behavior and
fixes tests that could not fail. This touches only tests and test
infrastructure; there are no production changes.

- **Core types:**
- Removed serialize/deserialize twins, per-field copies and "minimal"
variants. They re-ran the same generated serializer that
`verifySerialization` already round-trips.
- The result and request tests that remain now go through the
polymorphic `ServerResult`, `ClientResult` and `Request` dispatch.
  - One table test now covers every request method.
- **DSL builders and the URI template matcher:**
  - Removed duplicated builder tests.
- Removed the 7 matcher "security" tests that still passed with
normalization disabled; JVM tests that fail without it replace them.
- **Protocol and transports:**
  - Removed duplicated state-machine tests.
- Removed the client lifecycle suite, which re-tested
`AbstractClientTransport` for three transports.
  - The `terminateSession` tests now actually send a DELETE.
- **integration-test:**
- The registry CRUD and `list_changed` suites were copied per feature
type; they are now parameterized t

**File**: `buildSrc/src/main/kotlin/mcp.multiplatform.gradle.kts` (modified, +0/-2)
```diff
@@ -34,8 +34,6 @@ kotlin {
 
             useJUnitPlatform()
 
-            maxParallelForks = Runtime.getRuntime().availableProcessors()
-            forkEvery = 100
             testLogging {
                 exceptionFormat = TestExceptionFormat.SHORT
                 events("failed")
```

**File**: `buildSrc/src/main/kotlin/netty-convention.gradle.kts` (removed, +0/-61)
```diff
@@ -1,61 +0,0 @@
-import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
-
-/**
- * Netty convention plugin that adds platform-specific Netty native transport libraries
- * to the jvmTest source set. This is similar to how Maven handles OS-specific dependencies
- * with profile activation.
- *
- * This plugin should be applied to any module that uses Netty for testing.
- */
-val nettyVersion = "4.2.7.Final"
-plugins {
-    id("org.gradle.base")
-}
-
-// This plugin is applied to projects that already have the kotlin multiplatform plugin applied
-// It adds the Netty native transport libraries to the jvmTest source set
-
-afterEvaluate {
-
-    extensions.findByType<KotlinMultiplatformExtension>()?.apply {
-        sourceSets.findByName("jvmTest")?.apply {
-            dependencies {
-                // Netty native transport libraries for different platforms
-                val osName = System.getProperty("os.name").lowercase()
-                val osArch = System.getProperty("os.arch").lowercase()
-
-                // Add the base Netty platform
-                implementation(project.dependencies.platform("io.netty:netty-bom:$nettyVersion"))
-
-                when {
-                    osName.contains("linux") -> {
-                        val archClassifier =
-                            if (osArch.contains("aarch64")) {
-                                "linux-aarch_64"
-                            } else {
-                                "linux-x86_64"
-                            }
-                        runtimeOnly(
-                            "io.netty:netty-transport-native-epoll:$nettyVersion:$archClassifier",
-                        )
-                    }
-
-                    osName.contains("mac") -> {
-                        val archClassifier =
-                            if (osArch.contains("aarch64")) {
-                                "osx-aarch_64"
-                            } else {
-                                "osx-x86_64"
-                            }
-                        runtimeOnly(
-                            "io.netty:netty-transport-native-kqueue:$nettyVersion:$archClassifier",
-                        )
-                        runtimeOnly(
-                            "io.netty:netty-resolver-dns-native-macos:$nettyVersion:$archClassifier",
-                        )
-                    }
-                }
-            }
-        }
-    }
-}
```

**File**: `gradle/libs.versions.toml` (modified, +0/-3)
```diff
@@ -8,7 +8,6 @@ kover = "0.9.9"
 ktlint = "14.2.0"
 knit = "0.5.1"
 mavenPublish = "0.37.0"
-netty = "4.2.18.Final"
 
 # libraries version
 awaitility = "4.3.0"
@@ -41,7 +40,6 @@ kotlinx-io-core = { group = "org.jetbrains.kotlinx", name = "kotlinx-io-core", v
 kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
 
 # Ktor
-ktor-client-apache5 = { group = "io.ktor", name = "ktor-client-apache5", version.ref = "ktor" }
 ktor-client-auth = { group = "io.ktor", name = "ktor-client-auth", version.ref = "ktor" }
 ktor-client-core = { group = "io.ktor", name = "ktor-client-core", version.ref = "ktor" }
 ktor-client-logging = { group = "io.ktor", name = "ktor-client-logging", version.ref = "ktor" }
@@ -62,7 +60,6 @@ kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-cor
 ktor-client-mock = { group = "io.ktor", name = "ktor-client-mock", version.ref = "ktor" }
 ktor-server-test-host = { group = "io.ktor", name = "ktor-server-test-host", version.ref = "ktor" }
 mockk = { module = "io.mockk:mockk", version.ref = "mockk" }
-netty-bom = { group = "io.netty", name = "netty-bom", version.ref = "netty" }
 slf4j-simple = { group = "org.slf4j", name = "slf4j-simple", version.ref = "slf4j" }
 junit-jupiter-params = { module = "org.junit.jupiter:junit-jupiter-params", version.ref = "junit" }
 
```

**File**: `integration-test/build.gradle.kts` (modified, +0/-2)
```diff
@@ -25,8 +25,6 @@ kotlin {
                 implementation(libs.ktor.server.websockets)
                 implementation(libs.ktor.server.auth)
                 implementation(libs.ktor.server.test.host)
-                implementation(libs.ktor.server.content.negotiation)
-                implementation(libs.ktor.serialization)
             }
         }
         jvmTest {
```

**File**: `integration-test/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/client/ClientTest.kt` (modified, +250/-1372)
```diff
@@ -1,6 +1,14 @@
 package io.modelcontextprotocol.kotlin.sdk.client
 
+import io.kotest.assertions.throwables.shouldThrow
+import io.kotest.assertions.throwables.shouldThrowAny
+import io.kotest.assertions.withClue
+import io.kotest.matchers.collections.shouldBeEmpty
+import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
 import io.kotest.matchers.shouldBe
+import io.kotest.matchers.string.shouldContain
+import io.kotest.matchers.string.shouldStartWith
+import io.kotest.matchers.types.shouldBeInstanceOf
 import io.modelcontextprotocol.kotlin.sdk.server.Server
 import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
 import io.modelcontextprotocol.kotlin.sdk.server.ServerSession
@@ -12,27 +20,22 @@ import io.modelcontextprotocol.kotlin.sdk.types.ClientCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.CreateMessageRequest
 import io.modelcontextprotocol.kotlin.sdk.types.CreateMessageResult
 import io.modelcontextprotocol.kotlin.sdk.types.DoubleSchema
+import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequest
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequestFormParams
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequestParams
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequestURLParams
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitResult
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitationCompleteNotification
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitationCompleteNotificationParams
 import io.modelcontextprotocol.kotlin.sdk.types.EmptyJsonObject
+import io.modelcontextprotocol.kotlin.sdk.types.EnumOption
 import io.modelcontextprotocol.kotlin.sdk.types.Implementation
-import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequest
 import io.modelcontextprotocol.kotlin.sdk.types.InitializeResult
 import io.modelcontextprotocol.kotlin.sdk.types.IntegerSchema
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
-import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCNotification
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCResponse
-import io.modelcontextprotocol.kotlin.sdk.types.LATEST_PROTOCOL_VERSION
-import io.modelcontextprotocol.kotlin.sdk.types.ListResourcesRequest
-import io.modelcontextprotocol.kotlin.sdk.types.ListResourcesResult
 import io.modelcontextprotocol.kotlin.sdk.types.ListRootsRequest
-import io.modelcontextprotocol.kotlin.sdk.types.ListToolsRequest
-import io.modelcontextprotocol.kotlin.sdk.types.ListToolsResult
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingLevel
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingMessageNotification
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingMessageNotificationParams
@@ -46,1532 +49,407 @@ import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.StringSchema
 import io.modelcontextprotocol.kotlin.sdk.types.TextContent
 import io.modelcontextprotocol.kotlin.sdk.types.TitledMultiSelectEnumSchema
-import io.modelcontextprotocol.kotlin.sdk.types.Tool
-import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
 import io.modelcontextprotocol.kotlin.sdk.types.UntitledMultiSelectEnumSchema
 import io.modelcontextprotocol.kotlin.sdk.types.UntitledSingleSelectEnumSchema
 import io.modelcontextprotocol.kotlin.sdk.types.UrlElicitationRequiredException
 import kotlinx.coroutines.CompletableDeferred
-import kotlinx.coroutines.TimeoutCancellationException
-import kotlinx.coroutines.awaitCancellation
-import kotlinx.coroutines.cancel
-import kotlinx.coroutines.delay
-import kotlinx.coroutines.joinAll
-import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.runTest
-import kotlinx.coroutines.withTimeout
-import kotlinx.serialization.json.JsonObject
+import kotlinx.serialization.SerializationException
 import kotlinx.serialization.json.JsonPrimitive
+import kotlinx.serialization.json.add
 import kotlinx.serializat
```

---

### Incident Patch 2: `ad650390` (2026-09-29)
**Commit Message**: fix: reject cross-origin endpoint events in SSE client (#958)

In the HTTP+SSE transport, the server's `endpoint` event tells the
client where to POST subsequent JSON-RPC messages. The client currently
accepts a full `http(s)://` URL as-is, so a compromised server could
redirect all subsequent traffic — including auth headers — to an
attacker-controlled host. The TypeScript and Python clients already
reject endpoints whose origin differs from the connection origin.

This change rejects full-URL endpoints whose origin (scheme, host, and
port, with default ports normalized) does not match the SSE connection's
origin: the endpoint future completes exceptionally and the transport
fails to start. Relative and root-relative paths keep their existing
resolution, and same-origin full URLs keep their existing behavior.

---------

Signed-off-by: meraklbz <lbz2770828522@gmail.com>
Co-authored-by: devcrocod <devcrocod@gmail.com>

**File**: `kotlin-sdk-client/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/client/SseClientTransport.kt` (modified, +37/-2)
```diff
@@ -11,7 +11,9 @@ import io.ktor.client.request.setBody
 import io.ktor.client.statement.bodyAsText
 import io.ktor.http.ContentType
 import io.ktor.http.HttpHeaders
+import io.ktor.http.Url
 import io.ktor.http.append
+import io.ktor.http.hostWithPortIfSpecified
 import io.ktor.http.isSuccess
 import io.ktor.http.protocolWithAuthority
 import io.modelcontextprotocol.kotlin.sdk.shared.AbstractClientTransport
@@ -80,6 +82,18 @@ public class SseClientTransport(
             reconnectionTime = reconnectionTime,
             block = requestBuilder,
         )
+
+        // Endpoints are validated against the origin of the SSE request, so that request must not
+        // have been redirected away from the origin the transport was configured with.
+        val requestedUrl = urlString?.let { Url(it) }?.takeIf { it.host.isNotEmpty() }
+        val connectionUrl = session.call.request.url
+        if (requestedUrl != null) {
+            check(requestedUrl.hasSameOrigin(connectionUrl)) {
+                "SSE request to ${requestedUrl.safeOrigin} was redirected to a different origin " +
+                    connectionUrl.safeOrigin
+            }
+        }
+
         scope = CoroutineScope(session.coroutineContext + SupervisorJob())
 
         job = scope.launch(CoroutineName("SseMcpClientTransport.connect#${hashCode()}")) {
@@ -142,12 +156,22 @@ public class SseClientTransport(
 
     /**
      * Resolves and completes [endpoint] based on [eventData].
-     * Uses full URLs as-is, treats absolute paths as origin-relative,
-     * and relative paths as relative to [baseUrl].
+     * Uses full URLs as-is, but rejects those whose origin differs from the SSE connection origin,
+     * treats absolute paths as origin-relative, and relative paths as relative to [baseUrl].
      */
     private fun handleEndpoint(eventData: String) {
         try {
             val endpointUrl = if (eventData.startsWith("http://") || eventData.startsWith("https://")) {
+                val url = Url(eventData)
+                val connectionUrl = session.call.request.url
+                if (!url.hasSameOrigin(connectionUrl)) {
+                    val error = IllegalArgumentException(
+                        "Endpoint origin ${url.safeOrigin} does not match connection origin ${connectionUrl.safeOrigin}",
+                    )
+                    _onError(error)
+                    endpoint.completeExceptionally(error)
+                    return
+                }
                 eventData
             } else if (eventData.startsWith("/")) {
                 origin + eventData
@@ -189,3 +213,14 @@ public class SseClientTransport(
         }
     }
 }
+
+/**
+ * Compares origins as scheme, host (case-insensitive) and effective port, so an explicit default port
+ * matches an omitted one. User info is not part of the origin.
+ */
+private fun Url.hasSameOrigin(other: Url): Boolean =
+    protocol.name == other.protocol.name && host.equals(other.host, ignoreCase = true) && port == other.port
+
+/** Scheme, host and non-default port, without user info, so it is safe to put into error messages. */
+private val Url.safeOrigin: String
+    get() = "${protocol.name}://$hostWithPortIfSpecified"
```

**File**: `kotlin-sdk-client/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/client/sse/SseClientTransportTest.kt` (modified, +156/-6)
```diff
@@ -6,10 +6,20 @@ import io.kotest.matchers.shouldBe
 import io.ktor.client.HttpClient
 import io.ktor.client.plugins.sse.SSE
 import io.ktor.client.request.HttpRequestData
+import io.ktor.client.request.HttpResponseData
+import io.ktor.http.HttpHeaders
+import io.ktor.http.HttpMethod
+import io.ktor.http.HttpProtocolVersion
+import io.ktor.http.HttpStatusCode
+import io.ktor.http.headersOf
+import io.ktor.util.date.GMTDate
+import io.ktor.utils.io.ByteReadChannel
 import io.modelcontextprotocol.kotlin.sdk.client.SseClientTransport
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCNotification
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.test.runTest
 import kotlin.test.Test
+import kotlin.test.assertFailsWith
 import kotlin.time.Duration.Companion.seconds
 
 class SseClientTransportTest {
@@ -67,15 +77,107 @@ class SseClientTransportTest {
     }
 
     @Test
-    fun `full url endpoint is used as-is`() = runTest {
+    fun `full url endpoint with a different host is rejected without exposing credentials`() = runTest {
+        val exception = startWithRejectedEndpoint(
+            sseUrl = "http://user:secret@example.com/api/mcp/sse",
+            endpointEvent = "http://evil.example.com/messages?sessionId=abc",
+        )
+
+        exception.message shouldBe
+            "Endpoint origin http://evil.example.com does not match connection origin http://example.com"
+    }
+
+    @Test
+    fun `full url endpoint with a different port is rejected`() = runTest {
+        val exception = startWithRejectedEndpoint(
+            sseUrl = "http://example.com/api/mcp/sse",
+            endpointEvent = "http://example.com:8080/messages?sessionId=abc",
+        )
+
+        exception.message shouldBe
+            "Endpoint origin http://example.com:8080 does not match connection origin http://example.com"
+    }
+
+    @Test
+    fun `full url endpoint with a different scheme is rejected`() = runTest {
+        // Same explicit port on both sides, so only the scheme differs
+        val exception = startWithRejectedEndpoint(
+            sseUrl = "http://example.com:8080/api/mcp/sse",
+            endpointEvent = "https://example.com:8080/messages?sessionId=abc",
+        )
+
+        exception.message shouldBe
+            "Endpoint origin https://example.com:8080 does not match connection origin http://example.com:8080"
+    }
+
+    @Test
+    fun `full url endpoint with the same origin is used as-is regardless of connection credentials`() = runTest {
+        val post = sendThroughEndpoint(
+            sseUrl = "http://user:secret@example.com/api/mcp/sse",
+            endpointEvent = "http://example.com/messages?sessionId=abc",
+        )
+
+        post.url.toString() shouldBe "http://example.com/messages?sessionId=abc"
+    }
+
+    @Test
+    fun `full url endpoint with an explicit default port is accepted`() = runTest {
+        val post = sendThroughEndpoint(
+            sseUrl = "http://example.com/api/mcp/sse",
+            endpointEvent = "http://example.com:80/messages?sessionId=abc",
+        )
+
+        post.url.host shouldBe "example.com"
+        post.url.port shouldBe 80
+    }
+
+    @Test
+    fun `full url endpoint host is compared case-insensitively`() = runTest {
+        val post = sendThroughEndpoint(
+            sseUrl = "http://example.com/api/mcp/sse",
+            endpointEvent = "http://EXAMPLE.com/messages?sessionId=abc",
+        )
+
+        post.url.toString() shouldBe "http://EXAMPLE.com/messages?sessionId=abc"
+    }
+
+    @Test
+    fun `sse request redirected to a different origin is rejected`() = runTest {
         // Given
         val sseUrl = "http://example.com/api/mcp/sse"
 
         // And
-        val endpointEvent = "https://example.com/messages?sessionId=abc"
+        val engine = CapturingSseClientEngine(
+            endpoint = "/messages?sessionId=abc",
+            sseRedirectLocation = "http://evil.example.com/sse",
+        )
+        val transport = sseT
```

---

### Incident Patch 3: `7a841058` (2026-09-28)
**Commit Message**: test: fix flaky ChannelTransportTest (#1028)

`send to closed channel triggers error` waited for the onError callback
with `eventually(2.seconds)`. Kotest's `eventually` measures wall-clock
time even inside `runTest`, so when the test thread stalled on a loaded
CI runner the 2s window ran out before the first attempt ("attempted 0
time(s)").

The wait was never needed: `send()` invokes onError synchronously before
throwing. Assert directly, use `shouldThrow<McpException>` so the test
fails if `send()` stops throwing, and drop the same redundant
`eventually` from `secondary constructor uses single channel`.

## Types of changes
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update

## Checklist
- [x] I have read the [MCP
Documentation](https://modelcontextprotocol.io)
- [x] My code follows the repository's style guidelines
- [x] New and existing tests pass locally
- [x] I have added appropriate error handling
- [x] I have added or updated documentation as needed

**File**: `kotlin-sdk-testing/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/testing/ChannelTransportTest.kt` (modified, +9/-17)
```diff
@@ -1,12 +1,13 @@
 package io.modelcontextprotocol.kotlin.sdk.testing
 
-import io.kotest.assertions.nondeterministic.eventually
+import io.kotest.assertions.throwables.shouldThrow
 import io.kotest.matchers.collections.shouldContainExactly
 import io.kotest.matchers.shouldBe
 import io.kotest.matchers.types.shouldBeInstanceOf
 import io.modelcontextprotocol.kotlin.sdk.ExperimentalMcpApi
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
+import io.modelcontextprotocol.kotlin.sdk.types.McpException
 import io.modelcontextprotocol.kotlin.sdk.types.RequestId
 import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.cancelAndJoin
@@ -15,7 +16,6 @@ import kotlinx.coroutines.channels.ClosedSendChannelException
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.runTest
 import kotlin.test.Test
-import kotlin.time.Duration.Companion.seconds
 
 @OptIn(ExperimentalMcpApi::class)
 class ChannelTransportTest {
@@ -141,9 +141,7 @@ class ChannelTransportTest {
         transport.send(message)
         messageProcessed.await()
 
-        eventually(2.seconds) {
-            received.shouldContainExactly(message)
-        }
+        received.shouldContainExactly(message)
     }
 
     @Test
@@ -153,23 +151,17 @@ class ChannelTransportTest {
 
         transport.start()
 
-        var errorCaught = false
-        transport.onError {
-            it.shouldBeInstanceOf<ClosedSendChannelException>()
-            errorCaught = true
-        }
+        var reportedError: Throwable? = null
+        transport.onError { reportedError = it }
         sendChannel.close()
 
-        try {
+        // send() wraps ClosedSendChannelException in McpException
+        shouldThrow<McpException> {
             transport.send(JSONRPCRequest(RequestId.NumberId(1), "method"))
-        } catch (e: Exception) {
-            // send() wraps ClosedSendChannelException in McpException
-            e.shouldBeInstanceOf<io.modelcontextprotocol.kotlin.sdk.types.McpException>()
         }
 
-        eventually(2.seconds) {
-            errorCaught shouldBe true
-        }
+        // send() reports the failure to onError before throwing, so there is nothing to wait for
+        reportedError.shouldBeInstanceOf<ClosedSendChannelException>()
     }
 
     @Test
```

---

### Incident Patch 4: `7df3af2b` (2026-09-22)
**Commit Message**: fix(core): stop reporting cancellation as an error (#998)

`CancellationException` no longer reaches `onError` callbacks or the
log.

## Breaking Changes
None

## Types of changes
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update

## Checklist
- [x] I have read the [MCP
Documentation](https://modelcontextprotocol.io)
- [x] My code follows the repository's style guidelines
- [x] New and existing tests pass locally
- [x] I have added appropriate error handling
- [x] I have added or updated documentation as needed

**File**: `kotlin-sdk-client/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/client/Client.kt` (modified, +3/-1)
```diff
@@ -225,7 +225,9 @@ public open class Client(private val clientInfo: Implementation, options: Client
             notification(InitializedNotification())
             enableConcurrentDispatch()
         } catch (error: Throwable) {
-            logger.error(error) { "Failed to initialize client: ${error.message}" }
+            if (error !is CancellationException) {
+                logger.error(error) { "Failed to initialize client: ${error.message}" }
+            }
             close()
 
             when (error) {
```

**File**: `kotlin-sdk-client/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/client/SseClientTransport.kt` (modified, +4/-0)
```diff
@@ -156,6 +156,8 @@ public class SseClientTransport(
             }
             endpoint.complete(endpointUrl)
             logger.debug { "Client connected to endpoint: $endpointUrl" }
+        } catch (e: CancellationException) {
+            throw e
         } catch (e: Throwable) {
             _onError(e)
             endpoint.completeExceptionally(e)
@@ -179,6 +181,8 @@ public class SseClientTransport(
                 if (::session.isInitialized) session.cancel()
                 if (::scope.isInitialized) scope.cancel()
                 endpoint.cancel()
+            } catch (e: CancellationException) {
+                throw e
             } catch (e: Throwable) {
                 _onError(e)
             }
```

**File**: `kotlin-sdk-client/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/client/StdioClientTransport.kt` (modified, +7/-9)
```diff
@@ -179,11 +179,9 @@ public class StdioClientTransport @JvmOverloads public constructor(
                                 val errorSeverity = classifyStderr(event.message)
                                 when (errorSeverity) {
                                     FATAL -> {
-                                        runCatching {
-                                            _onError(
-                                                McpException(INTERNAL_ERROR, "Message in StdErr: ${event.message}"),
-                                            )
-                                        }
+                                        invokeOnErrorCallback(
+                                            McpException(INTERNAL_ERROR, "Message in StdErr: ${event.message}"),
+                                        )
                                         stopProcessing("Fatal STDERR message received")
                                     }
 
@@ -212,7 +210,7 @@ public class StdioClientTransport @JvmOverloads public constructor(
                             }
 
                             is Event.IOErrorEvent -> {
-                                runCatching { _onError(event.cause) }
+                                invokeOnErrorCallback(event.cause)
                                 stopProcessing("IO Error", event.cause)
                             }
                         }
@@ -265,11 +263,11 @@ public class StdioClientTransport @JvmOverloads public constructor(
             sink.flush()
         } catch (e: SerializationException) {
             logger.warn(e) { "Can't serialize message" }
-            runCatching { _onError(McpException(INTERNAL_ERROR, "Serialization error")) }
+            invokeOnErrorCallback(McpException(INTERNAL_ERROR, "Serialization error"))
             mainScope.stopProcessing("Can't serialize message", e)
         } catch (e: IOException) {
             logger.warn(e) { "Can't send message" }
-            runCatching { _onError(McpException(CONNECTION_CLOSED, "Can't send message. Connection closed")) }
+            invokeOnErrorCallback(McpException(CONNECTION_CLOSED, "Can't send message. Connection closed"))
             mainScope.stopProcessing("Write I/O failed", e)
         }
     }
@@ -281,7 +279,7 @@ public class StdioClientTransport @JvmOverloads public constructor(
             throw e
         } catch (e: Throwable) {
             logger.error(e) { "Error processing message." }
-            runCatching { _onError.invoke(e) }
+            invokeOnErrorCallback(e)
         }
     }
 
```

**File**: `kotlin-sdk-core/api/kotlin-sdk-core.api` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ public abstract class io/modelcontextprotocol/kotlin/sdk/shared/AbstractTranspor
 	protected final fun get_onError ()Lkotlin/jvm/functions/Function1;
 	protected final fun get_onMessage ()Lkotlin/jvm/functions/Function2;
 	protected final fun invokeOnCloseCallback ()V
+	protected final fun invokeOnErrorCallback (Ljava/lang/Throwable;)V
 	public fun onClose (Lkotlin/jvm/functions/Function0;)V
 	public fun onError (Lkotlin/jvm/functions/Function1;)V
 	public fun onMessage (Lkotlin/jvm/functions/Function2;)V
```

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/AbstractTransport.kt` (modified, +10/-1)
```diff
@@ -1,6 +1,7 @@
 package io.modelcontextprotocol.kotlin.sdk.shared
 
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
+import io.modelcontextprotocol.kotlin.sdk.utils.runCatchingCancellable
 import kotlinx.coroutines.CompletableDeferred
 import kotlin.concurrent.atomics.AtomicBoolean
 import kotlin.concurrent.atomics.ExperimentalAtomicApi
@@ -67,7 +68,15 @@ public abstract class AbstractTransport : Transport {
      */
     protected fun invokeOnCloseCallback() {
         if (onCloseCalled.compareAndSet(expectedValue = false, newValue = true)) {
-            runCatching { _onClose() }
+            runCatchingCancellable { _onClose() }
         }
     }
+
+    /**
+     * Reports [error] through the `_onError` callback, swallowing any [Throwable] the callback
+     * raises. A [kotlin.coroutines.cancellation.CancellationException] propagates instead.
+     */
+    protected fun invokeOnErrorCallback(error: Throwable) {
+        runCatchingCancellable { _onError(error) }
+    }
 }
```

---

### Incident Patch 5: `b7047e77` (2026-09-09)
**Commit Message**: fix(server): return INVALID_PARAMS for unknown prompt in prompts/get (#955)

## Problem

`prompts/get` for a name that is not registered responds with JSON-RPC
`-32603` (INTERNAL_ERROR).

`handleGetPrompt` in `Server.kt` throws a bare
`IllegalArgumentException` when the prompt is missing.
`Protocol.respondWithError` maps any non-`McpException` cause to
`INTERNAL_ERROR`, so the client receives `-32603` for what is a
client-side bad parameter.

The sibling handler `handleReadResource` in the same file already throws
a typed `McpException(RESOURCE_NOT_FOUND)` for the equivalent not-found
case, which reaches the client as `-32002`. The two not-found paths are
inconsistent.

In JSON-RPC, `-32603` means the server hit an internal fault. Requesting
a prompt name that does not exist is a client error (an invalid `name`
parameter), so a client cannot tell "the prompt does not exist" apart
from "the server failed" and may retry a request that can never succeed.

## Change

Throw a typed `McpException(INVALID_PARAMS)` from `handleGetPrompt`,
consistent with `handleReadResource`. The message is unchanged.

`AbstractPromptIntegrationTest.testNonExistentPrompt` asserted `-32603`;
it now asserts 

**File**: `integration-test/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/integration/kotlin/AbstractPromptIntegrationTest.kt` (modified, +2/-2)
```diff
@@ -698,8 +698,8 @@ abstract class AbstractPromptIntegrationTest : KotlinTestBase() {
 
         val expectedMessage = "Prompt not found: non-existent-prompt"
 
-        withClue("Exception code should be INTERNAL_ERROR: -32603") {
-            exception.code shouldBe -32603
+        withClue("Exception code should be INVALID_PARAMS: ${RPCError.ErrorCode.INVALID_PARAMS}") {
+            exception.code shouldBe RPCError.ErrorCode.INVALID_PARAMS
         }
         withClue("Unexpected error message for non-existent prompt") {
             exception.message shouldBe expectedMessage
```

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/Server.kt` (modified, +4/-1)
```diff
@@ -682,7 +682,10 @@ public open class Server(
         val prompt = promptRegistry.get(requestParams.name)
             ?: run {
                 logger.error { "Prompt not found: ${requestParams.name}" }
-                throw IllegalArgumentException("Prompt not found: ${requestParams.name}")
+                throw McpException(
+                    code = RPCError.ErrorCode.INVALID_PARAMS,
+                    message = "Prompt not found: ${requestParams.name}",
+                )
             }
         return prompt.run {
             session.clientConnection.messageProvider(request)
```

---

### Incident Patch 6: `dab340f9` (2026-07-28)
**Commit Message**: fix(server): drop inert eventStore from stateless Streamable HTTP (#909)

Removes the `eventStore` parameter from `mcpStatelessStreamableHttp`,
where it was never read or written.

closes #908 

## Breaking Changes
Source-breaking only

## Types of changes
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update

## Checklist
- [x] I have read the [MCP
Documentation](https://modelcontextprotocol.io)
- [x] My code follows the repository's style guidelines
- [x] New and existing tests pass locally
- [x] I have added appropriate error handling
- [x] I have added or updated documentation as needed

**File**: `kotlin-sdk-server/api/kotlin-sdk-server.api` (modified, +2/-0)
```diff
@@ -58,7 +58,9 @@ public final class io/modelcontextprotocol/kotlin/sdk/server/KtorServerKt {
 	public static synthetic fun mcp$default (Lio/ktor/server/routing/Route;Ljava/lang/String;ZLjava/util/List;Ljava/util/List;JLkotlin/jvm/functions/Function1;ILjava/lang/Object;)V
 	public static synthetic fun mcp$default (Lio/ktor/server/routing/Route;ZLjava/util/List;Ljava/util/List;JLkotlin/jvm/functions/Function1;ILjava/lang/Object;)V
 	public static final fun mcpStatelessStreamableHttp (Lio/ktor/server/application/Application;Ljava/lang/String;ZLjava/util/List;Ljava/util/List;Lio/modelcontextprotocol/kotlin/sdk/server/EventStore;Lkotlin/jvm/functions/Function1;)V
+	public static final fun mcpStatelessStreamableHttp (Lio/ktor/server/application/Application;Ljava/lang/String;ZLjava/util/List;Ljava/util/List;Lkotlin/jvm/functions/Function1;)V
 	public static synthetic fun mcpStatelessStreamableHttp$default (Lio/ktor/server/application/Application;Ljava/lang/String;ZLjava/util/List;Ljava/util/List;Lio/modelcontextprotocol/kotlin/sdk/server/EventStore;Lkotlin/jvm/functions/Function1;ILjava/lang/Object;)V
+	public static synthetic fun mcpStatelessStreamableHttp$default (Lio/ktor/server/application/Application;Ljava/lang/String;ZLjava/util/List;Ljava/util/List;Lkotlin/jvm/functions/Function1;ILjava/lang/Object;)V
 	public static final fun mcpStreamableHttp (Lio/ktor/server/application/Application;Ljava/lang/String;ZLjava/util/List;Ljava/util/List;Lio/modelcontextprotocol/kotlin/sdk/server/EventStore;Lkotlin/jvm/functions/Function1;Lkotlin/jvm/functions/Function1;)V
 	public static synthetic fun mcpStreamableHttp$default (Lio/ktor/server/application/Application;Ljava/lang/String;ZLjava/util/List;Ljava/util/List;Lio/modelcontextprotocol/kotlin/sdk/server/EventStore;Lkotlin/jvm/functions/Function1;Lkotlin/jvm/functions/Function1;ILjava/lang/Object;)V
 }
```

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/KtorServer.kt` (modified, +33/-6)
```diff
@@ -270,7 +270,6 @@ private fun Application.mcpStatelessStreamableHttp(
     block: RoutingContext.() -> Server,
 ) {
     installMcpContentNegotiation()
-    install(SSE)
 
     routing {
         route(path) {
@@ -297,10 +296,11 @@ private fun Application.mcpStatelessStreamableHttp(
  * over _stateless_ [Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http)
  *
  * Sets up an HTTP POST endpoint at [path]. GET and DELETE requests return 405 Method Not Allowed.
- * Simple request/response pairs are returned as JSON (not SSE streams).
+ * Every request/response pair is returned as JSON, so this endpoint opens no SSE stream and
+ * offers no resumability. Use [mcpStreamableHttp] when either is required.
  *
  * Automatically installs [ContentNegotiation][io.ktor.server.plugins.contentnegotiation.ContentNegotiation]
- * with [McpJson][io.modelcontextprotocol.kotlin.sdk.types.McpJson] and [SSE].
+ * with [McpJson][io.modelcontextprotocol.kotlin.sdk.types.McpJson].
  *
  * @param path The URL path where the server listens for incoming JSON-RPC requests. Defaults to "/mcp".
  * @param enableDnsRebindingProtection Determines whether DNS rebinding protection is enabled. Defaults to `true`.
@@ -309,7 +309,6 @@ private fun Application.mcpStatelessStreamableHttp(
  * @param allowedOrigins A list of allowed `Origin` header values, compared by hostname only
  *      (scheme and port are ignored). Requests without an `Origin` header are allowed.
  *      If `null`, origin validation is disabled.
- * @param eventStore An optional [EventStore] implementation to provide resumability and event replay support.
  * @param block factory block with access to the [RoutingContext] (for reading request headers)
  *          that creates and returns the [Server] to handle the connection.
  */
@@ -319,7 +318,6 @@ public fun Application.mcpStatelessStreamableHttp(
     enableDnsRebindingProtection: Boolean = true,
     allowedHosts: List<String>? = null,
     allowedOrigins: List<String>? = null,
-    eventStore: EventStore? = null,
     block: RoutingContext.() -> Server,
 ) {
     mcpStatelessStreamableHttp(
@@ -328,13 +326,42 @@ public fun Application.mcpStatelessStreamableHttp(
         allowedHosts = allowedHosts,
         allowedOrigins = allowedOrigins,
         configuration = StreamableHttpServerTransport.Configuration(
-            eventStore = eventStore,
             enableJsonResponse = true,
         ),
         block = block,
     )
 }
 
+/**
+ * Retained only so that existing call sites get a migration hint instead of an unresolved parameter name.
+ *
+ * @param eventStore never consulted by a stateless endpoint. Resumption is driven by a `GET` carrying
+ *          `Last-Event-ID`, and this endpoint answers `GET` with `405 Method Not Allowed`, so no stream
+ *          exists to store events on or replay them to. Use [mcpStreamableHttp] when you need resumability.
+ */
+@Deprecated(
+    "Use mcpStatelessStreamableHttp without eventStore.",
+    ReplaceWith("mcpStatelessStreamableHttp(path, enableDnsRebindingProtection, allowedHosts, allowedOrigins, block)"),
+    DeprecationLevel.ERROR,
+)
+@Suppress("UnusedParameter")
+public fun Application.mcpStatelessStreamableHttp(
+    path: String = "/mcp",
+    enableDnsRebindingProtection: Boolean = true,
+    allowedHosts: List<String>? = null,
+    allowedOrigins: List<String>? = null,
+    eventStore: EventStore?,
+    block: RoutingContext.() -> Server,
+) {
+    mcpStatelessStreamableHttp(
+        path = path,
+        enableDnsRebindingProtection = enableDnsRebindingProtection,
+        allowedHosts = allowedHosts,
+        allowedOrigins = allowedOrigins,
+        block = block,
+    )
+}
+
 private suspend fun ServerSSESession.mcpSseEndpoint(
     postEndpoint: String,
     transportManager: TransportManager<SseServerTransport>,
```

---

### Incident Patch 7: `24c3cd3a` (2026-07-28)
**Commit Message**: fix(server): match Accept header as media ranges (#912)

The header is now parsed into media ranges (`parseHeaderValue` +
`ContentType.match`)

## Breaking Changes
none

## Types of changes
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update

## Checklist
- [x] I have read the [MCP
Documentation](https://modelcontextprotocol.io)
- [x] My code follows the repository's style guidelines
- [x] New and existing tests pass locally
- [x] I have added appropriate error handling
- [x] I have added or updated documentation as needed

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpServerTransport.kt` (modified, +20/-2)
```diff
@@ -1,9 +1,11 @@
 package io.modelcontextprotocol.kotlin.sdk.server
 
+import io.ktor.http.BadContentTypeFormatException
 import io.ktor.http.ContentType
 import io.ktor.http.HttpHeaders
 import io.ktor.http.HttpMethod
 import io.ktor.http.HttpStatusCode
+import io.ktor.http.parseHeaderValue
 import io.ktor.server.application.ApplicationCall
 import io.ktor.server.request.contentType
 import io.ktor.server.request.header
@@ -864,8 +866,24 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
         }
     }
 
-    private fun String?.accepts(mime: ContentType): Boolean =
-        this?.lowercase()?.contains(mime.toString().lowercase()) == true
+    /**
+     * Reports whether the `Accept` header admits [mime].
+     *
+     * Comparison is over parsed media ranges rather than raw substrings, so wildcards are honored
+     * and a near miss such as `application/jsonp` no longer passes as `application/json`. An absent
+     * header states no preference and admits any type.
+     */
+    private fun String?.accepts(mime: ContentType): Boolean {
+        if (this == null) return true
+        return parseHeaderValue(this).any { range ->
+            if (range.quality <= 0.0) return@any false
+            try {
+                mime.match(ContentType.parse(range.value))
+            } catch (_: BadContentTypeFormatException) {
+                false
+            }
+        }
+    }
 
     private suspend fun emitOnStream(streamId: String, session: ServerSSESession?, message: JSONRPCMessage) {
         val eventId = configuration.eventStore?.storeEvent(streamId, message)
```

**File**: `kotlin-sdk-server/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpServerTransportTest.kt` (modified, +107/-0)
```diff
@@ -9,6 +9,7 @@ import io.ktor.client.call.body
 import io.ktor.client.plugins.logging.LogLevel
 import io.ktor.client.plugins.logging.Logging
 import io.ktor.client.request.HttpRequestBuilder
+import io.ktor.client.request.get
 import io.ktor.client.request.header
 import io.ktor.client.request.post
 import io.ktor.client.request.prepareGet
@@ -21,6 +22,7 @@ import io.ktor.http.contentType
 import io.ktor.serialization.kotlinx.json.json
 import io.ktor.server.application.ApplicationCall
 import io.ktor.server.application.install
+import io.ktor.server.routing.get
 import io.ktor.server.routing.post
 import io.ktor.server.routing.routing
 import io.ktor.server.sse.ServerSSESession
@@ -76,6 +78,7 @@ import kotlin.test.assertEquals
 import kotlin.test.assertFailsWith
 import kotlin.test.assertFalse
 import kotlin.test.assertNotNull
+import kotlin.test.assertTrue
 import kotlin.time.Duration.Companion.seconds
 import io.ktor.client.plugins.contentnegotiation.ContentNegotiation as ClientContentNegotiation
 import io.ktor.server.plugins.contentnegotiation.ContentNegotiation as ServerContentNegotiation
@@ -100,6 +103,26 @@ class StreamableHttpServerTransportTest {
             Arguments.of(sizeTestPayload.length.toLong(), HttpStatusCode.BadRequest),
             Arguments.of(sizeTestPayload.length.toLong() + 1, HttpStatusCode.BadRequest),
         )
+
+        @JvmStatic
+        fun postAcceptHeaderCases(): List<Arguments> = listOf(
+            Arguments.of("application/json, text/event-stream", HttpStatusCode.OK),
+            Arguments.of("Application/JSON;q=0.9, TEXT/Event-Stream;charset=utf-8", HttpStatusCode.OK),
+            Arguments.of("*/*", HttpStatusCode.OK),
+            Arguments.of("application/*, text/*", HttpStatusCode.OK),
+            Arguments.of(null, HttpStatusCode.OK),
+            Arguments.of("application/json", HttpStatusCode.NotAcceptable),
+            Arguments.of("text/event-stream", HttpStatusCode.NotAcceptable),
+            Arguments.of("application/jsonp, text/event-stream-bogus", HttpStatusCode.NotAcceptable),
+            Arguments.of("application/json, text/event-stream;q=0", HttpStatusCode.NotAcceptable),
+        )
+
+        @JvmStatic
+        fun getAcceptHeaderCases() = listOf(
+            "application/json",
+            "text/event-stream-bogus",
+            "text/event-stream;q=0",
+        )
     }
 
     private val path = "/transport"
@@ -130,6 +153,90 @@ class StreamableHttpServerTransportTest {
         assertFalse(onMessageCalled.get(), "Transport should not deliver messages when headers are invalid")
     }
 
+    @ParameterizedTest
+    @MethodSource("postAcceptHeaderCases")
+    fun `POST Accept header is matched as media ranges`(acceptHeader: String?, expectedStatus: HttpStatusCode) =
+        testApplication {
+            configTestServer()
+
+            // Bare client: the ContentNegotiation plugin would supply an Accept header of its own,
+            // leaving the absent-header case untestable.
+            val client = createClient {}
+
+            val transport = StreamableHttpServerTransport(enableJsonResponse = true)
+            val onMessageCalled = AtomicBoolean(false)
+            transport.onMessage { message ->
+                onMessageCalled.set(true)
+                if (message is JSONRPCRequest) {
+                    transport.send(JSONRPCResponse(message.id, EmptyResult()))
+                }
+            }
+
+            configureTransportEndpoint(transport)
+
+            val response = client.post(path) {
+                contentType(ContentType.Application.Json)
+                acceptHeader?.let { header(HttpHeaders.Accept, it) }
+                setBody(McpJson.encodeToString(JSONRPCMessage.serializer(), buildInitializeRequestPayload()))
+            }
+
+            assertEquals(expectedStatus, response.status)
+            assertEquals(
+                expectedStatus == HttpStatusCode.OK,
+                onMessageCalled.get(),
+            
```

---

### Incident Patch 8: `82fe56e1` (2026-07-27)
**Commit Message**: fix(server): preserve Streamable HTTP response status and body (#911)

Streamable HTTP responses now keep their status when the client accepts
only `text/event-stream`.

## How Has This Been Tested?
New `StreamableHttpResponseDeliveryTest`

## Breaking Changes
None

## Types of changes
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update

## Checklist
- [x] I have read the [MCP
Documentation](https://modelcontextprotocol.io)
- [x] My code follows the repository's style guidelines
- [x] New and existing tests pass locally
- [x] I have added appropriate error handling
- [x] I have added or updated documentation as needed

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/KtorServer.kt` (modified, +13/-10)
```diff
@@ -1,6 +1,7 @@
 package io.modelcontextprotocol.kotlin.sdk.server
 
 import io.github.oshai.kotlinlogging.KotlinLogging
+import io.ktor.http.HttpHeaders
 import io.ktor.http.HttpMethod
 import io.ktor.http.HttpStatusCode
 import io.ktor.server.application.Application
@@ -282,18 +283,10 @@ private fun Application.mcpStatelessStreamableHttp(
                 )
             }
             get {
-                call.reject(
-                    HttpStatusCode.MethodNotAllowed,
-                    RPCError.ErrorCode.CONNECTION_CLOSED,
-                    "Method not allowed.",
-                )
+                call.rejectUnsupportedMethod()
             }
             delete {
-                call.reject(
-                    HttpStatusCode.MethodNotAllowed,
-                    RPCError.ErrorCode.CONNECTION_CLOSED,
-                    "Method not allowed.",
-                )
+                call.rejectUnsupportedMethod()
             }
         }
     }
@@ -419,6 +412,16 @@ private suspend fun RoutingContext.mcpPostEndpoint(transportManager: TransportMa
     logger.trace { "Message handled for sessionId: $sessionId" }
 }
 
+/** A stateless endpoint serves POST only, offering neither an SSE stream to open nor a session to delete. */
+private suspend fun ApplicationCall.rejectUnsupportedMethod() {
+    response.header(HttpHeaders.Allow, HttpMethod.Post.value)
+    reject(
+        HttpStatusCode.MethodNotAllowed,
+        RPCError.ErrorCode.CONNECTION_CLOSED,
+        "Method not allowed.",
+    )
+}
+
 private fun ApplicationRequest.sessionId(): String? = header(MCP_SESSION_ID_HEADER)
 
 private suspend fun existingStreamableTransport(
```

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpServerTransport.kt` (modified, +17/-10)
```diff
@@ -10,7 +10,7 @@ import io.ktor.server.request.header
 import io.ktor.server.request.httpMethod
 import io.ktor.server.response.header
 import io.ktor.server.response.respond
-import io.ktor.server.response.respondNullable
+import io.ktor.server.response.respondText
 import io.ktor.server.sse.ServerSSESession
 import io.ktor.util.collections.ConcurrentMap
 import io.modelcontextprotocol.kotlin.sdk.shared.AbstractTransport
@@ -474,12 +474,13 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
                     )
                     return
                 }
-                if (!validateProtocolVersion(call)) return
+                if (!validateProtocolVersion(call, initializationRequest.id)) return
                 if (messages.size > 1) {
                     call.reject(
                         HttpStatusCode.BadRequest,
                         RPCError.ErrorCode.INVALID_REQUEST,
                         "Invalid Request: Only one initialization request is allowed",
+                        initializationRequest.id,
                     )
                     return
                 }
@@ -491,12 +492,13 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
                     sessionId?.let { onSessionInitialized?.invoke(it) }
                 }
             } else {
-                if (!validateSession(call) || !validateProtocolVersion(call)) return
+                val requestId = messages.filterIsInstance<JSONRPCRequest>().firstOrNull()?.id
+                if (!validateSession(call, requestId) || !validateProtocolVersion(call, requestId)) return
             }
 
             val hasRequest = messages.any { it is JSONRPCRequest }
             if (!hasRequest) {
-                call.respondNullable(status = HttpStatusCode.Accepted, message = null)
+                call.respond(HttpStatusCode.Accepted)
                 messages.forEach { message -> _onMessage(message) }
                 // A cancellation may target a request still awaiting delivery on a JSON-mode POST;
                 // retire it so that POST completes instead of waiting for a response that never comes.
@@ -552,7 +554,7 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
                 if (responses.isEmpty()) {
                     // Every request in this POST was cancelled before producing a response; there is
                     // nothing to return, so acknowledge with 202 rather than an empty JSON body.
-                    call.respondNullable(status = HttpStatusCode.Accepted, message = null)
+                    call.respond(HttpStatusCode.Accepted)
                 } else {
                     call.response.header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                     val payload = if (responses.size == 1) responses.first() else responses
@@ -645,7 +647,7 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
         if (!validateSession(call) || !validateProtocolVersion(call)) return
         sessionId?.let { onSessionClosed?.invoke(it) }
         close()
-        call.respondNullable(status = HttpStatusCode.OK, message = null)
+        call.respond(HttpStatusCode.OK)
     }
 
     /**
@@ -734,14 +736,15 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
         }
     }
 
-    private suspend fun validateSession(call: ApplicationCall): Boolean {
+    private suspend fun validateSession(call: ApplicationCall, id: RequestId? = null): Boolean {
         if (sessionIdGenerator == null) return true
 
         if (!initialized.load()) {
             call.reject(
                 HttpStatusCode.BadRequest,
                 RPCError.ErrorCode.CONNECTION_CLOSED,
                 "Bad Request: Server not initialized",
+                id,
             )
             return false
         }
@@ -753,6 +756,7 @@ public class StreamableHttpServerTransport(p
```

**File**: `kotlin-sdk-server/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpResponseDeliveryTest.kt` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+package io.modelcontextprotocol.kotlin.sdk.server
+
+import io.kotest.matchers.shouldBe
+import io.ktor.client.request.delete
+import io.ktor.client.request.get
+import io.ktor.client.request.header
+import io.ktor.client.request.post
+import io.ktor.client.request.setBody
+import io.ktor.client.statement.HttpResponse
+import io.ktor.client.statement.bodyAsText
+import io.ktor.http.ContentType
+import io.ktor.http.HttpHeaders
+import io.ktor.http.HttpMethod
+import io.ktor.http.HttpStatusCode
+import io.ktor.http.contentType
+import io.ktor.server.testing.testApplication
+import io.modelcontextprotocol.kotlin.sdk.types.Implementation
+import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCError
+import io.modelcontextprotocol.kotlin.sdk.types.McpJson
+import io.modelcontextprotocol.kotlin.sdk.types.RPCError
+import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
+import kotlin.test.Test
+
+/**
+ * A client opening the standalone stream sends `Accept: text/event-stream`, which matches no JSON
+ * converter. Responses rendered through ContentNegotiation used to reach such a client as an empty
+ * 406 with the intended status discarded.
+ */
+class StreamableHttpResponseDeliveryTest {
+
+    private val eventStream = ContentType.Text.EventStream.toString()
+
+    private fun testServer(): Server = Server(
+        Implementation("test-server", "1.0"),
+        ServerOptions(capabilities = ServerCapabilities()),
+    )
+
+    @Test
+    fun `stateless GET is rejected with 405 and advertises POST`() = testApplication {
+        application { mcpStatelessStreamableHttp { testServer() } }
+
+        val response = client.get("/mcp") {
+            header(HttpHeaders.Host, "localhost")
+            header(HttpHeaders.Accept, eventStream)
+        }
+
+        response.assertMethodNotAllowed()
+    }
+
+    @Test
+    fun `stateless DELETE is rejected with 405 and advertises POST`() = testApplication {
+        application { mcpStatelessStreamableHttp { testServer() } }
+
+        val response = client.delete("/mcp") {
+            header(HttpHeaders.Host, "localhost")
+            header(HttpHeaders.Accept, eventStream)
+        }
+
+        response.assertMethodNotAllowed()
+    }
+
+    @Test
+    fun `stateful DELETE for an unknown session returns 404`() = testApplication {
+        application { mcpStreamableHttp { testServer() } }
+
+        val response = client.delete("/mcp") {
+            header(HttpHeaders.Host, "localhost")
+            header(HttpHeaders.Accept, eventStream)
+            header(MCP_SESSION_ID_HEADER, "unknown-session")
+        }
+
+        response.status shouldBe HttpStatusCode.NotFound
+        response.decodeError().error.message shouldBe "Session not found"
+    }
+
+    @Test
+    fun `POST carrying no request is acknowledged with a bodiless 202`() = testApplication {
+        application { mcpStatelessStreamableHttp { testServer() } }
+
+        val response = client.post("/mcp") {
+            header(HttpHeaders.Host, "localhost")
+            header(HttpHeaders.Accept, "${ContentType.Application.Json}, $eventStream")
+            contentType(ContentType.Application.Json)
+            setBody("""{"jsonrpc":"2.0","method":"notifications/initialized"}""")
+        }
+
+        response.status shouldBe HttpStatusCode.Accepted
+        response.bodyAsText() shouldBe ""
+    }
+
+    private suspend fun HttpResponse.assertMethodNotAllowed() {
+        status shouldBe HttpStatusCode.MethodNotAllowed
+        headers[HttpHeaders.Allow] shouldBe HttpMethod.Post.value
+        contentType()?.withoutParameters() shouldBe ContentType.Application.Json
+        decodeError().error.code shouldBe RPCError.ErrorCode.CONNECTION_CLOSED
+    }
+
+    private suspend fun HttpResponse.decodeError(): JSONRPCError = McpJson.decodeFromString(bodyAsText())
+}
```

**File**: `kotlin-sdk-server/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpServerTransportTest.kt` (modified, +62/-1)
```diff
@@ -216,14 +216,16 @@ class StreamableHttpServerTransportTest {
 
         configureTransportEndpoint(transport)
 
+        val payload = buildInitializeRequestPayload()
         val initResponse = client.post(path) {
             addStreamableHeaders()
             header("mcp-protocol-version", "1900-01-01")
-            setBody(buildInitializeRequestPayload())
+            setBody(payload)
         }
 
         initResponse.status shouldBe HttpStatusCode.BadRequest
         initResponse.headers[MCP_SESSION_ID_HEADER] shouldBe null
+        initResponse.body<JSONRPCError>().id shouldBe payload.id
     }
 
     @Test
@@ -297,6 +299,65 @@ class StreamableHttpServerTransportTest {
         }
 
         response.status shouldBe HttpStatusCode.BadRequest
+        response.body<JSONRPCError>().id shouldBe RequestId("test-1")
+    }
+
+    @Test
+    fun `batch with an initialization request echoes the initialize id when rejected`() = testApplication {
+        configTestServer()
+
+        val client = createTestClient()
+
+        val transport = StreamableHttpServerTransport(enableJsonResponse = true)
+        transport.onMessage { }
+
+        configureTransportEndpoint(transport)
+
+        val initPayload = buildInitializeRequestPayload()
+        val response = client.post(path) {
+            addStreamableHeaders()
+            setBody(
+                encodeMessages(
+                    listOf(
+                        initPayload,
+                        JSONRPCRequest(id = RequestId("extra"), method = Method.Defined.ToolsList.value),
+                    ),
+                ),
+            )
+        }
+
+        response.status shouldBe HttpStatusCode.BadRequest
+        val error = response.body<JSONRPCError>()
+        error.error.message shouldBe "Invalid Request: Only one initialization request is allowed"
+        error.id shouldBe initPayload.id
+    }
+
+    @Test
+    fun `non-init request before initialization echoes the request id`() = testApplication {
+        configTestServer()
+
+        val client = createTestClient()
+
+        val transport = StreamableHttpServerTransport(enableJsonResponse = true)
+        transport.onMessage { }
+
+        configureTransportEndpoint(transport)
+
+        val response = client.post(path) {
+            addStreamableHeaders()
+            setBody(
+                encodeMessages(
+                    listOf(
+                        JSONRPCRequest(id = RequestId("before-init"), method = Method.Defined.ToolsList.value),
+                    ),
+                ),
+            )
+        }
+
+        response.status shouldBe HttpStatusCode.BadRequest
+        val error = response.body<JSONRPCError>()
+        error.error.message shouldBe "Bad Request: Server not initialized"
+        error.id shouldBe RequestId("before-init")
     }
 
     @Test
```

---

### Incident Patch 9: `cab669b1` (2026-07-22)
**Commit Message**: fix: classify malformed request params as invalid params (#886)

## Summary

Classify typed request deserialization failures as JSON-RPC `Invalid
Params`
instead of `Internal error`.

Fixes #830.

## Changes

- translate `SerializationException` from typed request decoding to
`-32602`
- return a stable `Invalid params` message without serialization
internals
- cover malformed `initialize` requests through session and Streamable
HTTP paths

## Scope and risk

The catch is limited to request parameter deserialization after the
JSON-RPC
method has been resolved. Envelope parsing, unknown methods, handler
failures,
and successful requests keep their existing behavior.

## Verification

```bash
./gradlew :integration-test:jvmTest --tests 'io.modelcontextprotocol.kotlin.sdk.server.ServerSessionInitializeTest'
./gradlew :kotlin-sdk-server:jvmTest --tests 'io.modelcontextprotocol.kotlin.sdk.server.StreamableHttpServerTransportTest'
./gradlew :kotlin-sdk-core:jvmTest --tests 'io.modelcontextprotocol.kotlin.sdk.shared.ProtocolTest'
./gradlew ktlintCheck apiCheck
```

Co-authored-by: Pavel Gorgulov <devcrocod@gmail.com>

**File**: `integration-test/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/ServerSessionInitializeTest.kt` (modified, +40/-0)
```diff
@@ -7,9 +7,11 @@ import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequest
 import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequestParams
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCError
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
+import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCResponse
 import io.modelcontextprotocol.kotlin.sdk.types.LATEST_PROTOCOL_VERSION
 import io.modelcontextprotocol.kotlin.sdk.types.RPCError
+import io.modelcontextprotocol.kotlin.sdk.types.RequestId
 import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.toJSON
 import kotlinx.coroutines.CompletableDeferred
@@ -18,9 +20,13 @@ import kotlinx.coroutines.joinAll
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.runTest
 import kotlinx.coroutines.withContext
+import kotlinx.serialization.json.buildJsonObject
+import kotlinx.serialization.json.put
+import kotlinx.serialization.json.putJsonObject
 import org.junit.jupiter.api.Test
 import java.util.concurrent.CopyOnWriteArrayList
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 import kotlin.test.assertNotNull
 import kotlin.test.assertNull
 import kotlin.test.assertTrue
@@ -41,6 +47,18 @@ class ServerSessionInitializeTest {
         ),
     )
 
+    private fun createMalformedInitializeRequest(): JSONRPCRequest = JSONRPCRequest(
+        id = RequestId(1),
+        method = "initialize",
+        params = buildJsonObject {
+            putJsonObject("capabilities") {}
+            putJsonObject("clientInfo") {
+                put("name", "repro")
+                put("version", "0.1.0")
+            }
+        },
+    )
+
     @Test
     fun `should handle first initialize request successfully`() = runTest {
         val session = createSession()
@@ -67,6 +85,28 @@ class ServerSessionInitializeTest {
 
     // Both initialize requests arrive before notifications/initialized, in the serial dispatch
     // phase, so processing and response order stay deterministic.
+    @Test
+    fun `should classify malformed initialize params as invalid params`() = runTest {
+        val session = createSession()
+        val (clientTransport, serverTransport) = InMemoryTransport.createLinkedPair()
+
+        val responseDone = CompletableDeferred<JSONRPCError>()
+        clientTransport.onMessage { message ->
+            if (message is JSONRPCError) {
+                responseDone.complete(message)
+            }
+        }
+
+        session.connect(serverTransport)
+        clientTransport.send(createMalformedInitializeRequest())
+
+        val response = responseDone.await()
+        assertEquals(RPCError.ErrorCode.INVALID_PARAMS, response.error.code)
+        assertFalse(response.error.message.contains("kotlinx.serialization"))
+        assertNull(session.clientCapabilities)
+        assertNull(session.clientVersion)
+    }
+
     @Test
     fun `should reject duplicate initialize request`() = runTest {
         val session = createSession()
```

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/Protocol.kt` (modified, +10/-1)
```diff
@@ -48,6 +48,7 @@ import kotlinx.coroutines.sync.Semaphore
 import kotlinx.coroutines.sync.withPermit
 import kotlinx.coroutines.withContext
 import kotlinx.coroutines.withTimeoutOrNull
+import kotlinx.serialization.SerializationException
 import kotlinx.serialization.json.JsonObject
 import kotlinx.serialization.json.JsonPrimitive
 import kotlinx.serialization.json.encodeToJsonElement
@@ -941,7 +942,15 @@ public abstract class Protocol(@PublishedApi internal val options: ProtocolOptio
 
         _requestHandlers.update { current ->
             current.putting(method.value) { jSONRPCRequest, extraHandler ->
-                val request = jSONRPCRequest.fromJSON()
+                val request = try {
+                    jSONRPCRequest.fromJSON()
+                } catch (cause: SerializationException) {
+                    throw McpException(
+                        code = RPCError.ErrorCode.INVALID_PARAMS,
+                        message = "Invalid params",
+                        cause = cause,
+                    )
+                }
                 val response = wrapped(request as T, extraHandler)
                 response
             }
```

**File**: `kotlin-sdk-server/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpServerTransportTest.kt` (modified, +31/-0)
```diff
@@ -47,6 +47,7 @@ import io.modelcontextprotocol.kotlin.sdk.types.ListResourcesResult
 import io.modelcontextprotocol.kotlin.sdk.types.ListToolsResult
 import io.modelcontextprotocol.kotlin.sdk.types.McpJson
 import io.modelcontextprotocol.kotlin.sdk.types.Method
+import io.modelcontextprotocol.kotlin.sdk.types.RPCError
 import io.modelcontextprotocol.kotlin.sdk.types.RequestId
 import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.Tool
@@ -225,6 +226,36 @@ class StreamableHttpServerTransportTest {
         initResponse.headers[MCP_SESSION_ID_HEADER] shouldBe null
     }
 
+    @Test
+    fun `malformed initialize params return invalid params over streamable http`() = testApplication {
+        val mcpPath = "/mcp"
+
+        application {
+            mcpStreamableHttp(mcpPath, enableDnsRebindingProtection = false) {
+                Server(
+                    Implementation("test-server", "1.0.0"),
+                    ServerOptions(capabilities = ServerCapabilities()),
+                )
+            }
+        }
+
+        val client = createTestClient()
+
+        val response = client.post(mcpPath) {
+            addStreamableHeaders()
+            setBody(
+                """
+                {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"repro","version":"0.1.0"}}}
+                """.trimIndent(),
+            )
+        }
+
+        response.status shouldBe HttpStatusCode.OK
+        val error = response.body<JSONRPCError>()
+        error.error.code shouldBe RPCError.ErrorCode.INVALID_PARAMS
+        error.error.message.contains("kotlinx.serialization") shouldBe false
+    }
+
     @Test
     fun `request with unsupported protocol version returns an HTTP error`() = testApplication {
         configTestServer()
```

---

### Incident Patch 10: `b6cb547d` (2026-07-22)
**Commit Message**: fix(server): preserve id on duplicate initialize errors (#868)

## Summary

Fixes #866.

## Changes

- Preserve the parsed JSON-RPC request id when Streamable HTTP rejects a
duplicate `initialize` request.
- Keep pre-parse and transport-level rejection paths unchanged when the
request id is not available.
- Extend the duplicate-initialize regression test to assert the error
response id as well as the HTTP status.

## Verification

```bash
./gradlew :kotlin-sdk-server:jvmTest --tests 'io.modelcontextprotocol.kotlin.sdk.server.StreamableHttpServerTransportTest.second initialization request returns JSON-RPC error with request id'
./gradlew :kotlin-sdk-server:jvmTest --tests 'io.modelcontextprotocol.kotlin.sdk.server.StreamableHttpServerTransportTest'
./gradlew :kotlin-sdk-server:jvmTest
./gradlew :kotlin-sdk-server:ktlintCheck :kotlin-sdk-server:detekt
```

Co-authored-by: Pavel Gorgulov <devcrocod@gmail.com>

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpServerTransport.kt` (modified, +12/-6)
```diff
@@ -459,16 +459,18 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
             }
 
             val messages = parseBody(call) ?: return
-            val isInitializationRequest = messages.any {
-                it is JSONRPCRequest && it.method == Method.Defined.Initialize.value
+            val initializationRequest = messages.filterIsInstance<JSONRPCRequest>().firstOrNull {
+                it.method == Method.Defined.Initialize.value
             }
+            val isInitializationRequest = initializationRequest != null
 
             if (isInitializationRequest) {
                 if (initialized.load() && sessionId != null) {
                     call.reject(
                         HttpStatusCode.BadRequest,
                         RPCError.ErrorCode.INVALID_REQUEST,
                         "Invalid Request: Server already initialized",
+                        initializationRequest.id,
                     )
                     return
                 }
@@ -506,8 +508,7 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
             // For initialize requests, get from request params.
             // For other requests, get from header (already validated).
             val clientProtocolVersion = if (isInitializationRequest) {
-                val initRequest = messages.first() as JSONRPCRequest
-                (initRequest.params as? JsonObject)?.get("protocolVersion")
+                (initializationRequest.params as? JsonObject)?.get("protocolVersion")
                     ?.let { McpJson.decodeFromJsonElement<String>(it) }
                     ?: DEFAULT_NEGOTIATED_PROTOCOL_VERSION
             } else {
@@ -913,7 +914,12 @@ public class StreamableHttpServerTransport(private val configuration: Configurat
     }
 }
 
-internal suspend fun ApplicationCall.reject(status: HttpStatusCode, code: Int, message: String) {
+internal suspend fun ApplicationCall.reject(
+    status: HttpStatusCode,
+    code: Int,
+    message: String,
+    id: RequestId? = null,
+) {
     this.response.status(status)
-    this.respond(JSONRPCError(id = null, error = RPCError(code = code, message = message)))
+    this.respond(JSONRPCError(id = id, error = RPCError(code = code, message = message)))
 }
```

**File**: `kotlin-sdk-server/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StreamableHttpServerTransportTest.kt` (modified, +7/-2)
```diff
@@ -38,6 +38,7 @@ import io.modelcontextprotocol.kotlin.sdk.types.Implementation
 import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequest
 import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequestParams
 import io.modelcontextprotocol.kotlin.sdk.types.InitializedNotification
+import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCError
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCResponse
@@ -163,7 +164,7 @@ class StreamableHttpServerTransportTest {
     }
 
     @Test
-    fun `second initialization request returns an HTTP error`() = testApplication {
+    fun `second initialization request returns JSON-RPC error with request id`() = testApplication {
         configTestServer()
 
         val client = createTestClient()
@@ -186,13 +187,17 @@ class StreamableHttpServerTransportTest {
 
         firstResponse.status shouldBe HttpStatusCode.OK
 
+        val secondRequest = buildInitializeRequestPayload().copy(id = RequestId("second-init"))
         val secondResponse = client.post(path) {
             addStreamableHeaders()
             header("mcp-session-id", firstResponse.headers[MCP_SESSION_ID_HEADER])
-            setBody(payload)
+            setBody(secondRequest)
         }
 
         secondResponse.status shouldBe HttpStatusCode.BadRequest
+        val error = secondResponse.body<JSONRPCError>()
+        error.id shouldBe secondRequest.id
+        error.error.message shouldBe "Invalid Request: Server already initialized"
     }
 
     @Test
```

#### Recent Merged Pull Requests:
- **PR #1056** (closed): chore(deps): bump the ktor group across 1 directory with 14 updates (@dependabot[bot])
- **PR #1055** (2026-09-30): chore(deps): bump fast-uri from 3.1.7 to 3.1.8 in /integration-test/src/jvmTest/typescript (@dependabot[bot])
- **PR #1054** (2026-09-30): test: remove redundant tests and fix vacuous ones (@devcrocod)
- **PR #1053** (2026-09-29): test(server): remove log-assertion tests and Logback test dependency (@devcrocod)
- **PR #1031** (2026-09-29): chore(deps): bump the other-dependencies group across 4 directories with 3 updates (@dependabot[bot])
- **PR #1030** (2026-09-29): chore(deps): bump @types/node from 26.6.2 to 26.6.3 in /integration-test/src/jvmTest/typescript in the all-dependencies group (@dependabot[bot])
- **PR #1029** (2026-09-28): chore(deps): bump ip-address from 10.4.0 to 10.7.2 in /integration-test/src/jvmTest/typescript (@dependabot[bot])
- **PR #1028** (2026-09-28): test: fix flaky ChannelTransportTest (@devcrocod)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
