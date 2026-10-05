# Forensic Learning Record (Deep Inspection): neuron-core/neuron-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/neuron-core-neuron-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neuron-core/neuron-ai](https://github.com/neuron-core/neuron-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:05.579Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neuron-core/neuron-ai`
- **Description**: The Agentic Framework of the PHP ecosystem to build production-ready AI driven applications. Connect components (LLMs, Tools, vector DBs, memory) to agents that interact with your data and UI.
- **Primary Language / Ecosystem**: PHP
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2109 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/streaming/src/consumer.ts`
```
export interface ChannelEvent {
  streamId: string;
  sequence: number;
  type: string;
  data: unknown;
}

export interface ChannelConsumer {
  accept(frame: unknown): void;
  close(): void;
}

export interface ChannelCallbacks {
  onEvent(event: ChannelEvent): void;
  onGap(reason: string): void;
}

interface Entry {
  type: string;
  fragment: boolean;
  total: number;
  parts: Map<number, string>;
  bytes: number;
}

interface Budget {
  events: number;
  parts: number;
  bytes: number;
}

const byteLimit = 8 * 1024 * 1024;
const terminalTypes = new Set(['stream.completed', 'stream.interrupted', 'stream.failed']);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStreamId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
}

/** Reconcile Neuron envelopes, optionally selecting one execution segment. */
export function createChannelConsumer(callbacks: ChannelCallbacks, streamId?: string): ChannelConsumer {
  if (streamId !== undefined && !isStreamId(streamId)) throw new TypeError('Invalid channel stream ID');
  const consumers = new Map<string, ChannelConsumer>();
  const finished = new Set<string>();
  const budget: Budget = { events: 0, parts: 0, bytes: 0 };
  let closed = false;

  function close(): void {
    if (closed) return;
    closed = true;
    for (const consumer of consumers.values()) consumer.close();
    consumers.clear();
    finished.clear();
  }

  function fail(reason: string): void {
    if (closed) return;
    close();
    callbacks.onGap(reason);
  }

  function accept(frame: unknown): void {
    if (closed) return;
    if (!isRecord(frame) || !isStreamId(frame.streamId)) return fail('Invalid channel envelope');
    const id = frame.streamId;
    if ((streamId !== undefined && id !== streamId) || finished.has(id)) return;
    let consumer = consumers.get(id);
    if (!consumer) {
      // Keep finished IDs so delayed duplicates cannot reopen a segment.
      if (consumers.size >= 64 || consumers.size + finished.size >= 1024) {
        return fail('Channel stream limit exceeded');
      }
      consumer = createSegmentConsumer(id, { onEvent: callbacks.onEvent, onGap: fail }, budget, () => {
        consumers.delete(id);
        if (!closed) finished.add(id);
      });
      consumers.set(id, consumer);
    }
    try {
      consumer.accept(frame);
    } catch (error) {
      close();
      throw error;
    }
  }

  return { accept, close };
}

function createSegmentConsumer(
  streamId: string,
  callbacks: ChannelCallbacks,
  budget: Budget,
  onClose: () => void,
): ChannelConsumer {
  const pending = new Map<number, Entry>();
  let next = 0;
  let closed = false;
  let draining = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function release(entry: Entry): void {
    --budget.events;
    budget.parts -= entry.parts.size;
    budget.bytes -= entry.bytes;
  }

  function clearTimer(): void {
    clearTimeout(timer);
    timer = undefined;
  }

  function close(): void {
    if (closed) return;
    closed = true;
    clearTimer();
    for (const entry of pending.values()) release(entry);
    pending.clear();
    onClose();
  }

  function fail(reason: string): void {
    close();
    callbacks.onGap(reason);
  }

  function drain(): void {
    if (draining) return;
    draining = true;
    try {
      while (!closed) {
        const entry = pending.get(next);
        if (!entry || entry.parts.size !== entry.total) break;
        let data: unknown;
        try {
          const parts = Array.from({ length: entry.total }, (_, i) => entry.parts.get(i)!);
          const json = entry.fragment
            ? new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(
                atob(parts.join('').replace(/-/g, '+').replace(/_/g, '/')),
                (character) => character.charCodeAt(0),
              ))
            : parts[0]!;
          data = JSON.parse(json);
        } catch {
          return fail('Invalid reassembled payload');
        }
        pending.delete(next++);
        release(entry);
        clearTimer();
        if (terminalTypes.has(entry.type)) close();
        callbacks.onEvent({ streamId, sequence: next - 1, type: entry.type, data });
      }
      // Only progress resets the deadline. Duplicates and later events cannot postpone a gap.
      if (!closed && pending.size && timer === undefined) {
        timer = setTimeout(() => fail('Missing channel events'), 30_000);
      }
    } catch (error) {
      close();
      throw error;
    } finally {
      draining = false;
    }
  }

  function accept(frame: unknown): void {
    if (closed || !isRecord(frame) || frame.streamId !== streamId) return;
    const { sequence, type, data } = frame;
    if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0
      || typeof type !== 'string' || !type || !Object.hasOwn(frame, 'data')) {
      return fail('Invalid channel envelope');
    }
    if (sequence < next) return;
    const fragment = type === 'stream.fragment';
    let eventType = type;
    let index = 0;
    let total = 1;
    let part: string;
    if (fragment) {
      if (!isRecord(data) || typeof data.event !== 'string' || !data.event || data.event === 'stream.fragment'
        || typeof data.part !== 'string' || !data.part
        || typeof data.index !== 'number' || !Number.isSafeInteger(data.index)
        || typeof data.total !== 'number' || !Number.isSafeInteger(data.total)
        || data.total < 1 || data.total > 4096 || data.index < 0 || data.index >= data.total) {
        return fail('Invalid channel fragment');
      }
      if (data.part.length > byteLimit) return fail('Channel buffer limit exceeded');
      if (!/^[A-Za-z0-9_-]+={0,2}$/.test(data.part)
        || (data.index < data.total - 1 && (data.part.includes('=') || data.part.length % 4 !== 0))) {
        return fail('Invalid channel fragment');
      }
      eventType = data.event;
      index = data.index;
      total = data.total;
      part = data.part;
    } else {
      let json: string | undefined;
      try {
        json = JSON.stringify(data);
      } catch {
        return fail('Invalid channel payload');
      }
      if (json === undefined) return fail('Missing channel payload');
      part = json;
    }
    if (part.length + eventType.length > byteLimit) return fail('Channel buffer limit exceeded');
    let entry = pending.get(sequence);
    if (entry && (entry.type !== eventType || entry.fragment !== fragment || entry.total !== total)) {
      return fail('Conflicting channel events');
    }
    const duplicate = entry?.parts.get(index);
    if (duplicate !== undefined) {
      if (duplicate !== part) fail('Conflicting channel events');
      return;
    }
    const encoder = new TextEncoder();
    const bytes = (fragment ? part.length : encoder.encode(part).length)
      + (entry ? 0 : encoder.encode(eventType).length);
    if (budget.events + (entry ? 0 : 1) > 1024 || budget.parts + 1 > 4096 || budget.bytes + bytes > byteLimit) {
      return fail('Channel buffer limit exceeded');
    }
    if (!entry) {
      entry = { type: eventType, fragment, total, parts: new Map(), bytes: 0 };
      pending.set(sequence, entry);
      ++budget.events;
    }
    entry.parts.set(index, part);
    entry.bytes += bytes;
    ++budget.parts;
    budget.bytes += bytes;
    drain();
  }

  return { accept, close };
}

```

### Core Architecture Module: `packages/streaming/src/index.ts`
```
export { createChannelConsumer } from './consumer.js';
export type { ChannelEvent, ChannelConsumer, ChannelCallbacks } from './consumer.js';
export { subscribeToPusher } from './pusher.js';
export type { PusherChannel } from './pusher.js';
export { createProtocolStream } from './protocol.js';
export type { ProtocolEvent } from './protocol.js';

```

### Core Architecture Module: `packages/streaming/src/protocol.ts`
```
import { isRecord, type ChannelCallbacks, type ChannelEvent } from './consumer.js';

export interface ProtocolEvent {
  type: string;
  [key: string]: unknown;
}

/** Bridge one reconciled segment to a typed protocol stream. */
export function createProtocolStream<T>(
  subscribe: (callbacks: ChannelCallbacks) => { close(): void },
  parse: (event: ProtocolEvent) => T | Promise<T>,
): ReadableStream<T> {
  let subscription: { close(): void } | undefined;
  let closed = false;
  let streamId: string | undefined;

  function close(): void {
    if (closed) return;
    closed = true;
    subscription?.close();
  }

  const events = new ReadableStream<ChannelEvent>({
    start(controller) {
      function fail(error: unknown): void {
        if (closed) return;
        close();
        controller.error(error);
      }
      try {
        subscription = subscribe({
          onEvent(event) {
            if (closed) return;
            streamId ??= event.streamId;
            if (event.streamId !== streamId) return fail(new Error('Protocol streams require one execution segment'));
            // Push transports cannot be paused; bound the extra queue for slow readers.
            const size = eventBytes(event);
            if (size > (controller.desiredSize ?? 0)) return fail(new Error('Protocol stream buffer limit exceeded'));
            controller.enqueue(event);
            if (isTerminal(event.type)) {
              close();
              controller.close();
            }
          },
          onGap: reason => fail(new Error(reason)),
        });
        // A source may finish synchronously before returning its cleanup handle.
        if (closed) subscription.close();
      } catch (error) {
        fail(error);
      }
    },
    cancel: close,
  }, {
    highWaterMark: 8 * 1024 * 1024,
    size: eventBytes,
  });

  return events.pipeThrough(new TransformStream<ChannelEvent, T>({
    async transform(event, controller) {
      if (event.type === 'stream.failed') throw new Error('Backend stream failed');
      if (isTerminal(event.type)) return;
      // PHP encodes ProtocolEvent's default empty payload as [], including Vercel step boundaries.
      if (!isRecord(event.data) && !(Array.isArray(event.data) && event.data.length === 0)) {
        throw new TypeError('Protocol event payload must be an object');
      }
      // The envelope owns the discriminator, even if the payload contains a type field.
      controller.enqueue(await parse({ ...event.data, type: event.type }));
    },
  }));
}

function isTerminal(type: string): boolean {
  return type === 'stream.completed' || type === 'stream.interrupted' || type === 'stream.failed';
}

function eventBytes(event: ChannelEvent): number {
  return Math.max(8192, new TextEncoder().encode(JSON.stringify(event)).length);
}

```

### Core Architecture Module: `packages/streaming/src/pusher.ts`
```
import { createChannelConsumer, isRecord, type ChannelCallbacks } from './consumer.js';

export interface PusherChannel {
  bind_global(callback: (name: string, data: unknown) => void): unknown;
  unbind_global(callback: (name: string, data: unknown) => void): unknown;
}

/** Subscribe to envelopes after the Pusher SDK has authenticated and decrypted them. */
export function subscribeToPusher(
  channel: PusherChannel,
  callbacks: ChannelCallbacks,
  streamId?: string,
): { close(): void } {
  let closed = false;
  const consumer = createChannelConsumer({ onEvent: callbacks.onEvent, onGap: fail }, streamId);

  function close(): void {
    if (closed) return;
    closed = true;
    channel.unbind_global(receive);
    consumer.close();
  }

  function fail(reason: string): void {
    close();
    callbacks.onGap(reason);
  }

  function receive(name: string, frame: unknown): void {
    if (closed || name.startsWith('pusher:')) return;
    if (!isRecord(frame) || frame.type !== name) return fail('Invalid channel envelope');
    try {
      consumer.accept(frame);
    } catch (error) {
      close();
      throw error;
    }
  }

  channel.bind_global(receive);
  return { close };
}

```

### Core Architecture Module: `packages/streaming/tools/pack.mjs`
```
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync } from 'node:fs';

mkdirSync('artifacts', { recursive: true });
const [archive] = JSON.parse(execFileSync('npm', [
  'pack', '--workspace', '@neuron-core/streaming', '--pack-destination', 'artifacts', '--json', '--ignore-scripts',
], { encoding: 'utf8' }));
renameSync(`artifacts/${archive.filename}`, 'artifacts/streaming.tgz');
console.log(`artifacts/streaming.tgz (${archive.size} bytes)`);

```

### Core Architecture Module: `packages/streaming/tools/release.mjs`
```
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseTag(tag, version) {
  if (tag !== `frontend-v${version}`) throw new Error(`Expected tag frontend-v${version}; received ${tag}`);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)) {
    throw new Error(`Unsupported release version: ${version}`);
  }
  return version.includes('-') ? 'next' : 'latest';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(`dist-tag=${releaseTag(process.env.GITHUB_REF_NAME, version)}`);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #523** (2026-04-01): **HistoryTrimmer silently destroys chat history when ToolRunsExceededException leaves messages in invalid alternation**
  *Symptoms*: ## Description  When a tool hits its `maxRuns` limit and throws `ToolRunsExceededException`, the chat history is left in a corrupted state. The `ToolNode` adds the `ToolCallMessage` to history (line 42 of `ToolNode.php`) **before** executing the tool, but when the exception is thrown, no assistant response is ever added. This leaves the history ending with a tool call message (assistant role) but no corresponding tool result or final assistant message.  ## Steps to reproduce  1. Configure an agent with tools and a `maxRuns` limit (e.g., default 10 or a custom value like 5) 2. The AI repeatedly calls the same tool until `ToolRunsExceededException` is thrown 3. The exception propagates up — the `ToolCallMessage` was already added to chat history (line 42), but no `ToolResultMessage` or assistant response follows 4. The user sends a new message (user role) 5. On the next `trim()` call, `ensureValidAlternation()` encounters an invalid sequence and silently drops messages that don't fit the strict user→assistant alternation 6. This cascading removal can wipe out most or all of the conversation history  ## Root cause  Two issues combine to create this bug:  ### Issue 1: No recovery after `ToolRunsExceededException`  In `ToolNode::__invoke()` (line 42), the `ToolCallMessage` is added to chat history **before** tool execution. When `ToolRunsExceededException` is thrown in `executeSingleTool()`, the exception bubbles up without adding a corresponding `ToolResultMessage`. This leaves t
  **Post-Mortem & Fix Analysis**:
  > I was already working to give more consistency in this part of the framework. I'll update here with more details. 
  > ## Just trim without unexpected cuts  In the `history` branch of the repo you can find the refactored [HistoryTrimmer](https://github.com/neuron-core/neuron-ai/blob/history/src/Chat/History/HistoryTrimmer.php) class.   This implementation completely removes the `ensureValidMessageSequence()` method that was responsible of the unexpected cuts. It relies only on the `validateAlternation()` to perform only the passive check on the status of the history.  The only active part is finding the exact point at which to cut the array. The `findTrimPoint()` method first identify the `$index` only based on the number of tokens to fit with the context window. Then `adjustTrimIndexToPreservePairs()` ensure that the trim point doesn't break the consistency of the history, so it could remove at most two additinal messages to avoid breaking the sequence.  ## Tool Exception  Now the question is how to handle Tool errors. As you mentioned there are a couple of options here, to fit different scenarios and
  > `resolveToolErrorHandler` was easy to implement, and it works great  ```php     protected function resolveToolErrorHandler(): ?callable     {         return new ToolErrorHandler;     } ```   ```php namespace Modules\Ai\Neuron;  use Illuminate\Support\Facades\Log; use NeuronAI\Tools\ToolInterface; use Throwable;  class ToolErrorHandler {     public function __invoke(Throwable $e, ToolInterface $tool): string     {         Log::warning('Tool execution failed, returning error to LLM', [             'tool' => $tool->getName(),             'error' => $e->getMessage(),             'exception' => get_class($e),         ]);          return "Tool '{$tool->getName()}' failed: {$e->getMessage()}";     } } ```   <img width="908" height="804" alt="Image" src="https://github.com/user-attachments/assets/fde4a48e-2e2c-4057-bed1-d64bc7638e48" />   ## refactored [HistoryTrimmer](https://github.com/neuron-core/neuron-ai/blob/history/src/Chat/History/HistoryTrimmer.php)  When I tested what happens when we

- **Issue #469** (2026-02-13): **Gemini HandleChat only checks parts[0] for functionCall — breaks Gemini 3 tool calls**
  *Symptoms*: ## Description  The non-streaming Gemini `HandleChat` trait determines whether a response contains a tool/function call by inspecting only the **first element** of the `parts` array:  ```php if (array_key_exists('functionCall', $parts[0]) && !empty($parts[0]['functionCall'])) { ```  https://github.com/neuron-core/neuron-ai/blob/2.x/src/Providers/Gemini/HandleChat.php#L95  Gemini 3 models (e.g. `gemini-3-pro-preview`, `gemini-3-flash-preview`) can return **text or thought parts before the `functionCall` part**, for example:  ```json {   "candidates": [{     "content": {       "parts": [         { "text": "Let me call the tool." },         { "functionCall": { "name": "my_tool", "args": { "input": "value" } }, "thoughtSignature": "sig-abc" }       ]     },     "finishReason": "STOP"   }] } ```  When this happens, `$parts[0]` is the text part (`{ "text": "..." }`), the `functionCall` check fails, and the response is treated as a plain `AssistantMessage` — **the tool call is silently ignored**.  See also: https://ai.google.dev/gemini-api/docs/thought-signatures  ## Note  The **streaming** path (`HandleStream`) already handles this correctly — `hasToolCalls()` iterates over all parts. Only the non-streaming `HandleChat` path is affected.  Additionally, `Gemini::createToolCallMessage()` uses `array_filter($tools)` without `array_values()`, so when text/thought parts precede `functionCall` parts, the resulting tools array can have non-sequential keys (e.g. `[2 => $tool]` instead of `
  **Post-Mortem & Fix Analysis**:
  > What version are you using?
  > @ilvalerione I've encountered this at `v2.11.2` in https://github.com/dx-tooling/sitebuilder-webapp, where I worked around this via https://github.com/dx-tooling/sitebuilder-webapp/blob/main/src/PhotoBuilder/Infrastructure/Adapter/PatchedGemini.php.
  > I’m not sure if this is related, but today, while testing with the gemini-3-pro-image-preview model, after a certain number of messages it started showing me the following error:  ``` POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent resulted in a 400 Bad Request response: { "error": { "code": 400, "message": "Image part is missing a thought_signature in content position 4," } } ```  After doing some research, I ended up on the same documentation page: https://ai.google.dev/gemini-api/docs/thought-signatures where they explain that it must be sent in the message history for “multi-turn” interactions.

- **Issue #450** (2026-01-29): **Trying to access array offset on false thrown on handleStructured**
  *Symptoms*: Hello I ran to an issue with Anthropic provider after updating from Sonnet-4 to Sonnet 4-5  I'm using handleStructured agent call to resolve a structured json output. After updating I get the `Trying to access array offset on false` when serializing the response from anthropic this may be due to an implementation issue of [streaming refusals](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/handle-streaming-refusals)  Happens on this line https://github.com/neuron-core/neuron-ai/blob/2.x/src/Providers/Anthropic/HandleChat.php#L48 as `$content` ends up being false after `end` call on empty array.  I'm currently not sure how to handle the streaming refusal issue with neuron but I think this is a bug due to invalid response expectation  I've not included reproduce steps as this may occur with a very specific data/request to LM api.  Version 2.11.1  Thanks for looking into this
  **Post-Mortem & Fix Analysis**:
  > Fixed in the latest release.
  > @ilvalerione Hi, thank you for the updated release, would it be possible to implement some enhanced tracking of the refusal reasons/errors in order to allow handling this behaviour?
  > The provided fix simply allows empty response from agent which then causes/allows AgentException `The response does not contains a valid JSON Object.` to be thrown. I can workaround using this exception but the reason/refusal info is missing.

- **Issue #434** (2026-01-13): **Bug: PDO Parameter Binding Error in DatabasePersistence with MySQL/MariaDB**
  *Symptoms*: **Describe the bug**  The `NeuronAI\Workflow\Persistence\DatabasePersistence` class contains a PDO parameter binding bug that causes `SQLSTATE[HY093]: Invalid parameter number` errors when saving workflow interruptions to MySQL/MariaDB databases. The issue occurs because the same named parameter `:data` is reused in both the `INSERT` and `ON DUPLICATE KEY UPDATE` clauses, which PDO with MySQL does not support.  **To Reproduce**  Steps to reproduce the behavior: 1. Set up a Laravel application with MySQL/MariaDB database connection 2. Create a workflow that uses `DatabasePersistence` for human-in-the-loop interruptions:    ```php    use NeuronAI\Workflow\Persistence\DatabasePersistence;    use Illuminate\Support\Facades\DB;        $persistence = new DatabasePersistence(        DB::connection()->getPdo(),        'workflow_interrupts'    );    ``` 3. Create a workflow node that calls `$this->interrupt()` to trigger an interruption 4. Execute the workflow and wait for the interruption to occur 5. See error: `SQLSTATE[HY093]: Invalid parameter number` at `DatabasePersistence.php:30`  **Expected behavior**  The workflow interruption should be saved to the database successfully using the `ON DUPLICATE KEY UPDATE` syntax, allowing the workflow state to be preserved and resumed later.  **Error Stack Trace:** ``` SQLSTATE[HY093]: Invalid parameter number at vendor/neuron-core/neuron-ai/src/Workflow/Persistence/DatabasePersistence.php:30 PDOStatement->execute(Array) ```  **The Neuron AI
  **Post-Mortem & Fix Analysis**:
  > What's the code you use to create the Workflow instance?
  > Is it possible you are using an integer as workflow_id?
  > We're facing the same:  ``` $initialState = new WorkflowState(['payload' => $content]);  $id = Str::random();  $persistance = new DatabasePersistence(     pdo:  DB::connection()->getPdo(),     table: 'workflow_interrupts' );  $workflow = CreateSomeWorkflow::make($initialState, $persistance, $id); ```  ```    PDOException    SQLSTATE[HY093]: Invalid parameter number    at vendor/neuron-core/neuron-ai/src/Workflow/Persistence/DatabasePersistence.php:30      26▕             VALUES (:id, :data, NOW(), NOW())      27▕             ON DUPLICATE KEY UPDATE data = :data, updated_at = NOW()      28▕         ");      29▕   ➜  30▕         $stmt->execute([      31▕             'id' => $workflowId,      32▕             'data' => serialize($interrupt),      33▕         ]);      34▕     } ```  We've created the migration using the following query:  ``` CREATE TABLE IF NOT EXISTS workflow_interrupts (     workflow_id VARCHAR(255) PRIMARY KEY,     data LONGBLOB NOT NULL,     created_at DATETIME NOT NULL

- **Issue #255** (2025-08-12): **Undefined function: 7 ERROR: database() does not exist while using SQLChatHistory with PostgreSQL.**
  *Symptoms*: **Describe the bug** While using PostgreSQL and SQLChatHistory the error `Undefined function: 7 ERROR: database() does not exist` happens.  This happens because when instancing SQLChatHistory it tries to sanitize the table name, which calls the query `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name`. `DATABASE()` does not exist in PotgreSQL but `current_database()` does.  **To Reproduce** Steps to reproduce the behavior: 1. Have a postgresql connection 2. Try to use an agent with SQLChatHistory. 3. Error happens  **The Neuron AI version you are using:** 1.16.7 
  **Post-Mortem & Fix Analysis**:
  > Fixed by [1.16.8](https://github.com/inspector-apm/neuron-ai/releases/tag/1.16.8)

- **Issue #81** (2025-05-14): **Error when history file is empty**
  *Symptoms*: During developing and testing i had to clear the history file manually.  When the history file exists and it is empty, running a prompt cause error:  `exception: "TypeError"  file: "C:\\xampp\\htdocs\\erp\\acs\\vendor\\inspector-apm\\neuron-ai\\src\\Chat\\History\\AbstractChatHistory.php" line: 108  message: "NeuronAI\\Chat\\History\\AbstractChatHistory::unserializeMessages(): Argument #1 ($messages) must be of type array, null given, called in C:\\xampp\\htdocs\\erp\\acs\\vendor\\inspector-apm\\neuron-ai\\src\\Chat\\History\\FileChatHistory.php on line 31"`  But placing `[]` in the file works which mean it would be good if the package check first the content before decoding content as  json or at least to consider `[]` if empty file.  Thanks 
  **Post-Mortem & Fix Analysis**:
  > Fixed in [1.9.32](https://github.com/inspector-apm/neuron-ai/releases/tag/1.9.32)  Thanks for your report.

- **Issue #45** (2025-04-24): **FileChatHistory causes Tool Errors**
  *Symptoms*: # Bug: Incorrect Tool Result Message Format Causes Anthropic API Error  Hey, I've been dealing with an issue while using MCP/Tool calls. I can seemingly send the first call fine, but additional calls result in a API error. It seems to be when using FileChatHistory specifically.  _AI Written report below, human reviewed for accuracy ⬇️_  **Describe the bug** When using the Anthropic provider with Neuron AI, tool result messages loaded from chat history (specifically `FileChatHistory`) are not being formatted correctly according to the Anthropic API specification. This leads to a `400 Bad Request` error with the message `messages.X.tools: Extra inputs are not permitted` when the next API call is made after a tool result is processed.  **To Reproduce** Steps to reproduce the behavior: 1. Configure an Agent to use the `Anthropic` provider and `FileChatHistory`. 2. Have a conversation where the assistant uses a tool (e.g., `perplexity_ask` via MCP). 3. The assistant returns a `tool_use` message. 4. The application processes the tool call and stores the result in the `FileChatHistory`. 5. Initiate another turn in the conversation (user sends a new message). 6. The `NeuronAI\Agent` or `Anthropic` provider prepares the message history for the API call. 7. The subsequent `POST https://api.anthropic.com/v1/messages` request fails with the `400 Bad Request` error mentioned above.  **Example problematic message structure found in history:** ```json {   "tools": [     {       "name": "per
  **Post-Mortem & Fix Analysis**:
  > I completely reviewed the message mapping between history and the AI providers.   1.9.8 should fix the issue.  https://github.com/inspector-apm/neuron-ai/releases/tag/1.9.8  Thank you for your report.
  > In 1.9.8 release OpenAI gpt-4.1 model still returns error. It seems unserializeMessages() is not compatible with openAI  `An assistant message with 'tool_calls' must be followed by tool messages`
  > Consider that if you are loading the same file chat history generated by 1.9.7 it could cause this error.  You should remove the old file and start a new history. 

- **Issue #1** (2025-03-12): **Undefined 'status' Key in OpenAI Provider Response**
  *Symptoms*: Hello,  It seems that the OpenAI provider has a bug when handling a simple message:  ```    ErrorException    Undefined array key "status"    at vendor/inspector-apm/neuron-ai/src/Providers/OpenAI.php:104     100▕             ->getBody()->getContents();     101▕     102▕         $result = \json_decode($result, true);     103▕   ➜ 104▕         if ($result['status'] === 'requires_action') {     105▕             $response = $this->createToolMessage(     106▕                 $result['required_action']['submit_tool_outputs']['tool_calls']     107▕             );     108▕         } else { ```  By dumping the `$result` variable, we notice that it does not contain the "status" key, even though the call seems to have been successfully made.  ``` array:8 [   "id" => "[...]"   "object" => "chat.completion"   "created" => 1741345401   "model" => "gpt-4o-2024-08-06"   "choices" => array:1 [     0 => array:4 [       "index" => 0       "message" => array:3 [         "role" => "assistant"         "content" => "Hello Valerio! How can I assist you today?"         "refusal" => null       ]       "logprobs" => null       "finish_reason" => "stop"     ]   ]   "usage" => array:5 [     "prompt_tokens" => 12     "completion_tokens" => 12     "total_tokens" => 24     "prompt_tokens_details" => array:2 [       "cached_tokens" => 0       "audio_tokens" => 0     ]     "completion_tokens_details" => array:4 [       "reasoning_tokens" => 0       "audio_tokens" => 0       "accepted_prediction_tokens" => 0 
  **Post-Mortem & Fix Analysis**:
  > Fixed in the latest version 1.3.0  However since I released a lot of other fixes and improvements I had to change the default namespace of the OpenAI class that now is in `\NeuronAI\Providers\OpenAI\OpenAI` instead of `\NeuronAI\Providers\OpenAI`  I'm sorry for the hard change. Also the documentation is already updated in order to reflect this changes in the code examples.  Let me know if you hit any issue and eventually feel free to close this one.

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

### Incident Patch 1: `f0f49c2d` (2026-09-29)
**Commit Message**: fix agent

**File**: `src/Tools/AGENTS.md` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ Per-call approval state (`ApprovalState`: pending / approved / rejected) is stam
 
 ## SQL select tools
 
-`MySQLSelectTool` and `PGSQLSelectTool` leave read-only enforcement to the database. Each query runs alone in a transaction opened with `START TRANSACTION READ ONLY` and always rolled back, so the database refuses a write whatever the SQL looks like (data-modifying CTEs, `SELECT INTO`, functions that write), and the rollback undoes session changes such as `set_config()`. A refusal from that transaction (SQLSTATE `25006`) reaches the model as `ToolOutput::error()`; other database errors propagate. The tools throw when the connection is already inside a transaction, because their rollback would discard the application's work.
+`MySQLSelectTool` and `PGSQLSelectTool` leave read-only enforcement to the database. Each query runs alone in a transaction opened with `START TRANSACTION READ ONLY` and always rolled back, so the database refuses a write whatever the SQL looks like (data-modifying CTEs, `SELECT INTO`, functions that write), and the rollback undoes session changes such as `set_config()`. On PostgreSQL a refusal from that transaction (SQLSTATE `25006`) reaches the model as `ToolOutput::error()` and other database errors propagate; `MySQLSelectTool` and `MySQLWriteTool` return every database error as `ToolOutput::error()` with the exception's message, so the model can correct its query. The tools throw when the connection is already inside a transaction, because their rollback would discard the application's work.
 
 The text rules cover only what a read-only transaction lets through. Each must refuse, never interpret SQL, so it stays stricter than the database in every case:
 
```

**File**: `src/Tools/Toolkits/MySQL/MySQLSelectTool.php` (modified, +2/-8)
```diff
@@ -32,8 +32,6 @@
  */
 class MySQLSelectTool extends Tool
 {
-    protected const READ_ONLY_VIOLATION = '25006';
-
     protected array $allowedStatements = ['SELECT', 'WITH', 'SHOW', 'DESCRIBE', 'EXPLAIN'];
 
     /**
@@ -71,7 +69,7 @@ protected function properties(): array
             new ToolProperty(
                 name: 'query',
                 type: PropertyType::STRING,
-                description: 'The SELECT query. Use backticks (`) around table/column names that are MySQL reserved keywords (e.g., `character`, `order`, `group`, `index`, `key`, `value`, `date`, `time`). Use named placeholders (:parameter_name) for all dynamic values. Examples: "SELECT id, name FROM `character` WHERE type = :type", "SELECT * FROM `order` WHERE status = :status"',
+                description: 'The SELECT query. Use backticks (`) around table/column names that are MySQL reserved keywords (e.g., `character`, `order`, `group`, `index`, `key`, `value`, `date`, `time`). Use named placeholders (:parameter_name) for all dynamic values. Each placeholder name can be used only once: give each occurrence its own name, even for the same value (e.g., "WHERE name LIKE :name_term OR email LIKE :email_term"). Examples: "SELECT id, name FROM `character` WHERE type = :type", "SELECT * FROM `order` WHERE status = :status"',
                 required: true
             ),
             new ArrayProperty(
@@ -105,11 +103,7 @@ public function __invoke(string $query, ?array $parameters = []): array|ToolOutp
         try {
             return $this->fetchRows($query, $parameters ?? []);
         } catch (PDOException $exception) {
-            if (($exception->errorInfo[0] ?? null) !== self::READ_ONLY_VIOLATION) {
-                throw $exception;
-            }
-
-            return ToolOutput::error('This tool is read-only. The database refused the query: ' . $exception->errorInfo[2]);
+            return ToolOutput::error($exception->getMessage());
         } finally {
             if ($this->pdo->inTransaction()) {
                 $this->pdo->rollBack();
```

**File**: `src/Tools/Toolkits/MySQL/MySQLWriteTool.php` (modified, +18/-12)
```diff
@@ -10,8 +10,10 @@
 use NeuronAI\Tools\ObjectProperty;
 use NeuronAI\Tools\PropertyType;
 use NeuronAI\Tools\Tool;
+use NeuronAI\Tools\ToolOutput;
 use NeuronAI\Tools\ToolProperty;
 use PDO;
+use PDOException;
 use ReflectionException;
 
 use function json_encode;
@@ -44,7 +46,7 @@ protected function properties(): array
             new ToolProperty(
                 'query',
                 PropertyType::STRING,
-                'The parameterized SQL write query with named placeholders (e.g., "INSERT INTO users (name, email) VALUES (:name, :email)" or "UPDATE users SET name = :name WHERE id = :id"). Use named parameters (:parameter_name) for all dynamic values.',
+                'The parameterized SQL write query with named placeholders (e.g., "INSERT INTO users (name, email) VALUES (:name, :email)" or "UPDATE users SET name = :name WHERE id = :id"). Use named parameters (:parameter_name) for all dynamic values. Each placeholder name can be used only once: give each occurrence its own name, even for the same value (e.g., "UPDATE users SET status = :status WHERE id = :id OR parent_id = :parent_id").',
                 true
             ),
             new ArrayProperty(
@@ -65,22 +67,26 @@ protected function properties(): array
     /**
      * @param array<array{name: string, value: string}>|null $parameters
      */
-    public function __invoke(string $query, ?array $parameters = []): string
+    public function __invoke(string $query, ?array $parameters = []): string|ToolOutput
     {
-        $statement = $this->pdo->prepare($query);
-
-        // Bind parameters if provided
-        $parameters ??= [];
-        foreach ($parameters as $parameter) {
-            $paramName = str_starts_with((string) $parameter['name'], ':') ? $parameter['name'] : ':' . $parameter['name'];
-            $statement->bindValue($paramName, $parameter['value']);
+        try {
+            $statement = $this->pdo->prepare($query);
+
+            // Bind parameters if provided
+            $parameters ??= [];
+            foreach ($parameters as $parameter) {
+                $paramName = str_starts_with((string) $parameter['name'], ':') ? $parameter['name'] : ':' . $parameter['name'];
+                $statement->bindValue($paramName, $parameter['value']);
+            }
+
+            $result = $statement->execute();
+        } catch (PDOException $exception) {
+            return ToolOutput::error($exception->getMessage());
         }
 
-        $result = $statement->execute();
-
         if (!$result) {
             $errorInfo = $statement->errorInfo();
-            return "Error executing query: " . ($errorInfo[2] ?? 'Unknown database error');
+            return ToolOutput::error("Error executing query: " . ($errorInfo[2] ?? 'Unknown database error'));
         }
 
         $output = "Query executed successfully. {$statement->rowCount()} row(s) affected.";
```

**File**: `src/Workflow/Executor/Segment.php` (modified, +47/-0)
```diff
@@ -40,7 +40,9 @@
 use Psr\EventDispatcher\EventDispatcherInterface;
 use Throwable;
 
+use function getmypid;
 use function hash;
+use function iterator_to_array;
 use function time;
 
 /**
@@ -73,17 +75,36 @@ final class Segment
      */
     protected array $forkStates = [];
 
+    /** The process that admitted the segment: a forked child must never settle its parent's run. */
+    protected int|false $processId;
+
     public function __construct(
         protected WorkflowRunStore $store,
         protected ExecutionContext $context,
         protected WorkflowState $state,
         protected ?int $leaseTimeout,
         protected bool $retainCompletion,
     ) {
+        $this->processId = getmypid();
         $this->state->markAsRunning();
         $this->stamp($this->state);
     }
 
+    /**
+     * A client abort under ignore_user_abort(false) ends the request without
+     * running the generator's finally block, but still destroys the segment.
+     */
+    public function __destruct()
+    {
+        try {
+            if ($this->releaseIfAbandoned()) {
+                $this->report(new WorkflowEnd($this->state));
+            }
+        } catch (Throwable) {
+            // A destructor must not throw at shutdown: the lease still covers the run.
+        }
+    }
+
     /**
      * Everything the definition decides is resolved before the segment
      * starts; the graph and the output are built inside it, after admission.
@@ -111,6 +132,7 @@ public function run(
         try {
             return yield from $this->execute($graph, $adapter, $channel);
         } finally {
+            $this->releaseIfAbandoned();
             $this->report(new WorkflowEnd($this->state));
         }
     }
@@ -224,6 +246,31 @@ protected function fail(Throwable $e): void
         $this->report(new WorkflowError($e, false));
     }
 
+    /**
+     * A consumer that stops pulling before the segment settles would leave the
+     * run running under its lease: fail it instead, so the next start
+     * supersedes it at once and a plain run() recovers it.
+     */
+    protected function releaseIfAbandoned(): bool
+    {
+        // Only settle() and fail() move the state off running.
+        if ($this->state->getStatus() !== WorkflowStatus::Running || $this->processId !== getmypid()) {
+            return false;
+        }
+
+        // Branch fibers left running start no new node.
+        $this->pauseRequested = true;
+        $error = new WorkflowException("The consumer of workflow ID '{$this->context->workflowId}' stopped before the run settled.");
+        $this->fail($error);
+
+        if (isset($this->output)) {
+            // Nothing can be yielded any more; draining still notifies a channel.
+            iterator_to_array($this->output->failed($error), false);
+        }
+
+        return true;
+    }
+
     protected function markControlFailed(): void
     {
         if (!$this->store->hasControl() || $this->store->control()->status === WorkflowStatus::Completed) {
```

**File**: `tests/Agent/AgentLeaseTest.php` (modified, +20/-0)
```diff
@@ -101,6 +101,26 @@ public function writeIfUnchanged(
         $this->assertCount(3, $renewals);
     }
 
+    public function test_an_abandoned_stream_does_not_hold_the_thread_for_the_lease(): void
+    {
+        $persistence = new InMemoryPersistence();
+        $store = new InMemoryMessageStore();
+        $provider = new FakeAIProvider(new AssistantMessage('A streamed answer'), new AssistantMessage('Still here'));
+        $agent = fn (): Agent => Agent::make()
+            ->setThreadId('thread_1')
+            ->setAiProvider($provider)
+            ->setPersistence($persistence)
+            ->setMessageStore($store);
+
+        // The client disconnects after the first chunk and the response stops pulling.
+        $stream = $agent()->stream(new UserMessage('Hi'));
+        $stream->current();
+        unset($stream);
+
+        $this->assertSame(WorkflowStatus::Failed, $agent()->inspect()?->status);
+        $this->assertSame('Still here', $agent()->chat(new UserMessage('Are you there?'))->getMessage()?->getContent());
+    }
+
     /**
      * The lease a run is admitted with: the deadline of its first control
      * record, in seconds from the moment it was written.
```

---

### Incident Patch 2: `53700f3a` (2026-09-29)
**Commit Message**: fix tests

**File**: `.github/workflows/tests.yml` (modified, +19/-6)
```diff
@@ -13,17 +13,28 @@ jobs:
     ci:
         runs-on: ${{ matrix.os }}
         services:
+            redis:
+                image: redis:7.4-alpine
+                ports:
+                    - 6379:6379
+                options: --health-cmd="redis-cli ping" --health-interval=5s --health-timeout=5s --health-retries=3
+            mongodb:
+                # Atlas Local bundles the search engine (mongot) required by $vectorSearch
+                image: mongodb/mongodb-atlas-local:8.0
+                ports:
+                    - 27017:27017
+                options: --health-cmd="runner healthcheck" --health-interval=10s --health-timeout=5s --health-retries=10
             qdrant:
-                image: qdrant/qdrant:latest
+                image: qdrant/qdrant:v1.14.1
                 ports:
                     - 6333:6333
                     - 6334:6334
             chroma:
-                image: chromadb/chroma:latest
+                image: chromadb/chroma:1.0.2
                 ports:
                     - 8000:8000
             meilisearch:
-                image: getmeili/meilisearch:latest
+                image: getmeili/meilisearch:v1.13.0
                 ports:
                     - 7700:7700
             mysql:
@@ -51,7 +62,7 @@ jobs:
                     - 3307:3306
                 options: --health-cmd="mariadb-admin ping" --health-interval=10s --health-timeout=5s --health-retries=3
             opensearch:
-                image: opensearchproject/opensearch:${{ matrix.opensearch-version || 'latest' }}
+                image: opensearchproject/opensearch:${{ matrix.opensearch-version || '2.19.1' }}
                 ports:
                     - 9201:9200 # Avoid port conflict with Elasticsearch
                     - 9600:9600
@@ -82,7 +93,7 @@ jobs:
                 os: [ubuntu-latest]
                 php: ['8.1', '8.2', '8.3', '8.4', '8.5']
                 dependency-version: [lowest, highest]
-                opensearch-version: ['latest']
+                opensearch-version: ['2.19.1']
                 include:
                     - os: ubuntu-latest
                       php: '8.5'
@@ -115,7 +126,7 @@ jobs:
               uses: shivammathur/setup-php@v2
               with:
                   php-version: ${{ matrix.php }}
-                  extensions: pdo_mysql, pdo_pgsql, pdo_sqlite, mongodb-2.5.2
+                  extensions: pdo_mysql, pdo_pgsql, pdo_sqlite, mongodb-2.5.2, redis, igbinary, bcmath, sodium
                   coverage: none
 
             - name: Setup Problem Matches
@@ -178,6 +189,8 @@ jobs:
 
             - name: Unit Tests
               env:
+                  WORKFLOW_REDIS_HOST: 127.0.0.1
+                  WORKFLOW_REDIS_PORT: "6379"
                   WORKFLOW_MYSQL_DSN: "mysql:host=127.0.0.1;dbname=neuron-ai"
                   WORKFLOW_MYSQL_USER: root
                   WORKFLOW_PGSQL_DSN: "pgsql:host=127.0.0.1;dbname=neuron-ai"
```

**File**: `Dockerfile` (modified, +8/-1)
```diff
@@ -7,25 +7,32 @@ RUN apt-get update && apt-get install -y \
     libxml2-dev \
     libzip-dev \
     libonig-dev \
+    libpq-dev \
+    libssl-dev \
     poppler-utils \
     unzip \
     && docker-php-ext-install \
+        bcmath \
         calendar \
         curl \
         dom \
         mbstring \
         pcntl \
         pdo_mysql \
+        pdo_pgsql \
         simplexml \
         sockets \
         xml \
         zip \
     && apt-get clean && rm -rf /var/lib/apt/lists/*
 
-RUN pecl install redis && docker-php-ext-enable redis
+RUN pecl install redis igbinary mongodb && docker-php-ext-enable redis igbinary mongodb
+
+RUN echo "memory_limit=-1" > "$PHP_INI_DIR/conf.d/memory-limit.ini"
 
 COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
 
 ENV COMPOSER_HOME=/tmp/composer-cache
+RUN mkdir -p $COMPOSER_HOME && chmod 1777 $COMPOSER_HOME
 
 WORKDIR /app
```

**File**: `docker-compose.yml` (modified, +22/-0)
```diff
@@ -14,9 +14,16 @@ services:
       - composer-cache:/tmp/composer-cache
     working_dir: /app
     network_mode: host
+    # Non-root, so POSIX permission tests run and files written to the repo stay yours
+    user: "${HOST_UID:-1000}:${HOST_GID:-1000}"
     environment:
       WORKFLOW_REDIS_HOST: 127.0.0.1
       WORKFLOW_REDIS_PORT: "6379"
+      WORKFLOW_MYSQL_DSN: "mysql:host=127.0.0.1;dbname=neuron-ai"
+      WORKFLOW_MYSQL_USER: root
+      WORKFLOW_PGSQL_DSN: "pgsql:host=127.0.0.1;dbname=neuron-ai"
+      WORKFLOW_PGSQL_USER: postgres
+      WORKFLOW_PGSQL_PASSWORD: workflow-test
     depends_on:
       redis:
         condition: service_healthy
@@ -30,6 +37,8 @@ services:
         condition: service_healthy
       mariadb:
         condition: service_healthy
+      postgres:
+        condition: service_healthy
       opensearch:
         condition: service_healthy
       weaviate:
@@ -95,6 +104,19 @@ services:
       timeout: 5s
       retries: 3
 
+  postgres:
+    image: postgres:${POSTGRES_VERSION:-17-alpine}
+    environment:
+      POSTGRES_DB: neuron-ai
+      POSTGRES_PASSWORD: workflow-test
+    ports:
+      - 5432:5432
+    healthcheck:
+      test: ["CMD", "pg_isready", "-U", "postgres"]
+      interval: 10s
+      timeout: 5s
+      retries: 3
+
   opensearch:
     image: opensearchproject/opensearch:${OPENSEARCH_VERSION:-2.19.1}
     ports:
```

**File**: `src/Tools/Toolkits/Calendar/GetTimezoneInfoTool.php` (modified, +4/-2)
```diff
@@ -13,6 +13,7 @@
 
 use function is_numeric;
 use function json_encode;
+use function round;
 use function str_contains;
 
 class GetTimezoneInfoTool extends Tool
@@ -67,8 +68,9 @@ public function __invoke(string $timezone, ?string $reference_date = null): stri
                 'abbreviation' => $date->format('T'),
                 'location' => ($location !== false && !str_contains($location['country_code'], '?')) ? [
                     'country_code' => $location['country_code'],
-                    'latitude' => $location['latitude'],
-                    'longitude' => $location['longitude'],
+                    // Arc-minute precision of the source data; also hides float noise that differs between timezone databases
+                    'latitude' => round($location['latitude'], 4),
+                    'longitude' => round($location['longitude'], 4),
                 ] : null,
                 'reference_time' => $date->format('Y-m-d H:i:s T'),
             ]);
```

**File**: `tests/HttpClient/ConsumerIsolationTest.php` (modified, +2/-1)
```diff
@@ -14,6 +14,7 @@
 use NeuronAI\MCP\StreamableHttpTransport;
 use NeuronAI\Providers\Anthropic\Anthropic;
 use NeuronAI\Providers\OpenAI\OpenAI;
+use NeuronAI\RAG\Document;
 use NeuronAI\RAG\Embeddings\OpenAIEmbeddingsProvider;
 use NeuronAI\RAG\PostProcessor\CohereRerankerPostProcessor;
 use NeuronAI\RAG\VectorStore\PineconeVectorStore;
@@ -52,7 +53,7 @@ public function test_shared_client_keeps_each_consumers_destination_and_credenti
         $openai->chat(new UserMessage('Hi'));
         $embeddings->embedText('Hi');
         $store->search(new SearchRequest([0.5]));
-        $reranker->process(new UserMessage('Hi'), []);
+        $reranker->process(new UserMessage('Hi'), [new Document('Hi')]);
         $mcp->send(['jsonrpc' => '2.0', 'method' => 'test']);
         $client->request(HttpRequest::get('health'));
 
```

---

### Incident Patch 3: `fd31663a` (2026-09-29)
**Commit Message**: fix Agent

**File**: `src/Agent/Nodes/ToolNode.php` (modified, +29/-4)
```diff
@@ -42,7 +42,6 @@
 use function json_encode;
 use function ksort;
 use function sprintf;
-use function uniqid;
 
 use const JSON_PRETTY_PRINT;
 
@@ -81,9 +80,11 @@ public function __construct(
      */
     public function __invoke(ToolCallEvent $event, AgentState $state, AgentResources $resources): AIInferenceEvent|AwaitToolResultsEvent|Generator
     {
+        $calls = $event->toolCallMessage->getToolCalls();
+        $this->assertUniqueCallIds(array_filter($calls, fn (ToolCall $call): bool => $call->isDeferred()));
+
         $approvalGated = $this->resolveToolApprovals($event->toolCallMessage, $state, $resources);
 
-        $calls = $event->toolCallMessage->getToolCalls();
         $executed = yield from $this->executeLocalTools($calls, $event->toolCallMessage->getId(), $state, $resources->tools);
         $deferred = $this->filterDeferredCalls($calls);
 
@@ -148,6 +149,8 @@ protected function resolveToolApprovals(ToolCallMessage $message, AgentState $st
             return false;
         }
 
+        $this->assertUniqueCallIds($gated);
+
         foreach ($gated as $call) {
             $call->setApprovalState(ApprovalState::Pending);
         }
@@ -178,6 +181,28 @@ protected function resolveToolApprovals(ToolCallMessage $message, AgentState $st
         return true;
     }
 
+    /**
+     * A call waiting for an approval or an external result is matched to its reply
+     * by ID: without one, or with one shared in the batch, the reply cannot reach it.
+     *
+     * @param ToolCall[] $calls
+     * @throws ToolException
+     */
+    protected function assertUniqueCallIds(array $calls): void
+    {
+        $seen = [];
+        foreach ($calls as $call) {
+            $id = $call->getCallId();
+            if ($id === null || $id === '' || isset($seen[$id])) {
+                $returned = $id === null || $id === '' ? 'none' : "'{$id}' twice";
+                throw new ToolException(
+                    "Tool call {$call->getName()} needs a unique call ID to be approved or answered, but the provider returned {$returned}."
+                );
+            }
+            $seen[$id] = true;
+        }
+    }
+
     /**
      * @param array<int, ToolCall> $calls
      * @return array<int, ToolCall>
@@ -331,7 +356,7 @@ protected function buildApprovalRequest(array $gated, ToolRegistry $tools): Appr
             $inputs = $this->resolveTool($call, $tools)->getInputs();
 
             $actions[] = new Action(
-                id: $call->getCallId() ?? uniqid('tool_'),
+                id: (string) $call->getCallId(),
                 name: $call->getName(),
                 description: $inputs === []
                     ? '(no arguments)'
@@ -463,7 +488,7 @@ protected function checkToolRuns(ToolCall $call, int $index, AgentState $state,
         $state->restoreToolRunCount($attempt['key'], $attempt['count']);
         $runs = $attempt['limit'];
         if ($attempt['count'] > $runs) {
-            throw new ToolRunsExceededException("Tool {$call->getName()} has been executed too many times - {$runs} - with arguments: ".json_encode($call->getInputs()));
+            throw new ToolRunsExceededException("Tool {$call->getName()} has been executed too many times - {$runs}");
         }
     }
 
```

**File**: `src/Evaluation/Conversation/Conversation.php` (modified, +1/-4)
```diff
@@ -217,10 +217,7 @@ protected function resume(InterruptRequest $request, array $payload): AgentState
         try {
             $continuation = $this->agent->submitInputs($payload, $translator);
         } catch (InputTranslationException $exception) {
-            throw new EvaluationException(
-                'The approval policy returned an invalid resume payload: ' . $exception->getMessage(),
-                previous: $exception
-            );
+            throw new EvaluationException('The approval policy returned an invalid resume payload: ' . $exception->getMessage(), $exception->getCode(), previous: $exception);
         }
 
         return $continuation->run();
```

**File**: `src/Providers/HandleWithTools.php` (modified, +1/-4)
```diff
@@ -71,10 +71,7 @@ protected function decodeToolArguments(string $toolName, array|string|null $argu
         try {
             $decoded = json_decode($arguments, true, flags: JSON_THROW_ON_ERROR);
         } catch (JsonException $exception) {
-            throw new ProviderException(
-                "The model sent invalid arguments for tool \"{$toolName}\": {$exception->getMessage()}",
-                previous: $exception
-            );
+            throw new ProviderException("The model sent invalid arguments for tool \"{$toolName}\": {$exception->getMessage()}", $exception->getCode(), previous: $exception);
         }
 
         // A JSON object decodes to a map (or to [] when empty), never to a scalar or a list
```

**File**: `tests/Agent/DuplicateCallIdToolExecutionTest.php` (modified, +62/-1)
```diff
@@ -4,7 +4,11 @@
 
 namespace NeuronAI\Tests\Agent;
 
+use NeuronAI\Chat\History\InMemoryMessageStore;
+use NeuronAI\Exceptions\ToolException;
+use NeuronAI\Tests\Agent\Stub\CountingTool;
 use NeuronAI\Tests\Agent\Stub\DuplicateCallIdWeatherTool;
+use NeuronAI\Tools\FrontendTool;
 use NeuronAI\Tools\ToolCall;
 use NeuronAI\Agent\Agent;
 use NeuronAI\Chat\Messages\AssistantMessage;
@@ -13,13 +17,18 @@
 use NeuronAI\Chat\Messages\UserMessage;
 use NeuronAI\Testing\FakeAIProvider;
 use NeuronAI\Tools\Tool;
+use NeuronAI\Tools\ToolInterface;
+use NeuronAI\Workflow\Persistence\InMemoryPersistence;
 use PHPUnit\Framework\TestCase;
 
+use function end;
+
 /**
  * Regression test: providers without per-call ids (Gemini historically reused the
  * tool name as callId) can hand the ToolNode parallel calls sharing a callId. The
  * durable memo key must still be unique per call, or the second call is silently
- * skipped and handed the first call's result.
+ * skipped and handed the first call's result. A call waiting for an approval or an
+ * external result is matched to its reply by ID, so there the batch is refused.
  */
 class DuplicateCallIdToolExecutionTest extends TestCase
 {
@@ -62,4 +71,56 @@ public function test_parallel_calls_sharing_a_call_id_both_execute(): void
             $results
         );
     }
+
+    public function test_frontend_calls_sharing_a_call_id_are_refused_before_dispatch(): void
+    {
+        $agent = $this->agent(new FrontendTool('browser'), new ToolCallMessage(null, [
+            new ToolCall('browser', 'dup', ['url' => 'https://a.example'], deferred: true),
+            new ToolCall('browser', 'dup', ['url' => 'https://b.example'], deferred: true),
+        ]));
+
+        $this->assertRefused($agent, "Tool call browser needs a unique call ID to be approved or answered, but the provider returned 'dup' twice.");
+    }
+
+    public function test_approval_calls_sharing_a_call_id_are_refused_before_the_history_write(): void
+    {
+        $agent = $this->agent((new CountingTool())->requireApproval(), new ToolCallMessage(null, [
+            new ToolCall('lookup', 'dup', ['query' => 'PHP']),
+            new ToolCall('lookup', 'dup', ['query' => 'Rust']),
+        ]));
+
+        $this->assertRefused($agent, "Tool call lookup needs a unique call ID to be approved or answered, but the provider returned 'dup' twice.");
+        $this->assertTrue($agent->abandon());
+    }
+
+    public function test_an_approval_call_without_a_call_id_is_refused(): void
+    {
+        $agent = $this->agent((new CountingTool())->requireApproval(), new ToolCallMessage(null, [
+            new ToolCall('lookup', null, ['query' => 'PHP']),
+        ]));
+
+        $this->assertRefused($agent, 'Tool call lookup needs a unique call ID to be approved or answered, but the provider returned none.');
+    }
+
+    protected function agent(ToolInterface $tool, ToolCallMessage $response): Agent
+    {
+        return Agent::make(workflowId: 'thread')
+            ->setPersistence(new InMemoryPersistence())
+            ->setMessageStore(new InMemoryMessageStore())
+            ->setAiProvider(new FakeAIProvider($response))
+            ->addTool($tool);
+    }
+
+    protected function assertRefused(Agent $agent, string $message): void
+    {
+        try {
+            $agent->chat(new UserMessage('Go'));
+            $this->fail('The batch must be refused.');
+        } catch (ToolException $e) {
+            $this->assertSame($message, $e->getMessage());
+        }
+
+        $messages = $agent->getChatHistory()->getMessages();
+        $this->assertNotInstanceOf(ToolCallMessage::class, end($messages), 'Nothing of the refused batch is written');
+    }
 }
```

**File**: `tests/Agent/ToolRunLimitTest.php` (modified, +3/-2)
```diff
@@ -249,7 +249,8 @@ public function test_a_tool_limit_overrides_the_agent_limit(): void
             $agent->chat(new UserMessage('Go'));
             $this->fail('The fourth call must exceed the tool limit.');
         } catch (ToolRunsExceededException $exception) {
-            $this->assertStringStartsWith('Tool lookup has been executed too many times - 3 -', $exception->getMessage());
+            // No arguments: they may quote user data into error trackers and log lines.
+            $this->assertSame('Tool lookup has been executed too many times - 3', $exception->getMessage());
         }
 
         $this->assertSame(3, CountingTool::$executions);
@@ -289,7 +290,7 @@ public function test_a_zero_limit_refuses_the_first_call(): void
             $this->agent([new CountingTool()], limit: 0)->chat(new UserMessage('Go'));
             $this->fail('A zero limit allows no call.');
         } catch (ToolRunsExceededException $exception) {
-            $this->assertStringStartsWith('Tool lookup has been executed too many times - 0 -', $exception->getMessage());
+            $this->assertSame('Tool lookup has been executed too many times - 0', $exception->getMessage());
         }
 
         $this->assertSame(0, CountingTool::$executions);
```

---

### Incident Patch 4: `3b0382a0` (2026-09-29)
**Commit Message**: fix Agent

**File**: `src/Agent/ContentHelper.php` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-<?php
-
-declare(strict_types=1);
-
-namespace NeuronAI\Agent;
-
-use function preg_quote;
-use function preg_replace;
-
-class ContentHelper
-{
-    /**
-     * Remove content between delimiters.
-     */
-    public static function removeDelimitedContent(string $text, string $openTag, string $closeTag): string
-    {
-        $escapedOpenTag = preg_quote($openTag, '/');
-        $escapedCloseTag = preg_quote($closeTag, '/');
-        $pattern = '/' . $escapedOpenTag . '.*?' . $escapedCloseTag . '/s';
-
-        return preg_replace($pattern, '', $text);
-    }
-}
```

**File**: `src/Agent/Frontend/AGUIInputTranslator.php` (modified, +8/-2)
```diff
@@ -7,7 +7,9 @@
 use NeuronAI\Agent\Interrupt\ApprovalRequest;
 use NeuronAI\Agent\Interrupt\ToolInputTranslator;
 use NeuronAI\Agent\Interrupt\ToolResultsRequest;
+use NeuronAI\Exceptions\ArrayPropertyException;
 use NeuronAI\Exceptions\InputTranslationException;
+use NeuronAI\Exceptions\ToolException;
 use NeuronAI\Tools\FrontendTool;
 use NeuronAI\Agent\Interrupt\Action;
 use NeuronAI\Workflow\Interrupt\InterruptRequest;
@@ -81,7 +83,11 @@ public function tools(array $payload): array
             if (isset($tools[$name])) {
                 throw new InputTranslationException("Duplicate frontend tool '{$name}'.");
             }
-            $tools[$name] = new FrontendTool($name, $definition['description'], $definition['parameters']);
+            try {
+                $tools[$name] = new FrontendTool($name, $definition['description'], $definition['parameters']);
+            } catch (ToolException|ArrayPropertyException $e) {
+                throw new InputTranslationException("Frontend tool '{$name}' declares unsupported parameters: {$e->getMessage()}", $e->getCode(), previous: $e);
+            }
         }
         return array_values($tools);
     }
@@ -138,7 +144,7 @@ protected function translateResume(array $payload, InterruptRequest $request): a
             throw new InputTranslationException('AG-UI resume must address every published interrupt.');
         }
         if ($request instanceof ToolResultsRequest) {
-            $request->validateResults($answers);
+            return $this->inputs($request, $answers);
         }
         return $answers;
     }
```

**File**: `src/Agent/Middleware/Summarization.php` (modified, +9/-7)
```diff
@@ -84,6 +84,11 @@ protected function summarizeHistory(ChatHistory $chatHistory, array $messages, A
         $recentMessages = array_slice($messages, $cutoffIndex);
 
         $summary = $this->generateSummary($provider, $oldMessages);
+        if ($summary === null) {
+            // Summarizing only saves tokens: without a summary the history stays
+            // as it is, and the next inference tries again.
+            return;
+        }
 
         $newMessages = [
             new UserMessage("## Previous conversation summary:\n\n{$summary}"),
@@ -175,9 +180,11 @@ protected function isSafeCutoffPoint(array $messages, int $index): bool
     }
 
     /**
+     * The summary text, or null when the call fails or the reply has no text.
+     *
      * @param Message[] $messages
      */
-    protected function generateSummary(AIProviderInterface $provider, array $messages): string
+    protected function generateSummary(AIProviderInterface $provider, array $messages): ?string
     {
         $prompt = $this->summaryPrompt ?? $this->getDefaultSummaryPrompt();
 
@@ -191,12 +198,7 @@ protected function generateSummary(AIProviderInterface $provider, array $message
 
             return $response->message()->getContent();
         } catch (Exception) {
-            // A failed summarization degrades to a placeholder rather than
-            // failing the run.
-            return sprintf(
-                'Previous conversation contained %d messages covering various topics.',
-                count($messages)
-            );
+            return null;
         }
     }
 
```

**File**: `tests/Agent/ContentHelperTest.php` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
-<?php
-
-declare(strict_types=1);
-
-namespace NeuronAI\Tests\Agent;
-
-use NeuronAI\Agent\ContentHelper;
-use PHPUnit\Framework\Attributes\DataProvider;
-use PHPUnit\Framework\TestCase;
-
-class ContentHelperTest extends TestCase
-{
-    /**
-     * @return iterable<string, array{string, string, string, string}>
-     */
-    public static function delimitedContent(): iterable
-    {
-        yield 'single block' => ['<think>plan</think>Answer', '<think>', '</think>', 'Answer'];
-        yield 'multiline block' => ["<think>line 1\nline 2</think>Answer", '<think>', '</think>', 'Answer'];
-        yield 'every block, not greedy across them' => ['<t>a</t>keep<t>b</t> me', '<t>', '</t>', 'keep me'];
-        yield 'empty block' => ['A<think></think>B', '<think>', '</think>', 'AB'];
-        yield 'no block' => ['Plain answer', '<think>', '</think>', 'Plain answer'];
-        yield 'unclosed block is kept' => ['<think>never closed', '<think>', '</think>', '<think>never closed'];
-        yield 'multibyte content' => ['<think>perché 🚀</think>Risposta è pronta', '<think>', '</think>', 'Risposta è pronta'];
-        yield 'empty text' => ['', '<think>', '</think>', ''];
-    }
-
-    #[DataProvider('delimitedContent')]
-    public function test_it_removes_every_delimited_block(string $text, string $open, string $close, string $expected): void
-    {
-        $this->assertSame($expected, ContentHelper::removeDelimitedContent($text, $open, $close));
-    }
-
-    /**
-     * Delimiters are literal text: regex metacharacters in them must not
-     * change what is matched or break the pattern.
-     *
-     * @return iterable<string, array{string, string, string, string}>
-     */
-    public static function metacharacterDelimiters(): iterable
-    {
-        yield 'dot and star' => ['a.*b', '.*', '*.', 'a.*b'];
-        yield 'brackets' => ['keep [x] drop[[secret]]', '[[', ']]', 'keep [x] drop'];
-        yield 'slash delimiter' => ['/*comment*/code', '/*', '*/', 'code'];
-        yield 'pipes' => ['a||hidden||b', '||', '||', 'ab'];
-        yield 'dollar and caret' => ['^$x$^ y', '^$', '$^', ' y'];
-    }
-
-    #[DataProvider('metacharacterDelimiters')]
-    public function test_delimiters_are_matched_literally(string $text, string $open, string $close, string $expected): void
-    {
-        $this->assertSame($expected, ContentHelper::removeDelimitedContent($text, $open, $close));
-    }
-}
```

**File**: `tests/Agent/Frontend/AGUIInputTranslatorTest.php` (modified, +29/-0)
```diff
@@ -103,6 +103,7 @@ public static function malformedResumes(): iterable
         yield 'unknown status' => [['resume' => [['interruptId' => '4', 'status' => 'approved']]], "Interrupt '4' requires resolved or cancelled status."];
         yield 'resolved without payload' => [['resume' => [['interruptId' => '4', 'status' => 'resolved']]], "Interrupt '4' requires an object payload."];
         yield 'resolved with a string payload' => [['resume' => [['interruptId' => '4', 'status' => 'resolved', 'payload' => 'done']]], "Interrupt '4' requires an object payload."];
+        yield 'resolved with an empty result map' => [['resume' => [['interruptId' => '4', 'status' => 'resolved', 'payload' => []]]], 'The payload contains no matching continuation input.'];
         yield 'cancelled with payload' => [['resume' => [['interruptId' => '4', 'status' => 'cancelled', 'payload' => []]]], 'A cancelled resume must omit payload.'];
     }
 
@@ -283,6 +284,34 @@ public function test_invalid_tool_definitions_are_rejected(mixed $definition): v
         (new AGUIInputTranslator())->tools(['tools' => [$definition]]);
     }
 
+    /** @return iterable<string, array{array<string, mixed>}> */
+    public static function unsupportedParameters(): iterable
+    {
+        yield 'unknown property type' => [['type' => 'object', 'properties' => ['x' => ['type' => 'unknown']]]];
+        yield 'numeric property type' => [['type' => 'object', 'properties' => ['x' => ['type' => 5]]]];
+        yield 'property definition is a string' => [['type' => 'object', 'properties' => ['x' => 'string']]];
+        yield 'properties is a string' => [['type' => 'object', 'properties' => 'x']];
+        yield 'required is a string' => [['type' => 'object', 'required' => 'x', 'properties' => ['x' => ['type' => 'string']]]];
+        yield 'items is a string' => [['type' => 'object', 'properties' => ['x' => ['type' => 'array', 'items' => 'string']]]];
+        yield 'negative minItems' => [['type' => 'object', 'properties' => ['x' => ['type' => 'array', 'minItems' => -1]]]];
+        yield 'reference keyword' => [['type' => 'object', 'properties' => ['x' => ['$ref' => '#/defs/x']]]];
+        yield 'union keyword' => [['type' => 'object', 'properties' => ['x' => ['anyOf' => [['type' => 'string'], ['type' => 'null']]]]]];
+    }
+
+    /**
+     * @param array<string, mixed> $parameters
+     */
+    #[DataProvider('unsupportedParameters')]
+    public function test_unsupported_tool_parameters_are_rejected_as_client_input(array $parameters): void
+    {
+        $this->expectException(InputTranslationException::class);
+        $this->expectExceptionMessage("Frontend tool 'browser' declares unsupported parameters: ");
+
+        (new AGUIInputTranslator())->tools(['tools' => [
+            ['name' => 'browser', 'description' => 'Read the page', 'parameters' => $parameters],
+        ]]);
+    }
+
     public function test_a_catalog_must_be_a_list_of_objects(): void
     {
         $this->expectException(InputTranslationException::class);
```

---

### Incident Patch 5: `910b9f42` (2026-09-29)
**Commit Message**: fix Agent

**File**: `src/Agent/Agent.php` (modified, +4/-17)
```diff
@@ -38,7 +38,6 @@
 use NeuronAI\Workflow\Workflow;
 use NeuronAI\Workflow\WorkflowState;
 use NeuronAI\Workflow\WorkflowStatus;
-use ReflectionClass;
 use Throwable;
 
 use function array_filter;
@@ -47,7 +46,6 @@
 use function array_values;
 use function end;
 use function implode;
-use function in_array;
 use function is_array;
 use function serialize;
 use function unserialize;
@@ -185,24 +183,13 @@ protected function resolveTools(): array
 
         foreach ($this->getTools() as $tool) {
             if ($tool instanceof ToolkitInterface) {
-                $kitGuidelines = $tool->guidelines();
-                if ($kitGuidelines !== null && $kitGuidelines !== '') {
-                    $name = (new ReflectionClass($tool))->getShortName();
-                    $kitGuidelines = '# '.$name.PHP_EOL.$kitGuidelines;
-                }
                 $innerTools = array_filter($tool->tools(), fn (ToolInterface $tool): bool => $tool->isVisible());
                 $tools = array_merge($tools, $innerTools);
 
-                if (!in_array($kitGuidelines, [null, '', '0'], true)) {
-                    $kitGuidelines .= PHP_EOL.implode(
-                        PHP_EOL.'- ',
-                        array_map(
-                            fn (ToolInterface $tool): string => $tool->getName(),
-                            $innerTools
-                        )
-                    );
-
-                    $guidelines[] = $kitGuidelines;
+                $kitGuidelines = $tool->guidelines();
+                if ($innerTools !== [] && $kitGuidelines !== null && $kitGuidelines !== '') {
+                    $names = array_map(fn (ToolInterface $tool): string => $tool->getName(), $innerTools);
+                    $guidelines[] = '# '.implode(', ', $names).PHP_EOL.$kitGuidelines;
                 }
             } elseif ($tool->isVisible()) {
                 $tools[] = $tool;
```

**File**: `src/Agent/AgentState.php` (modified, +6/-1)
```diff
@@ -59,7 +59,12 @@ public function incrementToolRun(string $toolName): void
         $this->set('__tool_runs', $attempts);
     }
 
-    public function getToolRuns(?string $toolName = null): int
+    /**
+     * The run count of one key, or every count keyed by run key.
+     *
+     * @return ($toolName is null ? array<string, int> : int)
+     */
+    public function getToolRuns(?string $toolName = null): array|int
     {
         $attempts = $this->get('__tool_runs', []);
 
```

**File**: `tests/Agent/AgentInstructionsTest.php` (modified, +40/-2)
```diff
@@ -8,6 +8,7 @@
 use NeuronAI\Tests\Support\AgentResourcesFactory;
 use NeuronAI\Tests\Agent\Stub\GetWeatherTool;
 use NeuronAI\Tests\Agent\Stub\QueryDatabaseTool;
+use NeuronAI\Tests\Agent\Stub\SearchTool;
 use NeuronAI\Tests\Agent\Stub\WeatherToolkit;
 use NeuronAI\Tools\ToolCall;
 use NeuronAI\Agent\Agent;
@@ -265,7 +266,7 @@ public function test_toolkit_guidelines_reach_the_provider_system_prompt(): void
         $systemPrompt = $record->systemPrompt->getContent();
         $this->assertStringContainsString('You are a helpful assistant.', $systemPrompt);
         $this->assertStringContainsString('<TOOLS-GUIDELINES>', $systemPrompt);
-        $this->assertStringContainsString('# WeatherToolkit', $systemPrompt);
+        $this->assertStringContainsString('# get_weather', $systemPrompt);
         $this->assertStringContainsString('Always report temperatures in Celsius.', $systemPrompt);
         $this->assertStringContainsString('get_weather', $systemPrompt);
 
@@ -332,7 +333,7 @@ public function test_toolkit_guidelines_never_accumulate_across_turns(): void
         $this->assertCount(2, $provider->getRecorded());
         foreach ($provider->getRecorded() as $record) {
             $prompt = (string) $record->systemPrompt?->getContent();
-            $this->assertStringStartsWith("You are a helpful assistant.\n\n<TOOLS-GUIDELINES>\n# WeatherToolkit\n", $prompt);
+            $this->assertStringStartsWith("You are a helpful assistant.\n\n<TOOLS-GUIDELINES>\n# get_weather\n", $prompt);
             $this->assertSame(1, substr_count($prompt, '<TOOLS-GUIDELINES>'));
             $this->assertSame(1, substr_count($prompt, 'Always report temperatures in Celsius.'));
         }
@@ -373,6 +374,43 @@ public function provide(): array
         $this->assertSame(['get_weather'], array_map(static fn (ToolInterface|ProviderToolInterface $tool): string => $tool->getName(), $record->tools));
     }
 
+    public function test_toolkit_guidelines_are_headed_by_their_tool_names(): void
+    {
+        $provider = new FakeAIProvider(new AssistantMessage('Done'));
+        $agent = Agent::make()->setAiProvider($provider)->setInstructions('You are a helpful assistant.');
+        $agent->addTool(new class () extends AbstractToolkit {
+            public function guidelines(): string
+            {
+                return 'Use wisely.';
+            }
+
+            public function provide(): array
+            {
+                return [new GetWeatherTool(), new SearchTool()];
+            }
+        });
+
+        $agent->chat(new UserMessage('Weather in Rome?'));
+
+        $this->assertSame(
+            "You are a helpful assistant.\n\n<TOOLS-GUIDELINES>\n# get_weather, search\nUse wisely.\n</TOOLS-GUIDELINES>",
+            $provider->getRecorded()[0]->systemPrompt?->getContent()
+        );
+    }
+
+    public function test_a_toolkit_without_visible_tools_adds_no_guidelines_block(): void
+    {
+        $provider = new FakeAIProvider(new AssistantMessage('Done'));
+        $agent = Agent::make()->setAiProvider($provider)->setInstructions('You are a helpful assistant.');
+        $agent->addTool((new WeatherToolkit())->with(GetWeatherTool::class, fn (ToolInterface $tool): ToolInterface => $tool->visible(false)));
+
+        $agent->chat(new UserMessage('Weather in Rome?'));
+
+        $record = $provider->getRecorded()[0];
+        $this->assertSame('You are a helpful assistant.', $record->systemPrompt?->getContent());
+        $this->assertSame([], $record->tools);
+    }
+
     public function test_a_plain_string_from_the_instructions_hook_becomes_a_system_message(): void
     {
         $provider = new FakeAIProvider(new AssistantMessage('Done'));
```

**File**: `tests/Agent/AgentStateTest.php` (modified, +12/-0)
```diff
@@ -144,6 +144,18 @@ public function test_different_run_keys_are_tracked_separately(): void
         $this->assertSame(0, $state->getToolRuns('read_file'));
     }
 
+    public function test_tool_runs_without_a_run_key_return_every_count(): void
+    {
+        $state = new AgentState();
+        $this->assertSame([], $state->getToolRuns());
+
+        $state->incrementToolRun('search');
+        $state->incrementToolRun('search');
+        $state->incrementToolRun('read_file:offset=0');
+
+        $this->assertSame(['search' => 2, 'read_file:offset=0' => 1], $state->getToolRuns());
+    }
+
     public function test_reset_tool_runs_clears_every_run_key(): void
     {
         $state = new AgentState();
```

**File**: `tests/Agent/AgentTest.php` (modified, +1/-1)
```diff
@@ -356,7 +356,7 @@ public function test_a_hidden_toolkit_tool_is_neither_offered_nor_listed_in_the_
             array_map(static fn (ToolInterface|ProviderToolInterface $tool): string => $tool->getName(), $record->tools)
         );
         $this->assertStringEndsWith(
-            "Always report temperatures in Celsius.\nget_weather\n</TOOLS-GUIDELINES>",
+            "<TOOLS-GUIDELINES>\n# get_weather\nAlways report temperatures in Celsius.\n</TOOLS-GUIDELINES>",
             (string) $record->systemPrompt?->getContent()
         );
     }
```

---

### Incident Patch 6: `7166a2de` (2026-09-29)
**Commit Message**: fix chat, workflow, and RAG

**File**: `skills/neuron-rag/SKILL.md` (modified, +0/-1)
```diff
@@ -456,7 +456,6 @@ protected function postProcessors(): array
             topN: 3,
         ),
         // or: new JinaRerankerPostProcessor(key: ..., topN: 3)
-        // or: new LocalAIRerankerPostProcessor(...)
         new FixedThresholdPostProcessor(threshold: 0.5),        // drop low-score documents
         // or: new AdaptiveThresholdPostProcessor(multiplier: 0.6)  // statistics-based cutoff
     ];
```

**File**: `src/Agent/Adapters/AGUIAdapter.php` (modified, +39/-17)
```diff
@@ -32,6 +32,7 @@
 use NeuronAI\Chat\Messages\Stream\Chunks\ToolResultChunk;
 use NeuronAI\Chat\Messages\ToolCallMessage;
 use NeuronAI\Chat\Messages\ToolResultMessage;
+use NeuronAI\Exceptions\InputTranslationException;
 use NeuronAI\Exceptions\StreamAdapterException;
 use NeuronAI\Exceptions\WorkflowException;
 use NeuronAI\Tools\ToolCall;
@@ -50,6 +51,7 @@
 use function array_map;
 use function implode;
 use function in_array;
+use function is_array;
 use function is_string;
 use function json_encode;
 use function array_values;
@@ -103,6 +105,7 @@ class AGUIAdapter implements CustomizableStreamAdapterInterface
      * Seed the protocol snapshot with the frontend's current conversation and state.
      * @param list<array<string, mixed>> $messages
      * @param array<string, mixed> $state
+     * @throws InputTranslationException when a seeded message or tool call is malformed.
      */
     public function __construct(
         protected string $threadId,
@@ -111,16 +114,41 @@ public function __construct(
         protected array $state = [],
     ) {
         foreach ($messages as $message) {
-            $this->messages[$message['id']] = $message;
-            foreach ($message['toolCalls'] ?? [] as $call) {
-                $this->toolCallStarted[$call['id']] = true;
+            $id = $this->seedId($message, 'id', 'message');
+            if (isset($this->messages[$id])) {
+                throw new InputTranslationException("Duplicate AG-UI message '{$id}'.");
+            }
+            $this->messages[$id] = $message;
+
+            $toolCalls = $message['toolCalls'] ?? [];
+            if (!is_array($toolCalls)) {
+                throw new InputTranslationException("AG-UI message '{$id}' has toolCalls that are not a list.");
+            }
+            foreach ($toolCalls as $call) {
+                $this->toolCallStarted[$this->seedId($call, 'id', 'tool call')] = true;
             }
             if (($message['role'] ?? null) === 'tool') {
-                $this->knownResults[$message['toolCallId']] = true;
+                $this->knownResults[$this->seedId($message, 'toolCallId', 'tool message')] = true;
             }
         }
     }
 
+    /**
+     * The seed comes from the client and snapshots send it back keyed by these
+     * identifiers, so a missing or malformed one would lose messages.
+     *
+     * @throws InputTranslationException
+     */
+    protected function seedId(mixed $entry, string $key, string $entryName): string
+    {
+        $id = is_array($entry) ? ($entry[$key] ?? null) : null;
+        if (!is_string($id) || $id === '') {
+            throw new InputTranslationException("An AG-UI {$entryName} requires a non-empty string {$key}.");
+        }
+
+        return $id;
+    }
+
     /**
      * @throws StreamAdapterException
      */
@@ -480,6 +508,7 @@ public function interrupt(InterruptRequest $request): iterable
             return;
         }
         $this->finished = true;
+        $this->runId ??= UniqueIdGenerator::generateId('run_');
         yield new ProtocolEvent('STATE_SNAPSHOT', ['snapshot' => (object) $this->state]);
         yield new ProtocolEvent('MESSAGES_SNAPSHOT', ['messages' => array_values($this->messages)]);
         yield new ProtocolEvent('RUN_FINISHED', [
@@ -770,13 +799,7 @@ public function error(Throwable $error): iterable
             yield $frame;
         }
 
-        $data = ['message' => $this->errorMessage($error)];
-
-        if ($error->getCode() !== 0) {
-            $data['code'] = (string) $error->getCode();
-        }
-
-        yield new ProtocolEvent('RUN_ERROR', $data);
+        yield new ProtocolEvent('RUN_ERROR', ['message' => $this->errorMessage($error)]);
     }
 
     /**
@@ -804,11 +827,10 @@ public function end(): iterable
             yield $event;
         }
 
-        if ($this->runId !== null) {
-            yield new ProtocolEvent('RUN_FINISHED', [
-                'threadId' => $this->threadId,
-                'runId' => $th
```

**File**: `src/Agent/Adapters/VercelAIAdapter.php` (modified, +13/-8)
```diff
@@ -27,6 +27,7 @@
 use Throwable;
 
 use function in_array;
+use function is_string;
 use function json_encode;
 
 use const JSON_THROW_ON_ERROR;
@@ -71,14 +72,18 @@ class VercelAIAdapter implements CustomizableStreamAdapterInterface
     public function __construct(protected ?string $messageId = null, array $parts = [])
     {
         foreach ($parts as $part) {
-            if (isset($part['toolCallId'])) {
-                $this->toolInputStarted[$part['toolCallId']] = true;
-                if (($part['state'] ?? null) === 'input-available') {
-                    $this->dispatchedTools[$part['toolCallId']] = true;
-                }
-                if (in_array($part['state'] ?? null, ['output-available', 'output-error', 'output-denied'], true)) {
-                    $this->knownOutputs[$part['toolCallId']] = true;
-                }
+            // As the input translator does, a part without a string call ID is not tracked.
+            $callId = $part['toolCallId'] ?? null;
+            if (!is_string($callId)) {
+                continue;
+            }
+
+            $this->toolInputStarted[$callId] = true;
+            if (($part['state'] ?? null) === 'input-available') {
+                $this->dispatchedTools[$callId] = true;
+            }
+            if (in_array($part['state'] ?? null, ['output-available', 'output-error', 'output-denied'], true)) {
+                $this->knownOutputs[$callId] = true;
             }
         }
     }
```

**File**: `src/Chat/AGENTS.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ Two parts with different lifetimes:
 - `MessageStoreInterface` stores conversations. Every call names its thread (`loadActive()`, `loadAll()`, `append()`, `archive()`, `clear()`), so a store keeps no conversation state and one instance serves the whole process: bind it once in a container. `SQLMessageStore` and `EloquentMessageStore` store one row per message with a `message_id` unique within its thread; the table key orders the thread, so an Eloquent key must follow insertion order (auto-increment, ULID or UUIDv7). `FileMessageStore` keeps one JSON file per thread, replaced atomically on every write, for controlled single-host use. The file name keeps the thread ID's letter case, so on a case-insensitive filesystem (the macOS and Windows defaults) IDs that differ only by case share one file. The SQL and Eloquent stores leave the comparison to the column: on MySQL and MariaDB the default collations ignore case and accents, so `thread_id` and `message_id` must be `VARBINARY` (the `SQLMessageStore` docblock shows the table), or `user-Alice` and `user-alice` read and clear each other's messages. `InMemoryMessageStore` lives in process memory. Constructing a store performs no I/O.
 - `ChatHistory` is the working context of one conversation for one execution segment: it receives its thread at construction, loads the active messages on first use, keeps them inside the context window with `HistoryTrimmer` (`DEFAULT_CONTEXT_WINDOW`, 50,000 tokens, unless configured), and writes through the store. It is concrete, like Workflow's `WorkflowRunStore` over `PersistenceInterface`: storage varies through the store and trimming through `HistoryTrimmerInterface`, which a composed workflow passes to the constructor (one instance per history, since trimmers are stateful). Open a new history per segment, as the Agent does (`src/Agent/AGENTS.md`); thread identity belongs to the Agent.
 
-A message's identity is `Message::getId()`: assigned at construction, stored with the message and restored on load; `setMetadata()` keeps it. `Message::jsonSerialize()` keeps the message's own fields at the top level (`__id`, `role`, `content`, `usage`, and `type` and `tools` on tool messages) and nests the metadata under `__meta`, so no metadata key can collide with them. `MessageDeserializer` rebuilds messages from that shape for stores and `Trajectory`. It also reads the flat shape of earlier versions, where the metadata sat beside the fields, because stored rows are never rewritten.
+A message's identity is `Message::getId()`: assigned at construction, stored with the message and restored on load; `setMetadata()` keeps it. `Message::jsonSerialize()` keeps the message's own fields at the top level (`__id`, `role`, `content`, `usage`, and `type` and `tools` on tool messages) and nests the metadata under `__meta`, so no metadata key can collide with them. `MessageDeserializer` rebuilds messages from that shape, JSON-decoded, for stores and `Trajectory`. It also reads the flat shape of earlier versions, where the metadata sat beside the fields, because stored rows are never rewritten.
 
 ### Trimming archives, it never deletes
 
```

**File**: `src/Chat/History/TokenCounter.php` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ protected function handleToolCalls(ToolCallMessage $message): int
 
     protected function handleTextBlock(TextContent $block): int
     {
-        return mb_strlen(json_encode($block->toArray()));
+        return mb_strlen(json_encode($block->toArray(), JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR));
     }
 
     protected function handleImageBlock(ImageContent $block): int
```

---

### Incident Patch 7: `c0584b04` (2026-09-29)
**Commit Message**: fix chat, workflow, and RAG

**File**: `skills/neuron-agent/SKILL.md` (modified, +1/-1)
```diff
@@ -310,7 +310,7 @@ protected function contextWindow(): int
 $agent->setContextWindow(190_000);
 ```
 
-Keep the window at least 5% below the model's limit, as 190,000 is for a 200,000-token model: rather than drop a whole turn, such as a long tool chain, the history may keep up to 5% more than the window.
+The window covers the whole request: instructions, tool definitions and messages, as the provider's usage reports them. Keep it at least 5% below the model's limit, as 190,000 is for a 200,000-token model: rather than drop a whole turn, the history may keep up to 5% more than the window.
 
 `getChatHistory()->getMessages()` returns the model context. To render a whole conversation, read its transcript from the store; message IDs are stable, so they serve as UI keys and page cursors:
 
```

**File**: `src/Agent/Nodes/ParallelToolNode.php` (modified, +18/-17)
```diff
@@ -27,7 +27,6 @@
 use function count;
 use function extension_loaded;
 use function is_array;
-use function is_subclass_of;
 use function ksort;
 use function serialize;
 use function unserialize;
@@ -104,16 +103,23 @@ protected function executeLocalTools(array $calls, string $messageId, AgentState
 
         $executedCalls = $rejectedCalls;
 
+        // Restore accounting even when the batch's execution results are cached.
+        // All calls reserve their slots in the parent before any child starts;
+        // a call the accounting refuses is settled here, as in sequential mode.
+        foreach ($runnable as $index => $call) {
+            try {
+                $this->checkToolRuns($call, $index, $state, $tools);
+            } catch (Throwable $e) {
+                $this->handleError($e, $call);
+                $executedCalls[$index] = $call;
+                unset($runnable[$index]);
+            }
+        }
+
         if ($runnable !== []) {
             $runnableCalls = array_values($runnable);
             $runnableKeys = array_keys($runnable);
 
-            // Restore accounting even when the batch's execution results are cached.
-            // All calls reserve their slots in the parent before any child starts.
-            foreach ($runnable as $index => $call) {
-                $this->checkToolRuns($call, $index, $state, $tools);
-            }
-
             $serializedResults = $this->memoize('parallel.tools', function () use ($runnableCalls, $tools): array {
                 // Resolve parent-side, before forking.
                 $resolved = [];
@@ -162,16 +168,11 @@ protected function executeLocalTools(array $calls, string $messageId, AgentState
                 $call = $runnableCalls[$pos];
 
                 if (is_array($data) && isset($data['error']) && $data['error'] === true) {
-                    $exceptionClass = $data['exception_class'];
-                    $exception = null;
-
-                    if (class_exists($exceptionClass) && is_subclass_of($exceptionClass, Throwable::class)) {
-                        $exception = new $exceptionClass($data['exception_message'], (int) $data['exception_code']);
-                    } else {
-                        $exception = new ToolException($data['exception_message'], (int) $data['exception_code']);
-                    }
-
-                    $this->handleError($exception, $call);
+                    // The original exception lives in the child process: report what it was.
+                    $this->handleError(new ToolException(
+                        "Tool {$data['tool_name']} failed with {$data['exception_class']}: {$data['exception_message']}",
+                        (int) $data['exception_code'],
+                    ), $call);
                 } else {
                     $call->setResult($data);
                 }
```

**File**: `src/Chat/AGENTS.md` (modified, +2/-2)
```diff
@@ -28,13 +28,13 @@ A message's identity is `Message::getId()`: assigned at construction, stored wit
 
 When the trimmer drops the oldest messages from the context, `ChatHistory` archives them in the store instead of deleting them: `archived_at` on the row or file entry, a counted prefix in memory. `loadActive()` returns the unarchived messages; `loadAll()` returns the whole transcript, optionally the `$limit` messages before a message ID, which is how a UI pages backward. `flushAll()` is the one destructive operation: it clears the whole thread, archived messages included. The `Summarization` middleware compacts through `flushAll()`, so summarizing a thread erases its transcript.
 
-The cut falls where the fewest messages go for the rest to fit the window, but a trimmed history must start with a plain `UserMessage`. When that point lands inside a turn, the trimmer keeps the whole turn if the history stays within 5% over the window (`HistoryTrimmer::OVERFLOW_TOLERANCE`), and otherwise cuts at the next user message, so a long tool chain is not dropped to save a few tokens. The latest turn is kept however large. Set the window at least 5% below the model's limit.
+The window budgets the whole request. The provider's usage, recorded on each answer, covers the instructions and tools sent with it, so they count without the history knowing them; before the first answer the messages are estimated alone. A cut is priced by the messages it drops, the provider's output tokens for a measured answer and an estimate otherwise, since instructions and tools stay in the next request. The cut falls where the fewest messages go for the rest to fit the window, but a trimmed history must start with a plain `UserMessage`. When that point lands inside a turn, the trimmer keeps the whole turn if the history stays within 5% over the window (`HistoryTrimmer::OVERFLOW_TOLERANCE`), and otherwise cuts at the next user message, so a long tool chain is not dropped to save a few tokens. The latest turn is kept however large. Set the window at least 5% below the model's limit.
 
 `calculateTotalUsage()` measures the active messages on demand, so a freshly loaded history reports its real size.
 
 ### Invariants
 
-- **Alternation.** A plain `UserMessage` can never directly follow a `ToolCallMessage`: the calls must be answered by a `ToolResultMessage` first. `HistoryTrimmer::validateAlternation()` enforces it on every append, which also covers sequences loaded from storage; a custom `HistoryTrimmerInterface` takes over this responsibility.
+- **Alternation.** A history opens with a user message, and a plain `UserMessage` can never directly follow a `ToolCallMessage`: the calls must be answered by a `ToolResultMessage` first. `HistoryTrimmer::validateAlternation()` enforces it on every append, which also covers sequences loaded from storage; a custom `HistoryTrimmerInterface` takes over this responsibility.
 - **Append-only, idempotent by identity.** `addMessage()` always appends; there is no update or replace. A message whose ID is already in the context is skipped, and a store skips a message already stored in the thread, so a replayed write converges even when its durable memo was lost (agent nodes also wrap history writes in memos, `src/Agent/AGENTS.md`). The trim validates the sequence before anything is stored.
 - **One writer per segment.** Archiving counts from the oldest active message. The count is correct because a working history loads fresh for its segment and the workflow run fence admits one active segment per conversation.
 - **Nothing dangles.** Messages commit only after the step that consumes them succeeds, so a failed provider call or a crashed tool never leaves a user message or tool call at the tail. The single exception is an approval-gated `ToolCallMessage`, written before the suspend so a cold process can render the pending approval from history alone.
```

**File**: `src/Chat/History/EloquentMessageStore.php` (modified, +3/-2)
```diff
@@ -10,6 +10,7 @@
 use NeuronAI\Chat\Messages\MessageDeserializer;
 
 use function array_merge;
+use function max;
 
 /**
  * Stores one row per message through the application's model, resolved with its
@@ -60,8 +61,8 @@ public function loadAll(string $threadId, ?int $limit = null, ?string $before =
             return $this->deserialize($query->oldest($model->getKeyName())->get(self::COLUMNS));
         }
 
-        // A page is the newest rows before the cursor, returned in insertion order.
-        $query->limit($limit);
+        // A page is the newest rows before the cursor, returned in insertion order; a negative limit is an empty one.
+        $query->limit(max(0, $limit));
 
         return $this->deserialize($query->latest($model->getKeyName())->get(self::COLUMNS)->reverse());
     }
```

**File**: `src/Chat/History/HistoryTrimmer.php` (modified, +49/-57)
```diff
@@ -22,8 +22,11 @@
 use function min;
 
 /**
- * Trims chat history to fit within a context window using checkpoint-based calculation.
- * Checkpoints are assistant messages with usage data.
+ * Trims chat history to fit within a context window. The window budgets the whole
+ * request, as the provider measures it: checkpoints are assistant messages with
+ * usage, whose input covers the instructions and tools sent with them. The total is
+ * the last checkpoint plus an estimate of the later messages, and a cut is priced by
+ * the messages it drops, since instructions and tools stay in the next request.
  */
 class HistoryTrimmer implements HistoryTrimmerInterface
 {
@@ -66,7 +69,7 @@ public function trim(array $messages, int $contextWindow): array
             return $messages;
         }
 
-        $trimPoint = $this->findTrimPoint($messages, $checkpoints, $contextWindow);
+        $trimPoint = $this->findTrimPoint($messages, $contextWindow);
 
         if ($trimPoint['index'] > 0) {
             $trimmedTokens = $trimPoint['tokens'];
@@ -83,7 +86,7 @@ public function trim(array $messages, int $contextWindow): array
 
     /**
      * After a head-trim, the remaining checkpoints still carry the provider's
-     * original cumulative token values; subtract the trimmed tokens from
+     * original cumulative token values; subtract the dropped messages' tokens from
      * inputTokens (cumulative context) — outputTokens is per-message and stays.
      *
      * @param Message[] $messages The remaining messages after trimming
@@ -156,38 +159,34 @@ protected function calculateTotal(array $messages, array $checkpoints, int $coun
 
     /**
      * @param Message[] $messages
-     * @param array<int, array{index: int, tokens: int}> $checkpoints
      * @return array{index: int, tokens: int}
      */
-    protected function findTrimPoint(array $messages, array $checkpoints, int $contextWindow): array
+    protected function findTrimPoint(array $messages, int $contextWindow): array
     {
-        $trimIndex = $this->findTrimIndex($messages, $checkpoints, $contextWindow);
-
-        return $this->adjustTrimIndex($messages, $checkpoints, $trimIndex, $contextWindow);
+        return $this->adjustTrimIndex($messages, $this->findTrimIndex($messages, $contextWindow), $contextWindow);
     }
 
     /**
-     * The smallest cut that fits the window, wherever it lands.
+     * The smallest cut that fits the window, wherever it lands: the oldest messages
+     * whose own tokens cover the excess. The provider's usage measures the whole
+     * request, instructions and tools included, but only messages can be dropped.
      *
      * @param Message[] $messages
-     * @param array<int, array{index: int, tokens: int}> $checkpoints
      */
-    protected function findTrimIndex(array $messages, array $checkpoints, int $contextWindow): int
+    protected function findTrimIndex(array $messages, int $contextWindow): int
     {
-        if ($checkpoints === []) {
-            return $this->findTrimIndexByEstimation($messages, $contextWindow);
-        }
+        $excess = $this->totalTokens - $contextWindow;
+        $dropped = 0;
 
-        $threshold = $this->totalTokens - $contextWindow;
+        foreach ($messages as $index => $message) {
+            $dropped += $this->messageTokens($message);
 
-        foreach ($checkpoints as $checkpoint) {
-            if ($checkpoint['tokens'] >= $threshold) {
-                return $checkpoint['index'] + 1;
+            if ($dropped >= $excess) {
+                return $index + 1;
             }
         }
 
-        // Tail overflow: trim at the last checkpoint
-        return end($checkpoints)['index'] + 1;
+        return count($messages);
     }
 
     /**
@@ -197,30 +196,29 @@ protected function findTrimIndex(array $messages, array $checkpoints, int $conte
      * forward to the next user message. The latest turn is kept however large.
      *
      * @param Message[] $messages
-     * @param arr
```

---

### Incident Patch 8: `3f68b06b` (2026-09-29)
**Commit Message**: fix chat, workflow, and RAG

**File**: `src/Chat/History/FileMessageStore.php` (modified, +36/-3)
```diff
@@ -11,11 +11,13 @@
 use NeuronAI\UniqueIdGenerator;
 
 use function array_filter;
+use function array_is_list;
 use function array_map;
 use function array_values;
 use function date;
 use function file_get_contents;
 use function file_put_contents;
+use function hash;
 use function is_array;
 use function is_dir;
 use function is_file;
@@ -40,12 +42,18 @@
  * controlled single-host use: concurrent workers need a database store. The
  * file name keeps the thread ID's letter case, so on a case-insensitive
  * filesystem (the macOS and Windows defaults) two IDs that differ only by case
- * share one file: use IDs that differ by more than case there.
+ * share one file: use IDs that differ by more than case there. An ID whose
+ * encoded name would pass the 255-byte file-name limit is named by its hash.
  */
 class FileMessageStore implements MessageStoreInterface
 {
     use PaginatesMessages;
 
+    /**
+     * The longest file name ext4, APFS and NTFS accept.
+     */
+    protected const MAX_FILE_NAME_BYTES = 255;
+
     /**
      * @throws ChatHistoryException
      */
@@ -150,7 +158,7 @@ protected function read(string $threadId): array
         }
 
         $entries = json_decode($content, true);
-        if (!is_array($entries)) {
+        if (!$this->isEntryList($entries)) {
             throw new ChatHistoryException("The chat history file '{$path}' is corrupt.");
         }
 
@@ -161,6 +169,24 @@ protected function read(string $threadId): array
         return $entries;
     }
 
+    /**
+     * A thread file holds a list of message objects.
+     */
+    protected function isEntryList(mixed $entries): bool
+    {
+        if (!is_array($entries) || !array_is_list($entries)) {
+            return false;
+        }
+
+        foreach ($entries as $entry) {
+            if (!is_array($entry)) {
+                return false;
+            }
+        }
+
+        return true;
+    }
+
     /**
      * @param array<int, array<string, mixed>> $entries
      * @throws ChatHistoryException
@@ -208,6 +234,13 @@ protected function deserialize(array $entries): array
 
     protected function path(string $threadId): string
     {
-        return $this->directory . DIRECTORY_SEPARATOR . $this->prefix . rawurlencode($threadId) . $this->ext;
+        $name = $this->prefix . rawurlencode($threadId) . $this->ext;
+
+        // Too long to spell out: rawurlencode() escapes '+', so a hashed name never matches an encoded one
+        if (strlen($name) > self::MAX_FILE_NAME_BYTES) {
+            $name = $this->prefix . '+' . hash('sha256', $threadId) . $this->ext;
+        }
+
+        return $this->directory . DIRECTORY_SEPARATOR . $name;
     }
 }
```

**File**: `src/Chat/History/HistoryTrimmer.php` (modified, +3/-25)
```diff
@@ -17,7 +17,6 @@
 use function array_slice;
 use function count;
 use function end;
-use function spl_object_hash;
 use function sprintf;
 use function max;
 use function min;
@@ -36,11 +35,6 @@ class HistoryTrimmer implements HistoryTrimmerInterface
 
     protected int $totalTokens = 0;
 
-    /** @var array<int, array{index: int, tokens: int}> */
-    protected array $cachedCheckpoints = [];
-    protected ?int $cachedCount = null;
-    protected ?string $cachedLastHash = null;
-
     public function __construct(
         protected TokenCounter $tokenCounter = new TokenCounter()
     ) {
@@ -64,11 +58,8 @@ public function trim(array $messages, int $contextWindow): array
             return [];
         }
 
-        $count = count($messages);
-        $hash = spl_object_hash($messages[$count - 1]);
-
-        $checkpoints = $this->getCheckpoints($messages, $count, $hash);
-        $this->totalTokens = $this->calculateTotal($messages, $checkpoints, $count);
+        $checkpoints = $this->getCheckpoints($messages);
+        $this->totalTokens = $this->calculateTotal($messages, $checkpoints, count($messages));
 
         if ($this->totalTokens <= $contextWindow) {
             $this->validateAlternation($messages);
@@ -115,11 +106,6 @@ protected function normalizeCheckpoints(array $messages, int $trimmedTokens): vo
                 ));
             }
         }
-
-        // Checkpoint values changed, so the cache is stale
-        $this->cachedCount = null;
-        $this->cachedLastHash = null;
-        $this->cachedCheckpoints = [];
     }
 
     /**
@@ -128,12 +114,8 @@ protected function normalizeCheckpoints(array $messages, int $trimmedTokens): vo
      * @param Message[] $messages
      * @return array<int, array{index: int, tokens: int}>
      */
-    protected function getCheckpoints(array $messages, int $count, string $hash): array
+    protected function getCheckpoints(array $messages): array
     {
-        if ($count === $this->cachedCount && $hash === $this->cachedLastHash) {
-            return $this->cachedCheckpoints;
-        }
-
         $checkpoints = [];
 
         foreach ($messages as $index => $message) {
@@ -148,10 +130,6 @@ protected function getCheckpoints(array $messages, int $count, string $hash): ar
             }
         }
 
-        $this->cachedCount = $count;
-        $this->cachedLastHash = $hash;
-        $this->cachedCheckpoints = $checkpoints;
-
         return $checkpoints;
     }
 
```

**File**: `src/Chat/History/TokenCounter.php` (modified, +28/-0)
```diff
@@ -10,6 +10,7 @@
 use NeuronAI\Chat\Messages\ContentBlocks\ReasoningContent;
 use NeuronAI\Chat\Messages\ContentBlocks\TextContent;
 use NeuronAI\Chat\Messages\Message;
+use NeuronAI\Chat\Messages\ToolCallMessage;
 use NeuronAI\Chat\Messages\ToolResultMessage;
 use NeuronAI\Tools\ToolCall;
 
@@ -21,6 +22,11 @@
 use function getimagesizefromstring;
 use function max;
 
+use const JSON_INVALID_UTF8_SUBSTITUTE;
+use const JSON_THROW_ON_ERROR;
+use const JSON_UNESCAPED_SLASHES;
+use const JSON_UNESCAPED_UNICODE;
+
 class TokenCounter
 {
     public function __construct(
@@ -50,6 +56,10 @@ public function count(Message $message): int
             $chars
         );
 
+        if ($message instanceof ToolCallMessage) {
+            $chars += $this->handleToolCalls($message);
+        }
+
         return (int) $this->tokens((int) ceil($chars));
     }
 
@@ -80,6 +90,24 @@ function (int $carry, ToolCall $tool): int {
         return $this->tokens($chars);
     }
 
+    /**
+     * What the model reads of each call: its name, its ID and its arguments.
+     */
+    protected function handleToolCalls(ToolCallMessage $message): int
+    {
+        return array_reduce(
+            $message->getToolCalls(),
+            fn (int $carry, ToolCall $call): int => $carry
+                + mb_strlen($call->getName())
+                + mb_strlen((string) $call->getCallId())
+                + mb_strlen(json_encode(
+                    $call->getInputs(),
+                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR
+                )),
+            0
+        );
+    }
+
     protected function handleTextBlock(TextContent $block): int
     {
         return mb_strlen(json_encode($block->toArray()));
```

**File**: `src/Chat/Messages/MessageDeserializer.php` (modified, +33/-4)
```diff
@@ -21,6 +21,8 @@
 
 use function array_diff_key;
 use function array_flip;
+use function array_is_list;
+use function array_key_exists;
 use function array_map;
 use function is_array;
 use function is_string;
@@ -60,6 +62,7 @@ protected function deserializeMessage(array $message): Message
         $item = match ($role) {
             MessageRole::ASSISTANT => new AssistantMessage($content),
             MessageRole::USER => new UserMessage($content),
+            MessageRole::SYSTEM => new SystemMessage($content),
             default => new Message($role, $content)
         };
 
@@ -180,10 +183,12 @@ protected function deserializeContent(mixed $content): string|ContentBlockInterf
         }
 
         if (is_string($content)) {
-            if ($json = json_decode($content, true)) {
-                return $this->deserializeContent($json);
-            }
-            return new TextContent($content);
+            $decoded = json_decode($content, true);
+
+            // A legacy string is the text itself, unless it is exactly a list of blocks stored encoded
+            return $this->isBlockList($decoded)
+                ? array_map($this->deserializeContentBlock(...), $decoded)
+                : new TextContent($content);
         }
 
         if (is_array($content)) {
@@ -199,6 +204,30 @@ protected function deserializeContent(mixed $content): string|ContentBlockInterf
         return new TextContent((string) $content);
     }
 
+    /**
+     * The blocks this library serializes: a known type each, with their content,
+     * or with a source type for media, whose empty content earlier versions left out.
+     */
+    protected function isBlockList(mixed $value): bool
+    {
+        if (!is_array($value) || $value === [] || !array_is_list($value)) {
+            return false;
+        }
+
+        foreach ($value as $block) {
+            if (
+                !is_array($block)
+                || !is_string($block['type'] ?? null)
+                || ContentBlockType::tryFrom($block['type']) === null
+                || (!array_key_exists('content', $block) && !isset($block['source_type']))
+            ) {
+                return false;
+            }
+        }
+
+        return true;
+    }
+
     /**
      * @param array<string, mixed> $block
      */
```

**File**: `src/RAG/DataLoader/FileDataLoader.php` (modified, +9/-2)
```diff
@@ -14,6 +14,7 @@
 use function is_array;
 use function is_dir;
 use function is_link;
+use function ltrim;
 use function opendir;
 use function pathinfo;
 use function readdir;
@@ -51,15 +52,21 @@ public function addReader(string|array $fileExtension, ReaderInterface $reader):
         $extensions = is_array($fileExtension) ? $fileExtension : [$fileExtension];
 
         foreach ($extensions as $extension) {
-            $this->readers[$extension] = $reader;
+            // Stored the way file extensions are looked up: lowercase, without the dot
+            $this->readers[strtolower(ltrim($extension, '.'))] = $reader;
         }
 
         return $this;
     }
 
     public function setReaders(array $readers): self
     {
-        $this->readers = $readers;
+        $this->readers = [];
+
+        foreach ($readers as $extension => $reader) {
+            $this->addReader((string) $extension, $reader);
+        }
+
         return $this;
     }
 
```

---

### Incident Patch 9: `9b67c01b` (2026-09-29)
**Commit Message**: fix chat, workflow, and tools

**File**: `skills/neuron-agent/SKILL.md` (modified, +4/-2)
```diff
@@ -310,6 +310,8 @@ protected function contextWindow(): int
 $agent->setContextWindow(190_000);
 ```
 
+Keep the window at least 5% below the model's limit, as 190,000 is for a 200,000-token model: rather than drop a whole turn, such as a long tool chain, the history may keep up to 5% more than the window.
+
 `getChatHistory()->getMessages()` returns the model context. To render a whole conversation, read its transcript from the store; message IDs are stable, so they serve as UI keys and page cursors:
 
 ```php
@@ -328,8 +330,8 @@ See [conversation memory](references/conversation-memory.md) for complete retrie
 ### Message Stores
 - `InMemoryMessageStore` - Default, process memory
 - `FileMessageStore` - One JSON file per thread, named with the thread ID's letter case: on macOS and Windows, IDs that differ only by case share a file
-- `SQLMessageStore` - Database-backed (PDO)
-- `EloquentMessageStore` - Laravel Eloquent integration
+- `SQLMessageStore` - Database-backed (PDO). On MySQL and MariaDB, declare `thread_id` and `message_id` as `VARBINARY` (the class docblock shows the table): the default collations ignore case and accents, so `user-Alice` and `user-alice` would share a thread
+- `EloquentMessageStore` - Laravel Eloquent integration. On MySQL and MariaDB, create the ID columns with `$table->binary('thread_id', 255)` and `$table->binary('message_id', 64)` for the same reason; keep `string()` on PostgreSQL and SQLite
 
 ## Content Blocks (Multi-modal)
 
```

**File**: `skills/neuron-workflow/SKILL.md` (modified, +2/-1)
```diff
@@ -205,7 +205,8 @@ final class OrderWorkflow extends Workflow
 $state = OrderWorkflow::make()->run(); // inferred as OrderState
 ```
 
-`Agent` uses the same contract by specializing `Workflow<AgentState>`.
+`Agent` uses the same contract by specializing `Workflow<AgentState>`. A node asking for
+a state class the workflow does not provide fails when the graph is built.
 
 ## Workflow Resources
 
```

**File**: `src/Chat/AGENTS.md` (modified, +3/-1)
```diff
@@ -19,7 +19,7 @@ new UserMessage([
 
 Two parts with different lifetimes:
 
-- `MessageStoreInterface` stores conversations. Every call names its thread (`loadActive()`, `loadAll()`, `append()`, `archive()`, `clear()`), so a store keeps no conversation state and one instance serves the whole process: bind it once in a container. `SQLMessageStore` and `EloquentMessageStore` store one row per message with a `message_id` unique within its thread; the table key orders the thread, so an Eloquent key must follow insertion order (auto-increment, ULID or UUIDv7). `FileMessageStore` keeps one JSON file per thread, replaced atomically on every write, for controlled single-host use. The file name keeps the thread ID's letter case, so on a case-insensitive filesystem (the macOS and Windows defaults) IDs that differ only by case share one file. `InMemoryMessageStore` lives in process memory. Constructing a store performs no I/O.
+- `MessageStoreInterface` stores conversations. Every call names its thread (`loadActive()`, `loadAll()`, `append()`, `archive()`, `clear()`), so a store keeps no conversation state and one instance serves the whole process: bind it once in a container. `SQLMessageStore` and `EloquentMessageStore` store one row per message with a `message_id` unique within its thread; the table key orders the thread, so an Eloquent key must follow insertion order (auto-increment, ULID or UUIDv7). `FileMessageStore` keeps one JSON file per thread, replaced atomically on every write, for controlled single-host use. The file name keeps the thread ID's letter case, so on a case-insensitive filesystem (the macOS and Windows defaults) IDs that differ only by case share one file. The SQL and Eloquent stores leave the comparison to the column: on MySQL and MariaDB the default collations ignore case and accents, so `thread_id` and `message_id` must be `VARBINARY` (the `SQLMessageStore` docblock shows the table), or `user-Alice` and `user-alice` read and clear each other's messages. `InMemoryMessageStore` lives in process memory. Constructing a store performs no I/O.
 - `ChatHistory` is the working context of one conversation for one execution segment: it receives its thread at construction, loads the active messages on first use, keeps them inside the context window with `HistoryTrimmer` (`DEFAULT_CONTEXT_WINDOW`, 50,000 tokens, unless configured), and writes through the store. It is concrete, like Workflow's `WorkflowRunStore` over `PersistenceInterface`: storage varies through the store and trimming through `HistoryTrimmerInterface`, which a composed workflow passes to the constructor (one instance per history, since trimmers are stateful). Open a new history per segment, as the Agent does (`src/Agent/AGENTS.md`); thread identity belongs to the Agent.
 
 A message's identity is `Message::getId()`: assigned at construction, stored with the message and restored on load; `setMetadata()` keeps it. `Message::jsonSerialize()` keeps the message's own fields at the top level (`__id`, `role`, `content`, `usage`, and `type` and `tools` on tool messages) and nests the metadata under `__meta`, so no metadata key can collide with them. `MessageDeserializer` rebuilds messages from that shape for stores and `Trajectory`. It also reads the flat shape of earlier versions, where the metadata sat beside the fields, because stored rows are never rewritten.
@@ -28,6 +28,8 @@ A message's identity is `Message::getId()`: assigned at construction, stored wit
 
 When the trimmer drops the oldest messages from the context, `ChatHistory` archives them in the store instead of deleting them: `archived_at` on the row or file entry, a counted prefix in memory. `loadActive()` returns the unarchived messages; `loadAll()` returns the whole transcript, optionally the `$limit` messages before a message ID, which is how a UI pages backward. `flushAll()` is the one destructive operation: it clears the whole thread, archived messages included. The `Summarization` middleware c
```

**File**: `src/Chat/History/HistoryTrimmer.php` (modified, +80/-51)
```diff
@@ -28,6 +28,12 @@
  */
 class HistoryTrimmer implements HistoryTrimmerInterface
 {
+    /**
+     * How far over the window a trim may keep a whole turn rather than cut at the
+     * next user message: the window should sit at least this far below the model's limit.
+     */
+    protected const OVERFLOW_TOLERANCE = 0.05;
+
     protected int $totalTokens = 0;
 
     /** @var array<int, array{index: int, tokens: int}> */
@@ -103,7 +109,9 @@ protected function normalizeCheckpoints(array $messages, int $trimmedTokens): vo
                 $normalizedInputTokens = max(0, $usage->inputTokens - $trimmedTokens);
                 $message->setUsage(new Usage(
                     $normalizedInputTokens,
-                    $usage->outputTokens
+                    $usage->outputTokens,
+                    $usage->cachedInputTokens,
+                    $usage->reasoningTokens,
                 ));
             }
         }
@@ -174,94 +182,115 @@ protected function calculateTotal(array $messages, array $checkpoints, int $coun
      * @return array{index: int, tokens: int}
      */
     protected function findTrimPoint(array $messages, array $checkpoints, int $contextWindow): array
+    {
+        $trimIndex = $this->findTrimIndex($messages, $checkpoints, $contextWindow);
+
+        return $this->adjustTrimIndex($messages, $checkpoints, $trimIndex, $contextWindow);
+    }
+
+    /**
+     * The smallest cut that fits the window, wherever it lands.
+     *
+     * @param Message[] $messages
+     * @param array<int, array{index: int, tokens: int}> $checkpoints
+     */
+    protected function findTrimIndex(array $messages, array $checkpoints, int $contextWindow): int
     {
         if ($checkpoints === []) {
-            $index = $this->findTrimIndexByEstimation($messages, $contextWindow);
-            return $this->adjustTrimIndex($messages, $index, 0);
+            return $this->findTrimIndexByEstimation($messages, $contextWindow);
         }
 
         $threshold = $this->totalTokens - $contextWindow;
 
         foreach ($checkpoints as $checkpoint) {
             if ($checkpoint['tokens'] >= $threshold) {
-                return $this->adjustTrimIndex(
-                    $messages,
-                    $checkpoint['index'] + 1,
-                    $checkpoint['tokens']
-                );
+                return $checkpoint['index'] + 1;
             }
         }
 
         // Tail overflow: trim at the last checkpoint
-        $lastCheckpoint = end($checkpoints);
-        return $this->adjustTrimIndex(
-            $messages,
-            $lastCheckpoint['index'] + 1,
-            (int)$lastCheckpoint['tokens']
-        );
+        return end($checkpoints)['index'] + 1;
     }
 
     /**
-     * A valid chat history must start with a user message: search outward from
-     * the initial trim index in both directions simultaneously, preferring the
-     * closest UserMessage (backward on tie).
+     * A valid chat history must start with a user message. A cut landing inside
+     * a turn moves back to that turn's user message, keeping the whole turn, when
+     * the kept history stays within the overflow tolerance; otherwise it moves
+     * forward to the next user message. The latest turn is kept however large.
      *
      * @param Message[] $messages
+     * @param array<int, array{index: int, tokens: int}> $checkpoints
      * @return array{index: int, tokens: int}
      */
-    protected function adjustTrimIndex(array $messages, int $trimIndex, int $tokens): array
+    protected function adjustTrimIndex(array $messages, array $checkpoints, int $trimIndex, int $contextWindow): array
     {
-        $count = count($messages);
+        $trimIndex = max(0, min($trimIndex, count($messages) - 1));
 
-        if ($count === 0) {
-            return ['index' => 0, 'tokens' => 0];
+        if ($this->isUserMessage($messages[$trimIndex])) {
+            return $this->cutAt($messages, $checkpoints, $trimIndex);
         }
 
- 
```

**File**: `src/Chat/History/SQLMessageStore.php` (modified, +7/-2)
```diff
@@ -27,10 +27,15 @@
  * their rows, marked by archived_at. The auto-increment id orders the thread;
  * message_id is the message identity.
  *
+ * Thread and message IDs must compare exactly. On MySQL and MariaDB declare them
+ * VARBINARY: the default collations ignore case and accents (MariaDB's also trailing
+ * spaces), so user-Alice and user-alice would read and clear each other's messages.
+ * PostgreSQL and SQLite compare VARCHAR and TEXT exactly.
+ *
  * CREATE TABLE chat_messages (
  * id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
- * thread_id VARCHAR(255) NOT NULL,
- * message_id VARCHAR(64) NOT NULL,
+ * thread_id VARBINARY(255) NOT NULL,
+ * message_id VARBINARY(64) NOT NULL,
  * role VARCHAR(32) NOT NULL,
  * content LONGTEXT NULL,
  * meta LONGTEXT NULL,
```

---

### Incident Patch 10: `af2d5801` (2026-09-29)
**Commit Message**: fix providers, workflow, and tools

**File**: `src/Providers/OpenAI/HandleStructured.php` (modified, +1/-3)
```diff
@@ -56,10 +56,8 @@ public function structured(
 
     protected function sanitizeClassName(string $name): string
     {
-        // Remove anonymous class markers and special characters
-        $name = preg_replace('/class@anonymous.*$/', 'anonymous', $name);
         // Replace any non-alphanumeric characters with underscore
-        $name = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string) $name);
+        $name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
         // Ensure it starts with a letter
         if (preg_match('/^[^a-zA-Z]/', (string) $name)) {
             return 'class_' . $name;
```

**File**: `src/Providers/OpenAI/Responses/HandleStructured.php` (modified, +1/-3)
```diff
@@ -56,10 +56,8 @@ public function structured(
 
     protected function sanitizeClassName(string $name): string
     {
-        // Remove anonymous class markers and special characters
-        $name = preg_replace('/class@anonymous.*$/', 'anonymous', $name);
         // Replace any non-alphanumeric characters with underscore
-        $name = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string) $name);
+        $name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
         // Ensure it starts with a letter
         if (preg_match('/^[^a-zA-Z]/', (string) $name)) {
             return 'class_' . $name;
```

**File**: `tests/Providers/OpenAI/OpenAIChatTest.php` (modified, +0/-9)
```diff
@@ -170,15 +170,6 @@ public function test_structured_sends_a_named_json_schema_response_format(): voi
         ], $this->sentBody()['response_format']);
     }
 
-    public function test_structured_names_anonymous_classes_with_a_valid_identifier(): void
-    {
-        $class = (new class () {})::class;
-
-        $this->provider()->structured(new UserMessage('Who?'), $class, ['type' => 'object']);
-
-        $this->assertSame('anonymous', $this->sentBody()['response_format']['json_schema']['name']);
-    }
-
     public function test_structured_prefixes_schema_names_that_do_not_start_with_a_letter(): void
     {
         $this->provider()->structured(new UserMessage('Who?'), 'App\\Dto\\_Draft', ['type' => 'object']);
```

**File**: `tests/Providers/OpenAI/Responses/OpenAIResponsesChatTest.php` (modified, +1/-2)
```diff
@@ -171,11 +171,10 @@ public function test_strict_structured_mode_forbids_additional_properties_recurs
     {
         $schema = ['type' => 'object', 'properties' => ['address' => ['type' => 'object', 'properties' => []]]];
 
-        $this->provider(strict: true)->structured(new UserMessage('Who?'), (new class () {})::class, $schema);
+        $this->provider(strict: true)->structured(new UserMessage('Who?'), 'Person', $schema);
 
         $format = $this->sentBody()['text']['format'];
         $this->assertTrue($format['strict']);
-        $this->assertSame('anonymous', $format['name']);
         $this->assertFalse($format['schema']['additionalProperties']);
         $this->assertFalse($format['schema']['properties']['address']['additionalProperties']);
     }
```

**File**: `tests/Providers/OpenAI/StructuredSchemaNameInjectionSecurityTest.php` (removed, +0/-62)
```diff
@@ -1,62 +0,0 @@
-<?php
-
-declare(strict_types=1);
-
-namespace NeuronAI\Tests\Providers\OpenAI;
-
-use GuzzleHttp\Psr7\Response;
-use NeuronAI\Chat\Messages\UserMessage;
-use NeuronAI\Providers\OpenAI\OpenAI;
-use NeuronAI\Providers\OpenAI\Responses\OpenAIResponses;
-use NeuronAI\Tests\Support\RecordsHttpRequests;
-use PHPUnit\Framework\TestCase;
-use stdClass;
-
-use function json_decode;
-
-use const JSON_THROW_ON_ERROR;
-
-/**
- * The structured-output schema name is built from a PHP class name. The class
- * name of an anonymous subclass embeds a NUL byte, '@', '/', ':' and '$', none
- * of which OpenAI accepts in a schema name ([a-zA-Z0-9_-] only).
- */
-class StructuredSchemaNameInjectionSecurityTest extends TestCase
-{
-    use RecordsHttpRequests;
-
-    protected const ALLOWED_NAME = '/^[a-zA-Z][a-zA-Z0-9_-]*$/D';
-
-    /**
-     * @return array<string, mixed>
-     */
-    protected function sentBody(): array
-    {
-        return json_decode((string) $this->sentRequests[0]['request']->getBody(), true, flags: JSON_THROW_ON_ERROR);
-    }
-
-    protected function anonymousSubclass(): string
-    {
-        return (new class () extends stdClass {})::class;
-    }
-
-    public function test_chat_completions_schema_name_of_an_anonymous_subclass_uses_only_allowed_characters(): void
-    {
-        $answer = '{"choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":"{}"}}]}';
-        $provider = new OpenAI('sk-test', 'gpt-test', httpClient: $this->recordingClient(new Response(200, body: $answer)));
-
-        $provider->structured(new UserMessage('Who?'), $this->anonymousSubclass(), ['type' => 'object']);
-
-        $this->assertMatchesRegularExpression(self::ALLOWED_NAME, $this->sentBody()['response_format']['json_schema']['name']);
-    }
-
-    public function test_responses_schema_name_of_an_anonymous_subclass_uses_only_allowed_characters(): void
-    {
-        $answer = '{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{}"}]}]}';
-        $provider = new OpenAIResponses('sk-test', 'gpt-test', httpClient: $this->recordingClient(new Response(200, body: $answer)));
-
-        $provider->structured([new UserMessage('Who?')], $this->anonymousSubclass(), ['type' => 'object']);
-
-        $this->assertMatchesRegularExpression(self::ALLOWED_NAME, $this->sentBody()['text']['format']['name']);
-    }
-}
```

#### Recent Merged Pull Requests:
- **PR #667** (2026-09-16): Extract AbstractChannel with buffering, fragments and the lifecycle (@ilvalerione)
- **PR #666** (2026-09-16): Add Redis and Pusher streaming channels (@ilvalerione)
- **PR #663** (2026-09-13): Construct the scoped tool directly where the test expects the constructor to throw (@ilvalerione)
- **PR #662** (2026-09-14): Reset stream adapters at every segment boundary (@ilvalerione)
- **PR #661** (2026-09-13): Stop sending raw exception messages to the client from the built-in adapters (@ilvalerione)
- **PR #660** (2026-09-13): Never let a failing ChannelError listener fail the run (@ilvalerione)
- **PR #659** (2026-09-13): Settle the run as failed when a streaming failure is raised outside the executor (@ilvalerione)
- **PR #658** (2026-09-13): Keep the SSE stream well-formed when an event cannot be encoded (@ilvalerione)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
