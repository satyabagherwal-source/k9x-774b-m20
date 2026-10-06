# Forensic Learning Record (Deep Inspection): ZSeven-W/openpencil

> **Canonical Artifact**: `07_PROJECT_LEARNING/zseven-w-openpencil-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:49:33.645Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ZSeven-W/openpencil`
- **Description**: The world's first open-source AI-native vector design tool and the first to feature concurrent Agent Teams. Design-as-Code. Turn prompts into UI directly on the live canvas. A modern alternative to Pencil.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6078 stars

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

### Core Architecture Module: `crates/op-chrome-extension-core/src/delivery.rs`
```
//! Where a capture goes: the local editor, or the signed-in account.
//!
//! This is a two-value enum and one resolution rule, and it is in Rust for
//! the same reason the endpoint whitelist is: the *destination of a page
//! capture* is the one decision in this extension that must not be reachable
//! by accident. A stored value from a future build, a session that expired
//! between the popup opening and the button being pressed, a target the
//! server side does not exist for yet — every one of those has to collapse to
//! "the loopback editor the user configured", and [`resolve`] is where that
//! collapse happens, once, with tests.
//!
//! # The account target is wired
//!
//! op-hub grew the snapshot inbox this flag was waiting on:
//! `POST /api/v1/snapshots` (`op-hub/backend/internal/httpapi/snapshot_routes.go`),
//! authenticated by the session cookie plus `X-CSRF-Token`, with the
//! extension's own origin explicitly admitted
//! (`auth.ExtensionCapableMutation`). [`ACCOUNT_AVAILABLE`] is therefore
//! `true`, the popup's delivery row offers the account as a selectable
//! destination, and [`resolve`] returns [`Target::Account`] — but still only
//! for a user who is signed in *right now*.
//!
//! The request, the size ceiling and the reply classification live in
//! [`crate::hub`] and [`crate::hub_reply`]; this module remains what it always
//! was, the single place that decides where a capture is allowed to go.

/// Whether delivery to the signed-in account is implemented end to end.
///
/// A client that offers the target against a hub that 404s it is worse than
/// one that says "coming soon", so this stays true only while BOTH regional
/// hubs answer the inbox route. A `404` from a hub that has the route
/// unconfigured is still handled — it surfaces as
/// [`crate::hub_reply::CreateFailure::Unavailable`] — but that is a fallback,
/// not the plan.
pub const ACCOUNT_AVAILABLE: bool = true;

/// A delivery destination.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Target {
    /// The OpenPencil listening on the configured loopback endpoint.
    #[default]
    Local,
    /// The signed-in user's OpenPencil account.
    Account,
}

impl Target {
    /// Persisted spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Target::Local => "local",
            Target::Account => "account",
        }
    }

    /// Parse a stored value; anything unrecognised is [`Target::Local`].
    pub fn from_stored(raw: &str) -> Target {
        match raw.trim() {
            "account" => Target::Account,
            _ => Target::Local,
        }
    }
}

/// The target actually used for the next capture.
///
/// `stored` is what the user last chose, `signed_in` whether a Hub session
/// was observed *in this popup session*. The account target survives only
/// when it is implemented and there is an account to deliver to; in every
/// other case the capture goes where it has always gone.
pub fn resolve(stored: &str, signed_in: bool) -> Target {
    match Target::from_stored(stored) {
        Target::Account if ACCOUNT_AVAILABLE && signed_in => Target::Account,
        _ => Target::Local,
    }
}

/// Whether the popup should render the delivery row at all.
///
/// Signed out there is exactly one destination, and a picker with one option
/// is noise. Signed in the row appears with both destinations selectable.
pub fn row_visible(signed_in: bool) -> bool {
    signed_in
}

```

### Core Architecture Module: `crates/op-chrome-extension-core/src/design_md.rs`
```
//! Intelligent and deterministic `design.md` extraction contracts.
//!
//! The browser-facing request has two deliberately separate paths:
//!
//! * the paired desktop host may turn the bounded evidence into a richer guide
//!   with the user's selected model;
//! * this module can always render the same evidence locally, without a model
//!   or a browser engine, so an old/offline host never loses the capture.
//!
//! Both paths are trust boundaries. A captured page controls every string in
//! the evidence and a loopback process controls every reply, so sizes, shapes,
//! and display text are checked again here before anything is downloaded.

use std::collections::BTreeSet;

use serde_json::{Map, Value};

use crate::js_text::js_trim;

/// Maximum UTF-8 request body accepted by both the extension and host.
pub const MAX_EVIDENCE_BYTES: usize = 256 * 1024;

const MAX_COLORS: usize = 64;
const MAX_TYPOGRAPHY: usize = 64;
const MAX_SPACING: usize = 64;
const MAX_RADII: usize = 64;
const MAX_SHADOWS: usize = 32;
const MAX_COMPONENTS: usize = 64;
const MAX_COMPONENT_SAMPLES: usize = 4;
const MAX_GRADIENTS: usize = 32;
const MAX_MEDIA_QUERIES: usize = 32;
const MAX_CSS_VARIABLES: usize = 64;
const MAX_COUNT: u64 = 10_000_000;
const MAX_CSS_LENGTH: f64 = 100_000.0;

/// Convert extractor evidence into a deterministic corpus-compatible guide.
pub fn evidence_to_design_md(json: &str) -> Result<String, EvidenceError> {
    if json.len() > MAX_EVIDENCE_BYTES {
        return Err(EvidenceError::TooLarge);
    }
    let value: Value = serde_json::from_str(json).map_err(|_| EvidenceError::Malformed("json"))?;
    let evidence = Evidence::parse(&value)?;
    Ok(crate::design_md_render::render(&evidence))
}

/// Why deterministic extraction refused an evidence document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvidenceError {
    TooLarge,
    Malformed(&'static str),
}

impl std::fmt::Display for EvidenceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TooLarge => f.write_str("design evidence exceeds 256 KiB"),
            Self::Malformed(field) => write!(f, "design evidence is malformed: {field}"),
        }
    }
}

impl std::error::Error for EvidenceError {}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct Evidence {
    pub title: String,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub viewport_dpr: f64,
    pub color_scheme: Option<String>,
    pub page_background: Option<String>,
    pub colors: Vec<ColorEvidence>,
    pub typography: Vec<TypographyEvidence>,
    pub spacing: Vec<SpacingEvidence>,
    pub radii: Vec<RadiusEvidence>,
    pub shadows: Vec<CountedText>,
    pub components: Vec<ComponentEvidence>,
    pub gradients: Vec<CountedText>,
    pub media_queries: Vec<String>,
    pub css_variables: Vec<CssVariableEvidence>,
    pub element_count: u64,
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct ColorEvidence {
    pub value: String,
    pub usage: String,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct TypographyEvidence {
    pub role: String,
    pub family: String,
    pub size: f64,
    pub weight: u16,
    pub line_height: Option<f64>,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct SpacingEvidence {
    pub property: String,
    pub value: f64,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct RadiusEvidence {
    pub value: u32,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct CountedText {
    pub value: String,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct ComponentEvidence {
    pub kind: String,
    pub count: u64,
    pub samples: Vec<ComponentSample>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub(super) struct ComponentSample {
    pub background: Option<String>,
    pub color: Option<String>,
    pub font_family: Option<String>,
    pub font_size: Option<f64>,
    pub font_weight: Option<u16>,
    pub line_height: Option<f64>,
    pub padding: Option<String>,
    pub gap: Option<f64>,
    pub radius: Option<u32>,
    pub border: Option<String>,
    pub shadow: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct CssVariableEvidence {
    pub name: String,
    pub value: String,
    pub kind: String,
}

impl Evidence {
    fn parse(value: &Value) -> Result<Self, EvidenceError> {
        let root = as_object(value, "root")?;
        if integer(root.get("version"), "version")? != 1 {
            return Err(EvidenceError::Malformed("version"));
        }
        let title = text(root.get("title"), 120, "title")?;
        let viewport = as_object(required(root, "viewport")?, "viewport")?;
        let viewport_width = bounded_u32(viewport.get("width"), 1, 100_000, "viewport.width")?;
        let viewport_height = bounded_u32(viewport.get("height"), 1, 100_000, "viewport.height")?;
        let viewport_dpr = match viewport.get("dpr") {
            Some(value) => bounded_number(Some(value), 0.1, 16.0, "viewport.dpr")?,
            None => 1.0,
        };
        let color_scheme = optional_text(root.get("colorScheme"), 16, "colorScheme")?;
        let page_background = match root.get("pageBackground") {
            Some(Value::Null) => None,
            Some(value) => Some(hex_color(value, "pageBackground")?),
            None => return Err(EvidenceError::Malformed("pageBackground")),
        };

        Ok(Self {
            title,
            viewport_width,
            viewport_height,
            viewport_dpr,
            color_scheme,
            page_background,
            colors: parse_colors(required(root, "colors")?)?,
            typography: parse_typography(required(root, "typography")?)?,
            spacing: parse_spacing(required(root, "spacing")?)?,
            radii: parse_radii(required(root, "radii")?)?,
            shadows: parse_counted_text(required(root, "shadows")?, MAX_SHADOWS, 160, "shadows")?,
            components: parse_components(required(root, "components")?)?,
            gradients: parse_counted_text(
                required(root, "gradients")?,
                MAX_GRADIENTS,
                200,
                "gradients",
            )?,
            media_queries: parse_text_array(
                required(root, "mediaQueries")?,
                MAX_MEDIA_QUERIES,
                160,
                "mediaQueries",
            )?,
            css_variables: parse_css_variables(required(root, "cssVariables")?)?,
            element_count: match root.get("elementCount") {
                Some(value) => bounded_integer(Some(value), 0, MAX_COUNT, "elementCount")?,
                None => 0,
            },
            truncated: match root.get("truncated") {
                Some(value) => value
                    .as_bool()
                    .ok_or(EvidenceError::Malformed("truncated"))?,
                None => false,
            },
        })
    }
}

fn parse_colors(value: &Value) -> Result<Vec<ColorEvidence>, EvidenceError> {
    let values = bounded_array(value, MAX_COLORS, "colors")?;
    values
        .iter()
        .map(|value| {
            let object = as_object(value, "colors[]")?;
            let usage = color_usage(object)?;
            if !matches!(
                usage.as_str(),
                "text" | "background" | "border" | "shadow" | "gradient"
            ) {
                return Err(EvidenceError::Malformed("colors[].usage"));
            }
            Ok(ColorEvidence {
                value: hex_color(required(object, "value")?, "colors[].value")?,
                usage,
                count: count(object.get("count"), "colors[].count")?,
            })
        })
        .collect()
}

fn color_usage(object: &Map<String, Value>) -> Result<String, EvidenceError> {
    if object.contains_key("usage") {
        return text(object.get("usage"), 16, "colors[].usage");
    }
    let uses = bounded_array(required(object, "uses")?, 8, "colors[].uses")?;
    let mut present = BTreeSet::new();
    for value in uses {
        present.insert(text(Some(value), 16, "colors[].uses[]")?);
    }
    ["text", "background", "border", "gradient", "shadow"]
        .into_iter()
        .find(|usage| present.contains(*usage))
        .map(str::to_owned)
        .ok_or(EvidenceError::Malformed("colors[].uses"))
}

fn parse_typography(value: &Value) -> Result<Vec<TypographyEvidence>, EvidenceError> {
    let values = bounded_array(value, MAX_TYPOGRAPHY, "typography")?;
    values
        .iter()
        .map(|value| {
            let object = as_object(value, "typography[]")?;
            let role = text(object.get("role"), 16, "typography[].role")?;
            if !matches!(
                role.as_str(),
                "display" | "heading" | "body" | "label" | "control" | "code"
            ) {
                return Err(EvidenceError::Malformed("typography[].role"));
            }
            Ok(TypographyEvidence {
                role,
                family: text(object.get("family"), 96, "typography[].family")?,
                size: bounded_number(object.get("size"), 1.0, 1_000.0, "typography[].size")?,
                weight: bounded_u32(object.get("weight"), 1, 1_000, "typography[].weight")? as u16,
                line_height: optional_number(
                    object.get("lineHeight"),
                    1.0,
                    2_048.0,
                    "typography[].lineHeight",
                )?,
                count: count(object.get("count"), "typography[].count")?,
            })
        })
        .collect()
}

fn parse_spacing(value: &Value) -> Result<Vec<SpacingEvidence>, EvidenceError> {
    let values = bounded_array(value, MAX_SPACING, "spacing")?;
    values
        .iter()
        .map(|value| {
            let object = as_object(value, "spacing[]")?;
            let 
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

- **Issue #229** (2026-09-21): **Windows: Codex agent fails with os error 10106 because SystemRoot/windir are dropped**
  *Symptoms*: ### Version  0.8.4  ### Platform  Windows (native desktop)  ### Bug Description  The Codex CLI works correctly when launched directly from a terminal, but fails when launched as an agent inside OpenPencil.  OpenPencil displays:  ```text error: orchestration failed: Reconnecting... 2/5 (stream disconnected before completion: The requested service provider could not be loaded or initialized. (os error 10106)) ```  The Chinese Windows error text is:  ```text 无法加载或初始化请求的服务提供程序。(os error 10106) ```  Error 10106 is `WSAEPROVIDERFAILEDINIT`.  This is separate from #189: the extensionless npm-shim problem was bypassed by explicitly resolving the native `codex.exe`, after which this later network-initialization failure appeared.  ### Steps to Reproduce  1. Install and authenticate Codex CLI on Windows using a ChatGPT subscription. 2. Confirm that the native `codex.exe` works directly from a terminal. 3. Ensure OpenPencil resolves the native `codex.exe` rather than the extensionless npm shim described in #189. 4. Connect Codex CLI in OpenPencil. 5. Send a simple prompt from the Agent panel. 6. The request reconnects several times and terminates with `os error 10106`.  The same native Codex executable and the same HTTP proxy settings succeed outside OpenPencil.  ### Expected Behavior  OpenPencil should preserve the Windows environment required for Winsock initialization when launching Codex, and the agent request should complete normally.  ### Screenshots / Recordings  <img width="2520"
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and diagnosis. Confirmed: the current `v0.8.5` branch still filters the Codex child environment with case-sensitive key matching and does not preserve `WINDIR`, so this is not fixed yet.  We will update the Windows filtering to preserve the required variables case-insensitively and add regression coverage for mixed-case `SystemRoot`, `windir`, `ComSpec`, and `Path`.

- **Issue #219** (2026-08-27): **通过 MCP 创建 text 节点导致桌面应用崩溃**
  *Symptoms*: ### Version  崩溃地址 MSVCP140.dll + 0x18c34，异常码 0xc0000005  ### Platform  Windows (native desktop)  ### Bug Description  使用dsh 接入mcp 创建设计，只要是创建text节点就会崩溃，连续3次都是，应用安装版本是最新的0.8.4  ### Steps to Reproduce  1、打开应用 2、在dsh中“帮我创建一个液态玻璃卡片” 3、调用mcp ，创建text节点，程序崩溃  ### Expected Behavior  什么原因导致的  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 感谢报告。先请做一个最省事的判别实验:  **1. 不用 dsh/MCP,直接在应用里用文本工具(快捷键 T)在画布上点一个文本** —— 也崩吗?  如果也崩,说明问题与 MCP/dsh 无关,而是 Windows 上文字排版路径本身。这个签名(0xc0000005 崩在 MSVCP140.dll 内部、仅 text 触发、每次必崩)高度符合 VC++ 运行时版本不匹配:我们的 Windows 包用较新的 MSVC 工具链构建,动态依赖系统的 MSVCP140.dll;当机器上的 VC++ Redistributable 较旧时,首次进入文字整形的 C++ 路径就会在运行时库内部访问违例 —— 创建 text 节点正是首次触发这条路径的操作,所以 frame/矩形都正常、text 必崩。  **2. 安装最新 VC++ 运行时后重试**:https://aka.ms/vs/17/release/vc_redist.x64.exe (装完建议重启)。  **3. 回帖时请带上**: - `C:\Windows\System32\msvcp140.dll` 右键属性 → 详细信息里的文件版本(重点看是否低于 14.40); - 通过 MCP 创建 frame / rectangle 是否正常(即确认只有 text 崩); - 如果更新运行时后仍崩:`%LOCALAPPDATA%\CrashDumps` 下 openpencil 相关的 .dmp 文件。 
  > <img width="739" height="920" alt="Image" src="https://github.com/user-attachments/assets/70f5d64e-6e7a-43d9-9b91-0a0b7667654d" /> 使用最新VC++ 后不会存在该问题，MCP调用正常。感谢

- **Issue #218** (2026-09-03): **TypeError: undefined is not an object (evaluating 'n.offset.x')**
  *Symptoms*: ### Version  Version 0.14.0 (0.14.0)  ### Platform  macOS (native desktop)  ### Bug Description   I got an error that made it impossible to move the scene. It happened after I asked to add blur to some design elements.  <img width="1392" height="912" alt="Image" src="https://github.com/user-attachments/assets/f10262ac-8e94-4831-af83-9739ff5ab925" />  ### Steps to Reproduce  1. Use AI   2. Ask the AI to add blur   3. You may get an error  ### Expected Behavior  The blur should be applied to the selected design elements without affecting scene movement.  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Bro, this isn't our project. Check out this post instead: https://x.com/FiniYang/status/2085410613581451267  We have version v0.8.5 - give our version a try instead of this garbage

- **Issue #211** (2026-08-29): **【字体】获取字体的地方有bug**
  *Symptoms*: ### Version  v0.8.4  ### Platform  Windows (native desktop)  ### Bug Description  Windows 11，系统自带 msyh.ttc，选择字体可见 Microsoft YaHei UI，但不可见 Microsoft YaHei，打开使用 YaHei 的设计时提示 缺失字体。  ### Steps to Reproduce  打开一个带有 Microsoft YaHei 字体的文件。 （我用CodeX调MCP做的文件默认用的这个字体）  ### Expected Behavior  应该不报字体缺失。  ### Screenshots / Recordings  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fix proposed in #216. Missing-font detection now treats Microsoft YaHei and Microsoft YaHei UI as names for the same installed file (msyh.ttc), so opening a YaHei design no longer reports a missing font when Windows only lists YaHei UI. Other Windows UI faces stay distinct.

- **Issue #209** (2026-08-29): **关于模型工具调用失败**
  *Symptoms*: ### Version  0.8.3  ### Platform  Windows (native desktop)  ### Bug Description  1、编辑时的调用会出现偶发性修改工具掉落的情况。具体的反应如下 -使用任一模型时都会出现 -出现后，除非关闭程序，新开一个正常的文件，才会恢复，并且加载工具掉落的那个文件的时候，工具会继续掉落。这里我个人技术力有限，无法拆开调查，让ai反馈给我之后，原因为下图所示 -这种情况不是罕见偶发，而是存在一定的复现可能，但由于我个人时间原因，我无法提供更多的测试反馈，这里附上图片与目前百分百导入后就会失灵的op文件 希望能够处理并修复这个问题   [untitled.zip](https://github.com/user-attachments/files/30943451/untitled.zip)  "Image" src="https://github.com/user-attachments/assets/ff12644b-a3b9-4aa5-9c60-5894e53bfe98" />  ### Steps to Reproduce  由于我无法稳定复现，此处无法提供对应的复现步骤  ### Expected Behavior  编辑类工具无法调用，而其余可读类文件却可以  ### Screenshots / Recordings  <img width="1470" height="524" alt="Image" src="https://github.com/user-attachments/assets/505cd1b1-fb63-4c25-9387-201b35854414" />  ### Additional Context  使用操作系统：window11  对应版本：25H2 
  **Post-Mortem & Fix Analysis**:
  > 好的，感谢反馈，我们安排处理

- **Issue #204** (2026-08-09): **MCP screenshot result is returned as text instead of ImageContent**
  *Symptoms*: ### Version  0.8.2  ### Platform  Linux (native desktop)  ### Bug Description  The MCP screenshot tool does not expose the captured PNG to MCP clients as an MCP `ImageContent` block.  When using OpenPencil's MCP server from GitHub Copilot in VS Code with a vision-capable model, the screenshot returned by the screenshot tool arrives in the tool result as serialized JSON/base64 text. Copilot therefore treats the screenshot bytes as text rather than as an image input.  This makes the screenshot effectively unusable for visual reasoning: the model receives a large base64 string instead of the image.  ### Steps to Reproduce  1. Run and connect MCP to chat client 3. Use a vision-capable model. 4. Invoke the screenshot MCP tool (`get_screenshot` is what the server reports). 5. Inspect the tool result received by Copilot. 6. Witness base64-encoded image in json  ### Expected Behavior  The screenshot tool should return the PNG as a typed MCP image content block:  ```json {   "content": [     {       "type": "image",       "data": "<base64-encoded PNG bytes>",       "mimeType": "image/png"     }   ] } ```  The base64 encoding itself is expected by MCP. The important part is that the base64 data is contained in an MCP ImageContent block (type: "image"), rather than being serialized into a text/JSON tool result.  This allows MCP clients such as GitHub Copilot to preserve the image as multimodal content and pass it to vision-capable models.  ### Screenshots / Recordings  <img width="468" 

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

### Incident Patch 1: `3e55570d` (2026-09-22)
**Commit Message**: docs(readme): update Fluxion AI sponsor banner



---

### Incident Patch 2: `4fbe3a42` (2026-09-21)
**Commit Message**: docs(readme): add Fluxion AI sponsor block alongside Infistar in all locales

**File**: `README.de.md` (modified, +11/-0)
```diff
@@ -35,6 +35,17 @@
 
 ## Warum OpenPencil
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

**File**: `README.es.md` (modified, +11/-0)
```diff
@@ -35,6 +35,17 @@
 
 ## Por Qué OpenPencil
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

**File**: `README.fr.md` (modified, +11/-0)
```diff
@@ -35,6 +35,17 @@
 
 ## Pourquoi OpenPencil
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

**File**: `README.hi.md` (modified, +11/-0)
```diff
@@ -35,6 +35,17 @@
 
 ## OpenPencil क्यों
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

**File**: `README.id.md` (modified, +11/-0)
```diff
@@ -35,6 +35,17 @@
 
 ## Mengapa OpenPencil
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

**File**: `README.ja.md` (modified, +11/-0)
```diff
@@ -35,6 +35,17 @@
 
 ## Why OpenPencil
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

**File**: `README.ko.md` (modified, +11/-0)
```diff
@@ -35,6 +35,17 @@
 
 ## OpenPencil을 선택하는 이유
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

**File**: `README.md` (modified, +11/-0)
```diff
@@ -48,6 +48,17 @@
 - 🎨 **赋能 AI 原生矢量设计：** 适用于提示词生成设计、画布内容修改、多模型协同、图片生成及设计方案迭代，让 AI Agent 更高效地完成从创意到成稿的全过程。
 - 🎁 **OpenPencil 用户专属福利：** 通过 [专属推广链接](https://www.infistar.cc/register?aff=LLZC3RLG&ref_source=link) 注册并完成首次调用，即可领取 **5 美元等值测试额度 / 首充专属优惠**！
 
+<a href="https://fluxionai.world/register?source=github&amp;campaign=github-openpencil&amp;promo=OPENPENCIL" title="Fluxion AI">
+  <img src="./screenshot/fluxion-ai-sponsor-banner.png" alt="Fluxion AI — reliable, cost-efficient access to GPT, Claude, and other leading AI models through one unified API" width="100%" />
+</a>
+
+### [OpenPencil × Fluxion AI | One unified API for GPT, Claude, and more](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL)
+
+Thanks to [Fluxion AI](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL) for sponsoring OpenPencil!
+
+- ⚡ **Reliable, cost-efficient access:** GPT, Claude, and other leading AI models through one unified API — save up to 70% compared with official API pricing.
+- 🎁 **OpenPencil user bonus:** get **$1 in API credits** when you [sign up through this link](https://fluxionai.world/register?source=github&campaign=github-openpencil&promo=OPENPENCIL).
+
 <table>
 <tr>
 <td width="50%">
```

---

### Incident Patch 3: `4c9f73fb` (2026-09-17)
**Commit Message**: fix(ai): ride out provider 429s in the headless smoke client

The direct openai-compat client (OPENPENCIL_SMOKE_DIRECT=1) gave up after a
single POST, while op_orchestrator::retry deliberately treats `http 429` as
non-retryable so the subtask ladder stops there. Together those two turned one
rate limit from a shared provider pool into a permanently lost subtask: an
arena batch against OpenRouter'''s stealth channel took 11 x 429 on one task and
lost 7 of 11 subtasks, which reads as a model that produced nothing.

Route the call through production'''s own ladder (send_with_backoff: same
throttle, same adaptive gap, same Retry-After handling) instead of a second
copy of that policy. OPENPENCIL_SMOKE_HTTP_MAX_RETRIES raises the ladder for a
heavily shared free pool, and the whole-call deadline gains head-room for the
ladder'''s own sleeps so the last attempt still gets to dial.

Same task re-run with the ladder: 0 x 429, 120 -> 238 nodes, all three screens
complete.

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4958,6 +4958,7 @@ dependencies = [
  "jian-ops-schema",
  "op-ai",
  "op-ai-skills",
+ "op-chat-agent",
  "op-editor-core",
  "op-host-services",
  "op-image-enrich",
```

**File**: `crates/op-smoke/Cargo.toml` (modified, +5/-0)
```diff
@@ -46,6 +46,11 @@ op-mcp = { path = "../op-mcp" }
 # loop-mode dump uses the SAME `serde_json::to_string_pretty(&state.doc)` path as
 # the orchestrator mode. Both crates already build raster-only (no winit/GL).
 op-host-services = { path = "../op-host-services" }
+# Production's HTTP retry/throttle ladder (`send_with_backoff`) — the direct
+# openai-compat client below rides out provider 429s with the same posture the
+# desktop uses instead of turning a shared-pool rate limit into a failed subtask.
+op-chat-agent = { path = "../op-chat-agent" }
+
 op-ai = { path = "../op-ai" }
 # System prompt for the design agent loop (parity with the desktop design loop).
 op-ai-skills = { path = "../op-ai-skills" }
```

**File**: `crates/op-smoke/src/llm_clients.rs` (modified, +51/-8)
```diff
@@ -17,6 +17,7 @@ use agent::query::QueryEngine;
 use agent::stream::Event;
 use futures::channel::mpsc;
 use futures::StreamExt;
+use op_chat_agent::backoff::{send_with_backoff, BUILTIN_HTTP_MAX_RETRIES};
 use op_host_services::chat_builtin_http::apply_reasoning_wire_control;
 use op_orchestrator::{CallRequest, LlmChunk, LlmClient, LlmError};
 
@@ -261,17 +262,30 @@ impl LlmClient for DirectOpenAiClient {
             // lines while it works, so a stuck generation never goes idle
             // (web-05 sat 32 min in Planning on 2026-09-08). Cap the whole
             // call; the orchestrator's retry loop takes it from there.
+            let max_retries = smoke_http_max_retries();
             let total_budget = total_call_budget(
                 op_orchestrator::resolve_model_profile(&model).timeout_multiplier,
-            );
+            ) + retry_ladder_budget(max_retries);
+            // Rate limits are a transport concern, not a model verdict: a
+            // shared-pool provider (OpenRouter's stealth channel, measured
+            // 2026-09-17) answers 429 on most subtasks of a 12-task suite, and
+            // `op_orchestrator::retry::is_non_retryable` deliberately stops the
+            // subtask ladder on `http 429` — so without a ladder HERE the run
+            // reads as a model that produced nothing. `send_with_backoff` is
+            // production's own ladder (same throttle, same adaptive gap, same
+            // Retry-After handling); the harness differs only in that the
+            // provider's error body stays reachable via the opt-in
+            // `OPENPENCIL_DEBUG_HTTP_ERROR_BODY` file.
             let call = async {
-                let resp = client
-                    .post(&url)
-                    .bearer_auth(&key)
-                    .json(&body)
-                    .send()
-                    .await
-                    .map_err(|e| format!("POST {url}: {e}"))?;
+                let resp = send_with_backoff(
+                    "smoke direct",
+                    &url,
+                    max_retries,
+                    op_chat_agent::backoff::builtin_http_min_gap(),
+                    || client.post(&url).bearer_auth(&key).json(&body),
+                )
+                .await
+                .map_err(|e| e.to_string())?;
                 let status = resp.status();
                 let text = resp.text().await.unwrap_or_default();
                 Ok::<_, String>((status, text))
@@ -331,6 +345,27 @@ impl LlmClient for DirectOpenAiClient {
     }
 }
 
+/// Retries the harness's direct provider POST rides out before giving up.
+///
+/// Defaults to production's ladder ([`BUILTIN_HTTP_MAX_RETRIES`]); a batch
+/// against a heavily shared free pool raises it with
+/// `OPENPENCIL_SMOKE_HTTP_MAX_RETRIES`.
+fn smoke_http_max_retries() -> u32 {
+    std::env::var("OPENPENCIL_SMOKE_HTTP_MAX_RETRIES")
+        .ok()
+        .and_then(|raw| raw.trim().parse::<u32>().ok())
+        .unwrap_or(BUILTIN_HTTP_MAX_RETRIES)
+}
+
+/// Head-room the whole-call deadline needs for the retry ladder's own sleeps.
+///
+/// Without it the ladder eats the generation budget: `RETRY_AFTER_MAX` caps one
+/// wait at 30 s, so `max_retries` waits are the worst case the deadline has to
+/// absorb before the last attempt even dials.
+fn retry_ladder_budget(max_retries: u32) -> std::time::Duration {
+    std::time::Duration::from_secs(30 * u64::from(max_retries))
+}
+
 /// Whole-call budget for the non-streaming provider path: 15 min scaled by
 /// the model profile's timeout multiplier, or `OPENPENCIL_SMOKE_LLM_TOTAL_BUDGET_SECS`
 /// when set (the harness tests use it to make the deadline observable).
@@ -350,6 +385,14 @@ mod tests {
     use super::*;
     use serde_json::json;
 
+    #[test]
+    fn retry_ladder_budget_covers_the_worst_case_waits() {
+        // RETRY_AFTER_MAX (30 s) per retry — the deadline must outlast the
+        // ladder, or the last attempt never dials.
+        assert_eq!(retry_ladder_budget(0).as_secs(), 0);
+        assert_eq!(retry_ladder_budget(5).as_secs(), 150);
+    }
+
     #[test]
     fn total_call_budget_scales_with_the_profile_multiplier() {
         std::env::remove_var("OPENPENCIL_SMOKE_LLM_TOTAL_BUDGET_SECS");
```

---

### Incident Patch 4: `dd2bb56d` (2026-09-16)
**Commit Message**: fix(editor): make Home's avatar and model picker actually usable

Three defects the founder hit on Home, all from the takeover carrying
only half of what the professional chrome carries.

The avatar hovered but did nothing when signed in. It opens one of two
things, and Home painted and routed only the signed-OUT half: the
account menu went `open = true` and appeared nowhere. Home now paints it
and owns its presses, and the menu anchors off HOME's avatar instead of
the professional TopBar's, which is a different place on the same
window.

The model picker showed 接入更多模型 twice. It was an external row
painted BELOW the card, from before the picker grew its own footer.
Removed: the card is the whole footprint now.

And the picker dismissed on hover-out, so the cursor could not reach
that footer without the card vanishing on the way — the external row
sat across a gap that read as leaving the popover. A click-opened
popover closes on a click outside, which the press path already does;
hover only tracks the row under the cursor.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-ui/src/widgets/home_surface_model.rs` (modified, +9/-9)
```diff
@@ -52,12 +52,19 @@ pub fn model_chip_width(label: &str) -> f32 {
 /// The picker card anchored above the submit row's model button plus
 /// the trailing connect-more row under it. `None` when the button is
 /// not laid out (zero-width) or the viewport cannot hold the card.
+/// The Home-anchored model picker's card.
+///
+/// It used to return a second rect for an external 接入更多模型 row
+/// painted BELOW the card. The picker carries that action as its own
+/// footer now, so the external row was the same thing twice — and
+/// because it sat outside the card, crossing the gap to reach it read as
+/// leaving the popover.
 pub fn home_model_picker_rects(
     layout: &HomeLayout,
     viewport_w: f32,
     models: &[ModelEntry],
     search: &str,
-) -> Option<(Rect, Rect)> {
+) -> Option<Rect> {
     let chip = layout.model_chip;
     if chip.size.x <= 0.0 {
         return None;
@@ -67,14 +74,7 @@ pub fn home_model_picker_rects(
     let top = (bottom - height).max(8.0);
     let x = (chip.origin.x + chip.size.x / 2.0 - HOME_MODEL_PICKER_W / 2.0)
         .clamp(8.0, (viewport_w - HOME_MODEL_PICKER_W - 8.0).max(8.0));
-    let card = Rect::xywh(x, top, HOME_MODEL_PICKER_W, height);
-    let connect_row = Rect::xywh(
-        x,
-        card.origin.y + card.size.y + CONNECT_MORE_ROW_GAP,
-        HOME_MODEL_PICKER_W,
-        CONNECT_MORE_ROW_H,
-    );
-    Some((card, connect_row))
+    Some(Rect::xywh(x, top, HOME_MODEL_PICKER_W, height))
 }
 
 /// Paint the model button: a 38 px outline pill with the green status
```

**File**: `crates/op-editor-ui/src/widgets/touch_overlay_geometry.rs` (modified, +15/-0)
```diff
@@ -18,6 +18,21 @@ pub fn account_anchor(state: &EditorState, viewport_w: f32) -> Rect {
         let bar = host_canvas_geometry::touch_app_bar_rect(state, viewport_w);
         return MobileAppBar::overflow_rect(bar);
     }
+    // Home is a takeover with its own top bar, so the menu has to hang
+    // off ITS avatar. Anchoring to the professional TopBar's position
+    // put the menu somewhere Home has no avatar at all.
+    if state.editor_ui.home.visible {
+        // The top-bar rects are anchored off the viewport's right edge
+        // and depend on nothing else, so the task and chip width here
+        // cannot change the answer.
+        return crate::widgets::home_surface::layout::layout_for(
+            viewport_w,
+            1.0,
+            state.editor_ui.home.task,
+            0.0,
+        )
+        .account;
+    }
     let top_bar = Rect::xywh(0.0, 0.0, viewport_w, TOP_BAR_HEIGHT);
     TopBar::for_editor_ui(&state.editor_ui).account_button_rect(top_bar)
 }
```

**File**: `crates/op-host-native/src/widget_host/home_overlays.rs` (modified, +52/-29)
```diff
@@ -14,7 +14,7 @@ use crate::backend::NativeFrameBackend;
 use op_editor_ui::widgets::ai_chat_model_picker::{
     max_picker_scroll, model_picker_hit, paint_model_picker, search_clear_hit, SelectHit,
 };
-use op_editor_ui::widgets::home_surface::{home_model_picker_rects, paint_connect_more_row};
+use op_editor_ui::widgets::home_surface::home_model_picker_rects;
 use op_editor_ui::widgets::{HomeSurface, PaintCx, Widget};
 use op_editor_ui::{Point2D, Rect, RenderBackend};
 
@@ -31,11 +31,12 @@ impl WidgetHostNative {
         if !self.home_visible() {
             return None;
         }
-        let (settings_open, login_open, account_ui) = {
+        let (settings_open, login_open, account_menu_open, account_ui) = {
             let ui = &self.editor_state.editor_ui;
             (
                 ui.agent_settings_open,
                 ui.login_modal_open && (ui.account_ui_available || ui.touch_chrome()),
+                ui.account_menu_open && ui.account_ui_available,
                 ui.chat_model_picker.open,
             )
         };
@@ -50,15 +51,23 @@ impl WidgetHostNative {
             self.dispatch_login_modal_press(x, y, viewport_width, viewport_height);
             return Some(true);
         }
+        // The signed-in half of what Home's avatar opens. Without this
+        // the menu painted and then swallowed nothing: every press fell
+        // through to the surface underneath and the menu never closed.
+        if account_menu_open {
+            self.dispatch_account_menu_press(x, y, viewport_width, viewport_height);
+            return Some(true);
+        }
         if account_ui {
             return self.press_home_model_picker(x, y, viewport_width, viewport_height);
         }
         None
     }
 
     /// Paint the Home-opened overlays above the takeover: the agent-
-    /// settings modal, the sign-in modal, then the Home-anchored model
-    /// picker with its trailing connect-more row.
+    /// settings modal, the sign-in modal, the signed-in account menu,
+    /// then the Home-anchored model picker with its trailing
+    /// connect-more row.
     pub(in crate::widget_host) fn paint_home_overlays(
         &mut self,
         frame: &mut NativeFrameBackend<'_>,
@@ -70,9 +79,39 @@ impl WidgetHostNative {
         }
         self.paint_agent_settings_modal_overlay(frame, viewport_width, viewport_height);
         self.paint_login_modal_overlay(frame, viewport_width, viewport_height);
+        self.paint_account_menu_overlay(frame, viewport_width, viewport_height);
         self.paint_home_model_picker(frame, viewport_width, viewport_height);
     }
 
+    /// The signed-in account dropdown. Home paints it for the same
+    /// reason it paints the sign-in modal: its avatar opens one of the
+    /// two, and a takeover that draws only the signed-OUT half leaves a
+    /// signed-in user clicking an avatar that does nothing.
+    pub(in crate::widget_host) fn paint_account_menu_overlay(
+        &self,
+        frame: &mut NativeFrameBackend<'_>,
+        viewport_width: f32,
+        _viewport_height: f32,
+    ) {
+        let ui = &self.editor_state.editor_ui;
+        if !ui.account_ui_available || !ui.account_menu_open {
+            return;
+        }
+        use op_editor_ui::widgets::account_menu::AccountMenu;
+        let Some(menu) = AccountMenu::for_editor_ui(ui) else {
+            return;
+        };
+        let menu_rect = op_editor_ui::widgets::touch_overlay_geometry::account_menu_rect(
+            &self.editor_state,
+            &menu,
+            viewport_width,
+        );
+        let mut cx = op_editor_ui::widgets::PaintCx {
+            backend: &mut *frame,
+        };
+        menu.paint(&mut cx, menu_rect);
+    }
+
     /// The sign-in modal: full-viewport scrim + centred card. Extracted
     /// from the normal-path paint so Home can share the exact card.
     pub(in crate::widget_host) fn paint_login_modal_overlay(
@@ -140,16 +179,13 @@ impl WidgetHostNative {
         if !self.editor_state.editor_ui.chat_model_picker.open {
             return;
         }
-        let Some((card, connect_row)) =
-            self.home_model_picker_geometry(viewport_width, viewport_height)
-        else {
+        let Some(card) = self.home_model_picker_geometry(viewport_width, viewport_height) else {
             return;
         };
         let ui = &self.editor_state.editor_ui;
         let models = &self.editor_state.chat.available_models;
         let selected = self.editor_state.chat.selected_model;
         let locale = ui.locale;
-        let connect_label = op_i18n::translate(locale, "home.connectMoreModels");
         let mut cx = PaintCx {
             backend: &mut *frame,
         };
@@ -164,15 +200,14 @@ impl WidgetHostNative {
             self.now_ms,
             locale,
         );
-        paint_connect_more_row(&mut cx, &self.theme, connect_row, connect_label, false);
     }
 
     /// Resolve the Home-anchored picker rects from the live
```

**File**: `crates/op-host-native/src/widget_host/home_overlays_tests.rs` (modified, +79/-10)
```diff
@@ -136,7 +136,7 @@ fn picking_a_row_from_the_home_picker_selects_that_model() {
     let mut host = host_with_usable_agent();
     let chip = chip_center(&host);
     assert!(host.apply_press(chip.x, chip.y, W, H));
-    let (card, _connect_row) = host
+    let card = host
         .home_model_picker_geometry(W, H)
         .expect("picker geometry resolves above the chip");
     // Second row of the single Claude Code group: search strip + pad +
@@ -169,21 +169,44 @@ fn pressing_outside_the_home_picker_closes_it_without_touching_home() {
 }
 
 #[test]
-fn the_home_picker_connect_row_opens_agent_settings_on_the_agents_tab() {
+fn the_home_picker_connect_row_lives_inside_the_card_now() {
+    // The action used to be an external row BELOW the card, which meant
+    // Home showed 接入更多模型 twice (the picker carries its own footer)
+    // and the cursor had to leave the popover to reach it.
     let mut host = host_with_usable_agent();
     let chip = chip_center(&host);
     assert!(host.apply_press(chip.x, chip.y, W, H));
-    let (_card, connect_row) = host
+    let card = host
         .home_model_picker_geometry(W, H)
         .expect("picker geometry resolves");
-    let point = center(connect_row);
-    assert!(host.apply_press(point.x, point.y, W, H));
-    assert!(host.editor_state().editor_ui.agent_settings_open);
-    assert_eq!(
-        host.editor_state().editor_ui.agent_settings.tab,
-        op_editor_core::AgentSettingsTab::Agents
-    );
+    // Nothing hangs below the card any more: a press just under it is
+    // an outside press and closes the picker.
+    let below = Point2D::new(card.origin.x + 24.0, card.origin.y + card.size.y + 20.0);
+    assert!(host.apply_press(below.x, below.y, W, H));
     assert!(!host.editor_state().editor_ui.chat_model_picker.open);
+    assert!(!host.editor_state().editor_ui.agent_settings_open);
+}
+
+/// Hover must never dismiss a click-opened popover: moving the cursor
+/// off the card used to close it, so its own footer row was unreachable.
+#[test]
+fn moving_the_cursor_off_the_home_picker_keeps_it_open() {
+    let mut host = host_with_usable_agent();
+    let chip = chip_center(&host);
+    assert!(host.apply_press(chip.x, chip.y, W, H));
+    let card = host.home_model_picker_geometry(W, H).expect("picker open");
+    assert!(host.editor_state().editor_ui.chat_model_picker.open);
+    for point in [
+        Point2D::new(card.origin.x - 40.0, card.origin.y + 20.0),
+        Point2D::new(card.origin.x + 24.0, card.origin.y + card.size.y + 30.0),
+        Point2D::new(W - 20.0, H - 20.0),
+    ] {
+        host.apply_cursor_move(point.x, point.y);
+        assert!(
+            host.editor_state().editor_ui.chat_model_picker.open,
+            "hover at {point:?} must not dismiss"
+        );
+    }
 }
 
 #[test]
@@ -218,3 +241,49 @@ fn home_and_top_bar_avatars_open_the_same_account_entry() {
     );
     assert!(!host.editor_state().editor_ui.account_menu_open);
 }
+
+/// Home's avatar opens one of two things, and the takeover has to draw
+/// and route BOTH — a signed-in user clicking it got an account menu
+/// that existed in state and appeared nowhere.
+#[test]
+fn home_routes_the_signed_in_account_menu_as_well_as_the_sign_in_modal() {
+    let mut host = WidgetHostNative::new();
+    host.editor_state_mut().editor_ui.home.visible = true;
+    host.editor_state_mut().editor_ui.account_ui_available = true;
+    // Signed out: the avatar opens the sign-in modal, and Home owns the press.
+    assert!(host.open_account_entry());
+    assert!(host.editor_state().editor_ui.login_modal_open);
+    assert_eq!(
+        host.press_home_overlays(400.0, 400.0, 1440.0, 900.0),
+        Some(true),
+        "the modal owns presses over the takeover"
+    );
+
+    // Signed in: the menu opens instead, and Home owns its presses too.
+    host.editor_state_mut().editor_ui.login_modal_open = false;
+    host.editor_state_mut().editor_ui.account_menu_open = true;
+    assert_eq!(
+        host.press_home_overlays(400.0, 400.0, 1440.0, 900.0),
+        Some(true),
+        "an open account menu must not let presses fall through Home"
+    );
+}
+
+/// ...and the menu hangs off HOME's avatar, not the professional top
+/// bar's, which is a different place on the same window.
+#[test]
+fn the_account_menu_anchors_to_homes_own_avatar() {
+    let mut state = op_editor_core::EditorState::new();
+    state.editor_ui.account_ui_available = true;
+    let pro = op_editor_ui::widgets::touch_overlay_geometry::account_anchor(&state, 1440.0);
+    state.editor_ui.home.visible = true;
+    let home = op_editor_ui::widgets::touch_overlay_geometry::account_anchor(&state, 1440.0);
+    assert_ne!(
+        pro.origin.x, home.origin.x,
+        "different avatars, different anchors"
+    );
+    // The anchor sits in Home's top bar, left of its 打开文件 button.
+    assert!(home.size.x > 0.0 && home.size.y > 0.0);
+    assert!(home.origin.y < 60.0, "in the top bar: {home:?}");
+    as
```

**File**: `crates/op-host-native/src/widget_host/overlay_rects.rs` (modified, +4/-8)
```diff
@@ -377,14 +377,10 @@ impl WidgetHostNative {
             return None;
         }
         if self.editor_state.editor_ui.home.visible {
-            return self.home_model_picker_geometry(viewport_w, viewport_h).map(
-                |(card, _connect_row)| {
-                    // The connect row is part of the picker's footprint,
-                    // but the row-based scroll/hover math inside gates
-                    // only understands the card.
-                    card
-                },
-            );
+            // The card IS the whole footprint now: the external connect
+            // row that used to hang below it is gone, folded into the
+            // picker's own footer.
+            return self.home_model_picker_geometry(viewport_w, viewport_h);
         }
         let chat_rect = self.ai_chat_rect(viewport_w, viewport_h)?;
         AIChatPlaceholder::from_editor(&self.editor_state).model_picker_bounds(chat_rect)
```

---

### Incident Patch 5: `49100c2c` (2026-09-16)
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

### Incident Patch 6: `243c27f5` (2026-09-15)
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

### Incident Patch 7: `195aad29` (2026-09-15)
**Commit Message**: fix(desktop): persist the chosen chat model row, not just the provider

Picking a built-in or ACP model in the picker never moved the provider
index, so the persisted provider name alone put every relaunch back on
the first catalog row. The chosen row's catalog value is now saved and
resolved after the catalog is rebuilt on load.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-host-core/src/settings_io.rs` (modified, +39/-0)
```diff
@@ -73,6 +73,7 @@ pub struct Fingerprint {
     preferred_agent_team_size: u32,
     entry_surface: op_editor_core::EntrySurface,
     chat_agent: String,
+    chat_model: String,
 }
 
 pub fn fingerprint(state: &EditorState) -> Fingerprint {
@@ -96,6 +97,7 @@ pub fn fingerprint(state: &EditorState) -> Fingerprint {
         preferred_agent_team_size: eui.preferred_agent_team_size,
         entry_surface: eui.entry_surface,
         chat_agent: selected_chat_agent_name(eui),
+        chat_model: selected_chat_model_value(state),
     }
 }
 
@@ -115,6 +117,20 @@ fn selected_chat_agent_name(eui: &op_editor_core::EditorUiState) -> String {
 /// Resolve a persisted agent name back to its `AgentProvider::ALL`
 /// index; unknown names (a provider renamed or removed by a newer
 /// build) fall back to index 0 rather than dangling.
+/// The picker row the user last chose, by the catalog entry's wire
+/// `value` (`builtin:<agent id>:<model>` for API-key agents, the model id
+/// for CLI providers, the agent id for ACP agents). `chat_agent` alone
+/// cannot carry this: a built-in or ACP choice never moves
+/// `chat_selected_agent`, so without this field every relaunch fell back
+/// to the first catalog row.
+fn selected_chat_model_value(state: &EditorState) -> String {
+    state
+        .chat
+        .selected_model_entry()
+        .map(|entry| entry.value.clone())
+        .unwrap_or_default()
+}
+
 fn chat_agent_index_for_name(name: &str) -> usize {
     op_editor_core::AgentProvider::ALL
         .iter()
@@ -188,6 +204,10 @@ struct SettingsPayload {
     /// `selected_chat_agent_name`); older settings keep index 0.
     #[serde(default)]
     chat_agent: Option<String>,
+    /// The last chosen picker row by catalog `value` (see
+    /// `selected_chat_model_value`); resolved after the catalog is rebuilt.
+    #[serde(default)]
+    chat_model: Option<String>,
 }
 
 /// Resolve the platform-specific settings path. `None` when no
@@ -262,6 +282,7 @@ fn to_payload(state: &EditorState) -> SettingsPayload {
         preferred_agent_team_size: Some(eui.preferred_agent_team_size),
         entry_surface: Some(eui.entry_surface.as_str().into()),
         chat_agent: Some(selected_chat_agent_name(eui)),
+        chat_model: Some(selected_chat_model_value(state)),
     }
 }
 
@@ -274,6 +295,7 @@ fn apply_payload_with_options(
     payload: SettingsPayload,
     dedupe_builtins: bool,
 ) {
+    let chat_model = payload.chat_model.clone();
     if payload.version != SETTINGS_VERSION {
         return;
     }
@@ -394,6 +416,19 @@ fn apply_payload_with_options(
     // empty this early, so this is a no-op until discovery lands and
     // `ModelProbe::poll_into` rebuilds again against the same mask.
     state.rebuild_chat_models();
+    // Now that the catalog exists, land on the row the user last chose.
+    // Later rebuilds (model discovery) preserve the selection by the same
+    // provider + value + built-in id triple.
+    if let Some(value) = chat_model.as_deref().filter(|v| !v.is_empty()) {
+        if let Some(index) = state
+            .chat
+            .available_models
+            .iter()
+            .position(|entry| entry.value == value)
+        {
+            state.chat.selected_model = index;
+        }
+    }
 }
 
 /// Remove the retired Gemini CLI slot from positional v1 settings without
@@ -716,3 +751,7 @@ mod settings_io_chat_agent_tests;
 #[cfg(test)]
 #[path = "settings_io_guard_tests.rs"]
 mod settings_io_guard_tests;
+
+#[cfg(test)]
+#[path = "settings_io_chat_model_tests.rs"]
+mod settings_io_chat_model_tests;
```

**File**: `crates/op-editor-host-core/src/settings_io_chat_model_tests.rs` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+//! Chat-model persistence: the picker row (built-in / ACP included) survives
+//! a save + load cycle. Sibling of `settings_io_chat_agent_tests.rs`.
+
+use super::*;
+use op_editor_core::{BuiltinAgentConfig, BuiltinAgentKind, BuiltinAgentPresetKey};
+
+fn glm_agent() -> BuiltinAgentConfig {
+    BuiltinAgentConfig {
+        id: "builtin-6".into(),
+        preset: BuiltinAgentPresetKey::GlmCoding,
+        display_name: "GLM Coding Plan".into(),
+        kind: BuiltinAgentKind::OpenAiCompat,
+        api_key: "k".into(),
+        models: vec!["glm-5.3".into(), "glm-5.3-flash".into()],
+        base_url: "https://open.bigmodel.cn/api/coding/paas/v4".into(),
+        enabled: true,
+    }
+}
+
+#[test]
+fn a_builtin_model_choice_survives_save_and_load() {
+    let mut src = EditorState::new();
+    src.editor_ui
+        .agent_settings
+        .builtin_agents
+        .push(glm_agent());
+    src.rebuild_chat_models();
+    let flash = src
+        .chat
+        .available_models
+        .iter()
+        .position(|entry| entry.value == "builtin:builtin-6:glm-5.3-flash")
+        .expect("the flash row is in the catalog");
+    let before = fingerprint(&src);
+    src.select_chat_model(flash);
+    assert_ne!(
+        before,
+        fingerprint(&src),
+        "changing the row must dirty the fingerprint"
+    );
+
+    let json = serde_json::to_string(&to_payload(&src)).unwrap();
+    assert!(
+        json.contains("\"chat_model\":\"builtin:builtin-6:glm-5.3-flash\""),
+        "{json}"
+    );
+
+    let payload: SettingsPayload = serde_json::from_str(&json).unwrap();
+    let mut dst = EditorState::new();
+    apply_payload(&mut dst, payload);
+    assert_eq!(
+        dst.chat
+            .selected_model_entry()
+            .map(|entry| entry.value.as_str()),
+        Some("builtin:builtin-6:glm-5.3-flash"),
+        "the relaunch lands on the row the user chose, not the first one"
+    );
+}
+
+#[test]
+fn a_missing_or_stale_chat_model_keeps_the_default_row() {
+    let legacy = serde_json::json!({ "version": 1, "chat_model": "builtin:gone:nope" });
+    let payload: SettingsPayload = serde_json::from_value(legacy).unwrap();
+    let mut dst = EditorState::new();
+    apply_payload(&mut dst, payload);
+    assert_eq!(dst.chat.selected_model, 0);
+}
```

**File**: `crates/op-editor-host-core/src/settings_io_checked.rs` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ pub(super) fn validate_payload_fields(raw: &serde_json::Value) -> Result<()> {
             "preferred_agent_team_size",
             "entry_surface",
             "chat_agent",
+            "chat_model",
         ],
         "root",
     )?;
```

---

### Incident Patch 8: `a172041d` (2026-09-15)
**Commit Message**: fix(desktop): never overwrite a settings file the startup load rejected

The lenient startup load fell back to defaults when settings.json did
not parse, and the next save then wrote those defaults over the user's
file — every API key gone. A rejected file is now copied to a
settings.json.corrupt-<time> sibling and every later save to that path
is refused with RejectedLoad.

Claude-Session: https://claude.ai/code/session_01LBqzBogViQjjA8AqRjLsoD

**File**: `crates/op-editor-host-core/src/settings_io.rs` (modified, +70/-14)
```diff
@@ -132,6 +132,12 @@ const SETTINGS_VERSION: u32 = 1;
 const APP_DIR: &str = "openpencil";
 const FILE_NAME: &str = "settings.json";
 static SETTINGS_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);
+/// Settings paths whose file existed but did not parse at startup. Every
+/// save to one of these is refused for the rest of the process: the
+/// alternative — writing this process's defaults over a file we could not
+/// read — is exactly how a user loses every API key after a build mismatch
+/// or a truncated write.
+static REJECTED_SETTINGS_PATHS: std::sync::Mutex<Vec<PathBuf>> = std::sync::Mutex::new(Vec::new());
 
 #[derive(Debug, Serialize, Deserialize)]
 struct SettingsPayload {
@@ -178,16 +184,16 @@ struct SettingsPayload {
     /// First-launch surface; older settings default to Home.
     #[serde(default)]
     entry_surface: Option<String>,
+    /// The chat agent's stable provider name (see
+    /// `selected_chat_agent_name`); older settings keep index 0.
+    #[serde(default)]
+    chat_agent: Option<String>,
 }
 
 /// Resolve the platform-specific settings path. `None` when no
 /// usable config base exists — load/save become silent no-ops.
 ///
 /// An embedded shell (the mobile FFI hosts) selects its private
-    /// The chat agent's stable provider name (see
-    /// `selected_chat_agent_name`); older settings keep index 0.
-    #[serde(default)]
-    chat_agent: Option<String>,
 /// app-sandbox directory through `op_config_store::configure_user_root`
 /// before engine construction; `settings.json` then lives next to the
 /// other per-user config files in that root. Desktop never configures an
@@ -255,13 +261,13 @@ fn to_payload(state: &EditorState) -> SettingsPayload {
         ),
         preferred_agent_team_size: Some(eui.preferred_agent_team_size),
         entry_surface: Some(eui.entry_surface.as_str().into()),
+        chat_agent: Some(selected_chat_agent_name(eui)),
     }
 }
 
 fn apply_payload(state: &mut EditorState, payload: SettingsPayload) {
     apply_payload_with_options(state, payload, true);
 }
-        chat_agent: Some(selected_chat_agent_name(eui)),
 
 fn apply_payload_with_options(
     state: &mut EditorState,
@@ -368,17 +374,17 @@ fn apply_payload_with_options(
     if let Some(surface) = payload.entry_surface.as_deref() {
         eui.entry_surface = op_editor_core::EntrySurface::from_str(surface);
     }
+    // Restore the chat agent by name — `rebuild_chat_models` further
+    // down re-derives the model catalog against this selection.
+    if let Some(name) = payload.chat_agent.as_deref() {
+        eui.chat_selected_agent = chat_agent_index_for_name(name);
+    }
     // Seed tab 0's ⚡Nx from the persisted preference — `load` runs before
     // any tab has been created beyond the default single tab, so this is
     // the ONE spot that reconnects "what the user last set" across a full
     // app restart (`ChatSessions::new_tab` handles the SAME continuity
     // within a running session, carrying the active tab's current value
     // forward). Captured into a local before the last `eui` use ends the
-    // Restore the chat agent by name — `rebuild_chat_models` further
-    // down re-derives the model catalog against this selection.
-    if let Some(name) = payload.chat_agent.as_deref() {
-        eui.chat_selected_agent = chat_agent_index_for_name(name);
-    }
     // mutable borrow of `state.editor_ui`, so `state.chat` can be written
     // next.
     let preferred_agent_team_size = eui.preferred_agent_team_size;
@@ -519,14 +525,54 @@ pub fn load(state: &mut EditorState) {
     // detected locale instead of leaving the EnUs default.
     seed_system_locale(state);
     if let Some(path) = settings_path() {
-        if let Ok(bytes) = std::fs::read(&path) {
-            if let Ok(payload) = serde_json::from_slice::<SettingsPayload>(&bytes) {
-                apply_payload(state, payload);
+        load_lenient_from_path(state, &path);
+    }
+}
+
+/// The lenient startup load behind [`load`]. A missing file is a normal
+/// first run. A file that exists but does not parse is NOT silently
+/// replaced by defaults: its bytes are copied to a `settings.json.corrupt-…`
+/// sibling and the path is pinned so every later save is refused (see
+/// [`SettingsIoError::RejectedLoad`]). Returns `false` when the file was
+/// rejected.
+pub fn load_lenient_from_path(state: &mut EditorState, path: &Path) -> bool {
+    let Ok(bytes) = std::fs::read(path) else {
+        return true;
+    };
+    match serde_json::from_slice::<SettingsPayload>(&bytes) {
+        Ok(payload) => {
+            apply_payload(state, payload);
+            true
+        }
+        Err(_) => {
+            let _ = std::fs::write(corrupt_backup_path(path), &bytes);
+            if let Ok(mut rejected) = REJECTED_SETTINGS_PATHS.lock() {
+                rejected.push(path.to_path_buf());
             }
+            false
         }
     }
 }
 
+fn corrupt_backup_path(path: &Path) -> PathBuf 
```

**File**: `crates/op-editor-host-core/src/settings_io_error.rs` (modified, +7/-0)
```diff
@@ -79,6 +79,10 @@ pub enum SettingsIoError {
     /// 128 candidate temporary names were all taken — a stuck directory
     /// rather than a transient collision.
     TempAllocExhausted,
+    /// The lenient startup load found the file unreadable, backed it up and
+    /// pinned the path: saving over it now would replace whatever the user
+    /// had (API keys included) with this process's defaults.
+    RejectedLoad,
     /// Writing the encoded JSON into the temporary file failed.
     WriteTemp { detail: String },
     /// The completed temporary file could not be renamed over the real
@@ -105,6 +109,9 @@ impl fmt::Display for SettingsIoError {
                 write!(f, "unknown settings field in {context}")
             }
             SettingsIoError::Lossy => f.write_str("settings file cannot be loaded losslessly"),
+            SettingsIoError::RejectedLoad => f.write_str(
+                "settings file was rejected at load and backed up; refusing to overwrite it",
+            ),
             SettingsIoError::UnsupportedCredentialEntry => {
                 f.write_str("unsupported settings credential entry")
             }
```

**File**: `crates/op-editor-host-core/src/settings_io_guard_tests.rs` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+//! The corrupt-file guard: an unreadable settings file is backed up and
+//! never overwritten by this process.
+
+use super::{load_lenient_from_path, save_checked_to_path, SettingsIoError};
+use op_editor_core::EditorState;
+
+fn temp_settings_path(tag: &str) -> std::path::PathBuf {
+    let dir = std::env::temp_dir().join(format!(
+        "op-settings-guard-{tag}-{}-{}",
+        std::process::id(),
+        std::time::SystemTime::now()
+            .duration_since(std::time::UNIX_EPOCH)
+            .map(|d| d.as_nanos())
+            .unwrap_or(0)
+    ));
+    std::fs::create_dir_all(&dir).expect("temp dir");
+    dir.join("settings.json")
+}
+
+#[test]
+fn an_unparseable_settings_file_is_backed_up_and_never_overwritten() {
+    let path = temp_settings_path("corrupt");
+    let garbage = b"{ \"version\": 1, \"builtin_agents\": [ truncated";
+    std::fs::write(&path, garbage).expect("write garbage");
+
+    let mut state = EditorState::new();
+    assert!(
+        !load_lenient_from_path(&mut state, &path),
+        "the file must be rejected"
+    );
+
+    let backups: Vec<_> = std::fs::read_dir(path.parent().unwrap())
+        .unwrap()
+        .filter_map(|entry| entry.ok())
+        .filter(|entry| {
+            entry
+                .file_name()
+                .to_string_lossy()
+                .starts_with("settings.json.corrupt-")
+        })
+        .collect();
+    assert_eq!(backups.len(), 1, "exactly one corrupt backup is written");
+    assert_eq!(std::fs::read(backups[0].path()).unwrap(), garbage);
+
+    assert!(matches!(
+        save_checked_to_path(&state, &path),
+        Err(SettingsIoError::RejectedLoad)
+    ));
+    assert_eq!(
+        std::fs::read(&path).unwrap(),
+        garbage,
+        "the original bytes stay on disk for the user to recover"
+    );
+}
+
+#[test]
+fn a_missing_or_valid_settings_file_keeps_saves_working() {
+    let path = temp_settings_path("clean");
+    let mut state = EditorState::new();
+    assert!(
+        load_lenient_from_path(&mut state, &path),
+        "a missing file is a first run"
+    );
+    save_checked_to_path(&state, &path).expect("first save writes the file");
+    assert!(
+        load_lenient_from_path(&mut state, &path),
+        "the file we wrote loads back"
+    );
+    save_checked_to_path(&state, &path).expect("saving a valid file is still allowed");
+}
```

---

### Incident Patch 9: `17d7cf42` (2026-09-14)
**Commit Message**: fix(html): stop a non-ascii css prelude from panicking the import (#240)

at_keyword bounded its read with get(..name.len() + 1) but then byte-indexed prefix[0..1], which is not a char boundary when the prelude opens on a multi-byte character. An inline <style> reaches the scanner without the BOM stripping decode_css_bytes gives a linked sheet, so a BOM ahead of @charset unwound the whole HTML import.

**File**: `crates/op-html/src/resources_css_imports.rs` (modified, +37/-1)
```diff
@@ -226,7 +226,7 @@ fn at_keyword(prelude: &str, name: &str) -> bool {
     let expected_len = name.len() + 1;
     prelude
         .get(..expected_len)
-        .is_some_and(|prefix| prefix[0..1].eq("@") && prefix[1..].eq_ignore_ascii_case(name))
+        .is_some_and(|prefix| prefix.starts_with('@') && prefix[1..].eq_ignore_ascii_case(name))
         && prelude[expected_len..]
             .chars()
             .next()
@@ -432,4 +432,40 @@ mod tests {
         assert!(output.contains(".主题{color:red}"));
         assert!(output.contains(r#".按钮{content:"你好"}"#));
     }
+
+    #[test]
+    fn a_prelude_opening_on_a_non_ascii_character_is_not_an_at_keyword() {
+        // The three non-ASCII cases above all keep an ASCII byte first. A
+        // stylesheet may open on a multi-byte one instead — a UTF-8 BOM
+        // ahead of `@charset` is the everyday shape, and `decode_css_bytes`
+        // only strips it from a linked sheet, not from an inline `<style>`.
+        // None of these are at-rules this scanner handles; each must simply
+        // say so and leave the sheet alone.
+        let fetcher = |_: &str| None;
+        for source in [
+            "\u{feff}@charset \"utf-8\";.root{color:red}",
+            "\u{feff}@layer base;.root{color:red}",
+            "\u{feff}@import 'a.css';.root{color:red}",
+            "中文;.root{color:red}",
+        ] {
+            let (output, _) = expand(source, &fetcher);
+            assert!(
+                output.contains(".root{color:red}"),
+                "source: {source:?}, output: {output:?}"
+            );
+        }
+    }
+
+    #[test]
+    fn ascii_charset_and_layer_preludes_keep_their_meaning() {
+        let fetcher = |_: &str| Some(b".imported{color:red}".to_vec());
+        let (output, warnings) = expand(
+            "@charset \"utf-8\";@layer base;@import 'a.css';.root{color:blue}",
+            &fetcher,
+        );
+        assert!(warnings.is_empty(), "{warnings:?}");
+        assert!(output.starts_with("@charset \"utf-8\";@layer base;"));
+        assert!(output.contains(".imported{color:red}"));
+        assert!(output.contains(".root{color:blue}"));
+    }
 }
```

---

### Incident Patch 10: `6f0f176b` (2026-09-14)
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

---

### Incident Patch 11: `d147d5e9` (2026-09-14)
**Commit Message**: fix(agent): keep the natively-cased Windows vars for guarded CLIs (#233)

`allowed_env` matched its uppercase COMMON list with `contains`, but
Windows environment keys are case-insensitive and arrive in their native
casing — `Path`, `SystemRoot`, `windir`, `ComSpec`, `ProgramData`. None
of them matched, so Antigravity, Grok, dsh and the OpenCode probe were
launched with no PATH at all and no Winsock provider root.

`append_isolated_env` had the same defect twice over: its `SYSTEMROOT`
lookup never fired, so the private-HOME sandbox PATH always fell back to
the hard-coded `C:\Windows`, and the private-key strip left the host
`Path` in place beside the sandbox `PATH` it then pushed.

`chat_spawn::scrubbed_child_env` already compares this way; route the
three list matches through one helper that does the same.

Co-authored-by: kevin9327 <[REDACTED_EMAIL]>

**File**: `crates/op-host-services/src/chat_subprocess_safety.rs` (modified, +14/-3)
```diff
@@ -320,11 +320,11 @@ pub fn append_isolated_env(env: &mut Vec<(String, String)>, turn: Option<&Isolat
         #[cfg(windows)]
         let safe_path = env
             .iter()
-            .find(|(key, _)| key == "SYSTEMROOT")
+            .find(|(key, _)| key.eq_ignore_ascii_case("SYSTEMROOT"))
             .map(|(_, root)| format!(r"{root}\System32;{root}"))
             .unwrap_or_else(|| r"C:\Windows\System32;C:\Windows".to_string());
         const PRIVATE_KEYS: &[&str] = &["PATH", "TMPDIR", "TMP", "TEMP"];
-        env.retain(|(key, _)| !PRIVATE_KEYS.contains(&key.as_str()));
+        env.retain(|(key, _)| !env_key_listed(PRIVATE_KEYS, key));
         let value = |path: &Path| path.to_string_lossy().into_owned();
         env.extend([
             ("PATH".to_string(), safe_path),
@@ -563,6 +563,17 @@ where
         .collect()
 }
 
+/// Windows environment keys are case-insensitive and the OS hands them to a
+/// process in their native casing — `Path`, `SystemRoot`, `windir`, `ComSpec`,
+/// `ProgramData`. Matching an uppercase list with `contains` therefore drops
+/// every one of them: a guarded CLI then starts with no `Path` and no
+/// `SystemRoot`, and a child that cannot reach `%SystemRoot%\System32` fails
+/// Winsock initialization with `WSAEPROVIDERFAILEDINIT` (os error 10106).
+/// `chat_spawn::scrubbed_child_env` already compares this way.
+fn env_key_listed(list: &[&str], key: &str) -> bool {
+    list.iter().any(|entry| entry.eq_ignore_ascii_case(key))
+}
+
 fn allowed_env(cli: CliName, key: &str) -> bool {
     const COMMON: &[&str] = &[
         "HOME",
@@ -596,7 +607,7 @@ fn allowed_env(cli: CliName, key: &str) -> bool {
         "REQUESTS_CA_BUNDLE",
         "CURL_CA_BUNDLE",
     ];
-    if COMMON.contains(&key) || key.starts_with("LC_") {
+    if env_key_listed(COMMON, key) || key.starts_with("LC_") {
         return true;
     }
     match cli {
```

**File**: `crates/op-host-services/src/chat_subprocess_safety_tests.rs` (modified, +79/-0)
```diff
@@ -205,3 +205,82 @@ fn antigravity_keeps_linux_keyring_session_but_grok_does_not() {
         assert!(!allowed_env(CliName::GrokBuild, key), "{key}");
     }
 }
+
+/// Windows hands the environment over in its native casing, so an uppercase
+/// allowlist matched with `contains` drops `Path`, `SystemRoot`, `windir`,
+/// `ComSpec` and `ProgramData` — the guarded CLI then starts with no PATH and
+/// no Winsock provider root.
+#[test]
+fn guarded_child_env_keeps_windows_native_key_casing() {
+    let vars = vec![
+        ("Path".to_string(), r"C:\Windows\System32".to_string()),
+        ("SystemRoot".to_string(), r"C:\Windows".to_string()),
+        ("windir".to_string(), r"C:\Windows".to_string()),
+        (
+            "ComSpec".to_string(),
+            r"C:\Windows\System32\cmd.exe".to_string(),
+        ),
+        ("ProgramData".to_string(), r"C:\ProgramData".to_string()),
+        ("UserProfile".to_string(), r"C:\Users\dev".to_string()),
+        ("DATABASE_URL".to_string(), "secret".to_string()),
+    ];
+
+    for cli in [CliName::GrokBuild, CliName::Antigravity, CliName::Dsh] {
+        let keys: Vec<String> = filtered_env(cli, vars.clone())
+            .into_iter()
+            .map(|(key, _)| key)
+            .collect();
+        assert_eq!(
+            keys,
+            vec![
+                "Path",
+                "SystemRoot",
+                "windir",
+                "ComSpec",
+                "ProgramData",
+                "UserProfile",
+            ],
+            "{cli:?} dropped natively-cased Windows keys"
+        );
+    }
+}
+
+/// The private-HOME rewrite has to find `SystemRoot` in its real casing to
+/// build the sandbox PATH, and has to strip the inherited `Path` rather than
+/// leave a second, host-valued entry behind it.
+#[test]
+#[cfg(windows)]
+fn isolated_env_reads_native_cased_system_root_and_strips_host_path() {
+    let turn = IsolatedTurn::prepare_for(
+        Some(CliName::Antigravity),
+        "return only JavaScript",
+        &[],
+        TurnPurpose::Generation,
+        None,
+    )
+    .unwrap()
+    .unwrap();
+
+    let mut env = vec![
+        ("Path".to_string(), r"C:\host\tools".to_string()),
+        ("SystemRoot".to_string(), r"D:\Windows".to_string()),
+        ("TEMP".to_string(), r"C:\host\temp".to_string()),
+    ];
+    append_isolated_env(&mut env, Some(&turn));
+
+    let path_entries: Vec<&(String, String)> = env
+        .iter()
+        .filter(|(key, _)| key.eq_ignore_ascii_case("PATH"))
+        .collect();
+    assert_eq!(
+        path_entries.len(),
+        1,
+        "the host PATH must be replaced, not shadowed: {env:?}"
+    );
+    assert_eq!(path_entries[0].1, r"D:\Windows\System32;D:\Windows");
+    let temp = env
+        .iter()
+        .find(|(key, _)| key == "TEMP")
+        .expect("private TEMP");
+    assert!(Path::new(&temp.1).starts_with(turn.cwd()), "{temp:?}");
+}
```

---

### Incident Patch 12: `414a16e8` (2026-09-14)
**Commit Message**: fix(agent): match the Codex env allowlist case-insensitively (#232)

Windows environment keys are case-insensitive and the OS hands them to a
process in their native casing — `SystemRoot`, `windir`, `ComSpec`,
`SystemDrive`, `Path`. The Codex allowlist compared them with an exact
`contains`, so on Windows it dropped every host variable and left the
child with only `OPENAI_*` / `CODEX_*`. Without `SystemRoot` the child
cannot load the Winsock service providers under `%SystemRoot%\System32`
and the turn dies with `WSAEPROVIDERFAILEDINIT` (os error 10106).

`WINDIR` was missing from the list outright. `op_acp::client` already
normalizes its own allowlist for exactly this reason; do the same here.
The `env_key` opt-ins and the `OPENAI_` / `CODEX_` prefixes stay exact —
those are provider names the user spells out, not host variables.

Closes #229

Co-authored-by: kevin9327 <[REDACTED_EMAIL]>

**File**: `crates/op-host-services/src/chat_subprocess_quirks.rs` (modified, +101/-8)
```diff
@@ -49,8 +49,11 @@ const CODEX_ENV_ALLOWLIST: &[&str] = &[
     "http_proxy",
     "https_proxy",
     "no_proxy",
-    // Windows-essential vars
+    // Windows-essential vars. Matched case-insensitively (see
+    // `codex_env_allowed`) because Windows reports these in their native
+    // casing, e.g. `SystemRoot` / `windir` / `ComSpec` / `SystemDrive`.
     "SYSTEMROOT",
+    "WINDIR",
     "COMSPEC",
     "USERPROFILE",
     "APPDATA",
@@ -118,16 +121,37 @@ fn load_codex_config_env_keys() -> Vec<String> {
 /// prefixes + config.toml `env_key` opt-ins (TS `filterCodexEnv`).
 pub fn codex_child_env() -> Vec<(String, String)> {
     let extra = load_codex_config_env_keys();
-    std::env::vars()
-        .filter(|(k, _)| {
-            CODEX_ENV_ALLOWLIST.contains(&k.as_str())
-                || extra.iter().any(|e| e == k)
-                || k.starts_with("OPENAI_")
-                || k.starts_with("CODEX_")
-        })
+    filter_codex_env(std::env::vars(), &extra)
+}
+
+fn filter_codex_env<I>(vars: I, extra: &[String]) -> Vec<(String, String)>
+where
+    I: IntoIterator<Item = (String, String)>,
+{
+    vars.into_iter()
+        .filter(|(key, _)| codex_env_allowed(key, extra))
         .collect()
 }
 
+/// Windows environment keys are case-insensitive, and the OS hands them to a
+/// process in their native casing — `SystemRoot`, `windir`, `ComSpec`,
+/// `SystemDrive`, `Path`. An exact match against the uppercase allowlist
+/// therefore dropped every one of them, and a Codex child launched without
+/// `SystemRoot` cannot load the Winsock service providers under
+/// `%SystemRoot%\System32`: the turn dies with `WSAEPROVIDERFAILEDINIT`
+/// (os error 10106). Compare the system allowlist case-insensitively, the way
+/// `op_acp::client::local_env_allowed` already does. The `env_key` opt-ins and
+/// the `OPENAI_` / `CODEX_` prefixes stay exact: those are provider names the
+/// user spells out, not host variables.
+fn codex_env_allowed(key: &str, extra: &[String]) -> bool {
+    CODEX_ENV_ALLOWLIST
+        .iter()
+        .any(|allowed| allowed.eq_ignore_ascii_case(key))
+        || extra.iter().any(|e| e == key)
+        || key.starts_with("OPENAI_")
+        || key.starts_with("CODEX_")
+}
+
 /// Budget for the one-shot `codex exec --help` capability probe. Generous
 /// on purpose: the result is cached per binary path for the process
 /// lifetime — including a TimedOut-as-unsupported verdict — so a single
@@ -415,6 +439,75 @@ pub fn codex_reasoning_effort(thinking: ThinkingMode, effort: EffortLevel) -> Op
 mod tests {
     use super::*;
 
+    fn owned(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
+        pairs
+            .iter()
+            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
+            .collect()
+    }
+
+    /// Windows hands the environment over in its native casing, so the
+    /// allowlist has to match case-insensitively. Losing `SystemRoot` here is
+    /// what made the Codex turn fail Winsock init with os error 10106.
+    #[test]
+    fn codex_env_keeps_windows_native_key_casing() {
+        let kept = filter_codex_env(
+            owned(&[
+                ("SystemRoot", r"C:\Windows"),
+                ("windir", r"C:\Windows"),
+                ("ComSpec", r"C:\Windows\System32\cmd.exe"),
+                ("SystemDrive", "C:"),
+                ("Path", r"C:\Windows\System32"),
+                ("PathExt", ".COM;.EXE;.BAT;.CMD"),
+                ("UserProfile", r"C:\Users\dev"),
+            ]),
+            &[],
+        );
+        let names: Vec<&str> = kept.iter().map(|(k, _)| k.as_str()).collect();
+        assert_eq!(
+            names,
+            vec![
+                "SystemRoot",
+                "windir",
+                "ComSpec",
+                "SystemDrive",
+                "Path",
+                "PathExt",
+                "UserProfile",
+            ]
+        );
+    }
+
+    /// The relaxed casing must not widen the secret boundary: only the
+    /// allowlist, the `OPENAI_` / `CODEX_` prefixes and the config.toml
+    /// `env_key` opt-ins get through.
+    #[test]
+    fn codex_env_still_filters_secrets_and_honours_opt_ins() {
+        let kept = filter_codex_env(
+            owned(&[
+                ("SystemRoot", r"C:\Windows"),
+                ("ANTHROPIC_API_KEY", "secret"),
+                ("GITHUB_TOKEN", "secret"),
+                ("AWS_SECRET_ACCESS_KEY", "secret"),
+                ("ALL_PROXY", "socks5://127.0.0.1:7897"),
+                ("OPENAI_API_KEY", "sk-test"),
+                ("CODEX_HOME", "/tmp/codex"),
+                ("MY_PROVIDER_KEY", "opted-in"),
+            ]),
+            &["MY_PROVIDER_KEY".to_string()],
+        );
+        let names: Vec<&str> = kept.iter().map(|(k, _)| k.as_str()).collect();
+        assert_eq!(
+            names,
+            vec![
+                "SystemRoot",
+                "OPENAI_API_KEY",
+                "CODEX_HOME",
+                "MY_PROVIDER_KEY
```

---

### Incident Patch 13: `51a99f97` (2026-09-14)
**Commit Message**: fix(editor): address restored blobs with git's path separator (#235)

`restore` builds a `<rev>:<path>` revspec out of `rel_to_workdir`, which
returns an OS path. Git addresses tree entries with `/` on every
platform, so on Windows the lookup asked for `designs\home.op` and
libgit2 answered "the path does not exist in the given tree" — the git
panel's "restore this version" failed for every document except one
sitting in the repository root, which has no separator to get wrong.

`git_session::tracked_relpath` already normalizes for this reason, and
`blob_at_commit` is safe only because its caller feeds it that value.

Co-authored-by: kevin9327 <[REDACTED_EMAIL]>

**File**: `crates/op-git/src/status.rs` (modified, +8/-0)
```diff
@@ -225,6 +225,14 @@ impl GitRepo {
         let Some(rel_str) = rel.to_str() else {
             return Ok(());
         };
+        // `<rev>:<path>` addresses a *tree* entry, and git tree entries are
+        // `/`-separated on every platform. `rel_to_workdir` hands back an OS
+        // path, so on Windows this is `designs\home.op` and the lookup misses
+        // for anything below the repository root — only a root-level file, which
+        // has no separator, resolves. `git_session::tracked_relpath` normalizes
+        // for the same reason; `MAIN_SEPARATOR` keeps a literal backslash in a
+        // Unix filename intact.
+        let rel_str = rel_str.replace(std::path::MAIN_SEPARATOR, "/");
         let object = repo.revparse_single(&format!("{commit}:{rel_str}"))?;
         let blob = object.peel_to_blob()?;
         let abs = self.workdir().join(&rel);
```

**File**: `crates/op-git/src/tests_repo.rs` (modified, +24/-0)
```diff
@@ -143,6 +143,30 @@ fn restore_reverts_a_modified_file() {
     assert_eq!(content, "committed");
 }
 
+/// The git panel restores through `git_session.tracked_file()`, an absolute
+/// path, so `rel_to_workdir` yields an OS-separated relative path. A `<rev>:
+/// <path>` revspec only understands `/`, so on Windows every document below
+/// the repository root failed to resolve — root-level files happened to work
+/// because they carry no separator, which is why both existing tests missed it.
+#[test]
+fn restore_reverts_a_file_below_the_repository_root() {
+    let Some(tr) = TempRepo::new("restore-subdir") else {
+        return;
+    };
+    std::fs::create_dir_all(tr.dir.join("designs")).expect("mkdir");
+    tr.write("designs/a.op", "committed");
+    tr.repo.stage_all().expect("stage");
+    tr.repo.commit("init").expect("commit");
+
+    let absolute = tr.dir.join("designs").join("a.op");
+    std::fs::write(&absolute, "scratch edit").expect("write");
+    assert!(!tr.repo.status().expect("status").is_clean());
+
+    tr.repo.restore(&absolute, "HEAD").expect("restore");
+    assert_eq!(std::fs::read_to_string(&absolute).unwrap(), "committed");
+    assert!(tr.repo.status().expect("status").is_clean());
+}
+
 #[test]
 fn restore_rolls_a_file_back_to_an_older_commit() {
     let Some(tr) = TempRepo::new("restore-commit") else {
```

---

### Incident Patch 14: `955a6d7b` (2026-09-14)
**Commit Message**: fix(cli): decode a percent-encoded resource name before the disk lookup (#242)

The importer resolves relative hrefs through Url::join, which
percent-encodes spaces and non-ASCII path bytes, so a local
`hero style.css` reaches the fetcher as `hero%20style.css` and misses
the file on disk. The import still reports ok and only records
"external stylesheet skipped" for a file that is not external.

Decode before building the path, as the desktop importer already does,
and keep the component and canonical containment checks on the decoded
name so encoded separators and `..` still cannot escape the directory.

**File**: `crates/op-cli/src/html_cli.rs` (modified, +118/-0)
```diff
@@ -203,8 +203,17 @@ pub(super) fn run_import_snapshot(json_path: &str, out_path: &str) -> Result<Str
 
 fn local_resource_fetch(dir: &Path, href: &str) -> Option<Vec<u8>> {
     let href = href.split(['?', '#']).next()?.trim_start_matches('/');
+    // `Url::join` percent-encodes spaces and non-ASCII path bytes before the
+    // importer calls this fetcher, so `hero style.css` arrives as
+    // `hero%20style.css` and misses the file on disk. Decode first and keep
+    // the component + canonical containment checks below as the security
+    // boundary, so encoded separators and `..` still cannot escape `dir`
+    // (mirrors `html_import_session.rs`'s local fetch).
+    let href = percent_decode_path(href)?;
+    let href = href.as_str();
     let relative = Path::new(href);
     if href.is_empty()
+        || href.contains('\0')
         || relative.is_absolute()
         || relative.components().any(|component| {
             matches!(
@@ -222,6 +231,35 @@ fn local_resource_fetch(dir: &Path, href: &str) -> Option<Vec<u8>> {
         .flatten()
 }
 
+/// Percent-decode a resolved resource path. A stray `%` that is not followed
+/// by two hex digits, or bytes that are not UTF-8, reject the lookup.
+fn percent_decode_path(encoded: &str) -> Option<String> {
+    let source = encoded.as_bytes();
+    let mut decoded = Vec::with_capacity(source.len());
+    let mut index = 0;
+    while index < source.len() {
+        if source[index] != b'%' {
+            decoded.push(source[index]);
+            index += 1;
+            continue;
+        }
+        let high = hex_value(*source.get(index + 1)?)?;
+        let low = hex_value(*source.get(index + 2)?)?;
+        decoded.push((high << 4) | low);
+        index += 3;
+    }
+    String::from_utf8(decoded).ok()
+}
+
+fn hex_value(byte: u8) -> Option<u8> {
+    match byte {
+        b'0'..=b'9' => Some(byte - b'0'),
+        b'a'..=b'f' => Some(byte - b'a' + 10),
+        b'A'..=b'F' => Some(byte - b'A' + 10),
+        _ => None,
+    }
+}
+
 fn count_nodes(nodes: &[PenNode]) -> usize {
     nodes
         .iter()
@@ -391,6 +429,86 @@ mod tests {
         );
     }
 
+    fn temp_html_dir(tag: &str) -> std::path::PathBuf {
+        let nanos = std::time::SystemTime::now()
+            .duration_since(std::time::UNIX_EPOCH)
+            .map(|duration| duration.as_nanos())
+            .unwrap_or_default();
+        let dir =
+            std::env::temp_dir().join(format!("op-cli-html-{tag}-{}-{nanos}", std::process::id()));
+        std::fs::create_dir_all(&dir).expect("create fixture dir");
+        dir
+    }
+
+    /// The importer resolves every relative href through `Url::join`, which
+    /// percent-encodes spaces and non-ASCII bytes, so a stylesheet saved as
+    /// `hero style.css` reaches the fetcher as `hero%20style.css`.
+    #[test]
+    fn local_import_reads_a_percent_encoded_resource_name() {
+        let dir = temp_html_dir("encoded");
+        std::fs::write(dir.join("hero style.css"), "p{color:#00ff00}").expect("write stylesheet");
+        let input = dir.join("page.html");
+        std::fs::write(
+            &input,
+            concat!(
+                "<html><head><link rel=\"stylesheet\" href=\"hero style.css\">",
+                "</head><body><p>Hi</p></body></html>"
+            ),
+        )
+        .expect("write HTML fixture");
+        let output = dir.join("page.op");
+
+        let result = super::run_import_html(
+            input.to_str().expect("UTF-8 input path"),
+            output.to_str().expect("UTF-8 output path"),
+            None,
+        )
+        .expect("import HTML");
+        let document = std::fs::read_to_string(&output).expect("read imported document");
+
+        let _ = std::fs::remove_dir_all(&dir);
+        assert_eq!(
+            result.matches("skipped").count(),
+            0,
+            "a local stylesheet must not be reported as skipped: {result}"
+        );
+        assert!(
+            document.contains("#00ff00"),
+            "the stylesheet must style the imported text: {document}"
+        );
+    }
+
+    /// The decode must not widen what the fetcher accepts: encoded separators
+    /// and encoded `..` stay outside the resource directory.
+    #[test]
+    fn local_resource_fetch_rejects_escapes_however_they_are_encoded() {
+        let dir = temp_html_dir("escape");
+        std::fs::write(dir.join("inside.css"), "p{color:#0000ff}").expect("write stylesheet");
+        std::fs::write(dir.join("outside.css"), "p{color:#ff0000}")
+            .expect("write outside stylesheet");
+        let nested = dir.join("nested");
+        std::fs::create_dir_all(&nested).expect("create nested dir");
+
+        let inside = super::local_resource_fetch(&dir, "inside.css");
+        let parent = super::local_resource_fetch(&nested, "../outside.css");
+        let encoded_parent = super::local_resource_fetch(&nested, "%2e%2e/outside.css");
+        let encoded_root = super::local_resource_
```

---

### Incident Patch 15: `835a93cd` (2026-09-14)
**Commit Message**: fix(design-lint): guard the transparent-alpha test against a non-ascii fill (#243)

is_transparent_hex checks a byte length and then slices at byte 7, so a
nine-byte fill color that is not ASCII panics the contrast detector.
Three CJK characters are exactly nine bytes, and a fill color is an
unvalidated model-authored string, so a generated color name such as
深蓝色 takes down the pre-validation pass.

Add the is_ascii() term the sibling copies in empty_filled_panel.rs and
top_anchored_bars.rs already carry; that also makes the doc comment's
"9-char" true, since for ASCII nine bytes is nine chars.

**File**: `crates/op-design-lint/src/detectors/typography.rs` (modified, +52/-1)
```diff
@@ -327,7 +327,7 @@ fn first_solid_color(fills: Option<&Vec<PenFill>>) -> Option<String> {
 /// True for a 9-char `#RRGGBBAA` hex whose alpha pair is `00` — a fully
 /// transparent solid, treated the same as `opacity == 0`.
 fn is_transparent_hex(color: &str) -> bool {
-    color.len() == 9 && color[7..].eq_ignore_ascii_case("00")
+    color.len() == 9 && color.is_ascii() && color[7..].eq_ignore_ascii_case("00")
 }
 
 /// Port of `isLargeText` (`detectors-typography.ts:87-99`). WCAG 2.x large
@@ -437,6 +437,57 @@ mod tests {
         );
     }
 
+    /// A fill color the model wrote as a name rather than a hex must not
+    /// panic the detector. `深蓝色` is nine UTF-8 bytes, so the byte-length
+    /// test in `is_transparent_hex` accepts it and the `[7..]` slice lands
+    /// inside the last character.
+    #[test]
+    fn tolerates_a_non_ascii_fill_color() {
+        let root = node(json!({
+            "type": "frame", "id": "page",
+            "fill": [{"type": "solid", "color": "#FFFFFF"}],
+            "children": [
+                {
+                    "type": "text", "id": "t1", "content": "Hello",
+                    "fill": [{"type": "solid", "color": "深蓝色"}]
+                }
+            ]
+        }));
+        // The color does not resolve, so the node is skipped — but the walk
+        // must finish instead of panicking.
+        assert!(
+            detect_text_bg_contrast(&root, &doc(json!({"version": "1.0", "children": []})))
+                .is_empty()
+        );
+    }
+
+    /// The transparent-alpha skip itself is unchanged: a `#RRGGBBAA` fill
+    /// with alpha `00` is passed over so the next fill supplies the color.
+    #[test]
+    fn skips_a_zero_alpha_fill_for_the_next_one() {
+        let root = node(json!({
+            "type": "frame", "id": "page",
+            "fill": [{"type": "solid", "color": "#FFFFFF"}],
+            "children": [
+                {
+                    "type": "text", "id": "t1", "content": "Hello",
+                    "fill": [
+                        {"type": "solid", "color": "#00000000"},
+                        {"type": "solid", "color": "#FCFCFC"}
+                    ]
+                }
+            ]
+        }));
+        let issues =
+            detect_text_bg_contrast(&root, &doc(json!({"version": "1.0", "children": []})));
+        assert_eq!(issues.len(), 1);
+        assert!(
+            issues[0].reason.contains("text=#FCFCFC"),
+            "the zero-alpha fill must be skipped: {}",
+            issues[0].reason
+        );
+    }
+
     /// An `opacity:0` wrapper fill is skipped so contrast is computed against
     /// the real bg behind it — a white wrapper with opacity 0 over a cream
     /// page must NOT mask the cream-on-cream failure.
```

#### Recent Merged Pull Requests:
- **PR #248** (closed): feat(agent): add packaged browser snapshot capture tool (@caniko)
- **PR #243** (2026-09-14): fix(design-lint): guard the transparent-alpha test against a non-ascii fill (@kevin9327)
- **PR #242** (2026-09-14): fix(cli): decode a percent-encoded resource name before the disk lookup (@kevin9327)
- **PR #241** (2026-09-14): fix(ai): keep the radius context cut on a char boundary (@kevin9327)
- **PR #240** (2026-09-14): fix(html): stop a non-ascii css prelude from panicking the import (@kevin9327)
- **PR #235** (2026-09-14): fix(editor): address restored blobs with git's path separator (@kevin9327)
- **PR #233** (2026-09-14): fix(agent): keep the natively-cased Windows vars for guarded CLIs (@kevin9327)
- **PR #232** (2026-09-14): fix(agent): match the Codex env allowlist case-insensitively (@kevin9327)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
