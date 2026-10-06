# Forensic Learning Record (Deep Inspection): neuron-core/neuron-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/neuron-core-neuron-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neuron-core/neuron-ai](https://github.com/neuron-core/neuron-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:23.372Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neuron-core/neuron-ai`
- **Description**: The Agentic Framework of the PHP ecosystem to build production-ready AI driven applications. Connect components (LLMs, Tools, vector DBs, memory) to agents that interact with your data and UI.
- **Primary Language / Ecosystem**: PHP
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2124 stars

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
export { subscribeToMercure } from './mercure.js';
export type { MercureSource } from './mercure.js';
export { createProtocolStream } from './protocol.js';
export type { ProtocolEvent } from './protocol.js';

```

### Core Architecture Module: `packages/streaming/src/mercure.ts`
```
import { createChannelConsumer, type ChannelCallbacks } from './consumer.js';

export interface MercureSource {
  addEventListener(type: 'message', listener: (message: { data: unknown }) => void): unknown;
  removeEventListener(type: 'message', listener: (message: { data: unknown }) => void): unknown;
}

/** Subscribe to the updates of a Mercure hub: each one holds a JSON array of envelopes. */
export function subscribeToMercure(
  source: MercureSource,
  callbacks: ChannelCallbacks,
  streamId?: string,
): { close(): void } {
  let closed = false;
  const consumer = createChannelConsumer({ onEvent: callbacks.onEvent, onGap: fail }, streamId);

  function close(): void {
    if (closed) return;
    closed = true;
    source.removeEventListener('message', receive);
    consumer.close();
  }

  function fail(reason: string): void {
    close();
    callbacks.onGap(reason);
  }

  function receive(message: { data: unknown }): void {
    if (closed) return;
    let envelopes: unknown;
    try {
      envelopes = typeof message.data === 'string' ? JSON.parse(message.data) : undefined;
    } catch {
      envelopes = undefined;
    }
    if (!Array.isArray(envelopes)) return fail('Invalid channel envelope');
    try {
      for (const envelope of envelopes) consumer.accept(envelope);
    } catch (error) {
      close();
      throw error;
    }
  }

  source.addEventListener('message', receive);
  return { close };
}

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

### Incident Patch 1: `98a21d64` (2026-10-05)
**Commit Message**: fix prompt caching

**File**: `README.md` (modified, +12/-13)
```diff
@@ -80,20 +80,19 @@ Copy & paste this initial prompt to tell your coding agent how to install and co
 
 ```
 You are going to set up Neuron AI, a PHP framework for building agentic applications,
-in this project, and you must follow three steps in order. First, install the framework:
-check composer.json, and if neuron-core/neuron-ai is not already required,
-run `composer require neuron-core/neuron-ai`. Second, install the agent skills that ship
-with the package by running `npx skills add ./vendor/neuron-core/neuron-ai/skills -y` from
-the project root. The skills are symlinked, so they stay current whenever Neuron is
-updated through Composer. From then on, load the relevant skill before you write any Neuron
-code instead of relying on what you remember about the framework, because your memory may
-describe an older version. Third, work out what kind of app this is. Look at composer.json
-and the project structure to tell whether it is a Laravel app or a Symfony app, then
+in this project, and you must follow three steps in order.
+
+- First, install the framework: check composer.json, and if neuron-core/neuron-ai is not already required, run `composer require neuron-core/neuron-ai`.
+
+- Second, install the agent skills that ship with the package by running `npx skills add ./vendor/neuron-core/neuron-ai/skills -y` from the project root. The skills are symlinked, so they stay current whenever Neuron is
+updated through Composer. From then on, load the relevant skill before you write any Neuron code instead of relying on what you remember about the framework, because your memory may
+describe an older version.
+
+- Third, work out what kind of app this is. Look at composer.json and the project structure to tell whether it is a Laravel app or a Symfony app, then
 activate the matching skill: neuron-laravel-integration or neuron-symfony-integration.
-If Neuron is already part of the app go through the skill's foundations checklist
-item by item. Report what differs from the recommended setup. If Neuron is not
-in the app yet, follow the same checklist to do the first setup. If the app uses
-neither framework, start from a plain PHP agent using the neuron-agent skill.
+
+If Neuron is already part of the app go through the skill's foundations checklist item by item. Report what differs from the recommended setup. If Neuron is not
+in the app yet, follow the same checklist to do the first setup. If the app uses neither framework, start from a plain PHP agent using the neuron-agent skill.
 Finish with a short summary of what you installed and what you found.
 ```
 
```

**File**: `rector.php` (modified, +4/-0)
```diff
@@ -37,6 +37,10 @@
             // Runtime validation of a docblock-only type (list<string>) that callers can still violate.
             __DIR__ . '/src/Classifier/Score.php',
         ],
+        ClassPropertyAssignToConstructorPromotionRector::class => [
+            // A promoted default is not applied on unserialize: a run saved before $context existed must restore.
+            __DIR__ . '/src/Agent/InferenceRequest.php',
+        ],
         Rector\TypeDeclaration\Rector\ClassMethod\ReturnTypeFromReturnNewRector::class => [
             // Fixtures deliberately declare invalid __invoke signatures to test node validation.
             __DIR__ . '/tests/Workflow/NodeSignatureTest.php',
```

**File**: `skills/neuron-agent/SKILL.md` (modified, +53/-7)
```diff
@@ -261,31 +261,63 @@ class WeatherTool extends Tool
 
 ## Agent Instructions
 
-Agent instructions are a `SystemMessage` (`instructions()` returns `SystemMessage|string` — a plain string is wrapped automatically). A `SystemMessage` carries one or more `SystemContent` blocks; mark a block with `->cache()` to enable provider prompt caching on it:
+Agent instructions are a `SystemMessage` (`instructions()` returns `SystemMessage|string` — a plain string is wrapped automatically). A `SystemMessage` carries one or more text blocks; mark a block with `->cache()` to enable provider prompt caching on it:
 
 ```php
 use NeuronAI\Chat\Messages\SystemMessage;
-use NeuronAI\Chat\Messages\ContentBlocks\SystemContent;
+use NeuronAI\Chat\Messages\ContentBlocks\TextContent;
 
 protected function instructions(): SystemMessage|string
 {
     return new SystemMessage([
         // Large static context: cache it to reduce cost and latency.
-        (new SystemContent("You are a data analyst expert in creating reports. ..."))->cache(),
-        // Dynamic part, left uncached.
-        new SystemContent("Today is " . date('Y-m-d')),
+        (new TextContent("You are a data analyst expert in creating reports. ..."))->cache(),
+        // Changes with the tenant, not with every turn: left out of the cached part.
+        new TextContent("Reports are written for {$this->tenant->name}."),
     ]);
 }
 ```
 
-`SystemMessage::cache()` marks all of the message's blocks as cached at once. The marker caches the instructions, not the conversation: on Anthropic the conversation needs a request parameter, see [references/providers.md](references/providers.md).
+`SystemMessage::cache()` caches the whole message: it marks the last block, and one breakpoint there covers every block before it. The blocks of a conversation message take the same marker (see Content Blocks), and [references/providers.md](references/providers.md) says how each provider treats it.
 
 Instructions can also be set fluently:
 
 ```php
 $agent->setInstructions('You are a helpful assistant.');
 ```
 
+## Turn Context
+
+Content that changes from one turn to the next does not belong in the instructions: it would change the start of every request, and a provider caches a request from its start. Return it from the `context()` hook, or pass it to `setContext()` when the Agent is configured from outside:
+
+```php
+use NeuronAI\Chat\Messages\ContentBlocks\TextContent;
+
+protected function context(): array
+{
+    return [new TextContent('Today is ' . date('Y-m-d') . '. The customer is on the Pro plan.')];
+}
+
+// Or, without a subclass:
+$agent->setContext([new TextContent("The user is viewing order {$orderId}.")]);
+```
+
+The context is read when a turn starts and sent in the user's message, after that message's own content, on every request of the turn. It is never stored in the chat history: the next turn sends the earlier message without it. A middleware adds to it through the state, with a key so that an entry written before every model call replaces itself:
+
+```php
+$state->request->context['page'] = new TextContent("The user is viewing: {$url}");
+```
+
+The context is part of the user's turn, so a user can type text that looks like it. When the context decides whether the agent acts, such as a policy that allows a refund tool to run, tell the developer.
+
+To have a provider with cache breakpoints (Anthropic, OpenAI GPT-5.6 and later, Bedrock) reuse the conversation from one turn to the next, mark the user's message. The context comes after the marker and is never written to the cache:
+
+```php
+$agent->chat(new UserMessage((new TextContent($input))->cache()));
+```
+
+A thread that never gets a second turn pays for a cache write nobody reads, so leave the marker out of agents that answer once per thread. [references/providers.md](references/providers.md) has the details for each provider.
+
 ## Chat History & Thread Identity
 
 Conversations are stored through a **message store**, and the Agent opens a working history over it for every execution segment. Declare the conversation identity with `make(workflowId:)` or `setThreadId()`, and give the Agent a store:
@@ -373,6 +405,20 @@ $message = new UserMessage([
 
 Use the `MediaType` enum for common MIME types (images, documents, audio, video). The `mediaType` parameter also accepts a plain string (`'image/x-custom'`) for types not covered by the enum.
 
+Any block takes `->cache()`. It asks the provider for a prompt cache breakpoint right after that block, so the requests that follow reuse everything up to it:
+
+```php
+use NeuronAI\Chat\Messages\ContentBlocks\FileContent;
+
+// A long document discussed over several turns
+$message = new UserMessage([
+    (new FileContent($pdf, SourceType::BASE64, 'application/pdf', 'contract.pdf'))->cache(),
+    new TextContent('Summarise clause 4.'),
+]);
+```
+
+The marker covers everything up to its block. Put it on the last block of a message to reuse the conversation 
```

**File**: `skills/neuron-agent/references/providers.md` (modified, +15/-4)
```diff
@@ -100,16 +100,27 @@ new OpenAIResponses(key: $key, model: $model, parameters: ['reasoning' => ['effo
 new Ollama(url: $url, model: $model, parameters: ['options' => ['temperature' => 0.2, 'num_ctx' => 16384]]);
 ```
 
-`strict_response: true` on the OpenAI family turns on the vendor's strict JSON schema mode for `structured()`; the framework rewrites the schema to satisfy the strict-mode rules. Prompt caching follows the `cache()` marker on system blocks described in the skill: Anthropic turns each cached block into a `cache_control` breakpoint, the OpenAI Responses provider into a `prompt_cache_breakpoint`, and the other providers ignore the marker.
+`strict_response: true` on the OpenAI family turns on the vendor's strict JSON schema mode for `structured()`; the framework rewrites the schema to satisfy the strict-mode rules. Prompt caching follows the `cache()` marker described in the skill, on instruction blocks and on the blocks of conversation messages:
 
-The marker caches the instructions, not the conversation. OpenAI, Gemini and Deepseek cache the conversation on their own. `Anthropic` and `AnthropicVertex` cache it only when the request carries a top-level `cache_control`: Anthropic then places a breakpoint on the last message and moves it forward on every request.
+- `Anthropic` and `AnthropicVertex` turn each marked block into a `cache_control` breakpoint.
+- `OpenAIResponses` turns a marked instruction block or user text into a `prompt_cache_breakpoint`. OpenAI documents it for GPT-5.6 and later, so mark blocks only for those models; a marker on an image or a file is ignored.
+- `BedrockRuntime` adds a `cachePoint` after a marked block of the conversation. Mark blocks only for a model with prompt caching (Claude, Nova). A marker on the instructions is ignored.
+- The other providers ignore the marker.
+
+Anthropic and Bedrock allow four breakpoints in a request. Markers are stored with their messages and add up over a long thread, so beyond four the provider keeps the ones on the instructions and tools, then the most recent of the conversation.
+
+A marker is a fixed point. Marking the last block of each user message reuses the conversation from one turn to the next (see Turn Context in the skill). The growing end of a request, the steps of a tool loop, is cached without markers: OpenAI, Gemini and Deepseek do it on their own, `Anthropic` and `AnthropicVertex` only when the request carries a top-level `cache_control`. Anthropic then places a breakpoint on the last block of the request and moves it forward on every request.
 
 ```php
-// Anthropic: cache the conversation too, next to the cached system blocks
+// Anthropic: also cache the steps of a tool loop, next to the marked blocks
 new Anthropic(key: $key, model: $model, parameters: ['cache_control' => ['type' => 'ephemeral']]);
 ```
 
-A cache write costs 1.25 times the input price and a read 0.1 times, so this pays off when later requests reuse the conversation within five minutes, as in tool loops and multi-turn chats. An agent that answers in one request, or a RAG agent without tools, pays for the write and never reads it back. This breakpoint takes one of the four Anthropic allows per request, so mark at most three system blocks with `cache()`; a fourth fails the request. Add `'ttl' => '1h'` only when no system block is cached: `cache()` writes five-minute breakpoints, and Anthropic requires the longer TTL to come first.
+A cache write costs 1.25 times the input price and a read 0.1 times, so this breakpoint pays off when the next request follows within five minutes and reuses what was written, as the steps of a tool loop do. On a turn answered in one request it writes the turn context and reads nothing back: an agent without tools, RAG included, should rely on the marked user message alone. This breakpoint takes one of the four slots, leaving three for marked blocks. Add `'ttl' => '1h'` only when no block is marked: `cache()` writes five-minute breakpoints, and Anthropic requires the longer TTL to come first.
+
+Tool definitions are part of the start of a request, where a provider's cache begins, so a request reuses only what was cached with the same tool list. With a tool added, removed, reordered or reworded, it reads nothing from the cache and is written to it again, as Anthropic and OpenAI both document. Keep the tool list the same on every request of a thread. `ToolSearchMiddleware` changes it by design: the tools a search finds join the list for the rest of the turn, and the next user message starts without them. The request after a search that found new tools is a full cache write. The next turn goes back to the shorter list and reuses only what earlier requests wrote with that same list, typically the conversation up to the previous question.
+
+With every tool listed up front, the definitions are written once and read on each request after that. So with caching on, tool search costs less for a pool of hundreds of tools, and a
```

**File**: `skills/neuron-rag/SKILL.md` (modified, +11/-1)
```diff
@@ -14,7 +14,17 @@ AgentStartEvent → PreProcessNode → RetrievalNode → PostProcessNode → Ins
 1. Pre-process the user question (query rewriting/expansion)
 2. Retrieve relevant documents from the vector store
 3. Post-process (re-rank, filter by score)
-4. Build document-enriched instructions and run the normal inference
+4. Send the documents with the question, as context of the turn, and run the normal inference
+
+The documents are not added to the instructions and not stored in the chat history. They reach the model in the question's own message, after the question, inside `<EXTRA-CONTEXT>` tags:
+
+```
+system   <your instructions>
+user     <the question>
+         <EXTRA-CONTEXT> ...retrieved documents... </EXTRA-CONTEXT>
+```
+
+Write instructions that fit this position, such as "answer from the context that follows the question". When nothing is retrieved, the question is sent alone. Because the instructions no longer change with each question, they and the conversation can be cached: see "Turn context" in the `neuron-agent` skill.
 
 ## Core Components
 
```

**File**: `src/Agent/AGENTS.md` (modified, +12/-2)
```diff
@@ -36,7 +36,7 @@ $state = YouTubeAgent::make()
 echo $state->getMessage()->getContent();
 ```
 
-Every hook has a setter twin for fluent definition (`setAiProvider()`, `setInstructions()`, `setTools()`, `setMessageStore()`, `setContextWindow()`, `setHistoryTrimRatio()`, `setPersistence()`; `toolErrorHandler()` for the `resolveToolErrorHandler()` hook), and an explicit setter wins over the hook. `setTools([...])` replaces the entire tool set, including defaults from `tools()` and earlier additions; `setTools([])` clears it. `addTool()` appends to the chosen set, retaining hook defaults only when `setTools()` has never been called. Tool changes apply to the next execution segment. A plain string from `instructions()` is wrapped in a `SystemMessage`; `->cache()` marks its blocks for provider-side prompt caching. `SystemPrompt` is a small helper to compose a structured prompt (background, steps, output).
+Every hook has a setter twin for fluent definition (`setAiProvider()`, `setInstructions()`, `setTools()`, `setMessageStore()`, `setContextWindow()`, `setHistoryTrimRatio()`, `setContext()`, `setPersistence()`; `toolErrorHandler()` for the `resolveToolErrorHandler()` hook), and an explicit setter wins over the hook. `setTools([...])` replaces the entire tool set, including defaults from `tools()` and earlier additions; `setTools([])` clears it. `addTool()` appends to the chosen set, retaining hook defaults only when `setTools()` has never been called. Tool changes apply to the next execution segment. A plain string from `instructions()` is wrapped in a `SystemMessage`; `->cache()` marks its last block for provider-side prompt caching, which covers the whole message. `SystemPrompt` is a small helper to compose a structured prompt (background, steps, output).
 
 | Verb | Nature |
 |---|---|
@@ -132,7 +132,7 @@ Output nodes are ordinary durable steps: if one fails, `run()` recovers the turn
 
 ### Middleware
 
-Register with `addMiddleware(NodeClass::class, $middleware)`; matching is `instanceof`, so `InferenceNode::class` (the base of `ChatNode` and `StructuredOutputNode`, both always registered) is the target for mode-agnostic inference middleware such as `Summarization`. Register a middleware that contributes tools, such as `ToolSearchMiddleware`, with `addGlobalMiddleware()`: a continuation can start at `ToolNode`, which must find the tools the model was offered before the pause. Extend `AgentMiddleware` for typed hooks: `beforeAgentNode()` / `afterAgentNode()` receive `AgentNodeInterface`, `AgentState` and `AgentResources`, and `onAgentContextMismatch()` fires on misattachment (empty by default, override it to fail loudly). Middleware read the segment's history, provider, instructions and tools from `AgentResources`, never from their own constructor. `Summarization` calls the segment's provider unless it is given its own (`new Summarization($cheaperProvider)`); it sets its own prompt and clears the provider's tools for that call. Flow control and I/O stay in nodes: tool approval, once a middleware, lives in `ToolNode`, and to-do planning is a toolkit, `TodoPlanningToolkit`.
+Register with `addMiddleware(NodeClass::class, $middleware)`; matching is `instanceof`, so `InferenceNode::class` (the base of `ChatNode` and `StructuredOutputNode`, both always registered) is the target for mode-agnostic inference middleware such as `Summarization`. Register a middleware that contributes tools, such as `ToolSearchMiddleware`, with `addGlobalMiddleware()`: a continuation can start at `ToolNode`, which must find the tools the model was offered before the pause. `ToolSearchMiddleware` appends the tools a search finds to the segment's registry, and the next user message starts without them. Tool definitions are the start of the request a provider caches, so a request reuses only what was cached under the same tool list: each search that finds new tools costs a full cache write, and a new turn reuses only what earlier requests wrote with the base list. Extend `AgentMiddleware` for typed hooks: `beforeAgentNode()` / `afterAgentNode()` receive `AgentNodeInterface`, `AgentState` and `AgentResources`, and `onAgentContextMismatch()` fires on misattachment (empty by default, override it to fail loudly). Middleware read the segment's history, provider, instructions and tools from `AgentResources`, never from their own constructor. `Summarization` calls the segment's provider unless it is given its own (`new Summarization($cheaperProvider)`); it sets its own prompt and clears the provider's tools for that call. Flow control and I/O stay in nodes: tool approval, once a middleware, lives in `ToolNode`, and to-do planning is a toolkit, `TodoPlanningToolkit`.
 
 ## Chat history is a service, not state
 
@@ -145,6 +145,16 @@ History is a resource of the segment (`AgentResources::$history`), never carried
 - Durable workflow persistence needs a comparably durable store: `InMemoryMessageStore` loses the thread across processes.
 - `AgentSt
```

**File**: `src/Agent/Agent.php` (modified, +40/-5)
```diff
@@ -20,7 +20,8 @@
 use NeuronAI\Chat\History\ChatHistory;
 use NeuronAI\Chat\History\InMemoryMessageStore;
 use NeuronAI\Chat\History\MessageStoreInterface;
-use NeuronAI\Chat\Messages\ContentBlocks\SystemContent;
+use NeuronAI\Chat\Messages\ContentBlocks\ContentBlockInterface;
+use NeuronAI\Chat\Messages\ContentBlocks\TextContent;
 use NeuronAI\Chat\Messages\Message;
 use NeuronAI\Chat\Messages\SystemMessage;
 use NeuronAI\Chat\Messages\ToolCallMessage;
@@ -70,6 +71,11 @@ class Agent extends Workflow implements AgentInterface
 
     protected ?float $historyTrimRatio = null;
 
+    /**
+     * @var array<int|string, ContentBlockInterface>|null
+     */
+    protected ?array $context = null;
+
     protected bool $parallelToolCalls = false;
 
     protected ?Closure $beforeParallelToolChild = null;
@@ -166,6 +172,29 @@ public function setHistoryTrimRatio(float $ratio): static
         return $this;
     }
 
+    /**
+     * What changes from one turn to the next and the model should know: the date,
+     * the page the user is on, their plan. A turn takes it when it starts and sends
+     * it with its question, after the question's own content, on every request of
+     * the turn. It is never stored, and it keeps such content out of the instructions,
+     * which a provider can then cache. An explicit setContext() wins over this hook.
+     *
+     * @return array<int|string, ContentBlockInterface>
+     */
+    protected function context(): array
+    {
+        return [];
+    }
+
+    /**
+     * @param array<int|string, ContentBlockInterface> $context
+     */
+    public function setContext(array $context): static
+    {
+        $this->context = $context;
+        return $this;
+    }
+
     /**
      * A fresh view of the conversation on every call: every execution segment
      * opens its own. Nodes and middleware read the history of the node they wrap;
@@ -186,15 +215,21 @@ final public function getChatHistory(): ChatHistory
     }
 
     /**
-     * The provider, the conversation, the instructions and the tools, built
-     * fresh for every execution segment. Toolkits are flattened into their
+     * The provider, the conversation, the instructions, the context of a turn
+     * and the tools, built fresh for every execution segment. Toolkits are flattened into their
      * tools and their guidelines join the instructions.
      */
     protected function resources(): AgentResources
     {
         [$instructions, $tools] = $this->resolveTools();
 
-        return new AgentResources($this->getProvider(), $this->getChatHistory(), $instructions, new ToolRegistry($tools));
+        // Copies: a run may edit its context without touching the configured blocks
+        $context = array_map(
+            static fn (ContentBlockInterface $block): ContentBlockInterface => clone $block,
+            $this->context ?? $this->context(),
+        );
+
+        return new AgentResources($this->getProvider(), $this->getChatHistory(), $instructions, new ToolRegistry($tools), $context);
     }
 
     /**
@@ -224,7 +259,7 @@ protected function resolveTools(): array
         $blocks = unserialize(serialize($this->getInstructions()))->getContentBlocks();
 
         if ($guidelines !== []) {
-            $blocks[] = new SystemContent(
+            $blocks[] = new TextContent(
                 '<TOOLS-GUIDELINES>'.PHP_EOL.implode(PHP_EOL.PHP_EOL, $guidelines).PHP_EOL.'</TOOLS-GUIDELINES>'
             );
         }
```

**File**: `src/Agent/AgentResources.php` (modified, +7/-1)
```diff
@@ -5,22 +5,28 @@
 namespace NeuronAI\Agent;
 
 use NeuronAI\Chat\History\ChatHistory;
+use NeuronAI\Chat\Messages\ContentBlocks\ContentBlockInterface;
 use NeuronAI\Chat\Messages\SystemMessage;
 use NeuronAI\Providers\AIProviderInterface;
 use NeuronAI\Tools\ToolRegistry;
 use NeuronAI\Workflow\WorkflowResources;
 
 /**
  * What an agent run can use in one execution segment. The run's own working
- * prompt lives in the state; these instructions are the base it starts from.
+ * prompt lives in the state; these instructions and this context are the base
+ * a turn starts from.
  */
 class AgentResources extends WorkflowResources
 {
+    /**
+     * @param array<int|string, ContentBlockInterface> $context
+     */
     public function __construct(
         public readonly AIProviderInterface $provider,
         public readonly ChatHistory $history,
         public readonly SystemMessage $instructions,
         public readonly ToolRegistry $tools = new ToolRegistry(),
+        public readonly array $context = [],
     ) {
         parent::__construct();
     }
```

---

### Incident Patch 2: `4dcc949b` (2026-10-05)
**Commit Message**: fix prompt caching

**File**: `skills/neuron-agent/SKILL.md` (modified, +15/-1)
```diff
@@ -278,7 +278,7 @@ protected function instructions(): SystemMessage|string
 }
 ```
 
-`SystemMessage::cache()` marks all of the message's blocks as cached at once.
+`SystemMessage::cache()` marks all of the message's blocks as cached at once. The marker caches the instructions, not the conversation: on Anthropic the conversation needs a request parameter, see [references/providers.md](references/providers.md).
 
 Instructions can also be set fluently:
 
@@ -316,6 +316,20 @@ $agent->setContextWindow(190_000);
 
 The window covers the whole request: instructions, tool definitions and messages, as the provider's usage reports them. Keep it at least 5% below the model's limit, as 190,000 is for a 200,000-token model: rather than drop a whole turn, the history may keep up to 5% more than the window.
 
+When the conversation outgrows the window, its oldest turns are archived until it fits half the window again. The cut is deep on purpose: providers cache a request from its start, so a history that drops its oldest turn at every message is never served from the prompt cache. The `historyTrimRatio()` hook, or `setHistoryTrimRatio()`, sets the share of the window a cut frees (`0.5` by default, from 0 up to, not including, 1):
+
+```php
+protected function historyTrimRatio(): float
+{
+    return 0.2;
+}
+
+// Or, without a subclass:
+$agent->setHistoryTrimRatio(0.2);
+```
+
+A lower ratio keeps more of the conversation after a cut and moves the first message more often; `0` makes the smallest cut that fits. On a very large window a low ratio is enough: `0.1` of 1,000,000 tokens already frees 100,000.
+
 `getChatHistory()->getMessages()` returns the model context. To render a whole conversation, read its transcript from the store; message IDs are stable, so they serve as UI keys and page cursors:
 
 ```php
```

**File**: `skills/neuron-agent/references/providers.md` (modified, +9/-0)
```diff
@@ -102,6 +102,15 @@ new Ollama(url: $url, model: $model, parameters: ['options' => ['temperature' =>
 
 `strict_response: true` on the OpenAI family turns on the vendor's strict JSON schema mode for `structured()`; the framework rewrites the schema to satisfy the strict-mode rules. Prompt caching follows the `cache()` marker on system blocks described in the skill: Anthropic turns each cached block into a `cache_control` breakpoint, the OpenAI Responses provider into a `prompt_cache_breakpoint`, and the other providers ignore the marker.
 
+The marker caches the instructions, not the conversation. OpenAI, Gemini and Deepseek cache the conversation on their own. `Anthropic` and `AnthropicVertex` cache it only when the request carries a top-level `cache_control`: Anthropic then places a breakpoint on the last message and moves it forward on every request.
+
+```php
+// Anthropic: cache the conversation too, next to the cached system blocks
+new Anthropic(key: $key, model: $model, parameters: ['cache_control' => ['type' => 'ephemeral']]);
+```
+
+A cache write costs 1.25 times the input price and a read 0.1 times, so this pays off when later requests reuse the conversation within five minutes, as in tool loops and multi-turn chats. An agent that answers in one request, or a RAG agent without tools, pays for the write and never reads it back. This breakpoint takes one of the four Anthropic allows per request, so mark at most three system blocks with `cache()`; a fourth fails the request. Add `'ttl' => '1h'` only when no system block is cached: `cache()` writes five-minute breakpoints, and Anthropic requires the longer TTL to come first.
+
 ## HTTP client
 
 Every HTTP-based provider builds a `CurlHttpClient` unless one is passed as `httpClient` or installed later with `setHttpClient()`. Use the client for proxies and CA bundles (`curlOptions`), for request and response taps (`onRequest()` / `onResponse()`), or to swap the transport:
```

**File**: `src/Agent/AGENTS.md` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ $state = YouTubeAgent::make()
 echo $state->getMessage()->getContent();
 ```
 
-Every hook has a setter twin for fluent definition (`setAiProvider()`, `setInstructions()`, `setTools()`, `setMessageStore()`, `setContextWindow()`, `setPersistence()`; `toolErrorHandler()` for the `resolveToolErrorHandler()` hook), and an explicit setter wins over the hook. `setTools([...])` replaces the entire tool set, including defaults from `tools()` and earlier additions; `setTools([])` clears it. `addTool()` appends to the chosen set, retaining hook defaults only when `setTools()` has never been called. Tool changes apply to the next execution segment. A plain string from `instructions()` is wrapped in a `SystemMessage`; `->cache()` marks its blocks for provider-side prompt caching. `SystemPrompt` is a small helper to compose a structured prompt (background, steps, output).
+Every hook has a setter twin for fluent definition (`setAiProvider()`, `setInstructions()`, `setTools()`, `setMessageStore()`, `setContextWindow()`, `setHistoryTrimRatio()`, `setPersistence()`; `toolErrorHandler()` for the `resolveToolErrorHandler()` hook), and an explicit setter wins over the hook. `setTools([...])` replaces the entire tool set, including defaults from `tools()` and earlier additions; `setTools([])` clears it. `addTool()` appends to the chosen set, retaining hook defaults only when `setTools()` has never been called. Tool changes apply to the next execution segment. A plain string from `instructions()` is wrapped in a `SystemMessage`; `->cache()` marks its blocks for provider-side prompt caching. `SystemPrompt` is a small helper to compose a structured prompt (background, steps, output).
 
 | Verb | Nature |
 |---|---|
@@ -136,7 +136,7 @@ Register with `addMiddleware(NodeClass::class, $middleware)`; matching is `insta
 
 ## Chat history is a service, not state
 
-The Agent receives a message store (`messageStore()` hook, `setMessageStore()`; in-memory by default, retained per instance) and builds a working history over it at the start of every execution segment. Size the conversation sent to the model with the `contextWindow()` hook or `setContextWindow()` (`ChatHistory::DEFAULT_CONTEXT_WINDOW`, 50,000 tokens, by default). The store is the part to share: bind one instance in the container. Each segment loads the conversation fresh, so a long-lived Agent sees the turns other workers added. `getChatHistory()` returns a fresh view on every call and is final, so no override can retain a history across segments; nodes and middleware read the segment's history from `AgentResources`, and writing through the Agent's view while an execution runs is unsupported. See `src/Chat/AGENTS.md` for the store and history contracts.
+The Agent receives a message store (`messageStore()` hook, `setMessageStore()`; in-memory by default, retained per instance) and builds a working history over it at the start of every execution segment. Size the conversation sent to the model with the `contextWindow()` hook or `setContextWindow()` (`ChatHistory::DEFAULT_CONTEXT_WINDOW`, 50,000 tokens, by default), and how far a full conversation is cut back with the `historyTrimRatio()` hook or `setHistoryTrimRatio()` (half the window by default, see `src/Chat/AGENTS.md`). The store is the part to share: bind one instance in the container. Each segment loads the conversation fresh, so a long-lived Agent sees the turns other workers added. `getChatHistory()` returns a fresh view on every call and is final, so no override can retain a history across segments; nodes and middleware read the segment's history from `AgentResources`, and writing through the Agent's view while an execution runs is unsupported. See `src/Chat/AGENTS.md` for the store and history contracts.
 
 History is a resource of the segment (`AgentResources::$history`), never carried in `AgentState`, so per-step snapshots stay O(1) instead of embedding the conversation. Consequences:
 
```

**File**: `src/Agent/Agent.php` (modified, +38/-4)
```diff
@@ -25,6 +25,7 @@
 use NeuronAI\Chat\Messages\SystemMessage;
 use NeuronAI\Chat\Messages\ToolCallMessage;
 use NeuronAI\Exceptions\AgentException;
+use NeuronAI\Exceptions\ChatHistoryException;
 use NeuronAI\Exceptions\InputTranslationException;
 use NeuronAI\Exceptions\WorkflowException;
 use NeuronAI\Agent\Interrupt\Action;
@@ -67,6 +68,8 @@ class Agent extends Workflow implements AgentInterface
 
     protected ?int $contextWindow = null;
 
+    protected ?float $historyTrimRatio = null;
+
     protected bool $parallelToolCalls = false;
 
     protected ?Closure $beforeParallelToolChild = null;
@@ -145,17 +148,40 @@ public function setContextWindow(int $tokens): static
         return $this;
     }
 
+    /**
+     * The share of the context window freed when the conversation outgrows it,
+     * from 0 up to, not including, 1. A larger share keeps less of the conversation
+     * after a cut but leaves the first message in place for more turns, which is
+     * what a provider's prompt cache needs; 0 makes the smallest cut that fits.
+     * An explicit setHistoryTrimRatio() wins over this hook.
+     */
+    protected function historyTrimRatio(): float
+    {
+        return ChatHistory::DEFAULT_HISTORY_TRIM_RATIO;
+    }
+
+    public function setHistoryTrimRatio(float $ratio): static
+    {
+        $this->historyTrimRatio = $ratio;
+        return $this;
+    }
+
     /**
      * A fresh view of the conversation on every call: every execution segment
      * opens its own. Nodes and middleware read the history of the node they wrap;
      * writing through this view while an execution is running is unsupported.
+     *
+     * @throws AgentException
+     * @throws ChatHistoryException
+     * @throws WorkflowException
      */
     final public function getChatHistory(): ChatHistory
     {
         return new ChatHistory(
-            $this->resolveMessageStore(),
-            $this->requireWorkflowId(),
-            $this->contextWindow ?? $this->contextWindow()
+            store: $this->resolveMessageStore(),
+            threadId: $this->requireWorkflowId(),
+            contextWindow: $this->contextWindow ?? $this->contextWindow(),
+            historyTrimRatio: $this->historyTrimRatio ?? $this->historyTrimRatio(),
         );
     }
 
@@ -228,6 +254,7 @@ public function resetConversation(): static
      * call in the next inference's context.
      *
      * @throws AgentException
+     * @throws ChatHistoryException
      */
     public function abandon(?string $expectedRunId = null, ?int $expectedExecutionAttempt = null): bool
     {
@@ -288,18 +315,25 @@ protected function entryNodes(): array
         return [new AgentStartNode()];
     }
 
+    /**
+     * @throws WorkflowException
+     */
     public function getThreadId(): ?string
     {
         return $this->getWorkflowId();
     }
 
+    /**
+     * @throws WorkflowException
+     */
     public function setThreadId(string $threadId): static
     {
         return $this->setWorkflowId($threadId);
     }
 
     /**
      * @throws AgentException
+     * @throws WorkflowException
      */
     protected function requireWorkflowId(): string
     {
@@ -383,7 +417,7 @@ protected function getOutputClass(): string
      * The tool calls still awaiting a human decision on the current interruption.
      *
      * @return Action[]
-     * @throws AgentException
+     * @throws WorkflowException
      */
     public function pendingApprovals(): array
     {
```

**File**: `src/Chat/AGENTS.md` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ When the trimmer drops the oldest messages from the context, `ChatHistory` archi
 
 The window budgets the whole request. The provider's usage, recorded on each answer, covers the instructions and tools sent with it, so they count without the history knowing them; before the first answer the messages are estimated alone. A cut is priced by the messages it drops, the provider's output tokens for a measured answer and an estimate otherwise, since instructions and tools stay in the next request. The cut falls where the fewest messages go for the rest to fit the window, but a trimmed history must start with a plain `UserMessage`. When that point lands inside a turn, the trimmer keeps the whole turn if the history stays within 5% over the window (`HistoryTrimmer::OVERFLOW_TOLERANCE`), and otherwise cuts at the next user message, so a long tool chain is not dropped to save a few tokens. The latest turn is kept however large. Set the window at least 5% below the model's limit.
 
+A cut goes deeper than the window needs. Once the trimmer drops something, `ChatHistory` asks it again to fit `contextWindow × (1 − historyTrimRatio)`: the constructor's fifth argument, `DEFAULT_HISTORY_TRIM_RATIO` (half the window) by default, from 0 up to, not including, 1. A provider's prompt cache matches a request from its start, so a history that loses its oldest turn on every append is never served from it; after a deeper cut the first message stays in place for many turns. `0` keeps the smallest cut. A custom trimmer is therefore called a second time, on its own result and with the smaller size.
+
 `calculateTotalUsage()` measures the active messages on demand, so a freshly loaded history reports its real size.
 
 ### Invariants
```

**File**: `src/Chat/History/ChatHistory.php` (modified, +24/-1)
```diff
@@ -10,6 +10,7 @@
 
 use function count;
 use function end;
+use function sprintf;
 
 use const PHP_INT_MAX;
 
@@ -22,19 +23,34 @@
  */
 class ChatHistory implements JsonSerializable
 {
-    public const DEFAULT_CONTEXT_WINDOW = 50_000;
+    public const DEFAULT_CONTEXT_WINDOW = 100_000;
+
+    /**
+     * The share of the context window a trim frees. Half the window leaves room
+     * for many turns before the first message moves again; 0 cuts just under it.
+     */
+    public const DEFAULT_HISTORY_TRIM_RATIO = 0.5;
 
     /**
      * @var Message[]|null the active messages, null until loaded
      */
     protected ?array $messages = null;
 
+    /**
+     * @throws ChatHistoryException
+     */
     public function __construct(
         protected MessageStoreInterface $store,
         protected string $threadId,
         protected int $contextWindow = self::DEFAULT_CONTEXT_WINDOW,
         protected HistoryTrimmerInterface $trimmer = new HistoryTrimmer(),
+        protected float $historyTrimRatio = self::DEFAULT_HISTORY_TRIM_RATIO,
     ) {
+        if ($historyTrimRatio < 0 || $historyTrimRatio >= 1) {
+            throw new ChatHistoryException(
+                sprintf('The history trim ratio must be at least 0 and lower than 1, got %s.', $historyTrimRatio)
+            );
+        }
     }
 
     public function getThreadId(): string
@@ -61,6 +77,13 @@ public function addMessage(Message $message): self
         $messages[] = $message;
         $trimmed = $this->trimmer->trim($messages, $this->contextWindow);
 
+        // A cut goes on down to the trim ratio. The turns that follow then append
+        // without moving the first message, so a provider's prompt cache, which
+        // matches a request from its start, keeps serving the conversation.
+        if (count($trimmed) < count($messages)) {
+            $trimmed = $this->trimmer->trim($trimmed, (int) ($this->contextWindow * (1 - $this->historyTrimRatio)));
+        }
+
         // Once appended, the store's active messages equal $messages, so archiving
         // the oldest ones removes exactly what the trimmer dropped.
         $this->store->append($this->threadId, $message);
```

**File**: `src/Chat/Messages/ContentBlocks/SystemContent.php` (modified, +4/-1)
```diff
@@ -9,7 +9,10 @@
 
 class SystemContent extends TextContent implements Stringable
 {
-    protected bool $cached = false;
+    public function __construct(string $content, protected bool $cached = false)
+    {
+        parent::__construct($content);
+    }
 
     public function getType(): ContentBlockType
     {
```

**File**: `src/Providers/OpenAI/Responses/OpenAIResponses.php` (modified, +0/-8)
```diff
@@ -160,14 +160,6 @@ protected function attachSystemPrompt(array &$body, SystemMessage $system): void
             'content' => $content,
         ]);
         $body['input'] = $input;
-
-        $promptCacheOptions = is_array($body['prompt_cache_options'] ?? null)
-            ? $body['prompt_cache_options']
-            : [];
-        $body['prompt_cache_options'] = [
-            ...$promptCacheOptions,
-            'mode' => 'explicit',
-        ];
     }
 
     protected function messageMapper(): MessageMapperInterface
```

---

### Incident Patch 3: `988a2b64` (2026-10-04)
**Commit Message**: fixes

**File**: `phpstan.neon` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@ parameters:
         return: 100
         param: 100
         property: 100
-        declare: 100
         constant: 0
 
 
```

**File**: `skills/neuron-tool/SKILL.md` (modified, +11/-0)
```diff
@@ -518,6 +518,17 @@ JinaToolkit::make($key)
     ->with(JinaUrlReader::class, fn (ToolInterface $tool): ToolInterface => $tool->setName('jina_url_reader')),
 ```
 
+### Adding Tools to a Toolkit
+
+`add()` appends tools to the ones a toolkit provides, without subclassing it:
+
+```php
+MySQLToolkit::make($pdo)
+    ->add(new SalesReportTool($pdo), new ExportCsvTool($pdo)),
+```
+
+Added tools follow the provided ones and are covered by the toolkit's guidelines. `only()`, `exclude()` and `with()` apply to them too, so an `only()` list must name an added tool's class to keep it.
+
 ## MCP (Model Context Protocol) Integration
 
 MCP allows connecting to external tool servers. Each server tool becomes a regular Neuron tool whose result is a `ToolOutput`: text, image and audio content become content blocks, other content reaches the model as JSON text, and a result the server marks with `isError` is an error output.
```

**File**: `src/RAG/VectorStore/ChromaVectorStore.php` (modified, +8/-6)
```diff
@@ -34,9 +34,6 @@ class ChromaVectorStore implements VectorStoreInterface
 
     protected string $collectionId;
 
-    /**
-     * @throws HttpException
-     */
     public function __construct(
         protected string $collection,
         string $host = 'http://localhost:8000',
@@ -54,17 +51,19 @@ public function __construct(
             'Content-Type' => 'application/json',
             ...(!is_null($this->key) && $this->key !== '' ? ['Authorization' => 'Bearer '.$this->key] : []),
         ];
-
-        $this->initialize();
     }
 
     /**
-     * Create the collection if it doesn't exist
+     * Create the collection if it doesn't exist, the first time an operation needs it
      *
      * @throws HttpException
      */
     protected function initialize(): void
     {
+        if (isset($this->collectionId)) {
+            return;
+        }
+
         $response = $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/'),
@@ -97,6 +96,7 @@ public function addDocument(Document $document): VectorStoreInterface
     public function delete(FilterExpression $filters): VectorStoreInterface
     {
         $this->validateFilters($filters);
+        $this->initialize();
         $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/') . "/{$this->collectionId}/delete",
@@ -128,6 +128,7 @@ public function destroy(): void
     public function addDocuments(array $documents): VectorStoreInterface
     {
         $this->validateDocuments($documents);
+        $this->initialize();
         $chunks = array_chunk($documents, 100);
 
         foreach ($chunks as $chunk) {
@@ -164,6 +165,7 @@ public function search(SearchRequest $request): iterable
             $body['where'] = (new ChromaFilterCompiler())->compile($request->filters);
         }
 
+        $this->initialize();
         $response = $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/') . "/{$this->collectionId}/query",
```

**File**: `src/RAG/VectorStore/FileVectorStore.php` (modified, +14/-1)
```diff
@@ -66,7 +66,17 @@ public function __construct(
         if (in_array($fileName, ['', '.', '..'], true) || strpbrk($fileName, "/\\\0") !== false) {
             throw new VectorStoreException("Store name '{$fileName}' must be a file name, not a path: put folders in \$directory.");
         }
-        if (!is_dir($this->directory) && !@mkdir($this->directory, 0o755, true)) {
+    }
+
+    /**
+     * Create the directory and the store file if they don't exist, the first time an operation needs them
+     *
+     * @throws VectorStoreException
+     */
+    protected function initialize(): void
+    {
+        // Checked again after a failed mkdir(): another process on its first operation may have just created it
+        if (!is_dir($this->directory) && !@mkdir($this->directory, 0o755, true) && !is_dir($this->directory)) {
             throw new VectorStoreException("Directory '{$this->directory}' does not exist and could not be created.");
         }
         if (!file_exists($this->getFilePath()) && !@touch($this->getFilePath())) {
@@ -93,6 +103,7 @@ public function addDocuments(array $documents): VectorStoreInterface
         // Encoded outside the appendToFile() arguments: on PHP 8.1 a first-class callable that throws
         // while nested in a pending method call's arguments double-frees the documents (segfault)
         $rows = implode('', array_map($this->encodeRow(...), $documents));
+        $this->initialize();
         $this->appendToFile($rows);
         return $this;
     }
@@ -106,6 +117,7 @@ public function delete(FilterExpression $filters): VectorStoreInterface
         $this->validateFilters($filters);
         (new FilterEvaluator())->assertEvaluable($filters);
 
+        $this->initialize();
         $this->exclusively(function () use ($filters): void {
             $this->rewriteWithout($filters);
         });
@@ -129,6 +141,7 @@ public function search(SearchRequest $request): array
             $evaluator->assertEvaluable($filters);
         }
 
+        $this->initialize();
         foreach ($this->getLine($this->getFilePath()) as $document) {
             $document = json_decode((string) $document, true);
 
```

**File**: `src/RAG/VectorStore/MeilisearchVectorStore.php` (modified, +21/-4)
```diff
@@ -34,10 +34,8 @@ class MeilisearchVectorStore implements VectorStoreInterface
 
     protected string $baseUri;
 
-    /**
-     * @throws HttpException
-     * @throws VectorStoreException
-     */
+    protected bool $initialized = false;
+
     public function __construct(
         protected string $indexUid,
         string $host = 'http://localhost:7700',
@@ -55,6 +53,19 @@ public function __construct(
             'Content-Type' => 'application/json',
             ...(is_null($key) ? [] : ['Authorization' => "Bearer {$key}"]),
         ];
+    }
+
+    /**
+     * Create the index if it doesn't exist and configure it, the first time an operation needs it
+     *
+     * @throws HttpException
+     * @throws VectorStoreException
+     */
+    protected function initialize(): void
+    {
+        if ($this->initialized) {
+            return;
+        }
 
         try {
             $this->httpClient->request(HttpRequest::get(uri: rtrim($this->baseUri, '/') . "/indexes/{$this->indexUid}", headers: $this->httpHeaders));
@@ -67,6 +78,8 @@ public function __construct(
         }
 
         $this->configureIndex();
+
+        $this->initialized = true;
     }
 
     /**
@@ -85,6 +98,7 @@ public function addDocument(Document $document): VectorStoreInterface
     public function addDocuments(array $documents): VectorStoreInterface
     {
         $this->validateDocuments($documents);
+        $this->initialize();
         $chunks = array_chunk($documents, 100);
 
         foreach ($chunks as $chunk) {
@@ -115,10 +129,12 @@ public function addDocuments(array $documents): VectorStoreInterface
     /**
      * @throws HttpException
      * @throws DocumentSchemaException
+     * @throws VectorStoreException
      */
     public function delete(FilterExpression $filters): VectorStoreInterface
     {
         $this->validateFilters($filters);
+        $this->initialize();
         $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/') . "/indexes/{$this->indexUid}/documents/delete",
@@ -156,6 +172,7 @@ public function search(SearchRequest $request): iterable
             $body['filter'] = (new MeilisearchFilterCompiler())->compile($request->filters);
         }
 
+        $this->initialize();
         $response = $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/') . "/indexes/{$this->indexUid}/search",
```

**File**: `src/RAG/VectorStore/QdrantVectorStore.php` (modified, +14/-8)
```diff
@@ -29,9 +29,8 @@ class QdrantVectorStore implements VectorStoreInterface
 
     protected string $baseUri;
 
-    /**
-     * @throws HttpException
-     */
+    protected bool $initialized = false;
+
     public function __construct(
         string $collectionUrl, // like http://localhost:6333/collections/neuron-ai/
         protected ?string $key = null,
@@ -47,24 +46,28 @@ public function __construct(
             'Content-Type' => 'application/json',
             ...(!is_null($this->key) && $this->key !== '' ? ['api-key' => $this->key] : []),
         ];
-
-        $this->initialize();
     }
 
     /**
+     * Create the collection if it doesn't exist, the first time an operation needs it
+     *
      * @throws HttpException
      */
     protected function initialize(): void
     {
+        if ($this->initialized) {
+            return;
+        }
+
         $response = $this->httpClient->request(
             HttpRequest::get(uri: rtrim($this->baseUri, '/') . '/exists', headers: $this->httpHeaders)
         )->json();
 
-        if ($response['result']['exists']) {
-            return;
+        if (!$response['result']['exists']) {
+            $this->createCollection();
         }
 
-        $this->createCollection();
+        $this->initialized = true;
     }
 
     /**
@@ -93,6 +96,7 @@ public function addDocument(Document $document): VectorStoreInterface
     public function addDocuments(array $documents): VectorStoreInterface
     {
         $this->validateDocuments($documents);
+        $this->initialize();
         $points = array_map(fn (Document $document): array => [
             // Qdrant ids are unsigned integers or UUIDs: an integer must stay one
             'id' => $document->getId(),
@@ -123,6 +127,7 @@ public function addDocuments(array $documents): VectorStoreInterface
     public function delete(FilterExpression $filters): VectorStoreInterface
     {
         $this->validateFilters($filters);
+        $this->initialize();
         $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/') . '/points/delete?wait=true',
@@ -159,6 +164,7 @@ public function search(SearchRequest $request): iterable
             $body['filter'] = ['must' => (new QdrantFilterCompiler())->compile($request->filters)];
         }
 
+        $this->initialize();
         $response = $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/') . '/points/query',
```

**File**: `src/RAG/VectorStore/WeaviateVectorStore.php` (modified, +13/-7)
```diff
@@ -39,9 +39,8 @@ class WeaviateVectorStore implements VectorStoreInterface
 
     protected string $baseUri;
 
-    /**
-     * @throws HttpException
-     */
+    protected bool $initialized = false;
+
     public function __construct(
         protected string $collection,
         string $host = 'http://localhost:8080',
@@ -57,20 +56,24 @@ public function __construct(
             'Content-Type' => 'application/json',
             ...(!is_null($this->key) && $this->key !== '' ? ['Authorization' => 'Bearer '.$this->key] : []),
         ];
-
-        $this->initialize();
     }
 
     /**
+     * Create the collection if it doesn't exist, the first time an operation needs it
+     *
      * @throws HttpException
      */
     protected function initialize(): void
     {
-        if ($this->collectionExists()) {
+        if ($this->initialized) {
             return;
         }
 
-        $this->createCollection();
+        if (!$this->collectionExists()) {
+            $this->createCollection();
+        }
+
+        $this->initialized = true;
     }
 
     /**
@@ -100,6 +103,7 @@ public function addDocument(Document $document): VectorStoreInterface
     public function addDocuments(array $documents): VectorStoreInterface
     {
         $this->validateDocuments($documents);
+        $this->initialize();
         $objects = array_map(fn (Document $document): array => [
             'class' => ucfirst($this->collection),
             'id' => (string) $document->getId(),
@@ -135,6 +139,7 @@ public function addDocuments(array $documents): VectorStoreInterface
     public function delete(FilterExpression $filters): VectorStoreInterface
     {
         $this->validateFilters($filters);
+        $this->initialize();
         $this->httpClient->request(
             HttpRequest::delete(
                 uri: rtrim($this->baseUri, '/') . '/v1/batch/objects',
@@ -192,6 +197,7 @@ public function search(SearchRequest $request): iterable
             $where,
         );
 
+        $this->initialize();
         $response = $this->httpClient->request(
             HttpRequest::post(
                 uri: rtrim($this->baseUri, '/') . '/v1/graphql',
```

**File**: `src/Tools/AGENTS.md` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ class GetTranscriptionTool extends Tool
 }
 ```
 
-Toolkits (`AbstractToolkit`) group tools and contribute `guidelines()` to the system prompt; `only()` / `exclude()` / `with()` adjust the provided set per agent. Tool names must be unique among an agent's tools: `ToolRegistry` throws `ToolException` when it is built with two tools of the same name, as when the Tavily and Jina toolkits both provide `web_search` and `url_reader`, while `add()` ignores a tool already registered. Unnamed provider tools never clash. Tool runs are counted by `getRunKey()`, the tool name by default, so `toolMaxRuns()` applies per tool over the entire agent run, including interruptions; override it, or use the `TrackByInputs` trait, which keys runs by the declared inputs in declaration order, for parameter-aware limits.
+Toolkits (`AbstractToolkit`) group tools and contribute `guidelines()` to the system prompt; `add()` appends tools to the provided set, and `only()` / `exclude()` / `with()` adjust it per agent. Tool names must be unique among an agent's tools: `ToolRegistry` throws `ToolException` when it is built with two tools of the same name, as when the Tavily and Jina toolkits both provide `web_search` and `url_reader`, while `ToolRegistry::add()` ignores a tool already registered. Unnamed provider tools never clash. Tool runs are counted by `getRunKey()`, the tool name by default, so `toolMaxRuns()` applies per tool over the entire agent run, including interruptions; override it, or use the `TrackByInputs` trait, which keys runs by the declared inputs in declaration order, for parameter-aware limits.
 
 ## Deferred tools
 
```

---

### Incident Patch 4: `6e510191` (2026-10-04)
**Commit Message**: fix anthropic on vertex provider

**File**: `src/Providers/Anthropic/AnthropicVertex.php` (modified, +2/-3)
```diff
@@ -24,7 +24,7 @@ class AnthropicVertex extends Anthropic
      * @param array<string, mixed> $parameters
      */
     public function __construct(
-        string $pathJsonCredentials,
+        protected string $pathJsonCredentials,
         ?string $location,
         string $projectId,
         protected string $model,
@@ -36,15 +36,14 @@ public function __construct(
             ? "https://{$location}-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/{$location}/publishers/anthropic/models"
             : "https://aiplatform.googleapis.com/v1/projects/{$projectId}/locations/global/publishers/anthropic/models";
 
-        $this->useServiceAccount($pathJsonCredentials);
-
         // Initialize the parent provider. The parent's x-api-key/anthropic-version
         // headers are replaced below; Vertex authenticates with a Bearer token
         // (see requestHeaders()) and reads the version from the body (see requestBody()).
         parent::__construct(
             key: $this->key,
             model: $model,
             version: 'vertex-2023-10-16',
+            parameters: $parameters,
         );
 
         // CurlHttpClient always suppresses "Expect: 100-continue", which Vertex rejects.
```

**File**: `src/Providers/Gemini/GeminiVertex.php` (modified, +1/-3)
```diff
@@ -18,7 +18,7 @@ class GeminiVertex extends Gemini
      * @param array<string, mixed> $parameters
      */
     public function __construct(
-        string $pathJsonCredentials,
+        protected string $pathJsonCredentials,
         ?string $location,
         string $projectId,
         protected string $model,
@@ -30,8 +30,6 @@ public function __construct(
             ? "https://{$location}-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/{$location}/publishers/google/models"
             : "https://aiplatform.googleapis.com/v1/projects/{$projectId}/locations/global/publishers/google/models";
 
-        $this->useServiceAccount($pathJsonCredentials);
-
         // Bearer token authentication (see requestHeaders()), no x-goog-api-key
         $this->httpClient = $httpClient ?? new CurlHttpClient();
         $this->httpHeaders = [
```

**File**: `src/Providers/HandleGoogleServiceAccount.php` (modified, +7/-6)
```diff
@@ -12,17 +12,17 @@
  * Bearer authentication for the Google Vertex providers. Service-account
  * tokens expire after about an hour, so the token is fetched on demand and
  * renewed shortly before it expires: long-lived processes keep working, and
- * building the provider needs no network.
+ * building the provider needs neither the network nor the credentials file.
  */
 trait HandleGoogleServiceAccount
 {
     protected ServiceAccountCredentials $credentials;
 
-    protected function useServiceAccount(string $pathJsonCredentials): void
+    protected function credentials(): ServiceAccountCredentials
     {
-        $this->credentials = new ServiceAccountCredentials(
+        return $this->credentials ??= new ServiceAccountCredentials(
             'https://www.googleapis.com/auth/cloud-platform',
-            $pathJsonCredentials
+            $this->pathJsonCredentials
         );
     }
 
@@ -36,11 +36,12 @@ protected function requestHeaders(): array
 
     protected function accessToken(): string
     {
-        $token = $this->credentials->getLastReceivedToken();
+        $credentials = $this->credentials();
+        $token = $credentials->getLastReceivedToken();
 
         // A 60-second margin keeps a token from expiring while a request is in flight
         if ($token === null || ($token['expires_at'] ?? 0) - 60 <= time()) {
-            $token = $this->credentials->fetchAuthToken();
+            $token = $credentials->fetchAuthToken();
         }
 
         return $token['access_token'];
```

**File**: `tests/Providers/Anthropic/AnthropicVertexCredentialsTest.php` (modified, +31/-0)
```diff
@@ -16,8 +16,10 @@
 use PHPUnit\Framework\TestCase;
 
 use function array_map;
+use function file_get_contents;
 use function file_put_contents;
 use function iterator_to_array;
+use function json_decode;
 use function json_encode;
 use function openssl_pkey_export;
 use function openssl_pkey_new;
@@ -104,13 +106,42 @@ public function test_requests_target_the_location_endpoint_with_the_fetched_bear
         $this->assertFalse($request->hasHeader('anthropic-version'));
     }
 
+    public function test_parameters_are_sent_in_the_request_body(): void
+    {
+        $provider = new AnthropicVertex(
+            pathJsonCredentials: $this->credentialsFile,
+            location: 'us-east5',
+            projectId: 'test-project',
+            model: 'claude-test',
+            parameters: ['temperature' => 0.1],
+            httpClient: $this->recordingClient(new Response(200, body: self::ANSWER)),
+        );
+
+        $provider->chat(new UserMessage('Hi'));
+
+        $body = json_decode((string) $this->sentRequests[0]['request']->getBody(), true);
+        $this->assertSame(0.1, $body['temperature']);
+    }
+
     public function test_building_the_provider_fetches_no_token(): void
     {
         $this->provider();
 
         $this->assertSame(1, $this->tokenEndpoint->count());
     }
 
+    public function test_building_the_provider_reads_no_credentials_file(): void
+    {
+        $credentials = file_get_contents($this->credentialsFile);
+        unlink($this->credentialsFile);
+        $provider = $this->provider();
+
+        file_put_contents($this->credentialsFile, $credentials);
+        $provider->chat(new UserMessage('Hi'));
+
+        $this->assertSame(['Bearer ya29.vertex-token'], $this->sentAuthorizations());
+    }
+
     public function test_a_valid_access_token_is_reused_across_requests(): void
     {
         $provider = $this->provider(new Response(200, body: self::ANSWER), new Response(200, body: 'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}' . "\n\n" . 'data: {"type":"message_stop"}' . "\n\n"));
```

**File**: `tests/Providers/Gemini/GeminiVertexTest.php` (modified, +19/-0)
```diff
@@ -19,6 +19,7 @@
 
 use function base64_decode;
 use function explode;
+use function file_get_contents;
 use function file_put_contents;
 use function iterator_to_array;
 use function json_decode;
@@ -117,6 +118,24 @@ public function test_building_the_provider_fetches_no_token(): void
         $this->assertSame([], $this->tokenRequests);
     }
 
+    public function test_building_the_provider_reads_no_credentials_file(): void
+    {
+        $credentials = file_get_contents($this->credentialsPath);
+        unlink($this->credentialsPath);
+        $provider = new GeminiVertex(
+            $this->credentialsPath,
+            'us-central1',
+            'my-project',
+            'gemini-2.5-pro',
+            httpClient: $this->recordingClient(new Response(200, body: self::ANSWER)),
+        );
+
+        file_put_contents($this->credentialsPath, $credentials);
+        $provider->chat(new UserMessage('Hi'));
+
+        $this->assertSame('Bearer '.self::ACCESS_TOKEN, $this->sentRequests[0]['request']->getHeaderLine('Authorization'));
+    }
+
     public function test_token_is_obtained_with_a_signed_service_account_assertion(): void
     {
         $provider = new GeminiVertex(
```

**File**: `upgrade/43-provider-subclasses.md` (modified, +2/-2)
```diff
@@ -58,7 +58,7 @@ grep -rnE 'this->(url|version)([^A-Za-z0-9_(]|$)' --include='*.php' --exclude-di
 # 8. Case 9
 grep -rnE 'function (createAssistantMessage|processToolCallDelta)[[:space:]]*\(' --include='*.php' --exclude-dir=vendor .
 # 9. Case 10
-grep -rnE 'function (newToolCall|decodeToolArguments|earlyEndResponse|applyStreamMetadata|requestBody|attachSystemPrompt|createImageContent|handlePart|describeBlockedPrompt|useServiceAccount|accessToken|extractContent|contentBlocks|getToolCall|setStopReason|stopReason|decodeBase64|stripNullableTypes|prompt|voiceUri|audioFilePart|openAudioFile|decodeAudio|audioExtension)[[:space:]]*\(|(public|protected|private)[^;(]*\$(credentials|stopReason)([^A-Za-z0-9_]|$)|CONVERSE_FORMATS' --include='*.php' --exclude-dir=vendor .
+grep -rnE 'function (newToolCall|decodeToolArguments|earlyEndResponse|applyStreamMetadata|requestBody|attachSystemPrompt|createImageContent|handlePart|describeBlockedPrompt|credentials|accessToken|extractContent|contentBlocks|getToolCall|setStopReason|stopReason|decodeBase64|stripNullableTypes|prompt|voiceUri|audioFilePart|openAudioFile|decodeAudio|audioExtension)[[:space:]]*\(|(public|protected|private)[^;(]*\$(pathJsonCredentials|credentials|stopReason)([^A-Za-z0-9_]|$)|CONVERSE_FORMATS' --include='*.php' --exclude-dir=vendor .
 ```
 
 How to follow the hits:
@@ -605,7 +605,7 @@ Matching signatures silently replace the framework's method.
 | `applyStreamMetadata()` | `OpenAI` and its subclasses |
 | `requestBody()`, `attachSystemPrompt()`, `createImageContent()` | `OpenAIResponses`, `OpenAILikeResponses` |
 | `handlePart()`, `describeBlockedPrompt()` | `Gemini`, `GeminiVertex` |
-| `useServiceAccount()`, `accessToken()`, property `$credentials` | `AnthropicVertex`, `GeminiVertex` |
+| `credentials()`, `accessToken()`, properties `$pathJsonCredentials` and `$credentials` | `AnthropicVertex`, `GeminiVertex` |
 | `extractContent()` | `Mistral` |
 | `contentBlocks()` | `Ollama` |
 | `getToolCall()`, `setStopReason()`, `stopReason()`, property `$stopReason` | `BasicStreamState` and every provider `StreamState` except `Ollama\StreamState` |
```

---

### Incident Patch 5: `752491a6` (2026-10-03)
**Commit Message**: fixes

**File**: `packages/streaming/test/consumer.test.mjs` (modified, +1/-1)
```diff
@@ -322,7 +322,7 @@ test('protocol streams report gaps and stop a slow reader from buffering indefin
   assert.equal(missing.closes(), 1);
   for (const payload of [{ small: true }, { large: 'a'.repeat(1024 * 1024) }]) {
     const c = protocol();
-    for (let sequence = 0; sequence <= 1024 && !c.closes(); ++sequence) c.accept(frame(sequence, payload));
+    for (let sequence = 0; sequence < 2048 && !c.closes(); ++sequence) c.accept(frame(sequence, payload));
     await assert.rejects(collect(c.stream), /Protocol stream buffer limit exceeded/);
     assert.equal(c.closes(), 1);
   }
```

---

### Incident Patch 6: `1f8c1066` (2026-10-03)
**Commit Message**: fixes

**File**: `.github/workflows/frontend-release.yml` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ concurrency:
 jobs:
   verify:
     runs-on: ubuntu-latest
+    timeout-minutes: 15
     outputs:
       dist-tag: ${{ steps.release.outputs.dist-tag }}
     steps:
```

**File**: `bin/neuron` (modified, +3/-2)
```diff
@@ -35,8 +35,9 @@ if ($autoloadFile !== null) {
     require_once $autoloadFile;
 }
 
-// Find default autoloader
-$defaultAutoload = current(array_filter([
+// Composer's bin proxy names the project autoloader: the relative guesses only
+// serve a direct run, and miss it when the package is symlinked into vendor
+$defaultAutoload = $GLOBALS['_composer_autoload_path'] ?? current(array_filter([
     __DIR__ . '/../vendor/autoload.php',
     __DIR__ . '/../../../autoload.php',
     __DIR__ . '/../../../../autoload.php',
```

**File**: `composer.json` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@
         "ext-sodium": "End-to-end encryption for Pusher streaming channels.",
         "psr/log": "Logging observability events through LogListener.",
         "pusher/pusher-php-server": "Pusher-compatible streaming channels, including encrypted channels (requires >=7.2.4 for HTTP timeout propagation).",
-        "spatie/fork": "Parallel evaluation runs via the --concurrency option (requires ext-pcntl)."
+        "spatie/fork": "Parallel evaluation runs via the --concurrency option (requires ext-pcntl and ext-posix)."
     },
     "config": {
         "sort-packages": true,
```

**File**: `skills/neuron-agent/SKILL.md` (modified, +1/-1)
```diff
@@ -403,7 +403,7 @@ $agent->subscribe(ObservabilityEvent::class, new LogListener($logger));
 Use **neuron-monitoring** for event selection, external dispatchers, and Neuron Cloud integration.
 
 ### Parallel Tool Calls
-Execute local tools in parallel (requires `pcntl` and `spatie/fork`):
+Execute local tools in parallel (requires `pcntl`, `posix` and `spatie/fork`):
 
 ```php
 $agent->parallelToolCalls(true);
```

**File**: `skills/neuron-evaluation/SKILL.md` (modified, +2/-2)
```diff
@@ -600,7 +600,7 @@ vendor/bin/neuron evaluation --help
 ```
 
 **`--concurrency=N`** runs each evaluator's dataset items in N parallel processes.
-Requires the `pcntl` extension and `spatie/fork`; if unavailable, the runner prints a
+Requires the `pcntl` and `posix` extensions and `spatie/fork`; if unavailable, the runner prints a
 notice and falls back to sequential execution. The same option exists
 programmatically: `$runner->run($evaluator, concurrency: 4)`.
 
@@ -1066,7 +1066,7 @@ public function evaluate(mixed $output, array $datasetItem): void
 ## CLI Generation
 
 ```bash
-vendor/bin/neuron make:evaluators MyEvaluator
+vendor/bin/neuron make:evaluators 'App\Evaluators\MyEvaluator'
 ```
 
 ## Testing Evaluators
```

**File**: `skills/neuron-laravel-integration/SKILL.md` (modified, +9/-4)
```diff
@@ -33,7 +33,7 @@ Rules that decide correctness:
 
 When the app has no Neuron integration yet, lay these foundations before building the feature the user asked for, in this order, and skip each one that already exists. Check first: in an integrated app `grep -rlsE 'NeuronServiceProvider|workflow_store|RunInFlightException|neuron:evaluate' bootstrap/app.php bootstrap/providers.php database/migrations app/Console` lists `bootstrap/app.php`, `bootstrap/providers.php`, the migration and the command (in a fresh app, nothing), `app/Neuron` holds the agents and `config/services.php` their provider's key.
 
-**1. Install.** `spatie/fork` lets evaluations run items in parallel; without it `--concurrency` runs sequentially. It needs `ext-pcntl` and `ext-sockets`, and the evaluation command's child hooks need `ext-posix`. A `--dev` install is enough for evaluations; queue workers that use `parallelToolCalls()` need it without `--dev`, or their tool calls run one after another.
+**1. Install.** `spatie/fork` lets evaluations run items in parallel; without it `--concurrency` runs sequentially. It needs `ext-pcntl` and `ext-sockets`, and Neuron forks only when `ext-posix` is loaded too. A `--dev` install is enough for evaluations; queue workers that use `parallelToolCalls()` need it without `--dev`, or their tool calls run one after another.
 
 ```bash
 composer require neuron-core/neuron-ai
@@ -116,6 +116,10 @@ use NeuronAI\Exceptions\WorkflowException;
     // The first callback whose type matches wins: the most specific class goes first.
     $exceptions->render(fn (InputTranslationException $e) => response()->json(['message' => $e->getMessage()], 400));
     $exceptions->render(fn (PersistenceException $e) => response()->json(['message' => 'Conversations are unavailable. Retry later.'], 503));
+    // A database error is not a Neuron exception; null leaves the application's other routes to Laravel.
+    $exceptions->render(fn (PDOException $e, Request $request) => $request->is('chat/*')
+        ? response()->json(['message' => 'Conversations are unavailable. Retry later.'], 503)
+        : null);
     $exceptions->render(fn (RunInFlightException $e) => response()->json(
         ['message' => 'The conversation is busy.', 'status' => $e->status->value],
         409,
@@ -132,7 +136,8 @@ use NeuronAI\Exceptions\WorkflowException;
 | Exception | Status | When |
 |---|---|---|
 | `InputTranslationException` | 400 | Malformed or stale input: no persisted run, unknown call ID, bad AG-UI seed or tool. Its message is safe for clients |
-| `PersistenceException` | 503 | A corrupted record, MySQL without strict mode, a Redis persistence error. A database error through `DatabasePersistence` surfaces as a plain `PDOException` (500) |
+| `PersistenceException` | 503 | A corrupted record, MySQL without strict mode, a Redis persistence error |
+| `PDOException` on `chat/*` | 503 | The database is unreachable or a query fails: `DatabasePersistence` and `EloquentMessageStore` pass driver errors on as they are, and Laravel's `QueryException` is a `PDOException`. The application's own queries on the agent routes are covered too; every other route keeps Laravel's handling |
 | `RunInFlightException` | 409 | An approval is pending (`status: suspended`), or a turn is executing (`status: running`, with `Retry-After` from the lease) |
 | other `WorkflowException` | 409 | A stale continuation or a race between two tabs; its message carries internals, keep it off the wire |
 
@@ -148,7 +153,7 @@ use NeuronAI\Exceptions\WorkflowException;
 
 ## The Agent
 
-Replace the generated body: the stub hard-codes `key: 'ANTHROPIC_KEY'`. Stores arrive through the constructor, the provider is built from config in its hook.
+Replace the generated body: the stub reads the key and the model from `$_ENV`. Stores arrive through the constructor, the provider is built from config in its hook.
 
 ```php
 namespace App\Neuron\Agents;
@@ -640,7 +645,7 @@ Laravel's dispatcher is not PSR-14: forward Neuron's events through a small brid
 
 ## Evaluation
 
-Evaluators are Neuron classes: `App\Neuron\Evaluators` in `app/Neuron/Evaluators`, their JSON datasets in `app/Neuron/Evaluators/datasets`. `vendor/bin/neuron make:evaluators 'App\Neuron\Evaluators\OrderAnswerEvaluator'` writes the class there; replace its body. `App\` already autoloads them and the command finds them by directory, so `composer.json` needs no entry. The generator reads only the `autoload` section of `composer.json`: in a Laravel app an `autoload-dev` layout (`evaluators/`, `tests/Evaluators`) never receives the file.
+Evaluators are Neuron classes: `App\Neuron\Evaluators` in `app/Neuron/Evaluators`, their JSON datasets in `app/Neuron/Evaluators/datasets`. `vendor/bin/neuron make:evaluators 'App\Neuron\Evaluators\OrderAnswerEvaluator'` writes the class there; replace its body. `App\` already autoloads them and the command finds them by directory, so `composer.json` needs no entry.
 
 `neuron:evalu
```

**File**: `skills/neuron-laravel-integration/references/evaluation.md` (modified, +1/-1)
```diff
@@ -336,6 +336,6 @@ Observed with eight items, `--concurrency=4`, MySQL 8.4, and a parent process th
 | keep the inherited PDOs, then `DB::purge()` | all passed, each on its own connection | same session and connection ID as before |
 | `afterChild` disconnecting | — | MySQL counted no aborted clients (eight without it) |
 
-`spatie/fork` ends every child with `SIGKILL` when `ext-posix` is loaded, so the PDOs kept in `$inherited` are never destroyed there. Without `ext-posix` a child ends with `exit()`, which destroys them: the items still passed, but the parent's session was closed as with `DB::purge()` only.
+`spatie/fork` ends every child with `SIGKILL`, so the PDOs kept in `$inherited` are never destroyed there. That takes `ext-posix`: without it a child would end with `exit()` and destroy them, so the runner does not fork and `--concurrency` runs sequentially.
 
 The hooks replace the connections Laravel's `DB` manager holds, not a PDO an object captured in the parent. The container's `DatabasePersistence` is one: kept on an evaluator's agent, all eight items failed ("MySQL server has gone away", "Premature end of data", "Packets out of order") and the parent's connection was left answering wrong (`Schema::hasTable()` returned false for an existing table). Built inside `run()`, in the child, the same persistence passed. Evaluators keep `InMemoryPersistence`.
```

**File**: `skills/neuron-symfony-integration/SKILL.md` (modified, +9/-3)
```diff
@@ -38,7 +38,7 @@ composer require neuron-core/neuron-ai
 composer require --dev spatie/fork
 ```
 
-`spatie/fork` (with `ext-pcntl` and `ext-sockets`, plus `ext-posix` so forked children end with `SIGKILL`) runs evaluation items in parallel; without it `--concurrency` prints a notice and runs sequentially. `--dev` is enough for evaluations; workers that use `parallelToolCalls()` need it without `--dev`, or their tool calls run one after another. The features below also use `doctrine/doctrine-bundle` and `doctrine/doctrine-migrations-bundle` with a `pdo_*` driver, `symfony/security-bundle`, `symfony/uid` (thread and run IDs), `symfony/messenger` with a transport (`symfony/redis-messenger` here), and for delivery `ext-redis` or `symfony/mercure-bundle`. They assume a Doctrine `App\Entity\User` with an integer ID behind the firewall: `php bin/console make:user`, then `#[ORM\Table(name: 'app_user')]` on the entity (`user` is reserved on PostgreSQL).
+`spatie/fork` (with `ext-pcntl` and `ext-sockets`, plus `ext-posix` so forked children end with `SIGKILL`) runs evaluation items in parallel; without any of them `--concurrency` prints a notice and runs sequentially. `--dev` is enough for evaluations; workers that use `parallelToolCalls()` need it without `--dev`, or their tool calls run one after another. The features below also use `doctrine/doctrine-bundle` and `doctrine/doctrine-migrations-bundle` with a `pdo_*` driver, `symfony/security-bundle`, `symfony/uid` (thread and run IDs), `symfony/messenger` with a transport (`symfony/redis-messenger` here), and for delivery `ext-redis` or `symfony/mercure-bundle`. They assume a Doctrine `App\Entity\User` with an integer ID behind the firewall: `php bin/console make:user`, then `#[ORM\Table(name: 'app_user')]` on the entity (`user` is reserved on PostgreSQL).
 
 ### 2. Layout and generators
 
@@ -50,7 +50,7 @@ vendor/bin/neuron make:tool 'App\Neuron\Tools\OrderStatusTool'
 vendor/bin/neuron make:evaluators 'App\Neuron\Evaluators\SupportAgentEvaluator'
 ```
 
-Pass the fully qualified name: without it the class lands in `src/`. The generated `provider()` hard-codes `key: 'ANTHROPIC_KEY'`; replace it as The Agent shows.
+Pass the fully qualified name: without it the class lands in `src/`. The generated `provider()` reads the key and the model from `$_ENV`; replace it as The Agent shows.
 
 ### 3. Keys
 
@@ -140,10 +140,12 @@ doctrine:
 ```php
 namespace App\Neuron;
 
+use Doctrine\DBAL\Exception as DbalException;
 use NeuronAI\Exceptions\InputTranslationException;
 use NeuronAI\Exceptions\PersistenceException;
 use NeuronAI\Exceptions\RunInFlightException;
 use NeuronAI\Exceptions\WorkflowException;
+use PDOException;
 use Psr\Log\LoggerInterface;
 use Psr\Log\LogLevel;
 use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
@@ -160,10 +162,13 @@ class NeuronExceptionListener
     public function __invoke(ExceptionEvent $event): void
     {
         $e = $event->getThrowable();
+        // Database errors are not Neuron's classes: they are mapped on the agent routes only.
+        $databaseFailed = ($e instanceof PDOException || $e instanceof DbalException)
+            && str_starts_with($event->getRequest()->getPathInfo(), '/chat');
 
         $response = match (true) {
             $e instanceof InputTranslationException => new JsonResponse(['error' => $e->getMessage()], 400),
-            $e instanceof PersistenceException => new JsonResponse(['error' => 'The conversation store is unavailable.'], 503),
+            $e instanceof PersistenceException, $databaseFailed => new JsonResponse(['error' => 'The conversation store is unavailable.'], 503),
             $e instanceof RunInFlightException => new JsonResponse(
                 ['error' => 'The conversation is busy.', 'status' => $e->status->value],
                 409,
@@ -183,6 +188,7 @@ class NeuronExceptionListener
 ```
 
 - The most specific class comes first: `PersistenceException` and `RunInFlightException` extend `WorkflowException`. Only `InputTranslationException`'s message is written for clients; every mapped exception is logged with its real message, 4xx at notice and 5xx at error (a 409 during a pending approval logged `[notice] Cannot ignite a new run for workflow ID …`).
+- **A database failure needs both classes.** `DatabasePersistence` and `SQLMessageStore` pass driver errors on as they are: a run on a locked database threw `PDOException`. An unreachable server threw DBAL's `ConnectionException` from the `neuron.pdo` factory, before any store existed, and that is not a `PDOException`. Neither class is Neuron's, so the `/chat` check leaves the rest of the app to Symfony: the same errors on `/orders` passed through unmapped.
 - `Retry-After` is the lease expiry, an upper bound: a turn still streaming gave `Retry-After: 598`. A suspended run holds no lease, so no header.
 - `framework.exceptions` is not enough: it matched the first `instanceof` in config order (a `RunInFlightException` li
```

---

### Incident Patch 7: `c063c5ae` (2026-10-02)
**Commit Message**: fix AG-UI 1.0

**File**: `packages/streaming/README.md` (modified, +2/-1)
```diff
@@ -251,7 +251,8 @@ Configure the backend with `AGUIAdapter`. Extend AG-UI's `AbstractAgent` to conn
 
 ```ts
 import { AbstractAgent } from '@ag-ui/client';
-import { EventSchemas, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
+import type { BaseEvent, RunAgentInput } from '@ag-ui/core';
+import { EventSchemas } from '@ag-ui/core/schemas';
 import { Observable } from 'rxjs';
 import { createProtocolStream } from '@neuron-core/streaming';
 
```

**File**: `tests/Integration/Frontend/README.md` (modified, +8/-7)
```diff
@@ -51,11 +51,11 @@ The suite is the compatibility statement for Neuron's frontend integrations. Eac
 client stack is fixed to its current major line in `package.json`; patch and minor
 releases within that line are accepted, a new major requires a deliberate review
 and a new run of this suite. The lockfile records the exact versions the suite last
-passed with. There is no automatic upgrade process.
+passed with. Dependabot proposes patch and minor releases; a new major is upgraded by hand.
 
 | Stack | Supported line | Last verified |
 |---|---|---|
-| AG-UI (`@ag-ui/client`, `@ag-ui/core`) | 0.0.x | 0.0.59 |
+| AG-UI (`@ag-ui/client`, `@ag-ui/core`) | 1.0.x | 1.0.1 |
 | Vercel AI SDK (`ai`, `@ai-sdk/react`) | 7.x / 4.x | 7.0.98 / 4.0.101 |
 | CopilotKit (`@copilotkit/react-core`, `@copilotkit/runtime`, v2 API) | 1.x | 1.71.0 |
 | Pusher (`pusher-js`) | 8.x | 8.6.0 |
@@ -123,11 +123,12 @@ Pusher's service; transport-level checks also live in `tests/Workflow/Channel`.
 
 ## Verified behaviour and client limitations
 
-- **AG-UI error field.** Neuron adds `error` to `TOOL_CALL_RESULT` for failed results.
-  The AG-UI core schema for that event is passthrough, so the field reaches
-  subscribers on the frame, but the official client's reducer builds message state
-  from `content` alone: `agent.messages` carries no `error`. A rejection is stamped as
-  a plain instruction string and carries no `error` on purpose.
+- **AG-UI error field.** AG-UI defines `error` on the tool message, not on the
+  `TOOL_CALL_RESULT` event, and the official client removes fields the protocol does
+  not define. A failed result therefore streams its error text as `content`, and
+  `agent.messages` carries no `error`; the marker appears only on the tool message of
+  a `MESSAGES_SNAPSHOT` or a reload. A rejection is stamped as a plain instruction
+  string and carries no `error` on purpose.
 - **Structured results.** Vercel passes `false`, `0`, `null` and structured values, which
   Neuron normalizes to their JSON text. AG-UI tool messages are text by protocol, so
   the client sends JSON text. CopilotKit serializes handler values itself: objects and
```

**File**: `tests/Integration/Frontend/fixtures/channels/protocols.ts` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 import { AbstractAgent } from '@ag-ui/client';
-import { EventSchemas, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
+import type { BaseEvent, RunAgentInput } from '@ag-ui/core';
+import { EventSchemas } from '@ag-ui/core/schemas';
 import { Observable } from 'rxjs';
 import { readUIMessageStream, uiMessageChunkSchema } from 'ai';
 import { createChannelConsumer, createProtocolStream, type ChannelConsumer } from '@neuron-core/streaming';
```

**File**: `tests/Integration/Frontend/package.json` (modified, +3/-3)
```diff
@@ -6,16 +6,16 @@
     "test": "playwright test"
   },
   "dependencies": {
-    "@ag-ui/client": "~0.0.59",
-    "@ag-ui/core": "~0.0.59",
+    "@ag-ui/client": "~1.0.0",
+    "@ag-ui/core": "~1.0.0",
     "@ai-sdk/react": "^4.0.101",
     "@copilotkit/react-core": "^1.71.0",
     "@copilotkit/runtime": "^1.71.0",
     "@neuron-core/streaming": "0.2.0",
     "ai": "^7.0.98",
     "react": "^19.3.0",
     "react-dom": "^19.3.0",
-    "rxjs": "^7.8.1",
+    "rxjs": "7.8.1",
     "zod": "^4.6.2"
   },
   "devDependencies": {
```

**File**: `tests/Integration/Frontend/specs/agui/backend-error.spec.ts` (modified, +3/-4)
```diff
@@ -2,7 +2,7 @@ import { test, expect } from "@playwright/test";
 import { observe, toolResultsSentToProvider } from "../../support/backend";
 import { openThread, run } from "../../support/agui";
 
-test("AG-UI error representation: a backend tool failure is marked on the wire but the official client keeps only its content", async ({ request }) => {
+test("AG-UI error representation: a backend tool failure reaches the client as the content of its result", async ({ request }) => {
   const { threadId, agent } = await openThread(request, "backend-error", "Fail on purpose.");
 
   const first = await run(agent);
@@ -11,10 +11,9 @@ test("AG-UI error representation: a backend tool failure is marked on the wire b
 
   const frame = first.resultFrames.call_fail_1;
   expect(frame.content).toBe("clock unavailable");
-  expect(frame.error).toBe("clock unavailable");
+  expect(frame.error).toBeUndefined();
 
-  // The client's event reducer builds the tool message from `content` alone; the
-  // `error` marker survives the frame (schema passthrough) but not the message state.
+  // AG-UI defines no `error` on the result event, so the failure travels as content.
   const toolMessage = agent.messages.find((message) => message.role === "tool" && message.toolCallId === "call_fail_1");
   expect(toolMessage?.content).toBe("clock unavailable");
   expect((toolMessage as { error?: string } | undefined)?.error).toBeUndefined();
```

---

### Incident Patch 8: `7ea3db88` (2026-10-02)
**Commit Message**: fix AG-UI 1.0

**File**: `.github/dependabot.yml` (modified, +12/-2)
```diff
@@ -4,7 +4,9 @@ updates:
   - package-ecosystem: github-actions
     directory: /
     schedule:
-      interval: monthly
+      interval: "weekly"
+    cooldown:
+      default-days: 5
     groups:
       github-actions:
         patterns:
@@ -13,8 +15,16 @@ updates:
   - package-ecosystem: npm
     directory: /
     schedule:
-      interval: monthly
+      interval: "weekly"
+    cooldown:
+      default-days: 5
+    ignore:
+      # @ag-ui/client pins rxjs to an exact version; a second copy breaks the Observable types.
+      - dependency-name: rxjs
     groups:
       npm:
         patterns:
           - "*"
+        update-types:
+          - minor
+          - patch
```

**File**: `package-lock.json` (modified, +75/-3)
```diff
@@ -19342,16 +19342,16 @@
     "tests/Integration/Frontend": {
       "name": "neuron-frontend-integration",
       "dependencies": {
-        "@ag-ui/client": "~0.0.59",
-        "@ag-ui/core": "~0.0.59",
+        "@ag-ui/client": "~1.0.0",
+        "@ag-ui/core": "~1.0.0",
         "@ai-sdk/react": "^4.0.101",
         "@copilotkit/react-core": "^1.71.0",
         "@copilotkit/runtime": "^1.71.0",
         "@neuron-core/streaming": "0.2.0",
         "ai": "^7.0.98",
         "react": "^19.3.0",
         "react-dom": "^19.3.0",
-        "rxjs": "^7.8.1",
+        "rxjs": "7.8.1",
         "zod": "^4.6.2"
       },
       "devDependencies": {
@@ -19362,6 +19362,78 @@
         "pusher-js": "^8.6.0",
         "vite": "^8.3.0"
       }
+    },
+    "tests/Integration/Frontend/node_modules/@ag-ui/client": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@ag-ui/client/-/client-1.0.1.tgz",
+      "integrity": "sha512-AxJ1+fnsRrhWBg+dXItoyXNqUhI/tOXk0/TxXrsuvdjtyTx216Hu+3q5DgQnTDbluP95fCW4buoCKQsKpHmmCw==",
+      "license": "MIT",
+      "dependencies": {
+        "@ag-ui/core": "1.0.1",
+        "@ag-ui/encoder": "1.0.1",
+        "@ag-ui/proto": "1.0.1",
+        "@types/uuid": "^10.0.0",
+        "compare-versions": "^6.1.1",
+        "fast-json-patch": "^3.1.1",
+        "rxjs": "7.8.1",
+        "untruncate-json": "^0.0.1",
+        "uuid": "^11.1.0",
+        "zod": "^3.25.76"
+      }
+    },
+    "tests/Integration/Frontend/node_modules/@ag-ui/client/node_modules/zod": {
+      "version": "3.25.76",
+      "resolved": "https://registry.npmjs.org/zod/-/zod-3.25.76.tgz",
+      "integrity": "sha512-gzUt/qt81nXsFGKIFcC3YnfEAx5NkunCfnDlvuBSSFS02bcXu4Lmea0AFIUwbLWxWPx3d9p8S5QoaujKcNQxcQ==",
+      "license": "MIT",
+      "funding": {
+        "url": "https://github.com/sponsors/colinhacks"
+      }
+    },
+    "tests/Integration/Frontend/node_modules/@ag-ui/core": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@ag-ui/core/-/core-1.0.1.tgz",
+      "integrity": "sha512-Q6pxgI7gcey/0pHfM37S7GNrsYqTrrjjFLpi1dckHNGX2l9VTL0CjnyNc44lwPfHIzFmmEvQfbrAeEPINGGg/Q==",
+      "license": "MIT",
+      "peerDependencies": {
+        "zod": "^3.25.18 || ^4.0.0"
+      },
+      "peerDependenciesMeta": {
+        "zod": {
+          "optional": true
+        }
+      }
+    },
+    "tests/Integration/Frontend/node_modules/@ag-ui/encoder": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@ag-ui/encoder/-/encoder-1.0.1.tgz",
+      "integrity": "sha512-or0xYLdzGOuJg5avAtUxS1zNiMqO7MxUso+7z90Wl4jpl94QzfmfybXWopvPipVm/dh8IqkB/Zn+LHy4MI2e+g==",
+      "license": "MIT",
+      "dependencies": {
+        "@ag-ui/core": "1.0.1",
+        "@ag-ui/proto": "1.0.1"
+      }
+    },
+    "tests/Integration/Frontend/node_modules/@ag-ui/proto": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@ag-ui/proto/-/proto-1.0.1.tgz",
+      "integrity": "sha512-w7R2gLeXv04Mss0B29thkF+nLitSx6aLeqhUpvmeJZNjBPbwZ6zkXdK3/KEqavCMtHvot7AGj6RaHG1DvbJwww==",
+      "license": "MIT",
+      "dependencies": {
+        "@ag-ui/core": "1.0.1",
+        "@bufbuild/protobuf": "^2.2.5",
+        "@protobuf-ts/protoc": "^2.11.1",
+        "zod": "^3.25.76"
+      }
+    },
+    "tests/Integration/Frontend/node_modules/@ag-ui/proto/node_modules/zod": {
+      "version": "3.25.76",
+      "resolved": "https://registry.npmjs.org/zod/-/zod-3.25.76.tgz",
+      "integrity": "sha512-gzUt/qt81nXsFGKIFcC3YnfEAx5NkunCfnDlvuBSSFS02bcXu4Lmea0AFIUwbLWxWPx3d9p8S5QoaujKcNQxcQ==",
+      "license": "MIT",
+      "funding": {
+        "url": "https://github.com/sponsors/colinhacks"
+      }
     }
   }
 }
```

**File**: `skills/neuron-frontend-integration/SKILL.md` (modified, +2/-2)
```diff
@@ -285,7 +285,7 @@ Rules the suite enforces:
 
 ## AG-UI official client (`@ag-ui/client`)
 
-Tested with `@ag-ui/client` 0.0.x. The protocol is what CopilotKit speaks underneath; use the client directly for contract tests or a custom frontend.
+Tested with `@ag-ui/client` 1.0.x. The protocol is what CopilotKit speaks underneath; use the client directly for contract tests or a custom frontend.
 
 ```ts
 import { HttpAgent } from "@ag-ui/client";
@@ -332,7 +332,7 @@ Facts the suite established:
 - An ordinary frontend handoff ends with `RUN_FINISHED` without an outcome; the tool messages on the next request continue it. Only approvals and other waits produce `outcome.type === "interrupt"`.
 - Tool message content is text. Send structured values as JSON text; Neuron passes the text through unchanged.
 - `runAgent` **resolves** on `RUN_ERROR` and reports it through `onRunErrorEvent`; it rejects only on HTTP failures before the stream (the error message carries the status and JSON body).
-- Neuron marks failed results with `error` on `TOOL_CALL_RESULT`. The event schema is passthrough, so subscribers see it on the frame, but the client builds message state from `content` alone: `agent.messages` never carries `error`. A rejected approval is a plain instruction string with no `error` marker at all.
+- A failed result streams its error text as the `content` of `TOOL_CALL_RESULT`. AG-UI defines `error` on the tool message, not on that event, so the frame has no `error` field and `agent.messages` built from the stream never carries one; the marker appears only on tool messages in a `MESSAGES_SNAPSHOT` or a reload. A rejected approval is a plain instruction string with no `error` marker at all.
 - Two calls of the same tool in one batch stay distinct by call ID across requests.
 - **Reload.** Seed a fresh client from the reload endpoint. `runAgent` refuses to run while a pending interrupt is not addressed by `resume`, so the reloaded page answers the persisted approval or frontend wait before anything else. After the run completes, another reload rebuilds exactly the message IDs the client holds.
 
```

**File**: `src/Agent/Adapters/AGUIAdapter.php` (modified, +2/-1)
```diff
@@ -367,7 +367,8 @@ protected function handleToolResult(ToolResultChunk $chunk): iterable
         $id = $message['id'];
         $this->messages[$id] = $message;
         $this->knownResults[$toolCallId] = true;
-        unset($message['id']);
+        // AG-UI defines `error` on the tool message, not on the result event.
+        unset($message['id'], $message['error']);
         yield new ProtocolEvent('TOOL_CALL_RESULT', ['messageId' => $id, ...$message]);
     }
 
```

**File**: `tests/Agent/Adapters/FrontendToolAdapterTest.php` (modified, +5/-4)
```diff
@@ -149,13 +149,14 @@ public function test_agui_does_not_echo_frontend_results_or_repeat_known_calls()
         $this->assertSame([], $this->decode($adapter->transform(new ToolResultChunk($call))));
     }
 
-    public function test_agui_errors_have_an_error_marker_and_original_call_id(): void
+    public function test_agui_error_frames_carry_the_text_as_content_under_the_original_call_id(): void
     {
         $call = (new ToolCall('browser', 'failed'))->setResult(ToolOutput::error('Not available'));
         $events = $this->decode((new AGUIAdapter('thread'))->transform(new ToolResultChunk($call)));
-        $result = $events[array_key_last($events)];
-        $this->assertSame('failed', $result['toolCallId']);
-        $this->assertSame('Not available', $result['error']);
+        $this->assertSame(
+            ['type' => 'TOOL_CALL_RESULT', 'messageId' => 'result_failed', 'role' => 'tool', 'toolCallId' => 'failed', 'content' => 'Not available'],
+            $events[array_key_last($events)],
+        );
     }
 
     public function test_agui_custom_wait_requires_explicit_resume(): void
```

**File**: `upgrade/37-adapter-wire-output.md` (modified, +3/-3)
```diff
@@ -31,7 +31,7 @@ In 3.x a paused or failed run stopped the stream with an exception, and the endp
 | `REASONING_*` `messageId` | the provider chunk's ID, a vendor ID or `null` | `reasoning_{messageId}`, built from the stored message ID |
 | `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END` | sent when the tool started, before it ran. `TOOL_CALL_ARGS` was left out when the call had no arguments. `parentMessageId` was present only when text preceded the call | sent right before the call's `TOOL_CALL_RESULT`, after the tool ran. `TOOL_CALL_ARGS` is always sent: the provider's argument fragments, or one JSON string (`{}` without arguments). `parentMessageId` is always present: the stored ID of the message holding the call |
 | `toolCallId` | the provider's call ID | unchanged |
-| `TOOL_CALL_RESULT` | `{toolCallId, content, role: "tool", messageId: <random msg_…>}` | `{messageId: "result_{toolCallId}", role: "tool", toolCallId, content}`, plus `error` (the error text) when the result is an error `ToolOutput`. `content` is a string |
+| `TOOL_CALL_RESULT` | `{toolCallId, content, role: "tool", messageId: <random msg_…>}` | `{messageId: "result_{toolCallId}", role: "tool", toolCallId, content}`. `content` is a string: the error text when the result is an error `ToolOutput` |
 | Approval pause | none: the stream threw | `STATE_SNAPSHOT {snapshot}`, `MESSAGES_SNAPSHOT {messages}`, then `RUN_FINISHED {threadId, runId, outcome: {type: "interrupt", interrupts: [...]}}`. Gated calls get no `TOOL_CALL_*` frames until the run continues after the decision |
 | Approval interrupt | none | `{id: <tool call ID>, reason: "confirmation", message, responseSchema: {type: "object", properties: {approved: {type: "boolean"}, reason: {type: "string"}}, required: ["approved"]}, metadata: <the action: id, name, description, decision, feedback, reason, inputs>, expiresAt?}` |
 | Other pause (a node's `interrupt()`) | none | the same three frames, with interrupts `{id: "<interrupt ID>", reason: "neuron:wait_for_event" or "neuron:sleep_until", message, metadata: <InterruptRequest JSON>, expiresAt?}` |
@@ -66,7 +66,7 @@ Follow the hits:
 - Searches 1 and 2 find `useChat` users (Case 1), custom Vercel parsers (Case 2), AG-UI clients (Case 3), and PHP tests or PHP code that pin frames (Case 4). Correctly migrated code still matches them, because many frame names did not change.
 - Find the frame types the 3.x endpoint wrote itself in its `catch (WorkflowInterrupt ...)` or `catch (Throwable ...)` blocks, which guides 29 and 36 deleted: read the endpoint's pre-upgrade version (`git show HEAD:<path>` or the VCS history), then grep the client code for those type names.
 - Hits in compiled bundles (for example `public/js/app.js`): change the sources, and report to the developer that the assets must be rebuilt.
-- Search 3: Neuron verifies these frames with `ai` 7.x and `@ai-sdk/react` 4.x, `@ag-ui/client` 0.0.x, and CopilotKit 1.x. The `tool-approval-request` part needs an AI SDK release that supports tool approval. If the application pins an older major line, report it to the developer and ask whether to upgrade. Do not change the versions yourself.
+- Search 3: Neuron verifies these frames with `ai` 7.x and `@ai-sdk/react` 4.x, `@ag-ui/client` 1.0.x, and CopilotKit 1.x. The `tool-approval-request` part needs an AI SDK release that supports tool approval. If the application pins an older major line, report it to the developer and ask whether to upgrade. Do not change the versions yourself.
 - If the client is not in this repository (a mobile app, a separate SPA), report the two tables above and the Cases below to the developer.
 
 If nothing is found, this guide does not apply.
@@ -181,7 +181,7 @@ for await (const payload of payloads(response)) { // the text after each "data:
 This covers `@ag-ui/client` (`HttpAgent`), CopilotKit and custom parsers.
 
 1. Use the IDs the frames carry. Remove code that parses ID prefixes (`msg_`, `call_`), generates its own IDs for these messages, or re-keys messages after a reload.
-2. Tool frames arrive after the tool ran. Do not show a tool as running from `TOOL_CALL_START`. `TOOL_CALL_ARGS` always arrives, and a failed tool's `TOOL_CALL_RESULT` carries `error`.
+2. Tool frames arrive after the tool ran. Do not show a tool as running from `TOOL_CALL_START`. `TOOL_CALL_ARGS` always arrives, and a failed tool's `TOOL_CALL_RESULT` carries the error text as `content`.
 3. On `RUN_FINISHED`, check the outcome before treating the turn as complete: `params.outcome === 'interrupt'` in an `@ag-ui/client` subscriber, `event.outcome?.type === 'interrupt'` in a raw parser. Then render the interrupts. Answer every interrupt of the pause in one request, in one of two ways:
    - With AG-UI `resume` entries `{interruptId, status: 'resolved' | 'cancelled', payload: {approved, reason?}}`. The endpoint forwards them with `AGUIInputTranslator` (guide 36).
    - Through an application endpoint that calls `submitApprovalDecis
```

**File**: `upgrade/49-mcp-tool-results-are-tool-output.md` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ In 3.x, `McpConnector::invokeTool()` returned the MCP server's `content` array,
 | A result with `isError: true` is an ordinary result | `isError()` is `true` |
 | A result without `content` is `''`, and one with `content: []` is `"[]"` | An empty `ToolOutput` |
 | The serialized `result` of an MCP tool call (`jsonSerialize()`, stored messages) is that JSON string | A block list such as `[{"type":"text","content":"...","meta":[]}]`, or `{"is_error":true,"blocks":[...]}` for an error result |
-| Vercel AI `tool-output-available.output` and AG-UI `TOOL_CALL_RESULT.content` carry that JSON string | Plain text: the text blocks only, without images or audio. An error result arrives as Vercel `tool-output-error` (`errorText`) or as AG-UI `TOOL_CALL_RESULT` with an `error` field |
+| Vercel AI `tool-output-available.output` and AG-UI `TOOL_CALL_RESULT.content` carry that JSON string | Plain text: the text blocks only, without images or audio. An error result arrives as Vercel `tool-output-error` (`errorText`) or as AG-UI `TOOL_CALL_RESULT` with the error text as `content` |
 
 **Stored data:** MCP results that 3.x wrote to chat history stay JSON strings. 4.x reads them back as-is, as plain string results, never as a `ToolOutput`, and without an error flag, because 3.x never recorded one. Do not rewrite stored rows or `.chat` files. Code that reads history written before the upgrade keeps a decode branch for these strings (Case 1, step 4, and Case 4).
 
@@ -253,7 +253,7 @@ const text = part.output;
 ```
 
 1. Remove `JSON.parse` of MCP tool output: Vercel `output`, AG-UI `content`, and the `result` of tool entries read from serialized history. For history, read blocks as in Case 4. Guide 34 shows the client version.
-2. Handle error results in the frames that carry them: Vercel `tool-output-error` with `errorText` (tool part state `output-error`), or AG-UI `TOOL_CALL_RESULT` with an `error` field. Guide 37 covers the other frame changes.
+2. Handle error results in the frames that carry them: Vercel `tool-output-error` with `errorText` (tool part state `output-error`), or AG-UI `TOOL_CALL_RESULT`, whose `content` is the error text. Guide 37 covers the other frame changes.
 3. The adapters no longer send MCP images or audio. If the frontend displayed them, tell the developer. The blocks are still in the `ToolResultMessage` and its serialized form (Case 4). Ask how the frontend should receive them.
 
 ## Checklist
```

---

### Incident Patch 9: `673450ee` (2026-10-01)
**Commit Message**: Merge pull request #677 from bestform/fix-typo-in-readme

fix typo in readme

**File**: `README.md` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ the same language as the system you are building today.
 
 ## Start With One Prompt
 
-Copy & paste this initial prompt to tell your conding agent how to install and configure Neuron AI in your project.
+Copy & paste this initial prompt to tell your coding agent how to install and configure Neuron AI in your project.
 
 ```
 You are going to set up Neuron AI, a PHP framework for building agentic applications,
```

---

### Incident Patch 10: `da567ced` (2026-10-01)
**Commit Message**: fix typo in readme

**File**: `README.md` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ the same language as the system you are building today.
 
 ## Start With One Prompt
 
-Copy & paste this initial prompt to tell your conding agent how to install and configure Neuron AI in your project.
+Copy & paste this initial prompt to tell your coding agent how to install and configure Neuron AI in your project.
 
 ```
 You are going to set up Neuron AI, a PHP framework for building agentic applications,
```

---

### Incident Patch 11: `be14b9a3` (2026-10-01)
**Commit Message**: security reporting policy

**File**: `SECURITY.md` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+# Security Policy
+
+## Supported Versions
+
+| Version | Supported          |
+|---------|--------------------|
+| 4.x     | :white_check_mark: |
+| 3.x     | :white_check_mark: |
+| < 3.0   | :x:                |
+
+## Reporting a Vulnerability
+
+Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.
+
+Send an email to [support@inspector.dev](mailto:support@inspector.dev) instead, including:
+
+- A description of the vulnerability and its impact
+- The affected version(s)
+- Steps to reproduce, or a proof of concept
+- Any suggested fix, if you have one
+
+We will acknowledge your report, keep you informed while we investigate, and credit you in the release notes once a fix is published, unless you prefer to remain anonymous.
+
+Please give us the chance to release a fix before disclosing the issue publicly.
```

---

### Incident Patch 12: `ad2637e7` (2026-10-01)
**Commit Message**: Merge pull request #676 from asterixcapri/fix/chat-history-message-return-type

Fix ChatHistory::getMessages() return type annotation

**File**: `src/Chat/History/ChatHistory.php` (modified, +3/-0)
```diff
@@ -75,6 +75,9 @@ public function addMessage(Message $message): self
         return $this;
     }
 
+    /**
+     * @return Message[]
+     */
     public function getMessages(): array
     {
         return $this->messages ??= $this->store->loadActive($this->threadId);
```

**File**: `tests/Tools/Toolkits/TodoPlanning/TodoPlanningToolkitTest.php` (modified, +1/-0)
```diff
@@ -100,6 +100,7 @@ public function test_parallel_tool_calls_keep_the_todo_list_in_the_conversation(
         $agent->chat(new UserMessage('Build the blog'));
 
         [, $call, $results] = $agent->getChatHistory()->getMessages();
+        self::assertInstanceOf(ToolCallMessage::class, $call);
         self::assertSame($this->todos, $call->getToolCalls()[0]->getInput('todos'));
         self::assertInstanceOf(ToolResultMessage::class, $results);
         self::assertSame('Updated to do list to: [{"content":"Design the schema","status":"in_progress"}]', $results->getToolCalls()[0]->getResult());
```

---

### Incident Patch 13: `2bc4d583` (2026-10-01)
**Commit Message**: Fix ChatHistory::getMessages() return type annotation

**File**: `src/Chat/History/ChatHistory.php` (modified, +3/-0)
```diff
@@ -75,6 +75,9 @@ public function addMessage(Message $message): self
         return $this;
     }
 
+    /**
+     * @return Message[]
+     */
     public function getMessages(): array
     {
         return $this->messages ??= $this->store->loadActive($this->threadId);
```

---

### Incident Patch 14: `f0f49c2d` (2026-09-29)
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

**File**: `tests/Integration/Frontend/Stub/ScenarioProvider.php` (modified, +36/-0)
```diff
@@ -26,7 +26,10 @@
 use function array_map;
 use function array_slice;
 use function count;
+use function end;
 use function json_encode;
+use function str_repeat;
+use function usleep;
 
 use const JSON_THROW_ON_ERROR;
 
@@ -57,8 +60,12 @@ class ScenarioProvider implements AIProviderInterface
         'handler-error' => [[['probe', 'call_throw', ['kind' => 'throw']]]],
         'backend-error' => [[['server_fail', 'call_fail_1', []]]],
         'two-steps' => [[['read_title', 'call_read_title_1', []]], [['read_text', 'call_text_1', ['selector' => '#first']]]],
+        'abandoned-stream' => [],
     ];
 
+    /** In the abandoned-stream scenario, this prompt streams a long answer slowly enough to leave mid-stream. */
+    public const LONG_STORY = 'Tell me a long story.';
+
     public function __construct(
         protected PDO $pdo,
         protected string $threadId,
@@ -83,6 +90,10 @@ public function chat(Message ...$messages): ProviderResponse
 
     public function stream(Message ...$messages): Generator
     {
+        if ($this->scenario === 'abandoned-stream' && $this->lastUserText($messages) === self::LONG_STORY) {
+            return $this->streamLongStory($messages);
+        }
+
         $response = $this->respond('stream', $messages);
         return $this->streamChunks($response);
     }
@@ -111,6 +122,31 @@ protected function streamChunks(Message $response): Generator
         return new ProviderResponse(message: $response);
     }
 
+    /**
+     * One sentence every 100 ms for five seconds.
+     *
+     * @param Message[] $messages
+     * @return Generator<int, TextChunk, mixed, ProviderResponse>
+     */
+    protected function streamLongStory(array $messages): Generator
+    {
+        $response = new AssistantMessage(str_repeat('Once upon a time. ', 50));
+        $this->record('stream', $messages, $response);
+
+        for ($sentence = 0; $sentence < 50; $sentence++) {
+            usleep(100_000);
+            yield new TextChunk($response->getId(), 'Once upon a time. ');
+        }
+        return new ProviderResponse(message: $response);
+    }
+
+    /** @param Message[] $messages */
+    protected function lastUserText(array $messages): ?string
+    {
+        $users = array_filter($messages, $this->isUserTurn(...));
+        return $users === [] ? null : end($users)->getContent();
+    }
+
     /** @param Message[] $messages */
     protected function respond(string $method, array $messages): Message
     {
```

**File**: `tests/Integration/Frontend/backend/router.php` (modified, +4/-0)
```diff
@@ -55,6 +55,10 @@ function streamFrames(Generator $events, array $headers): void
     try {
         foreach (SSEEncoder::encode($events) as $frame) {
             echo $frame;
+            // The built-in server buffers 4 KB of output (output_buffering): push every frame now.
+            if (\ob_get_level() > 0) {
+                \ob_flush();
+            }
             \flush();
         }
     } catch (Throwable) {
```

**File**: `tests/Integration/Frontend/support/backend.ts` (modified, +5/-0)
```diff
@@ -6,6 +6,11 @@ import type { APIRequestContext, Page } from "@playwright/test";
 export const BACKEND = "http://127.0.0.1:8787";
 export const FRONTEND = "http://127.0.0.1:5173";
 
+/** In the abandoned-stream scenario, the prompt the backend answers slowly (ScenarioProvider::LONG_STORY). */
+export const LONG_STORY = "Tell me a long story.";
+/** The whole answer, streamed one sentence every 100 ms. */
+export const LONG_STORY_ANSWER = "Once upon a time. ".repeat(50);
+
 export interface ProviderInvocation {
   method: string;
   messages: Array<Record<string, any>>;
```

---

### Incident Patch 15: `53700f3a` (2026-09-29)
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

**File**: `tests/Tools/Toolkits/Calendar/GetTimezoneInfoToolTest.php` (modified, +3/-3)
```diff
@@ -130,7 +130,7 @@ public function test_a_named_zone_reports_its_location(): void
     {
         $result = json_decode(($this->tool)('Australia/Sydney', '2023-01-15 12:00:00'), true);
 
-        $this->assertSame(['country_code' => 'AU', 'latitude' => -33.86666, 'longitude' => 151.21666], $result['location']);
+        $this->assertSame(['country_code' => 'AU', 'latitude' => -33.8667, 'longitude' => 151.2167], $result['location']);
     }
 
     public function test_get_timezone_info_without_location(): void
@@ -151,7 +151,7 @@ public function test_describes_every_field_for_a_reference_date(): void
             'offset_formatted' => '+02:00',
             'is_dst' => true,
             'abbreviation' => 'CEST',
-            'location' => ['country_code' => 'FR', 'latitude' => 48.86666, 'longitude' => 2.33333],
+            'location' => ['country_code' => 'FR', 'latitude' => 48.8667, 'longitude' => 2.3333],
             'reference_time' => '2023-07-01 12:00:00 CEST',
         ], json_decode(($this->tool)('Europe/Paris', '2023-07-01 12:00:00'), true));
     }
@@ -181,7 +181,7 @@ public function test_describes_a_half_hour_offset(): void
             'offset_formatted' => '+05:30',
             'is_dst' => false,
             'abbreviation' => 'IST',
-            'location' => ['country_code' => 'IN', 'latitude' => 22.53333, 'longitude' => 88.36666],
+            'location' => ['country_code' => 'IN', 'latitude' => 22.5333, 'longitude' => 88.3667],
             'reference_time' => '2023-01-15 12:00:00 IST',
         ], json_decode(($this->tool)('Asia/Kolkata', '2023-01-15 12:00:00'), true));
     }
```

**File**: `tests/Workflow/Channel/StreamFailureDeliveryTest.php` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ public function test_failure_frames_reach_pull_and_push_consumers(
         $this->assertSame($expectedTypes, array_column($events, 'type'));
         $this->assertSame(
             $adapter instanceof AGUIAdapter
-                ? ['type' => 'RUN_ERROR', 'message' => 'The run failed.', 'code' => '503']
+                ? ['type' => 'RUN_ERROR', 'message' => 'The run failed.']
                 : ['type' => 'error', 'errorText' => 'The run failed.'],
             $events[array_key_last($events)],
         );
```

#### Recent Merged Pull Requests:
- **PR #680** (2026-10-02): Bump the npm group across 1 directory with 6 updates (@dependabot[bot])
- **PR #679** (closed): Bump the npm group with 9 updates (@dependabot[bot])
- **PR #678** (2026-10-02): Bump the github-actions group with 4 updates (@dependabot[bot])
- **PR #677** (2026-10-01): fix typo in readme (@bestform)
- **PR #676** (2026-10-01): Fix ChatHistory::getMessages() return type annotation (@asterixcapri)
- **PR #673** (2026-10-01): Fix stdio MCP response buffering (@SmoKE585)
- **PR #672** (closed): Add RouterProvider with optional weighted RoundRobin load balancing (@gianpierofasulo)
- **PR #668** (2026-10-01): fix(zai): stream reasoning chunks (@simPod)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
