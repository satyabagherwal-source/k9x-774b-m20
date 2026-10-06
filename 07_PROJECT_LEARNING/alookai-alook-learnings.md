# Forensic Learning Record (Deep Inspection): alookai/alook

> **Canonical Artifact**: `07_PROJECT_LEARNING/alookai-alook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alookai/alook](https://github.com/alookai/alook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:18:51.104Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alookai/alook`
- **Description**: Rooms for people and agents.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1190 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/cloudflare/queue-migration.mjs`
```
#!/usr/bin/env node

import { pathToFileURL } from "node:url"

export const QUEUE_MIGRATION_RESOURCES = Object.freeze({
  oldWorker: "alook-wake-worker",
  oldQueue: "alook-wake",
  oldDlq: "alook-wake-dlq",
  newWorker: "alook-queue-worker",
  newQueue: "alook-queue",
  newDlq: "alook-queue-dlq",
})

export function buildQueueMigrationPlan() {
  const names = QUEUE_MIGRATION_RESOURCES
  return {
    mode: "plan-only",
    executesCommands: false,
    dualWrite: false,
    phases: [
      {
        id: "prepare",
        mutating: true,
        commands: [
          `pnpm exec wrangler queues create ${names.newQueue}`,
          `pnpm exec wrangler queues create ${names.newDlq}`,
        ],
        gate: "Confirm the new Queue and DLQ exist with zero producers.",
      },
      {
        id: "deploy-compatible-consumer",
        mutating: true,
        commands: ["pnpm --filter @alook/queue-worker deploy"],
        gate: "Verify the new consumer accepts legacy wake and v1 queue tasks.",
      },
      {
        id: "producer-cutover",
        mutating: true,
        commands: ["pnpm --filter @alook/web deploy"],
        gate: `Verify Web has exactly one producer binding, targeting ${names.newQueue}; never dual-write.`,
      },
      {
        id: "drain-and-observe",
        mutating: false,
        commands: [
          `pnpm exec wrangler queues info ${names.oldQueue}`,
          `pnpm exec wrangler queues info ${names.newQueue}`,
          `pnpm exec wrangler queues info ${names.newDlq}`,
        ],
        gate: "Old depth and oldest age are zero, no old producer remains, and new wake traffic is healthy.",
      },
      {
        id: "cleanup",
        mutating: true,
        separatelyAuthorized: true,
        commands: [
          `pnpm exec wrangler queues delete ${names.oldQueue}`,
          `pnpm exec wrangler queues delete ${names.oldDlq}`,
          `pnpm exec wrangler delete --name ${names.oldWorker}`,
        ],
        gate: "STOP unless exact production cleanup authorization is recorded after the drain gate passes.",
      },
    ],
  }
}

function renderText(plan) {
  const lines = [
    "Queue migration plan (display only; no commands were executed)",
    "No dual-write: cut over the single Web producer only after the compatible consumer is ready.",
  ]
  for (const phase of plan.phases) {
    lines.push("", `${phase.id}${phase.separatelyAuthorized ? " [SEPARATE AUTHORIZATION REQUIRED]" : ""}`)
    lines.push(...phase.commands.map((command) => `  ${command}`), `  Gate: ${phase.gate}`)
  }
  return lines.join("\n")
}

function main(argv) {
  if (argv.includes("--execute")) {
    console.error("Refusing --execute: this script is intentionally plan/read-only.")
    process.exitCode = 2
    return
  }
  const plan = buildQueueMigrationPlan()
  console.log(argv.includes("--json") ? JSON.stringify(plan, null, 2) : renderText(plan))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
}

```

### Core Architecture Module: `src/benchmark/src/worker-observer.mjs`
```
import { observeD1 } from './d1-observer.mjs'

export function observeWorker(worker, emit = event => console.log(JSON.stringify(event))) {
  return {
    ...worker,
    async fetch(request, env, context) {
      const requestId = request.headers.get('x-alook-benchmark-id')
      if (!requestId || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) return worker.fetch(request, env, context)
      const started = performance.now()
      let responded = false
      let d1Calls = 0
      const tasks = []
      const write = event => {
        try { emit({ benchmark: 1, requestId, ...event }) } catch {}
      }
      const observedEnv = new Proxy(env, {
        get(target, key) { return key === 'DB' ? db : Reflect.get(target, key, target) },
      })
      const db = observeD1(env.DB, event => { d1Calls++; write({ ...event, startedMs: event.startedMs - started }) }, () => performance.now(), () => responded)
      const observedContext = new Proxy(context, {
        get(target, key) {
          if (key === 'waitUntil') return task => {
            const settled = Promise.resolve(task).then(() => true, () => false)
            tasks.push(settled)
            target.waitUntil(task)
          }
          const value = Reflect.get(target, key, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
      write({ kind: 'request-start' })
      try {
        const response = await worker.fetch(request, observedEnv, observedContext)
        write({ kind: 'response', status: response.status, wallMs: performance.now() - started })
        return response
      } finally {
        responded = true
        context.waitUntil((async () => {
          let consumed = 0
          let failedTasks = 0
          while (consumed < tasks.length) {
            const batch = tasks.slice(consumed)
            consumed += batch.length
            failedTasks += (await Promise.all(batch)).filter(ok => !ok).length
          }
          write({ kind: 'request-complete', backgroundTasks: consumed, failedTasks, d1Calls, wallMs: performance.now() - started })
        })())
      }
    },
  }
}

```

### Core Architecture Module: `src/daemon/agent-driver/src/controller/event-queue.ts`
```
import type { AgentEventStream } from "../contract.js";

const MAX_BUFFERED_BYTES = 4_194_304 as const;

interface Waiter<Event> {
  resolve(value: IteratorResult<Event>): void;
}

export class BufferedEventQueue<Event> {
  private readonly queued: Array<{ event: Event; bytes: number }> = [];
  private readonly waiters: Waiter<Event>[] = [];
  private bufferedBytes = 0;
  private iteratorCreated = false;
  private consumerClosed = false;
  private overflowed = false;
  private ended = false;

  constructor(
    private readonly onConsumerClosed: () => void,
    private readonly onOverflow: () => void,
  ) {}

  readonly stream: AgentEventStream<Event> = {
    maxBufferedBytes: MAX_BUFFERED_BYTES,
    [Symbol.asyncIterator]: () => this.createIterator(),
  };

  push(event: Event, terminal = false): boolean {
    if (this.ended) return false;
    if (this.overflowed && !terminal) return false;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve({ done: false, value: event });
      return true;
    }
    const bytes = Buffer.byteLength(JSON.stringify(event), "utf8");
    if (!terminal && this.bufferedBytes + bytes > MAX_BUFFERED_BYTES) {
      this.overflowed = true;
      this.onOverflow();
      return false;
    }
    this.queued.push({ event, bytes });
    this.bufferedBytes += bytes;
    return true;
  }

  close(): void {
    if (this.ended) return;
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) waiter.resolve({ done: true, value: undefined });
  }

  private createIterator(): AsyncIterator<Event> {
    if (this.iteratorCreated) throw new Error("AgentEventStream supports one consumer");
    this.iteratorCreated = true;
    return {
      next: () => {
        const item = this.queued.shift();
        if (item) {
          this.bufferedBytes -= item.bytes;
          return Promise.resolve({ done: false as const, value: item.event });
        }
        if (this.ended) return Promise.resolve({ done: true as const, value: undefined });
        return new Promise<IteratorResult<Event>>((resolve) => this.waiters.push({ resolve }));
      },
      return: async () => {
        if (!this.consumerClosed) {
          this.consumerClosed = true;
          this.onConsumerClosed();
        }
        return { done: true, value: undefined };
      },
    };
  }
}

```

### Core Architecture Module: `src/daemon/agent-driver/src/internal/utils.ts`
```
/**
 * Small helpers shared across driver files. Each kills a duplication pattern
 * that had multiple drivers copy-pasting the same 3-4 lines.
 */
import { randomUUID } from "crypto";

/**
 * Build a JSON-RPC 2.0 request string (no trailing newline — the caller
 * appends one when writing to stdin). Codex uses this envelope for every
 * request it sends; centralize the
 * envelope so `id` defaulting and `jsonrpc` version live in one place.
 */
export function jsonRpcRequest(method: string, params: unknown, id?: string | number): string {
  return JSON.stringify({ jsonrpc: "2.0", id: id ?? randomUUID(), method, params });
}

/**
 * Parse a single NDJSON line. Every event normalizer that reads a JSON stream
 * needs the same `try/catch → null on parse error` idiom; use this instead of
 * scattering `let msg: any` + try/catch through 8 files.
 */
export function tryParseJsonLine(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function tryParseJsonRecord(line: string): Record<string, unknown> | null {
  return asRecord(tryParseJsonLine(line));
}

```

### Core Architecture Module: `src/daemon/src/inbox/stateMachine.ts`
```
/**
 * Agent inbox freshness state machine.
 *
 * This is the "don't reply on stale context" guard. Before an agent performs an
 * outward action (`send`, `task_claim`, `task_update`), `planAgentInboxSideEffect`
 * checks whether there are messages on the same target the model has NOT yet
 * seen. Based on monotonic `seq` boundaries it returns one of:
 *
 *   - **forward**  — nothing unseen (or `continueAnyway`); let the action through.
 *   - **held**     — unseen messages exist; hold the action, surface the latest
 *                    few as "held context" so the model can reconcile first.
 *   - (bypass)     — explicit `continueAnyway`; forwarded as `decision:"bypass"`.
 *
 * It is a PURE function: same inputs → same plan (incl. a stable
 * `producerFactId` hash). The caller applies the returned `effects`
 * (`consume_visible_messages`, `record_freshness_decision`) against real state.
 *
 * Trust:
 *   - `trusted`   — decision based on messages that exactly match the target's
 *                   pending set.
 *   - `untrusted` — first-touch case decided only from "recent" context.
 *
 * Generic, host-neutral agent inbox freshness abstraction.
 * Clause ids `SMR-002` (consume) / `SMR-006` (held envelope) preserved.
 */
import { createHash } from "crypto";

export const DEFAULT_HELD_CONTEXT_LIMIT = 3;

export type InboxAction = "send" | "task_claim" | "task_update";
export type InboxDecisionKind = "forward" | "local_hold" | "syncing_hold" | "bypass";
export type InboxTrustState = "trusted" | "untrusted";

export interface InboxVisibleMessage {
  seq?: number;
  message_id?: string;
  id?: string;
  timestamp?: string;
  createdAt?: string;
  sender_id?: string;
  senderId?: string;
  sender_type?: string;
  senderType?: string;
  sender_name?: string;
  senderName?: string;
  sender_description?: string | null;
  senderDescription?: string | null;
  [key: string]: unknown;
}

export interface PlanInput {
  agentId: string;
  action: InboxAction;
  target: string;
  continueAnyway?: boolean;
  pendingMessages: InboxVisibleMessage[];
  recentMessages: InboxVisibleMessage[];
  existingSeenUpToSeq?: number;
  modelSeenSeq?: number;
  heldContextLimit?: number;
  /** Optional escape hatch for non-seq "seen" checks. */
  isMessageModelSeen?: (arg: { target: string; message: InboxVisibleMessage }) => boolean;
}

export interface FreshnessDecision {
  action: InboxAction;
  decision: InboxDecisionKind;
  target: string;
  inboxTrustState: InboxTrustState;
  reason: string;
  pendingCount?: number;
  pendingMaxSeq?: number;
  modelSeenSeq?: number;
  heldMessageCount?: number;
  omittedMessageCount?: number;
  producerFactId?: string;
}

export type ConsumeEffect = {
  type: "consume_visible_messages";
  target: string;
  messages: InboxVisibleMessage[];
  boundarySeq?: number;
  source: "side_effect_preflight_context";
};
export type RecordDecisionEffect = { type: "record_freshness_decision"; decision: FreshnessDecision };
export type PlanEffect = ConsumeEffect | RecordDecisionEffect;

export interface TraceEntry {
  step: string;
  data?: Record<string, unknown>;
}

export interface HeldContext {
  heldMessages: InboxVisibleMessage[];
  newMessageCount: number;
  shownMessageCount: number;
  omittedMessageCount: number;
  seenUpToSeq: number;
}

export interface PlanResult {
  outcome: "forward" | "held";
  target: string;
  forwardSeenUpToSeq?: number;
  effects: PlanEffect[];
  trace: TraceEntry[];
  localResponse?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* The reducer                                                         */
/* ------------------------------------------------------------------ */

export function planAgentInboxSideEffect(input: PlanInput): PlanResult {
  const heldContextLimit = input.heldContextLimit ?? DEFAULT_HELD_CONTEXT_LIMIT;
  const trace: TraceEntry[] = [
    {
      step: "input",
      data: compactTraceData({
        action: input.action,
        target: input.target,
        continueAnyway: input.continueAnyway,
        pendingCount: input.pendingMessages.length,
        recentCount: input.recentMessages.length,
        existingSeenUpToSeq: input.existingSeenUpToSeq,
        modelSeenSeq: input.modelSeenSeq,
      }),
    },
  ];

  // Explicit override: send/act regardless.
  if (input.continueAnyway) {
    appendTrace(trace, "continue_anyway_bypass");
    return forwardPlan(
      input,
      { action: input.action, decision: "bypass", target: input.target, inboxTrustState: "trusted", reason: "continue_anyway" },
      trace,
    );
  }

  // Case 1: messages pending on the exact target.
  if (input.pendingMessages.length > 0) {
    appendTrace(trace, "pending_messages_found", { pendingCount: input.pendingMessages.length });
    const pending = sortInboxMessagesBySeq(normalizeInboxVisibleMessages(input.pendingMessages, input.target));
    const boundary = resolveFreshnessBoundary(pending);
    if (!boundary.ok) {
      appendTrace(trace, "pending_context_missing_boundary");
      return forwardWithoutDecision(input, trace);
    }

    const alreadySeenPending: InboxVisibleMessage[] = [];
    const unconsumedMessages: InboxVisibleMessage[] = [];
    for (const message of pending) {
      if (isMessageModelSeen(input, message)) alreadySeenPending.push(message);
      else unconsumedMessages.push(message);
    }
    appendTrace(trace, "pending_context_classified", {
      pendingCount: pending.length,
      unseenCount: unconsumedMessages.length,
    });

    // 1a: everything pending is already seen → forward, advance boundary.
    if (unconsumedMessages.length === 0) {
      const contiguousBoundary = maxKnownContiguousBoundary(input);
      const canAdvanceBoundary =
        typeof contiguousBoundary === "number" && contiguousBoundary >= boundary.seenUpToSeq;
      appendTrace(trace, "pending_context_already_seen", { boundarySeq: boundary.seenUpToSeq });
      return forwardPlan(
        input,
        {
          action: input.action,
          decision: "forward",
          target: input.target,
          inboxTrustState: "trusted",
          reason: "exact_target_pending_already_seen",
          pendingCount: pending.length,
          pendingMaxSeq: boundary.seenUpToSeq,
          modelSeenSeq: contiguousBoundary,
          heldMessageCount: 0,
          omittedMessageCount: 0,
        },
        trace,
        {
          forwardSeenUpToSeq: input.action === "send" && canAdvanceBoundary ? boundary.seenUpToSeq : undefined,
          consumeEffect: {
            type: "consume_visible_messages",
            target: input.target,
            messages: exactSeenConsumeMessages(input, pending),
            boundarySeq: canAdvanceBoundary ? boundary.seenUpToSeq : undefined,
            source: "side_effect_preflight_context",
          },
        },
      );
    }

    // 1b: some unseen → HOLD, show latest few.
    const heldBoundary = resolveFreshnessBoundary(unconsumedMessages);
    if (heldBoundary.ok) {
      const heldMessages = latestVisibleMessages(unconsumedMessages, heldContextLimit);
      const omittedMessageCount = Math.max(0, unconsumedMessages.length - heldMessages.length);
      const context: HeldContext = {
        heldMessages,
        newMessageCount: unconsumedMessages.length,
        shownMessageCount: heldMessages.length,
        omittedMessageCount,
        seenUpToSeq: heldBoundary.seenUpToSeq,
      };
      appendTrace(trace, "held_context_built", {
        boundarySeq: boundary.seenUpToSeq,
        heldBoundarySeq: heldBoundary.seenUpToSeq,
        heldCount: context.shownMessageCount,
        omittedCount: context.omittedMessageCount,
      });
      return heldPlan(
        input,
        {
          decision: {
            action: input.action,
            decision: "local_hold",
            target: input.target,
            inboxTrustState: "trusted",
            reason: "exact_target_pending",
            pendingCount: input.pendingMessages.length,
            pendingMaxSeq: heldBoundary.seenUpToSeq,
            modelSeenSeq: input.modelSeenSeq,
            heldMessageCount: context.shownMessageCount,
            omittedMessageCount: context.omittedMessageCount,
          },
          context,
          consumeMessages: sortInboxMessagesBySeq([
            ...exactSeenConsumeMessages(input, alreadySeenPending),
            ...context.heldMessages,
          ]),
          consumeBoundarySeq: heldBoundary.seenUpToSeq,
        },
        trace,
      );
    }
    appendTrace(trace, "pending_unseen_context_missing_boundary");
    return forwardWithoutDecision(input, trace);
  }

  // Case 2: no pending; trust a known seq boundary if we have one.
  const boundary = Math.max(input.existingSeenUpToSeq ?? 0, input.modelSeenSeq ?? 0);
  appendTrace(trace, "model_boundary_checked", { boundary });
  if (boundary > 0) {
    appendTrace(trace, "model_boundary_selected", { boundary });
    return forwardPlan(
      input,
      {
        action: input.action,
        decision: "forward",
        target: input.target,
        inboxTrustState: "trusted",
        reason: "model_seen_boundary",
        pendingCount: 0,
        modelSeenSeq: boundary,
      },
      trace,
      { forwardSeenUpToSeq: input.action === "send" ? boundary : undefined },
    );
  }

  // Case 3: first touch — decide from "recent" context (untrusted).
  if (input.recentMessages.length > 0) {
    return planFirstTouchRecentContext(input, heldContextLimit, trace);
  }

  appendTrace(trace, "no_context_available");
  return forwardPlan(
    input,
    {
      action: input.action,
      decision: "forward",
      target: input.target,
      inboxTrustState: "trusted",
      reason: "no_exact_target_pending_or_recent_context",
      pendingCount: 0,
      modelSeenSeq: 0,
    },
    trace,
  );
}

/* ------------------------------------------------------------------ */
/* First-touch (recent context, untrusted)                     
```

### Core Architecture Module: `src/daemon/src/runtime/notificationState.ts`
```
/**
 * RuntimeNotificationState — inbox-notice de-duplication and batching.
 *
 * When the daemon injects "you have N unread messages" notices into a running
 * agent, it must avoid re-sending the same notice set within a session (which
 * would spam the agent). This tracks a per-(session) fingerprint of the last
 * notice written, which message identities have already been contributed, and a
 * one-shot debounce timer for batching bursts.
 *
 * Identity priority: positive `seq` → `message_id` → `id`. Fingerprint = sorted,
 * comma-joined identities. Empty fingerprint ⇒ never a duplicate (fail toward
 * sending).
 */

export interface InboxMessageLike {
  seq?: number;
  message_id?: string;
  id?: string;
}

export function inboxNoticeMessageIdentity(message: InboxMessageLike): string {
  const seq =
    typeof message.seq === "number" && Number.isFinite(message.seq) && message.seq > 0
      ? Math.floor(message.seq)
      : null;
  if (seq !== null) return `s:${seq}`;
  const id =
    typeof message.message_id === "string" && message.message_id.length > 0
      ? message.message_id
      : typeof message.id === "string" && message.id.length > 0
        ? message.id
        : "";
  return id.length > 0 ? `m:${id}` : "";
}

export function computeInboxNoticeFingerprint(messages: InboxMessageLike[]): string {
  const keys: string[] = [];
  for (const m of messages) {
    const key = inboxNoticeMessageIdentity(m);
    if (key.length > 0) keys.push(key);
  }
  if (keys.length === 0) return "";
  keys.sort();
  return keys.join(",");
}

export class RuntimeNotificationState {
  private pendingCountValue = 0;
  private timerValue: ReturnType<typeof setTimeout> | null = null;

  private lastNoticeFingerprint: string | null = null;
  private lastNoticeSessionId: string | null = null;
  private lastEncodeFailedFingerprint: string | null = null;
  private lastEncodeFailedSessionId: string | null = null;

  /** Message identities already written successfully this session. */
  private contributedIdentities = new Set<string>();
  private contributionSessionId: string | null = null;

  get pendingCount(): number {
    return this.pendingCountValue;
  }

  /** Same notice set + same session as the last write ⇒ duplicate. */
  isDuplicateNotice(fingerprint: string, sessionId: string): boolean {
    if (fingerprint.length === 0) return false;
    return this.lastNoticeFingerprint === fingerprint && this.lastNoticeSessionId === sessionId;
  }

  recordNoticeWritten(fingerprint: string, sessionId: string, messages: InboxMessageLike[] = []): void {
    this.lastNoticeFingerprint = fingerprint;
    this.lastNoticeSessionId = sessionId;
    this.lastEncodeFailedFingerprint = null;
    this.lastEncodeFailedSessionId = null;
    this.ensureContributionSession(sessionId);
    for (const message of messages) {
      const identity = inboxNoticeMessageIdentity(message);
      if (identity.length > 0) this.contributedIdentities.add(identity);
    }
  }

  recordNoticeEncodeFailed(fingerprint: string, sessionId: string): void {
    if (fingerprint.length === 0) return;
    this.lastEncodeFailedFingerprint = fingerprint;
    this.lastEncodeFailedSessionId = sessionId;
  }

  isDuplicateEncodeFailedNotice(fingerprint: string, sessionId: string): boolean {
    if (fingerprint.length === 0) return false;
    return this.lastEncodeFailedFingerprint === fingerprint && this.lastEncodeFailedSessionId === sessionId;
  }

  /** Drop messages already contributed in this session (or all if session changed). */
  filterUncontributedMessages(messages: InboxMessageLike[], sessionId: string): InboxMessageLike[] {
    if (this.contributionSessionId !== sessionId) return messages;
    return messages.filter((m) => {
      const identity = inboxNoticeMessageIdentity(m);
      return identity.length === 0 || !this.contributedIdentities.has(identity);
    });
  }

  add(count = 1): void {
    this.pendingCountValue += count;
  }

  /** Arm a one-shot debounce timer; returns false if one is already armed. */
  schedule(callback: () => void, delayMs: number): boolean {
    if (this.timerValue) return false;
    this.timerValue = setTimeout(() => {
      this.timerValue = null;
      callback();
    }, delayMs);
    this.timerValue.unref?.();
    return true;
  }

  /** Atomically read & reset the pending count and clear the timer. */
  takePendingAndClearTimer(): number {
    const count = this.pendingCountValue;
    this.pendingCountValue = 0;
    if (this.timerValue) {
      clearTimeout(this.timerValue);
      this.timerValue = null;
    }
    return count;
  }

  private ensureContributionSession(sessionId: string): void {
    if (this.contributionSessionId !== sessionId) {
      this.contributionSessionId = sessionId;
      this.contributedIdentities = new Set();
    }
  }
}

```

### Core Architecture Module: `src/daemon/src/runtime/progressState.ts`
```
/**
 * RuntimeProgressState — liveness tracking.
 *
 * Records the timestamp/kind of the last observed runtime activity so the
 * orchestrator can tell "still working" from "stalled". Any real event or
 * internal streaming progress clears the stale flag; `markStale` is a one-shot
 * latch (set once, idempotent) used to trigger stalled-recovery termination.
 */
export class RuntimeProgressState {
  private lastEventAtMs: number;
  private lastEventKindValue: string | null = null;
  private staleSinceMs: number | null = null;

  constructor(nowMs: number = Date.now()) {
    this.lastEventAtMs = nowMs;
  }

  get lastEventAt(): number {
    return this.lastEventAtMs;
  }
  get lastEventKind(): string | null {
    return this.lastEventKindValue;
  }
  get staleSince(): number | null {
    return this.staleSinceMs;
  }
  get isStale(): boolean {
    return this.staleSinceMs !== null;
  }

  ageMs(nowMs: number = Date.now()): number {
    return nowMs - this.lastEventAtMs;
  }

  /** A normalized runtime event arrived (tool call, model text, …). */
  noteRuntimeEvent(eventKind: string | null, nowMs: number = Date.now()): void {
    this.lastEventAtMs = nowMs;
    this.lastEventKindValue = eventKind ?? null;
    this.staleSinceMs = null;
  }

  /** Sub-event streaming progress; advances the clock but not the kind. */
  noteInternalProgress(observedAtMs: number = Date.now()): void {
    this.lastEventAtMs = observedAtMs;
    this.staleSinceMs = null;
  }

  /** Latch staleness (idempotent). Returns the stale-since timestamp. */
  markStale(nowMs: number = Date.now()): number {
    this.staleSinceMs ??= nowMs;
    return this.staleSinceMs;
  }
}

```

### Core Architecture Module: `src/daemon/src/util/localTime.ts`
```
/**
 * Local-timezone ISO-8601 helpers.
 *
 * The daemon presents time to the agent in its LOCAL timezone (with offset,
 * e.g. `2026-06-25T17:11:05+08:00`) so `pulledAt`, wake-text timestamps, and
 * per-message `.time` fields all agree with what the user sees on their
 * machine. Server-side timestamps arrive as UTC (`...Z`); these helpers do the
 * one-way conversion at the CLI/router boundary — nothing else in the daemon
 * needs to know about timezones.
 */

/**
 * Format a `Date` as local-tz ISO-8601 with milliseconds and offset, e.g.
 * `2026-06-25T17:11:05.482+08:00`. Millisecond precision is deliberate — the
 * agent sees `pulledAt`, wake-text timestamps, and `message.time` at this
 * resolution, and second-only granularity would collapse sub-second stages
 * (message-write / wake-dispatch / prompt-hand-off) into identical strings.
 */
export function localISOString(now: Date): string {
  const tzOffset = -now.getTimezoneOffset();
  const sign = tzOffset >= 0 ? "+" : "-";
  const abs = Math.abs(tzOffset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}${sign}${hh}:${mm}`;
}

/** `new Date()` formatted in local-tz ISO-8601 with milliseconds and offset. */
export function nowLocalISO(): string {
  return localISOString(new Date());
}

/**
 * Convert a UTC ISO-8601 string (server-stamped, ending in `Z`) into local-tz
 * ISO-8601 with milliseconds and offset. Non-parseable input is returned
 * unchanged — the CLI shouldn't drop a real message just because its `.time`
 * didn't round-trip.
 */
export function toLocalISO(iso: string): string {
  if (!iso) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return localISOString(d);
}

```

### Core Architecture Module: `src/daemon/src/util/rotatingFileSink.ts`
```
/**
 * A tiny size-capped, rotating append sink — the bounded backing for the
 * default-on FSM transition trace.
 *
 * WHY net-new: the daemon has no rotation utility (recon-confirmed), and the
 * raw `appendFileSync` sink the trace shipped with (createDaemon.ts) is
 * UNBOUNDED — ~15MB/4h, only grows. That's fine for an opt-in deep-dive
 * (`ALOOK_FSM_TRACE`), but the whole point of E1 is to make the trace DEFAULT
 * ON so we're never blind to a wedge again — and a default that silently fills
 * the disk is a bug, not a feature. This sink caps total on-disk bytes.
 *
 * DESIGN — a 2-file ring (active + `.1`):
 *   - append lines to `<path>`;
 *   - when `<path>` would exceed `maxBytes`, rotate: `rename(<path> → <path>.1)`
 *     (overwriting any previous `.1`), then start a fresh empty `<path>`.
 *   - so on-disk total is bounded by ~2×maxBytes, and we always retain at least
 *     the last `maxBytes` of history (usually ~2×) — enough to hold the last
 *     wedge's FSM trail.
 *
 * Everything is best-effort: a sink must NEVER break the daemon, so every fs
 * call is wrapped and failures are swallowed (same contract as the old inline
 * try/catch). Synchronous fs (appendFileSync/statSync/renameSync) mirrors the
 * existing sink — the write is off the FSM hot path (it runs in the
 * onFsmTransition callback, after the reduce), and keeping it sync avoids
 * interleaving/ordering hazards a per-line async write would add.
 */
import {
  appendFileSync,
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";

export interface RotatingFileSnapshot {
  files: Array<{ path: string; fd: number; size: number }>;
  close(): void;
}

export interface RotatingFileSink {
  /** Tightens every existing generation before a caller starts using the sink. */
  secure(): boolean;
  /** Append one already-serialized line (a trailing newline is added). */
  write(line: string): void;
  /** Opens rotated then active synchronously and pins each generation's size. */
  openSnapshot(): RotatingFileSnapshot;
}

export interface RotatingFileSinkOptions {
  /** Enforced before appending to an existing active generation. */
  mode?: number;
  /** Rotate before a write that would make the active generation exceed maxBytes. */
  hardMaxBytes?: boolean;
  /** Best-effort observability for callers that need to surface sink failure. */
  onError?: (info: { operation: "stat" | "rotate" | "append" | "chmod" | "oversize" | "oversize_generation" | "unsafe_generation" | "snapshot"; error: unknown }) => void;
}

/**
 * @param path      active file path; rotated file is `${path}.1`.
 * @param maxBytes  rotate once the active file reaches/exceeds this. Total
 *                  on-disk ≈ 2×maxBytes. Must be > 0; non-positive disables
 *                  rotation (unbounded) — callers that want a cap must pass > 0.
 *                  hardMaxBytes callers must reject a serialized line larger
 *                  than maxBytes before calling write.
 */
export function createRotatingFileSink(
  path: string,
  maxBytes: number,
  opts: RotatingFileSinkOptions = {},
): RotatingFileSink {
  const report = (operation: "stat" | "rotate" | "append" | "chmod" | "oversize" | "oversize_generation" | "unsafe_generation" | "snapshot", error: unknown): void => {
    try {
      opts.onError?.({ operation, error });
    } catch {
      /* a diagnostic callback cannot break the sink */
    }
  };

  const secureGeneration = (filePath: string): boolean => {
    if (!existsSync(filePath)) return true;
    try {
      const stat = lstatSync(filePath);
      if (!stat.isFile()) {
        if (opts.mode === undefined && !opts.hardMaxBytes) return true;
        report("unsafe_generation", new Error("log generation is not a regular file"));
        return false;
      }
      if (opts.mode !== undefined) chmodSync(filePath, opts.mode);
      if (opts.hardMaxBytes && maxBytes > 0 && stat.size > maxBytes) {
        try {
          unlinkSync(filePath);
        } catch (error) {
          report("oversize_generation", error);
          return false;
        }
        report("oversize_generation", new Error(`removed generation larger than ${maxBytes} bytes`));
      }
      return true;
    } catch (error) {
      report("chmod", error);
      return false;
    }
  };

  const rotate = (): boolean => {
    try {
      // Overwrite any prior `.1` — we only keep one generation back.
      renameSync(path, `${path}.1`);
      if (opts.mode !== undefined) chmodSync(`${path}.1`, opts.mode);
      return true;
    } catch (error) {
      report("rotate", error);
      /* rename can fail (path gone, races) — swallow; next write recreates. */
      return false;
    }
  };

  const currentSize = (): number | null => {
    try {
      return existsSync(path) ? statSync(path).size : 0;
    } catch (error) {
      report("stat", error);
      return null;
    }
  };

  const sink: RotatingFileSink = {
    secure(): boolean {
      return secureGeneration(`${path}.1`) && secureGeneration(path);
    },
    write(line: string): void {
      try {
        if (!sink.secure()) return;
        const serialized = line + "\n";
        const serializedBytes = Buffer.byteLength(serialized, "utf8");
        if (opts.hardMaxBytes && maxBytes > 0 && serializedBytes > maxBytes) {
          report("oversize", new Error(`record exceeds ${maxBytes} bytes`));
          return;
        }
        const measuredBytes = currentSize();
        if (measuredBytes === null && opts.hardMaxBytes) return;
        const currentBytes = measuredBytes ?? 0;
        const shouldRotate = maxBytes > 0 && (opts.hardMaxBytes
          ? currentBytes > 0 && currentBytes + serializedBytes > maxBytes
          : currentBytes >= maxBytes);
        if (shouldRotate && !rotate() && opts.hardMaxBytes) return;
        appendFileSync(path, serialized, opts.mode === undefined ? undefined : { mode: opts.mode });
      } catch (error) {
        report("append", error);
        /* never let tracing break the daemon */
      }
    },
    openSnapshot(): RotatingFileSnapshot {
      const files: RotatingFileSnapshot["files"] = [];
      try {
        for (const candidate of [`${path}.1`, path]) {
          if (!existsSync(candidate)) continue;
          if (!secureGeneration(candidate)) continue;
          const noFollow = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
          const fd = openSync(candidate, constants.O_RDONLY | noFollow);
          try {
            const stat = fstatSync(fd);
            if (!stat.isFile()) throw new Error("snapshot source is not a regular file");
            files.push({ path: candidate, fd, size: stat.size });
          } catch (error) {
            closeSync(fd);
            throw error;
          }
        }
      } catch (error) {
        for (const file of files) {
          try { closeSync(file.fd); } catch { /* best effort */ }
        }
        report("snapshot", error);
        return { files: [], close: () => {} };
      }
      let closed = false;
      return {
        files,
        close(): void {
          if (closed) return;
          closed = true;
          for (const file of files) {
            try { closeSync(file.fd); } catch { /* best effort */ }
          }
        },
      };
    },
  };
  return sink;
}

```

### Core Architecture Module: `src/daemon/src/util/statusFile.ts`
```
/**
 * Atomic status-file writer for the `daemon status` snapshot (batch E2).
 *
 * The FSM daemon has NO IPC — `daemon stop`/`list`/`status` are separate CLI
 * processes, and `manager.snapshot()` lives only inside the running daemon. So
 * to answer "what is each agent's FSM state right now" out-of-band, the running
 * daemon periodically writes a slim projection to its per-key status file
 * (`daemons/<keyHash>/status.json` since batch C0 — was a single global
 * `<baseDir>/status.json`, which multiple daemons clobbered) and the
 * `daemon status` CLI reads that file (Cecilia's ruling (a): snapshot-file,
 * not a control listener — zero new network/attack surface, crash-safe: if the
 * daemon dies the last frame is still readable).
 *
 * ATOMIC: write to `<path>.tmp` then `rename` over `<path>`, so a concurrent
 * `daemon status` read never sees a half-written file (rename is atomic on the
 * same filesystem). Best-effort: a status write must NEVER break the daemon, so
 * failures are swallowed — a missing/stale status file is a tolerable "unknown",
 * far better than a crash.
 */
import { writeFileSync, renameSync } from "node:fs";

/** Shape persisted to status.json. Metadata only — no message content, no PII. */
export interface DaemonStatusSnapshot {
  /** ms epoch when this snapshot was written — the reader flags its age. */
  writtenAt: number;
  /**
   * Authoritative machine-level counts for `daemon list`.
   *
   * `total` is null until the daemon has loaded its machine-scoped bot roster;
   * reporting zero before that point would turn an unknown into a lie.
   * `running` comes from the process manager's owned physical sessions.
   *
   * Optional for compatibility with snapshots written by older daemons.
   */
  agentSummary?: {
    total: number | null;
    running: number;
  };
  agents: Array<{
    agentId: string;
    status: string;
    derivedActivity: string;
    turnActive: boolean;
    inbox: number;
    sinceProgressMs: number;
    stoppingSince: number | null;
  }>;
}

/** Write the snapshot atomically. Best-effort — never throws. */
export function writeStatusFile(path: string, snapshot: DaemonStatusSnapshot): void {
  try {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot));
    renameSync(tmp, path);
  } catch {
    /* never let status writing break the daemon */
  }
}

```

### Core Architecture Module: `src/daemon/src/util/traceSampler.ts`
```
/**
 * FSM-trace sampler — heartbeat throttling so the bounded trace retains a
 * useful HISTORY WINDOW instead of being flushed by routine noise.
 *
 * WHY: the default trace is capped at 32 MiB per generation (64 MiB for active
 * + `.1`, rotatingFileSink). At the executable N=8 operational envelope, the
 * sampler retains 8,168 rows / 4,010,728 serialized JSONL bytes per hour
 * (3.825 MiB/h), so the two generations preserve approximately 16.73 hours.
 * Unchanged-state heartbeats carry no new information and would otherwise flush
 * information-rich transitions far sooner; write rate still scales with agent
 * count, so a much larger fleet needs the byte budget revisited.
 *
 * INVARIANT (Cecilia 架构#423 ③): a row is sampleable IFF its information can be
 * fully reconstructed from the retained neighbors; otherwise it is sacrosanct.
 * Concretely:
 *   - SACROSANCT, never dropped:
 *       · any non-`tick` event (transition/lifecycle: exit, turn_end,
 *         reset_session, begin_reset, rewake_after_reset, spawned, wake,
 *         register, session);
 *       · ANY row whose `effects` is non-empty — the watchdog-fired frame
 *         (terminate_stalled/force_exit/…). This is where the PEAK
 *         `sinceProgressMs` lives (Blair's 121846ms was on the
 *         `effects:['terminate_stalled']` tick; the following turn_end had
 *         already reset it to 0). Dropping it would shorten the reconstructed
 *         "stuck for how long". (Cecilia 架构#423 ④.)
 *   - SAMPLEABLE (throttled): unchanged-state `tick`, plus `root_work` /
 *     `runtime_signal` heartbeats. An unchanged-state tick is one with
 *     `effects==[]` AND status/turnActive/inbox/resetting/stopping unchanged
 *     from the previous emitted tick for that agent.
 *
 * WEDGE RECONSTRUCTION (Claudette 架构#421 assertion ②): a stuck run must remain
 * reconstructable — which state/phase, how long, through to kill — from the
 * retained rows alone. Guaranteed by: the edge INTO the stuck state is emitted
 * (state change), interior points every `throttleMs` bound the slope, the last
 * unchanged tick of the run is TAIL-FLUSHED (held and emitted right before the
 * next emitted tick-stream row), and the terminating frame (effects tick / a
 * transition) is sacrosanct. `sinceProgressMs` is self-contained on each tick
 * row, so duration reconstructs from the tick stream alone even when the
 * `root_work` stream is fully folded.
 */

/** Sampler-visible subset of the manager's explicitly allowlisted trace rows. */
interface TraceRec {
  recordKind: "fsm" | "turn_span";
  agentId: string;
  event: string;
  effects: string[];
  nowMs: number;
  status?: unknown;
  turnActive?: unknown;
  inbox?: unknown;
  resetting?: unknown;
  stoppingSince?: unknown;
  deliveryPhase?: unknown;
}

export interface TraceSampler {
  /** Offer one record; the sampler emits it (and any tail-flush) or folds it. */
  offer(rec: TraceRec): void;
}

/** Streams that are throttled rather than always-emitted. */
const SAMPLEABLE_EVENTS = new Set(["tick", "root_work", "runtime_signal"]);
const SACRED_TURN_SPAN_EVENTS = new Set(["turn_begin", "turn_end", "turn_abort"]);

/** Default heartbeat throttle: at most one folded-stream row per agent per this. */
export const DEFAULT_TRACE_SAMPLE_MS = 30_000;
/** Cap for each generation of the default-on local FSM trace (active and `.1`). */
export const DEFAULT_TRACE_FILE_MAX_BYTES = 32 * 1024 * 1024;

interface AgentSamplerState {
  /** Last emitted tick's reconstruct-key (state fingerprint); null before first. */
  lastTickKey: string | null;
  /** nowMs of the last emitted `tick` for this agent (for the throttle window). */
  lastTickEmitAt: number;
  /** The most recent throttled (folded) unchanged tick, held for tail-flush. */
  pendingTick: TraceRec | null;
  /** Last emitted `root_work` nowMs. */
  lastProgressEmitAt: number;
  /** Last emitted `runtime_signal` deliveryPhase (edge detection) + nowMs. */
  lastSignalPhase: string | null;
  lastSignalEmitAt: number;
}

function newAgentState(): AgentSamplerState {
  return {
    lastTickKey: null,
    lastTickEmitAt: Number.NEGATIVE_INFINITY,
    pendingTick: null,
    lastProgressEmitAt: Number.NEGATIVE_INFINITY,
    lastSignalPhase: null,
    lastSignalEmitAt: Number.NEGATIVE_INFINITY,
  };
}

/** The reconstruct-key: two ticks with the same key are informationally identical. */
function tickKey(rec: TraceRec): string {
  return [
    rec.status,
    rec.turnActive,
    rec.inbox,
    rec.resetting,
    rec.stoppingSince == null ? "s0" : "s1",
  ].join("|");
}

function hasEffects(rec: TraceRec): boolean {
  const e = rec.effects;
  return Array.isArray(e) && e.length > 0;
}

function nowOf(rec: TraceRec): number {
  return typeof rec.nowMs === "number" ? rec.nowMs : 0;
}

/**
 * @param emit       called for each row that survives sampling (in order).
 * @param throttleMs min gap between folded-stream rows per agent (default 30s).
 */
export function createTraceSampler(
  emit: (rec: TraceRec) => void,
  throttleMs: number = DEFAULT_TRACE_SAMPLE_MS,
): TraceSampler {
  const perAgent = new Map<string, AgentSamplerState>();

  const stateFor = (agentId: string): AgentSamplerState => {
    let s = perAgent.get(agentId);
    if (!s) {
      s = newAgentState();
      perAgent.set(agentId, s);
    }
    return s;
  };

  /** Emit the held tail tick (if any) so an unchanged run's LAST row survives. */
  const flushPending = (s: AgentSamplerState): void => {
    if (s.pendingTick) {
      const p = s.pendingTick;
      s.pendingTick = null;
      s.lastTickEmitAt = nowOf(p);
      emit(p);
    }
  };

  return {
    offer(rec: TraceRec): void {
      const agentId = typeof rec.agentId === "string" ? rec.agentId : null;
      // No agent id (shouldn't happen for emitted rows) → pass through untouched.
      if (!agentId) {
        emit(rec);
        return;
      }
      const s = stateFor(agentId);
      const event = rec.event;

      // Lifecycle rows are explicitly sacred rather than relying on their
      // current absence from SAMPLEABLE_EVENTS. This survives future sampler
      // expansion and preserves the pending tick tail before the boundary.
      if (rec.recordKind === "turn_span" && SACRED_TURN_SPAN_EVENTS.has(String(event))) {
        flushPending(s);
        emit(rec);
        return;
      }

      // Sacrosanct: any non-sampleable event, or ANY row carrying effects (the
      // watchdog-fired frame). Flush the pending tail first so run order + the
      // last unchanged tick are preserved ahead of the terminating frame.
      if (!SAMPLEABLE_EVENTS.has(event as string) || hasEffects(rec)) {
        flushPending(s);
        // A sacrosanct tick still updates the tick anchors (it IS an emitted tick).
        if (event === "tick") {
          s.lastTickKey = tickKey(rec);
          s.lastTickEmitAt = nowOf(rec);
        }
        emit(rec);
        return;
      }

      // ---- Sampleable heartbeat streams ----
      if (event === "tick") {
        const key = tickKey(rec);
        const now = nowOf(rec);
        // State-change EDGE → always emit (the run boundary; carries the fresh
        // state). Flush the prior run's tail first.
        if (key !== s.lastTickKey) {
          flushPending(s);
          s.lastTickKey = key;
          s.lastTickEmitAt = now;
          emit(rec);
          return;
        }
        // Unchanged state: emit at most one per throttle window; otherwise HOLD
        // as the run's tail (overwrite — we only need the latest folded one).
        if (now - s.lastTickEmitAt >= throttleMs) {
          s.pendingTick = null; // this row supersedes any earlier held tail
          s.lastTickEmitAt = now;
          emit(rec);
        } else {
          s.pendingTick = rec;
        }
        return;
      }

      if (event === "root_work") {
        // Redundant with the next tick's sinceProgressMs; keep a sparse sample
        // for a coarse liveness pulse, fold the rest.
        const now = nowOf(rec);
        if (now - s.lastProgressEmitAt >= throttleMs) {
          s.lastProgressEmitAt = now;
          emit(rec);
        }
        return;
      }

      // runtime_signal: keep phase-change EDGES, throttle same-phase runs.
      if (event === "runtime_signal") {
        const phase = typeof rec.deliveryPhase === "string" ? rec.deliveryPhase : "";
        const now = nowOf(rec);
        if (phase !== s.lastSignalPhase || now - s.lastSignalEmitAt >= throttleMs) {
          s.lastSignalPhase = phase;
          s.lastSignalEmitAt = now;
          emit(rec);
        }
        return;
      }

      // Unreachable (SAMPLEABLE_EVENTS covered above), but fail-open: emit.
      emit(rec);
    },
  };
}

```

### Core Architecture Module: `src/desktop/src-tauri/plugins/mobile-share-image/android/src/main/java/ai/alook/plugin/mobileshareimage/MobileShareImageDocumentCoordinatorCore.kt`
```
package ai.alook.plugin.mobileshareimage

import java.io.File

internal enum class MobileShareImageDocumentPhase {
    LAUNCHING,
    WAITING,
    WRITING,
    TERMINAL,
}

internal enum class MobileShareImageDocumentDelivery {
    ORPHAN,
    STALE,
    CANCEL,
    WRITE,
}

internal fun classifyMobileShareImageDocumentDelivery(
    currentToken: String?,
    currentOwnerGeneration: String?,
    currentPhase: MobileShareImageDocumentPhase?,
    attachedOwnerGeneration: String?,
    hasOwner: Boolean,
    callbackToken: String,
    callbackOwnerGeneration: String,
    successfulSelection: Boolean,
): MobileShareImageDocumentDelivery {
    if (currentToken == null || currentToken != callbackToken) {
        return MobileShareImageDocumentDelivery.ORPHAN
    }
    if (
        currentOwnerGeneration != callbackOwnerGeneration ||
        attachedOwnerGeneration != callbackOwnerGeneration ||
        !hasOwner ||
        currentPhase != MobileShareImageDocumentPhase.WAITING
    ) {
        return MobileShareImageDocumentDelivery.STALE
    }
    return if (successfulSelection) {
        MobileShareImageDocumentDelivery.WRITE
    } else {
        MobileShareImageDocumentDelivery.CANCEL
    }
}

internal fun interface MobileShareImageDocumentLauncher {
    fun launch(token: String, filename: String)
}

internal interface MobileShareImageDocumentOutput {
    fun writeFrom(staging: File)
    fun flush()
    fun close()
}

internal fun interface MobileShareImageDocumentDestination {
    fun open(): MobileShareImageDocumentOutput
}

internal interface MobileShareImageDocumentTerminal {
    fun resolve()
    fun reject(failure: MobileShareImageFailure)
}

internal data class MobileShareImageDocumentRequest(
    val attemptId: String,
    val token: String,
    val staging: File,
    val filename: String,
    val terminal: MobileShareImageDocumentTerminal,
    val release: () -> Unit,
)

internal class MobileShareImageDocumentCoordinatorCore(
    private val execute: ((() -> Unit) -> Unit),
    private val deleteStaging: (File) -> Unit = { it.delete() },
    private val reportFailure: (Exception) -> Unit = {},
) {
    private data class Owner(
        val generation: String,
        val launcher: MobileShareImageDocumentLauncher,
    )

    private data class PendingDocument(
        val request: MobileShareImageDocumentRequest,
        var phase: MobileShareImageDocumentPhase,
        var ownerGeneration: String,
    )

    private val lock = Any()
    private var owner: Owner? = null
    private var pending: PendingDocument? = null

    fun attach(
        generation: String,
        restoredToken: String?,
        launcher: MobileShareImageDocumentLauncher,
    ) {
        synchronized(lock) {
            owner = Owner(generation, launcher)
            val active = pending
            if (
                active != null &&
                restoredToken == active.request.token &&
                active.phase != MobileShareImageDocumentPhase.TERMINAL
            ) {
                active.ownerGeneration = generation
            }
        }
    }

    fun detach(generation: String) {
        synchronized(lock) {
            if (owner?.generation == generation) owner = null
        }
    }

    fun liveToken(): String? = synchronized(lock) { pending?.request?.token }

    fun tokenForOwner(generation: String): String? = synchronized(lock) {
        val active = pending ?: return@synchronized null
        if (active.ownerGeneration == generation) active.request.token else null
    }

    fun begin(request: MobileShareImageDocumentRequest) {
        val launchOwner = synchronized(lock) {
            if (pending != null) {
                throw MobileShareImageFailure("busy", "Another document save is active")
            }
            val attached = owner
                ?: throw MobileShareImageFailure("unavailable", "Document picker is unavailable")
            pending = PendingDocument(
                request = request,
                phase = MobileShareImageDocumentPhase.LAUNCHING,
                ownerGeneration = attached.generation,
            )
            attached
        }

        try {
            launchOwner.launcher.launch(request.token, request.filename)
        } catch (error: Exception) {
            val failed = synchronized(lock) {
                val active = pending
                if (
                    active?.request?.token == request.token &&
                    active.phase == MobileShareImageDocumentPhase.LAUNCHING
                ) {
                    active.phase = MobileShareImageDocumentPhase.TERMINAL
                    pending = null
                    if (owner?.generation == active.ownerGeneration) owner = null
                    active
                } else {
                    null
                }
            }
            failed?.let {
                settleFailure(
                    it,
                    MobileShareImageFailure(
                        "unavailable",
                        error.message ?: "Could not open document picker",
                    ),
                )
            }
            return
        }

        synchronized(lock) {
            val active = pending
            if (
                active?.request?.token == request.token &&
                active.phase == MobileShareImageDocumentPhase.LAUNCHING
            ) {
                active.phase = MobileShareImageDocumentPhase.WAITING
            }
        }
    }

    fun deliver(
        generation: String,
        token: String?,
        destination: MobileShareImageDocumentDestination?,
        cleanupOrphan: (String) -> Unit,
    ) {
        if (token == null) return
        val claim = synchronized(lock) {
            val current = pending
            when (
                classifyMobileShareImageDocumentDelivery(
                    currentToken = current?.request?.token,
                    currentOwnerGeneration = current?.ownerGeneration,
                    currentPhase = current?.phase,
                    attachedOwnerGeneration = owner?.generation,
                    hasOwner = owner != null,
                    callbackToken = token,
                    callbackOwnerGeneration = generation,
                    successfulSelection = destination != null,
                )
            ) {
                MobileShareImageDocumentDelivery.ORPHAN -> DeliveryClaim.Orphan
                MobileShareImageDocumentDelivery.STALE -> DeliveryClaim.Stale
                MobileShareImageDocumentDelivery.CANCEL -> {
                    current!!.phase = MobileShareImageDocumentPhase.TERMINAL
                    pending = null
                    DeliveryClaim.Active(current)
                }
                MobileShareImageDocumentDelivery.WRITE -> {
                    current!!.phase = MobileShareImageDocumentPhase.WRITING
                    DeliveryClaim.Active(current)
                }
            }
        }

        when (claim) {
            DeliveryClaim.Orphan -> {
                if (isValidNativeToken(token)) runCatching { cleanupOrphan(token) }
                    .onFailure(::report)
            }
            DeliveryClaim.Stale -> Unit
            is DeliveryClaim.Active -> {
                if (destination == null) {
                    settleFailure(
                        claim.pending,
                        MobileShareImageFailure("cancelled", "Document save was cancelled"),
                    )
                } else {
                    try {
                        execute { writeAndSettle(claim.pending, destination) }
                    } catch (error: Exception) {
                        finishWrite(claim.pending, writeFailure(error, "Could not write selected document"))
                    }
                }
            }
        }
    }

    private fun writeAndSettle(
        active: PendingDocument,
        destination: MobileShareImageDocumentDestination,
    ) {
        var output: MobileShareImageDocumentOutput? = null
        var failure: MobileShareImageFailure? = null
        try {
            output = destination.open()
        } catch (error: Exception) {
            failure = writeFailure(error, "Could not open selected document")
        }
        if (failure == null) {
            try {
                output!!.writeFrom(active.request.staging)
            } catch (error: Exception) {
                failure = writeFailure(error, "Could not write selected document")
            }
        }
        if (failure == null) {
            try {
                output!!.flush()
            } catch (error: Exception) {
                failure = writeFailure(error, "Could not flush selected document")
            }
        }
        if (output != null) {
            try {
                output.close()
            } catch (error: Exception) {
                if (failure == null) {
                    failure = writeFailure(error, "Could not close selected document")
                } else {
                    report(error)
                }
            }
        }
        finishWrite(active, failure)
    }

    private fun finishWrite(active: PendingDocument, failure: MobileShareImageFailure?) {
        val terminal = synchronized(lock) {
            val current = pending
            if (current === active && current.phase == MobileShareImageDocumentPhase.WRITING) {
                current.phase = MobileShareImageDocumentPhase.TERMINAL
                pending = null
                current
            } else {
                null
            }
        } ?: return

        delete(terminal.request.staging)
        try {
            if (failure == null) terminal.request.terminal.resolve()
            else terminal.request.terminal.reject(failure)
        } catch (error: Exception) {
            report(error)
        } finally {
            release(terminal.request)
        }
    }

    private fun settleFailure(active: PendingDocument, failure: MobileSha
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #308** (2026-06-08): **🚨 URGENT: Fix cache headers for SEO indexing**
  *Symptoms*: ## 🚨 CRITICAL SEO FIX - Blocking All Google Indexing  ### Problem Production site has been using `cache-control: private, no-cache, no-store` headers since June 1, preventing Google from indexing ANY pages on alook.ai. This is blocking all SEO efforts and making 7 days of content work invisible.  ### Root Cause The `_headers` file approach (commit e5f0319c) doesn't work with our Next.js + OpenNext + Cloudflare setup. Cloudflare doesn't respect static `_headers` files when using Next.js routing.  ### Solution Implement cache headers through Next.js `headers()` function in `next.config.ts`, which properly integrates with OpenNext and Cloudflare.  ### Changes - ✅ Add `headers()` function to `next.config.ts` with proper cache control - ✅ Remove ineffective `_headers` file from public directory - ✅ Set appropriate cache headers for different route patterns:   - **Blog pages**: `public, max-age=3600, s-maxage=31536000` (1hr browser, 1yr CDN)   - **Homepage**: `public, max-age=3600, s-maxage=86400` (1hr browser, 1day CDN)   - **Static assets**: `public, max-age=31536000, immutable` (1yr immutable)   - **Images/gallery**: `public, max-age=2592000` (1mo cache)   - **API routes**: `no-store, no-cache` (no cache)   - **Default pages**: `public, max-age=3600, s-maxage=3600` (1hr cache)  ### Impact - ✅ Removes all instances of "private, no-cache, no-store" - ✅ Adds "public" directive required for Google indexing - ✅ Enables proper CDN caching with s-maxage - ✅ Fixes the critical SEO bloc
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/alookai/alook/pull/308?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=alookai) Report :x: Patch coverage is `0%` with `2 lines` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/alookai/alook/pull/308?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=alookai) | Patch % | Lines | |---|---|---| | [src/web/next.config.ts](https://app.codecov.io/gh/alookai/alook/pull/308?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=alookai#diff-c3JjL3dlYi9uZXh0LmNvbmZpZy50cw==) | 0.00% | [2 Missing :warning: ](https://app.codecov.io/gh/alookai/alook/pull/308?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=alookai) |  :loudspeaker: Thoughts on this 
  > Closing per Donia's direction. This work will be handled through proper channels via Jarvis.

- **Issue #211** (2026-05-29): **[Bug]: Inbound email subject not decoded from MIME RFC 2047 encoding**
  *Symptoms*: ## Describe the Bug  Inbound emails received via Cloudflare Email Routing have their subjects stored as raw RFC 2047 MIME encoded strings instead of decoded Unicode text. This causes garbled display like `=?UTF-8?q?Re:_=E6=96=B0=E6=B3=A8=E5=86=8C=E7=94=A8=E6=88=B7?=` instead of `Re: 新注册用户` across the entire platform.  ## To Reproduce  1. Receive an inbound email with a non-ASCII subject (e.g., Chinese characters) via Cloudflare Email Routing 2. View the Activity feed or Email list in the web app 3. Subject displays as raw MIME encoded string  ## Expected Behavior  Subject should be decoded to readable Unicode text (e.g., `Re: 新注册用户`) at ingestion time, before being stored in the database.  ## Root Cause  In `src/email-worker/src/index.ts:358`:  ```ts const subject = message.headers.get("subject") || parsed.subject || "(No Subject)" ```  `message.headers.get("subject")` returns the raw RFC 2822 header with RFC 2047 encoded-words intact. Since it's always truthy for encoded subjects, it takes priority over `parsed.subject` (which `postal-mime` has already decoded).  **Note:** The IMAP poller path (`src/email-worker/src/imap-poller-do.ts:217`) correctly uses `parsed.subject` and is NOT affected.  ## Affected Areas  | Location | Field | |----------|-------| | `emails` table | `subject` column | | `conversation` table | `title` column | | `agent_task_queue` table | `prompt` field | | Activity feed | task.prompt display | | Email list | email.subject display | | Email event sheet |

- **Issue #208** (2026-05-31): **[Bug]: N+1 query in studio agent creation (sequential runtime fetches)**
  *Symptoms*: ## Describe the Bug  Studio creation route performs sequential runtime fetches in a loop (line 58-64), agent creation per member with DB ops per iteration, plus `.find()` inside loop (line 159) creating O(n×m) scans.  ## To Reproduce  1. Create a studio with multiple members 2. Observe cascading sequential DB operations for runtime fetches and agent creation  ## Expected Behavior  - Batch-fetch runtimes in a single query - Use Map for member lookups instead of `.find()` in loop - Pre-compute Set of created IDs before filtering  ## Environment  - **Package**: @alook/web - **File**: `src/web/src/app/api/studios/route.ts:58-64, 112-150, 159`  ## Impact  Studio creation with multiple members triggers cascading sequential DB operations, causing high latency.  ## Proposed Fix  Batch-fetch runtimes; use Map for member lookups; pre-compute Set of created IDs before filtering. ~1hr effort.  ## Additional Context  Identified by architecture health scan (2026-05-29, Critical severity).
  **Post-Mortem & Fix Analysis**:
  > Verified: studios/route.ts already uses batch getAgentRuntimesForWorkspace() + Map cache. N+1 no longer exists.

- **Issue #207** (2026-05-29): **[Bug]: N+1 query in studio handle validation (up to 24 sequential DB queries)**
  *Symptoms*: ## Describe the Bug  Studio handle validation (`check-handles` route) performs nested loops with DB queries — outer loop iterates N candidate names (up to 4), inner loop tries 5 suffixes per name. This results in up to ~24 sequential DB queries per request.  ## To Reproduce  1. Create a new studio 2. Observe sequential DB queries during handle validation  ## Expected Behavior  Candidate handles should be batch-fetched in a single query and checked against an in-memory Set.  ## Environment  - **Package**: @alook/web - **File**: `src/web/src/app/api/studios/check-handles/route.ts:28-62`  ## Impact  Hot path during studio creation. High latency under load.  ## Proposed Fix  Batch-fetch all candidate handles in a single query, check existence against in-memory Set. ~30min effort.  ## Additional Context  Identified by architecture health scan (2026-05-29, Critical severity).

- **Issue #194** (2026-05-28): **test: Add regression e2e tests for historical production bugs**
  *Symptoms*: ## Background  Review of our conversation history (Apr 20 – May 28, 2026) reveals recurring production bugs that were caught manually but have **no e2e test coverage to prevent regression**. Many of these bugs have already recurred (e.g., workspace overwrite was fixed then broke again).  ## High-Priority Regression Cases  ### 1. Multi-workspace daemon registration (recurred 3x) **Bug:** User with existing workspace creates a new workspace → daemon register overwrites previous workspace / agent goes offline. - 2026-04-29: "用户会出现 `unknown runtime: xxx`，`agent_runtime`表里会有两条数据" - 2026-05-11: "daemon 连接的 workspace id 有问题，chat 对话一直 `queued`" - 2026-05-26: "`New workspace` 会覆盖之前的 workspace"  **Test needed:** `multi-workspace-register.test.ts` - Register daemon with workspace A → verify online - Create workspace B, register same daemon → verify workspace A still online - Tasks in both workspaces should route correctly  ### 2. Buffered message (follow-up) auto-dispatch failure **Bug:** Follow-up messages queued during active task don't auto-dispatch after completion; they appear in UI but never trigger next task. - 2026-04-23: "follow up 功能，上一个对话完成后应该会自动发送，但是出现在气泡里，follow up 不会消失，对话也会卡住"  **Test needed:** `follow-up-auto-dispatch.test.ts` - Create task → start → send buffered messages → complete task → verify new task auto-dispatched with buffered content  ### 3. Task status transition errors **Bug:** Task fail/supersede called on wrong status produces confusing errors or silent corr

- **Issue #173** (2026-05-27): **Bug: Task cancellation doesn't reliably stop execution**
  *Symptoms*: ## Problem  When a user cancels a running task, the UI shows "Task cancelled by user" but the agent's steps continue running for 15-75 seconds before actually stopping.  ## Root Cause (verified)  ### The bug: `daemon.kill` WS push uses empty `agent_id`  In `src/cli/daemon/daemon.ts:581-609`, when daemon receives a `daemon.kill` WebSocket push, it constructs a fake task object with `agent_id: ""`:  ```ts case "daemon.kill": {   const killTask = fromApiTask({     id: msg.taskId,     agent_id: "",        // ← BUG: empty string     // ...     context: { target_task_id: msg.targetTaskId },   });   handleTask(client, config, runtimeIndex, killTask, ws.token, activeTasks); } ```  In `handleTask` (line 885), this empty `agentId` produces a wrong filesystem path: ```ts const agentBaseDir = join(config.workspacesRoot, task.workspaceId, task.agentId, "workdir"); // Result: {root}/{workspaceId}//workdir/.context_timeline/  ← WRONG // Should: {root}/{workspaceId}/{realAgentId}/workdir/.context_timeline/ ```  `findRunningPidByTaskId()` searches this wrong directory, finds no timeline JSONL, polls for 15 seconds, then gives up.  ### Why the process eventually stops (poll fallback)  After the WS push path fails: 1. Daemon calls `client.failTask(token, killTask.id, "target not found in timeline")` 2. BUT the kill task in DB is still `queued` (never claimed/dispatched via WS path) 3. Server-side `failTask` only updates tasks with `status IN ("dispatched", "running")` → WHERE doesn't match → **

- **Issue #172** (2026-05-27): **Channel operations need loading state and double-click prevention**
  *Symptoms*: ## Problem  Channel create/delete/rename operations in `src/web/src/contexts/channel-context.tsx` and `src/web/src/components/channel-bar.tsx` have no loading state or debounce protection:  - **Create**: User can click the save button multiple times → creates duplicate channels - **Delete**: User can trigger delete confirm multiple times → multiple API calls, potential errors - **Rename**: User can submit rename multiple times → race condition with `fetchChannels()`  Current code (e.g. `channel-context.tsx:89-96`): ```ts const createChannel = useCallback(async (name: string) => {   const created = await createChannelApi(workspaceId, name);   await fetchChannels();   return created; }, [workspaceId, fetchChannels]); ```  No guard against concurrent calls, no loading indicator during the async operation.  ## Expected behavior  1. **Loading state**: Buttons/inputs should show a loading spinner or be disabled while the operation is in progress 2. **Double-click prevention**: Disable the trigger element immediately on first click, re-enable after completion 3. **Visual feedback**: User should know the operation is processing (spinner on create button, disabled state on delete confirm, etc.)  ## Suggested approach  Option A — Add per-operation loading state in the context: ```ts const [creating, setCreating] = useState(false); const createChannel = useCallback(async (name: string) => {   if (creating) return;   setCreating(true);   try {     const created = await createChannelApi(w

- **Issue #153** (2026-05-31): **Email worker uses unscoped getEmailAccountById — potential cross-workspace access**
  *Symptoms*: ## Bug Description  The email-worker's internal handlers use `getEmailAccountById()` which queries by ID only without workspace scoping. If the internal service endpoint is reachable, an attacker who guesses an email account ID from another workspace can access its encrypted credentials.  ## Affected Files - `src/shared/src/db/queries/email-account.ts` (lines 49-55) — `getEmailAccountById` has no workspaceId filter - `src/email-worker/src/index.ts` (line 274) — `handleTestConnection()` uses unscoped lookup - `src/email-worker/src/imap-poller-do.ts` (lines 53, 72, 105) — polling uses unscoped lookup  ## Root Cause  ```typescript // email-account.ts:49-55 export async function getEmailAccountById(db: Database, id: string) {   const rows = await db.select().from(agentEmailAccount)     .where(eq(agentEmailAccount.id, id));  // No workspace filter!   return rows[0] ?? null; } ```  The web API routes correctly use `getEmailAccountScoped()` with workspace validation, but the email-worker receives only an `accountId` parameter and calls the unscoped function.  ## Suggested Fix  Either: 1. Pass `workspaceId` to the email-worker and use `getEmailAccountScoped()`, or 2. Add workspace validation in the email-worker before processing  ## Severity Medium-High — internal service, but defense-in-depth requires workspace scoping at every layer.

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

### Incident Patch 1: `4a21f14a` (2026-10-05)
**Commit Message**: fix(web): preserve mobile share image assets and brand font (#873)

**File**: `src/web/src/lib/community/share-image-session.dom.test.ts` (modified, +85/-0)
```diff
@@ -526,6 +526,35 @@ describe("prepareShareImageSession", () => {
     expect(document.querySelector("[data-share-detached-tree]")).toBeNull()
   })
 
+  it("resolves inline font variables before the embedder collects font families", async () => {
+    const source = sourceCard('<span style="font-family:var(--font-body)">Message</span>')
+    const brand = source.querySelector<HTMLElement>("[data-share-brand]")!
+    brand.style.fontFamily = "var(--font-brand)"
+    const nativeComputedStyle = window.getComputedStyle.bind(window)
+    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
+      const computed = nativeComputedStyle(element, pseudo)
+      if (element instanceof HTMLElement && element.style.fontFamily.startsWith("var(")) {
+        return new Proxy(computed, {
+          get(target, key) {
+            if (key === "fontFamily") return element.hasAttribute("data-share-brand") ? "Brand" : "Body"
+            const value = Reflect.get(target, key)
+            return typeof value === "function" ? value.bind(target) : value
+          },
+        })
+      }
+      return computed
+    })
+    const getFontCSS = vi.fn(async (card: HTMLElement) => {
+      expect(card.querySelector<HTMLElement>("[data-share-brand]")!.style.fontFamily).toBe("Brand")
+      expect(card.querySelector<HTMLElement>("span")!.style.fontFamily).toBe("Body")
+      return FONT_CSS
+    })
+    await expect(prepareShareImageSession(source, { getFontCSS, waitForPaint: async () => undefined }))
+      .resolves.toMatchObject({ fontEmbedCSS: FONT_CSS })
+    expect(brand.style.fontFamily).toBe("var(--font-brand)")
+    expect(getFontCSS).toHaveBeenCalledTimes(1)
+  })
+
   it("treats an empty font embed as a hard preparation failure", async () => {
     const source = sourceCard("<span>hello</span>")
 
@@ -950,6 +979,62 @@ describe("prepareShareImageSession", () => {
 })
 
 describe("capturePreparedShareImage", () => {
+  const webkitUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
+
+  beforeEach(() => {
+    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("AppleWebKit/537.36 Chrome/146.0 Safari/537.36")
+  })
+
+  it("returns the second WebKit rasterization after warming the same frozen resources", async () => {
+    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(webkitUserAgent)
+    const preview = sourceCard('<img src="data:image/png;base64,AQID">')
+    const warmup = new Blob(["missing image"], { type: "image/png" })
+    const final = new Blob(["complete image"], { type: "image/png" })
+    const rasterize = vi.fn().mockResolvedValueOnce(warmup).mockResolvedValueOnce(final)
+
+    await expect(capturePreparedShareImage(preview, FONT_CSS, rasterize)).resolves.toBe(final)
+    expect(rasterize).toHaveBeenCalledTimes(2)
+    expect(rasterize.mock.calls[0]).toEqual(rasterize.mock.calls[1])
+    expect(document.querySelector("[data-share-detached-tree]")).toBeNull()
+  })
+
+  it("rejects an empty WebKit warmup without publishing or retrying it", async () => {
+    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(webkitUserAgent)
+    const rasterize = vi.fn().mockResolvedValue(null)
+    await expect(capturePreparedShareImage(sourceCard("ready"), FONT_CSS, rasterize))
+      .rejects.toMatchObject({ stage: "rasterize", cause: { message: "Rasterizer returned no warmup image" } })
+    expect(rasterize).toHaveBeenCalledTimes(1)
+    expect(document.querySelector("[data-share-detached-tree]")).toBeNull()
+  })
+
+  it("does not start the final rasterization after cancelling WebKit warmup", async () => {
+    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(webkitUserAgent)
+    const controller = new AbortController()
+    const warmup = deferred<Blob>()
+    const rasterize = vi.fn(() => warmup.promise)
+    const pending = capturePreparedShareImage(sourceCard("ready"), FONT_CSS, rasterize, { signal: controller.signal })
+    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" })
+    await vi.waitFor(() => expect(rasterize).toHaveBeenCalledTimes(1))
+    controller.abort()
+    warmup.resolve(new Blob(["warmup"], { type: "image/png" }))
+    await assertion
+    await Promise.resolve()
+    expect(rasterize).toHaveBeenCalledTimes(1)
+    expect(document.querySelector("[data-share-detached-tree]")).toBeNull()
+  })
+
+  it("keeps WebKit warmup within the capture deadline", async () => {
+    vi.useFakeTimers()
+    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(webkitUserAgent)
+    const rasterize = vi.fn(() => new Promise<Blob>(() => {}))
+    const pending = capturePreparedShareImage(sourceCard("ready"), FONT_CSS, rasterize, { timeoutMs: 25 })
+    const assertion = expect(pending).rejects.toMatchObject({ stage: "rasterize", timedOut: true })
+    await act(async () => vi.advanceTimersByTimeAsync(25))
+    await assertion
+    expect(rasterize).toHaveBeenCalledTimes(1)
+    expec
```

**File**: `src/web/src/lib/community/share-image-session.ts` (modified, +11/-2)
```diff
@@ -680,6 +680,9 @@ async function loadAndEmbedFonts(
   if (loadedFaces.length === 0) throw new Error("Brand font is unavailable")
   await document.fonts.ready
   throwIfAborted(signal)
+  for (const element of [card, ...card.querySelectorAll<HTMLElement>("*")]) {
+    element.style.fontFamily = getComputedStyle(element).fontFamily
+  }
   const css = await getFontCSS(card)
   if (!css.trim()) throw new Error("Share-card fonts could not be embedded")
   return css
@@ -799,13 +802,19 @@ export async function capturePreparedShareImage(
         element.style.setProperty("transition", "none", "important")
       }
       throwIfAborted(signal)
-      const blob = await rasterize(card, {
+      const rasterizeOptions = {
         pixelRatio: SHARE_IMAGE_PIXEL_RATIO,
         backgroundColor: getComputedStyle(card).getPropertyValue("--card").trim() || undefined,
         fontEmbedCSS,
         includeQueryParams: true,
         cacheBust: false,
-      })
+      }
+      if (/AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Android|Edg\/|OPR\//.test(navigator.userAgent)) {
+        const warmup = await rasterize(card, rasterizeOptions)
+        throwIfAborted(signal)
+        if (!warmup) throw new Error("Rasterizer returned no warmup image")
+      }
+      const blob = await rasterize(card, rasterizeOptions)
       throwIfAborted(signal)
       if (!blob) throw new Error("Rasterizer returned no image")
       return blob
```

**File**: `src/web/src/test/e2e-ui/51-share-image-assets.spec.ts` (modified, +26/-5)
```diff
@@ -283,9 +283,20 @@ async function comparePreviewToCapture(
   page: Page,
   card: Locator,
   captureIndex: number,
+  regionSelector?: string,
 ) {
+  const region = await card.evaluate((node, selector) => {
+    const cardRect = node.getBoundingClientRect()
+    const rect = selector ? node.querySelector(selector)!.getBoundingClientRect() : cardRect
+    return {
+      left: (rect.left - cardRect.left) / cardRect.width,
+      top: (rect.top - cardRect.top) / cardRect.height,
+      right: (rect.right - cardRect.left) / cardRect.width,
+      bottom: (rect.bottom - cardRect.top) / cardRect.height,
+    }
+  }, regionSelector)
   const screenshot = await card.screenshot({ animations: "disabled" })
-  return page.evaluate(async ({ previewBase64, index }) => {
+  return page.evaluate(async ({ previewBase64, index, region }) => {
     const captured = (window as typeof window & {
       __shareCaptures?: { clipboard: Blob[] }
     }).__shareCaptures?.clipboard[index]
@@ -311,8 +322,8 @@ async function comparePreviewToCapture(
     const exportPixels = exportContext.getImageData(0, 0, exported.width, exported.height).data
     let difference = 0
     let samples = 0
-    for (let y = 0; y < exported.height; y += 4) {
-      for (let x = 0; x < exported.width; x += 4) {
+    for (let y = Math.ceil(region.top * exported.height); y < region.bottom * exported.height; y += 1) {
+      for (let x = Math.ceil(region.left * exported.width); x < region.right * exported.width; x += 1) {
         const offset = (y * exported.width + x) * 4
         difference += Math.abs(previewPixels[offset]! - exportPixels[offset]!)
         difference += Math.abs(previewPixels[offset + 1]! - exportPixels[offset + 1]!)
@@ -330,7 +341,7 @@ async function comparePreviewToCapture(
     preview.close()
     exported.close()
     return result
-  }, { previewBase64: screenshot.toString("base64"), index: captureIndex })
+  }, { previewBase64: screenshot.toString("base64"), index: captureIndex, region })
 }
 
 function sampleCenter(card: Locator, selector: string): Promise<SamplePoint> {
@@ -687,7 +698,8 @@ test("light and dark desktop and narrow previews match their frozen full PNG", a
   const { page } = await asUser("alice")
   const route = `/c/channels/${serverId}/${channelId}`
   await gotoAfterUserWsAuth(page, route)
-  const seeded = await seedMessage(page, channelId, "Frozen theme, font, logo, geometry, and full-card pixels")
+  const attachmentId = await uploadAttachment(page, channelId)
+  const seeded = await seedMessage(page, channelId, "Frozen theme, font, logo, geometry, and full-card pixels", [attachmentId])
   await installShareCapture(page)
 
   const observations: Array<{
@@ -733,6 +745,15 @@ test("light and dark desktop and narrow previews match their frozen full PNG", a
       expect(Math.abs(comparison.exportWidth - comparison.previewWidth * 2)).toBeLessThanOrEqual(2)
       expect(Math.abs(comparison.exportHeight - comparison.previewHeight * 2)).toBeLessThanOrEqual(2)
       expect(comparison.meanChannelDifference).toBeLessThan(28)
+      const brandComparison = await comparePreviewToCapture(page, card, captureIndex, "[data-share-brand]")
+      expect(brandComparison.meanChannelDifference).toBeLessThan(20)
+      const point = await sampleCenter(card, `[data-testid="${tid.messageShareImage(seeded.id, 0)}"]`)
+      expect((await capturePixel(page, "clipboard", captureIndex, point)).pixel[2]).toBeGreaterThan(180)
+      const downloadStarted = page.waitForEvent("download")
+      await dialog.getByRole("button", { name: "Download" }).click()
+      await downloadStarted
+      expect((await capturePixel(page, "download", captureIndex, point)).pixel[2]).toBeGreaterThan(180)
+      expect(await captureDigest(page, "clipboard", captureIndex)).toBe(await captureDigest(page, "download", captureIndex))
       observations.push({
         scheme,
         viewport,
```

---

### Incident Patch 2: `2522723e` (2026-10-05)
**Commit Message**: revert(ci): restore original Codecov download configuration (#871)

Remove only the two Codecov CLI installation inputs added with PR #870. Restore ci.yml to the fa9a configuration while preserving the approved community shell changes and composer-resize test removal.

Normal repository checks, hooks and push passed. Earlier external uploader failures and native/manual acceptance gaps remain separately recorded.

**File**: `.github/workflows/ci.yml` (modified, +0/-2)
```diff
@@ -405,8 +405,6 @@ jobs:
         if: env.RUN_COVERAGE == 'true'
         uses: codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7
         with:
-          use_pypi: true
-          version: v11.3.1
           token: ${{ secrets.CODECOV_TOKEN }}
           files: ./coverage/coverage-final.json
           fail_ci_if_error: true
```

---

### Incident Patch 3: `6d42bf9b` (2026-10-04)
**Commit Message**: fix(web): preserve archived forum access and viewer permissions (#865)

Separate forum-post archive tags from channel access and resolve current-viewer management rights independently of paginated members.

Normal checks, exact-head CI and changed-line coverage 35/35 pass. Browser results retain the original input timeouts separately from subsequent passing attempts. Current-main integration runtime, same-context account switching, restored unknown-role authorization, actual channel archive-bit exit and native QA remain unrun; the owner requested merging the delivered scope with these gaps retained.

**File**: `src/shared/src/db/queries/community/server.ts` (modified, +1/-0)
```diff
@@ -263,6 +263,7 @@ export async function listUserServers(db: Database, userId: string) {
       ownerId: communityServer.ownerId,
       createdAt: communityServer.createdAt,
       role: communityServerMember.role,
+      memberId: communityServerMember.id,
       railOrder: communityServerMember.railOrder,
       // COALESCE has no ORM operator in this Drizzle version — the LEFT JOIN
       // yields NULL for servers with zero unread mentions. Wrap the aggregate
```

**File**: `src/shared/test/queries/community-notification-cursor-clear.test.ts` (modified, +11/-2)
```diff
@@ -109,6 +109,7 @@ describe("notification setting read-state isolation contract", () => {
         added_at TEXT NOT NULL
       );
       CREATE TABLE community_server_member (
+        id TEXT PRIMARY KEY,
         server_id TEXT NOT NULL,
         user_id TEXT NOT NULL,
         joined_at TEXT NOT NULL,
@@ -146,8 +147,8 @@ describe("notification setting read-state isolation contract", () => {
         ('child-3', 'child', '2026-01-01T00:00:03Z', 3),
         ('sibling-4', 'sibling', '2026-01-01T00:00:04Z', 4),
         ('dm-5', 'dm', '2026-01-01T00:00:05Z', 5);
-      INSERT INTO community_server_member (server_id, user_id, joined_at)
-      VALUES ('server', 'u', '2025-01-01T00:00:00Z');
+      INSERT INTO community_server_member (id, server_id, user_id, joined_at)
+      VALUES ('membership-u', 'server', 'u', '2025-01-01T00:00:00Z');
       INSERT INTO community_channel_member (channel_id, user_id, relation, added_at)
       VALUES ('dm', 'u', 'access', '2025-01-01T00:00:00Z');
     `);
@@ -175,6 +176,14 @@ describe("notification setting read-state isolation contract", () => {
     ORDER BY channel_id
   `).all();
 
+  it("returns the viewer's membership identity and current role without another member's role", async () => {
+    sqlite.prepare("UPDATE community_server_member SET role = 'admin' WHERE user_id = 'u'").run();
+    sqlite.prepare("INSERT INTO community_server_member (id, server_id, user_id, joined_at, role) VALUES ('membership-peer', 'server', 'peer', '2025-01-01T00:00:00Z', 'owner')").run();
+    const servers = await listUserServers(db, "u");
+    expect(servers).toHaveLength(1);
+    expect(servers[0]).toMatchObject({ id: "server", memberId: "membership-u", role: "admin" });
+  });
+
   it("sets a server policy without manufacturing or advancing channel cursors", async () => {
     sqlite.exec(`
       INSERT INTO community_read_state
```

**File**: `src/web/src/components/community/members/channel-member-view-model.dom.test.ts` (modified, +15/-0)
```diff
@@ -8,6 +8,7 @@ import { useAddableMembers, useChannelMembers } from "@/hooks/community/use-chan
 
 const mocks = vi.hoisted(() => ({
   serverMembers: [] as Array<Record<string, unknown>>,
+  viewerRole: "admin" as "owner" | "admin" | "member" | undefined,
   serverMemberArgs: [] as Array<string | null>,
   channelMembers: new Map<string, Array<Record<string, unknown>>>(),
   channelQueryState: new Map<string, {
@@ -53,6 +54,9 @@ vi.mock("@/hooks/community/use-server-members", () => ({
     }
   },
 }))
+vi.mock("@/hooks/community/use-servers", () => ({
+  useViewerServerRole: (serverId: string | null) => serverId ? mocks.viewerRole : undefined,
+}))
 vi.mock("@/hooks/community/use-channel-members", () => ({
   useChannelMembers: vi.fn((channelId: string, enabled = true) => {
     const members = mocks.channelMembers.get(channelId) ?? []
@@ -189,6 +193,7 @@ function latestModel(): ReturnType<typeof useChannelMemberViewModel> {
 
 describe("useChannelMemberViewModel", () => {
   beforeEach(() => {
+    mocks.viewerRole = "admin"
     mocks.serverMembers = [
       member("viewer_1", "Viewer", { role: "admin" }),
       member("alice_1", "Alice"),
@@ -263,6 +268,16 @@ describe("useChannelMemberViewModel", () => {
     vi.clearAllMocks()
   })
 
+  it("reads the qualified own role even when the member window excludes the viewer", () => {
+    mocks.serverMembers = [member("alice_1", "Alice")]
+    const renderer = rtlRender(renderHarness(props()))
+    expect(latestModel().myRole).toBe("admin")
+    mocks.viewerRole = undefined
+    renderer.rerender(renderHarness(props()))
+    expect(latestModel().myRole).toBeUndefined()
+    renderer.unmount()
+  })
+
   it("uses the public server roster, excludes self, and keeps the raw-roster resolver stable across presence ticks", () => {
     mocks.serverMembers = [
       member("viewer_1", "Viewer", { role: "admin" }),
```

**File**: `src/web/src/components/community/members/channel-member-view-model.tsx` (modified, +2/-1)
```diff
@@ -19,6 +19,7 @@ import {
   useRemoveChannelMember,
 } from "@/hooks/community/use-channel-members"
 import { useServerMembers } from "@/hooks/community/use-server-members"
+import { useViewerServerRole } from "@/hooks/community/use-servers"
 import { useCommunityViewSource } from "@/hooks/community/use-community-view-source"
 import {
   useAddThreadParticipant,
@@ -96,6 +97,7 @@ export function useChannelMemberViewModel({
   myRole: Role | undefined
 } {
   const membersHook = useServerMembers(accessAllowed && currentServer ? serverId : null)
+  const myRole = useViewerServerRole(accessAllowed && currentServer ? serverId : null, currentUser.id)
   const source = useCommunityViewSource(`channel-members:${serverId}:${channelId}`, accessAllowed)
   const originalView = useCallback((caller?: MemberOriginalView) => {
     const local = source.capture()
@@ -312,7 +314,6 @@ export function useChannelMemberViewModel({
     ],
   )
 
-  const myRole = members.find((member) => member.userId === currentUser.id)?.role
   const unitCreatorId = isChildChannel
     ? currentChannelMeta?.creatorId
     : channelInServer?.creatorId
```

**File**: `src/web/src/hooks/community/use-channel-metadata.dom.test.ts` (modified, +20/-0)
```diff
@@ -319,3 +319,23 @@ describe("DM history permission stays separate from metadata identity", () => {
     route.unmount()
   })
 })
+
+
+describe("restored forum archive ambiguity", () => {
+  it("waits for current metadata instead of treating a persisted opener tag as channel denial", async () => {
+    const client = new QueryClient()
+    const post = { ...metadata, id: "post-1", serverId: "server-1", type: "thread", name: "Post", parentChannelId: "forum-1", parentMessageId: "opener-1" }
+    client.setQueryData(communityKeys.communityDbCollection("viewer", "channels"), [{ ...post, archived: true, tags: ["archived"], position: 0, muted: false, unread: false, pending: false }])
+    const { registry, wrapper } = await fixture(client)
+    const held = deferred<typeof post>()
+    apiFetch.mockReturnValue(held.promise)
+    const route = renderHook(() => useChannelMetadata("server-1", post.id), { wrapper })
+    expect(route.result.current.data?.archived).toBe(true)
+    expect(route.result.current.isArchived).toBe(false)
+    expect(route.result.current.isVerified).toBe(false)
+    await act(async () => held.resolve(post))
+    await waitFor(() => expect(route.result.current.isVerified).toBe(true))
+    expect(registry.collections.channels.get(post.id)).toMatchObject({ archived: false, tags: ["archived"] })
+    route.unmount()
+  })
+})
```

**File**: `src/web/src/hooks/community/use-channel-metadata.ts` (modified, +5/-3)
```diff
@@ -37,10 +37,12 @@ export function useChannelMetadata(serverId: string | null, channelId: string |
   }, [accessEpoch, accountEpoch, viewerId, generation, channelId, revoked, query.data, queryClient, serverId])
   const denied = typeof query.error === "object" && query.error !== null && "status" in query.error
     && (query.error.status === 403 || query.error.status === 404)
-  const isVerified = !!query.data && query.data.id === channelId
+  const hasCurrentVerification = !!query.data && query.data.id === channelId
     && canonical?.serverId === serverId && query.data.verifiedEpoch === accessEpoch
     && !!query.data.verification && isChannelMetadataTokenCurrent(query.data.verification)
-    && !revoked && !denied && !canonical?.archived && !canonical?.pending
+    && !revoked && !denied && !canonical?.pending
+  const isArchived = hasCurrentVerification && !!canonical?.archived
+  const isVerified = hasCurrentVerification && !canonical?.archived
   const data = useMemo(() => canonical && canonical.id === channelId && canonical.serverId === serverId
     ? { ...canonical,
         serverId,
@@ -54,5 +56,5 @@ export function useChannelMetadata(serverId: string | null, channelId: string |
         creatorId: canonical.creatorId ?? null,
         lastMessageAt: canonical.lastMessageAt ?? null }
     : undefined, [canonical, channelId, query.data, serverId])
-  return { ...query, data, isVerified, denied, canonical }
+  return { ...query, data, isVerified, isArchived, denied, canonical }
 }
```

**File**: `src/web/src/hooks/community/use-channel-route-model.retry.dom.test.ts` (modified, +22/-0)
```diff
@@ -214,6 +214,26 @@ describe("unresolved metadata terminal error and retry", () => {
     if (status !== 401) expect(mocks.replace).toHaveBeenCalledWith("/c/channels/server-1")
   })
 
+  it("keeps a legacy tag-derived archive bit pending without purging or revoking access", async () => {
+    const owner = getCommunityDbRegistry(client)!
+    owner.collections.channels.utils.writeUpsert([{ ...payload(), type: "thread", archived: true, tags: ["archived"], position: 0, muted: false, unread: false, pending: false }])
+    owner.collections.messages.utils.writeUpsert([{ id: "reply-1", channelId: "post-1", type: "chat", content: "kept" }])
+    const held = deferred()
+    mocks.apiFetch.mockReturnValue(held.promise)
+    await mount()
+    await until(() => mocks.apiFetch.mock.calls.length > 0)
+    expect(current.routeLifecycle).toBe("pending")
+    expect(mocks.replace).not.toHaveBeenCalled()
+    expect(owner.runtime.ws.actions.isChannelAccessRevoked("post-1", "server-1")).toBe(false)
+    expect(owner.collections.messages.get("reply-1")?.content).toBe("kept")
+    await act(async () => held.resolve(payload()))
+    await until(() => current.routeHydrated)
+    expect(owner.collections.channels.get("post-1")?.archived).toBe(false)
+    expect(owner.collections.channels.get("post-1")?.tags).toEqual(["archived"])
+    expect(mocks.replace).not.toHaveBeenCalled()
+    expect(owner.collections.messages.get("reply-1")?.content).toBe("kept")
+  })
+
   it("does not retain a trusted route after an archived metadata response", async () => {
     mocks.apiFetch.mockResolvedValue(payload())
     await mount()
@@ -222,6 +242,8 @@ describe("unresolved metadata terminal error and retry", () => {
     await act(async () => { await reconcileCommunityWsReconnect(client, 60_000) })
     await until(() => !current.routeHydrated)
     expect(current.routeLifecycle).not.toBe("ready")
+    expect(mocks.replace).toHaveBeenCalledOnce()
+    expect(getCommunityDbRegistry(client)!.runtime.ws.actions.isChannelAccessRevoked("post-1", "server-1")).toBe(true)
   })
 
   it("requires fresh metadata after reauthorization and can exit again on a later denial", async () => {
```

**File**: `src/web/src/hooks/community/use-channel-route-model.subscription.dom.test.ts` (modified, +9/-9)
```diff
@@ -17,7 +17,7 @@ const mocks = vi.hoisted(() => ({
   metaQuery: {
     data: undefined as undefined | Record<string, unknown>,
     error: null as unknown,
-    isVerified: false,
+    isVerified: false, isArchived: false,
     isError: false,
   },
   dbChannel: undefined as undefined | Record<string, unknown>,
@@ -96,7 +96,7 @@ beforeEach(async () => {
       channels: [{ id: "forum-1", name: "Forum", type: "forum" }],
     }],
   }
-  mocks.metaQuery = { data: undefined, error: null, isVerified: false, isError: false }
+  mocks.metaQuery = { data: undefined, error: null, isVerified: false, isArchived: false, isError: false }
   mocks.dbChannel = undefined
 })
 
@@ -178,7 +178,7 @@ describe("useChannelRouteModel subscription ownership", () => {
     expect(renderer.container.querySelector("span")).toHaveAttribute("data-lifecycle", "pending")
     expect(renderer.container.querySelector("span")).toHaveAttribute("data-parent-channel", "")
     mocks.metaQuery = { data: { ...mocks.dbChannel, creatorId: null, lastMessageAt: null, createdAt: "", archived: false },
-      error: null, isVerified: true, isError: false }
+      error: null, isVerified: true, isArchived: false, isError: false }
     act(() => renderer.rerender(React.createElement(Harness)))
     expect(renderer.container.querySelector("span")).toHaveAttribute("data-lifecycle", "ready")
     expect(renderer.container.querySelector("span")).toHaveAttribute("data-creator-id", "")
@@ -231,7 +231,7 @@ describe("useChannelRouteModel subscription ownership", () => {
         verifiedEpoch: 0,
       },
       error: null,
-      isVerified: true,
+      isVerified: true, isArchived: false,
       isError: false,
     }
     act(() => {
@@ -260,7 +260,7 @@ describe("useChannelRouteModel subscription ownership", () => {
       activityAt: "2026-08-09T00:00:00.000Z",
       verifiedEpoch: 0,
     }
-    mocks.metaQuery = { data: meta, error: null, isVerified: true, isError: false }
+    mocks.metaQuery = { data: meta, error: null, isVerified: true, isArchived: false, isError: false }
     const storeListener = vi.fn()
     const subscription = getCommunityRuntime(queryClient).ui.subscribe(storeListener)
     const renderer = render(React.createElement(Harness))
@@ -269,7 +269,7 @@ describe("useChannelRouteModel subscription ownership", () => {
     mocks.metaQuery = {
       data: { ...meta },
       error: null,
-      isVerified: true,
+      isVerified: true, isArchived: false,
       isError: false,
     }
     act(() => renderer.rerender(React.createElement(Harness)))
@@ -283,7 +283,7 @@ describe("useChannelRouteModel subscription ownership", () => {
     mocks.metaQuery = {
       data: undefined,
       error: new Error("metadata unavailable"),
-      isVerified: false,
+      isVerified: false, isArchived: false,
       isError: true,
     }
     let renderer: ReturnType<typeof render>
@@ -310,7 +310,7 @@ describe("useChannelRouteModel subscription ownership", () => {
         verifiedEpoch: 0,
       },
       error: null,
-      isVerified: true,
+      isVerified: false, isArchived: true,
       isError: false,
     }
     let renderer: ReturnType<typeof render>
@@ -345,7 +345,7 @@ describe("useChannelRouteModel subscription ownership", () => {
         verifiedEpoch: 0,
       },
       error: null,
-      isVerified: true,
+      isVerified: false, isArchived: true,
       isError: false,
     }
 
```

---

### Incident Patch 4: `e83180fc` (2026-10-04)
**Commit Message**: fix(web): bound message loading and use native scroll geometry (#864)

Merge the frozen fb560f47 revision after the owner explicitly accepted known browser failures.

Normal checks and exact-head CI pass. Owner original 3: 2 passed, 1 failed (rapid-grow-two tail distance 142px against 1px). Independent regression stopped at owner request; recorded failures remain retained. Browser acceptance, integration with #865, account/access edge cases, native QA and complete Hosted artifact review remain incomplete.

**File**: `src/web/src/app/c/me/[dmId]/page.dismissal.dom.test.ts` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ const {
 vi.mock("next/navigation", () => ({
   useParams: () => ({ dmId: "dm_1" }),
   useSearchParams: () => new URLSearchParams(),
+  usePathname: () => "/c/me/dm_1",
+  useRouter: () => ({ replace: vi.fn() }),
 }))
 vi.mock("sonner", () => ({ toast: vi.fn() }))
 vi.mock("@/hooks/use-mobile", () => ({ useBreakpoint: () => "desktop" }))
```

**File**: `src/web/src/components/community/channels/channel-route.text-scroll-target.dom.test.ts` (modified, +76/-3)
```diff
@@ -7,6 +7,7 @@ import { ForumChannelSurface } from "./forum-channel-surface"
 import { MessageList } from "../messages/message-list"
 import { useChannelMemberViewModel } from "../members/channel-member-view-model"
 import { useChannelMessageFeed } from "@/hooks/community/use-channel-message-feed"
+import type { ConversationNavigationTarget } from "@/lib/community/conversation-navigation-proof"
 
 const {
   mockRouteModel,
@@ -17,6 +18,7 @@ const {
   mockHeaderServerNavigate,
   mockHeaderParentNavigate,
   mockOpenerGate,
+  mockForumOpener,
   mockSearchParams,
   mockSplitMode,
   mockSplitParentSurface,
@@ -34,13 +36,14 @@ const {
   mockHeaderServerNavigate: { current: undefined as undefined | (() => void) },
   mockHeaderParentNavigate: { current: undefined as undefined | (() => void) },
   mockOpenerGate: vi.fn(() => null),
+  mockForumOpener: { data: null as null | { content: string }, isLoading: false, isError: false, error: null as Error | null, isFetching: false, refetch: vi.fn(() => Promise.resolve()) },
   mockSearchParams: { value: "msg=m_target&keep=1" },
   mockSplitMode: { value: "full" as "split" | "full" },
   mockSplitParentSurface: vi.fn(() => null),
   mockCommitLastCommunityRoute: vi.fn(),
   mockSetLastChannel: vi.fn(),
   mockClearLastChannel: vi.fn(),
-  mockNavigationGate: { allowed: true },
+  mockNavigationGate: { allowed: true, target: null as ConversationNavigationTarget | null },
   mockCurrentChannelId: { value: "channel_1" as string | null },
   mockCanManageServer: vi.fn((role?: string | null) => role === "owner" || role === "admin"),
   mockDismissConversation: vi.fn(),
@@ -64,6 +67,9 @@ const {
     isChild: false,
     isForumPostChild: false,
     isNotifyUnit: false,
+    serverError: false,
+    retryingServer: false,
+    retryServer: vi.fn(),
     metadataError: false,
     retryingMetadata: false,
     retryMetadata: vi.fn(),
@@ -91,7 +97,7 @@ vi.mock("next/navigation", () => ({
   useSearchParams: () => new URLSearchParams(mockSearchParams.value),
 }))
 vi.mock("@/lib/community/conversation-navigation-proof", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/community/conversation-navigation-proof")>(),
-  useConversationNavigationGate: () => ({ required: false, allowed: mockNavigationGate.allowed }),
+  useConversationNavigationGate: () => ({ required: false, allowed: mockNavigationGate.allowed, target: mockNavigationGate.target }),
 }))
 vi.mock("sonner", () => ({ toast: vi.fn() }))
 vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), toastApiError: vi.fn() }))
@@ -230,7 +236,7 @@ vi.mock("@/components/community/channels/thread-split-view", () => ({
   ),
 }))
 vi.mock("@/hooks/community/use-forum-opener-hint", () => ({
-  useForumOpenerHint: () => ({ data: null, isLoading: false }),
+  useForumOpenerHint: () => mockForumOpener,
 }))
 vi.mock("@/hooks/community/use-server-members", () => ({
   useServerMembers: () => ({
@@ -349,6 +355,8 @@ describe("ChannelRoute message surface ownership", () => {
     vi.useFakeTimers()
     mockedMessageList.mockClear()
     mockOpenerGate.mockClear()
+    Object.assign(mockForumOpener, { data: null, isLoading: false, isError: false, error: null, isFetching: false })
+    mockForumOpener.refetch.mockClear()
     mockSearchParams.value = "msg=m_target&keep=1"
     mockSplitMode.value = "full"
     mockSplitParentSurface.mockClear()
@@ -360,6 +368,7 @@ describe("ChannelRoute message surface ownership", () => {
     mockClearLastChannel.mockClear()
     mockDismissConversation.mockClear()
     mockNavigationGate.allowed = true
+    mockNavigationGate.target = null
     mockCurrentChannelId.value = "channel_1"
     mockMemberViewModel.myRole = "member"
     Object.assign(mockRouteModel, {
@@ -376,6 +385,8 @@ describe("ChannelRoute message surface ownership", () => {
       isChild: false,
       isForumPostChild: false,
       isNotifyUnit: false,
+      serverError: false,
+      retryingServer: false,
       metadataError: false,
       retryingMetadata: false,
       routeHydrated: true,
@@ -496,6 +507,39 @@ describe("ChannelRoute message surface ownership", () => {
     expect(mockCommitLastCommunityRoute).not.toHaveBeenCalled()
   })
 
+  it("shows a required cold forum opener failure, keeps Retry feedback while pending, then opens body", async () => {
+    configureThreadRoute()
+    mockRouteModel.isForumPostChild = true
+    Object.assign(mockForumOpener, { isError: true, error: new Error("deadline") })
+    let release!: () => void
+    mockForumOpener.refetch.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve }))
+    const props = { serverParam: "server_1", channelId: "channel_1" }
+    const renderer = render(React.createElement(ChannelRoute, props))
+    expect(screen.getByRole("button", { name: "Retry" })).not.toBeDisabled()
+    expect(mockedUseChannelMessageFeed).not.toHaveBeenCalled()
+    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
+ 
```

**File**: `src/web/src/components/community/channels/channel-route.tsx` (modified, +42/-14)
```diff
@@ -3,7 +3,7 @@ import { useAtom, useCreateAtom } from "@tanstack/react-store";
 import { getCommunityRuntime } from "@/stores/community/runtime"
 
 
-import { useCallback, useEffect, useLayoutEffect, useMemo } from "react"
+import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
 import { useRouter, useSearchParams } from "next/navigation"
 import { toastApiError } from "@/lib/api/client"
 import { ChannelHeaderSkeleton, type ChannelNotifLevel } from "@/components/community/channels/channel-header"
@@ -40,6 +40,7 @@ import { useQueryClient } from "@tanstack/react-query"
 import { useCommunityWsStore } from "@/stores/community/ws"
 import { useConversationNavigationGate } from "@/lib/community/conversation-navigation-proof"
 import { resolveConversationSubtype } from "@/lib/community/conversation-subtype"
+import { isConversationAccessError } from "@/lib/community/conversation-read"
 import { useNativeSystemNotificationConversationDismissal } from "@/hooks/community/use-native-system-notifications"
 
 const THREAD_VIEW_PARAM = "threadView"
@@ -59,12 +60,7 @@ export function ChannelRoute({ serverParam, channelId }: {
   const searchParams = useSearchParams()
   const serverId = decodeURIComponent(serverParam)
   const currentUser = useCurrentUser()
-  // Cross-channel "jump to message" target, captured ONCE at mount from `?msg=`.
-  // `ChannelView` is keyed by `serverId/channelId`, so a fresh jump remounts and
-  // re-reads this. The param is stripped from the URL right after (below) so a
-  // refresh/back doesn't re-trigger the jump; this frozen copy still drives the
-  // anchor + scroll for this mount.
-const [jumpTargetId] = useAtom(useCreateAtom<string | null>((() => searchParams.get("msg"))()))
+  const [jumpTargetId, setJumpTargetId] = useAtom(useCreateAtom<string | null>((() => searchParams.get("msg"))()))
   const queryClient = useQueryClient()
   const accessEpoch = useCommunityWsStore((state) => state.accessEpoch)
   const navigationGate = useConversationNavigationGate(
@@ -73,6 +69,12 @@ const [jumpTargetId] = useAtom(useCreateAtom<string | null>((() => searchParams.
     channelId,
     accessEpoch,
   )
+  const navigationTarget = navigationGate.target
+  const currentAnchorMessageId = navigationTarget
+    ? navigationTarget.anchorMessageId ?? null : jumpTargetId
+  useLayoutEffect(() => {
+    if (navigationTarget) setJumpTargetId(navigationTarget.anchorMessageId ?? null)
+  }, [navigationTarget, setJumpTargetId])
   const uiHandlers = useUiHandlers()
   const currentChannelId = useCurrentChannelId()
   const routeModel = useChannelRouteModel(serverId, serverParam, channelId, currentUser.id)
@@ -108,6 +110,24 @@ const [topLevelRouteOwnership, setTopLevelRouteOwnership] = useAtom(useCreateAto
     currentChannelMeta?.parentMessageId,
     isForumPostChild && routeModel.routeHydrated && navigationGate.allowed,
   )
+  const { isFetching: fetchingOpener, refetch: refetchOpener } = forumPostOpener
+  const openerScope = JSON.stringify([currentUser.id, serverId, channelId, currentChannelMeta?.parentMessageId, accessEpoch])
+  const [openerRetryAttempt, setOpenerRetryAttempt] = useAtom(useCreateAtom<{ scope: string } | null>(null))
+  const openerRetryRef = useRef<{ scope: string } | null>(null)
+  const retryingOpener = openerRetryAttempt?.scope === openerScope
+  const openerError = isForumPostChild && (isConversationAccessError(forumPostOpener.error)
+    || (!forumPostOpener.data && (forumPostOpener.isError || retryingOpener)))
+  const retryOpener = useCallback(async () => {
+    if (!openerError || fetchingOpener || openerRetryRef.current?.scope === openerScope) return
+    const attempt = { scope: openerScope }
+    openerRetryRef.current = attempt
+    setOpenerRetryAttempt(attempt)
+    try { await refetchOpener({ cancelRefetch: false }) }
+    finally {
+      if (openerRetryRef.current === attempt) openerRetryRef.current = null
+      setOpenerRetryAttempt((current) => current === attempt ? null : current)
+    }
+  }, [fetchingOpener, refetchOpener, openerError, openerScope, setOpenerRetryAttempt])
   const threadOpenerHandoff = useThreadOpenerRouteGate({
     serverId,
     childChannelId: channelId,
@@ -185,11 +205,8 @@ const [topLevelRouteOwnership, setTopLevelRouteOwnership] = useAtom(useCreateAto
     })
   }, [channelId, setChannelNotif])
 
-  // Strip `?msg=` from the URL right after mount so a refresh/back doesn't
-  // re-trigger the jump. The frozen `jumpTargetId` still seeds the mounted
-  // message controller for this mount; this only cleans the address.
   useEffect(() => {
-    if (!jumpTargetId || searchParams.has(THREAD_OPENER_HANDOFF_PARAM)) return
+    if (!jumpTargetId || !searchParams.has("msg") || searchParams.has(THREAD_OPENER_HANDOFF_PARAM)) return
     const search = searchParams.toString()
     const routePath = channelHref(serverParam, channelId)
     const href = `${routePath}${search ? `?${search}` : ""}`
@@ -219,7 +236,7 @@ const
```

**File**: `src/web/src/components/community/channels/dm-view.tsx` (modified, +22/-12)
```diff
@@ -3,7 +3,6 @@
 import { useCallback, useEffect, useMemo, useState } from "react"
 import { useAtom, useCreateAtom } from "@tanstack/react-store"
 import { useCommunityRuntime } from "@/stores/community/runtime"
-import { useSearchParams } from "next/navigation"
 import { toast } from "sonner"
 import { useBreakpoint } from "@/hooks/use-mobile"
 import { DmHeader } from "@/components/community/channels/dm-header"
@@ -63,9 +62,14 @@ import {
 } from "@/lib/community-db/projections"
 import { useNativeSystemNotificationConversationDismissal } from "@/hooks/community/use-native-system-notifications"
 import { commitCommunityChannelRoute } from "@/lib/community/last-community-route"
+import { useQueryClient } from "@tanstack/react-query"
+import { useConversationNavigationGate } from "@/lib/community/conversation-navigation-proof"
+import { useCommunityWsStore } from "@/stores/community/ws"
 import { useChannelMetadata } from "@/hooks/community/use-channel-metadata"
 import { isChannelMetadataTokenCurrent } from "@/hooks/community/channel-metadata"
 import { ConversationResolutionErrorFrame } from "./conversation-resolution-error-frame"
+import { isConversationAccessError } from "@/lib/community/conversation-read"
+import { useDmSeqContext } from "./use-dm-seq-context"
 
 function resolveDmLoadingOwnership({
   hasDm,
@@ -87,6 +91,9 @@ export function DmView({ dmId }: { dmId: string }) {
   const communityRuntime = useCommunityRuntime()
   const bp = useBreakpoint()
   const currentUser = useCurrentUser()
+  const queryClient = useQueryClient()
+  const accessEpoch = useCommunityWsStore((state) => state.accessEpoch)
+  const navigationGate = useConversationNavigationGate(queryClient, currentUser.id, dmId, accessEpoch)
   const metadata = useChannelMetadata(null, dmId)
   const uiHandlers = useUiHandlers()
   const notifications = useNotificationSettings()
@@ -152,6 +159,8 @@ export function DmView({ dmId }: { dmId: string }) {
     latestSeq,
     isPending: messagesPending,
     isError: messagesError,
+    error: messagesLoadError,
+    isFetching: messagesFetching,
     refetch: refetchMessages,
     navigationBlocked,
     anchorReconciled,
@@ -169,19 +178,14 @@ export function DmView({ dmId }: { dmId: string }) {
     viewerUserId: currentUser.id,
   })
   const messages = useMemo(() => historyAllowed ? fetchedMessages : [], [fetchedMessages, historyAllowed])
+  const initialLoadError = isConversationAccessError(messagesLoadError)
+    ? messagesLoadError : readError ?? messagesLoadError
 
-  // Cross-navigation deep-link: a Marked-tab row for a DM message navigates
-  // here with `?seq=<n>` and we open the context sheet on that message. Read
-  // once at mount (frozen), mirroring the channel page's `?msg=` — a
-  // refresh/back doesn't re-trigger it. The DM view has no in-place scroll
-  // anchor, so the context sheet (seq → id + surrounding window) is the jump.
-  const searchParams = useSearchParams()
-  const [initialSeq] = useState<number | null>(() => {
-    const raw = searchParams.get("seq")
-    const n = raw ? Number(raw) : NaN
-    return Number.isFinite(n) ? n : null
+  const [contextSheetSeq, setContextSheetSeq] = useAtom(useCreateAtom<number | null>(null))
+  useDmSeqContext({ dmId, historyAllowed,
+    navigationAllowed: navigationGate.allowed && !navigationBlocked,
+    setContextSeq: setContextSheetSeq,
   })
-  const [contextSheetSeq, setContextSheetSeq] = useAtom(useCreateAtom<number | null>(initialSeq))
   // DM composer has no "current server" — flatten every member server's
   // channels into one cross-server candidate list so a `/`-ref can be
   // dropped into a DM (see plan community-channel-ref.md §6).
@@ -429,6 +433,9 @@ export function DmView({ dmId }: { dmId: string }) {
     channelId: dmId,
   }, routeReady)
 
+  if (navigationGate.failed) {
+    return <ConversationResolutionErrorFrame retrying={false} onRetry={navigationGate.retry} />
+  }
   if (navigationBlocked) {
     return <DmLoadingFrame reserveBackSlot={bp === "mobile"} />
   }
@@ -464,6 +471,9 @@ export function DmView({ dmId }: { dmId: string }) {
             channel={dm.name}
             messages={messages}
             loading={!historyAllowed || loadingOwnership.messageBodyLoading}
+            initialLoadError={initialLoadError}
+            retryingInitialLoad={retryingRead || messagesFetching}
+            onRetryInitialLoad={() => { if (initialLoadError && initialLoadError === messagesLoadError) void refetchMessages({ cancelRefetch: false }); else retryRead() }}
             newDividerBefore={newDividerBefore}
             onOpenThread={() => { }}
             onToggleReaction={dmBlocked ? undefined : messageActions.onToggleReaction}
```

**File**: `src/web/src/components/community/channels/forum-surface.dom.test.ts` (modified, +56/-6)
```diff
@@ -1,11 +1,13 @@
 import React from "react"
 import { beforeEach, describe, expect, it, vi } from "vitest"
-import { act, render } from "@/test/react-dom-harness"
+import { act, fireEvent, render, screen } from "@/test/react-dom-harness"
+import { ApiError } from "@/lib/errors"
 import { ForumView } from "./forum-view"
 import { ForumSurface } from "./forum-surface"
 
 const mocks = vi.hoisted(() => ({
   observe: vi.fn(),
+  read: { snapshot: { lastReadMessageId: "opener-old", lastReadAt: "t", lastReadSeq: 2 }, isFetching: false, error: null as Error | null, retrying: false, retry: vi.fn(() => Promise.resolve()) },
   feed: {
     posts: [
       {
@@ -39,6 +41,8 @@ const mocks = vi.hoisted(() => ({
         participantCount: 0,
       },
     ],
+    error: null as Error | null,
+    isFetching: false,
     isLoading: false,
     isPending: false,
     isError: false,
@@ -52,14 +56,13 @@ const mocks = vi.hoisted(() => ({
   },
 }))
 
+vi.mock("@tanstack/react-query", async (load) => ({ ...await load<typeof import("@tanstack/react-query")>(), useQueryClient: () => ({ refetchQueries: mocks.read.retry }) }))
+
 vi.mock("@/hooks/community/use-forum-feed", () => ({
   useForumFeed: () => mocks.feed,
 }))
 vi.mock("@/hooks/community/use-channel-read-state", () => ({
-  useChannelReadStateSnapshot: () => ({
-    snapshot: { lastReadMessageId: "opener-old", lastReadAt: "t", lastReadSeq: 2 },
-    isFetching: false,
-  }),
+  useChannelReadStateSnapshot: () => mocks.read,
 }))
 vi.mock("@/hooks/community/use-read-observer", () => ({
   useTimelineReadObserver: (value: unknown) => mocks.observe(value),
@@ -69,7 +72,54 @@ vi.mock("./forum-view", () => ({
 }))
 
 describe("ForumSurface generic read-row adapter", () => {
-  beforeEach(() => vi.clearAllMocks())
+  it("keeps cold failure Retry visible through a deduplicated retry and recovers to the list", async () => {
+    Object.assign(mocks.feed, { posts: [], isError: true, error: new Error("deadline") })
+    let release!: () => void
+    mocks.feed.refetch.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve }))
+    const props = { serverId: "server-1", forumChannelId: "forum-1", members: [], onOpenPost: vi.fn() }
+    const rendered = render(React.createElement(ForumSurface, props))
+    expect(screen.getByRole("alert")).toBeDefined()
+    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
+    expect(mocks.feed.refetch).toHaveBeenCalledOnce()
+    expect(mocks.read.retry).toHaveBeenCalledOnce()
+    Object.assign(mocks.feed, { isError: false, error: null, isFetching: true })
+    rendered.rerender(React.createElement(ForumSurface, props))
+    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled()
+    fireEvent.click(screen.getByRole("button", { name: "Retrying…" }))
+    expect(mocks.feed.refetch).toHaveBeenCalledOnce()
+    await act(async () => { release() })
+    Object.assign(mocks.feed, { posts: mocks.feed.posts.concat(posts), isFetching: false })
+    rendered.rerender(React.createElement(ForumSurface, props))
+    expect(screen.queryByRole("alert")).toBeNull()
+    expect(ForumView).toHaveBeenLastCalledWith(expect.objectContaining({ posts }), undefined)
+    rendered.unmount()
+  })
+
+  it("retains readable posts during transient feed and read failures", () => {
+    Object.assign(mocks.feed, { isError: true, error: new Error("offline") })
+    mocks.read.error = new Error("offline")
+    const rendered = render(React.createElement(ForumSurface, { serverId: "server-1", forumChannelId: "forum-1", members: [], onOpenPost: vi.fn() }))
+    expect(screen.queryByRole("alert")).toBeNull()
+    expect(ForumView).toHaveBeenCalled()
+    rendered.unmount()
+  })
+
+  it.each(["feed", "read"])("suppresses cached posts and watermark after %s access denial", (source) => {
+    if (source === "feed") Object.assign(mocks.feed, { isError: true, error: new ApiError("denied", 403) })
+    else mocks.read.error = new ApiError("denied", 403)
+    const rendered = render(React.createElement(ForumSurface, { serverId: "server-1", forumChannelId: "forum-1", members: [], onOpenPost: vi.fn() }))
+    expect(screen.getByRole("alert")).toBeDefined()
+    expect(ForumView).not.toHaveBeenCalled()
+    expect(mocks.observe).toHaveBeenLastCalledWith(expect.objectContaining(source === "feed" ? { feedStatus: "error" } : { snapshotStatus: "error" }))
+    rendered.unmount()
+  })
+
+  const posts = mocks.feed.posts
+  beforeEach(() => {
+    vi.clearAllMocks()
+    Object.assign(mocks.feed, { posts, error: null, isError: false, isFetching: false, isLoading: false, isPending: false })
+    Object.assign(mocks.read, { error: null, isFetching: false, retrying: false })
+  })
 
   it("projects canonical opener candidates and binds only the list viewport", () => {
     const rendered = render(React.createElement(ForumSurface, {
```

**File**: `src/web/src/components/community/channels/forum-surface.tsx` (modified, +29/-1)
```diff
@@ -1,5 +1,8 @@
 "use client"
 
+import { useQueryClient } from "@tanstack/react-query"
+import { communityKeys } from "@/lib/query-keys"
+import { useRef } from "react"
 import { useAtom, useCreateAtom } from "@tanstack/react-store";
 
 import type { NewForumThread } from "../messages/create-forum-thread"
@@ -10,6 +13,8 @@ import { ForumView } from "./forum-view"
 import { useForumFeed } from "@/hooks/community/use-forum-feed"
 import { useChannelReadStateSnapshot } from "@/hooks/community/use-channel-read-state"
 import { useTimelineReadObserver } from "@/hooks/community/use-read-observer"
+import { isConversationAccessError } from "@/lib/community/conversation-read"
+import { ConversationResolutionErrorFrame } from "./conversation-resolution-error-frame"
 
 export function ForumSurface({ serverId, forumChannelId, ...props }: {
   serverId: string
@@ -25,9 +30,18 @@ export function ForumSurface({ serverId, forumChannelId, ...props }: {
   canDeletePost?: (post: ForumThread) => boolean
   deletingPost?: string | null
 }) {
+  const queryClient = useQueryClient()
   const feed = useForumFeed(serverId, forumChannelId)
   const readState = useChannelReadStateSnapshot(forumChannelId)
   const [scrollRootEl, setScrollRootEl] = useAtom(useCreateAtom<HTMLDivElement | null>(null))
+  const retryScope = JSON.stringify([forumChannelId, feed.tag])
+  const [retryAttempt, setRetryAttempt] = useAtom(useCreateAtom<{ scope: string } | null>(null))
+  const retryRef = useRef<{ scope: string } | null>(null)
+  const retrying = retryAttempt?.scope === retryScope
+  const accessError = isConversationAccessError(feed.error) || isConversationAccessError(readState.error)
+  const initialLoadError = accessError || (feed.posts.length === 0 && (
+    feed.isError || !!readState.error || retrying
+  ))
   useTimelineReadObserver({
     channelId: forumChannelId,
     messages: feed.posts.flatMap((post) => (
@@ -41,7 +55,9 @@ export function ForumSurface({ serverId, forumChannelId, ...props }: {
         : []
     )),
     scrollRootEl,
-    snapshotStatus: readState.isFetching
+    snapshotStatus: isConversationAccessError(readState.error)
+      ? "error"
+      : readState.isFetching
       ? "pending"
       : readState.snapshot
         ? "ready"
@@ -55,6 +71,18 @@ export function ForumSurface({ serverId, forumChannelId, ...props }: {
     confirmedSeq: readState.snapshot?.lastReadSeq ?? 0,
     catchUp: () => feed.refetch(),
   })
+  if (initialLoadError) {
+    return <ConversationResolutionErrorFrame as="div" retrying={retrying || feed.isFetching || readState.retrying} onRetry={() => {
+      if (retrying || retryRef.current?.scope === retryScope || feed.isFetching || readState.retrying) return
+      const attempt = { scope: retryScope }
+      retryRef.current = attempt
+      setRetryAttempt(attempt)
+      void Promise.all([feed.refetch({ cancelRefetch: false }), queryClient.refetchQueries({ queryKey: communityKeys.channelReadStateSnapshot(forumChannelId), exact: true }, { cancelRefetch: false })]).finally(() => {
+        if (retryRef.current === attempt) retryRef.current = null
+        setRetryAttempt((current) => current === attempt ? null : current)
+      })
+    }} />
+  }
   return <ForumView
     forumChannelId={forumChannelId}
     {...props}
```

**File**: `src/web/src/components/community/channels/text-channel-surface.tsx` (modified, +3/-0)
```diff
@@ -140,6 +140,9 @@ export function TextChannelSurface({
                   channel={channelName}
                   messages={feed.messages}
                   loading={feed.isLoading}
+                  initialLoadError={feed.initialLoadError}
+                  retryingInitialLoad={feed.retryingInitialLoad}
+                  onRetryInitialLoad={feed.retryInitialLoad}
                   pinnedIds={controller.pinnedIds}
                   newDividerBefore={feed.newDividerBefore}
                   onOpenThread={onOpenThread}
```

**File**: `src/web/src/components/community/channels/thread-channel-surface.tsx` (modified, +3/-0)
```diff
@@ -248,6 +248,9 @@ export function ThreadChannelSurface({
                   channel={displayName}
                   messages={controller.feed.messages}
                   loading={controller.feed.isLoading}
+                  initialLoadError={controller.feed.initialLoadError}
+                  retryingInitialLoad={controller.feed.retryingInitialLoad}
+                  onRetryInitialLoad={controller.feed.retryInitialLoad}
                   pinnedIds={controller.pinnedIds}
                   newDividerBefore={controller.feed.newDividerBefore}
                   onOpenThread={ignoreNestedThread}
```

---

### Incident Patch 5: `b95bb7a5` (2026-10-04)
**Commit Message**: docs(daemon): record work ownership in agent memory (#866)

**File**: `src/daemon/src/drivers/systemPrompt.ts` (modified, +3/-0)
```diff
@@ -493,6 +493,9 @@ function workspaceMemorySection(config: HostLaunchConfig): string {
     "Read first on every wake. Pointers and facts, one line per entry. Examples: " +
       '"Owner: @alice#0001", "Alook codebase: /Users/alice/alook/"',
     "",
+    "Record the agreed division of work and responsibility boundaries in `memory.md`. " +
+      "Fulfill your own responsibilities.",
+    "",
     "Learn your voice and taste over time. Notice corrections (\"don't send walls of text\"), " +
       "preferences in passing (\"call it X not Y\"), what made someone laugh or fell flat. Write " +
       "these into `memory.md` — its job is to summon the same *you* on every wake, not just facts.",
```

---

### Incident Patch 6: `b938ed55` (2026-10-03)
**Commit Message**: fix(web): keep analytics consent banner floating above page

**File**: `src/web/src/components/analytics-consent.dom.test.tsx` (modified, +35/-0)
```diff
@@ -49,6 +49,41 @@ afterEach(() => {
 })
 
 describe("AnalyticsConsent", () => {
+  it("preserves page layout while the floating banner is open and dismissed", async () => {
+    vi.stubGlobal("fetch", successfulFetch("denied"))
+    const layoutStyle = document.createElement("style")
+    layoutStyle.textContent = `
+      body { padding-bottom: 0px; }
+      .hero-section, .workspace-shell { height: 100dvh; }
+    `
+    document.head.appendChild(layoutStyle)
+    try {
+      render(
+        <>
+          <main className="hero-section" data-testid="consent-hero" />
+          <main className="workspace-shell" data-testid="consent-workspace" />
+          <AnalyticsConsent />
+        </>,
+      )
+      const banner = await screen.findByTestId(tid.analyticsConsentBanner)
+      const expectPageLayout = () => {
+        expect(getComputedStyle(document.body).paddingBottom).toBe("0px")
+        expect(getComputedStyle(screen.getByTestId("consent-hero")).height).toBe("100dvh")
+        expect(getComputedStyle(screen.getByTestId("consent-workspace")).height).toBe("100dvh")
+      }
+      expectPageLayout()
+      fireEvent(window, new Event("resize"))
+      expectPageLayout()
+      fireEvent.click(within(banner).getByRole("button", { name: "Only necessary" }))
+      await waitFor(() => {
+        expect(screen.queryByTestId(tid.analyticsConsentBanner)).not.toBeInTheDocument()
+      })
+      expectPageLayout()
+    } finally {
+      layoutStyle.remove()
+    }
+  })
+
   it("shows a first-visit banner without loading GTM", async () => {
     render(<AnalyticsConsent />)
     const banner = await screen.findByTestId(tid.analyticsConsentBanner)
```

**File**: `src/web/src/components/analytics-consent.tsx` (modified, +0/-34)
```diff
@@ -126,46 +126,12 @@ function ConsentButtons({
 export function AnalyticsConsent() {
   const { ready, decision, nativeMobile } = useStoredAnalyticsConsent(true)
   const { choose, saving, error } = useAnalyticsConsentChoice()
-  const bannerRef = useRef<HTMLElement>(null)
-
-  useEffect(() => {
-    if (!ready || decision !== null || !bannerRef.current) return
-    const root = document.documentElement
-    const banner = bannerRef.current
-    const updateInset = () => {
-      root.style.setProperty(
-        "--analytics-consent-inset",
-        `${Math.ceil(banner.getBoundingClientRect().height) + 32}px`,
-      )
-    }
-    root.dataset.analyticsConsentPending = "true"
-    updateInset()
-    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateInset)
-    observer?.observe(banner)
-    window.addEventListener("resize", updateInset)
-    return () => {
-      observer?.disconnect()
-      window.removeEventListener("resize", updateInset)
-      delete root.dataset.analyticsConsentPending
-      root.style.removeProperty("--analytics-consent-inset")
-    }
-  }, [decision, ready])
 
   return (
     <>
-      <style>{`
-        html[data-analytics-consent-pending="true"] body {
-          padding-bottom: var(--analytics-consent-inset);
-        }
-        html[data-analytics-consent-pending="true"] .hero-section,
-        html[data-analytics-consent-pending="true"] .workspace-shell {
-          height: calc(100dvh - var(--analytics-consent-inset));
-        }
-      `}</style>
       {ready && decision === "granted" ? <GoogleTagManager gtmId={GTM_ID} /> : null}
       {ready && !nativeMobile && decision === null ? (
         <section
-          ref={bannerRef}
           aria-label="Analytics choices"
           className={styles.banner}
           data-testid={tid.analyticsConsentBanner}
```

---

### Incident Patch 7: `af0a3704` (2026-10-02)
**Commit Message**: fix(web): restore mobile profile seam and running ring

Move the mobile profile surface to its content owner and restore the
light, square-bottom seam with the expanded UserBar. Use the dark primary
color for the running ring in both themes while preserving independent
bot scrolling, activity qualification and desktop geometry.

**File**: `src/web/src/app/globals.css` (modified, +1/-0)
```diff
@@ -472,6 +472,7 @@ body.driver-active .community-ws-reconnect-overlay * {
   --popover-foreground: oklch(0.18 0.03 230);
   --primary: oklch(0.22 0.03 230);
   --primary-foreground: oklch(0.985 0.005 80);
+  --running-bots-primary: oklch(0.9 0.008 80);
   --composer-send-active: #34c759;
   --composer-send-active-foreground: #fff;
   --apple-signin: oklch(0 0 0);
```

**File**: `src/web/src/components/community/shell/user-bar-extension-slot.dom.test.tsx` (modified, +3/-10)
```diff
@@ -34,7 +34,7 @@ const machines = [{
 }]
 
 describe("UserBarExtensionSlot", () => {
-  it("keeps the mobile primary card framed and gives only the companion the shrink budget", () => {
+  it("leaves mobile profile styling to the content and gives only the companion the shrink budget", () => {
     const renderer = render(createElement(UserBarExtensionSlot, {
       active: "profile",
       profile: createElement("div", { "data-testid": "profile-content" }, "Profile"),
@@ -49,18 +49,11 @@ describe("UserBarExtensionSlot", () => {
     const slot = renderer.getByTestId(tid.userBarExtension)
     const scroller = renderer.getByTestId("profile-content").parentElement?.parentElement
     expect(slot.style.maxHeight).toContain("100dvh")
-    expect(slot.className).toContain("bg-transparent")
-    expect(slot.className).toContain("shadow-none")
-    expect(slot.className).not.toContain("border-border/40")
-    expect(slot.className).not.toContain("border-x")
-    expect(slot.className).not.toContain("border-t")
+    expect(slot.className).not.toMatch(/bg-|shadow-|border|rounded|overflow-|clip-path|text-popover-foreground/)
     expect(scroller?.className).toContain("min-h-0")
     expect(scroller?.className).not.toContain("overflow-y-auto")
     expect(scroller?.style.maxHeight).toContain("100dvh")
-    expect(renderer.getByTestId("profile-content").parentElement?.className).toContain("shrink-0")
-    expect(renderer.getByTestId("profile-content").parentElement?.className).toContain("bg-popover")
-    expect(renderer.getByTestId("profile-content").parentElement?.className).toContain("rounded-xl")
-    expect(renderer.getByTestId("profile-content").parentElement?.className).not.toContain("shadow-")
+    expect(renderer.getByTestId("profile-content").parentElement?.className).toBe("shrink-0")
     const companionSurface = renderer.getByTestId("profile-companion").parentElement
     expect(companionSurface?.className).toContain("min-h-0")
     expect(companionSurface?.className).toContain("flex-col")
```

**File**: `src/web/src/components/community/shell/user-bar-extension-slot.tsx` (modified, +3/-5)
```diff
@@ -107,10 +107,8 @@ export function UserBarExtensionSlot({
       data-presentation={presentation}
       tabIndex={-1}
       className={cn(
-        "relative min-h-0 origin-bottom overflow-hidden text-popover-foreground",
-        unframedMobileProfile
-          ? "bg-transparent shadow-none [clip-path:inset(-2rem_-2rem_0)]"
-          : "border-border/40 bg-popover shadow-(--e2)",
+        "relative min-h-0 origin-bottom",
+        !unframedMobileProfile && "overflow-hidden border-border/40 bg-popover text-popover-foreground shadow-(--e2)",
         presentation === "popup"
           ? "rounded-xl border"
           : !unframedMobileProfile && "rounded-t-xl border-x border-t [clip-path:inset(-2rem_-2rem_0)]",
@@ -131,7 +129,7 @@ export function UserBarExtensionSlot({
           style={{ maxHeight: boundedHeight }}
         >
           {profileCompanion && <div className="flex min-h-0 flex-col">{profileCompanion}</div>}
-          <div className={cn("shrink-0", unframedMobileProfile && "overflow-hidden rounded-xl border border-border bg-popover p-2")}>{profile}</div>
+          <div className="shrink-0">{profile}</div>
         </div>
       )}
       {active === "update" && update && (
```

**File**: `src/web/src/components/community/shell/user-bar.test.ts` (modified, +7/-3)
```diff
@@ -23,7 +23,11 @@ describe("UserBar", () => {
     expect(running).toContain("pointer-events-none absolute -inset-px")
     expect(running).toContain("focus-visible:ring-offset-4")
     expect(running).toContain("focus-visible:ring-offset-muted")
-    expect(running).toContain("var(--primary)")
+    expect(running).toContain("var(--running-bots-primary)")
+    expect(readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8"))
+      .toContain("--running-bots-primary: oklch(0.9 0.008 80);")
+    expect(running).not.toContain("color-mix")
+    expect(running).not.toContain("var(--primary)")
     expect(running).not.toContain("var(--status-online)")
     expect(idle).toContain('aria-label="Open profile"')
     expect(idle).not.toContain(tid.userBarRunningBotsRing)
@@ -100,7 +104,7 @@ describe("UserBar", () => {
     expect(html).not.toContain("<a")
   })
 
-  it("joins the mobile Inbox to the user bar without seam radii", () => {
+  it("joins the mobile Inbox and Profile to the user bar without seam radii", () => {
     const openHtml = renderToStaticMarkup(createElement(UserBar, {
       breakpoint: "mobile",
       user: { id: "u1", name: "User", avatar: "U" },
@@ -135,7 +139,7 @@ describe("UserBar", () => {
       },
     }))
     expect(profileHtml).toContain(
-      'class="flex h-12 items-center gap-3 border border-border/40 bg-muted px-4 rounded-xl"',
+      'class="flex h-12 items-center gap-3 border border-border/40 bg-muted px-4 rounded-b-xl"',
     )
   })
 
```

**File**: `src/web/src/components/community/shell/user-bar.tsx` (modified, +3/-3)
```diff
@@ -63,7 +63,7 @@ export function UserBar({ breakpoint, user, onOpenProfile, onEditProfile, inbox,
   const mobile = breakpoint === "mobile"
   const joinedMobileExtension = mobile && (
     inboxOpen
-    || Boolean(extension && extension.active !== "none" && extension.active !== "profile")
+    || Boolean(extension && extension.active !== "none")
   )
   const closeInboxForAction = () => {
     if (inboxOpen) onInboxOpenChange?.(false)
@@ -222,12 +222,12 @@ function Inner({ breakpoint, user, onOpenProfile, onEditProfile, inbox, hasUnrea
               <span
                 data-testid={tid.userBarRunningBotsGlow}
                 aria-hidden
-                className="user-bar-running-bots-glow pointer-events-none absolute -inset-1 rounded-full opacity-40 blur-[5px] [background:conic-gradient(from_30deg,var(--link),var(--primary),var(--link))]"
+                className="user-bar-running-bots-glow pointer-events-none absolute -inset-1 rounded-full opacity-40 blur-[5px] [background:conic-gradient(from_30deg,var(--link),var(--running-bots-primary),var(--link))]"
               />
               <span
                 data-testid={tid.userBarRunningBotsRing}
                 aria-hidden
-                className="pointer-events-none absolute -inset-px rounded-full [background:conic-gradient(from_30deg,var(--link),var(--primary),var(--link))]"
+                className="pointer-events-none absolute -inset-px rounded-full [background:conic-gradient(from_30deg,var(--link),var(--running-bots-primary),var(--link))]"
               />
             </>
           )}
```

**File**: `src/web/src/components/community/social/profile-card-surface.dom.test.ts` (modified, +1/-1)
```diff
@@ -144,7 +144,7 @@ describe("ProfileCard surface contracts", () => {
     ))
 
     const profile = renderer.getByTestId("community-profile-card")
-    expect(profile.className).toBe("w-full")
+    expect(profile.className).toBe("w-full overflow-hidden rounded-t-xl border-x border-t border-border/40 bg-popover p-2")
     expect(renderer.container.querySelectorAll("sheet-root")).toHaveLength(0)
     expect(renderer.container.querySelectorAll("popover-root")).toHaveLength(0)
   })
```

**File**: `src/web/src/components/community/social/profile-card.tsx` (modified, +1/-1)
```diff
@@ -350,7 +350,7 @@ function ProfileCardContent({ data, x, y, bp, onClose, onMessage, isSelf, onUpda
   ) : null
 
   if (extension)
-    return <div data-testid={tid.profileCard} className="w-full">{card}</div>
+    return <div data-testid={tid.profileCard} className={mobile ? "w-full overflow-hidden rounded-t-xl border-x border-t border-border/40 bg-popover p-2" : "w-full"}>{card}</div>
 
   if (embedded)
     return (
```

---

### Incident Patch 8: `4efeedfc` (2026-10-02)
**Commit Message**: fix(web): mount DM target main from layout and share Channel metadata (#862)

**File**: `src/web/src/app/c/channels/[serverId]/page.tsx` (modified, +9/-7)
```diff
@@ -5,7 +5,7 @@ import { useParams, useRouter, useSearchParams } from "next/navigation"
 import { ServerLandingPendingFrame } from "@/components/community/shell/server-landing-pending-frame"
 import { useServer } from "@/hooks/community/use-servers"
 import { useBreakpoint } from "@/hooks/use-mobile"
-import { getLastChannel, pickServerLandingChannel } from "@/lib/community/last-channel"
+import { getLastChannel, resolveCommunityLandingHref } from "@/lib/community/last-channel"
 
 export default function ServerDefaultPage() {
   const params = useParams<{ serverId: string }>()
@@ -21,13 +21,15 @@ export default function ServerDefaultPage() {
     const allChannels = currentServer.categories.flatMap((cat) => cat.channels)
     // Restore one remembered channel id, or use the first top-level channel
     // when there is no valid memory.
-    const target = pickServerLandingChannel(
-      allChannels.map((c) => c.id),
-      getLastChannel(serverId),
-    )
-    if (target) {
+    const target = resolveCommunityLandingHref({
+      serverId,
+      channelIds: allChannels.filter((channel) => !channel.pending).map((channel) => channel.id),
+      last: getLastChannel(serverId),
+      breakpoint,
+    })
+    if (target !== `/c/channels/${encodeURIComponent(serverId)}`) {
       const search = searchParams.toString()
-      const href = `/c/channels/${serverId}/${target}${search ? `?${search}` : ""}`
+      const href = `${target}${search ? `?${search}` : ""}`
       if (replacingHrefRef.current === href) return
       replacingHrefRef.current = href
       router.replace(href)
```

**File**: `src/web/src/app/c/layout.dom.test.ts` (modified, +2/-3)
```diff
@@ -120,10 +120,9 @@ describe("CommunityLayout session boundary", () => {
       process.cwd().endsWith("/src/web") ? "" : "src/web",
       "src/app/c/me/layout.tsx",
     ), "utf8")
-    expect(source).toMatch(/isPending:\s*dmsPending/)
+    expect(source).not.toContain("useDmRouteVerification")
+    expect(source).toContain('<DmRoute key={`${currentUser.id}/${params.dmId}`} dmId={params.dmId} />')
     expect(source).not.toMatch(/isFetching:\s*dmsFetching/)
-    expect(source).toContain("const canonicalDmsUnsettled = dmsPending")
-    expect(source).toContain("useDmRouteVerification(params.dmId, dms, canonicalDmsUnsettled)")
   })
 
   it("keeps the daemon update controller inside the authenticated Community query cache", () => {
```

**File**: `src/web/src/app/c/me/[dmId]/page.dismissal.dom.test.ts` (modified, +47/-5)
```diff
@@ -1,15 +1,19 @@
 import React from "react"
 import { render } from "@/test/react-dom-harness"
 import { beforeEach, describe, expect, it, vi } from "vitest"
-import DmPage from "./page"
+import { DmView } from "@/components/community/channels/dm-view"
 
 const {
   mockDismissConversation,
+  mockCommitRoute,
   mockDmMessages,
   mockDms,
   mockStore,
+  mockHistory,
 } = vi.hoisted(() => ({
   mockDismissConversation: vi.fn(),
+  mockCommitRoute: vi.fn(),
+  mockHistory: { allowed: true, error: null as Error | null, retry: vi.fn() },
   mockDms: {
     dms: [] as Array<{
       id: string
@@ -38,12 +42,26 @@ vi.mock("@/components/community/channels/dm-header", () => ({ DmHeader: () => nu
 vi.mock("@/components/community/channels/dm-loading-frame", () => ({
   DmLoadingFrame: () => React.createElement("div", { "data-testid": "dm-loading" }),
 }))
+vi.mock("@/components/community/channels/dm-route-error-frame", () => ({
+  DmRouteErrorFrame: () => React.createElement("div", { "data-testid": "dm-error" }),
+}))
+vi.mock("@/components/community/channels/conversation-resolution-error-frame", () => ({
+  ConversationResolutionErrorFrame: ({ onRetry }: { onRetry: () => void }) => React.createElement("button", { onClick: onRetry, "data-testid": "history-error" }, "Retry"),
+}))
+vi.mock("@/hooks/community/use-channel-metadata", () => ({
+  useChannelMetadata: () => ({ isVerified: true, data: { historyVerification: mockHistory.allowed ? {} : undefined } }),
+}))
+vi.mock("@/hooks/community/channel-metadata", () => ({ isChannelMetadataTokenCurrent: () => true }))
+vi.mock("@/lib/community/last-community-route", () => ({ commitCommunityChannelRoute: mockCommitRoute }))
 vi.mock("@/components/community/avatar", () => ({ Avatar: () => null }))
-vi.mock("@/components/community/messages/message-list", () => ({ MessageList: () => null }))
+vi.mock("@/components/community/messages/message-list", () => ({ MessageList: () => React.createElement("div", { "data-testid": "history-body" }) }))
 vi.mock("@/components/community/messages/message-context-sheet", () => ({
   MessageContextSheet: () => null,
 }))
-vi.mock("@/components/community/messages/composer", () => ({ Composer: () => null }))
+vi.mock("@/components/community/messages/composer", () => ({
+  Composer: () => React.createElement("div", { "data-testid": "composer" }),
+  ComposerSkeleton: () => React.createElement("div", { "data-testid": "composer-pending" }),
+}))
 vi.mock("@/components/community/messages/conversation-footer-shell", () => ({
   ConversationFooterShell: ({ children }: { children: React.ReactNode }) => children,
   ConversationFooterSlotProvider: ({ children }: { children: React.ReactNode }) => children,
@@ -84,7 +102,7 @@ vi.mock("@/hooks/community/use-messages", () => ({
   }),
 }))
 vi.mock("@/hooks/community/use-dm-read-state", () => ({
-  useDmReadStateSnapshot: () => ({ snapshot: null, isFetching: false }),
+  useDmReadStateSnapshot: () => ({ snapshot: null, isFetching: false, error: mockHistory.error, retry: mockHistory.retry, retrying: false }),
 }))
 vi.mock("@/lib/community/message-read-projection", () => ({
   resolveMessageReadProjection: () => ({ newDividerBefore: undefined, anchorFound: false }),
@@ -143,7 +161,11 @@ vi.mock("@/hooks/community/use-native-system-notifications", () => ({
 describe("DM notification dismissal readiness", () => {
   beforeEach(() => {
     mockDismissConversation.mockClear()
+    mockCommitRoute.mockClear()
     mockDmMessages.navigationBlocked = false
+    mockHistory.allowed = true
+    mockHistory.error = null
+    mockHistory.retry.mockClear()
     mockDms.dms = []
     mockDms.isLoading = false
   })
@@ -164,12 +186,32 @@ describe("DM notification dismissal readiness", () => {
     mockDms.isLoading = isLoading
     mockDmMessages.navigationBlocked = navigationBlocked
 
-    render(React.createElement(DmPage))
+    render(React.createElement(DmView, { dmId: "dm_1" }))
 
     expect(mockDismissConversation).toHaveBeenCalledExactlyOnceWith(
       "viewer_1",
       { kind: "dm", channelId: "dm_1" },
       expectedReady,
     )
+    if (expectedReady) expect(mockCommitRoute).toHaveBeenCalledExactlyOnceWith("viewer_1", null, "dm_1")
+    else expect(mockCommitRoute).not.toHaveBeenCalled()
+  })
+
+  it("withholds history/composer and last while read access fails, then permits the same target after retry", () => {
+    mockDms.dms = [{ id: "dm_1", userId: "peer_1", name: "Peer", avatar: "P" }]
+    mockHistory.allowed = false
+    mockHistory.error = Object.assign(new Error("denied"), { status: 403 })
+    const view = render(React.createElement(DmView, { dmId: "dm_1" }))
+    expect(view.container.querySelector('[data-testid="history-error"]')).not.toBeNull()
+    expect(view.container.querySelector('[data-testid="history-body"]')).toBeNull()
+    expect(view.container.querySelector('[data-testid="composer"]')).toBeNull()
+    expect(mockCommitRoute).not.toHaveBeenCalled()
+    view.container.querySele
```

**File**: `src/web/src/app/c/me/[dmId]/page.test.ts` (modified, +8/-8)
```diff
@@ -3,9 +3,9 @@ import { describe, expect, it } from "vitest"
 
 describe("DM page loading ownership", () => {
   it("keeps full-frame and message-body ownership separate", () => {
-    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
+    const source = readFileSync(new URL("../../../../components/community/channels/dm-view.tsx", import.meta.url), "utf8")
     expect(source).toContain("fullFramePending: !hasDm && dmsLoading")
-    expect(source).toContain("notFound: !hasDm && !dmsLoading")
+    expect(source).toContain("missingPeer: !hasDm && !dmsLoading")
     expect(source).toContain("messageBodyLoading: hasDm && messagesLoading")
     expect(source).not.toContain("currentChannelMatches")
     expect(source).not.toContain("readSnapshotFetching ||\n      messagesLoading")
@@ -26,20 +26,20 @@ describe("DM page loading ownership", () => {
     const messageListProps = source.split("<MessageList\n")[1]?.split("/>")[0]
     expect(messageListProps).toContain("typingUsers")
     expect(source).not.toContain('data-onboarding-name={dm.name} className="shrink-0"')
-    expect(source).toContain("loading={loadingOwnership.messageBodyLoading}")
-    expect(source).not.toContain("<ComposerSkeleton")
+    expect(source).toContain("loading={!historyAllowed || loadingOwnership.messageBodyLoading}")
+    expect(source).toContain("!historyAllowed ? <ComposerSkeleton")
     expect(source).not.toContain("<DmHeaderSkeleton")
   })
 
   it("uses the cache-first DM projection as the header and composer identity", () => {
-    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
+    const source = readFileSync(new URL("../../../../components/community/channels/dm-view.tsx", import.meta.url), "utf8")
     expect(source).toContain("dms.find((candidate) => candidate.id === dmId) ?? null")
     expect(source).not.toContain("profilesByUserId.get(raw.userId)")
   })
 
   it("owns lazy channel-directory state and retry inside the keyed DM view", () => {
-    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
-    expect(source).toContain("return <DmView key={params.dmId} />")
+    const source = readFileSync(new URL("../../../../components/community/channels/dm-view.tsx", import.meta.url), "utf8")
+    expect(source).toContain("export function DmView({ dmId }")
     expect(source).toContain("useChannelRefDirectory(channelRefDirectoryEnabled)")
     expect(source).toContain("loading: !channelRefDirectoryResolved")
     expect(source).toContain("failed: channelRefDirectoryError")
@@ -50,7 +50,7 @@ describe("DM page loading ownership", () => {
   })
 
   it("keeps chip toggle and picker add on separate reaction intents", () => {
-    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
+    const source = readFileSync(new URL("../../../../components/community/channels/dm-view.tsx", import.meta.url), "utf8")
     expect(source).toContain("const toggleReaction = useToggleReactionApi()")
     expect(source).toContain("const addReaction = useAddReactionApi()")
     expect(source).toContain("onToggleReaction: (id: string, emoji: string) =>\n      toggleReaction(")
```

**File**: `src/web/src/app/c/me/[dmId]/page.tsx` (modified, +1/-554)
```diff
@@ -1,556 +1,3 @@
-"use client"
-
-import { useCallback, useEffect, useMemo, useState } from "react"
-import { useParams, useSearchParams } from "next/navigation"
-import { toast } from "sonner"
-import { useBreakpoint } from "@/hooks/use-mobile"
-import { DmHeader } from "@/components/community/channels/dm-header"
-import { DmLoadingFrame } from "@/components/community/channels/dm-loading-frame"
-import { Avatar } from "@/components/community/avatar"
-import { MessageList } from "@/components/community/messages/message-list"
-import { MessageContextSheet } from "@/components/community/messages/message-context-sheet"
-import { Composer, type SendAttachment } from "@/components/community/messages/composer"
-import {
-  ConversationFooterShell,
-  ConversationFooterSlotProvider,
-} from "@/components/community/messages/conversation-footer-shell"
-import type { FileAttachment, ImagePreview } from "@/lib/community/models/message"
-import type { OpenProfile } from "@/components/community/social/profile-types"
-import {
-  useCommunityStore,
-  useUiHandlers,
-  useTypingUsersForScope,
-  useTypingNamesForScope,
-} from "@/stores/community"
-import { tid } from "@/lib/community/testids"
-import { readCommunityProfile } from "@/lib/community/profile-read"
-import { makeUserNameResolver } from "@/lib/community/display-name"
-import { useDms } from "@/hooks/community/use-dms"
-import { useFriends } from "@/hooks/community/use-friends"
-import { useDmMessages } from "@/hooks/community/use-messages"
-import { useDmReadStateSnapshot } from "@/hooks/community/use-dm-read-state"
-import { resolveMessageReadProjection } from "@/lib/community/message-read-projection"
-import { useDmWatermark } from "@/hooks/community/use-dm-watermark"
-import { useChannelRefDirectory } from "@/hooks/community/use-channel-ref-directory"
-import { toChannelRefCandidate } from "@/lib/community/channel-ref-extension"
-import {
-  useAddReactionApi,
-  useToggleReactionApi,
-  useToggleMark,
-} from "@/hooks/community/mutations"
-import { useDmMessageSender } from "@/hooks/community/use-dm-message-sender"
-import { useMessageStreamStore } from "@/stores/community/message-stream"
-import { useCurrentUser } from "@/contexts/community/current-user"
-import {
-  communityWsSubscribe,
-  communityWsUnsubscribe,
-  communityWsSendTyping,
-  communityWsEndTyping,
-} from "@/hooks/community/use-community-ws"
-import {
-  advanceCommunityOnboarding,
-  readCommunityOnboardingState,
-} from "@/lib/community-onboarding"
-import { notifLevelDisplay, type NotifLevel } from "@alook/shared"
-import { useNotificationSettings } from "@/hooks/community/use-notification-settings"
-import { useSetChannelNotif } from "@/hooks/community/mutations"
-import { toastApiError } from "@/lib/api/client"
-import { displayReplyContent } from "@/lib/community/reply-content"
-import {
-  useCanonicalProfilesByUserId,
-  useReadStateProjection,
-} from "@/lib/community-db/projections"
-import { useNativeSystemNotificationConversationDismissal } from "@/hooks/community/use-native-system-notifications"
-
-// Thin re-mount wrapper — same reason as the server-side channel view: the
-// dynamic segment reuses the same component instance across DM switches, so
-// keying by dmId tears down the previous view before the next paints.
 export default function DmPage() {
-  const params = useParams<{ dmId: string }>()
-  return <DmView key={params.dmId} />
-}
-
-function resolveDmLoadingOwnership({
-  hasDm,
-  dmsLoading,
-  messagesLoading,
-}: {
-  hasDm: boolean
-  dmsLoading: boolean
-  messagesLoading: boolean
-}) {
-  return {
-    fullFramePending: !hasDm && dmsLoading,
-    notFound: !hasDm && !dmsLoading,
-    messageBodyLoading: hasDm && messagesLoading,
-  }
-}
-
-function DmView() {
-  const params = useParams<{ dmId: string }>()
-  const dmId = params.dmId
-  const bp = useBreakpoint()
-  const currentUser = useCurrentUser()
-  const uiHandlers = useUiHandlers()
-  const notifications = useNotificationSettings()
-  const setNotification = useSetChannelNotif()
-
-  // MeLayout owns the canonical cold DMs fetch. This second observer consumes
-  // that result without treating it as stale on mount; explicit WS/query
-  // invalidation still refetches the active canonical key.
-  const dmsQuery = useDms()
-  const dms = dmsQuery.dms
-  const dmsLoading = dmsQuery.isLoading
-  const { friends: rawFriends, blocked } = useFriends()
-  const profilesByUserId = useCanonicalProfilesByUserId()
-  // Enrich with presence — the Composer @-picker uses `f.status` to render
-  // the avatar presence dot; without this enrichment every avatar shows offline.
-  const friends = useMemo(
-    () =>
-      rawFriends.map((f) => {
-        const userId = f.userId ?? f.id
-        const canonical = profilesByUserId.get(userId)
-        const profile = canonical
-          ? readCommunityProfile(canonical, userId)
-          : { ...f, presence: f.status }
-        return {
-          ...f,
-        
```

**File**: `src/web/src/app/c/me/layout.route-memory.dom.test.ts` (modified, +28/-23)
```diff
@@ -73,8 +73,8 @@ vi.mock("@/stores/community", () => {
 vi.mock("@/hooks/community/use-dms", () => ({
   useDms: () => ({ dms: [], isLoading: false, isPending: false }),
 }))
-vi.mock("@/hooks/community/use-dm-route-verification", () => ({
-  useDmRouteVerification: () => ({ status: mocks.dmStatus, retry: vi.fn(), retrying: false }),
+vi.mock("@/components/community/channels/dm-route", () => ({
+  DmRoute: ({ dmId }: { dmId: string }) => createElement("main", { "data-testid": "target-dm", "data-channel-id": dmId }, dmId),
 }))
 vi.mock("@/hooks/community/use-friends", () => ({
   useFriends: () => ({ blocked: [], pending: mocks.pending }),
@@ -95,7 +95,7 @@ vi.mock("@/lib/community/profile-read", () => ({
 }))
 vi.mock("@/lib/community/last-me-location", () => ({
   ME_ROOT: "/c/me",
-  resolveMeLocationStatus: () => mocks.locationStatus,
+  isRememberableMeLocation: () => mocks.locationStatus === "remember",
   setLastMeLocation: (...args: unknown[]) => mocks.setLastMeLocation(...args),
   getLastMeLeaf: () => mocks.dmId,
   meLeafFromPathname: () => mocks.dmId,
@@ -151,29 +151,34 @@ describe("MeLayout route memory", () => {
     expect(mocks.replace).not.toHaveBeenCalled()
   })
 
-  it("clears a matching failed cold-entry DM and falls back to Machines", () => {
-    mocks.pathname = "/c/me/dm-missing"
-    mocks.dmId = "dm-missing"
-    mocks.dmStatus = "missing"
-    mocks.locationStatus = "stale"
-    mocks.consumeColdEntryFailure.mockReturnValue(true)
-    renderLayout()
-    expect(mocks.clearLastMeLocation).toHaveBeenCalledTimes(1)
-    expect(mocks.cancelPendingNavigation).toHaveBeenCalledTimes(1)
-    expect(mocks.consumeColdEntryFailure).toHaveBeenCalledWith(
-      "viewer-1",
-      "/c/me/dm-missing",
-    )
-    expect(mocks.replace).toHaveBeenCalledWith("/c/me/machines")
+  it("mounts each target DM while Next children stay on the neutral root, without saving last in layout", () => {
+    mocks.pathname = "/c/me/dm-a"
+    mocks.dmId = "dm-a"
+    const client = new QueryClient()
+    const tree = () => createElement(QueryClientProvider, { client },
+      createElement(MeLayout, null, createElement("div", { "data-testid": "neutral-leaf" }, "Loading your space")))
+    const rendered = render(tree())
+    expect(rendered.getByTestId("target-dm").getAttribute("data-channel-id")).toBe("dm-a")
+    expect(rendered.queryByTestId("neutral-leaf")).toBeNull()
+    mocks.pathname = "/c/me/dm-b"
+    mocks.dmId = "dm-b"
+    rendered.rerender(tree())
+    expect(rendered.getByTestId("target-dm").getAttribute("data-channel-id")).toBe("dm-b")
+    expect(rendered.queryByText("dm-a")).toBeNull()
+    expect(rendered.queryByTestId("neutral-leaf")).toBeNull()
+    expect(mocks.setLastMeLocation).not.toHaveBeenCalled()
+    expect(mocks.commitLastCommunityRoute).not.toHaveBeenCalled()
+    rendered.unmount()
+    client.clear()
   })
 
-  it("keeps the existing Me-root fallback for an ordinary invalid deep link", () => {
-    mocks.pathname = "/c/me/dm-missing"
-    mocks.dmId = "dm-missing"
-    mocks.dmStatus = "missing"
-    mocks.locationStatus = "stale"
+  it("does not commit a DM pathname while its layout params are still unresolved", () => {
+    mocks.pathname = "/c/me/dm-pending"
+    mocks.dmId = undefined
+    mocks.locationStatus = "remember"
     renderLayout()
-    expect(mocks.replace).toHaveBeenCalledWith("/c/me")
+    expect(mocks.setLastMeLocation).not.toHaveBeenCalled()
+    expect(mocks.commitLastCommunityRoute).not.toHaveBeenCalled()
   })
 
   it("keeps the Friends shortcut count on the shared terminal projection through failed refreshes", async () => {
```

**File**: `src/web/src/app/c/me/layout.tsx` (modified, +10/-47)
```diff
@@ -4,37 +4,25 @@ import { useCallback, useEffect, useMemo, type ReactNode } from "react"
 import {
   useParams,
   usePathname,
-  useRouter,
   useSelectedLayoutSegments,
 } from "next/navigation"
 import { ShellFrame } from "@/components/community/shell/shell-frame"
-import { CommunityPendingFrame } from "@/components/community/shell/community-pending-frame"
-import { DmRouteErrorFrame } from "@/components/community/channels/dm-route-error-frame"
+import { DmRoute } from "@/components/community/channels/dm-route"
 import { DmSidebar } from "@/components/community/channels/dm-sidebar"
 import { useCommunityStore, useCurrentChannelId } from "@/stores/community"
 import { useDms } from "@/hooks/community/use-dms"
-import { useDmRouteVerification } from "@/hooks/community/use-dm-route-verification"
 import { useFriends, useFriendsPresence } from "@/hooks/community/use-friends"
 import { useInboxUnreads } from "@/hooks/community/use-inbox"
 import { useCurrentUser } from "@/contexts/community/current-user"
 import {
-  clearLastMeLocation,
-  getLastMeLeaf,
-  ME_ROOT,
-  meLeafFromPathname,
-  resolveMeLocationStatus,
+  isRememberableMeLocation,
   setLastMeLocation,
 } from "@/lib/community/last-me-location"
-import {
-  COMMUNITY_COLD_ENTRY_FALLBACK,
-  commitLastCommunityRoute,
-  consumeCommunityColdEntryFailure,
-} from "@/lib/community/last-community-route"
+import { commitLastCommunityRoute } from "@/lib/community/last-community-route"
 
 // DM-side layout. The DM subtree has no server settings, no channel sidebar,
 // and no `[serverId]` param — everything is scoped to the current user.
 export default function MeLayout({ children }: { children: ReactNode }) {
-  const router = useRouter()
   const pathname = usePathname()
   const currentUser = useCurrentUser()
   const params = useParams<{ dmId?: string }>()
@@ -45,16 +33,10 @@ export default function MeLayout({ children }: { children: ReactNode }) {
   const {
     dms,
     isLoading: dmsLoading,
-    isPending: dmsPending,
   } = useDms()
-  const canonicalDmsUnsettled = dmsPending
-  const dmRouteVerification = useDmRouteVerification(params.dmId, dms, canonicalDmsUnsettled)
   const { blocked } = useFriends()
   const friendRequestCount = useInboxUnreads().friendRequests.length
   const currentChannelId = useCurrentChannelId()
-  const cancelPendingNavigation = useCallback(() => {
-    useCommunityStore.getState().uiHandlers.cancelPendingNavigation?.()
-  }, [])
 
   // Clear the active server when entering the DM home. `currentServerId ===
   // null` is the canonical "no server focused" state — no need for a "@me"
@@ -70,27 +52,13 @@ export default function MeLayout({ children }: { children: ReactNode }) {
   const machinesActive = pathname === "/c/me/machines"
   const botsActive = pathname === "/c/me/bots"
   const friendsActive = pathname === "/c/me/friends"
-
-  const meLocationStatus = resolveMeLocationStatus({
-    pathname,
-    dmId: params.dmId,
-    dmRouteStatus: dmRouteVerification.status,
-  })
+  const staticModuleActive = machinesActive || botsActive || friendsActive
 
   useEffect(() => {
-    if (meLocationStatus === "remember") {
-      setLastMeLocation(pathname)
-      commitLastCommunityRoute(currentUser.id, pathname)
-      return
-    }
-    if (meLocationStatus !== "stale") return
-    if (getLastMeLeaf() === meLeafFromPathname(pathname)) clearLastMeLocation()
-    cancelPendingNavigation()
-    const destination = consumeCommunityColdEntryFailure(currentUser.id, pathname)
-      ? COMMUNITY_COLD_ENTRY_FALLBACK
-      : ME_ROOT
-    router.replace(destination)
-  }, [cancelPendingNavigation, currentUser.id, meLocationStatus, pathname, router])
+    if (params.dmId || !staticModuleActive || !isRememberableMeLocation(pathname)) return
+    setLastMeLocation(pathname)
+    commitLastCommunityRoute(currentUser.id, pathname)
+  }, [currentUser.id, params.dmId, pathname, staticModuleActive])
 
   // Navigation is intentionally read-neutral. The visible-row observer owns
   // both optimistic clearing and the durable cursor write.
@@ -142,13 +110,8 @@ export default function MeLayout({ children }: { children: ReactNode }) {
       frameHref={structuralFrameHref}
       sidebar={sidebar}
     >
-      {params.dmId && dmRouteVerification.status === "error"
-        ? <DmRouteErrorFrame
-            onRetry={dmRouteVerification.retry}
-            retrying={dmRouteVerification.retrying}
-          />
-        : params.dmId && meLocationStatus !== "remember"
-        ? <CommunityPendingFrame href={pathname} />
+      {params.dmId
+        ? <DmRoute key={`${currentUser.id}/${params.dmId}`} dmId={params.dmId} />
         : children}
     </ShellFrame>
   )
```

**File**: `src/web/src/components/community/channels/adaptive-navigation-cutover.contract.test.ts` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ describe("adaptive navigation cutover contracts", () => {
   })
 
   it("autofocuses message composers only after desktop is known", () => {
-    const dmPage = readSource("../../../app/c/me/[dmId]/page.tsx")
+    const dmPage = readSource("./dm-view.tsx")
     const textSurface = readSource("./text-channel-surface.tsx")
     const threadSurface = readSource("./thread-channel-surface.tsx")
 
```

---

### Incident Patch 9: `37fbbc66` (2026-10-01)
**Commit Message**: fix(web): reconcile foreground messages independently of websocket validation (#861)

**File**: `src/web/src/hooks/community/community-ws/reconnect-messages.test.ts` (modified, +275/-1)
```diff
@@ -124,6 +124,96 @@ describe("focused message reconnect catch-up", () => {
     queryClient.clear()
   })
 
+  it.each(["channel", "dm"] as const)("shares in-flight %s window work across foreground, reconnect and gap repair", async (kind) => {
+    const client = new QueryClient()
+    const key = kind === "channel" ? communityKeys.channelMessages("shared") : communityKeys.dmMessages("shared")
+    const { unsubscribe } = seedActiveQuery(client, key)
+    let release!: (page: unknown) => void
+    apiFetchMock.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
+    const cancel = vi.spyOn(client, "cancelQueries")
+    const first = reconcileFocusedMessageQueries(client, kind, "shared")
+    await vi.waitFor(() => expect(apiFetchMock).toHaveBeenCalledOnce())
+    const reconnect = reconcileFocusedMessageQueries(client, kind, "shared")
+    const gap = scheduleFocusedMessageGapRepair(client, { kind, scopeId: "shared" }, 5)
+    expect(reconnect).toBe(first)
+    expect(cancel).toHaveBeenCalledOnce()
+    expect(apiFetchMock).toHaveBeenCalledOnce()
+    apiFetchMock.mockResolvedValueOnce({ messages: [3, 4, 5].map((seq) => ({ id: `m_${seq}`, seq, createdAt: `2026-08-15T00:00:0${seq}.000Z` })), latestSeq: 5, hasMoreNewer: false })
+    release({ messages: [], latestSeq: 2, hasMore: false })
+    await Promise.all([first, reconnect, gap])
+    expect(apiFetchMock).toHaveBeenCalledTimes(2)
+    expect(client.getQueryData<{ pages: Array<{ messages: Array<{ id: string }> }> }>(key)?.pages.flatMap((page) => page.messages.map((message) => message.id))).toEqual(["m_2", "m_3", "m_4", "m_5", "m_1"])
+    apiFetchMock.mockResolvedValueOnce({ messages: [], latestSeq: 5, hasMore: false })
+    await reconcileFocusedMessageQueries(client, kind, "shared")
+    expect(apiFetchMock).toHaveBeenCalledTimes(3)
+    unsubscribe()
+    client.clear()
+  })
+
+  it("refreshes a completed query variant when another variant still holds the scope owner", async () => {
+    const client = new QueryClient()
+    const key = communityKeys.channelMessages("variants")
+    const taggedKey = [...key, "tag", "selected"]
+    const subscriptions = [seedActiveQuery(client, key), seedActiveQuery(client, taggedKey)]
+    let releaseTagged!: (page: unknown) => void
+    const tagged = new Promise((resolve) => { releaseTagged = resolve })
+    const fresh = { messages: [3, 4, 5].map((seq) => ({ id: `m_${seq}`, seq, createdAt: `2026-08-15T00:00:0${seq}.000Z` })), latestSeq: 5, hasMoreNewer: false }
+    apiFetchMock.mockImplementation((url: string) => {
+      if (url.includes("since=")) return Promise.resolve(fresh)
+      if (url.includes("tag=")) return tagged
+      return Promise.resolve({ messages: [], latestSeq: apiFetchMock.mock.calls.length > 2 ? 5 : 2, hasMore: false })
+    })
+    const first = reconcileFocusedMessageQueries(client, "channel", "variants")
+    await vi.waitFor(() => expect(publishCommunityMessagesMock).toHaveBeenCalledOnce())
+    const gap = scheduleFocusedMessageGapRepair(client, { kind: "channel", scopeId: "variants" }, 5)
+    await vi.waitFor(() => expect(publishCommunityMessagesMock).toHaveBeenCalledTimes(2))
+    releaseTagged({ messages: [], latestSeq: 2, hasMore: false })
+    await Promise.all([first, gap])
+    for (const queryKey of [key, taggedKey]) {
+      expect(client.getQueryData<{ pages: Array<{ messages: Array<{ id: string }> }> }>(queryKey)?.pages.flatMap((page) => page.messages.map((message) => message.id))).toEqual(["m_2", "m_3", "m_4", "m_5", "m_1"])
+    }
+    expect(apiFetchMock.mock.calls.filter(([url]) => String(url).includes("tag=") && !String(url).includes("since="))).toHaveLength(1)
+    for (const subscription of subscriptions) subscription.unsubscribe()
+    client.clear()
+  })
+
+  it.each(["account", "permission", "replacement"] as const)("does not share an old repair after %s changes or let its cleanup remove the new owner", async (change) => {
+    const client = new QueryClient()
+    useCommunityWsStore.getState().activateProfileAccount("a")
+    const key = communityKeys.channelMessages("changed")
+    const subscriptions = [seedActiveQuery(client, key).unsubscribe]
+    let rejectOld!: (reason: unknown) => void
+    let releaseNew!: (page: unknown) => void
+    apiFetchMock.mockReturnValueOnce(new Promise((_, reject) => { rejectOld = reject }))
+    const first = reconcileFocusedMessageQueries(client, "channel", "changed")
+    await vi.waitFor(() => expect(apiFetchMock).toHaveBeenCalledOnce())
+    if (change === "account") useCommunityWsStore.getState().activateProfileAccount("b")
+    else if (change === "permission") {
+      useCommunityWsStore.getState().revokeChannelAccess("server", "changed")
+      useCommunityWsStore.getState().rememberChannelAccess("server", "changed")
+    } else {
+      client.removeQueries({ queryKey: key, exact: true })
+      subscriptions.push(seedActiveQuery(client, key).unsubscribe)
+    }
+    apiFetchMock.mockReturnValueOn
```

**File**: `src/web/src/hooks/community/community-ws/reconnect-messages.ts` (modified, +163/-84)
```diff
@@ -1,4 +1,4 @@
-import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query"
+import type { InfiniteData, Query, QueryClient, QueryKey } from "@tanstack/react-query"
 import { apiFetchProfiles, messageProfilePatches } from "@/lib/community/profile-seed"
 import { ApiError } from "@/lib/errors"
 import { captureChannelMetadataToken, isChannelMetadataTokenCurrent } from "@/hooks/community/channel-metadata"
@@ -125,7 +125,17 @@ type GapRepairScope = {
   serverId?: string
 }
 
-const gapRepairs = new WeakMap<QueryClient, Map<string, Promise<void>>>()
+type FocusedQueryRepair = { promise: Promise<void>; settled: boolean }
+
+type FocusedMessageRepair = {
+  token: ReturnType<typeof captureChannelMetadataToken>
+  queries: Map<Query, FocusedQueryRepair>
+  promise: Promise<void>
+  gapPromise: Promise<void>
+  target: { seq: number }
+}
+
+const focusedMessageRepairs = new WeakMap<QueryClient, Map<string, FocusedMessageRepair>>()
 
 function knownFocusedMessageSeq(
   queryClient: QueryClient,
@@ -166,26 +176,7 @@ export function scheduleFocusedMessageGapRepair(
   incomingSeq: number,
 ): Promise<void> | null {
   if (incomingSeq <= knownFocusedMessageSeq(queryClient, scope) + 1) return null
-  let repairs = gapRepairs.get(queryClient)
-  if (!repairs) {
-    repairs = new Map()
-    gapRepairs.set(queryClient, repairs)
-  }
-  const key = `${scope.kind}:${scope.scopeId}`
-  const existing = repairs.get(key)
-  if (existing) return existing
-  const repair = reconcileFocusedMessageQueries(
-    queryClient,
-    scope.kind,
-    scope.scopeId,
-  ).catch(() => {
-    // Realtime delivery is fail-open. A reconnect still runs the same
-    // authoritative reconciliation path if this best-effort repair fails.
-  }).finally(() => {
-    repairs!.delete(key)
-  })
-  repairs.set(key, repair)
-  return repair
+  return getFocusedMessageRepair(queryClient, scope.kind, scope.scopeId, incomingSeq).gapPromise
 }
 
 /**
@@ -227,6 +218,7 @@ async function fetchCatchUp(
   scopeId: string,
   cursor: string,
   tag: string | null,
+  target: { seq: number },
 ): Promise<MessagesPage> {
   const messages: Msg[] = []
   let latestSeq = 0
@@ -245,7 +237,10 @@ async function fetchCatchUp(
     latestSeq = Math.max(latestSeq, page.latestSeq ?? 0)
     hasMoreNewer = page.hasMoreNewer ?? false
     newerCursor = page.newerCursor
-    if (!hasMoreNewer || !newerCursor) break
+    if (!hasMoreNewer || !newerCursor) {
+      if (latestSeq < target.seq) continue
+      break
+    }
     nextCursor = newerCursor
   }
 
@@ -293,83 +288,167 @@ function mergeReconciledPages(
   return { ...cache, pages }
 }
 
-export async function reconcileFocusedMessageQueries(
+function getFocusedMessageRepair(
   queryClient: QueryClient,
   kind: "channel" | "dm",
   scopeId: string,
-): Promise<void> {
+  incomingSeq = 0,
+): FocusedMessageRepair {
   const queryKey = kind === "channel"
     ? communityKeys.channelMessages(scopeId)
     : communityKeys.dmMessages(scopeId)
   const queries = queryClient.getQueryCache().findAll({
     queryKey,
     type: "active",
   })
+  let repairs = focusedMessageRepairs.get(queryClient)
+  if (!repairs) {
+    repairs = new Map()
+    focusedMessageRepairs.set(queryClient, repairs)
+  }
+  const key = `${kind}:${scopeId}`
+  const previous = repairs.get(key)
+  const reusable = previous && isChannelMetadataTokenCurrent(previous.token)
+    ? previous
+    : undefined
+  const target = reusable?.target ?? { seq: 0 }
+  target.seq = Math.max(target.seq, incomingSeq)
+  if (reusable
+    && reusable.queries.size === queries.length
+    && queries.every((query) => {
+      const operation = reusable.queries.get(query)
+      return operation && !operation.settled
+    })) return reusable
   const token = captureChannelMetadataToken(scopeId)
-  const operations = queries.map(async (query) => {
-    const publicationToken = captureCommunityLiveSnapshotToken(queryClient)
-    const isCurrent = () => isChannelMetadataTokenCurrent(token)
-      && queryClient.getQueryCache().find({ queryKey: query.queryKey, exact: true }) === query
-    // Infinite-query pagination computes its result from the data snapshot at
-    // fetch start. If that generation completes after reconciliation, TanStack
-    // can replace the reconciled cache with its stale snapshot. Capture the
-    // user's pagination intent, cancel that exact generation, then replay the
-    // same direction against the reconciled cache below.
-    const pendingDirection = query.state.fetchMeta?.fetchMore?.direction
-    await queryClient.cancelQueries(
-      { queryKey: query.queryKey, exact: true },
-      { revert: true, silent: true },
-    )
-
-    if (!isCurrent()) return
-    let accessDenied = false
-    try {
-      const window = warmReconnectWindow(query.queryKey, query.state.data)
-      if (!window) {
-        await queryClient.refetchQueries(
-          { queryKey: query.queryKey, exact: true, type: "active" },
-          { 
```

**File**: `src/web/src/hooks/community/community-ws/reconnect.ts` (modified, +31/-26)
```diff
@@ -124,39 +124,44 @@ async function reconcileCachedServer(queryClient: QueryClient, serverId: string)
   }
 }
 
+export async function reconcileFocusedCommunityMessages(
+  queryClient: QueryClient,
+  sub = useCommunityStore.getState().subscription,
+) {
+  const operations: Promise<unknown>[] = []
+  if (sub.channelId) {
+    operations.push(reconcileFocusedMessageQueries(
+      queryClient,
+      "channel",
+      sub.channelId,
+    ))
+  }
+  if (sub.secondaryChannelId) {
+    operations.push(reconcileFocusedMessageQueries(
+      queryClient,
+      "channel",
+      sub.secondaryChannelId,
+    ))
+  }
+  if (sub.dmConversationId) {
+    operations.push(reconcileFocusedMessageQueries(
+      queryClient,
+      "dm",
+      sub.dmConversationId,
+    ))
+  }
+  const settled = await Promise.allSettled(operations)
+  if (settled.some((result) => result.status === "rejected")) throw new Error("focused messages failed")
+}
+
 function policyExecutors(
   queryClient: QueryClient,
   viewerUserId?: string | null,
 ): Record<CommunityWsReconcilePolicy, () => void | Promise<void>> {
   const sub = useCommunityStore.getState().subscription
   const queryKeys = queryClient.getQueryCache().getAll().map((query) => query.queryKey)
   return {
-    "focused-messages": async () => {
-      const operations: Promise<unknown>[] = []
-      if (sub.channelId) {
-        operations.push(reconcileFocusedMessageQueries(
-          queryClient,
-          "channel",
-          sub.channelId,
-        ))
-      }
-      if (sub.secondaryChannelId) {
-        operations.push(reconcileFocusedMessageQueries(
-          queryClient,
-          "channel",
-          sub.secondaryChannelId,
-        ))
-      }
-      if (sub.dmConversationId) {
-        operations.push(reconcileFocusedMessageQueries(
-          queryClient,
-          "dm",
-          sub.dmConversationId,
-        ))
-      }
-      const settled = await Promise.allSettled(operations)
-      if (settled.some((result) => result.status === "rejected")) throw new Error("focused messages failed")
-    },
+    "focused-messages": () => reconcileFocusedCommunityMessages(queryClient, sub),
     "focused-opener": async () => {
       const parentMessageId = useCommunityStore.getState().currentChannelMeta?.parentMessageId
       if (!parentMessageId) return
```

**File**: `src/web/src/hooks/community/use-community-ws-foreground.test.ts` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
+import { QueryObserver } from "@tanstack/react-query"
+import { communityKeys } from "@/lib/query-keys"
+import { useCommunityStore } from "@/stores/community"
+import { useCommunityWsStore } from "@/stores/community/ws"
+import {
+  capturedOnMessage,
+  capturedOnReconnect,
+  capturedQueryClient,
+  capturedUseUserWsOptions,
+  cleanupCommunityWsHarness,
+  flushEffects,
+  getCommunityApiFetchMock,
+  messageCreate,
+  mountHook,
+  resetCommunityWsHarness,
+  resetHookMemoization,
+  unmountHook,
+} from "./community-ws/test-harness"
+
+const subscriptions: Array<() => void> = []
+const message = (id: string, seq = 1) => ({
+  id, seq, type: "chat" as const, content: id, authorId: "author",
+  createdAt: `2026-08-15T00:00:0${seq}.000Z`,
+})
+const page = (id: string) => ({ messages: [message(id)], latestSeq: 1, hasMore: false })
+
+function seed(id: string, kind: "channel" | "dm" = "channel") {
+  const key = kind === "channel" ? communityKeys.channelMessages(id) : communityKeys.dmMessages(id)
+  capturedQueryClient.setQueryData(key, { pages: [page(`old-${id}`)], pageParams: [{ mode: "newest" }] })
+  const observer = new QueryObserver(capturedQueryClient, {
+    queryKey: key,
+    queryFn: async () => ({ pages: [page(`query-${id}`)], pageParams: [{ mode: "newest" }] }),
+    staleTime: Infinity,
+  })
+  subscriptions.push(observer.subscribe(() => undefined))
+  return key
+}
+
+beforeEach(resetCommunityWsHarness)
+afterEach(async () => {
+  for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
+  await cleanupCommunityWsHarness()
+})
+
+describe("community foreground message reconciliation", () => {
+  it.each(["split", "dm"] as const)("starts only focused %s messages while transport access is disconnected", async (layout) => {
+    const store = useCommunityStore.getState()
+    const secondary = Symbol("parent")
+    if (layout === "split") {
+      store.subscribe({ channelId: "primary" })
+      store.claimSecondaryChannel(secondary, "parent")
+      seed("primary")
+      seed("parent")
+    } else {
+      store.subscribe({ dmConversationId: "dm" })
+      seed("dm", "dm")
+    }
+    seed("unrelated")
+    await mountHook()
+    flushEffects()
+    useCommunityWsStore.getState().markAccessDisconnected()
+    getCommunityApiFetchMock().mockImplementation(async (path) => page(String(path)))
+    const invalidate = vi.spyOn(capturedQueryClient, "invalidateQueries")
+    await capturedUseUserWsOptions!.onForeground!()
+    const paths = getCommunityApiFetchMock().mock.calls.map(([path]) => path)
+    expect(paths).toEqual(layout === "split" ? [
+      "/api/community/channels/primary/messages",
+      "/api/community/channels/parent/messages",
+    ] : ["/api/community/channels/dm/messages"])
+    expect(invalidate).not.toHaveBeenCalled()
+    if (layout === "split") {
+      store.releaseSecondaryChannel(secondary)
+      getCommunityApiFetchMock().mockClear()
+      await capturedUseUserWsOptions!.onForeground!()
+      expect(getCommunityApiFetchMock().mock.calls.map(([path]) => path)).toEqual([
+        "/api/community/channels/primary/messages",
+      ])
+    }
+  })
+
+  it("shares a held foreground window with reconnect and a later gap frame without duplicate cancellation", async () => {
+    useCommunityStore.getState().subscribe({ channelId: "focused" })
+    const key = seed("focused")
+    await mountHook()
+    flushEffects()
+    let release!: (value: unknown) => void
+    getCommunityApiFetchMock().mockImplementation(async (path) => {
+      if (path === "/api/community/channels/focused/messages") return new Promise((resolve) => { release = resolve })
+      if (String(path).includes("/messages?since=")) return {
+        messages: [message("missed", 2), message("live", 3)], latestSeq: 3, hasMoreNewer: false,
+      }
+      if (path === "/api/community/users/me/read-state") return { revision: 0, readStates: [] }
+      throw new Error(`unexpected fetch: ${String(path)}`)
+    })
+    const cancel = vi.spyOn(capturedQueryClient, "cancelQueries")
+    const foreground = capturedUseUserWsOptions!.onForeground!()
+    await vi.waitFor(() => expect(release).toBeTypeOf("function"))
+    const duplicate = capturedUseUserWsOptions!.onForeground!()
+    const reconnect = capturedOnReconnect!({ reconnectDurationMs: 1_000 })
+    const event = messageCreate("focused", "live")
+    event.message.seq = 3
+    capturedOnMessage!(event)
+    await Promise.resolve()
+    expect(getCommunityApiFetchMock().mock.calls.filter(([path]) => path === "/api/community/channels/focused/messages")).toHaveLength(1)
+    expect(cancel.mock.calls.filter(([filters]) => JSON.stringify(filters.queryKey) === JSON.stringify(key))).toHaveLength(1)
+    release(page("snapshot-before-gap"))
+    await Promise.all([foreground, duplicate, reconnect])
+    expect(getCommunityApiFetchMock().mock.calls.filter(([path]) => 
```

**File**: `src/web/src/hooks/community/use-community-ws.ts` (modified, +11/-1)
```diff
@@ -12,7 +12,10 @@ import {
   SEEN_DELIVERY_OPERATION_TRIM_TO,
   useCommunityWsStore,
 } from "@/stores/community/ws"
-import { reconcileCommunityWsReconnect } from "@/hooks/community/community-ws/reconnect"
+import {
+  reconcileCommunityWsReconnect,
+  reconcileFocusedCommunityMessages,
+} from "@/hooks/community/community-ws/reconnect"
 import {
   dispatchCommunityWsEvent,
   dispatchCommunityWsEvents,
@@ -528,10 +531,17 @@ export function useCommunityWs(options?: UseCommunityWsOptions): void {
     }
     await reconcileAccountReadState(queryClient, { surfaceMode: "non-inbox" })
   }, [queryClient])
+  const handleForeground = useCallback(() => {
+    if (inboxRefreshOwner.current?.disposed
+      || viewerUserIdRef.current !== viewerUserId
+      || (viewerUserId !== null && useCommunityWsStore.getState().profileViewerId !== viewerUserId)) return
+    return reconcileFocusedCommunityMessages(queryClient)
+  }, [queryClient, viewerUserId])
   const { send, reconnectNow } = useUserWs(handleMessage, {
     onReconnect: handleReconnect,
     onDisconnect: useCommunityWsStore.getState().markAccessDisconnected,
     onAuthenticated: handleAuthenticated,
+    onForeground: handleForeground,
     onConnectionStateChange: handleConnectionStateChange,
     requestDaemonStatusOnAuth: false,
   })
```

**File**: `src/web/src/lib/use-user-ws.test.ts` (modified, +75/-0)
```diff
@@ -1650,6 +1650,81 @@ describe("useUserWs", () => {
     expect(ws.closed).toBe(false)
   })
 
+  it("notifies foreground data work before validation and again for changed targets during a pending probe", async () => {
+    setupTokenFetch()
+    let finish!: () => void
+    const dataWork = new Promise<void>((resolve) => { finish = resolve })
+    const onForeground = vi.fn(() => dataWork)
+    const onReconnect = vi.fn()
+    await mountHook(vi.fn(), { onForeground, onReconnect, requestDaemonStatusOnAuth: false })
+    const ws = MockWebSocket.instances[0]!
+    ws.simulateOpen()
+    ws.simulateMessage({ type: "auth.ok" })
+
+    dispatchHiddenToVisible()
+    expect(onForeground).toHaveBeenCalledOnce()
+    expect(connectionPings(ws)).toHaveLength(1)
+    expect(onReconnect).not.toHaveBeenCalled()
+    dispatchWindowFocus()
+    mockDocument.dispatch("resume")
+    dispatchPageShow(true)
+    expect(onForeground).toHaveBeenCalledTimes(4)
+    expect(connectionPings(ws)).toHaveLength(1)
+
+    const [{ nonce }] = connectionPings(ws)
+    ws.simulateMessage({ type: "connection.pong", nonce })
+    expect(ws.closed).toBe(false)
+    expect(MockWebSocket.instances).toEqual([ws])
+    expect(onReconnect).not.toHaveBeenCalled()
+    finish()
+    await flushPromises()
+  })
+
+  it("notifies foreground data work while token or authentication is still pending", async () => {
+    const token = deferred<Response>()
+    mockFetch.mockReturnValueOnce(token.promise)
+    const onForeground = vi.fn()
+    await mountHook(vi.fn(), { onForeground, requestDaemonStatusOnAuth: false })
+    dispatchWindowFocus()
+    expect(onForeground).toHaveBeenCalledOnce()
+    expect(MockWebSocket.instances).toHaveLength(0)
+    token.resolve({ ok: true, json: async () => ({ userId: "user-1", token: "test-token" }) } as Response)
+    await flushPromises()
+    const ws = MockWebSocket.instances[0]!
+    dispatchWindowFocus()
+    expect(onForeground).toHaveBeenCalledTimes(2)
+    expect(ws.readyState).toBe(MockWebSocket.CONNECTING)
+    ws.simulateOpen()
+    dispatchWindowFocus()
+    expect(onForeground).toHaveBeenCalledTimes(3)
+    expect(connectionPings(ws)).toHaveLength(0)
+  })
+
+  it("keeps foreground data failures independent of socket validation and blocks hidden/offline work", async () => {
+    setupTokenFetch()
+    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
+    const onForeground = vi.fn(() => { throw new Error("data unavailable") })
+    await mountHook(vi.fn(), { onForeground, requestDaemonStatusOnAuth: false })
+    const ws = MockWebSocket.instances[0]!
+    ws.simulateOpen()
+    ws.simulateMessage({ type: "auth.ok" })
+    mockDocument.visibilityState = "hidden"
+    mockDocument.dispatch("visibilitychange")
+    dispatchWindowFocus()
+    expect(onForeground).not.toHaveBeenCalled()
+    mockNavigator.onLine = false
+    mockWindow.dispatch("offline")
+    mockDocument.visibilityState = "visible"
+    mockDocument.dispatch("visibilitychange")
+    expect(onForeground).not.toHaveBeenCalled()
+    mockNavigator.onLine = true
+    mockWindow.dispatch("online")
+    expect(onForeground).toHaveBeenCalledOnce()
+    expect(connectionPings(ws)).toHaveLength(1)
+    expect(warn).toHaveBeenCalledWith("[ws] lifecycle callback threw", { callback: "foreground" })
+    warn.mockRestore()
+  })
+
   it("coalesces an offline-online signal pair while foreground validation is pending", async () => {
     setupTokenFetch()
     await mountHook(vi.fn(), { requestDaemonStatusOnAuth: false })
```

**File**: `src/web/src/lib/use-user-ws.ts` (modified, +7/-1)
```diff
@@ -127,12 +127,13 @@ export type UseUserWsOptions = {
   onReconnect?: (info: { reconnectDurationMs: number }) => void | Promise<void>
   onDisconnect?: () => void | Promise<void>
   onAuthenticated?: () => void | Promise<void>
+  onForeground?: () => void | Promise<void>
   onConnectionStateChange?: (phase: UserWsConnectionPhase) => void | Promise<void>
   requestDaemonStatusOnAuth?: boolean
 }
 
 function runLifecycleCallback(
-  name: "authenticated" | "connection-state" | "disconnect" | "reconnect",
+  name: "authenticated" | "connection-state" | "disconnect" | "foreground" | "reconnect",
   callback: (() => void | Promise<void>) | undefined,
 ) {
   if (!callback) return
@@ -175,6 +176,7 @@ export function useUserWs(
   const onReconnectRef = useRef(options?.onReconnect)
   const onDisconnectRef = useRef(options?.onDisconnect)
   const onAuthenticatedRef = useRef(options?.onAuthenticated)
+  const onForegroundRef = useRef(options?.onForeground)
   const onConnectionStateChangeRef = useRef(options?.onConnectionStateChange)
   const lastConnectionPhaseRef = useRef<UserWsConnectionPhase | null>(null)
   const requestDaemonStatusOnAuthRef = useRef(options?.requestDaemonStatusOnAuth ?? true)
@@ -218,9 +220,11 @@ export function useUserWs(
   useEffect(() => {
     onDisconnectRef.current = options?.onDisconnect
     onAuthenticatedRef.current = options?.onAuthenticated
+    onForegroundRef.current = options?.onForeground
     onConnectionStateChangeRef.current = options?.onConnectionStateChange
   }, [
     options?.onAuthenticated,
+    options?.onForeground,
     options?.onConnectionStateChange,
     options?.onDisconnect,
   ])
@@ -921,6 +925,8 @@ export function useUserWs(
     const recoveryNeeded = forceValidation || connectionValidationNeededRef.current
     if (!recoveryNeeded) return
 
+    runLifecycleCallback("foreground", onForegroundRef.current)
+    if (isOffline() || isPageHidden()) return
     if (pendingTokenRef.current) return
 
     const ws = wsRef.current
```

---

### Incident Patch 10: `266ff110` (2026-10-01)
**Commit Message**: fix(web): keep pending navigation during ordinary input (#858)

**File**: `src/web/src/app/c/me/friends/page.tsx` (modified, +1/-0)
```diff
@@ -135,6 +135,7 @@ export default function MeFriendsPage() {
         )
       }
       onDm={async (userId) => {
+        uiHandlers.cancelPendingNavigation?.()
         try {
           const data = await createOrGetDm.mutateAsync({ userId })
           if (data.conversation.id) uiHandlers.navigatePath?.(`/c/me/${data.conversation.id}`)
```

**File**: `src/web/src/components/community/bots/bot-list-controller.ts` (modified, +11/-1)
```diff
@@ -17,6 +17,7 @@ import {
   type BotSummary,
 } from "@/hooks/community/use-bots"
 import { useCreateOrGetDm } from "@/hooks/community/mutations"
+import { useUiHandlers } from "@/stores/community"
 import { useCanonicalProfilesByUserId } from "@/lib/community-db/projections"
 import {
   advanceCommunityOnboarding,
@@ -29,6 +30,7 @@ import type { BotListController } from "./bot-list-types"
 
 export function useBotListController(): BotListController {
   const router = useRouter()
+  const uiHandlers = useUiHandlers()
   const searchParams = useSearchParams()
   const botsQuery = useBots()
   const { bots, isLoading } = botsQuery
@@ -91,6 +93,7 @@ export function useBotListController(): BotListController {
   const isCreateDisabled = isAtCapacity && guidedCreateLabel === "Create a bot"
 
   const chatWithBot = async (bot: BotSummary) => {
+    uiHandlers.cancelPendingNavigation?.()
     try {
       const data = await createOrGetDm.mutateAsync({ userId: bot.id })
       router.push(`/c/me/${data.conversation.id}`)
@@ -100,6 +103,7 @@ export function useBotListController(): BotListController {
   }
 
   const openGuidedBotDm = async (botId: string) => {
+    uiHandlers.cancelPendingNavigation?.()
     try {
       const data = await createOrGetDm.mutateAsync({ userId: botId })
       advanceCommunityOnboarding("bot", "dm", {
@@ -124,6 +128,7 @@ export function useBotListController(): BotListController {
     const hasUsableMachine = machines.some((machine) => isPresenceOnline(machine.status))
     if (state?.status === "active" && state.stage === "bot" && !hasUsableMachine) {
       recoverCommunityOnboardingMachine()
+      uiHandlers.cancelPendingNavigation?.()
       router.push("/c/me/machines")
       return
     }
@@ -256,6 +261,7 @@ export function useBotListController(): BotListController {
   }, [activityBot, activityOpen, bots, botsResolved, router, searchParams, targetAuditBotId])
 
   const openActivity = (bot: BotSummary) => {
+    uiHandlers.cancelPendingNavigation?.()
     suppressedAuditRef.current = null
     const next = new URLSearchParams(searchParams.toString())
     next.set("audit", bot.id)
@@ -283,8 +289,12 @@ export function useBotListController(): BotListController {
     setActivityBot(null)
   }
 
-  const openMachines = () => router.push("/c/me/machines")
+  const openMachines = () => {
+    uiHandlers.cancelPendingNavigation?.()
+    router.push("/c/me/machines")
+  }
   const bringMachineOnline = (machineId: string) => {
+    uiHandlers.cancelPendingNavigation?.()
     router.push(`/c/me/machines?reconnect=${machineId}`)
   }
 
```

**File**: `src/web/src/components/community/channels/channel-route.text-scroll-target.dom.test.ts` (modified, +5/-1)
```diff
@@ -28,7 +28,7 @@ const {
   mockDismissConversation,
 } = vi.hoisted(() => ({
   mockRouter: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
-  mockUiHandlers: { replacePath: vi.fn(), goBackMobile: vi.fn() },
+  mockUiHandlers: { replacePath: vi.fn(), goBackMobile: vi.fn(), cancelPendingNavigation: vi.fn() },
   mockBreakpoint: { value: "desktop" as "desktop" | "mobile" },
   mockHeaderServerNavigate: { current: undefined as undefined | (() => void) },
   mockHeaderParentNavigate: { current: undefined as undefined | (() => void) },
@@ -340,6 +340,7 @@ function configureThreadRoute() {
 
 describe("ChannelRoute message surface ownership", () => {
   beforeEach(() => {
+    mockUiHandlers.cancelPendingNavigation.mockClear()
     vi.useFakeTimers()
     mockedMessageList.mockClear()
     mockOpenerGate.mockClear()
@@ -755,6 +756,9 @@ describe("ChannelRoute message surface ownership", () => {
     }), undefined)
 
     fireEvent.click(screen.getByTestId("community-thread-split-fullscreen"))
+    expect(mockUiHandlers.cancelPendingNavigation).toHaveBeenCalledOnce()
+    expect(mockUiHandlers.cancelPendingNavigation.mock.invocationCallOrder[0])
+      .toBeLessThan(mockRouter.push.mock.invocationCallOrder[0]!)
     expect(mockRouter.push).toHaveBeenCalledWith(
       "/c/channels/server_1/channel_1?keep=1&threadView=full",
       { scroll: false },
```

**File**: `src/web/src/components/community/channels/channel-route.tsx` (modified, +2/-1)
```diff
@@ -206,10 +206,11 @@ export function ChannelRoute({ serverParam, channelId }: {
     )
   }, [serverParam])
   const openThreadFullscreen = useCallback(() => {
+    uiHandlers.cancelPendingNavigation?.()
     const params = new URLSearchParams(searchParams.toString())
     params.set(THREAD_VIEW_PARAM, "full")
     router.push(`${channelHref(serverParam, channelId)}?${params.toString()}`, { scroll: false })
-  }, [channelId, router, searchParams, serverParam])
+  }, [channelId, router, searchParams, serverParam, uiHandlers])
 
   const openProfile = useCallback<OpenProfile>((name, e, discriminator, userId) => {
     uiHandlers.openProfile?.(name, e, discriminator, userId)
```

**File**: `src/web/src/components/community/channels/thread-channel-surface.dom.test.ts` (modified, +5/-1)
```diff
@@ -206,7 +206,7 @@ function surfaceProps(overrides: Record<string, unknown> = {}) {
       membersHasMore: false,
     },
     manageMembersDialog: React.createElement("span", { "data-manage-dialog": true }),
-    uiHandlers: { previewImage: vi.fn() },
+    uiHandlers: { previewImage: vi.fn(), cancelPendingNavigation: vi.fn() },
     onOpenChild: vi.fn(),
     onOpenProfile: vi.fn(),
     resolveUserName: (userId: string) => userId,
@@ -311,9 +311,13 @@ describe("ThreadChannelSurface ownership", () => {
       userId: "viewer_1",
     })
     act(() => opener.props.onJump?.())
+    expect(props.uiHandlers.cancelPendingNavigation).toHaveBeenCalledOnce()
+    expect(props.uiHandlers.cancelPendingNavigation.mock.invocationCallOrder[0])
+      .toBeLessThan(mocks.router.push.mock.invocationCallOrder[0]!)
     expect(mocks.router.push).toHaveBeenCalledWith("/c/channels/server_1/parent_1?msg=opener_1")
     act(() => opener.props.onPreviewImage?.("https://example.test/image.png"))
     expect(props.uiHandlers.previewImage).toHaveBeenCalledWith("https://example.test/image.png")
+    expect(props.uiHandlers.cancelPendingNavigation).toHaveBeenCalledOnce()
     expect(mockedMessageList).toHaveBeenCalledWith(expect.objectContaining({
       channel: "Thread name",
       messages: expect.arrayContaining([expect.objectContaining({ id: "message_1" })]),
```

**File**: `src/web/src/components/community/channels/thread-channel-surface.tsx` (modified, +5/-1)
```diff
@@ -84,6 +84,7 @@ export function ThreadChannelSurface({
   memberPanelProps: ChannelMemberPanelProps
   manageMembersDialog: ReactNode
   uiHandlers: {
+    cancelPendingNavigation?: () => void
     navigate?: (serverId: string, channelId: string) => void
     previewImage?: (image: ImagePreview) => void
     previewAttachment?: (attachment: FileAttachment) => void
@@ -181,7 +182,10 @@ export function ThreadChannelSurface({
       onPreviewImage={(image) => uiHandlers.previewImage?.(image)}
       onPreviewAttachment={(attachment) => uiHandlers.previewAttachment?.(attachment)}
       onJump={parentChannelId
-        ? () => router.push(`/c/channels/${serverParam}/${parentChannelId}?msg=${parentMessageId}`)
+        ? () => {
+            uiHandlers.cancelPendingNavigation?.()
+            router.push(`/c/channels/${serverParam}/${parentChannelId}?msg=${parentMessageId}`)
+          }
         : undefined}
     />
   ) : undefined
```

**File**: `src/web/src/components/community/messages/message-context-sheet.navigation.dom.test.ts` (modified, +4/-1)
```diff
@@ -4,6 +4,7 @@ import { act, render } from "@/test/react-dom-harness"
 
 const mocks = vi.hoisted(() => ({
   push: vi.fn(),
+  cancel: vi.fn(),
   close: vi.fn(),
   openThread: undefined as undefined | ((threadId: string) => void),
   pin: undefined as undefined | ((messageId: string) => void),
@@ -92,7 +93,7 @@ vi.mock("../dividers", () => ({ DateDivider: () => null }))
 vi.mock("@/contexts/community/current-user", () => ({
   useCurrentUser: () => ({ id: "viewer_1" }),
 }))
-vi.mock("@/stores/community", () => ({ useUiHandlers: () => ({}) }))
+vi.mock("@/stores/community", () => ({ useUiHandlers: () => ({ cancelPendingNavigation: mocks.cancel }) }))
 vi.mock("@/hooks/use-hover-capable", () => ({ useHoverCapable: () => true }))
 vi.mock("@/hooks/community/mutations", () => ({
   usePinMessage: () => ({ mutate: mocks.pinMutate }),
@@ -134,6 +135,8 @@ describe("MessageContextSheet thread navigation", () => {
     }))
     act(() => mocks.openThread?.("child_1"))
 
+    expect(mocks.cancel).toHaveBeenCalledOnce()
+    expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(mocks.push.mock.invocationCallOrder[0]!)
     expect(mocks.push).toHaveBeenCalledWith("/c/channels/server_1/child_1")
     expect(mocks.close).toHaveBeenCalledWith(false)
   })
```

**File**: `src/web/src/components/community/messages/message-context-sheet.tsx` (modified, +5/-2)
```diff
@@ -411,10 +411,13 @@ export function MessageContextSheet({
       type,
       serverId: routeParams?.serverId,
       threadId,
-      push: router.push,
+      push: (href) => {
+        uiHandlers.cancelPendingNavigation?.()
+        router.push(href)
+      },
       close: () => onOpenChange(false),
     })
-  }, [type, router, routeParams, onOpenChange])
+  }, [type, router, routeParams, onOpenChange, uiHandlers])
 
   const onPreviewImage = useCallback((image: ImagePreview) => {
     uiHandlers.previewImage?.(image)
```

---

### Incident Patch 11: `9de0d405` (2026-10-01)
**Commit Message**: fix(web): remove manual community navigation prefetch (#857)

**File**: `src/web/src/app/c/channels/layout.tsx` (modified, +1/-7)
```diff
@@ -411,11 +411,6 @@ export default function ServerLayout({ children }: { children: ReactNode }) {
     )
   }, [cancelPendingNavigation, serverId])
 
-  const prefetchChannel = useCallback(
-    (id: string, _parentId?: string) => router.prefetch(channelHref(serverId, id)),
-    [router, serverId],
-  )
-
   const onSidebarOpenSettings = useCallback((section?: SettingsSection) => {
     if (section) setSettingsSection(section)
     setServerSettingsOpen(true)
@@ -487,7 +482,6 @@ export default function ServerLayout({ children }: { children: ReactNode }) {
     isAdmin,
     currentUserId: currentUser.id,
     setActiveChannel,
-    prefetchChannel,
     forumThreadsByParent,
     activeThreadId: activeForumThreadId,
     onSelectForumThread: setActiveForumThread,
@@ -510,7 +504,7 @@ export default function ServerLayout({ children }: { children: ReactNode }) {
   }), [
     currentServer, sidebarHintOnly,
     currentChannelMeta?.parentChannelId,
-    currentChannelId, isAdmin, currentUser.id, setActiveChannel, prefetchChannel,
+    currentChannelId, isAdmin, currentUser.id, setActiveChannel,
     forumThreadsByParent, activeForumThreadId, setActiveForumThread,
     onSidebarOpenSettings, onBlockedCreate, mutedChannels,
     onCreateChannelInSidebar, onCreateCategoryInSidebar, onRenameChannel,
```

**File**: `src/web/src/app/c/me/layout.tsx` (modified, +1/-10)
```diff
@@ -113,11 +113,6 @@ export default function MeLayout({ children }: { children: ReactNode }) {
     useCommunityStore.getState().uiHandlers.navigatePath?.("/c/me/bots")
   }, [])
 
-  const prefetchDm = useCallback((id: string) => router.prefetch(`/c/me/${id}`), [router])
-  const prefetchFriends = useCallback(() => router.prefetch("/c/me/friends"), [router])
-  const prefetchMachines = useCallback(() => router.prefetch("/c/me/machines"), [router])
-  const prefetchBots = useCallback(() => router.prefetch("/c/me/bots"), [router])
-
   const blockedUserIds = useMemo(
     () => new Set(blocked.map((b) => b.userId ?? b.id)),
     [blocked],
@@ -130,19 +125,15 @@ export default function MeLayout({ children }: { children: ReactNode }) {
       blockedUserIds={blockedUserIds}
       loading={dmsLoading}
       onPickDm={enterDm}
-      onPrefetchDm={prefetchDm}
       onShowFriends={onShowFriends}
       friendRequestCount={friendRequestCount}
-      onPrefetchFriends={prefetchFriends}
       onShowMachines={onShowMachines}
-      onPrefetchMachines={prefetchMachines}
       onShowBots={onShowBots}
-      onPrefetchBots={prefetchBots}
       friendsActive={friendsActive}
       machinesActive={machinesActive}
       botsActive={botsActive}
     />
-  ), [dms, currentChannelId, dmsLoading, blockedUserIds, enterDm, prefetchDm, onShowFriends, friendRequestCount, prefetchFriends, onShowMachines, prefetchMachines, onShowBots, prefetchBots, friendsActive, machinesActive, botsActive])
+  ), [dms, currentChannelId, dmsLoading, blockedUserIds, enterDm, onShowFriends, friendRequestCount, onShowMachines, onShowBots, friendsActive, machinesActive, botsActive])
 
   return (
     <ShellFrame
```

**File**: `src/web/src/components/community/channels/adaptive-navigation-cutover.contract.test.ts` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ describe("adaptive navigation cutover contracts", () => {
     )
     expect(layout).toContain("channelHref(serverId, id)")
     expect(sidebar).toContain("onSelectForumThread?.(parentId, thread.id)")
-    expect(sidebar).toContain("prefetchChannel?.(thread.id, parentId)")
   })
 
   it("keeps the layout as the one channel subtree owner and removes the nested leaf", () => {
```

**File**: `src/web/src/components/community/channels/channel-sidebar-tree-owner.dom.test.tsx` (modified, +35/-1)
```diff
@@ -1,6 +1,6 @@
 import { createElement } from "react"
 import { describe, expect, it, vi } from "vitest"
-import { fireEvent, render, screen } from "@/test/react-dom-harness"
+import { fireEvent, render, screen, setupUser } from "@/test/react-dom-harness"
 import type { Category } from "@/lib/community/models/navigation"
 import { tid } from "@/lib/community/testids"
 import {
@@ -31,6 +31,40 @@ function scopeProps(categories: Category[] | null) {
 }
 
 describe("ChannelSidebarScope", () => {
+  it.each(["text", "forum"] as const)("activates %s rows and parent-aware child rows without navigating on hover/focus", async (type) => {
+    const setActiveChannel = vi.fn()
+    const onSelectForumThread = vi.fn()
+    render(createElement(ChannelSidebarScope, {
+      ...scopeProps([{ ...targetCategories[0], channels: [{ ...targetCategories[0].channels[0], type }] }]),
+      setActiveChannel,
+      onSelectForumThread,
+      forumThreadsByParent: {
+        "target-one": [{
+          id: "thread-one", parentChannelId: "target-one", parentMessageId: "message-one",
+          title: "Thread one", activityAt: "2026-09-25T00:00:00.000Z",
+          expiresAt: "2026-09-28T00:00:00.000Z", unread: false,
+        }],
+      },
+    }))
+    const row = screen.getByTestId(tid.channelRow("target-one"))
+    const child = screen.getByTestId(tid.forumSidebarThread("thread-one"))
+    for (const element of [row, child]) {
+      fireEvent.pointerEnter(element)
+      fireEvent.focus(element)
+    }
+    expect(setActiveChannel).not.toHaveBeenCalled()
+    expect(onSelectForumThread).not.toHaveBeenCalled()
+    fireEvent.click(row)
+    expect(setActiveChannel).toHaveBeenCalledExactlyOnceWith("target-one")
+    const user = setupUser()
+    await user.click(child)
+    child.focus()
+    await user.keyboard("{Enter}")
+    expect(onSelectForumThread.mock.calls).toEqual([
+      ["target-one", "thread-one"], ["target-one", "thread-one"],
+    ])
+  })
+
   it("reveals restored rows immediately while forum projection is pending", () => {
     render(createElement(ChannelSidebarRevealBoundary, {
       ...scopeProps(targetCategories),
```

**File**: `src/web/src/components/community/channels/channel-sidebar.tsx` (modified, +1/-9)
```diff
@@ -60,7 +60,6 @@ export type ChannelSidebarProps = {
   serverIcon?: string | null
   activeChannel: string
   setActiveChannel: (id: string) => void
-  prefetchChannel?: (id: string, parentId?: string) => void
   noHeader?: boolean
   onOpenSettings?: (section?: SettingsSection) => void
   isAdmin?: boolean
@@ -86,7 +85,7 @@ export type ChannelSidebarProps = {
 }
 
 export const ChannelSidebar = memo(function ChannelSidebar({
-  tree, serverName, official, activeChannel, setActiveChannel, prefetchChannel, noHeader, onOpenSettings,
+  tree, serverName, official, activeChannel, setActiveChannel, noHeader, onOpenSettings,
   isAdmin = true, currentUserId, onBlockedCreate, mutedChannels,
   onCreateChannel, onCreateCategory, onDeleteChannel, onDeleteCategory,
   onUpdateCategory, onRenameChannel, onReorderCategories, onReorderChannels,
@@ -207,7 +206,6 @@ export const ChannelSidebar = memo(function ChannelSidebar({
             active={thread.id === activeThreadId}
             muted={!!mutedChannels?.[parentId]}
             onClick={() => onSelectForumThread?.(parentId, thread.id)}
-            onPrefetch={() => prefetchChannel?.(thread.id, parentId)}
           />
         ))}
       </div>
@@ -248,7 +246,6 @@ export const ChannelSidebar = memo(function ChannelSidebar({
                   active={ch.id === activeChannel && !hasActiveSidebarThread}
                   canReorder={isAdmin}
                   onClick={() => setActiveChannel(ch.id)}
-                  onPrefetch={() => prefetchChannel?.(ch.id)}
                   onEdit={isAdmin ? () => setDialog({ kind: "edit-channel", id: ch.id, categoryId: noneCatId, name: ch.name, type: ch.type ?? "text" }) : undefined}
                   onDelete={isAdmin ? () => { removeChannel(ch.id); onDeleteChannel?.(ch.id) } : undefined}
                 />
@@ -289,7 +286,6 @@ export const ChannelSidebar = memo(function ChannelSidebar({
                         active={ch.id === activeChannel && !hasActiveSidebarThread}
                         canReorder={isAdmin}
                         onClick={() => setActiveChannel(ch.id)}
-                        onPrefetch={() => prefetchChannel?.(ch.id)}
                         onEdit={canManageChannel ? () => setDialog({ kind: "edit-channel", id: ch.id, categoryId: id, name: ch.name, type: ch.type ?? "text" }) : undefined}
                         onDelete={canManageChannel ? () => { removeChannel(ch.id); onDeleteChannel?.(ch.id) } : undefined}
                         onManageMembers={(catPrivate[id] && canManageChannel) ? () => setDialog({ kind: "manage-members", channelId: ch.id, channelName: ch.name }) : undefined}
@@ -427,13 +423,11 @@ function ForumSidebarThreadRow({
   active,
   muted,
   onClick,
-  onPrefetch,
 }: {
   thread: ForumSidebarThread
   active: boolean
   muted: boolean
   onClick: () => void
-  onPrefetch?: () => void
 }) {
   const unread = selectUnreadPresentation({
     accountUnread: thread.unread,
@@ -447,8 +441,6 @@ function ForumSidebarThreadRow({
         data-testid={tid.forumSidebarThread(thread.id)}
         aria-current={active ? "page" : undefined}
         onClick={onClick}
-        onPointerEnter={onPrefetch}
-        onFocus={onPrefetch}
         onContextMenu={(event) => {
           event.preventDefault()
           event.stopPropagation()
```

**File**: `src/web/src/components/community/channels/dm-sidebar.prefetch.dom.test.ts` (modified, +21/-15)
```diff
@@ -1,7 +1,7 @@
 import { createElement } from "react"
 import { describe, expect, it, vi } from "vitest"
 import { tid } from "@/lib/community/testids"
-import { fireEvent, render } from "@/test/react-dom-harness"
+import { fireEvent, render, setupUser } from "@/test/react-dom-harness"
 import { DmSidebar, DmSidebarSkeleton } from "./dm-sidebar"
 
 describe("DmSidebar navigation intent", () => {
@@ -52,10 +52,7 @@ describe("DmSidebar navigation intent", () => {
     expect(dmList).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
   })
 
-  it("prefetches the fixed destinations on pointer and keyboard intent", () => {
-    const onPrefetchFriends = vi.fn()
-    const onPrefetchMachines = vi.fn()
-    const onPrefetchBots = vi.fn()
+  it("waits for click or Enter before activating fixed destinations", async () => {
     const onShowFriends = vi.fn()
     const onShowMachines = vi.fn()
     const onShowBots = vi.fn()
@@ -64,29 +61,32 @@ describe("DmSidebar navigation intent", () => {
       activeDm: null,
       onPickDm: vi.fn(),
       onShowFriends,
-      onPrefetchFriends,
       onShowMachines,
-      onPrefetchMachines,
       onShowBots,
-      onPrefetchBots,
     }))
 
     const [friends, machines, bots] = renderer.container.querySelectorAll("button")
     fireEvent.pointerEnter(friends!)
     fireEvent.focus(machines!)
     fireEvent.pointerEnter(bots!)
 
-    expect(onPrefetchFriends).toHaveBeenCalledTimes(1)
-    expect(onPrefetchMachines).toHaveBeenCalledTimes(1)
-    expect(onPrefetchBots).toHaveBeenCalledTimes(1)
     expect(onShowFriends).not.toHaveBeenCalled()
     expect(onShowMachines).not.toHaveBeenCalled()
     expect(onShowBots).not.toHaveBeenCalled()
 
+    const user = setupUser()
+    for (const button of [friends!, machines!, bots!]) {
+      await user.click(button)
+      button.focus()
+      await user.keyboard("{Enter}")
+    }
+    expect(onShowFriends).toHaveBeenCalledTimes(2)
+    expect(onShowMachines).toHaveBeenCalledTimes(2)
+    expect(onShowBots).toHaveBeenCalledTimes(2)
+
   })
 
-  it("prefetches the intended DM without selecting it", () => {
-    const onPrefetchDm = vi.fn()
+  it("selects the intended DM only on click or Enter", async () => {
     const onPickDm = vi.fn()
     const renderer = render(createElement(DmSidebar, {
       dms: [{
@@ -99,15 +99,21 @@ describe("DmSidebar navigation intent", () => {
       }],
       activeDm: null,
       onPickDm,
-      onPrefetchDm,
       onShowFriends: vi.fn(),
     }))
 
     fireEvent.focus(renderer.getByTestId(tid.dmRow("dm_1")))
 
-    expect(onPrefetchDm).toHaveBeenCalledWith("dm_1")
+    fireEvent.pointerEnter(renderer.getByTestId(tid.dmRow("dm_1")))
     expect(onPickDm).not.toHaveBeenCalled()
 
+    const user = setupUser()
+    const button = renderer.getByTestId(tid.dmRow("dm_1"))
+    await user.click(button)
+    button.focus()
+    await user.keyboard("{Enter}")
+    expect(onPickDm.mock.calls).toEqual([["dm_1"], ["dm_1"]])
+
   })
 
   it("uses the active row shape without a duplicate unread dot", () => {
```

**File**: `src/web/src/components/community/channels/dm-sidebar.tsx` (modified, +0/-13)
```diff
@@ -11,7 +11,6 @@ import { compactRequestCount } from "@/lib/community/friend-requests"
 
 export const DmSidebar = memo(function DmSidebar({
   dms, activeDm, blockedUserIds, loading, onPickDm, onShowFriends, onShowMachines, onShowBots,
-  onPrefetchDm, onPrefetchFriends, onPrefetchMachines, onPrefetchBots,
   friendsActive, machinesActive, botsActive,
   friendRequestCount = 0,
 }: {
@@ -20,13 +19,9 @@ export const DmSidebar = memo(function DmSidebar({
   blockedUserIds?: Set<string>
   loading?: boolean
   onPickDm: (id: string) => void
-  onPrefetchDm?: (id: string) => void
   onShowFriends: () => void
-  onPrefetchFriends?: () => void
   onShowMachines?: () => void
-  onPrefetchMachines?: () => void
   onShowBots?: () => void
-  onPrefetchBots?: () => void
   friendsActive?: boolean
   friendRequestCount?: number
   machinesActive?: boolean
@@ -40,8 +35,6 @@ export const DmSidebar = memo(function DmSidebar({
         <button
           aria-label={requestCount ? `Friends, ${friendRequestCount} new requests` : "Friends"}
           onClick={onShowFriends}
-          onPointerEnter={onPrefetchFriends}
-          onFocus={onPrefetchFriends}
           className={[
             "mb-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-medium",
             isFriendsActive ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
@@ -61,8 +54,6 @@ export const DmSidebar = memo(function DmSidebar({
           <button
             data-testid={tid.machineGuideIntroSource}
             onClick={onShowMachines}
-            onPointerEnter={onPrefetchMachines}
-            onFocus={onPrefetchMachines}
             className={[
               "mb-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-medium",
               machinesActive ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
@@ -74,8 +65,6 @@ export const DmSidebar = memo(function DmSidebar({
         {onShowBots && (
           <button
             onClick={onShowBots}
-            onPointerEnter={onPrefetchBots}
-            onFocus={onPrefetchBots}
             className={[
               "mb-2 flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-medium",
               botsActive ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
@@ -108,8 +97,6 @@ export const DmSidebar = memo(function DmSidebar({
               key={d.id}
               data-testid={tid.dmRow(d.id)}
               onClick={() => onPickDm(d.id)}
-              onPointerEnter={() => onPrefetchDm?.(d.id)}
-              onFocus={() => onPrefetchDm?.(d.id)}
               className={[
                 "flex w-full items-center gap-3 rounded-md px-2 py-2",
                 active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
```

**File**: `src/web/src/components/community/channels/sortable-channel.tsx` (modified, +1/-4)
```diff
@@ -38,11 +38,10 @@ export function PendingChannelRow({ ch }: { ch: Channel }) {
 // A single drag-sortable channel row. The whole row is the drag surface (no handle);
 // mouse movement or a touch long-press distinguishes navigation from reorder.
 // Right-click opens an edit/mute/delete menu.
-export function SortableChannel({ ch, active, onClick, onPrefetch, onEdit, onDelete, onManageMembers, canReorder = true }: {
+export function SortableChannel({ ch, active, onClick, onEdit, onDelete, onManageMembers, canReorder = true }: {
   ch: Channel
   active: boolean
   onClick: () => void
-  onPrefetch?: () => void
   onEdit?: () => void
   onDelete?: () => void
   onManageMembers?: () => void
@@ -63,8 +62,6 @@ export function SortableChannel({ ch, active, onClick, onPrefetch, onEdit, onDel
       ref={setNodeRef}
       style={style}
       onClick={onClick}
-      onPointerEnter={onPrefetch}
-      onFocus={onPrefetch}
       data-testid={tid.channelRow(ch.id)}
       {...attributes}
       {...listeners}
```

---

### Incident Patch 12: `2aa3c25c` (2026-10-01)
**Commit Message**: test(ci): give real Windows updater verifier a bounded suite timeout (#856)

**File**: `scripts/ci/desktop-release-artifacts.test.ts` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ function verifyWindowsStage(fixture: Awaited<ReturnType<typeof createAllStages>>
   ], { encoding: "utf8", timeout: 30_000 })
 }
 
-describe.skipIf(!hasPowerShell)("actual Windows staged installer verifier (requires pwsh)", () => {
+describe.skipIf(!hasPowerShell)("actual Windows staged installer verifier (requires pwsh)", { timeout: 35_000 }, () => {
   it("accepts both installers with valid updater signatures and no Authenticode signatures", async () => {
     const result = verifyWindowsStage(await createAllStages())
     expect(result.error).toBeUndefined()
```

---

### Incident Patch 13: `18177178` (2026-09-30)
**Commit Message**: fix(web): correct profile scrolling and fullscreen thread back (#855)

**File**: `src/web/src/components/community/channels/channel-header.skeleton.test.ts` (modified, +9/-0)
```diff
@@ -5,6 +5,15 @@ import { tid } from "@/lib/community/testids"
 import { ChannelHeaderSkeleton } from "./channel-header"
 
 describe("ChannelHeaderSkeleton", () => {
+  it.each([false, true])("matches the thread Back footprint on desktop in compact mode %s", (compactActions) => {
+    const html = renderToStaticMarkup(createElement(ChannelHeaderSkeleton, { kind: "thread", compactActions }))
+    const leadingClasses = html.match(/data-slot="loading-mobile-leading"[^>]*class="([^"]*)"/)?.[1]
+
+    expect(leadingClasses).toContain("size-11")
+    expect(leadingClasses?.includes("sm:hidden")).toBe(compactActions)
+    expect(html).not.toContain("<button")
+  })
+
   it("renders inert mobile Back geometry without interaction", () => {
     const html = renderToStaticMarkup(createElement(ChannelHeaderSkeleton))
 
```

**File**: `src/web/src/components/community/channels/channel-header.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function ChannelHeaderSkeleton({
           data-testid={tid.messageHeaderLeadingLoading}
           data-slot="loading-mobile-leading"
           aria-hidden
-          className="grid size-11 shrink-0 place-items-center sm:hidden"
+          className={`grid size-11 shrink-0 place-items-center ${kind === "thread" && !compactActions ? "" : "sm:hidden"}`}
         >
           <Skeleton className="size-6 rounded-md" />
         </div>
```

**File**: `src/web/src/components/community/channels/thread-channel-surface.dom.test.ts` (modified, +25/-0)
```diff
@@ -248,6 +248,31 @@ describe("ThreadChannelSurface ownership", () => {
     vi.clearAllMocks()
   })
 
+  it.each([
+    { parentIsForum: false },
+    { parentIsForum: true },
+  ])("renders one Back control on desktop and returns to the parent for %o", async (overrides) => {
+    const { ChannelHeader: RealChannelHeader } = await vi.importActual<typeof import("./channel-header")>("./channel-header")
+    mockedChannelHeader.mockImplementationOnce(RealChannelHeader)
+    const onNavigateParent = vi.fn()
+    const view = render(renderSurface({ ...overrides, onNavigateParent }))
+
+    const back = view.getByRole("button", { name: "Back" })
+    expect(view.getAllByRole("button", { name: "Back" })).toHaveLength(1)
+    expect(back).toHaveClass("size-11")
+    expect(back).not.toHaveClass("sm:hidden")
+    fireEvent.click(back)
+    expect(onNavigateParent).toHaveBeenCalledOnce()
+  })
+
+  it("omits Back in the split thread header", async () => {
+    const { ChannelHeader: RealChannelHeader } = await vi.importActual<typeof import("./channel-header")>("./channel-header")
+    mockedChannelHeader.mockImplementationOnce(RealChannelHeader)
+    const view = render(renderSurface({ splitActions: { onFullscreen: vi.fn(), onClose: vi.fn() } }))
+
+    expect(view.queryByRole("button", { name: "Back" })).toBeNull()
+  })
+
   it("owns the child feed and preserves opener, message-list, and composer wiring", () => {
     const props = surfaceProps()
 
```

**File**: `src/web/src/components/community/channels/thread-channel-surface.tsx` (modified, +2/-1)
```diff
@@ -216,7 +216,8 @@ export function ThreadChannelSurface({
               onToggle={togglePanel}
               notifLevel={notificationLevel}
               onSetNotifLevel={onSetNotificationLevel}
-              mobileBack={onNavigateParent}
+              mobileBack={splitActions ? undefined : onNavigateParent}
+              mobileBackDisplay="always"
               tools={{ threads: false }}
               titleRename={parentIsForum}
               onRename={parentChannelId && !splitActions ? rename : undefined}
```

**File**: `src/web/src/components/community/shell/shell-frame-view.tsx` (modified, +1/-0)
```diff
@@ -90,6 +90,7 @@ export function ShellFrameView({
     <ProfileRunningBotsCard
       onOpenBotAudit={profile.openBotAudit}
       useBackdropEffect={breakpoint !== "mobile"}
+      showShadow={breakpoint !== "mobile"}
     />
   ) : null
 
```

**File**: `src/web/src/components/community/shell/user-bar-extension-slot.dom.test.tsx` (modified, +8/-5)
```diff
@@ -34,7 +34,7 @@ const machines = [{
 }]
 
 describe("UserBarExtensionSlot", () => {
-  it("uses a real bounded mobile scroll container without shrinking either profile card", () => {
+  it("keeps the mobile primary card framed and gives only the companion the shrink budget", () => {
     const renderer = render(createElement(UserBarExtensionSlot, {
       active: "profile",
       profile: createElement("div", { "data-testid": "profile-content" }, "Profile"),
@@ -55,13 +55,16 @@ describe("UserBarExtensionSlot", () => {
     expect(slot.className).not.toContain("border-x")
     expect(slot.className).not.toContain("border-t")
     expect(scroller?.className).toContain("min-h-0")
-    expect(scroller?.className).toContain("overflow-y-auto")
+    expect(scroller?.className).not.toContain("overflow-y-auto")
     expect(scroller?.style.maxHeight).toContain("100dvh")
     expect(renderer.getByTestId("profile-content").parentElement?.className).toContain("shrink-0")
+    expect(renderer.getByTestId("profile-content").parentElement?.className).toContain("bg-popover")
+    expect(renderer.getByTestId("profile-content").parentElement?.className).toContain("rounded-xl")
+    expect(renderer.getByTestId("profile-content").parentElement?.className).not.toContain("shadow-")
     const companionSurface = renderer.getByTestId("profile-companion").parentElement
-    expect(companionSurface?.className).toContain("shrink-0")
-    expect(companionSurface?.className).toContain("-mx-2")
-    expect(companionSurface?.className).toContain("mb-2")
+    expect(companionSurface?.className).toContain("min-h-0")
+    expect(companionSurface?.className).toContain("flex-col")
+    expect(companionSurface?.className).not.toContain("shrink-0")
   })
 
   it("disables dismissal and focus while retained for the closing animation", async () => {
```

**File**: `src/web/src/components/community/shell/user-bar-extension-slot.tsx` (modified, +3/-3)
```diff
@@ -127,11 +127,11 @@ export function UserBarExtensionSlot({
       {active === "inbox" && inbox}
       {active === "profile" && (
         <div
-          className="flex min-h-0 flex-col gap-2 overflow-y-auto p-2 thin-scrollbar"
+          className={cn("flex min-h-0 flex-col gap-2", unframedMobileProfile ? "p-0" : "p-2")}
           style={{ maxHeight: boundedHeight }}
         >
-          {profileCompanion && <div className="-mx-2 mb-2 shrink-0">{profileCompanion}</div>}
-          <div className="shrink-0">{profile}</div>
+          {profileCompanion && <div className="flex min-h-0 flex-col">{profileCompanion}</div>}
+          <div className={cn("shrink-0", unframedMobileProfile && "overflow-hidden rounded-xl border border-border bg-popover p-2")}>{profile}</div>
         </div>
       )}
       {active === "update" && update && (
```

**File**: `src/web/src/components/community/shell/user-bar.test.ts` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ describe("UserBar", () => {
     expect(running).toContain(`data-testid="${tid.userBarRunningBotsGlow}"`)
     expect(running).toContain('aria-label="Open profile. 2 running bots."')
     expect(running).toContain("relative grid size-7 place-items-center rounded-full")
-    expect(running).toContain("pointer-events-none absolute -inset-0.5")
+    expect(running).toContain("pointer-events-none absolute -inset-px")
     expect(running).toContain("focus-visible:ring-offset-4")
     expect(running).toContain("focus-visible:ring-offset-muted")
     expect(running).toContain("var(--primary)")
```

---

### Incident Patch 14: `bec00c1c` (2026-09-30)
**Commit Message**: fix(release): restore configured desktop signing requirements (#853)

**File**: `.github/workflows/desktop-release.yml` (modified, +7/-77)
```diff
@@ -84,7 +84,7 @@ jobs:
           TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
         run: |
           set -euo pipefail
-          for name in APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_SIGNING_IDENTITY APPLE_TEAM_ID APPLE_API_ISSUER APPLE_API_KEY APPLE_API_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD; do
+          for name in APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_SIGNING_IDENTITY APPLE_TEAM_ID APPLE_API_ISSUER APPLE_API_KEY APPLE_API_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY; do
             test -n "${!name}" || { echo "::error::Missing required macOS release input: $name"; exit 1; }
           done
           [[ "$APPLE_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]
@@ -214,7 +214,6 @@ jobs:
     timeout-minutes: 45
     permissions:
       contents: read
-      id-token: write
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
 
@@ -251,74 +250,21 @@ jobs:
       - name: Preflight Windows release inputs
         shell: pwsh
         env:
-          AZURE_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}
-          AZURE_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}
-          AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
-          ALOOK_ARTIFACT_SIGNING_ENDPOINT: ${{ vars.AZURE_ARTIFACT_SIGNING_ENDPOINT }}
-          ALOOK_ARTIFACT_SIGNING_ACCOUNT_NAME: ${{ vars.AZURE_ARTIFACT_SIGNING_ACCOUNT_NAME }}
-          ALOOK_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME: ${{ vars.AZURE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME }}
-          ALOOK_WINDOWS_SIGNING_PUBLISHER: ${{ vars.WINDOWS_SIGNING_PUBLISHER }}
           TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
           TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
         run: |
-          $required = @(
-            "AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID",
-            "ALOOK_ARTIFACT_SIGNING_ENDPOINT", "ALOOK_ARTIFACT_SIGNING_ACCOUNT_NAME",
-            "ALOOK_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME", "ALOOK_WINDOWS_SIGNING_PUBLISHER",
-            "TAURI_SIGNING_PRIVATE_KEY", "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
-          )
-          foreach ($name in $required) {
-            if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
-              throw "Missing required Windows release input: $name"
-            }
+          if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
+            throw "Missing required Windows release input: TAURI_SIGNING_PRIVATE_KEY"
           }
-          [Uri]$endpoint = $null
-          if (-not [Uri]::TryCreate($env:ALOOK_ARTIFACT_SIGNING_ENDPOINT, [UriKind]::Absolute, [ref]$endpoint) -or
-              $endpoint.Scheme -ne [Uri]::UriSchemeHttps -or
-              $endpoint.DnsSafeHost -notmatch '^[a-z0-9-]+\.codesigning\.azure\.net$' -or
-              -not $endpoint.IsDefaultPort -or
-              $endpoint.AbsolutePath -ne '/' -or
-              $endpoint.UserInfo -ne '' -or
-              $endpoint.Query -ne '' -or
-              $endpoint.Fragment -ne '') {
-            throw "Artifact Signing endpoint must be an HTTPS regional codesigning.azure.net root URL"
-          }
-
-      - name: Login to Azure with GitHub OIDC
-        uses: azure/login@a641126d1b8aa4d1fa005f4f92df94a3a4c4c906 # v3.1.0
-        with:
-          client-id: ${{ vars.AZURE_CLIENT_ID }}
-          tenant-id: ${{ vars.AZURE_TENANT_ID }}
-          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
 
-      - name: Prepare digest-verified Artifact Signing module
-        shell: pwsh
-        run: |
-          $destination = Join-Path $env:RUNNER_TEMP "alook-artifact-signing-$env:GITHUB_RUN_ID-$env:GITHUB_RUN_ATTEMPT"
-          "ALOOK_ARTIFACT_SIGNING_ROOT=$destination" | Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8
-          ./scripts/ci/prepare-desktop-windows-signing.ps1 -DestinationRoot $destination
-
-      - name: Prepare canonical Tauri signing root
-        shell: pwsh
-        run: |
-          $root = [IO.Path]::GetFullPath((Join-Path $env:GITHUB_WORKSPACE "src\desktop\src-tauri\target\x86_64-pc-windows-msvc\release"))
-          $temp = Join-Path $root "tauri-sign-temp"
-          New-Item -Path $temp -ItemType Directory -Force | Out-Null
-          "ALOOK_WINDOWS_SIGNING_ROOT=$root" | Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8
-          "TEMP=$temp" | Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8
-          "TMP=$temp" | Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8
-
-      - name: Build signed Windows app
+      - name: Build Windows app
         uses: tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f # v1.0.0
         env:
           TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
           TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
-          ALOOK_ARTI
```

**File**: `scripts/ci/desktop-release-artifacts.test.ts` (modified, +62/-1)
```diff
@@ -1,7 +1,8 @@
+import { spawnSync } from "node:child_process"
 import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto"
 import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
 import { tmpdir } from "node:os"
-import { dirname, join } from "node:path"
+import { dirname, join, resolve } from "node:path"
 import { pathToFileURL } from "node:url"
 import { afterEach, describe, expect, it } from "vitest"
 
@@ -79,6 +80,66 @@ afterEach(() => {
   for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true })
 })
 
+const hasPowerShell = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-Command", "exit 0"], {
+  timeout: 10_000,
+}).status === 0
+
+function verifyWindowsStage(fixture: Awaited<ReturnType<typeof createAllStages>>) {
+  return spawnSync("pwsh", [
+    "-NoLogo", "-NoProfile", "-NonInteractive", "-File",
+    resolve(import.meta.dirname, "verify-desktop-windows.ps1"),
+    "-StageDirectory", join(fixture.stages, "desktop-release-windows-x86_64"),
+    "-ExpectedVersion", version,
+    "-TauriConfigPath", fixture.configPath,
+  ], { encoding: "utf8", timeout: 30_000 })
+}
+
+describe.skipIf(!hasPowerShell)("actual Windows staged installer verifier (requires pwsh)", () => {
+  it("accepts both installers with valid updater signatures and no Authenticode signatures", async () => {
+    const result = verifyWindowsStage(await createAllStages())
+    expect(result.error).toBeUndefined()
+    expect(result.status, result.stdout + result.stderr).toBe(0)
+    expect(result.stdout).toContain("not Authenticode code-signed")
+  })
+
+  it.each(["x64-setup.exe", "x64_en-US.msi"])("rejects tampered %s even if its manifest digest was updated", async suffix => {
+    const fixture = await createAllStages()
+    const stage = join(fixture.stages, "desktop-release-windows-x86_64")
+    const name = `Alook_${version}_${suffix}`
+    const data = Buffer.from("tampered installer bytes")
+    writeFileSync(join(stage, "files", name), data)
+    const path = join(stage, "manifest.json")
+    const manifest = JSON.parse(readFileSync(path, "utf8"))
+    const file = manifest.files.find((entry: { name: string }) => entry.name === name)
+    file.size = data.length
+    file.sha256 = createHash("sha256").update(data).digest("hex")
+    writeFileSync(path, JSON.stringify(manifest))
+    const result = verifyWindowsStage(fixture)
+    expect(result.error).toBeUndefined()
+    expect(result.status).not.toBe(0)
+    expect(result.stdout + result.stderr).toContain("Invalid Minisign file signature")
+  })
+
+  it("rejects a different updater public key", async () => {
+    const fixture = await createAllStages()
+    const signer = createSigningFixture()
+    writeFileSync(fixture.configPath, JSON.stringify({ plugins: { updater: { pubkey: signer.encodedPublicKey } } }))
+    const result = verifyWindowsStage(fixture)
+    expect(result.error).toBeUndefined()
+    expect(result.status).not.toBe(0)
+    expect(result.stdout + result.stderr).toContain("key id does not match")
+  })
+
+  it("rejects an absent installer signature before publication", async () => {
+    const fixture = await createAllStages()
+    rmSync(join(fixture.stages, "desktop-release-windows-x86_64", "files", `Alook_${version}_x64-setup.exe.sig`))
+    const result = verifyWindowsStage(fixture)
+    expect(result.error).toBeUndefined()
+    expect(result.status).not.toBe(0)
+    expect(result.stdout + result.stderr).toContain("files directory contains an unexpected entry")
+  })
+})
+
 describe("desktop release artifact staging", () => {
   it("rejects unsupported target metadata and source path escapes", () => {
     expect(() => targetSpec("linux-x86_64", "v1.2.3")).toThrow("numeric semver")
```

**File**: `scripts/ci/desktop-release-inputs.test.ts` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import { spawnSync } from "node:child_process"
+import { readFileSync } from "node:fs"
+import { resolve } from "node:path"
+import { describe, expect, it } from "vitest"
+
+const workflow = readFileSync(
+  resolve(import.meta.dirname, "../../.github/workflows/desktop-release.yml"),
+  "utf8",
+).replace(/\r\n/g, "\n")
+
+function preflight(step: string, boundary?: string): string {
+  const start = workflow.indexOf(`      - name: ${step}\n`)
+  const end = workflow.indexOf("      - name:", start + 1)
+  const body = workflow.slice(start, end).split("        run: |\n")[1]
+  const stop = boundary ? body?.indexOf(boundary) ?? -1 : body?.length ?? -1
+  if (start < 0 || stop < 0) throw new Error(`Missing safe preflight boundary: ${step}`)
+  return body.slice(0, stop).replace(/^          /gm, "")
+}
+
+const macScript = preflight("Prepare fail-closed macOS signing", "          umask 077")
+const windowsScript = preflight("Preflight Windows release inputs")
+const shellEnvironment = {
+  PATH: process.env.PATH,
+  SystemRoot: process.env.SystemRoot,
+  TEMP: process.env.TEMP,
+  TMP: process.env.TMP,
+}
+const macInputs: Record<string, string> = {
+  APPLE_CERTIFICATE: "offline-certificate",
+  APPLE_CERTIFICATE_PASSWORD: "offline-password",
+  APPLE_SIGNING_IDENTITY: "Developer ID Application: Offline Test (AAAAAAAAAA)",
+  APPLE_TEAM_ID: "AAAAAAAAAA",
+  APPLE_API_ISSUER: "offline-issuer",
+  APPLE_API_KEY: "offline-api-key",
+  APPLE_API_PRIVATE_KEY: "offline-api-private-key",
+  TAURI_SIGNING_PRIVATE_KEY: "offline-updater-private-key",
+  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
+}
+const windowsInputs: Record<string, string> = {
+  TAURI_SIGNING_PRIVATE_KEY: "offline-updater-private-key",
+  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
+}
+
+function run(shell: "bash" | "pwsh", script: string, inputs: Record<string, string>) {
+  const args = shell === "bash"
+    ? ["-c", script]
+    : ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script]
+  const result = spawnSync(shell, args, {
+    encoding: "utf8",
+    env: { ...shellEnvironment, ...inputs },
+    timeout: 10_000,
+  })
+  if (result.error) throw result.error
+  return { status: result.status, output: result.stdout + result.stderr }
+}
+
+describe("macOS actual release preflight", () => {
+  it.each(["", "offline-encrypted-key-password"])("accepts updater password %j", password => {
+    expect(run("bash", macScript, { ...macInputs, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password }).status).toBe(0)
+  })
+
+  it.each(["TAURI_SIGNING_PRIVATE_KEY", "APPLE_CERTIFICATE", "APPLE_API_PRIVATE_KEY"])(
+    "rejects missing required %s even with an empty updater password",
+    name => {
+      const inputs = { ...macInputs, [name]: "" }
+      const result = run("bash", macScript, inputs)
+      expect(result.status).not.toBe(0)
+      expect(result.output).toContain(`Missing required macOS release input: ${name}`)
+    },
+  )
+})
+
+const hasPowerShell = spawnSync("pwsh", ["-NoLogo", "-NoProfile", "-Command", "exit 0"], {
+  timeout: 10_000,
+}).status === 0
+
+describe.skipIf(!hasPowerShell)("Windows actual release preflight (requires pwsh)", () => {
+  it.each(["", "offline-encrypted-key-password"])("accepts updater password %j", password => {
+    expect(run("pwsh", windowsScript, { ...windowsInputs, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password }).status).toBe(0)
+  })
+
+  it.each(["TAURI_SIGNING_PRIVATE_KEY"])(
+    "rejects missing required %s even with an empty updater password",
+    name => {
+      const inputs = { ...windowsInputs, [name]: "" }
+      const result = run("pwsh", windowsScript, inputs)
+      expect(result.status).not.toBe(0)
+      expect(result.output).toContain(`Missing required Windows release input: ${name}`)
+    },
+  )
+})
```

**File**: `scripts/ci/desktop-signing-dependencies.json` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-{
-  "schemaVersion": 1,
-  "packages": [
-    {
-      "name": "ArtifactSigning",
-      "version": "0.1.8",
-      "source": "https://www.powershellgallery.com/api/v2/package/ArtifactSigning/0.1.8",
-      "sha256": "3221344b8c627915d3870f23e80816f31a5d8c2bae1d7c0cdd6c9652f6c4e089",
-      "kind": "module"
-    },
-    {
-      "name": "Microsoft.Windows.SDK.BuildTools",
-      "version": "10.0.26100.4188",
-      "source": "https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/10.0.26100.4188/microsoft.windows.sdk.buildtools.10.0.26100.4188.nupkg",
-      "sha256": "180deb372659029864c10a0c04787833234d64aacd1d2c0661d2c00295d8e022",
-      "kind": "dependency"
-    },
-    {
-      "name": "Microsoft.ArtifactSigning.Client",
-      "version": "1.0.128",
-      "source": "https://api.nuget.org/v3-flatcontainer/microsoft.artifactsigning.client/1.0.128/microsoft.artifactsigning.client.1.0.128.nupkg",
-      "sha256": "74bd7d27e6ce1051409c38d9b46bc8df0400ecd643d51ffbf2ac00869061e40b",
-      "kind": "dependency"
-    },
-    {
-      "name": "sign",
-      "version": "0.9.1-beta.26227.3",
-      "source": "https://api.nuget.org/v3-flatcontainer/sign/0.9.1-beta.26227.3/sign.0.9.1-beta.26227.3.nupkg",
-      "sha256": "34fd0d4aeabdbc363a48883881865b4dd65e6c11ba916028082fa23f3e1b1ba1",
-      "kind": "dependency"
-    }
-  ]
-}
```

**File**: `scripts/ci/prepare-desktop-windows-signing.ps1` (removed, +0/-113)
```diff
@@ -1,113 +0,0 @@
-[CmdletBinding()]
-param(
-    [Parameter()]
-    [string]$ManifestPath = (Join-Path $PSScriptRoot "desktop-signing-dependencies.json"),
-
-    [Parameter(Mandatory)]
-    [string]$DestinationRoot
-)
-
-Set-StrictMode -Version Latest
-$ErrorActionPreference = "Stop"
-
-$expectedPackages = @{
-    "ArtifactSigning" = "0.1.8"
-    "Microsoft.Windows.SDK.BuildTools" = "10.0.26100.4188"
-    "Microsoft.ArtifactSigning.Client" = "1.0.128"
-    "sign" = "0.9.1-beta.26227.3"
-}
-
-$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
-if ($manifest.schemaVersion -ne 1) {
-    throw "Unsupported signing dependency manifest schema: $($manifest.schemaVersion)"
-}
-if ($manifest.packages.Count -ne $expectedPackages.Count) {
-    throw "Signing dependency manifest must contain exactly $($expectedPackages.Count) packages"
-}
-
-$seen = @{}
-foreach ($package in $manifest.packages) {
-    if (-not $expectedPackages.ContainsKey($package.name)) {
-        throw "Unexpected signing dependency: $($package.name)"
-    }
-    if ($seen.ContainsKey($package.name)) {
-        throw "Duplicate signing dependency: $($package.name)"
-    }
-    $seen[$package.name] = $true
-    if ($package.version -ne $expectedPackages[$package.name]) {
-        throw "Unexpected version for $($package.name): $($package.version)"
-    }
-    if ($package.source -notmatch '^https://(www\.powershellgallery\.com|api\.nuget\.org)/') {
-        throw "Unapproved package source for $($package.name)"
-    }
-    if ($package.sha256 -notmatch '^[0-9a-f]{64}$') {
-        throw "Invalid SHA-256 for $($package.name)"
-    }
-}
-
-$destination = [IO.Path]::GetFullPath($DestinationRoot)
-if (Test-Path -LiteralPath $destination) {
-    throw "Signing dependency destination must be fresh: $destination"
-}
-
-$packagesRoot = Join-Path $destination "packages"
-$moduleRoot = Join-Path $destination "modules\ArtifactSigning\0.1.8"
-$localAppData = Join-Path $destination "localappdata"
-New-Item -Path $packagesRoot -ItemType Directory | Out-Null
-New-Item -Path $moduleRoot -ItemType Directory | Out-Null
-New-Item -Path $localAppData -ItemType Directory | Out-Null
-
-Add-Type -AssemblyName System.IO.Compression.FileSystem
-
-foreach ($package in $manifest.packages) {
-    $archive = Join-Path $packagesRoot "$($package.name).$($package.version).nupkg"
-    & curl.exe --fail --location --silent --show-error `
-        --proto '=https' --tlsv1.2 `
-        --connect-timeout 15 --max-time 600 `
-        --retry 3 --retry-delay 2 --retry-all-errors `
-        --output $archive $package.source
-    if ($LASTEXITCODE -ne 0) {
-        throw "Official package download failed for $($package.name) after bounded retries"
-    }
-
-    $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
-    if ($actualHash -ne $package.sha256) {
-        throw "SHA-256 mismatch for $($package.name): expected $($package.sha256), got $actualHash"
-    }
-
-    if ($package.kind -eq "module") {
-        $extractPath = $moduleRoot
-    } else {
-        $packageVersionsPath = Join-Path $localAppData "ArtifactSigning\$($package.name)"
-        $extractPath = Join-Path $packageVersionsPath "$($package.name).$($package.version)"
-        New-Item -Path $packageVersionsPath -ItemType Directory -Force | Out-Null
-    }
-
-    [IO.Compression.ZipFile]::ExtractToDirectory($archive, $extractPath)
-}
-
-$modulePath = Join-Path $moduleRoot "ArtifactSigning.psd1"
-if (-not (Test-Path -LiteralPath $modulePath -PathType Leaf)) {
-    throw "ArtifactSigning module was not extracted to the expected path"
-}
-
-$requiredContent = @(
-    (Join-Path $localAppData "ArtifactSigning\Microsoft.Windows.SDK.BuildTools\Microsoft.Windows.SDK.BuildTools.10.0.26100.4188\bin\10.0.26100.0\x64\signtool.exe"),
-    (Join-Path $localAppData "ArtifactSigning\Microsoft.ArtifactSigning.Client\Microsoft.ArtifactSigning.Client.1.0.128\bin\x64\Azure.CodeSigning.Dlib.dll"),
-    (Join-Path $localAppData "ArtifactSigning\sign\sign.0.9.1-beta.26227.3\tools\net8.0\any\sign.dll")
-)
-foreach ($requiredPath in $requiredContent) {
-    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
-        throw "Signing dependency is missing expected content: $requiredPath"
-    }
-}
-
-if (-not $env:GITHUB_ENV) {
-    throw "GITHUB_ENV is required so Tauri's child signing commands inherit the verified paths"
-}
-
-"LOCALAPPDATA=$localAppData" | Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8
-"ALOOK_ARTIFACT_SIGNING_MODULE_PATH=$modulePath" | Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8
-"PSModulePath=$(Split-Path $moduleRoot -Parent);$env:PSModulePath" | Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8
-
-Write-Host "Prepared four digest-verified signing packages in a fresh runner-temporary directory."
```

**File**: `scripts/ci/sign-desktop-windows.ps1` (removed, +0/-92)
```diff
@@ -1,92 +0,0 @@
-[CmdletBinding()]
-param(
-    [Parameter(Mandatory, Position = 0)]
-    [string]$FilePath
-)
-
-Set-StrictMode -Version Latest
-$ErrorActionPreference = "Stop"
-
-$requiredEnvironment = @(
-    "ALOOK_WINDOWS_SIGNING_ROOT",
-    "ALOOK_ARTIFACT_SIGNING_MODULE_PATH",
-    "ALOOK_ARTIFACT_SIGNING_ENDPOINT",
-    "ALOOK_ARTIFACT_SIGNING_ACCOUNT_NAME",
-    "ALOOK_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME"
-)
-foreach ($name in $requiredEnvironment) {
-    $value = [Environment]::GetEnvironmentVariable($name)
-    if ([string]::IsNullOrWhiteSpace($value)) {
-        throw "Required signing environment variable is missing: $name"
-    }
-}
-
-[Uri]$endpoint = $null
-if (-not [Uri]::TryCreate($env:ALOOK_ARTIFACT_SIGNING_ENDPOINT, [UriKind]::Absolute, [ref]$endpoint) -or
-    $endpoint.Scheme -ne [Uri]::UriSchemeHttps -or
-    $endpoint.DnsSafeHost -notmatch '^[a-z0-9-]+\.codesigning\.azure\.net$' -or
-    -not $endpoint.IsDefaultPort -or
-    $endpoint.AbsolutePath -ne '/' -or
-    $endpoint.UserInfo -ne '' -or
-    $endpoint.Query -ne '' -or
-    $endpoint.Fragment -ne '') {
-    throw "Artifact Signing endpoint must be an HTTPS regional codesigning.azure.net root URL"
-}
-
-$root = (Resolve-Path -LiteralPath $env:ALOOK_WINDOWS_SIGNING_ROOT).Path.TrimEnd('\', '/')
-$resolved = (Resolve-Path -LiteralPath $FilePath).Path
-$item = Get-Item -LiteralPath $resolved
-if (-not $item.PSIsContainer -and $item.LinkType -eq $null) {
-    $relative = [IO.Path]::GetRelativePath($root, $resolved)
-} else {
-    throw "Tauri signCommand accepts exactly one regular file"
-}
-
-if ([IO.Path]::IsPathRooted($relative) -or $relative -eq ".." -or $relative.StartsWith("..$([IO.Path]::DirectorySeparatorChar)")) {
-    throw "Refusing to sign a path outside the expected Tauri release root: $resolved"
-}
-
-$normalized = $relative.Replace('/', '\')
-# NSIS !uninstfinalize writes the generated uninstaller beneath %TEMP%\~nsu.tmp.
-$allowed = @(
-    '^alook-desktop\.exe$',
-    '^bundle\\msi\\Alook_[0-9]+\.[0-9]+\.[0-9]+_x64_en-US\.msi$',
-    '^bundle\\nsis\\Alook_[0-9]+\.[0-9]+\.[0-9]+_x64-setup\.exe$',
-    '^wix\\x64\\wix\\Wix(?:UI|Util)Extension\.dll$',
-    '^nsis\\x64\\Plugins\\x86-unicode\\(?:NSISdl|StartMenu|System|nsDialogs)\.dll$',
-    '^nsis\\x64\\Plugins\\x86-unicode\\additional\\nsis_tauri_utils\.dll$',
-    '^tauri-sign-temp\\~nsu\.tmp\\Un_[A-Za-z0-9]+\.exe$'
-)
-if (-not ($allowed | Where-Object { $normalized -match $_ })) {
-    throw "Refusing unexpected Tauri signing path: $relative"
-}
-
-$modulePath = (Resolve-Path -LiteralPath $env:ALOOK_ARTIFACT_SIGNING_MODULE_PATH).Path
-Import-Module $modulePath -Force
-
-$signingParameters = @{
-    Endpoint = $env:ALOOK_ARTIFACT_SIGNING_ENDPOINT
-    CodeSigningAccountName = $env:ALOOK_ARTIFACT_SIGNING_ACCOUNT_NAME
-    CertificateProfileName = $env:ALOOK_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME
-    Files = $resolved
-    FileDigest = "SHA256"
-    TimestampRfc3161 = "http://timestamp.acs.microsoft.com"
-    TimestampDigest = "SHA256"
-    ExcludeEnvironmentCredential = $true
-    ExcludeWorkloadIdentityCredential = $true
-    ExcludeManagedIdentityCredential = $true
-    ExcludeSharedTokenCacheCredential = $true
-    ExcludeVisualStudioCredential = $true
-    ExcludeVisualStudioCodeCredential = $true
-    ExcludeAzureCliCredential = $false
-    ExcludeAzurePowerShellCredential = $true
-    ExcludeAzureDeveloperCliCredential = $true
-    ExcludeInteractiveBrowserCredential = $true
-}
-
-Invoke-ArtifactSigning @signingParameters
-
-$signature = Get-AuthenticodeSignature -LiteralPath $resolved
-if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
-    throw "Artifact Signing returned without a valid Authenticode signature: $relative ($($signature.Status))"
-}
```

**File**: `scripts/ci/verify-desktop-windows.ps1` (modified, +1/-58)
```diff
@@ -6,9 +6,6 @@ param(
     [Parameter(Mandatory)]
     [string]$ExpectedVersion,
 
-    [Parameter(Mandatory)]
-    [string]$ExpectedPublisher,
-
     [Parameter(Mandatory)]
     [string]$TauriConfigPath
 )
@@ -26,66 +23,12 @@ if ($LASTEXITCODE -ne 0) { throw "Windows staged artifact manifest validation fa
 $msi = Join-Path $stage "files\Alook_${ExpectedVersion}_x64_en-US.msi"
 $nsis = Join-Path $stage "files\Alook_${ExpectedVersion}_x64-setup.exe"
 
-function Assert-Authenticode {
-    param(
-        [Parameter(Mandatory)]
-        [string]$Path,
-
-        [Parameter(Mandatory)]
-        [string]$Label
-    )
-
-    $output = & signtool.exe verify /pa /all /v $Path 2>&1 | Out-String
-    if ($LASTEXITCODE -ne 0) { throw "signtool rejected $Label`n$output" }
-    if ($output -notmatch '(?im)^Hash of file \(sha256\): [0-9a-f]+$') { throw "$Label does not use a SHA-256 Authenticode file digest" }
-    if ($output -notmatch '(?im)^The signature is timestamped:') { throw "$Label is missing a verified timestamp" }
-    if ($output -notmatch '(?im)^Timestamp Verified by:') { throw "$Label is missing a timestamp certificate chain" }
-    if (($output | Select-String -Pattern '(?im)^Signing Certificate Chain:' -AllMatches).Matches.Count -ne 1) {
-        throw "$Label must contain exactly one Authenticode signature"
-    }
-
-    $signature = Get-AuthenticodeSignature -LiteralPath $Path
-    if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
-        throw "$Label Authenticode status is $($signature.Status)"
-    }
-    if ($signature.SignerCertificate.Subject -ne $ExpectedPublisher) {
-        throw "$Label publisher mismatch: $($signature.SignerCertificate.Subject)"
-    }
-    if ($null -eq $signature.TimeStamperCertificate) { throw "$Label has no timestamp certificate" }
-}
-
-function Assert-EmbeddedMainExecutable {
-    param(
-        [Parameter(Mandatory)]
-        [string]$Installer,
-
-        [Parameter(Mandatory)]
-        [string]$Label
-    )
-
-    $extractRoot = Join-Path $env:RUNNER_TEMP "alook-$Label-$([Guid]::NewGuid().ToString('N'))"
-    New-Item -Path $extractRoot -ItemType Directory | Out-Null
-    try {
-        & 7z.exe x -y "-o$extractRoot" $Installer | Out-Null
-        if ($LASTEXITCODE -ne 0) { throw "7-Zip could not extract $Label" }
-        $executables = @(Get-ChildItem -LiteralPath $extractRoot -Recurse -File -Filter "alook-desktop.exe")
-        if ($executables.Count -ne 1) { throw "$Label must contain exactly one alook-desktop.exe" }
-        Assert-Authenticode -Path $executables[0].FullName -Label "$Label embedded main executable"
-    } finally {
-        Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
-    }
-}
-
 foreach ($installer in @($msi, $nsis)) {
     $signaturePath = "$installer.sig"
     & node (Join-Path $repositoryRoot "scripts\ci\verify-minisign.mjs") `
         --file $installer --signature $signaturePath --config $TauriConfigPath `
         --version $ExpectedVersion --trusted-file ([IO.Path]::GetFileName($installer))
     if ($LASTEXITCODE -ne 0) { throw "Minisign verification failed for $installer" }
-    Assert-Authenticode -Path $installer -Label ([IO.Path]::GetFileName($installer))
 }
 
-Assert-EmbeddedMainExecutable -Installer $msi -Label "msi"
-Assert-EmbeddedMainExecutable -Installer $nsis -Label "nsis"
-
-Write-Host "Verified staged Windows installers, embedded main executables, and exact-byte updater signatures."
+Write-Host "Verified staged Windows installer manifests and exact-byte updater signatures; installers are not Authenticode code-signed."
```

**File**: `scripts/ci/workflow-contract.test.ts` (modified, +22/-123)
```diff
@@ -77,23 +77,6 @@ const desktopWindowsVerifier = readFileSync(
   resolve(repositoryRoot, "scripts/ci/verify-desktop-windows.ps1"),
   "utf8",
 )
-const desktopWindowsSigner = readFileSync(
-  resolve(repositoryRoot, "scripts/ci/sign-desktop-windows.ps1"),
-  "utf8",
-)
-const desktopWindowsSigningSetup = readFileSync(
-  resolve(repositoryRoot, "scripts/ci/prepare-desktop-windows-signing.ps1"),
-  "utf8",
-)
-const desktopWindowsSigningConfig = JSON.parse(
-  readFileSync(
-    resolve(repositoryRoot, "src/desktop/src-tauri/tauri.windows.signing.conf.json"),
-    "utf8",
-  ),
-) as { bundle: { windows: { signCommand: { cmd: string; args: string[] } } } }
-const desktopSigningDependencies = JSON.parse(
-  readFileSync(resolve(repositoryRoot, "scripts/ci/desktop-signing-dependencies.json"), "utf8"),
-) as { schemaVersion: number; packages: Array<{ name: string; version: string; source: string; sha256: string }> }
 const mobileReleaseWorkflowPath = resolve(workflowRoot, "mobile-release.yml")
 const mobileReleaseWorkflow = normalizeWorkflow(readFileSync(mobileReleaseWorkflowPath, "utf8"))
 const desktopConfig = JSON.parse(
@@ -1111,7 +1094,7 @@ describe("Desktop updater release", () => {
   it("keeps every build private until one publisher revalidates all four stages", () => {
     expect(autoTagReleaseWorkflow).toContain('--title "$TAG"')
     expect(desktopReleaseWorkflow.match(/contents: write/g)).toHaveLength(1)
-    expect(desktopReleaseWorkflow.match(/id-token: write/g)).toHaveLength(1)
+    expect(desktopReleaseWorkflow).not.toContain("id-token: write")
     expect(desktopReleaseWorkflow).toContain("group: desktop-release-${{ github.ref }}")
     expect(desktopReleaseWorkflow).toContain("cancel-in-progress: false")
     expect(desktopReleaseWorkflow).toContain("needs: [build-unix, build-windows]")
@@ -1219,115 +1202,31 @@ describe("Desktop updater release", () => {
     expect(desktopReleaseWorkflow).toContain("Developer ID signed")
     expect(desktopReleaseWorkflow).not.toContain("ad-hoc signed and are not notarized")
     expect(desktopReleaseWorkflow).not.toContain("Privacy & Security")
-    expect(desktopReleaseWorkflow).not.toContain("not Authenticode code-signed")
-    expect(desktopReleaseWorkflow).not.toContain("Run anyway")
   })
 
-  it("uses OIDC-only Microsoft Artifact Signing inside Tauri's exact sign hook", () => {
-    expect(desktopReleaseWorkflow).toContain(
-      "azure/login@a641126d1b8aa4d1fa005f4f92df94a3a4c4c906 # v3.1.0",
-    )
-    expect(desktopReleaseWorkflow).toContain("tauri.windows.signing.conf.json")
-    expect(desktopReleaseWorkflow).not.toContain("AZURE_CLIENT_SECRET")
-    expect(desktopReleaseWorkflow).not.toContain(".pfx")
-    expect(desktopWindowsSigningConfig.bundle.windows.signCommand).toEqual({
-      cmd: "pwsh",
-      args: [
-        "-NoLogo",
-        "-NoProfile",
-        "-NonInteractive",
-        "-File",
-        "../../../scripts/ci/sign-desktop-windows.ps1",
-        "%1",
-      ],
-    })
-    expect(desktopSigningDependencies.schemaVersion).toBe(1)
-    expect(desktopSigningDependencies.packages).toEqual([
-      {
-        name: "ArtifactSigning",
-        version: "0.1.8",
-        source: "https://www.powershellgallery.com/api/v2/package/ArtifactSigning/0.1.8",
-        sha256: "3221344b8c627915d3870f23e80816f31a5d8c2bae1d7c0cdd6c9652f6c4e089",
-        kind: "module",
-      },
-      {
-        name: "Microsoft.Windows.SDK.BuildTools",
-        version: "10.0.26100.4188",
-        source:
-          "https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/10.0.26100.4188/microsoft.windows.sdk.buildtools.10.0.26100.4188.nupkg",
-        sha256: "180deb372659029864c10a0c04787833234d64aacd1d2c0661d2c00295d8e022",
-        kind: "dependency",
-      },
-      {
-        name: "Microsoft.ArtifactSigning.Client",
-        version: "1.0.128",
-        source:
-          "https://api.nuget.org/v3-flatcontainer/microsoft.artifactsigning.client/1.0.128/microsoft.artifactsigning.client.1.0.128.nupkg",
-        sha256: "74bd7d27e6ce1051409c38d9b46bc8df0400ecd643d51ffbf2ac00869061e40b",
-        kind: "dependency",
-      },
-      {
-        name: "sign",
-        version: "0.9.1-beta.26227.3",
-        source:
-          "https://api.nuget.org/v3-flatcontainer/sign/0.9.1-beta.26227.3/sign.0.9.1-beta.26227.3.nupkg",
-        sha256: "34fd0d4aeabdbc363a48883881865b4dd65e6c11ba916028082fa23f3e1b1ba1",
-        kind: "dependency",
-      },
-    ])
-    for (const dependency of desktopSigningDependencies.packages) {
-      expect(dependency.source).toMatch(/^https:\/\/(?:www\.powershellgallery\.com|api\.nuget\.org)\//)
-      expect(dependency.sha256).toMatch(/^[0-9a-f]{64}$/)
-    }
-    expect(desktopWindowsSigningSetup).toContain("Get-FileHash -LiteralPath $archive -Algorithm SHA256")
-    expect(desktopWindowsSigningSetup).toContain("destination must be fresh")
-    expect(desktopWindowsSigningSetup).toContain("--connect-timeout 15
```

---

### Incident Patch 15: `877d57cb` (2026-09-30)
**Commit Message**: fix(daemon): keep reset memory maintenance silent

**File**: `src/daemon/src/manager/agentRouter.test.ts` (modified, +9/-0)
```diff
@@ -427,6 +427,11 @@ describe("AgentRouter — agent:reset", () => {
     expect(resets[0].rewakePrompt.length).toBeGreaterThan(0);
     expect(resets[0].rewakePrompt).not.toContain("todo.md");
     expect(resets[0].rewakePrompt).toContain("$ALOOK_CLI message mark list");
+    expect(resets[0].rewakePrompt).toContain("internal maintenance; perform it silently");
+    expect(resets[0].rewakePrompt).toContain("Do not proactively send the owner, users, or channels progress updates, completion notices, or details about your memory state");
+    expect(resets[0].rewakePrompt).toContain("Communicate task-relevant results, questions, and blockers normally");
+    expect(resets[0].rewakePrompt).toContain("If nothing needs a user-facing response, send no message");
+    expect(resets[0].rewakePrompt).toContain("resume outstanding work and handle your inbox messages");
     // Ordering: onBeforeAgent completes before resetSession fires.
     expect(order[0]).toBe("before:a1");
     expect(order[1]).toBe("reset:a1");
@@ -498,6 +503,10 @@ describe("AgentRouter — machine:reset_all (batch reset)", () => {
 
     // Every entry reset, once each; onBeforeAgent ran for each (gate inherited).
     expect(resets.map((r) => r.agentId)).toEqual(["a1", "a2", "a3"]);
+    for (const { rewakePrompt } of resets) {
+      expect(rewakePrompt).toContain("internal maintenance; perform it silently");
+      expect(rewakePrompt).toContain("Do not proactively send the owner, users, or channels progress updates, completion notices, or details about your memory state");
+    }
     expect(before).toEqual(["a1", "a2", "a3"]);
     // Each agent's before precedes its reset (same orchestration as single reset).
     expect(order.indexOf("reset:a2")).toBeGreaterThan(order.indexOf("reset:a1"));
```

**File**: `src/daemon/src/manager/agentRouter.ts` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ const REWAKE_PROMPT = `Your session was reset by your owner. Prior conversation
 2. Facts: Verify claims, especially work progress, against the latest original records. Search the context timeline and task discussions through their latest outcomes. Correct outdated or unsupported claims; keep uncertainty explicit.
 3. Durability: Keep only lasting facts, preferences, and reusable lessons or procedures. Remove task status, milestones, temporary plans, and diaries; extract a reusable lesson only when useful. Keep memory.md brief with links; put procedures, scope, and reasons in experiences. Reason from first principles: distill specific events into underlying causes, constraints, and reusable principles. Omit incidental dates and details; retain context only when it changes the principle’s validity or scope.
 
-Edit only your own memory files.
+Edit only your own memory files. This review is internal maintenance; perform it silently. Do not proactively send the owner, users, or channels progress updates, completion notices, or details about your memory state. Communicate task-relevant results, questions, and blockers normally. If nothing needs a user-facing response, send no message.
 
 After completing the review and any needed edits, resume outstanding work and handle your inbox messages.`;
 
```

**File**: `src/daemon/src/manager/managerRuntime.test.ts` (modified, +8/-0)
```diff
@@ -479,6 +479,14 @@ describe("AgentProcessManager — idle memory maintenance", () => {
       expect(send.mock.calls[0][0]).toMatchObject({ text: expect.stringContaining(MEMORY_MAINTENANCE_PROMPT) });
       await first.fire("runtime_event", { kind: "turn_end", sessionId: "saved-session" });
     }
+    const deliveredPrompt = hibernated ? factory.mock.calls[1][0].ctx.prompt : send.mock.calls[0][0].text;
+    expect(deliveredPrompt).toContain("internal maintenance; perform it silently");
+    expect(deliveredPrompt).toContain("Do not proactively send the owner, users, or channels progress updates, completion notices, or details about your memory state");
+    expect(deliveredPrompt).toContain("Communicate task-relevant results, questions, and blockers normally");
+    expect(deliveredPrompt).toContain("If nothing needs a user-facing response, send no message");
+    expect(deliveredPrompt).toContain("If new work arrives, handle it first and defer nap");
+    expect(deliveredPrompt).toContain("without --handoff");
+    expect(deliveredPrompt).toContain("$ALOOK_CLI nap");
     expect(forgetSession).not.toHaveBeenCalled();
     expect(mgr.snapshot().agents.a1.sessionId).toBe("saved-session");
   });
```

**File**: `src/daemon/src/manager/memoryMaintenancePrompt.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ export const MEMORY_MAINTENANCE_PROMPT = `The daemon is preparing to reset this
 2. Facts: Verify claims, especially work progress, against the latest original records. Search the context timeline and task discussions through their latest outcomes. Correct outdated or unsupported claims; keep uncertainty explicit.
 3. Durability: Keep only lasting facts, preferences, and reusable lessons or procedures. Remove task status, milestones, temporary plans, and diaries; extract a reusable lesson only when useful. Keep memory.md brief with links; put procedures, scope, and reasons in experiences. Reason from first principles: distill specific events into underlying causes, constraints, and reusable principles. Omit incidental dates and details; retain context only when it changes the principle’s validity or scope.
 
-Edit only your own memory files.
+Edit only your own memory files. This review is internal maintenance; perform it silently. Do not proactively send the owner, users, or channels progress updates, completion notices, or details about your memory state. Communicate task-relevant results, questions, and blockers normally. If nothing needs a user-facing response, send no message.
 
 If new work arrives, handle it first and defer nap. Otherwise, after completing the review and any needed edits, your final action is to run the following command without --handoff. Do not finish with only a written reply. This instruction authorizes that nap:
 
```

#### Recent Merged Pull Requests:
- **PR #874** (2026-10-05): perf(web): prefetch community navigation routes through links (@GenerQAQ)
- **PR #873** (2026-10-05): fix(web): preserve mobile share image assets and brand font (@gusye1234)
- **PR #872** (2026-10-05): chore(deps): bump the dependencies group across 1 directory with 44 updates (@dependabot[bot])
- **PR #871** (2026-10-05): revert(ci): restore original Codecov download configuration (@GenerQAQ)
- **PR #870** (2026-10-05): feat(web): keep community shell mounted across routes (@GenerQAQ)
- **PR #868** (closed): chore(deps): bump the dependencies group with 43 updates (@dependabot[bot])
- **PR #867** (2026-10-05): chore(deps): bump the cloudflare-worker-test-toolchain group across 1 directory with 3 updates (@dependabot[bot])
- **PR #866** (2026-10-04): docs(daemon): record work ownership in agent memory (@gusye1234)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
