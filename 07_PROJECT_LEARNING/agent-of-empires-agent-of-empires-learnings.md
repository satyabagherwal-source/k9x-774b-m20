> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `16c57ac4`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T20:38:40.169Z  
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
> **Harvest Timestamp**: 2026-11-08T20:38:40.161Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3859 stars

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

### Core Architecture Module: `scripts/check-no-claude-in-core.py`
```
#!/usr/bin/env python3
"""Fail if core mentions Claude outside the allowlist (epic #5308, "zero Claude in core").

Claude support moves to the Claude plugin. Once it has, `claude`, `claudeCode`
and `CLAUDE_` must not reappear in the core trees below. The match is
case-insensitive, so it also catches `Claude` in prose.

Scanned: tracked files under src/, web/src/, docker/ and acp-worker/.

Allowlist (the only places Claude may stay):
  - src/migrations/                  immutable migrations rewrite persisted Claude data
  - src/telemetry/sanitize.rs        model-family bucket for Anthropic model names
  - acp-worker/aoe-agent/            the aoe-agent Anthropic provider and default model,
                                     an Anthropic API choice, not Claude Code
  - CHANGELOG.md                     outside the scanned trees, listed for completeness

CI wires this in disabled form until the removal work (C25 to C29) has landed on
integration/claude-removal; see .github/workflows/ci.yml.

Usage:
    python3 scripts/check-no-claude-in-core.py [--self-test]
"""

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

SCANNED = ("src/", "web/src/", "docker/", "acp-worker/")

ALLOWLIST = (
    "src/migrations/",
    "src/telemetry/sanitize.rs",
    "acp-worker/aoe-agent/",
    "CHANGELOG.md",
)

PATTERN = re.compile(r"claude", re.IGNORECASE)


def is_scanned(path):
    return path.startswith(SCANNED) and not path.startswith(ALLOWLIST)


def find_hits(path, text):
    return [
        (path, number, line.strip())
        for number, line in enumerate(text.splitlines(), 1)
        if PATTERN.search(line)
    ]


def tracked_files():
    out = subprocess.run(
        ["git", "ls-files", "-z"], cwd=REPO_ROOT, capture_output=True, check=True
    ).stdout
    return [p for p in out.decode().split("\0") if p]


def self_test():
    cases = [
        ("src/agents.rs", True),
        ("web/src/App.tsx", True),
        ("docker/Dockerfile", True),
        ("acp-worker/adapters/package.json", True),
        ("src/migrations/v012_acp_rename.rs", False),
        ("src/telemetry/sanitize.rs", False),
        ("src/telemetry/mod.rs", True),
        ("acp-worker/aoe-agent/index.ts", False),
        ("CHANGELOG.md", False),
        ("docs/claude.md", False),
        ("tests/e2e/harness.rs", False),
    ]
    for path, expected in cases:
        assert is_scanned(path) == expected, path

    for line in ("let c = claudeCode;", "env CLAUDE_CONFIG_DIR", "Claude Code", "claude"):
        assert find_hits("f", line), line
    assert not find_hits("f", "let agent = codex;")
    assert find_hits("f", "a\nb claude\nc") == [("f", 2, "b claude")]
    print("self-test ok")


def main():
    if "--self-test" in sys.argv[1:]:
        self_test()
        return 0

    hits = []
    for path in tracked_files():
        if not is_scanned(path):
            continue
        try:
            text = (REPO_ROOT / path).read_text(encoding="utf-8", errors="replace")
        except FileNotFoundError:
            continue
        hits.extend(find_hits(path, text))

    for path, number, line in hits:
        print(f"{path}:{number}: {line}")
    if hits:
        print(f"\n{len(hits)} Claude reference(s) in core outside the allowlist", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `src/acp/acp_client/connection/command_loop.rs`
```
//! The between-prompt command loop over an established session, including
//! the driven conversation reset.

use crate::acp::state::Event;
use agent_client_protocol::v1::schema::{
    CancelNotification, ContentBlock, McpServer, NewSessionRequest, NewSessionResponse,
    SessionConfigId, SessionConfigOption, SessionConfigValueId, SessionId,
    SetSessionConfigOptionRequest,
};
use agent_client_protocol::v1::ConnectionTo;
use agent_client_protocol::Agent;
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
        let adopted = shared.adopted_turn_active.swap(false, Ordering::Relaxed)
```

### Core Architecture Module: `src/acp/acp_client/lifecycle.rs`
```
//! Classifies agent updates into the turn-level facts the watchdogs act on.

use crate::acp::agent_profiles;
use crate::acp::state::Event;
use agent_client_protocol::v1::schema::{
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
        SessionUpdate::ToolCall(tc) => {
            let id = tc.tool_call_id.0.to_string();
            // Replay reports a final status on the initial call (#5206); a
            // `ToolStarted` here would never be closed.
            Some(match tc.status {
                ToolCallStatus::Completed => LifecycleSignal::ToolCompleted {
                    id,
                    succeeded: true,
                    off_protocol_work: detect_off_protocol_work_completed(&tc.content),
                },
                ToolCallStatus::Failed => LifecycleSignal::ToolCompleted {
                    id,
                    succeeded: false,
                    off_protocol_work: None,
                },
                _ => LifecycleSignal::ToolStarted {
                    id,
                    is_background_task: tc
                        .raw_input
                        .as_ref()
                        .and_then(|v| v.get("run_in_background"))
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                },
            })
        }
        SessionUpdate::ToolCallUpdate(update) => {
            let id = update.tool_call_id.0.to_string();
            Some(match update.fields.status {
                // Failed content can echo a marker, so only completions count.
                Some(ToolCallStatus::Completed) => LifecycleSignal::ToolCompleted {
                    id,
                    succeeded: true,
                    off_protocol_work: detect_off_protocol_work_completed(
                        update.fields.content.as_deref().unwrap_or_default(),
                    ),
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
    content: &[ToolCallContent],
) -> Option<OffProtocolWorkKind> {
    content
        .iter()
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
    /// Prompts admitted to this epoch; an idle stop observed before one is void.
    admissions: std::sync::atomic::AtomicU64,
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
            admissions: std::sync::atomic::AtomicU64::new(0),
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

    pub(crate) fn admissions(&self) -> u64 {
        self.construction
            .admissions
            .load(std::sync::atomic::Ordering::Acquire)
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
            .unwrap_or_else(|error|
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5454** (2026-11-08): **Show failed Trash reads when opening a retained Session**
  *Symptoms*: ### What happened?  P3 follow-up from #5355. A failed Trash read is indistinguishable from an unfinished load when opening a retained Session.  Source-derived scenario, not dynamically reproduced: 1. Open a direct link to a trashed Session. 2. Let `GET /api/sessions?state=untrashed` succeed, while the scoped Trash reads fail or time out. 3. The main pane remains a skeleton without a Trash error/retry state. Later automatic retries may recover, but a persistent failure stays unexplained.  `syncTrash` silently returns on a failed read and never sets `trashEpoch`; `openedSessionSettled` continues waiting while the untrashed poll has no error.  Expected: expose the scoped read failure and a retry path, preserve known rows, and do not treat an unread Session as deleted. Cover failure, retry and recovery with a deterministic regression and the applicable coverage entry.  Evidence: [failed read](https://github.com/agent-of-empires/agent-of-empires/blob/a7ccc0e5384f1f5247b29a8db5fb098b7320ead1/web/src/hooks/useSessions.ts#L171), [route settlement](https://github.com/agent-of-empires/agent-of-empires/blob/a7ccc0e5384f1f5247b29a8db5fb098b7320ead1/web/src/App.tsx#L461). #5278 concerns unfinished Trash transitions, not this read failure.  ### aoe version and OS  `main@a7ccc0e5384f1f5247b29a8db5fb098b7320ead1`; web dashboard. Static analysis only, no OS/browser reproduction claimed.  ### AI usage  Prepared with Codex, two independent sequential source reviews and a paginated search of ope

- **Issue #5382** (2026-11-06): **aoe add leaves a worktree and branch behind when it refuses --agent or --structured-view**
  *Symptoms*: ### What happened?  `aoe add` provisions the worktree, the branch (`-b`) and the workspace first, and only then decides the session's view. Two refusals in that view decision return with `bail!` and never call `cleanup_partial_session`, so they leave the worktree and branch behind with no session (`src/cli/add.rs` at 4062e0c21, #5244's head):  - `add.rs:627`: `--agent <name>` for an Agent that isn't ACP-capable ("agent `x` is not ACP-capable…"). - `add.rs:636`: `--structured-view` with a tool that isn't ACP-capable ("tool `x` is not ACP-capable, so --structured-view has no effect…").  The refusals around them already clean up: - the duplicate-title exit (`:535`); - the missing-adapter exit with `--agent` (`:719`); - the `--effort` without Structured view exit (`:756`).  **Steps** (run once, in an isolated `HOME`, with a debug build of main at 1f674d07e, whose `add.rs` has the same two exits. Paths are shortened, and the `git fetch` and daemon-start noise is trimmed):  ``` $ git init repo && git -C repo commit --allow-empty -m init $ aoe add ~/repo -w feat/x -b --agent not-an-acp-agent Creating worktree at: /tmp/r/repo-worktrees/feat-x ⚠ git fetch origin master failed for /tmp/r/repo/: fatal: 'origin' does not appear to be a git repository ✓ Worktree created successfully Error: agent `not-an-acp-agent` is not ACP-capable: it has no registry entry and no `[session.agent_acp_cmd]` command. Run `aoe acp doctor` to see configured agents, or omit --agent for a terminal-view session

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

### Incident Patch 1: `0d105f7a` (2026-11-07)
**Commit Message**: fix(daemon): honor configured services during autostart (#5283)

* fix(daemon): honor configured autostart services

Share fresh launch preparation without overriding explicit TCP or core-only choices. Preserve global service policy, passphrase and CityHall restrictions before detaching.

Keep read acquisition independent of listener mode and replay recorded restart and rollback policy unchanged.

Fixes #5281

Refs #4476

* fix(daemon): respect disabled web on acquisition

Read Web plugin permission from current global configuration for both automatic mode selection and explicit serve validation. Use the registry only for plugin presence, not its cached enabled state.

Keep private runtime acquisition and TUI reconnect available while Web serving is disabled. Preserve explicit TCP refusal and recorded restart policy.

Cover reads, live TUI reconnect, plugin re-enable, TCP absence and authenticated MCP restoration in the existing isolated fixture.

Refs #5281

* fix(daemon): preflight disabled web replays

Reject recorded TCP replacements against the current global Web plugin policy before restart or rollback stops the active daemon. Preserve core-only recovery and retained passphra

**File**: `.github/workflows/tests.yml` (modified, +5/-11)
```diff
@@ -110,23 +110,17 @@ jobs:
         env:
           AOE_REQUIRE_LOCAL_NETWORK_TESTS: '1'
         run: cargo test --features web,e2e-tests --test e2e -- --test-threads=3
-      # The `web`-gated test code runs nowhere else: core-rest builds at
-      # default features and the step above names only the e2e target. Both
-      # halves need naming. The integration blocks are the dashboard-route half
-      # of daemon_core_web_optional and the aoe.web builtin assertion in
-      # plugin_install; the lib-level ones are src/server/assets.rs (the whole
-      # module is `web`-gated) and the QR seam in src/tui/dialogs/serve.rs,
-      # which would otherwise be neither compiled nor run on a PR. Keep
-      # `e2e-tests` on so the feature set matches the step above and cargo
-      # reuses its artifacts instead of rebuilding the crate; filter the lib run
-      # so it does not re-run the whole suite core-rest already covers.
+      # Run Web-only regressions omitted by core-rest. Keep e2e-tests to reuse
+      # this leg's artifacts, and filter library tests instead of rerunning
+      # the full suite.
       - name: Cargo test (web-gated test blocks)
         if: matrix.leg == 'web-e2e'
         run: |
           cargo test --features web,e2e-tests \
             --test integration -- daemon_core_web_optional plugin_install
           cargo test --features web,e2e-tests --lib -- \
-            server::assets:: tui::dialogs::serve::qr_seam
+            server::assets:: tui::dialogs::serve::qr_seam \
+            session::config::tests::web_plugin_changes_do_not_cross_lifecycle_transactions
       # macOS reaches its per-user temp root through a symlink, so a test that
       # compares `TempDir::path()` against a path that has been through
       # `canonicalize()` or a reported cwd passes on Linux and fails there.
```

**File**: `docs/guides/mcp-control.md` (modified, +15/-1)
```diff
@@ -11,7 +11,21 @@ The server is off by default. Turn on the **MCP server** toggle in Settings, or
 mcp_enabled = true
 ```
 
-The daemon reads the setting at startup, so restart it afterwards with `aoe serve --restart`, or start one with `aoe serve --daemon`. It then serves MCP over Streamable HTTP at `/mcp` on the same port as the dashboard and API.
+The daemon reads this global setting at startup. With it enabled, a fresh CLI or TUI acquisition opens the existing TCP API on loopback with token authentication, unless the registered `aoe.web` plugin is disabled. This includes MCP over Streamable HTTP at `/mcp`. Builds with the `web` Cargo feature also serve the dashboard. It does not request a LAN bind or a tunnel. Passphrase and CityHall protections still apply.
+
+The private local runtime and `aoe plugin enable aoe.web` remain available while that plugin is disabled. Re-enabling it does not promote an existing private daemon. With readable global configuration, explicit TCP starts remain rejected until the plugin is enabled.
+
+For an already-running TCP daemon, use `aoe serve --restart` to apply the setting. Restart preserves the recorded launch mode: it does not promote a core-only daemon. To enable TCP on a running core-only daemon, explicitly run `aoe serve --daemon`. This replaces the managed daemon and disconnects its clients; reconnect them afterwards.
+
+### When configured TCP cannot start
+
+A configured TCP startup failure is reported without automatically starting a core-only daemon. For example, an occupied listener port makes CLI reads fail and leaves the TUI disconnected. AoE does not silently drop the configured MCP service to keep local reads working.
+
+Free the port or repair the reported startup failure, then retry the CLI command or press `r` in the TUI to reconnect.
+
+If global settings or application state cannot be loaded, fresh automatic acquisition fails instead of choosing default service settings. Explicit serving and restart retain their selected launch mode and existing configuration-recovery behavior. Explicit TCP recovery may use default runtime settings, including when an unreadable configuration contains a Web-disable setting. Use `--core-only` for recovery without TCP.
+
+To work intentionally without TCP, run `aoe serve --core-only --daemon`, then retry the command or reconnect the TUI. MCP remains unavailable on that daemon. Restart preserves core-only mode; after freeing the port, run `aoe serve --daemon` to explicitly promote it back to TCP.
 
 ## Connect an agent
 
```

**File**: `docs/guides/web-dashboard.md` (modified, +13/-1)
```diff
@@ -45,9 +45,21 @@ Run only the private local API, without TCP or a dashboard, with:
 aoe serve --core-only --daemon
 ```
 
+Fresh CLI and TUI acquisitions, including explicit reconnects, resolve global service opt-ins through the same launch preparation as explicit serving. With no inbound service enabled, or with the registered `aoe.web` plugin disabled, they stay private. Enabling the [MCP server](mcp-control.md) otherwise requests the existing loopback TCP API, not a public bind or tunnel. Builds with the `web` Cargo feature also serve the dashboard. Profile overrides cannot change this global policy. Explicit `--core-only` still suppresses TCP.
+
+Configured TCP startup failures are reported without automatically starting core-only. See [configured startup recovery](mcp-control.md#when-configured-tcp-cannot-start).
+
+`aoe plugin enable aoe.web` can acquire a private daemon while the plugin is disabled. Re-enabling the plugin does not promote that daemon; the next fresh acquisition may enable configured TCP serving. Readable global configuration that disables the plugin blocks explicit TCP starts. See [configuration recovery](mcp-control.md#when-configured-tcp-cannot-start) for unreadable settings.
+
+AoE-managed writes to the registered Web plugin's enable state use the daemon's namespace transaction. A save cannot commit during an active start, restart, or rollback; it reports a busy error rather than waiting inside the daemon. Retry rejected saves explicitly after the transition finishes. A save committed first is honored by launch validation. Disabling the plugin does not stop an existing TCP daemon. Hand edits do not participate in this coordination.
+
+See [Web plugin errors](../plugins.md#web-plugin-errors) for the command-palette manager's failure and recovery policy.
+
 An explicit `aoe serve` request enables Web serving by replacing a managed private-API Daemon under its lifecycle lock. It validates the requested exposure before stopping the old process, waits for dashboard readiness, and leaves terminal sessions running. Successful promotion retains the prior private-API launch for explicit recovery.
 
-`aoe serve --restart` replays the current managed launch. A failed replacement has no automatic fallback: use `aoe serve --rollback` to restore the retained launch, including after `--stop` or when the web plugin is disabled. Missing or mismatched credentials refuse rollback rather than dropping authentication; unavailable prerequisites can still make replay fail.
+`aoe serve --restart` replays the current managed launch. A failed replacement has no automatic fallback: use `aoe serve --rollback` to restore the retained launch, including after `--stop`. When readable global configuration disables `aoe.web`, replaying a TCP launch refuses before stopping the current daemon; core-only replay remains available. Missing or mismatched credentials refuse rollback rather than dropping authentication; unavailable prerequisites can still make replay fail.
+
+An absent daemon is different from a restart: the next autostart resolves current configuration, not the vanished daemon's recorded exposure flags. It does not restore a previous LAN bind or tunnel. Persisted Web serving and Tunnel settings remain tracked separately in [#4476](https://github.com/agent-of-empires/agent-of-empires/issues/4476).
 
 Local restarts from the TUI preserve the running dashboard's effective passphrase, including when a newly opened TUI has no `AOE_SERVE_PASSPHRASE` variable. Restart refuses before stopping the running Daemon if its required credential cannot be recovered. Generating a new Tunnel passphrase explicitly replaces that credential.
 
```

**File**: `docs/plugins.md` (modified, +13/-3)
```diff
@@ -6,14 +6,24 @@ To build one, see [Writing Plugins](development/writing-plugins.md) and the [Plu
 
 ## Managing plugins
 
-Three equivalent surfaces:
+Manage plugins through these surfaces:
 
 - **CLI**: `aoe plugin list | info <id> | logs <id> | enable <id> | disable <id> | install <source> | update <id> | uninstall <id>`.
-- **TUI**: "Manage plugins" in the command palette, or the Plugins settings tab. Space toggles enable and disable.
-- **Web**: the Plugins settings tab. Enabling or disabling needs an elevated (passphrase) session when login is enabled and is blocked in read-only mode; localhost browsers skip the passphrase, matching the CLI's same-host trust.
+- **TUI**: "Manage plugins" in the command palette applies Space toggles immediately. In the Plugins settings tab, Space stages a change and Ctrl-S saves it.
+- **Web**: the Plugins settings tab. Enabling or disabling needs an elevated (passphrase) session when login is enabled and is blocked in read-only mode.
 
 A plugin's enable-state lives under `[plugins."<id>"]` in `config.toml`.
 
+### Web plugin errors
+
+The command-palette manager can save locally when initial local-daemon discovery fails. Once discovery succeeds, any error while changing `aoe.web` is reported without retrying the write locally. This includes lifecycle-busy and read-only refusals, authentication errors, an unavailable transport, and a missing endpoint on an older daemon. Other plugins retain their local-save fallback with a stale-daemon warning.
+
+A repeated Boolean write is idempotent, but a configuration lock does not enforce daemon authorization or reconcile live workers. A failed response is not permission to bypass that daemon. For persistent local transport or HTTP 404 failures, run `aoe serve --stop`, inspect `aoe plugin info aoe.web`, then explicitly retry the desired `aoe plugin enable aoe.web` or `aoe plugin disable aoe.web` command if still needed. Stopping disconnects daemon clients; supervised daemons must be stopped through their manager. Retry may autostart using current configuration. For remote endpoints, recover the selected daemon on its host instead. Lifecycle-busy, read-only and authentication refusals remain authoritative.
+
+`aoe plugin enable` and `aoe plugin disable` also report daemon errors without a local fallback. If the CLI fails to acquire an endpoint for a live owner with a missing socket, it reports the acquisition error without adding the stop/retry hint. The command-palette manager can instead reach the failed request and show the hint.
+
+The TUI Plugins settings tab remains an explicit local configuration save, separate from the command-palette manager's immediate daemon request.
+
 ## Worker logs
 
 A plugin worker's stderr goes to `<app_dir>/plugin-workers/<plugin-id>_<worker-uuid>.log`, one file per worker start. `aoe plugin logs <id>` prints the path of the most recent one, which is the live worker's while it runs, so `tail -f "$(aoe plugin logs <id>)"` follows it. Workers only run under `aoe serve`, so a plugin that never ran has no log.
```

**File**: `src/cli/graft.rs` (modified, +6/-4)
```diff
@@ -44,11 +44,13 @@ pub fn augmented_command() -> Command {
     graft_onto(Cli::command(), plugin_commands())
 }
 
-/// True when the builtin `aoe.web` plugin is present and disabled.
-pub fn web_disabled() -> bool {
-    crate::plugin::registry()
+/// Whether global configuration disables the registered Web plugin.
+pub fn web_disabled(config: &crate::session::Config) -> bool {
+    config
+        .plugins
         .get("aoe.web")
-        .is_some_and(|p| !p.enabled)
+        .is_some_and(|plugin| !plugin.enabled)
+        && crate::plugin::registry().get("aoe.web").is_some()
 }
 
 /// Reject fresh web starts when `aoe.web` is disabled, not core recovery.
```

**File**: `src/cli/plugin.rs` (modified, +14/-4)
```diff
@@ -188,10 +188,20 @@ fn run_info(id: &str) -> Result<()> {
 }
 
 async fn run_set_enabled(id: &str, enabled: bool) -> Result<()> {
-    let endpoint = crate::acp::client::require_daemon().await?;
-    crate::acp::client::HttpClient::new(endpoint)?
-        .set_plugin_enabled(id, enabled)
-        .await?;
+    let result = async {
+        let endpoint = crate::acp::client::require_daemon().await?;
+        crate::acp::client::HttpClient::new(endpoint)?
+            .set_plugin_enabled(id, enabled)
+            .await?;
+        Ok::<(), anyhow::Error>(())
+    }
+    .await;
+    if id == "aoe.web" && result.is_err() && crate::acp::client::discovery::discover_env().is_none()
+    {
+        result.map_err(crate::plugin::install::web_toggle_error)?;
+    } else {
+        result?;
+    }
     println!("{} {id}.", if enabled { "Enabled" } else { "Disabled" });
     Ok(())
 }
```

**File**: `src/cli/serve.rs` (modified, +48/-8)
```diff
@@ -182,7 +182,7 @@ pub struct ServeArgs {
     pub daemon_child: bool,
 
     /// Preserve missing defaults only during automatic read acquisition.
-    #[arg(long, hide = true, requires_all = ["daemon_child", "core_only"])]
+    #[arg(long, hide = true, requires = "daemon_child")]
     pub read_acquisition: bool,
 
     /// Restart the running managed daemon with its recorded policy.
@@ -209,7 +209,36 @@ pub struct ServeArgs {
     pub rollback: bool,
 }
 
+#[derive(Clone, Copy)]
+enum LaunchMode {
+    CoreOnly,
+    Tcp,
+}
+
 impl ServeArgs {
+    /// Fresh acquisition uses global service opt-ins; explicit serve and replay retain their mode.
+    fn resolve_launch(&mut self, requested: Option<LaunchMode>) -> Result<()> {
+        let mode = match requested {
+            Some(mode) => mode,
+            None => {
+                let config = crate::session::config::Config::load()?;
+                if config.web.mcp_enabled && !crate::cli::graft::web_disabled(&config) {
+                    LaunchMode::Tcp
+                } else {
+                    LaunchMode::CoreOnly
+                }
+            }
+        };
+        self.core_only = matches!(mode, LaunchMode::CoreOnly);
+        if !self.core_only {
+            self.passphrase = resolve_launch_passphrase(self.passphrase.take(), None, || {
+                std::env::var("AOE_SERVE_PASSPHRASE").ok()
+            });
+        }
+        self.cityhall = self.cityhall || std::env::var_os("AOE_CITYHALL_MODE").is_some();
+        Ok(())
+    }
+
     /// Resolve the port: explicit `--port` wins; otherwise 8081 in debug
     /// builds, 8080 in release. The `-dev` suffix on the app dir keeps
     /// state isolated, but two daemons cannot share a port, so the default
@@ -522,12 +551,12 @@ pub async fn lock_for_startup(profile: &str, args: &mut ServeArgs) -> Result<Opt
     } else {
         crate::daemon::lifecycle::Transaction::acquire().await?
     };
-    if !args.core_only {
-        args.passphrase = resolve_launch_passphrase(args.passphrase.take(), None, || {
-            std::env::var("AOE_SERVE_PASSPHRASE").ok()
-        });
-    }
-    args.cityhall = args.cityhall || std::env::var_os("AOE_CITYHALL_MODE").is_some();
+    let requested = if args.core_only {
+        LaunchMode::CoreOnly
+    } else {
+        LaunchMode::Tcp
+    };
+    args.resolve_launch(Some(requested))?;
     match daemon_status() {
         DaemonStatus::Verified(pid) if pid != std::process::id() => {
             transaction = migrate_managed_launch(transaction, false).await?;
@@ -1235,8 +1264,17 @@ pub(crate) fn web_daemon_pid() -> Option<u32> {
     (!managed_launch(pid).is_ok_and(|launch| launch.core_only)).then_some(pid)
 }
 
+/// Validate exposure and prerequisites before stopping a predecessor.
+/// Replacement callers retain the lifecycle transaction through successor startup.
 async fn validate_launch_args(profile: &str, args: &ServeArgs) -> Result<AuthMode> {
     crate::session::require_known_profile(profile)?;
+    if !args.core_only
+        && crate::cli::graft::web_disabled(&crate::session::config::Config::load_or_warn())
+    {
+        bail!(
+            "Web serving is disabled; run `aoe plugin enable aoe.web` before starting a TCP daemon"
+        );
+    }
     let auth_mode = if args.core_only {
         AuthMode::None
     } else {
@@ -1619,11 +1657,13 @@ pub(crate) async fn ensure_local_daemon(
         };
         let profile = resolved_profile.as_str();
         crate::session::require_known_profile(profile)?;
-        let cli = crate::cli::Cli::try_parse_from(["aoe", "serve", "--core-only", "--daemon"])?;
+        let cli = crate::cli::Cli::try_parse_from(["aoe", "serve", "--daemon"])?;
         let Some(crate::cli::Commands::Serve(mut args)) = cli.command else {
             unreachable!()
         };
         args.read_acquisition = native_profile.is_none();
+        args.resolve_launch(None)?;
+        validate_launch_args(profile, &args).await?;
         start_daemon(profile, &args, &transaction, false).await?;
         daemon_pid()
     } else {
```

**File**: `src/daemon/lifecycle.rs` (modified, +18/-6)
```diff
@@ -8,6 +8,10 @@ use fs2::FileExt;
 
 pub(crate) struct Transaction(File);
 
+#[derive(Debug, thiserror::Error)]
+#[error("Daemon lifecycle is busy; retry after the current transition finishes")]
+pub(crate) struct TransactionBusy;
+
 pub(crate) struct Lifetime {
     _file: File,
 }
@@ -40,12 +44,20 @@ fn open_lock(name: &str) -> Result<File> {
 }
 
 impl Transaction {
-    /// Acquire the transaction, giving up after `wait`.
-    ///
-    /// The only blocking acquisition: a daemon transition holds the lock for as
-    /// long as it takes to start or stop, so a caller needs a bound and a message
-    /// naming the transition that is in the way. Its only caller is the TUI key
-    /// handler, where an unbounded wait would freeze the whole UI.
+    /// Daemon mutations must not wait here: the transition may be waiting for
+    /// that same daemon to exit.
+    pub(crate) fn try_acquire() -> Result<Self> {
+        let file = open_lock("transaction.lock")?;
+        match file.try_lock_exclusive() {
+            Ok(()) => Ok(Self(file)),
+            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
+                Err(TransactionBusy.into())
+            }
+            Err(error) => Err(error.into()),
+        }
+    }
+
+    /// Bound synchronous TUI actions so lifecycle transitions cannot freeze the UI.
     pub(crate) fn acquire_blocking_for(wait: Duration) -> Result<Self> {
         let file = open_lock("transaction.lock")?;
         let deadline = Instant::now() + wait;
```

---

### Incident Patch 2: `460ac94b` (2026-11-07)
**Commit Message**: fix(acp): broadcast each session's events in seq order (#5416)

* fix(acp): broadcast each session's events in seq order

A seq was allocated and released before its event was published, so a
second publisher (the worker drain) could broadcast a later seq first. The
dashboard drops a frame whose seq is not above the last one it applied, so
it lost the earlier event: a prompt's UserPromptSent never settled its
in-flight id and Stop stayed after the turn ended.

publish_with_next_seq now allocates and publishes under the session's own
counter lock, replacing next_seq at every site. publish_stopped_if_seq
checks and publishes under the same lock.

Fixes #5377

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* test(acp): assert each publish runs under its session's seq lock

The racing-publisher test can only observe a blocked publisher through a
window. This one checks the lock directly: the sink try-locks the
session's counter during every broadcast, through publish_next, the prompt
and publish_stopped_if_seq.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(acp): publish under a session's seq counter off the async worker

A holder of the count

**File**: `src/acp/supervisor/drain.rs` (modified, +32/-26)
```diff
@@ -17,9 +17,9 @@ use super::launch::{
 };
 use super::teardown::{settle_sweeping_if_owed, tear_down_runner, wait_for_exit};
 use super::{
-    lock_recover, next_seq, BroadcastSink, Launcher, PendingContextReset, SeqMap, SharedSet,
-    Supervisor, SupervisorError, WorkerKind, Workers, MAX_RESPAWNS_IN_WINDOW, RESPAWN_BACKOFF,
-    RESTART_WINDOW,
+    lock_recover, publish_with_next_seq, BroadcastSink, Launcher, PendingContextReset, SeqMap,
+    SharedSet, Supervisor, SupervisorError, WorkerKind, Workers, MAX_RESPAWNS_IN_WINDOW,
+    RESPAWN_BACKOFF, RESTART_WINDOW,
 };
 use crate::acp::acp_client::{AcpError, SpawnConfig};
 use crate::acp::runner_lifecycle::{
@@ -112,8 +112,9 @@ enum RestartDecision {
 
 impl<S: BroadcastSink> Drain<S> {
     fn publish(&self, event: Event) {
-        let seq = next_seq(&self.next_seqs, &self.session_id);
-        self.sink.publish(&self.session_id, seq, &event);
+        publish_with_next_seq(&self.next_seqs, &self.session_id, |seq| {
+            self.sink.publish(&self.session_id, seq, &event)
+        });
     }
 
     async fn run(mut self, mut lease: Lease, mut inbound: mpsc::Receiver<Event>) {
@@ -181,14 +182,16 @@ impl<S: BroadcastSink> Drain<S> {
                 Event::AgentStartupError { .. } if !established => end.startup_failed = true,
                 Event::AcpSessionAssigned { acp_session_id } => {
                     if let Some(pending) = self.context_reset.take() {
-                        self.sink.publish_from_worker(
-                            &self.session_id,
-                            next_seq(&self.next_seqs, &self.session_id),
-                            &Event::SessionContextReset {
-                                reason: pending.reason,
-                            },
-                            generation,
-                        );
+                        publish_with_next_seq(&self.next_seqs, &self.session_id, |seq| {
+                            self.sink.publish_from_worker(
+                                &self.session_id,
+                                seq,
+                                &Event::SessionContextReset {
+                                    reason: pending.reason,
+                                },
+                                generation,
+                            )
+                        });
                         let id = self.session_id.clone();
                         let assigned = acp_session_id.clone();
                         let acknowledged = tokio::task::spawn_blocking(move || {
@@ -208,16 +211,18 @@ impl<S: BroadcastSink> Drain<S> {
                         };
                         if let Some(error) = failure {
                             end.startup_failed = true;
-                            self.sink.publish_from_worker(
-                                &self.session_id,
-                                next_seq(&self.next_seqs, &self.session_id),
-                                &Event::AgentStartupError {
-                                    message: format!(
-                                        "Could not commit the isolated native context: {error}"
-                                    ),
-                                },
-                                generation,
-                            );
+                            publish_with_next_seq(&self.next_seqs, &self.session_id, |seq| {
+                                self.sink.publish_from_worker(
+                                    &self.session_id,
+                                    seq,
+                                    &Event::AgentStartupError {
+                                        message: format!(
+                                            "Could not commit the isolated native context: {error}"
+                                        ),
+                                    },
+                                    generation,
+                                )
+                            });
                             let client = self
                                 .workers
                                 .lock()
@@ -274,10 +279,11 @@ impl<S: BroadcastSink> Drain<S> {
                 }
                 _ => {}
             }
-            let seq = next_seq(&self.next_seqs, &self.session_id);
             // Tagged so a frame queued by a replaced worker cannot mutate runtime state.
-            self.sink
-                .publish_from_worker(&self.session_id, seq, &event, generation);
+            publish_with_next_seq(&self.next_seqs, &self.session_id, |seq| {
+                self.sink
+                    .publish_from_worker(&self.session_id, seq, &event, generation)
+            });
         }
         end
     }
```

**File**: `src/acp/supervisor/mod.rs` (modified, +30/-7)
```diff
@@ -60,7 +60,8 @@ pub(crate) type Launcher = Arc<
 
 type Workers = Arc<Mutex<HashMap<String, WorkerHandle>>>;
 /// Per-session seq counter; outlives workers so every publisher shares one sequence.
-type SeqMap = std::sync::Mutex<HashMap<String, u64>>;
+/// Each session's last allocated seq, under its own lock so sessions publish independently.
+type SeqMap = std::sync::Mutex<HashMap<String, Arc<std::sync::Mutex<u64>>>>;
 type SharedSet = Arc<std::sync::Mutex<HashSet<String>>>;
 type RestartRequests = Arc<std::sync::Mutex<HashMap<String, (u64, CancellationToken)>>>;
 type SpawnRequests = Arc<std::sync::Mutex<SpawnRequestState>>;
@@ -606,7 +607,11 @@ impl<S: BroadcastSink> Supervisor<S> {
     /// Seed seq counters from the event store's stored maxima.
     pub fn hydrate_seqs(&self, pairs: impl IntoIterator<Item = (String, u64)>) {
         if let Ok(mut guard) = self.next_seqs.lock() {
-            guard.extend(pairs);
+            guard.extend(
+                pairs
+                    .into_iter()
+                    .map(|(id, seq)| (id, Arc::new(std::sync::Mutex::new(seq)))),
+            );
         }
     }
 
@@ -854,11 +859,29 @@ impl<S: BroadcastSink> Supervisor<S> {
     }
 }
 
-fn next_seq(next_seqs: &SeqMap, session_id: &str) -> u64 {
-    let mut guard = next_seqs.lock().unwrap_or_else(|e| e.into_inner());
-    let entry = guard.entry(session_id.to_string()).or_insert(0);
-    *entry = entry.saturating_add(1);
-    *entry
+fn session_seq(next_seqs: &SeqMap, session_id: &str) -> Arc<std::sync::Mutex<u64>> {
+    Arc::clone(
+        lock_recover(next_seqs)
+            .entry(session_id.to_string())
+            .or_default(),
+    )
+}
+
+/// Allocate the session's next seq and publish with it under that session's
+/// counter lock, so subscribers receive each session's events in seq order.
+/// `publish` must not allocate a seq for the same session.
+fn publish_with_next_seq<R>(
+    next_seqs: &SeqMap,
+    session_id: &str,
+    publish: impl FnOnce(u64) -> R,
+) -> R {
+    let counter = session_seq(next_seqs, session_id);
+    // A holder blocks on store I/O, so waiters and the holder both run off the async worker.
+    sink::blocking_io(|| {
+        let mut last = lock_recover(&counter);
+        *last = last.saturating_add(1);
+        publish(*last)
+    })
 }
 
 fn lock_recover<T>(m: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
```

**File**: `src/acp/supervisor/publish.rs` (modified, +113/-67)
```diff
@@ -3,7 +3,8 @@
 use tracing::info;
 
 use super::{
-    next_seq, BroadcastSink, PromptDisposition, PublishedPrompt, SeqMap, Supervisor, WorkerKind,
+    publish_with_next_seq, BroadcastSink, PromptDisposition, PublishedPrompt, SeqMap, Supervisor,
+    WorkerKind,
 };
 use crate::acp::approvals::ApprovalDecision;
 use crate::acp::elicitations::ElicitationOutcome;
@@ -12,9 +13,10 @@ use crate::acp::state::{BackgroundAgentStatus, Event};
 
 impl<S: BroadcastSink> Supervisor<S> {
     pub(super) fn publish_next(&self, session_id: &str, event: &Event) -> u64 {
-        let seq = next_seq(&self.next_seqs, session_id);
-        self.sink.publish(session_id, seq, event);
-        seq
+        publish_with_next_seq(&self.next_seqs, session_id, |seq| {
+            self.sink.publish(session_id, seq, event);
+            seq
+        })
     }
 
     /// Publish an `AgentStartupError` for a session whose worker never came online.
@@ -31,24 +33,22 @@ impl<S: BroadcastSink> Supervisor<S> {
         reason: &str,
         expected_seq: u64,
     ) -> bool {
-        let seq = {
-            let mut guard = super::lock_recover(&self.next_seqs);
-            let current = guard.get(session_id).copied().unwrap_or(0);
-            if current != expected_seq {
+        let counter = super::session_seq(&self.next_seqs, session_id);
+        super::sink::blocking_io(|| {
+            let mut last = super::lock_recover(&counter);
+            if *last != expected_seq {
                 return false;
             }
-            let seq = current.saturating_add(1);
-            guard.insert(session_id.to_string(), seq);
-            seq
-        };
-        self.sink.publish(
-            session_id,
-            seq,
-            &Event::Stopped {
-                reason: reason.to_string(),
-            },
-        );
-        true
+            *last = last.saturating_add(1);
+            self.sink.publish(
+                session_id,
+                *last,
+                &Event::Stopped {
+                    reason: reason.to_string(),
+                },
+            );
+            true
+        })
     }
 
     pub fn publish_agent_switched(
@@ -137,33 +137,38 @@ impl<S: BroadcastSink> Supervisor<S> {
             disposition,
             seq: None,
         };
-        let seq = next_seq(&self.next_seqs, session_id);
-        let mut refs = Vec::with_capacity(attachments.len());
-        for blob in attachments {
-            if !self.sink.record_attachment(session_id, seq, blob) {
+        let published = publish_with_next_seq(&self.next_seqs, session_id, |seq| {
+            let mut refs = Vec::with_capacity(attachments.len());
+            for blob in attachments {
+                if !self.sink.record_attachment(session_id, seq, blob) {
+                    self.sink.delete_attachments_for_seq(session_id, seq);
+                    return None;
+                }
+                refs.push(crate::daemon::PromptAttachmentRef {
+                    id: blob.id.clone(),
+                    kind: blob.kind,
+                    mime_type: blob.mime_type.clone(),
+                    name: blob.name.clone(),
+                    size: blob.data.len() as u64,
+                });
+            }
+            let event = Event::UserPromptSent {
+                text,
+                attachments: refs,
+                prompt_id,
+                synthesized,
+                origin_plugin,
+            };
+            if !self.sink.publish_persisted(session_id, seq, &event) {
+                // Roll back so refs never point at blobs that were not published.
                 self.sink.delete_attachments_for_seq(session_id, seq);
-                return unrecorded;
+                return None;
             }
-            refs.push(crate::daemon::PromptAttachmentRef {
-                id: blob.id.clone(),
-                kind: blob.kind,
-                mime_type: blob.mime_type.clone(),
-                name: blob.name.clone(),
-                size: blob.data.len() as u64,
-            });
-        }
-        let event = Event::UserPromptSent {
-            text,
-            attachments: refs,
-            prompt_id,
-            synthesized,
-            origin_plugin,
-        };
-        if !self.sink.publish_persisted(session_id, seq, &event) {
-            // Roll back so refs never point at blobs that were not published.
-            self.sink.delete_attachments_for_seq(session_id, seq);
+            Some(seq)
+        });
+        let Some(seq) = published else {
             return unrecorded;
-        }
+        };
         if is_clear && disposition == PromptDisposition::Forward {
             self.publish_next(session_id, &Event::SessionCleared);
         }
@@ -242,14 +247,16 @@ pub(super) fn detach_orphaned_background_agents_on<S: BroadcastSink>(
     warning: &str,
 ) {
     for task_id in sink.unresolved_background_task_ids(session_id) {
-        sink.publish(
-            session_id,
-            ne
```

**File**: `src/acp/supervisor/sink.rs` (modified, +2/-2)
```diff
@@ -124,8 +124,8 @@ impl BroadcastSink for ChannelSink {
     }
 }
 
-/// Run store I/O via `block_in_place` on a multi-thread runtime, inline elsewhere.
-fn blocking_io<T>(f: impl FnOnce() -> T) -> T {
+/// Run blocking work via `block_in_place` on a multi-thread runtime, inline elsewhere.
+pub(super) fn blocking_io<T>(f: impl FnOnce() -> T) -> T {
     match tokio::runtime::Handle::try_current().map(|h| h.runtime_flavor()) {
         Ok(tokio::runtime::RuntimeFlavor::MultiThread) => tokio::task::block_in_place(f),
         _ => f(),
```

**File**: `src/acp/supervisor/teardown.rs` (modified, +61/-47)
```diff
@@ -171,14 +171,16 @@ fn finish_stop_completion<S: BroadcastSink>(sink: &S, seqs: &super::SeqMap, leas
     {
         let id = lease.session_id();
         for task_id in sink.unresolved_background_task_ids(id) {
-            if !sink.publish_persisted(
-                id,
-                super::next_seq(seqs, id),
-                &Event::BackgroundTaskFinished {
-                    task_id,
-                    ended_at: Some(chrono::Utc::now()),
-                },
-            ) {
+            if !super::publish_with_next_seq(seqs, id, |seq| {
+                sink.publish_persisted(
+                    id,
+                    seq,
+                    &Event::BackgroundTaskFinished {
+                        task_id,
+                        ended_at: Some(chrono::Utc::now()),
+                    },
+                )
+            }) {
                 return false;
             }
         }
@@ -191,12 +193,16 @@ fn finish_stop_completion<S: BroadcastSink>(sink: &S, seqs: &super::SeqMap, leas
                 warning: None,
                 ended_at: chrono::Utc::now(),
             };
-            if !sink.publish_persisted(id, super::next_seq(seqs, id), &event) {
+            if !super::publish_with_next_seq(seqs, id, |seq| {
+                sink.publish_persisted(id, seq, &event)
+            }) {
                 return false;
             }
         }
         if let Some(reason) = debt.reason {
-            if !sink.publish_persisted(id, super::next_seq(seqs, id), &Event::Stopped { reason }) {
+            if !super::publish_with_next_seq(seqs, id, |seq| {
+                sink.publish_persisted(id, seq, &Event::Stopped { reason })
+            }) {
                 return false;
             }
         }
@@ -331,41 +337,47 @@ impl<S: BroadcastSink> Supervisor<S> {
             return Err(SupervisorError::TeardownPending(session_id.to_owned()));
         }
         for task_id in self.sink.unresolved_background_task_ids(session_id) {
-            if !self.sink.publish_persisted(
-                session_id,
-                super::next_seq(&self.next_seqs, session_id),
-                &Event::BackgroundTaskFinished {
-                    task_id,
-                    ended_at: Some(chrono::Utc::now()),
-                },
-            ) {
+            if !super::publish_with_next_seq(&self.next_seqs, session_id, |seq| {
+                self.sink.publish_persisted(
+                    session_id,
+                    seq,
+                    &Event::BackgroundTaskFinished {
+                        task_id,
+                        ended_at: Some(chrono::Utc::now()),
+                    },
+                )
+            }) {
                 return Err(SupervisorError::TeardownPending(session_id.to_owned()));
             }
         }
         for agent_id in self.sink.unresolved_background_agent_ids(session_id) {
-            if !self.sink.publish_persisted(
-                session_id,
-                super::next_seq(&self.next_seqs, session_id),
-                &Event::BackgroundAgentCompleted {
-                    agent_id,
-                    status: BackgroundAgentStatus::Detached,
-                    tools: Vec::new(),
-                    result: None,
-                    warning: None,
-                    ended_at: chrono::Utc::now(),
-                },
-            ) {
+            if !super::publish_with_next_seq(&self.next_seqs, session_id, |seq| {
+                self.sink.publish_persisted(
+                    session_id,
+                    seq,
+                    &Event::BackgroundAgentCompleted {
+                        agent_id,
+                        status: BackgroundAgentStatus::Detached,
+                        tools: Vec::new(),
+                        result: None,
+                        warning: None,
+                        ended_at: chrono::Utc::now(),
+                    },
+                )
+            }) {
                 return Err(SupervisorError::TeardownPending(session_id.to_owned()));
             }
         }
         if !stopped_already_persisted
-            && !self.sink.publish_persisted(
-                session_id,
-                super::next_seq(&self.next_seqs, session_id),
-                &Event::Stopped {
-                    reason: "user_stopped".to_owned(),
-                },
-            )
+            && !super::publish_with_next_seq(&self.next_seqs, session_id, |seq| {
+                self.sink.publish_persisted(
+                    session_id,
+                    seq,
+                    &Event::Stopped {
+                        reason: "user_stopped".to_owned(),
+                    },
+                )
+            })
         {
             return Err(SupervisorError::TeardownPending(session_id.to_owned()));
         }
@@ -1834,16 +1846,18 @@ mod tests {
             id,
             &crate::acp::state::test_support::prompt("replacement turn"),
         );
-        p.sup.sink.inner.publish(
-   
```

---

### Incident Patch 3: `75b33e90` (2026-11-07)
**Commit Message**: fix(tui): inspect trash transcripts read-only (#5143)

* fix(tui): inspect trash transcripts read-only

* fix(tui): close remaining trash input paths

* fix(tui): fence stale trash continuations

* perf(tui): avoid retained replay remerge

* fix(tui): fence stale dialogs and preview input

Bind pending session dialogs to their opening identity so snapshots
cannot retarget edits. Refuse stale preview owners and revoked native
grants, and cancel gestures when their target changes.

Keep terminal permission delivery under the existing lifecycle input
lock. Backend lifecycle refusals remain unchanged.

* fix(tui): preserve state across retained replay pages

Fold raw retained events through one reducer so page boundaries cannot
merge replies or discard tool output and removals. Detect unavailable
sequence ranges even when old metadata remains pinned.

Keep live raw reset and active row replay behavior unchanged.

* fix(tui): reject stale trash confirmations

Bind confirmations to their original profile and lifecycle generation,
independent of sidebar selection. Cancel stale targets before submission
and check generation under the daemon lifecycle lock before reservation
and pane teardo

**File**: `docs/api.md` (modified, +23/-0)
```diff
@@ -831,6 +831,29 @@ selection. `drop_failed` removes the row only after a forced failure for the sam
 selection; it retains worktree files. Restore or a new lifecycle generation
 invalidates the failure marker.
 
+## POST /api/sessions/{id}/trash
+
+Move a session to Trash. Optional JSON fields:
+
+| Field | Default | Meaning |
+| --- | --- | --- |
+| `kill_pane` | `true` | Stop the session's terminal panes during the transition. |
+| `expected_generation` | omitted | Require the selected session's `lifecycle_generation`; a mismatch returns `409 lifecycle_superseded` without mutation. |
+
+Repeating a completed request for an already-trashed session succeeds without
+repeating teardown or relocation. A fresh lifecycle reservation returns
+`409 lifecycle_locked` rather than acknowledging an unfinished transition.
+Generation preconditions are checked before the already-trashed state.
+Restore and Purge return `409 trash_incomplete` while a Trash outcome remains
+unconfirmed. Retry `POST /api/sessions/{id}/trash`, or use `aoe rm <id>`, before
+another lifecycle action.
+For an unfinished Trash transition, `aoe rm <id>` retries Trash even when
+`session.delete_to_trash` is disabled. `--purge` never performs this recovery.
+A terminal teardown or relocation failure leaves the session in Trash without
+preventing explicit Restore or Purge. A retry also settles the transition when
+all known worktree paths are proven absent. Unverified existing paths, unknown
+original locations, and filesystem lookup errors keep the transition protected.
+
 ## Explicit structured worker stop
 
 `DELETE /api/sessions/:id/acp` is a durable user stop, not a daemon detach. It commits the native stopped/dormant generation before retiring the captured original worker and returns `204` only after retirement is proven. Generic `POST /api/sessions/:id/stop` uses the same structured-worker stop boundary.
```

**File**: `docs/development/internals/structured-view.md` (modified, +5/-0)
```diff
@@ -102,6 +102,11 @@ only still-open tools once. Turn endings discard orphaned output; metadata
 alone does not reopen completed or elicited tools. After broadcast lag, both
 projections rebuild from retained history before processing queued frames.
 
+Trash inspection orders unfinished snapshots by their first content event rather
+than tool start order. Replacement snapshots keep that order. Turn endings move
+orphan snapshots into read-only history without inventing stopped rows or feeding
+that output into subsequent tool invocations.
+
 Raw event frames still stream for what the daemon does not model (worker lifecycle latches, monitor and wakeup badges, the usage cost baseline, rejected prompts). A client reading only the projections passes `?frames=0`, as the native view does. A `notice` row carries a failed startup, a dead turn, a refused mode switch, or an auto-resume; the native view renders it inline while the web shows the same information as a dismissible banner.
 
 The daemon also owns prompt dispatch: `POST /acp/prompt` runs `acp::dispatch::decide` and returns `sent`, `steered`, or `queued`, and the server-owned queue persists follow-ups until its turn-end drain. Cancelling and compacting turns always queue; a dormant worker is sent the prompt so the request wakes it.
```

**File**: `docs/structured-view.md` (modified, +41/-0)
```diff
@@ -152,6 +152,47 @@ Non-ACP tools always run in the terminal view.
 
 See the [local Daemon workflow](quick-start.md#launch-the-tui) for startup, shutdown, and recovery. Structured sidebar statuses arrive through the runtime WebSocket. Reconnecting restores live state.
 
+### Inspecting Trash in the TUI
+
+Select a session in the expanded **Trash** section to read its retained ACP
+transcript. Inspection never starts an agent or prepares a terminal or tool pane,
+regardless of the session's current view or click preference.
+
+Scroll with the mouse wheel. Without reader focus, use **Earlier/Later** in the
+footer or **Shift+PageUp/PageDown**. Press **Enter** to focus the reader and use
+**Up/Down**, **PageUp/PageDown**, and **Home/End**. Drag over text to copy it.
+**Esc** returns to the session list. Restore and permanent deletion remain
+separate management actions shown in the footer.
+
+Opening **System Health** releases reader keyboard focus. Press **Enter** to
+return to the selected Trash transcript.
+
+Tool arguments, structured changes, and retained text output are shown without
+the active view's preview limits, including successful calls. Scroll and drag to
+copy their full retained text. Media stays represented by descriptive placeholders.
+Text retained before a media-only completion remains readable beside those
+placeholders.
+Unfinished text snapshots remain readable even when their start or completion
+event is unavailable. They are labeled **completion unavailable**, not marked
+successful or stopped. Wrapping and copy preserve painted Unicode graphemes.
+
+The reader refreshes available content automatically and preserves focus and
+scroll position. Read failures keep the last loaded content visible with an
+error. Content, size, or theme changes clear the previous text selection.
+Reopen the reader after in-place edits to already retained events.
+
+Dialogs close when their target session changes or disappears. Trash context
+menus reject actions if the original session, profile, or lifecycle generation
+changes. Restore and permanent deletion never target a replacement selection.
+
+The reader shows retained ACP history, including events
+recorded before a switch to terminal view. Missing or unreadable event ranges
+trigger a global incomplete-history warning, even when no readable transcript
+rows remain. The reader does not import native agent history files: their formats
+and availability vary by agent and execution environment.
+Missing content and read failures are shown without restarting the agent.
+Destroyed tmux scrollback cannot be recovered by this reader.
+
 ### Launch command and session naming
 
 `--cmd <tool>` uses `session.agent_command_override`, preserving required ACP arguments, such as `opencode acp`. Adapter-backed agents use `session.agent_acp_cmd` for a full command swap. The wizard displays the resolved command read-only.
```

**File**: `src/acp/client/http.rs` (modified, +421/-12)
```diff
@@ -40,6 +40,23 @@ pub struct PluginCommandView {
     pub action: Option<aoe_plugin_api::ClientAction>,
 }
 
+#[derive(Clone, Copy)]
+enum ReplayKind {
+    Live,
+    Rows,
+    Retained,
+}
+
+#[derive(Debug)]
+pub(crate) struct RetainedReplay {
+    pub transcript: crate::acp::transcript::RetainedTranscript,
+    /// The first page's cap, not a later page's maximum.
+    pub highest_seq: u64,
+    /// Inclusive ranges of successfully folded sequence numbers.
+    pub coverage: Vec<(u64, u64)>,
+    pub incomplete: bool,
+}
+
 #[derive(serde::Deserialize)]
 struct PluginCommandsEnvelope {
     commands: Vec<PluginCommandView>,
@@ -170,33 +187,39 @@ impl HttpClient {
         decode_replay(res).await
     }
 
-    /// Fold replay pages through the first page's snapshot window. Lost pages
-    /// are consumed before stopping, so callers can reset using the same data.
+    /// Live replay stops for reset after loss; retained replay keeps reading.
     async fn replay_pages(
         &self,
         session_id: &str,
         since: u64,
         page_size: u64,
-        view_rows: bool,
-        mut consume: impl FnMut(ReplayResponse),
+        kind: ReplayKind,
+        mut consume: impl FnMut(ReplayResponse, u64),
     ) -> Result<(u64, Option<u64>, bool), HttpError> {
         let mut cursor = since;
         let mut target = None;
+        let mut any_lost = false;
         loop {
-            let page = if view_rows {
+            let page = if matches!(kind, ReplayKind::Rows) {
                 self.replay_rows_page(session_id, cursor, page_size).await?
             } else {
                 self.replay_page(session_id, cursor, page_size).await?
             };
             let cap = *target.get_or_insert(page.highest_seq);
             let (highest_seq, lowest_seq, lost) = (page.highest_seq, page.lowest_seq, page.lost);
+            any_lost |= lost;
             let (next_cursor, has_more) = (page.next_cursor, page.has_more);
-            consume(page);
+            consume(page, cap);
             match next_cursor {
-                Some(next) if !lost && has_more && next > cursor && next < cap => {
+                Some(next)
+                    if (!lost || !matches!(kind, ReplayKind::Live))
+                        && has_more
+                        && next > cursor
+                        && next < cap =>
+                {
                     cursor = next;
                 }
-                _ => return Ok((highest_seq, lowest_seq, lost)),
+                _ => return Ok((highest_seq, lowest_seq, any_lost)),
             }
         }
     }
@@ -211,7 +234,7 @@ impl HttpClient {
     ) -> Result<ReplayResponse, HttpError> {
         let mut frames = Vec::new();
         let (highest_seq, lowest_seq, lost) = self
-            .replay_pages(session_id, since, page_size, false, |page| {
+            .replay_pages(session_id, since, page_size, ReplayKind::Live, |page, _| {
                 frames.extend(page.frames);
             })
             .await?;
@@ -246,8 +269,8 @@ impl HttpClient {
         decode_replay(res).await
     }
 
-    /// Reconcile server-folded rows by ID across page seams, using the same
-    /// snapshot cap and retention-gap handling as raw replay.
+    /// Reconcile server-folded rows by ID across page seams, retaining the
+    /// snapshot cap and reporting gaps without dropping later retained pages.
     pub async fn replay_rows_paged(
         &self,
         session_id: &str,
@@ -256,7 +279,7 @@ impl HttpClient {
     ) -> Result<(Vec<crate::acp::transcript::TranscriptRow>, bool), HttpError> {
         let mut rows = Vec::new();
         let (_, _, lost) = self
-            .replay_pages(session_id, since, page_size, true, |page| {
+            .replay_pages(session_id, since, page_size, ReplayKind::Rows, |page, _| {
                 if let Some(page_rows) = page.rows {
                     for row in page_rows {
                         crate::acp::transcript::upsert_transcript_row(&mut rows, row);
@@ -267,6 +290,51 @@ impl HttpClient {
         Ok((rows, lost))
     }
 
+    /// Fold retained raw events once, preserving reducer state across pages.
+    pub(crate) async fn replay_retained_paged(
+        &self,
+        session_id: &str,
+        page_size: u64,
+    ) -> Result<RetainedReplay, HttpError> {
+        let mut model = crate::acp::transcript::TranscriptModel::new();
+        let mut last_seen = 0;
+        let mut snapshot_highest = 0;
+        let mut incomplete = false;
+        let mut coverage: Vec<(u64, u64)> = Vec::new();
+        let (_, _, reported_lost) = self
+            .replay_pages(
+                session_id,
+                0,
+                page_size,
+                ReplayKind::Retained,
+                |page, cap| {
+                    snapshot_highest = cap;
+                    for frame in page.frames {
+                        if frame.seq <= last_seen || frame.seq > cap {
+                            continue;
+     
```

**File**: `src/acp/session_paths.rs` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 //! Display helpers for session-scoped file paths.
 
-#[derive(Debug, Clone)]
+#[derive(Debug, Clone, PartialEq, Eq)]
 pub struct SessionPathRoots {
     pub id: String,
     pub project_path: String,
@@ -48,7 +48,7 @@ impl From<crate::daemon::SessionResponse> for SessionViewInfo {
     }
 }
 
-#[derive(Debug, Clone)]
+#[derive(Debug, Clone, PartialEq, Eq)]
 pub struct WorkspaceRepoRoot {
     pub name: String,
     pub source_path: String,
```

**File**: `src/acp/transcript.rs` (modified, +299/-22)
```diff
@@ -110,17 +110,49 @@ fn session_notice_text(severity: &str, title: &str, description: &Option<String>
     }
 }
 
+#[derive(Debug, Default)]
+pub(crate) struct RetainedTranscript {
+    pub rows: Vec<TranscriptRow>,
+    pub unfinished_outputs: Vec<UnfinishedToolOutput>,
+}
+
+#[derive(Debug, Clone)]
+pub(crate) struct UnfinishedToolOutput {
+    pub tool_call_id: String,
+    pub text: String,
+    first_seq: u64,
+}
+
+#[derive(Debug, Clone, Default)]
+struct BufferedToolOutput {
+    first_seq: Option<u64>,
+    text: String,
+}
+
+impl BufferedToolOutput {
+    fn into_unfinished(self, tool_call_id: &str) -> Option<UnfinishedToolOutput> {
+        if self.text.is_empty() {
+            return None;
+        }
+        Some(UnfinishedToolOutput {
+            tool_call_id: tool_call_id.to_owned(),
+            text: self.text,
+            first_seq: self.first_seq?,
+        })
+    }
+}
+
 /// Projection lifecycle is independent of whether its start row is in this page.
 #[derive(Debug, Clone)]
 enum ToolLifecycle {
-    Buffered(String),
-    Open(String),
-    Terminal(String),
+    Buffered(BufferedToolOutput),
+    Open(BufferedToolOutput),
+    Terminal(BufferedToolOutput),
 }
 
 impl ToolLifecycle {
-    fn finish(&mut self) -> String {
-        match std::mem::replace(self, Self::Terminal(String::new())) {
+    fn finish(&mut self) -> BufferedToolOutput {
+        match std::mem::replace(self, Self::Terminal(BufferedToolOutput::default())) {
             Self::Buffered(output) | Self::Open(output) | Self::Terminal(output) => output,
         }
     }
@@ -133,6 +165,8 @@ pub struct TranscriptModel {
     row_ids: HashSet<String>,
     /// Tool lifecycle and buffered output, in opening order, including skipped starts.
     tools: IndexMap<String, ToolLifecycle>,
+    /// Orphan snapshots remain readable but never feed subsequent tool invocations.
+    retained_orphans: Vec<UnfinishedToolOutput>,
     /// Tool calls surfaced as an elicitation (AskUserQuestion); their cards are suppressed.
     elicitation_tool_ids: HashSet<String>,
     /// Group of the still-open run of consecutive message chunks.
@@ -163,6 +197,32 @@ impl TranscriptModel {
         &self.rows
     }
 
+    pub fn into_rows(self) -> Vec<TranscriptRow> {
+        self.rows
+    }
+
+    pub(crate) fn into_retained(self) -> RetainedTranscript {
+        let mut unfinished_outputs: Vec<_> = self
+            .tools
+            .into_iter()
+            .filter_map(|(tool_call_id, lifecycle)| {
+                let (ToolLifecycle::Buffered(output)
+                | ToolLifecycle::Open(output)
+                | ToolLifecycle::Terminal(output)) = lifecycle;
+                if self.elicitation_tool_ids.contains(&tool_call_id) {
+                    return None;
+                }
+                output.into_unfinished(&tool_call_id)
+            })
+            .chain(self.retained_orphans)
+            .collect();
+        unfinished_outputs.sort_unstable_by_key(|output| output.first_seq);
+        RetainedTranscript {
+            rows: self.rows,
+            unfinished_outputs,
+        }
+    }
+
     pub fn last_seq(&self) -> u64 {
         self.last_seq
     }
@@ -193,6 +253,8 @@ impl TranscriptModel {
             Event::ElicitationRequested { elicitation } => {
                 if let Some(id) = &elicitation.tool_call_id {
                     self.elicitation_tool_ids.insert(id.clone());
+                    self.retained_orphans
+                        .retain(|output| output.tool_call_id != *id);
                     self.finish_tool(id);
                 }
             }
@@ -216,8 +278,12 @@ impl TranscriptModel {
             | Event::AgentStartupError { .. }
             | Event::IncompatibleAgent { .. }
             | Event::AgentSwitched { .. } => {
-                for tool in self.tools.values_mut() {
-                    if matches!(tool, ToolLifecycle::Buffered(_) | ToolLifecycle::Open(_)) {
+                for (id, tool) in &mut self.tools {
+                    if matches!(tool, ToolLifecycle::Buffered(_)) {
+                        if let Some(output) = tool.finish().into_unfinished(id) {
+                            self.retained_orphans.push(output);
+                        }
+                    } else if matches!(tool, ToolLifecycle::Open(_)) {
                         drop(tool.finish());
                     }
                 }
@@ -395,6 +461,8 @@ impl TranscriptModel {
                     return Vec::new();
                 };
                 self.elicitation_tool_ids.insert(tool_call_id.clone());
+                self.retained_orphans
+                    .retain(|output| output.tool_call_id != *tool_call_id);
                 self.finish_tool(tool_call_id);
                 self.remove_rows_for_tool(tool_call_id)
             }
@@ -559,13 +627,15 @@ impl TranscriptModel {
                 Some(index)
             }
             Some((index, _, tool @ ToolLifecycle::Terminal(_))) if reopen_term
```

**File**: `src/cli/remove.rs` (modified, +17/-2)
```diff
@@ -72,9 +72,24 @@ pub async fn run(profile: &str, args: RemoveArgs) -> Result<()> {
 
     let title = &session.title;
     let id = &session.id;
-    if session.cleanup_defaults.delete_to_trash && !args.purge {
+    let retrying_trash = session.trashed_at.is_some()
+        && session
+            .lifecycle_reservation
+            .as_ref()
+            .is_some_and(|reservation| {
+                reservation.op == crate::session::LifecycleOperation::Trash
+                    && reservation.generation == session.lifecycle_generation
+            });
+    if !args.purge && (session.cleanup_defaults.delete_to_trash || retrying_trash) {
         let receipt = daemon
-            .trash_session(id, &TrashSessionBody::default(), &info.epoch)
+            .trash_session(
+                id,
+                &TrashSessionBody {
+                    expected_generation: retrying_trash.then_some(session.lifecycle_generation),
+                    ..Default::default()
+                },
+                &info.epoch,
+            )
             .await?;
         trash_result(receipt.outcome.relocation, title)?;
         println!("  Moved session to trash: {title} (from profile '{profile}')");
```

**File**: `src/cli/session.rs` (modified, +49/-5)
```diff
@@ -484,17 +484,27 @@ async fn archive_session(profile: &str, args: ArchiveArgs) -> Result<()> {
     let _lifecycle_lock = storage
         .acquire_instance_lifecycle_lock(&id)
         .context("failed to acquire instance archive lock")?;
+    let inst = storage
+        .load()?
+        .into_iter()
+        .find(|row| row.id == id)
+        .context("session disappeared before archive")?;
+    anyhow::ensure!(
+        !inst.has_pending_trash(),
+        crate::session::LifecycleReservationError::Busy(crate::session::LifecycleOperation::Trash)
+    );
     if !args.no_kill {
-        let inst = storage
-            .load()?
-            .into_iter()
-            .find(|row| row.id == id)
-            .context("session disappeared before archive")?;
         inst.kill_all_tmux_sessions_locked()?;
     }
 
     let landed = storage.update(|instances, _groups| {
         if let Some(stored) = instances.iter_mut().find(|i| i.id == id) {
+            anyhow::ensure!(
+                !stored.has_pending_trash(),
+                crate::session::LifecycleReservationError::Busy(
+                    crate::session::LifecycleOperation::Trash
+                )
+            );
             stored.archive();
             stored.lifecycle_generation = stored.lifecycle_generation.saturating_add(1);
             Ok(true)
@@ -3356,6 +3366,40 @@ mod session_mutation_tests {
             .unwrap()
     }
 
+    #[tokio::test]
+    #[serial]
+    async fn archive_preserves_unfinished_trash_before_teardown() {
+        let _home = crate::session::test_support::isolate_app_dir();
+        let mut row = Instance::new("unfinished trash", "/tmp/unfinished-trash");
+        row.try_acquire_lifecycle_reservation(
+            crate::session::LifecycleOperation::Trash,
+            Instance::LIFECYCLE_RESERVATION_TTL,
+            chrono::Utc::now() - Instance::LIFECYCLE_RESERVATION_TTL - chrono::Duration::seconds(1),
+        )
+        .unwrap();
+        row.trash();
+        let (storage, id) = seed("archive-debt", row);
+        let before = std::fs::read(storage.sessions_path()).unwrap();
+        for no_kill in [false, true] {
+            let error = super::archive_session(
+                "archive-debt",
+                super::ArchiveArgs {
+                    identifier: id.clone(),
+                    no_kill,
+                },
+            )
+            .await
+            .unwrap_err();
+            assert!(matches!(
+                error.downcast_ref::<crate::session::LifecycleReservationError>(),
+                Some(crate::session::LifecycleReservationError::Busy(
+                    crate::session::LifecycleOperation::Trash
+                ))
+            ));
+            assert_eq!(std::fs::read(storage.sessions_path()).unwrap(), before);
+        }
+    }
+
     #[tokio::test]
     #[serial]
     async fn set_session_id_replaces_intent_and_clears_the_resume_probe_marker() {
```

#### Recent Merged Pull Requests:
- **PR #5480** (2026-11-08): ci: run RunsOn jobs on the m8a family (@Seluj78)
- **PR #5479** (2026-11-08): ci: give each RunsOn job a unique runner label (@Seluj78)
- **PR #5478** (2026-11-08): chore: release v1.22.2 (@njbrake)
- **PR #5476** (2026-11-08): test(web): keep cached history stable during catch-up (@kaimo455)
- **PR #5474** (2026-11-08): fix(acp): release the local prompt waiter when the cost-orphan grace ends a turn (@cwrau)
- **PR #5473** (2026-11-08): fix(core): keep idle auto-stop from killing a newly admitted prompt (@cwrau)

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

## X. daemon): honor configured services during autostart (#5283)

**RULE**:
When implementing operations in `.github/workflows/tests.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d105f7a`: daemon): honor configured services during autostart (#5283). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/tests.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      # Run Web-only regressions omitted by core-rest. Keep e2e-tests to reuse
      # this leg's artifacts, and filter library tests instead of rerunning
      # the full suite.
            server::assets:: tui::dialogs::serve::qr_seam \
            session::config::tests::web_plugin_changes_do_not_cross_lifecycle_transactions
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
      # The `web`-gated test code runs nowhere else: core-rest builds at
      # default features and the step above names only the e2e target. Both
      # halves need naming. The integration blocks are the dashboard-route half
      # of daemon_core_web_optional and the aoe.web builtin assertion in
      # plugin_install; the lib-level ones are src/server/assets.rs (the whole
      # module is `web`-gated) and the QR seam in src/tui/dialogs/serve.rs,
      # which would otherwise be neither compiled nor run on a PR. Keep
      # `e2e-tests` on so the feature set matches the step above and cargo
      # reuses its artifacts instead of rebuilding the crate; filter the lib run
      # so it does not re-run the whole suite core-rest already covers.
            server::assets:: tui::dialogs::serve::qr_seam
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d105f7a` are properly handled with clean fallback behavior.
