# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: agent-of-empires-agent-of-empires-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires-agent-of-empires-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T19:05:01.071Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-agent-of-empires-agent-of-empires-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires-agent-of-empires-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T19:05:01.071Z`  
> **Learning ID**: `LEARN-EVO-agent-of-empires-agent-of-empires-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence), E (Creative Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from agent-of-empires-agent-of-empires-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `3bfd7c01`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T19:04:50.859Z  
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
> **Harvest Timestamp**: 2026-11-17T19:04:50.851Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4644 stars

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
- **Issue #5817** (2026-11-17): **ci: Supply Chain fails on main and every PR after two new RustSec advisories**
  *Symptoms*: ## What happens  The `Supply Chain` job (cargo-deny in `.github/workflows/ci.yml`) has failed on every run since about 10:45 UTC on 2026-11-17, on main as well as on PRs. Main's last green run was on `61894f099`, and the run on `558d95353` failed. No lockfile changed in between. The failures come from two advisories published since then:  1. **RUSTSEC-2026-0544** (vulnerability): heap buffer overflow in zlib's `gz_vacate()`, reached through `libz-sys 1.1.31`, which `libgit2-sys 0.18.8+1.9.7` pulls in via `git2`. The advisory's fix is `libz-sys >= 1.1.33`, published on crates.io on 2026-11-10. Note that 1.1.32 is not enough. 2. **RUSTSEC-2026-0543** (unmaintained): `chrono` is marked unmaintained for all versions, with "No safe upgrade is available". `chrono` is a direct dependency (`Cargo.toml`, with `serde`, plus `schemars`'s `chrono04` feature) used across about 190 Rust files.  `deny.toml` has `ignore = []` under `[advisories]`, so both are errors.  Example failing run: https://github.com/agent-of-empires/agent-of-empires/actions/runs/44067734648  ## Suggested fix  - **libz-sys:** run `cargo update -p libz-sys` to move the lockfile to 1.1.33. This is a lockfile-only change; `libgit2-sys` takes any compatible `libz-sys` 1.x. Not yet tried locally. - **chrono:** there's no upgrade to take. One way to unblock CI is to add `RUSTSEC-2026-0543` to `[advisories].ignore` with a reason, and decide separately whether to migrate off `chrono` (for example to `jiff` or `time`). Given h

- **Issue #5765** (2026-11-17): **Web dashboard: Workflow card shows as "other tool call" and stays bare until launch**
  *Symptoms*: **Note:** Claude handled the investigation and prose via back-and-forth. Idea, decisions, and everything else are mine. — @Seluj78  ## Problem  Claude `Workflow` runs show up badly in the web structured view, in two ways.  1. After launch, the call can render as a generic `OTHER tool call` card (Input `{"_aoe_title":"tool call",...,"_aoe_raw_tool_name":"Workflow"}`, Output "Workflow launched in background...") instead of the workflow card with run name, phases and agent counts. 2. Before launch, the card is a bare `workflow` label for 1.5 to 2.5 minutes with no name, summary or agents. The Background pane fills in only once the run starts, which looks like the workflow UI is broken even though events are in the log.  ## Evidence from the affected sessions  Session `d1380576508e4178`, timestamps from `acp_events.created_at`:  ``` 599|ToolCallStarted  name=Workflow   17:32:09 600|ToolCallUpdated  (script)        17:34:25 603|BackgroundTaskStarted perf-audit 17:34:26 605|BackgroundAgentLaunched find:session-instance ... ```  The adapter emits nothing between seq 599 and 600 while the model generates the script (137s here). Session `5503377fd5bf4581` is the same shape: `ToolCallStarted` at seq 1011 (17:33:26), `BackgroundTaskStarted` at seq 1015 (about 17:34:55). Daemon, DB and reducer are fine; every launch event is recorded.  ## Root cause  Defect 1, name clobbered:  - `src/acp/acp_client/permission_handlers.rs:166` falls back to the title `"tool call"` when a permission reques

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

### Incident Patch 1: `c07429c3` (2026-11-16)
**Commit Message**: fix(plugin): avoid blocking runtime on asset downloads (#5732)

* fix(plugin): avoid blocking runtime on asset downloads

* fix(plugin): retain staging across download cancellation

* fix(plugin): drain asset writes after download failure

* fix(plugin): preserve download task panic boundary

**File**: `src/plugin/fetch.rs` (modified, +89/-10)
```diff
@@ -89,12 +89,23 @@ pub(super) async fn fetch(
             Some(RuntimeSpec::ReleaseBinary { .. })
         )
     {
-        download_release_binary(fetched, operation).await
+        // Keep staging and the lease until asynchronous file operations finish.
+        await_asset_download(tokio::spawn(download_release_binary(fetched, operation))).await
     } else {
         Ok(fetched)
     }
 }
 
+async fn await_asset_download(
+    task: tokio::task::JoinHandle<Result<FetchedPlugin>>,
+) -> Result<FetchedPlugin> {
+    match task.await {
+        Ok(result) => result,
+        Err(error) if error.is_panic() => std::panic::resume_unwind(error.into_panic()),
+        Err(error) => Err(error).context("plugin asset download task failed"),
+    }
+}
+
 fn stage(
     source: PluginSource,
     plugins_root: PathBuf,
@@ -584,7 +595,7 @@ pub(super) fn render_asset_template<'a>(
 }
 
 async fn download_asset(url: &str, dest: &Path) -> Result<()> {
-    use std::io::Write;
+    use tokio::io::AsyncWriteExt;
     let client = reqwest::Client::builder()
         .user_agent(DEFAULT_USER_AGENT)
         .timeout(Duration::from_secs(300))
@@ -594,14 +605,24 @@ async fn download_asset(url: &str, dest: &Path) -> Result<()> {
     if !status.is_success() {
         bail!("downloading {url} failed: HTTP {status}");
     }
-    let mut file =
-        std::fs::File::create(dest).with_context(|| format!("creating {}", dest.display()))?;
-    while let Some(chunk) = response.chunk().await? {
-        file.write_all(&chunk)
-            .with_context(|| format!("writing {url} to {}", dest.display()))?;
+    let mut file = tokio::fs::File::create(dest)
+        .await
+        .with_context(|| format!("creating {}", dest.display()))?;
+    let result: Result<()> = async {
+        while let Some(chunk) = response.chunk().await? {
+            file.write_all(&chunk)
+                .await
+                .with_context(|| format!("writing {url} to {}", dest.display()))?;
+        }
+        Ok(())
     }
-    file.flush()
-        .with_context(|| format!("writing {url} to {}", dest.display()))
+    .await;
+    let flush = file
+        .flush()
+        .await
+        .with_context(|| format!("writing {url} to {}", dest.display()));
+    result?;
+    flush
 }
 
 fn sha256_file(path: &Path) -> Result<String> {
@@ -798,6 +819,18 @@ fn ensure_executable(tree: &Path, rel: &Path) -> Result<()> {
 mod tests {
     use super::*;
 
+    #[tokio::test]
+    async fn asset_task_panics_reach_the_job_panic_boundary() {
+        use futures_util::FutureExt;
+
+        let task: tokio::task::JoinHandle<Result<FetchedPlugin>> =
+            tokio::spawn(async { panic!("private-panic-payload") });
+        let panic = std::panic::AssertUnwindSafe(await_asset_download(task))
+            .catch_unwind()
+            .await;
+        assert!(panic.is_err());
+    }
+
     #[test]
     fn parse_ls_remote_prefers_the_peeled_tag_and_a_pinned_sha_skips_the_remote() {
         let peeled = "1111111111111111111111111111111111111111\trefs/tags/v1\n\
@@ -1018,6 +1051,13 @@ mod tests {
         run_git(&repo, &["tag", "v1"]);
         let bytes = Arc::new(Mutex::new(b"#!/bin/sh\nexit 0\n".to_vec()));
         let download = bytes.clone();
+        let pause = Arc::new(Mutex::new(
+            None::<(
+                tokio::sync::oneshot::Sender<()>,
+                tokio::sync::oneshot::Receiver<()>,
+            )>,
+        ));
+        let pause_download = pause.clone();
         let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
         let base = format!("http://{}", listener.local_addr().unwrap());
         let release_base = base.clone();
@@ -1029,7 +1069,14 @@ mod tests {
             }))
             .route("/asset", axum::routing::get(move || {
                 let download = download.clone();
-                async move { download.lock().unwrap().clone() }
+                let pause = pause_download.lock().unwrap().take();
+                async move {
+                    if let Some((entered, release)) = pause {
+                        let _ = entered.send(());
+                        let _ = release.await;
+                    }
+                    download.lock().unwrap().clone()
+                }
             }));
         let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
         let _env = EnvGuard::set(&[
@@ -1041,6 +1088,38 @@ mod tests {
         ]);
         let source = PluginSource::parse("gh:acme/bin@v1").unwrap();
         let plugins = crate::plugin::plugins_dir().unwrap();
+        let (entered, waiting) = tokio::sync::oneshot::channel();
+        let (release, released) = tokio::sync::oneshot::channel();
+        *pause.lock().unwrap() = Some((entered, released));
+        let operation = crate::plugin::install::begin_operation().unwrap();
+        let staged_source = source.clone();
+        let task = tokio::spawn(async move { fetch(&staged_source, Som
```

---

### Incident Patch 2: `558d9535` (2026-11-17)
**Commit Message**: fix(send): pace the enter from a plugin's declaration (#5724)

* fix(send): pace the enter from a plugin's declaration

An agent whose composer reads a fast burst as a paste drops the Enter, so the
host types the message and never submits it, leaving a draft that looks like a
running session. A declared plugin agent could not state a pause at all, and
every send path resolved the delay from the built-in table, which does not know
declared agents, so such an agent was paced at 0 ms.

`launch.send_keys_enter_delay_ms` lets an integration declare the pause, gated
at api_version 22 and capped at 2000 ms. The resolver, send_keys_enter_delay,
now asks the active declaration first and falls back to the built-in table, so
the five send paths and the post-restart wake-up inherit it without each one
holding a registry of its own.

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <[REDACTED_EMAIL]>

* fix(send): pace only the program a declaration owns

A declared enter delay resolved by tool name alone, so a custom wrapper, a
command override or another stored command inherited a plugin's pause. Resolve
it through the session's effective declaration instead, keeping the built-in
table as 

**File**: `aoe-plugin-api/src/agent_integration.rs` (modified, +4/-0)
```diff
@@ -75,6 +75,10 @@ pub struct AgentLaunchDeclaration {
     pub install_hint: Option<String>,
     #[serde(default)]
     pub host_only: bool,
+    /// Pause between typing a message into the agent's pane and sending Enter,
+    /// for an agent whose composer reads a fast burst as a paste and drops it.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub send_keys_enter_delay_ms: Option<u64>,
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub resume: Option<AgentResumeDeclaration>,
     #[serde(default, skip_serializing_if = "Option::is_none")]
```

**File**: `aoe-plugin-api/src/manifest.rs` (modified, +18/-0)
```diff
@@ -1300,6 +1300,24 @@ impl PluginManifest {
                 self.api_version >= 22 || integration.session_id.is_none(),
                 format!("agent_integrations[{i}].session_id requires api_version >= 22"),
             );
+            if let Some(delay) = integration
+                .launch
+                .as_ref()
+                .and_then(|launch| launch.send_keys_enter_delay_ms)
+            {
+                check(
+                    self.api_version >= 22,
+                    format!(
+                        "agent_integrations[{i}].launch.send_keys_enter_delay_ms requires api_version >= 22"
+                    ),
+                );
+                check(
+                    delay <= 2_000,
+                    format!(
+                        "agent_integrations[{i}].launch.send_keys_enter_delay_ms must be at most 2000"
+                    ),
+                );
+            }
             check(
                 if status_integration {
                     !integration.provider_versions.is_empty()
```

**File**: `aoe-plugin-api/tests/manifest.rs` (modified, +43/-0)
```diff
@@ -432,6 +432,49 @@ fn runtime_requires_worker_capability() {
     parse(2, "capabilities = [\"runtime.worker\"]\n");
 }
 
+#[test]
+fn send_keys_enter_delay_requires_api_22_and_caps_at_two_seconds() {
+    let declaration = "[[agent_integrations]]\ntool = \"example\"\ncommand = \"example\"\n\
+                       [agent_integrations.launch]\n\
+                       send_keys_enter_delay_ms = 150\n";
+
+    let parsed = parse(22, declaration);
+    assert_eq!(
+        parsed.agent_integrations[0]
+            .launch
+            .as_ref()
+            .and_then(|launch| launch.send_keys_enter_delay_ms),
+        Some(150)
+    );
+    assert_eq!(
+        PluginManifest::from_toml_str(&toml::to_string(&parsed).unwrap())
+            .expect("round-trips")
+            .agent_integrations[0]
+            .launch
+            .as_ref()
+            .and_then(|launch| launch.send_keys_enter_delay_ms),
+        Some(150)
+    );
+
+    let errors = invalid(21, declaration);
+    assert!(
+        errors
+            .iter()
+            .any(|error| error.contains("send_keys_enter_delay_ms requires api_version >= 22")),
+        "{errors:?}"
+    );
+
+    let errors = invalid(22, &declaration.replace("150", "2001"));
+    assert!(
+        errors
+            .iter()
+            .any(|error| error.contains("send_keys_enter_delay_ms must be at most 2000")),
+        "{errors:?}"
+    );
+
+    parse(22, &declaration.replace("150", "2000"));
+}
+
 #[test]
 fn session_id_capture_requires_api_22_and_a_worker_runtime() {
     let runtime = "capabilities = [\"runtime.worker\"]\n\
```

**File**: `docs/plugin-api.md` (modified, +2/-0)
```diff
@@ -93,6 +93,7 @@ instruction_flag = "--prompt={}"
 model_flag = "--model"
 host_only = false
 install_hint = "Install example-agent from its vendor"
+send_keys_enter_delay_ms = 150
 
 [agent_integrations.launch.container_env]
 EXAMPLE_HOME = "/state"
@@ -121,6 +122,7 @@ deny = [{ kind = "literal", value = "n" }]
 The example's `detection` requires `session.integration` in the manifest's capabilities. Every declaration type, `session_id` included, requires a nonblank `command`: the plugin must contribute the tool it captures for, because only the plugin that owns a tool may attribute an id to a session using it.
 
 - `launch.aliases` are unique lowercase agent ids, distinct from the tool. `oneshot_flag` and `model_flag` are single shell-safe flags. `instruction_flag` has one `{}` placeholder, as a whole argument or after `=`, and otherwise contains shell-safe words.
+- `launch.send_keys_enter_delay_ms` is the pause, in milliseconds, that the host leaves between typing a message into the agent's pane and sending Enter. Some agents read a fast burst as a paste and drop the Enter, which leaves the message as an unsent draft that looks like a running session. It requires `api_version >= 22` and is capped at 2000. An agent that declares nothing falls back to the host's built-in pause for its tool.
 - `launch.yolo` is `kind = "flag"` with `flag`, `kind = "always"`, or `kind = "env"` with `key` and `value`. An `always` declaration applies while active without changing the session's saved Yolo preference. `container_env` is applied to sandbox launches. Protected environment names are rejected.
 - `launch.resume` is `kind = "flag"` with `flag`, `kind = "flag_pair"` with `existing` and `new_session`, or `kind = "subcommand"` with `command`. Resume and capture require each other. Capture supports only backend `omp`, with `pane_scoped` in at least one of `host` or `sandbox` and `pane_scoped` or `unsupported` in the other.
 - `detection.mode = "native_only"` requires `session.integration`; the integration owns status rather than falling back to pane parsing when a report is missing or invalid.
```

**File**: `src/agents.rs` (modified, +4/-0)
```diff
@@ -1731,6 +1731,10 @@ fn is_safe_agent_name(name: &str) -> bool {
         && !name.contains('\\')
 }
 
+/// The built-in pause for `tool` between typing and Enter.
+///
+/// A declared integration paces through `Instance::send_keys_enter_delay`,
+/// which keeps this table as the fallback for every program it does not own.
 pub fn send_keys_enter_delay(tool: &str) -> u64 {
     get_agent(tool)
         .map(|a| a.send_keys_enter_delay_ms)
```

**File**: `src/cli/session.rs` (modified, +1/-1)
```diff
@@ -1402,7 +1402,7 @@ fn send_restart_wake(
         return Ok(false);
     }
     let _input_lock = working.lock_for_input()?;
-    let delay = crate::agents::send_keys_enter_delay(&working.tool);
+    let delay = working.send_keys_enter_delay();
     tmux_session.send_keys_with_delay(wake_msg, delay)?;
     Ok(true)
 }
```

**File**: `src/plugin/agent_definition.rs` (modified, +1/-1)
```diff
@@ -132,7 +132,7 @@ impl<'a> DefinitionData<'a> {
             session_support: support,
             fork_strategy: ForkStrategy::Unsupported,
             host_only: launch.host_only,
-            send_keys_enter_delay_ms: 0,
+            send_keys_enter_delay_ms: launch.send_keys_enter_delay_ms.unwrap_or(0),
             ready_marker: None,
             install_hint: launch.install_hint.as_deref().unwrap_or(&entry.tool),
             permission_response: entry.reply_fallback.as_ref().map(|_| PermissionResponse {
```

**File**: `src/plugin/agent_integration.rs` (modified, +118/-3)
```diff
@@ -402,6 +402,9 @@ pub fn consent_lines(integration: &AgentIntegrationContribution) -> Vec<String>
         if !flags.is_empty() {
             lines.push(format!("  launch flags: {}", flags.join("; ")));
         }
+        if let Some(delay) = launch.send_keys_enter_delay_ms {
+            lines.push(format!("  enter delay: {delay} ms"));
+        }
         if !launch.aliases.is_empty() {
             lines.push(format!(
                 "  aliases: {}",
@@ -1386,8 +1389,6 @@ oneshot_flag = "-p"
     }
 
     fn install_test_integration(plugin_id: &str, tool: &str) {
-        use crate::session::{CapabilityGrant, PluginConfig};
-
         let manifest = format!(
             r#"
 id = "{plugin_id}"
@@ -1403,9 +1404,42 @@ provider_versions = ["^18"]
 replies = true
 "#
         );
+        install_test_manifest(plugin_id, &manifest);
+    }
+
+    /// A status integration that also declares an Enter delay, so the pace
+    /// resolves through the same declaration as its other launch fields.
+    ///
+    /// Pair it with a tool name no built-in alias matches: `agent` is a cursor
+    /// alias, so a name containing it resolves as a built-in and keeps the table.
+    fn install_paced_test_integration(plugin_id: &str, tool: &str, delay_ms: u64) {
+        let manifest = format!(
+            r#"
+id = "{plugin_id}"
+name = "Integration test"
+version = "1.0.0"
+api_version = 22
+capabilities = ["session.integration"]
+
+[[agent_integrations]]
+tool = "{tool}"
+command = "{tool}"
+provider_versions = ["^18"]
+replies = true
+
+[agent_integrations.launch]
+send_keys_enter_delay_ms = {delay_ms}
+"#
+        );
+        install_test_manifest(plugin_id, &manifest);
+    }
+
+    fn install_test_manifest(plugin_id: &str, manifest: &str) {
+        use crate::session::{CapabilityGrant, PluginConfig};
+
         let dir = super::super::plugins_dir().unwrap().join(plugin_id);
         std::fs::create_dir_all(&dir).unwrap();
-        std::fs::write(dir.join("aoe-plugin.toml"), &manifest).unwrap();
+        std::fs::write(dir.join("aoe-plugin.toml"), manifest).unwrap();
         crate::session::update_config(|config| {
             config.plugins.insert(
                 plugin_id.to_string(),
@@ -2004,6 +2038,64 @@ sandbox = "unsupported"
         assert!(instance().declared_agent().is_none());
     }
 
+    /// The declared pause belongs to the program the declaration owns, so a
+    /// custom wrapper, an override or another stored command keeps the built-in
+    /// table's pace for its tool instead of inheriting that delay.
+    #[test]
+    #[serial_test::serial]
+    fn a_declared_enter_delay_paces_only_the_program_it_declares() {
+        let temp = tempfile::tempdir().unwrap();
+        let _reload = super::super::ReloadRegistryOnDrop;
+        let _env = crate::session::test_support::EnvGuard::set(&[
+            ("HOME", temp.path()),
+            ("XDG_CONFIG_HOME", temp.path()),
+            ("USERPROFILE", temp.path()),
+        ]);
+        let _featured = crate::session::test_support::EnvGuard::unset(&["AOE_FEATURED_INDEX_PATH"]);
+        install_paced_test_integration("acme.paced-provider", "pacer-helper", 150);
+        super::super::reload_registry();
+
+        let instance = |tool: &str, command: &str| {
+            let mut instance = Instance::new("paced-delay", temp.path().to_str().unwrap());
+            instance.tool = tool.into();
+            instance.command = command.into();
+            instance
+        };
+
+        // The declared program takes the declared pause.
+        assert_eq!(instance("pacer-helper", "").send_keys_enter_delay(), 150);
+
+        // A stored command that is not the declared one is another program.
+        assert_eq!(
+            instance("pacer-helper", "/opt/other/paced --serve").send_keys_enter_delay(),
+            0
+        );
+
+        // A command override replaces the declared program.
+        crate::session::update_config(|config| {
+            config
+                .session
+                .agent_command_override
+                .insert("pacer-helper".into(), "/opt/override/paced --serve".into());
+        })
+        .unwrap();
+        assert_eq!(instance("pacer-helper", "").send_keys_enter_delay(), 0);
+
+        // So does a custom agent of the same name.
+        crate::session::update_config(|config| {
+            config.session.agent_command_override.remove("pacer-helper");
+            config
+                .session
+                .custom_agents
+                .insert("pacer-helper".into(), "/opt/custom/paced --serve".into());
+        })
+        .unwrap();
+        assert_eq!(instance("pacer-helper", "").send_keys_enter_delay(), 0);
+
+        // A built-in keeps the table's pace and gains nothing from the plugin.
+        assert_eq!(instance("codex", "").send_keys_enter_delay(), 150);
+    }
+
     /// Two approved providers make the own-name claim ambiguous. A readable
     /// custom selection still owns its program, so
```

---

### Incident Patch 3: `1912a317` (2026-11-16)
**Commit Message**: fix(server): load plugin icons under passphrase auth (#5735)

* fix(server): serve plugin icons from a login-exempt path

Under --auth passphrase every plugin icon <img> was rejected with a 401
and a warn line: an image load carries the session cookie but cannot
send the device binding header, and /api/plugins/{id}/icon is a gated
machine endpoint. Serve the icon at /plugin-icons/{id} and exempt that
prefix from the login session check, like the other static assets.
The token gate and the CityHall block still apply.

A separate prefix avoids colliding with a plugin page whose id is
"icon" under /plugins/{id}/{page_id}.

Fixes #5095

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(server): keep plugin icons behind the token gate

Review follow-up. The token gate lets anonymous requests through to any
path that is not a machine endpoint, so /plugin-icons/{id} was public in
token mode too. Class it as a machine endpoint so a missing token gets a
401 again. It stays login-exempt, so under passphrase-only auth it is
public, as the issue proposed; the test now pins both cases.

Also point the handler doc at the new path and proxy /plugin-icons in
the Vite dev server.

Co-Author

**File**: `docs/guides/web-dashboard.md` (modified, +1/-0)
```diff
@@ -234,6 +234,7 @@ native clients on the owner-verified Unix API retain the local-owner exemption.
 
 - **Token auth** (`--auth=token`, default): a random 256-bit token, generated on startup and stored at `~/.config/agent-of-empires/serve.token` (Linux) or `~/.agent-of-empires/serve.token` (macOS). Passed via URL on first visit, then kept as an `HttpOnly; SameSite=Strict` cookie.
 - **Passphrase wall** (`--auth=passphrase`, or combined with token via `--passphrase`): an argon2-hashed passphrase gates `/login`. Sessions bind to a per-device secret in `localStorage`, so a leaked cookie alone is insufficient.
+- **Plugin icons**: with a passphrase configured, `/plugin-icons/{id}` needs a live login session but not its device binding, because an `<img>` load cannot send that header. Callers without a session get `401`. With token auth alone, the token is required as on any route.
 - **Plaintext refusal**: plain HTTP from a non-loopback peer gets `426` before authentication, so tokens and passphrases never cross a network in the clear. A TLS proxy or tunnel in front of a loopback bind is unaffected. A direct bind to a LAN or tailnet IP needs `--dangerously-allow-plaintext-remote` (per bind, logged at every start). Native clients likewise refuse to send a token or passphrase to a plaintext non-loopback endpoint.
 - **Rate limiting**: 5 failed logins from an IP trigger a 15-minute lockout.
 - **Token rotation**: in `--remote` mode the token rotates every 4 hours with a 5-minute grace period for active sessions.
```

**File**: `src/plugin/view.rs` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ impl LoadedPlugin {
             description: self.manifest.description.clone(),
             icon: self.manifest.icon.clone(),
             icon_asset_url: (self.manifest.icon_asset.is_some() && self.dir.is_some())
-                .then(|| format!("/api/plugins/{}/icon", self.id())),
+                .then(|| format!("/plugin-icons/{}", self.id())),
             enabled: self.enabled,
             builtin: self.builtin(),
             validation: self.validation.as_str().to_string(),
```

**File**: `src/server/api/plugins.rs` (modified, +57/-1)
```diff
@@ -143,7 +143,7 @@ fn content_type_for_icon(path: &std::path::Path) -> Option<&'static str> {
     }
 }
 
-/// `GET /api/plugins/{id}/icon`: stream an installed plugin's `icon_asset`
+/// `GET /plugin-icons/{id}`: stream an installed plugin's `icon_asset`
 /// from its install directory. Mirrors `serve_sound_file`'s allowlist-then-read
 /// shape: the manifest path is re-validated and re-joined against the
 /// plugin's own directory rather than trusted from a cached URL. A builtin
@@ -2538,6 +2538,62 @@ id = "voice"
         );
     }
 
+    /// Under passphrase-only auth an `<img>` load of an installed icon needs a live session
+    /// but not its device binding.
+    #[tokio::test]
+    #[serial_test::serial]
+    async fn an_installed_icon_loads_on_an_unbound_session_under_passphrase_auth() {
+        use tower::ServiceExt;
+        let _app_dir = AppDirEnvGuard::new();
+        let dir = crate::plugin::plugins_dir().unwrap().join("acme.logo");
+        std::fs::create_dir_all(dir.join("assets")).unwrap();
+        std::fs::write(
+            dir.join("aoe-plugin.toml"),
+            "id = \"acme.logo\"\nname = \"Logo\"\nversion = \"1.0.0\"\napi_version = 16\nicon_asset = \"assets/icon.png\"\n",
+        )
+        .unwrap();
+        std::fs::write(dir.join("assets/icon.png"), b"png-bytes").unwrap();
+        crate::plugin::reload_registry();
+
+        let login = std::sync::Arc::new(crate::server::login::LoginManager::new(Some("pw")));
+        let session = login.create_session(&[7u8; 32], "203.0.113.7", "t").await;
+        let state = crate::server::test_support::build_test_app_state_with_policy_configured(
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            None,
+            |state| state.login_manager = std::sync::Arc::clone(&login),
+        );
+        let app = crate::server::test_support::build_router_for_test(state);
+        let get =
+            |cookie: Option<String>| {
+                let mut req =
+                    axum::http::Request::get("/plugin-icons/acme.logo").header("host", "127.0.0.1");
+                if let Some(cookie) = cookie {
+                    req = req.header("cookie", cookie);
+                }
+                let mut req = req.body(axum::body::Body::empty()).unwrap();
+                req.extensions_mut().insert(axum::extract::ConnectInfo(
+                    std::net::SocketAddr::from(([203, 0, 113, 7], 5555)),
+                ));
+                app.clone().oneshot(req)
+            };
+        let cookie = format!("aoe_session={session}");
+
+        let resp = get(None).await.unwrap();
+        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED, "no session");
+
+        let resp = get(Some(cookie.clone())).await.unwrap();
+        assert_eq!(resp.status(), StatusCode::OK);
+        assert_eq!(resp.headers()["content-type"], "image/png");
+        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
+        assert_eq!(&body[..], b"png-bytes");
+
+        login.invalidate_session(&session).await;
+        let resp = get(Some(cookie)).await.unwrap();
+        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED, "after logout");
+    }
+
     #[test]
     #[serial_test::serial]
     fn composer_snapshot_forwarding_requires_active_composer_read_capability() {
```

**File**: `src/server/auth.rs` (modified, +71/-21)
```diff
@@ -133,6 +133,8 @@ fn normalize_path(path: &str) -> &str {
 fn is_machine_endpoint(path: &str) -> bool {
     let path = path.trim_end_matches('/');
     path.starts_with("/api/")
+        // Not under `/api/`, but refused with a 401 like it, never passed through.
+        || path.starts_with("/plugin-icons/")
         || path.contains("/ws")
         || (path.starts_with("/sessions/") && path.ends_with("/live-ws"))
         || is_mcp_path(path)
@@ -373,11 +375,25 @@ struct PageTicketClaim {
     tickets: Vec<String>,
 }
 
-/// Set only for a GET of exactly `/api/plugins/{id}/pages/{page_id}`.
-fn page_ticket_claim(request: &Request) -> Option<PageTicketClaim> {
+/// A GET that cannot send the device binding header and what stands in for it.
+enum UnboundClaim {
+    PageTicket(PageTicketClaim),
+    /// A plugin icon `<img>` load: the live session alone suffices.
+    PluginIcon,
+}
+
+fn unbound_claim(request: &Request) -> Option<UnboundClaim> {
     if request.method() != axum::http::Method::GET {
         return None;
     }
+    if let Some(id) = request.uri().path().strip_prefix("/plugin-icons/") {
+        return (!id.is_empty() && !id.contains('/')).then_some(UnboundClaim::PluginIcon);
+    }
+    page_ticket_claim(request).map(UnboundClaim::PageTicket)
+}
+
+/// Set only for exactly `/api/plugins/{id}/pages/{page_id}`.
+fn page_ticket_claim(request: &Request) -> Option<PageTicketClaim> {
     let rest = request.uri().path().strip_prefix("/api/plugins/")?;
     let (plugin_id, rest) = rest.split_once('/')?;
     let page_id = rest.strip_prefix("pages/")?;
@@ -392,21 +408,26 @@ fn page_ticket_claim(request: &Request) -> Option<PageTicketClaim> {
 }
 
 /// A bound session presents its binding. A frame load cannot, so on a plugin page route
-/// a ticket that session minted for that exact page stands in for it.
+/// a ticket that session minted for that exact page stands in for it; a plugin icon needs
+/// only the live session.
 async fn session_valid(
     state: &AppState,
     session_id: &str,
     binding: Option<&[u8]>,
-    claim: Option<PageTicketClaim>,
+    claim: Option<UnboundClaim>,
 ) -> bool {
     if let Some(binding) = binding {
         return state
             .login_manager
             .validate_session(session_id, binding)
             .await;
     }
-    let Some(claim) = claim else {
-        return false;
+    let claim = match claim {
+        Some(UnboundClaim::PageTicket(claim)) => claim,
+        Some(UnboundClaim::PluginIcon) => {
+            return state.login_manager.session_live(session_id).await
+        }
+        None => return false,
     };
     for ticket in &claim.tickets {
         if state
@@ -439,7 +460,7 @@ async fn run_passphrase_wall(
 
     let has_valid_session = match &session_id {
         Some(id) => {
-            let claim = page_ticket_claim(&request);
+            let claim = unbound_claim(&request);
             session_valid(state, id, presented_binding.as_deref(), claim).await
         }
         None => false,
@@ -641,7 +662,7 @@ pub async fn auth_middleware(
     };
     let session_valid = match &presented_session_id {
         Some(id) => {
-            let claim = page_ticket_claim(&request);
+            let claim = unbound_claim(&request);
             session_valid(&state, id, presented_binding.as_deref(), claim).await
         }
         None => false,
@@ -1217,6 +1238,7 @@ mod tests {
             "/api/plugins",
             "/api/plugins/github/pages/prs",
             "/pluginsx",
+            "/plugin-icons/github",
             "/api/sessions/abc/acp/ws",
             "/api/settings",
             "/api/login/elevate",
@@ -1336,10 +1358,11 @@ mod tests {
         }
     }
 
-    /// Plugin page deep links are document navigations that cannot carry a device binding
-    /// header, so the shell must load on a bare session cookie while APIs stay gated.
+    /// Plugin page deep links and plugin icon `<img>` loads cannot carry a device binding
+    /// header: the shell loads on a bare session cookie, an icon on a live session, and
+    /// APIs stay gated.
     #[tokio::test]
-    async fn plugin_page_shell_loads_remote_without_binding_header() {
+    async fn plugin_shell_and_icon_load_remote_without_binding_header() {
         use crate::server::login::LoginManager;
         use tower::ServiceExt;
 
@@ -1360,13 +1383,12 @@ mod tests {
                 None => format!("aoe_session={session_id}"),
             };
 
-            let get = |uri: &str| {
-                let mut req = Request::builder()
-                    .uri(uri)
-                    .header("host", "localhost")
-                    .header("cookie", &cookie)
-                    .body(axum::body::Body::empty())
-                    .unwrap();
+            let get = |uri: &str, cookie: Option<&str>| {
+                let mut req = Request::builder().uri(uri).header("host", "localhost");
+                if let Some(cookie) = cookie {
+                    req =
```

**File**: `src/server/login.rs` (modified, +10/-7)
```diff
@@ -298,13 +298,16 @@ impl LoginManager {
                 && t.plugin_id == plugin_id
                 && t.page_id == page_id
         });
-        matches
-            && self
-                .sessions
-                .read()
-                .await
-                .get(session_id)
-                .is_some_and(|s| now < s.expires_at)
+        matches && self.session_live(session_id).await
+    }
+
+    /// Whether `session_id` names an unexpired session, without checking its device binding.
+    pub async fn session_live(&self, session_id: &str) -> bool {
+        self.sessions
+            .read()
+            .await
+            .get(session_id)
+            .is_some_and(|s| Instant::now() < s.expires_at)
     }
 
     /// Mark a session as elevated (passphrase confirmed) for `ELEVATION_LIFETIME`.
```

**File**: `src/server/router.rs` (modified, +2/-1)
```diff
@@ -285,7 +285,8 @@ pub(super) fn build_router(state: Arc<AppState>) -> Router {
         .route("/api/app-state/tip-seen", post(api::mark_tip_seen))
         // Plugin management.
         .route("/api/plugins", get(api::list_plugins))
-        .route("/api/plugins/{id}/icon", get(api::serve_plugin_icon))
+        // A live login session needs no device binding here; see `auth::UnboundClaim`.
+        .route("/plugin-icons/{id}", get(api::serve_plugin_icon))
         .route(
             "/api/plugins/{id}/pages/{page_id}",
             get(api::serve_plugin_page),
```

**File**: `tests/integration/serve_cityhall_lockdown.rs` (modified, +1/-1)
```diff
@@ -232,7 +232,7 @@ async fn sensitive_routes_are_blocked() {
         (Method::GET, "/api/skills/claude-user/review", ""),
         (Method::GET, "/api/mcp/servers?agent=claude", ""),
         (Method::GET, "/api/plugins", ""),
-        (Method::GET, "/api/plugins/x/icon", ""),
+        (Method::GET, "/plugin-icons/x", ""),
         (Method::GET, "/api/plugins/commands", ""),
         (Method::GET, "/api/plugins/ui-state", ""),
         (Method::GET, "/api/plugins/updates", ""),
```

**File**: `web/src/components/__tests__/PaneIcon.test.tsx` (modified, +2/-2)
```diff
@@ -8,11 +8,11 @@ import { PaneIcon } from "../PaneIcon";
 describe("PaneIcon", () => {
   it("renders the icon_asset image, outranking the resolved fallback icon", async () => {
     const { findByTestId } = render(
-      <PaneIcon icon={GitBranch} iconAssetUrl="/api/plugins/acme.widget/icon" className="size-4" testId="icon" />,
+      <PaneIcon icon={GitBranch} iconAssetUrl="/plugin-icons/acme.widget" className="size-4" testId="icon" />,
     );
     const icon = await findByTestId("icon");
     expect(icon.tagName).toBe("IMG");
-    expect(icon.getAttribute("src")).toBe("/api/plugins/acme.widget/icon");
+    expect(icon.getAttribute("src")).toBe("/plugin-icons/acme.widget");
   });
 
   it("falls back to the resolved icon component when there is no icon_asset", () => {
```

#### Recent Merged Pull Requests:
- **PR #5828** (2026-11-17): test(tui): keep the settings scroll test independent of SSH (@klubrake)
- **PR #5820** (2026-11-17): fix(deps): clear cargo-deny advisories RUSTSEC-2026-0544 and -0543 (@Seluj78)
- **PR #5783** (2026-11-17): fix(tui): keep the request when a trust answer after a setup failure is refused (@cwrau)
- **PR #5782** (2026-11-17): fix(tui): settings fields cut by the viewport show only their own rows (@klubrake)
- **PR #5780** (2026-11-17): fix(sandbox): stop hook installers following links planted in the sandbox store (@Seluj78)
- **PR #5778** (2026-11-17): fix(server): keep the auth failure coalesce window fixed (@Seluj78)

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

## X. plugin): avoid blocking runtime on asset downloads

**RULE**:
When implementing operations in `src/plugin/fetch.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c07429c3`: plugin): avoid blocking runtime on asset downloads. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/plugin/fetch.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // Keep staging and the lease until asynchronous file operations finish.
        await_asset_download(tokio::spawn(download_release_binary(fetched, operation))).await
async fn await_asset_download(
    task: tokio::task::JoinHandle<Result<FetchedPlugin>>,
) -> Result<FetchedPlugin> {
    match task.await {
        Ok(result) => result,
        Err(error) if error.is_panic() => std::panic::resume_unwind(error.into_panic()),
        Err(error) => Err(error).context("plugin asset download task failed"),
    }
}

    use tokio::io::AsyncWriteExt;
    let mut file = tokio::fs::File::create(dest)
        .await
        .with_context(|| format!("creating {}", dest.display()))?;
    let result: Result<()> = async {
        while let Some(chunk) = response.chunk().await? {
            file.write_all(&chunk)
                .await
                .with_context(|| format!("writing {url} to {}", dest.display()))?;
        }
        Ok(())
    .await;
    let flush = file
        .flush()
        .await
        .with_context(|| format!("writing {url} to {}", dest.display()));
    result?;
    flush
    #[tokio::test]
    async fn asset_task_panics_reach_the_job_panic_boundary() {
      
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        download_release_binary(fetched, operation).await
    use std::io::Write;
    let mut file =
        std::fs::File::create(dest).with_context(|| format!("creating {}", dest.display()))?;
    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk)
            .with_context(|| format!("writing {url} to {}", dest.display()))?;
    file.flush()
        .with_context(|| format!("writing {url} to {}", dest.display()))
                async move { download.lock().unwrap().clone() }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c07429c3` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
