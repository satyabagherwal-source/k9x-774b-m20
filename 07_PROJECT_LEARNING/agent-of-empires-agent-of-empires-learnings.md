> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `f302922e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T20:53:15.930Z  
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
> **Harvest Timestamp**: 2026-11-04T20:53:15.725Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3546 stars

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
import { createAgentStream } from "./transport.ts";

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
  const stream = createAgentStream(input, output);

  acp
    .agent({ name: "aoe-agent" })
    .onRequest("initialize", ({ params }) => ({
      protocolVersion: params.protocolVersion ?? acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: Boolean
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

### Core Architecture Module: `acp-worker/aoe-agent/src/transport.ts`
```
import { ndJsonStream } from "@agentclientprotocol/sdk";

export function createAgentStream(
  output: WritableStream<Uint8Array>,
  input: ReadableStream<Uint8Array>,
) {
  return ndJsonStream(output, input, {
    // Match MAX_AGENT_FRAME_BYTES in src/acp/control_protocol.rs.
    maxMessageBytes: 64 * 1024 * 1024,
  });
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5226** (2026-11-03): **Dependabot: group Vitest and its V8 coverage provider across major updates**
  *Symptoms*: ## What happened?  Dependabot opened separate major upgrades for `vitest` (#5191) and `@vitest/coverage-v8` (#5193). Each PR updates only one direct dependency, leaving incompatible peers and preventing normal npm installation.  At [main@9ffbbf24](https://github.com/agent-of-empires/agent-of-empires/blob/9ffbbf24be690929ea6a61d02fc4cbdefc1db924/.github/dependabot.yml#L91-L138), minor/patch upgrades already match `web-minor-patch`. Major upgrades match no group and therefore receive individual PRs, as [documented by GitHub](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups--).  The coverage provider requires an exact Vitest peer: [4.1.11](https://registry.npmjs.org/@vitest/coverage-v8/4.1.11) requires `vitest: 4.1.11`; [5.0.3](https://registry.npmjs.org/@vitest/coverage-v8/5.0.3) requires `vitest: 5.0.3`.  ## Reproduction and evidence  Copy `web/package.json`, `web/package-lock.json` and `web/.npmrc` from each revision into an isolated temporary directory, then run:  ```sh npm ci --dry-run --ignore-scripts --no-audit --no-fund \   --legacy-peer-deps=false --force=false ```  Observed locally:  | Revision | Exit | Result | | --- | --- | --- | | `main@9ffbbf24` | 0 | Dependency resolution succeeds | | #5191 at `2564fdbe1bd6e1d0737b5606939d5eb8744dced5` | 1 | `ERESOLVE`: coverage 4.1.11 requires Vitest 4.1.11, but Vitest resolves to 5.0.3 | | #5193 at `932bfaf06365868baf74ed378e18adb32430ece6` | 1 | `ERESOLVE`: coverage 5.

- **Issue #5224** (2026-11-04): **[bug] Structured view (ACP): every UserPromptSent stored and rendered twice with vibe-acp**
  *Symptoms*: ### What happened?  In Structured view sessions (ACP, agent: vibe / vibe-acp), every user prompt is stored twice in `acp_events.db` (~30 ms apart) and therefore rendered twice in the TUI and web transcript. Terminal sessions are unaffected. The agent itself receives and processes the prompt exactly once — only the event/transcript is duplicated.  ### Environment  - AoE 1.21.0 (binary install), current latest release - Vibe 3.0.4, vibe-acp 3.0.4 (current latest) - Debian 12/13, reproduced on two hosts  ### Evidence  ```sql sqlite3 ~/.config/agent-of-empires/acp_events.db "SELECT seq, discriminant, substr(event_json,1,300), created_at FROM acp_events WHERE session_id='16f71f008d6d424f' AND discriminant='UserPromptSent' ORDER BY seq LIMIT 6;" ```  ``` seq=4953   UserPromptSent | {"UserPromptSent":{"text":"...","prompt_id":"abc-123...","synthesized"\:false}} | 1730285358156 seq=4954 | UserPromptSent | {"UserPromptSent":{"text":"...","synthesized"\:false}}                          | 1730285358391 ```  - 44 `UserPromptSent` events in one session = 22 prompts × 2, gap 27–156 ms (avg 39 ms) - First copy usually carries `prompt_id`, second copy has none (on a second host both copies lacked `prompt_id`, so dedup on `prompt_id` alone is not reliable) - `synthesized: false` in **both** copies → the synthesized suppression introduced in #4041 does not apply - No `rate_limited`/`Stopped` events, no idle phase, not a replay pattern  Reproduced again after updating to Vibe/vibe-acp 3.0.4, so

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

### Incident Patch 1: `ebd5a774` (2026-11-04)
**Commit Message**: fix(worktree): revalidate cleanup candidates after the confirmation prompt (#5263)

* fix(worktree): revalidate cleanup candidates against all profiles after confirmation

Cleanup removed every listed orphan after the y/N prompt without
rechecking, so a session created on or inside a candidate meanwhile
lost its checkout. Rows from every profile are now read and the
removal done under the store locks, and candidates a session sits on
or inside are skipped. An unreadable store removes nothing.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(worktree): hold the transition lock while cleanup lists profiles

A profile created between listing profiles and locking their stores was
never read, so a session inside a candidate could lose its checkout.
Cleanup now takes the shared transition lock first, which profile
creation needs exclusively.

Addresses review comment from @jerome-benoit on #5263.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* test(worktree): fail when cleanup lists profiles without the transition lock

The earlier test also passed without the lock, because the store locks
block on the same file. A hook after the listing now checks that profile
creat

**File**: `src/cli/worktree.rs` (modified, +136/-1)
```diff
@@ -296,6 +296,49 @@ pub(crate) fn remove_orphaned_worktrees(
     removed
 }
 
+#[cfg(test)]
+thread_local! {
+    static AFTER_PROFILE_LISTING: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
+        const { std::cell::RefCell::new(None) };
+}
+
+/// Removes the confirmed worktrees that no session in any profile sits on or inside. The rows are
+/// read, and the removal done, while every store is locked, so no session can adopt a path in
+/// between. Fails closed: if a store cannot be read, nothing is removed.
+pub(crate) fn remove_confirmed_worktrees(
+    git_wt: &GitWorktree,
+    orphans: &[WorktreeEntry],
+    purging: &HashSet<PathBuf>,
+) -> Result<usize> {
+    let _transition = crate::session::StorageTransition::acquire()?;
+    let storages = crate::session::list_profiles()?
+        .iter()
+        .map(|profile| Storage::open_unwatched(profile))
+        .collect::<Result<Vec<_>>>()?;
+    #[cfg(test)]
+    if let Some(hook) = AFTER_PROFILE_LISTING.with(|slot| slot.borrow_mut().take()) {
+        hook();
+    }
+    crate::session::with_storages_locked(&storages, || {
+        let mut session_paths = Vec::new();
+        for storage in &storages {
+            for inst in storage.load_instances_complete()? {
+                let path = PathBuf::from(&inst.project_path);
+                session_paths.extend(path.canonicalize().ok());
+                session_paths.push(path);
+            }
+        }
+        let (kept, free): (Vec<_>, Vec<_>) = orphans
+            .iter()
+            .cloned()
+            .partition(|wt| session_paths.iter().any(|path| path.starts_with(&wt.path)));
+        for wt in &kept {
+            eprintln!("✗ Skipped {}: a session now uses it", wt.path.display());
+        }
+        Ok(remove_orphaned_worktrees(git_wt, &free, purging))
+    })?
+}
+
 async fn cleanup_orphaned(profile: &str, force: bool) -> Result<()> {
     let storage = Storage::open_unwatched(profile)?;
     let (instances, _groups) = storage.load_with_groups()?;
@@ -389,7 +432,7 @@ async fn cleanup_orphaned(profile: &str, force: bool) -> Result<()> {
         let main_repo = GitWorktree::find_main_repo(&current_dir)?;
         let git_wt = GitWorktree::new(main_repo)?;
 
-        removed_count += remove_orphaned_worktrees(&git_wt, &orphaned_worktrees, &purging);
+        removed_count += remove_confirmed_worktrees(&git_wt, &orphaned_worktrees, &purging)?;
     }
 
     println!("\n✓ Cleanup complete: {} items removed", removed_count);
@@ -515,6 +558,98 @@ mod tests {
         assert_eq!(ids(&left), ["restored", "locked", "reserved"]);
     }
 
+    /// A session created on, or inside, a listed candidate after listing keeps its checkout.
+    #[test]
+    #[serial_test::serial]
+    fn cleanup_spares_candidates_a_session_adopted_after_listing() {
+        let tmp = tempfile::TempDir::new().unwrap();
+        let _home = crate::session::test_support::isolate_app_dir_at(&tmp.path().join("home"));
+        let repo = tmp.path().join("repo");
+        std::fs::create_dir(&repo).unwrap();
+        let git = |args: &[&str]| {
+            let status = std::process::Command::new("git")
+                .args(["-c", "user.name=t", "-c", "user.email=t@t"])
+                .args(args)
+                .current_dir(&repo)
+                .status()
+                .unwrap();
+            assert!(status.success(), "git {args:?}");
+        };
+        git(&["init", "-q"]);
+        git(&["commit", "-q", "--allow-empty", "-m", "init"]);
+        let git_wt = GitWorktree::new(repo.clone()).unwrap();
+        let mut paths = Vec::new();
+        for name in ["inside", "equal", "free"] {
+            let path = tmp.path().join(name);
+            git_wt.create_worktree(name, &path, true, None).unwrap();
+            paths.push(path.canonicalize().unwrap());
+        }
+
+        let (orphans, _) = find_orphaned_worktrees(&[], &git_wt).unwrap();
+        assert_eq!(orphans.len(), 3);
+        let purging = purging_paths(&orphans);
+
+        let nested = paths[0].join("sub");
+        std::fs::create_dir(&nested).unwrap();
+        for (profile, path) in [("one", &nested), ("two", &paths[1])] {
+            Storage::new_unwatched(profile)
+                .unwrap()
+                .update(|instances, _groups| {
+                    instances.push(Instance::new("adopted", path.to_str().unwrap()));
+                    Ok(())
+                })
+                .unwrap();
+        }
+
+        let removed = remove_confirmed_worktrees(&git_wt, &orphans, &purging).unwrap();
+        assert_eq!(removed, 1);
+        assert!(paths[0].exists() && paths[1].exists());
+        assert!(!paths[2].exists());
+    }
+
+    /// Cleanup holds the catalogue lock across the profile listing, so a profile cannot be created
+    /// after the listing and go unread.
+    #[test]
+    #[serial_test::serial]
+    fn cleanup_blocks_profile_creation_after_listing() {
+        let tmp = tempfile::TempDir::new().unwrap();
+       
```

**File**: `src/git/worktree/mod.rs` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ pub(crate) struct WorktreeCreation {
     pub branch_created: bool,
     pub checkout_created: bool,
 }
+#[derive(Clone)]
 pub struct WorktreeEntry {
     pub path: PathBuf,
     pub branch: Option<String>,
```

**File**: `src/session/mod.rs` (modified, +3/-1)
```diff
@@ -120,7 +120,9 @@ pub(crate) use storage::observe_lock_contention_for_test;
 pub(crate) use storage::{
     duplicate_reports, reconcile_profile_duplicates, DuplicateIdReport, ProfileMovePlan,
 };
-pub(crate) use storage::{try_acquire_terminal_handoff_driver, TerminalHandoffDriver};
+pub(crate) use storage::{
+    try_acquire_terminal_handoff_driver, with_storages_locked, TerminalHandoffDriver,
+};
 
 use std::sync::atomic::{AtomicBool, Ordering};
 
```

---

### Incident Patch 2: `e0830982` (2026-11-04)
**Commit Message**: fix(serve): let the Daemon stop before the launcher kills it on a readiness timeout (#5259)

* fix(serve): stop a Daemon start in flight on SIGTERM so its guards run

The signal handler was installed only after the Tunnel start, so a
signal during it used the default action and skipped every Drop,
including the one that turns off a Funnel the start switched on.
Register the handler first and race the Tunnel start against it.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve): give an unready Daemon a grace to stop before killing it

On a readiness failure the launcher sent SIGKILL at once. Send SIGTERM
and wait up to 5 s, longer than the 3 s Funnel reset bound, then kill.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve): do not signal an unready Daemon child that is already reaped

Addresses review comment from @jerome-benoit on #5259.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve): size the unready Daemon grace to the Funnel cleanup budget

The guard runs two commands bounded at 3 s each, so 5 s could cut it
short. Derive the grace from that bound plus margin.

Addresses review comment from @jerome-benoit on #5259.

Co-Autho

**File**: `src/cli/serve.rs` (modified, +77/-2)
```diff
@@ -1890,8 +1890,7 @@ async fn start_daemon(
     )
     .await;
     if let Err(error) = ready {
-        let _ = child.kill();
-        let _ = child.wait();
+        stop_unready_daemon(&mut child).await;
         return Err(error);
     }
 
@@ -1932,6 +1931,34 @@ async fn await_daemon_ready<'a>(
     })
 }
 
+/// Covers the Funnel guard's two sequential cleanup commands, each bounded by
+/// `FUNNEL_OFF_TIMEOUT`, plus margin.
+const UNREADY_DAEMON_GRACE: std::time::Duration = crate::server::tunnel::FUNNEL_OFF_TIMEOUT
+    .saturating_mul(2)
+    .saturating_add(std::time::Duration::from_secs(2));
+
+/// SIGTERM, then SIGKILL after the grace.
+async fn stop_unready_daemon(child: &mut std::process::Child) {
+    stop_child_within(child, UNREADY_DAEMON_GRACE).await;
+}
+
+async fn stop_child_within(child: &mut std::process::Child, grace: std::time::Duration) {
+    // A reaped child's pid may be reused, so signal only one `try_wait` shows still running.
+    if !matches!(child.try_wait(), Ok(None)) {
+        return;
+    }
+    let _ = nix::sys::signal::kill(
+        nix::unistd::Pid::from_raw(child.id() as i32),
+        nix::sys::signal::Signal::SIGTERM,
+    );
+    let deadline = tokio::time::Instant::now() + grace;
+    while !matches!(child.try_wait(), Ok(Some(_))) && tokio::time::Instant::now() < deadline {
+        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
+    }
+    let _ = child.kill();
+    let _ = child.wait();
+}
+
 async fn migrate_managed_launch(
     transaction: crate::daemon::lifecycle::Transaction,
     full: bool,
@@ -2247,6 +2274,54 @@ mod tests {
 
     use super::*;
 
+    #[tokio::test]
+    async fn an_already_exited_daemon_is_not_signalled() {
+        let mut child = std::process::Command::new("true").spawn().unwrap();
+        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
+        // Reap it as the readiness loop does, then keep the pid from a stale signal.
+        while child.try_wait().unwrap().is_none() {
+            assert!(std::time::Instant::now() < deadline, "child never exited");
+            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
+        }
+        let started = std::time::Instant::now();
+        stop_child_within(&mut child, std::time::Duration::from_secs(30)).await;
+        assert!(started.elapsed() < std::time::Duration::from_secs(5));
+    }
+
+    #[tokio::test]
+    async fn an_unready_daemon_is_stopped_within_the_grace() {
+        // The ready file is touched once the shell has installed its trap.
+        for (trap, kill_expected) in [("exit 0", false), ("", true)] {
+            let dir = tempfile::tempdir().unwrap();
+            let ready = dir.path().join("ready");
+            let mut child = std::process::Command::new("sh")
+                .args([
+                    "-c",
+                    r#"trap "$2" TERM; touch "$1"; while :; do sleep 0.05; done"#,
+                    "sh",
+                ])
+                .arg(&ready)
+                .arg(trap)
+                .spawn()
+                .unwrap();
+            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
+            while !ready.exists() {
+                assert!(std::time::Instant::now() < deadline, "shell never started");
+                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
+            }
+            let grace = std::time::Duration::from_millis(500);
+            let started = std::time::Instant::now();
+            stop_child_within(&mut child, grace).await;
+            let elapsed = started.elapsed();
+            assert!(child.try_wait().unwrap().is_some(), "child must be reaped");
+            if kill_expected {
+                assert!(elapsed >= grace, "{elapsed:?}");
+            } else {
+                assert!(elapsed < grace, "{elapsed:?}");
+            }
+        }
+    }
+
     #[tokio::test]
     async fn cityhall_refusal_cannot_reflect_the_bearer_into_errors() {
         use tokio::io::{AsyncReadExt, AsyncWriteExt};
```

**File**: `src/server/startup.rs` (modified, +89/-28)
```diff
@@ -307,10 +307,66 @@ async fn within_tunnel_deadline<T>(
         })
 }
 
+/// Drops `start` on a signal so its guards run their cleanup.
+async fn until_terminated<T>(
+    terminated: &CancellationToken,
+    start: impl Future<Output = anyhow::Result<T>>,
+) -> anyhow::Result<T> {
+    tokio::select! {
+        biased;
+        _ = terminated.cancelled() => anyhow::bail!("Stopped by a signal before startup finished"),
+        result = start => result,
+    }
+}
+
+/// Cancelled by the first SIGINT, SIGTERM or SIGHUP. Registered up front so a signal during
+/// startup stops it, rather than killing the process with no `Drop` run.
+fn watch_termination_signals() -> CancellationToken {
+    let token = CancellationToken::new();
+    let cancel = token.clone();
+    #[cfg(unix)]
+    {
+        use tokio::signal::unix::{signal, SignalKind};
+        let register = |kind: SignalKind, name: &str| {
+            signal(kind)
+                .inspect_err(|error| {
+                    tracing::warn!(target: "serve.shutdown", signal = name, %error, "could not register signal handler");
+                })
+                .ok()
+        };
+        let mut sigterm = register(SignalKind::terminate(), "SIGTERM");
+        let mut sighup = register(SignalKind::hangup(), "SIGHUP");
+        tokio::spawn(async move {
+            tokio::select! {
+                _ = async { if tokio::signal::ctrl_c().await.is_err() { std::future::pending().await } } => {
+                    tracing::info!(target: "serve.shutdown", signal = "SIGINT", "received signal, shutting down");
+                }
+                _ = async { match sigterm { Some(ref mut s) => { s.recv().await; } None => std::future::pending().await } } => {
+                    tracing::info!(target: "serve.shutdown", signal = "SIGTERM", "received signal, shutting down");
+                }
+                _ = async { match sighup { Some(ref mut s) => { s.recv().await; } None => std::future::pending().await } } => {
+                    tracing::info!(target: "serve.shutdown", signal = "SIGHUP", "received signal, shutting down");
+                }
+            }
+            cancel.cancel();
+        });
+    }
+    #[cfg(not(unix))]
+    tokio::spawn(async move {
+        if tokio::signal::ctrl_c().await.is_err() {
+            return;
+        }
+        tracing::info!(target: "serve.shutdown", "received ctrl-c, shutting down");
+        cancel.cancel();
+    });
+    token
+}
+
 pub(crate) async fn start_server(
     config: ServerConfig<'_>,
     transaction: crate::daemon::lifecycle::Transaction,
 ) -> anyhow::Result<()> {
+    let terminated = watch_termination_signals();
     let tunnel_deadline = tokio::time::Instant::now() + TUNNEL_STARTUP_DEADLINE;
     let ServerConfig {
         profile,
@@ -615,7 +671,7 @@ pub(crate) async fn start_server(
 
     let tunnel_handle = if remote {
         // Choosing and starting the tunnel is the part that can hang, so it shares one deadline.
-        let handle = within_tunnel_deadline(tunnel_deadline, async {
+        let handle = until_terminated(&terminated, within_tunnel_deadline(tunnel_deadline, async {
             let tailscale_ok = if tunnel::skips_tailscale(no_tailscale, tunnel_name, tunnel_url) {
                 tracing::debug!(target: "http.middleware", "tunnel: --no-tailscale or a named tunnel, skipping Tailscale auto-detection");
                 false
@@ -652,7 +708,7 @@ pub(crate) async fn start_server(
             } else {
                 tunnel::TunnelHandle::spawn_quick(local_port).await?
             })
-        })
+        }))
         .await?;
 
         let tunnel_url_with_token = if let Some(ref token) = auth_token {
@@ -1214,32 +1270,9 @@ pub(crate) async fn start_server(
     // Both listeners drain on the same cancellation signal and deadline.
     let shutdown_state = state.clone();
     let shutdown_signal = async move {
-        #[cfg(unix)]
-        {
-            use tokio::signal::unix::{signal, SignalKind};
-            let mut sigterm = signal(SignalKind::terminate()).ok();
-            let mut sighup = signal(SignalKind::hangup()).ok();
-            tokio::select! {
-                _ = shutdown_state.shutdown.cancelled() => {}
-                _ = tokio::signal::ctrl_c() => {
-                    tracing::info!(target: "serve.shutdown", signal = "SIGINT", "received signal, shutting down");
-                }
-                _ = async { match sigterm { Some(ref mut s) => { s.recv().await; } None => std::future::pending().await } } => {
-                    tracing::info!(target: "serve.shutdown", signal = "SIGTERM", "received signal, shutting down");
-                }
-                _ = async { match sighup { Some(ref mut s) => { s.recv().await; } None => std::future::pending().await } } => {
-                    tracing::info!(target: "serve.shutdown", signal = "SIGHUP", "received signal, shutting down");
-                }
-            }
-        }
-        #[cfg(no
```

**File**: `src/server/tunnel.rs` (modified, +1/-1)
```diff
@@ -674,7 +674,7 @@ async fn lock_funnel_starts(path: &std::path::Path) -> anyhow::Result<std::fs::F
 }
 
 /// How long turning the Funnel back off may take.
-const FUNNEL_OFF_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(3);
+pub(crate) const FUNNEL_OFF_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(3);
 
 /// Turns off the :443 Funnel a Tailscale start switched on, unless the start finishes.
 /// Every error return after `--bg` starts awaits [`Self::fail`]; `Drop` covers a start that was
```

---

### Incident Patch 3: `7935c8db` (2026-11-04)
**Commit Message**: fix(web): clear seeded model and effort when the wizard agent changes (#5265)

* fix(web): clear seeded model and effort when the wizard agent changes

The wizard seeds agentModel and agentEffort from the starting agent's
acp_defaults. Switching agent kept them, so the create request sent the
previous agent's model and the session failed to switch to it.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* test(web): record agent-switch model reset in the coverage matrix

Addresses review comment from @jerome-benoit on #5265.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* test(web): assert the create request omits the previous agent's model

Addresses review comment from CodeRabbit on #5265.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/components/session-wizard/__tests__/SessionWizard.test.tsx` (modified, +22/-0)
```diff
@@ -223,6 +223,28 @@ describe("SessionWizard structured view payload", () => {
       agent_effort: "high",
     });
   });
+
+  it("drops the previous agent's model and effort after switching agent", async () => {
+    vi.mocked(fetchSettings).mockResolvedValueOnce({
+      session: { default_tool: "opencode" },
+      acp: { acp_defaults: { opencode: { model: "openai/gpt-5.5", effort: "high" } } },
+      sandbox: {},
+    } as never);
+    vi.mocked(fetchAgents).mockResolvedValueOnce([
+      agent("opencode", { acp_installed: true }),
+      agent("claude", { acp_installed: true }),
+    ]);
+    renderWizard({ path: "/tmp/proj" });
+    await waitFor(() => expect(screen.getByTestId("wizard-agent-row").textContent).toContain("opencode"));
+    fireEvent.click(screen.getByTestId("wizard-agent-row"));
+    fireEvent.click(await screen.findByRole("button", { name: /^claude/ }));
+    fireEvent.click(screen.getByRole("button", { name: "Done" }));
+    await launch();
+    await waitFor(() => expect(createSession).toHaveBeenCalled());
+    expect(payload().tool).toBe("claude");
+    expect(payload().agent_model).toBeUndefined();
+    expect(payload().agent_effort).toBeUndefined();
+  });
 });
 
 describe("SessionWizard last instruction memory", () => {
```

**File**: `web/src/components/session-wizard/wizardReducer.test.ts` (modified, +10/-0)
```diff
@@ -161,6 +161,16 @@ describe("leaving an import under structured_view off", () => {
 });
 
 describe("SET_FIELD mutual exclusion", () => {
+  it("switching agent drops the previous agent's seeded model and effort", () => {
+    const seeded = makeState({ tool: "pi", agentModel: "p/m", agentEffort: "high" });
+    expect(reducer(seeded, set("tool", "claude")).data).toMatchObject({
+      tool: "claude",
+      agentModel: "",
+      agentEffort: "",
+    });
+    expect(reducer(seeded, set("tool", "pi")).data).toMatchObject({ agentModel: "p/m", agentEffort: "high" });
+  });
+
   it("enabling scratch clears path sources, worktree, import id and a stale non-repo probe", () => {
     const seeded = makeState({
       path: "/old",
```

**File**: `web/src/components/session-wizard/wizardReducer.ts` (modified, +2/-0)
```diff
@@ -157,6 +157,8 @@ function setField(data: WizardData, field: string, value: unknown): WizardData {
   }
   // Any branch edit, even clearing it, stops the title mirror.
   if (field === "worktreeBranch") next.worktreeBranchDirty = true;
+  // The seeded model and effort belong to the previous agent; unset, the server uses the new agent's defaults.
+  if (field === "tool" && value !== data.tool) Object.assign(next, { agentModel: "", agentEffort: "" });
   if (field === "scratch" && value === true) {
     Object.assign(next, {
       path: "",
```

**File**: `web/tests/coverage-matrix.json` (modified, +8/-0)
```diff
@@ -1300,6 +1300,14 @@
         "web/src/lib/types.ts"
       ]
     },
+    {
+      "id": "wizard.agent-switch-model-reset",
+      "kind": "vitest",
+      "risk": "medium",
+      "specs": ["src/components/session-wizard/wizardReducer.test.ts"],
+      "components": ["web/src/components/session-wizard/wizardReducer.ts"],
+      "notes": "Switching the wizard agent clears the seeded model and effort so the create request omits them and the server uses the new agent's defaults; re-selecting the same agent keeps them."
+    },
     {
       "id": "wizard.project-sandbox-override",
       "notes": "Tri-state project container defaults resolve from the acknowledged served or explicitly selected profile; registry retries preserve unknown versus empty, profile switches commit atomically, manual edits and host-only imports outrank late defaults, and saves preserve explicit false while omitting inherited values.",
```

#### Recent Merged Pull Requests:
- **PR #5273** (closed): fix(plugin): preserve status fallback without reports (@athal7)
- **PR #5267** (2026-11-04): fix(acp): drop live user_message_chunk echoes in structured view (@Seluj78)
- **PR #5265** (2026-11-04): fix(web): clear seeded model and effort when the wizard agent changes (@Seluj78)
- **PR #5264** (2026-11-04): refactor(daemon): separate endpoint values from host discovery (@jerome-benoit)
- **PR #5263** (2026-11-04): fix(worktree): revalidate cleanup candidates after the confirmation prompt (@Seluj78)
- **PR #5260** (2026-11-03): fix(serve): say daemon startup is unconfirmed, with PID and log path (@Seluj78)

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

## X. worktree): revalidate cleanup candidates after the confirmation prompt (#5263)

**RULE**:
When implementing operations in `src/cli/worktree.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ebd5a774`: worktree): revalidate cleanup candidates after the confirmation prompt (#5263). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/cli/worktree.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[cfg(test)]
thread_local! {
    static AFTER_PROFILE_LISTING: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
}

/// Removes the confirmed worktrees that no session in any profile sits on or inside. The rows are
/// read, and the removal done, while every store is locked, so no session can adopt a path in
/// between. Fails closed: if a store cannot be read, nothing is removed.
pub(crate) fn remove_confirmed_worktrees(
    git_wt: &GitWorktree,
    orphans: &[WorktreeEntry],
    purging: &HashSet<PathBuf>,
) -> Result<usize> {
    let _transition = crate::session::StorageTransition::acquire()?;
    let storages = crate::session::list_profiles()?
        .iter()
        .map(|profile| Storage::open_unwatched(profile))
        .collect::<Result<Vec<_>>>()?;
    #[cfg(test)]
    if let Some(hook) = AFTER_PROFILE_LISTING.with(|slot| slot.borrow_mut().take()) {
        hook();
    }
    crate::session::with_storages_locked(&storages, || {
        let mut session_paths = Vec::new();
        for storage in &storages {
            for inst in storage.load_instances_complete()? {
                let path = PathBuf::from(&inst.project_path);

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        removed_count += remove_orphaned_worktrees(&git_wt, &orphaned_worktrees, &purging);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ebd5a774` are properly handled with clean fallback behavior.
