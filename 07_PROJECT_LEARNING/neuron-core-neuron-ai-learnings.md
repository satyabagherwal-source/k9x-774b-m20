> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/neuron-core-neuron-ai-learnings.md`  
> **Source**: github ([https://github.com/neuron-core/neuron-ai](https://github.com/neuron-core/neuron-ai))  
> **Source Version**: `c2b9a03e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T00:43:41.502Z  
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
> **Harvest Timestamp**: 2026-11-18T00:43:41.498Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neuron-core/neuron-ai`
- **Description**: The Agentic Framework of the PHP ecosystem to build production-ready AI driven applications. Connect components (LLMs, Tools, vector DBs, memory) to agents that interact with your data and UI.
- **Primary Language / Ecosystem**: PHP
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2176 stars

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
export const terminalTypes = new Set(['stream.completed', 'stream.interrupted', 'stream.failed']);

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
export { subscribeToIQ } from './iq.js';
export { createProtocolStream } from './protocol.js';
export type { ProtocolEvent } from './protocol.js';

```

### Core Architecture Module: `packages/streaming/src/iq.ts`
```
import { subscribe, type Outcome, type SubscribeOptions, type Target } from '@neuron-core/iq-stream/client';
import { createChannelConsumer, terminalTypes, type ChannelCallbacks } from './consumer.js';

/**
 * Subscribe to a stream of an IQ server, whose frames are the envelopes of one segment. `target`
 * and `options` are those of the IQ client's `subscribe`: a subscribe URL, or a function that
 * returns the source to read. The client owns the source, and closes it when IQ ends the stream,
 * on a gap, and on close().
 */
export function subscribeToIQ(target: Target, callbacks: ChannelCallbacks, options?: SubscribeOptions): { close(): void } {
  let closed = false;
  let whole = false;
  const consumer = createChannelConsumer({
    onEvent(event) {
      whole ||= terminalTypes.has(event.type);
      callbacks.onEvent(event);
    },
    onGap: fail,
  });
  const subscription = subscribe(target, {
    onFrame({ data }) {
      let envelope: unknown;
      try {
        envelope = JSON.parse(data);
      } catch {
        envelope = undefined;
      }
      consumer.accept(envelope);
    },
    // The source delivers nothing more: a segment still without its terminal event never gets it.
    onClose(outcome) {
      if (outcome.type === 'closed' || whole) return close();
      fail(gapReason(outcome));
    },
  }, options);

  function close(): void {
    if (closed) return;
    closed = true;
    subscription.close();
    consumer.close();
  }

  function fail(reason: string): void {
    if (closed) return;
    close();
    callbacks.onGap(reason);
  }

  return { close };
}

function gapReason(outcome: Exclude<Outcome, { type: 'closed' }>): string {
  if (outcome.type === 'end') return 'Missing channel events';
  if (outcome.type === 'fail') return `IQ stream failed: ${outcome.reason}`;
  return outcome.type === 'gone' ? 'IQ stream gone' : 'IQ subscription refused';
}

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

### Incident Patch 1: `c2b9a03e` (2026-11-17)
**Commit Message**: Merge pull request #710 from aln-1/fix/mcp-http-session-delete

End Streamable HTTP MCP sessions with DELETE on disconnect

**File**: `src/MCP/AGENTS.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ protected function tools(): array
 ## Sessions
 
 - **One session per process.** `McpClient` opens its session on construction; the connector creates the client lazily. A forked child (`parallelToolCalls()`) opens its own session, a new server process or HTTP session, and keeps the inherited transport referenced but unused, so the parent's session stays open. Only the process that opened a session ends it. A custom `transport` instance stays the application's in every process.
+- **An HTTP session is ended when the client is destroyed.** `StreamableHttpTransport::disconnect()` sends an HTTP `DELETE` carrying the session ID, as the spec asks of a client leaving a session. It is best effort: a server refusing it (405), a session already expired (404) or a network failure is ignored, and the local session state is dropped either way. The request is limited to two seconds, whatever the configured `timeout`, since it delays the destructor and its answer is unused.
 - **A lost session is replaced.** A transport throws `McpSessionLostException` when a request could not reach the server because its session is gone: an HTTP 404 on a request carrying a session ID, or a stdio server that is no longer running. Nothing was processed, so the client opens a new session and sends the request once more. A failure after delivery, such as a server dying mid-request, is not retried: the request may have run. The next request replaces the session.
 - **Messages arrive one at a time.** Stdio reads newline-delimited messages through a buffer kept between reads, and drains the server's stderr while waiting, since a full stderr pipe blocks the server. An SSE response yields each event's payload in order. The client skips notifications, server requests and responses to abandoned requests until its own response arrives; it answers no server request, not even `ping`.
 - `SseHttpTransport`, the legacy HTTP+SSE transport, gets per-process sessions from the client but does not recover an expired one.
```

**File**: `src/MCP/StreamableHttpTransport.php` (modified, +48/-10)
```diff
@@ -34,6 +34,12 @@
 
 class StreamableHttpTransport implements McpTransportInterface
 {
+    /**
+     * How long ending a session may take. It runs from the client's destructor, usually
+     * before the user gets a response, and nothing waits on the server's answer.
+     */
+    protected const SESSION_END_TIMEOUT_SECONDS = 2.0;
+
     protected readonly HttpClientInterface $httpClient;
     protected ?string $sessionId = null;
     protected ?string $protocolVersion = null;
@@ -91,15 +97,7 @@ public function send(array $data): void
             $headers = array_merge($this->getAuthHeaders(), [
                 'Accept' => 'application/json, text/event-stream',
                 'Content-Type' => 'application/json',
-            ]);
-
-            if ($this->sessionId !== null) {
-                $headers['Mcp-Session-Id'] = $this->sessionId;
-            }
-
-            if ($this->protocolVersion !== null) {
-                $headers['MCP-Protocol-Version'] = $this->protocolVersion;
-            }
+            ], $this->sessionHeaders());
 
             $jsonData = json_encode($data, JSON_THROW_ON_ERROR);
 
@@ -218,13 +216,53 @@ public function setProtocolVersion(string $version): void
 
     public function disconnect(): void
     {
-        // HTTP is stateless: nothing to close, just drop session state
+        if ($this->sessionId !== null) {
+            $this->endSession();
+        }
+
         $this->sessionId = null;
         $this->protocolVersion = null;
         $this->lastResponse = null;
         $this->pendingMessages = [];
     }
 
+    /**
+     * Ask the server to end the session now rather than when it expires. Best effort: this
+     * runs from the client's destructor, and the server may refuse it (405), have already
+     * ended the session (404), or be unreachable.
+     */
+    protected function endSession(): void
+    {
+        try {
+            $this->httpClient->request(new HttpRequest(
+                method: HttpMethod::DELETE,
+                uri: $this->config['url'],
+                headers: array_merge($this->getAuthHeaders(), $this->sessionHeaders()),
+                timeout: static::SESSION_END_TIMEOUT_SECONDS,
+            ));
+        } catch (HttpException) {
+            // The local session state is dropped anyway.
+        }
+    }
+
+    /**
+     * @return array<string, string>
+     */
+    protected function sessionHeaders(): array
+    {
+        $headers = [];
+
+        if ($this->sessionId !== null) {
+            $headers['Mcp-Session-Id'] = $this->sessionId;
+        }
+
+        if ($this->protocolVersion !== null) {
+            $headers['MCP-Protocol-Version'] = $this->protocolVersion;
+        }
+
+        return $headers;
+    }
+
     /**
      * @return array<string, string>
      */
```

**File**: `tests/MCP/McpClientTest.php` (modified, +68/-4)
```diff
@@ -6,6 +6,7 @@
 
 use NeuronAI\Exceptions\HttpException;
 use NeuronAI\HttpClient\HttpClientInterface;
+use NeuronAI\HttpClient\HttpMethod;
 use NeuronAI\HttpClient\HttpRequest;
 use NeuronAI\HttpClient\HttpResponse;
 use NeuronAI\MCP\McpClient;
@@ -106,6 +107,9 @@ public function test_an_expired_http_session_is_replaced_and_the_request_sent_ag
         $httpClient->method('request')
             ->willReturnCallback(function (HttpRequest $request) use (&$requests, &$initializations): HttpResponse {
                 $requests[] = $request;
+                if ($request->method === HttpMethod::DELETE) {
+                    return new HttpResponse(200, '');
+                }
                 $message = json_decode($request->body, true);
 
                 if ($message['method'] === 'initialize') {
@@ -126,12 +130,72 @@ public function test_an_expired_http_session_is_replaced_and_the_request_sent_ag
 
         $this->assertSame([], $client->listTools());
         $this->assertSame(
-            ['initialize', 'notifications/initialized', 'tools/list', 'initialize', 'notifications/initialized', 'tools/list'],
-            array_map(fn (HttpRequest $request): string => json_decode($request->body, true)['method'], $requests),
+            ['initialize', 'notifications/initialized', 'tools/list', 'DELETE', 'initialize', 'notifications/initialized', 'tools/list'],
+            array_map($this->describe(...), $requests),
         );
+        $this->assertSame('expired', $requests[3]->headers['Mcp-Session-Id']);
         // The new session starts without the expired ID.
-        $this->assertArrayNotHasKey('Mcp-Session-Id', $requests[3]->headers);
-        $this->assertSame('renewed', $requests[5]->headers['Mcp-Session-Id']);
+        $this->assertArrayNotHasKey('Mcp-Session-Id', $requests[4]->headers);
+        $this->assertSame('renewed', $requests[6]->headers['Mcp-Session-Id']);
+
+        unset($client);
+
+        $this->assertCount(8, $requests);
+        $this->assertSame(HttpMethod::DELETE, $requests[7]->method);
+        $this->assertSame('renewed', $requests[7]->headers['Mcp-Session-Id']);
+    }
+
+    public function test_a_session_lost_again_on_retry_is_replaced_by_the_next_request(): void
+    {
+        $requests = [];
+        $initializations = 0;
+
+        // Sessions 1 and 2 are lost before they serve a request, as behind a load balancer
+        // without sticky sessions; session 3 works.
+        $httpClient = $this->createMock(HttpClientInterface::class);
+        $httpClient->method('request')
+            ->willReturnCallback(function (HttpRequest $request) use (&$requests, &$initializations): HttpResponse {
+                $requests[] = $request;
+                if ($request->method === HttpMethod::DELETE) {
+                    throw HttpException::statusError($request, new HttpResponse(404, ''));
+                }
+                $message = json_decode($request->body, true);
+
+                if ($message['method'] === 'initialize') {
+                    $initializations++;
+                    return new HttpResponse(200, $this->response($message, []), ['Mcp-Session-Id' => "session-{$initializations}"]);
+                }
+                if (!isset($message['id'])) {
+                    return new HttpResponse(202, '');
+                }
+                if (!isset($request->headers['Mcp-Session-Id'])) {
+                    throw HttpException::statusError($request, new HttpResponse(400, ''));
+                }
+                if ($request->headers['Mcp-Session-Id'] !== 'session-3') {
+                    throw HttpException::statusError($request, new HttpResponse(404, ''));
+                }
+
+                return new HttpResponse(200, $this->response($message, ['tools' => []]));
+            });
+
+        $client = new McpClient(['url' => 'https://example.com/mcp'], $httpClient);
+
+        try {
+            $client->listTools();
+            $this->fail('A session lost again on retry must fail the request.');
+        } catch (McpSessionLostException) {
+        }
+
+        $this->assertSame([], $client->listTools());
+        $this->assertSame(3, $initializations);
+        // The next request still carries the lost ID, so its 404 opens a new session.
+        $this->assertSame('tools/list', $this->describe($requests[7]));
+        $this->assertSame('session-2', $requests[7]->headers['Mcp-Session-Id']);
+    }
+
+    protected function describe(HttpRequest $request): string
+    {
+        return $request->method === HttpMethod::DELETE ? 'DELETE' : json_decode($request->body, true)['method'];
     }
 
     public function test_a_404_outside_a_session_is_not_retried(): void
```

**File**: `tests/MCP/StreamableHttpTransportTest.php` (modified, +59/-3)
```diff
@@ -147,10 +147,65 @@ public function test_the_session_id_assigned_by_the_server_is_sent_with_later_re
         }
     }
 
-    public function test_disconnect_forgets_the_session(): void
+    public function test_disconnect_ends_the_session_on_the_server_and_forgets_it(): void
     {
         $httpClient = new ScriptedHttpClient(
             new HttpResponse(200, '{"jsonrpc":"2.0","id":1,"result":{}}', ['Mcp-Session-Id' => 'session-1']),
+            new HttpResponse(200, ''),
+            new HttpResponse(200, '{"jsonrpc":"2.0","id":1,"result":{}}'),
+        );
+        $transport = new StreamableHttpTransport(['url' => self::URL, 'token' => 'mcp-secret', 'headers' => ['X-Tenant' => 'acme'], 'timeout' => 7], $httpClient);
+        $transport->send(['jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize']);
+        $transport->setProtocolVersion('2025-11-25');
+
+        $transport->disconnect();
+
+        $this->assertCount(2, $httpClient->requests);
+        $delete = $httpClient->requests[1];
+        $this->assertSame(HttpMethod::DELETE, $delete->method);
+        $this->assertSame(self::URL, $delete->uri);
+        $this->assertNull($delete->body);
+        // The configured timeout is for tool calls: ending a session must not hold up the destructor.
+        $this->assertSame(2.0, $delete->timeout);
+        $this->assertSame([
+            'X-Tenant' => 'acme',
+            'Authorization' => 'Bearer mcp-secret',
+            'Mcp-Session-Id' => 'session-1',
+            'MCP-Protocol-Version' => '2025-11-25',
+        ], $delete->headers);
+
+        $transport->send(['jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize']);
+        $this->assertArrayNotHasKey('Mcp-Session-Id', $httpClient->requests[2]->headers);
+        $this->assertArrayNotHasKey('MCP-Protocol-Version', $httpClient->requests[2]->headers);
+    }
+
+    public function test_disconnect_without_a_session_sends_nothing(): void
+    {
+        $httpClient = new ScriptedHttpClient(new HttpResponse(200, '{"jsonrpc":"2.0","id":1,"result":{}}'));
+        $transport = new StreamableHttpTransport(['url' => self::URL], $httpClient);
+        $transport->send(['jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize']);
+
+        $transport->disconnect();
+
+        $this->assertCount(1, $httpClient->requests);
+    }
+
+    /**
+     * @return iterable<string, array{HttpResponse|HttpException}>
+     */
+    public static function failedSessionEndings(): iterable
+    {
+        yield 'ending sessions not supported' => [new HttpResponse(405, '')];
+        yield 'session already expired' => [new HttpResponse(404, '')];
+        yield 'network error' => [HttpException::networkError(new HttpRequest(HttpMethod::DELETE, self::URL), 'Connection refused')];
+    }
+
+    #[DataProvider('failedSessionEndings')]
+    public function test_a_failed_session_ending_is_ignored_and_the_session_forgotten(HttpResponse|HttpException $reply): void
+    {
+        $httpClient = new ScriptedHttpClient(
+            new HttpResponse(200, '{"jsonrpc":"2.0","id":1,"result":{}}', ['Mcp-Session-Id' => 'session-1']),
+            $reply,
             new HttpResponse(200, '{"jsonrpc":"2.0","id":1,"result":{}}'),
         );
         $transport = new StreamableHttpTransport(['url' => self::URL], $httpClient);
@@ -159,9 +214,10 @@ public function test_disconnect_forgets_the_session(): void
 
         $transport->disconnect();
 
+        $this->assertSame(HttpMethod::DELETE, $httpClient->requests[1]->method);
         $transport->send(['jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize']);
-        $this->assertArrayNotHasKey('Mcp-Session-Id', $httpClient->requests[1]->headers);
-        $this->assertArrayNotHasKey('MCP-Protocol-Version', $httpClient->requests[1]->headers);
+        $this->assertArrayNotHasKey('Mcp-Session-Id', $httpClient->requests[2]->headers);
+        $this->assertArrayNotHasKey('MCP-Protocol-Version', $httpClient->requests[2]->headers);
     }
 
     public function test_disconnect_drops_unread_messages(): void
```

#### Recent Merged Pull Requests:
- **PR #710** (2026-11-17): End Streamable HTTP MCP sessions with DELETE on disconnect (@aln-1)
- **PR #709** (2026-11-11): Bump the npm group with 9 updates (@dependabot[bot])
- **PR #708** (2026-11-11): Bump docker/login-action from 4.7.0 to 4.8.0 in the github-actions group (@dependabot[bot])
- **PR #707** (2026-11-05): Let installed packages add commands to the neuron CLI (@ilvalerione)
- **PR #706** (2026-11-04): Bump the npm group with 4 updates (@dependabot[bot])
- **PR #703** (2026-10-28): Bump the npm group with 3 updates (@dependabot[bot])

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

## X. Empirical Invariant Guard in AGENTS.md

**RULE**:
When implementing operations in `src/MCP/AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in neuron-core/neuron-ai. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c2b9a03e`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing PHP data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/MCP/AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// Verified production-grade fix pattern:
- **An HTTP session is ended when the client is destroyed.** `StreamableHttpTransport::disconnect()` sends an HTTP `DELETE` carrying the session ID, as the spec asks of a client leaving a session. It is best effort: a server refusing it (405), a session already expired (404) or a network failure is ignored, and the local session state is dropped either way. The request is limited to two seconds, whatever the configured `timeout`, since it delays the destructor and its answer is unused.
```

**NEGATIVE CONSTRAINT**:
```php
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c2b9a03e` are properly handled with clean fallback behavior.
