> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source**: github ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Source Version**: `7ad6f46d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T00:23:38.687Z  
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
> **Harvest Timestamp**: 2026-11-13T00:23:38.336Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4240 stars

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
- **Issue #5615** (2026-11-12): **Structured view: session shows Running instead of Waiting while a question is pending, subagent events overwrite the status**
  *Symptoms*: **Note:** Claude handled the investigation and prose via back-and-forth. Idea, decisions, and everything else are mine. — @Seluj78  ## Problem  A structured-view session that is blocked on an AskUserQuestion / elicitation card shows green (Running) in the web UI instead of orange (Waiting). The user is not told the agent needs an answer.  Seen on session `a77f4ac5809f4d4b`: the parent agent launched about 8 review subagents, then asked an AskUserQuestion. The subagents kept running and the row went back to green.  ## Evidence from the affected session  `ElicitationRequested` at seq 2255 (nonce `8b428dc4…`) never gets an `ElicitationResolved`. The three earlier elicitations (seq 667, 1526, 1731) each resolved.  After seq 2255 there are 166 more events:  ``` ToolCallCompleted 104, ToolCallStarted 104, UsageUpdated 4, SubagentUpdated 3, ToolCallUpdated 3 ```  All 106 `ToolCallStarted` events after 2255 carry a `parent_tool_call_id`, so every one is a subagent tool call. The parent emitted no message or thought chunk after the question. Subagents legitimately keep working while the parent waits on the user.  ## Root cause  `sidebar_status()` derives status from a single `sidebar_phase` field and ignores the pending lists (`src/acp/state.rs:1066`):  ```rust match self.sidebar_phase {     SidebarPhase::Error => Status::Error,     SidebarPhase::Waiting => Status::Waiting,     SidebarPhase::Active => Status::Running,     ... ```  `ElicitationRequested` sets `Waiting` (`state.rs:1152`

- **Issue #5608** (2026-11-12): **Terminal sends can type into a shell pane when a stale hook status exists**
  *Symptoms*: `ready_agent_session` (`src/server/api/sessions/ensure.rs`) skips the pane-command shell check whenever `read_hook_status` returns a value. If an agent exits to a shell and the hook status file is stale, the pane counts as ready, so a terminal send or the initial-prompt drain (#5594) can type into a bare shell.  Found by CodeRabbit in review of #5594. Pre-existing behavior shared by every terminal send; not introduced there.  Fix direction: verify `pane_current_command` even when a hook status exists, while keeping readiness for agents whose command does not name them (needs a reliable shell-vs-agent distinction, so removing the skip alone is not enough).  > AI disclosure: filed by Claude Code on behalf of the maintainer.

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

### Incident Patch 1: `ecbf52ef` (2026-11-12)
**Commit Message**: fix(trash): expose safe unfinished-trash retry (#5472)

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
and pane teard

**File**: `docs/api.md` (modified, +14/-0)
```diff
@@ -586,6 +586,12 @@ reservation returns `409`, and a missing conversation or incompatible provider
 returns `400`. CityHall mode refuses canonical forks with `403`. An idempotent
 replay still succeeds when the parent row has since been removed.
 
+At creation admission, an `import_acp_session_id` found already owned is refused
+with `400 create_failed` and the safe message “Import source is already owned by
+an AoE session”. Frozen cleanup ownership covers all tools' current and parked
+ACP IDs, even after an ordinary purge removes the visible row. Unrelated failures
+remain sanitized rather than exposing their internal causes.
+
 **Worktree fields**
 
 | Field | Notes |
@@ -872,6 +878,7 @@ Move a session to Trash. Optional JSON fields:
 | --- | --- | --- |
 | `kill_pane` | `true` | Stop the session's terminal panes during the transition. |
 | `expected_generation` | omitted | Require the selected session's `lifecycle_generation`; a mismatch returns `409 lifecycle_superseded` without mutation. |
+| `expected_profile` | omitted | Require the selected profile as well as the generation; a mismatch returns `409 lifecycle_superseded` without mutation. |
 
 Repeating a completed request for an already-trashed session succeeds without
 repeating teardown or relocation. A fresh lifecycle reservation returns
@@ -887,6 +894,13 @@ preventing explicit Restore or Purge. A retry also settles the transition when
 all known worktree paths are proven absent. Unverified existing paths, unknown
 original locations, and filesystem lookup errors keep the transition protected.
 
+Unfinished Trash exposes Retry and read-only inspection, not record-only removal.
+Retry retains existing lifecycle, native ownership, and filesystem checks. An
+unverified checkout stays visible in Trash until those checks can settle it.
+UI requests capture their original profile, generation, and runtime epoch;
+replacement state requires fresh consent.
+
+
 ## Explicit structured worker stop
 
 `DELETE /api/sessions/:id/acp` is a durable user stop, not a daemon detach. It commits the native stopped/dormant generation before retiring the captured original worker and returns `204` only after retirement is proven. Generic `POST /api/sessions/:id/stop` uses the same structured-worker stop boundary.
```

**File**: `docs/development/internals/structured-view.md` (modified, +13/-0)
```diff
@@ -90,6 +90,19 @@ Per-ID mutation exclusion stays shared with every held or queued operation. Reus
 
 Live owner references include missing descendants and symlink traversal dependencies. Permission errors, symlink loops and non-directory traversal refuse cleanup instead of being treated as absent owners.
 
+### Unfinished Trash recovery
+
+Retry uses the existing Trash lifecycle, not a second cleanup authority.
+An expired reservation can be retried, but a fresh owner remains busy.
+Unknown or unverified checkout ownership remains protected and visible in Trash;
+neither Retry nor read-only inspection authorizes purge or deletes the record.
+Record-only removal is outside this change's scope.
+
+TUI confirmation and palette requests retain original targets and runtime epochs.
+Tests dequeue the actual captured command before dispatching it through the real
+router; expected fixtures are assertions, never substitute operations. Web Restore
+receipts use per-row revisions so an older Retry cannot overwrite restored state.
+
 ## Who owns the state
 
 The daemon folds the event stream once per WebSocket connection into two projections, so clients do not re-derive them:
```

**File**: `docs/structured-view.md` (modified, +19/-2)
```diff
@@ -192,8 +192,25 @@ reload. See [retained history internals](development/internals/structured-view.m
 for the storage and migration contract.
 
 Dialogs close when their target session changes or disappears. Trash context
-menus reject actions if the original session, profile, or lifecycle generation
-changes. Restore and permanent deletion never target a replacement selection.
+menus reject actions if their original session, profile, lifecycle generation,
+or runtime epoch changes. Restore and permanent deletion never target a
+replacement selection.
+
+An unfinished Trash transition offers **Retry Trash** in the TUI context menu and
+web Trash controls. A fresh owner remains busy; an unverified retained checkout
+can still prevent completion. Retry is an explicit management action, never part
+of opening the transcript.
+The TUI command palette exposes Restore and Retry Trash using
+the same lifecycle-gated actions as the context menu. Opening Trash confirmation
+captures its runtime epoch; a daemon replacement invalidates the confirmation.
+Trash remains read-only without discarding untargeted pending composer paste.
+Web recovery lists unfinished members of mixed live/Trash workspaces separately.
+It never retries or restores a live sibling. Restore receipts keep their native
+revision so a late older Retry cannot replace the restored row.
+
+If Retry cannot verify the checkout, keep the record in Trash and inspect its
+retained history read-only. There is no record-only removal action. A fresh
+runtime, profile, or lifecycle generation requires fresh recovery consent.
 
 The reader shows retained ACP history, including events
 recorded before a switch to terminal view. Missing or unreadable event ranges
```

**File**: `src/daemon/wire.rs` (modified, +4/-0)
```diff
@@ -546,6 +546,8 @@ pub struct TrashSessionBody {
     /// Reject a lifecycle change after the caller captured its target.
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub expected_generation: Option<u64>,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub expected_profile: Option<String>,
 }
 
 #[derive(Debug, Serialize, Deserialize)]
@@ -580,9 +582,11 @@ impl Default for TrashSessionBody {
         Self {
             kill_pane: default_kill_pane(),
             expected_generation: None,
+            expected_profile: None,
         }
     }
 }
+
 #[derive(Debug, Default, Clone, Serialize, Deserialize)]
 pub struct DeleteSessionBody {
     #[serde(default)]
```

**File**: `src/server/api/sessions/lifecycle.rs` (modified, +3/-0)
```diff
@@ -752,6 +752,9 @@ pub async fn trash_session(
             if worker_state.cityhall_mode && !row.is_structured() {
                 return Err(LifecycleTargetError::CityHall.into());
             }
+            if body.expected_profile.as_deref().is_some_and(|profile| profile != store.storage().profile()) {
+                return Err(crate::session::LifecycleReservationError::Superseded.into());
+            }
             if body.expected_generation.is_some_and(|generation| generation != row.lifecycle_generation) {
                 return Err(crate::session::LifecycleReservationError::Superseded.into());
             }
```

**File**: `src/server/api/sessions/tests.rs` (modified, +42/-15)
```diff
@@ -1,5 +1,23 @@
 use super::*;
 
+async fn assert_response_status(
+    response: axum::response::Response,
+    expected: StatusCode,
+    context: &str,
+) -> axum::response::Response {
+    if response.status() != expected {
+        let actual = response.status();
+        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
+            .await
+            .unwrap();
+        panic!(
+            "{context}: expected {expected}, got {actual}; sanitized response body: {}",
+            String::from_utf8_lossy(&body)
+        );
+    }
+    response
+}
+
 #[tokio::test]
 #[serial_test::serial]
 async fn structured_purge_waits_for_a_pending_runner_retirement() -> anyhow::Result<()> {
@@ -1278,17 +1296,22 @@ async fn metadata_commit_rejects_partial_rows_without_rewriting_them() -> anyhow
 
 #[tokio::test]
 #[serial_test::serial]
-async fn trash_preserves_idempotency_and_rejects_stale_generations() -> anyhow::Result<()> {
+async fn trash_preserves_idempotency_and_rejects_stale_generations_or_profiles(
+) -> anyhow::Result<()> {
     use crate::session::LifecycleOperation;
-    for (already_trashed, precondition, omit_body, peer) in [
-        (false, true, false, None),
-        (true, true, false, None),
-        (true, false, false, None),
-        (true, false, true, None),
-        (true, false, false, Some(LifecycleOperation::Purge)),
-        (true, false, false, Some(LifecycleOperation::Trash)),
+    for (already_trashed, precondition, omit_body, peer, wrong_profile) in [
+        (false, true, false, None, false),
+        (true, true, false, None, false),
+        (true, false, false, None, false),
+        (true, false, true, None, false),
+        (true, false, false, Some(LifecycleOperation::Purge), false),
+        (true, false, false, Some(LifecycleOperation::Trash), false),
+        (false, false, false, None, true),
+        (true, false, false, None, true),
     ] {
         let _guard = crate::session::test_support::isolate_app_dir();
+        crate::session::purge_owners::initialize(&crate::session::get_app_dir()?)?;
+        crate::tmux::tool_retirement::initialize(&crate::session::get_app_dir()?)?;
         let mut row = Instance::new("stale trash", "/tmp/stale-trash");
         row.source_profile = "receipt".into();
         let expected_generation = row.lifecycle_generation;
@@ -1319,19 +1342,22 @@ async fn trash_preserves_idempotency_and_rejects_stale_generations() -> anyhow::
             (!omit_body).then_some(Json(TrashSessionBody {
                 kill_pane: true,
                 expected_generation: precondition.then_some(expected_generation),
+                expected_profile: wrong_profile.then(|| "different-profile".into()),
             })),
         )
         .await
         .into_response();
-        assert_eq!(
-            response.status(),
-            if precondition || peer.is_some() {
+        let response = assert_response_status(
+            response,
+            if precondition || peer.is_some() || wrong_profile {
                 StatusCode::CONFLICT
             } else {
                 StatusCode::OK
-            }
-        );
-        if precondition {
+            },
+            "Trash generation/idempotency",
+        )
+        .await;
+        if precondition || wrong_profile {
             assert_eq!(
                 response.headers()[crate::daemon::ERROR_CODE_HEADER],
                 crate::daemon::ApiErrorCode::LifecycleSuperseded.as_str()
@@ -1344,7 +1370,7 @@ async fn trash_preserves_idempotency_and_rejects_stale_generations() -> anyhow::
             );
         }
         assert_eq!(std::fs::read(storage.sessions_path())?, before);
-        if precondition || peer.is_some() {
+        if precondition || peer.is_some() || wrong_profile {
             assert!(!response
                 .headers()
                 .contains_key(crate::daemon::RUNTIME_REVISION_HEADER));
@@ -1790,6 +1816,7 @@ async fn trash_retry_finishes_expired_transition_after_startup() -> anyhow::Resu
             Some(Json(TrashSessionBody {
                 kill_pane: true,
                 expected_generation: Some(generation),
+                expected_profile: None,
             })),
         )
         .await
```

**File**: `src/tui/dialogs/context_menu.rs` (modified, +34/-12)
```diff
@@ -1,5 +1,4 @@
-//! Small popup menu anchored at a screen position, used for right-click
-//! context actions on the sidebar list (Rename / Delete).
+//! Context actions anchored to a sidebar row.
 
 use crossterm::event::{KeyCode, KeyEvent};
 use ratatui::prelude::*;
@@ -49,6 +48,14 @@ pub enum ContextMenuAction {
     ToggleSectionCollapse,
     /// Restore a trashed session.
     Restore,
+    RetryTrash,
+}
+
+pub struct SessionMenuTarget {
+    pub id: String,
+    pub profile: String,
+    pub generation: u64,
+    pub epoch: Option<String>,
 }
 
 pub struct ContextMenuDialog {
@@ -61,7 +68,7 @@ pub struct ContextMenuDialog {
     anchor: (u16, u16),
     /// Last rendered rect, so click-outside needs no layout math.
     last_area: Rect,
-    session_target: Option<(String, String, u64)>,
+    session_target: Option<SessionMenuTarget>,
 }
 
 /// The menu item at `(col, row)`, or `None` on any border, past the last item,
@@ -142,23 +149,37 @@ impl ContextMenuDialog {
         self
     }
 
-    /// A trashed row can only come back out or be deleted for good.
-    pub fn for_trashed_session(anchor: (u16, u16)) -> Self {
+    pub fn for_trashed_session(anchor: (u16, u16), unfinished: bool) -> Self {
         Self::new(
             anchor,
-            vec![
-                (ContextMenuAction::Restore, "Restore"),
-                (ContextMenuAction::Delete, "Delete"),
-            ],
+            if unfinished {
+                vec![(ContextMenuAction::RetryTrash, "Retry Trash")]
+            } else {
+                vec![
+                    (ContextMenuAction::Restore, "Restore"),
+                    (ContextMenuAction::Delete, "Delete"),
+                ]
+            },
         )
     }
 
-    pub fn with_session_target(mut self, id: &str, profile: &str, generation: u64) -> Self {
-        self.session_target = Some((id.to_owned(), profile.to_owned(), generation));
+    pub fn with_session_target(
+        mut self,
+        id: &str,
+        profile: &str,
+        generation: u64,
+        epoch: Option<&str>,
+    ) -> Self {
+        self.session_target = Some(SessionMenuTarget {
+            id: id.to_owned(),
+            profile: profile.to_owned(),
+            generation,
+            epoch: epoch.map(str::to_owned),
+        });
         self
     }
 
-    pub fn session_target(&self) -> Option<&(String, String, u64)> {
+    pub fn session_target(&self) -> Option<&SessionMenuTarget> {
         self.session_target.as_ref()
     }
 
@@ -168,6 +189,7 @@ impl ContextMenuDialog {
                 action,
                 ContextMenuAction::Restore
                     | ContextMenuAction::Delete
+                    | ContextMenuAction::RetryTrash
                     | ContextMenuAction::NewSession
                     | ContextMenuAction::OpenSortPicker
                     | ContextMenuAction::OpenGroupPicker
```

**File**: `src/tui/home/bindings.rs` (modified, +30/-0)
```diff
@@ -99,6 +99,8 @@ pub enum ActionId {
     AutoName,
     /// Permanently purge every trashed session after a confirm (palette only; no chord).
     EmptyTrash,
+    RestoreTrash,
+    RetryTrash,
     ToggleSplitTerminal,
     /// Open the command palette (any hotkey mode).
     OpenCommandPalette,
@@ -127,6 +129,8 @@ impl ActionId {
                 | Self::RespondToPermission
                 | Self::Stop
                 | Self::Delete
+                | Self::RestoreTrash
+                | Self::RetryTrash
                 | Self::Rename
                 | Self::SetWorktreeName
                 | Self::AddProject
@@ -1253,6 +1257,30 @@ pub static BINDINGS: &[Binding] = &[
             group: PaletteGroup::Actions,
         }),
     },
+    Binding {
+        id: ActionId::RestoreTrash,
+        non_strict: &[],
+        strict: &[],
+        context: Context::Always,
+        help: None,
+        palette: Some(PaletteMeta {
+            title: "Restore selected Trash session",
+            keywords: &["trash", "restore", "recovery"],
+            group: PaletteGroup::Actions,
+        }),
+    },
+    Binding {
+        id: ActionId::RetryTrash,
+        non_strict: &[],
+        strict: &[],
+        context: Context::Always,
+        help: None,
+        palette: Some(PaletteMeta {
+            title: "Retry selected unfinished Trash session",
+            keywords: &["trash", "retry", "recovery"],
+            group: PaletteGroup::Actions,
+        }),
+    },
     // The mnemonic keys (a/A, n/N, r/R, t/T) are taken and the home keyspace is saturated
     // (see Fork), so "Auto-name now" lands on the free v/V pair. Gated to a
     // still-default-named session by the daemon handler.
@@ -1338,6 +1366,8 @@ pub fn palette_id(id: ActionId) -> &'static str {
         ActionId::Fork => "fork",
         ActionId::AutoName => "auto-name",
         ActionId::EmptyTrash => "empty-trash",
+        ActionId::RestoreTrash => "restore-trash",
+        ActionId::RetryTrash => "retry-trash",
         ActionId::OpenCommandPalette => "command-palette",
         ActionId::DismissUpdateBanner => "dismiss-update-banner",
         ActionId::PreviewScrollUp => "preview-scroll-up",
```

---

### Incident Patch 2: `6bccd48f` (2026-11-12)
**Commit Message**: fix(acp): preserve live runners across control channel loss (#5254)

* fix(acp): reattach a live runner after only its control channel closes

When the runner side closed the daemon's control connection while the runner
and its agent stayed alive, the daemon reported a generic transport closure,
ended the in-flight turn as complete, and the drain replaced the runner, which
killed the agent and its running command.

The daemon now records that the runner ended the channel (EOF or I/O error,
not a local close or an undecodable frame), keeps the turn open, and the drain
redials the same runner under the same lease when its exact identity is live,
bounded by attempts, a per-attempt deadline and the respawn budget. A dead or
replaced runner, a protocol failure, a stop or a lost lease keeps the existing
stop, park or replacement path. The runner's write failure now reports timeout
versus I/O error kind, frame size and queue depth, without payloads.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(acp): drain replay while confirming runner reattachment

Return the reattached event receiver before resume publishes retained output. Keep the supervisor pumping while it waits for th

**File**: `docs/development/internals/structured-view.md` (modified, +2/-1)
```diff
@@ -23,7 +23,8 @@ Invariants worth knowing before touching this code:
 - **Borrowed attachment.** Before installation, timeout or waiter drop releases only the attempted connection and reservation. Retry preserves the original runner and turn. Explicit stop claims the captured original before waking its handshake. A captured stop may displace an uninstalled observer, never an installed replacement.
 - **Exact scope retirement.** Scoped runners persist their exact transient unit alongside PID and generation; unscoped and unresolved ownership are distinct. Explicit stop waits for only the captured unit to stop and become empty before settling. Rejected or timed-out scope retirement keeps its lease and retry debt, even after the leader exits. A SID wildcard never authorizes ACP retirement or recovered purge cleanup.
 - **Callback parity and replay accounting.** Session-scoped filesystem, terminal, and permission callbacks wait for that announcement with either named or positional parameters, while request-scoped elicitation stays independent of session authority. Pending replay charges each original control frame, its four-byte prefix included, against the runner's 4096-frame / 128 MiB budget; typed re-serialization can expand native JSON and is not a substitute.
-- **Mid-turn reattach.** `ResumeSession` adopts the runner's committed session identity and never sends ACP `session/new` or `session/load`. A new local prompt supersedes adoption, and only the matching canonical request id may resolve it; a 30-second resume-idle watchdog is the fallback.
+- **Mid-turn reattach.** `ResumeSession` adopts the runner's committed session identity and never sends ACP `session/new` or `session/load`. A new local prompt supersedes adoption, and only the matching canonical request id may resolve it. After a daemon restart, a 30-second resume-idle watchdog is the fallback; a same-runner recovery (below) does not arm it, because the reattached runner still reports the turn's real completion. Cancel on an adopted turn follows the normal 10-second escalation: if the turn has not ended by then, it stops as `agent_unresponsive` and the drain kills the runner.
+- **Control-channel recovery.** When a live runner closes only its control channel, the drain dials the same runner under the same lease instead of replacing it, so the agent and its turn survive. Recovery requires the registry record to still belong to the captured runner identity and be live; Native Prime runners, explicit stops and connections that ended with `agent_unresponsive`, `prompt_orphaned` or `user_forced` keep the existing replacement or stop path. Starting a recovery records one restart in the shared respawn window (3 per 60 seconds) and is refused when the window is full, so a channel that keeps closing ends in the ordinary park. Each recovery makes at most 3 attempts, each bounded by a 3-second resume deadline, with the respawn backoff between them. A confirmed resume publishes its whole replay without the attempt deadline cutting it off, and a refused resume consumes an attempt. When recovery is refused or exhausted, the session publishes the original loss: `Stopped { reason: "runner_control_lost" }` if a turn was in flight, then an `AgentStartupError`.
 - **Subagent sessions.** A profile with `supports_subagents` declares the ACP subagents capability, so each subagent is a child session on the same connection. `SessionIngress` admits a child only after a `subagent_update` on an admitted session names it, and answers its permission and elicitation requests but refuses its fs and terminal requests, which assume the root session's workspace. Child traffic takes `handle_child_notification`, never the root's dedup, compaction or watchdog path. The adapter hides the Agent/Task call, so aoe synthesizes the card from the parent-to-child delegation `session_message` (its message id is the card id and the child's `parent_tool_call_id`); the child's reply or hand-back `session_message` completes it, while a background child has none and its card follows the roster state. Only child tool calls and its model reach the transcript, and the tool calls nest under that card via `parent_tool_call_id`. `SubagentUpdated` carries a full merged snapshot, so replay is last-write-wins, and its state replaces the transcript tailer's heuristics for that agent. Stop sends `session/cancel` with the child id over `POST /api/sessions/{id}/acp/subagents/{child_id}/cancel`, or `ControlBody::CancelSession` through a runner (control protocol 4), and only for a child that announced `capabilities.cancel`. A child's own delegations (grandchildren) are not rendered: their `session_message`s are dropped. A conversation reset is refused while a child runs, since it would drop the child routes. Restoring children after `session/load` is not implemented, so an async agent left open by a restart is still resolved by the resumed tailer below.
 - **Background sub-agents across a restart.** The async-Ta
```

**File**: `src/acp/acp_client/commands.rs` (modified, +3/-0)
```diff
@@ -95,5 +95,8 @@ pub(super) enum ConnectMode {
     Resume {
         acp_session_id: String,
         in_flight_turn: bool,
+        /// Confirmation deadline for recovery of the same verified runner.
+        /// Once confirmed, replay and silence belong to the runner's live turn.
+        live_recovery: Option<tokio::time::Instant>,
     },
 }
```

**File**: `src/acp/acp_client/connection/command_loop.rs` (modified, +77/-12)
```diff
@@ -27,6 +27,7 @@ use crate::acp::acp_client::config_options::{
     thought_level_config_id, ConfigOptionDispatchPurpose, SessionChannels,
 };
 use crate::acp::acp_client::control::DaemonControlClient;
+use crate::acp::acp_client::control::{control_outcome_reason, prompt_outcome_to_response};
 use crate::acp::acp_client::delete::handle_delete_session_cmd;
 use crate::acp::acp_client::errors::acp_internal_error;
 use crate::acp::acp_client::lifecycle::LifecycleEnvelope;
@@ -66,6 +67,8 @@ pub(super) struct Session {
 
 impl Session {
     pub(super) async fn send_cancel(&self) -> Result<(), agent_client_protocol::Error> {
+        #[cfg(test)]
+        let _gate = self.shared.cancel_send_gate.read().await;
         match self.control.as_ref() {
             Some(control) => {
                 control.cancel().await;
@@ -144,16 +147,46 @@ impl Session {
         // is serialized with every command.
         let mut idle_tick = tokio::time::interval(BETWEEN_PROMPT_IDLE_CHECK_INTERVAL);
         idle_tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
+        let shared = self.shared.clone();
+        let mut completion = shared.adopted_completion_tx.subscribe();
         loop {
             self.acp_session_id =
                 self.shared.ingress.current().ok_or_else(|| {
                     acp_internal_error("native session is not established".into())
                 })?;
+            let cancel_deadline = *shared.cancel_deadline.lock().unwrap();
             // Fallback prompts go first so later messages cannot overtake them.
             let cmd = match self.pending_prompts.pop_front() {
                 Some(blocks) => Some(ClientCmd::Prompt(blocks)),
                 None => tokio::select! {
+                    biased;
+                    outcome = async {
+                        completion.wait_for(Option::is_some).await.expect("shared owns the completion sender").clone().unwrap()
+                    } => {
+                        shared.adopted_completion_tx.send_replace(None);
+                        if self.finish_adopted_turn(outcome).await {
+                            break;
+                        }
+                        continue;
+                    }
                     cmd = self.cmd_rx.recv() => cmd,
+                    _ = async {
+                        match cancel_deadline {
+                            Some(deadline) => tokio::time::sleep_until(deadline).await,
+                            None => std::future::pending().await,
+                        }
+                    } => {
+                        if shared.prompt_in_flight.swap(false, Ordering::Relaxed)
+                            && shared.terminal_claim.claim()
+                        {
+                            self.stand_down_idle_completion();
+                            *shared.cancel_deadline.lock().unwrap() = None;
+                            shared.publish_terminal("agent_unresponsive".into(), vec![]).await;
+                            break;
+                        }
+                        *shared.cancel_deadline.lock().unwrap() = None;
+                        continue;
+                    }
                     _ = idle_tick.tick() => {
                         if self.between_prompt_idle_tick().await {
                             break;
@@ -175,6 +208,15 @@ impl Session {
                     let _ = respond_to.send(self.cancel_child(session_id).await);
                 }
                 Some(ClientCmd::Cancel) => {
+                    if shared.adopted_turn_active.load(Ordering::Relaxed)
+                        && shared.prompt_in_flight.load(Ordering::Relaxed)
+                        && !shared.terminal_claim.claimed()
+                    {
+                        // Arm first: a control loss during the send keeps the deadline.
+                        self.request_cancel().await;
+                        self.send_cancel().await?;
+                        continue;
+                    }
                     info!(target: "acp.protocol", "sending session/cancel (no prompt in flight)");
                     // Not `?`: a dead connection is when the UI most needs
                     // the synthetic Stopped below.
@@ -189,9 +231,7 @@ impl Session {
                     // a spurious Stopped while idle is a reducer no-op (#2237).
                     self.stand_down_idle_completion();
                     self.shared
-                        .emit(Event::Stopped {
-                            reason: "cancelled".into(),
-                        })
+                        .publish_terminal("cancelled".into(), vec![])
                         .await;
                 }
                 Some(ClientCmd::ForceStop) => {
@@ -246,6 +286,38 @@ impl Session {
         Ok(())
     }
 
+    /// Ends an adopted turn with the runner's reported outcome. Returns `false`
+    /// when the turn was already superseded, ended or claimed elsewhere.
+    async fn finish_adopted_
```

**File**: `src/acp/acp_client/connection/establish.rs` (modified, +45/-14)
```diff
@@ -210,16 +210,17 @@ pub(super) async fn establish(
             "agent supports _session/steering; mid-turn prompts will be injected into the running turn"
         );
     }
-    let arm_resume_watchdog = matches!(
-        &ctx.mode,
+    let (adopted_turn, live_recovery) = match &ctx.mode {
         ConnectMode::Resume {
-            in_flight_turn: true,
+            in_flight_turn,
+            live_recovery,
             ..
-        }
-    );
+        } => (*in_flight_turn, *live_recovery),
+        ConnectMode::Fresh { .. } => (false, None),
+    };
     shared
         .adopted_turn_active
-        .store(arm_resume_watchdog, Ordering::Relaxed);
+        .store(adopted_turn, Ordering::Relaxed);
     info!(
         target: "acp.protocol",
         session = %label,
@@ -259,7 +260,9 @@ pub(super) async fn establish(
         pending_prompts: VecDeque::new(),
     };
     session.acp_session_id = match ctx.mode {
-        ConnectMode::Resume { acp_session_id, .. } => session.resume(acp_session_id).await?,
+        ConnectMode::Resume { acp_session_id, .. } => {
+            session.resume(acp_session_id, live_recovery).await?
+        }
         ConnectMode::Fresh {
             stored_acp_session_id,
             seed_history_replay,
@@ -283,8 +286,14 @@ pub(super) async fn establish(
     session.apply_default_model().await;
     session.apply_default_effort().await;
     session.apply_default_model_config().await;
-    if arm_resume_watchdog {
-        spawn_resume_idle_watchdog(shared);
+    if adopted_turn && live_recovery.is_none() {
+        spawn_resume_idle_watchdog(
+            shared,
+            session
+                .control
+                .as_ref()
+                .map(|control| control.disconnected.clone()),
+        );
     }
     Ok(Some(session))
 }
@@ -303,12 +312,24 @@ fn resume_idle_expired(
 /// Fallback when an adopted turn neither completes nor shows activity, so the
 /// UI cannot stay "thinking" forever. Once the turn is observable, completion
 /// belongs to the between-prompt watchdog.
-fn spawn_resume_idle_watchdog(shared: Arc<Shared>) {
+fn spawn_resume_idle_watchdog(
+    shared: Arc<Shared>,
+    disconnected: Option<tokio_util::sync::CancellationToken>,
+) {
     let grace_ms = resume_idle_grace().as_millis() as i64;
     let interval = resume_idle_check_interval();
     tokio::spawn(async move {
         loop {
-            tokio::time::sleep(interval).await;
+            tokio::select! {
+                biased;
+                _ = async {
+                    match &disconnected {
+                        Some(token) => token.cancelled().await,
+                        None => std::future::pending().await,
+                    }
+                } => return,
+                _ = tokio::time::sleep(interval) => {}
+            }
             if shared.terminal_claim.claimed()
                 || shared.prompt_sent_since_attach.load(Ordering::Relaxed)
             {
@@ -375,9 +396,18 @@ impl Session {
     /// The agent still owns the live session, so no load/new is sent. A prior
     /// daemon's reset may commit after our registry snapshot, so a runner's
     /// cached identity wins.
-    async fn resume(&self, stored: String) -> Result<SessionId, agent_client_protocol::Error> {
+    async fn resume(
+        &self,
+        stored: String,
+        resume_by: Option<tokio::time::Instant>,
+    ) -> Result<SessionId, agent_client_protocol::Error> {
         let runner = match self.control.as_ref() {
-            Some(control) => control.resume_session().await?,
+            Some(control) => match resume_by {
+                Some(deadline) => tokio::time::timeout_at(deadline, control.resume_session())
+                    .await
+                    .map_err(|_| acp_internal_error("runner control resume timed out".into()))??,
+                None => control.resume_session().await?,
+            },
             None => stored.clone(),
         };
         info!(
@@ -397,7 +427,8 @@ impl Session {
                 })
                 .await;
         }
-        // Clears a sticky startup error in the UI; same-id is a no-op server-side.
+        // Confirmed replay must finish despite backpressure or the reattach attempt deadline.
+        // Same-id assignment clears a sticky UI error without a server-side reset.
         let id = SessionId::from(runner);
         self.shared.commit_session(id.clone()).await?;
         Ok(id)
```

**File**: `src/acp/acp_client/connection/mod.rs` (modified, +16/-15)
```diff
@@ -39,7 +39,6 @@ use super::commands::{ClientCmd, ConnectMode};
 use super::control::DaemonControlClient;
 use super::errors::{acp_internal_error, AcpError};
 use super::fs_handlers::{handle_read_text_file, handle_write_text_file};
-use super::lifecycle::TerminalClaim;
 use super::pending::PendingResponders;
 use super::permission_handlers::{handle_elicitation_request, handle_permission_request};
 use super::rate_limit::{captured_rate_limit_resets_at, classify_rate_limit_from_message};
@@ -48,7 +47,7 @@ use super::terminal_handlers::{
     handle_create_terminal, handle_kill_terminal, handle_release_terminal, handle_terminal_output,
     handle_wait_for_terminal_exit,
 };
-use super::SessionResources;
+use super::{SessionResources, SessionState};
 use notifications::Shared;
 
 /// After a cancel, declare the adapter unresponsive if no prompt response
@@ -62,9 +61,7 @@ pub(super) type ReadyTx = Mutex<Option<oneshot::Sender<Result<(), AcpError>>>>;
 
 pub(super) struct RunnerLink {
     pub(super) control: Arc<DaemonControlClient>,
-    /// Shared with the control reader, which claims an adopted turn's
-    /// completion so the fallback watchdogs stand down.
-    pub(super) terminal_claim: Arc<TerminalClaim>,
+    pub(super) state: Arc<SessionState>,
     pub(super) prompt_in_flight: Arc<AtomicBool>,
 }
 
@@ -163,13 +160,9 @@ pub(super) async fn run_connection_task<W, R>(
     } = params;
     let label = resources.label.clone();
     let (lifecycle_tx, lifecycle_rx) = mpsc::channel(128);
-    let (control, terminal_claim, prompt_in_flight) = match runner {
-        Some(r) => (Some(r.control), r.terminal_claim, r.prompt_in_flight),
-        None => (
-            None,
-            Arc::new(TerminalClaim::new()),
-            Arc::new(AtomicBool::new(false)),
-        ),
+    let (control, state, prompt_in_flight) = match runner {
+        Some(r) => (Some(r.control), r.state, r.prompt_in_flight),
+        None => (None, Arc::default(), Arc::new(AtomicBool::new(false))),
     };
     let _control_shutdown = super::control::ShutdownControlOnDrop(control.clone());
     // A runner owns identity across daemons, so its ingress is the one that
@@ -194,7 +187,7 @@ pub(super) async fn run_connection_task<W, R>(
         label.clone(),
         profile,
         lifecycle_tx,
-        terminal_claim,
+        state,
         prompt_in_flight,
         resources.sandbox.as_ref(),
         ingress.clone(),
@@ -232,7 +225,10 @@ pub(super) async fn run_connection_task<W, R>(
                             }
                             SessionIngressNotification::PromptCompleted(marker) => {
                                 if let Some(control) = control.as_ref() {
-                                    control.deliver_prompt_completion(marker);
+                                    if let Some(outcome) = control.deliver_prompt_completion(marker)
+                                    {
+                                        shared.adopted_completion_tx.send_replace(Some(outcome));
+                                    }
                                 }
                                 return Ok(());
                             }
@@ -409,6 +405,7 @@ pub(super) async fn run_connection_task<W, R>(
         ),
     );
 
+    let control_for_report = control.clone();
     let establish_ctx = establish::EstablishCtx {
         shared: shared.clone(),
         control: control.clone(),
@@ -449,8 +446,9 @@ pub(super) async fn run_connection_task<W, R>(
         )
         .await;
 
+    let control_lost = control_for_report.is_some_and(|control| control.lost());
     if let Err(e) = &result {
-        report_connection_error(e, &shared, &ready_tx).await;
+        report_connection_error(e, &shared, &ready_tx, control_lost).await;
     } else {
         info!(target: "acp.protocol", session = %label, "ACP connection task ended cleanly");
     }
@@ -481,6 +479,7 @@ async fn report_connection_error(
     e: &agent_client_protocol::Error,
     shared: &Shared,
     ready_tx: &ReadyTx,
+    control_lost: bool,
 ) {
     let label = &shared.session_label;
     let event_tx = &shared.event_tx;
@@ -510,6 +509,8 @@ async fn report_connection_error(
             None => AcpError::Spawn(message),
         };
         let _ = tx.send(Err(err));
+    } else if control_lost {
+        // The supervisor decides between reattaching and reporting the loss.
     } else if let Some(info) = rate_limit {
         info!(
             target: "acp.protocol",
```

**File**: `src/acp/acp_client/connection/notifications.rs` (modified, +28/-6)
```diff
@@ -11,7 +11,7 @@ use agent_client_protocol::v1::schema::{
 use std::collections::HashMap;
 use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU64, Ordering};
 use std::sync::Arc;
-use tokio::sync::mpsc;
+use tokio::sync::{mpsc, watch};
 use tracing::debug;
 
 use crate::acp::acp_client::aoe_ingress::{AoeIngress, Ingested};
@@ -32,6 +32,8 @@ use crate::acp::acp_client::update_events::{
     CompactionFold, CompactionTracker,
 };
 use crate::acp::acp_client::watchdog::classify_watchdog_notification_signals;
+use crate::acp::acp_client::SessionState;
+use crate::acp::control_protocol::PromptOutcome;
 
 pub(super) fn now_ms() -> i64 {
     chrono::Utc::now().timestamp_millis()
@@ -75,7 +77,11 @@ pub(super) struct Shared {
     /// Reset epochs (unix seconds) per rejected quota window. Cleared at each
     /// prompt and drained when a turn parks; a window that later reports a
     /// non-rejected status is removed (#3028, #3152).
-    pub(super) rate_limit_rejections: std::sync::Mutex<HashMap<String, i64>>,
+    pub(super) rate_limit_rejections: Arc<std::sync::Mutex<std::collections::HashMap<String, i64>>>,
+    pub(super) cancel_deadline: Arc<std::sync::Mutex<Option<tokio::time::Instant>>>,
+    #[cfg(test)]
+    pub(super) cancel_send_gate: Arc<tokio::sync::RwLock<()>>,
+    pub(super) adopted_completion_tx: watch::Sender<Option<PromptOutcome>>,
     /// A stored-session rejection already emitted its context reset.
     pub(super) context_reset_emitted: AtomicBool,
     /// Scoped to one turn; see `AgentMessageDedup` (#2281).
@@ -97,7 +103,7 @@ impl Shared {
         session_label: String,
         profile: &'static AgentProfile,
         lifecycle_tx: mpsc::Sender<LifecycleEnvelope>,
-        terminal_claim: Arc<TerminalClaim>,
+        state: Arc<SessionState>,
         prompt_in_flight: Arc<AtomicBool>,
         sandbox: Option<&SessionSandbox>,
         ingress: Arc<SessionIngress>,
@@ -122,13 +128,17 @@ impl Shared {
             last_event_at: AtomicI64::new(now_ms()),
             first_event_after_attach: AtomicBool::new(false),
             prompt_sent_since_attach: AtomicBool::new(false),
-            terminal_claim,
+            terminal_claim: state.terminal_claim.clone(),
             adopted_turn_active: AtomicBool::new(false),
             prompt_in_flight,
             prompt_epoch: AtomicU64::new(0),
             lifecycle_tx,
             between_prompt: BetweenPromptTracker::default(),
-            rate_limit_rejections: Default::default(),
+            rate_limit_rejections: state.rate_limit_rejections.clone(),
+            cancel_deadline: state.cancel_deadline.clone(),
+            #[cfg(test)]
+            cancel_send_gate: state.cancel_send_gate.clone(),
+            adopted_completion_tx: watch::channel(None).0,
             context_reset_emitted: AtomicBool::new(false),
             agent_msg_dedup: Default::default(),
             compaction: Default::default(),
@@ -145,6 +155,18 @@ impl Shared {
         let _ = self.event_tx.send(event).await;
     }
 
+    /// A claimed terminal must reach the drain even if SDK teardown cancels its caller.
+    pub(super) async fn publish_terminal(&self, reason: String, preceding: Vec<Event>) {
+        let event_tx = self.event_tx.clone();
+        let publication = tokio::spawn(async move {
+            for event in preceding {
+                let _ = event_tx.send(event).await;
+            }
+            let _ = event_tx.send(Event::Stopped { reason }).await;
+        });
+        let _ = publication.await;
+    }
+
     /// Publish the native session the lifecycle selected and apply the
     /// updates buffered while it was still pending.
     pub(super) async fn commit_session(
@@ -526,7 +548,7 @@ mod tests {
             "s-echo".to_string(),
             &crate::acp::agent_profiles::CLAUDE,
             lifecycle_tx,
-            Arc::new(TerminalClaim::new()),
+            Arc::new(SessionState::default()),
             Arc::new(AtomicBool::new(prompt_in_flight)),
             None,
             Arc::new(SessionIngress::new(Some(SessionId::from("native")))),
```

**File**: `src/acp/acp_client/connection/prompt.rs` (modified, +81/-57)
```diff
@@ -9,6 +9,7 @@ use std::collections::VecDeque;
 use std::future::Future;
 use std::pin::Pin;
 use std::sync::atomic::Ordering;
+use std::sync::Arc;
 use std::time::Duration;
 use tokio::time::{Instant, Sleep};
 use tracing::{debug, info, trace, warn};
@@ -76,7 +77,7 @@ enum Flow {
 #[derive(Default)]
 struct TurnFlags {
     shutdown: bool,
-    rate_limited: bool,
+    rate_limit: Option<RateLimitInfo>,
     force_stopped: bool,
     prompt_orphaned: bool,
     agent_unresponsive: bool,
@@ -109,11 +110,9 @@ impl Turn {
             .apply_signal(signal, Instant::now(), chrono::Utc::now(), self.cfg);
     }
 
-    fn start_cancel_grace(&mut self) {
+    fn start_cancel_grace(&mut self, deadline: Instant) {
         self.flags.cancelling = true;
-        self.cancel_grace
-            .as_mut()
-            .reset(Instant::now() + CANCEL_ESCALATION_GRACE);
+        self.cancel_grace.as_mut().reset(deadline);
     }
 }
 
@@ -183,6 +182,7 @@ impl Session {
         shared.terminal_claim.begin_turn();
         shared.between_prompt.reset_for_prompt();
         clear_captured_rejections(&shared.rate_limit_rejections);
+        *shared.cancel_deadline.lock().unwrap() = None;
         info!(target: "acp.protocol", "sending prompt ({} content blocks)", blocks.len());
         // Bump the epoch before sending so envelopes from a handler parked on
         // the previous prompt are discarded.
@@ -283,10 +283,18 @@ impl Session {
         match serde_json::to_value(request) {
             Ok(params) => {
                 let rx = control.prompt(params).await;
+                let control = Arc::clone(control);
                 Box::pin(async move {
-                    // A closed channel ends the turn; the dying connection
-                    // surfaces the underlying failure.
-                    prompt_outcome_to_response(rx.await.unwrap_or(PromptOutcome::Aborted))
+                    match rx.await {
+                        Ok(outcome) => prompt_outcome_to_response(outcome),
+                        // The runner may still own the turn, so it stays open
+                        // for a reattach instead of ending here.
+                        Err(_) if control.lost() => {
+                            Err(acp_internal_error("runner control channel lost".into()))
+                        }
+                        // The dying connection surfaces the underlying failure.
+                        Err(_) => prompt_outcome_to_response(PromptOutcome::Aborted),
+                    }
                 })
             }
             Err(e) => {
@@ -320,38 +328,20 @@ impl Session {
         turn: &mut Turn,
         res: AcpResult<PromptResponse>,
     ) -> AcpResult<Flow> {
+        if let Ok(response) = &res {
+            turn.flags.prompt_cancelled = matches!(response.stop_reason, StopReason::Cancelled);
+            turn.flags.agent_stop_reason = Some(response.stop_reason);
+        }
+        if let Some(info) = self.completion_rate_limit(&res) {
+            turn.flags.rate_limit = Some(info);
+            turn.flags.shutdown = true;
+            return Ok(Flow::Break);
+        }
         let e = match res {
-            Ok(resp) => {
-                turn.flags.prompt_cancelled = matches!(resp.stop_reason, StopReason::Cancelled);
-                turn.flags.agent_stop_reason = Some(resp.stop_reason);
-                if !turn.flags.prompt_cancelled {
-                    if let Some(info) = self.take_parking_rejection() {
-                        self.shared.emit(Event::RateLimit { info }).await;
-                        turn.flags.rate_limited = true;
-                        turn.flags.shutdown = true;
-                    }
-                }
-                return Ok(Flow::Break);
-            }
+            Ok(_) => return Ok(Flow::Break),
             Err(e) => e,
         };
         let label = &self.shared.session_label;
-        // A rate limit parks the session rather than burning restart budget
-        // on a worker that would hit it again (#1281).
-        let resets_at =
-            captured_rate_limit_resets_at(&self.shared.rate_limit_rejections, chrono::Utc::now());
-        if let Some(info) = classify_rate_limit_error(&e, resets_at) {
-            info!(
-                target: "acp.protocol",
-                session = %label,
-                resets_at = ?info.resets_at,
-                "session/prompt returned rate_limit; parking session"
-            );
-            self.shared.emit(Event::RateLimit { info }).await;
-            turn.flags.rate_limited = true;
-            turn.flags.shutdown = true;
-            return Ok(Flow::Break);
-        }
         // A resumed id the agent dropped: reset context so the respawn opens
         // a fresh session instead of terminating the runner (#3560).
         if self.session_from_storage && is_unsupported_session_error(&e) {
@@ -375,8 +365,24 @@ impl Session {
 
     /// The adapter can end a limited turn normally, so a still-future reje
```

**File**: `src/acp/acp_client/connection/subagents.rs` (modified, +4/-4)
```diff
@@ -283,8 +283,8 @@ impl Shared {
 #[cfg(test)]
 mod tests {
     use super::*;
-    use crate::acp::acp_client::lifecycle::TerminalClaim;
     use crate::acp::acp_client::session_identity::SessionIngress;
+    use crate::acp::acp_client::SessionState;
     use crate::acp::agent_profiles::CLAUDE;
     use agent_client_protocol::v1::schema::SessionNotification;
     use std::sync::atomic::AtomicBool;
@@ -347,7 +347,7 @@ mod tests {
             "test".into(),
             &CLAUDE,
             lifecycle_tx,
-            Arc::new(TerminalClaim::new()),
+            Arc::new(SessionState::default()),
             Arc::new(AtomicBool::new(false)),
             None,
             ingress.clone(),
@@ -536,7 +536,7 @@ mod tests {
             "test".into(),
             &CLAUDE,
             lifecycle_tx,
-            Arc::new(TerminalClaim::new()),
+            Arc::new(SessionState::default()),
             Arc::new(AtomicBool::new(false)),
             None,
             ingress.clone(),
@@ -593,7 +593,7 @@ mod tests {
             "test".into(),
             &CLAUDE,
             lifecycle_tx,
-            Arc::new(TerminalClaim::new()),
+            Arc::new(SessionState::default()),
             Arc::new(AtomicBool::new(false)),
             None,
             ingress.clone(),
```

---

### Incident Patch 3: `a4a7d3aa` (2026-11-12)
**Commit Message**: fix(tui): keep Serve work off the event loop (#5442)

* fix(tui): keep Serve work off the event loop

Run Serve observations and recovery commands through a bounded, attempt-scoped executor. Keep admitted mutations owned through completion and verify captured Daemon identity under the lifecycle transaction before stop or reset effects.

Capture launch diagnostics on their existing owner and keep errors visible while recovery identity loads. Bound probe/reset subprocesses and cover held work, supersession, channel closure and restart reconfirmation.

Fixes #4779

Refs #2734, #3898

* fix(tui): restore recovery after a failed stop

A reopened owned launch has not populated its recovery target. After S-stop fails, load missing identity in the background while retaining the failure. Keep a known identity unchanged so retry cannot adopt a successor.

Cover P and R recovery after stop failure on a reopened launch.

* test(tui): wait for restart confirmation

The Local restart helper's RR batch confirms before the asynchronous assessment has produced a confirmation. Send R without a synthetic input fence, observe confirmation, then confirm.

Keep successor and credential assertions intact

**File**: `.github/workflows/tests.yml` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ jobs:
           cargo test --features web,e2e-tests \
             --test integration -- daemon_core_web_optional plugin_install
           cargo test --features web,e2e-tests --lib -- \
-            server::assets:: tui::dialogs::serve::qr_seam \
+            server::assets:: tui::dialogs::serve::tests::held_work_leaves_keys_clicks_ticks_and_render_usable \
             session::config::tests::web_plugin_changes_do_not_cross_lifecycle_transactions
       # macOS reaches its per-user temp root through a symlink, so a test that
       # compares `TempDir::path()` against a path that has been through
```

**File**: `docs/development.md` (modified, +11/-0)
```diff
@@ -23,6 +23,17 @@ The core-rest CI leg requires the scoped cancellation case to run with
 may skip the scoped case when no usable user manager exists; unscoped
 cancellation still runs.
 
+The process-inspection executor test is ignored by default on Linux because it
+requires Python 3 and private user, mount and PID namespaces. Run it explicitly
+on a host that supports `unshare`:
+
+```sh
+cargo test --lib cli::serve::tests::tui_control_inspection_keeps_the_async_executor_reactive -- --exact --ignored --nocapture
+```
+
+Missing prerequisites fail explicit Linux runs. On macOS this test runs by
+default and requires Python 3, so a missing `python3` also fails normal test runs.
+
 Creation-progress events are advisory and publish independently of session
 snapshots. Tests that need a published session must wait for its ID in the
 canonical snapshot. Hold in-flight fixture gates until explicit release, with
```

**File**: `docs/guides/web-dashboard.md` (modified, +18/-2)
```diff
@@ -67,11 +67,27 @@ An explicit `aoe serve` request enables Web serving by replacing a managed priva
 
 An absent daemon is different from a restart: the next autostart resolves current configuration, not the vanished daemon's recorded exposure flags. It does not restore a previous LAN bind or tunnel. Persisted Web serving and Tunnel settings remain tracked separately in [#4476](https://github.com/agent-of-empires/agent-of-empires/issues/4476).
 
-Local restarts from the TUI preserve the running dashboard's effective passphrase, including when a newly opened TUI has no `AOE_SERVE_PASSPHRASE` variable. Restart refuses before stopping the running Daemon if its required credential cannot be recovered. Generating a new Tunnel passphrase explicitly replaces that credential.
+TUI restarts preserve the running dashboard's effective passphrase, including when a newly opened TUI has no `AOE_SERVE_PASSPHRASE` variable. A temporarily unavailable runtime credential never substitutes a saved launch default. Restart refuses before stopping the running Daemon if its required credential cannot be recovered. Generating a new Tunnel passphrase saves the new default only after successful startup or verification that a running Daemon uses it. Failed startup without such a Daemon preserves the saved default.
 
 The retained launch and credential stay private (`0600`). Restart or rollback consumes them only after readiness; failed replay retains them. Promotion to Web serving does not consume the private-API recovery pair. Stop foreground or service-supervised processes through their owning shell or manager before rollback replaces them.
 
-When the TUI starts or restarts a dashboard, its Remote Access view stays open while the Daemon changes. The TUI accepts exactly one verified successor connection for that request. Existing form and paste drafts stay in memory; native attach and live-send continuations stop. Pending changes with an unknown outcome stay blocked and are never replayed automatically. A failed start remains visible in Remote Access; close it and reconnect explicitly after repairing the cause. Stop remains responsive while startup settles: the TUI stops asynchronously afterward and does not reconnect or queue another start. Closing Remote Access does not discard other drafts.
+When the TUI starts, restarts or reconnects to a dashboard, Remote Access stays responsive during process-identity checks and its elapsed clock keeps advancing. The TUI accepts one verified successor connection and binds the launch result's URLs and credentials to that incarnation. Existing form and paste drafts stay in memory; native attach and live-send continuations stop. Pending changes with an unknown outcome stay blocked and never replay automatically. Closing Remote Access preserves these drafts and does not cancel an owned launch. A failed start remains visible; repair the cause and reconnect explicitly. Stop during startup waits for launch settlement, then stops only its verified incarnation without reconnecting or queueing another start. A Client reconnect failure retains any verified receipt. Reopening during an App-owned Stop follows the same operation to completion.
+
+`S` requires verified control identity: the current view's observation or its owned launch receipt. A replaced or unverified target produces a stop error, not a fresh namespace lookup. Without a verified target or an App-owned launch, refusal leaves the existing runtime connection intact.
+
+Reopening Remote Access reads the current Daemon's runtime credential, not a saved launch default. Observations reject replacement Daemons. A verified startup exit searches current and retained rotated logs for that process's physical start marker. Without a match, recent context is labelled unattributed and may include earlier runs. The context is shared with other AoE processes, not exclusively that Daemon's output. It does not establish a bind failure or invalidate the saved port for future launches. Error recovery offers Funnel reset only for a known Tailscale transport, never based on shared text. The bounded error excerpt keeps entry beginnings, not complete oversized lines. Use `aoe logs` to inspect the shared log.
+
+If a Tunnel runtime credential is temporarily unavailable, Remote Access retries in the background for the same Daemon incarnation. Published URLs stay usable; recovering the credential does not require closing the dialog.
+
+When Remote Access opens or returns to the mode picker, it re-observes the Daemon after checking availability. A dashboard started by another Client during those checks opens directly instead of offering another start.
+
+Nonregular `serve.pid` metadata is preserved as unverifiable state, not treated as an absent Daemon. Repair it before retrying control.
+
+Availability, provider and restart checks run in the background. Current links, credentials, copy controls and any QR code stay visible during restart and help assessments. `Esc` 
```

**File**: `src/acp/client/autostart.rs` (modified, +315/-15)
```diff
@@ -1,9 +1,20 @@
 //! Port selection and startup log diagnostics.
 
 use rand::RngExt;
+use std::collections::VecDeque;
+use std::fs::File;
+use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
 use std::path::Path;
+use tokio_util::sync::CancellationToken;
 
 const LOG_TAIL_LINES: usize = 200;
+const LOG_LINE_BYTES: usize = 8 * 1024;
+
+#[derive(Clone, Debug, Default)]
+pub(crate) struct LogContext {
+    pub(crate) lines: Vec<String>,
+    pub(crate) has_process_marker: bool,
+}
 
 pub(crate) fn load_or_generate_port() -> u16 {
     match crate::session::get_app_dir() {
@@ -38,22 +49,157 @@ fn random_port() -> u16 {
     rand::rng().random_range(MIN_PORT..65535)
 }
 
-/// The current run's lines: the log is shared, so start at the last `[AOE_START_MARKER]`.
-pub(crate) fn initial_log_tail() -> Vec<String> {
-    let Some(contents) = crate::cli::serve::stdio_redirect_path()
-        .ok()
-        .and_then(|p| std::fs::read_to_string(p).ok())
-    else {
-        return Vec::new();
+/// Recent shared context, without a claimed process association.
+pub(crate) fn initial_log_tail() -> LogContext {
+    log_tail(None, None)
+}
+
+/// A matching physical marker bounds context, but never attributes individual lines.
+pub(crate) fn startup_log_tail(
+    pid: u32,
+    birth: &crate::process::ProcessBirthIdentity,
+    cancel: &CancellationToken,
+) -> LogContext {
+    log_tail(Some((pid, birth)), Some(cancel))
+}
+
+fn log_tail(
+    expected: Option<(u32, &crate::process::ProcessBirthIdentity)>,
+    cancel: Option<&CancellationToken>,
+) -> LogContext {
+    if cancel.is_some_and(CancellationToken::is_cancelled) {
+        return LogContext::default();
+    }
+    let Ok((path, config)) = crate::cli::serve::stdio_redirect_logging() else {
+        return LogContext::default();
+    };
+    let policy = crate::logging::RotationPolicy::from(&config);
+    let keep = if expected.is_some()
+        && !matches!(policy.kind, crate::session::config::RotationKind::Never)
+    {
+        policy.keep_count
+    } else {
+        0
+    };
+    let mut newer = VecDeque::new();
+    for index in 0..=keep {
+        if cancel.is_some_and(CancellationToken::is_cancelled) {
+            return LogContext::default();
+        }
+        let rotated =
+            (index != 0).then(|| crate::logging::path_with_suffix(&path, &format!(".{index}")));
+        let candidate = rotated.as_deref().unwrap_or(&path);
+        let Ok(Some((file, length))) = crate::session::ResolvedDataFile::open(candidate)
+            .and_then(|file| file.open_read_snapshot())
+        else {
+            continue;
+        };
+        let remaining = LOG_TAIL_LINES - newer.len();
+        let (mut older, found) = match scan_log_file(file, length, expected, remaining, cancel) {
+            Ok(context) => context,
+            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {
+                return LogContext::default();
+            }
+            Err(_) => continue,
+        };
+        if !older.is_empty() {
+            older.append(&mut newer);
+            newer = older;
+        }
+        if found || expected.is_none() {
+            return LogContext {
+                lines: newer.into(),
+                has_process_marker: found && expected.is_some(),
+            };
+        }
+    }
+    LogContext {
+        lines: newer.into(),
+        has_process_marker: false,
+    }
+}
+
+fn scan_log_file(
+    mut file: File,
+    length: u64,
+    expected: Option<(u32, &crate::process::ProcessBirthIdentity)>,
+    limit: usize,
+    cancel: Option<&CancellationToken>,
+) -> std::io::Result<(VecDeque<String>, bool)> {
+    let start = if expected.is_none() {
+        length.saturating_sub((LOG_TAIL_LINES * LOG_LINE_BYTES) as u64)
+    } else {
+        0
+    };
+    let mut continuation = false;
+    if start != 0 {
+        file.seek(SeekFrom::Start(start - 1))?;
+        let mut previous = [0_u8];
+        file.read_exact(&mut previous)?;
+        continuation = previous[0] != b'\n';
+    }
+    let mut reader = BufReader::new(file.take(length - start));
+    let mut bytes = Vec::with_capacity(LOG_LINE_BYTES);
+    let mut tail = VecDeque::with_capacity(if limit == 0 { 0 } else { LOG_TAIL_LINES });
+    let mut found = false;
+    loop {
+        if cancel.is_some_and(CancellationToken::is_cancelled) {
+            return Err(std::io::ErrorKind::Interrupted.into());
+        }
+        bytes.clear();
+        if reader
+            .by_ref()
+            .take(LOG_LINE_BYTES as u64)
+            .read_until(b'\n', &mut bytes)?
+            == 0
+        {
+            break;
+        }
+        let complete = bytes.last() == Some(&b'\n');
+        if !continuation {
+            if let Ok(line) = std::str::from_utf8(&bytes) {
+                let line = line.trim_end_matches('\n');
+                if matches_start_marker(line, expected) {
+                    found = true;
+                    tail.clear();
+       
```

**File**: `src/cli/serve.rs` (modified, +966/-123)
```diff
@@ -2,6 +2,7 @@
 
 use anyhow::{bail, Context, Result};
 use clap::{Args, ValueEnum};
+use std::future::Future;
 use std::path::PathBuf;
 use std::sync::Mutex;
 
@@ -557,15 +558,19 @@ pub async fn lock_for_startup(profile: &str, args: &mut ServeArgs) -> Result<Opt
         LaunchMode::Tcp
     };
     args.resolve_launch(Some(requested))?;
-    match daemon_status() {
+    match tokio::task::spawn_blocking(daemon_status).await? {
         DaemonStatus::Verified(pid) if pid != std::process::id() => {
             transaction = migrate_managed_launch(transaction, false).await?;
-            let launch = managed_launch(pid)?;
+            let launch = tokio::task::spawn_blocking(move || managed_launch(pid)).await??;
             if !launch.core_only || args.core_only || args.daemon_child {
                 return Err(daemon_running_error(pid));
             }
             validate_launch_args(profile, args).await?;
-            let passphrase = recall_serve_passphrase(&launch)?;
+            let (launch, passphrase) = tokio::task::spawn_blocking(move || {
+                let passphrase = recall_serve_passphrase(&launch)?;
+                Ok::<_, anyhow::Error>((launch, passphrase))
+            })
+            .await??;
             retain_rollback_launch(&transaction, &launch, passphrase.as_deref())?;
             tracing::info!(
                 target: "serve.lifecycle",
@@ -926,12 +931,16 @@ fn live_daemon_instance_matches(pid: u32, instance_id: &str) -> bool {
             .is_some_and(|environment| environment_has_daemon_instance(&environment, instance_id));
     }
 
-    std::process::Command::new("ps")
-        .args(["-ww", "-E", "-o", "command=", "-p", &pid.to_string()])
-        .output()
-        .ok()
-        .filter(|output| output.status.success())
-        .is_some_and(|output| environment_has_daemon_instance(&output.stdout, instance_id))
+    crate::process::run_with_timeout_process_group(
+        std::process::Command::new("ps")
+            .args(["-ww", "-E", "-o", "command=", "-p", &pid.to_string()])
+            .stdin(std::process::Stdio::null()),
+        std::time::Duration::from_secs(3),
+    )
+    .ok()
+    .flatten()
+    .filter(|output| output.status.success())
+    .is_some_and(|output| environment_has_daemon_instance(&output.stdout, instance_id))
 }
 
 fn recall_serve_passphrase(launch: &ServeLaunch) -> Result<Option<String>> {
@@ -979,10 +988,10 @@ pub struct ServeUrl {
 /// empty. The primary URL gets `label: None` for rendering; alternates
 /// carry their label.
 pub fn read_serve_urls() -> Vec<ServeUrl> {
-    let Ok(dir) = crate::session::get_app_dir() else {
-        return Vec::new();
-    };
-    let Ok(raw) = std::fs::read_to_string(dir.join("serve.url")) else {
+    let Some(raw) = launch_file("serve.url")
+        .ok()
+        .and_then(|file| file.read().ok().flatten())
+    else {
         return Vec::new();
     };
     let mut out: Vec<ServeUrl> = Vec::new();
@@ -1098,17 +1107,19 @@ fn inspect_daemon_process(pid: i32) -> DaemonProcessIdentity {
     // macOS / other: shell out to `ps`. `-o command=` prints the full
     // command (path + args) with no header, and `-ww` stops it being clipped
     // at the terminal width before `serve` shows up.
-    match std::process::Command::new("ps")
-        .args(["-ww", "-o", "command=", "-p", &pid.to_string()])
-        .output()
-    {
-        Ok(out) if !out.status.success() => DaemonProcessIdentity::Indeterminate,
-        Ok(out) if command_is_aoe_serve(&out.stdout) => DaemonProcessIdentity::Verified,
-        Ok(out) if command_mentions_aoe_executable(&out.stdout) => {
+    match crate::process::run_with_timeout_process_group(
+        std::process::Command::new("ps")
+            .args(["-ww", "-o", "command=", "-p", &pid.to_string()])
+            .stdin(std::process::Stdio::null()),
+        std::time::Duration::from_secs(3),
+    ) {
+        Ok(Some(out)) if !out.status.success() => DaemonProcessIdentity::Indeterminate,
+        Ok(Some(out)) if command_is_aoe_serve(&out.stdout) => DaemonProcessIdentity::Verified,
+        Ok(Some(out)) if command_mentions_aoe_executable(&out.stdout) => {
             DaemonProcessIdentity::Indeterminate
         }
-        Ok(_) => DaemonProcessIdentity::Foreign,
-        Err(_) => DaemonProcessIdentity::Indeterminate,
+        Ok(Some(_)) => DaemonProcessIdentity::Foreign,
+        Ok(None) | Err(_) => DaemonProcessIdentity::Indeterminate,
     }
 }
 
@@ -1179,8 +1190,10 @@ fn clear_serve_state(expected_pid: i32) -> bool {
     ) else {
         return false;
     };
-    let recorded = std::fs::read_to_string(&pid_path)
+    let recorded = crate::session::ResolvedDataFile::open(&pid_path)
+        .and_then(|file| file.read())
         .ok()
+        .flatten()
         .and_then(|raw| parse_positive_pid(&raw));
     if recorded != Some(expected_pid) {
         return false;
@@ -1215,12 +1228,9 @@ fn daemon_status_with(
     probe: impl FnOnce(i32) -> DaemonProbeDi
```

**File**: `src/logging.rs` (modified, +9/-4)
```diff
@@ -636,12 +636,17 @@ fn write_raw_startup_marker(writer: &mut dyn Write) {
     let exe = std::env::current_exe()
         .map(|p| p.display().to_string())
         .unwrap_or_default();
+    let pid = std::process::id();
+    let birth = crate::process::process_birth_identity(pid).ok().flatten();
+    let (boot_id, start_id) = birth
+        .as_ref()
+        .map_or(("unavailable", "unavailable"), |birth| {
+            (birth.boot_id.as_str(), birth.start_id.as_str())
+        });
     let line = format!(
-        "{} INFO log.runtime [AOE_START_MARKER] version={} pid={} exe={}\n",
+        "{} INFO log.runtime [AOE_START_MARKER] version={} pid={pid} boot_id={boot_id} start_id={start_id} exe={exe}\n",
         chrono::Utc::now().to_rfc3339(),
         env!("CARGO_PKG_VERSION"),
-        std::process::id(),
-        exe,
     );
     let _ = writer.write_all(line.as_bytes());
     let _ = writer.flush();
@@ -825,7 +830,7 @@ impl Drop for SizeRotatingWriter {
     }
 }
 
-fn path_with_suffix(path: &Path, suffix: &str) -> PathBuf {
+pub(crate) fn path_with_suffix(path: &Path, suffix: &str) -> PathBuf {
     let mut s = path.as_os_str().to_os_string();
     s.push(suffix);
     PathBuf::from(s)
```

**File**: `src/process/macos.rs` (modified, +61/-11)
```diff
@@ -993,19 +993,26 @@ Pages wired down:                        300000.
 
 /// `kern.boottime` shifts on clock steps; the session UUID does not.
 pub(super) fn boot_id() -> Option<String> {
-    let out = Command::new("sysctl")
-        .args(["-n", "kern.bootsessionuuid"])
-        .output()
-        .ok()?;
-    if !out.status.success() {
+    let mut uuid = [0u8; 37];
+    let mut length = uuid.len();
+    // SAFETY: the name is NUL-terminated; buffer and length match its capacity.
+    if unsafe {
+        libc::sysctlbyname(
+            c"kern.bootsessionuuid".as_ptr(),
+            uuid.as_mut_ptr().cast(),
+            &mut length,
+            std::ptr::null_mut(),
+            0,
+        )
+    } != 0
+    {
         return None;
     }
-    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
-    if s.is_empty() {
-        None
-    } else {
-        Some(s)
-    }
+    let value = std::ffi::CStr::from_bytes_with_nul(uuid.get(..length)?)
+        .ok()?
+        .to_str()
+        .ok()?;
+    (!value.is_empty()).then(|| value.to_owned())
 }
 
 pub(super) fn foreground_arguments(shell_pid: u32) -> Vec<super::ProcessArguments> {
@@ -1419,4 +1426,47 @@ mod tests {
             assert_eq!(roots(&guard), 1, "root duplicated by refresh");
         }
     }
+
+    #[test]
+    #[serial_test::serial]
+    fn captured_process_custody_survives_an_unavailable_sysctl_command() {
+        use std::io::{BufRead as _, Write as _};
+        use std::os::unix::fs::PermissionsExt as _;
+
+        struct OwnedChild(std::process::Child);
+        impl Drop for OwnedChild {
+            fn drop(&mut self) {
+                let _ = self.0.kill();
+                let _ = self.0.wait();
+            }
+        }
+        let mut child = OwnedChild(
+            Command::new("sh")
+                .args(["-c", "printf 'ready\\n'; IFS= read -r line"])
+                .stdin(std::process::Stdio::piped())
+                .stdout(std::process::Stdio::piped())
+                .spawn()
+                .unwrap(),
+        );
+        let mut ready = String::new();
+        std::io::BufReader::new(child.0.stdout.take().unwrap())
+            .read_line(&mut ready)
+            .unwrap();
+        assert_eq!(ready, "ready\n");
+        let birth = super::super::process_birth_identity(child.0.id())
+            .unwrap()
+            .unwrap();
+        let tools = tempfile::tempdir().unwrap();
+        let sysctl = tools.path().join("sysctl");
+        std::fs::write(&sysctl, "#!/bin/sh\nexit 1\n").unwrap();
+        std::fs::set_permissions(&sysctl, std::fs::Permissions::from_mode(0o755)).unwrap();
+        let _path = crate::session::test_support::path_prepended(tools.path());
+        let captured = super::super::CapturedProcess::capture(child.0.id(), &birth)
+            .unwrap()
+            .expect("an unavailable utility must not discard custody of a live process");
+        assert!(!captured.exited().unwrap());
+        child.0.stdin.as_mut().unwrap().write_all(b"\n").unwrap();
+        assert!(child.0.wait().unwrap().success());
+        assert!(captured.exited().unwrap());
+    }
 }
```

**File**: `src/server/tunnel.rs` (modified, +75/-49)
```diff
@@ -1219,14 +1219,17 @@ pub fn print_qr_code(url: &str) {
 }
 
 /// Check if cloudflared is installed and accessible on PATH.
-pub fn check_cloudflared() -> anyhow::Result<()> {
-    match std::process::Command::new("cloudflared")
-        .arg("--version")
-        .stdout(std::process::Stdio::null())
-        .stderr(std::process::Stdio::null())
-        .status()
-    {
-        Ok(status) if status.success() => Ok(()),
+pub fn check_cloudflared(cancel: &tokio_util::sync::CancellationToken) -> anyhow::Result<()> {
+    match crate::process::run_status_with_timeout_process_group(
+        std::process::Command::new("cloudflared")
+            .arg("--version")
+            .stdin(std::process::Stdio::null())
+            .stdout(std::process::Stdio::null())
+            .stderr(std::process::Stdio::null()),
+        PROBE_TIMEOUT,
+        Some(cancel),
+    ) {
+        Ok(Some(status)) if status.success() => Ok(()),
         _ => anyhow::bail!(
             "cloudflared is not installed or not on PATH.\n\
              Install it: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n\
@@ -1244,20 +1247,18 @@ pub fn check_cloudflared() -> anyhow::Result<()> {
 /// opens the view, or hold the Daemon's tunnel selection until its startup deadline.
 const PROBE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(3);
 
-/// Sync counterpart of `tailscale_probe()` for use from the TUI (which avoids spinning
-/// up a tokio runtime just to probe for a CLI).
-pub fn tailscale_probe_sync() -> TailscaleProbe {
-    tailscale_probe_sync_with(std::ffi::OsStr::new("tailscale"), PROBE_TIMEOUT)
+/// Synchronous availability check for the cancellable Serve worker.
+pub fn tailscale_probe_sync(cancel: &tokio_util::sync::CancellationToken) -> TailscaleProbe {
+    tailscale_probe_sync_with(std::ffi::OsStr::new("tailscale"), PROBE_TIMEOUT, cancel)
 }
 
 fn tailscale_probe_sync_with(
     program: &std::ffi::OsStr,
     timeout: std::time::Duration,
+    cancel: &tokio_util::sync::CancellationToken,
 ) -> TailscaleProbe {
-    // Unlike the async path, this runs on the TUI render hot path, so we keep it cheap and
-    // quiet on the happy path.
     for arg in ["--version", "status"] {
-        match probe_succeeds(program, arg, timeout) {
+        match probe_succeeds(program, arg, timeout, cancel) {
             Some(true) => {}
             Some(false) => return TailscaleProbe::Unavailable,
             None => return TailscaleProbe::TimedOut,
@@ -1266,36 +1267,33 @@ fn tailscale_probe_sync_with(
     TailscaleProbe::Available
 }
 
-/// Whether `program arg` exits zero within `timeout`, or `None` when it is still running, in
-/// which case it is killed.
 fn probe_succeeds(
     program: &std::ffi::OsStr,
     arg: &str,
     timeout: std::time::Duration,
+    cancel: &tokio_util::sync::CancellationToken,
 ) -> Option<bool> {
-    let spawned = std::process::Command::new(program)
-        .arg(arg)
-        .stdin(std::process::Stdio::null())
-        .stdout(std::process::Stdio::null())
-        .stderr(std::process::Stdio::null())
-        .spawn();
-    let status =
-        spawned.and_then(|mut child| crate::process::wait_with_timeout(&mut child, timeout));
+    let status = crate::process::run_status_with_timeout_process_group(
+        std::process::Command::new(program)
+            .arg(arg)
+            .stdin(std::process::Stdio::null())
+            .stdout(std::process::Stdio::null())
+            .stderr(std::process::Stdio::null()),
+        timeout,
+        Some(cancel),
+    );
     match status {
         Ok(Some(status)) if status.success() => Some(true),
         Ok(Some(status)) => {
-            debug!(exit = ?status.code(), "tailscale_probe_sync: `tailscale {arg}` failed");
+            debug!(target: "serve.tunnel", exit = ?status.code(), "tailscale_probe_sync: `tailscale {arg}` failed");
             Some(false)
         }
         Ok(None) => {
-            debug!(
-                timeout_s = timeout.as_secs_f32(),
-                "tailscale_probe_sync: `tailscale {arg}` timed out"
-            );
+            debug!(target: "serve.tunnel", timeout_s = timeout.as_secs_f32(), "tailscale_probe_sync: `tailscale {arg}` timed out or cancelled");
             None
         }
         Err(error) => {
-            debug!(%error, "tailscale_probe_sync: `tailscale {arg}` could not run");
+            debug!(target: "serve.tunnel", %error, "tailscale_probe_sync: `tailscale {arg}` could not run");
             Some(false)
         }
     }
@@ -1311,44 +1309,63 @@ pub enum FunnelCapability {
     TimedOut,
 }
 
-/// Sync counterpart of `check_funnel_capability()`.
-pub fn tailscale_funnel_cap_sync() -> FunnelCapability {
-    tailscale_funnel_cap_sync_with(std::ffi::OsStr::new("tailscale"), PROBE_TIMEOUT)
+/// Synchronous capability check for the cancellable Serve worker.
+pub fn tailscale_funnel_cap_sync(cancel: &tokio_util::sync::CancellationToken) -> Funn
```

#### Recent Merged Pull Requests:
- **PR #5632** (2026-11-12): fix(ci): report Codecov through commit statuses, not check runs (@Seluj78)
- **PR #5629** (2026-11-12): fix(serve): don't take over a live Tailscale Funnel, and notice a takeover (@klubrake)
- **PR #5622** (2026-11-12): docs(mcp): scope send's capture-failure refusal to agents with a manifest (@klubrake)
- **PR #5617** (2026-11-12): fix(acp): keep a session Waiting while a question or approval is pending (@Seluj78)
- **PR #5606** (2026-11-12): test(web): read the live control messages with one parser (@klubrake)
- **PR #5605** (2026-11-12): feat(server): add skip_on_create to create a session without setup (@klubrake)

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

## X. trash): expose safe unfinished-trash retry (#5472)

**RULE**:
When implementing operations in `docs/api.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ecbf52ef`: trash): expose safe unfinished-trash retry (#5472). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/api.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
At creation admission, an `import_acp_session_id` found already owned is refused
with `400 create_failed` and the safe message “Import source is already owned by
an AoE session”. Frozen cleanup ownership covers all tools' current and parked
ACP IDs, even after an ordinary purge removes the visible row. Unrelated failures
remain sanitized rather than exposing their internal causes.

| `expected_profile` | omitted | Require the selected profile as well as the generation; a mismatch returns `409 lifecycle_superseded` without mutation. |
Unfinished Trash exposes Retry and read-only inspection, not record-only removal.
Retry retains existing lifecycle, native ownership, and filesystem checks. An
unverified checkout stays visible in Trash until those checks can settle it.
UI requests capture their original profile, generation, and runtime epoch;
replacement state requires fresh consent.


```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ecbf52ef` are properly handled with clean fallback behavior.
