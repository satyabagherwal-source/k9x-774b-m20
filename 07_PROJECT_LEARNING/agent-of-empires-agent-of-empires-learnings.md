> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `8bd72072`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T14:45:47.136Z  
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
> **Harvest Timestamp**: 2026-10-31T14:45:47.129Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3398 stars

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
                    if let Err(error) = self.send_cancel().await {
                        debug!(target: "acp.protocol", %error, "cancel notification failed");
                    }
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
                Some(ClientCmd::ResumeTaskTailing(task_ids)) => {
                    self.shared
                        .resume_task_tailing(&self.acp_session_id.0, task_ids)
                        .await
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
        if adopted && !shar
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
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

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
        self.pid == record.pid
            && self.generation == record.generation
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

    /// Legacy zero generations do not establish destructive authority.
    pub fn matches_record(&self, pid: u32, generation: u64) -> bool {
        self.pid == pid
            && (self.generation == 0 || generation == 0 || self.generation == generation)
    }
}

/// Frozen authority for native processes outside the runner's process group.
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub(crate) enum PrimeOwnership {
    #[default]
    Unresolved,
    NotPrime,
    Owned {
        runtime: Box<crate::process::prime::PrimeRuntime>,
    },
}

impl PrimeOwnership {
    pub(crate) fn from_record(record: &crate::process::worker_registry::WorkerRecord) -> Self {
        match &record.prime_runtime {
            Some(runtime) => Self::Owned {
                runtime: Box::new(runtime.clone()),
            },
            None if record.agent_key != "prime-agent" => Self::NotPrime,
            None => Self::Unresolved,
        }
    }

    pub(crate) fn ensure_stopped(&self) -> anyhow::Result<()> {
        match self {
            Self::NotPrime => Ok(()),
            Self::Owned { runtime } => runtime.verify_stopped(),
            Self::Unresolved => anyhow::bail!("Native runner ownership is unresolved"),
        }
    }

    pub(crate) fn retire(&self) -> anyhow::Result<()> {
        match self {
            Self::NotPrime => Ok(()),
            Self::Owned { runtime } => runtime.cleanup(),
            Self::Unresolved => anyhow::bail!("Native runner ownership is unresolved"),
        }
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
#[derive(Debug, Clone)]
pub struct Lease {
    session_id: String,
    epoch: u64,
    construction: Arc<Construction>,
}

#[derive(Debug, Clone)]
pub(crate) struct StopCompletion {
    pub(crate) reason: Option<String>,
    pub(crate) done: bool,
}

struct Construction {
    id: uuid::Uuid,
    cancellation: CancellationToken,
    retirement_authorized: std::sync::atomic::AtomicBool,
    runner: Mutex<Option<RunnerIdentity>>,
    scopes: Mutex<Vec<crate::process::worker_registry::ScopeOwnership>>,
    admission: Mutex<Option<crate::acp::supervisor::LaunchAdmission>>,
    prime: Mutex<PrimeOwnership>,
    cancelled_before_birth: std::sync::atomic::AtomicBool,
    adapter_route: Mutex<Option<Arc<AdapterRetirementRoute>>>,
    adapter_delete_handled: std::sync::atomic::AtomicBool,
    stop_completion: Mutex<Option<StopCompletion>>,
    retirement: crate::acp::supervisor::RetirementResources,
    previous_runner: Mutex<Option<RunnerIdentity>>,
    retire_previous: std::sync::atomic::AtomicBool,
    spawn_attestor:
        Mutex<Option<tokio::sync::mpsc::UnboundedSender<tokio::sync::oneshot::Sender<bool>>>>,
    /// Wall-clock ms of admission, refreshed on install so a slow start
    /// does not read as idle; atomic only so tests can backdate it.
    idle_baseline_ms: std::sync::atomic::AtomicI64,
}

impl Default for Construction {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4(),
            cancellation: CancellationToken::new(),
            retirement_authorized: std::sync::atomic::AtomicBool::new(true),
            runner: Mutex::default(),
            scopes: Mutex::default(),
            admission: Mutex::default(),
            prime: Mutex::default(),
            cancelled_before_birth: std::sync::atomic::AtomicBool::new(false),
            adapter_route: Mutex::default(),
            adapter_delete_handled: std::sync::atomic::AtomicBool::new(false),
            stop_completion: Mutex::default(),
            retirement: crate::acp::supervisor::RetirementResources::default(),
            previous_runner: Mutex::default(),
            retire_previous: std::sync::atomic::AtomicBool::new(false),
            spawn_attestor: Mutex::default(),
            idle_baseline_ms: std::sync::atomic::AtomicI64::new(
                chrono::Utc::now().timestamp_millis(),
            ),
        }
    }
}

impl std::fmt::Debug for Construction {
    fn fmt(&self, fmt: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        fmt.debug_struct("Construction").finish_non_exhaustive()
    }
}

impl PartialEq for Lease {
    fn eq(&self, other: &Self) -> bool {
        self.session_id == other.session_id
            && self.epoch == other.epoch
            && self.producer_id() == other.producer_id()
    }
}

impl Eq for Lease {}
pub(crate) struct AdapterRetirementRoute {
    pub(crate) client: Arc<crate::acp::acp_client::AcpClient>,
    pub(crate) identity: RunnerIdentity,
    pub(crate) acp_id: String,
    pub(crate) adapter: String,
    pub(crate) gate: tokio::sync::Mutex<()>,
    pub(crate) retired: std::sync::atomic::AtomicBool,
}

impl Lease {
    /// When this epoch was admitted or last became running, in ms since the Unix epoch.
    pub(crate) fn idle_baseline_ms(&self) -> i64 {
        self.construction
            .idle_baseline_ms
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    #[cfg(test)]
    pub(crate) fn test_backdate_idle_baseline(&self, ms: i64) {
        self.construction
            .idle_baseline_ms
            .store(ms, std::sync::atomic::Ordering::Relaxed);
    }

    /// An attach observes the original runner until installation or an explicit stop.
    pub(crate) fn is_borrowed_attach(&self) -> bool {
        !self
            .construction
            .retirement_authorized
            .load(std::sync::atomic::Ordering::Acquire)
    }

    pub(crate) fn claim_runner_ownership(&self) {
        self.construction
            .retirement_authorized
            .store(true, std::sync::atomic::Ordering::Release);
    }

    pub(crate) fn retirement(&self) -> &crate::acp::supervisor::RetirementResources {
        &self.construction.retirement
    }

    pub(crate) fn owe_stop_completion(&self, reason: Option<&str>) {
        let mut slot = self
            .construction
            .stop_completion
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        match slot.as_mut() {
            None => {
                *slot = Some(StopCompletion {
                    reason: reason.map(str::to_owned),
                    done: false,
                })
            }
            Some(debt) if debt.reason.is_none() && reason.is_some() => {
                debt.reason = reason.map(str::to_owned);
                debt.done = false;
            }
            Some(_) => {}
        }
    }

    pub(crate) fn pending_stop_completion(&self) -> Option<StopCompletion> {
        self.construction
            .stop_completion
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .filter(|debt| !debt.done)
            .cloned()
    }

    pub(crate) fn stop_completion_pending(&self) -> bool {
        self.construction
            .stop_completion
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .is_some_and(|debt| !debt.done)
    }

    pub(crate) fn stop_completion_done(&self) {
        if let Some(debt) = self
            .construction
            .stop_completion
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_mut()
        {
            debt.done = true;
        }
    }

    pub(crate) fn previous_runner(&self) -> Option<RunnerIdentity> {
        *self
            .construction
            .previous_runner
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }

    /// Freeze the predeces
```

### Core Architecture Module: `src/acp/state.rs`
```
//! `AcpState`: the structured view session state, folded from `Event`s by a single writer.

use crate::daemon::PromptAttachmentRef;
use crate::session::Status;
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
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
        expecte
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
    pub stderr: Option<String>,
    pub exit: i32,
}

impl Projection {
    fn text(stdout: String) -> Self {
        Self {
            stdout,
            session_table: false,
            stderr: None,
            exit: 0,
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
        let mut stderr = String::new();
        if args.json {
            let systemd_active = local_peer && list::systemd_scopes_active();
            let mut rows = Vec::new();
            for profile in snapshot.profiles.iter().filter(|profile| profile.listed) {
                if !profile_sessions_healthy(profile) {
                    let _ = writeln!(
                        stderr,
                        "warning: profile '{}': unavailable for this listing",
                        terminal_text(&profile.name)
                    );
                    continue;
                }
                for session in sessions_for_profile(snapshot, &profile.name)
                    .filter(|session| matches_state(session.state, state))
                {
                    rows.push(session_json(session, &profile.name, systemd_active)?);
                }
            }
            let incomplete = !stderr.is_empty();
            if incomplete {
                stderr.push_str("Error: the listing is incomplete\n");
            }
            return Ok(Projection {
                stdout: json_lines(&rows)?,
                session_table: false,
                stderr: incomplete.then_some(stderr),
                exit: i32::from(incomplete),
            });
        }
        let show_state = state == StateFilter::All;
        let mut output = String::new();
        let mut total = 0usize;
        for profile in snapshot.profiles.iter().filter(|profile| profile.listed) {
            if !profile_sessions_healthy(profile) {
                let _ = writeln!(
                    stderr,
                    "warning: profile '{}': unavailable for this listing",
                    terminal_text(&profile.name)
                );
                continue;
            }
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
        return Ok(Projection {
            stdout: output,
            session_table: false,
            stderr: (!stderr.is_empty()).then_some(stderr),
            exit: 0,
        });
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
        return Ok(Projection::text(fo
```

### Core Architecture Module: `src/daemon/lifecycle.rs`
```
use std::fs::File;
use std::os::fd::AsFd;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use fs2::FileExt;

pub(crate) struct Transaction(File);

pub(crate) struct Lifetime {
    _file: File,
}

fn lock_path(name: &str) -> Result<std::path::PathBuf> {
    let socket = super::transport::local_socket_path()?;
    let parent = socket.parent().context("Daemon socket has no directory")?;
    super::transport::prepare_runtime_directory(parent)?;
    Ok(parent.join(name))
}

fn open_lock(name: &str) -> Result<File> {
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .mode(0o600)
        .custom_flags(nix::libc::O_NOFOLLOW)
        .open(lock_path(name)?)?;
    let meta = file.metadata()?;
    anyhow::ensure!(
        meta.is_file()
            && meta.uid() == nix::unistd::geteuid().as_raw()
            && meta.mode() & 0o777 == 0o600
            && meta.nlink() == 1,
        "Unsafe daemon lock file"
    );
    Ok(file)
}

impl Transaction {
    /// Acquire the transaction, giving up after `wait`.
    ///
    /// The only blocking acquisition: a daemon transition holds the lock for as
    /// long as it takes to start or stop, so a caller needs a bound and a message
    /// naming the transition that is in the way. Its only caller is the TUI key
    /// handler, where an unbounded wait would freeze the whole UI.
    pub(crate) fn acquire_blocking_for(wait: Duration) -> Result<Self> {
        let file = open_lock("transaction.lock")?;
        let deadline = Instant::now() + wait;
        loop {
            match file.try_lock_exclusive() {
                Ok(()) => return Ok(Self(file)),
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    anyhow::ensure!(
                        Instant::now() < deadline,
                        "the aoe serve daemon is starting, restarting or stopping and holds the \
                         daemon lifecycle lock; retry this command in a moment"
                    );
                    std::thread::sleep(Duration::from_millis(25));
                }
                Err(error) => return Err(error.into()),
            }
        }
    }

    pub(crate) async fn acquire() -> Result<Self> {
        let file = open_lock("transaction.lock")?;
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            match file.try_lock_exclusive() {
                Ok(()) => return Ok(Self(file)),
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    anyhow::ensure!(
                        Instant::now() < deadline,
                        "Daemon lifecycle transaction timed out"
                    );
                    tokio::time::sleep(Duration::from_millis(25)).await;
                }
                Err(error) => return Err(error.into()),
            }
        }
    }

    pub(crate) fn receive() -> Result<Self> {
        let file = File::from(std::io::stdin().as_fd().try_clone_to_owned()?);
        let expected = open_lock("transaction.lock")?.metadata()?;
        let received = file.metadata()?;
        anyhow::ensure!(
            received.dev() == expected.dev() && received.ino() == expected.ino(),
            "Missing daemon transaction handoff"
        );
        file.try_lock_exclusive()
            .context("Invalid daemon transaction handoff")?;
        crate::process::detach_daemon_stdin()?;
        Ok(Self(file))
    }

    pub(crate) fn handoff(&self) -> Result<std::process::Stdio> {
        Ok(self.0.try_clone()?.into())
    }

    pub(crate) fn lifetime(&self) -> Result<Lifetime> {
        self.try_lifetime()?
            .context("A daemon already owns this namespace")
    }

    pub(crate) fn try_lifetime(&self) -> Result<Option<Lifetime>> {
        let file = open_lock("lifetime.lock")?;
        match file.try_lock_exclusive() {
            Ok(()) => Ok(Some(Lifetime { _file: file })),
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => Ok(None),
            Err(error) => Err(error.into()),
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5056** (2026-10-30): **TUI test harness inherits daemon endpoint and credentials**
  *Symptoms*: ## What happened?  P3 follow-up from #5028: TUI test processes still inherit `AOE_DAEMON_URL` and `AOE_DAEMON_TOKEN`, although directly launched CLI fixtures now clear them.  ### Reproduction scenario  1. Export a nonempty daemon URL and a sentinel token before the harness's tmux server starts. 2. Run a local TUI fixture, such as `settings_shortcut_bar_hides_the_row_and_survives_restart`, without an explicit remote override. 3. The pane inherits those variables and starts remote-home instead of using the fixture's isolated local state. An existing harness tmux server can retain the same overrides.  Expected: local fixtures ignore inherited daemon discovery settings; only explicit fixture overrides select a remote endpoint. Actual source behavior causes host-dependent startup failures or access to the configured daemon's session state. No destructive remote action or dynamic reproduction is claimed.  Evidence: [tmux launch environment](https://github.com/agent-of-empires/agent-of-empires/blob/e83da88452d65b3a6d80dd1443bba0ae546a8d23/tests/e2e/harness.rs#L875-L895), [peer/server launch](https://github.com/agent-of-empires/agent-of-empires/blob/e83da88452d65b3a6d80dd1443bba0ae546a8d23/tests/e2e/harness.rs#L943-L954), and [remote-mode selection before local startup](https://github.com/agent-of-empires/agent-of-empires/blob/e83da88452d65b3a6d80dd1443bba0ae546a8d23/src/tui/mod.rs#L244-L250).  ### Acceptance  - Apply URL/token isolation at the actual pane launch boundary, including 

- **Issue #5051** (2026-10-30): **Quote worktree paths in displayed repair commands**
  *Symptoms*: ## What happened?  P3 recovery-guidance follow-up to #4824. Two degraded-move warnings interpolate the destination directly into a copyable `git worktree repair` command.  ### Source-traced recovery scenario, not an executed reproduction  1. Rename a linked worktree with initialized submodules under a parent such as `/home/alice/My Projects` or `/home/o'connor/projects`. 2. If post-move `.git` pointer conversion fails, read the degraded-result warning. The repair-failure plus failed-rollback branch emits the same kind of command. 3. Copy the suggested command. `git worktree repair /home/alice/My Projects/new` supplies two paths; an unescaped apostrophe can leave an unterminated shell quote.  **Expected:** the command preserves the destination as one literal argument. **Actual:** raw `to.display()` is inserted in [the repair/rollback warning](https://github.com/agent-of-empires/agent-of-empires/blob/e83da88452d65b3a6d80dd1443bba0ae546a8d23/src/git/worktree/relocate.rs#L343) and [the pointer-conversion warning](https://github.com/agent-of-empires/agent-of-empires/blob/e83da88452d65b3a6d80dd1443bba0ae546a8d23/src/git/worktree/relocate.rs#L355). The [parent directory is retained](https://github.com/agent-of-empires/agent-of-empires/blob/e83da88452d65b3a6d80dd1443bba0ae546a8d23/src/session/worktree_edit.rs#L53), so these are supported paths.  ### Correction and acceptance  Quote the destination operand in both displayed commands using existing POSIX word-quoting support that prese

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

### Incident Patch 1: `3b7b4b7f` (2026-10-30)
**Commit Message**: fix(serve): turn off the Funnel a failed Tailscale start switched on (#5043)

* fix(serve): turn off the Funnel a failed Tailscale start switched on

`aoe serve` with Tailscale runs `tailscale funnel --bg` and then reads the
public URL. If that read failed, timed out, or the start was cancelled, the
Funnel stayed on, pointing at a port nothing served.

The start now records whether :443 already carried our Funnel before it ran.
If it didn't, a guard armed after `--bg` turns the Funnel back off with
`tailscale funnel --https=443 off`: awaited (bounded) on the error and
timeout paths, and from Drop only when the start future is cancelled. A
Funnel the user already had on this port is never touched.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(serve): keep the Funnel reset armed until it finishes, and match our port exactly

Two gaps in the failed-start reset:

- `reset()` disarmed the guard before awaiting `funnel --https=443 off`. A
  start cancelled during that await killed the command, and Drop then saw
  nothing to do, so the Funnel stayed on. It now disarms after the await;
  a second `off` from Drop is harmless.
- The pre-flight took any proxy containing `127.0.0.

**File**: `docs/guides/web-dashboard.md` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ In `--remote` mode the token rotates every four hours. Use `aoe url` for the liv
 
 `--remote` selects a tunnel in this order, unless named-tunnel flags override it:
 
-1. **Tailscale Funnel:** if `tailscale` is installed and logged in, AoE runs `tailscale funnel --bg --yes <port>` for a stable `https://<machine>.<tailnet>.ts.net` URL. Install Tailscale, run `tailscale up`, enable [Funnel](https://login.tailscale.com/f/funnel), and grant the node the `funnel` nodeAttr in its [ACL](https://login.tailscale.com/admin/acls/file). Target the node's tag if tagged. A conflicting non-loopback Funnel on port 443 is refused, not replaced; clear it with `tailscale funnel reset`, or use `--no-tailscale`. Stale loopback AoE configuration can be replaced.
+1. **Tailscale Funnel:** if `tailscale` is installed and logged in, AoE runs `tailscale funnel --bg --yes <port>` for a stable `https://<machine>.<tailnet>.ts.net` URL. Install Tailscale, run `tailscale up`, enable [Funnel](https://login.tailscale.com/f/funnel), and grant the node the `funnel` nodeAttr in its [ACL](https://login.tailscale.com/admin/acls/file). Target the node's tag if tagged. A conflicting non-loopback Funnel on port 443 is refused, not replaced; clear it with `tailscale funnel reset`, or use `--no-tailscale`. Stale loopback AoE configuration can be replaced. AoE also refuses to start Funnel when port 443 has tailnet-only Serve config, which Funnel would make public, or when `tailscale funnel status` can't be read. If a start fails after turning Funnel on, AoE turns it back off, but only when port 443 was unused before and still holds just AoE's route; otherwise the error says what was left on. Two aoe daemons on one machine, such as a release and a debug build, take turns: a start waits up to 60 s for the other's to finish.
 2. **Named Cloudflare tunnel:** an explicit named tunnel takes precedence over Tailscale and provides a stable hostname on your domain:
 
    ```bash
```

**File**: `src/server/tunnel.rs` (modified, +1012/-64)
```diff
@@ -170,6 +170,18 @@ impl TunnelHandle {
     /// Configure Tailscale Funnel for the local port and return a handle carrying the
     /// stable `https://<host>.<tailnet>.ts.net` URL.
     pub async fn spawn_tailscale(local_port: u16) -> anyhow::Result<Self> {
+        use anyhow::Context as _;
+        let home =
+            dirs::home_dir().context("couldn't find the home directory for the Funnel lock")?;
+        let lock = funnel_lock_path(&home);
+        Self::spawn_tailscale_with(std::ffi::OsStr::new("tailscale"), &lock, local_port).await
+    }
+
+    async fn spawn_tailscale_with(
+        program: &std::ffi::OsStr,
+        lock: &std::path::Path,
+        local_port: u16,
+    ) -> anyhow::Result<Self> {
         // Hard cap on each tailscale command so we never wedge if tailscale pops an
         // interactive prompt (HTTPS-certs consent, Funnel-not-enabled-in-ACL, node not
         // signed in).
@@ -181,7 +193,7 @@ impl TunnelHandle {
         );
 
         // Pre-flight 1.
-        if let Err(e) = check_funnel_capability().await {
+        if let Err(e) = check_funnel_capability(program).await {
             debug!(reason = %e, "spawn_tailscale: funnel cap check failed");
             anyhow::bail!(
                 "Tailscale Funnel is not enabled for this tailnet. \
@@ -190,14 +202,14 @@ impl TunnelHandle {
             );
         }
 
+        // Held until this start succeeds or its reset ends; the guard owns it, so it's released
+        // after the guard's own `off`. Another aoe daemon can't activate in between.
+        let funnel_lock = lock_funnel_starts(lock).await?;
+
         // Pre-flight 2.
-        if let Some(existing) = inspect_existing_funnel(local_port).await {
-            anyhow::bail!(
-                "port 443 is already configured on this node for a different \
-                 backend ({}). Run `tailscale funnel reset` to clear the \
-                 existing config, or pass --no-tailscale to use Cloudflare.",
-                existing
-            );
+        let preflight = inspect_existing_funnel(program, local_port).await;
+        if let FunnelPreflight::Refuse(why) = &preflight {
+            anyhow::bail!("{why}");
         }
 
         // Single-command Funnel (Tailscale 1.52+).
@@ -208,14 +220,33 @@ impl TunnelHandle {
             local_port
         );
 
-        let mut child = Command::new("tailscale")
+        // If :443 had nothing on it before, everything there from now on is this start's: a
+        // start that fails or is cancelled turns it back off, even while `--bg` is still running
+        // (it may already have applied the config), so no Funnel is left pointing at a port
+        // nothing serves. A public Funnel that was already there (the user's own, or a sibling
+        // path) keeps its other routes; only `/` changes.
+        let mut guard = FunnelStartGuard::new(
+            program,
+            local_port,
+            preflight == FunnelPreflight::Unused,
+            funnel_lock,
+        );
+
+        let child = Command::new(program)
             .args(funnel_args)
             .stdin(std::process::Stdio::null())
             .stdout(std::process::Stdio::piped())
             .stderr(std::process::Stdio::piped())
             .kill_on_drop(true)
-            .spawn()
-            .map_err(|e| anyhow::anyhow!("failed to run tailscale funnel: {}", e))?;
+            .spawn();
+        let mut child = match child {
+            Ok(child) => child,
+            Err(e) => {
+                // `--bg` never ran, so there's nothing to turn off.
+                guard.disarm();
+                anyhow::bail!("failed to run tailscale funnel: {e}");
+            }
+        };
         let stdout = child.stdout.take();
         let stderr = child.stderr.take();
 
@@ -257,29 +288,39 @@ impl TunnelHandle {
                     Err(_) => "Enable it from your tailnet admin console under \
                               Settings > Features > Funnel.".to_string(),
                 };
-                return Err(anyhow::anyhow!(
+                let e = anyhow::anyhow!(
                     "Tailscale Funnel is not enabled for this tailnet.\n\n\
                      {detail}\n\n\
                      After enabling, re-run `aoe serve --remote`. \
                      Or pass --no-tailscale to use Cloudflare instead."
-                ));
-            }
-            res = tokio::time::timeout(STEP_TIMEOUT, child.wait()) => {
-                res
-                    .map_err(|_| {
-                        anyhow::anyhow!(
-                            "tailscale funnel timed out after {}s; your node may not have \
-                             HTTPS certs enabled or Funnel may not be enabled in your tailnet \
-                             ACL. Run `AGENT_OF_EMPIRES_DEBUG=1 aoe serve --remote` and \
-                             check debug.log for the live output, or try \
-                             `tailscale funnel --bg --yes {}` ma
```

---

### Incident Patch 2: `687771d9` (2026-10-31)
**Commit Message**: fix(logging): make debug.log diagnosable, nothing dropped and every lifecycle event and failure logged (#5093)

* fix(logging): stop dropping unrooted targets and log session lifecycle

`filter_for_level` built the EnvFilter from `DEFAULT_TARGET_ROOTS` alone, so
events on any other root (`task.panic` errors, `push`, `file_watch`,
`events`, `conversation_summary`, `shutdown`) were dropped at every level,
and dependency crates never logged. Add the missing roots, prepend a fixed
`warn` catch-all, and add a source-scan test so a new root cannot drift
out again. Migration v053 deletes the persisted `runtime_filter`, which
would otherwise re-apply the old root list at boot.

Log every committed status transition once at `publish` time (ACP sessions
had none), add `info` summaries for session create/purge/trash/restart/
rename, and move the two per-poll debug sites that made up 88% of the file
(`list_sessions resolved`, `worker rpc ok`) to `trace`.

Prune dead `KNOWN_SUB_TARGETS` entries, add the new ones, and test both
that each entry exists in source and that the web mirror matches.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

* feat(logging): narrate every lifecycle event and

**File**: `docs/development.md` (modified, +5/-3)
```diff
@@ -51,9 +51,11 @@ aoe logs
 `cargo xtask dev` runs a dashboard-enabled debug backend on 8081 and Vite with HMR on 5173; `--watch` rebuilds and restarts the backend when Rust inputs change, leaving the previous backend running if a rebuild fails.
 
 Use explicit dotted tracing area targets so per-target logging overrides affect
-native and dashboard failures consistently. Settings > Logging exposes server,
-migration and process areas; clearing one override restores inheritance without
-clearing other targets.
+native and dashboard failures consistently. Every `target:` root used in `src/`
+must be listed in `DEFAULT_TARGET_ROOTS` in `src/logging.rs`; a unit test
+enforces it, and an unlisted root only reaches the file at `warn` and above.
+Dependency crates log at `warn` regardless of `default_level`. Clearing one override in
+Settings > Logging restores inheritance without clearing other targets.
 
 Filter changes saved in Settings > Logging apply to the TUI, running daemon and structured runners in the same app namespace. Sink and rotation changes require restart. No-op and unrelated saves preserve temporary runtime filters.
 
```

**File**: `docs/guides/configuration.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ Updates use a locked read-modify-write operation, preserving concurrent changes.
 | Variable | Description |
 |----------|-------------|
 | `AGENT_OF_EMPIRES_PROFILE` | Default profile |
-| `AOE_LOG_LEVEL` | File log level: `trace`, `debug`, `info`, `warn`, `error` |
+| `AOE_LOG_LEVEL` | File log level for AoE's own targets: `trace`, `debug`, `info`, `warn`, `error`. Dependency crates stay at `warn`. One-shot CLI commands always log to the same file at the configured level once the app directory exists; `[logging].output = "stdout"` applies to a foreground `aoe serve` only |
 | `AGENT_OF_EMPIRES_DEBUG` | Legacy alias for `AOE_LOG_LEVEL=debug` |
 | `AOE_DEFER_SANDBOX_MIGRATION` | Start without moving sandboxed sessions' agent stores; retried later or by `aoe migrate`. See [Per-session agent stores](sandbox.md#per-session-agent-stores) |
 
```

**File**: `src/acp/acp_client/connection/command_loop.rs` (modified, +3/-1)
```diff
@@ -160,7 +160,9 @@ impl Session {
                     // The supervisor publishes the terminal here (#1100).
                     info!(target: "acp.protocol", "force-stop requested with no prompt in flight; best-effort cancel only");
                     self.stand_down_idle_completion();
-                    let _ = self.send_cancel().await;
+                    if let Err(error) = self.send_cancel().await {
+                        debug!(target: "acp.protocol", %error, "cancel notification failed");
+                    }
                 }
                 Some(ClientCmd::SetMode(mode_id)) => self.dispatch_mode(mode_id, false),
                 Some(ClientCmd::DeleteSession {
```

**File**: `src/acp/acp_client/connection/notifications.rs` (modified, +1/-1)
```diff
@@ -283,7 +283,7 @@ impl Shared {
             // During replay only transcript events are dropped; ambient state
             // and lifecycle events still pass so pickers stay current.
             if suppressing && is_transcript_event(&event) {
-                debug!(
+                tracing::trace!(
                     target: "acp.protocol",
                     session = %self.session_label,
                     kind = transcript_event_kind(&event),
```

**File**: `src/acp/acp_client/connection/prompt.rs` (modified, +10/-3)
```diff
@@ -84,6 +84,8 @@ struct TurnFlags {
     prompt_cancelled: bool,
     orphan_cancel_sent: bool,
     cancelling: bool,
+    /// What the adapter reported; `None` when no `PromptResponse` arrived.
+    agent_stop_reason: Option<StopReason>,
 }
 
 struct Turn {
@@ -304,6 +306,7 @@ impl Session {
         let e = match res {
             Ok(resp) => {
                 turn.flags.prompt_cancelled = matches!(resp.stop_reason, StopReason::Cancelled);
+                turn.flags.agent_stop_reason = Some(resp.stop_reason);
                 if !turn.flags.prompt_cancelled {
                     if let Some(info) = self.take_parking_rejection() {
                         self.shared.emit(Event::RateLimit { info }).await;
@@ -400,7 +403,9 @@ impl Session {
                     target: "acp.protocol",
                     "force-stop requested during in-flight prompt; ending turn and restarting worker"
                 );
-                let _ = self.send_cancel().await;
+                if let Err(error) = self.send_cancel().await {
+                    debug!(target: "acp.protocol", %error, "cancel notification failed");
+                }
                 turn.flags.force_stopped = true;
                 turn.flags.shutdown = true;
                 return Ok(Flow::Break);
@@ -642,11 +647,13 @@ impl Session {
         shared.reset_message_dedup();
         shared.prompt_in_flight.store(false, Ordering::Relaxed);
         // Missing after a Stopped, this line signals a stranded prompt (#3190).
-        debug!(
+        info!(
             target: "acp.protocol",
             session = %shared.session_label,
             reason,
-            "prompt drain complete; between-prompt idle ownership restored"
+            agent_stop_reason = ?f.agent_stop_reason,
+            duration_ms = now_ms() - prompt_started_at_ms,
+            "turn finished; between-prompt idle ownership restored"
         );
     }
 }
```

**File**: `src/acp/acp_client/spawn.rs` (modified, +11/-2)
```diff
@@ -9,7 +9,7 @@ use std::process::Stdio;
 use tracing::{debug, info, warn};
 
 use super::errors::AcpError;
-use super::resolve_command::resolve_agent_command;
+use super::resolve_command::{resolve_agent_command, Unresolved};
 
 #[derive(Debug, Clone)]
 pub struct SpawnConfig {
@@ -464,7 +464,16 @@ pub(super) fn spawn_subprocess(
             r.path.to_string_lossy().into_owned(),
             r.prepend_paths.clone(),
         ),
-        Err(_) => (config.spec.command.clone(), Vec::new()),
+        Err(Unresolved::NotBare) => (config.spec.command.clone(), Vec::new()),
+        Err(error) => {
+            debug!(
+                target: "acp.protocol.spawn",
+                command = %config.spec.command,
+                ?error,
+                "could not resolve command via node-manager dirs; using bare command"
+            );
+            (config.spec.command.clone(), Vec::new())
+        }
     };
 
     let mut cmd = tokio::process::Command::new(&spawn_command);
```

**File**: `src/acp/adapters.rs` (modified, +4/-2)
```diff
@@ -1,7 +1,7 @@
 use std::path::{Path, PathBuf};
 
 use thiserror::Error;
-use tracing::{info, warn};
+use tracing::{error, info, warn};
 
 use crate::acp::node::{NodeSource, ResolvedNode};
 
@@ -347,7 +347,9 @@ fn publish(tmp: &Path, final_dir: &Path) -> std::io::Result<()> {
             Ok(())
         }
         Err(e) => {
-            let _ = std::fs::rename(&backup, final_dir);
+            if let Err(error) = std::fs::rename(&backup, final_dir) {
+                error!(target: "acp.adapters", %error, backup = %backup.display(), "failed to restore adapter backup");
+            }
             let _ = std::fs::remove_dir_all(tmp);
             Err(e)
         }
```

**File**: `src/acp/event_store/mod.rs` (modified, +12/-0)
```diff
@@ -339,6 +339,18 @@ fn decode(json: &str) -> Option<Event> {
     serde_json::from_str(json).ok()
 }
 
+fn decode_logged(json: &str, session_id: &str, what: &str) -> Option<Event> {
+    serde_json::from_str(json)
+        .map_err(|e| {
+            warn!(
+                target: "acp.event_store",
+                session = %session_id,
+                "{what}: deserialise failed: {e}"
+            )
+        })
+        .ok()
+}
+
 /// Log a failed query as `None`.
 fn logged<T>(result: rusqlite::Result<T>, what: &str, session_id: &str) -> Option<T> {
     result
```

---

### Incident Patch 3: `2a2e1a42` (2026-10-31)
**Commit Message**: feat(tui): show plugin-provided row status (#4789)

* feat(tui): show plugin status and browser links

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* test(tui): cover plugin status provider combinations

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* refactor(tui): keep plugin contributions status-only

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* docs: clarify native TUI plugin row rendering

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* fix(tui): stabilize plugin status CI

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* docs: preserve plugin badge ordering contract

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* fix(tui): address plugin status review feedback

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* fix(tui): factor status plan test cases into a type alias

Co-Authored-By: openai-codex/gpt-6-luna <[REDACTED_EMAIL]>

* fix(tui): harden plugin status poller and drop the web gate

Keeps the last good snapshot on transient fetch failures, clears it only
when the local daemon is genuinely gone, and stops polling on a rejected
bearer token to avoid repeated IP-wide lockout

**File**: `docs/plugin-api.md` (modified, +5/-1)
```diff
@@ -429,7 +429,9 @@ request({ method: "ready", params: { nonce: location.hash.slice(1) } }, (m) => p
 
 `status-bar`, `header-start` and `detail-badge` also take an integer `order`, default 0, lowest first; ties keep plugin id then entry id order. In the terminal UI they render as text and tone in the status line, `header-start` first; icons, tooltips and links are web only.
 
-Give items a shared `group` to collapse them into one chip that shows one item at a time. Clicking or tapping it advances to the next item and wraps around, for example a usage badge cycling `5h`, `7d` and `opus` values:
+`row-badge` items on terminal session rows render every item with `text` or `tooltip`, using `tooltip` when `text` is absent. With no `items` list, the top-level `row-badge` uses `tooltip` as a fallback label for missing `text`. `row-column` renders text only; the TUI omits icons and links.
+
+In the web dashboard, give items a shared `group` to collapse them into one chip that shows one item at a time. Clicking or tapping it advances to the next item and wraps around, for example a usage badge cycling `5h`, `7d` and `opus` values:
 
 ```json
 { "items": [
@@ -441,6 +443,8 @@ Give items a shared `group` to collapse them into one chip that shows one item a
 
 Items without a `group` stay separate chips, and each distinct `group` cycles independently. The position is kept per browser tab and is never sent to the worker. A cycling chip ignores `href`; a group with a single item renders as a normal chip. The TUI cannot click and shows the first item with text.
 
+Grouped `row-badge` items remain separate in the TUI and do not cycle.
+
 ### Pane payload
 
 A `pane` entry renders a dockable tool-window, pushed with `ui.state.set`:
```

**File**: `src/plugin/ui_state.rs` (modified, +2/-1)
```diff
@@ -252,7 +252,8 @@ pub struct Notification {
     pub href: Option<String>,
 }
 
-#[derive(Debug, Clone, Serialize, Deserialize)]
+/// One entry in a plugin UI snapshot.
+#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
 pub struct UiEntry {
     pub plugin_id: String,
     pub slot: UiSlot,
```

**File**: `src/tui/app.rs` (modified, +6/-0)
```diff
@@ -1316,6 +1316,8 @@ impl App {
                 needs_full_refresh = true;
             }
 
+            self.home.request_plugin_ui_refresh();
+
             if last_metrics_sample.elapsed() >= METRICS_SAMPLE_INTERVAL {
                 self.home.request_metrics_refresh();
                 last_metrics_sample = std::time::Instant::now();
@@ -1325,6 +1327,10 @@ impl App {
                 refresh_needed = true;
             }
 
+            if self.home.apply_plugin_ui_updates() {
+                needs_full_refresh = true;
+            }
+
             needs_full_refresh |= self.home.apply_session_feed();
             needs_full_refresh |= self.poll_dashboard_launch();
             needs_full_refresh |= self.poll_dashboard_stop();
```

**File**: `src/tui/home/lifecycle.rs` (modified, +1/-0)
```diff
@@ -230,6 +230,7 @@ impl HomeView {
             search_matches: Vec::new(),
             search_match_index: 0,
             available_tools,
+            plugin_ui: crate::tui::plugin_ui_poller::PluginUiState::default(),
             show_diagnostics: resolved.session.show_diagnostics_pane,
             show_shortcut_bar: resolved.session.show_shortcut_bar,
             preview_link_prefixes: resolved.session.preview_link_prefixes.clone(),
```

**File**: `src/tui/home/mod.rs` (modified, +1/-0)
```diff
@@ -355,6 +355,7 @@ pub struct HomeView {
 
     pub(super) available_tools: AvailableTools,
 
+    pub(super) plugin_ui: crate::tui::plugin_ui_poller::PluginUiState,
     pub(super) show_diagnostics: bool,
     pub(super) show_shortcut_bar: bool,
     pub(super) preview_link_prefixes: Vec<String>,
```

**File**: `src/tui/home/render.rs` (modified, +160/-5)
```diff
@@ -889,6 +889,65 @@ fn title_width_for_column(
     (title_width.min(budget), false)
 }
 
+const MAX_PLUGIN_STATUS_WIDTH: usize = 32;
+
+const MAX_PLUGIN_STATUS_COUNT: usize = 16;
+
+#[derive(Clone, Copy)]
+struct PluginStatusSpan<'a> {
+    text: &'a str,
+    tone: Option<crate::plugin::ui_state::Tone>,
+    width: usize,
+}
+
+struct PluginStatusPlan<'a> {
+    spans: [Option<PluginStatusSpan<'a>>; MAX_PLUGIN_STATUS_COUNT],
+    len: usize,
+    width: usize,
+}
+
+impl<'a> PluginStatusPlan<'a> {
+    fn iter(&self) -> impl Iterator<Item = PluginStatusSpan<'a>> + '_ {
+        self.spans[..self.len].iter().flatten().copied()
+    }
+}
+
+fn plan_plugin_statuses<'a>(
+    statuses: impl Iterator<Item = (&'a str, Option<crate::plugin::ui_state::Tone>)>,
+    budget: usize,
+) -> PluginStatusPlan<'a> {
+    let mut plan = PluginStatusPlan {
+        spans: [None; MAX_PLUGIN_STATUS_COUNT],
+        len: 0,
+        width: 0,
+    };
+    let budget = budget.min(MAX_PLUGIN_STATUS_WIDTH);
+
+    for (text, tone) in statuses {
+        if plan.len == MAX_PLUGIN_STATUS_COUNT {
+            break;
+        }
+        let available = budget.saturating_sub(plan.width).saturating_sub(2);
+        if available == 0 {
+            break;
+        }
+        let text_width = rendered_width(text);
+        let visible_width = text_width.min(available);
+        plan.spans[plan.len] = Some(PluginStatusSpan {
+            text,
+            tone,
+            width: visible_width,
+        });
+        plan.len += 1;
+        plan.width += 2 + visible_width;
+        if visible_width < text_width {
+            break;
+        }
+    }
+
+    plan
+}
+
 /// The activity column's text: remaining snooze under Attention sort, else the age of a
 /// resting (Idle or Unknown) row, else blank. `last_accessed_at` is only a fallback for a
 /// missing `idle_entered_at`; on an active row it reads as idle time.
@@ -1975,6 +2034,7 @@ impl HomeView {
         line_spans.push(Span::styled(format!("{} ", icon), icon_style));
         let prefix_width: usize = line_spans.iter().map(|s| s.width()).sum();
         let room = (list_width as usize).saturating_sub(prefix_width);
+        let text_width = rendered_width(&text);
 
         let inst = match item {
             Item::Session { id, .. } => self.get_instance(id).map(|inst| (id, inst)),
@@ -2039,18 +2099,46 @@ impl HomeView {
             LAST_ACTIVITY_SLOT
         };
 
-        let (title_width, keep_tag) = title_width_for_column(
-            rendered_width(&text),
-            room,
-            tag_span.as_ref().map_or(0, |s| s.width()),
-            slot_width + badge_width + LAST_ACTIVITY_RIGHT_MARGIN,
+        let tag_width = tag_span.as_ref().map_or(0, |span| span.width());
+        let fixed_trailing = slot_width + badge_width + LAST_ACTIVITY_RIGHT_MARGIN;
+
+        let status_budget = room
+            .saturating_sub(tag_width + fixed_trailing + text_width.min(MIN_TITLE_CELLS))
+            .min(MAX_PLUGIN_STATUS_WIDTH);
+
+        let plugin_status_plan = plan_plugin_statuses(
+            crate::tui::plugin_ui::session_row_statuses(&self.plugin_ui.snapshot, id),
+            status_budget,
         );
+        let plugin_status_width = plugin_status_plan.width;
+
+        let (title_width, keep_tag) = if plugin_status_width > 0 {
+            (
+                text_width
+                    .min(room.saturating_sub(tag_width + fixed_trailing + plugin_status_width)),
+                true,
+            )
+        } else {
+            title_width_for_column(text_width, room, tag_width, fixed_trailing)
+        };
         line_spans.push(Span::styled(
             truncate_to_width(&text, title_width),
             text_style,
         ));
         line_spans.extend(tag_span.filter(|_| keep_tag));
 
+        for status in plugin_status_plan.iter() {
+            line_spans.push(Span::raw("  "));
+            let status_style = crate::tui::plugin_ui::tone_style(status.tone, theme);
+            line_spans.push(Span::styled(
+                truncate_to_width(status.text, status.width),
+                if is_selected {
+                    selected_row_style(status_style, theme)
+                } else {
+                    status_style
+                },
+            ));
+        }
         let used_width: usize = line_spans.iter().map(|s| s.width()).sum();
         let column_pad = activity_column_padding(used_width, list_width, slot_width, badge_width);
         let column_fits = column_pad.is_some();
@@ -5427,3 +5515,70 @@ mod tests {
         assert_eq!(sb.rendered(), "[sb]");
     }
 }
+
+#[cfg(test)]
+mod plugin_status_plan_tests {
+    use super::plan_plugin_statuses;
+    use crate::plugin::ui_state::Tone;
+
+    /// (name, budget, count, expected span list, expected width).
+    type StatusPlanCase = (
+        &'static str,
+        usize,
+        usize,
+        Vec<(&'static str, Option<Tone>, usize)>,
+        usize,
+    );
+
+    #[test]
+    fn s
```

**File**: `src/tui/home/status.rs` (modified, +8/-0)
```diff
@@ -9,6 +9,14 @@ impl HomeView {
         self.instances.values().cloned().collect()
     }
 
+    pub fn request_plugin_ui_refresh(&mut self) {
+        self.plugin_ui.request_refresh(!self.instances.is_empty());
+    }
+
+    pub fn apply_plugin_ui_updates(&mut self) -> bool {
+        self.plugin_ui.apply_pending()
+    }
+
     /// Request a system-health sample in the background while either health
     /// surface is visible. Call `apply_metrics_updates` to pick up the result.
     pub fn request_metrics_refresh(&mut self) {
```

**File**: `src/tui/mod.rs` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ pub(crate) mod markdown;
 mod metrics_poller;
 pub(crate) mod open_url;
 pub(crate) mod plugin_ui;
+pub(crate) mod plugin_ui_poller;
+
 pub(crate) mod remote_home;
 pub(crate) mod responsive;
 mod session_feed;
```

#### Recent Merged Pull Requests:
- **PR #5178** (2026-10-31): docs(suggestions): add user guide for suggested sessions (@Seluj78)
- **PR #5175** (2026-10-31): fix(tui): repair the two unit tests red on the suggestions integration branch (@Seluj78)
- **PR #5170** (2026-10-31): feat(suggestions): started-session link, grouped view with refresh status, edge states (@Seluj78)
- **PR #5169** (2026-10-31): feat(tui): initial_prompt in the new-session dialog and aoe add --prompt, sanitise suggestion text (@Seluj78)
- **PR #5168** (2026-10-31): feat(suggestions): refresh interval, wizard Edit template link, uses_agent and provider fix (@Seluj78)
- **PR #5167** (2026-10-31): refactor(tui): share one suggestions store and open a suggestion's source from the palette (@Seluj78)

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

## X. serve): turn off the Funnel a failed Tailscale start switched on (#5043)

**RULE**:
When implementing operations in `docs/guides/web-dashboard.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3b7b4b7f`: serve): turn off the Funnel a failed Tailscale start switched on (#5043). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/guides/web-dashboard.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
1. **Tailscale Funnel:** if `tailscale` is installed and logged in, AoE runs `tailscale funnel --bg --yes <port>` for a stable `https://<machine>.<tailnet>.ts.net` URL. Install Tailscale, run `tailscale up`, enable [Funnel](https://login.tailscale.com/f/funnel), and grant the node the `funnel` nodeAttr in its [ACL](https://login.tailscale.com/admin/acls/file). Target the node's tag if tagged. A conflicting non-loopback Funnel on port 443 is refused, not replaced; clear it with `tailscale funnel reset`, or use `--no-tailscale`. Stale loopback AoE configuration can be replaced. AoE also refuses to start Funnel when port 443 has tailnet-only Serve config, which Funnel would make public, or when `tailscale funnel status` can't be read. If a start fails after turning Funnel on, AoE turns it back off, but only when port 443 was unused before and still holds just AoE's route; otherwise the error says what was left on. Two aoe daemons on one machine, such as a release and a debug build, take turns: a start waits up to 60 s for the other's to finish.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
1. **Tailscale Funnel:** if `tailscale` is installed and logged in, AoE runs `tailscale funnel --bg --yes <port>` for a stable `https://<machine>.<tailnet>.ts.net` URL. Install Tailscale, run `tailscale up`, enable [Funnel](https://login.tailscale.com/f/funnel), and grant the node the `funnel` nodeAttr in its [ACL](https://login.tailscale.com/admin/acls/file). Target the node's tag if tagged. A conflicting non-loopback Funnel on port 443 is refused, not replaced; clear it with `tailscale funnel reset`, or use `--no-tailscale`. Stale loopback AoE configuration can be replaced.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3b7b4b7f` are properly handled with clean fallback behavior.
