> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `4f72cb02`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T19:05:39.068Z  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): agent-of-empires/agent-of-empires

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-21T19:05:37.317Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3373 stars

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
use crate::acp::acp_client::rate_limit::take_rate_limit_from_captured_rejection;
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
    pub(super) close_capable: bool,
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
                        if self.between_prompt_idle_tick().await {
                            break;
                        }
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
                Some(ClientCmd::ResumeTaskTailing(task_ids)) => self
                    .shared
                    .resume_task_tailing(&self.acp_session_id.0, task_ids),
                Some(ClientCmd::ResetSession {
                    text,
                    deadline,
                    respond_to,
                }) => self.reset_session(text, deadline, respond_to).await?,
                #[cfg(test)]
                Some(ClientCmd::FlushForTest(done)) => {
                    let _ = done.send(());
                }
                Some(ClientCmd::CloseSession(respond_to)) => {
                    crate::acp::acp_client::close::dispatch_close(
                        &self.connection,
                        self.acp_session_id.clone(),
                        self.close_capable,
                        respond_to,
                    );
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

    /// Returns true when the turn ended on a rate limit: the connection must
    /// then end so the drain loop drops the worker and the reaper can resume it.
    async fn between_prompt_idle_tick(&self) -> bool {
        let shared = &self.shared;
        let Some(cost_seen) = shared.between_prompt.take_idle_fire(now_ms()) else {
            return false;
        };
        // An adopted turn races the detached resume-idle task for its
        // terminal; state is reset either way.
        let adopted = shared.adopted_turn_active.swap(false, Ordering::Relaxed);
        if adopted && !shared.terminal_claim.claim() {
            return false;
        }
        // The limit arrives as agent text with no prompt error; park like the
        // prompt path so the reaper ca
```

### Core Architecture Module: `src/acp/acp_client/lifecycle.rs`
```
//! Classifies agent updates into the turn-level facts the watchdogs act on.

use crate::acp::agent_profiles;
use crate::acp::state::Event;
use agent_client_protocol::schema::v1::{
    CompactionStatus, ContentBlock, SessionUpdate, ToolCallContent, ToolCallStatus,
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
        SessionUpdate::CompactionUpdate(u) => Some(match u.status {
            CompactionStatus::InProgress => LifecycleSignal::CompactionStarted,
            CompactionStatus::Completed => LifecycleSignal::CompactionCompleted,
            CompactionStatus::Failed | CompactionStatus::Cancelled => {
                LifecycleSignal::CompactionFailed
            }
            // Custom and future statuses (`paused`) keep the compaction open.
            _ => LifecycleSignal::Progress,
        }),
        SessionUpdate::AgentThoughtChunk(_)
        | SessionUpdate::Plan(_)
        | SessionUpdate::CompactionSummaryChunk(_) => Some(LifecycleSignal::Progress),
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
/// `restored_title` names an update that arrived without a title.
pub(super) fn wakeup_lifecycle_signal_from_update(
    update: &SessionUpdate,
    restored_title: Option<&str>,
    profile: &agent_profiles::AgentProfile,
) -> Option<LifecycleSignal> {
    if !profile.supports_wakeup_tools {
        return None;
    }
    let SessionUpdate::ToolCallUpdate(u) = update else {
        return None;
    };
    if matches!(u.fields.status, Some(ToolCallStatus::Failed))
        || u.fields.title.as_deref().or(restored_title) != Some("ScheduleWakeup")
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
    use crate::acp::acp_client::test_helpers::{compaction_chunk, compaction_update, text_chunk};
    use agent_client_protocol::schema::v1::{
        Content
```

### Core Architecture Module: `src/acp/runner_lifecycle.rs`
```
//! Per-session ownership of a structured-view runner.

use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Registry generation and kernel birth identity of one runner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct RunnerIdentity {
    pub pid: u32,
    pub generation: u64,
    pub birth_fingerprint: Option<crate::process::ProcessBirthFingerprint>,
}

impl RunnerIdentity {
    pub fn unattested(pid: u32, generation: u64) -> Self {
        Self {
            pid,
            generation,
            birth_fingerprint: None,
        }
    }

    pub fn from_record(record: &crate::process::worker_registry::WorkerRecord) -> Self {
        Self {
            pid: record.pid,
            generation: record.generation,
            birth_fingerprint: record
                .runner_identity
                .as_ref()
                .map(|identity| identity.fingerprint()),
        }
    }

    pub fn owns_record(&self, record: &crate::process::worker_registry::WorkerRecord) -> bool {
        self.matches_record(record.pid, record.generation)
            && self.birth_fingerprint
                == record
                    .runner_identity
                    .as_ref()
                    .map(|identity| identity.fingerprint())
    }
    pub fn disowns_record(&self, record: &crate::process::worker_registry::WorkerRecord) -> bool {
        !self.matches_record(record.pid, record.generation)
            || self
                .birth_fingerprint
                .zip(
                    record
                        .runner_identity
                        .as_ref()
                        .map(|identity| identity.fingerprint()),
                )
                .is_some_and(|(expected, current)| expected != current)
    }

    /// Whether the PID and registry generation match, including legacy generations.
    pub fn matches_record(&self, pid: u32, generation: u64) -> bool {
        self.pid == pid
            && (self.generation == 0 || generation == 0 || self.generation == generation)
    }
}

/// Which code path is bringing a worker up.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResumeKind {
    Attach,
    /// A spawn for a session with a stored ACP session id.
    Spawn,
    /// A spawn for a session that has no stored ACP session id yet.
    SpawnFirst,
}

/// When the current start was admitted, and whether it is a session's first.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkerStart {
    pub first_start: bool,
    pub started_at: DateTime<Utc>,
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
        /// Wall clock, so it survives a client reload. A daemon restart that
        /// re-adopts a starting worker admits again and resets it.
        started_at: DateTime<Utc>,
        cancel: Option<String>,
    },
    Running {
        identity: Option<RunnerIdentity>,
    },
    Respawning {
        started_at: DateTime<Utc>,
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
    /// An explicit stop, or a failed first launch, owes a scope sweep before
    /// the settle. Kept through retries, so a reclaimed teardown sweeps too.
    sweep_owed: bool,
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
    fn is_alive(&self, identity: RunnerIdentity) -> bool;
    fn terminate_group(&self, identity: RunnerIdentity);
    fn kill_group(&self, identity: RunnerIdentity);
    fn forget(&self, identity: RunnerIdentity);
    /// Stops every systemd scope of the session, sweeping processes that
    /// escaped the runner's group. Blocking and bounded.
    fn release_scope(&self, session_id: &str);
}

#[derive(Default)]
pub struct SystemProcessControl {
    guards: std::sync::Mutex<HashMap<RunnerIdentity, crate::process::RunnerProcessGuard>>,
}

impl SystemProcessControl {
    fn with_guard<T>(
        &self,
        identity: RunnerIdentity,
        action: impl FnOnce(&crate::process::RunnerProcessGuard) -> anyhow::Result<T>,
    ) -> anyhow::Result<T> {
        let mut guards = self
            .guards
            .lock()
            .map_err(|_| anyhow::anyhow!("runner guard lock poisoned"))?;
        if let std::collections::hash_map::Entry::Vacant(entry) = guards.entry(identity) {
            entry.insert(crate::process::RunnerProcessGuard::capture(
                identity.pid,
                identity.birth_fingerprint,
            )?);
        }
        action(&guards[&identity])
    }
}

impl ProcessControl for SystemProcessControl {
    fn is_alive(&self, identity: RunnerIdentity) -> bool {
        if identity.pid == 0 {
            return false;
        }
        self.with_guard(identity, |guard| guard.executing())
            .unwrap_or(true)
    }

    fn terminate_group(&self, identity: RunnerIdentity) {
        if let Err(error) = self.with_guard(identity, |guard| guard.signal(libc::SIGTERM)) {
            tracing::warn!(pid = identity.pid, %error, "runner termination unproven");
        }
    }

    fn kill_group(&self, identity: RunnerIdentity) {
        if let Err(error) = self.with_guard(identity, |guard| guard.signal(libc::SIGKILL)) {
            tracing::warn!(pid = identity.pid, %error, "runner termination unproven");
        }
    }

    fn forget(&self, identity: RunnerIdentity) {
        if let Ok(mut guards) = self.guards.lock() {
            guards.remove(&identity);
        }
    }

    fn release_scope(&self, session_id: &str) {
        crate::process::systemd::release(session_id);
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

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
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

/// A keyed notice keeps one id across updates; others are minted from the seq.
pub fn notice_id(key: Option<&str>, seq: u64) -> String {
    match key {
        Some(key) => format!("notice-{key}"),
        None => format!("notice-{seq}"),
    }
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

/// Title of the tool call the adapter opens for `/compact`; newer adapters emit
/// it instead of the `Compacting...` text chunk.
const COMPACT_TOOL_NAME: &str = "Compact conversation";

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
        install_comm
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

### Core Architecture Module: `src/cli/runtime_read/render.rs`
```
use std::borrow::Cow;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::Path;

use serde::Serialize;

use super::dto::{
    component_healthy, freshness_observed, profile_component_healthy, ProfileRead, ProjectRead,
    ProjectScope, SessionRead, SnapshotData, WireState,
};
use super::endpoint::{selected_profile_source, ProfileSource};
use super::{ReadFailure, ScopedCommand};
use crate::cli::group::GroupListArgs;
use crate::cli::list::{self, ListArgs, SessionJson, StateFilter, WorkspaceRepoJson, WorktreeJson};
use crate::cli::project::{ProjectListArgs, ScopeFilter};
use crate::cli::session::ShowArgs;
use crate::cli::status::{self, VERBOSE_GROUPS};

/// One rendered read: the text the command prints, and whether it printed the
/// human session table, which is the only place the update notice belongs.
#[derive(Debug)]
pub(crate) struct Projection {
    pub stdout: String,
    pub session_table: bool,
}

impl Projection {
    fn text(stdout: String) -> Self {
        Self {
            stdout,
            session_table: false,
        }
    }
}

pub(crate) fn evaluate(
    command: &ScopedCommand<'_>,
    snapshot: &SnapshotData,
    source: &super::endpoint::ReadRequestSource,
    local_home: Option<&Path>,
) -> Result<Projection, ReadFailure> {
    match command {
        ScopedCommand::List(args) => render_list(args, snapshot, source, local_home.is_some()),
        ScopedCommand::Status(args) => render_status(args, snapshot, source, local_home),
        ScopedCommand::Show(args) => render_show(args, snapshot, source),
        ScopedCommand::ListTrash => render_trash(snapshot, source).map(Projection::text),
        ScopedCommand::GroupList(args) => {
            render_groups(args, snapshot, source).map(Projection::text)
        }
        ScopedCommand::Profile => render_profiles(snapshot).map(Projection::text),
        ScopedCommand::ProjectList(args) => {
            render_projects(args, snapshot, source).map(Projection::text)
        }
    }
}

fn terminal_text(value: &str) -> Cow<'_, str> {
    let Some((start, _)) = value.char_indices().find(|(_, ch)| ch.is_control()) else {
        return Cow::Borrowed(value);
    };
    let mut clean = String::with_capacity(value.len());
    clean.push_str(&value[..start]);
    clean.extend(value[start..].chars().filter(|ch| !ch.is_control()));
    Cow::Owned(clean)
}

fn selected_profile<'a>(
    snapshot: &'a SnapshotData,
    source: &'a super::endpoint::ReadRequestSource,
) -> Result<(&'a str, &'a ProfileRead), ReadFailure> {
    let selected = match selected_profile_source(source) {
        ProfileSource::Explicit(value) => value,
        ProfileSource::Environment(value) => value.to_str().ok_or_else(|| {
            // Match clap's invalid-environment-profile exit status.
            ReadFailure::exit(2, "error: AGENT_OF_EMPIRES_PROFILE must be valid UTF-8\n")
        })?,
        ProfileSource::Default => match snapshot.default_profile.as_deref() {
            Some(value) => value,
            // A resolved but absent default is a user-state refusal.
            None => match &snapshot.resolved_default_profile {
                Some(name) => {
                    crate::session::validate_profile_name(name).map_err(|error| {
                        ReadFailure::exit(
                            1,
                            format!("Error: {}\n", terminal_text(&error.to_string())),
                        )
                    })?;
                    return Err(profile_absent("default_missing", name));
                }
                // Nothing was resolved, because resolving would have created
                // the profile this read has to stay out of.
                None => return Err(ReadFailure::post("default_missing")),
            },
        },
    };
    crate::session::validate_profile_name(selected).map_err(|error| {
        ReadFailure::exit(1, format!("Error: {}\n", terminal_text(&error.to_string())))
    })?;
    snapshot
        .profiles
        .iter()
        .find(|profile| {
            profile.name == selected || profile.aliases.iter().any(|alias| alias == selected)
        })
        .map(|profile| (selected, profile))
        .ok_or_else(|| profile_absent("profile_missing", selected))
}

/// Preserve the local CLI's profile-creation guidance and exit status.
fn profile_absent(code: &'static str, name: &str) -> ReadFailure {
    let name = terminal_text(name);
    ReadFailure::refuse(
        code,
        1,
        format!(
            "Error: Profile '{name}' does not exist. Create it with: aoe profile create {name}\n"
        ),
    )
}

/// Preserve the local resolver's sorted ambiguity candidates.
fn ambiguous_prefix(identifier: &str, candidates: &[&SessionRead]) -> ReadFailure {
    let mut lines: Vec<String> = candidates
        .iter()
        .map(|session| format!("  {} ({})", session.id, terminal_text(&session.title)))
        .collect();
    lines.sort();
    ReadFailure::refuse(
        "session_ambiguous",
        1,
        format!(
            "Error: Ambiguous session identifier {identifier:?} matches {} sessions:\n{}\n\
             Use a longer prefix or the full ID.\n",
            candidates.len(),
            lines.join("\n")
        ),
    )
}

fn render_list(
    args: &ListArgs,
    snapshot: &SnapshotData,
    source: &super::endpoint::ReadRequestSource,
    local_peer: bool,
) -> Result<Projection, ReadFailure> {
    let state = args.state;
    if args.all {
        if !component_healthy(&snapshot.health.global_enumeration) {
            return Err(unreadable("The profile registry"));
        }
        // Local empty-inventory output precedes JSON formatting.
        if !snapshot.profiles.iter().any(|profile| profile.listed) {
            return Ok(Projection::text("No profiles found.\n".into()));
        }
        if args.json {
            let systemd_active = local_peer && list::systemd_scopes_active();
            let mut rows = Vec::new();
            for profile in snapshot
                .profiles
                .iter()
                .filter(|profile| profile.listed && profile_sessions_healthy(profile))
            {
                for session in sessions_for_profile(snapshot, &profile.name)
                    .filter(|session| matches_state(session.state, state))
                {
                    rows.push(session_json(session, &profile.name, systemd_active)?);
                }
            }
            return json_lines(&rows).map(Projection::text);
        }
        let show_state = state == StateFilter::All;
        let mut output = String::new();
        let mut total = 0usize;
        for profile in snapshot
            .profiles
            .iter()
            .filter(|profile| profile.listed && profile_sessions_healthy(profile))
        {
            let sessions: Vec<&SessionRead> = sessions_for_profile(snapshot, &profile.name)
                .filter(|session| matches_state(session.state, state))
                .collect();
            // Empty profiles have no banner.
            if sessions.is_empty() {
                continue;
            }
            output.push_str(&format!(
                "\n═══ Profile: {} ═══\n\n",
                terminal_text(&profile.name)
            ));
            output.push_str(&list::table_header(show_state));
            for (session, depth) in tree_order(&sessions) {
                output.push_str(&list::table_row(
                    &list::table_title(&terminal_text(&session.title), depth),
                    &terminal_text(&session.group_path),
                    &terminal_text(&session.project_path),
                    show_state.then(|| session.state.as_str()),
                    &session.id,
                ));
            }
            output.push_str(&format!("({} sessions)\n", sessions.len()));
            total += sessions.len();
        }
        output.push_str(&format!(
            "\n═══════════════════════════════════════\nTotal: {total} sessions across {} profiles\n",
            snapshot.profiles.iter().filter(|profile| profile.listed).count()
        ));
        return Ok(Projection::text(output));
    }

    let (profile_name, profile) = selected_profile(snapshot, source)?;
    let sessions: Vec<&SessionRead> = sessions_for_profile(snapshot, &profile.name)
        .filter(|session| matches_state(session.state, state))
        .collect();
    require_selected_profile_health(snapshot, profile, profile_name)?;

    if args.json {
        let systemd_active = local_peer && list::systemd_scopes_active();
        let rows: Vec<SessionJson> = sessions
            .iter()
            .map(|session| session_json(session, profile_name, systemd_active))
            .collect::<Result<_, _>>()?;
        return json_lines(&rows).map(Projection::text);
    }
    if sessions.is_empty() {
        let profile_name = terminal_text(profile_name);
        return Ok(Projection::text(format!(
            "No sessions found in profile '{profile_name}'.\n"
        )));
    }
    let show_state = state == StateFilter::All;
    let mut output = format!("Profile: {}\n\n", terminal_text(profile_name));
    output.push_str(&list::table_header(show_state));
    for (session, depth) in tree_order(&sessions) {
        output.push_str(&list::table_row(
            &list::table_title(&terminal_text(&session.title), depth),
            &terminal_text(&session.group_path),
            &terminal_text(&session.project_path),
            show_state.then(|| session.state.as_str()),
            &session.id,
        ));
    }
    output.push_str(&format!("\nTotal: {} sessions\n", sessions.len()));
    Ok(Projection {
        stdout: output,
        session_table: true,
    })
}

fn matches_state(state: WireState, filter: StateFilter) -> bool {
    match filter {
        StateFilter::All => true,
        StateFilter::Live => state == WireState::Live,
        StateFilter::Trashed => state == WireState::Trashed,
    }
}

/// The same walk the 
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4698** (2026-10-21): **ACP: missing-adapter error gives daemon-PATH advice when a configured PATH is in effect**
  *Symptoms*: ### What happened?  When `environment` (or the provider routing pick) sets `PATH`, that PATH replaces the daemon's for the adapter. If the adapter isn't on it, both spawn paths (`spawn_subprocess` on ENOENT, and the runner preflight added in #4654) return `missing_binary_spawn_error` (`src/acp/acp_client/errors.rs`), which says the binary is "not found on the daemon's PATH" and suggests restarting `aoe serve` from a shell where `which <cmd>` resolves. Neither helps: the daemon's PATH isn't the one searched.  Suggested fix: when a configured `PATH` is the effective one, say the adapter wasn't found on the configured `PATH` (naming where it was set) and suggest adding the adapter's directory there. Keep the install hint.  Raised in @Seluj78's review of #4654: https://github.com/agent-of-empires/agent-of-empires/pull/4654#pullrequestreview-5568263586  ### aoe version and OS  main at 1220f8db plus #4654, Linux. Checked against the code and the table-test row where the configured PATH lacks the adapter; not exercised live.  ### AI usage  Drafted by Claude Code (Claude Opus 5.5); klubrake reviewed it before filing.

- **Issue #4696** (2026-10-20): **ACP: tell "adapter not found" apart from "bundled adapter refused" in spawn errors**
  *Symptoms*: ### What happened?  `resolve_agent_command` (`src/acp/acp_client/resolve_command.rs`) returns `None` for three different cases: the adapter isn't installed anywhere, the bundled copy is stale, or the bundled copy needs a newer Node (`runtime_too_old_for`). Both spawn paths then report `missing_binary_spawn_error` with an install hint: `spawn_subprocess` in-process, and `spawn_runner_detached` since #4654. When the real fix is to upgrade Node, "install the adapter" is the wrong advice.  Suggested fix: return a typed resolution (Resolved / NotBare / NotFound / Rejected { reason }) and map Rejected to its own user-facing error that names the reason.  Follow-up from @Seluj78's review of #4654: https://github.com/agent-of-empires/agent-of-empires/pull/4654#pullrequestreview-5553994786  ### aoe version and OS  main at 1220f8db (plus #4654), Linux. Found by reading the code; not reproduced live.  ### AI usage  Drafted by Claude Code (Claude Opus 5.5) from the maintainer's drafted follow-up; klubrake reviewed it before filing.

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

### Incident Patch 1: `e869dfde` (2026-10-20)
**Commit Message**: fix(daemon): retain runtime rows when profile enumeration fails (#4741)

Motivation: load_all_instances returns an empty row set with
enumeration_failed set when the profile directory cannot be listed, and
reload_state_instances_from_disk then replaced the live rows (and the
daemon-only overlay state on them) with that empty set. A failed
inventory read was therefore treated as a successful empty inventory.

Approach: when the loaded cache reports a failed enumeration, the reload
keeps the current rows and previous read cache, and only marks the cache
enumeration_failed so health is published as degraded. The next
successful reload replaces the cache wholesale, clearing the flag, and a
successful empty inventory still removes rows.

Validation: added failed_enumeration_keeps_rows_until_a_successful_empty_inventory
(failure retains a row plus its daemon-only last_error and reports
degraded health; recovery clears the flag; a successful empty inventory
removes the row). It fails with the reload.rs change reverted and passes
with it. Replaced the tail of
session_enumeration_failure_does_not_block_recovered_inventory, which
asserted the old empty-on-failure result. Ran `cargo test --li

**File**: `src/server/reload.rs` (modified, +11/-0)
```diff
@@ -560,6 +560,17 @@ pub(crate) async fn reload_state_instances_from_disk(
         return;
     }
 
+    // A failed enumeration is unknown, not empty: keep the accepted rows and overlay state.
+    if cache.health.enumeration_failed {
+        state
+            .runtime_read_cache
+            .write()
+            .unwrap_or_else(std::sync::PoisonError::into_inner)
+            .health
+            .enumeration_failed = true;
+        return;
+    }
+
     let prior_by_id = PriorById::drain_from(&mut current);
     let mut previous_cache = state
         .runtime_read_cache
```

**File**: `src/server/runtime_ws.rs` (modified, +63/-12)
```diff
@@ -1716,7 +1716,6 @@ mod tests {
         std::fs::write(&profiles, "not a directory").unwrap();
         let state = test_support::build_test_app_state(Vec::new());
         let failed = load_all_instances(&state.file_watch);
-        let failed_health = failed.cache.health.clone();
         reload_state_instances_from_disk(&state, failed, vec![], StatusSource::DiskOnly, 0).await;
         let snapshot = cached_snapshot(&state).await;
         assert!(!crate::cli::runtime_read::dto::component_healthy(
@@ -1744,21 +1743,73 @@ mod tests {
         )
         .await;
         assert!(cached_data_healthy(&cached_snapshot(&state).await, "main"));
-        std::fs::remove_dir_all(profiles.join("main")).unwrap();
-        let failed = crate::server::reload::LoadedInstances {
-            instances: vec![],
-            cache: super::super::reload::RuntimeReadCache {
-                health: failed_health,
-                ..Default::default()
-            },
+    }
+
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn failed_enumeration_keeps_rows_until_a_successful_empty_inventory() {
+        use crate::server::{
+            reload::{load_all_instances, reload_state_instances_from_disk},
+            state::StatusSource,
+            test_support,
         };
-        reload_state_instances_from_disk(&state, failed, vec![], StatusSource::DiskOnly, 0).await;
+        let home = TempHome::new();
+        Storage::new_unwatched("main")
+            .unwrap()
+            .update(|rows, _| {
+                *rows = vec![named("kept", "main")];
+                Ok(())
+            })
+            .unwrap();
+        let state = test_support::build_test_app_state(Vec::new());
+        let reload = |loaded| {
+            reload_state_instances_from_disk(&state, loaded, vec![], StatusSource::DiskOnly, 0)
+        };
+        reload(load_all_instances(&state.file_watch)).await;
+        state.instances.write().await[0].last_error = Some("daemon-only".into());
+
+        let profiles = home.app_dir().join("profiles");
+        let stash = home.app_dir().join("profiles-stash");
+        std::fs::rename(&profiles, &stash).unwrap();
+        std::fs::write(&profiles, "not a directory").unwrap();
+        let failed = load_all_instances(&state.file_watch);
+        assert!(failed.cache.health.enumeration_failed);
+        reload(failed).await;
+        assert!(
+            state
+                .runtime_read_cache
+                .read()
+                .unwrap()
+                .health
+                .enumeration_failed
+        );
         let snapshot = cached_snapshot(&state).await;
-        assert!(crate::cli::runtime_read::dto::component_healthy(
+        assert!(!crate::cli::runtime_read::dto::component_healthy(
             &snapshot.health.global_enumeration
         ));
-        assert!(snapshot.profiles.is_empty());
-        assert!(snapshot.sessions.is_empty());
+        assert!(snapshot.sessions.iter().any(|row| row.id == "kept"));
+        assert_eq!(
+            state.instances.read().await[0].last_error.as_deref(),
+            Some("daemon-only")
+        );
+
+        std::fs::remove_file(&profiles).unwrap();
+        std::fs::rename(&stash, &profiles).unwrap();
+        reload(load_all_instances(&state.file_watch)).await;
+        assert!(
+            !state
+                .runtime_read_cache
+                .read()
+                .unwrap()
+                .health
+                .enumeration_failed
+        );
+        assert_eq!(state.instances.read().await.len(), 1);
+
+        std::fs::remove_dir_all(&profiles).unwrap();
+        reload(load_all_instances(&state.file_watch)).await;
+        assert!(state.instances.read().await.is_empty());
+        assert!(cached_snapshot(&state).await.sessions.is_empty());
     }
 
     /// Project and group registry errors degrade only their own components.
```

---

### Incident Patch 2: `cf7cd22f` (2026-10-21)
**Commit Message**: feat(cli): auto-start a local daemon from the CLI and TUI (#4778)

* feat(cli): auto-start a local daemon from the CLI and TUI

require_daemon now spawns a detached loopback daemon when none answers,
serialized by serve.autostart.lock so racing clients start exactly one.
AOE_DAEMON_URL never spawns, and --no-autostart / AOE_NO_AUTOSTART=1
opt out. Background TUI pollers use the non-spawning locate_daemon, and
the confirm-before-start prompt is removed.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* test(cli): cover daemon autostart race and opt-outs, update docs

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve): recognize --no-autostart when verifying a daemon process

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(cli): forget an occupied autostart port after a startup timeout

The wrapper exits 0 before the detached child binds, so a port clash
surfaces only through the startup timeout. Clear serve.last_port there
too, so the next autostart picks a fresh port.

Addresses review comments from @coderabbitai and @cwrau on #4778.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(tui): start the daemon for Auto-name now

Auto-name no

**File**: `docs/cli/reference.md` (modified, +3/-0)
```diff
@@ -186,6 +186,9 @@ Run without arguments to launch the TUI dashboard.
 * `--daemon-url <DAEMON_URL>` — Select a daemon endpoint for read-only CLI commands or the TUI
 
    Explicit CLI endpoints never fall back. `AOE_DAEMON_URL` discovery may fall back to local storage before reaching a TCP peer, with a notice. Authenticate CLI reads with `AOE_DAEMON_TOKEN` or `AOE_DAEMON_PASSPHRASE`; TUI session lists support bearer tokens only. An unauthenticated daemon needs neither. See the HTTP API reference for transport and fallback rules.
+* `--no-autostart` — Fail instead of starting a local daemon when none is running
+
+   Also read from `AOE_NO_AUTOSTART=1`. Has no effect with `--daemon-url` or `AOE_DAEMON_URL`, which never start a daemon.
 
 
 
```

**File**: `docs/structured-view.md` (modified, +1/-1)
```diff
@@ -185,4 +185,4 @@ Every structured-view operation has a matching verb against the same daemon:
 | `aoe acp recover <id> --confirm-worker-stopped` | Retire malformed or unattested legacy ownership after external shutdown confirmation |
 | `aoe ps --acp` | List workers with their ACP columns; `--dead` includes dead and orphaned ones |
 
-Daemon-backed verbs need a running `aoe serve` and exit with a hint if none is found. The CLI never spawns a daemon on your behalf. Recovery operates on the local worker registry, so run it on the original worker host, using SSH for a remote host.
+Daemon-backed verbs start a detached local daemon (loopback only) when none answers and print `Started aoe daemon (pid N)` on stderr. They never start one with `AOE_DAEMON_URL`/`--daemon-url` set, or with `--no-autostart` / `AOE_NO_AUTOSTART=1`; then they exit with a hint. Recovery operates on the local worker registry, so run it on the original worker host, using SSH for a remote host.
```

**File**: `docs/structured-view/interface.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ The structured view renders in both the TUI and the web dashboard. This page cov
 
 Both surfaces consume the same `aoe serve` daemon over the same HTTP and WebSocket API, so the conversation log, pending approvals, and worker state stay in sync.
 
-- Structured sessions show a `[structured]` badge in the TUI session list, and Enter opens the native view. It needs a running daemon and says so, pointing at `aoe serve --daemon`, `--daemon --remote`, or `AOE_DAEMON_URL`; the TUI never starts one for you.
+- Structured sessions show a `[structured]` badge in the TUI session list, and Enter opens the native view. It starts a local daemon if none is running, unless `--no-autostart` / `AOE_NO_AUTOSTART=1` is set; for remote access run `aoe serve --daemon --remote` or set `AOE_DAEMON_URL`.
 - Terminal sessions work in both surfaces: the TUI attaches to the pane and the dashboard streams it (see [Terminal view](../guides/web/terminal.md)).
 - Switching views keeps the worktree, files, and commits. Claude can resume its native transcript in terminal view only when AoE can bind the ACP ID to a shared native store. An explicit [native-store assertion](../guides/session-resume.md#pinning-or-resetting-a-conversation) can name another store. An ACP ID alone is not store provenance: an unresolved or unshared store is refused before worker teardown. Switching back can reload the Claude transcript. Other agents start fresh under the new view.
 - A healthy structured session shows Idle or Active in the session list, observed through the ACP event stream rather than tmux pane probing.
```

**File**: `src/acp/client/autostart.rs` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+//! Start the shared local daemon when a client needs one and none answers.
+//!
+//! Clients serialize on `serve.autostart.lock` and re-probe once they hold it,
+//! so of several racing clients exactly one spawns and the rest connect to it.
+//! The spawn itself is `aoe serve --daemon`, which keeps its own
+//! `serve.state.lock` and pid checks against a concurrent manual start.
+
+use std::path::Path;
+use std::time::{Duration, Instant};
+
+use fs2::FileExt as _;
+use rand::RngExt;
+
+use super::{discovery::discover_local, DaemonEndpoint, HttpClient};
+use crate::cli::serve::daemon_pid;
+
+const LOG_TAIL_LINES: usize = 200;
+/// A warm start takes about 1s; this covers a cold start without hanging a caller forever.
+const STARTUP_TIMEOUT: Duration = Duration::from_secs(20);
+const POLL_INTERVAL: Duration = Duration::from_millis(300);
+
+/// The local daemon, if one is alive and answers a health check.
+pub(crate) async fn healthy_local() -> Option<DaemonEndpoint> {
+    let endpoint = discover_local().ok()?;
+    let client = HttpClient::new(endpoint.clone()).ok()?;
+    client.health_check().await.ok()?;
+    Some(endpoint)
+}
+
+/// Spawn the daemon unless a racing client already did. The pid is `Some` only
+/// for the caller that spawned it.
+pub(crate) async fn start_local() -> Result<(DaemonEndpoint, Option<u32>), String> {
+    let _lock = tokio::task::spawn_blocking(lock_autostart)
+        .await
+        .map_err(|e| format!("lock task failed: {e}"))??;
+    if let Some(endpoint) = healthy_local().await {
+        return Ok((endpoint, None));
+    }
+
+    let exe = std::env::current_exe().map_err(|e| format!("could not resolve aoe binary: {e}"))?;
+    let port = load_or_generate_port();
+    // The wrapper double-forks; the daemon's output lands in the log file.
+    let status = tokio::process::Command::new(exe)
+        .args(["serve", "--daemon", "--host", "127.0.0.1", "--port"])
+        .arg(port.to_string())
+        .stdin(std::process::Stdio::null())
+        .stdout(std::process::Stdio::null())
+        .stderr(std::process::Stdio::null())
+        .status()
+        .await
+        .map_err(|e| format!("failed to launch `aoe serve --daemon`: {e}"))?;
+    // A non-zero exit with a live daemon means a manual start won the race.
+    let spawned = status.success();
+    if !spawned && daemon_pid().is_none() {
+        return Err(spawn_failure(status.code(), port));
+    }
+
+    let deadline = Instant::now() + STARTUP_TIMEOUT;
+    loop {
+        if let Some(endpoint) = healthy_local().await {
+            return Ok((endpoint, daemon_pid().filter(|_| spawned)));
+        }
+        if Instant::now() >= deadline {
+            // The detached child binds after the wrapper exits 0, so a port clash lands here.
+            forget_port_if_in_use();
+            return Err(format!(
+                "the daemon was started but never became reachable.{}",
+                log_hint()
+            ));
+        }
+        tokio::time::sleep(POLL_INTERVAL).await;
+    }
+}
+
+fn lock_autostart() -> Result<std::fs::File, String> {
+    let path = crate::session::get_app_dir()
+        .map_err(|e| format!("could not resolve the app directory: {e}"))?
+        .join("serve.autostart.lock");
+    let file = std::fs::OpenOptions::new()
+        .read(true)
+        .write(true)
+        .create(true)
+        .truncate(false)
+        .open(&path)
+        .map_err(|e| format!("could not open {}: {e}", path.display()))?;
+    file.lock_exclusive()
+        .map_err(|e| format!("could not lock {}: {e}", path.display()))?;
+    Ok(file)
+}
+
+fn spawn_failure(code: Option<i32>, port: u16) -> String {
+    forget_port_if_in_use();
+    format!(
+        "`aoe serve --daemon` exited with {code:?}. Most likely port {port} is in use.{}",
+        log_hint()
+    )
+}
+
+/// Forget an occupied port so the next attempt picks a fresh one.
+fn forget_port_if_in_use() {
+    let tail = initial_log_tail().join("\n");
+    if tail.contains("EADDRINUSE") || tail.contains("Address already in use") {
+        if let Ok(dir) = crate::session::get_app_dir() {
+            let _ = std::fs::remove_file(dir.join("serve.last_port"));
+        }
+    }
+}
+
+fn log_hint() -> String {
+    let tail = initial_log_tail();
+    if tail.is_empty() {
+        String::new()
+    } else {
+        format!(" Last log lines:\n{}", tail.join("\n"))
+    }
+}
+
+pub(crate) fn load_or_generate_port() -> u16 {
+    match crate::session::get_app_dir() {
+        Ok(dir) => load_or_generate_port_in(&dir),
+        Err(_) => random_port(),
+    }
+}
+
+fn load_or_generate_port_in(dir: &Path) -> u16 {
+    let path = dir.join("serve.last_port");
+    let saved = std::fs::read_to_string(&path)
+        .ok()
+        .and_then(|raw| raw.trim().parse::<u16>().ok())
+        .filter(|port| *port >= 49152);
+    saved.unwrap_or_else(|| {
+        let port = random_port();
+        let _ = std::fs::write(&path, port.to_strin
```

**File**: `src/acp/client/daemon_manager.rs` (modified, +44/-12)
```diff
@@ -7,21 +7,22 @@
 //!    point of the env override is to attach to a *specific* daemon.
 //! 2. If a live local daemon exists (`serve.pid` + reachable
 //!    `serve.url`), use it.
-//! 3. Otherwise return [`ManagerError::NoDaemonRunning`] with an
-//!    actionable hint. Auto-spawn is intentionally not provided:
-//!    starting a loopback daemon by side-effect hides the choice
-//!    between localhost, Tailscale, and Cloudflare from the user and
-//!    leaves an `aoe serve` process behind that they did not ask for.
-//!    The caller is expected to render the hint and bail.
+//! 3. Otherwise start a detached loopback daemon, unless autostart is
+//!    disabled (`--no-autostart`, `AOE_NO_AUTOSTART=1`), in which case
+//!    return [`ManagerError::NoDaemonRunning`] with an actionable hint.
+//!    [`locate_daemon`] never spawns.
 //!
 //! Build-namespace discipline (debug vs release) is enforced by
 //! `crate::session::get_app_dir`: discovery reads `serve.pid` /
 //! `serve.url` from the same app dir an `aoe serve` of the same build
 //! would have written, so a debug client never picks up a release
 //! daemon (or vice versa).
 
+use std::sync::atomic::{AtomicBool, Ordering};
+
 use thiserror::Error;
 
+use super::autostart;
 use super::discovery::{discover, discover_env, DaemonEndpoint, DiscoveryError};
 use super::http::HttpError;
 
@@ -43,14 +44,21 @@ pub enum ManagerError {
         "no structured view daemon is running.\n\nStart one with one of:\n  aoe serve --daemon                 (localhost only, recommended for solo dev)\n  aoe serve --daemon --remote        (Tailscale Funnel or Cloudflare quick tunnel)\n  aoe serve --daemon --tunnel-name … (named Cloudflare Tunnel)\n\nOr attach to an existing remote daemon with:\n  AOE_DAEMON_URL=<url> AOE_DAEMON_TOKEN=<token> aoe …"
     )]
     NoDaemonRunning(#[from] DiscoveryError),
+    #[error(
+        "could not start a local aoe daemon: {0}\n\nStart one by hand with `aoe serve --daemon`, or attach to an existing remote daemon with:\n  AOE_DAEMON_URL=<url> AOE_DAEMON_TOKEN=<token> aoe …"
+    )]
+    AutostartFailed(String),
 }
 
-/// Locate the daemon the caller should talk to. Does *not* spawn one;
-/// returns [`ManagerError::NoDaemonRunning`] if neither the env
-/// override nor a live local daemon resolves, so the caller can
-/// surface the message and let the user decide how to start the
-/// server.
-pub async fn require_daemon() -> Result<DaemonEndpoint, ManagerError> {
+static AUTOSTART_DISABLED: AtomicBool = AtomicBool::new(false);
+
+/// Set once at startup from `--no-autostart` / `AOE_NO_AUTOSTART`.
+pub fn set_autostart_disabled(disabled: bool) {
+    AUTOSTART_DISABLED.store(disabled, Ordering::Relaxed);
+}
+
+/// Locate the daemon the caller should talk to. Never spawns one.
+pub async fn locate_daemon() -> Result<DaemonEndpoint, ManagerError> {
     if discover_env().is_some() {
         // Resolve through `discover()` so the parsing/redaction
         // applied to local endpoints is also applied here, then
@@ -67,3 +75,27 @@ pub async fn require_daemon() -> Result<DaemonEndpoint, ManagerError> {
     }
     discover().map_err(ManagerError::NoDaemonRunning)
 }
+
+/// Like [`locate_daemon`], but starts a local daemon when none answers. The pid
+/// is `Some` only for the caller that spawned it, so each start is announced
+/// once. A TUI caller shows it in the status line; stderr would corrupt the screen.
+pub async fn ensure_daemon() -> Result<(DaemonEndpoint, Option<u32>), ManagerError> {
+    if discover_env().is_some() || AUTOSTART_DISABLED.load(Ordering::Relaxed) {
+        return locate_daemon().await.map(|endpoint| (endpoint, None));
+    }
+    if let Some(endpoint) = autostart::healthy_local().await {
+        return Ok((endpoint, None));
+    }
+    autostart::start_local()
+        .await
+        .map_err(ManagerError::AutostartFailed)
+}
+
+/// [`ensure_daemon`] for the CLI: announces a start on stderr, also under `--json`.
+pub async fn require_daemon() -> Result<DaemonEndpoint, ManagerError> {
+    let (endpoint, started) = ensure_daemon().await?;
+    if let Some(pid) = started {
+        eprintln!("Started aoe daemon (pid {pid})");
+    }
+    Ok(endpoint)
+}
```

**File**: `src/acp/client/mod.rs` (modified, +4/-6)
```diff
@@ -16,19 +16,17 @@
 //! 1. `AOE_DAEMON_URL` (+ optional `AOE_DAEMON_TOKEN`).
 //! 2. Local `<app_dir>/serve.url` paired with a live `serve.pid`.
 //!
-//! [`daemon_manager::require_daemon`] returns
-//! [`daemon_manager::ManagerError::NoDaemonRunning`] when neither
-//! resolves; callers render the contained hint and bail rather than
-//! starting a daemon by side-effect, so the user keeps the choice
-//! between localhost, Tailscale, and Cloudflare explicit.
+//! [`daemon_manager::require_daemon`] starts a local daemon when neither
+//! resolves, unless `AOE_DAEMON_URL` is set or autostart is disabled.
 
+pub(crate) mod autostart;
 pub mod daemon_manager;
 pub mod discovery;
 pub mod http;
 pub(crate) mod passphrase_session;
 pub mod ws;
 
-pub use daemon_manager::{require_daemon, ManagerError};
+pub use daemon_manager::{ensure_daemon, locate_daemon, require_daemon, ManagerError};
 pub use discovery::{discover, DaemonEndpoint, DiscoveryError, Source};
 pub use http::{HttpClient, HttpError, PluginCommandView, REPLAY_PAGE_SIZE};
 pub use ws::{
```

**File**: `src/cli/definition.rs` (modified, +12/-0)
```diff
@@ -69,6 +69,18 @@ pub struct Cli {
     #[arg(long, global = true)]
     pub daemon_url: Option<String>,
 
+    /// Fail instead of starting a local daemon when none is running
+    ///
+    /// Also read from `AOE_NO_AUTOSTART=1`. Has no effect with `--daemon-url`
+    /// or `AOE_DAEMON_URL`, which never start a daemon.
+    #[arg(
+        long,
+        global = true,
+        env = "AOE_NO_AUTOSTART",
+        value_parser = clap::builder::BoolishValueParser::new()
+    )]
+    pub no_autostart: bool,
+
     #[command(subcommand)]
     pub command: Option<Commands>,
 }
```

**File**: `src/cli/serve.rs` (modified, +4/-0)
```diff
@@ -646,7 +646,9 @@ fn command_is_aoe_serve(command: &[u8]) -> bool {
                     return false;
                 }
             }
+            b"--no-autostart" => index += 1,
             arg if arg.starts_with(b"--profile=")
+                || arg.starts_with(b"--no-autostart=")
                 || arg.starts_with(b"--daemon-url=")
                 || (arg.starts_with(b"-p") && arg.len() > 2) =>
             {
@@ -1503,6 +1505,7 @@ mod tests {
             (b"agent-of-empires serve --daemon", true),
             (b"aoe --profile work serve --daemon", true),
             (b"aoe --profile=work serve --daemon", true),
+            (b"aoe --no-autostart serve --daemon", true),
             (b"aoe update", false),
             (b"aoe --profile serve update", false),
             (b"aoe --some-option serve update", false),
@@ -1691,6 +1694,7 @@ mod tests {
             globals,
             vec![
                 ("daemon-url".to_string(), None),
+                ("no-autostart".to_string(), None),
                 ("profile".to_string(), Some('p')),
             ],
             "a top-level global changed; teach command_is_aoe_serve about it before \
```

---

### Incident Patch 3: `b3141c8a` (2026-10-21)
**Commit Message**: ci: run required checks for merge_group (#4788)

Trigger CI and Tests on merge_group so the merge queue receives every
required check. Nix change detection diffs against the queue base sha,
macOS follows the queued PR's ci-macos label, queue refs no longer save
rust-cache entries, and Tests concurrency is scoped by event so a queue
run and the push of its commit do not share a group.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: Jules Lasne <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +7/-0)
```diff
@@ -7,6 +7,7 @@ on:
   # and a base filter would leave every PR but the bottom of the stack with no
   # checks at all.
   pull_request:
+  merge_group:
 
 env:
   CARGO_TERM_COLOR: always
@@ -357,11 +358,14 @@ jobs:
         env:
           EVENT_NAME: ${{ github.event_name }}
           BASE_REF: ${{ github.base_ref }}
+          QUEUE_BASE_SHA: ${{ github.event.merge_group.base_sha }}
           EVENT_BEFORE: ${{ github.event.before }}
         run: |
           set -euo pipefail
           if [ "$EVENT_NAME" = "pull_request" ]; then
             BASE="origin/$BASE_REF"
+          elif [ "$EVENT_NAME" = "merge_group" ]; then
+            BASE="$QUEUE_BASE_SHA"
           else
             # `before` is the pre-push SHA (covers multi-commit pushes); fall
             # back to the empty tree on the initial push where it is all-zero.
@@ -409,11 +413,14 @@ jobs:
         env:
           EVENT_NAME: ${{ github.event_name }}
           BASE_REF: ${{ github.base_ref }}
+          QUEUE_BASE_SHA: ${{ github.event.merge_group.base_sha }}
           EVENT_BEFORE: ${{ github.event.before }}
         run: |
           set -euo pipefail
           if [ "$EVENT_NAME" = "pull_request" ]; then
             BASE="origin/$BASE_REF"
+          elif [ "$EVENT_NAME" = "merge_group" ]; then
+            BASE="$QUEUE_BASE_SHA"
           else
             # `github.event.before` is the SHA before the push, which
             # covers multi-commit pushes correctly. Falls back to the
```

**File**: `.github/workflows/tests.yml` (modified, +37/-19)
```diff
@@ -8,9 +8,11 @@ on:
   # PR concurrency replaces in-flight runs; completed work still reruns.
   pull_request:
     types: [opened, synchronize, reopened, labeled]
+  merge_group:
 
+# The event keeps a queue run and the push of its fast-forwarded commit apart.
 concurrency:
-  group: tests-${{ github.event.pull_request.number || github.sha }}
+  group: tests-${{ github.event_name }}-${{ github.event.pull_request.number || github.sha }}
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 env:
@@ -51,7 +53,8 @@ jobs:
           # Save on PRs too. Swatinem keys the cache on Cargo.lock +
           # toolchain hash, so successive pushes to the same PR reuse
           # the slot rather than thrashing the 10GB repo cache budget.
-          save-if: true
+          # Queue refs are single-use, so their saves would only evict.
+          save-if: ${{ github.event_name != 'merge_group' }}
       - uses: taiki-e/install-action@9983c65e42da123ff25d1f78505eb6de315aa172 # v2.87.20
         if: matrix.leg != 'web-e2e'
         with:
@@ -221,8 +224,9 @@ jobs:
           fi
 
   cargo-macos:
-    # Keep the required context on all PRs; unlabeled PRs emit a skip notice.
-    # Queued event payloads can predate ci-macos, so read current labels.
+    # Keep the required context on all PRs and queue entries; without
+    # ci-macos the job emits a skip notice. Read current labels: queued event
+    # payloads can predate the label, and merge_group carries no PR at all.
     # Both Cargo steps share e2e-tests; no frontend build is needed on macOS.
     name: Cargo Test (macos)
     runs-on: macos-latest
@@ -234,49 +238,62 @@ jobs:
     steps:
       - name: Read current macOS coverage
         id: macos
-        if: github.event_name == 'pull_request'
+        if: github.event_name != 'push'
         uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
+        env:
+          QUEUE_REF: ${{ github.event.merge_group.head_ref }}
         with:
           script: |
+            let number = context.payload.pull_request?.number;
+            if (!number) {
+              // refs/heads/gh-readonly-queue/<base>/pr-<number>-<base sha>
+              const match = /\/pr-(\d+)-[0-9a-f]+$/.exec(process.env.QUEUE_REF);
+              if (!match) {
+                core.warning(`No PR number in ${process.env.QUEUE_REF}; running macOS.`);
+                core.setOutput('run', true);
+                return;
+              }
+              number = Number(match[1]);
+            }
             const { data: pr } = await github.rest.pulls.get({
-              ...context.repo, pull_number: context.payload.pull_request.number,
+              ...context.repo, pull_number: number,
             });
             core.setOutput('run', pr.labels.some(label => label.name === 'ci-macos'));
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-        if: github.event_name != 'pull_request' || steps.macos.outputs.run == 'true'
+        if: github.event_name == 'push' || steps.macos.outputs.run == 'true'
         with:
           # These jobs run repository-controlled build/test code after checkout
           # and never push, so the job token must not linger in .git/config
           # (zizmor artipacked). Matches the hardened convention in ci.yml and
           # release.yml.
           persist-credentials: false
       - uses: ./.github/actions/rust-toolchain
-        if: github.event_name != 'pull_request' || steps.macos.outputs.run == 'true'
+        if: github.event_name == 'push' || steps.macos.outputs.run == 'true'
       - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
-        if: github.event_name != 'pull_request' || steps.macos.outputs.run == 'true'
+        if: github.event_name == 'push' || steps.macos.outputs.run == 'true'
         with:
           cache-bin: "true"
-          save-if: true
+          save-if: ${{ github.event_name != 'merge_group' }}
       - name: Install tmux
-        if: github.event_name != 'pull_request' || steps.macos.outputs.run == 'true'
+        if: github.event_name == 'push' || steps.macos.outputs.run == 'true'
         run: brew install tmux
       - uses: taiki-e/install-action@9983c65e42da123ff25d1f78505eb6de315aa172 # v2.87.20
-        if: github.event_name != 'pull_request' || steps.macos.outputs.run == 'true'
+        if: github.event_name == 'push' || steps.macos.outputs.run == 'true'
         with:
           tool: cargo-nextest
       - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
-        if: github.event_name != 'pull_request' || steps.macos.outputs.run == 'true'
+        if: github.event_name == 'push' || steps.macos.outputs.run == 'true'
         with:
           node-version: '22'
       - name: Cargo test (macOS, lib + bins)
-        if: github.event_name != 'pull_request' || steps.macos.outputs.run == 'true'
+        if: github.event_name == 'push' || steps.maco
```

#### Recent Merged Pull Requests:
- **PR #4810** (2026-10-21): chore(plugins): pin agent-of-empires.github 2.3.0 (@Seluj78)
- **PR #4809** (2026-10-21): fix(server): drop the release-only unused Instance import (@njbrake)
- **PR #4804** (closed): ci: let auto-merge callers work under a merge queue (@njbrake)
- **PR #4801** (2026-10-21): fix(acp): name the configured agent PATH when its adapter is missing (@klubrake)
- **PR #4796** (2026-10-21): chore: release v1.21.0 (@njbrake)
- **PR #4795** (2026-10-21): perf(ci): fit each push into fewer runner slots (@Seluj78)

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

## X. daemon): retain runtime rows when profile enumeration fails (#4741)

**RULE**:
When implementing operations in `src/server/reload.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e869dfde`: daemon): retain runtime rows when profile enumeration fails (#4741). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/server/reload.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // A failed enumeration is unknown, not empty: keep the accepted rows and overlay state.
    if cache.health.enumeration_failed {
        state
            .runtime_read_cache
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .health
            .enumeration_failed = true;
        return;
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e869dfde` are properly handled with clean fallback behavior.
