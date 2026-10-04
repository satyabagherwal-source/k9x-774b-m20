# Forensic Learning Record (Deep Inspection): LodyAI/Lody

> **Canonical Artifact**: `07_PROJECT_LEARNING/lodyai-lody-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/LodyAI/Lody](https://github.com/LodyAI/Lody))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:37:00.777Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `LodyAI/Lody`
- **Description**: Share coding agents with your team on phone and desktop
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1214 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/cli/src/agent/claude-task-lifecycle.ts`
```
import { z } from 'zod';
import { parseSessionNotification, type AcpSessionNotification } from '@lody/shared';
import type { LodyTaskMeta } from 'acp-extension-core';

const MAX_TITLE_LENGTH = 160;
const MAX_TEXT_LENGTH = 1_200;
const MAX_META_TEXT_LENGTH = 2_000;

const TaskUsageSchema = z
  .object({
    total_tokens: z.number().optional(),
    tool_uses: z.number().optional(),
    duration_ms: z.number().optional(),
  })
  .passthrough();

const BaseTaskMessageSchema = z
  .object({
    type: z.literal('system').optional(),
    task_id: z.string().min(1),
    tool_use_id: z.string().optional(),
    description: z.string().optional(),
    subagent_type: z.string().optional(),
    task_type: z.string().optional(),
    uuid: z.string().optional(),
    session_id: z.string().optional(),
  })
  .passthrough();

const TaskStartedMessageSchema = BaseTaskMessageSchema.extend({
  subtype: z.literal('task_started'),
  prompt: z.string().optional(),
  skip_transcript: z.boolean().optional(),
  workflow_name: z.string().optional(),
});

const TaskProgressMessageSchema = BaseTaskMessageSchema.extend({
  subtype: z.literal('task_progress'),
  usage: TaskUsageSchema.optional(),
  last_tool_name: z.string().optional(),
});

const TaskUpdatedMessageSchema = BaseTaskMessageSchema.extend({
  subtype: z.literal('task_updated'),
  patch: z
    .object({
      status: z.string().optional(),
      error: z.string().optional(),
      is_backgrounded: z.boolean().optional(),
    })
    .passthrough(),
});

const TaskNotificationMessageSchema = BaseTaskMessageSchema.extend({
  subtype: z.literal('task_notification'),
  status: z.string().optional(),
  output_file: z.string().optional(),
  summary: z.string().optional(),
  usage: TaskUsageSchema.optional(),
});

const ClaudeTaskLifecycleParamsSchema = z
  .object({
    sessionId: z.string().min(1),
    acpSessionId: z.string().optional(),
    message: z.discriminatedUnion('subtype', [
      TaskStartedMessageSchema,
      TaskProgressMessageSchema,
      TaskUpdatedMessageSchema,
      TaskNotificationMessageSchema,
    ]),
  })
  .passthrough();

type ClaudeTaskLifecycleMessage = z.infer<typeof ClaudeTaskLifecycleParamsSchema>['message'];
type ClaudeTaskUsage = z.infer<typeof TaskUsageSchema>;
type TaskLifecycleAcpUpdate = Extract<
  AcpSessionNotification['update'],
  { sessionUpdate: 'tool_call' | 'tool_call_update' }
>;
type TaskLifecycleAcpStatus = NonNullable<
  Extract<AcpSessionNotification['update'], { sessionUpdate: 'tool_call' }>['status']
>;

export type ClaudeTaskLifecycleConversionResult =
  | { ok: true; notification: AcpSessionNotification }
  | { ok: false; reason: string };

export type TaskLifecycleConversionOptions = {
  defaultActor: string;
};

export const convertTaskLifecycleNotification = (
  params: unknown,
  options: TaskLifecycleConversionOptions
): ClaudeTaskLifecycleConversionResult => {
  const parsed = ClaudeTaskLifecycleParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.message };
  }

  try {
    return {
      ok: true,
      notification: parseSessionNotification(
        buildTaskLifecycleAcpNotification(parsed.data.sessionId, parsed.data.message, options)
      ),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

export const convertClaudeTaskLifecycleNotification = (
  params: unknown
): ClaudeTaskLifecycleConversionResult =>
  convertTaskLifecycleNotification(params, {
    defaultActor: 'Claude task',
  });

const buildTaskLifecycleAcpNotification = (
  sessionId: string,
  message: ClaudeTaskLifecycleMessage,
  options: TaskLifecycleConversionOptions
) => {
  const taskId = message.task_id;
  const event = message.subtype;
  const rawStatus = extractRawStatus(message);
  const status = mapTaskStatus(event, rawStatus);
  const description = sanitizeText(message.description, MAX_META_TEXT_LENGTH);
  const summary =
    event === 'task_notification' ? sanitizeText(message.summary, MAX_META_TEXT_LENGTH) : undefined;
  const usage =
    event === 'task_progress' || event === 'task_notification'
      ? sanitizeUsage(message.usage)
      : undefined;
  const lastToolName =
    event === 'task_progress' ? sanitizeText(message.last_tool_name, MAX_TITLE_LENGTH) : undefined;
  const title = buildTitle(message, rawStatus, options.defaultActor);
  const contentText = buildContentText({ description, summary, rawStatus, usage, lastToolName });
  const task = buildTaskMeta({
    message,
    status,
    description,
    summary,
    usage,
    lastToolName,
    defaultActor: options.defaultActor,
  });

  const updateBase = {
    toolCallId: `task:${taskId}`,
    title,
    kind: 'think' as const,
    status,
    _meta: { lody: { task } },
    ...(contentText
      ? {
          content: [
            {
              type: 'content' as const,
              content: { type: 'text' as const, text: contentText },
            },
          ],
        }
      : {}),
  };

  const update: TaskLifecycleAcpUpdate =
    event === 'task_started'
      ? { sessionUpdate: 'tool_call', ...updateBase }
      : { sessionUpdate: 'tool_call_update', ...updateBase };

  return { sessionId, update };
};

const sanitizeText = (value: string | undefined, maxLength: number): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return truncate(trimmed, maxLength);
};

const sanitizeTitleText = (value: string | undefined): string | undefined =>
  sanitizeText(value?.replace(/\s+/g, ' '), MAX_TITLE_LENGTH);

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

const sanitizeUsage = (usage: ClaudeTaskUsage | undefined) => {
  if (!usage) return undefined;
  const totalTokens = sanitizeNumber(usage.total_tokens);
  const toolUses = sanitizeNumber(usage.tool_uses);
  const durationMs = sanitizeNumber(usage.duration_ms);
  if (totalTokens === undefined && toolUses === undefined && durationMs === undefined) {
    return undefined;
  }
  return {
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(toolUses !== undefined ? { toolUses } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
};

const sanitizeNumber = (value: number | undefined): number | undefined => {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  return value;
};

const extractRawStatus = (message: ClaudeTaskLifecycleMessage): string | undefined => {
  switch (message.subtype) {
    case 'task_updated':
      return sanitizeText(message.patch.status, MAX_TITLE_LENGTH);
    case 'task_notification':
      return sanitizeText(message.status, MAX_TITLE_LENGTH);
    case 'task_started':
    case 'task_progress':
      return undefined;
  }
  return undefined;
};

const mapTaskStatus = (
  event: ClaudeTaskLifecycleMessage['subtype'],
  rawStatus: string | undefined
): TaskLifecycleAcpStatus => {
  if (event === 'task_started' || event === 'task_progress') return 'in_progress';

  const normalized = rawStatus?.trim().toLowerCase();
  switch (normalized) {
    case 'completed':
    case 'complete':
    case 'succeeded':
    case 'success':
      return 'completed';
    case 'failed':
    case 'killed':
    case 'cancelled':
    case 'canceled':
    case 'stopped':
    case 'error':
      return 'failed';
    case 'pending':
      return 'pending';
    default:
      return 'in_progress';
  }
};

const buildTitle = (
  message: ClaudeTaskLifecycleMessage,
  rawStatus: string | undefined,
  defaultActor: string
): string => {
  const actor = sanitizeTitleText(message.subagent_type) ?? defaultActor;
  const detail =
    sanitizeTitleText(message.description) ??
    (message.subtype === 'task_notification' ? sanitizeTitleText(message.summary) : undefined) ??
    sanitizeTitleText(rawStatus);
  return detail ? `${actor}: ${detail}` : actor;
};

const buildContentText = (args: {
  description: string | undefined;
  summary: string | undefined;
  rawStatus: string | undefined;
  usage: ReturnType<typeof sanitizeUsage>;
  lastToolName: string | undefined;
}): string | undefined => {
  const lines: string[] = [];
  if (args.description) lines.push(args.description);
  if (args.summary && args.summary !== args.description) lines.push(args.summary);
  if (args.lastToolName) lines.push(`Last tool: ${args.lastToolName}`);
  if (args.rawStatus) lines.push(`Status: ${args.rawStatus}`);
  const usageText = formatUsage(args.usage);
  if (usageText) lines.push(usageText);

  if (lines.length === 0) return undefined;
  return truncate(lines.join('\n'), MAX_TEXT_LENGTH);
};

const formatUsage = (usage: ReturnType<typeof sanitizeUsage>): string | undefined => {
  if (!usage) return undefined;
  const parts: string[] = [];
  if (usage.totalTokens !== undefined) parts.push(`${usage.totalTokens} tokens`);
  if (usage.toolUses !== undefined) parts.push(`${usage.toolUses} tool uses`);
  if (usage.durationMs !== undefined) parts.push(`${usage.durationMs} ms`);
  if (parts.length === 0) return undefined;
  return `Usage: ${parts.join(', ')}`;
};

const buildTaskMeta = (args: {
  message: ClaudeTaskLifecycleMessage;
  status: TaskLifecycleAcpStatus;
  description: string | undefined;
  summary: string | undefined;
  usage: ReturnType<typeof sanitizeUsage>;
  lastToolName: string | undefined;
  defaultActor: string;
}): LodyTaskMeta => {
  const { message } = args;
  const meta: Record<string, unknown> = {
    version: 1,
    taskId: message.task_id,
    kind:
      message.subtype === 'task_updated' && message.patch.is_backgrounded
        ? 'background'
        : 'subagent',
    status: args.status,
  };
  setIfDefined(
    meta,
    'actor',
    sanitizeText(
      message.subagent_type ??
        (message.subtype === 'task_started' ? message.workflow_name : undefined) ??
        mess
```

### Core Architecture Module: `apps/cli/src/agent/kimi-task-lifecycle.ts`
```
import { convertTaskLifecycleNotification } from './claude-task-lifecycle';

export const convertKimiTaskLifecycleNotification = (params: unknown) =>
  convertTaskLifecycleNotification(params, {
    defaultActor: 'Kimi task',
  });

```

### Core Architecture Module: `apps/cli/src/agent/response-utils.ts`
```
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getStringField = (obj: Record<string, unknown>, key: string): string | null => {
  const value = obj[key];
  return typeof value === 'string' ? value : null;
};

/**
 * Best-effort extraction of a textual response from ACP prompt results.
 * Returns the first non-empty string found in common fields.
 */
export const extractTextFromAgentResponse = (response: unknown): string | null => {
  if (!response) return null;
  if (typeof response === 'string') return response;

  if (!isRecord(response)) {
    return null;
  }

  const nested = response['response'];
  const nestedRecord = isRecord(nested) ? nested : null;

  const directText =
    getStringField(response, 'text') ??
    getStringField(response, 'title') ??
    getStringField(response, 'output') ??
    (nestedRecord
      ? (getStringField(nestedRecord, 'text') ??
        getStringField(nestedRecord, 'title') ??
        getStringField(nestedRecord, 'output'))
      : null);
  if (directText) {
    return directText;
  }

  const containerValue = response['content'] ?? response['responses'] ?? response['choices'];
  if (Array.isArray(containerValue)) {
    for (const item of containerValue) {
      const candidate = extractTextFromAgentResponse(item);
      if (candidate) return candidate;
    }
  }

  return null;
};

```

### Core Architecture Module: `apps/cli/src/ios-simulator/baguette-worker.ts`
```
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { IosSimulatorDeviceControlSchema } from '@lody/shared';
import { createGuestButtons } from './guest-buttons';
import { runSimulatorHostControl } from './host-controls';

// IPC is ownership: losing the daemon always reaps the native server.
const abort = new AbortController();
const stop = () => abort.abort();
const buttons = createGuestButtons(abort.signal);
process.on('disconnect', stop);
let pendingHostControl: Promise<void> | undefined;
const onMessage = (raw: unknown) => {
  const request = z
    .object({
      type: z.literal('control'),
      id: z.number().int().positive(),
      udid: z.string().uuid(),
      control: z.union([
        IosSimulatorDeviceControlSchema,
        z.object({ kind: z.enum(['prepare-keyboard', 'prepare-buttons']) }).strict(),
      ]),
    })
    .strict()
    .safeParse(raw);
  if (!request.success || pendingHostControl || abort.signal.aborted) {
    stop();
    return;
  }
  const { id, udid, control } = request.data;
  if (
    !(control.kind === 'button' && ['home', 'app-switcher', 'lock'].includes(control.button)) &&
    control.kind !== 'text' &&
    control.kind !== 'appearance' &&
    control.kind !== 'open-url' &&
    control.kind !== 'shake' &&
    control.kind !== 'prepare-buttons' &&
    control.kind !== 'prepare-keyboard'
  ) {
    stop();
    return;
  }
  pendingHostControl = (
    control.kind === 'prepare-buttons'
      ? buttons.prepare(udid)
      : control.kind === 'button'
        ? buttons.press(udid, z.enum(['home', 'app-switcher', 'lock']).parse(control.button))
        : runSimulatorHostControl(
            udid,
            control,
            AbortSignal.any([abort.signal, AbortSignal.timeout(10000)])
          )
  )
    .then(
      () => {
        if (process.connected) process.send?.({ type: 'control-result', id, success: true });
      },
      () => {
        if (process.connected) process.send?.({ type: 'control-result', id, success: false });
      }
    )
    .finally(() => {
      pendingHostControl = undefined;
    });
};
process.on('message', onMessage);
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
let child: ReturnType<typeof spawn> | undefined;
let exited: Promise<void> | undefined;
try {
  if (!process.connected) throw new Error('Missing lifecycle owner');
  const binary = z.string().min(1).parse(process.argv[2]);
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('Port allocation failed');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve()))
  );
  abort.signal.throwIfAborted();
  child = spawn(binary, ['serve', '--host', '127.0.0.1', '--port', String(port), '--no-plugins'], {
    // Isolate the native server and its xcrun descendants in our own process group.
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  exited = new Promise<void>((resolve) => {
    child?.once('error', () => {
      stop();
      resolve();
    });
    child?.once('exit', () => {
      stop();
      resolve();
    });
  });
  const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]);
  while (true) {
    signal.throwIfAborted();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/simulators`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
      });
      await response.body?.cancel();
      if (response.ok) break;
    } catch {
      signal.throwIfAborted();
    }
    await delay(100, undefined, { signal });
  }
  process.send?.({ type: 'ready', port });
  await new Promise<void>((resolve) => {
    if (abort.signal.aborted) resolve();
    else abort.signal.addEventListener('abort', () => resolve(), { once: true });
  });
} catch {
  process.exitCode = 1;
} finally {
  stop();
  await pendingHostControl;
  await buttons.close().catch(() => {
    process.exitCode = 1;
  });
  if (child?.pid !== undefined) {
    const group = -child.pid;
    const signalGroup = (signal: NodeJS.Signals | 0): boolean => {
      try {
        process.kill(group, signal);
        return true;
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false;
        throw error;
      }
    };
    // Parent exit alone is insufficient: an in-flight simctl can outlive Baguette.
    // Keep IPC ownership until the whole group is gone, including forced cleanup.
    if (signalGroup('SIGTERM')) {
      const killAt = Date.now() + 3000;
      while (signalGroup(0)) {
        if (Date.now() >= killAt) signalGroup('SIGKILL');
        await delay(25);
      }
    }
    await exited;
  }
  process.removeListener('disconnect', stop);
  process.removeListener('message', onMessage);
  if (process.connected) process.disconnect();
}

```

### Core Architecture Module: `apps/cli/src/lib/bounded-concurrency.ts`
```
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

```

### Core Architecture Module: `apps/cli/src/lib/cli-runtime-state.ts`
```
import type {
  CliBackendAuthorization,
  CliBackendConnection,
  CliRuntimeConnectivity,
  CliRuntimeIssue,
  CliRuntimeIssueSeverity,
  CliRuntimePhase,
  CliRuntimeStartupStage,
  CliRuntimeState,
  CliRuntimeWorkspace,
  MachineId,
} from '@lody/shared';

const MAX_RUNTIME_ISSUES = 50;

type UpsertCliRuntimeIssueInput = {
  code: string;
  severity: CliRuntimeIssueSeverity;
  recoverable: boolean;
  message: string;
};

type CliRuntimeStateReporterOptions = {
  machineId?: MachineId;
  pid?: number;
  supervisor?: CliRuntimeState['supervisor'];
  trackBackendConnectionAge?: boolean;
  now?: () => number;
};

export class CliRuntimeStateReporter {
  private readonly pid: number;
  private readonly supervisor: CliRuntimeState['supervisor'];
  private phase: CliRuntimePhase = 'starting';
  private startupStage: CliRuntimeStartupStage | undefined = 'bootstrap';
  private connectivity: CliRuntimeConnectivity | undefined;
  private backend: NonNullable<CliRuntimeState['backend']>;
  private backendNotConnectedSinceMs: number | undefined;
  private connectedWorkspaces: CliRuntimeWorkspace[] = [];
  private workspaceNotConnectedSinceMs = new Map<string, number>();
  private machineId: string | undefined;
  private activeSessionCount = 0;
  private connectedRoomCount = 0;
  private updatedAtMs: number;
  private readonly issuesByCode = new Map<string, CliRuntimeIssue>();
  private readonly trackBackendConnectionAge: boolean;
  private readonly now: () => number;

  constructor(options: CliRuntimeStateReporterOptions = {}) {
    this.pid = options.pid ?? process.pid;
    this.machineId = options.machineId;
    this.supervisor = options.supervisor;
    this.trackBackendConnectionAge = options.trackBackendConnectionAge ?? true;
    this.now = options.now ?? Date.now;
    this.updatedAtMs = this.now();
    this.backend = {
      authorization: 'pending',
      connection: 'connecting',
    };
    this.backendNotConnectedSinceMs = this.trackBackendConnectionAge ? this.updatedAtMs : undefined;
  }

  setMachineId(machineId: MachineId): void {
    if (this.machineId === machineId) {
      return;
    }
    this.machineId = machineId;
    this.touch();
  }

  setStartupStage(stage: CliRuntimeStartupStage): void {
    if (this.startupStage === stage) {
      return;
    }
    this.startupStage = stage;
    this.touch();
  }

  setActiveSessionCount(count: number): void {
    if (this.activeSessionCount === count) {
      return;
    }
    this.activeSessionCount = count;
    this.touch();
  }

  setConnectedRoomCount(count: number): void {
    if (this.connectedRoomCount === count) {
      return;
    }
    this.connectedRoomCount = count;
    this.touch();
  }

  setConnectivity(connectivity: CliRuntimeConnectivity): void {
    if (this.connectivity === connectivity) {
      return;
    }
    this.connectivity = connectivity;
    this.touch();
  }

  setBackendAuthorization(authorization: CliBackendAuthorization): void {
    if (this.backend.authorization === authorization) {
      return;
    }
    this.backend = { ...this.backend, authorization };
    this.touch();
  }

  setBackendConnection(connection: CliBackendConnection): void {
    const nowMs = this.now();
    const notConnectedSinceMs =
      !this.trackBackendConnectionAge || connection === 'connected'
        ? undefined
        : this.backend.connection === 'connected'
          ? nowMs
          : (this.backendNotConnectedSinceMs ?? nowMs);
    if (
      this.backend.connection === connection &&
      this.backendNotConnectedSinceMs === notConnectedSinceMs
    ) {
      return;
    }
    this.backend = { ...this.backend, connection };
    this.backendNotConnectedSinceMs = notConnectedSinceMs;
    this.touch();
  }

  setConnectedWorkspaces(workspaces: CliRuntimeWorkspace[]): void {
    const nowMs = this.now();
    const previousById = new Map(
      this.connectedWorkspaces.map((workspace) => [workspace.id, workspace])
    );
    const nextWorkspaceNotConnectedSinceMs = new Map<string, number>();
    const nextWorkspaces = workspaces.map((workspace): CliRuntimeWorkspace => {
      const previous = previousById.get(workspace.id);
      const notConnectedSinceMs =
        !this.trackBackendConnectionAge || workspace.backendConnection === 'connected'
          ? undefined
          : previous?.backendConnection === 'connected'
            ? nowMs
            : (this.workspaceNotConnectedSinceMs.get(workspace.id) ?? nowMs);
      if (notConnectedSinceMs !== undefined) {
        nextWorkspaceNotConnectedSinceMs.set(workspace.id, notConnectedSinceMs);
      }
      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspace.role,
        backendConnection: workspace.backendConnection,
      };
    });
    if (
      JSON.stringify(this.connectedWorkspaces) === JSON.stringify(nextWorkspaces) &&
      JSON.stringify([...this.workspaceNotConnectedSinceMs]) ===
        JSON.stringify([...nextWorkspaceNotConnectedSinceMs])
    ) {
      return;
    }
    this.connectedWorkspaces = nextWorkspaces;
    this.workspaceNotConnectedSinceMs = nextWorkspaceNotConnectedSinceMs;
    this.touch();
  }

  upsertIssue(input: UpsertCliRuntimeIssueInput): void {
    const nowMs = this.now();
    const existing = this.issuesByCode.get(input.code);
    if (existing) {
      const next: CliRuntimeIssue = {
        ...existing,
        severity: input.severity,
        recoverable: input.recoverable,
        message: input.message,
        lastSeenAtMs: nowMs,
        count: existing.count + 1,
      };
      this.issuesByCode.set(input.code, next);
      this.touch();
      return;
    }

    this.issuesByCode.set(input.code, {
      id: `${input.code}:${nowMs}`,
      code: input.code,
      severity: input.severity,
      recoverable: input.recoverable,
      message: input.message,
      firstSeenAtMs: nowMs,
      lastSeenAtMs: nowMs,
      count: 1,
    });
    this.trimIssues();
    this.touch();
  }

  clearIssue(code: string): void {
    if (!this.issuesByCode.delete(code)) {
      return;
    }
    this.touch();
  }

  clearRecoverableIssues(): void {
    const codesToDelete: string[] = [];
    for (const [code, issue] of this.issuesByCode) {
      if (issue.recoverable) {
        codesToDelete.push(code);
      }
    }

    if (codesToDelete.length === 0) {
      return;
    }

    for (const code of codesToDelete) {
      this.issuesByCode.delete(code);
    }
    this.touch();
  }

  snapshot(): CliRuntimeState {
    const issues = [...this.issuesByCode.values()].sort((left, right) => {
      if (left.lastSeenAtMs !== right.lastSeenAtMs) {
        return right.lastSeenAtMs - left.lastSeenAtMs;
      }
      return left.code.localeCompare(right.code);
    });

    return {
      schemaVersion: 1,
      phase: this.phase,
      startupStage: this.startupStage,
      connectivity: this.connectivity,
      backend: this.backend,
      connectedWorkspaces: this.connectedWorkspaces,
      connectionAges: this.trackBackendConnectionAge
        ? {
            ...(this.backendNotConnectedSinceMs === undefined
              ? {}
              : { backendNotConnectedSinceMs: this.backendNotConnectedSinceMs }),
            ...(this.workspaceNotConnectedSinceMs.size === 0
              ? {}
              : {
                  workspaceNotConnectedSinceMs: Object.fromEntries(
                    this.workspaceNotConnectedSinceMs
                  ),
                }),
          }
        : undefined,
      machineId: this.machineId,
      pid: this.pid,
      updatedAtMs: this.updatedAtMs,
      issues,
      activeSessionCount: this.activeSessionCount,
      connectedRoomCount: this.connectedRoomCount,
      supervisor: this.supervisor,
    };
  }

  private trimIssues(): void {
    if (this.issuesByCode.size <= MAX_RUNTIME_ISSUES) {
      return;
    }

    const entries = [...this.issuesByCode.entries()];
    entries.sort((left, right) => left[1].lastSeenAtMs - right[1].lastSeenAtMs);
    const overflow = this.issuesByCode.size - MAX_RUNTIME_ISSUES;
    for (let i = 0; i < overflow; i += 1) {
      const code = entries[i]?.[0];
      if (code) {
        this.issuesByCode.delete(code);
      }
    }
  }

  private touch(): void {
    this.updatedAtMs = this.now();
    this.phase = this.computePhase();
  }

  private computePhase(): CliRuntimePhase {
    if ([...this.issuesByCode.values()].some((issue) => issue.severity === 'fatal')) {
      return 'fatal';
    }

    if (this.startupStage !== 'ready') {
      return 'starting';
    }

    if (this.connectivity === 'offline') {
      return 'offline';
    }

    if (this.connectivity === 'reconnecting') {
      return 'degraded';
    }

    if (this.issuesByCode.size > 0) {
      return 'degraded';
    }

    return 'running';
  }
}

```

### Core Architecture Module: `apps/cli/src/lib/code-collab/diff-worker-task.ts`
```
import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { open, stat } from 'node:fs/promises';

import { computeLineCounts } from './diff-line-counts';

export type DiffWorkerTaskInput =
  | {
      readonly kind: 'line-count';
      readonly oldText: string | null;
      readonly newText: string | null;
    }
  | {
      readonly kind: 'turn-evidence';
      readonly oldText: string | null;
      readonly newText: string | null;
      readonly absolutePath: string;
    };

export type DiffWorkerTaskResult =
  | { readonly kind: 'line-count'; readonly lineCounts: [number, number] }
  | {
      readonly kind: 'turn-evidence';
      readonly lineCounts: [number, number];
      readonly newIsCurrent: boolean;
    };

export async function runDiffWorkerTask(input: DiffWorkerTaskInput): Promise<DiffWorkerTaskResult> {
  const lineCounts = computeLineCounts(input.oldText, input.newText);
  if (input.kind === 'line-count') return { kind: input.kind, lineCounts };
  return {
    kind: input.kind,
    lineCounts,
    newIsCurrent: await newSnapshotMatchesFile(input.absolutePath, input.newText),
  };
}

async function newSnapshotMatchesFile(
  absolutePath: string,
  newText: string | null
): Promise<boolean> {
  let file;
  try {
    file = await open(absolutePath, 'r');
  } catch (error) {
    if (nodeErrorCode(error) === 'ENOENT') return newText === null;
    throw error;
  }
  try {
    if (newText === null) return false;
    const expectedBytes = Buffer.byteLength(newText, 'utf8');
    const before = await file.stat({ bigint: true });
    if (before.size !== BigInt(expectedBytes)) return false;

    const diskHash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(Math.min(Math.max(expectedBytes, 1), 64 * 1024));
    let offset = 0;
    while (offset < expectedBytes) {
      const length = Math.min(buffer.byteLength, expectedBytes - offset);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      if (bytesRead === 0) return false;
      diskHash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }

    const [after, pathAfter] = await Promise.all([
      file.stat({ bigint: true }),
      stat(absolutePath, { bigint: true }).catch((error: unknown) => {
        if (nodeErrorCode(error) === 'ENOENT') return null;
        throw error;
      }),
    ]);
    if (!pathAfter || !sameFileState(before, after) || !sameFileState(after, pathAfter)) {
      return false;
    }
    const snapshotHash = createHash('sha256').update(newText, 'utf8').digest();
    return diskHash.digest().equals(snapshotHash);
  } finally {
    await file.close();
  }
}

function sameFileState(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function nodeErrorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { readonly code?: unknown }).code)
    : undefined;
}

```

### Core Architecture Module: `apps/cli/src/lib/code-collab/diff-worker.ts`
```
import {
  runDiffWorkerTask,
  type DiffWorkerTaskInput,
  type DiffWorkerTaskResult,
} from './diff-worker-task';

/**
 * Tinypool worker entry. Built as a standalone Vite bundle (`dist/diff-worker.js`,
 * sibling of `dist/index.js`) with `diff` inlined, so it needs no `node_modules` at
 * runtime. The line-count computation can be expensive on pathological inputs, so it
 * runs here off the main thread; see `diff-line-counts.ts` for the fallback chain.
 */
export default async function diffWorker(
  input: DiffWorkerTaskInput
): Promise<DiffWorkerTaskResult> {
  return await runDiffWorkerTask(input);
}

```

### Core Architecture Module: `apps/cli/src/lib/code-collab/file-index-scan-core.ts`
```
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type {
  CodeCollabV2AllChangesState,
  CodeCollabV2AllChangesValue,
  CodeCollabV2FileTreeValue,
} from '@lody/shared';

import { countTextLines } from './diff-line-counts';
import { gitDiffBaseRefCandidates } from '../git/git-diff-base';

// Pure Git-backed scanning + All Changes computation shared by the file-index
// Tinypool worker (`file-index-scan-worker.ts`) and the main-thread fallback in
// `code-collab-v2-service.ts`. Keep this module dependency-light (node builtins +
// `@lody/shared` types only) so the worker bundle stays free of wasm/top-level-await
// imports. The filesystem (`opendir`) directory-scan fallback is intentionally NOT
// here: its error classification differs between the worker and the service.

const execFileAsync = promisify(execFile);

const GIT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export type GitDirectoryScanInput = {
  readonly directoryAbsolutePath: string;
  readonly directoryWorkspacePath: string;
  readonly entryBudget: number;
  readonly recursive: boolean;
};

export async function isInsideGitWorktree(workspaceRoot: string): Promise<boolean> {
  const inside = await runGit(workspaceRoot, ['rev-parse', '--is-inside-work-tree']);
  return inside.ok && inside.stdout.trim() === 'true';
}

export async function scanGitDirectoryEntries(
  options: GitDirectoryScanInput
): Promise<Map<string, CodeCollabV2FileTreeValue> | null> {
  if (!options.recursive) {
    return null;
  }
  const result = await runGitLsFiles(options.directoryAbsolutePath);
  if (!result.ok) {
    return null;
  }
  return buildEntriesFromGitFilePaths({
    directoryWorkspacePath: options.directoryWorkspacePath,
    entryBudget: options.entryBudget,
    recursive: options.recursive,
    relativeFilePaths: result.paths,
  });
}

async function runGitLsFiles(
  cwd: string
): Promise<{ readonly ok: true; readonly paths: readonly string[] } | { readonly ok: false }> {
  try {
    const [{ stdout }, deleted] = await Promise.all([
      execFileAsync(
        'git',
        [
          '-C',
          cwd,
          'ls-files',
          '-z',
          '--cached',
          '--others',
          '--exclude-standard',
          '--deduplicate',
          '--',
          '.',
        ],
        { maxBuffer: GIT_MAX_BUFFER_BYTES }
      ),
      runGit(cwd, ['ls-files', '--deleted', '-z', '--', '.']),
    ]);
    const deletedPaths = deleted.ok
      ? new Set(deleted.stdout.split('\0').map(normalizeGitPath).filter(isValidRelativeGitPath))
      : new Set<string>();
    return {
      ok: true,
      paths: stdout
        .split('\0')
        .map(normalizeGitPath)
        .filter((filePath) => isValidRelativeGitPath(filePath) && !deletedPaths.has(filePath)),
    };
  } catch {
    return { ok: false };
  }
}

export async function computeAllChanges(
  workspaceRoot: string,
  options: { readonly preferredBaseBranch?: string; readonly diffBase?: string } = {}
): Promise<CodeCollabV2AllChangesState> {
  const diffBase =
    options.diffBase ??
    (await resolveAllChangesDiffBase(workspaceRoot, options.preferredBaseBranch));
  const diffTarget = diffBase ?? 'HEAD';
  const [numstat, nameStatus, untracked] = await Promise.all([
    // `--numstat` cannot use `-z`, so disable `core.quotePath` to keep non-ASCII paths
    // raw (matching the `-z` outputs below); otherwise they are mis-keyed and lose their
    // All Changes diff counts.
    runGit(workspaceRoot, [
      '-c',
      'core.quotePath=false',
      'diff',
      '--numstat',
      '--no-renames',
      '--relative',
      diffTarget,
      '--',
    ]),
    runGit(workspaceRoot, [
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      '--relative',
      diffTarget,
      '--',
    ]),
    runGit(workspaceRoot, ['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  if (!numstat.ok && !nameStatus.ok && !untracked.ok) {
    return {};
  }

  const deletedPaths = nameStatus.ok
    ? parseDeletedPathsFromNameStatus(nameStatus.stdout)
    : new Set<string>();
  const changes: CodeCollabV2AllChangesState = {};
  if (numstat.ok) {
    for (const line of numstat.stdout.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [addRaw, delRaw, ...pathParts] = trimmed.split('\t');
      const filePath = pathParts.join('\t').trim();
      if (!filePath) continue;
      const normalizedPath = normalizeGitPath(filePath);
      if (addRaw === '-' || delRaw === '-') {
        changes[normalizedPath] = true;
        continue;
      }
      const add = Number(addRaw);
      const del = Number(delRaw);
      const diff: [number, number] = [
        Number.isFinite(add) && add >= 0 ? Math.trunc(add) : 0,
        Number.isFinite(del) && del >= 0 ? Math.trunc(del) : 0,
      ];
      changes[normalizedPath] = deletedPaths.has(normalizedPath)
        ? { diff: [0, diff[1]], del: true }
        : { diff };
    }
  }

  if (untracked.ok) {
    for (const filePath of untracked.stdout.split('\0')) {
      if (!filePath) continue;
      const normalizedPath = normalizeGitPath(filePath);
      if (!(normalizedPath in changes)) {
        changes[normalizedPath] = await lineStatsForUntrackedFile(workspaceRoot, normalizedPath);
      }
    }
  }
  return changes;
}

export async function resolveAllChangesDiffBase(
  workspaceRoot: string,
  preferredBaseBranch?: string
): Promise<string | null> {
  if (!(await isInsideGitWorktree(workspaceRoot))) {
    return null;
  }

  const baseRef = await resolveAllChangesBaseRef(workspaceRoot, preferredBaseBranch);
  if (baseRef) {
    const mergeBase = await runGit(workspaceRoot, ['merge-base', baseRef, 'HEAD']);
    const trimmed = mergeBase.ok ? mergeBase.stdout.trim() : '';
    if (trimmed) {
      return trimmed;
    }
  }

  const head = await runGit(workspaceRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  return head.ok && head.stdout.trim() ? head.stdout.trim() : null;
}

async function resolveAllChangesBaseRef(
  workspaceRoot: string,
  preferredBaseBranch?: string
): Promise<string | null> {
  const candidates = gitDiffBaseRefCandidates(preferredBaseBranch);
  for (const candidate of candidates) {
    const exists = await runGit(workspaceRoot, ['rev-parse', '--verify', `${candidate}^{commit}`]);
    if (exists.ok) {
      return candidate;
    }
  }
  return null;
}

async function lineStatsForUntrackedFile(
  workspaceRoot: string,
  workspacePath: string
): Promise<CodeCollabV2AllChangesValue> {
  try {
    const absolutePath = path.resolve(workspaceRoot, workspacePath);
    const bytes = await readFile(absolutePath);
    if (hasBinaryNul(bytes)) return true;
    const text = decodeUtf8(bytes);
    return { diff: [countTextLines(text), 0] };
  } catch {
    return true;
  }
}

function parseDeletedPathsFromNameStatus(stdout: string): Set<string> {
  const deleted = new Set<string>();
  const tokens = stdout.split('\0').filter(Boolean);
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index] ?? '';
    index += 1;
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = tokens[index];
      const newPath = tokens[index + 1];
      index += 2;
      if (oldPath) deleted.add(normalizeGitPath(oldPath));
      if (newPath) deleted.delete(normalizeGitPath(newPath));
      continue;
    }
    const filePath = tokens[index];
    index += 1;
    if (status.startsWith('D') && filePath) {
      deleted.add(normalizeGitPath(filePath));
    }
  }
  return deleted;
}

async function runGit(
  cwd: string,
  args: readonly string[]
): Promise<{ readonly ok: true; readonly stdout: string } | { readonly ok: false }> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      maxBuffer: GIT_MAX_BUFFER_BYTES,
    });
    return { ok: true, stdout };
  } catch {
    return { ok: false };
  }
}

function buildEntriesFromGitFilePaths(options: {
  readonly directoryWorkspacePath: string;
  readonly entryBudget: number;
  readonly recursive: boolean;
  readonly relativeFilePaths: readonly string[];
}): Map<string, CodeCollabV2FileTreeValue> {
  const candidates = new Map<string, CodeCollabV2FileTreeValue>();
  const conflicts = buildGitPathConflictIndex(options.relativeFilePaths);
  for (const relativeFilePath of options.relativeFilePaths) {
    const segments = relativeFilePath.split('/').filter((segment) => segment.length > 0);
    const maxSegmentIndex = options.recursive ? segments.length - 1 : 0;
    for (let index = 0; index <= maxSegmentIndex; index += 1) {
      const segment = segments[index];
      if (!segment) {
        break;
      }
      const relativePath = segments.slice(0, index + 1).join('/');
      const workspacePath = joinWorkspacePath(options.directoryWorkspacePath, relativePath);
      if (conflicts.has(relativePath)) {
        candidates.set(workspacePath, { kind: 'skipped', reason: 'path_conflict' });
        break;
      }
      if (index < segments.length - 1) {
        if (!candidates.has(workspacePath)) {
          candidates.set(workspacePath, { kind: 'lazy' });
        }
      } else {
        candidates.set(workspacePath, true);
      }
    }
  }

  const sortedCandidates = [...candidates.entries()].sort(([leftPath], [rightPath]) => {
    const depthOrder = pathDepth(leftPath) - pathDepth(rightPath);
    return depthOrder === 0 ? leftPath.localeCompare(rightPath) : depthOrder;
  });
  return new Map(sortedCandidates.slice(0, Math.max(0, options.entryBudget)));
}

function buildGitPathConflictIndex(relativeFilePaths: readonly string[]): Set<string> {
  const namesByDirectoryAndKey = new Map<string, Map<string, Set<string>>>();
  for (const relativeFilePath of relativeFilePaths) {
    const segments = relativeFilePath.split('/').filter((segment) => segment.length > 0);
    for (let index = 0; index < segments.l
```

### Core Architecture Module: `apps/cli/src/lib/code-collab/file-index-scan-worker.ts`
```
import { opendir } from 'node:fs/promises';
import path from 'node:path';

import {
  buildCodeCollabFileIndexState,
  type CodeCollabV2AllChangesState,
  type CodeCollabV2FileIndexState,
  type CodeCollabV2FileTreeValue,
} from '@lody/shared';

import { closeDirectoryQuietly } from './directory-handle';
import {
  computeAllChanges,
  isInsideGitWorktree,
  joinWorkspacePath,
  pathSegmentComparisonKey,
  scanGitDirectoryEntries,
} from './file-index-scan-core';

export type FileIndexScanWorkerInput = {
  readonly kind?: 'scan';
  readonly directoryAbsolutePath: string;
  readonly directoryWorkspacePath: string;
  readonly maxRawTextBytes: number;
  readonly entryBudget: number;
  readonly recursive: boolean;
};

export type FileIndexScanWorkerResult = {
  readonly kind: 'scan';
  readonly entries: readonly (readonly [string, CodeCollabV2FileTreeValue])[];
};

export type FileIndexFullStateWorkerInput = {
  readonly kind: 'full-state';
  readonly workspaceRoot: string;
  readonly maxRawTextBytes: number;
  readonly entryBudget: number;
  readonly preferredBaseBranch?: string;
  readonly providedAllChanges?: {
    readonly source: 'diff-store';
    readonly state: CodeCollabV2AllChangesState;
    readonly computeMs: number;
  };
};

export type FileIndexFullStateWorkerResult =
  | {
      readonly kind: 'full-state';
      readonly status: 'ok';
      readonly fileTreeEntries: readonly (readonly [string, CodeCollabV2FileTreeValue])[];
      readonly allChanges: CodeCollabV2AllChangesState;
      readonly fileIndex: CodeCollabV2FileIndexState;
      readonly allChangesSource: 'git' | 'diff-store';
      readonly changedPaths: number;
      readonly pathCount: number;
      readonly durationMs: number;
      readonly scanMs: number;
      readonly allChangesMs: number;
      readonly buildMs: number;
    }
  | {
      readonly kind: 'full-state';
      readonly status: 'needs-provided-all-changes';
      readonly reason: 'not-git';
    };

export type FileIndexWorkerInput = FileIndexScanWorkerInput | FileIndexFullStateWorkerInput;
export type FileIndexWorkerResult = FileIndexScanWorkerResult | FileIndexFullStateWorkerResult;

const DEFAULT_IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'target',
]);

export default async function fileIndexScanWorker(
  input: FileIndexWorkerInput
): Promise<FileIndexWorkerResult> {
  if (input.kind === 'full-state') {
    return await computeFullFileIndexState(input);
  }
  const entries = await scanDirectoryEntries(input);
  return { kind: 'scan', entries: [...entries] };
}

async function computeFullFileIndexState(
  input: FileIndexFullStateWorkerInput
): Promise<FileIndexFullStateWorkerResult> {
  const startedAtMs = Date.now();
  const allChangesResult = await resolveFullStateAllChanges(input);
  if (allChangesResult.status !== 'ok') {
    return {
      kind: 'full-state',
      status: 'needs-provided-all-changes',
      reason: allChangesResult.reason,
    };
  }

  const scanStartedAtMs = Date.now();
  const fileTreeEntries = await scanDirectoryEntries({
    directoryAbsolutePath: input.workspaceRoot,
    directoryWorkspacePath: '',
    maxRawTextBytes: input.maxRawTextBytes,
    entryBudget: input.entryBudget,
    recursive: true,
  });
  const scanMs = Date.now() - scanStartedAtMs;
  const fileTree = Object.fromEntries(fileTreeEntries);
  const buildStartedAtMs = Date.now();
  const fileIndex = buildCodeCollabFileIndexState(fileTree, allChangesResult.allChanges);
  const buildMs = Date.now() - buildStartedAtMs;
  return {
    kind: 'full-state',
    status: 'ok',
    fileTreeEntries: [...fileTreeEntries],
    allChanges: allChangesResult.allChanges,
    fileIndex,
    allChangesSource: allChangesResult.source,
    changedPaths: Object.keys(allChangesResult.allChanges).length,
    pathCount: Object.keys(fileIndex).length,
    durationMs: Date.now() - startedAtMs,
    scanMs,
    allChangesMs: allChangesResult.allChangesMs,
    buildMs,
  };
}

async function resolveFullStateAllChanges(input: FileIndexFullStateWorkerInput): Promise<
  | {
      readonly status: 'ok';
      readonly source: 'git' | 'diff-store';
      readonly allChanges: CodeCollabV2AllChangesState;
      readonly allChangesMs: number;
    }
  | { readonly status: 'needs-provided-all-changes'; readonly reason: 'not-git' }
> {
  if (input.providedAllChanges) {
    return {
      status: 'ok',
      source: input.providedAllChanges.source,
      allChanges: input.providedAllChanges.state,
      allChangesMs: input.providedAllChanges.computeMs,
    };
  }
  if (!(await isInsideGitWorktree(input.workspaceRoot))) {
    return { status: 'needs-provided-all-changes', reason: 'not-git' };
  }

  const allChangesStartedAtMs = Date.now();
  const allChanges = await computeAllChanges(input.workspaceRoot, {
    preferredBaseBranch: input.preferredBaseBranch,
  });
  return {
    status: 'ok',
    source: 'git',
    allChanges,
    allChangesMs: Date.now() - allChangesStartedAtMs,
  };
}

async function scanDirectoryEntries(
  options: FileIndexScanWorkerInput
): Promise<Map<string, CodeCollabV2FileTreeValue>> {
  const gitEntries = await scanGitDirectoryEntries(options);
  if (gitEntries) {
    return gitEntries;
  }

  const entries = new Map<string, CodeCollabV2FileTreeValue>();
  const queue: Array<{ readonly absolutePath: string; readonly workspacePath: string }> = [
    {
      absolutePath: options.directoryAbsolutePath,
      workspacePath: options.directoryWorkspacePath,
    },
  ];
  let remainingEntries = Math.max(0, options.entryBudget);

  while (queue.length > 0 && remainingEntries > 0) {
    const currentDirectory = queue.shift();
    if (!currentDirectory) {
      break;
    }

    const directoryEntries = await readDirectoryEntriesForScan(currentDirectory).catch(
      (error: unknown) => {
        if (currentDirectory.workspacePath === options.directoryWorkspacePath) {
          throw error;
        }
        entries.set(currentDirectory.workspacePath, scanDirectoryReadErrorValue(error));
        return null;
      }
    );
    if (!directoryEntries) {
      continue;
    }
    const collisionKeys = findDirectoryEntryCollisionKeys(directoryEntries);
    for (const { entry, comparisonKey } of directoryEntries) {
      if (remainingEntries <= 0) {
        break;
      }
      const workspacePath = joinWorkspacePath(currentDirectory.workspacePath, entry.name);
      const absolutePath = path.join(currentDirectory.absolutePath, entry.name);
      const value = collisionKeys.has(comparisonKey)
        ? ({ kind: 'skipped', reason: 'path_conflict' } as const)
        : classifyDirectoryEntry(entry);
      if (value === undefined) {
        continue;
      }
      entries.set(workspacePath, value);
      remainingEntries -= 1;
      if (options.recursive && isLazyDirectoryValue(value) && remainingEntries > 0) {
        queue.push({ absolutePath, workspacePath });
      }
    }
  }
  return entries;
}

function scanDirectoryReadErrorValue(error: unknown): CodeCollabV2FileTreeValue {
  const code = errorCode(error);
  if (code === 'EACCES' || code === 'EPERM') {
    return { kind: 'skipped', reason: 'permission_denied' };
  }
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return { kind: 'skipped', reason: 'not_found' };
  }
  return { kind: 'skipped', reason: 'transient_io' };
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

async function readDirectoryEntriesForScan(directoryPath: {
  readonly absolutePath: string;
}): Promise<
  Array<{
    readonly entry: {
      readonly name: string;
      isDirectory(): boolean;
      isFile(): boolean;
      isSymbolicLink(): boolean;
    };
    readonly comparisonKey: string;
  }>
> {
  const directory = await opendir(directoryPath.absolutePath);
  try {
    const directoryEntries: Array<{
      readonly entry: {
        readonly name: string;
        isDirectory(): boolean;
        isFile(): boolean;
        isSymbolicLink(): boolean;
      };
      readonly comparisonKey: string;
    }> = [];
    for await (const entry of directory) {
      if (entry.name === '.' || entry.name === '..') {
        continue;
      }
      directoryEntries.push({
        entry,
        comparisonKey: pathSegmentComparisonKey(entry.name),
      });
    }
    return directoryEntries.sort((left, right) => {
      const keyOrder = left.comparisonKey.localeCompare(right.comparisonKey);
      return keyOrder === 0 ? left.entry.name.localeCompare(right.entry.name) : keyOrder;
    });
  } finally {
    await closeDirectoryQuietly(directory);
  }
}

function classifyDirectoryEntry(entry: {
  readonly name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}): CodeCollabV2FileTreeValue | undefined {
  if (entry.isDirectory()) {
    return DEFAULT_IGNORED_DIRECTORY_NAMES.has(entry.name)
      ? undefined
      : ({ kind: 'lazy' } as const);
  }
  if (entry.isSymbolicLink()) {
    return { kind: 'skipped', reason: 'symlink' };
  }
  if (!entry.isFile()) {
    return { kind: 'skipped', reason: 'special' };
  }
  return true;
}

function findDirectoryEntryCollisionKeys(
  entries: readonly { readonly entry: { readonly name: string }; readonly comparisonKey: string }[]
): Set<string> {
  const namesByKey = new Map<string, Set<string>>();
  for (const { entry, comparisonKey } of entries) {
    const names = namesByKey.get(comparisonKey);
    if (names) {
      names.add(entry.name);
    } else {
      namesByKey.set(comparisonKey, new Set([entry.name]));
    }
  }
  const collisionKeys = new Set<string>();
  for (const [comparisonKey, names] of namesByKey) {
    if (names.size > 1) {
      collisionKeys.add(comparisonKey);
    }
  }
  return collisionKeys;
}

function isLazyDirectoryValue(val
```

### Core Architecture Module: `apps/cli/src/lib/code-collab/turn-diff-store-worker-entry.mjs`
```
import { register } from 'tsx/esm/api';

register();
await import('./turn-diff-store-worker.ts');

```

### Core Architecture Module: `apps/cli/src/lib/code-collab/turn-diff-store-worker.ts`
```
import { runTurnDiffStoreWorker } from '@lody/turn-diff-store/worker';

runTurnDiffStoreWorker();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1109** (2026-09-29): **[Bug] Codex device authorization succeeds but login fails when keyring is unavailable on Linux**
  *Symptoms*: ### Affected area  Agent runtime / ACP  ### Installation method  npm / npx CLI  ### Lody version or commit  0.101.0  ### Operating system  Debian GNU/Linux 13 (trixie), x64, container, non-root user  ### Agent or runtime  Lody-managed Codex CLI 0.156.0; Node.js v24.14.0  ### What happened?  When signing in to ChatGPT for the built-in Codex provider through Lody on a remote Linux container, browser device authorization succeeds, but Lody then reports:  Codex authentication exited with code 1. Make sure device-code login is enabled in your ChatGPT security settings or workspace permissions, then try again.  The Codex profile remains pending, and the account cannot be used.  The login log shows that the OAuth token exchange succeeded, followed by a failure to write the tokens to the system keyring. The displayed error therefore points to device-code settings or workspace permissions rather than the actual credential-storage failure.  Lody itself is successfully signed in and connected to the workspace. This report concerns Codex authentication in the local agent runtime, not Lody account authentication.   ### What did you expect?  After successful device authorization, Lody should persist the Codex credentials and allow the account to be used.  If a required system credential-storage service is unavailable, Lody should clearly identify that dependency instead of suggesting a device-code setting or workspace permission issue.   ### How can we reproduce it?  1. Use a Linux contain

- **Issue #1105** (2026-09-29): **[Bug] Sidebar filter menu flickers with the machine hover card**
  *Symptoms*: ### Affected area  Desktop app  ### Installation method  Desktop release  ### Lody version or commit  0.101.0  ### Operating system  macOS 26.7  ### Agent or runtime  Not applicable. This is a desktop sidebar hover/popover interaction, independent of the agent runtime.  ### What happened?  With the desktop sidebar filter menu already open (`项目` / `最近更新` / `我的任务` / `全部任务` / `显示项目`), hovering the first local-project machine header (`timon-m3mac`) still opens the machine-info hover card on top of that menu. Moving the pointer from the machine name into the open menu then makes the hover card flash: it appears and disappears over the still-open filter popover.  The first machine header owns both surfaces. The filter popover and the machine hover card both fly out to the right of that header on the same popover stacking rung. Leaving the header schedules the hover card's 180ms close grace; entering the overlapping card or returning to the header cancels that close, so a quick move across the shared edge loops open/close.  https://github.com/user-attachments/assets/ad71e388-e14a-4b0d-8d90-4b6875249b13  ### What did you expect?  While the filter menu stays open, hovering the machine header should not open the machine-info overlay, and the overlay should not flash over the menu. Closing the filter menu should restore the normal machine hover card.   ### How can we reproduce it?  1. Open the desktop app with at least one local-project machine group in the sidebar (the first section he

- **Issue #1054** (2026-09-28): **[Bug] CLI daemon exits on a full disk: uncaught log-transport ENOSPC drops unsaved local changes**
  *Symptoms*: ### Affected area  CLI / daemon  ### Installation method  Built from source  ### Lody version or commit  3d16abdc (main); also applies with loro-repo 0.20.0 and 0.20.3  ### Operating system  macOS 27.0 arm64  ### Agent or runtime  _No response_  ### What happened?  When the disk holding the Lody data directory fills up, the CLI daemon exits instead of degrading. In local mode this loses every Loro change made since the disk filled, because the repo SQLite file is the only copy.  Chain observed with Lody's own dependency versions (winston 3.19.0, winston-daily-rotate-file 5.0.0, better-sqlite3 13.0.3, loro-repo 0.20.3) on a genuinely full volume:  1. The next log write fails with `ENOSPC` from the `DailyRotateFile` transport. Nothing listens for it, so it becomes an `uncaughtException`. The logger's `exitOnError: false` (`apps/cli/src/utils/logger.ts`) does not cover transport stream errors. 2. `registerProcessErrorHandlers` (`apps/cli/src/utils/telemetry.ts`) runs cleanup and then calls `process.exit(1)`. The cleanup flush also fails with `SQLITE_FULL`, so in-memory changes that were never persisted are dropped. 3. The supervisor restarts the daemon with backoff. The first log write fails again, so the daemon keeps crashing and restarting until space is freed.  The storage layer itself is resilient. With the process kept alive in the same experiment: - every repo write and cursor save failed with `SQLITE_FULL` and did not corrupt the database; - after space was freed, the nex
  **Post-Mortem & Fix Analysis**:
  > Fixed by #1056: the daemon no longer exits when the log disk is full.

- **Issue #972** (2026-09-25): **[Bug] Imported Pi history sessions show no model / thinking-level selector**
  *Symptoms*: ### Affected area  Desktop app  ### Installation method  Desktop release  ### Lody version or commit  0.100.0  ### Operating system  Windows11 x64  ### Agent or runtime  Pi 0.87.1  ### What happened?  After importing native Pi history sessions into Lody (local project history sync), the imported session opens and shows the replayed history correctly, but the model and thinking-level selectors are missing entirely: the user can neither see which model the Pi session used nor change it.  #### Environment  - Lody 0.100.0 - acp-extension-pi 0.2.0 with session/list + session/load (same capability surface as   LodyAI/acp-extension-pi#4) - Reproduced with two independent adapter implementations (a local build and the   upstream PR #4 build), identical behavior — so this is host-side, not adapter-specific.  #### Root cause  All items below were verified against the Lody 0.100.0 bundle.   1. [verified] The import path (`importLocalProjectSessionsInner` → `loadHistorySessionReplay`→  `requestHistorySessionReplay`) calls `connection.loadSession(...)` and discards the response, keeping only the `session/update` notifications used to materialize history. The `configOptions` returned by the agent are therefore dropped on the floor. 2. [verified] `importNewSession` writes a session meta with 14 fields (id, machineId, createdAt, userId, status, isArchived, origin, cliType, agentType, project, title, titleSource, lastMessageAt, externalHistory) — none of them runtime config. 3. [verified] Imp

- **Issue #666** (2026-09-16): **[Bug] Timed-out steer remains pending_apply after its target turn is stopped**
  *Symptoms*: ### Affected area  Agent runtime / ACP  ### Installation method  Built from source  ### Lody version or commit  The exact revision used for the live observation was not recorded. The affected control flow is present at `b5746d02755257331a6856b4142f02fe1d747ab1`.  ### Operating system  macOS 26.5.1 arm64  ### Agent or runtime  Built-in Codex runtime with the acknowledged-steer capability. Provider session and model identifiers are intentionally omitted.  ### What happened?  When a user submits guidance while a turn is active, Lody writes the user entry as `pending_apply` and offers it through `session/steer`. If the local steer RPC times out before the ACP adapter reports either application or a definitive refusal, the UI keeps the entry in `pending_apply` and continues to show **Steering**.  Stopping the target turn does not resolve that entry. The active prompt is cancelled and the session returns to idle, but the steer is not marked applied, failed, or cancelled and is not promoted to ordinary dispatch. Because ordinary dispatch deliberately skips `pending_apply`, the user's intent is stranded indefinitely.  A separately submitted normal message can still run afterward. It is a new user turn; it does not replay or recover the stranded steer.  The resulting entry is an orphaned state:  - it is absent from the provider conversation; - it is absent from the ordinary dispatch queue; - it has no terminal failure or cancellation state; - it remains displayed as **Steering** after
  **Post-Mortem & Fix Analysis**:
  > Confirmed — the stranded-`pending_apply` behavior is still present at the current head (`05c13ce`). In `SessionExecutionService.steerSessionLocked`, `await steerRun.applied` has no bound tied to the target turn: the steer request submitted to the agent is only guaranteed to settle when the connection closes, so when the turn is stopped while the adapter still holds the extension request (and, for prompt-transport runtimes, when the rejected prompt races the steer verdict), the response never resolves and the guide is never marked applied, failed, or canceled — while the per-session steer mutation queue stays blocked behind that await.  Plan to fix, contained in `session-execution-service.ts`:  1. Race `steerRun.applied` against the target turn's prompt-run settlement, so `steerSession` always returns once the turn is stopped or finished. 2. When the turn's settlement wins the race, settle the guide's history entry to a terminal status (`canceled` when a stop was requested, `failed` oth
  > I implemented and validated the stopped-steer reconciliation on this fixed comparison:  https://github.com/LodyAI/Lody/compare/17430f3a5e6debf2b3a021b77cee06ebdb2ea818...Dante-dan:d05efd1a9e4203b9370321250cf46d8d9d4ebc68  The change keeps a submitted raw steer request in the existing ACP cancellation drain while Stop releases only the local application waiter. A definitive refusal restores the exact history row to `pending` and wakes ordinary dispatch through `messageQueueUpdatedAt`, without rewriting producer-owned `latestUserMsgId`; accepted or transport-unknown delivery becomes an explicit terminal “Delivery unknown” result that can only be retried as a new message. Finalization fences late results, so an old steer B cannot take ownership from or overwrite a newer turn C.  An independent acceptance pass caught that the first revision wrote `_lodySteerOutcome` without declaring it in the strict history input-config schema, so `HistoryWriter` could strip the marker and hide the safe r
  > two bots here? = = 

- **Issue #574** (2026-09-17): **[Bug] Archive can miss child Tabs before metadata cache hydration**
  *Symptoms*: ### Affected area  Session / workspace / local sync  ### Installation method  Built from source  ### Lody version or commit  b4d544394d30  ### Operating system  macOS 26 arm64; the affected Desktop state flow is platform-independent  ### Agent or runtime  Desktop local runtime  ### What happened?  On a cold start, Session Detail becomes interactive as soon as the requested root Session is present in the bootstrap metadata cache. The full workspace metadata scan can still be incomplete at that point. If a user immediately archives the root Session, archive target selection reads the partial `sessionMetaCacheAtom` and can miss a child Tab whose `parentSessionId` points to that root.  The result is inconsistent archive state: the root is archived while its lifecycle-owned child Tab remains active.  ### What did you expect?  Archiving a root Session should not start until the metadata needed to identify all direct child Tabs is hydrated, or archive target selection should read from a complete source. The root and every direct `parentSessionId` child must transition together.  ### How can we reproduce it?  1. Create a root Session A and a child Tab T with `T.parentSessionId = A`. 2. Cold-start Desktop and arrange for bootstrap metadata to expose A before the full workspace metadata scan exposes T. 3. Open Session Detail for A; it resolves because A is already in the active Session cache even though `docMetaCacheReadyAtom` is false. 4. Immediately choose Archive. 5. Observe that ar
  **Post-Mortem & Fix Analysis**:
  > I can take this as a focused archive-readiness fix.  The current report gives a concrete race to test: Session Detail can expose the archive action after the root Session is present but before `docMetaCacheReadyAtom` guarantees that child Tab metadata is complete. I’ll first turn that ordering into a deterministic regression around the archive target selector, then trace whether the smallest safe correction is to gate the action on metadata readiness or to make target selection query a complete source.  I’ll keep the behavioral contract narrow: archiving a root and its direct `parentSessionId` children must be atomic from the user’s perspective, while already-hydrated archive behavior and unrelated session actions remain unchanged. Before submitting, I’ll run the targeted tests plus the repository’s relevant type, format, docs, and PR-body checks, and I’ll recheck for overlapping work. Any PR will start as a draft and include the required public Context handoff. 
  > @Dante-dan Hi, we already have a fix on the way, this issue stems from several other problems. Thanks for your contribution. :)

- **Issue #570** (2026-09-10): **[Bug] Context compaction indicator remains active after a failed compact request**
  *Symptoms*: ### Affected area  Agent runtime / ACP  ### Installation method  Built from source  ### Lody version or commit  b4d54439  ### Operating system  macOS (exact version and architecture were not captured)  ### Agent or runtime  Codex ACP runtime  ### What happened?  When automatic context compaction starts and the remote compact request fails, Lody records a visible `chat_failed` notice and returns the Session to idle, but the composer continues to display "Compacting" indefinitely.  The durable history still contains the latest `context_compaction` tool call with `pending` or `in_progress` status. Reloading retains the stale indicator because the provider prompt error did not settle that activity.  Observed error:  ```text Error running remote compact task: Connection failed: error sending request ```  The observed value can be a plain `Error` without a numeric ACP code, so settlement cannot depend only on ACP error parsing or a narrow disconnect-message allowlist.  ### What did you expect?  When a started provider prompt returns an error and is no longer in flight, Lody should persist unresolved context-compaction activity in that exact turn as failed so the transcript and usage footer converge after reload.  For cancellation, host finalization alone is not sufficient evidence. The compaction must remain active while the raw ACP prompt remains active. After raw completion or successful termination, the unresolved activity must become terminal before the execution owner is relea
  **Post-Mortem & Fix Analysis**:
  > I traced the host-side path and found that `isSessionContextCompacting` only checks the latest compaction tool status, while `markAssistantTurnFinished` marks its owning assistant entry as finished without settling an incomplete compaction item. This matches the stale persisted indicator described here; I have not reproduced the remote provider failure itself.  I'd like to take this on as a focused fix: make the indicator respect the owning turn's terminal state, including existing saved history, and settle incomplete context-compaction activities when their owning turn is finalized. I will preserve completed tool results, unrelated/background tools, turn ownership, late terminal ACP updates, and the existing finalization timing behavior.  I will construct deterministic history and finalization tests covering pending/in-progress compaction followed by failure or cancellation, saved-history reload, repeated finalization, and a new compaction in the next turn. The initial change will sta

- **Issue #377** (2026-09-12): **[Bug] Archived sessions cannot be cleared from worktree**
  *Symptoms*: ### Affected area  Desktop app  ### Installation method  Desktop release  ### Lody version or commit  0.90.1  ### Operating system  MacOS 26.6  ### Agent or runtime  PI 0.84.4  ### What happened?  After archiving the session, it is not possible to clean up the working tree and execute the cleanup script  ### What did you expect?  After archiving the session, clean up the worktree and execute the cleanup script  ### How can we reproduce it?  1. Archive Session 2. The working tree directory corresponding to the session is still present, and the cleanup script has not been executed.  ### How often does it happen?  Every time  ### Relevant log output  ```shell  ```  ### Additional context  _No response_  ### Before submitting  - [x] I searched the existing issues and did not find a duplicate. - [x] This report concerns an open-source component in this repository, not a hosted service, Web or mobile app, account, or billing issue. - [x] This is not a security vulnerability; security reports follow the repository's security policy. - [x] I removed credentials, private source, conversations, prompts, personal data, and other sensitive information.
  **Post-Mortem & Fix Analysis**:
  > 什么时候能修复这个问题呢？

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

### Incident Patch 1: `e73d3109` (2026-10-04)
**Commit Message**: fix: preserve spacing between progress prose and tool summaries (#1252)

* fix: preserve spacing between progress prose and tool summaries

Keep 6px gaps around summaries in expanded and streaming work, and use 24px reading leading at the default font size.

Model: gpt-6

* docs: link conversation spacing decision to PR

Model: gpt-6

* test: drain file-tree scroll timers before jsdom teardown

Use a fake clock for virtualized tree tests and verify the mounted window after scroll completion.

Model: gpt-6

**File**: `.agents/notes/implemented/bug-fix/2026-10-04-conversation-progress-spacing.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# Preserve reading gaps inside assistant work
+
+Status: implemented
+Translation: current
+PR: [#1252](https://github.com/LodyAI/Lody/pull/1252)
+
+[中文](2026-10-04-conversation-progress-spacing.zh.md)
+
+## Abstract
+
+Long progress paragraphs and tool summaries crowded together because expanded
+completed work forced every child into a zero-padding process row. Progress prose
+and group headers now retain a 6px conversation prose gap, while individual
+tool details keep their compact pitch. Reading leading increases
+from 22px to 24px at 14px text. Expanded conversations use more vertical space in
+exchange for clearer separation between explanations and tool activity.
+
+## Decision and evidence
+
+This partially replaces the density choices in the [previous rhythm decision](../simplification/2026-10-03-conversation-rhythm-stylex.md).
+The [rhythm Spec](../../../../specs/conversation-rhythm.md) owns the current formulas.
+The virtual-row renderer chooses spacing by content kind even inside worked groups;
+`isWorkedDetail` continues to own tone and grouping, not prose spacing. The first
+assistant row still has no extra top gap. Response and next-round reserves retain
+their existing ownership and values.
+
+A 12px gap on both sides of each summary separated related work too much; the
+final 6px gap keeps summaries close to their surrounding prose.
+Increasing only reading leading would leave zero separation around progress text.
+The synthetic progress stories therefore alternate wrapped Chinese/mixed-script
+paragraphs with tool summaries, in completed and streaming states. No captured
+conversation is used. Browser assertions measure both directions of the 6px gap
+and verify that expanding a tool summary adds no gap before its first detail.
+
+## Verification and limits
+
+Validation uses an isolated copy with dependencies and current tracked source.
+All 20 interface typography browser tests pass, covering reading leading, all
+five sizes, light/dark and narrow layouts, folding, action access and theme overrides.
+The virtual-row identity and turn-block suites pass all 26 tests. Components type
+checking and formatting of changed TypeScript files pass. Before/after screenshots
+of the same expanded synthetic story were visually inspected. The
+[Playwright comparison](../../assets/conversation-progress-spacing/before-vs-after.png)
+uses identical 1120 × 1200 viewports, 14px text, dark theme and expanded work.
+Root checks in the primary worktree remain blocked by missing dependencies;
+document checks report the same 62 pre-existing errors, with no new errors or
+SHA-protected topics.
+The Spec remains draft; implementation does not imply human approval.
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-04-conversation-progress-spacing.zh.md` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# 保留助手工作过程中的阅读间距
+
+Status: implemented
+Translation: current
+PR: [#1252](https://github.com/LodyAI/Lody/pull/1252)
+
+[English](2026-10-04-conversation-progress-spacing.md)
+
+## 摘要
+
+展开已完成的工作后，所有子行都被强制使用零 padding 的过程行，导致长进度说明与工具
+摘要挤在一起。现在进度正文和分组标题保留 6px 会话正文间距，单条工具
+明细仍使用紧凑行距。14px 正文的阅读行高由 22px 增至 24px。展开的对话会占用更多
+纵向空间，以便读者区分说明文字与工具活动。
+
+## 决策与证据
+
+本次部分替代[此前的会话节奏决策](../simplification/2026-10-03-conversation-rhythm-stylex.zh.md)中的密度选择。
+[节奏 Spec](../../../../specs/conversation-rhythm.zh.md)拥有当前公式。
+虚拟行 renderer 在工作组内部也按内容种类选择间距；`isWorkedDetail` 继续负责色调与
+分组，不再压缩正文间距。助手第一行仍不额外增加顶部距离，回复与下一轮预留区的
+归属和值保持不变。
+
+摘要前后各留 12px 会把相关工作拆得过散，最终采用 6px，让摘要靠近前后正文。
+只增大阅读行高无法解决进度文字周围的零间距。合成进度场景因此交替展示自动换行的
+中文及中英文段落与工具摘要，同时覆盖完成和流式状态，没有使用捕获的会话记录。
+浏览器断言测量两个方向的 6px 距离，并验证展开工具摘要后，第一条明细前不增加距离。
+
+## 验证与限制
+
+验证在具有依赖的独立副本中使用当前已跟踪源码执行。全部 20 项界面排版浏览器测试
+通过，覆盖阅读行高、全部五档字号、明暗主题、窄窗口、折叠、操作可达性与主题覆盖。
+虚拟行身份与轮次分块套件的 26 项测试通过，组件类型检查及修改的 TypeScript 文件
+格式检查通过。已目视检查同一展开合成场景的前后截图；
+[Playwright 对比图](../../assets/conversation-progress-spacing/before-vs-after.png)
+使用相同的 1120 × 1200 窗口、14px 字号、暗色主题与工作展开状态。主工作树的根检查仍受缺失
+依赖阻塞；文档检查报告相同的 62 项既有错误，没有新增错误或 SHA 保护主题。
+Spec 保持 draft，实现不代表人工批准。
```

**File**: `.agents/notes/implemented/testing/2026-10-04-file-tree-scroll-test-clock.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# Own the file-tree test scroll clock
+
+Status: implemented
+Translation: current
+PR: [#1252](https://github.com/LodyAI/Lody/pull/1252)
+
+[中文](2026-10-04-file-tree-scroll-test-clock.zh.md)
+
+## Abstract
+
+The component CI shard passed all 1701 assertions but failed with an unhandled
+React update after jsdom teardown. The file-tree scrolling test left the virtualizer's
+scroll-end debounce on the real clock. The suite now owns fake timers, exercises
+scroll completion explicitly, and drains remaining callbacks before restoring the
+real clock. Runtime behavior is unchanged.
+
+## Evidence and decision
+
+[The failing CI job](https://github.com/LodyAI/Lody/actions/runs/37202036948/job/111435612581)
+traces `window is not defined` through TanStack Virtual's debounced offset observer
+to React's state dispatcher, after `file-tree-virtual-rows.test.tsx` teardown.
+Virtual-core 3.13.23 removes the scroll listeners but does not cancel that timeout.
+The isolated baseline run passed locally, consistent with a teardown timing race.
+
+The existing scrolling test now advances the fake clock and checks that the mounted
+window remains nonempty, bounded and at the same scrolled position after scroll end.
+Teardown unmounts the root and drains pending timers while jsdom is still alive.
+This follows the per-file cleanup boundary retained in the
+[module-graph decision](2026-09-10-components-test-module-graph.md); it does not disable
+Vitest's unhandled-error reporting or add sleeps.
+
+## Verification
+
+The focused file-tree suite passes all seven tests. The matching component shard
+(`--maxWorkers=4 --shard=1/3`) passes all 185 files / 1701 tests without unhandled
+errors. Targeted formatting and diff checks pass. Root checks in this dependency-free
+worktree remain blocked by missing tools; validation uses the isolated dependency-equipped copy.
```

**File**: `.agents/notes/implemented/testing/2026-10-04-file-tree-scroll-test-clock.zh.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# 文件树测试拥有自己的滚动时钟
+
+Status: implemented
+Translation: current
+PR: [#1252](https://github.com/LodyAI/Lody/pull/1252)
+
+[English](2026-10-04-file-tree-scroll-test-clock.md)
+
+## 摘要
+
+组件 CI 分片的 1701 个断言全部通过，却在 jsdom 销毁后因未处理的 React 更新失败。
+文件树滚动测试把虚拟列表的滚动结束防抖回调留在了真实时钟上。该套件现使用假时钟，
+显式验证滚动结束，并在恢复真实时钟前执行剩余回调。运行时行为不变。
+
+## 证据与决策
+
+[失败的 CI job](https://github.com/LodyAI/Lody/actions/runs/37202036948/job/111435612581)
+表明 `file-tree-virtual-rows.test.tsx` 销毁环境后，TanStack Virtual 的防抖 offset
+observer 调用 React 状态更新，触发 `window is not defined`。Virtual-core 3.13.23
+移除了滚动监听器，却没有取消该定时器。本地单独运行原测试通过，符合收尾时序竞争的表现。
+
+既有滚动测试现在推进假时钟，检查滚动结束后的挂载窗口仍非空、大小有界且保持滚动位置。
+清理阶段先卸载 React root，再在 jsdom 仍存在时执行剩余定时器。这遵循
+[模块图决策](2026-09-10-components-test-module-graph.zh.md)保留的逐文件清理边界，
+没有关闭 Vitest 未处理异常报告，也没有增加 sleep。
+
+## 验证
+
+聚焦文件树套件的七项测试通过。对应组件分片（`--maxWorkers=4 --shard=1/3`）的
+185 个文件、1701 项测试全部通过，没有未处理异常。定向格式及 diff 检查通过。
+当前工作树缺少依赖，根检查仍因缺少工具阻塞；验证在具有依赖的独立副本中执行。
```

**File**: `packages/components/src/components/ai-gui/AGENTS.md` (modified, +2/-2)
```diff
@@ -70,8 +70,8 @@ Edit `AGENTS.md`, not its `CLAUDE.md` symlink. Ownership: [README.md](README.md)
   margin; footer bleed is trailing-only (`-mr-[7px]`).
   See `AssistantTurnAlignment.stories`.
 - Follow the StyleX [spacing contract](../../../../../specs/conversation-rhythm.md).
-  User rows own `responseGap`; last assistant rows own `roundGap`, including footer
-  and next-user metadata. Cache and memo comparison include boundary state.
+  User rows own `responseGap`; assistant tails own `roundGap` including footer/metadata.
+  Cache/memo include boundaries. Expanded work preserves prose and summary gaps.
 
 ## Conversation Outline
 
```

**File**: `packages/components/src/components/ai-gui/README.md` (modified, +6/-2)
```diff
@@ -78,10 +78,12 @@ to a subtree to change these values without descendant utility overrides.
 Activity thought prose uses compact Markdown at the same subheadline size and
 leading as its summary and tool rows, in the parent conversation and task dialog.
 Reading prose and user text use `readingLeading`, derived from the body role
-at 1.1 times its leading (22px at 14px). Compact tool prose and code retain their
+at 1.2 times its leading (24px at 14px). Compact tool prose and code retain their
 control leading. Explicit previews scale the reading token with their own size.
 Spacing follows the active interface leading through semantic `responseGap`,
-`roundGap`, `activityPitch`, `paragraphGap`, `surfaceGap` and `listItemGap` tokens.
+`roundGap`, `activityPitch`, `proseGap`, `paragraphGap`, `surfaceGap` and `listItemGap` tokens.
+Progress prose and activity summaries keep the prose gap inside expanded work;
+individual tool details keep their compact pitch.
 The user row reserves the response gap for its actions. The first assistant row
 adds no top gap; its last row reserves the next-round boundary only before a user
 turn. Footer actions and the next user's metadata share that reserve; larger
@@ -101,6 +103,8 @@ for scope and retained exceptions.
 `ConversationRhythmTheme` applies a scoped StyleX theme to the same components.
 `ConversationRhythmReading` and its streaming variant add continuous mixed-script
 paragraphs to verify real wrapped-line pitch and compare reading density.
+`ConversationRhythmProgress` and its streaming variant interleave long progress
+paragraphs with tool summaries to check separation inside and outside folded work.
 The no-footer and edited-files variants exercise boundary reserves without a
 footer and with taller footer content. The typography browser suite checks all
 five interface sizes, measured activity/turn spacing, preserved
```

**File**: `packages/components/src/components/ai-gui/conversation.tokens.stylex.ts` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import * as stylex from '@stylexjs/stylex';
 import { colors } from '@lody/ui/tokens/colors.stylex';
 import { radius, space, text } from '@lody/ui/tokens/scales.stylex';
 
-const readingLeading = `calc(${text.bodyLeading} * 1.1)`;
+const readingLeading = `calc(${text.bodyLeading} * 1.2)`;
 
 /** Conversation anatomy; hosts can override this group with createTheme. */
 export const conversation = stylex.defineVars({
@@ -20,7 +20,7 @@ export const conversation = stylex.defineVars({
   activityPitch: `max(${space[6]}, calc(${text.subheadlineLeading} + ${space[1.5]}))`,
   activityPadding: `calc(${space[1]} / 2)`,
   activityHoverFill: 'hsl(var(--hover) / 0.4)',
-  proseGap: space[1],
+  proseGap: space[1.5],
   surfaceGap: `max(${space[4]}, calc(${text.bodyLeading} - ${space[1]}))`,
   paragraphGap: `max(${space[3]}, calc(${text.bodyLeading} - ${space[2]}))`,
   listItemGap: `max(2px, calc(${space[6]} - ${readingLeading}))`,
```

**File**: `packages/components/src/components/ai-gui/view.tsx` (modified, +3/-8)
```diff
@@ -5528,26 +5528,21 @@ const AssistantChatItem = memo(function AssistantChatItem({
     }
   })();
 
-  /* Hierarchy (L1 worked → L2 step → L3 detail → L4 result).
-     Shared gap for process/answer siblings; footer sits tighter under the
-     answer so edited-files is not double-spaced by leading and row padding. */
+  // Progress prose keeps its reading gap even inside expanded work. Only
+  // individual activity details share the compact tool-row pitch.
   const turnSiblingGap = conversationSurface.proseRow;
-  const processSiblingGap = conversationSurface.processRow;
   /* Surfaces need more separation than prose, whose leading already supplies
      part of the visual gap. Keep both gaps in the conversation token group. */
   const cardSiblingGap = conversationSurface.surfaceRow;
   const verticalClass = (() => {
-    if (isWorkedDetail) {
-      return processSiblingGap;
-    }
     switch (content.kind) {
       case 'content':
         return isCardContentBlock(content.block) ? cardSiblingGap : turnSiblingGap;
       case 'plan':
         return cardSiblingGap;
       case 'worked_group_header':
       case 'activity_group_header':
-        return processSiblingGap;
+        return turnSiblingGap;
       case 'subagent_tasks':
         return turnSiblingGap;
       case 'footer':
```

---

### Incident Patch 2: `759ddb61` (2026-10-04)
**Commit Message**: fix: preserve local preview module credentials (#1242)

Model: gpt-6

**File**: `.agents/notes/implemented/bug-fix/2026-10-04-local-preview-module-auth.md` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+# Local preview module authentication
+
+Status: implemented
+Translation: current
+
+[中文](2026-10-04-local-preview-module-auth.zh.md)
+
+## Abstract
+
+Local previews issued SameSite=Lax capability cookies, which Chromium rejected
+inside cross-site frames. First-level resources could authenticate with a
+token-bearing Referer, while nested imports lost the token and returned 403.
+The proxy now issues Secure, HttpOnly, SameSite=None, Partitioned cookies for
+local viewing as well as remote viewing, and gives each local endpoint a distinct
+cookie name so concurrent Sessions cannot overwrite one another. Synthetic
+Chromium HTTP and file-host checks pass; the reported page's separate 502 and
+unrelated console warnings remain unverified.
+
+## Decision and evidence
+
+Cookie scope ignores ports. All ephemeral local listeners used the same host,
+path and name, so even a context accepting the cookie could replace one Session's
+token with another's. Local names now include the endpoint ID; remote names stay
+unchanged because remote viewers have distinct bound hostnames. Authorization
+still checks the exact active endpoint's token on every HTTP request and WebSocket
+upgrade. Bare Origin and tokenless Referer remain insufficient, and forwarding
+continues to strip all cookies before contacting the target.
+
+A real Chrome fixture embedded `127.0.0.1` under a `localhost` top-level page.
+With SameSite=Lax, no cookie was stored or sent on the entry or nested module.
+With Secure, SameSite=None and Partitioned, Chromium accepted the loopback cookie
+and sent it on both. This uses Chromium's trusted-loopback handling; it does not
+make arbitrary HTTP origins secure or promise compatibility with every engine.
+[Chrome's partitioned-cookie documentation](https://developer.chrome.com/docs/devtools/application/cookies)
+explains the top-level-site partition key.
+
+A second source-level check used the actual LocalPreviewProxyManager, a synthetic
+module server, and a WebSocket echo server. For both a cross-site HTTP host and a
+file host, it opened two Session frames sequentially, awaited module execution
+and echo events, then fetched another resource from the first frame. Both frames
+and the revisit succeeded; a request without credentials returned 403. No sleeps,
+external services, user project files or captured transcripts were involved.
+
+The existing proxy suite adds a shared cookie-jar regression, foreign-cookie and
+anonymous rejection, upstream cookie stripping, and cookie-authenticated WS data
+transfer. Cookie attributes are checked at the HTTP response boundary; Node fetch
+does not itself model browser SameSite policy. The browser fixture was an ad hoc
+source-level check, not a new CI browser dependency or packaged Electron test.
+
+Validation: all 109 CLI preview tests, CLI typechecking, scoped lint and formatting
+pass. Full `pnpm format` and workspace typechecking also pass. Root `pnpm check`
+stops at existing `no-shadow` lint errors in `mobile-account-settings.tsx` and
+`unified-project-selector.tsx`, before repository tests. Documentation checking
+reports six unrelated links into uninitialized Kimi and Pi submodules; no changed
+document is reported as invalid. A packaged application build was not run.
+
+## Scope and related decisions
+
+This repairs credential delivery without relaxing the
+[Quick Tunnel access contract](../../../../specs/quick-tunnel-preview.md).
+The earlier [Fetch Metadata fix](2026-09-20-preview-fetch-metadata.md) addresses
+upstream Astro rejection of navigation metadata and remains necessary; it does
+not solve cookie loss in nested imports. Origin mapping, local target binding,
+remote cookie naming and credential separation remain intact.
+
+A 502 can be an upstream failure or a proxy exception; its response body is needed
+to distinguish causes. The reported 502, 404 and styleq warning were not reproduced
+by these authentication fixtures and are not claimed fixed. Running user desktop
+and daemon processes were not replaced.
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-04-local-preview-module-auth.zh.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# 本地预览模块鉴权
+
+Status: implemented
+Translation: current
+
+[English](2026-10-04-local-preview-module-auth.md)
+
+## 摘要
+
+本地预览签发 SameSite=Lax 凭证 Cookie，Chromium 在跨站框架中会拒绝保存它。
+首层资源仍可能凭带 token 的 Referer 通过鉴权，但嵌套导入丢失凭证后会返回 403。
+代理现在对本地和远程预览都使用 Secure、HttpOnly、SameSite=None、Partitioned
+Cookie，并为每个本地端点使用独立名称，避免并行 Session 覆盖彼此的凭证。
+合成页面的 Chromium HTTP 和 file 宿主验证通过；报告中的另一个 502 和其他
+控制台警告仍未验证。
+
+## 决策与证据
+
+Cookie 作用域不区分端口。所有临时本地监听器原本使用相同主机、路径和名称，
+所以即便浏览器接受 Cookie，也会让后开的 Session 覆盖前一个的 token。
+本地名称现在包含端点 ID；远程查看器绑定不同主机名，因此远程名称保持不变。
+每次 HTTP 请求和 WebSocket 升级仍检查当前活动端点的精确 token。
+仅有 Origin 或不含 token 的 Referer 仍不足以授权，转发到目标前仍剥离所有 Cookie。
+
+真实 Chrome 合成验证在 `localhost` 顶层页面中嵌入 `127.0.0.1`。
+SameSite=Lax 配置没有保存 Cookie，入口和嵌套模块请求均不携带它。
+改用 Secure、SameSite=None 和 Partitioned 后，Chromium 接受回环 Cookie，
+两个请求都携带了凭证。这依赖 Chromium 的可信回环处理，不会让任意 HTTP
+来源变成安全来源，也不保证所有浏览器引擎兼容。
+[Chrome 分区 Cookie 文档](https://developer.chrome.com/docs/devtools/application/cookies)
+说明了按顶层站点划分的分区键。
+
+第二项源码级验证使用真实 LocalPreviewProxyManager、合成模块服务器和
+WebSocket 回显服务器。在跨站 HTTP 宿主和 file 宿主中，分别依次打开两个
+Session 框架，等待模块执行和回显事件，然后从第一个框架再次请求资源。
+两个框架及回访均成功；不含凭证的请求返回 403。过程不依赖 sleep、外部服务、
+用户项目文件或捕获的会话文本。
+
+现有代理测试增加共享 Cookie jar 回归、其他端点 Cookie 和匿名请求拒绝、
+上游 Cookie 剥离，以及通过 Cookie 鉴权的 WebSocket 数据传输。
+Cookie 属性在 HTTP 响应边界检查；Node fetch 自身不模拟浏览器 SameSite 策略。
+浏览器验证是临时源码级检查，没有新增 CI 浏览器依赖，也不是打包 Electron 测试。
+
+验证：CLI 预览的全部 109 项测试、CLI 类型检查、修改范围的 lint 和格式检查通过。
+全仓库 `pnpm format` 和类型检查也通过。根目录 `pnpm check` 在
+`mobile-account-settings.tsx` 和 `unified-project-selector.tsx` 的现有
+`no-shadow` lint 错误处停止，尚未进入全仓库测试。文档检查报告了六个指向
+未初始化 Kimi、Pi 子模块的无关链接；没有报告本次修改文档无效。未构建打包应用。
+
+## 范围与相关决策
+
+本次修复凭证传递，没有放宽
+[Quick Tunnel 访问契约](../../../../specs/quick-tunnel-preview.zh.md)。
+此前的 [Fetch Metadata 修复](2026-09-20-preview-fetch-metadata.zh.md)
+处理上游 Astro 对导航元数据的拒绝，仍然必要；它不能解决嵌套导入丢失 Cookie。
+Origin 映射、本地目标绑定、远程 Cookie 名称和凭证隔离均保留。
+
+502 可能来自上游失败或代理异常，需要响应正文来区分原因。
+这些鉴权合成用例没有复现报告中的 502、404 和 styleq 警告，不宣称修复了它们。
+没有替换用户正在运行的桌面和 daemon 进程。
```

**File**: `apps/cli/src/preview/AGENTS.md` (modified, +2/-2)
```diff
@@ -56,8 +56,8 @@ Managed preview tunnels and the local proxy. [apps/cli/AGENTS.md](../../AGENTS.m
   use the trusted local route without cloud authorization; no remote fallback.
 - Endpoint capabilities are checked on every HTTP request and WS upgrade. There
   is no global unlock: a matching Origin/tokenless Referer never grants access.
-  Local and remote listeners use different random tokens; remote token cookies
-  are Secure, HttpOnly, SameSite=None and Partitioned. A remote viewer origin must
+  Local and remote tokens differ; cookies are Secure, HttpOnly, SameSite=None and
+  Partitioned. Local cookie names are endpoint-specific. A remote viewer origin must
   be explicitly bound, never inferred from Host or forwarded headers.
 - A WS upgrade is acknowledged only after the upstream selects its subprotocol.
   Preserve text/binary frames and close shape; use socket backpressure, not an
```

**File**: `apps/cli/src/preview/README.md` (modified, +20/-1)
```diff
@@ -1,4 +1,23 @@
-# Managed cloudflared lifecycle and distribution
+# Managed preview proxy and cloudflared
+
+## Embedded local authentication
+
+`local-preview-proxy.ts` exchanges a query capability for an HttpOnly, Secure,
+SameSite=None, Partitioned cookie on both local and remote endpoints. Chromium
+accepts Secure cookies on the literal loopback listener. SameSite=Lax cannot
+bootstrap cookies inside cross-site preview frames: first-level resources may
+authenticate through a token-bearing Referer, but nested module imports lack it.
+Local cookie names include the endpoint ID because cookies ignore TCP ports;
+opening another Session must not overwrite the first Session's credential.
+
+Every HTTP request and WebSocket upgrade still requires that endpoint's token.
+Matching Origin or a tokenless Referer cannot unlock the listener. Proxy cookies
+are stripped before forwarding to the development server. A 502 is a separate
+forwarding/upstream failure; inspect its response body instead of disabling
+authentication or the development server's origin checks.
+
+Evidence and browser-validation limits:
+[local module authentication](../../../../.agents/notes/implemented/bug-fix/2026-10-04-local-preview-module-auth.md).
 
 ## Process ownership
 
```

**File**: `apps/cli/src/preview/local-preview-proxy.test.ts` (modified, +61/-0)
```diff
@@ -528,6 +528,52 @@ describe('LocalPreviewProxyManager', () => {
     await expect(fetch(endpoint.viewerUrl)).rejects.toThrow();
   });
 
+  it('keeps module requests authenticated for two loopback previews sharing a cookie jar', async () => {
+    const { server, target } = await listenHtmlServer();
+    servers.push(server);
+    const upstreamCookies: Array<string | undefined> = [];
+    server.prependListener('request', (request) => upstreamCookies.push(request.headers.cookie));
+    const manager = new LocalPreviewProxyManager({ logger: createLogger() });
+    managers.push(manager);
+    const endpoints = [];
+    const cookies = new Map<string, string>();
+    for (const sessionId of ['first-preview', 'second-preview']) {
+      const endpoint = await manager.acquire({ sessionId: sessionId as SessionId, target });
+      endpoints.push(endpoint);
+      const page = await fetch(endpoint.viewerUrl);
+      expect(page.status).toBe(200);
+      await page.text();
+      const setCookie = page.headers.get('set-cookie') ?? '';
+      // These attributes allow Chromium to retain credentials in a cross-site
+      // iframe, including when ordinary third-party cookies are blocked.
+      expect(setCookie).toContain('; Path=/; HttpOnly; Secure; SameSite=None; Partitioned');
+      const pair = setCookie.split(';')[0] ?? '';
+      const separator = pair.indexOf('=');
+      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
+    }
+    const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
+    for (const endpoint of endpoints) {
+      const resource = new URL('/@react-refresh', endpoint.viewerUrl);
+      const referer = new URL('/src/nested-module.js', endpoint.viewerUrl).href;
+      const response = await fetch(resource, { headers: { cookie, referer } });
+      expect(response.status).toBe(200);
+      expect(await response.text()).toContain('RefreshRuntime');
+      const denied = await fetch(resource, { headers: { referer } });
+      expect(denied.status).toBe(403);
+      await denied.text();
+      // Another endpoint's cookie cannot authenticate this listener.
+      const ownToken = new URL(endpoint.viewerUrl).searchParams.get('__lody_preview_token');
+      const foreignCookies = [...cookies]
+        .filter(([, value]) => value !== ownToken)
+        .map(([name, value]) => `${name}=${value}`)
+        .join('; ');
+      const crossed = await fetch(resource, { headers: { cookie: foreignCookies, referer } });
+      expect(crossed.status).toBe(403);
+      await crossed.text();
+    }
+    expect(upstreamCookies).toEqual([undefined, undefined, undefined, undefined]);
+  });
+
   it('keeps one session-owned proxy endpoint until it is explicitly released', async () => {
     const { server, target } = await listenHtmlServer();
     servers.push(server);
@@ -769,6 +815,21 @@ describe('LocalPreviewProxyManager WebSocket close forwarding', () => {
     sockets.push(denied);
     const error = await new Promise<Error>((resolve) => denied.once('error', resolve));
     expect(error.message).toContain('403');
+    const authorized = new WebSocket(address, {
+      headers: { cookie: page.headers.get('set-cookie')?.split(';')[0] ?? '' },
+    });
+    sockets.push(authorized);
+    await new Promise<void>((resolve, reject) => {
+      authorized.once('open', resolve);
+      authorized.once('error', reject);
+    });
+    const local = await upstream.nextUpstreamSocket();
+    sockets.push(local);
+    const received = new Promise<string>((resolve) =>
+      local.once('message', (bytes) => resolve(bytes.toString()))
+    );
+    authorized.send('cookie-authenticated hot reload');
+    expect(await received).toBe('cookie-authenticated hot reload');
   });
 
   it('mirrors an abnormal upstream close to the browser instead of throwing', async () => {
```

**File**: `apps/cli/src/preview/local-preview-proxy.ts` (modified, +10/-5)
```diff
@@ -69,6 +69,13 @@ type AcquireLocalPreviewEndpointOptions = {
 const LOCAL_PREVIEW_TOKEN_QUERY_PARAM = PREVIEW_ACCESS_TOKEN_QUERY_PARAM;
 const LOCAL_PREVIEW_TOKEN_COOKIE = PREVIEW_ACCESS_TOKEN_COOKIE;
 
+// Cookies ignore ports: each loopback listener needs its own name so opening
+// another Session cannot replace the credential for an existing module graph.
+const tokenCookieName = (record: LocalPreviewProxyRecord): string =>
+  record.remote
+    ? LOCAL_PREVIEW_TOKEN_COOKIE
+    : `${LOCAL_PREVIEW_TOKEN_COOKIE}_${record.endpoint.endpointId}`;
+
 const toUrlHost = (host: string): string => (host.includes(':') ? `[${host}]` : host);
 
 const buildLocalOrigin = (target: PreviewTarget): URL =>
@@ -577,9 +584,7 @@ export class LocalPreviewProxyManager {
     if (options?.queryOnly) {
       return false;
     }
-    if (
-      parseCookieHeader(request.headers.cookie).get(LOCAL_PREVIEW_TOKEN_COOKIE) === record.token
-    ) {
+    if (parseCookieHeader(request.headers.cookie).get(tokenCookieName(record)) === record.token) {
       return true;
     }
     if (this.isAuthorizedByTokenReferer(record, request)) {
@@ -624,9 +629,9 @@ export class LocalPreviewProxyManager {
     if (setTokenCookie) {
       sanitized.push([
         'set-cookie',
-        `${LOCAL_PREVIEW_TOKEN_COOKIE}=${encodeURIComponent(
+        `${tokenCookieName(record)}=${encodeURIComponent(
           record.token
-        )}; Path=/; HttpOnly; ${record.remote ? 'Secure; SameSite=None; Partitioned' : 'SameSite=Lax'}`,
+        )}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`,
       ]);
     }
     // Fetch Headers already combined repeated names; upstream cookies were
```

---

### Incident Patch 3: `bbb69da4` (2026-10-04)
**Commit Message**: fix: test

**File**: `.agents/notes/implemented/testing/2026-10-04-cli-transport-fixture-isolation.md` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+# Synchronize simulator input and isolate native Git fixtures
+
+Status: implemented
+Translation: current
+
+[中文](2026-10-04-cli-transport-fixture-isolation.zh.md)
+
+## Abstract
+
+CLI transport tests depended on WebSocket handshake ordering and inherited Git
+state. Simulator input tests now await an upstream ping/pong before sending
+touches, while recursive Git fixtures discard ambient Git/SSH variables and run
+outside the repository executing the tests. Existing behavioral assertions remain;
+timeouts and production transport behavior are unchanged.
+
+## Evidence and decision
+
+The simulator server's `connection` event fires before the gateway necessarily
+processes the HTTP upgrade. Input received while its upstream is still connecting
+closes the stream, leaving a test waiting for a forwarded touch. An automatic pong
+from that upstream explicitly proves readiness without sleeps or retries. Apply
+this barrier to paired touches and bottom-edge tests; the existing video round-trip
+already synchronizes the ordinary touch test.
+
+The native Git fixture previously filtered only selected configuration variables.
+It still inherited `GIT_DIR`, askpass and SSH settings, and credential probes used
+the caller's repository as their working directory. Supplying `GIT_DIR` reproduced
+a fixture setup failure. The recursive clone test now deliberately supplies invalid
+inherited repository/askpass paths and a conflicting SSH variant, then verifies the
+real recursive checkout with a sanitized environment and explicit fixture cwd.
+This covers environment contamination; the precise environment behind the reported
+`access_denied` failure was not captured. The synthetic broker still returns 503,
+and the SSH fixture still serves local repositories without GitHub access.
+
+## Verification and scope
+
+Both targeted suites passed (22 tests). These checks exercise local WebSockets and
+native Git, not production GitHub access or a real simulator. Related owners:
+[GitHub fallback](../architecture/2026-10-03-github-identity-fallback.md) and
+[simulator gestures](../feature/2026-10-03-ios-simulator-two-finger.md).
```

**File**: `.agents/notes/implemented/testing/2026-10-04-cli-transport-fixture-isolation.zh.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# 同步模拟器输入并隔离原生 Git 测试环境
+
+Status: implemented
+Translation: current
+
+[English](2026-10-04-cli-transport-fixture-isolation.md)
+
+## 摘要
+
+CLI 传输测试依赖 WebSocket 握手顺序和继承的 Git 状态。模拟器输入测试现在先等待上游
+ping/pong，再发送触摸；递归 Git 测试清除外部 Git/SSH 环境变量，并在执行测试的仓库之外
+运行。保留已有行为断言，不修改超时时间和生产传输逻辑。
+
+## 证据与决策
+
+模拟器服务端触发 `connection` 时，网关不一定已处理 HTTP upgrade。网关若在上游仍处于
+连接中时收到输入，会关闭流，测试则一直等待触摸转发。上游自动返回的 pong 能明确证明
+握手完成，无需 sleep 或重试。双指和底部边缘测试使用这一信号；普通触摸测试已有视频往返
+作为同步信号。
+
+原生 Git 测试原先仅过滤部分配置变量，仍继承 `GIT_DIR`、askpass 和 SSH 设置，凭据探测
+也会使用执行测试的仓库作为当前目录。传入 `GIT_DIR` 已复现测试环境准备失败。递归克隆
+测试现在主动注入无效的仓库/askpass 路径及冲突的 SSH variant，再用清理后的环境和明确的
+临时目录验证真实递归 checkout。这覆盖环境污染，但没有捕获用户报告 `access_denied`
+时的确切环境。模拟 broker 仍返回 503，SSH 替身仍只访问本地仓库，不连接 GitHub。
+
+## 验证与范围
+
+两个定向套件共 22 个测试通过。验证覆盖本地 WebSocket 和原生 Git，不代表生产 GitHub
+或真实模拟器验证。相关决策：[GitHub 回退](../architecture/2026-10-03-github-identity-fallback.zh.md)
+与[模拟器手势](../feature/2026-10-03-ios-simulator-two-finger.zh.md)。
```

**File**: `apps/cli/src/ios-simulator/gateway.test.ts` (modified, +10/-0)
```diff
@@ -8,6 +8,13 @@ import { LocalPreviewProxyManager } from '@/preview/local-preview-proxy';
 import type { SessionId } from '@lody/shared';
 import type { SimulatorHostControl } from './host-controls';
 const cleanups: Array<() => Promise<unknown>> = [];
+async function waitForGatewayHandshake(native: WebSocket) {
+  // The server's connection event precedes the gateway receiving the upgrade.
+  // Its automatic pong proves that input will see an OPEN upstream socket.
+  const pong = once(native, 'pong');
+  native.ping();
+  await pong;
+}
 afterEach(async () => {
   for (const cleanup of cleanups.reverse()) await cleanup();
   cleanups.length = 0;
@@ -371,6 +378,7 @@ describe('simulator media boundary', () => {
       });
       await once(client, 'open');
       const [native] = await incoming;
+      await waitForGatewayHandshake(native);
       const point = { x1: 10, y1: 20, x2: 80, y2: 150, width: 100, height: 200 };
       for (const type of ['touch2-down', 'touch2-move']) {
         const received = once(native, 'message');
@@ -403,6 +411,7 @@ describe('simulator media boundary', () => {
     await once(client, 'open');
     client.send(JSON.stringify({ type: 'stream-config', width: 400, height: 800, dpr: 1 }));
     const [native] = (await incoming) as [WebSocket];
+    await waitForGatewayHandshake(native);
     for (const input of [
       { type: 'touch1-down', x: 50, y: 196, width: 100, height: 200, edge: 'bottom' },
       { type: 'touch1-move', x: 50, y: 100, width: 100, height: 200, edge: 'bottom' },
@@ -434,6 +443,7 @@ describe('simulator media boundary', () => {
     await once(client, 'open');
     client.send(JSON.stringify({ type: 'stream-config', width: 400, height: 800, dpr: 1 }));
     const [native] = (await incoming) as [WebSocket];
+    await waitForGatewayHandshake(native);
     if (scenario === 'change-edge') {
       const down = once(native, 'message');
       client.send(
```

**File**: `apps/cli/src/lib/github-git-transport.test.ts` (modified, +15/-4)
```diff
@@ -13,6 +13,7 @@ beforeEach(() => {
   directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lody-native-git-'));
 });
 afterEach(() => {
+  vi.unstubAllEnvs();
   fs.rmSync(directory, { recursive: true, force: true });
 });
 function harness(
@@ -142,15 +143,20 @@ describe('native Git credential adapter', () => {
     expect(execFileSync('git', ['--git-dir', bare, 'for-each-ref'], { encoding: 'utf8' })).toBe('');
   });
   it('clones recursive native SSH submodules while cloud credentials fail', async () => {
+    // Pre-push hooks and editors export Git/SSH state. None of it belongs to
+    // these synthetic repositories or their native credential probes.
+    vi.stubEnv('GIT_DIR', path.join(directory, 'not-a-repository'));
+    vi.stubEnv('GIT_WORK_TREE', path.join(directory, 'unrelated-worktree'));
+    vi.stubEnv('GIT_ASKPASS', path.join(directory, 'unrelated-askpass'));
+    vi.stubEnv('SSH_ASKPASS', path.join(directory, 'unrelated-ssh-askpass'));
+    vi.stubEnv('GIT_SSH_VARIANT', 'plink');
     const realGit = path.join(
       execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
       'git'
     );
     const fixtureEnv = {
       ...Object.fromEntries(
-        Object.entries(process.env).filter(
-          ([key]) => !/^(GIT_CONFIG_|GIT_EXEC_PATH|LODY_GIT_)/.test(key)
-        )
+        Object.entries(process.env).filter(([key]) => !/^(GIT_|SSH_|LODY_GIT_)/.test(key))
       ),
       GIT_CONFIG_NOSYSTEM: '1',
       GIT_CONFIG_GLOBAL: '/dev/null',
@@ -160,7 +166,7 @@ describe('native Git credential adapter', () => {
       GIT_COMMITTER_EMAIL: 'fixture@example.test',
     };
     const git = (args: string[]) =>
-      execFileSync(realGit, args, { env: fixtureEnv, stdio: 'ignore' });
+      execFileSync(realGit, args, { cwd: directory, env: fixtureEnv, stdio: 'ignore' });
     const dependency = path.join(directory, 'dependency');
     const project = path.join(directory, 'project');
     git(['init', dependency]);
@@ -229,10 +235,13 @@ process.exit(child.status ?? 1);
         path.join(bin, 'git'),
         ['clone', '--recurse-submodules', 'git@github.com:org/project.git', checkout],
         {
+          // Credential probes must not discover the checkout running this test.
+          cwd: directory,
           env: {
             ...fixtureEnv,
             PATH: `${bin}:${process.env.PATH}`,
             GIT_SSH_COMMAND: `${JSON.stringify(process.execPath)} ${JSON.stringify(ssh)}`,
+            GIT_SSH_VARIANT: 'ssh',
             LODY_GIT_CRED_CONTEXT_TOKEN: 'requester',
             LODY_GIT_LOCAL_CONFIG: '{}',
             GIT_CONFIG_COUNT: '2',
@@ -249,10 +258,12 @@ process.exit(child.status ?? 1);
       );
       expect(
         execFileSync(realGit, ['-C', path.join(checkout, 'dependency'), 'rev-parse', 'HEAD'], {
+          env: fixtureEnv,
           encoding: 'utf8',
         }).trim()
       ).toBe(
         execFileSync(realGit, ['-C', dependency, 'rev-parse', 'HEAD'], {
+          env: fixtureEnv,
           encoding: 'utf8',
         }).trim()
       );
```

---

### Incident Patch 4: `5f904e29` (2026-10-04)
**Commit Message**: fix: unify subagent dialog rendering with conversation (#1243)

**File**: `.agents/notes/implemented/simplification/2026-10-04-subagent-dialog-rendering.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# Share conversation rendering in the subagent dialog
+
+Status: implemented
+Translation: current
+PR: [#1243](https://github.com/LodyAI/Lody/pull/1243)
+
+[中文](2026-10-04-subagent-dialog-rendering.zh.md)
+
+## Abstract
+
+The subagent dialog rendered tools with the parent conversation's components,
+but placed every item in a flat list, used a separate plain command brief, and
+omitted the parent file-open callback. The dialog now shares conversation activity
+grouping, command highlighting and file links while keeping its own task-scoped
+folding state. Task state, rows, dialog details and message layout have separate
+owners, with adjacent StyleX files for each visual surface. The dialog still reads
+only retained child output and adds no child execution controls.
+
+## Decision
+
+`SubagentRunMessageList` uses `buildAssistantTurnRenderBlocks`; the host supplies
+its existing Markdown, plan, tool and activity-header renderers. Keeping renderer
+injection avoids a dependency from the task panel back into the session's large
+view module. Groups initially expose all steps and preserve reader folding across
+updates. Surrounding prose remains visible, and dialog rows never register search
+blocks in the parent conversation.
+
+The background-command brief uses `ToolCommandSection` inside `ToolDetailSheet`,
+sharing the worker-backed shell highlighting introduced by the
+[tool detail decision](../feature/2026-09-26-tool-step-detail-sheet.md).
+The brief's separate vertical height cap is removed so the dialog body owns
+vertical scrolling. Task state and cancellation semantics remain those in the
+[subagent Spec](../../../../specs/subagent-events.md); the
+[earlier client-surface decision](2026-09-12-subagent-client-surface.md) continues
+to explain why unused output/list APIs are absent.
+
+The panel retains its existing import path. Task-state helpers and dialog behavior
+move into separate modules; panel, detail and message layout have adjacent
+`.stylex.ts` files. The conversation supplies spacing tokens, and UI text roles
+replace fixed detail font sizes. Storybook uses the production history renderer
+instead of displaying step titles as plain list items.
+
+Thought prose in both parent and child activity rows explicitly uses compact
+Markdown, sharing the summary/tool subheadline role and leading. The prior
+secondary-text class could not override Markdown’s inline body size, leaving
+thoughts at 14px beside 13px summaries. This corrects the typography mismatch
+without changing ordinary answer prose.
+
+## Verification
+
+The four focused suites pass 39 tests, including command-sheet rendering,
+activity folding, live-tail state, task updates, cancellation failure and mobile
+drawer portal ownership. Scoped formatting and lint pass. Browser checks exercised the production Storybook dialog on desktop and at
+390px inside the mobile drawer, including folding and one body scroller.
+Two browser regression tests verify that thought prose, the activity summary and
+tool rows all compute to 13px in light/dark themes, with 18px thought leading.
+Full component type checking still reports three dependency-version diagnostics
+in untouched Markdown/runtime modules; no diagnostics remain in changed source.
+The documentation and public-boundary checks pass after initializing the ACP
+submodules. No SHA-protected documentation topics changed. Root `pnpm check` was
+attempted but cannot complete with the worktree dependencies: the documentation
+precheck lacks `fumadocs-mdx`, and the initialized Claude ACP adapter lacks its
+Node types and `@tsconfig/node22` dependencies.
+Native Electron and physical-device touch verification were not run.
```

**File**: `.agents/notes/implemented/simplification/2026-10-04-subagent-dialog-rendering.zh.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# 子代理弹窗共享会话渲染
+
+Status: implemented
+Translation: current
+PR: [#1243](https://github.com/LodyAI/Lody/pull/1243)
+
+[English](2026-10-04-subagent-dialog-rendering.md)
+
+## 摘要
+
+子代理弹窗虽然使用父会话的工具组件，却把所有条目平铺成列表，命令简介另用
+普通文本展示，也未传入父会话的文件打开回调。现在弹窗共享会话活动分组、
+命令高亮和文件链接，同时独立保存每个任务的折叠状态。任务状态、列表行、
+弹窗详情和消息布局分别归属不同模块，各展示区域有相邻的 StyleX 文件。
+弹窗仍然只读取已保留的子代理输出，不新增子代理执行控件。
+
+## 决策
+
+`SubagentRunMessageList` 使用 `buildAssistantTurnRenderBlocks`；宿主传入
+现有的 Markdown、计划、工具与活动标题渲染器。保留渲染器注入，避免任务面板
+反向依赖会话的大型 view 模块。分组初始展示所有步骤，流式更新保留用户的折叠
+选择。分组前后的正文保持可见，弹窗行不注册父会话搜索块。
+
+后台命令简介在 `ToolDetailSheet` 中使用 `ToolCommandSection`，共享
+[工具详情决策](../feature/2026-09-26-tool-step-detail-sheet.zh.md)引入的 Worker shell
+高亮。移除简介独立的纵向高度限制，让弹窗正文统一负责纵向滚动。任务状态与
+取消语义继续遵循[子代理 Spec](../../../../specs/subagent-events.zh.md)；
+[早期客户端接口决策](2026-09-12-subagent-client-surface.zh.md)仍解释为何没有
+无使用者的输出与列表 API。
+
+面板保留原有导入路径。任务状态辅助函数与弹窗行为移至独立模块；面板、详情
+和消息布局分别使用相邻的 `.stylex.ts` 文件。会话提供间距 token，UI 文本角色
+替代详情中的固定字号。Storybook 使用生产环境的历史渲染器，替代仅展示步骤
+标题的普通列表。
+
+父会话与子代理活动行中的思考正文显式使用紧凑 Markdown，与摘要及工具行
+共享 subheadline 字号和行高。此前的次级文本类名无法覆盖 Markdown 的内联
+正文字号，导致 13px 摘要旁的思考仍为 14px。本次修正该字号不一致，普通回答
+正文保持原有阅读字号。
+
+## 验证
+
+四个相关测试套件的 39 个测试通过，覆盖命令面板渲染、活动折叠、实时尾部状态、
+任务更新、取消失败及移动端 drawer portal 归属。修改范围内的格式化与 lint
+通过。浏览器检查了生产 Storybook 弹窗的桌面展示与 390px 移动 drawer 展示，
+包括折叠与唯一正文滚动区域。两个浏览器回归测试确认浅色与深色主题中的思考
+正文、活动摘要及工具行实际均为 13px，思考行高为 18px。完整组件类型检查仍在未修改的 Markdown/runtime
+模块报告三个依赖版本诊断；修改的源文件已无诊断。初始化 ACP 子模块后，文档与公共边界检查
+通过；没有修改 SHA 保护主题。已尝试根目录 `pnpm check`，但 worktree 依赖
+不完整：文档预检查缺少 `fumadocs-mdx`，初始化后的 Claude ACP adapter 也缺少
+Node 类型与 `@tsconfig/node22` 依赖，完整检查因此未通过。
+未执行原生 Electron 或实体设备触摸验证。
```

**File**: `packages/components/src/components/ai-gui/AGENTS.md` (modified, +4/-4)
```diff
@@ -81,10 +81,10 @@ Edit `AGENTS.md`, not its `CLAUDE.md` symlink. Ownership: [README.md](README.md)
 
 ## Content Contracts
 
-- Native child cancel requires subagentCancellation v1 and an exact parent turn;
-  never use durable whole-turn Stop or invent a terminal state in the panel.
-  A `run` task also needs subagentEvents v1 and `support.cancel`. Task rows and
-  their ONE dialog: [README.md](README.md#subagent-tasks).
+- Child cancel needs subagentCancellation v1 and an exact parent turn; never
+  Stop the parent or invent terminal state. Runs also need subagentEvents v1
+  and `support.cancel`. Dialogs share turn renderers/grouping and one scroller:
+  [task rows and dialog](README.md#subagent-tasks).
 
 - Text roles use `@lody/ui`; reading prose uses `conversation.readingLeading`.
   Compact prose/code use subheadline, never nested `em`. Message sizes use
```

**File**: `packages/components/src/components/ai-gui/README.md` (modified, +16/-3)
```diff
@@ -75,6 +75,8 @@ palette. `surface.ts` owns shared row and bubble styles; the Markdown renderer a
 code block own their element styles. A host can apply `createTheme(conversation, …)`
 to a subtree to change these values without descendant utility overrides.
 
+Activity thought prose uses compact Markdown at the same subheadline size and
+leading as its summary and tool rows, in the parent conversation and task dialog.
 Reading prose and user text use `readingLeading`, derived from the body role
 at 1.1 times its leading (22px at 14px). Compact tool prose and code retain their
 control leading. Explicit previews scale the reading token with their own size.
@@ -175,9 +177,20 @@ second line with its latest step, taken from the last `run.items` entry, then
 `run.progress`, then the legacy `summary`/`lastToolName`, so older tasks keep
 working. A row opens the panel's ONE dialog by task id (not a snapshot), so a
 streaming run keeps updating inside it and the view follows the end only while
-the reader is there. The dialog renders `run.items` through `view.tsx`'s turn
-renderers (`SubagentRunHistory`) and never passes a `searchBlockId`: search
-indexes the conversation, not a dialog.
+the reader is there. `subagent-run-history.tsx` groups `run.items` with the conversation's
+`buildAssistantTurnRenderBlocks`; `view.tsx` supplies the same activity headers,
+Markdown, plans and tool detail renderers used by the parent turn. Activity groups
+start open and can be folded without hiding the surrounding prose; their state
+survives streamed updates. File links use the parent session's file-open callback.
+No `searchBlockId` is passed: search indexes the conversation, not a dialog.
+
+`subagent-task-state.tsx` owns task aggregation and display-state helpers;
+`subagent-task-panel.tsx` owns rows and the selected task;
+`subagent-task-detail.tsx` owns the dialog body and cancellation. Panel, detail and
+run-history styles each live in their adjacent `.stylex.ts` file and use shared
+conversation spacing and UI text tokens. Background command briefs use the same
+`ToolCommandSection` and `ToolDetailSheet` as tool steps, including shell highlighting
+and conversation font sizing. The brief and activity share one vertical scroller.
 
 State comes from `run.snapshot.state` when present; the legacy `status` cannot
 say cancelled or unknown. `unknown` means Lody lost sight of the run, so the
```

**File**: `packages/components/src/components/ai-gui/subagent-run-history.stylex.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import * as stylex from '@stylexjs/stylex';
+import { conversation } from './conversation.tokens.stylex';
+
+export const styles = stylex.create({
+  list: { display: 'flex', flexDirection: 'column', minWidth: 0 },
+  row: { minWidth: 0 },
+  prose: { paddingTop: conversation.proseGap },
+  surface: { paddingTop: conversation.surfaceGap },
+  first: { paddingTop: 0 },
+  thoughtLabel: {
+    position: 'absolute',
+    width: '1px',
+    height: '1px',
+    padding: 0,
+    overflow: 'hidden',
+    clipPath: 'inset(50%)',
+    whiteSpace: 'nowrap',
+  },
+});
```

**File**: `packages/components/src/components/ai-gui/subagent-run-history.tsx` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+import { Fragment, useMemo, useState, type ReactNode } from 'react';
+import * as stylex from '@stylexjs/stylex';
+import {
+  buildAssistantTurnRenderBlocks,
+  type AssistantActivitySummary,
+} from './assistant-turn-render-blocks';
+import type { SubagentTask } from './subagent-task-state';
+import { styles } from './subagent-run-history.stylex';
+
+type RunItem = NonNullable<SubagentTask['run']>['items'][number];
+
+export type SubagentActivityHeaderProps = {
+  id: string;
+  summary: AssistantActivitySummary;
+  expanded: boolean;
+  onExpandedChange: (expanded: boolean) => void;
+};
+
+/** The host supplies its conversation renderers; dialog rows never enter conversation search. */
+export function SubagentRunMessageList({
+  task,
+  renderItem,
+  renderActivityHeader,
+}: {
+  task: SubagentTask;
+  renderItem: (item: RunItem, streaming: boolean) => ReactNode;
+  renderActivityHeader: (props: SubagentActivityHeaderProps) => ReactNode;
+}) {
+  const items = task.run?.items;
+  const blocks = useMemo(
+    () => buildAssistantTurnRenderBlocks(`subagent:${task.taskId}`, items ?? []),
+    [items, task.taskId]
+  );
+  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
+  const live = task.run?.snapshot.state === 'running' || task.run?.snapshot.state === 'pending';
+  const renderEntry = (item: RunItem, index: number) =>
+    renderItem(item, live && index === (items?.length ?? 0) - 1);
+
+  return (
+    <div {...stylex.props(styles.list)}>
+      {blocks.map((block, blockIndex) => {
+        if (block.kind === 'activity_group') {
+          const expanded = expandedGroups[block.key] ?? true;
+          return (
+            <Fragment key={block.key}>
+              {renderActivityHeader({
+                id: block.key,
+                summary: block.summary,
+                expanded,
+                onExpandedChange: (next) =>
+                  setExpandedGroups((current) => ({ ...current, [block.key]: next })),
+              })}
+              {expanded
+                ? block.entries.map((entry) => (
+                    <div
+                      key={
+                        entry.content.type === 'tool_call'
+                          ? `tool:${entry.content.toolCallId}`
+                          : `thought:${entry.itemIndex}`
+                      }
+                      {...stylex.props(styles.row)}
+                    >
+                      {renderEntry(entry.content, entry.itemIndex)}
+                    </div>
+                  ))
+                : null}
+            </Fragment>
+          );
+        }
+        const item = block.entry.content;
+        // Run transcripts retain only these four variants; tools with process
+        // status and plan-mode kinds remain standalone content in the shared layout.
+        if (
+          item.type !== 'text' &&
+          item.type !== 'thought' &&
+          item.type !== 'tool_call' &&
+          item.type !== 'plan'
+        )
+          return null;
+        return (
+          <div
+            key={block.key}
+            {...stylex.props(
+              styles.row,
+              item.type === 'text' ? styles.prose : styles.surface,
+              blockIndex === 0 && styles.first
+            )}
+          >
+            {renderEntry(item, block.entry.itemIndex)}
+          </div>
+        );
+      })}
+    </div>
+  );
+}
```

**File**: `packages/components/src/components/ai-gui/subagent-task-detail.stylex.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import * as stylex from '@stylexjs/stylex';
+import { colors } from '@lody/ui/tokens/colors.stylex';
+import { corner, radius, space, text } from '@lody/ui/tokens/scales.stylex';
+import { conversation } from './conversation.tokens.stylex';
+
+const REGION = `color-mix(in oklab, transparent, ${colors.label} 5%)`;
+
+export const dialogLayout = { width: '800px', maxHeight: 'min(760px, 85dvh)' };
+
+export const styles = stylex.create({
+  /** The task at full depth; everything under the heading scrolls as one column. */
+  detail: {
+    display: 'flex',
+    flexDirection: 'column',
+    gap: conversation.surfaceGap,
+    minHeight: 0,
+    overflowY: 'auto',
+    overscrollBehavior: 'contain',
+    // Focusable only so the dialog can land here; the panel's own shadow says
+    // where focus is, as it does for the modal itself.
+    outlineStyle: 'none',
+  },
+  bodyWrap: { position: 'relative', minWidth: 0 },
+  commandBrief: { paddingInlineEnd: space[8] },
+  danger: { color: colors.destructive },
+  body: {
+    margin: 0,
+    paddingBlock: space[2],
+    paddingInlineStart: space[3],
+    // Room for the copy button in the corner.
+    paddingInlineEnd: '36px',
+    backgroundColor: REGION,
+    borderRadius: radius.medium,
+    cornerShape: corner.shape,
+    fontSize: text.bodySize,
+    lineHeight: conversation.readingLeading,
+    whiteSpace: 'pre-wrap',
+    overflowWrap: 'anywhere',
+    color: colors.label,
+  },
+  copy: { position: 'absolute', insetBlockStart: '4px', insetInlineEnd: '4px' },
+  section: { display: 'flex', flexDirection: 'column', gap: space[1], minWidth: 0 },
+  sectionLabel: { margin: 0, fontSize: text.captionSize, color: colors.tertiaryLabel },
+  sectionText: {
+    margin: 0,
+    fontSize: text.subheadlineSize,
+    lineHeight: text.subheadlineLeading,
+    whiteSpace: 'pre-wrap',
+    overflowWrap: 'anywhere',
+    color: colors.label,
+  },
+  note: {
+    margin: 0,
+    fontSize: text.subheadlineSize,
+    lineHeight: text.subheadlineLeading,
+    color: colors.secondaryLabel,
+  },
+  actionsError: { flexGrow: 1, alignSelf: 'center' },
+  /** Covers the dialog's backdrop inside a drawer, so a drag there is not Vaul's. */
+  backdropNoDrag: { position: 'absolute', inset: 0 },
+});
```

**File**: `packages/components/src/components/ai-gui/subagent-task-detail.tsx` (added, +325/-0)
```diff
@@ -0,0 +1,325 @@
+import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
+import { useTranslation } from 'react-i18next';
+import * as stylex from '@stylexjs/stylex';
+import { Check, Copy } from 'lucide-react';
+import { Spinner } from '@lody/ui/spinner';
+import { Button } from '@lody/ui/button';
+import { Dialog } from '@/ui/dialog';
+import { DEFAULT_CONVERSATION_FONT_SIZE, type ConversationFontSize } from '@/atoms/settings';
+import { formatDurationCompact, getDurationUnitLabels } from '@/lib/format-duration';
+import { writeTextToClipboard } from '@/lib/clipboard';
+import { withClassName } from '@/lib/stylex';
+import { styles } from './subagent-task-detail.stylex';
+import { styles as panelStyles } from './subagent-task-panel.stylex';
+import {
+  actorOf,
+  durationOf,
+  isRunning,
+  latestActionOf,
+  LiveElapsed,
+  meaningfulSummaryOf,
+  stateLabel,
+  stateOf,
+  useUsageLabel,
+  type SubagentTask,
+} from './subagent-task-state';
+import { ToolCommandSection, ToolDetailSheet } from './tool-call-detail';
+
+const SCROLLBAR = 'scrollbar-pro';
+const FOLLOW_SLACK_PX = 24;
+
+/** The brief, whole, with one-tap copy. A background command reads as code. */
+function TaskBrief({
+  task,
+  body,
+  fontSize,
+}: {
+  task: SubagentTask;
+  body: string;
+  fontSize: ConversationFontSize;
+}) {
+  const { t } = useTranslation();
+  const [copied, setCopied] = useState(false);
+  const isCommand = task.taskType === 'local_bash';
+  return (
+    <div {...stylex.props(styles.bodyWrap)}>
+      <div
+        aria-label={
+          isCommand
+            ? t('sessions.subagentTasks.command', 'Command')
+            : t('sessions.subagentTasks.description', 'Description')
+        }
+        {...stylex.props(!isCommand && styles.body)}
+      >
+        {isCommand ? (
+          <ToolDetailSheet>
+            <div {...stylex.props(styles.commandBrief)}>
+              <ToolCommandSection
+                command={body}
+                shell
+                running={isRunning(task)}
+                fontSize={fontSize}
+              />
+            </div>
+          </ToolDetailSheet>
+        ) : (
+          body
+        )}
+      </div>
+      <span {...stylex.props(styles.copy)}>
+        <Button
+          type="button"
+          variant="ghost"
+          size="mini"
+          icon
+          aria-label={copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
+          onClick={() => {
+            void writeTextToClipboard(body).then((ok) => {
+              if (ok) setCopied(true);
+            });
+          }}
+        >
+          {copied ? (
+            <Check {...stylex.props(panelStyles.glyph)} />
+          ) : (
+            <Copy {...stylex.props(panelStyles.glyph)} />
+          )}
+        </Button>
+      </span>
+    </div>
+  );
+}
+
+function Section({ label, children }: { label: string; children: ReactNode }) {
+  return (
+    <section aria-label={label} {...stylex.props(styles.section)}>
+      <p aria-hidden="true" {...stylex.props(styles.sectionLabel)}>
+        {label}
+      </p>
+      {children}
+    </section>
+  );
+}
+
+/**
+ * The run's own steps, or why there are none. A provider that streams nothing
+ * is said to, so a quiet run never reads as a broken stream; a run that lost
+ * steps on the way says so under whatever did arrive.
+ */
+function TaskActivity({
+  task,
+  renderHistory,
+}: {
+  task: SubagentTask;
+  renderHistory?: (task: SubagentTask) => ReactNode;
+}) {
+  const { t } = useTranslation();
+  const run = task.run;
+  if (!run) return null;
+  const hasSteps = run.items.length > 0;
+  const streams = run.snapshot.support.stream.length > 0;
+  const emptyNote = hasSteps
+    ? null
+    : !streams
+      ? t(
+          'sessions.subagentTasks.activityNotStreamed',
+          'This agent reports its status and result, not its individual steps.'
+        )
+      : isRunning(task)
+        ? t('sessions.subagentTasks.activityWaiting', 'Waiting for the first step…')
+        : t('sessions.subagentTasks.activityNone', 'No steps were received.');
+  return (
+    <Section label={t('sessions.subagentTasks.activity', 'Activity')}>
+      {hasSteps && renderHistory ? (
+        <div data-subagent-run-history="" {...stylex.props(styles.section)}>
+          {renderHistory(task)}
+        </div>
+      ) : null}
+      {emptyNote ? <p {...stylex.props(styles.note)}>{emptyNote}</p> : null}
+      {run.snapshot.outputIncomplete ? (
+        <p {...stylex.props(styles.note)}>
+          {t(
+            'sessions.subagentTasks.activityIncomplete',
+            'Some steps of this run were not received.'
+          )}
+        </p>
+      ) : null}
+    </Section>
+  );
+}
+
+function CancelTaskAction({
+  task,
+  onCancel,
+}: {
+  task: SubagentTask;
+  onCancel: (taskId: string) => Promise<void>;
+}) {
+  const { t } = useTranslation();
+  const [cancelling, setCancelling] = useState(false);
+  const
```

---

### Incident Patch 5: `4ccb2fe7` (2026-10-04)
**Commit Message**: fix: keep mobile diff inside the session modal scope (#1222)

**File**: `.agents/docs/sessions-file-surfaces.md` (modified, +5/-0)
```diff
@@ -23,6 +23,11 @@ this page is the full text of the rules summarised there.
   conversation/turn diff without a file focus keeps its all-files-open default.
   On mobile, the diff-header action closes the diff sheet before opening the
   file drawer so the diff modal cannot cover the destination viewer.
+  `SessionMobileDiffDrawerContent` explicitly portals the diff into the nearest
+  session drawer's popup host. The legacy Vaul/Radix modal locks pointer events
+  on the body; a Base UI drawer portalled there can pass scrolling through to
+  the conversation. Keep this choice local to the mobile diff rather than changing
+  the default container of every modal.
 - Editor window (Monaco): `session-monaco-text-viewer.tsx` inside
   `session-file-content-view.tsx`.
 - **What a client may DO with a session file is one model, `hooks/use-session-file-actions.ts`,
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-03-mobile-diff-portal-scope.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# Keep the mobile diff inside the session drawer's modal scope
+
+Status: implemented
+Date: 2026-10-03
+Translation: current
+
+[中文](2026-10-03-mobile-diff-portal-scope.zh.md)
+
+## Abstract
+
+The mobile diff uses a Base UI drawer inside a legacy Vaul/Radix session drawer. Portalling the diff to the body lets it inherit the outer modal's pointer lock, so scrolling over the visible diff can move the conversation underneath. The mobile diff content now explicitly uses the enclosing drawer's boxless popup host. This preserves the modal scope without changing global modal positioning; Android touch behavior and the full file-viewer flow still need device validation.
+
+## Decision and evidence
+
+The UI migration replaced the mobile diff sheet with `@lody/ui`'s drawer. Its default container is the body, while the session's Vaul/Radix drawer sets body pointer events to `none` and its own content to `auto`. The existing `DrawerContent` popup host is inside that content and outside scrolling children.
+
+`SessionMobileDiffDrawerContent` reads `usePopupContainer` and passes it explicitly to `Drawer.Content`. The existing root, close handling, diff data, and file handoff remain unchanged. A surface without an enclosing provider retains the primitive's body default. Changing every modal's default container was rejected because transformed ancestor panels can change fixed modal positioning.
+
+A synthetic fixture using Vaul 1.1.2 and Base UI 1.7.0 was exercised with Computer Use in Lody's built-in browser. A one-page scroll over a body-portalled diff moved background chat from 0 to 641 px and left the diff at 0. With the portal inside the outer drawer, the same scroll moved the diff from 0 to 641 px while the background stayed at 641 px; reversing it moved only the diff. This is component-combination evidence, not a full Android release reproduction.
+
+The separate [mobile diff file handoff](2026-09-28-mobile-diff-file-handoff.md) remains necessary: opening a source file still closes the diff first. Implementation context: [session file surfaces](../../../docs/sessions-file-surfaces.md).
+
+## Verification
+
+The existing drawer suite adds the real mobile diff content inside the real session drawer, covering initially open and click-open states. It checks modal containment, effective pointer events, focus retention, line selection, and closing only the inner drawer. JSDOM does not verify native scroll hit testing; browser and Android validation remain distinct checks.
+
+The drawer, mobile file viewer, file content view, and conversation diff data suites pass (61 tests). Removing the explicit container makes both new regression cases fail; restoring it passes. Components typechecking, changed-file lint/format, root `pnpm format`, and the platform boundary guard pass. Root `pnpm check` stops at CLI typechecking because the Claude, Codex, Grok, and Devin ACP submodules are uninitialized. The public boundary and docs checks also report these missing submodules; no docs errors reference the changed files.
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-03-mobile-diff-portal-scope.zh.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# 将移动端 diff 保持在会话抽屉的模态作用域内
+
+Status: implemented
+Date: 2026-10-03
+Translation: current
+
+[English](2026-10-03-mobile-diff-portal-scope.md)
+
+## 摘要
+
+移动端 diff 使用 Base UI 抽屉，外层会话仍使用 Vaul/Radix 抽屉。diff 的 Portal 挂到 body 后会继承外层模态的指针锁定，因此在可见 diff 上滚动可能移动下方会话。移动端 diff 内容现在显式使用外层抽屉提供的无布局盒弹层宿主。这保留了模态作用域且不改变全局弹窗定位；Android 触摸行为和完整文件查看流程仍需设备验证。
+
+## 决策与证据
+
+UI 迁移将移动端 diff 面板替换为 `@lody/ui` 抽屉。其默认容器是 body，而会话的 Vaul/Radix 抽屉将 body 的 pointer events 设为 `none`，自身内容设为 `auto`。现有 `DrawerContent` 弹层宿主位于该内容内部、滚动子元素外部。
+
+`SessionMobileDiffDrawerContent` 读取 `usePopupContainer` 并显式传给 `Drawer.Content`。现有根组件、关闭处理、diff 数据和文件切换流程保持原样。没有外层 provider 的界面仍使用基础组件的 body 默认值。未改变所有模态的默认容器，因为带 transform 的祖先面板可能改变 fixed 弹窗定位。
+
+使用 Vaul 1.1.2 和 Base UI 1.7.0 的合成测试页已通过 Computer Use 在 Lody 内置浏览器中验证。在 body Portal 的 diff 上滚动一页，背景聊天从 0 移动到 641 px，diff 保持 0。Portal 位于外层抽屉内时，同样操作使 diff 从 0 移动到 641 px，背景保持 641 px；反向滚动也只移动 diff。这是组件组合证据，不代表完整 Android Release 已复现。
+
+独立的[移动端 diff 文件切换修复](2026-09-28-mobile-diff-file-handoff.zh.md)仍有必要：打开源文件仍先关闭 diff。实现说明：[会话文件界面](../../../docs/sessions-file-surfaces.md)。
+
+## 验证
+
+现有抽屉测试套件将真实移动端 diff 内容放入真实会话抽屉，覆盖初始打开和点击后打开。测试检查模态包含关系、有效 pointer events、焦点保持、行选择以及仅关闭内层抽屉。JSDOM 不验证原生滚动命中测试；浏览器和 Android 验证仍是独立检查。
+
+抽屉、移动端文件查看器、文件内容界面和会话 diff 数据套件的 61 项测试通过。去掉显式容器会使新增的两个回归案例失败，恢复后通过。共享组件类型检查、修改文件的 lint/format、根目录 `pnpm format` 和平台边界检查通过。根目录 `pnpm check` 在 CLI 类型检查阶段因 Claude、Codex、Grok、Devin ACP 子模块未初始化而停止。公共边界和文档检查也报告这些缺失子模块；没有文档错误涉及修改文件。
```

**File**: `packages/components/src/components/sessions/session-detail.tsx` (modified, +3/-2)
```diff
@@ -201,6 +201,7 @@ import { SessionSyncingIndicator } from './session-syncing-indicator';
 // Aliased while the vaul drawer below still holds the bare name; the two
 // merge when the mobile drawers migrate onto this primitive.
 import { Drawer as UiDrawer } from '@lody/ui/drawer';
+import { SessionMobileDiffDrawerContent } from './session-mobile-diff-drawer-content';
 import { Drawer, DrawerContent, DrawerTitle } from '@/ui/drawer';
 import { VaulDrawerBody } from '@/components/mobile/vaul-drawer-edge-back-zone';
 import { Dialog } from '@/ui/dialog';
@@ -5889,7 +5890,7 @@ const SessionDetail = ({
           open={mobileDiffState !== null}
           onOpenChange={(open) => !open && handleCloseMobileDiff()}
         >
-          <UiDrawer.Content side="bottom" className="h-[85vh] flex flex-col p-0">
+          <SessionMobileDiffDrawerContent side="bottom" className="h-[85vh] flex flex-col p-0">
             <UiDrawer.Header className="shrink-0 border-b border-border px-4 py-3">
               <UiDrawer.Title className="text-sm font-medium">
                 {t('sessions.diffTab', 'Changes')}
@@ -5939,7 +5940,7 @@ const SessionDetail = ({
                 />
               )}
             </div>
-          </UiDrawer.Content>
+          </SessionMobileDiffDrawerContent>
         </UiDrawer.Root>
         {viewerTabs
           .filter((tab): tab is Extract<ViewerTab, { type: 'file' }> => tab.type === 'file')
```

**File**: `packages/components/src/components/sessions/session-mobile-diff-drawer-content.tsx` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+import { Drawer, type DrawerContentProps } from '@lody/ui/drawer';
+import { usePopupContainer } from '@lody/ui/popup-container';
+
+/** Keep the mobile diff in the enclosing session drawer's pointer and focus scope. */
+export function SessionMobileDiffDrawerContent(props: Omit<DrawerContentProps, 'container'>) {
+  const container = usePopupContainer();
+  // A body portal inherits Vaul/Radix's pointer-events:none and lets gestures
+  // reach the conversation beneath it. The host lives outside scrolling content.
+  return <Drawer.Content {...props} container={container} />;
+}
```

**File**: `packages/components/tests/drawer-keyboard-viewport.test.tsx` (modified, +50/-0)
```diff
@@ -2,9 +2,11 @@
 
 import { act, useState } from 'react';
 import { Menu } from '@lody/ui/menu';
+import { Drawer as UiDrawer } from '@lody/ui/drawer';
 import { createRoot, type Root } from 'react-dom/client';
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { Drawer, DrawerContent, DrawerTitle } from '../src/ui/drawer';
+import { SessionMobileDiffDrawerContent } from '../src/components/sessions/session-mobile-diff-drawer-content';
 
 const runtime = vi.hoisted(() => ({ native: true, ios: false }));
 vi.mock('../src/lib/native-platform', () => ({
@@ -171,6 +173,54 @@ function DrawerMenu({ initiallyOpen }: { initiallyOpen: boolean }) {
 }
 
 describe('drawer floating controls', () => {
+  it.each([false, true])(
+    'keeps the mobile diff in the session modal scope (initially open: %s)',
+    async (initiallyOpen) => {
+      function SessionDiff() {
+        const [open, setOpen] = useState(initiallyOpen);
+        const [selection, setSelection] = useState('Unchanged');
+        return (
+          <Drawer direction="right" open repositionInputs={false}>
+            <DrawerContent aria-describedby={undefined}>
+              <DrawerTitle>Conversation</DrawerTitle>
+              <button onClick={() => setOpen(true)}>Open changes</button>
+              <output>{selection}</output>
+              <UiDrawer.Root side="bottom" open={open} onOpenChange={setOpen}>
+                <SessionMobileDiffDrawerContent side="bottom" aria-describedby={undefined}>
+                  <UiDrawer.Title>Changes</UiDrawer.Title>
+                  <button onClick={() => setSelection('Selected line')}>Select line</button>
+                </SessionMobileDiffDrawerContent>
+              </UiDrawer.Root>
+            </DrawerContent>
+          </Drawer>
+        );
+      }
+      await act(async () => root.render(<SessionDiff />));
+      const drawer = document.querySelector<HTMLElement>('[data-slot="drawer-content"]')!;
+      if (!initiallyOpen) {
+        await act(async () => drawer.querySelector<HTMLButtonElement>('button')!.click());
+      }
+      const diff = drawer.querySelector<HTMLElement>('[data-side="bottom"]');
+      expect(diff).not.toBeNull();
+      expect(diff!.closest('[data-vaul-no-drag]')).not.toBeNull();
+      expect(getComputedStyle(document.body).pointerEvents).toBe('none');
+      expect(getComputedStyle(diff!).pointerEvents).not.toBe('none');
+      const select = diff!.querySelector<HTMLButtonElement>('button:not([aria-label])')!;
+      await act(async () => {
+        select.focus();
+        await vi.advanceTimersByTimeAsync(32);
+      });
+      expect(document.activeElement).toBe(select);
+      await act(async () => select.click());
+      expect(drawer.querySelector('output')?.textContent).toBe('Selected line');
+      await act(async () =>
+        diff!.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click()
+      );
+      expect(drawer.querySelector('[data-side="bottom"]')).toBeNull();
+      expect(drawer.getAttribute('data-state')).toBe('open');
+    }
+  );
+
   it.each([false, true])(
     'keeps a menu interactive in the modal scope (initially open: %s)',
     async (initiallyOpen) => {
```

---

### Incident Patch 6: `8872177b` (2026-10-04)
**Commit Message**: fix: lint

**File**: `packages/components/src/components/chat/unified-project-selector.tsx` (modified, +2/-2)
```diff
@@ -605,8 +605,8 @@ export function UnifiedProjectSelectorView({
             {filteredOptions.length > 0 ? (
               <Menu.RadioGroup
                 value={selectedValue ?? ''}
-                onValueChange={(value) => {
-                  const target = filteredOptions.find((option) => option.value === value);
+                onValueChange={(nextValue) => {
+                  const target = filteredOptions.find((option) => option.value === nextValue);
                   if (target) onChange(target.selection);
                 }}
               >
```

**File**: `packages/components/src/components/mobile/mobile-account-settings.tsx` (modified, +3/-3)
```diff
@@ -557,9 +557,9 @@ export function MobileAccountSettings({
                       <Menu.Content align="end">
                         <Menu.RadioGroup
                           value={member.role}
-                          onValueChange={(role) => {
-                            if (role === 'member' || role === 'admin') {
-                              void onUpdateRole(member, role);
+                          onValueChange={(nextRole) => {
+                            if (nextRole === 'member' || nextRole === 'admin') {
+                              void onUpdateRole(member, nextRole);
                             }
                           }}
                         >
```

---

### Incident Patch 7: `3963a1d4` (2026-10-04)
**Commit Message**: fix: unify sidebar footer control sizes and spacing (#1239)

* fix: unify sidebar footer control sizes and spacing

Model: gpt-6.1-sol

* docs: link sidebar footer decision to PR

Model: gpt-6.1-sol

**File**: `.agents/notes/implemented/feature/2026-10-04-sidebar-footer-density.md` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+# Compact sidebar footer controls
+
+Status: implemented
+Translation: current
+
+[中文](2026-10-04-sidebar-footer-density.zh.md)
+
+PR: [#1239](https://github.com/LodyAI/Lody/pull/1239)
+
+## Abstract
+
+The desktop workspace trigger was 32px high beside 24px action buttons, making
+its hover area appear disproportionately tall. All four controls now share the
+UI primitive's 28px small size, while avatars remain 20px and action glyphs are
+16px. Mobile retains 48px touch targets. Browser measurements and screenshots
+cover the component scene; full application verification remains limited by
+the checkout's existing dependency and type errors.
+
+## Decision
+
+[LoroSidebar](../../../../packages/components/src/components/loro-sidebar.tsx)
+owns the footer composition. Desktop controls use ghost Buttons; their size,
+hover and focus come from the primitive. The static local identity uses the
+same height without becoming a button. A flex wrapper prevents the inline
+button's baseline line box from adding extra height. The active Archive action
+uses a separate selection surface and `aria-current`, keeping its button's
+visual contract intact. Mobile glyphs have their own 20px holder inside 48px
+targets rather than overflowing the primitive's 16px glyph holder.
+
+Every adjacent pair of desktop controls has a 4px gap, including workspace
+and Help. Browser coverage measures all three gaps. At the same sidebar width,
+the actions and their workspace gap occupy
+8px more horizontal space than the original footer, so long names can still
+truncate. Making every control 32px would retain the bulky footer;
+reducing every control to 24px would leave only 2px around the workspace avatar.
+The shared small size balances density and pointer targets.
+
+This supplements the [action-order decision](2026-09-26-sidebar-footer.md) and
+replaces only the active-footer treatment in the
+[reading-contrast decision](2026-09-24-reading-contrast.md).
+Intent lives in the [footer Spec](../../../../specs/sidebar-footer.md), which
+remains a draft.
+
+## Verification and limits
+
+The existing sidebar and workspace-identity suites cover selection, syncing,
+static identity and footer destinations; all 24 tests pass. Both Playwright
+footer checks pass. Browser coverage belongs in the
+existing sidebar layout suite, using the
+[footer stories](../../../../packages/components/src/stories/SidebarFooter.stories.tsx)
+for light/dark palettes, long names, syncing and static identity at interface
+font sizes 12, 14 and 18. Mobile coverage checks real touch targets and menus.
+Playwright captures before and after from the same dark story, viewport,
+device scale and workspace hover state; generated images stay ignored under
+`artifacts/sidebar-footer/`.
+
+The before controls measured 32px and 24px, with a 41px footer. After controls
+measure 28px with a 37px footer, including Chromium's rounded separator width.
+Scoped lint and root `pnpm format` pass. Documentation checks add no errors to the
+existing baseline. Full `pnpm check` stops on the missing `fumadocs-mdx` tool;
+component type checks encounter unrelated document-preview dependencies and existing
+Markdown/runtime type errors. No Electron application launch or human Spec
+approval is claimed.
```

**File**: `.agents/notes/implemented/feature/2026-10-04-sidebar-footer-density.zh.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# 紧凑的侧边栏底部控件
+
+Status: implemented
+Translation: current
+
+[English](2026-10-04-sidebar-footer-density.md)
+
+PR: [#1239](https://github.com/LodyAI/Lody/pull/1239)
+
+## 摘要
+
+桌面 workspace 入口原来高 32px，旁边的操作按钮只有 24px，导致悬停区域显得过厚。
+四个控件现在统一使用 UI primitive 的 28px small 尺寸，头像保持 20px，操作图标为
+16px。移动端保留 48px 点击区域。浏览器测量与截图覆盖组件场景；完整应用验证仍受
+当前 checkout 的既有依赖缺失与类型错误限制。
+
+## 决策
+
+[LoroSidebar](../../../../packages/components/src/components/loro-sidebar.tsx)
+负责底栏组合。桌面控件使用 ghost Button，尺寸、悬停与焦点由 primitive 提供。
+本地静态身份使用相同行高，但不变成按钮。外层使用 flex，避免 inline 按钮的基线
+行盒额外撑高底栏。当前归档入口使用独立选中背景与 `aria-current`，保留按钮自身
+的视觉契约。移动端在 48px 点击区域内提供 20px 图标容器，避免图标溢出 primitive
+的 16px 图标容器。
+
+桌面端所有相邻控件之间统一留 4px，包括 workspace 与帮助按钮。
+浏览器覆盖测量全部三个间隔。
+在相同侧栏宽度下，操作组及其与 workspace 的间距比原始底栏合计多占 8px，
+长名称仍可省略。全部设为 32px 会保留底栏的厚重感；全部缩为 24px 则只给 workspace
+头像留下上下各 2px。共享的 small 尺寸兼顾紧凑度与鼠标点击区域。
+
+本决策补充[入口顺序决策](2026-09-26-sidebar-footer.zh.md)，仅替换
+[阅读对比度决策](2026-09-24-reading-contrast.zh.md)中的底栏选中样式。
+产品意图由仍为 draft 的[底栏 Spec](../../../../specs/sidebar-footer.zh.md)维护。
+
+## 验证与限制
+
+现有侧栏和 workspace 身份测试覆盖选择、同步状态、静态身份与底栏入口，24 项全部
+通过；两项 Playwright 底栏检查也通过。
+浏览器覆盖放在现有侧栏布局测试中，使用
+[底栏 stories](../../../../packages/components/src/stories/SidebarFooter.stories.tsx)
+检查明暗主题、长名称、同步与静态身份，并覆盖界面字号 12、14、18。
+移动端覆盖真实点击尺寸与菜单操作。Playwright 在相同暗色场景、视口、设备缩放
+和 workspace 悬停状态下截取修改前后图片；生成图片放在已忽略的
+`artifacts/sidebar-footer/` 中。
+
+修改前控件为 32px 与 24px，底栏实测 41px。修改后控件均为 28px，底栏实测 37px，
+包括 Chromium 对分隔线宽度的取整。局部 lint 与根目录 `pnpm format` 通过，文档检查没有新增
+基线之外的错误。完整 `pnpm check` 因缺失 `fumadocs-mdx` 工具而停止；组件类型检查
+遇到无关的文档预览依赖缺失，以及既有 Markdown 和运行时类型错误。
+本次不声称已启动 Electron 应用或取得
+Spec 的人工审批。
```

**File**: `packages/components/src/components/README.md` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ and [display preference](../../../../.agents/notes/implemented/feature/2026-09-2
 
 - Sidebar footer: Help (`?`), Archive, Settings, in that order. Help retains the
   documentation, GitHub repository, community, GitHub Issues feedback, and bug-report menu; Archive is a direct
-  button and becomes the return action while open. See the
+  button and becomes the return action while open. Desktop controls share the UI
+  primitive's small size; mobile actions retain their touch targets. See the
   [footer Spec](../../../../specs/sidebar-footer.md).
 
 - [Zen layout](../../../../specs/zen-layout.md): `AppCommands` dispatches the shared
```

**File**: `packages/components/src/components/loro-sidebar.tsx` (modified, +111/-38)
```diff
@@ -28,6 +28,9 @@ import {
 import { useElectronFullscreen } from '@/lib/electron';
 import { Badge } from '@lody/ui/badge';
 import { Button } from '@lody/ui/button';
+import * as stylex from '@stylexjs/stylex';
+import { colors } from '@lody/ui/tokens/colors.stylex';
+import { control, radius, space, text } from '@lody/ui/tokens/scales.stylex';
 import { Kbd } from '@lody/ui/kbd';
 import { Tooltip } from '@lody/ui/tooltip';
 import { commands, formatKeyBinding, type ShortcutCommandId } from '@/lib/commands';
@@ -299,6 +302,40 @@ export interface LoroSidebarProps {
  */
 const COLLAPSE_DRAG_THRESHOLD = 160;
 
+const footerStyles = stylex.create({
+  desktop: { columnGap: space[1] },
+  workspaceControl: {
+    width: '100%',
+    minWidth: 0,
+    justifyContent: 'flex-start',
+    gap: space[2],
+    textAlign: 'start',
+  },
+  workspaceNameplate: {
+    display: 'flex',
+    alignItems: 'center',
+    height: control.small,
+    paddingInline: space[2],
+    boxSizing: 'border-box',
+    fontSize: text.subheadlineSize,
+    lineHeight: 1,
+    color: colors.secondaryLabel,
+    userSelect: 'none',
+  },
+  actions: {
+    display: 'flex',
+    alignItems: 'center',
+    flexShrink: 0,
+    gap: space[1],
+  },
+  selectedAction: {
+    display: 'inline-flex',
+    backgroundColor: colors.selectedFill,
+    borderRadius: radius.small,
+  },
+  selectedMobileAction: { borderRadius: radius.large },
+});
+
 const defaultLabels: LoroSidebarLabels = {
   home: 'Home',
   schedules: 'Schedules',
@@ -493,19 +530,35 @@ const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconB
   ref
 ) {
   const isMobile = useIsMobile();
-  return (
+  const button = (
     <Button
       ref={ref}
       type="button"
       variant="ghost"
-      icon
-      className={cn(getLoroSidebarFooterIconButtonClassName(isMobile, active), className)}
+      size="small"
+      icon={!isMobile}
+      aria-label={label}
+      aria-current={active ? 'page' : undefined}
+      className={cn(isMobile && 'h-12 w-12', className)}
       {...buttonProps}
     >
-      {children}
+      {isMobile ? (
+        <span className="flex size-5 items-center justify-center">{children}</span>
+      ) : (
+        children
+      )}
       <span className="sr-only">{label}</span>
     </Button>
   );
+  return active ? (
+    <span
+      {...stylex.props(footerStyles.selectedAction, isMobile && footerStyles.selectedMobileAction)}
+    >
+      {button}
+    </span>
+  ) : (
+    button
+  );
 });
 
 /**
@@ -708,20 +761,6 @@ export function getLoroSidebarFooterClassName(isMobile: boolean): string {
   );
 }
 
-export function getLoroSidebarFooterIconButtonClassName(isMobile: boolean, active = false): string {
-  return cn(
-    isMobile
-      ? 'h-12 w-12 rounded-xl [&_svg]:h-5 [&_svg]:w-5'
-      : 'h-6 w-6 rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5',
-    'transition-colors focus-visible:ring-1 focus-visible:ring-sidebar-ring/40',
-    // A 12% foreground fill: the row selection token is tuned for full-width
-    // rows and nearly vanishes behind a 24px icon.
-    active
-      ? 'bg-foreground/[0.12] text-sidebar-selection-foreground hover:bg-foreground/[0.16]'
-      : 'text-sidebar-foreground dark:text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-sidebar-hover-foreground'
-  );
-}
-
 export const DEFAULT_DESKTOP_SIDEBAR_WIDTH = 280;
 export const MIN_DESKTOP_SIDEBAR_WIDTH = 240;
 export const MAX_DESKTOP_SIDEBAR_WIDTH = 420;
@@ -1016,10 +1055,10 @@ export const LoroSidebar = memo(function LoroSidebar({
     </>
   );
   const windowDrag = isElectron && !isElectronFullscreen;
-  const workspaceIdentityClassName = cn(
+  const mobileWorkspaceIdentityClassName = cn(
     SIDEBAR_CONTROL_TEXT_CLASS,
     'flex w-full min-w-0 select-none items-center gap-2 rounded-lg px-2 py-1.5 text-left',
-    isMobile ? 'h-9' : 'h-8',
+    'h-9',
     'text-sidebar-foreground dark:text-sidebar-foreground/75',
     workspaceSwitcherEnabled &&
       'hover:bg-sidebar-hover hover:text-sidebar-hover-foreground focus-visible:outline-hidden focus-visible:bg-sidebar-hover'
@@ -1036,18 +1075,38 @@ export const LoroSidebar = memo(function LoroSidebar({
   const renderWorkspaceControl = (menuSide: 'top' | 'bottom') =>
     workspaceSwitcherEnabled ? (
       <Menu.Root modal={!isMobile}>
-        <div className="min-w-0 flex-1">
+        <div className="flex min-w-0 flex-1">
           <Menu.Trigger
             render={
-              <button
-                type="button"
-                className={cn(workspaceIdentityClassName, windowDrag && WINDOW_DRAG_EXEMPT_CLASS)}
-                data-workspace-switcher-trigger
-                data-workspace-syncing={workspaceSyncing ? 'true' : 'false'}
-                aria-busy={workspaceSyncing || undefined}
-              >
-                {workspaceIdentity}
-              </button>
+              isMobile ? (
+                <button
+                  type="button"
+                  cl
```

**File**: `packages/components/src/stories/SidebarFooter.stories.tsx` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import type { Meta, StoryObj } from '@storybook/react';
+import { useState } from 'react';
+import { LoroSidebar, type LoroSidebarProps } from '@/components/loro-sidebar';
+import lodyLogo from '@/assets/lody-icon.png';
+
+const meta = {
+  title: 'Components/SidebarFooter',
+  component: LoroSidebar,
+  parameters: { layout: 'fullscreen' },
+  args: {
+    workspaceName: 'Wibus Studio',
+    userEmail: 'demo@example.com',
+    workspaces: [
+      { id: 'studio', name: 'Wibus Studio', logo: lodyLogo },
+      { id: 'demo', name: 'Demo workspace' },
+    ],
+    currentWorkspaceId: 'studio',
+    repoSections: [],
+    chats: [],
+    connectionUiState: 'online',
+    defaultWidth: 332,
+    onSettingsClicked: () => {},
+  },
+  render: (args) => <FooterScene {...args} />,
+} satisfies Meta<typeof LoroSidebar>;
+
+export default meta;
+type Story = StoryObj<typeof meta>;
+
+function FooterScene(args: LoroSidebarProps) {
+  const [activeNav, setActiveNav] = useState(args.activeNav ?? 'home');
+  const [workspaceId, setWorkspaceId] = useState(args.currentWorkspaceId);
+  const workspace = args.workspaces.find((item) => item.id === workspaceId);
+  return (
+    <div style={{ height: 420 }}>
+      <LoroSidebar
+        {...args}
+        workspaceName={workspace?.name ?? args.workspaceName}
+        currentWorkspaceId={workspaceId}
+        activeNav={activeNav}
+        onWorkspaceSelected={setWorkspaceId}
+        onHomeClicked={() => setActiveNav('home')}
+        onArchiveClicked={() => setActiveNav('archive')}
+      />
+    </div>
+  );
+}
+
+export const Default: Story = {};
+
+export const LongName: Story = {
+  args: {
+    workspaces: [
+      { id: 'studio', name: 'A workspace with a long name that needs truncation', logo: lodyLogo },
+    ],
+    defaultWidth: 240,
+  },
+};
+
+export const Syncing: Story = { args: { workspaceSyncing: true } };
+
+export const LocalIdentity: Story = { args: { workspaceSwitcherEnabled: false } };
```

**File**: `packages/components/tests/e2e/sidebar-nav-leading-column.spec.ts` (modified, +106/-0)
```diff
@@ -1,5 +1,111 @@
 import { expect, test } from '@playwright/test';
 
+test('sidebar footer controls share a compact desktop height across identity states', async ({
+  page,
+}) => {
+  await page.setViewportSize({ width: 900, height: 500 });
+  for (const theme of ['light', 'dark']) {
+    for (const story of ['default', 'long-name', 'syncing', 'local-identity']) {
+      await page.goto(
+        `/iframe.html?id=components-sidebarfooter--${story}&viewMode=story&globals=theme:${theme}`
+      );
+      const footer = page.locator('[data-sidebar-footer]');
+      await expect(footer).toBeVisible();
+      for (const fontSize of [12, 14, 18]) {
+        await page.evaluate(
+          (size) => document.documentElement.style.setProperty('--ui-font-size', `${size}px`),
+          fontSize
+        );
+        const geometry = await footer.evaluate((element) => {
+          const box = (node: Element) => {
+            const rect = node.getBoundingClientRect();
+            return {
+              left: rect.left,
+              right: rect.right,
+              width: rect.width,
+              height: rect.height,
+              centerY: rect.y + rect.height / 2,
+            };
+          };
+          const identity = element.querySelector(
+            '[data-workspace-switcher-trigger], [data-workspace-identity]'
+          )!;
+          return {
+            footer: box(element),
+            identity: box(identity),
+            actions: Array.from(element.querySelectorAll('button[aria-label]')).map((button) => ({
+              ...box(button),
+              glyph: box(button.querySelector('svg')!),
+            })),
+            overflow: element.scrollWidth > element.clientWidth,
+          };
+        });
+        expect(geometry.identity.height).toBe(28);
+        expect(geometry.footer.height).toBeLessThanOrEqual(37);
+        expect(geometry.overflow).toBe(false);
+        expect(geometry.actions).toHaveLength(3);
+        const controls = [geometry.identity, ...geometry.actions];
+        for (let index = 1; index < controls.length; index += 1) {
+          expect(controls[index].left - controls[index - 1].right).toBe(4);
+        }
+        for (const action of geometry.actions) {
+          expect(action.width).toBe(28);
+          expect(action.height).toBe(28);
+          expect(action.glyph.width).toBe(16);
+          expect(action.glyph.height).toBe(16);
+          expect(Math.abs(action.centerY - geometry.identity.centerY)).toBeLessThan(0.5);
+        }
+      }
+      if (story === 'local-identity') {
+        await expect(footer.locator('[data-workspace-switcher-trigger]')).toHaveCount(0);
+      } else {
+        const trigger = footer.locator('[data-workspace-switcher-trigger]');
+        await trigger.focus();
+        await page.keyboard.press('Enter');
+        await expect(page.getByRole('menuitemradio').first()).toBeVisible();
+        await page.keyboard.press('Escape');
+        await expect(page.getByRole('menuitemradio').first()).toBeHidden();
+        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
+      }
+    }
+  }
+});
+
+test('sidebar footer keeps mobile actions as 48px touch targets', async ({ browser }) => {
+  const context = await browser.newContext({
+    viewport: { width: 390, height: 600 },
+    userAgent:
+      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
+    isMobile: true,
+    hasTouch: true,
+  });
+  const page = await context.newPage();
+  try {
+    await page.goto('/iframe.html?id=components-sidebarfooter--default&viewMode=story');
+    const footer = page.locator('[data-sidebar-footer]');
+    for (const name of ['Help', 'Archive', 'Settings']) {
+      const action = footer.getByRole('button', { name, exact: true });
+      await expect(action).toBeVisible();
+      const box = await action.boundingBox();
+      const glyph = await action.locator('svg').boundingBox();
+      expect(box?.width).toBe(48);
+      expect(box?.height).toBe(48);
+      expect(glyph?.width).toBe(20);
+      expect(glyph?.height).toBe(20);
+    }
+    await expect(footer.locator('[data-workspace-switcher-trigger]')).toHaveCount(0);
+    await footer.getByRole('button', { name: 'Archive', exact: true }).tap();
+    await expect(footer.getByRole('button', { name: 'Leave Archive' })).toHaveAttribute(
+      'aria-current',
+      'page'
+    );
+    await footer.getByRole('button', { name: 'Help', exact: true }).tap();
+    await expect(page.getByRole('menuitem', { name: 'Docs' })).toBeVisible();
+  } finally {
+    await context.close();
+  }
+});
+
 test.describe('compact navigation modal', () => {
   test.use({ viewport: { width: 500, height: 745 } });
 
```

**File**: `packages/components/tests/loro-sidebar-pinned-section.test.tsx` (modified, +4/-1)
```diff
@@ -248,8 +248,11 @@ describe('LoroSidebar pinned section', () => {
     const exit = buttons.find((button) => button.textContent?.trim() === 'Leave Archive');
     expect(exit).toBeDefined();
     expect(
-      Array.from(exit!.parentElement!.children).map((button) => button.textContent?.trim())
+      Array.from(exit!.closest('[data-sidebar-footer]')!.querySelectorAll('button'))
+        .filter((button) => button.getAttribute('aria-label'))
+        .map((button) => button.getAttribute('aria-label'))
     ).toEqual(['Help', 'Leave Archive', 'Settings']);
+    expect(exit?.getAttribute('aria-current')).toBe('page');
     expect(exit?.querySelector('svg.lucide-archive')).not.toBeNull();
     expect(exit?.querySelector('svg.lucide-arrow-left')).not.toBeNull();
 
```

**File**: `specs/sidebar-footer.md` (modified, +11/-0)
```diff
@@ -14,7 +14,18 @@ Archive, its button returns to the previous page, or Home without history;
 Help and Settings remain available. The shared desktop and mobile sidebar use
 the same action order.
 
+On desktop, the workspace control and all three actions share a 28px height
+and vertical center. Action targets are square with 16px glyphs; the workspace
+avatar remains 20px. The footer has 4px vertical padding, and every adjacent pair
+of controls is 4px apart, including workspace and Help. Long workspace names truncate without increasing the row height;
+the syncing identity and the static local identity retain the same geometry.
+The workspace control opens its menu upward. Hover and keyboard focus use the
+shared ghost-button treatment, and Archive marks the current page while open.
+Mobile retains 48px action targets with 20px glyphs and its workspace identity
+in the sidebar header.
+
 ## Evidence
 
 - Implementation: [LoroSidebar](../packages/components/src/components/loro-sidebar.tsx).
 - Decision and validation limits: [footer note](../.agents/notes/implemented/feature/2026-09-26-sidebar-footer.md).
+- Control sizing: [compact footer note](../.agents/notes/implemented/feature/2026-10-04-sidebar-footer-density.md).
```

---

### Incident Patch 8: `62b6a99c` (2026-10-04)
**Commit Message**: fix: balance conversation rhythm with StyleX tokens (#1238)

* fix: balance conversation rhythm with StyleX tokens

Model: gpt-6

* docs: link conversation rhythm decision to PR

Model: gpt-6

**File**: `.agents/notes/implemented/simplification/2026-10-03-conversation-rhythm-stylex.md` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+# Conversation rhythm on themeable StyleX surfaces
+
+Status: implemented
+Translation: current
+PR: [#1238](https://github.com/LodyAI/Lody/pull/1238)
+
+[中文](2026-10-03-conversation-rhythm-stylex.zh.md)
+
+## Abstract
+
+Conversation spacing combined virtual-row padding, activity-button padding and
+invisible user actions in normal flow, making related content too far apart.
+Fixed compact reserves then removed too much separation at the default size.
+Semantic StyleX tokens now derive reading and round spacing from interface leading:
+the default scene has 24px activity rows, 14px / 22px reading prose, a 36px
+response gap and a 56px next-round minimum. Footer actions and next-user metadata
+share that reserve; taller content can grow, and themes can override tokens without
+changing authored text or font roles.
+
+## Evidence and decision
+
+The screenshot indicates a symptom, not computed CSS values. In the real completed
+fixture at 1120 × 1500 and 14px text, original activity rows measured 26–28px,
+bubble-to-response about 54px and quote-to-next-bubble about 86px. Hidden user Copy
+actions still occupied a flex-stack row. Activity rows combined their own padding
+with virtual-wrapper padding. Removing that duplication was warranted, but fixed
+32px / approximately 56px reserves made the default view too dense. Increasing
+only the outer reserves to 40px / 64px left prose at 14px / 20px: the view separated
+messages more than it opened up reading. In the expanded four-row activity fixture,
+the first bubble to actual prose was 140px, including 96px of activity and its gap.
+The short fixture verified box distances but did not adequately expose wrapped-line
+reading density.
+
+The [conversation token group](../../../../packages/components/src/components/ai-gui/conversation.tokens.stylex.ts)
+owns semantic spacing, not another global space or typography scale. It derives
+`responseGap`, `roundGap`, paragraph spacing, activity pitch, list-item gap and
+bubble padding from `@lody/ui` leading and shared space tokens. The
+[rhythm Spec](../../../../specs/conversation-rhythm.md) owns formulas and size examples.
+A fixed 40px / 72px adjustment was considered; proportional leading with floors
+preserves hierarchy across all five interface sizes. The final balance separates
+reading leading from interface leading: `readingLeading` derives from body leading
+at 1.1 times (22px at 14px), while response/round reserves use smaller independent
+multipliers (36px / 56px at 14px). User text and ordinary Markdown consume the reading
+token; compact tool prose, code and UI controls retain their existing leading.
+Explicit Markdown previews scale the token using the same typed division as font
+size. Themes can change reading leading without changing macro reserves or code.
+The redundant fenced-code `sectionGap` alias is consolidated into `surfaceGap`.
+
+The user row positions actions in its response reserve. The first assistant row
+adds no top padding, including when it is prose rather than a worked header.
+Before an adjacent user turn, the last assistant row owns the round reserve.
+For ordinary footers its minimum height subtracts the next user's metadata pitch
+and gap, so actions and metadata fit within the intended distance. Metadata pitch
+also accommodates the fixed 14px status icon at the smallest size. Without a
+footer the last content row supplies the same reserve. A tail without a following
+user gets only ordinary row padding. Edited-file cards, wrapped or extra actions,
+and attachments can grow beyond the minimum; no fixed-height clipping is used.
+
+Next-user role participates in the assistant-row cache identity, including user
+placeholders. First/last boundary flags participate in memo comparison. Appending
+or removing a follow-up therefore updates spacing without changing row keys,
+and unchanged rows remain reference-stable. The scroll engine and outline
+conversion are unchanged.
+
+Message wrappers, bubbles, metadata, activity rows and Markdown elements consume
+StyleX. Code and diff share the code-body component. The group aliases shared
+radius and colours; unmatched existing CSS colour variables remain compatibility
+bridges. Shiki palette interop, tables, Mermaid and diff-line-specific CSS remain.
+User text keeps `pre-wrap`: removing authored blank lines would change copy,
+search and content. The optical reading rail stays 4px; the
+[typography decision](2026-10-03-interface-typography.md) remains the owner of text roles.
+
+## Verification and limits
+
+Nine focused unit suites pass (140 tests), covering virtual-row identity and boundary
+updates, folding, activity, action insets, sender identity, copy, Markdown streaming
+reparsing, idle rendering and share Markdown. The browser suites pass 20 tests:
+all five sizes, light/dark and narrow layouts, measured
+response/round gaps and list pitch, user blank lines, keyboard actions, code wrap,
+no-footer and edited-file 
```

**File**: `.agents/notes/implemented/simplification/2026-10-03-conversation-rhythm-stylex.zh.md` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+# 基于可主题化 StyleX 表面的对话节奏
+
+Status: implemented
+Translation: current
+PR: [#1238](https://github.com/LodyAI/Lody/pull/1238)
+
+[English](2026-10-03-conversation-rhythm-stylex.md)
+
+## 摘要
+
+对话间距叠加了虚拟行 padding、活动按钮 padding，以及仍占普通布局空间的隐藏用户操作，
+使相关内容之间留白过大；固定紧凑预留区又削弱了默认字号下的层次。现在语义 StyleX
+变量根据界面行高计算阅读与轮次间距：默认场景的活动行高为 24px，正文为 14px / 22px，
+回复间距为 36px，下一轮最小距离为 56px。Footer 操作与下一条用户消息的 metadata 共用该预留区，
+更高内容可以自然撑开；主题可覆盖 token，原始消息文本和文字角色保持不变。
+
+## 证据与决策
+
+截图反映症状，不是 CSS 计算值。1120 × 1500、14px 字号下，真实已完成 fixture 的
+原活动行测得 26–28px，气泡到回答约 54px，引用到下一气泡约 86px。用户 Copy 操作
+虽然视觉隐藏，仍占 flex 栈的一行；活动行自身 padding 又叠加虚拟包装的 padding。
+消除这些重复是必要的，但固定的 32px / 约 56px 预留区让默认界面过于紧密。仅把外围
+预留区放大到 40px / 64px 后，正文仍为 14px / 20px，消息之间拉开了，阅读内部却没有
+舒展。展开四行活动的 fixture 中，第一条气泡到实际正文为 140px，其中活动区占 96px，
+其余是间距。短文本 fixture 验证了盒模型距离，却没有充分暴露自动换行后的阅读密度。
+
+[会话 token 组](../../../../packages/components/src/components/ai-gui/conversation.tokens.stylex.ts)
+拥有语义间距，而非新增全局间距或文字尺度。`responseGap`、`roundGap`、段落间距、
+活动 pitch、列表项间距和气泡 padding 都由 `@lody/ui` 行高与共享间距计算。
+[节奏 Spec](../../../../specs/conversation-rhythm.zh.md)统一拥有公式与字号示例。曾考虑
+固定调整为 40px / 72px；使用带下限的比例行高，才能覆盖全部五档字号，而非只调整
+一张截图。最终方案将阅读行高与界面行高分开：`readingLeading` 为 body 行高的
+1.1 倍，默认 14px 字号下为 22px；回复与轮次预留区采用更小、独立的乘数，默认是
+36px / 56px。用户文本与普通 Markdown 消费阅读 token，紧凑工具正文、代码和界面
+控件保留既有行高。显式 Markdown 预览使用与字号相同的类型除法缩放阅读 token。
+主题可单独改变阅读行高，不改变外围预留区或代码。围栏代码重复的 `sectionGap`
+别名合并到 `surfaceGap`。
+
+用户行把操作放在回复预留区内。助手第一行不再添加顶部 padding，无论它是正文还是
+已完成工作标题。紧接用户轮次时，助手最后一行拥有轮次预留区。普通 footer 的最小
+高度扣除下一条用户消息的 metadata pitch 与 gap，让操作和 metadata 包含在约定距离
+中。Metadata pitch 在最小字号下也容纳固定 14px 的状态图标。没有 footer 时，最后
+内容行提供同样预留区；没有后续用户消息的尾部仅使用普通行 padding。文件修改卡片、
+换行或额外操作及附件均可超出最小距离，不使用固定高度裁切。
+
+下一条用户消息的角色参与助手行缓存身份，包括用户 placeholder；第一行、最后一行
+的边界状态参与 memo 比较。追加或移除追问会正确更新间距，行 key 保持稳定；未改变
+的行保留引用身份。滚动引擎与 outline 的索引转换保持不变。
+
+消息包装、气泡、metadata、活动行与 Markdown 元素使用 StyleX，代码与 diff 共用
+代码正文组件。变量组引用共享圆角与颜色；没有对应语义 token 的既有 CSS 颜色变量
+保留为兼容桥接。Shiki 调色板适配、表格、Mermaid 与 diff 行专用 CSS 仍保留。用户
+文本继续使用 `pre-wrap`：删除原始空行会改变复制、搜索和内容。光学阅读基线仍为
+4px；[排版决策](2026-10-03-interface-typography.zh.md)继续拥有文字角色。
+
+## 验证与限制
+
+九组聚焦单测通过，共 140 项，覆盖虚拟行身份与边界更新、折叠、活动、操作缩进、
+发送者身份、复制、Markdown 流式重解析、空闲渲染与分享 Markdown。浏览器测试通过
+20 项，覆盖全部五档字号、明暗主题与窄窗口、
+实测回复和轮次距离及列表 pitch、用户空行、键盘操作、代码换行、无 footer 和文件
+修改场景、原生选择、有序列表标记以及原有排版与偏好设置。实际局部 `createTheme`
+将回复和轮次预留区独立改为 48px / 80px，阅读行高改为 24px 时，代码仍为 18px，
+同时覆盖表面颜色与 margin。新增静态与流式阅读 story 使用连续中英文段落，浏览器
+Range 检查自动换行后的真实行距为 22px。
+
+阅读修订的前后截图使用同一个合成长正文两轮 story，1120 × 1500、14px、暗色主题，
+并展开第一组活动，对比原先 20px / 40px / 64px 与新版 22px / 36px / 56px 的比例。
+没有使用捕获的会话记录。组件类型检查在已有独立验证 clone 中执行，源文件变更从
+主工作树复制。
+
+主工作树缺少依赖与 ACP 子模块；根目录 `pnpm check` 在 ACP 筛选无匹配之后，因
+缺少 `tsgo` 停止，根目录 `pnpm format` 因缺少 `oxfmt` 停止。使用验证 clone 的
+formatter 检查本次修改的全部 13 个 TypeScript、TSX 和 CSS 文件，格式检查通过。
+未证明全仓 build/check 全绿。文档检查仍报告指向缺失子模块的链接；
+本次修改的文档没有失效链接，未改变 SHA 保护主题。Spec 保持 draft，实现和测试通过
+不代表人工批准。
+
+已选轮次浏览器 fixture 保留此前的设置：先通过原生鼠标建立选择，再设定精确范围。
+仍断言文本保留和节点连接状态；该设置避免了在原生产样式下也会于 writer 更新前
+消失的程序化选区。
```

**File**: `packages/components/src/components/ai-gui/AGENTS.md` (modified, +29/-29)
```diff
@@ -10,13 +10,12 @@ Edit `AGENTS.md`, not its `CLAUDE.md` symlink. Ownership: [README.md](README.md)
   output. Never wire `searchBlockId` to tool, terminal, or diff renderers.
 - Window stream readiness must use the same hydration/initial-scroll conditions as
   viewport visibility; hydrated history alone cannot reveal a native window.
-- `SessionChatStreamView` scrolls only through `conversation-list/`'s
-  `ConversationListHandle`, backed by the
-  [scroll engine](../../lib/conversation-scroll/AGENTS.md). Stable row keys; map
-  history indexes to rows. Collapsed activity is one row; expanded details
-  are siblings, never nested scrollers or fixed-height process panels.
-- Native text selection retains its complete row corridor and history leases;
-  hold prose/folding, keep actions live, and release on clear. See [README.md](README.md#native-text-selection).
+- `SessionChatStreamView` scrolls through `conversation-list/`'s
+  `ConversationListHandle` and [scroll engine](../../lib/conversation-scroll/AGENTS.md)
+  only. Keep row keys stable; map history indexes to rows. Collapsed activity is one
+  row; expanded details are siblings, never nested scrollers or fixed-height panels.
+- Native selection retains its row corridor and history leases: hold prose/folding,
+  keep actions live, release on clear. [Contract](README.md#native-text-selection).
 - `buildChatStreamItems()` must drop empty assistant entries and de-duplicate
   history ids.
 - `leadingContent` is a real first row: include it in sticky counts and scroll
@@ -33,15 +32,13 @@ Edit `AGENTS.md`, not its `CLAUDE.md` symlink. Ownership: [README.md](README.md)
 
 - Finished turns keep the answer/result tail visible and fold earlier work;
   streaming turns stay expanded.
-- The final answer is the final contiguous run of text before trailing
-  never-collapsed items, not always the last item: walk backward through
-  adjacent text blocks until a non-text boundary.
-- A turn may hold several `AssistantTurnRenderSegment`s; a plan approval inside a
-  running turn cuts a segment. Match ACP kind `switch_mode`, never a title
-  (`plan-surface.ts`). Keep
-  `workBlockKeys`, `hasVisibleFinalContent`, last-item visibility, and
-  `expandedWorkedGroups` per segment; expansion keys include the segment. Only
-  the last region may show a duration; earlier ones say "Finished working".
+- The final answer is the contiguous text run before trailing never-collapsed
+  items. Walk backward over adjacent text blocks to the first non-text boundary.
+- Plan approval cuts an `AssistantTurnRenderSegment` in a live turn. Match ACP
+  kind `switch_mode`, never a title (`plan-surface.ts`). Keep `workBlockKeys`,
+  `hasVisibleFinalContent`, last-item visibility and `expandedWorkedGroups` per
+  segment; expansion keys include it. Only the last segment shows duration;
+  earlier ones say "Finished working".
 - `shouldUseWorkedGroup` requires a finished turn, foldable work, and visible
   final content outside `workBlockKeys`. A cancelled/interrupted or tool-only
   turn with no answer stays expanded; `message.finished` cannot prove
@@ -66,19 +63,21 @@ Edit `AGENTS.md`, not its `CLAUDE.md` symlink. Ownership: [README.md](README.md)
   has no footer.
 - Streaming replies use a direct Copy action and turn-config info (set at open);
   Fork controls and loading need a finished turn.
-- The gutter belongs to `ConversationColumn`, not the list. EVERY row shares one left rail with no shell pad, INCLUDING
-  the contents of an expanded region: expanding reveals rows, it never shifts
-  them right; the chevron carries the hierarchy. Prose, desktop group/status
-  labels, and steps share a fixed 4px inset. Steps use `px-[4px]` with
-  no negative margin; the footer bleeds only on the trailing edge (`-mr-[7px]`).
+- `ConversationColumn` owns the gutter; the list and row shells add no horizontal
+  pad. EVERY row, including expanded details, shares one left rail. Expansion never
+  shifts content right; the chevron carries hierarchy. Prose and desktop process
+  labels/steps share StyleX `conversation.railInset` (4px). Steps have no negative
+  margin; footer bleed is trailing-only (`-mr-[7px]`).
   See `AssistantTurnAlignment.stories`.
+- Follow the StyleX [spacing contract](../../../../../specs/conversation-rhythm.md).
+  User rows own `responseGap`; last assistant rows own `roundGap`, including footer
+  and next-user metadata. Cache and memo comparison include boundary state.
 
 ## Conversation Outline
 
-- Before changing the outline rail, its arrival intent, or any row-index-to-scroll
-  conversion, read [conversation-outline.md](conversation-outline.md). It binds
-  every caller: `scrollRowToTop` is the ONE such conversion, group toggles never
-  scroll, and a jump is issued once: the scroll engine holds its row at the top.
+- Outline, arrival-intent and row-index-to-scroll changes follow
+  [conversation-outline.md](conversation-outline.md): only `scrollRowToTop` converts,
+ 
```

**File**: `packages/components/src/components/ai-gui/README.md` (modified, +30/-0)
```diff
@@ -20,6 +20,7 @@ the reasoning behind those rules.
 | Outline                 | `conversation-outline-*`                                                                          | Round ticks and navigation.                                                             |
 | Image sharing selection | [`message-selection.tsx`](message-selection.tsx)                                                  | Temporary message selection, drag rectangle, range modifiers, and edge scrolling.       |
 | Typography              | [`conversation-font-size-classes.ts`](conversation-font-size-classes.ts), `markdown-renderer.tsx` | Shared text roles; explicit preview size and compact tool prose without nested scaling. |
+| Spacing and surfaces    | [`conversation.tokens.stylex.ts`](conversation.tokens.stylex.ts), [`surface.ts`](surface.ts)      | Themeable conversation anatomy, activity rows and user bubbles.                         |
 
 - `conversation-outline-rail.tsx` renders one tick per round (a user turn plus its
   work) and a hover preview; `conversation-outline-arrival-intent.ts` decides when
@@ -66,13 +67,42 @@ the reasoning behind those rules.
   [session-files-rendering.md](session-files-rendering.md) own attachment and
   image-preview rendering.
 
+## Spacing and themes
+
+Conversation spacing and colours use the semantic `conversation` StyleX variable
+group, derived from `@lody/ui` space, radius and colour tokens or the active VS Code
+palette. `surface.ts` owns shared row and bubble styles; the Markdown renderer and
+code block own their element styles. A host can apply `createTheme(conversation, …)`
+to a subtree to change these values without descendant utility overrides.
+
+Reading prose and user text use `readingLeading`, derived from the body role
+at 1.1 times its leading (22px at 14px). Compact tool prose and code retain their
+control leading. Explicit previews scale the reading token with their own size.
+Spacing follows the active interface leading through semantic `responseGap`,
+`roundGap`, `activityPitch`, `paragraphGap`, `surfaceGap` and `listItemGap` tokens.
+The user row reserves the response gap for its actions. The first assistant row
+adds no top gap; its last row reserves the next-round boundary only before a user
+turn. Footer actions and the next user's metadata share that reserve; larger
+footer content grows naturally. User text retains authored whitespace and the
+existing reading rail. The [rhythm Spec](../../../../../specs/conversation-rhythm.md)
+owns formulas and size examples; [the decision](../../../../../.agents/notes/implemented/simplification/2026-10-03-conversation-rhythm-stylex.md)
+records evidence and retained CSS boundaries.
+
 ## Coverage
 
 `InterfaceTypography.stories.tsx` composes real settings and surfaces;
 `tests/e2e/interface-typography.spec.ts` checks computed type metrics, portals,
 five-tier persistence, legacy preferences, themes and narrow desktop layout.
 See the [global scale decision](../../../../../.agents/notes/implemented/simplification/2026-10-03-interface-typography.md)
 for scope and retained exceptions.
+`AssistantTurnAlignment.ConversationRhythm` renders a synthetic two-round conversation;
+`ConversationRhythmTheme` applies a scoped StyleX theme to the same components.
+`ConversationRhythmReading` and its streaming variant add continuous mixed-script
+paragraphs to verify real wrapped-line pitch and compare reading density.
+The no-footer and edited-files variants exercise boundary reserves without a
+footer and with taller footer content. The typography browser suite checks all
+five interface sizes, measured activity/turn spacing, preserved
+user blank lines, keyboard access to actions, list pitch, folding, and token overrides.
 
 `tests/build-chat-stream-items.test.ts`, `tests/conversation-outline*.test.ts`,
 `tests/user-message-sender-identity.test.tsx`, the `ExtremeConversation` story,
```

**File**: `packages/components/src/components/ai-gui/conversation-font-size-classes.ts` (modified, +9/-0)
```diff
@@ -1,6 +1,7 @@
 import type { CSSProperties } from 'react';
 import { text } from '@lody/ui/tokens/scales.stylex';
 import type { ConversationFontSize } from '@/atoms/settings';
+import { conversation } from './conversation.tokens.stylex';
 
 /** Document baseline shared by product text and portalled controls. */
 export const UI_FONT_SIZE_CSS_VARIABLE = '--ui-font-size';
@@ -22,6 +23,14 @@ export function conversationTextFontSizeStyle(fontSize: ConversationFontSize): C
   };
 }
 
+/** Reading prose shares the body size while its leading can be themed separately. */
+export function conversationReadingFontSizeStyle(fontSize: ConversationFontSize): CSSProperties {
+  return {
+    fontSize: conversationTextToken(text.bodySize, fontSize),
+    lineHeight: conversationTextToken(conversation.readingLeading, fontSize),
+  };
+}
+
 /** Code and tool output use the same control text role, with their existing mono face. */
 export function terminalTextFontSizeStyle(fontSize: ConversationFontSize): CSSProperties {
   return {
```

**File**: `packages/components/src/components/ai-gui/conversation.tokens.stylex.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import * as stylex from '@stylexjs/stylex';
+import { colors } from '@lody/ui/tokens/colors.stylex';
+import { radius, space, text } from '@lody/ui/tokens/scales.stylex';
+
+const readingLeading = `calc(${text.bodyLeading} * 1.1)`;
+
+/** Conversation anatomy; hosts can override this group with createTheme. */
+export const conversation = stylex.defineVars({
+  reading: 'hsl(var(--reading-foreground, var(--foreground)))',
+  readingLeading,
+  strong: 'hsl(var(--foreground-strong, var(--foreground)))',
+  bubbleFill: `color-mix(in srgb, ${colors.label} 5%, transparent)`,
+  bubbleRadius: radius.large,
+  bubblePaddingInline: space[4],
+  bubblePaddingBlock: `max(${space[3]}, calc(${text.bodyLeading} - ${space[2]}))`,
+  railInset: space[1],
+  messagePadding: space[2],
+  responseGap: `max(${space[8]}, calc(${text.bodyLeading} * 1.8))`,
+  roundGap: `max(48px, calc(${text.bodyLeading} * 2.8))`,
+  activityPitch: `max(${space[6]}, calc(${text.subheadlineLeading} + ${space[1.5]}))`,
+  activityPadding: `calc(${space[1]} / 2)`,
+  activityHoverFill: 'hsl(var(--hover) / 0.4)',
+  proseGap: space[1],
+  surfaceGap: `max(${space[4]}, calc(${text.bodyLeading} - ${space[1]}))`,
+  paragraphGap: `max(${space[3]}, calc(${text.bodyLeading} - ${space[2]}))`,
+  listItemGap: `max(2px, calc(${space[6]} - ${readingLeading}))`,
+  metadataGap: space[1],
+  metadataPitch: `max(14px, ${text.captionLeading})`,
+  codeFill: 'hsl(var(--code-background))',
+  codeDarkFill: 'color-mix(in srgb, hsl(var(--input)) 90%, hsl(var(--background)))',
+  codeBorder: 'hsl(var(--code-border))',
+  codeText: 'hsl(var(--code-foreground))',
+  codeMeta: 'hsl(var(--code-foreground) / 0.55)',
+});
```

**File**: `packages/components/src/components/ai-gui/markdown-code-block.tsx` (modified, +144/-26)
```diff
@@ -14,7 +14,9 @@ import { useAtomValue } from 'jotai';
 import { useTranslation } from 'react-i18next';
 import { conversationFontSizeAtom } from '@/atoms/settings';
 import * as stylex from '@stylexjs/stylex';
-import { text } from '@lody/ui/tokens/scales.stylex';
+import { radius, space, text } from '@lody/ui/tokens/scales.stylex';
+import { withClassName } from '@/lib/stylex';
+import { conversation } from './conversation.tokens.stylex';
 import { writeTextToClipboard } from '@/lib/clipboard';
 import { useMarkdownCodeTokens, type MarkdownCodeToken } from './markdown-code-highlight';
 
@@ -66,7 +68,97 @@ export function isMarkdownCodeFence(language: string, meta: string | undefined):
 const COPY_FEEDBACK_MS = 2000;
 
 const typography = stylex.create({
+  block: {
+    '--markdown-code-block-bg': {
+      default: conversation.codeFill,
+      ':is(.dark *)': conversation.codeDarkFill,
+    },
+    '--markdown-code-block-border': conversation.codeBorder,
+    '--markdown-code-block-foreground': conversation.codeText,
+    '--markdown-code-block-language': conversation.codeMeta,
+    position: 'relative',
+    display: 'flex',
+    flexDirection: 'column',
+    width: '100%',
+    marginBlock: conversation.surfaceGap,
+    overflow: 'hidden',
+    gap: 0,
+    border: 0,
+    borderRadius: radius.small,
+    backgroundColor: 'var(--markdown-code-block-bg)',
+    padding: 0,
+    color: conversation.codeText,
+  },
+  toolbar: {
+    display: 'flex',
+    minHeight: '28px',
+    alignItems: 'center',
+    justifyContent: 'space-between',
+    columnGap: space[2],
+    paddingInline: space[3],
+    borderBottom: `0.5px solid ${conversation.codeBorder}`,
+    color: conversation.codeMeta,
+  },
+  header: {
+    display: 'flex',
+    minWidth: 0,
+    flex: 1,
+    alignItems: 'center',
+    overflow: 'hidden',
+    fontFamily: 'var(--font-mono)',
+    letterSpacing: '0.02em',
+    pointerEvents: 'none',
+  },
+  label: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
+  actions: {
+    display: 'flex',
+    flexShrink: 0,
+    alignItems: 'center',
+    columnGap: `calc(${space[1]} / 2)`,
+  },
+  action: {
+    display: 'inline-flex',
+    width: space[6],
+    height: space[6],
+    alignItems: 'center',
+    justifyContent: 'center',
+    padding: 0,
+    borderRadius: radius.mini,
+    color: {
+      default: conversation.codeMeta,
+      ':hover': conversation.codeText,
+      ':is([aria-pressed="true"])': conversation.codeText,
+    },
+    backgroundColor: {
+      default: 'transparent',
+      ':is([aria-pressed="true"])': `color-mix(in srgb, ${conversation.codeText} 12%, transparent)`,
+    },
+  },
+  icon: { width: '14px', height: '14px' },
+  body: {
+    overflowX: { default: 'auto', ':is([data-code-wrap="true"] *)': 'hidden' },
+    paddingBlock: space[3],
+    paddingInline: space[4],
+    color: conversation.codeText,
+  },
+  pre: {
+    minWidth: { default: 'max-content', ':is([data-code-wrap="true"] *)': 0 },
+    margin: 0,
+    backgroundColor: 'transparent',
+    whiteSpace: { default: 'pre', ':is([data-code-wrap="true"] *)': 'pre-wrap' },
+    overflowWrap: { default: 'normal', ':is([data-code-wrap="true"] *)': 'anywhere' },
+    width: { default: 'auto', ':is([data-code-wrap="true"] *)': '100%' },
+  },
+  line: { display: 'block' },
+  preview: {
+    paddingTop: space[2],
+    paddingInline: space[1.5],
+    paddingBottom: space[3],
+    backgroundColor: 'transparent',
+  },
   code: {
+    fontFamily: 'var(--font-mono)',
+    fontVariantLigatures: 'var(--lody-font-ligatures, contextual)',
     fontSize: `var(--markdown-code-font-size, ${text.subheadlineSize})`,
     lineHeight: `var(--markdown-code-line-height, ${text.subheadlineLeading})`,
   },
@@ -79,6 +171,7 @@ const typography = stylex.create({
 export function CodeBlockContainer({
   language,
   isIncomplete,
+  className,
   ...props
 }: ComponentProps<'div'> & { language: string; isIncomplete: boolean }) {
   return (
@@ -87,6 +180,7 @@ export function CodeBlockContainer({
       data-language={language}
       data-streamdown="code-block"
       {...props}
+      {...withClassName(stylex.props(typography.block), className)}
     />
   );
 }
@@ -105,6 +199,7 @@ export function CodeBlockCopyButton({ code }: { code: string }) {
       data-streamdown="code-block-copy-button"
       aria-label={label}
       title={copied ? t('common.copied', 'Copied') : label}
+      {...stylex.props(typography.action)}
       onClick={() => {
         void writeTextToClipboard(code).then((ok) => {
           if (!ok) return;
@@ -114,7 +209,11 @@ export function CodeBlockCopyButton({ code }: { code: string }) {
         });
       }}
     >
-      {copied ? <Check size={14} /> : <Copy size={14} />}
+      {copied ? (
+        <Check {...stylex.props(typography.icon)} />
+      ) : (
+        <Copy {...stylex.props(typography.icon)} />
+      )}
     </button>
   );
 }
@@ -145,26 +244,36 @@ const Markdo
```

**File**: `packages/components/src/components/ai-gui/markdown-diff-block.tsx` (modified, +13/-16)
```diff
@@ -1,6 +1,7 @@
 import { memo, useMemo, useState } from 'react';
 import {
   CodeBlockContainer,
+  CodeBlockBody,
   MarkdownCodeToolbar,
   parseMarkdownCodeBlockLabel,
   type MarkdownCodeBlockProps,
@@ -52,22 +53,18 @@ export const MarkdownDiffBlock = memo(function MarkdownDiffBlock({
         wrapped={wrapped}
         onToggleWrap={() => setWrapped((current) => !current)}
       />
-      <div data-streamdown="code-block-body">
-        <pre dir="ltr">
-          <code>
-            {lines.map((line, index) => (
-              <span
-                // A streamed block grows by appending lines, so its stable
-                // source position is the least disruptive key available.
-                key={index}
-                data-markdown-diff-line={getMarkdownDiffLineKind(line)}
-              >
-                {line}
-              </span>
-            ))}
-          </code>
-        </pre>
-      </div>
+      <CodeBlockBody>
+        {lines.map((line, index) => (
+          <span
+            // A streamed block grows by appending lines, so its stable
+            // source position is the least disruptive key available.
+            key={index}
+            data-markdown-diff-line={getMarkdownDiffLineKind(line)}
+          >
+            {line}
+          </span>
+        ))}
+      </CodeBlockBody>
     </CodeBlockContainer>
   );
 });
```

---

### Incident Patch 9: `7eab5a1a` (2026-10-04)
**Commit Message**: fix: use theme color for file mention category icon (#1237)

Model: gpt-6

**File**: `packages/components/src/components/mentions/mention-two-level-menu.tsx` (modified, +6/-1)
```diff
@@ -8,6 +8,7 @@ import {
   ChevronLeft,
   ChevronRight,
   CircleDot,
+  File,
   GitPullRequest,
   MessageSquare,
   Terminal,
@@ -537,7 +538,11 @@ function CategoryRow({
       onMentionNavigate={onNavigate ? () => onNavigate(category) : undefined}
     >
       <RowGlyph value={value}>
-        <CandidateIcon icon={category.icon} />
+        {category.icon === 'file' ? (
+          <File {...stylex.props(styles.glyphSvg)} strokeWidth={1.75} />
+        ) : (
+          <CandidateIcon icon={category.icon} />
+        )}
       </RowGlyph>
       <span {...stylex.props(styles.text, reason != null && styles.textStacked)}>
         <span {...stylex.props(styles.title, disabled && styles.titleMuted)}>{category.label}</span>
```

---

### Incident Patch 10: `6da6168e` (2026-10-04)
**Commit Message**: fix(ui): let the menu icon box own glyph size (#1232)

**File**: `.agents/notes/implemented/bug-fix/2026-10-03-menu-row-glyph-slots.md` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+# Menu rows drew glyphs at 24px: the icon slot was bypassed twice
+
+Status: implemented
+Translation: current
+
+[中文](2026-10-03-menu-row-glyph-slots.zh.md)
+
+## Abstract
+
+The merge-method dropdown in the session info bar drew its selected-method
+checkmark at 24px — far larger than the row's text — because `PrMergeButton`
+placed a bare lucide `<Check>` inside `Menu.Item` children, where it lands on the
+label's flex line at the icon library's default size. The same failure existed
+at scale the other way around: ~48 `Menu.Item`/`ContextMenu.Item`/`Menubar`
+callers pass a lucide icon through the `icon` prop with no size, so it renders at
+24px inside the slot's fixed 16px box, and several single-select pickers
+hand-drew their own checkmark inside the label instead of using
+`Menu.RadioItem`. The rows now use the slots the primitive defines (`icon`,
+`endContent`, `tone`, `indicator`/`indicatorSide`), the fake-checkmark pickers
+became real radio rows, and the `icon` prop itself now takes the glyph
+_component_ (`icon={Check}`): the box mounts it with a 100%-fill class, so a
+missing size can no longer silently overflow. An element form remains for
+glyphs carrying props (a `Spinner`'s `size`/`label`, a tuned `strokeWidth`)
+and keeps whatever size it declares. Deliberate composite rows (avatars,
+multi-column project entries) keep custom children.
+
+## Evidence
+
+- `Menu.Item` children are wrapped in `itemText`, the label's single flex line
+  (`packages/ui/src/popup/surface.ts`, `row-label.tsx`). A lucide icon there is
+  an element child, rendered at its `width`/`height` attributes — 24px — against
+  a ~13px label. Screenshot evidence: the check glyph overtook the row in the PR
+  info-bar merge dropdown (`pr-merge-button.tsx`).
+- The `icon` prop places the glyph in `itemIcon`, a fixed 16px box, but the box
+  does not constrain the child (StyleX has no descendant selector, so
+  `@lody/ui`'s documented contract is that a caller's glyph "states them as
+  100%"). A `<svg width="24">` flex item cannot shrink below its intrinsic size,
+  so every `icon={<X />}` without a size rendered 24px centred over the 16px
+  slot — ~48 sites, mostly migrated in #999 ("route sidebar context-menu icons
+  through the icon box") which moved icons into `icon=` while keeping their old
+  unsized elements.
+- Hand-rolled selection marks duplicated `Menu.RadioItem`'s reserved indicator
+  box: `mobile-account-settings` (member/admin), `acp-session-select`,
+  `workdir-mode-selector`, the session header's IDE-launcher picker (twice), its
+  owner picker, `organization-switcher`, and `unified-project-selector`'s
+  project rows. Each drew `<Check>` manually —
+  sized, so visually fine, but one missing size class away from this exact bug —
+  and all of them reported `role="menuitem"` rather than `menuitemradio`.
+- Roughly 30 more rows, concentrated in `session-chat-interface.tsx`'s session
+  header menu, placed correctly-sized lucide icons inside children anyway —
+  recreating the slot by hand with inconsistent sizes (`h-3.5`, `h-4`) and
+  colours (`text-muted-foreground` or inherited label) instead of the slot's one
+  box and hint colour; `tone="destructive"` was also bypassed with a
+  `text-destructive` class on the delete row.
+
+## Decision
+
+- `pr-merge-button.tsx` renders the merge-method choice as a real
+  `Menu.RadioGroup` + `Menu.RadioItem indicator="check"` — the same vocabulary
+  `PrPrimaryAction` already uses for its merge-method menu.
+- `MenuRowProps.icon` widened to `ReactNode | ElementType<{ className?: string }>`.
+  A component value is mounted by `itemIcon` itself through `createElement` with
+  `surface.itemIconGlyph` (`width/height: 100%`), which beats an svg's px
+  attributes. An element value renders as given — the form for a glyph that
+  carries props — and keeps its stated size. Every lucide call site moved to
+  component form (`icon={Check}`); element form stays only where a glyph
+  declares real props (`<Spinner size="small" label={null}/>`, tuned
+  `strokeWidth`, a per-row `SidePanelTabIcon tab={panel}`), which for lucide
+  still means `size="100%"`.
+- The hand-rolled checkmark pickers became `Menu.RadioGroup` + `Menu.RadioItem`;
+  rows whose leading slot carries an identity mark (avatar, launcher brand icon)
+  use `indicatorSide="end"`, the case the API exists for.
+- Plain leading-glyph rows moved their glyph to `icon=`, trailing marks
+  (copy affordances, status spans, the popover info button, `Switch`) to
+  `endContent`, and the destructive delete row to `tone="destructive"`.
+- The primitive owns the default, not the caller: component form makes "fill
+  the box" impossible to omit, because the box instantiates the glyph and
+  hands it the fill class. A `cloneElement`-based backstop for bare elements
+  was tried first and dropped — injecting props into a caller's element is
+  guesswork (fragments, components that swallow `style`) where compo
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-03-menu-row-glyph-slots.zh.md` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+# 菜单行把图标画成了 24px:图标槽被绕过了两次
+
+Status: implemented
+Translation: current
+
+[English](2026-10-03-menu-row-glyph-slots.md)
+
+## 摘要
+
+会话信息栏的合并方式下拉把选中项的对勾画成了 24px —— 远大于行内文字 —— 因为
+`PrMergeButton` 把一个裸的 lucide `<Check>` 放进了 `Menu.Item` 的 children 里,
+图标落在标签的 flex 行上,按图标库的默认尺寸渲染。同一种失误还以相反方向大
+面积存在:约 48 处 `Menu.Item`/`ContextMenu.Item`/`Menubar` 调用方把 lucide
+图标通过 `icon` prop 传进去却没给尺寸,于是在槽位固定的 16px 盒子里画出
+24px;还有若干单选选择器在标签里手绘对勾,而没有用 `Menu.RadioItem`。这些行
+现在使用原语定义的槽位(`icon`、`endContent`、`tone`、`indicator`/
+`indicatorSide`),手绘对勾的选择器都改成了真正的 radio 行;`icon` prop 本身
+也改为直接收图标*组件*(`icon={Check}`):由盒子以 100% 填充 class 实例化,
+漏写尺寸从此不会静默溢出。元素形式(`icon={<Check />}`)只留给需要自带
+props 的字形(`Spinner` 的 `size`/`label`、调过的 `strokeWidth`),并保持其
+声明的尺寸。刻意做成复合布局的行(头像、多列项目条目)保留自定义
+children。
+
+## 证据
+
+- `Menu.Item` 的 children 被包进 `itemText`,即标签的单行 flex 容器
+  (`packages/ui/src/popup/surface.ts`、`row-label.tsx`)。lucide 图标作为元
+  素子节点按自身的 `width`/`height` 属性(24px)渲染,而标签约 13px。截图证
+  据:PR 信息栏合并下拉里的对勾明显大于行高(`pr-merge-button.tsx`)。
+- `icon` prop 把图标放进 `itemIcon`,一个固定 16px 的盒子,但盒子约束不了子
+  元素(StyleX 没有后代选择器,所以 `@lody/ui` 明文要求调用方的字形「声明为
+  100%」)。`<svg width="24">` 作为 flex 子项无法缩到固有尺寸以下,因此每一
+  个没写尺寸的 `icon={<X />}` 都是 24px 居中溢出 16px 槽位 —— 约 48 处,大
+  多数来自 #999(「把侧边栏右键菜单图标收进 icon 盒」)迁移时把图标移进了
+  `icon=`,却保留了原本没写尺寸的元素。
+- 手绘选中标记在重复 `Menu.RadioItem` 已提供的预留指示框:
+  `mobile-account-settings`(member/admin)、`acp-session-select`、
+  `workdir-mode-selector`、会话头部菜单的 IDE 启动器选择器(两处)、owner
+  选择器、`organization-switcher` 以及 `unified-project-selector` 的项目
+  行。每个都在手写 `<Check>` —— 有尺寸,看起
+  来没问题,但距离这次一模一样的 bug 只差忘写一个 size class —— 而且全部上
+  报的是 `role="menuitem"` 而不是 `menuitemradio`。
+- 另有约 30 行(集中在 `session-chat-interface.tsx` 的会话头部菜单)把尺寸正
+  确的 lucide 图标塞在 children 里,手工重造了槽位:尺寸(`h-3.5`、`h-4`)
+  和颜色(`text-muted-foreground` 或继承标签色)各不一致,而不是槽位统一的
+  盒子和 hint 色;删除行也用 `text-destructive` class 绕过了
+  `tone="destructive"`。
+
+## 决策
+
+- `pr-merge-button.tsx` 用真正的 `Menu.RadioGroup` + `Menu.RadioItem
+indicator="check"` 渲染合并方式选择 —— 与 `PrPrimaryAction` 的合并方式菜单
+  同一套词汇。
+- `MenuRowProps.icon` 放宽为 `ReactNode | ElementType<{ className?: string }>`。
+  传组件时由 `itemIcon` 通过 `createElement` 挂上 `surface.itemIconGlyph`
+  (`width/height: 100%`)实例化 —— class 压过 svg 的 px 属性;传元素时原样
+  渲染,保留其声明的尺寸。所有 lucide 调用点都改成了组件形式
+  (`icon={Check}`);元素形式只剩需要自带 props 的字形
+  (`<Spinner size="small" label={null}/>`、调过的 `strokeWidth`、按行传参的
+  `SidePanelTabIcon tab={panel}`)—— 对 lucide 依旧意味着 `size="100%"`。
+- 手绘对勾的选择器改为 `Menu.RadioGroup` + `Menu.RadioItem`;leading 槽位放
+  身份标记的行(头像、启动器品牌图标)用 `indicatorSide="end"` —— 正是这个
+  API 存在的场景。
+- 普通 leading 图标的行把图标移进 `icon=`,末尾标记(复制提示、状态文本、
+  popover 信息按钮、`Switch`)移进 `endContent`,删除行改用
+  `tone="destructive"`。
+- 尺寸默认值归原语而非调用方:组件形式让「填满盒子」无漏可写 —— 盒子实例化
+  字形时自己喂填充 class。起初试过给裸图标元素 `cloneElement` 注入 style 兜底,
+  后来放弃:在调用方的元素背后塞 props 是猜谜(Fragment、吞掉 `style` 的组件),
+  而组件形式把所有权摆到了明面上。
+- 保持原样:确为复合布局的行(`recent-run-config-menu-group`、
+  `settings-line-tabs`、`organization-switcher` 的头像行、居中的「+」创建
+  角色行、`desktop-run-config-menu` 里禁用的 agent 值行)—— `itemText`
+  本来就允许放调用方的标记,且这些都已写好尺寸。
+
+## 已考虑的替代方案
+
+- **用 `cloneElement` 给裸图标元素注入填充 style**:试过又放弃 —— 它在调用方
+  元素背后改 props,对 Fragment 和吞掉 `style` 的组件无能为力,而且依然把「尺
+  寸归谁管」答成「没人」。组件形式直接回答了这个问题:盒子负责尺寸,因为字形
+  由盒子创建。
+- **对 `itemIcon` 里所有字形强制 100%**:元素形式仍尊重已声明的尺寸 —— 盒子
+  里本就刻意放着非 100% 的字形(调过 `strokeWidth` 的图标、居中放在 16px 盒
+  里的较小标记)。
+- **用一条全局 CSS 规则给字形盒里的 `svg` 定尺寸**:StyleX 没有后代选择器,
+  且包设计上不发全局样式。
+- **只修可见的坏行、保留有尺寸的 children**:超大对勾是唯一肉眼可见的坏行,
+  但约 48 处未写尺寸的 `icon=` 以同样方式溢出,每个手绘对勾都只差一个漏写的
+  class。收敛到槽位 API 才是持久的修法,也让选择器获得正确的
+  `menuitemradio` 语义。
+
+## 验证限度
+
+- `vitest` 的 `session-header-menu` 与 `session-info-context-actions`:
+  16/16 通过,包含改成 radio 的启动器与合并方式选择器(选择器已更新为
+  `menuitemradio`)。`tsgo` 对改动文件无报错(嫁接自同仓另一检出的
+  `node_modules` 产生了与本次无关的缺包噪音)。
+- Storybook + Playwright 目验:逐个打开菜单并量测字形 —— 合并方式拆分按钮、
+  会话头部菜单(IDE/owner radio 子菜单)、项目选择器、附件菜单、workdir 选择
+  器、文件操作、侧栏面板 tab 条、composer run config、侧栏帮助菜单、workspace
+  选择器、移动端角色选择器,以及会话/工作树/置顶右键菜单,全部 ≤18px 且语义
+  为 `menuitemradio`。这次目验抓到了源码扫描漏掉的一类:`icon` prop 里的*三
+  元表达式*图标(`<PinOff/>/<Pin/>`、`<Users/>/<Spinner/>/<LockKeyhole/>`、
+  `<Pause/>/<RotateCcw/>`,分布在六个 sidebar/task/schedule 列表文件,修复前
+  量到 16x24,修复后 16x16)。菜单之外的 Field/Badge/ActionCard `icon=` 未动。
+- `Select`/`Combobox` 行和非菜单 popover 未审计;本次扫描只覆盖
+  `Menu`/`ContextMenu`/`Menubar` 的行部件。fork-destination 的 story 触发器在
+  Storybook 里打不开菜单(story 自身的受控/非受控警告,与本次无关,且受控
+  `open` 测试已覆盖)。
```

**File**: `packages/components/src/components/chat/attachment-add-menu.tsx` (modified, +28/-26)
```diff
@@ -69,7 +69,6 @@ export function AttachmentAddMenu({
 
   const triggerSize = !isLanding && isMobile ? 'size-9' : 'size-7';
   const itemClass = cn('cursor-pointer', isMobile && 'gap-2.5 py-2.5 text-[15px]');
-  const iconClass = 'size-4 shrink-0 text-muted-foreground';
   const selectedCount = mcp
     ? mcp.selectedIds.filter((id) => mcpServers.some((server) => server.id === id)).length
     : 0;
@@ -88,22 +87,26 @@ export function AttachmentAddMenu({
         if (!nextOpen) setView('root');
       }}
     >
-      <Menu.Trigger render={<Button
-          type="button"
-          variant="ghost"
-          icon
-          disabled={disabled}
-          aria-label={triggerLabel}
-          className={cn(
-            triggerSize,
-            // Light-stroke "+" with a circular hover/open fill. `bg-hover` (not
-            // `bg-accent`/`bg-muted`) because those equal the background in the
-            // dark theme and paint nothing.
-            'data-[state=open]:bg-hover data-[state=open]:text-foreground'
-          )}
-        >
-          <Plus strokeWidth={1.5} className={isMobile ? 'size-6' : 'size-4'} />
-        </Button>}>
+      <Menu.Trigger
+        render={
+          <Button
+            type="button"
+            variant="ghost"
+            icon
+            disabled={disabled}
+            aria-label={triggerLabel}
+            className={cn(
+              triggerSize,
+              // Light-stroke "+" with a circular hover/open fill. `bg-hover` (not
+              // `bg-accent`/`bg-muted`) because those equal the background in the
+              // dark theme and paint nothing.
+              'data-[state=open]:bg-hover data-[state=open]:text-foreground'
+            )}
+          >
+            <Plus strokeWidth={1.5} className={isMobile ? 'size-6' : 'size-4'} />
+          </Button>
+        }
+      >
         <Button
           type="button"
           variant="ghost"
@@ -139,11 +142,11 @@ export function AttachmentAddMenu({
           // from the right, the root returns from the left.
           <div key="mcp" className="animate-in fade-in-0 slide-in-from-right-2 duration-150">
             <Menu.Item
-              className={cn(itemClass, 'gap-2 font-medium')}
+              className={cn(itemClass, 'font-medium')}
               closeOnClick={false}
               onClick={() => setView('root')}
+              icon={ChevronLeft}
             >
-              <ChevronLeft className={iconClass} />
               {t('session.mcp.title')}
             </Menu.Item>
             <Menu.Separator />
@@ -156,8 +159,8 @@ export function AttachmentAddMenu({
                 onClick={onAddAttachment}
                 disabled={attachmentDisabled}
                 className={itemClass}
+                icon={Paperclip}
               >
-                <Paperclip className={iconClass} />
                 {triggerLabel}
               </Menu.Item>
             ) : null}
@@ -170,16 +173,15 @@ export function AttachmentAddMenu({
                     disabled={mcp.disabled}
                     closeOnClick={false}
                     onClick={() => setView('mcp')}
+                    icon={Plug}
+                    endContent={<ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                   >
-                    <Plug className={iconClass} />
-                    <span className="min-w-0 flex-1 truncate">{mcpLabel}</span>
-                    <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
+                    {mcpLabel}
                   </Menu.Item>
                 ) : (
                   <Menu.Submenu>
-                    <Menu.SubmenuTrigger className={itemClass} disabled={mcp.disabled}>
-                      <Plug className={iconClass} />
-                      <span className="min-w-0 flex-1 truncate">{mcpLabel}</span>
+                    <Menu.SubmenuTrigger className={itemClass} disabled={mcp.disabled} icon={Plug}>
+                      {mcpLabel}
                     </Menu.SubmenuTrigger>
                     <Menu.Content className="w-[min(20rem,calc(100vw-2rem))]">
                       <McpServerItems mcp={mcp} isMobile={isMobile} />
```

**File**: `packages/components/src/components/chat/unified-project-selector.tsx` (modified, +63/-63)
```diff
@@ -2,7 +2,6 @@ import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
 import type { LocalProjectId, MachineId } from '@lody/shared';
 import {
   ArrowUpRight,
-  Check,
   ChevronDown,
   CircleSlash2,
   FolderOpen,
@@ -273,9 +272,7 @@ function ProjectAccessStatus({
   const isAction = variant === 'trigger' && Boolean(onShare);
   const sharedClassName = cn(
     'inline-flex shrink-0 select-none items-center gap-1 text-muted-foreground',
-    variant === 'trigger' && [
-      'h-6 rounded-r-md px-2 text-[0.8em] font-medium transition-colors',
-    ],
+    variant === 'trigger' && ['h-6 rounded-r-md px-2 text-[0.8em] font-medium transition-colors'],
     variant === 'option' && 'text-[0.8em] font-medium',
     'text-foreground/75',
     isAction && 'cursor-pointer hover:text-foreground',
@@ -606,77 +603,80 @@ export function UnifiedProjectSelectorView({
           />
           <div className="scrollbar-pro max-h-[min(50vh,13rem)] overflow-y-auto">
             {filteredOptions.length > 0 ? (
-              filteredOptions.map((option) => {
-                // Local projects show only the name; the path lives in a hover
-                // tooltip. GitHub repos keep their inline description line.
-                const localPath =
-                  option.selection.kind === 'local' ? option.description : undefined;
-                const inlineDescription =
-                  option.selection.kind === 'github' ? option.description : undefined;
-                const labelNode = (
-                  <span className={cn('truncate', option.value === selectedValue && 'font-medium')}>
-                    {option.label}
-                  </span>
-                );
-                return (
-                  <Menu.Item
-                    key={option.value}
-                    onClick={() => onChange(option.selection)}
-                    className={cn(
-                      'gap-2 py-1.5',
-                      inlineDescription ? 'items-start' : 'items-center'
-                    )}
-                  >
-                    <span className={cn('shrink-0', inlineDescription && 'mt-0.5')}>
-                      {option.icon}
+              <Menu.RadioGroup
+                value={selectedValue ?? ''}
+                onValueChange={(value) => {
+                  const target = filteredOptions.find((option) => option.value === value);
+                  if (target) onChange(target.selection);
+                }}
+              >
+                {filteredOptions.map((option) => {
+                  // Local projects show only the name; the path lives in a hover
+                  // tooltip. GitHub repos keep their inline description line.
+                  const localPath =
+                    option.selection.kind === 'local' ? option.description : undefined;
+                  const inlineDescription =
+                    option.selection.kind === 'github' ? option.description : undefined;
+                  const labelNode = (
+                    <span
+                      className={cn('truncate', option.value === selectedValue && 'font-medium')}
+                    >
+                      {option.label}
                     </span>
-                    <span className="flex min-w-0 flex-1 flex-col">
-                      {localPath ? (
-                        <Tooltip.Root>
-                          <Tooltip.Trigger render={labelNode} />
-                          <Tooltip.Content side="right" className="max-w-[22rem] break-all">
-                            {localPath}
-                          </Tooltip.Content>
-                        </Tooltip.Root>
-                      ) : (
-                        labelNode
+                  );
+                  return (
+                    <Menu.RadioItem
+                      key={option.value}
+                      value={option.value}
+                      indicator="check"
+                      indicatorSide="end"
+                      className={cn(
+                        'gap-2 py-1.5',
+                        inlineDescription ? 'items-start' : 'items-center'
                       )}
-                      {inlineDescription ? (
-                        <span className="line-clamp-2 text-[0.8em] leading-snug text-muted-foreground">
-                          {inlineDescription}
-                        </span>
+                    >
+                      <span className={cn('shrink-0', inlineDescription && 'mt-0.5')}>
+                        {option.icon}
+                      </span>
+                      <span className="flex min-w-0 flex-1 flex-col">
+                        {localPath ? (
+                          <Tooltip.Root>
+                            <Tooltip.Trigger render={labelNode} />
+                            <Tooltip.Content side="right" className="max-w-[22rem] break-all">
+                              {localPath}
+                            </Tooltip.Content>
+       
```

**File**: `packages/components/src/components/loro-app-sidebar.tsx` (modified, +12/-12)
```diff
@@ -831,7 +831,7 @@ const LocalProjectSessionItem = memo(function LocalProjectSessionItem({
         />
         {canTogglePinned ? (
           <ContextMenu.Item
-            icon={isPinned ? <PinOff /> : <Pin />}
+            icon={isPinned ? PinOff : Pin}
             onClick={() => {
               onTogglePinned?.(session.id, !isPinned);
             }}
@@ -841,7 +841,7 @@ const LocalProjectSessionItem = memo(function LocalProjectSessionItem({
         ) : null}
         {canMarkUnread ? (
           <ContextMenu.Item
-            icon={<Mail />}
+            icon={Mail}
             onClick={() => {
               onMarkUnread?.(session.id);
             }}
@@ -850,7 +850,7 @@ const LocalProjectSessionItem = memo(function LocalProjectSessionItem({
           </ContextMenu.Item>
         ) : null}
         {canRename ? (
-          <ContextMenu.Item icon={<Pencil />} onClick={beginRename}>
+          <ContextMenu.Item icon={Pencil} onClick={beginRename}>
             {contextMenuLabels.rename}
           </ContextMenu.Item>
         ) : null}
@@ -860,7 +860,7 @@ const LocalProjectSessionItem = memo(function LocalProjectSessionItem({
         ) : null}
         {canCopyUrl ? (
           <ContextMenu.Item
-            icon={<Link2 />}
+            icon={Link2}
             onClick={() => {
               onCopyUrl?.(session.id);
             }}
@@ -874,11 +874,11 @@ const LocalProjectSessionItem = memo(function LocalProjectSessionItem({
             disabled={shareMenuState !== 'share'}
             icon={
               shareMenuState === 'share' ? (
-                <Users />
+                Users
               ) : shareMenuState === 'loading' ? (
-                <Spinner />
+                <Spinner size="small" label={null} />
               ) : (
-                <LockKeyhole />
+                LockKeyhole
               )
             }
             onClick={() => {
@@ -925,7 +925,7 @@ const LocalProjectSessionItem = memo(function LocalProjectSessionItem({
           <ContextMenu.Separator />
         ) : null}
         <ContextMenu.Item
-          icon={<Archive />}
+          icon={Archive}
           onClick={() => {
             onArchive(session.id);
           }}
@@ -1445,7 +1445,7 @@ export const LocalProjectItem = memo(function LocalProjectItem({
             <ContextMenu.Content className="min-w-[180px]">
               {onOpenProjectSettings ? (
                 <ContextMenu.Item
-                  icon={<Settings2 />}
+                  icon={Settings2}
                   onClick={() => {
                     onOpenProjectSettings(machineId, project.id);
                   }}
@@ -1455,7 +1455,7 @@ export const LocalProjectItem = memo(function LocalProjectItem({
               ) : null}
               {revealPath ? (
                 <ContextMenu.Item
-                  icon={<FolderOpen />}
+                  icon={FolderOpen}
                   onClick={() => {
                     onRevealProject?.(revealPath);
                   }}
@@ -1466,7 +1466,7 @@ export const LocalProjectItem = memo(function LocalProjectItem({
               {onArchiveProjectChats ? (
                 <ContextMenu.Item
                   disabled={archivableSessionIds.length === 0}
-                  icon={<Archive />}
+                  icon={Archive}
                   onClick={() => {
                     onArchiveProjectChats(archivableSessionIds);
                   }}
@@ -1480,7 +1480,7 @@ export const LocalProjectItem = memo(function LocalProjectItem({
               ) : null}
               {canRemoveProject ? (
                 <ContextMenu.Item
-                  icon={<Trash2 />}
+                  icon={Trash2}
                   onClick={() => {
                     onRequestRemoval({
                       machineId,
```

**File**: `packages/components/src/components/loro-sidebar.tsx` (modified, +9/-26)
```diff
@@ -1093,7 +1093,7 @@ export const LoroSidebar = memo(function LoroSidebar({
                                   <ContextMenu.Trigger render={<div {...props} />} />
                                   <ContextMenu.Content>
                                     <ContextMenu.Item
-                                      icon={<AppWindow />}
+                                      icon={AppWindow}
                                       onClick={() => {
                                         openDesktopWindow(undefined, workspaceSlug, 'context_menu');
                                       }}
@@ -1171,25 +1171,13 @@ export const LoroSidebar = memo(function LoroSidebar({
 
           {/* Icon boxes match the radio rows' avatars, so both row kinds
               share one leading column and one text column. */}
-          <Menu.Item
-            className="gap-1.5"
-            icon={<Plus className="h-4 w-4" />}
-            onClick={() => onCreateWorkspaceClicked?.()}
-          >
+          <Menu.Item className="gap-1.5" icon={Plus} onClick={() => onCreateWorkspaceClicked?.()}>
             {mergedLabels.createWorkspace}
           </Menu.Item>
-          <Menu.Item
-            className="gap-1.5"
-            icon={<Users className="h-4 w-4" />}
-            onClick={() => onInviteClicked?.()}
-          >
+          <Menu.Item className="gap-1.5" icon={Users} onClick={() => onInviteClicked?.()}>
             {mergedLabels.inviteMembers}
           </Menu.Item>
-          <Menu.Item
-            className="gap-1.5"
-            icon={<Link2 className="h-4 w-4" />}
-            onClick={() => onLinkRepoClicked?.()}
-          >
+          <Menu.Item className="gap-1.5" icon={Link2} onClick={() => onLinkRepoClicked?.()}>
             {mergedLabels.connectGithubRepo}
           </Menu.Item>
         </Menu.Content>
@@ -1559,24 +1547,19 @@ export const LoroSidebar = memo(function LoroSidebar({
                 }
               />
               <Menu.Content side="top" align="end" className="min-w-[160px]">
-                <Menu.Item onClick={() => onDocsClicked?.()}>
-                  <BookOpen className="h-4 w-4" />
+                <Menu.Item icon={BookOpen} onClick={() => onDocsClicked?.()}>
                   {mergedLabels.docs}
                 </Menu.Item>
-                <Menu.Item onClick={() => onGithubClicked?.()}>
-                  <Github className="h-4 w-4" />
+                <Menu.Item icon={Github} onClick={() => onGithubClicked?.()}>
                   {t('sidebar.github', 'GitHub')}
                 </Menu.Item>
-                <Menu.Item onClick={() => onJoinCommunityClicked?.()}>
-                  <Users className="h-4 w-4" />
+                <Menu.Item icon={Users} onClick={() => onJoinCommunityClicked?.()}>
                   {mergedLabels.joinCommunity}
                 </Menu.Item>
-                <Menu.Item onClick={() => onFeedbackClicked?.()}>
-                  <MessageSquareMore className="h-4 w-4" />
+                <Menu.Item icon={MessageSquareMore} onClick={() => onFeedbackClicked?.()}>
                   {mergedLabels.feedback}
                 </Menu.Item>
-                <Menu.Item onClick={() => onBugReportClicked?.()}>
-                  <Bug className="h-4 w-4" />
+                <Menu.Item icon={Bug} onClick={() => onBugReportClicked?.()}>
                   {mergedLabels.bugReport}
                 </Menu.Item>
               </Menu.Content>
```

**File**: `packages/components/src/components/mobile/mobile-account-settings.tsx` (modified, +13/-25)
```diff
@@ -9,7 +9,6 @@ import {
   Copy,
   Trash2,
   ChevronDown,
-  Check,
   LogOut,
   KeyRound,
   Pencil,
@@ -556,32 +555,21 @@ export function MobileAccountSettings({
                         <ChevronDown className="h-3 w-3 opacity-50" />
                       </Menu.Trigger>
                       <Menu.Content align="end">
-                        <Menu.Item
-                          onClick={() => {
-                            void onUpdateRole(member, 'member');
+                        <Menu.RadioGroup
+                          value={member.role}
+                          onValueChange={(role) => {
+                            if (role === 'member' || role === 'admin') {
+                              void onUpdateRole(member, role);
+                            }
                           }}
                         >
-                          <Check
-                            className={cn(
-                              'mr-2 h-3.5 w-3.5',
-                              member.role === 'member' ? 'opacity-100' : 'opacity-0'
-                            )}
-                          />
-                          {t('organization.role.member')}
-                        </Menu.Item>
-                        <Menu.Item
-                          onClick={() => {
-                            void onUpdateRole(member, 'admin');
-                          }}
-                        >
-                          <Check
-                            className={cn(
-                              'mr-2 h-3.5 w-3.5',
-                              member.role === 'admin' ? 'opacity-100' : 'opacity-0'
-                            )}
-                          />
-                          {t('organization.role.admin')}
-                        </Menu.Item>
+                          <Menu.RadioItem value="member" indicator="check">
+                            {t('organization.role.member')}
+                          </Menu.RadioItem>
+                          <Menu.RadioItem value="admin" indicator="check">
+                            {t('organization.role.admin')}
+                          </Menu.RadioItem>
+                        </Menu.RadioGroup>
                       </Menu.Content>
                     </Menu.Root>
                   ) : (
```

**File**: `packages/components/src/components/organization-switcher.tsx` (modified, +37/-38)
```diff
@@ -1,5 +1,5 @@
 import { useMemo, useState } from 'react';
-import { Check, ChevronsUpDown, Plus, Building2, LogOut } from 'lucide-react';
+import { ChevronsUpDown, Plus, Building2, LogOut } from 'lucide-react';
 import { cloudOperations } from '@/lib/cloud-api-operations';
 import { useCloudQuery } from '@lody/platform/react';
 import { useOrganization } from '../hooks/useOrganization';
@@ -209,57 +209,56 @@ function CloudOrganizationSwitcher() {
           <Menu.Content align="start" className="w-[250px]">
             <Menu.GroupLabel>{t('organization.workspaces')}</Menu.GroupLabel>
             <Menu.Separator />
-            {organizations.map((org) => (
-              <Menu.Item
-                key={org.id}
-                onClick={() => {
-                  void switchOrganization(org.id);
-                  setOpen(false);
-                  if (org.slug) {
-                    void navigate({
-                      to: '/$workspaceName/chat',
-                      params: { workspaceName: org.slug },
-                    });
-                  }
-                }}
-              >
-                <div className="flex items-center justify-between w-full">
-                  <div className="flex min-w-0 items-center gap-2">
-                    <WorkspaceAvatar
-                      workspace={{ name: org.name, logo: org.logo }}
-                      size="medium"
-                      className="shrink-0"
-                    />
-                    <span className="truncate text-sm">{org.name}</span>
-                    {planTierByWorkspaceId.has(org.id) ? (
-                      <Badge>
-                        {planTierByWorkspaceId.get(org.id) === 'enterprise'
-                          ? t('billing.plan.enterprise')
-                          : t('billing.plan.plus')}
-                      </Badge>
-                    ) : null}
-                  </div>
-                  {org.id === activeOrganization.id && <Check className="h-4 w-4 shrink-0" />}
-                </div>
-              </Menu.Item>
-            ))}
+            <Menu.RadioGroup
+              value={activeOrganization.id}
+              onValueChange={(orgId) => {
+                const org = organizations.find((candidate) => candidate.id === orgId);
+                if (!org) return;
+                void switchOrganization(org.id);
+                setOpen(false);
+                if (org.slug) {
+                  void navigate({
+                    to: '/$workspaceName/chat',
+                    params: { workspaceName: org.slug },
+                  });
+                }
+              }}
+            >
+              {organizations.map((org) => (
+                <Menu.RadioItem key={org.id} value={org.id} indicator="check" indicatorSide="end">
+                  <WorkspaceAvatar
+                    workspace={{ name: org.name, logo: org.logo }}
+                    size="medium"
+                    className="shrink-0"
+                  />
+                  {org.name}
+                  {planTierByWorkspaceId.has(org.id) ? (
+                    <Badge>
+                      {planTierByWorkspaceId.get(org.id) === 'enterprise'
+                        ? t('billing.plan.enterprise')
+                        : t('billing.plan.plus')}
+                    </Badge>
+                  ) : null}
+                </Menu.RadioItem>
+              ))}
+            </Menu.RadioGroup>
             <Menu.Item
+              icon={Plus}
               onClick={() => {
                 setDialogOpen(true);
                 setOpen(false);
               }}
             >
-              <Plus className="mr-2 h-4 w-4" />
               {t('organization.createNew')}
             </Menu.Item>
             <Menu.Separator />
             <Menu.Item
+              tone="destructive"
+              icon={LogOut}
               onClick={() => {
                 void signOut();
               }}
-              className="text-destructive focus:text-destructive"
             >
-              <LogOut className="mr-2 h-4 w-4" />
               {t('organization.signOut')}
             </Menu.Item>
           </Menu.Content>
```

---

### Incident Patch 11: `9bdac285` (2026-10-03)
**Commit Message**: fix: respect mobile safe area in schedule editor (#1234)

Model: gpt-6

**File**: `packages/components/src/components/schedules/schedules-workspace.tsx` (modified, +14/-1)
```diff
@@ -3,6 +3,7 @@ import { AlertDialog } from '@/ui/dialog';
 import { useIsMobile } from '@/hooks/use-mobile';
 import { useCommand } from '@/lib/commands';
 import { useEffect, useMemo, useState } from 'react';
+import * as stylex from '@stylexjs/stylex';
 import { useAtom, useAtomValue } from 'jotai';
 import { toast } from '@/lib/toast';
 import { useNavigate } from '@tanstack/react-router';
@@ -67,6 +68,18 @@ import { FieldIssueMark } from './schedule-field-issue-mark';
 import { pickScheduleAgent, seedScheduleAgentRunRef } from './schedule-agent-defaults';
 import { readChatLandingDefaults } from '@/lib/chat-landing-defaults';
 
+const styles = stylex.create({
+  mobileDetail: {
+    display: 'flex',
+    flexDirection: 'column',
+    boxSizing: 'border-box',
+    height: '100%',
+    minHeight: 0,
+    // Mobile detail owns its top edge; desktop insets belong to the workspace shell.
+    paddingTop: 'var(--safe-area-top, 0px)',
+  },
+});
+
 export function SchedulesWorkspace({ scheduleId }: { scheduleId?: string }) {
   const { t } = useTranslation();
   const activeRuntime = useAtomValue(activeWorkspaceRuntimeAtom);
@@ -375,7 +388,7 @@ export function SchedulesWorkspace({ scheduleId }: { scheduleId?: string }) {
       ) : null}
       <div className="min-h-0 flex-1">
         {mobile && scheduleId ? (
-          <div className="flex h-full min-h-0 flex-col">{detailPane}</div>
+          <div {...stylex.props(styles.mobileDetail)}>{detailPane}</div>
         ) : (
           list
         )}
```

---

### Incident Patch 12: `4b4d9124` (2026-10-03)
**Commit Message**: fix(cli): restart daemon from verified upgrade installation (#1228)

* fix(cli): restart daemon from verified upgrade installation

Model: gpt-6

* docs: link daemon upgrade decision to PR

Model: gpt-6

**File**: `.agents/notes/implemented/bug-fix/2026-10-03-daemon-upgrade-installation.md` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+# Bind daemon upgrade handoff to the verified installation
+
+Status: implemented
+Translation: current
+PR: https://github.com/LodyAI/Lody/pull/1228
+
+[中文](2026-10-03-daemon-upgrade-installation.zh.md)
+
+## Abstract
+
+Remote upgrade installed Lody globally but spawned its replacement watchdog from
+the old watchdog's argv. A daemon launched from an npx cache could repeatedly
+install successfully while continuing to run the old version. The installer now
+returns an explicit, executable-version-checked entry from the installing npm's
+global root, and handoff requires matching-version readiness. External autostart
+definitions still require a one-time correction; code downloaded by an old
+watchdog cannot retroactively change that watchdog's handoff behavior.
+
+## Decision and scope
+
+Resolve `npm root -g` through the same npm environment used by the global install.
+Read the installed package's declared bin instead of assuming its bundle layout,
+check package identity and exact requested version (or the concrete installed
+version for `latest`), constrain the resolved entry to the package, and execute
+that entry's `--version` before releasing the old Host lease. A PATH lookup for
+`lody` was rejected because inherited npx or alternate Node-installation paths
+can still select the old package.
+
+```text
+npm install -g -> npm root -g -> package/bin and executable version verification
+  -> release old Host -> spawn explicit installed entry -> matching-version ready
+```
+
+Ordinary launch behavior keeps its existing argv and legacy-ready compatibility.
+Upgrade handoff carries the verified entry/version across the termination boundary.
+Missing or incorrect readiness versions use the existing exact-child cleanup and
+ownership-aware recovery, without logging upgrade success. An older target without
+versioned readiness needs an explicit local restart. Recovery does not restore
+package files overwritten by npm.
+
+This complements the [Windows npm shim fix](2026-09-08-windows-daemon-upgrade.md),
+which addressed command execution, not destination selection. The new
+[draft contract](../../../../specs/daemon-upgrade-installation.md) and
+[CLI recovery instructions](../../../../apps/cli/README.md#daemon-upgrades-and-autostart)
+describe current behavior. User-owned startup scripts are not rewritten or scanned;
+Windows and WSL installations must be repaired separately.
+
+## Verification and limits
+
+Synthetic npm shims and real Node child processes cover install success/failure,
+global roots containing spaces, old npx argv, exact-version rejection, missing or
+escaping bins, executable-version mismatch, failed root lookup, cancellation,
+preserved arguments, and versioned readiness. Tests invoke no registry or real
+global installer. Real npm replacement and Windows/WSL device acceptance remain
+unverified; successful local tests do not establish those deployment guarantees.
+
+The four targeted suites pass (36 tests). Repository typechecking, lint, formatting,
+i18n/import/platform/public-boundary checks, and `pnpm run docs check` pass.
+`pnpm check` stops at the unmodified `workspace-git-service.test.ts` GitHub-remote
+backfill assertion (CLI: 3490 passed, one failed, four skipped); that failure also
+reproduces when the suite runs alone. The remaining full-workspace tests are not
+claimed as passed.
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-03-daemon-upgrade-installation.zh.md` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+# 将 daemon 升级交接绑定到已验证的安装位置
+
+Status: implemented
+Translation: current
+PR: https://github.com/LodyAI/Lody/pull/1228
+
+[English](2026-10-03-daemon-upgrade-installation.md)
+
+## 摘要
+
+远端升级原先全局安装 Lody，却通过旧 watchdog 的 argv 启动替代 watchdog。
+从 npx 缓存启动的 daemon 因此可能反复安装成功，却一直运行旧版。现在安装器
+从执行安装的 npm 全局目录返回明确入口，验证入口实际版本，并要求交接后的
+就绪回执版本一致。外部自启动定义仍需修正一次；旧 watchdog 下载新版代码
+不能追溯改变其自身的交接行为。
+
+## 决策与范围
+
+通过执行全局安装的同一 npm 环境运行 `npm root -g`。读取安装包声明的 bin，
+不假设打包布局；校验包身份与指定精确版本（`latest` 则取实际安装版本），
+约束解析入口位于包内，并在释放旧 Host 租约前执行该入口的 `--version`。
+不采用 PATH 查找 `lody`，因为继承的 npx 或其他 Node 安装路径仍可能选中旧包。
+
+```text
+npm install -g -> npm root -g -> 校验 package/bin 及实际入口版本
+  -> 释放旧 Host -> 启动明确的安装入口 -> 收到版本一致的就绪回执
+```
+
+普通启动继续使用现有 argv，并兼容旧版就绪回执。升级交接将验证后的入口与版本
+跨终止边界传递。回执版本缺失或不一致时，沿用针对本次子进程的清理及遵守所有权
+的恢复流程，不记录升级成功。不支持版本化回执的旧目标需要明确执行本地重启。
+恢复不会还原 npm 已覆盖的包文件。
+
+本修复补充了 [Windows npm shim 修复](2026-09-08-windows-daemon-upgrade.zh.md)：
+后者解决命令执行，并未解决目标位置选择。新的
+[草案契约](../../../../specs/daemon-upgrade-installation.zh.md)与
+[CLI 恢复说明](../../../../apps/cli/README.md#daemon-upgrades-and-autostart)
+描述当前行为。不会扫描或改写用户维护的自启动脚本；Windows 与 WSL 的安装
+需要分别修复。
+
+## 验证与限制
+
+合成 npm shim 和真实 Node 子进程覆盖安装成功/失败、含空格全局目录、旧 npx
+argv、精确版本拒绝、缺失或越界入口、入口版本不匹配、全局目录查询失败、取消、
+参数保留及版本化就绪回执。测试不访问 registry，也不执行真实全局安装。
+尚未验证真实 npm 文件替换和 Windows/WSL 实机行为；本地测试通过不代表这些
+部署保证已得到验证。
+
+四个相关测试套件通过，共 36 项。仓库类型检查、lint、格式化、i18n/import/
+platform/public-boundary 检查及 `pnpm run docs check` 通过。
+`pnpm check` 在未修改的 `workspace-git-service.test.ts` GitHub remote 回填
+断言处中断（CLI：3490 项通过、1 项失败、4 项跳过），该失败单独运行同一
+套件也能复现。不宣称其余全仓测试已通过。
```

**File**: `apps/cli/README.md` (modified, +32/-0)
```diff
@@ -14,6 +14,38 @@ Install the CLI package:
 npm install -g lody@next
 ```
 
+## Daemon upgrades and autostart
+
+Remote upgrades install globally using the daemon's npm environment, resolve the
+installed package's declared CLI entry via `npm root -g`, and verify its version.
+The watchdog launches that entry explicitly and only reports upgrade success after
+the replacement reaches ready with the same version. A successful npm install alone
+does not prove that the running daemon upgraded. Verification or handoff failure is
+logged as failure; the existing restart recovery remains available.
+
+Autostart scripts, scheduled tasks, and service definitions must invoke the stable
+global installation, not an absolute `_npx` cache entry or a version-specific store
+path. This repository does not generate or rewrite user-owned autostart scripts.
+If an existing daemon was launched from such a pinned path:
+
+1. In the same OS environment and user account as the daemon, install the desired
+   version globally. Windows and WSL have separate installations.
+2. Find the global prefix with `npm prefix -g`. On Windows the stable launcher is
+   `<prefix>\lody.cmd`; on Linux/WSL/macOS it is `<prefix>/bin/lody`.
+   Check that launcher's `--version` before using it. Use the same Node/npm
+   installation and preserve the script's environment and daemon arguments.
+3. Replace the old cache path in the autostart command with that absolute launcher.
+   In PowerShell invoke a quoted launcher with `&`. Ensure the task's PATH includes
+   the intended Node runtime; WSL tasks must use the launcher inside that distro.
+4. Use the verified launcher to run `daemon stop`, then `daemon start` with the
+   original options, and check `daemon status` and the startup log's CLI version.
+   Restart the watchdog too: restarting only its Worker leaves old upgrade code alive.
+
+An already-running old watchdog cannot acquire this fix merely by downloading it;
+the one-time launcher correction and restart are needed for that deployment.
+Older releases without versioned readiness cannot be verified by the new remote
+handoff and must be started explicitly if a rollback is required.
+
 ## Workspace discovery
 
 The cloud workspace CLI and Lody MCP share resource queries. Lists return 20 entries
```

**File**: `apps/cli/src/commands/AGENTS.md` (modified, +4/-0)
```diff
@@ -18,6 +18,10 @@ Command entrypoints, the daemon runner, and session dispatch from the CLI/MCP bo
 - Remote daemon restart/upgrade: after a bounded ACK attempt, even on delivery failure,
   accepted work asks `start.ts` to exit with the reserved lifecycle code; the watchdog
   upgrades/restarts after exit. See [ACK contract](../../../../specs/machine-lifecycle-ack.md).
+- Upgrade handoff must use the verified entry from the installing npm's global root,
+  never the old watchdog's argv or a PATH-resolved `lody`. Success requires the
+  replacement's ready report to match the installed version; ordinary launches
+  still accept legacy readiness. See [upgrade contract](../../../../specs/daemon-upgrade-installation.md).
 - `lody daemon start` resolves cloud authentication in the FOREGROUND process before spawning the
   detached runner (`daemon-auth-preflight.ts`): validate the cached credential, and on a
   missing/rejected one run the interactive device-authorization flow there. An unreachable backend
```

**File**: `apps/cli/src/commands/daemon-runner.ts` (modified, +12/-6)
```diff
@@ -45,6 +45,7 @@ import {
   EXIT_CODE_SUPERVISOR_CONTRACT_MISMATCH,
   LODY_DAEMON_SUPERVISED_ENV,
   runDaemonUpgradeFromIntent,
+  type DaemonUpgradeInstallation,
 } from '@/lib/machine-lifecycle';
 import {
   describeDaemonWorkerStartupFailure,
@@ -263,7 +264,7 @@ export const daemonRunnerCommand = new Command('daemon-runner')
     };
 
     let terminating = false;
-    let pendingUpgradeHandoff = false;
+    let pendingUpgradeHandoff: DaemonUpgradeInstallation | null = null;
     const finish = async (code: number) => {
       if (terminating) return;
       terminating = true;
@@ -280,19 +281,23 @@ export const daemonRunnerCommand = new Command('daemon-runner')
     // detached runner from the new install. Falling back to in-place restart
     // keeps the machine online when the replacement cannot claim ownership.
     async function performUpgradeHandoff(): Promise<void> {
-      pendingUpgradeHandoff = false;
+      const installation = pendingUpgradeHandoff;
+      if (!installation) return;
+      pendingUpgradeHandoff = null;
       logger.info('Handing the daemon watchdog off to the upgraded CLI...');
       try {
-        const handoff = await spawnDaemonRunnerAndAwaitReady(passthroughArgs);
+        const handoff = await spawnDaemonRunnerAndAwaitReady(passthroughArgs, { installation });
         if (handoff.status === 'ready') {
-          logger.info(`Upgraded daemon watchdog is running (PID ${handoff.pid}).`);
+          logger.info(
+            `Upgraded daemon watchdog ${installation.version} is running (PID ${handoff.pid}, entry ${installation.bin}).`
+          );
           // The replacement overwrote the PID record; the conditional
           // removePidFile inside finish() will leave it in place.
           await finish(0);
           return;
         }
         logger.error(
-          `Watchdog handoff failed (${handoff.status}); restarting on the current version.`
+          `Watchdog handoff failed (${handoff.status}${handoff.status === 'error' ? `: ${handoff.message}` : ''}); restarting on the current version.`
         );
       } catch (error) {
         logger.error(
@@ -388,7 +393,7 @@ export const daemonRunnerCommand = new Command('daemon-runner')
             // Stop cleanly so the Host lease is released, then hand the
             // watchdog role to the freshly installed CLI in onTerminal. This
             // is what upgrades the watchdog code itself, not just the Worker.
-            pendingUpgradeHandoff = true;
+            pendingUpgradeHandoff = upgraded;
             return { action: 'stop', message: 'Remote upgrade installed; handing off watchdog' };
           }
           logger.warn('Upgrade did not complete; respawning the current version.');
@@ -435,6 +440,7 @@ export const daemonRunnerCommand = new Command('daemon-runner')
             status: 'ready',
             pid: process.pid,
             instanceId: supervisorIdentity.instanceId,
+            cliVersion: version,
           });
         }
         if (state.phase === 'fatal') {
```

**File**: `apps/cli/src/commands/daemon-shared.test.ts` (modified, +41/-0)
```diff
@@ -74,6 +74,47 @@ describe('daemon PID ownership', () => {
 });
 
 describe('daemon runner launch cleanup', () => {
+  it.each(['1.2.2', undefined])(
+    'rejects and drains a replacement reporting version %s',
+    (cliVersion) => {
+      expect(
+        interpretDaemonRunnerLaunchOutcome(
+          {
+            status: 'ready',
+            pid: 999_000,
+            instanceId: 'replacement',
+            cliVersion,
+          },
+          999_000,
+          '1.2.3'
+        )
+      ).toEqual({
+        outcome: {
+          status: 'error',
+          runnerPid: 999_000,
+          message: `Daemon reported version ${cliVersion ?? 'unknown'}; expected 1.2.3`,
+        },
+        cancelRunner: true,
+      });
+    }
+  );
+
+  it('accepts legacy readiness for ordinary launches without an expected upgrade version', () => {
+    expect(
+      interpretDaemonRunnerLaunchOutcome(
+        {
+          status: 'ready',
+          pid: 999_000,
+          instanceId: 'legacy',
+        },
+        999_000
+      )
+    ).toEqual({
+      outcome: { status: 'ready', pid: 999_000, instanceId: 'legacy' },
+      cancelRunner: false,
+    });
+  });
+
   it('awaits a runner that reported startup failure before returning the error', () => {
     expect(
       interpretDaemonRunnerLaunchOutcome(
```

**File**: `apps/cli/src/commands/daemon-shared.ts` (modified, +20/-4)
```diff
@@ -128,6 +128,7 @@ const DaemonRunnerLaunchOutcomeSchema = z.discriminatedUnion('status', [
     status: z.literal('ready'),
     pid: z.number().int().positive(),
     instanceId: z.string().min(1),
+    cliVersion: z.string().min(1).optional(),
   }),
   z.object({
     status: z.literal('occupied'),
@@ -183,10 +184,21 @@ type DaemonRunnerWaitResult = {
 /** Translate the runner report and identify outcomes whose child must be awaited. */
 export function interpretDaemonRunnerLaunchOutcome(
   outcome: DaemonRunnerLaunchOutcome,
-  runnerPid: number
+  runnerPid: number,
+  expectedVersion?: string
 ): DaemonRunnerWaitResult {
   switch (outcome.status) {
     case 'ready':
+      if (expectedVersion !== undefined && outcome.cliVersion !== expectedVersion) {
+        return {
+          outcome: {
+            status: 'error',
+            runnerPid,
+            message: `Daemon reported version ${outcome.cliVersion ?? 'unknown'}; expected ${expectedVersion}`,
+          },
+          cancelRunner: true,
+        };
+      }
       return {
         outcome: { status: 'ready', pid: runnerPid, instanceId: outcome.instanceId },
         cancelRunner: false,
@@ -297,9 +309,9 @@ export async function terminateSpawnedDaemonRunner(
  */
 export async function spawnDaemonRunnerAndAwaitReady(
   passthroughArgs: string[],
-  options: { timeoutMs?: number } = {}
+  options: { timeoutMs?: number; installation?: { bin: string; version: string } } = {}
 ): Promise<SpawnDaemonRunnerResult> {
-  const bin = resolveLodyBin();
+  const bin = options.installation?.bin ?? resolveLodyBin();
   const env: NodeJS.ProcessEnv = {
     ...process.env,
     [DAEMON_RUNNER_READY_FD_ENV]: String(DAEMON_RUNNER_READY_FD),
@@ -376,7 +388,11 @@ export async function spawnDaemonRunnerAndAwaitReady(
         finish({ status: 'error', runnerPid, message: 'invalid readiness report' }, true);
         return;
       }
-      const interpreted = interpretDaemonRunnerLaunchOutcome(outcome.data, runnerPid);
+      const interpreted = interpretDaemonRunnerLaunchOutcome(
+        outcome.data,
+        runnerPid,
+        options.installation?.version
+      );
       finish(interpreted.outcome, interpreted.cancelRunner);
     });
     // EOF without a report means the runner exited before its Worker became ready.
```

**File**: `apps/cli/src/lib/README.md` (modified, +3/-1)
```diff
@@ -32,7 +32,9 @@ subdirectory; this file is the navigation index. Cross-module explanations live
   `runBridgeTransition`.
 - `machine-lifecycle.ts` — remote lifecycle verification and upgrade intents; runs the
   fixed npm install through `cross-spawn` so Windows `npm.cmd` shims use the command
-  interpreter. `../commands/daemon-runner.ts` owns restart and upgrade handoff.
+  interpreter. It resolves the installed package through that npm's global root
+  and verifies its entry/version. `../commands/daemon-runner.ts` owns restart and
+  handoff to that explicit entry, including matching-version readiness.
 - `cloud-cli-port.ts` — the sole official-build composition root for cloud clients,
   endpoint-derived adapters, and their lifecycle. `start.ts` validates
   identity/deployment configuration once and injects the resulting `CloudPort` through
```

---

### Incident Patch 13: `0ff39d29` (2026-10-03)
**Commit Message**: fix(cli): use HTTP/2 for Quick Tunnels [risk:medium] (#1226)

Model: gpt-6

**File**: `apps/cli/src/preview/README.md` (modified, +4/-0)
```diff
@@ -2,6 +2,10 @@
 
 ## Process ownership
 
+Quick Tunnels start with `--protocol http2`, using TCP for the connection from
+cloudflared to Cloudflare's edge. They do not attempt QUIC or negotiate a transport
+fallback. This setting does not select the browser-to-Cloudflare protocol.
+
 ```text
 CLI / QuickTunnelSession
   └─ cloudflared-worker.js (private IPC ownership)
```

**File**: `apps/cli/src/preview/cloudflared-native.test.ts` (modified, +2/-2)
```diff
@@ -102,10 +102,10 @@ describe('cloudflared process ownership', () => {
     expect(handle.origin).toBe('https://fixture-quick.trycloudflare.com');
     expect(handle.diagnostic()).toContain('connection=not registered');
     child.stderr.write(
-      `${JSON.stringify({ message: 'Registered tunnel connection', protocol: 'quic' })}\n`
+      `${JSON.stringify({ message: 'Registered tunnel connection', protocol: 'http2' })}\n`
     );
     await expect(handle.registered).resolves.toBeUndefined();
-    expect(handle.diagnostic()).toContain('connection=registered (quic)');
+    expect(handle.diagnostic()).toContain('connection=registered (http2)');
     child.log(
       'Unable to reach edge https://example.test/?token=secret',
       'error',
```

**File**: `apps/cli/src/preview/cloudflared-native.ts` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ export async function startCloudflaredNative(options: {
         '--metrics',
         '127.0.0.1:0',
         '--protocol',
-        'auto',
+        'http2',
         '--url',
         proxy.origin,
       ],
```

---

### Incident Patch 14: `6d19a97f` (2026-10-03)
**Commit Message**: fix: prefer five-hour usage in composer indicator (#1201)

**File**: `.agents/notes/implemented/bug-fix/2026-10-01-five-hour-usage-indicator.md` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+# Prefer five-hour subscription usage in the composer indicator
+
+Status: implemented
+Translation: current
+
+[中文](2026-10-01-five-hour-usage-indicator.zh.md)
+
+## Abstract
+
+The composer sorted subscription windows by descending duration for its popover,
+then reused the first window for its compact indicator. This always selected weekly
+usage when a five-hour window was also available. The indicator now selects the
+five-hour window explicitly, retaining the existing fallback and context priority.
+The popover continues to show every reported window in its existing order.
+
+## Decision
+
+This extends the [new-session usage display](2026-09-28-session-tab-rate-limit-ring.md)
+with independent window selection in `SessionUsagePopover`. Reversing the shared
+array's sort would also reorder the details, so the indicator instead finds the
+five-hour window before falling back to the first displayed window. Zero usage is
+a valid selection. Provider/model resolution and normalization remain with the
+existing helpers.
+
+The [display Spec](../../../../specs/session-usage-indicator.md) owns the intended
+behavior; the [session directory map](../../../../packages/components/src/components/sessions/README.md)
+links to it. The existing `QuotaOnly` Storybook case already supplies both windows.
+
+## Verification
+
+The two usage suites pass all 20 tests, covering both provider input orders, zero
+five-hour usage, accessible indicator text, preserved popover order, weekly-only
+fallback, and context priority after rerender. Both new cases failed before the fix.
+
+An independent clone with initialized submodules passes repository typechecks,
+lint, formatting, documentation checks, and boundary guards; Electron's 199 tests
+also pass. `pnpm check` still fails at `boot-shell.test.tsx`'s storage-unavailable
+case (1 failure, 4,592 component tests passing); restoring the original usage
+component reproduces it on Node 26.10.0, indicating it is unrelated to this fix.
+No manual application UI verification was performed.
+
+PR: [#1201](https://github.com/LodyAI/Lody/pull/1201).
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-01-five-hour-usage-indicator.zh.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# 输入区指示器优先显示五小时订阅用量
+
+Status: implemented
+Translation: current
+
+[English](2026-10-01-five-hour-usage-indicator.md)
+
+## 摘要
+
+输入区为详情弹层按周期从长到短排序订阅窗口，随后直接取第一项显示紧凑指示器。
+同时存在五小时窗口时，这一做法仍固定选择本周用量。指示器现在显式选择五小时窗口，
+保留已有回退方式和上下文优先级。弹层继续按原有顺序显示所有上报窗口。
+
+## 决策
+
+本次在[新会话用量显示](2026-09-28-session-tab-rate-limit-ring.zh.md)的基础上，
+让 `SessionUsagePopover` 独立选择入口窗口。反转共享数组的排序会同时改变详情顺序，
+因此入口先查找五小时窗口，再回退到详情中的第一项。0% 也是有效选择。
+提供商和模型匹配、数据归一化仍由现有辅助函数负责。
+
+[显示 Spec](../../../../specs/session-usage-indicator.zh.md)记录行为意图，
+[会话目录索引](../../../../packages/components/src/components/sessions/README.md)链接到该约定。
+已有 `QuotaOnly` Storybook 场景已提供两个窗口。
+
+## 验证
+
+两个用量测试套件共 20 项全部通过，覆盖提供商窗口的两种输入顺序、五小时用量为零、
+入口无障碍文案、弹层顺序、仅本周窗口的回退，以及重新渲染后上下文用量的优先级。
+新增的两个用例在修复前均失败。
+
+已初始化子模块的独立克隆通过了仓库类型检查、lint、格式化、文档检查和边界检查，
+Electron 的 199 项测试也全部通过。`pnpm check` 仍在 `boot-shell.test.tsx` 的存储不可用用例失败
+（组件测试 1 项失败、4,592 项通过）；恢复原始用量组件后，在 Node 26.10.0 下仍可复现，
+表明此失败与本次修复无关。
+未进行应用界面手动验证。
+
+PR：[#1201](https://github.com/LodyAI/Lody/pull/1201)。
```

**File**: `packages/components/src/components/sessions/README.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ describes the shared parsing and persistence boundary.
 | `session-goal-banner.tsx`, `session-goal-control.ts`                          | Goal actions reused by the goal chip                             |
 | `session-plan-bar.tsx`, `session-tasklist-mapping.ts`                         | Plan/tasklist presentation                                       |
 | `scheduled-tasks-panel.tsx`                                                   | Scheduled task list reused by the schedule chip                  |
-| `session-usage-popover.tsx`                                                   | Usage/context popover                                            |
+| `session-usage-popover.tsx`                                                   | Context and subscription usage ([display contract](../../../../../specs/session-usage-indicator.md)) |
 | `pull-request-badge.tsx`, `pr-merge-button.tsx`, `pr-merge-method.ts`         | PR identity and merge split-button                               |
 | `pr-tab-container.tsx`, `pr-tab-view.tsx`                                     | PR side-panel tab                                                |
 | `create-pr-prompt.ts`, `session-pr-prompts.ts`, `session-pr-agent-action.ts`  | Agent prompts behind Create PR / Fix CI / Resolve Conflicts      |
```

**File**: `packages/components/src/components/sessions/session-usage-popover.tsx` (modified, +6/-10)
```diff
@@ -3,11 +3,7 @@ import { useTranslation } from 'react-i18next';
 import { formatDistance, type Locale } from 'date-fns';
 import { enUS } from 'date-fns/locale/en-US';
 import { zhCN } from 'date-fns/locale/zh-CN';
-import {
-  getServerNow,
-  type AgentConfigId,
-  type SessionContextWindowUsage,
-} from '@lody/shared';
+import { getServerNow, type AgentConfigId, type SessionContextWindowUsage } from '@lody/shared';
 import { Spinner } from '@lody/ui/spinner';
 
 import { Button } from '@lody/ui/button';
@@ -82,9 +78,12 @@ export const SessionUsagePopover = memo(function SessionUsagePopover({
   const hasRateLimit = rateLimitWindows.length > 0;
   const wallet = rateLimit?.limits.wallet ?? null;
   const hasRateLimitDetails = rateLimit !== null;
+  const triggerRateLimitWindow =
+    rateLimitWindows.find((window) => window.windowDurationSeconds === FIVE_HOUR_WINDOW_SECONDS) ??
+    rateLimitWindows[0];
   const triggerValue =
     context?.usedPercentage ??
-    (showRateLimitWithoutContext ? rateLimitWindows[0]?.usedPercent : undefined);
+    (showRateLimitWithoutContext ? triggerRateLimitWindow?.usedPercent : undefined);
   const resolvedModelLabel =
     modelLabel?.trim() ||
     rateLimit?.limits.limitName?.trim() ||
@@ -138,10 +137,7 @@ export const SessionUsagePopover = memo(function SessionUsagePopover({
               type="button"
               variant="ghost"
               size="small"
-              className={cn(
-                'select-none focus-visible:ring-1 focus-visible:ring-ring',
-                className
-              )}
+              className={cn('select-none focus-visible:ring-1 focus-visible:ring-ring', className)}
               aria-label={triggerLabel}
               title={triggerLabel}
             >
```

**File**: `packages/components/tests/session-usage-popover.test.tsx` (modified, +51/-1)
```diff
@@ -69,7 +69,11 @@ describe('SessionUsagePopover', () => {
   };
 
   it('shows the used context percentage in the composer trigger', async () => {
-    await renderUsage({ contextWindowUsage: { size: 128_000, used: 32_000 } });
+    await renderUsage({
+      contextWindowUsage: { size: 128_000, used: 32_000 },
+      rateLimits,
+      showRateLimitWithoutContext: true,
+    });
 
     const trigger = container.querySelector('button');
     expect(trigger?.textContent).toBe('25%');
@@ -99,6 +103,52 @@ describe('SessionUsagePopover', () => {
     expect(container.querySelector('button')).toBeNull();
   });
 
+  it.each([
+    { fiveHourFirst: false, usedPercent: 11 },
+    { fiveHourFirst: true, usedPercent: 0 },
+  ])(
+    'prefers five-hour usage ($usedPercent%) with fiveHourFirst=$fiveHourFirst',
+    async ({ fiveHourFirst, usedPercent }) => {
+      const key = getRateLimitEntryKey('codex', 'codex');
+      const weekly = rateLimits[key]!.windows[0]!;
+      const fiveHour = {
+        usedPercent,
+        windowDurationSeconds: 5 * 60 * 60,
+        resetsAtEpochSeconds: null,
+      };
+      const limits: MachineRateLimits = {
+        [key]: {
+          ...rateLimits[key]!,
+          windows: fiveHourFirst ? [fiveHour, weekly] : [weekly, fiveHour],
+        },
+      };
+      await renderUsage({ rateLimits: limits, showRateLimitWithoutContext: true });
+
+      const trigger = container.querySelector('button');
+      expect(trigger?.textContent).toBe(`${usedPercent}%`);
+      expect(trigger?.getAttribute('aria-label')).toBe(`Open usage details, ${usedPercent}% used`);
+      expect(trigger?.getAttribute('title')).toBe(`Open usage details, ${usedPercent}% used`);
+
+      await act(async () => {
+        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
+      });
+      const meters = document.body
+        .querySelector('[aria-label="Usage"]')
+        ?.querySelectorAll('[role="progressbar"]');
+      expect(Array.from(meters ?? []).map((meter) => meter.getAttribute('aria-label'))).toEqual([
+        'Weekly: 29% used',
+        `5 hours: ${usedPercent}% used`,
+      ]);
+
+      await renderUsage({
+        contextWindowUsage: { size: 128_000, used: 32_000 },
+        rateLimits: limits,
+        showRateLimitWithoutContext: true,
+      });
+      expect(container.querySelector('button')?.textContent).toBe('25%');
+    }
+  );
+
   it('shows Fable weekly as a distinct meter beside shared quotas', async () => {
     await renderUsage({
       agentType: 'claude',
```

**File**: `specs/session-usage-indicator.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# Composer usage indicator
+
+Status: draft
+Translation: current
+
+[中文](session-usage-indicator.zh.md)
+
+When a provider reports both weekly and five-hour subscription usage, a composer
+without context usage shows the five-hour percentage in its compact indicator.
+For example, weekly usage of 29% and five-hour usage of 11% produces an 11% indicator.
+
+## Display contract
+
+Valid context usage takes precedence. While context is compacting, the indicator
+shows the compacting state. Subscription usage is eligible only when the caller
+enables display without context, using the selected provider and model's limits.
+
+For subscription usage, select a valid five-hour window even when its usage is 0%.
+If no valid five-hour window exists, keep the existing longest-window selection.
+If neither valid context nor eligible subscription usage exists, hide the
+indicator unless context is compacting.
+
+The detail popover displays all valid reported windows in descending duration
+order, retaining provider-supplied labels and reset information. Compact indicator
+selection is independent of that presentation order.
+
+## Evidence
+
+- [Indicator and detail popover](../packages/components/src/components/sessions/session-usage-popover.tsx)
+- [Behavioral tests](../packages/components/tests/session-usage-popover.test.tsx)
+- [Decision](../.agents/notes/implemented/bug-fix/2026-10-01-five-hour-usage-indicator.md)
```

**File**: `specs/session-usage-indicator.zh.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# 输入区用量指示器
+
+Status: draft
+Translation: current
+
+[English](session-usage-indicator.md)
+
+提供商同时上报本周和五小时订阅用量时，尚无上下文用量的输入区在紧凑指示器中
+显示五小时百分比。例如，本周已使用 29%、五小时已使用 11% 时，入口显示 11%。
+
+## 显示约定
+
+有效的上下文用量优先显示。压缩上下文时，指示器显示压缩状态。
+只有调用方启用无上下文时的订阅用量显示，才使用所选提供商和模型的额度。
+
+订阅用量优先选择有效的五小时窗口，即使其用量为 0%。不存在有效五小时窗口时，
+保留已有的最长周期窗口选择。既没有有效上下文，也没有符合显示条件的订阅用量时，
+隐藏指示器；正在压缩上下文除外。
+
+详情弹层按周期从长到短显示所有有效窗口，保留提供商上报的名称和重置时间。
+紧凑指示器的窗口选择独立于详情排序。
+
+## 证据
+
+- [指示器与详情弹层](../packages/components/src/components/sessions/session-usage-popover.tsx)
+- [行为测试](../packages/components/tests/session-usage-popover.test.tsx)
+- [决策记录](../.agents/notes/implemented/bug-fix/2026-10-01-five-hour-usage-indicator.zh.md)
```

---

### Incident Patch 15: `3bdb519a` (2026-10-03)
**Commit Message**: fix(components): keep desktop settings usable in narrow windows (#1198)

**File**: `.agents/notes/implemented/bug-fix/2026-10-01-narrow-settings-panel.md` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+# Keep desktop Settings usable in narrow windows
+
+Status: implemented
+Translation: current
+PR: [#1198](https://github.com/LodyAI/Lody/pull/1198)
+
+[中文](2026-10-01-narrow-settings-panel.zh.md)
+
+## Abstract
+
+Desktop Settings kept a fixed 240px navigation column even when its panel was
+only 420px wide, squeezing Role names and clipping the Add role button. The panel
+now uses a single horizontally scrolling row of category items above the page
+when it is at most 720px wide — the same column collapsed to its icon rail,
+labels and group headings folded away, each row named for assistive technology
+and on hover — and its header actions wrap. Both widths share one navigation
+tree, so selection and keyboard scope survive resizing, as does the open editor
+draft. Browser regression coverage exercises geometry and nested-editor
+interaction with synthetic catalog data; packaged Electron and live cloud
+workspaces remain outside this check.
+
+## Cause and decision
+
+At a 500px desktop viewport, `84vw` yields a 420px panel. The non-shrinking 240px
+sidebar leaves 180px for the page, before its insets. The non-wrapping title/actions
+row can overflow that space while the panel clips it. Desktop devices deliberately
+keep the desktop renderer at narrow widths, per the
+[compact-desktop decision](../feature/2026-09-25-compact-desktop-layout.md).
+
+[`desktop-settings-modal.tsx`](../../../../packages/components/src/components/settings/desktop-settings-modal.tsx)
+owns the named inline-size container; one navigation tree serves both widths and
+a container query collapses it in place — no second presentation to keep in
+step, and focus scope survives the resize. Below the breakpoint the column is
+52→48px of icon rows: the sidebar's own glyphs, grouped as it groups them, the
+current row keeping its wash. Rows carry their name for assistive technology
+and, while the rail is showing, as a tooltip. A short window scrolls the column
+itself; selection and rail resizing reveal the active row — only the column
+scrolls, never the page. A Base UI dialog popup stops composite keys (arrows,
+Home/End) at the portal edge, so window-level scope navigation had never seen
+them — the sidebar's arrow keys were inert inside the overlay. `FocusScope` now
+runs a scope's navigation and the Left/Right scope switch on the scope element's
+own keydown, after controls inside it and before the popup's stop. Bug report
+remains an accessible button when available, icon-only on the rail. Header
+titles and action clusters wrap; narrow headers remove the redundant inner
+column padding.
+
+Shrinking the sidebar alone leaves too little reading width. A navigation band
+above the page was tried three ways — a segmented strip floating in a padded
+bar, a grouped underline row, and the strip flush edge to edge — and each read
+as foreign chrome: the panel's own sidebar collapses instead, the way app
+sidebars collapse to their icon column. The rail's trade-off is that categories
+are glyphs until hovered or read by assistive technology; the labels return at
+full width. Nested editor sizing, focus management and scrolling remain with
+the existing dialog and form, including
+[pane-centred placement](2026-09-26-settings-editor-dialog-placement.md).
+
+## Verification
+
+[`DesktopSettingsModal` stories](../../../../packages/components/src/stories/DesktopSettingsModal.stories.tsx)
+add a read-only synthetic Role catalog without transport or real account writes.
+[`desktop-settings-layout.spec.ts`](../../../../packages/components/tests/e2e/desktop-settings-layout.spec.ts)
+checks the actual rendered panel at 400, 500, 707, 900 and 1180px, category parity,
+rail scrolling, keyboard selection, selected-item visibility and one-column
+navigation, draft retention through resize, Chinese/dark actions, focus wrapping,
+Escape return, and scrollable editor content above visible Cancel/Save at 707×394.
+
+All ten browser tests pass. Restoring the pre-fix modal makes the 500px geometry
+test fail: Add role ends at 508.125px while the panel ends at 460px. Short-height
+tab navigation also keeps its last category inside the panel. Component
+typechecking and root formatting pass; repository-wide verification is reported
+in the PR separately from these behavioral checks.
+
+The [desktop-window Spec](../../../../specs/desktop-windows.md) remains draft.
+This change does not establish live save/dispatch behavior or packaged Electron
+rendering, and does not change Role catalog or authorization contracts.
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-01-narrow-settings-panel.zh.md` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+# 保持窄窗口中的桌面设置可用
+
+Status: implemented
+Translation: current
+PR: [#1198](https://github.com/LodyAI/Lody/pull/1198)
+
+[English](2026-10-01-narrow-settings-panel.md)
+
+## 摘要
+
+桌面设置在面板只有 420px 宽时仍保留固定 240px 导航列，挤压 Role 名称并裁切新增角色按钮。
+面板现在在宽度不超过 720px 时把同一导航列折叠为图标栏——收起标签与分组标题，
+每行保留可访问名称和悬停提示——并允许标题操作换行。
+两个宽度共用同一棵导航树，调整窗口尺寸保留选中态、键盘焦点范围和打开的编辑器草稿。
+浏览器回归测试用合成目录数据验证实际几何与嵌套编辑器交互；打包 Electron 和真实云工作区
+不属于本次验证范围。
+
+## 根因与决策
+
+500px 桌面视口中的 `84vw` 面板为 420px，禁止收缩的 240px 侧栏只给内容区留下 180px，
+还需扣除内边距。不换行的标题与操作行超出剩余空间，又被面板裁切。桌面设备在窄窗口中
+保留桌面 renderer 是有意行为，见
+[紧凑桌面决策](../feature/2026-09-25-compact-desktop-layout.zh.md)。
+
+[`desktop-settings-modal.tsx`](../../../../packages/components/src/components/settings/desktop-settings-modal.tsx)
+拥有具名 inline-size 容器；同一棵导航树服务两种宽度，容器查询就地折叠——不需要同步第二套
+呈现，焦点范围也能跨越缩放。低于断点时，列变为 48px 的图标行：侧栏自己的图标、同样的分组、
+当前行保持同样的选中底色。每行保留可访问名称，图标栏态下悬停显示提示。短窗口滚动这一列本身；
+选中分类或列尺寸变化时露出当前行——只滚动列，不滚动正文。方向键无法离开 Base UI 弹窗——popup
+在 portal 边缘拦截 composite 键（方向键、Home/End）的冒泡——因此 window 层的范围导航从未收到
+它们，侧栏方向键在弹窗内一直无效。`FocusScope` 现在在 scope 元素自身的 keydown 上执行所属范围
+的导航与 Left/Right 范围切换，晚于内部控件、早于 popup 拦截。可用时仍有带可访问名称的报告问题
+按钮，图标栏态下仅显示图标。标题和操作组允许换行；窄面板标题去掉重复的内层列边距。
+
+只缩小侧栏仍没有足够阅读宽度；内容上方的导航条带试过三种形态——内嵌边距中的分段条带、
+分组下划线行、贴边条带——每种读起来都像外来的控件条。面板自己的侧栏改为折叠，如同应用侧栏
+收为图标列。图标栏的代价是分类只剩图标，直到悬停或由辅助技术读出；标签在完整宽度回归。
+嵌套编辑器的尺寸、焦点管理和滚动继续由
+现有弹窗与表单负责，包括[内容区居中规则](2026-09-26-settings-editor-dialog-placement.zh.md)。
+
+## 验证
+
+[`DesktopSettingsModal` stories](../../../../packages/components/src/stories/DesktopSettingsModal.stories.tsx)
+添加只读合成 Role 目录，不连接传输或写入真实账户。
+[`desktop-settings-layout.spec.ts`](../../../../packages/components/tests/e2e/desktop-settings-layout.spec.ts)
+验证 400、500、707、900、1180px 下实际面板几何、分类一致性、图标栏滚动、键盘选择、
+选中项可见与单列导航、缩放草稿保留、中文暗色操作、
+焦点循环、Escape 返回，以及 707×394 下正文滚动且 Cancel/Save 保持可见。
+
+十项浏览器测试全部通过。恢复修复前的主弹窗后，500px 几何测试失败：Add role 右边界为
+508.125px，面板右缘为 460px。短窗口中导航列也能将末项滚入视野内。
+组件类型检查和根格式化通过；全仓验证结果在 PR 中与这些行为检查分开报告。
+
+[桌面窗口 Spec](../../../../specs/desktop-windows.zh.md) 仍为 draft。
+本次变更不能证明真实保存、派发流程或打包 Electron 的渲染，不改变 Role 目录及授权契约。
```

**File**: `packages/components/src/AGENTS.md` (modified, +4/-1)
```diff
@@ -66,7 +66,10 @@ Performance comparisons must use the current full-Mirror baseline.
   single scope switcher uses Left/Right between visible leaf scopes. A local
   control may keep a key by calling `preventDefault`; text inputs are never
   intercepted. Nested parent scopes yield to their visible child scopes, and an
-  open dialog's scopes never switch focus into the background workspace.
+  open dialog's scopes never switch focus into the background workspace. Scopes
+  handle their keys on the scope element itself: a dialog popup stops composite
+  keys (arrows, Home/End) before window listeners, so `FocusScope` moves its
+  registered list and the switcher on its own `onKeyDown`.
 
 ## Zen layout
 
```

**File**: `packages/components/src/components/README.md` (modified, +6/-0)
```diff
@@ -65,6 +65,12 @@ and [display preference](../../../../.agents/notes/implemented/feature/2026-09-2
 - Sidebar Search, immediately below New Chat, opens the shared command palette
   through `lib/commands/palette-state.ts`; see the [Spec](../../../../specs/sidebar-search.md).
 - Chat landing: `chat/chat-landing.tsx`.
+- Desktop Settings: [`settings/desktop-settings-modal.tsx`](settings/desktop-settings-modal.tsx)
+  collapses its sidebar to an icon rail when the panel is at most 720px wide:
+  same rows and selection, labels and group headings fold away, and each icon
+  keeps an accessible name and a hover tooltip. The page and its editors stay
+  mounted through resizing; header actions wrap within the pane. [Decision and
+  verification](../../../../.agents/notes/implemented/bug-fix/2026-10-01-narrow-settings-panel.md).
 - Browser desktop sign-in handoff: `login-page.tsx` under `?client_id=electron`,
   the page the desktop app opens in the system browser. A desktop sign-out leaves
   this browser signed in as the previous account, so the page names that account
```

**File**: `packages/components/src/components/settings/AGENTS.md` (modified, +4/-4)
```diff
@@ -39,10 +39,10 @@ rolls back — is in the root [AGENTS.md](../../../../../AGENTS.md).
   never surface `machine_rpc_unavailable` as an editor error. The GitHub source
   row must paint from `lody:githubReposCache` on first frame; do not wait on
   `listWorkspaceReposWithStatus` to decide whether GitHub exists.
-- A settings row (`compact-layout.tsx`) is one grid: the label column takes the rest,
-  the control column hugs its content. Never size a column from a viewport breakpoint:
-  the panel is narrower than the window and clips overflow, so a `md:` label column
-  hides the control.
+- Settings rows (`compact-layout.tsx`) give labels remaining width and controls their
+  content width. Never size columns from viewport breakpoints: the panel
+  clips controls. Desktop Settings nav follows panel width; keep categories/drafts,
+  reveal the selection and wrap actions.
 - Agent configuration lives in `agent-config-dialog.tsx` plus `env-vars-textarea.tsx`.
   DeepSeek Harness official vs custom endpoint is dialog form state only: persist
   `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` (official always writes
```

**File**: `packages/components/src/components/settings/desktop-settings-modal.tsx` (modified, +256/-135)
```diff
@@ -1,10 +1,12 @@
 import { text as uiText } from '@lody/ui/tokens/scales.stylex';
-import { useCallback, useId, useMemo, useState, type CSSProperties } from 'react';
+import { useCallback, useId, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
 import { Bug, X } from 'lucide-react';
 import * as stylex from '@stylexjs/stylex';
 import { colors } from '@lody/ui/tokens/colors.stylex';
 import { space } from '@lody/ui/tokens/scales.stylex';
 import { Button } from '@lody/ui/button';
+import { Tabs } from '@lody/ui/tabs';
+import { Tooltip } from '@lody/ui/tooltip';
 import { useTranslation } from 'react-i18next';
 import { useAtom, useSetAtom } from 'jotai';
 import {
@@ -62,8 +64,13 @@ const PANEL_STYLE: CSSProperties = {
   padding: 0,
   gap: 0,
   overflow: 'hidden',
+  containerType: 'inline-size',
+  containerName: 'desktop-settings',
 };
 
+// Below this the nav column answers as its icon rail; the panel is narrower than the window.
+const NARROW = '@container desktop-settings (max-width: 720px)';
+
 /** The close button's inset, equal from the top and the end of the right pane. */
 const CLOSE_INSET = space[2];
 
@@ -81,16 +88,22 @@ const styles = stylex.create({
   },
   body: {
     display: 'flex',
+    flexDirection: 'row',
     flexGrow: 1,
     minHeight: 0,
     overflow: 'hidden',
   },
-  /** The nav: its fill (`surface.nav`) is what splits it from the page. */
+  /**
+   * The nav stays the nav at every width — the rail keeps its fill
+   * (`surface.nav`), its grouping and its selection. What collapses is its
+   * width: below the panel's narrow breakpoint it is the rows' icon column
+   * only, the same sidebar answering with less room.
+   */
   nav: {
     display: 'flex',
     flexDirection: 'column',
     flexShrink: 0,
-    width: '240px',
+    width: { default: '240px', [NARROW]: '48px' },
   },
   navScroll: {
     display: 'flex',
@@ -100,8 +113,10 @@ const styles = stylex.create({
     minHeight: 0,
     overflowY: 'auto',
     padding: space[3],
+    paddingInline: { default: space[3], [NARROW]: space[1.5] },
   },
   navGroupHeading: {
+    display: { default: 'block', [NARROW]: 'none' },
     margin: 0,
     paddingInline: space[2],
     paddingBottom: space[1],
@@ -111,7 +126,15 @@ const styles = stylex.create({
     color: colors.tertiaryLabel,
   },
   navGroupRows: { display: 'flex', flexDirection: 'column', gap: '2px' },
-  navFooter: { marginTop: 'auto', padding: space[3] },
+  /** On the rail a row is its icon, centred in the icon column. */
+  navRowRail: { justifyContent: { default: null, [NARROW]: 'center' } },
+  /** A rail row's words leave the rail; its name still reaches the a11y tree. */
+  navRowLabelRail: { display: { default: null, [NARROW]: 'none' } },
+  navFooter: {
+    marginTop: 'auto',
+    padding: space[3],
+    paddingInline: { default: space[3], [NARROW]: space[1.5] },
+  },
   content: {
     position: 'relative',
     display: 'flex',
@@ -136,15 +159,23 @@ const styles = stylex.create({
     paddingTop: '20px',
   },
   header: { flexShrink: 0 },
-  /** The page's name and its actions, on one line. */
+  /** Page actions wrap below the title when the pane cannot fit both. */
   headerRow: {
     display: 'flex',
+    flexWrap: 'wrap',
     alignItems: 'center',
     justifyContent: 'space-between',
     gap: space[3],
     minHeight: '40px',
   },
-  headerActions: { display: 'flex', flexShrink: 0, alignItems: 'center', gap: space[2] },
+  headerTitle: { minWidth: 0, overflowWrap: 'anywhere' },
+  headerActions: {
+    display: 'flex',
+    flexWrap: 'wrap',
+    maxWidth: '100%',
+    alignItems: 'center',
+    gap: space[2],
+  },
   /** The page's lead, under its name; empty on a page without one. */
   headerLead: {
     margin: 0,
@@ -163,7 +194,7 @@ const styles = stylex.create({
     width: '100%',
     maxWidth: '760px',
     marginInline: 'auto',
-    paddingInline: space[4],
+    paddingInline: { default: space[4], [NARROW]: 0 },
   },
   paneBody: { flexGrow: 1, minHeight: 0 },
   fill: { height: '100%' },
@@ -173,7 +204,7 @@ const styles = stylex.create({
    * stays flush with the pane edge.
    */
   paneInset: {
-    paddingInlineStart: space[6],
+    paddingInlineStart: { default: space[6], [NARROW]: space[4] },
     paddingInlineEnd: '40px',
     paddingBottom: space[6],
   },
@@ -254,6 +285,41 @@ function SettingsModalBody() {
     onItemFocus: handleNavigationItemFocus,
     scopeId: navigationScopeId,
   });
+  const [navScroller, setNavScroller] = useState<HTMLElement | null>(null);
+  /** Below the rail threshold the nav answers with icons; labels hide in CSS. */
+  const [navIsRail, setNavIsRail] = useState(false);
+  useLayoutEffect(() => {
+    if (!navScroller) return undefined;
+    const updateRail = () => {
+      const rail = navScroller.parentElement;
+      const next = rail ? rail.getBoundingClientRect().width <= 56 : false;
+      setNavIsRail((previous) => (previous === next ? previous : n
```

**File**: `packages/components/src/components/settings/settings-account-entry.tsx` (modified, +11/-2)
```diff
@@ -7,7 +7,16 @@ import { duration, ease, space } from '@lody/ui/tokens/scales.stylex';
 import { UserAvatar } from '@/components/user-avatar';
 import { settingsSurface as surface } from './surface';
 
+// The desktop settings panel's icon-rail breakpoint; kept literal so StyleX resolves it.
+const NAV_RAIL = '@container desktop-settings (max-width: 720px)';
+
 const styles = stylex.create({
+  /**
+   * In the desktop panel's narrow band the entry is its avatar alone, centred
+   * in the icon column like every other rail row.
+   */
+  railRow: { justifyContent: { default: null, [NAV_RAIL]: 'center' } },
+  railLabel: { display: { default: null, [NAV_RAIL]: 'none' } },
   /**
    * On mobile the entry is a card of its own above the settings list, and the
    * whole card is the row a person opens. It restates the card's fill under
@@ -108,12 +117,12 @@ export function SettingsAccountEntry({
       onClick={onSelect}
       aria-pressed={active}
       aria-label={t('settings.account.open', 'Open account settings')}
-      {...stylex.props(surface.listRow, active && surface.listRowSelected)}
+      {...stylex.props(surface.listRow, styles.railRow, active && surface.listRowSelected)}
     >
       <span {...stylex.props(surface.listRowAvatar)}>
         <UserAvatar user={user} size="medium" />
       </span>
-      <span {...stylex.props(surface.listRowLabel)}>{name}</span>
+      <span {...stylex.props(surface.listRowLabel, styles.railLabel)}>{name}</span>
     </button>
   );
 }
```

**File**: `packages/components/src/stories/DesktopSettingsModal.stories.tsx` (modified, +58/-4)
```diff
@@ -2,16 +2,18 @@ import type { Meta, StoryObj } from '@storybook/react';
 import type { ReactNode } from 'react';
 import { Provider } from 'jotai';
 import { useHydrateAtoms } from 'jotai/utils';
-import { settingsActiveTabAtom, settingsDialogOpenAtom } from '@/atoms';
+import { settingsActiveTabAtom, settingsDialogOpenAtom, userAtom } from '@/atoms';
+import { runtimeAtom, type WorkspaceRuntime } from '@/atoms/runtime';
+import { AGENT_ROLE_VERSION, workspaceFlockKeys, type AgentRole } from '@lody/shared';
 import type { SettingsTabId } from '@/components/settings/settings-tabs';
 import { DesktopSettingsModal } from '@/components/settings/desktop-settings-modal';
 import { RoutedStory, SettingsStoryProviders } from './settings-story-shell';
 
 /**
  * Desktop settings modal — the overlay that replaces the full-page settings route on
  * non-mobile viewports. These stories open it at low-dependency tabs (General / About);
- * runtime-heavy tabs (Account, Stats, Agent config, GitHub) need a live workspace
- * runtime and are exercised in the app rather than here.
+ * Agent Roles uses a read-only catalog fixture; runtime-heavy tabs (Account, Stats,
+ * Agent config, GitHub) need a live workspace and are exercised in the app.
  */
 function OpenModalAt({ tab, children }: { tab: SettingsTabId; children: ReactNode }) {
   useHydrateAtoms([
@@ -21,13 +23,61 @@ function OpenModalAt({ tab, children }: { tab: SettingsTabId; children: ReactNod
   return <>{children}</>;
 }
 
+const storyRole: AgentRole = {
+  v: AGENT_ROLE_VERSION,
+  id: 'settings-story-role' as AgentRole['id'],
+  ownerUserId: 'settings-story-user',
+  visibility: 'private',
+  name: 'Code Reviewer',
+  emoji: '🔍',
+  machineId: 'settings-story-machine' as AgentRole['machineId'],
+  agentConfigId: 'settings-story-config' as AgentRole['agentConfigId'],
+  runConfig: {},
+  promptPrefix: 'Check correctness before style.',
+  revision: 1,
+  createdAt: 1,
+  updatedAt: 1,
+};
+
+// A read-only catalog fixture: no transport or real workspace writes.
+const rolesStoryRuntime = {
+  workspaceId: 'settings-story-workspace',
+  workspaceSlug: 'lody',
+  repo: {
+    openFlockDoc: async () => ({
+      flock: {
+        scan: (options?: { prefix?: readonly unknown[] }) =>
+          options?.prefix?.[0] === 'agentRole'
+            ? [{ key: workspaceFlockKeys.agentRole(storyRole.id), value: storyRole }]
+            : [],
+        subscribe: () => () => {},
+      },
+      joinRoom: async () => ({ unsubscribe: () => {}, firstSyncedWithRemote: Promise.resolve() }),
+    }),
+  },
+} as unknown as WorkspaceRuntime;
+
+function RolesCatalogFixture({ children }: { children: ReactNode }) {
+  useHydrateAtoms([
+    [runtimeAtom, rolesStoryRuntime],
+    [userAtom, { id: storyRole.ownerUserId, name: 'Example user', email: 'user@example.com' }],
+  ]);
+  return <>{children}</>;
+}
+
 function SettingsModalStory({ tab }: { tab: SettingsTabId }) {
   return (
     <SettingsStoryProviders capabilities={['cloudAccount']}>
       <RoutedStory>
         <Provider>
           <OpenModalAt tab={tab}>
-            <DesktopSettingsModal />
+            {tab === 'agent-roles' ? (
+              <RolesCatalogFixture>
+                <DesktopSettingsModal />
+              </RolesCatalogFixture>
+            ) : (
+              <DesktopSettingsModal />
+            )}
           </OpenModalAt>
         </Provider>
       </RoutedStory>
@@ -64,6 +114,10 @@ export const McpEmptyTab: Story = {
   render: () => <SettingsModalStory tab="mcp" />,
 };
 
+export const AgentRolesTab: Story = {
+  render: () => <SettingsModalStory tab="agent-roles" />,
+};
+
 export const DarkModePreferencesTab: Story = {
   render: () => (
     <div className="dark">
```

#### Recent Merged Pull Requests:
- **PR #1252** (2026-10-04): fix: preserve spacing between progress prose and tool summaries (@wibus-wee)
- **PR #1248** (2026-10-04): feat(site): add Nightly Android APK downloads [risk:medium] (@Leeeon233)
- **PR #1243** (2026-10-04): fix: unify subagent dialog rendering with conversation (@wibus-wee)
- **PR #1242** (2026-10-04): fix: preserve local preview module credentials (@Leeeon233)
- **PR #1240** (2026-10-04): refactor: migrate ten complex component surfaces to StyleX (@wibus-wee)
- **PR #1239** (2026-10-04): fix: unify sidebar footer control sizes and spacing (@wibus-wee)
- **PR #1238** (2026-10-04): fix: balance conversation rhythm with StyleX tokens (@wibus-wee)
- **PR #1237** (2026-10-04): fix: use theme color for file mention category icon (@wibus-wee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
