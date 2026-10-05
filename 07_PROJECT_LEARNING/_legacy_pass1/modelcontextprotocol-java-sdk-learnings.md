# Forensic Learning Record (Deep Inspection): modelcontextprotocol/java-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-java-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/java-sdk](https://github.com/modelcontextprotocol/java-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:32:42.684Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/java-sdk`
- **Description**: The official Java SDK for Model Context Protocol servers and clients. Maintained in collaboration with Spring AI
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3715 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1147** (2026-09-30): **Streamable HTTP: invalid JSON response is reported as a timeout**
  *Symptoms*: Using `mcp-core:2.0.1` on Java 17, we found that initialization times out when the server immediately returns invalid JSON. The caller gets a `TimeoutException` instead of the JSON parsing error.  ### Reproduction  Configure `HttpClientStreamableHttpTransport` with initialization and request timeouts both set to 5000 ms.  When the server receives `initialize`, immediately return:  ```http HTTP/1.1 200 OK Content-Type: application/json  {broken ```  Subscribe to initialization and wait for its terminal signal.  We reproduced this through an application using the SDK client and its standard transport.  ### Expected and actual behavior  Expected: initialization fails as soon as parsing fails, with the original parsing exception preserved in the cause chain.  Actual: it fails about 5 seconds later with `TimeoutException`. The parsing cause is missing from the terminal exception chain. No tool call is executed.  ### What we found in the source  In `HttpClientStreamableHttpTransport.sendMessage`, the `application/json` branch calls `deliveredSink.success()` before `deserializeJsonRpcMessage()`.  When parsing throws `IOException`, the code wraps it in `McpTransportException`. The outer error handler then calls `deliveredSink.error(...)`, but the sink has already completed successfully.  `McpClientSession.sendRequest` registers the request in `pendingResponses` and relies on the `sendMessage` error callback to remove it and signal failure. Since that callback doesn't receive the pars

- **Issue #1136** (2026-09-30): **SSE client silently truncates a data: line at U+2028/U+2029/U+0085, then fails with "Error parsing JSON-RPC message"**
  *Symptoms*: ## Summary  `ResponseSubscribers.SseLineSubscriber` extracts the payload of an SSE `data:` line with a `MULTILINE` regex. Java's `MULTILINE` mode treats ` ` (LINE SEPARATOR), ` ` (PARAGRAPH SEPARATOR) and `` (NEL) as line terminators, so when a `data:` line contains one of those characters the capture group stops there and **everything after it is silently discarded**. The client then fails to deserialise the truncated JSON and throws:  ``` io.modelcontextprotocol.spec.McpTransportException: Error parsing JSON-RPC message: SseResponseEvent[...] ```  Any tool result, resource content or prompt text containing one of these three characters is unreadable by the client. They are legal unescaped inside a JSON string, and they turn up in real content — text pasted from word processors, web pages and PDFs.  ## Affected code  `mcp-core/src/main/java/io/modelcontextprotocol/client/transport/ResponseSubscribers.java`:  ```java private static final Pattern EVENT_DATA_PATTERN = Pattern.compile("^data:(.+)$", Pattern.MULTILINE); private static final Pattern EVENT_ID_PATTERN   = Pattern.compile("^id:(.+)$",   Pattern.MULTILINE); private static final Pattern EVENT_TYPE_PATTERN = Pattern.compile("^event:(.+)$", Pattern.MULTILINE); ```  ```java if (line.startsWith("data:")) {     var matcher = EVENT_DATA_PATTERN.matcher(line);     if (matcher.find()) {         String data = matcher.group(1).trim();         ...         this.eventBuilder.append(data).append("\n");     }     upstream().request(
  **Post-Mortem & Fix Analysis**:
  > Fixed in #1079 

- **Issue #1114** (2026-09-01): **HttpServletStreamableServerTransportProvider: server-initiated requests race client stream registration (intermittent -32603 "Stream unavailable")**
  *Symptoms*: ### Summary  `HttpServletStreamableServerTransportProvider` intermittently answers `-32603 "Stream unavailable for session <id>"` (wrapped as JSON-RPC internal error / HTTP 500) when it attempts to push a server-initiated request (e.g. `roots/list`) to a client whose `GET /mcp` SSE stream has not been registered yet.  ### Observed failure  - Test: `HttpServletStreamableIntegrationTests.testRootsNotificationWithEmptyRootsList(String)[1]` - CI run: https://github.com/modelcontextprotocol/java-sdk/actions/runs/33068920136 (Build and Test) - Client-side surfacing: `java.lang.RuntimeException: Failed to send message: AggregateResponseEvent[...]` wrapping   `jsonRpcError: {"code":-32603,"message":"Error processing message: Stream unavailable for session 82454020-4c10-4276-9c30-57c15d49810e"}`  ### Repro shape  1. Client declares the `roots` capability 2. Client sends `initialize`; server accepts and creates the session 3. Server immediately pushes `roots/list` over the session's `GET /mcp` stream 4. POST traffic racing the first stream registration loses → `-32603`, stream unavailable  ### Why we believe it is a race (not environment-specific)  - The same commit passed the parallel "Jackson 2 Integration Tests" job minutes later - Full local suite (embedded Tomcat 11, JDK 17, macOS) passed repeatedly; only 1 of 43 parameterizations in the class failed on CI - Related history: revert `fb029c8c` "Clean up AbstractMcpClientServerIntegrationTests", #952 (session removed on non-fatal fa
  **Post-Mortem & Fix Analysis**:
  > Unable to reproduce locally, even running the tests 1000 times. It might not be the exact problem described here. The test in question does the following:  1. client initializes fully      1. `POST `/initialize`     2. `GET /mcp` (opens a stream), in a fire-and-forget     3. `POST notifications/initialized` 1. client notify roots lists changes `POST notications/roots/list_changed` 1. Only when the server gets the notification does the server sends `roots/list`.  It is very unlikely that the `GET` is under contention for two full posts. I can reproduce by adding latency to the servlet transport's `doGet`, though.  The underlying issue (race condition between server notifications and `GET`) might be a problem under some conditions (network, client from a different ecosystem).   (There is also a separate issue at play here - the `client` can't really wait for the stream to be established before proceeding further, which would fix _the test_ without fixing the race condition. But that's a 
  > Please let's discuss server-side fixes in this issue before jumping into an implementation.
  > Fresh occurrence in CI, on a branch that only touches a test file: Jackson 2 job of #1113 at 8fccf33e, `HttpServletStreamableIntegrationTests.testRootsSuccess(String)[1]` → `-32603 "Error processing message: Stream unavailable for session f79d57db-…"` from `HttpServletStreamableServerTransportProvider.doPost:564` ([run 33192309921](https://github.com/modelcontextprotocol/java-sdk/actions/runs/33192309921/job/98920604408)). Same seam as `testRootsNotificationWithEmptyRootsList`; the sibling Jackson 3 job passed the same class.  *This comment was created with AI assistance.*

- **Issue #1104** (2026-08-26): **Backport #800: fix error behavior on unregistered handlers in stateless server handler**
  *Symptoms*: Backport of #800 to the 0.18.x line. See #1085.  ## Why  `DefaultMcpStatelessServerHandler.handleRequest` returns `Mono.error(...)` for a method with no registered handler. That is an early return, so the error never reaches the `onErrorResume` a few lines below it that maps errors onto a JSON-RPC error response — it escapes to the transport instead, and every stateless transport maps an escaping handler error to **HTTP 500**:  - `HttpServletStatelessServerTransport` - `WebMvcStatelessServerTransport` (`io.modelcontextprotocol.sdk:mcp-spring-webmvc`) - `WebFluxStatelessServerTransport` (`io.modelcontextprotocol.sdk:mcp-spring-webflux`)  Requests for *registered* methods are unaffected — `tools/call` with an unknown tool name already returns a proper `-32602`, because that path does run through `onErrorResume`.  The practical impact is the one described in #1072: OpenAI's hosted MCP connector sends `server/discover` before `tools/list`, so a healthy server answers a routine capability probe with a 5xx. On our side that made `POST /mcp` the only 5xx source in the service and burned the availability SLO budget; OpenAI surfaces the same 500 as HTTP 424 `external_connector_error`, which aborts the whole response.  ## Why a backport  The fix is on `main` and shipped in `mcp-core` 2.0.1, but 2.0.x is not reachable for Spring AI users on Spring Boot 3:  - `io.modelcontextprotocol.sdk:mcp-spring-webmvc` does not exist at 2.0.x — the Spring transports moved to `org.springframework.ai` 
  **Post-Mortem & Fix Analysis**:
  > @eashwar-mp It seems the MR is missing workflows being approved, to then merge, and it seems only Maintainers can do that. Any chance you're one, or know who we can ping? This is a much needed change for my team. Thanks!
  > @JHTosas I'm not a maintainer, my review is a community approval with read-only permissions, so it won't satisfy the merge gate or approve the CI workflows. This needs someone with write access.  Looking at who merges here, @Kehrlann is the most active maintainer (nearly all recent merges are his), and @tzolov triaged this one on #1085 (labeled it P1 and tagged it for confirmation). Either is probably a good ping to approve the workflows and take it from there. The bug is now confirmed on three lines (0.17.0, 0.18.3, 0.18.4) and the change is three lines plus tests, so hopefully a quick one.  cc: @Kehrlann @tzolov FYI   ----------------------- @JHTosas If it's breaking your prod today or this week, I would recommend adding a servlet filter which intercepts only a server/discover request (carrying an id) and returns a clean -32601 at HTTP 200. That should be a good intermediary fix, while the maintainers push this one out and publish the artifact. 
  > Thank you for the backport.  The 0.17.0 line is completely out of support, we won't be backporting this further.

- **Issue #1072** (2026-08-17): **[2026-07-28] Java SDK 2.0.0 returns HTTP 500 for OpenAI server/discover requests**
  *Symptoms*: Starting on 2026-07-30 at approximately 07:10 UTC, we observed OpenAI's hosted MCP client begin sending `server/discover` before `tools/list` when using a remote MCP server through the   Responses API.    Our server uses the latest released MCP Java SDK, `2.0.0`, which supports protocol revision `2025-11-25` but does not currently implement `server/discover`.    When the request reaches `HttpServletStatelessServerTransport`, the SDK returns HTTP 500 with an error similar to:    `Missing handler for request type: server/discover`    OpenAI then returns HTTP 424 `external_connector_error` from the Responses API. This prevents the entire response from being generated, even when the user sends a message such as "hi" that   does not require an MCP tool call.    We understand that support for the new stateless lifecycle is already tracked in:    - https://github.com/modelcontextprotocol/java-sdk/issues/1011    We also found that the general unknown-handler behavior was fixed by:    - https://github.com/modelcontextprotocol/java-sdk/pull/800    However, that change was merged after the latest `2.0.0` release and does not appear to be available in a published version.    Could you please clarify:    1. Which Java SDK version is expected to support the `2026-07-28` protocol revision?   2. Is there an estimated release timeline?   3. Will there be an interim `2.x` release containing the unknown-handler fix from #800?   4. Until full support is available, what is the recommended server 
  **Post-Mortem & Fix Analysis**:
  > This issue is already resolved on main. DefaultMcpStatelessServerHandler.handleRequest:34-38 now returns a proper -32601 JSON-RPC error for unknown methods

- **Issue #1058** (2026-07-08): **Bump json-schema-validator to 2.0.4 / 3.0.6, jackson to 2.21.1 / 3.1.4**
  *Symptoms*: Bumps `json-schema-validator` to **2.0.4** (Jackson 2) / **3.0.6** (Jackson 3) to adopt the OSGi class-loading fix, and moves the Jackson floors those releases require.  Fixes #992  ## Motivation and Context  `DefaultJsonSchemaValidator` eagerly loads the bundled Draft 2020-12 meta-schema, and `json-schema-validator` resolved it through the thread context class loader only — under OSGi that loader cannot see the validator's own jar, so every server failed at startup with `FileNotFoundException: classpath:draft/2020-12/schema`. Fixed upstream in networknt/json-schema-validator#1265 / networknt/json-schema-validator#1266, released as 3.0.6 / 2.0.4.  json-schema-validator 3.0.6 is built against Jackson 3.1.4 and requires `jackson-annotations` 2.21, so those floors move with it; `jackson-annotations` is shared through `mcp-core`, so the Jackson 2 line is aligned to 2.21.1.  ## How Has This Been Tested?  Two ways, independently: - I verified that this resolves an issue I encountered in an OSGi application — the same failure reported in #992. - Separately, on a minimal embedded Apache Felix reproducer: with a thread context class loader that cannot see the bundled meta-schema, `DefaultJsonSchemaValidator` threw before this change and constructs cleanly after it, for both the Jackson 2 and Jackson 3 modules.  Module test suites pass locally.  ## Breaking Changes  None in the SDK itself (pom-only). The validator patch releases include upstream validation bug fixes

- **Issue #1040** (2026-06-26): **`McpStreamableServerSession#responseStream` never closes when there is no handler registered for the request**
  *Symptoms*: If a client sends an invalid request, e.g.  ``` { 	"jsonrpc": "2.0", 	"method": "foo/bar", 	"id": "123-abc", 	"params": {} } ```  the MCP async server never closes the response, and the request hangs indefinitely.

- **Issue #1022** (2026-09-18): **[BUG] KeepAliveScheduler does not evict sessions after ping failure, causing unbounded CPU growth**
  *Symptoms*: ## Description  When `keep-alive-interval` is configured on a Streamable HTTP MCP Server, `KeepAliveScheduler` periodically sends ping messages to all registered `McpStreamableServerSession` instances. When a session's stream is unavailable (client already disconnected), the ping fails and a WARN is logged, but **the session is never removed from the session map**. Over time, dead sessions accumulate indefinitely, causing increasing CPU usage as the scheduler iterates over a growing list of unreachable sessions every interval.  ## Environment  - Spring AI: 1.1.4 - MCP Java SDK: (bundled with Spring AI 1.1.4) - Java: JDK 25 - Server: Tomcat (embedded via Spring Boot 3.4.1) - Transport: Streamable HTTP (`spring.ai.mcp.server.protocol=STREAMABLE`)  ## Configuration  ```yaml spring:   ai:     mcp:       server:         type: SYNC         protocol: STREAMABLE         streamable-http:           mcp-endpoint: /mcp           keep-alive-interval: 30s ```  ## Steps to Reproduce  1. Deploy an MCP Server with Streamable HTTP transport and `keep-alive-interval: 30s` 2. Have multiple MCP clients connect, call tools, then disconnect (close TCP) 3. Wait a few minutes and observe logs and CPU usage  ## Observed Behavior  Logs fill with repeated warnings every 30 seconds, one per dead session:  ``` WARN [io.modelcontextprotocol.util.KeepAliveScheduler] Failed to send keep-alive ping to session McpStreamableServerSession@3656e950: Stream unavailable for session d0a2a5b9-d427-49f6-8f0b-6c37293e2
  **Post-Mortem & Fix Analysis**:
  > I can take this.  Looking at the code, KeepAliveScheduler only receives a Supplier<Flux<McpSession>> from the transport provider, so it cannot evict from the session map directly. I would add an on-failure hook to the scheduler and wire it in HttpServletStreamableServerTransportProvider, plus any other provider that creates a KeepAliveScheduler, so a failed keep-alive can close and remove the session through the existing transport cleanup path. Successful pings would stay unchanged, and this would not introduce a general session TTL policy.  I would not evict on the first failure: #920 shows transient write failures can happen, and a streamable client without an open GET stream can still be alive and POSTing. A small consecutive-failure threshold, like the 2-3 failures suggested in the issue, seems like the right boundary.  If that scope works, I will put up a PR.
  > Thanks for digging into this. @nikita-kibitkin   I’ve already opened the related upstream MCP Java SDK issue here: https://github.com/modelcontextprotocol/java-sdk/issues/1021  Since the relevant pieces (`KeepAliveScheduler`, streamable session handling, and transport cleanup) live in the MCP Java SDK, I’ve started working on the upstream fix there first and will link the PR back here once it is ready.  My expectation is that this Spring AI issue will likely be resolved primarily through the MCP-side change, with Spring AI then validating the upgraded behavior and only adding follow-up integration changes if needed.  If you’d still like to collaborate, that would be very helpful — especially on validating the behavior from the Spring AI side, regression coverage, and checking whether any Spring-specific follow-up is still needed after the MCP fix lands.
  >  Small correction from my side: I realized I mixed up the issue context in my previous reply. I thought I was replying to the related Spring AI issue here: https://github.com/spring-projects/spring-ai/issues/6384, but this issue is already in the MCP Java SDK repo.    To clarify:    - #1021 tracks the servlet Streamable HTTP lifecycle / CLOSE-WAIT issue.   - #1027 is my PR for that lifecycle cleanup path.   - This issue (#1022) is the separate `KeepAliveScheduler` dead-session eviction problem.    I’ve already spent time digging into the streamable session lifecycle while preparing #1027, and I’d be interested in helping with this follow-up as well.    Your proposed direction makes sense to me: add a keep-alive failure hook / consecutive failure threshold, and let the transport provider perform session cleanup because it owns the session registry. I also agree eviction should not happen on the first failure.    If you have not started on the implementation yet, I’d be happy to prepare 

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

### Incident Patch 1: `65c08565` (2026-09-16)
**Commit Message**: Fix hanging disconnected client during POST

Signed-off-by: Daniel Garnier-Moiroux <git@garnier.wf>

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/transport/HttpServletStreamableServerTransportProvider.java` (modified, +18/-3)
```diff
@@ -26,6 +26,7 @@
 import io.modelcontextprotocol.spec.McpStreamableServerSession;
 import io.modelcontextprotocol.spec.McpStreamableServerTransport;
 import io.modelcontextprotocol.spec.McpStreamableServerTransportProvider;
+import io.modelcontextprotocol.spec.McpTransportException;
 import io.modelcontextprotocol.spec.ProtocolVersions;
 import io.modelcontextprotocol.util.Assert;
 import io.modelcontextprotocol.util.KeepAliveScheduler;
@@ -593,10 +594,17 @@ else if (message instanceof McpSchema.JSONRPCRequest jsonrpcRequest) {
 
 				HttpServletStreamableMcpSessionTransport sessionTransport = new HttpServletStreamableMcpSessionTransport(
 						sessionId, asyncContext, response.getWriter());
-				registerAsyncLifecycle(asyncContext, sessionId, sessionTransport::close);
+
+				// The listener is given the stream rather than its transport, so that the
+				// end of the connection detaches the stream from the session instead of
+				// only dropping the socket: a stream outliving its connection keeps the
+				// session looking busy and spares it from the sweeper
+				McpStreamableServerSession.McpStreamableServerSessionStream responseStream = session
+					.responseStream(sessionTransport);
+				registerAsyncLifecycle(asyncContext, sessionId, responseStream::releaseTransport);
 
 				try {
-					session.responseStream(jsonrpcRequest, sessionTransport)
+					responseStream.handle(jsonrpcRequest)
 						.contextWrite(ctx -> ctx.put(McpTransportContext.KEY, transportContext))
 						.block();
 				}
@@ -887,9 +895,16 @@ public Mono<Void> sendMessage(McpSchema.JSONRPCMessage message, String messageId
 				}
 				catch (Exception e) {
 					// The connection is gone, the session is not: the client may come
-					// back for it, and the idle timeout reclaims it if it never does
+					// back for it, and the sweeper reclaims it if it never does
 					logger.error("Failed to send message to session {}: {}", this.sessionId, e.getMessage());
 					this.close();
+					// Surfaced to the caller rather than swallowed: whoever is writing to
+					// this stream has to learn that it no longer leads anywhere, or it
+					// keeps producing messages for a client which is gone. A request
+					// being streamed a response would never finish, holding on to the
+					// container thread which has to be given back before the end of the
+					// connection can be acted upon.
+					throw new McpTransportException("Failed to send message to session " + this.sessionId, e);
 				}
 				finally {
 					lock.unlock();
```

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/spec/McpStreamableServerSession.java` (modified, +66/-32)
```diff
@@ -250,45 +250,35 @@ public Flux<McpSchema.JSONRPCMessage> replay(Object lastEventId) {
 		return Flux.empty();
 	}
 
+	/**
+	 * Create a response stream (the SSE stream of a single HTTP POST request, finalized
+	 * with the response to the request it carries). The caller owns the returned stream
+	 * and is responsible for releasing it once the connection behind it ends, the same
+	 * way it does for a {@link #listeningStream(McpStreamableServerTransport)}: a stream
+	 * outliving its connection keeps the session looking busy, see
+	 * {@link #hasOpenStream()}.
+	 * @param transport the SSE transport stream to send messages to
+	 * @return a stream representation, on which
+	 * {@link McpStreamableServerSessionStream#handle(McpSchema.JSONRPCRequest)} runs the
+	 * request
+	 */
+	public McpStreamableServerSessionStream responseStream(McpStreamableServerTransport transport) {
+		return new McpStreamableServerSessionStream(transport);
+	}
+
 	/**
 	 * Provide the SSE stream of MCP messages finalized with a Response.
 	 * @param jsonrpcRequest the MCP request triggering the stream creation
 	 * @param transport the SSE transport stream to send messages to
 	 * @return Mono which completes once the processing is done
+	 * @deprecated the stream created for the request is not exposed, which leaves the
+	 * caller unable to release it when the connection carrying it ends. Use
+	 * {@link #responseStream(McpStreamableServerTransport)} and
+	 * {@link McpStreamableServerSessionStream#handle(McpSchema.JSONRPCRequest)} instead.
 	 */
+	@Deprecated
 	public Mono<Void> responseStream(McpSchema.JSONRPCRequest jsonrpcRequest, McpStreamableServerTransport transport) {
-		return Mono.deferContextual(ctx -> {
-			McpTransportContext transportContext = ctx.getOrDefault(McpTransportContext.KEY, McpTransportContext.EMPTY);
-
-			McpStreamableServerSessionStream stream = new McpStreamableServerSessionStream(transport);
-			McpRequestHandler<?> requestHandler = McpStreamableServerSession.this.requestHandlers
-				.get(jsonrpcRequest.method());
-			if (requestHandler == null) {
-				MethodNotFoundError error = getMethodNotFoundError(jsonrpcRequest.method());
-				return transport
-					.sendMessage(
-							McpSchema.JSONRPCResponse
-								.error(jsonrpcRequest.id(),
-										new McpSchema.JSONRPCResponse.JSONRPCError(
-												McpSchema.ErrorCodes.METHOD_NOT_FOUND, error.message(), error.data())))
-					.then(stream.closeGracefully());
-			}
-			return requestHandler
-				.handle(new McpAsyncServerExchange(this.id, stream, clientCapabilities.get(), clientInfo.get(),
-						transportContext, this.jsonSchemaValidator), jsonrpcRequest.params())
-				.map(result -> McpSchema.JSONRPCResponse.result(jsonrpcRequest.id(), result))
-				.onErrorResume(e -> {
-					McpSchema.JSONRPCResponse.JSONRPCError jsonRpcError = (e instanceof McpError mcpError
-							&& mcpError.getJsonRpcError() != null) ? mcpError.getJsonRpcError()
-									: new McpSchema.JSONRPCResponse.JSONRPCError(McpSchema.ErrorCodes.INTERNAL_ERROR,
-											e.getMessage(), McpError.aggregateExceptionMessages(e));
-
-					var errorResponse = McpSchema.JSONRPCResponse.error(jsonrpcRequest.id(), jsonRpcError);
-					return Mono.just(errorResponse);
-				})
-				.flatMap(transport::sendMessage)
-				.then(stream.closeGracefully());
-		});
+		return Mono.defer(() -> this.responseStream(transport).handle(jsonrpcRequest));
 	}
 
 	/**
@@ -509,6 +499,50 @@ public <T> Mono<T> sendRequest(String method, Object requestParams, TypeRef<T> t
 			});
 		}
 
+		/**
+		 * Runs the request this stream was created for, sending its messages to the
+		 * client and finalizing the stream with the response.
+		 * <p>
+		 * The stream is detached from the session once the request is done with it,
+		 * whatever the outcome: a response, an error, or the caller giving up.
+		 * @param jsonrpcRequest the MCP request this stream carries the response of
+		 * @return Mono which completes once the processing 
```

**File**: `mcp-core/src/test/java/io/modelcontextprotocol/spec/McpStreamableServerSessionTests.java` (modified, +81/-1)
```diff
@@ -10,6 +10,7 @@
 import java.util.concurrent.ConcurrentLinkedQueue;
 
 import io.modelcontextprotocol.json.TypeRef;
+import io.modelcontextprotocol.server.McpRequestHandler;
 import org.junit.jupiter.api.Test;
 import reactor.core.publisher.Mono;
 
@@ -23,8 +24,12 @@ class McpStreamableServerSessionTests {
 	private static final Duration TIMEOUT = Duration.ofSeconds(5);
 
 	private McpStreamableServerSession session() {
+		return session(Map.of());
+	}
+
+	private McpStreamableServerSession session(Map<String, McpRequestHandler<?>> requestHandlers) {
 		return new McpStreamableServerSession("session-1", McpSchema.ClientCapabilities.builder().build(),
-				new McpSchema.Implementation("test-client", "1.0.0"), TIMEOUT, Map.of(), Map.of());
+				new McpSchema.Implementation("test-client", "1.0.0"), TIMEOUT, requestHandlers, Map.of());
 	}
 
 	@Test
@@ -139,6 +144,81 @@ void closingAStreamFailsOnlyItsOwnPendingRequests() {
 		assertThat(onListeningStream).succeedsWithin(TIMEOUT).isEqualTo("response-value");
 	}
 
+	@Test
+	void endOfTheConnectionCarryingAResponseStreamDetachesItFromTheSession() {
+		// A request whose handler never completes, as seen when a client gives up and
+		// disconnects while the server is still working on its tool call
+		var session = session(Map.of("tools/call", (exchange, params) -> Mono.never()));
+		var transport = new RecordingTransport();
+
+		// The caller owns the stream, so it can detach it from the session once the
+		// container tells it the connection carrying it is gone
+		var stream = session.responseStream(transport);
+		stream.handle(new McpSchema.JSONRPCRequest("tools/call", "request-1")).subscribe();
+		assertThat(session.hasOpenStream()).isTrue();
+
+		stream.releaseTransport();
+
+		// The session must stop believing it holds a live connection: hasOpenStream() is
+		// what tells the session sweeper that a client is still around, so a stream which
+		// outlives its connection makes the session impossible to reclaim
+		assertThat(session.hasOpenStream()).isFalse();
+		assertThat(transport.closed).isTrue();
+	}
+
+	@Test
+	void responseStreamIsDetachedFromTheSessionOnceItsRequestIsAnswered() {
+		var session = session(Map.of("tools/call", (exchange, params) -> Mono.just("result")));
+		var transport = new RecordingTransport();
+
+		var stream = session.responseStream(transport);
+		assertThat(session.hasOpenStream()).isTrue();
+
+		stream.handle(new McpSchema.JSONRPCRequest("tools/call", "request-1")).block(TIMEOUT);
+
+		assertThat(session.hasOpenStream()).isFalse();
+	}
+
+	@Test
+	void responseStreamIsDetachedFromTheSessionWhenItsResponseCannotBeSent() {
+		var session = session(Map.of("tools/call", (exchange, params) -> Mono.just("result")));
+
+		var stream = session.responseStream(new FailingTransport());
+		var handling = stream.handle(new McpSchema.JSONRPCRequest("tools/call", "request-1")).toFuture();
+
+		// The connection which was to carry the response failed. The caller gets to see
+		// it, and the stream must not be left attached to the session.
+		assertThat(handling).failsWithin(TIMEOUT).withThrowableThat().havingCause().withMessage("connection gone");
+		assertThat(session.hasOpenStream()).isFalse();
+	}
+
+	@Test
+	void abandonedResponseStreamIsDetachedFromTheSession() {
+		var session = session(Map.of("tools/call", (exchange, params) -> Mono.never()));
+
+		var stream = session.responseStream(new RecordingTransport());
+		var subscription = stream.handle(new McpSchema.JSONRPCRequest("tools/call", "request-1")).subscribe();
+		assertThat(session.hasOpenStream()).isTrue();
+
+		// The caller gives up on a request which would never terminate on its own, so
+		// nothing sends the response the stream was created to carry
+		subscription.dispose();
+
+		assertThat(session.hasOpenStream()).isFalse();
+	}
+
+	/**
+	 * A transport whose connection is gone, so that nothing can be written to it.
+	 */
+	static class FailingTransport extends RecordingTransport {
+
+		@Overr
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/HttpServletStreamableIntegrationTests.java` (modified, +93/-3)
```diff
@@ -49,9 +49,11 @@
 import org.junit.jupiter.api.Timeout;
 import org.junit.jupiter.params.provider.Arguments;
 import org.slf4j.LoggerFactory;
+import reactor.core.publisher.Flux;
 import reactor.core.publisher.Mono;
 import reactor.test.StepVerifier;
 
+import static io.modelcontextprotocol.util.ToolsUtils.EMPTY_JSON_SCHEMA;
 import static java.nio.charset.StandardCharsets.UTF_8;
 import static org.assertj.core.api.Assertions.assertThat;
 import static org.awaitility.Awaitility.await;
@@ -70,9 +72,13 @@ class HttpServletStreamableIntegrationTests extends AbstractMcpClientServerInteg
 
 	private HttpServletStreamableServerTransportProvider mcpServerTransportProvider;
 
-	private final Duration KEEP_ALIVE_INTERVAL = Duration.ofMillis(200);
+	// Keep alive is fast. A ping failure releases the stream, so listening
+	// steams are released quickly.
+	private final Duration KEEP_ALIVE_INTERVAL = Duration.ofMillis(150);
 
-	private final Duration SESSION_SWEEP_INTERVAL = Duration.ofMillis(200);
+	// Sweeping is slower than keep-alive, so that a failed ping doesn't immediately
+	// result in a session sweep
+	private final Duration SESSION_SWEEP_INTERVAL = KEEP_ALIVE_INTERVAL.multipliedBy(2);
 
 	@Override
 	protected void awaitClientStreamEstablished() {
@@ -463,6 +469,90 @@ void sessionIsNotEvictedWithoutSweepInterval() throws Exception {
 		assertThat(postNotification(httpClient, sessionId)).isEqualTo(HttpServletResponse.SC_ACCEPTED);
 	}
 
+	/**
+	 * A client which aborts a tool call must not leave its session behind.
+	 */
+	@Test
+	void sessionIsEvictedWhenTheClientAbortsAResponseStream() throws Exception {
+		mcpServerTransportProvider.closeGracefully().block();
+		mcpServerTransportProvider = HttpServletStreamableServerTransportProvider.builder()
+			.contextExtractor(TEST_CONTEXT_EXTRACTOR)
+			.mcpEndpoint(MESSAGE_ENDPOINT)
+			// remove keepalive, so only the response stream can keep the session alive
+			.keepAliveInterval(null)
+			.sessionSweepInterval(SESSION_SWEEP_INTERVAL)
+			.build();
+		MCP_SERVLET.setDelegate(mcpServerTransportProvider);
+
+		// A tool which never returns but keeps writing to its response stream. The
+		// payloads are large and frequent on purpose: writes to a connection whose peer
+		// is gone keep succeeding until the socket buffer fills up, and that is the only
+		// thing which can surface the disconnect here.
+		prepareAsyncServerBuilder().serverInfo("test-server", "1.0.0")
+			.capabilities(McpSchema.ServerCapabilities.builder().tools(true).build())
+			.tools(McpServerFeatures.AsyncToolSpecification.builder()
+				.tool(McpSchema.Tool.builder("hangs", EMPTY_JSON_SCHEMA).description("never returns").build())
+				.callHandler((exchange, request) -> Flux.interval(Duration.ofMillis(10))
+					.flatMap(tick -> exchange.loggingNotification(McpSchema.LoggingMessageNotification.builder()
+						.level(McpSchema.LoggingLevel.INFO)
+						.data("x".repeat(64 * 1024))
+						.build()))
+					.then(Mono.<McpSchema.CallToolResult>never()))
+				.build())
+			.build();
+
+		var httpClient = HttpClient.newHttpClient();
+		var sessionId = initializeSession(httpClient);
+
+		// The POST opens a response SSE stream, which the session counts as an open
+		// stream for as long as the call is in flight
+		var responseStream = postToolCall(httpClient, sessionId, "hangs");
+		await().atMost(Duration.ofSeconds(5))
+			.untilAsserted(
+					() -> assertThat(responseStream.events()).anyMatch(line -> line.contains("notifications/message")));
+		assertThat(postNotification(httpClient, sessionId)).isEqualTo(HttpServletResponse.SC_ACCEPTED);
+
+		// The client gives up on the call and disconnects
+		responseStream.closeStream();
+
+		// Nothing is connected to the session anymore, so the sweeper must reclaim it.
+		// Probing only once: any request would count as activity and reset the clock.
+		Thread.sleep(SESSION_SWEEP_INTERVAL.multipliedBy(2).toMillis());
+
+		assertThat(postNotification(httpClient, sessionId)
```

---

### Incident Patch 2: `183935bf` (2026-09-16)
**Commit Message**: Fix Automatic-Module-Name without hypens

Signed-off-by: Daniel Garnier-Moiroux <git@garnier.wf>

**File**: `conformance-tests/client-jdk-http-client/pom.xml` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
 	</scm>
 
 	<properties>
+		<module.name>io.modelcontextprotocol.sdk.conformance.client.jdk</module.name>
 		<maven.deploy.skip>true</maven.deploy.skip>
 	</properties>
 
```

**File**: `conformance-tests/client-spring-http-client/pom.xml` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
 	</scm>
 
 	<properties>
+		<module.name>io.modelcontextprotocol.sdk.conformance.client.spring</module.name>
 		<java.version>17</java.version>
 		<spring-boot.version>4.1.0</spring-boot.version>
 		<spring-ai.version>2.0.0</spring-ai.version>
```

**File**: `conformance-tests/server-servlet/pom.xml` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
 	</scm>
 
 	<properties>
+		<module.name>io.modelcontextprotocol.sdk.conformance.server.servlet</module.name>
 		<maven.deploy.skip>true</maven.deploy.skip>
 	</properties>
 
```

**File**: `mcp-core/pom.xml` (modified, +5/-1)
```diff
@@ -20,6 +20,10 @@
 		<developerConnection>scm:git:ssh://git@github.com/modelcontextprotocol/java-sdk.git</developerConnection>
 	</scm>
 
+	<properties>
+		<module.name>io.modelcontextprotocol.sdk.mcp.core</module.name>
+	</properties>
+
 	<build>
 		<plugins>
 			<plugin>
@@ -37,7 +41,7 @@
 								Bundle-Name:            Bundle ${project.groupId} : ${project.artifactId}
 								Bundle-SymbolicName:    ${project.groupId}.${project.artifactId}
 								Bundle-Version:         ${project.version}
-								Automatic-Module-Name:  ${project.groupId}.${project.artifactId}
+								Automatic-Module-Name:  ${module.name}
 								Import-Package:         jakarta.*;resolution:=optional, \
 								                        *;
 								Service-Component: 		OSGI-INF/io.modelcontextprotocol.json.McpJsonDefaults.xml
```

**File**: `mcp-json-jackson2/pom.xml` (modified, +5/-1)
```diff
@@ -20,6 +20,10 @@
 		<developerConnection>scm:git:ssh://git@github.com/modelcontextprotocol/java-sdk.git</developerConnection>
 	</scm>
 
+	<properties>
+		<module.name>io.modelcontextprotocol.sdk.mcp.json.jackson2</module.name>
+	</properties>
+
 	<build>
 		<plugins>
 			<plugin>
@@ -37,7 +41,7 @@
 								Bundle-Name:            Bundle ${project.groupId} : ${project.artifactId}
 								Bundle-SymbolicName:    ${project.groupId}.${project.artifactId}
 								Bundle-Version:         ${project.version}
-								Automatic-Module-Name:  ${project.groupId}.${project.artifactId}
+								Automatic-Module-Name:  ${module.name}
 								Bundle-ActivationPolicy: lazy
 								Import-Package:         io.modelcontextprotocol.json,io.modelcontextprotocol.json.schema, \
 								                        *;
```

---

### Incident Patch 3: `4186ca13` (2026-09-08)
**Commit Message**: Fix stream leak when resuming streams with LAST_EVENT_ID

Signed-off-by: Daniel Garnier-Moiroux <git@garnier.wf>

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/transport/HttpServletStreamableServerTransportProvider.java` (modified, +61/-50)
```diff
@@ -324,68 +324,79 @@ protected void doGet(HttpServletRequest request, HttpServletResponse response)
 			HttpServletStreamableMcpSessionTransport sessionTransport = new HttpServletStreamableMcpSessionTransport(
 					sessionId, asyncContext, response.getWriter());
 
-			// Check if this is a replay request
-			if (request.getHeader(HttpHeaders.LAST_EVENT_ID) != null) {
-				String lastId = request.getHeader(HttpHeaders.LAST_EVENT_ID);
+			// Replay the messages the client missed while its stream was broken
+			String lastEventId = request.getHeader(HttpHeaders.LAST_EVENT_ID);
+			if (lastEventId != null
+					&& !this.tryReplayMissedMessages(session, lastEventId, sessionTransport, transportContext)) {
+				// The replay failed and already closed the transport
+				return;
+			}
 
-				try {
-					session.replay(lastId)
-						.contextWrite(ctx -> ctx.put(McpTransportContext.KEY, transportContext))
-						.toIterable()
-						.forEach(message -> {
-							try {
-								sessionTransport.sendMessage(message)
-									.contextWrite(ctx -> ctx.put(McpTransportContext.KEY, transportContext))
-									.block();
-							}
-							catch (Exception e) {
-								logger.error("Failed to replay message: {}", e.getMessage());
-								asyncContext.complete();
-							}
-						});
-				}
-				catch (Exception e) {
-					logger.error("Failed to replay messages: {}", e.getMessage());
-					asyncContext.complete();
+			// Establish the listening stream. Resumed streams are registered too, so
+			// that the session keeps delivering messages to the reconnected client and
+			// the async context is completed once the client goes away.
+			McpStreamableServerSession.McpStreamableServerSessionStream listeningStream = session
+				.listeningStream(sessionTransport);
+
+			asyncContext.addListener(new jakarta.servlet.AsyncListener() {
+				@Override
+				public void onComplete(jakarta.servlet.AsyncEvent event) throws IOException {
+					logger.debug("SSE connection completed for session: {}", sessionId);
+					listeningStream.close();
 				}
-			}
-			else {
-				// Establish new listening stream
-				McpStreamableServerSession.McpStreamableServerSessionStream listeningStream = session
-					.listeningStream(sessionTransport);
-
-				asyncContext.addListener(new jakarta.servlet.AsyncListener() {
-					@Override
-					public void onComplete(jakarta.servlet.AsyncEvent event) throws IOException {
-						logger.debug("SSE connection completed for session: {}", sessionId);
-						listeningStream.close();
-					}
 
-					@Override
-					public void onTimeout(jakarta.servlet.AsyncEvent event) throws IOException {
-						logger.debug("SSE connection timed out for session: {}", sessionId);
-						listeningStream.close();
-					}
+				@Override
+				public void onTimeout(jakarta.servlet.AsyncEvent event) throws IOException {
+					logger.debug("SSE connection timed out for session: {}", sessionId);
+					listeningStream.close();
+				}
 
-					@Override
-					public void onError(jakarta.servlet.AsyncEvent event) throws IOException {
-						logger.debug("SSE connection error for session: {}", sessionId);
-						listeningStream.close();
-					}
+				@Override
+				public void onError(jakarta.servlet.AsyncEvent event) throws IOException {
+					logger.debug("SSE connection error for session: {}", sessionId);
+					listeningStream.close();
+				}
 
-					@Override
-					public void onStartAsync(jakarta.servlet.AsyncEvent event) throws IOException {
-						// No action needed
-					}
-				});
-			}
+				@Override
+				public void onStartAsync(jakarta.servlet.AsyncEvent event) throws IOException {
+					// No action needed
+				}
+			});
 		}
 		catch (Exception e) {
 			logger.error("Failed to handle GET request for session {}: {}", sessionId, e.getMessage());
 			response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
 		}
 	}
 
+	/**
+	 * Replays the messages the client missed while its SSE stream was broken.
+	 * @param session the session the cli
```

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/spec/McpStreamableServerSession.java` (modified, +9/-3)
```diff
@@ -179,14 +179,20 @@ public Mono<Void> delete() {
 	}
 
 	/**
-	 * Create a listening stream (the generic HTTP GET request without Last-Event-ID
-	 * header).
+	 * Create a listening stream (the generic HTTP GET request, with or without a
+	 * Last-Event-ID header). A session addresses a single listening stream at a time, so
+	 * the stream being replaced, if any, is closed: no message would ever be sent to it
+	 * again, and leaving it open would leak the underlying connection.
 	 * @param transport The dedicated SSE transport stream
 	 * @return a stream representation
 	 */
 	public McpStreamableServerSessionStream listeningStream(McpStreamableServerTransport transport) {
 		McpStreamableServerSessionStream listeningStream = new McpStreamableServerSessionStream(transport);
-		this.listeningStreamRef.set(listeningStream);
+		McpLoggableSession replaced = this.listeningStreamRef.getAndSet(listeningStream);
+		if (replaced instanceof McpStreamableServerSessionStream replacedStream) {
+			logger.debug("Closing the listening stream replaced in session {}", this.id);
+			replacedStream.close();
+		}
 		return listeningStream;
 	}
 
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/HttpServletStreamableIntegrationTests.java` (modified, +101/-0)
```diff
@@ -12,6 +12,10 @@
 import java.nio.charset.StandardCharsets;
 import java.time.Duration;
 import java.util.Map;
+import java.util.Queue;
+import java.util.concurrent.CompletableFuture;
+import java.util.concurrent.ConcurrentLinkedQueue;
+import java.util.concurrent.atomic.AtomicBoolean;
 import java.util.concurrent.atomic.AtomicReference;
 import java.util.function.Function;
 import java.util.stream.Stream;
@@ -24,6 +28,7 @@
 import io.modelcontextprotocol.server.McpServer.SyncSpecification;
 import io.modelcontextprotocol.server.transport.HttpServletStreamableServerTransportProvider;
 import io.modelcontextprotocol.server.transport.TomcatTestUtil;
+import io.modelcontextprotocol.spec.HttpHeaders;
 import io.modelcontextprotocol.spec.McpSchema;
 import jakarta.servlet.http.HttpServletRequest;
 import jakarta.servlet.http.HttpServletResponse;
@@ -218,4 +223,100 @@ public void cancel() {
 		assertThat(response.statusCode()).isEqualTo(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
 	}
 
+	@Test
+	void resumedStreamReceivesServerNotifications() throws Exception {
+		prepareAsyncServerBuilder().serverInfo("test-server", "1.0.0").build();
+		var httpClient = HttpClient.newHttpClient();
+
+		var sessionId = initializeSession(httpClient);
+
+		// Resume the stream the way a client does once its SSE connection broke. The
+		// resumed stream must become the session listening stream, otherwise the
+		// reconnected client never receives anything again.
+		var stream = openListeningStream(httpClient, sessionId, sessionId + "_0");
+
+		awaitStreamOpen(stream);
+		awaitNotification(stream.events());
+	}
+
+	@Test
+	void replacedListeningStreamIsClosed() throws Exception {
+		prepareAsyncServerBuilder().serverInfo("test-server", "1.0.0").build();
+		var httpClient = HttpClient.newHttpClient();
+
+		var sessionId = initializeSession(httpClient);
+
+		var firstStream = openListeningStream(httpClient, sessionId, null);
+		awaitStreamOpen(firstStream);
+		awaitNotification(firstStream.events());
+
+		// stream keeps receiving pings, so we just ensure we've removed the notification
+		firstStream.events().clear();
+		assertThat(firstStream.events()).noneMatch(line -> line.contains("notifications/resources/list_changed"));
+
+		// Resuming installs a new listening stream. The session can no longer
+		// address the first one, so it must not be left open.
+		var secondStream = openListeningStream(httpClient, sessionId, sessionId + "_0");
+		assertThat(firstStream.streamFuture()).succeedsWithin(Duration.ofSeconds(5));
+		awaitStreamOpen(secondStream);
+		await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
+			mcpServerTransportProvider.notifyClients(McpSchema.METHOD_NOTIFICATION_RESOURCES_LIST_CHANGED, null)
+				.block();
+			assertThat(secondStream.events()).anyMatch(line -> line.contains("notifications/resources/list_changed"));
+			assertThat(firstStream.events()).noneMatch(line -> line.contains("notifications/resources/list_changed"));
+		});
+	}
+
+	private String initializeSession(HttpClient httpClient) throws Exception {
+		var initialize = HttpRequest.newBuilder()
+			.uri(URI.create("http://localhost:" + PORT + MESSAGE_ENDPOINT))
+			.header("Content-Type", "application/json")
+			.header("Accept", "text/event-stream, application/json")
+			.POST(HttpRequest.BodyPublishers.ofString("""
+					{"jsonrpc":"2.0","id":"init","method":"initialize","params":{
+					"protocolVersion":"2025-06-18","capabilities":{},
+					"clientInfo":{"name":"test-client","version":"1.0.0"}}}"""))
+			.build();
+
+		var response = httpClient.send(initialize, HttpResponse.BodyHandlers.ofString());
+		assertThat(response.statusCode()).isEqualTo(HttpServletResponse.SC_OK);
+		return response.headers().firstValue(HttpHeaders.MCP_SESSION_ID).orElseThrow();
+	}
+
+	/**
+	 * Opens an SSE listening stream with a GET request, collecting the received lines.
+	 * @return a future completing once the server closes the stream
+	 */
+	private StreamResponse openLis
```

---

### Incident Patch 4: `5be2fa06` (2026-09-07)
**Commit Message**: feat: introduce ServerHttpHeaderValidator replacing ServerTransportSecurityValidator

Same feature set as ServerTransportSecurityValidator but uses a lazy
"header accessor" function to read header values instead of extracting
all headers into a map. Matches more closely what modern frameworks and
JDK APIs do.

Fixes #870

Signed-off-by: Daniel Garnier-Moiroux <git@garnier.wf>

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/transport/DefaultServerTransportSecurityValidator.java` (modified, +50/-20)
```diff
@@ -7,6 +7,7 @@
 import java.util.ArrayList;
 import java.util.List;
 import java.util.Map;
+import java.util.Objects;
 
 import io.modelcontextprotocol.util.Assert;
 
@@ -22,7 +23,8 @@
  * @see ServerTransportSecurityValidator
  * @see ServerTransportSecurityException
  */
-public final class DefaultServerTransportSecurityValidator implements ServerTransportSecurityValidator {
+public final class DefaultServerTransportSecurityValidator
+		implements ServerTransportSecurityValidator, ServerHttpHeaderValidator {
 
 	private static final String ORIGIN_HEADER = "Origin";
 
@@ -47,27 +49,24 @@ private DefaultServerTransportSecurityValidator(List<String> allowedOrigins, Lis
 	}
 
 	@Override
+	@Deprecated
 	public void validateHeaders(Map<String, List<String>> headers) throws ServerTransportSecurityException {
-		boolean missingHost = true;
-		for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
-			if (ORIGIN_HEADER.equalsIgnoreCase(entry.getKey())) {
-				List<String> values = entry.getValue();
-				if (values == null || values.isEmpty()) {
-					throw new ServerTransportSecurityException(403, "Invalid Origin header");
-				}
-				validateOrigin(values.get(0));
-			}
-			else if (HOST_HEADER.equalsIgnoreCase(entry.getKey())) {
-				missingHost = false;
-				List<String> values = entry.getValue();
-				if (values == null || values.isEmpty()) {
-					throw new ServerTransportSecurityException(421, "Invalid Host header");
-				}
-				validateHost(values.get(0));
-			}
+		validate(new MapHeaderAccessor(headers));
+	}
+
+	@Override
+	public void validate(HeaderAccessor headerAccessor) throws ServerTransportSecurityException {
+		List<String> originValues = headerAccessor.getHeader(ORIGIN_HEADER);
+		if (originValues != null && !originValues.isEmpty()) {
+			validateOrigin(originValues.get(0));
 		}
-		if (!allowedHosts.isEmpty() && missingHost) {
-			throw new ServerTransportSecurityException(421, "Invalid Host header");
+
+		if (!allowedHosts.isEmpty()) {
+			List<String> hostValues = headerAccessor.getHeader(HOST_HEADER);
+			if (hostValues == null || hostValues.isEmpty()) {
+				throw new ServerTransportSecurityException(421, "Invalid Host header");
+			}
+			validateHost(hostValues.get(0));
 		}
 	}
 
@@ -139,6 +138,37 @@ public static Builder builder() {
 		return new Builder();
 	}
 
+	/**
+	 * {@link HeaderAccessor} view over a {@code Map<String, List<String>>}, used to
+	 * bridge the deprecated {@link #validateHeaders(Map)} to
+	 * {@link #validate(HeaderAccessor)}.
+	 */
+	private static final class MapHeaderAccessor implements HeaderAccessor {
+
+		private final Map<String, List<String>> headers;
+
+		private MapHeaderAccessor(Map<String, List<String>> headers) {
+			this.headers = headers;
+		}
+
+		@Override
+		public List<String> getHeader(String name) {
+			return headers.entrySet()
+				.stream()
+				.filter(entry -> entry.getKey().equalsIgnoreCase(name))
+				.map(Map.Entry::getValue)
+				.filter(Objects::nonNull)
+				.findFirst()
+				.orElse(List.of());
+		}
+
+		@Override
+		public List<String> getHeaderNames() {
+			return List.copyOf(headers.keySet());
+		}
+
+	}
+
 	/**
 	 * Builder for creating instances of {@link DefaultServerTransportSecurityValidator}.
 	 */
```

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/transport/HeaderAccessor.java` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+/*
+ * Copyright 2026-2026 the original author or authors.
+ */
+
+package io.modelcontextprotocol.server.transport;
+
+import java.util.List;
+
+/**
+ * Abstraction for accessing HTTP headers from an incoming request. Implementations should
+ * provide case-insensitive header name lookups (e.g., when backed by
+ * {@code HttpServletRequest}).
+ *
+ * @author Neeraj Bhatt
+ * @since 2.1.0
+ * @see ServerHttpHeaderValidator
+ */
+public interface HeaderAccessor {
+
+	/**
+	 * Returns the values of the specified header, or an empty list if the header is not
+	 * present.
+	 * @param name the header name (case-insensitive)
+	 * @return the list of header values, never {@code null}
+	 */
+	List<String> getHeader(String name);
+
+	/**
+	 * Returns all header names present in the request.
+	 * @return the list of header names, never {@code null}
+	 */
+	List<String> getHeaderNames();
+
+}
```

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/transport/HttpServletHeaderAccessor.java` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+/*
+ * Copyright 2026-2026 the original author or authors.
+ */
+
+package io.modelcontextprotocol.server.transport;
+
+import java.util.Collections;
+import java.util.List;
+
+import jakarta.servlet.http.HttpServletRequest;
+
+/**
+ * {@link HeaderAccessor} implementation backed by an {@link HttpServletRequest}. Header
+ * name lookups are case-insensitive as per the Servlet specification.
+ *
+ * <p>
+ * For internal use only.
+ *
+ * @author Neeraj Bhatt
+ * @since 2.1.0
+ * @see HeaderAccessor
+ */
+final class HttpServletHeaderAccessor implements HeaderAccessor {
+
+	private final HttpServletRequest request;
+
+	HttpServletHeaderAccessor(HttpServletRequest request) {
+		this.request = request;
+	}
+
+	@Override
+	public List<String> getHeader(String name) {
+		return Collections.list(this.request.getHeaders(name));
+	}
+
+	@Override
+	public List<String> getHeaderNames() {
+		return Collections.list(this.request.getHeaderNames());
+	}
+
+}
```

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/transport/HttpServletRequestUtils.java` (modified, +0/-20)
```diff
@@ -8,11 +8,6 @@
 import java.io.IOException;
 import java.io.InputStream;
 import java.nio.charset.StandardCharsets;
-import java.util.Collections;
-import java.util.Enumeration;
-import java.util.HashMap;
-import java.util.List;
-import java.util.Map;
 
 import jakarta.servlet.http.HttpServletRequest;
 
@@ -26,21 +21,6 @@ final class HttpServletRequestUtils {
 	private HttpServletRequestUtils() {
 	}
 
-	/**
-	 * Extracts all headers from the HTTP request into a map.
-	 * @param request The HTTP servlet request
-	 * @return A map of header names to their values
-	 */
-	static Map<String, List<String>> extractHeaders(HttpServletRequest request) {
-		Map<String, List<String>> headers = new HashMap<>();
-		Enumeration<String> names = request.getHeaderNames();
-		while (names.hasMoreElements()) {
-			String name = names.nextElement();
-			headers.put(name, Collections.list(request.getHeaders(name)));
-		}
-		return headers;
-	}
-
 	/**
 	 * Reads the request body, decoded using the request's character encoding (or UTF-8 if
 	 * not specified), while bounding the number of bytes read.
```

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/transport/HttpServletSseServerTransportProvider.java` (modified, +25/-12)
```diff
@@ -161,7 +161,7 @@ public class HttpServletSseServerTransportProvider extends HttpServlet implement
 	/**
 	 * Security validator for validating HTTP requests.
 	 */
-	private final ServerTransportSecurityValidator securityValidator;
+	private final ServerHttpHeaderValidator httpHeaderValidator;
 
 	/**
 	 * Creates a new HttpServletSseServerTransportProvider instance with a custom SSE
@@ -174,28 +174,28 @@ public class HttpServletSseServerTransportProvider extends HttpServlet implement
 	 * @param keepAliveInterval The interval for keep-alive pings, or null to disable
 	 * keep-alive functionality
 	 * @param contextExtractor The extractor for transport context from the request.
-	 * @param securityValidator The security validator for validating HTTP requests.
+	 * @param httpHeaderValidator The HTTP header validator for validating HTTP requests.
 	 * @param requestMaxSize The maximum size, in bytes, of a single request body. Must be
 	 * positive.
 	 */
 	private HttpServletSseServerTransportProvider(McpJsonMapper jsonMapper, String baseUrl, String messageEndpoint,
 			String sseEndpoint, Duration keepAliveInterval,
 			McpTransportContextExtractor<HttpServletRequest> contextExtractor,
-			ServerTransportSecurityValidator securityValidator, int requestMaxSize) {
+			ServerHttpHeaderValidator httpHeaderValidator, int requestMaxSize) {
 
 		Assert.notNull(jsonMapper, "JsonMapper must not be null");
 		Assert.notNull(messageEndpoint, "messageEndpoint must not be null");
 		Assert.notNull(sseEndpoint, "sseEndpoint must not be null");
 		Assert.notNull(contextExtractor, "Context extractor must not be null");
-		Assert.notNull(securityValidator, "Security validator must not be null");
+		Assert.notNull(httpHeaderValidator, "HTTP header validator must not be null");
 		Assert.isTrue(requestMaxSize > 0, "requestMaxSize must be positive");
 
 		this.jsonMapper = jsonMapper;
 		this.baseUrl = baseUrl;
 		this.messageEndpoint = messageEndpoint;
 		this.sseEndpoint = sseEndpoint;
 		this.contextExtractor = contextExtractor;
-		this.securityValidator = securityValidator;
+		this.httpHeaderValidator = httpHeaderValidator;
 		this.requestMaxSize = requestMaxSize;
 
 		if (keepAliveInterval != null) {
@@ -293,8 +293,7 @@ protected void doGet(HttpServletRequest request, HttpServletResponse response)
 		}
 
 		try {
-			Map<String, List<String>> headers = HttpServletRequestUtils.extractHeaders(request);
-			this.securityValidator.validateHeaders(headers);
+			this.httpHeaderValidator.validate(new HttpServletHeaderAccessor(request));
 		}
 		catch (ServerTransportSecurityException e) {
 			response.sendError(e.getStatusCode(), e.getMessage());
@@ -371,8 +370,7 @@ protected void doPost(HttpServletRequest request, HttpServletResponse response)
 		}
 
 		try {
-			Map<String, List<String>> headers = HttpServletRequestUtils.extractHeaders(request);
-			this.securityValidator.validateHeaders(headers);
+			this.httpHeaderValidator.validate(new HttpServletHeaderAccessor(request));
 		}
 		catch (ServerTransportSecurityException e) {
 			response.sendError(e.getStatusCode(), e.getMessage());
@@ -619,7 +617,7 @@ public static class Builder {
 
 		private Duration keepAliveInterval;
 
-		private ServerTransportSecurityValidator securityValidator = ServerTransportSecurityValidator.NOOP;
+		private ServerHttpHeaderValidator httpHeaderValidator = ServerHttpHeaderValidator.NOOP;
 
 		private int requestMaxSize = DEFAULT_REQUEST_MAX_SIZE;
 
@@ -702,10 +700,25 @@ public Builder keepAliveInterval(Duration keepAliveInterval) {
 		 * @param securityValidator The security validator to use. Must not be null.
 		 * @return This builder instance
 		 * @throws IllegalArgumentException if securityValidator is null
+		 * @deprecated Use {@link #httpHeaderValidator(ServerHttpHeaderValidator)}
+		 * instead.
 		 */
+		@Deprecated
 		public Builder securityValidator(ServerTransportSecurityValidator securityValidator) {
 			Assert.notNull(securityValidator, "Security vali
```

---

### Incident Patch 5: `59316252` (2026-08-31)
**Commit Message**: Fix integration tests for `roots/list`

There is a race condition where the GET /mcp SSE stream in Streamable
HTTP is established _after_ the server tries to send notifications. This
surfaces errors from the MCP client sending notifications and breaks
some integration tests.

We add a utility showing to ensure the stream is established before
sending server notifications.

Fixes #1114

Signed-off-by: Daniel Garnier-Moiroux <git@garnier.wf>

**File**: `mcp-test/src/main/java/io/modelcontextprotocol/AbstractMcpClientServerIntegrationTests.java` (modified, +11/-3)
```diff
@@ -82,6 +82,13 @@ public abstract class AbstractMcpClientServerIntegrationTests {
 
 	abstract protected McpServer.SyncSpecification<?> prepareSyncServerBuilder();
 
+	// There is, for Streamable HTTP, a race condition between establishing the SSE stream
+	// and the server sending notifications. This breaks some `roots/list` tests (and
+	// could in theory break sampling and elicitation tests). This utility method allows
+	// delaying the test until the stream is opened.
+	protected void awaitClientStreamEstablished() {
+	}
+
 	@ParameterizedTest(name = "{0} : {displayName} ")
 	@MethodSource("clientsForTesting")
 	void simple(String clientType) {
@@ -1082,6 +1089,7 @@ void testRootsSuccess(String clientType) {
 
 			InitializeResult initResult = mcpClient.initialize();
 			assertThat(initResult).isNotNull();
+			awaitClientStreamEstablished();
 
 			assertThat(rootsRef.get()).isNull();
 
@@ -1168,7 +1176,7 @@ void testRootsNotificationWithEmptyRootsList(String clientType) {
 
 			InitializeResult initResult = mcpClient.initialize();
 			assertThat(initResult).isNotNull();
-
+			awaitClientStreamEstablished();
 			mcpClient.rootsListChangedNotification();
 
 			await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
@@ -1201,7 +1209,7 @@ void testRootsWithMultipleHandlers(String clientType) {
 			.build()) {
 
 			assertThat(mcpClient.initialize()).isNotNull();
-
+			awaitClientStreamEstablished();
 			mcpClient.rootsListChangedNotification();
 
 			await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
@@ -1234,7 +1242,7 @@ void testRootsServerCloseWithActiveSubscription(String clientType) {
 
 			InitializeResult initResult = mcpClient.initialize();
 			assertThat(initResult).isNotNull();
-
+			awaitClientStreamEstablished();
 			mcpClient.rootsListChangedNotification();
 
 			await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/HttpServletStreamableIntegrationTests.java` (modified, +12/-2)
```diff
@@ -30,7 +30,6 @@
 import org.apache.catalina.LifecycleException;
 import org.apache.catalina.LifecycleState;
 import org.apache.catalina.startup.Tomcat;
-import org.awaitility.Awaitility;
 import org.junit.jupiter.api.AfterAll;
 import org.junit.jupiter.api.AfterEach;
 import org.junit.jupiter.api.BeforeAll;
@@ -42,6 +41,7 @@
 import reactor.test.StepVerifier;
 
 import static org.assertj.core.api.Assertions.assertThat;
+import static org.awaitility.Awaitility.await;
 
 @Timeout(15)
 class HttpServletStreamableIntegrationTests extends AbstractMcpClientServerIntegrationTests {
@@ -57,6 +57,16 @@ class HttpServletStreamableIntegrationTests extends AbstractMcpClientServerInteg
 
 	private HttpServletStreamableServerTransportProvider mcpServerTransportProvider;
 
+	@Override
+	protected void awaitClientStreamEstablished() {
+		var timeout = Duration.ofSeconds(5);
+		await().atMost(timeout).untilAsserted(() -> {
+			assertThat(MCP_SERVLET.isStreamEstablished())
+				.withFailMessage("[Failed to observe MCP Client connection within %s]", timeout)
+				.isTrue();
+		});
+	}
+
 	static Stream<Arguments> clientsForTesting() {
 		return Stream.of(Arguments.of("httpclient"));
 	}
@@ -151,7 +161,7 @@ void testMissingHandlerReturnsMethodNotFoundError() {
 				.verifyComplete();
 
 			// Wait until we've received the response
-			Awaitility.await().atMost(Duration.ofSeconds(1)).until(() -> response.get() != null);
+			await().atMost(Duration.ofSeconds(1)).until(() -> response.get() != null);
 
 			assertThat(response.get().error().code()).isEqualTo(McpSchema.ErrorCodes.METHOD_NOT_FOUND);
 			assertThat(response.get().error().message()).isEqualTo("Method not found: foo/bar");
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/transport/TomcatTestUtil.java` (modified, +18/-1)
```diff
@@ -7,14 +7,17 @@
 import java.io.IOException;
 import java.net.InetSocketAddress;
 import java.net.ServerSocket;
+import java.util.concurrent.atomic.AtomicBoolean;
 
 import jakarta.servlet.Filter;
 import jakarta.servlet.Servlet;
 import jakarta.servlet.ServletConfig;
 import jakarta.servlet.ServletException;
 import jakarta.servlet.ServletRequest;
 import jakarta.servlet.ServletResponse;
+import jakarta.servlet.http.HttpServletRequest;
 import org.apache.catalina.Context;
+import org.apache.catalina.Wrapper;
 import org.apache.catalina.startup.Tomcat;
 import org.apache.tomcat.util.descriptor.web.FilterDef;
 import org.apache.tomcat.util.descriptor.web.FilterMap;
@@ -41,7 +44,7 @@ public static Tomcat createTomcatServer(String contextPath, int port, Servlet se
 		Context context = tomcat.addContext(contextPath, baseDir);
 
 		// Add transport servlet to Tomcat
-		org.apache.catalina.Wrapper wrapper = context.createWrapper();
+		Wrapper wrapper = context.createWrapper();
 		wrapper.setName("mcpServlet");
 		wrapper.setServlet(servlet);
 		wrapper.setLoadOnStartup(1);
@@ -78,12 +81,19 @@ public static class DelegatingServlet implements Servlet {
 
 		private volatile Servlet delegate;
 
+		// Crude way of tracking whether a GET SSE stream has been established, to ensure
+		// a Streamable HTTP MCP Client is connected.
+		// This is an approximation: it switches to "true" whenever the handler is done
+		// servicing a GET request - even if the request is rejected or if it's a replay.
+		private final AtomicBoolean sseStreamEstablished = new AtomicBoolean(false);
+
 		/**
 		 * Sets the servlet handling subsequent requests. The delegate is not
 		 * {@link Servlet#init(ServletConfig) initialized}, since the MCP servlet
 		 * transports do not rely on their {@link ServletConfig}.
 		 */
 		public void setDelegate(Servlet delegate) {
+			this.sseStreamEstablished.set(false);
 			this.delegate = delegate;
 		}
 
@@ -104,6 +114,9 @@ public void service(ServletRequest request, ServletResponse response) throws Ser
 				throw new IllegalStateException("No delegate servlet has been set");
 			}
 			current.service(request, response);
+			if (request instanceof HttpServletRequest req && req.getMethod().equals("GET")) {
+				sseStreamEstablished.set(true);
+			}
 		}
 
 		@Override
@@ -116,6 +129,10 @@ public void destroy() {
 			this.delegate = null;
 		}
 
+		public boolean isStreamEstablished() {
+			return this.sseStreamEstablished.get();
+		}
+
 	}
 
 	/**
```

---

### Incident Patch 6: `fb029c8c` (2026-08-24)
**Commit Message**: Revert "Clean up AbstractMcpClientServerIntegrationTests"

This reverts commit 439dc90d253ded34daa4ad3e43c218345c34255a.
Spring AI still uses the old API from these tests because they have
muliple clients.

Signed-off-by: Daniel Garnier-Moiroux <git@garnier.wf>

**File**: `mcp-test/src/main/java/io/modelcontextprotocol/AbstractMcpClientServerIntegrationTests.java` (modified, +285/-128)
```diff
@@ -12,6 +12,7 @@
 import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
+import java.util.concurrent.ConcurrentHashMap;
 import java.util.concurrent.CopyOnWriteArrayList;
 import java.util.concurrent.CountDownLatch;
 import java.util.concurrent.TimeUnit;
@@ -49,10 +50,11 @@
 import io.modelcontextprotocol.spec.McpSchema.ServerCapabilities;
 import io.modelcontextprotocol.spec.McpSchema.TextContent;
 import io.modelcontextprotocol.spec.McpSchema.Tool;
-import io.modelcontextprotocol.spec.McpTransportException;
 import io.modelcontextprotocol.util.Utils;
 import net.javacrumbs.jsonunit.core.Option;
-import org.junit.jupiter.api.Test;
+import org.junit.jupiter.params.ParameterizedTest;
+import org.junit.jupiter.params.provider.MethodSource;
+import org.junit.jupiter.params.provider.ValueSource;
 import reactor.core.publisher.Mono;
 
 import static io.modelcontextprotocol.util.ToolsUtils.EMPTY_JSON_SCHEMA;
@@ -72,20 +74,26 @@ public abstract class AbstractMcpClientServerIntegrationTests {
 
 	protected static final int MAX_REQUEST_SIZE = 2048;
 
+	protected ConcurrentHashMap<String, McpClient.SyncSpec> clientBuilders = new ConcurrentHashMap<>();
+
+	abstract protected void prepareClients(int port, String mcpEndpoint);
+
 	abstract protected McpServer.AsyncSpecification<?> prepareAsyncServerBuilder();
 
 	abstract protected McpServer.SyncSpecification<?> prepareSyncServerBuilder();
 
-	abstract protected McpClient.SyncSpec getMcpClientBuilder();
+	@ParameterizedTest(name = "{0} : {displayName} ")
+	@MethodSource("clientsForTesting")
+	void simple(String clientType) {
+
+		var clientBuilder = clientBuilders.get(clientType);
 
-	@Test
-	void simple() {
 		var server = prepareAsyncServerBuilder().serverInfo("test-server", "1.0.0")
 			.requestTimeout(Duration.ofSeconds(1000))
 			.build();
 		try (
 				// Create client without sampling capabilities
-				var client = getMcpClientBuilder()
+				var client = clientBuilder
 					.clientInfo(McpSchema.Implementation.builder("Sample " + "client", "0.0.0").build())
 					.requestTimeout(Duration.ofSeconds(1000))
 					.build()) {
@@ -101,8 +109,12 @@ void simple() {
 	// ---------------------------------------
 	// Sampling Tests
 	// ---------------------------------------
-	@Test
-	void testCreateMessageWithoutSamplingCapabilities() {
+	@ParameterizedTest(name = "{0} : {displayName} ")
+	@MethodSource("clientsForTesting")
+	void testCreateMessageWithoutSamplingCapabilities(String clientType) {
+
+		var clientBuilder = clientBuilders.get(clientType);
+
 		McpServerFeatures.AsyncToolSpecification tool = McpServerFeatures.AsyncToolSpecification.builder()
 			.tool(Tool.builder("tool1", EMPTY_JSON_SCHEMA).description("tool1 description").build())
 			.callHandler((exchange, request) -> {
@@ -115,7 +127,7 @@ void testCreateMessageWithoutSamplingCapabilities() {
 
 		try (
 				// Create client without sampling capabilities
-				var client = getMcpClientBuilder()
+				var client = clientBuilder
 					.clientInfo(McpSchema.Implementation.builder("Sample " + "client", "0.0.0").build())
 					.build()) {
 
@@ -134,8 +146,12 @@ void testCreateMessageWithoutSamplingCapabilities() {
 		}
 	}
 
-	@Test
-	void testCreateMessageSuccess() {
+	@ParameterizedTest(name = "{0} : {displayName} ")
+	@MethodSource("clientsForTesting")
+	void testCreateMessageSuccess(String clientType) {
+
+		var clientBuilder = clientBuilders.get(clientType);
+
 		Function<CreateMessageRequest, CreateMessageResult> samplingHandler = request -> {
 			assertThat(request.messages()).hasSize(1);
 			assertThat(request.messages().get(0).content()).isInstanceOf(McpSchema.TextContent.class);
@@ -176,7 +192,7 @@ void testCreateMessageSuccess() {
 
 		var mcpServer = prepareAsyncServerBuilder().serverInfo("test-server", "1.0.0").tools(tool).build();
 
-		try (var mcpClient = getMcpClientBuilder()
+		try (var mcpClient = clientBuilder
 			.clientInfo(McpSchema.Implementation.builder("Sample client", "0.0.0").build())

```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/HttpServletSseIntegrationTests.java` (modified, +10/-9)
```diff
@@ -70,6 +70,12 @@ public void before() {
 		catch (Exception e) {
 			throw new RuntimeException("Failed to start Tomcat", e);
 		}
+
+		clientBuilders
+			.put("httpclient",
+					McpClient.sync(HttpClientSseClientTransport.builder("http://localhost:" + PORT)
+						.sseEndpoint(CUSTOM_SSE_ENDPOINT)
+						.build()).requestTimeout(Duration.ofHours(10)));
 	}
 
 	@Override
@@ -82,15 +88,6 @@ protected SyncSpecification<?> prepareSyncServerBuilder() {
 		return McpServer.sync(this.mcpServerTransportProvider);
 	}
 
-	@Override
-	protected McpClient.SyncSpec getMcpClientBuilder() {
-		return McpClient
-			.sync(HttpClientSseClientTransport.builder("http://localhost:" + PORT)
-				.sseEndpoint(CUSTOM_SSE_ENDPOINT)
-				.build())
-			.requestTimeout(Duration.ofHours(10));
-	}
-
 	@AfterEach
 	public void after() {
 		if (mcpServerTransportProvider != null) {
@@ -107,6 +104,10 @@ public void after() {
 		}
 	}
 
+	@Override
+	protected void prepareClients(int port, String mcpEndpoint) {
+	}
+
 	@Test
 	void rejectsWhenBodyBytesExceedLimitWithoutContentLengthHeader() throws Exception {
 		var httpClient = HttpClient.newHttpClient();
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/HttpServletStreamableIntegrationTests.java` (modified, +9/-9)
```diff
@@ -74,6 +74,12 @@ public void before() {
 		catch (Exception e) {
 			throw new RuntimeException("Failed to start Tomcat", e);
 		}
+
+		clientBuilders
+			.put("httpclient",
+					McpClient.sync(HttpClientStreamableHttpTransport.builder("http://localhost:" + PORT)
+						.endpoint(MESSAGE_ENDPOINT)
+						.build()).requestTimeout(Duration.ofHours(10)));
 	}
 
 	@Override
@@ -86,15 +92,6 @@ protected SyncSpecification<?> prepareSyncServerBuilder() {
 		return McpServer.sync(this.mcpServerTransportProvider);
 	}
 
-	@Override
-	protected McpClient.SyncSpec getMcpClientBuilder() {
-		return McpClient
-			.sync(HttpClientStreamableHttpTransport.builder("http://localhost:" + PORT)
-				.endpoint(MESSAGE_ENDPOINT)
-				.build())
-			.requestTimeout(Duration.ofHours(10));
-	}
-
 	@AfterEach
 	public void after() {
 		if (mcpServerTransportProvider != null) {
@@ -149,7 +146,10 @@ void testMissingHandlerReturnsMethodNotFoundError() {
 		finally {
 			mcpServer.close();
 		}
+	}
 
+	@Override
+	protected void prepareClients(int port, String mcpEndpoint) {
 	}
 
 	static McpTransportContextExtractor<HttpServletRequest> TEST_CONTEXT_EXTRACTOR = (r) -> McpTransportContext
```

---

### Incident Patch 7: `27b91521` (2026-08-07)
**Commit Message**: fix: stop pagination on empty cursors (#954)

Signed-off-by: Nanook <nanookclaw@users.noreply.github.com>
Co-authored-by: Nanook <nanookclaw@users.noreply.github.com>

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/client/McpAsyncClient.java` (modified, +21/-22)
```diff
@@ -818,13 +818,13 @@ private NotificationHandler asyncToolsChangeNotificationHandler(
 	 * @see #readResource(McpSchema.Resource)
 	 */
 	public Mono<McpSchema.ListResourcesResult> listResources() {
-		return this.listResources(McpSchema.FIRST_PAGE)
-			.expand(result -> (result.nextCursor() != null) ? this.listResources(result.nextCursor()) : Mono.empty())
-			.reduce(new ArrayList<McpSchema.Resource>(), (accumulated, result) -> {
-				accumulated.addAll(result.resources());
-				return accumulated;
-			})
-			.map(all -> McpSchema.ListResourcesResult.builder(Collections.unmodifiableList(all)).build());
+		return this.listResources(McpSchema.FIRST_PAGE).expand(result -> {
+			String next = result.nextCursor();
+			return (next != null && !next.isEmpty()) ? this.listResources(next) : Mono.empty();
+		}).reduce(new ArrayList<McpSchema.Resource>(), (accumulated, result) -> {
+			accumulated.addAll(result.resources());
+			return accumulated;
+		}).map(all -> McpSchema.ListResourcesResult.builder(Collections.unmodifiableList(all)).build());
 	}
 
 	/**
@@ -904,14 +904,13 @@ public Mono<McpSchema.ReadResourceResult> readResource(McpSchema.ReadResourceReq
 	 * @see McpSchema.ListResourceTemplatesResult
 	 */
 	public Mono<McpSchema.ListResourceTemplatesResult> listResourceTemplates() {
-		return this.listResourceTemplates(McpSchema.FIRST_PAGE)
-			.expand(result -> (result.nextCursor() != null) ? this.listResourceTemplates(result.nextCursor())
-					: Mono.empty())
-			.reduce(new ArrayList<McpSchema.ResourceTemplate>(), (accumulated, result) -> {
-				accumulated.addAll(result.resourceTemplates());
-				return accumulated;
-			})
-			.map(all -> McpSchema.ListResourceTemplatesResult.builder(Collections.unmodifiableList(all)).build());
+		return this.listResourceTemplates(McpSchema.FIRST_PAGE).expand(result -> {
+			String next = result.nextCursor();
+			return (next != null && !next.isEmpty()) ? this.listResourceTemplates(next) : Mono.empty();
+		}).reduce(new ArrayList<McpSchema.ResourceTemplate>(), (accumulated, result) -> {
+			accumulated.addAll(result.resourceTemplates());
+			return accumulated;
+		}).map(all -> McpSchema.ListResourceTemplatesResult.builder(Collections.unmodifiableList(all)).build());
 	}
 
 	/**
@@ -1024,13 +1023,13 @@ private NotificationHandler asyncResourcesUpdatedNotificationHandler(
 	 * @see #getPrompt(GetPromptRequest)
 	 */
 	public Mono<ListPromptsResult> listPrompts() {
-		return this.listPrompts(McpSchema.FIRST_PAGE)
-			.expand(result -> (result.nextCursor() != null) ? this.listPrompts(result.nextCursor()) : Mono.empty())
-			.reduce(new ArrayList<McpSchema.Prompt>(), (accumulated, result) -> {
-				accumulated.addAll(result.prompts());
-				return accumulated;
-			})
-			.map(all -> McpSchema.ListPromptsResult.builder(Collections.unmodifiableList(all)).build());
+		return this.listPrompts(McpSchema.FIRST_PAGE).expand(result -> {
+			String next = result.nextCursor();
+			return (next != null && !next.isEmpty()) ? this.listPrompts(next) : Mono.empty();
+		}).reduce(new ArrayList<McpSchema.Prompt>(), (accumulated, result) -> {
+			accumulated.addAll(result.prompts());
+			return accumulated;
+		}).map(all -> McpSchema.ListPromptsResult.builder(Collections.unmodifiableList(all)).build());
 	}
 
 	/**
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/client/McpAsyncClientTests.java` (modified, +123/-0)
```diff
@@ -8,6 +8,7 @@
 import java.util.Map;
 import java.util.Objects;
 import java.util.Set;
+import java.util.concurrent.atomic.AtomicInteger;
 import java.util.concurrent.atomic.AtomicReference;
 import java.util.function.Function;
 import java.util.stream.Collectors;
@@ -298,6 +299,42 @@ void testListPromptsWithCursorAndMeta() {
 
 	}
 
+	@Test
+	void listResourcesStopsOnEmptyNextCursor() {
+		var transport = new EmptyCursorTestMcpClientTransport(McpSchema.METHOD_RESOURCES_LIST);
+		McpAsyncClient client = McpClient.async(transport).build();
+
+		McpSchema.ListResourcesResult result = client.listResources().block();
+
+		assertThat(result).isNotNull();
+		assertThat(result.resources()).extracting(McpSchema.Resource::name).containsExactly("test.txt");
+		assertThat(transport.getRequestCount()).isEqualTo(1);
+	}
+
+	@Test
+	void listResourceTemplatesStopsOnEmptyNextCursor() {
+		var transport = new EmptyCursorTestMcpClientTransport(McpSchema.METHOD_RESOURCES_TEMPLATES_LIST);
+		McpAsyncClient client = McpClient.async(transport).build();
+
+		McpSchema.ListResourceTemplatesResult result = client.listResourceTemplates().block();
+
+		assertThat(result).isNotNull();
+		assertThat(result.resourceTemplates()).extracting(McpSchema.ResourceTemplate::name).containsExactly("template");
+		assertThat(transport.getRequestCount()).isEqualTo(1);
+	}
+
+	@Test
+	void listPromptsStopsOnEmptyNextCursor() {
+		var transport = new EmptyCursorTestMcpClientTransport(McpSchema.METHOD_PROMPT_LIST);
+		McpAsyncClient client = McpClient.async(transport).build();
+
+		McpSchema.ListPromptsResult result = client.listPrompts().block();
+
+		assertThat(result).isNotNull();
+		assertThat(result.prompts()).extracting(McpSchema.Prompt::name).containsExactly("test-prompt");
+		assertThat(transport.getRequestCount()).isEqualTo(1);
+	}
+
 	static class TestMcpClientTransport implements McpClientTransport {
 
 		private Function<Mono<McpSchema.JSONRPCMessage>, Mono<McpSchema.JSONRPCMessage>> handler;
@@ -397,4 +434,90 @@ public McpSchema.PaginatedRequest getCapturedRequest() {
 
 	}
 
+	static class EmptyCursorTestMcpClientTransport implements McpClientTransport {
+
+		private final String listMethod;
+
+		private final AtomicInteger requestCount = new AtomicInteger();
+
+		private Function<Mono<McpSchema.JSONRPCMessage>, Mono<McpSchema.JSONRPCMessage>> handler;
+
+		EmptyCursorTestMcpClientTransport(String listMethod) {
+			this.listMethod = listMethod;
+		}
+
+		@Override
+		public Mono<Void> connect(Function<Mono<McpSchema.JSONRPCMessage>, Mono<McpSchema.JSONRPCMessage>> handler) {
+			this.handler = handler;
+			return Mono.empty();
+		}
+
+		@Override
+		public Mono<Void> closeGracefully() {
+			return Mono.empty();
+		}
+
+		@Override
+		public Mono<Void> sendMessage(McpSchema.JSONRPCMessage message) {
+			if (!(message instanceof McpSchema.JSONRPCRequest request)) {
+				return Mono.empty();
+			}
+
+			McpSchema.JSONRPCResponse response;
+			if (McpSchema.METHOD_INITIALIZE.equals(request.method())) {
+				McpSchema.ServerCapabilities caps = McpSchema.ServerCapabilities.builder()
+					.prompts(false)
+					.resources(false, false)
+					.tools(false)
+					.build();
+
+				McpSchema.InitializeResult initResult = McpSchema.InitializeResult
+					.builder(ProtocolVersions.MCP_2024_11_05, caps, MOCK_SERVER_INFO)
+					.build();
+				response = McpSchema.JSONRPCResponse.result(request.id(), initResult);
+			}
+			else if (this.listMethod.equals(request.method())) {
+				this.requestCount.incrementAndGet();
+				response = McpSchema.JSONRPCResponse.result(request.id(), resultForMethod(request.method()));
+			}
+			else {
+				return Mono.empty();
+			}
+
+			return this.handler.apply(Mono.just(response)).then();
+		}
+
+		private Object resultForMethod(String method) {
+			if (McpSchema.METHOD_RESOURCES_LIST.equals(method)) {
+				McpSchema.Resource resource = McpSchema.Resource.builder("file:///test.txt", "test.txt").build();
+				return McpSchema.ListResource
```

---

### Incident Patch 8: `f5aab36a` (2026-08-07)
**Commit Message**: Fix SSE event classification to follow spec for missing event field (#913)

Per the SSE specification (WHATWG HTML Living Standard 9.2.6), an event with no explicit event field MUST be dispatched as a message event. HttpClientStreamableHttpTransport previously used strict equality and silently dropped such frames in the reconnect/GET stream path, causing server-initiated notifications to never reach the handler. Extract classification into a package-private isMessageEvent helper and cover with parameterized unit tests.

Closes gh-885

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/client/transport/HttpClientStreamableHttpTransport.java` (modified, +24/-1)
```diff
@@ -114,6 +114,29 @@ public class HttpClientStreamableHttpTransport implements McpClientTransport {
 
 	public static int BAD_REQUEST = 400;
 
+	/**
+	 * Determines whether an SSE event should be treated as a "message" event carrying a
+	 * JSON-RPC payload.
+	 *
+	 * <p>
+	 * Per the <a href=
+	 * "https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation">
+	 * SSE specification (WHATWG HTML Living Standard §9.2.6)</a>, an event with no
+	 * explicit {@code event:} field MUST be dispatched as a {@code message} event by
+	 * default. This method applies that rule by treating {@code null} or empty event
+	 * names as equivalent to {@link #MESSAGE_EVENT_TYPE}.
+	 *
+	 * <p>
+	 * This alignment ensures interoperability with MCP servers that emit bare
+	 * {@code data:} frames without an accompanying {@code event:} line, which are valid
+	 * per the SSE spec.
+	 * @param eventName the SSE event name, which may be {@code null} or empty
+	 * @return {@code true} if the event should be parsed as a JSON-RPC message
+	 */
+	static boolean isMessageEvent(String eventName) {
+		return eventName == null || eventName.isEmpty() || MESSAGE_EVENT_TYPE.equals(eventName);
+	}
+
 	private final McpJsonMapper jsonMapper;
 
 	private final URI baseUri;
@@ -323,7 +346,7 @@ else if (statusCode == METHOD_NOT_ALLOWED) {
 											+ statusCode));
 						}
 						else if (statusCode >= 200 && statusCode < 300) {
-							if (MESSAGE_EVENT_TYPE.equals(sseResponseEvent.sseEvent().event())) {
+							if (isMessageEvent(sseResponseEvent.sseEvent().event())) {
 								String data = sseResponseEvent.sseEvent().data();
 								// Per 2025-11-25 spec (SEP-1699), servers may
 								// send SSE events
```

**File**: `mcp-core/src/test/java/io/modelcontextprotocol/client/transport/HttpClientStreamableHttpTransportSseEventTypeTest.java` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+/*
+ * Copyright 2024-2026 the original author or authors.
+ */
+
+package io.modelcontextprotocol.client.transport;
+
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.params.ParameterizedTest;
+import org.junit.jupiter.params.provider.NullAndEmptySource;
+import org.junit.jupiter.params.provider.ValueSource;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+/**
+ * Unit tests for {@link HttpClientStreamableHttpTransport#isMessageEvent(String)}.
+ *
+ * <p>
+ * Verifies that SSE event classification follows the <a href=
+ * "https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation">
+ * WHATWG HTML Living Standard §9.2.6</a>: an event without an explicit {@code event:}
+ * field must be dispatched as a {@code message} event.
+ *
+ * @author jiajingda
+ * @see <a href="https://github.com/modelcontextprotocol/java-sdk/issues/885">#885</a>
+ */
+class HttpClientStreamableHttpTransportSseEventTypeTest {
+
+	@ParameterizedTest
+	@NullAndEmptySource
+	void shouldTreatNullOrEmptyEventAsMessage(String eventName) {
+		assertThat(HttpClientStreamableHttpTransport.isMessageEvent(eventName))
+			.as("SSE frame with null/empty event field must be treated as a 'message' event per SSE spec")
+			.isTrue();
+	}
+
+	@Test
+	void shouldTreatExplicitMessageEventAsMessage() {
+		assertThat(HttpClientStreamableHttpTransport.isMessageEvent("message"))
+			.as("Explicit 'message' event must be parsed as a JSON-RPC message")
+			.isTrue();
+	}
+
+	@ParameterizedTest
+	@ValueSource(strings = { "ping", "error", "notification", "MESSAGE", "Message", "custom-event" })
+	void shouldNotTreatOtherEventsAsMessage(String eventName) {
+		assertThat(HttpClientStreamableHttpTransport.isMessageEvent(eventName))
+			.as("Non-'message' SSE event '%s' must not be parsed as a JSON-RPC message", eventName)
+			.isFalse();
+	}
+
+}
\ No newline at end of file
```

---

### Incident Patch 9: `5d3deceb` (2026-07-08)
**Commit Message**: Fix error behavior on unregistered handlers in stateless server handler (#800)

Instead of throwing an McpError, it now returns with a JSON-RPC method not found error (-32601), aligned with the stateful implementation.

Closes #784

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/DefaultMcpStatelessServerHandler.java` (modified, +3/-3)
```diff
@@ -32,9 +32,9 @@ public Mono<McpSchema.JSONRPCResponse> handleRequest(McpTransportContext transpo
 			McpSchema.JSONRPCRequest request) {
 		McpStatelessRequestHandler<?> requestHandler = this.requestHandlers.get(request.method());
 		if (requestHandler == null) {
-			return Mono.error(McpError.builder(McpSchema.ErrorCodes.METHOD_NOT_FOUND)
-				.message("Missing handler for request type: " + request.method())
-				.build());
+			return Mono.just(new McpSchema.JSONRPCResponse(McpSchema.JSONRPC_VERSION, request.id(), null,
+					new McpSchema.JSONRPCResponse.JSONRPCError(McpSchema.ErrorCodes.METHOD_NOT_FOUND,
+							"Method not found: " + request.method(), null)));
 		}
 		return requestHandler.handle(transportContext, request.params())
 			.map(result -> McpSchema.JSONRPCResponse.result(request.id(), result))
```

**File**: `mcp-core/src/test/java/io/modelcontextprotocol/server/DefaultMcpStatelessServerHandlerTests.java` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+/*
+ * Copyright 2026-2026 the original author or authors.
+ */
+
+package io.modelcontextprotocol.server;
+
+import io.modelcontextprotocol.common.McpTransportContext;
+import io.modelcontextprotocol.spec.McpSchema;
+import org.junit.jupiter.api.Test;
+import reactor.test.StepVerifier;
+
+import java.util.Collections;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+class DefaultMcpStatelessServerHandlerTests {
+
+	@Test
+	void testHandleRequestWithUnregisteredMethod() {
+		// no request/initialization handlers
+		DefaultMcpStatelessServerHandler handler = new DefaultMcpStatelessServerHandler(Collections.emptyMap(),
+				Collections.emptyMap());
+
+		// unregistered method
+		McpSchema.JSONRPCRequest request = new McpSchema.JSONRPCRequest(McpSchema.JSONRPC_VERSION, "resources/list",
+				"test-id-123", null);
+
+		StepVerifier.create(handler.handleRequest(McpTransportContext.EMPTY, request)).assertNext(response -> {
+			assertThat(response).isNotNull();
+			assertThat(response.jsonrpc()).isEqualTo(McpSchema.JSONRPC_VERSION);
+			assertThat(response.id()).isEqualTo("test-id-123");
+			assertThat(response.result()).isNull();
+
+			assertThat(response.error()).isNotNull();
+			assertThat(response.error().code()).isEqualTo(McpSchema.ErrorCodes.METHOD_NOT_FOUND);
+			assertThat(response.error().message()).isEqualTo("Method not found: resources/list");
+		}).verifyComplete();
+	}
+
+}
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/HttpServletStatelessIntegrationTests.java` (modified, +46/-1)
```diff
@@ -9,6 +9,7 @@
 import java.util.Map;
 import java.util.concurrent.atomic.AtomicReference;
 import java.util.function.BiFunction;
+import java.util.function.Function;
 
 import io.modelcontextprotocol.client.McpClient;
 import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
@@ -45,6 +46,8 @@
 import org.springframework.mock.web.MockHttpServletRequest;
 import org.springframework.mock.web.MockHttpServletResponse;
 import org.springframework.web.client.RestClient;
+import reactor.core.publisher.Mono;
+import reactor.test.StepVerifier;
 
 import static io.modelcontextprotocol.server.transport.HttpServletStatelessServerTransport.APPLICATION_JSON;
 import static io.modelcontextprotocol.server.transport.HttpServletStatelessServerTransport.TEXT_EVENT_STREAM;
@@ -448,7 +451,7 @@ void testStructuredOutputOfObjectArrayValidationSuccess() {
 				"type", "object",
 				"properties", Map.of(
 					"name", Map.of("type", "string"),
-					"age", Map.of("type", "number")),					
+					"age", Map.of("type", "number")),
 				"required", List.of("name", "age"))); // @formatter:on
 
 		Tool calculatorTool = Tool.builder("getMembers")
@@ -765,6 +768,48 @@ void testThrownMcpErrorAndJsonRpcError() throws Exception {
 		mcpServer.close();
 	}
 
+	@Test
+	void testMissingHandlerReturnsMethodNotFoundError() {
+		var mcpServer = McpServer.sync(mcpStatelessServerTransport)
+			.serverInfo("test-server", "1.0.0")
+			.capabilities(ServerCapabilities.builder().build())
+			.build();
+		var clientTransport = HttpClientStreamableHttpTransport.builder("http://localhost:" + PORT)
+			.endpoint(CUSTOM_MESSAGE_ENDPOINT)
+			.build();
+
+		try (var mcpClient = McpClient.sync(clientTransport).build()) {
+			// Create a session using an MCP client
+			McpSchema.InitializeResult initResult = mcpClient.initialize();
+			assertThat(initResult).isNotNull();
+
+			// Override the response handler in the client to capture responses
+			AtomicReference<McpSchema.JSONRPCResponse> response = new AtomicReference<>();
+			var handler = (Function<Mono<McpSchema.JSONRPCMessage>, Mono<McpSchema.JSONRPCMessage>>) (
+					message) -> message.doOnNext(r -> {
+						if (r instanceof McpSchema.JSONRPCResponse resp) {
+							response.set(resp);
+						}
+					});
+			StepVerifier.create(clientTransport.connect(handler)).verifyComplete();
+
+			// Send a request for a non-existent method through the transport, bypassing
+			// the client's capability checks
+			StepVerifier
+				.create(clientTransport.sendMessage(new McpSchema.JSONRPCRequest("foo/bar", "test-request-123")))
+				.verifyComplete();
+
+			// Wait until we've received the response
+			await().atMost(Duration.ofSeconds(1)).until(() -> response.get() != null);
+
+			assertThat(response.get().error().code()).isEqualTo(McpSchema.ErrorCodes.METHOD_NOT_FOUND);
+			assertThat(response.get().error().message()).isEqualTo("Method not found: foo/bar");
+		}
+		finally {
+			mcpServer.closeGracefully();
+		}
+	}
+
 	private double evaluateExpression(String expression) {
 		// Simple expression evaluator for testing
 		return switch (expression) {
```

---

### Incident Patch 10: `301f8b06` (2026-05-30)
**Commit Message**: fix(server): return empty completion when handler is absent

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/McpAsyncServer.java` (modified, +1/-3)
```diff
@@ -1090,9 +1090,7 @@ private McpRequestHandler<McpSchema.CompleteResult> completionCompleteRequestHan
 			McpServerFeatures.AsyncCompletionSpecification specification = this.completions.get(request.ref());
 
 			if (specification == null) {
-				return Mono.error(McpError.builder(ErrorCodes.INVALID_PARAMS)
-					.message("AsyncCompletionSpecification not found: " + request.ref())
-					.build());
+				return EMPTY_COMPLETION_RESULT;
 			}
 
 			return Mono.defer(() -> specification.completionHandler().apply(exchange, request));
```

**File**: `mcp-core/src/main/java/io/modelcontextprotocol/server/McpStatelessAsyncServer.java` (modified, +1/-3)
```diff
@@ -815,9 +815,7 @@ private McpStatelessRequestHandler<McpSchema.CompleteResult> completionCompleteR
 			McpStatelessServerFeatures.AsyncCompletionSpecification specification = this.completions.get(request.ref());
 
 			if (specification == null) {
-				return Mono.error(McpError.builder(ErrorCodes.INVALID_PARAMS)
-					.message("AsyncCompletionSpecification not found: " + request.ref())
-					.build());
+				return EMPTY_COMPLETION_RESULT;
 			}
 
 			return specification.completionHandler().apply(ctx, request);
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/HttpServletStatelessIntegrationTests.java` (modified, +107/-0)
```diff
@@ -28,6 +28,9 @@
 import io.modelcontextprotocol.spec.McpSchema.Prompt;
 import io.modelcontextprotocol.spec.McpSchema.PromptArgument;
 import io.modelcontextprotocol.spec.McpSchema.PromptReference;
+import io.modelcontextprotocol.spec.McpSchema.ReadResourceResult;
+import io.modelcontextprotocol.spec.McpSchema.ResourceReference;
+import io.modelcontextprotocol.spec.McpSchema.ResourceTemplate;
 import io.modelcontextprotocol.spec.McpSchema.ServerCapabilities;
 import io.modelcontextprotocol.spec.McpSchema.TextContent;
 import io.modelcontextprotocol.spec.McpSchema.Tool;
@@ -230,6 +233,110 @@ void testCompletionShouldReturnExpectedSuggestions(String clientType) {
 		}
 	}
 
+	@ParameterizedTest(name = "{0} : Completion call without matching handler")
+	@ValueSource(strings = { "httpclient" })
+	void testCompletionWithoutMatchingHandlerReturnsEmptyResult(String clientType) {
+		var clientBuilder = clientBuilders.get(clientType);
+
+		BiFunction<McpTransportContext, CompleteRequest, CompleteResult> completionHandler = (transportContext,
+				request) -> new CompleteResult(new CompleteResult.CompleteCompletion(List.of("java"), 1, false));
+
+		var prompt = Prompt.builder("code_review")
+			.title("Code review")
+			.description("this is code review prompt")
+			.arguments(List
+				.of(PromptArgument.builder("language").title("Language").description("string").required(false).build()))
+			.build();
+
+		var otherPrompt = Prompt.builder("other_prompt")
+			.title("Other prompt")
+			.description("this prompt has completions")
+			.arguments(List
+				.of(PromptArgument.builder("topic").title("Topic").description("string").required(false).build()))
+			.build();
+
+		var mcpServer = McpServer.sync(mcpStatelessServerTransport)
+			.capabilities(ServerCapabilities.builder().completions().build())
+			.prompts(
+					new McpStatelessServerFeatures.SyncPromptSpecification(prompt,
+							(transportContext, getPromptRequest) -> null),
+					new McpStatelessServerFeatures.SyncPromptSpecification(otherPrompt,
+							(transportContext, getPromptRequest) -> null))
+			.completions(new McpStatelessServerFeatures.SyncCompletionSpecification(
+					PromptReference.builder("other_prompt").title("Other prompt").build(), completionHandler))
+			.build();
+
+		try (var mcpClient = clientBuilder.build()) {
+			InitializeResult initResult = mcpClient.initialize();
+			assertThat(initResult).isNotNull();
+
+			CompleteRequest request = CompleteRequest
+				.builder(PromptReference.builder("code_review").title("Code review").build(),
+						new CompleteRequest.CompleteArgument("language", "ja"))
+				.build();
+
+			CompleteResult result = mcpClient.completeCompletion(request);
+
+			assertThat(result.completion().values()).isEmpty();
+			assertThat(result.completion().total()).isZero();
+			assertThat(result.completion().hasMore()).isFalse();
+		}
+		finally {
+			mcpServer.close();
+		}
+	}
+
+	@ParameterizedTest(name = "{0} : Resource template completion call without matching handler")
+	@ValueSource(strings = { "httpclient" })
+	void testResourceTemplateCompletionWithoutMatchingHandlerReturnsEmptyResult(String clientType) {
+		var clientBuilder = clientBuilders.get(clientType);
+
+		BiFunction<McpTransportContext, CompleteRequest, CompleteResult> completionHandler = (transportContext,
+				request) -> new CompleteResult(new CompleteResult.CompleteCompletion(List.of("java"), 1, false));
+
+		var template = ResourceTemplate.builder("test://resource/{param}", "Test Resource")
+			.title("Test resource")
+			.description("A resource template for testing")
+			.mimeType("text/plain")
+			.build();
+
+		var otherTemplate = ResourceTemplate.builder("test://other/{param}", "Other Resource")
+			.title("Other resource")
+			.description("A resource template with completions")
+			.mimeType("text/plain")
+			.build();
+
+		var mcpServer = McpServer.sync(mcpStatelessServerTransport)
+			.capabilities(ServerCapabilities.builder().completions().build())
+			.
```

**File**: `mcp-test/src/test/java/io/modelcontextprotocol/server/McpCompletionTests.java` (modified, +95/-1)
```diff
@@ -31,6 +31,7 @@
 import io.modelcontextprotocol.spec.McpSchema.ReadResourceResult;
 import io.modelcontextprotocol.spec.McpSchema.Resource;
 import io.modelcontextprotocol.spec.McpSchema.ResourceReference;
+import io.modelcontextprotocol.spec.McpSchema.ResourceTemplate;
 import io.modelcontextprotocol.spec.McpSchema.PromptReference;
 import io.modelcontextprotocol.spec.McpSchema.ServerCapabilities;
 import io.modelcontextprotocol.spec.McpError;
@@ -179,6 +180,99 @@ void testCompletionBackwardCompatibility() {
 		mcpServer.close();
 	}
 
+	@Test
+	void testCompletionWithoutMatchingHandlerReturnsEmptyResult() {
+		BiFunction<McpSyncServerExchange, CompleteRequest, CompleteResult> completionHandler = (exchange,
+				request) -> new CompleteResult(new CompleteResult.CompleteCompletion(List.of("java"), 1, false));
+
+		McpSchema.Prompt prompt = Prompt.builder("code_review")
+			.description("this is a code review prompt")
+			.arguments(List.of(PromptArgument.builder("language").description("string").required(false).build()))
+			.build();
+
+		McpSchema.Prompt otherPrompt = Prompt.builder("other_prompt")
+			.description("this prompt has completions")
+			.arguments(List.of(PromptArgument.builder("topic").description("string").required(false).build()))
+			.build();
+
+		var mcpServer = McpServer.sync(mcpServerTransportProvider)
+			.capabilities(ServerCapabilities.builder().completions().build())
+			.prompts(
+					new McpServerFeatures.SyncPromptSpecification(prompt,
+							(mcpSyncServerExchange, getPromptRequest) -> null),
+					new McpServerFeatures.SyncPromptSpecification(otherPrompt,
+							(mcpSyncServerExchange, getPromptRequest) -> null))
+			.completions(new McpServerFeatures.SyncCompletionSpecification(new PromptReference("other_prompt"),
+					completionHandler))
+			.build();
+
+		try (var mcpClient = clientBuilder
+			.clientInfo(McpSchema.Implementation.builder("Sample " + "client", "0.0.0").build())
+			.build();) {
+			InitializeResult initResult = mcpClient.initialize();
+			assertThat(initResult).isNotNull();
+
+			CompleteRequest request = CompleteRequest
+				.builder(new PromptReference("code_review"), new CompleteRequest.CompleteArgument("language", "ja"))
+				.build();
+
+			CompleteResult result = mcpClient.completeCompletion(request);
+
+			assertThat(result.completion().values()).isEmpty();
+			assertThat(result.completion().total()).isZero();
+			assertThat(result.completion().hasMore()).isFalse();
+		}
+
+		mcpServer.close();
+	}
+
+	@Test
+	void testResourceTemplateCompletionWithoutMatchingHandlerReturnsEmptyResult() {
+		BiFunction<McpSyncServerExchange, CompleteRequest, CompleteResult> completionHandler = (exchange,
+				request) -> new CompleteResult(new CompleteResult.CompleteCompletion(List.of("java"), 1, false));
+
+		ResourceTemplate template = ResourceTemplate.builder("test://resource/{param}", "Test Resource")
+			.description("A resource template for testing")
+			.mimeType("text/plain")
+			.build();
+
+		ResourceTemplate otherTemplate = ResourceTemplate.builder("test://other/{param}", "Other Resource")
+			.description("A resource template with completions")
+			.mimeType("text/plain")
+			.build();
+
+		var mcpServer = McpServer.sync(mcpServerTransportProvider)
+			.capabilities(ServerCapabilities.builder().completions().build())
+			.resourceTemplates(
+					new McpServerFeatures.SyncResourceTemplateSpecification(template,
+							(exchange, req) -> ReadResourceResult.builder(List.of()).build()),
+					new McpServerFeatures.SyncResourceTemplateSpecification(otherTemplate,
+							(exchange, req) -> ReadResourceResult.builder(List.of()).build()))
+			.completions(new McpServerFeatures.SyncCompletionSpecification(
+					new ResourceReference("test://other/{param}"), completionHandler))
+			.build();
+
+		try (var mcpClient = clientBuilder
+			.clientInfo(McpSchema.Implementation.builder("Sample " + "client", "0.0.0").build())
+			.build();) {
+			InitializeResult initResult = mcpCli
```

#### Recent Merged Pull Requests:
- **PR #1135** (2026-09-17): Fix Automatic-Module-Name without hypens (@Kehrlann)
- **PR #1130** (2026-09-18): Streamable HTTP: Add session sweeping and close hanging streams (@Kehrlann)
- **PR #1127** (2026-09-08): Fix stream leak when resuming streams with LAST_EVENT_ID (@Kehrlann)
- **PR #1126** (2026-09-04): Remove 2024-11-05 protocol from Streamable HTTP transport (@Kehrlann)
- **PR #1122** (closed): Detect concealed characters in server metadata (@Adeniyikayodee)
- **PR #1119** (2026-09-01): Fix integration tests for `roots/list` (@Kehrlann)
- **PR #1118** (2026-08-31): Improve test performance (@Kehrlann)
- **PR #1117** (closed): ci: add workflow_dispatch trigger to CI workflow (@Kehrlann)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
