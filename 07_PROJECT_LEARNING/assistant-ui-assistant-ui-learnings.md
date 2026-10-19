> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/assistant-ui-assistant-ui-learnings.md`  
> **Source**: github ([https://github.com/assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui))  
> **Source Version**: `1960f3c2`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:07:11.484Z  
> **Learning ID**: `learn-github-assistant-ui-assistant-ui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): assistant-ui/assistant-ui

---

## 1. Executive Forensic Architecture & System Mechanics

`assistant-ui` is a decoupled, headless runtime engine and headless primitive system designed for conversational AI applications across web (React, Vue, Svelte), native (React Native/Expo), CLI (Ink), and edge environments (Cloudflare Workers/Durable Objects). 

### Architectural Boundary Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Consumers / Shells                              │
│       (Next.js, Expo, Cloudflare DO, Terminal Ink, Eval Engines)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ consumes
┌───────────────────────────────────▼────────────────────────────────────┐
│                    @assistant-ui/react / @assistant-ui/ui              │
│      Headless Radix/Base-UI Primitives (Composer, Thread, Message)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ binds reactive scopes via Tap
┌───────────────────────────────────▼────────────────────────────────────┐
│                         @assistant-ui/store                            │
│  State Wire, Scoped Signal Graph (ScopeRegistry), useSyncExternalStore │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ drives
┌───────────────────────────────────▼────────────────────────────────────┐
│                         @assistant-ui/core                             │
│        AssistantRuntimeCore, Orchestrators, Message Converters         │
└──────┬──────────────────────┬───────────────────────────┬──────────────┘
       │                      │                           │
┌──────▼────────┐     ┌───────▼────────┐          ┌───────▼────────┐
│  AI SDK /     │     │ LangGraph /    │          │ Custom Remote  │
│  assistant-   │     │ LangChain /    │          │ Adapters /     │
│  stream       │     │ OpenCode / ADK │          │ Statewire DO   │
└───────────────┘     └────────────────┘          └────────────────┘
```

The system operates across four primary planes:
1. **The Core Runtime Plane (`@assistant-ui/core`)**: Implements thread list lifecycle management, tree-structured branch navigation (`parentId`/`sourceId`), optimistic message mutation queues, run cancellation mechanics, and tool call approval/execution lifecycles.
2. **The Reactive State Wire (`@assistant-ui/store` & `@assistant-ui/tap`)**: A fine-grained reactive dependency graph. Rather than forcing a global monolithic React re-render or relying on coarse selectors, it implements scoped reactive contexts (`ScopeRegistry`: `threads`, `thread`, `message`, `part`, `composer`, `attachment`, `tool`, `suggestion`). Read operations are bridged into React via `useSyncExternalStore` combined with immediate synchronous accessors (`getState()`) to avoid controlled-input cursor displacement during fast typing or IME composition.
3. **The Adapter Translation Layer (`@assistant-ui/react-*`)**: Normalizes disparate upstream streaming interfaces (Vercel AI SDK UI message stream, LangChain Runnables, LangGraph state checkpoints, Google ADK, and OpenCode) into canonical `ThreadMessage` domain entities.
4. **The Primitive UI Layer (`@assistant-ui/react`)**: Headless, accessible primitives mimicking unstyled Radix-UI patterns. Primitives encapsulate ARIA combobox/textarea behavior, auto-scrolling virtual viewports, composition session boundaries, and generative UI component sandboxes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Path Read Alignment for Synchronous Controlled Inputs
**RULE**:
When synchronizing external state engines with React-controlled input components (e.g., textareas, content-editable blocks, or tokenized mention systems), the store MUST expose an immediate synchronous read-overlay (`getState()`) reflecting mutations prior to React's commit phase, while concurrently publishing synchronous updates via `useSyncExternalStore` using live subscriptions (`unstable_useClientSource`). A store MUST NOT defer state visibility until post-render commit when servicing input drivers.

**WHY**:
React's asynchronous or batched rendering causes controlled inputs (such as `react-mentions` or inputs undergoing IME composition) to experience an intermediate frame where internal DOM value differs from React props. If `onChange` writes to the store but `getState()` returns the previous committed snapshot during the same JavaScript turn, controlled components reset the native input value or move the selection caret (`selectionStart`/`selectionEnd`) unconditionally to the end of the text stream.

**WHEN TO APPLY**:
Apply to any framework-agnostic client store bridging into React via `useSyncExternalStore` where text input, cursor manipulation, or keystroke-level filtering is controlled by store state.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { useMemo, useSyncExternalStore } from "react";

type Subscribable<T> = {
  subscribe: (listener: () => void) => () => void;
  getState: () => T;
};

interface LiveReaderOptions {
  live?: boolean;
}

export function createSyncStoreFacade<TRuntimeState extends { text: string }, TPublicState extends { text: string }>(
  runtime: Subscribable<TRuntimeState>,
  transformState: (snapshot: TRuntimeState) => TPublicState,
  notifySource?: (subscribe: ((listener: () => void) => () => void) | undefined) => void,
) {
  return function useStoreClient(options?: LiveReaderOptions) {
    // 1. Direct subscription wiring into client source to prevent stale frame drops
    notifySource?.(options?.live ? runtime.subscribe : undefined);

    // 2. Standard React external store subscription
    const committedSnapshot = useSyncExternalStore(
      runtime.subscribe,
      runtime.getState,
      runtime.getState,
    );

    // 3. Stable committed state projection
    const stableState = useMemo(
      () => transformState(committedSnapshot),
      [committedSnapshot],
    );

    // 4. Immediate overlay accessor: checks live runtime snapshot directly
    // If the runtime was mutated during the current execution turn (pre-commit),
    // return an overlay snapshot so callers see changes synchronously.
    const getState = useMemo(() => {
      let overlaySnapshot: TRuntimeState | undefined;
      let overlay: TPublicState | undefined;

      return (): TPublicState => {
        const liveSnapshot = runtime.getState();
        if (liveSnapshot === committedSnapshot) {
          return stableState;
        }
        if (liveSnapshot !== overlaySnapshot) {
          overlaySnapshot = liveSnapshot;
          overlay = transformState(liveSnapshot);
        }
        return overlay!;
      };
    }, [committedSnapshot, stableState, runtime]);

    return {
      getState,
      setText: (text: string) => {
        // Mutates backend runtime immediately
        (runtime as any).setText(text);
      },
    };
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Returning closed-over render state in getState()
export function useBuggyStoreClient(runtime: Subscribable<{ text: string }>) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState);
  
  return {
    // FATAL: When an input calls setText() and immediately inspects getState(),
    // it receives the stale 'state' variable from the current render closure.
    // Controlled inputs will see stale values, causing cursor jumps or text revert!
    getState: () => state,
    setText: (text: string) => (runtime as any).setText(text),
  };
}
```

**VERIFICATION METHOD**:
Verify using a jsdom integration test mounting a controlled input that forces an internal state tick on `onChange` and asserts the caret index (`selectionStart`) remains anchored at the insertion index:
```typescript
it("preserves caret position during mid-string insertions", async () => {
  render(<BoundInputWithLocalTick />);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.value = "hello world";
  input.setSelectionRange(5, 5);
  fireEvent.change(input, {
    target: { value: "hello! world", selectionStart: 6, selectionEnd: 6 },
  });
  expect(input.selectionStart).toBe(6);
});
```

---

### 2. Upstream Capability Asymmetry via Exact Optional Interface Contracts
**RULE**:
When designing service or storage adapter abstractions where disparate external engines (e.g., OpenCode, Google ADK, LangGraph, Cloud APIs) exhibit asymmetric feature capabilities, capability methods MUST be declared optional on the base adapter interface (`method?(...): Promise<void>`). Adapters providing full support MUST type their factory returns using intersection types (`Adapter & Pick<Required<Adapter>, "method">`) to signal guaranteed capabilities to strict callers without forcing unsupported backends to implement reject stubs or throw runtime exceptions.

**WHY**:
Forcing every adapter to implement all lifecycle operations (such as `unarchive`) causes backend incompatibilities when the underlying persistence layer or vendor protocol is fundamentally immutable or unidirectional (e.g., sessions in OpenCode that cannot be unarchived once closed). If the interface mandates the method, adapters must resort to returning fake promises or throwing runtime exceptions, breaking caller UX and violating the Liskov Substitution Principle.

**WHEN TO APPLY**:
Apply to all adapter architectures, database driver layers, storage abstractions, and messaging backends where heterogeneous target engines share a core protocol but diverge in lifecycle mutations.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// 1. Base interface declares optional capability
export interface RemoteThreadListAdapter {
  readonly id: string;
  archive(remoteId: string): Promise<void>;
  unarchive?(remoteId: string): Promise<void>;
  delete(remoteId: string): Promise<void>;
}

// 2. Base consumer checks capability defensively at runtime
export async function openArchivedThread(
  adapter: RemoteThreadListAdapter,
  threadId: string,
): Promise<void> {
  if (typeof adapter.unarchive === "function") {
    await adapter.unarchive(threadId);
  } else {
    // Graceful degradation: read-only access without restoring status
    console.warn(`Adapter ${adapter.id} does not support unarchiving; opening read-only.`);
  }
}

// 3. Fully-capable implementations declare guaranteed contracts via type intersections
export type FullyCapableThreadListAdapter = RemoteThreadListAdapter &
  Pick<Required<RemoteThreadListAdapter>, "unarchive">;

export function createLocalStorageAdapter(): FullyCapableThreadListAdapter {
  return {
    id: "local-storage",
    async archive(id: string) { /* ... */ },
    async unarchive(id: string) { /* guaranteed implementation */ },
    async delete(id: string) { /* ... */ },
  };
}

export function createOpenCodeAdapter(): RemoteThreadListAdapter {
  return {
    id: "open-code",
    async archive(id: string) { /* ... */ },
    // unarchive omitted intentionally due to engine constraints
    async delete(id: string) { /* ... */ },
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Forcing dummy implementations that throw or no-op
export interface RigidRemoteThreadListAdapter {
  unarchive(remoteId: string): Promise<void>; // Mandated for all
}

export function createOpenCodeAdapterBroken(): RigidRemoteThreadListAdapter {
  return {
    async unarchive(id: string) {
      // FORBIDDEN: Caller thinks operation succeeded, but engine never unarchived!
      // Or throwing runtime Error: "Not supported" crashing unexpected UI workflows.
      throw new Error("OpenCode cannot unarchive sessions");
    },
  };
}
```

**VERIFICATION METHOD**:
Enforce compliance via static TypeScript API surface checks (`scripts/check-api-surface.mjs`) ensuring missing method declarations are marked optional on the base interface, paired with type tests:
```typescript
// Type test assertion
type AssertOptionalUnarchive = undefined extends RemoteThreadListAdapter["unarchive"] ? true : false;
const assertOptional: AssertOptionalUnarchive = true;
```

---

### 3. Hard-Capped Stream Ingestion with Early Transport Cancellation
**RULE**:
Edge handlers and ingestion workers accepting payload buffers of non-deterministic length MUST enforce a strict byte-budget limit during chunk streaming and MUST cancel the underlying transport stream (`reader.cancel().catch(...)`) immediately when the threshold is exceeded before decoding or accumulating text into memory.

**WHY**:
Accumulating unvalidated streaming bodies into memory using `request.text()` or unbounded array allocations exposes edge workers (e.g., Cloudflare Workers with 128MB limits) to catastrophic Out-Of-Memory (OOM) termination and denial-of-service via slow-loris memory exhaustion. Merely slicing an accumulated buffer after reading the entire payload fails to protect edge process boundaries.

**WHEN TO APPLY**:
Apply in any Web API / Edge runtime endpoint (`Request`/`Response`) handling file uploads, generative UI artifacts, secret deposits, or large payload inputs.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Reads stream up to maxBytes; aborts reader immediately if exceeded.
 * Returns decoded UTF-8 string, or undefined if the payload exceeded the limit.
 */
export async function readCapped(
  request: Request,
  maxBytes: number,
): Promise<string | undefined> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        // CRITICAL: Cancel the readable stream to free upstream network sockets
        reader.cancel("Payload size exceeded threshold").catch(() => {});
        return undefined;
      }
      chunks.push(value);
    }
  } catch (error) {
    reader.cancel(error).catch(() => {});
    throw error;
  }

  // Linear allocation of exact size
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(combined);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Reading full payload into memory before checking length
export async function readUnsafe(request: Request, maxBytes: number) {
  // FATAL: An attacker can send a 500MB stream that blows worker heap memory
  // before the length check is ever reached!
  const text = await request.text();
  if (text.length > maxBytes) {
    throw new Error("Payload too large");
  }
  return text;
}
```

**VERIFICATION METHOD**:
Automated unit test with a mocked readable stream delivering chunks past the boundary:
```typescript
it("aborts reading and releases memory when exceeding max limit", async () => {
  const chunk = new Uint8Array(1024);
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk);
    },
  });
  const req = new Request("http://localhost", { method: "POST", body: stream });
  const result = await readCapped(req, 2048);
  expect(result).toBeUndefined();
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Caret Jumping on Controlled Inputs During Typing (BUG-CORE-STORE-01)
- **Context**: `packages/core/src/store/runtime-clients/composer-runtime-client.ts`, `packages/store/src/client.ts`
- **What Was Expected**: When typing into a controlled input connected to `useAuiState((s) => s.composer.text)` (such as `react-mentions` or an IME input), mutating state mid-sentence should preserve the cursor selection range without snapping to the end of the input.
- **What Actually Happened**: Keystrokes typed in the middle of a sentence moved the selection range immediately to the end of the text. Because `useAuiState` and `aui.composer.getState()` relied on stale render snapshots before React committed, controlled inputs observed an out-of-sync intermediate state and reset the DOM cursor position.
- **Evidence in Repo**: Commit `32a1b791`, Changeset `.changeset/live-composer-state.md`, tests in `composer-runtime-client.test.tsx` and `useAuiState.composer.test.tsx`.
- **Root Cause**: `useComposerClient` returned a memoized `getState: () => state` whose `state` was bound strictly to `useSyncExternalStore(runtime.subscribe, runtime.getState)`. Because `useSyncExternalStore` schedules a render pass, `getState()` called immediately inside an input handler evaluated to the uncommitted state.
- **Remediation Code Diff**:
```diff
+const createGetState = (
+  runtime: ComposerRuntime,
+  runtimeState: ComposerRuntimeState,
+  state: ComposerState,
+) => {
+  let overlaySnapshot: ComposerRuntimeState | undefined;
+  let overlay: ComposerState | undefined;
+  return () => {
+    const snapshot = runtime.getState();
+    if (snapshot === runtimeState) return state;
+    if (snapshot !== overlaySnapshot) {
+      overlaySnapshot = snapshot;
+      overlay = toComposerState(snapshot, state.attachments, state.queue);
+    }
+    return overlay!;
+  };
+};

 const useComposerClient = (...) => {
-  const runtimeState = useSubscribable(runtime);
+  const runtimeState = useSubscribable(runtime, { live: true });
...
-  return {
-    getState: () => state,
+  const getState = useMemo(
+    () => createGetState(runtime, runtimeState, state),
+    [runtime, runtimeState, state],
+  );
+  return {
+    getState,
```
- **Lesson**: Stores bridging mutable imperative runtimes into React controlled components must provide an overlay bypass for `getState()` so pre-commit reads see immediate updates.

---

### Incident 2: Incompatible Unarchive Operation on Immutable Session Adapters (BUG-CORE-ADAPTER-02)
- **Context**: `api-surface/assistant-ui__core.ts`, `packages/core/src/runtimes/remote-thread-list/`
- **What Was Expected**: The OpenCode session adapter and third-party thread list engines should integrate seamlessly with `@assistant-ui/core`'s remote thread list interface.
- **What Actually Happened**: The `RemoteThreadListAdapter` interface strictly required `unarchive(remoteId: string): Promise<void>`. OpenCode's backend model does not support session unarchiving; sessions once closed cannot be re-opened. The adapter was forced to provide an invalid stub, causing unhandled rejections and UI crashes.
- **Evidence in Repo**: Commit `e21ce830`, Changeset `.changeset/opencode-unarchive.md`, PR `#9449`.
- **Root Cause**: Over-specification in interface modeling without acknowledging backend capability parity across diverse AI model providers.
- **Remediation Code Diff**:
```diff
 type RemoteThreadListAdapter = {
   rename(remoteId: string, newTitle: string): Promise<void>;
   updateCustom?(remoteId: string, custom: Record<string, unknown> | undefined): Promise<void>;
   archive(remoteId: string): Promise<void>;
-  unarchive(remoteId: string): Promise<void>;
+  unarchive?(remoteId: string): Promise<void>;
   delete(remoteId: string): Promise<void>;
 };

-declare const createCloudThreadListAdapter: (options: ...) => RemoteThreadListAdapter;
+declare const createCloudThreadListAdapter: (options: ...) => RemoteThreadListAdapter & Pick<Required<RemoteThreadListAdapter>, "unarchive">;
```
- **Lesson**: Differentiate between fundamental capabilities (delete, rename) and asymmetric provider actions (unarchive). Use optional properties with intersection types on full implementations.

---

### Incident 3: UI Message Stream Decoder Silently Stripping Provider Metadata (BUG-STREAM-METADATA-03)
- **Context**: `packages/assistant-stream/src/core/serialization/ui-message-stream/UIMessageStream.ts`
- **What Was Expected**: Upstream provider metadata attached to streaming chunks (e.g., Anthropic reasoning signatures, OpenAI token cache hits, latency metrics) should be forwarded into the thread state.
- **What Actually Happened**: The `UIMessageStream` decoder processed incoming `text-start`, `text-delta`, `text-end`, `reasoning-start`, `reasoning-delta`, and `reasoning-end` chunks, but dropped `providerMetadata`.
- **Evidence in Repo**: Issue #9847, Changeset `.changeset/ui-message-stream-provider-metadata.md`.
- **Root Cause**: The stream chunk accumulator types and reducer loops only extracted `text` and `id` properties, neglecting to project `chunk.providerMetadata` onto `TextMessagePart` and `ReasoningMessagePart` during chunk merges.
- **Remediation Code Diff**:
```diff
+// Inside UIMessageStream chunk accumulator
 case "text-start":
 case "reasoning-start": {
   return {
     ...part,
+    providerMetadata: chunk.providerMetadata ?? part.providerMetadata,
   };
 }
 case "text-delta":
 case "reasoning-delta": {
   return {
     ...part,
     text: part.text + chunk.textDelta,
+    ...(chunk.providerMetadata && {
+      providerMetadata: { ...part.providerMetadata, ...chunk.providerMetadata }
+    }),
   };
 }
```
- **Lesson**: In streaming protocol codecs, metadata must be explicitly merged across start, delta, and end frames; partial updates must preserve previous frame metadata.

---

### Incident 4: Custom Directory Path Leakage in Multi-Tenant Agent Runtimes (BUG-PI-MODEL-04)
- **Context**: `packages/react-pi/src/PiThreadSupervisor.ts`
- **What Was Expected**: Initializing a `PiThreadSupervisor` with a custom `agentDir` pointing to custom model configs (`models.json`) should ensure all model discovery methods query that directory.
- **What Actually Happened**: `getAvailableModels()` and `setModel()` queried the default global user agent directory (`~/.pi/agent`) instead of the custom directory configured on the host instance.
- **Evidence in Repo**: Issue #9844, Changeset `.changeset/fix-pi-custom-model-directory.md`.
- **Root Cause**: The runtime supervisor constructed helper instances for model metadata lookups using an isolated context that overrode only `authPath`, leaving `modelsPath` to fall back to the default process environment path.
- **Remediation Code Diff**:
```diff
 const hostConfig = {
   authPath: join(this.agentDir, "auth.json"),
+  modelsPath: join(this.agentDir, "models.json"),
+  agentDir: this.agentDir,
   workspacePath: this.workspacePath,
 };
-const modelHelper = new PiModelDiscovery({ authPath: hostConfig.authPath });
+const modelHelper = new PiModelDiscovery(hostConfig);
```
- **Lesson**: Subsystem supervisors must propagate composite execution configurations across all ancillary utility runtimes.

---

### Incident 5: Stale Thread Load Overwriting Active Selection (BUG-LIFECYCLE-RACE-05)
- **Context**: `packages/core/src/runtimes/remote-thread-list/createAbortableThreadLoad.ts`
- **What Was Expected**: Selecting Thread A, then quickly switching to Thread B before Thread A settles, should result in Thread B's state being rendered.
- **What Actually Happened**: Slow responses from Thread A resolved after Thread B's load commenced, overwriting the thread state with Thread A's messages.
- **Evidence in Repo**: `.claude/skills/test-quality/tests.md`, Changeset `.changeset/thread-list-switch-waits-for-runtime.md`.
- **Root Cause**: Asynchronous load operations lacked cancellation tokens tied to thread switching, causing race conditions in asynchronous resolution order (TOCTOU).
- **Remediation Code Diff**:
```diff
 export const createAbortableThreadLoad = () => {
+  let activeController: AbortController | null = null;
   return {
     async run(options: AbortableThreadLoadOptions) {
+      activeController?.abort();
+      const controller = new AbortController();
+      activeController = controller;
       try {
-        await options.load();
+        await options.load(controller.signal);
+        if (controller.signal.aborted) return;
         options.onSettled();
       } catch (error) {
+        if (controller.signal.aborted) return;
         options.onInitialError(error);
       }
     }
   };
 };
```
- **Lesson**: Any state transition initiated by user interaction that launches asynchronous fetching MUST abort previous pending operations using an explicit `AbortController`.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Strict Sentinel Comparison for Empty States**: In `ThreadMessage` and `ComposerState`, message bodies or tokens can be valid empty strings `""` or numbers `0`. Never use falsy checks `if (!value)`. Always use explicit nullish checks:
```typescript
// INVARIANT: Distinguish between empty text draft and unset/loading state
const hasContent = value !== undefined && value !== null && value.length > 0;
// NOT: if (value) -- which fails on valid empty strings or zero counts
```
- **Deep Immutability vs Shallow Mutation Leaks**: When constructing part updates, mutating properties directly on `ThreadAssistantMessagePart` corrupts history caches. Always return new object references for nested structures:
```typescript
// SAFE: Immutable part cloning with deep metadata isolation
const updatedPart: TextMessagePart = {
  ...originalPart,
  text: originalPart.text + deltaText,
  providerMetadata: originalPart.providerMetadata
    ? { ...originalPart.providerMetadata, ...deltaMetadata }
    : deltaMetadata,
};
```
- **Brand Protection and Type Narrowing**: Using unique symbols (`unique symbol`) to prevent phantom structural type matching across different store clients:
```typescript
declare const auiConfigBrand: unique symbol;
export type AuiConfig = {
  readonly [auiConfigBrand]: true;
  // ...
};
```

### 2. Infinite Loop & Recursion Guards
- **Generative UI Depth & Slice Caps**: Vision models downscale images when long dimensions exceed ~1500px, blurring fine text. In `evals/src/suites/generative-ui/render.ts`, tall rendered answers are sliced with hard mathematical limits:
```typescript
const SLICE_HEIGHT = 1_000;
export const MAX_SLICES = 8; // HARD CEILING: Prevents infinite rendering loop
const captured = Math.min(Math.max(height, 1), MAX_SLICES * SLICE_HEIGHT);
```
- **Ancestor Traversal Cycle Prevention**: Type-level and runtime recursion protection when traversing message branch trees (`AncestorsOf`):
```typescript
type AncestorsOf<K extends ClientNames, Seen extends ClientNames = never> = 
  K extends Seen 
    ? never 
    : ParentOf<K> extends never 
      ? never 
      : ParentOf<K> | AncestorsOf<ParentOf<K>, Seen | K>;
```
- **Promise Re-entrance Serialization**: Prevent concurrent duplicate fetching using promise caching with resetting cleanup:
```typescript
let tokenPromise: Promise<string | null> | null = null;
const getToken = () => {
  tokenPromise ??= (async () => {
    const res = await fetchImplementation("/api/token");
    return (await res.json()).token;
  })().catch(() => {
    tokenPromise = null; // Yield lock on rejection
    return null;
  });
  return tokenPromise;
};
```

### 3. UI & UX Micro-Mechanics
- **Controlled Input Selection & IME Composition**: During native composition (Japanese, Chinese, Korean input), firing state mutations can cause React to reset the textarea value. Enforce synchronous tap flushes mid-composition:
```typescript
const isComposing = nativeIsComposing || compositionRef.current;
// Standalone tap roots need a synchronous flush while the input is composing.
flushTapSync(() => {
  aui.composer.setText(e.target.value);
});
```
- **Auto-scroll Stickiness Prevention**: Viewports must differentiate between programmatic scroll-to-bottom and user scrolling up. If `isUserScrollUp` is true, auto-scroll triggers must be disabled:
```typescript
export function isUserScrollUp(metrics: ViewportMetrics): boolean {
  const threshold = 10; // px tolerance
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight > threshold;
}
```

### 4. Backend Concurrency & Memory Safety
- **Durable Object Concurrency Gates**: In Cloudflare Workers/Durable Objects (`CheckoutDO`), storage modifications must be protected against Time-Of-Check to Time-Of-Use (TOCTOU) race conditions:
```typescript
return this.ctx.blockConcurrencyWhile(async () => {
  const input = this.#currentInput(setupId, inputId);
  if (!input) return new Response("no input", { status: 404 });
  // Atomically check and deposit secret
  await this.ctx.storage.put(key, deposit);
  return new Response(null, { status: 204 });
});
```
- **Storage Scope Change Throttling**: Avoid scheduling repetitive cleanup alarms when underlying data hasn't structurally changed:
```typescript
const scope = JSON.stringify([
  state.id,
  state.createdAt,
  state.status,
  state.inputs.map((input) => [input.id, input.status, input.answer]),
]);
if (scope === this.#cleanupScope) return; // Deduplicate
this.#cleanupScope = scope;
```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Stream Termination Reason Validation**: Always map stream completions to a closed union discriminating between successful finishes and aborts:
```typescript
type MessageStatus =
  | { readonly type: "running" }
  | { readonly type: "requires-action"; readonly reason: "interrupt" | "tool-calls" }
  | { readonly type: "complete"; readonly reason: "stop" | "unknown" }
  | { readonly type: "incomplete"; readonly reason: "cancelled" | "content-filter" | "error" | "length" | "tool-calls"; readonly error?: ReadonlyJSONValue };
```
- **Silent Catch Prevention in Stream Piping**: Never use unhandled `.catch(() => {})` on operations that can mask network failure. Only suppress explicit cancellation rejections:
```typescript
reader.cancel().catch((err) => {
  // Ignore abort rejections only if the stream was cleanly severed by us
  if (err.name !== "AbortError") console.error("Stream cancellation error:", err);
});
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The architecture is structured around **Decoupled Reactive Scopes**. State is divided into discrete, addressable grains:
```
ScopeRegistry
├── threads
│   └── threadListItem (keyed by threadId)
├── thread
│   ├── composer
│   │   ├── queueItem (keyed by queue index/id)
│   │   └── attachment (keyed by attachmentId)
│   └── message (keyed by messageId)
│       └── part (keyed by part index/id)
└── tools / interactables
```
Every scope defines its own `