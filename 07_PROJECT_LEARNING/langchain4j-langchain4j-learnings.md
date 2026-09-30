# Forensic Learning Record (Deep Inspection): langchain4j/langchain4j

> **Canonical Artifact**: `07_PROJECT_LEARNING/langchain4j-langchain4j-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langchain4j/langchain4j](https://github.com/langchain4j/langchain4j))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:01:00.315Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langchain4j/langchain4j`
- **Description**: LangChain4j is an idiomatic, open-source Java library for building LLM-powered applications on the JVM. It offers a unified API over popular LLM providers and vector stores, and makes implementing tool calling (including MCP support), agents and RAG easy. It integrates seamlessly with enterprise Java frameworks like Quarkus and Spring Boot.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13180 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6529** (2026-09-29): **[BUG] `StreamableHttpMcpTransport` registers the client's reply to a server ping as a pending operation**
  *Symptoms*: <!-- Please provide as many details as possible, this will help us to deliver a fix as soon as possible. Thank you! -->  **Describe the bug** <!-- A clear and concise description of what the bug is. --> `StreamableHttpMcpTransport.sendMessage` goes through the same execute method as sendRequest, and execute registers the message id in the pending-operations map whenever the id is not null. sendMessage is meant for messages that expect no reply, so nothing should be registered. Notifications have no id and are fine, but a reply to a server-initiated request carries an id - the server's. That reply is registered and never completed, because nothing is ever going to answer it. The two transports that share a single channel already avoid this: StdioMcpTransport passes a null id and WebSocketMcpTransport passes null as well. Only the Streamable HTTP transport registers. There are two consequences. The entry stays in the pending-operations map for the lifetime of the client. And since the client and the server number their requests independently, a server id can be equal to the id of a client request that is still in flight; the registration then overwrites that request's future, and the request can only end in a timeout.  **Log and Stack trace** <!-- Please provide a log and a stack trace (with exception), if applicable. -->  **To Reproduce** <!-- Please provide a relevant code snippets to reproduce this bug. --> Any server that sends a ping request to the client, which is a commo

- **Issue #6494** (2026-09-29): **[BUG] MCP x-mcp-header confuses dotted property names with nested paths**
  *Symptoms*: <!-- Please provide as many details as possible, this will help us to deliver a fix as soon as possible. Thank you! -->  **Describe the bug**  When an MCP tool parameter annotated with `x-mcp-header` contains a literal `.` in its JSON property name, LangChain4j treats the dot as a nested-property separator.  For example, a top-level property named `config.region` can be confused with a nested `config -> region` property during MCP parameter header lookup.  As a result, LangChain4j may send the wrong value in the corresponding `Mcp-Param-*` HTTP header.  **Log and Stack trace**  Not applicable. No exception or stack trace is produced; the incorrect header value is sent silently.  **To Reproduce**  Use an MCP tool schema containing both a literal dotted property and a nested property:  ```json {   "type": "object",   "properties": {     "config.region": {       "type": "string",       "x-mcp-header": "Region"     },     "config": {       "type": "object",       "properties": {         "region": {           "type": "string"         }       }     }   } } ```  Then execute the tool with arguments such as:  ```json {   "config.region": "literal",   "config": {     "region": "nested"   } } ```  The current implementation resolves the annotated property through a dot-separated property path. In this case, the `Mcp-Param-Region` header is populated with:  ```text nested ```  instead of the value of the literal top-level property:  ```text literal ```  This is reproducible on the curre

- **Issue #6493** (2026-09-24): **[BUG] `Mcp-Param` headers are not sent on the non-blocking and multi-round-trip tools/call paths**
  *Symptoms*: **Describe the bug**  Tool parameters marked with x-mcp-header are sent as Mcp-Param- HTTP headers only when a tool is executed through the blocking path (McpClient.executeTool). When the same tool is executed through the non-blocking path (McpClient.executeToolAsync, used by AI Services whose method returns a CompletableFuture or a reactive type), the headers are silently dropped.  The x-mcp-header support was added in #5881 , which built the header map only inside DefaultMcpClient.executeTool. The non-blocking path had been added earlier in #5527  and was not updated, so there the McpCallContext is created without the header map.  A related gap in the same feature: on a multi-round-trip retry (input_required), the retried tools/call also carries no headers, so even the blocking path sends them on the first attempt only. Impact: a server declares x-mcp-header so that a gateway or proxy can route or authorize the call without parsing the body. With the header missing, such calls are rejected or misrouted, while the request body looks perfectly correct — which makes it hard to diagnose.  **Log and Stack trace**  na  **To Reproduce**  Server tool definition:  ```json {   "name": "query_database",   "inputSchema": {     "type": "object",     "properties": {       "tenant": { "type": "string", "x-mcp-header": "X-Tenant-Id" },       "sql": { "type": "string" }     }   } } ```  Client:  ```java McpClient client = new DefaultMcpClient.Builder()         .transport(StreamableHttpMcpTr

- **Issue #6460** (2026-09-21): **[BUG] AgenticScopeSerializer cannot round-trip UserMessage stored directly in AgenticScope state**
  *Symptoms*: **Describe the bug**  `AgenticScopeSerializer` cannot deserialize an `AgenticScope` when a `UserMessage` is stored directly in the scope state.  Serialization succeeds, but the generated JSON contains:  ```json "type": "USER" ```  inside the serialized `UserMessage`.  During deserialization, Jackson uses `UserMessage.Builder`, which does not accept a `type` property, so `AgenticScopeSerializer.fromJson()` fails with an `UnrecognizedPropertyException`.  The issue is reproducible on a plain JVM, without Quarkus, persistence, or native-image.  A similar problem can also be reproduced when `TextContent` or `AiMessage` are stored directly as arbitrary scope state values.  ---  **Log and Stack trace**  Generated JSON for a `UserMessage` stored in scope state:  ```json {   "memoryId": "...",   "kind": "EPHEMERAL",   "state": [     "java.util.concurrent.ConcurrentHashMap",     {       "candidate": [         "dev.langchain4j.data.message.UserMessage",         {           "contents": [             "java.util.Collections$UnmodifiableRandomAccessList",             [               {                 "text": "hello",                 "type": "TEXT"               }             ]           ],           "type": "USER"         }       ]     }   ],   "agentInvocations": [     "java.util.Collections$SynchronizedRandomAccessList",     []   ],   "context": [     "java.util.Collections$SynchronizedRandomAccessList",     []   ] } ```  `AgenticScopeSerializer.fromJson()` then fails with:  ```text java.
  **Post-Mortem & Fix Analysis**:
  > opened #6465 for this. It covers `UserMessage`, the other message and content types, and messages kept inside a list or map in the scope state. 

- **Issue #6419** (2026-09-16): **[BUG] Regression in 1.20.0: Bedrock streaming tool calls NPE in `ToolService.toResultMessage` when `arguments` has 2+ keys and a custom `.toolExecutor(...)` is configured**
  *Symptoms*: ### Describe the bug  When using `AiServices` with a custom `.toolExecutor(...)` (an async executor for tool calls) together with `langchain4j-bedrock`'s `BedrockStreamingChatModel`, a tool call whose `arguments` is a JSON object with **2 or more keys** deterministically throws:  NullPointerException: Cannot invoke "dev.langchain4j.service.tool.ToolExecutionResult.resultContents()" because "result" is null  **This is a regression: confirmed absent on `1.14.1`, confirmed present on `1.20.0`**, with the same application code and the same tool. Diffing the actual sources of both releases pinpoints exactly what changed (see "Root cause" below) — this isn't a long-standing latent bug, it was introduced by a specific refactor.  The NPE is thrown inside `dev.langchain4j.service.tool.ToolService.toResultMessage`, called from `ToolService.processToolResults` (line numbers below are from the `1.20.0` release tag):  ```java public ToolResultsOutcome processToolResults(         AiServiceContext context,         List<ToolExecutionRequest> toolExecutionRequests,         Map<ToolExecutionRequest, ToolExecutionResult> toolResults,         List<ToolExecution> toolExecutions,         InvocationContext invocationContext,         ToolServiceContext toolServiceContext) {     ...     for (ToolExecutionRequest request : toolExecutionRequests) {         ToolExecutionResult result = toolResults.get(request);         resultMessages.add(toResultMessage(request, result));  // NPEs here when result == nu

- **Issue #6391** (2026-09-14): **[BUG] Supervisor agent card still renders collection and array argument types as `{}`**
  *Symptoms*: ## Describe the bug  This is the second of the two causes listed in #6226. That issue got closed by #6240 (my PR), which fixed cause 1 only. Cause 2, the rendered card, is still there on main.  Any sub-agent with a generic argument gets it thrown away in the planner prompt. Test interface:  ```java interface SearchSubAgent {      @Agent("Searches records in the backing system")     String search(@V("recordType") String recordType, @V("fields") List<String> fields); } ```  The planner's system message comes out like this:  ``` The comma separated list of available agents is: '{'search$0', 'Searches records in the backing system', [recordType: String, fields: {}]}' ```  `recordType` renders fine. `fields`, declared as `List<String>`, shows up as `{}`.  Where it goes wrong. `SupervisorPlanner.argumentDescription(AgentArgument)` on main (`0028928`) calls `arg.rawType()` at lines 138 and 140:  ```java private static String argumentDescription(AgentArgument arg) {     String description = arg.description();     if (description != null && !description.isBlank()) {         return argumentDescription(arg.rawType(), arg.name()) + " - " + description;     }     return argumentDescription(arg.rawType(), arg.name()); } ```  `rawType()` on `AgentArgument` (`AgentArgument.java:24`) delegates to `AgentUtil.rawType(Type)` (`AgentUtil.java:451`), which for a `ParameterizedType` returns `getRawType()`. So `List<String>` is already `List.class` by the time the renderer sees it.  `List` is an int

- **Issue #6382** (2026-09-14): **[BUG] watsonx and Gemini enum conversions depend on the JVM default locale**
  *Symptoms*: **Describe the bug**  Several enum conversions use `toUpperCase()` or `toLowerCase()` without an explicit locale.  This problem is similar to the issue [#6347](https://github.com/langchain4j/langchain4j/issues/6347). Under Turkish or Azerbaijani locales:  1. `WatsonxExceptionMapper` calls `error.code().toUpperCase()`: the `i` of `invalid_input_argument` becomes `İ` and no longer matches `INVALID_INPUT_ARGUMENT`, so error handling falls back to the HTTP status. With HTTP 500, this returns `InternalServerException` instead of `InvalidRequestException`. 2. in `langchain4j-google-ai-gemini`: `GeminiType`, `GeminiLanguage` and `GeminiOutcome` also produce strings containing dotless `ı`, such as `ınteger` and `outcome_faıled`. These also appear in JSON when using the optional Jackson 3 codec. Default Jackson 2 serialization is unaffected.  **Expected behavior:**  enum conversions should be independent of the JVM default locale. Use `Locale.ROOT` at the affected sites.
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this issue. My plan: Add Locale.ROOT to the enum conversions in WatsonxExceptionMapper and the Gemini enums (GeminiType / GeminiLanguage / GeminiOutcome) Add a Turkish-locale regression test, mirroring the fix in #6348 / #6346 Run ./mvnw spotless:apply and unit tests in the affected modules I'll open a PR referencing this issue shortly.
  > Let me know if someone is already on it 
  > @zhengqiangtan there are already 2 PRs for this issue, don't you see it?

- **Issue #6380** (2026-09-14): **[BUG] Elasticsearch removeAll(Filter) can miss unrefreshed writes**
  *Symptoms*: **Describe the bug**  ElasticsearchEmbeddingStore.removeAll(Filter) can return normally while matching, acknowledged writes remain in the index when those writes have not yet been refreshed.  For example, a document version can be written successfully and then immediately removed by metadata filter. After removal returns and the index is explicitly refreshed, the supposedly removed embeddings are still present.  Elasticsearch itself follows its documented search-snapshot semantics. This report concerns how that behavior is exposed through the embedding store's filtered removal API.  **Log and Stack trace**  No exception is thrown in the reproduced cases.  An independent Elasticsearch REST control returned: - total: 0 - deleted: 0 - version_conflicts: 0 - timed_out: false - failures: []  After an explicit refresh, both real-time GET and vector search still found the target document.  **To Reproduce**  1. Create a fresh Elasticsearch test index. Set refresh_interval to -1 to keep the visibility window deterministic. 2. Add embeddings with metadata version=old and version=current. 3. Immediately call removeAll(metadataKey("version").isEqualTo("old")), without refreshing first. 4. Explicitly refresh the index after removal. 5. Check the stored IDs: both old and current remain. 6. Repeat with a refresh before removal: old is deleted and current is preserved.  The same missed deletion was also reproduced three times with default automatic refresh enabled. Disabling refresh is only 

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

### Incident Patch 1: `1a277ed6` (2026-09-30)
**Commit Message**: fix(a2a): preserve @A2ATenantId positional arg when tenant is pre-con… (#6548)

…figured

Dropping the arg caused Method.invoke() to fail with too few positional
args. Map it to an equivalent arg with the configured tenant as its
default value instead of filtering it out.

<!--
Thank you so much for your contribution!

Please fill in all the sections below.
Please open the PR as ready for review (not as a draft), with tests and
documentation already included.
Please note that PRs with breaking changes, or without tests and
documentation, will be rejected.

Please note that PRs will be reviewed based on the priority of the
issues they address.
We ask for your patience. We are doing our best to review your PR as
quickly as possible.
Please refrain from pinging and asking when it will be reviewed. Thank
you for understanding!
-->

## Issue
<!-- Please specify the ID of the issue this PR is addressing. For
example: "Closes #1234" or "Fixes #1234" -->
Closes #

## Change
<!-- Please describe the changes you made. -->


## General checklist
<!-- Please double-check the following points and mark them like this:
[X] -->
- [X] There are no breaking changes (API, behaviour)
- [X] I have adde

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/A2AClientAgentInvoker.java` (modified, +29/-9)
```diff
@@ -43,25 +43,45 @@ public A2AClientAgentInvoker(A2AClientInstance a2AClientInstance, Method method)
         this.arguments = arguments(a2AClientInstance);
     }
 
+    /**
+     * Builds the argument list for the agent method.
+     *
+     * <p>All three A2A protocol annotation types ({@link A2ATenantId}, {@link A2AContextId},
+     * {@link A2ATaskId}) are marked optional so they resolve gracefully at invocation time:
+     * context and task IDs fall back to {@code null} when absent from scope; a tenant arg
+     * falls back to its {@code defaultValue} when absent from scope.
+     *
+     * <p>When a tenant is pre-configured on the client, the tenant arg is mapped to an
+     * {@link AgentArgument} carrying the configured value as its {@code defaultValue}.
+     * The arg is intentionally kept in the list: removing it would shorten the positional
+     * array and cause {@link java.lang.reflect.Method#invoke} to fail with a wrong argument
+     * count. The pre-configured value is used at invocation time unless the scope already
+     * contains a value for that argument, in which case the scope value takes precedence.
+     */
     private List<AgentArgument> arguments(A2AClientInstance a2AClientInstance) {
         if (isUntyped()) {
             return Stream.of(a2AClientInstance.inputKeys())
                     .map(input -> new AgentArgument(Object.class, input))
                     .toList();
         }
-        Set<String> optionalProtocolArgs = Stream.of(method.getParameters())
-                .filter(p -> (p.isAnnotationPresent(A2AContextId.class)
-                                || p.isAnnotationPresent(A2ATaskId.class)
-                                || p.isAnnotationPresent(A2ATenantId.class))
-                        && ParameterNameResolver.hasName(p))
+        Set<String> tenantArgNames = Stream.of(method.getParameters())
+                .filter(p -> p.isAnnotationPresent(A2ATenantId.class) && ParameterNameResolver.hasName(p))
                 .map(ParameterNameResolver::name)
                 .collect(Collectors.toSet());
+        Set<String> optionalProtocolArgs = Stream.concat(
+                        tenantArgNames.stream(),
+                        Stream.of(method.getParameters())
+                                .filter(p -> (p.isAnnotationPresent(A2AContextId.class)
+                                                || p.isAnnotationPresent(A2ATaskId.class))
+                                        && ParameterNameResolver.hasName(p))
+                                .map(ParameterNameResolver::name))
+                .collect(Collectors.toSet());
         if (a2AClientInstance.tenant() != null) {
+            String configuredTenant = a2AClientInstance.tenant();
             return argumentsFromMethod(method, optionalProtocolArgs).stream()
-                    .filter(arg -> Stream.of(method.getParameters())
-                            .noneMatch(p -> p.isAnnotationPresent(A2ATenantId.class)
-                                    && ParameterNameResolver.hasName(p)
-                                    && ParameterNameResolver.name(p).equals(arg.name())))
+                    .map(arg -> tenantArgNames.contains(arg.name())
+                            ? new AgentArgument(arg.type(), arg.name(), configuredTenant, true, arg.description())
+                            : arg)
                     .toList();
         }
         return argumentsFromMethod(method, optionalProtocolArgs);
```

**File**: `langchain4j-agentic-a2a/src/test/java/dev/langchain4j/agentic/a2a/A2ATenantIdTest.java` (modified, +59/-4)
```diff
@@ -10,7 +10,9 @@
 import static org.mockito.Mockito.verify;
 import static org.mockito.Mockito.when;
 
+import dev.langchain4j.agentic.internal.AgentInvocationArguments;
 import dev.langchain4j.agentic.planner.AgentArgument;
+import dev.langchain4j.agentic.scope.DefaultAgenticScope;
 import dev.langchain4j.service.V;
 import java.lang.reflect.Method;
 import java.util.List;
@@ -58,8 +60,6 @@ void setUp() {
                 .build();
     }
 
-    // --- A2AClientAgentInvoker argument tests ---
-
     @Test
     void tenantId_parameter_is_optional_in_invoker_arguments() throws NoSuchMethodException {
         A2AClientInstance clientInstance = mock(A2AClientInstance.class);
@@ -78,6 +78,63 @@ void tenantId_parameter_is_optional_in_invoker_arguments() throws NoSuchMethodEx
         assertThat(args.get(1).isOptional()).isTrue();
     }
 
+    @Test
+    void preconfigured_tenant_argument_retains_default_value_in_arguments_list() throws NoSuchMethodException {
+        A2AClientInstance clientInstance = mock(A2AClientInstance.class);
+        when(clientInstance.agentCard()).thenReturn(agentCard);
+        when(clientInstance.tenant()).thenReturn("pre-configured-tenant");
+
+        Method chatMethod = TenantAwareAgent.class.getMethod("chat", String.class, String.class);
+        A2AClientAgentInvoker invoker = new A2AClientAgentInvoker(clientInstance, chatMethod);
+
+        List<AgentArgument> args = invoker.arguments();
+
+        assertThat(args).hasSize(2);
+        assertThat(args.get(0).name()).isEqualTo("question");
+        assertThat(args.get(1).name()).isEqualTo("tenant");
+        assertThat(args.get(1).isOptional()).isTrue();
+        assertThat(args.get(1).defaultValue()).isEqualTo("pre-configured-tenant");
+    }
+
+    @Test
+    void preconfigured_tenant_produces_correct_positional_arg_count() throws NoSuchMethodException {
+        A2AClientInstance clientInstance = mock(A2AClientInstance.class);
+        when(clientInstance.agentCard()).thenReturn(agentCard);
+        when(clientInstance.tenant()).thenReturn("pre-configured-tenant");
+
+        Method chatMethod = TenantAwareAgent.class.getMethod("chat", String.class, String.class);
+        A2AClientAgentInvoker invoker = new A2AClientAgentInvoker(clientInstance, chatMethod);
+
+        DefaultAgenticScope scope = DefaultAgenticScope.ephemeralAgenticScope();
+        scope.writeState("question", "hello");
+
+        AgentInvocationArguments args = invoker.toInvocationArguments(scope);
+
+        assertThat(args.positionalArgs()).hasSize(2);
+        assertThat(args.positionalArgs()[0]).isEqualTo("hello");
+        assertThat(args.positionalArgs()[1]).isEqualTo("pre-configured-tenant");
+    }
+
+    @Test
+    void scope_value_takes_precedence_over_preconfigured_tenant() throws NoSuchMethodException {
+        A2AClientInstance clientInstance = mock(A2AClientInstance.class);
+        when(clientInstance.agentCard()).thenReturn(agentCard);
+        when(clientInstance.tenant()).thenReturn("pre-configured-tenant");
+
+        Method chatMethod = TenantAwareAgent.class.getMethod("chat", String.class, String.class);
+        A2AClientAgentInvoker invoker = new A2AClientAgentInvoker(clientInstance, chatMethod);
+
+        DefaultAgenticScope scope = DefaultAgenticScope.ephemeralAgenticScope();
+        scope.writeState("question", "hello");
+        scope.writeState("tenant", "scope-tenant");
+
+        AgentInvocationArguments args = invoker.toInvocationArguments(scope);
+
+        assertThat(args.positionalArgs()).hasSize(2);
+        assertThat(args.positionalArgs()[0]).isEqualTo("hello");
+        assertThat(args.positionalArgs()[1]).isEqualTo("scope-tenant");
+    }
+
     @Test
     void contextId_and_tenantId_parameters_are_both_optional_in_invoker_arguments() throws NoSuchMethodException {
         A2AClientInstance clientInstance = mock(A2AClientInstance.class);
@@ -97,8 +154,6 @@ void contextId_and_tenantId_parameters_are_both_optional_in_invoker_argument
```

---

### Incident Patch 2: `99b171f7` (2026-09-30)
**Commit Message**: fix(a2a): treat blank tenant as absent and expose tenant-aware a2aBuilder overloads (#6546)

- Normalize empty/null tenant to null in DefaultA2AClientBuilder to
restore auto-detection from agent card
- Add a2aBuilder(url, tenant, class) overloads to AgenticServices and
DefaultA2AService
- Warn in A2AService default method when tenant is silently dropped by
legacy implementations
- Bump a2a-java-sdk 1.3.1 → 1.4.0

<!--
Thank you so much for your contribution!

Please fill in all the sections below.
Please open the PR as ready for review (not as a draft), with tests and
documentation already included.
Please note that PRs with breaking changes, or without tests and
documentation, will be rejected.

Please note that PRs will be reviewed based on the priority of the
issues they address.
We ask for your patience. We are doing our best to review your PR as
quickly as possible.
Please refrain from pinging and asking when it will be reviewed. Thank
you for understanding!
-->

## Issue
<!-- Please specify the ID of the issue this PR is addressing. For
example: "Closes #1234" or "Fixes #1234" -->
Closes #

## Change
<!-- Please describe the changes you made. -->


## General checklist
<!-- P

**File**: `docs/docs/tutorials/agents.md` (modified, +47/-1)
```diff
@@ -3170,7 +3170,45 @@ In this sequence, the first agent sends a message with no `contextId`/`taskId` (
 
 ### Multi-tenant A2A agents
 
-In a multi-tenant A2A deployment, messages must be scoped to a specific tenant so the server can apply the correct routing, isolation, and policies. The `@A2ATenantId` annotation marks a method parameter whose value is set as the `tenant` field on the outgoing `MessageSendParams` — it is **not** included as a `TextPart` in the message content.
+In a multi-tenant A2A deployment, messages must be scoped to a specific tenant so the server can apply the correct routing, isolation, and policies. The `langchain4j-agentic-a2a` module supports three ways to configure the tenant, depending on whether it is fixed, dynamic, or derived automatically from the server URL.
+
+#### Auto-detection from the agent card URL
+
+When no tenant is configured, the client automatically extracts it from the agent card URL. A multi-tenant A2A server typically follows the convention `/.well-known/{tenant}/agent-card.json`. If the agent card URL matches this pattern, the extracted tenant is silently applied to every outgoing message — no configuration is needed.
+
+#### Static tenant via the `@A2AClientAgent` annotation
+
+When the tenant is known at build time and is the same for every call, set the `tenant` attribute directly on the `@A2AClientAgent` annotation:
+
+```java
+public interface MyA2AAgent {
+
+    @A2AClientAgent(a2aServerUrl = "http://localhost:8080", tenant = "acme", outputKey = "response")
+    String chat(@V("question") String question);
+}
+```
+
+The tenant is set on `MessageSendParams` for every message sent by this agent — no method parameter is needed. It is **not** included as a `TextPart` in the message content. Setting `tenant` in the annotation takes precedence over auto-detection from the agent card URL.
+
+When building programmatically, pass the tenant as the second argument to `a2aBuilder`:
+
+```java
+UntypedAgent agent = AgenticServices
+        .a2aBuilder("http://localhost:8080", "acme")
+        .inputKeys("question")
+        .outputKey("response")
+        .build();
+
+// Or with a typed interface:
+MyA2AAgent agent = AgenticServices
+        .a2aBuilder("http://localhost:8080", "acme", MyA2AAgent.class)
+        .outputKey("response")
+        .build();
+```
+
+#### Dynamic tenant via `@A2ATenantId`
+
+When the tenant varies per call, annotate a method parameter with `@A2ATenantId`. The parameter value is set as the `tenant` field on the outgoing `MessageSendParams` — it is **not** included as a `TextPart` in the message content.
 
 ```java
 public interface MyA2AAgent {
@@ -3199,6 +3237,14 @@ public interface MultiTenantChatAgent {
 
 Unlike `@A2AContextId` and `@A2ATaskId`, the tenant value is never written back to the `AgenticScope` by the server — the caller is responsible for supplying it on every invocation.
 
+#### Summary: tenant resolution order
+
+| Approach | When to use |
+|---|---|
+| Auto-detection from agent card URL | Server URL follows `/.well-known/{tenant}/agent-card.json` and tenant is constant |
+| `tenant` on `@A2AClientAgent` (or `a2aBuilder(url, tenant, ...)`) | Tenant is fixed and known at build time |
+| `@A2ATenantId` method parameter | Tenant varies per call |
+
 ### Human-in-the-loop A2A agents
 
 An A2A server can pause a task in the `input-required` or `auth-required` state. When this happens inside an agentic system, the A2A client stores a `SuspendedResponse` in the `AgenticScope`, checkpoints the workflow, and releases the calling thread. The interruption contains the task and context IDs required to continue the same remote task.
```

**File**: `langchain4j-agentic-a2a/pom.xml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     </developers>
 
     <properties>
-        <a2a-java-sdk-version>1.3.1.Final</a2a-java-sdk-version>
+        <a2a-java-sdk-version>1.4.0.Final</a2a-java-sdk-version>
     </properties>
 
     <dependencyManagement>
```

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/DefaultA2AClientBuilder.java` (modified, +14/-8)
```diff
@@ -95,11 +95,12 @@ private record A2AInvocationResult(
     }
 
     DefaultA2AClientBuilder(String a2aServerUrl, Class<T> agentServiceClass, String tenant) {
-        this.agentCard = agentCard(a2aServerUrl, tenant);
+        String effectiveTenant = (tenant != null && !tenant.isEmpty()) ? tenant : null;
+        this.agentCard = agentCard(a2aServerUrl, effectiveTenant);
         this.name = agentCard.name();
         this.agentId = this.name;
         this.agentServiceClass = agentServiceClass;
-        this.tenant = tenant != null ? tenant : extractTenantFromAgentCard(agentCard);
+        this.tenant = effectiveTenant != null ? effectiveTenant : extractTenantFromAgentCard(agentCard);
     }
 
     // For testing only: bypasses URL fetch and pre-sets the client.
@@ -631,13 +632,18 @@ public DefaultA2AClientBuilder<T> tenant(String tenant) {
     }
 
     static String extractTenantFromAgentCard(AgentCard agentCard) {
-        if (agentCard == null || agentCard.supportedInterfaces() == null) {
+        try {
+            if (agentCard == null || agentCard.supportedInterfaces() == null) {
+                return null;
+            }
+            return agentCard.supportedInterfaces().stream()
+                    .map(AgentInterface::tenant)
+                    .filter(t -> t != null && !t.isEmpty())
+                    .findFirst()
+                    .orElse(null);
+        } catch (RuntimeException ex) {
+            LOG.debug("Couldn't extract tenant from agent card", ex);
             return null;
         }
-        return agentCard.supportedInterfaces().stream()
-                .map(AgentInterface::tenant)
-                .filter(t -> t != null && !t.isEmpty())
-                .findFirst()
-                .orElse(null);
     }
 }
```

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/DefaultA2AService.java` (modified, +5/-1)
```diff
@@ -15,7 +15,11 @@ public class DefaultA2AService implements A2AService {
 
     @Override
     public <T> A2AClientBuilder<T> a2aBuilder(String a2aServerUrl, Class<T> agentServiceClass) {
-        return new DefaultA2AClientBuilder<>(a2aServerUrl, agentServiceClass);
+        return a2aBuilder(a2aServerUrl, null, agentServiceClass);
+    }
+    @Override
+    public <T> A2AClientBuilder<T> a2aBuilder(String a2aServerUrl, String tenant, Class<T> agentServiceClass) {
+        return new DefaultA2AClientBuilder<>(a2aServerUrl, agentServiceClass, tenant);
     }
 
     @Override
```

**File**: `langchain4j-agentic-a2a/src/test/java/dev/langchain4j/agentic/a2a/A2AAnnotationTenantTest.java` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+package dev.langchain4j.agentic.a2a;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.mockito.ArgumentMatchers.any;
+import static org.mockito.ArgumentMatchers.anyList;
+import static org.mockito.ArgumentMatchers.isNull;
+import static org.mockito.Mockito.doAnswer;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.never;
+import static org.mockito.Mockito.verify;
+
+import dev.langchain4j.service.V;
+import java.util.List;
+import java.util.function.BiConsumer;
+import org.a2aproject.sdk.client.Client;
+import org.a2aproject.sdk.client.ClientEvent;
+import org.a2aproject.sdk.client.MessageEvent;
+import org.a2aproject.sdk.spec.AgentCapabilities;
+import org.a2aproject.sdk.spec.AgentCard;
+import org.a2aproject.sdk.spec.AgentInterface;
+import org.a2aproject.sdk.spec.Message;
+import org.a2aproject.sdk.spec.MessageSendParams;
+import org.a2aproject.sdk.spec.TextPart;
+import org.junit.jupiter.api.BeforeEach;
+import org.junit.jupiter.api.Test;
+import org.mockito.ArgumentCaptor;
+
+/**
+ * Tests for the static {@code tenant} attribute on {@code @A2AClientAgent} and
+ * tenant auto-detection from the agent card's {@code supportedInterfaces}.
+ */
+class A2AAnnotationTenantTest {
+
+    // Interface without @A2ATenantId — tenant must come from static builder configuration.
+    interface StaticTenantAgent {
+        String chat(@V("question") String question);
+    }
+
+    // Interface with both static builder tenant and @A2ATenantId — the latter overrides when non-empty.
+    interface OverrideTenantAgent {
+        String chat(@V("question") String question, @A2ATenantId String tenant);
+    }
+
+    private AgentCard agentCard;
+
+    @BeforeEach
+    void setUp() {
+        agentCard = AgentCard.builder()
+                .name("test-agent")
+                .description("Test agent")
+                .version("1.0.0")
+                .url("http://localhost")
+                .capabilities(new AgentCapabilities(false, false, false, List.of()))
+                .defaultInputModes(List.of("text"))
+                .defaultOutputModes(List.of("text"))
+                .skills(List.of())
+                .supportedInterfaces(List.of())
+                .build();
+    }
+
+    // ── extractTenantFromAgentCard ──────────────────────────────────────────
+
+    @Test
+    void extractTenantFromAgentCard_nullAgentCard_returnsNull() {
+        assertThat(DefaultA2AClientBuilder.extractTenantFromAgentCard(null)).isNull();
+    }
+
+    @Test
+    void extractTenantFromAgentCard_emptySupportedInterfaces_returnsNull() {
+        assertThat(DefaultA2AClientBuilder.extractTenantFromAgentCard(agentCard)).isNull();
+    }
+
+    @Test
+    void extractTenantFromAgentCard_interfaceWithTenant_returnsTenant() {
+        AgentCard card = AgentCard.builder()
+                .name("a")
+                .description("d")
+                .version("1")
+                .url("http://localhost")
+                .capabilities(new AgentCapabilities(false, false, false, List.of()))
+                .defaultInputModes(List.of("text"))
+                .defaultOutputModes(List.of("text"))
+                .skills(List.of())
+                .supportedInterfaces(List.of(new AgentInterface("JSONRPC", "http://localhost", "my-tenant")))
+                .build();
+        assertThat(DefaultA2AClientBuilder.extractTenantFromAgentCard(card)).isEqualTo("my-tenant");
+    }
+
+    @Test
+    void extractTenantFromAgentCard_firstNonEmptyTenantWins() {
+        AgentCard card = AgentCard.builder()
+                .name("a")
+                .description("d")
+                .version("1")
+                .url("http://localhost")
+                .capabilities(new AgentCapabilities(false, false, false, List.of()))
+                .defaultInputModes(List.of("text"))
+                .defaultOutputModes(List.of("text"))
+                .skills(List.of())
+                .supportedInterf
```

---

### Incident Patch 3: `c367fc51` (2026-09-29)
**Commit Message**: fix(mcp): do not register a pending operation for messages that expect no reply (#6530)

## Issue
<!-- Please specify the ID of the issue this PR is addressing. For
example: "Closes #1234" or "Fixes #1234" -->
Closes #6529 

## Change
<!-- Please describe the changes you made. -->
`McpTransport.sendMessage` is documented as sending "a notification, or
a response to a server-initiated request" and therefore does not expect
a reply. The Streamable HTTP transport did not honour that: it routed
`sendMessage` through the same `execute` used for requests, which
registers the message id in the pending-operations map.

A notification has no id, so the registration was skipped; but the
client's reply to a server-initiated request (`McpPingResponse`,
`McpRootsListResponse`) does carry one - the server's id. The result was
a future that could never be completed, and, because the client and the
server number their requests independently, an id collision could
displace a client request that was still in flight, leaving it to time
out.

`execute` now takes whether a reply is expected, and `sendMessage`
passes `false`, so the id is not awaited locally. The id still travels
in the request body, so

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/transport/http/StreamableHttpMcpTransport.java` (modified, +14/-3)
```diff
@@ -194,7 +194,7 @@ public void sendMessage(McpClientMessage operation) {
 
     @Override
     public void sendMessage(McpCallContext context) {
-        execute(context, false);
+        execute(context, false, false);
     }
 
     @Override
@@ -252,7 +252,18 @@ public void setProtocolVersion(String protocolVersion) {
     }
 
     private CompletableFuture<String> execute(McpCallContext context, boolean isRetry) {
-        Long id = context.message().getId();
+        return execute(context, isRetry, true);
+    }
+
+    /**
+     * @param expectResponse whether this message expects a response from the server. A notification
+     *     or a response to a server-initiated request does not, and must not be registered as a
+     *     pending operation: its id comes from the server's id space, so registering it would both
+     *     leave a future that is never completed and displace a client-initiated request that is
+     *     still in flight and happens to carry the same id.
+     */
+    private CompletableFuture<String> execute(McpCallContext context, boolean isRetry, boolean expectResponse) {
+        Long id = expectResponse ? context.message().getId() : null;
         if (!(context.message() instanceof McpInitializeRequest)) {
             CompletableFuture<String> reinitializeInProgress = this.initializeInProgress.get();
             if (reinitializeInProgress != null) {
@@ -280,7 +291,7 @@ private CompletableFuture<String> execute(McpCallContext context, boolean isRetr
                             if (!isRetry) {
                                 sendInitializeRequest(StreamableHttpMcpTransport.this.initializeRequest)
                                         .thenAccept(ignored -> {
-                                            execute(context, true)
+                                            execute(context, true, expectResponse)
                                                     .thenAccept(future::complete)
                                                     .exceptionally(t -> {
                                                         future.completeExceptionally(t);
```

**File**: `langchain4j-mcp/src/test/java/dev/langchain4j/mcp/client/transport/StreamableHttpMcpTransportSendMessageTest.java` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+package dev.langchain4j.mcp.client.transport;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+import com.sun.net.httpserver.HttpExchange;
+import com.sun.net.httpserver.HttpServer;
+import dev.langchain4j.mcp.client.transport.http.StreamableHttpMcpTransport;
+import dev.langchain4j.mcp.protocol.McpListToolsRequest;
+import dev.langchain4j.mcp.protocol.McpPingResponse;
+import java.io.IOException;
+import java.io.OutputStream;
+import java.net.InetSocketAddress;
+import java.nio.charset.StandardCharsets;
+import java.util.Collections;
+import java.util.List;
+import java.util.Map;
+import java.util.concurrent.CompletableFuture;
+import java.util.concurrent.ConcurrentHashMap;
+import java.util.concurrent.CopyOnWriteArrayList;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.TimeUnit;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.Test;
+
+/**
+ * A message that expects no reply - a notification, or a response to a server-initiated request -
+ * must not be registered as a pending operation. Its id belongs to the server's id space, so the
+ * registration would never be completed, and it could displace a client-initiated request that is
+ * still in flight and happens to carry the same id.
+ */
+class StreamableHttpMcpTransportSendMessageTest {
+
+    private HttpServer server;
+    private StreamableHttpMcpTransport transport;
+    private final Map<Long, CompletableFuture<String>> pendingOperations = new ConcurrentHashMap<>();
+    private final List<String> receivedBodies = new CopyOnWriteArrayList<>();
+    private CountDownLatch received;
+    private CountDownLatch releaseResponse;
+
+    private void startServer(boolean respondToRequests) throws IOException {
+        received = new CountDownLatch(1);
+        releaseResponse = new CountDownLatch(1);
+        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
+        server.createContext("/mcp", exchange -> {
+            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
+            receivedBodies.add(body);
+            received.countDown();
+            if (respondToRequests) {
+                // hold the response open, so the request stays pending while the test asserts
+                try {
+                    releaseResponse.await(10, TimeUnit.SECONDS);
+                } catch (InterruptedException e) {
+                    Thread.currentThread().interrupt();
+                }
+                respond(exchange, 200, "{\"jsonrpc\":\"2.0\",\"id\":7,\"result\":{\"tools\":[]}}");
+            } else {
+                // a response to a server-initiated request: 202, no body
+                exchange.sendResponseHeaders(202, -1);
+                exchange.close();
+            }
+        });
+        server.start();
+        transport = StreamableHttpMcpTransport.builder()
+                .url("http://localhost:" + server.getAddress().getPort() + "/mcp")
+                .setHttpVersion1_1()
+                .build();
+        transport.start(new McpOperationHandler(
+                pendingOperations,
+                Collections::emptyList,
+                transport,
+                null,
+                () -> {},
+                null,
+                () -> {},
+                null,
+                null,
+                null,
+                null,
+                null,
+                null));
+    }
+
+    private static void respond(HttpExchange exchange, int statusCode, String body) throws IOException {
+        exchange.getResponseHeaders().set("Content-Type", "application/json");
+        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
+        exchange.sendResponseHeaders(statusCode, bytes.length);
+        try (OutputStream out = exchange.getResponseBody()) {
+            out.write(bytes);
+        }
+    }
+
+    @AfterEach
+    void tearDown() throws IOException {
+        if (releaseResponse !=
```

---

### Incident Patch 4: `85a4b120` (2026-09-29)
**Commit Message**: fix(mcp): preserve dotted parameter names in MCP headers (#6497)

<!--
Thank you so much for your contribution!

Please fill in all the sections below.
Please open the PR as ready for review (not as a draft), with tests and
documentation already included.
Please note that PRs with breaking changes, or without tests and
documentation, will be rejected.

Please note that PRs will be reviewed based on the priority of the
issues they address.
We ask for your patience. We are doing our best to review your PR as
quickly as possible.
Please refrain from pinging and asking when it will be reviewed. Thank
you for understanding!
-->

## Issue
<!-- Please specify the ID of the issue this PR is addressing. For
example: "Closes #1234" or "Fixes #1234" -->
Fixes #6494

## Change
<!-- Please describe the changes you made. -->
- MCP `x-mcp-header` metadata previously represented parameter locations
as dot-separated paths.
- This made a literal JSON property such as `config.region` ambiguous
with nested `config` -> `region`.
- The fix represents MCP parameter paths as structured `List<String>`
segments, avoiding that ambiguity.
- `MCP_PARAM_HEADERS` now uses `Map<List<String>, String>` so all heade

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/DefaultMcpClient.java` (modified, +6/-8)
```diff
@@ -1660,16 +1660,15 @@ private Map<String, String> buildMcpParamHeaders(String toolName, Map<String, Ob
         if (spec == null || spec.metadata() == null) {
             return null;
         }
-        Map<String, String> headerMappings =
-                (Map<String, String>) spec.metadata().get(McpToolMetadataKeys.MCP_PARAM_HEADERS);
+        Map<List<String>, String> headerMappings =
+                (Map<List<String>, String>) spec.metadata().get(McpToolMetadataKeys.MCP_PARAM_HEADERS);
         if (headerMappings == null || headerMappings.isEmpty()) {
             return null;
         }
         Map<String, String> result = new LinkedHashMap<>();
-        for (Map.Entry<String, String> entry : headerMappings.entrySet()) {
-            String propertyPath = entry.getKey();
+        for (Map.Entry<List<String>, String> entry : headerMappings.entrySet()) {
+            Object value = resolvePropertyPath(arguments, entry.getKey());
             String headerName = entry.getValue();
-            Object value = resolvePropertyPath(arguments, propertyPath);
             String stringValue;
             if (value instanceof String text) {
                 stringValue = text;
@@ -1686,10 +1685,9 @@ private Map<String, String> buildMcpParamHeaders(String toolName, Map<String, Ob
         return result.isEmpty() ? null : result;
     }
 
-    private static @Nullable Object resolvePropertyPath(Map<String, Object> root, String path) {
-        String[] segments = path.split("\\.");
+    private static @Nullable Object resolvePropertyPath(Map<String, Object> root, List<String> path) {
         Object current = root;
-        for (String segment : segments) {
+        for (String segment : path) {
             if (!(current instanceof Map<?, ?> map)) {
                 return null;
             }
```

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/McpToolMetadataKeys.java` (modified, +2/-2)
```diff
@@ -63,10 +63,10 @@ public class McpToolMetadataKeys {
     public static final String OUTPUT_SCHEMA = "outputSchema";
 
     /**
-     * Maps tool parameter names to their {@code x-mcp-header} header names.
+     * Maps tool parameter property paths to their {@code x-mcp-header} header names.
      * When present, the client mirrors the parameter values as {@code Mcp-Param-{Name}}
      * HTTP headers on {@code tools/call} requests (Streamable HTTP transport only).
-     * Value type: {@code Map<String, String>} (property name → header name)
+     * Value type: {@code Map<List<String>, String>} (property path segments → header name)
      */
     public static final String MCP_PARAM_HEADERS = "mcp-param-headers";
 }
```

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/ToolSpecificationHelper.java` (modified, +26/-21)
```diff
@@ -46,12 +46,12 @@ static List<ToolSpecification> toolSpecificationListFromMcpResponse(List<Map<Str
             }
             Map<String, Object> inputSchema = object(tool.get("inputSchema"));
             builder.parameters((JsonObjectSchema) jsonNodeToJsonSchemaElement(inputSchema));
-            Map<String, String> paramHeaders = extractAndValidateMcpParamHeaders(inputSchema, toolName);
+            McpParamHeaders paramHeaders = extractAndValidateMcpParamHeaders(inputSchema, toolName);
             if (paramHeaders == null) {
                 continue;
             }
-            if (!paramHeaders.isEmpty()) {
-                builder.addMetadata(MCP_PARAM_HEADERS, paramHeaders);
+            if (!paramHeaders.headers().isEmpty()) {
+                builder.addMetadata(MCP_PARAM_HEADERS, paramHeaders.headers());
             }
             if (tool.containsKey("annotations")) {
                 processMcpToolAnnotations(object(tool.get("annotations")), builder);
@@ -428,47 +428,51 @@ private static void processMcpToolMetadata(Map<String, Object> meta, ToolSpecifi
         meta.forEach(builder::addMetadata);
     }
 
-    static Map<String, String> extractAndValidateMcpParamHeaders(Map<String, Object> schema, String toolName) {
-        Map<String, String> result = new LinkedHashMap<>();
+    private record McpParamHeaders(Map<List<String>, String> headers) {}
+
+    private static McpParamHeaders extractAndValidateMcpParamHeaders(Map<String, Object> schema, String toolName) {
+        Map<List<String>, String> headers = new LinkedHashMap<>();
         Set<String> seenHeaderNamesLower = new HashSet<>();
         List<String> errors = new ArrayList<>();
-        extractAndValidateMcpParamHeaders(schema, "", result, seenHeaderNamesLower, errors);
+        extractAndValidateMcpParamHeaders(schema, List.of(), headers, seenHeaderNamesLower, errors);
         if (!errors.isEmpty()) {
             for (String error : errors) {
                 log.warn("Excluding tool '{}' from tools/list: {}", toolName, error);
             }
             return null;
         }
-        return result;
+        return new McpParamHeaders(headers);
     }
 
     private static final List<String> FORBIDDEN_SCHEMA_KEYWORDS = List.of(
             "items", "prefixItems", "additionalProperties", "oneOf", "anyOf", "allOf", "not", "if", "then", "else");
 
     private static void extractAndValidateMcpParamHeaders(
             Map<String, Object> schema,
-            String pathPrefix,
-            Map<String, String> result,
+            List<String> pathPrefix,
+            Map<List<String>, String> headers,
             Set<String> seenHeaderNamesLower,
             List<String> errors) {
         checkForbiddenSubtrees(schema, errors);
         Map<String, Object> properties = object(schema.get("properties"));
         for (Map.Entry<String, Object> entry : properties.entrySet()) {
             // a non-object property schema yields an empty map, which simply declares no header
             Map<String, Object> propSchema = object(entry.getValue());
-            String propertyPath = pathPrefix.isEmpty() ? entry.getKey() : pathPrefix + "." + entry.getKey();
+            List<String> propertyPath = new ArrayList<>(pathPrefix);
+            propertyPath.add(entry.getKey());
+            String pathDescription = String.join(".", propertyPath);
             Object headerAnnotation = propSchema.get("x-mcp-header");
             if (headerAnnotation != null) {
                 if (!(headerAnnotation instanceof String)) {
-                    errors.add("x-mcp-header value must be a string, but property '" + propertyPath + "' declares "
+                    errors.add("x-mcp-header value must be a string, but property '" + pathDescription + "' declares "
                             + jsonTypeName(headerAnnotation));
                 } else {
                     validateMcpParamHeader(
-                            (String) headerAnnotation, propSchema, 
```

**File**: `langchain4j-mcp/src/test/java/dev/langchain4j/mcp/client/DefaultMcpClientTest.java` (modified, +56/-0)
```diff
@@ -826,6 +826,62 @@ public void should_paginate_tool_list_using_cursor() throws Exception {
         assertThat(((McpListToolsParams) secondRequest.getParams()).getCursor()).isEqualTo("cursor-page2");
     }
 
+    @Test
+    @SuppressWarnings("unchecked")
+    public void should_use_literal_dotted_property_for_mcp_param_header() throws Exception {
+        McpTransport transport = getModernHttpTransportMock();
+        ObjectNode toolList = getToolResultJson(new ToolDefinition(
+                "dottedTool",
+                "Dotted property",
+                new ToolArg("config.region", "string", "Region"),
+                new ToolArg("region", "string", "Region")));
+        ObjectNode properties = (ObjectNode)
+                toolList.get("result").get("tools").get(0).get("inputSchema").get("properties");
+        ((ObjectNode) properties.get("config.region")).put("x-mcp-header", "Literal-Region");
+        ((ObjectNode) properties.get("region")).put("x-mcp-header", "Top-Region");
+        properties
+                .putObject("config")
+                .put("type", "object")
+                .putObject("properties")
+                .putObject("region")
+                .put("type", "string")
+                .put("x-mcp-header", "Nested-Region");
+        ObjectNode toolResult = JsonNodeFactory.instance.objectNode();
+        toolResult
+                .putObject("result")
+                .putArray("content")
+                .addObject()
+                .put("type", "text")
+                .put("text", "ok");
+        when(transport.executeOperationWithResponse(any(McpCallContext.class)))
+                .thenReturn(CompletableFuture.completedFuture(getDiscoverResult()))
+                .thenReturn(CompletableFuture.completedFuture(toolList))
+                .thenReturn(CompletableFuture.completedFuture(toolResult));
+
+        DefaultMcpClient client = createMcpClient(transport);
+        List<ToolSpecification> tools = client.listTools();
+        Map<List<String>, String> headerMappings =
+                (Map<List<String>, String>) tools.get(0).metadata().get(McpToolMetadataKeys.MCP_PARAM_HEADERS);
+        assertThat(headerMappings)
+                .containsExactlyInAnyOrderEntriesOf(Map.of(
+                        List.of("config.region"),
+                        "Literal-Region",
+                        List.of("config", "region"),
+                        "Nested-Region",
+                        List.of("region"),
+                        "Top-Region"));
+        client.executeTool(ToolExecutionRequest.builder()
+                .name("dottedTool")
+                .arguments("{\"config.region\":\"literal\",\"config\":{\"region\":\"nested\"},\"region\":\"top\"}")
+                .build());
+
+        ArgumentCaptor<McpCallContext> captor = ArgumentCaptor.forClass(McpCallContext.class);
+        verify(transport, times(3)).executeOperationWithResponse(captor.capture());
+        assertThat(captor.getAllValues().get(2).mcpParamHeaders())
+                .containsExactlyInAnyOrderEntriesOf(
+                        Map.of("Literal-Region", "literal", "Nested-Region", "nested", "Top-Region", "top"));
+    }
+
     @Test
     public void meta_supplier_should_not_drop_progress_token() throws Exception {
         final McpTransport transport = getMinimalMcpTransportMock();
```

**File**: `langchain4j-mcp/src/test/java/dev/langchain4j/mcp/client/ToolSpecificationHelperTest.java` (modified, +8/-9)
```diff
@@ -1033,9 +1033,9 @@ void toolWithMcpParamHeaders() throws JsonProcessingException {
         List<Map<String, Object>> json = toolList(text);
         List<ToolSpecification> tools = ToolSpecificationHelper.toolSpecificationListFromMcpResponse(json);
         assertThat(tools).hasSize(1);
-        Map<String, String> headers =
-                (Map<String, String>) tools.get(0).metadata().get(MCP_PARAM_HEADERS);
-        assertThat(headers).containsExactly(Map.entry("region", "Region"));
+        Map<List<String>, String> headers =
+                (Map<List<String>, String>) tools.get(0).metadata().get(MCP_PARAM_HEADERS);
+        assertThat(headers).containsExactly(Map.entry(List.of("region"), "Region"));
     }
 
     @SuppressWarnings("unchecked")
@@ -1064,9 +1064,9 @@ void toolWithNestedMcpParamHeaders() throws JsonProcessingException {
                 """;
         List<Map<String, Object>> json = toolList(text);
         List<ToolSpecification> tools = ToolSpecificationHelper.toolSpecificationListFromMcpResponse(json);
-        Map<String, String> headers =
-                (Map<String, String>) tools.get(0).metadata().get(MCP_PARAM_HEADERS);
-        assertThat(headers).containsExactly(Map.entry("config.region", "Region"));
+        Map<List<String>, String> headers =
+                (Map<List<String>, String>) tools.get(0).metadata().get(MCP_PARAM_HEADERS);
+        assertThat(headers).containsExactly(Map.entry(List.of("config", "region"), "Region"));
     }
 
     @Test
@@ -1252,7 +1252,7 @@ void nullableStringMcpHeaderIsAccepted() throws JsonProcessingException {
         List<Map<String, Object>> json = toolList(text);
         List<ToolSpecification> tools = ToolSpecificationHelper.toolSpecificationListFromMcpResponse(json);
         assertThat(tools).hasSize(1);
-        assertThat(tools.get(0).metadata().get(MCP_PARAM_HEADERS)).isEqualTo(Map.of("tenant", "X-Tenant"));
+        assertThat(tools.get(0).metadata().get(MCP_PARAM_HEADERS)).isEqualTo(Map.of(List.of("tenant"), "X-Tenant"));
     }
 
     @Test
@@ -1642,8 +1642,7 @@ void allOfRefResolvesAgainstRootDefinitionsWhenNested() throws JsonProcessingExc
         JsonObjectSchema parameters = toolSpecification.parameters();
 
         assertThat(parameters.properties().get("config")).isInstanceOf(JsonObjectSchema.class);
-        JsonObjectSchema config =
-                (JsonObjectSchema) parameters.properties().get("config");
+        JsonObjectSchema config = (JsonObjectSchema) parameters.properties().get("config");
         assertThat(config.properties()).containsOnlyKeys("identifier");
         assertThat(config.properties().get("identifier")).isInstanceOf(JsonStringSchema.class);
     }
```

---

### Incident Patch 5: `3a33ec63` (2026-09-28)
**Commit Message**: fix(agentic): fail with a descriptive error when the planning reply has no agent name  (#6528)

## Issue

Fixes #6527

## Change

`SupervisorPlanner.nextSubagent` called
`agentInvocation.getAgentName().equalsIgnoreCase("done")` with no null
check, so a planning reply that parses into an `AgentInvocation` but
names no agent blew up with an NPE. Same story a few lines below with
`getArguments().entrySet()`.

Two changes:

1. When `getAgentName()` is null, throw `IllegalStateException("No agent
name in the planning reply")`. This mirrors what `findAgentByName`
already does for an unknown name, and it's the "fail with a descriptive
exception" option from the issue. Re-asking the planner, the other
option, would be a bigger change, so I went with the simple one — happy
to switch if you'd rather retry.

2. `getArguments()` is normalized with `Objects.requireNonNullElse(...,
Map.of())`, so a missing arguments map is treated as empty instead of
dereferenced.

One guard covers all the shapes the issue mentions: a missing
`agentName` field, an explicit `"agentName": null`, and a
tool-call-shaped reply whose `name` gets dropped by a JSON codec that
ignores unknown properties (quarkus-langchai

**File**: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/supervisor/SupervisorPlanner.java` (modified, +7/-1)
```diff
@@ -28,6 +28,7 @@
 import java.util.Collection;
 import java.util.List;
 import java.util.Map;
+import java.util.Objects;
 import java.util.function.Function;
 import java.util.function.Supplier;
 import java.util.stream.Collectors;
@@ -263,13 +264,18 @@ private Action nextSubagent(AgenticScope agenticScope, String lastResponse) {
                         .plan(agenticScope.memoryId(), agentsList, request, lastResponse, supervisorContext));
         LOG.info("Agent Invocation: {}", agentInvocation);
 
+        if (agentInvocation.getAgentName() == null) {
+            throw new IllegalStateException("No agent name in the planning reply");
+        }
+
         if (agentInvocation.getAgentName().equalsIgnoreCase("done")) {
             return doneAction(agenticScope, lastResponse, agentInvocation);
         }
 
         AgentInstance agent = findAgentByName(agentInvocation.getAgentName());
 
-        agentInvocation.getArguments().entrySet().stream()
+        Map<String, Object> arguments = Objects.requireNonNullElse(agentInvocation.getArguments(), Map.of());
+        arguments.entrySet().stream()
                 .filter(entry -> writeArgumentToScope(agenticScope, agent, entry.getKey(), entry.getValue()))
                 .forEach(entry -> agenticScope.writeState(entry.getKey(), entry.getValue()));
         return call(agent);
```

**File**: `langchain4j-agentic/src/test/java/dev/langchain4j/agentic/supervisor/SupervisorAgentPlanningReplyTest.java` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+package dev.langchain4j.agentic.supervisor;
+
+import static org.assertj.core.api.Assertions.assertThatCode;
+import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
+
+import dev.langchain4j.agentic.AgenticServices;
+import dev.langchain4j.data.message.AiMessage;
+import dev.langchain4j.model.chat.ChatModel;
+import dev.langchain4j.model.chat.request.ChatRequest;
+import dev.langchain4j.model.chat.response.ChatResponse;
+import java.util.ArrayDeque;
+import java.util.Deque;
+import java.util.List;
+import org.junit.jupiter.api.Test;
+
+/**
+ * Verifies how the supervisor handles planning replies that parse as an {@link AgentInvocation} but
+ * are not usable as they are: a reply that names no agent must fail with a readable error instead of
+ * a {@link NullPointerException}, and a missing {@code arguments} map must be treated as empty.
+ */
+class SupervisorAgentPlanningReplyTest {
+
+    @Test
+    void should_fail_with_a_readable_error_when_the_planning_reply_has_no_agent_name() {
+        ChatModel model = replyWith("{\"arguments\": {}}");
+
+        SupervisorAgent supervisor = AgenticServices.supervisorBuilder()
+                .chatModel(model)
+                .subAgents(AgenticServices.agentAction(() -> {}))
+                .build();
+
+        assertThatExceptionOfType(IllegalStateException.class)
+                .isThrownBy(() -> supervisor.invoke("do something"))
+                .withMessage("No agent name in the planning reply");
+    }
+
+    @Test
+    void should_treat_a_missing_arguments_map_as_empty() {
+        ChatModel model = replyWith(
+                "{\"agentName\": \"run\", \"arguments\": null}",
+                "{\"agentName\": \"done\", \"arguments\": {\"response\": \"ok\"}}");
+
+        SupervisorAgent supervisor = AgenticServices.supervisorBuilder()
+                .chatModel(model)
+                .responseStrategy(SupervisorResponseStrategy.LAST)
+                .subAgents(AgenticServices.agentAction(() -> {}))
+                .build();
+
+        assertThatCode(() -> supervisor.invoke("do something")).doesNotThrowAnyException();
+    }
+
+    private static ChatModel replyWith(String... replies) {
+        Deque<String> queue = new ArrayDeque<>(List.of(replies));
+        return new ChatModel() {
+
+            @Override
+            public ChatResponse doChat(ChatRequest request) {
+                if (queue.size() > 1) {
+                    return ChatResponse.builder()
+                            .aiMessage(AiMessage.from(queue.poll()))
+                            .build();
+                }
+                return ChatResponse.builder()
+                        .aiMessage(AiMessage.from(queue.peek()))
+                        .build();
+            }
+        };
+    }
+}
```

---

### Incident Patch 6: `8daa56b9` (2026-09-26)
**Commit Message**: A2a fixes (#6512)

<!--
Thank you so much for your contribution!

Please fill in all the sections below.
Please open the PR as ready for review (not as a draft), with tests and
documentation already included.
Please note that PRs with breaking changes, or without tests and
documentation, will be rejected.

Please note that PRs will be reviewed based on the priority of the
issues they address.
We ask for your patience. We are doing our best to review your PR as
quickly as possible.
Please refrain from pinging and asking when it will be reviewed. Thank
you for understanding!
-->

## Issue
<!-- Please specify the ID of the issue this PR is addressing. For
example: "Closes #1234" or "Fixes #1234" -->
Closes #

## Change
<!-- Please describe the changes you made. -->


## General checklist
<!-- Please double-check the following points and mark them like this:
[X] -->
- [X] There are no breaking changes (API, behaviour)
- [X] I have added unit and/or integration tests for my change
- [ ] The tests cover both positive and negative cases
- [x] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green
- [ ] I have manually run all the 

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/A2AClientAgentInvoker.java` (modified, +8/-0)
```diff
@@ -56,6 +56,14 @@ private List<AgentArgument> arguments(A2AClientInstance a2AClientInstance) {
                         && ParameterNameResolver.hasName(p))
                 .map(ParameterNameResolver::name)
                 .collect(Collectors.toSet());
+        if (a2AClientInstance.tenant() != null) {
+            return argumentsFromMethod(method, optionalProtocolArgs).stream()
+                    .filter(arg -> Stream.of(method.getParameters())
+                            .noneMatch(p -> p.isAnnotationPresent(A2ATenantId.class)
+                                    && ParameterNameResolver.hasName(p)
+                                    && ParameterNameResolver.name(p).equals(arg.name())))
+                    .toList();
+        }
         return argumentsFromMethod(method, optionalProtocolArgs);
     }
 
```

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/A2AClientInstance.java` (modified, +9/-0)
```diff
@@ -8,4 +8,13 @@ public interface A2AClientInstance extends InternalAgent {
     String[] inputKeys();
 
     AgentCard agentCard();
+
+    /**
+     * Returns the tenant associated with this A2A client instance, or {@code null}
+     * if no tenant was configured. When non-null, this tenant is sent automatically
+     * with every message.
+     */
+    default String tenant() {
+        return null;
+    }
 }
```

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/DefaultA2AClientBuilder.java` (modified, +29/-3)
```diff
@@ -50,6 +50,7 @@
 import org.a2aproject.sdk.spec.A2AClientError;
 import org.a2aproject.sdk.spec.A2AClientException;
 import org.a2aproject.sdk.spec.AgentCard;
+import org.a2aproject.sdk.spec.AgentInterface;
 import org.a2aproject.sdk.spec.Artifact;
 import org.a2aproject.sdk.spec.Message;
 import org.a2aproject.sdk.spec.MessageSendParams;
@@ -80,6 +81,7 @@ private record A2AInvocationResult(
     private final String name;
     private String agentId;
     private InternalAgent parent;
+    private String tenant;
 
     private String[] inputKeys;
     private String outputKey;
@@ -97,6 +99,7 @@ private record A2AInvocationResult(
         this.name = agentCard.name();
         this.agentId = this.name;
         this.agentServiceClass = agentServiceClass;
+        this.tenant = tenant != null ? tenant : extractTenantFromAgentCard(agentCard);
     }
 
     // For testing only: bypasses URL fetch and pre-sets the client.
@@ -163,6 +166,7 @@ public Object invoke(Object proxy, Method method, Object[] args) throws Exceptio
             return switch (method.getName()) {
                 case "agentCard" -> agentCard;
                 case "inputKeys" -> inputKeys;
+                case "tenant" -> tenant;
                 default ->
                     throw new UnsupportedOperationException(
                             "Unknown method on A2AClientInstance class : " + method.getName());
@@ -212,8 +216,8 @@ private A2AInvocationResult invokeAgent(Method method, Type returnType, Object[]
         String contextId = null;
         String taskId = null;
         // Per-call tenant extracted from the @A2ATenantId-annotated parameter at invocation time.
-        // Distinct from the instance field 'tenant', which is used only during agent-card discovery.
-        String callTenant = null;
+        // Falls back to the instance-level tenant (from agent card URL or @A2AClientAgent.tenant()).
+        String callTenant = this.tenant;
         String contextIdKey = null;
         String taskIdKey = null;
 
@@ -236,7 +240,10 @@ private A2AInvocationResult invokeAgent(Method method, Type returnType, Object[]
                         taskIdKey = ParameterNameResolver.name(parameters[i]);
                     }
                 } else if (parameters[i].getAnnotation(A2ATenantId.class) != null) {
-                    callTenant = args[i] != null && !args[i].toString().isEmpty() ? args[i].toString() : null;
+                    // @A2ATenantId parameter overrides the instance-level tenant only if non-empty
+                    if (args[i] != null && !args[i].toString().isEmpty()) {
+                        callTenant = args[i].toString();
+                    }
                 } else {
                     parts.add(new TextPart(args[i].toString()));
                 }
@@ -614,4 +621,23 @@ public List<AgentInstance> subagents() {
     public AgenticSystemTopology topology() {
         return AgenticSystemTopology.AI_AGENT;
     }
+
+    @Override
+    public DefaultA2AClientBuilder<T> tenant(String tenant) {
+        if (tenant != null && !tenant.isEmpty()) {
+            this.tenant = tenant;
+        }
+        return this;
+    }
+
+    static String extractTenantFromAgentCard(AgentCard agentCard) {
+        if (agentCard == null || agentCard.supportedInterfaces() == null) {
+            return null;
+        }
+        return agentCard.supportedInterfaces().stream()
+                .map(AgentInterface::tenant)
+                .filter(t -> t != null && !t.isEmpty())
+                .findFirst()
+                .orElse(null);
+    }
 }
```

**File**: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/AgenticServices.java` (modified, +7/-2)
```diff
@@ -752,13 +752,18 @@ private static AgentExecutor createRegistryAgent(Method registryMethod) {
     private static <T> T createA2AClient(Class<T> agentServiceClass, Method a2aMethod) {
         var a2aClient = a2aMethod.getAnnotation(A2AClientAgent.class);
         String a2aServerUrl = resolveA2AServerUrl(agentServiceClass, a2aClient);
-        var a2aClientBuilder = a2aBuilder(a2aServerUrl, agentServiceClass)
+        var a2aClientBuilder = a2aBuilder(a2aServerUrl, agentServiceClass);
+
+        if (!isNullOrBlank(a2aClient.tenant())) {
+            a2aClientBuilder.tenant(a2aClient.tenant());
+        }
+
+        a2aClientBuilder
                 .inputKeys(Stream.of(a2aMethod.getParameters())
                         .map(AgentInvoker::parameterName)
                         .toArray(String[]::new))
                 .outputKey(AgentUtil.outputKey(a2aClient.outputKey(), a2aClient.typedOutputKey()))
                 .async(a2aClient.async());
-
         selectMethod(
                         agentServiceClass,
                         method -> method.isAnnotationPresent(A2AClientCustomizer.class)
```

**File**: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/declarative/A2AClientAgent.java` (modified, +12/-0)
```diff
@@ -69,4 +69,16 @@
      * @return true if the agent should be invoked in an asynchronous manner, false otherwise.
      */
     boolean async() default false;
+
+    /**
+     * Tenant identifier to include in every A2A message sent by this agent.
+     * <p>
+     * When set, the tenant is sent automatically via {@code MessageSendParams}
+     * without exposing it to the LLM as a tool argument.
+     * If left empty, the tenant is extracted from the agent card URL path
+     * (pattern {@code /.well-known/{tenant}/agent-card.json}).
+     *
+     * @return the tenant identifier, or empty to auto-detect from the URL.
+     */
+    String tenant() default "";
 }
```

---

### Incident Patch 7: `b0e9a264` (2026-09-25)
**Commit Message**: fix(deps): update dependency org.apache.httpcomponents.core5:httpcore5 to v5.4.3 [security] (#6433)

This PR contains the following updates:

| Package | Change |
[Age](https://docs.renovatebot.com/merge-confidence/) |
[Confidence](https://docs.renovatebot.com/merge-confidence/) |
|---|---|---|---|
| [org.apache.httpcomponents.core5:httpcore5](https://hc.apache.org/)
([source](https://redirect.github.com/apache/httpcomponents-core)) |
`5.3.6` → `5.4.3` |
![age](https://developer.mend.io/api/mc/badges/age/maven/org.apache.httpcomponents.core5:httpcore5/5.4.3?slim=true)
|
![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/org.apache.httpcomponents.core5:httpcore5/5.3.6/5.4.3?slim=true)
|

---

> [!WARNING]
> Some dependencies could not be looked up. Check the [Dependency
Dashboard](../issues/2069) for more information.

---

### Apache HttpComponents Core HTTP/1 header parsing can cause
memory-exhaustion denial of service
[CVE-2026-54399](https://nvd.nist.gov/vuln/detail/CVE-2026-54399) /
[GHSA-hf6x-8p5f-cgmf](https://redirect.github.com/advisories/GHSA-hf6x-8p5f-cgmf)

<details>
<summary>More information</summary>

#### Details
Uncontrolled Resource Consumption v

**File**: `langchain4j-opensearch/pom.xml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@
             <dependency>
                 <groupId>org.apache.httpcomponents.core5</groupId>
                 <artifactId>httpcore5</artifactId>
-                <version>5.3.6</version>
+                <version>5.4.3</version>
             </dependency>
         </dependencies>
     </dependencyManagement>
```

---

### Incident Patch 8: `0a682510` (2026-09-25)
**Commit Message**: fix(deps): update dependency org.bouncycastle:bcprov-jdk18on to v1.85 [security] (#6464)

This PR contains the following updates:

| Package | Change |
[Age](https://docs.renovatebot.com/merge-confidence/) |
[Confidence](https://docs.renovatebot.com/merge-confidence/) |
|---|---|---|---|
|
[org.bouncycastle:bcprov-jdk18on](https://www.bouncycastle.org/download/bouncy-castle-java/)
([source](https://redirect.github.com/bcgit/bc-java)) | `1.84` → `1.85`
|
![age](https://developer.mend.io/api/mc/badges/age/maven/org.bouncycastle:bcprov-jdk18on/1.85?slim=true)
|
![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/org.bouncycastle:bcprov-jdk18on/1.84/1.85?slim=true)
|

---

> [!WARNING]
> Some dependencies could not be looked up. Check the [Dependency
Dashboard](../issues/2069) for more information.

---

### Bouncy Castle: Name Constraints bypass via trailing dot in
rfc822Name and URI
[CVE-2026-8763](https://nvd.nist.gov/vuln/detail/CVE-2026-8763) /
[GHSA-9pwp-9qqc-pr26](https://redirect.github.com/advisories/GHSA-9pwp-9qqc-pr26)

<details>
<summary>More information</summary>

#### Details
In Bouncy Castle for Java before 1.85, Name Constraints bypass via
trailing do

**File**: `langchain4j-easy-rag/pom.xml` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@
         <dependency>
             <groupId>org.bouncycastle</groupId>
             <artifactId>bcprov-jdk18on</artifactId>
-            <version>1.84</version>
+            <version>1.85</version>
         </dependency>
 
         <dependency>
```

---

### Incident Patch 9: `591fafcf` (2026-09-24)
**Commit Message**: fix(mcp): send `Mcp-Param` headers on the non-blocking and multi-round-trip tool call paths (#6495)

## Issue
<!-- Please specify the ID of the issue this PR is addressing. For
example: "Closes #1234" or "Fixes #1234" -->
Closes #6493 

## Change
<!-- Please describe the changes you made. -->
`x-mcp-header` parameters are sent as `Mcp-Param-` headers on every
tools/call. Two paths did not:

`executeToolAsync` never built the header map.

`handleMultiRoundTrip` built the retry context without the header map,
so on an input_required retry even executeTool sent the headers on the
first attempt only.

Both now use the same header map. handleMultiRoundTrip derives the retry
context from the originating McpCallContext, so future fields cannot be
dropped on retries either.

## General checklist
<!-- Please double-check the following points and mark them like this:
[X] -->
- [X] There are no breaking changes (API, behaviour)
- [X] I have added unit and/or integration tests for my change
- [X] The tests cover both positive and negative cases
- [X] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green
- [X] I have manually run all t

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/DefaultMcpClient.java` (modified, +9/-6)
```diff
@@ -590,7 +590,7 @@ private static boolean isNotEmpty(Object value) {
     private String handleMultiRoundTrip(
             String initialResult,
             long timeoutMillis,
-            InvocationContext invocationContext,
+            McpCallContext originalContext,
             BiFunction<Long, Object, McpClientRequest> retryRequestFactory,
             String operationName)
             throws ExecutionException, InterruptedException, TimeoutException {
@@ -613,7 +613,8 @@ private String handleMultiRoundTrip(
             }
             long retryOperationId = idGenerator.getAndIncrement();
             McpClientRequest retryOperation = retryRequestFactory.apply(retryOperationId, requestState);
-            McpCallContext retryContext = new McpCallContext(invocationContext, retryOperation);
+            McpCallContext retryContext = new McpCallContext(
+                    originalContext.invocationContext(), retryOperation, originalContext.mcpParamHeaders());
             applyMeta(retryOperation, retryContext);
             CompletableFuture<String> resultFuture = executeViaTransport(retryContext);
             try {
@@ -733,7 +734,7 @@ public ToolExecutionResult executeTool(ToolExecutionRequest executionRequest, In
             result = handleMultiRoundTrip(
                     result,
                     timeoutMillis,
-                    invocationContext,
+                    context,
                     (retryId, requestState) -> {
                         McpCallToolRequest retryOp =
                                 new McpCallToolRequest(retryId, executionRequest.name(), finalArguments, progressToken);
@@ -778,7 +779,9 @@ public CompletableFuture<ToolExecutionResult> executeToolAsync(
         McpCallToolRequest operation =
                 new McpCallToolRequest(operationId, executionRequest.name(), arguments, progressToken);
         long timeoutMillis = toolExecutionTimeout.toMillis() == 0 ? Integer.MAX_VALUE : toolExecutionTimeout.toMillis();
-        McpCallContext context = new McpCallContext(invocationContext, operation);
+        Map<String, String> paramHeaders =
+                modernProtocol ? buildMcpParamHeaders(executionRequest.name(), arguments) : null;
+        McpCallContext context = new McpCallContext(invocationContext, operation, paramHeaders);
 
         CompletableFuture<String> resultFuture;
         try {
@@ -893,7 +896,7 @@ public McpReadResourceResult readResource(String uri, InvocationContext invocati
             result = handleMultiRoundTrip(
                     result,
                     timeoutMillis,
-                    invocationContext,
+                    context,
                     (retryId, requestState) -> {
                         McpReadResourceRequest retryOp = new McpReadResourceRequest(retryId, uri);
                         ((McpReadResourceParams) retryOp.getParams()).setRequestState(requestState);
@@ -949,7 +952,7 @@ public McpGetPromptResult getPrompt(String name, Map<String, Object> arguments)
             result = handleMultiRoundTrip(
                     result,
                     timeoutMillis,
-                    null,
+                    context,
                     (retryId, requestState) -> {
                         McpGetPromptRequest retryOp = new McpGetPromptRequest(retryId, name, finalArguments);
                         ((McpGetPromptParams) retryOp.getParams()).setRequestState(requestState);
```

**File**: `langchain4j-mcp/src/test/java/dev/langchain4j/mcp/client/DefaultMcpClientTest.java` (modified, +104/-0)
```diff
@@ -24,6 +24,7 @@
 import dev.langchain4j.exception.ToolExecutionException;
 import dev.langchain4j.mcp.client.transport.McpOperationHandler;
 import dev.langchain4j.mcp.client.transport.McpTransport;
+import dev.langchain4j.mcp.protocol.McpCallToolRequest;
 import dev.langchain4j.mcp.protocol.McpCancellationNotification;
 import dev.langchain4j.mcp.protocol.McpCancellationParams;
 import dev.langchain4j.mcp.protocol.McpClientMessage;
@@ -544,6 +545,87 @@ public void should_report_a_tool_execution_timeout_as_an_error_on_the_reactive_p
         assertThat(result.resultText()).isEqualTo("There was a timeout executing the tool");
     }
 
+    @Test
+    public void async_tool_execution_sends_mcp_param_headers() throws Exception {
+        McpTransport transport = getModernStdioTransportMock();
+        AtomicReference<McpCallContext> toolCallContext = new AtomicReference<>();
+        when(transport.sendRequest(any(McpCallContext.class))).thenAnswer(invocation -> {
+            McpCallContext context = invocation.getArgument(0);
+            if (context.message() instanceof McpCallToolRequest) {
+                toolCallContext.set(context);
+                return CompletableFuture.completedFuture(
+                        buildToolCompleteResponse("done").toString());
+            }
+            if (context.message() instanceof McpListToolsRequest) {
+                return CompletableFuture.completedFuture(toolsListWithParamHeader());
+            }
+            return CompletableFuture.completedFuture(getDiscoverResult().toString());
+        });
+
+        DefaultMcpClient client = new DefaultMcpClient.Builder()
+                .transport(transport)
+                .protocolVersion("2026-07-28")
+                .subscribeToToolListChanges(false)
+                .subscribeToPromptListChanges(false)
+                .subscribeToResourceListChanges(false)
+                .build();
+
+        // the tool list has to be known before the header mapping can be looked up in it
+        client.listTools();
+
+        ToolExecutionResult result = client.executeToolAsync(
+                        ToolExecutionRequest.builder()
+                                .name("regionEcho")
+                                .arguments("{\"region\": \"us-west1\", \"value\": \"hello\"}")
+                                .build(),
+                        null)
+                .get();
+
+        assertThat(result.resultText()).isEqualTo("done");
+        assertThat(toolCallContext.get().mcpParamHeaders()).isEqualTo(Map.of("Region", "us-west1"));
+    }
+
+    @Test
+    public void multi_round_trip_retry_sends_mcp_param_headers() throws Exception {
+        McpTransport transport = getModernStdioTransportMock();
+        List<McpCallContext> toolCallContexts = new ArrayList<>();
+        when(transport.sendRequest(any(McpCallContext.class))).thenAnswer(invocation -> {
+            McpCallContext context = invocation.getArgument(0);
+            if (context.message() instanceof McpCallToolRequest) {
+                toolCallContexts.add(context);
+                return CompletableFuture.completedFuture(
+                        toolCallContexts.size() == 1
+                                ? buildInputRequiredResponse(true, false).toString()
+                                : buildToolCompleteResponse("done").toString());
+            }
+            if (context.message() instanceof McpListToolsRequest) {
+                return CompletableFuture.completedFuture(toolsListWithParamHeader());
+            }
+            return CompletableFuture.completedFuture(getDiscoverResult().toString());
+        });
+
+        DefaultMcpClient client = new DefaultMcpClient.Builder()
+                .transport(transport)
+                .protocolVersion("2026-07-28")
+                .subscribeToToolListChanges(false)
+                .subscribeToPromptListChanges(false)
+                .subscribeToResourceListChanges(false)
+                .build();
+
+  
```

---

### Incident Patch 10: `efd1aa3c` (2026-09-22)
**Commit Message**: fix(agentic-patterns): make debate convergence locale-independent (#6484)

## Issue

`ConvergenceStrategy.unanimousLastWord()` compares the last word of each
debater's position after upper-casing it with the **default locale**:

```java
String lastWord = tokens[tokens.length - 1]
        .replaceAll("^[^\\p{Alnum}]+|[^\\p{Alnum}]+$", "")
        .toUpperCase();
```

On a JVM running in the Turkish (or Azeri) locale,
`"disagree".toUpperCase()` is `"DİSAGREE"` (dotted capital I) while
`"DISAGREE".toUpperCase()` stays `"DISAGREE"`. Two debaters that reach
the same verdict in different cases therefore never converge, and the
debate runs to its maximum number of rounds.

## Change

- `toUpperCase(Locale.ROOT)` — the verdict is data used for comparison,
not text shown to a user.
- A test that runs under the Turkish locale and restores the default
afterwards, following the pattern of the other locale tests in this
repository.

## General checklist

- [x] There are no breaking changes
- [x] I have added unit and integration tests for my change
- [ ] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green

> The tests in this PR were

**File**: `langchain4j-agentic-patterns/src/main/java/dev/langchain4j/agentic/patterns/debate/ConvergenceStrategy.java` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 package dev.langchain4j.agentic.patterns.debate;
 
 import java.util.Collection;
+import java.util.Locale;
 import java.util.Objects;
 
 @FunctionalInterface
@@ -26,7 +27,7 @@ static ConvergenceStrategy unanimousLastWord() {
                 String[] tokens = text.split("\\s+");
                 String lastWord = tokens[tokens.length - 1]
                         .replaceAll("^[^\\p{Alnum}]+|[^\\p{Alnum}]+$", "")
-                        .toUpperCase();
+                        .toUpperCase(Locale.ROOT);
                 if (firstVerdict == null) {
                     firstVerdict = lastWord;
                 } else if (!firstVerdict.equals(lastWord)) {
```

**File**: `langchain4j-agentic-patterns/src/test/java/dev/langchain4j/agentic/patterns/debate/ConvergenceStrategyLocaleTest.java` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package dev.langchain4j.agentic.patterns.debate;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+import java.util.List;
+import java.util.Locale;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.BeforeEach;
+import org.junit.jupiter.api.Test;
+
+class ConvergenceStrategyLocaleTest {
+
+    private static final Locale DEFAULT_LOCALE = Locale.getDefault();
+
+    @BeforeEach
+    void setUp() {
+        Locale.setDefault(Locale.forLanguageTag("tr"));
+    }
+
+    @AfterEach
+    void tearDown() {
+        Locale.setDefault(DEFAULT_LOCALE);
+    }
+
+    @Test
+    void unanimousLastWord_converges_on_mixed_case_verdicts_under_turkish_locale() {
+        assertThat(ConvergenceStrategy.unanimousLastWord()
+                        .hasConverged(List.of("On balance, disagree", "Still DISAGREE", "I disagree.")))
+                .isTrue();
+    }
+
+    @Test
+    void unanimousLastWord_does_not_converge_on_different_verdicts_under_turkish_locale() {
+        assertThat(ConvergenceStrategy.unanimousLastWord().hasConverged(List.of("I agree", "I disagree")))
+                .isFalse();
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #6548** (2026-09-30): fix(a2a): preserve @A2ATenantId positional arg when tenant is pre-con… (@ehsavoie)
- **PR #6546** (2026-09-30): fix(a2a): treat blank tenant as absent and expose tenant-aware a2aBuilder overloads (@ehsavoie)
- **PR #6543** (2026-09-29): Refine the experimental DecisionModel API: text descriptions, text or map input, more shared tests (@dliubarskyi)
- **PR #6540** (closed): fix(mcp): do not track server response ids as pending (@CryoThrust)
- **PR #6539** (closed): fix: avoid pending entries for MCP server replies (@yusei21)
- **PR #6533** (closed): fix(agentic): fail with a descriptive error when the supervisor planning response has no agent name (@Rainmemery)
- **PR #6530** (2026-09-29): fix(mcp): do not register a pending operation for messages that expect no reply (@Shxuuer)
- **PR #6528** (2026-09-28): fix(agentic): fail with a descriptive error when the planning reply has no agent name  (@xinqi123321)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
