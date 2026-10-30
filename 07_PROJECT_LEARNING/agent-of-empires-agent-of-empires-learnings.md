> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `996a3a71`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T18:58:27.880Z  
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
> **Harvest Timestamp**: 2026-10-30T18:58:26.358Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3396 stars

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

### Incident Patch 1: `ce52748a` (2026-10-29)
**Commit Message**: fix(session): remove a purged worktree outside the store locks (#4496)

* fix(session): remove a purged worktree outside the store locks

The purge held every profile's save mutex and storage flock for the
whole git worktree remove, so any TUI save (attaching, status changes)
froze until it finished, which takes minutes for a large worktree
under endpoint security. Under the locks the purge now only checks the
worktree is unused and moves it aside to a private path; the removal
runs after the locks are released. A worktree that cannot be moved, or
a multi-repo workspace, is still removed in place.

🤖 Generated with Claude Code

* fix(session): hide a moved-aside worktree from adoption during its purge

Lock the moved-aside checkout with a purge reason that worktree listings
skip, remove it without unlocking, move it back when the removal fails,
and resume an interrupted purge from the original path.

🤖 Generated with Claude Code

* fix(session): keep an adopted or dirtied aside worktree on purge

Judge an aside checkout another session adopted before it was hidden
where it is instead of moving it back, re-check a non-force removal for
changes before the double-force remove, and m

**File**: `docs/guides/worktrees.md` (modified, +2/-0)
```diff
@@ -97,6 +97,8 @@ Without Force, purge preserves a dirty worktree and retains its session for retr
 
 Native daemon clients can abandon a stuck purge using its current reservation generation. Abandon removes the session record and schedules runtime cleanup; it does not cancel a hook or cleanup already underway, and does not start another worktree or branch removal.
 
+**Purging first moves the worktree** to a sibling `.aoe-purge-<session-id>`, marked by an `aoe-purge` file in its git admin directory, which `git worktree list` still shows but aoe hides from sessions, then removes it. A failed removal moves it back. A purge interrupted by a crash is finished on the next purge attempt while its session still exists; otherwise (web deletes remove the session first) `aoe worktree cleanup` lists the `.aoe-purge-<session-id>` checkout as orphaned once no process is still purging it, and can remove it.
+
 **The default branch's checkout is never removed.** A bare-repo layout keeps
 that checkout available to other tooling. AoE refuses to remove it or delete
 its branch, reports the refusal, and deletes the session record instead.
```

**File**: `src/cli/add.rs` (modified, +3/-0)
```diff
@@ -232,6 +232,9 @@ pub async fn run(profile: &str, args: AddArgs) -> Result<()> {
     if !args.scratch && !path.is_dir() {
         bail!("Path is not a directory: {}", path.display());
     }
+    if !args.scratch {
+        crate::session::builder::ensure_not_purging(&path)?;
+    }
 
     if (!args.extra_repos.is_empty() || !args.projects.is_empty())
         && explicit_worktree_branch(&args).is_none()
```

**File**: `src/cli/session.rs` (modified, +4/-0)
```diff
@@ -1034,6 +1034,10 @@ async fn import_sessions(profile: &str, args: ImportArgs) -> Result<()> {
             if already_imported(all_instances, &s.session_id) {
                 continue;
             }
+            if crate::git::GitWorktree::is_within_purging(std::path::Path::new(&s.cwd)) {
+                eprintln!("Skipping {}: its project path is being purged", s.cwd);
+                continue;
+            }
             let inst = build_import_instance(s, structured, &group, session_config);
             ids.push(inst.id.clone());
             all_instances.push(inst.clone());
```

**File**: `src/cli/worktree.rs` (modified, +238/-46)
```diff
@@ -6,7 +6,7 @@ use std::collections::HashSet;
 use std::path::{Path, PathBuf};
 
 use crate::git::{GitWorktree, WorktreeEntry};
-use crate::session::Storage;
+use crate::session::{Instance, Storage};
 
 #[derive(Subcommand)]
 pub enum WorktreeCommands {
@@ -170,45 +170,146 @@ fn partition_orphaned_worktrees(
         })
 }
 
-async fn cleanup_orphaned(profile: &str, force: bool) -> Result<()> {
-    let storage = Storage::open_unwatched(profile)?;
-    let (instances, _groups) = storage.load_with_groups()?;
+/// Where a purge moves `inst`'s worktree. A row whose checkout is there is mid-purge or awaiting
+/// its retry, so neither is orphaned.
+fn purge_aside(inst: &Instance) -> Option<PathBuf> {
+    let path = Path::new(&inst.project_path);
+    path.parent()?
+        .join(format!(".aoe-purge-{}", inst.id))
+        .canonicalize()
+        .ok()
+}
 
-    let mut orphaned_sessions = Vec::new();
-    let mut orphaned_worktrees = Vec::new();
+/// A row is orphaned once its checkout is gone and no lifecycle operation, such as a purge that
+/// may restore it, has it reserved.
+fn is_orphaned_session(inst: &Instance, now: chrono::DateTime<chrono::Utc>) -> bool {
+    if inst.has_fresh_lifecycle_reservation(now) {
+        return false;
+    }
+    if inst.worktree_info.is_some() {
+        !Path::new(&inst.project_path).exists() && purge_aside(inst).is_none()
+    } else if let Some(ws_info) = &inst.workspace_info {
+        !Path::new(&ws_info.workspace_dir).exists()
+    } else {
+        false
+    }
+}
 
-    for inst in &instances {
-        if let Some(_wt_info) = &inst.worktree_info {
-            let worktree_path = PathBuf::from(&inst.project_path);
-            if !worktree_path.exists() {
-                orphaned_sessions.push(inst.clone());
+pub(crate) fn find_orphaned_sessions(instances: &[Instance]) -> Vec<Instance> {
+    let now = chrono::Utc::now();
+    instances
+        .iter()
+        .filter(|inst| is_orphaned_session(inst, now))
+        .cloned()
+        .collect()
+}
+
+/// Removes the listed rows that are still orphaned, judged again under each row's lifecycle lock
+/// and the store lock. Returns how many were removed.
+pub(crate) fn remove_orphaned_sessions(storage: &Storage, orphans: &[Instance]) -> Result<usize> {
+    let mut held = Vec::new();
+    let mut ids = HashSet::new();
+    for orphan in orphans {
+        match storage.try_acquire_instance_lifecycle_lock(&orphan.id)? {
+            Some(lock) => {
+                held.push(lock);
+                ids.insert(orphan.id.clone());
+            }
+            None => eprintln!("✗ Skipped session {}: it is busy", orphan.id),
+        }
+    }
+    let mut removed = 0;
+    storage.update(|instances, _groups| {
+        let now = chrono::Utc::now();
+        let before = instances.len();
+        instances.retain(|inst| !(ids.contains(&inst.id) && is_orphaned_session(inst, now)));
+        removed = before - instances.len();
+        Ok(())
+    })?;
+    Ok(removed)
+}
+
+/// The removable and the protected orphaned worktrees of `git_wt`'s repository.
+pub(crate) fn find_orphaned_worktrees(
+    instances: &[Instance],
+    git_wt: &GitWorktree,
+) -> Result<(Vec<WorktreeEntry>, Vec<WorktreeEntry>)> {
+    let tracked: HashSet<String> = instances
+        .iter()
+        .flat_map(|inst| {
+            let aside = purge_aside(inst).map(|aside| aside.to_string_lossy().into_owned());
+            std::iter::once(inst.project_path.clone()).chain(aside)
+        })
+        .collect();
+    Ok(partition_orphaned_worktrees(
+        git_wt.list_worktrees_with_abandoned_purges()?,
+        &git_wt.repo_path,
+        &tracked,
+        &git_wt.protected_default_branch_names()?,
+    ))
+}
+
+/// The listed worktrees that are abandoned purges, which keep that classification until removal.
+pub(crate) fn purging_paths(orphans: &[WorktreeEntry]) -> HashSet<PathBuf> {
+    orphans
+        .iter()
+        .filter(|wt| GitWorktree::is_purging(&wt.path))
+        .map(|wt| wt.path.clone())
+        .collect()
+}
+
+/// Removes the listed orphaned worktrees and returns how many were removed. An abandoned purge is
+/// removed only while it is still marked and its claim held: recovery may since have kept it for
+/// a session to adopt.
+pub(crate) fn remove_orphaned_worktrees(
+    git_wt: &GitWorktree,
+    orphans: &[WorktreeEntry],
+    purging: &HashSet<PathBuf>,
+) -> usize {
+    let mut removed = 0;
+    for wt in orphans {
+        let _claim = if purging.contains(&wt.path) {
+            let Some(claim) = GitWorktree::claim_abandoned_purge(&wt.path) else {
+                eprintln!(
+                    "✗ Skipped {}: its purge was resumed or kept",
+                    wt.path.display()
+                );
+                continue;
+            };
+            Some(claim)
+        } else if GitWorktree::is_purging(&wt.path) {
+            eprintln!("✗ Skipped {}: its purge is in progress", wt.path.display());
+     
```

**File**: `src/git/mod.rs` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ pub use remote::{
     get_remote_url,
 };
 pub(crate) use worktree::WorktreeCreation;
-pub use worktree::{GitWorktree, WorktreeEntry};
+pub use worktree::{GitWorktree, PurgeClaim, WorktreeEntry};
 
 /// Open the repository at `path` without searching parents, so an unrelated
 /// ancestor repo (e.g. a dotfile-managed home) is never found.
```

**File**: `src/git/worktree/mod.rs` (modified, +127/-0)
```diff
@@ -28,6 +28,17 @@ const MUTATION_OBSERVATION_TIMEOUT: Duration = Duration::from_secs(5);
 /// intentional remove or move.
 const WORKTREE_LOCK_REASON: &str = "aoe-managed worktree (prevents cross-boundary prune)";
 
+/// File in a worktree's admin directory marking a purge in progress. Listings skip a marked
+/// worktree so no session can adopt it; its lock and git's dirty refusal are untouched.
+const PURGE_MARKER: &str = "aoe-purge";
+const PURGE_CLAIM: &str = "aoe-purge.claim";
+
+/// An `flock` on a marked worktree's claim file, held by whoever is finishing its purge. A marked
+/// worktree whose claim is free was abandoned.
+pub struct PurgeClaim {
+    _lock: std::fs::File,
+}
+
 #[derive(Default)]
 pub(crate) struct WorktreeCreation {
     pub branch_created: bool,
@@ -195,6 +206,72 @@ impl GitWorktree {
         .map(drop)
     }
 
+    fn purge_marker(path: &Path) -> Result<PathBuf> {
+        crate::git::cleanup::read_linked_worktree_gitdir(path)
+            .map(|admin| admin.join(PURGE_MARKER))
+            .ok_or_else(|| GitError::WorktreeNotFound(path.to_path_buf()))
+    }
+
+    /// Hide `path` from `list_worktrees` while its purge runs, owned by the returned claim.
+    pub fn mark_purging(path: &Path) -> Result<PurgeClaim> {
+        let claim = Self::claim_purge(path)?;
+        std::fs::write(Self::purge_marker(path)?, "")?;
+        Ok(claim)
+    }
+
+    fn claim_purge(path: &Path) -> Result<PurgeClaim> {
+        use fs2::FileExt;
+        let claim_path = Self::purge_marker(path)?.with_file_name(PURGE_CLAIM);
+        let lock = std::fs::OpenOptions::new()
+            .create(true)
+            .write(true)
+            .truncate(false)
+            .open(claim_path)?;
+        lock.try_lock_exclusive().map_err(|_| {
+            GitError::WorktreeCommandFailed(format!(
+                "{} is being purged by another process",
+                path.display()
+            ))
+        })?;
+        Ok(PurgeClaim { _lock: lock })
+    }
+
+    /// A child forked by a concurrent test can hold a dropped claim's descriptor until it execs.
+    #[cfg(test)]
+    pub(crate) fn await_purge_released(path: &Path) {
+        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
+        while Self::claim_purge(path).is_err() {
+            assert!(
+                std::time::Instant::now() < deadline,
+                "purge claim never released"
+            );
+            std::thread::yield_now();
+        }
+    }
+
+    /// Claims a marked worktree whose purge was abandoned, or `None` if its purge is live or it is
+    /// no longer marked.
+    pub fn claim_abandoned_purge(path: &Path) -> Option<PurgeClaim> {
+        let claim = Self::claim_purge(path).ok()?;
+        Self::is_purging(path).then_some(claim)
+    }
+
+    pub fn unmark_purging(path: &Path) -> Result<()> {
+        match std::fs::remove_file(Self::purge_marker(path)?) {
+            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.into()),
+            _ => Ok(()),
+        }
+    }
+
+    /// Whether `path` is in or under a checkout marked for purging, including through a nested repo.
+    pub(crate) fn is_within_purging(path: &Path) -> bool {
+        path.ancestors().any(Self::is_purging)
+    }
+
+    pub(crate) fn is_purging(path: &Path) -> bool {
+        Self::purge_marker(path).is_ok_and(|marker| marker.exists())
+    }
+
     /// Unlock `path`'s admin entry, best-effort and idempotent. Must precede
     /// `git worktree remove`/`move` (both refuse a locked tree) and any prune
     /// meant to reap the entry. Works from the admin side even when the
@@ -280,6 +357,15 @@ impl GitWorktree {
     }
 
     pub fn list_worktrees(&self) -> Result<Vec<WorktreeEntry>> {
+        self.worktree_entries(false)
+    }
+
+    /// Also lists marked worktrees whose purge was abandoned, for cleanup to finish.
+    pub fn list_worktrees_with_abandoned_purges(&self) -> Result<Vec<WorktreeEntry>> {
+        self.worktree_entries(true)
+    }
+
+    fn worktree_entries(&self, include_abandoned: bool) -> Result<Vec<WorktreeEntry>> {
         let repo = open_repo_at(&self.repo_path)?;
         let mut entries = vec![];
         // Bare repos have no main worktree, only linked ones.
@@ -297,6 +383,9 @@ impl GitWorktree {
             let Ok(path) = wt.path().canonicalize() else {
                 continue;
             };
+            if Self::is_purging(&path) && !(include_abandoned && Self::claim_purge(&path).is_ok()) {
+                continue;
+            }
             entries.push(WorktreeEntry {
                 branch: Self::get_current_branch(&path).ok(),
                 path,
@@ -679,6 +768,44 @@ mod tests {
         assert!(wt_path.join(".git").is_file());
     }
 
+    #[test]
+    fn only_cleanup_lists_an_abandoned_purge() {
+        let (dir, _repo) = init_repo();
+        let git_wt = GitWorktree::new(dir.path().to_path_buf()).unwrap();
+        let parent = TempDir::
```

**File**: `src/git/worktree/relocate.rs` (modified, +1/-1)
```diff
@@ -390,7 +390,7 @@ impl GitWorktree {
 
     /// `git worktree repair`, which fixes both the checkout's `.git` pointer and
     /// the admin `gitdir` file, even when a relative pointer broke in the move.
-    fn repair_worktree(&self, path: &Path) -> Result<()> {
+    pub(crate) fn repair_worktree(&self, path: &Path) -> Result<()> {
         run_bounded(
             &self.repo_path,
             ["worktree", "repair", path_str(path)?],
```

**File**: `src/session/builder.rs` (modified, +9/-0)
```diff
@@ -651,6 +651,14 @@ pub fn build_instance(
         })
 }
 
+/// A checkout marked for purging is about to be removed, so no new session may take it.
+pub(crate) fn ensure_not_purging(path: &std::path::Path) -> Result<()> {
+    if crate::git::GitWorktree::is_within_purging(path) {
+        bail!("Project path is being purged: {}", path.display());
+    }
+    Ok(())
+}
+
 pub(crate) fn plan_instance(
     params: InstanceParams,
     existing_titles: &[&str],
@@ -904,6 +912,7 @@ pub(crate) fn plan_instance(
         if !final_path_buf.is_dir() {
             bail!("Project path is not a directory: {}", final_path);
         }
+        ensure_not_purging(&final_path_buf)?;
     }
 
     let mut instance = Instance::new(&final_title, &final_path);
```

---

### Incident Patch 2: `ef58696d` (2026-10-30)
**Commit Message**: fix(session): refuse unattested managed resumes (#4942)

* fix(session): refuse unattested managed resumes

Refuse resolver-error fallbacks before retiring a managed pane. Preserve failed conversation identities until an explicit retry or fresh intent, without blocking native user commands or non-agent handoffs.

Refs #4941

* fix(session): preserve resume preflight invariants

Keep the durable CAS baseline while refreshing captured identity. Validate Prime fork sources read-only before teardown, leaving copy and rebinding in launch preparation. Honor deliberate fresh intent for opaque wrappers without consuming their prior conversation.

Refs #4941

* fix(session): surface managed resume recovery

Keep refusal guidance visible across daemon and TUI boundaries.
Preserve mutation receipts without exposing internal diagnostics.

* test(session): distinguish managed refusal paths

* fix(session): classify managed Prime refusals

Apply shared refusal handling before the Prime-specific launch guard.
Keep fresh launch and explicit pin/fork errors unchanged.

* fix(session): make managed resume recovery actionable

Surface finite causes and explicit retry or fresh instructions without
ref

**File**: `docs/api.md` (modified, +12/-3)
```diff
@@ -558,11 +558,13 @@ Before delivery, the HTTP endpoint removes bracketed-paste delimiters and remain
 | `403` | `{"error": "read_only"}` | Server is in read-only mode |
 | `404` | `{"error": "not_found"}` | No session with that id |
 | `409` | `{"error": "session_not_running"}` | Session exists but the tmux pane is gone |
-| `409` | `{"error": "resume_failed", "message": "...", "resume_session_id": "..."}` | Auto-revive tried to resume a stored conversation, but the pane exited before AoE could prove the ID invalid. The ID is preserved for explicit retry or replacement. |
+| `409` | `{"error": "resume_failed", "message": "...", "resume_session_id": "..."}` | Auto-revive tried to resume a stored conversation, but the pane exited during the probe. The ID and failure marker are preserved in this call; the next default revival can start fresh. |
 | `409` | `{"error": "session_transient", "status": "..."}` | Session is mid-lifecycle and cannot accept input yet |
 | `409` | `{"error": "session_archived" \| "session_trashed", "message": "..."}` | Session is archived or trashed, even with a live pane or `revive: false`; unarchive or restore it first. `/start`, `/ensure`, `/container-terminal` and structured-view prompts refuse the same way. |
 | `500` | `{"error": "tmux_error"}` or `{"error": "internal"}` | Unexpected failure (logged server-side) |
 
+After a prior failed resume probe, a default restart or send-driven revival can start a new conversation and deliver input there. The old native transcript is not deleted, but its AoE association is abandoned. `/ensure` reports this as `resume_outcome: "fresh_after_failed_resume"` with `prior_session_id` and a message, rather than claiming a successful resume. See [session recovery policy](guides/session-resume.md#pinning-or-resetting-a-conversation) for explicit retry and direct CLI start behavior.
+
 Concurrent POSTs to the same `id` are serialized server-side, so two
 orchestrators racing on the same session won't interleave keystrokes
 inside the pane. Concurrent POSTs to *different* ids run in parallel.
@@ -650,13 +652,20 @@ attachment is delivered. Genuine authority loss or an unknown outcome remains
 blocked until reconciled.
 
 A failed launch can still commit a lifecycle generation. The finite
-`aoe-error-code` values `start_failed` and `resume_failed`, with valid same-epoch
-runtime receipt headers, acknowledge that preparation commit, not a successful
+`aoe-error-code` values `start_failed`, `resume_failed`, and
+`managed_resume_refused`, with valid same-epoch runtime receipt headers,
+acknowledge that preparation commit, not a successful
 launch. Clients must apply its snapshot before retrying. A later send or target
 probe failure can likewise retain a preparation cursor; it does not acknowledge
 message delivery. Transport loss or malformed mutation receipts remain unknown;
 effect-free daemon refusals do not acknowledge a commit.
 
+`409 managed_resume_refused` preserves the managed conversation. Its finite
+`aoe-managed-resume-cause` header supplies an application-owned recovery reason.
+Missing, unknown, or ambiguous cause metadata keeps the refusal generic; native
+clients do not read response bodies to derive that reason. See
+[managed resume recovery](guides/session-resume.md#common-managed-resume-and-fork-refusals).
+
 A failed purge can commit a retained-row failure marker. `409 purge_failed`
 includes the finite code header and its canonical receipt; clients wait for that
 snapshot before retrying or escalating. Unlike an unknown outcome, this committed
```

**File**: `docs/guides/configuration.md` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ agent_detect_as = { "lenovo-claude" = "claude" }
 - **`agent_detect_as`** reuses built-in status detection and ACP adapter inheritance. It never proves which native CLI owns a terminal conversation. Use [status rules](#status-rules-for-custom-agents) when output differs from the built-in.
 - **`agent_acp_cmd`** (optional): ACP launch command that lets the agent run in the structured view (see below).
 - **`agent_execution_as`** declares the native agent actually invoked by an opaque wrapper, together with its `agent_config_dir` store contract. This is required for managed resume and fork through such a wrapper.
-  Bare, non-path wrappers can receive Default automatic resume flags and pane-scoped capture without this contract. Cleared launches selected by a failed-resume marker or disabled `auto_resume_on_restart` start fresh, mint and pass fresh-session flags where supported, and capture the new pane-scoped ID; explicit resume and fork remain unavailable. See [Execution identity and wrappers](session-resume.md#execution-identity-and-wrappers).
+  Bare, non-path wrappers can start fresh and capture their pane-scoped published ID without this contract. Resuming the recorded conversation requires the contract. See [Execution identity and wrappers](session-resume.md#execution-identity-and-wrappers) for wrapper contracts and [Pinning or resetting a conversation](session-resume.md#pinning-or-resetting-a-conversation) for failed-resume recovery.
 - **`agent_config_dir`** (optional): The config directory the wrapper points its CLI at, when that is not the built-in default (see below).
 - **`default_tool`** can select a custom-agent name for new sessions.
 
```

**File**: `docs/guides/session-resume.md` (modified, +26/-10)
```diff
@@ -1,6 +1,6 @@
 # Native Session Resume
 
-Explicit resume and fork against a qualified conversation require the native agent, physical store, working directory, and filesystem to agree with the prepared launch. Automatic start and restart also try a stored native ID when its binding cannot be attested, using the agent's normal resume selector and failed-resume probe. A pin or fork that migration left unqualified resumes against configuration-derived context instead of a recorded one, subject to the per-agent limits in [Supported managed contexts](#supported-managed-contexts). A status label or raw session ID does not qualify that ID for explicit use. Existing transcripts are never deleted to repair a mismatch.
+Managed resume requires a resolved native execution context, including automatic start and restart with a recorded conversation ID. If that context cannot be attested, AoE refuses the launch with recovery guidance instead of delegating the ID to unconstrained native lookup. Ordinary pane replacement checks this before retiring the outgoing pane, preserving its recorded identity and transcripts on refusal. This protection does not roll back an earlier explicitly requested container discard or container reconstruction for a tool change. Qualified conversations also validate their agent, store, working directory, and filesystem. A pin or fork that migration left unqualified uses configuration-derived context, subject to [Supported managed contexts](#supported-managed-contexts); a status label or raw ID does not qualify it.
 
 Runtime conversation changes such as `/clear`, `/new`, fork, continue, or a fresh pane generation rotate the recorded identity when the native agent publishes the change. The old identity and any artifact predating the launch boundary cannot be recaptured after an AoE process restart.
 
@@ -28,19 +28,19 @@ Hermes host identity hooks validate the complete JSON payload while retaining on
 
 Sandbox config and conversation stores are staged per AoE instance, including custom `agent_config_dir` roots, and a cross-process lease guards each managed store, so two sessions in the same directory cannot claim each other's conversation.
 
-`agent_detect_as` controls status detection and ACP adapter inheritance, not terminal execution identity. Direct built-in commands identify their native agent independently. Opaque wrappers need the explicit contract described below for explicit resume or fork and capture from shared stores.
+`agent_detect_as` controls status detection and ACP adapter inheritance, not terminal execution identity. Direct built-in commands identify their native agent independently. Opaque wrappers need the explicit contract below for managed resume, fork, and capture from shared stores.
 
 ## Execution identity and wrappers
 
 A conflicting built-in tool and command, such as tool `claude` with command `codex`, is rejected for managed resume and fork. An opaque wrapper requires both `session.agent_execution_as` and `session.agent_config_dir` in trusted global or profile configuration. This asserts that the wrapper invokes that native agent, forwards native arguments unchanged, and uses only the declared store and working-directory/filesystem context. Repository overrides are refused because a repository must not grant itself access to another native conversation store.
 
-A Default start or restart can pass native resume flags to a bare, non-path wrapper mapped by `agent_detect_as` and capture its pane-scoped published ID (for example Claude, Codex, Cursor, or Pi), even without the execution contract. If a failed-resume marker or disabled `auto_resume_on_restart` selects a fresh launch, Cleared intent starts fresh through the same wrapper, minting an ID and passing fresh-session flags where supported, then capturing its pane-scoped publication. The failed-resume marker applies to the next automatic attempt for that ID; a subsequent restart follows the resulting durable conversation state. Neither path proves the wrapper's execution identity or store. Shared-store capture, explicit resume, and fork still require the contract; shell-active commands, remote launchers, paths, and different built-in commands do not gain the exception. A known conversation can also be tried after an external working-directory or store move on Default; its old binding stays authoritative until a qualified observation updates it.
+A bare, non-path wrapper mapped by `agent_detect_as` can still start fresh and capture its pane-scoped published ID without the execution contract. AoE does not preassign a native ID from a status alias alone, including after an explicit fresh choice or disabled `auto_resume_on_restart`. Resuming a published ID still requires the contract. A native selector supplied by the user remains user-owned only when the row has no AoE-managed conversation state; AoE does not inject another selector. A known conversation can still be tried after an external working-directory or store
```

**File**: `src/cli/session.rs` (modified, +5/-8)
```diff
@@ -1241,14 +1241,11 @@ async fn restart_all_sessions(profile: &str, parallel: usize) -> Result<()> {
     for (_id, title) in &succeeded {
         println!("  · {}", title);
     }
-    if !fresh_after_failed_resume.is_empty() {
+    for (title, sid) in &fresh_after_failed_resume {
         println!(
-            "ℹ {} started fresh (a prior resume attempt failed for the stored sid; the old conversation is still reachable via the agent's own resume/history picker):",
-            fresh_after_failed_resume.len()
+            "  · {}: started fresh after a prior resume failed for sid {}; the old conversation remains in the agent's history",
+            title, sid
         );
-        for (title, sid) in &fresh_after_failed_resume {
-            println!("  · {}: sid {}", title, sid);
-        }
     }
     if !orphaned.is_empty() {
         println!(
@@ -1403,8 +1400,8 @@ async fn restart_session(profile: &str, args: SessionIdArgs) -> Result<()> {
         }
         StartOutcome::FreshAfterFailedResume { sid } => {
             println!(
-                "✓ Restarted session: {} (started fresh; a prior resume attempt failed for sid {sid}, the old conversation is still reachable via the agent's own resume/history picker)",
-                title
+                "Restarted session: {} (started fresh after a prior resume failed for sid {}; the old conversation remains in the agent's history)",
+                title, sid
             );
         }
         StartOutcome::Resumed | StartOutcome::Fresh => {
```

**File**: `src/daemon/error.rs` (modified, +91/-0)
```diff
@@ -1,8 +1,10 @@
 //! Fixed error discriminators shared by native clients and daemon handlers.
 
+use crate::session::ManagedResumeCause;
 use reqwest::{header::HeaderMap, StatusCode};
 
 pub const ERROR_CODE_HEADER: &str = "aoe-error-code";
+pub const MANAGED_RESUME_CAUSE_HEADER: &str = "aoe-managed-resume-cause";
 
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
 pub enum ApiErrorCode {
@@ -16,6 +18,7 @@ pub enum ApiErrorCode {
     TlsRequired,
     RuntimeEpochMismatch,
     ResumeFailed,
+    ManagedResumeRefused(ManagedResumeCause),
     StartFailed,
     PurgeFailed,
     NoRevive,
@@ -47,6 +50,7 @@ impl ApiErrorCode {
             Self::TlsRequired => "tls_required",
             Self::RuntimeEpochMismatch => "runtime_epoch_mismatch",
             Self::ResumeFailed => "resume_failed",
+            Self::ManagedResumeRefused(_) => "managed_resume_refused",
             Self::NoRevive => "no_revive",
             Self::CreationTrustChanged => "creation_trust_changed",
             Self::CreationCancelled => "creation_cancelled",
@@ -72,6 +76,7 @@ impl ApiErrorCode {
             | Self::LifecycleSuperseded
             | Self::RuntimeEpochMismatch
             | Self::ResumeFailed
+            | Self::ManagedResumeRefused(_)
             | Self::PurgeFailed
             | Self::NoRevive
             | Self::CreationTrustChanged
@@ -117,6 +122,7 @@ impl ApiErrorCode {
             b"tls_required" => Self::TlsRequired,
             b"runtime_epoch_mismatch" => Self::RuntimeEpochMismatch,
             b"resume_failed" => Self::ResumeFailed,
+            b"managed_resume_refused" => Self::ManagedResumeRefused(managed_resume_cause(headers)),
             b"no_revive" => Self::NoRevive,
             b"creation_trust_changed" => Self::CreationTrustChanged,
             b"creation_cancelled" => Self::CreationCancelled,
@@ -137,6 +143,19 @@ impl ApiErrorCode {
     }
 }
 
+fn managed_resume_cause(headers: &HeaderMap) -> ManagedResumeCause {
+    let mut values = headers.get_all(MANAGED_RESUME_CAUSE_HEADER).iter();
+    match (values.next(), values.next()) {
+        (Some(value), None) => match value.as_bytes() {
+            b"wrapper_contract_required" => ManagedResumeCause::WrapperContractRequired,
+            b"unsupported_managed_arguments" => ManagedResumeCause::UnsupportedManagedArguments,
+            b"opencode_schema_unattested" => ManagedResumeCause::OpenCodeSchemaUnattested,
+            _ => ManagedResumeCause::ExecutionContextUnattested,
+        },
+        _ => ManagedResumeCause::ExecutionContextUnattested,
+    }
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -217,6 +236,20 @@ mod tests {
                 Some(ApiErrorCode::SessionTrashed),
             ),
             (StatusCode::FORBIDDEN, "session_archived", false, None),
+            (
+                StatusCode::CONFLICT,
+                "managed_resume_refused",
+                false,
+                Some(ApiErrorCode::ManagedResumeRefused(
+                    ManagedResumeCause::ExecutionContextUnattested,
+                )),
+            ),
+            (
+                StatusCode::INTERNAL_SERVER_ERROR,
+                "managed_resume_refused",
+                false,
+                None,
+            ),
             (
                 StatusCode::BAD_REQUEST,
                 "create_hook_failed",
@@ -244,4 +277,62 @@ mod tests {
             );
         }
     }
+
+    #[test]
+    fn managed_resume_cause_headers_cannot_expand_or_erase_a_refusal() {
+        use ManagedResumeCause::*;
+        for (value, expected) in [
+            ("wrapper_contract_required", WrapperContractRequired),
+            ("unsupported_managed_arguments", UnsupportedManagedArguments),
+            ("opencode_schema_unattested", OpenCodeSchemaUnattested),
+            ("execution_context_unattested", ExecutionContextUnattested),
+            ("secret-token", ExecutionContextUnattested),
+            (
+                "wrapper_contract_required, secret-token",
+                ExecutionContextUnattested,
+            ),
+            ("", ExecutionContextUnattested),
+        ] {
+            let mut headers = HeaderMap::new();
+            headers.insert(MANAGED_RESUME_CAUSE_HEADER, HeaderValue::from_static(value));
+            assert_eq!(
+                ApiErrorCode::from_headers(StatusCode::CONFLICT, &headers, false),
+                None
+            );
+            headers.insert(
+                ERROR_CODE_HEADER,
+                HeaderValue::from_static("managed_resume_refused"),
+            );
+            assert_eq!(
+                ApiErrorCode::from_headers(StatusCode::CONFLICT, &headers, false),
+                Some(ApiErrorCode::ManagedResumeRefused(expected)),
+            );
+            assert_eq!(
+                ApiErrorCode::from_headers(StatusCode::BAD_REQUEST, &headers, false),
+                None
+            );
+            headers.append(MANAGED_RESUME_CAUSE_HEADER, HeaderValue::from_static(value));
+
```

**File**: `src/daemon/mod.rs` (modified, +143/-5)
```diff
@@ -1,7 +1,7 @@
 //! Reusable client and shared wire contract for the daemon REST API.
 
 mod error;
-pub use error::{ApiErrorCode, ERROR_CODE_HEADER};
+pub use error::{ApiErrorCode, ERROR_CODE_HEADER, MANAGED_RESUME_CAUSE_HEADER};
 
 pub(crate) mod lifecycle;
 mod runtime;
@@ -143,6 +143,7 @@ pub(crate) enum LocalRuntimeError {
 
 fn committed_failure_message(code: ApiErrorCode) -> &'static str {
     match code {
+        ApiErrorCode::ManagedResumeRefused(cause) => cause.message(),
         ApiErrorCode::PurgeFailed => "Purge failed; apply its committed state before retrying",
         ApiErrorCode::ResumeFailed => {
             "Resume failed after start committed; the conversation is preserved for explicit retry"
@@ -153,6 +154,7 @@ fn committed_failure_message(code: ApiErrorCode) -> &'static str {
 
 fn daemon_status_message(status: StatusCode, code: Option<ApiErrorCode>, body: &str) -> String {
     match code {
+        Some(ApiErrorCode::ManagedResumeRefused(cause)) => cause.message().into(),
         Some(ApiErrorCode::SmartRenameSkipped) => {
             "Auto-name is unavailable for this session; check its repository and tool configuration"
                 .into()
@@ -890,6 +892,7 @@ impl DaemonClient {
                 Some(
                     ApiErrorCode::StartFailed
                         | ApiErrorCode::ResumeFailed
+                        | ApiErrorCode::ManagedResumeRefused(_)
                         | ApiErrorCode::PurgeFailed
                 )
             ) {
@@ -911,12 +914,14 @@ impl DaemonClient {
                     return Err(DaemonClientError::InvalidMutationReceipt);
                 }
             }
-            // D1: 409 lifecycle_locked maps from status plus the single finite
-            // server-owned header without reading the body. 401 maps from status
-            // alone; neither retains a body or token in the error.
+            // Finite rejections and 401 never retain a response body.
             if matches!(
                 code,
-                Some(ApiErrorCode::LifecycleLocked | ApiErrorCode::LifecycleSuperseded)
+                Some(
+                    ApiErrorCode::LifecycleLocked
+                        | ApiErrorCode::LifecycleSuperseded
+                        | ApiErrorCode::ManagedResumeRefused(_)
+                )
             ) || status == StatusCode::UNAUTHORIZED
             {
                 return Err(DaemonClientError::Status {
@@ -1782,6 +1787,43 @@ mod tests {
             (500, "start_failed", "epoch-1", "3", true, false),
             (409, "resume_failed", "epoch-1", "3", true, false),
             (409, "purge_failed", "epoch-1", "3", true, false),
+            (409, "managed_resume_refused", "epoch-1", "3", true, false),
+            (409, "managed_resume_refused", "foreign", "3", false, true),
+            (409, "managed_resume_refused", "epoch-1", "0", false, true),
+            (
+                409,
+                "managed_resume_refused",
+                "absent",
+                "absent",
+                false,
+                false,
+            ),
+            (
+                409,
+                "managed_resume_refused",
+                "epoch-1",
+                "absent",
+                false,
+                true,
+            ),
+            (
+                409,
+                "managed_resume_refused",
+                "epoch-1",
+                "3, 4",
+                false,
+                true,
+            ),
+            (500, "managed_resume_refused", "epoch-1", "3", false, false),
+            (
+                409,
+                "managed_resume_refused, resume_failed",
+                "epoch-1",
+                "3",
+                false,
+                false,
+            ),
+            (409, "MANAGED_RESUME_REFUSED", "epoch-1", "3", false, false),
             (409, "purge_failed", "foreign", "3", false, true),
             (409, "purge_failed", "epoch-1", "0", false, true),
             (409, "purge_failed", "absent", "absent", false, true),
@@ -1870,6 +1912,102 @@ mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn managed_resume_refusal_recovers_without_reflecting_private_bodies() {
+        use axum::response::IntoResponse;
+        for (unix, authenticated, cause) in [
+            (false, false, "wrapper_contract_required"),
+            (false, true, "wrapper_contract_required"),
+            (true, false, "wrapper_contract_required"),
+            (false, false, "secret-token"),
+        ] {
+            let expected = if cause == "wrapper_contract_required" {
+                crate::session::ManagedResumeCause::WrapperContractRequired
+            } else {
+                crate::session::ManagedResumeCause::ExecutionContextUnattested
+            };
+            let root = tempfile::tempdir().unwrap();
+            let socket = root.path().join("api.sock");
+            let app = axum::Router::new().route(
+                "/api/sessions/
```

**File**: `src/server/api/sessions/ensure.rs` (modified, +2/-1)
```diff
@@ -352,7 +352,8 @@ pub(super) async fn agent_target_response(
                 body["prior_session_id"] = sid.into();
                 "fresh_after_failed_resume"
             }
-        }.into();
+        }
+        .into();
     }
     crate::server::runtime::mutation_response(&snapshot.value.cursor, Json(body))
 }
```

**File**: `src/server/api/sessions/lifecycle.rs` (modified, +207/-0)
```diff
@@ -2908,6 +2908,18 @@ async fn prepare_agent_session_inner(
                 response
             } else if error.is::<crate::session::NativeStoreUnavailable>() {
                 StatusCode::SERVICE_UNAVAILABLE.into_response()
+            } else if let Some(refusal) =
+                error.downcast_ref::<crate::session::ManagedResumeRefused>()
+            {
+                let mut response = crate::server::api::api_error_with_code_header(
+                    crate::daemon::ApiErrorCode::ManagedResumeRefused(refusal.0),
+                    refusal.0.message(),
+                );
+                response.headers_mut().insert(
+                    crate::daemon::MANAGED_RESUME_CAUSE_HEADER,
+                    axum::http::HeaderValue::from_static(refusal.0.as_str()),
+                );
+                response
             } else {
                 tracing::warn!(target: "http.api.sessions", session = %id, %error, "session start failed");
                 api_error(
@@ -3030,6 +3042,201 @@ mod durable_stop_tests {
     use super::*;
     use crate::process::worker_registry::{self, WorkerRecord};
 
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn managed_resume_refusal_publishes_safe_recovery_without_replacing_the_pane() {
+        use crate::tmux::test_helpers::{
+            only_pane_id, pane_field, tmux_available, wait_for_pane_command, TmuxTestSession,
+        };
+        if !tmux_available() {
+            return;
+        }
+        let root = tempfile::tempdir_in("/tmp").unwrap();
+        let _home = crate::session::test_support::isolate_app_dir_at(root.path());
+        let _env = crate::session::test_support::EnvGuard::unset(&[
+            "TMUX",
+            "TMUX_PANE",
+            "OMP_SESSION_ID",
+            "PI_SESSION_ID",
+            "AOE_SESSION_ID",
+            "AOE_PROFILE",
+            "AOE_DAEMON_URL",
+            "AOE_DAEMON_TOKEN",
+            "PRIME_AGENT_SESSION_DIR",
+            "PRIME_AGENT_CODING_AGENT_SESSION_DIR",
+            "PRIME_AGENT_CODING_AGENT_DIR",
+        ])
+        .and_set("AOE_TMUX_SOCKET", root.path().join("tmux.sock"));
+        let _omp = crate::session::test_support::install_login_shell_path_command(
+            root.path(),
+            "omp",
+            "#!/bin/sh\nexit 97\n",
+        );
+        let _prime = crate::session::test_support::install_login_shell_path_command(
+            root.path(),
+            "prime-agent",
+            "#!/bin/sh\nexit 97\n",
+        );
+        crate::session::config::update_app_state(|state| {
+            state.has_acknowledged_agent_hooks = true;
+        })
+        .unwrap();
+        crate::session::config::update_config(|config| {
+            config.systemd.enabled = false;
+            config.session.smart_rename = false;
+            config.session.auto_resume_on_restart = true;
+        })
+        .unwrap();
+        let project = root.path().join("private-project");
+        std::fs::create_dir(&project).unwrap();
+        std::fs::create_dir_all(project.join(".prime/agent")).unwrap();
+        std::fs::write(
+            project.join(".prime/agent/settings.json"),
+            r#"{"sessionDir":7}"#,
+        )
+        .unwrap();
+        let transcript = root.path().join("private-transcript.jsonl");
+        std::fs::write(&transcript, "private-conversation-body\n").unwrap();
+        let sid = "11111111-2222-4333-8444-555555555555";
+        for tool in ["omp", "prime-agent"] {
+            let mut row = Instance::new("managed refusal", project.to_str().unwrap());
+            row.tool = tool.into();
+            row.command = tool.into();
+            row.source_profile = "default".into();
+            row.status = Status::Stopped;
+            row.agent_session_id = Some(sid.into());
+            let mut binding = crate::session::ConversationBinding::unknown(sid);
+            binding.transcript_path = Some(transcript.clone());
+            row.agent_session_binding = Some(binding);
+            row.omp_capture_generation = Some("original-generation".into());
+            if tool == "omp" {
+                assert!(row.supports_native_resume());
+            } else {
+                let agent = crate::agents::get_agent("prime-agent").unwrap();
+                assert!(row.launch_invokes_resolved_agent_directly(agent));
+                assert_eq!(row.command, "prime-agent");
+                assert_eq!(row.agent_session_id.as_deref(), Some(sid));
+                assert_eq!(
+                    std::fs::read_to_string(project.join(".prime/agent/settings.json")).unwrap(),
+                    r#"{"sessionDir":7}"#
+                );
+            }
+            assert_eq!(row.resume_intent, crate::session::ResumeIntent::Default);
+            let conversation = row.conversation_state();
+            let name = crate::tmux::Session::generate_name(&row.id, &row.title);
+            let _pane = TmuxTestSession::from_name(&name);
+            assert!(crate::tmux:
```

---

### Incident Patch 3: `7b7710d2` (2026-10-30)
**Commit Message**: fix(sandbox): harden the sandbox image registry check (#5073)

* fix(sandbox): harden the sandbox image registry check

The dashboard can now trigger the registry check on demand, so a
registry's responses are untrusted input.

- Disable redirects and treat any non-2xx as a failure.
- Refuse a bearer realm that is not https or names a loopback,
  unspecified or link-local host.
- Classify failures as registry_unreachable, registry_auth or
  registry_bad_response. The API returns only the code; the full chain
  is logged on the daemon.
- Return no digest when no RepoDigest names the image's repository,
  instead of the first entry.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(sandbox): treat a rooted localhost realm as local

Addresses review comment from @coderabbitai on #5073.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(sandbox): match official Docker Hub images by their short name

Addresses review comment from @coderabbitai on #5073.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* test(sandbox): isolate registry client tests from proxies and port reuse

Addresses review comment from @jerome-benoit on #5073.

Co-Authored-By: Claude Sonnet

**File**: `src/containers/image_update.rs` (modified, +306/-51)
```diff
@@ -1,5 +1,7 @@
 //! Detects a newer registry digest for the configured sandbox image; never pulls.
 
+use std::net::IpAddr;
+
 use anyhow::{anyhow, Result};
 
 /// The digest doubles as the snooze key, so a dismissal sticks until the registry moves.
@@ -54,6 +56,49 @@ pub enum ImageCheck {
     Unknown(UnknownReason),
 }
 
+/// Why the registry couldn't be asked. The code is what an API client sees; the chain stays
+/// in the logs.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum RegistryErrorKind {
+    Unreachable,
+    Auth,
+    BadResponse,
+}
+
+impl RegistryErrorKind {
+    fn code(self) -> &'static str {
+        match self {
+            RegistryErrorKind::Unreachable => "registry_unreachable",
+            RegistryErrorKind::Auth => "registry_auth",
+            RegistryErrorKind::BadResponse => "registry_bad_response",
+        }
+    }
+}
+
+#[derive(Debug, thiserror::Error)]
+#[error("{}", .kind.code())]
+struct RegistryError {
+    kind: RegistryErrorKind,
+    #[source]
+    source: anyhow::Error,
+}
+
+fn fail(kind: RegistryErrorKind, source: impl Into<anyhow::Error>) -> anyhow::Error {
+    RegistryError {
+        kind,
+        source: source.into(),
+    }
+    .into()
+}
+
+/// The short code for an error from [`check_image`]; anything unclassified is a bad response.
+pub fn error_code(error: &anyhow::Error) -> &'static str {
+    error
+        .downcast_ref::<RegistryError>()
+        .map_or(RegistryErrorKind::BadResponse, |e| e.kind)
+        .code()
+}
+
 const MANIFEST_ACCEPT: &str = "application/vnd.oci.image.index.v1+json, \
      application/vnd.docker.distribution.manifest.list.v2+json, \
      application/vnd.docker.distribution.manifest.v2+json, \
@@ -125,48 +170,50 @@ impl RegistryRef {
 
     async fn fetch_remote_digest(&self, client: &reqwest::Client) -> Result<String> {
         let url = self.manifest_url();
-        let resp = client
-            .get(&url)
-            .header(reqwest::header::ACCEPT, MANIFEST_ACCEPT)
-            .send()
-            .await?;
-
-        let resp = if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
-            let token = self.obtain_token(client, &resp).await?;
+        let request = || {
             client
                 .get(&url)
                 .header(reqwest::header::ACCEPT, MANIFEST_ACCEPT)
-                .bearer_auth(token)
-                .send()
-                .await?
+        };
+        let resp = send(request()).await?;
+
+        let resp = if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
+            let token = self.obtain_token(client, &resp).await?;
+            send(request().bearer_auth(token)).await?
         } else {
             resp
         };
 
-        let resp = resp.error_for_status()?;
+        let resp = ensure_success(resp)?;
         resp.headers()
             .get("docker-content-digest")
             .and_then(|v| v.to_str().ok())
             .map(|s| s.trim().to_string())
             .filter(|s| !s.is_empty())
-            .ok_or_else(|| anyhow!("registry response missing Docker-Content-Digest header"))
+            .ok_or_else(|| {
+                fail(
+                    RegistryErrorKind::BadResponse,
+                    anyhow!("registry response missing Docker-Content-Digest header"),
+                )
+            })
     }
 
     async fn obtain_token(
         &self,
         client: &reqwest::Client,
         challenge: &reqwest::Response,
     ) -> Result<String> {
+        let bad = |e: anyhow::Error| fail(RegistryErrorKind::BadResponse, e);
         let header = challenge
             .headers()
             .get(reqwest::header::WWW_AUTHENTICATE)
             .and_then(|v| v.to_str().ok())
-            .ok_or_else(|| anyhow!("registry 401 without WWW-Authenticate header"))?;
+            .ok_or_else(|| bad(anyhow!("registry 401 without WWW-Authenticate header")))?;
 
         let params = parse_bearer_challenge(header)
-            .ok_or_else(|| anyhow!("unsupported WWW-Authenticate challenge: {header}"))?;
+            .ok_or_else(|| bad(anyhow!("unsupported WWW-Authenticate challenge: {header}")))?;
 
-        let mut url = reqwest::Url::parse(&params.realm)?;
+        let mut url = validate_bearer_realm(&params.realm)?;
         {
             let mut qp = url.query_pairs_mut();
             if let Some(service) = &params.service {
@@ -177,21 +224,71 @@ impl RegistryRef {
             }
         }
 
-        let token: TokenResponse = client
-            .get(url)
-            .send()
-            .await?
-            .error_for_status()?
+        let token: TokenResponse = ensure_success(send(client.get(url)).await?)?
             .json()
-            .await?;
+            .await
+            .map_err(|e| bad(e.into()))?;
 
         token
             .token
             .or(token.access_token)
-            .ok_or_else(|| anyhow!("registry token endpoint returned no token"))
+            .ok_or_else(|| bad(anyhow!("registry token endpoint return
```

**File**: `src/server/api/sandbox_image.rs` (modified, +14/-8)
```diff
@@ -44,9 +44,12 @@ impl ImageState {
             Ok(ImageCheck::Unknown(reason)) => ImageState::Unknown {
                 reason: reason.code(),
             },
-            Err(error) => ImageState::CheckFailed {
-                error: format!("{error:#}"),
-            },
+            Err(error) => {
+                tracing::warn!(target: "http.api.sandbox_image", "image check failed: {error:#}");
+                ImageState::CheckFailed {
+                    error: image_update::error_code(&error).to_string(),
+                }
+            }
         }
     }
 }
@@ -148,8 +151,11 @@ where
         state
     })
     .await
-    .unwrap_or_else(|e| ImageState::CheckFailed {
-        error: format!("image check task failed: {e}"),
+    .unwrap_or_else(|e| {
+        tracing::error!(target: "http.api.sandbox_image", "image check task failed: {e}");
+        ImageState::CheckFailed {
+            error: "registry_bad_response".into(),
+        }
     })
 }
 
@@ -539,10 +545,10 @@ mod tests {
                 Ok(ImageCheck::Unknown(UnknownReason::RuntimeUnavailable)),
                 serde_json::json!({"state": "unknown", "reason": "runtime_unavailable"}),
             ),
-            // A registry or network error is never reported as current.
+            // A registry or network error is never reported as current, and the chain stays out.
             (
-                Err(anyhow::anyhow!("registry timed out")),
-                serde_json::json!({"state": "check_failed", "error": "registry timed out"}),
+                Err(anyhow::anyhow!("registry timed out at 10.0.0.5")),
+                serde_json::json!({"state": "check_failed", "error": "registry_bad_response"}),
             ),
         ];
         for (result, expected) in cases {
```

#### Recent Merged Pull Requests:
- **PR #5133** (2026-10-30): feat(tui): suggestions view with Start via the prefilled new-session dialog (@Seluj78)
- **PR #5132** (2026-10-30): feat(suggestions): core mapping from provider source keys to projects (@Seluj78)
- **PR #5131** (2026-10-30): feat(web): suggested sessions view with Start into the prefilled wizard (@Seluj78)
- **PR #5130** (2026-10-30): feat(plugin-api): setup checks reported by suggestion providers (@Seluj78)
- **PR #5129** (2026-10-30): feat(suggestions): per-criterion prompt templates applied at prepare (@Seluj78)
- **PR #5121** (2026-10-30): feat(suggestions): core store, snapshot and HTTP API (no automation) (@Seluj78)

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

## X. session): remove a purged worktree outside the store locks (#4496)

**RULE**:
When implementing operations in `docs/guides/worktrees.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ce52748a`: session): remove a purged worktree outside the store locks (#4496). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/guides/worktrees.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
**Purging first moves the worktree** to a sibling `.aoe-purge-<session-id>`, marked by an `aoe-purge` file in its git admin directory, which `git worktree list` still shows but aoe hides from sessions, then removes it. A failed removal moves it back. A purge interrupted by a crash is finished on the next purge attempt while its session still exists; otherwise (web deletes remove the session first) `aoe worktree cleanup` lists the `.aoe-purge-<session-id>` checkout as orphaned once no process is still purging it, and can remove it.

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ce52748a` are properly handled with clean fallback behavior.
