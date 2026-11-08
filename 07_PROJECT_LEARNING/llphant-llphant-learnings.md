> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/llphant-llphant-learnings.md`  
> **Source**: github ([https://github.com/LLPhant/LLPhant](https://github.com/LLPhant/LLPhant))  
> **Source Version**: `1992a18d`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T12:35:07.043Z  
> **Learning ID**: `learn-github-llphant-llphant`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): LLPhant/LLPhant

---

## 1. Executive Forensic Architecture & System Mechanics

LLPhant is a comprehensive Generative AI, Agentic orchestration, and Vector Database framework native to the PHP 8.1+ runtime. It solves the impedance mismatch between synchronous, shared-nothing PHP request-lifecycle architectures (e.g., PHP-FPM, Laravel, Symfony) and stateful, streaming, asynchronous LLM operations (token-by-token HTTP streaming, multi-turn tool calling loops, vector ingestion, and embedding pipelines).

```
                      +-------------------------------------------------+
                      |              Application Boundary               |
                      |          (Laravel / Symfony / Next.js)          |
                      +-------------------------------------------------+
                                               |
                                               v
+---------------------------------------------------------------------------------------------------+
| LLPhant Orchestration Engine                                                                      |
|                                                                                                   |
|  +--------------------+   +-----------------------+   +-------------------+   +----------------+  |
|  |   Config Layer     |   |   Chat / LLM Client   |   | Function Calling  |   | RAG / Vector   |  |
|  | - OpenAIConfig     |   | - OpenAIChat          |   | - FunctionInfo    |   | - VectorStore  |  |
|  | - OllamaConfig     |-->| - OllamaChat          |<->| - ToolMessage     |<->| - Embeddings   |  |
|  | - GeminiOpenAIConf |   | - MistralAIChat       |   | - ParameterParser |   | - PGVector     |  |
|  | - MistralAIConfig  |   | - AnthropicChat       |   | - Return Normaliz.|   | - Qdrant/Redis |  |
|  +--------------------+   +-----------------------+   +-------------------+   +----------------+  |
|            |                          |                         |                      |          |
+------------|--------------------------|-------------------------|----------------------|----------+
             v                          v                         v                      v
    +-----------------+        +------------------+      +------------------+   +-----------------+
    | Environment /   |        | Network Transp.  |      | Tool Execution   |   | Vector Engines  |
    | Credential Gate |        | PSR-7 / Guzzle / |      | Reflection Inv.  |   | pgvector /      |
    | (Env Isolation) |        | OpenAI Client    |      | Type Cast / JSON |   | Chroma / Redis  |
    +-----------------+        +------------------+      +------------------+   +-----------------+
```

### Core Subsystems & Boundary Invariants

1. **Provider Configuration & Credential Isolation Layer (`LLPhant\Config`)**:
   - Manages API keys, target endpoints, model identifiers, and HTTP client handlers.
   - *Forensic Invariant*: Subclass configs inherit from base transport configs (e.g., `GeminiOpenAIConfig` and `MistralAIConfig` extending `OpenAIConfig`). The boundary must prevent credential leakage where child providers accidentally inherit parent default environment variables (e.g., sending an `OPENAI_API_KEY` to Google's or Mistral's endpoints).

2. **Chat & Stream Protocol Translation Layer (`LLPhant\Chat`)**:
   - Provides unified abstractions (`ChatInterface`, `OpenAIChat`, `OllamaChat`) covering standard generation (`generateText`, `generateChat`) and chunked reactive consumption (`generateStreamOfText`, `generateChatStream`).
   - Translates internal normalized conversation states (`Message::user()`, `Message::system()`, `Message::toolResult()`) into wire-level provider schemas (OpenAI JSON payloads, Ollama NDJSON streams, Mistral REST responses).
   - *Forensic Invariant*: Every chat variant (text-only, chat-based, streaming, non-streaming) must preserve parity over system prompt injection and structured schema formatting (such as `format: 'json'`).

3. **Tool/Function Calling Reflection Engine (`LLPhant\Chat\CalledFunction`)**:
   - Uses PHP 8 Reflection to introspect arbitrary classes, extract docblock descriptions and type hints, construct JSON-Schema function signatures for model prompts, and dispatch recursive tool calls.
   - Handles multi-turn agent execution loops where the LLM requests a tool call, the local engine invokes the callable, and the serializable output is injected back into the message array for the next LLM turn.

4. **Vector Database & Retrieval-Augmented Generation (`LLPhant\Embeddings\VectorStores`)**:
   - Integrates vector databases (`pgvector`, `MariaDB`, `Milvus`, `Qdrant`, `Redis`, `Typesense`, `ChromaDB`) with embedding generators (`OpenAI`, `Mistral`, `Ollama`).
   - Enforces a unified interface for embedding calculation, distance metrics (cosine, inner product, Euclidean), and hybrid metadata filtering.

---

## 2. Net-New Universal Engineering Rules

### 1. Child Provider Environment Variable Insulation Invariant
**RULE**:
When an adapter config inherits from an upstream base client config that defaults to a global credential environment variable, the child config MUST explicitly override the fallback with an empty string or dedicated exception guard. It MUST NOT allow an upstream provider credential (e.g., `OPENAI_API_KEY`) to be sent to a downstream third-party provider (e.g., Mistral or Google Gemini).

**WHY**:
Inheritance hierarchies in SDK configuration classes produce silent credential leaks. If `MistralAIConfig extends OpenAIConfig` and `OpenAIConfig` falls back to `getenv('OPENAI_API_KEY')`, omitting `MISTRAL_API_KEY` causes the runtime to transmit the user's OpenAI secret key in the `Authorization: Bearer` header directly to Mistral's API endpoints. This triggers invalid key errors, API key leakage, and potential security revocation across foreign networks.

**WHEN TO APPLY**:
Apply in any multi-provider SDK, proxy architecture, or polymorphic client wrapper where specialized configurations inherit from a default base transport configuration.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
<?php

declare(strict_types=1);

namespace LLPhant;

use LLPhant\Exception\MissingParameterException;
use LLPhant\Utility;

abstract class BaseTransportConfig
{
    public function __construct(
        public string $apiKey = '',
        public string $url = '',
    ) {
        $this->apiKey = $apiKey !== '' ? $apiKey : (Utility::readEnvironment('BASE_API_KEY') ?? '');
    }
}

final class SpecializedProviderConfig extends BaseTransportConfig
{
    public function __construct(
        ?string $apiKey = null,
        string $url = 'https://api.specialized.com/v1',
    ) {
        // Explicitly isolate: coalesce null into child-specific env var,
        // and coalesce that into '' to PREVENT falling back to BASE_API_KEY.
        $resolvedKey = $apiKey ?? Utility::readEnvironment('SPECIALIZED_API_KEY') ?? '';

        parent::__construct(
            apiKey: $resolvedKey,
            url: $url,
        );
    }
}

final class SpecializedClient
{
    public function __construct(SpecializedProviderConfig $config)
    {
        if ($config->apiKey === '') {
            throw new MissingParameterException(
                'You must provide a SPECIALIZED_API_KEY environment variable or constructor parameter.'
            );
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
<?php

declare(strict_types=1);

// ANTI-PATTERN: Passing null allows parent constructor to resolve its own default!
final class DangerousProviderConfig extends BaseTransportConfig
{
    public function __construct(?string $apiKey = null, string $url = 'https://api.specialized.com/v1')
    {
        // BUG: If SPECIALIZED_API_KEY is not set, null is passed to parent,
        // which triggers Utility::readEnvironment('BASE_API_KEY')!
        parent::__construct(
            apiKey: $apiKey ?? Utility::readEnvironment('SPECIALIZED_API_KEY'),
            url: $url
        );
    }
}
```

**VERIFICATION METHOD**:
Automated isolation test executing within a clean environment runner:
```php
it('ensures child provider does not inherit upstream OPENAI_API_KEY', function () {
    putenv('OPENAI_API_KEY=sk-test-secret-openai');
    putenv('MISTRAL_API_KEY'); // Unset

    $config = new MistralAIConfig();
    expect($config->apiKey)->toBe('')
        ->and(fn () => new MistralAIChat($config))
        ->toThrow(MissingParameterException::class, 'MISTRAL_API_KEY');
});
```

---

### 2. Dual-Channel Protocol Feature Parity Invariant (Streaming vs. Non-Streaming)
**RULE**:
When an LLM client exposes dual consumption modes (synchronous request-response vs. streamed chunking), ALL request modifications, system prompts, hyper-parameters, and schema enforcement flags (e.g., `format: 'json'`, `systemMessage`, temperature, top_p) MUST be identically evaluated and injected into both request builders.

**WHY**:
Non-streaming endpoints and streaming endpoints frequently call distinct HTTP routes (e.g., Ollama's `/api/generate` vs `/api/chat`, or SSE parameters). When developers add feature flags like `format: 'json'` or `$systemMessage`, updating only the synchronous method causes streaming calls to silently fail schema contracts, emit unformatted text, or drop behavioral system prompts.

**WHEN TO APPLY**:
Every LLM wrapper, HTTP client, or protocol proxy providing both blocking and streaming interfaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
<?php

declare(strict_types=1);

namespace LLPhant\Chat;

use Psr\Http\Message\StreamInterface;

trait OllamaPayloadTrait
{
    /**
     * @param array<string, mixed> $additional
     * @return array<string, mixed>
     */
    protected function buildOllamaPayload(
        string $prompt,
        bool $stream,
        array $additional = []
    ): array {
        $payload = array_merge([
            'model' => $this->config->model,
            'prompt' => $prompt,
            'stream' => $stream,
        ], $additional);

        if (isset($this->systemMessage?->content)) {
            $payload['system'] = $this->systemMessage->content;
        }

        if ($this->config->formatJson) {
            $payload['format'] = 'json';
        }

        return $payload;
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
<?php

declare(strict_types=1);

// ANTI-PATTERN: Divergent payload assemblies between sync and async routes
public function generateText(string $prompt): string
{
    $params = ['prompt' => $prompt, 'stream' => false];
    if (isset($this->systemMessage)) { $params['system'] = $this->systemMessage->content; }
    if ($this->formatJson) { $params['format'] = 'json'; }
    return $this->post('generate', $params);
}

public function generateStreamOfText(string $prompt): StreamInterface
{
    // FORGOTTEN: systemMessage and formatJson are omitted in streaming!
    return $this->post('generate', [
        'prompt' => $prompt,
        'stream' => true,
    ]);
}
```

**VERIFICATION METHOD**:
Contract test verifying identical outgoing JSON payloads regardless of streaming flag:
```php
it('guarantees streaming payload contains identical flags to non-streaming payload', function () {
    $chat = new OllamaChat($configWithJson);
    $chat->setSystemMessage('System Instruction');

    $syncPayload = $chat->exportPayloadForTesting('prompt', false);
    $streamPayload = $chat->exportPayloadForTesting('prompt', true);

    unset($syncPayload['stream'], $streamPayload['stream']);
    expect($streamPayload)->toEqual($syncPayload);
});
```

---

### 3. Agent Tool Call Polymorphic Result Normalization Invariant
**RULE**:
Agent execution loops MUST accept arbitrary primitive or complex return types (`string`, `int`, `float`, `bool`, `array`, `\JsonSerializable`, `object`) from executed functions and normalize them via a deterministic JSON serialization boundary before appending them to the conversation history. An agent loop MUST NOT silently drop or ignore tool responses that are not native strings.

**WHY**:
If the tool dispatcher strictly requires `is_string($toolResult)` to emit a `role: tool` message back to the LLM, any tool returning a structured dictionary (`['temperature' => 20]`) or an integer (`42`) results in zero tool output messages appended to the context. The model receives an empty conversation history following its tool call request, causing it to abort, hallucinate missing data, or enter an infinite loop trying to recall the tool.

**WHEN TO APPLY**:
Autonomous agent loops, reflection-based tool invocation harnesses, and function-calling routers across all ecosystems.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
<?php

declare(strict_types=1);

namespace LLPhant\Chat\Enums;

use JsonSerializable;

final class Message
{
    public string $role;
    public string $content;

    public static function toolResult(mixed $result): self
    {
        $message = new self();
        $message->role = 'tool';

        if (is_string($result)) {
            $message->content = $result;
        } elseif (is_scalar($result) || $result === null) {
            $message->content = (string) $result;
        } elseif ($result instanceof JsonSerializable || is_array($result)) {
            $message->content = json_encode($result, JSON_THROW_ON_ERROR);
        } else {
            $message->content = json_encode(get_object_vars($result), JSON_THROW_ON_ERROR);
        }

        return $message;
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
<?php

declare(strict_types=1);

// ANTI-PATTERN: Dropping tool execution outputs if they are not strings!
foreach ($message['tool_calls'] as $toolCall) {
    $toolResult = $this->callFunction($toolCall['function']['name'], $toolCall['function']['arguments']);
    if (is_string($toolResult)) { // FATAL: Arrays and numbers silently disappear!
        $toolsOutput[] = Message::toolResult($toolResult);
    }
}
```

**VERIFICATION METHOD**:
Mock agent test confirming array and scalar outputs are serialized and present in payload messages:
```php
it('serializes non-string tool outputs into JSON tool messages', function () {
    $toolMessage = Message::toolResult(['status' => 'success', 'code' => 200]);
    expect($toolMessage->role)->toBe('tool')
        ->and($toolMessage->content)->toBe('{"status":"success","code":200}');

    $intMessage = Message::toolResult(42);
    expect($intMessage->content)->toBe('42');
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Ollama Streaming Missing System Prompt & JSON Formatting (BUG-OLLAMA-STREAM-01)
- **Context**: `src/Chat/OllamaChat.php` within streaming methods `generateStreamOfText()` and `generateChatStream()`.
- **What Was Expected**: When users configured `$config->formatJson = true` or invoked `$chat->setSystemMessage('You are a pirate')`, all streaming calls should pass `'system'` and `'format' => 'json'` in the Ollama POST payload.
- **What Actually Happened**: Non-streaming calls honored these configurations, but streaming calls (`generateStreamOfText` and `generateChatStream`) omitted both parameters entirely. Ollama streamed back unformatted plain text and omitted the system persona.
- **Evidence in Repo**: Commit `1992a18d`, tests in `tests/Unit/Chat/OllamaChatTest.php`.
- **Root Cause**: The streaming methods maintained duplicate, hand-crafted payload parameter arrays rather than utilizing a shared payload builder or passing all state properties into the request parameters.
- **Remediation Code Diff**:
```php
--- a/src/Chat/OllamaChat.php
+++ b/src/Chat/OllamaChat.php
@@ -133,6 +133,15 @@ public function generateStreamOfText(string $prompt): StreamInterface
              'prompt' => $prompt,
              'stream' => true,
          ];
+
+        if (isset($this->systemMessage->content)) {
+            $params['system'] = $this->systemMessage->content;
+        }
+
+        if ($this->formatJson) {
+            $params['format'] = 'json';
+        }
+
          $response = $this->sendRequest(
              'POST',
              'generate',
@@ -215,6 +224,11 @@ public function generateChatStream(array $messages): StreamInterface
              'messages' => $this->prepareMessages($messages),
              'stream' => true,
          ];
+
+        if ($this->formatJson) {
+            $params['format'] = 'json';
+        }
+
          $response = $this->sendRequest(
              'POST',
              'chat',
```
- **Lesson**: Synchronous and streaming request paths must share identical request construction logic to prevent parameter divergence.

---

### Incident 2: Mistral & Gemini Leaking OPENAI_API_KEY Due to Default Fallbacks (BUG-AUTH-LEAK-02)
- **Context**: Configuration constructors in `src/GeminiOpenAIConfig.php`, `src/MistralAIConfig.php`, and validation gates in `src/Chat/GeminiAIChat.php` / `src/Chat/MistralAIChat.php`.
- **What Was Expected**: If an application configured an `OPENAI_API_KEY` in the environment, but created a `GeminiAIChat` or `MistralAIChat` instance without setting `GEMINI_API_KEY` or `MISTRAL_API_KEY`, the library should throw a `MissingParameterException` stating that the provider key is missing.
- **What Actually Happened**: Because `GeminiOpenAIConfig` and `MistralAIConfig` extend `OpenAIConfig`, passing `null` for `apiKey` triggered `parent::__construct()`, which read `OPENAI_API_KEY`. As a result, the user's OpenAI API key was transmitted in the authorization headers to Mistral and Google endpoints, leading to rejected requests or foreign key disclosure.
- **Evidence in Repo**: Commit `5f61659a`, new test harness `tests/Unit/Chat/ApiKeyEnvironmentTest.php`.
- **Root Cause**: The constructor used `$apiKey ?? Utility::readEnvironment('MISTRAL_API_KEY')`. When both `$apiKey` and the environment variable were null, the result was `null`. Passing `null` to `OpenAIConfig` caused it to execute `$this->apiKey = $apiKey ?? Utility::readEnvironment('OPENAI_API_KEY')`.
- **Remediation Code Diff**:
```php
--- a/src/MistralAIConfig.php
+++ b/src/MistralAIConfig.php
@@ -22,7 +22,9 @@ public function __construct(
          array $modelOptions = [],
      ) {
          parent::__construct(
-            apiKey: $apiKey ?? Utility::readEnvironment('MISTRAL_API_KEY'),
+            // An empty key stops OpenAIConfig from falling back to OPENAI_API_KEY,
+            // so an OpenAI key is never sent to Mistral.
+            apiKey: $apiKey ?? Utility::readEnvironment('MISTRAL_API_KEY') ?? '',
              url: $url,
              model: $model ?? 'mistral-small-latest',
              client: $client,

--- a/src/GeminiOpenAIConfig.php
+++ b/src/GeminiOpenAIConfig.php
@@ -7,7 +7,9 @@ class GeminiOpenAIConfig extends OpenAIConfig
      public function __construct(?string $apiKey = null, string $url = 'https://generativelanguage.googleapis.com/v1beta/openai')
      {
          parent::__construct(
-            $apiKey ?? Utility::readEnvironment('GEMINI_API_KEY'),
+            // An empty key stops OpenAIConfig from falling back to OPENAI_API_KEY,
+            // so an OpenAI key is never sent to Gemini.
+            $apiKey ?? Utility::readEnvironment('GEMINI_API_KEY') ?? '',
              $url
          );
      }
```
- **Lesson**: Never permit a derived configuration to pass null to a base constructor if that base class implements fallback logic for a different domain or vendor.

---

### Incident 3: Ollama Agent Silent Loop Abort on Non-String Tool Output (BUG-TOOL-SERIAL-03)
- **Context**: `src/Chat/OllamaChat.php` method `generateChatRecursive()`.
- **What Was Expected**: When a model called a tool that returned an integer, boolean, or associative array (e.g., `['temperature' => 20]`), the agent should serialize the output, append the tool message to history, and continue recursive execution until the final response was generated.
- **What Actually Happened**: The code evaluated `if (is_string($toolResult))` before wrapping the result in a tool message. Non-string results were silently ignored; `$toolsOutput` remained empty. The recursion ended prematurely, returning an empty string to the caller.
- **Evidence in Repo**: Commit `e62c4189`, unit test in `tests/Unit/Chat/OllamaChatTest.php`.
- **Root Cause**: Premature type guarding in the caller instead of delegating serialization to the value object (`Message::toolResult($toolResult)`).
- **Remediation Code Diff**:
```php
--- a/src/Chat/OllamaChat.php
+++ b/src/Chat/OllamaChat.php
@@ -192,9 +192,7 @@ private function generateChatRecursive(array $messages): string
              foreach ($message['tool_calls'] as $toolCall) {
                  $functionName = $toolCall['function']['name'];
                  $toolResult = $this->callFunction($functionName, $toolCall['function']['arguments']);
-                if (is_string($toolResult)) {
-                    $toolsOutput[] = Message::toolResult($toolResult);
-                }
+                $toolsOutput[] = Message::toolResult($toolResult);
              }
          }
```
- **Lesson**: Do not filter tool execution results using rigid type predicates at the invocation boundary. Enforce structural coercion or serialization at the payload creation boundary.

---

### Incident 4: Mistral Response Parsing TypeError in CreateResponse (BUG-MISTRAL-COMPAT-04)
- **Context**: Interoperability between `MistralAIChat` and `openai-php/client` (`OpenAI\Responses\Chat\CreateResponse::from()`).
- **What Was Expected**: `MistralAIChat` running over the OpenAI PHP client should handle Mistral's chat completion responses without runtime exceptions.
- **What Actually Happened**: An uncaught `TypeError` was thrown:
  ```
  Uncaught TypeError: array_map(): Argument #2 ($array) must be of type array, null given 
  in .../vendor/openai-php/client/src/Responses/Chat/CreateResponse.php:50
  ```
- **Evidence in Repo**: Issue #286 (`MistralAI: Chat response leads to Exception in CreateResponse.php`).
- **Root Cause**: Upstream Mistral API omitted specific fields or returned `null` for properties (e.g., `tool_calls`, `logprobs`, or `usage` breakdown fields) that the strict OpenAI response hydration DTO expected to be non-null arrays.
- **Remediation Code Diff**:
```php
// In the intermediate adapter layer:
// Normalize missing or null collections from Mistral API before delegating to OpenAI DTO parser:
$rawResponse = $response->toArray();
if (!isset($rawResponse['choices']) || !is_array($rawResponse['choices'])) {
    throw new InvalidResponseException('Malformed choices payload in Mistral response');
}
foreach ($rawResponse['choices'] as &$choice) {
    if (array_key_exists('message', $choice) && is_array($choice['message'])) {
        $choice['message']['tool_calls'] ??= [];
    }
}
```
- **Lesson**: Third-party APIs offering "OpenAI-compatible" endpoints rarely match 100% of OpenAI's response shape. Never pass raw third-party payloads directly into strict DTO hydrators without schema sanitization.

---

### Incident 5: Platform Requirement Failure in Composer Packaging (BUG-COMPOSER-PACK-05)
- **Context**: `composer.json` platform requirements (`ext-gd`) causing partial package installation or dependency failures.
- **What Was Expected**: Users installing `composer require theodo-group/llphant` should receive all provider adapters (`OllamaChat`, `AnthropicChat`, etc.) out of the box.
- **What Actually Happened**: Users on Ubuntu/Debian minimal containers without `ext-gd` encountered installation halts or utilized `--ignore-platform-req=ext-gd`, leading to unexpected composer resolution states and missing optional packages (Issue #510).
- **Evidence in Repo**: Issue #510, README instruction: `composer require theodo-group/llphant --ignore-platform-req=ext-gd`.
- **Root Cause**: Hard dependency on image manipulation extensions (`ext-gd`) required only by multi-modal vision submodules, which blocked server-side headless CLI and daemon installations.
- **Remediation Invariant**: Heavy extensions (such as `ext-gd` or `ext-v8js`) must be moved to `suggest` in `composer.json`, with runtime capability guards (`extension_loaded('gd')`) applied only within vision-processing classes.
- **Lesson**: Platform requirements in monolithic AI libraries must be minimal; optional capabilities must use runtime feature detection to keep headless deployments frictionless.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Comparison Hazards**: In PHP 8.1+, loose comparisons (`==`) between strings and numbers have been adjusted, but empty strings and null values still produce critical logic bypasses:
  ```php
  // VULNERABLE: '' == 0 is FALSE in PHP 8, but '' == null is TRUE.
  // In API key checks:
  if ($config->apiKey == null) // Matches null and ''
  
  // SAFE INVARIANT: Strict identity checks and empty string guarding
  if ($config->apiKey === null || trim($config->apiKey) === '') {
      throw new MissingParameterException('API Key cannot be blank.');
  }
  ```
- **Falsy Coercion Trap in LLM Parameters**:
  Temperature, top_p, and seed can legitimately be `0` or `0.0`.
  ```php
  // FATAL BUG: If temperature is 0 (deterministic), empty() or || drops it!
  $params['temperature'] = !empty($this->temperature) ? $this->temperature : 1.0; // Overrides 0 to 1.0!

  // STRICT INVARIANT:
  if ($this->temperature !== null) {
      $params['temperature'] = $this->temperature;
  }
  ```
- **Deep Immutability vs Shallow Array Copy**:
  When managing conversation message histories, assigning `$messagesCopy = $this->messages` produces a shallow copy of an array of objects. Modifying a message object inside `$messagesCopy` mutates the canonical history:
  ```php
  // DANGEROUS:
  $messages = $this->history;
  $messages[0]->content = 'Modified'; // Mutates $this->history[0]!

  // SAFE INVARIANT: Deep clone when mutating message content for context windows
  $isolatedMessages = array_map(fn (Message $m) => clone $m, $this->history);
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Agent Recursion Cap**: Autonomous tool invocation loops (`generateChatRecursive`) will loop infinitely if the model generates repetitive or failing tool calls.
  ```php
  private int $currentRecursion = 0;
  private const MAX_RECURSION_DEPTH = 10;

  private function generateChatRecursive(array $messages): string
  {
      if ($this->currentRecursion >= self::MAX_RECURSION_DEPTH) {
          throw new AgentRecursionLimitExceededException(
              sprintf('Agent exceeded maximum recursion depth of %d turns.', self::MAX_RECURSION_DEPTH)
          );
      }

      $this->currentRecursion++;
      try {
          // Invoke model, dispatch tools...
      } finally {
          // Guaranteed cleanup in unwind
          $this->currentRecursion--;
      }
  }
  ```
- **Duplicate Tool Call Cycle Detection**: Agents frequently get trapped invoking `get_weather(['location' => 'Paris'])` repeatedly when the output fails to satisfy their prompt.
  ```php
  // INVARIANT: Cycle detection via call signatures
  $callSignature = md5($functionName . serialize($arguments));
  if (isset($this->executedSignatures[$callSignature])) {
      $this->executedSignatures[$callSignature]++;
      if ($this->executedSignatures[$callSignature] > 3) {
          throw new ToolLoopException("Detected repetitive tool call cycle for {$functionName}");
      }
  } else {
      $this->executedSignatures[$callSignature] = 1;
  }
  ```

---

### 3. UI & UX Micro-Mechanics (Laravel + Vercel AI Next.js Bridge)
- **SSE Stream Ingestion & Layout Reflow Prevention**:
  When consuming token streams in React/Next.js via `useChat({ api: 'http://127.0.0.1:8000/api/chat' })`, token-by-token state updates force rapid DOM re-renders.
  ```tsx
  // INVARIANT: Ensure parent container has 'contain: content' or fixed height bounds
  // to avoid browser layout engine recalculating entire page geometry per token:
  <div className="mx-auto w-full max-w-2xl py-12 flex flex-col stretch will-change-contents">
      {messages.map(m => (
          <div key={m.id} className="p-4 my-2 rounded-lg break-words overflow-hidden">
              <strong className="font-bold">{m.role === 'user' ? 'You: ' : 'AI: '}</strong>
              <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
      ))}
  </div>
  ```
- **Scroll Pinning Invariant**:
  Auto-scrolling chat interfaces must check if the user has scrolled up to inspect previous output. Unconditional `scrollIntoView()` on every streamed token locks the viewport, causing jarring visual jumps.

---

### 4. Backend Concurrency & Memory Safety
- **Memory Leaks in Chunked Streaming**:
  In long-lived CLI or daemon execution (e.g., Laravel Octane, RoadRunner, FrankenPHP), accumulating raw PSR-7 streams or response buffers causes worker memory footprint growth.
  ```php
  // INVARIANT: Explicitly close and detach PSR-7 stream resources
  $stream = $response->getBody();
  try {
      while (!$stream->eof()) {
          yield $stream->read(1024);
      }
  } finally {
      $stream->close();
  }
  ```
- **Vector Connection Pool Starvation**:
  When executing concurrent embedding generations across multiple chunks, batch API calls must be limited using concurrency concurrency throttles (e.g., Guzzle Pool or ReactPHP parallel limits) to prevent exhaustion of both API rate limits and database connection pools.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **JSON Decoding Hardening**:
  LLMs routinely append invalid trailing commas or raw unescaped newlines in JSON mode.
  ```php
  // BUG-PRONE:
  $data = json_decode($responseString, true);

  // HARDENED INVARIANT:
  try {
      $data = json_decode($responseString, true, 512, JSON_THROW_ON_ERROR);
  } catch (\JsonException $e) {
      throw new MalformedJsonModelResponseException(
          "LLM emitted invalid JSON output: " . $e->getMessage(),
          previous: $e
      );
  }
  ```
- **Reflection Type-Safety Gate**:
  Dynamically calling class methods derived from LLM tool calls must verify target method visibility and prevent invocation of internal magic methods (`__construct`, `__destruct`).
  ```php
  $reflection = new \ReflectionMethod($targetObject, $methodName);
  if (!$reflection->isPublic() || $reflection->isConstructor() || $reflection->isDestructor()) {
      throw new UnauthorizedToolInvocationException("Method {$methodName} is