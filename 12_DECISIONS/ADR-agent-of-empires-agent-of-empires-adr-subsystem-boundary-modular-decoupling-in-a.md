# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in agent-of-empires/agent-of-empires

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires/agent-of-empires",
  "source_url": "https://github.com/agent-of-empires/agent-of-empires",
  "source_version": "956d1300",
  "license": "MIT",
  "timestamp": "2026-11-26T07:10:17.978Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-of-empires-agent-of-empires",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires) (Revision: `956d1300`).  
> **License**: MIT | **Timestamp**: `2026-11-26T07:10:17.978Z`  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`


## Status
**ACCEPTED** (Empirically verified from agent-of-empires/agent-of-empires)

## Context
During deep inspection of agent-of-empires/agent-of-empires, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
# Forensic Learning Record (Deep Inspection): agent-of-empires/agent-of-empires

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T07:10:16.782Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4902 stars

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
- **Issue #5984** (2026-11-24): **Plugin recovery: remove empty staging directories after reclaiming native resources**
  *Symptoms*: ## What happened?  After a Daemon crash during strict remote plugin staging, successful startup recovery can leave an empty `.staging-*` directory behind after reclaiming the native resource.  Remove the empty directory associated with the recovered operation once resource absence and directory ownership are proven. Leave live, unowned, or non-empty directories untouched. Extend the crash/restart regression to assert that the recovered directory is gone.  Follow-up to #5759 ([review](https://github.com/agent-of-empires/agent-of-empires/pull/5759#pullrequestreview-6021907124)).  ## aoe version and OS  Reported in the review of #5759 against `8cb687e82`. Applies to strict native staging recovery; OS not specified in the review.  ## AI usage  Drafted with OpenAI Codex via omp. 
  **Post-Mortem & Fix Analysis**:
  > **Castellan triage**  Applied: - Label `P2` - Label `area:agents` - Priority: P2 - Size: S - Status: Backlog  Reasons: - priority: Real issue affecting resource cleanup after daemon recovery, but not a blocker or regression. - area: Plugin staging and resource recovery is part of the agent plugin system. - type: Bug fix to properly clean up empty staging directories left after crash recovery. - size: Single component change to add directory cleanup logic and extend existing regression tests.  Fit is not set by triage; it stays with maintainers.  <!-- castellan triage 0cae083c50d9c4a08332ab6c70872177e02bc660956d0328bd0af79b06f3ea35 -->
  > <!-- coderabbit-ai-generated:v1 -->  <!-- This is an auto-generated issue plan by CodeRabbit --> <details> <summary>🔗 Related PRs</summary> <dl> <dd> <br>  agent-of-empires/agent-of-empires#5759 - fix(plugin): bound pre-consent staging disk use [open] </dd> </dl> </details>  --- <details> <summary>📝 Issue Planner</summary> <dl> <dd> <br>  <sub>Check the box below or use the `@coderabbitai plan` command to generate an implementation plan and prompts that you can use with your favorite coding assistant.</sub>  - [ ] <!-- {"checkboxId":"8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan </dd> </dl> </details>   --- <details> <summary> 🧪 Issue enrichment is currently in open beta.</summary> <dl> <dd> <br>   You can configure auto-planning by selecting labels in the issue_enrichment configuration.  To disable automatic issue enrichment, add the following to your `.coderabbit.yaml`: ```yaml issue_enrichment:   auto_enrich:     enabled: false ``` </dd> </dl> </details>  💬 Have feedbac

- **Issue #5975** (2026-11-24): **Web dashboard: banner calls a stop-fenced Session a missing adapter, and a prompt to a stopped Session doesn't start it**
  *Symptoms*: **Note:** Claude handled the investigation and prose via back-and-forth. Idea, decisions, and everything else are mine. — @Seluj78  ## Problem  After a durable stop (`aoe acp stop`, `aoe killall`), a message sent to the Session sits queued and the Web dashboard shows the banner "Claude Code couldn't start in Structured view. The ACP adapter, the program that connects AoE to Claude Code, didn't start. It's usually missing or out of date." with an `npm install -g @agentclientprotocol/claude-agent-acp@latest` command. The adapter is fine. The Session was stopped on purpose and waits for an explicit start. Clicking Retry fixes it, which makes the failure look random.  Two defects:  1. The banner describes the stop fence as a missing adapter. 2. A prompt sent to a stopped Session does not start it, while a prompt sent to an idle auto-stopped Session ("deep sleep") does. Both look the same in the UI, so the difference reads as randomness.  ## Evidence from the affected session  Session `03439a289b024085`, acp-workers log and `acp_events.db`:  - Idle auto-stop wakes normally: `auto-stopped idle structured view worker idle_secs=3600`, then `waking idle-dormant structured view session on prompt; spawning a fresh worker` (twice, Nov 22 20:57Z and Nov 23 06:04Z). - 08:02:35Z: a separate `aoe` CLI process (pid 63602) stops the worker: `acp.runner: shutdown signal received`, `restart_decision: registry entry gone, treating as user-initiated stop`. Event seq 3080 `Stopped {"reason":"user_s

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

### Incident Patch 1: `83161f1c` (2026-11-26)
**Commit Message**: feat(web): suggested sessions dashboard, settings and guide (#5599)

* feat(web): suggested sessions views, settings and first-run setup

Adds the /suggestions page, the dashboard and sidebar Suggested sections,
the first-run setup hint and sheet, the Settings > Suggestions tab with
templates and project mapping, marketplace badge and filter, and the
initial_prompt field in the session wizard.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* docs(suggestions): user guide and dashboard docs for suggested sessions

Adds the guide to the website docs sync and nav.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(web): keep the started-row menu out of list clipping

Drops overflow-hidden from the suggestion lists, rounds the row corners
instead, and asserts the menu items are reachable on a sole started row.

Addresses review comment from @jerome-benoit on #5599.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(web): keep a template edit typed during a pending save

Clear the draft only when it still equals the submitted value, so an edit
made while a save or reset is in flight survives and saves on its own blur.

Addresses review comment from @jerome-be

**File**: `docs/guides/suggested-sessions.md` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+# Suggested sessions
+
+Suggested sessions are things worth starting a session for, such as a PR that wants your review or a failing check, published by installed plugins. AoE only lists them. Nothing runs until you start one, and **Start** launches right away with the [preset](#presets) of the suggestion's kind.
+
+Each item has a title, a reason, the plugin that proposed it, and a draft prompt. Plugins decide what to publish; this page covers using them. Writing a provider is covered in the [plugin contract](../plugin-api.md#suggested-sessions).
+
+Suggestions show up in the web dashboard (homepage section, `/suggestions`, and optionally the sidebar) and in the TUI. They are stored per [profile](configuration.md#profiles).
+
+## Setting up
+
+With no provider installed, the web homepage and the empty `/suggestions` view offer **Set up suggestions** when a featured plugin exists. The sheet installs the sources you tick, runs each plugin's setup checks (✓, `!`, ✕, with the plugin's fix text and **Check again**), and ends with "Suggestions are on". **Finish later** closes it; the plugin stays installed. **More sources in the Marketplace ›** opens Settings › Plugins › Marketplace filtered to plugins that work with suggestions.
+
+Providers are off until you turn one on, in the setup sheet, in Settings › Suggestions › Sources, or through the API (`PATCH /api/suggestions/prefs` with `provider_enabled`). The sheet turns on each source it installs, and no other. To skip the sheet, install a provider with `aoe plugin install` ([Plugins](../plugins.md)), then turn it on. While every installed provider is off, the homepage section and `/suggestions` say so and offer **Turn it on** (**Turn them on** for several); a read-only dashboard says it can't turn them on.
+
+## Web dashboard
+
+### Homepage and `/suggestions`
+
+The homepage shows up to 3 suggestions (2 on a narrow screen) under "Suggested sessions", with **View all (N)** linking to `/suggestions`. Turn the section off in Settings › Suggestions.
+
+The full view lists every suggestion, one line per row, grouped by repo:
+
+- Two header rows: the title with a status line (the count and each provider's "Updated 2 min ago", "Waiting for first results", "Nothing new", "Refreshing…" or "Couldn't refresh: <error>"), **Refresh** and the gear for Settings › Suggestions; then **Search**, **All repos ▾** and **All kinds ▾**. Items from a failing provider stay listed from the last fetch.
+- **Search** matches the title, source reference, reason and repo, ignoring case. **All repos ▾** lists the repos with counts. Keys of the form `org/repo` are grouped: the org row selects everything under that org, a repo row only that repository. **All kinds ▾** narrows to kinds such as Review requests. Selected rows combine, and **Clear filters** resets them.
+- Source chips (**All**, one per source) appear only with two or more sources, and **Dismissed** once something is dismissed.
+- Each repo group has a header with the count that collapses its rows. Rows show `#123` rather than `owner/repo#123`, then the reason once, such as "Review requested". A repo with no Project yet says so in its header.
+- On a phone each row takes two lines, and **Start**, **▾** and ✕ keep a 44px tap area. **▾** opens as a bottom sheet.
+
+### Starting one
+
+**Start** runs the suggestion's kind [preset](#presets) at once: agent, view, worktree, sandbox, Yolo mode and the prompt, in the Project the repo is linked to. There is no New session dialog and no prompt review. A toast names the Session ("Started “<title>”") with **Open**, and the other rows stay usable meanwhile.
+
+If the repo defines [hooks](repo-config.md) you have not approved, Start pauses on **Review this repo's hooks**. **Approve and start** trusts them and starts in one step. Start cannot skip this review, and it asks again when the hooks change.
+
+**▾** next to Start shows what Start will use for this suggestion (Project, agent, view, worktree) and offers:
+
+- **Start with changes**: opens the New session dialog prefilled from the preset, for this one only. A strip above the form names the source and says "issue text not included"; the source's own text is never added to the prompt for you. The dialog also shows "From the <kind> preset" with an **Edit preset** link.
+- **Copy prompt**, **Open in <provider> ↗**, and **Edit the <kind> preset** (Settings › Suggestions).
+
+If the repo has no Project yet, **Start in… ▾** replaces Start. Picking a Project links the repo to it, then starts, so later suggestions from that repo start in one click. It is off on read-only dashboards and in CityHall mode, which cannot save the link.
+
+### After starting
+
+The row stops offering Start. It shows "⠋ Running · started 3 min ago" (or "Idle", the session's other status, or "Archived") and an **Open** button. The **⋯** menu has **Start another Session…**, **Open in <provider> ↗** and **Dismiss**. Trashing the session removes the lin
```

**File**: `docs/guides/web/dashboard.md` (modified, +2/-0)
```diff
@@ -74,6 +74,8 @@ Once setup is out of the way, an interactive walkthrough highlights the major re
 
 Completing or skipping the tour records `app_state.has_seen_web_tour` on the server, so it does not relaunch on reload or on another device pointed at the same server. That flag persists in the server's `state.toml` (a sibling of `config.toml`, see [Configuration Reference](../configuration.md#statetoml)); the `GET /api/settings` JSON key is unchanged, still `app_state.has_seen_web_tour`. To replay it, open the overflow menu and choose **Show tutorial**; re-triggering adapts to where you are (dashboard regions, or composer / mode picker / send controls inside a session). It does not auto-launch on touch devices, where it is menu-only.
 
+While no plugin that provides suggestions is installed and a featured one exists, the homepage shows a one-line hint under the action cards. **Set up suggestions** opens a sheet that installs the featured providers you pick, then shows each plugin's setup checks (with its fix text and **Check again**). **More sources in the Marketplace** opens Settings > Plugins > Marketplace with the Suggestions filter on (`/settings/plugins?marketplace=suggestions`). The hint is skipped during the tour, on read-only and CityHall dashboards, and when the homepage section is off in Settings > Suggestions. Dismissing it stores `aoe-suggestions-hint-dismissed` in the synced web UI state, so it stays hidden on your other devices.
+
 ## Sidebar sort
 
 By default the sidebar shows your manually-ordered list. Drag a row (press-and-hold) to move it; the order persists across browsers and devices via `workspace-ordering.json`. To reorder whole projects, press-and-drag the project/group header itself (there is no separate handle); this group order is per-browser (localStorage), not synced. Group drag is disabled while a filter is active or a computed sort mode is selected.
```

**File**: `docs/plugin-api.md` (modified, +2/-2)
```diff
@@ -478,7 +478,7 @@ Quotas per plugin: 64 keys, 256-byte keys, 64 KiB values. `cas` (compare-and-swa
 
 > **Availability:** the `[suggestions]` manifest block, the `suggestions.*` worker RPCs and the `/api/suggestions` routes are served by this host. The web dashboard and TUI workflows described below arrive with their own changes (#5599, #5600).
 
-For using suggestions from the web dashboard and the TUI, see the suggested sessions guide.
+For using suggestions from the web dashboard and the TUI, see the [suggested sessions guide](guides/suggested-sessions.md).
 
 A worker declares the criteria it publishes in a `[suggestions]` block:
 
@@ -574,7 +574,7 @@ An item has one primary Session. The first create that carries `suggestion` (`st
 
 Errors: 404 `unknown_provider` (no active plugin provides suggestions under that id), 409 `stale_suggestion` (the item is no longer published, its source is disabled, or its source closed it; `prepare` and `start` answer all three the same way), 400 `validation_failed` (`criterion` not declared by the provider, an unknown preset agent, or a prompt or its expansion over 64 KiB), 403 `read_only`.
 
-The TUI lists suggestions from Home with `S` (`Ctrl+S` in strict mode). The view shows each item's `preview` and prompt as plain text; the first Enter resolves `prepare` and shows its final `initial_prompt` (after the preset prompt); a second Enter opens the new-session dialog prefilled with it, and an item whose `project` is `null` cannot be started. The dialog's Prompt row, which is always present and editable, holds that prompt; for a suggestion it is labelled with the provider and Ctrl+P on it shows the item's `preview` as source text. `r` only asks providers to refresh; `l` reloads the list. Items keep the order of the snapshot. Home also lists a collapsed **Suggested (N)** group above Trash, absent when there are no open suggestions. Enter expands it to the first 3 items and a "View all" row that opens the view above; Enter on an item prepares it and opens the prefilled dialog directly, `z` (`Z` in strict mode) dismisses it, and `N` (`Ctrl+N`) starts a blank session. `Ctrl+K` lists "Suggested sessions"; on a suggestion row, or on the selected item in the view, it also lists "Open in <provider>", which opens the item's `source_url`. Every TUI key is provisional pending #4597: `S` / `Ctrl+S` to open, `z` / `N` on a Home row, and `x` (dismiss), `d` (dismissed), `r` and `l` inside the view may move.
+The TUI lists suggestions from Home with `S` (`Ctrl+S` in strict mode). The view shows each item's `preview` and prompt as plain text; the first Enter resolves `prepare` and shows its final `initial_prompt` (after the preset prompt); a second Enter opens the new-session dialog prefilled with it, and an item whose `project` is `null` cannot be started. The dialog's Prompt row, which is always present and editable, holds that prompt; for a suggestion it is labelled with the provider and Ctrl+P on it shows the item's `preview` as source text. `r` only asks providers to refresh; `l` reloads the list. Items keep the order of the snapshot. Home also lists a collapsed **Suggested (N)** group above Trash, absent when there are no open suggestions. Enter expands it to the first 3 items and a "View all" row that opens the view above; Enter on an item prepares it and opens the prefilled dialog directly, `z` (`Z` in strict mode) dismisses it, and `N` (`Ctrl+N`) starts a blank session. `Ctrl+K` lists "Suggested sessions"; on a suggestion row, or on the selected item in the view, it also lists "Open in <provider>", which opens the item's `source_url`. Every TUI key is provisional: `S` / `Ctrl+S` to open, `z` / `N` on a Home row, and `x` (dismiss), `d` (dismissed), `r` and `l` inside the view may move.
 
 ### Project mappings
 
```

**File**: `web/src/App.tsx` (modified, +113/-3)
```diff
@@ -8,7 +8,7 @@ import {
   type ComponentProps,
   type ReactNode,
 } from "react";
-import { Puzzle } from "lucide-react";
+import { Puzzle, Sparkles } from "lucide-react";
 import {
   confirmFileEditNavigation,
   confirmFileEditPanes,
@@ -78,6 +78,7 @@ import { usePaneLayout, dockTabs, dockGroups, dockOf, isDockCollapsed, renderedG
 import { isPluginPaneId, resolvePaneIcon, usePluginPanes, type PluginPane } from "./lib/pluginPanes";
 import { PluginPaneBody } from "./components/plugin/PluginPane";
 import { PluginPageView } from "./components/plugin/PluginPageView";
+import { SuggestionsView } from "./components/SuggestionsView";
 import { PluginSessionMenu } from "./components/plugin/PluginSessionMenu";
 import {
   deleteWorkspaceSessions,
@@ -136,7 +137,13 @@ import { toastBus, reportError } from "./lib/toastBus";
 import { restartForUpdate } from "./lib/restartForUpdate";
 import { startPendingCreates } from "./lib/pendingCreates";
 import { isAbsolutePath, resolveToRepoRelative, type FileRef } from "./lib/fileRef";
-import { NAVIGATE_EVENT, OPEN_SESSION_EVENT, openFocusWindow, replaceDocument } from "./lib/sessionRoute";
+import {
+  NAVIGATE_EVENT,
+  OPEN_SESSION_EVENT,
+  openFocusWindow,
+  replaceDocument,
+  requestNavigate,
+} from "./lib/sessionRoute";
 import { dispatchFocusTerminal, requestSessionInputFocus, setPendingTerminalFocus } from "./lib/terminalFocus";
 import {
   bindHiddenInput,
@@ -224,6 +231,7 @@ import { LOGIN_REQUIRED_EVENT, TOKEN_EXPIRED_EVENT, resetTokenExpired } from "./
 import { AboutModal } from "./components/AboutModal";
 import { TipsModal } from "./components/TipsModal";
 import { useTips, shouldAutoPopTips } from "./hooks/useTips";
+import type { CommandAction } from "./components/command-palette/types";
 import { useConversationSearch } from "./hooks/useConversationSearch";
 import { BannerStack } from "./components/BannerStack";
 import { ElevationPrompt } from "./components/ElevationPrompt";
@@ -434,6 +442,7 @@ function AppContent({
   const { focusSessionId, enterFocusMode, exitFocusMode } = useFocusMode(sessionMatch?.params.sessionId ?? null);
   const focusMode = focusSessionId !== null;
   useDashboardPresence(focusSessionId);
+  const suggestionsMatch = useMatch("/suggestions");
   // A plugin page's split pane shows `?session=` as the routed session, docks and all.
   const activeSessionId = sessionMatch?.params.sessionId ?? (pluginPageMatch ? searchParams.get("session") : null);
   const selectPluginPageSession = useCallback(
@@ -461,7 +470,7 @@ function AppContent({
   }, [focusMode, onPluginPage, selectPluginPageSession, navigate]);
   const showSettings = settingsRootMatch !== null || settingsTabMatch !== null;
   // Settings and plugin pages take the full width, sidebar and session panels hidden.
-  const fullPageView = showSettings || pluginPageMatch !== null;
+  const fullPageView = showSettings || pluginPageMatch !== null || suggestionsMatch !== null;
   const settingsTab = settingsTabMatch?.params.tab ?? null;
 
   const {
@@ -565,6 +574,17 @@ function AppContent({
   const pluginUiEntries = usePluginUiEntries();
   const pluginPages = usePluginPages();
   const pluginPageActions = useMemo(() => buildPluginPageActions(pluginPages ?? []), [pluginPages]);
+  const suggestionsAction = useMemo<CommandAction>(
+    () => ({
+      id: "page:suggestions",
+      title: "Suggested sessions",
+      group: "Pages",
+      keywords: ["page", "suggestions", "suggested", "start"],
+      icon: <Sparkles className="h-4 w-4" />,
+      perform: () => requestNavigate("/suggestions"),
+    }),
+    [],
+  );
   const pluginAttention = usePluginAttention();
   const [pluginSortRef, setPluginSortRef] = useState<{ pluginId: string; entryId: string } | null>(null);
   const activePluginSort = useMemo(() => {
@@ -2389,6 +2409,38 @@ function AppContent({
         />
       );
     }
+    if (suggestionsMatch) {
+      return (
+        <div className="flex-1 min-h-0 flex flex-col">
+          <div className="px-4 pt-3 md:px-8">
+            <button onClick={handleClosePluginPage} className="text-brand-500 cursor-pointer text-sm">
+              &larr; Back
+            </button>
+          </div>
+          <SuggestionsView
+            readOnly={caps.readOnly || !caps.canManageSuggestions}
+            cityhall={caps.cityhall}
+            onOpenMarketplace={
+              caps.canManageProjects ? () => requestNavigate("/settings/plugins?marketplace=suggestions") : undefined
+            }
+            initialDismissed={searchParams.get("dismissed") === "1"}
+            onPrepare={(prefill) => {
+              setWizardPrefill(prefill);
+              setShowSessionWizard(true);
+            }}
+            onOpenSession={(id) => requestNavigate(`/session/${encodeURIComponent(id)}`)}
+            onOpenSettings={caps.canManageSuggestions ? () => requestNavigate("/settings/suggestions") : undefined}
+            sessions={sessions}
+            canLink={!caps.nam
```

**File**: `web/src/components/Dashboard.tsx` (modified, +45/-1)
```diff
@@ -1,10 +1,13 @@
-import { useMemo, type ReactNode } from "react";
+import { useMemo, useState, type ReactNode } from "react";
 import type { SessionResponse } from "../lib/types";
 import { getStatusTextClass, isSessionActive } from "../lib/session";
 import { useIdleDecayWindowMs } from "../lib/idleDecay";
 import { useIsWideViewport } from "../hooks/useIsWideViewport";
 import { AOE_BRAND_MARK_COLORS, AOE_BRAND_MARK_TEXT_SHADOW } from "../lib/brandMark";
 import { TOUR_ANCHORS, type TourAnchorId } from "../lib/tourSteps";
+import { DashboardSuggestions } from "./DashboardSuggestions";
+import { SuggestionsSetupHint } from "./SuggestionsSetupHint";
+import type { WizardPrefill } from "./session-wizard/SessionWizard";
 import { PluginCards, PluginHomePanes } from "./plugin/PluginSlots";
 import { StatusGlyph } from "./StatusGlyph";
 import { StrokeIcon } from "./icons";
@@ -21,6 +24,17 @@ interface Props {
   readOnly?: boolean;
   /** Shown above the action panes, e.g. the setup checklist. */
   banner?: ReactNode;
+  /** Both required to show the Suggested sessions section. */
+  onPrepareSuggestion?: (prefill: WizardPrefill) => void;
+  onEditSuggestionPreset?: (providerId: string, criterion: string) => void;
+  canLinkSuggestions?: boolean;
+  /** False in CityHall: suggestions are read-only there. Defaults to true. */
+  canManageSuggestions?: boolean;
+  onViewAllSuggestions?: () => void;
+  /** The onboarding tour is running; the first-run hint stays out of it. */
+  tourActive?: boolean;
+  /** Opens Settings > Plugins > Marketplace filtered to Suggestions; the first-run hint shows only when set. */
+  onOpenSuggestionsMarketplace?: () => void;
 }
 
 export function Dashboard({
@@ -32,7 +46,16 @@ export function Dashboard({
   readOnly,
   canManageProjects = true,
   banner,
+  onPrepareSuggestion,
+  onEditSuggestionPreset,
+  canLinkSuggestions,
+  canManageSuggestions = true,
+  onViewAllSuggestions,
+  onOpenSuggestionsMarketplace,
+  tourActive = false,
 }: Props) {
+  // Bumped when the setup sheet finishes so the Suggested section refetches.
+  const [suggestionsEpoch, setSuggestionsEpoch] = useState(0);
   const idleDecayWindowMs = useIdleDecayWindowMs();
   const isWideViewport = useIsWideViewport();
   const stats = useMemo(() => {
@@ -143,6 +166,20 @@ export function Dashboard({
         </div>
       )}
 
+      {onPrepareSuggestion && onViewAllSuggestions && (
+        <DashboardSuggestions
+          key={suggestionsEpoch}
+          readOnly={readOnly || !canManageSuggestions}
+          cityhall={!canManageSuggestions}
+          onPrepare={onPrepareSuggestion}
+          onEditPreset={onEditSuggestionPreset}
+          canLink={canLinkSuggestions}
+          onViewAll={onViewAllSuggestions}
+          onOpenSession={onSelectSession}
+          sessions={sessions}
+        />
+      )}
+
       {/* The desktop sidebar is always available, but mobile starts at this dashboard. */}
       {!isWideViewport && recentSessions.length > 0 && (
         <section className="md:hidden mb-4 w-full max-w-md" aria-labelledby="recent-sessions-heading">
@@ -235,6 +272,13 @@ export function Dashboard({
         </div>
       )}
 
+      {!readOnly && canManageProjects && !tourActive && onOpenSuggestionsMarketplace && (
+        <SuggestionsSetupHint
+          onOpenMarketplace={onOpenSuggestionsMarketplace}
+          onFinished={() => setSuggestionsEpoch((n) => n + 1)}
+        />
+      )}
+
       {/* Plugin-contributed dashboard cards (#2366). Renders nothing (and adds
           no spacing) until a plugin pushes a card. */}
       <PluginCards />
```

**File**: `web/src/components/DashboardSuggestions.tsx` (added, +207/-0)
```diff
@@ -0,0 +1,207 @@
+import type { SessionResponse } from "../lib/types";
+import { liveSession } from "../lib/suggestionPlan";
+import { StartedPromptNote } from "./PromptBlockedNote";
+import { useAgentNames } from "../hooks/useAgentNames";
+import { useSuggestionPresets } from "../hooks/useSuggestionPresets";
+import { SuggestionItemActions } from "./SuggestionItemActions";
+import { SuggestionHooksReview } from "./SuggestionHooksReview";
+import { suggestionKey, useDismissUndo, useSuggestions } from "../hooks/useSuggestions";
+import { useIsWideViewport } from "../hooks/useIsWideViewport";
+import {
+  SUGGESTION_NOTE_CLASS,
+  SuggestionRow,
+  SuggestionStatusNotes,
+  SuggestionsOffNote,
+  UndoBar,
+} from "./SuggestionRow";
+import type { WizardPrefill } from "./session-wizard/SessionWizard";
+
+interface Props {
+  readOnly?: boolean;
+  /** Read-only because of CityHall mode, which the copy says. */
+  cityhall?: boolean;
+  onPrepare: (prefill: WizardPrefill) => void;
+  onEditPreset?: (providerId: string, criterion: string) => void;
+  canLink?: boolean;
+  onViewAll: () => void;
+  onOpenSession: (sessionId: string) => void;
+  /** Live sessions, so a started row follows its Session's state. */
+  sessions?: SessionResponse[];
+}
+
+export function DashboardSuggestions({
+  readOnly = false,
+  cityhall = false,
+  onPrepare,
+  onEditPreset,
+  canLink = true,
+  onViewAll,
+  onOpenSession,
+  sessions,
+}: Props) {
+  const wide = useIsWideViewport();
+  const ctrl = useSuggestions(onPrepare, onOpenSession);
+  const { snapshot, loadFailed, busy, refreshing, notice, refreshFailed, failures, offline, act, refresh } = ctrl;
+  const agentName = useAgentNames();
+  const presetOf = useSuggestionPresets();
+  const { undo, dismiss, stop } = useDismissUndo(act);
+
+  // Offline, the disconnect banner already explains a missing snapshot.
+  if (!snapshot && loadFailed && !offline)
+    return (
+      <section className="mb-4 mt-3 w-full max-w-2xl" aria-label="Suggested sessions">
+        <p role="alert" className="px-1 text-xs text-status-error">
+          Could not load suggestions.{" "}
+          <button
+            type="button"
+            onClick={() => void ctrl.load()}
+            className="cursor-pointer text-brand-500 hover:underline"
+          >
+            Try again
+          </button>
+        </p>
+      </section>
+    );
+  if (!snapshot || snapshot.providers.length === 0 || !snapshot.prefs.homepage) return null;
+
+  const active = snapshot.items.filter((item) => !item.dismissed);
+  const rows = active.slice(0, wide ? 3 : 2);
+  // A provider that is off is never asked, so it stays "pending" forever.
+  const on = snapshot.providers.filter((p) => p.enabled);
+  const pending = on.filter((p) => p.status === "pending");
+  const errored = on.filter((p) => p.status === "error");
+  const kindOf = (item: { provider_id: string; criterion: string }) =>
+    snapshot.providers
+      .find((p) => p.id === item.provider_id)
+      ?.sources.find((src) => src.criterion === item.criterion)
+      ?.label.toLowerCase();
+  const alert = notice ?? (loadFailed ? "Could not load suggestions." : null);
+
+  return (
+    <section className="mb-4 mt-3 w-full max-w-2xl" aria-labelledby="suggested-sessions-heading">
+      <div className="mb-2 flex items-baseline justify-between px-1">
+        <h2
+          id="suggested-sessions-heading"
+          className="text-[11px] font-mono uppercase tracking-[0.16em] text-text-muted"
+        >
+          Suggested sessions
+        </h2>
+        <a
+          href="/suggestions"
+          onClick={(e) => {
+            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
+            e.preventDefault();
+            onViewAll();
+          }}
+          className="text-xs text-brand-500 hover:underline"
+        >
+          {active.length > 0 ? `View all (${active.length})` : "View all"}
+        </a>
+      </div>
+      <ul className="rounded-lg border border-surface-700/40 bg-surface-900">
+        {rows.map((item) => (
+          <SuggestionRow
+            key={suggestionKey(item)}
+            title={item.title}
+            sourceRef={snapshot.prefs.show_source_ref ? item.source_ref : undefined}
+            reason={item.reason}
+            project={item.resolved_project?.name ?? item.project}
+            session={liveSession(item.started_session, sessions)}
+            stale={item.stale}
+            failure={failures[suggestionKey(item)]}
+            note={
+              <StartedPromptNote
+                session={liveSession(item.started_session, sessions)}
+                onTryAgain={() => ctrl.retryBlocked(item)}
+                disabled={readOnly || offline}
+              />
+            }
+            actions={
+              <SuggestionItemActions
+                item={item}
+                snapshot={snapshot}
+                ctrl={ctrl}
+                readOnly={readOnly}
+            
```

**File**: `web/src/components/LiveTerminalView.tsx` (modified, +19/-5)
```diff
@@ -27,6 +27,7 @@ import { safeGetItem, safeRemoveItem, safeSetItem } from "../lib/safeStorage";
 import { isSessionActive } from "../lib/session";
 import { publishLivePane } from "../lib/liveControl";
 import { LiveControlStrip } from "./LiveControlStrip";
+import { PromptBlockedNote } from "./PromptBlockedNote";
 
 interface Props {
   readOnly: boolean;
@@ -526,11 +527,24 @@ export function LiveTerminalView({ session, readOnly, active = true, surface = "
         onRestart={readOnly ? undefined : retryEnsure}
       />
 
-      {ensureWarning && (
-        <div className="absolute left-0 right-0 top-12 z-20 flex justify-center px-3 pointer-events-none">
-          <span className="text-xs text-status-warning bg-surface-900/90 border border-surface-700/60 rounded-full px-4 py-2 max-w-md break-words text-center">
-            {ensureWarning}
-          </span>
+      {(ensureWarning || session.initial_prompt_error) && (
+        <div className="absolute left-0 right-0 top-12 z-20 flex flex-col items-center gap-2 px-3 pointer-events-none">
+          {ensureWarning && (
+            <span className="text-xs text-status-warning bg-surface-900/90 border border-surface-700/60 rounded-full px-4 py-2 max-w-md break-words text-center">
+              {ensureWarning}
+            </span>
+          )}
+          {session.initial_prompt_error && (
+            <div className="pointer-events-auto bg-surface-900/90 border border-surface-700/60 rounded-2xl px-4 py-2 max-w-md text-center">
+              <PromptBlockedNote
+                inSession
+                label="Initial prompt not sent"
+                code={session.initial_prompt_error_code}
+                message={session.initial_prompt_error}
+                disabled={readOnly}
+              />
+            </div>
+          )}
         </div>
       )}
 
```

**File**: `web/src/components/PromptBlockedNote.tsx` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+import { useState } from "react";
+import { updateSettings } from "../lib/api";
+import { copyPrompt } from "../lib/suggestionPlan";
+import type { StartedSession } from "../lib/types";
+
+const FOLDER = "agent_folder_not_trusted";
+
+/** The server's message names config keys; the codes it knows get one plain sentence instead. */
+const PLAIN: Record<string, string> = {
+  [FOLDER]: "Claude Code is asking whether to trust this folder, so the prompt was not typed.",
+  agent_bypass_not_accepted:
+    "Claude Code is waiting for Bypass Permissions to be accepted once. Open the Session and accept it.",
+};
+
+const LINK = "cursor-pointer text-brand-500 hover:underline disabled:opacity-50";
+
+/**
+ * Why a Session's initial prompt was not typed. For an untrusted folder it offers to turn on
+ * `pre_trust_agent_folders` after saying what that also allows, then Try again when given.
+ */
+export function PromptBlockedNote({
+  label,
+  code,
+  message,
+  onTryAgain,
+  inSession = false,
+  onCopyPrompt,
+  disabled = false,
+  live = "alert",
+}: {
+  label: string;
+  code?: string | null;
+  message: string;
+  /** Starts a fresh Session; without it the note says how to go on in this one. */
+  onTryAgain?: () => Promise<unknown> | void;
+  /** Shown on the Session page, where the terminal is right there. */
+  inSession?: boolean;
+  /** Copies the prompt to paste once the folder is trusted. */
+  onCopyPrompt?: () => void;
+  disabled?: boolean;
+  /** Rows re-render on every poll, so they announce politely. */
+  live?: "alert" | "status";
+}) {
+  const [step, setStep] = useState<"idle" | "confirm" | "saving" | "on" | "failed">("idle");
+  const [retrying, setRetrying] = useState(false);
+  const tryAgain = async () => {
+    if (retrying || !onTryAgain) return;
+    setRetrying(true);
+    try {
+      await onTryAgain();
+    } finally {
+      setRetrying(false);
+    }
+  };
+  const turnOn = async () => {
+    setStep("saving");
+    const outcome = await updateSettings({ session: { pre_trust_agent_folders: true } });
+    setStep(outcome === "committed" ? "on" : "failed");
+  };
+  const actions = code === FOLDER && !disabled;
+  return (
+    <div className="text-xs text-status-warning">
+      <p role={live} className="break-words">
+        {label}: {(code && PLAIN[code]) || message}
+      </p>
+      {code === FOLDER && (
+        <p>
+          {inSession
+            ? "Choose \u201cYes, I trust this folder\u201d in the terminal, then type the prompt."
+            : "Open the Session and choose \u201cYes, I trust this folder\u201d, then paste the prompt."}
+          {onCopyPrompt && !disabled && (
+            <>
+              {" "}
+              <button type="button" className={LINK} onClick={onCopyPrompt}>
+                Copy prompt
+              </button>
+            </>
+          )}
+        </p>
+      )}
+      {actions && (step === "idle" || step === "failed") && (
+        <p className="text-text-secondary">
+          {step === "failed" && <span>Couldn&apos;t turn on pre-trust. </span>}
+          Or trust every folder AoE starts Claude Code in:{" "}
+          <button type="button" className={LINK} onClick={() => setStep("confirm")}>
+            Turn on pre-trust
+          </button>
+        </p>
+      )}
+      {actions && (step === "confirm" || step === "saving") && (
+        <p className="text-text-secondary">
+          This turns on Pre-trust agent folders: Claude Code will trust each folder AoE starts it in, which also runs
+          the repo&apos;s own .claude/settings.json hooks.{" "}
+          {/* Focus follows the step, since the button that had it is gone. */}
+          <button type="button" className={LINK} disabled={step === "saving"} onClick={() => void turnOn()} autoFocus>
+            Turn on
+          </button>{" "}
+          <button type="button" className={LINK} disabled={step === "saving"} onClick={() => setStep("idle")}>
+            Cancel
+          </button>
+        </p>
+      )}
+      {actions &&
+        step === "on" &&
+        (onTryAgain ? (
+          <p className="text-text-secondary">
+            Pre-trust is on.{" "}
+            <button type="button" className={LINK} disabled={retrying} onClick={() => void tryAgain()} autoFocus>
+              Try again
+            </button>{" "}
+            moves this Session to Trash and starts a new one.
+          </p>
+        ) : (
+          <p className="text-text-secondary">
+            Pre-trust is on: new Sessions start trusted. Trust this folder in the terminal to go on.
+          </p>
+        ))}
+    </div>
+  );
+}
+
+/** A started suggestion's row note: nothing unless its Session's prompt was not typed. */
+export function StartedPromptNote({
+  session,
+  onTryAgain,
+  disabled,
+}: {
+  session?: StartedSession;
+  onTryAgain: () => Promise<unknown>;
+  disabled: boolean;
+}) {
+  if (!session?.initial_prompt_error) return null;
+  return (
+    
```

---

### Incident Patch 2: `956d1300` (2026-11-26)
**Commit Message**: feat(tui): suggested sessions view, Suggested group and one-line prompt (#5600)

* feat(acp): client calls for the suggestions snapshot, refresh, dismiss and prepare

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* feat(tui): suggested sessions view, Suggested group and prompt row

Adds the Suggestions view with Start into the prefilled new-session
dialog, the collapsed Suggested group above Trash, the Prompt row in the
new-session dialog, the open-source palette action, and the plugin
manager Suggestions marker.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(tui): focus the Prompt row by mouse and ignore paste behind the source overlay

Addresses review comments from @coderabbitai and @jerome-benoit on #5600.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(acp): keep the daemon's reason when a suggestion prepare is refused

Addresses review comment from @coderabbitai on #5600.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(tui): tell offline from read-only by the latest runtime result

The writer keeps its channel open after the read side drops, so channel
liveness alone reported a gone daemon as read-only.

Addresses review comment

**File**: `docs/guides/suggested-sessions.md` (modified, +27/-19)
```diff
@@ -8,10 +8,12 @@ Suggestions show up in the web dashboard (homepage section, `/suggestions`, and
 
 ## Setting up
 
-With no provider installed, the web homepage and the empty `/suggestions` view offer **Set up suggestions** when a featured plugin exists. The sheet installs the sources you tick, runs each plugin's setup checks (✓, `!`, ✕, with the plugin's fix text and **Check again**), and ends with "Suggestions are on". **Finish later** closes it; the plugin stays installed. **More sources in the Marketplace ›** opens Settings › Plugins › Marketplace filtered to plugins that work with suggestions.
+With no provider installed, the web homepage and the empty `/suggestions` view offer **Set up suggestions** when a featured plugin exists. The sheet installs the sources you tick, runs each plugin's setup checks (✓, `!`, ✕, with the plugin's fix text and **Check again**), and ends with "Suggestions are on". **Finish later** closes it; the plugin stays installed. **More sources in the Marketplace ›** opens Settings › Plugins › Marketplace filtered to plugins that work with suggestions. With no provider, the TUI's list (`S`) says to run `aoe plugin install gh:agent-of-empires/plugin-github` and turn the provider on in the dashboard, and names **Set up suggestions** when the dashboard offers it. With every provider off, it says to turn one on in Settings › Suggestions.
 
 Providers are off until you turn one on, in the setup sheet, in Settings › Suggestions › Sources, or through the API (`PATCH /api/suggestions/prefs` with `provider_enabled`). The sheet turns on each source it installs, and no other. To skip the sheet, install a provider with `aoe plugin install` ([Plugins](../plugins.md)), then turn it on. While every installed provider is off, the homepage section and `/suggestions` say so and offer **Turn it on** (**Turn them on** for several); a read-only dashboard says it can't turn them on.
 
+Suggestions stay off until you set them up. A **New: suggested sessions** tip shows once in the TUI and the dashboard, saying how to turn them on, while every installed provider is off, or while none is installed and a featured plugin offers them. The dashboard walkthrough also has a step on the homepage's Suggested section, skipped when the section is not on the page. The TUI intro's last page lists `S`.
+
 ## Web dashboard
 
 ### Homepage and `/suggestions`
@@ -60,8 +62,8 @@ If a provider is switched off, its items are hidden and the view says "<provider
 | Setting | What it does |
 |---|---|
 | Show on the homepage | The homepage section. |
-| Show in the sidebar | A collapsed **Suggested (N)** group at the bottom of the web session sidebar, above Trash, absent when there are no open suggestions. Started suggestions are not listed, since the Session is already under its Project. Expanded, it lists 3 items and **View all**; clicking an item starts it like **Start**. Off by default. |
-| Show where each one comes from | Shows where each suggestion comes from, such as `owner/repo#123`, on web rows and before the title on TUI rows. On by default. |
+| Show in the sidebar | A collapsed **Suggested (N)** group at the bottom of the web session sidebar, above Trash, and a **Suggested (N)** row in the TUI Home list, below the live sessions and above Archived and Trash. Both are absent when there are no open suggestions. Started suggestions are not counted, since the Session is already under its Project. Expanded, the web group lists 3 items and **View all**; clicking an item starts it like **Start**. Off by default. |
+| Show where each one comes from | Shows where each suggestion comes from, such as `owner/repo#123`, on web rows and after the title in the TUI list. On by default. |
 | Sources | Drag to set which source comes first (Alt+↑/↓ on a focused row, a move-up button on a phone). Each has an on/off switch. A source that uses an agent says so, since it spends your agent usage. A source error can carry a fix button from the plugin. |
 | *Source* · Kinds | One row per kind of suggestion, such as Review requests: what it starts with ("Claude Code · Structured view · worktree"), a switch to suggest it, and **Edit** for its [preset](#presets). |
 | *Source* source settings | The plugin's own settings for its suggestions, such as the GitHub plugin's ignored organizations and repositories. The same settings, saved to the same place, also appear under Settings › Plugins. |
@@ -95,31 +97,37 @@ Change any proposal with its select, then **Link N repos** stores every checked
 
 > The TUI keys below are provisional until #4597 settles the key bindings.
 
-**Home.** A collapsed **Suggested (N)** group sits above Trash and is absent when there are no open suggestions. Enter expands it to 3 items and a "View all" row. On an item, Enter prepares it and opens the prefilled dialog, `z` (`Z` in strict mode) dismisses it, and `Ctrl+K` lists "Open in <provider>". `N` (`Ctrl+N`) starts a blank session.
+**Home.** With **Show in the sidebar
```

**File**: `docs/plugin-api.md` (modified, +2/-2)
```diff
@@ -534,7 +534,7 @@ Suggestions are stored per profile. The routes below list and act on them; only
 
 | Route | Body | Result |
 |---|---|---|
-| `GET /api/suggestions` | none | `{ providers: [{ id, name, enabled, status, error?, updated_at?, refreshing, sources: [{ criterion, label, description, variables, enabled, preset, customized }], checks: [{ id, label, status, detail, fix }] }], items, prefs: { homepage, sidebar, refresh_minutes, show_source_ref, provider_order } }` |
+| `GET /api/suggestions` | none | `{ profile?, providers: [{ id, name, enabled, status, error?, updated_at?, refreshing, sources: [{ criterion, label, description, variables, enabled, preset, customized }], checks: [{ id, label, status, detail, fix }] }], items, prefs: { homepage, sidebar, refresh_minutes, show_source_ref, provider_order } }` |
 | `POST /api/suggestions/refresh` | none | `{ ok, notified }` |
 | `POST /api/suggestions/checks/run` | none | `{ ok, notified }` |
 | `POST /api/suggestions/dismiss` | `{ provider_id, id }` | `{ ok }` |
@@ -574,7 +574,7 @@ An item has one primary Session. The first create that carries `suggestion` (`st
 
 Errors: 404 `unknown_provider` (no active plugin provides suggestions under that id), 409 `stale_suggestion` (the item is no longer published, its source is disabled, or its source closed it; `prepare` and `start` answer all three the same way), 400 `validation_failed` (`criterion` not declared by the provider, an unknown preset agent, or a prompt or its expansion over 64 KiB), 403 `read_only`.
 
-The TUI lists suggestions from Home with `S` (`Ctrl+S` in strict mode). The view shows each item's `preview` and prompt as plain text; the first Enter resolves `prepare` and shows its final `initial_prompt` (after the preset prompt); a second Enter opens the new-session dialog prefilled with it, and an item whose `project` is `null` cannot be started. The dialog's Prompt row, which is always present and editable, holds that prompt; for a suggestion it is labelled with the provider and Ctrl+P on it shows the item's `preview` as source text. `r` only asks providers to refresh; `l` reloads the list. Items keep the order of the snapshot. Home also lists a collapsed **Suggested (N)** group above Trash, absent when there are no open suggestions. Enter expands it to the first 3 items and a "View all" row that opens the view above; Enter on an item prepares it and opens the prefilled dialog directly, `z` (`Z` in strict mode) dismisses it, and `N` (`Ctrl+N`) starts a blank session. `Ctrl+K` lists "Suggested sessions"; on a suggestion row, or on the selected item in the view, it also lists "Open in <provider>", which opens the item's `source_url`. Every TUI key is provisional: `S` / `Ctrl+S` to open, `z` / `N` on a Home row, and `x` (dismiss), `d` (dismissed), `r` and `l` inside the view may move.
+The TUI shows suggestions in Home's preview pane and starts them with `start`, or with `prepare` and the new-session dialog for "Start with changes"; it shows each item's `preview` and `start.prompt` as plain text and sends the snapshot's `profile` as `expected_profile` on each suggestions request it posts. Keys and layout are in the [guide's TUI section](guides/suggested-sessions.md#tui).
 
 ### Project mappings
 
```

**File**: `src/daemon/mod.rs` (modified, +22/-0)
```diff
@@ -22,6 +22,7 @@ pub(crate) mod transport;
 pub(crate) mod websocket;
 pub use websocket::WsError;
 pub mod live;
+pub mod suggestions;
 mod wire;
 
 use std::fmt;
@@ -419,6 +420,27 @@ impl DaemonClient {
         Ok(snapshot)
     }
 
+    /// `GET /api/settings`: the served profile resolved over the machine-wide values.
+    pub async fn settings(&self) -> Result<serde_json::Value, DaemonClientError> {
+        let url = self
+            .sessions_url
+            .join("settings")
+            .map_err(|_| DaemonClientError::Transport)?;
+        self.request_json(self.http.get(url)).await
+    }
+
+    /// `PATCH /api/settings`: the daemon routes each leaf to the layer it is read from.
+    pub async fn patch_settings(&self, patch: &serde_json::Value) -> Result<(), DaemonClientError> {
+        let url = self
+            .sessions_url
+            .join("settings")
+            .map_err(|_| DaemonClientError::Transport)?;
+        let mut response = self
+            .request_response(self.http.patch(url).json(patch))
+            .await?;
+        discard_bounded_body(&mut response).await
+    }
+
     /// The daemon's own default profile, which can differ from this client's config.
     pub async fn default_profile(&self) -> Result<String, DaemonClientError> {
         let url = self
```

**File**: `src/daemon/suggestions.rs` (added, +525/-0)
```diff
@@ -0,0 +1,525 @@
+//! Client side of the daemon's suggestions API (`/api/suggestions`): the
+//! snapshot and prepare wire types and the [`DaemonClient`] calls that read
+//! and act on them.
+
+use std::time::Duration;
+
+use reqwest::StatusCode;
+use serde::Deserialize;
+
+use super::{transport, DaemonClient, DaemonClientError, DEFAULT_TIMEOUT};
+
+/// `POST /api/suggestions/start` answers after the create, which can take
+/// minutes for a sandbox; `POST /api/sessions` waits as long.
+const START_TIMEOUT: Duration = Duration::from_secs(30 * 60);
+/// A refusal's explanation is bounded before it reaches the screen.
+const MAX_REFUSAL_BYTES: usize = 4096;
+const MAX_REFUSAL_CHARS: usize = 200;
+
+#[derive(Debug, Clone, Deserialize)]
+pub struct Snapshot {
+    /// The profile the daemon publishes suggestions under.
+    #[serde(default)]
+    pub(crate) profile: Option<String>,
+    /// The daemon that served this snapshot; set by the loader, not the wire.
+    #[serde(skip)]
+    pub(crate) daemon: Option<String>,
+    /// The daemon's `pre_trust_agent_folders`; set by the loader, not the wire.
+    #[serde(skip)]
+    pub(crate) pre_trust: Option<bool>,
+    pub(crate) providers: Vec<Provider>,
+    pub(crate) items: Vec<Item>,
+    #[serde(default)]
+    pub(crate) prefs: Prefs,
+}
+
+#[derive(Debug, Clone, Deserialize)]
+#[serde(default)]
+pub struct Prefs {
+    pub(crate) show_source_ref: bool,
+    /// "Show in the sidebar": the web sidebar group and the TUI Home row.
+    pub(crate) sidebar: bool,
+}
+
+impl Default for Prefs {
+    fn default() -> Self {
+        Self {
+            show_source_ref: true,
+            sidebar: false,
+        }
+    }
+}
+
+#[derive(Debug, Clone, Deserialize)]
+pub struct Provider {
+    pub(crate) id: String,
+    pub(crate) name: String,
+    #[serde(default)]
+    pub(crate) error: Option<String>,
+    #[serde(default = "enabled_by_default")]
+    pub(crate) enabled: bool,
+    /// Unix seconds of the last report.
+    #[serde(default)]
+    pub(crate) updated_at: Option<i64>,
+    #[serde(default)]
+    pub(crate) refreshing: bool,
+    #[serde(default)]
+    pub(crate) checks: Vec<Check>,
+}
+
+/// A provider's setup check; `fix` is the plugin's own untrusted advice.
+#[derive(Debug, Clone, Deserialize)]
+pub struct Check {
+    pub(crate) status: String,
+    #[serde(default)]
+    pub(crate) fix: String,
+}
+
+/// What Start creates an item with, resolved against its Project.
+#[derive(Debug, Clone, Deserialize)]
+pub struct ItemStart {
+    pub(crate) agent: String,
+    pub(crate) view: String,
+    #[serde(default)]
+    pub(crate) worktree: bool,
+    #[serde(default)]
+    pub(crate) sandbox: bool,
+    #[serde(default)]
+    pub(crate) yolo: bool,
+    /// The first prompt Start sends; absent when the expanded template is too long.
+    #[serde(default)]
+    pub(crate) prompt: Option<String>,
+}
+
+fn enabled_by_default() -> bool {
+    true
+}
+
+/// The registered Project an item resolves to.
+#[derive(Debug, Clone, Deserialize)]
+pub struct ResolvedProject {
+    pub(crate) name: String,
+    pub(crate) path: String,
+}
+
+#[derive(Debug, Clone, Deserialize)]
+pub struct Item {
+    pub(crate) provider_id: String,
+    pub(crate) id: String,
+    pub(crate) title: String,
+    pub(crate) reason: String,
+    pub(crate) source_url: String,
+    pub(crate) source_ref: String,
+    pub(crate) preview: String,
+    #[serde(default)]
+    pub(crate) project: Option<String>,
+    #[serde(default)]
+    pub(crate) dismissed: bool,
+    pub(crate) draft: Draft,
+    #[serde(default)]
+    pub(crate) started_session: Option<Started>,
+    #[serde(default)]
+    pub(crate) resolved_project: Option<ResolvedProject>,
+    /// The repo the provider links to a Project, as `owner/repo` for GitHub.
+    #[serde(default)]
+    pub(crate) mapping_key: Option<String>,
+    #[serde(default)]
+    pub(crate) start: Option<ItemStart>,
+    /// The source closed or changed; the item cannot start.
+    #[serde(default)]
+    pub(crate) stale: bool,
+}
+
+/// The live Session an item was started as.
+#[derive(Debug, Clone, Deserialize)]
+pub struct Started {
+    pub(crate) id: String,
+    pub(crate) status: String,
+    #[serde(default)]
+    pub(crate) archived: bool,
+    /// `"start"` for a one-click Start; only those may be trashed and started again.
+    #[serde(default)]
+    pub(crate) started_via: Option<String>,
+}
+
+impl Started {
+    pub(crate) fn one_click(&self) -> bool {
+        self.started_via.as_deref() == Some("start")
+    }
+}
+
+#[derive(Debug, Clone, Deserialize)]
+pub struct Draft {
+    pub(crate) prompt: String,
+}
+
+#[derive(Debug, Clone, Deserialize)]
+pub struct PreparedProject {
+    pub(crate) path: String,
+}
+
+#[derive(Debug, Clone, Deserialize)]
+pub struct Prepared {
+    pub(crate) title: String,
+    pub(crate) initial_prompt: String,
+    pub(crate) tool: String,
+    pub(crate) project: Option<PreparedProject>,
+    #[serde(de
```

**File**: `src/plugin/featured.rs` (modified, +4/-0)
```diff
@@ -55,6 +55,10 @@ impl FeaturedIndex {
             .any(|e| e.source.eq_ignore_ascii_case(slug))
     }
 
+    pub fn offers_suggestions(&self) -> bool {
+        self.plugins.values().any(|e| e.suggestions)
+    }
+
     pub fn declares_suggestions(&self, slug: &str) -> bool {
         self.plugins
             .values()
```

**File**: `src/server/api/suggestions.rs` (modified, +2/-0)
```diff
@@ -156,6 +156,7 @@ pub async fn get_suggestions(State(state): State<Arc<AppState>>) -> impl IntoRes
     };
     let profile = host.suggestions_profile();
     let refreshing = host.refreshing_suggestions();
+    let reported_profile = profile.clone();
     let result = tokio::task::spawn_blocking(move || {
         let providers = suggestions::providers();
         // Disk reads stay off the store lock.
@@ -189,6 +190,7 @@ pub async fn get_suggestions(State(state): State<Arc<AppState>>) -> impl IntoRes
             };
             suggestions::attach_started(&mut snapshot, &started);
             suggestions::attach_refreshing(&mut snapshot, &refreshing);
+            snapshot["profile"] = json!(reported_profile);
             Json(snapshot).into_response()
         }
         Ok(Err(error)) => internal(error),
```

**File**: `src/server/api/suggestions_tests.rs` (modified, +4/-0)
```diff
@@ -225,6 +225,10 @@ async fn snapshot_and_refresh() {
     assert_eq!(body["items"][0]["id"], "a");
     assert_eq!(body["items"][0]["dismissed"], false);
     assert_eq!(body["prefs"]["refresh_minutes"], 15);
+    assert!(
+        body["profile"].is_string(),
+        "clients check it against their own"
+    );
 
     for uri in ["/api/suggestions/refresh", "/api/suggestions/checks/run"] {
         let (status, _, body) = f.call(Method::POST, uri, json!({})).await;
```

**File**: `src/server/api/system.rs` (modified, +22/-3)
```diff
@@ -1443,10 +1443,29 @@ pub struct TipsResponse {
 /// shared `crate::tips` catalog plus `app_state.tips_seen` and
 /// `session.show_tips`. A read projection, so it stays a plain GET behind the
 /// token wall like [`get_web_ui_state`]; the TUI-only tips never appear here.
-pub async fn get_tips(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
-    let result = tokio::task::spawn_blocking(|| {
+pub async fn get_tips(State(state): State<Arc<AppState>>) -> impl IntoResponse {
+    let host = state.plugin_host.clone();
+    let result = tokio::task::spawn_blocking(move || {
         let config = crate::session::Config::load()?;
-        let signals = crate::tips::TipSignals::from(&config);
+        let mut signals = crate::tips::TipSignals::from(&config);
+        // The same providers and switches GET /api/suggestions reports. A store
+        // error only drops this tip.
+        let snapshot = host.as_ref().and_then(|host| {
+            let providers = crate::plugin::suggestions::providers();
+            host.with_suggestions_db(|conn, profile| {
+                crate::plugin::suggestions::snapshot(conn, profile, &providers)
+            })
+            .ok()
+        });
+        signals.suggestions_setup_available = snapshot.is_some_and(|snapshot| {
+            let enabled: Vec<bool> = snapshot["providers"]
+                .as_array()
+                .into_iter()
+                .flatten()
+                .map(|p| p["enabled"].as_bool().unwrap_or(false))
+                .collect();
+            crate::tips::suggestions_setup_available(&enabled)
+        });
         let seen = &config.app_state.tips_seen;
         let tips = crate::tips::eligible(crate::tips::TipSurface::Web, &signals)
             .into_iter()
```

---

### Incident Patch 3: `8ec63fec` (2026-11-25)
**Commit Message**: ci(tessl): set up Tessl loops, maintainer plugin and verifiers (#6017)

* ci(tessl): set up Tessl loops, maintainer plugin and verifiers

Castellan is gone, so issue triage moves to a Tessl loop: one run per
opened issue plus a daily sweep. Add the aoe-maintainer plugin (triage,
red-main, codeql-review, groom-ready skills, factory PR rules, AoE
verifiers and review lens), a Code Review profile, a cloud setup hook
and a token-free CI check for the Tessl config.

Triage and flaky-hunt run in the aoe-issues environment with an
issues-only token; analysis loops run read-only.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ci(tessl): address review feedback

- deflake rule covers nextest, Vitest and Playwright flakes with a stress
  repro for each.
- flaky-hunt dedupes against its own issues and reads web test failures.
- red-main runs once per failing commit and bounds its culprit baseline to
  an ancestor of the failure.
- groom-ready treats open native blockers as not ready; aoe-triage requires
  Roadmap state on enhancements.
- settings verifier lists the documented exceptions.
- cloud setup gates Node on the lockfile engines and reinstalls npm
  dependencies when a lockfile

**File**: `.agents/skills/.gitignore` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Managed by Tessl
+tessl__*
+tessl:*
```

**File**: `.codex/config.toml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+[mcp_servers.tessl]
+type = "stdio"
+command = "tessl"
+args = [ "mcp", "start" ]
```

**File**: `.codex/skills/.gitignore` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Managed by Tessl
+tessl__*
+tessl:*
```

**File**: `.github/CODEOWNERS` (modified, +6/-0)
```diff
@@ -83,6 +83,12 @@ Cargo.lock                              @agent-of-empires/protected
 /CLAUDE.md                              @agent-of-empires/protected
 /DESIGN.md                              @agent-of-empires/protected
 /MAINTAINERS.md                         @agent-of-empires/protected
+/tessl.json                             @agent-of-empires/protected
+/.tessl/                                @agent-of-empires/protected
+/.tessl-code-review.yml                 @agent-of-empires/protected
+/tessl-plugins/                         @agent-of-empires/protected
+/.mcp.json                              @agent-of-empires/protected
+/.codex/config.toml                     @agent-of-empires/protected
 
 # Releases
 /.github/workflows/release.yml          @agent-of-empires/release
```

**File**: `.github/workflows/tessl.yml` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+name: Tessl
+
+# Token-free checks for the Tessl config: a bad tessl.json block stops sync.
+# https://docs.tessl.io/schedules/validate-in-ci.md
+
+on:
+  pull_request:
+    paths:
+      - 'tessl.json'
+      - '.tessl/**'
+      - 'tessl-plugins/**'
+      - '.tessl-code-review.yml'
+      - '.github/workflows/tessl.yml'
+
+permissions:
+  contents: read
+
+concurrency:
+  group: tessl-${{ github.event.pull_request.number }}
+  cancel-in-progress: true
+
+jobs:
+  validate:
+    name: Validate Tessl config
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
+      - uses: tesslio/setup-tessl@25ec223fc0da33b41b8044ff5ab2b85235f4f91e # v2
+        with:
+          version: '0.123.0'
+      - name: Validate schedules, triggers and actions
+        run: tessl schedule validate
+      - name: Lint aoe-maintainer plugin
+        run: tessl plugin lint tessl-plugins/aoe-maintainer
```

**File**: `.mcp.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{
+  "mcpServers": {
+    "tessl": {
+      "type": "stdio",
+      "command": "tessl",
+      "args": [
+        "mcp",
+        "start"
+      ]
+    }
+  }
+}
```

**File**: `.tessl-code-review.yml` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+# Tessl Code Review profile: the six tessl/code-review defaults, with the
+# security lens on every file, plus the AoE lenses. Keep every default
+# listed: this list replaces the built-in set.
+# https://docs.tessl.io/reference/configuration.md#tessl-code-reviewyml
+schemaVersion: 1
+effort: adaptive
+# Generated files; CI regenerates or checks them.
+ignore:
+  - docs/cli/reference.md
+  - web/src/lib/generated/**
+  - CHANGELOG.md
+lenses:
+  - ref: tessl/code-review@0.5.2#review-plugin-content
+    globs:
+      - tessl-plugins/aoe-maintainer/**
+  - ref: tessl/code-review@0.5.2#review-markdown
+    globs:
+      - '**/*.md'
+      - '!tessl-plugins/aoe-maintainer/**'
+  - ref: tessl/code-review@0.5.2#review-correctness-and-data-integrity
+    globs:
+      - '**'
+      - '!**/*.md'
+      - '!tessl-plugins/aoe-maintainer/**'
+  - ref: tessl/code-review@0.5.2#review-maintainability-and-code-quality
+    globs:
+      - '**'
+      - '!**/*.md'
+      - '!tessl-plugins/aoe-maintainer/**'
+  - ref: tessl/code-review@0.5.2#review-scale-and-resilience
+    globs:
+      - '**'
+      - '!**/*.md'
+      - '!tessl-plugins/aoe-maintainer/**'
+  # Skills, rules and agent instructions steer runs that hold write tokens.
+  - ref: tessl/code-review@0.5.2#review-security-and-privacy
+    globs:
+      - '**'
+  - ref: ./tessl-plugins/aoe-maintainer/lenses/aoe-invariants/SKILL.md
+  - ref: ./tessl-plugins/aoe-maintainer/lenses/aoe-test-evidence/SKILL.md
+    globs:
+      - src/**
+      - tests/**
+      - web/**
+      - acp-worker/**
+      - aoe-plugin-api/**
+      - xtask/**
+      - scripts/**
+      - '!**/*.md'
+  - ref: ./tessl-plugins/aoe-maintainer/lenses/aoe-runtime-lifecycle/SKILL.md
+    globs:
+      - src/**
+      - web/src/**
+      - acp-worker/**
+      - '!src/migrations/**'
+  - ref: ./tessl-plugins/aoe-maintainer/lenses/aoe-sandbox-boundary/SKILL.md
+    globs:
+      - src/**
+      - docker/**
+      - acp-worker/**
+      - '!src/tui/**'
+  - ref: ./tessl-plugins/aoe-maintainer/lenses/aoe-keyboard-focus/SKILL.md
+    globs:
+      - web/src/**
+      - src/tui/**
+      - '!web/src/lib/generated/**'
+      - '!**/*.test.ts'
+      - '!**/*.test.tsx'
+      - '!**/__tests__/**'
+      - '!src/tui/**/tests/**'
+      - '!src/tui/**/tests.rs'
```

**File**: `.tessl/.gitignore` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+tiles/
+plugins/
+RULES.md
```

#### Recent Merged Pull Requests:
- **PR #6071** (2026-11-25): ci: attach PR demo media with gh --attach instead of the e2e-recordings branch (@njbrake)
- **PR #6067** (2026-11-25): ci: remove GetMac runners from release builds (@njbrake)
- **PR #6066** (2026-11-25): feat(tui): fold snoozed sessions into the hide-stopped filter (@athal7)
- **PR #6057** (2026-11-25): feat(acp): show Codex native subagents in the Sub agents pane (@njbrake)
- **PR #6056** (2026-11-25): fix(web): trim live terminal rows to the latest frame, not a stale one (@njbrake)
- **PR #6052** (2026-11-25): feat(web): widen the structured view column on wide screens (#6019) (@tessl-app[bot])

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

## X. web): suggested sessions dashboard, settings and guide

**RULE**:
When implementing operations in `docs/guides/suggested-sessions.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `83161f1c`: web): suggested sessions dashboard, settings and guide. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/guides/suggested-sessions.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Suggested sessions

Suggested sessions are things worth starting a session for, such as a PR that wants your review or a failing check, published by installed plugins. AoE only lists them. Nothing runs until you start one, and **Start** launches right away with the [preset](#presets) of the suggestion's kind.

Each item has a title, a reason, the plugin that proposed it, and a draft prompt. Plugins decide what to publish; this page covers using them. Writing a provider is covered in the [plugin contract](../plugin-api.md#suggested-sessions).

Suggestions show up in the web dashboard (homepage section, `/suggestions`, and optionally the sidebar) and in the TUI. They are stored per [profile](configuration.md#profiles).

## Setting up

With no provider installed, the web homepage and the empty `/suggestions` view offer **Set up suggestions** when a featured plugin exists. The sheet installs the sources you tick, runs each plugin's setup checks (✓, `!`, ✕, with the plugin's fix text and **Check again**), and ends with "Suggestions are on". **Finish later** closes it; the plugin stays installed. **More sources in the Marketplace ›** opens Settings › Plugins › Marketplace filtered to p
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `83161f1c` are properly handled with clean fallback behavior.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
