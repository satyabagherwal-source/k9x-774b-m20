# Agent Contract: Agent Contract: langchain4j-langchain4j-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "langchain4j-langchain4j-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:40:34.537Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-langchain4j-langchain4j-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [langchain4j-langchain4j-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:40:34.537Z`  
> **Learning ID**: `LEARN-REEXTRACT-langchain4j-langchain4j-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `langchain4j-langchain4j-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/langchain4j-langchain4j-learnings.md`  
> **Source**: github ([https://github.com/langchain4j/langchain4j](https://github.com/langchain4j/langchain4j))  
> **Source Version**: `b7839b71`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-11T09:15:21.753Z  
> **Learning ID**: `learn-github-langchain4j-langchain4j`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): langchain4j/langchain4j

---

## 1. Executive Forensic Architecture & System Mechanics

`langchain4j` is an idiomatic JVM-native orchestration framework designed for generative AI, agentic systems, Model Context Protocol (MCP), Agent-to-Agent (A2A) topologies, and Retrieval-Augmented Generation (RAG). It provides cross-vendor abstraction layers over large language models, vector stores, embedding models, and tool invocation pipelines. 

```
+----------------------------------------------------------------------------------------------------+
|                                      LangChain4j Core Engine                                      |
|                                                                                                    |
|  +--------------------+   +-----------------------+   +------------------------------------------+ |
|  |  Declarative /     |   | DefaultAgenticScope   |   |   AiServices Dynamic Proxy / Reflection  | |
|  |  Typed Interfaces  |   | (CopyOnWriteArrayList)|   |   (Invoker, Handlers, Memory Access)     | |
|  +---------+----------+   +-----------+-----------+   +--------------------+---------------------+ |
+------------|--------------------------|------------------------------------|-----------------------+
             |                          |                                    |
             v                          v                                    v
+------------------------+   +----------------------+   +------------------------------------------+
|  Remote Agent Layer    |   |     Tool Loop        |   |    Chat Memory & Observability Loop      |
|                        |   |     Execution        |   |                                          |
|  LazyResolution<T>     |   |                      |   |  - Add AiMessage to Memory First         |
|  - Dedup In-Flight     |   |  ToolService / Loop  |   |  - ToolExecutionResultMessage Added      |
|  - Timeout Guard (30s) |   |  - Sync, Async CF,   |   |  - Zero Orphan Tool Calls Contract       |
|  - Interrupt Thread    |   |    Reactive Stream   |   |  - Context Propagation Engine            |
+-----------+------------+   +----------+-----------+   +--------------------+---------------------+
            |                           |                                    |
            v                           v                                    v
   +-----------------+         +-----------------+                  +-----------------+
   | A2A / MCP Node  |         | Custom Tools    |                  | Vector DBs /    |
   | Protocol Engine |         | / Local Engine  |                  | Model Providers |
   +-----------------+         +-----------------+                  +-----------------+
```

### Core Subsystems and Architecture Boundaries

1. **AI Services Execution Pipeline (`dev.langchain4j.service`)**:
   - Dynamic interface generation via Java reflection proxying (`java.lang.reflect.Proxy`).
   - Translates high-level domain interface invocations into typed `ChatRequest` payloads, routes execution through prompt templates, retrieves conversational context from `ChatMemory`, validates input/output guardrails, and manages tool invocation cycles.
   - Provides 4 distinct runtime pipelines: Synchronous, Asynchronous (`CompletableFuture`), Streaming Token (`TokenStream`), and Reactive Stream (`Flow.Publisher`).

2. **Agentic System & Distributed Agent Coordination (`dev.langchain4j.agentic`)**:
   - Manages orchestration across independent subagents using topological graphs and execution planners.
   - Implements remote agent adapters: **MCP** (Model Context Protocol) and **A2A** (Agent-to-Agent communication).
   - Encapsulates non-deterministic remote bootstrapping via deferred, thread-safe resolution engines (`LazyResolution<T>`), enforcing timeouts and preventing thundering herds across parallel pipelines.

3. **Shared State & Memory Systems (`dev.langchain4j.memory`, `dev.langchain4j.agentic.scope`)**:
   - State isolation via `AgenticScope` and sliding-window memory constructs (`MessageWindowChatMemory`).
   - Handles multi-turn memory contracts, ensuring causal ordering between `UserMessage`, `AiMessage`, and `ToolExecutionResultMessage`.

4. **Kotlin Multiplatform / Coroutine Extensions (`langchain4j-kotlin`)**:
   - Idiomatic bridges transforming reactive streaming publishers and Java callback handlers into Kotlin `Flow` and structured coroutines (`suspendCancellableCoroutine`, `callbackFlow`).
   - Adapts IO workloads dynamically using Virtual Threads (`java.lang.Thread.ofVirtual()`) when detected on JDK 21+, falling back to `Dispatchers.IO`.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Atomic Chat Memory Tool Invariant: Result-Before-Return Protocol
**RULE**:
In any conversational or agentic system interacting with modern LLM provider APIs (e.g., Anthropic, OpenAI), whenever an `AiMessage` containing one or more `ToolExecutionRequest`s is persisted to `ChatMemory`, the system **MUST NOT** exit, yield execution, or return immediately to the caller without first appending every corresponding `ToolExecutionResultMessage` to that same `ChatMemory`. This order MUST be preserved across synchronous, asynchronous (`CompletableFuture`), and streaming (`Flow.Publisher`) execution paths.

**WHY**:
Modern stateful LLM provider APIs enforce strict protocol-level state transitions. If a user history contains an `AiMessage` with tool calls that is not immediately followed by corresponding `ToolExecutionResultMessage` entries, any subsequent inference turn on that conversation thread fails immediately with an HTTP 400 (`invalid_request_error: An assistant message with 'tool_use' must be followed by tool results`). Exiting early on `ReturnBehavior.IMMEDIATE` before persistence leaves conversational state permanently corrupted.

**WHEN TO APPLY**:
Apply in any agent runtime, tool execution engine, or chat-memory pipeline supporting early exits, immediate returns (`ReturnBehavior.IMMEDIATE`), compensation handlers, or asynchronous/reactive streaming response handlers.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
public CompletionStage<ToolServiceResult> executeAndPersistRound(
        ChatMemory chatMemory,
        AiMessage aiMessage,
        List<ToolExecutionRequest> requests,
        InvocationContext context) {

    // 1. Memory must already contain the AiMessage requesting the tools
    return executeToolsConcurrently(requests)
        .thenCompose(toolResults -> {
            List<ChatMessage> resultMessages = toolResults.stream()
                .map(r -> (ChatMessage) ToolExecutionResultMessage.from(r.request(), r.resultText()))
                .toList();

            // 2. CRITICAL: Persist tool execution results BEFORE handling ReturnBehavior or returning early
            return chatMemory.addAsync(resultMessages)
                .thenCompose(ignored -> {
                    // 3. Evaluate early exit / return conditions AFTER persistence is committed
                    if (shouldReturnImmediately(toolResults)) {
                        return CompletableFuture.completedFuture(
                            immediateResult(toolResults, aiMessage)
                        );
                    }
                    // 4. Continue to next inference round-trip
                    return callModelAndContinue(context, chatMemory);
                });
        });
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Evaluating early return BEFORE persisting results to ChatMemory.
// Leaves ChatMemory corrupted: [UserMessage, AiMessage(toolExecutionRequests)]
if (shouldReturnImmediately(outcome.anyToolErrored(), outcome.returnBehaviors())) {
    return CompletableFuture.completedFuture(immediateResult(outcome));
}

// Memory persistence happens too late!
persistToolResultsAndResolveMessages(chatMemory, outcome.resultMessages());
```

**VERIFICATION METHOD**:
Verify with a concurrent unit test using a mocked tool configured with `ReturnBehavior.IMMEDIATE`. Verify that `chatMemory.messages()` contains alternating sequences of `AiMessage` and `ToolExecutionResultMessage` with matching tool call IDs before the test assertion inspects the returned result:
```java
@Test
void should_enforce_tool_result_in_memory_on_immediate_return() {
    Assistant assistant = AiServices.builder(Assistant.class)
        .chatModel(modelReturningToolCall("call-1", "toolName"))
        .chatMemory(memory)
        .tools(new ImmediateReturningTool())
        .build();

    Result<String> result = assistant.chat("Run tool");
    
    List<ChatMessage> history = memory.messages();
    assertThat(history).hasSize(3);
    assertThat(history.get(0)).isInstanceOf(UserMessage.class);
    assertThat(history.get(1)).isInstanceOf(AiMessage.class);
    assertThat(history.get(2)).isInstanceOf(ToolExecutionResultMessage.class);
    assertThat(((ToolExecutionResultMessage) history.get(2)).id()).isEqualTo("call-1");
}
```

---

### 2. Multi-Threaded Lazy Resolution and In-Flight Request Deduplication
**RULE**:
When initializing or resolving heavy remote dependencies (e.g., fetching remote agent cards, listing remote RPC/MCP tools, or establishing network transports) lazily upon first invocation, the system **MUST**:
1. Deduplicate concurrent invocations so that all callers share a single in-flight resolution future.
2. Enforce an explicit resolution timeout (`resolutionTimeout(Duration)`).
3. Propagate thread interruption to the underlying resolution worker when the timeout triggers.
4. Prevent caching of failures, allowing subsequent calls to retry immediately.
5. Prevent thundering herds while an interrupted background resolution task is still actively draining or cleaning up.

**WHY**:
Without shared lazy resolution, concurrent client requests trigger identical remote network calls simultaneously, crashing remote servers or exhausting local sockets. Without timeout bounds, missing network read timeouts in lower-level HTTP/RPC client libraries cause application threads to block indefinitely. If failed futures are cached, transient connectivity blips permanently disable the agent for the lifetime of the JVM.

**WHEN TO APPLY**:
Apply to any lazy resource initialization, MCP client initial handshakes, A2A discovery card fetching, OpenAPI specification parsing, or JNDI/remote discovery lookups triggered on the request path.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
public class LazyResolution<T> {
    private final Supplier<String> descriptionSupplier;
    private final Supplier<T> resolver;
    private final AtomicReference<CompletableFuture<T>> inFlight = new AtomicReference<>();
    private volatile T resolvedValue;

    public LazyResolution(Supplier<String> descriptionSupplier, Supplier<T> resolver) {
        this.descriptionSupplier = descriptionSupplier;
        this.resolver = resolver;
    }

    public T get(Duration timeout) throws TimeoutException, InterruptedException {
        T value = this.resolvedValue;
        if (value != null) {
            return value;
        }

        CompletableFuture<T> currentFuture;
        boolean isInitiator = false;

        synchronized (this) {
            value = this.resolvedValue;
            if (value != null) {
                return value;
            }
            currentFuture = inFlight.get();
            if (currentFuture == null) {
                currentFuture = new CompletableFuture<>();
                inFlight.set(currentFuture);
                isInitiator = true;
            }
        }

        if (isInitiator) {
            CompletableFuture<T> futureRef = currentFuture;
            Thread workerThread = Thread.currentThread();
            
            // Execute resolution with boundary timeout
            try {
                T result = (timeout == null || timeout.isZero()) 
                    ? resolver.get() 
                    : resolveWithTimeout(resolver, timeout);
                
                this.resolvedValue = result;
                futureRef.complete(result);
                return result;
            } catch (Throwable t) {
                futureRef.completeExceptionally(t);
                throw t;
            } finally {
                // Ensure failures are NOT permanently cached: clear in-flight reference
                synchronized (this) {
                    if (this.resolvedValue == null) {
                        inFlight.set(null);
                    }
                }
            }
        } else {
            // Awaiting threads wait on the active resolution attempt
            try {
                if (timeout == null || timeout.isZero()) {
                    return currentFuture.get();
                } else {
                    return currentFuture.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
                }
            } catch (ExecutionException e) {
                Throwable cause = e.getCause();
                if (cause instanceof RuntimeException re) throw re;
                throw new RuntimeException(cause);
            }
        }
    }

    private T resolveWithTimeout(Supplier<T> supplier, Duration timeout) 
            throws TimeoutException, InterruptedException {
        // Enforce execution on separate thread with thread interrupt on cancellation
        Future<T> task = SharedExecutor.submit(supplier::get);
        try {
            return task.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException te) {
            task.cancel(true); // Interrupt worker thread
            throw te;
        } catch (ExecutionException ee) {
            throw new RuntimeException(ee.getCause());
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Double-checked locking with raw lock and no timeout, or caching failed exceptions
private McpClient client() {
    if (mcpClient == null) {
        synchronized(this) {
            if (mcpClient == null) {
                // Unbounded blocking call! If supplier hangs, all worker threads lock up permanently.
                // If it fails, subsequent calls re-execute without coordination.
                mcpClient = mcpClientSupplier.get();
            }
        }
    }
    return mcpClient;
}
```

**VERIFICATION METHOD**:
Create a test harness with a mock supplier gated behind a `CountDownLatch` and 10 concurrent reader threads. Verify with `Awaitility` that only 1 supplier call is made, all 10 threads receive the value within the timeout, and on forced timeout, all waiting threads fail with a `TimeoutException` and the worker thread receives an interrupt:
```java
@Test
void should_timeout_and_deduplicate_concurrent_calls() throws Exception {
    AtomicInteger calls = new AtomicInteger();
    CountDownLatch gate = new CountDownLatch(1);
    LazyResolution<String> res = new LazyResolution<>(() -> "test", () -> {
        calls.incrementAndGet();
        gate.await();
        return "ok";
    });

    ExecutorService pool = Executors.newFixedThreadPool(5);
    List<Future<?>> futures = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
        futures.add(pool.submit(() -> res.get(Duration.ofMillis(100))));
    }

    for (Future<?> f : futures) {
        assertThatThrownBy(f::get).hasCauseInstanceOf(TimeoutException.class);
    }
    assertThat(calls.get()).isEqualTo(1);
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: ChatMemory Missing ToolExecutionResultMessage on Immediate Return (BUG-LC4J-01)
- **Context**: `langchain4j/src/main/java/dev/langchain4j/service/AiServiceStreamingEventPublisher.java` and `ToolService.java`
- **What Was Expected**: When a tool marked with `@Tool(returnBehavior = IMMEDIATE)` executes, the tool's result should be persisted to `ChatMemory` before returning the final response to the caller, maintaining conversational integrity for subsequent LLM turns.
- **What Actually Happened**: In asynchronous (`CompletableFuture`) and reactive streaming (`Flow.Publisher`) modes, the code checked `shouldReturnImmediately(...)` before calling `persistToolResultsAndResolveMessages(...)`. The LLM's `AiMessage` containing the `toolExecutionRequests` was already in `ChatMemory`, leaving the history truncated: `[UserMessage, AiMessage(toolExecutionRequests)]`. The corresponding `ToolExecutionResultMessage` was never written. On the subsequent user turn, OpenAI/Anthropic APIs rejected the history with HTTP 400 because a tool call had no matching result.
- **Evidence in Repo**: Commit `cd4cead3`, Issue #7027, PR #7028. Tests added in `AiServiceToolCallMemoryTest.java` and `ReturnBehaviorCombinationsTest.java`.
- **Root Cause**: Premature return evaluation inside the non-blocking continuation pipeline. Synchronous and `TokenStream` modes executed persistence first, but asynchronous and reactive pipelines bypassed persistence entirely when jumping straight to completion callbacks.
- **Remediation Code Diff**:
```java
// langchain4j/src/main/java/dev/langchain4j/service/tool/ToolService.java
- if (shouldReturnImmediately(outcome.anyToolErrored(), outcome.returnBehaviors())) {
-     return CompletableFuture.completedFuture(immediateToolServiceResult(
-             intermediateResponses, toolExecutions, aggregateTokenUsage, lastChatRequest));
- }
-
  if (isCancelled(cancellation)) {
      return CompletableFuture.<ToolServiceResult>failedFuture(new CancellationException());
  }

  return persistToolResultsAndResolveMessages(
                  context, chatMemory, accumulator, outcome.resultMessages(), invocationContext)
          .thenCompose(nextMessages -> {
+             if (isCancelled(cancellation)) {
+                 return CompletableFuture.<ToolServiceResult>failedFuture(
+                         new CancellationException());
+             }
+             if (shouldReturnImmediately(outcome.anyToolErrored(), outcome.returnBehaviors())) {
+                 return CompletableFuture.completedFuture(immediateToolServiceResult(
+                         intermediateResponses,
+                         toolExecutions,
+                         aggregateTokenUsage,
+                         lastChatRequest));
+             }
              return callModelAndContinue(
                      parameters,
                      toolServiceContext,
                      aggregateTokenUsage,
                      roundTripsLeft,
                      toolResults,
                      nextMessages);
          })
          .toCompletableFuture();
```
- **Lesson**: Side-effecting persistence state invariants must precede control-flow diversion (e.g., early return). Never short-circuit asynchronous computation chains before intermediate transactional entities are committed.

---

### Incident 2: Unbounded Latency and Thread Hangs in MCP and A2A Client Resolution (BUG-LC4J-02)
- **Context**: `langchain4j-agentic-a2a/.../DefaultA2AClientBuilder.java` and `langchain4j-agentic-mcp/.../DefaultMcpClientBuilder.java`
- **What Was Expected**: Lazy initialization of A2A remote agent cards and MCP tool discovery must terminate within a predictable timeout window, release thread resources upon interruption, and allow parallel incoming calls to share the single network fetch.
- **What Actually Happened**: The initial card fetch in A2A and tool discovery in MCP lacked request timeouts. The underlying `a2a-java` HTTP client contained no default request timeout. When remote hosts were slow or hung, calling threads blocked indefinitely inside `ReentrantLock.lockInterruptibly()`. Furthermore, concurrent incoming requests queued up and executed redundant consecutive network resolutions one after another once the lock was freed.
- **Evidence in Repo**: Commit `d6bcb528`, Issue #6958, PR #7058. Extensive test suites added in `A2ALazyAgentCardTest.java`.
- **Root Cause**: Reliance on local `ReentrantLock` synchronization wrapping an un-timed remote network discovery supplier without an in-flight future deduplicator or context timeout enforcement.
- **Remediation Code Diff**:
```java
// langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/DefaultA2AClientBuilder.java
- private Supplier<AgentCard> agentCardSource;
- private final ReentrantLock lazyInitLock = new ReentrantLock();
- private volatile AgentCard agentCard;
+ static final Duration DEFAULT_RESOLUTION_TIMEOUT = Duration.ofSeconds(30);
+ private final LazyResolution<AgentCard> cardResolution;
+ Duration resolutionTimeout;

// In resolve tool:
- resolvedTool = tool;
- if (resolvedTool == null) {
-     lockForLazyInit();
-     try {
-         resolvedTool = tool;
-         if (resolvedTool == null) {
-             resolvedTool = findTool(listTools());
-             applyTool(resolvedTool);
-         }
-     } finally {
-         lazyInitLock.unlock();
-     }
- }
- return resolvedTool;
+ try {
+     return toolResolution.get(resolutionTimeout);
+ } catch (TimeoutException e) {
+     throw new McpToolResolutionException(name(), configuredToolName(), resolutionTimeout, e);
+ } catch (InterruptedException e) {
+     Thread.currentThread().interrupt();
+     throw new McpToolResolutionException(name(), configuredToolName(), e);
+ }
```
- **Lesson**: Lazy remote initializers must never use bare blocking locks. Encapsulate lazy initialization within an abstraction (`LazyResolution`) that enforces timeouts, supports cancellation interrupts, deduplicates concurrent requests, and prevents poisoning state with failed attempts.

---

### Incident 3: ConcurrentModificationException in Shared AgenticScope Iteration (BUG-LC4J-03)
- **Context**: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/scope/DefaultAgenticScope.java`
- **What Was Expected**: Concurrent subagent threads reading conversation history or filtering agent invocations by name/type while another subagent or system listener registered invocations must never throw concurrency exceptions.
- **What Actually Happened**: `DefaultAgenticScope` initialized `agentInvocations` and `context` using `Collections.synchronizedList(new ArrayList<>())`. When reader threads iterated over the lists (e.g., via streams or enhanced for-loops in `contextAsConversation()`), another thread calling `registerAgentInvocation()` or `registerContext()` modified the underlying `ArrayList`, throwing `java.util.ConcurrentModificationException`.
- **Evidence in Repo**: Commit `2382b861`, Issue #7023, PR #7024. Added `DefaultAgenticScopeConcurrentReadTest.java`.
- **Root Cause**: Misunderstanding of `Collections.synchronizedList`. While individual get/set operations are thread-safe, iterating over a `synchronizedList` requires external synchronization on the list itself. Unsynchronized stream and iterator passes over concurrent reads/writes are fail-fast and throw `ConcurrentModificationException`.
- **Remediation Code Diff**:
```java
// langchain4j-agentic/src/main/java/dev/langchain4j/agentic/scope/DefaultAgenticScope.java
- private final List<AgentInvocation> agentInvocations = Collections.synchronizedList(new ArrayList<>());
- private final List<AgentMessage> context = Collections.synchronizedList(new ArrayList<>());
+ // Iterators are snapshots, so a reader can walk either list while another thread registers an
+ // invocation or appends messages, without ConcurrentModificationException.
+ private final List<AgentInvocation> agentInvocations = new CopyOnWriteArrayList<>();
+ private final List<AgentMessage> context = new CopyOnWriteArrayList<>();
```
- **Lesson**: `Collections.synchronizedList` is an anti-pattern for concurrent read-heavy shared state structures. When iterators must run concurrently with append operations, use `CopyOnWriteArrayList` to ensure iteration traverses an immutable snapshot without locking or failing fast.

---

### Incident 4: Zombie Subprocess Leak in DefaultMcpClient on Initialization Failure (BUG-LC4J-04)
- **Context**: `langchain4j-agentic-mcp/.../DefaultMcpClientBuilder.java` and `DefaultMcpClient.java`
- **What Was Expected**: If an MCP transport fails during the client's `initialize()` phase (e.g., handshake failure, protocol error, or invalid capabilities negotiation), the transport process (e.g., `stdio` OS subprocess or socket connection) must be closed and destroyed immediately.
- **What Actually Happened**: The `DefaultMcpClient` constructor instantiated the transport and started the underlying operating system subprocess or socket. If `initialize()` threw an exception, the constructor aborted without catching the error or invoking `transport.close()`. When managed by a retryable supplier (`Supplier<McpClient>`), every failed connection attempt orphaned a running background OS subprocess, quickly leading to PID table exhaustion.
- **Evidence in Repo**: Issue #7041.
- **Root Cause**: Missing constructor-level `try-catch-finally` resource cleanup around two-phase object initialization (allocating OS resources in phase 1, failing network protocol verification in phase 2).
- **Remediation Pattern**:
```java
public DefaultMcpClient(McpTransport transport) {
    this.transport = transport;
    try {
        transport.start();
        initialize();
    } catch (Throwable t) {
        try {
            transport.close();
        } catch (Exception suppressed) {
            t.addSuppressed(suppressed);
        }
        throw t;
    }
}
```
- **Lesson**: In constructors that manage unmanaged native resources (processes, sockets), if any post-allocation step can throw an exception, you must guarantee safe teardown inside a catch block before letting the exception escape.

---

### Incident 5: Disconnected Parent Listener Chains for MCP and A2A Subagents (BUG-LC4J-05)
- **Context**: `DefaultMcpClientBuilder.java` and `DefaultA2AClientBuilder.java`
- **What Was Expected**: When configuring an agentic topology with hierarchical subagents, listeners configured on the parent agent with `inheritedBySubagents() == true` must receive lifecycle events from nested MCP and A2A subagents.
- **What Actually Happened**: The internal builders for MCP and A2A subagent proxies failed to invoke `registerInheritedParentListener(parent.listener())` during the `.setParent()` builder call. As a result, telemetry, audit logs, and tracing spans attached to root agents silently dropped all downstream tool-calling and execution events originating from MCP/A2A subagents.
- **Evidence in Repo**: Issue #7042.
- **Root Cause**: Builder implementations for new agent types (MCP/A2A) omitted the inherited listener registration step present in core agent builder abstractions.
- **Remediation Pattern**:
```java
// In builder hierarchy setter
public B setParent(Agent parent) {
    this.parent = parent;
    if (parent != null && parent.listener() != null) {
        registerInheritedParentListener(parent.listener());
    }
    return (B) this;
}
```
- **Lesson**: Subsystem implementations of a shared domain abstraction must strictly adhere to parent-child contract propagation via base classes or explicit test-verified compliance checks.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Null-Safe String & Path Sanitization**: Always strip user credentials from URL strings before appending them to logging context or exception messages. In `A2AAgentCardException`, `withoutCredentials(a2aServerUrl)` must parse URIs using `java.net.URI` and reassemble components omitting the `userInfo` part. Never invoke `.toString()` directly on raw endpoint configurations.
- **Type Coercion and Primitive Wrapper Overloads**: In Kotlin-Java interoperability, Kotlin extension methods cannot override matching Java member method signatures. As documented in `ChatModelExtensions.kt`:
  ```kotlin
  // member signature: chatAsync(ChatRequest): CompletableFuture<ChatResponse>
  // Calling model.chatAsync(request) executes the Java member, NOT the Kotlin suspend function!
  // To suspend, the extension requires an explicit context parameter or must be awaited:
  model.chatAsync(request, coroutineContext = Dispatchers.IO) // Selects extension
  model.chatAsync(request).await()                            // Suspends on Java Future
  ```
- **Shallow Copy vs. Snapshot Arrays**: In `AiServiceStreamingEventPublisher`, collections passed into concurrent completion chains must be defensively copied:
  ```java
  List<ChatMessage> messagesToAdd = new ArrayList<>(resultMessages);
  ```
  Passing raw internal sublists allows concurrent modifications to alter elements while serialization or streaming is in progress.

---

### 2. Infinite Loop & Recursion Guards
- **Tool Calling Round-Trip Counter Decrement Placement**:
  - **Invariant**: The round-trip budget check (`roundTripsLeft-- == 0`) MUST execute **prior** to performing asynchronous memory persistence or model re-invocation, but **only if** the message actually contains tool requests.
  - **Defect Fixed**: Decrementing the counter unconditionally on responses without tool calls exhausted the budget on simple conversation iterations. Decrementing too late caused unbounded async recursion when model implementations looped identical tool call requests.
  ```java
  // Correct invariant:
  if (aiMessage.hasToolExecutionRequests() && roundTripsLeft-- == 0) {
      throw runtime(
          "Something is wrong, exceeded %s tool calling round trips (maxToolCallingRoundTrips)",
          context.toolService.maxToolCallingRoundTrips());
  }
  ```
- **Kotlin File Tree Traversal Recursion Guard**:
  In `FileSystemDocumentLoaderExtensions.kt`, prevent directory walk recursion depth overflows by selecting between single-level listing and tree streaming:
  ```kotlin
  val fileStream = if (recursive) Files.walk(path) else Files.walk(path, 1)
  ```
  The resulting stream MUST be enclosed in a `use { ... }` block to guarantee OS file descriptor teardown immediately upon consumption.

---

### 3. UI & UX Micro-Mechanics (Reactive Streaming & Token Backpressure)
- **TokenStream Buffer Overflow Policies**:
  In reactive streaming to web/mobile clients, language models emit tokens faster than consumer UI render loops can process them.
  - **Invariant**: When bridging Java `TokenStream` to Kotlin `Flow`, buffer capacity must default to an explicit bounded threshold (`DEFAULT_BUFFER_CAPACITY = 32768`), and backpressure MUST suspend the producer instead of silently dropping tokens:
  ```kotlin
  public fun TokenStream.asFlow(
      bufferCapacity: Int = DEFAULT_BUFFER_CAPACITY,
      onBufferOverflow: BufferOverflow = BufferOverflow.SUSPEND,
      includeCompleteResponse: Boolean = false
  ): Flow<String> = callbackFlow { ... }.buffer(
      capacity = bufferCapacity, 
      onBufferOverflow = onBufferOverflow
  )
  ```
- **Immediate Response vs. LLM Text Suppression**:
  When a tool returns with `ReturnBehavior.IMMEDIATE`, the UI layer must receive the tool result payload directly; the LLM output string content must be normalized to `null` to prevent UI widgets from displaying partial, hallucinated, or unparsed assistant strings.

---

### 4. Backend Concurrency & Memory Safety
- **CopyOnWriteArrayList for Iteration Snapshot Isolation**:
  To protect multi-agent conversational state tracking against `ConcurrentModificationException` without inducing lock contention, mutable lists that are read frequently (e.g., during context generation) and appended to incrementally MUST use `CopyOnWriteArrayList`:
  ```java
  private final List<AgentInvocation> agentInvocations = new CopyOnWriteArrayList<>();
  private final List<AgentMessage> context = new CopyOnWriteArrayList<>();
  ```
- **Reentrant Lock Cancellation Invariant**:
  When replacing `ReentrantLock` with `CompletableFuture` pipelines in asynchronous execution routines, cancellation checks must be performed both **before** initiating asynchronous operations and **inside the completion callback**:
  ```java
  if (tube.cancelled()) {
      return;
  }
  toolResultsPersistence.set(persisted);
  // Re-check after atomic transition:
  if (alreadyCancelled) {
      doCancellationCompensation(null, null);
      return;
  }
  ```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Pluggable Parser Exception Isolation**:
  When batch-ingesting documents, unreadable files must not fail the entire batch. However, `CancellationException` MUST be rethrown to preserve structured concurrency cancellation semantics:
  ```kotlin
  try {
      documentParser.parseAsync(FileSystemSource(file), context)
  } catch (e: CancellationException) {
      // MANDATORY: Rethrow cancellation so parent scope cancellation functions properly
      throw e
  } catch (ignored: BlankDocumentException) {
      // Ignored by design: blank files are skipped silently
      null
  } catch (e: Exception) {
      // Pluggable parsers may fail on corrupt files; log warning and skip
      logger.warn("Failed to load '{}'", file, e)
      null
  }
  ```
- **Async Execution Exception Unwrapping**:
  When dealing with Java's `CompletableFuture`, always unwrap `CompletionException` and `ExecutionException` before rethrowing or matching error types; otherwise, domain-specific exception handlers (e.g., catching `AgentUnavailableException`) fail to match because they are wrapped inside standard runtime container exceptions.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- Modular decoupling across `langchain4j-core` (pure models, zero heavy dependencies), `langchain4j` (service proxy orchestration), and dedicated technology integration modules (`langchain4j-open-ai`, `langchain4j-pgvector`, `langchain4j-agentic-mcp`).
- Clear unidirectional dependency graph: Modules depend strictly on `langchain4j-core`; core never depends on integrations.

### 2. Core Abstractions
- Primary conversational primitives: `ChatMessage` hierarchy (`UserMessage`, `AiMessage`, `ToolExecutionResultMessage`, `SystemMessage`).
- Interface Contracts: `ChatModel` (blocking inference), `StreamingChatModel` (callback streaming), `ChatMemory` (state container), `TokenStream` (reactive stream), `ToolSpecification` (JSON-schema tool definition).
- Invariant: Immutability across message types and data value classes.

### 3. Error Handling
- Comprehensive domain exception hierarchy: `AgentUnavailableException` -> `A2AAgentCardException`, `McpToolResolutionException`.
- Two-tier compensation architecture: When tools support compensating actions (`@CompensateFor`), failures in execution trigger backward rollbacks via `doCancellationCompensation()`.

### 4. Testing
- Concurrency and race condition testing using `CountDownLatch`, `CyclicBarrier`, and `Awaitility`.
- Dynamic reflection inspection in tests: Testing private thread states and simulating lock contention by swapping fields via reflection or custom test list implementations (`pauseOnFirstElement`).
- Mock execution environments: `ChatModelMock`, `StreamingChatModelMock`.

### 5. Security
- Credential masking in network exceptions via `withoutCredentials(...)` stripping basic auth and query tokens.
- Secure code execution engines: GraalVM polyglot sandbox isolating JavaScript and Python tool execution with restricted privileges and memory ceilings.

### 6. Performance
- Virtual Thread adoption: Auto-detection of JDK 21+ virtual thread capabilities via `VirtualThreadUtils.isVirtualThreadsSupported()`.
- Thread-safe zero-copy list iteration via snapshot iterators on `CopyOnWriteArrayList` eliminating lock contention on context reads.

### 7. Deployment
- Java version matrix CI: Multi-JDK automated validation workflows testing JDK 17, JDK 21, and JDK 25 (`nightly_jdk17.yaml`, `nightly_jdk21.yaml`, `nightly_jdk25.yaml`).
- Enforced split-package detection via `check-split-packages.sh` preventing classpath conflicts in Java 9+ JPMS modular environments.

### 8. Agent Patterns
- ReAct, sequence, and planner-based topologies.
- Distributed protocols: MCP (Model Context Protocol) and A2A (Agent-to-Agent) with lazy discovery and resolution timeout guards.
- Tool loop control: Configurable maximum round-trip thresholds (`maxToolCallingRoundTrips`) preventing recursive infinite inference costs.

### 9. Data Flow
```
User Invocation -> AiService Proxy -> ChatMemory Fetch -> Output Guardrail Check (Pre)
     |
     v
Prompt Template Engine -> ChatRequest -> ChatModel Engine (Sync / Async / Stream)
     |
     v
AiMessage (Tool Calls Present) -> ChatMemory.addAsync(AiMessage)
     |
     v
Tool Execution Pipeline -> ToolService / Compensable Accumulator
     |
     v
ChatMemory.addAsync(ToolExecutionResultMessage) -> (Return Immediate ? Exit : Recurse LLM)
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Thread-Safe Lazy Resolution Guard (`LazyResolution<T

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
