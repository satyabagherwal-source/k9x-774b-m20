# Verification Protocol: Verification Protocol: Empirical Defect Shield for agent-of-empires/agent-of-empires

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires/agent-of-empires",
  "source_url": "https://github.com/agent-of-empires/agent-of-empires",
  "source_version": "0dedf44e",
  "license": "MIT",
  "timestamp": "2026-11-14T12:33:54.200Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-of-empires-agent-of-empires",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires) (Revision: `0dedf44e`).  
> **License**: MIT | **Timestamp**: `2026-11-14T12:33:54.200Z`  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`


## 1. Scope & Verification Target
- **Target Repository**: `agent-of-empires/agent-of-empires` (Commit: `0dedf44e`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): agent-of-empires/agent-of-empires

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T12:33:53.149Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4340 stars

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
    pub(super) pending_prompts: VecDeque<Vec<ContentBlock>>,
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
                Some(blocks) => Some(ClientCmd::Prompt(blocks)),
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
                Some(ClientCmd::Prompt(blocks)) => {
                    if self.run_prompt(blocks).await? {
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
                    self.stand_down_
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
- **Issue #5677** (2026-11-14): **Purge and an e2e helper still count a zombie runner as running**
  *Symptoms*: ### What happened?  Follow-up from #5667 (review by @Seluj78). #5667 made `is_record_live` treat a zombie runner as not live, and named two other checks that still count a zombie as running. Both fail closed:  - `worker::is_process_group_alive` (`killpg`/`kill` with signal 0), used by `session::purge_owners`. Purging a Session whose runner is a zombie stays refused until the zombie is reaped, which never happens when PID 1 doesn't reap (a container without an init). - `pid_alive` in `tests/e2e/systemd_scope.rs` only checks that `/proc/<pid>` exists. Those tests skip without a user systemd manager.  Proposed: read the same `/proc` state #5667 uses on Linux in both places, with a test for a zombie owner.  Evidence strength: from #5667's description and review; not reproduced separately.  ### aoe version and OS  main after #5667, Linux.  ### AI usage  Drafted by Claude Code (Claude Opus 5.5) from the review comment, reviewed by a human before filing. 

- **Issue #5663** (2026-11-13): **Worker registry treats a zombie runner as live when PID 1 doesn't reap**
  *Symptoms*: ### What problem does this solve?  `is_record_live` (`src/process/worker_registry.rs:589`) treats a runner as live when three checks pass: its recorded birth matches, `is_pid_alive` succeeds, and its socket file exists. `is_pid_alive` (`src/process/worker.rs:21`) is `kill(pid, 0)`, which succeeds on a zombie. The birth check reads the start time from `/proc` and ignores the process state.  A runner is spawned detached with `setsid`, so when the daemon exits its runners are re-parented to PID 1. If PID 1 doesn't reap, as in a container started without `--init` whose PID 1 is a shell or `sleep`, a runner that exits after that stays a zombie. Its socket file also stays. So all three checks read true for a dead runner.  Reproduced at the level of these checks in a container whose PID 1 is `sleep infinity`. The dead runner reads `state=Z ppid=1` with an unchanged start time, `kill(pid, 0)` succeeds, the socket file exists, and `connect` returns `ECONNREFUSED`. It has not been reproduced end to end through a daemon restart.  Callers that would then act on a dead runner (read, not run): - `src/server/acp_reconciler/resume.rs:169` picks Attach over a fresh spawn. - `src/acp/supervisor/launch.rs:191` counts it towards runner capacity. - `src/acp/supervisor/drain.rs:566` keeps retrying the reattach.  The runner guard's `executing()` (`src/process/mod.rs:1141`) already tells a zombie apart, so the registry and the guard can disagree about the same process.  **Proposed change**  Treat a 

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

### Incident Patch 1: `5b6d208f` (2026-11-13)
**Commit Message**: fix(tui): flash deletion cleanup notes instead of a blocking dialog (#5641)

* fix(tui): flash deletion cleanup notes instead of a blocking dialog

A committed purge opened a "Runtime change" dialog for its cleanup notes,
which rendered under permission and agent-question dialogs while handle_key
consulted it first, so an invisible modal swallowed keys until Enter.

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <[REDACTED_EMAIL]>

* fix(tui): keep every deletion note and promote dialogs after a draw

Each purge outcome now contributes its cleanup notes to one status line that
names the session, so a group delete no longer keeps only the last note. The
flash window starts when the status bar actually draws, so a note arriving
behind settings or the diff view cannot expire unseen, and runtime dialogs are
promoted from the tick path only, where a draw always precedes the next key.

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <[REDACTED_EMAIL]>

* test(tui): hold a runtime note while another dialog owns the keyboard

Extends the promotion test to cover the queued-message gate: an open confirm
dialog keeps the note queued and it is shown once that dialog closes.

🤖 Genera

**File**: `src/tui/app.rs` (modified, +4/-3)
```diff
@@ -726,7 +726,8 @@ impl App {
 
             tokio::select! {
                 event = self.event_stream.as_mut().expect("event_stream missing").next() => {
-                    self.home.apply_session_feed();
+                    // Keys reach the view before the next draw, so no dialog is promoted here.
+                    self.home.apply_session_feed_before_input();
                     self.home.enforce_trash_read_only();
                     if self.home.selected_is_trashed() {
                         self.close_embedded_structured();
@@ -3206,7 +3207,7 @@ impl App {
 
         self.needs_redraw = true;
         crate::tmux::refresh_session_cache();
-        self.home.apply_session_feed();
+        self.home.apply_session_feed_before_input();
         let result = self.home.reload();
         self.home.reload_failure_state.record_storage(&result);
         self.home.try_present_reload_failure_dialog();
@@ -3278,7 +3279,7 @@ impl App {
             }),
         )?;
         self.needs_redraw = true;
-        self.home.apply_session_feed();
+        self.home.apply_session_feed_before_input();
         self.select_after_attach(&ready.id);
         if let Err(error) = attach_result {
             tracing::warn!(target: "tui.input", %error, "Native tmux attach failed");
```

**File**: `src/tui/home/mod.rs` (modified, +1/-1)
```diff
@@ -349,7 +349,7 @@ pub struct HomeView {
     pub(super) live_send_resize_retry_at: Option<std::time::Instant>,
     pub(super) live_send_pending_leader: bool,
     pub(super) hover_cell: Option<(u16, u16)>,
-    pub(super) status_flash: Option<(String, std::time::Instant)>,
+    pub(super) status_flash: Option<overlays::StatusFlash>,
     pub(super) live_send_ctrl_c_flash_until: Option<std::time::Instant>,
     /// Session whose live control another window took, until the selection moves or live
     /// mode starts again.
```

**File**: `src/tui/home/overlays.rs` (modified, +26/-4)
```diff
@@ -5,6 +5,15 @@ use std::time::{Duration, Instant};
 
 const FLASH_WINDOW: Duration = Duration::from_secs(3);
 
+/// A status-bar message and the window it is shown for. `until` stays `None`
+/// until a draw can actually show the text: a takeover view (settings, diff)
+/// returns before the status bar renders, so a window armed when the message
+/// arrived would run out unseen.
+pub(in crate::tui) struct StatusFlash {
+    pub(super) text: String,
+    pub(super) until: Option<Instant>,
+}
+
 impl HomeView {
     /// Expire the settings view's transient "Settings saved" toast when its
     /// window passes, so it fades even while the keyboard is idle. Returns true
@@ -162,15 +171,28 @@ impl HomeView {
     /// Matches the Ctrl+C hint's window so the two read as the same kind of
     /// thing.
     pub(in crate::tui) fn flash_status(&mut self, text: impl Into<String>) {
-        self.status_flash = Some((text.into(), Instant::now() + FLASH_WINDOW));
+        self.status_flash = Some(StatusFlash {
+            text: text.into(),
+            until: None,
+        });
+    }
+
+    /// Start the display window of a flash that has not been drawn yet. Called
+    /// by the status bar render so the window measures time on screen.
+    pub(in crate::tui) fn arm_status_flash(&mut self) {
+        if let Some(flash) = self.status_flash.as_mut() {
+            flash
+                .until
+                .get_or_insert_with(|| Instant::now() + FLASH_WINDOW);
+        }
     }
 
     /// The flash text while it is still within its window.
     pub(in crate::tui) fn status_flash_text(&self) -> Option<&str> {
         self.status_flash
             .as_ref()
-            .filter(|(_, deadline)| Instant::now() < *deadline)
-            .map(|(text, _)| text.as_str())
+            .filter(|flash| flash.until.is_none_or(|until| Instant::now() < until))
+            .map(|flash| flash.text.as_str())
     }
 
     /// Drop a flash whose window has closed, reporting whether anything
@@ -179,7 +201,7 @@ impl HomeView {
         if self
             .status_flash
             .as_ref()
-            .is_some_and(|(_, deadline)| Instant::now() >= *deadline)
+            .is_some_and(|flash| flash.until.is_some_and(|until| Instant::now() >= until))
         {
             self.status_flash = None;
             return true;
```

**File**: `src/tui/home/render.rs` (modified, +2/-0)
```diff
@@ -4246,6 +4246,8 @@ impl HomeView {
     }
 
     fn render_status_bar(&mut self, frame: &mut Frame, area: Rect, theme: &Theme) {
+        // The bar is on screen from here, so a queued flash can start counting.
+        self.arm_status_flash();
         // Action feedback takes precedence over a hovered link target.
         let hovered = (!self.live_send_pending_leader)
             .then(|| self.hovered_link())
```

**File**: `src/tui/home/status.rs` (modified, +58/-7)
```diff
@@ -765,6 +765,18 @@ impl HomeView {
     /// Apply a pending session-list result from the daemon. Returns true if
     /// the caller should redraw.
     pub fn apply_session_feed(&mut self) -> bool {
+        self.apply_session_feed_with_dialogs(true)
+    }
+
+    /// Apply a pending session-list result without promoting a runtime dialog.
+    /// The event loop dispatches the key that woke it before the next draw, so
+    /// a dialog promoted here would eat a key the user never saw. The tick path
+    /// promotes instead, always ahead of a draw.
+    pub fn apply_session_feed_before_input(&mut self) -> bool {
+        self.apply_session_feed_with_dialogs(false)
+    }
+
+    fn apply_session_feed_with_dialogs(&mut self, promote_dialogs: bool) -> bool {
         use crate::tui::session_feed::{SessionFeedResult, SidebarSource};
         use std::sync::mpsc::TryRecvError;
 
@@ -907,7 +919,7 @@ impl HomeView {
                 self.clear_unread_on_view(&id);
             }
         }
-        let outcomes_changed = self.apply_runtime_outcomes();
+        let outcomes_changed = self.apply_runtime_outcomes(promote_dialogs);
         let pending_after =
             self.session_feed.any_pending() || self.pending_namespace_intent.is_some();
         updated
@@ -1088,14 +1100,23 @@ impl HomeView {
         self.runtime_outcome_messages.push(message);
     }
 
-    fn record_purge_outcome(&mut self, id: &str, outcome: crate::daemon::PurgeOutcome) {
+    pub(super) fn record_purge_outcome(
+        &mut self,
+        id: &str,
+        outcome: crate::daemon::PurgeOutcome,
+        notes: &mut Vec<(String, String)>,
+    ) {
         match outcome {
             crate::daemon::PurgeOutcome::Deleted {
                 messages,
                 cleanup_errors,
             } => {
+                // A committed deletion needs no acknowledgement, and a modal here
+                // can land under a permission or question dialog and swallow keys.
+                // Its cleanup notes belong in the status line and the log.
                 for message in messages {
-                    self.record_runtime_message(format!("{id}: {message}"));
+                    tracing::info!(target: "tui.runtime_outcome", session = %id, message = %message, "Session deletion cleanup");
+                    notes.push((id.to_owned(), message));
                 }
                 for error in cleanup_errors {
                     self.record_runtime_message(format!(
@@ -1122,12 +1143,13 @@ impl HomeView {
         }
     }
 
-    fn apply_runtime_outcomes(&mut self) -> bool {
+    fn apply_runtime_outcomes(&mut self, promote_dialogs: bool) -> bool {
         use crate::daemon::{NamespaceOutcome, ReorderOutcome};
         use crate::tui::session_feed::{CommandFailure, SessionCommandOutcome};
         let row_outcomes = self.session_feed.drain_session_outcomes();
         let namespace = self.session_feed.drain_namespace_result();
         let mut changed = !row_outcomes.is_empty() || namespace.is_some();
+        let mut purge_notes: Vec<(String, String)> = Vec::new();
         for (id, outcome) in row_outcomes {
             match outcome {
                 SessionCommandOutcome::Trashed(receipt) => match receipt.outcome.relocation {
@@ -1144,7 +1166,7 @@ impl HomeView {
                     | crate::daemon::TrashRelocationOutcome::Skipped => {}
                 },
                 SessionCommandOutcome::Purged(receipt) => {
-                    self.record_purge_outcome(&id, receipt.outcome)
+                    self.record_purge_outcome(&id, receipt.outcome, &mut purge_notes)
                 }
                 SessionCommandOutcome::Renamed(receipt) => {
                     for warning in receipt.outcome.warnings {
@@ -1247,7 +1269,11 @@ impl HomeView {
                             );
                         }
                         for session in outcome.sessions {
-                            self.record_purge_outcome(&session.id, session.outcome);
+                            self.record_purge_outcome(
+                                &session.id,
+                                session.outcome,
+                                &mut purge_notes,
+                            );
                         }
                         for failure in outcome.failures {
                             self.record_runtime_message(format!(
@@ -1315,7 +1341,14 @@ impl HomeView {
                 },
             }
         }
-        if self.info_dialog.is_none() && !self.runtime_outcome_messages.is_empty() {
+        if !purge_notes.is_empty() {
+            self.flash_status(purge_flash_text(&purge_notes));
+            changed = true;
+        }
+        if promote_dialogs
+            && !self.has_non_live_send_overlay()
+            && !self.runtime_outcome_messages.is_empty()
+        {
             let messages = std::mem::take(&mut self.runtime_outcome_messages);
             self.info_dialog = Some(InfoDialog::sized_to_fit(
 
```

**File**: `src/tui/home/tests/preview_links.rs` (modified, +4/-4)
```diff
@@ -171,10 +171,10 @@ fn status_flash_shows_then_expires_without_acknowledgement() {
     assert!(!env.view.expire_status_flash());
 
     // Reach the deadline without sleeping through it.
-    env.view.status_flash = Some((
-        "opened https://example.com/aoe".to_string(),
-        std::time::Instant::now(),
-    ));
+    env.view.status_flash = Some(crate::tui::home::overlays::StatusFlash {
+        text: "opened https://example.com/aoe".to_string(),
+        until: Some(std::time::Instant::now()),
+    });
     assert_eq!(env.view.status_flash_text(), None, "window has closed");
     assert!(
         env.view.expire_status_flash(),
```

**File**: `src/tui/home/tests/session_feed_tests.rs` (modified, +156/-0)
```diff
@@ -3795,3 +3795,159 @@ async fn keyboard_palette_recovery_executes_captured_commands_and_preserves_file
         assert_eq!(std::fs::read(sentinel).unwrap(), b"keep recovery files");
     }
 }
+
+/// A committed deletion reports its cleanup notes without a modal: the delete
+/// already happened, and an InfoDialog here can land underneath a permission or
+/// question dialog and swallow every keystroke until it is acknowledged.
+#[test]
+#[serial]
+fn purge_cleanup_messages_flash_instead_of_opening_a_modal() {
+    let mut env = create_test_env_with_sessions(1);
+    let id = env.view.instance_at(0).id.clone();
+    let mut notes = Vec::new();
+    env.view.record_purge_outcome(
+        &id,
+        crate::daemon::PurgeOutcome::Deleted {
+            messages: vec!["Branch 'aoe/work' deleted".to_string()],
+            cleanup_errors: Vec::new(),
+        },
+        &mut notes,
+    );
+    assert!(env.view.info_dialog.is_none());
+    assert_eq!(
+        super::super::status::purge_flash_text(&notes),
+        format!("{id}: Branch 'aoe/work' deleted")
+    );
+
+    env.view.record_purge_outcome(
+        &id,
+        crate::daemon::PurgeOutcome::Deleted {
+            messages: Vec::new(),
+            cleanup_errors: vec!["Branch: not fully merged".to_string()],
+        },
+        &mut Vec::new(),
+    );
+    assert!(
+        env.view.info_dialog.is_none(),
+        "the modal opens on the next apply_session_feed"
+    );
+    env.view.apply_session_feed();
+    assert_eq!(
+        env.view.info_dialog.as_ref().map(|d| d.title()),
+        Some("Runtime change"),
+        "an incomplete cleanup still needs an acknowledgement"
+    );
+}
+
+/// A group delete reports one note per session in one pass. Every note has to
+/// reach the single status line that replaces the old modal, with the session
+/// it belongs to, so nothing is lost to the last write winning.
+#[test]
+#[serial]
+fn purge_cleanup_notes_survive_a_multi_session_delete_in_one_flash() {
+    let mut env = create_test_env_with_sessions(2);
+    let first = env.view.instance_at(0).id.clone();
+    let second = env.view.instance_at(1).id.clone();
+    let mut notes = Vec::new();
+    for id in [&first, &second] {
+        env.view.record_purge_outcome(
+            id,
+            crate::daemon::PurgeOutcome::Deleted {
+                messages: vec![
+                    "Worktree removed".to_string(),
+                    format!("Branch 'aoe/{id}' deleted"),
+                ],
+                cleanup_errors: Vec::new(),
+            },
+            &mut notes,
+        );
+    }
+    assert_eq!(
+        super::super::status::purge_flash_text(&notes),
+        format!(
+            "{first}, {second}: Worktree removed; {first}: Branch 'aoe/{first}' deleted; \
+             {second}: Branch 'aoe/{second}' deleted"
+        ),
+        "a shared note names both sessions and no session's note is dropped"
+    );
+}
+
+/// The flash window measures time on screen. A takeover view renders before the
+/// status bar, so a note that arrives behind settings must not count down there
+/// and expire before it is ever shown.
+#[test]
+#[serial]
+fn status_flash_window_starts_when_the_bar_is_drawn() {
+    let mut env = create_test_env_with_sessions(1);
+    env.view.flash_status("Copied selection");
+    assert!(
+        env.view.status_flash.as_ref().unwrap().until.is_none(),
+        "a fresh flash has not started counting down"
+    );
+    assert!(!env.view.expire_status_flash());
+
+    env.view.settings_view = Some(crate::tui::settings::SettingsView::new("test", None).unwrap());
+    render_home_to_string(&mut env.view, 120, 24);
+    assert!(
+        env.view.status_flash.as_ref().unwrap().until.is_none(),
+        "settings covers the status bar, so the window cannot have started"
+    );
+
+    env.view.settings_view = None;
+    render_home_to_string(&mut env.view, 120, 24);
+    assert!(
+        env.view.status_flash.as_ref().unwrap().until.is_some(),
+        "the bar is drawn, so the window starts now"
+    );
+    assert_eq!(env.view.status_flash_text(), Some("Copied selection"));
+    assert!(!env.view.expire_status_flash());
+}
+
+/// A dialog promoted while a key event is being handled would consume that same
+/// key before the user ever sees it. Only the tick path promotes, and it always
+/// draws first.
+#[test]
+#[serial]
+fn runtime_change_dialog_is_promoted_only_before_a_draw() {
+    let mut env = create_test_env_with_sessions(1);
+    env.view
+        .record_runtime_message("Reveal cancelled: no such session".to_string());
+    env.view.apply_session_feed_before_input();
+    assert!(
+        env.view.info_dialog.is_none(),
+        "the key that woke the loop must reach the view, not a dialog"
+    );
+    assert_eq!(
+        env.view.runtime_outcome_messages.len(),
+        1,
+        "the note waits for a draw instead of being dropped"
+    );
+
+    env.view.apply_session_feed();
+    assert_eq!(
+
```

**File**: `src/tui/home/tests/shortcut_bar.rs` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ fn hidden_bar_preserves_temporary_feedback_and_keyboard_actions() {
     let screen = render_home_to_string(&mut env.view, 120, 24);
     assert!(screen.contains("Copied selection"));
     assert_eq!(env.view.preview_outer_area.bottom(), 23);
-    env.view.status_flash.as_mut().unwrap().1 = std::time::Instant::now();
+    env.view.status_flash.as_mut().unwrap().until = Some(std::time::Instant::now());
     assert!(env.view.expire_status_flash());
     render_home_to_string(&mut env.view, 120, 24);
     assert_eq!(env.view.preview_outer_area.bottom(), 24);
```

---

### Incident Patch 2: `7a8fa6a3` (2026-11-13)
**Commit Message**: fix(serve): resolve session config once per repo across linked worktrees (#5616)

* chore(file-watch): log why the dispatcher stops and who created the service

The v1.23.0 daemon logs dispatcher_loop_exit at startup without a panic.
That reason only means the dispatcher future was dropped. Record the
creation site, the thread, and whether a runtime is still current when
the future is dropped before run_dispatcher returns.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve): resolve session config once per repo across linked worktrees

list_sessions and publish resolved config per (profile, worktree path),
and each miss reopened the main repo through libgit2 to find the repo
config. In a repo with hundreds of worktrees that parse dominated the
daemon, so every session mutation waited about a second behind publish.

find_main_repo now reads the worktree gitdir file before opening the
repo, and the per-request cache keys on the repo config source so
worktrees of one repo share an entry.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix(serve): memoize repo config source discovery per request

Discovery opens the repo through libgit2 for a main checkout, and

**File**: `src/file_watch.rs` (modified, +55/-3)
```diff
@@ -254,6 +254,7 @@ impl FileWatchService {
     }
 
     /// Falls back to `noop()` when the backend fails or `AOE_FILE_WATCH=off`.
+    #[track_caller]
     pub fn new() -> Result<Arc<Self>, WatchError> {
         if std::env::var("AOE_FILE_WATCH").as_deref() == Ok("off") {
             tracing::info!(
@@ -325,7 +326,11 @@ impl FileWatchService {
         crate::task_util::spawn_supervised(
             "file_watch.dispatcher",
             crate::task_util::PanicPolicy::Log,
-            dispatcher_loop(Arc::downgrade(&svc), tokio_rx),
+            dispatcher_loop(
+                Arc::downgrade(&svc),
+                tokio_rx,
+                std::panic::Location::caller(),
+            ),
         );
 
         Ok(svc)
@@ -652,20 +657,45 @@ fn classify_event_kind(ev: &notify::Event) -> Option<FileEventKind> {
 async fn dispatcher_loop(
     svc: Weak<FileWatchService>,
     mut rx: mpsc::UnboundedReceiver<DispatchMsg>,
+    origin: &'static std::panic::Location<'static>,
 ) {
-    // Flips `dispatcher_dead` on every exit path of `run_dispatcher`, including panic.
+    tracing::debug!(
+        target: "file_watch.service",
+        %origin,
+        thread = ?std::thread::current().name(),
+        "file watch dispatcher started"
+    );
+    // Flips `dispatcher_dead` on every exit path of `run_dispatcher`, including panic and
+    // the future being dropped (runtime shutdown or task abort).
     struct ExitLatch<'a> {
         svc: &'a Weak<FileWatchService>,
+        origin: &'static std::panic::Location<'static>,
+        returned: bool,
     }
     impl Drop for ExitLatch<'_> {
         fn drop(&mut self) {
+            if !self.returned {
+                tracing::error!(
+                    target: "file_watch.service",
+                    origin = %self.origin,
+                    thread = ?std::thread::current().name(),
+                    panicking = std::thread::panicking(),
+                    in_runtime = tokio::runtime::Handle::try_current().is_ok(),
+                    "file watch dispatcher future dropped before run_dispatcher returned"
+                );
+            }
             if let Some(arc) = self.svc.upgrade() {
                 log_dispatcher_dead_once(&arc, "dispatcher_loop_exit", None);
             }
         }
     }
-    let _guard = ExitLatch { svc: &svc };
+    let mut guard = ExitLatch {
+        svc: &svc,
+        origin,
+        returned: false,
+    };
     let exit_reason = run_dispatcher(svc.clone(), &mut rx).await;
+    guard.returned = true;
     if let Some(arc) = svc.upgrade() {
         log_dispatcher_dead_once(&arc, exit_reason, None);
     }
@@ -1349,6 +1379,28 @@ mod tests {
         }
     }
 
+    #[test]
+    fn dispatcher_dead_when_its_runtime_shuts_down() {
+        let runtime = tokio::runtime::Builder::new_current_thread()
+            .enable_time()
+            .build()
+            .unwrap();
+        let svc = runtime.block_on(async {
+            let svc = FileWatchService::new().expect("init");
+            // The barrier ack proves the dispatcher was polled, so its exit guard exists.
+            tokio::time::timeout(
+                Duration::from_secs(5),
+                super::test_support::dispatch_barrier(&svc),
+            )
+            .await
+            .expect("dispatcher acknowledges the barrier");
+            svc
+        });
+        assert!(!svc.dispatcher_dead.load(Ordering::Acquire));
+        drop(runtime);
+        assert!(svc.dispatcher_dead.load(Ordering::Acquire));
+    }
+
     #[tokio::test]
     async fn dispatcher_dead_latch_is_one_way() {
         let svc = FileWatchService::new().expect("init");
```

**File**: `src/git/worktree/mod.rs` (modified, +6/-4)
```diff
@@ -127,10 +127,12 @@ impl GitWorktree {
     }
 
     pub fn find_main_repo(path: &Path) -> Result<PathBuf> {
-        let Ok(repo) = open_repo_at(path) else {
-            return Self::find_main_repo_from_linked_worktree_gitfile(path)
-                .ok_or(GitError::NotAGitRepo);
-        };
+        // Opening a linked worktree parses the shared repo config, which is costly in a repo
+        // with many worktrees, so read the gitdir file first.
+        if let Some(main_repo) = Self::find_main_repo_from_linked_worktree_gitfile(path) {
+            return Ok(main_repo);
+        }
+        let repo = open_repo_at(path).map_err(|_| GitError::NotAGitRepo)?;
         if let Some(main_repo) = Self::find_main_repo_from_worktree_gitdir(repo.path()) {
             return Ok(main_repo);
         }
```

**File**: `src/server/api/sessions/model.rs` (modified, +29/-3)
```diff
@@ -382,11 +382,15 @@ pub(super) fn custom_agent_acp_capable(
         || crate::acp::inherited_acp_base(tool, &session.agent_detect_as).is_some()
 }
 
-/// Per-request cache for `(profile, project_path)` config resolution, shared
+/// Per-request cache for `(profile, repo config source)` config resolution, shared
 /// across the `list_sessions` overlays so a repo-local override is read from
 /// disk once per unique pair rather than once per row. See #2603.
 pub(super) struct SessionCfgCache<'a> {
-    entries: HashMap<(String, String), (SessionConfig, StructuredView)>,
+    entries: HashMap<(String, std::path::PathBuf), (SessionConfig, StructuredView)>,
+    /// `project_path` to its repo config source; discovery can open the repo through libgit2.
+    sources: HashMap<String, std::path::PathBuf>,
+    #[cfg(test)]
+    pub(super) discoveries: usize,
     /// Where this cache reports its disk reads. The counter belongs to the
     /// request, not to the cache, so every cache the request opens adds to
     /// one total: splitting the shared cache per overlay then shows up as
@@ -399,14 +403,36 @@ impl<'a> SessionCfgCache<'a> {
     pub(super) fn new(misses: &'a std::sync::atomic::AtomicUsize) -> Self {
         Self {
             entries: HashMap::new(),
+            sources: HashMap::new(),
+            #[cfg(test)]
+            discoveries: 0,
             misses,
         }
     }
+
+    fn source(&mut self, project_path: &str) -> std::path::PathBuf {
+        if let Some(source) = self.sources.get(project_path) {
+            return source.clone();
+        }
+        #[cfg(test)]
+        {
+            self.discoveries += 1;
+        }
+        let source = crate::session::config::repo_config::repo_config_source_path(
+            std::path::Path::new(project_path),
+        );
+        self.sources
+            .insert(project_path.to_string(), source.clone());
+        source
+    }
+
     /// Resolve `(profile, project_path)`, reading from disk on first miss only.
     fn entry(&mut self, profile: &str, project_path: &str) -> &(SessionConfig, StructuredView) {
         let misses = self.misses;
+        // Linked worktrees read their repo config from the main repo, so they share an entry.
+        let source = self.source(project_path);
         self.entries
-            .entry((profile.to_string(), project_path.to_string()))
+            .entry((profile.to_string(), source))
             .or_insert_with(|| {
                 misses.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                 let config = crate::session::config::repo_config::resolve_config_with_repo_or_warn(
```

**File**: `src/server/api/sessions/tests.rs` (modified, +135/-0)
```diff
@@ -4375,6 +4375,141 @@ async fn list_sessions_shares_config_resolution_across_overlays() {
     );
 }
 
+fn run_git(dir: &std::path::Path, args: &[&str]) {
+    let out = std::process::Command::new("git")
+        .args([
+            "-c",
+            "user.name=t",
+            "-c",
+            "user.email=t@t",
+            "-c",
+            "init.defaultBranch=main",
+        ])
+        .args(args)
+        .current_dir(dir)
+        .output()
+        .expect("run git");
+    assert!(out.status.success(), "git {args:?}: {out:?}");
+}
+
+// Source discovery can open the repo through libgit2, so a main checkout shared by many
+// sessions must be discovered once per request, not on every cache hit.
+#[test]
+#[serial_test::serial]
+fn session_cfg_cache_discovers_a_repeated_main_checkout_once() {
+    use std::sync::atomic::{AtomicUsize, Ordering};
+
+    let tmp_home = tempfile::tempdir().expect("tempdir HOME");
+    let _home = crate::session::test_support::isolate_app_dir_at(tmp_home.path());
+    let repo = tempfile::tempdir().expect("tempdir repo");
+    run_git(repo.path(), &["init", "-q"]);
+    let path = repo.path().to_str().unwrap();
+
+    let misses = AtomicUsize::new(0);
+    let mut cache = super::model::SessionCfgCache::new(&misses);
+    for _ in 0..3 {
+        cache.resolve("default", path);
+        cache.structured_view("default", path);
+    }
+
+    assert_eq!(cache.discoveries, 1);
+    assert_eq!(misses.load(Ordering::Relaxed), 1);
+}
+
+// Repo roots that differ only in non-UTF-8 bytes must not share a config. APFS rejects such names.
+#[cfg(target_os = "linux")]
+#[test]
+#[serial_test::serial]
+fn session_cfg_cache_keeps_non_utf8_repo_roots_apart() {
+    use std::os::unix::ffi::OsStrExt;
+    use std::sync::atomic::{AtomicUsize, Ordering};
+
+    let tmp_home = tempfile::tempdir().expect("tempdir HOME");
+    let _home = crate::session::test_support::isolate_app_dir_at(tmp_home.path());
+    let tmp = tempfile::tempdir().expect("tempdir repos");
+    let paths: Vec<String> = [b"r\xff".as_slice(), b"r\xfe".as_slice()]
+        .iter()
+        .enumerate()
+        .map(|(i, name)| {
+            let main = tmp.path().join(std::ffi::OsStr::from_bytes(name));
+            std::fs::create_dir(&main).unwrap();
+            run_git(&main, &["init", "-q"]);
+            run_git(&main, &["commit", "-q", "--allow-empty", "-m", "init"]);
+            let worktree = tmp.path().join(format!("wt{i}"));
+            run_git(
+                &main,
+                &[
+                    "worktree",
+                    "add",
+                    "-q",
+                    "-b",
+                    "b",
+                    worktree.to_str().unwrap(),
+                ],
+            );
+            worktree.to_str().unwrap().to_owned()
+        })
+        .collect();
+
+    let misses = AtomicUsize::new(0);
+    let mut cache = super::model::SessionCfgCache::new(&misses);
+    for path in &paths {
+        cache.resolve("default", path);
+    }
+
+    assert_eq!(misses.load(Ordering::Relaxed), 2);
+}
+
+// Regression witness for #5610: sessions in linked worktrees of one repo read the
+// same repo config, so they must share one resolution instead of one per worktree.
+#[tokio::test]
+#[serial_test::serial]
+async fn list_sessions_resolves_config_once_per_repo_across_linked_worktrees() {
+    use std::sync::atomic::Ordering;
+
+    let tmp_home = tempfile::tempdir().expect("tempdir HOME");
+    let _home = crate::session::test_support::isolate_app_dir_at(tmp_home.path());
+    let repo = tempfile::tempdir().expect("tempdir repo");
+    let main = repo.path().join("main");
+    std::fs::create_dir(&main).unwrap();
+    run_git(&main, &["init", "-q"]);
+    run_git(&main, &["commit", "-q", "--allow-empty", "-m", "init"]);
+    let sessions: Vec<Instance> = (0..3)
+        .map(|i| {
+            let worktree = repo.path().join(format!("wt{i}"));
+            run_git(
+                &main,
+                &[
+                    "worktree",
+                    "add",
+                    "-q",
+                    "-b",
+                    &format!("b{i}"),
+                    worktree.to_str().unwrap(),
+                ],
+            );
+            let mut inst = Instance::new("test-session", worktree.to_str().unwrap());
+            inst.tool = "custom-tool-5610".to_string();
+            inst.source_profile = "default".to_string();
+            inst
+        })
+        .collect();
+
+    let state = crate::server::test_support::build_test_app_state(sessions);
+    let _envelope = list_sessions(
+        axum::extract::State(state.clone()),
+        axum::extract::Query(ListSessionsQuery { state: None }),
+        axum::http::HeaderMap::new(),
+    )
+    .await;
+    let misses = state.list_sessions_resolver_misses.load(Ordering::Relaxed);
+
+    assert_eq!(
+        misses, 1,
+        "linked worktrees of one repo must share one resolution; got {misses}",
+    );
+}
+
```

**File**: `src/session/config/profile_config.rs` (modified, +7/-0)
```diff
@@ -174,8 +174,15 @@ pub fn apply_cityhall_overrides(config: &mut Config) {
     config.worktree.enabled = true;
 }
 
+#[cfg(test)]
+thread_local! {
+    pub(crate) static RESOLVES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
+}
+
 /// Load effective config for a profile (global + profile overrides merged)
 pub fn resolve_config(profile: &str) -> Result<Config> {
+    #[cfg(test)]
+    RESOLVES.with(|n| n.set(n.get() + 1));
     let global = Config::load()?;
     let profile_config = load_profile_config(profile)?;
     let mut config = merge_configs(global, &profile_config);
```

**File**: `src/session/instance/accessors.rs` (modified, +21/-7)
```diff
@@ -337,8 +337,16 @@ impl Instance {
     /// Whether a resume selector appended to this launch reaches the agent.
     /// Only a verified direct invocation or an explicit wrapper contract carries selectors.
     pub(crate) fn launch_can_carry_resume_selector(&self, agent: &crate::agents::AgentDef) -> bool {
-        self.execution_agent()
-            .is_ok_and(|actual| actual.name == agent.name)
+        self.launch_carries_selector(self.resolved_agent(), agent)
+    }
+
+    /// [`Self::launch_can_carry_resume_selector`] for a caller that already holds the execution identity.
+    pub(super) fn launch_carries_selector(
+        &self,
+        native: Option<&crate::agents::AgentDef>,
+        agent: &crate::agents::AgentDef,
+    ) -> bool {
+        native.is_some_and(|actual| actual.name == agent.name)
             && self.managed_user_argv(agent).is_ok()
     }
 
@@ -471,18 +479,24 @@ impl Instance {
 
     /// Bare wrappers can receive fresh-session selectors without attesting execution.
     pub(super) fn legacy_default_selector_agent(&self) -> Option<&'static crate::agents::AgentDef> {
+        let config = crate::session::config::profile_config::resolve_config_or_warn(
+            &self.effective_profile(),
+        );
+        self.legacy_default_selector_agent_in(&config.session)
+    }
+
+    pub(super) fn legacy_default_selector_agent_in(
+        &self,
+        config: &crate::session::config::SessionConfig,
+    ) -> Option<&'static crate::agents::AgentDef> {
         if matches!(
             self.resume_intent,
             ResumeIntent::Use(_) | ResumeIntent::Fork { .. }
         ) {
             return None;
         }
         let agent = resolved_agent_for(&self.effective_profile(), &self.tool, &self.detect_as)?;
-        if crate::session::config::profile_config::resolve_config_or_warn(&self.effective_profile())
-            .session
-            .agent_execution_as
-            .contains_key(&self.tool)
-        {
+        if config.agent_execution_as.contains_key(&self.tool) {
             return None;
         }
         let command = self.get_tool_command();
```

**File**: `src/session/instance/session_id.rs` (modified, +49/-4)
```diff
@@ -621,15 +621,29 @@ impl Instance {
     /// refuses, so the availability the API and TUI render cannot drift from
     /// the launch line.
     fn terminal_resume_static_unavailable(&self) -> Option<ResumeStaticUnavailable> {
-        let Some(agent) = self
-            .default_selector_agent()
+        // One resolve serves every check; a projection runs this per session.
+        let profile = self.effective_profile();
+        let resolved = crate::session::config::profile_config::resolve_config(&profile);
+        let fallback;
+        let config = match &resolved {
+            Ok(config) => &config.session,
+            Err(_) => {
+                fallback = crate::session::config::profile_config::resolve_config_or_warn(&profile);
+                &fallback.session
+            }
+        };
+        let native = resolved.as_ref().ok().and_then(|resolved| {
+            Self::execution_agent_for(&self.tool, self.get_tool_command(), &resolved.session).ok()
+        });
+        let Some(agent) = native
+            .or_else(|| self.legacy_default_selector_agent_in(config))
             .filter(|agent| agent.session_support.is_some())
         else {
             return Some(ResumeStaticUnavailable::Agent);
         };
-        if !self.launch_can_carry_resume_selector(agent)
+        if !self.launch_carries_selector(native, agent)
             && !self.can_attempt_default_resume(agent)
-            && self.legacy_default_selector_agent().is_none()
+            && self.legacy_default_selector_agent_in(config).is_none()
         {
             return Some(ResumeStaticUnavailable::Command);
         }
@@ -1275,6 +1289,37 @@ mod tests {
             .unwrap());
     }
 
+    #[test]
+    #[serial]
+    fn resume_availability_resolves_config_once_per_session() {
+        const PROFILE: &str = "resume-resolve-once";
+        let root = tempdir().unwrap();
+        let _app = crate::session::test_support::isolate_app_dir_at(&root.path().join("app"));
+        let profile_path =
+            crate::session::config::profile_config::get_profile_config_path(PROFILE).unwrap();
+        std::fs::create_dir_all(profile_path.parent().unwrap()).unwrap();
+        std::fs::write(
+            profile_path,
+            "[session.agent_detect_as]\nwork-claude = \"claude\"\n",
+        )
+        .unwrap();
+        let _registry = crate::tmux::status_rules::ProfileRegistryGuard::take(PROFILE);
+        // Direct launch, bare wrapper, and a tool with no session support.
+        for (tool, command) in [
+            ("claude", "claude"),
+            ("work-claude", "work-claude"),
+            ("shell", ""),
+        ] {
+            let mut inst = tool_instance(tool, root.path().to_str().unwrap());
+            inst.source_profile = PROFILE.into();
+            inst.command = command.into();
+            crate::session::config::profile_config::RESOLVES.with(|n| n.set(0));
+            inst.terminal_context_resume_cached();
+            let resolves = crate::session::config::profile_config::RESOLVES.with(|n| n.get());
+            assert_eq!(resolves, 1, "{tool} resolved config {resolves} times");
+        }
+    }
+
     #[test]
     #[serial(hook_base)]
     fn default_detect_as_wrappers_capture_published_conversations() {
```

---

### Incident Patch 3: `3c5d95f6` (2026-11-13)
**Commit Message**: feat(web): guided /setup wizard with progress from real config and a setup banner (#5399)

* feat(serve): report agent binary path and adapter install command

The setup wizard's Agents step shows where each Agent resolved and the
command that installs a missing ACP adapter, taken from the existing
install hint table so the copy stays in one place.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* feat(serve): add /api/setup for the web setup wizard

Step progress is derived from real config on each read: telemetry
answered, an installed Agent, any Project, and recognized keys present in
the global config.toml for worktrees, sandbox and notifications. Only
skips, finish, defer and banner dismissal persist, in state.toml. Agents
can't be skipped and finishing re-checks it server-side. Container
runtimes are probed in a separate request since docker info can be slow.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* feat(web): add setup client, policy and inline elevation save

Setup status and patch calls, the redirect and banner policy, and a
machine-settings save that asks for the passphrase in place and retries
the same write once. A request header keeps the global elev

**File**: `docs/guides/web/dashboard.md` (modified, +2/-2)
```diff
@@ -47,9 +47,9 @@ Individual settings appear under `Settings`: a writable toggle flips inline with
 
 ## First-run onboarding
 
-The first time you open the dashboard in a browser, a **Choose your theme** card appears before anything else. Picking a theme applies it live and saves it to your default profile; you can switch freely, then click **Continue**. Change it later in Settings > Appearance. The card is skipped in read-only mode and for anyone who already finished the tutorial.
+Opening `/` on a writable dashboard sends you to the setup wizard at `/setup` until you finish it or click **Go to dashboard**. Its steps edit the regular settings, so a step shows as done once one of its settings differs from the default, wherever it was changed (the TUI, Settings or a hand-edited `config.toml`), or once you keep its defaults with **Next**. Only the Agents step is required. Skips, finishing, leaving early and dismissing the dashboard's **Finish setting up** banner are stored as the `setup_*` keys in `state.toml` (see [Configuration Reference](../configuration.md#statetoml)). Open `/setup` again at any time. Read-only and CityHall dashboards never show it.
 
-After the theme card, an interactive walkthrough highlights the major regions (command bar, sidebar, starting a session, settings, and inside a session the diff panel and composer). Two of its steps open Settings for you: the Worktree tab, explaining the per-session path templates, and the Plugins tab, explaining how to find, install, and trust plugins. Each step lists its keyboard shortcuts and has a **Skip** button.
+Once setup is out of the way, an interactive walkthrough highlights the major regions (command bar, sidebar, starting a session, settings, and inside a session the diff panel and composer). Two of its steps open Settings for you: the Worktree tab, explaining the per-session path templates, and the Plugins tab, explaining how to find, install, and trust plugins. Each step lists its keyboard shortcuts and has a **Skip** button.
 
 Completing or skipping the tour records `app_state.has_seen_web_tour` on the server, so it does not relaunch on reload or on another device pointed at the same server. That flag persists in the server's `state.toml` (a sibling of `config.toml`, see [Configuration Reference](../configuration.md#statetoml)); the `GET /api/settings` JSON key is unchanged, still `app_state.has_seen_web_tour`. To replay it, open the overflow menu and choose **Show tutorial**; re-triggering adapts to where you are (dashboard regions, or composer / mode picker / send controls inside a session). It does not auto-launch on touch devices, where it is menu-only.
 
```

**File**: `src/server/access.rs` (modified, +2/-0)
```diff
@@ -456,6 +456,8 @@ pub(super) const CITYHALL_MUTATION_ALLOW: &[(&str, &str)] = &[
 /// Mutating routes deliberately unavailable in CityHall.
 #[cfg(test)]
 pub(super) const CITYHALL_MUTATION_DENY: &[(&str, &str)] = &[
+    // The setup wizard never shows in CityHall mode.
+    ("PATCH", "/api/setup"),
     ("POST", "/api/sandbox/image-pull"),
     ("POST", "/api/sandbox/image-dismiss"),
     ("POST", "/api/sessions/creation-trust"),
```

**File**: `src/server/api/mod.rs` (modified, +3/-0)
```diff
@@ -19,6 +19,7 @@ mod projects;
 mod queue;
 mod sandbox_image;
 pub(crate) mod sessions;
+mod setup;
 mod skills;
 pub(crate) mod system;
 mod telemetry;
@@ -75,6 +76,7 @@ pub(crate) use sessions::{
     lifecycle_rejection, persist_session_update, purge_expired_trash, reconcile_trashed_worktrees,
     reconcile_worktree_paths, trash_sweep_interval,
 };
+pub use setup::{get_setup, get_setup_runtimes, patch_setup};
 pub use skills::{
     adopt_skill, create_skill, delete_skill, edit_skill, list_skills, read_skill, sync_skills,
 };
@@ -509,6 +511,7 @@ mod tests {
             include_str!("sandbox_image.rs"),
             &["sandbox_image_pull", "sandbox_image_dismiss"],
         ),
+        ("setup.rs", include_str!("setup.rs"), &["patch_setup"]),
         (
             "system.rs",
             include_str!("system.rs"),
```

**File**: `src/server/api/setup.rs` (added, +562/-0)
```diff
@@ -0,0 +1,562 @@
+//! Web setup wizard state. Step progress is derived from real configuration on
+//! every read; `state.toml` only records which steps were skipped or confirmed
+//! and whether the wizard was finished, deferred, or its banner dismissed.
+
+use std::sync::Arc;
+
+use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
+use serde::{Deserialize, Serialize};
+
+use super::{api_error, AppState};
+use crate::session::config::AppStateConfig;
+
+/// The closed step catalog, in wizard order: `(key, required)`.
+const STEPS: [(&str, bool); 6] = [
+    ("theme_telemetry", false),
+    ("agents", true),
+    ("project", false),
+    ("worktrees", false),
+    ("sandbox", false),
+    ("notifications", false),
+];
+
+/// Global `config.toml` keys that configure a step. Every config write saves
+/// the whole file, so a step counts as configured only when one of these
+/// differs from its default; keeping a default is recorded by confirming it.
+const CONFIG_KEYS: [(&str, &str, &[&str]); 3] = [
+    (
+        "worktrees",
+        "worktree",
+        &[
+            "enabled",
+            "path_template",
+            "default_base_branch",
+            "auto_cleanup",
+        ],
+    ),
+    (
+        "sandbox",
+        "sandbox",
+        &["enabled_by_default", "container_runtime", "default_image"],
+    ),
+    (
+        "notifications",
+        "web",
+        &[
+            "notifications_enabled",
+            "notify_on_waiting",
+            "notify_on_idle",
+            "notify_on_error",
+        ],
+    ),
+];
+
+#[derive(Debug, Default)]
+struct SetupInputs {
+    telemetry_answered: bool,
+    agent_installed: bool,
+    project_exists: bool,
+    config: toml::Table,
+    defaults: toml::Table,
+}
+
+fn step_configured(key: &str, inputs: &SetupInputs) -> bool {
+    match key {
+        "theme_telemetry" => inputs.telemetry_answered,
+        "agents" => inputs.agent_installed,
+        "project" => inputs.project_exists,
+        _ => CONFIG_KEYS
+            .iter()
+            .find(|(step, _, _)| *step == key)
+            .is_some_and(|(_, section, keys)| {
+                let table =
+                    |t: &toml::Table| t.get(*section).and_then(toml::Value::as_table).cloned();
+                let (set, defaults) = (table(&inputs.config), table(&inputs.defaults));
+                set.is_some_and(|set| {
+                    keys.iter().any(|k| {
+                        set.get(*k)
+                            .is_some_and(|v| defaults.as_ref().and_then(|d| d.get(*k)) != Some(v))
+                    })
+                })
+            }),
+    }
+}
+
+#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
+pub struct SetupStep {
+    pub key: String,
+    pub required: bool,
+    /// Set up, from config or by keeping the defaults in the wizard.
+    pub configured: bool,
+    /// The user kept this optional step's defaults in the wizard.
+    pub confirmed: bool,
+    pub skipped: bool,
+}
+
+#[derive(Debug, Serialize, Deserialize)]
+pub struct SetupAccess {
+    pub serve_mode: String,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub tunnel_url: Option<String>,
+}
+
+#[derive(Debug, Serialize, Deserialize)]
+pub struct SetupStatus {
+    pub finished: bool,
+    pub deferred: bool,
+    pub banner_dismissed: bool,
+    pub steps: Vec<SetupStep>,
+    pub tmux: bool,
+    pub git: bool,
+    pub access: SetupAccess,
+}
+
+fn build_steps(inputs: &SetupInputs, app: &AppStateConfig) -> Vec<SetupStep> {
+    let skipped = known_steps(&app.setup_skipped_steps);
+    let confirmed = known_steps(&app.setup_confirmed_steps);
+    STEPS
+        .iter()
+        .map(|(key, required)| {
+            // A required step is only ever done by being configured.
+            let confirmed = !required && confirmed.contains(key);
+            SetupStep {
+                key: key.to_string(),
+                required: *required,
+                configured: confirmed || step_configured(key, inputs),
+                confirmed,
+                skipped: skipped.contains(key),
+            }
+        })
+        .collect()
+}
+
+/// Stored skip keys a newer or older build no longer knows are dropped.
+fn known_steps(stored: &[String]) -> Vec<&'static str> {
+    STEPS
+        .iter()
+        .filter(|(key, _)| stored.iter().any(|s| s == key))
+        .map(|(key, _)| *key)
+        .collect()
+}
+
+/// Validate a client-sent optional step key.
+fn optional_step(key: &str) -> Result<String, String> {
+    match STEPS.iter().find(|(step, _)| *step == key) {
+        None => Err(format!("unknown setup step '{key}'")),
+        Some((_, true)) => Err(format!("setup step '{key}' is required")),
+        Some(_) => Ok(key.to_string()),
+    }
+}
+
+/// The first required step that isn't set up, which blocks finishing.
+fn open_required_step(inputs: &SetupInputs) -> Option<&'static str> {
+    STEPS
+        .iter()
+        .find(|(key, required)| *r
```

**File**: `src/server/api/system.rs` (modified, +53/-0)
```diff
@@ -134,6 +134,19 @@ pub struct AgentInfo {
     /// deprecated badge in the wizard picker and switch-agent modal.
     #[serde(skip_serializing_if = "crate::agents::AgentLifecycle::is_active")]
     pub lifecycle: crate::agents::AgentLifecycle,
+    /// Resolved binary on the daemon's PATH, for installed built-in agents.
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub path: Option<String>,
+    /// Command that installs the ACP adapter, when it is missing and known.
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub acp_install_command: Option<String>,
+}
+
+/// The install command for an ACP adapter, keyed on its binary name since the
+/// registry command may be a data-dir path (`aoe-agent`).
+fn adapter_install_command(acp_command: Option<&str>) -> Option<String> {
+    let binary = std::path::Path::new(acp_command?).file_name()?.to_str()?;
+    crate::acp::install_hints::install_hint_for(binary).map(str::to_string)
 }
 
 /// Resolve the acp launch command + args for a built-in agent from
@@ -209,6 +222,8 @@ fn build_custom_agent_infos(
                 // serialized here; they can hold hostnames or secrets.
                 acp_command: None,
                 acp_args: Vec::new(),
+                path: None,
+                acp_install_command: None,
             }
         })
         .collect();
@@ -305,6 +320,8 @@ pub async fn list_agents(
                     acp_allowed: policy.allows(a.name),
                     acp_command,
                     acp_args,
+                    path: None,
+                    acp_install_command: None,
                 }
             })
             .collect::<Vec<_>>();
@@ -346,6 +363,8 @@ pub async fn list_agents(
                 acp_command: None,
                 acp_args: Vec::new(),
                 lifecycle: crate::agents::AgentLifecycle::Active,
+                path: None,
+                acp_install_command: None,
             });
         }
         agents.extend(build_custom_agent_infos(
@@ -376,6 +395,10 @@ pub async fn list_agents(
             if agent.acp_capable {
                 agent.acp_installed =
                     adapter_installed(&agent.name, &config, &host_environment, &|| false);
+                if !agent.acp_installed {
+                    agent.acp_install_command =
+                        adapter_install_command(agent.acp_command.as_deref());
+                }
             }
             // Every row, since the repository may give a profile-terminal agent an ACP base.
             agent.acp_create_ready = adapter_installed(
@@ -385,6 +408,14 @@ pub async fn list_agents(
                 &hooks_apply,
             );
         }
+        for agent in agents
+            .iter_mut()
+            .filter(|a| a.kind == "builtin" && a.installed)
+        {
+            agent.path = which::which(&agent.binary)
+                .ok()
+                .map(|p| p.display().to_string());
+        }
         agents
     })
     .await
@@ -3748,6 +3779,28 @@ mod tests {
         }
     }
 
+    #[test]
+    fn adapter_install_command_resolves_by_binary_name() {
+        for (command, expected) in [
+            (
+                Some("codex-acp"),
+                Some("npm install -g @agentclientprotocol/codex-acp@latest"),
+            ),
+            (
+                Some("/data/aoe/bin/aoe-agent"),
+                Some("aoe acp doctor --fix --adapter aoe-agent"),
+            ),
+            (Some("unknown-acp"), None),
+            (None, None),
+        ] {
+            assert_eq!(
+                adapter_install_command(command).as_deref(),
+                expected,
+                "{command:?}"
+            );
+        }
+    }
+
     /// The wizard names the runtime that isn't running, so it's reported
     /// whether or not it's available.
     #[tokio::test]
```

**File**: `src/server/auth.rs` (modified, +5/-0)
```diff
@@ -143,6 +143,9 @@ fn is_machine_endpoint(path: &str) -> bool {
 fn is_login_session_exempt(path: &str) -> bool {
     path == "/"
         || path == "/login"
+        // Page shell only: /api/setup stays session-gated, and
+        // patch_setup checks read_only and CityHall itself.
+        || path == "/setup"
         || path.starts_with("/session/")
         || path.starts_with("/plugins/")
         || path == "/api/login"
@@ -1083,6 +1086,7 @@ mod tests {
         let exempt = [
             "/",
             "/login",
+            "/setup",
             "/session/abc",
             "/session/2626c6af68754732",
             "/plugins/github/prs",
@@ -1211,6 +1215,7 @@ mod tests {
             // Cosmetic UI state and the update banner grant no capability; the
             // handlers still enforce read_only.
             (Method::POST, "/api/app-state/web-tour-seen"),
+            (Method::PATCH, "/api/setup"),
             (Method::POST, "/api/app-state/dismiss-update"),
             (Method::PATCH, "/api/app-state/web-ui-state"),
             // Read-only GETs, even on settings and profile paths.
```

**File**: `src/server/router.rs` (modified, +2/-0)
```diff
@@ -337,6 +337,8 @@ pub(super) fn build_router(state: Arc<AppState>) -> Router {
             "/api/app-state/web-tour-seen",
             post(api::mark_web_tour_seen),
         )
+        .route("/api/setup", get(api::get_setup).patch(api::patch_setup))
+        .route("/api/setup/runtimes", get(api::get_setup_runtimes))
         .route("/api/app-state/dismiss-update", post(api::dismiss_update))
         .route(
             "/api/app-state/web-ui-state",
```

**File**: `src/session/config/mod.rs` (modified, +16/-0)
```diff
@@ -1062,6 +1062,22 @@ pub struct AppStateConfig {
     #[serde(default)]
     pub used_system_health: bool,
 
+    /// Web setup wizard steps the user chose to skip. See `GET /api/setup`.
+    #[serde(default, skip_serializing_if = "Vec::is_empty")]
+    pub setup_skipped_steps: Vec<String>,
+    /// Optional web setup steps whose defaults the user kept.
+    #[serde(default, skip_serializing_if = "Vec::is_empty")]
+    pub setup_confirmed_steps: Vec<String>,
+    /// The user finished the web setup wizard.
+    #[serde(default)]
+    pub setup_finished: bool,
+    /// The user left the wizard for the dashboard, so `/` stops redirecting.
+    #[serde(default)]
+    pub setup_deferred: bool,
+    /// The user closed the dashboard's "Finish setting up" banner.
+    #[serde(default)]
+    pub setup_banner_dismissed: bool,
+
     /// Server-side mirror of the web dashboard's syncable UI state, keyed by
     /// the frontend's localStorage key (the value is the opaque string the
     /// browser stored). Single-tenant: there is one user, so these prefs
```

#### Recent Merged Pull Requests:
- **PR #5684** (2026-11-14): fix(acp): keep owner stop that lands before failover locks (@cwrau)
- **PR #5672** (2026-11-13): feat(web): show Retry's progress as the startup line, and a plain empty state while the Agent isn't running (@klubrake)
- **PR #5670** (closed): test(acp): record shim calls synchronously so order matches arrival (@Seluj78)
- **PR #5667** (2026-11-13): fix(process): treat a zombie runner as not live (@klubrake)
- **PR #5666** (2026-11-13): feat(acp): report a sandbox container removed mid-run as a typed startup cause (@klubrake)
- **PR #5664** (2026-11-13): feat(plugins): pin plugin-linear 0.1.0 in featured.toml (@athal7)

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

## X. tui): flash deletion cleanup notes instead of a blocking dialog

**RULE**:
When implementing operations in `src/tui/app.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5b6d208f`: tui): flash deletion cleanup notes instead of a blocking dialog. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/tui/app.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                    // Keys reach the view before the next draw, so no dialog is promoted here.
                    self.home.apply_session_feed_before_input();
        self.home.apply_session_feed_before_input();
        self.home.apply_session_feed_before_input();
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                    self.home.apply_session_feed();
        self.home.apply_session_feed();
        self.home.apply_session_feed();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5b6d208f` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
