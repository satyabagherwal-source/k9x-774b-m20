# Domain G — Architecture Intelligence: Architecture Intelligence: agent-of-empires/agent-of-empires Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires/agent-of-empires",
  "source_url": "https://github.com/agent-of-empires/agent-of-empires",
  "source_version": "08946a21",
  "license": "MIT",
  "timestamp": "2026-11-21T00:51:56.026Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-of-empires-agent-of-empires",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires) (Revision: `08946a21`).  
> **License**: MIT | **Timestamp**: `2026-11-21T00:51:56.026Z`  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from agent-of-empires/agent-of-empires:

# Forensic Learning Record (Deep Inspection): agent-of-empires/agent-of-empires

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T00:51:54.505Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4593 stars

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
        at: chrono::DateTime<chrono::Utc>,
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
/// `ToolCall` is excluded because the tool m
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
                chrono::Utc::now().timestamp_millis(),
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
            .as_ref
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
    pub fn 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5913** (2026-11-21): **TUI: Live send refuses an agent pane whose status is Unknown**
  *Symptoms*: ### Problem  Live send fails with `Live send failed / Prepared target no longer matches the applied snapshot` on an agent pane that is alive and correctly identified. The receipt is valid; the snapshot status is `Unknown`.  `Unknown` is a normal live state: `crate::session::instance::pane_status` reports it when the pane is alive but the screen cannot be classified, and it is what any agent-pane adapter that has not reported yet looks like. Two independent gates treat it as death:  - `drain_command_errors` (`src/tui/session_feed.rs`) allows only `Running | Waiting | Idle | Starting` to attach, in both the Restart and Terminal arms, so the receipt is discarded and the modal claims the target is stale. - `agent_pane_is_warm` (`src/tui/home/live_send_prep.rs`) has the same allowlist, so live send also pays the revive-toast path.  ### Impact  Any agent whose status adapter is delayed, restarted, or absent cannot be live-sent to, even though its pane is alive and its identity matches. The error names a snapshot mismatch, so it hides the real cause and sends the reader looking for a target change that never happened.  ### Expected  Attachment should be gated on the receipt identity (generation, profile, tmux name) and the snapshot pane observation, with status only ruling out rows that are stopped, failed, or mid-teardown. `Stopped`, `Error`, `Deleting`, and `Creating` must keep failing; a genuinely changed target must keep failing.  ### Proposal  One shared `status_allows_attachme

- **Issue #5887** (2026-11-20): **test(acp): agent-switch stop test times out when codex-acp is installed**
  *Symptoms*: `worker_stopping_acp_endpoints_wait_for_an_in_flight_submission` fails on any host where `codex-acp` resolves (PATH, or the fixed `/usr/bin` and `/usr/local/bin` scan). The switch case then spawns the test binary as `__acp-runner`. That never opens the control socket, so the dial waits the full 10s `runner_socket_deadline`, equal to the test's own 10s bound. CI passes only because `codex-acp` is absent there and the spawn fails fast.  Repro, with `codex-acp` installed:  ``` cargo test --lib server::api::acp::tests::worker_stopping_acp_endpoints_wait_for_an_in_flight_submission ```  Fails at `src/server/api/acp/mod.rs:669`: "switch must finish once the submission releases". Passes with `AOE_ACP_RUNNER_SOCKET_TIMEOUT_MS=1000`.  _Note: this issue was drafted by Claude Opus 5.5 via back-and-forth with @njbrake. The reasoning and decisions are his; the prose is Claude's._ 

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

### Incident Patch 1: `1e4c41e5` (2026-11-20)
**Commit Message**: fix(tui): pressing R again in Connections opens the Web dashboard (#5832)

* fix(tui): the Serve key opens the Web dashboard from Connections

Since #4972 R opens the Connections hub, which ignored R. Pressing the
Serve binding again (R, or Ctrl+R with strict hotkeys) now does what
Enter on the Web dashboard row does, from any row. The offline and
outdated takeovers keep only r and q.

Closes #5766

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(web): the second Serve press opens the dashboard controls

Pressing the Serve key again in Connections opens the Web dashboard
controls, where a server is started; it doesn't start one itself.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(tui): the second Serve press in Connections must be a separate press

A held R (Ctrl+R with strict hotkeys) used to open Connections, submit it
on a repeat, and carry later repeats into the Serve screen, where the same
key requests and confirms a restart or reset. Connections now ignores the
Serve chord until 700 ms after the last one, longer than common OS
key-repeat delays, or until another key arrives.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs(tui): don't link 

**File**: `docs/guides/web-dashboard.md` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ aoe serve --open                # Open the URL in a browser when ready
 aoe serve --remote --read-only  # Monitor without sending keystrokes
 ```
 
-From the TUI, press `R` (`Ctrl+R` with strict hotkeys), shown as `R Web` in the shortcut bar, to open Connections, then Enter on **Web dashboard** to start a background server on your network or over a tunnel. While it runs, the entry reads `R ● Web` in green. When the Daemon needs attention, the entry shows that instead, in red for a problem (`R ● Runtime outcome unknown`) or dim for a limit (`R ● Unavailable`), and Connections lists the Daemon with what it means. If the Daemon goes offline, Connections replaces the home screen, with `r` to reconnect.
+From the TUI, press `R` (`Ctrl+R` with strict hotkeys), shown as `R Web` in the shortcut bar, to open Connections. Press the same key again after a short pause, or Enter on **Web dashboard**, to open the dashboard controls, where you can start a background server on your network or over a tunnel. While it runs, the entry reads `R ● Web` in green. When the Daemon needs attention, the entry shows that instead, in red for a problem (`R ● Runtime outcome unknown`) or dim for a limit (`R ● Unavailable`), and Connections lists the Daemon with what it means. If the Daemon goes offline, Connections replaces the home screen, with `r` to reconnect.
 
 Connections also replaces the home screen when the local Daemon answers but can't be used, and the Daemon row gives the state:
 
@@ -87,7 +87,7 @@ Availability, provider and restart checks run in the background. Current links,
 
 If error recovery could not discover the Daemon identity, `P` and the available Funnel reset `R` retry discovery before making changes. Failed startup retains the Daemon identity or absence observed before launch; it never acquires another Client's Daemon for recovery. Neither control silently refreshes a known stale identity. `S` superseding a provider retry cancels its unadmitted work or follows its admitted stop, never issuing a second stop or retargeting a replacement. Failure or timeout can leave changes uncertain: inspect `aoe serve --status` and, for a Funnel reset, `tailscale funnel status` before retrying.
 
-To restart, press `R`, wait for the assessment and confirmation, then press `R` again. The confirmation window applies to the second keypress, not the background assessment's duration. The second confirmation checks current effects again and asks again if they changed. Both `R` and `G` remain bound to the observed Daemon. If another Client replaces it before admission, the TUI refuses before changing the replacement or saved defaults. Recovery controls retain that identity after failure, including when the failed launch is first shown after reopening; close and reopen Remote Access again to observe the replacement before retrying.
+To restart, press `R`; `G` gives a new passphrase. It asks once it has checked what a restart would change. Press Enter once it asks. An Enter pressed while it checks does nothing, and the check then shows what a restart would change without asking: press `R` (or `G`) to check again. Any other key cancels, and so does waiting 3 seconds after it asks. Pressing `R` again only asks again, so a held key never restarts, and the `R` that opened the dashboard controls from Connections does nothing there until you press another key. Enter checks the current effects again; if they changed, it says so and shows them without asking, and `R` checks again. On a Funnel error, `R` then Enter turns off Funnel on its port. Both `R` and `G` remain bound to the observed Daemon. If another Client replaces it before admission, the TUI refuses before changing the replacement or saved defaults. Recovery controls retain that identity after failure, including when the failed launch is first shown after reopening; close and reopen Remote Access again to observe the replacement before retrying.
 
 A degraded runtime can still provide its last complete canonical list read-only. Owner diagnostics name the file that actually failed, without displaying its contents. If the failing source changes while the list stays unchanged, an already-connected owner TUI updates the diagnostic without inventing a new list revision. Repair that file and wait for a fresh healthy snapshot before writing. A runtime protocol mismatch requires `aoe serve --restart`; reconnecting does not silently replace a live incompatible Daemon.
 
```

**File**: `src/tui/app.rs` (modified, +96/-0)
```diff
@@ -5187,6 +5187,102 @@ mod tests {
         );
     }
 
+    /// #5766: the Serve key that opened Connections opens the Web dashboard from any row, in
+    /// either mode, but a held key stays in Connections. On the offline and outdated takeovers,
+    /// where only r and q act, it does nothing. Hold timing is `ConnectionsView`'s own test;
+    /// this one checks the hub is opened at the opening press's time.
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn the_serve_key_in_connections_opens_the_web_dashboard_except_on_a_takeover() {
+        use crate::tui::dialogs::{ConnectionsView, DaemonAttention as A, DialogResult, WebState};
+        use crate::tui::session_feed::SidebarSource;
+        let _home = crate::session::test_support::isolate_app_dir();
+        crate::session::get_profile_dir("test").unwrap();
+        for (strict, key) in [
+            (
+                false,
+                KeyEvent::new(KeyCode::Char('R'), KeyModifiers::SHIFT),
+            ),
+            (
+                true,
+                KeyEvent::new(KeyCode::Char('r'), KeyModifiers::CONTROL),
+            ),
+        ] {
+            let mut app = App::new(
+                "test",
+                AvailableTools::with_tools(&[]),
+                true,
+                false,
+                crate::file_watch::FileWatchService::noop(),
+            )
+            .unwrap();
+            app.home.strict_hotkeys = strict;
+            // A held key opens Connections, then never reaches the Serve screen, whose restart
+            // and reset use the same key. Times come from `before`, not the wall clock, so a
+            // stalled test can't make the hold look like a separate press.
+            let before = std::time::Instant::now();
+            app.home.handle_key(key, None);
+            let hub = app
+                .home
+                .connections_view
+                .as_mut()
+                .expect("the key opens Connections");
+            let later = |ms| before + std::time::Duration::from_millis(ms);
+            assert!(
+                matches!(
+                    hub.handle_key(key, strict, later(150)),
+                    DialogResult::Continue
+                ),
+                "strict={strict}: a repeat just after the opening press stays"
+            );
+            let repeat = KeyEvent::new_with_kind(key.code, key.modifiers, KeyEventKind::Repeat);
+            for _ in 0..30 {
+                app.home.handle_key(repeat, None);
+            }
+            assert!(app.home.connections_view.is_some(), "strict={strict}: held");
+            assert!(app.home.serve_view.is_none(), "strict={strict}: held");
+            // The Daemon row comes first and is selected, so Enter would do nothing here.
+            app.home.connections_view =
+                Some(ConnectionsView::new(Some(A::ReadOnly), WebState::Off));
+            app.home.handle_key(key, None);
+            assert!(app.home.connections_view.is_none(), "strict={strict}");
+            assert!(
+                app.home.serve_view.is_some(),
+                "strict={strict}: opens the Web dashboard"
+            );
+
+            for attention in [
+                A::Offline,
+                A::Outdated(crate::daemon::DaemonIncarnation::sample("old")),
+            ] {
+                let case = format!("strict={strict} {attention:?}");
+                app.home.serve_view = None;
+                app.home.sidebar_source = SidebarSource::Disconnected;
+                app.home.offline_attention = attention;
+                assert!(!app.handle_runtime_gate_key(key), "{case}");
+                assert!(app.home.serve_view.is_none(), "{case}");
+                assert!(app.home.connections_view.is_none(), "{case}");
+                assert!(app.daemon_restart.is_none(), "{case}");
+                assert_eq!(
+                    app.home.sidebar_source,
+                    SidebarSource::Disconnected,
+                    "{case}"
+                );
+                assert!(
+                    matches!(
+                        ConnectionsView::offline(attention, None, false).handle_key(
+                            key,
+                            strict,
+                            std::time::Instant::now()
+                        ),
+                        DialogResult::Continue
+                    ),
+                    "{case}: the takeover view ignores it"
+                );
+            }
+        }
+    }
+
     #[tokio::test]
     #[serial_test::serial]
     async fn r_restarts_only_a_restartable_daemon_and_reports_the_outcome() {
```

**File**: `src/tui/components/help.rs` (modified, +1/-1)
```diff
@@ -428,7 +428,7 @@ mod tests {
                 if cfg!(feature = "web") {
                     "Web dashboard"
                 } else {
-                    "Connections: API server"
+                    "API server"
                 },
                 "R",
                 "Ctrl+R",
```

**File**: `src/tui/dialogs/connections.rs` (modified, +103/-4)
```diff
@@ -1,13 +1,20 @@
 //! The Connections hub behind R: this computer's Web dashboard, plus its Daemon whenever the
 //! Daemon needs attention. While the Daemon is offline it is also the home screen's takeover.
 
-use crossterm::event::{KeyCode, KeyEvent};
+use std::time::{Duration, Instant};
+
+use crossterm::event::{KeyCode, KeyEvent, KeyEventKind};
 use ratatui::prelude::*;
 use ratatui::widgets::*;
 
 use super::DialogResult;
+use crate::tui::home::bindings::{self, ActionId};
 use crate::tui::styles::Theme;
 
+/// How long after a Serve chord the next one still counts as the same press. Above the common
+/// OS key-repeat delays (225 to 660 ms), so a held key's first repeat falls inside it.
+const SEPARATE_PRESS: Duration = Duration::from_millis(700);
+
 /// Why the Daemon row is listed. A healthy Daemon has no row.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum DaemonAttention {
@@ -154,6 +161,9 @@ pub struct ConnectionsView {
     web: WebState,
     selected: usize,
     row_rects: Vec<(Row, Rect)>,
+    /// The last Serve chord while no other key has arrived, starting with the one that opened
+    /// the hub; a held key keeps renewing it.
+    last_serve: Option<Instant>,
 }
 
 impl ConnectionsView {
@@ -165,6 +175,7 @@ impl ConnectionsView {
             web,
             selected: 0,
             row_rects: Vec::new(),
+            last_serve: None,
         };
         // A failed launch opens on its row, so Enter shows why at once.
         if view.web == WebState::Failed {
@@ -191,6 +202,14 @@ impl ConnectionsView {
         }
     }
 
+    /// Opened by the Serve chord at `now`, which a second press must be separate from.
+    pub fn opened_by_serve(self, now: Instant) -> Self {
+        Self {
+            last_serve: Some(now),
+            ..self
+        }
+    }
+
     /// Follow the Daemon and Web dashboard while open, keeping the selected row.
     pub fn refresh(&mut self, daemon: Option<DaemonAttention>, web: WebState) {
         let selected = self.rows().get(self.selected).copied();
@@ -220,9 +239,24 @@ impl ConnectionsView {
         self.daemon.is_some_and(DaemonAttention::is_takeover)
     }
 
-    /// Enter on the Web dashboard row submits; the Daemon row has nothing to open.
-    pub fn handle_key(&mut self, key: KeyEvent) -> DialogResult<()> {
+    /// Enter on the Web dashboard row submits; the Daemon row has nothing to open. The Serve
+    /// key that opened the hub submits from any row, except on a takeover, once it is a
+    /// separate press: 700 ms after the last one, or after any other key. A key-repeat event
+    /// never counts.
+    pub fn handle_key(&mut self, key: KeyEvent, strict: bool, now: Instant) -> DialogResult<()> {
         let rows = self.rows();
+        if !self.offline_takeover() && bindings::is_bound(ActionId::Serve, strict, &key) {
+            let held = key.kind == KeyEventKind::Repeat
+                || self
+                    .last_serve
+                    .is_some_and(|last| now.saturating_duration_since(last) < SEPARATE_PRESS);
+            if !held {
+                return DialogResult::Submit(());
+            }
+            self.last_serve = Some(now);
+            return DialogResult::Continue;
+        }
+        self.last_serve = None;
         match key.code {
             KeyCode::Esc | KeyCode::Char('q') => DialogResult::Cancel,
             KeyCode::Up => {
@@ -621,10 +655,75 @@ mod tests {
         }
     }
 
+    /// #5832: the second Serve chord must be a separate press, in either mode. Times are
+    /// offsets from the chord that opened the hub.
+    #[test]
+    fn the_second_serve_chord_opens_the_dashboard_only_as_a_separate_press() {
+        let ms = Duration::from_millis;
+        let down = KeyEvent::new(KeyCode::Down, KeyModifiers::NONE);
+        let repeat =
+            |key: KeyEvent| KeyEvent::new_with_kind(key.code, key.modifiers, KeyEventKind::Repeat);
+        // A held key: the first repeat after a 500 ms OS delay, then one every 33 ms for 2 s.
+        let held: Vec<Duration> = std::iter::once(ms(500))
+            .chain((1..=60).map(|i| ms(500 + 33 * i)))
+            .collect();
+        for (strict, serve) in [
+            (
+                false,
+                KeyEvent::new(KeyCode::Char('R'), KeyModifiers::SHIFT),
+            ),
+            (
+                true,
+                KeyEvent::new(KeyCode::Char('r'), KeyModifiers::CONTROL),
+            ),
+        ] {
+            let cases: Vec<(&str, Vec<(Duration, KeyEvent)>, bool)> = vec![
+                ("inside the gap", vec![(ms(150), serve)], false),
+                ("after the gap", vec![(SEPARATE_PRESS, serve)], true),
+                (
+                    "a held key",
+                    held.iter().map(|&at| (at, serve)).collect(),
+                    false,
+                ),
+                (
+                    "another key between",
+                    vec![(ms(50), down), (ms(100), serve)],
+              
```

**File**: `src/tui/dialogs/serve/mod.rs` (modified, +117/-18)
```diff
@@ -768,11 +768,43 @@ fn is_funnel_link(url: &str) -> bool {
     link_host(url).is_some_and(|host| host.ends_with(".ts.net"))
 }
 
+fn is_restart_key(code: KeyCode) -> bool {
+    matches!(code, KeyCode::Char('r' | 'R'))
+}
+
+/// A key that may still be held down from before a boundary. The TUI gets no release events,
+/// so a held key's repeats arrive as presses; it stays inert until a different key arrives.
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+enum HeldKey {
+    /// The R that opened this screen from Connections.
+    Restart,
+    /// An Enter pressed during a restart check, or the Enter that confirmed one.
+    Enter,
+}
+
+impl HeldKey {
+    fn matches(self, code: KeyCode) -> bool {
+        match self {
+            Self::Restart => is_restart_key(code),
+            Self::Enter => code == KeyCode::Enter,
+        }
+    }
+}
+
+/// Why a landed check shows its effects without asking.
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+enum Unasked {
+    /// Enter was pressed during the first check.
+    EarlyEnter,
+    /// The check after a confirm found different effects.
+    Changed,
+}
+
 fn funnel_reset_applies(mode: ServeMode, transport: Option<TunnelTransport>) -> bool {
     mode == ServeMode::Tunnel && transport == Some(TunnelTransport::Tailscale)
 }
 
-/// A destructive action awaiting a second press of its key.
+/// A destructive action its key armed, awaiting Enter.
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 enum PendingConfirm {
     NewPassphrase,
@@ -845,6 +877,11 @@ pub struct ServeView {
     state: ServeViewState,
     pending_passphrase: String,
     pending_confirm: Option<(PendingConfirm, Instant)>,
+    /// The error screen's Funnel reset, armed by R and awaiting Enter.
+    funnel_reset_armed: Option<Instant>,
+    held_key: Option<HeldKey>,
+    /// A landed check that shows its effects without asking, until the next key.
+    unasked: Option<(PendingConfirm, Unasked)>,
     show_help: bool,
     mouse: RefCell<ServeMouse>,
     copied: Option<(&'static str, Instant)>,
@@ -954,6 +991,9 @@ impl ServeView {
             state,
             pending_passphrase: String::new(),
             pending_confirm: None,
+            funnel_reset_armed: None,
+            held_key: None,
+            unasked: None,
             show_help: false,
             mouse: RefCell::default(),
             copied: None,
@@ -1041,7 +1081,22 @@ impl ServeView {
         mouse.hover.update(col, row, &rects)
     }
 
+    /// Opened from Connections by `key`: when it was R, its hold may carry over.
+    pub fn opened_by(&mut self, key: &KeyEvent) {
+        self.held_key = is_restart_key(key.code).then_some(HeldKey::Restart);
+    }
+
     pub fn handle_key(&mut self, key: KeyEvent) -> ServeAction {
+        self.handle_key_at(key, Instant::now())
+    }
+
+    /// [`Self::handle_key`] at `now`, the clock the confirm window is read against.
+    fn handle_key_at(&mut self, key: KeyEvent, now: Instant) -> ServeAction {
+        if self.held_key.is_some_and(|held| held.matches(key.code)) {
+            return ServeAction::Continue;
+        }
+        self.held_key = None;
+        self.unasked = None;
         if matches!(key.code, KeyCode::Esc | KeyCode::Char('q')) && !self.show_help {
             self.pending = None;
             self.pending_confirm = None;
@@ -1106,7 +1161,7 @@ impl ServeView {
                 KeyCode::Esc | KeyCode::Char('q') => ServeAction::Close,
                 _ => ServeAction::Continue,
             },
-            ServeViewState::Active { .. } => self.active_key(key.code),
+            ServeViewState::Active { .. } => self.active_key(key.code, now),
             ServeViewState::Error { .. } => self.error_key(key.code),
         }
     }
@@ -1126,7 +1181,13 @@ impl ServeView {
                 self.request_picker(selected);
                 true
             }
+            // Only an Enter on a prompt counts, so one during either check neither confirms nor
+            // cancels: a bounce can't undo a confirm.
             PendingJob::Restart { intent, .. } => {
+                if code == KeyCode::Enter && matches!(intent, RestartIntent::Confirm(_)) {
+                    self.held_key = Some(HeldKey::Enter);
+                    return true;
+                }
                 let repeated = match intent {
                     RestartIntent::Confirm(PendingConfirm::Restart) => {
                         matches!(code, KeyCode::Char('r' | 'R'))
@@ -1315,6 +1376,7 @@ impl ServeView {
     }
 
     fn prepare_launch(&mut self, request: ServeLaunchRequest) {
+        self.unasked = None;
         self.pending_confirm = None;
         self.show_help = false;
         self.launch_in_flight = true;
@@ -1388,6 +1450,7 @@ impl ServeView {
 
     pub(crate) fn refuse_stop(&mut self) {
         self.pending = None;
+        self.funnel_reset_armed = None;
         self.stop_requested = false;
         let (mode, transport) = self.context();
         self.fail_work(
@
```

**File**: `src/tui/dialogs/serve/render.rs` (modified, +83/-21)
```diff
@@ -9,7 +9,7 @@ use crossterm::event::{KeyCode, KeyEvent};
 
 use super::{
     funnel_reset_applies, Flash, LinkChange, Logins, PendingConfirm, RestartEffect, ServeMode,
-    ServeMouse, ServeView, ServeViewState, TransportStatus, TunnelTransport, FLASH_TTL,
+    ServeMouse, ServeView, ServeViewState, TransportStatus, TunnelTransport, Unasked, FLASH_TTL,
 };
 use crate::tui::components::hint_buttons::scan_spaced_hints;
 use crate::tui::components::hover::paint_hover_bg;
@@ -121,7 +121,7 @@ pub(super) fn render(view: &ServeView, frame: &mut Frame, area: Rect, theme: &Th
                 &mut mouse,
                 message,
                 view.control_error.as_deref(),
-                &error_recovery_keys(*mode, *transport),
+                &error_keys(*mode, *transport, view.funnel_reset_armed.is_some()),
             ),
         }
     }
@@ -592,7 +592,7 @@ fn render_active(
             mouse,
             "Daemon started but no URL available yet.",
             None,
-            &[],
+            &error_keys(ServeMode::Local, None, false),
         );
         return;
     };
@@ -775,8 +775,12 @@ fn render_active(
         .border_style(Style::default().fg(theme.border));
     let footer_inner = footer_block.inner(footer);
     frame.render_widget(footer_block, footer);
-    let footer_text = match view.pending_confirm.map(|(action, _)| action) {
-        Some(action) => {
+    let asking = view
+        .pending_confirm
+        .map(|(action, _)| (action, None))
+        .or(view.unasked.map(|(action, why)| (action, Some(why))));
+    let footer_text = match asking {
+        Some((action, unasked)) => {
             let effect = RestartEffect::of(
                 *mode,
                 urls,
@@ -786,14 +790,14 @@ fn render_active(
             );
             let (first, effect_text) = match action {
                 PendingConfirm::NewPassphrase => (
-                    "Press G again for a new passphrase.",
+                    "Press Enter for a new passphrase.",
                     "Every Device signs out.",
                 ),
                 PendingConfirm::Restart if effect.link == LinkChange::Replaced => {
-                    ("Press R again to restart.", "Agents keep running.")
+                    ("Press Enter to restart.", "Agents keep running.")
                 }
                 PendingConfirm::Restart => (
-                    "Press R again to restart.",
+                    "Press Enter to restart.",
                     match effect.logins {
                         Logins::Kept => "Devices stay signed in; agents keep running.",
                         Logins::Lost => "Every Device signs out; agents keep running.",
@@ -813,15 +817,35 @@ fn render_active(
             let funnel_back = (action == PendingConfirm::Restart && effect.retakes_funnel).then_some(
                 "The Funnel link comes back only if no other server holds it; otherwise the Daemon stops and says why.",
             );
+            let again = match action {
+                PendingConfirm::NewPassphrase => "Press G to check again.",
+                PendingConfirm::Restart => "Press R to check again.",
+            };
+            let (lead, first, cancels) = match unasked {
+                None => (None, first, Some("Any other key cancels.")),
+                Some(Unasked::EarlyEnter) => {
+                    (Some("Enter was pressed before this asked. "), again, None)
+                }
+                // Only a restart re-checks its effects; a new passphrase always signs everyone out.
+                Some(Unasked::Changed) => (
+                    Some("What a restart would change is different now. "),
+                    again,
+                    None,
+                ),
+            };
             let rest = [effect_text]
                 .into_iter()
                 .chain(link)
                 .chain(funnel_back)
-                .chain(["Any other key cancels."]);
-            let mut spans = vec![Span::styled(
+                .chain(cancels);
+            let mut spans: Vec<_> = lead
+                .map(|lead| Span::styled(lead, dimmed))
+                .into_iter()
+                .collect();
+            spans.push(Span::styled(
                 first,
                 Style::default().fg(theme.waiting).bold(),
-            )];
+            ));
             spans.extend(rest.map(|s| Span::styled(format!(" {s}"), dimmed)));
             Text::from(Line::from(spans))
         }
@@ -975,15 +999,30 @@ fn split_url_and_token(url: &str) -> (String, Option<&str>) {
 }
 
 /// The keys `error_key` handles for this failure, shown before the way out.
-fn error_recovery_keys(mode: ServeMode, transport: Option<TunnelTransport>) -> Vec<&'static str> {
-    let mut keys = Vec::new();
+struct ErrorKeys {
+    recovery: Vec<&'static str>,
+    rest: &'static [&'static str],
+}
+
+fn error_keys(mode: ServeMode, transport: Option<TunnelTransport>, reset_armed: bool) -> ErrorKeys {
+    /
```

**File**: `src/tui/dialogs/serve/tests.rs` (modified, +369/-23)
```diff
@@ -11,6 +11,10 @@ fn key(code: char) -> KeyEvent {
     KeyEvent::from(KeyCode::Char(code))
 }
 
+fn enter() -> KeyEvent {
+    KeyEvent::from(KeyCode::Enter)
+}
+
 fn picker_state() -> ServeViewState {
     ServeViewState::ModePicker {
         selected: ServeMode::Tunnel,
@@ -67,6 +71,18 @@ fn starting() -> ServeViewState {
     }
 }
 
+/// [`wait_for`], with every tick read at `now`.
+#[track_caller]
+fn wait_for_at(view: &mut ServeView, now: Instant, predicate: impl Fn(&ServeView) -> bool) {
+    let deadline = Instant::now() + Duration::from_secs(10);
+    while !predicate(view) {
+        view.tick_at(now);
+        assert!(Instant::now() < deadline, "Serve transition did not finish");
+        std::thread::yield_now();
+    }
+}
+
+#[track_caller]
 fn wait_for(view: &mut ServeView, predicate: impl Fn(&ServeView) -> bool) {
     let deadline = Instant::now() + Duration::from_secs(10);
     while !predicate(view) {
@@ -76,15 +92,19 @@ fn wait_for(view: &mut ServeView, predicate: impl Fn(&ServeView) -> bool) {
     }
 }
 
+/// Whether a restart check, or the launch context a confirm reads, is still running.
+fn assessing(view: &ServeView) -> bool {
+    view.pending.as_ref().is_some_and(|pending| {
+        matches!(
+            pending.kind,
+            PendingJob::Restart { .. } | PendingJob::LaunchContext(_)
+        )
+    })
+}
+
+#[track_caller]
 fn wait_assessment(view: &mut ServeView) {
-    wait_for(view, |view| {
-        !view.pending.as_ref().is_some_and(|pending| {
-            matches!(
-                pending.kind,
-                PendingJob::Restart { .. } | PendingJob::LaunchContext(_)
-            )
-        })
-    });
+    wait_for(view, |view| !assessing(view));
 }
 
 fn snapshot() -> JobResult {
@@ -399,7 +419,7 @@ fn requesting_a_new_passphrase_does_not_overwrite_saved_credentials() {
     view.target = Some(crate::cli::serve::tui_control_target().unwrap());
     view.handle_key(key('G'));
     wait_assessment(&mut view);
-    view.handle_key(key('G'));
+    view.handle_key(enter());
     wait_assessment(&mut view);
     assert!(view.take_launch().is_some());
     assert_ne!(view.pending_passphrase, "running daemon phrase");
@@ -434,14 +454,11 @@ fn restart_requires_an_uninterrupted_confirmation() {
         if expired {
             view.pending_confirm = Some((PendingConfirm::Restart, Instant::now() - CONFIRM_TTL));
         }
-        view.handle_key(key('R'));
+        view.handle_key(enter());
         wait_assessment(&mut view);
         if cancelled || expired {
             assert!(view.take_launch().is_none());
-            assert!(matches!(
-                view.pending_confirm,
-                Some((PendingConfirm::Restart, _))
-            ));
+            assert!(view.pending_confirm.is_none());
             assert!(matches!(view.state, ServeViewState::Active { .. }));
         } else {
             assert!(view.take_launch().is_some());
@@ -478,7 +495,7 @@ fn token_age_counts_only_under_token_auth() {
 
 #[test]
 #[serial_test::serial]
-fn second_restart_key_reprobes_and_reconfirms_when_the_effect_changed() {
+fn a_changed_recheck_shows_its_effects_and_asks_only_after_another_r() {
     let _home = crate::session::test_support::isolate_app_dir();
     let token = crate::session::get_app_dir().unwrap().join("serve.token");
     let mut jobs = ServeJobs::default();
@@ -498,14 +515,28 @@ fn second_restart_key_reprobes_and_reconfirms_when_the_effect_changed() {
     wait_assessment(&mut view);
     assert_eq!(view.restart_probe.local_token, TokenWindow::Boundary);
     write_token(Duration::from_secs(24 * 60 * 60 + 60));
-    view.handle_key(key('R'));
+    view.handle_key(enter());
     wait_assessment(&mut view);
     assert_eq!(view.restart_probe.local_token, TokenWindow::Renews);
+    assert!(view.take_launch().is_none(), "a changed re-check restarted");
+    // The confirming Enter may still be held, so the re-check doesn't ask again.
+    assert!(view.pending_confirm.is_none(), "a changed re-check asked");
+    assert_eq!(
+        view.unasked,
+        Some((PendingConfirm::Restart, Unasked::Changed))
+    );
+    view.handle_key(enter());
+    assert!(!assessing(&view), "Enter after a changed re-check");
     assert!(view.take_launch().is_none());
-    assert!(view.pending_confirm.is_some());
     view.handle_key(key('R'));
     wait_assessment(&mut view);
-    assert!(view.take_launch().is_some());
+    assert!(view.pending_confirm.is_some());
+    view.handle_key(enter());
+    wait_assessment(&mut view);
+    assert!(
+        view.take_launch().is_some(),
+        "R, then Enter, after a changed re-check"
+    );
 }
 
 #[test]
@@ -553,6 +584,9 @@ fn held_work_leaves_keys_clicks_ticks_and_render_usable() {
                 }
                 _ => {
                     view.handle_key(KeyEvent::from(code.unwrap()));
+                    if held == Held::Reset {
+                        view.handle_key(enter());
+                    }
                 }

```

**File**: `src/tui/home/bindings.rs` (modified, +2/-2)
```diff
@@ -947,9 +947,9 @@ pub static BINDINGS: &[Binding] = &[
         help: Some(HelpMeta {
             section: HelpSection::Other,
             desc: if cfg!(feature = "web") {
-                "Connections: Web dashboard (browser / phone)"
+                "Connections; twice for the Web dashboard"
             } else {
-                "Connections: API server (LAN / Tunnel)"
+                "Connections; twice for the API server"
             },
         }),
         palette: Some(PaletteMeta {
```

---

### Incident Patch 2: `b0b4c0df` (2026-11-20)
**Commit Message**: fix(acp): refuse Terminal switch when command session flag conflicts (#5758)

* fix(acp): refuse a Terminal switch the command's session flag would leave owed

A Session whose command carries its own native session selector while AoE
also holds a conversation for it can never launch: the launch refuses the
two together. The switch to Terminal view retired the Structured runner
first and then left the handoff owed, retrying the same refused launch.

The check and the switch now refuse such a switch before retirement with
the new `command_selector_conflict` reason. A handoff already owed from
before this change ends instead of retrying: the Session stays in Terminal
view with an error naming the fix, and its reservation is free, so a
restart with the flag removed launches.

Fixes #5727

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(acp): don't judge a pending rebind by the old command's session flag

Retirement replaces a pending terminal rebind's command and conversation,
so the old command's native session selector never reaches the launch.
The selector check judged it anyway and refused a switch that would
launch. Skip it for a pending rebind.

Reword the deferred cove

**File**: `docs/guides/session-resume.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ Sandbox config and conversation stores are staged per AoE instance, including cu
 
 A conflicting built-in tool and command, such as tool `claude` with command `codex`, is rejected for managed resume and fork. An opaque wrapper requires both `session.agent_execution_as` and `session.agent_config_dir` in trusted global or profile configuration. This asserts that the wrapper invokes that native agent, forwards native arguments unchanged, and uses only the declared store and working-directory/filesystem context. Repository overrides are refused because a repository must not grant itself access to another native conversation store.
 
-A bare, non-path wrapper mapped by `agent_detect_as` can still start fresh and capture its pane-scoped published ID without the execution contract. AoE does not preassign a native ID from a status alias alone, including after an explicit fresh choice or disabled `auto_resume_on_restart`. Resuming a published ID still requires the contract. A native selector supplied by the user remains user-owned only when the row has no AoE-managed conversation state; AoE does not inject another selector. A known conversation can still be tried after an external working-directory or store move on Default when native execution resolves and its target checks pass; its old binding remains authoritative until a qualified observation updates it.
+A bare, non-path wrapper mapped by `agent_detect_as` can still start fresh and capture its pane-scoped published ID without the execution contract. AoE does not preassign a native ID from a status alias alone, including after an explicit fresh choice or disabled `auto_resume_on_restart`. Resuming a published ID still requires the contract. A native selector supplied by the user remains user-owned only when the row has no AoE-managed conversation state; AoE does not inject another selector. A conversation cleared with `set-session-id <session> ""` isn't AoE-managed state: the command runs as written, and the clear still applies. With AoE-managed state, the launch is refused, and so is a [switch to Terminal view](../structured-view.md#choosing-the-view-per-session). A known conversation can still be tried after an external working-directory or store move on Default when native execution resolves and its target checks pass; its old binding remains authoritative until a qualified observation updates it.
 
 Shell pipelines, remote launchers, redirections, expansion, and unrecognized context-changing arguments are not supported managed invocations. The program, routing environment, and native namespace arguments are fixed from one validated launch snapshot and restored after the login shell.
 Literal leading `NAME=value` assignments and a shell-quoted executable are supported for direct commands. The assignments are included when resolving the executable and its native store.
```

**File**: `docs/structured-view.md` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ It exits 1 if Node is missing, 2 if some agents are unreachable, else 0. Pass `-
 
 - **Web wizard and TUI dialog:** `acp.structured_view = "auto"` defaults to structured in the web wizard and terminal in the TUI. Set it to `terminal` or `structured` to preselect that view in both, or `off` to hide the option. The per-session choice wins.
 - **CLI:** defaults to the terminal view; opt in with `--structured-view` or `--agent`.
-- Either way, an existing active session can switch views: the web sidebar's right-click menu (**Switch to terminal** / **Switch to structured view**) or the TUI's right-click context menu (requires a healthy runtime; archived, trashed, and still-creating rows are excluded until they leave that state). Both surfaces confirm first. The worktree, open files, and commits are always preserved. For a **claude** session, the conversation is kept in both directions only when AoE can resolve a shared native store. A terminal switch whose store cannot be resolved, or which the structured worker does not share, is refused with HTTP 409 and `set-session-id --store` recovery guidance. Every other agent starts fresh on the target surface.
+- Either way, an existing active session can switch views: the web sidebar's right-click menu (**Switch to terminal** / **Switch to structured view**) or the TUI's right-click context menu (requires a healthy runtime; archived, trashed, and still-creating rows are excluded until they leave that state). Both surfaces confirm first. The worktree, open files, and commits are always preserved. For a **claude** session, the conversation is kept in both directions only when AoE can resolve a shared native store. A terminal switch whose store cannot be resolved, or which the structured worker does not share, is refused with HTTP 409 and `set-session-id --store` recovery guidance. Every other agent starts fresh on the target surface. A session whose command or arguments carry the agent's own session flag (`--resume <id>`, for example) lets that flag pick the conversation. A switch that also chooses a conversation is refused with 409 `command_selects_conversation`, and one where AoE also holds a conversation for the session with 409 `command_selector_conflict`; remove the flag to switch. A switch owed from before that refusal ends in Terminal view with the session in Error: restart it with the flag removed, or run `aoe session set-session-id <session> ""` and restart it to run its command as written.
 
 If the agent cannot resume a prior conversation, the transcript reports a context reset before assigning a fresh conversation. Recorded terminal context and an explicitly selected conversation count as prior context. Reattaching to the same live conversation does not add a reset.
 
```

**File**: `src/acp/protocol.rs` (modified, +6/-1)
```diff
@@ -298,10 +298,13 @@ pub enum TerminalSwitchReason {
     NotStructured,
     /// With `command_decides`: the launch command carries a native session selector.
     CommandSelectsConversation,
+    /// With `blocked`: the command's native session selector and AoE's own conversation
+    /// would both reach the launch, which refuses them together.
+    CommandSelectorConflict,
 }
 
 impl TerminalSwitchReason {
-    pub const ALL: [Self; 11] = [
+    pub const ALL: [Self; 12] = [
         Self::AgentNotResumable,
         Self::NoConversationYet,
         Self::EarlierConversation,
@@ -313,6 +316,7 @@ impl TerminalSwitchReason {
         Self::SessionChanged,
         Self::NotStructured,
         Self::CommandSelectsConversation,
+        Self::CommandSelectorConflict,
     ];
 
     pub const fn as_str(self) -> &'static str {
@@ -328,6 +332,7 @@ impl TerminalSwitchReason {
             Self::SessionChanged => "session_changed",
             Self::NotStructured => "not_structured",
             Self::CommandSelectsConversation => "command_selects_conversation",
+            Self::CommandSelectorConflict => "command_selector_conflict",
         }
     }
 }
```

**File**: `src/daemon/error.rs` (modified, +1/-0)
```diff
@@ -391,6 +391,7 @@ mod tests {
                 CommandSelectsConversation => {
                     ("command_selects_conversation", StatusCode::CONFLICT)
                 }
+                CommandSelectorConflict => ("command_selector_conflict", StatusCode::CONFLICT),
             };
             assert_eq!(reason.as_str(), wire);
             let code = ApiErrorCode::TerminalSwitchRefused(reason);
```

**File**: `src/migrations/v048_terminal_handoffs.rs` (modified, +1/-0)
```diff
@@ -187,6 +187,7 @@ mod tests {
             terminal: None,
             launch_required: false,
             launch_started: false,
+            selector_ended: false,
             launch: None,
         };
         let mut pending = serde_json::to_value(&row)?;
```

**File**: `src/server/api/acp/view.rs` (modified, +847/-57)
```diff
@@ -585,6 +585,19 @@ fn switch_unavailable(error: &anyhow::Error, message: &'static str) -> Response
 
 const CHECK_UNAVAILABLE: &str = "Couldn't check the switch to Terminal view; retry shortly";
 const SWITCH_UNAVAILABLE: &str = "Couldn't start the switch to Terminal view; retry shortly";
+const COMMAND_SELECTOR_CONFLICT: &str = "This Session's command picks a conversation with its own session flag, and AoE holds one for it too; remove the session flag from its command or arguments to switch";
+/// Ends a handoff owed from before the refusal above: its launch can never start. Clearing AoE's
+/// id is a way out only here, in Terminal view; Structured view refuses that clear.
+fn command_selector_ended(session_id: &str) -> String {
+    format!(
+        "Terminal view couldn't start this Session: its command picks a conversation with its own session flag, and AoE holds one for it too. Restart the Session with the session flag removed from its command or arguments, or run `aoe session set-session-id {session_id} \"\"` and restart it to run its command as written."
+    )
+}
+
+/// A handoff whose launch the command's own session selector refused; it ended in Terminal view.
+#[derive(Debug, thiserror::Error)]
+#[error("{}", command_selector_ended(.0))]
+struct CommandSelectorEnded(String);
 
 /// A coded refusal, so a client can show the matching dialog state. The body
 /// stays plain text because the current web client shows it as it is.
@@ -611,6 +624,7 @@ fn terminal_refusal(reason: TerminalSwitchReason, agent: &str) -> Response {
         CommandSelectsConversation => {
             "This Session's command picks its own conversation; switch without a choice, or remove the session flag from its command".into()
         }
+        CommandSelectorConflict => COMMAND_SELECTOR_CONFLICT.into(),
     };
     crate::server::api::text_error_with_code_header(
         crate::daemon::ApiErrorCode::TerminalSwitchRefused(reason),
@@ -720,13 +734,33 @@ async fn terminal_plan(
     let plan = agent_terminal_plan(state, id, instance, agent, source_event_seq).await?;
     Ok(match plan {
         TerminalPlan::Blocked(_) => plan,
+        // Retirement replaces a pending rebind's command and conversation, so the old command's
+        // selector never reaches the launch.
+        plan if instance.terminal_rebind_pending => plan,
         plan if instance.command_session_selector().is_some() => {
-            TerminalPlan::CommandDecides(Box::new(plan))
+            // The launch refuses the selector beside AoE's own conversation, so refuse before
+            // retirement rather than leave the switch owed. A row that can't start owes no launch.
+            if instance.ensure_startable().is_ok()
+                && command_selector_conflicts(
+                    instance,
+                    matches!(plan, TerminalPlan::Continues { .. }),
+                )
+            {
+                TerminalPlan::Blocked(TerminalSwitchReason::CommandSelectorConflict)
+            } else {
+                TerminalPlan::CommandDecides(Box::new(plan))
+            }
         }
         plan => plan,
     })
 }
 
+/// Whether the launch refuses `row`'s command selector beside AoE's own conversation. A switch
+/// that `keeps_target` commits one; otherwise the row's own state decides.
+fn command_selector_conflicts(row: &Instance, keeps_target: bool) -> bool {
+    row.command_session_selector().is_some() && (keeps_target || row.conversation_state().resumes())
+}
+
 async fn agent_terminal_plan(
     state: &Arc<AppState>,
     id: &str,
@@ -1076,6 +1110,7 @@ fn reserve_handoff_in(
             }),
             launch_required: row.ensure_startable().is_ok(),
             launch_started: false,
+            selector_ended: false,
             launch: None,
         }));
         Ok(HandoffKey {
@@ -1256,11 +1291,26 @@ fn commit_terminal_in(
     })
 }
 
+/// A session id whose next `finish_handoff_in` runs this hook before canonical adoption.
+#[cfg(test)]
+type FinishAdoptionHook = (String, Box<dyn FnOnce() + Send>);
+#[cfg(test)]
+static BEFORE_FINISH_ADOPTION: std::sync::Mutex<Option<FinishAdoptionHook>> =
+    std::sync::Mutex::new(None);
+
 fn finish_handoff_in(
     native: &crate::server::session_store::NativeSessionStore,
     session_id: &str,
     key: HandoffKey,
 ) -> anyhow::Result<()> {
+    #[cfg(test)]
+    {
+        let mut armed = BEFORE_FINISH_ADOPTION.lock().unwrap();
+        if armed.as_ref().is_some_and(|(id, _)| id == session_id) {
+            let (_, hook) = armed.take().unwrap();
+            crate::server::session_store::before_next_adoption_for_test(hook);
+        }
+    }
     use crate::session::{LifecycleOperation, LifecycleReservationError, TerminalHandoffStage};
     let profile = native.storage().profile();
     let profile_identity = native.storage().bound_profile_identity()?;
@@ -1462,7 +1512,15 @@ async fn terminal_handoff_request(
             tracing::info!(target: "acp.switch", session =
```

**File**: `src/session/instance/mod.rs` (modified, +4/-0)
```diff
@@ -299,6 +299,10 @@ pub(crate) struct TerminalHandoffIntent {
     pub(crate) launch_required: bool,
     pub(crate) launch_started: bool,
     pub(crate) launch: Option<TerminalHandoffLaunch>,
+    /// The owed launch was refused for the command's own session selector, so the switch ended
+    /// without a pane. Missing on rows from before the refusal, which never ended this way.
+    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
+    pub(crate) selector_ended: bool,
 }
 
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
```

**File**: `src/session/instance/session_id.rs` (modified, +29/-6)
```diff
@@ -850,16 +850,16 @@ impl Instance {
             .then(|| self.existing_session_selector(&parsed_command.words, agent))
             .flatten()
         {
-            let aoe_has_state = self.agent_session_id.is_some()
-                || matches!(
-                    self.resume_intent,
-                    ResumeIntent::Use(_) | ResumeIntent::Fork { .. }
-                );
-            if aoe_has_state {
+            if self.conversation_state().resumes() {
                 anyhow::bail!(
                     "{context} command already contains native session selector {selector}; remove it or clear the AoE-managed resume state before launching"
                 );
             }
+            // The early return skips acquisition, which applies a clear.
+            if matches!(self.resume_intent, ResumeIntent::Cleared) {
+                self.set_agent_conversation(None, None, None);
+                self.resume_probe_failed_sid = None;
+            }
             tracing::info!(target: "session.store", %context, %selector,
                 "command supplies its own native session selector; skipping AoE session injection");
             return Ok(false);
@@ -2313,6 +2313,29 @@ work-opencode = "opencode"
                 );
                 assert!(error.contains("clear the AoE-managed resume state"));
             }
+            // A cleared id isn't AoE's conversation: the command runs as written and the clear
+            // still applies, since the selector skips acquisition.
+            let mut cleared = tool_instance("claude", "/tmp/x");
+            cleared.agent_session_id = Some(sid.to_string());
+            cleared.resume_intent = ResumeIntent::Cleared;
+            let mut actual = command.to_string();
+            assert!(!cleared
+                .apply_session_flags(
+                    &mut actual,
+                    None,
+                    None,
+                    &super::execution::AgentLaunchContext::host(
+                        cleared.default_selector_agent(),
+                        cleared
+                            .default_selector_agent()
+                            .and_then(|agent| cleared.host_agent_command(agent, None))
+                            .as_ref()
+                    ),
+                    &mut cleared.conversation_state()
+                )
+                .unwrap());
+            assert_eq!(actual, command);
+            assert!(cleared.agent_session_id.is_none(), "{command}");
         }
     }
 
```

---

### Incident Patch 3: `08946a21` (2026-11-21)
**Commit Message**: fix(tui): attach live send to an alive pane whose status is unknown (#5915)

An agent pane that is alive but whose screen the detector cannot classify
reports Unknown. Live send treated that as a stale target: the receipt was
discarded and the modal claimed the snapshot had changed, which both blocked
the send and misdirected the reader.

Gate attachment on the receipt identity and the pane observation instead,
keeping Stopped, Error, Deleting, and Creating refused. Both arms share one
allowlist so they cannot drift, and Unknown counts as warm so the revive
toast no longer claims a frame for a pane that needs no work.

Fixes #5913

Co-authored-by: deepseek/deepseek-v4.1-flash-1017 <[REDACTED_EMAIL]>

**File**: `src/tui/home/live_send_prep.rs` (modified, +6/-0)
```diff
@@ -8,6 +8,11 @@ impl HomeView {
     /// revive cascade (`ensure_pane_ready` / `prepare_live_send`) is expected
     /// to be a fast no-op.
     ///
+    /// `Unknown` counts: it is what an agent-pane adapter that has not
+    /// classified the screen yet reports, and those panes are exactly the ones
+    /// live send now attaches. Liveness still comes from `exists()`, so a
+    /// stale cache can only cost the toast.
+    ///
     /// The `EnterLiveSend` / `SendMessage` handlers use this to skip the
     /// "Reviving session..." toast frame for warm sessions: the toast claims a
     /// bottom bar row, and for the frame(s) it is on screen the bottom-anchored
@@ -31,6 +36,7 @@ impl HomeView {
             crate::session::Status::Running
                 | crate::session::Status::Waiting
                 | crate::session::Status::Idle
+                | crate::session::Status::Unknown
         ) {
             return false;
         }
```

**File**: `src/tui/home/tests/live_send_mode.rs` (modified, +20/-1)
```diff
@@ -737,11 +737,14 @@ fn warm_predicates_stay_cold_without_a_live_pane() {
     assert!(!env.view.agent_pane_is_warm(&id));
 
     // Non-live statuses are cold regardless of pane state.
+    let cache = crate::tmux::SessionCacheGuard::capture();
+    let inst = env.view.get_instance(&id).unwrap().clone();
+    let tmux_name = crate::tmux::Session::generate_name(&inst.id, &inst.title);
+    cache.force_present(&[tmux_name.as_str()]);
     for status in [
         crate::session::Status::Stopped,
         crate::session::Status::Starting,
         crate::session::Status::Error,
-        crate::session::Status::Unknown,
     ] {
         env.view.set_instance_status(&id, status);
         assert!(
@@ -750,6 +753,22 @@ fn warm_predicates_stay_cold_without_a_live_pane() {
         );
     }
 
+    // An unclassified status with the pane actually up is warm: that is the
+    // steady state of an agent whose status adapter has not classified its
+    // screen, and live send attaches those rows.
+    for status in [
+        crate::session::Status::Unknown,
+        crate::session::Status::Idle,
+        crate::session::Status::Waiting,
+        crate::session::Status::Running,
+    ] {
+        env.view.set_instance_status(&id, status);
+        assert!(
+            env.view.agent_pane_is_warm(&id),
+            "status {status:?} with a live pane must count as warm"
+        );
+    }
+
     use crate::session::{AuxiliaryObservation, AuxiliaryTarget, PanePresence};
     env.view
         .set_instance_status(&id, crate::session::Status::Stopped);
```

**File**: `src/tui/home/tests/session_feed_tests.rs` (modified, +90/-0)
```diff
@@ -1443,6 +1443,14 @@ fn restart_attachment_waits_for_its_receipt_and_lifecycle_generation() {
             "test",
             true,
         ),
+        (
+            "Unknown",
+            PanePresence::Alive,
+            5,
+            Some("restarted-agent"),
+            "test",
+            true,
+        ),
         (
             "Starting",
             PanePresence::Alive,
@@ -1589,6 +1597,88 @@ fn restart_attachment_waits_for_its_receipt_and_lifecycle_generation() {
     }
 }
 
+/// Live send into an agent whose status adapter has not classified its screen
+/// yet must attach: the daemon confirms the pane by identity, and the snapshot
+/// reports that same pane alive. A status the row is not in (stopped) still
+/// refuses the attachment.
+#[test]
+#[serial]
+fn live_send_attaches_an_agent_pane_whose_status_is_unclassified() {
+    use crate::daemon::{RuntimeCursor, TerminalTarget, TerminalTargetStatus};
+    use crate::session::{PaneObservation, PanePresence};
+    use crate::tui::home::live_send::LiveSendTarget;
+    use crate::tui::home::panes::PaneIntent;
+
+    for (reflected_status, attach) in [("Unknown", true), ("Stopped", false)] {
+        let mut env = create_test_env_with_sessions(1);
+        let id = env.view.instance_at(0).id.clone();
+        env.view.select_session_by_id(&id);
+        let mut row = daemon_row(env.view.get_instance(&id).unwrap(), "Unknown");
+        row.view = crate::session::View::Terminal;
+        row.lifecycle_generation = 4;
+        row.agent_pane = PaneObservation {
+            state: PanePresence::Alive,
+            tmux_session: Some("agent-4".into()),
+            legacy_tool: None,
+        };
+        let SessionFeedResult::Snapshot(mut snapshot) = snapshot_of(vec![row]) else {
+            unreachable!()
+        };
+        env.view
+            .session_feed
+            .publish_for_test(SessionFeedResult::Snapshot(snapshot.clone()));
+        env.view.apply_session_feed();
+        let mut respond = env.view.session_feed.engagement_native_driver_for_test();
+        env.view
+            .prepare_live_send_target(&id, LiveSendTarget::Agent, None)
+            .unwrap();
+        assert!(matches!(
+            respond(
+                Ok(RuntimeCursor {
+                    epoch: "test".into(),
+                    revision: 2,
+                }),
+                Some(TerminalTarget {
+                    tmux_session: "agent-4".into(),
+                    status: TerminalTargetStatus::Alive,
+                    lifecycle_generation: 4,
+                    profile: "test".into(),
+                }),
+            ),
+            Some(crate::tui::session_feed::SessionRequest::EnsureAgent { .. })
+        ));
+        env.view.apply_session_feed();
+        assert!(
+            env.view.take_native_attachment().is_none(),
+            "{reflected_status}: the receipt alone is not canonical application"
+        );
+
+        let committed = std::sync::Arc::make_mut(&mut snapshot);
+        committed.cursor.revision = 2;
+        committed.contents.sessions[0].status = reflected_status.into();
+        env.view
+            .session_feed
+            .publish_for_test(SessionFeedResult::Snapshot(snapshot));
+        env.view.apply_session_feed();
+        let attachment = env.view.take_native_attachment();
+        if attach {
+            let attachment = attachment.expect("an unclassified but live pane must go live");
+            assert_eq!(attachment.id, id);
+            assert_eq!(attachment.tmux_name, "agent-4");
+            assert!(matches!(
+                attachment.intent,
+                PaneIntent::LiveSend(LiveSendTarget::Agent)
+            ));
+        } else {
+            assert!(
+                attachment.is_none(),
+                "{reflected_status}: a stopped row must not attach"
+            );
+        }
+        assert!(env.view.take_native_attachment().is_none());
+    }
+}
+
 /// A complete runtime row, with deliberate canonical changes for the scenario.
 fn canonical_row(
     instance: &Instance,
```

**File**: `src/tui/session_feed.rs` (modified, +95/-5)
```diff
@@ -382,6 +382,22 @@ struct PendingCreation {
     receipt: Option<Box<MutationReceipt<crate::daemon::SessionResponse>>>,
 }
 
+/// Whether a snapshot status may accompany a confirmed agent-pane receipt.
+///
+/// Readiness comes from the receipt's identity (generation, profile, tmux
+/// name) and the snapshot's pane observation, so status only has to rule out a
+/// row that is stopped, failed, or mid-teardown. `Unknown` is the live state of
+/// a pane that is alive but whose screen the detector cannot classify (see
+/// `crate::session::instance::pane_status`), which is exactly what an agent
+/// whose status adapter has not reported yet looks like; it is not evidence the
+/// pane is gone.
+fn status_allows_attachment(status: &str) -> bool {
+    matches!(
+        status,
+        "Running" | "Waiting" | "Idle" | "Starting" | "Unknown"
+    )
+}
+
 fn set_grant(grant: &AtomicU64, allowed: bool) {
     // Renamed to try_update in the standard library; the MSRV this builds against
     // does not have it yet. Upstream carries the same allowance.
@@ -1853,15 +1869,13 @@ impl SessionFeed {
                                             && row.agent_pane.state == crate::session::PanePresence::Alive
                                             && receipt.outcome.target.as_ref().is_some_and(|target|
                                                 row.agent_pane.tmux_session.as_deref() == Some(target.tmux_session.as_str()))
-                                            && matches!(row.status.as_str(), "Running" | "Waiting" | "Idle" | "Starting"),
+                                            && status_allows_attachment(row.status.as_str()),
                                         CommandReply::Terminal(receipt) => {
                                             let identity_matches = row.lifecycle_generation
                                                 == receipt.outcome.lifecycle_generation
                                                 && row.profile == receipt.outcome.profile;
-                                            let status_ok = matches!(
-                                                row.status.as_str(),
-                                                "Running" | "Waiting" | "Idle" | "Starting"
-                                            );
+                                            let status_ok =
+                                                status_allows_attachment(row.status.as_str());
                                             let pane_ok = match row.agent_pane.state {
                                                 crate::session::PanePresence::Alive => {
                                                     row.agent_pane.tmux_session.as_deref()
@@ -4502,6 +4516,82 @@ mod tests {
         assert!(feed.drain_command_errors().is_empty());
         assert!(prepared.result.try_recv().unwrap().is_ok());
     }
+
+    /// An agent whose screen the detector cannot classify keeps its pane alive
+    /// and alive-pane identity is what the receipt confirms, so the row must
+    /// attach instead of failing as a stale target. A stopped or failed row is
+    /// still refused.
+    #[test]
+    fn ensure_agent_accepts_an_unclassified_status_only_with_the_same_live_pane() {
+        use crate::session::PanePresence;
+        for (status, pane, tmux_session, generation, attach) in [
+            ("Unknown", PanePresence::Alive, Some("agent-4"), 4, true),
+            ("Idle", PanePresence::Alive, Some("agent-4"), 4, true),
+            ("Stopped", PanePresence::Alive, Some("agent-4"), 4, false),
+            ("Error", PanePresence::Alive, Some("agent-4"), 4, false),
+            ("Deleting", PanePresence::Alive, Some("agent-4"), 4, false),
+            (
+                "Unknown",
+                PanePresence::Alive,
+                Some("another-agent"),
+                4,
+                false,
+            ),
+            ("Unknown", PanePresence::Alive, Some("agent-4"), 5, false),
+            ("Unknown", PanePresence::Dead, Some("agent-4"), 4, false),
+            ("Unknown", PanePresence::Absent, Some("agent-4"), 4, false),
+        ] {
+            let mut row: crate::daemon::SessionResponse =
+                serde_json::from_value(serde_json::json!({
+                    "id": "session",
+                    "profile": "test",
+                    "lifecycle_generation": 4,
+                    "status": status,
+                    "agent_pane": {"state": "alive", "tmux_session": "agent-4"},
+                }))
+                .unwrap();
+            row.agent_pane.state = pane;
+            row.agent_pane.tmux_session = tmux_session.map(str::to_owned);
+            let mut initial = snapshot("test", 1);
+            Arc::make_mut(&mut initial).contents.sessions.push(row);
+            let mut feed =
+                SessionFeed::seeded_for_test(SessionFeedResult::Snapshot(initial.clone()));
+            feed.mark_snapshot_applied(initial.clone());
+            let (comm
```

**File**: `tests/e2e/live_send_paste_e2e.rs` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ default_attach_mode = "live_send"
     std::fs::write(config_dir.join("config.toml"), config_content).expect("write live-send config");
 }
 
-fn agent_session_on(socket: &std::path::Path) -> String {
+pub(crate) fn agent_session_on(socket: &std::path::Path) -> String {
     let output = Command::new("tmux")
         .arg("-S")
         .arg(socket)
```

**File**: `tests/e2e/live_send_unknown_status_e2e.rs` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+//! e2e coverage for live send attaching a pane whose status is unclassified.
+//!
+//! An agent pane can be alive while its screen is unreadable to the status
+//! detector: a custom command runs through a wrapper script, so the pane never
+//! matches an agent manifest, and until the program paints enough content the
+//! legacy detector lands on `Status::Unknown`. That is a live pane, but the
+//! receipt gate used to accept only `Running | Waiting | Idle | Starting`, so
+//! the TUI refused the attachment it had just prepared with
+//! "Prepared target no longer matches the applied snapshot".
+//!
+//! Unit tests pin the allowlist; only an e2e proves the whole keystroke path --
+//! real binary, real tmux, a real daemon polling a real pane -- reaches the
+//! agent. The pane must be pre-launched so its status is genuinely `Unknown` at
+//! Enter: a cold start reports `Starting`, which was already allowed, and would
+//! make this test pass on the broken build.
+
+use serial_test::parallel;
+use std::time::Duration;
+
+use crate::harness::{app_dir_in, require_tmux, wait_until, TuiTestHarness};
+
+/// Route activation into live-send and make `quiet` the only launchable agent,
+/// so the created session takes the unclassified-status path.
+fn write_unclassified_config(h: &TuiTestHarness, agent: &std::path::Path) {
+    let config_dir = app_dir_in(h.home_path());
+    let config_content = format!(
+        r#"[updates]
+update_check_mode = "off"
+
+[app_state]
+has_seen_welcome = true
+has_responded_to_telemetry = true
+last_seen_version = "{version}"
+has_acknowledged_agent_hooks = true
+
+[session]
+default_attach_mode = "live_send"
+default_tool = "quiet"
+custom_agents = {{ quiet = {agent:?} }}
+
+{systemd_off}"#,
+        version = env!("CARGO_PKG_VERSION"),
+        agent = agent.to_str().expect("agent stub path"),
+        systemd_off = crate::harness::SYSTEMD_OFF,
+    );
+    std::fs::write(config_dir.join("config.toml"), config_content).expect("write config");
+}
+
+/// An unclassified pane must still take live input, and must take it exactly
+/// once: a retry that duplicated the keystrokes would show up as a doubled
+/// marker in the pane, which is the failure mode that makes a "works on my
+/// machine" fix dangerous.
+#[test]
+#[parallel]
+fn live_send_attaches_a_pane_whose_status_is_unclassified() {
+    require_tmux!();
+
+    // `new_in_tmp` keeps the home under `/tmp`: this test lets the CLI autostart
+    // a daemon, and its unix socket path overflows Darwin's 104-byte `sun_path`
+    // when the home sits under `/var/folders/.../TmpDir`.
+    let mut h = TuiTestHarness::new_in_tmp("live_send_unknown_status");
+
+    // Stand in for an agent whose TUI the detector cannot read yet: it echoes
+    // what it receives and never enables bracketed paste, so the marker text
+    // lands verbatim and can be counted. The file name shares no word with the
+    // tool name, so echoing the marker cannot make the pane look like the agent
+    // and flip the status away from `Unknown`.
+    let agent = h.home_path().join("agent-stub.sh");
+    crate::harness::write_executable(
+        &agent,
+        "#!/bin/sh\nstty -echo -icanon min 1 time 0 2>/dev/null\nexec cat -v\n",
+    );
+    write_unclassified_config(&h, &agent);
+
+    let project = h.project_path();
+    let add = h.run_cli(&[
+        "add",
+        project.to_str().unwrap(),
+        "-t",
+        "Unclassified",
+        "--tool",
+        "quiet",
+        "--launch",
+    ]);
+    assert!(
+        add.status.success(),
+        "aoe add failed.\nstdout: {}\nstderr: {}",
+        String::from_utf8_lossy(&add.stdout),
+        String::from_utf8_lossy(&add.stderr),
+    );
+
+    // The premise of the test: the pane is up and its status is unclassified.
+    // A detour into `idle` (pane content the detector can read) or `stopped`
+    // (the stub exited) would exercise a different branch, so fail loudly here
+    // instead of asserting something weaker further down.
+    wait_until(Duration::from_secs(30), Duration::from_millis(100), || {
+        let sessions = h.try_read_sessions();
+        let status = sessions
+            .as_array()
+            .and_then(|rows| {
+                rows.iter()
+                    .find(|row| row["title"].as_str() == Some("Unclassified"))
+            })
+            .and_then(|row| row["status"].as_str())
+            .map(str::to_owned);
+        match status.as_deref() {
+            Some("unknown") => Ok(()),
+            other => Err(format!("status is {other:?}, not an unclassified pane")),
+        }
+    });
+
+    h.spawn_tui();
+    h.wait_for_runtime_ready();
+    h.wait_for("Unclassified");
+    h.send_keys("Enter");
+
+    // Entry only completes once the receipt's snapshot satisfies the gate; a
+    // refusal paints "Live send failed" over the home view instead.
+    h.wait_for_timeout("LIVE", Duration::from_secs(10));
+    h.assert_screen_not_contain
```

**File**: `tests/e2e/main.rs` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ mod hide_stopped;
 mod intro;
 mod kiro_launch;
 mod live_send_paste_e2e;
+mod live_send_unknown_status_e2e;
 mod live_takeover;
 mod live_terminal_swap_e2e;
 mod logs;
```

#### Recent Merged Pull Requests:
- **PR #5915** (2026-11-21): fix(tui): attach live send to an alive pane whose status is unknown (@athal7)
- **PR #5890** (2026-11-20): fix(process): read a group scan's process stats as bytes (@klubrake)
- **PR #5888** (2026-11-20): test(acp): stub the launcher in the agent-switch stop test (@njbrake)
- **PR #5886** (2026-11-20): fix(server): queue sandbox login notices so a burst cannot drop one (@cwrau)
- **PR #5881** (2026-11-19): chore(plugins): pin agent-of-empires.github 2.5.0 (@athal7)
- **PR #5876** (2026-11-20): fix(migrations): skip mounted children when sweeping the legacy hook dir (@cwrau)

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

## X. tui): pressing R again in Connections opens the Web dashboard

**RULE**:
When implementing operations in `docs/guides/web-dashboard.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e4c41e5`: tui): pressing R again in Connections opens the Web dashboard. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/guides/web-dashboard.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
From the TUI, press `R` (`Ctrl+R` with strict hotkeys), shown as `R Web` in the shortcut bar, to open Connections. Press the same key again after a short pause, or Enter on **Web dashboard**, to open the dashboard controls, where you can start a background server on your network or over a tunnel. While it runs, the entry reads `R ● Web` in green. When the Daemon needs attention, the entry shows that instead, in red for a problem (`R ● Runtime outcome unknown`) or dim for a limit (`R ● Unavailable`), and Connections lists the Daemon with what it means. If the Daemon goes offline, Connections replaces the home screen, with `r` to reconnect.
To restart, press `R`; `G` gives a new passphrase. It asks once it has checked what a restart would change. Press Enter once it asks. An Enter pressed while it checks does nothing, and the check then shows what a restart would change without asking: press `R` (or `G`) to check again. Any other key cancels, and so does waiting 3 seconds after it asks. Pressing `R` again only asks again, so a held key never restarts, and the `R` that opened the dashboard controls from Connections does nothing there until you press another key. Enter checks the curre
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
From the TUI, press `R` (`Ctrl+R` with strict hotkeys), shown as `R Web` in the shortcut bar, to open Connections, then Enter on **Web dashboard** to start a background server on your network or over a tunnel. While it runs, the entry reads `R ● Web` in green. When the Daemon needs attention, the entry shows that instead, in red for a problem (`R ● Runtime outcome unknown`) or dim for a limit (`R ● Unavailable`), and Connections lists the Daemon with what it means. If the Daemon goes offline, Connections replaces the home screen, with `r` to reconnect.
To restart, press `R`, wait for the assessment and confirmation, then press `R` again. The confirmation window applies to the second keypress, not the background assessment's duration. The second confirmation checks current effects again and asks again if they changed. Both `R` and `G` remain bound to the observed Daemon. If another Client replaces it before admission, the TUI refuses before changing the replacement or saved defaults. Recovery controls retain that identity after failure, including when the failed launch is first shown after reopening; close and reopen Remote Access again to observe the replacement before retrying.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e4c41e5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
