# Forensic Learning Record (Deep Inspection): agent-of-empires/agent-of-empires

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-of-empires-agent-of-empires-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:27:32.216Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agent-of-empires/agent-of-empires`
- **Description**: Manage multiple Claude Code, OpenCode agents from either TUI or Web for easy access on mobile. Also supports Mistral Vibe, Codex CLI, Gemini CLI, Pi.dev, Copilot CLI, Factory Droid Coding.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3305 stars

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
            stdout: out.output
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

### Core Architecture Module: `aoe-plugin-api/src/acp.rs`
```
//! ACP capability-discovery DTOs for the `acp.capabilities.get` worker RPC

use serde::{Deserialize, Serialize};

/// Response of `acp.capabilities.get`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcpCapabilitiesResponse {
    pub agents: Vec<AcpAgentCapability>,
}

/// One agent the host can run in a structured session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcpAgentCapability {
    /// Stable agent id, the value `sessions.create` accepts as `agent_id`.
    pub id: String,
    pub display_name: String,
    pub catalog_status: CatalogStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog_updated_at: Option<String>,
    pub models: Vec<AcpModelCapability>,
    pub modes: Vec<AcpModeCapability>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub thinking: Vec<AcpThinkingCapability>,
}

/// A model choice the agent advertised.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcpModelCapability {
    pub id: String,
    pub display_name: String,
}

/// A reasoning-effort / thought-level choice the agent advertised.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcpThinkingCapability {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcpModeCapability {
    pub id: String,
    pub display_name: String,
    pub approval_class: ApprovalClass,
}

/// Whether the host has ever observed this agent's advertised option catalog.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CatalogStatus {
    Undiscovered,
    Discovered,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalClass {
    /// Approvals prompt a human through the host UI (adapter default).
    Interactive,
    Guarded,
    Unattended,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_fixture_is_stable() {
        let response = AcpCapabilitiesResponse {
            agents: vec![AcpAgentCapability {
                id: "claude".into(),
                display_name: "Claude Code".into(),
                catalog_status: CatalogStatus::Discovered,
                catalog_updated_at: Some("2026-07-16T00:00:00Z".into()),
                models: vec![AcpModelCapability {
                    id: "sonnet".into(),
                    display_name: "Sonnet".into(),
                }],
                modes: vec![
                    AcpModeCapability {
                        id: "bypassPermissions".into(),
                        display_name: "Bypass Permissions".into(),
                        approval_class: ApprovalClass::Unattended,
                    },
                    AcpModeCapability {
                        id: "plan".into(),
                        display_name: "Plan".into(),
                        approval_class: ApprovalClass::Guarded,
                    },
                ],
                thinking: vec![AcpThinkingCapability {
                    id: "think".into(),
                    display_name: "Think".into(),
                }],
            }],
        };
        let json = serde_json::to_value(&response).expect("serialize");
        assert_eq!(
            json,
            serde_json::json!({
                "agents": [{
                    "id": "claude",
                    "display_name": "Claude Code",
                    "catalog_status": "discovered",
                    "catalog_updated_at": "2026-07-16T00:00:00Z",
                    "models": [{"id": "sonnet", "display_name": "Sonnet"}],
                    "modes": [
                        {"id": "bypassPermissions", "display_name": "Bypass Permissions", "approval_class": "unattended"},
                        {"id": "plan", "display_name": "Plan", "approval_class": "guarded"}
                    ],
                    "thinking": [{"id": "think", "display_name": "Think"}]
                }]
            })
        );
        let round: AcpCapabilitiesResponse = serde_json::from_value(json).expect("deserialize");
        assert_eq!(round, response);
    }

    #[test]
    fn undiscovered_omits_updated_at() {
        let agent = AcpAgentCapability {
            id: "codex".into(),
            display_name: "Codex".into(),
            catalog_status: CatalogStatus::Undiscovered,
            catalog_updated_at: None,
            models: vec![],
            modes: vec![],
            thinking: vec![],
        };
        let json = serde_json::to_value(&agent).expect("serialize");
        assert!(json.get("catalog_updated_at").is_none());
        assert!(json.get("thinking").is_none());
        assert_eq!(json["catalog_status"], "undiscovered");
    }
}

```

### Core Architecture Module: `aoe-plugin-api/src/capability.rs`
```
//! Capability taxonomy and trust levels for the plugin system.

use std::fmt;

use serde::{Deserialize, Serialize};

/// A capability a plugin requests in its manifest `capabilities = [...]` array.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CapabilityId(String);

impl CapabilityId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn is_known(&self) -> bool {
        KNOWN_CAPABILITIES.contains(&self.0.as_str())
    }
}

impl fmt::Display for CapabilityId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<&str> for CapabilityId {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

/// Resource/effect capabilities this host version understands.
pub const KNOWN_CAPABILITIES: &[&str] = &[
    "runtime.worker",
    "session.read",
    "session.write",
    "config.read",
    "config.write",
    "process.spawn",
    "net",
    "fs.read",
    "fs.write",
    "clipboard.read",
    "clipboard.write",
    "notifications",
    "browser_open",
    "composer.read",
    "composer.write",
    "acp.capabilities.read",
    "acp.capabilities.probe",
    "session.create",
    "session.prompt",
    "session.unattended",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrustLevel {
    Builtin,
    Community,
}

impl TrustLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            TrustLevel::Builtin => "builtin",
            TrustLevel::Community => "community",
        }
    }
}

impl fmt::Display for TrustLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

```

### Core Architecture Module: `aoe-plugin-api/src/id.rs`
```
use std::fmt;

use serde::{Deserialize, Serialize};

/// Identifier of a plugin, e.g. `aoe.status` or `someuser.review-helper`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct PluginId(String);

/// Rejection reason for a malformed plugin id.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("invalid plugin id {id:?}: {reason}")]
#[non_exhaustive]
pub struct InvalidPluginId {
    pub id: String,
    pub reason: &'static str,
}

impl PluginId {
    pub fn new(id: impl Into<String>) -> Result<Self, InvalidPluginId> {
        let id = id.into();
        let reject = |reason| {
            Err(InvalidPluginId {
                id: id.clone(),
                reason,
            })
        };
        if id.is_empty() {
            return reject("empty");
        }
        if id.len() > 64 {
            return reject("longer than 64 bytes");
        }
        for segment in id.split('.') {
            let mut chars = segment.chars();
            match chars.next() {
                Some(c) if c.is_ascii_lowercase() => {}
                _ => {
                    return reject("each dot-separated segment must start with a lowercase letter")
                }
            }
            if !chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
                return reject("segments may only contain lowercase letters, digits, and hyphens");
            }
        }
        Ok(Self(id))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn is_reserved_namespace(&self) -> bool {
        matches!(
            self.0.split('.').next(),
            Some("aoe") | Some("agent-of-empires")
        )
    }
}

impl fmt::Display for PluginId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl TryFrom<String> for PluginId {
    type Error = InvalidPluginId;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

impl From<PluginId> for String {
    fn from(value: PluginId) -> Self {
        value.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_dotted_lowercase_ids() {
        for ok in ["aoe.status", "a", "someuser.review-helper", "x.y2.z-3"] {
            assert!(PluginId::new(ok).is_ok(), "{ok} should be valid");
        }
    }

    #[test]
    fn rejects_malformed_ids() {
        for bad in [
            "",
            "Aoe.status",
            "aoe..status",
            "aoe.2fast",
            "-x",
            "aoe.st_at",
            "aoe.st at",
        ] {
            assert!(PluginId::new(bad).is_err(), "{bad} should be rejected");
        }
    }

    #[test]
    fn reserved_namespace_policy_is_pinned() {
        for reserved in ["aoe.status", "aoe.web", "agent-of-empires.github"] {
            assert!(
                PluginId::new(reserved).unwrap().is_reserved_namespace(),
                "{reserved} should be reserved"
            );
        }
        for open in ["someuser.review-helper", "acme.review", "aoextra.thing"] {
            assert!(
                !PluginId::new(open).unwrap().is_reserved_namespace(),
                "{open} should be open"
            );
        }
    }

    #[test]
    fn serde_round_trips_and_validates() {
        let id: PluginId = serde_json::from_str("\"aoe.status\"").unwrap();
        assert_eq!(id.as_str(), "aoe.status");
        assert_eq!(serde_json::to_string(&id).unwrap(), "\"aoe.status\"");
        assert!(serde_json::from_str::<PluginId>("\"Not Valid\"").is_err());
    }
}

```

### Core Architecture Module: `aoe-plugin-api/src/lib.rs`
```
//! Plugin manifest types for the Agent of Empires plugin system.

pub mod acp;
mod capability;
mod id;
mod manifest;
pub mod session;

pub use capability::{CapabilityId, TrustLevel, KNOWN_CAPABILITIES};
pub use id::{InvalidPluginId, PluginId};
pub use manifest::{
    lucide_icon_name_ok, screenshot_path_ok, BuildStep, ClientAction, CommandContribution,
    KeybindContribution, ManifestError, ObjectFieldContribution, ObjectFieldType, OptionSource,
    PluginManifest, RuntimeSpec, Screenshot, SettingContribution, SettingType, StatusContribution,
    ThemeContribution, UiContribution, UiSlot, MAX_SCREENSHOTS,
};

pub const API_VERSION: u32 = 13;

```

### Core Architecture Module: `aoe-plugin-api/src/manifest.rs`
```
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{CapabilityId, PluginId, API_VERSION};

/// Parsed and validated `aoe-plugin.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[non_exhaustive]
pub struct PluginManifest {
    pub id: PluginId,
    /// Human-readable display name.
    pub name: String,
    pub version: String,
    /// Manifest schema / host API version this manifest targets.
    pub api_version: u32,
    #[serde(default)]
    pub description: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub screenshots: Vec<Screenshot>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_asset: Option<String>,

    /// Runtime resource/effect capabilities, not static contributions.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub capabilities: Vec<CapabilityId>,

    /// Commands the plugin contributes to the palette and CLI.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub commands: Vec<CommandContribution>,

    /// Keybinds the plugin contributes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub keybinds: Vec<KeybindContribution>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub settings: Vec<SettingContribution>,

    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub setting_defaults: BTreeMap<String, toml::Value>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub themes: Vec<ThemeContribution>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub status: Vec<StatusContribution>,

    /// Host-rendered UI slots the plugin may populate.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ui: Vec<UiContribution>,

    /// The worker entrypoint.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime: Option<RuntimeSpec>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aoe_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<ClientAction>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum ClientAction {
    OpenUiLink { slot: UiSlot, id: String },
}

/// A keybind the plugin contributes, binding a key chord to a command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindContribution {
    /// Command id this binds to (a plugin command or a core command).
    pub command: String,
    /// Key chord, e.g. `Ctrl+K`.
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingContribution {
    pub key: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub description: String,
    /// Value type. Drives the rendered widget and server-side validation.
    #[serde(rename = "type", default)]
    pub value_type: SettingType,
    /// Allowed values for a `select`; ignored otherwise.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
    /// Inclusive bounds for an `integer`; ignored otherwise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<toml::Value>,
    /// Group under an "Advanced" fold on the settings surfaces.
    #[serde(default)]
    pub advanced: bool,
    #[serde(default)]
    pub multiline: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option_source: Option<OptionSource>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<ObjectFieldContribution>,
    /// The item field that holds each `object_list` row's stable id (API v9).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_id_key: Option<String>,
    /// Inclusive item-count bounds for an `object_list` (API v9).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_items: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_items: Option<u32>,
}

/// A host option source a `dynamic_select` draws its choices from (API v9).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OptionSource {
    #[serde(rename = "acp.agents")]
    AcpAgents,
    #[serde(rename = "acp.models")]
    AcpModels,
    #[serde(rename = "acp.modes")]
    AcpModes,
    #[serde(rename = "projects")]
    Projects,
    #[serde(rename = "groups")]
    Groups,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectFieldContribution {
    pub key: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "type", default)]
    pub value_type: ObjectFieldType,
    /// Whether the item must carry a non-empty value for this field.
    #[serde(default)]
    pub required: bool,
    /// Render a `string` field as a multi-line textarea. Ignored otherwise. v11.
    #[serde(default)]
    pub multiline: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<toml::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub option_source: Option<OptionSource>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObjectFieldType {
    #[default]
    String,
    #[serde(alias = "boolean")]
    Bool,
    Integer,
    Select,
    DynamicSelect,
    DynamicMultiSelect,
    Cron,
}

fn validate_object_list_settings(
    i: usize,
    s: &SettingContribution,
    setting_keys: &std::collections::HashSet<&str>,
    agent_setting_keys: &std::collections::HashSet<&str>,
    check: &mut impl FnMut(bool, String),
) {
    match s.value_type {
        SettingType::DynamicSelect => {
            check(
                s.option_source.is_some(),
                format!("settings[{i}] is a dynamic_select but declares no option_source"),
            );
            check(
                s.fields.is_empty(),
                format!("settings[{i}] is a dynamic_select and must not declare object fields"),
            );
            let mut dep_seen = std::collections::HashSet::new();
            for dep in &s.depends_on {
                check(
                    dep != &s.key,
                    format!("settings[{i}]: depends_on must not reference itself"),
                );
                check(
                    setting_keys.contains(dep.as_str()),
                    format!("settings[{i}]: depends_on {dep:?} is not a sibling setting"),
                );
                check(
                    dep_seen.insert(dep.as_str()),
                    format!("settings[{i}]: depends_on {dep:?} is listed twice"),
                );
            }
            if matches!(
                s.option_source,
                Some(OptionSource::AcpModels) | Some(OptionSource::AcpModes)
            ) {
                check(
                    s.depends_on
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4111** (2026-09-25): **Preserve failed Pi transcript-path observations during poller shutdown**
  *Symptoms*: ## Problem  The Pi poller retains an unacknowledged transcript-path observation after a failed write during normal draining, but shutdown performs only one final drain and then discards the poller. If that final path write fails, the pending path can be lost even though the session ID was stored. A later app restart may lack the transcript locator needed to resume that conversation.  ## Reproduction scenario  With isolated storage, give a Pi session an already-persisted ID and a poller observation carrying its matching transcript path, with no other copy of the path. Inject a storage failure for that path write during `stop_and_flush_poller`, then clear the failure and inspect the row. Expected: the observation remains retryable or the path is durably stored before the poller is discarded. Source-traced outcome: the one final drain leaves the path unacknowledged, then `session_id_poller` becomes `None`. This shutdown sequence has not been executed locally.  ## Evidence  - [Shutdown path](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/polling.rs#L701-L715) drains once and drops the poller regardless of the outcome. - [Path write](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/identity_sidecar.rs#L270-L307) returns false on storage failure; [drain logic](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47c

- **Issue #4109** (2026-09-30): **Reject no-revive prompts for workerless rate-limit parks**
  *Symptoms*: ## Problem  A workerless rate-limit park can bypass the daemon's `no_revive` refusal. On `main` at `be309177`, the prompt handler rejects only `Queued(WorkerDown)`. The dispatch table can instead return `Queued(TurnActive)` for a parked session whose worker has stopped before the `Stopped` event is persisted. A constrained `aoe send --no-revive` can then return success and enqueue a prompt for a dead worker.  ## Reproduction scenario  With isolated app state, persist `RateLimit` for an active ACP turn, terminate the worker before its `Stopped` event is persisted, then send a new prompt with `--no-revive`.  Expected: reject the request without enqueueing or waking a worker. Source-traced outcome: the persisted park and active-turn latch select `Queued(TurnActive)`; the `WorkerDown`-only guard does not reject it. This race has not been reproduced locally.  ## Evidence  - [Prompt admission guard](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/acp/prompt.rs#L91-L118) rejects only `WorkerDown`. - [Dispatch table](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/dispatch.rs#L178-L189) selects `TurnActive` for a parked, latched turn. - [Event ordering](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/acp_client/connection/prompt.rs#L310-L324) emits `RateLimit` before [`Stopped`](https://github.com/agent

- **Issue #4108** (2026-09-24): **Allow partial workspace deletion to preserve a dirty shared worktree**
  *Symptoms*: ## Problem  `DELETE /api/workspaces` accepts a subset of sessions and promises to preserve a worktree still used by an unselected session. On `main` at `be309177`, its early dirty-worktree preflight runs before the shared-use guard. A dirty checkout that must be preserved therefore returns 409 and prevents deletion of the selected session row. This P2 follow-up remains after merged PR #4095.  ## Reproduction scenario  Create two sessions in one managed workspace; select only the owner for deletion and leave the other session using the same worktree. Modify a file in that worktree. Send `DELETE /api/workspaces` with `session_ids` containing only the owner, `delete_worktree=true`, and `force_delete=false`.  **Expected:** remove the selected session record, preserving the dirty worktree and its branch for the unselected session. **Actual, source-traced:** the endpoint returns `409 dirty_worktree` before the preservation decision. This scenario has not been executed locally.  ## Evidence  - [Subset-delete contract](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/sessions/delete.rs#L534-L538). - [Early dirty preflight](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/sessions/delete.rs#L786-L800) and [later authoritative dirty check](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/server/api/sessio

- **Issue #4106** (2026-09-25): **OMP macOS failure-injection test inherits its control variables**
  *Symptoms*: ## Problem  The test-only write-failure shim introduced by merged PR #4080 uses `breadcrumb_tmp`, `marker_tmp`, and `write_count` to select the injected write. Its child process inherits those names from the runner environment. On `main` at `be309177`, a pre-set `marker_tmp` suppresses injection; a pre-set `breadcrumb_tmp` can spend the selected write before the breadcrumb path, allowing a false pass. This is P3 test reliability, not a production-path defect.  ## Reproduction scenario  Run `omp_launch_wrapper_preserves_known_breadcrumb_extras_and_rejects_invalid_ones` in an isolated environment with `marker_tmp=preexisting`; the shim skips the selected write while the test still expects its failure marker. Also test with `breadcrumb_tmp=preexisting` and `marker_tmp` unset; the earlier routing-fingerprint `printf` can consume the injection. These scenarios are source-traced, not locally executed.  ## Evidence  - [Shim guard](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/omp.rs#L840-L855) reads inherited shell variables. - [Test child](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/omp.rs#L938-L963) removes `AOE_TEST_FAIL_WRITE` but not those variables; the [test's environment guard](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/session/instance/omp.rs#L823-L829) clears only st

- **Issue #4104** (2026-09-30): **ACP: reject agent-supplied prompt completion markers**
  *Symptoms*: ## Problem  After merged PR #4103, the local-prompt outcome is released when the ACP crate handles `_aoe/prompt_completed`. The runner forwards an agent-originated notification with that reserved method. A forged marker can therefore release the outcome before an earlier usage update is applied, defeating the rate-limit reset ordering fix. This is a source-traced conditional path on `main` at `be309177`; I have not observed a supported agent emitting this method.  ## Reproduction scenario  In an isolated runner/control test, block the crate while it applies an earlier session update. Have the agent emit `{"jsonrpc":"2.0","method":"_aoe/prompt_completed","params":{}}`, then a `usage_update` containing a rate-limit reset, then the real prompt response. Let the control reader queue these frames and store the real outcome before releasing the blocked handler.  **Expected:** only the daemon-minted marker releases the prompt after the usage update is applied. **Actual, source-traced:** the forged marker is handled first and takes the stored outcome; rate-limit classification can again see no reset.  ## Evidence  - [Runner ingress](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/process/runner/shared.rs#L331-L340) filters `_aoe/session_replayed` but forwards other agent notification methods. - [ACP ingress](https://github.com/agent-of-empires/agent-of-empires/blob/be309177fd4529266edd47ce4ac40ca7cc4ee98c/src/acp/acp_client/sessi

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

### Incident Patch 1: `ad8f4433` (2026-09-30)
**Commit Message**: chore(deps): bump the web-security group across 1 directory with 2 updates (#4223)

* chore(deps): bump the web-security group across 1 directory with 2 updates

Bumps the web-security group with 2 updates in the /web directory: [dompurify](https://github.com/cure53/DOMPurify) and [brace-expansion](https://github.com/juliangruber/brace-expansion).


Updates `dompurify` from 3.4.15 to 3.4.16
- [Release notes](https://github.com/cure53/DOMPurify/releases)
- [Commits](https://github.com/cure53/DOMPurify/compare/3.4.15...3.4.16)

Updates `brace-expansion` from 5.0.7 to 5.0.12
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.7...v5.0.12)

---
updated-dependencies:
- dependency-name: dompurify
  dependency-version: 3.4.16
  dependency-type: direct:production
  dependency-group: web-security
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
  dependency-group: web-security
...

Signed-off-by: dependabot[bot] <support@github.com>

* chore: update Nix npmDepsHash for web dependencies

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.nor

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@
             pname = "agent-of-empires-web";
             version = "0";
             src = ./web;
-            npmDepsHash = "sha256-iqonGKQlvID8Q3XakRpsBSa9IfHLp1lxOOnfOsdbw40=";
+            npmDepsHash = "sha256-Y/g3DOPy2PxFwFzIFcPShg7F6zrEJZkMOrwcDgzxfG4=";
             # tsc -b && vite build; output goes to web/dist
             installPhase = ''
               mkdir $out
```

**File**: `web/package-lock.json` (modified, +8/-8)
```diff
@@ -17,7 +17,7 @@
         "@tailwindcss/vite": "^4.3.3",
         "clsx": "^2.1.1",
         "cmdk": "^1.1.1",
-        "dompurify": "^3.4.15",
+        "dompurify": "^3.4.16",
         "lucide-react": "^1.46.0",
         "marked": "^18.0.13",
         "react": "^19.2.4",
@@ -5038,16 +5038,16 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.7",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.7.tgz",
-      "integrity": "sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
       },
       "engines": {
-        "node": "18 || 20 || >=22"
+        "node": "20 || >=22"
       }
     },
     "node_modules/browserslist": {
@@ -5481,9 +5481,9 @@
       "license": "MIT"
     },
     "node_modules/dompurify": {
-      "version": "3.4.15",
-      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.15.tgz",
-      "integrity": "sha512-EUBjM+B+lkDE41iE82DDSCfkoPGfXx8IxFxPMjNzm/Uk4xDet77rTN9wqlxlVg71kK7XGuUMv6wUxJUwwv+Xyw==",
+      "version": "3.4.16",
+      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz",
+      "integrity": "sha512-sqo+pNp3qRhCIpbgRi1y8Tgk27Bo2Ry7w0dC1NBeNTdZChWjz9Xb/KOoZbRP/R6pQZ80Qw8YhXw13hWWBbMRnQ==",
       "license": "(MPL-2.0 OR Apache-2.0)",
       "optionalDependencies": {
         "@types/trusted-types": "^2.0.7"
```

**File**: `web/package.json` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
     "@tailwindcss/vite": "^4.3.3",
     "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
-    "dompurify": "^3.4.15",
+    "dompurify": "^3.4.16",
     "lucide-react": "^1.46.0",
     "marked": "^18.0.13",
     "react": "^19.2.4",
```

---

### Incident Patch 2: `dd08a9bf` (2026-09-30)
**Commit Message**: fix(hooks): clear the agent hook acknowledgement from the CLI (#4159) (#4178)

* feat(hooks): add a non-interactive agent hook acknowledgement

`aoe add ... -l` and `aoe session start` refuse to launch any host
session whose agent installs status hooks until the user acknowledges
the hook paths, and the only way to acknowledge was the TUI dialog.
Automation had no way through, and `--trust-hooks` does not cover it:
that flag is per-repository trust for the hooks a repo declares in
.agent-of-empires/config.toml, and with --scratch it is never read at
all.

`aoe hooks approve` records the same acknowledgement the dialog writes,
through the same `update_app_state` helper, so both surfaces share one
source of truth. `aoe hooks status` reports the answer and the files a
launch would write. The refusal now names the command.

The disclosure both surfaces show is extracted from the TUI dialog into
`host_hook_disclosure`, so the command and the dialog cannot drift
apart. Writes the existing global flag, so no schema change, no
migration, and no re-acknowledgement for existing users.

Refs #4159

* fix(hooks): disclose the paths a launch actually targets

Review found the disclosure was com

**File**: `docs/cli/reference.md` (modified, +33/-0)
```diff
@@ -103,6 +103,9 @@ This document contains the help content for the `aoe` command-line program.
 * [`aoe skill adopt`↴](#aoe-skill-adopt)
 * [`aoe skill remove`↴](#aoe-skill-remove)
 * [`aoe skill sync`↴](#aoe-skill-sync)
+* [`aoe hooks`↴](#aoe-hooks)
+* [`aoe hooks status`↴](#aoe-hooks-status)
+* [`aoe hooks approve`↴](#aoe-hooks-approve)
 * [`aoe serve`↴](#aoe-serve)
 * [`aoe url`↴](#aoe-url)
 * [`aoe acp`↴](#aoe-acp)
@@ -161,6 +164,7 @@ Run without arguments to launch the TUI dashboard.
 * `telemetry` — Manage anonymous opt-in usage telemetry
 * `mcp` — Inspect the effective MCP server set (provenance, conflicts, drift)
 * `skill` — Query and manage agent skills
+* `hooks` — Let AoE write agent hooks into each agent's own config, for every agent and every profile
 * `serve` — Start the aoe daemon: REST/WebSocket API, plus the web dashboard in builds that embed it
 * `url` — Print the URL of a running `aoe serve` daemon
 * `acp` — Manage the ACP structured-view workers (doctor, ps, logs, prompt, approve, ...)
@@ -1560,6 +1564,35 @@ Copy AoE-managed skills into the agents' own skills directories
 
 
 
+## `aoe hooks`
+
+Let AoE write agent hooks into each agent's own config, for every agent and every profile
+
+**Usage:** `aoe hooks <COMMAND>`
+
+###### **Subcommands:**
+
+* `status` — Show whether AoE may write agent hooks, and what they resolve for a profile
+* `approve` — Let AoE write agent hooks for every agent, on every profile
+
+
+
+## `aoe hooks status`
+
+Show whether AoE may write agent hooks, and what they resolve for a profile
+
+**Usage:** `aoe hooks status`
+
+
+
+## `aoe hooks approve`
+
+Let AoE write agent hooks for every agent, on every profile
+
+**Usage:** `aoe hooks approve`
+
+
+
 ## `aoe serve`
 
 Start the aoe daemon: REST/WebSocket API, plus the web dashboard in builds that embed it
```

**File**: `docs/guides/configuration.md` (modified, +10/-2)
```diff
@@ -36,7 +36,7 @@ On macOS nothing is moved for you: an existing `~/.agent-of-empires/` keeps bein
   logs/
 ```
 
-`state.toml` holds global-only UI bookkeeping (tour seen, last browse directory, sort order, dismissed tips and updates). It is not a setting: it has no profile or repo layer and no TUI or web control. `GET /api/settings` still reports these under `app_state.*`, but `PATCH` rejects writes to them.
+`state.toml` holds global-only bookkeeping (tour seen, last browse directory, sort order, dismissed tips and updates, and the agent hook approval described below). It is not a setting: it has no profile or repo layer. The TUI and the web dashboard both read some of these fields, the TUI writes several of them, and the CLI writes a flag when asked; the agent hook approval below is set by `aoe hooks approve` and is hand-editable. `GET /api/settings` still reports these under `app_state.*`, but `PATCH` rejects writes to them.
 
 ## Environment variables
 
@@ -92,7 +92,7 @@ sidebar_position = "left" # left | right; TUI session list
 | `sidebar_position` | `"left"` | TUI session sidebar position: `left` or `right`. Global only. Narrow terminals keep the stacked layout. |
 | `tie_workdir_to_name` | `true` | Keep a managed worktree session's directory named after its title. See [Worktrees](worktrees.md#naming). |
 | `pre_trust_agent_folders` | `false` | Pre-trust each host session's worktree in the agent's own config (Claude Code, Codex, Gemini) so it does not open on a folder-trust prompt. Config-dir overrides are honored, and an `agent_config_dir` entry wins over them. Trust also activates the repo's `.claude/settings.json`, hooks included, so enable it only for directories you would have trusted by hand. Sandboxed sessions always pre-trust their own staged config. |
-| `agent_status_hooks` | `true` | Install status-detection hooks into the agent's config; see [Adding a New Agent](../development/adding-agents.md#hook-format-reference). Disabling it leaves status to pane reading but keeps identity hooks used for native resume. |
+| `agent_status_hooks` | `true` | Install status-detection hooks into the agent's config; see [Agent hook approval](#agent-hook-approval) for the approval that gates it and [Adding a New Agent](../development/adding-agents.md#hook-format-reference) for the formats. Disabling it leaves status to pane reading but keeps identity hooks used for native resume. |
 | `opencode_preassign_session_id` | `false` | Pre-assign OpenCode's native session id before a host launch (about two seconds per session) so resume captures it. Unsupported for sandboxed OpenCode. |
 | `smart_rename` | `true` | Auto-rename a still-default-named structured session from its first turn, using the session's agent in one-shot mode. Title only; a session you named is never touched. Skipped for agents with no one-shot mode and command-overridden agents. Overridable per project. |
 | `smart_rename_agent` | `""` | Agent used for one-shot utility calls (the rename title and the conversation summary). Empty means the session's own agent. A sandboxed session only mounts its own agent's credentials, so a different value makes it ineligible instead of falling back. |
@@ -140,6 +140,14 @@ on_error = "notify-send -u critical -a aoe 'AoE: Error' \"$AOE_SESSION_TITLE err
 
 Each command receives `AOE_SESSION_ID`, `AOE_SESSION_TITLE`, `AOE_PROJECT_PATH`, `AOE_PROFILE`, `AOE_TOOL`, `AOE_GROUP_PATH`, `AOE_OLD_STATUS`, `AOE_NEW_STATUS`, and `AOE_STATUS_CHANGED_AT`.
 
+## Agent hook approval
+
+`agent_status_hooks` (above) makes AoE write hook entries into the agent's own config, which lives under your home directory unless `agent_config_dir`, the profile `environment`, or a config-dir variable exported in the launching shell moves it, so status comes from the agent reporting it rather than from reading its pane. That writes into files you own and runs a command whenever the agent fires a hook, so it is gated behind a one-time approval. The TUI offer
```

**File**: `docs/guides/repo-config.md` (modified, +1/-1)
```diff
@@ -69,6 +69,6 @@ auto_cleanup = true
 
 The first time AoE sees hooks in a repo it prompts you to review and approve them, so an untrusted repo cannot run arbitrary commands. Trust decisions are stored globally, shared across profiles, and keyed to the commands themselves, so a change to `.agent-of-empires/config.toml` re-prompts. The same gate covers a repo's [project-local MCP servers](mcp-servers.md#project-local-servers-need-repo-trust).
 
-`aoe add --trust-hooks .` skips the prompt, for CI or repos you control.
+`aoe add --trust-hooks .` skips the prompt, for CI or repos you control. It covers this gate only. The hooks AoE writes into the *agent's own* config, not the ones a repo declares, are a separate approval: see [Agent hook approval](configuration.md#agent-hook-approval).
 
 Repo values are the last layer of the [configuration precedence](configuration.md), overriding global and profile values field by field.
```

**File**: `src/agents.rs` (modified, +29/-0)
```diff
@@ -239,6 +239,12 @@ pub struct SidecarHooks {
     pub selected_agent_hooks: Option<SelectedAgentHooks>,
     pub format: SidecarFormat,
     pub events: &'static [SidecarHookEvent],
+    /// Files this agent writes beside its host config, beyond `host_config_subpath`.
+    pub sibling_settings: &'static [SiblingSettings],
+    /// What [`Self::post_install_host`] does beyond the files, in the words of
+    /// whoever wrote it. A post-install hook can change launcher state, which is
+    /// not a file AoE resolves, so the consent surfaces have to name it.
+    pub post_install_note: Option<&'static str>,
 }
 
 #[derive(Debug)]
@@ -247,6 +253,16 @@ pub struct SelectedAgentHooks {
     pub resolve_config_file: fn(&std::path::Path, &str) -> std::path::PathBuf,
 }
 
+/// A file an installer writes beside its host config. The consent disclosure
+/// cannot derive these, so the installer names them.
+#[derive(Debug)]
+pub struct SiblingSettings {
+    /// What the file holds, for the disclosure line.
+    pub label: &'static str,
+    /// File name, resolved against the config path's parent.
+    pub file: &'static str,
+}
+
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum SidecarFormat {
     SettlToml,
@@ -636,6 +652,8 @@ pub const AGENTS: &[AgentDef] = &[
             selected_agent_hooks: None,
             format: SidecarFormat::KiroJson,
             events: CURSOR_HOOK_EVENTS,
+            sibling_settings: &[],
+            post_install_note: None,
         }),
         session_support: session_support(
             ResumeStrategy::Flag("--resume"),
@@ -696,6 +714,8 @@ pub const AGENTS: &[AgentDef] = &[
             selected_agent_hooks: None,
             format: SidecarFormat::SettlToml,
             events: SETTL_SIDECAR_EVENTS,
+            sibling_settings: &[],
+            post_install_note: None,
         }),
         host_only: true,
         ..agent(
@@ -717,6 +737,11 @@ pub const AGENTS: &[AgentDef] = &[
             selected_agent_hooks: None,
             format: SidecarFormat::HermesYaml,
             events: HERMES_SIDECAR_EVENTS,
+            sibling_settings: &[SiblingSettings {
+                label: "Hermes shell-hook consent allowlist",
+                file: crate::hooks::HERMES_ALLOWLIST_FILE,
+            }],
+            post_install_note: None,
         }),
         session_support: session_support(
             ResumeStrategy::Flag("--resume"),
@@ -747,6 +772,8 @@ pub const AGENTS: &[AgentDef] = &[
             }),
             format: SidecarFormat::KiroJson,
             events: KIRO_SIDECAR_EVENTS,
+            sibling_settings: &[],
+            post_install_note: Some(crate::hooks::KIRO_DEFAULT_AGENT_NOTE),
         }),
         ..agent(
             "kiro",
@@ -789,6 +816,8 @@ pub const AGENTS: &[AgentDef] = &[
             selected_agent_hooks: None,
             format: SidecarFormat::KimiToml,
             events: KIMI_SIDECAR_EVENTS,
+            sibling_settings: &[],
+            post_install_note: None,
         }),
         session_support: session_support(
             ResumeStrategy::Flag("--session"),
```

**File**: `src/cli/definition.rs` (modified, +10/-0)
```diff
@@ -8,6 +8,7 @@ use super::add::AddArgs;
 use super::cityhall::CityHallCommands;
 use super::extract_session_id::ExtractSessionIdArgs;
 use super::group::GroupCommands;
+use super::hooks::HooksCommands;
 use super::init::InitArgs;
 use super::killall::KillallArgs;
 use super::list::ListArgs;
@@ -212,6 +213,13 @@ pub enum Commands {
         command: SkillCommands,
     },
 
+    /// Let AoE write agent hooks into each agent's own config, for every
+    /// agent and every profile
+    Hooks {
+        #[command(subcommand)]
+        command: HooksCommands,
+    },
+
     /// Start the aoe daemon: REST/WebSocket API, plus the web dashboard in
     /// builds that embed it
     Serve(ServeArgs),
@@ -285,6 +293,7 @@ pub const CLI_COMMAND_NAMES: &[&str] = &[
     "telemetry",
     "mcp",
     "skill",
+    "hooks",
     "serve",
     "url",
     "acp",
@@ -323,6 +332,7 @@ pub fn command_name(command: &Commands) -> Option<&'static str> {
         Commands::Telemetry { .. } => "telemetry",
         Commands::Mcp { .. } => "mcp",
         Commands::Skill { .. } => "skill",
+        Commands::Hooks { .. } => "hooks",
         Commands::Serve(_) => "serve",
         Commands::Url(_) => "url",
         Commands::Acp { .. } => "acp",
```

---

### Incident Patch 3: `1d687df1` (2026-09-30)
**Commit Message**: test: fix settings sidebar and tool swap registry flakes (#4220)

The TUI cleared the screen again on its first loop tick after the startup
frame and e2e ack, so a capture before the next paint saw a blank title
row. The startup clear now consumes the pending redraw.

The tool swap test let the restart worker reinstall profile 'test'
registry entries after its guards restored them. It now waits for the
worker result first.

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `src/tui/app.rs` (modified, +3/-0)
```diff
@@ -527,6 +527,9 @@ impl App {
         crate::tmux::spawn_snapshot_poller();
 
         crate::tui::clear_terminal(terminal)?;
+        // This clear satisfies any pending redraw; honoring it on the first tick
+        // would blank the first frame until the next paint.
+        self.needs_redraw = false;
         self.draw(terminal)?;
         #[cfg(feature = "e2e-tests")]
         e2e_render_ack(true)?;
```

**File**: `src/tui/home/tests/archive_restart_grouping.rs` (modified, +11/-0)
```diff
@@ -589,6 +589,17 @@ fn restart_selected_session_tool_swap_resolves_detect_as_for_the_row_profile() {
     env.view
         .restart_selected_session(None, Some("gjc"), None, None)
         .unwrap();
+    // The restart worker re-resolves the profile's config, reinstalling its registry
+    // entries; it must finish before the guards restore them.
+    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
+    while let Err(error) = env.view.restart_poller.try_recv_result() {
+        assert_eq!(error, std::sync::mpsc::TryRecvError::Empty);
+        assert!(
+            std::time::Instant::now() < deadline,
+            "restart worker did not finish"
+        );
+        std::thread::sleep(std::time::Duration::from_millis(20));
+    }
 
     let disk = Storage::new_unwatched("test").unwrap().load().unwrap();
     let row = disk.iter().find(|i| i.id == id).unwrap();
```

---

### Incident Patch 4: `7a8b943b` (2026-09-30)
**Commit Message**: fix(acp): refuse no-revive prompts for dead workers (#4219)

Co-authored-by: mikemikimike <mikemikimike@users.noreply.github.com>

**File**: `src/plugin/session_api.rs` (modified, +1/-1)
```diff
@@ -610,7 +610,7 @@ async fn sessions_turn_send(
         };
         let dispatch = deps
             .session_service
-            .prompt_dispatch_under_submission(&req.session_id, woke_idle_dormant)
+            .prompt_dispatch_under_submission(&req.session_id, woke_idle_dormant, false)
             .await;
         if let crate::acp::dispatch::PromptDispatch::Queued { reason } = dispatch {
             if !matches!(reason, crate::acp::dispatch::QueueReason::WorkerDown) {
```

**File**: `src/server/api/acp/prompt.rs` (modified, +2/-2)
```diff
@@ -95,7 +95,7 @@ pub async fn acp_prompt(
     // (#3621). The wake already cleared the dormant marker, hence the flag.
     let dispatch = state
         .session_service
-        .prompt_dispatch_under_submission(&id, woke_idle_dormant)
+        .prompt_dispatch_under_submission(&id, woke_idle_dormant, req.no_revive)
         .await;
     // Refused before touching the pending-turn/queue state below, so a
     // rejected prompt leaves both untouched (#4081 review).
@@ -243,7 +243,7 @@ pub async fn acp_prompt_diff_comments(
     };
     let dispatch = state
         .session_service
-        .prompt_dispatch_under_submission(&id, woke_idle_dormant)
+        .prompt_dispatch_under_submission(&id, woke_idle_dormant, false)
         .await;
     // There is no queue row for a typed review, so refuse rather than publish
     // a card the agent would then reject as busy.
```

**File**: `src/server/api/acp/prompt/tests.rs` (modified, +61/-1)
```diff
@@ -299,7 +299,7 @@ async fn rate_limit_park_is_sendable_at_the_shared_decision_point() {
                 .await
                 .expect("session exists");
             service
-                .prompt_dispatch_under_submission(id_ref, false)
+                .prompt_dispatch_under_submission(id_ref, false, false)
                 .await
         };
         assert_eq!(
@@ -515,6 +515,66 @@ async fn no_revive_refuses_a_prompt_on_a_rate_limit_park() {
     }
 }
 
+/// #4109: a rate-limit park can retain a stale active-turn latch until the
+/// worker's `Stopped` event is persisted. `no_revive` still refuses while the
+/// worker is absent, regardless of the dispatch queue reason.
+#[tokio::test]
+async fn no_revive_refuses_a_workerless_rate_limit_park_with_a_stale_turn() {
+    let _app_dir = crate::session::test_support::isolate_app_dir();
+    let id = "sess-no-revive-stale-rate-limit".to_string();
+    let (state, launches) = failing_start_state(&id, true);
+    seed_elapsed_rate_limit_park(&state, &id, true);
+    state.instances.write().await[0].pending_initial_turn =
+        Some(crate::session::PendingInitialTurn {
+            text: "queued before the park".to_string(),
+            attachments: Vec::new(),
+            synthesized: true,
+        });
+
+    assert!(!state.acp_supervisor.is_running(&id).await);
+    assert!(
+        state
+            .session_service
+            .fold_control_state(&id)
+            .await
+            .turn_active,
+        "the fixture must retain a stale active-turn latch"
+    );
+
+    let response = acp_prompt(
+        State(Arc::clone(&state)),
+        Path(id.clone()),
+        no_revive_prompt_req("hello"),
+    )
+    .await
+    .into_response();
+
+    assert_eq!(response.status(), StatusCode::CONFLICT);
+    assert_eq!(
+        launches.load(std::sync::atomic::Ordering::SeqCst),
+        0,
+        "no_revive must not start a worker"
+    );
+    assert!(
+        state
+            .session_service
+            .queued_prompts_snapshot(&id)
+            .await
+            .is_empty(),
+        "a refusal must not enqueue the prompt"
+    );
+    assert!(
+        state.acp_event_store.rate_limit_park(&id).is_some(),
+        "the rate-limit park must remain intact"
+    );
+    assert!(
+        state.instances.read().await[0]
+            .pending_initial_turn
+            .is_some(),
+        "the refusal must preserve the pending initial turn"
+    );
+}
+
 /// #3621: a direct prompt parks while a drain owns the session, and the drain
 /// that follows leaves its row queued behind the turn the prompt started.
 #[tokio::test]
```

**File**: `src/server/session_service.rs` (modified, +6/-0)
```diff
@@ -1337,8 +1337,14 @@ impl SessionService {
         &self,
         id: &str,
         idle_dormant: bool,
+        no_revive: bool,
     ) -> crate::acp::dispatch::PromptDispatch {
         let running = self.acp_supervisor.is_running(id).await;
+        if no_revive && !running {
+            return crate::acp::dispatch::PromptDispatch::Queued {
+                reason: crate::acp::dispatch::QueueReason::WorkerDown,
+            };
+        }
         // Settled here, under the guard, rather than probed by each handler before it
         // claims one.
         let rate_limit_parked = !running && !idle_dormant && self.is_rate_limit_parked(id).await;
```

---

### Incident Patch 5: `996315a7` (2026-09-30)
**Commit Message**: fix(acp): reject agent-supplied prompt completion markers (#4218)

Co-authored-by: mikemikimike <mikemikimike@users.noreply.github.com>

**File**: `src/acp/acp_client/control.rs` (modified, +16/-17)
```diff
@@ -1,7 +1,7 @@
 //! The v3 runner control socket: connecting, establishing a session, and
 //! routing ACP frames over it.
 
-use crate::acp::control_protocol::{self, ControlBody, SessionReplayed};
+use crate::acp::control_protocol::{self, ControlBody, PromptCompletedMarker, SessionReplayed};
 use crate::acp::state::Event;
 use agent_client_protocol::schema::v1::PromptResponse;
 use agent_client_protocol::JsonRpcMessage as _;
@@ -51,21 +51,6 @@ type LocalOutcome = (
     control_protocol::PromptOutcome,
 );
 
-/// Daemon-minted notification written to the crate after a local prompt's
-/// `PromptCompleted`. The crate handles notifications in order, so the waiter
-/// resolves only after the updates the agent sent before its reply, such as a
-/// rate-limit reset, have been applied.
-#[derive(
-    Debug,
-    Clone,
-    Default,
-    serde::Serialize,
-    serde::Deserialize,
-    agent_client_protocol::JsonRpcNotification,
-)]
-#[notification(method = "_aoe/prompt_completed")]
-pub(super) struct PromptCompletedMarker {}
-
 enum PromptCompletion {
     Adopted,
     Pending {
@@ -1763,7 +1748,21 @@ mod tests {
                             ControlBody::PromptStarted { prompt_req_id: 1 },
                             ControlBody::Notify {
                                 method: "session/update".into(),
-                                params: serde_json::json!({"sessionId":"s","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"live"}}}),
+                                params: serde_json::json!({
+                                    "sessionId": "s",
+                                    "update": {
+                                        "sessionUpdate": "usage_update",
+                                        "used": 100,
+                                        "size": 200,
+                                        "_meta": {
+                                            "_claude/rateLimit": {
+                                                "status": "rejected",
+                                                "rateLimitType": "five_hour",
+                                                "resetsAt": 4_102_444_800_i64
+                                            }
+                                        }
+                                    }
+                                }),
                             },
                             ControlBody::PromptCompleted {
                                 prompt_req_id: 1,
```

**File**: `src/acp/acp_client/session_identity.rs` (modified, +1/-2)
```diff
@@ -9,10 +9,9 @@ use std::sync::Arc;
 use std::sync::Mutex as StateMutex;
 use tokio::sync::{oneshot, Mutex, MutexGuard, Notify};
 
-use super::control::PromptCompletedMarker;
 use super::errors::acp_internal_error;
 use crate::acp::control_protocol::{
-    SessionReplayed, MAX_CONTROL_QUEUE_BYTES, MAX_CONTROL_QUEUE_FRAMES,
+    PromptCompletedMarker, SessionReplayed, MAX_CONTROL_QUEUE_BYTES, MAX_CONTROL_QUEUE_FRAMES,
 };
 
 // The replayed backlog a reattach flushes is exactly the runner's detached
```

**File**: `src/acp/control_protocol.rs` (modified, +10/-0)
```diff
@@ -33,6 +33,16 @@ pub const MAX_CONTROL_QUEUE_BYTES: usize = 128 * 1024 * 1024;
 #[notification(method = "_aoe/session_replayed")]
 pub struct SessionReplayed {}
 
+/// Daemon-minted notification written after a local prompt's completion.
+///
+/// The crate handles notifications in order, so the waiter resolves only after
+/// the updates the agent sent before its reply have been applied.
+#[derive(
+    Debug, Clone, Default, Serialize, Deserialize, agent_client_protocol::JsonRpcNotification,
+)]
+#[notification(method = "_aoe/prompt_completed")]
+pub(crate) struct PromptCompletedMarker {}
+
 /// A single control frame.
 #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
 #[serde(tag = "kind", rename_all = "snake_case")]
```

**File**: `src/process/runner/shared.rs` (modified, +36/-13)
```diff
@@ -5,7 +5,7 @@ use super::jsonrpc::{
     parse_agent_call_outcome, parse_notification, parse_request_value_id, parse_response,
     parse_response_id,
 };
-use crate::acp::control_protocol::{self, ControlBody, SessionReplayed};
+use crate::acp::control_protocol::{self, ControlBody, PromptCompletedMarker, SessionReplayed};
 use crate::process::worker_registry;
 use agent_client_protocol::JsonRpcMessage;
 use std::collections::{HashMap, HashSet, VecDeque};
@@ -329,7 +329,9 @@ impl RunnerShared {
         }
 
         if let Some((method, params)) = parse_notification(line) {
-            if SessionReplayed::matches_method(&method) {
+            if SessionReplayed::matches_method(&method)
+                || PromptCompletedMarker::matches_method(&method)
+            {
                 return;
             }
             self.enqueue(
@@ -1228,7 +1230,7 @@ mod tests {
     }
 
     #[tokio::test]
-    async fn prompt_completion_follows_the_notifications_before_it() {
+    async fn prompt_completion_follows_usage_update_and_rejects_agent_marker() {
         let (shared, stdin, _child) = shared_with_stdin().await;
         let attachment_id = shared.begin_attachment().await;
         let id = shared
@@ -1237,28 +1239,49 @@ mod tests {
             .expect("prompt written");
         assert!(shared.prompt_requests.lock().await.contains(&id));
 
-        for text in ["first", "second"] {
-            let line = format!(
-                "{{\"jsonrpc\":\"2.0\",\"method\":\"session/update\",\"params\":{{\"text\":\"{text}\"}}}}\n"
-            );
-            shared.deliver_line(line.as_bytes(), &stdin).await;
-        }
+        shared
+            .deliver_line(
+                br#"{"jsonrpc":"2.0","method":"_aoe/prompt_completed","params":{}}"#,
+                &stdin,
+            )
+            .await;
+        let usage_update = serde_json::json!({
+            "sessionId": "s",
+            "update": {
+                "sessionUpdate": "usage_update",
+                "used": 100,
+                "size": 200,
+                "_meta": {
+                    "_claude/rateLimit": {
+                        "status": "rejected",
+                        "rateLimitType": "five_hour",
+                        "resetsAt": 4_102_444_800_i64
+                    }
+                }
+            }
+        });
+        let line = serde_json::json!({
+            "jsonrpc": "2.0",
+            "method": "session/update",
+            "params": usage_update.clone()
+        })
+        .to_string();
+        shared.deliver_line(line.as_bytes(), &stdin).await;
         let resp = format!(
             "{{\"jsonrpc\":\"2.0\",\"id\":{id},\"result\":{{\"stopReason\":\"end_turn\"}}}}\n"
         );
         shared.deliver_line(resp.as_bytes(), &stdin).await;
 
         assert!(shared.prompt_requests.lock().await.is_empty());
-        let notify = |text: &str| ControlBody::Notify {
+        let usage = ControlBody::Notify {
             method: "session/update".into(),
-            params: serde_json::json!({ "text": text }),
+            params: usage_update,
         };
         assert_eq!(
             queued(&shared).await,
             vec![
                 ControlBody::PromptStarted { prompt_req_id: id },
-                notify("first"),
-                notify("second"),
+                usage,
                 ControlBody::PromptCompleted {
                     prompt_req_id: id,
                     outcome: PromptOutcome::Completed {
```

---

### Incident Patch 6: `88b232a1` (2026-09-30)
**Commit Message**: fix(acp): prevent auto-resume from reinstalling a superseded continuation (#4179)

* fix(acp): refuse a rate-limit continuation a prompt superseded

An auto-resume could reinstall a rate-limit-interrupted prompt after a
newer manual prompt had superseded it: the continuation was read from the
event store and installed with no prompt-submission authority in between,
and the installer only checked that the pending-turn slot was free, which
a superseding submission leaves exactly as it found it.

Bind the install to the session's existing submission authority. The
producer now revalidates under that guard: the park must still stand and
be uncapped, and the session must carry no queued prompt, which is the
only state a queued submission changes since it publishes no event. The
reconciler tick claims the guard without waiting, treating contention as
a refusal like its redelivery-cap CAS does, so it never stalls the pass.
/acp/spawn claims it ahead of the instance lock, keeping the ordering the
other mutation surfaces use, and the resume breadcrumb now follows the
accepted decision so a refused continuation no longer spends a
redelivery.

Refs #4092

* fix(acp): close the review findings

**File**: `src/daemon/wire.rs` (modified, +2/-0)
```diff
@@ -52,6 +52,8 @@ pub struct QueuedPromptEntry {
     pub text: String,
     #[serde(default, skip_serializing_if = "Vec::is_empty")]
     pub attachments: Vec<PromptAttachmentRef>,
+    /// Server-stamped; the resume admission orders queue rows against the
+    /// rate-limit park, so a client clock must not reach it (#4092).
     pub created_at: String,
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub origin_device: Option<String>,
```

**File**: `src/server/acp_reconciler/mod.rs` (modified, +3/-1)
```diff
@@ -18,7 +18,9 @@ use crate::acp::event_store::EventStore;
 use crate::daemon::AcpWorkerState;
 use crate::session::Instance;
 
-pub(crate) use rate_limit::enqueue_rate_limit_continuation;
+pub(crate) use rate_limit::install_rate_limit_continuation;
+#[cfg(test)]
+pub(crate) use rate_limit::ContinuationOutcome;
 pub(crate) use resume::{command_override_for_spawn, trigger_resume_background, ResumeTrigger};
 
 use resume::{resume_one, ResumeTarget};
```

**File**: `src/server/acp_reconciler/rate_limit.rs` (modified, +356/-23)
```diff
@@ -49,8 +49,60 @@ fn rate_limit_unknown_reset_retry_at(recorded_at_ms: i64, redeliveries: i64) ->
     DateTime::from_timestamp_millis(recorded_at_ms).unwrap_or_else(Utc::now) + retry_after
 }
 
-/// Queues the rate-limit-interrupted prompt as the next turn so a resume continues the work (#3028).
-pub(crate) async fn enqueue_rate_limit_continuation(state: &Arc<AppState>, id: &str) {
+fn row_minted_at_ms(entry: &crate::daemon::QueuedPromptEntry) -> Option<i64> {
+    DateTime::parse_from_rfc3339(&entry.created_at)
+        .ok()
+        .map(|queued_at| queued_at.timestamp_millis())
+}
+
+/// Whether any queued prompt was minted after the limit that interrupted the
+/// turn, so one of them replaced the continuation. Checking every row and not
+/// the next one is what honours a replacement queued behind a follow-up the
+/// user typed before the limit; that shape costs the interrupted prompt
+/// instead, and the alternative costs the user's freshest word.
+///
+/// An unknown limit never supersedes: the interrupted request is the older one
+/// and losing it is final, since the first prompt the drain delivers retires
+/// the park.
+fn queue_supersedes(minted_at_ms: &[i64], limit_at_ms: Option<i64>) -> bool {
+    let Some(limit_at_ms) = limit_at_ms else {
+        return false;
+    };
+    minted_at_ms
+        .iter()
+        .any(|queued_at| *queued_at > limit_at_ms)
+}
+
+/// What the continuation producer decided for one session (#4092).
+#[must_use]
+pub(crate) enum ContinuationOutcome {
+    /// The interrupted prompt is the next turn, is already installed, or there
+    /// was nothing to replay. Only this outcome licenses the automatic
+    /// `RateLimitAutoResumed`, which is the budget's arming step.
+    Stands,
+    /// A queued prompt owns the next turn, and any continuation an earlier
+    /// cadence installed is cleared. That prompt has no other route to a
+    /// worker, so the caller still frees the respawn, but no automatic
+    /// breadcrumb.
+    SupersededByQueue,
+}
+
+/// Installs the rate-limit-interrupted prompt as the next turn so a resume
+/// continues the work (#3028).
+///
+/// Takes the session's submission authority by value: a second claim by the
+/// same task would deadlock on the mutex the caller already holds, and holding
+/// it across the checks is what stops a turn-accepting surface from slipping
+/// between them and the install (#4092).
+///
+/// Park liveness is not a supersession oracle here
+/// ([`crate::acp::event_store::EventStore::rate_limit_park`]): a fresh worker
+/// publishes `AcpSessionAssigned`, which retires its own park.
+pub(crate) async fn install_rate_limit_continuation(
+    state: &Arc<AppState>,
+    id: &str,
+    _submission: tokio::sync::OwnedMutexGuard<()>,
+) -> ContinuationOutcome {
     let Some(Some((text, attachments))) = query_store(
         &state.acp_event_store,
         id,
@@ -59,17 +111,59 @@ pub(crate) async fn enqueue_rate_limit_continuation(state: &Arc<AppState>, id: &
     )
     .await
     else {
-        return;
+        return ContinuationOutcome::Stands;
     };
+    #[cfg(test)]
+    state.session_service.await_install_barrier(id).await;
+    // A queued prompt publishes no event, so its row is the only record of a
+    // supersession. Only the mint times leave the read guard: a row carries its
+    // whole text, and copying that under the shared lock is not worth one
+    // timestamp.
+    let minted_at_ms: Vec<i64> = {
+        let instances = state.instances.read().await;
+        let Some(inst) = instances.iter().find(|i| i.id == id) else {
+            return ContinuationOutcome::Stands;
+        };
+        inst.queued_prompts
+            .iter()
+            .filter_map(row_minted_at_ms)
+            .collect()
+    };
+    if !minted_at_ms.is_empty() {
+        // `None` covers a pruned limit row and a failed probe alike, and
+        // neither proves a supersession, so the continuation stands.
+        let limit_at_
```

**File**: `src/server/api/acp/prompt.rs` (modified, +0/-1)
```diff
@@ -125,7 +125,6 @@ pub async fn acp_prompt(
             req.text.clone(),
             &attachments,
             None,
-            chrono::Utc::now().to_rfc3339(),
         )
         .await
         {
```

**File**: `src/server/api/acp/prompt/tests.rs` (modified, +195/-8)
```diff
@@ -528,14 +528,7 @@ async fn a_direct_prompt_and_the_queue_drain_cannot_both_own_the_same_turn() {
         .await;
     state
         .session_service
-        .enqueue_prompt(
-            &id,
-            "q1".into(),
-            "queued follow-up".into(),
-            vec![],
-            None,
-            "t0".into(),
-        )
+        .enqueue_prompt(&id, "q1".into(), "queued follow-up".into(), vec![], None)
         .await
         .expect("session exists");
 
@@ -618,6 +611,200 @@ async fn diff_comments_refuse_to_open_a_turn_another_submission_started() {
     )));
 }
 
+/// Seed the rate-limit state a resume acts on: prompt A interrupted by a limit
+/// whose park window has already elapsed, the state the install reads.
+/// Backdated an hour, under the redelivery cap. `busy` adds a running turn,
+/// which is what makes B queue rather than dispatch.
+fn seed_elapsed_rate_limit_park(state: &AppState, id: &str, busy: bool) {
+    let store = &state.acp_event_store;
+    let long_ago = chrono::Utc::now() - chrono::Duration::hours(1);
+    let at = long_ago.timestamp_millis();
+    let mut events = vec![
+        Event::UserPromptSent {
+            text: "interrupted prompt A".into(),
+            attachments: Vec::new(),
+            prompt_id: None,
+            synthesized: false,
+        },
+        Event::RateLimit {
+            info: crate::acp::state::RateLimitInfo {
+                status: "limited".into(),
+                resets_at: Some(long_ago),
+                kind: "usage".into(),
+            },
+        },
+        Event::Stopped {
+            reason: "rate_limited".into(),
+        },
+    ];
+    if busy {
+        events.push(Event::ThinkingStarted);
+    }
+    for (seq, event) in events.iter().enumerate() {
+        store
+            .record_at(id, seq as u64 + 1, event, at)
+            .expect("seed the rate-limit park");
+    }
+    state
+        .acp_supervisor
+        .hydrate_seqs([(id.to_string(), store.highest_seq(id))]);
+    let park = store.rate_limit_park(id).expect("an armed park");
+    assert!(!park.cap_reached, "the fixture must stay under the cap");
+    assert!(
+        store.rate_limited_turn_prompt(id).is_some(),
+        "the fixture must leave a continuation to install"
+    );
+}
+
+/// The pending continuation as it stands on disk, which the in-memory slot can
+/// disagree with. Reads the profile the writer resolved, and fails rather than
+/// returning `None` when the row is missing.
+async fn persisted_pending_turn(
+    state: &AppState,
+    id: &str,
+) -> Option<crate::session::PendingInitialTurn> {
+    let profile = state
+        .instances
+        .read()
+        .await
+        .iter()
+        .find(|i| i.id == id)
+        .expect("seeded session")
+        .source_profile
+        .clone();
+    crate::server::test_support::load_instances_from_disk_for_test(&profile)
+        .into_iter()
+        .find(|i| i.id == id)
+        .expect("the session row must be on disk, or this assertion is vacuous")
+        .pending_initial_turn
+}
+
+/// #4092: a manual prompt may not slip between a rate-limit continuation's
+/// store read and its installation. The producer holds the session's
+/// submission authority across that window, so B is provably serialized
+/// behind it rather than overtaking it and being overwritten.
+#[tokio::test]
+#[serial_test::serial]
+async fn a_manual_prompt_cannot_overtake_a_continuation_install() {
+    // `queued` is the #4079 shape: a live worker with a turn in flight parks B
+    // on the server queue. `direct` has no turn, so B starts one.
+    for queued in [false, true] {
+        let _app_dir = crate::session::test_support::isolate_app_dir();
+        let label = if queued { "queued" } else { "direct" };
+        let id = format!("sess-4092-{label}");
+        let inst = structured_instance(&id, false);
+        // An empty profile resolves the same way for the seeder, the writer and
+        // the reader, so 
```

---

### Incident Patch 7: `691b768e` (2026-09-29)
**Commit Message**: fix(web): read every setting from the layer it was saved to (#4145)

Closes #4144. Settings come in two layers, machine-wide and per-profile
overrides, and the web client had to pick one on every read and save. A
plain read meant machine-wide, so any caller that forgot to name the
active profile silently ignored what the settings page had saved. The
system health strip from #4014 shipped as a no-op on a plain `aoe serve`
that way, and the approval sound and other shell toggles had the same gap.

The server now owns the rule. A plain read returns the settings as they
apply to the served profile, and a plain save routes each field to the
layer it belongs in: the profile where a profile may override it,
machine-wide otherwise. Clients never choose, so a save always lands where
the read looks. Editors that show or set the inherited value ask for the
machine-wide layer explicitly. /api/about now names the served profile
even without --profile, which fixes the Scratch overrides dialog too.

Passphrase rules are unchanged in effect: any machine-wide field still
needs elevation, and profile fields need it only where the schema says.
That check moved from the route into the handler, since o

**File**: `docs/guides/configuration.md` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ Unset fields inherit from the layer above. List fields replace rather than exten
 
 Global-only settings use the global config. On upgrade, the default profile's values for them move there, and other profiles' values are removed. `PATCH /api/profiles/<name>/settings` rejects global-only fields with HTTP 400; use `PATCH /api/settings` instead.
 
+Over the web API, `GET /api/settings` returns the settings as they apply to the profile the server serves (or `?profile=<name>`): the profile's overrides over the global config. `PATCH /api/settings` saves each field to the layer it belongs in, that profile for fields it can override and the global config for the rest, so a save always lands where the read looks. Add `?layer=machine` to either to read or write the global config alone.
+
 A project registry entry can also override `worktree.enabled` and `session.smart_rename` for that project, from the web Projects view or the TUI add-project form. This override wins over all three layers. It lives in your own registry (`projects.json`), not the repo, so it does not weaken the `repo = "deny"` policy on either field.
 
 ## File locations
```

**File**: `src/server/api/system.rs` (modified, +364/-42)
```diff
@@ -205,16 +205,56 @@ pub async fn list_agents(State(state): State<Arc<AppState>>) -> Json<Vec<AgentIn
 #[derive(Deserialize)]
 pub struct SettingsQuery {
     pub profile: Option<String>,
+    /// `machine` reads the machine-wide layer alone, for editors that show
+    /// where a value lives. Every other read gets the effective view.
+    pub layer: Option<String>,
 }
 
+/// The profile this server serves: its `--profile`, else the default profile,
+/// which a plain `aoe serve` follows at runtime.
+fn served_profile(state: &AppState) -> String {
+    crate::session::config::effective_profile(&state.profile)
+}
+
+/// `GET /api/settings` returns the settings as they apply: the served profile's
+/// overrides over the machine-wide values, or `?profile=` for another profile.
+/// A bare read was once the machine-wide layer, so a caller that forgot the
+/// profile silently ignored every profile override (#4144).
 pub async fn get_settings(
+    State(state): State<Arc<AppState>>,
     axum::extract::Query(query): axum::extract::Query<SettingsQuery>,
 ) -> impl IntoResponse {
-    let config_result = if let Some(ref profile_name) = query.profile {
-        crate::session::resolve_config(profile_name)
-    } else {
-        crate::session::Config::load()
+    let machine_only = match query.layer.as_deref() {
+        None => false,
+        Some("machine") if query.profile.is_none() => true,
+        Some("machine") => {
+            return api_error(
+                StatusCode::BAD_REQUEST,
+                "validation_failed",
+                "`layer=machine` cannot be combined with `profile`",
+            )
+        }
+        Some(other) => {
+            return api_error(
+                StatusCode::BAD_REQUEST,
+                "validation_failed",
+                format!("Unknown settings layer '{other}'"),
+            )
+        }
     };
+    let profile = query.profile.unwrap_or_else(|| served_profile(&state));
+    if let Err(e) = validate_profile_name(&profile) {
+        return api_error(StatusCode::BAD_REQUEST, "validation_failed", e);
+    }
+    let config_result = tokio::task::spawn_blocking(move || {
+        if machine_only {
+            crate::session::Config::load()
+        } else {
+            crate::session::resolve_config(&profile)
+        }
+    })
+    .await
+    .unwrap_or_else(|e| Err(anyhow::anyhow!(e)));
 
     match config_result {
         Ok(config) => match serde_json::to_value(&config) {
@@ -251,32 +291,201 @@ fn reject_response(rej: PatchRejection) -> axum::response::Response {
         .into_response()
 }
 
-/// Persist a global patch and apply side effects for the sections it changes.
+/// Split a patch into the leaves each layer owns. Profile-overridable fields
+/// go to the profile; the rest (global-only, plugin sections, and unknown
+/// leaves, which machine-wide validation then rejects) go machine-wide.
+fn split_patch_by_layer(
+    descriptors: &[crate::session::config::settings_schema::FieldDescriptor],
+    patch: serde_json::Map<String, serde_json::Value>,
+) -> (serde_json::Value, serde_json::Value) {
+    let mut machine = serde_json::Map::new();
+    let mut profile = serde_json::Map::new();
+    for (section, value) in patch {
+        let serde_json::Value::Object(fields) = value else {
+            machine.insert(section, value);
+            continue;
+        };
+        // An empty section still reaches validation, so `{"hooks": {}}` is refused.
+        if fields.is_empty() {
+            machine.insert(section, fields.into());
+            continue;
+        }
+        for (field, leaf) in fields {
+            let overridable = descriptors
+                .iter()
+                .any(|d| d.section == section && d.field == field && d.profile_overridable);
+            let target = if overridable {
+                &mut profile
+            } else {
+                &mut machine
+            };
+            target
+                .entry(section.clone())
+  
```

**File**: `src/server/auth.rs` (modified, +8/-10)
```diff
@@ -266,10 +266,8 @@ fn requires_elevation(method: &axum::http::Method, path: &str) -> bool {
         return false;
     }
 
-    // Settings + profile mutations.
-    if path == "/api/settings" && method == Method::PATCH {
-        return true;
-    }
+    // Settings + profile mutations. Settings saves gate in the handler, which
+    // elevates the machine-wide leaves and only the profile leaves that need it.
     if path == "/api/default-profile" && method == Method::PATCH {
         return true;
     }
@@ -1155,18 +1153,17 @@ mod tests {
         );
     }
 
-    /// The passphrase wall gates settings, profile management and device/login-session
-    /// management. `PATCH /api/profiles/{name}/settings` is body-gated inside
-    /// `update_profile_settings` instead, which re-issues the same 403 per leaf.
+    /// The passphrase wall gates profile management and device/login-session
+    /// management. Settings saves are body-gated in their handlers instead, which
+    /// re-issue the same 403 per leaf.
     #[test]
     fn requires_elevation_paths() {
         use axum::http::Method;
 
         let gated = [
-            (Method::PATCH, "/api/settings"),
-            // A trailing slash must not bypass the gate.
-            (Method::PATCH, "/api/settings/"),
             (Method::PATCH, "/api/default-profile"),
+            // A trailing slash must not bypass the gate.
+            (Method::PATCH, "/api/default-profile/"),
             (Method::POST, "/api/profiles"),
             (Method::PATCH, "/api/profiles/work/rename"),
             (Method::DELETE, "/api/profiles/work"),
@@ -1178,6 +1175,7 @@ mod tests {
         }
 
         let ungated = [
+            (Method::PATCH, "/api/settings"),
             (Method::PATCH, "/api/profiles/work/settings"),
             (Method::PATCH, "/api/profiles/work/settings/"),
             // Session traffic: attach, prompt, approve, spawn, delete.
```

**File**: `tests/integration/main.rs` (modified, +2/-0)
```diff
@@ -76,5 +76,7 @@ mod serve_dynamic_profile_rewire;
 #[cfg(debug_assertions)]
 mod serve_filewatch_propagation;
 #[cfg(debug_assertions)]
+mod serve_settings_layers;
+#[cfg(debug_assertions)]
 mod serve_settings_logging;
 mod telemetry;
```

**File**: `tests/integration/serve_settings_layers.rs` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+//! Settings reads and saves agree on the layer (#4144): a plain read is the
+//! served profile over machine-wide, and a plain save lands where it reads.
+
+use agent_of_empires::server::test_support::{build_router_for_test, build_test_app_state};
+use agent_of_empires::session::{self, Config};
+use axum::body::Body;
+use axum::extract::ConnectInfo;
+use axum::http::{Request, StatusCode};
+use serde_json::{json, Value};
+use std::net::SocketAddr;
+use tower::ServiceExt;
+
+async fn call(
+    app: &axum::Router,
+    method: &str,
+    uri: &str,
+    body: Option<Value>,
+) -> (StatusCode, Value) {
+    let mut request = Request::builder()
+        .method(method)
+        .uri(uri)
+        .header("host", "127.0.0.1")
+        .header("content-type", "application/json")
+        .body(body.map_or_else(Body::empty, |b| Body::from(b.to_string())))
+        .unwrap();
+    request
+        .extensions_mut()
+        .insert(ConnectInfo("127.0.0.1:5555".parse::<SocketAddr>().unwrap()));
+    let response = app.clone().oneshot(request).await.unwrap();
+    let status = response.status();
+    let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
+        .await
+        .unwrap();
+    (
+        status,
+        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
+    )
+}
+
+fn machine_default_tool() -> Option<String> {
+    Config::load().unwrap().session.default_tool
+}
+
+fn profile_default_tool(profile: &str) -> Option<Value> {
+    let overrides = serde_json::to_value(session::load_profile_config(profile).unwrap()).unwrap();
+    overrides.pointer("/session/default_tool").cloned()
+}
+
+#[tokio::test]
+#[serial_test::serial]
+async fn settings_read_and_save_agree_on_the_layer() {
+    let _home = crate::common::setup_temp_home();
+    let app = build_router_for_test(build_test_app_state(Vec::new()));
+    let (_, about) = call(&app, "GET", "/api/about", None).await;
+    let served = about["profile"]
+        .as_str()
+        .expect("about names the served profile")
+        .to_string();
+    assert!(!served.is_empty());
+    session::update_config(|config| config.session.default_tool = Some("claude".into())).unwrap();
+
+    // A plain save of a profile-overridable field lands in the served profile.
+    let (status, saved) = call(
+        &app,
+        "PATCH",
+        "/api/settings",
+        Some(json!({"session": {"default_tool": "codex", "sidebar_position": "right"}})),
+    )
+    .await;
+    assert_eq!(status, StatusCode::OK, "{saved}");
+    assert_eq!(saved["session"]["default_tool"], "codex");
+    assert_eq!(profile_default_tool(&served), Some(json!("codex")));
+    assert_eq!(machine_default_tool().as_deref(), Some("claude"));
+    // A global-only field in the same save goes machine-wide.
+    assert_eq!(
+        serde_json::to_value(Config::load().unwrap().session.sidebar_position).unwrap(),
+        "right"
+    );
+
+    // (uri, expected default_tool)
+    let reads = [
+        ("/api/settings".to_string(), "codex"),
+        ("/api/settings?layer=machine".to_string(), "claude"),
+        (format!("/api/settings?profile={served}"), "codex"),
+    ];
+    for (uri, expected) in reads {
+        let (status, body) = call(&app, "GET", &uri, None).await;
+        assert_eq!(status, StatusCode::OK, "{uri}: {body}");
+        assert_eq!(body["session"]["default_tool"], expected, "{uri}");
+    }
+
+    // An explicit machine-wide save sets the inherited value on purpose.
+    let (status, _) = call(
+        &app,
+        "PATCH",
+        "/api/settings?layer=machine",
+        Some(json!({"session": {"default_tool": "gemini"}})),
+    )
+    .await;
+    assert_eq!(status, StatusCode::OK);
+    assert_eq!(machine_default_tool().as_deref(), Some("gemini"));
+    assert_eq!(profile_default_tool(&served), Some(json!("codex")));
+
+    for uri in [
+        "/api/settings?layer=nope",
+        "/api/settings?layer=machine&profile=x",
+        "/api/settings?profil
```

---

### Incident Patch 8: `f42cfa8e` (2026-09-29)
**Commit Message**: fix(acp): refresh claude adapter for sonnet 5.5 (#4210)

**File**: `acp-worker/adapters/claude-agent-acp/package-lock.json` (modified, +66/-56)
```diff
@@ -8,17 +8,18 @@
       "name": "aoe-acp-adapter-claude-agent-acp",
       "version": "0.0.0",
       "dependencies": {
-        "@agentclientprotocol/claude-agent-acp": "0.81.1"
+        "@agentclientprotocol/claude-agent-acp": "0.84.0"
       }
     },
     "node_modules/@agentclientprotocol/claude-agent-acp": {
-      "version": "0.81.1",
-      "resolved": "https://registry.npmjs.org/@agentclientprotocol/claude-agent-acp/-/claude-agent-acp-0.81.1.tgz",
-      "integrity": "sha512-I+7tUPsrYnI0nBmdUonoRmdCi7ohyzZ0SeCpeIUFuVZ7a8ZxDyUNO6zBJpaeAIwuPXCk8aw+7t+QiwXS6FwskQ==",
+      "version": "0.84.0",
+      "resolved": "https://registry.npmjs.org/@agentclientprotocol/claude-agent-acp/-/claude-agent-acp-0.84.0.tgz",
+      "integrity": "sha512-Zhjyxvm7USDB/BAFx2L6U6rA3spJ6qwEDFbLgByzpmQMeZGuAlZPXhMcAc+Xsndj9kDh+OFJNjETRwGJCR1eTQ==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@agentclientprotocol/sdk": "1.5.0",
-        "@anthropic-ai/claude-agent-sdk": "0.3.280",
+        "@agentclientprotocol/sdk": "1.5.1",
+        "@anthropic-ai/claude-agent-sdk": "0.3.284",
+        "diff": "9.0.0",
         "zod": "4.6.5"
       },
       "bin": {
@@ -29,31 +30,31 @@
       }
     },
     "node_modules/@agentclientprotocol/sdk": {
-      "version": "1.5.0",
-      "resolved": "https://registry.npmjs.org/@agentclientprotocol/sdk/-/sdk-1.5.0.tgz",
-      "integrity": "sha512-524jwbB2iYWA+kWWyv9fhKbhU89dH/lu9u5EXwVNmfYzopV8BujCDxByBDZhxRUkB7RWIJzISCnwivdDk+bdVg==",
+      "version": "1.5.1",
+      "resolved": "https://registry.npmjs.org/@agentclientprotocol/sdk/-/sdk-1.5.1.tgz",
+      "integrity": "sha512-nSUIrC1fOR9+ppKfx9KdwjBBND2sAPzFHo4yVQrGbXZHnayUYpwL8CDVR5LSxbapY/oKMOzNP0wvwfyx3PS2KA==",
       "license": "Apache-2.0",
       "peerDependencies": {
         "zod": "^3.25.0 || ^4.0.0"
       }
     },
     "node_modules/@anthropic-ai/claude-agent-sdk": {
-      "version": "0.3.280",
-      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.280.tgz",
-      "integrity": "sha512-aIQSTKcCJcOgi125GAGQaNZUYgxbEBQwV2Ac+Utp0+gGUjIEWjTqz4B8kXr9XjkcCTYiRUMTDsXPAUfIcBDjnw==",
+      "version": "0.3.284",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.284.tgz",
+      "integrity": "sha512-NSoJwEq6nFSf8dtaacYx37QdGgqApI3eHFUlxclMLYi8irb6ZJwEaUnPnLUCyAyg9W/tMkgZC0GXWLRCc01I0w==",
       "license": "SEE LICENSE IN README.md",
       "engines": {
         "node": ">=18.0.0"
       },
       "optionalDependencies": {
-        "@anthropic-ai/claude-agent-sdk-darwin-arm64": "0.3.280",
-        "@anthropic-ai/claude-agent-sdk-darwin-x64": "0.3.280",
-        "@anthropic-ai/claude-agent-sdk-linux-arm64": "0.3.280",
-        "@anthropic-ai/claude-agent-sdk-linux-arm64-musl": "0.3.280",
-        "@anthropic-ai/claude-agent-sdk-linux-x64": "0.3.280",
-        "@anthropic-ai/claude-agent-sdk-linux-x64-musl": "0.3.280",
-        "@anthropic-ai/claude-agent-sdk-win32-arm64": "0.3.280",
-        "@anthropic-ai/claude-agent-sdk-win32-x64": "0.3.280"
+        "@anthropic-ai/claude-agent-sdk-darwin-arm64": "0.3.284",
+        "@anthropic-ai/claude-agent-sdk-darwin-x64": "0.3.284",
+        "@anthropic-ai/claude-agent-sdk-linux-arm64": "0.3.284",
+        "@anthropic-ai/claude-agent-sdk-linux-arm64-musl": "0.3.284",
+        "@anthropic-ai/claude-agent-sdk-linux-x64": "0.3.284",
+        "@anthropic-ai/claude-agent-sdk-linux-x64-musl": "0.3.284",
+        "@anthropic-ai/claude-agent-sdk-win32-arm64": "0.3.284",
+        "@anthropic-ai/claude-agent-sdk-win32-x64": "0.3.284"
       },
       "peerDependencies": {
         "@anthropic-ai/sdk": ">=0.93.0",
@@ -62,9 +63,9 @@
       }
     },
     "node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64": {
-      "version": "0.3.280",
-      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-darwin-arm64/-/claude-agent-sdk-darwin-arm64-0.3.280.tgz",
-      "integrity": "sha512-Yws
```

**File**: `acp-worker/adapters/claude-agent-acp/package.json` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@
   "private": true,
   "description": "Pinned ACP adapter installed on demand by `aoe acp doctor --fix` (issue #1017). Bumping this version is a deliberate aoe release event; dependabot proposes the bumps.",
   "dependencies": {
-    "@agentclientprotocol/claude-agent-acp": "0.81.1"
+    "@agentclientprotocol/claude-agent-acp": "0.84.0"
   }
 }
```

---

### Incident Patch 9: `7c8a49ae` (2026-09-29)
**Commit Message**: fix(web): describe only prompt dialogs and correct plugin href docs (#4209)

* fix(web): describe only prompt dialogs and correct plugin href docs

SessionGroupModal and DeleteSessionDialog have form and list bodies, so
they opt out of the shared Dialog's aria-describedby, as
ScratchOverridesModal does.

docs/plugin-api.md now states that a path normalizing to //host still
renders as a link and opens in a new tab.

Follow-up to #4195.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* docs(plugin): place //host paths on the dashboard origin in href rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix(web): describe dialogs by their prompt only

Dialog's describeBody flag becomes describedBy, an element id or false.
DeleteSessionDialog and SessionGroupModal point aria-describedby at the
prompt that names their target instead of opting out, so the target is
announced without reading the form or cleanup controls.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `docs/plugin-api.md` (modified, +1/-1)
```diff
@@ -308,7 +308,7 @@ The payload is capped at 64 KiB. Everything but `blocks` is validated strictly;
 
 `tone` is one of `neutral` / `info` / `success` / `warn` / `danger`. `color` is a validated `#rgb` / `#rrggbb` literal for a hue no tone names (a merged PR's purple); anything else is ignored.
 
-An `href` must be an `http(s)` URL or a same-origin path starting with a single `/`; a same-origin link navigates inside the dashboard, an external one opens a new tab, and any other value renders no link.
+An `href` renders as a link only when it is an `http(s)` URL or a path starting with a single `/` and containing no backslash, tab or line break. A link to a dashboard route navigates in place; any other link opens in a new tab, including a path that normalizes to `//host` such as `/..//evil.com`, which opens on the dashboard's own origin.
 
 **`row`** lays out at most two lines: `prefix` (mono, tone-tinted) and `label` lead the first with `value` pinned right; `sublabel` leads the second with `badges` (`{ text?, icon?, tone?, tooltip? }`) pinned right. `value_tone` colors the trailing token independently of the row, and `mono` monospaces the row's text. A `method` makes the row body a button firing that worker method, and an `href` alongside it becomes a separate trailing link-out; with `href` alone the whole row is the link. `selected` marks the row as the pane's current subject.
 
```

**File**: `web/src/components/DeleteSessionDialog.tsx` (modified, +7/-3)
```diff
@@ -10,6 +10,9 @@ interface AffectedSession {
   isSandboxed: boolean;
 }
 
+const DIALOG_ID = "delete-session-dialog";
+const PROMPT_ID = `${DIALOG_ID}-prompt`;
+
 interface Props {
   sessionTitle: string;
   branchName: string | null;
@@ -103,10 +106,11 @@ export function DeleteSessionDialog({
 
   return (
     <Dialog
-      id="delete-session-dialog"
+      id={DIALOG_ID}
       panelTestId="delete-session-dialog-panel"
       title={workspace ? "Delete Workspace" : "Delete Session"}
       titleClassName="text-status-error"
+      describedBy={PROMPT_ID}
       bodyClassName="px-5 py-4 space-y-3"
       onDismiss={onCancel}
       footer={
@@ -126,7 +130,7 @@ export function DeleteSessionDialog({
     >
       {workspace ? (
         <div className="space-y-2">
-          <p className="text-[13px] text-text-secondary">
+          <p id={PROMPT_ID} className="text-[13px] text-text-secondary">
             {permanent ? "Permanently delete this workspace?" : "Move this workspace to Trash?"}
           </p>
           <p className="text-[12px] text-text-dim" data-testid="delete-session-affected-count">
@@ -144,7 +148,7 @@ export function DeleteSessionDialog({
           </ul>
         </div>
       ) : (
-        <p className="text-[13px] text-text-secondary">
+        <p id={PROMPT_ID} className="text-[13px] text-text-secondary">
           Delete <span className="font-mono text-text-primary break-all">{sessionTitle}</span>?
         </p>
       )}
```

**File**: `web/src/components/Dialog.tsx` (modified, +4/-4)
```diff
@@ -15,7 +15,7 @@ export function Dialog({
   titleClassName = "text-text-primary",
   panelTestId,
   bodyClassName = "px-5 py-4",
-  describeBody = true,
+  describedBy = `${id}-desc`,
   onDismiss,
   footer,
   children,
@@ -25,8 +25,8 @@ export function Dialog({
   titleClassName?: string;
   panelTestId?: string;
   bodyClassName?: string;
-  /** Link the body as the dialog's description; turn off for form bodies. */
-  describeBody?: boolean;
+  /** Element id for aria-describedby: the body by default, a prompt id when the body has controls, or false. */
+  describedBy?: string | false;
   onDismiss: () => void;
   footer: ReactNode;
   children: ReactNode;
@@ -36,7 +36,7 @@ export function Dialog({
       role="dialog"
       aria-modal="true"
       aria-labelledby={`${id}-title`}
-      aria-describedby={describeBody ? `${id}-desc` : undefined}
+      aria-describedby={describedBy || undefined}
       data-testid={id}
       className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in"
       onClick={onDismiss}
```

**File**: `web/src/components/ScratchOverridesModal.tsx` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ export function ScratchOverridesModal({ profile, onClose }: Props) {
     <Dialog
       id="scratch-overrides-modal"
       title="Scratch session settings"
-      describeBody={false}
+      describedBy={false}
       onDismiss={close}
       footer={
         <>
```

**File**: `web/src/components/SessionGroupModal.tsx` (modified, +6/-2)
```diff
@@ -2,6 +2,9 @@ import { useRef, useState } from "react";
 import { CancelButton, ConfirmButton, Dialog } from "./Dialog";
 import { useDialogFocus } from "./dialogHooks";
 
+const DIALOG_ID = "session-group-modal";
+const PROMPT_ID = `${DIALOG_ID}-prompt`;
+
 interface Props {
   sessionTitle: string;
   currentGroup: string;
@@ -31,8 +34,9 @@ export function SessionGroupModal({ sessionTitle, currentGroup, onSave, onClose
 
   return (
     <Dialog
-      id="session-group-modal"
+      id={DIALOG_ID}
       title="Edit group"
+      describedBy={PROMPT_ID}
       bodyClassName="px-5 py-4 space-y-3"
       onDismiss={() => !saving && onClose()}
       footer={
@@ -49,7 +53,7 @@ export function SessionGroupModal({ sessionTitle, currentGroup, onSave, onClose
         </>
       }
     >
-      <p className="text-[13px] text-text-secondary">
+      <p id={PROMPT_ID} className="text-[13px] text-text-secondary">
         Move <span className="text-text-primary">{sessionTitle}</span> to a group.
       </p>
       <input
```

---

### Incident Patch 10: `952d3bfc` (2026-09-29)
**Commit Message**: fix(tui): align home preview input with what is painted (#4198)

* fix(tui): align home preview input with what is painted

- Mirror `<` and `>` when the sidebar is on the right, so each key moves
  the divider in its on-screen direction, as divider drags already do.
- Skip link underlines when a mounted structured transcript owns the
  pane, matching `preview_link_at`, which already refuses those clicks.
  Both now share `structured_owns_pane`.
- Place pane 0 of a composited preview with the same origin the cursor
  painter uses (`live_pane_origin`) and clip it to the preview, so a
  stacked split with a visible border row, or a rotated or swapped
  window with pane 0 off the left edge, forwards the clicked cell.

Closes #4075
Closes #4015
Closes #3550

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* fix(tui): key preview link and copy guards on the painted transcript

The structured-view guard matched any mounted transcript for the selected
session, so Terminal view on a structured session lost its real capture
links and drag-copy read transcript lines. Record whether the frame
painted the transcript and gate links, clicks and copy on that.

Pointer mapping now carries

**File**: `src/tui/home/input.rs` (modified, +240/-144)
```diff
@@ -169,56 +169,76 @@ fn split_bracketed_paste(text: &str) -> Vec<live_send::TmuxKey> {
     vec![live_send::TmuxKey::Paste(out)]
 }
 
-/// The rectangle mouse coordinates map into, or `None` when the pointer is not over the
+/// The visible part of the pane that receives input, and how many of its rows are
+/// clipped above the preview, so a cell maps to the pane row actually painted there.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+struct PaneSlice {
+    visible: ratatui::layout::Rect,
+    clipped_rows: u16,
+}
+
+impl PaneSlice {
+    /// The forwarded app's 1-based cell under screen `(col, row)`, clamped into the
+    /// visible slice.
+    fn cell(self, col: u16, row: u16) -> (u16, u16) {
+        let (cx, cy) = map_pane_cell(self.visible, col, row);
+        (cx, cy.saturating_add(self.clipped_rows))
+    }
+}
+
+/// The slice mouse coordinates map into, or `None` when the pointer is not over the
 /// pane that receives input.
 ///
-/// Normally the previewed pane is sized to the preview output rect, so the rect is the
+/// Normally the previewed pane is sized to the preview output rect, so the slice is the
 /// pane. On a composited preview the rect is the whole window while input still goes to
-/// pane 0 alone (#435, #488), so pane 0's sub-rectangle is the target: mapping against
-/// the full rect would report a column past its right edge as though the pane were
-/// window-wide. A pointer outside pane 0 is dropped rather than clamped, which would
-/// synthesise a click on its border.
-///
-/// Pane 0 may have a non-zero origin in the composite. The TUI bottom-follows a composite
-/// taller than its output, clipping reserved rows above pane 0, so its first visible cell
-/// still starts at `pane.x`/`pane.y`; adding `rect.top` here would shift input below the
-/// displayed pane.
-fn mouse_target_rect(
+/// pane 0 alone (#435, #488), so pane 0's slice is the target: mapping against the full
+/// rect would report a column past its right edge as though the pane were window-wide.
+/// A pointer outside pane 0 is dropped rather than clamped, which would synthesise a
+/// click on its border.
+fn mouse_target(
     cursor: &crate::tmux::PaneCursor,
-    pane: ratatui::layout::Rect,
+    view: super::PreviewTextView,
     col: u16,
     row: u16,
-) -> Option<ratatui::layout::Rect> {
-    // Unsplit: the rect is the pane, and containment stays the caller's business
-    // (`hit_preview` gates the press) with `map_pane_cell` clamping, so this must not
-    // start rejecting cells that used to clamp.
-    if cursor.composite_pane0.is_none() {
-        return Some(pane);
-    }
-    let pane0 = mouse_pane_rect(cursor, pane);
-    let inside = col >= pane0.x
-        && col < pane0.x.saturating_add(pane0.width)
-        && row >= pane0.y
-        && row < pane0.y.saturating_add(pane0.height);
-    inside.then_some(pane0)
+) -> Option<PaneSlice> {
+    let slice = mouse_pane(cursor, view);
+    // Unsplit: containment stays the caller's business (`hit_preview` gates the press)
+    // with `map_pane_cell` clamping, so this must not start rejecting cells that used to
+    // clamp.
+    (cursor.composite_pane0.is_none() || slice.visible.contains(Position::new(col, row)))
+        .then_some(slice)
 }
 
-/// The input pane's rectangle within the preview, with no containment test: pane 0's
-/// sub-rectangle on a composited preview, else the whole preview rect. Split from
-/// [`mouse_target_rect`] for mid-gesture events, which are not position-gated so a drag
-/// that began on pane 0 completes even after the pointer wanders off it.
-fn mouse_pane_rect(
-    cursor: &crate::tmux::PaneCursor,
-    pane: ratatui::layout::Rect,
-) -> ratatui::layout::Rect {
-    match cursor.composite_pane0 {
-        Some(rect) => ratatui::layout::Rect {
-            x: pane.x,
-            y: pane.y,
-            width: rect.width.min(pane.width),
-            height: rect.height.min(pane.height),
+/// The input pane's slice within the
```

**File**: `src/tui/home/lifecycle.rs` (modified, +1/-0)
```diff
@@ -333,6 +333,7 @@ impl HomeView {
             pending_daemon_start_session: None,
             structured_preview: None,
             structured_preview_pending: false,
+            structured_transcript_painted: false,
             pending_force_remove_session: None,
             pending_trash_session: None,
             pending_dialog_click_action: None,
```

**File**: `src/tui/home/mod.rs` (modified, +3/-0)
```diff
@@ -236,6 +236,9 @@ pub struct HomeView {
     pub(in crate::tui) structured_preview:
         Option<crate::tui::structured_view::embedded::EmbeddedView>,
     pub(in crate::tui) structured_preview_pending: bool,
+    /// The last frame painted the mounted structured transcript into the preview, so
+    /// `preview_text_view` maps transcript rows rather than the tmux capture.
+    pub(super) structured_transcript_painted: bool,
     pub(super) pending_force_remove_session: Option<String>,
     pub(super) pending_trash_session: Option<String>,
     pub(super) pending_dialog_click_action: Option<crate::tui::app::Action>,
```

**File**: `src/tui/home/render.rs` (modified, +57/-38)
```diff
@@ -129,29 +129,41 @@ fn live_resize_retry_due(
 /// Matches tmux's default `history-limit` and the VT grid's `SCROLLBACK_LINES`.
 const READING_CAPTURE_LINES: u16 = 2000;
 
-/// Map a tmux pane cursor onto the preview's output rect for live-send.
-///
-/// `cursor.x`/`y` are pane relative; on a composite, add the pane origin from
-/// [`crate::tmux::PaneCursor::composite_pane0`]. The renderer bottom-anchors captures that
-/// overflow `output`, so the row is `output.y + min(line_count, visible_rows) -
-/// pane_height + top + cursor.y`, while a short capture anchors at the top. That keeps the
-/// cursor on the same text row for the status-row offset (#3515) and the shorter-pane case
-/// (#2742). A hidden or out-of-bounds cursor yields `None`.
+/// Screen cell showing the input pane's `(0, 0)`, unclipped and possibly outside
+/// `view.pane`. On a composite this is pane 0's origin from
+/// [`crate::tmux::PaneCursor::composite_pane0`]. The pane is the capture's last
+/// `pane_height` lines and row `k` paints line `first_line + k`, so this holds at the live
+/// tail and scrolled back alike. Shared by the cursor painter and pointer mapping so a
+/// click on a painted cell reaches the same pane cell.
+pub(super) fn live_pane_origin(
+    view: super::PreviewTextView,
+    cursor: &crate::tmux::PaneCursor,
+) -> (i32, i32) {
+    let pane_top = view.total_lines as i32 - cursor.pane_height as i32 - view.first_line as i32;
+    let (left, top) = cursor
+        .composite_pane0
+        .map_or((0, 0), |rect| (rect.left as i32, rect.top as i32));
+    (
+        view.pane.x as i32 + left,
+        view.pane.y as i32 + pane_top + top,
+    )
+}
+
+/// Map a tmux pane cursor onto the painted preview for live-send, from
+/// [`live_pane_origin`]. That keeps the cursor on the same text row for the status-row
+/// offset (#3515) and the shorter-pane case (#2742). A hidden or out-of-bounds cursor
+/// yields `None`.
 pub(super) fn map_live_preview_cursor(
-    output: Rect,
-    visible_rows: usize,
-    line_count: usize,
+    view: super::PreviewTextView,
     cursor: crate::tmux::PaneCursor,
 ) -> Option<Position> {
     if !cursor.visible {
         return None;
     }
-    let anchor = line_count.min(visible_rows) as i32;
-    let (left, top) = cursor
-        .composite_pane0
-        .map_or((0, 0), |rect| (rect.left as i32, rect.top as i32));
-    let row = output.y as i32 + (anchor - cursor.pane_height as i32) + top + cursor.y as i32;
-    let col = output.x as i32 + left + cursor.x as i32;
+    let output = view.pane;
+    let (x, y) = live_pane_origin(view, &cursor);
+    let row = y + cursor.y as i32;
+    let col = x + cursor.x as i32;
     if row < output.y as i32
         || row >= output.y as i32 + output.height as i32
         || col < output.x as i32
@@ -2536,6 +2548,7 @@ impl HomeView {
 
     /// Paint the preview and refresh geometry used by selection and live-send.
     fn render_preview(&mut self, frame: &mut Frame, area: Rect, theme: &Theme) {
+        self.structured_transcript_painted = false;
         if self.system_health_open {
             self.preview_outer_area = area;
             self.preview_area = area;
@@ -2824,6 +2837,7 @@ impl HomeView {
                     .as_mut()
                     .and_then(|v| v.render(frame, layout.output, theme));
                 self.structured_preview = view;
+                self.structured_transcript_painted = true;
                 self.preview_pane_area = layout.output;
                 if let Some(g) = geometry {
                     self.preview_visible_rows = g.text_area.height as usize;
@@ -3125,10 +3139,11 @@ impl HomeView {
     /// underline a link whose text is not itself a URL is indistinguishable from the
     /// output around it. It is the affordance for `preview_link_at`.
     pub(super) fn paint_preview_links(&self, buf: &mut Buffer) {
-        // Same guard as `preview_link_at`: an overlay swallows the click, so underlining
-        // behind it 
```

**File**: `src/tui/home/tests/pickers_groups_sort.rs` (modified, +18/-7)
```diff
@@ -770,17 +770,28 @@ fn test_derived_group_collapsed_state_persists_to_config() {
     }
 }
 
-/// `<` / `>` step the list width by 5 from its default and clamp at the 10 / 80 bounds.
+/// `<` / `>` move the divider left / right by 5 from its default, so with the sidebar on
+/// the right they grow / shrink the list, and the width clamps at the 10 / 80 bounds.
 #[test]
 #[serial]
 fn test_list_width_steps_and_clamps() {
+    use crate::session::config::SidebarPosition;
+    // (sidebar position, width after `<`, width after `<` then `>` twice)
+    for (position, after_left, after_right) in [
+        (SidebarPosition::Left, 30, 40),
+        (SidebarPosition::Right, 40, 30),
+    ] {
+        let mut env = create_test_env_empty();
+        env.view.sidebar_position = position;
+        assert_eq!(env.view.list_width, 35);
+        env.view.handle_key(key(KeyCode::Char('<')), None);
+        assert_eq!(env.view.list_width, after_left, "{position:?}: `<`");
+        env.view.handle_key(key(KeyCode::Char('>')), None);
+        env.view.handle_key(key(KeyCode::Char('>')), None);
+        assert_eq!(env.view.list_width, after_right, "{position:?}: `>`");
+    }
+
     let mut env = create_test_env_empty();
-    assert_eq!(env.view.list_width, 35);
-    env.view.handle_key(key(KeyCode::Char('<')), None);
-    assert_eq!(env.view.list_width, 30);
-    env.view.handle_key(key(KeyCode::Char('>')), None);
-    env.view.handle_key(key(KeyCode::Char('>')), None);
-    assert_eq!(env.view.list_width, 40);
 
     env.view.list_width = 12;
     env.view.shrink_list();
```

#### Recent Merged Pull Requests:
- **PR #4223** (2026-09-30): chore(deps): bump the web-security group across 1 directory with 2 updates (@dependabot[bot])
- **PR #4222** (2026-09-30): chore: release v1.18.0 (@njbrake)
- **PR #4220** (2026-09-30): test: fix settings sidebar and tool swap registry flakes (@njbrake)
- **PR #4219** (2026-09-30): fix(acp): reject no-revive prompts for workerless rate-limit parks (@mikemikimike)
- **PR #4218** (2026-09-30): fix(acp): reject agent-supplied prompt completion markers (@mikemikimike)
- **PR #4216** (2026-09-29): chore(deps-dev): bump undici from 6.28.0 to 6.29.0 in /web (@dependabot[bot])
- **PR #4210** (2026-09-29): fix(acp): refresh claude adapter for sonnet 5.5 (@NicoCastillo)
- **PR #4209** (2026-09-29): fix(web): describe only prompt dialogs and correct plugin href docs (@njbrake)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
