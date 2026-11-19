# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: agent-of-empires-agent-of-empires-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires-agent-of-empires-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T14:20:28.872Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-agent-of-empires-agent-of-empires-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires-agent-of-empires-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T14:20:28.872Z`  
> **Learning ID**: `LEARN-EVO-agent-of-empires-agent-of-empires-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 64%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from agent-of-empires-agent-of-empires-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `593655e0`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T14:20:18.806Z  
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
> **Harvest Timestamp**: 2026-11-19T14:20:18.800Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4636 stars

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
- **Issue #5869** (2026-11-19): **MCP wait_for reports completion when its event-store query fails**
  *Symptoms*: ### What happened?  When MCP `wait_for` receives `after_seq` and the session still reports `Idle`, it checks the event store for a turn ending after that cursor. If the query fails, `settled` treats the error as a positive result. The call can return `Idle` with `timed_out: false` without confirming that the requested turn ended.  **Expected:** Return a clear query error or keep waiting within the deadline. Report completion only when the event store confirms it. Cover the query-failure branch with a focused regression test.  Follow-up to #5753. [Completion check](https://github.com/agent-of-empires/agent-of-empires/blob/dd7827cbc7800d96bd9db973fbf040d784307ea3/src/server/mcp/wait.rs#L346-L364)  ### aoe version and OS  `main` at `dd7827cbc`. Source-derived scenario. No database fault was injected locally.  ### AI usage  AI drafted the report from a cross-checked source review. 
  **Post-Mortem & Fix Analysis**:
  > **Castellan triage**  Applied: - Label `P1` - Label `area:server` - Priority: P1 - Size: M - Status: Ready  Reasons: - priority: Incorrect completion reporting under query failure can cause silent hangs or false success—a regression blocker for MCP reliability. - area: Issue is in server-side MCP wait_for completion logic in event-store query handling. - type: Bug: error handling treats query failure as success instead of propagating or retrying. - size: Multi-file change spanning error handling, completion check logic, and new regression test.  Fit is not set by triage; it stays with maintainers.  <!-- castellan triage 60dab506215f0d76b04724e1da53f08e818d77f8bf20cb9484379fd464fef870 -->
  > <!-- coderabbit-ai-generated:v1 -->  <!-- This is an auto-generated issue plan by CodeRabbit --> <details> <summary>🔗 Related PRs</summary> <dl> <dd> <br>  agent-of-empires/agent-of-empires#5753 - feat(mcp): add wait_for, list_approvals and approve tools [closed] </dd> </dl> </details>  --- <details> <summary>📝 Issue Planner</summary> <dl> <dd> <br>  <sub>Check the box below or use the `@coderabbitai plan` command to generate an implementation plan and prompts that you can use with your favorite coding assistant.</sub>  - [ ] <!-- {"checkboxId":"8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan </dd> </dl> </details>   --- <details> <summary> 🧪 Issue enrichment is currently in open beta.</summary> <dl> <dd> <br>   You can configure auto-planning by selecting labels in the issue_enrichment configuration.  To disable automatic issue enrichment, add the following to your `.coderabbit.yaml`: ```yaml issue_enrichment:   auto_enrich:     enabled: false ``` </dd> </dl> </details>  💬 

- **Issue #5850** (2026-11-19): **Pane PID lookup fails when tmux runs without a UTF-8 locale, so kills skip the process tree**
  *Symptoms*:  **Priority:** P2. - **Silent:** nothing is logged above trace level. - **What breaks:** every kill path falls back to killing only the tmux session, so a pane's   descendants that left its process group survive. Status and foreground-PID detection lose the   pane PID too. - **Who:** only hosts where the process running `tmux` has no UTF-8 locale. That's common for   daemons started over `ssh` without `SendEnv LANG`, from cron, under `env -i`, or in stock   Debian or Ubuntu container images, where `LANG` is unset. A desktop terminal is usually fine.  ### Repro (tmux 3.6a, Ubuntu 26.04; the code path is the same in 3.5a) ```sh tmux -f /dev/null -L probe new-session -d -s p 'sleep 30' LC_ALL=C      tmux -L probe display-message -p -t p $'#{pane_dead}\t#{pane_pid}' | od -c   # 0 _ 1 9 4 ... LC_ALL=C.UTF-8 tmux -L probe display-message -p -t p $'#{pane_dead}\t#{pane_pid}' | od -c  # 0 \t 1 9 4 ... tmux -u -L probe display-message -p -t p $'#{pane_dead}\t#{pane_pid}' | od -c              # 0 \t 1 9 4 ... tmux -L probe kill-server ``` - `list-panes -F` behaves the same, and `\x1f` also becomes `_`. - With no config file and a private socket, it isn't caused by user configuration.  ### Cause (tmux source) `server_client_print` (server-client.c, 3.6a :3884, 3.5a :3330) handles output for a client with no session: `if (~c->flags & CLIENT_UTF8) sanitized = utf8_sanitize(msg);`. - `utf8_sanitize` (utf8.c) writes `_` for every byte outside 0x20-0x7e. - `CLIENT_UTF8` is set from the clien

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

### Incident Patch 1: `03e54bee` (2026-11-17)
**Commit Message**: fix(containers): share one sandbox image pull per runtime and image (#5809)

* fix(containers): share one sandbox image pull per runtime and image

Every pull path (the Daemon banner job, create's pull_latest, ensure_image
and the TUI banner) now joins one flight per (runtime, image) in the
process. A joiner waits on the same outcome and no second runtime process
starts. A cancelled caller detaches; the last one kills the pull and waits
for it to exit.

A failed pull carries a coded reason (timeout, network, disk_space, auth,
other) matched from runtime stderr, with shared wording in user_text().
The pull now runs in its own process group, so a timeout kill reaps
anything the runtime CLI forked.

Fixes #5748

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(containers): scope the unreadable-config pull check to its own image

The check asserted that no pull ran anywhere in the process. Under plain
`cargo test` the image_pull tests run as threads beside it and hold
running flights of their own. Configure an image no other test pulls and
assert that its pull state stays Idle. `any_running` has no other caller,
so it goes.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>


**File**: `flake.nix` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@
                 ./assets
                 ./docker
                 ./tests/fixtures/cli-read
+                ./tests/fixtures/pull-stderr
                 ./web/tests/helpers/fakeAcpAgent.mjs
               ];
             };
```

**File**: `src/containers/error.rs` (modified, +2/-0)
```diff
@@ -32,6 +32,7 @@ pub enum DockerError {
         runtime: &'static str,
         image: String,
         detail: String,
+        reason: super::image_pull::PullFailureReason,
     },
 
     #[error("Failed to create container: {0}")]
@@ -105,6 +106,7 @@ mod tests {
                 runtime,
                 image: "img:1".to_string(),
                 detail: sanitize_stderr("denied\nretry later"),
+                reason: crate::containers::image_pull::PullFailureReason::Other,
             }
             .to_string();
             assert_eq!(
```

**File**: `src/containers/image_pull.rs` (added, +547/-0)
```diff
@@ -0,0 +1,547 @@
+//! One image pull per Container runtime and image in this process. Every caller waits on the
+//! running pull as a waiter, so a second caller never starts a second runtime process.
+
+use std::collections::HashMap;
+use std::sync::{Arc, Condvar, LazyLock, Mutex, MutexGuard};
+use std::time::Duration;
+
+use serde::Serialize;
+use tokio_util::sync::CancellationToken;
+
+use super::error::{DockerError, Result};
+
+/// How often a waiter checks its own cancellation.
+const CANCEL_POLL: Duration = Duration::from_millis(50);
+
+/// Why a pull failed, read from the runtime's stderr. Only Docker's stderr has been captured
+/// (`tests/fixtures/pull-stderr`), so other runtimes' failures read as `Other` until they are.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[serde(rename_all = "snake_case")]
+pub enum PullFailureReason {
+    Timeout,
+    Network,
+    DiskSpace,
+    Auth,
+    Other,
+}
+
+impl PullFailureReason {
+    /// The wording both clients show.
+    pub fn user_text(self) -> String {
+        let why = match self {
+            Self::Timeout => "it took longer than 10 minutes",
+            Self::Network => "no network connection",
+            Self::DiskSpace => "not enough disk space",
+            Self::Auth => "the registry needs you to sign in",
+            Self::Other => "see aoe logs",
+        };
+        format!("Couldn't download the sandbox image: {why}.")
+    }
+
+    /// Network is checked before auth, so a connection error can't read as a sign-in problem.
+    pub(crate) fn classify(stderr: &str) -> Self {
+        let has = |phrases: &[&str]| phrases.iter().any(|p| stderr.contains(p));
+        if has(&["no space left on device"]) {
+            Self::DiskSpace
+        } else if has(&["no such host", "dial tcp"]) {
+            Self::Network
+        } else if has(&[
+            "pull access denied",
+            "error from registry: denied",
+            "unauthorized",
+        ]) {
+            Self::Auth
+        } else {
+            Self::Other
+        }
+    }
+}
+
+#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
+#[serde(tag = "state", rename_all = "snake_case")]
+pub enum PullState {
+    Idle,
+    Running,
+    Done,
+    /// `message` is `reason`'s shared wording; `error` is the runtime's output, for Details.
+    Failed {
+        reason: PullFailureReason,
+        message: String,
+        error: String,
+    },
+}
+
+#[derive(Debug, Clone, PartialEq, Eq, Hash)]
+pub(crate) struct PullKey {
+    pub runtime: &'static str,
+    pub image: String,
+}
+
+struct Flight {
+    /// Cancelled when the last waiter leaves; kills the runtime process.
+    kill: CancellationToken,
+    state: Mutex<FlightState>,
+    finished: Condvar,
+}
+
+struct FlightState {
+    waiters: usize,
+    outcome: Option<Result<()>>,
+}
+
+impl Flight {
+    /// Gives up one waiter's place; the last one out kills the pull. Returns whether it was last.
+    fn leave(&self, state: &mut FlightState) -> bool {
+        state.waiters -= 1;
+        if state.waiters > 0 {
+            return false;
+        }
+        self.kill.cancel();
+        true
+    }
+}
+
+enum Entry {
+    Running(Arc<Flight>),
+    Finished(PullState),
+}
+
+static FLIGHTS: LazyLock<Mutex<HashMap<PullKey, Entry>>> = LazyLock::new(Mutex::default);
+
+fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
+    mutex.lock().unwrap_or_else(|e| e.into_inner())
+}
+
+/// A caller's place in a running pull.
+pub(crate) struct Waiter {
+    flight: Arc<Flight>,
+    image: String,
+    /// Still counted in the flight's waiters.
+    joined: bool,
+}
+
+/// Joins `key`'s running pull, or starts `pull` on its own thread when none is running.
+pub(crate) fn join_with<F>(key: PullKey, pull: F) -> Waiter
+where
+    F: FnOnce(&CancellationToken) -> Result<()> + Send + 'static,
+{
+    let mut flights = lock(&FLIGHTS);
+    if let Some(Entry::Running(flight)) = flights.get(&key) {
+        let mut state = lock(&flight.state);
+        // Under the flight's lock, so a pull its last waiter is killing can't gain a waiter.
+        if !flight.kill.is_cancelled() {
+            state.waiters += 1;
+            return Waiter {
+                flight: flight.clone(),
+                image: key.image,
+                joined: true,
+            };
+        }
+    }
+    let flight = Arc::new(Flight {
+        kill: CancellationToken::new(),
+        state: Mutex::new(FlightState {
+            waiters: 1,
+            outcome: None,
+        }),
+        finished: Condvar::new(),
+    });
+    flights.insert(key.clone(), Entry::Running(flight.clone()));
+    drop(flights);
+    let runner = flight.clone();
+    let image = key.image.clone();
+    std::thread::spawn(move || {
+        let started = std::time::Instant::now();
+        // A panic still finishes the flight; otherwise its waiters and every later joiner hang.
+        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| pull(&ru
```

**File**: `src/containers/mod.rs` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 pub mod container_interface;
 pub mod error;
 mod execution;
+pub mod image_pull;
 pub mod image_update;
 mod runtime;
 pub(crate) mod runtime_base;
```

**File**: `src/containers/runtime.rs` (modified, +32/-4)
```diff
@@ -8,6 +8,7 @@ use super::container_interface::{
     ContainerConfig, InspectedContainer, InspectedMount, VolumeMount,
 };
 use super::error::{DockerError, Result};
+use super::image_pull;
 use super::image_update::LocalDigest;
 use super::runtime_base::RuntimeBase;
 
@@ -115,16 +116,38 @@ impl ContainerRuntime {
     }
 
     pub fn pull_image(&self, image: &str) -> Result<()> {
-        self.base.pull_image(image)
+        self.join_pull(image)
+            .wait(&tokio_util::sync::CancellationToken::new())
     }
 
-    /// [`Self::pull_image`], killed when `cancel` fires.
+    /// [`Self::pull_image`]; when `cancel` fires this caller stops waiting, and the pull is
+    /// killed if no other caller is waiting on it.
     pub fn pull_image_until_cancelled(
         &self,
         image: &str,
         cancel: &tokio_util::sync::CancellationToken,
     ) -> Result<()> {
-        self.base.pull_until_cancelled(image, cancel)
+        self.join_pull(image).wait(cancel)
+    }
+
+    /// Joins this process's running pull of `image`, or starts one.
+    pub(crate) fn join_pull(&self, image: &str) -> image_pull::Waiter {
+        let base = self.base;
+        let pulled = image.to_string();
+        image_pull::join_with(self.pull_key(image), move |kill| {
+            base.pull_until_cancelled(&pulled, kill)
+        })
+    }
+
+    pub(crate) fn pull_state(&self, image: &str) -> image_pull::PullState {
+        image_pull::state(&self.pull_key(image))
+    }
+
+    fn pull_key(&self, image: &str) -> image_pull::PullKey {
+        image_pull::PullKey {
+            runtime: self.display_name(),
+            image: image.to_string(),
+        }
     }
 
     /// The command [`Self::pull_image`] runs, for a user to copy when the dashboard can't pull.
@@ -151,7 +174,12 @@ impl ContainerRuntime {
         image: &str,
         cancel: &tokio_util::sync::CancellationToken,
     ) -> Result<()> {
-        self.base.ensure_image(image, cancel)
+        if self.base.image_exists_locally(image) {
+            tracing::info!(target: "containers.runtime", "Using local {} image '{}'", self.base.name, image);
+            return Ok(());
+        }
+        tracing::info!(target: "containers.runtime", "Pulling {} image '{}'", self.base.name, image);
+        self.pull_image_until_cancelled(image, cancel)
     }
 
     pub fn default_sandbox_image(&self) -> &'static str {
```

**File**: `src/containers/runtime_base.rs` (modified, +72/-16)
```diff
@@ -2,6 +2,7 @@ use super::container_interface::{
     docker_env_args, ContainerConfig, RunFlag, TargetEnvFile, CGROUP_PARENT_LABEL,
 };
 use super::error::{sanitize_stderr, DockerError, Result};
+use super::image_pull::PullFailureReason;
 use std::collections::HashSet;
 use std::process::{Command, Stdio};
 use std::time::{Duration, Instant};
@@ -60,6 +61,7 @@ fn joins_user_slice(output: &str, rootless_marker: &str) -> bool {
         && words.any(|word| word.trim_matches(['[', ']']) == rootless_marker)
 }
 
+#[derive(Clone, Copy)]
 pub(crate) struct RuntimeBase {
     pub binary: &'static str,
     pub name: &'static str,
@@ -303,18 +305,25 @@ impl RuntimeBase {
         self.probe_succeeds(&["image", "inspect", image])
     }
 
-    pub fn pull_image(&self, image: &str) -> Result<()> {
-        self.pull_until_cancelled(image, &CancellationToken::new())
+    pub fn pull_until_cancelled(&self, image: &str, cancel: &CancellationToken) -> Result<()> {
+        self.pull_with_timeout(image, cancel, PULL_TIMEOUT)
     }
 
-    pub fn pull_until_cancelled(&self, image: &str, cancel: &CancellationToken) -> Result<()> {
+    fn pull_with_timeout(
+        &self,
+        image: &str,
+        cancel: &CancellationToken,
+        timeout: Duration,
+    ) -> Result<()> {
         let mut cmd = self.command();
         cmd.args(self.pull_prefix);
         cmd.arg(image);
         cmd.stdin(Stdio::null());
         let start = Instant::now();
         tracing::info!(target: "containers.image", runtime = %self.name, %image, "pulling image");
-        let output = match crate::process::run_until_cancelled(&mut cmd, PULL_TIMEOUT, cancel)? {
+        let output = match crate::process::run_until_cancelled_process_group(
+            &mut cmd, timeout, cancel,
+        )? {
             Some(output) => output,
             None if cancel.is_cancelled() => {
                 tracing::info!(target: "containers.image", runtime = %self.name, %image, "image pull cancelled");
@@ -327,13 +336,14 @@ impl RuntimeBase {
                     runtime = %self.name,
                     %image,
                     duration_ms = dur_ms,
-                    timeout_s = PULL_TIMEOUT.as_secs(),
+                    timeout_s = timeout.as_secs(),
                     "image pull timed out; killed",
                 );
                 return Err(DockerError::ImagePullFailed {
                     runtime: self.name,
                     image: image.to_string(),
-                    detail: format!("timed out after {}s", PULL_TIMEOUT.as_secs()),
+                    detail: format!("timed out after {}s", timeout.as_secs()),
+                    reason: PullFailureReason::Timeout,
                 });
             }
         };
@@ -353,6 +363,7 @@ impl RuntimeBase {
                 runtime: self.name,
                 image: image.to_string(),
                 detail: sanitize_stderr(&stderr),
+                reason: PullFailureReason::classify(&stderr),
             });
         }
 
@@ -366,16 +377,6 @@ impl RuntimeBase {
         Ok(())
     }
 
-    pub fn ensure_image(&self, image: &str, cancel: &CancellationToken) -> Result<()> {
-        if self.image_exists_locally(image) {
-            tracing::info!(target: "containers.runtime", "Using local {} image '{}'", self.name, image);
-            return Ok(());
-        }
-
-        tracing::info!(target: "containers.runtime", "Pulling {} image '{}'", self.name, image);
-        self.pull_until_cancelled(image, cancel)
-    }
-
     pub fn default_sandbox_image(&self) -> &'static str {
         "ghcr.io/agent-of-empires/aoe-sandbox:latest"
     }
@@ -1056,6 +1057,61 @@ mod tests {
         ));
     }
 
+    #[cfg(target_os = "linux")]
+    #[test]
+    #[serial_test::parallel]
+    fn a_pull_timeout_kills_a_runtime_that_ignores_sigterm_and_its_children() {
+        use std::os::unix::fs::PermissionsExt;
+        let _env = crate::session::test_support::EnvGuard::read_lock();
+        let dir = tempfile::tempdir().unwrap();
+        let (shell, child) = (dir.path().join("shell"), dir.path().join("child"));
+        let binary = dir.path().join("docker");
+        std::fs::write(
+            &binary,
+            format!(
+                "#!/bin/sh\ntrap '' TERM\necho $$ > '{}'\nsleep 300 &\necho $! > '{}'\nwait\n",
+                shell.display(),
+                child.display()
+            ),
+        )
+        .unwrap();
+        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o755)).unwrap();
+        let runtime = RuntimeBase {
+            binary: Box::leak(binary.to_string_lossy().into_owned().into_boxed_str()),
+            ..RuntimeBase::DOCKER
+        };
+
+        let result =
+            runtime.pull_with_timeout("img", &CancellationToken::new(), Duration::from_secs(1));
+        assert!(matches!(
+            result,
+            Err(DockerError::ImagePullFailed {
+                reason: PullFailureReason::Timeout,
+                ..
+           
```

**File**: `src/server/api/sandbox_image.rs` (modified, +90/-89)
```diff
@@ -16,6 +16,7 @@ use serde::{Deserialize, Serialize};
 use tokio::time::Instant;
 
 use super::{api_error, cityhall_block, read_only_block};
+use crate::containers::image_pull::PullState;
 use crate::containers::image_update::{self, ImageCheck};
 use crate::containers::ContainerRuntime;
 use crate::server::AppState;
@@ -103,6 +104,10 @@ impl StatusCache {
 }
 
 static STATUS: LazyLock<Mutex<StatusCache>> = LazyLock::new(Mutex::default);
+/// The key's dashboard waiter, by the id its cleanup checks. One per running pull, so repeated
+/// POSTs don't each hold a blocking thread for the whole pull.
+static DASHBOARD_WAITERS: LazyLock<Mutex<HashMap<ImageKey, u64>>> = LazyLock::new(Mutex::default);
+static NEXT_DASHBOARD_WAITER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
 /// One registry check per image and runtime at a time, so callers arriving together share it.
 static CHECK_TURNS: LazyLock<Mutex<HashMap<ImageKey, Arc<tokio::sync::Mutex<()>>>>> =
     LazyLock::new(Mutex::default);
@@ -159,38 +164,6 @@ where
     })
 }
 
-#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
-#[serde(tag = "state", rename_all = "snake_case")]
-pub enum PullState {
-    Idle,
-    Running,
-    Done,
-    /// `error` carries the Container runtime's stderr.
-    Failed {
-        error: String,
-    },
-}
-
-static PULLS: LazyLock<Mutex<HashMap<ImageKey, PullState>>> = LazyLock::new(Mutex::default);
-
-/// Marks the image running unless it already is; true when the caller should start the pull.
-fn claim_pull(pulls: &mut HashMap<ImageKey, PullState>, key: &ImageKey) -> bool {
-    if pulls.get(key) == Some(&PullState::Running) {
-        return false;
-    }
-    pulls.insert(key.clone(), PullState::Running);
-    true
-}
-
-fn pull_state(key: &ImageKey) -> PullState {
-    PULLS
-        .lock()
-        .unwrap_or_else(|e| e.into_inner())
-        .get(key)
-        .cloned()
-        .unwrap_or(PullState::Idle)
-}
-
 /// What the Daemon would sandbox with. Only these are checked or pulled, so a request can't
 /// make the Daemon contact an arbitrary registry or pull an arbitrary image.
 struct Configured {
@@ -388,7 +361,7 @@ pub async fn sandbox_image_status(
             .iter()
             .any(|i| i.is_sandboxed());
     Json(ImageStatusResponse {
-        pull: pull_state(&key),
+        pull: runtime.pull_state(&image),
         pull_blocked: pull_blocked(&state, &configured),
         pull_command: runtime.pull_command(&image),
         runtime: runtime.display_name(),
@@ -458,44 +431,28 @@ pub async fn sandbox_image_pull(
         Err(resp) => return resp,
     };
     let key = configured.key(image.clone());
-    let started = claim_pull(&mut PULLS.lock().unwrap_or_else(|e| e.into_inner()), &key);
-    if started {
-        let runtime = configured.runtime;
-        tokio::spawn(async move {
-            let pulled = key.image.clone();
-            let started = std::time::Instant::now();
-            let result = tokio::task::spawn_blocking(move || {
-                ContainerRuntime::from(runtime).pull_image(&pulled)
-            })
-            .await;
-            let outcome = match result {
-                Ok(Ok(())) => PullState::Done,
-                Ok(Err(e)) => PullState::Failed {
-                    error: e.to_string(),
-                },
-                Err(e) => PullState::Failed {
-                    error: format!("pull task failed: {e}"),
-                },
-            };
-            let duration_ms = started.elapsed().as_millis();
-            match &outcome {
-                PullState::Failed { error } => {
-                    tracing::warn!(target: "containers.image", image = %key.image, ok = false, duration_ms, %error, "image pull finished")
-                }
-                _ => {
-                    tracing::info!(target: "containers.image", image = %key.image, ok = true, duration_ms, "image pull finished")
-                }
-            }
+    let runtime = ContainerRuntime::from(configured.runtime);
+    let mut waiters = DASHBOARD_WAITERS.lock().unwrap_or_else(|e| e.into_inner());
+    // Joined under the map's lock, so two POSTs can't both add a waiter to one pull.
+    if !(waiters.contains_key(&key) && runtime.pull_state(&image) == PullState::Running) {
+        // Registered now, so the next status read already sees it running.
+        let waiter = runtime.join_pull(&image);
+        let id = NEXT_DASHBOARD_WAITER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
+        waiters.insert(key.clone(), id);
+        tokio::task::spawn_blocking(move || {
+            // A pull the dashboard asked for is never cancelled by a create that joined it.
+            let _ = waiter.wait(&tokio_util::sync::CancellationToken::new());
             STATUS
                 .lock()
                 .unwrap_or_else(|e| e.into_inner())
                 .invalidate(&key);
-            PULLS
-                .lock()
-                .unwrap_or_else(|e| e.into_inner
```

**File**: `src/server/api/sessions/tests.rs` (modified, +2/-0)
```diff
@@ -5817,6 +5817,7 @@ fn public_create_session_error_forwards_typed_causes_as_fixed_templates() {
                 runtime: "Podman",
                 image: "ghcr.io/acme/sandbox:1".into(),
                 detail: format!("denied: token {SECRET} at /root/.docker/config.json"),
+                reason: crate::containers::image_pull::PullFailureReason::Other,
             })
             .context("ensure image"),
             (
@@ -5922,6 +5923,7 @@ fn public_create_session_error_forwards_typed_causes_as_fixed_templates() {
                 runtime: "Docker",
                 image: "x".repeat(2000),
                 detail: String::new(),
+                reason: crate::containers::image_pull::PullFailureReason::Other,
             }),
             "sandbox_image_pull_failed",
         ),
```

---

### Incident Patch 2: `b47a466c` (2026-11-19)
**Commit Message**: fix(acp): keep the connection when the agent rejects a prompt (#5864)

* fix(acp): keep the connection when the agent rejects a prompt

An error answer to session/prompt was returned as a connection error, so
aoe tore down the ACP connection, respawned the agent and left the
session in Error. The queue had already retired the prompt, so the
user's message was lost.

The agent answering with an error now ends only that turn: the error
surfaces as a PromptRuntimeError and the text comes back as a
PromptRejected retry pill. A lost transport or runner, and a resumed
session the agent no longer has, still end the connection as before. An
error that answers our own cancel ends the turn as cancelled.

Fixes #5662

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(acp): cancel the leftover turn and narrow what counts as rejected

Review follow-ups for #5662:

- A rejection sends session/cancel, so a turn the agent still runs from
  before a restart no longer rejects every retry.
- The runner client's duplicate-waiter guard is a local error, not a
  PromptOutcome::Error, so it is never mistaken for the agent's answer.
- A session the agent no longer has still tears down for recovery

**File**: `src/acp/acp_client/commands.rs` (modified, +29/-4)
```diff
@@ -4,15 +4,40 @@
 use agent_client_protocol::v1::schema::ContentBlock;
 use tokio::sync::oneshot;
 
+use crate::daemon::PromptAttachmentRef;
+
 use super::delete::DeleteSessionOutcome;
 use super::reset::ResetSessionOutcome;
 
+/// A user prompt as `send_prompt` built it (#1000): the blocks the agent
+/// receives, and refs to the stored attachments among them, which a refusal
+/// hands back so Retry resends the same payload.
+#[derive(Debug, Clone, Default)]
+pub(super) struct PromptInput {
+    pub(super) blocks: Vec<ContentBlock>,
+    pub(super) attachments: Vec<PromptAttachmentRef>,
+}
+
+impl PromptInput {
+    /// The text the retry pill shows and resends.
+    pub(super) fn text(&self) -> String {
+        super::steer::first_text_block(&self.blocks)
+    }
+}
+
+#[cfg(test)]
+impl From<Vec<ContentBlock>> for PromptInput {
+    fn from(blocks: Vec<ContentBlock>) -> Self {
+        Self {
+            blocks,
+            attachments: Vec::new(),
+        }
+    }
+}
+
 /// Commands sent from `AcpClient` methods to the background connection task.
 pub(super) enum ClientCmd {
-    /// The fully-built prompt content blocks (text first, then any
-    /// attachments). Built in `send_prompt` so the connection task just
-    /// forwards them to `session/prompt`. See #1000.
-    Prompt(Vec<ContentBlock>),
+    Prompt(PromptInput),
     Cancel,
     /// `session/cancel` for one subagent session. Answers whether it was sent:
     /// false when the child is unknown or did not advertise `cancel`.
```

**File**: `src/acp/acp_client/connection/command_loop.rs` (modified, +9/-8)
```diff
@@ -3,9 +3,8 @@
 
 use crate::acp::state::Event;
 use agent_client_protocol::v1::schema::{
-    CancelNotification, ContentBlock, McpServer, NewSessionRequest, NewSessionResponse,
-    SessionConfigId, SessionConfigOption, SessionConfigValueId, SessionId,
-    SetSessionConfigOptionRequest,
+    CancelNotification, McpServer, NewSessionRequest, NewSessionResponse, SessionConfigId,
+    SessionConfigOption, SessionConfigValueId, SessionId, SetSessionConfigOptionRequest,
 };
 use agent_client_protocol::v1::ConnectionTo;
 use agent_client_protocol::Agent;
@@ -20,7 +19,7 @@ use super::notifications::{now_ms, Shared};
 use crate::acp::acp_client::between_prompt::{
     between_prompt_stop_reason, BETWEEN_PROMPT_IDLE_CHECK_INTERVAL,
 };
-use crate::acp::acp_client::commands::ClientCmd;
+use crate::acp::acp_client::commands::{ClientCmd, PromptInput};
 use crate::acp::acp_client::config_options::{
     config_option_failure_event, config_options_event, dispatch_set_config_option,
     dispatch_set_mode, mode_config_id, model_config_values, model_option, modes_available_event,
@@ -62,7 +61,7 @@ pub(super) struct Session {
     pub(super) lifecycle_rx: mpsc::Receiver<LifecycleEnvelope>,
     /// Steers the adapter handed back unconsumed, run as ordinary turns.
     /// Kept here rather than re-sent on the bounded channel this task drains.
-    pub(super) pending_prompts: VecDeque<Vec<ContentBlock>>,
+    pub(super) pending_prompts: VecDeque<PromptInput>,
 }
 
 impl Session {
@@ -157,7 +156,7 @@ impl Session {
             let cancel_deadline = *shared.cancel_deadline.lock().unwrap();
             // Fallback prompts go first so later messages cannot overtake them.
             let cmd = match self.pending_prompts.pop_front() {
-                Some(blocks) => Some(ClientCmd::Prompt(blocks)),
+                Some(prompt) => Some(ClientCmd::Prompt(prompt)),
                 None => tokio::select! {
                     biased;
                     outcome = async {
@@ -196,8 +195,8 @@ impl Session {
                 },
             };
             match cmd {
-                Some(ClientCmd::Prompt(blocks)) => {
-                    if self.run_prompt(blocks).await? {
+                Some(ClientCmd::Prompt(prompt)) => {
+                    if self.run_prompt(prompt).await? {
                         break;
                     }
                 }
@@ -405,6 +404,7 @@ impl Session {
                 .emit(Event::PromptRejected {
                     reason: "agent_busy".into(),
                     text,
+                    attachments: Vec::new(),
                 })
                 .await;
             let _ = respond_to.send(ResetSessionOutcome::Failed {
@@ -428,6 +428,7 @@ impl Session {
                 .emit(Event::PromptRejected {
                     reason: "agent_busy".into(),
                     text,
+                    attachments: Vec::new(),
                 })
                 .await;
             let _ = respond_to.send(ResetSessionOutcome::Failed {
```

**File**: `src/acp/acp_client/connection/prompt.rs` (modified, +142/-58)
```diff
@@ -17,15 +17,16 @@ use tracing::{debug, info, trace, warn};
 use super::command_loop::Session;
 use super::notifications::now_ms;
 use super::CANCEL_ESCALATION_GRACE;
-use crate::acp::acp_client::commands::ClientCmd;
+use crate::acp::acp_client::commands::{ClientCmd, PromptInput};
 use crate::acp::acp_client::control::prompt_outcome_to_response;
 use crate::acp::acp_client::delete::handle_delete_session_cmd;
-use crate::acp::acp_client::errors::acp_internal_error;
+use crate::acp::acp_client::errors::{acp_internal_error, is_authentication_failure};
 use crate::acp::acp_client::lifecycle::{LifecycleSignal, OffProtocolWorkKind};
 use crate::acp::acp_client::opencode::recover_opencode_prompt_error;
 use crate::acp::acp_client::rate_limit::{
-    captured_rate_limit_reset, classify_rate_limit_error, clear_captured_rejections,
-    is_unsupported_session_error, take_rate_limit_from_captured_rejection,
+    captured_rate_limit_reset, classify_rate_limit_error, classify_rate_limit_from_message,
+    clear_captured_rejections, is_unsupported_session_error,
+    take_rate_limit_from_captured_rejection,
 };
 use crate::acp::acp_client::reset::ResetSessionOutcome;
 use crate::acp::acp_client::steer::{first_text_block, SteerOutcome, SteerRequest};
@@ -34,11 +35,11 @@ use crate::acp::acp_client::watchdog::{
     terminal_stop_reason, SilentOrphanWatchdog, SilentOrphanWatchdogConfig,
     OFF_PROTOCOL_WORK_GRACE_FLOOR,
 };
+use crate::daemon::PromptAttachmentRef;
 
 type AcpResult<T> = Result<T, agent_client_protocol::Error>;
-type PromptFut = Pin<Box<dyn Future<Output = AcpResult<PromptResponse>> + Send>>;
-type SteerFut =
-    Pin<Box<dyn Future<Output = (Vec<ContentBlock>, AcpResult<serde_json::Value>)> + Send>>;
+type PromptFut = Pin<Box<dyn Future<Output = PromptReply> + Send>>;
+type SteerFut = Pin<Box<dyn Future<Output = (PromptInput, AcpResult<serde_json::Value>)> + Send>>;
 
 #[cfg(test)]
 pub(super) struct SelectProbe {
@@ -68,6 +69,13 @@ fn observe_select_win(command: bool) {
     });
 }
 
+/// `session/prompt`'s result. `rejected` marks an error the agent answered
+/// with, as opposed to a lost transport or runner.
+struct PromptReply {
+    result: AcpResult<PromptResponse>,
+    rejected: bool,
+}
+
 enum Flow {
     Continue,
     Break,
@@ -87,10 +95,15 @@ struct TurnFlags {
     cancelling: bool,
     /// What the adapter reported; `None` when no `PromptResponse` arrived.
     agent_stop_reason: Option<StopReason>,
+    /// The error the agent answered `session/prompt` with.
+    rejection: Option<String>,
 }
 
 struct Turn {
     epoch: u64,
+    /// Handed back on a rejection so the user can retry it.
+    prompt_text: String,
+    prompt_attachments: Vec<PromptAttachmentRef>,
     flags: TurnFlags,
     watchdog: SilentOrphanWatchdog,
     cfg: SilentOrphanWatchdogConfig,
@@ -101,7 +114,7 @@ struct Turn {
     /// At most one steer is outstanding so racing steers cannot reorder the
     /// user's messages; later ones wait in the backlog.
     steer_fut: Option<SteerFut>,
-    steer_backlog: VecDeque<Vec<ContentBlock>>,
+    steer_backlog: VecDeque<PromptInput>,
 }
 
 impl Turn {
@@ -116,6 +129,12 @@ impl Turn {
     }
 }
 
+/// The SDK's own error for a connection that ended before the response.
+fn is_lost_response(error: &agent_client_protocol::Error) -> bool {
+    agent_client_protocol::is_connection_terminated(error)
+        || agent_client_protocol::is_incoming_transport_closed(error)
+}
+
 /// Debug-only fault injection: suppress the prompt response once so the
 /// silent-orphan watchdog must break the loop (#1240).
 fn simulate_orphan(session_label: &str) -> bool {
@@ -139,7 +158,11 @@ fn simulate_orphan(session_label: &str) -> bool {
 impl Session {
     /// Runs one turn and always emits its terminal `Stopped`. Returns whether
     /// the connection should shut down.
-    pub(super) async fn run_prompt(&mut self, blocks: Vec<ContentBlock>) -> AcpResult<bool> {
+    pub(super) async fn run_prompt(&mut self, prompt: PromptInput) -> AcpResult<bool> {
+        let PromptInput {
+            blocks,
+            attachments,
+        } = prompt;
         let shared = self.shared.clone();
         if let Some(control) = self.control.as_ref() {
             control.supersede_adopted_turn();
@@ -193,6 +216,8 @@ impl Session {
         let orphan_check_period = silent_orphan_check_interval();
         let mut turn = Turn {
             epoch,
+            prompt_text: first_text_block(&blocks),
+            prompt_attachments: attachments,
             flags: TurnFlags::default(),
             watchdog: SilentOrphanWatchdog::default(),
             cfg: SilentOrphanWatchdogConfig {
@@ -259,10 +284,10 @@ impl Session {
                 {
                     self.on_orphan_check(&mut turn).await
                 }
-                (blocks, res) = async {
+                (prompt, res) = async {
                     turn.steer_fut.as_mut().expect("guarded by the arm condition").await
            
```

**File**: `src/acp/acp_client/connection/tests.rs` (modified, +85/-12)
```diff
@@ -3,6 +3,7 @@
 use super::super::pending::{ApprovalResolutionMessage, PendingResolver, PendingResponder};
 use super::prompt::{SelectProbe, SELECT_PROBE};
 use super::*;
+use crate::acp::acp_client::commands::PromptInput;
 use crate::acp::acp_client::reset::ResetSessionOutcome;
 use crate::acp::approvals::ApprovalDecision;
 use crate::acp::fs_handler::FsPolicy;
@@ -161,9 +162,9 @@ async fn cancel_under_flood() {
         .expect("handshake completes")
         .expect("handshake ok");
     cmd_tx
-        .send(ClientCmd::Prompt(vec![ContentBlock::Text(
-            TextContent::new("hi"),
-        )]))
+        .send(ClientCmd::Prompt(PromptInput::from(vec![
+            ContentBlock::Text(TextContent::new("hi")),
+        ])))
         .await
         .unwrap();
 
@@ -604,9 +605,9 @@ async fn default_mode_reaches_the_live_mode_option_only_when_configured() {
             })
             .await;
         fake.cmd_tx
-            .send(ClientCmd::Prompt(vec![ContentBlock::Text(
-                TextContent::new("hi"),
-            )]))
+            .send(ClientCmd::Prompt(PromptInput::from(vec![
+                ContentBlock::Text(TextContent::new("hi")),
+            ])))
             .await
             .unwrap();
         tokio::time::timeout(Duration::from_secs(10), prompted_rx.recv())
@@ -733,9 +734,9 @@ async fn prompted_turn_ending_on_a_rejected_window_parks() {
         })
         .await;
         fake.cmd_tx
-            .send(ClientCmd::Prompt(vec![ContentBlock::Text(
-                TextContent::new("hi"),
-            )]))
+            .send(ClientCmd::Prompt(PromptInput::from(vec![
+                ContentBlock::Text(TextContent::new("hi")),
+            ])))
             .await
             .unwrap();
 
@@ -783,6 +784,78 @@ async fn prompted_turn_ending_on_a_rejected_window_parks() {
     }
 }
 
+/// Sends one prompt and returns the events before its `Stopped`, and its reason.
+async fn prompt_turn(fake: &mut FakeConnection, text: &str) -> (Vec<Event>, String) {
+    fake.cmd_tx
+        .send(ClientCmd::Prompt(PromptInput::from(vec![
+            ContentBlock::Text(TextContent::new(text)),
+        ])))
+        .await
+        .unwrap();
+    let mut seen = Vec::new();
+    tokio::time::timeout(Duration::from_secs(10), async {
+        loop {
+            match fake.event_rx.recv().await.expect("connection remains open") {
+                Event::Stopped { reason } => return (seen, reason),
+                event => seen.push(event),
+            }
+        }
+    })
+    .await
+    .expect("the turn must reach a terminal event")
+}
+
+/// An agent that answers `session/prompt` with an error ends only that turn:
+/// the error and the prompt text come back, and the connection takes the next
+/// prompt (#5662).
+#[tokio::test]
+async fn rejected_prompt_keeps_the_connection_and_returns_the_text() {
+    let prompts = Arc::new(std::sync::atomic::AtomicUsize::new(0));
+    let counter = prompts.clone();
+    let mut fake = spawn_fake_connection("s-rejected", move |id| {
+        vec![if counter.fetch_add(1, Ordering::SeqCst) == 0 {
+            format!(
+                r#"{{"jsonrpc":"2.0","id":{id},"error":{{"code":-32603,"message":"a turn is already running"}}}}"#
+            )
+        } else {
+            format!(r#"{{"jsonrpc":"2.0","id":{id},"result":{{"stopReason":"end_turn"}}}}"#)
+        }]
+    })
+    .await;
+
+    let (seen, reason) = prompt_turn(&mut fake, "retry me").await;
+    assert_eq!(reason, "prompt_rejected", "{seen:?}");
+    assert!(
+        seen.iter().any(|e| matches!(
+            e,
+            Event::PromptRuntimeError { message } if message.contains("a turn is already running")
+        )),
+        "the agent's error must surface on the turn: {seen:?}"
+    );
+    assert!(
+        seen.iter().any(|e| matches!(
+            e,
+            Event::PromptRejected { text, .. } if text == "retry me"
+        )),
+        "the prompt text must come back for a retry: {seen:?}"
+    );
+
+    let (seen, reason) = prompt_turn(&mut fake, "again").await;
+    assert_eq!(reason, "prompt_complete");
+    assert!(
+        !seen.iter().any(|e| matches!(
+            e,
+            Event::PromptRuntimeError { .. } | Event::PromptRejected { .. }
+        )),
+        "{seen:?}"
+    );
+    assert_eq!(prompts.load(Ordering::SeqCst), 2);
+    assert!(!fake.connection.is_finished());
+    fake.connection.abort();
+    fake.agent.abort();
+    let _ = fake.agent.await;
+}
+
 /// A child cancel reaches the agent addressed to the child and only when the
 /// child announced `cancel`; the root turn's cancel stays a separate command.
 #[tokio::test]
@@ -1045,9 +1118,9 @@ async fn reset_waits_for_a_running_subagent() {
 
     // The agent reports the child idle before it ends the turn.
     cmd_tx
-        .send(ClientCmd::Prompt(vec![ContentBlock::Text(
-            TextContent::new("go"),
-        )]))
+        .send(ClientCmd::Prompt(PromptInput::from(vec![
+            
```

**File**: `src/acp/acp_client/control.rs` (modified, +31/-30)
```diff
@@ -288,21 +288,20 @@ impl DaemonControlClient {
         }
     }
 
-    /// Registers the completion waiter before sending the `Prompt` frame.
+    /// Registers the completion waiter before sending the `Prompt` frame. A
+    /// waiter already pending is refused locally, without a frame.
     pub(super) async fn prompt(
         &self,
         request: serde_json::Value,
-    ) -> oneshot::Receiver<control_protocol::PromptOutcome> {
+    ) -> Result<oneshot::Receiver<control_protocol::PromptOutcome>, agent_client_protocol::Error>
+    {
         let (tx, rx) = oneshot::channel();
         {
             let mut completion = self.completion.lock().expect("completion mutex poisoned");
             if matches!(*completion, PromptCompletion::Pending { .. }) {
-                let _ = tx.send(control_protocol::PromptOutcome::Error {
-                    code: control_protocol::INTERNAL_ERROR as i32,
-                    message: "a local prompt is already awaiting completion".into(),
-                    data: None,
-                });
-                return rx;
+                return Err(acp_internal_error(
+                    "a local prompt is already awaiting completion".into(),
+                ));
             }
             *completion = PromptCompletion::Pending {
                 prompt_req_id: None,
@@ -315,7 +314,7 @@ impl DaemonControlClient {
             *self.completion.lock().expect("completion mutex poisoned") =
                 PromptCompletion::LocalIdle;
         }
-        rx
+        Ok(rx)
     }
 
     pub(super) async fn cancel(&self) {
@@ -975,7 +974,7 @@ mod tests {
         }
 
         async fn prompt(&mut self) -> oneshot::Receiver<PromptOutcome> {
-            let rx = self.client.prompt(serde_json::json!({})).await;
+            let rx = self.client.prompt(serde_json::json!({})).await.unwrap();
             assert!(matches!(
                 control_protocol::read_frame(&mut self.peer).await.unwrap(),
                 Some(ControlBody::Prompt { .. })
@@ -1112,14 +1111,11 @@ mod tests {
     async fn duplicate_local_prompt_preserves_first_waiter_and_sends_no_prompt() {
         let mut peer = PromptControlPeer::new().await;
         let completion = peer.prompt().await;
-        let mut duplicate = peer
+        let duplicate = peer
             .client
             .prompt(serde_json::json!({"duplicate": true}))
             .await;
-        assert!(matches!(
-            duplicate.try_recv().unwrap(),
-            PromptOutcome::Error { code, .. } if i64::from(code) == control_protocol::INTERNAL_ERROR
-        ));
+        assert!(duplicate.is_err());
         // Cancel arriving next proves the duplicate sent no Prompt frame.
         peer.client.cancel().await;
         assert!(matches!(
@@ -1398,7 +1394,7 @@ mod tests {
         let (client, crate_side) = connect(&control, "eof", Arc::new(TerminalClaim::new()), false)
             .await
             .unwrap();
-        let completion = client.prompt(serde_json::json!({})).await;
+        let completion = client.prompt(serde_json::json!({})).await.unwrap();
         fake.await.unwrap();
         assert!(tokio::time::timeout(Duration::from_secs(1), completion)
             .await
@@ -1413,13 +1409,16 @@ mod tests {
     }
 
     #[tokio::test]
-    async fn attached_session_only_resets_for_missing_session_errors() {
+    async fn attached_session_prompt_errors_reset_tear_down_or_end_the_turn() {
         use crate::acp::acp_client::AcpClient;
         use crate::acp::state::AcpSessionId;
 
-        for (message, should_reset) in [
-            ("Unsupported ACP session", true),
-            ("Unsupported session mode", false),
+        // -32000 alone is not a login: some adapters use it for any failure.
+        for (message, code, want) in [
+            ("Unsupported ACP session", -32603, &["reset", "stopped"][..]),
+            ("Unsupported session mode", -32603, &["rejected"]),
+            ("Authentication required", -32000, &["startup_error"]),
+            ("model overloaded", -32000, &["rejected"]),
         ] {
             let tmp = tempfile::tempdir().unwrap();
             let socket = tmp.path().join("s.sock");
@@ -1452,12 +1451,14 @@ mod tests {
                             ControlBody::PromptCompleted {
                                 prompt_req_id: 1,
                                 outcome: PromptOutcome::Error {
-                                    code: -32603,
+                                    code,
                                     message: message.into(),
                                     data: None,
                                 },
                             }
                         }
+                        // Sent after a plain rejection (#5662).
+                        ControlBody::Cancel => continue,
                         frame => panic!("unexpected resumed-session request: {frame:?}"),
                     };
                     control_protocol::write_frame(&mut peer
```

**File**: `src/acp/acp_client/mod.rs` (modified, +11/-5)
```diff
@@ -79,7 +79,7 @@ use tokio::sync::{mpsc, oneshot, Mutex};
 use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};
 use tracing::Instrument;
 
-use self::commands::{ClientCmd, ConnectMode};
+use self::commands::{ClientCmd, ConnectMode, PromptInput};
 use self::connection::{run_connection_task, ConnectionParams, RunnerLink};
 use self::control::{connect_runner_control_v3, ShutdownControlOnDrop};
 use self::delete::ACP_SESSION_DELETE_TIMEOUT;
@@ -841,8 +841,8 @@ impl AcpClient {
         cmd_tx.send(cmd).await.map_err(|_| AcpError::AgentExited)
     }
 
-    /// Attachments follow the text block. Callers gate kinds on the agent's
-    /// prompt capabilities (#1000).
+    /// Attachments follow the text block, which an attachment-only prompt
+    /// omits. Callers gate kinds on the agent's prompt capabilities (#1000).
     pub async fn send_prompt(
         &self,
         text: &str,
@@ -853,7 +853,9 @@ impl AcpClient {
             return Err(AcpError::NotRunning);
         }
         let mut blocks = Vec::with_capacity(1 + attachments.len());
-        blocks.push(ContentBlock::Text(TextContent::new(text)));
+        if !text.is_empty() || attachments.is_empty() {
+            blocks.push(ContentBlock::Text(TextContent::new(text)));
+        }
         for att in attachments {
             let data = base64::engine::general_purpose::STANDARD.encode(&att.data);
             let mime = att.mime_type.clone();
@@ -870,7 +872,11 @@ impl AcpClient {
                 }
             });
         }
-        self.send_cmd(ClientCmd::Prompt(blocks)).await
+        self.send_cmd(ClientCmd::Prompt(PromptInput {
+            blocks,
+            attachments: attachments.iter().map(AttachmentBlob::to_ref).collect(),
+        }))
+        .await
     }
 
     /// Best-effort `session/cancel`; Ok even with no turn in flight.
```

**File**: `src/acp/acp_client/recovery_tests.rs` (modified, +97/-0)
```diff
@@ -643,3 +643,100 @@ async fn recovered_completion_orders_updates_and_applies_rate_limit_parking() {
         }
     }
 }
+
+/// The runner relays the agent's error answer to `session/prompt`: the turn
+/// surfaces it, returns the prompt as sent (text and attachment refs) and
+/// cancels any leftover agent turn, unless it answers a cancel. The same
+/// connection runs the next prompt (#5662).
+#[tokio::test]
+async fn rejected_prompt_over_the_runner_keeps_the_connection() {
+    let _env = crate::session::test_support::EnvGuard::read_lock();
+    let image = AttachmentBlob {
+        id: "att-1".into(),
+        kind: PromptAttachmentKind::Image,
+        mime_type: "image/png".into(),
+        name: Some("shot.png".into()),
+        data: b"png".to_vec(),
+    };
+    let image_block = serde_json::json!({"type": "image", "data": "cG5n", "mimeType": "image/png"});
+    let text_block = |text: &str| serde_json::json!({"type": "text", "text": text});
+    for (text, with_image, cancel_first, want_blocks) in [
+        ("retry me", false, false, vec![text_block("retry me")]),
+        (
+            "look at this",
+            true,
+            false,
+            vec![text_block("look at this"), image_block.clone()],
+        ),
+        ("", true, false, vec![image_block.clone()]),
+        ("retry me", false, true, vec![text_block("retry me")]),
+    ] {
+        let attachments: &[AttachmentBlob] = if with_image {
+            std::slice::from_ref(&image)
+        } else {
+            &[]
+        };
+        let mut runner = Runner::new();
+        let mut client = runner.attach(false).await;
+        client.send_prompt(text, attachments).await.unwrap();
+        match runner.frame().await {
+            ControlBody::Prompt { request } => {
+                assert_eq!(
+                    request["prompt"],
+                    serde_json::json!(want_blocks),
+                    "{text:?}"
+                );
+            }
+            other => panic!("expected the prompt: {other:?}"),
+        }
+        if cancel_first {
+            client.cancel_prompt().await.unwrap();
+            assert!(matches!(runner.frame().await, ControlBody::Cancel));
+        }
+        runner
+            .send(ControlBody::PromptCompleted {
+                prompt_req_id: 7,
+                outcome: PromptOutcome::Error {
+                    code: -32603,
+                    message: "a turn is already running".into(),
+                    data: None,
+                },
+            })
+            .await;
+        let (mut surfaced, mut returned) = (false, None);
+        let reason = timeout(Duration::from_secs(5), async {
+            loop {
+                match client.next_event().await.expect("connection remains open") {
+                    Event::PromptRuntimeError { message } => {
+                        surfaced = message.contains("a turn is already running");
+                    }
+                    Event::PromptRejected {
+                        text, attachments, ..
+                    } => returned = Some((text, attachments)),
+                    Event::Stopped { reason } => return reason,
+                    _ => {}
+                }
+            }
+        })
+        .await
+        .unwrap();
+        if cancel_first {
+            assert_eq!(reason, "cancelled");
+            assert!(!surfaced && returned.is_none());
+        } else {
+            assert_eq!(reason, "prompt_rejected");
+            assert!(surfaced);
+            let refs: Vec<_> = attachments.iter().map(AttachmentBlob::to_ref).collect();
+            assert_eq!(returned, Some((text.to_string(), refs)), "{text:?}");
+            // The rejection clears a turn the agent may still be running.
+            assert!(matches!(runner.frame().await, ControlBody::Cancel));
+        }
+
+        client.send_prompt("again", &[]).await.unwrap();
+        assert!(matches!(runner.frame().await, ControlBody::Prompt { .. }));
+        runner.complete("end_turn").await;
+        assert_eq!(stopped(&mut client).await, "prompt_complete");
+        assert!(client.control_loss().is_none());
+        client.shutdown().await.unwrap();
+    }
+}
```

**File**: `src/acp/acp_client/reset.rs` (modified, +2/-2)
```diff
@@ -1162,7 +1162,7 @@ done
             .await;
             assert!(matches!(
                 events.last(),
-                Some(Event::PromptRejected { reason, text }) if reason == "agent_busy" && text == "/new"
+                Some(Event::PromptRejected { reason, text, .. }) if reason == "agent_busy" && text == "/new"
             ));
             assert_eq!(requests(&capture, "session/new"), 1);
             let _ = client.shutdown().await;
@@ -1341,7 +1341,7 @@ done
             events_until(&mut client, |e| matches!(e, Event::PromptRejected { .. })).await;
         assert!(matches!(
             rejected.last(),
-            Some(Event::PromptRejected { reason, text }) if reason == "agent_busy" && text == "/new"
+            Some(Event::PromptRejected { reason, text, .. }) if reason == "agent_busy" && text == "/new"
         ));
         std::fs::write(tmp.path().join("capture.ndjson.prompt-release"), "release").unwrap();
         let rest = events_until(&mut client, |e| matches!(e, Event::Stopped { .. })).await;
```

---

### Incident Patch 3: `92fedad0` (2026-11-19)
**Commit Message**: fix(tmux): read tmux queries with the UTF-8 flag (#5852)

* fix(process): read the pane PID with tmux's UTF-8 flag

A tmux client without a UTF-8 locale prints control characters in format
output as `_`, so the tab in the pane PID query came back as `0_<pid>` and
the lookup returned nothing. Kills then skipped the pane's process tree. The
lookup now goes through the query builder, which passes `-u`.

Fixes #5850.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(tmux): give the locale only to a child test process

The pane PID test set and restored LANG, LC_ALL and LC_CTYPE in the test
process itself. Under `cargo test`, which runs tests on threads, any
concurrent test could read or inherit that environment while it was changed.
The test now re-runs itself as a child of the test binary with the C locale
set on that child's command, and leaves its own environment alone.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(tmux): read pane titles with tmux's UTF-8 flag

Without a UTF-8 locale, tmux prints every character outside printable ASCII
in format output as `_`. A pane title such as omp's `π ⠋ working` then read
as underscores, so omp's working rule never match

**File**: `src/process/mod.rs` (modified, +3/-2)
```diff
@@ -897,8 +897,9 @@ fn collect_descendants_from_map(
 pub fn get_pane_pid(session_name: &str) -> Option<u32> {
     let pane = crate::tmux::first_pane_id(session_name)?;
     // The pane id must travel alone: `session:%id` reads as a window
-    // spec and falls back to the window's active pane (tmux 3.7c).
-    let output = crate::tmux::tmux_command()
+    // spec and falls back to the window's active pane (tmux 3.7c). A client
+    // without UTF-8 prints the tab as `_`, so the query passes `-u`.
+    let output = crate::tmux::tmux_query_command()
         .args([
             "display-message",
             "-t",
```

**File**: `src/tmux/mod.rs` (modified, +5/-4)
```diff
@@ -230,10 +230,11 @@ pub(crate) fn tmux_command() -> Command {
 /// non-`ECONNREFUSED` connect failure, and glibc localizes `strerror` by
 /// `LC_MESSAGES`, so on a non-English host the `(No such file or directory)`
 /// ENOENT marker for an absent socket (#3337) would not match. `LC_ALL` is
-/// removed so it cannot override that. Global `-u` forces UTF-8 session names
-/// even when the caller has `LC_CTYPE=C` or when `LC_ALL` was the only UTF-8
-/// locale source. Used by the status-query callers (which classify via
-/// [`tmux_no_server_running`]) and by `kill_session_if_present`. NOT folded into
+/// removed so it cannot override that. Global `-u` keeps format output intact
+/// (separators, session names, pane titles) even when the caller has
+/// `LC_CTYPE=C` or when `LC_ALL` was the only UTF-8 locale source, since tmux
+/// prints anything outside printable ASCII as `_` to a non-UTF-8 client. Used
+/// for every query whose output aoe parses, and by `kill_session_if_present`. NOT folded into
 /// [`tmux_command`]: the interactive attach/switch-client/capture-pane paths must
 /// keep the user's locale for UTF-8 and status-bar rendering, and `-u` would
 /// assert UTF-8 to a terminal that may not be.
```

**File**: `src/tmux/session.rs` (modified, +71/-0)
```diff
@@ -5119,6 +5119,77 @@ mod tests {
         );
     }
 
+    /// #5850: a tmux client without a UTF-8 locale prints every byte outside printable ASCII
+    /// as `_`. The locale reaches only a child test process, never this one's environment.
+    #[test]
+    #[serial_test::serial]
+    fn pane_queries_read_intact_without_a_utf8_locale() {
+        const CHILD: &str = "AOE_TEST_PANE_QUERY_LOCALE_CHILD";
+        if !tmux_available() {
+            eprintln!("Skipping test: tmux not available");
+            return;
+        }
+        if std::env::var_os(CHILD).is_none() {
+            let child = std::process::Command::new(std::env::current_exe().unwrap())
+                .args([
+                    "--exact",
+                    "tmux::session::tests::pane_queries_read_intact_without_a_utf8_locale",
+                    "--nocapture",
+                ])
+                .env(CHILD, "1")
+                .env("LANG", "C")
+                .env("LC_ALL", "C")
+                .env("LC_CTYPE", "C")
+                // tmux treats a set TMUX as UTF-8 before it reads the locale.
+                .env_remove("TMUX")
+                .output()
+                .unwrap();
+            let stdout = String::from_utf8_lossy(&child.stdout);
+            assert!(
+                child.status.success() && stdout.contains("1 passed"),
+                "{stdout}{}",
+                String::from_utf8_lossy(&child.stderr)
+            );
+            return;
+        }
+        let guard = TmuxTestSession::new("aoe_test_pane_query_locale");
+        let session_name = guard.name().to_string();
+        let mut args: Vec<String> = ["new-session", "-d", "-s", &session_name, "sleep 30"]
+            .iter()
+            .map(|arg| arg.to_string())
+            .collect();
+        append_pane_base_index_args(&mut args, &session_name);
+        assert!(crate::tmux::tmux_command()
+            .args(&args)
+            .status()
+            .expect("tmux new-session")
+            .success());
+        let pane = only_pane_id(&session_name);
+        wait_for_pane_command(&pane, "sleep");
+        let title = "π ⠋ working";
+        assert!(crate::tmux::tmux_query_command()
+            .args(["select-pane", "-t", &pane, "-T", title])
+            .status()
+            .expect("set pane title")
+            .success());
+        let pid = pane_field(&pane, "#{pane_pid}");
+        let cases = [
+            (
+                "pane PID",
+                crate::process::get_pane_pid(&session_name).map(|pid| pid.to_string()),
+                pid.as_str(),
+            ),
+            (
+                "pane title",
+                crate::tmux::utils::pane_title(&session_name),
+                title,
+            ),
+        ];
+        for (query, read, expected) in cases {
+            assert_eq!(read.as_deref(), Some(expected), "{query}");
+        }
+    }
+
     #[test]
     #[serial_test::serial]
     /// Regression test for #488: when a user creates a split pane and makes it
```

**File**: `src/tmux/utils.rs` (modified, +3/-3)
```diff
@@ -442,7 +442,7 @@ fn classify_live_panes(succeeded: bool, stdout: &[u8], stderr: &[u8]) -> bool {
 
 pub(crate) fn pane_current_command(session_name: &str) -> Option<String> {
     let first = first_pane_id(session_name)?;
-    crate::tmux::tmux_command()
+    crate::tmux::tmux_query_command()
         .args([
             "display-message",
             "-t",
@@ -466,7 +466,7 @@ pub(crate) fn pane_current_command(session_name: &str) -> Option<String> {
 /// read one way through the poller and another through `aoe session capture`.
 pub(crate) fn pane_title(session_name: &str) -> Option<String> {
     let target = format!("={session_name}:^");
-    crate::tmux::tmux_command()
+    crate::tmux::tmux_query_command()
         .args(["display-message", "-t", &target, "-p", "#{pane_title}"])
         .output()
         .ok()
@@ -488,7 +488,7 @@ pub(crate) fn pane_start_command_is_protected(session_name: &str) -> bool {
         return false;
     };
     let target = first;
-    crate::tmux::tmux_command()
+    crate::tmux::tmux_query_command()
         .args([
             "display-message",
             "-t",
```

**File**: `web/scripts/check-env-isolation.mjs` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@ const TEST_BINARY_READS = new Set([
   "AOE_RECHECK_TEST_CHILD",
   "AOE_TEST_APP_DIR_UMASK_CHILD",
   "AOE_TEST_KILL_LAST_PANE_CHILD",
+  "AOE_TEST_PANE_QUERY_LOCALE_CHILD",
   "AOE_TEST_TMUX_EMPTY_CHILD",
   "AOE_TEST_TMUX_ABSENCE_CHILD",
   "AOE_TEST_TMUX_KILL_CHILD",
```

#### Recent Merged Pull Requests:
- **PR #5873** (2026-11-19): test: de-flake two macOS timing tests (transport deadlines, late group child) (@Seluj78)
- **PR #5872** (2026-11-19): fix(mcp): keep wait_for waiting when the turn-end query fails (@Seluj78)
- **PR #5871** (2026-11-19): docs: drop the nightly not-published note (@Seluj78)
- **PR #5864** (2026-11-19): fix(acp): keep the connection when the agent rejects a prompt (@njbrake)
- **PR #5852** (2026-11-19): fix(tmux): read tmux queries with the UTF-8 flag (@klubrake)
- **PR #5847** (2026-11-19): test(serve): fix the Funnel fixture backend port (@jerome-benoit)

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

## X. containers): share one sandbox image pull per runtime and image

**RULE**:
When implementing operations in `flake.nix`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `03e54bee`: containers): share one sandbox image pull per runtime and image. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `flake.nix`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                ./tests/fixtures/pull-stderr
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `03e54bee` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
