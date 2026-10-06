# Forensic Learning Record (Deep Inspection): RightNow-AI/openfang

> **Canonical Artifact**: `07_PROJECT_LEARNING/rightnow-ai-openfang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RightNow-AI/openfang](https://github.com/RightNow-AI/openfang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:10:33.952Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RightNow-AI/openfang`
- **Description**: Open-source Agent Operating System
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 18205 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/openfang-channels/src/webhook.rs`
```
//! Generic HTTP webhook channel adapter.
//!
//! Provides a bidirectional webhook integration point. Incoming messages are
//! received via an HTTP server that verifies `X-Webhook-Signature` (HMAC-SHA256
//! of the request body). Outbound messages are POSTed to a configurable
//! callback URL with the same signature scheme.

use crate::types::{
    split_message, ChannelAdapter, ChannelContent, ChannelMessage, ChannelType, ChannelUser,
};
use async_trait::async_trait;
use chrono::Utc;
use futures::Stream;
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, watch};
use tracing::{info, warn};
use zeroize::Zeroizing;

const MAX_MESSAGE_LEN: usize = 65535;

/// Generic HTTP webhook channel adapter.
///
/// The most flexible adapter in the OpenFang channel suite. Any system that
/// can send/receive HTTP requests with HMAC-SHA256 signatures can integrate
/// through this adapter.
///
/// ## Inbound (receiving)
///
/// Listens on `listen_port` for `POST /webhook` (or `POST /`) requests.
/// Each request must include an `X-Webhook-Signature` header containing
/// `sha256=<hex-digest>` where the digest is `HMAC-SHA256(secret, body)`.
///
/// Expected JSON body:
/// ```json
/// {
///   "sender_id": "user-123",
///   "sender_name": "Alice",
///   "message": "Hello!",
///   "thread_id": "optional-thread",
///   "is_group": false,
///   "metadata": {}
/// }
/// ```
///
/// ## Outbound (sending)
///
/// If `callback_url` is set, messages are POSTed there with the same signature
/// scheme.
pub struct WebhookAdapter {
    /// SECURITY: Shared secret for HMAC-SHA256 signatures (zeroized on drop).
    secret: Zeroizing<String>,
    /// Port to listen on for incoming webhooks.
    listen_port: u16,
    /// Optional callback URL for sending messages.
    callback_url: Option<String>,
    /// HTTP client for outbound requests.
    client: reqwest::Client,
    /// Shutdown signal.
    shutdown_tx: Arc<watch::Sender<bool>>,
    shutdown_rx: watch::Receiver<bool>,
}

impl WebhookAdapter {
    /// Create a new generic webhook adapter.
    ///
    /// # Arguments
    /// * `secret` - Shared secret for HMAC-SHA256 signature verification.
    /// * `listen_port` - Port to listen for incoming webhook POST requests.
    /// * `callback_url` - Optional URL to POST outbound messages to.
    pub fn new(secret: String, listen_port: u16, callback_url: Option<String>) -> Self {
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        Self {
            secret: Zeroizing::new(secret),
            listen_port,
            callback_url,
            client: reqwest::Client::new(),
            shutdown_tx: Arc::new(shutdown_tx),
            shutdown_rx,
        }
    }

    /// Compute HMAC-SHA256 signature of data with the shared secret.
    ///
    /// Returns the hex-encoded digest prefixed with "sha256=".
    fn compute_signature(secret: &str, data: &[u8]) -> String {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        let mut mac =
            Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key size");
        mac.update(data);
        let result = mac.finalize();
        let hex = hex::encode(result.into_bytes());
        format!("sha256={hex}")
    }

    /// Verify an incoming webhook signature (constant-time comparison).
    fn verify_signature(secret: &str, body: &[u8], signature: &str) -> bool {
        let expected = Self::compute_signature(secret, body);
        if expected.len() != signature.len() {
            return false;
        }
        // Constant-time comparison to prevent timing attacks
        let mut diff = 0u8;
        for (a, b) in expected.bytes().zip(signature.bytes()) {
            diff |= a ^ b;
        }
        diff == 0
    }

    /// Parse an incoming webhook JSON body.
    #[allow(clippy::type_complexity)]
    fn parse_webhook_body(
        body: &serde_json::Value,
    ) -> Option<(
        String,
        String,
        String,
        Option<String>,
        bool,
        HashMap<String, serde_json::Value>,
    )> {
        let message = body["message"].as_str()?.to_string();
        if message.is_empty() {
            return None;
        }

        let sender_id = body["sender_id"]
            .as_str()
            .unwrap_or("webhook-user")
            .to_string();
        let sender_name = body["sender_name"]
            .as_str()
            .unwrap_or("Webhook User")
            .to_string();
        let thread_id = body["thread_id"].as_str().map(String::from);
        let is_group = body["is_group"].as_bool().unwrap_or(false);

        let metadata = body["metadata"]
            .as_object()
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect::<HashMap<_, _>>()
            })
            .unwrap_or_default();

        Some((
            message,
            sender_id,
            sender_name,
            thread_id,
            is_group,
            metadata,
        ))
    }

    /// Check if a callback URL is configured.
    pub fn has_callback(&self) -> bool {
        self.callback_url.is_some()
    }
}

#[async_trait]
impl ChannelAdapter for WebhookAdapter {
    fn name(&self) -> &str {
        "webhook"
    }

    fn channel_type(&self) -> ChannelType {
        ChannelType::Custom("webhook".to_string())
    }

    async fn start(
        &self,
    ) -> Result<Pin<Box<dyn Stream<Item = ChannelMessage> + Send>>, Box<dyn std::error::Error>>
    {
        let (tx, rx) = mpsc::channel::<ChannelMessage>(256);
        let port = self.listen_port;
        let secret = self.secret.clone();
        let mut shutdown_rx = self.shutdown_rx.clone();

        info!("Webhook adapter starting HTTP server on port {port}");

        tokio::spawn(async move {
            let tx_shared = Arc::new(tx);
            let secret_shared = Arc::new(secret);

            let app = axum::Router::new().route(
                "/webhook",
                axum::routing::post({
                    let tx = Arc::clone(&tx_shared);
                    let secret = Arc::clone(&secret_shared);
                    move |headers: axum::http::HeaderMap, body: axum::body::Bytes| {
                        let tx = Arc::clone(&tx);
                        let secret = Arc::clone(&secret);
                        async move {
                            // Extract and verify signature
                            let signature = headers
                                .get("X-Webhook-Signature")
                                .and_then(|v| v.to_str().ok())
                                .unwrap_or("");

                            if !WebhookAdapter::verify_signature(&secret, &body, signature) {
                                warn!("Webhook: invalid signature");
                                return (
                                    axum::http::StatusCode::FORBIDDEN,
                                    "Forbidden: invalid signature",
                                );
                            }

                            let json_body: serde_json::Value = match serde_json::from_slice(&body) {
                                Ok(v) => v,
                                Err(_) => {
                                    return (axum::http::StatusCode::BAD_REQUEST, "Invalid JSON");
                                }
                            };

                            if let Some((
                                message,
                                sender_id,
                                sender_name,
                                thread_id,
                                is_group,
                                metadata,
                            )) = WebhookAdapter::parse_webhook_body(&json_body)
                            {
                                let content = if message.starts_with('/') {
                                    let parts: Vec<&str> = message.splitn(2, ' ').collect();
                                    let cmd = parts[0].trim_start_matches('/');
                                    let args: Vec<String> = parts
                                        .get(1)
                                        .map(|a| a.split_whitespace().map(String::from).collect())
                                        .unwrap_or_default();
                                    ChannelContent::Command {
                                        name: cmd.to_string(),
                                        args,
                                    }
                                } else {
                                    ChannelContent::Text(message)
                                };

                                let msg = ChannelMessage {
                                    channel: ChannelType::Custom("webhook".to_string()),
                                    platform_message_id: format!(
                                        "wh-{}",
                                        Utc::now().timestamp_millis()
                                    ),
                                    sender: ChannelUser {
                                        platform_id: sender_id,
                                        display_name: sender_name,
                                        openfang_user: None,
                                    },
                                    content,
                                    target_agent: None,
                                    timestamp: Utc::now(),
                                    is_group,
                                    thread_id,
                                    metadata,
                                };

                                let _ = tx.send(msg).await;
                            }

                            (axum::http::StatusCode::OK, "ok")
                        }
                    }
                }),
            );

            l
```

### Core Architecture Module: `crates/openfang-runtime/src/agent_loop.rs`
```
//! Core agent execution loop.
//!
//! The agent loop handles receiving a user message, recalling relevant memories,
//! calling the LLM, executing tool calls, and saving the conversation.

use crate::auth_cooldown::{CooldownVerdict, ProviderCooldown};
use crate::context_budget::{apply_context_guard, truncate_tool_result_dynamic, ContextBudget};
use crate::context_overflow::{recover_from_overflow, RecoveryStage};
use crate::embedding::EmbeddingDriver;
use crate::kernel_handle::KernelHandle;
use crate::llm_driver::{CompletionRequest, DriverConfig, LlmDriver, LlmError, StreamEvent};
use crate::llm_errors;
use crate::loop_guard::{LoopGuard, LoopGuardConfig, LoopGuardVerdict};
use crate::mcp::McpConnection;
use crate::tool_runner;
use crate::web_search::WebToolsContext;
use openfang_memory::session::Session;
use openfang_memory::MemorySubstrate;
use openfang_skills::registry::SkillRegistry;
use openfang_types::agent::{AgentManifest, FallbackModel};
use openfang_types::error::{OpenFangError, OpenFangResult};
use openfang_types::memory::{Memory, MemoryFilter, MemorySource};
use openfang_types::message::{
    ContentBlock, Message, MessageContent, Role, StopReason, TokenUsage,
};
use openfang_types::tool::{ToolCall, ToolDefinition};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Maximum iterations in the agent loop before giving up.
const MAX_ITERATIONS: u32 = 50;

/// Maximum retries for rate-limited or overloaded API calls.
const MAX_RETRIES: u32 = 3;

/// Base delay for exponential backoff (milliseconds).
const BASE_RETRY_DELAY_MS: u64 = 1000;

/// Default timeout for individual tool executions (seconds).
/// Raised from 60s to 120s for browser automation and long-running builds.
/// Overridable via `OPENFANG_TOOL_TIMEOUT_SECS` env var. Set to `0` to disable
/// the timeout entirely (useful for slow local inference like vLLM on old GPUs).
const TOOL_TIMEOUT_SECS: u64 = 120;

/// Default timeout for inter-agent tool calls (seconds).
/// Agent delegation (agent_send, agent_spawn) can involve a full agent loop on the
/// target, so these need a significantly longer timeout than regular tools.
/// Overridable via `OPENFANG_AGENT_TOOL_TIMEOUT_SECS` env var. Set to `0` to
/// disable (issue #1125: slow vLLM rigs running Hands need unbounded waits).
const AGENT_TOOL_TIMEOUT_SECS: u64 = 600;

/// Parse a u64 env var, returning `None` when unset or unparseable so the
/// caller falls back to the compiled-in default.
fn env_timeout_secs(var: &str) -> Option<u64> {
    std::env::var(var).ok().and_then(|s| s.trim().parse().ok())
}

/// Returns the appropriate timeout duration for a given tool name.
/// Inter-agent calls get a longer timeout since they may trigger full agent loops.
///
/// Returns `None` when the operator opted out by setting the relevant env var
/// to `0`. In that case the tool runs with no upper bound, which is what users
/// on slow local inference (vLLM on old GPUs) want for Hands and inter-agent
/// delegation (issue #1125).
fn tool_timeout_for(tool_name: &str) -> Option<Duration> {
    let secs = match tool_name {
        "agent_send" | "agent_spawn" => {
            env_timeout_secs("OPENFANG_AGENT_TOOL_TIMEOUT_SECS").unwrap_or(AGENT_TOOL_TIMEOUT_SECS)
        }
        _ => env_timeout_secs("OPENFANG_TOOL_TIMEOUT_SECS").unwrap_or(TOOL_TIMEOUT_SECS),
    };
    if secs == 0 {
        None
    } else {
        Some(Duration::from_secs(secs))
    }
}

/// Maximum consecutive MaxTokens continuations before returning partial response.
/// Raised from 3 to 5 to allow longer-form generation.
const MAX_CONTINUATIONS: u32 = 5;

/// Default maximum message history size before auto-trimming to prevent context overflow.
/// Per-agent overrides come from `AgentManifest::max_history_messages` (issue #871).
#[allow(dead_code)]
const MAX_HISTORY_MESSAGES: usize = openfang_types::agent::DEFAULT_MAX_HISTORY_MESSAGES;

/// Detect when the LLM claims to have performed an action (sent, posted, emailed)
/// without actually calling any tools. Prevents hallucinated completions.
fn phantom_action_detected(text: &str) -> bool {
    let lower = text.to_lowercase();
    let action_verbs = ["sent ", "posted ", "emailed ", "delivered ", "forwarded "];
    let channel_refs = [
        "telegram",
        "whatsapp",
        "slack",
        "discord",
        "email",
        "channel",
        "message sent",
        "successfully sent",
        "has been sent",
    ];
    let has_action = action_verbs.iter().any(|v| lower.contains(v));
    let has_channel = channel_refs.iter().any(|c| lower.contains(c));
    has_action && has_channel
}

/// Returns true when the agent response text indicates an intentional silent completion.
/// Matches `NO_REPLY` (exact) and `[SILENT]` (case-insensitive).
fn is_silent_token(text: &str) -> bool {
    let trimmed = text.trim();
    trimmed == "NO_REPLY" || trimmed.eq_ignore_ascii_case("[silent]")
}

/// Extra guidance injected after failed tool calls to prevent fabricated follow-up actions.
const TOOL_ERROR_GUIDANCE: &str =
    "[System: One or more tool calls failed. Failed tools did not produce usable data. Do NOT invent missing results, cite nonexistent search results, or pretend failed tools succeeded. If your next steps depend on a failed tool, either retry with a materially different approach or explain the failure to the user and stop. Do not write files, store memory, or take downstream actions based on failed tool outputs.]";

fn append_tool_error_guidance(tool_result_blocks: &mut Vec<ContentBlock>) {
    let has_tool_error = tool_result_blocks
        .iter()
        .any(|block| matches!(block, ContentBlock::ToolResult { is_error: true, .. }));
    if has_tool_error {
        tool_result_blocks.push(ContentBlock::Text {
            text: TOOL_ERROR_GUIDANCE.to_string(),
            provider_metadata: None,
        });
    }
}

/// Build an assistant message that preserves Thinking blocks alongside the
/// final visible text.
///
/// Issue #1098 — thinking-model state preservation.  When the LLM response
/// contains `ContentBlock::Thinking` (Anthropic extended thinking with
/// signatures, Gemini 2.5+ thoughts, OpenAI-compat reasoning_content,
/// MiniMax/Qwen inline `<think>` blocks), the prior code stored only the
/// final text via `Message::assistant(text)` — discarding all reasoning
/// state.  On the next turn the model re-derived its answer from scratch
/// and quality degraded.
///
/// This helper preserves the full block list whenever any Thinking block is
/// present, otherwise returns the legacy `Message::assistant(text)` form so
/// downstream consumers (channel formatters, JSONL mirrors, embeddings) keep
/// working without changes.
///
/// Note: we deliberately replace any visible Text blocks in `response_blocks`
/// with `final_text` so that any post-processing the agent loop applied
/// (phantom-action recovery, accumulated_text fallback, EmptyResponse guard
/// stub) is reflected in the persisted message.
fn build_assistant_message_preserving_thinking(
    response_blocks: &[ContentBlock],
    final_text: &str,
) -> Message {
    // Key on either Thinking or RedactedThinking — Anthropic/Bedrock both
    // reject extended-thinking history that drops the redacted variant, so a
    // turn that contains only RedactedThinking must still be preserved.
    let has_reasoning = response_blocks.iter().any(|b| {
        matches!(
            b,
            ContentBlock::Thinking { .. } | ContentBlock::RedactedThinking { .. }
        )
    });
    if !has_reasoning {
        return Message::assistant(final_text.to_string());
    }

    // Preserve order: Thinking / RedactedThinking blocks first (in original
    // order), then a single Text block carrying `final_text`. Tool blocks
    // aren't expected here (StopReason::EndTurn path), but copy them through
    // if present so we don't drop information.
    let mut blocks: Vec<ContentBlock> = Vec::with_capacity(response_blocks.len() + 1);
    let mut emitted_text = false;
    for b in response_blocks {
        match b {
            ContentBlock::Thinking { .. } | ContentBlock::RedactedThinking { .. } => {
                blocks.push(b.clone())
            }
            ContentBlock::Text { .. } if !emitted_text => {
                blocks.push(ContentBlock::Text {
                    text: final_text.to_string(),
                    provider_metadata: None,
                });
                emitted_text = true;
            }
            ContentBlock::Text { .. } => {
                // Drop additional text blocks — final_text already captures
                // the canonical visible message.
            }
            other => blocks.push(other.clone()),
        }
    }
    if !emitted_text && !final_text.is_empty() {
        blocks.push(ContentBlock::Text {
            text: final_text.to_string(),
            provider_metadata: None,
        });
    }

    Message::assistant_with_blocks(blocks)
}

/// Strip a provider prefix from a model ID before sending to the API.
///
/// Many models are stored as `provider/org/model` (e.g. `openrouter/google/gemini-2.5-flash`)
/// but the upstream API expects just `org/model` (e.g. `google/gemini-2.5-flash`).
pub fn strip_provider_prefix(model: &str, provider: &str) -> String {
    let slash_prefix = format!("{}/", provider);
    let colon_prefix = format!("{}:", provider);
    if model.starts_with(&slash_prefix) {
        model[slash_prefix.len()..].to_string()
    } else if model.starts_with(&colon_prefix) {
        model[colon_prefix.len()..].to_string()
    } else {
        model.to_string()
    }
}

/// Default context window size (tokens) for token-based trimming.
const DEFAULT_CONTEXT_WINDOW: usize = 200_000;

/// Agent lifecycle phase within the execution loop.
/// Used for UX indicators (typing, reactions) without coupling to channel types.
#[derive(Debug, Clone, Part
```

### Core Architecture Module: `crates/openfang-runtime/src/hooks.rs`
```
//! Plugin lifecycle hooks — intercept points at key moments in agent execution.
//!
//! Provides a callback-based hook system (not dynamic loading) for safe extensibility.
//! Four hook types:
//! - `BeforeToolCall`: Fires before tool execution. Can block the call by returning Err.
//! - `AfterToolCall`: Fires after tool execution. Observe-only.
//! - `BeforePromptBuild`: Fires before system prompt construction. Observe-only.
//! - `AgentLoopEnd`: Fires after the agent loop completes. Observe-only.

use dashmap::DashMap;
use openfang_types::agent::HookEvent;
use std::sync::Arc;

/// Context passed to hook handlers.
pub struct HookContext<'a> {
    /// Agent display name.
    pub agent_name: &'a str,
    /// Agent ID string.
    pub agent_id: &'a str,
    /// Which hook event triggered this call.
    pub event: HookEvent,
    /// Event-specific payload (tool name, input, result, etc.).
    pub data: serde_json::Value,
}

/// Hook handler trait. Implementations must be thread-safe.
pub trait HookHandler: Send + Sync {
    /// Called when the hook fires.
    ///
    /// For `BeforeToolCall`: returning `Err(reason)` blocks the tool call.
    /// For all other events: return value is ignored (observe-only).
    fn on_event(&self, ctx: &HookContext) -> Result<(), String>;
}

/// Registry of hook handlers, keyed by event type.
///
/// Thread-safe via `DashMap`. Handlers fire in registration order.
pub struct HookRegistry {
    handlers: DashMap<HookEvent, Vec<Arc<dyn HookHandler>>>,
}

impl HookRegistry {
    /// Create an empty hook registry.
    pub fn new() -> Self {
        Self {
            handlers: DashMap::new(),
        }
    }

    /// Register a handler for a specific event type.
    pub fn register(&self, event: HookEvent, handler: Arc<dyn HookHandler>) {
        self.handlers.entry(event).or_default().push(handler);
    }

    /// Fire all handlers for an event. Returns Err if any handler blocks.
    ///
    /// For `BeforeToolCall`, the first Err stops execution and returns the reason.
    /// For other events, errors are logged but don't propagate.
    pub fn fire(&self, ctx: &HookContext) -> Result<(), String> {
        if let Some(handlers) = self.handlers.get(&ctx.event) {
            for handler in handlers.iter() {
                if let Err(reason) = handler.on_event(ctx) {
                    if ctx.event == HookEvent::BeforeToolCall {
                        return Err(reason);
                    }
                    // For non-blocking hooks, log and continue
                    tracing::warn!(
                        event = ?ctx.event,
                        agent = ctx.agent_name,
                        error = %reason,
                        "Hook handler returned error (non-blocking)"
                    );
                }
            }
        }
        Ok(())
    }

    /// Check if any handlers are registered for a given event.
    pub fn has_handlers(&self, event: HookEvent) -> bool {
        self.handlers
            .get(&event)
            .map(|v| !v.is_empty())
            .unwrap_or(false)
    }
}

impl Default for HookRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A test handler that always succeeds.
    struct OkHandler;
    impl HookHandler for OkHandler {
        fn on_event(&self, _ctx: &HookContext) -> Result<(), String> {
            Ok(())
        }
    }

    /// A test handler that always blocks.
    struct BlockHandler {
        reason: String,
    }
    impl HookHandler for BlockHandler {
        fn on_event(&self, _ctx: &HookContext) -> Result<(), String> {
            Err(self.reason.clone())
        }
    }

    /// A test handler that records calls.
    struct RecordHandler {
        calls: std::sync::Mutex<Vec<String>>,
    }
    impl RecordHandler {
        fn new() -> Self {
            Self {
                calls: std::sync::Mutex::new(Vec::new()),
            }
        }
        fn call_count(&self) -> usize {
            self.calls.lock().unwrap().len()
        }
    }
    impl HookHandler for RecordHandler {
        fn on_event(&self, ctx: &HookContext) -> Result<(), String> {
            self.calls.lock().unwrap().push(format!("{:?}", ctx.event));
            Ok(())
        }
    }

    fn make_ctx(event: HookEvent) -> HookContext<'static> {
        HookContext {
            agent_name: "test-agent",
            agent_id: "abc-123",
            event,
            data: serde_json::json!({}),
        }
    }

    #[test]
    fn test_empty_registry_is_noop() {
        let registry = HookRegistry::new();
        let ctx = make_ctx(HookEvent::BeforeToolCall);
        assert!(registry.fire(&ctx).is_ok());
    }

    #[test]
    fn test_before_tool_call_can_block() {
        let registry = HookRegistry::new();
        registry.register(
            HookEvent::BeforeToolCall,
            Arc::new(BlockHandler {
                reason: "Not allowed".to_string(),
            }),
        );
        let ctx = make_ctx(HookEvent::BeforeToolCall);
        let result = registry.fire(&ctx);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Not allowed");
    }

    #[test]
    fn test_after_tool_call_receives_result() {
        let recorder = Arc::new(RecordHandler::new());
        let registry = HookRegistry::new();
        registry.register(HookEvent::AfterToolCall, recorder.clone());

        let ctx = HookContext {
            agent_name: "test-agent",
            agent_id: "abc-123",
            event: HookEvent::AfterToolCall,
            data: serde_json::json!({"tool_name": "file_read", "result": "ok"}),
        };
        assert!(registry.fire(&ctx).is_ok());
        assert_eq!(recorder.call_count(), 1);
    }

    #[test]
    fn test_multiple_handlers_all_fire() {
        let r1 = Arc::new(RecordHandler::new());
        let r2 = Arc::new(RecordHandler::new());
        let registry = HookRegistry::new();
        registry.register(HookEvent::AgentLoopEnd, r1.clone());
        registry.register(HookEvent::AgentLoopEnd, r2.clone());

        let ctx = make_ctx(HookEvent::AgentLoopEnd);
        assert!(registry.fire(&ctx).is_ok());
        assert_eq!(r1.call_count(), 1);
        assert_eq!(r2.call_count(), 1);
    }

    #[test]
    fn test_hook_errors_dont_crash_non_blocking() {
        let registry = HookRegistry::new();
        // Register a blocking handler for a non-blocking event
        registry.register(
            HookEvent::AfterToolCall,
            Arc::new(BlockHandler {
                reason: "oops".to_string(),
            }),
        );
        let ctx = make_ctx(HookEvent::AfterToolCall);
        // AfterToolCall is non-blocking, so error should be swallowed
        assert!(registry.fire(&ctx).is_ok());
    }

    #[test]
    fn test_all_four_events_fire() {
        let recorder = Arc::new(RecordHandler::new());
        let registry = HookRegistry::new();
        registry.register(HookEvent::BeforeToolCall, recorder.clone());
        registry.register(HookEvent::AfterToolCall, recorder.clone());
        registry.register(HookEvent::BeforePromptBuild, recorder.clone());
        registry.register(HookEvent::AgentLoopEnd, recorder.clone());

        for event in [
            HookEvent::BeforeToolCall,
            HookEvent::AfterToolCall,
            HookEvent::BeforePromptBuild,
            HookEvent::AgentLoopEnd,
        ] {
            let ctx = make_ctx(event);
            let _ = registry.fire(&ctx);
        }
        assert_eq!(recorder.call_count(), 4);
    }

    #[test]
    fn test_has_handlers() {
        let registry = HookRegistry::new();
        assert!(!registry.has_handlers(HookEvent::BeforeToolCall));
        registry.register(HookEvent::BeforeToolCall, Arc::new(OkHandler));
        assert!(registry.has_handlers(HookEvent::BeforeToolCall));
        assert!(!registry.has_handlers(HookEvent::AfterToolCall));
    }
}

```

### Core Architecture Module: `crates/openfang-runtime/src/loop_guard.rs`
```
//! Tool loop detection for the agent execution loop.
//!
//! Tracks tool calls within a single agent loop execution using SHA-256
//! hashes of `(tool_name, serialized_params)`. Detects when the agent is
//! stuck calling the same tool repeatedly and provides graduated responses:
//! warn, block, or circuit-break the entire loop.
//!
//! Enhanced features beyond basic hash-counting:
//! - **Outcome-aware detection**: tracks result hashes so identical call+result
//!   pairs escalate faster than just repeated calls.
//! - **Ping-pong detection**: identifies A-B-A-B or A-B-C-A-B-C alternating
//!   patterns that evade single-hash counting.
//! - **Poll tool handling**: relaxed thresholds for tools expected to be called
//!   repeatedly (e.g. `shell_exec` status checks).
//! - **Backoff suggestions**: recommends increasing wait times for polling.
//! - **Warning bucket**: prevents spam by upgrading to Block after repeated
//!   warnings for the same call.
//! - **Statistics snapshot**: exposes internal state for debugging and API.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};

/// Tools that are expected to be polled repeatedly.
const POLL_TOOLS: &[&str] = &[
    "shell_exec", // checking command output
];

/// Maximum recent call history size for ping-pong detection.
const HISTORY_SIZE: usize = 30;

/// Backoff schedule in milliseconds for polling tools.
const BACKOFF_SCHEDULE_MS: &[u64] = &[5000, 10000, 30000, 60000];

/// Configuration for the loop guard.
#[derive(Debug, Clone)]
pub struct LoopGuardConfig {
    /// Number of identical calls before a warning is appended.
    pub warn_threshold: u32,
    /// Number of identical calls before the call is blocked.
    pub block_threshold: u32,
    /// Total tool calls across all tools before circuit-breaking.
    pub global_circuit_breaker: u32,
    /// Multiplier for poll tool thresholds (poll tools get thresholds * this).
    pub poll_multiplier: u32,
    /// Number of identical outcome pairs before a warning.
    pub outcome_warn_threshold: u32,
    /// Number of identical outcome pairs before the next call is auto-blocked.
    pub outcome_block_threshold: u32,
    /// Minimum repeats of a ping-pong pattern before blocking.
    pub ping_pong_min_repeats: u32,
    /// Max warnings per unique tool call hash before upgrading to Block.
    pub max_warnings_per_call: u32,
}

impl Default for LoopGuardConfig {
    fn default() -> Self {
        Self {
            warn_threshold: 3,
            block_threshold: 5,
            global_circuit_breaker: 30,
            poll_multiplier: 3,
            outcome_warn_threshold: 2,
            outcome_block_threshold: 3,
            ping_pong_min_repeats: 3,
            max_warnings_per_call: 3,
        }
    }
}

/// Verdict from the loop guard on whether a tool call should proceed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LoopGuardVerdict {
    /// Proceed normally.
    Allow,
    /// Proceed, but append a warning to the tool result.
    Warn(String),
    /// Block this specific tool call (skip execution).
    Block(String),
    /// Circuit-break the entire agent loop.
    CircuitBreak(String),
}

/// Snapshot of the loop guard state (for debugging/API).
#[derive(Debug, Clone, Serialize)]
pub struct LoopGuardStats {
    /// Total tool calls made in this loop execution.
    pub total_calls: u32,
    /// Number of unique (tool_name + params) combinations seen.
    pub unique_calls: u32,
    /// Number of calls that were blocked.
    pub blocked_calls: u32,
    /// Whether a ping-pong pattern has been detected.
    pub ping_pong_detected: bool,
    /// The tool name that has been repeated the most (if any).
    pub most_repeated_tool: Option<String>,
    /// The count of the most repeated tool call.
    pub most_repeated_count: u32,
}

/// Tracks tool calls within a single agent loop to detect loops.
pub struct LoopGuard {
    config: LoopGuardConfig,
    /// Count of identical (tool_name + params) calls, keyed by SHA-256 hex hash.
    call_counts: HashMap<String, u32>,
    /// Total tool calls in this loop execution.
    total_calls: u32,
    /// Count of identical (tool_call_hash + result_hash) pairs.
    outcome_counts: HashMap<String, u32>,
    /// Call hashes that are blocked due to repeated identical outcomes.
    blocked_outcomes: HashSet<String>,
    /// Recent tool call hashes (ring buffer of last HISTORY_SIZE).
    recent_calls: Vec<String>,
    /// Warnings already emitted (to prevent spam). Key = call hash, value = count emitted.
    warnings_emitted: HashMap<String, u32>,
    /// Tracks poll counts per command hash for backoff suggestions.
    poll_counts: HashMap<String, u32>,
    /// Total calls that were blocked.
    blocked_calls: u32,
    /// Map from call hash to tool name (for stats reporting).
    hash_to_tool: HashMap<String, String>,
}

impl LoopGuard {
    /// Create a new loop guard with the given configuration.
    pub fn new(config: LoopGuardConfig) -> Self {
        Self {
            config,
            call_counts: HashMap::new(),
            total_calls: 0,
            outcome_counts: HashMap::new(),
            blocked_outcomes: HashSet::new(),
            recent_calls: Vec::with_capacity(HISTORY_SIZE),
            warnings_emitted: HashMap::new(),
            poll_counts: HashMap::new(),
            blocked_calls: 0,
            hash_to_tool: HashMap::new(),
        }
    }

    /// Check whether a tool call should proceed.
    ///
    /// Returns a verdict indicating whether to allow, warn, block, or
    /// circuit-break. The caller should act on the verdict before executing
    /// the tool.
    pub fn check(&mut self, tool_name: &str, params: &serde_json::Value) -> LoopGuardVerdict {
        self.total_calls += 1;

        // Global circuit breaker
        if self.total_calls > self.config.global_circuit_breaker {
            self.blocked_calls += 1;
            return LoopGuardVerdict::CircuitBreak(format!(
                "Circuit breaker: exceeded {} total tool calls in this loop. \
                 The agent appears to be stuck.",
                self.config.global_circuit_breaker
            ));
        }

        let hash = Self::compute_hash(tool_name, params);
        self.hash_to_tool
            .entry(hash.clone())
            .or_insert_with(|| tool_name.to_string());

        // Track recent calls for ping-pong detection
        if self.recent_calls.len() >= HISTORY_SIZE {
            self.recent_calls.remove(0);
        }
        self.recent_calls.push(hash.clone());

        // Check if this call hash was blocked by outcome detection
        if self.blocked_outcomes.contains(&hash) {
            self.blocked_calls += 1;
            return LoopGuardVerdict::Block(format!(
                "Blocked: tool '{}' is returning identical results repeatedly. \
                 The current approach is not working — try something different.",
                tool_name
            ));
        }

        let count = self.call_counts.entry(hash.clone()).or_insert(0);
        *count += 1;
        let count_val = *count;

        // Determine effective thresholds (poll tools get relaxed thresholds)
        let is_poll = Self::is_poll_call(tool_name, params);
        let multiplier = if is_poll {
            self.config.poll_multiplier
        } else {
            1
        };
        let effective_warn = self.config.warn_threshold * multiplier;
        let effective_block = self.config.block_threshold * multiplier;

        // Check per-hash thresholds
        if count_val >= effective_block {
            self.blocked_calls += 1;
            return LoopGuardVerdict::Block(format!(
                "Blocked: tool '{}' called {} times with identical parameters. \
                 Try a different approach or different parameters.",
                tool_name, count_val
            ));
        }

        if count_val >= effective_warn {
            // Warning bucket: check if we've already warned too many times
            let warning_count = self.warnings_emitted.entry(hash.clone()).or_insert(0);
            *warning_count += 1;
            if *warning_count > self.config.max_warnings_per_call {
                // Upgrade to block after too many warnings
                self.blocked_calls += 1;
                return LoopGuardVerdict::Block(format!(
                    "Blocked: tool '{}' called {} times with identical parameters \
                     (warnings exhausted). Try a different approach.",
                    tool_name, count_val
                ));
            }
            return LoopGuardVerdict::Warn(format!(
                "Warning: tool '{}' has been called {} times with identical parameters. \
                 Consider a different approach.",
                tool_name, count_val
            ));
        }

        // Ping-pong detection (runs even if individual hash counts are low)
        if let Some(ping_pong_msg) = self.detect_ping_pong() {
            // Count how many full pattern repeats we have
            let repeats = self.count_ping_pong_repeats();
            if repeats >= self.config.ping_pong_min_repeats {
                self.blocked_calls += 1;
                return LoopGuardVerdict::Block(ping_pong_msg);
            }
            // Below min_repeats, just warn
            let warning_count = self
                .warnings_emitted
                .entry(format!("pingpong_{}", hash))
                .or_insert(0);
            *warning_count += 1;
            if *warning_count <= self.config.max_warnings_per_call {
                return LoopGuardVerdict::Warn(ping_pong_msg);
            }
        }

        LoopGuardVerdict::Allow
    }

    /// Record the outcome of a tool call. Call this AFTER tool execution.
    ///
    /// Hashes `(tool_name | params_json | result_truncated)` and tracks how
    /// many times an identical call produces an identical result. Returns a
    /// warning string if outcome repeti
```

### Core Architecture Module: `crates/openfang-runtime/src/str_utils.rs`
```
//! UTF-8-safe string utilities.

/// Truncate a string to at most `max_bytes` bytes without splitting a multi-byte
/// character.  Returns the full string when it already fits.
///
/// This avoids panics that occur when using `&s[..max_bytes]` on strings containing
/// multi-byte characters (e.g. Chinese, emoji, accented Latin).
#[inline]
pub fn safe_truncate_str(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    // Walk backwards to the nearest char boundary
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_within_limit() {
        let s = "hello";
        assert_eq!(safe_truncate_str(s, 10), "hello");
    }

    #[test]
    fn ascii_exact_limit() {
        let s = "hello";
        assert_eq!(safe_truncate_str(s, 5), "hello");
    }

    #[test]
    fn ascii_truncated() {
        let s = "hello world";
        assert_eq!(safe_truncate_str(s, 5), "hello");
    }

    #[test]
    fn multibyte_chinese() {
        // Each Chinese character is 3 bytes in UTF-8
        let s = "\u{4f60}\u{597d}\u{4e16}\u{754c}"; // "hello world" in Chinese, 12 bytes
                                                    // Truncating at 7 bytes should not split the 3rd char (bytes 6..9)
        let t = safe_truncate_str(s, 7);
        assert_eq!(t, "\u{4f60}\u{597d}"); // 6 bytes, 2 chars
        assert!(t.len() <= 7);
    }

    #[test]
    fn multibyte_emoji() {
        let s = "\u{1f600}\u{1f601}\u{1f602}"; // 3 emoji, 4 bytes each = 12 bytes
        let t = safe_truncate_str(s, 5);
        assert_eq!(t, "\u{1f600}"); // 4 bytes, 1 emoji
    }

    #[test]
    fn zero_limit() {
        let s = "hello";
        assert_eq!(safe_truncate_str(s, 0), "");
    }

    #[test]
    fn empty_string() {
        assert_eq!(safe_truncate_str("", 10), "");
    }
}

```

### Core Architecture Module: `crates/openfang-types/src/webhook.rs`
```
//! Webhook trigger types for system event injection and isolated agent turns.

use serde::{Deserialize, Serialize};

/// Wake mode for system event injection.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WakeMode {
    /// Trigger immediate processing.
    #[default]
    Now,
    /// Defer until the next heartbeat cycle.
    NextHeartbeat,
}

/// Payload for POST /hooks/wake — inject a system event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WakePayload {
    /// Event text to inject (max 4096 chars).
    pub text: String,
    /// When to process the event.
    #[serde(default)]
    pub mode: WakeMode,
}

/// Payload for POST /hooks/agent — run an isolated agent turn.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHookPayload {
    /// Message to send to the agent (max 16384 chars).
    pub message: String,
    /// Target agent (by name or ID). None = default agent.
    #[serde(default)]
    pub agent: Option<String>,
    /// Whether to deliver response to a channel.
    #[serde(default)]
    pub deliver: bool,
    /// Target channel for delivery.
    #[serde(default)]
    pub channel: Option<String>,
    /// Model override.
    #[serde(default)]
    pub model: Option<String>,
    /// Timeout in seconds (default 120, max 600).
    #[serde(default = "default_hook_timeout")]
    pub timeout_secs: u64,
}

fn default_hook_timeout() -> u64 {
    120
}

/// Maximum length for wake event text.
const MAX_WAKE_TEXT: usize = 4096;
/// Maximum length for agent hook message.
const MAX_AGENT_MESSAGE: usize = 16384;
/// Minimum timeout in seconds.
const MIN_TIMEOUT_SECS: u64 = 10;
/// Maximum timeout in seconds.
const MAX_TIMEOUT_SECS: u64 = 600;
/// Maximum channel name length.
const MAX_CHANNEL_NAME: usize = 64;

/// Returns true if the character is a control character other than newline.
fn is_forbidden_control(c: char) -> bool {
    c.is_control() && c != '\n'
}

impl WakePayload {
    /// Validate the wake payload.
    ///
    /// - `text` must be non-empty.
    /// - `text` must not exceed 4096 characters.
    /// - `text` must not contain control characters other than newline.
    pub fn validate(&self) -> Result<(), String> {
        if self.text.is_empty() {
            return Err("text must not be empty".to_string());
        }
        if self.text.len() > MAX_WAKE_TEXT {
            return Err(format!(
                "text exceeds maximum length of {} chars (got {})",
                MAX_WAKE_TEXT,
                self.text.len()
            ));
        }
        if let Some(pos) = self.text.find(is_forbidden_control) {
            let c = self.text[pos..].chars().next().unwrap();
            return Err(format!(
                "text contains forbidden control character U+{:04X} at byte offset {}",
                c as u32, pos
            ));
        }
        Ok(())
    }
}

impl AgentHookPayload {
    /// Validate the agent hook payload.
    ///
    /// - `message` must be non-empty.
    /// - `message` must not exceed 16384 characters.
    /// - `timeout_secs` must be between 10 and 600 inclusive.
    /// - `channel`, if present, must not exceed 64 characters.
    pub fn validate(&self) -> Result<(), String> {
        if self.message.is_empty() {
            return Err("message must not be empty".to_string());
        }
        if self.message.len() > MAX_AGENT_MESSAGE {
            return Err(format!(
                "message exceeds maximum length of {} chars (got {})",
                MAX_AGENT_MESSAGE,
                self.message.len()
            ));
        }
        if self.timeout_secs < MIN_TIMEOUT_SECS || self.timeout_secs > MAX_TIMEOUT_SECS {
            return Err(format!(
                "timeout_secs must be between {} and {} (got {})",
                MIN_TIMEOUT_SECS, MAX_TIMEOUT_SECS, self.timeout_secs
            ));
        }
        if let Some(ref ch) = self.channel {
            if ch.len() > MAX_CHANNEL_NAME {
                return Err(format!(
                    "channel name exceeds maximum length of {} chars (got {})",
                    MAX_CHANNEL_NAME,
                    ch.len()
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── WakePayload validation ──────────────────────────────────────

    #[test]
    fn wake_valid_simple() {
        let p = WakePayload {
            text: "deploy complete".to_string(),
            mode: WakeMode::Now,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn wake_valid_with_newlines() {
        let p = WakePayload {
            text: "line one\nline two\nline three".to_string(),
            mode: WakeMode::NextHeartbeat,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn wake_empty_text() {
        let p = WakePayload {
            text: String::new(),
            mode: WakeMode::Now,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("must not be empty"), "got: {err}");
    }

    #[test]
    fn wake_text_too_long() {
        let p = WakePayload {
            text: "x".repeat(4097),
            mode: WakeMode::Now,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("exceeds maximum length"), "got: {err}");
    }

    #[test]
    fn wake_text_exactly_max() {
        let p = WakePayload {
            text: "a".repeat(4096),
            mode: WakeMode::Now,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn wake_control_char_rejected() {
        let p = WakePayload {
            text: "hello\x00world".to_string(),
            mode: WakeMode::Now,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("control character"), "got: {err}");
    }

    #[test]
    fn wake_tab_rejected() {
        let p = WakePayload {
            text: "col1\tcol2".to_string(),
            mode: WakeMode::Now,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("control character"), "got: {err}");
    }

    // ── AgentHookPayload validation ─────────────────────────────────

    #[test]
    fn agent_hook_valid_minimal() {
        let p = AgentHookPayload {
            message: "summarize today's logs".to_string(),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 120,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn agent_hook_valid_full() {
        let p = AgentHookPayload {
            message: "deploy staging".to_string(),
            agent: Some("devops-lead".to_string()),
            deliver: true,
            channel: Some("slack-ops".to_string()),
            model: Some("claude-sonnet-4-20250514".to_string()),
            timeout_secs: 300,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn agent_hook_empty_message() {
        let p = AgentHookPayload {
            message: String::new(),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 120,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("must not be empty"), "got: {err}");
    }

    #[test]
    fn agent_hook_message_too_long() {
        let p = AgentHookPayload {
            message: "m".repeat(16385),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 120,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("exceeds maximum length"), "got: {err}");
    }

    #[test]
    fn agent_hook_message_exactly_max() {
        let p = AgentHookPayload {
            message: "m".repeat(16384),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 120,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn agent_hook_timeout_too_low() {
        let p = AgentHookPayload {
            message: "hello".to_string(),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 5,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("timeout_secs must be between"), "got: {err}");
    }

    #[test]
    fn agent_hook_timeout_too_high() {
        let p = AgentHookPayload {
            message: "hello".to_string(),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 601,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("timeout_secs must be between"), "got: {err}");
    }

    #[test]
    fn agent_hook_timeout_boundary_min() {
        let p = AgentHookPayload {
            message: "hello".to_string(),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 10,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn agent_hook_timeout_boundary_max() {
        let p = AgentHookPayload {
            message: "hello".to_string(),
            agent: None,
            deliver: false,
            channel: None,
            model: None,
            timeout_secs: 600,
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn agent_hook_channel_too_long() {
        let p = AgentHookPayload {
            message: "hello".to_string(),
            agent: None,
            deliver: true,
            channel: Some("c".repeat(65)),
            model: None,
            timeout_secs: 120,
        };
        let err = p.validate().unwrap_err();
        assert!(err.contains("channel name exceeds"), "got: {err}");
    }

    #[test]
    fn agent_hook_channel_exactly_max() {
        l
```

### Core Architecture Module: `agents/langchain-code-reviewer/agent.py`
```
"""
LangChain Code Review Agent — core review logic.

Supports OpenAI, Ollama, and any LangChain-compatible LLM.
"""

import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

SYSTEM_PROMPT = """\
You are a principal-level code reviewer with 15+ years of production experience \
across multiple languages (Python, Rust, TypeScript, Java, Go, C/C++).
You receive code snippets, diffs, or pull request descriptions and produce a \
structured, actionable review report.

You MUST respond in **中文**, but keep code snippets, variable names, and \
technical terms in their original language.

# ── 审核维度（按优先级排序） ──────────────────────────────

## 1. 正确性 (Correctness)
- 逻辑错误、off-by-one、边界条件
- 空指针 / None / undefined 未处理
- 错误处理不完整（吞异常、漏 catch、panic 路径）
- 并发问题：竞态条件、死锁、数据竞争
- 类型安全：隐式转换、溢出、精度丢失
- 资源泄漏：未关闭的文件/连接/锁

## 2. 安全性 (Security)
- SQL / NoSQL / OS 命令注入
- XSS、CSRF、SSRF
- 硬编码密钥、token、密码
- 不安全的反序列化
- 路径穿越（Path Traversal）
- 缺少输入校验 / 输出编码
- 权限检查缺失或绕过
- 敏感数据明文日志

## 3. 性能 (Performance)
- 算法复杂度不合理（O(n²) 可优化为 O(n)）
- 不必要的内存分配 / 拷贝
- N+1 查询、缺少批量操作
- 阻塞 I/O 在异步上下文中
- 缺少缓存 / 索引
- 热路径上的正则编译 / 反射

## 4. 可维护性 (Maintainability)
- 命名不清晰、缩写歧义
- 函数过长（>50行建议拆分）
- 重复代码（DRY 违反）
- 职责不单一（SRP 违反）
- 缺少必要注释（复杂业务逻辑、非显而易见的决策）
- 魔法数字 / 字符串
- 耦合过紧、依赖方向不合理

## 5. 测试 (Testing)
- 关键路径缺少单元测试
- 测试覆盖了 happy path 但遗漏了 edge case
- 测试中有硬编码依赖（时间、文件路径、网络）
- Mock 过度导致测试失去意义

## 6. 风格 (Style)
- 不符合语言惯例（Pythonic、Rust idiom 等）
- 格式不一致（应由 formatter 处理的除外）
- 不必要的复杂写法

# ── 严重级别 ──────────────────────────────────────────

| 级别 | 含义 | 是否阻塞合并 |
|------|------|-------------|
| 🔴 **[必须修复]** | 存在 bug、安全漏洞或数据丢失风险 | 是 |
| 🟡 **[建议修复]** | 不影响功能但会影响可维护性或性能 | 否，但强烈建议 |
| 🔵 **[小建议]** | 风格、命名等微小改进 | 否 |
| 🟢 **[亮点]** | 写得好的地方，值得肯定 | — |

# ── 输出格式 ──────────────────────────────────────────

严格按以下 Markdown 格式输出：

```
## 📋 总结
**结论**: [✅ 通过 / ⚠️ 需要修改 / 💬 仅评论]
**概述**: [1-2 句话总体评价]
**发现统计**: 🔴 X 个必须修复 | 🟡 X 个建议修复 | 🔵 X 个小建议 | 🟢 X 个亮点

---

## 🔍 详细发现

### 🔴 [必须修复] 问题标题
- **位置**: `文件名` 第 X-Y 行
- **问题**: 具体描述
- **原因**: 为什么这是个问题，可能造成什么后果
- **修复建议**:
（给出修复后的代码）

### 🟡 [建议修复] 问题标题
...

### 🔵 [小建议] 问题标题
...

### 🟢 [亮点] 优点标题
- **位置**: `文件名` 第 X-Y 行
- **说明**: 为什么这段代码写得好

---

## 📊 评分
| 维度 | 分数 | 说明 |
|------|------|------|
| 正确性 | X/10 | 一句话说明 |
| 安全性 | X/10 | 一句话说明 |
| 性能 | X/10 | 一句话说明 |
| 可维护性 | X/10 | 一句话说明 |
| 测试 | X/10 | 一句话说明 |
| **综合** | **X/10** | 一句话总结 |
```

# ── 审核原则 ──────────────────────────────────────────

1. **先肯定，再指出问题** — 不要只挑毛病，好的代码也要指出来
2. **解释 WHY，不仅是 WHAT** — 每个问题都要说清楚「为什么不好」和「可能导致什么后果」
3. **给出具体修复代码** — 不要只说"这里有问题"，要给出改好后的写法
4. **区分严重级别** — 不要把小问题标成必须修复，也不要把严重 bug 标成小建议
5. **尊重作者** — 用建设性的语气，避免 "这是错的" 这种措辞，用 "这里可以改进为..."
6. **不纠结格式** — 如果项目有 formatter/linter，格式问题跳过
7. **关注变更本身** — 如果是 diff，只审核变更的部分，不要评论未修改的代码
8. **没有代码时** — 直接要求提交代码，不要编造审核结果"""


def _build_llm():
    """Build the LLM based on environment configuration."""
    use_ollama = os.getenv("USE_OLLAMA", "").lower() in ("1", "true", "yes")

    if use_ollama:
        from langchain_ollama import ChatOllama
        model = os.getenv("OLLAMA_MODEL", "qwen2.5")
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        return ChatOllama(model=model, base_url=base_url, temperature=0.2)

    provider = os.getenv("LLM_PROVIDER", "openai").lower()

    if provider == "deepseek":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            temperature=0.2,
            max_tokens=4096,
        )

    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0.2,
        max_tokens=4096,
    )


class CodeReviewAgent:
    """LangChain-based code review agent."""

    def __init__(self):
        self.llm = _build_llm()
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", "{input}"),
        ])
        self.chain = self.prompt | self.llm | StrOutputParser()

    def review(self, code_or_diff: str) -> str:
        """
        Review the given code or diff.

        Args:
            code_or_diff: Source code, git diff, or PR description to review.

        Returns:
            Structured review report as markdown text.
        """
        if not code_or_diff.strip():
            return "No code provided. Please submit code or a diff to review."

        return self.chain.invoke({"input": code_or_diff})

```

### Core Architecture Module: `agents/langchain-code-reviewer/server.py`
```
"""
LangChain Code Review Agent — A2A-compatible server.

Exposes a code review agent via Google's A2A protocol so that
OpenFang workflows can call it as an external agent.

Start:
    OPENAI_API_KEY=sk-xxx python server.py
    # or with Ollama (no key needed):
    USE_OLLAMA=1 python server.py

Endpoints:
    GET  /.well-known/agent.json   — A2A Agent Card
    POST /a2a                      — JSON-RPC task endpoint
"""

import os
import uuid
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

from agent import CodeReviewAgent

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "9100"))
BASE_URL = os.getenv("BASE_URL", f"http://127.0.0.1:{PORT}")

app = FastAPI(title="LangChain Code Review Agent")
agent = CodeReviewAgent()

# In-memory task store
tasks: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# A2A Agent Card
# ---------------------------------------------------------------------------

AGENT_CARD = {
    "name": "langchain-code-reviewer",
    "description": (
        "LangChain-powered code review agent. "
        "Analyzes code for bugs, security issues, performance problems, "
        "and style violations. Returns structured review with severity levels."
    ),
    "url": f"{BASE_URL}/a2a",
    "version": "0.1.0",
    "capabilities": {
        "streaming": False,
        "pushNotifications": False,
        "stateTransitionHistory": True,
    },
    "skills": [
        {
            "id": "code-review",
            "name": "Code Review",
            "description": "Review code for correctness, security, performance, and style",
            "tags": ["code", "review", "security", "quality"],
            "examples": [
                "Review this Python function for bugs",
                "Check this Rust code for security issues",
                "Analyze this PR diff for performance problems",
            ],
        },
        {
            "id": "pr-review",
            "name": "Pull Request Review",
            "description": "Review a git diff / pull request",
            "tags": ["pr", "diff", "git"],
            "examples": [
                "Review this PR diff",
                "Analyze these changes",
            ],
        },
    ],
    "defaultInputModes": ["text"],
    "defaultOutputModes": ["text"],
}


@app.get("/.well-known/agent.json")
async def agent_card():
    return JSONResponse(content=AGENT_CARD)


# ---------------------------------------------------------------------------
# A2A JSON-RPC Endpoint
# ---------------------------------------------------------------------------


@app.post("/a2a")
async def a2a_endpoint(request: Request):
    body = await request.json()

    jsonrpc = body.get("jsonrpc", "2.0")
    req_id = body.get("id", 1)
    method = body.get("method", "")
    params = body.get("params", {})

    if method == "tasks/send":
        return await handle_tasks_send(jsonrpc, req_id, params)
    elif method == "tasks/get":
        return handle_tasks_get(jsonrpc, req_id, params)
    elif method == "tasks/cancel":
        return handle_tasks_cancel(jsonrpc, req_id, params)
    else:
        return JSONResponse(content={
            "jsonrpc": jsonrpc,
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        })


async def handle_tasks_send(jsonrpc: str, req_id: int, params: dict):
    message = params.get("message", {})
    session_id = params.get("sessionId")
    task_id = str(uuid.uuid4())

    text_parts = [
        p["text"] for p in message.get("parts", []) if p.get("type") == "text"
    ]
    user_input = "\n".join(text_parts)

    task = {
        "id": task_id,
        "sessionId": session_id,
        "status": {"state": "working", "message": None},
        "messages": [message],
        "artifacts": [],
    }
    tasks[task_id] = task

    try:
        review_result = await asyncio.to_thread(agent.review, user_input)

        agent_message = {
            "role": "agent",
            "parts": [{"type": "text", "text": review_result}],
        }
        task["messages"].append(agent_message)
        task["status"] = {"state": "completed", "message": None}
        task["artifacts"] = [
            {
                "name": "code-review-report",
                "description": "Structured code review report",
                "parts": [{"type": "text", "text": review_result}],
                "index": 0,
                "lastChunk": True,
            }
        ]
    except Exception as e:
        task["status"] = {"state": "failed", "message": str(e)}
        task["messages"].append({
            "role": "agent",
            "parts": [{"type": "text", "text": f"Review failed: {e}"}],
        })

    return JSONResponse(content={
        "jsonrpc": jsonrpc,
        "id": req_id,
        "result": task,
    })


def handle_tasks_get(jsonrpc: str, req_id: int, params: dict):
    task_id = params.get("id", "")
    task = tasks.get(task_id)

    if task is None:
        return JSONResponse(content={
            "jsonrpc": jsonrpc,
            "id": req_id,
            "error": {"code": -32000, "message": f"Task not found: {task_id}"},
        })

    return JSONResponse(content={
        "jsonrpc": jsonrpc,
        "id": req_id,
        "result": task,
    })


def handle_tasks_cancel(jsonrpc: str, req_id: int, params: dict):
    task_id = params.get("id", "")
    task = tasks.get(task_id)

    if task is None:
        return JSONResponse(content={
            "jsonrpc": jsonrpc,
            "id": req_id,
            "error": {"code": -32000, "message": f"Task not found: {task_id}"},
        })

    task["status"] = {"state": "cancelled", "message": None}
    return JSONResponse(content={
        "jsonrpc": jsonrpc,
        "id": req_id,
        "result": task,
    })


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "agent": "langchain-code-reviewer", "tasks": len(tasks)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Starting LangChain Code Review Agent on {HOST}:{PORT}")
    print(f"Agent Card: {BASE_URL}/.well-known/agent.json")
    print(f"A2A endpoint: {BASE_URL}/a2a")
    uvicorn.run(app, host=HOST, port=PORT)

```

### Core Architecture Module: `crates/openfang-api/src/channel_bridge.rs`
```
//! Channel bridge wiring — connects the OpenFang kernel to channel adapters.
//!
//! Implements `ChannelBridgeHandle` on `OpenFangKernel` and provides the
//! `start_channel_bridge()` entry point called by the daemon.

use openfang_channels::bridge::{BridgeManager, ChannelBridgeHandle};
use openfang_channels::discord::DiscordAdapter;
use openfang_channels::email::EmailAdapter;
use openfang_channels::google_chat::GoogleChatAdapter;
use openfang_channels::irc::IrcAdapter;
use openfang_channels::matrix::MatrixAdapter;
use openfang_channels::mattermost::MattermostAdapter;
use openfang_channels::rocketchat::RocketChatAdapter;
use openfang_channels::router::AgentRouter;
use openfang_channels::signal::SignalAdapter;
use openfang_channels::slack::SlackAdapter;
use openfang_channels::teams::TeamsAdapter;
use openfang_channels::telegram::TelegramAdapter;
use openfang_channels::twitch::TwitchAdapter;
use openfang_channels::types::ChannelAdapter;
use openfang_channels::whatsapp::WhatsAppAdapter;
use openfang_channels::xmpp::XmppAdapter;
use openfang_channels::zulip::ZulipAdapter;
// Wave 3
use openfang_channels::bluesky::BlueskyAdapter;
use openfang_channels::feishu::FeishuAdapter;
use openfang_channels::line::LineAdapter;
use openfang_channels::mastodon::MastodonAdapter;
use openfang_channels::messenger::MessengerAdapter;
use openfang_channels::reddit::RedditAdapter;
use openfang_channels::revolt::RevoltAdapter;
use openfang_channels::viber::ViberAdapter;
use openfang_types::config::FeishuMode;
// Wave 4
use openfang_channels::flock::FlockAdapter;
use openfang_channels::guilded::GuildedAdapter;
use openfang_channels::keybase::KeybaseAdapter;
use openfang_channels::nextcloud::NextcloudAdapter;
use openfang_channels::nostr::NostrAdapter;
use openfang_channels::pumble::PumbleAdapter;
use openfang_channels::threema::ThreemaAdapter;
use openfang_channels::twist::TwistAdapter;
use openfang_channels::webex::WebexAdapter;
// Wave 5
use async_trait::async_trait;
use openfang_channels::dingtalk::DingTalkAdapter;
use openfang_channels::dingtalk_stream::DingTalkStreamAdapter;
use openfang_channels::discourse::DiscourseAdapter;
use openfang_channels::gitter::GitterAdapter;
use openfang_channels::gotify::GotifyAdapter;
use openfang_channels::linkedin::LinkedInAdapter;
use openfang_channels::mqtt::MqttAdapter;
use openfang_channels::mumble::MumbleAdapter;
use openfang_channels::ntfy::NtfyAdapter;
use openfang_channels::webhook::WebhookAdapter;
use openfang_channels::wecom::WeComAdapter;
use openfang_kernel::OpenFangKernel;
use openfang_runtime::kernel_handle::KernelHandle;
use openfang_types::agent::AgentId;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{error, info, warn};

use openfang_runtime::str_utils::safe_truncate_str;

/// Wraps `OpenFangKernel` to implement `ChannelBridgeHandle`.
pub struct KernelBridgeAdapter {
    kernel: Arc<OpenFangKernel>,
    started_at: Instant,
}

#[async_trait]
impl ChannelBridgeHandle for KernelBridgeAdapter {
    async fn send_message(&self, agent_id: AgentId, message: &str) -> Result<String, String> {
        let result = self
            .kernel
            .send_message(agent_id, message)
            .await
            .map_err(|e| format!("{e}"))?;
        // Silent/NO_REPLY responses should not be forwarded to channels
        if result.silent {
            return Ok(String::new());
        }
        Ok(result.response)
    }

    async fn send_message_with_blocks(
        &self,
        agent_id: AgentId,
        blocks: Vec<openfang_types::message::ContentBlock>,
    ) -> Result<String, String> {
        // Extract text for the message parameter (used for memory recall / logging)
        let text: String = blocks
            .iter()
            .filter_map(|b| match b {
                openfang_types::message::ContentBlock::Text { text, .. } => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n");
        let text = if text.is_empty() {
            "[Image]".to_string()
        } else {
            text
        };
        let result = self
            .kernel
            .send_message_with_blocks(agent_id, &text, blocks)
            .await
            .map_err(|e| format!("{e}"))?;
        Ok(result.response)
    }

    async fn find_agent_by_name(&self, name: &str) -> Result<Option<AgentId>, String> {
        Ok(self.kernel.registry.find_by_name(name).map(|e| e.id))
    }

    async fn list_agents(&self) -> Result<Vec<(AgentId, String)>, String> {
        Ok(self
            .kernel
            .registry
            .list()
            .iter()
            .map(|e| (e.id, e.name.clone()))
            .collect())
    }

    async fn spawn_agent_by_name(&self, manifest_name: &str) -> Result<AgentId, String> {
        // Look for manifest at ~/.openfang/agents/{name}/agent.toml
        let manifest_path = self
            .kernel
            .config
            .home_dir
            .join("agents")
            .join(manifest_name)
            .join("agent.toml");

        if !manifest_path.exists() {
            return Err(format!("Manifest not found: {}", manifest_path.display()));
        }

        let contents = std::fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest: {e}"))?;

        let manifest: openfang_types::agent::AgentManifest =
            toml::from_str(&contents).map_err(|e| format!("Invalid manifest TOML: {e}"))?;

        let agent_id = self
            .kernel
            .spawn_agent(manifest)
            .map_err(|e| format!("Failed to spawn agent: {e}"))?;

        Ok(agent_id)
    }

    async fn uptime_info(&self) -> String {
        let uptime = self.started_at.elapsed();
        let agents = self.list_agents().await.unwrap_or_default();
        let secs = uptime.as_secs();
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        if hours > 0 {
            format!(
                "OpenFang status: {}h {}m uptime, {} agent(s)",
                hours,
                mins,
                agents.len()
            )
        } else {
            format!(
                "OpenFang status: {}m uptime, {} agent(s)",
                mins,
                agents.len()
            )
        }
    }

    async fn list_models_text(&self) -> String {
        let catalog = self
            .kernel
            .model_catalog
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let available = catalog.available_models();
        if available.is_empty() {
            return "No models available. Configure API keys to enable providers.".to_string();
        }
        let mut msg = format!("Available models ({}):\n", available.len());
        // Group by provider
        let mut by_provider: std::collections::HashMap<
            &str,
            Vec<&openfang_types::model_catalog::ModelCatalogEntry>,
        > = std::collections::HashMap::new();
        for m in &available {
            by_provider.entry(m.provider.as_str()).or_default().push(m);
        }
        let mut providers: Vec<&&str> = by_provider.keys().collect();
        providers.sort();
        for provider in providers {
            let provider_name = catalog
                .get_provider(provider)
                .map(|p| p.display_name.as_str())
                .unwrap_or(provider);
            msg.push_str(&format!("\n{}:\n", provider_name));
            for m in &by_provider[provider] {
                let cost = if m.input_cost_per_m > 0.0 {
                    format!(
                        " (${:.2}/${:.2} per M)",
                        m.input_cost_per_m, m.output_cost_per_m
                    )
                } else {
                    " (free/local)".to_string()
                };
                msg.push_str(&format!("  {} — {}{}\n", m.id, m.display_name, cost));
            }
        }
        msg
    }

    async fn list_providers_text(&self) -> String {
        let catalog = self
            .kernel
            .model_catalog
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let mut msg = "Providers:\n".to_string();
        for p in catalog.list_providers() {
            let status = match p.auth_status {
                openfang_types::model_catalog::AuthStatus::Configured => "configured",
                openfang_types::model_catalog::AuthStatus::Missing => "not configured",
                openfang_types::model_catalog::AuthStatus::NotRequired => "local (no key needed)",
            };
            msg.push_str(&format!(
                "  {} — {} [{}, {} model(s)]\n",
                p.id, p.display_name, status, p.model_count
            ));
        }
        msg
    }

    async fn list_skills_text(&self) -> String {
        let skills = self
            .kernel
            .skill_registry
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let skills = skills.list();
        if skills.is_empty() {
            return "No skills installed. Place skills in ~/.openfang/skills/ or install from the marketplace.".to_string();
        }
        let mut msg = format!("Installed skills ({}):\n", skills.len());
        for skill in &skills {
            let runtime = format!("{:?}", skill.manifest.runtime.runtime_type);
            let tools_count = skill.manifest.tools.provided.len();
            let enabled = if skill.enabled { "" } else { " [disabled]" };
            msg.push_str(&format!(
                "  {} — {} ({}, {} tool(s)){}\n",
                skill.manifest.skill.name,
                skill.manifest.skill.description,
                runtime,
                tools_count,
                enabled,
            ));
        }
        msg
    }

    async fn list_hands_text(&self) -> String {
        let defs = self.kernel.hand_registry.list_definitions();
        if defs.is_empty() {
            return "No hands available.".to_string();
        }
        let instanc
```

### Core Architecture Module: `crates/openfang-api/src/lib.rs`
```
//! HTTP/WebSocket API server for the OpenFang Agent OS daemon.
//!
//! Exposes agent management, status, and chat via JSON REST endpoints.
//! The kernel runs in-process; the CLI connects over HTTP.

/// Decode percent-encoded strings (e.g. `%2B` → `+`).
/// Used to normalise `?token=` values that browsers encode with `encodeURIComponent`.
pub(crate) fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                out.push(hi << 4 | lo);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| input.to_string())
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

pub mod channel_bridge;
pub mod middleware;
pub mod openai_compat;
pub mod rate_limiter;
pub mod routes;
pub mod server;
pub mod session_auth;
pub mod stream_chunker;
pub mod stream_dedup;
pub mod types;
pub mod webchat;
pub mod ws;

```

### Core Architecture Module: `crates/openfang-api/src/middleware.rs`
```
//! Production middleware for the OpenFang API server.
//!
//! Provides:
//! - Request ID generation and propagation
//! - Per-endpoint structured request logging
//! - In-memory rate limiting (per IP)

use axum::body::Body;
use axum::http::{Request, Response, StatusCode};
use axum::middleware::Next;
use std::time::Instant;
use tracing::info;

/// Request ID header name (standard).
pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Middleware: inject a unique request ID and log the request/response.
pub async fn request_logging(request: Request<Body>, next: Next) -> Response<Body> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let method = request.method().clone();
    let uri = request.uri().path().to_string();
    let start = Instant::now();

    let mut response = next.run(request).await;

    let elapsed = start.elapsed();
    let status = response.status().as_u16();

    info!(
        request_id = %request_id,
        method = %method,
        path = %uri,
        status = status,
        latency_ms = elapsed.as_millis() as u64,
        "API request"
    );

    // Inject the request ID into the response
    if let Ok(header_val) = request_id.parse() {
        response.headers_mut().insert(REQUEST_ID_HEADER, header_val);
    }

    response
}

/// Authentication state passed to the auth middleware.
#[derive(Clone)]
pub struct AuthState {
    pub api_key: String,
    pub auth_enabled: bool,
    pub session_secret: String,
    /// Set from `OPENFANG_ALLOW_NO_AUTH=1` to permit running without an api_key
    /// on a non-loopback bind. Off by default so empty keys fail closed.
    pub allow_no_auth: bool,
}

/// Bearer token authentication middleware.
///
/// When `api_key` is non-empty (after trimming), requests to non-public
/// endpoints must include `Authorization: Bearer <api_key>`.
///
/// When `api_key` is empty (no key configured) the server defaults to
/// fail-closed for any request that does NOT originate from loopback.
/// Loopback traffic (127.0.0.1 / ::1) is always allowed through with no
/// key so single-user local setups keep zero-config UX. To explicitly
/// run a no-auth server on a LAN/WAN address, set
/// `OPENFANG_ALLOW_NO_AUTH=1`; this opts out of fail-closed and is
/// reported loudly at startup.
///
/// When dashboard auth is enabled, session cookies are also accepted.
pub async fn auth(
    axum::extract::State(auth_state): axum::extract::State<AuthState>,
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    // SECURITY: Capture method early for method-aware public endpoint checks.
    let method = request.method().clone();

    let is_loopback = request
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip().is_loopback())
        .unwrap_or(false); // SECURITY: default-deny; unknown origin is NOT loopback

    // Shutdown is loopback-only (CLI on same machine). Skip token auth only
    // when the request is from loopback.
    let path = request.uri().path();
    if path == "/api/shutdown" && is_loopback {
        return next.run(request).await;
    }

    // Public endpoints that don't require auth (dashboard needs these).
    // SECURITY: /api/agents is GET-only (listing). POST (spawn) requires auth.
    // SECURITY: Public endpoints are GET-only unless explicitly noted.
    // POST/PUT/DELETE to any endpoint ALWAYS requires auth to prevent
    // unauthenticated writes (cron job creation, skill install, etc.).
    let is_get = method == axum::http::Method::GET;
    let is_public = path == "/"
        || path == "/logo.png"
        || path == "/favicon.ico"
        || (path == "/.well-known/agent.json" && is_get)
        || (path.starts_with("/a2a/") && is_get)
        || path == "/api/health"
        || path == "/api/health/detail"
        || path == "/api/status"
        || path == "/api/version"
        || (path == "/api/agents" && is_get)
        || (path == "/api/profiles" && is_get)
        || (path == "/api/config" && is_get)
        || (path == "/api/config/schema" && is_get)
        || (path.starts_with("/api/uploads/") && is_get)
        // Dashboard read endpoints — allow unauthenticated so the SPA can
        // render before the user enters their API key.
        || (path == "/api/models" && is_get)
        || (path == "/api/models/aliases" && is_get)
        || (path == "/api/providers" && is_get)
        || (path == "/api/budget" && is_get)
        || (path == "/api/budget/agents" && is_get)
        || (path.starts_with("/api/budget/agents/") && is_get)
        || (path == "/api/network/status" && is_get)
        || (path == "/api/a2a/agents" && is_get)
        || (path == "/api/approvals" && is_get)
        || (path.starts_with("/api/approvals/") && is_get)
        || (path == "/api/channels" && is_get)
        || (path == "/api/hands" && is_get)
        || (path == "/api/hands/active" && is_get)
        || (path.starts_with("/api/hands/") && is_get)
        || (path == "/api/skills" && is_get)
        || (path.starts_with("/api/skills/") && path.ends_with("/config") && is_get)
        || (path == "/api/sessions" && is_get)
        || (path == "/api/integrations" && is_get)
        || (path == "/api/integrations/available" && is_get)
        || (path == "/api/integrations/health" && is_get)
        || (path == "/api/workflows" && is_get)
        || path == "/api/logs/stream"  // SSE stream, read-only
        || (path.starts_with("/api/cron/") && is_get)
        || path.starts_with("/api/providers/github-copilot/oauth/")
        || path == "/api/auth/login"
        || path == "/api/auth/logout"
        || (path == "/api/auth/check" && is_get);

    if is_public {
        return next.run(request).await;
    }

    // If no API key configured and no dashboard login is active, fail closed
    // for anything that did not come from loopback. Opting out of this
    // behavior requires setting `OPENFANG_ALLOW_NO_AUTH=1`, which is logged
    // loudly at startup.
    //
    // See issue #1034 (B1/B2): empty api_key previously bypassed auth for
    // all origins, exposing agent config, channel tokens, and LLM keys on
    // any LAN-reachable bind.
    let api_key_trimmed = auth_state.api_key.trim().to_string();
    if api_key_trimmed.is_empty() && !auth_state.auth_enabled {
        if is_loopback || auth_state.allow_no_auth {
            return next.run(request).await;
        }
        return Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header("www-authenticate", "Bearer")
            .body(Body::from(
                serde_json::json!({
                    "error": "API key required for non-loopback requests. Set OPENFANG_API_KEY or bind to 127.0.0.1."
                })
                .to_string(),
            ))
            .unwrap_or_default();
    }
    let api_key = api_key_trimmed.as_str();

    // Check Authorization: Bearer <token> header, then fallback to X-API-Key
    let bearer_token = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    let api_token = bearer_token.or_else(|| {
        request
            .headers()
            .get("x-api-key")
            .and_then(|v| v.to_str().ok())
    });

    // SECURITY: Use constant-time comparison to prevent timing attacks.
    let header_auth = api_token.map(|token| {
        use subtle::ConstantTimeEq;
        if token.len() != api_key.len() {
            return false;
        }
        token.as_bytes().ct_eq(api_key.as_bytes()).into()
    });

    // Also check ?token= query parameter (for EventSource/SSE clients that
    // cannot set custom headers, same approach as WebSocket auth).
    let query_token_decoded = request
        .uri()
        .query()
        .and_then(|q| q.split('&').find_map(|pair| pair.strip_prefix("token=")))
        .map(crate::percent_decode);

    // SECURITY: Use constant-time comparison to prevent timing attacks.
    let query_auth = query_token_decoded.as_deref().map(|token| {
        use subtle::ConstantTimeEq;
        if token.len() != api_key.len() {
            return false;
        }
        token.as_bytes().ct_eq(api_key.as_bytes()).into()
    });

    // Accept if either auth method matches
    if header_auth == Some(true) || query_auth == Some(true) {
        return next.run(request).await;
    }

    // Check session cookie (dashboard login sessions)
    if auth_state.auth_enabled {
        if let Some(token) = crate::session_auth::extract_session_cookie(request.headers()) {
            if crate::session_auth::verify_session_token(&token, &auth_state.session_secret)
                .is_some()
            {
                return next.run(request).await;
            }
        }
    }

    // Determine error message: was a credential provided but wrong, or missing entirely?
    let credential_provided = header_auth.is_some() || query_auth.is_some();
    let error_msg = if credential_provided {
        "Invalid API key"
    } else {
        "Missing Authorization: Bearer <api_key> header"
    };

    Response::builder()
        .status(StatusCode::UNAUTHORIZED)
        .header("www-authenticate", "Bearer")
        .body(Body::from(
            serde_json::json!({"error": error_msg}).to_string(),
        ))
        .unwrap_or_default()
}

/// Security headers middleware — applied to ALL API responses.
pub async fn security_headers(request: Request<Body>, next: Next) -> Response<Body> {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert("x-content-type-options", "nosniff".parse().unwrap());
    headers.insert("x-frame-options", "DENY".parse().unwrap());
    headers.insert("x-xss-protection", "1; mode=block".parse().unwrap());
    // The dashboard handler (webchat_page) sets its own nonce-based CSP.
    // For all other responses (API endpoints), apply a strict default.
    if !headers.contai
```

### Core Architecture Module: `crates/openfang-api/src/openai_compat.rs`
```
//! OpenAI-compatible `/v1/chat/completions` API endpoint.
//!
//! Allows any OpenAI-compatible client library to talk to OpenFang agents.
//! The `model` field resolves to an agent (by name, UUID, or `openfang:<name>`),
//! and the messages are forwarded to the agent's LLM loop.
//!
//! Supports both streaming (SSE) and non-streaming responses.

use crate::routes::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::sse::{Event as SseEvent, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::Json;
use openfang_runtime::kernel_handle::KernelHandle;
use openfang_runtime::llm_driver::StreamEvent;
use openfang_types::agent::AgentId;
use openfang_types::message::{ContentBlock, Message, MessageContent, Role, StopReason};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use tracing::warn;

// ── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<OaiMessage>,
    #[serde(default)]
    pub stream: bool,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct OaiMessage {
    pub role: String,
    #[serde(default)]
    pub content: OaiContent,
}

#[derive(Debug, Deserialize, Default)]
#[serde(untagged)]
pub enum OaiContent {
    Text(String),
    Parts(Vec<OaiContentPart>),
    #[default]
    Null,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum OaiContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    ImageUrl { image_url: OaiImageUrlRef },
}

#[derive(Debug, Deserialize)]
pub struct OaiImageUrlRef {
    pub url: String,
}

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ChatCompletionResponse {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<Choice>,
    usage: UsageInfo,
}

#[derive(Serialize)]
struct Choice {
    index: u32,
    message: ChoiceMessage,
    finish_reason: &'static str,
}

#[derive(Serialize)]
struct ChoiceMessage {
    role: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OaiToolCall>>,
}

#[derive(Serialize)]
struct UsageInfo {
    prompt_tokens: u64,
    completion_tokens: u64,
    total_tokens: u64,
}

#[derive(Serialize)]
struct ChatCompletionChunk {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<ChunkChoice>,
}

#[derive(Serialize)]
struct ChunkChoice {
    index: u32,
    delta: ChunkDelta,
    finish_reason: Option<&'static str>,
}

#[derive(Serialize)]
struct ChunkDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OaiToolCall>>,
}

#[derive(Serialize, Clone)]
struct OaiToolCall {
    index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    call_type: Option<&'static str>,
    function: OaiToolCallFunction,
}

#[derive(Serialize, Clone)]
struct OaiToolCallFunction {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    arguments: Option<String>,
}

#[derive(Serialize)]
struct ModelObject {
    id: String,
    object: &'static str,
    created: u64,
    owned_by: String,
}

#[derive(Serialize)]
struct ModelListResponse {
    object: &'static str,
    data: Vec<ModelObject>,
}

// ── Agent resolution ────────────────────────────────────────────────────────

fn resolve_agent(state: &AppState, model: &str) -> Option<(AgentId, String)> {
    // 1. "openfang:<name>" → find agent by name
    if let Some(name) = model.strip_prefix("openfang:") {
        if let Some(entry) = state.kernel.registry.find_by_name(name) {
            return Some((entry.id, entry.name.clone()));
        }
    }

    // 2. Valid UUID → find agent by ID
    if let Ok(id) = model.parse::<AgentId>() {
        if let Some(entry) = state.kernel.registry.get(id) {
            return Some((entry.id, entry.name.clone()));
        }
    }

    // 3. Plain string → try as agent name
    if let Some(entry) = state.kernel.registry.find_by_name(model) {
        return Some((entry.id, entry.name.clone()));
    }

    // No match — return None so the caller returns a proper 404
    None
}

// ── Message conversion ──────────────────────────────────────────────────────

fn convert_messages(oai_messages: &[OaiMessage]) -> Vec<Message> {
    oai_messages
        .iter()
        .filter_map(|m| {
            let role = match m.role.as_str() {
                "user" => Role::User,
                "assistant" => Role::Assistant,
                "system" => Role::System,
                _ => Role::User,
            };

            let content = match &m.content {
                OaiContent::Text(text) => MessageContent::Text(text.clone()),
                OaiContent::Parts(parts) => {
                    let blocks: Vec<ContentBlock> = parts
                        .iter()
                        .filter_map(|part| match part {
                            OaiContentPart::Text { text } => Some(ContentBlock::Text {
                                text: text.clone(),
                                provider_metadata: None,
                            }),
                            OaiContentPart::ImageUrl { image_url } => {
                                // Parse data URI: data:{media_type};base64,{data}
                                if let Some(rest) = image_url.url.strip_prefix("data:") {
                                    let parts: Vec<&str> = rest.splitn(2, ',').collect();
                                    if parts.len() == 2 {
                                        let media_type = parts[0]
                                            .strip_suffix(";base64")
                                            .unwrap_or(parts[0])
                                            .to_string();
                                        let data = parts[1].to_string();
                                        Some(ContentBlock::Image { media_type, data })
                                    } else {
                                        None
                                    }
                                } else {
                                    // URL-based images not supported (would require fetching)
                                    None
                                }
                            }
                        })
                        .collect();
                    if blocks.is_empty() {
                        return None;
                    }
                    MessageContent::Blocks(blocks)
                }
                OaiContent::Null => return None,
            };

            Some(Message {
                msg_id: uuid::Uuid::new_v4().to_string(),
                provider_msg_id: None,
                role,
                content,
            })
        })
        .collect()
}

// ── Handlers ────────────────────────────────────────────────────────────────

/// POST /v1/chat/completions
pub async fn chat_completions(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatCompletionRequest>,
) -> impl IntoResponse {
    let (agent_id, agent_name) = match resolve_agent(&state, &req.model) {
        Some(pair) => pair,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": {
                        "message": format!("No agent found for model '{}'", req.model),
                        "type": "invalid_request_error",
                        "code": "model_not_found"
                    }
                })),
            )
                .into_response();
        }
    };

    // Extract the last user message as the input
    let messages = convert_messages(&req.messages);
    let last_user_msg = messages
        .iter()
        .rev()
        .find(|m| m.role == Role::User)
        .map(|m| m.content.text_content())
        .unwrap_or_default();

    if last_user_msg.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": {
                    "message": "No user message found in request",
                    "type": "invalid_request_error",
                    "code": "missing_message"
                }
            })),
        )
            .into_response();
    }

    let request_id = format!("chatcmpl-{}", uuid::Uuid::new_v4());
    let created = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if req.stream {
        // Streaming response
        return match stream_response(
            state,
            agent_id,
            agent_name,
            &last_user_msg,
            request_id,
            created,
        )
        .await
        {
            Ok(sse) => sse.into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": {
                        "message": format!("{e}"),
                        "type": "server_error"
                    }
                })),
            )
                .into_response(),
        };
    }

    // Non-streaming response
    let kernel_handle: Arc<dyn KernelHandle> = state.kernel.clone() as Arc<dyn KernelHandle>;
    match state
        .kernel
        .send_message_with_handle(agent_id, &la
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1169** (2026-05-12): **shell_exec only receives HOME/PATH/PWD in Docker despite env vars present in PID 1 and passthrough allowlists**
  *Symptoms*: ### Description  ## Summary  In Docker on v0.6.4, `shell_exec` subprocesses only see a minimal environment (`HOME`, `PATH`, `PWD`) even though the full environment is present in the running `openfang` process and config passthrough/allowlists are set.  This looks related to the subprocess env-clearing behavior and may be similar in class to #660.  ## Version  - OpenFang: v0.6.4 - Deployment: Docker Compose - Restart method: always `docker compose down && docker compose up -d`    ## Actual  When the agent runs:  ```sh printenv ```  the complete output is only:  ```sh HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/linuxbrew/.linuxbrew/bin PWD=/data/workspaces/assistant ```  So `shell_exec` is getting only a minimal environment.  ## Proof the env vars are in the OpenFang process  Running this through the agent:  ```sh cat /proc/1/environ ```  shows PID 1 has the expected variables, including:  ```sh PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/linuxbrew/.linuxbrew/bin GOG_KEYRING_BACKEND=file GOG_CONFIG_DIR=/root/.config/gogcli OPENFANG_ALLOW_NO_AUTH=1 OPENFANG_HOME=/data GOG_ACCOUNT=<REDACTED> GEMINI_API_KEY=<REDACTED> OPENAI_API_KEY=<REDACTED> GOG_KEYRING_PASSWORD=<REDACTED> TZ=America/Chicago HOME=/root ```  So the environment is definitely present in the `openfang` service process, but not in the subprocess used by `shell_exec`.  ## Docker Compose environment resolution is correct  `docker compose config` resolve
  **Post-Mortem & Fix Analysis**:
  > Fixed in 5cc865e.  Root cause: subprocess_sandbox::sandbox_command calls env_clear() and only re-adds SAFE_ENV_VARS (PATH, HOME, TMPDIR, LANG, etc.). The exec_policy.env_passthrough and tools.shell_exec.env_allowlist keys you set were silently dropped because no such fields existed on ExecPolicy. Only hand-granted vars were ever forwarded.  Fix: added shell_env_passthrough: Vec<String> on ExecPolicy with serde aliases env_passthrough and env_allowlist for backwards compat with what you tried. Each entry is an env var name forwarded into the shell_exec subprocess. "*" forwards everything from the parent process.  Usage:  [exec_policy] mode = "full" shell_env_passthrough = ["TZ", "GOG_ACCOUNT", "GOG_CONFIG_DIR", "GOG_KEYRING_BACKEND", "GOG_KEYRING_PASSWORD"]  Or all-in:  [exec_policy] mode = "full" shell_env_passthrough = ["*"]  Wildcard is unsafe in shared environments since it leaks API keys present in PID 1. Prefer the explicit list.  Ships in the next release.

- **Issue #1167** (2026-05-12): **LaTeX/Mathematical Equations Not Rendering in Chat in Openfang Web**
  *Symptoms*: ### Description  When markdown files containing LaTeX equations (enclosed in `$...$` or `$$...$$`) are viewed in OpenFang's web dashboard or embedded views, the mathematical notation does not render. The raw LaTeX code is displayed as plain text instead.  ### Example  Expected: Properly formatted mathematical equation  Actual: Raw text `$$T = 2\pi \sqrt{\frac{I}{mgh}}$$` displayed  ### Cause  OpenFang's markdown viewer does not include a LaTeX rendering library (KaTeX or MathJax). When .md files containing math expressions are displayed in the dashboard or embedded views, the raw LaTeX source is shown as plain text instead of rendered equations.  ### Request  Consider one of the following solutions:  1. **Use images** — Replace inline math with pre-rendered images of equations 2. **Use Unicode math** — Replace LaTeX with Unicode symbols (e.g., √, π, α, β) 3. **Add client-side rendering** — Embed KaTeX/MathJax via GitHub Pages or browser extension 4. **Document limitation** — Add a note to contribution guidelines that equations must be submitted as images or Unicode   ### Expected Behavior  The latex math should have been rendered correctly.  ### Steps to Reproduce  Ask the following question from openfang  "to determine the acceleration due to gravity using a bar pendulum"  ### OpenFang Version  0.6.4  ### Operating System  Linux (x86_64)
  **Post-Mortem & Fix Analysis**:
  > ## CSP Blocking KaTeX CDN  The original issue (LaTeX not rendering) was caused by **Content Security Policy (CSP)** blocking the jsdelivr CDN from which KaTeX was being loaded dynamically.  ### Root Cause The dashboard's CSP only allowed scripts from `'self'` and `'unsafe-eval'`. When `katex.js` tried to load KaTeX from `https://cdn.jsdelivr.net`, the browser blocked it due to CSP.  ### Fix Updated the CSP in `webchat.rs` to allow loading from `cdn.jsdelivr.net` for scripts, styles, fonts, and network requests:  ```rust script-src 'self' 'nonce-{nonce}' 'unsafe-eval' https://cdn.jsdelivr.net; \ connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* https://cdn.jsdelivr.net; \ style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net; \ font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; \ ```  Additionally, added a **MutationObserver** in `chat.js` to automatically detect and render

- **Issue #1161** (2026-05-12): **Website is down / DNS or domain expired**
  *Symptoms*: ### Description  The official website is down and DNS cannot resolve an IP  ### Expected Behavior  Website to load  ### Steps to Reproduce  open https://openfang.sh/  ### OpenFang Version  0.3  ### Operating System  Other  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Domain has been restored. Closing as resolved.

- **Issue #1160** (2026-05-12): **MacOS custom certificate**
  *Symptoms*: ### Description  I added a custom openai compatible provider that uses a self signed certificate. The CA is trusted by the keychain in MacOS but openfang fails. The connection is immediately destroyed after it tried to initiate TLS.  ### Expected Behavior  Use the native TLS store of MacOS and just work.  ### Steps to Reproduce  - custom provider with self signed certificate - have ca trusted by system - try to test with any agent  ### OpenFang Version  0.6.4  ### Operating System  macOS (Apple Silicon)  ### Logs / Screenshots  ``` 202X-XX-XXTXX:XX:XX.XXXXXXZ DEBUG rustls::client::hs: No cached session for DnsName("[SERVICE_HOST]") 202X-XX-XXTXX:XX:XX.XXXXXXZ DEBUG rustls::client::hs: Not resuming any session 202X-XX-XXTXX:XX:XX.XXXXXXZ TRACE rustls::client::hs: Sending ClientHello Message {     version: TLSv1_0,     payload: Handshake {         parsed: HandshakeMessagePayload(             ClientHello(                 ClientHelloPayload {                     client_version: TLSv1_2,                     random: <omitted>,                     session_id: <omitted>,                     cipher_suites: [                         TLS13_AES_256_GCM_SHA384,                         TLS13_AES_128_GCM_SHA256,                         TLS13_CHACHA20_POLY1305_SHA256,                         TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,                         TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,                         TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,                         TL
  **Post-Mortem & Fix Analysis**:
  > Similar problem, adding "native-tls" to the list of features for reqwest should fix the problem, I assume.
  > Tracked alongside PR #1166 which adds the native-tls feature flag to reqwest. That PR is in changes-requested while we wait for the requesting use case description and the runtime ClientBuilder selection. Once #1166 lands with a runtime switch, macOS custom CAs through Keychain become usable. Closing here as a duplicate of #1166's outcome; please re-file if you have a specific scenario the workaround in #1166's discussion does not cover.

- **Issue #1157** (2026-05-12): **OpenAI-compat driver uses deprecated reasoning_content field — broken against vLLM ≥ 0.19.0**
  *Symptoms*: ### Description  Follow-up to #1098. OpenFang's OpenAI-compat driver re-emits persisted thinking as reasoning_content on assistant messages. vLLM deprecated and removed this field in v0.19.0 (PR #33402), renaming it to reasoning per OpenAI's GPT-OSS Responses-API convention.  Effect: for any reasoning model served by vLLM ≥ 0.19.0 (MiniMax M2, DeepSeek-R1, Qwen-thinking, GLM-thinking, GPT-OSS, …), persisted thinking is silently stripped by vLLM and never reaches the model — including for intra-turn agentic tool loops where it matters most.  Reproduction (direct vLLM /tokenize endpoint, vllm 0.19.2): sending an assistant message with reasoning_content: "MARKER-..." produces a rendered prompt with no <think> block; sending the same message with reasoning: "MARKER-..." produces <think>\nMARKER-...\n</think> in the prompt as expected.  Suggested fix: rename the outbound field from reasoning_content to reasoning in the OpenAI-compat driver. For backwards compatibility with older vLLM and other servers (some forks may still accept the old name), emit both fields.  Refs: vLLM RFC #27755, PR #33402.  ### Expected Behavior  Persisted assistant thinking (per the #1098 fix) should reach the model on subsequent turns when running against vLLM-served reasoning models — i.e. inside an agentic tool loop, the model's earlier reasoning blocks should appear as <think>...</think> content in the prompt sent to the model, so the model can build on its own prior thinking across tool-calling iterat
  **Post-Mortem & Fix Analysis**:
  > Fixed in efbefa1. OaiResponseMessage now accepts both reasoning_content (legacy) and reasoning (vLLM ≥ 0.19, PR #33402) on ingress via a new reasoning_text() helper that prefers the new field. OaiMessage emits BOTH fields on outbound so persisted thinking reaches the model regardless of server version. Streaming path already handled both names. Added 5 new tests covering vLLM 0.19+ shape, dual-field round-trip, preference order, Moonshot legacy behavior, and non-reasoning model regression guard.

- **Issue #1155** (2026-05-12): **Not possible for this to be bound to 0.0.0.0**
  *Symptoms*: ### Description  I have tried to change the bind address multiple times, the init command will reset the file everytime (daemon.json). This does not   trying to change the config to find to the address does not work either.   ### Expected Behavior  it would stay the same when i put it in the file allow for binding to external address.   ### Steps to Reproduce  any works, as long as you try openganf dashboard, init or start nothing helps  ### OpenFang Version  any  ### Operating System  Linux (x86_64)  ### Logs / Screenshots this should not exist 2026-05-03T08:09:50.510891Z  INFO openfang_api::server: WebSocket endpoint: ws://127.0.0.1:50051/api/agents/{id}/ws  i have changed this  _No response_
  **Post-Mortem & Fix Analysis**:
  > Also, in addition the init command will completely erease all changes I make to the config.toml file.
  > So i am finding the main issue is that the binding does work however, took me about 30 mintues to find the way to get it working in the right order, the issue of doing the commands always shows what looks to be a hardcoded value of localhost everytime. which leads to misleading information. 
  > If there are errors of anykind in the config file it will automatically start on locahost port and do 50051. Which is not what the config nor the daemon from previous launch even says this causes it to refer to a host address that is not only incorrect but making it required to physically get into the system ssh, terminal, or container terminal to change it reboot and restart the machine ..... this then requires erasing the daemon file to allow it to unbreak itself. 

- **Issue #1152** (2026-05-12): **How does one update openfang?**
  *Symptoms*: ### Description  Cant find any documentation or way to update   ### Expected Behavior  should update  ### Steps to Reproduce  .  ### OpenFang Version  any  ### Operating System  Linux (x86_64)  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > `curl -fsSL https://openfang.sh/update | sh`
  > Use `curl -fsSL https://openfang.sh/update | sh` on Linux/macOS or `irm https://openfang.sh/update.ps1 | iex` on Windows. The script preserves your config and just swaps the binary.

- **Issue #1141** (2026-05-12): **Add Shift+Enter to insert new line in chat input**
  *Symptoms*: ### Description  Currently, pressing Shift + Enter in the chat input sends the message immediately. There is no way to insert a line break without sending the message.  ### Expected Behavior  Support Shift + Enter to create a new line (line break) while Enter alone still sends the message.  ### Steps to Reproduce  1. Open any conversation in the Chat tab. 2. Type a line of text (e.g., "First line"). 3. Press Shift + Enter.  ### OpenFang Version  0.6.2  ### Operating System  Linux (x86_64)  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Fix Applied in PR #1176  ### Root Cause  Two issues were causing Shift+Enter not to work properly for multi-line input:  1. **Blocking default behavior unconditionally**: The textarea's `@keydown.enter.prevent` handler was calling `.preventDefault()` on every Enter keypress, even when Shift was held. This blocked the browser's default behavior of inserting a newline.  2. **Newlines not rendered in user messages**: The `escapeHtml()` function was not converting `\n` to `<br>`, so even when newlines were present in the text, they wouldn't display as line breaks in the chat bubble.  ### Changes Made  **File: `crates/openfang-api/static/index_body.html` (line 742)** - Changed `@keydown.enter.prevent` to `@keydown.enter` with conditional `$event.preventDefault()`  - Now `preventDefault()` is only called when `!$event.shiftKey`, allowing Shift+Enter to insert newlines naturally  **File: `crates/openfang-api/static/js/app.js` (line 21)** - Added `.replace(/\n/g, '<br>')` to `escapeHtml()` 

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

### Incident Patch 1: `4583157b` (2026-05-12)
**Commit Message**: audit fixes

**File**: `Cargo.lock` (modified, +76/-76)
```diff
@@ -139,7 +139,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -150,7 +150,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -893,7 +893,7 @@ version = "3.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "faf9468729b8cbcea668e36183cb69d317348c2e08e994829fb56ebfdfbaac34"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -1029,37 +1029,37 @@ dependencies = [
 
 [[package]]
 name = "cranelift-assembler-x64"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "046d4b584c3bb9b5eb500c8f29549bec36be11000f1ba2a927cef3d1a9875691"
+checksum = "adc822414b18d1f5b1b33ce1441534e311e62fef86ebb5b9d382af857d0272c9"
 dependencies = [
  "cranelift-assembler-x64-meta",
 ]
 
 [[package]]
 name = "cranelift-assembler-x64-meta"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b9b194a7870becb1490366fc0ae392ccd188065ff35f8391e77ac659db6fb977"
+checksum = "8c646808b06f4532478d8d6057d74f15c3322f10d995d9486e7dcea405bf521a"
 dependencies = [
  "cranelift-srcgen",
 ]
 
 [[package]]
 name = "cranelift-bforest"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bb6a4ab44c6b371e661846b97dab687387a60ac4e2f864e2d4257284aad9e889"
+checksum = "7b5996f01a686b2349cdb379083ec5ad3e8cb8767fb2d495d3a4f2ee4163a18d"
 dependencies = [
  "cranelift-entity",
  "wasmtime-internal-core",
 ]
 
 [[package]]
 name = "cranelift-bitset"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b8b7a44150c2f471a94023482bda1902710746e4bed9f9973d60c5a94319b06d"
+checksum = "523fea83273f6a985520f57788809a4de2165794d9ab00fb1254fceb4f5aa00c"
 dependencies = [
  "serde",
  "serde_derive",
@@ -1068,9 +1068,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "01b06598133b1dd76758b8b95f8d6747c124124aade50cea96a3d88b962da9fa"
+checksum = "d73d1e372730b5f64ed1a2bd9f01fe4686c8ec14a28034e3084e530c8d951878"
 dependencies = [
  "bumpalo",
  "cranelift-assembler-x64",
@@ -1096,9 +1096,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen-meta"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6190e2e7bcf0a678da2f715363d34ed530fedf7a2f0ab75edaefef72a70465ff"
+checksum = "b0319c18165e93dc1ebf78946a8da0b1c341c95b4a39729a69574671639bdb5f"
 dependencies = [
  "cranelift-assembler-x64-meta",
  "cranelift-codegen-shared",
@@ -1109,24 +1109,24 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen-shared"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f583cf203d1aa8b79560e3b01f929bdacf9070b015eec4ea9c46e22a3f83e4a0"
+checksum = "9195cd8aeecb55e401aa96b2eaa55921636e8246c127ed7908f7ef7e0d40f270"
 
 [[package]]
 name = "cranelift-control"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "803159df35cc398ae54473c150b16d6c77e92ab2948be638488de126a3328fbc"
+checksum = "8976c2154b74136322befc74222ab5c7249edd7e2604f8cbef2b94975541ffb9"
 dependencies = [
  "arbitrary",
 ]
 
 [[package]]
 name = "cranelift-entity"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3109e417257082d88087f5bcce677525bdaa8322b88dd7f175ed1a1fd41d546c"
+checksum = "6038b3147c7982f4951150d5f96c7c06c1e7214b99d4b4a98607aadf8ded89d1"
 dependencies = [
  "cranelift-bitset",
  "serde",
@@ -1136,9 +1136,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-frontend"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "14db6b0e0e4994c581092df78d837be2072578f7cb2528f96a6cf895e56dee63"
+checksum = "4cbd294abe236e23cc3d907b0936226b6a8342db7636daa9c7c72be1e323420e"
 dependencies = [
  "cranelift-codegen",
  "log",
@@ -1148,15 +1148,15 @@ dependencies = [
 
 [[package]]
 name = "cranelift-isle"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ec66ea5025c7317383699778282ac98741d68444f956e3b1d7b62f12b7216e67"
+checksum = "b5a90b6ed3aba84189352a87badeb93b2126d3724225a42dc67fdce53d1b139c"
 
 [[package]]
 name = "cranelift-native"
-version = "0.130.1"
+version = "0.130.2"
 sou
```

---

### Incident Patch 2: `4c496be0` (2026-05-12)
**Commit Message**: integration fixes

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ members = [
 ]
 
 [workspace.package]
-version = "0.6.7"
+version = "0.6.8"
 edition = "2021"
 license = "Apache-2.0 OR MIT"
 repository = "https://github.com/RightNow-AI/openfang"
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -19,8 +19,8 @@
 <p align="center">
   <img src="https://img.shields.io/badge/language-Rust-orange?style=flat-square" alt="Rust" />
   <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" />
-  <img src="https://img.shields.io/badge/version-0.6.7-green?style=flat-square" alt="v0.6.7" />
-  <img src="https://img.shields.io/badge/tests-2,657%2B%20passing-brightgreen?style=flat-square" alt="Tests" />
+  <img src="https://img.shields.io/badge/version-0.6.8-green?style=flat-square" alt="v0.6.8" />
+  <img src="https://img.shields.io/badge/tests-2,669%2B%20passing-brightgreen?style=flat-square" alt="Tests" />
   <img src="https://img.shields.io/badge/clippy-0%20warnings-brightgreen?style=flat-square" alt="Clippy" />
   <a href="https://www.buymeacoffee.com/openfang" target="_blank"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
 </p>
```

**File**: `crates/openfang-channels/src/discord.rs` (modified, +9/-9)
```diff
@@ -1457,7 +1457,7 @@ mod tests {
     async fn test_parse_image_only_no_caption() {
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![att("photo.png", Some("image/png"), 100_000)]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1480,7 +1480,7 @@ mod tests {
             "look at this",
             vec![att("photo.jpg", Some("image/jpeg"), 50_000)],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1512,7 +1512,7 @@ mod tests {
                 att("b.png", Some("image/png"), 20_000),
             ],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1536,7 +1536,7 @@ mod tests {
                 att("b.png", Some("image/png"), 20_000),
             ],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1555,7 +1555,7 @@ mod tests {
     async fn test_parse_heic_falls_to_file() {
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![att("photo.heic", Some("image/heic"), 100_000)]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1575,7 +1575,7 @@ mod tests {
             "",
             vec![att("huge.png", Some("image/png"), 6 * 1024 * 1024)],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1600,7 +1600,7 @@ mod tests {
             "see attached",
             vec![att("doc.pdf", Some("application/pdf"), 200_000)],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1619,7 +1619,7 @@ mod tests {
         // we should fall back to the filename extension.
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![att("pic.png", None, 50_000)]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         assert!(matches!(msg.content, ChannelContent::Image { .. }));
@@ -1629,7 +1629,7 @@ mod tests {
     async fn test_parse_empty_message_with_no_attachments_returns_none() {
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true).await;
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads()).await;
         assert!(msg.is_none());
     }
 }
```

**File**: `crates/openfang-desktop/tauri.conf.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "$schema": "https://schema.tauri.app/config/2",
   "productName": "OpenFang",
-  "version": "0.6.7",
+  "version": "0.6.8",
   "identifier": "ai.openfang.desktop",
   "build": {},
   "app": {
```

**File**: `crates/openfang-kernel/src/kernel.rs` (modified, +22/-10)
```diff
@@ -5249,12 +5249,20 @@ impl OpenFangKernel {
                 .iter()
                 .map(|p| p.id.clone())
                 .collect();
-            let env_map: std::collections::HashMap<String, String> = catalog
-                .list_providers()
-                .iter()
-                .filter(|p| !p.api_key_env.is_empty())
-                .map(|p| (p.api_key_env.to_ascii_uppercase(), p.id.clone()))
-                .collect();
+            // Multi-valued: several providers may share the same api_key_env
+            // (e.g. both `openai` and `codex` use OPENAI_API_KEY). Using a
+            // plain HashMap silently dropped earlier providers — broke #1188.
+            let mut env_map: std::collections::HashMap<String, Vec<String>> =
+                std::collections::HashMap::new();
+            for p in catalog.list_providers() {
+                if p.api_key_env.is_empty() {
+                    continue;
+                }
+                env_map
+                    .entry(p.api_key_env.to_ascii_uppercase())
+                    .or_default()
+                    .push(p.id.clone());
+            }
             (ids, env_map)
         };
 
@@ -5407,10 +5415,12 @@ impl OpenFangKernel {
             }
             for var in skill.manifest.config.values() {
                 if let Some(env_name) = var.env.as_deref() {
-                    if let Some(provider) =
+                    if let Some(providers) =
                         env_to_provider.get(&env_name.to_ascii_uppercase())
                     {
-                        set.insert(provider.clone());
+                        for provider in providers {
+                            set.insert(provider.clone());
+                        }
                     }
                 }
             }
@@ -5422,10 +5432,12 @@ impl OpenFangKernel {
         // wired that provider into their MCP server.
         for server in &self.config.mcp_servers {
             for env_name in &server.env {
-                if let Some(provider) =
+                if let Some(providers) =
                     env_to_provider.get(&env_name.to_ascii_uppercase())
                 {
-                    set.insert(provider.clone());
+                    for provider in providers {
+                        set.insert(provider.clone());
+                    }
                 }
             }
         }
```

**File**: `crates/openfang-skills/src/installer.rs` (modified, +84/-0)
```diff
@@ -124,6 +124,45 @@ pub fn enforce_require_signed(
         )));
     }
 
+    // Bind the signature to the installed bytes.
+    //
+    // envelope.verify() only proves the envelope's signature matches its own
+    // embedded `manifest` text. Without comparing that text to the actual
+    // skill.toml / SKILL.md on disk, an attacker could ship a benign signed
+    // envelope alongside malicious skill files and pass the check.
+    //
+    // Read every candidate manifest file in the installed dir and require
+    // that at least one byte-matches envelope.manifest.
+    const MANIFEST_CANDIDATES: &[&str] = &["skill.toml", "SKILL.md", "skill.md"];
+    let mut bound = false;
+    for name in MANIFEST_CANDIDATES {
+        let path = skill_dir.join(name);
+        if !path.exists() {
+            continue;
+        }
+        match std::fs::read_to_string(&path) {
+            Ok(actual) if actual == envelope.manifest => {
+                bound = true;
+                break;
+            }
+            Ok(_) => {}
+            Err(e) => {
+                return Err(SkillError::SecurityBlocked(format!(
+                    "require_signed: failed to read {} for binding check: {e}",
+                    path.display()
+                )));
+            }
+        }
+    }
+    if !bound {
+        return Err(SkillError::SecurityBlocked(format!(
+            "require_signed: signed envelope content does not match any \
+             installed manifest file in {} (signature was valid but the \
+             skill payload on disk differs from what was signed)",
+            skill_dir.display()
+        )));
+    }
+
     if !opts.allowed_signer_keys.is_empty() {
         let actual = hex::encode(&envelope.signer_public_key);
         let actual_lower = actual.to_lowercase();
@@ -278,6 +317,51 @@ entry = "main.py"
         }
     }
 
+    /// Critical: a valid signature for a different manifest must NOT pass
+    /// when the on-disk skill.toml differs. Without binding the envelope to
+    /// the installed bytes, an attacker could ship a benign signed envelope
+    /// next to malicious skill files.
+    #[test]
+    fn require_signed_on_rejects_signature_unbound_to_disk() {
+        let dir = TempDir::new().unwrap();
+        // Sign a BENIGN manifest body but never write that text to disk.
+        let benign_toml = r#"name = "benign"
+version = "0.1.0"
+description = "Looks fine."
+
+[runtime]
+type = "python"
+entry = "main.py"
+"#;
+        let signing_key = SigningKey::generate(&mut OsRng);
+        let envelope =
+            SignedManifest::sign(benign_toml.to_string(), &signing_key, "trusted-signer");
+        write_signature(dir.path(), &envelope, "signature.json");
+
+        // Write a DIFFERENT (malicious) skill.toml on disk.
+        let evil_toml = r#"name = "evil"
+version = "0.1.0"
+description = "Backdoor."
+
+[runtime]
+type = "python"
+entry = "rm-rf.py"
+"#;
+        std::fs::write(dir.path().join("skill.toml"), evil_toml).unwrap();
+
+        let opts = InstallOptions::require_signed();
+        let err = enforce_require_signed(dir.path(), &opts).unwrap_err();
+        match err {
+            SkillError::SecurityBlocked(msg) => {
+                assert!(
+                    msg.contains("does not match any") || msg.contains("payload on disk differs"),
+                    "got: {msg}"
+                );
+            }
+            other => panic!("expected SecurityBlocked, got {other:?}"),
+        }
+    }
+
     #[test]
     fn load_signature_returns_none_when_absent() {
         let dir = TempDir::new().unwrap();
```

---

### Incident Patch 3: `e683acc5` (2026-05-12)
**Commit Message**: Merge pull request #1045 from dongtran16092006/fix-mcp-system-prompt

fix: system prompt and identity handling, and config form hydration

**File**: `crates/openfang-api/src/routes.rs` (modified, +4/-0)
```diff
@@ -1509,11 +1509,15 @@ pub async fn get_agent(
                 "network": entry.manifest.capabilities.network,
             },
             "description": entry.manifest.description,
+            "system_prompt": entry.manifest.model.system_prompt,
             "tags": entry.manifest.tags,
             "identity": {
                 "emoji": entry.identity.emoji,
                 "avatar_url": entry.identity.avatar_url,
                 "color": entry.identity.color,
+                "archetype": entry.identity.archetype,
+                "vibe": entry.identity.vibe,
+                "greeting_style": entry.identity.greeting_style,
             },
             "skills": entry.manifest.skills,
             "skills_mode": if entry.manifest.skills.is_empty() { "all" } else { "allowlist" },
```

**File**: `crates/openfang-api/static/js/pages/agents.js` (modified, +23/-14)
```diff
@@ -337,29 +337,38 @@ function agentsPage() {
       OpenFangAPI.wsDisconnect();
     },
 
+    buildConfigForm(agent) {
+      var identity = (agent && agent.identity) || {};
+      return {
+        name: (agent && agent.name) || '',
+        system_prompt: (agent && agent.system_prompt) || '',
+        emoji: identity.emoji || '',
+        color: identity.color || '#FF5C00',
+        archetype: identity.archetype || '',
+        vibe: identity.vibe || ''
+      };
+    },
+
     async showDetail(agent) {
-      this.detailAgent = agent;
-      this.detailAgent._fallbacks = [];
       this.detailTab = 'info';
       this.agentFiles = [];
       this.editingFile = null;
       this.fileContent = '';
       this.editingFallback = false;
       this.newFallbackValue = '';
-      this.configForm = {
-        name: agent.name || '',
-        system_prompt: agent.system_prompt || '',
-        emoji: (agent.identity && agent.identity.emoji) || '',
-        color: (agent.identity && agent.identity.color) || '#FF5C00',
-        archetype: (agent.identity && agent.identity.archetype) || '',
-        vibe: (agent.identity && agent.identity.vibe) || ''
-      };
-      this.showDetailModal = true;
-      // Fetch full agent detail to get fallback_models
+      // Load the full detail payload before opening the modal so editable
+      // fields such as system_prompt and identity metadata are hydrated.
+      var detail = agent;
       try {
         var full = await OpenFangAPI.get('/api/agents/' + agent.id);
-        this.detailAgent._fallbacks = full.fallback_models || [];
-      } catch(e) { /* ignore */ }
+        detail = Object.assign({}, agent, full, {
+          identity: Object.assign({}, (agent && agent.identity) || {}, (full && full.identity) || {})
+        });
+      } catch(e) { /* fall back to list payload */ }
+      this.detailAgent = detail;
+      this.detailAgent._fallbacks = detail.fallback_models || [];
+      this.configForm = this.buildConfigForm(detail);
+      this.showDetailModal = true;
     },
 
     killAgent(agent) {
```

---

### Incident Patch 4: `6a1ce40d` (2026-05-12)
**Commit Message**: require signed

**File**: `crates/openfang-skills/Cargo.toml` (modified, +2/-0)
```diff
@@ -25,3 +25,5 @@ zip = { workspace = true }
 [dev-dependencies]
 tempfile = { workspace = true }
 tokio-test = { workspace = true }
+ed25519-dalek = { workspace = true }
+rand = { workspace = true }
```

**File**: `crates/openfang-skills/src/clawhub.rs` (modified, +30/-1)
```diff
@@ -11,6 +11,7 @@
 //! - Download: `GET /api/v1/download?slug=...`
 //! - File: `GET /api/v1/skills/{slug}/file?path=SKILL.md`
 
+use crate::installer::{enforce_require_signed, InstallOptions};
 use crate::openclaw_compat;
 use crate::verify::{SkillVerifier, SkillWarning, WarningSeverity};
 use crate::SkillError;
@@ -491,6 +492,25 @@ impl ClawHubClient {
 
     /// Install a skill from ClawHub into the target directory.
     ///
+    /// Convenience wrapper around [`Self::install_with_options`] using the
+    /// default (permissive) options. Existing callers behave exactly as
+    /// before.
+    pub async fn install(
+        &self,
+        slug: &str,
+        target_dir: &Path,
+    ) -> Result<ClawHubInstallResult, SkillError> {
+        self.install_with_options(slug, target_dir, &InstallOptions::default())
+            .await
+    }
+
+    /// Install a skill from ClawHub with explicit enforcement options.
+    ///
+    /// When `opts.require_signed` is true, the skill must ship with a valid
+    /// Ed25519 `SignedManifest` envelope (see [`crate::installer`] for the
+    /// well-known filenames). Skills failing the gate are removed from disk
+    /// and a `SkillError::SecurityBlocked` is returned.
+    ///
     /// Security pipeline:
     /// 1. Download skill zip and compute SHA256
     /// 2. Detect format (SKILL.md vs package.json)
@@ -499,10 +519,12 @@ impl ClawHubClient {
     /// 5. If prompt-only: run prompt injection scan
     /// 6. Check binary dependencies
     /// 7. Write skill.toml with `verified: false`
-    pub async fn install(
+    /// 8. Enforce `require_signed` if requested.
+    pub async fn install_with_options(
         &self,
         slug: &str,
         target_dir: &Path,
+        opts: &InstallOptions,
     ) -> Result<ClawHubInstallResult, SkillError> {
         // Use /api/v1/download?slug=... endpoint
         let url = format!("{}/download?slug={}", self.base_url, urlencoded(slug));
@@ -637,6 +659,12 @@ impl ClawHubClient {
         // Step 7: Write skill.toml
         openclaw_compat::write_openfang_manifest(&skill_dir, &manifest)?;
 
+        // Step 8: Enforce --require-signed gate, if requested.
+        if let Err(e) = enforce_require_signed(&skill_dir, opts) {
+            let _ = std::fs::remove_dir_all(&skill_dir);
+            return Err(e);
+        }
+
         let result = ClawHubInstallResult {
             skill_name: manifest.skill.name.clone(),
             version: manifest.skill.version.clone(),
@@ -650,6 +678,7 @@ impl ClawHubClient {
             slug,
             skill_name = %result.skill_name,
             warnings = result.warnings.len(),
+            require_signed = opts.require_signed,
             "Installed skill from ClawHub"
         );
 
```

**File**: `crates/openfang-skills/src/installer.rs` (added, +299/-0)
```diff
@@ -0,0 +1,299 @@
+//! Skill install enforcement options.
+//!
+//! Wraps the per-source install clients (FangHub `marketplace`, ClawHub) with
+//! optional supply-chain gates. The flagship gate is `require_signed`: when
+//! true, an Ed25519 `SignedManifest` envelope must sit alongside the skill
+//! payload and verify cleanly before the install is considered complete.
+//!
+//! The signature envelope is a JSON serialisation of
+//! [`openfang_types::manifest_signing::SignedManifest`]. The installer looks
+//! for it at one of these well-known names inside the freshly written skill
+//! directory:
+//!
+//! - `signature.json`
+//! - `skill.toml.sig.json`
+//! - `SKILL.md.sig.json`
+//!
+//! On a `require_signed` failure the skill directory is removed and a
+//! `SkillError::SecurityBlocked` is returned, matching the existing
+//! prompt-injection-blocked path in `clawhub.rs`.
+
+use crate::SkillError;
+use openfang_types::manifest_signing::SignedManifest;
+use std::path::Path;
+
+/// Options controlling enforcement during skill install.
+///
+/// Defaults are permissive — `require_signed` is `false` so existing
+/// callers (`Installer::install`, `Installer::install` on the marketplace)
+/// behave exactly as before.
+#[derive(Debug, Clone, Default)]
+pub struct InstallOptions {
+    /// When true, reject any skill that does not ship with a valid Ed25519
+    /// `SignedManifest` envelope. The `--require-signed` CLI flag maps here.
+    pub require_signed: bool,
+    /// Optional allow-list of acceptable signer public keys (hex-encoded,
+    /// 32 bytes / 64 hex chars). When non-empty, the envelope's
+    /// `signer_public_key` must match one of these entries in addition to
+    /// passing cryptographic verification. Empty = any valid signature
+    /// accepted (TOFU mode).
+    pub allowed_signer_keys: Vec<String>,
+}
+
+impl InstallOptions {
+    /// Convenience: `require_signed = true`, no key pinning.
+    pub fn require_signed() -> Self {
+        Self {
+            require_signed: true,
+            allowed_signer_keys: Vec::new(),
+        }
+    }
+
+    /// Convenience: `require_signed = true` with a pinned signer key.
+    pub fn require_signed_by(pubkey_hex: impl Into<String>) -> Self {
+        Self {
+            require_signed: true,
+            allowed_signer_keys: vec![pubkey_hex.into()],
+        }
+    }
+}
+
+/// Well-known filenames the installer searches for a detached signature
+/// envelope, in priority order.
+const SIGNATURE_CANDIDATES: &[&str] = &[
+    "signature.json",
+    "skill.toml.sig.json",
+    "SKILL.md.sig.json",
+];
+
+/// Locate a `SignedManifest` envelope inside `skill_dir`, if any.
+///
+/// Returns the parsed envelope on the first candidate that exists and parses
+/// successfully. Files that exist but fail to parse return an error — a
+/// malformed envelope is a stronger signal than an absent one.
+pub fn load_signature(skill_dir: &Path) -> Result<Option<SignedManifest>, SkillError> {
+    for name in SIGNATURE_CANDIDATES {
+        let path = skill_dir.join(name);
+        if !path.exists() {
+            continue;
+        }
+        let raw = std::fs::read_to_string(&path)?;
+        let envelope: SignedManifest = serde_json::from_str(&raw).map_err(|e| {
+            SkillError::InvalidManifest(format!(
+                "Signature envelope at {} is not valid JSON: {e}",
+                path.display()
+            ))
+        })?;
+        return Ok(Some(envelope));
+    }
+    Ok(None)
+}
+
+/// Enforce `require_signed` against a freshly installed skill directory.
+///
+/// Returns `Ok(())` when:
+/// - `opts.require_signed` is false (no enforcement); or
+/// - a `SignedManifest` envelope is found, `verify()` passes, and (when
+///   `allowed_signer_keys` is non-empty) the signer key is allow-listed.
+///
+/// Returns `SkillError::SecurityBlocked` when enforcement is on and the
+/// skill fails any of those checks. On failure the caller is expected to
+/// remove `skill_dir` to keep the skills directory clean.
+pub fn enforce_require_signed(
+    skill_dir: &Path,
+    opts: &InstallOptions,
+) -> Result<(), SkillError> {
+    if !opts.require_signed {
+        return Ok(());
+    }
+
+    let envelope = match load_signature(skill_dir)? {
+        Some(e) => e,
+        None => {
+            return Err(SkillError::SecurityBlocked(format!(
+                "require_signed: no signature envelope found in {} \
+                 (looked for signature.json / skill.toml.sig.json / SKILL.md.sig.json)",
+                skill_dir.display()
+            )))
+        }
+    };
+
+    if let Err(e) = envelope.verify() {
+        return Err(SkillError::SecurityBlocked(format!(
+            "require_signed: signature verification failed: {e}"
+        )));
+    }
+
+    if !opts.allowed_signer_keys.is_empty() {
+        let actual = hex::encode(&envelope.signer_public_key);
+        let actual_lower = actual.to_lowercase();
+        let matched = opts
+            
```

**File**: `crates/openfang-skills/src/lib.rs` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@
 pub mod bundled;
 pub mod clawhub;
 pub mod config_injection;
+pub mod installer;
 pub mod loader;
 pub mod marketplace;
 pub mod openclaw_compat;
```

**File**: `crates/openfang-skills/src/marketplace.rs` (modified, +32/-2)
```diff
@@ -3,6 +3,7 @@
 //! For Phase 1, uses GitHub releases as the registry backend.
 //! Each skill is a GitHub repo with releases containing the skill bundle.
 
+use crate::installer::{enforce_require_signed, InstallOptions};
 use crate::SkillError;
 use std::path::Path;
 use tracing::info;
@@ -90,8 +91,28 @@ impl MarketplaceClient {
 
     /// Install a skill from a GitHub repo by name.
     ///
-    /// Downloads the latest release tarball and extracts it to the target directory.
+    /// Convenience wrapper around [`Self::install_with_options`] using the
+    /// default (permissive) options. Existing callers behave exactly as
+    /// before.
     pub async fn install(&self, skill_name: &str, target_dir: &Path) -> Result<String, SkillError> {
+        self.install_with_options(skill_name, target_dir, &InstallOptions::default())
+            .await
+    }
+
+    /// Install a skill from a GitHub repo with explicit enforcement options.
+    ///
+    /// When `opts.require_signed` is true, the installed bundle must contain
+    /// a valid Ed25519 `SignedManifest` envelope. Skills failing the gate
+    /// are removed from disk and a `SkillError::SecurityBlocked` is
+    /// returned.
+    ///
+    /// Downloads the latest release tarball and extracts it to the target directory.
+    pub async fn install_with_options(
+        &self,
+        skill_name: &str,
+        target_dir: &Path,
+        opts: &InstallOptions,
+    ) -> Result<String, SkillError> {
         let repo = format!("{}/{}", self.config.github_org, skill_name);
         let url = format!(
             "{}/repos/{}/releases/latest",
@@ -163,7 +184,16 @@ impl MarketplaceClient {
             serde_json::to_string_pretty(&meta).unwrap_or_default(),
         )?;
 
-        info!("Installed skill: {skill_name} {version}");
+        // Enforce --require-signed gate, if requested.
+        if let Err(e) = enforce_require_signed(&skill_dir, opts) {
+            let _ = std::fs::remove_dir_all(&skill_dir);
+            return Err(e);
+        }
+
+        info!(
+            "Installed skill: {skill_name} {version} (require_signed={})",
+            opts.require_signed
+        );
         Ok(version)
     }
 }
```

---

### Incident Patch 5: `838836b2` (2026-05-12)
**Commit Message**: integration fixes

**File**: `crates/openfang-memory/src/session.rs` (modified, +1/-1)
```diff
@@ -496,7 +496,7 @@ impl SessionStore {
             .conn
             .lock()
             .map_err(|e| OpenFangError::Internal(e.to_string()))?;
-        let messages_blob = rmp_serde::to_vec(&canonical.messages)
+        let messages_blob = rmp_serde::to_vec_named(&canonical.messages)
             .map_err(|e| OpenFangError::Serialization(e.to_string()))?;
         conn.execute(
             "INSERT INTO canonical_sessions (agent_id, messages, compaction_cursor, compacted_summary, updated_at)
```

**File**: `crates/openfang-runtime/src/drivers/claude_code.rs` (modified, +3/-0)
```diff
@@ -186,6 +186,7 @@ impl ClaudeCodeDriver {
                     ContentBlock::ToolUse { .. }
                     | ContentBlock::ToolResult { .. }
                     | ContentBlock::Thinking { .. }
+                    | ContentBlock::RedactedThinking { .. }
                     | ContentBlock::Unknown => None,
                 })
                 .collect::<Vec<_>>()
@@ -792,6 +793,7 @@ mod tests {
                         data: fake_b64,
                     },
                 ]),
+                ..Default::default()
             }],
             tools: vec![],
             max_tokens: 1024,
@@ -824,6 +826,7 @@ mod tests {
                     media_type: "image/jpeg".to_string(),
                     data: "Zm9v".to_string(),
                 }]),
+                ..Default::default()
             }],
             tools: vec![],
             max_tokens: 1024,
```

**File**: `crates/openfang-runtime/src/drivers/openai.rs` (modified, +2/-1)
```diff
@@ -776,6 +776,7 @@ impl LlmDriver for OpenAIDriver {
                 }
             }
 
+            let already_has_reasoning = choice.message.reasoning_text().is_some();
             if let Some(text) = choice.message.content {
                 if !text.is_empty() {
                     // Extract <think>...</think> blocks that some local models
@@ -785,7 +786,7 @@ impl LlmDriver for OpenAIDriver {
                         // Only add if we didn't already get a reasoning field
                         // (either legacy `reasoning_content` or new vLLM 0.19+
                         // `reasoning`). Issue #1157.
-                        if choice.message.reasoning_text().is_none() {
+                        if !already_has_reasoning {
                             // Mark the format so we re-emit as inline `<think>`
                             // tags on the next turn (MiniMax/M2.5 style).
                             content.push(ContentBlock::Thinking {
```

**File**: `crates/openfang-runtime/src/tool_runner.rs` (modified, +8/-6)
```diff
@@ -1399,16 +1399,18 @@ fn resolve_directory_path_for_create(
     // Walk up to find the nearest existing ancestor, canonicalize it, then
     // re-append the missing tail.
     let mut existing: PathBuf = candidate.clone();
-    let mut tail: Vec<&std::ffi::OsStr> = Vec::new();
+    let mut tail: Vec<std::ffi::OsString> = Vec::new();
     while !existing.exists() {
-        let Some(parent) = existing.parent() else {
-            return Err("Invalid path: no existing ancestor".to_string());
+        let parent = match existing.parent() {
+            Some(p) => p.to_path_buf(),
+            None => return Err("Invalid path: no existing ancestor".to_string()),
         };
-        let Some(name) = existing.file_name() else {
-            return Err("Invalid path: no filename component".to_string());
+        let name = match existing.file_name() {
+            Some(n) => n.to_os_string(),
+            None => return Err("Invalid path: no filename component".to_string()),
         };
         tail.push(name);
-        existing = parent.to_path_buf();
+        existing = parent;
     }
 
     let canon_existing = existing
```

---

### Incident Patch 6: `25516c7f` (2026-05-12)
**Commit Message**: Merge pull request #1168 from nimitbhardwaj/fix/latex-rendering

fix: render LaTeX math in chat messages

**File**: `crates/openfang-api/src/webchat.rs` (modified, +5/-4)
```diff
@@ -90,11 +90,11 @@ pub async fn webchat_page() -> impl IntoResponse {
     let html = WEBCHAT_HTML.replace(NONCE_PLACEHOLDER, &nonce);
     let csp = format!(
         "default-src 'self'; \
-         script-src 'self' 'nonce-{nonce}' 'unsafe-eval'; \
-         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; \
+         script-src 'self' 'nonce-{nonce}' 'unsafe-eval' https://cdn.jsdelivr.net; \
+         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net; \
          img-src 'self' data: blob:; \
-         connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*; \
-         font-src 'self' https://fonts.gstatic.com; \
+         connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* https://cdn.jsdelivr.net; \
+         font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; \
          media-src 'self' blob:; \
          frame-src 'self' blob:; \
          object-src 'none'; \
@@ -120,6 +120,7 @@ pub async fn webchat_page() -> impl IntoResponse {
 /// All vendor libraries (Alpine.js, marked.js, highlight.js) are bundled
 /// locally — no CDN dependency. Alpine.js is included LAST because it
 /// immediately processes x-data directives and fires alpine:init on load.
+/// KaTeX is loaded dynamically from jsdelivr CDN when needed for LaTeX rendering.
 const WEBCHAT_HTML: &str = concat!(
     include_str!("../static/index_head.html"),
     "<style>\n",
```

**File**: `crates/openfang-api/static/js/pages/chat.js` (modified, +23/-0)
```diff
@@ -143,6 +143,29 @@ function chatPage() {
       // Fetch dynamic commands from server
       this.fetchCommands();
 
+      // Observe DOM for new messages and render LaTeX
+      this._latexObserver = new MutationObserver(function(mutations) {
+        mutations.forEach(function(mutation) {
+          mutation.addedNodes.forEach(function(node) {
+            if (node.nodeType === Node.ELEMENT_NODE) {
+              var bubbles = node.querySelector ? node.querySelectorAll('.message-bubble') : [];
+              if (node.classList && node.classList.contains('message-bubble')) {
+                bubbles = [node];
+              }
+              bubbles.forEach(function(bubble) {
+                if (bubble.textContent && hasLatexDelimiters(bubble.textContent)) {
+                  renderLatex(bubble);
+                }
+              });
+            }
+          });
+        });
+      });
+      this._latexObserver.observe(document.getElementById('messages') || document.body, {
+        childList: true,
+        subtree: true
+      });
+
       // Ctrl+/ keyboard shortcut
       document.addEventListener('keydown', function(e) {
         if ((e.ctrlKey || e.metaKey) && e.key === '/') {
```

---

### Incident Patch 7: `ae2706bd` (2026-05-12)
**Commit Message**: Merge pull request #1176 from nimitbhardwaj/fix/new-line-chat

fix(chat): support Shift+Enter for multi-line input and proper newline display

**File**: `crates/openfang-api/static/index_body.html` (modified, +1/-1)
```diff
@@ -739,7 +739,7 @@ <h3 style="margin:0 0 8px;font-size:16px;font-weight:600">Select an agent to sta
                   <span class="text-xs" style="color:var(--danger)" x-text="formatRecordingTime()"></span>
                 </div>
                 <textarea id="msg-input" rows="1" :placeholder="recording ? 'Recording... release to send' : 'Message OpenFang... (/ for commands)'"
-                          @keydown.enter.prevent="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
+                          @keydown.enter="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){$event.preventDefault();if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
                           @keydown.escape="showSlashMenu = false; showModelPicker = false"
                           @keydown.arrow-up.prevent="if(showModelPicker){modelPickerIdx = Math.max(0, modelPickerIdx - 1)}else if(showSlashMenu){slashIdx = Math.max(0, slashIdx - 1)}"
                           @keydown.arrow-down.prevent="if(showModelPicker){modelPickerIdx = Math.min(filteredModelPicker.length - 1, modelPickerIdx + 1)}else if(showSlashMenu){slashIdx = Math.min(filteredSlashCommands.length - 1, slashIdx + 1)}"
```

**File**: `crates/openfang-api/static/js/app.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ if (typeof marked !== 'undefined') {
 function escapeHtml(text) {
   var div = document.createElement('div');
   div.textContent = text || '';
-  return div.innerHTML;
+  return div.innerHTML.replace(/\n/g, '<br>');
 }
 
 function renderMarkdown(text) {
```

---

### Incident Patch 8: `6b03cb2e` (2026-05-12)
**Commit Message**: test fix

**File**: `crates/openfang-runtime/src/drivers/gemini.rs` (modified, +1/-0)
```diff
@@ -1635,6 +1635,7 @@ mod tests {
                         "thought_signature": "text_sig_abc"
                     })),
                 }]),
+                ..Default::default()
             },
         ];
 
```

---

### Incident Patch 9: `90d16e52` (2026-05-12)
**Commit Message**: Merge pull request #1175 from aqilaziz/docs-fix-getting-started-links

Fix getting started documentation links

**File**: `docs/getting-started.md` (modified, +5/-5)
```diff
@@ -326,11 +326,11 @@ The embedded WebChat UI allows you to:
 Now that you have OpenFang running:
 
 - **Explore agent templates**: Browse the `agents/` directory for 30 pre-built agents (coder, researcher, writer, ops, analyst, security-auditor, and more).
-- **Create custom agents**: Write your own `agent.toml` manifests. See the [Architecture guide](architecture) for details on capabilities and scheduling.
-- **Set up channels**: Connect any of 40 messaging platforms (Telegram, Discord, Slack, WhatsApp, LINE, Mastodon, and 34 more). See [Channel Adapters](channel-adapters).
-- **Use bundled skills**: 60 expert knowledge skills are pre-installed (GitHub, Docker, Kubernetes, security audit, prompt engineering, etc.). See [Skill Development](skill-development).
-- **Build custom skills**: Extend agents with Python, WASM, or prompt-only skills. See [Skill Development](skill-development).
-- **Use the API**: 76 REST/WS/SSE endpoints, including an OpenAI-compatible `/v1/chat/completions`. See [API Reference](api-reference).
+- **Create custom agents**: Write your own `agent.toml` manifests. See the [Architecture guide](architecture.md) for details on capabilities and scheduling.
+- **Set up channels**: Connect any of 40 messaging platforms (Telegram, Discord, Slack, WhatsApp, LINE, Mastodon, and 34 more). See [Channel Adapters](channel-adapters.md).
+- **Use bundled skills**: 60 expert knowledge skills are pre-installed (GitHub, Docker, Kubernetes, security audit, prompt engineering, etc.). See [Skill Development](skill-development.md).
+- **Build custom skills**: Extend agents with Python, WASM, or prompt-only skills. See [Skill Development](skill-development.md).
+- **Use the API**: 76 REST/WS/SSE endpoints, including an OpenAI-compatible `/v1/chat/completions`. See [API Reference](api-reference.md).
 - **Switch LLM providers**: 20 providers supported (Anthropic, OpenAI, Gemini, Groq, DeepSeek, xAI, Ollama, and more). Per-agent model overrides.
 - **Set up workflows**: Chain multiple agents together. Use `openfang workflow create` with a TOML workflow definition.
 - **Use MCP**: Connect to external tools via Model Context Protocol. Configure in `config.toml` under `[[mcp_servers]]`.
```

---

### Incident Patch 10: `538e943d` (2026-05-12)
**Commit Message**: clippy fix

**File**: `crates/openfang-runtime/src/agent_loop.rs` (modified, +9/-4)
```diff
@@ -87,6 +87,7 @@ const MAX_CONTINUATIONS: u32 = 5;
 
 /// Default maximum message history size before auto-trimming to prevent context overflow.
 /// Per-agent overrides come from `AgentManifest::max_history_messages` (issue #871).
+#[allow(dead_code)]
 const MAX_HISTORY_MESSAGES: usize = openfang_types::agent::DEFAULT_MAX_HISTORY_MESSAGES;
 
 /// Detect when the LLM claims to have performed an action (sent, posted, emailed)
@@ -3497,8 +3498,10 @@ mod tests {
     /// Issue #871: an agent with a manifest override uses that value.
     #[test]
     fn test_effective_max_history_uses_manifest_override() {
-        let mut manifest = openfang_types::agent::AgentManifest::default();
-        manifest.max_history_messages = Some(40);
+        let mut manifest = openfang_types::agent::AgentManifest {
+            max_history_messages: Some(40),
+            ..Default::default()
+        };
         assert_eq!(manifest.effective_max_history_messages(), 40);
 
         manifest.max_history_messages = Some(6);
@@ -3510,8 +3513,10 @@ mod tests {
     /// accidentally disabling history entirely.
     #[test]
     fn test_effective_max_history_falls_back_to_default() {
-        let mut manifest = openfang_types::agent::AgentManifest::default();
-        manifest.max_history_messages = None;
+        let mut manifest = openfang_types::agent::AgentManifest {
+            max_history_messages: None,
+            ..Default::default()
+        };
         assert_eq!(
             manifest.effective_max_history_messages(),
             MAX_HISTORY_MESSAGES
```

---

### Incident Patch 11: `37e2043e` (2026-05-12)
**Commit Message**: another timeout

**File**: `crates/openfang-runtime/src/agent_loop.rs` (modified, +56/-44)
```diff
@@ -2119,49 +2119,51 @@ pub async fn run_agent_loop_streaming(
                     // Resolve effective exec policy (per-agent override or global)
                     let effective_exec_policy = manifest.exec_policy.as_ref();
 
-                    // Timeout-wrapped execution
-                    let timeout = tool_timeout_for(&tool_call.name);
-                    let timeout_secs = timeout.as_secs();
-                    let result = match tokio::time::timeout(
-                        timeout,
-                        tool_runner::execute_tool(
-                            &tool_call.id,
-                            &tool_call.name,
-                            &tool_call.input,
-                            kernel.as_ref(),
-                            Some(&allowed_tool_names),
-                            Some(&caller_id_str),
-                            skill_registry,
-                            mcp_connections,
-                            web_ctx,
-                            browser_ctx,
-                            if hand_allowed_env.is_empty() {
-                                None
-                            } else {
-                                Some(&hand_allowed_env)
-                            },
-                            workspace_root,
-                            media_engine,
-                            effective_exec_policy,
-                            tts_engine,
-                            docker_config,
-                            process_manager,
-                        ),
-                    )
-                    .await
-                    {
-                        Ok(result) => result,
-                        Err(_) => {
-                            warn!(tool = %tool_call.name, "Tool execution timed out after {}s (streaming)", timeout_secs);
-                            openfang_types::tool::ToolResult {
-                                tool_use_id: tool_call.id.clone(),
-                                content: format!(
-                                    "Tool '{}' timed out after {}s.",
-                                    tool_call.name, timeout_secs
-                                ),
-                                is_error: true,
+                    // Timeout-wrapped execution. `tool_timeout_for` returns None
+                    // when the operator disabled the timeout (issue #1125).
+                    let timeout_opt = tool_timeout_for(&tool_call.name);
+                    let exec_fut = tool_runner::execute_tool(
+                        &tool_call.id,
+                        &tool_call.name,
+                        &tool_call.input,
+                        kernel.as_ref(),
+                        Some(&allowed_tool_names),
+                        Some(&caller_id_str),
+                        skill_registry,
+                        mcp_connections,
+                        web_ctx,
+                        browser_ctx,
+                        if hand_allowed_env.is_empty() {
+                            None
+                        } else {
+                            Some(&hand_allowed_env)
+                        },
+                        workspace_root,
+                        media_engine,
+                        effective_exec_policy,
+                        tts_engine,
+                        docker_config,
+                        process_manager,
+                    );
+                    let result = match timeout_opt {
+                        Some(timeout) => {
+                            let timeout_secs = timeout.as_secs();
+                            match tokio::time::timeout(timeout, exec_fut).await {
+                                Ok(result) => result,
+                                Err(_) => {
+                                    warn!(tool = %tool_call.name, "Tool execution timed out after {}s (streaming)", timeout_secs);
+                                    openfang_types::tool::ToolResult {
+                                        tool_use_id: tool_call.id.clone(),
+                                        content: format!(
+                                            "Tool '{}' timed out after {}s.",
+                                            tool_call.name, timeout_secs
+                                        ),
+                                        is_error: true,
+                                    }
+                                }
                             }
                         }
+                        None => exec_fut.await,
                     };
 
                     // Fire AfterToolCall hook
@@ -2276,7 +2278,12 @@ pub async fn run_agent_loop_streaming(
                     } else {
                         text
                     };
-                    session.messages.push(Message::assistant(&text));
+                    // Issue #1148: preserve Thinking / RedactedThinking blocks
+                    // present in the response so reasoning state survives
+ 
```

---

### Incident Patch 12: `15da248f` (2026-05-12)
**Commit Message**: another timeout

**File**: `crates/openfang-runtime/src/agent_loop.rs` (modified, +57/-4)
```diff
@@ -3310,12 +3310,65 @@ mod tests {
         assert_eq!(AGENT_TOOL_TIMEOUT_SECS, 600);
     }
 
+    /// All `tool_timeout_for` cases live in one test (defaults plus env
+    /// overrides) to avoid env-var races between parallel test threads.
+    /// Issue #1125: operators on slow local inference (vLLM on old GPUs) need
+    /// to disable or extend the inter-agent timeout via env var.
     #[test]
     fn test_tool_timeout_for_agent_tools() {
-        assert_eq!(tool_timeout_for("agent_send"), Duration::from_secs(600));
-        assert_eq!(tool_timeout_for("agent_spawn"), Duration::from_secs(600));
-        assert_eq!(tool_timeout_for("file_read"), Duration::from_secs(120));
-        assert_eq!(tool_timeout_for("shell_exec"), Duration::from_secs(120));
+        // Baseline: no env overrides → compiled-in defaults.
+        std::env::remove_var("OPENFANG_AGENT_TOOL_TIMEOUT_SECS");
+        std::env::remove_var("OPENFANG_TOOL_TIMEOUT_SECS");
+        assert_eq!(
+            tool_timeout_for("agent_send"),
+            Some(Duration::from_secs(600))
+        );
+        assert_eq!(
+            tool_timeout_for("agent_spawn"),
+            Some(Duration::from_secs(600))
+        );
+        assert_eq!(
+            tool_timeout_for("file_read"),
+            Some(Duration::from_secs(120))
+        );
+        assert_eq!(
+            tool_timeout_for("shell_exec"),
+            Some(Duration::from_secs(120))
+        );
+
+        // Override: set to 0 → timeout disabled.
+        std::env::set_var("OPENFANG_AGENT_TOOL_TIMEOUT_SECS", "0");
+        std::env::set_var("OPENFANG_TOOL_TIMEOUT_SECS", "0");
+        assert_eq!(tool_timeout_for("agent_send"), None);
+        assert_eq!(tool_timeout_for("agent_spawn"), None);
+        assert_eq!(tool_timeout_for("file_read"), None);
+
+        // Override: custom positive values are honored verbatim.
+        std::env::set_var("OPENFANG_AGENT_TOOL_TIMEOUT_SECS", "1800");
+        std::env::set_var("OPENFANG_TOOL_TIMEOUT_SECS", "300");
+        assert_eq!(
+            tool_timeout_for("agent_send"),
+            Some(Duration::from_secs(1800))
+        );
+        assert_eq!(
+            tool_timeout_for("file_read"),
+            Some(Duration::from_secs(300))
+        );
+
+        // Override: unparseable values fall back to compiled-in defaults.
+        std::env::set_var("OPENFANG_AGENT_TOOL_TIMEOUT_SECS", "not-a-number");
+        std::env::set_var("OPENFANG_TOOL_TIMEOUT_SECS", "");
+        assert_eq!(
+            tool_timeout_for("agent_send"),
+            Some(Duration::from_secs(600))
+        );
+        assert_eq!(
+            tool_timeout_for("file_read"),
+            Some(Duration::from_secs(120))
+        );
+
+        std::env::remove_var("OPENFANG_AGENT_TOOL_TIMEOUT_SECS");
+        std::env::remove_var("OPENFANG_TOOL_TIMEOUT_SECS");
     }
 
     #[test]
```

---

### Incident Patch 13: `5e228336` (2026-05-08)
**Commit Message**: fix(chat): support Shift+Enter for multi-line input and proper newline display

**File**: `crates/openfang-api/static/index_body.html` (modified, +1/-1)
```diff
@@ -739,7 +739,7 @@ <h3 style="margin:0 0 8px;font-size:16px;font-weight:600">Select an agent to sta
                   <span class="text-xs" style="color:var(--danger)" x-text="formatRecordingTime()"></span>
                 </div>
                 <textarea id="msg-input" rows="1" :placeholder="recording ? 'Recording... release to send' : 'Message OpenFang... (/ for commands)'"
-                          @keydown.enter.prevent="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
+                          @keydown.enter="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){$event.preventDefault();if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
                           @keydown.escape="showSlashMenu = false; showModelPicker = false"
                           @keydown.arrow-up.prevent="if(showModelPicker){modelPickerIdx = Math.max(0, modelPickerIdx - 1)}else if(showSlashMenu){slashIdx = Math.max(0, slashIdx - 1)}"
                           @keydown.arrow-down.prevent="if(showModelPicker){modelPickerIdx = Math.min(filteredModelPicker.length - 1, modelPickerIdx + 1)}else if(showSlashMenu){slashIdx = Math.min(filteredSlashCommands.length - 1, slashIdx + 1)}"
```

**File**: `crates/openfang-api/static/js/app.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ if (typeof marked !== 'undefined') {
 function escapeHtml(text) {
   var div = document.createElement('div');
   div.textContent = text || '';
-  return div.innerHTML;
+  return div.innerHTML.replace(/\n/g, '<br>');
 }
 
 function renderMarkdown(text) {
```

---

### Incident Patch 14: `8b10930e` (2026-05-07)
**Commit Message**: Fix getting started documentation links

**File**: `docs/getting-started.md` (modified, +5/-5)
```diff
@@ -326,11 +326,11 @@ The embedded WebChat UI allows you to:
 Now that you have OpenFang running:
 
 - **Explore agent templates**: Browse the `agents/` directory for 30 pre-built agents (coder, researcher, writer, ops, analyst, security-auditor, and more).
-- **Create custom agents**: Write your own `agent.toml` manifests. See the [Architecture guide](architecture) for details on capabilities and scheduling.
-- **Set up channels**: Connect any of 40 messaging platforms (Telegram, Discord, Slack, WhatsApp, LINE, Mastodon, and 34 more). See [Channel Adapters](channel-adapters).
-- **Use bundled skills**: 60 expert knowledge skills are pre-installed (GitHub, Docker, Kubernetes, security audit, prompt engineering, etc.). See [Skill Development](skill-development).
-- **Build custom skills**: Extend agents with Python, WASM, or prompt-only skills. See [Skill Development](skill-development).
-- **Use the API**: 76 REST/WS/SSE endpoints, including an OpenAI-compatible `/v1/chat/completions`. See [API Reference](api-reference).
+- **Create custom agents**: Write your own `agent.toml` manifests. See the [Architecture guide](architecture.md) for details on capabilities and scheduling.
+- **Set up channels**: Connect any of 40 messaging platforms (Telegram, Discord, Slack, WhatsApp, LINE, Mastodon, and 34 more). See [Channel Adapters](channel-adapters.md).
+- **Use bundled skills**: 60 expert knowledge skills are pre-installed (GitHub, Docker, Kubernetes, security audit, prompt engineering, etc.). See [Skill Development](skill-development.md).
+- **Build custom skills**: Extend agents with Python, WASM, or prompt-only skills. See [Skill Development](skill-development.md).
+- **Use the API**: 76 REST/WS/SSE endpoints, including an OpenAI-compatible `/v1/chat/completions`. See [API Reference](api-reference.md).
 - **Switch LLM providers**: 20 providers supported (Anthropic, OpenAI, Gemini, Groq, DeepSeek, xAI, Ollama, and more). Per-agent model overrides.
 - **Set up workflows**: Chain multiple agents together. Use `openfang workflow create` with a TOML workflow definition.
 - **Use MCP**: Connect to external tools via Model Context Protocol. Configure in `config.toml` under `[[mcp_servers]]`.
```

---

### Incident Patch 15: `5c1b1508` (2026-05-06)
**Commit Message**: Fix Latex Rendering in Openfang Web

**File**: `crates/openfang-api/src/webchat.rs` (modified, +5/-4)
```diff
@@ -90,11 +90,11 @@ pub async fn webchat_page() -> impl IntoResponse {
     let html = WEBCHAT_HTML.replace(NONCE_PLACEHOLDER, &nonce);
     let csp = format!(
         "default-src 'self'; \
-         script-src 'self' 'nonce-{nonce}' 'unsafe-eval'; \
-         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; \
+         script-src 'self' 'nonce-{nonce}' 'unsafe-eval' https://cdn.jsdelivr.net; \
+         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net; \
          img-src 'self' data: blob:; \
-         connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*; \
-         font-src 'self' https://fonts.gstatic.com; \
+         connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* https://cdn.jsdelivr.net; \
+         font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; \
          media-src 'self' blob:; \
          frame-src 'self' blob:; \
          object-src 'none'; \
@@ -120,6 +120,7 @@ pub async fn webchat_page() -> impl IntoResponse {
 /// All vendor libraries (Alpine.js, marked.js, highlight.js) are bundled
 /// locally — no CDN dependency. Alpine.js is included LAST because it
 /// immediately processes x-data directives and fires alpine:init on load.
+/// KaTeX is loaded dynamically from jsdelivr CDN when needed for LaTeX rendering.
 const WEBCHAT_HTML: &str = concat!(
     include_str!("../static/index_head.html"),
     "<style>\n",
```

**File**: `crates/openfang-api/static/js/pages/chat.js` (modified, +23/-0)
```diff
@@ -143,6 +143,29 @@ function chatPage() {
       // Fetch dynamic commands from server
       this.fetchCommands();
 
+      // Observe DOM for new messages and render LaTeX
+      this._latexObserver = new MutationObserver(function(mutations) {
+        mutations.forEach(function(mutation) {
+          mutation.addedNodes.forEach(function(node) {
+            if (node.nodeType === Node.ELEMENT_NODE) {
+              var bubbles = node.querySelector ? node.querySelectorAll('.message-bubble') : [];
+              if (node.classList && node.classList.contains('message-bubble')) {
+                bubbles = [node];
+              }
+              bubbles.forEach(function(bubble) {
+                if (bubble.textContent && hasLatexDelimiters(bubble.textContent)) {
+                  renderLatex(bubble);
+                }
+              });
+            }
+          });
+        });
+      });
+      this._latexObserver.observe(document.getElementById('messages') || document.body, {
+        childList: true,
+        subtree: true
+      });
+
       // Ctrl+/ keyboard shortcut
       document.addEventListener('keydown', function(e) {
         if ((e.ctrlKey || e.metaKey) && e.key === '/') {
```

#### Recent Merged Pull Requests:
- **PR #1285** (closed): fix(clawhub): forward ownerHandle on install to resolve ambiguous slugs (#1284) (@andyst-dev)
- **PR #1278** (closed): fix(runtime): cancel WASM watchdog on early exit (@andyst-dev)
- **PR #1277** (closed): fix(kernel): scope collect step to preceding fan-out outputs (@andyst-dev)
- **PR #1276** (closed): fix(cli): cron create by agent name, correct create/list response par… (@89rat)
- **PR #1274** (closed): fix(clawhub): forward owner handle on installs (@andyst-dev)
- **PR #1268** (closed): Deploy/kamd1 manifests (@Nideesh1)
- **PR #1266** (closed): Add MiniMax M3 to model catalog (@octo-patch)
- **PR #1265** (closed): Portable USB launcher, landing page, and docs polish (@FreecoDAO)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
