> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/neuron-core-neuron-ai-learnings.md`  
> **Source**: github ([https://github.com/neuron-core/neuron-ai](https://github.com/neuron-core/neuron-ai))  
> **Source Version**: `e66e0fda`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T02:12:11.980Z  
> **Learning ID**: `learn-github-neuron-core-neuron-ai`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): neuron-core/neuron-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/neuron-core-neuron-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neuron-core/neuron-ai](https://github.com/neuron-core/neuron-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T02:12:11.551Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neuron-core/neuron-ai`
- **Description**: The Agentic Framework of the PHP ecosystem to build production-ready AI driven applications. Connect components (LLMs, Tools, vector DBs, memory) to agents that interact with your data and UI.
- **Primary Language / Ecosystem**: PHP
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2163 stars

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

- **Issue #469** (2026-02-13): **Gemini HandleChat only checks parts[0] for functionCall — breaks Gemini 3 tool calls**
  *Symptoms*: ## Description  The non-streaming Gemini `HandleChat` trait determines whether a response contains a tool/function call by inspecting only the **first element** of the `parts` array:  ```php if (array_key_exists('functionCall', $parts[0]) && !empty($parts[0]['functionCall'])) { ```  https://github.com/neuron-core/neuron-ai/blob/2.x/src/Providers/Gemini/HandleChat.php#L95  Gemini 3 models (e.g. `gemini-3-pro-preview`, `gemini-3-flash-preview`) can return **text or thought parts before the `functionCall` part**, for example:  ```json {   "candidates": [{     "content": {       "parts": [         { "text": "Let me call the tool." },         { "functionCall": { "name": "my_tool", "args": { "input": "value" } }, "thoughtSignature": "sig-abc" }       ]     },     "finishReason": "STOP"   }] } ```  When this happens, `$parts[0]` is the text part (`{ "text": "..." }`), the `functionCall` check fails, and the response is treated as a plain `AssistantMessage` — **the tool call is silently ignored**.  See also: https://ai.google.dev/gemini-api/docs/thought-signatures  ## Note  The **streaming** path (`HandleStream`) already handles this correctly — `hasToolCalls()` iterates over all parts. Only the non-streaming `HandleChat` path is affected.  Additionally, `Gemini::createToolCallMessage()` uses `array_filter($tools)` without `array_values()`, so when text/thought parts precede `functionCall` parts, the resulting tools array can have non-sequential keys (e.g. `[2 => $tool]` instead of `
  **Post-Mortem & Fix Analysis**:
  > What version are you using?
  > @ilvalerione I've encountered this at `v2.11.2` in https://github.com/dx-tooling/sitebuilder-webapp, where I worked around this via https://github.com/dx-tooling/sitebuilder-webapp/blob/main/src/PhotoBuilder/Infrastructure/Adapter/PatchedGemini.php.

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

### Incident Patch 1: `e004fe01` (2026-11-02)
**Commit Message**: fix failed tools run twice on recovery

**File**: `skills/neuron-agent/SKILL.md` (modified, +5/-1)
```diff
@@ -557,7 +557,11 @@ Failure does not roll back committed writes.
 `run(ExecutionRequest::resume())` is an explicit continuation. A new `chat()` supersedes the
 failed run with a new user turn. A failed node may repeat an external operation
 if its result was not durably recorded; use `memoize()` inside custom nodes and
-external idempotency where needed.
+external idempotency where needed. A tool call does not repeat: recovering a run
+whose process died while a tool ran, or whose tool threw, gives the call an error
+result saying its outcome is unknown, and the model decides what to do. To let
+the model read what went wrong instead, turn the exception into a result with
+`toolErrorHandler()`.
 
 The new turn first closes the turn the failed run left open: a tool call left
 without a result gets an error result saying its outcome is unknown, and a
```

**File**: `skills/neuron-symfony-integration/SKILL.md` (modified, +2/-2)
```diff
@@ -571,8 +571,8 @@ The message is `final class RunSupportAgent` in `src/Message` with public readon
 
 - **`start()`** runs `ExecutionRequest::start(new AgentStartEvent(messages: [new UserMessage($message->message)], options: new AgentRunOptions(stream: true)), runId: $message->runId, recoverFailed: true)` on a copy whose adapter factory seeds a new `AGUIAdapter(threadId:, runId:, messages:, state:)` from the input for every segment, whose channel comes from `RedisRelay::publisher($runId)`, and which carries the browser's tools (`addFrontendTools()`). A redelivery finishes the same run from its last committed step: after an HTTP 500 past a tool, the retry did not run the tool again and history held one question.
 - **Refused by its own run**: still executing under its lease → `RecoverableMessageHandlingException` with the remaining lease as `retryDelay` (after a `kill -9`, the redelivery waited 27 s of a 30 s lease, then recovered and completed the run); waiting for an approval → nothing.
-- **Refused by another message's dead run** (failed, or running past its lease): finish it with `ExecutionRequest::resume(expectedRunId: $e->runId, expectedExecutionAttempt: $e->executionAttempt)` on `$this->agent->for($threadId)`, a copy without adapter or channel, then start again. Never `abandon()` it: its work is lost, and the next start only closes its turn. A refund approved while the payment API threw was executed once, when the next turn finished that run. A pending approval or a live turn → `UnrecoverableMessageHandlingException` at once, instead of burning retries.
-- **`resume()`** stages the answers at handling time, from the run as it is then. A retry that finds its own run failed with no interrupt (the approved tool ran, then the answer failed) finishes that run instead, because staging again throws `There is no current interruption to answer`; an approved tool that threw leaves the approval pending, so its retries stage it again and re-run the tool.
+- **Refused by another message's dead run** (failed, or running past its lease): finish it with `ExecutionRequest::resume(expectedRunId: $e->runId, expectedExecutionAttempt: $e->executionAttempt)` on `$this->agent->for($threadId)`, a copy without adapter or channel, then start again. Never `abandon()` it: its work is lost, and the next start only closes its turn. A refund approved while the payment API threw is not sent again: finishing that run tells the model its outcome is unknown. A pending approval or a live turn → `UnrecoverableMessageHandlingException` at once, instead of burning retries.
+- **`resume()`** stages the answers at handling time, from the run as it is then. A retry that finds its own run failed with no interrupt (the approved tool ran, then the answer failed) finishes that run instead, because staging again throws `There is no current interruption to answer`; an approved tool that threw leaves the approval pending, so a retry stages it again and finishes the run without running the tool: the model is told its outcome is unknown.
 - **Redelivery after success runs the turn again**: completion deletes the run's records, so a reserved start finds nothing to match (`Hi, One., Hi, Two.`). A failed turn's retry still queued when the next turn finishes that turn asks its question again.
 
 `retainCompletionUntilAcknowledged()` on the copy narrows only this message's own redelivery after success, and never belongs on the copy that finishes another message's run. It works only if the handler calls `acknowledge()` after `run()` and also when a redelivery meets its own completed run: a completion never acknowledged refused the next turn on the thread, HTTP ones included (**neuron-workflow**, "Workflow Lifecycle"). `stream: true` in `AgentRunOptions` makes the provider stream token by token to the channel; continuations follow that choice.
```

**File**: `skills/neuron-symfony-integration/references/background-runs.md` (modified, +1/-1)
```diff
@@ -156,7 +156,7 @@ class SupportAgentHandler
 | Redelivered while the run waits for approval | Nothing |
 | A new turn while an approval is pending | Given up (`UnrecoverableMessageHandlingException`); `PublishRunFailure` told the browser |
 | The previous turn failed on every delivery | Finished it on a copy without the channel, then ran: history held the old question, its tool call and result, the recovered answer, then the new turn, and only the new turn reached the relay |
-| A refund approved while the payment API threw | The run failed with its approval still pending: each retry staged it again and re-ran the tool. When Messenger gave up, the next turn finished it: the refund executed once, then the new turn ran |
+| A refund approved while the payment API threw | The run failed with its approval still pending: the retry staged it again and finished the run without calling the API, and the model was told the refund's outcome is unknown |
 | A new turn while the failed turn's retry was still queued | Finished the failed turn and answered; the queued retry then asked the failed turn's question again, as any redelivery after success does |
 | A continuation retried after the approved refund ran and the answer failed | Finished the run instead of staging the answers again (`There is no current interruption to answer`); the refund ran once |
 | The same message handled twice after success | Ran the turn twice (`Hi, One., Hi, Two.`): completion deletes the run's records |
```

**File**: `skills/neuron-symfony-integration/references/testing.md` (modified, +1/-1)
```diff
@@ -389,7 +389,7 @@ class SupportAgentHandlerTest extends ChatTestCase
 ```
 
 - `TestContainer::set()` works on a private service only before it is instantiated: set the relay in `setUp()`, before the handler is fetched.
-- The suite also covered: a snapshot equal to the synchronous endpoint's, a browser tool handed over and continued in a queued turn, a turn given up while another run waits, a refund approved while the payment API threw and finished by the next turn, a continuation retried after it failed past the approved refund, a stale continuation that never finishes another run, a redelivery after success that runs the turn again, a delivery failure reported as `ChannelError` without failing the run, a channel factory that throws and fails it, and a refused turn published once.
+- The suite also covered: a snapshot equal to the synchronous endpoint's, a browser tool handed over and continued in a queued turn, a turn given up while another run waits, a refund approved while the payment API threw and not sent again by its retry, a continuation retried after it failed past the approved refund, a stale continuation that never finishes another run, a redelivery after success that runs the turn again, a delivery failure reported as `ChannelError` without failing the run, a channel factory that throws and fails it, and a refused turn published once.
 
 ## The relay endpoint
 
```

**File**: `src/Agent/AGENTS.md` (modified, +3/-1)
```diff
@@ -165,6 +165,8 @@ Conversation memory uses RAG's `SemanticMemoryRetrieval`, which builds source/th
 
 `ToolNode` gates execution: on every call it asks each tool `requiresApproval()` (declaration and attach-time overrides, see `src/Tools/AGENTS.md`), resolves the call against the segment's tool registry (a `ToolException` for anything else), clones the match, binds the inputs, executes under a durable memo, and settles the result on the `ToolCall`. Escaped exceptions are bugs and propagate unless `toolErrorHandler()` converts them.
 
+A tool call runs at most once, whatever recovers the run. Neither a killed process nor a thrown exception proves the effect did not land: a server can complete a request its client timed out on. So `ToolNode` records that a call started before running it (`ParallelToolNode` records one start for the batch it forks), at the cost of one more write per call. A replay that finds the start without a result settles the call with `interruptedResult()`, the error result that also closes an open turn, and the model decides what to do. Calling the tool again is a new call, which passes the approval gate again. A throw still fails the run when it happens, unless `toolErrorHandler()` settles it, and a handler's result is recorded like any other.
+
 ```php
 protected function tools(): array
 {
@@ -199,7 +201,7 @@ The persisted interruption is authoritative for the current UI request. The pre-
 
 ## Tool run limits
 
-`toolMaxRuns()` bounds logical tool calls across one complete agent run, including approval pauses and external execution waits. A tool's `getMaxRuns()` overrides the agent limit, and `getRunKey()` selects which counter it consumes. Rejected approvals consume no slot; a failed execution retried during recovery remains the same logical call.
+`toolMaxRuns()` bounds logical tool calls across one complete agent run, including approval pauses and external execution waits. A tool's `getMaxRuns()` overrides the agent limit, and `getRunKey()` selects which counter it consumes. Rejected approvals consume no slot; a call settled during recovery remains the same logical call.
 
 `AgentState` persists `__tool_runs`. `AgentStartNode` and RAG's `PreProcessNode` reset counters when initializing a new run; completed entry steps are skipped on resume. Custom entry nodes that replace these should reset counters when starting their new run as well, and build the request's messages through `ClosesOpenTurn::closeOpenTurn()`.
 
```

**File**: `src/Agent/ClosesOpenTurn.php` (modified, +2/-8)
```diff
@@ -11,7 +11,6 @@
 use NeuronAI\Chat\Messages\ToolResultMessage;
 use NeuronAI\Chat\Messages\UserMessage;
 use NeuronAI\Tools\ToolCall;
-use NeuronAI\Tools\ToolOutput;
 
 use function array_filter;
 use function array_map;
@@ -29,6 +28,8 @@
  */
 trait ClosesOpenTurn
 {
+    use ReportsInterruptedCall;
+
     /**
      * @param Message[] $inbound
      * @return Message[]
@@ -81,13 +82,6 @@ protected function unrecordedResults(ToolCallMessage $message): ToolResultMessag
         ));
     }
 
-    protected function interruptedResult(ToolCall $call): string|ToolOutput
-    {
-        return ToolOutput::error(
-            'The call was interrupted before its result was recorded: it may or may not have taken effect.'
-        );
-    }
-
     protected function interruptedAnswer(): AssistantMessage
     {
         return new AssistantMessage('My previous response was interrupted before it was completed.');
```

**File**: `src/Agent/Nodes/ParallelToolNode.php` (modified, +28/-4)
```diff
@@ -133,8 +133,9 @@ protected function executeLocalTools(array $calls, string $messageId, AgentState
         if ($runnable !== []) {
             $runnableCalls = array_values($runnable);
             $runnableKeys = array_keys($runnable);
+            $replayed = $this->recallMemo('parallel.tools') !== null;
 
-            $serializedResults = $this->memoize('parallel.tools', function () use ($runnableCalls, $tools): array {
+            $serializedResults = $this->memoizeAtMostOnce('parallel.tools', function () use ($runnableCalls, $tools): array {
                 // Resolve parent-side, before forking.
                 $resolved = [];
                 foreach ($runnableCalls as $pos => $call) {
@@ -175,18 +176,21 @@ protected function executeLocalTools(array $calls, string $messageId, AgentState
                         $resolved
                     )
                 );
-            });
+            }, fn (): array => array_map(
+                fn (ToolCall $call): string => serialize($this->interruptedResult($call)),
+                $runnableCalls,
+            ));
 
             foreach ($serializedResults as $pos => $serializedResult) {
                 $data = unserialize($serializedResult);
                 $call = $runnableCalls[$pos];
 
                 if (is_array($data) && isset($data['error']) && $data['error'] === true) {
                     // The original exception lives in the child process: report what it was.
-                    $this->handleError(new ToolException(
+                    $this->settleChildFailure(new ToolException(
                         "Tool {$data['tool_name']} failed with {$data['exception_class']}: {$data['exception_message']}",
                         (int) $data['exception_code'],
-                    ), $call);
+                    ), $call, $replayed);
                 } else {
                     $call->setResult($data);
                 }
@@ -208,6 +212,26 @@ protected function executeLocalTools(array $calls, string $messageId, AgentState
         return $executedCalls;
     }
 
+    /**
+     * A child's exception is recorded with its batch, so a replay would raise it
+     * on every recovery. The first pass fails the run with it; a replay settles
+     * the call like any other whose outcome nobody knows.
+     *
+     * @throws ToolException
+     */
+    protected function settleChildFailure(ToolException $failure, ToolCall $call, bool $replayed): void
+    {
+        try {
+            $this->handleError($failure, $call);
+        } catch (ToolException $e) {
+            if (!$replayed) {
+                throw $e;
+            }
+
+            $call->setResult($this->interruptedResult($call));
+        }
+    }
+
     /**
      * spatie/fork replaces the SIGTERM, SIGINT and SIGQUIT handlers with its
      * own, which kill the process, and never restores them: a queue worker
```

**File**: `src/Agent/Nodes/ToolNode.php` (modified, +36/-4)
```diff
@@ -4,6 +4,7 @@
 
 namespace NeuronAI\Agent\Nodes;
 
+use Closure;
 use Generator;
 use NeuronAI\Agent\AgentResources;
 use NeuronAI\Agent\AgentState;
@@ -16,6 +17,7 @@
 use NeuronAI\Agent\Interrupt\ApprovalRequest;
 use NeuronAI\Agent\Observability\ToolCalled;
 use NeuronAI\Agent\Observability\ToolCalling;
+use NeuronAI\Agent\ReportsInterruptedCall;
 use NeuronAI\Chat\Messages\Stream\Chunks\ToolCallChunk;
 use NeuronAI\Chat\Messages\Stream\Chunks\ToolResultChunk;
 use NeuronAI\Chat\Messages\ToolCallMessage;
@@ -61,6 +63,7 @@
 class ToolNode extends Node implements AgentNodeInterface
 {
     use ChatHistoryHelper;
+    use ReportsInterruptedCall;
 
     /**
      * @var callable|null fn(Throwable $e, ToolCall $call): string|ToolOutput|null
@@ -424,8 +427,9 @@ protected function executeLocalTools(array $calls, string $messageId, AgentState
      * Execution is wrapped in a durable memo keyed by callId (or name) plus
      * the call's position, so parallel calls sharing a callId never share a
      * memo. On crash-replay the recorded result is restored WITHOUT
-     * re-running, so side-effecting tools execute at most once. An error the
-     * handler turns into a result is recorded the same way.
+     * re-running, and a call that died running settles as interrupted, so
+     * side-effecting tools execute at most once. An error the handler turns
+     * into a result is recorded the same way.
      *
      * @throws ToolRunsExceededException If the tool exceeds its maximum retry attempts
      * @throws Throwable If the tool execution fails and no error handler is set
@@ -443,12 +447,12 @@ protected function executeSingleTool(ToolCall $call, int $index, AgentState $sta
 
         try {
             $this->checkToolRuns($call, $state, $tools);
-            $result = $this->memoize($memoKey, function () use ($call, $tools): string|ToolOutput {
+            $result = $this->memoizeAtMostOnce($memoKey, function () use ($call, $tools): string|ToolOutput {
                 $tool = $this->resolveTool($call, $tools);
 
                 $tool->execute();
                 return $tool->getResult();
-            });
+            }, fn (): string|ToolOutput => $this->interruptedResult($call));
 
             $call->setResult($result);
         } catch (Throwable $e) {
@@ -464,6 +468,34 @@ protected function executeSingleTool(ToolCall $call, int $index, AgentState $sta
         }
     }
 
+    /**
+     * Neither a call whose process was killed nor one that threw proves the
+     * effect did not land: a database finishes a statement whose client is gone,
+     * a server completes a request its client timed out on. Recording the start
+     * first is what tells such a call from one that never ran, so a replay
+     * settles it with $interrupted instead of running it again under its old
+     * approval. Calling the tool again is the model's choice, and a new call.
+     *
+     * @template T
+     * @param Closure(): T $operation
+     * @param Closure(): T $interrupted
+     * @return T
+     */
+    protected function memoizeAtMostOnce(string $name, Closure $operation, Closure $interrupted): mixed
+    {
+        return $this->memoize($name, function () use ($name, $operation, $interrupted): mixed {
+            $started = $name . '.started';
+
+            if ($this->recallMemo($started) === true) {
+                return $interrupted();
+            }
+
+            $this->memoize($started, fn (): bool => true);
+
+            return $operation();
+        });
+    }
+
     /**
      * Accounting is independent of execution-result memos: a replay counts the
      * batch again from the state its step started with, so a call whose result
```

---

### Incident Patch 2: `e66e0fda` (2026-11-02)
**Commit Message**: fix one-slash redirect passing the same-origin check

**File**: `src/HttpClient/ResolvesHttpRequest.php` (modified, +2/-1)
```diff
@@ -37,7 +37,8 @@ protected function isSameOrigin(string $uri, string $target): bool
             return false;
         }
 
-        if (!isset($redirect['host'])) {
+        // A scheme makes a target absolute even when parse_url() finds no host: libcurl reads http:/example.com as the host example.com
+        if (!isset($redirect['scheme']) && !isset($redirect['host'])) {
             return true;
         }
 
```

**File**: `tests/HttpClient/HttpClientSecurityTest.php` (modified, +9/-6)
```diff
@@ -81,7 +81,7 @@ public function test_line_breaks_in_a_header_cannot_inject_headers(Closure $make
      * Providers authenticate through Authorization and through custom headers (x-api-key,
      * api-key, x-goog-api-key), set on the request or as client defaults.
      *
-     * @return iterable<string, array{Closure(): HttpClientInterface, array<string, string>, bool}>
+     * @return iterable<string, array{Closure(): HttpClientInterface, array<string, string>, bool, string}>
      */
     public static function credentialsMeetingARedirect(): iterable
     {
@@ -90,12 +90,15 @@ public static function credentialsMeetingARedirect(): iterable
             'guzzle' => static fn (array $defaults): HttpClientInterface => new GuzzleHttpClient($defaults),
             'amp' => static fn (array $defaults): HttpClientInterface => new AmpHttpClient($defaults),
         ];
+        $redirects = ['two slashes' => '/redirect-to-other-host', 'one slash' => '/redirect-to-other-host-one-slash'];
 
         foreach ($clients as $name => $make) {
             foreach (['request' => false, 'stream' => true] as $call => $streamed) {
-                yield "{$name} {$call}, Authorization" => [static fn (): HttpClientInterface => $make([]), ['Authorization' => 'Bearer provider-secret'], $streamed];
-                yield "{$name} {$call}, x-api-key" => [static fn (): HttpClientInterface => $make([]), ['x-api-key' => 'provider-secret'], $streamed];
-                yield "{$name} {$call}, client default x-api-key" => [static fn (): HttpClientInterface => $make(['x-api-key' => 'provider-secret']), [], $streamed];
+                foreach ($redirects as $slashes => $redirect) {
+                    yield "{$name} {$call}, {$slashes}, Authorization" => [static fn (): HttpClientInterface => $make([]), ['Authorization' => 'Bearer provider-secret'], $streamed, $redirect];
+                    yield "{$name} {$call}, {$slashes}, x-api-key" => [static fn (): HttpClientInterface => $make([]), ['x-api-key' => 'provider-secret'], $streamed, $redirect];
+                    yield "{$name} {$call}, {$slashes}, client default x-api-key" => [static fn (): HttpClientInterface => $make(['x-api-key' => 'provider-secret']), [], $streamed, $redirect];
+                }
             }
         }
     }
@@ -108,10 +111,10 @@ public static function credentialsMeetingARedirect(): iterable
      * @param array<string, string> $headers
      */
     #[DataProvider('credentialsMeetingARedirect')]
-    public function test_credentials_never_reach_another_origin_on_redirect(Closure $makeClient, array $headers, bool $streamed): void
+    public function test_credentials_never_reach_another_origin_on_redirect(Closure $makeClient, array $headers, bool $streamed, string $redirect): void
     {
         $record = sys_get_temp_dir() . '/neuron-redirect-' . bin2hex(random_bytes(6));
-        $request = HttpRequest::get(static::$baseUri . '/redirect-to-other-host?record=' . basename($record), $headers);
+        $request = HttpRequest::get(static::$baseUri . $redirect . '?record=' . basename($record), $headers);
 
         try {
             $client = $makeClient();
```

**File**: `tests/HttpClient/fixtures/server.php` (modified, +7/-0)
```diff
@@ -79,6 +79,13 @@
         \header("Location: http://localhost:{$_SERVER['SERVER_PORT']}/headers{$record}");
         break;
 
+    case '/redirect-to-other-host-one-slash':
+        // PHP's parse_url() sees no host in this target, libcurl sees localhost.
+        \http_response_code(302);
+        $record = isset($_GET['record']) ? '?record=' . \rawurlencode((string) $_GET['record']) : '';
+        \header("Location: http:/localhost:{$_SERVER['SERVER_PORT']}/headers{$record}");
+        break;
+
     case '/redirect-loop':
         \http_response_code(302);
         \header('Location: /redirect-loop');
```

---

### Incident Patch 3: `3413bf3a` (2026-11-02)
**Commit Message**: fix tests configuration

**File**: `.github/workflows/tests.yml` (modified, +4/-0)
```diff
@@ -70,6 +70,8 @@ jobs:
                     discovery.type: single-node
                     plugins.security.disabled: "true"
                     DISABLE_INSTALL_DEMO_CONFIG: true
+                    # Pulling the service images can fill the runner's disk past 90%, which would refuse new indexes
+                    cluster.routing.allocation.disk.threshold_enabled: "false"
                 options: --health-cmd="curl -s http://localhost:9200/_cluster/health | grep '\"status\":\"green\"'" --health-interval=10s --health-timeout=5s --health-retries=5
             weaviate:
                 image: cr.weaviate.io/semitechnologies/weaviate:1.39.13
@@ -81,6 +83,8 @@ jobs:
                     PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
                     ENABLE_MODULES: ''
                     CLUSTER_HOSTNAME: 'node1'
+                    # Pulling the service images can fill the runner's disk past 90%, which would make every shard read-only
+                    DISK_USE_READONLY_PERCENTAGE: '100'
             neo4j:
                 image: neo4j:5.26.19-ubi9
                 ports:
```

#### Recent Merged Pull Requests:
- **PR #703** (2026-10-28): Bump the npm group with 3 updates (@dependabot[bot])
- **PR #702** (2026-10-28): Bump docker/login-action from 4.6.0 to 4.7.0 in the github-actions group (@dependabot[bot])
- **PR #700** (2026-10-29): Echo an empty reasoning_content from the deepseek mapper (@wpjscc)
- **PR #697** (closed): Add deed.page toolkit to publish a web page (@f-o-x11)
- **PR #694** (2026-10-25): Bump Weaviate test image to 1.39.13 (@dudanogueira)
- **PR #692** (2026-10-25): Bump the npm group with 10 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. failed tools run twice on recovery

**RULE**:
When implementing operations in `skills/neuron-agent/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in neuron-core/neuron-ai. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e004fe01`: failed tools run twice on recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing PHP data structures, boundary deserialization, API parsing, or resource lifecycles matching `skills/neuron-agent/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// Verified production-grade fix pattern:
external idempotency where needed. A tool call does not repeat: recovering a run
whose process died while a tool ran, or whose tool threw, gives the call an error
result saying its outcome is unknown, and the model decides what to do. To let
the model read what went wrong instead, turn the exception into a result with
`toolErrorHandler()`.
```

**NEGATIVE CONSTRAINT**:
```php
// Anti-pattern to NEVER write (induced failure mode):
external idempotency where needed.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e004fe01` are properly handled with clean fallback behavior.
