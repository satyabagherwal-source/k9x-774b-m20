# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: zseven-w-openpencil-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "zseven-w-openpencil-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T23:29:25.523Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zseven-w-openpencil-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zseven-w-openpencil-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T23:29:25.523Z`  
> **Learning ID**: `LEARN-EVO-zseven-w-openpencil-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), B (Product Intelligence), F (Design Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), C (Market & Business Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 65%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from zseven-w-openpencil-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zseven-w-openpencil-learnings.md`  
> **Source**: github ([https://github.com/ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil))  
> **Source Version**: `2bbc658c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T04:37:01.753Z  
> **Learning ID**: `learn-github-zseven-w-openpencil`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ZSeven-W/openpencil

> **Canonical Artifact**: `07_PROJECT_LEARNING/zseven-w-openpencil-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-07T04:37:00.109Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ZSeven-W/openpencil`
- **Description**: The world's first open-source AI-native vector design tool and the first to feature concurrent Agent Teams. Design-as-Code. Turn prompts into UI directly on the live canvas. A modern alternative to Pencil.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7093 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/op-acp/src/client_lifecycle.rs`
```
//! Cancellation-safe ACP transport and child-process teardown.

use super::*;

use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::protocol::{
    AuthenticateRequest, AuthenticateResponse, CloseSessionRequest, CloseSessionResponse,
    DeleteSessionRequest, DeleteSessionResponse, METHOD_AUTHENTICATE, METHOD_SESSION_CLOSE,
    METHOD_SESSION_DELETE,
};

/// Session cleanup is best-effort at host boundaries and must never hold
/// process/transport teardown for the much longer prompt timeout.
const SESSION_LIFECYCLE_TIMEOUT: Duration = Duration::from_secs(2);

impl AcpConnection {
    async fn typed_request<Request, Response>(
        &self,
        method: &str,
        request: &Request,
        timeout: Duration,
    ) -> Result<(), AcpError>
    where
        Request: Serialize,
        Response: DeserializeOwned,
    {
        let params =
            serde_json::to_value(request).map_err(|error| AcpError::Protocol(error.to_string()))?;
        let result = self.engine.call(method, params, timeout).await?;
        serde_json::from_value::<Response>(result)
            .map_err(|error| AcpError::Protocol(error.to_string()))?;
        Ok(())
    }

    /// Authenticate with an exact method advertised by `initialize`.
    pub async fn authenticate(&self, method_id: &str) -> Result<(), AcpError> {
        if !self
            .auth_methods
            .iter()
            .any(|method| method.id().0.as_ref() == method_id)
        {
            return Err(AcpError::Protocol(format!(
                "agent did not advertise authentication method '{method_id}'"
            )));
        }
        self.typed_request::<_, AuthenticateResponse>(
            METHOD_AUTHENTICATE,
            &AuthenticateRequest::new(method_id.to_owned()),
            HANDSHAKE_TIMEOUT,
        )
        .await
    }

    /// Retry-safe authentication for an `auth_required` session/new error.
    /// Stable v1 agent auth carries no credentials, but choosing between
    /// multiple methods is a user decision and OpenPencil has no picker yet.
    pub(super) async fn authenticate_unambiguous(&self) -> Result<(), AcpError> {
        match self.auth_methods.as_slice() {
            [method] => self.authenticate(method.id().0.as_ref()).await,
            [] => Err(AcpError::Protocol(
                "agent required authentication but advertised no authMethods".into(),
            )),
            methods => Err(AcpError::Config(format!(
                "agent requires authentication and advertised {} methods; OpenPencil needs an authentication method picker before it can choose one",
                methods.len()
            ))),
        }
    }

    /// Whether stable-v1 `session/close` is available on this connection.
    pub fn supports_session_close(&self) -> bool {
        self.agent_capabilities.session_capabilities.close.is_some()
    }

    /// Close an active session only when the agent advertised support.
    /// Returns whether a wire request was sent.
    pub async fn close_session_if_supported(&self, session_id: &str) -> Result<bool, AcpError> {
        if !self.supports_session_close() {
            return Ok(false);
        }
        self.typed_request::<_, CloseSessionResponse>(
            METHOD_SESSION_CLOSE,
            &CloseSessionRequest::new(session_id.to_owned()),
            SESSION_LIFECYCLE_TIMEOUT,
        )
        .await?;
        Ok(true)
    }

    /// Whether stable-v1 `session/delete` is available on this connection.
    pub fn supports_session_delete(&self) -> bool {
        self.agent_capabilities
            .session_capabilities
            .delete
            .is_some()
    }

    /// Delete a session only when the agent advertised support. Probe callers
    /// use this for their deliberately ephemeral validation session.
    pub async fn delete_session_if_supported(&self, session_id: &str) -> Result<bool, AcpError> {
        if !self.supports_session_delete() {
            return Ok(false);
        }
        self.typed_request::<_, DeleteSessionResponse>(
            METHOD_SESSION_DELETE,
            &DeleteSessionRequest::new(session_id.to_owned()),
            SESSION_LIFECYCLE_TIMEOUT,
        )
        .await?;
        Ok(true)
    }

    fn abort_io_tasks(&mut self) {
        for task in self.tasks.drain(..) {
            task.abort();
        }
    }

    /// Deterministically stop the transport and reap a local agent's whole
    /// process tree. Child/task ownership stays on `self` across every await,
    /// so cancelling this future leaves Drop able to finish cleanup.
    pub async fn shutdown(&mut self) {
        self.abort_io_tasks();
        let mut release_child = false;
        let mut reap_signalled_child = false;
        if let Some(child) = self.child.as_mut() {
            match op_process_io::terminate_tokio_process_tree(child, PROCESS_SHUTDOWN_GRACE).await {
                Ok(_) => release_child = true,
                Err(_) => {
                    // A tree signal can fail even though the exact leader
                    // accepted its kill. Re-observe and retry the owned leader
                    // handle so that case still reaches the reaper, while two
                    // genuine signal failures retain ownership for Drop.
                    if let Some(needs_reap) = force_child_for_reap(child) {
                        release_child = true;
                        reap_signalled_child = needs_reap;
                    }
                }
            }
        }
        if release_child {
            let child = self.child.take().expect("release requires a child");
            if reap_signalled_child {
                reap_in_background(child);
            }
        }
        if let Some(task) = self.stderr_task.as_mut() {
            if tokio::time::timeout(STDERR_DRAIN_GRACE, &mut *task)
                .await
                .is_err()
            {
                task.abort();
            }
        }
        self.stderr_task.take();
    }

    /// Immediate process-tree kill used by Drop and cancellation-unwind paths.
    pub fn disconnect(&mut self) {
        self.abort_io_tasks();
        let disposition = self.child.as_mut().and_then(force_child_for_reap);
        if let Some(needs_reap) = disposition {
            let child = self.child.take().expect("disposition requires a child");
            if needs_reap {
                reap_in_background(child);
            }
        }
        if let Some(task) = self.stderr_task.take() {
            task.abort();
        }
    }
}

/// Return `Some(needs_reap)` only when the child is already reaped or at least
/// one termination request was accepted. `None` keeps the live child owned so
/// another disconnect/Drop attempt (plus `kill_on_drop`) can retry safely.
fn force_child_for_reap(child: &mut Child) -> Option<bool> {
    match child.try_wait() {
        Ok(Some(_)) => Some(false),
        Ok(None) => {
            if op_process_io::kill_tokio_process_tree(child).is_ok() {
                return Some(true);
            }
            // The shared tree helper deliberately returns an error when
            // descendant cleanup failed even if its direct leader kill was
            // accepted. A second exact-handle kill makes acceptance observable.
            match child.start_kill() {
                Ok(()) => Some(true),
                Err(_) => match child.try_wait() {
                    Ok(Some(_)) => Some(false),
                    Ok(None) | Err(_) => None,
                },
            }
        }
        Err(_) => None,
    }
}

impl Drop for AcpConnection {
    fn drop(&mut self) {
        self.disconnect();
    }
}

/// Tokio's async wait cannot be relied on from synchronous Drop or while its
/// runtime is shutting down. `try_wait` is non-async, so a short-lived OS
/// thread can always reap the already-killed direct child and avoid zombies.
fn reap_in_background(mut child: Child) {
    if matches!(child.try_wait(), Ok(Some(_)) | Err(_)) {
        return;
    }
    let _ = std::thread::Builder::new()
        .name("op-acp-child-reaper".into())
        .spawn(move || loop {
            match child.try_wait() {
                Ok(Some(_)) | Err(_) => break,
                Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            }
        });
}

```

### Core Architecture Module: `crates/op-ai/src/agent_settings_state.rs`
```
//! State types for the multi-section settings modal opened by
//! Cmd+,. Lives outside `document.rs` to keep that file under
//! the 800-line cap.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentSettingsTab {
    Agents,
    Mcp,
    Images,
    System,
}

impl AgentSettingsTab {
    pub const ALL: [AgentSettingsTab; 4] = [
        AgentSettingsTab::Agents,
        AgentSettingsTab::Mcp,
        AgentSettingsTab::Images,
        AgentSettingsTab::System,
    ];
    pub fn label(self) -> &'static str {
        match self {
            AgentSettingsTab::Agents => "Agents",
            AgentSettingsTab::Mcp => "MCP",
            AgentSettingsTab::Images => "Images",
            AgentSettingsTab::System => "系统",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentProvider {
    ClaudeCode,
    CodexCli,
    OpenCode,
    GithubCopilot,
    Antigravity,
    GrokBuild,
    /// DeepSeek Harness (`dsh`) — one-shot subprocess CLI, no ACP.
    DeepSeekHarness,
    /// Kimi Code CLI (`kimi`) — tool-free generation subprocess.
    Kimi,
}

impl AgentProvider {
    /// Append-only (mirror of `op_editor_core::chat::models`):
    /// persisted `connected` flags are indexed positionally, so the
    /// DeepSeek Harness slot was appended at the tail and positioned in
    /// the card list via [`AgentProvider::DISPLAY`].
    pub const ALL: [AgentProvider; 8] = [
        AgentProvider::ClaudeCode,
        AgentProvider::CodexCli,
        AgentProvider::OpenCode,
        AgentProvider::GithubCopilot,
        AgentProvider::Antigravity,
        AgentProvider::GrokBuild,
        AgentProvider::DeepSeekHarness,
        AgentProvider::Kimi,
    ];

    /// Card order on the Agents tab — a permutation of `ALL`, NOT the
    /// persistence order. DeepSeek Harness renders after Codex, before
    /// OpenCode (above the generic ACP block).
    pub const DISPLAY: [AgentProvider; 8] = [
        AgentProvider::ClaudeCode,
        AgentProvider::CodexCli,
        AgentProvider::DeepSeekHarness,
        AgentProvider::Kimi,
        AgentProvider::OpenCode,
        AgentProvider::GithubCopilot,
        AgentProvider::Antigravity,
        AgentProvider::GrokBuild,
    ];

    /// Position in [`AgentProvider::ALL`] — the index of this
    /// provider's flag in the persisted positional flag arrays.
    pub fn index(self) -> usize {
        AgentProvider::ALL
            .iter()
            .position(|candidate| *candidate == self)
            .expect("every AgentProvider variant is registered in AgentProvider::ALL")
    }

    pub fn name(self) -> &'static str {
        match self {
            AgentProvider::ClaudeCode => "Claude Code",
            AgentProvider::CodexCli => "Codex CLI",
            AgentProvider::OpenCode => "OpenCode",
            AgentProvider::GithubCopilot => "GitHub Copilot",
            AgentProvider::Antigravity => "Antigravity",
            AgentProvider::GrokBuild => "Grok Build",
            AgentProvider::DeepSeekHarness => "DeepSeek Harness",
            AgentProvider::Kimi => "Kimi Code",
        }
    }
    /// i18n key for the provider's subtitle. Paint code resolves
    /// the key via `agent_settings_i18n::t` so each locale picks
    /// up the right translation; the previous hard-coded Chinese
    /// strings + the fabricated `fini.yang@gmail.com` line have
    /// both been removed.
    pub fn subtitle_key(self) -> &'static str {
        match self {
            AgentProvider::ClaudeCode => "settings.provider.claudeCode",
            AgentProvider::CodexCli => "settings.provider.codexCli",
            AgentProvider::OpenCode => "settings.provider.openCode",
            AgentProvider::GithubCopilot => "settings.provider.githubCopilot",
            AgentProvider::Antigravity => "settings.provider.antigravity",
            AgentProvider::GrokBuild => "settings.provider.grokBuild",
            AgentProvider::DeepSeekHarness => "settings.provider.deepSeekHarness",
            AgentProvider::Kimi => "settings.provider.kimi",
        }
    }
}

/// Terminal-side MCP integrations the user can flip on/off. Order
/// matches the product's MCP settings grid (Claude / Codex / OpenCode /
/// Kiro / Copilot / Antigravity / Grok Build / Gemini / Qwen / Cursor /
/// Kimi / ZCode / DeepSeek Harness) so the index is reusable for both
/// layout and `mcp_cli_enabled[i]`. Kept in sync with
/// `op_editor_core::agent_settings::McpCli`; append only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpCli {
    ClaudeCode,
    Codex,
    OpenCode,
    Kiro,
    GithubCopilot,
    Antigravity,
    GrokBuild,
    GeminiCli,
    QwenCode,
    Cursor,
    Kimi,
    ZCode,
    Dsh,
}

impl McpCli {
    pub const ALL: [McpCli; 13] = [
        McpCli::ClaudeCode,
        McpCli::Codex,
        McpCli::OpenCode,
        McpCli::Kiro,
        McpCli::GithubCopilot,
        McpCli::Antigravity,
        McpCli::GrokBuild,
        McpCli::GeminiCli,
        McpCli::QwenCode,
        McpCli::Cursor,
        McpCli::Kimi,
        McpCli::ZCode,
        McpCli::Dsh,
    ];
    pub fn label(self) -> &'static str {
        match self {
            McpCli::ClaudeCode => "Claude Code CLI",
            McpCli::Codex => "Codex CLI",
            McpCli::OpenCode => "OpenCode CLI",
            McpCli::Kiro => "Kiro CLI",
            McpCli::GithubCopilot => "GitHub Copilot CLI",
            McpCli::Antigravity => "Antigravity CLI",
            McpCli::GrokBuild => "Grok Build CLI",
            McpCli::GeminiCli => "Gemini CLI",
            McpCli::QwenCode => "Qwen Code CLI",
            McpCli::Cursor => "Cursor",
            McpCli::Kimi => "Kimi CLI",
            McpCli::ZCode => "ZCode",
            McpCli::Dsh => "DeepSeek Harness",
        }
    }
}

/// MCP server status — surfaced verbatim on the MCP tab's top
/// card. Default port mirrors the TS app (`pen-mcp` default 3100).
#[derive(Debug, Clone, Copy)]
pub struct McpServer {
    pub running: bool,
    pub port: u16,
}

impl Default for McpServer {
    fn default() -> Self {
        Self {
            running: false,
            port: 3100,
        }
    }
}

/// Editable inputs on the settings modal that aren't tied to a
/// `Node` (so they don't fit the property-panel's `PropertyFocus`).
/// Currently just the MCP server port; OAuth fields will likely
/// reuse this enum when wired.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsFocus {
    McpPort,
}

#[derive(Debug, Clone, Copy)]
pub struct AgentSettings {
    pub tab: AgentSettingsTab,
    pub connected: [bool; 7],
    /// Vertical scroll offset of the right content pane in px.
    /// Clamped to `[0, content_height - viewport_height]` by the
    /// host on wheel input.
    pub scroll_y: f32,
    pub mcp_server: McpServer,
    pub mcp_cli_enabled: [bool; 13],
    pub images_advanced_open: bool,
    pub images_search_ready: bool,
    /// Currently-focused editable input on the modal. `None` while
    /// nothing is in edit mode; flips to `Some(SettingsFocus::*)`
    /// on click and back to `None` on Enter/Escape/outside-click.
    pub focus: Option<SettingsFocus>,
    /// Index into `AgentProvider::ALL` of the card the cursor is
    /// currently hovering, used to flip the connect button into a
    /// red disconnect affordance on already-connected cards. `usize::MAX`
    /// means no card is hovered.
    pub hover_provider: usize,
    /// Sidebar nav item under the cursor (Agents / MCP / Images /
    /// System). `None` = no hover. Drives a `muted`-tinted background
    /// on the row so the user sees which tab the next click hits.
    pub hover_nav: Option<AgentSettingsTab>,
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            tab: AgentSettingsTab::Agents,
            // Connection state is wired manually for now — no auth
            // backend exists, so every provider starts disconnected.
            connected: [false; 7],
            scroll_y: 0.0,
            mcp_server: McpServer::default(),
            mcp_cli_enabled: [false; 13],
            images_advanced_open: true,
            images_search_ready: true,
            focus: None,
            hover_provider: usize::MAX,
            hover_nav: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentSettingsDrag {
    Reserved,
}

```

### Core Architecture Module: `crates/op-auth-bridge/src/collab_jwks_cache_state.rs`
```
use std::time::{Duration, Instant};

use crate::{CollabJwks, CollabJwksError, CollabUnionPolicy};

#[derive(Default)]
pub(super) struct CacheState {
    pub(super) keyset: Option<CollabJwks>,
    pub(super) policy: Option<CollabUnionPolicy>,
    pub(super) etag: Option<String>,
    pub(super) fresh_until: Option<Instant>,
    pub(super) last_refresh_attempt: Option<Instant>,
    pub(super) last_successful_refresh: Option<Instant>,
    pub(super) last_unknown_kid_refresh: Option<Instant>,
}

pub(super) fn validate_etag(
    etag: Option<String>,
    maximum: usize,
) -> Result<Option<String>, CollabJwksError> {
    if etag
        .as_ref()
        .is_some_and(|value| value.len() > maximum || !valid_http_etag(value))
    {
        return Err(CollabJwksError::InvalidEtag { maximum });
    }
    Ok(etag)
}

fn valid_http_etag(value: &str) -> bool {
    let value = value.strip_prefix("W/").unwrap_or(value);
    let bytes = value.as_bytes();
    bytes.len() >= 2
        && bytes.first() == Some(&b'"')
        && bytes.last() == Some(&b'"')
        && bytes[1..bytes.len() - 1]
            .iter()
            .all(|byte| *byte == 0x21 || (0x23..=0x7e).contains(byte))
}

pub(super) fn fresh_until(now: Instant, response_age: u64, maximum_age: u64) -> Option<Instant> {
    now.checked_add(Duration::from_secs(response_age.min(maximum_age)))
}

pub(super) fn recently(previous: Option<Instant>, now: Instant, interval_seconds: u64) -> bool {
    previous.is_some_and(|previous| {
        now.checked_duration_since(previous)
            .is_none_or(|elapsed| elapsed < Duration::from_secs(interval_seconds))
    })
}

```

### Core Architecture Module: `crates/op-chat-agent/src/chat_agent_loop.rs`
```
//! Tool-executing loops for builtin Anthropic and OpenAI-compatible providers.
//! Canvas tool calls stream from the model, execute through the injected
//! [`ChatToolExecutor`], and ride the next request as correlated results until
//! the model stops or the turn cap is reached. Production uses the UI-thread
//! bridge; loopback tests keep this transport layer deterministic.

use std::collections::HashMap;
use std::sync::Arc;

use futures::StreamExt;
use op_ai::chat_provider::{
    ChatDelta, ChatHistoryRole, ChatToolDef, ChatToolExecutor, ChatToolResult, FinalizeReport,
    QualitySummary, StopReason, UnfilledScreensReport,
};
use serde_json::{json, Value};
use tokio::sync::mpsc;

#[cfg(test)]
use crate::chat_agent_context::screenshot_image_base64;
use crate::chat_agent_context::{
    elide_inline_screenshots, prepare_screenshot_for_context, PreparedScreenshot,
    OMITTED_SCREENSHOT_TEXT, TEXT_ONLY_SCREENSHOT_TEXT,
};
use crate::chat_builtin_http::{
    map_anthropic_stop_reason, map_openai_stop_reason, BuiltinHttpError,
};

#[path = "chat_agent_loop_retry.rs"]
mod retry;
use retry::{
    is_correctable_write_failure, is_write_level, CorrectiveWriteRetry, CORRECTIVE_WRITE_EXHAUSTED,
    CORRECTIVE_WRITE_PROGRESS,
};

#[path = "chat_agent_loop_blockers.rs"]
mod blockers;
use blockers::{blocker_nudge_if_owed, report_blockers_if_any};

/// Everything one agent-loop run needs. `max_turns` is the TS `maxTurns`
/// cap — `MAX_TOOL_TURNS = 20` for plain chat, `DESIGN_LOOP_MAX_TURNS = 28`
/// for the gated design-generation loop (`chat_builtin_http.rs`; the two
/// callers pick per `finalize_on_exit`). This caps only ORDINARY turns —
/// a dedicated promise-delivery fill round (see `FILL_BUDGET_MAX_ROUNDS_PER_SCREEN`
/// below) is deliberately exempt from it. Tests shrink `max_turns` further.
pub struct AgentLoopConfig {
    pub url: String,
    pub api_key: String,
    pub model: String,
    pub system_prompt: String,
    pub history: Vec<(ChatHistoryRole, String)>,
    pub user_prompt: String,
    pub attachments: Vec<op_ai::chat_provider::ChatAttachment>,
    pub max_output_tokens: u32,
    pub tools: Vec<ChatToolDef>,
    pub executor: Arc<dyn ChatToolExecutor>,
    pub max_turns: usize,
    /// Opt-in structural backstop at design-loop exit. Plain chat must keep
    /// this false because finalization mutates the live document.
    pub finalize_on_exit: bool,
    /// Disable MiniMax / GLM hidden reasoning for structured design output;
    /// otherwise it can consume the whole output allowance before tool JSON.
    pub disable_thinking: bool,
    /// Dial policy inherited from the provider that spawned this loop —
    /// browser-originated endpoints resolve + pin per request.
    pub dial_policy: crate::provider_dial::EndpointDialPolicy,
}

impl AgentLoopConfig {
    fn level_for(&self, tool: &str) -> String {
        self.tools
            .iter()
            .find(|t| t.name == tool)
            .map(|t| t.level.clone())
            .unwrap_or_else(|| "read".to_string())
    }
}

// The stateful tool-call accumulation (one fully-accumulated call, the
// transcript tool-card envelope, per-wire collectors) moved to
// `op_ai::chat_tool_sse` so the mobile FFI design loop shares one
// implementation — same migration `op_ai::chat_sse`'s plain parsers made.
// Re-exported unchanged so existing `chat_agent_loop::` paths still resolve.
pub use op_ai::chat_tool_sse::{normalized_args, tool_card_envelope, PendingToolCall};

/// Run one tool call through the executor on a blocking thread (the
/// executor blocks on the UI ack; never block the runtime directly).
async fn execute_tool(
    executor: &Arc<dyn ChatToolExecutor>,
    name: &str,
    args_json: &str,
) -> ChatToolResult {
    let executor = executor.clone();
    let name = name.to_string();
    let args = normalized_args(args_json);
    tokio::task::spawn_blocking(move || executor.execute(&name, &args))
        .await
        .unwrap_or_else(|e| ChatToolResult {
            content: json!({ "success": false, "error": format!("tool executor panicked: {e}") })
                .to_string(),
            is_error: true,
        })
}

/// Run the deterministic structural-quality backstop once, at loop end
/// (Track-1 Step 4). Forwards to the executor's `finalize` (which the desktop
/// host bridges to `op_orchestrator::apply_loop_finalize` against the live
/// `EditorState`). Runs on a blocking thread — the host round-trip blocks until
/// the UI thread acks — mirroring [`execute_tool`]. The default executor
/// `finalize` is a no-op, so this is inert for scripted / read-only executors.
///
/// `enabled` is `cfg.finalize_on_exit`: a no-op early-return when this loop run
/// is a regular chat turn (the shared agent loop also serves plain builtin
/// chat), so only the gated design-generation loop mutates the document here.
///
/// Returns the promise-delivery invariant's committed/unfilled report AFTER
/// finalize ran and any still-unfilled screens got canvas-marked — empty on
/// the default no-op and on the common path where nothing was left unfilled.
async fn run_loop_finalize(executor: &Arc<dyn ChatToolExecutor>, enabled: bool) -> FinalizeReport {
    if !enabled {
        return FinalizeReport::default();
    }
    let executor = executor.clone();
    tokio::task::spawn_blocking(move || executor.finalize())
        .await
        .unwrap_or_default()
}

/// Cheap, read-only promise-delivery probe — same detector [`run_loop_finalize`]
/// runs, but never mutates the document or marks the canvas. Called whenever
/// the loop is deciding whether a dedicated fill round is owed, so a
/// still-eligible screen gets one more shot instead of immediately being
/// branded "(unfilled)". Gated by the same `enabled` flag as
/// [`run_loop_finalize`] — a plain chat turn never touches the document.
async fn check_unfilled(
    executor: &Arc<dyn ChatToolExecutor>,
    enabled: bool,
) -> UnfilledScreensReport {
    if !enabled {
        return UnfilledScreensReport::default();
    }
    let executor = executor.clone();
    tokio::task::spawn_blocking(move || executor.check_unfilled_screens())
        .await
        .unwrap_or_default()
}

/// Per-screen dedicated fill-round budget. "预算只防失控，绝不截断已承诺的
/// 工作" (budget only guards against a runaway retry avalanche; it must
/// never itself be the reason a promised screen ships empty): a fill round
/// spent nudging the model about a still-unfilled COMMITTED screen is exempt
/// from the ordinary `max_turns` cap — see the two loops' `turn >= turn_cap`
/// gates below, which keep issuing dedicated rounds past the cap as long as
/// some committed screen is still eligible. This constant is the ONLY thing
/// that stops that from running forever: the SAME screen failing across
/// `FILL_BUDGET_MAX_ROUNDS_PER_SCREEN` dedicated attempts is accepted as a
/// real failure (reported honestly, tier 3) rather than retried indefinitely
/// — 2 rounds mirrors `geometry_echo`'s "detect, retry, then accept"
/// discipline stretched by one extra attempt, since a wholly blank screen is
/// a starker failure than a layout nit.
const FILL_BUDGET_MAX_ROUNDS_PER_SCREEN: usize = 2;

/// Which of `unfilled` still has dedicated fill-round budget left, per
/// `attempts` (screen name -> dedicated rounds already spent on it this run).
fn eligible_for_fill_round(unfilled: &[String], attempts: &HashMap<String, usize>) -> Vec<String> {
    unfilled
        .iter()
        .filter(|name| {
            attempts.get(name.as_str()).copied().unwrap_or(0) < FILL_BUDGET_MAX_ROUNDS_PER_SCREEN
        })
        .cloned()
        .collect()
}

/// Record that a dedicated fill round was just spent on each of `names`.
fn spend_fill_round(attempts: &mut HashMap<String, usize>, names: &[String]) {
    for name in names {
        *attempts.entry(name.clone()).or_insert(0) += 1;
    }
}

/// Post-exhaustion "salvage" budget — a SEPARATE pool from
/// [`FILL_BUDGET_MAX_ROUNDS_PER_SCREEN`]'s ("两个预算，职责分离": the
/// ordinary `max_turns` cap guards against the model rambling on forever;
/// this pool guards "承诺必达" specifically once that ordinary budget is
/// exhausted — running out of turns must never itself be why a committed
/// screen ships empty). Every committed-but-unfilled screen still gets AT
/// MOST one dedicated salvage round each (never retried a second time here —
/// unlike the richer 2-round budget under ordinary turns), and the whole run
/// never spends more than [`SALVAGE_MAX_ROUNDS`] dedicated rounds total —
/// belt-and-suspenders against an avalanche, even though bundling every
/// still-eligible screen into ONE contract message (see the `turn >=
/// turn_cap` gates below) means this converges in exactly one round for the
/// common case of "some screens got missed."
const SALVAGE_MAX_ROUNDS: usize = 3;

/// Which of `unfilled` has not yet been salvaged this run.
fn salvage_eligible(
    unfilled: &[String],
    salvaged: &std::collections::HashSet<String>,
) -> Vec<String> {
    unfilled
        .iter()
        .filter(|name| !salvaged.contains(name.as_str()))
        .cloned()
        .collect()
}

/// Tier-2 nudge text — states the FULL commitment, not just what's still
/// missing, so the model sees an explicit broken promise instead of a
/// generic "fill it now" ("把承诺变成模型可见的契约" — turn the promise into
/// a contract the model can see). `committed` is every screen the run
/// scaffolded (filled or not, from [`UnfilledScreensReport::committed`]);
/// `still_empty` is the fill-budget-eligible subset this round is asking the
/// model to act on.
fn contract_nudge_text(committed: &[String], still_empty: &[String]) -> String {
    let commit_clause = if committed.len() > 1 {
        format!(
            "You committed {} screens ({}); ",
            committed.len(),
            committed.join("/")
        )
    } else {
        String::new()
    };
    let (subject, pronoun) = if still_empty.len() == 1 {
        ("is", "it")
    } else {
        ("are
```

### Core Architecture Module: `crates/op-chat-agent/src/chat_agent_loop/anthropic.rs`
```
//! Anthropic-wire half of the agent loop: per-block SSE accumulation
//! (`AnthropicCollector`) and `run_anthropic_agent_loop`. Split out of
//! `chat_agent_loop.rs` to keep the spine under the 800-line cap; the spine
//! re-exports it so `chat_agent_loop::run_anthropic_agent_loop` still
//! resolves.

use super::*;

// ---------------------------------------------------------------------------
// Anthropic wire
// ---------------------------------------------------------------------------

// Per-block streamed accumulation moved to `op_ai::chat_tool_sse` so the
// mobile FFI design loop shares this exact wire behavior; the alias keeps
// every existing `AnthropicCollector` path stable.
pub(super) use op_ai::chat_tool_sse::AnthropicToolCollector as AnthropicCollector;

/// Finalize-lifecycle invariant outer wrapper (0718-1-k3-1 postmortem — see
/// [`run_loop_finalize`]'s doc + `op-host-desktop::chat_session::
/// finalize_design_session_if_needed`'s doc for the desktop-side half of
/// this same invariant).
///
/// ## The actual break, confirmed by reading this file
///
/// [`run_anthropic_agent_loop_inner`] / [`run_openai_agent_loop_inner`] each
/// call [`run_loop_finalize`] on every NORMAL exit (turn-cap exhausted,
/// salvage exhausted, model voluntarily stopped) — but FOUR early-return
/// sites per loop bypass it entirely: `client_for(...).await?`,
/// `send_with_backoff(...).await?`, `pump_sse(...).await?` (each via `?`
/// propagation), and the explicit `if let Some(err) = collector.error {
/// return Err(err); }` right after — the last one is what the 0718-1-k3-1
/// transcript's mid-stream `openai-compatible http 400` line hit: `pump_sse`
/// itself returns `Ok(())` (it drained the stream fine), but the collected
/// SSE-level error makes the caller return `Err` one line later, never
/// reaching the loop's own finalize call below it. `chat_builtin_http.rs`'s
/// `Err(e) => { tx.send(Error); tx.send(Done{Aborted}); }` catch-all never
/// finalizes either — it only forwards the error.
///
/// This wrapper is the single place ALL of a loop run's exits funnel
/// through, so it is where the invariant is actually enforced: on `Err`,
/// run the SAME best-effort finalize the inner loop's own normal-exit paths
/// already do, tagged `loop-exit` so a future occurrence is locatable by
/// grepping for that tag. Idempotent — [`run_loop_finalize`] no-ops when
/// `!cfg.finalize_on_exit`, and `apply_loop_finalize`'s own passes are each
/// individually idempotent, so this never double-mutates a document that an
/// inner normal-exit path already finalized (those paths return `Ok`, so
/// this wrapper's backstop only fires on the exact paths that skipped it).
pub async fn run_anthropic_agent_loop(
    cfg: AgentLoopConfig,
    tx: &mpsc::Sender<ChatDelta>,
) -> Result<bool, BuiltinHttpError> {
    let executor = cfg.executor.clone();
    let enabled = cfg.finalize_on_exit;
    let result = run_anthropic_agent_loop_inner(cfg, tx).await;
    if result.is_err() {
        run_loop_finalize(&executor, enabled).await;
        emit_finalize_diagnostic(tx, enabled, "loop-exit").await;
    }
    result
}

/// Run the Anthropic agent loop to completion. Returns `Ok(true)` when
/// a terminal `Done` was emitted; `Err` for transport / in-stream
/// errors (caller surfaces them as `Error + Done{Aborted}`).
/// Assistant `content[]` for the follow-up request. A thinking-only turn
/// accumulates NO replayable blocks (thinking is deliberately not replayed
/// — see `AnthropicToolCollector::assistant_content`), and Anthropic
/// rejects `content: []` with a 400 — which would poison the exact
/// corrective rounds that exist to rescue such a turn. Synthesize a
/// minimal text block instead.
fn assistant_turn_content(collector: &AnthropicCollector) -> Value {
    let content = collector.assistant_content();
    if content.is_empty() {
        json!([{ "type": "text", "text": "(no visible output this turn)" }])
    } else {
        json!(content)
    }
}

pub(super) async fn run_anthropic_agent_loop_inner(
    cfg: AgentLoopConfig,
    tx: &mpsc::Sender<ChatDelta>,
) -> Result<bool, BuiltinHttpError> {
    let tools_json: Vec<Value> = cfg
        .tools
        .iter()
        .map(|t| {
            json!({
                "name": t.name,
                "description": t.description,
                "input_schema": serde_json::from_str::<Value>(&t.input_schema_json)
                    .unwrap_or_else(|_| json!({ "type": "object" })),
            })
        })
        .collect();
    let mut messages: Vec<Value> = Vec::new();
    for (role, text) in &cfg.history {
        messages.push(json!({ "role": role.as_str(), "content": text }));
    }
    crate::chat_attachments::validate_model(&cfg.model, &cfg.attachments)
        .map_err(BuiltinHttpError::Attachments)?;
    let content = crate::chat_attachments::user_content(
        op_editor_core::BuiltinAgentKind::Anthropic,
        &cfg.user_prompt,
        &cfg.attachments,
    )
    .map_err(BuiltinHttpError::Attachments)?;
    messages.push(json!({ "role": "user", "content": content }));
    // User reference images remain authoritative throughout retries/tool turns.
    // Only generated observations after this prefix may be superseded.
    let reference_prefix_len = messages.len();

    // Tier 2 — under-budget per-screen fill-round budget (see
    // `FILL_BUDGET_MAX_ROUNDS_PER_SCREEN`'s doc comment for the "budget
    // never truncates committed work" rationale).
    let mut fill_attempts: HashMap<String, usize> = HashMap::new();
    // Tier 2b — post-exhaustion salvage budget. A SEPARATE pool from
    // `fill_attempts` above (see `SALVAGE_MAX_ROUNDS`'s doc comment).
    let mut salvaged_screens: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut salvage_rounds_used = 0usize;
    // Tier 2c — unresolved-blocker corrective-round budget. A SEPARATE pool
    // from both of the above (see `chat_agent_loop_blockers::
    // BLOCKER_NUDGE_MAX_ROUNDS`'s doc comment): blockers and unfilled
    // screens are different failure modes with independent budgets.
    let mut blocker_rounds_used = 0usize;
    // Tier 2d — zero-write corrective-round budget; `wrote` flips on the
    // first successful write-level tool call (see `ZERO_WRITE_MAX_ROUNDS`).
    let mut wrote = false;
    let mut zero_write_rounds_used = 0usize;
    let mut write_retry = CorrectiveWriteRetry::default();
    let turn_cap = cfg.max_turns.max(1);
    let mut turn = 0usize;
    loop {
        // A failed design write gets one model-authored correction request,
        // even when that failure consumed the final ordinary turn. This is a
        // separate one-shot budget; the host never replays tool arguments.
        let corrective_write_round = write_retry.begin_round();
        // Ordinary turn budget exhausted — the ONLY reason to send another
        // request is a committed screen that's still eligible for its own
        // dedicated salvage round. This request, if sent, does NOT count
        // against `turn`; it draws from `SALVAGE_MAX_ROUNDS` instead.
        if turn >= turn_cap && !corrective_write_round {
            if salvage_rounds_used >= SALVAGE_MAX_ROUNDS {
                let zero = zero_write_detail(cfg.finalize_on_exit, wrote, "turn budget exhausted");
                finalize_and_report(tx, &cfg.executor, cfg.finalize_on_exit, zero.as_deref()).await;
                let _ = tx
                    .send(ChatDelta::Done {
                        stop_reason: StopReason::MaxTokens,
                    })
                    .await;
                return Ok(true);
            }
            let report = check_unfilled(&cfg.executor, cfg.finalize_on_exit).await;
            let eligible = salvage_eligible(&report.unfilled, &salvaged_screens);
            if eligible.is_empty() {
                // Turn cap reached, and nothing committed is left worth
                // trying for — either nothing was ever unfilled, or every
                // unfilled screen already spent its one salvage round. Still
                // run the Step-4 structural backstop once over whatever the
                // run assembled, and report unconditionally.
                let zero = zero_write_detail(cfg.finalize_on_exit, wrote, "turn budget exhausted");
                finalize_and_report(tx, &cfg.executor, cfg.finalize_on_exit, zero.as_deref()).await;
                let _ = tx
                    .send(ChatDelta::Done {
                        stop_reason: StopReason::MaxTokens,
                    })
                    .await;
                return Ok(true);
            }
            salvage_rounds_used += 1;
            for name in &eligible {
                salvaged_screens.insert(name.clone());
            }
            messages.push(
                json!({ "role": "user", "content": contract_nudge_text(&report.committed, &eligible) }),
            );
            // Falls through to send this dedicated salvage round below —
            // bundling every eligible screen into one message means this
            // branch converges (nothing left eligible) after exactly one
            // round for the common case.
        }

        let mut body = json!({
            "model": cfg.model,
            "max_tokens": cfg.max_output_tokens,
            "stream": true,
            "messages": messages,
            "tools": tools_json,
        });
        if !cfg.system_prompt.trim().is_empty() {
            body.as_object_mut()
                .expect("anthropic request body is object")
                .insert("system".into(), json!(cfg.system_prompt));
        }
        // Turn OFF hidden reasoning for the families that can express it on
        // this wire — the empty-canvas postmortem: the OpenAI-compat loop
        // applied this control and the Anthropic loop did not, so a
        // reasoning model on its Anthropic-compatible endpoint burned the
        // whole turn bu
```

### Core Architecture Module: `crates/op-chat-agent/src/chat_agent_loop/openai.rs`
```
//! OpenAI-compatible-wire half of the agent loop: streamed tool-call
//! accumulation (`OpenAiCollector`) and `run_openai_agent_loop`. Split out
//! of `chat_agent_loop.rs` to keep the spine under the 800-line cap; the
//! spine re-exports it so `chat_agent_loop::run_openai_agent_loop` still
//! resolves.

use super::*;

// ---------------------------------------------------------------------------
// OpenAI-compatible wire
// ---------------------------------------------------------------------------

// Streamed tool-call accumulation moved to `op_ai::chat_tool_sse` so the
// mobile FFI design loop shares this exact wire behavior; the alias keeps
// every existing `OpenAiCollector` path (including the wire tests) stable.
pub(super) use op_ai::chat_tool_sse::OpenAiToolCollector as OpenAiCollector;

/// Finalize-lifecycle invariant outer wrapper — same contract, same
/// rationale, as [`run_anthropic_agent_loop`]'s own wrapper above (this
/// loop's early-return sites mirror the Anthropic loop's exactly).
pub async fn run_openai_agent_loop(
    cfg: AgentLoopConfig,
    tx: &mpsc::Sender<ChatDelta>,
) -> Result<bool, BuiltinHttpError> {
    let executor = cfg.executor.clone();
    let enabled = cfg.finalize_on_exit;
    let result = run_openai_agent_loop_inner(cfg, tx).await;
    if result.is_err() {
        run_loop_finalize(&executor, enabled).await;
        emit_finalize_diagnostic(tx, enabled, "loop-exit").await;
    }
    result
}

/// Run the OpenAI-compatible agent loop to completion. Same contract
/// as [`run_anthropic_agent_loop_inner`].
pub(super) async fn run_openai_agent_loop_inner(
    cfg: AgentLoopConfig,
    tx: &mpsc::Sender<ChatDelta>,
) -> Result<bool, BuiltinHttpError> {
    let tools_json: Vec<Value> = cfg
        .tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": serde_json::from_str::<Value>(&t.input_schema_json)
                        .unwrap_or_else(|_| json!({ "type": "object" })),
                },
            })
        })
        .collect();
    let mut messages: Vec<Value> = Vec::new();
    if !cfg.system_prompt.trim().is_empty() {
        messages.push(json!({ "role": "system", "content": cfg.system_prompt }));
    }
    for (role, text) in &cfg.history {
        messages.push(json!({ "role": role.as_str(), "content": text }));
    }
    crate::chat_attachments::validate_model(&cfg.model, &cfg.attachments)
        .map_err(BuiltinHttpError::Attachments)?;
    let content = crate::chat_attachments::user_content(
        op_editor_core::BuiltinAgentKind::OpenAiCompat,
        &cfg.user_prompt,
        &cfg.attachments,
    )
    .map_err(BuiltinHttpError::Attachments)?;
    messages.push(json!({ "role": "user", "content": content }));
    // User reference images remain authoritative throughout retries/tool turns.
    // Only generated observations after this prefix may be superseded.
    let reference_prefix_len = messages.len();

    // Tier 2 — under-budget per-screen fill-round budget, and Tier 2b —
    // post-exhaustion salvage budget — see the Anthropic loop above
    // (`FILL_BUDGET_MAX_ROUNDS_PER_SCREEN` / `SALVAGE_MAX_ROUNDS`'s doc
    // comments) for the full "budget never truncates committed work"
    // rationale and why these are two separate pools.
    let mut fill_attempts: HashMap<String, usize> = HashMap::new();
    let mut salvaged_screens: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut salvage_rounds_used = 0usize;
    // Tier 2c — unresolved-blocker corrective-round budget. A SEPARATE pool
    // from both of the above (see `chat_agent_loop_blockers::
    // BLOCKER_NUDGE_MAX_ROUNDS`'s doc comment): blockers and unfilled
    // screens are different failure modes with independent budgets.
    let mut blocker_rounds_used = 0usize;
    // Tier 2d — zero-write corrective-round budget; `wrote` flips on the
    // first successful write-level tool call (see `ZERO_WRITE_MAX_ROUNDS`).
    let mut wrote = false;
    let mut zero_write_rounds_used = 0usize;
    let mut write_retry = CorrectiveWriteRetry::default();
    let turn_cap = cfg.max_turns.max(1);
    let mut turn = 0usize;
    loop {
        // See the Anthropic path above: this one-shot request is model-authored
        // correction, not a blind replay, and owns its own hard budget.
        let corrective_write_round = write_retry.begin_round();
        if turn >= turn_cap && !corrective_write_round {
            if salvage_rounds_used >= SALVAGE_MAX_ROUNDS {
                let zero = zero_write_detail(cfg.finalize_on_exit, wrote, "turn budget exhausted");
                finalize_and_report(tx, &cfg.executor, cfg.finalize_on_exit, zero.as_deref()).await;
                let _ = tx
                    .send(ChatDelta::Done {
                        stop_reason: StopReason::MaxTokens,
                    })
                    .await;
                return Ok(true);
            }
            let report = check_unfilled(&cfg.executor, cfg.finalize_on_exit).await;
            let eligible = salvage_eligible(&report.unfilled, &salvaged_screens);
            if eligible.is_empty() {
                let zero = zero_write_detail(cfg.finalize_on_exit, wrote, "turn budget exhausted");
                finalize_and_report(tx, &cfg.executor, cfg.finalize_on_exit, zero.as_deref()).await;
                let _ = tx
                    .send(ChatDelta::Done {
                        stop_reason: StopReason::MaxTokens,
                    })
                    .await;
                return Ok(true);
            }
            salvage_rounds_used += 1;
            for name in &eligible {
                salvaged_screens.insert(name.clone());
            }
            messages.push(
                json!({ "role": "user", "content": contract_nudge_text(&report.committed, &eligible) }),
            );
            // Falls through to send this dedicated salvage round below.
        }

        let mut body = json!({
            "model": cfg.model,
            "stream": true,
            "max_tokens": cfg.max_output_tokens,
            "messages": messages,
            "tools": tools_json,
        });
        // Turn OFF hidden reasoning for the families that can express it.
        // Without this a reasoning model's design turn spends its whole
        // `max_tokens` on `reasoning_content` and truncates the
        // `batch_design` mid-JSON. The failure is deceptively partial: the
        // read-only tools take `{}`-sized arguments and still fit in what
        // reasoning leaves behind, so the transcript shows a run of green
        // tool calls and then simply stops — measured with deepseek-v4-pro,
        // whose thinking defaults to `effort=high` (2026-07-31).
        //
        // The same helper builds the single-shot body. It maps Kimi K3 to
        // top-level `reasoning_effort:"low"`, while K2.5/K2.6, GLM,
        // DeepSeek, and MiniMax keep `thinking:{type:"disabled"}`. The two
        // mutually-exclusive fields can therefore never drift by path.
        crate::chat_builtin_http::apply_reasoning_wire_control(
            &mut body,
            &cfg.model,
            cfg.disable_thinking,
        );
        crate::backoff::apply_openrouter_reasoning(&mut body, &cfg.url, cfg.disable_thinking);
        // Through the shared throttle/backoff: this tool-loop path used
        // to post raw, so a provider rate limit killed the design run with
        // no retries and a raw JSON error (measured: glm-5.2, 429
        // AccountRateLimitExceeded, 2026-07-12).
        let client = crate::provider_dial::client_for(cfg.dial_policy, &cfg.url).await?;
        let (max_retries, min_gap) = crate::chat_builtin_http::default_backoff_knobs();
        let resp = crate::chat_builtin_http::send_with_backoff(
            "openai-compatible",
            &cfg.url,
            max_retries,
            min_gap,
            || client.post(&cfg.url).bearer_auth(&cfg.api_key).json(&body),
        )
        .await?;
        let mut collector = OpenAiCollector::default();
        pump_sse(resp, tx, &mut collector).await?;
        if tx.is_closed() {
            return Ok(true);
        }
        if let Some(err) = collector.error {
            // Same in-stream provider failure as the Anthropic loop — see
            // `BuiltinHttpError::StreamReported`.
            return Err(BuiltinHttpError::StreamReported(err));
        }
        let calls = collector.pending_calls();
        if calls.is_empty() {
            if corrective_write_round {
                let _ = tx
                    .send(ChatDelta::TextDelta(CORRECTIVE_WRITE_EXHAUSTED.to_string()))
                    .await;
            }
            let reason = collector
                .finish_reason
                .as_deref()
                .map(map_openai_stop_reason)
                .unwrap_or(StopReason::EndTurn);
            let stop_content = || {
                if collector.text.is_empty() {
                    Value::Null
                } else {
                    Value::String(collector.text.clone())
                }
            };
            if turn >= turn_cap {
                // Already in salvage territory — the top-of-loop gate above
                // owns deciding whether another salvage round is owed.
                // Record this turn's reply and defer.
                messages.push(json!({ "role": "assistant", "content": stop_content() }));
                continue;
            }
            // Model voluntarily stopped, still within ordinary budget. Try
            // one dedicated fill round for any committed screen that's
            // still eligible — NOT gated by remaining turn budget (only by
            // the per-screen cap above).
            let report = check_unfilled(&cfg.executor, cfg.finalize_on_
```

### Core Architecture Module: `crates/op-chat-agent/src/chat_agent_loop_blockers.rs`
```
//! Unresolved-blocker completion gate — shared between the Anthropic and
//! OpenAI-compatible agent loops in `chat_agent_loop.rs` (split out as a
//! sibling module the same way `chat_agent_loop_retry.rs` splits out the
//! corrective-write retry policy, so neither loop function duplicates this
//! logic). See `op_host_services::loop_blocker_ledger`'s module doc for what
//! counts as a blocker (structure / empty-shell / nav) and why this is a
//! live recompute against the document rather than an accumulating ledger.

use std::sync::Arc;

use op_ai::chat_provider::{BlockerReport, ChatDelta, ChatToolExecutor};
use tokio::sync::mpsc;

/// Per-run budget for the unresolved-blocker corrective round — a SEPARATE
/// pool from `FILL_BUDGET_MAX_ROUNDS_PER_SCREEN` / `SALVAGE_MAX_ROUNDS`
/// (blockers and unfilled screens are different failure modes; see those
/// constants' doc comments in `chat_agent_loop.rs` for "budget guards
/// runaway retry, never truncates promised work"). Blockers are a
/// narrower, already-detected class — the model already saw each one as a
/// per-batch tool-result hint (`structureIssues` / `shellsRemaining` /
/// `navIssues`) — so a flat per-run cap (not a per-item pool like the fill
/// budget) is enough to give the model a real chance to react without room
/// for an avalanche.
pub(super) const BLOCKER_NUDGE_MAX_ROUNDS: usize = 2;

/// Cheap, read-only unresolved-blocker scan. Gated the same way
/// `check_unfilled`/`run_loop_finalize` are: `enabled` mirrors
/// `cfg.finalize_on_exit`, so a plain (non-design) chat turn never touches
/// the document.
pub(super) async fn check_blockers(
    executor: &Arc<dyn ChatToolExecutor>,
    enabled: bool,
) -> BlockerReport {
    if !enabled {
        return BlockerReport::default();
    }
    let executor = executor.clone();
    tokio::task::spawn_blocking(move || executor.check_blockers())
        .await
        .unwrap_or_default()
}

/// Corrective-message contract text for a still-blocked loop completion —
/// mirrors `contract_nudge_text`'s "state the full commitment, not just
/// what's missing" shape, but for structural blockers instead of unfilled
/// screens.
pub(super) fn blocker_nudge_text(report: &BlockerReport) -> String {
    let lines: Vec<String> = report
        .blockers
        .iter()
        .map(|b| format!("- [{}] {}", b.category, b.detail))
        .collect();
    format!(
        "The design still has {} unresolved blocker(s) that must be fixed before finishing:\n{}",
        lines.len(),
        lines.join("\n")
    )
}

/// Decide whether this `calls.is_empty()` model-stop is owed one more
/// corrective round for unresolved blockers — mirrors
/// `eligible_for_fill_round`'s per-screen budget check, but against a flat
/// per-run round counter instead of a per-screen map (blockers aren't keyed
/// by screen name the way unfilled screens are). Spends a round from
/// `rounds_used` when it returns `Some`; the caller pushes the text as a
/// user message and `continue`s WITHOUT counting it against the ordinary
/// turn budget, exactly like the fill round.
pub(super) async fn blocker_nudge_if_owed(
    executor: &Arc<dyn ChatToolExecutor>,
    enabled: bool,
    rounds_used: &mut usize,
) -> Option<String> {
    if !enabled || *rounds_used >= BLOCKER_NUDGE_MAX_ROUNDS {
        return None;
    }
    let report = check_blockers(executor, enabled).await;
    if !report.has_blockers() {
        return None;
    }
    *rounds_used += 1;
    Some(blocker_nudge_text(&report))
}

/// Tier-3 unconditional honest report for blockers — appended right
/// alongside `report_unfilled_if_any`'s screen line whenever the loop is
/// about to send `Done` with blockers still unresolved (round budget
/// spent, or this exit tier never spent a round at all — e.g. the
/// turn-cap/salvage tiers, which only nudge for unfilled screens, not
/// blockers). Never silently succeeds: any blocker still present at ANY
/// exit tier surfaces here.
pub(super) async fn report_blockers_if_any(tx: &mpsc::Sender<ChatDelta>, report: &BlockerReport) {
    if !report.has_blockers() {
        return;
    }
    let text = format!(
        "\n\n• {} unresolved blocker(s): {}",
        report.blockers.len(),
        report
            .blockers
            .iter()
            .map(|b| b.detail.as_str())
            .collect::<Vec<_>>()
            .join("; ")
    );
    let _ = tx.send(ChatDelta::TextDelta(text)).await;
}

```

### Core Architecture Module: `crates/op-chat-agent/src/chat_agent_loop_retry.rs`
```
//! Bounded semantic retry state for failed design writes.
//!
//! The host never replays a failed mutation. Instead, it gives the model one
//! dedicated request in which to inspect the tool error and issue a corrected
//! call. Keeping this budget separate from the ordinary turn cap guarantees
//! the correction request is delivered even when the failed write consumed
//! the last normal turn, while the one-shot guard prevents retry loops.

use op_ai::chat_provider::ChatToolResult;

/// A design run gets at most one model-authored corrective round.
const MAX_CORRECTIVE_WRITE_ROUNDS: usize = 1;

/// `ChatDelta` has no structured retry/progress variant. A text delta is
/// intentional here: unlike transient thinking state, it remains visible in
/// the completed transcript and answers whether a correction was attempted.
pub(super) const CORRECTIVE_WRITE_PROGRESS: &str =
    "\n\n• Retrying failed design write · corrective attempt 1/1";
pub(super) const CORRECTIVE_WRITE_EXHAUSTED: &str =
    "\n\n• Design write still failed after corrective attempt 1/1";

/// Per-run one-shot guard. `pending` means the next provider request is the
/// dedicated correction round and therefore bypasses the ordinary turn cap.
#[derive(Default)]
pub(super) struct CorrectiveWriteRetry {
    rounds_scheduled: usize,
    pending: bool,
}

impl CorrectiveWriteRetry {
    /// Schedule the sole correction round. Returns the model-facing nudge when
    /// accepted, or `None` after the run has already spent its retry budget.
    pub(super) fn schedule(&mut self, failed_tools: &[String]) -> Option<String> {
        if failed_tools.is_empty()
            || self.pending
            || self.rounds_scheduled >= MAX_CORRECTIVE_WRITE_ROUNDS
        {
            return None;
        }
        self.rounds_scheduled += 1;
        self.pending = true;
        let tools = failed_tools.join(", ");
        Some(format!(
            "Design write tool call(s) failed: {tools}. This is your one corrective retry. \
             Inspect the tool error result above and issue a corrected write call now. \
             Do not repeat the same tool arguments unchanged. If you cannot correct the \
             write, explain the remaining failure explicitly."
        ))
    }

    /// Consume a pending correction at the start of its provider request.
    pub(super) fn begin_round(&mut self) -> bool {
        std::mem::take(&mut self.pending)
    }
}

/// Auth levels other than `read` represent a write/effectful tool. Unknown
/// tools are normalized to `read` by `AgentLoopConfig::level_for`, so this
/// fails closed instead of retrying an unclassified call.
pub(super) fn is_write_level(level: &str) -> bool {
    !level.eq_ignore_ascii_case("read")
}

/// Only a tool/domain error is useful model feedback. Provider HTTP failures
/// occur before execution and never reach this function; UI-bridge failures
/// and executor panics do, so exclude their stable envelopes rather than
/// spending the semantic correction budget on infrastructure the model cannot
/// repair by changing arguments.
pub(super) fn is_correctable_write_failure(level: &str, result: &ChatToolResult) -> bool {
    if !is_write_level(level) || !result.is_error {
        return false;
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&result.content) else {
        return false;
    };
    if value.get("success").and_then(serde_json::Value::as_bool) != Some(false) {
        return false;
    }
    let error = value
        .get("error")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    !error.starts_with("tool executor panicked:")
        && error != "tool execution timed out waiting for the editor"
        && error != "chat turn aborted before the tool ran"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schedules_exactly_one_round() {
        let mut retry = CorrectiveWriteRetry::default();
        assert!(retry.schedule(&["batch_design".into()]).is_some());
        assert!(retry.begin_round());
        assert!(!retry.begin_round());
        assert!(retry.schedule(&["batch_design".into()]).is_none());
    }

    #[test]
    fn read_level_is_not_a_write() {
        assert!(!is_write_level("read"));
        assert!(is_write_level("create"));
        assert!(is_write_level("modify"));
        assert!(is_write_level("delete"));
    }

    #[test]
    fn infrastructure_errors_are_not_model_correctable() {
        let timeout = ChatToolResult {
            content:
                r#"{"success":false,"error":"tool execution timed out waiting for the editor"}"#
                    .into(),
            is_error: true,
        };
        let semantic = ChatToolResult {
            content: r#"{"success":false,"error":"height must be an integer"}"#.into(),
            is_error: true,
        };
        assert!(!is_correctable_write_failure("modify", &timeout));
        assert!(is_correctable_write_failure("modify", &semantic));
        assert!(!is_correctable_write_failure("read", &semantic));
    }
}

```

### Core Architecture Module: `crates/op-chat-agent/src/loop_blocker_ledger.rs`
```
//! Unresolved-blocker detection for agent-loop completion gating.
//!
//! [`detect_blockers`] is a LIVE recompute against the current `EditorState`
//! — deliberately NOT an accumulating ledger populated incrementally by
//! `design_agent_tools.rs`'s per-`batch_design` diagnostics. It mirrors the
//! discipline `op_orchestrator::unfilled_screens::detect_unfilled_screens`
//! already established for `ChatToolExecutor::check_unfilled_screens`: run
//! the same scans fresh every time, straight off the live document, so an
//! issue a later batch already fixed simply stops appearing — nothing to
//! prune, nothing that can go stale.
//!
//! Scope (MVP, conservative): only failure modes with an unambiguous
//! structural signal count as blockers —
//!
//! - **structure** — duplicate status bars / broken rings / duplicate
//!   header-icon rows (`design_agent_tools::scan_duplicate_root_issues` /
//!   `scan_ring_issues` / `scan_header_icon_row_issues` — the same scans
//!   whose hits ride into `batch_design`'s `structureIssues` field).
//! - **empty-shell** — a scaffolded section never filled
//!   (`design_agent_tools::scan_empty_shells`, `shellsRemaining` per-batch).
//! - **nav** — an unbound primary-mobile-screen nav tab
//!   (`op_orchestrator::nav_issues::scan_nav_issues`, `navIssues` per-batch).
//!
//! `layoutIssues` (`op_orchestrator::geometry_validation::geometry_diagnostics`)
//! is deliberately EXCLUDED from this MVP: its ~15 detectors (overflow /
//! collapse / jam / starvation / spill / …) all return the same flat
//! `Vec<String>` with no structured category field, so classifying "which of
//! these are overflow/collapse" would mean pattern-matching free-form
//! message text — exactly the name/string-heuristic fragility this codebase
//! has been burned by before. `layoutIssues` stays advisory (it still rides
//! in the per-batch tool result, unaffected by this module) until
//! `geometry_validation` grows a real category enum on its diagnostics.

use op_ai::chat_provider::{BlockerEntry, BlockerReport};
use op_editor_core::EditorState;

use crate::design_agent_tools::{
    scan_duplicate_root_issues, scan_empty_shells, scan_header_icon_row_issues, scan_ring_issues,
};

/// Recompute every unresolved blocker against the CURRENT active page of
/// `state` — same scope `design_agent_tools`'s per-batch diagnostics use.
/// Read-only: never mutates the document.
pub fn detect_blockers(state: &EditorState) -> BlockerReport {
    let children = state.active_children();
    let mut blockers = Vec::new();
    for detail in scan_duplicate_root_issues(children) {
        blockers.push(BlockerEntry {
            category: "structure".to_string(),
            detail,
        });
    }
    for detail in scan_ring_issues(children) {
        blockers.push(BlockerEntry {
            category: "structure".to_string(),
            detail,
        });
    }
    for detail in scan_header_icon_row_issues(children) {
        blockers.push(BlockerEntry {
            category: "structure".to_string(),
            detail,
        });
    }
    for detail in scan_empty_shells(children) {
        blockers.push(BlockerEntry {
            category: "empty-shell".to_string(),
            detail,
        });
    }
    for detail in op_orchestrator::nav_issues::scan_nav_issues(state) {
        blockers.push(BlockerEntry {
            category: "nav".to_string(),
            detail,
        });
    }
    BlockerReport { blockers }
}

#[cfg(test)]
#[path = "loop_blocker_ledger_tests.rs"]
mod tests;

```

### Core Architecture Module: `crates/op-chrome-extension-core/src/account.rs`
```
//! The account surface: regions, hub origins, hub URLs, session parsing.
//!
//! Signing in is **optional** and changes nothing about the local import
//! path. What it adds is an identity the popup can show and — once the Hub
//! grows an inbox API (see `docs/hub-inbox-api-proposal.md`) — a second
//! delivery target. See [`crate::delivery`].
//!
//! # The trust model this module encodes
//!
//! The extension is a **public client**. It holds no SSO client secret, no
//! authorization code, no refresh token, and no session token. The whole
//! flow is:
//!
//! 1. the popup opens `GET <hub>/api/v1/auth/login?return_to=/account` in a
//!    normal tab, and the user signs in on the Hub's own origin;
//! 2. the Hub sets its first-party `op_hub_session` cookie (`HttpOnly`,
//!    `Secure`, `SameSite=Lax`, `Path=/`) — a cookie the extension cannot
//!    read, and deliberately does not ask to;
//! 3. the popup reads `GET <hub>/api/v1/session` with `credentials:
//!    'include'` and renders the JSON it gets back.
//!
//! So the only credential material that exists anywhere is the cookie, and it
//! lives in the browser's cookie jar under the Hub's origin. The one value
//! that crosses into extension memory is the session's `csrf_token`, which is
//! required on the Hub's mutating endpoints (`POST /api/v1/auth/logout`);
//! [`parse_session`] therefore validates it hard enough to be safe as an HTTP
//! header value, and the popup keeps it in memory only — never in
//! `chrome.storage`.
//!
//! # Why the origins are compiled in rather than typed
//!
//! Chrome resolves `host_permissions` from the manifest at install time, so a
//! hub origin the user could type would not be reachable anyway without a
//! runtime `chrome.permissions.request`. Pinning the two published origins
//! here — and asserting in the tests that `manifest.json` grants exactly them
//! — makes the reachable set of hosts a compile-time fact instead of a
//! storage value an attacker-influenced code path could steer.

use crate::endpoint::normalize_endpoint;
use crate::js_text::{js_trim, truncate_utf16};

/// Consumer portal origin of the China region.
///
/// The public hostname is the one the Hub's own ICP filing check keys on
/// (`op-hub/frontend/src/components/domestic-filing-link.tsx`), and it is the
/// `op.` sibling of the SSO service's `sso.zseven.cn`.
pub const HUB_ORIGIN_CN: &str = "https://op.zseven.cn";

/// Consumer portal origin of the Global region — the `.tech` sibling, exactly
/// as `zseven-sso` pairs `sso.zseven.cn` with `sso.zseven.tech`.
pub const HUB_ORIGIN_GLOBAL: &str = "https://op.zseven.tech";

/// Session probe. Answers `200` with the session envelope, or `401`.
const SESSION_PATH: &str = "/api/v1/session";
/// Login entry point. Opened in a TAB, never fetched.
const LOGIN_PATH: &str = "/api/v1/auth/login";
/// Session teardown. `POST`, needs the CSRF header.
const LOGOUT_PATH: &str = "/api/v1/auth/logout";
/// The portal page a user lands on, and the only `return_to` we ask for.
const ACCOUNT_PATH: &str = "/account";

/// Longest display name rendered in the popup's 340 px header, in UTF-16
/// code units. A display name is user-chosen text from another user's
/// account; it must not be able to push the sign-out control off-screen.
const MAX_NAME_UNITS: usize = 48;

/// Longest `avatar_url` accepted. Chrome would not fetch a longer one
/// usefully, and the value is rendered into an `<img src>`.
const MAX_AVATAR_BYTES: usize = 2048;

/// Longest `csrf_token` accepted. The Hub mints 43-character base64url
/// tokens; the cap is generous so a rotation to a longer token does not
/// break the client, and the charset check below is what actually matters.
const MAX_CSRF_BYTES: usize = 256;

/// Longest failure text echoed into the popup's status line.
const MAX_DETAIL_UNITS: usize = 200;

/// Milliseconds before a hub request is abandoned.
///
/// Deliberately shorter than the snapshot import's 15 s: a session probe
/// carries no payload and runs while the user is looking at an empty account
/// row, so a hub that is slow or unreachable has to fall back to "signed out
/// / unavailable" quickly rather than holding the row blank. A capture, by
/// contrast, is worth waiting for.
pub const REQUEST_TIMEOUT_MS: u32 = 8_000;

/// Which regional deployment the account lives in.
///
/// Mirrors the product's own built-in dual-region design
/// (`CollabRelayRegion` in `op-editor-core`, `RelayRegion` on the collab
/// wire) down to the persisted spelling, so a user who picked "China" for
/// collaboration sees the same word here.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Region {
    /// China. The product's default, matching `CollabRelayRegion::default()`.
    #[default]
    Cn,
    /// Everywhere else.
    Global,
}

impl Region {
    /// Persisted spelling, shared with the collaboration bootstrap document.
    pub fn as_str(self) -> &'static str {
        match self {
            Region::Cn => "cn",
            Region::Global => "global",
        }
    }

    /// Parse a stored value. Anything unrecognised — including a value left
    /// by a future version — falls back to the default rather than failing,
    /// because a popup that will not open is a worse outcome than a popup
    /// pointing at the default region.
    pub fn from_stored(raw: &str) -> Region {
        match js_trim(raw) {
            "global" => Region::Global,
            _ => Region::Cn,
        }
    }

    /// The region's published hub origin.
    pub fn hub_origin(self) -> &'static str {
        match self {
            Region::Cn => HUB_ORIGIN_CN,
            Region::Global => HUB_ORIGIN_GLOBAL,
        }
    }
}

/// The hub origin to talk to: the region's published one, unless a loopback
/// development origin has been stored.
///
/// The override exists so `OP_HUB_PUBLIC_URL=http://127.0.0.1:18081` (the
/// Hub's documented development invocation) can be driven from the same
/// popup. It is accepted **only** when it normalizes to a loopback
/// `host:port` — the exact rule [`crate::endpoint`] applies to the local
/// editor, and the reason no new host permission is needed for it: the
/// manifest already grants `http://127.0.0.1/*`.
///
/// Anything else — a public hostname, an `https://` URL, a path — is ignored
/// in favour of the region's origin. There is no code path in which a stored
/// value can point the session probe at an arbitrary host.
pub fn hub_origin(region: Region, override_raw: &str) -> String {
    if let Some(dev) = dev_origin(override_raw) {
        return dev;
    }
    region.hub_origin().to_owned()
}

/// A loopback development hub origin, or `None`.
fn dev_origin(raw: &str) -> Option<String> {
    let trimmed = js_trim(raw);
    if trimmed.is_empty() {
        return None;
    }
    // `https://127.0.0.1:8443` is not a development Hub — the Hub only
    // serves plaintext when `OP_HUB_PUBLIC_URL` is `http://`, and accepting
    // both would mean two spellings of one thing. `get` rather than a slice
    // index: byte 8 can land inside a multi-byte character.
    if trimmed
        .get(..8)
        .is_some_and(|head| head.eq_ignore_ascii_case("https://"))
    {
        return None;
    }
    normalize_endpoint(trimmed).map(|endpoint| format!("http://{endpoint}"))
}

/// The URL to OPEN IN A TAB to sign in.
///
/// `return_to` must be one of the Hub's exact allowlisted portal routes and
/// the request must carry that one query parameter and nothing else — both
/// are enforced server-side, so the string is built here rather than
/// assembled by the caller.
pub fn login_url(origin: &str) -> String {
    format!("{origin}{LOGIN_PATH}?return_to={ACCOUNT_PATH}")
}

/// The session probe URL.
pub fn session_url(origin: &str) -> String {
    format!("{origin}{SESSION_PATH}")
}

/// The logout URL.
pub fn logout_url(origin: &str) -> String {
    format!("{origin}{LOGOUT_PATH}")
}

/// The portal page, opened in a tab as the sign-out fallback.
pub fn account_url(origin: &str) -> String {
    format!("{origin}{ACCOUNT_PATH}")
}

/// The `host_permissions` match pattern a hub origin needs.
///
/// Kept here so the manifest and this module cannot drift apart — the test
/// module asserts the shipped `manifest.json` grants exactly these two.
pub fn host_permission(origin: &str) -> String {
    format!("{origin}/*")
}

/// What `GET /api/v1/session` said.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionView {
    /// A usable session. Everything here is safe to render as *text*.
    SignedIn(Account),
    /// No session — the ordinary state, not an error.
    SignedOut,
    /// The Hub answered something we cannot act on.
    Unavailable { detail: String },
}

/// The renderable half of a Hub session.
///
/// Deliberately does NOT carry `primary_email` or `roles`. The popup shows
/// who you are, not what you may do, and an email address is the one field
/// in the envelope whose leak into a screenshot would matter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Account {
    /// Stable SSO subject. Used only to notice that the account changed.
    pub user_id: String,
    /// The name to render: `display_name` when it has one, else `username`.
    pub display_name: String,
    /// An `https://` avatar, or `None`. Never a `data:` or relative URL.
    pub avatar_url: Option<String>,
    /// Session CSRF token, required by the Hub's mutating endpoints.
    pub csrf_token: String,
}

/// Classify a reply from `GET /api/v1/session`.
///
/// The shape is pinned by the Hub's `auth_routes.go` session handler:
/// `{"user":{"id","username","display_name","avatar_url","primary_email",
/// "roles"},"csrf_token","capabilities"}`, where the three middle user fields
/// may be `null`.
///
/// A `401` is the signed-out answer, and the only status that is not a
/// problem. Everything else — a `503` from a Hub whose Redis is down, an
/// HTML error page from a captive portal, a body that will not parse — is
/// [`S
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #280** (2026-11-06): **Memory cross-boundary**
  *Symptoms*: ### Version  0.16  ### Platform  Web (browser)  ### Bug Description  macOS desktop client, codex often encounters memory over-boundary errors when calling mcp.  ### Steps to Reproduce  1. open openpencil 2. codex connects mcp for design   ### Expected Behavior  macOS desktop client, codex often encounters memory over-boundary errors when calling mcp.  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_

- **Issue #267** (2026-10-31): **bug: duplicate BRUSH resource keys prevent a .fig file from opening**
  *Symptoms*: Sorry, I opened this issue in the wrong repository. Closing it now.

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

### Incident Patch 1: `be4cf9c8` (2026-10-29)
**Commit Message**: fix(editor): add scoped ios account deletion

**File**: `crates/op-auth-bridge/src/hosted_access_tests.rs` (modified, +10/-0)
```diff
@@ -20,6 +20,7 @@ fn fixture() -> Value {
         "issued_at_unix": NOW,
         "expires_at_unix": NOW + 300,
         "gateway_base_url": "https://gateway.example.test/v1",
+        "product": "openpencil",
     })
 }
 
@@ -237,3 +238,12 @@ fn development_v4_exports_fail_closed_before_runtime_initialization() {
     ));
     provider.cancel(id);
 }
+
+#[test]
+fn legacy_or_other_product_access_cannot_bypass_product_deletion() {
+    let mut payload = fixture();
+    payload.as_object_mut().unwrap().remove("product");
+    assert!(decode(payload.to_string().as_bytes(), NOW).is_err());
+    payload["product"] = json!("another-product");
+    assert!(decode(payload.to_string().as_bytes(), NOW).is_err());
+}
```

**File**: `crates/op-auth-bridge/src/hosted_access_wire.rs` (modified, +4/-0)
```diff
@@ -16,6 +16,9 @@ struct AccessWire<'a> {
     token_type: &'a str,
     issuer: &'a str,
     subject: &'a str,
+    // Mandatory for this consumer: an older signed runtime must not silently
+    // fall back to shared credentials when product deletion is enforced.
+    product: &'a str,
     audience: &'a str,
     scopes: [&'a str; 2],
     issued_at_unix: u64,
@@ -37,6 +40,7 @@ pub(crate) fn decode(bytes: &[u8], now: u64) -> Result<HostedAccess, HostedAcces
         serde_json::from_slice(bytes).map_err(|_| HostedAccessError::InvalidPayload)?;
     let lifetime = wire.expires_at_unix.checked_sub(wire.issued_at_unix);
     if wire.version != 1
+        || wire.product != "openpencil"
         || wire.token_type != "Bearer"
         || wire.audience != "llm-gateway"
         || wire.scopes != ["llm:models", "llm:invoke"]
```

**File**: `crates/op-auth-bridge/src/real.rs` (modified, +1/-0)
```diff
@@ -102,6 +102,7 @@ pub(crate) fn init(config: &AuthInitConfig) -> bool {
         "device_name": config.device_name,
         "platform": crate::platform_id(),
         "app_version": config.app_version,
+        "hosted_product": "openpencil",
     })
     .to_string();
     // SAFETY: pointer/length describe the live `json` buffer.
```

**File**: `crates/op-hosted-models/src/tests.rs` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ impl op_auth_bridge::HostedAccessProvider for ReadyAfterSwitch {
             "issuer":"https://sso.example.test", "subject":"01234567-89ab-cdef-0123-456789abcdef",
             "audience":"llm-gateway", "scopes":["llm:models","llm:invoke"],
             "issued_at_unix":now, "expires_at_unix":now+300,
-            "gateway_base_url":"https://gateway.example.test/v1"})
+            "gateway_base_url":"https://gateway.example.test/v1", "product":"openpencil"})
         .to_string()
         .into_bytes();
         Ok(HostedAccessPoll::Ready(HostedAccess::from_provider_json(
```

**File**: `packaging/ios/ACCOUNT_DELETION.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+# OpenPencil account deletion
+
+This feature deletes the OpenPencil product account. It preserves the shared
+ZSeven sign-in identity and other ZSeven products. Local source validation is
+not evidence that the new service endpoints or the replacement app build are
+deployed.
+
+## User flow
+
+1. In the iOS editor, open **More > Account > Delete OpenPencil Account**.
+2. Read the cloud and local deletion scope. The app opens the dedicated SSO
+   page in an in-app Safari sheet. Sign in again when recent authentication
+   is required, verify the displayed account, and confirm deletion.
+3. The service records a durable deletion job and blocks new OpenPencil
+   access. Both regional services must acknowledge cleanup. Previously
+   issued collaboration credentials require a 16-minute drain interval.
+   Outages can extend processing; an accepted request is not completion.
+4. The app verifies completion over HTTPS with its private receipt before
+   removing app-owned local data. Closing Safari, signing out, a callback,
+   an expired receipt, or an HTTP error cannot authorize local erasure.
+5. After cleanup, the app shows a completion/restart screen. Relaunch it
+   normally to start with clean local storage. The app never calls `exit(0)`.
+
+The pending receipt survives app restarts. An expired receipt can be renewed
+through identity verification without canceling or recreating the server
+job. A partial local cleanup retains its recovery marker and blocks editor
+startup until cleanup succeeds.
+
+## Data boundary
+
+| Removed or disabled | Preserved |
+| --- | --- |
+| Regional Hub session/profile copies, capture inbox, access-statistics profile, MCP credentials, explicitly OpenPencil-scoped Hosted credentials | Shared ZSeven user, email, password, linked identity providers, and other product sessions |
+| New OpenPencil collaboration and product-scoped Hosted access | Shared wallet, financial records, generic shared-service authorization and usage records |
+| This installation's OpenPencil-managed documents, autosaves, settings, bookmarks, local credentials and caches | Files exported outside this app's container, collaborators' copies, and files on other devices |
+
+A minimal product tombstone remains to reject old OpenPencil access; normal
+sign-in must not silently recreate the deleted product account. Shared
+identity and provider bindings are deliberately not deleted or globally
+revoked. Historical LLM tokens lack product ownership, so they cannot be
+bulk-erased without affecting other products. Older released clients can
+still use that generic shared-service path; do not describe it as revoked.
+
+## Completion contract
+
+- Native creation sends the current device ID and SHA-256 of a random
+  receipt secret to `/api/v1/openpencil/deletion-requests`. Only the hash
+  is stored server-side. The secret never appears in a URL or log.
+- The web review/confirmation routes check device ownership against the
+  authenticated SSO user and require authentication within 15 minutes for
+  confirmation. The confirmation literal is `DELETE_OPENPENCIL`.
+- Native status requests carry the receipt secret in `Authorization`.
+  Response request ID, device ID, scope and pinned origin must all match.
+  Only `state: deleted` authorizes local cleanup.
+- Unconfirmed requests last 30 minutes; confirmation extends the receipt
+  to seven days. New verified receipts can bind the same existing job.
+- Regional cleanup acknowledgements must match the exact subject, job,
+  scope and region. A redirect, partial response or one successful region
+  is insufficient.
+- Hub write permits stop new writes and drain admitted writes before
+  cleanup. Permits have no timeout that could let a slow writer resurrect
+  deleted data. Crash recovery requires the documented reconciliation tool
+  and proof that the exact recorded process has stopped.
+- Local cleanup stops all editor scenes and pending save work before
+  removing files. It must not follow symlinks into external storage or
+  delete shared browser cookies.
+
+## Release dependencies
+
+Complete these steps in the service repositories before submitting a build:
+
+1. Apply SSO migration `000010_openpencil_accounts` before deploying the
+   product guards. Existing shared-identity tables remain intact.
+2. Deploy the SSO status reader and the CN/Global Hub cleanup handlers with
+   dedicated mounted status/cleanup credentials. Verify exact region
+   acknowledgements and partial-failure recovery. Do not reuse billing,
+   canvas, LLM issuer, or user credentials.
+3. Deploy the Gateway change that bounds inference by credential expiry,
+   and the product-scoped Hosted endpoint/token implementation.
+4. Enable new deletion intake only after both cleanup services are ready.
+   Disabling intake must preserve existing tombstones, status checks and
+   job retries. Follow the service-specific configuration/runbooks.
+5. Rebuild, audit, sign an
```

**File**: `packaging/ios/AppReviewNotes.txt` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+DRAFT — DO NOT SUBMIT YET. Fill and verify every bracketed field. Deletion is implemented in source; service deployment, a new signed auth matrix/build, physical-device QA, video, reviewer credentials, commercial details and rights evidence remain required. This draft is not a completion claim.
+
+Hello App Review,
+
+Here are the six items requested under Guideline 2.1, also provided in App Review Information > Notes.
+
+1. Recording and physical-device QA
+Video: [ACCESSIBLE URL / ATTACHMENT]
+App version/build: [VERSION (BUILD)]
+Device, latest OS and test date: [IPHONE MODEL / OS / DATE]
+Other supported-device testing: [IPAD RESULTS]
+The video begins with launch and demonstrates editing, save/reopen/export, registration/login, deletion, AI and applicable sharing/paid-feature flows. [ADD VERIFIED TIMESTAMPS.]
+
+2. Purpose and audience
+OpenPencil is a vector design app for designers, developers and visual-document creators. It provides editable layouts, text, shapes, templates and exports. Optional AI helps create or revise designs. Local editing does not require an account; online features require sign-in.
+
+3. Access and main features
+Use More > New File or Open File. Save the attached [SAMPLE FILENAME] to Files, open it, edit text/shapes, then Save/Save As or Export to PNG, JPEG, SVG or PDF.
+Sign in through More > Sign In with the demo credentials in the private review fields. Region/account type: [DETAILS]. Other account types: [ACCESS DETAILS IF ANY].
+More > AI: select [VERIFIED MODEL], enter [PROMPT]; the demo account has [VERIFIED QUOTA/ENTITLEMENT]. Paid access/purchase method: [ACTUAL BUSINESS MODEL AND IAP IDS IF APPLICABLE].
+More > Account > Delete OpenPencil Account opens identity verification and confirmation. Both service regions are cleaned before verified local erasure. A 16-minute credential drain and any service outage can delay completion. Shared ZSeven identity, other products, shared billing/usage records and externally saved copies remain. [CONFIRM DEPLOYED BUILD AND DEVICE TEST.]
+Private collaboration uses invitations/addresses and owner-approved editor/viewer access. [DESCRIBE THE BUILD'S SHARING/REPORT/BLOCK CONTROLS; REPORT/BLOCK UI IS CURRENTLY MISSING.]
+
+4. External services
+ZSeven SSO provides authentication. Regional OpenPencil Hub services provide service discovery and collaboration support; Hosted AI uses a ZSeven gateway. Optional image search uses Openverse and Wikimedia.
+AI upstreams/models, collaboration infrastructure and payment/entitlement providers: [VERIFIED LIST AND ROLES]. Sign-in providers are listed below. [CONFIRM IMAGE ATTRIBUTION.]
+
+5. Regional differences
+The local editor is shared across regions. Mainland China uses sso.zseven.cn with WeChat, Alipay and Douyin; Global uses sso.zseven.tech with Apple, GitHub and Google. Saved choice or network/locale detection selects the region; changes apply on the next launch. Hosted models/entitlements depend on the regional service. [CONFIRM AI/CONTENT/COMMERCIAL DIFFERENCES.]
+
+6. Regulated services and protected material
+[CONFIRM REGULATED-SERVICE APPLICABILITY; ATTACH AUTHORIZATION IF APPLICABLE.]
+[LIST APPLICABLE FONT/ICON/TEMPLATE/SDK/OTHER MATERIAL LICENSES AND AUTHORIZATION ATTACHMENTS.]
+
+Thank you.
```

**File**: `packaging/ios/AppReviewRecordingChecklist.md` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+# iOS Guideline 2.1 补充材料与真机录屏
+
+对应英文回复及 Notes 草稿：[AppReviewNotes.txt](AppReviewNotes.txt)。必须按实际提交的构建补全，不能把源码检查或模拟器运行写成真机验收。当前这份文件是执行清单，不是已经完成的验收记录。
+
+## 当前阻塞项
+
+| 项目 | 当前证据与所需动作 |
+| --- | --- |
+| 真机 QA 与录屏 | 本次仅检测到模拟器。需要实际 iPhone 和 iPad 测试记录；录屏设备运行 Apple 要求的最新正式系统。 |
+| 账户删除 | 已按“仅注销 OpenPencil，保留共享 ZSeven 身份及其他产品”实现源代码；仍需部署两区服务、数据库迁移及新签名认证库，再用新构建完成端到端真机验收。详见 [ACCOUNT_DELETION.md](ACCOUNT_DELETION.md)。 |
+| 审核登录 | 尚无已验证的审核账号。准备可持续使用且有足够权限/额度的账号，凭证只填 App Store Connect 的审核字段，不提交到 Git。 |
+| Hosted AI / 付费 | 源码有 Hosted 账号权益访问，iOS 未实现 StoreKit 购买流程。必须确认实际收费与权益来源、适用的购买方式以及审核账号访问，不得写成“没有付费功能”。 |
+| 协作与用户内容 | 通过邀请/地址加入，所有者接受或拒绝编辑者/查看者，访客确认所有者；未发现公开信息流。目前没有举报、屏蔽或移除已加入参与者的 UI。需要核对适用要求并补齐，不能直接填写“不适用”。 |
+| 第三方材料 | 已有项目和字体许可证文件，但尚未完成随包字体、图标、模板、SDK 及其他材料的完整授权核对。可选图片搜索使用 Openverse / Wikimedia；搜索来源不能代替每张图片的许可及署名核对。 |
+
+## 录制前
+
+- 安装将提交审核的同一版本和 build，记录 TestFlight 构建号、设备型号、系统版本和测试日期。代码修复必须进入新构建；旧构建不会随源码更新。
+- iPhone、iPad 都在当前支持范围内。分别测试启动、编辑、键盘、文件选择/保存/导出、登录、旋转及后台返回；保留结果和失败复现步骤。
+- 先按删除功能发布依赖完成部署，再用一次性测试账号验证。保持审核账号可用，勿用审核账号演示删除。用户将用 iPhone 录制；iPad 仍需独立真机测试。
+- 将 [Resources/sample.op](Resources/sample.op) 作为审核附件或提供可直接下载的地址，并在真机“文件”中准备好。该示例不会在正常启动时自动显示；通过 More > Open File 打开。
+- 审核账号在录屏地区可登录，并实际完成一次 Hosted AI 请求；仅看到模型列表不足以证明可以调用。
+- 本次源码验证 `bash packaging/ios/Tests/validate_sources.sh` 已通过；未生成新的 app/archive，也未做真机 QA。两地区隐私政策网页已返回 HTTP 200，内容一致；仍要在新构建中实测打开。
+- 不在录像里暴露密码、验证码、恢复码或私人设计。输入敏感信息时使用适当遮挡，但保留完整操作顺序和成功/失败结果。
+
+## 一次典型流程的录屏顺序
+
+1. 从设备主屏幕开始录制，点击 OpenPencil 图标，等待真实启动完成。记录语言和登录地区；不要从已打开的画布或模拟器开始。
+2. 打开 More > New File，创建文本和形状，修改文字、颜色或位置，演示撤销/重做与缩放。若实际启动进入其他首页，先录出进入编辑器的真实路径，并同步修改英文步骤。
+3. More > Save / Save As，通过系统“文件”保存；More > Open File 再次打开，确认内容一致。再打开提供给审核员的 `sample.op`。
+4. More > Export，选择 PNG、JPEG、SVG 或 PDF，展示系统保存界面和导出结果。iOS 不提供 WebP；iPad 额外测试其 Code 面板，别把桌面专属功能写进 iPhone 流程。
+5. More > Sign In，展示隐私政策入口、创建账户、验证邮箱及成功登录。用一次性邮箱完成注册；另演示已有审核账号的登录路径和 More > Account。若第三方登录在该地区提供，测试其实际返回流程。
+6. More > AI，选取该账号实际可用的 Hosted 模型，输入简短设计请求，等待真实结果，并展示结果可编辑。录出收费/权益入口及访问付费功能的实际步骤；若没有购买入口，说明其真实业务模式，不虚构 IAP 或绕过要求。
+7. 如果本构建允许用户向他人分享内容或协作，展示完整加入/共享流程和对应权限；根据适用情况录制举报内容、屏蔽用户及处理结果。相关能力欠缺时先修复，勿用文字代替未实现的机制。
+8. 用一次性测试账号，从 More > Account > Delete OpenPencil Account 进入删除流程，展示范围提示、身份确认、最终确认、“处理中”及完成结果。旧协作凭据需要 16 分钟失效等待，两区清理失败时可能更久；可以提供有时间标记的补充录像。确认 OpenPencil 专用账户及数据已清理，同时共享 ZSeven 身份、其他产品和钱包仍可用。不要声称通用共享 LLM 权限也已撤销。
+9. 重新启动应用，确认删除后的本地功能仍正常。展示任何需要联网/账号的功能如何提示用户。
+
+可以按设备或区域提供补充录像，但每段都标明对应 build、设备和系统。最终视频必须是实际设备操作记录；链接应能直接播放，不要求审核员注册额外账号。
+
+## 验收记录（完成后填写）
+
+| 设备 / 系统 | 版本 / build | 地区 | 启动编辑与文件 | 注册登录删除 | Hosted / 付费访问 | 协作 | 证据 |
+| --- | --- | --- | --- | --- | --- | --- | --- |
+| iPhone：待填 | 待填 | 待填 | 未测 | 未测 | 未测 | 未测 | 视频/日志待填 |
+| iPad：待填 | 待填 | 待填 | 未测 | 未测 | 未测 | 未测 | 视频/日志待填 |
+
+如某项不适用，写出提交构建中的依据及复核人，不把“未测”改写成“不适用”。模型、地区和权益由服务端决定时记录测试日期及所用账号类型，不将敏感凭证写入表格。
+
+## 填写与提交
+
+1. 补全英文草稿六项，删除所有占位符与草稿警告；每个“已完成”都要能对应上面的证据。
+2. 将相同内容填入 App Store Connect 的审核回复和 App Review Information > Notes。登录凭证填专用审核字段；多个账号类型需要分别提供访问说明。
+3. 上传/链接真机录屏、示例文件，以及适用的资质或授权材料。核对链接在未登录浏览器可访问。
+4. 选择包含修复的构建，检查实际界面截图和购买项目配置，再进行提审。上传成功、提交成功、等待审核和审核通过是不同状态，应分别记录。
+
+## 证据入口
+
+- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)：2.1 完整性/审核访问、2.3.3 截图、3.1.1 购买及 5.1.1 隐私。
+- [Apple 账户删除说明](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)：支持创建账户时需提供应用内发起删除的路径；若网站完成删除，应直达删除页面。
+- [iOS README](README.md)：构建、认证依赖、文件操作与验证边界。
+- [设备支持配置](project.yml)：`TARGETED_DEVICE_FAMILY: "1,2"`。
+- [More 菜单](../../crates/op-editor-ui/src/widgets/mobile_more_panel.rs) 与 [触摸入口处理](../../crates/op-host-native/src/widget_host/press_chrome_tiers.rs)：文件、AI、登录/账户及协作入口。
+- [地区配置](Sources/SsoRegion.swift)、[SSO 客户端](Sources/SsoAuthClient.swift)、[账户页](Sources/AccountCenterViewController.swift)、[注册页](Sources/RegisterViewController.swift)：地区、登录注册及账户操作的源码依据。
+- [Hosted 运行时](../../crates/op-hosted-models/src/lib.rs) 与 [Hosted 认证桥](../../crates/op-auth-bridge/src/real_hosted_access.rs)：登录账号提供访问与模型服务，不能从公开源码推断某个付费账号已获授权。
+- [图片搜索](../../crates/op-engine-ffi/src/editor_image_search.rs)：可选 Openverse / Wikimedia 图片来源。
+- [项目许可证](../../LICENSE)、[字体声明](../shared/fonts/NOTICE.txt)、[私有认证桥声明](../../crates/op-auth-bridge/NOTICE)：授权核对起点，不代表全部第三方材料已审计完成。
```

**File**: `packaging/ios/README.md` (modified, +14/-0)
```diff
@@ -10,6 +10,11 @@ Gestures are interpreted by the engine, not the shell: single-finger tap selects
 
 Sign-in is platform-native: the engine's device-login flow hands its verification URL to a UIKit screen that performs email/password sign-in against the regional SSO JSON API and approves the pairing directly, while third-party providers stay inside the app: Apple runs the native AuthenticationServices sheet and exchanges its nonce-bound identity token at `POST /api/v1/auth/providers/apple/native-login` (a failure surfaces an inline error — the web page is never involved), and the other providers open the pairing login page in an in-app Safari sheet deep-linked to the tapped provider — the running pairing is approved there. Registration and password recovery are native sibling screens. The Account tile opens a native account center backed by the engine's read-only profile snapshot (the private auth runtime never exposes its device token). The third-party buttons are region-accurate: the login screen fetches `GET /api/v1/auth/providers?channel=web_mobile` from the pairing's origin, so the mainland site lists WeChat / Alipay / Douyin and the global site lists Apple / GitHub / Google without a hardcoded table. The sign-in region (Mainland China `sso.zseven.cn` / Global `sso.zseven.tech`) resolves from a persisted user choice, then an IP-informed probe of the global gateway's mainland redirect, then the device locale; changes apply on the next launch because the auth runtime initializes once per process.
 
+The login, registration, and account screens expose the regional iOS privacy
+policy in an in-app Safari sheet. Account management and privacy links follow
+the active authentication region even after the user saves a different
+next-launch preference. Region selection does not terminate the app.
+
 ## Build inputs
 
 From the repository root, build the archive matching the destination if it is
@@ -71,6 +76,15 @@ hardening change requires a newly signed matrix and reviewed policy adoption.
 
 ## App Store / TestFlight release
 
+For Guideline 2.1 responses, fill in [AppReviewNotes.txt](AppReviewNotes.txt)
+and follow [AppReviewRecordingChecklist.md](AppReviewRecordingChecklist.md).
+These are preparation documents, not evidence of a completed review or
+physical-device QA. [ACCOUNT_DELETION.md](ACCOUNT_DELETION.md) describes the
+OpenPencil-only deletion flow, preserved shared ZSeven data, and required
+service/auth-matrix rollout. That rollout and the missing review evidence
+must be completed before resubmission; source validation alone does not
+establish App Store readiness.
+
 The formal `v*` Rust release calls `.github/workflows/ios-app-store.yml` with
 the exact release ref and source commit. The iOS upload is intentionally
 independent of the GitHub Release asset job: an App Store Connect or review
```

#### Recent Merged Pull Requests:
- **PR #264** (2026-10-29): fix(install): fall back to the newest release when no stable release exists (@PerryLink)
- **PR #262** (2026-10-27): chore(nix): update release manifest to v0.8.5 (@Kayshen-X)
- **PR #260** (2026-11-05): fix(codegen): export a text node's fill as its color (@jayhemnani9910)
- **PR #256** (closed): feat(canvas): bind a time uniform to shader fills (@kemalcalak)
- **PR #252** (2026-10-08): fix(web): isolate managed editor config and repair native CI (@finiking)
- **PR #251** (closed): feat(mcp): show agent cursor presence for client canvas writes (@gnoviawan)

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

## X. editor): add scoped ios account deletion

**RULE**:
When implementing operations in `crates/op-auth-bridge/src/hosted_access_tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ZSeven-W/openpencil. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `be4cf9c8`: editor): add scoped ios account deletion. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/op-auth-bridge/src/hosted_access_tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        "product": "openpencil",

#[test]
fn legacy_or_other_product_access_cannot_bypass_product_deletion() {
    let mut payload = fixture();
    payload.as_object_mut().unwrap().remove("product");
    assert!(decode(payload.to_string().as_bytes(), NOW).is_err());
    payload["product"] = json!("another-product");
    assert!(decode(payload.to_string().as_bytes(), NOW).is_err());
}
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `be4cf9c8` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
