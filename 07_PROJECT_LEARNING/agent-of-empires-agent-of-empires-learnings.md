# Forensic Learning Record (Deep Inspection): agent-of-empires/agent-of-empires

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:11:21.534Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3319 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `acp-worker/aoe-agent/src/index.ts`
```
#!/usr/bin/env node
/**
 * aoe-agent: ACP server wrapping Vercel AI SDK 7.
 *
 * One Node process per structured-view session. Accepts ACP requests from aoe
 * (the Rust ACP client) on stdin/stdout, drives a Vercel AI SDK loop
 * against the user's chosen provider, and streams structured events
 * back as ACP `session/update` notifications.
 *
 * Tools are stubs that delegate back to aoe via ACP `fs/*` and
 * `terminal/*` requests. aoe owns the disk; aoe-agent only orchestrates
 * the model.
 *
 * Lifecycle: stdin closes -> exit 0. SIGTERM -> graceful shutdown.
 */

import * as acp from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";
import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { appendTurn, createTranscript, loadTranscript } from "./transcript.ts";
import { classifyKind } from "./toolKind.ts";

const DEFAULT_MODEL = "claude-opus-4-7";

interface SessionState {
  pendingPrompt: AbortController | null;
  modelId: string;
  /** Conversation history accumulated across turns within this session. */
  messages: ModelMessage[];
}

// ponytail: one Node process serves exactly one ACP connection, so a
// module-level session map is equivalent to the old per-connection instance
// state; no need to thread state through the connect handler.
const sessions = new Map<string, SessionState>();

async function handlePrompt(
  params: acp.PromptRequest,
  client: acp.AgentContext,
): Promise<acp.PromptResponse> {
  const session = sessions.get(params.sessionId);
  if (!session) {
    throw new Error(`Session ${params.sessionId} not found`);
  }

  session.pendingPrompt?.abort();
  session.pendingPrompt = new AbortController();
  const abortSignal = session.pendingPrompt.signal;

  const userText = params.prompt
    .filter((c): c is acp.TextContent & { type: "text" } => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  session.messages.push({ role: "user", content: userText });

  const tools = buildTools(params.sessionId, client);

  try {
    const model = pickModel(session.modelId);
    const result = streamText({
      model,
      messages: session.messages,
      tools,
      // Allow up to ~16 tool-call rounds in a single user turn so the
      // agent can compose multiple Read/Write/Bash steps before
      // returning to the user.
      stopWhen: stepCountIs(16),
      abortSignal,
    });

    const update = (update: Record<string, unknown>) =>
      client.notify("session/update", { sessionId: params.sessionId, update });

    let assistantBuffer = "";
    for await (const part of result.fullStream) {
      if (abortSignal.aborted) break;
      switch (part.type) {
        case "text-delta": {
          const delta =
            (part as { text?: string }).text ??
            (part as { textDelta?: string }).textDelta ??
            "";
          if (!delta) break;
          assistantBuffer += delta;
          await update({
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: delta },
          });
          break;
        }
        case "tool-call": {
          const name = part.toolName;
          await update({
            sessionUpdate: "tool_call",
            toolCallId: part.toolCallId,
            title: name,
            kind: classifyKind(name),
            status: "pending",
            rawInput: part.input as Record<string, unknown>,
          });
          break;
        }
        case "tool-result":
        case "tool-error": {
          const failed = part.type === "tool-error";
          await update({
            sessionUpdate: "tool_call_update",
            toolCallId: part.toolCallId,
            status: failed ? "failed" : "completed",
            rawOutput: failed
              ? { error: String(part.error) }
              : serialiseToolOutput(part.output),
          });
          break;
        }
        case "error": {
          const err = (part as { error: unknown }).error;
          throw err instanceof Error ? err : new Error(String(err));
        }
        default:
          break;
      }
    }

    // Anthropic rejects an assistant message with empty content, so skip
    // persisting blank turns (tool-only rounds and cancellations both leave
    // the buffer empty) to keep the next prompt's history valid.
    if (assistantBuffer) {
      session.messages.push({ role: "assistant", content: assistantBuffer });
    }

    if (abortSignal.aborted) {
      return { stopReason: "cancelled" };
    }

    // Persist only completed text exchanges, so the on-disk transcript stays
    // strictly alternating and never carries a dangling user turn across a
    // restart. Cancelled/errored and tool-only turns are skipped. Non-fatal:
    // a failed write must not fail the turn.
    const artifactDir = process.env.AOE_ARTIFACT_DIR;
    if (artifactDir && assistantBuffer) {
      try {
        await appendTurn(
          artifactDir,
          params.sessionId,
          userText,
          assistantBuffer,
        );
      } catch (err) {
        process.stderr.write(`[aoe-agent] transcript persist failed: ${err}\n`);
      }
    }

    session.pendingPrompt = null;
    return { stopReason: "end_turn" };
  } catch (err) {
    session.pendingPrompt = null;
    if (abortSignal.aborted) {
      return { stopReason: "cancelled" };
    }
    const message = err instanceof Error ? err.message : String(err);
    await client
      .notify("session/update", {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: `\n[aoe-agent error] ${message}\n` },
        },
      })
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Tool palette: Read, Write, Bash. Each tool's execute() body issues
 * an ACP request back to aoe and returns the result. The model never
 * sees the file system or shell directly.
 */
function buildTools(sessionId: string, client: acp.AgentContext) {
  return {
    Read: tool({
      description: "Read a text file from the session's working directory.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path to the file to read."),
      }),
      execute: async ({ path }) => {
        const result = await client.request("fs/read_text_file", {
          sessionId,
          path,
        });
        return { content: result.content };
      },
    }),
    Write: tool({
      description:
        "Write text contents to a file in the session's working directory.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path of the file to write."),
        content: z.string().describe("Full text content to write."),
      }),
      execute: async ({ path, content }) => {
        await client.request("fs/write_text_file", {
          sessionId,
          path,
          content,
        });
        return { ok: true };
      },
    }),
    Bash: tool({
      description:
        "Run a shell command and capture its output. Used for one-shot tasks; long-running processes are not supported.",
      inputSchema: z.object({
        command: z.string().describe("Shell command to run."),
        args: z
          .array(z.string())
          .optional()
          .describe("Arguments passed to the command."),
      }),
      execute: async ({ command, args }) => {
        const { terminalId } = await client.request("terminal/create", {
          sessionId,
          command,
          args: args ?? [],
        });
        try {
          const exit = await client.request("terminal/wait_for_exit", {
            sessionId,
            terminalId,
          });
          const out = await client.request("terminal/output", {
            sessionId,
            terminalId,
          });
          return {
            stdout: out.output,
            exitCode: exit.exitCode ?? null,
          };
        } finally {
          await client
            .request("terminal/release", { sessionId, terminalId })
            .catch(() => undefined);
        }
      },
    }),
  };
}

function serialiseToolOutput(output: unknown): Record<string, unknown> {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }
  return { value: output };
}

/**
 * Map an `AOE_AGENT_MODEL` id onto a provider by bare prefix or an explicit
 * `provider:` prefix. Anything else hits the Anthropic fallback, so
 * local-model ids are not a valid configuration until an openai-compatible
 * branch exists.
 */
function pickModel(modelId: string) {
  const providers = [
    { bare: "claude-", tag: "anthropic:", make: anthropic },
    { bare: "gpt-", tag: "openai:", make: openai },
    { bare: "gemini-", tag: "google:", make: google },
  ];
  for (const { bare, tag, make } of providers) {
    if (modelId.startsWith(tag)) return make(modelId.slice(tag.length));
    if (modelId.startsWith(bare)) return make(modelId);
  }
  return anthropic(modelId);
}

function startSession(sessionId: string, messages: ModelMessage[]): void {
  sessions.set(sessionId, {
    pendingPrompt: null,
    modelId: process.env.AOE_AGENT_MODEL ?? DEFAULT_MODEL,
    messages,
  });
}

function randomHexId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function main() {
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);

  acp
    .agent({ name: "aoe-agent" })
    .onRequest("initialize", ({ params }) => ({
      protocolVersion: params.protocolVersion ?? acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: Boolean(process.env.AOE_ARTIFACT_DIR),
        promptCapabil
```

### Core Architecture Module: `acp-worker/aoe-agent/src/toolKind.ts`
```
/**
 * Tool-name to ACP `ToolKind` mapping for the structured view's card
 * dispatch. Its own module so it is testable: `index.ts` calls `main()` at
 * module scope, so importing it from a test would connect to stdio.
 */

import type * as acp from "@agentclientprotocol/sdk";

// Matched case-insensitively, the way opencode's mapper normalises before
// its switch. The names below are how `buildTools` registers them, but a
// model picks the casing, and a mismatch here only costs a wrong card.
export function classifyKind(toolName: string): acp.ToolKind {
  switch (toolName.toLowerCase()) {
    case "read":
      return "read";
    case "write":
      return "edit";
    case "bash":
      return "execute";
    // `task` is not in `buildTools`, but models trained against harnesses
    // that do have a subagent tool call it anyway; two such calls landed in
    // the wild (#1904). The AI SDK answers each one with a NoSuchToolError,
    // so no subagent runs and the call always fails. `think` matches what
    // claude-agent-acp and opencode >=1.16.0 report for the same name; the
    // think card falls through to the error body on a failure, so the
    // NoSuchToolError text stays visible.
    case "task":
      return "think";
    default:
      return "other";
  }
}

```

### Core Architecture Module: `acp-worker/aoe-agent/src/transcript.ts`
```
/** Native-ID-scoped text history within the AoE instance artifact directory. */
import { constants } from "node:fs";
import { mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelMessage } from "ai";

function transcriptPath(dir: string, sessionId: string): string {
  if (!/^[a-f0-9]{32}$/.test(sessionId)) {
    throw new Error("Invalid aoe-agent session ID");
  }
  return join(dir, `aoe-agent-${sessionId}.jsonl`);
}

/** Publish even an empty conversation before acknowledging session/new. */
export async function createTranscript(
  dir: string,
  sessionId: string,
): Promise<void> {
  const path = transcriptPath(dir, sessionId);
  await mkdir(dir, { recursive: true });
  const file = await open(path, "wx", 0o600);
  try {
    await file.sync();
  } finally {
    await file.close();
  }
  const directory = await open(dir, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

interface TurnMessage {
  role: "user" | "assistant";
  content: string;
}

/** Append only to the conversation created for this native ID. */
export async function appendTurn(
  dir: string,
  sessionId: string,
  user: string,
  assistant: string,
): Promise<void> {
  const line =
    JSON.stringify({ role: "user", content: user } satisfies TurnMessage) +
    "\n" +
    JSON.stringify({
      role: "assistant",
      content: assistant,
    } satisfies TurnMessage) +
    "\n";
  const file = await open(
    transcriptPath(dir, sessionId),
    constants.O_WRONLY | constants.O_APPEND,
  );
  try {
    await file.writeFile(line);
  } finally {
    await file.close();
  }
}

/** Skip malformed records and a torn trailing user turn; missing IDs fail. */
export async function loadTranscript(
  dir: string,
  sessionId: string,
): Promise<ModelMessage[]> {
  const raw = await readFile(transcriptPath(dir, sessionId), "utf8");

  const messages: ModelMessage[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (isTurnMessage(parsed)) messages.push(parsed);
  }

  if (messages.length > 0 && messages[messages.length - 1].role === "user") {
    messages.pop();
  }
  return messages;
}

function isTurnMessage(value: unknown): value is TurnMessage {
  if (typeof value !== "object" || value === null) return false;
  const role = (value as { role?: unknown }).role;
  const content = (value as { content?: unknown }).content;
  return (
    (role === "user" || role === "assistant") && typeof content === "string"
  );
}

```

### Core Architecture Module: `src/acp/acp_client/connection/command_loop.rs`
```
//! The between-prompt command loop over an established session, including
//! the driven conversation reset.

use crate::acp::state::Event;
use agent_client_protocol::schema::v1::{
    CancelNotification, ContentBlock, McpServer, NewSessionRequest, NewSessionResponse,
    SessionConfigId, SessionConfigOption, SessionConfigValueId, SessionId,
    SetSessionConfigOptionRequest,
};
use agent_client_protocol::{Agent, ConnectionTo};
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};
use tracing::{debug, info, warn};

use super::notifications::{now_ms, Shared};
use crate::acp::acp_client::between_prompt::{
    between_prompt_stop_reason, BETWEEN_PROMPT_IDLE_CHECK_INTERVAL,
};
use crate::acp::acp_client::commands::ClientCmd;
use crate::acp::acp_client::config_options::{
    config_option_failure_event, config_options_event, dispatch_set_config_option,
    dispatch_set_mode, mode_config_id, model_option, modes_available_event,
    thought_level_config_id, ConfigOptionDispatchPurpose, SessionChannels,
};
use crate::acp::acp_client::control::DaemonControlClient;
use crate::acp::acp_client::delete::handle_delete_session_cmd;
use crate::acp::acp_client::errors::acp_internal_error;
use crate::acp::acp_client::lifecycle::LifecycleEnvelope;
use crate::acp::acp_client::reset::{
    await_reset_request, ResetRequestError, ResetSessionOutcome, SESSION_RESET_IN_TASK_TIMEOUT,
};
use crate::acp::acp_client::session_identity::ordered_session_request;

pub(super) struct Session {
    pub(super) connection: ConnectionTo<Agent>,
    pub(super) shared: Arc<Shared>,
    pub(super) control: Option<Arc<DaemonControlClient>>,
    /// Mirrors the ingress's committed identity, refreshed each iteration so
    /// a reset's swap cannot be missed.
    pub(super) acp_session_id: SessionId,
    /// The id came from storage rather than this agent, so a prompt
    /// rejection may mean the agent dropped it (#3560).
    pub(super) session_from_storage: bool,
    pub(super) channels: SessionChannels,
    pub(super) steering_capable: bool,
    pub(super) source_profile: Option<String>,
    pub(super) default_effort: Option<String>,
    pub(super) default_mode: Option<String>,
    pub(super) default_model: Option<String>,
    pub(super) agent_cwd: PathBuf,
    /// Capability-filtered servers, forwarded again by a driven reset.
    pub(super) mcp_servers: Vec<McpServer>,
    pub(super) cmd_rx: mpsc::Receiver<ClientCmd>,
    pub(super) lifecycle_rx: mpsc::Receiver<LifecycleEnvelope>,
    /// Steers the adapter handed back unconsumed, run as ordinary turns.
    /// Kept here rather than re-sent on the bounded channel this task drains.
    pub(super) pending_prompts: VecDeque<Vec<ContentBlock>>,
}

impl Session {
    pub(super) async fn send_cancel(&self) -> Result<(), agent_client_protocol::Error> {
        match self.control.as_ref() {
            Some(control) => {
                control.cancel().await;
                Ok(())
            }
            None => self
                .connection
                .send_notification(CancelNotification::new(self.acp_session_id.clone())),
        }
    }

    pub(super) fn dispatch_config_option(&mut self, config_id: String, value: String) {
        // A reset re-applies `default_model`, so it follows the live pick.
        if self
            .channels
            .model_option
            .as_ref()
            .is_some_and(|option| option.id == config_id)
        {
            self.default_model = Some(value.clone());
        }
        dispatch_set_config_option(
            &self.connection,
            &self.acp_session_id,
            config_id,
            value,
            ConfigOptionDispatchPurpose::Generic,
            self.shared.event_tx.clone(),
        );
    }

    pub(super) fn dispatch_mode(&self, mode_id: String, while_prompting: bool) {
        dispatch_set_mode(
            &self.connection,
            &self.acp_session_id,
            mode_id,
            &self.channels,
            self.shared.event_tx.clone(),
            while_prompting,
        );
    }

    pub(super) async fn run(mut self) -> Result<(), agent_client_protocol::Error> {
        // Only polled while parked between prompts, so the per-prompt
        // watchdog stays the sole idle authority during a turn and this emit
        // is serialized with every command.
        let mut idle_tick = tokio::time::interval(BETWEEN_PROMPT_IDLE_CHECK_INTERVAL);
        idle_tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            self.acp_session_id =
                self.shared.ingress.current().ok_or_else(|| {
                    acp_internal_error("native session is not established".into())
                })?;
            // Fallback prompts go first so later messages cannot overtake them.
            let cmd = match self.pending_prompts.pop_front() {
                Some(blocks) => Some(ClientCmd::Prompt(blocks)),
                None => tokio::select! {
                    cmd = self.cmd_rx.recv() => cmd,
                    _ = idle_tick.tick() => {
                        self.between_prompt_idle_tick().await;
                        continue;
                    }
                },
            };
            match cmd {
                Some(ClientCmd::Prompt(blocks)) => {
                    if self.run_prompt(blocks).await? {
                        break;
                    }
                }
                Some(ClientCmd::Cancel) => {
                    info!(target: "acp.protocol", "sending session/cancel (no prompt in flight)");
                    // Not `?`: a dead connection is when the UI most needs
                    // the synthetic Stopped below.
                    if let Err(e) = self.send_cancel().await {
                        warn!(
                            target: "acp.protocol",
                            error = %e,
                            "session/cancel (no prompt in flight) notification failed; still emitting Stopped"
                        );
                    }
                    // The UI thinks a turn is running but none is owned here;
                    // a spurious Stopped while idle is a reducer no-op (#2237).
                    self.stand_down_idle_completion();
                    self.shared
                        .emit(Event::Stopped {
                            reason: "cancelled".into(),
                        })
                        .await;
                }
                Some(ClientCmd::ForceStop) => {
                    // The supervisor publishes the terminal here (#1100).
                    info!(target: "acp.protocol", "force-stop requested with no prompt in flight; best-effort cancel only");
                    self.stand_down_idle_completion();
                    let _ = self.send_cancel().await;
                }
                Some(ClientCmd::SetMode(mode_id)) => self.dispatch_mode(mode_id, false),
                Some(ClientCmd::DeleteSession {
                    acp_session_id,
                    respond_to,
                }) => handle_delete_session_cmd(&self.connection, acp_session_id, respond_to),
                Some(ClientCmd::SetConfigOption { config_id, value }) => {
                    self.dispatch_config_option(config_id, value)
                }
                Some(ClientCmd::ResumeBackgroundTailing(launches)) => {
                    self.shared.resume_background_tailing(launches)
                }
                Some(ClientCmd::ResetSession {
                    text,
                    deadline,
                    respond_to,
                }) => self.reset_session(text, deadline, respond_to).await?,
                #[cfg(test)]
                Some(ClientCmd::FlushForTest(done)) => {
                    let _ = done.send(());
                }
                Some(ClientCmd::Shutdown) | None => {
                    info!(target: "acp.protocol", "shutdown received, exiting connection loop");
                    break;
                }
            }
        }
        Ok(())
    }

    /// This path owns the turn's terminal, so the other idle-completion
    /// paths must not add a duplicate (#2899).
    fn stand_down_idle_completion(&self) {
        self.shared.terminal_claim.claim();
        self.shared
            .adopted_turn_active
            .store(false, Ordering::Relaxed);
        self.shared.between_prompt.deactivate();
    }

    async fn between_prompt_idle_tick(&self) {
        let shared = &self.shared;
        let Some(cost_seen) = shared.between_prompt.take_idle_fire(now_ms()) else {
            return;
        };
        // An adopted turn races the detached resume-idle task for its
        // terminal; state is reset either way.
        let adopted = shared.adopted_turn_active.swap(false, Ordering::Relaxed);
        if adopted && !shared.terminal_claim.claim() {
            return;
        }
        let reason = between_prompt_stop_reason(adopted, cost_seen);
        info!(
            target: "acp.protocol",
            session = %shared.session_label,
            reason,
            "between-prompt idle watchdog: synthesizing Stopped for completed turn"
        );
        shared
            .emit(Event::Stopped {
                reason: reason.into(),
            })
            .await;
    }

    /// Open a fresh session on the live worker for a clear command whose
    /// adapter cannot hand back a durable post-reset id (#2979). The caller's
    /// deadline bounds every request, including queueing time.
    async fn reset_session(
        &mut self,
        text: String,
        deadline: tokio::time::Instant,
        respond_to: oneshot::Sender<ResetSessionOutcome>,
    ) -> Result<(), agent_client_protocol::Error> {
        let label = self.shared.session_label.clone();
        let ingress = self.shared.ingress.clone();
        // No identity transition while an age
```

### Core Architecture Module: `src/acp/acp_client/lifecycle.rs`
```
//! Classifies agent updates into the turn-level facts the watchdogs act on.

use crate::acp::agent_profiles;
use crate::acp::state::Event;
use agent_client_protocol::schema::v1::{
    ContentBlock, SessionUpdate, ToolCallContent, ToolCallStatus,
};
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};
use tokio::sync::mpsc;
use tracing::trace;

use super::raw_input::wakeup_event_from_raw;
use super::update_events::{is_compact_completion, is_compact_failure, is_compact_start};

#[derive(Debug, Clone)]
pub(crate) enum LifecycleSignal {
    /// Transcript progress that resets the silent-orphan timer.
    Progress,
    /// A tool call started or moved to `InProgress`. `is_background_task`
    /// carries the SDK `run_in_background` flag from `raw_input`.
    ToolStarted {
        id: String,
        is_background_task: bool,
    },
    /// A tool call reached `Completed` or `Failed`. `off_protocol_work` is
    /// only detected on successful completions.
    ToolCompleted {
        id: String,
        succeeded: bool,
        off_protocol_work: Option<OffProtocolWorkKind>,
    },
    /// Cost-populated `UsageUpdate`, the adapter's end-of-turn accounting
    /// marker. Not progress.
    TerminalUsage,
    /// `ScheduleWakeup` registered an absolute wake time.
    WakeupPending {
        at: chrono::DateTime<chrono::Utc>,
    },
    CompactionStarted,
    CompactionCompleted,
    /// The adapter emits this after the turn's own terminal on a cancel, so
    /// it must never read as the start of new work.
    CompactionFailed,
}

/// `None` for ambient updates (mode, commands, usage without cost) that must
/// not reset the watchdog timer.
pub(super) fn classify_lifecycle_signal(update: &SessionUpdate) -> Option<LifecycleSignal> {
    match update {
        SessionUpdate::UsageUpdate(u) if u.cost.is_some() => Some(LifecycleSignal::TerminalUsage),
        SessionUpdate::AgentMessageChunk(chunk) => {
            // Completion is checked before start so marker drift cannot
            // misroute an end as a fresh start.
            if let ContentBlock::Text(t) = &chunk.content {
                if is_compact_completion(&t.text) {
                    return Some(LifecycleSignal::CompactionCompleted);
                }
                if is_compact_failure(&t.text) {
                    return Some(LifecycleSignal::CompactionFailed);
                }
                if is_compact_start(&t.text) {
                    return Some(LifecycleSignal::CompactionStarted);
                }
            }
            Some(LifecycleSignal::Progress)
        }
        SessionUpdate::AgentThoughtChunk(_) | SessionUpdate::Plan(_) => {
            Some(LifecycleSignal::Progress)
        }
        SessionUpdate::ToolCall(tc) => Some(LifecycleSignal::ToolStarted {
            id: tc.tool_call_id.0.to_string(),
            is_background_task: tc
                .raw_input
                .as_ref()
                .and_then(|v| v.get("run_in_background"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
        }),
        SessionUpdate::ToolCallUpdate(update) => {
            let id = update.tool_call_id.0.to_string();
            Some(match update.fields.status {
                // Failed content can echo a marker, so only completions count.
                Some(ToolCallStatus::Completed) => LifecycleSignal::ToolCompleted {
                    id,
                    succeeded: true,
                    off_protocol_work: detect_off_protocol_work_completed(&update.fields.content),
                },
                Some(ToolCallStatus::Failed) => LifecycleSignal::ToolCompleted {
                    id,
                    succeeded: false,
                    off_protocol_work: None,
                },
                // `InProgress` never carries `raw_input`; the watchdog ORs
                // the flag with the original `ToolCall`'s.
                Some(ToolCallStatus::InProgress) => LifecycleSignal::ToolStarted {
                    id,
                    is_background_task: false,
                },
                _ => LifecycleSignal::Progress,
            })
        }
        _ => None,
    }
}

/// Work the agent keeps doing after its visible tool call completes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OffProtocolWorkKind {
    /// SDK `Agent` tool with `isAsync: true`.
    AsyncAgent,
    /// SDK `Bash` with `run_in_background: true`.
    BackgroundCommand,
    /// SDK `ScheduleWakeup`; survives `TerminalUsage` because a wake outlasts
    /// the turn's accounting frame.
    ScheduledWakeup,
    /// `/compact`; bounded by the turn and dropped on `TerminalUsage`.
    Compaction,
}

/// Ensures exactly one path publishes each turn's terminal event. Epochs allow
/// a later turn to be claimed without letting an older path clear its state.
pub(crate) struct TerminalClaim {
    epoch: AtomicU64,
    /// Epoch whose terminal was published; `0` means none.
    claimed_for: AtomicU64,
}

impl TerminalClaim {
    pub(crate) fn new() -> Self {
        Self {
            epoch: AtomicU64::new(1),
            claimed_for: AtomicU64::new(0),
        }
    }

    pub(super) fn begin_turn(&self) {
        self.epoch.fetch_add(1, AtomicOrdering::AcqRel);
    }

    /// `false` when another path already published this turn's terminal.
    pub(super) fn claim(&self) -> bool {
        let epoch = self.epoch.load(AtomicOrdering::Acquire);
        loop {
            let claimed = self.claimed_for.load(AtomicOrdering::Acquire);
            if claimed == epoch {
                return false;
            }
            if self
                .claimed_for
                .compare_exchange(
                    claimed,
                    epoch,
                    AtomicOrdering::AcqRel,
                    AtomicOrdering::Acquire,
                )
                .is_ok()
            {
                return true;
            }
        }
    }

    pub(super) fn claimed(&self) -> bool {
        self.claimed_for.load(AtomicOrdering::Acquire) == self.epoch.load(AtomicOrdering::Acquire)
    }
}

/// A signal tagged with the prompt epoch current when its notification
/// arrived, so the prompt loop can discard signals from an earlier prompt.
#[derive(Debug, Clone)]
pub(crate) struct LifecycleEnvelope {
    pub epoch: u64,
    pub signal: LifecycleSignal,
}

/// Forward signals only while their prompt-loop consumer is active. Between
/// prompts nothing drains the channel, so an awaited send would block every
/// later notification.
pub(super) async fn forward_lifecycle_signals(
    prompt_active: bool,
    tx: &mpsc::Sender<LifecycleEnvelope>,
    epoch: u64,
    lifecycle: Option<LifecycleSignal>,
    wakeup: Option<LifecycleSignal>,
    session_label: &str,
) {
    if !prompt_active {
        return;
    }
    for signal in [lifecycle, wakeup].into_iter().flatten() {
        // Signals are never dropped for backpressure; `send` only fails once
        // the prompt loop is gone.
        if tx.send(LifecycleEnvelope { epoch, signal }).await.is_err() {
            trace!(
                target: "acp.protocol",
                session = session_label,
                "lifecycle channel closed; dropping signal"
            );
        }
    }
}

/// Matches SDK markers only at line starts so echoed output does not extend
/// watchdog grace.
pub(super) fn detect_off_protocol_work_completed(
    content: &Option<Vec<ToolCallContent>>,
) -> Option<OffProtocolWorkKind> {
    content
        .iter()
        .flatten()
        .filter_map(|block| match block {
            ToolCallContent::Content(c) => match &c.content {
                ContentBlock::Text(t) => Some(t.text.as_str()),
                _ => None,
            },
            _ => None,
        })
        .flat_map(str::lines)
        .find_map(|line| {
            let line = line.trim_start();
            if line.starts_with("Async agent launched successfully") {
                Some(OffProtocolWorkKind::AsyncAgent)
            } else if line.starts_with("Command running in background with ID: ") {
                Some(OffProtocolWorkKind::BackgroundCommand)
            } else {
                None
            }
        })
}

/// Wake signal from a non-failed `ScheduleWakeup` tool update. The initial
/// `ToolCall` is excluded because the tool may still fail; `InProgress` is
/// accepted because the adapter strips `raw_input` from `Completed`.
pub(super) fn wakeup_lifecycle_signal_from_update(
    update: &SessionUpdate,
    profile: &agent_profiles::AgentProfile,
) -> Option<LifecycleSignal> {
    if !profile.supports_wakeup_tools {
        return None;
    }
    let SessionUpdate::ToolCallUpdate(u) = update else {
        return None;
    };
    if matches!(u.fields.status, Some(ToolCallStatus::Failed))
        || u.fields.title.as_deref() != Some("ScheduleWakeup")
    {
        return None;
    }
    match wakeup_event_from_raw(u.fields.raw_input.as_ref()?)? {
        Event::WakeupScheduled { at, .. } => Some(LifecycleSignal::WakeupPending { at }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::acp_client::test_helpers::text_chunk;
    use agent_client_protocol::schema::v1::{
        Content, ToolCall, ToolCallUpdate, ToolCallUpdateFields,
    };

    fn tool_update(status: ToolCallStatus, text: &str) -> SessionUpdate {
        SessionUpdate::ToolCallUpdate(ToolCallUpdate::new(
            "tc-1",
            ToolCallUpdateFields::new()
                .status(status)
                .content(vec![ToolCallContent::Content(Content::new(text))]),
        ))
    }

    #[tokio::test]
    async fn lifecycle_forwarding_only_while_prompt_active() {
        // #2888: between prompts a full channel must not block the handler.
        let (tx, _rx) = mpsc::channel::<LifecycleEnvelope>(1);
        tx.try_send(LifecycleEnvelope {
            epoch: 0,
            signal: LifecycleSignal::Progress,
   
```

### Core Architecture Module: `src/acp/runner_lifecycle.rs`
```
//! Per-session ownership of a structured-view runner.

use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Exact identity of a runner process: its pid plus the generation stamped
/// into its registry record at spawn. Generation 0 (older records) matches on pid alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RunnerIdentity {
    pub pid: u32,
    pub generation: u64,
}

impl RunnerIdentity {
    /// Whether a registry record still describes this runner.
    pub fn matches_record(&self, pid: u32, generation: u64) -> bool {
        self.pid == pid
            && (self.generation == 0 || generation == 0 || self.generation == generation)
    }
}

/// Which code path is bringing a worker up.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResumeKind {
    Attach,
    Spawn,
}

/// Authority token for one epoch of one session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Lease {
    session_id: String,
    epoch: u64,
}

impl Lease {
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn epoch(&self) -> u64 {
        self.epoch
    }
}

/// Public lifecycle state, surfaced as `acp_worker_state`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkerPhase {
    Absent,
    Resuming,
    Running,
    Stopping,
}

#[derive(Debug)]
enum Phase {
    Starting {
        kind: ResumeKind,
        cancel: Option<String>,
    },
    Running {
        identity: Option<RunnerIdentity>,
    },
    Respawning {
        cancel: Option<String>,
    },
    Stopping {
        /// Teardown attempts already made under this epoch.
        attempts: u32,
        /// When this teardown was claimed, so one whose driver went away
        /// (a dropped request future) can be reclaimed by the retry pass.
        since: Instant,
    },
    TeardownRetry {
        identity: RunnerIdentity,
        attempts: u32,
    },
}

#[derive(Debug)]
struct Entry {
    epoch: u64,
    phase: Phase,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdmitError {
    /// A worker is running or another task is mid-resume.
    AlreadyPresent,
    /// A previous runner has not been proven dead yet.
    TeardownPending,
    /// A stop was asked of a resume that then failed before it installed;
    /// the stop stands against this one admission (the reconciler's
    /// fallback), carrying its reason.
    Cancelled(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InstallError {
    Stale,
    /// A stop arrived while the worker was coming up.
    Cancelled {
        reason: String,
    },
}

#[derive(Debug)]
pub enum StopDecision {
    NotOwned,
    /// The in-flight resume or respawn will tear down what it built.
    CancelRequested,
    /// The caller now owns teardown of the running worker.
    TearDown {
        lease: Lease,
        identity: Option<RunnerIdentity>,
    },
    AlreadyStopping,
}

/// Process signalling and liveness, so teardown can be driven against a
/// fake in tests without spawning anything.
pub trait ProcessControl: Send + Sync + 'static {
    fn is_alive(&self, pid: u32) -> bool;
    fn terminate_group(&self, pid: u32);
    fn kill_group(&self, pid: u32);
}

pub struct SystemProcessControl;

impl ProcessControl for SystemProcessControl {
    /// pid 0 addresses the caller's own group and is never a runner.
    fn is_alive(&self, pid: u32) -> bool {
        pid != 0 && crate::process::worker::is_pid_alive_and_ours(pid)
    }

    fn terminate_group(&self, pid: u32) {
        if pid != 0 {
            crate::process::worker::terminate_process_group(pid);
        }
    }

    fn kill_group(&self, pid: u32) {
        if pid != 0 {
            crate::process::worker::kill_process_group(pid);
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Settlement {
    /// Process-group exit and registry cleanup were proven.
    Proven,
    /// The process survived escalation; keep ownership and retry.
    Unproven(RunnerIdentity),
}

/// Pending teardown a retry pass should drive.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetryClaim {
    pub lease: Lease,
    /// `None` for a reclaimed teardown whose driver never settled; the
    /// registry record then names the runner.
    pub identity: Option<RunnerIdentity>,
    pub attempts: u32,
}

pub struct LifecycleTable {
    entries: HashMap<String, Entry>,
    /// Also the generation stamped on the next spawned runner, so it must
    /// stay unique across daemon restarts; the supervisor seeds it from
    /// the wall clock.
    next_epoch: u64,
    /// Highest generation ever admitted or observed per session.
    last_generation: HashMap<String, u64>,
    /// Stops asked of resumes that were abandoned before they installed,
    /// consumed by the next `admit` so the reconciler cannot spawn over
    /// the user's stop.
    stale_cancels: HashMap<String, String>,
}

impl LifecycleTable {
    pub fn new(seed_epoch: u64) -> Self {
        Self {
            entries: HashMap::new(),
            next_epoch: seed_epoch.max(1),
            last_generation: HashMap::new(),
            stale_cancels: HashMap::new(),
        }
    }

    /// Next epoch.
    fn mint(&mut self, session_id: &str, stamped: bool) -> u64 {
        let epoch = self.next_epoch;
        self.next_epoch += 1;
        if stamped {
            self.note_generation(session_id, epoch);
        }
        epoch
    }

    fn lease(&self, session_id: &str, epoch: u64) -> Lease {
        Lease {
            session_id: session_id.to_string(),
            epoch,
        }
    }

    fn current(&mut self, lease: &Lease) -> Option<&mut Entry> {
        self.entries
            .get_mut(&lease.session_id)
            .filter(|e| e.epoch == lease.epoch)
    }

    /// Record a generation observed on disk so marker authority tracks
    /// runners this daemon did not spawn.
    pub fn note_generation(&mut self, session_id: &str, generation: u64) {
        let slot = self
            .last_generation
            .entry(session_id.to_string())
            .or_default();
        *slot = (*slot).max(generation);
    }

    pub fn forget_stale_cancel(&mut self, session_id: &str) {
        self.stale_cancels.remove(session_id);
    }

    pub fn forget(&mut self, session_id: &str) {
        self.entries.remove(session_id);
        self.last_generation.remove(session_id);
        self.stale_cancels.remove(session_id);
    }

    pub fn last_generation(&self, session_id: &str) -> u64 {
        self.last_generation.get(session_id).copied().unwrap_or(0)
    }

    /// Reserve the session for a spawn or attach.
    pub fn admit(&mut self, session_id: &str, kind: ResumeKind) -> Result<Lease, AdmitError> {
        match self.entries.get(session_id).map(|e| &e.phase) {
            None => {}
            Some(Phase::Stopping { .. } | Phase::TeardownRetry { .. }) => {
                return Err(AdmitError::TeardownPending)
            }
            Some(_) => return Err(AdmitError::AlreadyPresent),
        }
        if let Some(reason) = self.stale_cancels.remove(session_id) {
            return Err(AdmitError::Cancelled(reason));
        }
        let epoch = self.mint(session_id, kind == ResumeKind::Spawn);
        self.entries.insert(
            session_id.to_string(),
            Entry {
                epoch,
                phase: Phase::Starting { kind, cancel: None },
            },
        );
        Ok(self.lease(session_id, epoch))
    }

    /// Promote a starting or respawning worker to running.
    pub fn install(
        &mut self,
        lease: &Lease,
        identity: Option<RunnerIdentity>,
    ) -> Result<(), InstallError> {
        let Some(entry) = self.current(lease) else {
            return Err(InstallError::Stale);
        };
        let cancel = match &mut entry.phase {
            Phase::Starting { cancel, .. } | Phase::Respawning { cancel } => cancel.take(),
            _ => return Err(InstallError::Stale),
        };
        if let Some(reason) = cancel {
            entry.phase = Phase::Stopping {
                attempts: 0,
                since: Instant::now(),
            };
            return Err(InstallError::Cancelled { reason });
        }
        entry.phase = Phase::Running { identity };
        if let Some(identity) = identity {
            self.note_generation(&lease.session_id, identity.generation);
        }
        Ok(())
    }

    /// Give up a starting or respawning epoch that built nothing.
    pub fn abandon(&mut self, lease: &Lease) -> bool {
        let Some(entry) = self.current(lease) else {
            return false;
        };
        let cancel = match &entry.phase {
            Phase::Starting { cancel, .. } | Phase::Respawning { cancel } => cancel.clone(),
            _ => return false,
        };
        self.entries.remove(&lease.session_id);
        if let Some(reason) = cancel {
            self.stale_cancels.insert(lease.session_id.clone(), reason);
        }
        true
    }

    /// Drop a running worker whose runner is left alive on disk (a
    /// rate-limit park, a burned budget).
    pub fn release_running(&mut self, lease: &Lease) -> bool {
        let Some(entry) = self.current(lease) else {
            return false;
        };
        if matches!(entry.phase, Phase::Running { .. }) {
            self.entries.remove(&lease.session_id);
            return true;
        }
        false
    }

    /// Ask for the session's worker to stop.
    pub fn begin_stop(&mut self, session_id: &str, reason: &str) -> StopDecision {
        let Some(entry) = self.entries.get_mut(session_id) else {
            return StopDecision::NotOwned;
        };
        let epoch = entry.epoch;
        match &mut entry.phase {
            Phase::Starting { cancel, .. } | Phase::Respawning { cancel } => {
                cancel.get_or_insert_with(|| reason.to_string());
                StopDecision::CancelRequested
            }
            Phase::Running { identity } => {
                let identit
```

### Core Architecture Module: `src/acp/state.rs`
```
//! `AcpState`: the structured view session state, folded from `Event`s by a single writer.

use crate::daemon::PromptAttachmentRef;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::approvals::{Approval, ApprovalDecision, Nonce};
use super::elicitations::{Elicitation, ElicitationAnswer, ElicitationOutcome};

#[derive(Debug, Clone, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AcpSessionId(pub String);

/// Which backend agent is running this session.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentName(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub id: String,
    pub title: String,
    pub detail: Option<String>,
    pub status: PlanStepStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlanStepStatus {
    Pending,
    InProgress,
    Done,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub plan_id: String,
    pub version: u32,
    pub steps: Vec<PlanStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub text: String,
    pub completed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    /// ACP `ToolKind`, lowercased.
    #[serde(default)]
    pub kind: String,
    /// Capped at 16 KB at ingest, control chars stripped.
    pub args_preview: String,
    pub started_at: DateTime<Utc>,
    /// The sub-agent `Task` call this call runs under, from `_meta.claudeCode.parentToolUseId`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_recall: Option<MemoryRecall>,
    /// File diffs attached via ACP `ToolCallContent::Diff`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diffs: Vec<DiffPreview>,
}

/// Structured payload for a `memory_recall` tool call.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoryRecall {
    pub mode: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub paths: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub synthesized_text: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiffPreview {
    pub path: String,
    pub old_text: Option<String>,
    pub new_text: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// One renderable block of a tool call's completion, bridged from ACP `ToolCallContent`.
/// Binary `data` fields carry base64.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ToolOutputBlock {
    Text {
        text: String,
    },
    Image {
        mime_type: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        data: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        uri: Option<String>,
    },
    Audio {
        mime_type: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        data: Option<String>,
    },
    ResourceLink {
        uri: String,
        name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        mime_type: Option<String>,
    },
    Resource {
        uri: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        mime_type: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        text: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        data: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingSignal {
    pub started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub status: String,
    /// When the quota window clears, if the agent reported it.
    pub resets_at: Option<DateTime<Utc>>,
    pub kind: String,
}

impl RateLimitInfo {
    /// A park whose reporting `RateLimit` event was pruned: a limit with no reset time.
    pub fn undated() -> Self {
        Self {
            status: "limited".into(),
            resets_at: None,
            kind: "rate_limit".into(),
        }
    }
}

/// A live advisory the agent pushed outside the turn flow (approaching a rate
/// limit, a model fallback), per the ACP session-notices extension. Each
/// surface derives its own tone from the raw `severity` string.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionNotice {
    /// Minted from the event seq, so a client keys its local dismissal on it.
    pub id: String,
    pub severity: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Snapshot of the most recent ACP agent handoff.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSwitchInfo {
    pub from: String,
    pub to: String,
    pub reason: String,
    pub switched_at: DateTime<Utc>,
}

/// The agent's last-reported context-window usage and cumulative cost.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUsage {
    pub used: u64,
    pub size: u64,
    #[serde(default)]
    pub cost: Option<UsageCost>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageCost {
    pub amount: f64,
    /// ISO 4217 code.
    pub currency: String,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionMode {
    #[default]
    Default,
    Plan,
    AcceptEdits,
    BypassPermissions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeInfo {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

/// Agent-to-client notification carrying the agent's own auth identity.
pub const AUTH_STATUS_UPDATE_METHOD: &str = "_auth/status_update";

/// Which auth identity the agent process resolved for itself. An interim
/// `_meta` extension, so an unrecognised kind still renders from `label`
/// rather than dropping the whole report.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthStatusKind {
    Account,
    ApiKey,
    Gateway,
    External,
    /// The agent knows it is logged out. Distinct from never reporting.
    None,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthStatusAccount {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization: Option<String>,
    /// Vendor plan string, not normalised.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan: Option<String>,
}

/// The agent's own `_auth/status_update` payload. The upstream `vendor` bag is
/// deliberately not kept: nothing reads it, and it would persist unbounded
/// third-party data into the session log.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthStatus {
    pub kind: AuthStatusKind,
    /// Usable as a UI string on its own ("Claude Max", "Anthropic API key").
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account: Option<AuthStatusAccount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableCommand {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub accepts_input: bool,
}

/// Semantic category of an ACP `SessionConfigOption`; unknown values round-trip as `Other`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConfigOptionCategory {
    Mode,
    Model,
    ThoughtLevel,
    #[serde(untagged)]
    Other(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfigOptionChoice {
    pub value: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// One ACP `SessionConfigOption` selector.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfigOptionDescriptor {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub category: ConfigOptionCategory,
    pub current_value: String,
    pub options: Vec<ConfigOptionChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfigOptionSwitchFailure {
    pub config_id: String,
    pub value: String,
    pub reason: String,
}

/// Why aoe refused a session whose adapter failed the compatibility check
/// after `initialize`. `auto_install` means "Update & restart" can fix it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum StartupErrorDetail {
    IncompatibleAgentVersion {
        package_name: String,
        installed: String,
        required: String,
        install_command: String,
        #[serde(default)]
        auto_install: bool,
    },
    MissingAgentInfo {
        expected_package: String,
        install_command: String,
        #[serde(default)]
        auto_install: bool,
    },
    MismatchedAgentName {
        expected: String,
        received: String,
        install_command: String,
        #[serde(default)]
        auto_install: bool,
    },
    UnparseableAgentVersion {
        package_name: String,
        raw_version: String,
        required: String,
        install_command: String,
        #[serde(default)]
        auto_install: bool,
    },
    U
```

### Core Architecture Module: `src/cli/hooks.rs`
```
//! `aoe hooks` subcommands: record your approval for AoE to write agent hooks
//! into each agent's own config, and show what that approval covers.
//!
//! The approval is the same install-wide flag the TUI dialog writes.
//! `--trust-hooks` is a different surface: per-repository trust for hooks the
//! repo declares itself.

use anyhow::Result;
use clap::Subcommand;

use crate::session::{host_hook_agent, host_hook_disclosure, update_app_state, Config};

#[derive(Subcommand)]
pub enum HooksCommands {
    /// Show whether AoE may write agent hooks, and what they resolve for a profile
    Status,
    /// Let AoE write agent hooks for every agent, on every profile
    Approve,
}

#[tracing::instrument(target = "cli.hooks", skip_all, fields(profile = %profile))]
pub fn run(profile: &str, command: HooksCommands) -> Result<()> {
    match command {
        HooksCommands::Status => print_status(profile),
        HooksCommands::Approve => approve(profile),
    }
}

/// A corrupt `state.toml` is an error here rather than a silent "not approved",
/// which would point the user at an approve that cannot succeed either.
fn approved() -> Result<bool> {
    Ok(Config::load()?.app_state.has_acknowledged_agent_hooks)
}

fn print_status(profile: &str) -> Result<()> {
    if approved()? {
        println!("Agent hooks: approved for this installation");
    } else {
        println!("Agent hooks: not approved");
        println!("  Run `aoe hooks approve` to let AoE write them, or accept the");
        println!("  dialog the TUI shows when you create a host session.");
    }
    print_disclosure(profile);
    Ok(())
}

fn approve(profile: &str) -> Result<()> {
    // Always disclose, even on a repeat run, so the output can be used to
    // review what the standing approval covers for another profile.
    print_disclosure(profile);
    if approved()? {
        println!();
        println!("Agent hooks already approved for this installation");
        return Ok(());
    }
    update_app_state(|state| {
        state.has_acknowledged_agent_hooks = true;
    })?;
    println!();
    println!("✓ Agent hooks approved for this installation");
    Ok(())
}

/// Print the files and hook commands this profile resolves, for every tool it
/// installs hooks for. The printed caveat is the bound on that list.
fn print_disclosure(profile: &str) {
    let profile = crate::session::config::effective_profile(profile);
    let config = crate::session::config::profile_config::resolve_config_or_warn(&profile);
    let status_hooks = config.session.agent_status_hooks;

    let mut tool_names = crate::agents::agent_names();
    tool_names.extend(config.session.custom_agents.keys().map(String::as_str));
    tool_names.sort_unstable();
    tool_names.dedup();

    // A configured tool that resolves to no agent is dropped here, so it would
    // vanish from the enumeration without a trace. Keep its name: the user
    // cannot otherwise tell "no extra agent" from "an agent I could not name".
    let mut unresolved: Vec<&str> = Vec::new();
    let disclosures: Vec<_> = tool_names
        .into_iter()
        .filter_map(|tool_name| {
            let agent = host_hook_agent(
                tool_name,
                &config.session.launch_command_for(tool_name),
                &config.session,
            );
            let Some(agent) = agent else {
                unresolved.push(tool_name);
                return None;
            };
            if !crate::agents::hook_install_required(agent, status_hooks) {
                return None;
            }
            let disclosure = host_hook_disclosure(tool_name, agent, &config);
            (!disclosure.settings_paths.is_empty()).then_some((tool_name, disclosure))
        })
        .collect();

    let status_hooks_active = disclosures
        .iter()
        .any(|(_, disclosure)| disclosure.status_hooks_enabled);
    if disclosures.is_empty() {
        println!("No agent under this profile installs hooks, so there is nothing to");
        println!("approve.");
    } else if status_hooks_active {
        println!("AoE installs agent hooks into each agent's own config. The status");
        println!("hooks detect session status (running/waiting/idle); the identity hooks");
        println!("record the conversation id native resume needs.");
    } else {
        println!("No status hook survives this profile, so AoE installs only the");
        println!("identity hooks native resume needs.");
    }
    println!();
    println!("Profile: {profile}");
    println!();
    println!("Files AoE targets:");
    for (tool_name, disclosure) in &disclosures {
        for path in &disclosure.settings_paths {
            println!("  {tool_name}: {path}");
        }
        for (label, path) in &disclosure.extra_settings_paths {
            println!("  {tool_name}: {path}");
            println!("    ({label})");
        }
        if let Some(config) = &disclosure.disabled_by_agent {
            println!(
                "    (this agent's own config turns its hooks off: {})",
                config.display()
            );
        }
    }

    if !unresolved.is_empty() {
        println!();
        println!("Configured but not named here:");
        for tool_name in &unresolved {
            println!("  {tool_name}");
        }
        println!("  A repository can set session.agent_detect_as, and this command has");
        println!("  no project directory, so a launch inside one may resolve those to a");
        println!("  different agent. Declaring agent_execution_as and agent_config_dir for");
        println!("  them in this profile pins the file, because a repository cannot move");
        println!("  either of those.");
    }

    let events: Vec<_> = disclosures
        .iter()
        .filter(|(_, disclosure)| !disclosure.hook_commands.is_empty())
        .collect();
    let notes = crate::session::host_hook_post_install_notes();
    if !notes.is_empty() {
        println!();
        println!("This approval covers every agent and profile. Besides the files");
        println!("above, installing hooks for these agents also changes launcher state:");
        for (agent, note) in &notes {
            println!("  {agent}: {note}");
        }
    }

    if !events.is_empty() {
        println!();
        println!("Hook events a launch would install:");
        for (tool_name, disclosure) in events {
            println!("  {tool_name}:");
            for (event, effect) in &disclosure.hook_commands {
                println!("    {event} -> {effect}");
            }
        }
    }
    if status_hooks_active {
        println!();
        println!("A status event writes under the session's own directory, named by");
        println!(
            "  printf {{status}} > {}/$AOE_INSTANCE_ID/status",
            crate::hooks::hook_base_path().display()
        );
    }
    println!();
    println!("Hooks are guarded by $AOE_INSTANCE_ID and are a");
    println!("no-op outside of AoE sessions.");
    println!();
    println!("This is what the effective profile resolves, not a manifest of every");
    println!("write a launch can make. A launch that routes through a native store,");
    println!("merges into a selected agent, or targets a selected or recorded Claude");
    println!("conversation store resolves that target at launch time.");
    println!();
    println!("A session launched with its own command resolves the file that command");
    println!("names; the creation dialog describes such a session exactly.");
    println!();
    println!("The approval is per installation and is not bound to this profile, so");
    println!("another profile resolves its own paths under the same approval.");
    if disclosures
        .iter()
        .any(|(_, d)| d.needs_codex_trust_note && d.disabled_by_agent.is_none())
    {
        println!();
        println!("Codex may ask you to review and trust these hooks in /hooks.");
        if status_hooks_active {
            println!("Until then, AoE falls back to pane-based status detection.");
        }
    }
}

```

### Core Architecture Module: `src/hooks/codex.rs`
```
//! Codex hooks: `hooks.json` installs gated on `config.toml`, and the legacy
//! `config.toml` hook tables that migrations still rewrite.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use toml_edit::{DocumentMut, Item, TableLike};

use crate::agents::ResolvedHookEvent;

use super::command::{hook_command, is_aoe_hook_command};
use super::config_io::{
    log_installed, log_removed, log_unchanged, with_config_lock_policy, SymlinkPolicy,
};
use super::HookInstallTarget;

pub(super) const CODEX_HOOK_EVENT_NAMES: &[&str] = &[
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "Stop",
    "PreCompact",
    "PostCompact",
];

/// The `config.toml` beside `hooks_path` that turns Codex's own hooks off, or
/// `None` when the feature is on or the file is absent. Read exactly the way
/// [`install_codex_json_hooks`] reads it, so the disclosure and the
/// installer cannot disagree about the same file. Silent, unlike the install
/// path: a query and a skip want different log lines.
pub(crate) fn codex_hooks_disabled_at(hooks_path: &Path) -> Option<PathBuf> {
    let config_path = hooks_path.with_file_name("config.toml");
    let config = read_codex_config(&config_path, SymlinkPolicy::Follow).ok()?;
    codex_hooks_feature_is_disabled(&config, &config_path).then_some(config_path)
}

/// Install Codex JSON hooks unless the adjacent `config.toml` disables them,
/// reporting whether AoE hooks are present afterwards.
///
/// Empty events remove AoE hooks regardless. A disabled `hooks` feature removes
/// them too rather than leaving the last install behind: Codex will not run
/// them, so anything AoE wrote is dead weight in the user's file. Both cases
/// report `false`, which is what tells the caller no identity publisher is
/// live. Sandbox config must be absent or safely readable without following
/// links; an unreadable config aborts.
pub(crate) fn install_codex_json_hooks(
    hooks_path: &Path,
    events: impl AsRef<[ResolvedHookEvent]>,
    target: HookInstallTarget,
) -> Result<bool> {
    let events = events.as_ref();
    if events.is_empty() {
        super::install_hooks(hooks_path, events, target)?;
        return Ok(false);
    }

    let config_path = hooks_path.with_file_name("config.toml");
    let config = match target {
        HookInstallTarget::Host => read_codex_config(&config_path, SymlinkPolicy::Follow)?,
        HookInstallTarget::Sandbox => match std::fs::symlink_metadata(&config_path) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => DocumentMut::new(),
            Err(error) => return Err(error).context("Inspecting sandbox Codex config"),
            Ok(_) => {
                // `Never` maps unsafe entries to absence; that must not read as opted in.
                let content = SymlinkPolicy::Never.read(&config_path)?.with_context(|| {
                    format!(
                        "Cannot safely read sandbox Codex config {}",
                        config_path.display()
                    )
                })?;
                content
                    .parse::<DocumentMut>()
                    .with_context(|| format!("Failed to parse {}", config_path.display()))?
            }
        },
    };
    if codex_hooks_feature_is_disabled(&config, &config_path) {
        super::install_hooks(hooks_path, &[], target)?;
        return Ok(false);
    }
    super::install_hooks(hooks_path, events, target)?;
    Ok(true)
}

/// Read `[hooks.state]` (Codex's hook trust records) under the config lock.
pub(crate) fn snapshot_codex_hooks_state(config_path: &Path) -> Result<Option<Item>> {
    if !config_path.exists() {
        return Ok(None);
    }
    with_codex_config_lock(config_path, SymlinkPolicy::Follow, || {
        let config = read_codex_config(config_path, SymlinkPolicy::Follow)?;
        Ok(config
            .get("hooks")
            .and_then(Item::as_table_like)
            .and_then(|hooks| hooks.get("state"))
            .cloned())
    })
}

/// Overwrite `[hooks.state]` with a snapshot taken by [`snapshot_codex_hooks_state`].
pub(crate) fn restore_codex_hooks_state(config_path: &Path, state: Item) -> Result<()> {
    with_codex_config_lock(config_path, SymlinkPolicy::Follow, || {
        let mut config = read_codex_config(config_path, SymlinkPolicy::Follow)?;
        ensure_codex_hooks_table(&mut config)?.insert("state", state);
        write_codex_config(config_path, &config, SymlinkPolicy::Follow)
    })
}

/// Rewrite AoE's `config.toml` hook tables, seeding `[hooks.state]` from
/// `preserved_state` only when the file has none. Unchanged content is not rewritten.
pub(crate) fn install_codex_hooks_with_preserved_state(
    config_path: &Path,
    events: impl AsRef<[ResolvedHookEvent]>,
    preserved_state: Option<Item>,
    target: HookInstallTarget,
) -> Result<()> {
    with_codex_config_lock(config_path, SymlinkPolicy::Follow, || {
        let mut config = read_codex_config(config_path, SymlinkPolicy::Follow)?;
        if codex_hooks_feature_is_disabled(&config, config_path) {
            return Ok(());
        }
        let before = config.to_string();

        if let Some(state) = preserved_state {
            let hooks = ensure_codex_hooks_table(&mut config)?;
            if !hooks.contains_key("state") {
                hooks.insert("state", state);
            }
        }
        remove_codex_aoe_hooks(&mut config)?;
        let hooks = ensure_codex_hooks_table(&mut config)?;
        for event in events.as_ref() {
            if let Some(status) = event.status {
                ensure_codex_event_array(hooks, &event.name)?.push(codex_matcher_group(
                    event,
                    &hook_command(status.as_str(), target),
                ));
            }
        }

        if config.to_string() == before {
            log_unchanged(config_path);
            return Ok(());
        }
        write_codex_config(config_path, &config, SymlinkPolicy::Follow)?;
        log_installed(config_path);
        Ok(())
    })
}

/// Remove AoE status hooks from Codex's `config.toml`.
pub fn uninstall_codex_hooks(config_path: &Path) -> Result<bool> {
    if !config_path.exists() {
        return Ok(false);
    }
    let modified = with_codex_config_lock(config_path, SymlinkPolicy::Follow, || {
        let mut config = read_codex_config(config_path, SymlinkPolicy::Follow)?;
        if !remove_codex_aoe_hooks(&mut config)? {
            return Ok(false);
        }
        write_codex_config(config_path, &config, SymlinkPolicy::Follow)?;
        Ok(true)
    })?;
    if modified {
        log_removed(config_path);
    }
    Ok(modified)
}

pub(super) fn with_codex_config_lock<T>(
    config_path: &Path,
    policy: SymlinkPolicy,
    f: impl FnOnce() -> Result<T>,
) -> Result<T> {
    with_config_lock_policy(&policy.lock_path(config_path)?, "toml.lock", policy, f)
}

pub(super) fn write_codex_config(
    config_path: &Path,
    config: &DocumentMut,
    policy: SymlinkPolicy,
) -> Result<()> {
    policy.write(config_path, config.to_string().as_bytes())
}

pub(super) fn read_codex_config(config_path: &Path, policy: SymlinkPolicy) -> Result<DocumentMut> {
    match policy.read(config_path)? {
        Some(content) => content
            .parse::<DocumentMut>()
            .with_context(|| format!("Failed to parse {}", config_path.display())),
        None => Ok(DocumentMut::new()),
    }
}

fn ensure_codex_hooks_table(config: &mut DocumentMut) -> Result<&mut toml_edit::Table> {
    let not_table = || anyhow::anyhow!("Codex hooks key is not a TOML table");
    let hooks = config
        .as_table_mut()
        .entry("hooks")
        .or_insert_with(|| Item::Table(toml_edit::Table::new()));
    if !hooks.is_table() {
        match std::mem::take(hooks).into_table() {
            Ok(table) => *hooks = Item::Table(table),
            Err(old) => {
                *hooks = old;
                return Err(not_table());
            }
        }
    }
    hooks.as_table_mut().ok_or_else(not_table)
}

fn ensure_codex_event_array<'a>(
    hooks: &'a mut toml_edit::Table,
    event_name: &str,
) -> Result<&'a mut toml_edit::ArrayOfTables> {
    let not_array =
        || anyhow::anyhow!("Codex hooks.{event_name} is not an array of matcher groups");
    let item = hooks
        .entry(event_name)
        .or_insert_with(|| Item::ArrayOfTables(toml_edit::ArrayOfTables::new()));
    if !item.is_array_of_tables() {
        if item.as_array().is_some_and(|arr| arr.is_empty()) {
            *item = Item::ArrayOfTables(toml_edit::ArrayOfTables::new());
        } else {
            match std::mem::take(item).into_array_of_tables() {
                Ok(array) => *item = Item::ArrayOfTables(array),
                Err(old) => {
                    *item = old;
                    return Err(not_array());
                }
            }
        }
    }
    item.as_array_of_tables_mut().ok_or_else(not_array)
}

fn codex_matcher_group(event: &ResolvedHookEvent, command: &str) -> toml_edit::Table {
    let mut group = toml_edit::Table::new();
    if let Some(matcher) = &event.matcher {
        group.insert("matcher", toml_edit::value(matcher.as_str()));
    }
    let mut handler = toml_edit::Table::new();
    handler.insert("type", toml_edit::value("command"));
    handler.insert("command", toml_edit::value(command));
    let mut handlers = toml_edit::ArrayOfTables::new();
    handlers.push(handler);
    group.insert("hooks", Item::ArrayOfTables(handlers));
    group
}

/// For each handler in a matcher group's `hooks` (table or inline form),
/// whether its command is AoE's.
pub(super) fn codex_group_aoe_flags(group: &dyn TableLike) -> Vec<bool> {
    let Some(hooks) = group.get("hooks") else {
        return Vec::new();
    };
    if let Some(handlers) = hooks.as_array_of_tables() {
        return handlers
            .iter()
            .map(|h| {
                h.get("command")
        
```

### Core Architecture Module: `src/hooks/command.rs`
```
//! Shell commands AoE installs as agent hooks, and recognition of them.

use crate::agents::{HookIdentityField, HookStatus};

use super::{dir_guard, HookInstallTarget};

/// `concat!` only accepts literals, so the marker is a macro shared by the constants below.
macro_rules! aoe_hook_marker {
    () => {
        "aoe-hooks"
    };
}

/// Fixed base inside the single-tenant sandbox; the host bind-mounts the
/// canonical `dir_guard::hook_base_path()/<id>` onto `<this>/<id>`.
pub(crate) const HOOK_STATUS_BASE_IN_CONTAINER: &str = concat!("/tmp/", aoe_hook_marker!());

const AOE_HOOK_MARKER: &str = aoe_hook_marker!();

/// Every emitter ends with `exit 0 # aoe-hooks`; the `0 ` binds the match to
/// that trailer rather than a `# aoe-hooks` inside user text.
const AOE_HOOK_TRAILING_SENTINEL: &str = concat!("0 # ", aoe_hook_marker!());

/// Legacy emitters without the trailer bake this path; a user script would
/// have expanded `$AOE_INSTANCE_ID`.
const AOE_HOOK_PATH_SENTINEL: &str = concat!(aoe_hook_marker!(), "/$AOE_INSTANCE_ID");

/// Whether `cmd` was emitted by AoE (current or legacy form).
pub(super) fn is_aoe_hook_command(cmd: &str) -> bool {
    let trimmed_tail = cmd.trim_end_matches(|c: char| c == '\'' || c == '"' || c.is_whitespace());
    trimmed_tail.ends_with(AOE_HOOK_TRAILING_SENTINEL) || cmd.contains(AOE_HOOK_PATH_SENTINEL)
}

/// Whether a JSON hook entry's `command` is AoE's.
pub(super) fn json_command_is_aoe(entry: &serde_json::Value) -> bool {
    entry
        .get("command")
        .and_then(serde_json::Value::as_str)
        .is_some_and(is_aoe_hook_command)
}

fn hook_base_for_target(target: HookInstallTarget) -> String {
    match target {
        HookInstallTarget::Host => dir_guard::hook_base_path().display().to_string(),
        HookInstallTarget::Sandbox => HOOK_STATUS_BASE_IN_CONTAINER.to_string(),
    }
}

/// Command writing `status` to the instance's status file. It must always
/// exit 0: a failing hook blocks the agent's tool calls.
pub(crate) fn hook_command(status: &str, target: HookInstallTarget) -> String {
    hook_command_with_base(status, &hook_base_for_target(target), target)
}

/// The tool-gated writer when `waiting_tools` can change the outcome, else the
/// plain writer (the gate only ever rewrites to `waiting`).
pub(crate) fn status_command_for_event(
    status: HookStatus,
    waiting_tools: &[String],
    target: HookInstallTarget,
) -> String {
    if waiting_tools.is_empty() || status == HookStatus::Waiting {
        hook_command(status.as_str(), target)
    } else {
        hook_command_waiting_tools_with_base(
            status.as_str(),
            waiting_tools,
            &hook_base_for_target(target),
            target,
        )
    }
}

/// Writes `waiting` when stdin names one of `waiting_tools`, else `default_status`.
/// Matches the compact `"tool_name":"X"` bytes, which an escaped mention inside
/// a JSON string value cannot produce.
fn hook_command_waiting_tools_with_base(
    default_status: &str,
    waiting_tools: &[String],
    base: &str,
    target: HookInstallTarget,
) -> String {
    let patterns: Vec<String> = waiting_tools
        .iter()
        .map(|tool| format!("*\\\"tool_name\\\":\\\"{tool}\\\"*"))
        .collect();
    let write = format!(
        "IN=$(cat 2>/dev/null); S={default_status}; \
         case \"$IN\" in {patterns}) S=waiting ;; esac; \
         printf %s \"$S\" > \"$D/status\" 2>/dev/null; ",
        patterns = patterns.join("|")
    );
    hook_command_with_write(&write, base, target)
}

fn hook_command_with_base(status: &str, base: &str, target: HookInstallTarget) -> String {
    hook_command_with_write(
        &format!("printf {status} > \"$D/status\" 2>/dev/null; "),
        base,
        target,
    )
}

/// Host commands check the base's mode and owner (the Rust `dir_guard` is the
/// authoritative gate); sandbox commands skip the uid check because the
/// container uid is unpredictable and the bind source was validated host-side.
fn hook_command_with_write(write: &str, base: &str, target: HookInstallTarget) -> String {
    let (parent_check, owner_recheck) = match target {
        // `mkdir -p $B` recovers from a /tmp reaper. It relies on /tmp's sticky
        // bit; re-audit if the base ever moves out of /tmp.
        HookInstallTarget::Host => (
            "\
             mkdir -p \"$B\" 2>/dev/null || exit 0; \
             LS=$(LC_ALL=C ls -ldn \"$B\" 2>/dev/null) || exit 0; \
             set -- $LS; M=\"$1\"; \
             case \"$M\" in drwx------|drwx------.|drwx------+|drwx------@) ;; *) exit 0 ;; esac; \
             ME=$(id -u 2>/dev/null) || exit 0; \
             [ \"$3\" = \"$ME\" ] || exit 0; ",
            "[ \"$3\" = \"$ME\" ] || exit 0; ",
        ),
        HookInstallTarget::Sandbox => ("", ""),
    };
    format!(
        "sh -c 'unset IFS; set -f; umask 077; \
         [ -n \"$AOE_INSTANCE_ID\" ] || exit 0; \
         case \"$AOE_INSTANCE_ID\" in *[!0-9a-zA-Z_-]*) exit 0 ;; esac; \
         B={base}; {parent_check}\
         D=\"$B/$AOE_INSTANCE_ID\"; \
         mkdir -p \"$D\" 2>/dev/null; \
         LS=$(LC_ALL=C ls -ldn \"$D\" 2>/dev/null) || exit 0; \
         set -- $LS; M=\"$1\"; \
         case \"$M\" in drwx------|drwx------.|drwx------+|drwx------@) ;; *) exit 0 ;; esac; \
         {owner_recheck}\
         {write}\
         exit 0 # {AOE_HOOK_MARKER}'"
    )
}

/// Command extracting the top-level session id from the hook's stdin JSON into
/// the `session_id` sidecar. The host calls the pinned `aoe` binary; the
/// sandbox image has no `aoe`, so it uses `jq` and silently skips without it.
///
/// `publisher` is the binary of the agent whose config fires the hook. A nested agent of another
/// kind inherits the pane's `AOE_*` environment, so its hooks must not publish into the pane's
/// sidecar: both commands skip when `AOE_AGENT_BIN` names a different agent.
pub(crate) fn hook_command_session_id(
    target: HookInstallTarget,
    field: HookIdentityField,
    publisher: Option<&str>,
) -> String {
    // The command is a single-quoted `sh -c` body; a publisher outside this alphabet would need
    // quoting there, and every built-in agent binary fits it.
    let publisher = publisher.filter(|name| {
        !name.is_empty()
            && name
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
    });
    match target {
        HookInstallTarget::Host => hook_command_session_id_host(field, publisher),
        HookInstallTarget::Sandbox => {
            hook_command_session_id_sandbox(HOOK_STATUS_BASE_IN_CONTAINER, field, publisher)
        }
    }
}

/// The `--field` value an identity hook extracts. Named here so the command
/// and the disclosure cannot drift apart.
pub(crate) fn identity_field_name(field: HookIdentityField) -> &'static str {
    match field {
        HookIdentityField::SessionId => "session-id",
        HookIdentityField::ConversationIdOrSessionId => "conversation-id-or-session-id",
    }
}

/// The `--agent NAME` qualifier an identity command carries, empty when the
/// event declares no publisher. Named here so the command and the
/// disclosure cannot drift.
pub(crate) fn identity_publisher_arg(publisher: Option<&str>) -> String {
    publisher.map_or_else(String::new, |name| format!(" --agent {name}"))
}

fn hook_command_session_id_host(field: HookIdentityField, publisher: Option<&str>) -> String {
    let field = identity_field_name(field);
    let agent = identity_publisher_arg(publisher);
    format!(
        "sh -c '[ -n \"$AOE_INSTANCE_ID\" ] || exit 0; \
         [ -n \"$AOE_HOOK_BIN\" ] || exit 0; \
         [ -x \"$AOE_HOOK_BIN\" ] || exit 0; \
         \"$AOE_HOOK_BIN\" __extract-session-id --field {field}{agent} 2>/dev/null; exit 0 # {AOE_HOOK_MARKER}'"
    )
}

/// A second `AOE_AGENT_BIN` ancestor marks a nested agent, whose id must not
/// replace the pane's; with no launch pid in the container the walk runs to root.
fn hook_command_session_id_sandbox(
    base: &str,
    field: HookIdentityField,
    publisher: Option<&str>,
) -> String {
    let publisher_guard = publisher.map_or_else(String::new, |name| {
        format!("[ -z \"${{AOE_AGENT_BIN:-}}\" ] || [ \"$AOE_AGENT_BIN\" = {name} ] || exit 0; ")
    });
    let selector = match field {
        HookIdentityField::SessionId => {
            r#"if (.session_id|type)=="string" then .session_id else empty end"#
        }
        HookIdentityField::ConversationIdOrSessionId => {
            r#"if (.conversation_id|type)=="string" then .conversation_id elif (.session_id|type)=="string" then .session_id else empty end"#
        }
    };
    format!(
        "sh -c 'unset IFS; set -f; umask 077; \
         [ -n \"$AOE_INSTANCE_ID\" ] || exit 0; \
         case \"$AOE_INSTANCE_ID\" in *[!0-9a-zA-Z_-]*) exit 0 ;; esac; \
         D=\"{base}/$AOE_INSTANCE_ID\"; mkdir -p \"$D\" 2>/dev/null; \
         LS=$(LC_ALL=C ls -ldn \"$D\" 2>/dev/null) || exit 0; \
         set -- $LS; M=\"$1\"; \
         case \"$M\" in drwx------|drwx------.|drwx------+|drwx------@) ;; *) exit 0 ;; esac; \
         {publisher_guard}B=\"${{AOE_AGENT_BIN:-}}\"; N=0; P=$PPID; \
         while [ -n \"$B\" ] && [ \"${{P:-0}}\" -gt 0 ]; do \
         A=$(tr \"\\0\" \"\\n\" < /proc/$P/cmdline 2>/dev/null | head -n 1); \
         [ \"${{A##*/}}\" = \"$B\" ] && N=$((N + 1)); \
         P=$(sed -n \"s/^PPid:[[:space:]]*//p\" /proc/$P/status 2>/dev/null); \
         done; \
         [ \"$N\" -le 1 ] || exit 0; \
         command -v jq >/dev/null 2>&1 || exit 0; \
         SID=$(jq -r '\\''{selector}'\\'' 2>/dev/null); \
         case \"$SID\" in \"\"|-*|*[!0-9a-zA-Z._-]*) exit 0 ;; esac; \
         [ \"${{#SID}}\" -le 256 ] || exit 0; \
         printf \"%s\" \"$SID\" > \"$D/.session_id.$$.tmp\" 2>/dev/null && mv \"$D/.session_id.$$.tmp\" \"$D/session_id\" 2>/dev/null; \
         exit 0 # {AOE_HOOK_MARKER}'"
    )
}

#[cfg(test)]
mod tests {
    use super::*
```

### Core Architecture Module: `src/hooks/config_io.rs`
```
//! Locked, symlink-aware reads and writes of agent config files.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use fs2::FileExt as _;
use serde_json::{Map, Value};

/// How a config write treats a symlink on its path.
///
/// `Follow` is for the user's own host config, where a dotfiles link must
/// survive (#2784, #3186). `Never` is for a directory bind-mounted into a
/// container, where a link is an attempt to redirect the write onto a host file.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SymlinkPolicy {
    Follow,
    Never,
}

impl SymlinkPolicy {
    /// The content to merge into, or `None` when absent. Under `Never` anything
    /// but a regular file reads as absent, checked and read on one `O_NOFOLLOW` fd.
    pub(crate) fn read(self, path: &Path) -> Result<Option<String>> {
        match self {
            Self::Follow => match std::fs::read_to_string(path) {
                Ok(content) => Ok(Some(content)),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
                Err(e) => Err(e).with_context(|| format!("reading {}", path.display())),
            },
            Self::Never => {
                let (dir, name) = split_in_bind(path)?;
                crate::session::read_file_no_follow(dir, Path::new(name))
            }
        }
    }

    pub(super) fn write(self, path: &Path, content: &[u8]) -> Result<()> {
        match self {
            Self::Follow => write_file(path, content),
            Self::Never => {
                let (dir, name) = split_in_bind(path)?;
                crate::session::replace_file_no_follow(dir, Path::new(name), content)
            }
        }
    }

    /// Resolving the chain keeps two writers to one dotfile target on one lock;
    /// under `Never` resolving would move the lock outside the bind.
    pub(super) fn lock_path(self, path: &Path) -> Result<PathBuf> {
        match self {
            Self::Follow => crate::session::resolve_symlink_chain(path),
            Self::Never => Ok(path.to_path_buf()),
        }
    }
}

/// The bind root is the directory AoE owns and the file sits directly in it.
fn split_in_bind(path: &Path) -> Result<(&Path, &std::ffi::OsStr)> {
    let dir = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("{} has no parent", path.display()))?;
    let name = path
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("{} has no file name", path.display()))?;
    Ok((dir, name))
}

/// Creates the parent directory, then atomically replaces the file.
pub(super) fn write_file(path: &Path, content: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    crate::session::atomic_write(path, content)
}

pub(super) fn write_json(path: &Path, value: &Value) -> Result<()> {
    write_file(path, serde_json::to_string_pretty(value)?.as_bytes())
}

/// Parses a JSON config, treating malformed content as empty so a torn file
/// cannot block a launch.
pub(super) fn parse_json_or_empty(content: Option<String>, path: &Path) -> Value {
    let Some(content) = content else {
        return serde_json::json!({});
    };
    serde_json::from_str(&content).unwrap_or_else(|e| {
        tracing::warn!(target: "hooks.install", "Failed to parse {}: {}", path.display(), e);
        serde_json::json!({})
    })
}

/// The object at `key`, replacing a missing or non-object value.
pub(super) fn object_at<'a>(
    map: &'a mut Map<String, Value>,
    key: &str,
) -> &'a mut Map<String, Value> {
    let value = map.entry(key).or_insert_with(|| Value::Object(Map::new()));
    if !value.is_object() {
        *value = Value::Object(Map::new());
    }
    value.as_object_mut().expect("ensured object above")
}

pub(super) fn log_unchanged(path: &Path) {
    tracing::debug!(target: "hooks.install",
        "AoE hooks in {} already up to date; skipping write", path.display());
}

pub(super) fn log_installed(path: &Path) {
    tracing::info!(target: "hooks.install", "Installed AoE hooks in {}", path.display());
}

pub(super) fn log_removed(path: &Path) {
    tracing::info!(target: "hooks.uninstall", "Removed AoE hooks from {}", path.display());
}

pub(super) fn with_config_lock<T>(
    path: &Path,
    lock_extension: &str,
    f: impl FnOnce() -> Result<T>,
) -> Result<T> {
    with_config_lock_policy(path, lock_extension, SymlinkPolicy::Follow, f)
}

/// Holds an exclusive `flock` on `<path>.<lock_extension>` while `f` runs, so
/// concurrent installers cannot interleave a stale read with a write. Under
/// `Never` the lock file is opened `O_NOFOLLOW`, so a planted link fails the write.
pub(crate) fn with_config_lock_policy<T>(
    path: &Path,
    lock_extension: &str,
    policy: SymlinkPolicy,
    f: impl FnOnce() -> Result<T>,
) -> Result<T> {
    use std::os::unix::fs::OpenOptionsExt;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let lock_path = path.with_extension(lock_extension);
    let mut options = std::fs::OpenOptions::new();
    options
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .mode(0o600);
    if policy == SymlinkPolicy::Never {
        options.custom_flags(libc::O_NOFOLLOW);
    }
    let lock_file = options
        .open(&lock_path)
        .with_context(|| format!("Failed to open config lock {}", lock_path.display()))?;

    lock_file
        .lock_exclusive()
        .with_context(|| format!("Failed to lock config {}", path.display()))?;

    let result = f();
    let unlock_result = fs2::FileExt::unlock(&lock_file);
    match (result, unlock_result) {
        (Ok(value), Ok(())) => Ok(value),
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => {
            Err(error).with_context(|| format!("Failed to unlock {}", lock_path.display()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_is_released_when_the_closure_panics() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("panicky.json");
        let panicked = std::panic::catch_unwind(|| {
            with_config_lock(&target, "json.lock", || -> Result<()> { panic!("boom") })
        });
        assert!(panicked.is_err());
        let started = std::time::Instant::now();
        with_config_lock(&target, "json.lock", || Ok(())).unwrap();
        assert!(started.elapsed() < std::time::Duration::from_millis(500));
    }
}

```

### Core Architecture Module: `src/hooks/dir_guard.rs`
```
//! Hardened access to the AoE hook status directory, the single Rust entry
//! point for every read, write, and cleanup under `/tmp/aoe-hooks-<euid>`
//! (#1844).
//!
//! The base directory is created `0o700`, opened with `O_DIRECTORY |
//! O_NOFOLLOW`, then verified by `fstat` on the resulting fd, which pins the
//! inode against a later path swap: wrong type, wrong uid, or any group or
//! world bit rejects. That verified `OwnedFd` is cached, and every
//! per-instance subdirectory and file rides `*at` calls anchored on it. A
//! failure caches the error rather than retrying, so a bad state stays
//! visible.
//!
//! The euid suffix keeps two users on a shared host from colliding. A
//! squatter owning the path first, a `/tmp` reaper unlinking it while the fd
//! is held, or an operator-widened POSIX ACL (only mode bits are verified)
//! each degrade to hooks disabled and pane detection, never to escalation:
//! an alien uid cannot `setfacl` on a `0o700` directory we own.

use std::fs::Metadata;
use std::os::fd::{AsFd, BorrowedFd, OwnedFd};
use std::path::PathBuf;
use std::sync::Arc;
#[cfg(not(test))]
use std::sync::OnceLock;

#[cfg(test)]
use std::os::fd::AsRawFd;

use anyhow::{anyhow, bail, Context, Result};
use nix::errno::Errno;
use nix::fcntl::{open, openat, renameat, OFlag};
use nix::libc;
use nix::sys::stat::{fstat, mkdirat, Mode};
use nix::unistd::{geteuid, mkdir, unlinkat, UnlinkatFlags};

// Path resolution.

#[cfg(test)]
thread_local! {
    /// Test-only base path override. A test using it must also call
    /// `reset_for_test` and serialize via `serial_test::serial(hook_base)`.
    static HOOK_BASE_OVERRIDE: std::cell::RefCell<Option<PathBuf>> =
        const { std::cell::RefCell::new(None) };
}

/// Per-user host base path. The suffix is `geteuid()`, not `getuid()`: the
/// agent writes through `id -u`, so both ends agree.
pub(crate) fn hook_base_path() -> PathBuf {
    #[cfg(test)]
    {
        if let Some(p) = HOOK_BASE_OVERRIDE.with(|c| c.borrow().clone()) {
            return p;
        }
    }
    PathBuf::from(format!("/tmp/aoe-hooks-{}", geteuid().as_raw()))
}

#[cfg(test)]
pub(crate) fn override_base_for_test(path: PathBuf) {
    HOOK_BASE_OVERRIDE.with(|c| *c.borrow_mut() = Some(path));
}

#[cfg(test)]
pub(crate) fn clear_base_override_for_test() {
    HOOK_BASE_OVERRIDE.with(|c| *c.borrow_mut() = None);
}

// Singleton cell.

type CachedBase = std::result::Result<OwnedFd, Arc<anyhow::Error>>;

// `static` so the owned fd lives for the program lifetime and its `close` on
// drop never fires; `with_hook_base` only lends it for a closure call.
#[cfg(not(test))]
static HOOK_BASE: OnceLock<CachedBase> = OnceLock::new();

#[cfg(test)]
thread_local! {
    /// Per-thread shadow of `HOOK_BASE`, since a test cannot reset a
    /// process-wide `OnceLock`. Production never touches it.
    static HOOK_BASE_TEST_CELL: std::cell::RefCell<Option<CachedBase>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
pub(crate) fn reset_for_test() {
    HOOK_BASE_TEST_CELL.with(|c| *c.borrow_mut() = None);
    OPEN_CALLS.store(0, std::sync::atomic::Ordering::Relaxed);
}

// Syscall counter the caching tests read. Production never observes it.
#[cfg(test)]
static OPEN_CALLS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

#[cfg(test)]
pub(crate) fn open_calls() -> usize {
    OPEN_CALLS.load(std::sync::atomic::Ordering::Relaxed)
}

#[cfg(test)]
fn cached_get_or_init_apply<I, A, T>(init: I, apply: A) -> Result<T>
where
    I: FnOnce() -> std::result::Result<OwnedFd, Arc<anyhow::Error>>,
    A: FnOnce(&std::result::Result<OwnedFd, Arc<anyhow::Error>>) -> Result<T>,
{
    // The `borrow_mut` is held for the whole call, so a closure that
    // re-enters `with_hook_base` would panic with `BorrowMutError`.
    HOOK_BASE_TEST_CELL.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            *slot = Some(init());
        }
        apply(slot.as_ref().unwrap())
    })
}

#[cfg(not(test))]
fn cached_get_or_init_apply<I, A, T>(init: I, apply: A) -> Result<T>
where
    I: FnOnce() -> std::result::Result<OwnedFd, Arc<anyhow::Error>>,
    A: FnOnce(&std::result::Result<OwnedFd, Arc<anyhow::Error>>) -> Result<T>,
{
    apply(HOOK_BASE.get_or_init(init))
}

/// Open and verify the per-user hook base directory once, then run `f` with
/// a borrowed fd to it; later callers reuse the cached fd or cached error.
/// The closure shape is what keeps the fd from escaping its borrow.
pub(crate) fn with_hook_base<F, T>(f: F) -> Result<T>
where
    F: FnOnce(BorrowedFd<'_>) -> Result<T>,
{
    cached_get_or_init_apply(
        || match open_and_verify_base() {
            Ok(fd) => Ok(fd),
            Err(e) => {
                tracing::error!(
                    target: "hooks.guard",
                    "hook base init failed: {e:#}. AoE will fall back to pane-detection. \
                     Recover: rm -rf {}",
                    hook_base_path().display()
                );
                Err(Arc::new(e))
            }
        },
        |entry| match entry {
            Ok(fd) => f(fd.as_fd()),
            Err(e) => Err(anyhow!("{e:#}")),
        },
    )
}

fn open_and_verify_base() -> Result<OwnedFd> {
    #[cfg(test)]
    OPEN_CALLS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    let path = hook_base_path();

    // 1. mkdir(0o700) tolerating EEXIST.
    match mkdir(&path, Mode::S_IRWXU) {
        Ok(()) => {}
        Err(Errno::EEXIST) => {}
        Err(e) => {
            return Err(e).with_context(|| format!("mkdir {}", path.display()));
        }
    }

    // 2. open(O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC | O_RDONLY). O_NOFOLLOW
    //    checks only the final component, so a prefix symlink such as macOS
    //    /tmp -> /private/tmp is still followed.
    let fd: OwnedFd = open(
        &path,
        OFlag::O_DIRECTORY | OFlag::O_NOFOLLOW | OFlag::O_CLOEXEC | OFlag::O_RDONLY,
        Mode::empty(),
    )
    .with_context(|| {
        format!(
            "open hook base {} refused (symlink or non-directory). Recover: rm -rf {}",
            path.display(),
            path.display()
        )
    })?;

    // 3. fstat on the fd, which pins the inode for the fd's lifetime.
    verify_dir_metadata(&fd, &path)?;

    Ok(fd)
}

/// Common verification: `S_IFDIR`, owned by euid, no group/other bits.
fn verify_dir_metadata(fd: &OwnedFd, label: &std::path::Path) -> Result<()> {
    let st = fstat(fd).with_context(|| format!("fstat {}", label.display()))?;
    let euid = geteuid().as_raw();
    let mode = st.st_mode & 0o7777;
    if (st.st_mode & libc::S_IFMT) != libc::S_IFDIR {
        bail!("{} is not a directory", label.display());
    }
    if st.st_uid != euid {
        bail!(
            "{} owned by uid={}, expected euid={}. Recover: rm -rf {} (or wait for owner to log out)",
            label.display(),
            st.st_uid,
            euid,
            label.display()
        );
    }
    if mode & 0o077 != 0 {
        bail!(
            "{} mode {:o} permits group/world access (expected 0o700). Recover: rm -rf {}",
            label.display(),
            mode,
            label.display()
        );
    }
    if mode & 0o7000 != 0 {
        bail!(
            "{} mode {:o} has setuid/setgid/sticky bits set (expected 0o700). \
             We never set these on hook directories; presence indicates a hostile \
             or misconfigured pre-creation. Recover: rm -rf {}",
            label.display(),
            mode,
            label.display()
        );
    }
    Ok(())
}

// Per-instance.

/// `mkdirat(base, id, 0o700)` (EEXIST-tolerant) plus `openat(O_NOFOLLOW)` plus
/// `fstat`-on-fd uid/mode check. Returns an owned fd to the per-instance
/// directory.
pub(crate) fn open_instance_dir(instance_id: &str) -> Result<OwnedFd> {
    crate::session::validate_instance_id(instance_id)?;
    with_hook_base(|base| {
        match mkdirat(base, instance_id, Mode::S_IRWXU) {
            Ok(()) | Err(Errno::EEXIST) => {}
            Err(e) => {
                return Err(e).with_context(|| format!("mkdirat {instance_id}"));
            }
        }
        let fd: OwnedFd = openat(
            base,
            instance_id,
            OFlag::O_DIRECTORY | OFlag::O_NOFOLLOW | OFlag::O_CLOEXEC | OFlag::O_RDONLY,
            Mode::empty(),
        )
        .with_context(|| format!("openat instance subdir {instance_id} (symlink or non-dir)"))?;
        let label = hook_base_path().join(instance_id);
        verify_dir_metadata(&fd, &label)?;
        Ok(fd)
    })
}

/// Read-only variant: never creates the dir. Returns `Ok(None)` on `ENOENT` /
/// `ELOOP` (legitimate transient absence or hostile symlink swap, both
/// indistinguishable from "no hook fired yet" on the polling path).
pub(crate) fn open_instance_dir_read_only(instance_id: &str) -> Result<Option<OwnedFd>> {
    crate::session::validate_instance_id(instance_id)?;
    with_hook_base(|base| {
        open_instance_child(base, instance_id, &hook_base_path().join(instance_id))
    })
}

pub(crate) fn open_recorded_instance_dir(
    instance_id: &str,
    directory: &std::path::Path,
) -> Result<Option<OwnedFd>> {
    crate::session::validate_instance_id(instance_id)?;
    anyhow::ensure!(
        directory.file_name() == Some(std::ffi::OsStr::new(instance_id)),
        "recorded hook directory does not belong to this instance"
    );
    let parent = directory
        .parent()
        .context("recorded hook directory has no parent")?;
    let base = open(
        parent,
        OFlag::O_DIRECTORY | OFlag::O_NOFOLLOW | OFlag::O_CLOEXEC | OFlag::O_RDONLY,
        Mode::empty(),
    )?;
    verify_dir_metadata(&base, parent)?;
    open_instance_child(base.as_fd(), instance_id, directory)
}

fn open_instance_child(
    base: BorrowedFd<'_>,
    instance_id: &str,
    label: &std::path::Path,
) -> Result<Option<OwnedFd>> {
    match openat(
        base,
        instance_id,
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4263** (2026-10-02): **Podman sandbox stuck in `stopping` after `aoe serve` restarts under systemd**
  *Symptoms*: ### What happened?  ### Summary  I run `aoe serve` as a **systemd user unit** and use **rootless Podman** for sandboxes. Restarting the service kills the `conmon` process of every sandbox container that service started. The containers keep running without a monitor. The next time aoe stops one, Podman leaves it in the `stopping` state for good: no process is left to write the exit file. Every later `podman start` then fails, so the session can't be resumed:  ``` ERROR containers.runtime: start failed error=Failed to start container: Error: unable to start container "7b50187d…": container 7b50187d… must be in Created or Stopped state to be started: container state improper ERROR http.request: completed … method=POST path=/api/sessions/{id}/acp/spawn status=500 ```  ### Root cause  systemd sets `INVOCATION_ID` for every service it runs. `aoe serve` inherits it and passes it on to each `podman` it runs. Podman then skips creating a separate `libpod-conmon-<id>.scope` for conmon, because it assumes it is running as a service and that conmon belongs in the service's cgroup. From podman v4.9.3, `libpod/oci_conmon_linux.go`:  ```go // $INVOCATION_ID is set by systemd when running as a service. if ctr.runtime.RemoteURI() == "" && os.Getenv("INVOCATION_ID") != "" {     mustCreateCgroup = false } ```  So conmon stays in `aoe.service`'s cgroup. When the unit is stopped or restarted (default `KillMode=control-group`), systemd kills conmon. The container's own processes are in `libpod-<id

- **Issue #4226** (2026-10-01): **Bug report form name does not meet GitHub's minimum length**
  *Symptoms*: ### What happened?  Post-merge follow-up to [#4188](https://github.com/agent-of-empires/agent-of-empires/pull/4188#discussion_r4148371359), P2.  The [bug form](https://github.com/agent-of-empires/agent-of-empires/blob/ad8f4433d01b858705453ea4504cb2a4cb00a50f/.github/ISSUE_TEMPLATE/bug.yml#L1) declares `name: Bug` (three characters). [GitHub documents](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository#creating-issue-forms) that the name must exceed three characters; otherwise the form is not shown. With [blank issues disabled](https://github.com/agent-of-empires/agent-of-empires/blob/ad8f4433d01b858705453ea4504cb2a4cb00a50f/.github/ISSUE_TEMPLATE/config.yml#L1) and the generic templates removed, ordinary contributors lose the intended bug-report entry point, although other categories remain available.  **Reproduction / verification:**  1. Sign in with a contributor account without repository write access. 2. Open [the issue chooser](https://github.com/agent-of-empires/agent-of-empires/issues/new/choose). 3. Check whether a bug-report form is offered.  **Expected:** the bug-report form is selectable and opens successfully. **Documented outcome:** `Bug` is omitted because its name is too short. This is supported by the current configuration and GitHub's documentation, not an independently observed UI reproduction.  **Fix and acceptance:** rename the form to `Bug report`; verify it a

- **Issue #4111** (2026-09-25): **Preserve failed Pi transcript-path observations during poller shutdown**
  *Symptoms*: ## Problem  The Pi poller retains an unacknowledged transcript-path observation after a failed write during normal draining, but shutdown performs only one final drain and then discards the poller. If that final path write fails, the pending path can be lost even though the session ID was stored. A later app restart may lack the transcript locator needed to resume that conversation.  ## Reproduction scenario  With isolated storage, give a Pi session an already-persisted ID and a poller observation carrying its matching transcript path, with no other copy of the path. Inject a storage failure for that path write during `stop_and_flush_poller`, then clear the failure and inspect the row. Expected: the observation remains retryable or the path is durably stored before the poller is discarded. Source-traced outcome: the one final drain leaves the path unacknowledged, then `session_id_poller` becomes `None`. This shutdown sequence has not been executed locally.  ## Evidence  - [Shutdown path](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/polling.rs#L701-L715) drains once and drops the poller regardless of the outcome. - [Path write](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/identity_sidecar.rs#L270-L307) returns false on storage failure; [drain logic](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47c

- **Issue #4109** (2026-09-30): **Reject no-revive prompts for workerless rate-limit parks**
  *Symptoms*: ## Problem  A workerless rate-limit park can bypass the daemon's `no_revive` refusal. On `main` at `be309177`, the prompt handler rejects only `Queued(WorkerDown)`. The dispatch table can instead return `Queued(TurnActive)` for a parked session whose worker has stopped before the `Stopped` event is persisted. A constrained `aoe send --no-revive` can then return success and enqueue a prompt for a dead worker.  ## Reproduction scenario  With isolated app state, persist `RateLimit` for an active ACP turn, terminate the worker before its `Stopped` event is persisted, then send a new prompt with `--no-revive`.  Expected: reject the request without enqueueing or waking a worker. Source-traced outcome: the persisted park and active-turn latch select `Queued(TurnActive)`; the `WorkerDown`-only guard does not reject it. This race has not been reproduced locally.  ## Evidence  - [Prompt admission guard](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/acp/prompt.rs#L91-L118) rejects only `WorkerDown`. - [Dispatch table](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/dispatch.rs#L178-L189) selects `TurnActive` for a parked, latched turn. - [Event ordering](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/acp_client/connection/prompt.rs#L310-L324) emits `RateLimit` before [`Stopped`](https://github.com/agent

- **Issue #4108** (2026-09-24): **Allow partial workspace deletion to preserve a dirty shared worktree**
  *Symptoms*: ## Problem  `DELETE /api/workspaces` accepts a subset of sessions and promises to preserve a worktree still used by an unselected session. On `main` at `be309177`, its early dirty-worktree preflight runs before the shared-use guard. A dirty checkout that must be preserved therefore returns 409 and prevents deletion of the selected session row. This P2 follow-up remains after merged PR #4095.  ## Reproduction scenario  Create two sessions in one managed workspace; select only the owner for deletion and leave the other session using the same worktree. Modify a file in that worktree. Send `DELETE /api/workspaces` with `session_ids` containing only the owner, `delete_worktree=true`, and `force_delete=false`.  **Expected:** remove the selected session record, preserving the dirty worktree and its branch for the unselected session. **Actual, source-traced:** the endpoint returns `409 dirty_worktree` before the preservation decision. This scenario has not been executed locally.  ## Evidence  - [Subset-delete contract](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/sessions/delete.rs#L534-L538). - [Early dirty preflight](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/sessions/delete.rs#L786-L800) and [later authoritative dirty check](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/sessio

- **Issue #4106** (2026-09-25): **OMP macOS failure-injection test inherits its control variables**
  *Symptoms*: ## Problem  The test-only write-failure shim introduced by merged PR #4080 uses `breadcrumb_tmp`, `marker_tmp`, and `write_count` to select the injected write. Its child process inherits those names from the runner environment. On `main` at `be309177`, a pre-set `marker_tmp` suppresses injection; a pre-set `breadcrumb_tmp` can spend the selected write before the breadcrumb path, allowing a false pass. This is P3 test reliability, not a production-path defect.  ## Reproduction scenario  Run `omp_launch_wrapper_preserves_known_breadcrumb_extras_and_rejects_invalid_ones` in an isolated environment with `marker_tmp=preexisting`; the shim skips the selected write while the test still expects its failure marker. Also test with `breadcrumb_tmp=preexisting` and `marker_tmp` unset; the earlier routing-fingerprint `printf` can consume the injection. These scenarios are source-traced, not locally executed.  ## Evidence  - [Shim guard](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/omp.rs#L840-L855) reads inherited shell variables. - [Test child](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/omp.rs#L938-L963) removes `AOE_TEST_FAIL_WRITE` but not those variables; the [test's environment guard](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/omp.rs#L823-L829) clears only st

- **Issue #4105** (2026-10-04): **ACP: abort the prompt waiter when completion-marker relay fails**
  *Symptoms*: ## Problem  Merged PR #4103 moves a local prompt's oneshot sender from `completion` into `settled` before writing its completion marker to the ACP crate. If that write fails, reader teardown clears only `completion`; the sender remains held in `settled` while `DaemonControlClient` lives, so the waiter need not resolve as aborted. This is still present on `main` at `be309177`.  ## Reproduction scenario  In an isolated control-client test, start a local prompt and deliver a matching runner `PromptCompleted`. Close or fail the crate-side shim write after the outcome is stored in `settled`, before the marker is written; keep the client handle alive.  **Expected:** transport failure drops the sender and the prompt receiver resolves as aborted. **Actual, source-traced:** the reader returns, but `settled` retains the sender and the receiver can remain pending. This failure window has not been executed locally.  ## Evidence  - [Outcome storage and failed-write return](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/acp_client/control.rs#L412-L421). - [Reader teardown](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/acp_client/control.rs#L521-L525) resets `completion`, not `settled`. - [CodeRabbit's original review comment](https://github.com/agent-of-empires/agent-of-empires/pull/4103#discussion_r4093752644). This is distinct from the agent-marker provenance problem i
  **Post-Mortem & Fix Analysis**:
  > Resolved by #4177, retained on main at 6a42d96e. A failed relay now releases the settled sender without dropping the client; an already-relayed outcome remains deliverable after runner hangup. CI passed the three targeted regressions: failed_marker_relay_aborts_the_waiter_without_dropping_the_client, failed_relay_after_a_relayed_marker_aborts_the_waiter, and runner_hangup_still_delivers_a_relayed_outcome. Validation: https://github.com/agent-of-empires/agent-of-empires/actions/runs/36571146425.
  > Fixed by #4177 (merged 2026-09-29, commit `3d66a0a85`).  The settled sender is dropped on any reader relay failure via `release_settled` / `shim_write_line_releasing`, so a local prompt waiter aborts instead of pending on the connection handle.  Verified present in `upstream/main`: `src/acp/acp_client/control.rs`.

- **Issue #4104** (2026-09-30): **ACP: reject agent-supplied prompt completion markers**
  *Symptoms*: ## Problem  After merged PR #4103, the local-prompt outcome is released when the ACP crate handles `_aoe/prompt_completed`. The runner forwards an agent-originated notification with that reserved method. A forged marker can therefore release the outcome before an earlier usage update is applied, defeating the rate-limit reset ordering fix. This is a source-traced conditional path on `main` at `be309177`; I have not observed a supported agent emitting this method.  ## Reproduction scenario  In an isolated runner/control test, block the crate while it applies an earlier session update. Have the agent emit `{"jsonrpc":"2.0","method":"_aoe/prompt_completed","params":{}}`, then a `usage_update` containing a rate-limit reset, then the real prompt response. Let the control reader queue these frames and store the real outcome before releasing the blocked handler.  **Expected:** only the daemon-minted marker releases the prompt after the usage update is applied. **Actual, source-traced:** the forged marker is handled first and takes the stored outcome; rate-limit classification can again see no reset.  ## Evidence  - [Runner ingress](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/process/runner/shared.rs#L331-L340) filters `_aoe/session_replayed` but forwards other agent notification methods. - [ACP ingress](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/acp_client/sessi

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

### Incident Patch 1: `d4745f24` (2026-10-04)
**Commit Message**: fix(acp-client): step up an unelevated passphrase session on demand (#4304)

**File**: `src/acp/client/http.rs` (modified, +70/-3)
```diff
@@ -146,12 +146,32 @@ impl HttpClient {
         scope: Scope<'_>,
     ) -> Result<reqwest::Response, HttpError> {
         let res = self.send_authed(build).await?;
+        finish(res, scope).await
+    }
+
+    /// Like `send`, but retries once after a passphrase step-up if the
+    /// daemon reports `elevation_required`: plugin-mutation endpoints
+    /// (enable/disable, worker restart) require an elevated session whenever
+    /// the caller isn't loopback-trusted (e.g. a passphrase daemon reached
+    /// behind a proxy, or a remote one reached directly), and nothing else
+    /// in the CLI ever re-confirms the passphrase on its own.
+    async fn send_elevated(
+        &self,
+        build: impl Fn() -> reqwest::RequestBuilder,
+        scope: Scope<'_>,
+    ) -> Result<reqwest::Response, HttpError> {
+        let res = self.send_authed(&build).await?;
         let status = res.status();
         if status.is_success() {
             return Ok(res);
         }
         let body = res.text().await.unwrap_or_default();
-        Err(classify_error(status, &body, scope))
+        if !is_elevation_required(status, &body) {
+            return Err(classify_error(status, &body, scope));
+        }
+        passphrase_session::elevate(&self.endpoint, &self.passphrase_session).await?;
+        let res = self.send_authed(&build).await?;
+        finish(res, scope).await
     }
 
     async fn get_json<T: DeserializeOwned>(
@@ -345,7 +365,7 @@ impl HttpClient {
     ) -> Result<(), HttpError> {
         let path = format!("/api/plugins/{plugin_id}/enabled");
         let body = serde_json::json!({ "enabled": enabled });
-        self.send(
+        self.send_elevated(
             || self.request(Method::POST, &path).json(&body),
             Scope::Global,
         )
@@ -356,7 +376,7 @@ impl HttpClient {
     /// Reload plugins from disk and replace this plugin's worker.
     pub async fn restart_plugin_worker(&self, plugin_id: &str) -> Result<(), HttpError> {
         let path = format!("/api/plugins/{plugin_id}/worker/restart");
-        self.send(|| self.request(Method::POST, &path), Scope::Global)
+        self.send_elevated(|| self.request(Method::POST, &path), Scope::Global)
             .await?;
         Ok(())
     }
@@ -606,6 +626,28 @@ impl HttpClient {
     }
 }
 
+async fn finish(res: reqwest::Response, scope: Scope<'_>) -> Result<reqwest::Response, HttpError> {
+    let status = res.status();
+    if status.is_success() {
+        return Ok(res);
+    }
+    let body = res.text().await.unwrap_or_default();
+    Err(classify_error(status, &body, scope))
+}
+
+/// Whether a 403 names the `elevation_required` error: a plugin-mutation
+/// endpoint's signal that the caller is logged in but has not step-up
+/// confirmed the passphrase within the last 15 minutes (`src/server/login.rs`
+/// `ELEVATION_LIFETIME`). Checks the `error` field rather than substring
+/// matching so an unrelated body mentioning the same word never misfires.
+fn is_elevation_required(status: StatusCode, body: &str) -> bool {
+    status == StatusCode::FORBIDDEN
+        && serde_json::from_str::<serde_json::Value>(body)
+            .ok()
+            .and_then(|v| v.get("error")?.as_str().map(|e| e == "elevation_required"))
+            .unwrap_or(false)
+}
+
 fn classify_error(status: StatusCode, body: &str, scope: Scope<'_>) -> HttpError {
     match (status, scope) {
         (StatusCode::UNAUTHORIZED, _) => HttpError::Unauthorized,
@@ -817,4 +859,29 @@ mod tests {
         let rendered = HttpError::Unauthorized.to_string();
         assert!(!rendered.contains("AOE_DAEMON_TOKEN") && rendered.contains("401"));
     }
+
+    #[test]
+    fn is_elevation_required_matches_only_the_named_error_on_403() {
+        assert!(is_elevation_required(
+            StatusCode::FORBIDDEN,
+            r#"{"error":"elevation_required","message":"Re-enter the passphrase to continue"}"#
+        ));
+        // Wrong status, right body shape.
+        assert!(!is_elevation_required(
+            StatusCode::UNAUTHORIZED,
+            r#"{"error":"elevation_required"}"#
+        ));
+        // Right status, different error.
+        assert!(!is_elevation_required(
+            StatusCode::FORBIDDEN,
+            r#"{"error":"read_only","message":"Server is in read-only mode"}"#
+        ));
+        // The substring appears only inside `message`, not as the `error` value.
+        assert!(!is_elevation_required(
+            StatusCode::FORBIDDEN,
+            r#"{"error":"read_only","message":"see elevation_required docs"}"#
+        ));
+        // Malformed body.
+        assert!(!is_elevation_required(StatusCode::FORBIDDEN, "not json"));
+    }
 }
```

**File**: `src/acp/client/passphrase_session.rs` (modified, +54/-4)
```diff
@@ -92,10 +92,7 @@ pub(super) async fn login(
     let status = res.status();
     if !status.is_success() {
         let body = res.text().await.unwrap_or_default();
-        return Err(match status {
-            StatusCode::UNAUTHORIZED => HttpError::Unauthorized,
-            _ => HttpError::Server { status, body },
-        });
+        return Err(map_auth_error(status, body));
     }
     let cookie = extract_session_cookie(res.headers()).ok_or(HttpError::Unauthorized)?;
     let session = PassphraseSession {
@@ -107,6 +104,47 @@ pub(super) async fn login(
     Ok(session)
 }
 
+/// Map a non-success `/api/login` or `/api/login/elevate` response the same
+/// way: a wrong passphrase is `Unauthorized` (mirrors the daemon's own
+/// wording for both endpoints), anything else (rate limiting, a locked-out
+/// session) is a generic server error the caller surfaces verbatim.
+fn map_auth_error(status: StatusCode, body: String) -> HttpError {
+    match status {
+        StatusCode::UNAUTHORIZED => HttpError::Unauthorized,
+        _ => HttpError::Server { status, body },
+    }
+}
+
+/// Confirm the passphrase again against `POST /api/login/elevate`, extending
+/// the *existing* cached session's server-side elevation window. Unlike
+/// `login`, this never mints a new session or cookie and takes no action on
+/// success beyond the daemon's own state change: the next request replays the
+/// same cached cookie, which the daemon now treats as elevated.
+pub(super) async fn elevate(
+    endpoint: &DaemonEndpoint,
+    cache: &PassphraseSessionCache,
+) -> Result<(), HttpError> {
+    let session = cache.get(endpoint).ok_or(HttpError::Unauthorized)?;
+    let passphrase = endpoint
+        .resolved_passphrase()
+        .ok_or(HttpError::Unauthorized)?;
+    let url = format!("{}/api/login/elevate", endpoint.base_url);
+    let body = serde_json::json!({ "passphrase": passphrase });
+    let res = login_client()?
+        .post(&url)
+        .header(header::COOKIE, &session.cookie)
+        .header("X-Aoe-Device-Binding", &session.binding_secret)
+        .json(&body)
+        .send()
+        .await?;
+    let status = res.status();
+    if status.is_success() {
+        return Ok(());
+    }
+    let body = res.text().await.unwrap_or_default();
+    Err(map_auth_error(status, body))
+}
+
 /// A dedicated client for the login POST with redirects disabled: a
 /// misconfigured or hostile daemon at the trusted URL could otherwise
 /// 307/308 the request (which reqwest re-POSTs, body included) to a
@@ -387,4 +425,16 @@ mod tests {
         // rather than binding a new "device" every time a session expires.
         assert!(dir.path().join(DEVICE_BINDING_FILENAME).exists());
     }
+
+    #[test]
+    fn map_auth_error_distinguishes_unauthorized_from_generic() {
+        assert!(matches!(
+            map_auth_error(StatusCode::UNAUTHORIZED, "bad passphrase".into()),
+            HttpError::Unauthorized
+        ));
+        assert!(matches!(
+            map_auth_error(StatusCode::TOO_MANY_REQUESTS, "locked out".into()),
+            HttpError::Server { status, .. } if status == StatusCode::TOO_MANY_REQUESTS
+        ));
+    }
 }
```

**File**: `tests/e2e/serve.rs` (modified, +67/-0)
```diff
@@ -454,6 +454,73 @@ fn cli_acp_prompt_authenticates_against_behind_proxy_passphrase_daemon() {
     prompt_until_accepted(&h, &session_id, Duration::from_secs(30));
 }
 
+/// #4083 follow-up to #3999: a plugin mutation (`aoe plugin enable/disable`,
+/// built on `HttpClient::set_plugin_enabled`) requires an *elevated* session
+/// on top of a merely logged-in one (`src/server/api/plugins.rs::mutation_gate`),
+/// which `--behind-proxy` withdraws the loopback bypass for just like login
+/// itself (`cli_serve_auth_passphrase_behind_proxy_gates_unforwarded_requests`).
+/// The CLI must step up the passphrase again on its own rather than surfacing
+/// the daemon's `elevation_required` 403 verbatim.
+#[test]
+#[parallel]
+#[cfg(feature = "web")]
+fn cli_plugin_enable_disable_steps_up_an_unelevated_passphrase_session() {
+    let mut h = TuiTestHarness::new("plugin_toggle_passphrase_behind_proxy");
+    h.stop_daemon_on_drop();
+    let port = h.start_daemon_with(&[
+        "--auth",
+        "passphrase",
+        "--passphrase",
+        "e2e-pass",
+        "--behind-proxy",
+        "--allowed-host",
+        "aoe.example.test",
+    ]);
+    assert!(
+        wait_for_port(port, Duration::from_secs(10)),
+        "daemon never bound port {port}"
+    );
+
+    let disable = h.run_cli(&["plugin", "disable", "aoe.web"]);
+    let disable_stdout = String::from_utf8_lossy(&disable.stdout);
+    assert!(
+        disable.status.success(),
+        "aoe plugin disable must step up elevation transparently, not surface a 403.\nstdout: {}\nstderr: {}",
+        disable_stdout,
+        String::from_utf8_lossy(&disable.stderr),
+    );
+    assert!(
+        !String::from_utf8_lossy(&disable.stderr).contains("elevation_required"),
+        "the elevation_required 403 must never reach the user: {}",
+        String::from_utf8_lossy(&disable.stderr)
+    );
+    assert!(
+        disable_stdout.contains("the running daemon reconciled its workers."),
+        "aoe plugin disable must actually reach the daemon after stepping up, not fall back to a local toggle: {disable_stdout}"
+    );
+    assert!(
+        !disable_stdout.contains("warning:"),
+        "aoe plugin disable must not fall back to the local-daemon-stale warning: {disable_stdout}"
+    );
+
+    let enable = h.run_cli(&["plugin", "enable", "aoe.web"]);
+    let enable_stdout = String::from_utf8_lossy(&enable.stdout);
+    assert!(
+        enable.status.success(),
+        "aoe plugin enable must step up elevation transparently.\nstdout: {}\nstderr: {}",
+        enable_stdout,
+        String::from_utf8_lossy(&enable.stderr),
+    );
+    assert!(
+        enable_stdout.contains("the running daemon reconciled its workers."),
+        "aoe plugin enable must actually reach the daemon after stepping up, not fall back to a local toggle: {enable_stdout}"
+    );
+    assert!(
+        !enable_stdout.contains("warning:"),
+        "aoe plugin enable must not fall back to the local-daemon-stale warning: {enable_stdout}"
+    );
+}
+
 /// The WS half of the passphrase-login fallback: `aoe acp tail` (and the
 /// TUI's live structured-view stream, same `src/acp/client/ws.rs`) must
 /// offer the literal `aoe-auth` subprotocol alongside
```

---

### Incident Patch 2: `e15431d3` (2026-10-04)
**Commit Message**: fix(plugin): add --yes to plugin update (#4305)

**File**: `docs/cli/reference.md` (modified, +5/-1)
```diff
@@ -908,12 +908,16 @@ Install an external plugin from a `gh:owner/repo[@ref]` slug or a local director
 
 Update an installed external plugin from its recorded source and restart its worker in a running daemon. Prompts to re-approve capabilities if the update changes the capability set
 
-**Usage:** `aoe plugin update <ID>`
+**Usage:** `aoe plugin update [OPTIONS] <ID>`
 
 ###### **Arguments:**
 
 * `<ID>` — Plugin id
 
+###### **Options:**
+
+* `--yes` — Re-approve a changed capability set without prompting
+
 
 
 ## `aoe plugin uninstall`
```

**File**: `docs/plugins.md` (modified, +1/-1)
```diff
@@ -40,6 +40,6 @@ The web dashboard's Plugins settings does the same things, with a marketplace se
 
 Bundled plugins are `builtin` and fully trusted. Installed plugins are `community` and untrusted: the manifest declares the capabilities they need (network, filesystem, spawning processes, and so on) and install prompts once to grant that exact set. `--yes` grants without prompting, and a capability this version does not recognize is rejected rather than granted. An external plugin cannot claim the reserved `aoe.*` or `agent-of-empires.*` id namespace.
 
-A grant is pinned to the installed manifest, so an update that widens what the plugin can do (new capabilities, changed build steps or UI slots, a runtime or trust change) must be approved before it becomes active. Approve with `aoe plugin update <id>`, or in-app: the web and TUI plugin managers show an Update action with a popup describing what changed. Declining keeps the current version and stops the prompt until the next version. Approval is pinned to the exact fetched content, so an update that changed since you reviewed it is refused rather than applied.
+A grant is pinned to the installed manifest, so an update that widens what the plugin can do (new capabilities, changed build steps or UI slots, a runtime or trust change) must be approved before it becomes active. Approve with `aoe plugin update <id>` (`--yes` skips the prompt), or in-app: the web and TUI plugin managers show an Update action with a popup describing what changed. Declining keeps the current version and stops the prompt until the next version. Approval is pinned to the exact fetched content, so an update that changed since you reviewed it is refused rather than applied.
 
 `aoe plugin list` and `aoe plugin info <id>` show each plugin's trust level (`featured`, `community`, or `local`) and whether it is granted.
```

**File**: `src/cli/plugin.rs` (modified, +6/-3)
```diff
@@ -40,6 +40,9 @@ pub enum PluginCommands {
     Update {
         /// Plugin id
         id: String,
+        /// Re-approve a changed capability set without prompting
+        #[arg(long)]
+        yes: bool,
     },
     /// Uninstall an external plugin, removing its files and capability grant
     Uninstall {
@@ -68,7 +71,7 @@ pub async fn run(command: PluginCommands) -> Result<()> {
         PluginCommands::Enable { id } => run_set_enabled(&id, true).await,
         PluginCommands::Disable { id } => run_set_enabled(&id, false).await,
         PluginCommands::Install { source, yes } => run_install(&source, yes).await,
-        PluginCommands::Update { id } => run_update(&id).await,
+        PluginCommands::Update { id, yes } => run_update(&id, yes).await,
         PluginCommands::Uninstall { id } => run_uninstall(&id),
         PluginCommands::Hash { path } => run_hash(&path),
         PluginCommands::Discover { query } => run_discover(query.as_deref()).await,
@@ -205,9 +208,9 @@ async fn run_install(source: &str, yes: bool) -> Result<()> {
     Ok(())
 }
 
-async fn run_update(id: &str) -> Result<()> {
+async fn run_update(id: &str, yes: bool) -> Result<()> {
     use crate::plugin::install::LiveRestart;
-    let report = crate::plugin::install::update(id).await?;
+    let report = crate::plugin::install::update(id, yes).await?;
     print_report(&report, "Updated");
     match crate::plugin::install::restart_worker_live(id).await {
         LiveRestart::Daemon => println!("  the running daemon reloaded the plugin."),
```

**File**: `src/plugin/install.rs` (modified, +17/-9)
```diff
@@ -167,6 +167,7 @@ fn install_validation(featured_verified: bool, source: &str) -> ValidationState
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum ConsentMode {
     Interactive,
+    AssumeYes,
     CleanOnlyNonInteractive,
 }
 
@@ -407,8 +408,13 @@ pub async fn apply_install(
     apply_prepared_install(&prepared, log)
 }
 
-pub async fn update(id: &str) -> Result<InstallReport> {
-    match update_with_consent(id, ConsentMode::Interactive).await? {
+pub async fn update(id: &str, assume_yes: bool) -> Result<InstallReport> {
+    let mode = if assume_yes {
+        ConsentMode::AssumeYes
+    } else {
+        ConsentMode::Interactive
+    };
+    match update_with_consent(id, mode).await? {
         UpdateOutcome::Applied(report) => Ok(report),
         UpdateOutcome::Skipped { id, reason, .. } => {
             bail!("update for {id} was skipped unexpectedly: {reason}")
@@ -618,7 +624,7 @@ fn apply_prepared(
 
 async fn update_with_consent(id: &str, mode: ConsentMode) -> Result<UpdateOutcome> {
     let prepared = prepare_update(id).await?;
-    if mode == ConsentMode::Interactive {
+    if mode != ConsentMode::CleanOnlyNonInteractive {
         eprintln!("{}", prepared.notice);
     }
 
@@ -630,12 +636,14 @@ async fn update_with_consent(id: &str, mode: ConsentMode) -> Result<UpdateOutcom
                 fingerprint: prepared.fingerprint.clone(),
             });
         }
-        if confirm_capabilities(
-            id,
-            &prepared.capabilities,
-            &prepared.fetched.manifest.ui,
-            build_steps(&prepared.fetched.manifest),
-        )? {
+        if mode == ConsentMode::AssumeYes
+            || confirm_capabilities(
+                id,
+                &prepared.capabilities,
+                &prepared.fetched.manifest.ui,
+                build_steps(&prepared.fetched.manifest),
+            )?
+        {
             Some(CapabilityGrant {
                 manifest_hash: prepared.manifest_hash.clone(),
                 capabilities: prepared.capabilities.clone(),
```

**File**: `tests/integration/plugin_install.rs` (modified, +17/-2)
```diff
@@ -928,7 +928,10 @@ command = ["false"]
     )
     .unwrap();
 
-    let err = install::update("acme.upd").await.unwrap_err().to_string();
+    let err = install::update("acme.upd", false)
+        .await
+        .unwrap_err()
+        .to_string();
     assert!(err.contains("build step"), "got: {err}");
 
     // The prior install is intact: directory, artifact, and recorded version.
@@ -1000,7 +1003,7 @@ command = ["cp", "aoe-plugin.toml", "marker-v2"]
 
     // The changed recipe forces a prompt, which bails on non-terminal stdin
     // instead of silently running the new build.
-    let err = install::update("acme.recipe")
+    let err = install::update("acme.recipe", false)
         .await
         .unwrap_err()
         .to_string();
@@ -1020,6 +1023,18 @@ command = ["cp", "aoe-plugin.toml", "marker-v2"]
             .version,
         "0.1.0"
     );
+
+    // `--yes` approves the changed recipe without a prompt.
+    install::update("acme.recipe", true).await.unwrap();
+    assert!(installed.join("marker-v2").exists());
+    assert_eq!(
+        Lockfile::load()
+            .unwrap()
+            .get("acme.recipe")
+            .unwrap()
+            .version,
+        "0.2.0"
+    );
 }
 
 const PLAIN_MANIFEST: &str = r#"
```

---

### Incident Patch 3: `e072bbec` (2026-10-03)
**Commit Message**: feat(tui): carry the selected session's agent, view and sandbox into N (#4268)

* feat(tui): carry the selected session's agent, view and sandbox into N

New from selection copied a session's path and group but opened on the
default agent, so starting another codex session next to one meant
cycling the Tool field and setting the view and sandbox again. On a
session row it now also selects that session's agent and carries its
structured view and sandbox choice. A group row still fills in the group
and a member's path, with nothing session-specific to copy.

Each setting lands only as the form itself would allow it: an agent not
offered here leaves the form on its defaults, an agent without a
structured view stays in the terminal, and a host-only agent or a missing
container runtime stays unsandboxed. Yolo is deliberately not carried:
skipping permissions stays a choice made for each new session, on the
configured default.

The sandbox toggle's environment handling, repeated in both of its key
paths, moves into one helper the new path shares.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AHxrdPGvTCoF5TXAdNvXxx

* fix(tui): spell 

**File**: `src/tips.rs` (modified, +2/-2)
```diff
@@ -66,9 +66,9 @@ static CATALOG: &[Tip] = &[
         id: "new-from-selection",
         title: "Reuse the selected session's settings",
         // `{placeholder}` keys are substituted with the live chord by the tips overlay.
-        body: "Tired of choosing the directory, profile, and group every time? Press \
+        body: "Tired of choosing the directory, profile, agent, and group every time? Press \
                {new_from_selection} on the home view to start a new session that inherits \
-               all of them from the session you have selected.",
+               all of them, with the view and sandbox, from the session you have selected.",
         trigger: TipTrigger::Earned(earned_new_from_selection),
         surfaces: &[TipSurface::Tui],
     },
```

**File**: `src/tui/dialogs/context_menu.rs` (modified, +2/-1)
```diff
@@ -22,7 +22,8 @@ pub enum ContextMenuAction {
     /// Open the new-session dialog (`'n'`).
     NewSession,
     /// New session prefilled from the right-clicked row (`'N'`): a session row
-    /// inherits its repo path and group, a project or group row a member's path.
+    /// inherits its repo path, group, agent and view, and its sandbox when it has
+    /// one; a project or group row a member's path.
     NewFromSelection,
     /// Fork the session into an independent one resuming its conversation.
     Fork,
```

**File**: `src/tui/dialogs/new_session/mod.rs` (modified, +46/-29)
```diff
@@ -627,6 +627,44 @@ impl NewSessionDialog {
         self.reload_tool_config();
     }
 
+    /// Carry a session's agent, view and sandbox, each only as far as this form allows.
+    /// Yolo stays a choice made for each new session.
+    pub fn inherit_session(&mut self, source: &crate::session::Instance) {
+        if !self.available_tools.contains(&source.tool) {
+            return;
+        }
+        self.set_tool(&source.tool);
+        self.inherit_modes(source.is_structured(), source.is_sandboxed());
+    }
+
+    fn inherit_modes(&mut self, structured: bool, sandboxed: bool) {
+        if self.structured_capable {
+            self.structured_enabled = structured;
+            self.structured_choice = Some(structured);
+        }
+        if sandboxed && self.docker_available && !self.selected_tool_host_only() {
+            self.set_sandbox_enabled(true);
+        }
+    }
+
+    /// Switch the sandbox, loading or dropping the environment that goes with it.
+    fn set_sandbox_enabled(&mut self, enabled: bool) {
+        self.sandbox_enabled = enabled;
+        if enabled {
+            let config = self.resolve_config_for_path(&self.profile);
+            self.extra_env = config.sandbox.environment.clone();
+            self.inherited_settings = build_inherited_settings(&config.sandbox);
+            self.extra_env_overridden = false;
+        } else {
+            self.extra_env.clear();
+            self.extra_env_overridden = false;
+            self.env_list_expanded = false;
+            self.env_editing_input = None;
+            self.inherited_settings.clear();
+            self.sandbox_config_mode = false;
+        }
+    }
+
     /// Move focus to the title field, for "new from selection" where the path
     /// is already filled.
     pub fn focus_title(&mut self) {
@@ -643,6 +681,11 @@ impl NewSessionDialog {
         self.group.value()
     }
 
+    #[cfg(test)]
+    pub fn yolo_value(&self) -> bool {
+        self.yolo_mode
+    }
+
     #[cfg(test)]
     pub fn fork_seed(&self) -> Option<&crate::session::ForkSeed> {
         self.fork_seed.as_ref()
@@ -1225,20 +1268,7 @@ impl NewSessionDialog {
                 }
             }
         } else if self.focused_field == fields.sandbox {
-            self.sandbox_enabled = !self.sandbox_enabled;
-            if self.sandbox_enabled {
-                let config = self.resolve_config_for_path(&self.profile);
-                self.extra_env = config.sandbox.environment.clone();
-                self.inherited_settings = build_inherited_settings(&config.sandbox);
-                self.extra_env_overridden = false;
-            } else {
-                self.extra_env.clear();
-                self.extra_env_overridden = false;
-                self.env_list_expanded = false;
-                self.env_editing_input = None;
-                self.inherited_settings.clear();
-                self.sandbox_config_mode = false;
-            }
+            self.set_sandbox_enabled(!self.sandbox_enabled);
         }
     }
 
@@ -1480,20 +1510,7 @@ impl NewSessionDialog {
             KeyCode::Left | KeyCode::Right | KeyCode::Char(' ')
                 if self.focused_field == fields.sandbox =>
             {
-                self.sandbox_enabled = !self.sandbox_enabled;
-                if self.sandbox_enabled {
-                    let config = self.resolve_config_for_path(&self.profile);
-                    self.extra_env = config.sandbox.environment.clone();
-                    self.inherited_settings = build_inherited_settings(&config.sandbox);
-                    self.extra_env_overridden = false;
-                } else {
-                    self.extra_env.clear();
-                    self.extra_env_overridden = false;
-                    self.env_list_expanded = false;
-                    self.env_editing_input = None;
-                    self.inherited_settings.clear();
-                    self.sandbox_config_mode = false;
-                }
+                self.set_sandbox_enabled(!self.sandbox_enabled);
                 DialogResult::Continue
             }
             KeyCode::Left | KeyCode::Right | KeyCode::Char(' ')
@@ -1933,7 +1950,7 @@ impl NewSessionDialog {
 
     fn reload_tool_config(&mut self) {
         let profile = self.selected_profile().to_string();
-        let config = resolve_config_or_warn(&profile);
+        let config = self.resolve_config_for_path(&profile);
         let tool = self
             .available_tools
             .get(self.tool_index)
```

**File**: `src/tui/dialogs/new_session/tests.rs` (modified, +180/-1)
```diff
@@ -1,5 +1,5 @@
 use super::*;
-use crate::session::{merge_configs, Config, ProfileConfig};
+use crate::session::{merge_configs, Config, Instance, ProfileConfig, SandboxInfo, View};
 use crate::tui::dialogs::test_keys::{alt_key, ctrl_key, key, shift_key};
 use crate::tui::dialogs::test_render::find;
 use std::fs;
@@ -1355,3 +1355,182 @@ fn terminal_fork_hides_structured_despite_structured_default() {
     assert!(!dialog.structured_capable);
     assert!(!dialog.structured_enabled);
 }
+
+/// A session on `tool`, sandboxed and in yolo as asked.
+fn source_session(tool: &str, sandboxed: bool, yolo: bool) -> Instance {
+    let mut inst = Instance::new("source", TEST_PATH);
+    inst.tool = tool.to_string();
+    inst.yolo_mode = yolo;
+    if sandboxed {
+        inst.sandbox_info = Some(SandboxInfo {
+            enabled: true,
+            container_id: None,
+            image: "ubuntu:latest".to_string(),
+            container_name: "source".to_string(),
+            extra_env: None,
+            custom_instruction: None,
+            before_start_env: Vec::new(),
+            container_workdir: None,
+        });
+    }
+    inst
+}
+
+/// "New from selection" on a session carries its agent and sandbox into the form. Yolo
+/// follows the configured default whatever the source ran with.
+#[test]
+#[serial_test::serial]
+fn a_selected_session_carries_its_agent_and_modes() {
+    let temp_home = tempfile::tempdir().expect("temp home");
+    let _home = crate::session::test_support::isolate_home(temp_home.path());
+    let mut dialog = multi_tool_dialog();
+    dialog.docker_available = true;
+    assert_eq!(dialog.selected_tool(), "claude");
+    assert!(!dialog.sandbox_enabled);
+
+    dialog.inherit_session(&source_session("opencode", true, true));
+    assert_eq!(dialog.selected_tool(), "opencode");
+    assert!(dialog.sandbox_enabled);
+    assert!(!dialog.yolo_mode, "a yolo source does not turn yolo on");
+
+    // An unsandboxed source never switches a profile's sandbox off: with yolo on by
+    // default that would launch an unsandboxed yolo agent on the host.
+    let mut dialog = multi_tool_dialog();
+    dialog.docker_available = true;
+    dialog.sandbox_enabled = true;
+    dialog.yolo_mode_default = true;
+    dialog.inherit_session(&source_session("opencode", false, false));
+    assert_eq!(dialog.selected_tool(), "opencode");
+    assert!(dialog.sandbox_enabled, "the sandbox default stays on");
+    assert!(
+        dialog.yolo_mode,
+        "nor does a cautious source turn the yolo default off"
+    );
+}
+
+/// The view follows the source session where the agent can back a structured one, over the
+/// configured default in either direction.
+#[test]
+#[serial_test::serial]
+fn a_selected_session_carries_its_view() {
+    let temp_home = tempfile::tempdir().expect("temp home");
+    let _home = crate::session::test_support::isolate_home(temp_home.path());
+    let app_dir = crate::session::get_app_dir().expect("app dir");
+    fs::create_dir_all(app_dir.join("profiles").join("default")).expect("default profile");
+    fs::write(
+        app_dir.join("config.toml"),
+        "[acp]\noffer_structured_in_new_session = true\n",
+    )
+    .expect("global config");
+
+    for (default_structured, source_view) in [(true, View::Terminal), (false, View::Structured)] {
+        let mut dialog = multi_tool_dialog();
+        dialog.reload_tool_config();
+        dialog.structured_default = default_structured;
+        let mut source = source_session("claude", false, false);
+        source.view = source_view;
+        dialog.inherit_session(&source);
+        assert!(
+            dialog.structured_capable,
+            "claude can back a structured view"
+        );
+        let structured = source_view == View::Structured;
+        assert_eq!(dialog.structured_enabled, structured, "{source_view:?}");
+        assert_eq!(
+            dialog.structured_choice,
+            Some(structured),
+            "{source_view:?}"
+        );
+    }
+}
+
+/// The carried agent's structured capability comes from the repo config at the form's path,
+/// as it does for the agent the form opened on, so a repo's `agent_detect_as` still counts.
+#[test]
+#[serial_test::serial]
+fn a_carried_agent_is_judged_by_the_repo_config() {
+    let temp_home = tempfile::tempdir().expect("temp home");
+    let _home = crate::session::test_support::isolate_home(temp_home.path());
+    let app_dir = crate::session::get_app_dir().expect("app dir");
+    fs::create_dir_all(app_dir.join("profiles").join("default")).expect("default profile");
+    fs::write(
+        app_dir.join("config.toml"),
+        "[acp]\noffer_structured_in_new_session = true\n",
+    )
+    .expect("global config");
+    let repo = tempfile::tempdir().expect("repo");
+    fs::create_dir_all(repo.path().join(".agent-of-empires")).expect("repo config dir");
+    fs::write(
+        repo.path().join(".agent-of-empires").join("config.toml"),
+        "[
```

**File**: `src/tui/home/input.rs` (modified, +8/-0)
```diff
@@ -2914,6 +2914,14 @@ impl HomeView {
             if let Some(group) = prefill_group {
                 dialog.set_group(group);
             }
+            // After the path: setting it re-resolves the defaults these replace.
+            if let Some(inst) = self
+                .selected_session
+                .as_ref()
+                .and_then(|id| self.get_instance(id))
+            {
+                dialog.inherit_session(inst);
+            }
             // Skip to the title whenever the path is genuinely prefilled, inherited or
             // borrowed, so the user lands on naming. Only an empty group leaves focus on
             // the default cwd to be confirmed.
```

**File**: `src/tui/home/tests/render_and_save.rs` (modified, +42/-0)
```diff
@@ -702,6 +702,48 @@ fn test_shift_n_opens_prefilled_dialog_from_session() {
     assert_eq!(dialog.group_value(), "work");
 }
 
+/// `N` on a session copies its agent as well as its path and group, but never its yolo; on a
+/// group row there is no session to copy from, so the form keeps its defaults.
+#[test]
+#[serial]
+fn test_shift_n_carries_the_selected_sessions_agent_but_not_its_yolo() {
+    let mut codex = instance_in("work-project", "/tmp/work", "work");
+    codex.tool = "codex".to_string();
+    codex.yolo_mode = true;
+    let mut env = seeded_env(test_home(), &[codex], true);
+    env.view
+        .set_available_tools(AvailableTools::with_tools(&["claude", "codex"]));
+
+    let session_row = env
+        .view
+        .flat_items
+        .iter()
+        .position(|item| matches!(item, Item::Session { .. }))
+        .expect("the session row");
+    let group_row = env
+        .view
+        .flat_items
+        .iter()
+        .position(|item| matches!(item, Item::Group { path, .. } if path == "work"))
+        .expect("the work group row");
+
+    for (row, tool) in [(session_row, "codex"), (group_row, "claude")] {
+        env.view.new_dialog = None;
+        env.view.cursor = row;
+        env.view.update_selected();
+
+        env.view.handle_key(key(KeyCode::Char('N')), None);
+        let dialog = env.view.new_dialog.as_ref().expect("N should open dialog");
+        assert_eq!(dialog.group_value(), "work");
+        assert_eq!(dialog.path_value(), "/tmp/work");
+        assert_eq!(dialog.selected_tool(), tool, "row {row}");
+        assert!(
+            !dialog.yolo_value(),
+            "yolo is never carried over: row {row}"
+        );
+    }
+}
+
 #[test]
 #[serial]
 fn test_shift_n_opens_prefilled_dialog_from_group() {
```

**File**: `tests/e2e/new_session.rs` (modified, +49/-0)
```diff
@@ -132,3 +132,52 @@ fn test_new_session_enters_live_mode_when_configured() {
     h.wait_for_timeout("LIVE", Duration::from_secs(10));
     h.assert_screen_contains(" aoe ");
 }
+
+/// `N` opens the form from the row under the cursor: a group row gives its group, a session
+/// row its group and its agent too.
+#[test]
+#[parallel]
+fn test_new_from_selection_starts_on_the_selected_sessions_agent() {
+    require_tmux!();
+    let mut h = TuiTestHarness::new("new_from_selection_agent");
+    h.install_path_command("codex");
+    let project = h.project_path();
+    h.add_session(&[
+        project.to_str().unwrap(),
+        "-t",
+        "codex-source",
+        "--tool",
+        "codex",
+        "-g",
+        "work",
+    ]);
+    h.spawn_tui();
+    h.wait_for("codex-source");
+
+    let new_from_selection_shows = |row: &str, tool: &str| {
+        h.send_keys("N");
+        h.wait_for(" New Session ");
+        let screen = h.capture_screen();
+        let tool_row = screen.lines().find_map(|line| {
+            let rest = &line[line.find("Tool: [")? + "Tool: [".len()..];
+            let (digit, rest) = rest.split_once("] ")?;
+            digit.parse::<u8>().ok()?;
+            Some(rest.split_whitespace().next()?.to_string())
+        });
+        assert_eq!(
+            tool_row.as_deref(),
+            Some(tool),
+            "N on the {row} row should show {tool} on the numbered tool row\nscreen:\n{screen}"
+        );
+        assert!(
+            screen.contains("Group: work"),
+            "N on the {row} row should show the work group\nscreen:\n{screen}"
+        );
+        h.send_keys("Escape");
+        h.wait_for_absent(" New Session ", Duration::from_secs(5));
+    };
+
+    new_from_selection_shows("group", "claude");
+    h.send_keys("j");
+    new_from_selection_shows("session", "codex");
+}
```

---

### Incident Patch 4: `96c48acd` (2026-10-03)
**Commit Message**: fix(web): allow blob: images in the dashboard CSP (#4281)

Artifact images render from blob URLs after an authenticated fetch, which img-src blocked.

**File**: `src/server/access.rs` (modified, +2/-2)
```diff
@@ -405,7 +405,7 @@ pub(super) async fn cityhall_gate(
 pub(super) const CSP: &str = "default-src 'self'; \
     script-src 'self' 'wasm-unsafe-eval'; \
     style-src 'self' 'unsafe-inline'; \
-    img-src 'self' data: https://github.com https://avatars.githubusercontent.com https://raw.githubusercontent.com; \
+    img-src 'self' data: blob: https://github.com https://avatars.githubusercontent.com https://raw.githubusercontent.com; \
     font-src 'self'; \
     connect-src 'self' ws: wss:; \
     frame-ancestors 'none'; \
@@ -836,7 +836,7 @@ mod tests {
         for needle in [
             "default-src 'self'",
             "script-src 'self' 'wasm-unsafe-eval'",
-            "img-src 'self' data: https://github.com https://avatars.githubusercontent.com https://raw.githubusercontent.com",
+            "img-src 'self' data: blob: https://github.com https://avatars.githubusercontent.com https://raw.githubusercontent.com",
             "connect-src 'self' ws: wss:",
             "frame-ancestors 'none'",
         ] {
```

---

### Incident Patch 5: `fe03fdfb` (2026-10-02)
**Commit Message**: fix(tui): keep tool config when reselecting the current tool (#4278)

* fix(tui): keep tool config when reselecting the current tool

Pressing the digit for the already-selected tool reset its Ctrl+P extra
args, command override and YOLO toggle. All tool changes now go through
one helper that no-ops on the current tool.

The Tool row shows the selected tool's digit as [n], and the footer
shows the 1-N pick range while the row is focused.

Refs #4213

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* docs(tui): drop stale claim that both tool cyclers look identical

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(tui): ignore modified digits on the tool row

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/tui/components/cycler.rs` (modified, +30/-8)
```diff
@@ -1,9 +1,7 @@
 //! Shared left/right cycler fields for the New and Restart session dialogs.
 //!
-//! Both modals let the user cycle a profile and an AI tool before launch.
-//! Centralizing the span construction keeps the two dialogs visually
-//! identical; previously the restart dialog carried its own divergent
-//! `AI:` label and `< value >` tool styling.
+//! Both modals let the user cycle a profile and an AI tool before launch and
+//! share these span builders so the rows stay consistent.
 
 use ratatui::prelude::*;
 
@@ -42,6 +40,7 @@ pub fn profile_cycler_spans(
 }
 
 /// Spans for a `Label: ← ● value  [n/m] →` cycler, the AI-tool picker style.
+/// With `numbered`, a tool with a digit hotkey reads `← [n] value →` instead.
 ///
 /// `index` is 0-based. When `total` is 1 or 0 the bullet, count badge, and
 /// arrow affordances are dropped and only the value is shown, matching the
@@ -51,6 +50,7 @@ pub fn tool_cycler_spans(
     value: &str,
     index: usize,
     total: usize,
+    numbered: bool,
     focused: bool,
     theme: &Theme,
 ) -> Vec<Span<'static>> {
@@ -78,9 +78,17 @@ pub fn tool_cycler_spans(
     if focused {
         spans.push(Span::styled("← ", dimmed));
     }
-    spans.push(Span::styled("● ", accent));
-    spans.push(Span::styled(value.to_string(), accent));
-    spans.push(Span::styled(format!("  [{}/{}]", index + 1, total), dimmed));
+    if numbered && index < 9 {
+        spans.push(Span::styled(
+            format!("[{}] ", index + 1),
+            Style::default().fg(theme.hint).bold(),
+        ));
+        spans.push(Span::styled(value.to_string(), accent));
+    } else {
+        spans.push(Span::styled("● ", accent));
+        spans.push(Span::styled(value.to_string(), accent));
+        spans.push(Span::styled(format!("  [{}/{}]", index + 1, total), dimmed));
+    }
     if focused {
         spans.push(Span::styled("  →", dimmed));
     }
@@ -116,7 +124,10 @@ mod tests {
         let profile =
             |value, count, focused| profile_cycler_spans("Profile:", value, count, focused, &theme);
         let tool = |value, index, count, focused| {
-            tool_cycler_spans("Tool:", value, index, count, focused, &theme)
+            tool_cycler_spans("Tool:", value, index, count, false, focused, &theme)
+        };
+        let numbered = |value, index, count| {
+            tool_cycler_spans("Tool:", value, index, count, true, true, &theme)
         };
         let cases: Vec<(Vec<Span<'static>>, &[&str], bool)> = vec![
             (
@@ -144,6 +155,17 @@ mod tests {
                 &["Tool:", " ", "● ", "codex", "  [2/3]"],
                 false,
             ),
+            (
+                numbered("codex", 1, 3),
+                &["Tool:", " ", "← ", "[2] ", "codex", "  →"],
+                true,
+            ),
+            // Only 1-9 are hotkeys, so the tenth tool keeps the plain badge.
+            (
+                numbered("droid", 9, 10),
+                &["Tool:", " ", "← ", "● ", "droid", "  [10/10]", "  →"],
+                true,
+            ),
             (
                 tool("claude", 0, 1, false),
                 &["Tool:", " ", "claude"],
```

**File**: `src/tui/dialogs/new_session/mod.rs` (modified, +23/-40)
```diff
@@ -600,12 +600,19 @@ impl NewSessionDialog {
         )
     }
 
-    /// Preselect a tool by name, applying the same per-tool side effects as
-    /// cycling the tool field. No-op when the tool is not available.
+    /// Preselect a tool by name. No-op when the tool is not available.
     pub fn set_tool(&mut self, tool: &str) {
-        let Some(index) = self.available_tools.iter().position(|t| t == tool) else {
+        if let Some(index) = self.available_tools.iter().position(|t| t == tool) {
+            self.select_tool_index(index);
+        }
+    }
+
+    /// Switch tools and reset the per-tool YOLO, sandbox and Ctrl+P fields.
+    /// Reselecting the current tool keeps the user's edits.
+    fn select_tool_index(&mut self, index: usize) {
+        if index == self.tool_index {
             return;
-        };
+        }
         self.tool_index = index;
         if self.selected_tool_always_yolo() {
             self.yolo_mode = true;
@@ -1196,20 +1203,7 @@ impl NewSessionDialog {
                 self.reload_config_defaults();
             }
         } else if self.focused_field == fields.tool {
-            if self.available_tools.len() > 1 {
-                self.tool_index = (self.tool_index + 1) % self.available_tools.len();
-                if self.selected_tool_always_yolo() {
-                    self.yolo_mode = true;
-                } else {
-                    self.yolo_mode = self.yolo_mode_default;
-                }
-                if self.selected_tool_host_only() {
-                    self.sandbox_enabled = false;
-                    self.worktree_enabled = false;
-                    self.worktree_branch.reset();
-                }
-                self.reload_tool_config();
-            }
+            self.select_tool_index((self.tool_index + 1) % self.available_tools.len());
         } else if self.focused_field == fields.structured {
             self.structured_enabled = !self.structured_enabled;
             self.structured_choice = Some(self.structured_enabled);
@@ -1447,32 +1441,21 @@ impl NewSessionDialog {
             KeyCode::Left | KeyCode::Right | KeyCode::Char(' ')
                 if self.focused_field == fields.tool =>
             {
-                if key.code == KeyCode::Left {
-                    self.tool_index = if self.tool_index == 0 {
-                        self.available_tools.len() - 1
-                    } else {
-                        self.tool_index - 1
-                    };
-                } else {
-                    self.tool_index = (self.tool_index + 1) % self.available_tools.len();
-                }
-                if self.selected_tool_always_yolo() {
-                    self.yolo_mode = true;
+                let len = self.available_tools.len();
+                let index = if key.code == KeyCode::Left {
+                    (self.tool_index + len - 1) % len
                 } else {
-                    self.yolo_mode = self.yolo_mode_default;
-                }
-                if self.selected_tool_host_only() {
-                    self.sandbox_enabled = false;
-                    self.worktree_enabled = false;
-                    self.worktree_branch.reset();
-                }
-                self.reload_tool_config();
+                    (self.tool_index + 1) % len
+                };
+                self.select_tool_index(index);
                 DialogResult::Continue
             }
-            KeyCode::Char(c @ '1'..='9') if self.focused_field == fields.tool => {
+            KeyCode::Char(c @ '1'..='9')
+                if self.focused_field == fields.tool && key.modifiers.is_empty() =>
+            {
                 let index = c as usize - '1' as usize;
-                if let Some(tool) = self.available_tools.get(index).cloned() {
-                    self.set_tool(&tool);
+                if index < self.available_tools.len() {
+                    self.select_tool_index(index);
                 }
                 DialogResult::Continue
             }
```

**File**: `src/tui/dialogs/new_session/render.rs` (modified, +7/-0)
```diff
@@ -205,6 +205,7 @@ impl NewSessionDialog {
             selected_tool,
             self.tool_index,
             self.available_tools.len(),
+            true,
             is_tool_focused,
             theme,
         );
@@ -484,6 +485,12 @@ impl NewSessionDialog {
                 hint_spans.push(Span::raw(" groups  "));
             }
             if self.focused_field == fields.tool {
+                let last = self.available_tools.len().min(9);
+                hint_spans.push(Span::styled(
+                    format!("1-{last}"),
+                    Style::default().fg(theme.hint),
+                ));
+                hint_spans.push(Span::raw(" pick  "));
                 hint_spans.push(Span::styled("Ctrl+P", Style::default().fg(theme.hint)));
                 hint_spans.push(Span::raw(" configure  "));
             }
```

**File**: `src/tui/dialogs/new_session/tests.rs` (modified, +27/-0)
```diff
@@ -352,6 +352,33 @@ fn the_tool_row_cycles_and_submits_the_picked_tool() {
     assert_eq!(dialog.tool_index, 0);
 }
 
+#[test]
+#[serial_test::serial]
+fn reselecting_the_current_tool_keeps_its_edits() {
+    let mut dialog = NewSessionDialog::new_with_tools(
+        vec!["claude", "opencode", "codex"],
+        TEST_PATH.to_string(),
+    );
+    dialog.focused_field = 2;
+    dialog.handle_key(key(KeyCode::Char('2')));
+    dialog.extra_args = Input::new("--model fast".to_string());
+    dialog.command_override = Input::new("wrapper".to_string());
+    dialog.yolo_mode = !dialog.yolo_mode_default;
+
+    dialog.handle_key(key(KeyCode::Char('2')));
+    // Alt+digit is not a pick.
+    dialog.handle_key(alt_key(KeyCode::Char('3')));
+    assert_eq!(dialog.tool_index, 1);
+    assert_eq!(dialog.extra_args.value(), "--model fast");
+    assert_eq!(dialog.command_override.value(), "wrapper");
+    assert_ne!(dialog.yolo_mode, dialog.yolo_mode_default);
+
+    // The footer and row advertise the digits while the Tool row has focus.
+    let screen = screen_of(&mut dialog, 100, 40);
+    assert!(screen.contains("[2] opencode  →"), "{screen}");
+    assert!(screen.contains("1-3 pick"), "{screen}");
+}
+
 #[test]
 fn the_deprecated_tool_badge_survives_every_tool_row_layout() {
     let mut read_only = NewSessionDialog::new_with_tools(vec!["gemini"], TEST_PATH.to_string());
```

**File**: `src/tui/dialogs/restart.rs` (modified, +4/-4)
```diff
@@ -483,10 +483,9 @@ impl RestartDialog {
         frame.render_widget(Paragraph::new(Line::from(spans)), area);
     }
 
-    /// AI-engine picker, rendered via the shared `tool_cycler_spans` so the
-    /// label reads "Tool:" and the cycler matches the New dialog exactly. The
-    /// Restart dialog appends the same "(configured)" summary and Ctrl+P hint
-    /// the New dialog does, so the tool-config overlay is discoverable inline.
+    /// AI-engine picker via the shared `tool_cycler_spans`. Restart has no
+    /// digit hotkeys, so it keeps the `[n/m]` badge; the "(configured)" summary
+    /// and Ctrl+P hint make the tool-config overlay discoverable inline.
     fn render_tool_selector(&self, frame: &mut Frame, area: Rect, theme: &Theme) {
         let value = self
             .available_tools
@@ -498,6 +497,7 @@ impl RestartDialog {
             value,
             self.tool_index,
             self.available_tools.len(),
+            false,
             self.is_tool_field(),
             theme,
         );
```

---

### Incident Patch 6: `76082dd2` (2026-10-02)
**Commit Message**: fix(containers): isolate Podman conmon from systemd invocation (#4267)

Co-authored-by: mikemikimike <[REDACTED_EMAIL]>

**File**: `src/containers/runtime_base.rs` (modified, +18/-1)
```diff
@@ -136,7 +136,11 @@ impl RuntimeBase {
     }
 
     pub fn command(&self) -> Command {
-        Command::new(self.binary)
+        let mut command = Command::new(self.binary);
+        if self.binary == "podman" {
+            command.env_remove("INVOCATION_ID");
+        }
+        command
     }
 
     /// Maps a missing binary to `NotInstalled` and a timeout to an `IoError`.
@@ -995,6 +999,19 @@ mod tests {
         assert_eq!(arg_after(&args, "-m"), Some("4g"));
     }
 
+    #[test]
+    fn podman_commands_do_not_inherit_systemd_invocation_id() {
+        let removes_invocation_id = |base: &RuntimeBase| {
+            base.command()
+                .get_envs()
+                .any(|(key, value)| key == "INVOCATION_ID" && value.is_none())
+        };
+
+        assert!(removes_invocation_id(&PODMAN));
+        assert!(!removes_invocation_id(&DOCKER));
+        assert!(!removes_invocation_id(&APPLE));
+    }
+
     #[test]
     fn exec_command_formats() {
         assert_eq!(
```

---

### Incident Patch 7: `989f1f6b` (2026-10-02)
**Commit Message**: fix(daemon): preserve queued prompts across in-flight disk reloads (#4266)

* fix(daemon): preserve queued prompts across in-flight disk reloads

* chore: leave changelog updates to release automation

**File**: `src/server/disk_watch.rs` (modified, +4/-3)
```diff
@@ -229,14 +229,15 @@ pub(super) async fn disk_watcher_consumer(state: Arc<AppState>) {
             _ = state.disk_changed.notified() => {}
         }
         let started = std::time::Instant::now();
-        // Invariant 8.
+        let snapshot_guard = state.session_service.disk_reload_guard().await;
         let read_epoch = state
             .mutation_epoch
             .load(std::sync::atomic::Ordering::SeqCst);
         let file_watch_for_load = state.file_watch.clone();
         let loaded = match tokio::task::spawn_blocking(move || {
-            load_all_instances(&file_watch_for_load)
-                .map(|fresh| (fresh, live_structured_worker_records()))
+            let fresh = load_all_instances(&file_watch_for_load);
+            drop(snapshot_guard);
+            fresh.map(|fresh| (fresh, live_structured_worker_records()))
         })
         .await
         {
```

**File**: `src/server/reload.rs` (modified, +2/-0)
```diff
@@ -202,6 +202,7 @@ pub(crate) async fn reload_state_instances_from_disk(
     status_source: StatusSource,
     read_epoch: u64,
 ) {
+    let reload_guard = state.session_service.disk_reload_guard().await;
     // Snapshot suppression here so a worker that unmarks between the caller's input build
     // and the per-id decision cannot combine a cleared mark with a stale row to re-emit the
     // phantom Error transition the suppression exists to prevent.
@@ -305,6 +306,7 @@ pub(crate) async fn reload_state_instances_from_disk(
 
     *current = merged;
     drop(current);
+    drop(reload_guard);
 
     persist_structured_row_repairs(state, repairs, repair_guards);
 }
```

**File**: `src/server/session_service.rs` (modified, +213/-10)
```diff
@@ -74,6 +74,19 @@ struct MirroredFields {
     last_accessed_at: Option<chrono::DateTime<chrono::Utc>>,
 }
 
+/// The blocking writer owns completion and ordering even if its caller is cancelled.
+struct PersistedMutation {
+    epoch: Arc<std::sync::atomic::AtomicU64>,
+    _ordered: tokio::sync::OwnedMutexGuard<()>,
+    _reload: tokio::sync::OwnedRwLockReadGuard<()>,
+}
+
+impl Drop for PersistedMutation {
+    fn drop(&mut self) {
+        self.epoch.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
+    }
+}
+
 /// Result of `SessionService::edit_queued_prompt`.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub(crate) enum EditQueuedOutcome {
@@ -123,9 +136,8 @@ pub struct SessionService {
     pub file_watch: Arc<crate::file_watch::FileWatchService>,
     /// Opt-in telemetry create counter, shared with `AppState.telemetry_session_creates`.
     pub telemetry_session_creates: Arc<std::sync::atomic::AtomicU32>,
-    /// Shared with `AppState.mutation_epoch`. Bumped under the `instances` write lock by
-    /// any change a disk snapshot read earlier would not carry, so that reload drops
-    /// itself instead of overwriting the change.
+    /// Shared with AppState.mutation_epoch; invalidates snapshots at memory mutation
+    /// and at the completion of a mirrored persistence transaction.
     pub mutation_epoch: Arc<std::sync::atomic::AtomicU64>,
     /// Owns the per-session ACP agent subprocesses, shared with `AppState.acp_supervisor`.
     pub acp_supervisor:
@@ -146,6 +158,8 @@ pub struct SessionService {
     /// Per-session persist locks for `mutate_instance_persisted`, held across snapshot AND
     /// disk write so the two cannot be reordered.
     persist_locks: RwLock<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
+    /// Shared by queue transactions, exclusive for disk sampling and reload application.
+    reload_gate: Arc<RwLock<()>>,
     /// Per-session prompt-submission locks.
     prompt_locks: RwLock<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
     /// Test-only tap on [`SessionService::prompt_submission`], fired before it
@@ -306,6 +320,7 @@ impl SessionService {
             create_in_flight: std::sync::Mutex::new(HashMap::new()),
             pending_drains: std::sync::Mutex::new(std::collections::HashSet::new()),
             persist_locks: RwLock::new(HashMap::new()),
+            reload_gate: Arc::new(RwLock::new(())),
             prompt_locks: RwLock::new(HashMap::new()),
             #[cfg(test)]
             submission_claims: std::sync::OnceLock::new(),
@@ -835,13 +850,17 @@ impl SessionService {
         }
     }
 
-    /// Drop any disk reload that read `sessions.json` before this in-memory change. Call
-    /// under the `instances` write lock; the persist that follows schedules a fresh reload.
+    /// Invalidate earlier disk snapshots under instances.write() or reload_gate.
     fn invalidate_disk_snapshots(&self) {
         self.mutation_epoch
             .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
     }
 
+    /// Hold through epoch sampling and disk load, or through reload application.
+    pub(super) async fn disk_reload_guard(&self) -> tokio::sync::OwnedRwLockWriteGuard<()> {
+        Arc::clone(&self.reload_gate).write_owned().await
+    }
+
     /// Apply `mutate` to a session's in-memory `Instance`, then mirror the resulting state
     /// to disk.
     async fn mutate_instance_persisted<T, F>(self: &Arc<Self>, id: &str, mutate: F) -> Option<T>
@@ -850,10 +869,16 @@ impl SessionService {
         F: FnOnce(&mut crate::session::Instance) -> T,
     {
         let persist_lock = self.persist_lock(id).await;
-        let _ordered = persist_lock.lock().await;
-        let (profile, result, mirrored) = {
+        let ordered = persist_lock.lock_owned().await;
+        let reload = Arc::clone(&self.reload_gate).read_owned().await;
+        let (profile, result, mirrored, transaction) = {
             let mut instances = self.instances.write().await;
             let inst = instances.iter_mut().find(|i| i.id == id)?;
+            let transaction = PersistedMutation {
+                epoch: Arc::clone(&self.mutation_epoch),
+                _ordered: ordered,
+                _reload: reload,
+            };
             let r = mutate(inst);
             self.invalidate_disk_snapshots();
             (
@@ -865,12 +890,14 @@ impl SessionService {
                     idle_dormant_since: inst.idle_dormant_since,
                     last_accessed_at: inst.last_accessed_at,
                 },
+                transaction,
             )
         };
         match crate::session::Storage::new(&profile, self.file_watch.clone()) {
             Ok(storage) => {
                 let id_persist = id.to_string();
                 let persisted = tokio::task::spawn_blocking(move || {
+                    let _transaction = transaction;
                     storage.update(|instances, _groups| {
                         if let Some(inst) = instances.iter_mut().
```

**File**: `src/server/state.rs` (modified, +1/-2)
```diff
@@ -120,8 +120,7 @@ pub struct AppState {
     pub summary_semaphore: tokio::sync::Semaphore,
     /// Suppression set for the startup-recovery cascade.
     pub recently_restarted: crate::session::recovery::RecentlyRestarted,
-    /// Bumped under the `instances` write lock by any change an earlier disk snapshot
-    /// would not carry, so a reload holding that snapshot drops itself.
+    /// Invalidates earlier disk snapshots at memory mutation and queue persistence completion.
     pub mutation_epoch: Arc<std::sync::atomic::AtomicU64>,
     /// Ids whose startup-recovery cascade is scheduled but not yet complete.
     pub recovery_pending: crate::session::recovery::RecoveryPending,
```

**File**: `src/server/status_poll.rs` (modified, +2/-1)
```diff
@@ -184,12 +184,13 @@ pub(super) async fn status_poll_loop(state: Arc<AppState>) {
         // true previous-tick live status) rather than letting `update_status_with_metadata`
         // fall back to comparing against its own possibly-stale disk-loaded `status`.
         let prev_for_poll = prev.clone();
-        // Invariant 8.
+        let snapshot_guard = state.session_service.disk_reload_guard().await;
         let read_epoch = state
             .mutation_epoch
             .load(std::sync::atomic::Ordering::SeqCst);
         let updated = tokio::task::spawn_blocking(move || {
             let mut instances = load_all_instances(&file_watch_for_poll).unwrap_or_default();
+            drop(snapshot_guard);
             seed_tick_tracking(&mut instances, &prev_tracking);
             crate::tmux::refresh_session_cache();
             let pane_metadata = crate::tmux::batch_pane_metadata();
```

---

### Incident Patch 8: `829d5abc` (2026-10-02)
**Commit Message**: feat(tui): accept a second stop key press as the stop confirm (#4272)

Stop already asks before stopping a session, killing a terminal or killing
a tool, but only y or Enter accepted. Like the trash confirm, the key that
opened the dialog (x, or X with strict hotkeys) now also accepts it, the
message names that key, and the buttons say what they do. The key and hint
come from one helper shared with delete, read off the binding table.


Claude-Session: https://claude.ai/code/session_01BR2k7AFSFgjJfxmiVfddbP

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/tui/home/input.rs` (modified, +55/-32)
```diff
@@ -3292,12 +3292,47 @@ impl HomeView {
                 }
                 let message = format!("Are you sure you want to stop '{}'?", inst.title);
                 self.pending_stop_session = Some(session_id.clone());
-                self.confirm_dialog =
-                    Some(ConfirmDialog::new("Stop Session", &message, "stop_session"));
+                self.confirm_dialog = Some(
+                    self.confirm_by_repeating(
+                        ActionId::Stop,
+                        "Stop Session",
+                        &message,
+                        "stop_session",
+                    )
+                    .buttons("Stop", "Cancel"),
+                );
             }
         }
     }
 
+    /// A confirm the hotkey that opened it also accepts, so the deliberate gesture is two
+    /// taps of one key while a stray keystroke is harmless. The key is read off the binding
+    /// table so the hint can't drift from it; a chord that isn't a bare character falls
+    /// back to the dialog's own y/Enter.
+    fn confirm_by_repeating(
+        &self,
+        opener: ActionId,
+        title: &str,
+        message: &str,
+        action: &str,
+    ) -> ConfirmDialog {
+        let label = bindings::label(opener, self.strict_hotkeys);
+        let mut chars = label.chars();
+        let accept_char = match (chars.next(), chars.next()) {
+            (Some(c), None) => Some(c),
+            _ => None,
+        };
+        let hint = match accept_char {
+            Some(_) => format!("Press {label} again to confirm, Esc to cancel."),
+            None => "Press y to confirm, Esc to cancel.".to_string(),
+        };
+        let dialog = ConfirmDialog::new(title, &format!("{message}\n{hint}"), action);
+        match accept_char {
+            Some(c) => dialog.confirmed_by(c),
+            None => dialog,
+        }
+    }
+
     /// Terminal-view Stop: confirm, then kill the paired terminal (host or container,
     /// whichever the row shows) without touching the agent session. No-op when the
     /// terminal isn't running, so Stop on an idle row pops no dialog.
@@ -3327,11 +3362,10 @@ impl HomeView {
             inst.title
         );
         self.pending_stop_terminal = Some((session_id, mode));
-        self.confirm_dialog = Some(ConfirmDialog::new(
-            "Kill Terminal",
-            &message,
-            "stop_terminal",
-        ));
+        self.confirm_dialog = Some(
+            self.confirm_by_repeating(ActionId::Stop, "Kill Terminal", &message, "stop_terminal")
+                .buttons("Kill", "Cancel"),
+        );
     }
 
     /// Kill the paired terminal for `session_id` (host or container per `mode`) and
@@ -3370,7 +3404,10 @@ impl HomeView {
             tool_name, inst.title
         );
         self.pending_stop_tool = Some((session_id, tool_name.to_string()));
-        self.confirm_dialog = Some(ConfirmDialog::new("Kill Tool", &message, "stop_tool"));
+        self.confirm_dialog = Some(
+            self.confirm_by_repeating(ActionId::Stop, "Kill Tool", &message, "stop_tool")
+                .buttons("Kill", "Cancel"),
+        );
     }
 
     /// Kill the tool session for `session_id`, then refresh so the Tool-view
@@ -5190,35 +5227,21 @@ impl HomeView {
                     // while a stray keystroke is harmless; the accept path runs the same
                     // trash_session_by_id.
                     if session_cfg.confirm_delete {
-                        // Read the accept key off the binding table so relocating Delete
-                        // can't drift the hint from the key that opened the dialog. A
-                        // chord that isn't a bare character can't be a confirm char, so it
-                        // falls back to the dialog's own y/Enter.
-                        let delete_key = bindings::label(ActionId::Delete, self.strict_hotkeys);
-                        let mut key_chars = delete_key.chars();
-                        let accept_char = match (key_chars.next(), key_chars.next()) {
-                            (Some(c), None) => Some(c),
-                            _ => None,
-                        };
-                        let hint = match accept_char {
-                            Some(_) => {
-                                format!("Press {delete_key} again to confirm, Esc to cancel.")
-                            }
-                            None => "Press y to confirm, Esc to cancel.".to_string(),
-                        };
-                        let message = format!("Move '{}' to the trash?\n{hint}", inst.title);
+                        let message = format!("Move '{}' to the trash?", inst.title);
                         self.pending_trash_session = Some(sid);
                         // Offer the same in-dialog opt-out the quit confirm has: the
                         // guard is on by default, so a user who wants one-keystroke trash
                         // back shouldn't have to fi
```

**File**: `src/tui/home/tests/keys_and_nav.rs` (modified, +41/-0)
```diff
@@ -671,6 +671,47 @@ fn stop_in_terminal_view_does_not_target_agent_session() {
     );
 }
 
+/// The stop key opens the stop confirm and a second press of it accepts, in both hotkey
+/// modes; the hint names that key, and an unrelated key leaves the dialog open.
+#[test]
+#[serial]
+fn second_stop_key_press_confirms_the_stop() {
+    for (strict, stop_key) in [(false, 'x'), (true, 'X')] {
+        let mut env = create_test_env_with_sessions(1);
+        env.view.strict_hotkeys = strict;
+        let id = env.view.instance_at(0).id.clone();
+        env.view
+            .mutate_instance(&id, |inst| inst.status = crate::session::Status::Idle);
+        env.view.selected_session = Some(id.clone());
+        env.view.view_mode = ViewMode::Structured;
+
+        assert_eq!(
+            env.view.handle_key(key(KeyCode::Char(stop_key)), None),
+            None
+        );
+        assert_eq!(
+            env.view.confirm_dialog.as_ref().map(|d| d.action()),
+            Some("stop_session"),
+            "strict={strict}"
+        );
+        let screen = render_home_to_string(&mut env.view, 120, 40);
+        assert!(
+            screen.contains(&format!("Press {stop_key} again to confirm")),
+            "strict={strict}\n{screen}"
+        );
+
+        assert_eq!(env.view.handle_key(key(KeyCode::Char('j')), None), None);
+        assert!(env.view.confirm_dialog.is_some(), "strict={strict}");
+
+        assert_eq!(
+            env.view.handle_key(key(KeyCode::Char(stop_key)), None),
+            Some(Action::StopSession(id)),
+            "strict={strict}"
+        );
+        assert!(env.view.confirm_dialog.is_none(), "strict={strict}");
+    }
+}
+
 /// Render suppression is cosmetic: archive/snooze leave the `unread` flag on
 /// disk so unarchiving or unsnoozing brings the marker back (#2571).
 #[test]
```

**File**: `src/tui/home/tests/status_rows_menu.rs` (modified, +5/-2)
```diff
@@ -1816,8 +1816,11 @@ fn d_with_confirm_delete_prompts_before_trashing() {
         "the pending trash target must be the selected session"
     );
 
-    // Accepting the dialog trashes via the same trash_session_by_id path.
-    env.view.dispatch_confirm_submit("trash_session");
+    let screen = render_home_to_string(&mut env.view, 120, 40);
+    assert!(screen.contains("Press d again to confirm"), "{screen}");
+
+    // A second `d` accepts, trashing via the same trash_session_by_id path.
+    env.view.handle_key(key(KeyCode::Char('d')), None);
     assert!(
         env.view.get_instance(&id).unwrap().is_trashed(),
         "accepting the confirm dialog must trash the session"
```

**File**: `tests/e2e/main.rs` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ mod send_structured_e2e;
 mod serve;
 mod settings;
 mod skills_tui;
+mod stop_confirm;
 mod tool_sessions;
 mod unified_view;
 mod update_command;
```

**File**: `tests/e2e/stop_confirm.rs` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+//! Stop asks for confirmation that a second press of the stop key accepts.
+
+use std::time::Duration;
+
+use agent_of_empires::tmux::{Session, TerminalSession, ToolSession};
+use serial_test::parallel;
+
+use crate::harness::{parse_session_id, require_tmux, wait_until, TuiTestHarness};
+
+const TITLE: &str = "StopMe";
+
+fn add_session(h: &TuiTestHarness) -> String {
+    let project = h.project_path();
+    parse_session_id(&h.run_cli_ok(&["add", project.to_str().unwrap(), "-t", TITLE]))
+}
+
+fn wait_gone(h: &TuiTestHarness, name: &str) {
+    wait_until(Duration::from_secs(10), Duration::from_millis(100), || {
+        if h.tmux_has_session(name) {
+            Err(format!("{name} still running"))
+        } else {
+            Ok(())
+        }
+    });
+}
+
+/// Press the stop key, see the hint naming it, then press it again and watch the
+/// pane die. A stray other key in between must not confirm.
+fn stop_twice(h: &TuiTestHarness, stop_key: &str, dialog: &str, pane: &str) {
+    h.send_keys(stop_key);
+    h.wait_for(dialog);
+    h.assert_screen_contains(&format!("Press {stop_key} again to confirm"));
+    h.send_keys("j");
+    h.assert_screen_contains(dialog);
+    assert!(
+        h.tmux_has_session(pane),
+        "{pane} must survive the open confirm"
+    );
+    h.send_keys(stop_key);
+    wait_gone(h, pane);
+}
+
+#[test]
+#[parallel]
+fn second_x_confirms_stop_in_terminal_and_agent_views() {
+    require_tmux!();
+    let mut h = TuiTestHarness::new("stop_confirm");
+    let id = add_session(&h);
+    let agent = Session::generate_name(&id, TITLE);
+    let terminal = TerminalSession::generate_name(&id, TITLE);
+    h.tmux_new_detached(&agent, "sleep 600");
+    h.tmux_new_detached(&terminal, "sleep 600");
+
+    h.spawn_tui();
+    h.wait_for_ready();
+    h.wait_for(TITLE);
+
+    h.send_keys("t");
+    stop_twice(&h, "x", "Kill Terminal", &terminal);
+    assert!(
+        h.tmux_has_session(&agent),
+        "killing the terminal must not stop the agent"
+    );
+
+    h.send_keys("t");
+    stop_twice(&h, "x", "Stop Session", &agent);
+}
+
+#[test]
+#[parallel]
+fn second_shift_x_confirms_tool_kill_in_strict_mode() {
+    require_tmux!();
+    let mut h = TuiTestHarness::new("stop_confirm_strict");
+    h.append_config(
+        "[session]\nstrict_hotkeys = true\n\n[tools.idletool]\ncommand = \"sleep 600\"\nhotkey = \"Alt+t\"",
+    );
+    let id = add_session(&h);
+    let agent = Session::generate_name(&id, TITLE);
+    let tool = ToolSession::new(&id, TITLE, "idletool")
+        .session_name()
+        .to_string();
+    h.tmux_new_detached(&agent, "sleep 600");
+    h.tmux_new_detached(&tool, "sleep 600");
+
+    h.spawn_tui();
+    h.wait_for_ready();
+    h.wait_for(TITLE);
+
+    h.send_keys("M-t");
+    h.wait_for("Tool: idletool");
+    stop_twice(&h, "X", "Kill Tool", &tool);
+    assert!(
+        h.tmux_has_session(&agent),
+        "killing the tool must not stop the agent"
+    );
+}
```

---

### Incident Patch 9: `5fa9fd4d` (2026-10-02)
**Commit Message**: feat(acp): surface the claude-agent-acp auth identity in the session UI (#4254)

* feat(acp): consume the claude-agent-acp authStatus extension

claude-agent-acp pushes `_auth/status_update` with the auth identity the
agent process resolved for itself. Map it to a typed event so the session
UI can show which identity a session actually runs under.

The notification is connection-scoped and carries no session id, so it
joins `SessionIngressNotification` (per that type's handler-chain note)
but bypasses the per-session ingress fence. The upstream `vendor` bag is
dropped rather than persisted: nothing reads it, and it would write
unbounded third-party data into the session event log.

An adapter that advertises the capability always re-pushes on its first
probe, because the dedupe state is per process. One that does not would
leave an earlier process's report on screen, so establish clears it.

* test(acp): cover the authStatus wire shape, projection, and gate

Table cases for the payloads the extension can send, including a kind
added upstream after this code was written (it must still render from
`label`) and the vendor bag, which must not reach the event log.

Also pins the two sta

**File**: `src/acp/acp_client/connection/establish.rs` (modified, +6/-0)
```diff
@@ -84,6 +84,12 @@ pub(super) async fn establish(
     let shared = ctx.shared.clone();
     let label = shared.session_label.clone();
     info!(target: "acp.protocol", session = %label, "initializing ACP agent");
+    // A new adapter process may never report, so an earlier process's
+    // identity must not carry over. Cleared before `initialize`, so nothing
+    // the new process sends can precede it; a reattach keeps its report.
+    if matches!(ctx.mode, ConnectMode::Fresh { .. }) {
+        shared.emit(Event::AuthStatusUpdated { status: None }).await;
+    }
     let init: InitializeResponse = match ctx.control.as_ref() {
         Some(control) => {
             let params = serde_json::to_value(build_initialize_request())
```

**File**: `src/acp/acp_client/connection/mod.rs` (modified, +10/-0)
```diff
@@ -222,6 +222,16 @@ pub(super) async fn run_connection_task<W, R>(
                                 }
                                 return Ok(());
                             }
+                            // No session id to fence on, and a refused session
+                            // still reports the account it was refused for.
+                            SessionIngressNotification::AuthStatus(status) => {
+                                shared
+                                    .emit(Event::AuthStatusUpdated {
+                                        status: Some(status),
+                                    })
+                                    .await;
+                                return Ok(());
+                            }
                             SessionIngressNotification::Update(params) => params,
                         };
                         let (notification, wire_bytes) = SessionIngressNotification::decode_update(
```

**File**: `src/acp/acp_client/connection/tests.rs` (modified, +111/-3)
```diff
@@ -1,6 +1,4 @@
-//! Fairness of the in-flight-prompt select: Cancel must not sit behind the
-//! lifecycle arm, which a sustained update stream keeps permanently ready.
-//! A fake agent floods updates until `session/cancel` arrives.
+//! The connection task driven against a fake agent over in-memory pipes.
 
 use super::prompt::{SelectProbe, SELECT_PROBE};
 use super::*;
@@ -20,6 +18,9 @@ async fn write_line(w: &SharedWrite, line: &str) {
     guard.flush().await.unwrap();
 }
 
+/// Fairness of the in-flight-prompt select: Cancel must not sit behind the
+/// lifecycle arm, which a sustained update stream keeps permanently ready.
+/// A fake agent floods updates until `session/cancel` arrives.
 #[tokio::test]
 async fn cancel_reaches_the_agent_while_notifications_remain_queued() {
     // Repeated contested polls make unbiased selection observable; this is
@@ -196,3 +197,110 @@ async fn cancel_under_flood() {
     connection.abort();
     let _ = tokio::join!(flood, agent, connection);
 }
+
+/// A new adapter process clears the previous process's identity before it can
+/// report its own; a reattach to the surviving process keeps it.
+#[tokio::test]
+async fn auth_status_is_cleared_per_adapter_process() {
+    let fresh = || ConnectMode::Fresh {
+        stored_acp_session_id: None,
+        seed_history_replay: false,
+        fork_from: None,
+    };
+    let reattach = ConnectMode::Resume {
+        acp_session_id: "s-auth".into(),
+        in_flight_turn: false,
+    };
+    let cases = [
+        ("silent replacement", fresh(), false, vec![false]),
+        (
+            "replacement that reports early",
+            fresh(),
+            true,
+            vec![false, true],
+        ),
+        ("reattach to the surviving process", reattach, false, vec![]),
+    ];
+    for (name, mode, reports, want) in cases {
+        assert_eq!(auth_events(mode, reports).await, want, "{name}");
+    }
+}
+
+/// `AuthStatusUpdated` events up to session commit, as "carries a report".
+async fn auth_events(mode: ConnectMode, reports: bool) -> Vec<bool> {
+    let (daemon_write, agent_read) = tokio::io::duplex(64 * 1024);
+    let (mut agent_write, daemon_read) = tokio::io::duplex(64 * 1024);
+    let (event_tx, mut event_rx) = mpsc::channel(64);
+    let (_cmd_tx, cmd_rx) = mpsc::channel::<ClientCmd>(1);
+    let (ready_tx, _ready_rx) = oneshot::channel();
+    let temp = tempfile::tempdir().unwrap();
+    let cwd = temp.path().to_path_buf();
+    let params = ConnectionParams {
+        event_tx,
+        cmd_rx,
+        child: None,
+        pending_responders: Arc::new(Mutex::new(HashMap::new())),
+        resources: SessionResources {
+            fs_policy: Arc::new(FsPolicy::new(vec![cwd.clone()])),
+            terminals: TerminalManager::new(),
+            cwd,
+            label: "s-auth".to_string(),
+            sandbox: None,
+        },
+        mode,
+        ready_tx,
+        profile: &crate::acp::agent_profiles::GEMINI,
+        expected_agent: ExpectedAgent::Gemini,
+        source_profile: None,
+        default_effort: None,
+        default_mode: None,
+        default_model: None,
+        mcp_servers: Vec::new(),
+        runner: None,
+    };
+    let transport = ByteStreams::new(daemon_write.compat_write(), daemon_read.compat());
+    let connection = tokio::spawn(run_connection_task(transport, params));
+    // Reports right after answering `initialize`, the earliest it can.
+    let agent = tokio::spawn(async move {
+        let mut lines = BufReader::new(agent_read).lines();
+        while let Ok(Some(line)) = lines.next_line().await {
+            let msg: serde_json::Value = serde_json::from_str(&line).unwrap();
+            let id = &msg["id"];
+            let mut out = match msg["method"].as_str() {
+                Some("initialize") => vec![format!(
+                    r#"{{"jsonrpc":"2.0","id":{id},"result":{{"protocolVersion":1,"agentCapabilities":{{"_meta":{{"authStatus":{{}}}}}}}}}}"#
+                )],
+                Some("session/new") => vec![format!(
+                    r#"{{"jsonrpc":"2.0","id":{id},"result":{{"sessionId":"s-auth"}}}}"#
+                )],
+                _ => vec![],
+            };
+            if reports && msg["method"] == "initialize" {
+                out.push(r#"{"jsonrpc":"2.0","method":"_auth/status_update","params":{"authStatus":{"kind":"account","label":"Claude Max"}}}"#.into());
+            }
+            for line in out {
+                agent_write
+                    .write_all(format!("{line}\n").as_bytes())
+                    .await
+                    .unwrap();
+            }
+        }
+    });
+
+    let (mut seen, mut committed) = (Vec::new(), false);
+    tokio::time::timeout(Duration::from_secs(10), async {
+        while !committed || (reports && seen.last() != Some(&true)) {
+            match event_rx.recv().await.expect("connection remains open") {
+                Event::AuthStatusUpdated { status } => seen.
```

**File**: `src/acp/acp_client/control.rs` (modified, +1/-0)
```diff
@@ -1839,6 +1839,7 @@ mod tests {
                                     SessionIngressNotification::PromptCompleted(marker) => {
                                         control.deliver_prompt_completion(marker);
                                     }
+                                    SessionIngressNotification::AuthStatus(_) => {}
                                     SessionIngressNotification::Update(_) => {
                                         let (entered, release) =
                                             gate.lock().await.recv().await.unwrap();
```

**File**: `src/acp/acp_client/session_identity.rs` (modified, +76/-0)
```diff
@@ -13,6 +13,7 @@ use super::errors::acp_internal_error;
 use crate::acp::control_protocol::{
     PromptCompletedMarker, SessionReplayed, MAX_CONTROL_QUEUE_BYTES, MAX_CONTROL_QUEUE_FRAMES,
 };
+use crate::acp::state::{AuthStatus, AUTH_STATUS_UPDATE_METHOD};
 
 // The replayed backlog a reattach flushes is exactly the runner's detached
 // control queue, so this buffer is sized against the same contract: a
@@ -41,20 +42,33 @@ pub(super) enum SessionIngressNotification {
     Replayed(SessionReplayed),
     /// Daemon-minted barrier releasing a local prompt's outcome.
     PromptCompleted(PromptCompletedMarker),
+    /// `_auth/status_update`: the agent's own identity. Connection-scoped, so
+    /// it carries no session id and never passes the ingress fence (#4241).
+    AuthStatus(AuthStatus),
+}
+
+/// Params of `_auth/status_update`. Unknown fields, including the upstream
+/// `vendor` bag, are dropped here rather than persisted.
+#[derive(serde::Deserialize)]
+struct AuthStatusParams {
+    #[serde(rename = "authStatus")]
+    auth_status: AuthStatus,
 }
 
 impl JsonRpcMessage for SessionIngressNotification {
     fn matches_method(method: &str) -> bool {
         SessionNotification::matches_method(method)
             || SessionReplayed::matches_method(method)
             || PromptCompletedMarker::matches_method(method)
+            || method == AUTH_STATUS_UPDATE_METHOD
     }
 
     fn method(&self) -> &str {
         match self {
             Self::Update(_) => "session/update",
             Self::Replayed(marker) => marker.method(),
             Self::PromptCompleted(marker) => marker.method(),
+            Self::AuthStatus(_) => AUTH_STATUS_UPDATE_METHOD,
         }
     }
 
@@ -63,6 +77,9 @@ impl JsonRpcMessage for SessionIngressNotification {
             Self::Update(params) => UntypedMessage::new(self.method(), params),
             Self::Replayed(marker) => marker.to_untyped_message(),
             Self::PromptCompleted(marker) => marker.to_untyped_message(),
+            Self::AuthStatus(status) => {
+                UntypedMessage::new(self.method(), serde_json::json!({ "authStatus": status }))
+            }
         }
     }
 
@@ -80,6 +97,10 @@ impl JsonRpcMessage for SessionIngressNotification {
                 method, params,
             )?));
         }
+        if method == AUTH_STATUS_UPDATE_METHOD {
+            let parsed: AuthStatusParams = serde_json::from_value(serde_json::to_value(params)?)?;
+            return Ok(Self::AuthStatus(parsed.auth_status));
+        }
         if !SessionNotification::matches_method(method) {
             return Err(agent_client_protocol::Error::method_not_found());
         }
@@ -399,11 +420,66 @@ where
 mod tests {
     use super::*;
     use crate::acp::acp_client::test_helpers::text_chunk;
+    use crate::acp::state::AuthStatusKind;
 
     fn notif(id: &str) -> SessionNotification {
         SessionNotification::new(id.to_string(), text_chunk("x", None))
     }
 
+    #[test]
+    fn auth_status_update_parses_without_a_session_id() {
+        // Table: the wire payloads the extension can send, including a kind
+        // added after this code was written and the vendor bag it drops.
+        let cases = [
+            (
+                "subscription",
+                serde_json::json!({"authStatus": {
+                    "kind": "account",
+                    "label": "Claude Max",
+                    "account": {"email": "a@b.co", "organization": "Acme", "plan": "max"},
+                }}),
+                AuthStatusKind::Account,
+                "Claude Max",
+            ),
+            (
+                "api key, vendor bag dropped",
+                serde_json::json!({"authStatus": {
+                    "kind": "api_key",
+                    "label": "Anthropic API key",
+                    "detail": "apiKeyHelper",
+                    "vendor": {"claudeCode": {"anything": [1, 2, 3]}},
+                }}),
+                AuthStatusKind::ApiKey,
+                "Anthropic API key",
+            ),
+            (
+                "logged out",
+                serde_json::json!({"authStatus": {"kind": "none", "label": "Not logged in"}}),
+                AuthStatusKind::None,
+                "Not logged in",
+            ),
+            (
+                "kind added upstream later",
+                serde_json::json!({"authStatus": {"kind": "quantum", "label": "Future Auth"}}),
+                AuthStatusKind::Unknown,
+                "Future Auth",
+            ),
+        ];
+        for (name, params, kind, label) in cases {
+            let parsed =
+                SessionIngressNotification::parse_message(AUTH_STATUS_UPDATE_METHOD, &params)
+                    .unwrap_or_else(|e| panic!("{name}: {e}"));
+            let SessionIngressNotification::AuthStatus(status) = parsed else {
+                panic!("{name}: expected AuthStatus");
+            };
+            assert_eq!(status.kind, kind, "{name}");
+  
```

**File**: `src/acp/event_store/mod.rs` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ const NON_SUBSTANTIVE_EVENT_DISCRIMINANTS: &[&str] = &[
     "CurrentModeChanged",
     "AcpSessionAssigned",
     "PromptCapabilities",
+    "AuthStatusUpdated",
 ];
 
 /// SQLite-backed structured view event log.
```

**File**: `src/acp/state.rs` (modified, +117/-0)
```diff
@@ -186,6 +186,50 @@ pub struct ModeInfo {
     pub description: Option<String>,
 }
 
+/// Agent-to-client notification carrying the agent's own auth identity.
+pub const AUTH_STATUS_UPDATE_METHOD: &str = "_auth/status_update";
+
+/// Which auth identity the agent process resolved for itself. An interim
+/// `_meta` extension, so an unrecognised kind still renders from `label`
+/// rather than dropping the whole report.
+#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
+#[serde(rename_all = "snake_case")]
+pub enum AuthStatusKind {
+    Account,
+    ApiKey,
+    Gateway,
+    External,
+    /// The agent knows it is logged out. Distinct from never reporting.
+    None,
+    #[serde(other)]
+    Unknown,
+}
+
+#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
+pub struct AuthStatusAccount {
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub email: Option<String>,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub organization: Option<String>,
+    /// Vendor plan string, not normalised.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub plan: Option<String>,
+}
+
+/// The agent's own `_auth/status_update` payload. The upstream `vendor` bag is
+/// deliberately not kept: nothing reads it, and it would persist unbounded
+/// third-party data into the session log.
+#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
+pub struct AuthStatus {
+    pub kind: AuthStatusKind,
+    /// Usable as a UI string on its own ("Claude Max", "Anthropic API key").
+    pub label: String,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub detail: Option<String>,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub account: Option<AuthStatusAccount>,
+}
+
 #[derive(Debug, Clone, Serialize, Deserialize)]
 pub struct AvailableCommand {
     pub name: String,
@@ -360,6 +404,10 @@ pub struct AcpState {
     pub available_modes: Vec<ModeInfo>,
     #[serde(default)]
     pub current_mode_id: Option<String>,
+    /// Identity the adapter reported for itself. `None` means it never
+    /// reported, which the UI shows as nothing rather than as logged out.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub auth_status: Option<AuthStatus>,
     #[serde(default)]
     pub last_agent_switch: Option<AgentSwitchInfo>,
     #[serde(default, skip_serializing_if = "Option::is_none")]
@@ -531,6 +579,12 @@ pub enum Event {
         value: String,
         reason: String,
     },
+    /// The agent reported which auth identity it runs under. `None` clears a
+    /// report inherited from an earlier adapter process that this one cannot
+    /// refresh; see `AcpState::auth_status`.
+    AuthStatusUpdated {
+        status: Option<AuthStatus>,
+    },
     /// An ACP `session/update` payload with no typed variant yet.
     RawAgentUpdate {
         payload: serde_json::Value,
@@ -788,6 +842,7 @@ impl AcpState {
             Event::CurrentModeChanged { current_mode_id } => {
                 self.current_mode_id = Some(current_mode_id)
             }
+            Event::AuthStatusUpdated { status } => self.auth_status = status,
             Event::AvailableCommandsUpdated { commands } => self.available_commands = commands,
             Event::ConfigOptionsUpdated { options } => {
                 // The failed value is now current, so the notice is moot.
@@ -1054,6 +1109,68 @@ mod tests {
         s
     }
 
+    fn auth(kind: AuthStatusKind, label: &str) -> AuthStatus {
+        AuthStatus {
+            kind,
+            label: label.into(),
+            detail: None,
+            account: None,
+        }
+    }
+
+    #[test]
+    fn auth_status_tracks_the_latest_report_and_clears() {
+        let max = auth(AuthStatusKind::Account, "Claude Max");
+        let key = auth(AuthStatusKind::ApiKey, "Anthropic API key");
+
+        // Never reported is not the same as logged out: it renders as nothing.
+        assert_eq!(fresh_state().auth_status, None);
+
+        let s = applied([Event::AuthStatusUpdated {
+            status: Some(max.clone()),
+        }]);
+        assert_eq!(s.auth_status.as_ref(), Some(&max));
+
+        // A later report replaces the earlier one wholesale.
+        let s = applied([
+            Event::AuthStatusUpdated {
+                status: Some(max.clone()),
+            },
+            Event::AuthStatusUpdated {
+                status: Some(key.clone()),
+            },
+        ]);
+        assert_eq!(s.auth_status.as_ref(), Some(&key));
+
+        // An adapter that cannot report clears the previous process's value
+        // rather than leaving it on screen.
+        let s = applied([
+            Event::AuthStatusUpdated { status: Some(max) },
+            Event::AuthStatusUpdated { status: None },
+        ]);
+        assert_eq!(s.auth_status, None);
+    }
+
+    #[test]
+    fn auth_status_drops_the_vendor_bag_but_keeps_the_account(
```

**File**: `src/cli/acp.rs` (modified, +1/-0)
```diff
@@ -1082,6 +1082,7 @@ fn event_kind(event: &crate::acp::Event) -> &'static str {
         Event::AvailableCommandsUpdated { .. } => "available_commands_updated",
         Event::ConfigOptionsUpdated { .. } => "config_options_updated",
         Event::ConfigOptionSwitchFailed { .. } => "config_option_switch_failed",
+        Event::AuthStatusUpdated { .. } => "auth_status_updated",
         Event::RawAgentUpdate { .. } => "raw_agent_update",
         Event::BackgroundAgentLaunched { .. } => "background_agent_launched",
         Event::BackgroundAgentProgress { .. } => "background_agent_progress",
```

---

### Incident Patch 10: `00f8b4ef` (2026-10-02)
**Commit Message**: feat(tui): mark favorites with a themed star in a left gutter (#4274)

* feat(tui): mark favorites with a themed star in a left gutter

Replace the `* ` title prefix and bold+underline styling with a `✦` in a
fixed gutter colored by a new `favorite` theme field. The gutter shows only
where favorites pin and while a visible row is a live favorite, and every
row reserves it so titles stay aligned. Custom themes omitting `favorite`
inherit their accent, like `unread`.

The web sidebar uses the same glyph and the projected `--color-favorite`.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(tui): address review findings on the favorite gutter

- Route the selected-row star through selected_row_style so it stays
  readable on the selection background.
- Base the gutter on any live favorite so collapsing a group does not
  shift the list.
- Use catppuccin mauve for latte's favorite to clear 3:1 contrast.
- Drop the web semibold on favorites; the star is the mark.
- Update the stale CLI help, regenerated reference, and doc comments.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Merge origin/main into feature/tui-favorite-gutter

Co-Authored-By:

**File**: `docs/cli/reference.md` (modified, +2/-2)
```diff
@@ -405,7 +405,7 @@ Manage session lifecycle (start, stop, attach, etc.)
 * `set-base` — Set or clear the per-session diff base branch. The diff view compares the worktree against this ref instead of the auto-detected default. Useful when the PR target differs from the project default (stacked PRs, hotfix off `release/*`, renamed default branch). See #970
 * `snooze` — Snooze a session for a duration (temporary archive, auto wakes)
 * `unsnooze` — Wake a snoozed session immediately
-* `favorite` — Mark a session as a favorite. With `session.favorites_first` on (the default), favorited rows pin to the top of their sibling scope in every sort order; with it off, they pin within their status tier in the Attention sort only. Either way the row renders with a leading `*` marker plus bold and underline wherever the pin applies. Snoozing a favorite suspends the pin until it wakes
+* `favorite` — Mark a session as a favorite. With `session.favorites_first` on (the default), favorited rows pin to the top of their sibling scope in every sort order; with it off, they pin within their status tier in the Attention sort only. Either way the row shows a `✦` in the session list gutter wherever the pin applies. Snoozing a favorite suspends the pin until it wakes
 * `unfavorite` — Clear the favorite flag on a session
 * `color` — Set (or clear) a per-session color label, rendered as a colored dot in the web sidebar for at-a-glance status signaling. Intended for a running agent to flag its own state, e.g. `aoe session color $(aoe session current -q) red`. Colors: `red` (needs attention), `amber` (working), `green` (done); `none` clears it
 * `archive` — Archive a session: sink it in the Attention sort and tear down its tmux sessions. Worktree, branch, container preserved. `--no-kill` skips tmux teardown. See #1868
@@ -639,7 +639,7 @@ Wake a snoozed session immediately
 
 ## `aoe session favorite`
 
-Mark a session as a favorite. With `session.favorites_first` on (the default), favorited rows pin to the top of their sibling scope in every sort order; with it off, they pin within their status tier in the Attention sort only. Either way the row renders with a leading `*` marker plus bold and underline wherever the pin applies. Snoozing a favorite suspends the pin until it wakes
+Mark a session as a favorite. With `session.favorites_first` on (the default), favorited rows pin to the top of their sibling scope in every sort order; with it off, they pin within their status tier in the Attention sort only. Either way the row shows a `✦` in the session list gutter wherever the pin applies. Snoozing a favorite suspends the pin until it wakes
 
 **Usage:** `aoe session favorite <IDENTIFIER>`
 
```

**File**: `docs/guides/configuration.md` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ aoe theme list
 aoe theme dir
 ```
 
-Every field is optional. Missing colors fall back to the Empire baseline, while an omitted `appearance` or `[syntax].shiki_theme` is derived from the theme's background luminance. `appearance = "dark" | "light"` and `[syntax].shiki_theme` (any id [Shiki bundles](https://shiki.style/themes)) drive the dashboard's surface ramp and code highlighting.
+Every field is optional. Missing colors fall back to the Empire baseline, except `unread` and `favorite`, which inherit the theme's own `accent`. An omitted `appearance` or `[syntax].shiki_theme` is derived from the theme's background luminance. `appearance = "dark" | "light"` and `[syntax].shiki_theme` (any id [Shiki bundles](https://shiki.style/themes)) drive the dashboard's surface ramp and code highlighting.
 
 ## Session
 
```

**File**: `src/cli/session.rs` (modified, +3/-3)
```diff
@@ -68,9 +68,9 @@ pub enum SessionCommands {
     /// Mark a session as a favorite. With `session.favorites_first` on (the
     /// default), favorited rows pin to the top of their sibling scope in every
     /// sort order; with it off, they pin within their status tier in the
-    /// Attention sort only. Either way the row renders with a leading `*`
-    /// marker plus bold and underline wherever the pin applies. Snoozing a
-    /// favorite suspends the pin until it wakes.
+    /// Attention sort only. Either way the row shows a `✦` in the session list
+    /// gutter wherever the pin applies. Snoozing a favorite suspends the pin
+    /// until it wakes.
     Favorite(SessionIdArgs),
 
     /// Clear the favorite flag on a session.
```

**File**: `src/tui/home/icons.rs` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ pub(in crate::tui) const ICON_DELETING: &str = "✕";
 pub(in crate::tui) const ICON_COLLAPSED: &str = "▶";
 pub(in crate::tui) const ICON_EXPANDED: &str = "▼";
 pub(in crate::tui) const ICON_PINNED: &str = "◆";
+/// Neutral-width, so it stays one cell in terminals that widen ambiguous glyphs like `★`.
+pub(in crate::tui) const ICON_FAVORITE: &str = "✦";
 // Shelf glyphs stay single-width: wide glyphs break column alignment and hit-testing.
 pub(in crate::tui) const ICON_TRASH_SECTION: &str = "⊘";
 pub(in crate::tui) const ICON_ARCHIVED_SECTION: &str = "▤";
```

**File**: `src/tui/home/mod.rs` (modified, +2/-2)
```diff
@@ -65,8 +65,8 @@ use super::stop_poller::StopPoller;
 use self::creation::SessionMutationGuards;
 use self::icons::{
     ICON_ARCHIVED_SECTION, ICON_COLLAPSED, ICON_DELETING, ICON_DORMANT, ICON_ERROR, ICON_EXPANDED,
-    ICON_IDLE, ICON_PINNED, ICON_STOPPED, ICON_TRASH_SECTION, ICON_UNKNOWN, ICON_UNREAD,
-    UNREAD_DWELL,
+    ICON_FAVORITE, ICON_IDLE, ICON_PINNED, ICON_STOPPED, ICON_TRASH_SECTION, ICON_UNKNOWN,
+    ICON_UNREAD, UNREAD_DWELL,
 };
 use self::preview::{PreviewCache, PreviewSelection, PreviewTextView, PreviewTimings};
 use self::rows::project_group_key;
```

**File**: `src/tui/home/operations.rs` (modified, +2/-4)
```diff
@@ -1724,10 +1724,8 @@ impl HomeView {
         )))
     }
 
-    /// Toggle the favorite flag on the cursor's session. Favorites pin above peers in
-    /// the same status tier under the Attention sort and render bold + underline with a
-    /// leading `* ` (see `render.rs`). Favorite survives an unsnooze but not an archive;
-    /// that mutual exclusion lives in `Instance::archive()`.
+    /// Toggle the favorite flag on the cursor's session. Favorite survives an unsnooze
+    /// but not an archive; that mutual exclusion lives in `Instance::archive()`.
     pub(super) fn toggle_favorite_at_cursor(&mut self) -> anyhow::Result<()> {
         let Some(id) = self.selected_session.clone() else {
             return Ok(());
```

**File**: `src/tui/home/render.rs` (modified, +60/-29)
```diff
@@ -10,8 +10,8 @@ use rattles::presets::prelude as spinners;
 
 use super::{
     live_send, HomeView, TerminalMode, ViewMode, ICON_ARCHIVED_SECTION, ICON_COLLAPSED,
-    ICON_DELETING, ICON_DORMANT, ICON_ERROR, ICON_EXPANDED, ICON_IDLE, ICON_PINNED, ICON_STOPPED,
-    ICON_TRASH_SECTION, ICON_UNKNOWN, ICON_UNREAD,
+    ICON_DELETING, ICON_DORMANT, ICON_ERROR, ICON_EXPANDED, ICON_FAVORITE, ICON_IDLE, ICON_PINNED,
+    ICON_STOPPED, ICON_TRASH_SECTION, ICON_UNKNOWN, ICON_UNREAD,
 };
 use crate::containers::image_update::ImageUpdate;
 use crate::session::config::{GroupByMode, RowTagMode, SidebarPosition, SortOrder};
@@ -433,13 +433,12 @@ enum SunkRow {
     Pane,
 }
 
-/// The archive/trash, snooze, urgent and favorite overlays every view mode paints on top
-/// of its [`RowSeed`], plus the matching title prefix. `sunk` says how this view resolves
-/// a sunk row; see [`SunkRow`].
+/// The archive/trash, snooze and urgent overlays every view mode paints on top of its
+/// [`RowSeed`], plus the matching title prefix. `sunk` says how this view resolves a sunk
+/// row; see [`SunkRow`].
 fn decorate_row(
     inst: &crate::session::Instance,
     in_attention: bool,
-    show_favorite: bool,
     seed: RowSeed,
     sunk: SunkRow,
     theme: &Theme,
@@ -478,24 +477,16 @@ fn decorate_row(
             .fg(theme.error)
             .add_modifier(Modifier::BOLD)
             .add_modifier(Modifier::RAPID_BLINK);
-    } else if show_favorite && crate::session::is_live_favorite(inst) {
-        style = style
-            .add_modifier(Modifier::BOLD)
-            .add_modifier(Modifier::UNDERLINED);
     }
 
-    // Prefix priority: archive (none) > snooze (`z `) > urgent (`! `) > favorite (`* `).
-    // Snooze and urgent are Attention-only so other sorts show no decoration for state the
-    // user did not opt into; the star also shows elsewhere because favorites-first pins
-    // the row there too.
+    // Prefix priority: archive (none) > snooze (`z `) > urgent (`! `). Both are
+    // Attention-only so other sorts show no decoration for state the user did not opt into.
     let title_text = if inst.is_archived() || inst.is_trashed() {
         Cow::Owned(inst.title.clone())
     } else if in_attention && inst.is_snoozed() {
         Cow::Owned(format!("z {}", inst.title))
     } else if in_attention && inst.is_urgent() {
         Cow::Owned(format!("! {}", inst.title))
-    } else if show_favorite && crate::session::is_live_favorite(inst) {
-        Cow::Owned(format!("* {}", inst.title))
     } else {
         Cow::Owned(inst.title.clone())
     };
@@ -1338,6 +1329,7 @@ impl HomeView {
         self.shelf_inner_area = shelf_region;
 
         let hover_idx = self.hovered_index();
+        let favorite_gutter = self.favorite_gutter();
 
         // --- Workspace list (every row before the shelf) ---
         let list_visible_height = if self.search_bar_visible() {
@@ -1374,7 +1366,14 @@ impl HomeView {
             let is_hovered = !is_selected && Some(abs_idx) == hover_idx;
             let is_match =
                 !self.search_matches.is_empty() && self.search_matches.contains(&abs_idx);
-            let mut line = self.render_item_line(item, is_selected, is_match, theme, inner.width);
+            let mut line = self.render_item_line(
+                item,
+                is_selected,
+                is_match,
+                theme,
+                inner.width,
+                favorite_gutter,
+            );
             // Selection wins over hover, so the already-selected row under the
             // mouse keeps the brighter selected background.
             if is_selected || is_hovered {
@@ -1448,8 +1447,14 @@ impl HomeView {
                 let is_hovered = !is_selected && Some(abs_idx) == hover_idx;
                 let is_match =
                     !self.search_matches.is_empty() && self.search_matches.contains(&abs_idx);
-                let mut line =
-                    self.render_item_line(item, is_selected, is_match, theme, inner.width);
+                let mut line = self.render_item_line(
+                    item,
+                    is_selected,
+                    is_match,
+                    theme,
+                    inner.width,
+                    favorite_gutter,
+                );
                 if is_selected || is_hovered {
                     let pad = (inner.width as usize).saturating_sub(line.width());
                     if pad > 0 {
@@ -1564,25 +1569,34 @@ impl HomeView {
             || serve_open
     }
 
+    /// Reserve the favorite gutter on every row while any session is a pinned favorite,
+    /// so titles stay aligned and collapsing a group does not shift the list. Favorite
+    /// pins under Attention sort, or in any sort with favorites-first on (the
+    /// `Context::FavoritesUsable` predicate).
+    pub(super) fn favorite_gutter(&self) -> bool {
+        (self.sort_order == SortOrder::Attention || crate::session::favorites_first())
+   
```

**File**: `src/tui/home/tests/archive_restart_grouping.rs` (modified, +96/-106)
```diff
@@ -2355,121 +2355,105 @@ fn profile_move_group_metadata_survives_reload() {
     assert!(target_groups.iter().any(|group| group.path == "work"));
 }
 
-/// Favorite and snooze decorations render only in Attention sort, except that with
-/// `session.favorites_first` on the star follows the pin into other sorts (a snoozed favorite is
-/// not pinned, so it is not decorated).
+/// The favorite mark sits in a left gutter that shows only where favorites pin (Attention
+/// sort, or any sort with `session.favorites_first`) and only while a visible row is a live
+/// favorite. Every row reserves it so titles stay aligned. Snooze stays Attention-only.
 #[test]
 #[serial]
-fn favorite_decoration_gated_to_attention_sort() {
-    // Favorites-first off: star is Attention-only.
-    {
-        use crate::session::config::SortOrder;
-
-        let original = crate::session::favorites_first();
-
-        let mut env = create_test_env_with_sessions(1);
-        let id = env.view.instance_at(0).id.clone();
-        let title = env.view.instance_at(0).title.clone();
-        env.view.mutate_instance(&id, |inst| inst.favorite());
-
-        // After the env is built: constructing it applies config, which resets the
-        // process-wide flag to the shipped default (on).
-        crate::session::set_favorites_first(false);
+fn favorite_gutter_follows_pin_predicate() {
+    use crate::session::config::SortOrder;
+    use crate::tui::home::ICON_FAVORITE;
 
-        // In Newest: row should NOT have the `* ` prefix or the bold/
-        // underlined favorite styling.
-        env.view.sort_order = SortOrder::Newest;
-        env.view.flat_items = env.view.build_flat_items();
-        let item = env
-            .view
+    let original = crate::session::favorites_first();
+    let mut env = create_test_env_with_sessions(2);
+    let fav = env.view.instance_at(0).id.clone();
+    let other = env.view.instance_at(1).id.clone();
+    let theme = crate::tui::styles::Theme::default();
+    let line = |view: &HomeView, id: &str| {
+        let item = view
             .flat_items
             .iter()
-            .find(|i| matches!(i, Item::Session { id: sid, .. } if *sid == id))
+            .find(|i| matches!(i, Item::Session { id: sid, .. } if sid == id))
             .cloned()
-            .expect("session item present in Newest sort");
-        let text_newest = rendered_row_text(&env.view, &item);
-        assert!(
-            !text_newest.contains("* "),
-            "favorite prefix must be hidden outside Attention sort; got: {:?}",
-            text_newest
-        );
-        assert!(
-            text_newest.contains(&title),
-            "row title must still render; got: {:?}",
-            text_newest
-        );
-
-        // Flip to Attention: the prefix returns.
-        env.view.sort_order = SortOrder::Attention;
-        env.view.flat_items = env.view.build_flat_items();
-        let item_attention = env
-            .view
-            .flat_items
+            .expect("session item present");
+        view.render_item_line(&item, false, false, &theme, 200, view.favorite_gutter())
+    };
+    let text = |view: &HomeView, id: &str| -> String {
+        line(view, id)
+            .spans
             .iter()
-            .find(|i| matches!(i, Item::Session { id: sid, .. } if *sid == id))
-            .cloned()
-            .expect("session item present in Attention sort");
-        let text_attention = rendered_row_text(&env.view, &item_attention);
-        assert!(
-            text_attention.contains("* "),
-            "favorite prefix must surface in Attention sort; got: {:?}",
-            text_attention
-        );
-
-        crate::session::set_favorites_first(original);
-    }
-    // Favorites-first on: star shows in Newest.
-    {
-        use crate::session::config::SortOrder;
-
-        let original = crate::session::favorites_first();
-
-        let mut env = create_test_env_with_sessions(1);
-        let id = env.view.instance_at(0).id.clone();
-        let title = env.view.instance_at(0).title.clone();
-        env.view.mutate_instance(&id, |inst| inst.favorite());
-
-        // Set after the env is built: constructing it applies config, which would
-        // overwrite the flag.
-        crate::session::set_favorites_first(true);
-
-        env.view.sort_order = SortOrder::Newest;
+            .map(|s| s.content.as_ref())
+            .collect()
+    };
+    let star = format!("{ICON_FAVORITE} ");
+
+    // (sort, favorites_first, favorited, snoozed, gutter expected)
+    for (sort, first, favorited, snoozed, gutter) in [
+        (SortOrder::Newest, false, true, false, false),
+        (SortOrder::Attention, false, true, false, true),
+        (SortOrder::Newest, true, true, false, true),
+        (SortOrder::Newest, true, false, false, false),
+        // A snoozed favorite is not pinned, so it is not marked.
+        (SortOrder::Newest, true, true, true, false),
+    ] {
+        env.view.mut
```

---

### Incident Patch 11: `5a349e67` (2026-10-02)
**Commit Message**: feat(tui): numeric hotkeys for the New Session tool selector (#4264)

With the Tool row focused, 1-9 jump straight to that tool through
set_tool, so YOLO, host-only and config reload behave exactly like
Left/Right cycling. Digits stay plain text on text fields.

Closes #4213

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/tui/dialogs/new_session/mod.rs` (modified, +9/-1)
```diff
@@ -60,7 +60,8 @@ pub(super) const FIELD_HELP: &[FieldHelp] = &[
     },
     FieldHelp {
         name: "Tool",
-        description: "Which AI tool to use (Ctrl+P to configure command and extra args)",
+        description:
+            "Which AI tool to use (1-9 to pick, Ctrl+P to configure command and extra args)",
     },
     FieldHelp {
         name: "Structured",
@@ -1468,6 +1469,13 @@ impl NewSessionDialog {
                 self.reload_tool_config();
                 DialogResult::Continue
             }
+            KeyCode::Char(c @ '1'..='9') if self.focused_field == fields.tool => {
+                let index = c as usize - '1' as usize;
+                if let Some(tool) = self.available_tools.get(index).cloned() {
+                    self.set_tool(&tool);
+                }
+                DialogResult::Continue
+            }
             KeyCode::Left | KeyCode::Right | KeyCode::Char(' ')
                 if self.focused_field == fields.worktree =>
             {
```

**File**: `src/tui/dialogs/new_session/tests.rs` (modified, +13/-2)
```diff
@@ -319,6 +319,16 @@ fn the_tool_row_cycles_and_submits_the_picked_tool() {
         assert_eq!(dialog.tool_index, expected);
     }
 
+    // Digits jump straight to a tool; out-of-range digits are ignored.
+    for (c, expected) in [('3', 2), ('1', 0), ('9', 0), ('2', 1)] {
+        dialog.handle_key(key(KeyCode::Char(c)));
+        assert_eq!(dialog.tool_index, expected);
+    }
+    assert_eq!(
+        submitted(dialog.handle_key(key(KeyCode::Enter))).tool,
+        "opencode"
+    );
+
     let mut dialog = multi_tool_dialog();
     dialog.focused_field = 2;
     dialog.handle_key(key(KeyCode::Char(' ')));
@@ -328,11 +338,12 @@ fn the_tool_row_cycles_and_submits_the_picked_tool() {
         "opencode"
     );
 
-    // Space is ordinary text on a text field, and a lone tool never cycles.
+    // Space and digits are ordinary text on a text field, and a lone tool never cycles.
     let mut dialog = multi_tool_dialog();
     dialog.focused_field = 1;
     dialog.handle_key(key(KeyCode::Char(' ')));
-    assert_eq!(dialog.title.value(), " ");
+    dialog.handle_key(key(KeyCode::Char('2')));
+    assert_eq!(dialog.title.value(), " 2");
     assert_eq!(dialog.tool_index, 0);
 
     let mut dialog = single_tool_dialog();
```

---

### Incident Patch 12: `b00bd66a` (2026-10-02)
**Commit Message**: feat(tui): add a toggle for the session age column and keep it aligned (#4262)

* feat(tui): add a toggle for the session age column and keep it aligned

Add `session.show_activity_age` (default on) to hide the right-edge age
column. Show the age only on Idle rows: active rows showed time since the
user last touched them, which read as idle time. Shorten an overlong
title with an ellipsis so the column stays, dropping it only when fewer
than eight title cells would remain.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(tui): drop the row tag before shortening the title

On a narrow pane the branch tag squeezed the title to a cell or two. Now
the tag goes first, then the title shortens to eight cells, then the age
column goes. Active rows no longer reserve the blank age slot, and
Unknown rows keep their age like Idle ones.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* test: cover the branch tag yielding to the title on a narrow row

Shorten the filewatch e2e fixture title so the full-title wait does not
depend on sidebar width now that long titles are elided.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

C

**File**: `docs/guides/configuration.md` (modified, +1/-0)
```diff
@@ -89,6 +89,7 @@ sidebar_position = "left" # left | right; TUI session list
 | `prevent_sleep_idle_grace_minutes` | `15` | Minutes (0 to 240) every session must stay idle before the inhibitor is released. A session that never reaches `Idle` (`Waiting` on a prompt, `Creating` forever) holds it indefinitely. |
 | `session_id_poller_max_threads` | `50` | Ceiling on concurrent session-id pollers per process. Past the ceiling, an overflow session's id is not refreshed until it gets a poller; starting one is retried on a 5 s to 60 s backoff. Global only, applied at process start. |
 | `row_tag` | `"branch"` | Metadata next to a TUI session title: `none`, `auto` (profile code in all-profiles view), `profile`, `sandbox`, or `branch`. |
+| `show_activity_age` | `true` | Show the age column at the right edge of each TUI session row: time since the agent stopped on `Idle` rows, time since last access on `Unknown` rows, and remaining snooze time under the Attention sort. |
 | `sidebar_position` | `"left"` | TUI session sidebar position: `left` or `right`. Global only. Narrow terminals keep the stacked layout. |
 | `tie_workdir_to_name` | `true` | Keep a managed worktree session's directory named after its title. See [Worktrees](worktrees.md#naming). |
 | `pre_trust_agent_folders` | `false` | Pre-trust each host session's worktree in the agent's own config (Claude Code, Codex, Gemini) so it does not open on a folder-trust prompt. Config-dir overrides are honored, and an `agent_config_dir` entry wins over them. Trust also activates the repo's `.claude/settings.json`, hooks included, so enable it only for directories you would have trusted by hand. Sandboxed sessions always pre-trust their own staged config. |
```

**File**: `src/session/config/mod.rs` (modified, +9/-1)
```diff
@@ -1457,6 +1457,13 @@ pub struct SessionConfig {
     )]
     pub row_tag: RowTagMode,
 
+    /// Show the age column at the right edge of each session row: time since
+    /// the agent stopped on Idle rows, time since last access on Unknown rows,
+    /// and remaining snooze time under the Attention sort.
+    #[serde(default = "default_true")]
+    #[setting(label = "Show Session Age", widget = "toggle", tui_only)]
+    pub show_activity_age: bool,
+
     /// Comma-separated chord specs that exit live-send mode. Tmux-style: C-q,
     /// M-x, F12. The first chord in the list that matches an event ends live
     /// mode. Default `C-q` works in every terminal we ship to; add entries for
@@ -1909,6 +1916,7 @@ impl Default for SessionConfig {
             prevent_sleep_idle_grace_minutes: default_prevent_sleep_idle_grace_minutes(),
             restart_wake_message: default_restart_wake_message(),
             row_tag: RowTagMode::default(),
+            show_activity_age: true,
             live_send_exit_chord: default_live_send_exit_chord(),
             live_send_leader: default_live_send_leader(),
             default_attach_mode: AttachMode::default(),
@@ -2275,7 +2283,7 @@ pub struct ThemeConfig {
     /// Idle session keeps a fresh-idle tint and an animated breathe icon for
     /// this many minutes before snapping back to the static look, and is
     /// treated as actionable by the `w` keybind. The time-since-stop column
-    /// on Idle rows shows regardless of this setting.
+    /// is `session.show_activity_age`.
     #[serde(default = "default_idle_decay_minutes")]
     #[setting(label = "Idle Decay (minutes)", widget = "number", min = 0)]
     pub idle_decay_minutes: u64,
```

**File**: `src/tui/home/config_refresh.rs` (modified, +1/-0)
```diff
@@ -63,6 +63,7 @@ impl HomeView {
         self.confirm_before_quit = config.session.confirm_before_quit;
         self.host_tab_title = config.session.host_tab_title;
         self.row_tag_mode = config.session.row_tag;
+        self.show_activity_age = config.session.show_activity_age;
         self.set_sidebar_position(sidebar_position);
         self.show_diagnostics = config.session.show_diagnostics_pane;
         self.daemon_sidebar = config.session.daemon_sidebar;
```

**File**: `src/tui/home/lifecycle.rs` (modified, +1/-0)
```diff
@@ -219,6 +219,7 @@ impl HomeView {
             sort_order,
             group_by,
             row_tag_mode: resolved.session.row_tag,
+            show_activity_age: resolved.session.show_activity_age,
             sidebar_position: user_config
                 .as_ref()
                 .map(|c| c.session.sidebar_position)
```

**File**: `src/tui/home/mod.rs` (modified, +1/-0)
```diff
@@ -148,6 +148,7 @@ pub struct HomeView {
     pub(super) sort_order: SortOrder,
     pub(super) group_by: GroupByMode,
     pub(super) row_tag_mode: crate::session::config::RowTagMode,
+    pub(super) show_activity_age: bool,
     pub(super) agent_clipboard_forward: bool,
     pub(super) hyperlink_cells: crate::tui::hyperlink::SharedHyperlinks,
     pub(super) vt_live_enabled: bool,
```

**File**: `src/tui/home/render.rs` (modified, +234/-134)
```diff
@@ -785,11 +785,6 @@ fn format_snooze_remaining(delta: chrono::Duration) -> String {
     format!("{}d", days)
 }
 
-/// Minimum list width for the last-activity column; below it the column is hidden.
-/// Compared against `inner.width` (the pane minus its border), so 30 lets the column
-/// appear for `home_list_width` in the common 35-45 range and on tight mobile panes, where
-/// the 6-char age slot plus ~24 chars of title/branch still fits.
-///
 /// Width reserved for the right-aligned column: 5 for the label (`"<1m"`, `"30mo"`) plus
 /// one of left padding.
 const LAST_ACTIVITY_SLOT: usize = 6;
@@ -814,16 +809,17 @@ fn selected_row_style(style: Style, theme: &Theme) -> Style {
 /// Where the right-aligned activity column lives on a session row.
 ///
 /// `prefix_width` is the display width of the spans already pushed, `list_width` the inner
-/// width of the list pane, `badge_width` 0 when no terminal-mode badge follows. `Some(pad)`
-/// is the padding to push between prefix and column when it fits with
-/// `LAST_ACTIVITY_SLOT`, the badge and `LAST_ACTIVITY_RIGHT_MARGIN`; `None` means the row
-/// is too wide and the title wins.
+/// width of the list pane, `slot_width` 0 when the age is hidden, `badge_width` 0 when no
+/// terminal-mode badge follows. `Some(pad)` is the padding to push between prefix and
+/// column when it fits with the slot, the badge and `LAST_ACTIVITY_RIGHT_MARGIN`; `None`
+/// means the row is too wide and the title wins.
 fn activity_column_padding(
     prefix_width: usize,
     list_width: u16,
+    slot_width: usize,
     badge_width: usize,
 ) -> Option<usize> {
-    let trailing = LAST_ACTIVITY_SLOT + badge_width + LAST_ACTIVITY_RIGHT_MARGIN;
+    let trailing = slot_width + badge_width + LAST_ACTIVITY_RIGHT_MARGIN;
     let total = prefix_width.checked_add(trailing)?;
     if total <= list_width as usize {
         Some(list_width as usize - total)
@@ -832,6 +828,44 @@ fn activity_column_padding(
     }
 }
 
+/// Fewest title cells kept before a row gives up its right-edge column.
+const MIN_TITLE_CELLS: usize = 8;
+
+/// Cells the title gets on a session row, and whether the row tag stays. `room` is what
+/// is left after the prefix, `trailing` the right-edge column (age slot, badge, margin).
+/// Space runs out in this order: the tag goes first, then the title shortens down to
+/// `MIN_TITLE_CELLS`, then the column goes and the title takes all of `room`.
+fn title_width_for_column(
+    title_width: usize,
+    room: usize,
+    tag_width: usize,
+    trailing: usize,
+) -> (usize, bool) {
+    if title_width + tag_width + trailing <= room {
+        return (title_width, true);
+    }
+    let beside_column = room.saturating_sub(trailing);
+    let budget = if beside_column >= MIN_TITLE_CELLS {
+        beside_column
+    } else {
+        room
+    };
+    (title_width.min(budget), false)
+}
+
+/// The activity column's text: remaining snooze under Attention sort, else the age of a
+/// resting (Idle or Unknown) row, else blank. `last_accessed_at` is only a fallback for a
+/// missing `idle_entered_at`; on an active row it reads as idle time.
+fn row_age(inst: &crate::session::Instance, in_attention: bool) -> String {
+    if let Some(remaining) = in_attention.then(|| inst.snooze_remaining()).flatten() {
+        return format_snooze_remaining(remaining);
+    }
+    if !matches!(inst.status, Status::Idle | Status::Unknown) {
+        return String::new();
+    }
+    format_relative_age(inst.idle_entered_at.or(inst.last_accessed_at))
+}
+
 impl HomeView {
     /// Lay out the active view and refresh the hit regions for the next input event.
     pub fn render(
@@ -1770,122 +1804,121 @@ impl HomeView {
             text_style = text_style.add_modifier(ratatui::style::Modifier::BOLD);
         }
         line_spans.push(Span::styled(format!("{} ", icon), icon_style));
-        line_spans.push(Span::styled(text.into_owned(), text_style));
-
-        if let Item::Session { id, .. } = item {
-            if let Some(inst) = self.get_instance(id) {
-                // Config-driven suffix next to the title; it owns the
-                // branch/profile/sandbox slot, so `None` means no suffix. Counted into
-                // `used_width` so the activity column still right-aligns past it.
-                if let Some(tag) =
-                    compute_row_tag(inst, self.row_tag_mode, self.active_profile.is_none())
-                {
-                    let tag_style =
-                        Style::default().fg(if self.row_tag_mode == RowTagMode::Branch {
-                            theme.branch
-                        } else {
-                            theme.dimmed
-                        });
-                    line_spans.push(Span::styled(
-                        format!("  {}", tag.rendered()),
-                        if is_selected {
-                            selected_row_style(tag_style, theme)
-                        } else {
-                    
```

**File**: `src/tui/home/tests/render_and_save.rs` (modified, +91/-0)
```diff
@@ -139,6 +139,97 @@ fn test_row_tag_profile_modes_in_filtered_view() {
     }
 }
 
+/// `show_activity_age` hides the right-edge age column on an Idle row, and a title too
+/// long for a narrow pane is shortened with an ellipsis so the age stays.
+#[test]
+#[serial]
+fn test_show_activity_age_toggles_age_column() {
+    let (_temp, _guard) = test_home();
+    let mut inst = Instance::new("a-very-long-session-title", "/tmp/a");
+    inst.status = Status::Idle;
+    inst.idle_entered_at = Some(chrono::Utc::now() - chrono::Duration::minutes(5));
+    seed_profile("alpha", &[inst]);
+    let mut view = test_view(Some("alpha"));
+    view.group_by = crate::session::config::GroupByMode::Manual;
+    view.flat_items = view.build_flat_items();
+    let row = view
+        .flat_items
+        .iter()
+        .find(|item| matches!(item, Item::Session { .. }))
+        .cloned()
+        .expect("session row");
+    for (show, expect_age) in [(true, true), (false, false)] {
+        view.show_activity_age = show;
+        let text = rendered_row_text(&view, &row);
+        assert_eq!(
+            text.trim_end().ends_with("5m"),
+            expect_age,
+            "{show}: {text:?}"
+        );
+    }
+
+    view.show_activity_age = true;
+    let text = view
+        .render_item_line(
+            &row,
+            false,
+            false,
+            &crate::tui::styles::Theme::default(),
+            25,
+        )
+        .spans
+        .iter()
+        .map(|s| s.content.as_ref())
+        .collect::<String>();
+    assert!(text.contains('\u{2026}'), "{text:?}");
+    assert!(text.trim_end().ends_with("5m"), "{text:?}");
+    assert_eq!(
+        crate::tui::components::rendered_width(&text),
+        25,
+        "{text:?}"
+    );
+}
+
+/// On a row too narrow for title and branch tag, the tag gives way and the title stays.
+#[test]
+#[serial]
+fn test_branch_tag_yields_to_title_on_narrow_row() {
+    let (_temp, _guard) = test_home();
+    seed_profile("alpha", &[worktree_instance("my-session")]);
+    let mut view = test_view(Some("alpha"));
+    view.group_by = crate::session::config::GroupByMode::Manual;
+    view.row_tag_mode = crate::session::config::RowTagMode::Branch;
+    view.show_activity_age = false;
+    view.flat_items = view.build_flat_items();
+    let row = view
+        .flat_items
+        .iter()
+        .find(|item| matches!(item, Item::Session { .. }))
+        .cloned()
+        .expect("session row");
+    let render = |width| -> String {
+        view.render_item_line(
+            &row,
+            false,
+            false,
+            &crate::tui::styles::Theme::default(),
+            width,
+        )
+        .spans
+        .iter()
+        .map(|s| s.content.as_ref())
+        .collect()
+    };
+    let wide = render(60);
+    assert!(
+        wide.contains("my-session") && wide.contains("[foo"),
+        "{wide:?}"
+    );
+    let narrow = render(18);
+    assert!(narrow.contains("my-session"), "{narrow:?}");
+    assert!(!narrow.contains("[foo"), "{narrow:?}");
+}
+
 #[test]
 #[serial]
 fn test_create_session_in_all_mode_is_findable() {
```

**File**: `tests/e2e/filewatch_tui_dynamic_profile.rs` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ fn filtered_profile_switch_rewires_disk_watch_to_new_profile() {
 
     let svc: Arc<FileWatchService> = FileWatchService::noop();
     let storage = Storage::new("beta", svc).expect("storage for beta profile");
-    let title = "filewatch-filtered-switch-row";
+    let title = "fw-switch-row";
     storage
         .update(|i, _g| {
             let mut inst = Instance::new(title, "/tmp/filewatch-filtered-switch");
```

---

### Incident Patch 13: `34253d37` (2026-10-01)
**Commit Message**: fix(acp): raise the claude-agent-acp floor to 0.82.0 (#4251)

* fix(acp): raise the claude-agent-acp floor to 0.82.0

The hard floor sat at 0.55.0 while the pinned on-demand install is
already 0.84.0, so only users on a stale global or cached adapter could
still pass the gate, 27 releases behind. Upstream 0.82.0 carries git
patch fixes (real line numbers, file modes, CRLF, final newline), a
non-blanking approval diff, and dedup of repeated compaction summaries
and streamed subagent text, all of which aoe consumes through the
existing generic diff and content paths.

The steering floor moves to 0.82.0 with it. The invariant asserted in
agent_compat requires the steering floor to sit at or above the startup
floor, and once the startup gate rejects everything below 0.82.0 a
separate 0.64.0 steering floor can never bind.

docker/Dockerfile carries the same pin by assertion, and the version
probe table now treats 0.55.0 as the stale install it has become.

* test(acp): lift the fake adapters and doctor fixture to the new floor

Both test adapters advertise a `claude-agent-acp` version that has to
clear the startup gate, and both sat at 0.55.0, so the floor bump made
every spawn through 

**File**: `acp-worker/test-shim/shim.mjs` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ function handleInitialize(params) {
     agentInfo: {
       name: "@agentclientprotocol/claude-agent-acp",
       // At or above the floor in src/acp/agent_compat.rs.
-      version: "0.55.0",
+      version: "0.82.0",
     },
   };
 }
```

**File**: `docker/Dockerfile` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ RUN curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh \
 # `gemini --acp`, `vibe-acp`) are already provided by their respective
 # CLIs above.
 RUN npm install -g \
-    @agentclientprotocol/claude-agent-acp@^0.55.0 \
+    @agentclientprotocol/claude-agent-acp@^0.82.0 \
     @agentclientprotocol/codex-acp@latest \
     pi-acp
 
```

**File**: `flake.nix` (modified, +2/-0)
```diff
@@ -51,8 +51,10 @@
                 ./acp-worker/aoe-agent/package.json
                 ./acp-worker/aoe-agent/package-lock.json
                 ./acp-worker/aoe-agent/src
+                ./acp-worker/test-shim/shim.mjs
                 ./assets
                 ./docker
+                ./web/tests/helpers/fakeAcpAgent.mjs
               ];
             };
             strictDeps = true;
```

**File**: `src/acp/agent_compat.rs` (modified, +42/-4)
```diff
@@ -6,8 +6,8 @@ use agent_client_protocol::schema::ProtocolVersion;
 use super::state::StartupErrorDetail;
 
 /// Single source of truth for the `claude-agent-acp` minimum-version floor.
-pub const CLAUDE_AGENT_ACP_MIN_VERSION: &str = "0.55.0";
-pub const CLAUDE_AGENT_ACP_STEERING_MIN_VERSION: &str = "0.64.0";
+pub const CLAUDE_AGENT_ACP_MIN_VERSION: &str = "0.82.0";
+pub const CLAUDE_AGENT_ACP_STEERING_MIN_VERSION: &str = "0.82.0";
 /// Single source of truth for the `opencode` minimum-version floor.
 pub const OPENCODE_MIN_VERSION: &str = "1.16.0";
 
@@ -356,6 +356,18 @@ mod tests {
 
     const CLAUDE: &str = "@agentclientprotocol/claude-agent-acp";
 
+    /// The semver in the first `key"..."` of `source` at or after `anchor`.
+    fn quoted_after(source: &str, anchor: &str, key: &str) -> semver::Version {
+        let (_, tail) = source
+            .split_once(anchor)
+            .unwrap_or_else(|| panic!("no {anchor:?}"));
+        let (_, tail) = tail
+            .split_once(key)
+            .unwrap_or_else(|| panic!("no {key:?} after {anchor:?}"));
+        let raw = tail.split('"').next().expect("unterminated string");
+        semver::Version::parse(raw).unwrap_or_else(|e| panic!("{raw:?} is not semver: {e}"))
+    }
+
     #[test]
     fn validate_and_steering_gates_per_agent() {
         use ExpectedAgent::*;
@@ -462,8 +474,8 @@ mod tests {
             ),
             (ClaudeAgentAcp, Some(true), "999.0.0", true),
             // Advertised but pre-opt-in: the case the floor exists for.
-            (ClaudeAgentAcp, Some(true), "0.63.9", false),
-            (ClaudeAgentAcp, Some(true), "0.64.0-alpha.1", false),
+            (ClaudeAgentAcp, Some(true), "0.81.9", false),
+            (ClaudeAgentAcp, Some(true), "0.82.0-alpha.1", false),
             (ClaudeAgentAcp, Some(false), "999.0.0", false),
             (ClaudeAgentAcp, None, "999.0.0", false),
             (ClaudeAgentAcp, Some(true), "nightly", false),
@@ -547,6 +559,32 @@ mod tests {
             "docker/Dockerfile claude-agent-acp pin must match CLAUDE_AGENT_ACP_MIN_VERSION",
         );
 
+        // The fake adapters answer the real handshake, so a floor bump that
+        // leaves them behind fails every test spawn, not just a version case.
+        let fake_agent = include_str!(concat!(
+            env!("CARGO_MANIFEST_DIR"),
+            "/web/tests/helpers/fakeAcpAgent.mjs"
+        ));
+        let shim = include_str!(concat!(
+            env!("CARGO_MANIFEST_DIR"),
+            "/acp-worker/test-shim/shim.mjs"
+        ));
+        for (path, source) in [
+            ("web/tests/helpers/fakeAcpAgent.mjs", fake_agent),
+            ("acp-worker/test-shim/shim.mjs", shim),
+        ] {
+            let advertised = quoted_after(source, &format!("name: \"{CLAUDE}\""), "version: \"");
+            assert!(
+                advertised >= floor(CLAUDE_AGENT_ACP_MIN_VERSION),
+                "{path} advertises {advertised}, below CLAUDE_AGENT_ACP_MIN_VERSION",
+            );
+        }
+        let fake_steering = quoted_after(fake_agent, "", "STEERING_MIN_VERSION = \"");
+        assert!(
+            fake_steering >= floor(CLAUDE_AGENT_ACP_STEERING_MIN_VERSION),
+            "fakeAcpAgent.mjs steers at {fake_steering}, below the steering floor",
+        );
+
         // `from_command` finds the adapter binary in any launch shape.
         for command in [
             "claude-agent-acp",
```

**File**: `src/acp/version_probe.rs` (modified, +4/-2)
```diff
@@ -292,8 +292,10 @@ mod tests {
             ("0.37.0", true),
             ("claude-agent-acp 0.37.0", true),
             ("v0.37.0", true),
-            ("0.55.0", false),
-            ("0.56.0", false),
+            // A stale global install that used to clear the floor.
+            ("0.55.0", true),
+            ("0.82.0", false),
+            ("0.83.0", false),
             ("version=0.37.0", false),
             ("0.37.0-beta.1", true),
             ("junk", false),
```

**File**: `src/cli/acp.rs` (modified, +1/-1)
```diff
@@ -1315,7 +1315,7 @@ mod tests {
             version_issue: issue,
         };
         let stale_issue = AgentVersionIssue {
-            reason: "installed 0.37.0; requires >=0.55.0".to_string(),
+            reason: "installed 0.37.0; requires >=0.82.0".to_string(),
             install_command: "npm install -g @x/y@latest".to_string(),
         };
         let marks = [
```

**File**: `tests/e2e/cli.rs` (modified, +3/-2)
```diff
@@ -1006,12 +1006,13 @@ fn cli_list_and_show_expose_lifecycle_state() {
 #[test]
 #[parallel]
 fn cli_acp_doctor_flags_adapters_below_the_version_floor() {
+    let at_floor = agent_of_empires::acp::agent_compat::CLAUDE_AGENT_ACP_MIN_VERSION;
     // (PATH adapter version, bundled adapter version, expected mark)
     let cases = [
         (Some("0.37.0"), None, "[!! ] claude"),
-        (Some("0.37.0"), Some("0.65.0"), "[OK] claude"),
+        (Some("0.37.0"), Some(at_floor), "[OK] claude"),
         (Some("0.37.0"), Some("0.44.0"), "[!! ] claude"),
-        (None, Some("0.65.0"), "[OK] claude"),
+        (None, Some(at_floor), "[OK] claude"),
         (None, Some("0.44.0"), "[!! ] claude"),
     ];
     for (path_version, bundle_version, expected) in cases {
```

**File**: `web/tests/helpers/fakeAcpAgent.mjs` (modified, +2/-2)
```diff
@@ -387,7 +387,7 @@ const INITIALIZE_RESULT = {
   agentInfo: {
     name: "@agentclientprotocol/claude-agent-acp",
     // Must stay at or above CLAUDE_AGENT_ACP_MIN_VERSION in src/acp/agent_compat.rs.
-    version: "0.55.0",
+    version: "0.82.0",
   },
   // Omitted rather than empty: some clients read an empty list as auth required.
 };
@@ -396,7 +396,7 @@ const INITIALIZE_RESULT = {
 // name and a version at its floor. FAKE_ACP_STEERING advertises `_session/steering` at the
 // separate steering floor.
 const STEERING_ENABLED = process.env.FAKE_ACP_STEERING === "1";
-const STEERING_MIN_VERSION = "0.64.0";
+const STEERING_MIN_VERSION = "0.82.0";
 
 // Running prompts decide `injected` versus `promptRequired`, as the real adapter's turnQueue does.
 const activeTurns = new Set();
```

---

### Incident Patch 14: `04cb66d6` (2026-10-01)
**Commit Message**: fix(web): make the mobile view picker a right-side drawer with a shared swipe rule (#4259)

* fix(web): open the mobile view picker as a right-side drawer

The right-edge swipe opened a bottom sheet, so the panel rose from the
bottom instead of sliding in from the edge the gesture came from. It now
slides in from the right like the workspace sidebar does from the left,
with the options anchored to the bottom for thumb reach. Swiping right
dismisses it without also opening the workspace sidebar.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(web): style the mobile panels drawer after the workspace sidebar

Same width, surface, border, and heading as the left sidebar, mono
section labels, single-line rows with the desktop dock's pane icons,
and the session-active ring on the current view.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* refactor(web): share one swipe rule between the mobile drawers

The sidebar opened on a swipe from anywhere while the panels drawer
needed a touch within 24px of the right edge, configured through four
separately gated hook calls. useDrawerSwipe replaces them: a drawer
opens with a swipe away from its edge a

**File**: `web/src/App.tsx` (modified, +21/-30)
```diff
@@ -46,7 +46,7 @@ import { SendCommentsDialog } from "./components/diff/comments/SendCommentsDialo
 import { useCommandActions, buildConversationActions, type SessionStateAction } from "./hooks/useCommandActions";
 import { usePluginCommands } from "./hooks/usePluginCommands";
 import { useSettingsCommands } from "./hooks/useSettingsCommands";
-import { useEdgeSwipe } from "./hooks/useEdgeSwipe";
+import { useDrawerSwipe, type DrawerSwipeAction } from "./hooks/useDrawerSwipe";
 import { useIsCoarsePointer } from "./hooks/useIsCoarsePointer";
 import { useMobileViewportLock } from "./hooks/useMobileViewportLock";
 import { useIsWideViewport } from "./hooks/useIsWideViewport";
@@ -1572,33 +1572,23 @@ function AppContent({
 
   const handleToggleSidebar = useCallback(() => {
     setSidebarOpen((o) => !o);
+    setPickerOpen(false);
   }, []);
 
-  const openSidebar = useCallback(() => setSidebarOpen(true), []);
-  const openDiff = useCallback(() => {
-    if (isMdUp) {
-      openTab("diff", "right");
-    } else {
-      setPickerOpen(true);
-    }
-  }, [isMdUp, openTab]);
-  useEdgeSwipe({
-    edge: "left",
-    // The swipe-right-to-open gesture only makes sense for a left-anchored
-    // drawer; with the sidebar on the right edge it would slide in from the
-    // opposite side of the drag, so disable it there (#2244).
-    enabled: !sidebarOpen && webSettings.sidebarSide !== "right",
-    onSwipe: openSidebar,
-    blurOnSwipe: true,
-    // A swipe-right anywhere on screen opens the sidebar, not just from the
-    // left edge. The right-edge (diff) swipe stays edge-only below.
-    anywhere: true,
-  });
-  useEdgeSwipe({
-    edge: "right",
-    enabled: rightDockCollapsed && !!activeSessionId,
-    onSwipe: openDiff,
-  });
+  const closePicker = useCallback(() => setPickerOpen(false), []);
+  const handleDrawerSwipe = useCallback((action: DrawerSwipeAction) => {
+    if (action === "open-sidebar" || action === "close-sidebar") setSidebarOpen(action === "open-sidebar");
+    else setPickerOpen(action === "open-panels");
+  }, []);
+  useDrawerSwipe(
+    {
+      sidebarOpen,
+      sidebarSide: webSettings.sidebarSide,
+      panelsOpen: pickerOpen,
+      panelsAvailable: !!activeWorkspace && !!activeSession,
+    },
+    handleDrawerSwipe,
+  );
 
   // Read-only mode hides mutation UI. Guard creation at the handler so every
   // caller (keyboard shortcut, command palette) is a no-op rather than opening
@@ -2526,14 +2516,15 @@ function AppContent({
           />
         )}
 
-        {activeWorkspace && activeSession && (
+        {singlePane && activeWorkspace && activeSession && (
           <MobileRightPanelPicker
-            open={pickerOpen && singlePane}
+            open={pickerOpen}
             active={rightPanelView}
-            pluginPanes={pluginPanes}
+            sessionTitle={activeSession.title}
             availablePanes={mobilePaneIds}
+            describePane={paneDescriptor}
             onSelect={handlePickView}
-            onClose={() => setPickerOpen(false)}
+            onClose={closePicker}
           />
         )}
 
```

**File**: `web/src/components/ArrowJoystick.tsx` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ export function ArrowJoystick({ onArrow }: { onArrow: (sequence: string) => void
     timerRef.current = setTimeout(tick, JOYSTICK_FIRST_REPEAT_MS);
   }, [emit]);
 
-  // The sidebar edge swipe listens on window, so the pad's touches stop here.
+  // The drawer swipe listens on window, so the pad's touches stop here.
   useEffect(() => {
     const pad = padRef.current;
     if (!pad) return;
```

**File**: `web/src/components/MobileRightPanelPicker.tsx` (modified, +99/-74)
```diff
@@ -1,43 +1,81 @@
-import { useEffect } from "react";
+import { useEffect, type ReactNode } from "react";
+import { Sparkles, SquareTerminal, type LucideIcon } from "lucide-react";
 import type { RightPanelView } from "../lib/rightPanelView";
-import type { PluginPane } from "../lib/pluginPanes";
-
-interface Entry {
-  view: RightPanelView;
-  label: string;
-  hint: string;
-}
+import { sessionRowChromeClass } from "../lib/sessionRowChrome";
+import type { PaneDisplay } from "./Dock";
+import { PaneIcon } from "./PaneIcon";
 
 // Mobile-only pseudo-views with no desktop dock equivalent; always offered.
-const ALWAYS_ENTRIES: Entry[] = [
-  { view: "agent", label: "Agent terminal", hint: "The session's main view" },
-  { view: "paired", label: "Paired terminal", hint: "Host or container shell" },
-];
-// Mirrors the desktop `BuiltinPaneId`s that also have a mobile view (every
-// one except "terminal", which is desktop's multi-instance extra-terminal
-// dock and has no single-pane mobile equivalent). Gated by `availablePanes`.
-const GATED_ENTRIES: Entry[] = [
-  { view: "agents", label: "Sub agents", hint: "Background async sub-agents" },
-  { view: "diff", label: "Diff", hint: "Changed files and review" },
-  { view: "files", label: "Files", hint: "Browse the repo tree" },
+const SESSION_VIEWS: { view: RightPanelView; title: string; icon: LucideIcon }[] = [
+  { view: "agent", title: "Agent", icon: Sparkles },
+  { view: "paired", title: "Paired terminal", icon: SquareTerminal },
 ];
 
 interface Props {
   open: boolean;
   active: RightPanelView;
-  pluginPanes: PluginPane[];
-  // Builtin pane ids (and plugin ids) currently available: `allPaneIds` in
-  // `App.tsx` filtered for mobile. Drives which of `GATED_ENTRIES` and which
-  // plugin panes show up here, so mobile availability is derived from the
-  // same capability/session gating as the desktop dock instead of a second,
-  // independently maintained list.
+  sessionTitle: string;
+  // `allPaneIds` in `App.tsx` filtered for mobile, so mobile availability
+  // follows the desktop dock's capability and session gating.
   availablePanes: string[];
+  describePane: (id: string) => PaneDisplay;
   onSelect: (view: RightPanelView) => void;
   onClose: () => void;
 }
 
-/** Mobile-only bottom sheet that promotes the chosen view into the single full-viewport main pane. */
-export function MobileRightPanelPicker({ open, active, pluginPanes, availablePanes, onSelect, onClose }: Props) {
+function Section({ label, children }: { label: string; children: ReactNode }) {
+  return (
+    <div className="pt-2">
+      <div className="px-3 pb-1 text-[11px] font-mono uppercase tracking-wider text-text-dim">{label}</div>
+      <ul>{children}</ul>
+    </div>
+  );
+}
+
+function Row({
+  display,
+  view,
+  active,
+  onSelect,
+}: {
+  display: PaneDisplay;
+  view: RightPanelView;
+  active: boolean;
+  onSelect: (view: RightPanelView) => void;
+}) {
+  return (
+    <li>
+      <button
+        onClick={() => onSelect(view)}
+        aria-current={active ? "true" : undefined}
+        data-testid={`mobile-right-panel-pick-${view}`}
+        className={`w-full h-11 flex items-center gap-3 px-3 text-left text-[14px] cursor-pointer transition-colors duration-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${
+          active ? "text-text-primary" : "text-text-secondary"
+        } ${sessionRowChromeClass(active, false)}`}
+      >
+        <PaneIcon
+          icon={display.icon}
+          iconAssetUrl={display.iconAssetUrl}
+          className={`h-4 w-4 shrink-0 ${active ? "text-brand-500" : "text-text-dim"}`}
+        />
+        <span className="truncate">{display.title}</span>
+      </button>
+    </li>
+  );
+}
+
+/** Mobile-only right drawer, the workspace sidebar's counterpart, that
+ *  promotes the chosen view into the single full-viewport main pane. Rows sit
+ *  at the bottom, within thumb reach. */
+export function MobileRightPanelPicker({
+  open,
+  active,
+  sessionTitle,
+  availablePanes,
+  describePane,
+  onSelect,
+  onClose,
+}: Props) {
   // Close on Escape, matching the other dismissible overlays.
   useEffect(() => {
     if (!open) return;
@@ -48,64 +86,51 @@ export function MobileRightPanelPicker({ open, active, pluginPanes, availablePan
     return () => window.removeEventListener("keydown", onKey);
   }, [open, onClose]);
 
-  if (!open) return null;
+  // Stays mounted so it can slide out; `invisible` flips after the transform
+  // finishes, which also takes the closed drawer out of focus and the a11y tree.
   return (
-    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
+    <div className="md:hidden">
       <div
-        className="absolute inset-0 bg-black/50"
+        className={`fixed top-12 inset-x-0 bottom-0 z-40 bg-black/50 transition-[opacity,visibility] duration-300 motion-reduce:transition-none ${
+          open ? "opacity-100" : "opa
```

**File**: `web/src/components/__tests__/MobileRightPanelPicker.test.tsx` (modified, +10/-17)
```diff
@@ -4,6 +4,11 @@ import { describe, expect, it, vi } from "vitest";
 import { fireEvent, render, screen } from "@testing-library/react";
 
 import { MobileRightPanelPicker } from "../MobileRightPanelPicker";
+import { FileDiff, Puzzle } from "lucide-react";
+
+const PLUGIN_ID = "plugin:acme.kit:gh";
+const describePane = (id: string) =>
+  id === PLUGIN_ID ? { title: "GitHub", icon: Puzzle } : { title: id, icon: FileDiff };
 
 function setup(overrides: Partial<Parameters<typeof MobileRightPanelPicker>[0]> = {}) {
   const onSelect = vi.fn();
@@ -12,8 +17,9 @@ function setup(overrides: Partial<Parameters<typeof MobileRightPanelPicker>[0]>
     <MobileRightPanelPicker
       open
       active="agent"
-      pluginPanes={[]}
+      sessionTitle="s1"
       availablePanes={["diff"]}
+      describePane={describePane}
       onSelect={onSelect}
       onClose={onClose}
       {...overrides}
@@ -22,21 +28,12 @@ function setup(overrides: Partial<Parameters<typeof MobileRightPanelPicker>[0]>
   return { onSelect, onClose };
 }
 
-const pluginPane = {
-  id: "plugin:acme.kit:gh" as const,
-  title: "GitHub",
-  defaultDock: "right" as const,
-  icon: undefined,
-  entry: { plugin_id: "acme.kit", slot: "pane" as const, id: "gh", session_id: "s1", payload: {} },
-};
-
 describe("MobileRightPanelPicker", () => {
   it("hides gated entries not in availablePanes and marks the active one", () => {
-    setup({ availablePanes: [], active: "paired", pluginPanes: [pluginPane] });
+    setup({ availablePanes: [], active: "paired" });
     expect(screen.queryByTestId("mobile-right-panel-pick-agents")).toBeNull();
     expect(screen.queryByTestId("mobile-right-panel-pick-diff")).toBeNull();
     expect(screen.queryByTestId("mobile-right-panel-pick-files")).toBeNull();
-    expect(screen.queryByTestId("mobile-right-panel-pick-plugin:acme.kit:gh")).toBeNull();
     // The mobile-only pseudo-views are never gated.
     expect(screen.getByTestId("mobile-right-panel-pick-agent")).toBeDefined();
     expect(screen.getByTestId("mobile-right-panel-pick-paired").getAttribute("aria-current")).toBe("true");
@@ -50,12 +47,8 @@ describe("MobileRightPanelPicker", () => {
     expect(onSelect).toHaveBeenCalledWith("files");
   });
 
-  it("lists plugin panes after the built-ins and selects them by id", () => {
-    const { onSelect } = setup({
-      pluginPanes: [pluginPane],
-      availablePanes: ["diff", pluginPane.id],
-      active: pluginPane.id,
-    });
+  it("lists plugin panes with their descriptor title and selects them by id", () => {
+    const { onSelect } = setup({ availablePanes: ["diff", PLUGIN_ID], active: PLUGIN_ID });
     const option = screen.getByTestId("mobile-right-panel-pick-plugin:acme.kit:gh");
     expect(option.textContent).toContain("GitHub");
     expect(option.getAttribute("aria-current")).toBe("true");
```

**File**: `web/src/hooks/useDrawerSwipe.test.ts` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+// @vitest-environment jsdom
+
+import { renderHook } from "@testing-library/react";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+import { drawerSwipeAction, useDrawerSwipe, type DrawerSwipeState, type SwipeDirection } from "./useDrawerSwipe";
+
+const ORIGINAL_WIDTH = window.innerWidth;
+
+function setWidth(px: number) {
+  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
+}
+
+type Point = [x: number, y: number];
+
+function dispatchTouch(type: string, points: Point[], target: EventTarget = window) {
+  const ev = new Event(type, { bubbles: true }) as Event & { touches: { clientX: number; clientY: number }[] };
+  ev.touches = points.map(([clientX, clientY]) => ({ clientX, clientY }));
+  target.dispatchEvent(ev);
+}
+
+function swipeMoves(...moves: Point[]) {
+  for (const m of moves) dispatchTouch("touchmove", [m]);
+}
+
+/** Start a one-finger touch at `start`, then move through `moves`. */
+function swipe(start: Point, ...moves: Point[]) {
+  dispatchTouch("touchstart", [start]);
+  swipeMoves(...moves);
+}
+
+/** A 200px-wide `overflow-x: auto` box holding 600px of content, scrolled to `scrollLeft`. */
+function horizontalScroller(scrollLeft: number) {
+  const el = document.createElement("div");
+  el.style.overflowX = "auto";
+  Object.defineProperties(el, {
+    scrollWidth: { value: 600 },
+    clientWidth: { value: 200 },
+    scrollLeft: { value: scrollLeft },
+  });
+  document.body.appendChild(el);
+  return el;
+}
+
+const CLOSED: DrawerSwipeState = { sidebarOpen: false, sidebarSide: "left", panelsOpen: false, panelsAvailable: true };
+
+function mount(state: Partial<DrawerSwipeState> = {}) {
+  const onAction = vi.fn();
+  const hook = renderHook(() => useDrawerSwipe({ ...CLOSED, ...state }, onAction));
+  return { onAction, ...hook };
+}
+
+beforeEach(() => setWidth(400));
+
+afterEach(() => {
+  setWidth(ORIGINAL_WIDTH);
+  vi.restoreAllMocks();
+});
+
+describe("drawerSwipeAction", () => {
+  it.each<[string, SwipeDirection, Partial<DrawerSwipeState>, ReturnType<typeof drawerSwipeAction>]>([
+    ["swipe right opens the left sidebar", "right", {}, "open-sidebar"],
+    ["swipe left opens the panels", "left", {}, "open-panels"],
+    ["swipe left without a session does nothing", "left", { panelsAvailable: false }, null],
+    ["swipe left closes the left sidebar", "left", { sidebarOpen: true }, "close-sidebar"],
+    ["swipe right on an open left sidebar does nothing", "right", { sidebarOpen: true }, null],
+    ["swipe right closes the panels", "right", { panelsOpen: true }, "close-panels"],
+    ["swipe left on open panels does nothing", "left", { panelsOpen: true }, null],
+    ["a right-side sidebar has no open swipe", "right", { sidebarSide: "right" }, null],
+    ["swipe right closes a right-side sidebar", "right", { sidebarSide: "right", sidebarOpen: true }, "close-sidebar"],
+  ])("%s", (_label, dir, state, expected) => {
+    expect(drawerSwipeAction(dir, { ...CLOSED, ...state })).toBe(expected);
+  });
+});
+
+describe("useDrawerSwipe", () => {
+  it.each<[string, Point, Point[], string | null]>([
+    [
+      "right swipe from mid-screen",
+      [150, 100],
+      [
+        [200, 100],
+        [250, 100],
+      ],
+      "open-sidebar",
+    ],
+    [
+      "left swipe from mid-screen",
+      [250, 100],
+      [
+        [200, 100],
+        [150, 100],
+      ],
+      "open-panels",
+    ],
+    ["below the threshold", [150, 100], [[230, 100]], null],
+    ["from the left system strip", [8, 100], [[180, 100]], null],
+    ["from the right system strip", [392, 100], [[220, 100]], null],
+    [
+      "vertical drift cancels",
+      [150, 100],
+      [
+        [155, 160],
+        [300, 160],
+      ],
+      null,
+    ],
+  ])("%s", (_label, start, moves, action) => {
+    const { onAction } = mount();
+    swipe(start, ...moves);
+    if (action) expect(onAction).toHaveBeenCalledExactlyOnceWith(action);
+    else expect(onAction).not.toHaveBeenCalled();
+  });
+
+  it.each<[string, number, Point, Point, string | null]>([
+    ["left swipe at the scroll start scrolls instead", 0, [300, 100], [150, 100], null],
+    ["right swipe at the scroll start opens the sidebar", 0, [150, 100], [300, 100], "open-sidebar"],
+    ["right swipe mid-scroll scrolls instead", 200, [150, 100], [300, 100], null],
+    ["left swipe at the scroll end opens the panels", 400, [300, 100], [150, 100], "open-panels"],
+  ])("inside a horizontal scroller: %s", (_label, scrollLeft, start, end, action) => {
+    const el = horizontalScroller(scrollLeft);
+    const { onAction } = mount();
+    dispatchTouch("touchstart", [start], el);
+    dispatchTouch("touchmove", [end], el);
+    el.remove();
+    if (action) expect(onAction).toHaveBeenCalledExactlyOnceWith(action);
+    else expect(onAction).not.toHaveBeenCalled();
+  });
+
+  it.each<[string, number, string | null]>([
+    ["a quick swipe act
```

**File**: `web/src/hooks/useDrawerSwipe.ts` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+import { useEffect } from "react";
+import { useLatestRef } from "./useLatestRef";
+
+export type SwipeDirection = "left" | "right";
+export type DrawerSwipeAction = "open-sidebar" | "close-sidebar" | "open-panels" | "close-panels";
+
+export interface DrawerSwipeState {
+  sidebarOpen: boolean;
+  sidebarSide: "left" | "right";
+  panelsOpen: boolean;
+  panelsAvailable: boolean;
+}
+
+/** A drawer opens with a swipe away from its edge and closes with a swipe back
+ *  toward it. The panels drawer is always on the right; one drawer at a time. */
+export function drawerSwipeAction(dir: SwipeDirection, s: DrawerSwipeState): DrawerSwipeAction | null {
+  if (s.panelsOpen) return dir === "right" ? "close-panels" : null;
+  if (s.sidebarOpen) return dir === s.sidebarSide ? "close-sidebar" : null;
+  // A right-side sidebar has no open swipe: swipe-left belongs to the panels.
+  if (dir === "right") return s.sidebarSide === "left" ? "open-sidebar" : null;
+  return s.panelsAvailable ? "open-panels" : null;
+}
+
+// iOS reserves these strips for system back and forward navigation.
+const SYSTEM_EDGE_GUARD_PX = 32;
+const THRESHOLD_PX = 90;
+const VERTICAL_CANCEL_PX = 16;
+const MOBILE_BREAKPOINT = 768;
+// A touch that stays within the slop this long is a hold (drag-and-drop,
+// long-press), not a swipe. Matches the dnd-kit touch activation constraint.
+const HOLD_SLOP_PX = 8;
+const HOLD_MS = 150;
+
+/** Which swipe directions a horizontal scroller under the touch would consume. */
+function scrollRoom(path: EventTarget[]): Record<SwipeDirection, boolean> {
+  const room = { left: false, right: false };
+  for (const node of path) {
+    if (!(node instanceof HTMLElement) || node.scrollWidth <= node.clientWidth) continue;
+    const { overflowX } = getComputedStyle(node);
+    if (overflowX !== "auto" && overflowX !== "scroll") continue;
+    // A left swipe scrolls toward the end, a right swipe back toward the start.
+    if (node.scrollLeft + node.clientWidth < node.scrollWidth - 1) room.left = true;
+    if (node.scrollLeft > 0) room.right = true;
+  }
+  return room;
+}
+
+/** Mobile horizontal swipes that open and close the side drawers. */
+export function useDrawerSwipe(state: DrawerSwipeState, onAction: (action: DrawerSwipeAction) => void) {
+  const latestState = useLatestRef(state);
+  const latestOnAction = useLatestRef(onAction);
+
+  useEffect(() => {
+    let startX = 0;
+    let startY = 0;
+    let startTime = 0;
+    let moved = false;
+    let tracking = false;
+    let room: Record<SwipeDirection, boolean> = { left: false, right: false };
+
+    const onTouchStart = (e: TouchEvent) => {
+      tracking = false;
+      if (window.innerWidth >= MOBILE_BREAKPOINT || e.touches.length !== 1) return;
+      const t = e.touches[0];
+      if (!t) return;
+      if (t.clientX <= SYSTEM_EDGE_GUARD_PX || t.clientX >= window.innerWidth - SYSTEM_EDGE_GUARD_PX) return;
+      tracking = true;
+      room = scrollRoom(e.composedPath());
+      startX = t.clientX;
+      startY = t.clientY;
+      startTime = performance.now();
+      moved = false;
+    };
+
+    const onTouchMove = (e: TouchEvent) => {
+      if (!tracking) return;
+      const t = e.touches[0];
+      if (!t) return;
+      const dx = t.clientX - startX;
+      const dy = t.clientY - startY;
+      if (!moved && Math.max(Math.abs(dx), Math.abs(dy)) > HOLD_SLOP_PX) {
+        moved = true;
+        if (performance.now() - startTime >= HOLD_MS) {
+          tracking = false;
+          return;
+        }
+      }
+      if (Math.abs(dx) > THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
+        tracking = false;
+        const dir = dx > 0 ? "right" : "left";
+        if (room[dir]) return;
+        const action = drawerSwipeAction(dir, latestState.current);
+        if (!action) return;
+        // Dismiss the on-screen keyboard so it does not cover the drawer.
+        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
+        latestOnAction.current(action);
+      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > VERTICAL_CANCEL_PX) {
+        tracking = false;
+      }
+    };
+
+    const onTouchEnd = () => {
+      tracking = false;
+    };
+
+    window.addEventListener("touchstart", onTouchStart, { passive: true });
+    window.addEventListener("touchmove", onTouchMove, { passive: true });
+    window.addEventListener("touchend", onTouchEnd, { passive: true });
+    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
+    return () => {
+      window.removeEventListener("touchstart", onTouchStart);
+      window.removeEventListener("touchmove", onTouchMove);
+      window.removeEventListener("touchend", onTouchEnd);
+      window.removeEventListener("touchcancel", onTouchEnd);
+    };
+  }, [latestState, latestOnAction]);
+}
```

**File**: `web/src/hooks/useEdgeSwipe.test.ts` (removed, +0/-121)
```diff
@@ -1,121 +0,0 @@
-// @vitest-environment jsdom
-
-import { renderHook } from "@testing-library/react";
-import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
-
-import { useEdgeSwipe } from "./useEdgeSwipe";
-
-const ORIGINAL_WIDTH = window.innerWidth;
-
-function setWidth(px: number) {
-  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
-}
-
-type Point = [x: number, y: number];
-
-function dispatchTouch(type: string, points: Point[]) {
-  const ev = new Event(type) as Event & { touches: { clientX: number; clientY: number }[] };
-  ev.touches = points.map(([clientX, clientY]) => ({ clientX, clientY }));
-  window.dispatchEvent(ev);
-}
-
-/** Start a one-finger touch at `start`, then move through `moves`. */
-function swipe(start: Point, ...moves: Point[]) {
-  dispatchTouch("touchstart", [start]);
-  for (const m of moves) dispatchTouch("touchmove", [m]);
-}
-
-type Options = Parameters<typeof useEdgeSwipe>[0];
-
-function mount(over: Partial<Options> = {}) {
-  const onSwipe = vi.fn();
-  const hook = renderHook(() => useEdgeSwipe({ edge: "left", enabled: true, onSwipe, ...over }));
-  return { onSwipe, ...hook };
-}
-
-beforeEach(() => setWidth(400));
-
-afterEach(() => {
-  setWidth(ORIGINAL_WIDTH);
-  vi.restoreAllMocks();
-});
-
-describe("useEdgeSwipe", () => {
-  it.each<[string, Partial<Options>, Point, Point[], number]>([
-    [
-      "left edge fires once across further moves",
-      {},
-      [5, 100],
-      [
-        [80, 100],
-        [120, 100],
-      ],
-      1,
-    ],
-    ["left edge outside the edge zone", {}, [200, 100], [[300, 100]], 0],
-    ["left edge below the threshold", {}, [5, 100], [[50, 100]], 0],
-    ["right edge past the threshold", { edge: "right" }, [390, 100], [[320, 100]], 1],
-    ["right edge away from the edge", { edge: "right" }, [200, 100], [[100, 100]], 0],
-    [
-      "a gesture that turns vertical",
-      {},
-      [5, 100],
-      [
-        [10, 160],
-        [200, 160],
-      ],
-      0,
-    ],
-    ["anywhere mode below 90px", { anywhere: true }, [200, 100], [[270, 100]], 0],
-    [
-      "anywhere mode past 90px",
-      { anywhere: true },
-      [200, 100],
-      [
-        [270, 100],
-        [300, 100],
-      ],
-      1,
-    ],
-    ["anywhere mode from the system-back strip", { anywhere: true }, [8, 100], [[180, 100]], 0],
-    ["disabled", { enabled: false }, [5, 100], [[200, 100]], 0],
-  ])("%s", (_label, options, start, moves, calls) => {
-    const { onSwipe } = mount(options);
-    swipe(start, ...moves);
-    expect(onSwipe).toHaveBeenCalledTimes(calls);
-  });
-
-  it("does nothing on desktop widths", () => {
-    setWidth(1024);
-    const { onSwipe } = mount();
-    swipe([5, 100], [200, 100]);
-    expect(onSwipe).not.toHaveBeenCalled();
-  });
-
-  it("ignores multi-finger gestures, stray moves after touchend, and unmounted hooks", () => {
-    const { onSwipe, unmount } = mount();
-    dispatchTouch("touchstart", [
-      [5, 100],
-      [6, 100],
-    ]);
-    dispatchTouch("touchmove", [[200, 100]]);
-    dispatchTouch("touchstart", [[5, 100]]);
-    dispatchTouch("touchend", []);
-    dispatchTouch("touchmove", [[200, 100]]);
-    unmount();
-    swipe([5, 100], [200, 100]);
-    expect(onSwipe).not.toHaveBeenCalled();
-  });
-
-  it("blurs the active element before invoking onSwipe", () => {
-    const input = document.createElement("input");
-    document.body.appendChild(input);
-    input.focus();
-    const blurSpy = vi.spyOn(input, "blur");
-    const { onSwipe } = mount({ blurOnSwipe: true });
-    swipe([5, 100], [80, 100]);
-    expect(blurSpy).toHaveBeenCalled();
-    expect(onSwipe).toHaveBeenCalledTimes(1);
-    input.remove();
-  });
-});
```

**File**: `web/src/hooks/useEdgeSwipe.ts` (removed, +0/-72)
```diff
@@ -1,72 +0,0 @@
-import { useEffect } from "react";
-
-interface EdgeSwipeOptions {
-  edge: "left" | "right";
-  enabled: boolean;
-  onSwipe: () => void;
-  blurOnSwipe?: boolean;
-  anywhere?: boolean;
-}
-
-const EDGE_PX = 24;
-// iOS reserves this strip for system back navigation.
-const SYSTEM_BACK_GUARD_PX = 32;
-const THRESHOLD_PX = 60;
-const ANYWHERE_THRESHOLD_PX = 90;
-const VERTICAL_CANCEL_PX = 16;
-const MOBILE_BREAKPOINT = 768;
-
-export function useEdgeSwipe({ edge, enabled, onSwipe, blurOnSwipe = false, anywhere = false }: EdgeSwipeOptions) {
-  useEffect(() => {
-    if (!enabled) return;
-
-    let startX = 0;
-    let startY = 0;
-    let tracking = false;
-    const threshold = anywhere ? ANYWHERE_THRESHOLD_PX : THRESHOLD_PX;
-
-    const onTouchStart = (e: TouchEvent) => {
-      if (window.innerWidth >= MOBILE_BREAKPOINT || e.touches.length !== 1) return;
-      const t = e.touches[0];
-      if (!t) return;
-      const inEdge = edge === "left" ? t.clientX <= EDGE_PX : t.clientX >= window.innerWidth - EDGE_PX;
-      if (!anywhere && !inEdge) return;
-      if (anywhere && edge === "left" && t.clientX <= SYSTEM_BACK_GUARD_PX) return;
-      tracking = true;
-      startX = t.clientX;
-      startY = t.clientY;
-    };
-
-    const onTouchMove = (e: TouchEvent) => {
-      if (!tracking) return;
-      const t = e.touches[0];
-      if (!t) return;
-      const dx = edge === "left" ? t.clientX - startX : startX - t.clientX;
-      const dy = t.clientY - startY;
-      if (dx > threshold && Math.abs(dx) > Math.abs(dy)) {
-        tracking = false;
-        if (blurOnSwipe && document.activeElement instanceof HTMLElement) {
-          document.activeElement.blur();
-        }
-        onSwipe();
-      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > VERTICAL_CANCEL_PX) {
-        tracking = false;
-      }
-    };
-
-    const onTouchEnd = () => {
-      tracking = false;
-    };
-
-    window.addEventListener("touchstart", onTouchStart, { passive: true });
-    window.addEventListener("touchmove", onTouchMove, { passive: true });
-    window.addEventListener("touchend", onTouchEnd, { passive: true });
-    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
-    return () => {
-      window.removeEventListener("touchstart", onTouchStart);
-      window.removeEventListener("touchmove", onTouchMove);
-      window.removeEventListener("touchend", onTouchEnd);
-      window.removeEventListener("touchcancel", onTouchEnd);
-    };
-  }, [edge, enabled, onSwipe, blurOnSwipe, anywhere]);
-}
```

---

### Incident Patch 15: `93b01e5b` (2026-10-01)
**Commit Message**: fix(web): keep the sidebar context menu open for in-place settings and fix mobile sidebar insets (#4258)

* fix(web): keep the sidebar context menu open for in-place settings and fix mobile sidebar insets

Notify, color, pin and unread now apply in place with an optimistic pick
that reverts on failure, instead of closing the menu before the poll
reflects the change. The mobile sheet gains a grab handle, swipe-down
and X close, a stronger heading, a segmented Notify control with a hint,
and a shared swatch picker that the repo group menu also uses.

The mobile sidebar overlay now starts below the safe-area-inset header
instead of under the status bar, and its footer clears the home indicator.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(web): give each repo group color a distinct fixed hue

Teal and violet both resolved to the default teal theme token, and sky
resolved to the slate sandbox token.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(web): stop a pending sidebar pick from masking another writer, and fix the live pin assertion

The pending value now clears as soon as the server moves off the value it
had at the first pick, 

**File**: `web/src/components/ContextMenu.tsx` (modified, +137/-2)
```diff
@@ -1,8 +1,19 @@
-import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
+import {
+  useEffect,
+  useLayoutEffect,
+  useRef,
+  useState,
+  type CSSProperties,
+  type ReactNode,
+  type RefObject,
+} from "react";
+import { X } from "lucide-react";
 import { createPortal } from "react-dom";
 
 // Below Tailwind's `md`, where `sheetOnMobile` docks the menu as a sheet.
 const MOBILE_QUERY = "(max-width: 767.98px)";
+// How far the sheet's header must be dragged down to dismiss it.
+const SWIPE_CLOSE_PX = 72;
 
 export function ContextMenu({
   menu,
@@ -11,6 +22,7 @@ export function ContextMenu({
   minWidth = "min-w-[190px]",
   sheetOnMobile = false,
   label,
+  heading,
   onClose,
   returnFocusTo,
   children,
@@ -23,7 +35,9 @@ export function ContextMenu({
   sheetOnMobile?: boolean;
   /** Accessible name of the sheet dialog. */
   label?: string;
-  /** Escape closes the sheet. */
+  /** Sticky title row; on the phone sheet it carries the grab handle and a close button. */
+  heading?: ReactNode;
+  /** Escape, the close button, and a swipe down on the sheet header close it. */
   onClose?: () => void;
   /** Where focus returns on close, when nothing else took it. */
   returnFocusTo?: RefObject<HTMLElement | null>;
@@ -56,6 +70,8 @@ export function ContextMenu({
     };
   }, [modal, menuRef, returnFocusTo]);
 
+  const swipe = useSwipeToClose(menuRef, modal ? onClose : undefined);
+
   // `!` overrides the pointer position and height cap set inline.
   const sheet = sheetOnMobile
     ? " max-md:!left-0 max-md:!top-auto max-md:bottom-0 max-md:w-full max-md:!max-h-[85dvh] max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
@@ -94,13 +110,69 @@ export function ContextMenu({
         className={`fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-lg py-1 ${minWidth} overflow-y-auto${sheet}`}
         style={{ left: menu.x, top: menu.y, maxHeight: "calc(100dvh - 16px)" }}
       >
+        {(heading != null || sheetOnMobile) && (
+          <div {...swipe} className="sticky top-0 z-10 bg-surface-800 max-md:-mt-1 max-md:touch-none">
+            {sheetOnMobile && (
+              <div className="md:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
+                <span className="h-1 w-9 rounded-full bg-surface-600" />
+              </div>
+            )}
+            <div className="flex items-center gap-2 px-3 pt-1.5 pb-1 max-md:pt-0">
+              <div className="min-w-0 flex-1">{heading}</div>
+              {sheetOnMobile && onClose && (
+                <button
+                  type="button"
+                  onClick={onClose}
+                  data-testid={`${testId}-close`}
+                  aria-label="Close"
+                  className="md:hidden shrink-0 -mr-1.5 flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-surface-700/50 hover:text-text-primary cursor-pointer transition-colors"
+                >
+                  <X className="h-5 w-5" />
+                </button>
+              )}
+            </div>
+          </div>
+        )}
         {children}
       </div>
     </>,
     document.body,
   );
 }
 
+/** Drags the sheet with a finger on its header and closes it past `SWIPE_CLOSE_PX`. */
+function useSwipeToClose(menuRef: RefObject<HTMLDivElement | null>, onClose: (() => void) | undefined) {
+  const startY = useRef<number | null>(null);
+  const offset = (dy: number, animate: boolean) => {
+    const el = menuRef.current;
+    if (!el) return;
+    el.style.transition = animate ? "transform 150ms ease-out" : "";
+    el.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
+  };
+  if (!onClose) return {};
+  return {
+    onTouchStart: (e: React.TouchEvent) => {
+      startY.current = e.touches[0]?.clientY ?? null;
+    },
+    onTouchMove: (e: React.TouchEvent) => {
+      const y = e.touches[0]?.clientY;
+      if (startY.current == null || y == null) return;
+      offset(y - startY.current, false);
+    },
+    onTouchEnd: (e: React.TouchEvent) => {
+      const y = e.changedTouches[0]?.clientY;
+      const dy = startY.current == null || y == null ? 0 : y - startY.current;
+      startY.current = null;
+      if (dy > SWIPE_CLOSE_PX) onClose();
+      else offset(0, true);
+    },
+    onTouchCancel: () => {
+      startY.current = null;
+      offset(0, true);
+    },
+  };
+}
+
 export function MenuItem({
   onClick,
   testId,
@@ -145,3 +217,66 @@ export function MenuSeparator() {
 export function MenuHeading({ children }: { children: ReactNode }) {
   return <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-text-muted">{children}</div>;
 }
+
+/** A labelled row of inline choices, replacing a heading plus one item per option. */
+export function MenuChoiceRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
+  return (
+    <div className="
```

**File**: `web/src/components/WorkspaceSidebar.tsx` (modified, +4/-3)
```diff
@@ -214,10 +214,11 @@ export function WorkspaceSidebar(props: Props) {
     if (!filterOpen) requestAnimationFrame(() => filterRef.current?.focus());
   };
 
+  // The phone overlay starts under the header, which the app root insets below the status bar.
   return (
     <SidebarCompactContext.Provider value={compact}>
       <div
-        className={`fixed top-12 inset-x-0 bottom-0 z-30 md:hidden transition-opacity duration-300 ${
+        className={`fixed top-[calc(3rem+env(safe-area-inset-top))] inset-x-0 bottom-0 z-30 md:hidden transition-opacity duration-300 ${
           open ? "bg-black/50" : "opacity-0 pointer-events-none"
         }`}
         onClick={props.onToggle}
@@ -226,7 +227,7 @@ export function WorkspaceSidebar(props: Props) {
         {...tourAnchor(TOUR_ANCHORS.sidebar)}
         style={{ width: effectiveWidth }}
         data-compact={compact ? "true" : undefined}
-        className={`fixed top-12 bottom-0 z-40 md:static md:z-auto bg-surface-800 border-surface-700/60 flex flex-col md:h-full shrink-0 transition-transform duration-300 ease-in-out md:transition-none ${
+        className={`fixed top-[calc(3rem+env(safe-area-inset-top))] bottom-0 z-40 md:static md:z-auto bg-surface-800 border-surface-700/60 flex flex-col md:h-full shrink-0 transition-transform duration-300 ease-in-out md:transition-none ${
           rightSide ? "right-0 border-l md:border-l-0 md:border-r" : "left-0 border-r"
         } ${open ? "translate-x-0" : `${rightSide ? "translate-x-full" : "-translate-x-full"} md:hidden`}`}
       >
@@ -364,7 +365,7 @@ export function WorkspaceSidebar(props: Props) {
 
         <SidebarSystemHealth />
 
-        <div className="border-t border-surface-700/20 p-2 flex items-center gap-1">
+        <div className="border-t border-surface-700/20 p-2 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center gap-1">
           {trashedWorkspaces.length > 0 && (
             <TrashMenu
               trashedWorkspaces={trashedWorkspaces}
```

**File**: `web/src/components/__tests__/SessionRowTriage.test.tsx` (modified, +48/-9)
```diff
@@ -102,15 +102,16 @@ describe("SessionRow unread", () => {
     expect(testId("sidebar-context-menu-unread")).toBeNull();
   });
 
-  it.each([
-    [false, "Unread", true],
-    [true, "Read", false],
-  ])("unread=%s offers %j and PATCHes { unread: %s }", async (unread, text, next) => {
+  it.each([false, true])("unread=%s toggles in place and PATCHes the opposite", async (unread) => {
+    const next = !unread;
     openRowMenu(ws({ id: "sess-u", unread }));
-    expect(testId("sidebar-context-menu-unread")!.textContent).toContain(text);
+    const toggle = () => testId("sidebar-context-menu-unread")!;
+    expect(toggle().getAttribute("aria-pressed")).toBe(String(unread));
     click("sidebar-context-menu-unread");
-    // The dot flips optimistically before the PATCH lands.
+    // The dot and the toggle flip optimistically before the PATCH lands, with the menu still open.
     await vi.waitFor(() => expect(testId("sidebar-unread-dot") != null).toBe(next));
+    expect(toggle().getAttribute("aria-pressed")).toBe(String(next));
+    expect(testId("sidebar-context-menu")).not.toBeNull();
     await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
     expect(firstRequest(fetchSpy)).toEqual({
       url: "/api/sessions/sess-u/unread",
@@ -199,7 +200,7 @@ describe("SessionRow context menu", () => {
 
   it.each([
     // Archiving or snoozing a pinned session clears the pin server-side, as in the TUI.
-    ["pinned", { pinned_at: PAST }, ["Unpin", "Archive", "Snooze"], []],
+    ["pinned", { pinned_at: PAST }, ["Pinned", "Archive", "Snooze"], []],
     ["archived", { archived_at: PAST }, ["Unarchive"], ["Pin", "Snooze"]],
     ["snoozed", { snoozed_until: inMinutes(60) }, ["Unsnooze"], ["Pin", "Archive"]],
     ["live", {}, ["Pin", "Archive", "Snooze"], []],
@@ -266,10 +267,47 @@ describe("SessionRow triage actions", () => {
     click(item);
     // Regression: the chip must read the optimistic state, not wait for the poll.
     await vi.waitFor(() => expect(label(chip)).not.toBeNull());
+    // Pin toggles in place; Archive moves the row out of view, so it closes the menu.
+    expect(testId("sidebar-context-menu") != null).toBe(item === "sidebar-context-menu-pin");
     fail();
     await vi.waitFor(() => expect(label(chip)).toBeNull());
   });
 
+  it.each([
+    ["Notify all", "sidebar-context-menu-notify-all", "notifications"],
+    ["Color", "sidebar-context-menu-color-red", "color"],
+  ])("%s keeps the menu open, shows the pick, and reverts on failure", async (_n, item, path) => {
+    let fail = () => {};
+    fetchSpy.mockImplementation(
+      () => new Promise((resolve) => (fail = () => resolve(new Response("nope", { status: 500 })))),
+    );
+    openRowMenu(ws({ id: "sess-pick" }));
+    click(item);
+    expect(testId("sidebar-context-menu")).not.toBeNull();
+    expect(testId(item)!.getAttribute("aria-pressed")).toBe("true");
+    expect(fetchSpy.mock.calls[0]![0]).toBe(`/api/sessions/sess-pick/${path}`);
+    fail();
+    await vi.waitFor(() => expect(testId(item)!.getAttribute("aria-pressed")).toBe("false"));
+    expect(testId("sidebar-context-menu")).not.toBeNull();
+  });
+
+  it("No color on a multi-session row clears every session, including the one carrying the color", async () => {
+    openRowMenu(makeWorkspace("w", [makeSession({ id: "s1" }), makeSession({ id: "s2", color: "red" })]));
+    expect(testId("sidebar-context-menu-color-red")!.getAttribute("aria-pressed")).toBe("true");
+    click("sidebar-context-menu-color-clear");
+    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
+    expect(fetchSpy.mock.calls.map(([url]) => url).sort()).toEqual([
+      "/api/sessions/s1/color",
+      "/api/sessions/s2/color",
+    ]);
+  });
+
+  it("the close button closes the menu", () => {
+    openRowMenu(ws());
+    click("sidebar-context-menu-close");
+    expect(testId("sidebar-context-menu")).toBeNull();
+  });
+
   it("Snooze… opens the modal without a request", () => {
     openRowMenu(ws());
     click("sidebar-context-menu-snooze");
@@ -316,9 +354,10 @@ describe("SessionRow color label (#2383)", () => {
     if (shown) expect(dot!.className).toContain("bg-red-500");
   });
 
-  it("offers Clear only for a colored row and no color section when disabled", () => {
+  it("marks No color as picked on an uncolored row and hides the section when disabled", () => {
     openRowMenu(ws());
-    expect(testId("sidebar-context-menu-color-clear")).toBeNull();
+    expect(testId("sidebar-context-menu-color-clear")!.getAttribute("aria-pressed")).toBe("true");
+    expect(testId("sidebar-context-menu-color-red")!.getAttribute("aria-pressed")).toBe("false");
     cleanup();
     openRowMenu(ws({ color: "green" }), { colorsEnabled: false });
     for (const key of ["red", "amber", "green", "clear"]) {
```

**File**: `web/src/components/sidebar/SessionRow.tsx` (modified, +55/-28)
```diff
@@ -30,11 +30,12 @@ import { StatusGlyph } from "../StatusGlyph";
 import { useContextMenu } from "../useContextMenu";
 import { AddProjectModal } from "./AddProjectModal";
 import { RowSubRows, RowTrailingBadges } from "./RowBadges";
-import { deriveRowModel, type RowModel } from "./rowModel";
+import { deriveRowModel, SESSION_COLOR_OPTIONS, type RowModel } from "./rowModel";
 import { BulkTriageMenuItems, SingleRowMenuItems, type SingleRowActions } from "./SessionRowMenu";
 import { SnoozeModal } from "./SnoozeModal";
 import type { RowActivate, RowBulkApi, RowContextScope } from "./types";
 import { useLongPress } from "./useLongPress";
+import { usePendingSetting } from "./usePendingSetting";
 import { WorkdirNameModal } from "./WorkdirNameModal";
 
 type Modal = "snooze" | "workdir" | "addProject" | "group" | null;
@@ -67,8 +68,26 @@ export const SessionRow = memo(function SessionRow(props: SessionRowProps) {
   const unreadIndicatorEnabled = useUnreadIndicatorEnabled();
   const sessionColorsEnabled = useSessionColorsEnabled();
   const compact = useSidebarCompact();
-  const model = deriveRowModel(workspace, props.optimistic, { idleDecayWindowMs, isActive, unreadIndicatorEnabled });
-  const { label, sessionId, isDeleting, navigationSession } = model;
+  const derived = deriveRowModel(workspace, props.optimistic, { idleDecayWindowMs, isActive, unreadIndicatorEnabled });
+  const { label, sessionId, isDeleting, navigationSession } = derived;
+  const [notifyPreset, setNotify] = usePendingSetting(
+    derived.notifyPreset,
+    (preset) => (sessionId ? setSessionNotifications(sessionId, preset) : Promise.resolve(false)),
+    () => reportError("Could not change notifications. Please try again."),
+  );
+  const [sessionColor, setColor] = usePendingSetting(
+    derived.sessionColor,
+    // The row shows any session's color, so every session must change for the pick to stick.
+    async (color) =>
+      (await Promise.all(workspace.sessions.map((s) => setSessionColor(s.id, color)))).every((r) => r != null),
+    () => reportError("Could not change the session color. Please try again."),
+  );
+  const model: RowModel = {
+    ...derived,
+    notifyPreset,
+    sessionColor,
+    sessionColorDot: SESSION_COLOR_OPTIONS.find((o) => o.key === sessionColor)?.dotClass ?? null,
+  };
 
   const [modal, setModal] = useState<Modal>(null);
   const [addProjectOptions, setAddProjectOptions] = useState<{ name: string; path: string }[]>([]);
@@ -108,7 +127,12 @@ export const SessionRow = memo(function SessionRow(props: SessionRowProps) {
     setRenaming(true);
     requestAnimationFrame(() => renameRef.current?.select());
   };
-  const actions = { ...buildRowActions(props, model, closeMenu, setModal), rename: startRename };
+  const actions = {
+    ...buildRowActions(props, model, closeMenu, setModal),
+    rename: startRename,
+    notify: setNotify,
+    color: setColor,
+  };
   const openAddProject = () => {
     actions.addProject();
     void fetchProjects().then((projects) =>
@@ -236,16 +260,31 @@ export const SessionRow = memo(function SessionRow(props: SessionRowProps) {
           minWidth="min-w-[240px]"
           sheetOnMobile
           label={menu.scope.kind === "bulk" ? `${menu.scope.count} selected sessions` : `${label} actions`}
+          heading={
+            menu.scope.kind === "bulk" ? (
+              <span className="text-sm text-text-primary">{menu.scope.count} selected</span>
+            ) : (
+              <span className="flex items-center gap-2 text-sm font-mono text-text-primary">
+                <span className={`shrink-0 leading-none ${model.textClass}`}>
+                  <StatusGlyph
+                    status={model.status}
+                    createdAt={model.createdAt}
+                    idleEnteredAt={model.idleEnteredAt}
+                    dormant={model.dormant}
+                  />
+                </span>
+                {model.sessionColorDot && sessionColorsEnabled && (
+                  <span className={`h-2 w-2 shrink-0 rounded-full ${model.sessionColorDot}`} aria-hidden="true" />
+                )}
+                <span className="truncate">{label}</span>
+              </span>
+            )
+          }
           onClose={closeMenu}
           returnFocusTo={rowRef}
         >
           {menu.scope.kind === "bulk" ? (
-            <BulkTriageMenuItems
-              count={menu.scope.count}
-              buckets={menu.scope.buckets}
-              api={bulkApi}
-              onDone={closeMenu}
-            />
+            <BulkTriageMenuItems buckets={menu.scope.buckets} api={bulkApi} onDone={closeMenu} />
           ) : (
             <SingleRowMenuItems
               model={model}
@@ -272,15 +311,16 @@ export const SessionRow = memo(function SessionRow(props: SessionRowProps) {
   );
 });
 
-/** Menu actions; each closes the menu first so its dismiss listener cannot race a modal mount. */
+/** Menu actions; each closes the menu first so i
```

**File**: `web/src/components/sidebar/SessionRowMenu.tsx` (modified, +53/-69)
```diff
@@ -21,7 +21,7 @@ import {
 } from "lucide-react";
 import { triageMenuShape, triageStateOf } from "../../lib/sidebarSort";
 import type { BulkTriageBuckets } from "../../lib/sidebarBulk";
-import { MenuHeading, MenuItem, MenuSeparator } from "../ContextMenu";
+import { MenuChoiceRow, MenuHeading, MenuItem, MenuSeparator, MenuSwatches } from "../ContextMenu";
 import { SNOOZE_PRESETS } from "./format";
 import { SESSION_COLOR_OPTIONS, type NotifyPreset, type RowModel } from "./rowModel";
 import type { RowBulkApi } from "./types";
@@ -31,12 +31,10 @@ const PinIcon = () => icon(Pin, "-rotate-45");
 
 /** Count-labelled triage for a multi-selection; single-row actions are absent here. */
 export function BulkTriageMenuItems({
-  count,
   buckets,
   api,
   onDone,
 }: {
-  count: number;
   buckets: BulkTriageBuckets;
   api: RowBulkApi;
   onDone: () => void;
@@ -53,7 +51,6 @@ export function BulkTriageMenuItems({
     );
   return (
     <>
-      <MenuHeading>{count} selected</MenuHeading>
       {item(buckets.pinnable, "Pin", "pin", <PinIcon />, () => api.pin(buckets.pinnable, true))}
       {item(buckets.unpinnable, "Unpin", "unpin", <PinIcon />, () => api.pin(buckets.unpinnable, false))}
       {item(buckets.archivable, "Archive", "archive", icon(Archive), () => api.archive(buckets.archivable, true))}
@@ -106,47 +103,43 @@ export interface SingleRowActions {
   remove: () => void;
 }
 
-const NOTIFY_LABELS: [NotifyPreset, string][] = [
-  ["off", "Off"],
-  ["default", "Default"],
-  ["all", "All"],
+const NOTIFY_OPTIONS: { preset: NotifyPreset; label: string; hint: string }[] = [
+  { preset: "off", label: "Off", hint: "No notifications from this session" },
+  { preset: "default", label: "Default", hint: "Follows your notification settings" },
+  { preset: "all", label: "All", hint: "Notifies when waiting, idle, or on error" },
 ];
 
 /** Icon-over-label button for the quick triage row. */
 function QuickAction({
   onClick,
   testId,
   glyph,
+  pressed,
   children,
 }: {
   onClick: () => void;
   testId: string;
   glyph: React.ReactNode;
+  /** For an in-place toggle, which keeps the menu open. */
+  pressed?: boolean;
   children: React.ReactNode;
 }) {
   return (
     <button
       type="button"
       onClick={onClick}
       data-testid={testId}
-      className="flex flex-1 min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 max-md:py-2.5 text-[11px] text-text-secondary hover:bg-surface-700/50 hover:text-text-primary cursor-pointer transition-colors"
+      aria-pressed={pressed}
+      className={`flex flex-1 min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] hover:text-text-primary cursor-pointer transition-colors ${
+        pressed ? "bg-surface-700 text-text-primary" : "text-text-secondary hover:bg-surface-700/50"
+      }`}
     >
       {glyph}
       <span className="truncate max-w-full">{children}</span>
     </button>
   );
 }
 
-/** A labelled row of inline choices, replacing a heading plus one item per option. */
-function ChoiceRow({ label, children }: { label: string; children: React.ReactNode }) {
-  return (
-    <div className="flex items-center gap-2 px-3 py-1.5 max-md:py-2">
-      <span className="w-20 shrink-0 text-xs text-text-dim">{label}</span>
-      <div className="flex flex-1 items-center gap-1">{children}</div>
-    </div>
-  );
-}
-
 export function SingleRowMenuItems({
   model,
   readOnly,
@@ -176,9 +169,6 @@ export function SingleRowMenuItems({
   };
   return (
     <>
-      <div className="px-3 pt-1.5 pb-1 text-xs font-mono text-text-muted truncate max-w-[260px] max-md:max-w-none">
-        {model.label}
-      </div>
       {write && <TriageRow model={model} unreadEnabled={unreadEnabled} actions={a} />}
       <MenuSeparator />
       <MenuItem onClick={a.rename} testId="sidebar-context-menu-rename" icon={icon(Pencil)}>
@@ -263,55 +253,39 @@ export function SingleRowMenuItems({
         </>
       )}
       <MenuSeparator />
-      <ChoiceRow label="Notify">
-        {NOTIFY_LABELS.map(([preset, label]) => (
-          <button
-            key={preset}
-            type="button"
-            onClick={() => a.notify(preset)}
-            data-testid={`sidebar-context-menu-notify-${preset}`}
-            aria-pressed={model.notifyPreset === preset}
-            className={`flex-1 rounded-md px-2 py-1 max-md:py-1.5 text-xs cursor-pointer transition-colors ${
-              model.notifyPreset === preset
-                ? "bg-surface-700 text-text-primary"
-                : "text-text-secondary hover:bg-surface-700/50"
-            }`}
-          >
-            {label}
-          </button>
-        ))}
-      </ChoiceRow>
-      {write && colorsEnabled && (
-        <ChoiceRow label="Color">
-          {SESSION_COLOR_OPTIONS.map((opt) => (
+      <MenuChoiceRow label="Notify" hint={NOTIFY_OPTIONS.find((o) => o.preset === model.notifyPreset)?.hint}>
+        <div
+          role="group"
+          aria-label="Notify"
+          cl
```

**File**: `web/src/components/sidebar/SidebarGroupHeader.tsx` (modified, +9/-26)
```diff
@@ -12,7 +12,7 @@ import { STATUS_DOT_CLASS } from "../../lib/session";
 import { workspaceAttentionCount, workspaceIsSunk } from "../../lib/sidebarSort";
 import { useSidebarCompact } from "../../lib/sidebarCompact";
 import { OFFLINE_TITLE } from "../../lib/connectionState";
-import { ContextMenu, MenuHeading, MenuItem, MenuSeparator } from "../ContextMenu";
+import { ContextMenu, MenuChoiceRow, MenuItem, MenuSeparator, MenuSwatches } from "../ContextMenu";
 import { OwnerAvatar } from "../OwnerAvatar";
 import { Tooltip } from "../Tooltip";
 import { useContextMenu } from "../useContextMenu";
@@ -305,31 +305,14 @@ function GroupMenuItems({
             <MenuItem onClick={act(() => onUpdateAppearance(group.id, { alias: null }))}>Clear alias</MenuItem>
           )}
           <MenuSeparator />
-          <MenuHeading>Background</MenuHeading>
-          <div className="grid grid-cols-4 gap-1 px-3 py-1.5">
-            {REPO_COLOR_OPTIONS.map((option) => (
-              <button
-                key={option.id}
-                type="button"
-                onClick={act(() => onUpdateAppearance(group.id, { color: option.id }))}
-                data-testid={`sidebar-group-color-${option.id}`}
-                aria-label={`Set ${option.label} background`}
-                className={`h-8 rounded-md border cursor-pointer transition-colors ${
-                  group.color === option.id ? "border-text-primary" : "border-surface-700"
-                }`}
-                style={repoSwatchStyle(option.id)}
-              />
-            ))}
-            <button
-              type="button"
-              onClick={act(() => onUpdateAppearance(group.id, { color: null }))}
-              data-testid="sidebar-group-color-clear"
-              aria-label="Clear background"
-              className="h-8 rounded-md border border-surface-700 bg-surface-900 text-[10px] font-mono text-text-dim cursor-pointer hover:bg-surface-700/40"
-            >
-              None
-            </button>
-          </div>
+          <MenuChoiceRow label="Color">
+            <MenuSwatches
+              options={REPO_COLOR_OPTIONS.map((o) => ({ key: o.id, label: o.label, style: repoSwatchStyle(o.id) }))}
+              value={group.color}
+              onPick={(color) => onUpdateAppearance(group.id, { color })}
+              testIdPrefix="sidebar-group-color"
+            />
+          </MenuChoiceRow>
         </>
       )}
     </>
```

**File**: `web/src/components/sidebar/usePendingSetting.test.ts` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+// @vitest-environment jsdom
+import { act, renderHook } from "@testing-library/react";
+import { describe, expect, it, vi } from "vitest";
+import { usePendingSetting } from "./usePendingSetting";
+
+function setup() {
+  const saves: ((ok: boolean) => void)[] = [];
+  const save = () => new Promise<boolean>((settle) => saves.push(settle));
+  const onError = vi.fn();
+  const hook = renderHook(({ server }) => usePendingSetting(server, save, onError), {
+    initialProps: { server: "x" },
+  });
+  const value = () => hook.result.current[0];
+  const pick = (next: string) => act(() => hook.result.current[1](next));
+  const poll = (server: string) => hook.rerender({ server });
+  const settle = async (i: number, ok: boolean) => act(async () => saves[i]!(ok));
+  return { value, pick, poll, settle, onError };
+}
+
+describe("usePendingSetting", () => {
+  it("holds a pick until the server moves, and lets another writer's change through", async () => {
+    const h = setup();
+    h.pick("a");
+    h.poll("x");
+    expect(h.value()).toBe("a");
+    await h.settle(0, true);
+    h.poll("b");
+    expect(h.value()).toBe("b");
+  });
+
+  it("does not flash an earlier pick landing while a later one is in flight", () => {
+    const h = setup();
+    h.pick("a");
+    h.pick("b");
+    h.poll("a");
+    expect(h.value()).toBe("b");
+    h.poll("b");
+    h.poll("c");
+    expect(h.value()).toBe("c");
+  });
+
+  it("reverts only when the latest save fails", async () => {
+    const h = setup();
+    h.pick("a");
+    h.pick("b");
+    await h.settle(0, false);
+    expect(h.value()).toBe("b");
+    expect(h.onError).not.toHaveBeenCalled();
+    await h.settle(1, false);
+    expect(h.value()).toBe("x");
+    expect(h.onError).toHaveBeenCalledOnce();
+  });
+});
```

**File**: `web/src/components/sidebar/usePendingSetting.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { useRef, useState } from "react";
+
+interface Pending<T> {
+  value: T;
+  /** The server value when the first pick was made. */
+  from: T;
+  sent: T[];
+}
+
+/** Shows a picked value until the server reports a change, reverting if the latest save fails. */
+export function usePendingSetting<T>(server: T, save: (next: T) => Promise<boolean>, onError: () => void) {
+  const [pending, setPending] = useState<Pending<T> | null>(null);
+  const latest = useRef(0);
+  // Cleared during render once the server moves, unless it moved to an earlier pick of ours while a later one is in
+  // flight. Waiting for the picked value instead would mask another writer forever.
+  if (
+    pending &&
+    !Object.is(server, pending.from) &&
+    (Object.is(server, pending.value) || !pending.sent.some((v) => Object.is(v, server)))
+  ) {
+    setPending(null);
+  }
+
+  const value = pending ? pending.value : server;
+  const set = (next: T) => {
+    if (Object.is(next, value)) return;
+    const seq = ++latest.current;
+    setPending((p) =>
+      Object.is(next, server) ? null : { value: next, from: p?.from ?? server, sent: [...(p?.sent ?? []), next] },
+    );
+    void save(next).then((ok) => {
+      if (ok || seq !== latest.current) return;
+      setPending(null);
+      onError();
+    });
+  };
+  return [value, set] as const;
+}
```

#### Recent Merged Pull Requests:
- **PR #4308** (2026-10-05): chore(deps): bump pi-acp from 0.0.33 to 0.0.34 in /acp-worker/adapters/pi-acp (@dependabot[bot])
- **PR #4305** (2026-10-04): fix(plugin): add --yes to plugin update (@cwrau)
- **PR #4304** (2026-10-04): fix(acp-client): step up an unelevated passphrase session on demand (@cwrau)
- **PR #4303** (2026-10-04): feat(serve): notify systemd when ready via sd_notify (@cwrau)
- **PR #4300** (2026-10-03): chore(deps): bump devalue from 5.9.2 to 5.9.4 in /website (@dependabot[bot])
- **PR #4298** (2026-10-04): feat(plugin): cycle grouped badge items on click (@cwrau)
- **PR #4297** (2026-10-03): feat(web): add per-block line wrap toggle for tool output (@cwrau)
- **PR #4296** (2026-10-04): feat(session): name the agent's session from a typed title on first l… (@abaro-net)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
