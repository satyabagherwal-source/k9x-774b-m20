> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `691b8d2c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:49:41.729Z  
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
> **Harvest Timestamp**: 2026-10-27T17:44:39.051Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3389 stars

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
        if adopted && !shared.terminal_claim.claim() {
            return false;
        }
        // The limit arrives as agent text with no prompt error; 
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

    /// Freeze the predecessor role, never a later registry observation.
    pub(crate) fn owe_previous_retirement(&self) {
        self.construction
            .retire_previous
            .store(true, std::sync::atomic::Ordering::Release);
    }

    /// The original captured predecessor, only after its retirement debt is owed.
    pub(crate) fn retirement_previous_runner(&self) -> Option<RunnerIdentity> {
        self.construction
            .retire_previous
            .load(std::sync::atomic::Ordering::Acquire)
            .then(|| self.previous_runner())
            .flatten()
    }

    pub(crate) fn retirement_runners(&self) -> impl Iterator<Item = RunnerIdentity> {
        let current = self.spawned_runner().filter(|_| !self.is_borrowed_attach());
        let previous = self.retirement_previous_runn
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
- **Issue #4896** (2026-10-26): **Local TUI restart silently removes the configured passphrase gate**
  *Symptoms*: ### What happened?  A Local dashboard started from a TUI inheriting `AOE_SERVE_PASSPHRASE` enables the passphrase gate, but confirming Restart in that same TUI silently removes it. Local binds `0.0.0.0`, so this can affect LAN clients. Token authentication remains active: this is loss of the additional passphrase gate, **not unauthenticated access**.  **Source-derived reproduction, not executed:**  1. In a disposable account on an isolated network, launch `AOE_SERVE_PASSPHRASE='dummy-test-secret' aoe` and start the Web dashboard in Local mode. 2. Using a fresh HTTP client with the current URL token and no login cookie, request `/api/login/status`. The passphrase is required (`required: true`). 3. Confirm Restart with R twice in the TUI, without changing its environment. Repeat the request using the current URL token. 4. The successor is constructed without a passphrase (`required: false`). Expected: restart preserves the effective passphrase requirement.  **Cause at [`0400f174`](https://github.com/agent-of-empires/agent-of-empires/commit/0400f1748a179b839d86243e9024a05e24d9e0b2):** Local restart supplies `None` ([request](https://github.com/agent-of-empires/agent-of-empires/blob/0400f1748a179b839d86243e9024a05e24d9e0b2/src/tui/dialogs/serve/mod.rs#L655-L662)). Its override bypasses startup's environment fallback and takes precedence over the recovered predecessor credential ([restart](https://github.com/agent-of-empires/agent-of-empires/blob/0400f1748a179b839d86243e9024a05e24

- **Issue #4848** (2026-10-26): **Hold every session-list request in the delayed-layout regression**
  *Symptoms*: ### What happened?  P3 test follow-up to #4644; no local flaky-run reproduction is claimed.  In [web/tests/live/right-panel.spec.ts:64](https://github.com/agent-of-empires/agent-of-empires/blob/4f72cb0273fa31a73d453284304b47c74f982477/web/tests/live/right-panel.spec.ts#L64-L94), the route holds only the first GET, while [web/src/hooks/useSessions.ts:57](https://github.com/agent-of-empires/agent-of-empires/blob/4f72cb0273fa31a73d453284304b47c74f982477/web/src/hooks/useSessions.ts#L57-L64) keeps polling. A subsequent GET can load the row and pin layout before `release()`, so the intended unknown-state precondition is not protected.  The same test awaits `pane-toggle-diff` before release, but [web/src/components/TopBar.tsx:221](https://github.com/agent-of-empires/agent-of-empires/blob/4f72cb0273fa31a73d453284304b47c74f982477/web/src/components/TopBar.tsx#L221-L224) renders that control only after the Session is known. Merely holding every GET would leave this assertion waiting for its own blocked prerequisite.  **Acceptance:** hold all list GETs until explicit release. After the causal diff-request barrier, assert storage remains unpinned and the toggle is absent; release, await the row/toggle and persisted layout, then assert its inactive state. Use observable checkpoints, not fixed sleeps. The test must remain valid even if polling happens before release.  ### aoe version and OS  Source at upstream/main `4f72cb0273fa31a73d453284304b47c74f982477` (1.21.0). Live Playwright test 

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

### Incident Patch 1: `886b11b6` (2026-10-26)
**Commit Message**: fix(session): report Busy consistently across CLI, TUI and HTTP delete paths (#4925)

* fix(session): report Busy and Superseded as distinct delete outcomes

Split DeletionDisposition::Superseded from Busy, name the holding operation
in 409 lifecycle responses, list Busy sessions in empty-trash and workspace
delete, and give the TUI a Busy message for lifecycle_locked.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* test(session): cover Busy holder, retry after release, and the contract docs

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(daemon): keep superseded distinct from busy in the client

Superseded now has its own finite code header and TUI text that does not
promise nothing changed, since a superseded purge may have started teardown.

Addresses review comment from @jerome-benoit on #4925.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(session): report stale abandon-purge as superseded and keep restore holder

lifecycle_busy is now reserved for a confirmed holder; a stale purge
generation answers lifecycle_superseded and restore names the holding
operation.

Addresses review comment from @jerome-benoit on #4925.

Co-Authored-By: Claude S

**File**: `docs/api.md` (modified, +12/-0)
```diff
@@ -646,6 +646,18 @@ Complete purge recovery before retrying; this busy refusal does not degrade runt
 Purge refuses unresolved runner ownership before committing deletion. The row
 and its resources remain available for repair and retry.
 
+Delete, purge and restore share one Busy contract. Busy means another lifecycle
+operation holds the session, nothing changed, and the caller may retry once it
+finishes. It is not `KeptRestored` (restored mid-purge), already gone, or a
+cleanup failure. Over HTTP it is `409` with the `lifecycle_locked` code header
+and `{"error":"lifecycle_busy","operation":"<holder>"}`; a selection that
+changed after it was made is `409` with its own `lifecycle_superseded` code
+header; it may already be partly processed, so refresh and check before retrying. A batch delete that skips Busy sessions lists them under `busy` and
+reports `partial`; when nothing else completed it answers `409 lifecycle_busy`.
+`aoe rm --purge` and `aoe session restore` exit non-zero for Busy. `aoe session
+empty-trash` purges the rest, lists each skipped session on stderr, then exits
+non-zero.
+
 Selected-trash actions include `expected_trashed_at`, `expected_generation` and
 `expected_trash_lifecycle_id`. The durable identity distinguishes restore/retrash
 even when timestamps coincide.
```

**File**: `src/cli/remove.rs` (modified, +3/-0)
```diff
@@ -245,6 +245,9 @@ pub async fn run(profile: &str, args: RemoveArgs) -> Result<()> {
                 .first()
                 .map(String::as_str)
                 .unwrap_or("Session purge was refused");
+            if result.disposition == crate::session::deletion::DeletionDisposition::Busy {
+                anyhow::bail!("{detail}: {removed_title}; nothing changed, retry once it finishes");
+            }
             anyhow::bail!("{detail}: {removed_title}");
         }
     };
```

**File**: `src/cli/session.rs` (modified, +88/-1)
```diff
@@ -684,6 +684,7 @@ async fn empty_trash(profile: &str) -> Result<()> {
     let mut kept_for_retry = 0usize;
     let mut being_restored_elsewhere = 0usize;
     let mut being_purged_elsewhere = 0usize;
+    let mut busy = Vec::new();
     for inst in &trashed {
         let config = crate::session::config::repo_config::resolve_config_with_repo_or_warn(
             profile,
@@ -717,6 +718,9 @@ async fn empty_trash(profile: &str) -> Result<()> {
                         being_restored_elsewhere += 1;
                     }
                     crate::session::deletion::DeletionDisposition::Busy => {
+                        busy.push(busy_line(inst, &result));
+                    }
+                    crate::session::deletion::DeletionDisposition::Superseded => {
                         being_purged_elsewhere += 1;
                     }
                     _ => {}
@@ -742,6 +746,9 @@ async fn empty_trash(profile: &str) -> Result<()> {
                 }
             }
             crate::session::deletion::DeletionDisposition::Busy => {
+                busy.push(busy_line(inst, &result));
+            }
+            crate::session::deletion::DeletionDisposition::Superseded => {
                 being_purged_elsewhere += 1;
             }
             crate::session::deletion::DeletionDisposition::Failed => kept_for_retry += 1,
@@ -770,9 +777,12 @@ async fn empty_trash(profile: &str) -> Result<()> {
             "{being_restored_elsewhere} being restored by another process"
         ));
     }
+    if !busy.is_empty() {
+        parts.push(format!("skipped {} busy", busy.len()));
+    }
     if being_purged_elsewhere > 0 {
         parts.push(format!(
-            "{being_purged_elsewhere} being purged by another process"
+            "{being_purged_elsewhere} changed during purge, rerun to retry"
         ));
     }
     if outcome.restored_after_teardown > 0 {
@@ -786,9 +796,26 @@ async fn empty_trash(profile: &str) -> Result<()> {
         parts.join(", "),
         storage.profile()
     );
+    if !busy.is_empty() {
+        for line in &busy {
+            eprintln!("{line}");
+        }
+        anyhow::bail!(
+            "{} session(s) were skipped because another operation holds them; nothing changed \
+             for those, retry once the operation finishes",
+            busy.len()
+        );
+    }
     Ok(())
 }
 
+fn busy_line(inst: &Instance, result: &crate::session::deletion::DeletionResult) -> String {
+    let reason = result
+        .conflict()
+        .map_or_else(|| "busy".to_owned(), |error| error.to_string());
+    format!("  Busy: {}  {} ({reason})", inst.id, inst.title)
+}
+
 async fn snooze_session(profile: &str, args: SnoozeArgs) -> Result<()> {
     let config = crate::session::config::profile_config::resolve_config(profile)?;
 
@@ -4091,3 +4118,63 @@ mod wait_decision_tests {
         assert!(adopt_stored(&live, converted).is_err());
     }
 }
+
+#[cfg(test)]
+mod empty_trash_busy_tests {
+    use super::empty_trash;
+    use crate::session::{Instance, LifecycleOperation, Storage};
+
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn empty_trash_purges_the_rest_then_fails_for_a_busy_session() {
+        let _home = crate::session::test_support::isolate_app_dir();
+        let root = crate::session::get_app_dir().unwrap();
+        crate::session::purge_owners::initialize(&root).unwrap();
+        crate::tmux::tool_retirement::initialize(&root).unwrap();
+        let profile = "empty-trash-busy";
+        let storage = Storage::new_unwatched(profile).unwrap();
+        let mut busy = Instance::new("busy", "/tmp/empty-trash-busy-a");
+        let mut free = Instance::new("free", "/tmp/empty-trash-busy-b");
+        for row in [&mut busy, &mut free] {
+            row.source_profile = profile.into();
+            row.trash();
+        }
+        let busy_id = busy.id.clone();
+        storage
+            .update(|rows, _| {
+                rows.extend([busy, free]);
+                Ok(())
+            })
+            .unwrap();
+        let generation = storage
+            .update(|rows, _| {
+                let row = rows.iter_mut().find(|row| row.id == busy_id).unwrap();
+                Ok(row
+                    .try_acquire_lifecycle_reservation(
+                        LifecycleOperation::Restore,
+                        Instance::LIFECYCLE_RESERVATION_TTL,
+                        chrono::Utc::now(),
+                    )
+                    .unwrap())
+            })
+            .unwrap();
+
+        let error = empty_trash(profile).await.unwrap_err().to_string();
+        assert!(error.contains("1 session(s) were skipped"), "{error}");
+        let left = storage.load().unwrap();
+        assert_eq!(left.len(), 1);
+        assert_eq!(left[0].id, busy_id);
+
+        storage
+            .update(|rows, _| {
+                rows[0].release_lifecycle_reservation_if_owned(
+                    LifecycleOperation::Restore,
+                  
```

**File**: `src/daemon/error.rs` (modified, +10/-0)
```diff
@@ -11,6 +11,7 @@ pub enum ApiErrorCode {
     AccessPolicyDenied,
     CityhallMode,
     LifecycleLocked,
+    LifecycleSuperseded,
     PendingTargetGone,
     TlsRequired,
     RuntimeEpochMismatch,
@@ -36,6 +37,7 @@ impl ApiErrorCode {
             Self::AccessPolicyDenied => "access_policy_denied",
             Self::CityhallMode => "cityhall_mode",
             Self::LifecycleLocked => "lifecycle_locked",
+            Self::LifecycleSuperseded => "lifecycle_superseded",
             Self::PendingTargetGone => "pending_target_gone",
             Self::StartFailed => "start_failed",
             Self::PurgeFailed => "purge_failed",
@@ -61,6 +63,7 @@ impl ApiErrorCode {
             | Self::AccessPolicyDenied
             | Self::CityhallMode => StatusCode::FORBIDDEN,
             Self::LifecycleLocked
+            | Self::LifecycleSuperseded
             | Self::RuntimeEpochMismatch
             | Self::ResumeFailed
             | Self::PurgeFailed
@@ -100,6 +103,7 @@ impl ApiErrorCode {
             b"access_policy_denied" => Self::AccessPolicyDenied,
             b"cityhall_mode" => Self::CityhallMode,
             b"lifecycle_locked" => Self::LifecycleLocked,
+            b"lifecycle_superseded" => Self::LifecycleSuperseded,
             b"pending_target_gone" if resolving_pending_target => Self::PendingTargetGone,
             b"tls_required" => Self::TlsRequired,
             b"runtime_epoch_mismatch" => Self::RuntimeEpochMismatch,
@@ -176,6 +180,12 @@ mod tests {
                 Some(ApiErrorCode::NoRevive),
             ),
             (StatusCode::FORBIDDEN, "no_revive", false, None),
+            (
+                StatusCode::CONFLICT,
+                "lifecycle_superseded",
+                false,
+                Some(ApiErrorCode::LifecycleSuperseded),
+            ),
             (
                 StatusCode::BAD_REQUEST,
                 "create_hook_failed",
```

**File**: `src/daemon/mod.rs` (modified, +44/-1)
```diff
@@ -166,6 +166,12 @@ fn daemon_status_message(status: StatusCode, code: Option<ApiErrorCode>, body: &
         }
         Some(ApiErrorCode::StartFailed) => "Session start failed".into(),
         Some(ApiErrorCode::PurgeFailed) => "Session purge failed".into(),
+        Some(ApiErrorCode::LifecycleLocked) => {
+            "Session is busy with another operation; nothing changed, retry when it finishes".into()
+        }
+        Some(ApiErrorCode::LifecycleSuperseded) => {
+            "Session changed after it was selected; it may be partly processed, refresh and check before retrying".into()
+        }
         _ => format!("daemon returned HTTP {status}: {body}"),
     }
 }
@@ -873,7 +879,11 @@ impl DaemonClient {
             // D1: 409 lifecycle_locked maps from status plus the single finite
             // server-owned header without reading the body. 401 maps from status
             // alone; neither retains a body or token in the error.
-            if code == Some(ApiErrorCode::LifecycleLocked) || status == StatusCode::UNAUTHORIZED {
+            if matches!(
+                code,
+                Some(ApiErrorCode::LifecycleLocked | ApiErrorCode::LifecycleSuperseded)
+            ) || status == StatusCode::UNAUTHORIZED
+            {
                 return Err(DaemonClientError::Status {
                     status,
                     code,
@@ -1524,10 +1534,43 @@ mod tests {
             ),
             "409 lifecycle_locked must map from status plus header with no body read, got: {error:?}"
         );
+        assert!(
+            error.to_string().contains("busy with another operation"),
+            "TUI-facing text must say the session is busy, got: {error}"
+        );
         let captured = next_request(rx).await;
         assert_eq!(captured.path, "/api/sessions/sess-1/stop");
     }
 
+    #[tokio::test]
+    async fn conflict_lifecycle_superseded_stays_distinct_from_busy() {
+        let (tx, _rx) = tokio::sync::oneshot::channel();
+        let base = serve_mutation_once(
+            "/api/sessions/{id}/stop",
+            409,
+            vec![(ERROR_CODE_HEADER, "lifecycle_superseded")],
+            r#"{"error":"lifecycle_superseded","message":"changed"}"#,
+            tx,
+        )
+        .await;
+        let client = DaemonClient::new(&base, None).expect("test client");
+        let error = client
+            .mutate_session("sess-1", &SessionMutation::Stop, "epoch-1")
+            .await
+            .expect_err("conflict must fail");
+        assert!(matches!(
+            error,
+            DaemonClientError::Status {
+                code: Some(ApiErrorCode::LifecycleSuperseded),
+                ref body,
+                ..
+            } if body.is_empty()
+        ));
+        let text = error.to_string();
+        assert!(text.contains("changed after it was selected"), "{text}");
+        assert!(!text.contains("nothing changed"), "{text}");
+    }
+
     #[tokio::test]
     async fn unauthorized_maps_by_status_without_body_or_token() {
         let (tx, rx) = tokio::sync::oneshot::channel();
```

**File**: `src/server/api/sessions/delete.rs` (modified, +48/-21)
```diff
@@ -133,16 +133,8 @@ pub(crate) async fn purge_session_artifacts(
                     messages: result.errors,
                     teardown_started: false,
                 }),
-                DeletionDisposition::Busy => {
-                    let operation = result
-                        .retained_instance
-                        .as_ref()
-                        .and_then(|row| row.lifecycle_reservation.as_ref())
-                        .map(|reservation| reservation.op);
-                    Err(operation
-                        .map(crate::session::LifecycleReservationError::Busy)
-                        .unwrap_or(crate::session::LifecycleReservationError::Superseded)
-                        .into())
+                DeletionDisposition::Busy | DeletionDisposition::Superseded => {
+                    Err(result.conflict().expect("conflict disposition").into())
                 }
                 DeletionDisposition::Failed | DeletionDisposition::Removed => {
                     Err(anyhow::anyhow!(result.errors.join("; ")))
@@ -211,7 +203,7 @@ pub(crate) async fn purge_session_artifacts(
                 teardown_started: result.teardown_started,
             });
         }
-        DeletionDisposition::Busy => {
+        DeletionDisposition::Busy | DeletionDisposition::Superseded => {
             anyhow::bail!(crate::session::LifecycleReservationError::Superseded)
         }
         DeletionDisposition::Failed => {
@@ -898,13 +890,25 @@ pub async fn abandon_purge(
                 !cityhall || row.is_structured(),
                 LifecycleTargetError::CityHall
             );
-            anyhow::ensure!(
-                row.lifecycle_reservation_is_owned(
-                    LifecycleOperation::Purge,
-                    body.expected_generation.get()
-                ),
-                LifecycleTargetError::Busy
-            );
+            if !row.lifecycle_reservation_is_owned(
+                LifecycleOperation::Purge,
+                body.expected_generation.get(),
+            ) {
+                let holder = row
+                    .lifecycle_reservation
+                    .as_ref()
+                    .filter(|reservation| {
+                        reservation.op != LifecycleOperation::Purge
+                            && row.has_fresh_lifecycle_reservation(chrono::Utc::now())
+                    })
+                    .map(|reservation| reservation.op);
+                return Err(holder
+                    .map_or(
+                        crate::session::LifecycleReservationError::Superseded,
+                        crate::session::LifecycleReservationError::Busy,
+                    )
+                    .into());
+            }
             removed = Some(rows.remove(index));
             Ok(())
         })?;
@@ -980,6 +984,9 @@ pub struct TrashPurgeConsent {
 pub(super) struct WorkspaceDeleteFailure {
     pub(super) id: String,
     pub(super) error: String,
+    /// Another lifecycle operation holds the session; reported under `busy`.
+    #[serde(skip)]
+    pub(super) busy: bool,
 }
 
 /// Preserve first-seen order without deleting the same row twice.
@@ -1139,6 +1146,7 @@ pub(super) async fn purge_workspace_artifacts(
                     failed.push(WorkspaceDeleteFailure {
                         id: owner_id,
                         error: format!("Resource ownership unavailable: {error:#}"),
+                        busy: false,
                     });
                     return (deleted, kept, failed, messages, None);
                 }
@@ -1148,6 +1156,7 @@ pub(super) async fn purge_workspace_artifacts(
                 failed.push(WorkspaceDeleteFailure {
                     id: owner_id,
                     error: format!("Workspace: {msg}"),
+                    busy: false,
                 });
                 return (deleted, kept, failed, messages, Some(msg));
             }
@@ -1180,6 +1189,7 @@ pub(super) async fn purge_workspace_artifacts(
                     failed.push(WorkspaceDeleteFailure {
                         id: id.clone(),
                         error: cleanup_errors.join("; "),
+                        busy: false,
                     });
                     deleted.push(id);
                     break;
@@ -1197,6 +1207,10 @@ pub(super) async fn purge_workspace_artifacts(
                 failed.push(WorkspaceDeleteFailure {
                     id: id.clone(),
                     error: msg.to_string(),
+                    busy: matches!(
+                        msg.downcast_ref::<crate::session::LifecycleReservationError>(),
+                        Some(crate::session::LifecycleReservationError::Busy(_))
+                    ),
                 });
                 // The owner remains intact when a sibling cannot be safely removed.
                 break;
@@ -1288,6 +1302,7 @@ pub async fn delete_workspace(
             )
                 .into_response();
         }
+        let (busy, failed): (Ve
```

**File**: `src/server/api/sessions/lifecycle.rs` (modified, +53/-18)
```diff
@@ -748,7 +748,13 @@ pub async fn restore_session(
                 let now = chrono::Utc::now();
                 if !row.is_trashed() {
                     if row.has_fresh_lifecycle_reservation(now) {
-                        return Err(LifecycleTargetError::Busy.into());
+                        return Err(row.lifecycle_reservation.as_ref().map_or(
+                            LifecycleTargetError::Busy.into(),
+                            |reservation| {
+                                crate::session::LifecycleReservationError::Busy(reservation.op)
+                                    .into()
+                            },
+                        ));
                     }
                     return Ok(None);
                 }
@@ -763,8 +769,8 @@ pub async fn restore_session(
                     crate::session::claim::RestoreClaimDecision::AlreadyGone => {
                         Err(LifecycleTargetError::Missing.into())
                     }
-                    crate::session::claim::RestoreClaimDecision::Busy(_) => {
-                        Err(LifecycleTargetError::Busy.into())
+                    crate::session::claim::RestoreClaimDecision::Busy(holder) => {
+                        Err(crate::session::LifecycleReservationError::Busy(holder).into())
                     }
                 }
             })?;
@@ -804,7 +810,7 @@ pub async fn restore_session(
                         Err(LifecycleTargetError::Missing.into())
                     }
                     crate::session::claim::RestoreCommit::Superseded => {
-                        Err(LifecycleTargetError::Busy.into())
+                        Err(crate::session::LifecycleReservationError::Superseded.into())
                     }
                 }
             })?;
@@ -1140,21 +1146,50 @@ pub(crate) fn lifecycle_rejection(
     if error.is::<crate::session::SessionGone>() {
         return Some(crate::server::api::session_not_found());
     }
-    if matches!(
-        error.downcast_ref::<LifecycleTargetError>(),
-        Some(LifecycleTargetError::Busy)
-    ) || matches!(
-        error.downcast_ref::<crate::session::LifecycleReservationError>(),
-        Some(
-            crate::session::LifecycleReservationError::Busy(_)
-                | crate::session::LifecycleReservationError::Superseded
+    let (code, operation, message) = match error
+        .downcast_ref::<crate::session::LifecycleReservationError>()
+    {
+        Some(crate::session::LifecycleReservationError::Busy(operation)) => (
+            "lifecycle_busy",
+            Some(*operation),
+            format!(
+                "Session is busy with {}; nothing changed, retry when it finishes",
+                serde_json::json!(operation)
+                    .as_str()
+                    .unwrap_or("another operation")
+            ),
+        ),
+        Some(crate::session::LifecycleReservationError::Superseded) => (
+            "lifecycle_superseded",
+            None,
+            "Session changed after it was selected; refresh and check before retrying".to_owned(),
+        ),
+        _ if matches!(
+            error.downcast_ref::<LifecycleTargetError>(),
+            Some(LifecycleTargetError::Busy)
+        ) =>
+        {
+            (
+                "lifecycle_busy",
+                None,
+                "Session lifecycle is busy".to_owned(),
+            )
+        }
+        _ => return None,
+    };
+    let header = if code == "lifecycle_superseded" {
+        crate::daemon::ApiErrorCode::LifecycleSuperseded.header()
+    } else {
+        crate::daemon::ApiErrorCode::LifecycleLocked.header()
+    };
+    Some(
+        (
+            StatusCode::CONFLICT,
+            header,
+            Json(serde_json::json!({"error": code, "operation": operation, "message": message})),
         )
-    ) {
-        return Some((StatusCode::CONFLICT,
-            crate::daemon::ApiErrorCode::LifecycleLocked.header(),
-            Json(serde_json::json!({"error": "lifecycle_busy", "message": "Session lifecycle is busy"}))).into_response());
-    }
-    None
+            .into_response(),
+    )
 }
 
 async fn adopt_lifecycle_commit<R>(
```

**File**: `src/server/api/sessions/tests.rs` (modified, +140/-3)
```diff
@@ -2013,6 +2013,138 @@ async fn purge_receipt_publishes_removal_and_committed_peer_rows() -> anyhow::Re
     Ok(())
 }
 
+#[tokio::test]
+#[serial_test::serial]
+async fn purge_of_a_busy_session_names_the_holder_and_retries_after_release() -> anyhow::Result<()>
+{
+    use axum::body::to_bytes;
+    let _guard = crate::session::test_support::isolate_app_dir();
+    crate::session::purge_owners::initialize(&crate::session::get_app_dir()?)?;
+    crate::tmux::tool_retirement::initialize(&crate::session::get_app_dir()?)?;
+    let mut row = Instance::new("busy purge", "/tmp/busy-purge");
+    row.source_profile = "busy".into();
+    row.status = Status::Stopped;
+    row.trash();
+    let id = row.id.clone();
+    let state = crate::server::test_support::build_test_app_state(vec![row.clone()]);
+    let storage = Storage::new("busy", state.file_watch.clone())?;
+    storage.update(|rows, _| {
+        rows.push(row);
+        Ok(())
+    })?;
+    *state.canonical_metadata.write().await =
+        crate::server::reload::load_all_profiles(&state.file_watch)?.metadata;
+    state.runtime.publish(&state).await?;
+    let generation = storage.update(|rows, _| {
+        Ok(rows[0]
+            .try_acquire_lifecycle_reservation(
+                crate::session::LifecycleOperation::Restore,
+                Instance::LIFECYCLE_RESERVATION_TTL,
+                chrono::Utc::now(),
+            )
+            .unwrap())
+    })?;
+
+    let single = delete_session(State(state.clone()), Path(id.clone()), None)
+        .await
+        .into_response();
+    assert_eq!(single.status(), StatusCode::CONFLICT);
+    let body: serde_json::Value =
+        serde_json::from_slice(&to_bytes(single.into_body(), usize::MAX).await?)?;
+    assert_eq!(body["error"], "lifecycle_busy");
+    assert_eq!(body["operation"], "restore");
+
+    let batch = delete_workspace(
+        State(state.clone()),
+        Some(Json(DeleteWorkspaceBody {
+            session_ids: vec![id.clone()],
+            ..Default::default()
+        })),
+    )
+    .await
+    .into_response();
+    assert_eq!(batch.status(), StatusCode::CONFLICT);
+    let body: serde_json::Value =
+        serde_json::from_slice(&to_bytes(batch.into_body(), usize::MAX).await?)?;
+    assert_eq!(body["error"], "lifecycle_busy");
+    assert_eq!(body["busy"][0]["id"], id.as_str());
+    assert_eq!(storage.load()?.len(), 1);
+
+    let restore = restore_session(State(state.clone()), Path(id.clone()))
+        .await
+        .into_response();
+    assert_eq!(restore.status(), StatusCode::CONFLICT);
+    let body: serde_json::Value =
+        serde_json::from_slice(&to_bytes(restore.into_body(), usize::MAX).await?)?;
+    assert_eq!(body["error"], "lifecycle_busy");
+    assert_eq!(body["operation"], "restore");
+
+    storage.update(|rows, _| {
+        rows[0].release_lifecycle_reservation_if_owned(
+            crate::session::LifecycleOperation::Restore,
+            generation,
+        );
+        Ok(())
+    })?;
+    let retried = delete_session(State(state.clone()), Path(id), None)
+        .await
+        .into_response();
+    assert_eq!(retried.status(), StatusCode::OK);
+    assert!(storage.load()?.is_empty());
+    Ok(())
+}
+
+#[tokio::test]
+#[serial_test::serial]
+async fn purge_of_a_retained_handoff_reports_busy_launch_over_http() -> anyhow::Result<()> {
+    use axum::body::to_bytes;
+    let _guard = crate::session::test_support::isolate_app_dir();
+    crate::session::purge_owners::initialize(&crate::session::get_app_dir()?)?;
+    crate::tmux::tool_retirement::initialize(&crate::session::get_app_dir()?)?;
+    let mut row = Instance::new("owed handoff", "/tmp/owed-handoff");
+    row.source_profile = "owed".into();
+    row.status = Status::Stopped;
+    row.terminal_handoff = Some(Box::new(crate::session::test_support::launch_owed_handoff(
+        &row,
+    )));
+    row.trash();
+    let id = row.id.clone();
+    let state = crate::server::test_support::build_test_app_state(vec![row.clone()]);
+    let storage = Storage::new("owed", state.file_watch.clone())?;
+    storage.update(|rows, _| {
+        rows.push(row);
+        Ok(())
+    })?;
+    *state.canonical_metadata.write().await =
+        crate::server::reload::load_all_profiles(&state.file_watch)?.metadata;
+    state.runtime.publish(&state).await?;
+
+    let single = delete_session(State(state.clone()), Path(id.clone()), None)
+        .await
+        .into_response();
+    assert_eq!(single.status(), StatusCode::CONFLICT);
+    let body: serde_json::Value =
+        serde_json::from_slice(&to_bytes(single.into_body(), usize::MAX).await?)?;
+    assert_eq!(body["error"], "lifecycle_busy");
+    assert_eq!(body["operation"], "launch");
+
+    let batch = delete_workspace(
+        State(state.clone()),
+        Some(Json(DeleteWorkspaceBody {
+            session_ids: vec![id.clone()],
+            ..Default::default()
+        })),
+    )
+    .await
+    .into_response();
+    assert_e
```

---

### Incident Patch 2: `b264770c` (2026-10-26)
**Commit Message**: feat(daemon): align native transport security and safe API errors (#4743)

* feat(server): resolve ingress once and refuse plaintext remote peers with 426

Forwarded headers are honored only from a loopback peer in proxy mode, the Cloudflare
client header only from a Cloudflare tunnel, and plain HTTP from a non-loopback peer
gets 426 tls_required unless --dangerously-allow-plaintext-remote is set.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(cli): read and set the log level through the typed daemon client

The command printed the server's raw response body, including on errors. It now goes
through HttpClient, classifies failures from the status and error-code header, and
prints a typed reply.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(acp-client): classify passphrase login errors from the safe error code

Addresses review comment from @jerome-benoit on #4743.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(acp-client): fall back to a passphrase login when a bearer alone is refused

A token-plus-passphrase daemon needs a login session even with a valid token. A cached
session now wins, a bearer is tried next, and a bearer 401 retries on

**File**: `docs/api.md` (modified, +2/-0)
```diff
@@ -201,6 +201,8 @@ session when login is enabled. They are unavailable in CityHall mode. Adoption
 rejects symlinks, special files, packages over 64 MiB, individual files over
 32 MiB, more than 1,024 files, and directory nesting deeper than 16 levels.
 
+Native clients classify errors from the status and one `AoE-Error-Code` response header, never from the body. A missing, repeated, unknown or status-inconsistent value means "generic status". Plain HTTP from a non-loopback peer gets `426 tls_required` before authentication unless the bind sets `--dangerously-allow-plaintext-remote`.
+
 ## Runtime CLI reads
 
 Read-only CLI commands use `/api/runtime/read/ws` when `--daemon-url` or `AOE_DAEMON_URL` selects an HTTP endpoint. `/api/runtime/ws` is reserved for the TUI stream and does not serve this one-shot protocol.
```

**File**: `docs/cli/reference.md` (modified, +2/-1)
```diff
@@ -1764,7 +1764,8 @@ Start the aoe daemon: REST/WebSocket API, plus the web dashboard in builds that
   Possible values: `token`, `passphrase`, `none`
 
 * `--no-auth` — Disable authentication (only allowed with localhost binding). Alias for --auth=none
-* `--behind-proxy` — Mark this server as sitting behind a reverse proxy that terminates TLS upstream. Sets cookies as `; Secure` and trusts the `X-Forwarded-For` / `cf-connecting-ip` headers from loopback peers. Does NOT auto-spawn a tunnel (unlike --remote). Required when --auth=passphrase or --auth=none is combined with a non-loopback bind
+* `--behind-proxy` — Mark this server as sitting behind a reverse proxy that terminates TLS upstream. Sets cookies as `; Secure` and trusts the `X-Forwarded-For` header from loopback peers. Does NOT auto-spawn a tunnel (unlike --remote). Required when --auth=passphrase or --auth=none is combined with a non-loopback bind
+* `--dangerously-allow-plaintext-remote` — Accept plain HTTP from non-loopback peers. By default the server answers those with 426 before authentication: bearer tokens and passphrases would cross the network in the clear. A TLS proxy or tunnel in front of a loopback listener (`--behind-proxy`, `--remote`) needs no opt-out. This applies to this bind only, is never inferred from the address, and is logged at every start
 * `--allowed-host <HOST>` — Extra `Host` header value to accept (repeatable). The DNS-rebinding gate trusts loopback, any routable IP-literal `Host` (LAN/tailnet IPs can't be rebound), and a non-wildcard `--host` by default. A browser `Origin` is accepted without `--allowed-origin` only when it is allowlisted or has the exact same authority as `Host`; add a HOSTNAME or mDNS name here when serving behind a reverse proxy, a custom tunnel, or by name when binding `0.0.0.0` (access by IP needs no flag). Auto-injected tunnel hosts (`--remote`) need no flag
 * `--allowed-origin <ORIGIN>` — Extra browser `Origin` to accept (repeatable, full origin `scheme://host[:port]`, e.g. `https://aoe.example.com:8443`). Needed only for a reverse proxy on a nonstandard port; standard 80/443 origins for `--allowed-host` entries are derived automatically
 * `--read-only` — Read-only mode: view terminals but cannot send keystrokes
```

**File**: `docs/guides/web-dashboard.md` (modified, +7/-5)
```diff
@@ -20,7 +20,7 @@ The dashboard ships in release binaries. Source builds need the `web` Cargo feat
 ```bash
 aoe serve                       # Localhost only (safe, default)
 aoe serve --remote              # Remote over HTTPS (Tailscale Funnel, else Cloudflare quick tunnel)
-aoe serve --host 0.0.0.0        # LAN/VPN access (HTTP, requires VPN)
+aoe serve --host 0.0.0.0        # LAN/VPN bind; plain-HTTP peers get 426 unless --dangerously-allow-plaintext-remote
 aoe serve --daemon              # Run in background
 aoe daemon start                # Same; also stop, status, restart
 aoe serve --open                # Open the URL in the default browser when ready
@@ -85,7 +85,8 @@ In `--remote` mode the token rotates every four hours. Use `aoe url` for the liv
 | `--host` | 127.0.0.1 | Bind address. Use `0.0.0.0` for LAN/VPN access |
 | `--auth` | `token` | Auth mode: `token` (URL token), `passphrase` (passphrase login wall only), `none` (no auth, loopback only unless `--behind-proxy`) |
 | `--passphrase` | | Passphrase for the login wall. Valid with `--auth=token` (token + passphrase) and `--auth=passphrase`. Also reads `AOE_SERVE_PASSPHRASE` |
-| `--behind-proxy` | off | Server sits behind an external reverse proxy that terminates TLS. Sets `; Secure` cookies and trusts `X-Forwarded-For` / `cf-connecting-ip` from loopback peers; does NOT spawn a tunnel. Requires at least one `--allowed-host` |
+| `--behind-proxy` | off | Server sits behind an external reverse proxy that terminates TLS. Sets `; Secure` cookies and trusts `X-Forwarded-For` and `X-Forwarded-Proto` from loopback peers, and from no one else; does NOT spawn a tunnel. Requires at least one `--allowed-host` |
+| `--dangerously-allow-plaintext-remote` | off | Accept plain HTTP from non-loopback peers instead of answering `426`; see [Security](#security) |
 | `--allowed-host` | | Extra `Host` value the DNS-rebinding gate accepts (repeatable). Add the public hostname behind a reverse proxy or custom tunnel, or a hostname/mDNS name when binding `0.0.0.0` (routable IP literals are trusted automatically). `--remote` tunnel hosts are added automatically |
 | `--allowed-origin` | | Extra browser `Origin` to accept (repeatable, full origin `scheme://host[:port]`). Needed only for a reverse proxy on a nonstandard port; standard 80/443 origins for `--allowed-host` entries are derived automatically |
 | `--no-auth` | off | Alias for `--auth=none` (kept for backwards compatibility) |
@@ -143,7 +144,7 @@ aoe serve \
   --allowed-host aoe.example.com
 ```
 
-The upstream must set `X-Forwarded-For` (or `cf-connecting-ip`); aoe reads the last value as the client IP. The trust check fires only when the socket peer is loopback, so a misconfigured upstream that lets requests reach aoe directly cannot spoof the IP.
+The upstream must set `X-Forwarded-For` and `X-Forwarded-Proto: https`; aoe reads the last value of each, and only when the socket peer is loopback, so a client or misconfigured upstream cannot spoof them. `--remote` over a Cloudflare tunnel also supplies `cf-connecting-ip`; `--behind-proxy` and Tailscale Funnel ignore it because a proxy can pass a client-chosen one through. A request whose client address is missing or malformed shares one rate-limit bucket. A loopback proxy that omits `X-Forwarded-Proto` makes no HTTPS assertion and is not refused; only an explicit non-`https` value gets `426`.
 
 With `--auth=passphrase --behind-proxy`, the passphrase wall applies to TCP loopback callers too. Proxied traffic arrives on a loopback TCP socket, so an upstream that forgets the header would otherwise hand visitors the same-host bypass. A browser on the same host signs in with the passphrase like any other TCP client. The local TUI and local `aoe acp` commands instead use the owner-verified Unix API; they do not read `serve.passphrase` or perform a login exchange. See [Cross-machine attach](../structured-view.md#cross-machine-attach) for explicit TCP and remote ACP authentication.
 
@@ -198,6 +199,7 @@ Control a manager-owned daemon with `systemctl --user` or `launchctl`, not `aoe
 
 - **Token auth** (`--auth=token`, default): a random 256-bit token, generated on startup and stored at `~/.config/agent-of-empires/serve.token` (Linux) or `~/.agent-of-empires/serve.token` (macOS). Passed via URL on first visit, then kept as an `HttpOnly; SameSite=Strict` cookie.
 - **Passphrase wall** (`--auth=passphrase`, or combined with token via `--passphrase`): an argon2-hashed passphrase gates `/login`. Sessions bind to a per-device secret in `localStorage`, so a leaked cookie alone is insufficient.
+- **Plaintext refusal**: plain HTTP from a non-loopback peer gets `426` before authentication, so tokens and passphrases never cross a network in the clear. A TLS proxy or tunnel in front of a loopback bind is unaffected. A direct bind to a LAN or tailnet IP needs `--dangerously-allow-plaintext-remote` (per bind, logged at every start). Native clients likewise refuse to send a tok
```

**File**: `src/acp/client/http.rs` (modified, +279/-51)
```diff
@@ -62,6 +62,17 @@ pub enum PromptDispositionWire {
 /// under the server's `MAX_REPLAY_PAGE` so it is never clamped down.
 pub const REPLAY_PAGE_SIZE: u64 = 1000;
 
+/// `GET` and `PATCH /api/log-level` answers; each leaves out the fields the other owns.
+#[derive(Debug, serde::Deserialize, serde::Serialize)]
+pub struct LogFilterReply {
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub previous: Option<String>,
+    pub current: Option<String>,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub reloadable: Option<bool>,
+    pub ephemeral: bool,
+}
+
 /// Acp daemon HTTP client. Cheap to clone; the underlying
 /// `reqwest::Client` is reference-counted.
 #[derive(Debug, Clone)]
@@ -606,46 +617,62 @@ impl HttpClient {
         check_resolve_status(res, session_id)
     }
 
-    /// Read sessions with the endpoint's bearer token or passphrase session.
+    /// Read sessions with the endpoint's bearer token or passphrase session,
+    /// recovering once from a stale session or a bearer a second factor refused.
     pub async fn list_sessions(
         &self,
         state: Option<crate::session::SessionScope>,
     ) -> Result<crate::daemon::SessionsEnvelope, HttpError> {
-        let had_cached_session = self.endpoint.bearer_token().is_none()
-            && self.passphrase_session.get(&self.endpoint).is_some();
-        match self.list_sessions_once(state).await {
-            Err(HttpError::Unauthorized) if had_cached_session => {
+        let had_cached_session =
+            self.can_login() && self.passphrase_session.get(&self.endpoint).is_some();
+        let bearer_only =
+            !had_cached_session && self.endpoint.bearer_token().is_some() && self.can_login();
+        match self.list_sessions_once(state, false).await {
+            Err(HttpError::Unauthorized) if had_cached_session || bearer_only => {
                 self.passphrase_session.invalidate(&self.endpoint);
-                self.list_sessions_once(state).await
+                self.list_sessions_once(state, true).await
             }
             result => result,
         }
     }
 
     pub(crate) async fn daemon_client(&self) -> Result<crate::daemon::DaemonClient, HttpError> {
+        self.daemon_client_with(false).await
+    }
+
+    /// Same credential order as [`Self::attach_credential`].
+    async fn daemon_client_with(
+        &self,
+        force_session: bool,
+    ) -> Result<crate::daemon::DaemonClient, HttpError> {
         let base_url = &self.endpoint.base_url;
-        let client = if let Some(path) = self.endpoint.unix_path() {
-            crate::daemon::DaemonClient::new_unix(path)
-        } else if let Some(token) = self.endpoint.bearer_token() {
-            crate::daemon::DaemonClient::new(base_url, Some(token))
-        } else if self.endpoint.resolved_passphrase().is_some() {
-            let session = self.ensure_passphrase_session().await?;
-            crate::daemon::DaemonClient::with_session(
-                base_url,
-                &session.cookie,
-                &session.binding_secret,
-            )
-        } else {
-            crate::daemon::DaemonClient::new(base_url, None)
-        }?;
-        Ok(client)
+        if let Some(path) = self.endpoint.unix_path() {
+            return Ok(crate::daemon::DaemonClient::new_unix(path)?);
+        }
+        let can_login = self.can_login();
+        let cached = can_login && self.passphrase_session.get(&self.endpoint).is_some();
+        if !(force_session && can_login || cached) {
+            if let Some(token) = self.endpoint.bearer_token() {
+                return Ok(crate::daemon::DaemonClient::new(base_url, Some(token))?);
+            }
+            if !can_login {
+                return Ok(crate::daemon::DaemonClient::new(base_url, None)?);
+            }
+        }
+        let session = self.ensure_passphrase_session().await?;
+        Ok(crate::daemon::DaemonClient::with_session(
+            base_url,
+            &session.cookie,
+            &session.binding_secret,
+        )?)
     }
 
     async fn list_sessions_once(
         &self,
         state: Option<crate::session::SessionScope>,
+        force_session: bool,
     ) -> Result<crate::daemon::SessionsEnvelope, HttpError> {
-        let client = self.daemon_client().await?;
+        let client = self.daemon_client_with(force_session).await?;
         client
             .list_sessions(state)
             .await
@@ -655,6 +682,11 @@ impl HttpClient {
                 {
                     HttpError::Unauthorized
                 }
+                crate::daemon::DaemonClientError::Status {
+                    status,
+                    code: Some(code),
+                    ..
+                } => classify_code(status, Some(code), None, false),
                 error => HttpError::Daemon(error),
             })
     }
@@ -715,6 +747,20 @@ impl HttpClient {
         })
     }
 
+    /// `GET /api/log-level`, or `PATCH` it first when `patc
```

**File**: `src/acp/client/passphrase_session.rs` (modified, +46/-21)
```diff
@@ -84,10 +84,15 @@ pub(crate) async fn login(
         "passphrase": passphrase,
         "device_binding_secret": binding_secret,
     });
-    let res = client.post(url).json(&body).send().await?;
+    // A token-plus-passphrase daemon gates the login route on the bearer too.
+    let mut request = client.post(url).json(&body);
+    if let Some(token) = endpoint.bearer_token() {
+        request = request.bearer_auth(token);
+    }
+    let res = request.send().await?;
     let status = res.status();
     if !status.is_success() {
-        return Err(map_auth_error(status));
+        return Err(map_auth_error(status, res.headers()));
     }
     let cookie = extract_session_cookie(res.headers()).ok_or(HttpError::Unauthorized)?;
     let session = PassphraseSession {
@@ -99,15 +104,10 @@ pub(crate) async fn login(
     Ok(session)
 }
 
-/// Authentication response bodies can reflect credentials, including transformed values.
-fn map_auth_error(status: StatusCode) -> HttpError {
-    match status {
-        StatusCode::UNAUTHORIZED => HttpError::Unauthorized,
-        _ => HttpError::Server {
-            status,
-            body: String::new(),
-        },
-    }
+/// Authentication response bodies can reflect credentials, so only the status and the
+/// validated error-code header are read.
+fn map_auth_error(status: StatusCode, headers: &HeaderMap) -> HttpError {
+    super::http::classify_status(status, headers, None, false)
 }
 
 /// Confirm the passphrase again against `POST /api/login/elevate`, extending
@@ -136,7 +136,7 @@ pub(super) async fn elevate(
     if status.is_success() {
         return Ok(());
     }
-    Err(map_auth_error(status))
+    Err(map_auth_error(status, res.headers()))
 }
 
 fn login_client(url: impl reqwest::IntoUrl) -> Result<(reqwest::Client, reqwest::Url), HttpError> {
@@ -471,16 +471,41 @@ mod tests {
         assert!(cache_dir.join(DEVICE_BINDING_FILENAME).exists());
     }
 
+    /// 401 maps from the status alone; a coded 403 keeps its code only when exactly one
+    /// known value agrees with the status. The body is never an input.
     #[test]
-    fn map_auth_error_distinguishes_unauthorized_from_generic() {
-        assert!(matches!(
-            map_auth_error(StatusCode::UNAUTHORIZED),
-            HttpError::Unauthorized
-        ));
-        assert!(matches!(
-            map_auth_error(StatusCode::TOO_MANY_REQUESTS),
-            HttpError::Server { status, .. } if status == StatusCode::TOO_MANY_REQUESTS
-        ));
+    fn map_auth_error_classifies_from_the_status_and_one_valid_code() {
+        let headers = |values: &[&str]| {
+            let mut map = HeaderMap::new();
+            for value in values {
+                map.append("aoe-error-code", value.parse().unwrap());
+            }
+            map
+        };
+        let forbidden = StatusCode::FORBIDDEN;
+        for (status, values, want) in [
+            (StatusCode::UNAUTHORIZED, &["read_only"][..], "unauthorized"),
+            (forbidden, &["read_only"], "read_only"),
+            (
+                forbidden,
+                &["access_policy_denied"],
+                "code:access_policy_denied",
+            ),
+            (forbidden, &[], "status"),
+            (forbidden, &["not_a_code"], "status"),
+            (forbidden, &["access_policy_denied", "read_only"], "status"),
+            (StatusCode::CONFLICT, &["access_policy_denied"], "status"),
+            (StatusCode::TOO_MANY_REQUESTS, &[], "status"),
+        ] {
+            let got = match map_auth_error(status, &headers(values)) {
+                HttpError::Unauthorized => "unauthorized".to_string(),
+                HttpError::ReadOnly => "read_only".to_string(),
+                HttpError::Server { body, .. } if !body.is_empty() => format!("code:{body}"),
+                HttpError::Server { .. } => "status".to_string(),
+                other => panic!("{status} {values:?}: {other:?}"),
+            };
+            assert_eq!(got, want, "{status} {values:?}");
+        }
     }
 
     #[tokio::test]
```

**File**: `src/acp/client/ws.rs` (modified, +40/-15)
```diff
@@ -182,37 +182,45 @@ where
 
 /// Open the session stream, retrying once after a fresh passphrase login if a
 /// *cached* session was rejected (rotated passphrase, expired or evicted
-/// session). A first-ever login failure is not retried: the passphrase itself
-/// is wrong, not merely stale.
+/// session), or if a bearer token alone was refused and a passphrase resolves (a
+/// daemon that also requires the second factor). A first-ever login failure is
+/// not retried: the passphrase itself is wrong, not merely stale.
 async fn connect_session(
     endpoint: &DaemonEndpoint,
     path: &str,
     query: &str,
 ) -> Result<NativeSocket, WsError> {
     let cache = PassphraseSessionCache::default();
     let had_cached_session = cache.get(endpoint).is_some();
-    let headers = session_headers(endpoint, &cache).await?;
+    let headers = session_headers(endpoint, &cache, false).await?;
+    let bearer_only =
+        !had_cached_session && endpoint.bearer_token().is_some() && can_login(endpoint);
     match websocket::connect_with_headers(endpoint, path, Some(query), &headers).await {
-        Err(error) if had_cached_session && is_unauthorized(&error) => {
+        Err(error) if (had_cached_session || bearer_only) && is_unauthorized(&error) => {
             cache.invalidate(endpoint);
-            let headers = session_headers(endpoint, &cache).await?;
+            let headers = session_headers(endpoint, &cache, true).await?;
             websocket::connect_with_headers(endpoint, path, Some(query), &headers).await
         }
         connected => connected,
     }
 }
 
-/// The passphrase-login headers this upgrade must carry, or none when the
-/// endpoint needs none: a resolved bearer token already rides the
-/// `Authorization` header, a local Unix-socket daemon is authorized by its
-/// peer owner, and `--auth=none` resolves no passphrase at all.
+/// A passphrase can be used: never over a Unix socket, whose peer owner authorizes the
+/// connection, and never without one resolving (`--auth=none`).
+fn can_login(endpoint: &DaemonEndpoint) -> bool {
+    endpoint.unix_path().is_none() && endpoint.resolved_passphrase().is_some()
+}
+
+/// The passphrase-login headers this upgrade must carry, or none when the endpoint needs
+/// none. A cached session wins, then a bearer token (which already rides the
+/// `Authorization` header), then a fresh login; `force_session` skips the bearer.
 async fn session_headers(
     endpoint: &DaemonEndpoint,
     cache: &PassphraseSessionCache,
+    force_session: bool,
 ) -> Result<Vec<(HeaderName, HeaderValue)>, WsError> {
-    if endpoint.bearer_token().is_some()
-        || endpoint.unix_path().is_some()
-        || endpoint.resolved_passphrase().is_none()
+    if !can_login(endpoint)
+        || (endpoint.bearer_token().is_some() && !force_session && cache.get(endpoint).is_none())
     {
         return Ok(Vec::new());
     }
@@ -535,7 +543,7 @@ mod tests {
         let _env = crate::session::test_support::EnvGuard::unset(&["AOE_DAEMON_PASSPHRASE"]);
         let e = endpoint("http://127.0.0.1:8080", Some("tok"));
         let cache = PassphraseSessionCache::default();
-        assert!(session_headers(&e, &cache).await.unwrap().is_empty());
+        assert!(session_headers(&e, &cache, false).await.unwrap().is_empty());
     }
 
     #[tokio::test]
@@ -544,7 +552,24 @@ mod tests {
         let _env = crate::session::test_support::EnvGuard::unset(&["AOE_DAEMON_PASSPHRASE"]);
         let e = endpoint("http://127.0.0.1:8080", None);
         let cache = PassphraseSessionCache::default();
-        assert!(session_headers(&e, &cache).await.unwrap().is_empty());
+        assert!(session_headers(&e, &cache, false).await.unwrap().is_empty());
+    }
+
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn a_cached_session_wins_over_a_bearer_but_a_bearer_alone_sends_no_session() {
+        let _app = crate::session::test_support::isolate_app_dir();
+        let _env =
+            crate::session::test_support::EnvGuard::set(&[("AOE_DAEMON_PASSPHRASE", "hunter2")]);
+        let e = endpoint("http://127.0.0.1:8080", Some("tok"));
+        let cache = PassphraseSessionCache::default();
+        assert!(session_headers(&e, &cache, false).await.unwrap().is_empty());
+        cache.set_for_test(passphrase_session::PassphraseSession {
+            cookie: "aoe_session=abc123".to_string(),
+            binding_secret: "the-binding-secret".to_string(),
+        });
+        let headers = session_headers(&e, &cache, false).await.unwrap();
+        assert!(headers.iter().any(|(name, _)| *name == header::COOKIE));
     }
 
     #[tokio::test]
@@ -560,7 +585,7 @@ mod tests {
             binding_secret: "the-binding-secret".to_string(),
         });
 
-        let headers = session_headers(&e, &cache).await.unwrap();
+        let headers = session_headers(&e, &cache, false).await.unwrap();
         let value_of = |name: header::HeaderName| {
             headers
            
```

**File**: `src/cli/log_level.rs` (modified, +18/-69)
```diff
@@ -3,8 +3,6 @@
 use anyhow::{bail, Context, Result};
 use clap::Args;
 
-use super::serve::read_serve_urls;
-
 #[derive(Args)]
 pub struct LogLevelArgs {
     /// Bare level (trace|debug|info|warn|error). Expands to all known
@@ -25,64 +23,28 @@ pub struct LogLevelArgs {
 
 #[tracing::instrument(target = "cli.log_level", skip_all)]
 pub async fn run(args: LogLevelArgs) -> Result<()> {
-    let urls = read_serve_urls();
-    let Some(primary) = urls.first() else {
-        bail!("No aoe serve daemon is running, or serve.url is empty/missing.");
-    };
-
-    let base = primary
-        .url
-        .split('?')
-        .next()
-        .unwrap_or(&primary.url)
-        .trim_end_matches('/');
-    let endpoint = format!("{base}/api/log-level");
-    let token = crate::daemon::authorization_header(extract_token(&primary.url))?;
-    let endpoint = crate::daemon::native_url(&endpoint)?;
-    let client = crate::daemon::native_http_client(&endpoint, token.is_some())?;
-
-    if args.get || (args.level.is_none() && args.filter.is_none()) {
-        let mut req = client.get(endpoint);
-        if let Some(t) = token {
-            req = req.header(reqwest::header::AUTHORIZATION, t);
-        }
-        let resp = req.send().await.context("GET /api/log-level")?;
-        let status = resp.status();
-        let body = resp.text().await.unwrap_or_default();
-        if !status.is_success() {
-            bail!("server returned {status}: {body}");
+    let endpoint = crate::acp::client::discovery::discover_local()
+        .context("No aoe serve daemon is running.")?;
+    let client = crate::acp::client::HttpClient::new(endpoint)?;
+
+    let patch = match (args.level.as_deref(), args.filter.as_deref()) {
+        _ if args.get => None,
+        (None, None) => None,
+        (Some(level), None) if matches_known_level(level) => {
+            Some(serde_json::json!({ "level": level }))
         }
-        println!("{body}");
-        return Ok(());
-    }
-
-    let body = match (args.level.as_deref(), args.filter.as_deref()) {
-        (Some(level), None) => {
-            if matches_known_level(level) {
-                serde_json::json!({ "level": level })
-            } else {
-                bail!(
-                    "{level:?} is not a known level. \
-                     Use trace|debug|info|warn|error, or pass --filter for raw EnvFilter syntax."
-                );
-            }
-        }
-        (None, Some(filter)) => serde_json::json!({ "filter": filter }),
+        (Some(level), None) => bail!(
+            "{level:?} is not a known level. \
+             Use trace|debug|info|warn|error, or pass --filter for raw EnvFilter syntax."
+        ),
+        (None, Some(filter)) => Some(serde_json::json!({ "filter": filter })),
         (Some(_), Some(_)) => bail!("specify exactly one of <level> or --filter"),
-        (None, None) => unreachable!("guarded above"),
     };
 
-    let mut req = client.patch(endpoint).json(&body);
-    if let Some(t) = token {
-        req = req.header(reqwest::header::AUTHORIZATION, t);
-    }
-    let resp = req.send().await.context("PATCH /api/log-level")?;
-    let status = resp.status();
-    let text = resp.text().await.unwrap_or_default();
-    if !status.is_success() {
-        bail!("server returned {status}: {text}");
-    }
-    println!("{text}");
+    println!(
+        "{}",
+        serde_json::to_string(&client.log_level(patch.as_ref()).await?)?
+    );
     Ok(())
 }
 
@@ -92,16 +54,3 @@ fn matches_known_level(s: &str) -> bool {
         "trace" | "debug" | "info" | "warn" | "warning" | "error"
     )
 }
-
-fn extract_token(url: &str) -> Option<&str> {
-    let query = url.split_once('?').map(|(_, q)| q)?;
-    for pair in query.split('&') {
-        if let Some(rest) = pair.strip_prefix("token=") {
-            if rest.is_empty() {
-                return None;
-            }
-            return Some(rest);
-        }
-    }
-    None
-}
```

**File**: `src/cli/runtime_read/mod.rs` (modified, +115/-26)
```diff
@@ -385,9 +385,8 @@ async fn upgrade_http(
     let peer = stream
         .peer_addr()
         .map_err(|_| ReadFailure::post("unavailable"))?;
-    let auth = if !request.headers().contains_key("Authorization")
-        && std::env::var_os("AOE_DAEMON_PASSPHRASE").is_some()
-    {
+    let had_bearer = request.headers().contains_key("Authorization");
+    let auth = if std::env::var_os("AOE_DAEMON_PASSPHRASE").is_some() {
         let uri = request.uri();
         let path = uri
             .path()
@@ -403,44 +402,57 @@ async fn upgrade_http(
             // Login uses the connected loopback address, never a second localhost lookup.
             format!("http://{peer}{path}")
         };
-        let endpoint = DaemonEndpoint::new(base, None, Source::Env);
+        let bearer = request
+            .headers()
+            .get("Authorization")
+            .and_then(|value| value.to_str().ok())
+            .and_then(|value| value.strip_prefix("Bearer "))
+            .map(str::to_string);
+        let endpoint = DaemonEndpoint::new(base, bearer, Source::Env);
         endpoint
             .resolved_passphrase()
             .is_some()
             .then(|| (endpoint, PassphraseSessionCache::default()))
     } else {
         None
     };
+    // A bearer goes first. A 401 on it falls back to one passphrase login, which then
+    // replaces the bearer, the same order the HTTP client uses.
+    let mut login_now = !had_bearer;
     let mut refreshed = false;
     loop {
         let mut had_cached_session = false;
         if let Some((endpoint, cache)) = &auth {
             let session = match cache.get(endpoint) {
                 Some(session) => {
                     had_cached_session = true;
-                    session
+                    Some(session)
                 }
-                None => {
+                None if login_now => Some(
                     tokio::time::timeout_at(deadline, passphrase_session::login(endpoint, cache))
                         .await
                         .map_err(|_| ReadFailure::post("unavailable"))?
-                        .map_err(map_login_error)?
-                }
+                        .map_err(map_login_error)?,
+                ),
+                None => None,
             };
-            request.headers_mut().insert(
-                "Cookie",
-                session
-                    .cookie
-                    .parse()
-                    .map_err(|_| ReadFailure::post("unauthorized"))?,
-            );
-            request.headers_mut().insert(
-                "X-Aoe-Device-Binding",
-                session
-                    .binding_secret
-                    .parse()
-                    .map_err(|_| ReadFailure::post("unauthorized"))?,
-            );
+            if let Some(session) = session {
+                request.headers_mut().remove("Authorization");
+                request.headers_mut().insert(
+                    "Cookie",
+                    session
+                        .cookie
+                        .parse()
+                        .map_err(|_| ReadFailure::post("unauthorized"))?,
+                );
+                request.headers_mut().insert(
+                    "X-Aoe-Device-Binding",
+                    session
+                        .binding_secret
+                        .parse()
+                        .map_err(|_| ReadFailure::post("unauthorized"))?,
+                );
+            }
         }
         let result = tokio::time::timeout_at(
             deadline,
@@ -456,11 +468,16 @@ async fn upgrade_http(
         match result {
             Ok((stream, _)) => return Ok(stream),
             Err(WsError::Http(response))
-                if response.status().as_u16() == 401 && had_cached_session && !refreshed =>
+                if response.status().as_u16() == 401
+                    && auth.is_some()
+                    && ((had_cached_session && !refreshed) || !login_now) =>
             {
-                let (endpoint, cache) = auth.as_ref().expect("cached passphrase session");
-                cache.invalidate(endpoint);
-                refreshed = true;
+                let (endpoint, cache) = auth.as_ref().expect("passphrase auth");
+                if had_cached_session {
+                    cache.invalidate(endpoint);
+                    refreshed = true;
+                }
+                login_now = true;
                 request = match endpoint::select_endpoint(source)? {
                     SelectedEndpoint::Http { request } => *request,
                     SelectedEndpoint::Local => unreachable!("captured HTTP source"),
@@ -1143,4 +1160,76 @@ mod tests {
             .unwrap()
             .unwrap();
     }
+
+    /// A bearer alone is refused on a token-plus-passphrase daemon, so the read falls back to
+    /// one passphrase login (which carries the bearer) instead of failing.
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn a_bearer_refused_f
```

---

### Incident Patch 3: `60f0031d` (2026-10-26)
**Commit Message**: fix(server): refuse a missing relative ACP adapter in an existing project (#4971)

* fix(server): refuse a missing relative ACP adapter in an existing project

The create check skipped relative adapter commands, so a missing
./node_modules/.bin/x only failed at spawn. Check it against the project
dir when that dir exists; a not-yet-created launch dir or any hook still
gets the benefit of the doubt.

* fix(cli): clean up provisioned resources when add refuses a missing adapter

Addresses review comment from jerome-benoit on #4971. The explicit --agent
refusal ran after the scratch dir or worktree was provisioned and bailed
without cleanup; the relative-adapter check made that reachable.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `src/cli/add.rs` (modified, +10/-0)
```diff
@@ -698,6 +698,16 @@ pub async fn run(profile: &str, args: AddArgs) -> Result<()> {
             let hint = crate::acp::install_hints::install_hint_for(&spec.command)
                 .unwrap_or("install via your package manager and re-run");
             if user_picked_agent {
+                cleanup_partial_session(
+                    &path,
+                    instance.worktree_info.as_ref(),
+                    instance.workspace_info.as_ref(),
+                    args.create_branch,
+                    instance
+                        .scratch
+                        .then(|| std::path::Path::new(&instance.project_path)),
+                    None,
+                );
                 bail!(
                     "ACP adapter `{}` is not installed or not on $PATH.\n\
                          Install: {}\n\
```

**File**: `src/session/builder.rs` (modified, +46/-3)
```diff
@@ -1359,9 +1359,14 @@ pub mod structured {
             return true;
         }
         if !is_bare_command(command) {
-            let checkable =
-                command.contains("${aoe_data_dir}") || std::path::Path::new(command).is_absolute();
-            return !checkable || crate::cli::acp::command_present(command);
+            let path = std::path::Path::new(command);
+            if command.contains("${aoe_data_dir}") || path.is_absolute() {
+                return crate::cli::acp::command_present(command);
+            }
+            // Spawned from the project, so a relative path resolves there; a launch
+            // directory that doesn't exist yet may still gain it.
+            return command.contains("${")
+                || project_path.is_none_or(|cwd| !cwd.is_dir() || cwd.join(path).exists());
         }
         let app_dir = crate::session::get_app_dir().ok();
         if resolve_agent_command(command, app_dir.as_deref()).is_ok() {
@@ -1708,6 +1713,8 @@ mod tests {
                     "fake-present-path",
                     bin.join(&adapter).display().to_string(),
                 ),
+                ("fake-rel-present", format!("agent-bin/{adapter}")),
+                ("fake-rel-missing", "agent-bin/aoe-test-missing".to_string()),
             ] {
                 config.session.agent_acp_cmd.insert(name.into(), cmd);
             }
@@ -1725,6 +1732,7 @@ mod tests {
         };
         let configured = vec![format!("PATH={}", bin.display())];
         let present_wrapper = bin.join(&adapter).display().to_string();
+        let not_created = project.path().join("not-created");
         let missing_text = "is not installed or not on $PATH";
         let missing = Some(missing_text);
         let not_capable = Some("is not ACP-capable");
@@ -1849,6 +1857,41 @@ mod tests {
                 before_session_hook: true,
                 ..base()
             },
+            Case {
+                label: "relative command, present in the project",
+                tool: "fake-rel-present",
+                ..base()
+            },
+            Case {
+                label: "relative command, missing from an existing project",
+                tool: "fake-rel-missing",
+                expected: missing,
+                ..base()
+            },
+            Case {
+                label: "relative command, launch dir not created yet",
+                tool: "fake-rel-missing",
+                project: None,
+                ..base()
+            },
+            Case {
+                label: "relative command, project dir absent on disk",
+                tool: "fake-rel-missing",
+                project: Some(&not_created),
+                ..base()
+            },
+            Case {
+                label: "a before_session hook may install a relative command",
+                tool: "fake-rel-missing",
+                before_session_hook: true,
+                ..base()
+            },
+            Case {
+                label: "an on_create hook may install a relative command",
+                tool: "fake-rel-missing",
+                preparation_hooks: true,
+                ..base()
+            },
             Case {
                 label: "absolute command, present",
                 tool: "fake-present-path",
```

**File**: `tests/e2e/cli.rs` (modified, +19/-0)
```diff
@@ -1446,6 +1446,25 @@ fn cli_add_effort_is_stored_and_refusals_provision_nothing() {
     }
 }
 
+/// An explicit `--agent` whose relative adapter is missing is refused after the scratch dir
+/// is provisioned, so the refusal must remove it.
+#[test]
+#[parallel]
+fn cli_add_missing_relative_adapter_leaves_no_scratch_dir() {
+    let h = TuiTestHarness::new("cli_add_missing_adapter");
+    h.append_config("[session.agent_acp_cmd]\nfake = \"./missing-acp\"");
+
+    let stderr = h.run_cli_err(&["add", "--scratch", "-t", "Refused", "--agent", "fake"]);
+    assert!(stderr.contains("is not installed"), "{stderr}");
+
+    let scratch_root = app_dir_in(h.home_path()).join("scratch");
+    assert_eq!(
+        std::fs::read_dir(&scratch_root).map_or(0, Iterator::count),
+        0,
+        "the refused add left its scratch dir behind"
+    );
+}
+
 /// #1051: `aoe ps --json` is fail-soft on an empty profile with no tmux
 /// server: an empty array and exit 0, never a failed substrate probe.
 #[test]
```

#### Recent Merged Pull Requests:
- **PR #4986** (2026-10-27): fix(web): defer first layout persistence until repository status is known (@Seluj78)
- **PR #4985** (2026-10-27): fix(acp): do not park a turn that extra usage covers (@Seluj78)
- **PR #4984** (2026-10-27): fix(web): serve one display name per Agent from the server (@Seluj78)
- **PR #4979** (2026-10-27): docs(maintainers): require a code-owner approval on main (@Seluj78)
- **PR #4974** (2026-10-27): fix(acp): name the missing aoe binary when the runner cannot spawn (@Seluj78)
- **PR #4973** (2026-10-27): fix(web): keep top banners' dismiss "×" and push-health text readable (@Seluj78)

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

## X. session): report Busy consistently across CLI, TUI and HTTP delete paths (#4925)

**RULE**:
When implementing operations in `docs/api.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `886b11b6`: session): report Busy consistently across CLI, TUI and HTTP delete paths (#4925). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/api.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Delete, purge and restore share one Busy contract. Busy means another lifecycle
operation holds the session, nothing changed, and the caller may retry once it
finishes. It is not `KeptRestored` (restored mid-purge), already gone, or a
cleanup failure. Over HTTP it is `409` with the `lifecycle_locked` code header
and `{"error":"lifecycle_busy","operation":"<holder>"}`; a selection that
changed after it was made is `409` with its own `lifecycle_superseded` code
header; it may already be partly processed, so refresh and check before retrying. A batch delete that skips Busy sessions lists them under `busy` and
reports `partial`; when nothing else completed it answers `409 lifecycle_busy`.
`aoe rm --purge` and `aoe session restore` exit non-zero for Busy. `aoe session
empty-trash` purges the rest, lists each skipped session on stderr, then exits
non-zero.

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `886b11b6` are properly handled with clean fallback behavior.
