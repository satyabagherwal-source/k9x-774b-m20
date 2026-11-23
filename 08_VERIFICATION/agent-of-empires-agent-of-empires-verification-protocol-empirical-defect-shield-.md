# Verification Protocol: Verification Protocol: Empirical Defect Shield for agent-of-empires/agent-of-empires

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires/agent-of-empires",
  "source_url": "https://github.com/agent-of-empires/agent-of-empires",
  "source_version": "b33999ea",
  "license": "MIT",
  "timestamp": "2026-11-23T21:57:00.736Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-of-empires-agent-of-empires",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires) (Revision: `b33999ea`).  
> **License**: MIT | **Timestamp**: `2026-11-23T21:57:00.736Z`  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`


## 1. Scope & Verification Target
- **Target Repository**: `agent-of-empires/agent-of-empires` (Commit: `b33999ea`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): agent-of-empires/agent-of-empires

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T21:56:59.424Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4758 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `acp-worker/aoe-agent/src/aoeMeta.ts`
```
/**
 * `_meta.aoe` v1 for outgoing updates, see
 * docs/development/internals/acp-primitive-contract.md. Its own module so it
 * is testable without connecting to stdio.
 */

/** The idempotency key makes a re-sent tool call a no-op in core. */
export function toolCallMeta(toolCallId: string, label: string) {
  return {
    aoe: {
      v: 1,
      key: `tool-call:${toolCallId}`,
      tool_presentation: { label },
    },
  };
}

```

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
import { toolCallMeta } from "./aoeMeta.ts";
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
            _meta: toolCallMeta(part.toolCallId, name),
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
      protocolVersion: pa
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
    CancelNotification, McpServer, NewSessionRequest, NewSessionResponse, SessionConfigId,
    SessionConfigOption, SessionConfigValueId, SessionId, SetSessionConfigOptionRequest,
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
use crate::acp::acp_client::commands::{ClientCmd, PromptInput};
use crate::acp::acp_client::config_options::{
    config_option_failure_event, config_options_event, dispatch_set_config_option,
    dispatch_set_mode, mode_config_id, model_config_values, model_option, modes_available_event,
    thought_level_config_id, ConfigOptionDispatchPurpose, SessionChannels,
};
use crate::acp::acp_client::control::DaemonControlClient;
use crate::acp::acp_client::control::{control_outcome_reason, prompt_outcome_to_response};
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
    pub(super) default_model_config: std::collections::BTreeMap<String, String>,
    pub(super) default_mode: Option<String>,
    pub(super) default_model: Option<String>,
    pub(super) agent_cwd: PathBuf,
    /// Capability-filtered servers, forwarded again by a driven reset.
    pub(super) mcp_servers: Vec<McpServer>,
    pub(super) cmd_rx: mpsc::Receiver<ClientCmd>,
    pub(super) lifecycle_rx: mpsc::Receiver<LifecycleEnvelope>,
    /// Steers the adapter handed back unconsumed, run as ordinary turns.
    /// Kept here rather than re-sent on the bounded channel this task drains.
    pub(super) pending_prompts: VecDeque<PromptInput>,
}

impl Session {
    pub(super) async fn send_cancel(&self) -> Result<(), agent_client_protocol::Error> {
        #[cfg(test)]
        let _gate = self.shared.cancel_send_gate.read().await;
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

    /// A subagent session only honours `session/cancel` when it announced the
    /// capability; the root turn is unaffected either way.
    pub(super) async fn cancel_child(&self, session_id: String) -> bool {
        let child = SessionId::from(session_id.clone());
        if !self
            .shared
            .ingress
            .child_route(&child)
            .is_some_and(|route| route.cancel_capable)
        {
            return false;
        }
        match self.control.as_ref() {
            Some(control) => control.cancel_session(session_id).await,
            None => self
                .connection
                .send_notification(CancelNotification::new(child))
                .is_ok(),
        }
    }

    pub(super) fn dispatch_config_option(
        &mut self,
        config_id: String,
        value: String,
        remember: bool,
    ) {
        // A reset re-applies `default_model`, so it follows the live pick.
        if self
            .channels
            .model_option
            .as_ref()
            .is_some_and(|option| option.id == config_id)
        {
            self.default_model = Some(value.clone());
        }
        if remember {
            self.default_model_config
                .insert(config_id.clone(), value.clone());
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
        let shared = self.shared.clone();
        let mut completion = shared.adopted_completion_tx.subscribe();
        loop {
            self.acp_session_id =
                self.shared.ingress.current().ok_or_else(|| {
                    acp_internal_error("native session is not established".into())
                })?;
            let cancel_deadline = *shared.cancel_deadline.lock().unwrap();
            // Fallback prompts go first so later messages cannot overtake them.
            let cmd = match self.pending_prompts.pop_front() {
                Some(prompt) => Some(ClientCmd::Prompt(prompt)),
                None => tokio::select! {
                    biased;
                    outcome = async {
                        completion.wait_for(Option::is_some).await.expect("shared owns the completion sender").clone().unwrap()
                    } => {
                        shared.adopted_completion_tx.send_replace(None);
                        if self.finish_adopted_turn(outcome).await {
                            break;
                        }
                        continue;
                    }
                    cmd = self.cmd_rx.recv() => cmd,
                    _ = async {
                        match cancel_deadline {
                            Some(deadline) => tokio::time::sleep_until(deadline).await,
                            None => std::future::pending().await,
                        }
                    } => {
                        if shared.prompt_in_flight.swap(false, Ordering::Relaxed)
                            && shared.terminal_claim.claim()
                        {
                            self.stand_down_idle_completion();
                            *shared.cancel_deadline.lock().unwrap() = None;
                            shared.publish_terminal("agent_unresponsive".into(), vec![]).await;
                            break;
                        }
                        *shared.cancel_deadline.lock().unwrap() = None;
                        continue;
                    }
                    _ = idle_tick.tick() => {
                        if self.between_prompt_idle_tick().await {
                            break;
                        }
                        continue;
                    }
                },
            };
            match cmd {
                Some(ClientCmd::Prompt(prompt)) => {
                    if self.run_prompt(prompt).await? {
                        break;
                    }
                }
                Some(ClientCmd::CancelChild {
                    session_id,
                    respond_to,
                }) => {
                    let _ = respond_to.send(self.cancel_child(session_id).await);
                }
                Some(ClientCmd::Cancel) => {
                    if shared.adopted_turn_active.load(Ordering::Relaxed)
                        && shared.prompt_in_flight.load(Ordering::Relaxed)
                        && !shared.terminal_claim.claimed()
                    {
                        // Arm first: a control loss during the send keeps the deadline.
                        self.request_cancel().await;
                        self.send_cancel().await?;
                        continue;
                    }
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
                    self.stand_down_idle_comp
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
        at: crate::time::Timestamp,
    },
    /// Validated traffic from a subagent session: liveness only, so it keeps
    /// any end-of-turn accounting already seen.
    SubagentActivity,
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

/// The SDK's acknowledgement of a background `Agent` launch.
pub(super) const ASYNC_AGENT_LAUNCHED: &str = "Async agent launched successfully";

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
            if line.starts_with(ASYNC_AGENT_LAUNCHED) {
                Some(OffProtocolWorkKind::AsyncAgent)
            } else if line.starts_with("Command running in background with ID: ") {
                Some(OffProtocolWorkKind::BackgroundCommand)
            } else {
                None
            }
        })
}

/// Wake signal from a non-failed `ScheduleWakeup` tool update. The initial
/// `ToolCall` is excluded because the tool may stil
```

### Core Architecture Module: `src/acp/runner_lifecycle.rs`
```
//! Per-session ownership of a structured-view runner.

use crate::time::Timestamp;
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
    pub started_at: Timestamp,
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
    /// A rate limit rejecting this launch belongs to its caller, which reads it from the error.
    defers_rate_limit_rejection: std::sync::atomic::AtomicBool,
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
                crate::time::Timestamp::now().as_millis(),
            ),
            admissions: std::sync::atomic::AtomicU64::new(0),
            defers_rate_limit_rejection: std::sync::atomic::AtomicBool::new(false),
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
            .as_ref(
```

### Core Architecture Module: `src/acp/state.rs`
```
//! `AcpState`: the structured view session state, folded from `Event`s by a single writer.

use crate::daemon::PromptAttachmentRef;
use crate::session::Status;
use crate::time::Timestamp;
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

/// Ends an `args_preview` that was cut at the ingest cap.
pub(crate) const ARGS_CUT_MARKER: &str = "\u{2026}[truncated]";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    /// ACP `ToolKind`, lowercased.
    #[serde(default)]
    pub kind: String,
    /// Capped at 16 KB at ingest, control chars stripped.
    pub args_preview: String,
    /// The `prompt` argument in full, set only when `args_preview` was cut.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    pub started_at: Timestamp,
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
    pub created_at: Timestamp,
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
    pub started_at: Timestamp,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct RateLimitInfo {
    pub status: String,
    /// When the quota window clears, if the agent reported it.
    pub resets_at: Option<Timestamp>,
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
    pub switched_at: Timestamp,
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
    /// Argument hint the agent advertises, e.g. `[reconnect|enable|disable]`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_hint: Option<String>,
}

/// The `Other` category claude-agent-acp uses for Fast mode and Ultracode.
pub const MODEL_CONFIG_CATEGORY: &str = "model_config";

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

impl ConfigOptionDescriptor {
    /// A `model_config` option whose only choices are `on` and `off`.
    pub fn is_model_config_toggl
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5965** (2026-11-23): **Correct false and stale claims on the website and in the docs**
  *Symptoms*: > AI-assisted: Claude Code drafted this issue from decisions a maintainer made.  Part of #5964 (Phase 0).  ## Why  An audit of the website and the docs against the code found statements that are false or stale. Examples: marketing copy that describes behavior the product does not have, dead redirects, wrong example ports, an outdated key table, and a web UI link that returns 404. A reader who acts on these statements gets a different result from the one the text promises.  These corrections come before the redesign and before new docs pages, so that later work starts from accurate text. All items ship in one pull request.  ## Checklist  - [ ] T1: correct false claims on the home, tui and web pages - [ ] T2: fix the canonical host, dead redirects, social metadata and the docs title tag - [ ] T3: fix words glued to links on four pages - [ ] T13: keep docs code blocks dark in the light theme - [ ] T5: fix stale statements in the readme, introduction, install and quick start pages - [ ] T7: fix stale theme, tools, yolo and sandbox statements in the configuration reference - [ ] T8: fix stale statements in the sandbox, worktrees and web dashboard guides - [ ] T9: correct the mcp cli claims and the resume-only agent lists - [ ] T10: fix example ports and scope in the http api reference and two plugin internals lines - [ ] T12: correct command dispatch, status contributions and the featured plugin count - [ ] T11: correct the structured view key table, title and view defaults - [ ] 

- **Issue #5937** (2026-11-23): **CLI cannot start a stopped structured-view session: aoe acp restart says 'No agent worker registry entry'**
  *Symptoms*: **Version:** aoe 1.25.0, Linux  ## What happens  A structured-view session that was stopped cleanly cannot be started again from the CLI:  ``` $ aoe acp stop <session> Stopped agent worker for <session> (PID 2018489). $ aoe acp restart <session> Error: No agent worker registry entry for session <session> ```  `aoe session start <session>` doesn't bring the worker back either. The only way back is the web dashboard (Retry / Reconnect), which starts it fine and resumes the same conversation.  ## Expected  `aoe acp restart`'s help says "Restart a wedged worker after its runner and native workers have stopped". A worker stopped with `aoe acp stop` is that case, so it should start again. Alternatively there could be a CLI equivalent of the dashboard's Retry (`/api/sessions/{id}/acp/spawn`).  ## Why it matters  Scripts and agents that manage sessions from the CLI can stop a structured session but not start it again, so a person has to open the dashboard.  Possibly related: #4467 (`session start` is still a local path rather than going through the Daemon). 
  **Post-Mortem & Fix Analysis**:
  > <!-- coderabbit-ai-generated:v1 -->  <!-- This is an auto-generated issue plan by CodeRabbit --> <details> <summary>🔗 Related PRs</summary> <dl> <dd> <br>  agent-of-empires/agent-of-empires#5379 - fix(acp): rearm explicitly started structured workers [merged] agent-of-empires/agent-of-empires#5282 - feat(web): restart a Structured view start in progress from the dashboard [merged] </dd> </dl> </details>  --- <details> <summary>📝 Issue Planner</summary> <dl> <dd> <br>  <sub>Check the box below or use the `@coderabbitai plan` command to generate an implementation plan and prompts that you can use with your favorite coding assistant.</sub>  - [ ] <!-- {"checkboxId":"8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan </dd> </dl> </details>   --- <details> <summary> 🧪 Issue enrichment is currently in open beta.</summary> <dl> <dd> <br>   You can configure auto-planning by selecting labels in the issue_enrichment configuration.  To disable automatic issue enrichment, add the following
  > **Castellan triage**  Applied: - Priority: P1 - Size: M  Reasons: - priority: Stop-the-bleeding regression: CLI workflow for session management is broken; users must resort to web UI workaround. - area: The issue manifests in CLI commands (aoe acp restart, aoe session start) failing to restart stopped workers. - type: Bug: documented CLI commands fail to perform their stated function after a clean stop operation. - size: Multi-file coordination needed between CLI, daemon, worker registry, and session lifecycle logic; likely requires state synchronization fixes.  Fit is not set by triage; it stays with maintainers.  <!-- castellan triage 9dba21b5258e12d26eefd472832bb4af90aa866acabc6259d594d1e9c550ee84 -->

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

### Incident Patch 1: `c684cd29` (2026-11-23)
**Commit Message**: fix(plugin): bound pre-consent staging disk use (#5759)

* fix(plugin): bound pre-consent staging disk use

- Keep clone, downloads and extraction in a bounded private filesystem.
- Retain recovery evidence until writer settlement and cleanup are proven.
- Verify destination-filesystem copies before replacing installed plugins.

Fixes #5687

* test(plugin): isolate macOS quota probe control

- Use the internal test-only environment namespace so host fixtures cannot leak the probe control.

* ci: run all bounded staging regressions

- Include publication and recovery tests alongside fetch and platform quota tests.

* fix(process): import macOS allocation metadata

- Bring the Unix metadata extension into the detach verification scope.

* fix(plugin): correct macOS staging execution

- Permit only null-device data writes required by Git's sandboxed I/O.
- Use LibreSSL-compatible loopback TLS fixtures with bounded diagnostics.
- Separate image acquisition from behavioral observation deadlines.
- Surface the first failed cleanup instead of hiding it behind later contention.

* fix(process): verify staging images by file identity

- Match attached image and mount aliases by anchored ide

**File**: `.github/workflows/tests.yml` (modified, +10/-4)
```diff
@@ -72,16 +72,19 @@ jobs:
         if: matrix.leg == 'core-rest'
         with:
           tool: cargo-nextest
-      - name: Install tmux
+      - name: Install runtime test prerequisites
         run: sudo apt-get update && sudo apt-get install -y tmux
+      - name: Install isolated namespace test prerequisites
+        if: matrix.leg == 'core-rest' || matrix.leg == 'web-e2e'
+        run: sudo apt-get install -y bubblewrap iproute2 apparmor
       # RunsOn appends `. /etc/environment` to /etc/profile, so every login shell
       # resets PATH and aoe's login-shell launches lose the e2e stub dirs.
       - name: Keep inherited PATH in login shells
         run: sudo sed -i '/runs-on\/env/d' /etc/profile
-      - name: Install confined Local test prerequisites
-        if: matrix.leg == 'web-e2e'
+      - name: Enable isolated namespace tests
+        if: matrix.leg == 'core-rest' || matrix.leg == 'web-e2e'
         run: |
-          sudo apt-get install -y bubblewrap iproute2 apparmor
+          sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
           # The packaged profile denies capabilities to bwrap children, including ip.
           # Replace it only in memory on this disposable runner; keep network isolation.
           sudo apparmor_parser -r -K <<'PROFILE'
@@ -168,6 +171,9 @@ jobs:
         run: |
           echo "TMPDIR=${TMPDIR:-unset}"
           cargo nextest run --no-fail-fast
+      - name: Exercise bounded plugin staging
+        if: matrix.leg == 'core-rest'
+        run: cargo nextest run --run-ignored only --no-tests=fail -E 'test(staging_volume_) | test(startup_reclaims)'
       - name: Require scoped cancellation coverage
         if: matrix.leg == 'core-rest'
         env:
```

**File**: `docs/guides/configuration.md` (modified, +1/-0)
```diff
@@ -107,6 +107,7 @@ You can browse tips from **Ctrl+K > Show tips** even with the bar hidden.
 | `prevent_sleep_when_active` | `false` | Have the Daemon inhibit user-idle system sleep while sessions are active; the display can sleep. Global only. Uses `caffeinate -i` or `systemd-inhibit --what=idle:sleep`; missing tools or logind warn once and skip inhibition. |
 | `prevent_sleep_idle_grace_minutes` | `15` | Minutes a session must stay idle before the sleep-inhibit assertion may be released. Only consulted when `prevent_sleep_when_active` is on. Range `0` to `240`; `0` releases as soon as every session leaves an active status. The grace period only begins once a session goes `Idle`, so a session that never reaches `Idle` keeps holding the assertion: `Waiting` on an unanswered prompt, or `Creating` on a container, worktree, or submodule setup that never returns, can hold sleep indefinitely. A `Starting` session is bounded by a short (~3s) launch guard and then re-resolves. |
 | `session_id_poller_max_threads` | `50` | Ceiling on concurrent native-session-ID pollers per process. Overflow IDs stop refreshing until a poller is available, with a 5 s to 60 s retry backoff. `0` keeps the default. Global only; applied when the Daemon starts. |
+| `plugin_staging_sandbox` | `false` | Strict plugin staging. Global only; profiles and repositories cannot override it. Disabled by default. Enabling requires native OS sandbox support and tools and fails closed when unavailable. Default streamed byte, archive-entry, and source snapshot accounting cannot hard-limit Git/helper filesystem writes. |
 | `row_tag` | `"branch"` | Controls the compact metadata shown next to each TUI session title: `none` shows nothing; `auto` shows the profile code only in all-profiles view; `profile` always shows the profile code; `sandbox` shows `sb` on sandboxed sessions; `branch` shows a compact worktree or workspace branch tag. |
 | `show_activity_age` | `true` | Show the age column at the right edge of each TUI session row: time since the agent stopped on `Idle` rows, time since last access on `Unknown` rows, and remaining snooze time under the Attention sort. |
 | `show_structured_badge` | `true` | Show the `[structured]` badge on Structured view rows in the TUI session list. Hiding it returns the width to the title and plugin row badges; the row still opens the Structured view. TUI only; the web session list never shows the badge. |
```

**File**: `docs/plugins.md` (modified, +66/-3)
```diff
@@ -85,6 +85,9 @@ Daemon runtime workers. Started blocking work owns staging and mutation exclusio
 until it finishes, even when its observer disappears. Local staging rejects
 symlinks and special files through descriptor-anchored, nonblocking reads;
 `.git` is excluded, while empty directories and executable file modes survive.
+Local paths use an ordinary owned staging directory, without the remote size,
+entry-count or quota-backend requirements. The copied snapshot and publication
+checks still apply.
 Explicit CLI updates reapply even unchanged sources, so they can restore missing
 plugin files. They use the preview fingerprint and preserve the enabled state.
 
@@ -132,8 +135,8 @@ physical birth across exec; each signal proves the current audit token against
 that birth. Recovered process identities do not gain this authority. Unproven
 custody requires manual recovery. Observation ending does
 not cancel an accepted mutation. This policy adds no cancellation endpoint,
-flag, or configurable timeout, and commands remain unsandboxed: it is not a
-guarantee against malicious commands escaping their owned process scope or
+flag, or configurable timeout. Approved build commands remain unsandboxed;
+process custody does not guarantee containment of malicious commands or
 arbitrary filesystem I/O stalls.
 
 If command settlement or restoration cannot be proven, the host retains
@@ -149,7 +152,7 @@ and owned workers have physically exited, then restore the intended installation
 Remove any marker only after recovery, then restart the Daemon to release
 retained in-process ownership. If marker persistence failed, a new Daemon cannot
 reconstruct that memory fence: complete manual recovery before restarting.
-Restart alone is not recovery.
+A restart does not clear unproven mutation ownership.
 Tree publication and target config/lock entries share one rollback boundary.
 The previous tree stays backed up until both metadata writes commit. Restoration
 preserves the prior enabled, source, dev, grant, dismissal and settings values
@@ -161,6 +164,66 @@ that would replace a file already in the source tree, or that is a symlink,
 hardlink or special file, is rejected so the disclosed manifest and tree match
 what gets installed.
 
+Remote GitHub preparation defaults to an ordinary staging directory, without
+requiring native sandbox tools. Downloads, expanded archives and the resulting
+remote source tree have **1 GiB** byte limits. Remote source trees and extracted
+assets allow at most 65,536 entries, including implicit directories. Archive
+metadata read ahead by the tar parser has a separate 1 MiB limit. Standard
+branches and tags clone shallow-first; other references may need more history.
+
+Default accounting is not a hard filesystem quota. Git clones and credential
+helpers can write before the resulting source tree is checked, and helpers can
+write outside staging. Reference checks and remote previews remain available on
+hosts without a native quota backend.
+
+To require a native filesystem bound for remote preparation and reference checks,
+enable **Strict plugin staging** in the machine-wide Session settings, or set:
+
+```toml
+[session]
+plugin_staging_sandbox = true
+```
+
+Strict mode shares a private filesystem with a **1 GiB** ceiling across clone
+data, downloaded archives and extracted files. Preview and apply operations share
+exclusion, so concurrent previews cannot multiply this allowance. Linux uses
+RAM/swap-backed tmpfs charged to the process's memory cgroup. Its data ceiling is
+reduced to at most one quarter of available RAM or remaining visible cgroup
+memory, whichever is lower, rounded down to whole pages. The inode budget reserves
+1,024 entries beyond the source-entry ceiling when memory permits.
+These are snapshots, not memory reservations: concurrent pressure or Git
+allocations can still exhaust memory. The allowance is not a total process-memory
+limit.
+
+With strict mode enabled, unavailable enforcement fails closed without switching
+to an ordinary directory. Linux requires readable memory accounting,
+unprivileged user/mount/PID namespaces, `mount`, `unshare`, `nsenter` and Bubblewrap.
+macOS uses a fixed-size disk image through `hdiutil` and `sandbox-exec`.
+Restricted hosts refuse remote preparation and reference checks in this mode.
+Strict Git preparation cannot use host Unix sockets; credential helpers requiring
+an SSH agent or desktop keyring may fail even when file-based credentials work.
+
+After consent, publication copies and verifies the prepared tree on the
+installation filesystem before replacing an existing plugin. This copy and
+approved build outputs are outside the preparation limits. In strict mode, an
+uncertain mount or cleanup outcome requires manual recovery, not an unbounded
+retry. The `<app_dir>/.plugin-staging-active` journal records native staging ownership.
+Disabling strict mode does not clear existing recovery evidence.
+Startup and worker
```

**File**: `src/migrations/mod.rs` (modified, +7/-1)
```diff
@@ -70,6 +70,7 @@ mod v058_account_limits_window_shape;
 mod v059_owner_only_event_logs;
 mod v060_terminal_handoff_outcome;
 mod v061_unpin_default_sandbox_image;
+mod v062_plugin_staging_evidence;
 
 /// Fixtures shared by migrations that rewrite agent hook files.
 #[cfg(test)]
@@ -110,7 +111,7 @@ use anyhow::{Context, Result};
 use std::fs;
 use tracing::{debug, info};
 
-const CURRENT_VERSION: u32 = 61;
+const CURRENT_VERSION: u32 = 62;
 const VERSION_FILE: &str = ".schema_version";
 
 /// Version, log name, and the one-time transformation to run.
@@ -322,6 +323,11 @@ const MIGRATIONS: &[Migration] = &[
         "unpin_default_sandbox_image",
         v061_unpin_default_sandbox_image::run,
     ),
+    (
+        62,
+        "plugin_staging_evidence",
+        v062_plugin_staging_evidence::run,
+    ),
 ];
 
 /// The data-schema version this build targets, i.e. the version every install
```

**File**: `src/migrations/v062_plugin_staging_evidence.rs` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+//! Preserve legacy staging evidence without manufacturing process ownership.
+
+use anyhow::{Context, Result};
+use std::io::Write;
+use std::path::Path;
+
+use crate::plugin::install::{OPERATION_LOCK, RECOVERY_MARKER, STAGING_MARKER};
+use crate::session::AnchoredDir;
+
+const LEGACY_PREFIX: &[u8] =
+    b"Plugin staging acquisition started; verify the volume and its writers before removing this marker.\nmount=";
+const MAX_EVIDENCE_BYTES: usize = 1024 * 1024;
+
+pub fn run() -> Result<()> {
+    migrate_root(&crate::session::get_app_dir()?)
+}
+
+fn migrate_root(path: &Path) -> Result<()> {
+    let root = AnchoredDir::open(path)?;
+    let marker = Path::new(STAGING_MARKER);
+    if root.entry_stat(marker)?.is_none() {
+        return Ok(());
+    }
+    let bytes = root
+        .read_regular(marker, MAX_EVIDENCE_BYTES)?
+        .context("plugin staging evidence is not a bounded regular file")?;
+    if !bytes.starts_with(LEGACY_PREFIX) {
+        return Ok(());
+    }
+    let _operation = crate::session::try_acquire_storage_flock(path, OPERATION_LOCK)?
+        .context("cannot migrate staging evidence while a plugin operation is active")?;
+    anyhow::ensure!(
+        root.read_regular(marker, MAX_EVIDENCE_BYTES)?.as_deref() == Some(bytes.as_slice()),
+        "plugin staging evidence changed before migration"
+    );
+    let recovery = Path::new(RECOVERY_MARKER);
+    if let Some(mut file) = root.create_new_regular(recovery)? {
+        file.write_all(
+            b"Legacy plugin staging evidence has no process-birth or native resource ownership proof. Preserve .plugin-staging-active and verify its resources before manual recovery.\n",
+        )?;
+        file.sync_all()?;
+        root.sync()?;
+    } else {
+        root.open_regular(recovery, MAX_EVIDENCE_BYTES)?
+            .context("existing plugin recovery evidence is not a bounded regular file")?;
+    }
+    tracing::info!(target: "migrations.v062", "Preserved legacy plugin staging evidence; explicit ownership recovery remains required");
+    Ok(())
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use std::fs;
+
+    #[test]
+    #[serial_test::serial]
+    fn legacy_upgrade_preserves_resources_and_blocks_new_operations() {
+        for prior_recovery in [None, Some(b"retained operator evidence\n".as_slice())] {
+            let _home = crate::session::test_support::isolate_app_dir();
+            let app = crate::session::get_app_dir().unwrap();
+            let stage = app.join("plugins/.staging-legacy/volume");
+            fs::create_dir_all(&stage).unwrap();
+            fs::write(stage.join("retained"), b"unknown owner data").unwrap();
+            let mut legacy = LEGACY_PREFIX.to_vec();
+            legacy.extend_from_slice(stage.to_str().unwrap().as_bytes());
+            legacy.push(b'\n');
+            fs::write(app.join(STAGING_MARKER), &legacy).unwrap();
+            if let Some(prior) = prior_recovery {
+                fs::write(app.join(RECOVERY_MARKER), prior).unwrap();
+            }
+
+            migrate_root(&app).unwrap();
+            let recovery = fs::read(app.join(RECOVERY_MARKER)).unwrap();
+            assert!(crate::plugin::install::begin_operation().is_err());
+            assert_eq!(fs::read(app.join(STAGING_MARKER)).unwrap(), legacy);
+            assert_eq!(
+                fs::read(stage.join("retained")).unwrap(),
+                b"unknown owner data"
+            );
+            if let Some(prior) = prior_recovery {
+                assert_eq!(recovery, prior);
+            }
+            migrate_root(&app).unwrap();
+            assert_eq!(fs::read(app.join(RECOVERY_MARKER)).unwrap(), recovery);
+            assert_eq!(fs::read(app.join(STAGING_MARKER)).unwrap(), legacy);
+        }
+    }
+
+    #[test]
+    fn active_operation_prevents_legacy_evidence_migration() {
+        let temp = tempfile::tempdir().unwrap();
+        let legacy = [LEGACY_PREFIX, b"/unproven/stage\n"].concat();
+        fs::write(temp.path().join(STAGING_MARKER), &legacy).unwrap();
+        let _operation = crate::session::try_acquire_storage_flock(temp.path(), OPERATION_LOCK)
+            .unwrap()
+            .unwrap();
+        assert!(migrate_root(temp.path()).is_err());
+        assert_eq!(fs::read(temp.path().join(STAGING_MARKER)).unwrap(), legacy);
+        assert!(!temp.path().join(RECOVERY_MARKER).exists());
+    }
+
+    #[test]
+    fn current_or_unrecognized_evidence_is_not_rewritten() {
+        let temp = tempfile::tempdir().unwrap();
+        for evidence in [b"{\"schema\":1}\n".as_slice(), b"unrecognized evidence\n"] {
+            fs::write(temp.path().join(STAGING_MARKER), evidence).unwrap();
+            migrate_root(temp.path()).unwrap();
+            assert_eq!(
+                fs::read(temp.path().join(STAGING_MARKER)).unwrap(),
+                evidence
+            );
+            assert!(!temp.path().join(RECOVERY_MARKER).exists());
+        }
+    }
+
+    #[cfg(unix
```

**File**: `src/plugin/fetch.rs` (modified, +1886/-147)
```diff
@@ -14,12 +14,14 @@ use crate::github::{GitHubClient, GitHubClientConfig, GitHubError, DEFAULT_USER_
 use super::source::PluginSource;
 
 pub struct FetchedPlugin {
-    staging: Option<tempfile::TempDir>,
+    staging: Option<Staging>,
     operation: Option<Arc<crate::session::StorageFlock>>,
+    cleanup_safe: bool,
     pub tree: PathBuf,
     pub manifest: PluginManifest,
     pub manifest_bytes: Vec<u8>,
     pub tree_hash: String,
+    publication_hash: String,
     pub source: PluginSource,
     pub requested_ref: Option<String>,
     pub resolved_commit: Option<String>,
@@ -29,31 +31,217 @@ pub struct FetchedPlugin {
     pub(super) budget: super::execution::Budget,
 }
 
+struct Staging {
+    directory: PathBuf,
+    mount: PathBuf,
+    marker: Option<PathBuf>,
+    volume: Option<crate::process::StagingVolume>,
+}
+
+impl Staging {
+    fn create_directory(plugins_root: &Path) -> Result<Self> {
+        std::fs::create_dir_all(plugins_root)?;
+        let directory = tempfile::Builder::new()
+            .prefix(".staging-")
+            .tempdir_in(plugins_root)
+            .context("creating plugin staging dir")?
+            .keep();
+        Ok(Self {
+            mount: directory.clone(),
+            directory,
+            marker: None,
+            volume: None,
+        })
+    }
+
+    fn root(&self) -> &Path {
+        self.volume
+            .as_ref()
+            .map_or(self.mount.as_path(), |volume| volume.root())
+    }
+
+    fn create(plugins_root: &Path, limit: u64) -> Result<Self> {
+        std::fs::create_dir_all(plugins_root)?;
+        let app_root = plugins_root
+            .parent()
+            .ok_or_else(|| anyhow!("plugin staging has no application directory"))?;
+        let marker = app_root.join(super::install::STAGING_MARKER);
+        // This ordinary temporary directory is still empty and unmounted.
+        let mut temporary = tempfile::Builder::new();
+        temporary.prefix(".staging-");
+        #[cfg(unix)]
+        {
+            use std::os::unix::fs::PermissionsExt;
+            temporary.permissions(std::fs::Permissions::from_mode(0o700));
+        }
+        let directory = temporary.tempdir_in(plugins_root)?;
+        let mount = directory.path().join("volume");
+        let mut builder = std::fs::DirBuilder::new();
+        #[cfg(unix)]
+        {
+            use std::os::unix::fs::DirBuilderExt;
+            builder.mode(0o700);
+        }
+        builder.create(&mount)?;
+        super::install::create_staging_marker(&marker, &mount)?;
+        #[cfg(test)]
+        test_gate::reach(&mount, "staging-acquisition");
+        // From this point onward, no TempDir::drop may traverse the mount.
+        let mut staging = Self {
+            directory: directory.keep(),
+            mount,
+            marker: Some(marker),
+            volume: None,
+        };
+        let acquisition = super::execution::catch_panic(|| {
+            crate::process::StagingVolume::create(&staging.mount, limit)
+        });
+        match acquisition {
+            Ok(volume) => {
+                staging.volume = Some(volume);
+                Ok(staging)
+            }
+            Err(error) => {
+                if error
+                    .downcast_ref::<crate::process::StagingAcquisitionUncertain>()
+                    .is_some()
+                    || error
+                        .downcast_ref::<super::execution::RecoveryRequired>()
+                        .is_some()
+                {
+                    std::mem::forget(staging);
+                    return Err(super::execution::RecoveryRequired(format!(
+                        "strict plugin staging acquisition failed: {error:#}"
+                    ))
+                    .into());
+                }
+                if let Err(cleanup) = staging.close() {
+                    std::mem::forget(staging);
+                    return Err(super::execution::RecoveryRequired(format!(
+                        "strict plugin staging acquisition failed: {error:#}; cleanup unproven: {cleanup:#}"
+                    )).into());
+                }
+                Err(error).context("acquiring strict plugin staging filesystem")
+            }
+        }
+    }
+
+    fn limit(&self, requested: u64) -> u64 {
+        self.volume
+            .as_ref()
+            .map_or(requested, crate::process::StagingVolume::limit)
+    }
+
+    #[cfg(test)]
+    fn volume(&self) -> &crate::process::StagingVolume {
+        self.volume.as_ref().expect("live staging volume")
+    }
+
+    fn close(&mut self) -> Result<()> {
+        if let Some(volume) = &mut self.volume {
+            volume
+                .close()
+                .context("proving plugin staging volume cleanup")?;
+        }
+        self.volume.take();
+        super::install::remove_owned_tree(&self.directory)
+            .context("removing detached plugin staging directory")?;
+        if let Some(marker) = &self.marker {
+            std:
```

**File**: `src/plugin/install.rs` (modified, +1557/-103)
```diff
@@ -80,7 +80,7 @@ pub(super) fn log_recovery<T>(result: &Result<T>) {
     if let Err(error) = result {
         let marker = match crate::session::get_app_dir() {
             Ok(root) => {
-                let marker = root.join(".plugin-recovery-required");
+                let marker = root.join(RECOVERY_MARKER);
                 RECOVERY_STATE.lock().roots.insert(root);
                 Some(marker)
             }
@@ -94,16 +94,371 @@ pub(super) fn log_recovery<T>(result: &Result<T>) {
         tracing::error!(target: "plugin.install", error = %cause, "plugin mutation ownership retained for recovery");
         cause.push('\n');
         if let Some(marker) = marker {
-            if let Err(persist_error) = std::fs::write(marker, cause) {
+            let persist = (|| -> Result<()> {
+                let mut file = std::fs::File::create(&marker)?;
+                file.write_all(cause.as_bytes())?;
+                file.sync_all()?;
+                std::fs::File::open(marker.parent().expect("recovery marker parent"))?
+                    .sync_all()?;
+                Ok(())
+            })();
+            if let Err(persist_error) = persist {
                 tracing::error!(target: "plugin.install", %persist_error, "plugin recovery marker could not be persisted; manual recovery is required before restarting");
             }
         }
     }
 }
 
-const OPERATION_LOCK: &str = ".plugin-operation.lock";
+pub(crate) const OPERATION_LOCK: &str = ".plugin-operation.lock";
+pub(crate) const STAGING_MARKER: &str = ".plugin-staging-active";
+pub(crate) const RECOVERY_MARKER: &str = ".plugin-recovery-required";
+static LIVE_STAGING: parking_lot::Mutex<BTreeSet<PathBuf>> =
+    parking_lot::Mutex::new(BTreeSet::new());
+
+#[cfg(test)]
+fn register_staging(marker: &Path) {
+    LIVE_STAGING.lock().insert(marker.to_path_buf());
+}
+
+#[derive(Serialize, Deserialize)]
+#[serde(deny_unknown_fields)]
+struct StagingEvidence {
+    schema: u32,
+    owner_pid: u32,
+    owner_birth: crate::process::ProcessBirthIdentity,
+    #[cfg(target_os = "linux")]
+    owner_scope: crate::process::StagingRecoveryScope,
+    mount: PathBuf,
+    directory_identity: (u64, u64),
+    mount_identity: (u64, u64),
+    custody: crate::process::StagingCustody,
+}
+
+fn staging_directory_identity(directory: &crate::session::AnchoredDir) -> Result<(u64, u64)> {
+    let (device, inode) = directory.identity()?;
+    #[cfg(target_os = "macos")]
+    let device = device as u64;
+    Ok((device, inode))
+}
+
+fn staging_evidence(
+    root: &crate::session::AnchoredDir,
+) -> Result<(StagingEvidence, Vec<crate::process::StagingProcess>)> {
+    use std::io::Read as _;
+    let file = root
+        .open_regular(Path::new(STAGING_MARKER), 1024 * 1024)?
+        .context("plugin staging evidence is missing or not a bounded regular file")?;
+    crate::process::validate_recovery_file(&file)?;
+    let mut bytes = Vec::new();
+    file.take(1024 * 1024 + 1).read_to_end(&mut bytes)?;
+    anyhow::ensure!(
+        bytes.len() <= 1024 * 1024,
+        "plugin staging journal exceeds its bound"
+    );
+    anyhow::ensure!(
+        bytes.last() == Some(&b'\n'),
+        "incomplete plugin staging journal"
+    );
+    let mut lines = bytes[..bytes.len() - 1].split(|byte| *byte == b'\n');
+    let mut evidence: StagingEvidence =
+        serde_json::from_slice(lines.next().context("missing plugin staging header")?)
+            .context("plugin staging evidence has no complete ownership proof")?;
+    anyhow::ensure!(
+        evidence.schema == 1,
+        "unsupported plugin staging evidence schema"
+    );
+    anyhow::ensure!(
+        evidence.owner_pid > 1
+            && evidence.owner_pid <= i32::MAX as u32
+            && !evidence.owner_birth.boot_id.is_empty()
+            && !evidence.owner_birth.start_id.is_empty(),
+        "incomplete staging owner identity"
+    );
+    uuid::Uuid::parse_str(&evidence.owner_birth.boot_id)
+        .context("invalid staging owner boot identity")?;
+    #[cfg(target_os = "linux")]
+    anyhow::ensure!(
+        evidence
+            .owner_birth
+            .start_id
+            .strip_prefix("proc:")
+            .is_some_and(|start| start.parse::<u64>().is_ok_and(|start| start > 0)),
+        "invalid staging owner birth identity"
+    );
+    #[cfg(target_os = "macos")]
+    anyhow::ensure!(
+        evidence
+            .owner_birth
+            .start_id
+            .strip_prefix("audit:")
+            .is_some_and(
+                |token| token.len() == 64 && token.bytes().all(|byte| byte.is_ascii_hexdigit())
+            ),
+        "invalid staging owner birth identity"
+    );
+    let mut writers = Vec::new();
+    for line in lines {
+        let mut fields = std::str::from_utf8(line)?.split_ascii_whitespace();
+        if line == b"U" {
+            evidence.custody = crate::process::StagingCustody::Uncertain;
+            continue;
+        }
+        anyhow::ensure!(fields.nex
```

**File**: `src/process/linux.rs` (modified, +1362/-1)
```diff
@@ -25,7 +25,7 @@ fn read_mount_points(
 /// The kernel escapes only space, tab, newline and backslash in a path
 /// (as `\ooo`), so fields split on a literal space and paths stay raw bytes.
 fn parse_mount_points(mountinfo: &[u8]) -> std::collections::HashSet<std::path::PathBuf> {
-    use std::os::unix::ffi::OsStringExt;
+    use std::os::unix::ffi::OsStringExt as _;
 
     mountinfo
         .split(|&b| b == b'\n')
@@ -59,6 +59,1252 @@ fn parse_mount_points(mountinfo: &[u8]) -> std::collections::HashSet<std::path::
 
 pub(crate) const HAS_CODEX_MANAGED_PREFERENCES: bool = false;
 
+/// A private mount namespace holds the only writable filesystem used by Git.
+/// Callers must stop and reap every Git command before calling `close`.
+pub(super) struct StagingVolume {
+    holder: Child,
+    init: super::StagingProcess,
+    journal: std::sync::Arc<fs::File>,
+    root: std::path::PathBuf,
+    mount: std::path::PathBuf,
+    filter: std::sync::Arc<fs::File>,
+    limit: u64,
+    closed: bool,
+}
+
+#[derive(serde::Serialize, serde::Deserialize)]
+#[serde(deny_unknown_fields)]
+pub(crate) struct StagingRecoveryScope {
+    machine: Option<String>,
+    pid_namespace: (u64, u64),
+}
+
+impl StagingRecoveryScope {
+    pub(crate) fn capture() -> anyhow::Result<Self> {
+        use std::io::Read as _;
+        use std::os::unix::fs::MetadataExt as _;
+        let namespace = fs::metadata("/proc/self/ns/pid")?;
+        let machine = fs::File::open("/etc/machine-id").ok().and_then(|file| {
+            let mut machine = String::new();
+            file.take(128).read_to_string(&mut machine).ok()?;
+            machine.truncate(machine.trim_ascii_end().len());
+            if machine.len() != 32
+                || !machine.bytes().all(|byte| byte.is_ascii_hexdigit())
+                || machine.bytes().all(|byte| byte == b'0')
+            {
+                return None;
+            }
+            machine.make_ascii_lowercase();
+            Some(machine)
+        });
+        Ok(Self {
+            machine,
+            pid_namespace: (namespace.dev(), namespace.ino()),
+        })
+    }
+
+    pub(crate) fn prove_current(&self, previous_boot: bool) -> anyhow::Result<()> {
+        let current = Self::capture()?;
+        if previous_boot {
+            anyhow::ensure!(
+                self.machine.is_some() && self.machine == current.machine,
+                "staging recovery belongs to an unproven host"
+            );
+        } else {
+            anyhow::ensure!(
+                self.pid_namespace == current.pid_namespace,
+                "staging recovery belongs to a different PID namespace"
+            );
+        }
+        Ok(())
+    }
+}
+
+fn staging_memory_budget(requested: u64, page: u64, available: u64) -> anyhow::Result<(u64, u64)> {
+    // tmpfs data and inode metadata consume cgroup memory. This leaves room for
+    // both, the Daemon and Git, but does not reserve memory against other users.
+    let share = available / 4;
+    let bytes = requested.min(share) / page * page;
+    let inodes = (share / page).min(super::super::plugin::fetch::STAGING_ENTRY_LIMIT as u64 + 1024);
+    anyhow::ensure!(
+        bytes >= page && inodes >= 16,
+        "insufficient memory for strict tmpfs staging"
+    );
+    Ok((bytes, inodes))
+}
+
+fn staging_memory_headroom() -> anyhow::Result<u64> {
+    let meminfo = fs::read_to_string("/proc/meminfo").context("reading staging memory headroom")?;
+    let groups =
+        fs::read_to_string("/proc/self/cgroup").context("reading staging memory cgroups")?;
+    let mounts =
+        fs::read_to_string("/proc/self/mountinfo").context("reading staging cgroup mounts")?;
+    let available = staging_memory_headroom_from(&meminfo, &groups, &mounts)?;
+    anyhow::ensure!(
+        fs::read_to_string("/proc/self/cgroup")? == groups,
+        "memory cgroup changed while preparing strict staging"
+    );
+    Ok(available)
+}
+
+fn staging_memory_headroom_from(meminfo: &str, groups: &str, mounts: &str) -> anyhow::Result<u64> {
+    let mut available = parse_meminfo_field(meminfo, "MemAvailable")
+        .map(kib_to_bytes)
+        .context("available RAM is unknown; cannot size tmpfs staging safely")?;
+    let mut membership = None;
+    for line in groups.lines() {
+        let mut fields = line.splitn(3, ':');
+        let hierarchy = fields.next().context("missing memory cgroup hierarchy")?;
+        let controllers = fields.next().context("missing memory cgroup controllers")?;
+        let group = fields.next().context("missing memory cgroup path")?;
+        if controllers
+            .split(',')
+            .any(|controller| controller == "memory")
+        {
+            membership = Some((group, false));
+            break;
+        }
+        if hierarchy == "0" && controllers.is_empty() {
+            membership = Some((group, true));
+        }
+    }
+    let Some((group, unified)) = membership else {
+        return Ok(available);
+    }
```

---

### Incident Patch 2: `43c8bdad` (2026-11-22)
**Commit Message**: fix(sandbox): stop sandbox-written .git config and hooks running on the host (#5777)

* fix(sandbox): stop sandbox-written .git config and hooks running on the host

Mount each repo's .git/config and .git/hooks read-only inside the sandbox,
and run host git calls (run_git, fetch) with core.fsmonitor off, ext::
transport denied, core.sshCommand and credential.helper pinned to the user's
own values, and hooks off except for git worktree add.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(sandbox): resolve common git dir for overlays and keep included git config

Resolve each repo's common git dir (bare .git files, workspace-nested repos),
create a missing hooks dir, read global config with includes, and teach the
e2e git shim about the leading -c overrides.

Addresses review comments from coderabbitai on #5777.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(sandbox): protect worktree gitdir pointers and config.worktree

Overlay read-only a linked worktree's .git file, the admin dir's commondir
and gitdir, and config.worktree (created when absent), and include the
project path as an overlay candidate so bare-layout worktrees are covered.

Addresses review c

**File**: `docs/guides/multi-repo-workspaces.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ aoe add /path/to/backend --project frontend \
 
 `<repo>` is the repo directory name or a `--repo` path; unmatched names fail rather than falling back. The web wizard exposes the same per-repo field. Each recorded base becomes its repo's diff comparison ref, changeable with `aoe session set-base --repo <name>`; see [Base override](diff-view.md#base-override).
 
-Worktree creation runs concurrently. A failed post-checkout hook leaves the completed checkout usable and surfaces a warning rather than aborting the workspace. See [Post-checkout hooks](worktrees.md#post-checkout-hooks).
+Worktree creation runs concurrently. A non-fatal failure such as a stale fetch surfaces a warning rather than aborting the workspace. Repo `post-checkout` hooks do not run: see [Repo hooks do not run](worktrees.md#repo-hooks-do-not-run).
 
 ### Workspace layout
 
```

**File**: `docs/guides/sandbox.md` (modified, +10/-1)
```diff
@@ -62,7 +62,7 @@ environment = ["ANTHROPIC_API_KEY"]
 | `extra_run_args` | `[]` | Extra arguments passed to container run, before the image |
 | `shared_credential` | `"host_seed"` | `"host_seed"` or `"separate_login"`: where the credential an agent shares across its sandboxes comes from (see [Shared credentials](#shared-credentials)); applies to every agent with a sandbox login, today Claude. `"separate_login"` is not supported with Apple Container. Global only |
 
-Docker and Podman honor every run-policy option. Apple Container honors `cap_add` / `cap_drop` and ignores `privileged` and `security_opt` with a warning; `extra_run_args` is passed through everywhere.
+Docker and Podman honor every run-policy option. Apple Container honors `cap_add` / `cap_drop` and ignores `privileged` and `security_opt` with a warning; `extra_run_args` is passed through everywhere. Apple Container also ignores read-only mounts, including the `.git` overlays described in [Git config and hooks](#git-config-and-hooks).
 
 ## Volume mounts
 
@@ -71,12 +71,21 @@ Docker and Podman honor every run-policy option. Apple Container honors `cap_add
 | Host path | Container path | Mode |
 |-----------|----------------|------|
 | Project directory | `/workspace` | RW |
+| `<repo>/.git/config`, `config.worktree`, `hooks` (bare repo: the same names in the bare dir); for a linked worktree also its `.git` file and the admin dir's `commondir`, `gitdir` and `config.worktree` | the same path under the repo's mount | RO (none on Apple Container) |
 | `~/.gitconfig` | `/root/.gitconfig` | RO |
 | `~/.ssh/` (with `mount_ssh`) | `/root/.ssh/` | RO |
 | The session's artifact dir | `/aoe/artifacts` | RW |
 | `<agent config>/sandbox-v2/<instance-id>/` | the agent's config path, e.g. `/root/.claude/` | RW |
 | `~/.claude/sandbox-v2/.credentials.json` | `/root/.claude/.credentials.json` | RW |
 
+### Git config and hooks
+
+Git runs a repo's hooks and config-defined commands (`core.sshCommand`, `credential.helper`, `core.fsmonitor`) on whichever machine invokes it. AoE and your own terminal run git on the host against the same repo the sandbox mounts, so a writable `.git/config` or `.git/hooks` would let code in the container execute on the host. AoE therefore mounts both read-only, over the writable repo mount, for the session's repo, including the main repo of a worktree. Apple Container cannot mount read-only, so it gets no overlays: the repo's `.git` stays writable from the container, and AoE never runs repo hooks on the host on any runtime, `git worktree add` included. Your own terminal still runs hooks the sandbox wrote, so on Apple Container treat the repo's `.git` as untrusted after a session.
+
+Inside the container, commands that write `.git/config` fail, for example `git remote add`, `git push -u` (the push succeeds, recording the upstream fails) and `git branch --set-upstream-to`, `git sparse-checkout` and `git worktree repair`. Run them on the host. Each overlay is a single-file bind mount and git writes files by rename, so after such a host-side change the container can keep showing the old config until the session restarts. Commits and refs are unaffected, and so are checkouts of existing local branches. Creating a branch with upstream tracking, for example `git checkout -b feature origin/main` or `git switch -c feature origin/feature`, can fail because git records the tracking setup in `.git/config`. Installing hooks from inside the container is not possible; install them on the host. Protection covers the session's repository, a worktree's main repo and each workspace repo. A repository nested inside the project directory (a submodule, a vendored clone, or one the sandbox creates) is not protected: running git inside it on the host can execute what the sandbox wrote. Hooks in a writable checkout path (`core.hooksPath=.githooks`) are not protected, so do not point `core.hooksPath` into the checkout of a sandboxed repo.
+
+Containers created by an older AoE keep a writable `.git` until you recreate the session. AoE's own host git calls also ignore repo-local `core.fsmonitor`, `core.sshCommand`, `credential.helper`, the `ext::` transport and, except for `git worktree add`, hooks. Set `core.sshCommand` and `credential.helper` in your global git config; repo-local values are not used by AoE.
+
 ### Volume ignores
 
 `volume_ignores` accepts literal paths relative to each workspace root, or glob patterns (`*`, `?`, `[` or `]`) expanded when the session is created. Literal mounts shadow paths even if they do not exist yet.
```

**File**: `docs/guides/worktrees.md` (modified, +3/-3)
```diff
@@ -111,11 +111,11 @@ An external `git worktree lock` is not a deletion guard: AoE unlocks worktrees b
 
 ## Warnings during create
 
-Two kinds of non-fatal failure surface through the same channel instead of aborting the session: a `⚠` line on stderr for `aoe add`, a **Worktree warnings** dialog in the TUI, and a toast plus `warnings: string[]` on the `POST /api/sessions` response for the web.
+Non-fatal failures surface through one channel instead of aborting the session: a `⚠` line on stderr for `aoe add`, a **Worktree warnings** dialog in the TUI, and a toast plus `warnings: string[]` on the `POST /api/sessions` response for the web.
 
-### Post-checkout hooks
+### Repo hooks do not run
 
-Some repos install pre-commit hooks at the `post-checkout` stage (`uv-sync`, `npm install`, LFS smudge) that fire when `git worktree add` checks out the branch. If one fails, the worktree and its `.git` pointer already exist and are usable. Usually the hook needs network access or credentials the new worktree does not have yet: re-run it by hand once the environment is set up, or set `core.hooksPath` per checkout.
+AoE never runs the repo's git hooks when it creates a worktree, because a sandboxed session could have written them. That includes `post-checkout` hooks such as `uv-sync`, `npm install` or LFS smudge installed by pre-commit. Run that setup by hand in the new worktree, or from an [`on_create` hook](repo-config.md#hooks). See [Git config and hooks](sandbox.md#git-config-and-hooks).
 
 ### Fetch failures
 
```

**File**: `src/containers/runtime.rs` (modified, +5/-0)
```diff
@@ -66,6 +66,11 @@ impl ContainerRuntime {
         self.base.name
     }
 
+    /// False when `read_only` volumes are mounted read-write instead.
+    pub fn supports_read_only_volumes(&self) -> bool {
+        self.base.supports_read_only_volumes
+    }
+
     pub fn is_available(&self) -> bool {
         self.base.is_available()
     }
```

**File**: `src/daemon/wire.rs` (modified, +1/-1)
```diff
@@ -1317,7 +1317,7 @@ pub struct SessionResponse {
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub workspace_cleanup_on_delete: Option<bool>,
     /// Non-fatal warnings surfaced by a mutation response. On create these are
-    /// worktree-creation warnings (e.g. post-checkout hook failures where the
+    /// worktree-creation warnings (e.g. a stale fetch where the
     /// worktree was still created successfully). On rename these carry the
     /// tmux rekey warning emitted when the title was persisted durably but the
     /// live tmux session could not be renamed afterwards. Both live on the
```

**File**: `src/git/command.rs` (modified, +326/-8)
```diff
@@ -7,8 +7,124 @@
 use std::ffi::OsStr;
 use std::path::Path;
 use std::process::{Command, Output, Stdio};
+use std::sync::{Mutex, TryLockError};
 use std::time::{Duration, Instant};
 
+/// The user's own system/global `core.sshCommand` and `credential.helper`,
+/// as lowercase `(key, value)` pairs. `None` when git cannot answer within the
+/// deadline (a stalled `include.path`, or the caller's `deadline`) or fails to spawn.
+fn discover_user_config(
+    envs: &[(&str, &Path)],
+    deadline: Option<Instant>,
+) -> Option<Vec<(String, String)>> {
+    let mut found = Vec::new();
+    for scope in ["--system", "--global"] {
+        let mut cmd = Command::new("git");
+        cmd.args([
+            "config",
+            scope,
+            "--includes",
+            "--null",
+            "--get-regexp",
+            r"^(core\.sshcommand|credential\.helper)$",
+        ])
+        .envs(envs.iter().copied())
+        .stdin(Stdio::null());
+        let mut limit = Duration::from_secs(2);
+        if let Some(deadline) = deadline {
+            limit = limit.min(deadline.checked_duration_since(Instant::now())?);
+        }
+        let out = crate::process::run_with_timeout(&mut cmd, limit).ok()??;
+        // 1 is "no match"; anything else is an unreadable config.
+        if !matches!(out.status.code(), Some(0 | 1)) {
+            return None;
+        }
+        found.extend(
+            String::from_utf8_lossy(&out.stdout)
+                .split('\0')
+                .filter_map(|record| record.split_once('\n'))
+                .map(|(k, v)| (k.to_owned(), v.to_owned())),
+        );
+    }
+    Some(found)
+}
+
+/// `-c` overrides that pin what a repo-local config could use to run code on
+/// the host: repo values never apply, the user's own do.
+fn build_hardening_args(user: &[(String, String)]) -> Vec<String> {
+    let values = |key: &str| -> Vec<String> {
+        user.iter()
+            .filter(|(k, _)| k == key)
+            .map(|(_, v)| v.clone())
+            .collect()
+    };
+    let mut kv = vec![
+        "core.fsmonitor=false".to_owned(),
+        "protocol.ext.allow=never".to_owned(),
+    ];
+    let ssh = values("core.sshcommand");
+    if ssh.is_empty() {
+        kv.push("core.sshCommand=ssh".to_owned());
+    }
+    kv.extend(ssh.into_iter().map(|v| format!("core.sshCommand={v}")));
+    // An empty `credential.helper` resets the list the repo config built up.
+    kv.push("credential.helper=".to_owned());
+    kv.extend(
+        values("credential.helper")
+            .into_iter()
+            .map(|v| format!("credential.helper={v}")),
+    );
+    kv.into_iter()
+        .flat_map(|kv| ["-c".to_owned(), kv])
+        .collect()
+}
+
+/// Cached only after a complete discovery, so a timed-out one is retried.
+/// `None` means `deadline` passed while waiting for the cache or discovery.
+fn hardening_args_in(
+    cache: &Mutex<Option<Vec<String>>>,
+    envs: &[(&str, &Path)],
+    deadline: Option<Instant>,
+) -> Option<Vec<String>> {
+    let mut guard = loop {
+        match cache.try_lock() {
+            Ok(guard) => break guard,
+            Err(TryLockError::Poisoned(e)) => break e.into_inner(),
+            Err(TryLockError::WouldBlock) => match deadline {
+                None => break cache.lock().unwrap_or_else(|e| e.into_inner()),
+                Some(d) if Instant::now() >= d => return None,
+                Some(_) => std::thread::sleep(Duration::from_millis(5)),
+            },
+        }
+    };
+    if let Some(args) = guard.as_ref() {
+        return Some(args.clone());
+    }
+    match discover_user_config(envs, deadline) {
+        Some(user) => Some(guard.insert(build_hardening_args(&user)).clone()),
+        None if deadline.is_some_and(|d| Instant::now() >= d) => None,
+        None => Some(build_hardening_args(&[])),
+    }
+}
+
+/// `git` with config a sandbox-written `.git/config` cannot steer: no
+/// `core.fsmonitor`, repo-local `core.sshCommand` or `credential.helper`, or
+/// `ext::` transport. Repo hooks never run.
+pub fn hardened_git() -> Command {
+    hardened_git_within(None).expect("discovery cannot time out without a deadline")
+}
+
+/// [`hardened_git`] for a caller with a deadline: `None` once `deadline` passes
+/// before the user's git config has been read.
+pub fn hardened_git_within(deadline: Option<Instant>) -> Option<Command> {
+    static CACHE: Mutex<Option<Vec<String>>> = Mutex::new(None);
+    let mut cmd = Command::new("git");
+    cmd.args(hardening_args_in(&CACHE, &[], deadline)?);
+    cmd.args(["-c", "core.hooksPath=/dev/null"]);
+    cmd.env("LC_ALL", "C");
+    Some(cmd)
+}
+
 /// Run `git <args>` in `cwd`, instrumented with target `git.command`.
 /// Logs a debug line before, then debug (success) or warn (failure)
 /// after with exit code, duration, and a sanitized stderr summary.
@@ -48,8 +164,8 @@ where
     );
     // Callers classify several Git failures. Keep diagnostics deterministic
     // instead of d
```

**File**: `src/git/worktree/create.rs` (modified, +22/-22)
```diff
@@ -47,13 +47,19 @@ impl GitWorktree {
     /// `git fetch <remote> <branch>` with stdin nulled (no passphrase prompts)
     /// and a 10 second bound.
     fn fetch_branch(&self, remote: &str, branch: &str) -> FetchOutcome {
-        let mut cmd = std::process::Command::new("git");
-        cmd.args(["fetch", remote, branch])
-            .current_dir(&self.repo_path)
-            .stdin(std::process::Stdio::null());
         let timeout = std::time::Duration::from_secs(10);
         let start = Instant::now();
-        match crate::process::run_with_timeout(&mut cmd, timeout) {
+        let result = match crate::git::command::hardened_git_within(Some(start + timeout)) {
+            Some(mut cmd) => {
+                cmd.args(["fetch", remote, branch])
+                    .current_dir(&self.repo_path)
+                    .stdin(std::process::Stdio::null());
+                let remaining = timeout.saturating_sub(start.elapsed());
+                crate::process::run_with_timeout(&mut cmd, remaining)
+            }
+            None => Ok(None),
+        };
+        match result {
             Ok(Some(output)) if output.status.success() => {
                 tracing::info!(target: "git.worktree", "git fetch {remote}/{branch} ok in {:?}", start.elapsed());
                 FetchOutcome::Ok
@@ -105,7 +111,7 @@ impl GitWorktree {
     ///
     /// With `create_branch`, the branch starts at `base_branch` (else the
     /// detected default), resolved remote-first then local. Returns non-fatal
-    /// warnings (stale fetches, a failed post-checkout hook, a failed lock)
+    /// warnings (stale fetches, a failed checkout step, a failed lock)
     /// for the caller to show.
     pub fn create_worktree(
         &self,
@@ -301,8 +307,9 @@ impl GitWorktree {
         }
     }
 
-    /// `git worktree add`. A post-checkout hook can fail after the checkout
-    /// exists; that worktree is usable, so the failure becomes a warning.
+    /// `git worktree add`. Repo hooks never run: a sandbox could have written
+    /// them. A failure after the checkout exists leaves a usable worktree, so
+    /// it becomes a warning.
     fn add_worktree(&self, branch: &str, path: &Path, warnings: &mut Vec<String>) -> Result<()> {
         let t = Instant::now();
         let output = crate::git::command::run_git(
@@ -323,7 +330,7 @@ impl GitWorktree {
             let combined = sanitize_remote_credentials(&combined);
             if path.exists() && path.join(".git").exists() {
                 let warning = format!(
-                    "post-checkout hook failed for {} (worktree created, hook output below):\n{}",
+                    "git worktree add failed for {} (worktree created, output below):\n{}",
                     path.display(),
                     combined.trim()
                 );
@@ -679,7 +686,7 @@ pub(super) mod tests {
 
     #[cfg(unix)]
     #[test]
-    fn create_worktree_turns_fetch_and_hook_failures_into_warnings() {
+    fn create_worktree_turns_fetch_failures_into_warnings_and_skips_repo_hooks() {
         use std::os::unix::fs::PermissionsExt;
         const CHILD: &str = "AOE_WORKTREE_HOOK_TEST_CHILD";
         if std::env::var_os(CHILD).is_none() {
@@ -689,7 +696,7 @@ pub(super) mod tests {
                 .args([
                     "--exact",
                     &format!(
-                        "{module}::create_worktree_turns_fetch_and_hook_failures_into_warnings"
+                        "{module}::create_worktree_turns_fetch_failures_into_warnings_and_skips_repo_hooks"
                     ),
                     "--nocapture",
                     "--test-threads=1",
@@ -718,16 +725,13 @@ pub(super) mod tests {
             &["remote", "add", "origin", bogus.to_str().unwrap()],
         );
         let hook = dir.path().join(".git/hooks/post-checkout");
+        let marker = dir.path().join("hook-ran");
         repo.config()
             .unwrap()
             .set_str("core.hooksPath", hook.parent().unwrap().to_str().unwrap())
             .unwrap();
         std::fs::create_dir_all(hook.parent().unwrap()).unwrap();
-        std::fs::write(
-            &hook,
-            "#!/bin/sh\necho 'simulated hook failure' >&2\nexit 1\n",
-        )
-        .unwrap();
+        std::fs::write(&hook, format!("#!/bin/sh\ntouch {}\n", marker.display())).unwrap();
         std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
 
         let wt_parent = TempDir::new().unwrap();
@@ -738,12 +742,8 @@ pub(super) mod tests {
             .unwrap()
             .join("\n");
         assert!(wt_path.join(".git").exists());
-        for fragment in [
-            "git fetch",
-            "failed for",
-            "post-checkout hook failed",
-            "simulated hook failure",
-        ] {
+        assert!(!marker.exists(), "a repo hook ran on the host");
+        for fragment in ["git fetch", "failed for"] {
             assert!(
                 warnings.contains(frag
```

**File**: `src/git/worktree/mod.rs` (modified, +91/-2)
```diff
@@ -133,8 +133,14 @@ impl GitWorktree {
             return Ok(main_repo);
         }
         let repo = open_repo_at(path).map_err(|_| GitError::NotAGitRepo)?;
+        // libgit2 takes the workdir from the admin dir, so check against the path opened,
+        // and keep that path when the link is rejected.
         if let Some(main_repo) = Self::find_main_repo_from_worktree_gitdir(repo.path()) {
-            return Ok(main_repo);
+            return Ok(if Self::admin_points_back_to(repo.path(), path) {
+                main_repo
+            } else {
+                path.to_path_buf()
+            });
         }
         if let Some(workdir) = repo.workdir() {
             return Ok(workdir.to_path_buf());
@@ -169,7 +175,35 @@ impl GitWorktree {
         let gitdir = content
             .lines()
             .find_map(|line| line.strip_prefix("gitdir:").map(str::trim))?;
-        dir.join(gitdir).canonicalize().ok()
+        let gitdir = dir.join(gitdir).canonicalize().ok()?;
+        let linked = gitdir.parent().and_then(Path::file_name) == Some(OsStr::new("worktrees"));
+        (!linked || Self::admin_points_back_to(&gitdir, dir)).then_some(gitdir)
+    }
+
+    /// Whether the admin dir's `gitdir` file names `<workdir>/.git`. A worktree is
+    /// mounted read-write into a sandbox, so its own `gitdir:` line proves nothing:
+    /// only the admin dir, outside that mount, can vouch that the link is real.
+    fn admin_points_back_to(admin: &Path, workdir: &Path) -> bool {
+        let Ok(raw) = std::fs::read_to_string(admin.join("gitdir")) else {
+            return false;
+        };
+        let back = Path::new(raw.trim());
+        let back = if back.is_absolute() {
+            back.to_path_buf()
+        } else {
+            admin.join(back)
+        };
+        let git_file = workdir.join(".git");
+        matches!(
+            (Self::without_final_link(&back), Self::without_final_link(&git_file)),
+            (Some(a), Some(b)) if a == b
+        )
+    }
+
+    /// `path` with its parent canonicalized and its last component left alone, so a
+    /// `.git` symlink to another worktree's gitfile does not borrow that file's identity.
+    fn without_final_link(path: &Path) -> Option<PathBuf> {
+        Some(path.parent()?.canonicalize().ok()?.join(path.file_name()?))
     }
 
     /// The main repo of a linked worktree's canonical `gitdir`, or `None` if it is not one.
@@ -540,6 +574,61 @@ mod tests {
         (dir, bare)
     }
 
+    /// A sandbox mounts its worktree read-write and can rewrite `<worktree>/.git`.
+    /// A `gitdir:` line aimed at another host repo's `worktrees/<name>` admin dir
+    /// must not make that repo the main repo, whichever way it is read.
+    #[cfg(unix)]
+    #[test]
+    fn rewritten_gitdir_cannot_redirect_the_main_repo() {
+        let (real, _repo) = init_repo();
+        let real_main = real.path().canonicalize().unwrap();
+        let worktree = real.path().join("wt");
+        run_git(
+            real.path(),
+            &["worktree", "add", "-b", "wt", worktree.to_str().unwrap()],
+        );
+        assert_eq!(GitWorktree::find_main_repo(&worktree).unwrap(), real_main);
+
+        let (victim, _repo) = init_repo();
+        let victim_wt = victim.path().join("vwt");
+        run_git(
+            victim.path(),
+            &["worktree", "add", "-b", "vwt", victim_wt.to_str().unwrap()],
+        );
+        let admin = victim
+            .path()
+            .canonicalize()
+            .unwrap()
+            .join(".git/worktrees/vwt");
+        assert!(admin.is_dir());
+
+        std::fs::write(
+            worktree.join(".git"),
+            format!("gitdir: {}\n", admin.display()),
+        )
+        .unwrap();
+        let victim_main = victim.path().canonicalize().unwrap();
+        let resolved = GitWorktree::find_main_repo(&worktree).unwrap();
+        let victim_wt = victim_wt.canonicalize().unwrap();
+        let foreign = |resolved: &Path| resolved == victim_main || resolved == victim_wt;
+        assert!(!foreign(&resolved), "redirected to another host repo");
+        assert!(GitWorktree::gitfile_target(
+            &worktree,
+            &std::fs::read_to_string(worktree.join(".git")).unwrap()
+        )
+        .and_then(|g| GitWorktree::find_main_repo_from_worktree_gitdir(&g))
+        .is_none_or(|m| !foreign(&m)));
+
+        // A `.git` that is a symlink to the other worktree's gitfile carries its back-pointer.
+        std::fs::remove_file(worktree.join(".git")).unwrap();
+        std::os::unix::fs::symlink(victim_wt.join(".git"), worktree.join(".git")).unwrap();
+        let resolved = GitWorktree::find_main_repo(&worktree).unwrap();
+        assert!(
+            !foreign(&resolved),
+            "symlinked .git redirected: {resolved:?}"
+        );
+    }
+
     #[test]
     fn find_main_repo_resolves_each_layout_without_walking_up() {
         let plain = TempDir::new().unwrap();
```

---

### Incident Patch 3: `7b1c0145` (2026-11-23)
**Commit Message**: fix(tui): mount the structured preview without blocking input (#5808)

* fix(tui): mount the structured preview without blocking input

Selecting a structured row debounced a connect and then awaited it inside
the event loop. That connect opens the websocket and replays every
transcript page, so seeking through the list with the cursor stalled render
and input until it finished, while terminal rows stayed responsive. The
connect now runs on its own task and the loop only polls for it, dropping a
mount whose row the selection has left, and never replacing a view the user
opened with Enter.

Co-Authored-By: deepseek/deepseek-v4.1-flash <[REDACTED_EMAIL]>

* fix(tui): keep the structured mount from outliving or replacing a live view

An abandoned connect replayed the whole transcript for a consumer nobody
held, because the spawned task only stopped when the sender failed; it now
also stops when the receiver is dropped. Enter mounting the session itself
drops any connect still queued for it, and a landing mount is refused whenever
the target is already mounted, opened or not, so a view the user has typed
into keeps its draft. A discarded mount reports a redraw so the placeholder
and it

**File**: `src/tui/app.rs` (modified, +1475/-141)
```diff
@@ -13,7 +13,7 @@ use std::process::Stdio;
 use std::time::Duration;
 
 use super::home::update_bar::{DrawnBar, UpdateBar};
-use super::home::{bindings, HomeView, TerminalMode};
+use super::home::{bindings, HomeView, PendingStructuredInput, TerminalMode};
 use super::styles::Theme;
 use crate::containers::image_update::ImageUpdate;
 use crate::session::config::AppStateConfig;
@@ -120,7 +120,22 @@ pub struct App {
     /// Debounce for structured preview-on-select, so fast navigation doesn't
     /// connect a WebSocket per keystroke.
     preview_mount_pending: Option<(String, std::time::Instant)>,
-    /// Cleared on failure so the user can retry.
+    /// A preview mount in flight and the row it targets. Connecting replays the
+    /// session's whole transcript, so it runs off the event loop.
+    structured_mount: Option<(
+        String,
+        tokio::sync::oneshot::Receiver<
+            Result<crate::tui::structured_view::embedded::EmbeddedView, String>,
+        >,
+    )>,
+    /// The row whose mount failed, so reselecting it doesn't retry every tick.
+    structured_mount_failed: Option<String>,
+    /// Set when Enter asked for a row whose mount was already in flight: the
+    /// completion takes over the screen instead of a second connect replaying it.
+    structured_mount_activate: Option<String>,
+    /// The row whose in-flight mount just took the screen for Enter: the run
+    /// loop delivers paste buffered for it once the poll returns.
+    structured_paste_drain: Option<String>,
     pending_install_version: Option<String>,
     /// The running binary keeps its old version until restart, so this stops
     /// periodic re-checks from re-offering a release we already installed.
@@ -319,6 +334,11 @@ impl App {
             mosh_active,
             pending_structured_view_open: None,
             preview_mount_pending: None,
+            structured_mount: None,
+            structured_mount_failed: None,
+            structured_mount_activate: None,
+            structured_paste_drain: None,
+
             pending_view_switch: None,
             pending_smart_rename: None,
             dashboard_launch: None,
@@ -784,26 +804,7 @@ impl App {
                                             "paste-burst: routed {} chars via handle_paste (chars={:?})",
                                             paste_text.len(), paste_text
                                         );
-                                        // Only an ACTIVE structured view owns text input.
-                                        if let Some(view) = self
-                                            .home
-                                            .structured_preview
-                                            .as_mut()
-                                            .filter(|v| v.is_active())
-                                        {
-                                            if let Err(e) = view
-                                                .handle_event(Event::Paste(paste_text.clone()))
-                                                .await
-                                            {
-                                                self.close_embedded_structured();
-                                                self.update_status =
-                                                    Some(UpdateStatus::transient(format!(
-                                                        "structured view: {e}"
-                                                    )));
-                                            }
-                                        } else {
-                                            self.home.handle_paste(&paste_text);
-                                        }
+                                        self.route_pasted_text(&paste_text).await;
                                     }
                                     if let Some(enter) = trailing_enter {
                                         if !self.should_quit {
@@ -820,7 +821,7 @@ impl App {
                                     if let Some(evt) = deferred {
                                         match evt {
                                             Event::Key(k) => { self.handle_key(k, terminal).await?; }
-                                            Event::Paste(text) => { self.home.handle_paste(&text); }
+                                            Event::Paste(text) => { self.route_pasted_text(&text).await; }
                                             Event::Resize(_, _) => { terminal.autoresize()?; self.needs_redraw = true; }
                                             Event::Mouse(mouse) => {
                                                 let hit_list = self.home.hit_list(mouse.column, mouse.row);
@@ -1166,23 +1167,7 @@ impl App {
                         }
                         Some(Ok(Event::Paste(text))) => {
                             crate::session::write_tui_activity();
-                            // Only an ACTI
```

**File**: `src/tui/home/mod.rs` (modified, +51/-1)
```diff
@@ -230,6 +230,55 @@ pub(super) struct PassiveSynced {
     pub(super) adopted_at: std::time::Instant,
 }
 
+/// Keys typed while a row's mount connects, kept in submit order. Each Enter
+/// freezes the segment before it, so editing can only reach the draft after the
+/// last one.
+#[derive(Default)]
+pub(super) struct PendingStructuredInput {
+    completed: Vec<String>,
+    draft: String,
+}
+
+impl PendingStructuredInput {
+    pub(super) fn push_str(&mut self, text: &str) {
+        self.draft.push_str(text);
+    }
+
+    pub(super) fn backspace(&mut self) {
+        self.draft.pop();
+    }
+
+    /// An empty Enter submits nothing, matching the composer it replays into,
+    /// which trims the text before it decides.
+    pub(super) fn submit(&mut self) {
+        if !self.draft.trim().is_empty() {
+            self.completed.push(std::mem::take(&mut self.draft));
+        }
+    }
+
+    pub(super) fn into_parts(self) -> (Vec<String>, String) {
+        (self.completed, self.draft)
+    }
+
+    pub(super) fn from_parts(completed: Vec<String>, draft: String) -> Self {
+        Self { completed, draft }
+    }
+
+    /// Every buffered prompt, one per line, the way the replay types them into
+    /// the composer.
+    #[cfg(test)]
+    pub(super) fn text(&self) -> String {
+        let mut text = self.completed.join("\n");
+        if !self.draft.is_empty() {
+            if !text.is_empty() {
+                text.push('\n');
+            }
+            text.push_str(&self.draft);
+        }
+        text
+    }
+}
+
 pub(in crate::tui) struct ReadyNativeAttachment {
     pub id: String,
     pub tmux_name: String,
@@ -393,7 +442,8 @@ pub struct HomeView {
     /// Resize only when geometry repeats on two refreshes, so a one-frame toast can't resize the agent twice.
     pub(super) preview_pane_pending: Option<(String, u16, u16)>,
     pub(super) pending_paste: Option<String>,
-    pub(super) pending_paste_for_structured_view: HashMap<String, String>,
+    /// Input for a row whose mount is still connecting, split at each Enter.
+    pub(super) pending_paste_for_structured_view: HashMap<String, PendingStructuredInput>,
     pub(super) pending_attach_after_warning: Option<String>,
     pub(super) pending_stop_session: Option<String>,
     /// Target captured when the auxiliary stop confirmation opens.
```

**File**: `src/tui/home/tests/default_attach_mode.rs` (modified, +33/-8)
```diff
@@ -706,8 +706,11 @@ fn send_message_drains_pending_paste_for_structured_view() {
         "pending_paste must be drained when routing to structured view"
     );
     assert_eq!(
-        env.view.pending_paste_for_structured_view.get(&id),
-        Some(&"cached text".to_string()),
+        env.view
+            .pending_paste_for_structured_view
+            .get(&id)
+            .map(crate::tui::home::PendingStructuredInput::text),
+        Some("cached text".to_string()),
         "drained text must land in pending_paste_for_structured_view, bound to the selected session"
     );
 }
@@ -723,12 +726,28 @@ fn send_message_merges_buffered_paste_for_same_session() {
     env.view.pending_paste = Some("second".to_string());
     env.view.handle_key(key(KeyCode::Char('m')), None);
     assert_eq!(
-        env.view.pending_paste_for_structured_view.get(&id),
-        Some(&"first second".to_string()),
+        env.view
+            .pending_paste_for_structured_view
+            .get(&id)
+            .map(crate::tui::home::PendingStructuredInput::text),
+        Some("first second".to_string()),
         "same-target paste must merge into the buffered text"
     );
 }
 
+/// A whitespace-only Enter freezes nothing: the composer trims the text and
+/// sends nothing, so a frozen segment of spaces would stop the replay on every
+/// mount and hold back the segments after it.
+#[test]
+fn a_whitespace_only_enter_freezes_no_segment() {
+    let mut pending = crate::tui::home::PendingStructuredInput::default();
+    pending.push_str("   ");
+    pending.submit();
+    let (completed, draft) = pending.into_parts();
+    assert!(completed.is_empty(), "no segment for what submits nothing");
+    assert_eq!(draft, "   ", "the text stays the draft the reader can edit");
+}
+
 /// A paste captured for another structured session gets its own entry, so the earlier
 /// target's unsent draft survives and neither session's draft leaks into the other.
 #[test]
@@ -747,13 +766,19 @@ fn send_message_keeps_buffered_paste_per_session() {
     env.view.select_session_by_id(&other);
     env.view.handle_key(key(KeyCode::Char('m')), None);
     assert_eq!(
-        env.view.pending_paste_for_structured_view.get(&other),
-        Some(&"session b draft".to_string()),
+        env.view
+            .pending_paste_for_structured_view
+            .get(&other)
+            .map(crate::tui::home::PendingStructuredInput::text),
+        Some("session b draft".to_string()),
         "the new target owns its own draft"
     );
     assert_eq!(
-        env.view.pending_paste_for_structured_view.get(&id_a),
-        Some(&"session a draft".to_string()),
+        env.view
+            .pending_paste_for_structured_view
+            .get(&id_a)
+            .map(crate::tui::home::PendingStructuredInput::text),
+        Some("session a draft".to_string()),
         "the previous target's unsent draft must survive the switch"
     );
 }
```

**File**: `src/tui/structured_view/embedded.rs` (modified, +100/-0)
```diff
@@ -447,13 +447,113 @@ impl EmbeddedView {
         }
     }
 
+    /// Toast the view is showing, for the paste handoff's submit assertion.
+    #[cfg(test)]
+    pub(crate) fn toast_text(&self) -> Option<&str> {
+        self.state.toast.as_ref().map(|toast| toast.text.as_str())
+    }
+
+    /// Offer these slash commands to the composer, so a pasted `/` query opens
+    /// the picker the replay has to get past.
+    #[cfg(test)]
+    pub(crate) fn offer_commands_for_test(&mut self, names: &[&str]) {
+        self.state.transcript.available_commands = names
+            .iter()
+            .map(|name| crate::acp::state::AvailableCommand {
+                name: (*name).to_string(),
+                description: String::new(),
+                accepts_input: false,
+                input_hint: None,
+            })
+            .collect();
+    }
+
+    /// Prompts the daemon took from this view. The paste drain advances its
+    /// replay only when this grows, so a rejected prompt is not counted as sent.
+    pub(crate) fn accepted_submits(&self) -> u64 {
+        self.state.accepted_submits
+    }
+
+    /// True when the last submit was refused and its text restored to the
+    /// composer.
+    pub(crate) fn last_submit_rejected(&self) -> bool {
+        self.state.submit_rejected
+    }
+
+    /// Prompts this view submitted, in order: test read for the paste-drain
+    /// handoff's Enter boundary.
+    #[cfg(test)]
+    pub(crate) fn submitted_prompts(&self) -> &[String] {
+        &self.state.submitted_prompts
+    }
+
     /// Composer content, joined on newlines: test read for the paste-drain
     /// handoff.
     #[cfg(test)]
     pub(crate) fn composer_text(&self) -> String {
         self.state.composer.lines().join("\n")
     }
 
+    /// Take the prompt a refused send restored to the composer, so the replay
+    /// submits it on its own Enter instead of appending the next segment to it.
+    /// Empty once the composer holds anything else: that is the reader's own
+    /// draft, not the refused segment.
+    pub(crate) fn take_restored_prompt(&mut self) -> String {
+        let restored = self.state.restored_prompt.take();
+        self.state.submit_rejected = false;
+        match restored {
+            Some(text) if text == self.state.composer.lines().join("\n").trim() => {
+                self.state.take_composer_text()
+            }
+            _ => String::new(),
+        }
+    }
+
+    /// Drain the composer into the caller's buffer, whitespace intact. The
+    /// replay parks text the composer already holds, so it lands on an empty
+    /// composer and a blocked send takes only the segment it pasted.
+    pub(crate) fn take_held_text(&mut self) -> String {
+        self.state.take_composer_raw()
+    }
+
+    /// Submit one frozen replay segment as its own prompt. A paste can open the
+    /// `/` or `@` completion pickers, whose Enter accepts the completion instead
+    /// of sending, so the segment goes through the composer's submit path
+    /// directly and the picker never sees the key.
+    pub(crate) async fn submit_replayed_segment(&mut self, segment: &str) {
+        self.paste_text_with_file_load(segment).await;
+        let text = self.state.take_composer_text();
+        // The submit lock holds the segment as a draft, matching a live Enter.
+        if self.state.in_flight {
+            self.state.set_composer_text(&text);
+            return;
+        }
+        super::send_prompt_now(&mut self.state, &mut self.toast_deadline, &text).await;
+    }
+
+    /// Take back whatever the view left in its composer after an Enter it did not
+    /// submit, whether the daemon refused it or the submit lock held it, so the
+    /// caller's buffer is the segment's only owner.
+    pub(crate) fn take_unsubmitted_text(&mut self) {
+        self.state.take_composer_text();
+        self.state.submit_rejected = false;
+        self.state.restored_prompt = None;
+    }
+
+    /// Accept the next `count` submits without a daemon, holding the submit lock
+    /// as a `Sent` response does until the turn-start echo clears it.
+    #[cfg(test)]
+    pub(crate) fn accept_submits_for_test(&mut self, count: usize) {
+        self.state.accept_submits_for_test = count;
+    }
+
+    /// The socket's turn-start echo releasing the submit lock, for tests with no
+    /// connection to deliver it.
+    #[cfg(test)]
+    pub(crate) fn end_turn_for_test(&mut self) {
+        self.state.in_flight = false;
+    }
+
     /// The session this view is streaming.
     pub fn session_id(&self) -> &str {
         &self.state.session_id
```

**File**: `src/tui/structured_view/mod.rs` (modified, +47/-21)
```diff
@@ -273,6 +273,11 @@ async fn setup_view(endpoint: DaemonEndpoint, session_id: &str) -> Result<ViewSe
             ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
             loop {
                 ticker.tick().await;
+                // Checked before the poll so a view nobody holds stops here even
+                // while every poll keeps failing.
+                if plugin_tx.is_closed() {
+                    break;
+                }
                 let snapshot = match http.plugin_ui_state().await {
                     Ok(snapshot) => snapshot,
                     // A fixed env credential cannot recover inside this view.
@@ -1841,6 +1846,20 @@ async fn send_prompt_now(
     text: &str,
 ) {
     use crate::acp::client::http::PromptDispositionWire;
+    // A test submit stands in for a `Sent` response: accepted, with the submit
+    // lock still held until the turn-start echo arrives.
+    #[cfg(test)]
+    if state.accept_submits_for_test > 0 {
+        state.accept_submits_for_test -= 1;
+        state.submitted_prompts.push(text.to_owned());
+        state.accepted_submits += 1;
+        state.submit_rejected = false;
+        state.restored_prompt = None;
+        state.in_flight = true;
+        return;
+    }
+    #[cfg(test)]
+    state.submitted_prompts.push(text.to_owned());
     state.in_flight = true;
     match state
         .http
@@ -1852,30 +1871,37 @@ async fn send_prompt_now(
         )
         .await
     {
-        Ok(dispatch) => match dispatch.disposition {
-            PromptDispositionWire::Queued => {
-                // A queued prompt starts no turn, so nothing will clear the
-                // submit lock for us.
-                state.in_flight = false;
-                refresh_queue(state).await;
-                set_toast(
-                    state,
-                    toast_deadline,
-                    format!("queued ({} waiting)", state.queue.len()),
-                    ToastKind::Info,
-                );
-            }
-            PromptDispositionWire::Sent | PromptDispositionWire::Steered => {
-                set_toast(
-                    state,
-                    toast_deadline,
-                    format!("prompt sent ({} bytes)", text.len()),
-                    ToastKind::Info,
-                );
+        Ok(dispatch) => {
+            state.accepted_submits += 1;
+            state.submit_rejected = false;
+            state.restored_prompt = None;
+            match dispatch.disposition {
+                PromptDispositionWire::Queued => {
+                    // A queued prompt starts no turn, so nothing will clear the
+                    // submit lock for us.
+                    state.in_flight = false;
+                    refresh_queue(state).await;
+                    set_toast(
+                        state,
+                        toast_deadline,
+                        format!("queued ({} waiting)", state.queue.len()),
+                        ToastKind::Info,
+                    );
+                }
+                PromptDispositionWire::Sent | PromptDispositionWire::Steered => {
+                    set_toast(
+                        state,
+                        toast_deadline,
+                        format!("prompt sent ({} bytes)", text.len()),
+                        ToastKind::Info,
+                    );
+                }
             }
-        },
+        }
         Err(e) => {
             state.in_flight = false;
+            state.submit_rejected = true;
+            state.restored_prompt = Some(text.to_owned());
             state.set_composer_text(text);
             set_toast(
                 state,
```

**File**: `src/tui/structured_view/state.rs` (modified, +33/-1)
```diff
@@ -139,6 +139,25 @@ pub struct StructuredViewState {
     /// or `None` when off or the fetch failed. Read from the daemon's `/api/about`,
     /// not local config, so a remote-attached view honours that daemon (#3253).
     pub compaction_reminder_percent: Option<u8>,
+    /// Prompts the daemon took from this view. A caller replaying buffered input
+    /// advances only when this grows: a rejected prompt comes back to the
+    /// composer, and Enter can be consumed by the view without a submit.
+    pub accepted_submits: u64,
+    /// True when the last submit was refused and its text put back in the
+    /// composer, so a replay knows that text is not lost.
+    pub submit_rejected: bool,
+    /// The text that refusal restored. A replay claims the composer only while
+    /// it still holds exactly that, so a later edit is never submitted as a
+    /// refused segment.
+    pub restored_prompt: Option<String>,
+    /// Test-only: submits to accept without a daemon, leaving the submit lock
+    /// held as a real `Sent` response would until the turn-start echo clears it.
+    #[cfg(test)]
+    pub accept_submits_for_test: usize,
+    /// Every prompt the composer submitted, in order. Test-only, so the paste
+    /// handoff can assert what each Enter actually sent.
+    #[cfg(test)]
+    pub submitted_prompts: Vec<String>,
     /// The wrapped transcript painted by the last frame. Wrapping a long
     /// transcript costs far more than everything else in a frame, and most
     /// frames repaint identical rows. Interior-mutable: the render borrows the
@@ -440,6 +459,13 @@ impl StructuredViewState {
             auto_presented_elicitation: None,
             last_scroll_max: std::cell::Cell::new(0),
             compaction_reminder_percent: None,
+            accepted_submits: 0,
+            submit_rejected: false,
+            restored_prompt: None,
+            #[cfg(test)]
+            accept_submits_for_test: 0,
+            #[cfg(test)]
+            submitted_prompts: Vec::new(),
             show_full_thinking: false,
             transcript_cache: RefCell::new(None),
         }
@@ -496,7 +522,13 @@ impl StructuredViewState {
     /// Drain the composer's current text and clear it so the user can
     /// start the next prompt.
     pub fn take_composer_text(&mut self) -> String {
-        let text = self.composer.lines().join("\n").trim().to_string();
+        self.take_composer_raw().trim().to_string()
+    }
+
+    /// `take_composer_text` without the trim, for a caller parking the text
+    /// rather than sending it: the surrounding whitespace is the reader's.
+    pub fn take_composer_raw(&mut self) -> String {
+        let text = self.composer.lines().join("\n");
         // Replace with a fresh textarea so cursor + selection state
         // also reset; ratatui-textarea has no public "clear" today.
         self.composer = new_composer_textarea();
```

#### Recent Merged Pull Requests:
- **PR #5974** (2026-11-23): fix(web): start side panels closed, with daemon-owned defaults (@njbrake)
- **PR #5971** (2026-11-23): fix(test): stop restart admission tests leaking sandbox containers (@Seluj78)
- **PR #5967** (2026-11-23): docs: correct false and stale claims on the website, docs and in-app help text (@Seluj78)
- **PR #5966** (2026-11-23): chore(deps): bump @agentclientprotocol/codex-acp from 2.5.0 to 2.6.0 in /acp-worker/adapters/codex-acp (@dependabot[bot])
- **PR #5961** (2026-11-22): docs(agents): require docs updates in the same PR (@athal7)
- **PR #5959** (2026-11-23): docs(api): document the sandbox image endpoints (@klubrake)

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

## X. plugin): bound pre-consent staging disk use

**RULE**:
When implementing operations in `.github/workflows/tests.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c684cd29`: plugin): bound pre-consent staging disk use. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/tests.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      - name: Install runtime test prerequisites
      - name: Install isolated namespace test prerequisites
        if: matrix.leg == 'core-rest' || matrix.leg == 'web-e2e'
        run: sudo apt-get install -y bubblewrap iproute2 apparmor
      - name: Enable isolated namespace tests
        if: matrix.leg == 'core-rest' || matrix.leg == 'web-e2e'
          sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
      - name: Exercise bounded plugin staging
        if: matrix.leg == 'core-rest'
        run: cargo nextest run --run-ignored only --no-tests=fail -E 'test(staging_volume_) | test(startup_reclaims)'
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      - name: Install tmux
      - name: Install confined Local test prerequisites
        if: matrix.leg == 'web-e2e'
          sudo apt-get install -y bubblewrap iproute2 apparmor
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c684cd29` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
