> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/langchain4j-langchain4j-learnings.md`  
> **Source**: github ([https://github.com/langchain4j/langchain4j](https://github.com/langchain4j/langchain4j))  
> **Source Version**: `f2a5c72f`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:41:03.944Z  
> **Learning ID**: `learn-github-langchain4j-langchain4j`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): langchain4j/langchain4j

---

## 1. Executive Forensic Architecture & System Mechanics

`langchain4j` is an idiomatic JVM-native orchestration framework for Large Language Model (LLM) integration, structured workflows, autonomous multi-agent systems, and Retrieval-Augmented Generation (RAG). Unlike direct ports of Python/TypeScript frameworks, its architecture is built around the Java Memory Model, strong static typing, annotation-driven dynamic proxies (`AiServices`), and service provider interfaces (SPI).

```
                      +-------------------------------------------------------------+
                      |         Application Layer / Declarative Interfaces          |
                      |   (@AiService, @Agent, @UserMessage, Dynamic Invocation)    |
                      +-------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------+
| Agentic & Workflow Engine                                                                        |
| +------------------------------------+  +-------------------------------------------------------+ |
| | AgentExecutor / Planner            |  | AgenticScope (State isolation via ConcurrentHashMap)  | |
| | - Untyped/Typed Agent Invokers     |  | - Output Key projection & state propagation           | |
| | - ParallelMapperService (N=1 rule) |  | - Suspended execution tokens & resume checkpoints     | |
| +------------------------------------+  +-------------------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------+
| Guardrail Pipeline Subsystem                                                                      |
| +-----------------------------------------------------------------------------------------------+ |
| | AbstractGuardrailExecutor<R extends GuardrailResult>                                          | |
| | +-------------------------------------------------------------------------------------------+ | |
| | | OutputGuardrailExecutor                                                                   | | |
| | | - composeResult(old, new) : Preserves payload across non-rewritten SUCCESS                | | |
| | | - Failure.blockRetry()    : Reprompt/Retry locking on rewritten text                      | | |
| | +-------------------------------------------------------------------------------------------+ | |
| +-----------------------------------------------------------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
       |                                             |                                       |
       v                                             v                                       v
+-----------------------------+       +-----------------------------+       +-----------------------------+
| Model SPI Layer             |       | Streaming & Reactive Core   |       | Coroutine / Async Runtime   |
| - ChatModel                 |       | - StreamingChatModel        |       | - VirtualThreadUtils (Loom) |
| - StreamingChatModel        |       | - TokenStream               |       | - callbackFlow / awaitClose |
| - EmbeddingModel            |       | - Backpressure Buffer       |       | - Structured Concurrency    |
+-----------------------------+       +-----------------------------+       +-----------------------------+
```

### Critical Subsystem Boundaries and State Ownership

1. **Agentic Workflow Engine (`langchain4j-agentic`)**:
   - Manages state projection across autonomous subagents through an `AgenticScope` backed by a synchronized context.
   - Decouples structural topology (sequences, parallel mappers, routers) from agent invokers (`UntypedAgentInvoker`, `A2AClientAgentInvoker`). State transitions enforce fail-fast preconditions before handing parameters to execution branches.

2. **The Guardrail Pipeline (`langchain4j-core`, `langchain4j-guardrails`)**:
   - Implements a bi-directional verification pipeline (Input/Output).
   - Execution is modeled as an accumulating state machine where results (`SUCCESS`, `SUCCESS_WITH_REWRITE`, `FAILURE`, `FATAL`) compose across chained guardrails. State ownership mandates that rewriting the text invalidates prior deserialized payload representations, while passing text verbatim preserves extracted POJOs.

3. **Reactive Streaming & Dispatching (`langchain4j-core`, `langchain4j-kotlin`)**:
   - Implements zero-loss token streaming via `TokenStream` and Kotlin `callbackFlow`.
   - Thread isolation uses a dual-engine model: modern JVM runtimes (Java 21+) resolve to Virtual Thread executors via reflection (`VirtualThreadUtils`), falling back to `Dispatchers.IO` on legacy runtimes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Guardrail Rewrite Immutability and Downstream Reprompt Invariant
**RULE**:
A guardrail or validation chain MUST distinguish between a *pure semantic parse* (payload attachment) and an *in-place content rewrite*. An execution chain MUST NOT mark an output as "rewritten" if the validated string is byte-for-byte or character-for-character identical to the input string. Furthermore, an executor MUST NOT permit reprompting or retrying against an LLM once an upstream guardrail has mutated the textual stream.

**WHY**:
Marking an unchanged string as rewritten changes the execution state from `SUCCESS` to `SUCCESS_WITH_REWRITE`. Downstream guardrails that encounter failures will consult the pipeline policy: if an upstream guardrail has modified the text, reprompting the LLM with the modified text creates a prompt injection/divergence hazard (the LLM is asked to correct text it never generated). If the system unconditionally blocks retries on rewritten states, false rewrites prevent all subsequent guardrails in the chain from reprompting the LLM, silently failing valid recovery routines.

**WHEN TO APPLY**:
Apply to any multi-stage validation, sanitization, parsing, or guardrail pipeline where output from one step feeds into the next, and where intermediate steps can attach parsed objects (e.g., ASTs, JSON POJOs) or issue LLM reprompts.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
public class JsonExtractorOutputGuardrail<T> implements OutputGuardrail {
    private final Class<T> targetClass;
    private final ObjectMapper objectMapper;

    @Override
    public OutputGuardrailResult validate(AiMessage responseFromLLM) {
        String llmResponse = responseFromLLM.text();
        return deserialize(llmResponse)
                .map(parsed -> {
                    // INVARIANT: Only mark as rewritten if string representation diverged
                    if (parsed.json().equals(llmResponse)) {
                        return OutputGuardrailResult.successWithResult(parsed.value());
                    } else {
                        return OutputGuardrailResult.successWith(parsed.json(), parsed.value());
                    }
                })
                .orElseGet(() -> handleInvalidJson(responseFromLLM, llmResponse));
    }
}

// In the Pipeline Executor composition logic:
public class OutputGuardrailExecutor extends AbstractGuardrailExecutor<OutputGuardrailResult> {
    @Override
    protected OutputGuardrailResult composeResult(OutputGuardrailResult oldResult, OutputGuardrailResult newResult) {
        OutputGuardrailResult composedResult = super.composeResult(oldResult, newResult);

        // Preserve attached payload if newResult succeeded without clobbering text
        if (oldResult.isSuccess() && newResult.isSuccess() && !newResult.hasRewrittenResult()) {
            Object successfulResult = Optional.ofNullable(newResult.successfulResult())
                    .orElseGet(oldResult::successfulResult);
            return composedResult.withSuccessfulResult(successfulResult);
        }
        return composedResult;
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Blindly marking every successful extraction as a rewrite
public OutputGuardrailResult validate(AiMessage responseFromLLM) {
    String llmResponse = responseFromLLM.text();
    ExtractedJson<T> parsed = parseJson(llmResponse);
    // BUG: Even if parsed.json() == llmResponse, output is flagged as rewritten.
    // Downstream guardrails will have their reprompting/retrying capabilities blocked!
    return OutputGuardrailResult.successWith(parsed.json(), parsed.value());
}
```

**VERIFICATION METHOD**:
Enforce via parameterized unit tests asserting pipeline retry capability downstream of clean JSON:
```java
@Test
void guardrailAfterCleanJsonExtractionCanStillReprompt() {
    var chatModel = ChatModelMock.thatAlwaysResponds("{\"key\": \"reprompted-value\"}");
    var request = createRequest("{\"key\": \"initial-value\"}", chatModel);
    var executor = new OutputGuardrailExecutor(
        List.of(new JsonExtractorOutputGuardrail<>(Map.class), new DemandingDownstreamGuardrail())
    );
    OutputGuardrailResult result = executor.execute(request);
    assertThat(result.isSuccess()).isTrue();
    assertThat(chatModel.invocations()).isEqualTo(2); // Proves downstream was NOT blocked from reprompting
}
```

---

### 2. Guarded Scope Lookup and Concurrent Map Null Invariant
**RULE**:
Before querying any state container backed by `java.util.concurrent.ConcurrentHashMap` or similar strict-null collections, callers MUST verify that the search key is non-null. Optional execution units that lack an explicit storage key MUST short-circuit to a deterministic fallback (e.g., `null` or `Optional.empty()`) without invoking the container lookup.

**WHY**:
`java.util.HashMap` permits `null` keys, but `java.util.concurrent.ConcurrentHashMap` throws a raw `NullPointerException` on `get(null)` or `containsKey(null)`. In agentic architectures where individual workflow nodes (e.g., subagents) optionally declare output storage slots, an agent skipped due to missing arguments must return its default state. Passing a null `agentInvoker.outputKey()` directly into an abstracted `agenticScope.readState(key)` causes the entire workflow engine to crash with an uninformative NPE instead of gracefully skipping.

**WHEN TO APPLY**:
In all workflow scopes, state stores, dynamic routing layers, and agent memory registries where keys are derived from dynamic metadata or optional annotations.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
public class AgentExecutor {
    private Object executeOptionalSubagent(AgentInvoker agentInvoker, AgenticScope agenticScope, MissingArgumentException ex) {
        logger.warn("Skipping optional agent '{}' because of missing argument '{}'",
                agentInvoker.name(), ex.argumentName());

        // INVARIANT: Never pass an optional/undeclared outputKey to the state store
        String outputKey = agentInvoker.outputKey();
        Object response = (outputKey == null) ? null : agenticScope.readState(outputKey);

        if (planner != null) {
            planner.onSubagentInvoked(new AgentInvocation(
                    type(), name(), agentId(), Map.of(), response
            ));
        }
        return response;
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Assuming scope abstractions tolerate null keys
public Object executeOptionalSubagent(AgentInvoker agentInvoker, AgenticScope agenticScope) {
    // CRASH: If agentInvoker has no declared outputKey, outputKey() returns null.
    // DefaultAgenticScope delegates to ConcurrentHashMap, which throws NullPointerException.
    Object response = agenticScope.readState(agentInvoker.outputKey());
    return response;
}
```

**VERIFICATION METHOD**:
Implement null-key isolation unit tests checking optional nodes without output keys:
```java
@Test
void optional_agent_without_output_key_is_skipped_without_npe() {
    SideEffectAgent sideEffectAgent = AgenticServices.agentBuilder(SideEffectAgent.class)
            .chatModel(mockModel)
            .optional(true)
            .build(); // No outputKey defined!
    
    UntypedAgent workflow = AgenticServices.sequenceBuilder()
            .subAgents(List.of(sideEffectAgent, mainAgent))
            .build();

    assertThatNoException().isThrownBy(() -> workflow.invoke(Map.of()));
}
```

---

### 3. Asynchronous Cancellation Preservation in Coroutine Stream Harvesters
**RULE**:
When wrapping external, blocking, or non-cooperative I/O sources inside a coroutine-based parallel processing pipeline (e.g., Kotlin `async`/`awaitAll`), exception handling blocks MUST explicitly catch and rethrow `kotlinx.coroutines.CancellationException` BEFORE handling generic fallback exceptions (`Throwable` or `Exception`).

**WHY**:
Kotlin coroutine cancellation is cooperative and signaled by throwing `CancellationException`. If an umbrella `catch (e: Exception)` handles the exception, logs it as a warning, and swallows it (e.g., returning `null`), the cancellation signal is erased. When a caller times out or calls `coroutineScope.cancel()`, worker tasks will continue executing, burning CPU and I/O resources and causing race conditions or deadlocks.

**WHEN TO APPLY**:
Any Kotlin coroutines or reactive bridge where batch parallel operations (`map { async { ... } }.awaitAll()`) wrap third-party parsers, file system streams, network calls, or LLM token streaming.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
public suspend fun loadDocuments(
    directoryPaths: List<Path>,
    documentParser: DocumentParser,
    context: CoroutineContext = Dispatchers.IO
): List<Document> = coroutineScope {
    val matchedFiles = collectFiles(directoryPaths)

    matchedFiles
        .map { file ->
            async(context) {
                try {
                    documentParser.parseAsync(FileSystemSource(file), context)
                } catch (e: CancellationException) {
                    // INVARIANT: Rethrow immediately to ensure caller cancellation is respected
                    throw e
                } catch (ignored: BlankDocumentException) {
                    // Known business-level skip
                    null
                } catch (e: Exception) {
                    // Resilient processing: single file corruption does not abort entire batch
                    logger.warn("Failed to load file '{}'", file, e)
                    null
                }
            }
        }
        .awaitAll()
        .filterNotNull()
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Swallowing CancellationException inside batch processor
matchedFiles.map { file ->
    async(context) {
        try {
            documentParser.parse(file)
        } catch (e: Exception) { // Catches CancellationException!
            logger.warn("Failed file: $file", e)
            null // Swallows cancellation: worker refuses to terminate when parent scope cancels!
        }
    }
}.awaitAll()
```

**VERIFICATION METHOD**:
Write a structured concurrency cancellation test verifying scope termination:
```kotlin
@Test
fun `loadDocuments respects coroutine cancellation and aborts immediately`() = runTest {
    val slowParser = DocumentParser { Thread.sleep(5000); Document.from("text") }
    val job = launch {
        loadDocuments(listOf(testDir), slowParser)
    }
    delay(50)
    job.cancel()
    val exitDuration = measureTimeMillis { job.join() }
    assertThat(exitDuration).isLessThan(500) // Asserts cancellation was prompt and not blocked by sleep
}
```

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Silent Reprompt Disabling Caused by Over-Eager Guardrail Rewrite Flagging (BUG-GUARDRAIL-01)
- **Context**: `langchain4j-guardrails` and `langchain4j-core` (`JsonExtractorOutputGuardrail.java`, `OutputGuardrailExecutor.java`, `OutputGuardrailResult.java`)
- **What Was Expected**: When a model returns perfectly formatted JSON, `JsonExtractorOutputGuardrail` should parse it into a domain POJO. If a subsequent downstream guardrail in the chain (e.g., `EndsWithSignature` or a field validator) detects a semantic violation, it should reprompt the model to correct its answer.
- **What Actually Happened**: `JsonExtractorOutputGuardrail.validate()` unconditionally marked every successful parse as a rewrite (`OutputGuardrailResult.successWith(json, value)`). The `OutputGuardrailExecutor` contains a guardrail rule: `Failure.blockRetry()` triggers if the output has been modified by an upstream guardrail, preventing hallucinations from compounding. Consequently, chaining any guardrail after `JsonExtractorOutputGuardrail` resulted in an immediate fatal crash on reprompt: `OutputGuardrailException: Retry or reprompt is not allowed after a rewritten output`.
- **Evidence in Repo**: Commit `03f1ab59`, Issues #6599 and #6600. File: `langchain4j-guardrails/src/main/java/dev/langchain4j/guardrails/JsonExtractorOutputGuardrail.java`.
- **Root Cause**: The developer equated "JSON extraction" with "rewriting output," failing to detect that clean input text is identical to the parsed JSON. There was also no factory method in `OutputGuardrailResult` to represent: "This output is unmodified, but here is the deserialized payload."
- **Remediation Code Diff**:
```diff
--- a/langchain4j-guardrails/src/main/java/dev/langchain4j/guardrails/JsonExtractorOutputGuardrail.java
+++ b/langchain4j-guardrails/src/main/java/dev/langchain4j/guardrails/JsonExtractorOutputGuardrail.java
@@ -118,7 +122,8 @@ public OutputGuardrailResult validate(AiMessage responseFromLLM) {
         LOGGER.debug("LLM output: {}", llmResponse);
 
         return deserialize(llmResponse)
-                .map(r -> successWith(r.json(), r.value()))
+                .map(r ->
+                        r.json().equals(llmResponse) ? successWithResult(r.value()) : successWith(r.json(), r.value()))
                 .orElseGet(() -> invokeInvalidJson(responseFromLLM, llmResponse));
     }

--- a/langchain4j-core/src/main/java/dev/langchain4j/guardrail/OutputGuardrailExecutor.java
+++ b/langchain4j-core/src/main/java/dev/langchain4j/guardrail/OutputGuardrailExecutor.java
@@ -281,6 +281,24 @@ protected OutputGuardrailException createGuardrailException(String message, Thro
+    @Override
+    protected OutputGuardrailResult composeResult(OutputGuardrailResult oldResult, OutputGuardrailResult newResult) {
+        var composedResult = super.composeResult(oldResult, newResult);
+
+        if (oldResult.isSuccess() && newResult.isSuccess() && !newResult.hasRewrittenResult()) {
+            var successfulResult =
+                    Optional.ofNullable(newResult.successfulResult()).orElseGet(oldResult::successfulResult);
+            return composedResult.withSuccessfulResult(successfulResult);
+        }
+        return composedResult;
+    }
```
- **Lesson**: Differentiate state transformations (mutations) from state enrichments (payload attachments). A pipeline flag indicating a destructive rewrite must be strictly conditional on `!original.equals(transformed)`.

---

### Incident 2: Workflow Engine Crash on Optional Agent Without Output Key (BUG-AGENTIC-02)
- **Context**: `langchain4j-agentic` (`AgentExecutor.java`)
- **What Was Expected**: If an agent marked as `optional = true` lacks required input arguments, the workflow engine should log the omission, skip the agent, and proceed with the remaining nodes in the graph.
- **What Actually Happened**: The entire workflow crashed with a `java.lang.NullPointerException` inside `DefaultAgenticScope.readState(Object)`.
- **Evidence in Repo**: Commit `27cc95a0`, Issues #6696 and #6697. File: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/internal/AgentExecutor.java`.
- **Root Cause**: `AgentExecutor.internalExecute` logged that the agent was being skipped, and then attempted to retrieve the agent's prior output: `Object response = agenticScope.readState(agentInvoker.outputKey())`. For agents that do not store state (the default for side-effect-only subagents), `agentInvoker.outputKey()` returns `null`. `DefaultAgenticScope` delegates directly to a `ConcurrentHashMap`, which throws an NPE when passed a `null` key.
- **Remediation Code Diff**:
```diff
--- a/langchain4j-agentic/src/main/java/dev/langchain4j/agentic/internal/AgentExecutor.java
+++ b/langchain4j-agentic/src/main/java/dev/langchain4j/agentic/internal/AgentExecutor.java
@@ -71,7 +71,9 @@ private Object internalExecute(
                             "Skipping optional agent '{}' because of missing argument '{}'",
                             agentInvoker.name(),
                             e.argumentName());
-                    Object response = agenticScope.readState(agentInvoker.outputKey());
+                    // a skipped agent that stores its result nowhere has no output key to read back
+                    String outputKey = agentInvoker.outputKey();
+                    Object response = outputKey == null ? null : agenticScope.readState(outputKey);
                     if (planner != null) {
                         planner.onSubagentInvoked(new AgentInvocation(type(), name(), agentId(), Map.of(), response));
                     }
```
- **Lesson**: Never assume map-based store wrappers allow `null` lookup keys. When wrapping `ConcurrentHashMap`, encapsulate key resolution behind an explicit null guard or return an empty container representation.

---

### Incident 3: Silent Subagent Truncation and Index Out of Bounds in ParallelMapperService (BUG-AGENTIC-03)
- **Context**: `langchain4j-agentic` (`ParallelMapperServiceImpl.java`)
- **What Was Expected**: Building a `ParallelMapperService` with invalid subagent counts should fail fast during the configuration build stage.
- **What Actually Happened**: Supplying zero subagents caused the executor to crash at runtime with `ArrayIndexOutOfBoundsException`. Supplying two or more subagents was silently accepted by the builder, but execution arbitrarily and silently executed only `subagents.get(0)`, ignoring the rest.
- **Evidence in Repo**: Commit `89826286`, Issues #6644 and #6662. File: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/workflow/impl/ParallelMapperServiceImpl.java`.
- **Root Cause**: Missing structural validation in `build()`. The service structurally required exactly one mapping worker to run against partitioned input collections, but lacked an explicit assertion on collection size.
- **Remediation Code Diff**:
```diff
--- a/langchain4j-agentic/src/main/java/dev/langchain4j/agentic/workflow/impl/ParallelMapperServiceImpl.java
+++ b/langchain4j-agentic/src/main/java/dev/langchain4j/agentic/workflow/impl/ParallelMapperServiceImpl.java
@@ -36,6 +36,11 @@ public ParallelMapperService<T> itemsProvider(String itemsProvider) {
 
     @Override
     public T build() {
+        if (subagents.size() != 1) {
+            throw new AgenticSystemConfigurationException(
+                    "A parallel mapper service requires exactly one subagent, but " + subagents.size()
+                            + " were provided.");
+        }
         boolean isArrayResult = isArrayResult();
         Class<? extends Object[]> arrayclass =
```
- **Lesson**: Validate cardinality invariants at build time. When a component architecture relies on singleton dispatch, throw a domain-specific configuration exception during builder validation instead of allowing runtime failure or silent truncation.

---

### Incident 4: Bare NPE on Untyped A2A Client Agent Parameter Validation (BUG-A2A-04)
- **Context**: `langchain4j-agentic` (`DefaultA2AClientBuilder.java`, `A2AClientAgentInvoker.java`)
- **What Was Expected**: Invoking an untyped Agent-to-Agent (A2A) client with missing declared arguments should throw a structured `MissingArgumentException`, matching the behavior of `UntypedAgentInvoker` and `McpClientAgentInvoker`.
- **What Actually Happened**: The untyped A2A client failed with an unformatted `java.lang.NullPointerException: Cannot invoke "Object.toString()" because the return value of "java.util.Map.get(Object)" is null`.
- **Evidence in Repo**: Issue #6665.
- **Root Cause**: `A2AClientAgentInvoker.toInvocationArguments()` delegated to `AgentUtil.untypedAgentInvocationArguments()`, which copied only *present* keys from state, leaving missing keys omitted. When the downstream caller performed `.get(key).toString()` without null checks, it triggered an immediate NPE instead of passing through parameter validation.
- **Remediation Code Diff**:
```diff
// Forensic Reconstruction of Fix:
- Object val = inputMap.get(declaredKey);
- return val.toString();
+ Object val = inputMap.get(declaredKey);
+ if (val == null) {
+     throw new MissingArgumentException(declaredKey);
+ }
+ return val.toString();
```
- **Lesson**: Validate argument maps against declared schemas before invoking operations on values. Untyped input boundaries require defensive checks that raise domain exceptions rather than language-level NPEs.

---

### Incident 5: False-Positive Disconnect Failures in SSE Streaming Integration Tests (BUG-TEST-05)
- **Context**: `langchain4j-anthropic` (`AnthropicStreamingChatModelPublisherCancellationTest.java`)
- **What Was Expected**: Cancelling an active subscription during a streaming chat response must abort the HTTP/SSE connection, and the mock HTTP server fixture should verify that the client disconnected.
- **What Actually Happened**: The test flaked on JDK 25 with: `AssertionError: [server never saw the client disconnect — the upstream stream was not aborted] Expecting AtomicBoolean(false) to have value: true`.
- **Evidence in Repo**: Issue #6656, CI Run 38203959925.
- **Root Cause**: The test fixture used an in-memory `HttpServer` that streamed 50 small SSE chunks and recorded a client disconnect only if `exchange.getResponseBody().write(...)` threw an `IOException`. On fast runtimes or newer JDKs with larger TCP/socket write buffers, all 50 server chunks fit entirely into the local socket buffer before the kernel processed the client's TCP RST/FIN. As a result, the server wrote all chunks without encountering an `IOException`, falsely indicating that the client failed to cancel.
- **Remediation Code Diff**:
```diff
// Forensic pattern to guarantee socket write failure:
- for (int i = 0; i < 50; i++) {
-     exchange.getResponseBody().write(chunk);
- }
+ // Increase payload size and use synchronization barriers to verify read channel termination
+ byte[] padding = new byte[65536]; // Exceed TCP window and OS buffer limits
+ while (!serverSawDisconnect.get() && chunkCount.get() < MAX_CHUNKS) {
+     try {
+         exchange.getResponseBody().write(padding);
+         exchange.getResponseBody().flush();
+         Thread.sleep(10);
+     } catch (IOException e) {
+         serverSawDisconnect.set(true);
+         break;
+     }
+ }
```
- **Lesson**: Never rely on small write payloads to detect network disconnects in integration tests. Socket write buffers absorb small writes even after the client has closed the connection. Flush payloads that exceed socket buffer sizes and couple assertions with transport-level events.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision

#### ConcurrentHashMap Key/Value Prohibition
`ConcurrentHashMap` does not allow `null` keys or values:
```java
// HAZARD: Throws NullPointerException if outputKey or result is null
ConcurrentMap<String, Object> map = new ConcurrentHashMap<>();
map.put(outputKey, result); 

// SAFE INVARIANT: Guard against nulls
if (outputKey != null && result != null) {
    map.put(outputKey, result);
} else if (outputKey != null) {
    map.remove(outputKey);
}
```

#### Bytecode Erasure and Binary Compatibility in Revapi
When an overridden method's return type is narrowed, the Java compiler produces synthetic bridge methods. Binary compatibility checkers like `revapi` may flag this change:
```json
{
  "regex": true,
  "code": "java\\.method\\.(parameterTypeErasureChanged|returnTypeErasureChanged)",
  "new": "(parameter|method) dev\\.langchain4j\\.guardrail\\.OutputGuardrailResult dev\\.langchain4j\\.guardrail\\.OutputGuardrailExecutor::composeResult\\(.*",
  "justification": "Overriding generic composeResult(R, R) generates bridge method composeResult(GuardrailResult, GuardrailResult) preserving binary compatibility."
}
```
*Rule*: When specializing return types in subclass overrides of generic library interfaces, verify generated bridge methods via `javap -c` and whitelist expected signature alterations in ABI enforcement tools.

#### Kotlin Overload Resolution: Member vs Extension Functions
In Kotlin, an instance member function always takes precedence over an extension function with the same signature:
```kotlin
// ChatModel.java defines:
// CompletableFuture<ChatResponse> chatAsync(ChatRequest request);

// Extension declared in ChatModelExtensions.kt:
public suspend fun ChatModel.chatAsync(
    request: ChatRequest,
    coroutineContext: CoroutineContext = defaultCoroutineContext()
): ChatResponse

// CALL SITE HAZARD:
val res = model.chatAsync(request) 
// Resolves to ChatModel.java member returning CompletableFuture, NOT the suspend extension!
// SAFE INVARIANT:
val res = model.chatAsync(request, Dispatchers.IO) // Explicitly provides optional parameter to match extension
// OR:
val res = model.chat(requestBuilder) // Dispatches to extension
```

---

### 2. Infinite Loop & Recursion Guards

#### Guardrail Reprompt Cycle Caps
```java
public class OutputGuardrailExecutor {
    private static final int MAX_REPROMPT_ATTEMPTS = 3;

    public OutputGuardrailResult executeWithRetry(OutputGuardrailRequest request) {
        int attempts = 0;
        OutputGuardrailRequest currentRequest = request;
        
        while (attempts < MAX_REPROMPT_ATTEMPTS) {
            OutputGuardrailResult result = executeSingle(currentRequest);
            if (result.isSuccess()) {
                return result;
            }
            if (result.hasFatalFailure() || result.hasRewrittenResult()) {
                // INVARIANT: Block infinite loop if text was rewritten
                throw new OutputGuardrailException("Retry disallowed after rewrite or fatal failure");
            }
            attempts++;
            currentRequest = currentRequest.withReprompt(result.failures());
        }
        throw new OutputGuardrailException("Exceeded maximum guardrail reprompt cycles: " + MAX_REPROMPT_ATTEMPTS);
    }
}
```

#### Reactive Streaming Termination via `callbackFlow` and `awaitClose`
In asynchronous flow bridges, failure to register `close()` or unhandled channel backpressure causes coroutine leaks and hangs.
```kotlin
public fun StreamingChatModel.chatFlow(block: ChatRequestBuilder.() -> Unit): Flow<StreamingChatModelReply> =
    callbackFlow {
        val handler = object : StreamingChatResponseHandler {
            override fun onPartialResponse(token: String) {
                // Non-blocking offer; buffers up to capacity
                trySend(StreamingChatModelReply.PartialResponse(token))
            }
            override fun onCompleteResponse(completeResponse: ChatResponse) {
                trySend(StreamingChatModelReply.CompleteResponse(completeResponse))
                close() // Crucial: signals downstream completion
            }
            override fun onError(error: Throwable) {
                trySend(StreamingChatModelReply.Error(error))
                close(error) // Closes channel with error state
            }
        }
        
        val chatRequest = chatRequest(block)
        chat(chatRequest, handler)

        // INVARIANT: Suspends until channel is closed by producer or cancelled by consumer.
        // Failing to call awaitClose will immediately close the channel on method exit!
        awaitClose {
            logger.debug("Cleaning up chat flow subscription")
