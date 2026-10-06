# Forensic Learning Record (Deep Inspection): pipeshub-ai/pipeshub-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/pipeshub-ai-pipeshub-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pipeshub-ai/pipeshub-ai](https://github.com/pipeshub-ai/pipeshub-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:13:17.668Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pipeshub-ai/pipeshub-ai`
- **Description**: The open-source context layer for AI agents. PipesHub turns your company's knowledge (Slack, Drive, Jira, GitHub, Microsoft 365 and 40+ connectors) into a permission-aware workspace that agents can search, grep, navigate and cite. MCP, SDKs and built-in agents. Self-hosted.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 3810 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/activity-ui.ts`
```
import { markdownToSlackMrkdwn } from "./md_to_mrkdwn";

const MAX_REASONING_CHARS = 600;
const MAX_NARRATION_CHARS = 800;
const MAX_ACTIVITY_TEXT_CHARS = 2900;

/** Tool / sub-agent rows from {@link SlackActivityBuilder.format}. */
const ACTIVITY_TOOL_LINE = /^•\s+(?:[✓✗]\s+\S.*|.+\.\.\.)$/;
/** Live status line, e.g. `_Thinking..._` / `_Load Skill..._`. */
const ACTIVITY_STATUS_LINE = /^_.+\.\.\._$/;
const ACTIVITY_THINKING_HEADER = /^\*Thinking\*$/;

function hasActivityMarkers(text: string): boolean {
  return text.split("\n").some((line) => {
    const trimmed = line.trim();
    return (
      ACTIVITY_TOOL_LINE.test(trimmed) ||
      ACTIVITY_STATUS_LINE.test(trimmed) ||
      ACTIVITY_THINKING_HEADER.test(trimmed)
    );
  });
}

/**
 * Removes activity-timeline content (tools, thinking, narration, status) so
 * prior bot messages are not re-injected into Slack thread context.
 * Keeps ask-user questions and other non-activity bot text.
 */
export function stripSlackActivityTimeline(text: string): string {
  if (!text) {
    return "";
  }

  // Activity messages are dedicated timeline posts (answer is separate).
  // Narration is plain text between tool rows, so marker presence means the
  // whole message is activity and should be dropped from thread context.
  if (hasActivityMarkers(text)) {
    return "";
  }

  return text.trim();
}

export interface ActivityToolRow {
  toolName: string;
  label: string;
  done: boolean;
  failed?: boolean;
}

function toolDisplayLabel(row: ActivityToolRow): string {
  return row.label.replace(/^Using\s+/i, "");
}

function formatToolCountLine(
  marker: "running" | "success" | "failed",
  label: string,
  count: number,
): string {
  const suffix = count > 1 ? ` (×${count})` : "";
  if (marker === "running") {
    return `• ${label}${suffix}...`;
  }
  if (marker === "failed") {
    return `• ✗ ${label}${suffix}`;
  }
  return `• ✓ ${label}${suffix}`;
}

/**
 * Collapse consecutive same-tool rows, but keep success and failure as
 * separate lines so a mixed group does not look entirely failed.
 */
function formatDedupedToolLines(tools: ActivityToolRow[]): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < tools.length) {
    const first = tools[i];
    if (!first) break;
    const toolName = first.toolName;
    let j = i + 1;
    while (j < tools.length && tools[j]?.toolName === toolName) {
      j += 1;
    }
    const group = tools.slice(i, j);
    const displayLabel =
      toolDisplayLabel(group.find((t) => t.done) ?? first);

    const running = group.filter((t) => !t.done);
    const failed = group.filter((t) => t.done && t.failed);
    const succeeded = group.filter((t) => t.done && !t.failed);

    if (succeeded.length > 0) {
      lines.push(formatToolCountLine("success", displayLabel, succeeded.length));
    }
    if (failed.length > 0) {
      lines.push(formatToolCountLine("failed", displayLabel, failed.length));
    }
    if (running.length > 0) {
      lines.push(formatToolCountLine("running", displayLabel, running.length));
    }
    i = j;
  }
  return lines;
}

export interface ActivitySubAgentRow {
  role: string;
  status: "running" | "completed" | "failed";
}

type TimelineEntry =
  | { kind: "narration"; text: string }
  | { kind: "tool"; row: ActivityToolRow }
  | { kind: "subagent"; row: ActivitySubAgentRow }
  | { kind: "reasoning"; text: string };

/** Backend may leave a Confidence trailer on narration flushed before a tool. */
const CONFIDENCE_TRAILER_RE =
  /(?:\n*-{3,}\s*\n)?\s*Confidence:\s*(?:Very High|High|Medium|Low)\s*$/i;

function cleanNarration(text: string): string {
  return text.replace(CONFIDENCE_TRAILER_RE, "").trim();
}

function truncateNarration(text: string): string {
  if (text.length <= MAX_NARRATION_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_NARRATION_CHARS).trimEnd()}…`;
}

/**
 * Builds the Slack activity message body (narration / thinking / tools /
 * sub-agents), updated in place during an AG-UI stream.
 */
export class SlackActivityBuilder {
  private statusMessage = "Thinking...";
  private timeline: TimelineEntry[] = [];
  private openToolName: string | null = null;

  setStatus(message: string): void {
    // Empty string clears the live status line after the run finishes.
    this.statusMessage = message.trim();
  }

  /** Settled preamble text that preceded a tool call (frontend narration). */
  appendNarration(text: string): void {
    const cleaned = cleanNarration(text);
    if (!cleaned) return;
    this.timeline.push({ kind: "narration", text: truncateNarration(cleaned) });
  }

  appendReasoning(delta: string): void {
    if (!delta) return;
    const last = this.timeline[this.timeline.length - 1];
    if (last?.kind === "reasoning") {
      last.text = (last.text + delta).slice(-MAX_REASONING_CHARS * 2);
      return;
    }
    this.timeline.push({ kind: "reasoning", text: delta });
  }

  finishReasoning(): void {
    // Formatting truncates on render.
  }

  startTool(toolName: string, label: string): void {
    this.openToolName = toolName;
    this.timeline.push({
      kind: "tool",
      row: { toolName, label, done: false },
    });
    this.statusMessage = `${label}...`;
  }

  finishTool(toolName: string, label: string, failed = false): void {
    const open =
      [...this.timeline]
        .reverse()
        .find(
          (e): e is Extract<TimelineEntry, { kind: "tool" }> =>
            e.kind === "tool" && !e.row.done && e.row.toolName === toolName,
        ) ??
      (this.openToolName
        ? [...this.timeline]
            .reverse()
            .find(
              (e): e is Extract<TimelineEntry, { kind: "tool" }> =>
                e.kind === "tool" &&
                !e.row.done &&
                e.row.toolName === this.openToolName,
            )
        : undefined) ??
      [...this.timeline]
        .reverse()
        .find(
          (e): e is Extract<TimelineEntry, { kind: "tool" }> =>
            e.kind === "tool" && !e.row.done,
        );

    if (open) {
      open.row.done = true;
      open.row.failed = failed;
      open.row.label = label;
    } else {
      this.timeline.push({
        kind: "tool",
        row: { toolName, label, done: true, failed },
      });
    }
    this.openToolName = null;
    this.statusMessage = "Thinking...";
  }

  startSubAgent(role: string): void {
    this.timeline.push({ kind: "subagent", row: { role, status: "running" } });
    this.statusMessage = `Delegating to ${role}...`;
  }

  finishSubAgent(role: string, status: "completed" | "failed"): void {
    const row =
      [...this.timeline]
        .reverse()
        .find(
          (e): e is Extract<TimelineEntry, { kind: "subagent" }> =>
            e.kind === "subagent" &&
            e.row.role === role &&
            e.row.status === "running",
        ) ??
      [...this.timeline]
        .reverse()
        .find(
          (e): e is Extract<TimelineEntry, { kind: "subagent" }> =>
            e.kind === "subagent" && e.row.status === "running",
        );
    if (row) {
      row.row.status = status;
    }
    this.statusMessage = "Thinking...";
  }

  /** True when there is a tools/thinking/narration/sub-agent timeline worth keeping. */
  hasTimeline(): boolean {
    return this.timeline.length > 0;
  }

  format(): string {
    const sections: string[] = [];
    let i = 0;

    while (i < this.timeline.length) {
      const entry = this.timeline[i];
      if (!entry) break;

      if (entry.kind === "narration") {
        // Model narration is standard Markdown; activity posts use Slack mrkdwn.
        sections.push(markdownToSlackMrkdwn(entry.text));
        i += 1;
        continue;
      }

      if (entry.kind === "reasoning") {
        const reasoning = entry.text.trim();
        if (reasoning) {
          const truncated =
            reasoning.length > MAX_REASONING_CHARS
              ? `${reasoning.slice(0, MAX_REASONING_CHARS).trimEnd()}…`
              : reasoning;
          const converted = markdownToSlackMrkdwn(truncated);
          const italic = converted
            .split("\n")
            .map((line) => (line.trim() ? `_${line.trim()}_` : ""))
            .filter(Boolean)
            .join("\n");
          sections.push(`*Thinking*\n${italic}`);
        }
        i += 1;
        continue;
      }

      if (entry.kind === "tool") {
        const tools: ActivityToolRow[] = [];
        while (i < this.timeline.length && this.timeline[i]?.kind === "tool") {
          const toolEntry = this.timeline[i] as Extract<
            TimelineEntry,
            { kind: "tool" }
          >;
          tools.push(toolEntry.row);
          i += 1;
        }
        sections.push(formatDedupedToolLines(tools).join("\n"));
        continue;
      }

      // subagent
      const lines: string[] = [];
      while (i < this.timeline.length && this.timeline[i]?.kind === "subagent") {
        const subEntry = this.timeline[i] as Extract<
          TimelineEntry,
          { kind: "subagent" }
        >;
        const sub = subEntry.row;
        if (sub.status === "running") {
          lines.push(`• Delegating to ${sub.role}...`);
        } else if (sub.status === "failed") {
          lines.push(`• ✗ ${sub.role}`);
        } else {
          lines.push(`• ✓ ${sub.role}`);
        }
        i += 1;
      }
      if (lines.length > 0) {
        sections.push(lines.join("\n"));
      }
    }

    if (this.statusMessage.trim()) {
      sections.push(`_${this.statusMessage}_`);
    }

    let text = sections.join("\n\n");
    if (!text) {
      text = "_Thinking..._";
    }
    if (text.length > MAX_ACTIVITY_TEXT_CHARS) {
      text = `${text.slice(0, MAX_ACTIVITY_TEXT_CHARS - 1)}…`;
    }
    return text;
  }
}

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/agui-stream.ts`
```
import { toolStatusLabel } from "./tool-display";
import {
  coerceAskUserQuestionEvent,
  isAskUserQuestionToolName,
  type AskUserQuestionEvent,
} from "./ask-user-format";

export interface AGUIJsonPatchOp {
  op: string;
  path: string;
  value?: unknown;
}

export interface AGUIEventEnvelope {
  type?: string;
  runId?: string;
  parentRunId?: string;
  name?: string;
  value?: unknown;
  delta?: unknown;
  message?: string;
  result?: unknown;
  snapshot?: unknown;
  stepName?: string;
  toolCallId?: string;
  toolCallName?: string;
  displayName?: string;
  status?: string;
  content?: unknown;
  resultSummary?: string;
  messageId?: string;
  [key: string]: unknown;
}

export interface SlackStreamEvent {
  event: string;
  data: unknown;
}

export interface SlackArtifactPayload {
  artifactId?: string;
  fileName?: string;
  downloadUrl?: string;
  mimeType?: string;
  recordId?: string;
  visibility?: string;
  [key: string]: unknown;
}

export interface SlackConversationComplete {
  _id: string;
  messages: Array<{
    content?: string;
    citations?: unknown[];
    messageType?: string;
  }>;
  [key: string]: unknown;
}

export interface SlackAGUICallbacks {
  onStatus?: (message: string) => void;
  onReasoning?: (delta: string, done: boolean) => void;
  /**
   * Settled root TEXT_MESSAGE preamble that preceded a tool call — same
   * narration the frontend keeps in the activity timeline.
   */
  onNarration?: (text: string) => void;
  onToolStart?: (toolName: string, displayName?: string) => void;
  onToolResult?: (
    toolName: string,
    displayName?: string,
    status?: string,
  ) => void;
  onSubAgent?: (role: string, phase: "started" | "completed" | "failed") => void;
  /** Full current answer text (caller diffs against last streamed length). */
  onAnswerAccumulated?: (accumulated: string) => void;
  onClearAnswerPreamble?: () => void;
  onAskUserQuestion?: (payload: AskUserQuestionEvent) => void;
  onArtifact?: (artifact: SlackArtifactPayload) => void;
  onConversationCreated?: (conversationId: string) => void;
  onComplete?: (conversation: SlackConversationComplete) => void;
  onError?: (message: string) => void;
}

interface AGUIStreamState {
  citations: unknown[];
  normalizedAnswer: string;
  confidence?: string;
  rawLength: number;
}

function asEnvelope(data: unknown): AGUIEventEnvelope | undefined {
  if (!data || typeof data !== "object") return undefined;
  return data as AGUIEventEnvelope;
}

function applyStatePatch(
  state: AGUIStreamState,
  ops: AGUIJsonPatchOp[],
): AGUIStreamState {
  let next = state;
  for (const op of ops) {
    if (op.op !== "replace" && op.op !== "add") continue;
    if (op.path === "/citations" && Array.isArray(op.value)) {
      next = { ...next, citations: op.value };
    } else if (op.path === "/normalizedAnswer" && typeof op.value === "string") {
      next = { ...next, normalizedAnswer: op.value };
    } else if (
      op.path === "/confidence" &&
      (typeof op.value === "string" || op.value === null)
    ) {
      next = { ...next, confidence: (op.value as string | null) ?? undefined };
    } else if (op.path === "/rawLength" && typeof op.value === "number") {
      next = { ...next, rawLength: op.value };
    }
  }
  return next;
}

function extractConversation(
  result: unknown,
): SlackConversationComplete | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  const conversation = record.conversation;
  if (!conversation || typeof conversation !== "object") return null;
  const conv = conversation as SlackConversationComplete;
  if (typeof conv._id !== "string") return null;
  return conv;
}

/**
 * Minimal root-run tracker: root runIds are registered on RUN_STARTED without
 * parentRunId; child runs (with parentRunId) are ignored for answer streaming.
 */
class RootRunTracker {
  private rootRunIds = new Set<string>();
  private childRunIds = new Set<string>();
  private pendingRoleByParent = new Map<string, string>();
  private childRoleByRunId = new Map<string, string>();

  handleStepStarted(stepName: string, runId?: string): string | null {
    if (!stepName.startsWith("sub_agent:") || !runId) return null;
    const role = stepName.slice("sub_agent:".length);
    this.pendingRoleByParent.set(runId, role);
    return role;
  }

  handleRunStarted(runId?: string, parentRunId?: string): string | null {
    if (!runId) return null;
    if (!parentRunId) {
      this.rootRunIds.add(runId);
      return null;
    }
    this.childRunIds.add(runId);
    const role = this.pendingRoleByParent.get(parentRunId) ?? "sub-agent";
    this.pendingRoleByParent.delete(parentRunId);
    this.childRoleByRunId.set(runId, role);
    return role;
  }

  handleRunEnded(runId?: string): string | null {
    if (!runId) return null;
    const role = this.childRoleByRunId.get(runId) ?? null;
    this.childRunIds.delete(runId);
    this.childRoleByRunId.delete(runId);
    return role;
  }

  isRootRun(runId: string | undefined): boolean {
    if (!runId) return true;
    if (this.childRunIds.has(runId)) return false;
    return true;
  }
}

/**
 * One handler per backend stream. Translates AG-UI frames into Slack-oriented
 * callbacks (mirrors frontend `createAGUIEventHandler`, without parts UI).
 */
export function createSlackAGUIEventHandler(
  callbacks: SlackAGUICallbacks,
): (event: SlackStreamEvent) => void {
  let textBuffer = "";
  let rawTextReceived = 0;
  let state: AGUIStreamState = {
    citations: [],
    normalizedAnswer: "",
    rawLength: 0,
  };
  const runs = new RootRunTracker();
  const toolNameById = new Map<string, { name: string; displayName?: string }>();
  /** Full tool args by call id — TOOL_CALL_RESULT.content is truncated to 200 chars. */
  const toolArgsById = new Map<string, unknown>();
  const askUserEmittedForCall = new Set<string>();

  const emitAnswer = (): void => {
    callbacks.onAnswerAccumulated?.(textBuffer);
  };

  const emitAskUserFromRaw = (raw: unknown, toolCallId?: string): void => {
    if (toolCallId && askUserEmittedForCall.has(toolCallId)) {
      return;
    }
    const askEvent = coerceAskUserQuestionEvent(raw);
    if (!askEvent) {
      return;
    }
    if (toolCallId) {
      askUserEmittedForCall.add(toolCallId);
    }
    callbacks.onAskUserQuestion?.(askEvent);
  };

  return (event: SlackStreamEvent): void => {
    const data = asEnvelope(event.data);
    const type = data?.type ?? event.event;

    switch (type) {
      case "STEP_STARTED": {
        const stepName = typeof data?.stepName === "string" ? data.stepName : "";
        const runId = typeof data?.runId === "string" ? data.runId : undefined;
        const role = runs.handleStepStarted(stepName, runId);
        if (role) {
          callbacks.onStatus?.(`Delegating to ${role}...`);
        }
        break;
      }

      case "RUN_STARTED": {
        const runId = typeof data?.runId === "string" ? data.runId : undefined;
        const parentRunId =
          typeof data?.parentRunId === "string" ? data.parentRunId : undefined;
        const role = runs.handleRunStarted(runId, parentRunId);
        if (role) {
          callbacks.onSubAgent?.(role, "started");
          callbacks.onStatus?.(`Delegating to ${role}...`);
        }
        break;
      }

      case "TEXT_MESSAGE_START": {
        const runId = typeof data?.runId === "string" ? data.runId : undefined;
        if (runs.isRootRun(runId)) {
          textBuffer = "";
          rawTextReceived = 0;
        }
        break;
      }

      case "TEXT_MESSAGE_CONTENT": {
        const delta = typeof data?.delta === "string" ? data.delta : "";
        if (!delta) break;
        const runId = typeof data?.runId === "string" ? data.runId : undefined;
        if (!runs.isRootRun(runId)) break;
        textBuffer += delta;
        rawTextReceived += delta.length;
        emitAnswer();
        break;
      }

      case "TEXT_MESSAGE_END": {
        const runId = typeof data?.runId === "string" ? data.runId : undefined;
        if (runs.isRootRun(runId)) {
          callbacks.onStatus?.("Thinking...");
        }
        break;
      }

      case "REASONING_MESSAGE_CONTENT": {
        const delta = typeof data?.delta === "string" ? data.delta : "";
        const runId = typeof data?.runId === "string" ? data.runId : undefined;
        if (delta && runs.isRootRun(runId)) {
          callbacks.onReasoning?.(delta, false);
        }
        break;
      }

      case "REASONING_END":
        callbacks.onReasoning?.("", true);
        break;

      case "TOOL_CALL_START": {
        const toolCallName =
          typeof data?.toolCallName === "string" ? data.toolCallName : "tool";
        const displayName =
          typeof data?.displayName === "string" ? data.displayName : undefined;
        const toolCallId =
          typeof data?.toolCallId === "string" ? data.toolCallId : undefined;
        if (toolCallId) {
          toolNameById.set(toolCallId, { name: toolCallName, displayName });
        }

        // Settle preamble into the activity timeline before the tool row so
        // narration appears above the tool (same order as the frontend).
        const runId = typeof data?.runId === "string" ? data.runId : undefined;
        if (textBuffer && runs.isRootRun(runId)) {
          const narration = textBuffer.trim();
          textBuffer = "";
          rawTextReceived = 0;
          state = { ...state, normalizedAnswer: "", rawLength: 0 };
          if (narration) {
            callbacks.onNarration?.(narration);
          }
          callbacks.onClearAnswerPreamble?.();
          emitAnswer();
        }

        callbacks.onStatus?.(`${toolStatusLabel(toolCallName)}...`);
        callbacks.onToolStart?.(toolCallName, displayName);
        break;
      }

      case "TOOL_CALL_ARGS": {
        // Full ask_user args arrive here. TOOL_CALL_RESULT.content is
        // truncated to 200 chars in tool_loop.py, so JSON pa
```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/ask-user-format.ts`
```
export interface AskUserQuestionOption {
  id: string;
  label: string;
  isUserInput?: boolean;
}

export interface AskUserQuestionItem {
  uuid: string;
  question: string;
  options: AskUserQuestionOption[];
  multiSelect?: boolean;
}

export interface AskUserQuestionPayload {
  name?: string;
  userIntent?: string;
  questions: AskUserQuestionItem[];
}

export interface AskUserQuestionEvent {
  status?: string;
  toolData?: AskUserQuestionPayload;
}

export function isAskUserQuestionToolName(toolName: string): boolean {
  const name = toolName.trim().toLowerCase();
  return (
    name === "ask_user_question" ||
    name.endsWith("__ask_user_question") ||
    name.endsWith("_ask_user_question") ||
    name.endsWith(".ask_user_question")
  );
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeQuestions(raw: unknown): AskUserQuestionItem[] {
  if (!Array.isArray(raw)) return [];
  const questions: AskUserQuestionItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const question =
      typeof q.question === "string"
        ? q.question
        : typeof q.prompt === "string"
          ? q.prompt
          : "";
    if (!question.trim()) continue;
    const uuid =
      (typeof q.uuid === "string" && q.uuid) ||
      (typeof q.id === "string" && q.id) ||
      `q-${questions.length + 1}`;
    questions.push({
      uuid,
      question: question.trim(),
      options: Array.isArray(q.options)
        ? (q.options as AskUserQuestionOption[])
        : [],
      multiSelect: Boolean(q.multiSelect),
    });
  }
  return questions;
}

/**
 * Accepts CUSTOM `{status,toolData}`, raw tool result, or tool args and
 * returns a normalized ask-user event (or null when no questions exist).
 */
export function coerceAskUserQuestionEvent(
  raw: unknown,
): AskUserQuestionEvent | null {
  const obj = parseJsonObject(raw);
  if (!obj) return null;

  const toolDataRaw =
    obj.toolData && typeof obj.toolData === "object"
      ? (obj.toolData as Record<string, unknown>)
      : obj;

  const questions = normalizeQuestions(toolDataRaw.questions);
  if (questions.length === 0) return null;

  const userIntent =
    (typeof toolDataRaw.userIntent === "string" && toolDataRaw.userIntent) ||
    (typeof toolDataRaw.user_intent === "string" && toolDataRaw.user_intent) ||
    undefined;

  return {
    status: typeof obj.status === "string" ? obj.status : "success",
    toolData: {
      name:
        typeof toolDataRaw.name === "string"
          ? toolDataRaw.name
          : "ask_user_question",
      ...(userIntent ? { userIntent } : {}),
      questions,
    },
  };
}

/** Formats ask_user_question tool data as plain Slack mrkdwn (questions only). */
export function formatAskUserQuestionMrkdwn(
  event: AskUserQuestionEvent,
): string | null {
  const normalized = coerceAskUserQuestionEvent(event);
  const questions = normalized?.toolData?.questions;
  if (!questions || questions.length === 0) {
    return null;
  }

  const lines: string[] = ["*I need a bit more information:*"];

  const intent =
    typeof normalized.toolData?.userIntent === "string"
      ? normalized.toolData.userIntent.trim()
      : "";
  if (intent) {
    lines.push(`_${intent}_`);
  }

  questions.forEach((q, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${q.question}`);
  });

  lines.push("");
  lines.push("_Reply in this thread with your answers._");
  return lines.join("\n");
}

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/citations.ts`
```
/**
 * Slack citation helpers.
 *
 * The LLM emits citations as `[source](refN)` / `[source](https://refN.xyz)`.
 * The web UI rewrites those into numbered chips; Slack's markdown→mrkdwn
 * converter turns them into broken `<refN|source>` links. Rewrite resolvable
 * numbered citations and strip remaining tiny-ref links before conversion.
 */

export type SlackCitationLike = {
  citationData: {
    chunkIndex?: string | number;
    metadata: {
      recordId?: string;
      recordType?: string;
      webUrl?: string;
      connector?: string;
    };
  };
};

/** `[label](refN)` or `[label](https://refN.xyz[/...])` */
const TINY_REF_CITATION_LINK_PATTERN =
  /\[[^\]]*\]\s*\(\s*(?:https?:\/\/)?ref\d+(?:\.xyz)?(?:\/[^)]*)?\s*\)/gi;

/** Any `[N](target)` markdown link */
const NUMBERED_MARKDOWN_LINK_PATTERN = /\[(\d+)\]\(([^)]+)\)/g;

function parseCitationNumber(rawValue: unknown): number | null {
  if (typeof rawValue === "number" && Number.isInteger(rawValue) && rawValue > 0) {
    return rawValue;
  }
  if (typeof rawValue !== "string") {
    return null;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeFrontendBaseUrl(frontendBaseUrl: string): string {
  return (frontendBaseUrl || "http://localhost:3000").replace(/\/$/, "");
}

function absolutizeWebUrl(webUrl: string, frontendBaseUrl: string): string {
  const trimmed = webUrl.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const base = normalizeFrontendBaseUrl(frontendBaseUrl);
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

function resolveCitationWebUrl(
  citation: SlackCitationLike,
  frontendBaseUrl: string,
): string {
  const meta = citation.citationData.metadata;
  const base = normalizeFrontendBaseUrl(frontendBaseUrl);

  if (meta.recordType === "FILE" && meta.connector !== "WEB" && meta.recordId) {
    return `${base}/record/${meta.recordId}`;
  }

  const fromWebUrl = absolutizeWebUrl(meta.webUrl || "", frontendBaseUrl);
  if (fromWebUrl) {
    return fromWebUrl;
  }

  if (meta.recordId) {
    return `${base}/record/${encodeURIComponent(meta.recordId)}`;
  }

  return "";
}

function isTinyRefTarget(target: string): boolean {
  return /^(?:https?:\/\/)?ref\d+(?:\.xyz)?(?:\/.*)?$/i.test(target.trim());
}

/** Remove `[source](refN)` / `[N](refN)` / tiny-web-ref links. */
export function stripTinyRefCitationLinks(text: string): string {
  if (!text) {
    return "";
  }
  return text.replace(TINY_REF_CITATION_LINK_PATTERN, "");
}

/**
 * Rewrite numbered citation links using citation metadata, then strip any
 * remaining tiny-ref links so markdown→mrkdwn cannot emit `<refN|source>`.
 */
export function rewriteCitationsForSlack(
  answerBody: string,
  citations: SlackCitationLike[] | undefined,
  frontendBaseUrl: string,
): string {
  if (!answerBody) {
    return "";
  }

  const citationNumberToUrl = new Map<number, string>();
  for (const citation of citations || []) {
    const citationNumber = parseCitationNumber(citation.citationData.chunkIndex);
    if (!citationNumber || citationNumberToUrl.has(citationNumber)) {
      continue;
    }
    const citationWebUrl = resolveCitationWebUrl(citation, frontendBaseUrl);
    if (!citationWebUrl) {
      continue;
    }
    citationNumberToUrl.set(citationNumber, citationWebUrl);
  }

  let citationCount = 1;
  const webUrlToDisplayNumber = new Map<string, number>();

  let text = answerBody.replace(
    NUMBERED_MARKDOWN_LINK_PATTERN,
    (match, citationNumberText: string, target: string) => {
      const citationNumber = Number.parseInt(citationNumberText, 10);
      if (!Number.isInteger(citationNumber) || citationNumber <= 0) {
        return match;
      }

      const mappedUrl = citationNumberToUrl.get(citationNumber);
      if (mappedUrl) {
        let displayNumber = webUrlToDisplayNumber.get(mappedUrl);
        if (displayNumber === undefined) {
          displayNumber = citationCount;
          webUrlToDisplayNumber.set(mappedUrl, citationCount);
          citationCount += 1;
        }
        return `[${displayNumber}](${mappedUrl})`;
      }

      // Unmapped tiny refs become broken Slack links — drop them.
      if (isTinyRefTarget(target)) {
        return "";
      }

      return match;
    },
  );

  return stripTinyRefCitationLinks(text);
}

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/conversation.ts`
```
import { Conversation } from './db';

interface SaveToDatabaseParams {
  threadId: string;
  conversationId: string;
  botId: string;
  email: string;
}

export const saveToDatabase = async ({
  threadId,
  conversationId,
  botId,
  email,
}: SaveToDatabaseParams): Promise<void> => {
  try {
    await Conversation.updateOne(
      { threadId, botId, email },
      { $set: { conversationId } },
      { upsert: true },
    );
  } catch (error) {
    console.error('Error saving to database:', error);
    throw new Error('Failed to save to database');
  }
};

export const getFromDatabase = async (
  threadId: string,
  botId: string,
  email: string,
): Promise<string | null> => {
  try {
    const record = await Conversation.findOne({ threadId, botId, email });
    if (record) {
      return record.conversationId;
    } else {
      console.log(`No record found for threadId=${threadId}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching from database:', error);
    throw new Error('Failed to fetch from database');
  }
};

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/db.ts`
```
import { connect as __connect, Schema, model, ConnectOptions } from 'mongoose';
import { MONGO_DB_NAME } from '../../../../libs/enums/db.enum';

import { config } from 'dotenv';

config();

export interface ConversationDocument {
  threadId: string;
  conversationId: string;
  botId: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const connect = async (
    url: string = process.env.MONGO_URI || '',
    opts: ConnectOptions = {},
  ): Promise<void> => {
    if (!url) {
      throw new Error('MONGO_URI environment variable is not set.');
    }
    try {
      await __connect(url, { dbName: MONGO_DB_NAME, ...opts });
      console.log('mongodb running'); // Consider using a proper logger
    } catch (err) {
      console.error('mongodb connection error:', err); // Consider using a proper logger
      throw err; // Re-throw the error to ensure the app fails to start if DB connection fails
    }
  };

const conversationSchema = new Schema<ConversationDocument>(
  {
    threadId: { type: String, required: true },
    conversationId: { type: String, required: true },
    botId: { type: String, required: true },
    email: { type: String, required: true },
  },

  { timestamps: true },
);


export const Conversation = model<ConversationDocument>(
  'Conversation',
  conversationSchema,
  'slack_conversations',
);

/**
 * Checks for and drops the threadId + botId index if it exists.
 * This is useful for removing legacy indexes.
 */
export const dropLegacyThreadBotIndex = async (): Promise<void> => {
  try {
    const indexes = await Conversation.collection.getIndexes();
    // Look for an index that has threadId and botId as keys
    for (const [indexName, _] of Object.entries(indexes)) {
      // Skip the _id index
      if (indexName === '_id_') {
        continue;
      }

      console.log(`Dropping legacy index: ${indexName}`);
      await Conversation.collection.dropIndex(indexName);
      console.log(`Successfully dropped legacy index: ${indexName}`);
    }

  } catch (error) {
    console.warn('Error checking/dropping legacy index/the index does not exist');
  }
};

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/md_to_mrkdwn.ts`
```
/**
 * Converts standard Markdown to Slack-compatible mrkdwn format.
 *
 * Key transformations:
 *  - **bold** / __bold__        → *bold*
 *  - *italic* / _italic_        → _italic_
 *  - ~~strikethrough~~          → ~strikethrough~
 *  - [text](url)                → <url|text>
 *  - ![alt](url)                → <url|alt>
 *  - # Headings                 → *Headings* (bolded)
 *  - > blockquotes              → > blockquotes (preserved)
 *  - `inline code`              → `inline code` (preserved)
 *  - ```code blocks```          → ```code blocks``` (preserved)
 *  - Unordered lists (- / *)    → • bullet
 *  - Ordered lists              → preserved with number
 *  - Horizontal rules           → ———
 *  - Markdown tables            → aligned code block or plain text
 *  - HTML tags                  → stripped
 *
 * Code spans and code blocks are protected from transformation.
 */



interface ConvertOptions {
    /** Preserve original link markdown instead of converting to Slack format */
    preserveLinks?: boolean;
    /** Custom bullet character (default: "•") */
    bulletChar?: string;
    /** Preserve trailing whitespace/newlines for streaming conversion. */
    preserveTrailingWhitespace?: boolean;
    /**
     * How to render tables in Slack:
     * - "code"   → monospaced code block with aligned columns (default)
     * - "text"   → plain text with bold headers and column separators
     */
    tableMode?: "code" | "text";
  }
  
  // ── Table helpers ──────────────────────────────────────────────────────
  
  /** Returns true if a line looks like a markdown table row: | col | col | */
  function isTableRow(line: string): boolean {
    return /^\s*\|.*\|\s*$/.test(line);
  }
  
  /** Returns true if a line is the separator row: | --- | :---: | ---: | */
  function isSeparatorRow(line: string): boolean {
    return /^\s*\|[\s:]*-{3,}[\s:]*(\|[\s:]*-{3,}[\s:]*)*\|\s*$/.test(line);
  }
  
  /** Parse a table row into trimmed cell strings */
  function parseCells(row: string): string[] {
    return row
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim());
  }
  
  /** Detect column alignment from the separator row */
  function parseAlignments(sepRow: string): ("left" | "center" | "right")[] {
    return parseCells(sepRow).map((cell) => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      return "left";
    });
  }
  
  /** Pad a string to a given width respecting alignment */
  function padCell(text: string, width: number, align: "left" | "center" | "right"): string {
    if (align === "right") return text.padStart(width);
    if (align === "center") {
      const total = width - text.length;
      const left = Math.floor(total / 2);
      return " ".repeat(left) + text + " ".repeat(total - left);
    }
    return text.padEnd(width);
  }
  
  /**
   * Find consecutive table lines in the text, parse them, and replace
   * with either a code-block or plain-text representation.
   */
  function convertTables(
    text: string,
    placeholderFn: (content: string) => string,
    mode: "code" | "text" = "code"
  ): string {
    const lines = text.split("\n");
    const result: string[] = [];
    let i = 0;
  
    while (i < lines.length) {
      const headerLine = lines[i];
      const separatorLine = lines[i + 1];
      // Need at least: header row, separator row, one data row
      if (
        headerLine !== undefined &&
        separatorLine !== undefined &&
        isTableRow(headerLine) &&
        isSeparatorRow(separatorLine)
      ) {
        // Collect all consecutive table rows
        const headerCells = parseCells(headerLine);
        const alignments = parseAlignments(separatorLine);
        const dataRows: string[][] = [];
        i += 2; // skip header + separator
        while (i < lines.length) {
          const rowLine = lines[i];
          if (rowLine === undefined || !isTableRow(rowLine)) break;
          dataRows.push(parseCells(rowLine));
          i++;
        }
  
        const allRows = [headerCells, ...dataRows];
        const colCount = Math.max(...allRows.map((r) => r.length));
  
        // Normalize row lengths
        for (const row of allRows) {
          while (row.length < colCount) row.push("");
        }
        // Ensure alignments array matches
        while (alignments.length < colCount) alignments.push("left");
  
        // Compute column widths
        const colWidths = Array.from({ length: colCount }, (_, ci) =>
          Math.max(...allRows.map((r) => (r[ci] ?? "").length))
        );
  
        if (mode === "code") {
          // ── Code block table ──
          const rendered: string[] = [];
          // Header
          rendered.push(
            "| " +
              headerCells
                .map((c, ci) => padCell(c, colWidths[ci] ?? 0, alignments[ci] ?? "left"))
                .join(" | ") +
              " |"
          );
          // Separator
          rendered.push(
            "| " +
              colWidths.map((w) => "-".repeat(w)).join(" | ") +
              " |"
          );
          // Data rows
          for (const row of dataRows) {
            rendered.push(
              "| " +
                row
                  .map((c, ci) => padCell(c, colWidths[ci] ?? 0, alignments[ci] ?? "left"))
                  .join(" | ") +
                " |"
            );
          }
          result.push(placeholderFn("```\n" + rendered.join("\n") + "\n```"));
        } else {
          // ── Plain text table ──
          // *Header1* | *Header2* | *Header3*
          // Value1    | Value2    | Value3
          const headerLine = headerCells
            .map((c, ci) => `*${padCell(c, colWidths[ci] ?? 0, alignments[ci] ?? "left").trim()}*`)
            .join("  |  ");
          result.push(placeholderFn(headerLine));
          for (const row of dataRows) {
            const dataLine = row
              .map((c, ci) => padCell(c, colWidths[ci] ?? 0, alignments[ci] ?? "left").trim())
              .join("  |  ");
            result.push(placeholderFn(dataLine));
          }
        }
      } else {
        result.push(lines[i] ?? "");
        i++;
      }
    }
  
    return result.join("\n");
  }
  
  export function markdownToSlackMrkdwn(
    markdown: string,
    options: ConvertOptions = {}
  ): string {


    const {
      preserveLinks = false,
      bulletChar = "•",
      tableMode = "code",
      preserveTrailingWhitespace = false,
    } = options;
  
    if (!markdown) return "";
    markdown = markdown.replace(/\\n/g, "\n");

    // ── Step 1: Extract and protect code blocks & inline code ──────────
    // We replace them with placeholders so regex transforms don't touch them.
  
    const placeholders: string[] = [];
  
    function placeholder(content: string): string {
      const idx = placeholders.length;
      placeholders.push(content);
      return `\x00PLACEHOLDER_${idx}\x00`;
    }
    
    markdown = markdown.replace(/&amp;/g, '&amp;amp;');
    markdown = markdown.replace(/&lt;/g, '&amp;lt;');
    markdown = markdown.replace(/&gt;/g, '&amp;gt;');

    // Protect fenced code blocks (``` ... ```)
    let text = markdown.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match, _lang, code) => placeholder("```\n" + code.trimEnd() + "\n```")
    );
  
    // Protect inline code (` ... `)
    text = text.replace(/`([^`\n]+)`/g, (_match, code) =>
      placeholder("`" + code + "`")
    );
  
    // ── Step 1b: Convert Markdown tables → code block (monospaced) ─────
    // Slack has no table syntax, so we render as an aligned code block.
  
    text = convertTables(text, placeholder, tableMode);

    // ── Step 1c: Escape &, <, > for Slack ──────────────────────────────
    // Run AFTER code/table extraction so content inside backticks and
    // code fences is not escaped.
    text = escapeForSlack(text);

    // ── Step 2: Line-level transformations ─────────────────────────────
  
    const lines = text.split("\n");
    const transformed: string[] = [];
  
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i] ?? "";
  
      // --- Horizontal rules ---
      if (/^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/.test(line)) {
        transformed.push("———");
        continue;
      }
  
      // --- Headings (# … ######) → *bold text* ---
      const headingMatch = line.match(/^(#{1,6})\s+(.+?)(\s*#*\s*)$/);
      if (headingMatch) {
        transformed.push(placeholder(`*${(headingMatch[2] ?? "").trim()}*`));
        continue;
      }
  
      // --- Unordered list items (-, *, +) → • ---
      const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
      if (ulMatch) {
        const indent = (ulMatch[1] ?? "").replace(/\t/g, "    ");
        // Nest with 2-space indentation per level
        const level = Math.floor(indent.length / 2);
        const prefix = "  ".repeat(level) + bulletChar + " ";
        line = prefix + (ulMatch[2] ?? "");
      }
  
      // --- Ordered list items: keep numbering, just normalize ---
      const olMatch = line.match(/^(\s*)\d+[.)]\s+(.*)/);
      if (olMatch && !ulMatch) {
        const indent = (olMatch[1] ?? "").replace(/\t/g, "    ");
        const level = Math.floor(indent.length / 2);
        // Re-derive the visual number (Slack doesn't auto-number)
        const prefix = "  ".repeat(level);
        line = prefix + line.trimStart();
      }
  
      // --- Blockquotes: > text (Slack uses the same syntax) ---
      // Ensure exactly one space after >
      line = line.replace(/^(\s*)>\s?/, "$1> ");
  
      transformed.push(line);
    }
  
    text = transformed.join("\n");
  
    // ── Step 3: Inline transformations ─────────────────────────────────
  
    // Images: ![alt](url) → <url|alt>
    if (!preserveLinks) {
      text = text.replace(
        /!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)/g,
        (_m, alt, url) => (alt ? `<${
```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/parse-artifact-markers.ts`
```
export interface ParsedSlackArtifact {
  fileName: string;
  downloadUrl: string;
  mimeType: string;
  recordId?: string;
}

const RECORD_PLACEHOLDER_PREFIX = "record:";

/**
 * Strip `::artifact[...]` markers from assistant content (frontend does this
 * via parseArtifactMarkers and renders an Artifacts panel instead).
 * Also returns any markers that carry a real download URL.
 */
export function parseArtifactMarkers(content: string): {
  text: string;
  artifacts: ParsedSlackArtifact[];
} {
  const artifacts: ParsedSlackArtifact[] = [];
  const seen = new Set<string>();

  let text = content.replace(
    /::artifact\[([^\]]+)\]\(([^)]+)\)\{([^}]*)\}/g,
    (_match, fileName: string, url: string, meta: string) => {
      const [mime = "", , recordId = ""] = String(meta).split("|");
      const cleanName = String(fileName).trim() || "artifact";
      const rawUrl = String(url).trim();
      const fromPlaceholder = rawUrl.startsWith(RECORD_PLACEHOLDER_PREFIX)
        ? rawUrl.slice(RECORD_PLACEHOLDER_PREFIX.length).trim()
        : "";
      const cleanUrl = fromPlaceholder ? "" : rawUrl;
      const cleanRecordId = recordId.trim() || fromPlaceholder;
      const dedupeKey = `${cleanRecordId || cleanUrl}:${cleanName}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        artifacts.push({
          fileName: cleanName,
          downloadUrl: cleanUrl,
          mimeType: mime.trim() || "application/octet-stream",
          ...(cleanRecordId ? { recordId: cleanRecordId } : {}),
        });
      }
      return "";
    },
  );

  // Remnant / hallucinated short forms — strip entirely.
  text = text.replace(/::artifact\[[^\]]+\](?:\([^)]*\))?(?:\{[^}]*\})?/g, "");
  // Legacy download-task markers (frontend also strips these).
  text = text.replace(/::download_conversation_task\[[^\]]+\]\([^)]*\)/g, "");

  return { text: text.replace(/\n{3,}/g, "\n\n").trimEnd(), artifacts };
}

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/utils/tool-display.ts`
```
/**
 * The five `load_skill`/`skill_search`/... tools (see
 * `backend/python/app/agent_loop_lib/tools/builtin/data/skills.py`) go over
 * AG-UI as ordinary `TOOL_CALL_*` frames — there is no protocol-level
 * "skill" event. Mirrors the frontend's `tool-display.ts` map exactly so
 * Slack status lines read the same as the dashboard's; must stay
 * exact-name-keyed (no `{app}__` prefix on these built-ins) and never
 * assume `displayName` is present, since it covers chats/messages
 * persisted before the backend started setting it too.
 */
const SKILL_TOOL_LABELS: Record<string, { present: string; past: string }> = {
  skills_list: { present: "Listing skills", past: "Listed skills" },
  skill_search: { present: "Searching skills", past: "Searched skills" },
  load_skill: { present: "Loading skill", past: "Loaded skill" },
  load_skill_resource: { present: "Loading skill file", past: "Loaded skill file" },
  skill_manage: { present: "Managing skill", past: "Managed skill" },
};

/** Drops any `{app}__` namespace prefix, splits on separators, title-cases. */
export function humanizeToolName(name: string): string {
  const segment = name.includes("__")
    ? name.slice(name.lastIndexOf("__") + 2)
    : name;
  const words = segment.split(/[_\-\s]+/).filter(Boolean);
  if (words.length === 0) return "Used a tool";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** Past-tense label for completed tool rows in the activity timeline. */
export function toolActivityLabel(
  toolName: string | undefined,
  displayName?: string,
): string {
  if (displayName) return displayName;
  if (!toolName) return "Used a tool";
  return SKILL_TOOL_LABELS[toolName]?.past ?? humanizeToolName(toolName);
}

/** Present-tense label for in-progress tool status. */
export function toolStatusLabel(toolName: string, displayName?: string): string {
  if (displayName) return displayName;
  return SKILL_TOOL_LABELS[toolName]?.present ?? `Using ${humanizeToolName(toolName)}`;
}

```

### Core Architecture Module: `backend/nodejs/apps/src/libs/utils/address.utils.ts`
```
import { jurisdictions } from "./juridiction.utils";
export interface Address{
    addressLine1?: string;
    city?: string;
    state?: string;
    postCode?: string;
    country?: jurisdictions;
}
```

### Core Architecture Module: `backend/nodejs/apps/src/libs/utils/concurrency.util.ts`
```
/**
 * Bounded-concurrency helpers for fanning out async work without serializing it
 * behind a single slow item or, conversely, flooding a downstream service with
 * an unbounded number of in-flight requests.
 */

/**
 * Runs `mapper` over `items` with at most `limit` invocations in flight at once,
 * returning results in input order.
 *
 * It is a fixed-size worker pool: `limit` workers each pull the next unclaimed
 * item, await it, then pull the next. So a single slow item (e.g. a large file
 * upload) only ever occupies ONE slot — the remaining items keep flowing through
 * the other workers instead of waiting in line behind it. This is the fix for a
 * mixed upload batch where one big file otherwise stalls every smaller file.
 *
 * **Abort-on-first-error:** if any `mapper` call rejects, the error is captured
 * and every worker stops claiming new items. Items already in flight run to
 * completion (or rejection), but no *new* items are started. After all workers
 * settle, the first captured error is re-thrown — preventing runaway unhandled
 * rejections from items started after a failure.
 *
 * `mapper` is expected to handle its own per-item errors when partial failures
 * are acceptable (e.g. record a failure and return a sentinel). If it rejects,
 * the returned promise rejects with that error and items not yet started are
 * skipped.
 *
 * @param items  The work items. An empty array resolves to `[]`.
 * @param limit  Max concurrent invocations. Clamped to `[1, items.length]`.
 * @param mapper Async function applied to each item; receives `(item, index)`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  if (items.length === 0) return results;

  const workerCount = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let next = 0;
  let firstError: unknown = null;

  const worker = async (): Promise<void> => {
    // Claim-and-advance the shared cursor. JS is single-threaded, so the
    // read+increment is atomic with respect to the other workers.
    while (next < items.length && !firstError) {
      const current = next;
      next += 1;
      try {
        // In-bounds by the loop guard; cast past noUncheckedIndexedAccess.
        results[current] = await mapper(items[current] as T, current);
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (firstError) throw firstError;
  return results;
}

```

### Core Architecture Module: `backend/nodejs/apps/src/libs/utils/counter.ts`
```
import mongoose, { Schema, Model } from 'mongoose';
import slug from 'slug';
import { Logger } from '../services/logger.service';
import { isDuplicateKeyError } from './mongo.utils';

const logger = Logger.getInstance();

interface CounterDocument {
  _id: string;
  name?: string;
  seq: number;
}

const counterSchema = new Schema<CounterDocument>({
  _id: { type: String, required: true },
  // Unique so two creates racing on a fresh database cannot each insert their
  // own counter for the same name. Without it the upsert below filtered on a
  // non-unique field, so on an empty collection both inserts succeeded, both
  // returned seq 1, and the callers built the same slug — which then collided
  // on the unique slug index and returned HTTP 500 on the second create.
  name: { type: String, unique: true },
  seq: { type: Number, default: 1000 },
});

export const Counter: Model<CounterDocument> =
  mongoose.models.Counter ??
  mongoose.model<CounterDocument>('Counter', counterSchema);

const MAX_ATTEMPTS = 5;

// Mongoose builds schema indexes in the background once connected, so requests
// can be served before `name` is unique — and until it is, two concurrent
// upserts on a fresh database can each insert a counter, which is the collision
// this index exists to stop. Wait for the build rather than rely on that race.
// A build that fails, which an existing database already holding duplicate
// counter names would, is logged once rather than raised: slug creation keeps
// working exactly as it did before, and the retry below still resolves what it
// can.
let missingIndexWarned = false;

const ensureNameIndexBuilt = async (): Promise<void> => {
  try {
    // Idempotent and cheap: mongoose caches the build and hands back the same
    // promise on every call.
    await Counter.init();
  } catch (err) {
    if (!missingIndexWarned) {
      missingIndexWarned = true;
      logger.warn(
        'Counter "name" index could not be built; concurrent creates on a fresh database may still collide',
        { error: err instanceof Error ? err.message : String(err) },
      );
    }
  }
};

const getNextSequence = async (name: string): Promise<number> => {
  await ensureNameIndexBuilt();
  // With `name` unique, the loser of the fresh-database insert race gets a
  // duplicate-key error here instead of a second counter document. Retrying
  // then finds the counter the winner just inserted and increments it, so the
  // two callers receive different sequence numbers rather than the same one.
  for (let attempt = 1; ; attempt++) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      return counter.seq;
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw err;
    }
  }
};

export const generateUniqueSlug = async (name: string): Promise<string> => {
  const counter = await getNextSequence(name);
  return slug(`${name}-${String(counter)}`);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3882** (2026-10-05): **[BUG] Response get chopped after 15 agent turns limit, leaving things unfinished and immediately stopped**
  *Symptoms*: **Describe the bug** Due to the max turn limit, the hard coded agent limit causing the response to fail. When document count grows, the agent will need a lot of turns in order to fully prepare for response.  **To Reproduce** Steps to reproduce the behavior: 1. Prompt anything that required a long turn (e.g. Organize a file for interns to understand our company development pipeline) 2. If the agent still preparing for things, once it hits 15 turns and it fails.  **Expected behavior** Except for loops, other normal prompting behaviour should not get cut off while agent still doing the work.  **Screenshots**  **Environment (please complete the following information):**  - Version/Commit ID: cc86fb341   **Related issues** Please link to any related issues.  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Fixed in #3808 

- **Issue #3516** (2026-09-26): **[BUG] Gemini 429 and 503 embedding errors are never retried, so searches fail with HTTP 500**
  *Symptoms*: **Describe the bug** A Gemini rate limit (429) or outage (502, 503, 504) on an embedding call is never retried. OpenAI-compatible providers get up to 3 attempts for the same errors.  The shared retry policy, `is_retriable_embedding_error` in `app/utils/embedding_retry.py`, only recognises OpenAI SDK exceptions. The Gemini embedder is LangChain's `GoogleGenerativeAIEmbeddings`, and it raises `GoogleGenerativeAIError` chained from the google-genai `APIError` that carries the HTTP code. The policy doesn't recognise that, so the first failure is final.  Both embedding paths use this policy, so both are affected:  - Search. The query embedding is wrapped in `await_with_retry` (`retrieval_service.py`), but a Gemini 429 is re-raised on the first attempt. It ends up in the catch-all "Filtered search failed" handler, and the user gets HTTP 500 "Something went wrong while PipesHub tried to search". A second search a few seconds later works. - Indexing. `_embed_documents_with_retry` (`vectorstore.py`) gives up on the batch at once, so a throttled bulk sync fails documents instead of slowing down.  Gemini returns 429 well under the published quota. I saw it at 564 of 3,000 requests per minute, with a generic "Resource exhausted. Please try again later" and no quota named. So this can hit any Gemini deployment under load.  **To Reproduce** With the live stack: 1. Configure Gemini as the embedding provider, for example `gemini-embedding-2`. 2. Run many searches and uploads in the same minu

- **Issue #3491** (2026-09-26): **[BUG] Arango HTTP client closes its session when called from a second event loop, failing in-flight indexing queries**
  *Symptoms*: **Describe the bug** `ArangoHTTPClient` keeps one aiohttp session. When it gets a call from a different event loop, it closes that session and opens a new one (`app/services/graph_db/arango/arango_http_client.py`, `_get_session`).  The indexing service calls the same client from two loops at the same time. Record processing runs on the consumer's worker loop (thread `indexing-worker_0`). Stale-record recovery (every 60 s) and the vector membership backfill (every 30 s) run on the main loop, because `indexing_main.py` moves them to the worker loop only for Neo4j. So a recovery or backfill tick can close the session under queries that are still running on the worker loop.  Those queries fail with `ServerDisconnectedError: Server disconnected` or `RuntimeError: Session is closed`. It only happens when a query is in flight during a tick, so it shows up under bulk ingest and almost never on a quiet instance.  Valid files then fail. It shows up in two ways.  - A record that gets `Session is closed` fails for good. `Session is closed` is a plain `RuntimeError`, so the error classifier doesn't see a network error. It sees the `DocumentProcessingError` wrapper and marks the message terminal. The record is dead-lettered after one attempt and the user is told "We couldn't read this file. It may be damaged or in a format we can't open." - A record that gets `Server disconnected` is retried 15 s later, but the retry does nothing. The error hit the enrichment step, after `indexingStatus` w

- **Issue #3243** (2026-09-11): **[BUG] Chat cannot read images in collection PDFs, but direct image uploads work**
  *Symptoms*: **Describe the bug**  Chat could not read information from images inside a collection PDF, although uploading the same image directly worked with the same multimodal model.  Tracing confirmed that PipesHub had retrieved image parts internally, but sent no images to the chat endpoint.  **To Reproduce**  Steps to reproduce the behavior:  1. Configure a multimodal model through an OpenAI-compatible Chat Completions endpoint. 2. Index a PDF containing an image with text or numbers. 3. Select its collection in a fresh chat and ask about information in the image. 4. Compare with a fresh chat using the image as a direct attachment.  The failure occurs when duplicate image parts exceed the configured image cap. In the reproduced case, four image parts represented two distinct images, with a cap of two.  **Expected behavior**  Retrieved PDF images should reach the model within the image limit, just as directly attached images do.  **Screenshots**  （none.）  **Environment (please complete the following information):**  - OS: Ubuntu Linux 26.04 - Deployment: Docker Compose - PipesHub version/commit: latest upstream   **Related issues** Please link to any related issues.  **Additional context**  Deduplication keeps the later image copies in tool results and removes their earlier user-message copies. Conversion then strips the tool-result images for endpoint compatibility, leaving no images in the outgoing request. 

- **Issue #3096** (2026-09-17): **[BUG] ServiceNow: an indexed record is never rewritten, so article edits never reach search**
  *Symptoms*: **Describe the bug**  For a record that already exists, the document write happens in exactly one place, `_handle_updated_record`, and it is reached only through this test in `data_source_entities_processor.py`:  ```python if record.external_revision_id != existing_record.external_revision_id:     await self._handle_updated_record(record, existing_record, tx_store) ```  The ServiceNow connector never sets `external_revision_id`. The string does not appear anywhere in `connector.py`, so the field keeps its model default of `None`, `None != None` is false, and for every already-indexed article:  - the stored document is never rewritten, so name, `webUrl` and timestamps all   keep their first-index values; - `indexingStatus` stays `COMPLETED`, so no re-index event is published and   changed content is never re-embedded.  Permissions are unaffected, because `_handle_record_permissions` is called unconditionally. That asymmetry is why a knowledge-base grant does propagate to existing articles while the articles themselves stay frozen.  **To Reproduce**  1. Sync a ServiceNow instance and note an article's title in PipesHub. 2. Edit that article's `short_description` in ServiceNow. 3. Run a delta sync. The log reports `Articles synced: 1`, so the connector did    read the change. 4. The stored record is unchanged, and search still returns the old text.  Note: with knowledge versioning on, a published article cannot be edited through the Table API at all (`403 ACL Exception`), so ste

- **Issue #3095** (2026-09-17): **[BUG] ServiceNow: an API error mid-pagination is swallowed, so a partial sync reports success**
  *Symptoms*: **Describe the bug**  Ten paginated reads in the ServiceNow connector handle a Table API failure the same way, by logging it and leaving the loop:  ```python except ServiceNowAPIError as e:     self.logger.error(f"❌ API error: {e.message} (status: {e.status_code})")     break ```  The sync then continues with whatever arrived before the failure and reports success. Nothing downstream can tell a short list from a complete one.  For five of them the result is data loss rather than staleness, because the caller deletes the permission edges of every entity in the list before rewriting them, so a page that fails partway *removes* access the connector then cannot rebuild. The others go silently incomplete, and the article and category reads additionally write a sync checkpoint across the window they never finished, so those rows are not fetched again until something else changes them.  The record writer has the same silence: `_process_record_updates_batch` drops any record whose permission list resolves to empty and returns nothing, so the sync logs more articles than it wrote.  **To Reproduce**  1. Sync an instance with more than one page (100 rows) of `sys_user_grmember`. 2. Make the second page fail. Throttling, a network blip, or a temporary ACL    change on `sys_user_grmember` will all do it. 3. The sync completes and logs success. 4. Permissions derived from the rows on the failed page are gone, and the next    delta sync does not restore them because the checkpoint moved.  *

- **Issue #3094** (2026-09-17): **[BUG] ServiceNow: a revoked knowledge-base grant is never withdrawn, and one membership insert empties a group**
  *Symptoms*: **Describe the bug**  Two reads in the ServiceNow connector paginate on a `sys_updated_on` watermark and hand the result to a caller that *replaces* what it finds rather than merging. The combination loses permissions in both directions.  `_fetch_all_memberships` reads `sys_user_grmember` as a delta. `on_new_user_groups` then deletes every permission edge pointing at a group before writing the members it was given. Any group whose membership rows did not change inside the delta window is written with no members, which empties it.  `_sync_knowledge_bases` reads `kb_knowledge_base` as a delta. A base holds its read grants in `kb_uc_can_read_mtom`, and adding or removing a grant there does **not** touch `kb_knowledge_base.sys_updated_on`. So a grant change is invisible to the delta: a revoked grant stays live indefinitely, and a new grant is never picked up.  **To Reproduce**  Emptied group: 1. Sync a ServiceNow instance so groups and memberships are indexed, and note    the members of a group nobody is about to touch. 2. In ServiceNow, insert one `sys_user_grmember` row into a *different* group. 3. Run a routine (delta) sync. 4. The untouched group now has no members, and users who reached articles    through it can no longer retrieve them.  Revoked grant not withdrawn: 1. Grant a group read access to a knowledge base via `kb_uc_can_read_mtom`, and    sync. 2. Delete that grant row in ServiceNow. 3. Run any number of delta syncs. 4. The `GROUP` edge on the knowledge base is sti

- **Issue #3032** (2026-08-25): **[BUG] Image-heavy PDF pages may skip OCR and produce incomplete indexed content**
  *Symptoms*: **Describe the bug**  Some PDFs contain tables or text as a large image, with only a small amount of selectable text on the page. PipesHub may treat these pages as normal text PDFs and skip OCR.  When this happens, image information will be missing index, so answers based on the document will be incomplete or incorrect.  I also noticed two related OCR issues:  - OpenAI-compatible VLM requests can take a very long time when output is not limited. - Measurements containing `*` can be incorrectly parsed as Markdown and become truncated. (Maybe more like this will happen, but is only what I found.)  **To Reproduce** Steps to reproduce the behavior:  1. Configure a multimodal model for OCR. 2. Upload a PDF containing an image-based table. 3. Wait for the document to finish indexing. 4. Ask about information shown in the table. 5. Notice that some values are missing or incorrect.  **Expected behavior**  PipesHub should detect that the page is mostly an image and use OCR. The full table content should be indexed, including measurements containing multiplication symbols.  OCR requests should also finish within a reasonable amount of time.  **Screenshots**  Redacted screenshots can be added if needed.  **Environment (please complete the following information):**  - OS: Linux - Version/Commit ID: Latest upstream - Deployment: Docker Compose - LLM provider: OpenAI-compatible endpoint (Qwen3.6:35B-A3B)

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

### Incident Patch 1: `d1d02c79` (2026-10-06)
**Commit Message**: fix(demo-harness): read "platform-fee" as "platform fee" in mention and leak checks

answer_must_mention and restricted_facts were plain substring checks, so a
hyphen between two words decided the verdict. The nightly failed q5 for Bob
on an answer that said "platform-fee model", and the same rule meant an
Alice answer that leaked "platform-fee" or "usage-band" passed the leak
check. Both checks, and the fixture tests that keep each restricted fact
inside its restricted records, now treat hyphens, dashes and spaces between
words alike. Everything else stays exact.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/connectors/sources/demo/harness/kb_harness.py` (modified, +17/-3)
```diff
@@ -7,7 +7,8 @@
 content before the demo connector exists: the words are identical either way.
 
 What an answer says is scored two ways. ``answer_must_mention`` is an exact,
-case-insensitive token ("2.2%", a name). ``answer_must_state`` (and optionally
+case-insensitive token ("2.2%", a name); a hyphen and a space between two words
+count as the same, so "platform-fee" mentions "platform fee". ``answer_must_state`` (and optionally
 ``answer_must_not_state``) lists facts as plain sentences, each one fact, the
 way a reviewer would check it: "A purchase of up to and including $250 needs
 no approval." An AI judge reads the answer against them (``answer_judge.py``
@@ -331,6 +332,19 @@ def cited_fixture_ids(cited_names: list[str], name_to_id: dict[str, str], thread
     return ids
 
 
+_PHRASE_GAP = re.compile(r"[\s\-\u2010\u2011\u2012\u2013\u2014]+")
+
+
+def _phrase_text(text: str) -> str:
+    return _PHRASE_GAP.sub(" ", text.lower())
+
+
+def mentions(answer: str, phrase: str) -> bool:
+    """Exact, case-insensitive, and blind to how words are joined: "platform-fee"
+    is "platform fee". A leak check that missed the hyphenated form would pass a leak."""
+    return _phrase_text(phrase) in _phrase_text(answer)
+
+
 def score(
     q: dict, expect: str, cited_ids: set[str], answer: str, judge: AnswerJudge | None = None
 ) -> tuple[bool, str]:
@@ -351,13 +365,13 @@ def score(
     any_ok = ((not any_of) or any(x in cited_ids for x in any_of)) and ((not any_of2) or any(x in cited_ids for x in any_of2))
     forbidden = [x for x in q.get("must_not_cite", []) if x in cited_ids]
     mention = q.get("answer_must_mention", [])
-    unmentioned = [m for m in mention if m.lower() not in answer.lower()]
+    unmentioned = [m for m in mention if not mentions(answer, m)]
     if expect == "none":
         # A failed run proves nothing about access, so it is not a pass.
         if answer.startswith("ERROR:"):
             return False, f"FAIL ({answer})"
         leaked = [x for x in q.get("restricted", must) if x in cited_ids]
-        leaked += [f for f in q.get("restricted_facts", []) if f.lower() in answer.lower()]
+        leaked += [f for f in q.get("restricted_facts", []) if mentions(answer, f)]
         return (not leaked), ("PASS" if not leaked else f"FAIL (leaked restricted: {leaked})")
     ok = enough and any_ok and not forbidden and not unmentioned
     full = "full" if not missing else f"{len(must)-len(missing)}/{len(must)}"
```

**File**: `backend/python/tests/unit/connectors/sources/test_demo_fixture.py` (modified, +3/-3)
```diff
@@ -23,7 +23,7 @@
 import yaml
 
 import app.connectors.sources.demo.connector as demo_connector
-from app.connectors.sources.demo.harness.kb_harness import score
+from app.connectors.sources.demo.harness.kb_harness import mentions, score
 
 FIXTURE = Path(demo_connector.__file__).resolve().parent / "fixture" / "acme-corp.yaml"
 RESERVED_DOMAIN = "acme-demo.example"
@@ -158,8 +158,8 @@ def test_restricted_facts_come_only_from_restricted_records(fx: dict) -> None:
     inside = " ".join(r["body"] for r in fx["records"] if r["id"] in restricted_ids or r.get("thread") in restricted_ids).lower()
     group_of_record = _group_of_record(fx)
     outside = " ".join(r["body"] for r in fx["records"] if group_of_record[r["id"]] != "pricing-committee").lower()
-    assert [f for f in facts if f.lower() not in inside] == []
-    assert [f for f in facts if f.lower() in outside] == []
+    assert [f for f in facts if not mentions(inside, f)] == []
+    assert [f for f in facts if mentions(outside, f)] == []
 
 
 @pytest.mark.parametrize(
```

**File**: `backend/python/tests/unit/connectors/sources/test_demo_harness.py` (modified, +13/-0)
```diff
@@ -134,6 +134,9 @@ def test_the_installer_is_scored_on_its_own_groups_not_alices(fx: dict, qid: str
     [
         ("Enterprise moves to a $48,000 annual platform fee.", True),
         ("A $48k platform fee covering 250 seats.", True),
+        ("Move to a platform-fee model: $48k a year.", True),
+        ("A platform‑fee of $48,000.", True),
+        ("Per-seat pricing stays at $48 a seat.", False),
     ],
 )
 def test_q5_still_accepts_the_pricing_documents_own_wording(fx: dict, answer: str, ok: bool) -> None:
@@ -142,6 +145,16 @@ def test_q5_still_accepts_the_pricing_documents_own_wording(fx: dict, answer: st
     assert kb_harness.score(q, "cites", {"drive-pricing-2026"}, answer)[0] is ok
 
 
+@pytest.mark.parametrize(
+    "answer",
+    ["The 2026 plan moves Enterprise to a platform-fee model.", "Pricing follows usage-bands now."],
+)
+def test_a_hyphenated_restricted_fact_in_alices_answer_is_a_leak(fx: dict, answer: str) -> None:
+    passed, verdict = kb_harness.score(_question(fx, "q5"), "none", set(), answer)
+    assert passed is False, verdict
+    assert "leaked restricted" in verdict
+
+
 def test_an_upload_run_asks_only_the_knowledge_bases_it_loaded() -> None:
     body = kb_harness.ask_body("What is the salary band?", "agent", ["kb-shared", "kb-launch"])
     assert body["filters"] == {"kb": ["kb-shared", "kb-launch"]}
```

**File**: `backend/python/tests/unit/connectors/sources/test_demo_pack_fixture.py` (modified, +3/-2)
```diff
@@ -16,6 +16,7 @@
 import yaml
 
 import app.connectors.sources.demo.connector as demo_connector
+from app.connectors.sources.demo.harness.kb_harness import mentions
 
 FIXTURE = Path(demo_connector.__file__).resolve().parent / "fixture" / "acme-corp.yaml"
 
@@ -79,8 +80,8 @@ def test_pack_restricted_facts_come_only_from_restricted_records(fx: dict) -> No
         assert facts, f"{q['id']} needs facts that catch a leak in the answer text"
         inside = " ".join(r["body"] for r in fx["records"] if r["id"] in q["restricted"]).lower()
         outside = " ".join(r["body"] for r in fx["records"] if group_of_record[r["id"]] != group).lower()
-        assert [f for f in facts if f.lower() not in inside] == [], q["id"]
-        assert [f for f in facts if f.lower() in outside] == [], q["id"]
+        assert [f for f in facts if not mentions(inside, f)] == [], q["id"]
+        assert [f for f in facts if mentions(outside, f)] == [], q["id"]
 
 
 def test_every_team_reader_group_is_open_to_the_installer(fx: dict) -> None:
```

---

### Incident Patch 2: `dd925226` (2026-10-06)
**Commit Message**: fix(arango): fail a record delete whose REMOVE is refused, so it rolls back and retries (#3926)

* fix(arango): fail a record delete whose REMOVE is refused, so it rolls back and retries

delete_records_recursive removed a subtree's edges and type documents, then
its record documents through _delete_nodes_by_keys, which logged a failed
batch and returned a count nobody read. When indexing was updating one of the
records, the REMOVE failed with a write-write conflict, the delete committed
anyway and reported every record deleted, and the records stayed in the graph
with their edges gone. The edge sweep had the same habit.

Both helpers now take raise_on_error, and the recursive delete asks them to
re-raise the error as it came. The transaction rolls back, and
on_records_deleted_cascade's existing retry runs the delete again once the
other writer lets go.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* test(arango): prove the delete hit the conflict, and cover the type-target removal

The real-backends test held the record for a fixed 1.5 s and could not tell
a conflict from none. It now lets go only once the retry warning is logged,
and asserts it was. The provid

**File**: `backend/python/app/services/graph_db/arango/arango_http_provider.py` (modified, +40/-14)
```diff
@@ -9404,10 +9404,15 @@ async def _delete_edges_by_node_ids(
         node_ids: list[str],
         edge_collections: list[str],
         batch_size: int = 5000,
+        *,
+        raise_on_error: bool = False,
     ) -> tuple[int, list[str]]:
         """Delete every edge whose ``_from`` or ``_to`` is one of ``node_ids``, across all
         edge collections. Used by the per-record recursive delete (a bounded node set),
-        unlike ``_delete_edges_by_connector_id`` which sweeps a whole connector."""
+        unlike ``_delete_edges_by_connector_id`` which sweeps a whole connector.
+
+        With *raise_on_error*, the first failure is re-raised as it came, so a caller's
+        transaction rolls back and a write conflict can still be told apart."""
         total_deleted = 0
         failed_collections: list[str] = []
         query = """
@@ -9428,6 +9433,8 @@ async def _delete_edges_by_node_ids(
                     total_deleted += len(results or [])
             except Exception as e:
                 self.logger.error(f"❌ Error deleting edges from {edge_collection}: {str(e)}")
+                if raise_on_error:
+                    raise
                 failed_collections.append(edge_collection)
         return (total_deleted, failed_collections)
 
@@ -9472,7 +9479,9 @@ async def _delete_isoftype_targets_from_collected(
         self,
         transaction: str,
         targets: list[dict],
-        edge_collections: list[str]
+        edge_collections: list[str],
+        *,
+        raise_on_error: bool = False,
     ) -> tuple[int, list[str]]:
         """
         Delete isOfType target nodes using pre-collected targets.
@@ -9482,6 +9491,8 @@ async def _delete_isoftype_targets_from_collected(
             transaction: The transaction ID
             targets: List of target dicts with keys: collection, key, full_id (from _collect_isoftype_targets)
             edge_collections: List of edge collection names for cleanup (unused, kept for signature compatibility)
+            raise_on_error: Re-raise a failed batch's own error instead of the summary below,
+                so a write conflict stays retryable.
 
         Returns:
             Tuple of (total_deleted_count, list_of_failed_collections)
@@ -9505,7 +9516,9 @@ async def _delete_isoftype_targets_from_collected(
 
         for collection, keys in targets_by_collection.items():
             expected_count = len(keys)
-            deleted, failed_batches = await self._delete_nodes_by_keys(transaction, keys, collection)
+            deleted, failed_batches = await self._delete_nodes_by_keys(
+                transaction, keys, collection, raise_on_error=raise_on_error
+            )
             total_deleted += deleted
 
             # Check for failures: either failed batches OR incomplete deletion
@@ -9531,10 +9544,21 @@ async def _delete_isoftype_targets_from_collected(
         self.logger.debug(f"✅ Deleted {total_deleted} isOfType target documents")
         return (total_deleted, [])
 
-    async def _delete_nodes_by_keys(self, transaction: str, keys: list[str], collection: str, batch_size: int = 5000) -> tuple[int, int]:
+    async def _delete_nodes_by_keys(
+        self,
+        transaction: str,
+        keys: list[str],
+        collection: str,
+        batch_size: int = 5000,
+        *,
+        raise_on_error: bool = False,
+    ) -> tuple[int, int]:
         """
         Delete documents by their _key values using batching.
 
+        With *raise_on_error*, the first failed batch is re-raised as it came instead
+        of being counted, so a caller's transaction rolls back.
+
         Returns:
             Tuple of (total_deleted_count, failed_batches_count)
         """
@@ -9569,6 +9593,8 @@ async def _delete_nodes_by_keys(self, transaction: str, keys: list[str], collect
                 total_deleted += deleted
             except Exception as e:
                 self.logger.error(f"❌ Error deleting batch {i//batch_size + 1}/{total_batches} from {collection}: {str(e)}")
+                if raise_on_error:
+                    raise
                 failed_batches += 1
                 # Continue with next batch even if one fails
 
@@ -13795,21 +13821,21 @@ async def delete_records_recursive(
                     # Dynamic edge sweep: remove every edge touching the deleted records
                     # (recordRelations, isOfType, belongsTo, inheritPermissions, permission,
                     # entityRelations, link relations, ...).
-                    _, failed_edges = await self._delete_edges_by_node_ids(txn_id, node_ids, edge_collections)
-                    # Both helpers log a failed batch and go on; raising rolls the transaction
-                    # back instead of committing records without their edges or types.
-                    if failed_edges:
-                        raise RuntimeError(f"Could not delete the records' edges in {failed_edges}")
+                    # The original error, not a new one,
```

**File**: `backend/python/tests/integration/graph_db/test_partial_write_failures_real_backends.py` (modified, +3/-2)
```diff
@@ -386,8 +386,9 @@ async def delete() -> dict:
         hold = _arango_hold(w, CollectionNames.RECORDS.value,
                             "UPDATE @key WITH {updatedAtTimestamp: @now} IN records RETURN 1",
                             {"key": record.id, "now": now + 1})
-        # The conflict on the record is logged by the batch helper, which goes on.
-        expected = "Could not delete 1 batch(es) of records"
+        # The batch helper re-raises the conflict as it came, so the delete is retried
+        # while the hold lasts and then fails with ArangoDB's own error.
+        expected = ARANGO_CONFLICT
     async with hold:
         assert expected in await _failure(delete)
 
```

**File**: `backend/python/tests/integration/test_folder_scoped_delete_e2e.py` (modified, +46/-0)
```diff
@@ -33,6 +33,7 @@
 
 from __future__ import annotations
 
+import asyncio
 import contextlib
 import logging
 import uuid
@@ -333,3 +334,48 @@ async def move_in_after_the_first_reread(query, *args, **kwargs) -> object:
     assert result["success"] is False and result.get("code") == 409, result
     for name in ("sub", "s1", "b1"):
         assert await tree.exists(name), f"{name} was deleted by a delete that reported nothing deleted: {result}"
+
+
+# ArangoDB only: Neo4j waits for the other writer's lock instead of failing the write.
+@pytest.mark.parametrize("tree", ["arango"], indirect=True)
+async def test_a_record_another_writer_holds_is_deleted_once_it_lets_go(
+    tree: _Tree, caplog: pytest.LogCaptureFixture
+) -> None:
+    """Indexing updating a record while its folder is deleted made the record REMOVE fail
+    with a write-write conflict; the delete still committed and reported success, and
+    the records stayed in the graph with their edges gone."""
+    records = CollectionNames.RECORDS.value
+    holder = await tree.graph.begin_transaction(read=[records], write=[records])
+    await tree.graph.execute_query(
+        "UPDATE @key WITH { indexingStatus: 'COMPLETED' } IN @@records",
+        bind_vars={"key": tree.ids["a1"], "@records": records},
+        transaction=holder,
+    )
+
+    caplog.set_level(logging.WARNING, logger=DataSourceEntitiesProcessor.__module__)
+
+    def retried() -> bool:
+        return any(
+            "Deadlock or write conflict in on_records_deleted_cascade" in r.getMessage()
+            for r in caplog.records
+        )
+
+    deleting = asyncio.create_task(tree.processor.on_records_deleted_cascade(
+        [tree.ids["folder_a"]], tree.connector_id, soft_delete=False,
+    ))
+    # Let go only once the delete has been refused and is waiting to run again, so the
+    # test shows the conflict happened rather than guessing how long it takes.
+    for _ in range(300):
+        if retried() or deleting.done():
+            break
+        await asyncio.sleep(0.05)
+    await tree.graph.commit_transaction(holder)
+    result = await deleting
+
+    assert retried(), "the delete never ran into the held record, so the conflict was not tested"
+
+    assert result["success"] is True, result
+    left = [name for name in ("folder_a", "a1", "attached", "sub", "s1") if await tree.exists(name)]
+    assert not left, f"reported deleted, still in the graph: {left} ({result})"
+    for name in ("folder_b", "b1", "b_sub", "b_sub_file", "root_file"):
+        assert await tree.exists(name), f"{name} was outside the folder and was deleted: {result}"
```

**File**: `backend/python/tests/unit/services/graph_db/test_arango_http_provider.py` (modified, +31/-0)
```diff
@@ -4239,6 +4239,37 @@ async def test_external_transaction_not_committed(self, connected_provider):
         mock_begin.assert_not_awaited()
         mock_commit.assert_not_awaited()
 
+    @pytest.mark.parametrize("failing", ["records", "permission", "files"])
+    @pytest.mark.asyncio
+    async def test_a_failed_removal_fails_the_callers_transaction(self, connected_provider, failing) -> None:
+        """A REMOVE refused by a write conflict was logged and counted, and the delete
+        reported success, so the caller committed with the records still in the graph."""
+        conflict = 'Query failed (status=409): {"code":409,"error":true,"errorNum":1200}'
+        inventory = {
+            "valid_root_keys": ["r1"],
+            "records_with_type": [{
+                "record": {"_key": "r1", "recordName": "doc.md"},
+                "type_target": {"collection": "files", "key": "r1", "full_id": "files/r1", "doc": {}},
+            }],
+        }
+
+        async def aql(query: str, bind_vars: dict | None = None, txn_id: str | None = None) -> list:
+            bind_vars = bind_vars or {}
+            if failing in (bind_vars.get("@collection"), bind_vars.get("@edge_collection")):
+                raise RuntimeError(conflict)
+            # A REMOVE ... RETURN 1 answers one row per document it removed.
+            return [1] * len(bind_vars.get("keys", []))
+
+        connected_provider.http_client.execute_aql = AsyncMock(side_effect=aql)
+        with patch.object(connected_provider, "_get_all_edge_collections", AsyncMock(return_value=["permission"])), \
+             patch.object(connected_provider, "execute_query", AsyncMock(return_value=[inventory])), \
+             patch.object(connected_provider, "commit_transaction", AsyncMock()) as mock_commit, \
+             pytest.raises(RuntimeError) as raised:
+            await connected_provider.delete_records_recursive(["r1"], "kb-1", transaction="ext-txn")
+
+        assert connected_provider.is_write_conflict(raised.value)
+        mock_commit.assert_not_awaited()
+
     @pytest.mark.asyncio
     async def test_batch_partial_success(self, connected_provider):
         inventory = {
```

---

### Incident Patch 3: `77bfb614` (2026-10-06)
**Commit Message**: fix(neo4j): find a team's knowledge base when the list is searched by name

The Neo4j knowledge-base list applied the name search to `kb`, the
knowledge base a direct grant reaches, on both of its branches. On the team
branch the knowledge base is `kb2`, and `kb` is null for one the person
reaches only through a team, so searching the list by name never returned a
team-only knowledge base. The page and the total were both affected; ArangoDB
was not.

Each branch now filters on its own variable. A real-backends test runs the
same cases on Neo4j and ArangoDB, and a unit test pins the Cypher.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/services/graph_db/neo4j/neo4j_provider.py` (modified, +10/-14)
```diff
@@ -11379,23 +11379,19 @@ async def list_user_knowledge_bases(
         For team-based access, returns the highest role from all common teams.
         """
         try:
-            # Build filter conditions
-            filter_conditions = []
-
-            # Search filter (using CONTAINS for LIKE-like behavior)
+            # Each branch binds its knowledge base to its own variable (kb for a
+            # direct grant, kb2 for a team's), so each needs the search on that one.
+            direct_filters = ""
+            team_filters = ""
             if search:
-                filter_conditions.append("toLower(kb.name) CONTAINS toLower($search_term)")
+                direct_filters = " AND toLower(kb.name) CONTAINS toLower($search_term)"
+                team_filters = " AND toLower(kb2.name) CONTAINS toLower($search_term)"
 
             # Permission filter (will be applied after role resolution)
             permission_filter = ""
             if permissions:
                 permission_filter = " AND final_role IN $permissions"
 
-            # Build WHERE clause for KB filtering
-            additional_filters = ""
-            if filter_conditions:
-                additional_filters = " AND " + " AND ".join(filter_conditions)
-
             # Sort field mapping
             sort_field_map = {
                 "name": "kb.name",
@@ -11417,7 +11413,7 @@ async def list_user_knowledge_bases(
             WHERE kb.orgId = $org_id
                 AND kb.type = $kb_type
                 AND coalesce(kb.isHidden, false) = false
-                {additional_filters}
+                {direct_filters}
             WITH u, kb, r.role AS direct_role,
                  CASE r.role
                      WHEN "OWNER" THEN 4
@@ -11434,7 +11430,7 @@ async def list_user_knowledge_bases(
             WHERE kb2.orgId = $org_id
                 AND kb2.type = $kb_type
                 AND coalesce(kb2.isHidden, false) = false
-                {additional_filters}
+                {team_filters}
 
             // Emit both direct and team KBs so team-only KBs are not lost (COALESCE would drop them)
             WITH kb, kb2, direct_role, direct_priority, is_direct,
@@ -11515,7 +11511,7 @@ async def list_user_knowledge_bases(
             WHERE kb.orgId = $org_id
                 AND kb.type = $kb_type
                 AND coalesce(kb.isHidden, false) = false
-                {additional_filters}
+                {direct_filters}
             WITH kb, r.role AS direct_role,
                  CASE r.role
                      WHEN "OWNER" THEN 4
@@ -11532,7 +11528,7 @@ async def list_user_knowledge_bases(
             WHERE kb2.orgId = $org_id
                 AND kb2.type = $kb_type
                 AND coalesce(kb2.isHidden, false) = false
-                {additional_filters}
+                {team_filters}
             WITH kb, kb2, direct_role, direct_priority, is_direct,
                  r1.role AS team_role,
                  CASE WHEN r1.role IS NOT NULL THEN
```

**File**: `backend/python/tests/integration/graph_db/test_kb_list_team_access_real_backends.py` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+"""A knowledge base shared with a team is in its members' list, searched by name or not.
+
+The Neo4j list query applied the name search to the knowledge base reached by
+a direct grant on both of its branches, so on the team branch the condition
+read a node that is null for a team-only knowledge base, and a member who
+searched their list by name never found one their team gave them. ArangoDB
+runs the same cases to keep both backends in step.
+
+Runs in backend-matrix on both graph jobs. Environment: NEO4J_IT_URI,
+NEO4J_IT_PASSWORD, ARANGO_IT_URL, ARANGO_IT_PASSWORD.
+"""
+
+from __future__ import annotations
+
+import contextlib
+import logging
+import uuid
+from dataclasses import dataclass
+from typing import TYPE_CHECKING
+from unittest.mock import MagicMock
+
+import pytest
+
+from app.config.constants.arangodb import CollectionNames
+from app.connectors.core.base.data_processor.data_source_entities_processor import (
+    DataSourceEntitiesProcessor,
+)
+from app.connectors.core.base.data_store.graph_data_store import GraphDataStore
+from app.connectors.sources.localKB.handlers.kb_service import KnowledgeBaseService
+from app.utils.time_conversion import get_epoch_timestamp_in_ms
+from tests.integration.real_graph import (
+    backend_unavailable,
+    connect_arango,
+    connect_neo4j,
+)
+
+if TYPE_CHECKING:
+    from collections.abc import AsyncIterator
+
+    from app.services.graph_db.interface.graph_db_provider import IGraphDBProvider
+
+pytestmark = [pytest.mark.integration, pytest.mark.timeout(300)]
+
+ARANGO_DB = "kb_list_team_access_it"
+
+logger = logging.getLogger("kb-list-team-access-it")
+
+
+@dataclass
+class _Org:
+    service: KnowledgeBaseService
+    org_id: str
+    member_id: str
+    team_only: tuple[str, str]
+    direct_only: tuple[str, str]
+    both: tuple[str, str]
+
+
+async def _remove(graph: IGraphDBProvider, ids: dict[str, list[str]]) -> None:
+    for collection, keys in ids.items():
+        if keys:
+            with contextlib.suppress(Exception):
+                await graph.delete_nodes_and_edges(keys, collection)
+
+
+def _user(key: str, user_id: str, org_id: str, run: str) -> dict:
+    return {"_key": key, "userId": user_id, "orgId": org_id, "email": f"{user_id}-{run}@example.com",
+            "isActive": True}
+
+
+@pytest.fixture(params=["neo4j", "arango"])
+async def org(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[_Org]:
+    async with contextlib.AsyncExitStack() as cleanup:
+        try:
+            graph = await (
+                connect_neo4j(logger, monkeypatch) if request.param == "neo4j"
+                else connect_arango(logger, ARANGO_DB)
+            )
+        except Exception as exc:
+            backend_unavailable(request.param, exc)
+        disconnect = getattr(graph, "disconnect", None)
+        if disconnect is not None:
+            cleanup.push_async_callback(disconnect)
+
+        run = uuid.uuid4().hex[:10]
+        org_id = f"org-kblist-{run}"
+        owner_id, owner_key = f"owner-kblist-{run}", f"okey-kblist-{run}"
+        member_id, member_key = f"member-kblist-{run}", f"mkey-kblist-{run}"
+        team_key = f"team-kblist-{run}"
+        seeded: dict[str, list[str]] = {
+            CollectionNames.ORGS.value: [org_id],
+            CollectionNames.USERS.value: [owner_key, member_key],
+            CollectionNames.TEAMS.value: [team_key],
+            CollectionNames.APPS.value: [],
+        }
+        cleanup.push_async_callback(_remove, graph, seeded)
+        assert await graph.batch_upsert_nodes(
+            [{"_key": org_id, "accountType": "enterprise", "isActive": True, "name": "kb list"}],
+            CollectionNames.ORGS.value,
+        )
+        assert await graph.batch_upsert_nodes(
+            [_user(owner_key, owner_id, org_id, run), _user(member_key, member_id, org_id, run)],
+            CollectionNames.USERS.value,
+        )
+        now = get_epoch_timestamp_in_ms()
+        assert await graph.batch_upsert_nodes(
+            [{"_key": team_key, "name": f"team {run}", "orgId": org_id, "createdBy": owner_key,
+              "createdAtTimestamp": now, "updatedAtTimestamp": now}],
+            CollectionNames.TEAMS.value,
+        )
+        # The edge PUT /api/v1/teams/:id writes for a member it adds (entity.py update_team).
+        assert await graph.batch_create_edges(
+            [{"from_id": member_key, "from_collection": CollectionNames.USERS.value,
+              "to_id": team_key, "to_collection": CollectionNames.TEAMS.value,
+              "type": "USER", "role": "READER", "createdAtTimestamp": now, "updatedAtTimestamp": now}],
+            CollectionNames.PERMISSION.value,
+        )
+
+        processor = DataSourceEntitiesProcessor(logger, GraphDataStore(logger, graph), MagicMock())
+        processor.org_id = org_id
+
+        async def processor_for_kb(_kb_id: str) -> DataSourceEntitiesProcessor:
+            return processor
+
+  
```

**File**: `backend/python/tests/unit/services/graph_db/test_neo4j_provider.py` (modified, +18/-0)
```diff
@@ -4627,6 +4627,24 @@ async def test_query_excludes_hidden_kbs(self, neo4j_provider: Neo4jProvider):
         assert count_query.count("coalesce(kb.isHidden, false) = false") == 1
         assert count_query.count("coalesce(kb2.isHidden, false) = false") == 1
 
+    @pytest.mark.asyncio
+    async def test_a_name_search_filters_each_branch_on_its_own_knowledge_base(
+        self, neo4j_provider: Neo4jProvider
+    ) -> None:
+        """kb is null on the team branch for a team-only grant; searching kb.name there dropped it."""
+        neo4j_provider.client.execute_query = AsyncMock(
+            side_effect=[[], [{"total": 0}], []]
+        )
+
+        await neo4j_provider.list_user_knowledge_bases(
+            "user1", "org1", skip=0, limit=10, search="roadmap"
+        )
+
+        for call in neo4j_provider.client.execute_query.call_args_list[:2]:
+            query = call[0][0]
+            assert query.count("toLower(kb.name) CONTAINS toLower($search_term)") == 1
+            assert query.count("toLower(kb2.name) CONTAINS toLower($search_term)") == 1
+
     @pytest.mark.asyncio
     async def test_exception_returns_empty(self, neo4j_provider: Neo4jProvider):
         neo4j_provider.client.execute_query = AsyncMock(
```

---

### Incident Patch 4: `117a5a05` (2026-10-05)
**Commit Message**: fix(arango): roll back a recursive delete whose edge or record removal failed

delete_records_recursive ignored the failures that _delete_edges_by_node_ids
and _delete_nodes_by_keys report: both log a failed batch and carry on. A
write conflict on a record therefore committed its edges and type document
deleted with the record itself still there, reported success and published
its delete event. The method's own contract is that a failure after the first
write reaches the caller as an exception. It now raises, as the type document
step already did, and the transaction rolls back.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/services/graph_db/arango/arango_http_provider.py` (modified, +10/-2)
```diff
@@ -13795,13 +13795,21 @@ async def delete_records_recursive(
                     # Dynamic edge sweep: remove every edge touching the deleted records
                     # (recordRelations, isOfType, belongsTo, inheritPermissions, permission,
                     # entityRelations, link relations, ...).
-                    await self._delete_edges_by_node_ids(txn_id, node_ids, edge_collections)
+                    _, failed_edges = await self._delete_edges_by_node_ids(txn_id, node_ids, edge_collections)
+                    # Both helpers log a failed batch and go on; raising rolls the transaction
+                    # back instead of committing records without their edges or types.
+                    if failed_edges:
+                        raise RuntimeError(f"Could not delete the records' edges in {failed_edges}")
                 if type_targets:
                     # Remove the isOfType type docs (files/mails/webpages/...); raises on
                     # partial failure so the transaction rolls back.
                     await self._delete_isoftype_targets_from_collected(txn_id, type_targets, edge_collections)
                 if record_keys:
-                    await self._delete_nodes_by_keys(txn_id, record_keys, CollectionNames.RECORDS.value)
+                    _, failed_batches = await self._delete_nodes_by_keys(
+                        txn_id, record_keys, CollectionNames.RECORDS.value
+                    )
+                    if failed_batches:
+                        raise RuntimeError(f"Could not delete {failed_batches} batch(es) of records")
                 if within_folder_id and valid_root_keys:
                     # Again after the deletes: a move committed while they ran is outside
                     # this transaction's snapshot, so its new edge was left in place.
```

**File**: `backend/python/tests/unit/services/graph_db/test_arango_http_provider.py` (modified, +14/-14)
```diff
@@ -4174,9 +4174,9 @@ async def test_single_record_with_event(self, connected_provider):
         with patch.object(connected_provider, "_get_all_edge_collections", AsyncMock(return_value=["permission"])), \
              patch.object(connected_provider, "begin_transaction", AsyncMock(return_value="txn1")), \
              patch.object(connected_provider, "execute_query", AsyncMock(return_value=[inventory])), \
-             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock()), \
+             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock(return_value=(0, []))), \
              patch.object(connected_provider, "_delete_isoftype_targets_from_collected", AsyncMock()), \
-             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock()), \
+             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock(return_value=(1, 0))), \
              patch.object(connected_provider, "commit_transaction", AsyncMock()), \
              patch.object(connected_provider, "_create_deleted_record_event_payload", AsyncMock(return_value={"recordId": "r1"})):
             result = await connected_provider.delete_records_recursive(["r1"], "kb-1")
@@ -4207,9 +4207,9 @@ async def test_no_virtual_record_id(self, connected_provider):
         with patch.object(connected_provider, "_get_all_edge_collections", AsyncMock(return_value=["permission"])), \
              patch.object(connected_provider, "begin_transaction", AsyncMock(return_value="txn1")), \
              patch.object(connected_provider, "execute_query", AsyncMock(return_value=[inventory])), \
-             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock()), \
+             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock(return_value=(0, []))), \
              patch.object(connected_provider, "_delete_isoftype_targets_from_collected", AsyncMock()), \
-             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock()), \
+             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock(return_value=(1, 0))), \
              patch.object(connected_provider, "commit_transaction", AsyncMock()):
             result = await connected_provider.delete_records_recursive(["r1"], "kb-1")
 
@@ -4269,9 +4269,9 @@ async def test_batch_partial_success(self, connected_provider):
         with patch.object(connected_provider, "_get_all_edge_collections", AsyncMock(return_value=["permission"])), \
              patch.object(connected_provider, "begin_transaction", AsyncMock(return_value="txn1")), \
              patch.object(connected_provider, "execute_query", AsyncMock(return_value=[inventory])), \
-             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock()), \
+             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock(return_value=(0, []))), \
              patch.object(connected_provider, "_delete_isoftype_targets_from_collected", AsyncMock()), \
-             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock()), \
+             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock(return_value=(1, 0))), \
              patch.object(connected_provider, "commit_transaction", AsyncMock()), \
              patch.object(connected_provider, "_create_deleted_record_event_payload", AsyncMock(return_value={"recordId": "x"})):
             result = await connected_provider.delete_records_recursive(["r1", "r2", "r-missing"], "kb-1")
@@ -4297,9 +4297,9 @@ async def test_payload_build_failure_still_deletes(self, connected_provider):
         with patch.object(connected_provider, "_get_all_edge_collections", AsyncMock(return_value=["permission"])), \
              patch.object(connected_provider, "begin_transaction", AsyncMock(return_value="txn1")), \
              patch.object(connected_provider, "execute_query", AsyncMock(return_value=[inventory])), \
-             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock()), \
+             patch.object(connected_provider, "_delete_edges_by_node_ids", AsyncMock(return_value=(0, []))), \
              patch.object(connected_provider, "_delete_isoftype_targets_from_collected", AsyncMock()), \
-             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock()), \
+             patch.object(connected_provider, "_delete_nodes_by_keys", AsyncMock(return_value=(1, 0))), \
              patch.object(connected_provider, "commit_transaction", AsyncMock()), \
              patch.object(connected_provider, "_create_deleted_record_event_payload", AsyncMock(side_effect=RuntimeError("bad payload"))):
             result = await connected_provider.delete_records_recursive(["r1"], "kb-1")
@@ -4334,9 +4334,9 @@ async def exec_query(query, bind_vars=None, transaction=None):
         with patch.object(connected_provider, "_get_all_edge_collections", AsyncMock(return_value=["permission"])), 
```

---

### Incident Patch 5: `64646745` (2026-10-05)
**Commit Message**: fix(neo4j): make three multi-step writes single statements, so a failure leaves nothing behind

With NEO4J_EXPLICIT_TRANSACTIONS off (the default), each Neo4j statement
commits on its own, even inside GraphDataStore.transaction(). These writes ran
as several statements, so a failure partway kept the first steps:

- Rewriting the PERMISSION edges into a record group, user group or app role
  on every sync deleted the old edges in a statement of their own. A failure
  before the new edges landed left the group with no members, and everything
  that inherits from it unreadable until the next sync. The delete and the new
  edges now go in one call, replace_edges_to, after every principal is
  resolved. It is one statement on Neo4j; the interface default keeps the two
  calls for ArangoDB, whose transaction rolls them back together.
- batch_upsert_records wrote the Record node, its type node and the
  IS_OF_TYPE edge as three statements per record, so a record could be left
  without its type. Now one statement per record, with both nodes validated
  before it runs.
- delete_records_recursive (the default hard delete) removed the type nodes,
  then the records, and could clear survivors

**File**: `backend/python/app/connectors/core/base/data_processor/data_source_entities_processor.py` (modified, +28/-30)
```diff
@@ -1243,6 +1243,18 @@ async def _handle_record_permissions(self, record: Record, permissions: list[Per
         except Exception as e:
             self.logger.error("Failed to create permission edge: %s", e)
 
+    @staticmethod
+    async def _write_permission_edges(
+        tx_store: TransactionStore, to_id: str, to_collection: str, edges: list[dict], *, replace: bool
+    ) -> None:
+        # Old edges go in the same call as the new ones, after every principal is
+        # resolved: on Neo4j a delete issued first committed on its own, so a group
+        # whose rewrite failed lost all its members until the next sync.
+        if replace:
+            await tx_store.replace_edges_to(to_id, to_collection, edges, CollectionNames.PERMISSION.value)
+        elif edges:
+            await tx_store.batch_create_edges(edges, collection=CollectionNames.PERMISSION.value)
+
     async def _resolve_principal(
         self, email: str, tx_store: TransactionStore, create_if_missing: bool = True
     ) -> tuple[str, str] | None:
@@ -2920,13 +2932,6 @@ async def on_new_record_groups(self, record_groups: list[tuple[RecordGroup, list
                         # Ensure update timestamp is fresh for the edge
                         record_group.updated_at = get_epoch_timestamp_in_ms()
 
-                        # To Delete the previously existing edges to record group and create new permissions
-                        await tx_store.delete_edges_to(
-                            to_id=record_group.id,
-                            to_collection=CollectionNames.RECORD_GROUPS.value,
-                            collection=CollectionNames.PERMISSION.value
-                        )
-
                     # 1. Upsert the record group document
                     await tx_store.batch_upsert_record_groups([record_group])
 
@@ -3037,6 +3042,10 @@ async def on_new_record_groups(self, record_groups: list[tuple[RecordGroup, list
 
                     # 4. Handle User and Group Permissions (from the passed 'permissions' list)
                     if not permissions:
+                        await self._write_permission_edges(
+                            tx_store, record_group.id, CollectionNames.RECORD_GROUPS.value, [],
+                            replace=existing_record_group is not None,
+                        )
                         continue
 
                     record_group_permissions = []
@@ -3098,9 +3107,10 @@ async def on_new_record_groups(self, record_groups: list[tuple[RecordGroup, list
                     # Batch create (upsert) all permission edges for this record group
                     if record_group_permissions:
                         self.logger.debug(f"Creating/updating {len(record_group_permissions)} PERMISSION edges for RecordGroup {record_group.id}")
-                        await tx_store.batch_create_edges(
-                            record_group_permissions, collection=CollectionNames.PERMISSION.value
-                        )
+                    await self._write_permission_edges(
+                        tx_store, to_id, to_collection, record_group_permissions,
+                        replace=existing_record_group is not None,
+                    )
 
                     if record_group.parent_record_group_id:
                         await tx_store.create_record_groups_relation(record_group.id, record_group.parent_record_group_id)
@@ -3364,13 +3374,6 @@ async def on_new_user_groups(self, user_groups: list[tuple[AppUserGroup, list[Ap
                         self.logger.debug(f"Updating existing user group with id: {user_group.id}")
                         user_group.updated_at = get_epoch_timestamp_in_ms()
 
-                        # To Delete the previously existing edges to user group and create new permissions
-                        await tx_store.delete_edges_to(
-                            to_id=user_group.id,
-                            to_collection=CollectionNames.GROUPS.value,
-                            collection=CollectionNames.PERMISSION.value
-                        )
-
                     # 1. Upsert the user group document
                     # (This uses batch_upsert_user_groups and the to_arango... method)
                     await tx_store.batch_upsert_user_groups([user_group])
@@ -3405,9 +3408,10 @@ async def on_new_user_groups(self, user_groups: list[tuple[AppUserGroup, list[Ap
                     # Batch create (upsert) all permission edges for this user group
                     if user_group_permissions:
                         self.logger.debug(f"Creating/updating {len(user_group_permissions)} PERMISSION edges for UserGroup {user_group.id}")
-                        await tx_store.batch_create_edges(
-                            user_group_permissions, collection=CollectionNames.PERMISSION.value
-                        )
+                    await self._write_permission_edges(
+                        tx_store, to_id, to_collection, user_gr
```

**File**: `backend/python/app/connectors/core/base/data_store/graph_data_store.py` (modified, +3/-0)
```diff
@@ -373,6 +373,9 @@ async def delete_edges_from(self, from_id: str, from_collection: str, collection
     async def delete_edges_to(self, to_id: str, to_collection: str, collection: str) -> None:
         return await self.graph_provider.delete_edges_to(to_id, to_collection, collection, transaction=self.txn)
 
+    async def replace_edges_to(self, to_id: str, to_collection: str, edges: list[dict], collection: str) -> None:
+        await self.graph_provider.replace_edges_to(to_id, to_collection, edges, collection, transaction=self.txn)
+
     async def delete_parent_child_edge_to_record(self, record_id: str) -> int:
         """Delete PARENT_CHILD edges pointing to a specific target record"""
         return await self.graph_provider.delete_parent_child_edge_to_record(record_id, transaction=self.txn)
```

**File**: `backend/python/app/services/graph_db/interface/graph_db_provider.py` (modified, +18/-0)
```diff
@@ -892,6 +892,24 @@ async def delete_edges_to(
         """
         pass
 
+    async def replace_edges_to(
+        self,
+        to_id: str,
+        to_collection: str,
+        edges: list[dict],
+        collection: str,
+        transaction: str | None = None,
+    ) -> None:
+        """Delete every *collection* edge into the node, then create *edges*.
+
+        Concrete by design: a provider with real transactions keeps the two calls.
+        Neo4j overrides it with one statement, since with NEO4J_EXPLICIT_TRANSACTIONS
+        off a failure after the delete left the node with no edges at all.
+        """
+        await self.delete_edges_to(to_id, to_collection, collection, transaction)
+        if edges:
+            await self.batch_create_edges(edges, collection, transaction)
+
     @abstractmethod
     async def delete_edges_to_groups(
         self,
```

**File**: `backend/python/app/services/graph_db/neo4j/neo4j_provider.py` (modified, +137/-128)
```diff
@@ -1363,18 +1363,22 @@ def _nodes_for_upsert(self, nodes: list[dict], collection: str) -> list[dict]:
             neo4j_nodes.append(neo4j_node)
         return neo4j_nodes
 
-    async def _upsert_record_nodes_releasing_trash(
-        self, nodes: list[dict], transaction: str | None = None
+    async def _upsert_record_with_type(
+        self, record: Record, transaction: str | None, *, release_trashed_external_ids: bool
     ) -> None:
-        """Upsert record nodes; records in the trash holding one of their external ids give it up.
+        """Upsert a record, its type node and the IS_OF_TYPE edge between them.
 
         One statement: each statement commits on its own unless explicit
-        transactions are on, so a release written separately outlived a refused upsert.
-        """
-        records = self._nodes_for_upsert(nodes, CollectionNames.RECORDS.value)
-        await self.client.execute_query(
-            """
-            UNWIND $nodes AS node
+        transactions are on, so a type node or edge that failed left a record
+        without its type, and a trash release outlived a refused upsert.
+        Records in the trash holding the record's external id give it up when
+        *release_trashed_external_ids* is set.
+        """
+        node = self._nodes_for_upsert([record.to_arango_base_record()], CollectionNames.RECORDS.value)[0]
+        parameters: dict[str, Any] = {
+            "nodes": [node], "ids": [node["id"]], "trashed_prefix": TRASHED_EXTERNAL_ID_PREFIX,
+        }
+        release = """
             WITH node, COLLECT {
                 MATCH (holder:Record {externalRecordId: node.externalRecordId, connectorId: node.connectorId})
                 WHERE holder.isDeleted = true AND NOT holder.id IN $ids
@@ -1385,15 +1389,29 @@ async def _upsert_record_nodes_releasing_trash(
                     trashedExternalRecordId: holder.externalRecordId,
                     externalRecordId: $trashed_prefix + holder.id
                 })
-            MERGE (n:Record {id: node.id})
+        """ if release_trashed_external_ids else ""
+        typed = ""
+        collection = RECORD_TYPE_COLLECTION_MAPPING.get(record.record_type)
+        if collection:
+            parameters["type_node"] = self._nodes_for_upsert([record.to_arango_record()], collection)[0]
+            now = get_epoch_timestamp_in_ms()
+            parameters["edge"] = {"createdAtTimestamp": now, "updatedAtTimestamp": now}
+            typed = f"""
+            MERGE (t:{collection_to_label(collection)} {{id: $type_node.id}})
+            SET t += $type_node
+            MERGE (n)-[e:{edge_collection_to_relationship(CollectionNames.IS_OF_TYPE.value)}]->(t)
+            SET e = $edge
+            """
+        await self.client.execute_query(
+            f"""
+            UNWIND $nodes AS node
+            {release}
+            MERGE (n:Record {{id: node.id}})
             SET n += node
+            {typed}
             RETURN n.id
             """,
-            parameters={
-                "nodes": records,
-                "ids": [node["id"] for node in records],
-                "trashed_prefix": TRASHED_EXTERNAL_ID_PREFIX,
-            },
+            parameters=parameters,
             txn_id=transaction,
         )
 
@@ -1590,6 +1608,73 @@ async def batch_update_nodes(
 
     # ==================== Edge Operations ====================
 
+    def _edges_by_labels(self, edges: list[dict]) -> dict[tuple[str, str], list[dict]]:
+        """*edges* as {from_key, to_key, props} rows, grouped by (from label, to label)."""
+        grouped: dict[tuple[str, str], list[dict]] = {}
+        for edge in edges:
+            # Try ArangoDB format first (_from, _to)
+            if "_from" in edge and "_to" in edge:
+                from_collection, from_key = self._parse_arango_id(edge["_from"])
+                to_collection, to_key = self._parse_arango_id(edge["_to"])
+            # Fallback to generic format
+            elif "from_id" in edge and "to_id" in edge:
+                from_key = edge["from_id"]
+                to_key = edge["to_id"]
+                from_collection = edge.get("from_collection", "")
+                to_collection = edge.get("to_collection", "")
+            else:
+                self.logger.warning(f"Skipping invalid edge (missing _from/_to or from_id/to_id): {edge}")
+                continue
+
+            if not from_key or not to_key or not from_collection or not to_collection:
+                self.logger.warning(f"Skipping invalid edge (missing required fields): {edge}")
+                continue
+
+            # Extract edge properties (excluding format-specific fields)
+            props = {k: v for k, v in edge.items() if k not in [
+                "_from", "_to", "from_id", "to_id", "from_collection", "to_collection"
+            ]}
+
+            key = (collection_to_label(from_collection), collection_to_label(to_collection))
+            grouped.setdefault(key, []).append({"f
```

**File**: `backend/python/tests/unit/connectors/core/test_data_processor.py` (modified, +4/-1)
```diff
@@ -1940,7 +1940,10 @@ async def test_updates_existing_user_group(self):
         )
         await proc.on_new_user_groups([(group, [])])
         assert group.id == "existing-ug-id"
-        tx_store.delete_edges_to.assert_awaited()
+        tx_store.replace_edges_to.assert_awaited_once_with(
+            "existing-ug-id", CollectionNames.GROUPS.value, [], CollectionNames.PERMISSION.value
+        )
+        tx_store.delete_edges_to.assert_not_awaited()
 
 
 # ===========================================================================
```

**File**: `backend/python/tests/unit/connectors/core/test_data_source_entities_processor.py` (modified, +12/-3)
```diff
@@ -1013,7 +1013,10 @@ async def test_updates_existing_user_group(self):
         await proc.on_new_user_groups([(ug, [])])
 
         assert ug.id == "existing-ug-id"
-        tx_store.delete_edges_to.assert_awaited()
+        tx_store.replace_edges_to.assert_awaited_once_with(
+            "existing-ug-id", CollectionNames.GROUPS.value, [], CollectionNames.PERMISSION.value
+        )
+        tx_store.delete_edges_to.assert_not_awaited()
 
     @pytest.mark.asyncio
     async def test_exception_logged_and_raised(self):
@@ -1132,7 +1135,10 @@ async def test_updates_existing_role(self):
         await proc.on_new_app_roles([(role, [])])
 
         assert role.id == "existing-role-id"
-        tx_store.delete_edges_to.assert_awaited()
+        tx_store.replace_edges_to.assert_awaited_once_with(
+            "existing-role-id", CollectionNames.ROLES.value, [], CollectionNames.PERMISSION.value
+        )
+        tx_store.delete_edges_to.assert_not_awaited()
 
     @pytest.mark.asyncio
     async def test_exception_logged_and_raised(self):
@@ -4880,7 +4886,10 @@ async def test_existing_group_deletes_old_permissions(self):
 
         await proc.on_new_record_groups([(rg, [])])
 
-        tx_store.delete_edges_to.assert_awaited()
+        tx_store.replace_edges_to.assert_awaited_once_with(
+            "rg-existing", CollectionNames.RECORD_GROUPS.value, [], CollectionNames.PERMISSION.value
+        )
+        tx_store.delete_edges_to.assert_not_awaited()
 
 
 # ===========================================================================
```

**File**: `backend/python/tests/unit/connectors/sources/test_connector_workflow_integration.py` (modified, +5/-0)
```diff
@@ -461,6 +461,11 @@ async def batch_create_entity_relations(self, edges: List[Dict]) -> None:
     async def delete_edges_to(self, to_id: str, to_collection: str, collection: str) -> int:
         return self._s.delete_edges_to(collection, to_id, to_collection)
 
+    async def replace_edges_to(self, to_id: str, to_collection: str, edges: list[dict], collection: str) -> None:
+        self._s.delete_edges_to(collection, to_id, to_collection)
+        for edge in edges:
+            self._s.add_edge(collection, edge)
+
     async def delete_edges_from(self, from_id: str, from_collection: str, collection: str) -> int:
         return self._s.delete_edges_from(collection, from_id, from_collection)
 
```

---

### Incident Patch 6: `4cf8ab62` (2026-10-05)
**Commit Message**: fix(connectors): keep tokens on an unchanged config save; mask legacy private_key

PUT /config cleared the stored OAuth tokens whenever the body carried an auth
section, even when nothing in it changed, while leaving the connector marked
signed in. Sending the masked config back would have wiped the tokens. They are
now cleared only when the credentials change, which also covers switching to a
different OAuth app through the top-level oauthConfigId.

Older Google Workspace connectors keep their service account as flat auth keys
that no schema describes, so their private_key is now masked too. The settings
form rebuilds serviceAccountJson from those keys; when private_key comes back
masked it now shows the mask instead of building a broken key, and the save
keeps the stored keys.

The filters-sync save resolves the secret field names before it writes, and
the OpenAPI text says where the secret list comes from and that a new secret
on PUT /config does not change a linked OAuth app.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/nodejs/apps/src/modules/api-docs/pipeshub-openapi.yaml` (modified, +16/-4)
```diff
@@ -13042,7 +13042,7 @@ components:
           properties:
             auth:
               type: object
-              description: "Authentication configuration. Each stored secret (a field the connector's auth schema marks secret, such as an API token, password or client secret) is returned as `••••••••`."
+              description: "Authentication configuration. Each stored secret is returned as `••••••••`: a field the connector type's auth schema marks secret (such as an API token or password), a secret field of its OAuth app registration (such as `clientSecret`), or the `private_key` of an older Google Workspace service account."
             sync:
               type: object
               description: Sync configuration (schedule, options)
@@ -35891,8 +35891,10 @@ paths:
         Get the current configuration for a connector instance.<br><br>
         <b>Security:</b><br>
         OAuth tokens are never returned. Each stored secret in <code>config.auth</code>
-        (a field the connector's auth schema marks secret, such as an API token,
-        password or client secret) is returned as <code>••••••••</code>.
+        is returned as <code>••••••••</code>: a field the connector type's auth schema
+        marks secret (such as an API token or password), a secret field of its OAuth
+        app registration (such as <code>clientSecret</code>), or the <code>private_key</code>
+        of an older Google Workspace service account.
       operationId: getConnectorConfig
       security:
         - bearerAuth: []
@@ -35937,7 +35939,17 @@ paths:
         <b>Secrets:</b><br>
         A secret field in <code>auth</code> sent as <code>••••••••</code> keeps the
         stored value, so the configuration can be sent back as it was read. The
-        response masks stored secrets the same way.
+        response masks stored secrets the same way.<br><br>
+        <b>Signing out:</b><br>
+        Only a change to <code>auth</code>, or a different top-level
+        <code>oauthConfigId</code>, signs the connector out and clears its OAuth
+        tokens. Sending <code>auth</code> back unchanged, with secrets as the mask,
+        keeps it signed in.<br><br>
+        <b>OAuth apps:</b><br>
+        A new secret in <code>auth</code> replaces only this connector's own stored
+        value. It does not change the <code>clientSecret</code> of a linked OAuth app,
+        which is what sign-in uses. To rotate that, update the OAuth app
+        (<code>PUT /oauth/{connectorType}/{configId}</code>).
       operationId: updateConnectorConfig
       security:
         - bearerAuth: []
```

**File**: `backend/python/app/connectors/api/router.py` (modified, +16/-12)
```diff
@@ -1000,6 +1000,10 @@ def _trim_connector_config(config: dict[str, Any]) -> dict[str, Any]:
 
 _OWNER_TOKEN_KEYS = frozenset({OAuthConfigKeys.CREDENTIALS, "oauth"})
 
+# Older Google Workspace connectors keep their service-account key as flat ``auth`` keys,
+# which no schema describes (GoogleClient's legacy path), so its one secret is named here.
+_LEGACY_SERVICE_ACCOUNT_SECRET_KEYS = frozenset({"private_key"})
+
 
 def _schema_marks_secret(field: object) -> bool:
     # BookStack's ``token_secret`` is a PASSWORD input without ``isSecret``, so either marker counts.
@@ -1011,7 +1015,7 @@ async def _secret_auth_field_names(connector_registry: ConnectorRegistry, connec
 
     The OAuth ones matter because ``PUT /config`` stores a ``clientSecret`` sent in ``auth``.
     """
-    names = set(_get_secret_oauth_field_names_from_registry(connector_type))
+    names = set(_get_secret_oauth_field_names_from_registry(connector_type)) | _LEGACY_SERVICE_ACCOUNT_SECRET_KEYS
     metadata = await connector_registry.get_connector_metadata(connector_type)
     if not isinstance(metadata, dict):
         metadata = {}
@@ -5324,6 +5328,7 @@ async def update_connector_instance_filters_sync_config(
         first_time_sync_filters = not old_sync_filters and bool(new_sync_filters)
         sync_filters_changed = old_sync_filters != new_sync_filters
         needs_full_resync = sync_filters_changed or first_time_sync_filters
+        secret_auth_fields = await _secret_auth_field_names(connector_registry, instance.get("type", ""))
         # Save configuration
         await config_service.set_config(config_path, new_config)
         logger.info(f"Updated filters-sync config for instance {connector_id}")
@@ -5360,9 +5365,7 @@ async def update_connector_instance_filters_sync_config(
 
         return {
             "success": True,
-            "config": _config_for_response(
-                new_config, await _secret_auth_field_names(connector_registry, instance.get("type", ""))
-            ),
+            "config": _config_for_response(new_config, secret_auth_fields),
             "message": "Filters and sync configuration saved successfully.",
             "syncFiltersChanged": needs_full_resync,
         }
@@ -5459,9 +5462,10 @@ async def update_connector_instance_config(
         # to edit a sync setting would otherwise de-authenticate a working
         # connector on every save.
         _incoming_auth = body.get("auth")
-        auth_credentials_changed = isinstance(_incoming_auth, dict) and any(
-            (existing_config or {}).get("auth", {}).get(k) != v
-            for k, v in _incoming_auth.items()
+        _stored_auth = (existing_config or {}).get("auth") or {}
+        auth_credentials_changed = isinstance(_incoming_auth, dict) and (
+            any(_stored_auth.get(k) != v for k, v in _incoming_auth.items())
+            or bool(oauth_config_id and oauth_config_id != _stored_auth.get(OAuthConfigKeys.OAUTH_CONFIG_ID))
         )
 
         for section in ["auth", "sync", "filters"]:
@@ -5491,13 +5495,13 @@ async def update_connector_instance_config(
                 connector_registry, instance.get("type", ""), new_config, "saving"
             )
 
-        # Clear credentials and OAuth state only if auth config is being updated
-        # Filters and sync updates don't require re-authentication
-        if auth_updated:
+        # Tokens go only with the credentials that issued them: sending ``auth`` back
+        # unchanged (secrets as the mask) keeps the connector signed in.
+        if auth_credentials_changed:
             new_config[OAuthConfigKeys.CREDENTIALS] = None
             new_config["oauth"] = None
-            if connector_type and isinstance(new_config.get(OAuthConfigKeys.AUTH), dict):
-                new_config[OAuthConfigKeys.AUTH]["connectorType"] = connector_type
+        if auth_updated and connector_type and isinstance(new_config.get(OAuthConfigKeys.AUTH), dict):
+            new_config[OAuthConfigKeys.AUTH]["connectorType"] = connector_type
 
 
         # Prevent auth type changes after connector creation
```

**File**: `backend/python/tests/unit/connectors/api/test_router_config_response_masks_secrets.py` (modified, +51/-3)
```diff
@@ -30,6 +30,8 @@
 _STORED_API_TOKEN = "stored-api-token"
 _STORED_TOKEN_SECRET = "stored-token-secret"
 _STORED_CLIENT_SECRET = "stored-client-secret"
+_STORED_TOKENS = {"access_token": "stored-access-token", "refresh_token": "stored-refresh-token"}
+_STORED_OAUTH_STATE = {"state": "stored-oauth-state"}
 
 _METADATA = {
     "config": {
@@ -64,7 +66,8 @@ def _stored_config(auth_type: str = "API_TOKEN") -> dict[str, Any]:
         "auth": auth,
         "sync": {"selectedStrategy": "MANUAL"},
         "filters": {"sync": {"values": {}}, "indexing": {"values": {}}},
-        "credentials": {"access_token": "stored-access-token"},
+        "credentials": copy.deepcopy(_STORED_TOKENS),
+        "oauth": copy.deepcopy(_STORED_OAUTH_STATE),
     }
 
 
@@ -221,7 +224,10 @@ async def test_config_save_that_sends_the_mask_keeps_the_secret_and_the_connecto
 
     result = await update_connector_instance_config("conn1", request)
 
-    assert _saved(config_service)["auth"]["apiToken"] == _STORED_API_TOKEN
+    saved = _saved(config_service)
+    assert saved["auth"]["apiToken"] == _STORED_API_TOKEN
+    assert saved["credentials"] == _STORED_TOKENS
+    assert saved["oauth"] == _STORED_OAUTH_STATE
     assert result["config"]["auth"]["apiToken"] == REDACTED_PLACEHOLDER
     updates = request.app.state.connector_registry.update_connector_instance.await_args.kwargs["updates"]
     assert "isActive" not in updates
@@ -234,7 +240,10 @@ async def test_config_save_with_a_new_secret_replaces_the_stored_one() -> None:
 
     result = await update_connector_instance_config("conn1", request)
 
-    assert _saved(config_service)["auth"]["apiToken"] == "new-api-token"
+    saved = _saved(config_service)
+    assert saved["auth"]["apiToken"] == "new-api-token"
+    assert saved["credentials"] is None
+    assert saved["oauth"] is None
     assert result["config"]["auth"]["apiToken"] == REDACTED_PLACEHOLDER
     updates = request.app.state.connector_registry.update_connector_instance.await_args.kwargs["updates"]
     assert updates["isActive"] is False
@@ -256,3 +265,42 @@ async def test_oauth_auth_save_that_sends_the_mask_keeps_the_oauth_apps_secret()
 
     (app,) = _saved(config_service, _OAUTH_APPS_PATH)
     assert app["config"]["clientSecret"] == _STORED_CLIENT_SECRET
+
+
+async def test_legacy_flat_service_account_private_key_is_masked_and_kept() -> None:
+    config_service = _config_service()
+    stored_auth = (await config_service.get_config(_CONFIG_PATH))["auth"]
+    stored_auth.update(type="service_account", client_email="sa@example.iam.gserviceaccount.com", private_key="stored-private-key")
+
+    with patch(f"{_ROUTER}.is_request_admin", return_value=False):
+        read = await get_connector_instance_config("conn1", _request(config_service, {}))
+    read_auth = read["config"]["config"]["auth"]
+    assert read_auth["private_key"] == REDACTED_PLACEHOLDER
+    assert read_auth["client_email"] == "sa@example.iam.gserviceaccount.com"
+
+    body = {"auth": {"private_key": REDACTED_PLACEHOLDER, "serviceAccountJson": REDACTED_PLACEHOLDER}}
+    await update_connector_instance_auth_config("conn1", _request(config_service, body), AsyncMock())
+
+    saved_auth = _saved(config_service)["auth"]
+    assert saved_auth["private_key"] == "stored-private-key"
+    assert saved_auth["serviceAccountJson"] == ""
+
+
+async def test_config_save_that_switches_oauth_app_signs_the_connector_out() -> None:
+    config_service = _config_service("OAUTH")
+    request = _request(config_service, {"auth": {"clientSecret": REDACTED_PLACEHOLDER}, "oauthConfigId": "app-2"})
+
+    with (
+        patch(f"{_ROUTER}.get_validated_connector_instance", new_callable=AsyncMock, return_value=_instance("OAUTH")),
+        patch(f"{_ROUTER}.resolve_oauth_config", new_callable=AsyncMock, return_value={"_id": "app-2", "orgId": "org-1"}),
+        patch(f"{_ROUTER}._get_oauth_config_path", return_value=_OAUTH_APPS_PATH),
+    ):
+        await update_connector_instance_config("conn1", request)
+
+    saved = _saved(config_service)
+    assert saved["auth"]["oauthConfigId"] == "app-2"
+    assert saved["auth"]["clientSecret"] == _STORED_CLIENT_SECRET
+    assert saved["credentials"] is None
+    assert saved["oauth"] is None
+    updates = request.app.state.connector_registry.update_connector_instance.await_args.kwargs["updates"]
+    assert updates["isAuthenticated"] is False
```

**File**: `frontend/app/(main)/workspace/connectors/constants.ts` (modified, +6/-0)
```diff
@@ -8,6 +8,12 @@
  */
 export const CONNECTOR_SERVICE_ACCOUNT_JSON_FIELD_NAME = 'serviceAccountJson' as const;
 
+/**
+ * What the connector config routes return in place of a stored secret
+ * (Python `REDACTED_PLACEHOLDER`). Sent back on save, it keeps the stored value.
+ */
+export const CONNECTOR_SECRET_MASK = '••••••••' as const;
+
 // ========================================
 // Connector instance operational status (backend + optimistic UI)
 // ========================================
```

**File**: `frontend/app/(main)/workspace/connectors/utils/__tests__/config-merge.test.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+/**
+ * Older Google Workspace connectors store their service account as flat auth keys,
+ * and the form rebuilds `serviceAccountJson` from them. The config routes mask the
+ * flat `private_key`, so the rebuild must not turn the mask into a new key.
+ */
+import { describe, it, expect } from 'vitest';
+import { mergeConfigWithSchema } from '../config-merge';
+import { CONNECTOR_SECRET_MASK } from '../../constants';
+import { makeConfig, makeSchema } from '../../__tests__/fixtures';
+import type { AuthSchemaField } from '../../types';
+
+const serviceAccountFields: AuthSchemaField[] = [
+  { name: 'adminEmail', displayName: 'Admin email', fieldType: 'EMAIL', required: true },
+  {
+    name: 'serviceAccountJson',
+    displayName: 'Service account key',
+    fieldType: 'FILE',
+    required: true,
+    isSecret: true,
+  },
+];
+
+function legacyFlatConfig(privateKey: string) {
+  return makeConfig({
+    authType: 'CUSTOM',
+    config: {
+      auth: {
+        adminEmail: 'admin@example.com',
+        type: 'service_account',
+        project_id: 'example-project',
+        client_id: '1234567890',
+        client_email: 'sa@example-project.iam.gserviceaccount.com',
+        private_key: privateKey,
+      } as Record<string, unknown>,
+      sync: {},
+      filters: {},
+    },
+  });
+}
+
+describe('mergeConfigWithSchema with a legacy flat service account', () => {
+  const schema = makeSchema({ CUSTOM: serviceAccountFields });
+
+  it('shows the mask, not a rebuilt key, when the private key comes back masked', () => {
+    const merged = mergeConfigWithSchema(legacyFlatConfig(CONNECTOR_SECRET_MASK), schema);
+
+    expect(merged.config.auth.values?.serviceAccountJson).toBe(CONNECTOR_SECRET_MASK);
+  });
+
+  it('still rebuilds the key from flat fields that are not masked', () => {
+    const merged = mergeConfigWithSchema(legacyFlatConfig('test-private-key'), schema);
+
+    const rebuilt = JSON.parse(String(merged.config.auth.values?.serviceAccountJson));
+    expect(rebuilt.private_key).toBe('test-private-key');
+    expect(rebuilt.client_email).toBe('sa@example-project.iam.gserviceaccount.com');
+  });
+});
```

**File**: `frontend/app/(main)/workspace/connectors/utils/config-merge.ts` (modified, +6/-2)
```diff
@@ -13,7 +13,7 @@ import type {
   PanelFormData,
   SyncStrategy,
 } from '../types';
-import { CONNECTOR_SERVICE_ACCOUNT_JSON_FIELD_NAME } from '../constants';
+import { CONNECTOR_SECRET_MASK, CONNECTOR_SERVICE_ACCOUNT_JSON_FIELD_NAME } from '../constants';
 
 /** The merged structure used to initialize form state. */
 export interface MergedConfig {
@@ -112,7 +112,11 @@ function extractAuthValues(
       for (const k of SERVICE_ACCOUNT_JSON_KEYS) {
         if (k in flat) saObj[k] = flat[k];
       }
-      if (Object.keys(saObj).length > 0) {
+      // A rebuilt key holding the masked private_key would be saved as a new, broken key.
+      // The mask itself shows the field as configured and keeps the stored keys on save.
+      if (saObj.private_key === CONNECTOR_SECRET_MASK) {
+        result[CONNECTOR_SERVICE_ACCOUNT_JSON_FIELD_NAME] = CONNECTOR_SECRET_MASK;
+      } else if (Object.keys(saObj).length > 0) {
         result[CONNECTOR_SERVICE_ACCOUNT_JSON_FIELD_NAME] = JSON.stringify(saObj, null, 2);
       }
     }
```

---

### Incident Patch 7: `d0b78b68` (2026-10-05)
**Commit Message**: fix(connectors): mask stored secrets in connector config responses

GET /connectors/:id/config and the three config saves returned the auth
section as stored, so an API token, password or client secret came back
in plain text. Each secret the connector's registry schema marks (isSecret,
or a PASSWORD input) now comes back as the existing REDACTED_PLACEHOLDER,
and a save that sends that mask back keeps the stored value, so the
settings form can round-trip the config without retyping secrets and
without the mask reaching storage or a shared OAuth app.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/nodejs/apps/src/modules/api-docs/pipeshub-openapi.yaml` (modified, +14/-6)
```diff
@@ -13042,7 +13042,7 @@ components:
           properties:
             auth:
               type: object
-              description: Authentication configuration (sensitive data redacted)
+              description: "Authentication configuration. Each stored secret (a field the connector's auth schema marks secret, such as an API token, password or client secret) is returned as `••••••••`."
             sync:
               type: object
               description: Sync configuration (schedule, options)
@@ -13083,7 +13083,7 @@ components:
     # Sub-schemas for connector configuration
     ConnectorAuthConfig:
       type: object
-      description: Authentication configuration for a connector instance
+      description: "Authentication configuration for a connector instance. A secret field sent as `••••••••` (the mask the config routes return) keeps the stored value; send a new value to replace it."
       properties:
         values:
           type: object
@@ -35890,8 +35890,9 @@ paths:
       description: |
         Get the current configuration for a connector instance.<br><br>
         <b>Security:</b><br>
-        Sensitive data (credentials, OAuth tokens) are redacted from the response.
-        Only admins can see partial credential information.
+        OAuth tokens are never returned. Each stored secret in <code>config.auth</code>
+        (a field the connector's auth schema marks secret, such as an API token,
+        password or client secret) is returned as <code>••••••••</code>.
       operationId: getConnectorConfig
       security:
         - bearerAuth: []
@@ -35932,7 +35933,11 @@ paths:
         Disable it first using <code>POST /{id}/toggle</code>.<br><br>
         <b>Partial Updates:</b><br>
         Only provide the sections you want to update. Omitted sections
-        are not modified.
+        are not modified.<br><br>
+        <b>Secrets:</b><br>
+        A secret field in <code>auth</code> sent as <code>••••••••</code> keeps the
+        stored value, so the configuration can be sent back as it was read. The
+        response masks stored secrets the same way.
       operationId: updateConnectorConfig
       security:
         - bearerAuth: []
@@ -35983,7 +35988,10 @@ paths:
         sync or filter settings. Useful for credential rotation.<br><br>
         <b>Prerequisites:</b><br>
         Connector must be disabled. This endpoint clears OAuth state,
-        requiring re-authentication for OAuth connectors.
+        requiring re-authentication for OAuth connectors.<br><br>
+        <b>Secrets:</b><br>
+        A secret field sent as <code>••••••••</code> keeps the stored value; send a
+        new value to replace it. The response masks stored secrets the same way.
       operationId: updateConnectorAuthConfig
       security:
         - bearerAuth: []
```

**File**: `backend/python/app/connectors/api/router.py` (modified, +64/-9)
```diff
@@ -63,6 +63,7 @@
     TokenScopes,
     config_node_constants,
 )
+from app.config.redaction import REDACTED_PLACEHOLDER
 from app.edition_config import (
     allowed_connector_list_scopes,
     annotate_oauth_inheritance,
@@ -1000,9 +1001,53 @@ def _trim_connector_config(config: dict[str, Any]) -> dict[str, Any]:
 _OWNER_TOKEN_KEYS = frozenset({OAuthConfigKeys.CREDENTIALS, "oauth"})
 
 
-def _config_for_response(config: dict[str, Any]) -> dict[str, Any]:
-    """Copy of a stored connector config without the owner's tokens, which never leave the server."""
-    return {key: value for key, value in config.items() if key not in _OWNER_TOKEN_KEYS}
+def _schema_marks_secret(field: object) -> bool:
+    # BookStack's ``token_secret`` is a PASSWORD input without ``isSecret``, so either marker counts.
+    return isinstance(field, dict) and bool(field.get("isSecret") or field.get("fieldType") == "PASSWORD")
+
+
+async def _secret_auth_field_names(connector_registry: ConnectorRegistry, connector_type: str) -> frozenset[str]:
+    """Auth fields the connector's registry schemas mark secret, plus its OAuth app's secret fields.
+
+    The OAuth ones matter because ``PUT /config`` stores a ``clientSecret`` sent in ``auth``.
+    """
+    names = set(_get_secret_oauth_field_names_from_registry(connector_type))
+    metadata = await connector_registry.get_connector_metadata(connector_type)
+    if not isinstance(metadata, dict):
+        metadata = {}
+    schemas = ((metadata.get(OAuthConfigKeys.CONFIG) or {}).get(OAuthConfigKeys.AUTH) or {}).get("schemas")
+    if isinstance(schemas, dict):
+        for schema in schemas.values():
+            fields = schema.get("fields") if isinstance(schema, dict) else None
+            names.update(field["name"] for field in fields or [] if _schema_marks_secret(field) and field.get("name"))
+    # The OAuth save paths accept the snake_case spelling of these fields too.
+    names.update({name.replace("Secret", "_secret") for name in names})
+    return frozenset(names)
+
+
+def _config_for_response(config: dict[str, Any], secret_auth_fields: frozenset[str]) -> dict[str, Any]:
+    """Copy of a stored connector config that is safe to return.
+
+    The owner's tokens never leave the server, and each stored secret in ``auth`` comes
+    back as ``REDACTED_PLACEHOLDER``, which a save treats as "keep the stored value".
+    """
+    response = {key: value for key, value in config.items() if key not in _OWNER_TOKEN_KEYS}
+    auth = response.get(OAuthConfigKeys.AUTH)
+    if isinstance(auth, dict):
+        response[OAuthConfigKeys.AUTH] = {
+            key: REDACTED_PLACEHOLDER if key in secret_auth_fields and value else value
+            for key, value in auth.items()
+        }
+    return response
+
+
+def _without_masked_secrets(auth: dict[str, Any], secret_auth_fields: frozenset[str]) -> dict[str, Any]:
+    """Drop secrets sent back as the mask, so merging the save keeps what is stored."""
+    return {
+        key: value
+        for key, value in auth.items()
+        if not (key in secret_auth_fields and value == REDACTED_PLACEHOLDER)
+    }
 
 
 def _require_filter_sections_are_objects(filters: object) -> None:
@@ -4567,7 +4612,9 @@ async def get_connector_instance_config(
         if not config:
             config = {"auth": {}, "sync": {}, "filters": {}}
 
-        config = _config_for_response(config)
+        config = _config_for_response(
+            config, await _secret_auth_field_names(connector_registry, connector_type)
+        )
 
         # Clean auth section in config (remove redundant OAuth fields that aren't needed)
         if OAuthConfigKeys.AUTH in config:
@@ -4895,7 +4942,10 @@ async def update_connector_instance_auth_config(
         # Merge new auth configuration with existing config
         # Filter out OAuth credential fields - only store reference ID
         new_config = existing_config.copy() if existing_config else {}
-        auth_config_raw = _without_server_set_auth_fields(body.get(OAuthConfigKeys.AUTH, {}))
+        secret_auth_fields = await _secret_auth_field_names(connector_registry, connector_type)
+        auth_config_raw = _without_masked_secrets(
+            _without_server_set_auth_fields(body.get(OAuthConfigKeys.AUTH, {})), secret_auth_fields
+        )
 
         # Auto-create or update OAuth config if OAuth fields are provided and user is admin
         # This happens when admin updates connector auth with OAuth credentials directly
@@ -5157,7 +5207,7 @@ async def update_connector_instance_auth_config(
 
         return {
             "success": True,
-            "config": _config_for_response(new_config),
+            "config": _config_for_response(new_config, secret_auth_fields),
             "message": "Authentication configuration saved successfully."
         }
 
@@ -5310,7 +5360,9 @@ async def update_connector_instance_filters_sync_config(
 
         return {
             "success": True,
-            "config": _config
```

**File**: `backend/python/tests/unit/connectors/api/test_router_config_response_masks_secrets.py` (added, +258/-0)
```diff
@@ -0,0 +1,258 @@
+"""The connector config routes answer with stored secrets masked, and a save that
+sends the mask back keeps the stored secret.
+
+Which ``auth`` fields are secret comes from the connector's registry schema
+(``isSecret``, or a PASSWORD input) and from its OAuth app's secret fields.
+"""
+
+import copy
+import json
+import logging
+from collections.abc import Awaitable, Callable, Iterator
+from types import SimpleNamespace
+from typing import Any
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+
+from app.config.redaction import REDACTED_PLACEHOLDER
+from app.connectors.api.router import (
+    get_connector_instance_config,
+    update_connector_instance_auth_config,
+    update_connector_instance_config,
+    update_connector_instance_filters_sync_config,
+)
+
+_ROUTER = "app.connectors.api.router"
+_CONFIG_PATH = "/services/connectors/conn1/config"
+_OAUTH_APPS_PATH = "/services/oauth/jira"
+
+_STORED_API_TOKEN = "stored-api-token"
+_STORED_TOKEN_SECRET = "stored-token-secret"
+_STORED_CLIENT_SECRET = "stored-client-secret"
+
+_METADATA = {
+    "config": {
+        "auth": {
+            "schemas": {
+                "API_TOKEN": {
+                    "fields": [
+                        {"name": "apiToken", "fieldType": "PASSWORD", "isSecret": True},
+                        # A PASSWORD input whose schema forgot isSecret, like BookStack's token_secret.
+                        {"name": "tokenSecret", "fieldType": "PASSWORD", "isSecret": False},
+                        {"name": "baseUrl", "fieldType": "URL", "isSecret": False},
+                        {"name": "serviceAccountJson", "fieldType": "FILE", "isSecret": True},
+                    ]
+                }
+            }
+        }
+    }
+}
+
+
+def _stored_config(auth_type: str = "API_TOKEN") -> dict[str, Any]:
+    auth: dict[str, Any] = {
+        "connectorScope": "personal",
+        "authType": auth_type,
+        "baseUrl": "https://jira.example.com",
+    }
+    if auth_type == "API_TOKEN":
+        auth.update(apiToken=_STORED_API_TOKEN, tokenSecret=_STORED_TOKEN_SECRET, serviceAccountJson="")
+    else:
+        auth.update(clientId="stored-client-id", clientSecret=_STORED_CLIENT_SECRET, oauthConfigId="app-1")
+    return {
+        "auth": auth,
+        "sync": {"selectedStrategy": "MANUAL"},
+        "filters": {"sync": {"values": {}}, "indexing": {"values": {}}},
+        "credentials": {"access_token": "stored-access-token"},
+    }
+
+
+def _oauth_apps() -> list[dict[str, Any]]:
+    return [
+        {
+            "_id": "app-1",
+            "orgId": "org-1",
+            "oauthInstanceName": "Jira app",
+            "config": {"clientId": "stored-client-id", "clientSecret": _STORED_CLIENT_SECRET},
+        }
+    ]
+
+
+def _instance(auth_type: str = "API_TOKEN") -> dict[str, Any]:
+    return {
+        "_key": "conn1",
+        "type": "jira",
+        "authType": auth_type,
+        "isActive": False,
+        "scope": "personal",
+        "createdBy": "user-1",
+        "name": "My Jira",
+    }
+
+
+def _config_service(auth_type: str = "API_TOKEN") -> AsyncMock:
+    stored = {_CONFIG_PATH: _stored_config(auth_type), _OAUTH_APPS_PATH: _oauth_apps()}
+    svc = AsyncMock()
+    svc.get_config = AsyncMock(side_effect=lambda path, **kwargs: stored.get(path, kwargs.get("default", {})))
+    svc.set_config = AsyncMock(return_value=True)
+    return svc
+
+
+def _request(config_service: AsyncMock, body: dict[str, Any], *, role: str = "member") -> MagicMock:
+    user = {"userId": "user-1", "orgId": "org-1", "role": role}
+    registry = AsyncMock()
+    registry.get_connector_instance = AsyncMock(return_value=_instance())
+    registry.get_connector_metadata = AsyncMock(return_value=copy.deepcopy(_METADATA))
+    registry.update_connector_instance = AsyncMock(return_value={"_key": "conn1"})
+
+    container = SimpleNamespace(
+        logger=MagicMock(return_value=logging.getLogger("test")),
+        config_service=MagicMock(return_value=config_service),
+    )
+    request = MagicMock()
+    request.state.user.get = lambda key, default=None: user.get(key, default)
+    request.json = AsyncMock(return_value=body)
+    request.app.container = container
+    request.app.state = SimpleNamespace(connector_registry=registry)
+    return request
+
+
+@pytest.fixture(autouse=True)
+def _edition_and_access() -> Iterator[None]:
+    with (
+        patch(f"{_ROUTER}.resolve_config_service", side_effect=lambda container, org_id: container.config_service()),
+        patch(f"{_ROUTER}.get_validated_connector_instance", new_callable=AsyncMock, return_value=_instance()),
+        patch(f"{_ROUTER}.check_beta_connector_access", new_callable=AsyncMock),
+        patch(f"{_ROUTER}._get_secret_oauth_field_names_from_registry", return_value={"clientSecret"}),
+    ):
+        yield
+
+
+def _saved(config_service: AsyncMock, path: str = _CONFIG_PATH) -> dict[str, Any] | list[dict[str, Any]]:
+    sav
```

**File**: `backend/python/tests/unit/connectors/api/test_router_update_config.py` (modified, +2/-2)
```diff
@@ -1091,8 +1091,8 @@ async def test_api_token_auth_skips_oauth_metadata(self, mock_get_inst, mock_ts)
         # No OAuth URLs should be present
         assert "authorizeUrl" not in result["config"].get("auth", {})
         assert "tokenUrl" not in result["config"].get("auth", {})
-        # get_connector_metadata should NOT have been called
-        registry.get_connector_metadata.assert_not_awaited()
+        saved_auth = config_service.set_config.await_args.args[1]["auth"]
+        assert not {"authorizeUrl", "tokenUrl", "scopes", "redirectUri"} & saved_auth.keys()
 
 
 # ============================================================================
```

---

### Incident Patch 8: `4cb99c5e` (2026-10-05)
**Commit Message**: fix(connectors): name the collection roles that still get 403 on stats

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/nodejs/apps/src/modules/api-docs/pipeshub-openapi.yaml` (modified, +1/-1)
```diff
@@ -35225,7 +35225,7 @@ paths:
         '403':
           description: |
             Insufficient OAuth scope, or a collection the caller has a role on
-            below READER
+            other than OWNER, WRITER or READER
         '404':
           description: |
             Connector not found, or one the caller cannot open (another user's
```

**File**: `backend/python/tests/unit/connectors/api/test_connector_resolvers.py` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ async def test_kb_without_any_role_answers_404(self) -> None:
         assert exc_info.value.status_code == 404
         assert exc_info.value.detail == not_found("This connector")
 
-    async def test_kb_role_below_reader_stays_403(self) -> None:
+    async def test_kb_role_outside_owner_writer_reader_stays_403(self) -> None:
         """The caller can see this collection, so the refusal is about permission, not existence."""
         with pytest.raises(HTTPException) as exc_info:
             await _authorize(_app(type_="KB"), "member-b", is_admin=False, kb_role="COMMENTER")
```

---

### Incident Patch 9: `4be958be` (2026-10-05)
**Commit Message**: fix(connectors): answer 404, not 403, for stats on a connector you cannot open

The stats route answered 403 to an admin asking about a member's personal
connector, which confirmed the connector exists. Every other connector read
answers 404 there. Stats now go through the same read gate as
GET /connectors/{id} and answer 404 with the same message wherever that
gate refuses. A collection the caller has no role on answers 404 as the
knowledge-base reads do; 403 stays for a role below READER.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/nodejs/apps/src/modules/api-docs/pipeshub-openapi.yaml` (modified, +6/-2)
```diff
@@ -35223,9 +35223,13 @@ paths:
         '401':
           description: Unauthorized
         '403':
-          description: Insufficient OAuth scope or no access to connector stats
+          description: |
+            Insufficient OAuth scope, or a collection the caller has a role on
+            below READER
         '404':
-          description: Connector not found
+          description: |
+            Connector not found, or one the caller cannot open (another user's
+            personal connector, admins included)
 
   /connectors/record/{recordId}/content:
     get:
```

**File**: `backend/python/app/connectors/api/connector_resolvers.py` (modified, +19/-8)
```diff
@@ -15,6 +15,7 @@
 from app.config.constants.http_status_code import HttpStatusCode
 from app.connectors.core.base.data_store.graph_data_store import GraphDataStore
 from app.api.middlewares.auth import is_request_admin
+from app.utils.user_messages import not_found
 
 logger = logging.getLogger(__name__)
 
@@ -52,16 +53,20 @@ async def authorize_connector_stats(
     connector_id: str,
     org_id: str,
 ) -> None:
-    """OSS: the caller's org, then KB role or can_user_view_connector."""
+    """OSS: the caller's org, then KB role or the connector read gate.
+
+    A connector the caller may not open answers 404 like every other read, so
+    stats never confirm that someone else's personal connector exists.
+    """
     user_id = request.state.user.get("userId")
     is_admin = is_request_admin(request)
 
     app_doc = await graph_provider.get_document(connector_id, CollectionNames.APPS.value)
     # Another org's connector answers like a missing one, so its id is not confirmed.
     if not app_doc or not await connector_registry.belongs_to_org(app_doc, org_id):
         raise HTTPException(
-            status_code=404,
-            detail=f"Connector instance {connector_id} not found",
+            status_code=HttpStatusCode.NOT_FOUND.value,
+            detail=not_found("This connector"),
         )
 
     if app_doc.get("type") == Connectors.KNOWLEDGE_BASE.value:
@@ -72,6 +77,12 @@ async def authorize_connector_stats(
                 detail=f"User not found for user_id: {user_id}",
             )
         user_role = await graph_provider.get_user_kb_permission(connector_id, user.get("_key"))
+        # No role at all means the caller cannot see the collection; the KB reads answer 404 there too.
+        if not user_role:
+            raise HTTPException(
+                status_code=HttpStatusCode.NOT_FOUND.value,
+                detail=not_found("This connector"),
+            )
         if user_role not in ("OWNER", "WRITER", "READER"):
             raise HTTPException(
                 status_code=403,
@@ -82,13 +93,13 @@ async def authorize_connector_stats(
             )
         return
 
-    can_view = await connector_registry.can_user_view_connector(
-        connector_id, app_doc, user_id, is_admin=is_admin
+    connector = await connector_registry.get_connector_instance(
+        connector_id, user_id, org_id, is_admin=is_admin
     )
-    if not can_view:
+    if not connector:
         raise HTTPException(
-            status_code=403,
-            detail=f"Insufficient permissions to access stats for connector {connector_id}",
+            status_code=HttpStatusCode.NOT_FOUND.value,
+            detail=not_found("This connector"),
         )
 
 
```

**File**: `backend/python/tests/unit/connectors/api/test_connector_resolvers.py` (modified, +94/-139)
```diff
@@ -1,10 +1,14 @@
 """Tests for app.connectors.api.connector_resolvers — OSS edition connector resolver helpers."""
 
+from typing import TYPE_CHECKING
 from unittest.mock import AsyncMock, MagicMock, patch
 
 import pytest
 from fastapi import HTTPException
 
+if TYPE_CHECKING:
+    from app.connectors.core.registry.connector_registry import ConnectorRegistry
+
 
 # ---------------------------------------------------------------------------
 # resolve_config_service
@@ -88,146 +92,97 @@ def test_returns_user_key(self) -> None:
 # ---------------------------------------------------------------------------
 
 
-class TestAuthorizeConnectorStats:
-    async def test_non_kb_admin_allowed(self) -> None:
-        from app.connectors.api.connector_resolvers import authorize_connector_stats
+ORG = "org-1"
+CONN = "conn-1"
 
-        request = MagicMock()
-        request.state.user = {"userId": "u1"}
-        graph_provider = AsyncMock()
-        graph_provider.get_document = AsyncMock(return_value={"type": "GOOGLE_DRIVE"})
-        connector_registry = AsyncMock()
-        connector_registry.can_user_view_connector = AsyncMock(return_value=True)
-
-        with patch(
-            "app.connectors.api.connector_resolvers.is_request_admin",
-            return_value=True,
-        ):
-            await authorize_connector_stats(
-                request, graph_provider, connector_registry, "conn-1", "org-1"
-            )
-
-    async def test_non_admin_with_view_permission(self) -> None:
-        from app.connectors.api.connector_resolvers import authorize_connector_stats
-
-        request = MagicMock()
-        request.state.user = {"userId": "u1"}
-        graph_provider = AsyncMock()
-        graph_provider.get_document = AsyncMock(return_value={"type": "GOOGLE_DRIVE"})
-        connector_registry = AsyncMock()
-        connector_registry.can_user_view_connector = AsyncMock(return_value=True)
-
-        with patch(
-            "app.connectors.api.connector_resolvers.is_request_admin",
-            return_value=False,
-        ):
-            await authorize_connector_stats(
-                request, graph_provider, connector_registry, "conn-1", "org-1"
-            )
-
-    async def test_not_found_raises_404(self) -> None:
-        from app.connectors.api.connector_resolvers import authorize_connector_stats
-
-        request = MagicMock()
-        request.state.user = {"userId": "u1"}
-        graph_provider = AsyncMock()
-        graph_provider.get_document = AsyncMock(return_value=None)
-        connector_registry = AsyncMock()
-
-        with patch(
-            "app.connectors.api.connector_resolvers.is_request_admin",
-            return_value=False,
-        ):
-            with pytest.raises(HTTPException) as exc_info:
-                await authorize_connector_stats(
-                    request, graph_provider, connector_registry, "conn-1", "org-1"
-                )
-            assert exc_info.value.status_code == 404
-
-    async def test_another_orgs_connector_answers_like_a_missing_one(self) -> None:
-        """An admin passing a team connector id from another org must not learn its stats."""
-        from app.connectors.api.connector_resolvers import authorize_connector_stats
-        from app.connectors.core.registry.connector_registry import ConnectorRegistry
-
-        request = MagicMock()
-        request.state.user = {"userId": "admin-1"}
-        graph_provider = AsyncMock()
-        graph_provider.get_document = AsyncMock(return_value={
-            "_key": "conn-1", "type": "GOOGLE_DRIVE", "scope": "team",
-            "createdBy": "someone", "orgId": "org-2",
-        })
-        connector_registry = ConnectorRegistry.__new__(ConnectorRegistry)
-        connector_registry.logger = MagicMock()
-
-        with patch(
-            "app.connectors.api.connector_resolvers.is_request_admin",
-            return_value=True,
-        ):
-            with pytest.raises(HTTPException) as exc_info:
-                await authorize_connector_stats(
-                    request, graph_provider, connector_registry, "conn-1", "org-1"
-                )
-            assert exc_info.value.status_code == 404
-
-    async def test_no_view_permission_raises_403(self) -> None:
-        from app.connectors.api.connector_resolvers import authorize_connector_stats
-
-        request = MagicMock()
-        request.state.user = {"userId": "u1"}
-        graph_provider = AsyncMock()
-        graph_provider.get_document = AsyncMock(return_value={"type": "GOOGLE_DRIVE"})
-        connector_registry = AsyncMock()
-        connector_registry.can_user_view_connector = AsyncMock(return_value=False)
-
-        with patch(
-            "app.connectors.api.connector_resolvers.is_request_admin",
-            return_value=False,
-        ):
-            with pytest.raises(HTTPException) as exc_info:
-                await authorize_connector_stats(
-                    request, graph_provider, connector_registry, "conn
```

**File**: `backend/python/tests/unit/connectors/api/test_router_coverage_gaps.py` (modified, +3/-3)
```diff
@@ -902,7 +902,7 @@ async def test_success_returns_data(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(return_value={"success": True, "data": {"count": 10}})
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         result = await get_connector_stats_endpoint(req, connector_id="c1", graph_provider=gp)
@@ -914,7 +914,7 @@ async def test_not_found_raises_404(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(return_value={"success": False})
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         with pytest.raises(HTTPException) as exc_info:
@@ -928,7 +928,7 @@ async def test_generic_exception_propagates(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(side_effect=RuntimeError("boom"))
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         with pytest.raises(HTTPException) as exc_info:
```

**File**: `backend/python/tests/unit/connectors/api/test_router_full_coverage.py` (modified, +1/-1)
```diff
@@ -779,7 +779,7 @@ async def test_generic_exception_after_success(self):
         gp.get_connector_stats = AsyncMock(return_value={"success": False})
 
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
 
         req = MagicMock()
         req.app.container.logger.return_value = MagicMock()
```

**File**: `backend/python/tests/unit/connectors/api/test_router_gaps.py` (modified, +15/-15)
```diff
@@ -900,7 +900,7 @@ async def test_success_returns_data(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(return_value={"success": True, "data": {"count": 10}})
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         result = await get_connector_stats_endpoint(req, connector_id="c1", graph_provider=gp)
@@ -912,7 +912,7 @@ async def test_not_found_raises_404(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(return_value={"success": False})
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         with pytest.raises(HTTPException) as exc_info:
@@ -926,7 +926,7 @@ async def test_generic_exception_propagates(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(side_effect=RuntimeError("boom"))
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         with pytest.raises(HTTPException) as exc_info:
@@ -4174,7 +4174,7 @@ async def test_success_returns_data(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(return_value={"success": True, "data": {"count": 10}})
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         result = await get_connector_stats_endpoint(req, connector_id="c1", graph_provider=gp)
@@ -4186,7 +4186,7 @@ async def test_not_found_raises_404(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(return_value={"success": False})
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         with pytest.raises(HTTPException) as exc_info:
@@ -4200,7 +4200,7 @@ async def test_generic_exception_propagates(self):
         gp.get_document = AsyncMock(return_value={"type": "Slack"})
         gp.get_connector_stats = AsyncMock(side_effect=RuntimeError("boom"))
         registry = AsyncMock()
-        registry.can_user_view_connector = AsyncMock(return_value=True)
+        registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
         req = _mock_request(graph_provider=gp, connector_registry=registry)
 
         with pytest.raises(HTTPException) as exc_info:
@@ -6664,8 +6664,8 @@ async def test_kb_collection_with_reader_permission_allowed(self):
         gp.get_connector_stats.assert_called_once_with("org1", "kb1")
 
     @pytest.mark.asyncio
-    async def test_kb_collection_without_permission_returns_403(self):
-        """User without KB permission gets 403."""
+    async def test_kb_collection_without_permission_returns_404(self) -> None:
+        """A user with no role on the collection gets 404, as the KB reads answer."""
         gp = AsyncMock()
         gp.get_document = AsyncMock(return_value={
             "type": Connectors.KNOWLEDGE_BASE.value,
@@ -6685,7 +6685,7 @@ async def test_kb_collection_without_permission_returns_403(self):
         
         with pytest.raises(HTTPException) as exc_info:
             await get_connector_stats_endpoint(req, connector_id="kb1", graph_provider=gp)
-        assert exc_info.value.status_code == 403
+        assert exc_info.value.status_code == 404
 
     @pytest.mark.asyncio
     async def test_external_connector_visible_allowed(self):
@@ -6700,7 +6700,7 @@ async def test_external_connector_visible_allowed(self):
         gp.get_connector_stats = AsyncMock(return_value={"success": True, "data": {"total": 50}})
 
         connector_registry = AsyncMock()
-        connector_registry.can_user_view_connector = AsyncMock(return_value=True)
+        connector_registry.get_connector_instance = AsyncMock(return_value={"_key": "conn1"})
 
         container = MagicMock()
         container.logger = MagicMock(return_value=logging.getLogger("test"))
@@ -6711,11 +6711,11 @@ async def test_external_connector_visible_allowed(self):

```

**File**: `backend/python/tests/unit/connectors/api/test_router_part1.py` (modified, +2/-2)
```diff
@@ -1541,7 +1541,7 @@ async def test_success(self):
         })
 
         connector_registry = AsyncMock()
-        connector_registry.can_user_view_connector = AsyncMock(return_value=True)
+        connector_registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
 
         container = MagicMock()
         container.logger = MagicMock(return_value=MagicMock())
@@ -1569,7 +1569,7 @@ async def test_not_found_raises_404(self):
         gp.get_connector_stats = AsyncMock(return_value={"success": False})
 
         connector_registry = AsyncMock()
-        connector_registry.can_user_view_connector = AsyncMock(return_value=True)
+        connector_registry.get_connector_instance = AsyncMock(return_value={"_key": "conn-1"})
 
         container = MagicMock()
         container.logger = MagicMock(return_value=MagicMock())
```

---

### Incident Patch 10: `304b9cad` (2026-10-05)
**Commit Message**: fix(connectors): list a personal connector only for the user who created it

With no scope, the connector list query had no scope condition at all, so
every member and admin saw everyone else's personal connectors in their org,
although opening one answers 404. The rule now sits in the conditions the
count and the page query share, on Neo4j and ArangoDB alike, so the totals
match the rows. Team connectors are listed as before.

This covers GET /connectors/ without a scope, /configured and
/agents/active, and the registry's by-group list, which all read through
get_filtered_connector_instances. /active, /inactive and the agent and chat
checks for a configured SQL or Slack connector already used the owner-only
lookup.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/services/graph_db/arango/arango_http_provider.py` (modified, +5/-0)
```diff
@@ -1757,11 +1757,16 @@ async def get_filtered_connector_instances(
                         LIMIT 1
                         RETURN 1
                 ) > 0
+                FILTER doc.scope == @team_scope OR doc.createdBy == @user_id
             """
+            # Only the creator sees a personal connector, admins included: the
+            # read gate refuses the rest, and count and page must agree.
             bind_vars = {
                 "@collection": collection,
                 "@org_edge_collection": edge_collection,
                 "org_handle": f"{CollectionNames.ORGS.value}/{org_id}",
+                "team_scope": "team",
+                "user_id": user_id,
             }
 
             # Exclude KB if requested
```

**File**: `backend/python/app/services/graph_db/interface/graph_db_provider.py` (modified, +3/-1)
```diff
@@ -4922,7 +4922,9 @@ async def get_filtered_connector_instances(
             collection: Collection name (e.g., "apps")
             edge_collection: Edge collection for org-app relation
             org_id: Organization ID; only apps linked to it through ``edge_collection`` are returned
-            user_id: User ID
+            user_id: User ID. With or without ``scope``, a connector that is not
+                team-scoped is returned only when this user created it, admins
+                included.
             scope: Optional scope filter ("personal" or "team")
             search: Optional search query (searches name, type, appGroup)
             skip: Number of items to skip
```

**File**: `backend/python/app/services/graph_db/neo4j/neo4j_provider.py` (modified, +4/-1)
```diff
@@ -15819,11 +15819,14 @@ async def get_filtered_connector_instances(
             # August 2026 carry no orgId property.
             org_label = collection_to_label(CollectionNames.ORGS.value)
             org_rel = self._get_relationship_type(edge_collection)
+            # Only the creator sees a personal connector, admins included: the
+            # read gate refuses the rest, and count and page must agree.
             conditions = [
                 "doc.id IS NOT NULL",
                 f"EXISTS {{ MATCH (:{org_label} {{id: $org_id}})-[:{org_rel}]->(doc) }}",
+                "(doc.scope = $team_scope OR doc.createdBy = $user_id)",
             ]
-            params = {"org_id": org_id}
+            params = {"org_id": org_id, "team_scope": "team", "user_id": user_id}
 
             # Exclude KB if requested
             if exclude_kb and kb_connector_type:
```

**File**: `backend/python/tests/integration/graph_db/test_connector_list_personal_visibility_real_backends.py` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+"""Each user lists only their own personal connector, on real Neo4j and ArangoDB.
+
+Two members and an admin in one org each own a personal connector, and the org
+has one team connector. With no ``scope`` the list query used to return all
+four to everyone, admins included, although opening another user's personal
+connector answers 404. Each caller must see their own personal connector and
+the team one, and the total must match the rows on every page.
+
+Runs in backend-matrix on both graph jobs. Environment: NEO4J_IT_URI,
+NEO4J_IT_PASSWORD, ARANGO_IT_URL, ARANGO_IT_PASSWORD.
+"""
+
+from __future__ import annotations
+
+import contextlib
+import logging
+import uuid
+from dataclasses import dataclass
+from typing import TYPE_CHECKING
+
+import pytest
+
+from app.config.constants.arangodb import CollectionNames
+from app.connectors.core.registry.connector_builder import ConnectorScope
+from app.utils.time_conversion import get_epoch_timestamp_in_ms
+from tests.integration.real_graph import (
+    backend_unavailable,
+    connect_arango,
+    connect_neo4j,
+)
+
+if TYPE_CHECKING:
+    from collections.abc import AsyncIterator
+
+    from app.services.graph_db.interface.graph_db_provider import IGraphDBProvider
+
+pytestmark = [pytest.mark.integration, pytest.mark.timeout(300)]
+
+ARANGO_DB = "connector_list_personal_visibility_it"
+CALLERS = {"member_a": False, "member_b": False, "admin": True}
+
+logger = logging.getLogger("connector-list-personal-visibility-it")
+
+
+@dataclass
+class _Org:
+    graph: IGraphDBProvider
+    org_id: str
+    user_ids: dict[str, str]
+    personal: dict[str, str]
+    team: str
+
+    async def page(self, caller: str, *, page: int = 1, limit: int = 20, **filters: object) -> tuple[list[str], int]:
+        documents, total = await self.graph.get_filtered_connector_instances(
+            collection=CollectionNames.APPS.value,
+            edge_collection=CollectionNames.ORG_APP_RELATION.value,
+            org_id=self.org_id,
+            user_id=self.user_ids[caller],
+            skip=(page - 1) * limit,
+            limit=limit,
+            is_admin=CALLERS[caller],
+            **filters,
+        )
+        return [d.get("_key") or d.get("id") for d in documents], total
+
+
+@pytest.fixture(params=["neo4j", "arango"])
+async def org(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[_Org]:
+    async with contextlib.AsyncExitStack() as cleanup:
+        try:
+            graph = await (
+                connect_neo4j(logger, monkeypatch) if request.param == "neo4j"
+                else connect_arango(logger, ARANGO_DB)
+            )
+        except Exception as exc:
+            backend_unavailable(request.param, exc)
+        disconnect = getattr(graph, "disconnect", None)
+        if disconnect is not None:
+            cleanup.push_async_callback(disconnect)
+
+        run = uuid.uuid4().hex[:10]
+        org_id = f"org-plv-{run}"
+        user_ids = {caller: f"{caller}-{run}" for caller in CALLERS}
+        personal = {caller: f"personal-{caller}-{run}" for caller in CALLERS}
+        team = f"team-{run}"
+        now = get_epoch_timestamp_in_ms()
+
+        async def remove() -> None:
+            with contextlib.suppress(Exception):
+                await graph.delete_nodes_and_edges([*personal.values(), team], CollectionNames.APPS.value)
+                await graph.delete_nodes_and_edges([org_id], CollectionNames.ORGS.value)
+
+        cleanup.push_async_callback(remove)
+
+        assert await graph.batch_upsert_nodes(
+            [{"id": org_id, "accountType": "enterprise", "name": "Acme", "isActive": True,
+              "createdAtTimestamp": now, "updatedAtTimestamp": now}],
+            collection=CollectionNames.ORGS.value,
+        )
+        apps = [(personal[c], ConnectorScope.PERSONAL.value, user_ids[c]) for c in CALLERS]
+        apps.append((team, ConnectorScope.TEAM.value, user_ids["admin"]))
+        assert await graph.batch_upsert_nodes(
+            [{"id": app_id, "name": app_id, "type": "Drive", "appGroup": "Google Workspace",
+              "authType": "OAUTH", "scope": scope, "orgId": org_id, "isActive": True,
+              "isAgentActive": True, "isConfigured": True, "isAuthenticated": True,
+              "createdBy": creator, "updatedBy": creator,
+              "createdAtTimestamp": now + i, "updatedAtTimestamp": now + i}
+             for i, (app_id, scope, creator) in enumerate(apps)],
+            collection=CollectionNames.APPS.value,
+        )
+        assert await graph.batch_create_edges(
+            [{"from_id": org_id, "from_collection": CollectionNames.ORGS.value,
+              "to_id": app_id, "to_collection": CollectionNames.APPS.value,
+              "createdAtTimestamp": now}
+             for app_id, _scope, _creator in apps],
+            collection=CollectionNames.ORG_APP_RELATION.value,
+        )
+        yield _Org(graph, org_id, user_ids, personal, team)

```

**File**: `backend/python/tests/unit/services/graph_db/test_connector_listing_personal_owner_only.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+"""A personal connector is listed only for the user who created it, on both graph backends.
+
+With no ``scope`` the listing query had no scope condition at all, so every
+member and admin saw everyone else's personal connectors, although opening one
+answers 404. The rule sits in the conditions both the count and the page query
+share, so the totals match the rows.
+"""
+
+import logging
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+
+from app.services.graph_db.arango.arango_http_provider import ArangoHTTPProvider
+from app.services.graph_db.neo4j.neo4j_provider import Neo4jProvider
+
+CALLER = "user-1"
+NEO4J_OWNER_PREDICATE = "(doc.scope = $team_scope OR doc.createdBy = $user_id)"
+ARANGO_OWNER_PREDICATE = "FILTER doc.scope == @team_scope OR doc.createdBy == @user_id"
+
+LISTING_CALLS = [
+    pytest.param({}, id="no-scope-member"),
+    pytest.param({"is_admin": True}, id="no-scope-admin"),
+    pytest.param({"is_admin": True, "is_configured": True}, id="configured-admin"),
+    pytest.param({"is_configured": True, "is_agent_active": True}, id="agents-active"),
+    pytest.param({"scope": "personal"}, id="personal"),
+    pytest.param({"scope": "team", "is_admin": True}, id="team-admin"),
+    pytest.param({"scope": "team", "is_admin": False}, id="team-member"),
+]
+
+
+@pytest.fixture
+def neo4j_provider() -> Neo4jProvider:
+    provider = Neo4jProvider(logger=MagicMock(), config_service=MagicMock())
+    provider.client = AsyncMock()
+    provider.client.execute_query = AsyncMock(side_effect=[[{"total": 0}], []])
+    provider._get_user_accessible_team_app_ids = AsyncMock(return_value=["app-1"])
+    return provider
+
+
+@pytest.fixture
+def arango_provider() -> ArangoHTTPProvider:
+    provider = ArangoHTTPProvider(MagicMock(spec=logging.Logger), AsyncMock())
+    provider.http_client = AsyncMock()
+    provider.execute_query = AsyncMock(side_effect=[[0], []])
+    provider._get_user_accessible_team_app_keys = AsyncMock(return_value=["app-1"])
+    return provider
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("kwargs", LISTING_CALLS)
+async def test_neo4j_count_and_page_both_hide_other_users_personal_connectors(
+    neo4j_provider: Neo4jProvider, kwargs: dict
+) -> None:
+    await neo4j_provider.get_filtered_connector_instances(
+        collection="apps", edge_collection="orgAppRelation",
+        org_id="org-acme", user_id=CALLER, **kwargs,
+    )
+
+    calls = neo4j_provider.client.execute_query.await_args_list
+    assert len(calls) == 2
+    for call in calls:
+        assert NEO4J_OWNER_PREDICATE in call.args[0]
+        assert call.kwargs["parameters"]["user_id"] == CALLER
+        assert call.kwargs["parameters"]["team_scope"] == "team"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("kwargs", LISTING_CALLS)
+async def test_arango_count_and_page_both_hide_other_users_personal_connectors(
+    arango_provider: ArangoHTTPProvider, kwargs: dict
+) -> None:
+    await arango_provider.get_filtered_connector_instances(
+        collection="apps", edge_collection="orgAppRelation",
+        org_id="org-acme", user_id=CALLER, **kwargs,
+    )
+
+    calls = arango_provider.execute_query.await_args_list
+    assert len(calls) == 2
+    for call in calls:
+        assert ARANGO_OWNER_PREDICATE in call.args[0]
+        assert call.kwargs["bind_vars"]["user_id"] == CALLER
+        assert call.kwargs["bind_vars"]["team_scope"] == "team"
```

---

### Incident Patch 11: `7840e4d3` (2026-10-05)
**Commit Message**: fix(graph): match a Jira issue key exactly, so ENG-1 no longer finds ENG-12 (#3914)

get_record_by_issue_key matched "/browse/{key}" anywhere in the webUrl and took
the first row, so a lookup for ENG-1 could return ENG-12 or ENG-123. Both Jira
deletion paths act on that row, so an audit-log deletion of ENG-1 could delete
a different issue.

Both providers now bind one shared regex that requires the key to end the URL
or be followed by /, ? or #. Neo4j applies it with =~ and Arango with
REGEX_TEST; it is still a bound parameter.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/services/graph_db/arango/arango_http_provider.py` (modified, +4/-5)
```diff
@@ -170,6 +170,7 @@
     build_connector_stats_response,
     dedupe_agents_by_id,
     empty_soft_delete_result,
+    jira_issue_browse_url_regex,
     restore_items,
     select_canonical_chain_names,
     soft_delete_request_result,
@@ -5124,24 +5125,22 @@ async def get_record_by_issue_key(
                 "🚀 Retrieving record for Jira issue key %s %s", connector_id, issue_key
             )
 
-            # Search for record where weburl contains "/browse/{issue_key}" and record_type is TICKET
-            # Also join with tickets collection to get the type field (for Epic detection)
+            # Joins the tickets collection for the type field (Epic detection).
             query = f"""
             FOR record IN {CollectionNames.RECORDS.value}
                 FILTER record.connectorId == @connector_id
                     AND record.recordType == @record_type
                     AND record.webUrl != null
-                    AND CONTAINS(record.webUrl, @browse_pattern)
+                    AND REGEX_TEST(record.webUrl, @browse_pattern_regex)
                 LET ticket = DOCUMENT({CollectionNames.TICKETS.value}, record._key)
                 LIMIT 1
                 RETURN {{ record: record, ticket: ticket }}
             """
 
-            browse_pattern = f"/browse/{issue_key}"
             bind_vars = {
                 "connector_id": connector_id,
                 "record_type": "TICKET",
-                "browse_pattern": browse_pattern
+                "browse_pattern_regex": jira_issue_browse_url_regex(issue_key),
             }
 
             results = await self.http_client.execute_aql(query, bind_vars, txn_id=transaction)
```

**File**: `backend/python/app/services/graph_db/common/utils.py` (modified, +10/-0)
```diff
@@ -423,3 +423,13 @@ def trash_purge_row(
             "origin": record.get("origin"),
         },
     }
+
+
+def jira_issue_browse_url_regex(issue_key: str) -> str:
+    """A regex matching a Jira webUrl for exactly ``issue_key``.
+
+    The key must end the URL or be followed by ``/``, ``?`` or ``#``, so ENG-1
+    does not match ENG-12. The leading ``.*`` and trailing ``$`` make it mean
+    the same under Neo4j's whole-string ``=~`` and Arango's substring REGEX_TEST.
+    """
+    return f".*{re.escape(f'/browse/{issue_key}')}(?:[/?#].*)?$"
```

**File**: `backend/python/app/services/graph_db/neo4j/neo4j_provider.py` (modified, +2/-9)
```diff
@@ -12,7 +12,6 @@
 import hashlib
 import json
 import os
-import re
 import time
 import traceback
 import unicodedata
@@ -113,6 +112,7 @@
     build_connector_stats_response,
     dedupe_agents_by_id,
     empty_soft_delete_result,
+    jira_issue_browse_url_regex,
     restore_items,
     select_canonical_chain_names,
     soft_delete_request_result,
@@ -3625,13 +3625,6 @@ async def get_record_by_issue_key(
                 f"🚀 Retrieving record for Jira issue key {connector_id} {issue_key}"
             )
 
-            # Search for record where weburl contains "/browse/{issue_key}" and record_type is TICKET
-            # Neo4j uses regex pattern matching with =~ operator for string contains
-            browse_pattern = f"/browse/{issue_key}"
-            # Escape special regex characters in the pattern
-            escaped_pattern = re.escape(browse_pattern)
-            browse_pattern_regex = f".*{escaped_pattern}.*"
-
             query = """
             MATCH (record:Record)
             WHERE record.connectorId = $connector_id
@@ -3645,7 +3638,7 @@ async def get_record_by_issue_key(
             parameters = {
                 "connector_id": connector_id,
                 "record_type": "TICKET",
-                "browse_pattern_regex": browse_pattern_regex
+                "browse_pattern_regex": jira_issue_browse_url_regex(issue_key),
             }
 
             results = await self.client.execute_query(
```

**File**: `backend/python/tests/integration/graph_db/test_jira_issue_key_lookup_real_backends.py` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+"""get_record_by_issue_key finds exactly the asked-for issue on real Neo4j and ArangoDB.
+
+The lookup used to match "/browse/{key}" anywhere in the webUrl with LIMIT 1, so
+ENG-1 could come back as ENG-12, and the Jira deletion paths then deleted ENG-12.
+ENG-12 and ENG-123 are written before ENG-1 so a loose match meets them first.
+
+Runs in backend-matrix on both graph jobs. Environment: NEO4J_IT_URI,
+NEO4J_IT_PASSWORD, ARANGO_IT_URL, ARANGO_IT_PASSWORD.
+"""
+
+from __future__ import annotations
+
+import contextlib
+import logging
+import uuid
+from dataclasses import dataclass
+from typing import TYPE_CHECKING
+
+import pytest
+
+from app.config.constants.arangodb import CollectionNames, Connectors, OriginTypes
+from app.models.entities import RecordType, TicketRecord
+from tests.integration.real_graph import (
+    backend_unavailable,
+    connect_arango,
+    connect_neo4j,
+)
+
+if TYPE_CHECKING:
+    from collections.abc import AsyncIterator
+
+    from app.services.graph_db.interface.graph_db_provider import IGraphDBProvider
+
+pytestmark = [pytest.mark.integration, pytest.mark.timeout(300)]
+
+ARANGO_DB = "jira_issue_key_lookup_it"
+SITE = "https://acme.atlassian.net"
+
+logger = logging.getLogger("jira-issue-key-lookup-it")
+
+
+@dataclass
+class _Tickets:
+    graph: IGraphDBProvider
+    connector_id: str
+    ids: dict[str, str]
+
+
+def _ticket(org_id: str, connector_id: str, key: str, weburl: str) -> TicketRecord:
+    return TicketRecord(
+        id=str(uuid.uuid4()), org_id=org_id, record_name=f"{key} summary",
+        record_type=RecordType.TICKET, external_record_id=f"ext-{key}", version=1,
+        origin=OriginTypes.CONNECTOR, connector_name=Connectors.JIRA, connector_id=connector_id,
+        weburl=weburl,
+    )
+
+
+@pytest.fixture(params=["neo4j", "arango"])
+async def tickets(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[_Tickets]:
+    async with contextlib.AsyncExitStack() as cleanup:
+        try:
+            graph = await (
+                connect_neo4j(logger, monkeypatch) if request.param == "neo4j"
+                else connect_arango(logger, ARANGO_DB)
+            )
+        except Exception as exc:
+            backend_unavailable(request.param, exc)
+        disconnect = getattr(graph, "disconnect", None)
+        if disconnect is not None:
+            cleanup.push_async_callback(disconnect)
+
+        run = uuid.uuid4().hex[:10]
+        org_id, connector_id = f"org-jik-{run}", f"conn-jik-{run}"
+        rows = [
+            ("ENG-12", f"{SITE}/browse/ENG-12"),
+            ("ENG-123", f"{SITE}/browse/ENG-123"),
+            ("ENG-10-comment", f"{SITE}/browse/ENG-10?focusedCommentId=1"),
+            ("ENG-1", f"{SITE}/browse/ENG-1"),
+        ]
+        records = [_ticket(org_id, connector_id, key, url) for key, url in rows]
+        ids = {key: record.id for (key, _url), record in zip(rows, records, strict=True)}
+
+        async def remove() -> None:
+            with contextlib.suppress(Exception):
+                for collection in (CollectionNames.TICKETS.value, CollectionNames.RECORDS.value):
+                    await graph.delete_nodes_and_edges(list(ids.values()), collection)
+
+        cleanup.push_async_callback(remove)
+        for record in records:
+            assert await graph.batch_upsert_nodes([record.to_arango_base_record()], CollectionNames.RECORDS.value)
+            assert await graph.batch_upsert_nodes([record.to_arango_record()], CollectionNames.TICKETS.value)
+        yield _Tickets(graph, connector_id, ids)
+
+
+async def test_a_key_finds_its_own_issue_not_a_longer_one(tickets: _Tickets) -> None:
+    found = await tickets.graph.get_record_by_issue_key(tickets.connector_id, "ENG-1")
+
+    assert found is not None
+    assert found.id == tickets.ids["ENG-1"], f"ENG-1 resolved to {found.weburl}"
+
+
+async def test_a_key_with_no_issue_of_its_own_finds_nothing(tickets: _Tickets) -> None:
+    await tickets.graph.delete_nodes_and_edges([tickets.ids["ENG-1"]], CollectionNames.RECORDS.value)
+
+    found = await tickets.graph.get_record_by_issue_key(tickets.connector_id, "ENG-1")
+
+    assert found is None, f"ENG-1 resolved to {found.weburl}"
+
+
+async def test_longer_keys_still_find_themselves(tickets: _Tickets) -> None:
+    for key in ("ENG-12", "ENG-123"):
+        found = await tickets.graph.get_record_by_issue_key(tickets.connector_id, key)
+        assert found is not None and found.id == tickets.ids[key], key
```

**File**: `backend/python/tests/unit/services/graph_db/test_jira_issue_key_lookup.py` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+"""get_record_by_issue_key matches the issue key exactly on both graph providers.
+
+The lookup used to match "/browse/{key}" anywhere in the webUrl, so ENG-1 also
+matched ENG-12 and ENG-123, and LIMIT 1 returned whichever came first. The Jira
+deletion paths then deleted that other issue. The fakes below apply the bound
+regex the way each database does (Neo4j ``=~`` matches the whole string, Arango
+``REGEX_TEST`` searches) and return the near-miss row first.
+"""
+
+from __future__ import annotations
+
+import re
+from typing import TYPE_CHECKING, Any
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+
+from app.services.graph_db.arango.arango_http_provider import ArangoHTTPProvider
+from app.services.graph_db.common.utils import jira_issue_browse_url_regex
+from app.services.graph_db.neo4j.neo4j_provider import Neo4jProvider
+
+if TYPE_CHECKING:
+    from collections.abc import Iterator
+
+SITE = "https://acme.atlassian.net"
+ENG_12 = {"_key": "r-eng-12", "webUrl": f"{SITE}/browse/ENG-12"}
+ENG_123 = {"_key": "r-eng-123", "webUrl": f"{SITE}/browse/ENG-123"}
+ENG_1 = {"_key": "r-eng-1", "webUrl": f"{SITE}/browse/ENG-1"}
+
+
+@pytest.mark.parametrize(
+    "url",
+    [
+        f"{SITE}/browse/ENG-1",
+        f"{SITE}/browse/ENG-1/",
+        f"{SITE}/browse/ENG-1?focusedCommentId=10001",
+        f"{SITE}/browse/ENG-1#comment",
+        "http://jira.internal:8080/jira/browse/ENG-1",
+    ],
+)
+def test_regex_matches_the_issue_itself(url: str) -> None:
+    pattern = jira_issue_browse_url_regex("ENG-1")
+    assert re.fullmatch(pattern, url)
+    assert re.search(pattern, url)
+
+
+@pytest.mark.parametrize(
+    "url",
+    [
+        f"{SITE}/browse/ENG-12",
+        f"{SITE}/browse/ENG-123",
+        f"{SITE}/browse/ENG-10?focusedCommentId=1",
+        f"{SITE}/browse/XENG-1",
+    ],
+)
+def test_regex_rejects_other_issues(url: str) -> None:
+    pattern = jira_issue_browse_url_regex("ENG-1")
+    assert not re.fullmatch(pattern, url)
+    assert not re.search(pattern, url)
+
+
+def test_regex_escapes_the_key() -> None:
+    pattern = jira_issue_browse_url_regex("MY_PROJ.X-7")
+    assert re.fullmatch(pattern, f"{SITE}/browse/MY_PROJ.X-7")
+    assert not re.fullmatch(pattern, f"{SITE}/browse/MY_PROJzX-7")
+
+
+def _neo4j_with_rows(rows: list[dict[str, Any]]) -> Neo4jProvider:
+    provider = Neo4jProvider(logger=MagicMock(), config_service=MagicMock())
+
+    async def execute_query(query: str, parameters: dict[str, Any], txn_id: str | None = None) -> list[dict]:
+        pattern = parameters.get("browse_pattern_regex", "")
+        return [{"record": row} for row in rows if re.fullmatch(pattern, row["webUrl"])][:1]
+
+    provider.client = MagicMock()
+    provider.client.execute_query = AsyncMock(side_effect=execute_query)
+    provider._neo4j_to_arango_node = MagicMock(side_effect=lambda node, _collection: node)  # type: ignore[method-assign]
+    return provider
+
+
+def _arango_with_rows(rows: list[dict[str, Any]]) -> ArangoHTTPProvider:
+    provider = ArangoHTTPProvider(MagicMock(), AsyncMock())
+
+    async def execute_aql(query: str, bind_vars: dict[str, Any], txn_id: str | None = None) -> list[dict]:
+        assert "REGEX_TEST(record.webUrl, @browse_pattern_regex)" in query
+        pattern = bind_vars["browse_pattern_regex"]
+        return [{"record": row, "ticket": None} for row in rows if re.search(pattern, row["webUrl"])][:1]
+
+    provider.http_client = MagicMock()
+    provider.http_client.execute_aql = AsyncMock(side_effect=execute_aql)
+    provider._create_typed_record_from_arango = MagicMock(side_effect=lambda record, _ticket: record)  # type: ignore[method-assign]
+    return provider
+
+
+@pytest.fixture
+def record_passthrough() -> Iterator[None]:
+    with patch(
+        "app.services.graph_db.neo4j.neo4j_provider.Record.from_arango_base_record",
+        side_effect=lambda data: data,
+    ):
+        yield
+
+
+@pytest.mark.usefixtures("record_passthrough")
+class TestNeo4jIssueKeyLookup:
+    async def test_eng_1_skips_eng_12_listed_first(self) -> None:
+        provider = _neo4j_with_rows([ENG_12, ENG_123, ENG_1])
+        assert await provider.get_record_by_issue_key("conn-1", "ENG-1") == ENG_1
+
+    async def test_eng_1_absent_returns_none_not_eng_12(self) -> None:
+        provider = _neo4j_with_rows([ENG_12, ENG_123])
+        assert await provider.get_record_by_issue_key("conn-1", "ENG-1") is None
+        provider.logger.error.assert_not_called()
+
+
+class TestArangoIssueKeyLookup:
+    async def test_eng_1_skips_eng_12_listed_first(self) -> None:
+        provider = _arango_with_rows([ENG_12, ENG_123, ENG_1])
+        assert await provider.get_record_by_issue_key("conn-1", "ENG-1") == ENG_1
+
+    async def test_eng_1_absent_returns_none_not_eng_12(self) -> None:
+        provider = _arango_with_rows([ENG_12, ENG_123])
+        assert await provider.get_record_by_issue_key("conn-1", "ENG-1") is None
+        provider
```

---

### Incident Patch 12: `55276c9e` (2026-10-05)
**Commit Message**: fix(agents): keep tables in the trash out of the full-record tool's foreign-key lists

Opening a database table with fetch_full_record also lists the tables it is
linked to by a foreign key: their record ids, table names and columns. The
trash keeps a dropped table's node and edges until the purge, so the edge
reads still returned it and its name and columns reached the agent. Its
content stayed gated by the live-only access check.

The tool now keeps only neighbours that one batched
get_records_by_record_ids(LIVE) call returns for the org, as chat's
foreign-key enrichment already does, sharing its helper (now public as
live_record_ids). A failed lookup or a missing org lists none.

The unit tests fake the graph the way both providers answer (dict
neighbours, trashed ones included, filtered only by the record read), and a
real-graph test on Neo4j and ArangoDB seeds four Postgres tables through
the sync path and drops two.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/utils/chat_helpers.py` (modified, +6/-6)
```diff
@@ -1861,17 +1861,17 @@ def build_record_relations_info(record: dict[str, Any]) -> str:
 
 # FK table enrichment (runs before doc_index in chatbot; extends virtual_record_id_to_result)
 
-async def _live_record_ids(
-    graph_provider: IGraphDBProvider, record_ids: Iterable[str], org_id: str
+async def live_record_ids(
+    graph_provider: IGraphDBProvider, record_ids: Iterable[str | None], org_id: str | None
 ) -> set[str]:
     """The ids among ``record_ids`` that are live records of ``org_id``.
 
     The FK edge reads return tables in the trash too, so without this a dropped
     table's DDL and rows reach the answer through a table that references it.
-    A failed lookup counts as nothing live.
+    A failed lookup, or no org to scope it to, counts as nothing live.
     """
     ids = list(dict.fromkeys(rid for rid in record_ids if rid))
-    if not ids:
+    if not ids or not org_id:
         return set()
     try:
         docs = await graph_provider.get_records_by_record_ids(
@@ -1977,13 +1977,13 @@ async def enrich_virtual_record_id_to_result_with_fk_children(
         }
 
     checked_ids = set(related_record_ids)
-    live_ids = await _live_record_ids(graph_provider, checked_ids, org_id)
+    live_ids = await live_record_ids(graph_provider, checked_ids, org_id)
     related_record_ids &= live_ids
 
     async def live_relations_only(relations: list[dict[str, Any]]) -> list[dict[str, Any]]:
         unchecked = {rel.get("record_id") for rel in relations if rel.get("record_id")} - checked_ids
         if unchecked:
-            live_ids.update(await _live_record_ids(graph_provider, unchecked, org_id))
+            live_ids.update(await live_record_ids(graph_provider, unchecked, org_id))
             checked_ids.update(unchecked)
         return [rel for rel in relations if rel.get("record_id") in live_ids]
 
```

**File**: `backend/python/app/utils/fetch_full_record.py` (modified, +34/-35)
```diff
@@ -15,7 +15,12 @@
 from app.models.entities import RecordType, TicketRecord
 from app.modules.transformers.blob_storage import BlobStorage
 from app.services.graph_db.interface.graph_db_provider import IGraphDBProvider
-from app.utils.chat_helpers import collection_map, create_record_instance_from_dict, get_record
+from app.utils.chat_helpers import (
+    collection_map,
+    create_record_instance_from_dict,
+    get_record,
+    live_record_ids,
+)
 from app.utils.logger import create_logger
 
 logger = create_logger(__name__)
@@ -88,63 +93,57 @@ async def _apply_live_ticket_context_metadata(
 async def _enrich_sql_table_with_fk_relations(
     record: dict[str, Any],
     graph_provider: IGraphDBProvider,
+    org_id: str | None,
 ) -> dict[str, Any]:
-    """
-    Enrich a SQL_TABLE record with FK parent and child record IDs.
-    Args:
-        record: The SQL_TABLE record to enrich
-        graph_provider: Service to query FK relations from GraphDB
-    Returns:
-        The record with fk_parent_record_ids and fk_child_record_ids added
+    """Add the tables a SQL_TABLE record is linked to by a foreign key.
+
+    Returns a copy of ``record`` with ``fk_parent_record_ids`` and
+    ``fk_child_record_ids``: one dict per live related table, with its record
+    id, table name and columns.
     """
     from app.config.constants.arangodb import RecordRelations
-    
+
     record_id = record.get("id") or record.get("record_id")
     if not record_id:
         logger.debug("FK enrichment skipped: no record_id found in record")
         return record
-    
+
     record_name = record.get("record_name") or record.get("recordName") or ""
-    fk_child_ids = []
-    fk_parent_ids = []
-    
+    fk_child_ids: list[dict[str, Any]] = []
+    fk_parent_ids: list[dict[str, Any]] = []
+
     try:
-        # Get child records (tables that reference this table via FK)
-        fk_child_ids = await graph_provider.get_child_record_ids_by_relation_type(
+        fk_child_ids = list(await graph_provider.get_child_record_ids_by_relation_type(
             record_id, RecordRelations.FOREIGN_KEY.value
-        )
-        fk_child_ids = fk_child_ids if isinstance(fk_child_ids, list) else list(fk_child_ids)
-        logger.debug(
-            "FK enrichment for %s (id=%s): found %d child tables: %s",
-            record_name, record_id, len(fk_child_ids), fk_child_ids
-        )
+        ))
     except Exception as e:
         logger.warning("Could not fetch child record IDs for %s: %s", record_id, str(e))
-    
+
     try:
-        # Get parent records (tables this table references via FK)
-        fk_parent_ids = await graph_provider.get_parent_record_ids_by_relation_type(
+        fk_parent_ids = list(await graph_provider.get_parent_record_ids_by_relation_type(
             record_id, RecordRelations.FOREIGN_KEY.value
-        )
-        fk_parent_ids = fk_parent_ids if isinstance(fk_parent_ids, list) else list(fk_parent_ids)
-        logger.debug(
-            "FK enrichment for %s (id=%s): found %d parent tables: %s",
-            record_name, record_id, len(fk_parent_ids), fk_parent_ids
-        )
+        ))
     except Exception as e:
         logger.warning("Could not fetch parent record IDs for %s: %s", record_id, str(e))
-    
-    # Add FK relations to the record (non-destructive - creates a copy)
+
+    # The trash keeps a dropped table's node and FK edges until the purge, so
+    # the edge reads still return it; its name and columns must not reach the agent.
+    live = await live_record_ids(
+        graph_provider, (rel.get("record_id") for rel in (*fk_child_ids, *fk_parent_ids)), org_id
+    )
+    fk_child_ids = [rel for rel in fk_child_ids if rel.get("record_id") in live]
+    fk_parent_ids = [rel for rel in fk_parent_ids if rel.get("record_id") in live]
+
     enriched_record = dict(record)
     enriched_record["fk_parent_record_ids"] = fk_parent_ids
     enriched_record["fk_child_record_ids"] = fk_child_ids
-    
+
     if fk_parent_ids or fk_child_ids:
         logger.info(
             "FK enrichment: enriched SQL_TABLE %s with %d parent and %d child FK relations",
             record_name or record_id, len(fk_parent_ids), len(fk_child_ids)
         )
-    
+
     return enriched_record
 
 
@@ -322,7 +321,7 @@ async def _enrich(self, record: dict[str, Any]) -> dict[str, Any]:
         )
         record_type = record.get("record_type") or record.get("recordType")
         if record_type == "SQL_TABLE" and self._graph_provider:
-            return await _enrich_sql_table_with_fk_relations(record, self._graph_provider)
+            return await _enrich_sql_table_with_fk_relations(record, self._graph_provider, self._org_id)
         return record
 
 
```

**File**: `backend/python/tests/integration/test_soft_delete_fetch_full_record_fk_e2e.py` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+"""The agent's full-record tool lists only live foreign-key neighbours: real Neo4j and ArangoDB.
+
+Opening a database table with ``fetch_full_record`` also lists the tables it
+is linked to by a foreign key, with their record ids, table names and columns,
+so the agent can open them next. The trash keeps a dropped table's node and
+its foreign-key edges until the purge, so the tool has to check that each
+neighbour is live before naming it.
+
+The four tables of tests/integration/test_soft_delete_chat_fk_e2e.py are
+written by the production sync path (``on_new_records``) and a dropped one is
+trashed by the connector's own delete (``on_record_deleted``) with
+``ENABLE_SOFT_DELETE`` on:
+
+- orders references customers and products; products references suppliers.
+- While all four are live, orders lists customers and products as parents,
+  and products lists suppliers as a parent and orders as a child.
+- Once customers and suppliers are dropped, orders lists products only and
+  products lists no parent, and neither dropped table is named anywhere in
+  the tool's answer.
+
+Needs Docker services. A backend whose env var is set but cannot be reached
+fails, naming it; one that is not configured skips:
+
+  docker compose -f deployment/docker-compose/docker-compose.integration.graph-db.yml \
+    up -d --wait neo4j-graph-it arango-graph-it
+  cd backend/python && pytest tests/integration/test_soft_delete_fetch_full_record_fk_e2e.py -m integration
+
+Environment: NEO4J_IT_URI, NEO4J_IT_PASSWORD, ARANGO_IT_URL, ARANGO_IT_PASSWORD.
+"""
+from __future__ import annotations
+
+from typing import Any
+
+import pytest
+
+from app.config.constants.arangodb import RecordRelations
+from app.utils.fetch_full_record import create_fetch_full_record_tool
+from tests.integration import test_soft_delete_chat_fk_e2e as chat_fk
+
+pytestmark = [pytest.mark.integration, pytest.mark.timeout(300)]
+
+# The same four seeded tables, on both backends.
+world = chat_fk.world
+
+_World = chat_fk._World
+
+
+async def _open(w: _World, *names: str) -> dict[str, dict[str, Any]]:
+    """What the agent gets back from fetch_full_record for these tables, by name."""
+    retrieved = {
+        w.vrid(name): {"id": w.ids[name], "record_type": "SQL_TABLE", "record_name": name}
+        for name in names
+    }
+    tool = create_fetch_full_record_tool(
+        retrieved, org_id=w.org_id, graph_provider=w.graph, user_id="agent-user",
+    )
+    answer = await tool.coroutine(record_ids=[w.ids[name] for name in names])
+    assert answer["ok"] is True, answer
+    return {w.name_of(record["id"]): record for record in answer["records"]}
+
+
+def _named(w: _World, relations: list[dict[str, Any]]) -> set[str]:
+    return {w.name_of(r["record_id"]) for r in relations}
+
+
+async def test_the_full_record_tool_lists_live_neighbours(world: _World) -> None:
+    opened = await _open(world, "orders", "products")
+
+    assert _named(world, opened["orders"]["fk_parent_record_ids"]) == {"customers", "products"}
+    assert _named(world, opened["orders"]["fk_child_record_ids"]) == set()
+    assert _named(world, opened["products"]["fk_parent_record_ids"]) == {"suppliers"}
+    assert _named(world, opened["products"]["fk_child_record_ids"]) == {"orders"}
+    customers = next(
+        r for r in opened["orders"]["fk_parent_record_ids"] if r["record_id"] == world.ids["customers"]
+    )
+    assert customers["parentTable"] == "public.customers"
+    assert customers["sourceColumn"] == "customers_id"
+
+
+async def test_the_full_record_tool_leaves_out_neighbours_in_the_trash(world: _World) -> None:
+    for dropped in ("customers", "suppliers"):
+        await world.processor.on_record_deleted(world.ids[dropped])
+        stored = await world.graph.get_document(world.ids[dropped], chat_fk.RECORDS)
+        assert stored is not None and stored.get("isDeleted") is True, f"{dropped} is in the trash"
+    edges = await world.graph.get_parent_record_ids_by_relation_type(
+        world.ids["orders"], RecordRelations.FOREIGN_KEY.value
+    )
+    assert world.ids["customers"] in {e["record_id"] for e in edges}, "the trash keeps the foreign key"
+
+    opened = await _open(world, "orders", "products")
+
+    assert _named(world, opened["orders"]["fk_parent_record_ids"]) == {"products"}
+    assert _named(world, opened["products"]["fk_parent_record_ids"]) == set()
+    assert _named(world, opened["products"]["fk_child_record_ids"]) == {"orders"}
+    everything_said = repr(opened)
+    for dropped in ("customers", "suppliers"):
+        assert world.ids[dropped] not in everything_said
+        assert f"public.{dropped}" not in everything_said
+        assert f"{dropped}_id" not in everything_said
```

**File**: `backend/python/tests/unit/utils/test_fetch_full_record.py` (modified, +209/-104)
```diff
@@ -6,6 +6,10 @@
 from pydantic import ValidationError
 
 from app.models.entities import TicketRecord
+from app.services.graph_db.common.record_visibility import (
+    RecordVisibility,
+    matches_visibility,
+)
 
 
 class TestFetchFullRecordArgs:
@@ -42,35 +46,171 @@ def test_empty_record_ids(self):
 # ===========================================================================
 
 
+class _FkGraph:
+    """Foreign keys and record documents, answered the way both graph providers answer.
+
+    The edge reads return every neighbour as a dict, trashed or not: the trash
+    keeps a dropped table's node and edges until the purge. The batched record
+    read filters by org and visibility, as its query does.
+    """
+
+    def __init__(self, org_id: str = "org-1") -> None:
+        self.org_id = org_id
+        self.records: dict[str, dict] = {}
+        self.fks: list[tuple[str, str]] = []
+        self.lookups: list[tuple[list[str], str, RecordVisibility]] = []
+        self.config_service = MagicMock()
+
+    def table(self, record_id: str, *, trashed: bool = False, org_id: str | None = None) -> None:
+        doc = {"_key": record_id, "id": record_id, "orgId": org_id or self.org_id, "recordName": record_id}
+        if trashed:
+            doc["isDeleted"] = True
+        self.records[record_id] = doc
+
+    def fk(self, child: str, parent: str) -> None:
+        self.fks.append((child, parent))
+
+    async def get_child_record_ids_by_relation_type(
+        self, record_id: str, relation_type: str, transaction: str | None = None
+    ) -> list[dict]:
+        assert relation_type == "FOREIGN_KEY"
+        return [
+            {"record_id": c, "childTable": f"public.{c}", "sourceColumn": f"{p}_id", "targetColumn": "id"}
+            for c, p in self.fks if p == record_id
+        ]
+
+    async def get_parent_record_ids_by_relation_type(
+        self, record_id: str, relation_type: str, transaction: str | None = None
+    ) -> list[dict]:
+        assert relation_type == "FOREIGN_KEY"
+        return [
+            {"record_id": p, "parentTable": f"public.{p}", "sourceColumn": f"{p}_id", "targetColumn": "id"}
+            for c, p in self.fks if c == record_id
+        ]
+
+    async def get_records_by_record_ids(
+        self, record_ids: list[str], org_id: str, visibility: RecordVisibility = RecordVisibility.LIVE
+    ) -> list[dict]:
+        self.lookups.append((list(record_ids), org_id, visibility))
+        return [
+            dict(doc) for rid in record_ids
+            if (doc := self.records.get(rid)) and doc["orgId"] == org_id and matches_visibility(doc, visibility)
+        ]
+
+
+def _shop(*, trashed: tuple[str, ...] = ()) -> _FkGraph:
+    """orders -> customers, orders -> products, products -> suppliers, reviews -> orders."""
+    graph = _FkGraph()
+    for name in ("orders", "customers", "products", "suppliers", "reviews"):
+        graph.table(name, trashed=name in trashed)
+    graph.fk("orders", "customers")
+    graph.fk("orders", "products")
+    graph.fk("products", "suppliers")
+    graph.fk("reviews", "orders")
+    return graph
+
+
+def _ids(relations: list[dict]) -> set[str]:
+    return {rel["record_id"] for rel in relations}
+
+
 class TestEnrichSqlTableWithFkRelations:
     @pytest.mark.asyncio
-    async def test_enriches_with_fk_ids(self):
+    async def test_enriches_with_fk_relations(self) -> None:
         from app.utils.fetch_full_record import _enrich_sql_table_with_fk_relations
 
-        record = {"id": "rec-1", "record_name": "users"}
-        graph_provider = AsyncMock()
-        graph_provider.get_child_record_ids_by_relation_type = AsyncMock(return_value=["child-1", "child-2"])
-        graph_provider.get_parent_record_ids_by_relation_type = AsyncMock(return_value=["parent-1"])
+        graph = _shop()
+        result = await _enrich_sql_table_with_fk_relations(
+            {"id": "orders", "record_name": "orders"}, graph, "org-1"
+        )
+
+        assert _ids(result["fk_parent_record_ids"]) == {"customers", "products"}
+        assert _ids(result["fk_child_record_ids"]) == {"reviews"}
+        parent = next(r for r in result["fk_parent_record_ids"] if r["record_id"] == "customers")
+        assert parent == {
+            "record_id": "customers", "parentTable": "public.customers",
+            "sourceColumn": "customers_id", "targetColumn": "id",
+        }
 
-        with patch("app.config.constants.arangodb.RecordRelations") as mock_rr:
-            mock_rr.FOREIGN_KEY.value = "FOREIGN_KEY"
-            result = await _enrich_sql_table_with_fk_relations(record, graph_provider)
+    @pytest.mark.asyncio
+    async def test_leaves_out_tables_in_the_trash(self) -> None:
+        """The edges outlive the drop; the trashed table's name and columns must not reach the agent."""
+        from app.utils.fetch_full_record import _enrich_sql_table_with_fk_relations
 
-        assert result["fk_child_record_ids"] == ["child-1", "child-2"]
-        assert res
```

---

### Incident Patch 13: `f2afb393` (2026-10-05)
**Commit Message**: fix(salesforce): send the Login URL refusal as its fixed message, not str(e) (#3906)

#3848 answered a refused Salesforce Login URL with detail=str(e), which
the raw-exception guard test flags on main. The validator only ever
raises SALESFORCE_LOGIN_URL_ERROR, so sending that constant changes
nothing for users and keeps exception text out of API errors.

Co-authored-by: Shekhar Kadyan <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/connectors/api/router.py` (modified, +2/-4)
```diff
@@ -151,6 +151,7 @@
 from app.utils.jwt import generate_jwt
 from app.utils.logger import create_logger
 from app.utils.oauth_config import (
+    SALESFORCE_LOGIN_URL_ERROR,
     check_salesforce_login_url_setting,
     extract_oauth_error_message,
     get_oauth_config,
@@ -3920,10 +3921,7 @@ def _check_salesforce_login_url(connector_type: str, settings: dict[str, Any] |
     try:
         check_salesforce_login_url_setting(connector_type, settings)
     except ValueError as e:
-        raise HTTPException(
-            status_code=HttpStatusCode.BAD_REQUEST.value,
-            detail=str(e),  # user-written message
-        ) from e
+        raise HTTPException(status_code=HttpStatusCode.BAD_REQUEST.value, detail=SALESFORCE_LOGIN_URL_ERROR) from e
 
 
 async def _link_to_shared_oauth_app(
```

---

### Incident Patch 14: `c598a490` (2026-10-05)
**Commit Message**: fix(google-toolsets): drop gmail.send from Calendar, add meetings.space.readonly to Meet

The Calendar toolset sends invites through Calendar's own sendUpdates and never
calls Gmail, so its consent screen and token refresh no longer ask for
gmail.send. The Meet toolset's conference-record tools need
meetings.space.readonly to read meetings this app did not create; Meet is not
offered today because its module does not import, so this only takes effect
once it is turned back on.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/connectors/sources/google/common/scopes.py` (modified, +3/-1)
```diff
@@ -156,15 +156,17 @@
         "https://www.googleapis.com/auth/drive.file",
         "https://www.googleapis.com/auth/drive.metadata.readonly",
     ],
+    # Invites go out through Calendar's own sendUpdates, so no Gmail scope is needed.
     "calendar": [
         "https://www.googleapis.com/auth/calendar",
         "https://www.googleapis.com/auth/calendar.events",
-        "https://www.googleapis.com/auth/gmail.send",
     ],
     "meet": [
         "https://www.googleapis.com/auth/calendar",
         "https://www.googleapis.com/auth/calendar.events",
         "https://www.googleapis.com/auth/meetings.space.created",
+        # meetings.space.created only covers meetings this app created; the conference-record tools read any.
+        "https://www.googleapis.com/auth/meetings.space.readonly",
     ],
 }
 
```

**File**: `backend/python/tests/unit/sources/client/test_google_client.py` (modified, +45/-2)
```diff
@@ -986,6 +986,7 @@ def _consent_scopes(module_path: str, class_name: str) -> list[str]:
                     "https://www.googleapis.com/auth/calendar",
                     "https://www.googleapis.com/auth/calendar.events",
                     "https://www.googleapis.com/auth/meetings.space.created",
+                    "https://www.googleapis.com/auth/meetings.space.readonly",
                 ],
             ),
         ],
@@ -1007,6 +1008,19 @@ async def test_refresh_asks_for_exactly_what_the_user_consented_to(
         consented = (
             self._consent_scopes(*consent_screen) if isinstance(consent_screen, tuple) else consent_screen
         )
+        refresh_scopes = await self._refresh_scopes(
+            service_name, version, mock_credentials_cls, logger, mock_config_service
+        )
+        assert sorted(refresh_scopes) == sorted(consented)
+
+    @staticmethod
+    async def _refresh_scopes(
+        service_name: str,
+        version: str,
+        mock_credentials_cls: MagicMock,
+        logger: logging.Logger,
+        mock_config_service: AsyncMock,
+    ) -> list[str]:
         # Importing the real routes module alone trips a circular import.
         toolsets_routes = MagicMock()
         toolsets_routes.get_oauth_credentials_for_toolset = AsyncMock(
@@ -1024,9 +1038,38 @@ async def test_refresh_asks_for_exactly_what_the_user_consented_to(
                 config_service=mock_config_service,
                 version=version,
             )
+        return mock_credentials_cls.call_args.kwargs["scopes"]
 
-        refresh_scopes = mock_credentials_cls.call_args.kwargs["scopes"]
-        assert sorted(refresh_scopes) == sorted(consented)
+    @pytest.mark.asyncio
+    @patch("app.sources.client.google.google.build")
+    @patch("app.sources.client.google.google.Credentials")
+    async def test_calendar_neither_asks_for_nor_refreshes_with_gmail_send(
+        self, mock_credentials_cls, mock_build, logger, mock_config_service
+    ) -> None:
+        # Invites go out through Calendar's sendUpdates; nothing in the toolset sends mail.
+        gmail_send = "https://www.googleapis.com/auth/gmail.send"
+        consented = self._consent_scopes("app.agents.actions.google.calendar.calendar", "GoogleCalendar")
+        refresh_scopes = await self._refresh_scopes(
+            "calendar", "v3", mock_credentials_cls, logger, mock_config_service
+        )
+        assert gmail_send not in consented
+        assert gmail_send not in refresh_scopes
+
+    @pytest.mark.asyncio
+    @patch("app.sources.client.google.google.build")
+    @patch("app.sources.client.google.google.Credentials")
+    async def test_meet_asks_for_and_refreshes_with_the_conference_record_scope(
+        self, mock_credentials_cls, mock_build, logger, mock_config_service
+    ) -> None:
+        from app.connectors.sources.google.common.scopes import GOOGLE_TOOLSET_SCOPES
+
+        readonly = "https://www.googleapis.com/auth/meetings.space.readonly"
+        refresh_scopes = await self._refresh_scopes(
+            "meet", "v2", mock_credentials_cls, logger, mock_config_service
+        )
+        # The Meet toolset's consent screen is built from this list (meet.py), but the module does not import today.
+        assert readonly in GOOGLE_TOOLSET_SCOPES["meet"]
+        assert readonly in refresh_scopes
 
 
 class TestBuildFromToolsetEdgeCases:
```

---

### Incident Patch 15: `9a2d9381` (2026-10-05)
**Commit Message**: fix(oauth): retry the connector OAuth repair when a type's apps cannot be read

get_config answers its default on a failed read unless raise_on_error is set,
so a store blip read as "no apps" and the repair saved its completion flag.
Ask it to raise, and count a saved value that is not a list as a failure, so
the flag stays unset and the next start retries.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/python/app/migrations/connector_oauth_toolset_fields_migration.py` (modified, +7/-2)
```diff
@@ -123,9 +123,14 @@ async def _repair_type(self, connector_type: str) -> tuple[int, int]:
             return 0, 1
 
         path = ConfigPaths.OAUTH_CONFIG.format(connector_type=connector_type.lower().replace(" ", ""))
-        apps = await self.config_service.get_config(path, default=[], use_cache=False)
+        # Without raise_on_error a failed read answers the default, and an empty list would mark this done.
+        apps = await self.config_service.get_config(path, default=[], use_cache=False, raise_on_error=True)
         if not isinstance(apps, list):
-            return 0, 0
+            self.logger.error(
+                f"Connector OAuth app repair: the saved {connector_type} OAuth apps are not a list; "
+                "they will be checked again on the next start."
+            )
+            return 0, 1
 
         repaired_ids: list[str] = []
         failed = 0
```

**File**: `backend/python/tests/unit/migrations/test_connector_oauth_toolset_fields_repair.py` (modified, +21/-2)
```diff
@@ -30,9 +30,19 @@ def __init__(self, store: dict, *, failing_reads: frozenset[str] = frozenset())
         self.failing_reads = failing_reads
         self.writes: list[str] = []
 
-    async def get_config(self, path: str, default: list | dict | None = None, use_cache: bool = True) -> list | dict | None:
+    async def get_config(
+        self,
+        path: str,
+        default: list | dict | None = None,
+        use_cache: bool = True,
+        *,
+        raise_on_error: bool = False,
+    ) -> list | dict | None:
+        # Like ConfigurationService: a failed read answers the default unless asked to raise.
         if path in self.failing_reads:
-            raise ConnectionError(f"store did not answer for {path}")
+            if raise_on_error:
+                raise ConnectionError(f"store did not answer for {path}")
+            return default
         return copy.deepcopy(self.store.get(path, default))
 
     async def set_config(self, path: str, value: list | dict) -> bool:
@@ -189,3 +199,12 @@ async def test_a_type_the_store_cannot_read_does_not_stop_the_others_and_is_retr
         assert retried["apps_repaired"] == 1
         assert config_service.store[SALESFORCE_PATH][0]["redirectUri"] == f"{BASE_URL}/connectors/oauth/callback/Salesforce"
         assert config_service.store[MIGRATION_FLAG_KEY]["done"] is True
+
+    async def test_a_saved_value_that_is_not_a_list_is_retried(self) -> None:
+        config_service = _MemoryConfigService({SALESFORCE_PATH: {"unexpected": "shape"}, SLACK_PATH: [_broken_slack_app()]})
+
+        result = await _repair(config_service)
+
+        assert result["success"] is False
+        assert config_service.store[SLACK_PATH][0]["redirectUri"] == f"{BASE_URL}/connectors/oauth/callback/Slack"
+        assert MIGRATION_FLAG_KEY not in config_service.store
```

#### Recent Merged Pull Requests:
- **PR #3930** (2026-10-06): test(scenario-matrix): drop the filter-change xfail where the connector removes the item (@shekharkadyan)
- **PR #3929** (2026-10-06): fix(demo-harness): read "platform-fee" as "platform fee" in mention and leak checks (@shekharkadyan)
- **PR #3928** (2026-10-06): test(resilience): expect the embedding-model refusal the gateway sends (@shekharkadyan)
- **PR #3927** (2026-10-06): test(cleanup, resilience): count records points where the entity index writes on its own (@shekharkadyan)
- **PR #3926** (2026-10-06): fix(arango): fail a record delete whose REMOVE is refused, so it rolls back and retries (@shekharkadyan)
- **PR #3925** (2026-10-06): fix(neo4j): find a team's knowledge base when the list is searched by name (@shekharkadyan)
- **PR #3924** (2026-10-06): fix(neo4j): make the multi-step sync writes single statements, so a failure leaves nothing behind (@shekharkadyan)
- **PR #3923** (2026-10-06): fix(connectors): mask stored secrets in connector config responses (@shekharkadyan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
