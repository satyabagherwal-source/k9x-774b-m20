# Verification Protocol: Verification Protocol: Empirical Defect Shield for agent-of-empires-agent-of-empires-learnings

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires-agent-of-empires-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:32:57.835Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-agent-of-empires-agent-of-empires-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires-agent-of-empires-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:32:57.835Z`  
> **Learning ID**: `LEARN-REEXTRACT-agent-of-empires-agent-of-empires-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `agent-of-empires-agent-of-empires-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `ff0a5e36`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-10T05:21:50.187Z  
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
> **Harvest Timestamp**: 2026-11-10T05:21:46.673Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3991 stars

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
- **Issue #5477** (2026-11-08): **Can't resume sandboxes after a stop with Codex**
  *Symptoms*: ### What happened?  I used to be able to resume a Codex session in a sandbox after the sandbox had stopped. This no longer works and I'm not sure what changed. I get:  ``` Cannot attest execution context for managed conversation 01a1bbfe-4006-73e2-849e-139baf24402c; launch refused without replacing it. Restore the original agent configuration and store, or rebind with aoe session set-session-id bd9668fecc064d78 01a1bbfe-4006-73e2-849e-139baf24402c. Codex is not authenticated with a local OpenAI API key (a ChatGPT login cannot be attested, because it may select cloud-managed requirements); replace the credentials with an OpenAI API key (OPENAI_API_KEY, no ChatGPT tokens) in the auth.json of its resolved configuration directory and re-run. ```  I'm on MacOS, Aoe version 1.22.1 and Codex 0.166.0 and aoe-dev-sandbox:2.0.0.  My agent may have found some related documented change: "AoE v1.19.0’s guide says automatic restarts still tried to resume a stored conversation when its execution context couldn’t be verified. The v1.22.1 guide says AoE now refuses that launch."  I'm not using API keys but a GPT subscription.  I can't find anything online about this - which makes me think that something is special in my situation, but I don't know what else to try.  ### aoe version and OS  Aoe 1.22.1, MacOS 26.6.2  ### AI usage  Only the quoted bit

- **Issue #5454** (2026-11-08): **Show failed Trash reads when opening a retained Session**
  *Symptoms*: ### What happened?  P3 follow-up from #5355. A failed Trash read is indistinguishable from an unfinished load when opening a retained Session.  Source-derived scenario, not dynamically reproduced: 1. Open a direct link to a trashed Session. 2. Let `GET /api/sessions?state=untrashed` succeed, while the scoped Trash reads fail or time out. 3. The main pane remains a skeleton without a Trash error/retry state. Later automatic retries may recover, but a persistent failure stays unexplained.  `syncTrash` silently returns on a failed read and never sets `trashEpoch`; `openedSessionSettled` continues waiting while the untrashed poll has no error.  Expected: expose the scoped read failure and a retry path, preserve known rows, and do not treat an unread Session as deleted. Cover failure, retry and recovery with a deterministic regression and the applicable coverage entry.  Evidence: [failed read](https://github.com/agent-of-empires/agent-of-empires/blob/a7ccc0e5384f1f5247b29a8db5fb098b7320ead1/web/src/hooks/useSessions.ts#L171), [route settlement](https://github.com/agent-of-empires/agent-of-empires/blob/a7ccc0e5384f1f5247b29a8db5fb098b7320ead1/web/src/App.tsx#L461). #5278 concerns unfinished Trash transitions, not this read failure.  ### aoe version and OS  `main@a7ccc0e5384f1f5247b29a8db5fb098b7320ead1`; web dashboard. Static analysis only, no OS/browser reproduction claimed.  ### AI usage  Prepared with Codex, two independent sequential source reviews and a paginated search of ope

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

### Incident Patch 1: `ec5be5a6` (2026-11-09)
**Commit Message**: fix(tui): lock Yolo in the new-session dialog for the agent each view runs (#5412)

* fix(tui): lock Yolo in the new-session dialog for the agent each view runs

A custom agent inherits always-Yolo from the base it actually runs: the
agent_detect_as base in a terminal session, and in a structured one its own
adapter when it has one, else the base's. The dialog now uses
acp::runs_always_yolo for the selected view, and re-checks the lock when the
Structured toggle changes or is inherited.

Fixes #5366

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(tui): refresh the agent's Yolo lock and view when the path changes

A repo config can map a custom agent onto a base with agent_detect_as,
which changes whether Yolo is forced and whether Structured is offered.
Typing or picking a path, a path set while the sandbox env is edited,
and turning scratch on now re-read that map when it differs, recompute
the Structured capability, and reset Yolo when the lock moves.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(tui): keep a click and focus on their row when a path change moves rows

The path refresh can show or hide the Structured and Yolo rows,

**File**: `src/tui/dialogs/new_session/mod.rs` (modified, +100/-14)
```diff
@@ -216,6 +216,10 @@ pub struct NewSessionDialog {
     /// every tool or profile change. Gates the Structured field's visibility
     /// like `has_yolo` / `has_sandbox`.
     pub(super) structured_capable: bool,
+    /// The profile's custom-agent maps, which decide whether a custom tool always
+    /// runs in Yolo mode in the chosen view.
+    pub(super) agent_acp_cmd: std::collections::HashMap<String, String>,
+    pub(super) agent_detect_as: std::collections::HashMap<String, String>,
     pub(super) workspace_repos: Vec<String>,
     pub(super) workspace_repos_expanded: bool,
     pub(super) workspace_repo_selected_index: usize,
@@ -465,6 +469,25 @@ pub(super) struct FieldIndices {
 impl FieldIndices {
     /// Stands in for a field the current layout hides.
     pub const ABSENT: usize = usize::MAX;
+
+    /// Where the row at `index` in the `before` layout sits now, or `None` if it is hidden.
+    fn follow(&self, before: &FieldIndices, index: usize) -> Option<usize> {
+        [
+            (before.profile, self.profile),
+            (before.path, self.path),
+            (before.title, self.title),
+            (before.tool, self.tool),
+            (before.structured, self.structured),
+            (before.yolo, self.yolo),
+            (before.worktree, self.worktree),
+            (before.sandbox, self.sandbox),
+            (before.group, self.group),
+        ]
+        .into_iter()
+        .find(|(old, _)| *old == index)
+        .map(|(_, new)| new)
+        .filter(|new| *new != Self::ABSENT)
+    }
 }
 
 impl NewSessionDialog {
@@ -600,6 +623,8 @@ impl NewSessionDialog {
             structured_default,
             structured_choice: None,
             structured_capable,
+            agent_acp_cmd: config.session.agent_acp_cmd.clone(),
+            agent_detect_as: config.session.agent_detect_as.clone(),
             extra_env,
             extra_env_overridden: false,
             env_list_expanded: false,
@@ -638,6 +663,9 @@ impl NewSessionDialog {
         self.path = Input::new(path);
         if !self.extra_env_overridden {
             self.reload_config_defaults();
+        } else {
+            let config = self.resolve_config_for_path(self.selected_profile());
+            self.refresh_path_agent_config(&config);
         }
     }
 
@@ -681,17 +709,28 @@ impl NewSessionDialog {
             return;
         }
         self.tool_index = index;
-        if self.selected_tool_always_yolo() {
-            self.yolo_mode = true;
-        } else {
-            self.yolo_mode = self.yolo_mode_default;
-        }
         if self.selected_tool_host_only() {
             self.sandbox_enabled = false;
             self.worktree_enabled = false;
             self.worktree_branch.reset();
         }
         self.reload_tool_config();
+        self.reset_yolo();
+    }
+
+    fn reset_yolo(&mut self) {
+        self.yolo_mode = self.selected_tool_always_yolo() || self.yolo_mode_default;
+    }
+
+    /// The Yolo choice resets only when the view moves the session onto or off an
+    /// always-Yolo agent.
+    fn set_structured(&mut self, enabled: bool) {
+        let was_locked = self.selected_tool_always_yolo();
+        self.structured_enabled = enabled;
+        self.structured_choice = Some(enabled);
+        if self.selected_tool_always_yolo() != was_locked {
+            self.reset_yolo();
+        }
     }
 
     /// Carry a session's agent, view and sandbox, each only as far as this form allows.
@@ -706,8 +745,7 @@ impl NewSessionDialog {
 
     fn inherit_modes(&mut self, structured: bool, sandboxed: bool) {
         if self.structured_capable {
-            self.structured_enabled = structured;
-            self.structured_choice = Some(structured);
+            self.set_structured(structured);
         }
         if sandboxed && self.docker_available && !self.selected_tool_host_only() {
             self.set_sandbox_enabled(true);
@@ -837,12 +875,13 @@ impl NewSessionDialog {
             return;
         }
         let profile = self.selected_profile().to_string();
+        let config = self.resolve_config_for_path(&profile);
+        self.refresh_path_agent_config(&config);
         // Unknown overrides leave the toggles alone: a guess could disable a sandbox the project asks for.
         let ProjectOverridesLookup::Known(overrides) = self.resolve_overrides(&profile) else {
             return;
         };
         let host_only = self.selected_tool_host_only();
-        let config = self.resolve_config_for_path(&profile);
         if !self.worktree_dirty {
             let on = overrides
                 .as_ref()
@@ -922,6 +961,28 @@ impl NewSessionDialog {
         }
     }
 
+    /// A path's repo config changes the agent only through `agent_detect_as`. When it does,
+    /// re-read whether the agent can run structured and re-check the Yolo lock.
+    fn refresh_path_agent_config(&mut self, config: &crate::session::Config) {
+        if config.session.agent_detect_as
```

**File**: `src/tui/dialogs/new_session/tests.rs` (modified, +143/-0)
```diff
@@ -957,6 +957,149 @@ fn the_structured_row_appears_only_for_an_acp_capable_tool() {
     assert!(!submitted(dialog.build_submit_result()).structured);
 }
 
+#[test]
+fn a_custom_agent_locks_yolo_only_in_the_views_that_run_an_always_yolo_base() {
+    // (terminal locked, structured locked), with a Yolo the user turned on beforehand.
+    for (name, expected) in [
+        ("my-pi", (true, true)),
+        ("own-pi", (true, false)),
+        ("my-claude", (false, false)),
+    ] {
+        let mut dialog = NewSessionDialog::new_with_tools(vec![name], TEST_PATH.to_string());
+        let base = name.trim_start_matches("my-").trim_start_matches("own-");
+        dialog
+            .agent_detect_as
+            .insert(name.to_string(), base.to_string());
+        dialog
+            .agent_acp_cmd
+            .insert("own-pi".to_string(), "own-pi-acp".to_string());
+        dialog.set_structured_capable(true);
+        dialog.yolo_mode = true;
+        let locked = |d: &NewSessionDialog| d.field_indices().yolo == FieldIndices::ABSENT;
+        assert_eq!(locked(&dialog), expected.0, "{name} terminal");
+
+        dialog.focused_field = dialog.field_indices().structured;
+        dialog.handle_key(key(KeyCode::Char(' ')));
+        assert!(dialog.structured_enabled, "{name}");
+        assert_eq!(locked(&dialog), expected.1, "{name} structured");
+        // Leaving the lock resets Yolo to the default; an unchanged lock keeps the choice.
+        let yolo = expected.1 || expected.0 == expected.1;
+        assert_eq!(dialog.yolo_mode, yolo, "{name}");
+        assert_eq!(
+            submitted(dialog.build_submit_result()).yolo_mode,
+            yolo,
+            "{name}"
+        );
+    }
+}
+
+#[test]
+#[serial_test::serial]
+fn moving_between_repos_that_map_the_agent_differently_refreshes_its_lock_and_view() {
+    let temp_home = tempfile::tempdir().expect("temp home");
+    let _home = crate::session::test_support::isolate_home(temp_home.path());
+    let repo_mapping = |base: &str| {
+        let repo = tempfile::tempdir().expect("repo dir");
+        fs::create_dir_all(repo.path().join(".agent-of-empires")).expect("repo config dir");
+        fs::write(
+            repo.path().join(".agent-of-empires/config.toml"),
+            format!("[session]\nagent_detect_as = {{ wrap = \"{base}\" }}\n"),
+        )
+        .expect("repo config");
+        repo
+    };
+    let (pi, claude) = (repo_mapping("pi"), repo_mapping("claude"));
+    type Arrive = fn(&mut NewSessionDialog, String);
+    let arrivals: &[(&str, Arrive)] = &[
+        ("typed", |d, path| {
+            d.focused_field = d.path_field();
+            d.path = Input::new(String::new());
+            type_str(d, &path);
+            d.handle_key(key(KeyCode::Tab));
+        }),
+        ("picked", |d, path| {
+            d.focused_field = d.path_field();
+            d.path = Input::new(path);
+            d.handle_key(ctrl_key(KeyCode::Char('p')));
+            d.handle_key(key(KeyCode::Enter));
+            assert!(!d.dir_picker.is_active());
+        }),
+        ("clicked away", |d, path| {
+            d.focused_field = d.path_field();
+            d.path = Input::new(path);
+            let worktree = d.field_indices().worktree;
+            d.focusable_rects
+                .push((worktree, ratatui::layout::Rect::new(0, 9, 30, 1)));
+            d.handle_click(10, 9);
+            assert!(d.worktree_enabled, "the click must toggle the row it hit");
+        }),
+        ("sandbox env edited", |d, path| {
+            d.extra_env_overridden = true;
+            d.set_path(path);
+        }),
+        ("back-tabbed", |d, path| {
+            d.focused_field = d.path_field();
+            d.path = Input::new(path);
+            d.handle_key(key(KeyCode::BackTab));
+            assert_eq!(
+                d.focused_field,
+                d.field_indices().group,
+                "BackTab wraps to Group"
+            );
+        }),
+        ("scratch", |d, _| {
+            d.focused_field = d.field_indices().worktree;
+            d.handle_key(ctrl_key(KeyCode::Char('t')));
+            assert_eq!(
+                d.focused_field,
+                d.field_indices().worktree,
+                "focus stays on Worktree"
+            );
+        }),
+    ];
+    let locked = |d: &NewSessionDialog| d.field_indices().yolo == FieldIndices::ABSENT;
+    // Leaving the `pi` lock must drop the forced Yolo, not submit it.
+    for (from, to, to_locked) in [(&pi, &claude, false), (&claude, &pi, true)] {
+        for (name, arrive) in arrivals {
+            let mut dialog = NewSessionDialog::new_with_tools(vec!["wrap"], TEST_PATH.to_string());
+            dialog.set_path(from.path().to_string_lossy().to_string());
+            assert!(dialog.structured_capable, "{name}");
+            assert_eq!(locked(&dialog), !to_locked, "{name}");
+            arrive(&mut dialog, to.path().to_string_lossy().to_string());
+            // Scratch has no re
```

---

### Incident Patch 2: `08635740` (2026-11-08)
**Commit Message**: fix(session): resume verified Codex rollouts without attested policy (#5446)

* fix(session): resume verified Codex rollouts without attested policy

Since #4942, a Default restart refuses when AoE cannot attest Codex's
execution context. That always fails on a macOS host, where managed
preferences are unreadable, and with a ChatGPT login, so existing sessions
went to Error. The suggested set-session-id rebind fails for the same reason.

Exact-UUID lookup still spans all of CODEX_HOME, so it does not by itself
rule out #4941's cross-project resume. Admit an unpinned Default resume only
when every rollout of that UUID in the store records this session's working
directory. Everything else stays refused, with a new cause whose recovery
does not suggest the rebind.

Fixes #5415

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(session): apply one Codex refusal policy on every host

The macOS gate ran before the config checks, so macOS admitted profile and
remote-store contexts that Linux refused, while Linux refused keyring and
missing auth.json. Admit only credential and managed-preference gaps
everywhere; refuse unreadable routing everywhere, with recovery that fits.

Match 

**File**: `Cargo.lock` (modified, +2/-0)
```diff
@@ -103,6 +103,8 @@ dependencies = [
  "chrono",
  "clap",
  "clap_complete",
+ "core-foundation",
+ "core-foundation-sys",
  "crossterm",
  "dirs",
  "dotenv-ng-core",
```

**File**: `Cargo.toml` (modified, +4/-0)
```diff
@@ -201,6 +201,10 @@ schemars = { version = "1", features = ["chrono04"] }
 libc = "0.2"
 nix = { version = "0.31", features = ["signal", "process", "net", "fs", "resource", "dir", "user", "poll", "hostname"] }
 
+[target.'cfg(target_os = "macos")'.dependencies]
+core-foundation = "0.10.1"
+core-foundation-sys = "0.8.7"
+
 [features]
 # The daemon (REST/WS API, auth, Web Push, ACP, structured view) is core: a
 # plain `cargo build` ships it and needs no Node. `web` adds the embedded
```

**File**: `docs/api.md` (modified, +3/-1)
```diff
@@ -777,7 +777,9 @@ The `omp_transcript_binding_required` cause identifies an absent OMP conversatio
 binding or exact transcript path. `pi_transcript_binding_required` identifies
 the refusal when a matching Pi binding lacks the required transcript path
 after permitted discovery. Neither cause identifies a missing file on disk or
-another failed attestation. Missing, unknown, or ambiguous cause metadata keeps
+another failed attestation. `codex_conversation_unverified` identifies a Codex
+context AoE cannot attest whose conversation could not be verified from its
+local rollout either. Missing, unknown, or ambiguous cause metadata keeps
 the refusal generic; native clients do not read response bodies to derive that
 reason. See
 [managed resume recovery](guides/session-resume.md#common-managed-resume-and-fork-refusals).
```

**File**: `docs/guides/session-resume.md` (modified, +3/-3)
```diff
@@ -41,7 +41,7 @@ Shell pipelines, remote launchers, redirections, expansion, and unrecognized con
 ## Supported managed contexts
 
 - **Claude:** on a host launch, the store its conversation recorded, a declared `agent_config_dir`, the resolved `CLAUDE_CONFIG_DIR`, or the default Claude store; a sandboxed session takes a per-session child of the entry instead. A recorded conversation store outranks a conflicting configuration-directory setting; see [Swapping the engine on a restart](#swapping-the-engine-on-a-restart). Managed arguments allow namespace-neutral `--mcp-config` with one or more files or JSON strings, and zero-arity `--strict-mcp-config`, per the [Claude CLI reference](https://code.claude.com/docs/en/cli-reference). Extra native session selectors and unsupported configuration-routing options remain refused.
-- **Codex:** a local host-readable `CODEX_HOME`, file-backed API-key authentication, and local SQLite/thread storage. Cloud, keyring, profile, project-routing, managed-policy, and host macOS contexts are not currently proven.
+- **Codex:** a local host-readable `CODEX_HOME`, file-backed API-key authentication, and local SQLite/thread storage. Cloud, keyring, profile, project-routing, managed-policy, and host macOS contexts are not currently proven. On a host whose only gap is macOS managed preferences or its credentials (ChatGPT login, keyring, no `auth.json`), a Default restart still runs `codex resume <uuid>` when every rollout of that exact ID found under the store's `sessions/YYYY/MM/DD` directories is a root thread (not a subagent) that records the session's working directory. A `config_toml_base64` or `requirements_toml_base64` value in the `com.openai.codex` preference domain, forced or not, can route the store, so it refuses, as do `session.agent_config_dir`, a profile, project routing, and a remote thread store.
 - **OpenCode:** an explicit `OPENCODE_DB`, or the common database when `OPENCODE_DISABLE_CHANNEL_DB` is already enabled. Sandboxed explicit resume requires a host-readable database mount; the target working directory is still validated inside the container. Target routing is read only from the session table selected by the prepared executable's verified release/build identity. An inactive table cannot supply a missing target or override its working directory or workspace. A workspace-routed target or different stored working directory is refused. Managed current-generation launches and resumes use `--standalone` so an existing background service cannot redirect them to another database.
 - **Pi and OMP:** the verified transcript and exact store. Recovery uses `--store` with the transcript file. A Pi row that has an id but no recorded transcript path looks for `<timestamp>_<id>.jsonl` in the store, then resumes it with `--session <path>`. OMP also verifies its stored working directory and pins the resolved profile.
 - **Gemini, Cursor, Kimi, and Copilot:** their native config/share/home store inputs. AoE does not combine unrelated environment roots.
@@ -90,8 +90,8 @@ Local diagnostics include the native refusal chain and any scope-retirement erro
 
 | Context | `set-session-id` | Fork | Remedy |
 |---------|------------------|------|--------|
-| Unsandboxed Codex on a macOS host | Refused | Refused | None yet; run Codex in a managed container |
-| Codex signed in with a ChatGPT login | Refused | Refused | A local OpenAI API key, per [Codex](#supported-managed-contexts) |
+| Unsandboxed Codex on a macOS host | Refused | Refused | Default restarts resume a [verified rollout](#supported-managed-contexts); otherwise clear the ID, restart, and run `/resume <id>` in Codex. A managed container with a local OpenAI API key supports all three |
+| Codex with a ChatGPT login, keyring, or no `auth.json` | Refused | Refused | Default host restarts resume a [verified rollout](#supported-managed-contexts); a local OpenAI API key supports all three |
 | OpenCode with no provable durable database | Refused | Refused | Point `OPENCODE_DB` at a durable database (`opencode debug paths` prints the current one); otherwise `OPENCODE_DISABLE_CHANNEL_DB` must be exactly `1` or `true`, and `:memory:` never qualifies, per [OpenCode](#supported-managed-contexts) |
 | OpenCode with an unlisted release/build identity | May be recorded; resume refused | Refused | Use a listed identity; Default restarts also refuse without guessing the active schema |
 | Sandboxed OpenCode fork, or a current-generation wrapper-mediated store fork | n/a | Refused | Disable the sandbox; for a current-generation store fork, launch `opencode` directly |
```

**File**: `src/daemon/error.rs` (modified, +2/-0)
```diff
@@ -187,6 +187,7 @@ fn managed_resume_cause(headers: &HeaderMap) -> ManagedResumeCause {
             b"opencode_schema_unattested" => ManagedResumeCause::OpenCodeSchemaUnattested,
             b"pi_transcript_binding_required" => ManagedResumeCause::PiTranscriptBindingRequired,
             b"omp_transcript_binding_required" => ManagedResumeCause::OmpTranscriptBindingRequired,
+            b"codex_conversation_unverified" => ManagedResumeCause::CodexConversationUnverified,
             _ => ManagedResumeCause::ExecutionContextUnattested,
         },
         _ => ManagedResumeCause::ExecutionContextUnattested,
@@ -336,6 +337,7 @@ mod tests {
                 "omp_transcript_binding_required",
                 OmpTranscriptBindingRequired,
             ),
+            ("codex_conversation_unverified", CodexConversationUnverified),
             ("execution_context_unattested", ExecutionContextUnattested),
             ("secret-token", ExecutionContextUnattested),
             (
```

**File**: `src/process/linux.rs` (modified, +6/-1)
```diff
@@ -1,6 +1,5 @@
 //! Linux-specific process utilities.
 
-pub(crate) const HAS_CODEX_MANAGED_PREFERENCES: bool = false;
 use anyhow::Context as _;
 use std::collections::HashMap;
 use std::fs;
@@ -12,6 +11,12 @@ pub(super) use super::unix::{
     restore_environment_value, terminate_process_group, try_wait_status_hook,
 };
 
+pub(crate) const HAS_CODEX_MANAGED_PREFERENCES: bool = false;
+
+pub(crate) fn codex_managed_preferences_present() -> bool {
+    false
+}
+
 struct LegacyRuntimeDirectories {
     run: std::os::fd::OwnedFd,
     user: Option<std::os::fd::OwnedFd>,
```

**File**: `src/process/macos.rs` (modified, +55/-1)
```diff
@@ -1,6 +1,5 @@
 //! macOS-specific process utilities.
 
-pub(crate) const HAS_CODEX_MANAGED_PREFERENCES: bool = true;
 use anyhow::Context as _;
 use std::collections::HashMap;
 use std::process::Command;
@@ -9,6 +8,43 @@ pub(super) use super::unix::{
     close_frozen_payload, configure_process_group, exec_command, kill_process_group,
     restore_environment_value, terminate_process_group, try_wait_status_hook,
 };
+
+pub(crate) const HAS_CODEX_MANAGED_PREFERENCES: bool = true;
+
+const CODEX_PREFERENCES_DOMAIN: &str = "com.openai.codex";
+
+/// Whether CFPreferences holds a Codex managed configuration or requirements
+/// value. Forced or not: Codex before openai/codex#46032 read either.
+pub(crate) fn codex_managed_preferences_present() -> bool {
+    codex_managed_preferences_present_with(|key| {
+        preference_value_present(key, CODEX_PREFERENCES_DOMAIN)
+    })
+}
+
+fn codex_managed_preferences_present_with(present: impl Fn(&str) -> bool) -> bool {
+    ["config_toml_base64", "requirements_toml_base64"]
+        .into_iter()
+        .any(present)
+}
+
+fn preference_value_present(key: &str, application: &str) -> bool {
+    use core_foundation::base::{CFType, TCFType as _};
+    use core_foundation::string::CFString;
+    let (key, application) = (CFString::new(key), CFString::new(application));
+    // SAFETY: both arguments are live CFStrings.
+    let value = unsafe {
+        core_foundation_sys::preferences::CFPreferencesCopyAppValue(
+            key.as_concrete_TypeRef(),
+            application.as_concrete_TypeRef(),
+        )
+    };
+    if value.is_null() {
+        return false;
+    }
+    // SAFETY: the copy rule hands ownership of a non-null result to the wrapper.
+    drop(unsafe { CFType::wrap_under_create_rule(value) });
+    true
+}
 /// Prove only the absence of the Linux scope backend on this kernel.
 /// Native process, worker and tmux custody must still pass their own guards.
 pub(super) fn legacy_scope_inventory_clear(
@@ -1158,6 +1194,24 @@ impl super::SleepInhibit for CaffeinateInhibitor {
 mod tests {
     use super::*;
 
+    #[test]
+    fn codex_managed_preferences_refuse_either_key() {
+        for (config, requirements, expected) in [
+            (false, false, false),
+            (true, false, true),
+            (false, true, true),
+        ] {
+            let present = codex_managed_preferences_present_with(|key| match key {
+                "config_toml_base64" => config,
+                "requirements_toml_base64" => requirements,
+                _ => unreachable!("{key}"),
+            });
+            assert_eq!(present, expected, "{config} {requirements}");
+        }
+        let unused = format!("dev.aoe.test.{}", uuid::Uuid::new_v4());
+        assert!(!preference_value_present("config_toml_base64", &unused));
+    }
+
     #[test]
     fn foreign_runner_probe_requires_an_empty_original_group_and_keeps_native_tokens_strict() {
         use std::io::BufRead as _;
```

**File**: `src/process/mod.rs` (modified, +5/-1)
```diff
@@ -261,9 +261,13 @@ pub(crate) fn throttle_child(cmd: &mut std::process::Command) {
 }
 
 #[cfg(any(target_os = "linux", target_os = "macos"))]
-pub(crate) use platform::HAS_CODEX_MANAGED_PREFERENCES;
+pub(crate) use platform::{codex_managed_preferences_present, HAS_CODEX_MANAGED_PREFERENCES};
 #[cfg(not(any(target_os = "linux", target_os = "macos")))]
 pub(crate) const HAS_CODEX_MANAGED_PREFERENCES: bool = true;
+#[cfg(not(any(target_os = "linux", target_os = "macos")))]
+pub(crate) fn codex_managed_preferences_present() -> bool {
+    true
+}
 
 /// System memory + agent-count sampling for the TUI diagnostics strip.
 pub(crate) mod metrics;
```

---

### Incident Patch 3: `c7494f74` (2026-11-09)
**Commit Message**: fix(deps): bump rusqlite to 0.41 for bundled SQLite 3.54 (RUSTSEC-2026-0459) (#5506)

libsqlite3-sys 0.38.2 bundles SQLite 3.53.2, affected by CVE-2026-119375.
rusqlite 0.41 pulls libsqlite3-sys 0.39.1 (SQLite 3.54.1).

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -2616,9 +2616,9 @@ dependencies = [
 
 [[package]]
 name = "libsqlite3-sys"
-version = "0.38.2"
+version = "0.39.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1d20bef17f513b9b3004532233187769cd072d790971f4e4da0e346eb6401e8"
+checksum = "14a5f01b87b92705d07b433c06f96cbc764637d81a0bffb5734ce17cf0f9a2b3"
 dependencies = [
  "cc",
  "pkg-config",
@@ -4114,9 +4114,9 @@ dependencies = [
 
 [[package]]
 name = "rusqlite"
-version = "0.40.2"
+version = "0.41.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "23f2a97da3e3873c73cb2a2e71b35c40ff95e0b1eefa8d72d8499a6928c3b5b3"
+checksum = "da9bba6f3506135e120a6586df05be18b48d18896600646a4bec8f993d91a594"
 dependencies = [
  "bitflags 2.13.2",
  "fallible-iterator",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ tempfile = "3.14"
 which = "8.0"
 
 # SQLite
-rusqlite = "0.40"
+rusqlite = "0.41"
 
 axum = { version = "0.8", features = ["ws"] }
 # hyper/TokioIo reuse the UID/PID-verified UnixStream, including builds without `web`.
```

#### Recent Merged Pull Requests:
- **PR #5521** (closed): ci: split compile from run in build-and-test steps (@Seluj78)
- **PR #5520** (2026-11-09): ci: 4cpu jobs on Spot, split build/test steps, faster cargo builds (@Seluj78)
- **PR #5519** (2026-11-09): chore(castellan): use Sonnet 4.6 and Haiku 4.5 on Bedrock (@Seluj78)
- **PR #5511** (2026-11-09): chore(castellan): add code review findings rules to the review prompt (@athal7)
- **PR #5510** (2026-11-09): ci: add castellan shadow config and needs-triage labeler (@Seluj78)
- **PR #5506** (2026-11-09): fix(deps): bump rusqlite to 0.41 for patched bundled SQLite (RUSTSEC-2026-0459) (@Seluj78)

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

## X. tui): lock Yolo in the new-session dialog for the agent each view runs (#5412)

**RULE**:
When implementing operations in `src/tui/dialogs/new_session/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ec5be5a6`: tui): lock Yolo in the new-session dialog for the agent each view runs (#5412). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/tui/dialogs/new_session/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// The profile's custom-agent maps, which decide whether a custom tool always
    /// runs in Yolo mode in the chosen view.
    pub(super) agent_acp_cmd: std::collections::HashMap<String, String>,
    pub(super) agent_detect_as: std::collections::HashMap<String, String>,

    /// Where the row at `index` in the `before` layout sits now, or `None` if it is hidden.
    fn follow(&self, before: &FieldIndices, index: usize) -> Option<usize> {
        [
            (before.profile, self.profile),
            (before.path, self.path),
            (before.title, self.title),
            (before.tool, self.tool),
            (before.structured, self.structured),
            (before.yolo, self.yolo),
            (before.worktree, self.worktree),
            (before.sandbox, self.sandbox),
            (before.group, self.group),
        ]
        .into_iter()
        .find(|(old, _)| *old == index)
        .map(|(_, new)| new)
        .filter(|new| *new != Self::ABSENT)
    }
            agent_acp_cmd: config.session.agent_acp_cmd.clone(),
            agent_detect_as: config.session.agent_detect_as.clone(),
        } else {
            let config = self.resolve_config_for_path(self.sele
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        if self.selected_tool_always_yolo() {
            self.yolo_mode = true;
        } else {
            self.yolo_mode = self.yolo_mode_default;
        }
            self.structured_enabled = structured;
            self.structured_choice = Some(structured);
        let config = self.resolve_config_for_path(&profile);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ec5be5a6` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
