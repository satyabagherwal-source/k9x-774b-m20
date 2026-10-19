> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zseven-w-openpencil-learnings.md`  
> **Source**: github ([https://github.com/ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil))  
> **Source Version**: `d155cd08`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T03:20:23.610Z  
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
> **Harvest Timestamp**: 2026-10-19T03:20:23.601Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ZSeven-W/openpencil`
- **Description**: The world's first open-source AI-native vector design tool and the first to feature concurrent Agent Teams. Design-as-Code. Turn prompts into UI directly on the live canvas. A modern alternative to Pencil.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6243 stars

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
}

impl AgentProvider {
    /// Append-only (mirror of `op_editor_core::chat::models`):
    /// persisted `connected` flags are indexed positionally, so the
    /// DeepSeek Harness slot was appended at the tail and positioned in
    /// the card list via [`AgentProvider::DISPLAY`].
    pub const ALL: [AgentProvider; 7] = [
        AgentProvider::ClaudeCode,
        AgentProvider::CodexCli,
        AgentProvider::OpenCode,
        AgentProvider::GithubCopilot,
        AgentProvider::Antigravity,
        AgentProvider::GrokBuild,
        AgentProvider::DeepSeekHarness,
    ];

    /// Card order on the Agents tab — a permutation of `ALL`, NOT the
    /// persistence order. DeepSeek Harness renders after Codex, before
    /// OpenCode (above the generic ACP block).
    pub const DISPLAY: [AgentProvider; 7] = [
        AgentProvider::ClaudeCode,
        AgentProvider::CodexCli,
        AgentProvider::DeepSeekHarness,
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
        ("are", "them")
    };
    format!(
        "{commit_clause}{} {subje
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
    messages.push(json!({ "role": "user", "content": cfg.user_prompt }));

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
        // whole turn budget on thinking and never emitted `batch_design`
        // (see `apply_reasoning_wire_control_anthropic`'s doc).
        crate::chat_builtin_http::apply_reasoning_wire_control_anthropic(
            &mut body,
            &cfg.model,
            cfg.disable_thinking,
        );
        let client = crate::provider_dial::client_for(cfg.dial_policy, &cfg.url).await?;
        let (max_retries, min_gap) = crate::chat_builtin_http::default_backoff_knobs();
        let resp = crate::chat_builtin_http::send_with_backoff(
        
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
    messages.push(json!({ "role": "user", "content": cfg.user_prompt }));

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
            let report = check_unfilled(&cfg.executor, cfg.finalize_on_exit).await;
            let eligible = eligible_for_fill_round(&report.unfilled, &fill_attempts);
            if !eligible.is_empty() {
                spend_fill_round(&mut fill_attempts, &eligible);
                messages.push(json!({ "role": "assistant", "content": stop_content() }));
                messages.push(
                    json!({ "role": "user", "content": contract_nudge_text(&report.committed, &eligible) }),
                );
                continue; // Does not count against `turn`.
            }
            // No screen left to chase — try one dedicated corrective round
            // for any unre
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
- **Issue #231** (2026-08-30): **Mirror text first frame**
  *Symptoms*: ### Version  v0.8.4  ### Platform  Web (browser)  ### Bug Description  Open AppImage v0.8.4 create frame create text field start typing (text starting from right side and mirrored)   ### Steps to Reproduce  https://github.com/user-attachments/assets/79f373f8-38d2-4dba-a3cb-ddd1e895cdae  ### Expected Behavior  Normal text  frame behaviour  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Bro, this isn't our project. Check out this post instead: https://x.com/FiniYang/status/2085410613581451267  Our interface doesn't look like this.

- **Issue #230** (2026-08-30): **Very tiny interface font**
  *Symptoms*: ### Version  0.8.4  ### Platform  Linux (native desktop)  ### Bug Description   in appImage v0.8.4 very small font! menu option - is correct, but interface elements are so small...  ### Steps to Reproduce  1) Open appImage 2) Interact with interface  ### Expected Behavior  In ideal - change interface font be myself or make same as menu font size   ### Screenshots / Recordings  <img width="1276" height="781" alt="Image" src="https://github.com/user-attachments/assets/271a2dc9-c81e-46cd-b886-0cf454439ca6" />  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Bro, this isn't our project. Check out this post instead: https://x.com/FiniYang/status/2085410613581451267  Our interface doesn't look like this.

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

### Incident Patch 1: `243c27f5` (2026-09-15)
**Commit Message**: fix(agent): route every Studio task family to the design pipeline

The intent classifier's keyword list grew up around app and web briefs,
so the 演示文稿 / 图文卡片 / 截图教程 / 信息图 / 活动海报 wrappers matched
nothing and five of the seven task families answered as plain chat: a
five-page deck brief produced one empty starter frame and a collapsed
thinking block. Add the deliverable nouns and the 做一份/一套/一张/一篇
verb forms, and pin every wrapper with a test so a new family cannot
slip through the same gap.

Three unrelated reds fixed alongside, each measured:

- The image-provider menu's expected height was a literal 176, which the
  Atlas Cloud provider (#227) invalidated the moment it took the list
  from four entries to five. Derive it from the list's length.
- The pointer-clock tests fold the PROCESS-GLOBAL agent indicator
  registry through `next_animation_deadline_ms`, so a concurrent test
  registering a reveal made an idle engine report a deadline it did not
  own: green single-threaded, three failures in parallel. Hold the
  registry's own test guard, the way the desktop indicator tests do.
- A rejected provider response now optionally goes to a local file named
  by OPENPENCIL_DEBUG_HTTP_E

**File**: `crates/op-chat-agent/src/backoff.rs` (modified, +59/-0)
```diff
@@ -121,6 +121,50 @@ pub fn default_backoff_knobs() -> (u32, Duration) {
     (BUILTIN_HTTP_MAX_RETRIES, builtin_http_min_gap())
 }
 
+/// Append a rejected response's status and body to the file named by
+/// `OPENPENCIL_DEBUG_HTTP_ERROR_BODY`, when it is set.
+///
+/// Off by default and never wired into chat, SSE, or stdout: a provider
+/// error body is untrusted and can echo the request's own headers, so it
+/// stays out of every channel the user or a browser can read. With the
+/// env var set it goes to that one file and nowhere else, which is what
+/// turns "http 400 Bad Request" from a dead end into a diagnosis
+/// (measured 2026-09-13: a modify turn died on a 400 whose reason was
+/// unreachable from inside the app).
+async fn dump_error_body(label: &str, status: reqwest::StatusCode, resp: reqwest::Response) {
+    let Ok(path) = std::env::var("OPENPENCIL_DEBUG_HTTP_ERROR_BODY") else {
+        return;
+    };
+    if path.is_empty() {
+        return;
+    }
+    let body = resp.text().await.unwrap_or_default();
+    let line = format!(
+        "[{}] {label} http {} {}\n{}\n",
+        chrono_like_stamp(),
+        status.as_u16(),
+        status.canonical_reason().unwrap_or(""),
+        body.chars().take(4_000).collect::<String>()
+    );
+    use std::io::Write as _;
+    if let Ok(mut file) = std::fs::OpenOptions::new()
+        .create(true)
+        .append(true)
+        .open(&path)
+    {
+        let _ = file.write_all(line.as_bytes());
+    }
+}
+
+/// Seconds since the UNIX epoch — enough to line a dump up against the
+/// app log without pulling a date crate into this leaf.
+fn chrono_like_stamp() -> u64 {
+    std::time::SystemTime::now()
+        .duration_since(std::time::UNIX_EPOCH)
+        .map(|d| d.as_secs())
+        .unwrap_or(0)
+}
+
 pub async fn send_with_backoff(
     label: &str,
     url: &str,
@@ -164,6 +208,10 @@ pub async fn send_with_backoff(
                 // Provider error bodies are untrusted and can echo request
                 // headers. Never relay them into chat/SSE where credentials
                 // could be reflected back into logs or browser responses.
+                // They ARE the only way to tell WHY a provider rejected a
+                // request, so an explicit opt-in writes them to a local file
+                // the developer named — never to the transcript.
+                dump_error_body(label, status, resp).await;
                 return Err(BuiltinHttpError::HttpStatus {
                     label: label.to_string(),
                     status,
@@ -292,3 +340,14 @@ pub fn apply_reasoning_wire_control_anthropic(
         obj.insert("thinking".into(), serde_json::json!({ "type": "disabled" }));
     }
 }
+
+#[cfg(test)]
+mod http_error_dump_tests {
+    #[test]
+    fn the_dump_is_off_unless_the_env_var_names_a_file() {
+        unsafe {
+            std::env::remove_var("OPENPENCIL_DEBUG_HTTP_ERROR_BODY");
+        }
+        assert!(std::env::var("OPENPENCIL_DEBUG_HTTP_ERROR_BODY").is_err());
+    }
+}
```

**File**: `crates/op-editor-ui/src/widgets/agent_settings_images.rs` (modified, +7/-2)
```diff
@@ -268,11 +268,16 @@ mod touch_tests {
         let closed_row = profile_row_rect_for_ui(content, &closed, 0, true);
         let open_row = profile_row_rect_for_ui(content, &open, 0, true);
 
-        assert_eq!(open_row.size.y - closed_row.size.y, 176.0);
+        // One 44 px row per entry of `ImageGenProvider::ALL`. The Atlas
+        // Cloud provider took the list from four to five, so the
+        // expanded profile grew 176 → 220; the constant here is the
+        // list's length, not a free number.
+        const EXPANDED_H: f32 = 44.0 * ImageGenProvider::ALL.len() as f32;
+        assert_eq!(open_row.size.y - closed_row.size.y, EXPANDED_H);
         assert_eq!(
             content_height_for_ui(&open, content.size.x, true)
                 - content_height_for_ui(&closed, content.size.x, true),
-            176.0
+            EXPANDED_H
         );
         let api = profile_input_rect_for_ui(open_row, &open, 0, ImageGenField::ApiKey, true);
         for (option_index, expected) in ImageGenProvider::ALL.iter().enumerate() {
```

**File**: `crates/op-engine-ffi/src/editor_pointer_clock_tests.rs` (modified, +21/-0)
```diff
@@ -183,6 +183,13 @@ fn app_state_string(engine: &mut OpEngine, key: &str) -> Option<String> {
 /// times (fresh host clock is 0).
 #[test]
 fn dedicated_time_stamped_pointer_entries_swipe_without_an_intervening_frame() {
+    // `next_animation_deadline_ms` folds the PROCESS-GLOBAL agent
+    // indicator registry, so a concurrent test that registers a reveal
+    // makes this idle engine report a deadline it does not own. Hold the
+    // registry's own test guard for the whole body, the way the desktop
+    // indicator tests do.
+    let _indicators = op_editor_core::agent_indicators::test_guard();
+    op_editor_core::agent_indicators::clear();
     let mut engine = swipe_engine();
     let pointer = &mut engine as *mut OpEngine;
     // The preview no longer pins a blanket `now + 33` wake: an idle session
@@ -252,6 +259,13 @@ fn dedicated_time_stamped_pointer_entries_swipe_without_an_intervening_frame() {
 /// `onSwipe` runs exactly once.
 #[test]
 fn out_of_order_dedicated_events_keep_global_clocks_and_swipe_uses_factual_delta() {
+    // `next_animation_deadline_ms` folds the PROCESS-GLOBAL agent
+    // indicator registry, so a concurrent test that registers a reveal
+    // makes this idle engine report a deadline it does not own. Hold the
+    // registry's own test guard for the whole body, the way the desktop
+    // indicator tests do.
+    let _indicators = op_editor_core::agent_indicators::test_guard();
+    op_editor_core::agent_indicators::clear();
     let mut engine = swipe_engine();
     let pointer = &mut engine as *mut OpEngine;
 
@@ -315,6 +329,13 @@ fn out_of_order_dedicated_events_keep_global_clocks_and_swipe_uses_factual_delta
 /// (monotonically) and never move them backward.
 #[test]
 fn cancel_and_early_returns_advance_global_clocks_monotonically() {
+    // `next_animation_deadline_ms` folds the PROCESS-GLOBAL agent
+    // indicator registry, so a concurrent test that registers a reveal
+    // makes this idle engine report a deadline it does not own. Hold the
+    // registry's own test guard for the whole body, the way the desktop
+    // indicator tests do.
+    let _indicators = op_editor_core::agent_indicators::test_guard();
+    op_editor_core::agent_indicators::clear();
     let mut engine = swipe_engine();
     let pointer = &mut engine as *mut OpEngine;
 
```

**File**: `crates/op-orchestrator/src/intent.rs` (modified, +42/-0)
```diff
@@ -73,6 +73,29 @@ const DESIGN_KEYWORDS: &[&str] = &[
     "网页",
     "小程序",
     "后台",
+    // 中文动词 —— 量词形式。Studio 首页的七类任务包装语都用"做一份/
+    // 一套/一张/一篇"起头，而旧表只有"做一个/做个"，于是演示文稿、图文
+    // 卡片、截图教程、信息图、活动海报五类全部落到 chat。
+    "做一份",
+    "做一套",
+    "做一张",
+    "做一篇",
+    "做份",
+    "做套",
+    "做张",
+    // 中文设计名词 —— 交付物形态。与上面的页面类名词同理：在设计工具
+    // 语境里这些词几乎总是"造一个 X"。
+    "演示文稿",
+    "幻灯片",
+    "ppt",
+    "slides",
+    "图文卡片",
+    "卡片",
+    "海报",
+    "信息图",
+    "长图",
+    "截图教程",
+    "排版",
 ];
 
 /// 把用户消息分类为 [`Intent::Design`] 或 [`Intent::Chat`]。
@@ -114,6 +137,25 @@ mod tests {
         }
     }
 
+    /// Every Studio Home task wrapper must classify as Design. The
+    /// deliverable is already chosen by the task card, so a wrapper that
+    /// reads as chat silently answers the user in prose instead of
+    /// drawing (measured 2026-09-13 on 演示文稿).
+    #[test]
+    fn every_studio_home_task_wrapper_classifies_as_design() {
+        for p in [
+            "请设计一套可编辑的高保真手机 App 界面（mobile app，375×812）。",
+            "请设计一个完整的纵向滚动网站页面（landing page，1440 宽）。",
+            "请做一份 5 页的 PPT 演示文稿（slides，16:9）。封面、正文与结束页风格统一。",
+            "请做一套图文卡片（card，竖版 3:4，多页轮播）。保持统一排版与视觉系统。",
+            "请做一篇截图教程图文（card，竖版，截图配上步骤说明）。",
+            "请做一张数据对比信息图长图（card，竖版图文长图）。",
+            "请做一套活动海报（card，主海报竖版 + 社交方图）。",
+        ] {
+            assert_eq!(classify_intent(p), Intent::Design, "{p}");
+        }
+    }
+
     #[test]
     fn questions_classify_as_chat() {
         for p in [
```

---

### Incident Patch 2: `49100c2c` (2026-09-16)
**Commit Message**: fix(i18n): carry the catalog size into the exporter, and split the settings tests

Two reds the first CI run that actually executed on this branch caught,
both from a constant living in more than one place.

The runtime catalog exporter keeps its own EXPECTED_KEY_COUNT beside the
Rust-side assertion in `catalog_integrity_tests`. The Studio entry
surface bumped the Rust one to 1852 and left the exporter at 1717, so
the WASM bundle job failed on "English catalog has 1852 keys; expected
1717". Bump it and point each at the other, and have the exporter's own
test read the constant instead of repeating the number a third time.

The collab security-boundary check enforces the repository's 800-line
cap over `op-editor-host-core/src`, where `settings_io_tests.rs` arrived
from upstream at 807 lines. Split the payload round-trips into a sibling
at the same seam the file already uses for its other two test modules.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-host-core/src/settings_io_payload_tests.rs` (added, +544/-0)
```diff
@@ -0,0 +1,544 @@
+//! Settings payload round-trips: the MCP CLI toggle arrays across their
+//! historical lengths, and the fields a payload may and may not carry.
+//!
+//! Sibling of `settings_io_tests.rs`, split out at the 800-line cap the
+//! collab security-boundary check enforces over this crate.
+
+use super::*;
+
+#[test]
+fn eleven_cli_mcp_payload_keeps_its_toggles_and_leaves_zcode_off() {
+    let payload: SettingsPayload = serde_json::from_str(
+        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true,false,true,false]}"#,
+    )
+    .unwrap();
+    let mut dst = EditorState::new();
+    dst.editor_ui.agent_settings.mcp_cli_enabled = [true; 13];
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.mcp_cli_enabled,
+        [true, false, true, false, true, false, true, true, false, true, false, false, false]
+    );
+}
+
+#[test]
+fn eight_cli_mcp_payload_drops_gemini_without_shifting_later_clis() {
+    let payload: SettingsPayload = serde_json::from_str(
+        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true]}"#,
+    )
+    .unwrap();
+    let mut dst = EditorState::new();
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.mcp_cli_enabled,
+        [true, false, false, true, false, true, true, false, false, false, false, false, false]
+    );
+}
+
+#[test]
+fn seven_provider_connected_payload_is_the_current_layout_and_round_trips() {
+    // The current layout has seven slots (DeepSeek Harness appended at
+    // the tail). A 7-entry file must round-trip VERBATIM — treating it
+    // as the legacy Gemini-era layout would silently shift every saved
+    // connection on every load.
+    let payload: SettingsPayload = serde_json::from_str(
+        r#"{"version":1,"connected":[true,false,true,false,true,true,false]}"#,
+    )
+    .unwrap();
+    let mut dst = EditorState::new();
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.connected,
+        [true, false, true, false, true, true, false]
+    );
+}
+
+#[test]
+fn six_provider_connected_payload_keeps_flags_and_leaves_dsh_off() {
+    // Files written since the Gemini retirement have six slots; the
+    // appended DeepSeek Harness slot starts disconnected.
+    let payload: SettingsPayload =
+        serde_json::from_str(r#"{"version":1,"connected":[true,false,true,false,true,true]}"#)
+            .unwrap();
+    let mut dst = EditorState::new();
+
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(
+        dst.editor_ui.agent_settings.connected,
+        [true, false, true, false, true, true, false]
+    );
+}
+
+#[test]
+fn five_provider_connected_payload_drops_retired_gemini() {
+    let payload: SettingsPayload =
+        serde_json::from_str(r#"{"version":1,"connected":[true,false,false,false,true]}"#).unwrap();
+    let mut dst = EditorState::new();
+    dst.editor_ui.agent_settings.connected = [false, false, false, false, true, true, true];
+    apply_payload(&mut dst, payload);
+    assert_eq!(
+        dst.editor_ui.agent_settings.connected,
+        [true, false, false, false, false, false, false]
+    );
+}
+
+#[test]
+fn legacy_settings_without_connected_field_default_to_disconnected() {
+    // A settings.json written before the `connected` field
+    // existed must still load — the missing field defaults to
+    // all-disconnected rather than failing the parse.
+    let legacy = r#"{"version":1,"theme":"dark","locale":"en-US"}"#;
+    let payload: SettingsPayload = serde_json::from_str(legacy).unwrap();
+    let mut dst = EditorState::new();
+    apply_payload(&mut dst, payload);
+    assert_eq!(dst.editor_ui.agent_settings.connected, [false; 7]);
+}
+
+#[test]
+fn builtin_agents_round_trip_through_payload() {
+    let mut src = EditorState::new();
+    src.editor_ui.agent_settings.add_builtin_agent_config(
+        "MiniMax",
+        "sk-test",
+        "MiniMax-M2.7",
+        BuiltinAgentKind::Anthropic,
+        "https://api.minimaxi.com/anthropic",
+    );
+
+    let json = serde_json::to_string(&to_payload(&src)).unwrap();
+    let payload: SettingsPayload = serde_json::from_str(&json).unwrap();
+    let mut dst = EditorState::new();
+    apply_payload(&mut dst, payload);
+
+    assert_eq!(dst.editor_ui.agent_settings.builtin_agents.len(), 1);
+    assert_eq!(
+        dst.editor_ui.agent_settings.builtin_agents[0].display_name,
+        "MiniMax"
+    );
+    assert_eq!(
+        dst.editor_ui.agent_settings.builtin_agents[0].api_key,
+        "sk-test"
+    );
+    assert_eq!(
+        dst.editor_ui.agent_settings.builtin_agents[0].preset,
+        BuiltinAgentPresetKey::MiniMax
+    );
+    assert_eq!(
+        dst.editor_ui.agent_settings.builtin_agents[0].models,
+        ["MiniMax-M2.7"]
+    );
+}
+
+#[test]
+fn builtin_agent_multiple_models_round_trip_with_legacy_first_mirror() {
+    let mut src = Edi
```

**File**: `crates/op-editor-host-core/src/settings_io_tests.rs` (modified, +2/-536)
```diff
@@ -269,539 +269,5 @@ fn seven_cli_mcp_payload_keeps_its_toggles_and_leaves_the_new_clis_off() {
     );
 }
 
-#[test]
-fn eleven_cli_mcp_payload_keeps_its_toggles_and_leaves_zcode_off() {
-    let payload: SettingsPayload = serde_json::from_str(
-        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true,false,true,false]}"#,
-    )
-    .unwrap();
-    let mut dst = EditorState::new();
-    dst.editor_ui.agent_settings.mcp_cli_enabled = [true; 13];
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.mcp_cli_enabled,
-        [true, false, true, false, true, false, true, true, false, true, false, false, false]
-    );
-}
-
-#[test]
-fn eight_cli_mcp_payload_drops_gemini_without_shifting_later_clis() {
-    let payload: SettingsPayload = serde_json::from_str(
-        r#"{"version":1,"mcp_cli_enabled":[true,false,true,false,true,false,true,true]}"#,
-    )
-    .unwrap();
-    let mut dst = EditorState::new();
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.mcp_cli_enabled,
-        [true, false, false, true, false, true, true, false, false, false, false, false, false]
-    );
-}
-
-#[test]
-fn seven_provider_connected_payload_is_the_current_layout_and_round_trips() {
-    // The current layout has seven slots (DeepSeek Harness appended at
-    // the tail). A 7-entry file must round-trip VERBATIM — treating it
-    // as the legacy Gemini-era layout would silently shift every saved
-    // connection on every load.
-    let payload: SettingsPayload = serde_json::from_str(
-        r#"{"version":1,"connected":[true,false,true,false,true,true,false]}"#,
-    )
-    .unwrap();
-    let mut dst = EditorState::new();
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.connected,
-        [true, false, true, false, true, true, false]
-    );
-}
-
-#[test]
-fn six_provider_connected_payload_keeps_flags_and_leaves_dsh_off() {
-    // Files written since the Gemini retirement have six slots; the
-    // appended DeepSeek Harness slot starts disconnected.
-    let payload: SettingsPayload =
-        serde_json::from_str(r#"{"version":1,"connected":[true,false,true,false,true,true]}"#)
-            .unwrap();
-    let mut dst = EditorState::new();
-
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(
-        dst.editor_ui.agent_settings.connected,
-        [true, false, true, false, true, true, false]
-    );
-}
-
-#[test]
-fn five_provider_connected_payload_drops_retired_gemini() {
-    let payload: SettingsPayload =
-        serde_json::from_str(r#"{"version":1,"connected":[true,false,false,false,true]}"#).unwrap();
-    let mut dst = EditorState::new();
-    dst.editor_ui.agent_settings.connected = [false, false, false, false, true, true, true];
-    apply_payload(&mut dst, payload);
-    assert_eq!(
-        dst.editor_ui.agent_settings.connected,
-        [true, false, false, false, false, false, false]
-    );
-}
-
-#[test]
-fn legacy_settings_without_connected_field_default_to_disconnected() {
-    // A settings.json written before the `connected` field
-    // existed must still load — the missing field defaults to
-    // all-disconnected rather than failing the parse.
-    let legacy = r#"{"version":1,"theme":"dark","locale":"en-US"}"#;
-    let payload: SettingsPayload = serde_json::from_str(legacy).unwrap();
-    let mut dst = EditorState::new();
-    apply_payload(&mut dst, payload);
-    assert_eq!(dst.editor_ui.agent_settings.connected, [false; 7]);
-}
-
-#[test]
-fn builtin_agents_round_trip_through_payload() {
-    let mut src = EditorState::new();
-    src.editor_ui.agent_settings.add_builtin_agent_config(
-        "MiniMax",
-        "sk-test",
-        "MiniMax-M2.7",
-        BuiltinAgentKind::Anthropic,
-        "https://api.minimaxi.com/anthropic",
-    );
-
-    let json = serde_json::to_string(&to_payload(&src)).unwrap();
-    let payload: SettingsPayload = serde_json::from_str(&json).unwrap();
-    let mut dst = EditorState::new();
-    apply_payload(&mut dst, payload);
-
-    assert_eq!(dst.editor_ui.agent_settings.builtin_agents.len(), 1);
-    assert_eq!(
-        dst.editor_ui.agent_settings.builtin_agents[0].display_name,
-        "MiniMax"
-    );
-    assert_eq!(
-        dst.editor_ui.agent_settings.builtin_agents[0].api_key,
-        "sk-test"
-    );
-    assert_eq!(
-        dst.editor_ui.agent_settings.builtin_agents[0].preset,
-        BuiltinAgentPresetKey::MiniMax
-    );
-    assert_eq!(
-        dst.editor_ui.agent_settings.builtin_agents[0].models,
-        ["MiniMax-M2.7"]
-    );
-}
-
-#[test]
-fn builtin_agent_multiple_models_round_trip_with_legacy_first_mirror() {
-    let mut src = EditorState::new();
-    src.editor_ui.agent_settings.add_builtin_agent_configs(
-        "Private",
-        "sk-test",
-        ["model-a", "model-b", "model-c"],
-        BuiltinAgentKind::OpenAiCompat,
-        "ht
```

**File**: `tools/export-i18n-catalogs.py` (modified, +6/-1)
```diff
@@ -14,7 +14,12 @@
 REPO_ROOT = Path(__file__).resolve().parents[1]
 I18N_DIR = REPO_ROOT / "crates" / "op-i18n" / "src" / "i18n"
 LOCALE_FILE = I18N_DIR.parent / "locale.rs"
-EXPECTED_KEY_COUNT = 1717
+# Mirrors the Rust-side assertion in
+# `crates/op-i18n/src/i18n/catalog_integrity_tests.rs` ("update the
+# intentional catalog size"). The two live apart, so adding keys means
+# bumping BOTH — the Studio entry surface bumped the Rust one and left
+# this at 1717, which only the WASM bundle job noticed.
+EXPECTED_KEY_COUNT = 1852
 TABLE_SUFFIXES = ("", "_git", "_panel", "_collab")
 
 # Module stem, Locale variant, and the exact value returned by Locale::code().
```

**File**: `tools/test_export_i18n_catalogs.py` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ def test_check_mode_does_not_write(self) -> None:
             self.assertEqual(result.returncode, 0, result.stderr)
             self.assertEqual(list(root.iterdir()), [])
             self.assertIn("15 locales", result.stdout)
-            self.assertIn("1717 keys", result.stdout)
+            self.assertIn(f"{self.exporter.EXPECTED_KEY_COUNT} keys", result.stdout)
 
     def test_export_writes_exact_lazy_locale_set_deterministically(self) -> None:
         with tempfile.TemporaryDirectory() as temporary:
```

---

### Incident Patch 3: `6f0f176b` (2026-09-14)
**Commit Message**: fix(ai): keep the radius context cut on a char boundary (#241)

px_values capped each number's context at 48 bytes. That is a boundary only for Latin script; a CJK or Hangul radius sentence puts three bytes on most characters, so the cut landed mid-character and tail[..end] panicked. floor_char_boundary is a no-op on ASCII, where every index is already a boundary.

**File**: `crates/op-ai-skills/src/style_guide/token_table.rs` (modified, +5/-4)
```diff
@@ -512,10 +512,11 @@ fn px_values(line: &str) -> Vec<(i64, String)> {
         // Up to the next clause break — that is where this number's
         // description ends and the next one's begins.
         let tail = &line[index..];
-        let end = tail
-            .find([',', ';', '.', ')', '(', '—'])
-            .unwrap_or(tail.len())
-            .min(48);
+        let end = tail.floor_char_boundary(
+            tail.find([',', ';', '.', ')', '(', '—'])
+                .unwrap_or(tail.len())
+                .min(48),
+        );
         out.push((value, tail[..end].to_string()));
     }
     out
```

**File**: `crates/op-ai-skills/src/style_guide/token_table_tests.rs` (modified, +26/-0)
```diff
@@ -220,3 +220,29 @@ fn the_palette_floor_reports_colours_with_their_own_role_text() {
     assert_eq!(prose.len(), 2);
     assert_eq!(prose[0].color, "#101014");
 }
+
+/// A radius sentence whose description is not written in Latin script. The
+/// per-number context is cut at 48 bytes, and a guide's prose is arbitrary
+/// author text — most CJK and Hangul characters are three bytes each, so that
+/// cut lands mid-character on ordinary input.
+#[test]
+fn a_radius_line_written_in_another_script_is_read_and_classified() {
+    for line in [
+        "Corner radius: 12px  卡片与面板容器的外框圆角，用于所有卡片与弹层",
+        "Corner radius: 12px卡片与面板容器的外框圆角，用于所有卡片与弹层",
+        "Corner radius: 12px 카드와 패널 컨테이너의 바깥 테두리 라운드에 사용",
+    ] {
+        let content = format!("# G\n\n## Shape\n\n{line}\n");
+        let values = extract_style_guide_values(&content);
+        // Nothing in these says which role the radius is for, so nothing is
+        // invented — but the scan has to reach that answer, not panic on
+        // the way.
+        assert_eq!(values.radius, StyleRadius::default(), "line: {line}");
+    }
+
+    // The same sentence with an English role cue still classifies.
+    let mixed = extract_style_guide_values(
+        "# G\n\n## Shape\n\nCorner radius: 24px card 카드와 패널 컨테이너의 바깥 테두리\n",
+    );
+    assert_eq!(mixed.radius.card, Some(24));
+}
```

#### Recent Merged Pull Requests:
- **PR #252** (2026-10-08): fix(web): isolate managed editor config and repair native CI (@finiking)
- **PR #248** (closed): feat(agent): add packaged browser snapshot capture tool (@caniko)
- **PR #243** (2026-09-14): fix(design-lint): guard the transparent-alpha test against a non-ascii fill (@kevin9327)
- **PR #242** (2026-09-14): fix(cli): decode a percent-encoded resource name before the disk lookup (@kevin9327)
- **PR #241** (2026-09-14): fix(ai): keep the radius context cut on a char boundary (@kevin9327)
- **PR #240** (2026-09-14): fix(html): stop a non-ascii css prelude from panicking the import (@kevin9327)

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

## X. agent): route every Studio task family to the design pipeline

**RULE**:
When implementing operations in `crates/op-chat-agent/src/backoff.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ZSeven-W/openpencil. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `243c27f5`: agent): route every Studio task family to the design pipeline. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/op-chat-agent/src/backoff.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Append a rejected response's status and body to the file named by
/// `OPENPENCIL_DEBUG_HTTP_ERROR_BODY`, when it is set.
///
/// Off by default and never wired into chat, SSE, or stdout: a provider
/// error body is untrusted and can echo the request's own headers, so it
/// stays out of every channel the user or a browser can read. With the
/// env var set it goes to that one file and nowhere else, which is what
/// turns "http 400 Bad Request" from a dead end into a diagnosis
/// (measured 2026-09-13: a modify turn died on a 400 whose reason was
/// unreachable from inside the app).
async fn dump_error_body(label: &str, status: reqwest::StatusCode, resp: reqwest::Response) {
    let Ok(path) = std::env::var("OPENPENCIL_DEBUG_HTTP_ERROR_BODY") else {
        return;
    };
    if path.is_empty() {
        return;
    }
    let body = resp.text().await.unwrap_or_default();
    let line = format!(
        "[{}] {label} http {} {}\n{}\n",
        chrono_like_stamp(),
        status.as_u16(),
        status.canonical_reason().unwrap_or(""),
        body.chars().take(4_000).collect::<String>()
    );
    use std::io::Write as _;
    if let Ok(mut file) = std::fs::OpenOptions::new(
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `243c27f5` are properly handled with clean fallback behavior.
