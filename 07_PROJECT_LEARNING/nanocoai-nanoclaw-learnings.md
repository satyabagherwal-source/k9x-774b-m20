# Forensic Learning Record (Deep Inspection): nanocoai/nanoclaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/nanocoai-nanoclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nanocoai/nanoclaw](https://github.com/nanocoai/nanoclaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:10:49.725Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nanocoai/nanoclaw`
- **Description**: A lightweight alternative to OpenClaw that runs in containers for security. Connects to WhatsApp, Telegram, Slack, Discord, Gmail and other messaging apps,, has memory, scheduled jobs, and runs directly on Anthropic's Agents SDK
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 30875 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `container/agent-runner/src/db/container-state.ts`
```
import { getAgentMailbox } from '../mailbox/index.js';

export function setContainerToolInFlight(tool: string, declaredTimeoutMs: number | null): void {
  getAgentMailbox().operations.setContainerToolInFlight(tool, declaredTimeoutMs);
}

export function clearContainerToolInFlight(): void {
  getAgentMailbox().operations.clearContainerToolInFlight();
}

export function clearStaleProcessingAcks(): void {
  getAgentMailbox().operations.clearStaleProcessingAcks();
}

```

### Core Architecture Module: `container/agent-runner/src/db/session-state.ts`
```
/**
 * Persistent key/value state owned by the registered mailbox.
 *
 * Primary use: remember each provider's opaque continuation id so the
 * agent's conversation resumes across container restarts. Keyed per
 * provider because continuations are provider-private — a Claude
 * conversation id means nothing to Codex and vice versa. Switching
 * providers is therefore lossless: each provider's last thread stays
 * on file and resumes cleanly if the user flips back.
 */
import { getAgentMailbox } from '../mailbox/index.js';

const LEGACY_KEY = 'sdk_session_id';

function continuationKey(providerName: string): string {
  return `continuation:${providerName.toLowerCase()}`;
}

function getValue(key: string): string | undefined {
  return getAgentMailbox().operations.getState(key)?.value;
}

function setValue(key: string, value: string): void {
  getAgentMailbox().operations.setState(key, value);
}

function deleteValue(key: string): void {
  getAgentMailbox().operations.deleteState(key);
}

/**
 * One-time migration of the pre-per-provider continuation row.
 *
 * Before this was keyed per provider, continuations lived under the
 * single key `sdk_session_id`. On container start, if that legacy row
 * exists and the current provider has no continuation of its own, adopt
 * the legacy value into the current provider's slot (best-guess — the
 * legacy row was written by whatever provider ran last). The legacy row
 * is always deleted so future provider flips never re-read a stale id
 * through the wrong lens.
 *
 * Returns the continuation the caller should use at startup (either the
 * current provider's existing value, the adopted legacy value, or
 * undefined).
 */
export function migrateLegacyContinuation(providerName: string): string | undefined {
  const legacy = getValue(LEGACY_KEY);
  const currentKey = continuationKey(providerName);
  const current = getValue(currentKey);

  if (legacy === undefined) return current;

  // Always drop the legacy row so no future provider reads it.
  deleteValue(LEGACY_KEY);

  // Prefer the current provider's own slot if one already exists.
  if (current !== undefined) return current;

  setValue(currentKey, legacy);
  return legacy;
}

export function getContinuation(providerName: string): string | undefined {
  return getValue(continuationKey(providerName));
}

export function setContinuation(providerName: string, id: string): void {
  setValue(continuationKey(providerName), id);
}

export function clearContinuation(providerName: string): void {
  deleteValue(continuationKey(providerName));
}

/**
 * Where the message being answered came from, plus its id for the a2a return
 * path. Null routing fields mean the batch has no channel (a task run).
 */
export interface ReplyRoute {
  inReplyTo: string;
  channelType: string | null;
  platformId: string | null;
  threadId: string | null;
}

/**
 * The reply stamp: the route of the first inbound message in the batch the
 * agent is currently processing. The poll loop publishes it at batch start;
 * MCP tools (`send_message`, `send_file`) read it to thread a reply into the
 * conversation being answered and to stamp `in_reply_to` onto outbound rows so
 * the host's a2a return-path routing can correlate replies back to the
 * originating session.
 *
 * This lives in mailbox state because the MCP server runs as a separate stdio
 * subprocess; module state set by the poll loop is invisible to it.
 *
 * No age limit: the tools only run inside a query, and every query publishes
 * (or clears) the stamp before it starts, so a stamp is never older than the
 * turn it belongs to. A container killed mid-batch (SIGKILL) skips the
 * clearing finally, so the poll loop clears any leftover at startup instead.
 */
const REPLY_ROUTE_KEY = 'current_reply_route';

export function setCurrentReplyRoute(route: ReplyRoute | null): void {
  if (route === null) {
    clearCurrentReplyRoute();
    return;
  }
  const { inReplyTo, channelType, platformId, threadId } = route;
  setValue(REPLY_ROUTE_KEY, JSON.stringify({ inReplyTo, channelType, platformId, threadId }));
}

export function clearCurrentReplyRoute(): void {
  deleteValue(REPLY_ROUTE_KEY);
}

export function getCurrentReplyRoute(): ReplyRoute | null {
  const row = getAgentMailbox().operations.getState(REPLY_ROUTE_KEY);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as Partial<ReplyRoute>;
    if (typeof parsed.inReplyTo !== 'string') return null;
    return {
      inReplyTo: parsed.inReplyTo,
      channelType: parsed.channelType ?? null,
      platformId: parsed.platformId ?? null,
      threadId: parsed.threadId ?? null,
    };
  } catch {
    return null;
  }
}

export function getCurrentInReplyTo(): string | null {
  return getCurrentReplyRoute()?.inReplyTo ?? null;
}

```

### Core Architecture Module: `container/agent-runner/src/mcp-tools/core.ts`
```
/**
 * Core MCP tools: send_message, send_file, edit_message, add_reaction.
 *
 * All outbound tools resolve destinations via the local destination map
 * (see destinations.ts). Agents reference destinations by name; the map
 * translates name → routing tuple. Permission enforcement happens on
 * the host side in delivery.ts via the agent_destinations table.
 */
import fs from 'fs';
import path from 'path';

import { findByName, getAllDestinations } from '../destinations.js';
import { getMessageIdBySeq, getRoutingBySeq, writeMessageOut } from '../db/messages-out.js';
import { getCurrentInReplyTo, getCurrentReplyRoute } from '../db/session-state.js';
import { resolveDestinationThread } from '../db/session-routing.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

function destinationList(): string {
  const all = getAllDestinations();
  if (all.length === 0) return '(none)';
  return all.map((d) => d.name).join(', ');
}

/**
 * Resolve a destination name to routing fields.
 *
 * A channel destination is threaded like the poll loop's explicit deliveries:
 * the thread of the message being answered (the published reply stamp) when it
 * came from that channel, else that channel's latest inbound thread. An agent
 * destination never carries a thread.
 */
function resolveRouting(
  to: string,
): { channel_type: string; platform_id: string; thread_id: string | null; resolvedName: string } | { error: string } {
  const dest = findByName(to);
  if (!dest) return { error: `Unknown destination "${to}". Known: ${destinationList()}` };
  if (dest.type === 'channel') {
    return {
      channel_type: dest.channelType!,
      platform_id: dest.platformId!,
      thread_id:
        resolveDestinationThread(dest.channelType!, dest.platformId!, getCurrentReplyRoute())?.threadId ?? null,
      resolvedName: to,
    };
  }
  return { channel_type: 'agent', platform_id: dest.agentGroupId!, thread_id: null, resolvedName: to };
}

export const sendMessage: McpToolDefinition = {
  tool: {
    name: 'send_message',
    description: 'Send a message to a named destination.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Destination name (e.g., "family", "worker-1").',
        },
        text: { type: 'string', description: 'Message content' },
      },
      required: ['to', 'text'],
    },
  },
  async handler(args) {
    const to = args.to as string;
    const text = args.text as string;
    if (!to) return err(`to is required. Options: ${destinationList()}`);
    if (!text) return err('text is required');

    const routing = resolveRouting(to);
    if ('error' in routing) return err(routing.error);

    const id = generateId();
    const seq = await writeMessageOut({
      id,
      in_reply_to: getCurrentInReplyTo(),
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ text }),
    });

    log(`send_message: #${seq} → ${routing.resolvedName}`);
    return ok(`Message sent to ${routing.resolvedName} (id: ${seq})`);
  },
};

export const sendFile: McpToolDefinition = {
  tool: {
    name: 'send_file',
    description: 'Send a file to a named destination.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Destination name.' },
        path: { type: 'string', description: 'File path (relative to /workspace/agent/ or absolute)' },
        text: { type: 'string', description: 'Optional accompanying message' },
        filename: { type: 'string', description: 'Display name (default: basename of path)' },
      },
      required: ['to', 'path'],
    },
  },
  async handler(args) {
    const to = args.to as string;
    const filePath = args.path as string;
    if (!to) return err(`to is required. Options: ${destinationList()}`);
    if (!filePath) return err('path is required');

    const routing = resolveRouting(to);
    if ('error' in routing) return err(routing.error);

    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve('/workspace/agent', filePath);
    if (!fs.existsSync(resolvedPath)) return err(`File not found: ${filePath}`);

    const id = generateId();
    const filename = (args.filename as string) || path.basename(resolvedPath);

    const outboxDir = path.join('/workspace/outbox', id);
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.copyFileSync(resolvedPath, path.join(outboxDir, filename));

    await writeMessageOut({
      id,
      in_reply_to: getCurrentInReplyTo(),
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ text: (args.text as string) || '', files: [filename] }),
    });

    log(`send_file: ${id} → ${routing.resolvedName} (${filename})`);
    return ok(`File sent to ${routing.resolvedName} (id: ${id}, filename: ${filename})`);
  },
};

export const editMessage: McpToolDefinition = {
  tool: {
    name: 'edit_message',
    description: 'Edit a previously sent message. Targets the same destination the original message was sent to.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        messageId: { type: 'integer', description: 'Message ID (the numeric id shown in messages)' },
        text: { type: 'string', description: 'New message content' },
      },
      required: ['messageId', 'text'],
    },
  },
  async handler(args) {
    const seq = Number(args.messageId);
    const text = args.text as string;
    if (!seq || !text) return err('messageId and text are required');

    const platformId = getMessageIdBySeq(seq);
    if (!platformId) return err(`Message #${seq} not found`);

    const routing = getRoutingBySeq(seq);
    if (!routing || !routing.channel_type || !routing.platform_id) {
      return err(`Cannot determine destination for message #${seq}`);
    }

    const id = generateId();
    await writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ operation: 'edit', messageId: platformId, text }),
    });

    log(`edit_message: #${seq} → ${platformId}`);
    return ok(`Message edit queued for #${seq}`);
  },
};

export const addReaction: McpToolDefinition = {
  tool: {
    name: 'add_reaction',
    description: 'Add an emoji reaction to a message.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        messageId: { type: 'integer', description: 'Message ID (the numeric id shown in messages)' },
        emoji: { type: 'string', description: 'Emoji name (e.g., thumbs_up, heart, check)' },
      },
      required: ['messageId', 'emoji'],
    },
  },
  async handler(args) {
    const seq = Number(args.messageId);
    const emoji = args.emoji as string;
    if (!seq || !emoji) return err('messageId and emoji are required');

    const platformId = getMessageIdBySeq(seq);
    if (!platformId) return err(`Message #${seq} not found`);

    const routing = getRoutingBySeq(seq);
    if (!routing || !routing.channel_type || !routing.platform_id) {
      return err(`Cannot determine destination for message #${seq}`);
    }

    const id = generateId();
    await writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ operation: 'reaction', messageId: platformId, emoji }),
    });

    log(`add_reaction: #${seq} → ${emoji} on ${platformId}`);
    return ok(`Reaction queued for #${seq}`);
  },
};

registerTools([sendMessage, sendFile, editMessage, addReaction]);

```

### Core Architecture Module: `container/agent-runner/src/memory/hook.ts`
```
import fs from 'fs';

import { MEMORY_SESSION_HOOK, memoryContextForSessionStart, type MemorySessionStartSource } from './session-hook.js';

function readSource(): MemorySessionStartSource | undefined {
  try {
    const input: unknown = JSON.parse(fs.readFileSync(0, 'utf-8'));
    if (!input || typeof input !== 'object' || !('source' in input)) return undefined;
    const source = input.source;
    const validSources: readonly unknown[] = [...MEMORY_SESSION_HOOK.sources, 'resume'];
    if (validSources.includes(source)) {
      return source as MemorySessionStartSource;
    }
  } catch {
    // Invalid hook input fails closed: no additional context is emitted.
  }
  return undefined;
}

const source = readSource();
const context = source ? memoryContextForSessionStart(source, process.argv[2]) : undefined;
if (context) console.log(context);

```

### Core Architecture Module: `container/agent-runner/src/memory/session-hook.ts`
```
import { renderMemorySection } from './context.js';

const MEMORY_CONTEXT_SOURCES = ['startup', 'clear', 'compact'] as const;

export type MemorySessionHookSource = (typeof MEMORY_CONTEXT_SOURCES)[number];
export type MemorySessionStartSource = MemorySessionHookSource | 'resume';

export interface MemorySessionHookRegistration {
  readonly command: string;
  readonly legacyCommands: readonly string[];
  readonly sources: readonly MemorySessionHookSource[];
}

export const MEMORY_SESSION_HOOK: MemorySessionHookRegistration = {
  command: 'bun /app/src/memory/hook.ts',
  legacyCommands: ['bun /app/src/memory-hook.ts'],
  sources: MEMORY_CONTEXT_SOURCES,
};

/** Return memory only when a provider is establishing a new context window. */
export function memoryContextForSessionStart(source: MemorySessionStartSource, baseDir?: string): string | undefined {
  return source === 'resume' ? undefined : renderMemorySection(baseDir);
}

```

### Core Architecture Module: `container/agent-runner/src/poll-loop.ts`
```
import { findByName, getAllDestinations, type DestinationEntry } from './destinations.js';
import {
  getPendingMessages,
  markProcessing,
  markCompleted,
  markScriptSkipped,
  type MessageInRow,
} from './db/messages-in.js';
import { getUndeliveredMessages, writeMessageOut } from './db/messages-out.js';
import { clearStaleProcessingAcks } from './db/container-state.js';
import { resolveDestinationThread } from './db/session-routing.js';
import { touchHeartbeat } from './heartbeat.js';
import { getAgentMailbox } from './mailbox/index.js';
import {
  clearContinuation,
  clearCurrentReplyRoute,
  migrateLegacyContinuation,
  setContinuation,
  setCurrentReplyRoute,
} from './db/session-state.js';
import {
  formatMessages,
  extractRouting,
  categorizeMessage,
  FAILURE_NOTICE_FIELD,
  isClearCommand,
  isRunnerCommand,
  isSessionEcho,
  stripInternalTags,
  type RoutingContext,
} from './formatter.js';
import { stripHarnessTagArtifacts } from './harness-tag-strip.js';
import { isUploadTraceCommand, uploadTrace } from './upload-trace.js';
import type { AgentProvider, AgentQuery, ProviderEvent, ProviderExchange } from './providers/types.js';
import type { ProviderRuntimeContract } from './provider-contracts/registry.js';

const POLL_INTERVAL_MS = 1000;
const ACTIVE_POLL_INTERVAL_MS = 500;

/** Consecutive driver-classified failures before a fresh runner is required. */
const MAILBOX_FAILURE_STREAK_EXIT = 10;

function log(msg: string): void {
  console.error(`[poll-loop] ${msg}`);
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface PollLoopConfig {
  provider: AgentProvider;
  /** Declared provider runtime behavior. Contractless providers keep legacy defaults. */
  providerContract?: Pick<ProviderRuntimeContract, 'textDelivery' | 'commands'>;
  /**
   * Name of the provider (e.g. "claude", "codex", "opencode"). Used to key
   * the stored continuation per-provider so flipping providers doesn't
   * resurrect a stale id from a different backend.
   */
  providerName: string;
  cwd: string;
  systemContext?: {
    instructions?: string;
  };
  /**
   * Optional stop signal. In production the loop runs until the container
   * dies; tests pass a signal so an abandoned loop actually exits instead of
   * polling forever and stealing messages from the next test's DB.
   */
  signal?: AbortSignal;
}

/**
 * Main poll loop. Runs indefinitely until the process is killed.
 *
 * 1. Poll the mailbox for pending messages
 * 2. Format into prompt, call provider.query()
 * 3. While query active: continue polling, push new messages via provider.push()
 * 4. On result: write outbound messages
 * 5. Mark messages completed
 * 6. Loop
 */
export async function runPollLoop(config: PollLoopConfig): Promise<void> {
  // Contract providers declare these; a contractless (legacy payload)
  // provider keeps declaring them as instance flags, exactly as before.
  const legacy = config.provider as { supportsNativeSlashCommands?: boolean; emitsMidTurnText?: boolean };
  const nativeSlashCommands = config.providerContract
    ? config.providerContract.commands.formatting === 'native'
    : (legacy.supportsNativeSlashCommands ?? false);
  const midTurnCompleteDelivery = config.providerContract
    ? config.providerContract.textDelivery === 'mid-turn-complete'
    : (legacy.emitsMidTurnText ?? false);

  // Resume the agent's prior session from a previous container run if one
  // was persisted. The continuation is opaque to the poll-loop — the
  // provider decides how to use it (Claude resumes a .jsonl transcript,
  // other providers may reload a thread ID, etc.). Keyed per-provider so
  // a Codex thread id never gets handed to Claude or vice versa.
  let continuation: string | undefined = migrateLegacyContinuation(config.providerName);

  // Before resuming, drop a session whose on-disk transcript has grown too
  // large/old to cold-resume within the host's idle ceiling. Without this a
  // long-lived hub keeps trying to reload an ever-growing .jsonl, hangs the
  // first turn, and gets killed before it can reply (then repeats forever).
  if (continuation) {
    const rotateReason = config.provider.maybeRotateContinuation?.(continuation, config.cwd);
    if (rotateReason) {
      log(`Rotating session — ${rotateReason}; starting fresh`);
      clearContinuation(config.providerName);
      continuation = undefined;
    }
  }

  if (continuation) {
    log(`Resuming agent session ${continuation}`);
  }

  // Clear leftover 'processing' acks from a previous crashed container.
  // This lets the new container re-process those messages.
  clearStaleProcessingAcks();
  // Same for the reply stamp a killed container left behind (see session-state.ts).
  clearCurrentReplyRoute();

  let pollCount = 0;
  let isFirstPoll = true;
  while (true) {
    if (config.signal?.aborted) return;
    // Skip system messages — they're responses for MCP tools (e.g., ask_user_question)
    const messages = getPendingMessages(isFirstPoll).filter((m) => m.kind !== 'system');
    isFirstPoll = false;
    pollCount++;

    // Periodic heartbeat so we know the loop is alive
    if (pollCount % 30 === 0) {
      log(`Poll heartbeat (${pollCount} iterations, ${messages.length} pending)`);
    }

    if (messages.length === 0) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Accumulate gate: if the batch contains only trigger=0 rows
    // (context-only, router-stored under ignored_message_policy='accumulate'),
    // don't wake the agent. Leave them `pending` — they'll ride along the
    // next time a real trigger=1 message lands via this same getPendingMessages
    // query. Without this gate, a warm container keeps processing
    // (and potentially responding to) every accumulate-only batch, defeating
    // the "store as context, don't engage" contract. Host-side countDueMessages
    // gates the same way for wake-from-cold through countDueMessages().
    if (!messages.some((m) => m.trigger === 1)) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const ids = messages.map((m) => m.id);
    markProcessing(ids);

    const routing = extractRouting(messages);

    // Command handling: the host router gates filtered and unauthorized
    // admin commands before they reach the container. The only command
    // the runner handles directly is /clear (session reset).
    const normalMessages: MessageInRow[] = [];
    const commandIds: string[] = [];

    for (const msg of messages) {
      if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isClearCommand(msg)) {
        log('Clearing session (resetting continuation)');
        continuation = undefined;
        clearContinuation(config.providerName);
        await writeMessageOut({
          id: generateId(),
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: 'Session cleared.' }),
        });
        commandIds.push(msg.id);
        continue;
      }
      // isSessionEcho guard: a copied "/upload-trace" from another session is
      // ambient context, never a runner command (isClearCommand self-guards).
      if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && !isSessionEcho(msg) && isUploadTraceCommand(msg)) {
        log('Uploading session trace to Hugging Face');
        await writeMessageOut({
          id: generateId(),
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: uploadTrace(config.providerName) }),
        });
        commandIds.push(msg.id);
        continue;
      }
      normalMessages.push(msg);
    }

    if (commandIds.length > 0) {
      markCompleted(commandIds);
    }

    if (normalMessages.length === 0) {
      const remainingIds = ids.filter((id) => !commandIds.includes(id));
      if (remainingIds.length > 0) markCompleted(remainingIds);
      log(`All ${messages.length} message(s) were commands, skipping query`);
      continue;
    }

    // Pre-task scripts: for any task rows with a `script`, run it before the
    // provider call. Scripts returning wakeAgent=false (or erroring) gate
    // their own task row only — surviving messages still go to the agent.
    // Without the scheduling module, the marker block is empty, `keep`
    // falls back to `normalMessages`, and no gating happens.
    let keep: MessageInRow[] = normalMessages;
    let skipped: Array<{ id: string; reason: string }> = [];
    // MODULE-HOOK:scheduling-pre-task:start
    const { applyPreTaskScripts } = await import('./scheduling/task-script.js');
    const preTask = await applyPreTaskScripts(normalMessages);
    keep = preTask.keep;
    skipped = preTask.skipped;
    if (skipped.length > 0) {
      markScriptSkipped(skipped);
      log(`Pre-task script skipped ${skipped.length} task(s): ${skipped.map((s) => s.id).join(', ')}`);
    }
    // MODULE-HOOK:scheduling-pre-task:end

    if (keep.length === 0) {
      log(`All ${normalMessages.length} non-command message(s) gated by script, skipping query`);
      continue;
    }

    // Format messages: passthrough commands get raw text (only if the
    // provider natively handles slash commands), others get XML.
    const prompt = formatMessagesWithCommands(keep, nativeSlashCommands, config.providerName);

    log(`Processing ${keep.length} message(s), kinds: ${[...new Set(keep.map((m) => m.kind))].join(',')}`);

    const query = config.provider.query({
      prompt,
      continuation,
      cwd: config.cwd,
      systemContext: config.systemContext,
    });
    // Process the query while concurrently polling for new messages
    const skippedSet = new Set(skipped.map((s) => s.id));
    const processingIds = ids.filter((id) => !commandIds.includes(id) && !skippedSet.h
```

### Core Architecture Module: `scripts/upgrade-state.ts`
```
/**
 * scripts/upgrade-state.ts — read or stamp the upgrade marker.
 *
 * Usage:
 *   pnpm exec tsx scripts/upgrade-state.ts get
 *   pnpm exec tsx scripts/upgrade-state.ts set [version] [via]
 *
 * `set` with no version stamps the current package.json version. The
 * sanctioned upgrade paths (setup / update / migrate) call `set` on
 * success; running it by hand is also the documented way to clear the
 * startup tripwire — see docs/upgrade-recovery.md.
 */
import { getCodeVersion, markerPath, readUpgradeState, writeUpgradeState } from '../src/upgrade-state.js';

const [, , cmd, versionArg, viaArg] = process.argv;

if (cmd === 'get') {
  const state = readUpgradeState();
  console.log(state ? JSON.stringify(state) : 'none');
} else if (cmd === 'set') {
  const state = writeUpgradeState({ version: versionArg || getCodeVersion(), via: viaArg || 'manual' });
  console.log(`Stamped ${markerPath()}: ${JSON.stringify(state)}`);
} else {
  console.error('Usage: pnpm exec tsx scripts/upgrade-state.ts get | set [version] [via]');
  process.exit(2);
}

```

### Core Architecture Module: `setup/lib/registry-state.ts`
```
/**
 * Reader/writer for agent-image source state — and, on the gated path, for who
 * this install is to the registry.
 *
 * Intent and reality are two separate reads, because a pulled image is retagged
 * onto the same local tag a build writes — so `.env` can claim "hardened" while
 * a fallback build actually ran. Never treat intent as evidence:
 *
 *   readImageSource()    — what the operator asked for (`.env`)
 *   inspectAgentImage()  — what the local tag resolves to (docker)
 *
 * `setup/container.ts` and `container/build.sh` still parse the key themselves
 * (the former can't import from `setup/lib` on a standalone `--step container`
 * run; the latter is bash). All readers compare trimmed + lower-cased against
 * `true` — keep it that way.
 *
 * The account half (credential file, broker URL, docker `credHelpers` pointer)
 * lives here for the same reason the image half does: the login flow, the
 * `registry` step and uninstall all touch it, and three private copies of
 * "where is the token" is how they end up disagreeing.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { readEnvFile } from '../../src/env.js';
import { getDefaultContainerImage } from '../../src/install-slug.js';
import { removeEnvVar, upsertEnvVar } from '../set-env.js';
import { readVersionPinValue } from './version-pins.js';

/** `.env` key carrying the opt-in. Read by setup and by `container/build.sh`. */
export const HARDENED_IMAGE_ENV_KEY = 'NANOCLAW_HARDENED_IMAGE';

/**
 * `versions.json` key holding the full pullable reference, digest included.
 * One key rather than a repo/digest pair so the halves cannot drift apart.
 *
 * Two shapes. A single string is the normal one and covers both a multi-arch
 * index digest — which docker resolves to the running platform by itself, so
 * nothing here has to think about architecture — and a single-architecture
 * digest from a publisher that ships only one. An object keyed by docker
 * platform string is for a publisher that ships per-architecture references
 * instead of one index:
 *
 *   "agent-image": "repo@sha256:…"
 *   "agent-image": { "linux/amd64": "repo@sha256:…", "linux/arm64": "repo@sha256:…" }
 */
export const AGENT_IMAGE_PIN = 'agent-image';

/**
 * Per-machine override of that reference, so an operator can point at their own
 * registry without editing a committed file. `container/pull.sh` reads it too.
 */
export const AGENT_IMAGE_REF_ENV_KEY = 'NANOCLAW_AGENT_IMAGE_REF';

/**
 * Provenance label. Only a build can set it, so it travels with the bytes and
 * survives the retag that erases every other difference.
 */
export const IMAGE_SOURCE_LABEL = 'dev.nanoclaw.image-source';

/** What the operator asked for. */
export type ImageSource = 'local' | 'hardened';

/**
 * What the tag on this machine actually is. `missing` means docker answered
 * and has no such image; `unknown` means we could not ask it at all.
 */
export type ActualImageSource = ImageSource | 'derived' | 'missing' | 'unknown';

/** Caller's env wins, then `.env`. The one place this key is parsed in TS. */
function rawImageSourceSetting(): string | undefined {
  const env = readEnvFile([HARDENED_IMAGE_ENV_KEY]);
  return process.env[HARDENED_IMAGE_ENV_KEY] || env[HARDENED_IMAGE_ENV_KEY];
}

/**
 * Fresh read every call: setup writes this key and reads it back in one run.
 *
 * Deliberately not exported from `src/config.ts`. The host never needs it — the
 * pull retags onto the local slug tag, so nothing in `src/` learns a registry
 * exists. If this key ever has to reach the host process, that invariant broke.
 */
export function readImageSource(): ImageSource {
  return rawImageSourceSetting()?.trim().toLowerCase() === 'true' ? 'hardened' : 'local';
}

/**
 * Whether anyone has answered the question yet — an absent key and an explicit
 * `false` both read as `local` from `readImageSource`, and setup has to tell
 * them apart: the first means "ask", the second means "they said no, don't ask
 * again". That distinction is what makes a resumed run stop re-prompting, so
 * `writeImageSource` writes `false` rather than deleting the line.
 */
export function imageSourceDecided(): boolean {
  return (rawImageSourceSetting() ?? '').trim() !== '';
}

/**
 * Opting out writes `false` rather than deleting the line — an explicit "no"
 * is visible in `.env` and survives a resumed setup; an absent key isn't.
 */
export function writeImageSource(source: ImageSource): void {
  upsertEnvVar(HARDENED_IMAGE_ENV_KEY, source === 'hardened' ? 'true' : 'false');
}

/**
 * Put the question back: after this, `imageSourceDecided()` is false again and
 * setup asks. For callers that ran the sign-in for a reason of their own and
 * must not have it answer a question the operator has not been asked yet —
 * writing `false` would be an answer too, and would suppress the prompt.
 */
export function clearImageSource(): void {
  removeEnvVar(HARDENED_IMAGE_ENV_KEY);
}

/**
 * The image reference this install pulls, or undefined when unpinned.
 *
 * Precedence mirrors `container/pull.sh` — env, then `.env`, then the
 * `versions.json` pin — so verify reports what actually got pulled.
 *
 * Soft where the read throws: "no pin" is the normal permanent state of
 * every local-build install. On the hardened path treat `undefined` as "not
 * configured to pull" and say so; never as a reason to fall back quietly.
 */
export function readAgentImagePin(): string | undefined {
  const env = readEnvFile([AGENT_IMAGE_REF_ENV_KEY]);
  const override = process.env[AGENT_IMAGE_REF_ENV_KEY]?.trim() || env[AGENT_IMAGE_REF_ENV_KEY];
  if (override) return override;
  try {
    const pin = readVersionPinValue(AGENT_IMAGE_PIN);
    // Only the object shape needs to know the platform, and asking costs a
    // docker spawn — so don't ask on the single-reference path, which is both
    // the common one and the one that works before docker is even installed.
    if (typeof pin === 'string') return pin.trim() || undefined;
    return resolvePinForPlatform(pin, dockerPlatform());
  } catch {
    return undefined;
  }
}

/**
 * Pick one platform's reference out of whatever shape the pin has. A string
 * pin is returned as-is for every platform: resolving a multi-arch index is
 * docker's job, and second-guessing it here is how you end up pulling the
 * wrong child.
 *
 * Exported for tests — callers want `readAgentImagePin`.
 */
export function resolvePinForPlatform(pin: unknown, platform: string): string | undefined {
  if (typeof pin === 'string') return pin.trim() || undefined;
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return undefined;
  const value = (pin as Record<string, unknown>)[platform];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Platforms an object-shaped pin declares. Empty for a single reference. */
export function pinnedPlatforms(pin: unknown): string[] {
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return [];
  return Object.entries(pin as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k]) => k)
    .sort();
}

/**
 * Set when the file pins something but nothing for this machine — the one case
 * where "no pin" would otherwise be reported as "this install doesn't pull",
 * which is a materially different and wrong answer.
 */
export function unsupportedPlatformPin(): { platform: string; available: string[] } | undefined {
  try {
    const pin = readVersionPinValue(AGENT_IMAGE_PIN);
    const available = pinnedPlatforms(pin);
    if (available.length === 0) return undefined;
    const platform = dockerPlatform();
    return resolvePinForPlatform(pin, platform) ? undefined : { platform, available };
  } catch {
    return undefined;
  }
}

/**
 * Docker's platform string for the daemon that will run the pull.
 *
 * The *daemon's* architecture, not this process's: with Docker Desktop, a
 * remote daemon or a cross-architecture context, the machine running node is
 * not the machine running the container. `container/pull.sh` resolves it the
 * same way for the same reason — if these two disagree, `--status` compares
 * against a pin the pull never used.
 */
let cachedPlatform: string | undefined;
export function dockerPlatform(): string {
  if (cachedPlatform) return cachedPlatform;
  const res = spawnSync('docker', ['version', '--format', '{{.Server.Arch}}'], {
    encoding: 'utf-8',
  });
  const fromDaemon = res.status === 0 ? res.stdout.trim() : '';
  cachedPlatform = `linux/${fromDaemon || nodeArchToDocker(process.arch)}`;
  return cachedPlatform;
}

/** Node's architecture names are not docker's. */
function nodeArchToDocker(arch: string): string {
  return arch === 'x64' ? 'amd64' : arch;
}

/** The `sha256:…` half of the pin. Undefined when unpinned or not a digest ref. */
export function readAgentImageDigest(): string | undefined {
  return splitDigest(readAgentImagePin());
}

/**
 * The registry host the pin points at — the `credHelpers` key docker looks up
 * when it pulls, and the only host this install's helper should ever answer for.
 *
 * Derived from the pin rather than configured separately so the pointer cannot
 * outlive the reference that justified it. Docker's own rule for telling a
 * registry host from a Docker Hub namespace: the first segment counts as a host
 * only if it has a dot, a port, or is `localhost`.
 */
export function readRegistryHost(): string | undefined {
  const ref = readAgentImagePin();
  if (!ref || !ref.includes('/')) return undefined;
  const first = ref.slice(0, ref.indexOf('/'));
  return first.includes('.') || first.includes(':') || first === 'localhost' ? first : undefined;
}

export interface AgentImageInspection {
  /** The local tag inspected — `nanoclaw-agent-v2-<slug>:latest`. */
  ref: string;
  /** Local image ID (`sha256:…` over the config blob). Absent when not present. */
  id?: string;
  /**
  
```

### Core Architecture Module: `setup/slack-worker.ts`
```
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { processLock, writePrivate } from '../src/community-portal/index.js';
import {
  readSlackJob,
  slackJobFile,
  slackProgressClient,
  withSetupLock,
  type SlackJob,
} from '../src/community-portal/slack-job.js';

type Delivery = { status?: string; bot_token?: string; delivery_id?: string };
export interface WorkerDependencies {
  receive(job: SlackJob, body: object): Promise<Delivery>;
  install(job: SlackJob): Promise<void>;
  report(job: SlackJob): Promise<void>;
  sleep(ms: number): Promise<unknown>;
  now(): number;
}
async function receive(job: SlackJob, body: object): Promise<Delivery> {
  const base = new URL(job.serviceBase);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))
  )
    throw Object.assign(new Error('Invalid Slack service origin.'), { code: 'invalid_service' });
  const response = await fetch(`${base.origin}/v1/apps/${encodeURIComponent(job.app.appId)}/install`, {
    method: 'POST',
    headers: { authorization: `Bearer ${job.identity.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) throw Object.assign(new Error('Slack installation request failed.'), { status: response.status });
  return response.json() as Promise<Delivery>;
}
async function install(job: SlackJob): Promise<void> {
  const { runChannelSkill } = await import('./channels/run-channel-skill.js');
  if (job.context.templateAgentId) process.env.NANOCLAW_TEMPLATE_AGENT_ID = job.context.templateAgentId;
  await runChannelSkill('slack', job.context.displayName, {
    agentName: job.context.agentName,
    role: job.context.role,
    reuse: false,
    requireCompanions: true,
    inputs: {
      connection: 'provisioned',
      bot_token: job.app.botToken!,
      app_token: job.app.appToken,
      owner_handle: job.context.ownerHandle,
    },
    resolveInput: async () => {
      throw new Error('Slack needs an additional input. Resume the Slack setup step.');
    },
    confirm: async () => false,
    openUrl: async () => {},
    fail: async () => {
      throw new Error('Slack channel installation needs attention.');
    },
  });
}
export async function runSlackJob(
  root = process.cwd(),
  overrides: Partial<WorkerDependencies> = {},
  ready: () => void = () => {},
): Promise<void> {
  const release = await processLock(`${slackJobFile(root)}.lock`);
  ready();
  if (!release) return;
  try {
    const job = await readSlackJob(root);
    if (!job || ['failed', 'expired'].includes(job.status)) return;
    const deps: WorkerDependencies = {
      receive,
      install,
      sleep,
      now: Date.now,
      report: async (current) => {
        await slackProgressClient(current).request('POST', '/api/v1/device/slack', {
          appId: current.app.appId,
          setupId: current.setupId,
          status: current.status,
        });
      },
      ...overrides,
    };
    const save = () => writePrivate(slackJobFile(root), job);
    let reported = job.reportedStatus;
    const report = async () => {
      if (reported === job.status) return;
      try {
        await deps.report(job);
        reported = job.status;
        job.reportedStatus = reported;
        await save();
      } catch (error: any) {
        if ([401, 403].includes(error.status)) throw error;
      }
    };
    while (deps.now() < Date.parse(job.expiresAt)) {
      let applying = false;
      try {
        await report();
        if (job.status === 'complete') {
          if (reported === 'complete') return;
          await deps.sleep(30_000);
          continue;
        }
        if (!job.app.botToken) {
          const delivery = await deps.receive(job, {});
          if (delivery.status === 'deleted') throw Object.assign(new Error(), { code: 'app_revoked' });
          if (!delivery.bot_token) {
            if (delivery.status === 'installed') throw Object.assign(new Error(), { code: 'credential_unavailable' });
            await deps.sleep(30_000);
            continue;
          }
          if (!delivery.delivery_id || !delivery.bot_token.startsWith('xoxb-'))
            throw Object.assign(new Error(), { code: 'invalid_delivery' });
          job.app.botToken = delivery.bot_token;
          job.deliveryId = delivery.delivery_id;
          job.status = 'installing';
          // This fsync + atomic rename MUST precede acknowledgement. A lost
          // response or crash replays the same receipt to this installation.
          await save();
        }
        if (job.deliveryId && !job.acknowledged) {
          await deps.receive(job, { deliveryId: job.deliveryId });
          job.acknowledged = true;
          await save();
        }
        job.status = 'installing';
        await save();
        await report();
        await withSetupLock(async () => {
          // Check revocation again after a potentially long wait for setup.
          const current = await deps.receive(job, { statusOnly: true });
          if (current.status !== 'installed') throw Object.assign(new Error(), { code: 'app_revoked' });
          await deps.report(job);
          applying = true;
          await deps.install(job);
          job.status = 'complete';
          await save();
        }, root);
        await report();
      } catch (error: any) {
        if (
          [401, 403, 404].includes(error.status) ||
          ['app_revoked', 'credential_unavailable', 'invalid_delivery', 'invalid_service'].includes(error.code) ||
          applying
        ) {
          job.status = 'failed';
          job.error = [401, 403].includes(error.status) ? 'sign_in_required' : error.code || 'install_needs_attention';
          await save();
          await deps.report(job).catch(() => {});
          return;
        }
        // Offline, rate limits, and temporary service errors are retryable.
        await deps.sleep(30_000);
      }
    }
    if (job.status !== 'complete') {
      job.status = 'expired';
      job.error = 'approval_window_expired';
      await save();
      await deps.report(job).catch(() => {});
    }
  } finally {
    release();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  runSlackJob(process.cwd(), {}, () => {
    if (process.send) {
      process.send({ type: 'slack-worker-ready' });
      process.disconnect();
    }
  }).catch(() => {
    process.exitCode = 1;
  });
}

```

### Core Architecture Module: `src/channels/question-render-registry.ts`
```
/**
 * Question-card render resolver registry.
 *
 * Optional modules register compact-card metadata lookups at import time.
 * The host's existing DB lookup remains the final fallback for core question
 * and approval rows.
 */
import type { Adapter, ActionEvent } from 'chat';
import { getAskQuestionRender } from '../db/sessions.js';
import { log } from '../log.js';
import type { NormalizedOption } from './ask-question.js';

export interface QuestionRender {
  title: string;
  question?: string;
  options: NormalizedOption[];
  /** Optional channel presentation. Decision authorization always remains in core. */
  renderMessage?: (questionId: string) => Parameters<Adapter['postMessage']>[1];
  renderTerminal?: (resolution: string) => Parameters<Adapter['postMessage']>[1];
  /** The coordinator updates the card only after it authorizes and records the decision. */
  deferResolution?: boolean;
}

export type QuestionRenderResolver = (
  questionId: string,
) => QuestionRender | undefined | Promise<QuestionRender | undefined>;

const resolvers: QuestionRenderResolver[] = [];

export function registerQuestionRenderResolver(resolver: QuestionRenderResolver): void {
  resolvers.push(resolver);
}

export async function resolveQuestionRender(questionId: string): Promise<QuestionRender | undefined> {
  for (const resolver of [...resolvers]) {
    /* eslint-disable no-catch-all/no-catch-all -- one optional resolver must not block later resolvers or the built-in fallback */
    try {
      const render = await resolver(questionId);
      if (render) return render;
    } catch (err) {
      log.error('Question render resolver threw', { err });
    }
    /* eslint-enable no-catch-all/no-catch-all */
  }
  return getAskQuestionRender(questionId);
}

export type QuestionActionHandler = (event: ActionEvent, adapter: Adapter, instance: string) => Promise<boolean>;
const actionHandlers: QuestionActionHandler[] = [];
export function registerQuestionActionHandler(handler: QuestionActionHandler): void {
  actionHandlers.push(handler);
}
export async function dispatchQuestionAction(event: ActionEvent, adapter: Adapter, instance: string): Promise<boolean> {
  for (const handler of actionHandlers) if (await handler(event, adapter, instance)) return true;
  return false;
}

```

### Core Architecture Module: `src/cli/help-render.ts`
```
/**
 * Pure renderers for command help. Single source for three surfaces that must
 * never disagree:
 *   - `ncl <resource> help [<verb>]` (commands/help.ts)
 *   - `--help` on any command (dispatch interception)
 *   - the usage block appended to invalid-args errors (crud.ts validation)
 *
 * Imports only types from crud.ts, so crud.ts can import these functions at
 * runtime without a cycle.
 */
import type { ColumnDef, CustomOperation, ResourceDef } from './crud.js';

const GENERIC_VERBS = ['list', 'get', 'create', 'update', 'delete'] as const;
type GenericVerb = (typeof GENERIC_VERBS)[number];

export function flagName(col: Pick<ColumnDef, 'name'>): string {
  return `--${col.name.replace(/_/g, '-')}`;
}

/** First line of a possibly multi-paragraph description. */
export function summaryLine(description: string): string {
  return description.split('\n', 1)[0];
}

/** Indent every non-empty line of a block by `pad`. */
export function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}

function flagLine(col: ColumnDef, extraTags: string[] = []): string {
  const tags: string[] = [...extraTags];
  if (col.required) tags.push('required');
  if (col.default !== undefined && col.default !== null) tags.push(`default: ${col.default}`);
  if (col.enum) tags.push(`values: ${col.enum.join(' | ')}`);
  const tagStr = tags.length > 0 ? ` (${tags.join(', ')})` : '';
  return `  ${flagName(col).padEnd(28)} ${summaryLine(col.description)}${tagStr}`;
}

/** All verbs a resource exposes, generics first, in help order. */
export function listVerbs(res: ResourceDef): string[] {
  const verbs: string[] = GENERIC_VERBS.filter((v) => res.operations[v]);
  if (res.customOperations) verbs.push(...Object.keys(res.customOperations));
  return verbs;
}

/** Flags a generic verb accepts, derived from the resource's columns. */
function genericFlags(res: ResourceDef, verb: GenericVerb): ColumnDef[] {
  switch (verb) {
    case 'create':
      return res.columns.filter((c) => !c.generated);
    case 'update':
      return res.columns.filter((c) => c.updatable);
    case 'list':
      // Non-generated columns double as equality filters.
      return [
        ...res.columns.filter((c) => !c.generated).map((c) => ({ ...c, required: false })),
        { name: 'limit', type: 'number', description: 'Max rows returned.', default: 200 } as ColumnDef,
      ];
    case 'get':
    case 'delete':
      return [];
  }
}

function genericSummary(res: ResourceDef, verb: GenericVerb): string {
  switch (verb) {
    case 'list':
      return `List ${res.plural}. Flags below act as equality filters.`;
    case 'get':
      return `Get a ${res.name} by ID.`;
    case 'create':
      return `Create a new ${res.name}.`;
    case 'update':
      return `Update a ${res.name} by ID. Provide at least one updatable flag.`;
    case 'delete':
      return `Delete a ${res.name} by ID.`;
  }
}

/**
 * Deep help for one verb: usage line, full description, flags, examples.
 * `verb` is a custom-operation key or a generic CRUD verb. Returns undefined
 * for a verb the resource doesn't have.
 */
export function renderVerbHelp(res: ResourceDef, verb: string): string | undefined {
  const op: CustomOperation | undefined = res.customOperations?.[verb];
  const generic = !op && (GENERIC_VERBS as readonly string[]).includes(verb) ? (verb as GenericVerb) : undefined;
  if (!op && !generic) return undefined;
  if (generic && !res.operations[generic]) return undefined;

  const access = op ? op.access : res.operations[generic!];
  const accessTag = access && access !== 'open' ? ` [${access}]` : '';
  const needsId = generic === 'get' || generic === 'update' || generic === 'delete';

  const lines: string[] = [];
  lines.push(`ncl ${res.plural} ${verb}${needsId ? ' <id>' : ''}${accessTag}`);
  lines.push('');
  lines.push(op ? op.description : genericSummary(res, generic!));

  const flags = op ? (op.args ?? []) : genericFlags(res, generic!);
  if (flags.length > 0) {
    lines.push('');
    lines.push('Flags:');
    for (const f of flags) lines.push(flagLine(f));
  }
  if (op?.examples?.length) {
    lines.push('');
    lines.push('Examples:');
    for (const ex of op.examples) lines.push(indent(ex, '  '));
  }
  return lines.join('\n');
}

```

### Core Architecture Module: `src/concurrency.ts`
```
/**
 * Bounded-concurrency map with per-item isolation. `fn` runs over `items`
 * with at most `limit` calls in flight; results come back in input order as
 * settled results, so one failing item never hides the others' outcomes and
 * the caller decides what a rejection means.
 *
 * The host's per-session loops (delivery polls, the sweep's workqueue) fan
 * over hundreds of session mailboxes. Against a remote mailbox each visit is
 * independent network IO that should overlap; the limit keeps a burst from
 * opening unbounded connections and keeps a slow key from monopolizing the
 * loop.
 */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      /* eslint-disable no-catch-all/no-catch-all -- isolation is the point: every rejection is returned to the caller as a settled result */
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
      /* eslint-enable no-catch-all/no-catch-all */
    }
  };
  const workers = Math.max(1, Math.min(Math.floor(limit), items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3194** (2026-08-18): **`/update-nanoclaw` can stamp success without a recoverable cutover**
  *Symptoms*: ## What happens  `/update-nanoclaw` changes the running checkout before the update has passed validation. Its rollback point protects Git, but not the SQLite database, gitignored configuration, or external components changed during the update.  This leaves four failure windows on current `main` at `358f1a81`:  1. The merge changes source mounted into new agent containers while the host is    still accepting messages. New source can run against the old image before    validation or an image rebuild finishes. 2. Installed channel and provider refreshes have no blocking result contract.    A selected refresh can fail or do nothing, then the updater still stamps    success. 3. Using the printed rollback after a failed restart resets Git without undoing    a forward SQLite migration, `.env` change, or OneCLI pin move. 4. The upgrade marker records only `package.json` version. It cannot distinguish    two commits with the same version, and restart success is not checked through    the real CLI socket.  The result can be a checkout that reports a successful update but cannot be recovered by the rollback command it printed.  ## Why it happens  The current skill is a sequence of live commands without durable transaction state.  - It merges directly into the live checkout, then installs dependencies and   validates afterward. - The backup branch and tag cover source code only. - `/update-skills` fetches registry branches from `origin`, which is normally   the user's fork, then records 

- **Issue #2995** (2026-07-13): **Outbound messages to an offline channel adapter are marked delivered without any send**
  *Symptoms*: ## What happens  When the channel adapter for an outbound message is not registered, the delivery loop still marks the message as delivered. This state is easy to reach: credentials are missing so the factory returned null, setup failed, or a named instance is offline.  The `delivered` row gets `status='delivered'` with `platform_message_id=NULL`. The log says "Message delivered". File attachments are deleted from the outbox. No send happened. The user never sees the message, and the operator sees a healthy delivery log.  ## Why it happens  Verified against main at 0c0f4c2.  1. The delivery bridge returns `undefined` when it cannot find the exact adapter. It only logs a warning    ([`src/channels/channel-registry.ts:86-89`](https://github.com/nanocoai/nanoclaw/blob/0c0f4c2592d7f4191eff92e7d4a3a9b7042f74d9/src/channels/channel-registry.ts#L86-L89)). 2. `undefined` is also the normal return for an adapter that sends fine but has no platform message id. The caller cannot tell the two apart. 3. `drainSession` treats any return without a throw as success and calls    `markDelivered(inDb, msg.id, platformMsgId ?? null)`    ([`src/delivery.ts:195-196`](https://github.com/nanocoai/nanoclaw/blob/0c0f4c2592d7f4191eff92e7d4a3a9b7042f74d9/src/delivery.ts#L195-L196)). 4. Before returning, `deliverMessage` also logs "Message delivered" and calls `clearOutbox`, so attachment files are gone too    ([`src/delivery.ts:379-387`](https://github.com/nanocoai/nanoclaw/blob/0c0f4c2592d7f4191eff92e7

- **Issue #2868** (2026-08-18): **/update-skills is a silent no-op for already-installed channels — pre-flight skips the code/deps refresh**
  *Symptoms*: ## Summary  Running `/update-skills` on an installed channel does not refresh that channel's adapter code or pinned dependency. It silently skips the only steps that would do so.  This nullifies the `[Unreleased]` CHANGELOG migration that asks users to "re-run `/add-<channel>`" to pick up the `4.29.0` Chat SDK adapter — live on main today for anyone tracking trunk via `git pull` / `pnpm install`; pending the next manual release for tagged users. Either way the migration tool silently does nothing.  ## How it fails  `/update-skills` Step 3 invokes the corresponding `/add-<name>` skill via the Skill tool (`.claude/skills/update-skills/SKILL.md`):  > Its apply runs its own pre-flight, fetches the latest files from upstream… and installs any pinned dependency.  But each per-channel skill starts with an idempotent pre-flight that short-circuits when the channel is already installed. From `.claude/skills/add-discord/SKILL.md` (quoted from `main`):  > ### Pre-flight (idempotent) > Skip to **Credentials** if all of these are already in place: > - `src/channels/discord.ts` exists > - `src/channels/index.ts` contains `import './discord.js';` > - `src/channels/discord-registration.test.ts` exists > - `@chat-adapter/discord` is listed in `package.json` dependencies  For any channel that has been installed once, those conditions are always true. The pre-flight skips:  1. `git fetch origin channels` 2. `git show origin/channels:src/channels/discord.ts > src/channels/discord.ts` 3. The barr
  **Post-Mortem & Fix Analysis**:
  > ## Option C — preferred fix direction (after cross-checking all channels)  Both options A and B in the issue have structural problems (see below). A third approach holds more cleanly.  ### Why A and B fall short  **Option A (`--force` flag):** - Doesn't fix direct `/add-<channel>` reruns — users manually re-running the skill still hit the silent no-op unless they know the flag - Bypassing pre-flight routes into the Credentials section, requiring another skip rule for "update mode" — two flags' worth of state - Silently overrides deliberate user version pins with no warning  **Option B (move fetch/bump into `/update-skills`):** - Makes `/update-skills` channel-aware; adding a new channel now requires editing two files - Version pin ownership becomes ambiguous — the per-channel skill owns the pin today; centralizing the bump requires either fragile markdown parsing or a duplicate pin table - Doesn't fix direct `/add-<channel>` reruns either  ### Option C — split the pre-flight by concern

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

### Incident Patch 1: `a49ffd71` (2026-10-05)
**Commit Message**: fix(onecli): migration warning points back to the pin, not the old version (#4041)

The warning added in #4039 said "Roll back (step 4)", which saves the old
version and could start a newer gateway again. It now says to put the
gateway back on the pin (step 2). The backup paragraph also says what the
one restore test showed.

**File**: `.claude/skills/add-onecli/payload/docs/onecli-upgrades.md` (modified, +2/-2)
```diff
@@ -55,15 +55,15 @@ Back up the gateway database before you pull or restart. A newer gateway can mig
 cd ~/.onecli && (umask 077 && F=~/onecli-db-backup-$(date +%Y%m%d-%H%M%S).sql && docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$F.part" && grep -q 'PostgreSQL database dump complete' "$F.part" && mv "$F.part" "$F" || { rm -f "$F.part"; echo "Backup failed, nothing saved" >&2; exit 1; }; ls -l "$F")
 ```
 
-It prints the new file only when the dump is complete. If the dump fails or stops early, it says so and leaves no file behind; a leftover file ending in `.part` is not a backup. Only you can read the file. `postgres` is the database service in the stock compose file; use your service's name if it differs. Restoring from this dump has not been tested. Stored secrets are encrypted with a key kept outside the database. By default it is the `secret-encryption-key` file in the `app-data` volume; if you set `SECRET_ENCRYPTION_KEY` yourself, it is wherever you set it. Either way, the dump alone does not recover secrets without that key.
+It prints the new file only when the dump is complete. If the dump fails or stops early, it says so and leaves no file behind; a leftover file ending in `.part` is not a backup. Only you can read the file. `postgres` is the database service in the stock compose file; use your service's name if it differs. Restoring it was tested once, from 1.45.0 back to 1.42.0: loaded with `psql` into a new, empty database, it brought the gateway back without the startup error and with its stored secret. There is no restore command in this guide yet. Stored secrets are encrypted with a key kept outside the database. By default it is the `secret-encryption-key` file in the `app-data` volume; if you set `SECRET_ENCRYPTION_KEY` yourself, it is wherever you set it. Either way, the dump alone does not recover secrets without that key.
 
 Then pull and restart:
 
 ```bash
 cd ~/.onecli && env -u ONECLI_VERSION docker compose pull onecli && env -u ONECLI_VERSION docker compose up -d
 ```
 
-**If a gateway newer than the pin has started, even briefly:** it can migrate its database, and going back to the pin does not undo that. Roll back (step 4), then check `docker logs onecli 2>&1 | grep -iE 'migrat|error'`. In testing, rolling back from 1.43.3 worked; from 1.45.0 it left a `policy_rule_identities.agent_group_id does not exist` error at startup. Access rules and approvals were not checked either time. If you see a database error, restore a backup taken before the newer version ran (the one from step 2, if you took it in time). There is no other tested repair, so otherwise [open an issue](https://github.com/nanocoai/nanoclaw/issues) with the log lines.
+**If a gateway newer than the pin has started, even briefly:** it can migrate its database, and going back to the pin does not undo that. Put the gateway back on the pin (step 2), then check `docker logs onecli 2>&1 | grep -iE 'migrat|error'`. In testing, rolling back from 1.43.3 worked; from 1.45.0 it left a `policy_rule_identities.agent_group_id does not exist` error at startup. Access rules and approvals were not checked either time. If you see a database error, restore a backup taken before the newer version ran (the one from step 2, if you took it in time). There is no other tested repair, so otherwise [open an issue](https://github.com/nanocoai/nanoclaw/issues) with the log lines.
 
 ## 3. Verify
 
```

**File**: `scripts/onecli-upgrade-guide.test.ts` (modified, +9/-0)
```diff
@@ -152,4 +152,13 @@ describe('OneCLI upgrade guide: save commands', () => {
     expect(r.stderr).toContain('Not saved');
     expect(fs.readFileSync(envFile, 'utf8')).toBe('ONECLI_VERSION=1.42.0\n');
   });
+
+  it('the migration warning sends the reader back to the pin, not to the old version', () => {
+    const warning = fs
+      .readFileSync(GUIDE, 'utf8')
+      .split('\n')
+      .find((l) => l.startsWith('**If a gateway newer than the pin'));
+    expect(warning).toContain('back on the pin (step 2)');
+    expect(warning).not.toContain('step 4');
+  });
 });
```

---

### Incident Patch 2: `89841756` (2026-10-05)
**Commit Message**: fix(onecli): upgrade guide refuses an empty gateway pin (#4039)

* fix(onecli): upgrade guide refuses an empty gateway pin

An empty ONECLI_VERSION in ~/.onecli/.env makes the stock compose file
run latest, and a newer gateway migrates its database on first start.

- Save commands (upgrade and rollback) stop before touching .env when the
  value is empty or not version-shaped; a refused rollback does not restart.
- Name the pin file by its full path, .claude/skills/add-onecli/versions.json.
- Warn that going back to the pin does not undo a newer gateway's migrations.
- Test the guide's save commands against a throwaway HOME.

* fix(onecli): simplify the guide's pin check and migration warning

The save commands now use one grep for the version shape (rollback also
takes the rollback tag), and the warning is cut to the two tested cases.

* fix(onecli): back up the gateway database before the upgrade

The guide told people to restore a backup it never asked them to take.
Step 2 now dumps the database to a new private file before the pull and
restart, and prints it only when the dump is complete.

* fix(onecli): make a failed gateway backup loud

A failed or cut-off dump now prints an

**File**: `.claude/skills/add-onecli/SKILL.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ import './onecli.js';
 
 The setup script safely reuses a healthy existing installation, installs the pinned local gateway when absent, or uses `NANOCLAW_ONECLI_API_HOST` and `NANOCLAW_ONECLI_API_TOKEN` for a remote gateway.
 
-This integration supports exactly the gateway version pinned in `versions.json` (`onecli-gateway`, today 1.42.0). OneCLI 1.43 and later remove the agent secret-assignment API used below, so 1.43+ is not supported for now. Setup reuses an existing gateway without checking its version: follow [Upgrading the OneCLI gateway](payload/docs/onecli-upgrades.md) to check it and to move it to the pin. The CLI (`onecli-cli`) and SDK (`onecli-sdk`) have their own pins.
+This integration supports exactly the gateway version pinned in `.claude/skills/add-onecli/versions.json` (`onecli-gateway`, today 1.42.0; not the `versions.json` at the project root). OneCLI 1.43 and later remove the agent secret-assignment API used below, so 1.43+ is not supported for now. Setup reuses an existing gateway without checking its version: follow [Upgrading the OneCLI gateway](payload/docs/onecli-upgrades.md) to check it and to move it to the pin. The CLI (`onecli-cli`) and SDK (`onecli-sdk`) have their own pins.
 
 ```nc:run effect:external
 pnpm exec tsx .claude/skills/add-onecli/scripts/setup.ts
```

**File**: `.claude/skills/add-onecli/payload/docs/onecli-upgrades.md` (modified, +21/-12)
```diff
@@ -1,6 +1,6 @@
 # Upgrading the OneCLI gateway
 
-NanoClaw talks to the OneCLI gateway (credential vault + egress proxy) through `@onecli-sh/sdk`. The gateway is an external component with its own release line, so NanoClaw pins the **sanctioned gateway version** in the OneCLI skill's [`versions.json`](../.claude/skills/add-onecli/versions.json) under `onecli-gateway` (not the `versions.json` at the project root). When an update moves that pin, the gateway must be upgraded — this doc is the migration path. It is written to be handed to a coding agent verbatim: detect → upgrade → verify → rollback.
+NanoClaw talks to the OneCLI gateway (credential vault + egress proxy) through `@onecli-sh/sdk`. The gateway is an external component with its own release line, so NanoClaw pins the **sanctioned gateway version** in the OneCLI skill's [`.claude/skills/add-onecli/versions.json`](../.claude/skills/add-onecli/versions.json) under `onecli-gateway` (not the `versions.json` at the project root). When an update moves that pin, the gateway must be upgraded — this doc is the migration path. It is written to be handed to a coding agent verbatim: detect → upgrade → verify → rollback.
 
 There is deliberately **no runtime version check, and setup does not migrate the gateway for you**: the gateway is a separate out-of-band component, and the migrator is your coding agent running `/update-nanoclaw`. The update does not detect a pin move on its own. From 2026.10.0 on, release notes that move the `onecli-gateway` pin carry a `[BREAKING]` line, which stops the update until this doc has been followed; earlier pin moves were not marked, so an older gateway can lag behind its pin. The Detect step below shows whether yours does. (Setup detects a pre-`/v1` gateway and points at this doc, but never upgrades it.) Run the steps below verbatim.
 
@@ -31,10 +31,10 @@ The gateway runs as a Docker service in `~/.onecli`. Upgrade just that container
 
 **Local gateway (the common case).** Run these on the gateway's host; for a **remote gateway**, run them on that host (NanoClaw can't reach it over SSH).
 
-Write the pin to `~/.onecli/.env`, which Docker Compose reads on every later `docker compose` command. A version given only on the command line is gone after that command, so the next plain `docker compose up` falls back to an older saved value or to `latest`. This keeps the file's other settings and its permissions, and the temporary copy is private to you:
+Write the pin to `~/.onecli/.env`, which Docker Compose reads on every later `docker compose` command. A version given only on the command line is gone after that command, so the next plain `docker compose up` falls back to an older saved value or to `latest`. This keeps the file's other settings and its permissions, and the temporary copy is private to you. The command stops without touching the file when the value is empty or not a version:
 
 ```bash
-cd ~/.onecli && (umask 077 && P=<onecli-gateway pin from versions.json> && touch .env && { grep -v '^[[:space:]]*ONECLI_VERSION[[:space:]]*=' .env; echo "ONECLI_VERSION=$P"; } > .env.new && cat .env.new > .env && rm .env.new)
+cd ~/.onecli && (umask 077 && P=<onecli-gateway pin from .claude/skills/add-onecli/versions.json> && { printf '%s\n' "$P" | grep -Eqx '[0-9]+\.[0-9]+\.[0-9]+' || { echo "Not saved: '$P' is not a version like 1.42.0" >&2; exit 1; }; } && touch .env && { grep -v '^[[:space:]]*ONECLI_VERSION[[:space:]]*=' .env; echo "ONECLI_VERSION=$P"; } > .env.new && cat .env.new > .env && rm .env.new)
 ```
 
 Check that the compose file actually uses that value. Installers from older lines wrote the tag as a literal (`image: ghcr.io/onecli/onecli:1.36.0`); then `docker compose` re-pulls the *old* tag, prints `Pulled` / `Running`, and the gateway never moves (found by [#3500](https://github.com/nanocoai/nanoclaw/pull/3500)). `env -u` keeps a stray `ONECLI_VERSION` in your shell from overriding the file:
@@ -43,18 +43,28 @@ Check that the compose file actually uses that value. Installers from older line
 cd ~/.onecli && env -u ONECLI_VERSION docker compose config --images | grep onecli/onecli
 ```
 
-This must print `ghcr.io/onecli/onecli:<pin>`. If it shows any other tag, edit the `onecli` service in `~/.onecli/docker-compose.yml` once so it reads the variable, then run the check again:
+This must print `ghcr.io/onecli/onecli:<pin>`. Do not pull or restart until it does: an empty or missing `ONECLI_VERSION` makes the stock compose file use `latest`, which is newer than the pin. If it shows any other tag, edit the `onecli` service in `~/.onecli/docker-compose.yml` once so it reads the variable, then run the check again:
 
 ```yaml
-    image: ghcr.io/onecli/onecli:${ONECLI_VERSION:-<onecli-gateway pin from versions.json>}
+    image: ghcr.io/onecli/onecli:${ONECLI_VERSION:-<onecli-gateway pin from .claude/skills/add-onecli/versions.json>}
 ```
 
+Back up the gateway database before you pull or restart. A newer gateway can migrate 
```

**File**: `scripts/onecli-upgrade-guide.test.ts` (added, +155/-0)
```diff
@@ -0,0 +1,155 @@
+// Behavior tests for the save commands in the OneCLI upgrade guide.
+//
+// The guide is handed to a coding agent verbatim, so its one-liners are the
+// product. These tests take the two commands that write ONECLI_VERSION to
+// ~/.onecli/.env (upgrade and rollback) OUT of the guide, fill the placeholder,
+// and run them against a throwaway HOME. An empty value must never reach the
+// file: the stock compose file then falls back to `latest`.
+
+import { spawnSync } from 'node:child_process';
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+const GUIDE = path.resolve(__dirname, '../.claude/skills/add-onecli/payload/docs/onecli-upgrades.md');
+const saveLines = fs
+  .readFileSync(GUIDE, 'utf8')
+  .split('\n')
+  .filter((l) => l.includes('echo "ONECLI_VERSION=$P"'));
+const saveLine = (placeholder: RegExp): string => {
+  const hits = saveLines.filter((l) => placeholder.test(l));
+  if (hits.length !== 1) throw new Error(`expected exactly one save command for ${placeholder}, found ${hits.length}`);
+  return hits[0];
+};
+const UPGRADE = /P=<onecli-gateway pin from [^>]+>/;
+const ROLLBACK = /P=<old-version>/;
+
+let home: string;
+let envFile: string;
+
+beforeEach(() => {
+  home = fs.mkdtempSync(path.join(os.tmpdir(), 'onecli-guide-'));
+  fs.mkdirSync(path.join(home, '.onecli'));
+  envFile = path.join(home, '.onecli', '.env');
+});
+afterEach(() => fs.rmSync(home, { recursive: true, force: true }));
+
+function save(placeholder: RegExp, value: string, shell = 'sh') {
+  const cmd = saveLine(placeholder).replace(placeholder, () => `P=${value}`);
+  return spawnSync(shell, ['-c', cmd], { env: { PATH: process.env.PATH ?? '', HOME: home }, encoding: 'utf8' });
+}
+
+describe('OneCLI upgrade guide: save commands', () => {
+  it('names the pin file by its full path in every placeholder', () => {
+    const guide = fs.readFileSync(GUIDE, 'utf8');
+    expect(guide).not.toMatch(/pin from versions\.json/);
+    expect(saveLines).toHaveLength(2);
+  });
+
+  it('backs up the gateway database before the pull and restart', () => {
+    const guide = fs.readFileSync(GUIDE, 'utf8');
+    const backup = guide.split('\n').filter((l) => l.includes('pg_dump'));
+    expect(backup).toHaveLength(1);
+    expect(backup[0]).not.toMatch(/!|\s#\s/);
+    expect(guide.indexOf(backup[0])).toBeLessThan(guide.indexOf('docker compose pull onecli'));
+    expect(spawnSync('sh', ['-n', '-c', backup[0]]).status).toBe(0);
+  });
+
+  // `docker` is a stub that prints what a complete, cut-off, or failed dump would.
+  it.each([
+    ['complete', 'echo "-- PostgreSQL database dump complete"', true],
+    ['cut off', 'echo "CREATE TABLE x"', false],
+    ['failed', 'echo "CREATE TABLE x"; exit 1', false],
+  ])('backup keeps the file only for a complete dump: %s', (_name, body, kept) => {
+    const backup = fs
+      .readFileSync(GUIDE, 'utf8')
+      .split('\n')
+      .filter((l) => l.includes('pg_dump'))[0];
+    const bin = path.join(home, 'bin');
+    fs.mkdirSync(bin);
+    fs.writeFileSync(path.join(bin, 'docker'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
+    const r = spawnSync('sh', ['-c', backup], {
+      env: { PATH: `${bin}:${process.env.PATH ?? ''}`, HOME: home },
+      encoding: 'utf8',
+    });
+    const files = fs.readdirSync(home).filter((f) => f.startsWith('onecli-db-backup-'));
+    expect(r.status === 0).toBe(kept);
+    expect(files).toHaveLength(kept ? 1 : 0);
+    if (kept) expect(fs.statSync(path.join(home, files[0])).mode & 0o777).toBe(0o600);
+    else expect(r.stderr).toContain('Backup failed, nothing saved');
+  });
+
+  // An unquoted `!` is history expansion when pasted into interactive zsh or bash.
+  // So is a trailing `#` comment in zsh, where it is a parse error.
+  it('save commands contain no `!` and no trailing comment', () => {
+    for (const l of saveLines) expect(l).not.toMatch(/!|\s#\s/);
+  });
+
+  it('a refused rollback save does not go on to restart the gateway', () => {
+    fs.writeFileSync(envFile, 'ONECLI_VERSION=\n');
+    const bin = path.join(home, 'bin');
+    fs.mkdirSync(bin);
+    fs.writeFileSync(path.join(bin, 'docker'), `#!/bin/sh\necho "$@" >> "${home}/docker.log"\n`, { mode: 0o755 });
+    const cmd = saveLine(ROLLBACK).replace(ROLLBACK, 'P=');
+    const r = spawnSync('sh', ['-c', cmd], {
+      env: { PATH: `${bin}:${process.env.PATH ?? ''}`, HOME: home },
+      encoding: 'utf8',
+    });
+    expect(r.status).not.toBe(0);
+    expect(fs.existsSync(path.join(home, 'docker.log'))).toBe(false);
+  });
+
+  for (const shell of ['sh', 'bash']) {
+    it(`upgrade save writes the pin and keeps other settings (${shell})`, () => {
+      fs.writeFileSync(envFile, 'ONECLI_BIND_HOST=172.17.0.1\nONECLI_VERSION=1.41.0\n', { mode: 0o600 });
+      const r = save(UPGRADE, '1.42.0', shell);
+      expect(r.status).toBe(0);
+      expect(fs.readFil
```

---

### Incident Patch 3: `1d5e7045` (2026-10-05)
**Commit Message**: fix(update): wait for the launchd host to exit after bootout (#4037)

launchctl bootout returns while the host still runs its shutdown
handlers, so the mutable-state snapshot raced the shutdown and the next
bootstrap failed with "5: Input/output error". stopService now polls
launchctl print until the job has left the domain and its process has
exited, bounded like the nohup branch (60 x 500 ms), and names the
start command if it never stops.

Fixes #4021

**File**: `scripts/update/service.test.ts` (modified, +68/-8)
```diff
@@ -639,26 +639,86 @@ describe('stopService idempotency (already-stopped is success, per mode)', () =>
     sleep: async () => {},
   });
 
-  it('tolerates launchd bootout of a not-loaded job, in launchctl own words', async () => {
+  // launchctl as stopService sees it: `print` succeeds while the job is in the
+  // domain (`loadedPolls` more times after bootout), then exits 113.
+  function launchd(options: { loadedPolls: number; pid?: number; bootout?: string }) {
+    let remaining: number | undefined;
+    const calls: string[] = [];
+    let sleeps = 0;
     const runner: CommandRunner = {
-      run() {
-        throw new Error('Command failed: launchctl bootout gui/501/x\nBoot-out failed: 3: No such process');
+      run(command, args) {
+        calls.push(`${command} ${args.join(' ')}`);
+        if (args[0] === 'bootout') {
+          remaining = options.loadedPolls;
+          if (options.bootout) throw new Error(`Command failed: launchctl bootout ${args[1]}\n${options.bootout}`);
+          return '';
+        }
+        if (remaining === undefined || remaining-- > 0) return `state = running\n\tpid = ${options.pid ?? 99999999}\n`;
+        throw Object.assign(new Error('Could not find service'), { status: 113, stderr: 'Could not find service' });
       },
       tryRun: () => ({ ok: true, stdout: '' }),
     };
-    await expect(stopService({ mode: 'launchd', active: true, name: 'x' }, env(runner))).resolves.toBeUndefined();
+    const environment: ServiceEnvironment = {
+      ...env(runner),
+      sleep: async () => {
+        sleeps += 1;
+      },
+    };
+    return { environment, calls, sleeps: () => sleeps };
+  }
+  const handle: ServiceHandle = { mode: 'launchd', active: true, name: 'x', definition: '/Users/me/x.plist' };
+
+  it('waits after launchd bootout until the job has left the domain', async () => {
+    const fake = launchd({ loadedPolls: 3 });
+    await expect(stopService(handle, fake.environment)).resolves.toBeUndefined();
+    expect(fake.sleeps()).toBe(3);
+    expect(fake.calls.slice(0, 2)).toEqual(['launchctl print gui/501/x', 'launchctl bootout gui/501/x']);
+  });
+
+  it('waits for the host process itself when the job is gone first', async () => {
+    const host = spawn('node', ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
+    try {
+      const fake = launchd({ loadedPolls: 0, pid: host.pid });
+      let sleeps = 0;
+      fake.environment.sleep = async () => {
+        sleeps += 1;
+        host.kill('SIGKILL');
+        await new Promise((resolve) => setTimeout(resolve, 50));
+      };
+      await expect(stopService(handle, fake.environment)).resolves.toBeUndefined();
+      expect(sleeps).toBeGreaterThan(0);
+    } finally {
+      host.kill('SIGKILL');
+    }
+  });
+
+  it('throws when the launchd job is still loaded after the bounded wait', async () => {
+    const fake = launchd({ loadedPolls: Infinity, pid: 4242 });
+    await expect(stopService(handle, fake.environment)).rejects.toThrow(
+      /NanoClaw service x did not stop \(PID 4242\)\..*start it again with: launchctl bootstrap gui\/501 /,
+    );
+    expect(fake.sleeps()).toBe(60);
+  });
+
+  it('tolerates launchd bootout of a not-loaded job, in launchctl own words', async () => {
+    const fake = launchd({ loadedPolls: 0, bootout: 'Boot-out failed: 3: No such process' });
+    await expect(stopService(handle, fake.environment)).resolves.toBeUndefined();
+    expect(fake.sleeps()).toBe(0);
   });
 
   it('still throws for any other launchd stop failure — the caller must abort before destroying anything', async () => {
+    const fake = launchd({ loadedPolls: 0, bootout: 'Boot-out failed: 5: Input/output error' });
+    await expect(stopService(handle, fake.environment)).rejects.toThrow(/Input\/output error/);
+  });
+
+  it('refuses when launchctl cannot say whether the job is still loaded', async () => {
     const runner: CommandRunner = {
       run() {
-        throw new Error('Boot-out failed: 5: Input/output error');
+        throw Object.assign(new Error('Could not find domain'), { status: 112, stderr: 'Could not find domain' });
       },
       tryRun: () => ({ ok: true, stdout: '' }),
     };
-    await expect(stopService({ mode: 'launchd', active: true, name: 'x' }, env(runner))).rejects.toThrow(
-      /Input\/output error/,
-    );
+    await expect(stopService(handle, env(runner))).rejects.toThrow(/Cannot tell whether NanoClaw is running/);
   });
 
   it('tolerates ESRCH for a nohup pid that already exited', async () => {
```

**File**: `scripts/update/service.ts` (modified, +29/-1)
```diff
@@ -276,11 +276,39 @@ export function detectService(projectRoot: string, env: ServiceEnvironment): Ser
 export async function stopService(handle: ServiceHandle, env: ServiceEnvironment): Promise<void> {
   if (!handle.active) return;
   if (handle.mode === 'launchd') {
+    const target = `gui/${env.uid}/${handle.name}`;
+    // Every PID the job reports: KeepAlive can swap the host between probes.
+    const pids = new Set<number>();
+    const loaded = () => {
+      const job = probe(
+        env,
+        'launchctl',
+        ['print', target],
+        [113],
+        'Run the update from a login session of this user.',
+      );
+      const pid = Number(/^\s*pid = (\d+)/m.exec(job?.stdout ?? '')?.[1]);
+      if (pid) pids.add(pid);
+      return job !== undefined;
+    };
+    loaded();
     try {
-      env.runner.run('launchctl', ['bootout', `gui/${env.uid}/${handle.name}`]);
+      env.runner.run('launchctl', ['bootout', target]);
     } catch (err) {
       if (!/No such process/i.test(err instanceof Error ? err.message : String(err))) throw err;
     }
+    // bootout returns while the host still runs its shutdown handlers. Wait for
+    // the job to leave the domain and the process to exit, or the snapshot races
+    // the shutdown and the next bootstrap fails with "5: Input/output error".
+    const stopping = () => loaded() || [...pids].some(processExists);
+    for (let i = 0; i < 60 && stopping(); i += 1) await env.sleep(500);
+    if (stopping()) {
+      const start = startCommand(handle, env.uid);
+      throw new Error(
+        `NanoClaw service ${handle.name} did not stop (PID ${[...pids].join(', ') || 'unknown'}). ` +
+          `Once it has exited, start it again with: ${start}`,
+      );
+    }
   } else if (handle.mode === 'systemd-user') {
     adoptUserRuntimeDir(env.uid);
     env.runner.run('systemctl', ['--user', 'stop', handle.name!]);
```

**File**: `scripts/update/transaction.e2e.test.ts` (modified, +3/-0)
```diff
@@ -1001,6 +1001,9 @@ describe('update-nanoclaw transaction end to end', () => {
           events.push('service stop');
           return '';
         }
+        if (command === 'launchctl' && args[0] === 'print' && !running) {
+          throw Object.assign(new Error('Could not find service'), { status: 113 });
+        }
         return '';
       },
       tryRun: () => ({ ok: true, stdout: '' }),
```

---

### Incident Patch 4: `ad1b50e8` (2026-10-05)
**Commit Message**: fix(onecli): hold the gateway on 1.42.0 and stop /add-dial-tool on 1.42+ (#4036)

OneCLI 1.43 removes the agent secret-assignment API the integration uses,
and 1.42 already rejects legacy rule writes, which /add-dial-tool needs.

- Upgrade guide: save ONECLI_VERSION in ~/.onecli/.env, check the compose
  file uses it, and verify the running image tag after upgrade and rollback.
- add-onecli: state that exactly the pinned gateway (1.42.0) is supported.
- add-dial-tool: read the CLI's gateway version first and stop on 1.42+
  before the Dial sign-up or key write; removal tolerates rule 410s.

Co-authored-by: Daisuke Tsuji <[REDACTED_EMAIL]>

**File**: `.claude/skills/add-dial-tool/REMOVE.md` (modified, +7/-1)
```diff
@@ -32,9 +32,15 @@ created are name-prefixed, so only those go — an operator's own rules on
 
 ```bash
 for id in $(onecli secrets list | jq -r '.data[] | select(.name | test("(?i)dial")) | .id'); do onecli secrets delete --id "$id"; done
-for id in $(onecli rules list | jq -r '.data[] | select(.hostPattern=="api.getdial.ai" and .action=="block" and (.name | startswith("Dial: blocked for "))) | .id'); do onecli rules delete --id "$id"; done
+for id in $(onecli rules list | jq -r '.data[] | select(.hostPattern=="api.getdial.ai" and .action=="block" and (.name | startswith("Dial: blocked for "))) | .id'); do onecli rules delete --id "$id" || echo "could not delete rule $id: remove it in the OneCLI console"; done
 ```
 
+On OneCLI gateway 1.42 and later the rule commands fail: legacy rules can no
+longer be changed (1.42) or even listed (1.43+). That is safe once the secret is
+gone, because a leftover block rule only blocks a host that no agent holds a key
+for. Delete the `Dial: blocked for …` policies in the OneCLI console if you want
+them gone.
+
 ## 4. Rebuild and restart the agents
 
 Rebuild the image so it matches the manifest, then restart every group so the
```

**File**: `.claude/skills/add-dial-tool/SKILL.md` (modified, +19/-3)
```diff
@@ -37,6 +37,22 @@ command -v onecli >/dev/null
 
 If it fails, tell the user to run `/init-onecli` first, then retry. Stop here.
 
+This skill scopes Dial with legacy OneCLI block rules. OneCLI gateway 1.42 and
+later reject legacy rule writes (`410`), and that includes 1.42.0, the version
+NanoClaw pins. Writing the Dial key first and then failing on the rules would
+leave every `all`-mode agent able to use Dial. So read the version of the
+gateway the `onecli` CLI talks to before anything is written, and stop unless it
+is older than 1.42. The Dial sign-up and credential steps below use the captured
+version, so they cannot run when this check fails:
+
+```nc:run capture:onecli_gateway validate:^[0-9]+\.[0-9]+\.[0-9]+$ effect:fetch
+U=$(onecli config get api-host | jq -r '.value // empty') && [ -n "$U" ] || { echo "could not read the onecli CLI's api-host, so the OneCLI gateway version cannot be checked. Nothing was written to OneCLI." >&2; exit 1; }; H=$(curl -fsS --max-time 10 "$U/api/health") || { echo "could not reach the OneCLI gateway at $U. Nothing was written to OneCLI." >&2; exit 1; }; V=$(printf '%s' "$H" | jq -er '.version') || V=; case "$V" in 0.*|1.[0-9].*|1.[1-3][0-9].*|1.4[01].*) printf '%s\n' "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' && { echo "$V"; exit 0; };; esac; echo "OneCLI gateway version '${V:-unreadable}' at $U: /add-dial-tool needs legacy OneCLI rules, which gateway 1.42 and later reject. Nothing was written to OneCLI. This skill is not supported on the pinned gateway (1.42.0) until it moves to the OneCLI policy API." >&2; exit 1
+```
+
+If it fails, show the user the message as it is and stop. Do not work around it
+by turning off OneCLI policy enforcement or granting the Dial key by hand: the
+block rules are what keep agents you did not choose away from Dial.
+
 Calls this setup makes to Dial identify the install. The `dial` CLI prepends
 `DIAL_USER_AGENT` to its own token, so the account's requests stay attributable
 to this NanoClaw install in Dial's server-side logs. Resolve the token once
@@ -121,7 +137,7 @@ What's your email? Dial sends a one-time code to verify it. By continuing you cr
 Send the code (`--force` re-sends even if a prior code is pending):
 
 ```nc:run effect:external when:signed_in=false
-DIAL_USER_AGENT={{dial_ua}} dial auth login {{owner_email}} --force
+: "OneCLI gateway {{onecli_gateway}}"; DIAL_USER_AGENT={{dial_ua}} dial auth login {{owner_email}} --force
 ```
 
 ### Verify the code
@@ -136,7 +152,7 @@ Verify it. Do **not** pass `--agent nanoclaw` here: this skill owns the containe
 `dial-cli` skill, and `--agent` would drop a second, unmanaged copy next to it:
 
 ```nc:run effect:external when:signed_in=false
-DIAL_USER_AGENT={{dial_ua}} dial auth verify-otp --code {{otp}}
+: "OneCLI gateway {{onecli_gateway}}"; DIAL_USER_AGENT={{dial_ua}} dial auth verify-otp --code {{otp}}
 ```
 
 ## Put the CLI and its skill in the agent image
@@ -183,7 +199,7 @@ after (`--file`), so it is never on argv or in a captured variable. Selective-mo
 agents pick the new id up in the merge step below:
 
 ```nc:run effect:external
-T=$(mktemp) && chmod 600 "$T" && jq -r '.apiKey // empty' "${XDG_DATA_HOME:-$HOME/.local/share}/dial/auth.v1.json" > "$T" 2>/dev/null; [ -s "$T" ] || { rm -f "$T"; echo "no Dial API key in the host auth file — sign in with dial auth login / verify-otp, then re-run" >&2; exit 1; }; S=$(onecli secrets list | jq -r 'first(.data[] | select(.name | test("(?i)dial"))) | .id // empty'); if [ -n "$S" ]; then onecli secrets delete --id "$S" >/dev/null || { rm -f "$T"; echo "could not remove the previous Dial secret $S" >&2; exit 1; }; fi; onecli secrets create --name "Dial API" --type generic --file "$T" --host-pattern api.getdial.ai --header-name Authorization --value-format "Bearer {value}" >/dev/null; rc=$?; rm -f "$T"; exit $rc
+: "OneCLI gateway {{onecli_gateway}}"; T=$(mktemp) && chmod 600 "$T" && jq -r '.apiKey // empty' "${XDG_DATA_HOME:-$HOME/.local/share}/dial/auth.v1.json" > "$T" 2>/dev/null; [ -s "$T" ] || { rm -f "$T"; echo "no Dial API key in the host auth file — sign in with dial auth login / verify-otp, then re-run" >&2; exit 1; }; S=$(onecli secrets list | jq -r 'first(.data[] | select(.name | test("(?i)dial"))) | .id // empty'); if [ -n "$S" ]; then onecli secrets delete --id "$S" >/dev/null || { rm -f "$T"; echo "could not remove the previous Dial secret $S" >&2; exit 1; }; fi; onecli secrets create --name "Dial API" --type generic --file "$T" --host-pattern api.getdial.ai --header-name Authorization --value-format "Bearer {value}" >/dev/null; rc=$?; rm -f "$T"; exit $rc
 ```
 
 ## Scope it to the chosen agents
```

**File**: `.claude/skills/add-dial-tool/apply-fixtures.json` (modified, +8/-0)
```diff
@@ -7,6 +7,10 @@
         "dial_agents": "ag-11111111-1111-1111-1111-111111111111"
       },
       "exec": [
+        {
+          "match": "/api/health",
+          "stdout": "1.41.0"
+        },
         {
           "match": "package.json",
           "stdout": "nanoclaw/2.2.0"
@@ -29,6 +33,10 @@
         "otp": "123456"
       },
       "exec": [
+        {
+          "match": "/api/health",
+          "stdout": "1.41.0"
+        },
         {
           "match": "package.json",
           "stdout": "nanoclaw/2.2.0"
```

**File**: `.claude/skills/add-onecli/SKILL.md` (modified, +2/-0)
```diff
@@ -40,6 +40,8 @@ import './onecli.js';
 
 The setup script safely reuses a healthy existing installation, installs the pinned local gateway when absent, or uses `NANOCLAW_ONECLI_API_HOST` and `NANOCLAW_ONECLI_API_TOKEN` for a remote gateway.
 
+This integration supports exactly the gateway version pinned in `versions.json` (`onecli-gateway`, today 1.42.0). OneCLI 1.43 and later remove the agent secret-assignment API used below, so 1.43+ is not supported for now. Setup reuses an existing gateway without checking its version: follow [Upgrading the OneCLI gateway](payload/docs/onecli-upgrades.md) to check it and to move it to the pin. The CLI (`onecli-cli`) and SDK (`onecli-sdk`) have their own pins.
+
 ```nc:run effect:external
 pnpm exec tsx .claude/skills/add-onecli/scripts/setup.ts
 ```
```

**File**: `.claude/skills/add-onecli/payload/docs/onecli-upgrades.md` (modified, +40/-6)
```diff
@@ -4,6 +4,8 @@ NanoClaw talks to the OneCLI gateway (credential vault + egress proxy) through `
 
 There is deliberately **no runtime version check, and setup does not migrate the gateway for you**: the gateway is a separate out-of-band component, and the migrator is your coding agent running `/update-nanoclaw`. The update does not detect a pin move on its own. From 2026.10.0 on, release notes that move the `onecli-gateway` pin carry a `[BREAKING]` line, which stops the update until this doc has been followed; earlier pin moves were not marked, so an older gateway can lag behind its pin. The Detect step below shows whether yours does. (Setup detects a pre-`/v1` gateway and points at this doc, but never upgrades it.) Run the steps below verbatim.
 
+**Supported version: exactly the pin (today 1.42.0).** OneCLI 1.43 and later remove the agent secret-assignment API this integration uses (`onecli agents set-secrets`), so 1.43+ is not supported for now. Never upgrade past the pin, and never rerun the upstream installer (`curl … onecli.sh/install | sh`) without `ONECLI_VERSION` set to the pin: without it, the installer installs the newest release. Rerunning `/add-onecli` does not fix a wrong version either, because setup reuses any healthy gateway without checking which version it runs.
+
 ## 1. Detect
 
 Find out what is running and what is required:
@@ -27,13 +29,31 @@ Why gateways fall behind: the OneCLI installer's docker-compose tracks the `late
 
 The gateway runs as a Docker service in `~/.onecli`. Upgrade just that container to the pinned `onecli-gateway` version — vault data lives in named Docker volumes and survives. This upgrades only the gateway; the CLI binary is pinned separately (see below).
 
-**Local gateway (the common case):**
+**Local gateway (the common case).** Run these on the gateway's host; for a **remote gateway**, run them on that host (NanoClaw can't reach it over SSH).
+
+Write the pin to `~/.onecli/.env`, which Docker Compose reads on every later `docker compose` command. A version given only on the command line is gone after that command, so the next plain `docker compose up` falls back to an older saved value or to `latest`. This keeps the file's other settings and its permissions, and the temporary copy is private to you:
+
+```bash
+cd ~/.onecli && (umask 077 && P=<onecli-gateway pin from versions.json> && touch .env && { grep -v '^[[:space:]]*ONECLI_VERSION[[:space:]]*=' .env; echo "ONECLI_VERSION=$P"; } > .env.new && cat .env.new > .env && rm .env.new)
+```
+
+Check that the compose file actually uses that value. Installers from older lines wrote the tag as a literal (`image: ghcr.io/onecli/onecli:1.36.0`); then `docker compose` re-pulls the *old* tag, prints `Pulled` / `Running`, and the gateway never moves (found by [#3500](https://github.com/nanocoai/nanoclaw/pull/3500)). `env -u` keeps a stray `ONECLI_VERSION` in your shell from overriding the file:
 
 ```bash
-cd ~/.onecli && ONECLI_VERSION=<onecli-gateway pin from versions.json> docker compose pull onecli && ONECLI_VERSION=<onecli-gateway pin from versions.json> docker compose up -d
+cd ~/.onecli && env -u ONECLI_VERSION docker compose config --images | grep onecli/onecli
 ```
 
-**Remote gateway** — run the same command on the gateway's host (NanoClaw can't reach it over SSH).
+This must print `ghcr.io/onecli/onecli:<pin>`. If it shows any other tag, edit the `onecli` service in `~/.onecli/docker-compose.yml` once so it reads the variable, then run the check again:
+
+```yaml
+    image: ghcr.io/onecli/onecli:${ONECLI_VERSION:-<onecli-gateway pin from versions.json>}
+```
+
+Then pull and restart:
+
+```bash
+cd ~/.onecli && env -u ONECLI_VERSION docker compose pull onecli && env -u ONECLI_VERSION docker compose up -d
+```
 
 ## 3. Verify
 
@@ -43,14 +63,23 @@ Host-side health is necessary but **not sufficient**:
 curl -s "$GW/v1/health"     # must return {"status":"ok",...}; GW from the Detect step
 ```
 
+**Confirm the pinned version is the one running.** Health alone cannot tell an upgraded gateway from one that never moved:
+
+```bash
+docker inspect -f '{{.Config.Image}}' onecli    # gateway host: must print ghcr.io/onecli/onecli:<pin>
+curl -s "$GW/api/health"                        # its "version" must be the pin, or "unknown"
+```
+
+If the tag is not the pin, go back to step 2: the pin is not saved, or the compose file does not use it. If `version` reports 1.43 or later, this gateway is not supported; roll back to the pin (step 4). From a NanoClaw host that only reaches a remote gateway, the `version` field is the only check; it says `unknown` on some builds, so then check the tag on the gateway host.
+
 **Verify the bind interface (container reachability).** Agent containers reach the gateway over the docker bridge (`host.docker.internal` → e.g. `172.17.0.1`), so a server bound only to `127.0.0.1` boots clean host-side while every credentialed call from containers dies at the proxy:
 
 ```bash
 docker run --rm
```

**File**: `.claude/skills/add-onecli/references/chatgpt-oauth-refresh.md` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@ reauthentication, for OpenCode the
 The same procedure also handles revoked credentials.
 
 Do not assume a gateway upgrade resolves unattended ChatGPT operation.
-OneCLI 1.43.1 removes the agent-grant API used by this NanoClaw version, so that
-upgrade also requires an integration migration and validation of token refresh.
+OneCLI 1.43 and later remove the agent-grant API used by this NanoClaw version, so
+that upgrade also requires an integration migration and validation of token refresh.
 A different proxy is not established as compatible by these tests.
 
 The container holds only a fixed non-secret sentinel. Token refresh and account
```

**File**: `scripts/add-dial-tool-scope.test.ts` (modified, +88/-2)
```diff
@@ -30,6 +30,7 @@ import path from 'node:path';
 
 import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 
+import { applySkill } from './skill-apply.js';
 import { parseDirectives, type Directive } from './skill-directives.js';
 
 const SKILL_MD = path.resolve(__dirname, '../.claude/skills/add-dial-tool/SKILL.md');
@@ -45,6 +46,7 @@ const isRun = (effect: string, needle: string) => (d: Directive) =>
 
 // The commands under test, as written in the document.
 const CMD = {
+  versionGuard: one((d) => d.kind === 'run' && d.attrs.capture === 'onecli_gateway'),
   typoGuard: one(isRun('check', 'unknown agent group')),
   credential: one(isRun('external', 'onecli secrets')),
   ensureAgents: one(isRun('wire', 'onecli agents create')),
@@ -131,6 +133,7 @@ function setup(
 S="$STATE"
 arg() { local k="$1"; shift; while [ $# -gt 0 ]; do if [ "$1" = "$k" ]; then echo "$2"; return; fi; shift; done; }
 case "$1 $2" in
+  "config get") if [ -f "$S/api-host" ]; then cat "$S/api-host"; else echo '{"key":"api-host","value":"http://gw.test:10254"}'; fi ;;
   "secrets list") cat "$S/secrets.json" ;;
   "secrets delete") i=$(arg --id "$@"); jq --arg i "$i" '.data |= map(select(.id != $i))' "$S/secrets.json" > "$S/t" && mv "$S/t" "$S/secrets.json"; echo '{"status":"deleted"}' ;;
   "secrets create") f=$(arg --file "$@"); [ -n "$f" ] && cat "$f" > "$S/key-seen"; jq '.data += [{"id":"sec-new","name":"Dial API"}]' "$S/secrets.json" > "$S/t" && mv "$S/t" "$S/secrets.json"; echo '{"id":"sec-new"}' ;;
@@ -148,8 +151,8 @@ esac`,
 }
 
 /** Run one document command under POSIX sh with {{dial_agents}} substituted. */
-function sh(cmd: string, agents = ''): { stdout: string; status: number } {
-  const substituted = cmd.replaceAll('{{dial_agents}}', agents);
+function sh(cmd: string, agents = '', extraEnv: Record<string, string> = {}): { stdout: string; status: number } {
+  const substituted = cmd.replaceAll('{{dial_agents}}', agents).replaceAll('{{onecli_gateway}}', '1.41.0');
   try {
     const stdout = execFileSync('sh', ['-c', substituted], {
       cwd: root,
@@ -161,6 +164,7 @@ function sh(cmd: string, agents = ''): { stdout: string; status: number } {
         STATE: state,
         XDG_DATA_HOME: process.env.TEST_XDG,
         HOME: root,
+        ...extraEnv,
       },
       stdio: ['ignore', 'pipe', 'pipe'],
     });
@@ -377,3 +381,85 @@ describe('add-dial-tool: registering the host credential with OneCLI', () => {
     expect(callLines().some((l) => l.startsWith('onecli secrets'))).toBe(false);
   });
 });
+
+describe('add-dial-tool: OneCLI gateway version guard', () => {
+  // Legacy rule writes return 410 from gateway 1.42 on; the guard must stop
+  // before the credential step writes the key, or all-mode agents get Dial.
+  function guard(health: string | null, opts: { apiHost?: string; curlExit?: number } = {}) {
+    if (opts.apiHost !== undefined) fs.writeFileSync(path.join(state, 'api-host'), opts.apiHost);
+    const out = health === null ? 'echo "connection refused" >&2' : `echo '${health}'`;
+    writeStub('curl', `${out}\nexit ${opts.curlExit ?? (health === null ? 7 : 0)}`);
+    return sh(CMD.versionGuard);
+  }
+  const health = (version?: string) => JSON.stringify({ status: 'ok', ...(version ? { version } : {}) });
+
+  it.each(['1.41.0', '1.36.0', '1.9.2', '0.8.0'])('passes on gateway %s and captures the version', (v) => {
+    const r = guard(health(v));
+    expect(r.status).toBe(0);
+    expect(r.stdout.trim()).toBe(v);
+    expect(callLines()).toContain('curl -fsS --max-time 10 http://gw.test:10254/api/health');
+  });
+
+  it.each(['1.42.0', '1.43.3', '1.100.0', '2.7.0', 'unknown', 'dev', '1.41', '1.41.0-x'])(
+    'stops on gateway %s',
+    (v) => {
+      const r = guard(health(v));
+      expect(r.status).not.toBe(0);
+      expect(r.stdout).toBe('');
+    },
+  );
+
+  it('stops on a missing version, invalid JSON, a failed transfer, or an unreachable gateway', () => {
+    expect(guard(health()).status).not.toBe(0);
+    expect(guard(`${health('1.41.0')}garbage`).status).not.toBe(0);
+    expect(guard(health('1.41.0'), { curlExit: 18 }).status).not.toBe(0);
+    expect(guard(null).status).not.toBe(0);
+  });
+
+  it('checks the host the onecli CLI writes to, and stops without one', () => {
+    expect(guard(health('1.41.0'), { apiHost: '{"key":"api-host","value":"http://other:1"}' }).status).toBe(0);
+    expect(callLines()).toContain('curl -fsS --max-time 10 http://other:1/api/health');
+    expect(guard(health('1.41.0'), { apiHost: '{"key":"api-host","value":""}' }).status).not.toBe(0);
+    expect(callLines().filter((l) => l.startsWith('curl'))).toHaveLength(1);
+  });
+
+  it('runs before anything is written, and the credential step depends on its capture', () => {
+    const order = directives.filter((d) => d.kind === 'run').map((d) => d.body.join('\n'));
+    const at = order.indexOf(CMD.versionGuard);
+    expect(at).toBeGreaterThanOrEqual(0);
+    expect(at).toBeLessThan(o
```

---

### Incident Patch 5: `d1352230` (2026-10-05)
**Commit Message**: fix(setup): fetch the current WhatsApp Web version before linking (#4017)

* fix(setup): fetch the current WhatsApp Web version before linking

The whatsapp-auth step asked Baileys for the WhatsApp Web version and, when
that failed (web.whatsapp.com often answers sw.js with 429), connected with
Baileys' bundled version. WhatsApp rejects that version with 405 before a QR
or pairing code appears, so linking waited two minutes and reported
"timeout".

Port the channels-branch fix (6c455330, 5ada9509) to trunk: try the
wppconnect version tracker, then sw.js, and fail at once with a one-line
reason when neither gives a current version. Baileys never throws here; it
resolves with its bundled version and isLatest: false, so the check uses
isLatest rather than the presence of a version. The version is resolved
once, so the 515 reconnect does not look it up again mid-link.

Drop the Baileys v6 getPlatformId patch. /add-whatsapp has pinned
7.0.0-rc.9 since a8e0a7f0, where the patch is a no-op, and its top-level
createRequire of the ESM package relied on require(esm), which Node 22
enables by default only from 22.12.

* fix(setup): stop the WhatsApp link step at once when WhatsApp closes the 

**File**: `setup/whatsapp-auth-version.test.ts` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+
+import { resolveWaWebVersion, type SwJsLookup, type WaWebVersion } from './whatsapp-auth-version.js';
+
+const TRACKER_PAGE = '<h2>Current Version</h2><a>2.3000.1049101571-alpha</a><a>2.3000.1049075336-alpha</a>';
+const SW_JS: WaWebVersion = [2, 3000, 1049110567];
+const BUNDLED: WaWebVersion = [2, 3000, 1027934701];
+
+function stubTracker(answer: Response | Error): void {
+  vi.stubGlobal(
+    'fetch',
+    vi.fn(async () => {
+      if (answer instanceof Error) throw answer;
+      return answer;
+    }),
+  );
+}
+
+const swJs = (result: Awaited<ReturnType<SwJsLookup>>) => vi.fn<SwJsLookup>(async () => result);
+
+afterEach(() => {
+  vi.unstubAllGlobals();
+});
+
+describe('resolveWaWebVersion', () => {
+  it("uses the tracker's current version without asking web.whatsapp.com", async () => {
+    stubTracker(new Response(TRACKER_PAGE));
+    const lookup = swJs({ version: SW_JS, isLatest: true });
+
+    await expect(resolveWaWebVersion(lookup)).resolves.toEqual([2, 3000, 1049101571]);
+    expect(lookup).not.toHaveBeenCalled();
+  });
+
+  it('falls back to sw.js when the tracker answers 429, even if the page names a version', async () => {
+    stubTracker(new Response(TRACKER_PAGE, { status: 429 }));
+
+    await expect(resolveWaWebVersion(swJs({ version: SW_JS, isLatest: true }))).resolves.toEqual(SW_JS);
+  });
+
+  it("fails instead of using Baileys' bundled version when both lookups fail", async () => {
+    stubTracker(new TypeError('fetch failed'));
+    // What Baileys resolves with when sw.js fails: no throw, just its stale default.
+    const lookup = swJs({ version: BUNDLED, isLatest: false });
+
+    await expect(resolveWaWebVersion(lookup)).rejects.toThrow('Could not fetch current WhatsApp Web version');
+  });
+});
```

**File**: `setup/whatsapp-auth-version.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/**
+ * Current WhatsApp Web version for the whatsapp-auth step. The version bundled
+ * in Baileys goes stale and WhatsApp then rejects it (405) before a QR or
+ * pairing code appears, so this never falls back to it.
+ */
+
+export type WaWebVersion = [number, number, number];
+
+/** Baileys' `fetchLatestWaWebVersion`: on failure it resolves with its bundled version and `isLatest: false`. */
+export type SwJsLookup = (init: { signal: AbortSignal }) => Promise<{ version: WaWebVersion; isLatest: boolean }>;
+
+const TRACKER_URL = 'https://wppconnect.io/whatsapp-versions/';
+const LOOKUP_TIMEOUT_MS = 5000;
+
+/** wppconnect's tracker first (web.whatsapp.com rate-limits sw.js with 429s), then sw.js, then a clear error. */
+export async function resolveWaWebVersion(lookupSwJs: SwJsLookup): Promise<WaWebVersion> {
+  try {
+    const res = await fetch(TRACKER_URL, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
+    // The page lists the current version first, possibly with a suffix such as -alpha.
+    const match = res.ok ? (await res.text()).match(/2\.3000\.(\d+)/) : null;
+    if (match) return [2, 3000, Number(match[1])];
+  } catch {
+    // Unreachable or timed out: try sw.js.
+  }
+
+  const { version, isLatest } = await lookupSwJs({ signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
+  if (isLatest) return version;
+
+  throw new Error(
+    'Could not fetch current WhatsApp Web version. Check that this machine can reach wppconnect.io and web.whatsapp.com, then run the step again in a few minutes.',
+  );
+}
```

**File**: `setup/whatsapp-auth.ts` (modified, +11/-3)
```diff
@@ -41,6 +41,7 @@ import {
   useMultiFileAuthState,
 } from '@whiskeysockets/baileys';
 import { emitStatus } from './status.js';
+import { resolveWaWebVersion, type WaWebVersion } from './whatsapp-auth-version.js';
 
 const AUTH_DIR = path.join(process.cwd(), 'store', 'auth');
 const PAIRING_CODE_FILE = path.join(process.cwd(), 'store', 'pairing-code.txt');
@@ -144,6 +145,16 @@ export async function run(args: string[]): Promise<void> {
     return;
   }
 
+  // Once, before connecting: a failure is reported as this step's own block,
+  // and the 515 reconnect reuses the version instead of looking it up mid-link.
+  let version: WaWebVersion;
+  try {
+    version = await resolveWaWebVersion(fetchLatestWaWebVersion);
+  } catch (err) {
+    emitStatus('WHATSAPP_AUTH', { STATUS: 'failed', ERROR: err instanceof Error ? err.message : String(err) });
+    process.exit(1);
+  }
+
   fs.mkdirSync(AUTH_DIR, { recursive: true });
 
   return new Promise<void>((resolve) => {
@@ -176,9 +187,6 @@ export async function run(args: string[]): Promise<void> {
 
     async function connectSocket(isReconnect = false): Promise<void> {
       const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
-      const { version } = await fetchLatestWaWebVersion({}).catch(() => ({
-        version: undefined,
-      }));
 
       const sock = makeWASocket({
         version,
```

---

### Incident Patch 6: `7ccc3e6e` (2026-10-04)
**Commit Message**: fix(container): trust the gateway CA in the agent browser (#3998)

* fix(container): trust the gateway CA in the agent browser

Chromium ignores NODE_EXTRA_CA_CERTS and SSL_CERT_FILE and trusts only
the NSS database at ~/.pki/nssdb, so every page loaded through a
TLS-inspecting gateway failed with ERR_CERT_AUTHORITY_INVALID. Import the
gateway CA into that database at agent-runner startup and ship certutil
(libnss3-tools) in the image.

* fix(container): keep an unreadable gateway CA from stopping the agent

Read the CA inside the try so EISDIR/EACCES is logged like a certutil
failure instead of exiting the agent-runner at startup. Drop a nickname
comment that misdescribed certutil, and shorten the header.

**File**: `container/Dockerfile` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
         fonts-noto-color-emoji \
         libgbm1 \
         libnss3 \
+        libnss3-tools \
         libatk-bridge2.0-0 \
         libgtk-3-0 \
         libx11-xcb1 \
```

**File**: `container/agent-runner/src/browser-trust.test.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
+import fs from 'fs';
+import os from 'os';
+import path from 'path';
+
+import { trustGatewayCaForChromium } from './browser-trust.js';
+
+const PEM = (body: string) => `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
+
+let dir: string;
+let calls: string[][];
+const run = (cmd: string, args: string[]) => {
+  calls.push([cmd, ...args]);
+};
+
+beforeEach(() => {
+  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-trust-'));
+  calls = [];
+});
+
+afterEach(() => {
+  fs.rmSync(dir, { recursive: true, force: true });
+});
+
+describe('trustGatewayCaForChromium', () => {
+  test('does nothing without a gateway CA', () => {
+    expect(trustGatewayCaForChromium({ caPath: undefined, home: dir, run })).toBe(0);
+    expect(trustGatewayCaForChromium({ caPath: path.join(dir, 'missing.pem'), home: dir, run })).toBe(0);
+    expect(calls).toEqual([]);
+  });
+
+  test('creates the NSS database and imports each certificate in the bundle', () => {
+    const ca = path.join(dir, 'ca.pem');
+    fs.writeFileSync(ca, `${PEM('AAAA')}\n${PEM('BBBB')}\n`);
+
+    expect(trustGatewayCaForChromium({ caPath: ca, home: dir, run })).toBe(2);
+
+    const db = `sql:${path.join(dir, '.pki', 'nssdb')}`;
+    expect(calls[0]).toEqual(['certutil', '-N', '-d', db, '--empty-password']);
+    expect(calls.slice(1).map((c) => c.slice(0, 9))).toEqual([
+      ['certutil', '-A', '-d', db, '-n', 'nanoclaw-gateway-ca-0', '-t', 'C,,', '-i'],
+      ['certutil', '-A', '-d', db, '-n', 'nanoclaw-gateway-ca-1', '-t', 'C,,', '-i'],
+    ]);
+  });
+
+  test('reuses an existing database', () => {
+    const ca = path.join(dir, 'ca.pem');
+    fs.writeFileSync(ca, PEM('AAAA'));
+    fs.mkdirSync(path.join(dir, '.pki', 'nssdb'), { recursive: true });
+    fs.writeFileSync(path.join(dir, '.pki', 'nssdb', 'cert9.db'), '');
+
+    trustGatewayCaForChromium({ caPath: ca, home: dir, run });
+
+    expect(calls.map((c) => c[1])).toEqual(['-A']);
+  });
+
+  test('an unreadable CA path is logged, not thrown', () => {
+    const logs: string[] = [];
+    expect(trustGatewayCaForChromium({ caPath: dir, home: dir, run, log: (m) => logs.push(m) })).toBe(0);
+    expect(calls).toEqual([]);
+    expect(logs[0]).toContain('EISDIR');
+  });
+
+  test('a certutil failure is logged, not thrown', () => {
+    const ca = path.join(dir, 'ca.pem');
+    fs.writeFileSync(ca, PEM('AAAA'));
+    const logs: string[] = [];
+
+    const count = trustGatewayCaForChromium({
+      caPath: ca,
+      home: dir,
+      run: () => {
+        throw new Error('certutil: not found');
+      },
+      log: (m) => logs.push(m),
+    });
+
+    expect(count).toBe(0);
+    expect(logs[0]).toContain('certutil: not found');
+  });
+});
```

**File**: `container/agent-runner/src/browser-trust.ts` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+/**
+ * Chromium on Linux ignores NODE_EXTRA_CA_CERTS and SSL_CERT_FILE and trusts only
+ * the system roots plus ~/.pki/nssdb, so a TLS-inspecting gateway's CA must be
+ * imported there or every agent-browser page fails. HOME is per-container (--rm),
+ * so the database is fresh on every spawn and always matches the mounted CA.
+ */
+import { execFileSync } from 'child_process';
+import fs from 'fs';
+import os from 'os';
+import path from 'path';
+
+type Run = (cmd: string, args: string[]) => void;
+
+const PEM_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
+
+const defaultRun: Run = (cmd, args) => {
+  execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
+};
+
+export function trustGatewayCaForChromium(
+  opts: {
+    caPath?: string;
+    home?: string;
+    run?: Run;
+    log?: (msg: string) => void;
+  } = {},
+): number {
+  const caPath = opts.caPath ?? process.env.NODE_EXTRA_CA_CERTS;
+  const home = opts.home ?? process.env.HOME ?? os.homedir();
+  const run = opts.run ?? defaultRun;
+  const log = opts.log ?? (() => {});
+  if (!caPath || !fs.existsSync(caPath)) return 0;
+
+  const nssDir = path.join(home, '.pki', 'nssdb');
+  const db = `sql:${nssDir}`;
+  try {
+    const certs = fs.readFileSync(caPath, 'utf8').match(PEM_BLOCK) ?? [];
+    if (certs.length === 0) return 0;
+    fs.mkdirSync(nssDir, { recursive: true, mode: 0o700 });
+    if (!fs.existsSync(path.join(nssDir, 'cert9.db'))) {
+      run('certutil', ['-N', '-d', db, '--empty-password']);
+    }
+    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-ca-'));
+    try {
+      certs.forEach((pem, i) => {
+        const file = path.join(tmp, `${i}.pem`);
+        fs.writeFileSync(file, pem + '\n');
+        run('certutil', ['-A', '-d', db, '-n', `nanoclaw-gateway-ca-${i}`, '-t', 'C,,', '-i', file]);
+      });
+    } finally {
+      fs.rmSync(tmp, { recursive: true, force: true });
+    }
+    log(`Trusted ${certs.length} gateway CA certificate(s) for Chromium`);
+    return certs.length;
+  } catch (err) {
+    // Never fatal: the agent still runs, only browser HTTPS through the gateway fails.
+    log(`Could not add gateway CA to Chromium trust: ${err instanceof Error ? err.message : String(err)}`);
+    return 0;
+  }
+}
```

**File**: `container/agent-runner/src/index.ts` (modified, +4/-0)
```diff
@@ -23,6 +23,7 @@ import fs from 'fs';
 import path from 'path';
 import { fileURLToPath } from 'url';
 
+import { trustGatewayCaForChromium } from './browser-trust.js';
 import { loadConfig } from './config.js';
 import { buildSystemPromptAddendum } from './destinations.js';
 import { getTaskSeriesId } from './db/session-routing.js';
@@ -63,6 +64,9 @@ async function main(): Promise<void> {
   // operator-run migration and never happen in this normal startup path.
   ensureMemoryScaffold();
 
+  // The agent browser trusts only NSS, not the gateway CA env vars.
+  trustGatewayCaForChromium({ log });
+
   // Runtime-generated system-prompt addendum: agent identity (name) plus
   // the live destinations map. Everything else (capabilities, per-module
   // instructions, per-channel formatting) is loaded by Claude Code from
```

---

### Incident Patch 7: `6a82c287` (2026-10-04)
**Commit Message**: fix(claude): pass CLAUDE_CODE_AUTO_COMPACT_WINDOW from the host into the container (#3999)

* fix(claude): pass CLAUDE_CODE_AUTO_COMPACT_WINDOW from the host into the container

The agent-runner reads the override from the container env, but the host
builds that env from scratch, so a host or .env value never arrived. The
claude provider now contributes it through the provider env lane.

* fix(claude): fall back to .env on an empty service value; test the real spawn resolution

* fix(providers): import claude first in the barrel so skill-appended imports merge cleanly

**File**: `container/agent-runner/src/providers/claude.ts` (modified, +3/-3)
```diff
@@ -195,9 +195,9 @@ function createPreCompactHook(assistantName?: string): HookCallback {
  * Claude Code auto-compacts context at this window (tokens). Kept here so
  * the generic bootstrap doesn't need to know about Claude-specific env vars.
  *
- * Operator override: set CLAUDE_CODE_AUTO_COMPACT_WINDOW in the host env to
- * raise or lower the threshold without editing source — useful when running
- * with a 1M-context model variant or when emergency-tuning a deployment.
+ * Operator override: set CLAUDE_CODE_AUTO_COMPACT_WINDOW in the host env or
+ * `.env`; the host-side claude provider (src/providers/claude.ts) passes it
+ * into the container. Useful with a 1M-context model variant.
  */
 const CLAUDE_CODE_AUTO_COMPACT_WINDOW = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW || '165000';
 
```

**File**: `src/providers/claude.test.ts` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+import fs from 'fs';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+
+const TEST_ROOT = '/tmp/nanoclaw-claude-provider-env-test';
+
+vi.mock('../config.js', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('../config.js')>()),
+  DATA_DIR: '/tmp/nanoclaw-claude-provider-env-test/data',
+  GROUPS_DIR: '/tmp/nanoclaw-claude-provider-env-test/groups',
+}));
+
+const dotenv = vi.hoisted(() => ({ values: {} as Record<string, string> }));
+vi.mock('../env.js', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('../env.js')>()),
+  readEnvFile: (keys: string[]) =>
+    Object.fromEntries(keys.flatMap((k) => (k in dotenv.values ? [[k, dotenv.values[k]]] : []))),
+}));
+
+// The DB-backed project-doc compose is not under test here.
+vi.mock('../project-doc-compose.js', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('../project-doc-compose.js')>()),
+  composeGroupProjectDoc: async () => {},
+}));
+
+import { resolveProviderContribution } from '../container-runner.js';
+import type { ContainerConfig } from '../container-config.js';
+import type { AgentGroup, Session } from '../types.js';
+import '../provider-contracts/index.js';
+import './index.js';
+
+const KEY = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';
+const previous = process.env[KEY];
+
+afterEach(() => {
+  if (previous === undefined) delete process.env[KEY];
+  else process.env[KEY] = previous;
+  dotenv.values = {};
+  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
+});
+
+// The spawn path's own resolution; composeSessionSpec puts contribution.env on
+// the contributed lane (container-runner.test.ts).
+async function claudeEnv(): Promise<Record<string, string> | undefined> {
+  const session = { id: 'session-1', agent_group_id: 'group-1', agent_provider: null } as Session;
+  const group = { id: 'group-1', folder: 'claude-env' } as AgentGroup;
+  const config: ContainerConfig = {
+    provider: 'claude',
+    mcpServers: {},
+    packages: { apt: [], npm: [] },
+    additionalMounts: [],
+    skills: [],
+  };
+  fs.mkdirSync(`${TEST_ROOT}/groups/claude-env`, { recursive: true });
+  return (await resolveProviderContribution(session, group, config)).contribution.env;
+}
+
+describe('claude provider container env', () => {
+  it('passes CLAUDE_CODE_AUTO_COMPACT_WINDOW from the host env into the container', async () => {
+    process.env[KEY] = '900000';
+    expect((await claudeEnv())?.[KEY]).toBe('900000');
+  });
+
+  it('falls back to .env when the service env does not carry it', async () => {
+    delete process.env[KEY];
+    dotenv.values = { [KEY]: '500000' };
+    expect((await claudeEnv())?.[KEY]).toBe('500000');
+  });
+
+  it('treats an empty service value as unset and still reads .env', async () => {
+    process.env[KEY] = ' ';
+    dotenv.values = { [KEY]: '500000' };
+    expect((await claudeEnv())?.[KEY]).toBe('500000');
+  });
+
+  it('contributes nothing when unset, leaving the in-container default', async () => {
+    delete process.env[KEY];
+    expect((await claudeEnv())?.[KEY]).toBeUndefined();
+  });
+
+  it('drops a non-numeric value instead of passing it through', async () => {
+    process.env[KEY] = '1m';
+    expect((await claudeEnv())?.[KEY]).toBeUndefined();
+  });
+});
```

**File**: `src/providers/claude.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+/**
+ * Host-side container config for the `claude` provider.
+ *
+ * The agent-runner reads CLAUDE_CODE_AUTO_COMPACT_WINDOW from the container
+ * env, which the host builds from scratch. Pass the operator's value through
+ * (service env, else `.env`, which the host does not load into process.env).
+ */
+import { readEnvFile } from '../env.js';
+import { log } from '../log.js';
+import { registerProviderContainerConfig } from './provider-container-registry.js';
+
+const KEY = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';
+
+registerProviderContainerConfig('claude', (ctx) => {
+  const value = ctx.hostEnv[KEY]?.trim() || readEnvFile([KEY])[KEY]?.trim();
+  if (!value) return {};
+  if (!/^[1-9]\d*$/.test(value)) {
+    log.warn(`Ignoring ${KEY}: expected a positive integer token count`, { value });
+    return {};
+  }
+  return { env: { [KEY]: value } };
+});
```

**File**: `src/providers/index.ts` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
+import './claude.js';
 // Host-side provider container-config barrel.
 // Providers that need host-side container setup (extra mounts, env passthrough,
-// per-session directories) self-register on import. Providers with no host
-// needs (claude) don't appear here.
+// per-session directories) self-register on import.
 //
 // Skills add a new provider by appending one import line below.
```

**File**: `src/providers/provider-container-registry.ts` (modified, +3/-3)
```diff
@@ -7,9 +7,9 @@
  * the registered config fn, and merges the returned mounts/env into the spawn
  * args.
  *
- * Providers without host-side needs (e.g. `claude`) don't appear in
- * this registry at all — the lookup returns `undefined` and the spawn path
- * proceeds with only the default mounts and env.
+ * Providers without host-side needs don't appear in this registry at all —
+ * the lookup returns `undefined` and the spawn path proceeds with only the
+ * default mounts and env.
  *
  * Skills add a new provider's host config by creating `src/providers/<name>.ts`
  * with a top-level `registerProviderContainerConfig(...)` call, then appending
```

---

### Incident Patch 8: `e6c30ff1` (2026-10-04)
**Commit Message**: fix(log): keep nested toJSON redaction when a value holds a BigInt or a cycle (#3983)

* fix(log): honor nested toJSON when a value holds a BigInt or a cycle

safeStringify fell back to inspect() of the top-level value when
JSON.stringify threw, which skipped any nested toJSON redaction. The
replacer now maps BigInt to a string and cycles to [Circular], so
stringify no longer throws on them; anything else that throws prints
[unserializable] instead of the raw value.

* test(log): cover shared references and a cycle inside a toJSON result

**File**: `src/log.test.ts` (modified, +55/-3)
```diff
@@ -48,8 +48,7 @@ describe('log never throws on unserializable data', () => {
     expect(written.join('')).toContain('10n');
   });
 
-  it('honors a top-level toJSON when stringify throws on its result', () => {
-    // The BigInt in toJSON's result makes stringify throw, so the inspect fallback runs.
+  it('honors a top-level toJSON whose result holds a BigInt', () => {
     const value = {
       token: 'SECRET',
       toJSON() {
@@ -113,12 +112,65 @@ describe('log never throws on unserializable data', () => {
     expect(out).not.toContain('SECRET');
   });
 
-  it('keeps fields four levels deep in the inspect fallback', () => {
+  it('keeps fields four levels deep next to a BigInt', () => {
     const err = { n: 1n, a: { b: { c: { d: { code: 'E_DEEP' } } } } };
     log.warn('deep', { err });
     expect(written.join('')).toContain('E_DEEP');
   });
 
+  const redactor = () => ({
+    token: 'SECRET',
+    toJSON() {
+      return { token: '[redacted]' };
+    },
+  });
+
+  it('honors a nested toJSON when a sibling is a BigInt', () => {
+    log.warn('nested bigint', { err: { creds: redactor(), n: 1n } });
+    const out = written.join('');
+    expect(out).toContain('[redacted]');
+    expect(out).toContain('1n');
+    expect(out).not.toContain('SECRET');
+  });
+
+  it('honors a nested toJSON when the value has a cycle', () => {
+    const err: Record<string, unknown> = { creds: redactor() };
+    err.self = err;
+    log.warn('nested cycle', { err });
+    const out = written.join('');
+    expect(out).toContain('[redacted]');
+    expect(out).toContain('[Circular');
+    expect(out).not.toContain('SECRET');
+  });
+
+  it('does not mark a shared, non-circular reference as circular', () => {
+    const x = { a: 1 };
+    log.warn('shared', { v: { p: x, q: x, r: [x] }, n: 1n });
+    expect(written.join('')).not.toContain('[Circular');
+  });
+
+  it('marks a cycle inside a toJSON result', () => {
+    const value = {
+      token: 'SECRET',
+      toJSON() {
+        const o: Record<string, unknown> = { token: '[redacted]' };
+        o.self = o;
+        return o;
+      },
+    };
+    log.warn('toJSON cycle', { err: { creds: value } });
+    const out = written.join('');
+    expect(out).toContain('[Circular');
+    expect(out).not.toContain('SECRET');
+  });
+
+  it('honors a top-level toJSON', () => {
+    log.warn('top-level', { err: redactor() });
+    const out = written.join('');
+    expect(out).toContain('[redacted]');
+    expect(out).not.toContain('SECRET');
+  });
+
   it('survives a Proxy with throwing traps, as a value or as the data bag', () => {
     expect(() => log.warn('proxy value', { err: new Proxy({}, throwingTraps) })).not.toThrow();
     expect(() => log.warn('proxy bag', new Proxy({}, throwingTraps) as Record<string, unknown>)).not.toThrow();
```

**File**: `src/log.ts` (modified, +11/-13)
```diff
@@ -1,5 +1,3 @@
-import { inspect } from 'node:util';
-
 const LEVELS = { debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
 type Level = keyof typeof LEVELS;
 
@@ -17,23 +15,23 @@ const FULL_RESET = '\x1b[0m';
 
 const threshold = LEVELS[(process.env.LOG_LEVEL as Level) || 'info'] ?? LEVELS.info;
 
-const INSPECT_OPTS = { breakLength: Infinity, depth: 6 };
-
 function safeStringify(v: unknown): string {
-  // JSON.stringify throws on cycles and BigInt; inspect handles both. Anything
-  // inspect cannot handle falls through to the catch in emit.
-  let root: { value: unknown } | undefined;
+  // The replacer runs after each toJSON, so nested redaction holds; mapping BigInt
+  // and cycles here keeps stringify from throwing on them.
+  const ancestors: unknown[] = [];
   /* eslint-disable no-catch-all/no-catch-all -- logging must never throw */
   try {
-    // The first replacer call sees the root after toJSON ran, so the fallback
-    // honors a redacting toJSON without calling it twice.
-    return JSON.stringify(v, (_key, value: unknown) => {
-      root ??= { value };
+    return JSON.stringify(v, function (this: unknown, _key, value: unknown) {
+      if (typeof value === 'bigint') return `${value}n`;
+      if (typeof value !== 'object' || value === null) return value;
+      while (ancestors.length && ancestors[ancestors.length - 1] !== this) ancestors.pop();
+      if (ancestors.includes(value)) return '[Circular]';
+      ancestors.push(value);
       return value;
     });
   } catch {
-    // No root means reading or running toJSON threw; never print the raw value.
-    return root ? inspect(root.value, INSPECT_OPTS) : '[unserializable]';
+    // A throwing toJSON, getter or Proxy trap: fail closed, never print the raw value.
+    return '[unserializable]';
   }
   /* eslint-enable no-catch-all/no-catch-all */
 }
```

---

### Incident Patch 9: `7fbf22fb` (2026-10-04)
**Commit Message**: docs(add-onecli): check the gateway at ONECLI_URL in the upgrade guide (#4028)

**File**: `.claude/skills/add-onecli/payload/docs/onecli-upgrades.md` (modified, +12/-7)
```diff
@@ -1,20 +1,25 @@
 # Upgrading the OneCLI gateway
 
-NanoClaw talks to the OneCLI gateway (credential vault + egress proxy) through `@onecli-sh/sdk`. The gateway is an external component with its own release line, so NanoClaw pins the **sanctioned gateway version** in [`versions.json`](../versions.json) under `onecli-gateway`. When an update moves that pin, the gateway must be upgraded — this doc is the migration path. It is written to be handed to a coding agent verbatim: detect → upgrade → verify → rollback.
+NanoClaw talks to the OneCLI gateway (credential vault + egress proxy) through `@onecli-sh/sdk`. The gateway is an external component with its own release line, so NanoClaw pins the **sanctioned gateway version** in the OneCLI skill's [`versions.json`](../.claude/skills/add-onecli/versions.json) under `onecli-gateway` (not the `versions.json` at the project root). When an update moves that pin, the gateway must be upgraded — this doc is the migration path. It is written to be handed to a coding agent verbatim: detect → upgrade → verify → rollback.
 
-There is deliberately **no runtime version check, and setup does not migrate the gateway for you**: the gateway is a separate out-of-band component, and the migrator is your coding agent running `/update-nanoclaw` — it diffs `versions.json` across the update and routes you here when the `onecli-gateway` pin moved. (Setup detects a pre-`/v1` gateway and points at this doc, but never upgrades it.) Run the steps below verbatim.
+There is deliberately **no runtime version check, and setup does not migrate the gateway for you**: the gateway is a separate out-of-band component, and the migrator is your coding agent running `/update-nanoclaw`. The update does not detect a pin move on its own. From 2026.10.0 on, release notes that move the `onecli-gateway` pin carry a `[BREAKING]` line, which stops the update until this doc has been followed; earlier pin moves were not marked, so an older gateway can lag behind its pin. The Detect step below shows whether yours does. (Setup detects a pre-`/v1` gateway and points at this doc, but never upgrades it.) Run the steps below verbatim.
 
 ## 1. Detect
 
 Find out what is running and what is required:
 
 ```bash
-cat versions.json                                   # the sanctioned pin
-curl -s http://127.0.0.1:10254/api/health           # liveness check; `version` field is typically "unknown", not the gateway version
-curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:10254/v1/health
+env_get() { grep -E "^[[:space:]]*$1[[:space:]]*=" .env | cut -d= -f2- | tr -d " \t\r\"'" | grep -v '^$' | tail -1; }
+grep -q "onecli" src/gateway-providers/installed.ts && echo "OneCLI registered" || echo "OneCLI not registered"
+GWP=$(env_get NANOCLAW_GATEWAY_PROVIDER | tr 'A-Z' 'a-z'); echo "provider: ${GWP:-unset}"
+GW=$(env_get ONECLI_URL); echo "ONECLI_URL: ${GW:-none}"   # the address NanoClaw uses
+cat .claude/skills/add-onecli/versions.json         # the sanctioned pin (onecli-gateway)
+docker inspect -f '{{.Config.Image}} {{.Image}}' onecli   # running tag + image ID (local gateway)
+curl -s "$GW/api/health"                            # liveness check; its `version` field may say "unknown"
+curl -s -o /dev/null -w '%{http_code}' "$GW/v1/health"
 ```
 
-If the last command prints `404`, the server predates the `/v1` API that `@onecli-sh/sdk` 2.x requires — every SDK call will fail with 404s that look transient but are permanent. If your gateway is remote, substitute its host for `127.0.0.1` (it's `ONECLI_URL` in `.env`; `NANOCLAW_ONECLI_API_HOST` is a setup-time override only, not persisted to `.env`).
+This doc applies only when OneCLI is registered and the provider is unset or `onecli`; otherwise (for example `iron-proxy`, or OneCLI not registered) **stop: it does not apply**, even if a leftover `ONECLI_URL` is still in `.env`. If your service sets `ONECLI_URL` in its own environment instead of `.env`, use that value for `GW`. If the running tag is `:latest`, note the image ID: it is what you roll back to. Use `ONECLI_URL` rather than `127.0.0.1`: on Linux a local gateway listens on the Docker bridge (for example `http://172.17.0.1:10254`), and for a remote gateway it is the remote host. (`NANOCLAW_ONECLI_API_HOST` is a setup-time override only, not persisted to `.env`.) If the last command prints `404`, the server predates the `/v1` API that `@onecli-sh/sdk` 2.x requires — every SDK call will fail with 404s that look transient but are permanent.
 
 Why gateways fall behind: the OneCLI installer's docker-compose tracks the `latest` image tag, but Docker never re-pulls a tag — the server freezes at whatever `latest` meant on install day.
 
@@ -35,7 +40,7 @@ cd ~/.onecli && ONECLI_VERSION=<onecli-gateway pin from versions.json> docker co
 Host-side health is necessary but **not sufficient**:
 
 ```bash
-curl -s http://127.0.0.1:10254/v1/health     # must return {"status":"ok",...}
+curl -s "$GW/v1/health"     # must return {"
```

---

### Incident Patch 10: `6edcd5ca` (2026-10-04)
**Commit Message**: fix(add-whatsapp): pin Baileys 7.0.0-rc14 for the message-spoofing fix (#4024)

Baileys 7.0.0-rc.9 is inside GHSA-qvv5-jq5g-4cgg (crafted protocol
messages can spoof incoming messages and history sync, and corrupt app
state), fixed in rc12; npm marks rc.9 deprecated. Pin rc14, the latest
release. /update-nanoclaw re-runs nc:dep for installed skills, so
existing WhatsApp installs move to rc14 on their next update.

rc14 adds the ESM-only whatsapp-rust-bridge. The link step's dead v6
getPlatformId patch require()d Baileys, which made the step crash at
load on rc14, so the patch goes; it has done nothing since the v7 pin.

A test keeps the pin at a release that carries the fix.

**File**: `.claude/skills/add-whatsapp/SKILL.md` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ Baileys is the WhatsApp Web client; `qrcode` renders the device-link QR in the
 terminal; `pino` is Baileys' logger:
 
 ```nc:dep
-@whiskeysockets/baileys@7.0.0-rc.9
+@whiskeysockets/baileys@7.0.0-rc14
 qrcode@1.5.4
 @types/qrcode@1.5.6
 pino@9.6.0
```

**File**: `setup/channels/whatsapp.test.ts` (modified, +26/-0)
```diff
@@ -124,3 +124,29 @@ describe('.env write fences (replace, not append)', () => {
     expect(env().split('\n')).toContain('ASSISTANT_NAME=C-3PO (backup)');
   });
 });
+
+describe('Baileys pin', () => {
+  // /update-nanoclaw re-runs this pin on every install, so a stale value spreads
+  // to everyone. GHSA-qvv5-jq5g-4cgg (message spoofing) is fixed from 7.0.0-rc12
+  // on the v7 line the adapter needs.
+  it('pins a Baileys release with the GHSA-qvv5-jq5g-4cgg fix', () => {
+    const versions = directives
+      .filter((d) => d.kind === 'dep')
+      .flatMap((d) => d.body)
+      .filter((s) => s.startsWith('@whiskeysockets/baileys@'))
+      .map((s) => s.slice('@whiskeysockets/baileys@'.length));
+    expect(versions).not.toEqual([]);
+    for (const version of versions) {
+      expect(hasSpoofingFix(version), `add-whatsapp pins @whiskeysockets/baileys@${version}`).toBe(true);
+    }
+  });
+});
+
+/** 7.0.0-rcN with N >= 12, 7.0.0, or any later 7.x or higher release (rc names drop the dot after rc.9). */
+function hasSpoofingFix(version: string): boolean {
+  const m = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.?(\d+))?(?:\+.*)?$/.exec(version);
+  if (!m) return false;
+  const [major, minor, patch, rc] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4]];
+  if (major !== 7) return major > 7;
+  return minor > 0 || patch > 0 || rc === undefined || Number(rc) >= 12;
+}
```

**File**: `setup/whatsapp-auth.ts` (modified, +0/-19)
```diff
@@ -27,7 +27,6 @@
  */
 import fs from 'fs';
 import path from 'path';
-import { createRequire } from 'module';
 // Named import (not default) — pino's d.ts under NodeNext resolves the
 // default export to `typeof pino` (namespace), which isn't callable. The
 // named `pino` export resolves to the callable function.
@@ -47,24 +46,6 @@ const AUTH_DIR = path.join(process.cwd(), 'store', 'auth');
 const PAIRING_CODE_FILE = path.join(process.cwd(), 'store', 'pairing-code.txt');
 const baileysLogger = pino({ level: 'silent' });
 
-// Baileys v6 bug: getPlatformId sends charCode (49) instead of enum value (1).
-// Fixed in Baileys 7.x but not backported. Without this patch pairing codes
-// fail with "couldn't link device" because WhatsApp receives an invalid
-// platform id. createRequire because proto is not a named ESM export.
-const _require = createRequire(import.meta.url);
-// eslint-disable-next-line @typescript-eslint/no-explicit-any
-const { proto } = _require('@whiskeysockets/baileys') as { proto: any };
-try {
-  const _generics = _require('@whiskeysockets/baileys/lib/Utils/generics') as Record<string, unknown>;
-  _generics.getPlatformId = (browser: string): string => {
-    const platformType =
-      proto.DeviceProps.PlatformType[browser.toUpperCase() as keyof typeof proto.DeviceProps.PlatformType];
-    return platformType ? platformType.toString() : '1';
-  };
-} catch {
-  // If CJS require fails, QR auth still works; only pairing code may be affected.
-}
-
 type AuthMethod = 'qr' | 'pairing-code';
 
 /** Extract the bare phone digits from a WhatsApp JID like `14155551234:12@s.whatsapp.net`. */
```

---

### Incident Patch 11: `90477b27` (2026-10-04)
**Commit Message**: fix(update): refresh the installed gateway when only its skill payload changed (#3988)

* fix(update): refresh the installed gateway when only its skill payload changed

The gateway refresh ran only when src/gateway-providers or setup/gateways
changed, so a change confined to the gateway's skill directory never
reached the materialized host copy on an existing install. Also refresh
the selected gateway when its own skill directory changed. A payload-only
change never blocks the update: an unresolvable selection is reported in
the validation checks and skipped.

* docs(update): say when validation refreshes the selected gateway

* refactor(update): one skip path for an unresolvable gateway on skill-only changes

**File**: `.claude/skills/update-nanoclaw/SKILL.md` (modified, +6/-3)
```diff
@@ -129,9 +129,12 @@ pnpm exec tsx "$controller_dir/scripts/update-nanoclaw.ts" validate \
 ```
 
 Validation performs a fork-safe structured refresh of every installed channel
-and provider, commits refreshed payloads in the staging branch, installs frozen
-dependencies, runs the host build and full host tests, and runs the container
-dependency/typecheck leg when Bun is available. A provider skill that declares
+and provider, and of the selected gateway when gateway core or that gateway's
+own skill changed. On a skill-only change, a gateway it cannot resolve is
+skipped and named in the validation checks. It commits refreshed payloads in
+the staging branch, installs frozen dependencies, runs the host build and full
+host tests, and runs the container dependency/typecheck leg when Bun is
+available. A provider skill that declares
 Bun dependencies does not require Bun on the host: refresh runs the exact Bun
 version pinned by `container/Dockerfile` through pnpm. Any selected skill
 refresh or validation failure blocks cutover and the completion stamp.
```

**File**: `scripts/update/transaction.e2e.test.ts` (modified, +149/-36)
```diff
@@ -57,7 +57,47 @@ interface Fixture {
   upstreamHead: string;
 }
 
-function createForkFixture(options: { breaking?: boolean; gatewayExtraction?: boolean } = {}): Fixture {
+function writeOnecliSkill(root: string, payload: string): void {
+  write(
+    root,
+    '.claude/skills/add-onecli/gateway.json',
+    '{"kind":"onecli","label":"OneCLI","description":"Gateway","default":true}\n',
+  );
+  write(
+    root,
+    '.claude/skills/add-onecli/SKILL.md',
+    [
+      '---',
+      'name: add-onecli',
+      'description: Test gateway extraction.',
+      '---',
+      '',
+      '```nc:copy',
+      'payload/src/gateway-providers/onecli.ts -> src/gateway-providers/onecli.ts',
+      '```',
+      '',
+      '```nc:append to:src/gateway-providers/installed.ts',
+      "import './onecli.js';",
+      '```',
+      '',
+    ].join('\n'),
+  );
+  write(
+    root,
+    '.claude/skills/add-onecli/scripts/detect.ts',
+    "import fs from 'node:fs'; console.log(fs.readFileSync('.env', 'utf8').includes('ONECLI_URL=') ? 'installed' : 'absent');\n",
+  );
+  write(root, '.claude/skills/add-onecli/payload/src/gateway-providers/onecli.ts', payload);
+}
+
+function createForkFixture(
+  options: {
+    breaking?: boolean;
+    gatewayExtraction?: boolean;
+    gatewayPayloadOnly?: boolean | 'other';
+    otherSkillOnly?: boolean;
+  } = {},
+): Fixture {
   const seed = temp('nanoclaw-update-seed-');
   exec(seed, 'git', ['init', '-b', 'main']);
   write(seed, 'package.json', '{"name":"nanoclaw-test","version":"2.1.54"}\n');
@@ -72,6 +112,22 @@ function createForkFixture(options: { breaking?: boolean; gatewayExtraction?: bo
   write(seed, 'versions.json', '{"agent-image":"example@sha256:old"}\n');
   write(seed, 'CHANGELOG.md', '# Changelog\n');
   write(seed, 'src/value.ts', 'export const value = "old";\n');
+  if (options.gatewayPayloadOnly) {
+    writeOnecliSkill(seed, "export const gateway = 'onecli-v1';\n");
+    write(seed, 'src/gateway-providers/installed.ts', "// Installed gateway providers.\nimport './onecli.js';\n");
+    write(seed, 'src/gateway-providers/onecli.ts', "export const gateway = 'onecli-v1';\n");
+    write(
+      seed,
+      '.claude/skills/add-other/gateway.json',
+      '{"kind":"other","label":"Other","description":"Gateway","default":false}\n',
+    );
+    write(
+      seed,
+      '.claude/skills/add-other/SKILL.md',
+      '---\nname: add-other\n---\n\n```nc:copy\npayload/other.ts -> src/gateway-providers/other.ts\n```\n',
+    );
+    write(seed, '.claude/skills/add-other/payload/other.ts', "export const gateway = 'other-v1';\n");
+  }
   commit(seed, 'base');
 
   const official = temp('nanoclaw-update-official-');
@@ -81,7 +137,20 @@ function createForkFixture(options: { breaking?: boolean; gatewayExtraction?: bo
   fs.rmSync(fork, { recursive: true });
   exec(path.dirname(fork), 'git', ['clone', '--bare', official, fork]);
 
-  write(seed, 'src/value.ts', 'export const value = "new";\n');
+  // A payload-only upstream change touches nothing outside the skill directory.
+  if (options.gatewayPayloadOnly === 'other') {
+    write(seed, '.claude/skills/add-other/payload/other.ts', "export const gateway = 'other-v2';\n");
+  } else if (options.gatewayPayloadOnly) {
+    write(
+      seed,
+      '.claude/skills/add-onecli/payload/src/gateway-providers/onecli.ts',
+      "export const gateway = 'onecli-v2';\n",
+    );
+  } else if (options.otherSkillOnly) {
+    write(seed, '.claude/skills/customize/SKILL.md', '---\nname: customize\n---\n');
+  } else {
+    write(seed, 'src/value.ts', 'export const value = "new";\n');
+  }
   if (options.breaking) {
     fs.appendFileSync(
       path.join(seed, 'CHANGELOG.md'),
@@ -91,40 +160,7 @@ function createForkFixture(options: { breaking?: boolean; gatewayExtraction?: bo
   }
   if (options.gatewayExtraction) {
     write(seed, 'src/gateway-providers/installed.ts', '// Installed gateway providers.\n');
-    write(
-      seed,
-      '.claude/skills/add-onecli/gateway.json',
-      '{"kind":"onecli","label":"OneCLI","description":"Gateway","default":true}\n',
-    );
-    write(
-      seed,
-      '.claude/skills/add-onecli/SKILL.md',
-      [
-        '---',
-        'name: add-onecli',
-        'description: Test gateway extraction.',
-        '---',
-        '',
-        '```nc:copy',
-        'payload/src/gateway-providers/onecli.ts -> src/gateway-providers/onecli.ts',
-        '```',
-        '',
-        '```nc:append to:src/gateway-providers/installed.ts',
-        "import './onecli.js';",
-        '```',
-        '',
-      ].join('\n'),
-    );
-    write(
-      seed,
-      '.claude/skills/add-onecli/scripts/detect.ts',
-      "import fs from 'node:fs'; console.log(fs.readFileSync('.env', 'utf8').includes('ONECLI_URL=') ? 'installed' : 'absent');\n",
-    );
-    write(
-      seed,
-      '.claude/skills/add-onecli/payload/src/gateway-providers/onecli.ts',
-      "export const gateway = 'onecli';\n",
-    );
+    writeOnecl
```

**File**: `scripts/update/transaction.ts` (modified, +42/-20)
```diff
@@ -3,6 +3,7 @@ import fs from 'node:fs';
 import path from 'node:path';
 import { pathToFileURL } from 'node:url';
 
+import type { GatewayCatalogEntry } from '../../setup/gateways/catalog.js';
 import { getInstallSlug } from '../../src/install-slug.js';
 import { refreshInstalledSkills, type SkillsRefreshReport } from '../update-skills.js';
 import {
@@ -345,31 +346,52 @@ export async function validateUpdate(
     commitStageChanges(state, runtime, 'chore: refresh installed skill payloads');
     refreshPreparedState(state, runtime);
 
-    if (hasChanged(state, 'src/gateway-providers') || hasChanged(state, 'setup/gateways')) {
+    // Gateway host code is materialized from its skill, so a payload-only change must refresh it too.
+    // The manifest is what puts a skill in the gateway catalog.
+    const changedGatewaySkills = new Set(
+      state.changedFiles
+        .map((file) => /^\.claude\/skills\/([^/]+)\//.exec(file)?.[1])
+        .filter((skill): skill is string => !!skill)
+        .filter((skill) => fs.existsSync(path.join(state.stageRoot, '.claude/skills', skill, 'gateway.json'))),
+    );
+    const checks: string[] = [];
+    const gatewayCoreChanged = hasChanged(state, 'src/gateway-providers') || hasChanged(state, 'setup/gateways');
+    state.gatewaySelection = undefined;
+    if (gatewayCoreChanged || changedGatewaySkills.size > 0) {
       const { loadGatewayCatalog, resolveGatewaySelection } = await runtime.loadGateway(state.stageRoot);
-      const kind = resolveGatewaySelection(
-        state.projectRoot,
-        undefined,
-        path.join(state.stageRoot, '.claude', 'skills'),
-      );
-      const entry = loadGatewayCatalog(state.stageRoot).gateways.find((candidate) => candidate.kind === kind);
-      if (!entry) throw new Error(`Unknown gateway provider: ${kind}`);
-      state.gatewaySelection = kind;
-      const gateway = { name: kind, skillName: path.basename(entry.skillPath), kind: 'gateway' as const };
-      const report = await refreshInstalledSkills(state.stageRoot, [gateway.skillName], { include: [gateway] });
-      state.skillRefresh.skills.push(...report.skills);
-      state.skillRefresh.selected.push(...report.selected);
-      state.skillRefresh.success &&= report.success;
-      if (!report.success) {
-        throw new Error(
-          `Gateway skill did not fully apply: ${report.skills.flatMap((skill) => skill.errors).join('; ')}`,
+      let entry: GatewayCatalogEntry | undefined;
+      try {
+        const kind = resolveGatewaySelection(
+          state.projectRoot,
+          undefined,
+          path.join(state.stageRoot, '.claude', 'skills'),
         );
+        entry = loadGatewayCatalog(state.stageRoot).gateways.find((candidate) => candidate.kind === kind);
+        if (!entry) throw new Error(`Unknown gateway provider: ${kind}`);
+      } catch (err) {
+        // Skill-only change: don't block the update over a gateway it can't resolve; say so instead.
+        if (gatewayCoreChanged) throw err;
+        checks.push(`gateway payload refresh skipped: ${err instanceof Error ? err.message : String(err)}`);
+      }
+      // Skill-only change: refresh just the selected gateway, and only if its own skill changed.
+      if (entry && (gatewayCoreChanged || changedGatewaySkills.has(path.basename(entry.skillPath)))) {
+        const kind = entry.kind;
+        state.gatewaySelection = kind;
+        const gateway = { name: kind, skillName: path.basename(entry.skillPath), kind: 'gateway' as const };
+        const report = await refreshInstalledSkills(state.stageRoot, [gateway.skillName], { include: [gateway] });
+        state.skillRefresh.skills.push(...report.skills);
+        state.skillRefresh.selected.push(...report.selected);
+        state.skillRefresh.success &&= report.success;
+        if (!report.success) {
+          throw new Error(
+            `Gateway skill did not fully apply: ${report.skills.flatMap((skill) => skill.errors).join('; ')}`,
+          );
+        }
+        commitStageChanges(state, runtime, 'chore: materialize selected gateway');
+        refreshPreparedState(state, runtime);
       }
-      commitStageChanges(state, runtime, 'chore: materialize selected gateway');
-      refreshPreparedState(state, runtime);
     }
 
-    const checks: string[] = [];
     // Cheap, and it names the offending path while nothing is stopped yet.
     assertMutableRootsResolvable(state.projectRoot);
     checks.push('mutable-state roots resolvable');
```

---

### Incident Patch 12: `fa234aad` (2026-10-04)
**Commit Message**: fix(update): load gateway helpers before cutover swaps node_modules (#4016)

* fix(update): load gateway helpers before cutover swaps node_modules

Cutover imported setup/ TypeScript after `pnpm install` had replaced
node_modules under the running controller. tsx compiled it with the
esbuild it started with, which refuses a binary of another version, so
installs with a gateway crashed on the tsx 4.23 update once pnpm had
pruned the old esbuild.

Load the helpers right after the reset to the validated commit and
before the install, so nothing compiles after it. toolchain-swap.test.ts
runs the controller under tsx with an esbuild that stops working once
the live install has run; the gateway e2e test checks the order.

The restart readiness tests get a 20s timeout: in the full parallel
suite their first case already took about 4.5s of the default 5s, and
the new test's load pushed it over.

Fixes #4004

* test(update): keep the order check, drop the toolchain-swap test

The integration test was most of the PR and runs inside every
operator's validate, where a flake would block an update. The order
check in the gateway e2e test fails on main and covers the regression;
the exe.dev runs 

**File**: `scripts/update/transaction.e2e.test.ts` (modified, +11/-1)
```diff
@@ -263,14 +263,24 @@ describe('update-nanoclaw transaction end to end', () => {
     fs.chmodSync(pnpm, 0o755);
     const previousPath = process.env.PATH;
     process.env.PATH = `${bin}${path.delimiter}${previousPath ?? ''}`;
-    const { runtime } = fakeRuntime(fixture.install);
+    const { runtime, events } = fakeRuntime(fixture.install);
+    const loadGateway = runtime.loadGateway;
+    runtime.loadGateway = (root) => {
+      events.push('gateway loaded');
+      return loadGateway(root);
+    };
 
     try {
       let state = prepareUpdate({ projectRoot: fixture.install, upstreamRef: 'upstream/main' }, runtime);
       state = await validateUpdate(fixture.install, state.id, runtime);
+      const beforeCutover = events.length;
       state = await cutoverUpdate(fixture.install, state.id, runtime);
 
       expect(state.phase).toBe('cutover');
+      // tsx compiles each import with the esbuild it started with, and the install can replace it.
+      const cutover = events.slice(beforeCutover);
+      expect(cutover).toContain('gateway loaded');
+      expect(cutover.indexOf('gateway loaded')).toBeLessThan(cutover.indexOf('pnpm install --frozen-lockfile'));
       expect(fs.readFileSync(path.join(fixture.install, 'src/gateway-providers/installed.ts'), 'utf8')).toContain(
         "import './onecli.js';",
       );
```

**File**: `scripts/update/transaction.ts` (modified, +8/-5)
```diff
@@ -729,6 +729,9 @@ function containerBuildArgs(envFile: string, state: UpdateState): string[] | und
 }
 
 function installAndBuild(root: string, state: UpdateState, runtime: UpdateRuntime): void {
+  // On the live checkout this swaps node_modules under the running controller.
+  // tsx compiles each later import with the esbuild it started with, which
+  // refuses a binary of another version: callers load their modules first.
   runtime.runner.run('pnpm', ['install', '--frozen-lockfile'], root);
   runtime.runner.run('pnpm', ['run', 'build'], root);
   const container = containerBuildArgs(path.join(root, '.env'), state);
@@ -844,12 +847,12 @@ export async function cutoverUpdate(
     state.snapshot = createSnapshot(state);
     saveState(state);
     git(runtime, state.projectRoot, ['reset', '--hard', state.targetHead]);
+    // From the live checkout, now exactly the validated commit, and before
+    // installAndBuild: see there.
+    const selection = state.gatewaySelection;
+    const gateway = selection ? await runtime.loadGateway(state.projectRoot) : undefined;
     installAndBuild(state.projectRoot, state, runtime);
-    if (state.gatewaySelection) {
-      // From the live checkout, now exactly the validated commit.
-      const { upsertEnvVar } = await runtime.loadGateway(state.projectRoot);
-      upsertEnvVar('NANOCLAW_GATEWAY_PROVIDER', state.gatewaySelection, state.projectRoot);
-    }
+    if (selection && gateway) gateway.upsertEnvVar('NANOCLAW_GATEWAY_PROVIDER', selection, state.projectRoot);
     state.phase = 'cutover';
     state.lastError = undefined;
     saveState(state);
```

---

### Incident Patch 13: `e8d8e8b9` (2026-10-04)
**Commit Message**: fix(add-imessage): open chat.db under Node with core's prebuilt better-sqlite3 (#4008)

* fix(add-imessage): open chat.db under Node with core's prebuilt better-sqlite3

The local backend's chat.db reader (@photon-ai/imessage-kit 2.1.2) pulls
its own better-sqlite3 12.11.1, which has no prebuilt binary. Since #3443
pnpm skips that build, so the reader fails with "Could not locate the
bindings file" and no iMessage ever arrives.

/add-imessage (local) now overrides that copy to core's better-sqlite3
($better-sqlite3, 13.0.3) and reinstalls before adding the adapter, then
checks the copy loads under Node. REMOVE.md deletes the override. A new
conformance check keeps any `pnpm pkg set 'pnpm.…'` ahead of the deps it
affects and paired with a delete in REMOVE.md.

* test(skills): catch a double-quoted pnpm pkg set in the REMOVE.md check

The pairing check matched only the single-quoted spelling, so a
double-quoted `pnpm pkg set "pnpm.…"` with no delete in REMOVE.md
passed. Match either quote style on both sides.

**File**: `.claude/skills/add-imessage/REMOVE.md` (modified, +5/-1)
```diff
@@ -18,9 +18,13 @@ rm -f src/channels/imessage.ts src/channels/imessage.test.ts src/channels/imessa
 
 ## 3. Uninstall the backend package(s)
 
-Uninstall whichever is present:
+Uninstall whichever is present. For the local backend, delete its
+`better-sqlite3` override first, so the uninstall also drops it from the
+lockfile (an empty `"pnpm": { "overrides": {} }` left in `package.json` is
+harmless):
 
 ```bash
+pnpm pkg delete 'pnpm.overrides[@photon-ai/imessage-kit>better-sqlite3]'   # local backend
 pnpm uninstall chat-adapter-imessage   # local backend
 pnpm uninstall spectrum-ts             # hosted backend
 ```
```

**File**: `.claude/skills/add-imessage/SKILL.md` (modified, +27/-1)
```diff
@@ -71,7 +71,18 @@ import './imessage.js';
 Pinned to an exact version — the supply-chain policy rejects ranges and
 `latest`. Install only the chosen backend's package.
 
-**Local** — the Chat SDK iMessage adapter:
+**Local** — the Chat SDK iMessage adapter. Its `chat.db` reader
+(`@photon-ai/imessage-kit`) brings its own `better-sqlite3` 12.x, which ships no
+prebuilt binary, and NanoClaw doesn't run dependency build scripts, so that
+copy can't open the database. First point the reader at NanoClaw's own
+prebuilt `better-sqlite3` (`$better-sqlite3` is pnpm's reference to the version
+NanoClaw pins). The reinstall applies it to an install that already has the
+adapter, since the step below skips a package that is already present:
+
+```nc:run effect:refresh when:backend=local
+pnpm pkg set 'pnpm.overrides[@photon-ai/imessage-kit>better-sqlite3]=$better-sqlite3'
+pnpm install --no-frozen-lockfile
+```
 
 ```nc:dep when:backend=local
 chat-adapter-imessage@0.1.1
@@ -115,6 +126,15 @@ exports, builders) and auto-skips when the package is absent:
 pnpm exec vitest run src/channels/imessage.test.ts
 ```
 
+For the local backend, check that the `chat.db` reader's `better-sqlite3`
+loads under Node. It fails with `Could not locate the bindings file` when that
+copy has no binary, meaning step 4's override didn't land: re-run that
+override step, then this check:
+
+```nc:run effect:test when:backend=local
+node --input-type=module -e 'import { createRequire } from "node:module"; const kit = createRequire(import.meta.resolve("chat-adapter-imessage")).resolve("@photon-ai/imessage-kit"); const Database = createRequire(kit)("better-sqlite3"); new Database(":memory:").close();'
+```
+
 ## Local backend: Full Disk Access (macOS)
 
 The adapter reads this Mac's `chat.db`, which requires Full Disk Access granted
@@ -281,6 +301,12 @@ grant silently stops covering a new binary. Re-open System Settings → Privacy
 Security → Full Disk Access, add the binary at `$(which node)`, then restart
 the service.
 
+**Local: `Failed to open database … Could not locate the bindings file`.** The
+`chat.db` reader is on a `better-sqlite3` copy with no native binary, from an
+install made before step 4 set its override. Re-run `/add-imessage` with the
+`local` backend: step 4 sets the override and reinstalls, and the skill
+restarts the service.
+
 **`spectrum-ts` not installed** (hosted) — re-run step 4
 (`pnpm install spectrum-ts@11.0.0`) and restart.
 
```

**File**: `.claude/skills/add-imessage/docs.md` (modified, +1/-0)
```diff
@@ -218,6 +218,7 @@ deliberate:
 | No iMessage line assigned               | The line comes back on your user row — re-run the wizard with `--phone` so the row is created, then `… photon-setup.ts status` |
 | Inbound stops arriving (hosted)         | The adapter re-subscribes automatically; if it persists it's usually upstream — restart to force a fresh stream       |
 | Local: no inbound                       | Confirm Full Disk Access is granted to the Node binary NanoClaw runs under, and that it runs on the signed-in Mac     |
+| Local: `Could not locate the bindings file` | The `chat.db` reader's `better-sqlite3` has no binary (an install from before `/add-imessage` set its pnpm override). Re-run `/add-imessage` with the `local` backend; it sets the override, reinstalls and restarts |
 | Bot silent (hosted)                     | Check `grep "Photon channel connected" logs/nanoclaw.log`, that the channel is wired, and that the service is running |
 
 [photon]: https://photon.codes/
```

**File**: `scripts/skill-conformance.test.ts` (modified, +26/-0)
```diff
@@ -338,6 +338,32 @@ describe.each(SKILLS)('%s', (name) => {
     });
   });
 
+  // A `pnpm pkg set 'pnpm.…'` changes how pnpm resolves the skill's deps. Set
+  // after a dep, it misses that install; missing from REMOVE.md, it outlives
+  // the skill. Only guards on the same var with different values never co-run.
+  it('pnpm settings precede the deps they shape and REMOVE.md deletes them', () => {
+    const removeMd = existsSync(join(dir, 'REMOVE.md')) ? readFileSync(join(dir, 'REMOVE.md'), 'utf8') : '';
+    const exclusive = (a: Directive, b: Directive) =>
+      isString(a.attrs.when) &&
+      isString(b.attrs.when) &&
+      a.attrs.when !== b.attrs.when &&
+      a.attrs.when.split('=')[0] === b.attrs.when.split('=')[0];
+    directives.forEach((d, i) => {
+      if (d.kind !== 'run') return;
+      for (const cmd of d.body) {
+        const key = cmd.match(/\bpnpm pkg set ["']?(pnpm\.[^="']+)=/)?.[1];
+        if (!key) continue;
+        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
+        expect(removeMd, `REMOVE.md never deletes ${key}`).toMatch(new RegExp(`pnpm pkg delete ["']?${escaped}["']?`));
+        directives.forEach((dep, j) => {
+          if (dep.kind === 'dep' && !exclusive(d, dep)) {
+            expect(j, `nc:dep at line ${dep.line} installs before line ${d.line} sets ${key}`).toBeGreaterThan(i);
+          }
+        });
+      }
+    });
+  });
+
   // A restart-shaped command on a bare `nc:run` (no effect:) would silently
   // escape both skipEffects ownership and the run-health gate.
   it('no restart-shaped command hides on a bare nc:run', () => {
```

---

### Incident Patch 14: `8c3ec920` (2026-10-04)
**Commit Message**: fix(chat-sdk): authenticate the loopback Gateway webhook (#4013)

The local server that receives forwarded Discord Gateway events
handled any POST it got. It now requires x-discord-gateway-token to
match the bot token (constant-time), which the adapter's listener
already sends on every forward, and rejects every request when no
token is configured.

Fixes #2970

**File**: `src/channels/chat-sdk-bridge.test.ts` (modified, +124/-0)
```diff
@@ -1,3 +1,5 @@
+import http from 'http';
+
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
 import type { Adapter, AdapterPostableMessage, RawMessage } from 'chat';
@@ -657,3 +659,125 @@ it('forwards the authenticated instance and message address without editing a de
     await closeDb();
   }
 });
+
+describe('createChatSdkBridge — local Gateway webhook', () => {
+  // The Gateway listener forwards raw events to a loopback server; only it may
+  // post there. It sends the bot token in x-discord-gateway-token.
+  const BOT_TOKEN = 'test-bot-token';
+  const realFetch = globalThis.fetch;
+
+  const click = JSON.stringify({
+    type: 'GATEWAY_INTERACTION_CREATE',
+    data: {
+      type: 3,
+      id: 'interaction-1',
+      token: 'interaction-token',
+      channel_id: 'chan-1',
+      data: { custom_id: 'ncq:q-1:approve' },
+      member: { user: { id: 'clicker-1', username: 'clicker' } },
+      message: { id: 'card-1', embeds: [] },
+    },
+  });
+  const message = JSON.stringify({ type: 'GATEWAY_MESSAGE_CREATE', data: { id: 'm-1', content: 'hi' } });
+
+  async function startGateway(botToken?: string) {
+    let webhookUrl = '';
+    const handleWebhook = vi.fn(async () => new Response('ok'));
+    const adapter = stubAdapter({
+      name: 'discord',
+      initialize: async () => {},
+      handleWebhook,
+      channelIdFromThreadId: (threadId: string) => threadId,
+    }) as Adapter & { startGatewayListener: unknown };
+    adapter.startGatewayListener = async (_opts: unknown, _ms: number, _signal: AbortSignal, url: string) => {
+      webhookUrl = url;
+      return new Response('{}');
+    };
+    const onAction = vi.fn();
+    const bridge = createChatSdkBridge({ adapter, supportsThreads: true, botToken });
+    await bridge.setup({ onInbound: () => {}, onInboundEvent: () => {}, onMetadata: () => {}, onAction });
+    const post = (body: string, headers: Record<string, string> = {}) =>
+      realFetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
+    return { bridge, post, onAction, handleWebhook, webhookUrl };
+  }
+
+  beforeEach(async () => {
+    const { initTestDb } = await import('../db/connection.js');
+    const { runMigrations } = await import('../db/migrations/index.js');
+    await runMigrations(await initTestDb());
+    // Interaction acks go to the Discord API; keep them off the network.
+    vi.stubGlobal(
+      'fetch',
+      vi.fn(async () => new Response(null, { status: 204 })),
+    );
+  });
+
+  afterEach(async () => {
+    vi.unstubAllGlobals();
+    const { closeDb } = await import('../db/connection.js');
+    await closeDb();
+  });
+
+  it.each([
+    ['no gateway token', {}],
+    ['a wrong gateway token', { 'x-discord-gateway-token': 'not-the-token' }],
+  ])('rejects a request with %s before it reaches the adapter or the host', async (_label, headers) => {
+    const { bridge, post, onAction, handleWebhook } = await startGateway(BOT_TOKEN);
+    try {
+      for (const body of [click, message]) {
+        const res = await post(body, headers);
+        expect(res.status).toBe(401);
+      }
+      expect(onAction).not.toHaveBeenCalled();
+      expect(handleWebhook).not.toHaveBeenCalled();
+    } finally {
+      await bridge.teardown();
+    }
+  });
+
+  it('answers 401 without waiting for the request body', async () => {
+    const { bridge, webhookUrl } = await startGateway(BOT_TOKEN);
+    try {
+      const status = await new Promise<number | undefined>((resolve, reject) => {
+        const req = http.request(webhookUrl, { method: 'POST', headers: { 'Content-Length': '1000' } }, (res) => {
+          resolve(res.statusCode);
+          req.destroy();
+        });
+        req.on('error', reject);
+        req.flushHeaders(); // the body never follows
+      });
+      expect(status).toBe(401);
+    } finally {
+      await bridge.teardown();
+    }
+  });
+
+  it('rejects every request when no bot token is configured', async () => {
+    const { bridge, post, onAction, handleWebhook } = await startGateway(undefined);
+    try {
+      const res = await post(click, { 'x-discord-gateway-token': '' });
+      expect(res.status).toBe(401);
+      expect((await post(message)).status).toBe(401);
+      expect(onAction).not.toHaveBeenCalled();
+      expect(handleWebhook).not.toHaveBeenCalled();
+    } finally {
+      await bridge.teardown();
+    }
+  });
+
+  it('dispatches clicks and forwards other events when the gateway token matches', async () => {
+    const { bridge, post, onAction, handleWebhook } = await startGateway(BOT_TOKEN);
+    try {
+      const auth = { 'x-discord-gateway-token': BOT_TOKEN };
+      expect((await post(click, auth)).status).toBe(200);
+      expect(onAction).toHaveBeenCalledWith('q-1', 'approve', 'clicker-1', {
+        messageId: 'card-1',
+        platformId: 'chan-1',
+      });
+      expect((await post(message, auth)).status).toBe(200);
+   
```

**File**: `src/channels/chat-sdk-bridge.ts` (modified, +16/-0)
```diff
@@ -4,6 +4,7 @@
  *
  * Used by Discord, Slack, and other Chat SDK-supported platforms.
  */
+import { createHash, timingSafeEqual } from 'crypto';
 import http from 'http';
 
 import {
@@ -1043,6 +1044,9 @@ export function createChatSdkBridge(config: ChatSdkBridgeConfig): ChannelAdapter
  * This is needed because the Gateway listener in webhook-forwarding mode
  * sends ALL raw events (including INTERACTION_CREATE for button clicks)
  * to the webhookUrl, which we handle here.
+ *
+ * Loopback is not a trust boundary, so only our own Gateway listener may post
+ * here: it sends the bot token in x-discord-gateway-token on every forward.
  */
 function startLocalWebhookServer(
   adapter: GatewayAdapter,
@@ -1051,6 +1055,11 @@ function startLocalWebhookServer(
 ): Promise<string> {
   return new Promise((resolve) => {
     const server = http.createServer((req, res) => {
+      if (!gatewayTokenMatches(req.headers['x-discord-gateway-token'], botToken)) {
+        res.writeHead(401, { 'Content-Type': 'application/json' });
+        res.end('{"error":"unauthorized"}');
+        return;
+      }
       const chunks: Buffer[] = [];
       req.on('data', (chunk: Buffer) => chunks.push(chunk));
       req.on('end', () => {
@@ -1077,6 +1086,13 @@ function startLocalWebhookServer(
   });
 }
 
+/** Constant-time check; hashing first keeps the lengths equal. No token configured means no match. */
+function gatewayTokenMatches(header: string | string[] | undefined, botToken: string | undefined): boolean {
+  if (!botToken || typeof header !== 'string') return false;
+  const digest = (s: string) => createHash('sha256').update(s).digest();
+  return timingSafeEqual(digest(header), digest(botToken));
+}
+
 async function handleForwardedEvent(
   body: string,
   adapter: GatewayAdapter,
```

---

### Incident Patch 15: `92cde85f` (2026-10-04)
**Commit Message**: fix(onecli): pin the gateway to 1.42.0 for the host-enforcement bypass fix (#3989)

OneCLI 1.42.0 closes a credential-injection host-enforcement bypass
(onecli/onecli#438). New installs still pull 1.41.0, which lacks it.

The approval-summary source pin moves with it, as the Iron builder
requires. Of the pinned files only apps.rs changed, and none of its
changes are in the part prepare.py extracts, so the generated helper
source, Cargo.lock and fixtures are unchanged.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.claude/skills/add-onecli/SKILL.md` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ a key in `.env`, command arguments, or the container environment.
   answer at the key prompt completes the move after confirmation.
 - Existing OneCLI credential names and formats remain compatible.
 - ChatGPT logins need manual reauthentication after expiry on the pinned
-  OneCLI 1.41.0; see [ChatGPT OAuth refresh](references/chatgpt-oauth-refresh.md)
+  OneCLI 1.42.0; see [ChatGPT OAuth refresh](references/chatgpt-oauth-refresh.md)
   for the limitation and upgrade constraints.
 
 ## Validate
```

**File**: `.claude/skills/add-onecli/references/chatgpt-oauth-refresh.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 These notes apply to the current OneCLI credential adapter, not to any
 provider's runtime contract.
 
-NanoClaw's OneCLI 1.41.0 pin cannot refresh the ChatGPT OAuth credentials a
+NanoClaw's OneCLI 1.42.0 pin cannot refresh the ChatGPT OAuth credentials a
 provider imports (for example OpenCode's ChatGPT sign-in): its refresh request
 omits the required client ID. After expiry, use the provider's manual
 reauthentication, for OpenCode the
```

**File**: `.claude/skills/add-onecli/versions.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "onecli-gateway": "1.41.0",
+  "onecli-gateway": "1.42.0",
   "onecli-cli": "2.2.5",
   "onecli-sdk": "2.2.1"
 }
```

**File**: `gateway-compat/onecli-summary/upstream.json` (modified, +3/-3)
```diff
@@ -1,8 +1,8 @@
 {
-  "version": "1.41.0",
-  "commit": "fe0981f09122358d4b3c721ef3e141026a2fdc46",
+  "version": "1.42.0",
+  "commit": "3912c74d7029505f0f5389745568111d643adc68",
   "files": {
-    "apps.rs": "12bf43528f3510cd2ab9330dd05d2ddb6ee267f033b2384474dca4931b438c52",
+    "apps.rs": "f77227bbea035a43fe0d67277604b4923215d072db2d2a45eba171b3abdc6392",
     "cloud_summary.rs": "1a7d0d1b1ad0fd30d7082be464a2bb6908dbb4dff53a113e69c2b0cef600fa85",
     "summary/generic.rs": "f0a3f72db64106a74da23195ccdf3aacea44b92e3ec97c58029520feacb9686b",
     "summary/gmail.rs": "f93a104ecbac03f30113be32252d5c5df10b49ed771d53e51e5df35e22110e29",
```

#### Recent Merged Pull Requests:
- **PR #4041** (2026-10-05): fix(onecli): migration warning points back to the pin, not the old version (@glifocat)
- **PR #4039** (2026-10-05): fix(onecli): upgrade guide refuses an empty gateway pin (@glifocat)
- **PR #4038** (2026-10-05): chore(release): v2026.10.0-rc.2 (@glifocat)
- **PR #4037** (2026-10-05): fix(update): wait for the launchd host to exit after bootout (@glifocat)
- **PR #4036** (2026-10-05): fix(onecli): hold the gateway on 1.42.0 and stop /add-dial-tool on 1.42+ (@glifocat)
- **PR #4035** (2026-10-05): test(setup): reuse exec-checked stubs in the restart readiness tests (@glifocat)
- **PR #4028** (2026-10-04): docs(add-onecli): check the gateway at ONECLI_URL in the upgrade guide (@glifocat)
- **PR #4025** (2026-10-04): chore(release): v2026.10.0-rc.1 (@glifocat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
