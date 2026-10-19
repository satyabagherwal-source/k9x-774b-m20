> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `77402819`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T09:06:34.049Z  
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
> **Harvest Timestamp**: 2026-10-19T09:06:33.852Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3365 stars

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
        // prompt path so the reaper can resume after the reset (#4373).
        let captured = take_rate_limit_from_captured_rejection(
            &shared.rate_limit_rejections,
            chrono::Utc::now(),

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
                re
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
        install_command: String,
        #
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
        HookIdentityField::HermesForegroundSessionId => "hermes-foreground-session-id",
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
        HookIdentityField::HermesForegroundSessionId => {
            r#"if (.extra.platform=="cli" or .extra.platform=="tui") and (.session_id|type)=="string" and (.session_id|test("^[0-9]{8}_[0-9]{6}_[0-9a-f]+$")) then .session_id else empty end"#
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
         SID=$(jq -r '\\''{selector}'\\'' 2>/dev/null)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4543** (2026-10-16): **Quota cleanup can lose a clear revision and restore older attachments**
  *Symptoms*: ### What happened?  Optional P3 residual from [#4532's maintainer review](https://github.com/agent-of-empires/agent-of-empires/pull/4532#discussion_r4283263629). Normal revision ordering and the original #4491 cases are fixed; this concerns the quota-failure fallback losing the clear revision.  Controlled source-derived two-tab schedule, not executed locally:  1. Persist a draft. A begins an older save and pauses between reading the shared marker and writing its `S:` marker. 2. B clears at a newer revision. Its tombstone write fails; fallback deletion frees the old bytes. B finishes with a `C:` marker but no IndexedDB clear revision. 3. Resume A's stale marker write and let its smaller save commit in the freed space. 4. Reload: the cleared attachments are restored.  Expected: older work cannot become authoritative after a completed clear. [`recordClear`](https://github.com/agent-of-empires/agent-of-empires/blob/410699487fdf7bc5babe69cd41f77760e9f94217/web/src/lib/acpDrafts.ts#L152-L159) instead [deletes the revision](https://github.com/agent-of-empires/agent-of-empires/blob/410699487fdf7bc5babe69cd41f77760e9f94217/web/src/lib/attachmentStore.ts#L153-L159). The [split marker read/write](https://github.com/agent-of-empires/agent-of-empires/blob/410699487fdf7bc5babe69cd41f77760e9f94217/web/src/lib/acpDrafts.ts#L48-L57) can overwrite B's marker; [save accepts an absent record](https://github.com/agent-of-empires/agent-of-empires/blob/410699487fdf7bc5babe69cd41f77760e9f94217/web/s

- **Issue #4542** (2026-10-16): **Push subscription effects can outlive the action that owns them**
  *Symptoms*: ### What happened?  P3 residual follow-up to #4512, separate from the three UI-consistency cases fixed in closed #4208. Subscription side effects can outlive the operation whose UI result is discarded.  Controlled source-derived schedules, not executed locally:  1. Hold Enable's browser `subscribe()`, unmount all consumers, remount and let refresh observe no subscription. Release the old Enable: browser/server registration and `aoe.push.wanted=1` commit, but its UI publish is dropped. The UI remains off until another refresh. This is the [maintainer's optional, pre-existing follow-up](https://github.com/agent-of-empires/agent-of-empires/pull/4512#discussion_r4282081720). 2. Hold a refresh's re-registration POST before server commit. Complete Disable and its browser/server unsubscribe, then release the old POST. It recreates a stale server endpoint record. This does not imply browser notification delivery continues after unsubscribe.  Evidence: [final unmount releases `busy`](https://github.com/agent-of-empires/agent-of-empires/blob/410699487fdf7bc5babe69cd41f77760e9f94217/web/src/hooks/usePushSubscription.ts#L130-L145); [refresh registration is not serialized with actions](https://github.com/agent-of-empires/agent-of-empires/blob/410699487fdf7bc5babe69cd41f77760e9f94217/web/src/hooks/usePushSubscription.ts#L180-L200); [Enable still commits effects](https://github.com/agent-of-empires/agent-of-empires/blob/410699487fdf7bc5babe69cd41f77760e9f94217/web/src/hooks/usePushSubscript

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

### Incident Patch 1: `91c1a556` (2026-10-17)
**Commit Message**: fix(serve): keep status probes from deleting a replacement daemon's state (#4629)

* fix(serve): keep status probes from deleting a replacement daemon's state

daemon_status() deleted serve.pid and the discovery/launch files when it
saw a foreign or exited pid. A probe that read the old pid before a
replacement daemon published could then wipe the replacement's state.

Status is now read-only. Remaining cleanup (stop, foreground exit) takes
serve.lock, rechecks that serve.pid still names the inspected pid, and
only then deletes. start_daemon holds the lock from before spawn until
serve.pid and serve.launch are written, and the foreground pid write
takes it too, so a cleaner either runs before publication or sees the
new pid and skips.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve): report when stop cleanup preserved a replacement's state

clear_serve_state now returns whether it deleted anything, so `aoe serve
--stop` no longer claims a stale pid file was cleaned up when a replacement
daemon published in between and its state was preserved.

Addresses review comment from @coderabbitai on #4629.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve)

**File**: `src/cli/serve.rs` (modified, +226/-43)
```diff
@@ -722,21 +722,45 @@ const SERVE_STATE_FILES: [&str; 4] = [
     "serve.launch",
 ];
 
-fn remove_stale_serve_state(pid_path: &std::path::Path) {
-    let _ = std::fs::remove_file(pid_path);
-    if let Ok(dir) = crate::session::get_app_dir() {
-        for name in SERVE_STATE_FILES {
-            let _ = std::fs::remove_file(dir.join(name));
-        }
-    }
+/// Separate from the lifetime lock a running server holds, which this state is
+/// published and cleared under. Publishers hold it from before spawning until the pid
+/// and launch files are written; cleanup holds it across its ownership check and deletion.
+fn lock_serve_state() -> Result<std::fs::File> {
+    use fs2::FileExt as _;
+    let path = crate::session::get_app_dir()?.join("serve.state.lock");
+    let file = std::fs::OpenOptions::new()
+        .read(true)
+        .write(true)
+        .create(true)
+        .truncate(false)
+        .open(&path)
+        .with_context(|| format!("opening {}", path.display()))?;
+    file.lock_exclusive()
+        .with_context(|| format!("locking {}", path.display()))?;
+    Ok(file)
 }
 
-async fn clear_serve_state() {
-    if let Ok(dir) = crate::session::get_app_dir() {
-        for name in SERVE_STATE_FILES {
-            let _ = tokio::fs::remove_file(dir.join(name)).await;
-        }
+/// Deletes the serve state only while `serve.pid` still names `expected_pid`.
+/// Returns whether it did.
+fn clear_serve_state(expected_pid: i32) -> bool {
+    let (Ok(_lock), Ok(pid_path), Ok(dir)) = (
+        lock_serve_state(),
+        pid_file_path(),
+        crate::session::get_app_dir(),
+    ) else {
+        return false;
+    };
+    let recorded = std::fs::read_to_string(&pid_path)
+        .ok()
+        .and_then(|raw| parse_positive_pid(&raw));
+    if recorded != Some(expected_pid) {
+        return false;
+    }
+    let _ = std::fs::remove_file(&pid_path);
+    for name in SERVE_STATE_FILES {
+        let _ = std::fs::remove_file(dir.join(name));
     }
+    true
 }
 
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
@@ -747,6 +771,21 @@ pub(crate) enum DaemonStatus {
 }
 
 pub(crate) fn daemon_status() -> DaemonStatus {
+    daemon_status_with(
+        |pid| {
+            classify_daemon_probe(nix::sys::signal::kill(
+                nix::unistd::Pid::from_raw(pid),
+                None,
+            ))
+        },
+        inspect_daemon_process,
+    )
+}
+
+fn daemon_status_with(
+    probe: impl FnOnce(i32) -> DaemonProbeDisposition,
+    inspect: impl FnOnce(i32) -> DaemonProcessIdentity,
+) -> DaemonStatus {
     let Ok(path) = pid_file_path() else {
         return DaemonStatus::Unverified;
     };
@@ -759,20 +798,13 @@ pub(crate) fn daemon_status() -> DaemonStatus {
         return DaemonStatus::Unverified;
     };
 
-    let probe = nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None);
-    match classify_daemon_probe(probe) {
-        DaemonProbeDisposition::VerifyIdentity => match inspect_daemon_process(pid) {
+    match probe(pid) {
+        DaemonProbeDisposition::VerifyIdentity => match inspect(pid) {
             DaemonProcessIdentity::Verified => DaemonStatus::Verified(pid as u32),
-            DaemonProcessIdentity::Foreign => {
-                remove_stale_serve_state(&path);
-                DaemonStatus::Absent
-            }
+            DaemonProcessIdentity::Foreign => DaemonStatus::Absent,
             DaemonProcessIdentity::Indeterminate => DaemonStatus::Unverified,
         },
-        DaemonProbeDisposition::Stale => {
-            remove_stale_serve_state(&path);
-            DaemonStatus::Absent
-        }
+        DaemonProbeDisposition::Stale => DaemonStatus::Absent,
         DaemonProbeDisposition::Indeterminate => DaemonStatus::Unverified,
     }
 }
@@ -938,7 +970,8 @@ pub async fn run(profile: &str, mut args: ServeArgs, serve_lock: Option<ServeLoc
     );
 
     if let Ok(path) = pid_file_path() {
-        let _ = tokio::fs::write(&path, std::process::id().to_string()).await;
+        let _lock = lock_serve_state()?;
+        let _ = std::fs::write(&path, std::process::id().to_string());
         tracing::debug!(target: "serve.lifecycle", path = %path.display(), pid = std::process::id(), "wrote pid file");
     }
 
@@ -961,17 +994,7 @@ pub async fn run(profile: &str, mut args: ServeArgs, serve_lock: Option<ServeLoc
     })
     .await;
 
-    if let Ok(path) = pid_file_path() {
-        let is_ours = tokio::fs::read_to_string(&path)
-            .await
-            .ok()
-            .and_then(|s| s.trim().parse::<u32>().ok())
-            .is_some_and(|pid| pid == std::process::id());
-        if is_ours {
-            let _ = tokio::fs::remove_file(&path).await;
-            clear_serve_state().await;
-        }
-    }
+    clear_serve_state(std::process::id() as i32);
 
     result
 }
@@ -1067,6 +1090,10 @@ async fn fetch_cityhall_bundle(url: &str, token: &str) -> Result<String> {
 fn start_daemon(profile: &str, args: &ServeArgs) -> Result<()>
```

**File**: `src/server/startup.rs` (modified, +24/-4)
```diff
@@ -200,6 +200,16 @@ fn check_auth_gate(
     )
 }
 
+/// A daemon started without a passphrase must not inherit a dead predecessor's.
+async fn sync_passphrase_file(path: &std::path::Path, passphrase: Option<&str>) {
+    match passphrase {
+        Some(pp) => write_secret_file(path, pp).await,
+        None => {
+            let _ = tokio::fs::remove_file(path).await;
+        }
+    }
+}
+
 /// systemd `Type=notify` readiness. No-op unless `NOTIFY_SOCKET` is set.
 #[cfg(unix)]
 async fn notify_ready(addr: &str) {
@@ -322,10 +332,8 @@ pub async fn start_server(config: ServerConfig<'_>) -> anyhow::Result<()> {
 
     // Persist the plaintext passphrase so the TUI can display it on reopen, including after
     // a TUI restart or when the daemon was started from the CLI.
-    if let Some(pp) = passphrase {
-        if let Ok(app_dir) = crate::session::get_app_dir() {
-            write_secret_file(&app_dir.join("serve.passphrase"), pp).await;
-        }
+    if let Ok(app_dir) = crate::session::get_app_dir() {
+        sync_passphrase_file(&app_dir.join("serve.passphrase"), passphrase).await;
     }
 
     // Push notifications.
@@ -1090,6 +1098,18 @@ async fn remote_rotation_loop(
 mod tests {
     use super::*;
 
+    #[tokio::test]
+    async fn passphraseless_start_retires_a_predecessors_passphrase() {
+        let dir = tempfile::tempdir().unwrap();
+        let path = dir.path().join("serve.passphrase");
+
+        sync_passphrase_file(&path, Some("hunter2")).await;
+        assert_eq!(std::fs::read_to_string(&path).unwrap(), "hunter2");
+
+        sync_passphrase_file(&path, None).await;
+        assert!(!path.exists());
+    }
+
     #[cfg(unix)]
     #[tokio::test(flavor = "current_thread")]
     #[serial_test::parallel]
```

---

### Incident Patch 2: `64afb389` (2026-10-16)
**Commit Message**: fix(worktree): relock the source when the submodule inventory fails (#4652)

The move_worktree backstop unlocks the source before relocating by hand.
An error from the submodule inventory returned without restoring the lock.

Refs #3703

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `src/git/worktree/relocate.rs` (modified, +53/-1)
```diff
@@ -275,7 +275,14 @@ impl GitWorktree {
             "move_worktree: relocating a worktree with submodules by hand"
         );
         // Recorded while the pointers still resolve.
-        let checkouts = Self::populated_submodule_checkouts(from)?;
+        let checkouts = match Self::populated_submodule_checkouts(from) {
+            Ok(checkouts) => checkouts,
+            Err(e) => {
+                // `move_worktree`'s backstop has already unlocked the source.
+                let _ = self.lock_worktree(from);
+                return Err(e);
+            }
+        };
         self.unlock_worktree(from);
 
         if let Err(e) = std::fs::rename(from, to) {
@@ -855,4 +862,49 @@ mod tests {
         assert!(from.is_dir());
         assert!(!to.exists());
     }
+
+    /// The backstop reaches the relocation after `move_worktree` has already
+    /// unlocked the source; an inventory failure must lock it again.
+    #[test]
+    #[serial_test::serial]
+    fn relocation_relocks_source_when_submodule_inventory_fails_after_unlock() {
+        let home_dir = TempDir::new().unwrap();
+        let _home = crate::session::test_support::isolate_home(home_dir.path());
+
+        let dirs = repo_with_nested_submodules("test-relock-inventory", Path::new(".claude"));
+        let git_wt = GitWorktree::new(dirs[0].path().to_path_buf())
+            .unwrap()
+            .allow_submodule_file_transport();
+        let parent = TempDir::new().unwrap();
+        let from = parent.path().join("source");
+        git_wt
+            .create_worktree("test-relock-inventory", &from, false, None)
+            .unwrap();
+
+        let gitfile = from.join(".claude/.git");
+        let original_gitfile = std::fs::read(&gitfile).unwrap();
+        std::fs::write(&gitfile, b"gitdir: missing\n").unwrap();
+        let to = parent.path().join("moved");
+
+        git_wt.unlock_worktree(&from);
+        let result = git_wt.relocate_worktree_with_submodules(&from, &to);
+        std::fs::write(&gitfile, original_gitfile).unwrap();
+
+        assert!(result.is_err());
+        assert!(!to.exists());
+        let listing = run_git(&git_wt.repo_path, &["worktree", "list", "--porcelain"]);
+        let record = listing
+            .split("\n\n")
+            .find(|record| {
+                record
+                    .lines()
+                    .next()
+                    .is_some_and(|l| l.ends_with("/source"))
+            })
+            .unwrap_or_else(|| panic!("{listing}"));
+        assert!(
+            record.lines().any(|line| line.starts_with("locked")),
+            "{listing}"
+        );
+    }
 }
```

---

### Incident Patch 3: `721d9e23` (2026-10-17)
**Commit Message**: fix(web): keep useFileContents byte-budget test off huge diffs (#4657)

waitFor polled toBe on the 33 MB body; each failed poll built a huge
diff and starved the hook's fetch until the 1s timeout. Poll a boolean
predicate instead.

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/hooks/useFileContents.test.ts` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ async function mount(path: string | null, body?: string, rev?: number) {
   const open = async (next: string, nextBody: string, nextRev = rev) => {
     spy.mockResolvedValueOnce(contents(next, nextBody));
     hook.rerender({ path: next, rev: nextRev });
-    await waitFor(() => expect(shown()).toBe(nextBody));
+    // Boolean compare: a failed `toBe` on the 33 MB body builds a huge diff each poll and starves the fetch.
+    await waitFor(() => expect(shown() === nextBody).toBe(true));
   };
   return { ...hook, shown, open };
 }
```

#### Recent Merged Pull Requests:
- **PR #4683** (2026-10-19): chore(deps): bump @agentclientprotocol/claude-agent-acp from 0.89.0 to 0.89.1 in /acp-worker/adapters/claude-agent-acp (@dependabot[bot])
- **PR #4678** (2026-10-18): fix(web): show Read file content from the session when the adapter sends none (@cwrau)
- **PR #4677** (2026-10-18): fix(session): run one-shot agents standalone in a scope (@cwrau)
- **PR #4675** (2026-10-18): feat(web): render images inline and offer a download for binary files in the file viewer (@cwrau)
- **PR #4674** (2026-10-18): fix(web): show attachments in one bubble and expand images in a lightbox (@cwrau)
- **PR #4667** (closed): fix(web): preserve Ctrl+Enter in terminal input (consolidated into #4604) (@athal7)

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

## X. serve): keep status probes from deleting a replacement daemon's state (#4629)

**RULE**:
When implementing operations in `src/cli/serve.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `91c1a556`: serve): keep status probes from deleting a replacement daemon's state (#4629). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/cli/serve.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Separate from the lifetime lock a running server holds, which this state is
/// published and cleared under. Publishers hold it from before spawning until the pid
/// and launch files are written; cleanup holds it across its ownership check and deletion.
fn lock_serve_state() -> Result<std::fs::File> {
    use fs2::FileExt as _;
    let path = crate::session::get_app_dir()?.join("serve.state.lock");
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&path)
        .with_context(|| format!("opening {}", path.display()))?;
    file.lock_exclusive()
        .with_context(|| format!("locking {}", path.display()))?;
    Ok(file)
/// Deletes the serve state only while `serve.pid` still names `expected_pid`.
/// Returns whether it did.
fn clear_serve_state(expected_pid: i32) -> bool {
    let (Ok(_lock), Ok(pid_path), Ok(dir)) = (
        lock_serve_state(),
        pid_file_path(),
        crate::session::get_app_dir(),
    ) else {
        return false;
    };
    let recorded = std::fs::read_to_string(&pid_path)
        .ok()
        .and_then(|raw| parse_positive_pid(&raw));
    if record
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
fn remove_stale_serve_state(pid_path: &std::path::Path) {
    let _ = std::fs::remove_file(pid_path);
    if let Ok(dir) = crate::session::get_app_dir() {
        for name in SERVE_STATE_FILES {
            let _ = std::fs::remove_file(dir.join(name));
        }
    }
async fn clear_serve_state() {
    if let Ok(dir) = crate::session::get_app_dir() {
        for name in SERVE_STATE_FILES {
            let _ = tokio::fs::remove_file(dir.join(name)).await;
        }
    let probe = nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None);
    match classify_daemon_probe(probe) {
        DaemonProbeDisposition::VerifyIdentity => match inspect_daemon_process(pid) {
            DaemonProcessIdentity::Foreign => {
                remove_stale_serve_state(&path);
                DaemonStatus::Absent
            }
        DaemonProbeDisposition::Stale => {
            remove_stale_serve_state(&path);
            DaemonStatus::Absent
        }
        let _ = tokio::fs::write(&path, std::process::id().to_string()).await;
    if let Ok(path) = pid_file_path() {
        let is_ours = tokio::fs::read_to_string(&path)
            .await
            .ok()
            .and_then(|s| s.trim().
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `91c1a556` are properly handled with clean fallback behavior.
