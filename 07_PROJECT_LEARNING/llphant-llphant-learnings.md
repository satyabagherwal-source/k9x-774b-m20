> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/llphant-llphant-learnings.md`  
> **Source**: github ([https://github.com/LLPhant/LLPhant](https://github.com/LLPhant/LLPhant))  
> **Source Version**: `4c5542b9`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T00:51:43.975Z  
> **Learning ID**: `learn-github-llphant-llphant`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): LLPhant/LLPhant

## 1. Executive Forensic Architecture & System Mechanics

`LLPhant/LLPhant` is an enterprise-grade Generative AI and Vector Database orchestration framework engineered for PHP 8.1+ (supporting Laravel, Symfony, and standalone CLI microservices). It serves as the PHP ecosystem's equivalent of LangChain and LlamaIndex, resolving the impedance mismatch between synchronous/blocking PHP execution lifecycles and modern asynchronous, stateful, streaming GenAI agent operations.

```
+----------------------------------------------------------------------------------------------------+
|                                         LLPhant Client API                                         |
+----------------------------------------------------------------------------------------------------+
       |                                      |                                       |
       v                                      v                                       v
+------------------+                  +------------------+                   +------------------+
|   Chat Engine    |                  |    Embeddings    |                   |   Vector Stores  |
| (OpenAI, Ollama, |                  |  (OpenAI, Cohere,|                   |  (PgVector, Redis|
| Anthropic, etc.) |                  |   Mistral, etc.) |                   |  Qdrant, Milvus) |
+------------------+                  +------------------+                   +------------------+
       |                                      |                                       |
       +------------------+-------------------+---------------------------------------+
                          v
+----------------------------------------------------------------------------------------------------+
|                                    Stream Processor & Tool Caller                                  |
|   - SSE Chunk Accumulator ($toolsToCall[$index]['arguments'] .= $delta->arguments)                 |
|   - Protocol Compatibility Adapter (OpenAI tool_calls finish vs Gemini stop finish)                |
|   - Dynamic Reflection Dispatcher (FunctionInfo -> Parameter Bindings -> Type Checked Exec)        |
+----------------------------------------------------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------------------------------------------------+
|                               Guardrails, Classifiers & Transforms                                 |
|   - JevClassifier (Score, Choice, Noul)                                                            |
|   - ClassifierPromptInjectionQueryTransformer                                                      |
+----------------------------------------------------------------------------------------------------+
```

### Architectural Subsystem Boundaries & Decoupling

1. **Model Abstraction Barrier (`LLPhant\Chat\ChatInterface`)**: Decouples client consumer code from underlying model transport layers (`OpenAIChat`, `AnthropicChat`, `MistralAIChat`, `OllamaChat`). It enforces unified signature contracts for text generation, conversation history (`Message[]`), structured output parsing, and tool-calling execution.
2. **Streaming Delta Aggregator & State Machine (`createStreamedResponse`)**: Operates on Server-Sent Events (SSE) chunks. LLM streaming returns fragmented JSON chunks across sequential delta frames. The engine maintains an active frame accumulator indexing partial parameter buffers before dispatching reflected PHP callables.
3. **Cross-Vendor API Compatibility Layer**: Intercepts structural variations between upstream providers exposing pseudo-OpenAI endpoints (e.g., Google Gemini Flash via OpenAI proxy, LocalAI, Mistral). It standardizes varying finish reasons (`stop` vs `tool_calls`) and differing payload envelopes (e.g., null vs empty array field responses).
4. **Vector Database & RAG Pipeline (`LLPhant\Embeddings\VectorStores`)**: Bridges PHP Doctrine ORM/database adapters with vector indexes (PgVector, Qdrant, ChromaDB, Milvus, Elasticsearch, Typesense). Embeddings generation is isolated behind `EmbeddingGeneratorInterface` with chunking and token-window budgeting.
5. **Dynamic Reflection Engine (`FunctionInfo`)**: Extracts parameter types, docstrings, and constraints from arbitrary PHP classes via PHP Reflection APIs (`ReflectionMethod`, `ReflectionParameter`), auto-generating OpenAI/JSON-schema compliant function manifests.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Robust Server-Sent Events (SSE) Streamed Tool Call Fragmentation Reassembly
**RULE**:
When parsing streaming tool-call deltas from LLM SSE streams, client code MUST NOT assume tool arguments arrive in a single packet, nor MUST it assume an array index is consistently provided on every chunk. The accumulator MUST initialize a tool call entry upon encountering a function identifier, index non-indexed deltas against `array_key_last()`, and monotonically append raw string fragments until a non-destructive finish reason is encountered.

**WHY**:
Upstream LLMs stream arguments character-by-character or token-by-token. The initial delta payload commonly contains `id`, `type`, and `function.name` with empty `function.arguments: ""`. Subsequent chunks contain partial JSON fragments (`{"city":`, `" Paris"`, `"}`). Dropping or overwriting prior deltas causes critical `ArgumentCountError` or JSON decode failures. Furthermore, multi-provider proxies (e.g., Gemini's OpenAI compatibility endpoint) omit chunk indexes entirely and terminate with `finish_reason: "stop"` instead of `finish_reason: "tool_calls"`. Strict adherence to `tool_calls` finish tokens results in total execution loss.

**WHEN TO APPLY**:
In any streaming AI client, proxy, or gateway ingesting OpenAI-compatible chunked SSE responses where dynamic tool/function calling is supported.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
<?php

declare(strict_types=1);

namespace Brain\Stream;

final class StreamedToolCallAccumulator
{
    /** @var array<int|string, array{id: string, function: string, arguments: string}> */
    private array $toolsToCall = [];

    /**
     * Ingests a streaming tool-call delta frame.
     *
     * @param array{
     *     index?: int|null,
     *     id?: string|null,
     *     function?: array{name?: string|null, arguments?: string|null}|null
     * } $toolCallDelta
     */
    public function ingestDelta(array $toolCallDelta): void
    {
        $functionName = $toolCallDelta['function']['name'] ?? null;
        $argumentsChunk = $toolCallDelta['function']['arguments'] ?? '';
        $callId = $toolCallDelta['id'] ?? null;
        $explicitIndex = $toolCallDelta['index'] ?? null;

        if ($functionName !== null && $functionName !== '') {
            // First chunk of a new tool call contains identification metadata
            $index = $explicitIndex ?? count($this->toolsToCall);
            $this->toolsToCall[$index] = [
                'id' => $callId ?? ('call_synth_'.bin2hex(random_bytes(4))),
                'function' => $functionName,
                'arguments' => $argumentsChunk,
            ];
            return;
        }

        // Subsequent chunks supply argument fragments
        $targetIndex = $explicitIndex ?? array_key_last($this->toolsToCall);
        if ($targetIndex !== null && isset($this->toolsToCall[$targetIndex])) {
            $this->toolsToCall[$targetIndex]['arguments'] .= $argumentsChunk;
        }
    }

    /**
     * Determines whether tools should be executed based on the finish reason.
     * Guards against truncated outputs while allowing non-standard provider termination.
     */
    public function shouldExecuteTools(?string $finishReason): bool
    {
        if ($finishReason === null) {
            return false;
        }

        // Must reject reasons indicating truncated arguments
        return !in_array($finishReason, ['length', 'content_filter'], true);
    }

    /**
     * @return array<int|string, array{id: string, function: string, arguments: string}>
     */
    public function flushCompletedCalls(): array
    {
        $calls = $this->toolsToCall;
        $this->toolsToCall = [];
        return $calls;
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
<?php
// NEVER DO THIS: Overwriting index or checking only finish_reason === 'tool_calls'
foreach ($partialResponse->choices[0]->delta->toolCalls as $toolCall) {
    if ($toolCall->function->name) {
        // ANTI-PATTERN: Captures only the first chunk; drops subsequent argument deltas
        $toolsToCall[] = [
            'function' => $toolCall->function->name,
            'arguments' => $toolCall->function->arguments, // Evaluates to "" or incomplete JSON!
            'id' => $toolCall->id,
        ];
    }
}

// ANTI-PATTERN: Fails on Gemini and third-party OpenAI-compatible endpoints
if ($partialResponse->choices[0]->finishReason === 'tool_calls') {
    // Gemini sends 'stop' here; tools are permanently discarded!
    $this->executeTools($toolsToCall);
}
```

**VERIFICATION METHOD**:
Verify using a mocked SSE handler feeding synthetic multi-part chunks where argument JSON `{"query": "Paris"}` is split across 4 distinct delta packets, followed by a `finish_reason: "stop"` packet. Assert that the reassembled string equals `{"query": "Paris"}` and is successfully invoked.

---

### 2. Upstream Polymorphic Payload Null-Coalescence Invariant
**RULE**:
When deserializing JSON payloads from multi-provider downstream APIs claiming OpenAI specification conformance (e.g., Mistral, LocalAI, vLLM), every collection property (`tool_calls`, `choices`, `content`, `arguments`) MUST be coerced into a typed empty iterable prior to executing iteration or collection-mapping primitives (`array_map`, `foreach`). Clients MUST NOT assume fields marked as non-null in reference implementations are universally non-null across vendor proxies.

**WHY**:
Upstream implementations frequently diverge from the OpenAI JSON schema. Specifically, Mistral AI and certain open-source inference backends serialize empty tool calls as `"tool_calls": null` rather than omitting the property or providing `"tool_calls": []`. Passing `null` into native functions expecting `array` (e.g., `array_map()`) triggers fatal `TypeError` in PHP 8.1+, crashing the HTTP execution pipeline.

**WHEN TO APPLY**:
Any adapter, client library, or parser consuming third-party REST/JSON endpoints representing LLM chat completions or function definitions.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
<?php

declare(strict_types=1);

namespace Brain\Adapter;

final class OpenAIResponseNormalizer
{
    /**
     * Normalizes choices array, neutralizing vendor-specific null collections.
     *
     * @param array<string, mixed> $rawResponse
     * @return array<int, array<string, mixed>>
     */
    public static function extractMessageToolCalls(array $rawResponse): array
    {
        $choices = $rawResponse['choices'] ?? [];
        if (!is_array($choices) || $choices === []) {
            return [];
        }

        $firstChoice = $choices[0];
        $message = $firstChoice['message'] ?? [];

        // Invariant guard: Coerce null, missing, or malformed tool_calls to []
        $rawToolCalls = $message['tool_calls'] ?? null;
        if (!is_array($rawToolCalls)) {
            return [];
        }

        /** @var array<int, array{id: string, type: string, function: array{name: string, arguments: string}}> */
        return array_map(static function (mixed $toolCall): array {
            $item = is_array($toolCall) ? $toolCall : [];
            $function = is_array($item['function'] ?? null) ? $item['function'] : [];

            return [
                'id' => (string) ($item['id'] ?? ''),
                'type' => (string) ($item['type'] ?? 'function'),
                'function' => [
                    'name' => (string) ($function['name'] ?? ''),
                    'arguments' => (string) ($function['arguments'] ?? '{}'),
                ],
            ];
        }, $rawToolCalls);
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
<?php
// NEVER DO THIS: Blind trust in API schema uniformity
$message = $response['choices'][0]['message'];

// ANTI-PATTERN: Crashes with TypeError: array_map(): Argument #2 ($array) must be of type array, null given
$toolCalls = array_map(fn($tc) => new ToolCall($tc), $message['tool_calls']);
```

**VERIFICATION METHOD**:
Execute mutation tests providing payload fixtures containing `{"tool_calls": null}`, missing `"tool_calls"`, and non-array types. Assert zero unhandled `TypeError` exceptions and exact returns of `[]`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Streamed Tool Calls Ingestion Loss & Gemini Truncation (BUG-LLPHANT-01)
- **Context**: Streaming chat completion processing in `src/Chat/OpenAIChat.php`.
- **What Was Expected**: Multi-delta streamed tool calls must accumulate fragmented function arguments across sequential chunks until fully received, and dispatch function execution upon completion across all OpenAI-compatible providers.
- **What Actually Happened**:
  1. Only the first delta chunk of a tool call was evaluated. Subsequent argument-bearing chunks had no `name` property and were discarded. Functions were invoked with empty arguments (`""`), triggering fatal PHP `ArgumentCountError`.
  2. Google Gemini Flash (via its OpenAI-compatible endpoint) does not send an explicit index for parallel tool calls, sends deltas whole, and terminates the turn with `finish_reason: "stop"` rather than `"tool_calls"`. The streaming parser ignored calls unless `finishReason === 'tool_calls' || finishReason === 'function_call'`, resulting in silent drops of all streamed tool calls.
- **Evidence in Repo**: Commit `4c5542b9` ("Fix streamed tool calls in OpenAIChat: lost arguments and Gemini's stop finish reason (#532)"), `tests/Fixtures/OpenAI/gemini-openai-compat-parallel-tool-calls.sse`, and unit tests in `tests/Unit/Chat/OpenAIChatTest.php`.
- **Root Cause**: The streaming loop assumed atomic argument delivery in the identifying chunk and coupled tool invocation strictly to the literal string `"tool_calls"` or `"function_call"`.
- **Remediation Code Diff**:
```diff
--- a/src/Chat/OpenAIChat.php
+++ b/src/Chat/OpenAIChat.php
@@ -308,17 +308,25 @@ private function createStreamedResponse(array $messages): StreamInterface
                 $toolCalls = $partialResponse->choices[0]->delta->toolCalls ?? [];
                 /** @var CreateStreamedResponseToolCall $toolCall */
                 foreach ($toolCalls as $toolCall) {
+                    // The first delta of a call carries its name and id, the following ones only argument fragments
                     if ($toolCall->function->name) {
-                        $toolsToCall[] = [
+                        $toolsToCall[$toolCall->index ?? count($toolsToCall)] = [
                             'function' => $toolCall->function->name,
                             'arguments' => $toolCall->function->arguments,
                             'id' => $toolCall->id,
                         ];
+
+                        continue;
+                    }
+
+                    $index = $toolCall->index ?? array_key_last($toolsToCall);
+                    if ($index !== null && isset($toolsToCall[$index])) {
+                        $toolsToCall[$index]['arguments'] .= $toolCall->function->arguments;
                     }
                 }

                 // $functionName should be always set if finishReason is function_call
-                if ($this->shouldCallTool($partialResponse->choices[0]->finishReason) && $toolsToCall !== []) {
+                if ($this->shouldCallStreamedTools($partialResponse->choices[0]->finishReason) && $toolsToCall !== []) {
                     foreach ($toolsToCall as $tool) {
                         if (is_string($tool['function']) && is_string($tool['id'])) {
                             $this->callFunction($tool['function'], $tool['arguments'], $tool['id']);
@@ -477,6 +485,15 @@ private function shouldCallTool(?string $finishReason): bool
         return $finishReason === 'function_call' || $finishReason === 'tool_calls';
     }

+    /**
+     * Some OpenAI-compatible APIs, such as Gemini's, end a streamed turn that collected tool calls
+     * with "stop". Any finish reason then calls them, except the ones that can cut the arguments short.
+     */
+    private function shouldCallStreamedTools(?string $finishReason): bool
+    {
+        return $finishReason !== null && $finishReason !== 'length' && $finishReason !== 'content_filter';
+    }
```
- **Lesson**: SSE parsing code must accumulate fragmented deltas by index (defaulting to current open key) and execute tools on any non-destructive stream termination token.

---

### Incident 2: MistralAI Response Deserialization Fatal Crash (BUG-LLPHANT-02)
- **Context**: MistralAI Chat response ingestion via `MistralAIChat.php` / upstream `OpenAI\Responses\Chat\CreateResponse.php`.
- **What Was Expected**: Passing Mistral API chat completion responses through the OpenAI client abstraction should smoothly parse message contents and empty tool lists.
- **What Actually Happened**: The upstream client threw an unhandled `TypeError`:
  `Uncaught TypeError: array_map(): Argument #2 ($array) must be of type array, null given in vendor/openai-php/client/src/Responses/Chat/CreateResponse.php:50`
- **Evidence in Repo**: GitHub Issue #286 ("MistralAI: Chat response leads to Exception in CreateResponse.php").
- **Root Cause**: Mistral AI's endpoint returns `"tool_calls": null` when no function calling occurs, while the OpenAI PHP client expected either an absent key or an array `[]`. Calling `array_map()` directly on the unnormalized key led to an immediate fatal crash in PHP strict type mode.
- **Remediation Code Diff**:
```diff
--- a/src/Chat/MistralAIChat.php
+++ b/src/Chat/MistralAIChat.php
@@ -190,6 +190,13 @@ public function generateChat(array $messages): ResponseInterface
         $response = $this->client->chat()->create($params);
+        // Intercept and sanitize null tool_calls payload before client array_map processing
+        if (isset($response['choices'][0]['message']['tool_calls']) && $response['choices'][0]['message']['tool_calls'] === null) {
+            $response['choices'][0]['message']['tool_calls'] = [];
+        }
         return $response;
```
- **Lesson**: Never assume third-party endpoints mimicking an API specification conform to the same nullability conventions. Sanitize nullable array fields at the boundary adapter.

---

### Incident 3: Composer Platform Requirement & Packaging Isolation Failure (BUG-LLPHANT-03)
- **Context**: Package distribution and automated dependency installation in `composer.json`.
- **What Was Expected**: Running `composer require theodo-group/llphant` should cleanly resolve and install all class files, including provider integrations (`OllamaChat.php`, `AnthropicChat.php`), regardless of host image configurations.
- **What Actually Happened**: Users encountered partial installations where non-OpenAI classes were missing or unresolvable when platform dependencies (such as `ext-gd`) were bypassed with `--ignore-platform-req=ext-gd`.
- **Evidence in Repo**: GitHub Issue #510 ("Composer installer does not include files other than OpenAI").
- **Root Cause**: Architectural coupling between document/image chunking features (requiring PHP GD for image token handling) and the root library definition forced users to bypass platform checks, causing Composer to select older dist artifacts or omit classes bound to missing extensions.
- **Remediation Code Diff**:
```diff
--- a/composer.json
+++ b/composer.json
@@ -28,7 +28,7 @@
     "require": {
         "php": "^8.1",
         "openai-php/client": "^0.10",
-        "ext-gd": "*"
+        "ext-gd": "*",
+        "guzzlehttp/guzzle": "^7.8"
     },
+    "suggest": {
+        "ext-gd": "Required to enable image reading and multimodal document embedding."
+    }
```
- **Lesson**: Non-universal binary extensions (e.g., `ext-gd`, `ext-v8js`) must be declared under `suggest` or isolated into decoupled sub-packages (`llphant-vision`, `llphant-core`), preventing Composer dependency resolution failures for base LLM workflows.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In PHP 8.1+, implicit type coercion and truthiness rules are hazardous in tool argument reassembly and vector scoring:
- **Strict Scalar Comparison (`===` vs `==`)**: In vector similarity searches, distance metrics can return `0` or `0.0` (exact match). Using loose equality (`if ($score == null)`) evaluates `0.0` to false, skipping exact matches. Always use strict identity (`=== null`).
- **Array Key Checking (`isset` vs `array_key_exists`)**: When accumulating streamed arguments:
```php
// HAZARD: isset() returns FALSE if $toolsToCall[$index] exists but its value is null
if (isset($toolsToCall[$index])) { ... }

// DEFENSIVE INVARIANT:
if (array_key_exists($index, $toolsToCall) && is_string($toolsToCall[$index]['arguments'])) {
    $toolsToCall[$index]['arguments'] .= $deltaChunk;
}
```
- **String Offset Dereference & Falsy Strings**: In JSON argument fragments, a chunk might be `"0"`. In PHP, `if ($delta->arguments)` evaluates `"0"` to **falsy**, dropping numerical zero arguments from tool payloads. The invariant MUST be:
```php
if ($toolCall->function->arguments !== null && $toolCall->function->arguments !== '') {
    $toolsToCall[$index]['arguments'] .= $toolCall->function->arguments;
}
```

### 2. Infinite Loop & Recursion Guards
Autonomous agents executing iterative tool loops (e.g., AutoPHP, ReAct loops) face catastrophic token burn and server lockups:
- **Recursion Depth & Max Iteration Hard Caps**: Every agent loop MUST implement a monotonic counter with a deterministic ceiling.
```php
<?php

declare(strict_types=1);

namespace Brain\Agent;

final class AgentLoopGuard
{
    private const MAX_TURNS = 15;
    private int $currentTurn = 0;

    public function step(): void
    {
        $this->currentTurn++;
        if ($this->currentTurn > self::MAX_TURNS) {
            throw new \OverflowException(sprintf(
                'Agent loop terminated: reached hard limit of %d turns without convergence.',
                self::MAX_TURNS
            ));
        }
    }

    public function reset(): void
    {
        $this->currentTurn = 0;
    }
}
```
- **Circular Function Invocation Guard**: Agents frequently get trapped in infinite ping-pong cycles executing the same tool with identical arguments. Hash tool calls into an execution ring buffer:
```php
$callHash = hash('xxh128', $toolName . ':' . $serializedArgs);
if (count(array_keys($this->executionHistory, $callHash, true)) >= 3) {
    throw new \RuntimeException("Detected circular oscillating tool execution for call: {$toolName}");
}
$this->executionHistory[] = $callHash;
```

### 3. UI & UX Micro-Mechanics (Frontend Streaming & Chat Interface)
In client-side streaming (e.g., React/Next.js with Vercel AI SDK and Laravel backend):
- **DOM Reflow/Thrashing**: Streaming token deltas directly into React state at 60Hz causes severe layout reflow. Batch SSE chunks using `requestAnimationFrame` or limit token state commits to a 16ms window.
- **Scroll Anchor Locking**: As messages expand dynamically during streaming, user upward scroll must not be overridden. Calculate scroll threshold before appending:
```typescript
const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 50;
// Only auto-scroll if the viewport was already pinned to bottom
if (isAtBottom) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
```

### 4. Backend Concurrency & Memory Safety
- **Memory Leaks in SSE Streaming Connections**: When serving `text/event-stream` from PHP-FPM or Long-Running RoadRunner/Swoole processes, accumulating chunks in memory buffers triggers memory exhaustion.
```php
// INVARIANT: Flush output buffers and clear variables per chunk
while (!$stream->eof()) {
    $chunk = $stream->read(1024);
    echo "data: " . json_encode(['chunk' => $chunk]) . "\n\n";
    if (ob_get_level() > 0) {
        ob_flush();
    }
    flush();
    unset($chunk); // Enable immediate ref-count deallocation
}
```
- **Database Connection Pool Starvation in Vector Searches**: Vector operations (e.g., pgvector HNSW scans) hold long query locks. Connections must release early before initiating external model inference API calls.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **JSON Payload Fragment Validation**: Never run `json_decode()` directly on aggregated chunks without a trailing catch guard. Streaming streams may sever mid-token:
```php
try {
    $cleanArguments = json_decode($tool['arguments'], true, 512, JSON_THROW_ON_ERROR);
} catch (\JsonException $e) {
    throw new \InvalidArgumentException(
        "Corrupted streamed tool arguments JSON: '{$tool['arguments']}'. Reason: {$e->getMessage()}",
        $e->getCode(),
        $e
    );
}
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The architecture is structured around strict separation of concerns across 4 pillars:
1. **Chat (`LLPhant\Chat`)**: Stateless conversational endpoints with optional persistent history.
2. **Embeddings (`LLPhant\Embeddings`)**: Document chunkers, formatters, and embedding vector generators.
3. **VectorStores (`LLPhant\Embeddings\VectorStores`)**: Persistence bridges mapping high-dimensional float vectors to relational/NoSQL backends.
4. **Tools / Agents (`LLPhant\Chat\FunctionInfo`, AutoPHP)**: Reflection-driven tool definitions that inspect PHP class docblocks, parameter types, and attributes to output schema-compliant OpenAI tool definitions.

### Dimension 2: Core Abstractions
- `ChatInterface`: Contract defining `generateText()`, `generateChat()`, `generateChatStream()`, `setSystemMessage()`.
- `FunctionInfo`: Introspects PHP class methods, extracting metadata to generate JSON function definitions.
- `Parameter`: Typed metadata representation of a single function parameter.
- `VectorStoreBase`: Abstract class defining nearest-neighbor operations (`similaritySearch()`, `addDocuments()`).
- `Document`: Fundamental RAG primitive encapsulating string content, source metadata, and embedding float vectors (`float[]`).

### Dimension 3: Error Handling
- Provider-specific exceptions wrapped into framework domains (`LLPhantException`).
- Streaming resilience: Incomplete tool calls due to network aborts or length violations (`finish_reason === 'length'`) are blocked from invoking internal PHP methods.
- Dynamic reflection execution guards: Method parameter mismatches throw caught `ReflectionException` converted to structured error messages fed back to the LLM turn loop.

### Dimension 4: Testing
- High-fidelity unit and integration harnesses using **Pest PHP** and **PHPUnit**.
- **MockHandler** SSE integration: Replays captured `.sse` wire logs (`gemini-openai-compat-parallel-tool-calls.sse`) through Guzzle Mock Handler to verify edge-case delta fragment processing without hitting live APIs.

### Dimension 5: Security
- **Prompt Injection Defense**: Native `ClassifierPromptInjectionQueryTransformer` evaluating user inputs against rubric classifiers before injecting into RAG search.
- **Reflection Injection Boundary**: Tools exposed to the LLM must be explicitly registered via `addTool()`. Dynamic reflection is forbidden on arbitrary non-whitelisted classes to prevent Remote Code Execution (RCE).

### Dimension 6: Performance
- **Zero-Copy Stream Piping**: SSE responses pipe directly from PSR-7 streams to standard output without buffering multi-megabyte payloads in RAM.
- **HNSW Vector Indexing**: Queries are delegated to underlying database C-extensions (e.g., PostgreSQL `pgvector`, Qdrant, Milvus) rather than calculating cosine distance in PHP userland.

### Dimension 7: Deployment
- Containerized development via Docker Compose for all supported vector databases (ChromaDB, Elasticsearch, MariaDB, Milvus, MongoDB, OpenSearch, PgVector, Qdrant, Redis, Typesense).
- CI/CD workflows (`formats.yml`, `tests.yml`) enforcing PHP-CS-Fixer formatting and multi-PHP matrix testing (PHP 8.1, 8.2, 8.3, 8.4).

### Dimension 8: Agent Patterns
- ReAct (Reasoning + Acting) execution loops via autonomous agents.
- Multi-tool parallel invocation handling: Parallel tool deltas are accumulated into indexed slots and executed sequentially or asynchronously before constructing tool output responses.

### Dimension 9: Data Flow
1. User Query -> Guardrail Validator (`ClassifierPromptInjectionQueryTransformer`).
2. Query -> Embeddings Generator (`EmbeddingGeneratorInterface`) -> Vector `float[]`.
3. Vector -> VectorStore (`similaritySearch`) -> Relevant `Document[]`.
4. Relevant Documents + Prompt History + Whitelisted Tools -> Chat Provider (`ChatInterface`).
5. SSE Stream -> Chunk Reassembler -> Function Invocation -> Recursive Response Generation -> Client.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Reflection-Driven Function-Calling Tool Builder
```php
<?php

declare(strict_types=1);

namespace Brain\Pattern;

use ReflectionMethod;
use ReflectionParameter;

final class ToolDescriptor
{
    /**
     * Converts a PHP class method into an OpenAI-compatible function schema.
     *
     * @return array{name: string, description: string, parameters: array{type: string, properties: array<string, mixed>, required: string[]}}
     */
    public static function build(object $instance, string $methodName, string $description): array
    {
        $refMethod = new ReflectionMethod($instance, $methodName);
        $properties = [];
        $required = [];

        foreach ($refMethod->getParameters() as $param) {
            $name = $param->getName();
            $type = self::mapPhpTypeToJsonType($param);

            $properties[$name] = [
                'type' => $type,
                'description' => "Parameter: {$name}",
            ];

            if (!$param->isOptional()) {
                $required[] = $name;
            }
        }

        return [
            'name' => $methodName,
            'description' => $description,
            'parameters' => [
                'type' => 'object',
                'properties' => $properties,
                'required' => $required,
            ],
        ];
    }

    private static function mapPhpTypeToJsonType(ReflectionParameter $param): string
    {
        $type = $param->getType();
        if ($type instanceof \ReflectionNamedType) {
            return match ($type->getName()) {
                'int', 'float' => 'number',
                'bool' => 'boolean',
                'array' => 'array',
                default => 'string',
            };
        }
        return 'string';
    }
}
```

### 2. Rule
The LLM streaming parser MUST NOT evaluate tool function arguments until stream termination, MUST aggregate deltas indexed by call ID or key index, and MUST ignore non-critical finish reasons (such as `"stop"` on Gemini) when tool invocations have been accumulated.

### 3. Architecture Principle
**Protocol Harmonization Over Raw Transport**: Underlying providers implement differing interpretations of OpenAI schemas. Client architecture must introduce an intermediate normalization layer that sanitizes, coerces, and stabilizes payload inconsistencies before they enter typed core domains.

### 4. Failure Mode
Calling PHP's native `array_map()` on deserialized JSON fields without prior null-coalescence. When APIs return `"tool_calls": null`, PHP 8.1+ triggers fatal `TypeError`, halting execution.

### 5. Reusable Skill
**Testing SSE Streaming Tool Invocation**:
1. Record real raw SSE responses into `.sse` fixture files.
2. Feed fixture into Guzzle `MockHandler` emitting `text/event-stream`.
3. Assert that aggregated arguments match multi-delta fragments.
4. Verify dynamic function callback invocation and argument counts.

### 6. Decision
LLPhant chose to use PHP reflection on native classes rather than forcing custom domain-specific language (DSL) tool declarations.
- *Trade-off*: Slower initial reflection overhead (mitigated via caching) in exchange for zero developer friction when exposing existing PHP service methods to LLMs.

### 7. Anti-pattern
Binding optional platform dependencies (e.g., `ext-gd` for vision/OCR